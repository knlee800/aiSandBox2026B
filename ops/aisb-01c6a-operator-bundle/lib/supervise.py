"""Bounded process-group supervision using a monotonic clock.

Tracks the launched process from creation. No branch silently abandons a
potentially dispatched canary. Identity failures, interrupts, early exit,
and surviving group members are explicit outcomes.
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from typing import Callable, Sequence

from clock_util import deadline_reached, monotonic_ms

TERM_GRACE_MS = 5000
KILL_POLL_MS = 50
SIGTERM = signal.SIGTERM
if os.name == "nt":
    # Windows has no SIGKILL; keep a distinct value so force-kill is not SIGTERM.
    SIGKILL = 99
else:
    SIGKILL = getattr(signal, "SIGKILL", signal.SIGTERM)

_WINDOWS_HELPER_EXES = frozenset({"conhost.exe", "csrss.exe"})


@dataclass
class ProcessIdentity:
    pid: int
    pgid: int | None
    cmdline: str
    verified: bool
    reason: str


@dataclass
class SuperviseResult:
    exit_code: int | None
    timed_out: bool
    killed: bool
    identity_failed: bool
    interrupted: bool
    surviving_pids: list[int] = field(default_factory=list)
    identity: ProcessIdentity | None = None
    started_ms: int = 0
    elapsed_ms: int = 0
    stdout: str = ""
    stderr: str = ""
    abandoned: bool = False


class ProcAdapter:
    """OS operations. Tests inject a fake. Staging uses LinuxProc."""

    def spawn(self, argv: Sequence[str], env: dict[str, str], new_session: bool) -> int:
        raise NotImplementedError

    def wait_nonblocking(self, pid: int) -> int | None:
        raise NotImplementedError

    def cmdline(self, pid: int) -> str:
        raise NotImplementedError

    def pgid(self, pid: int) -> int | None:
        raise NotImplementedError

    def group_members(self, pgid: int) -> list[int]:
        raise NotImplementedError

    def send_signal(self, pid: int, sig: int) -> None:
        raise NotImplementedError

    def send_group_signal(self, pgid: int, sig: int) -> None:
        raise NotImplementedError

    def alive(self, pid: int) -> bool:
        raise NotImplementedError

    def read_stdout(self, pid: int) -> str:
        return ""

    def read_stderr(self, pid: int) -> str:
        return ""


class LinuxProc(ProcAdapter):
    def __init__(self, log_dir: str | None = None) -> None:
        self.log_dir = log_dir
        self._popens: dict[int, object] = {}
        self._idents: dict[int, dict] = {}
        self._jobs: dict[int, object] = {}

    def spawn(self, argv: Sequence[str], env: dict[str, str], new_session: bool) -> int:
        import tempfile

        log_dir = self.log_dir or env.get("AISB_01C6A_PROC_LOG_DIR")
        if not log_dir:
            log_dir = tempfile.mkdtemp(prefix="aisb-01c6a-proc-")
        os.makedirs(log_dir, exist_ok=True)
        fd_out, stdout_path = tempfile.mkstemp(prefix="proc-", suffix=".stdout", dir=log_dir)
        fd_err, stderr_path = tempfile.mkstemp(prefix="proc-", suffix=".stderr", dir=log_dir)
        if os.name != "nt":
            os.fchmod(fd_out, 0o600)
            os.fchmod(fd_err, 0o600)
            st_out = os.fstat(fd_out)
            st_err = os.fstat(fd_err)
            import stat as statmod

            if statmod.S_IMODE(st_out.st_mode) & 0o077 or statmod.S_IMODE(st_err.st_mode) & 0o077:
                os.close(fd_out)
                os.close(fd_err)
                raise PermissionError("proc log file mode too permissive")
        argv_list = [str(a) for a in argv]
        if argv_list and argv_list[0].endswith(".py"):
            argv_list = [sys.executable, *argv_list]
        try:
            p = subprocess.Popen(
                argv_list,
                env=env,
                start_new_session=new_session,
                stdout=fd_out,
                stderr=fd_err,
                stdin=subprocess.DEVNULL,
                close_fds=True,
            )
        except Exception:
            os.close(fd_out)
            os.close(fd_err)
            raise
        try:
            os.close(fd_out)
        except OSError:
            pass
        try:
            os.close(fd_err)
        except OSError:
            pass
        pgid = p.pid
        if hasattr(os, "getpgid"):
            try:
                pgid = os.getpgid(p.pid)
            except OSError:
                pgid = p.pid
        ident = {
            "pid": p.pid,
            "pgid": pgid,
            "argv": list(argv_list),
            "cmdline": " ".join(argv_list),
            "stdout_path": stdout_path,
            "stderr_path": stderr_path,
        }
        self._popens[p.pid] = p
        self._idents[p.pid] = ident
        ident_path = os.path.join(log_dir, f"{p.pid}.identity.json")
        with open(ident_path, "w", encoding="utf-8") as f:
            json.dump(ident, f)
            f.write("\n")
        if os.name == "nt":
            self._assign_job(p)
        self.refresh_owned_descendants(p.pid)
        return p.pid

    def wait_nonblocking(self, pid: int) -> int | None:
        p = self._popens.get(pid)
        if p is None:
            ident = self._idents.get(pid)
            if ident and not self.alive(pid):
                return ident.get("exit_code")
            return None
        code = p.poll()
        if code is not None:
            self._idents.setdefault(pid, {})["exit_code"] = code
        return code

    def cmdline(self, pid: int) -> str:
        ident = self._idents.get(pid)
        if ident and ident.get("cmdline"):
            return str(ident["cmdline"])
        path = f"/proc/{pid}/cmdline"
        with open(path, "rb") as f:
            return f.read().replace(b"\0", b" ").decode("utf-8", "replace").strip()

    def pgid(self, pid: int) -> int | None:
        ident = self._idents.get(pid)
        if ident and ident.get("pgid") is not None:
            return int(ident["pgid"])
        try:
            with open(f"/proc/{pid}/stat", "r", encoding="utf-8") as f:
                parts = f.read().split()
            return int(parts[4])
        except OSError:
            return None

    def group_members(self, pgid: int) -> list[int]:
        members: set[int] = set()
        for pid, ident in self._idents.items():
            if ident.get("pgid") == pgid:
                members.add(pid)
                members.update(ident.get("descendants") or [])
                members.update(self._windows_job_members(pid))
        if os.name != "nt":
            members.update(self._linux_pgid_scan(pgid))
        return sorted(p for p in members if p)

    def refresh_owned_descendants(self, pid: int) -> None:
        ident = self._idents.setdefault(pid, {})
        found = set(ident.get("descendants") or [])
        found.update(self._scan_children(pid))
        pgid = ident.get("pgid")
        if os.name != "nt" and pgid:
            found.update(self._linux_pgid_scan(int(pgid)))
        else:
            found.update(self._windows_job_members(pid))
            found.update(self._windows_descendants(pid))
        ident["descendants"] = sorted(p for p in found if p and p != pid)
        self._idents[pid] = ident

    def _linux_pgid_scan(self, pgid: int) -> set[int]:
        found: set[int] = set()
        proc_dir = "/proc"
        if not os.path.isdir(proc_dir):
            return found
        for name in os.listdir(proc_dir):
            if not name.isdigit():
                continue
            pid = int(name)
            try:
                with open(f"/proc/{pid}/stat", encoding="utf-8") as f:
                    parts = f.read().split()
                if len(parts) > 4 and int(parts[4]) == pgid:
                    found.add(pid)
            except (OSError, ValueError, IndexError):
                continue
        return found

    def _scan_children(self, root_pid: int) -> set[int]:
        if os.name == "nt":
            return self._windows_descendants(root_pid)
        found: set[int] = set()
        proc_dir = "/proc"
        if not os.path.isdir(proc_dir):
            return found
        ppid_map: dict[int, list[int]] = {}
        for name in os.listdir(proc_dir):
            if not name.isdigit():
                continue
            pid = int(name)
            try:
                with open(f"/proc/{pid}/stat", encoding="utf-8") as f:
                    parts = f.read().split()
                ppid = int(parts[3])
            except (OSError, ValueError, IndexError):
                continue
            ppid_map.setdefault(ppid, []).append(pid)
        stack = [root_pid]
        seen = set()
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            for child in ppid_map.get(cur, []):
                found.add(child)
                stack.append(child)
        return found

    def _assign_job(self, popen) -> None:
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            job = kernel32.CreateJobObjectW(None, None)
            if not job:
                return
            handle = getattr(popen, "_handle", None)
            if handle is None:
                kernel32.CloseHandle(job)
                return
            if not kernel32.AssignProcessToJobObject(job, int(handle)):
                kernel32.CloseHandle(job)
                return
            self._jobs[popen.pid] = job
        except Exception:
            return

    def _windows_job_members(self, pid: int) -> set[int]:
        job = self._jobs.get(pid)
        if not job or os.name != "nt":
            return set()
        try:
            import ctypes
            from ctypes import wintypes

            JobObjectBasicProcessIdList = 3

            class JOBOBJECT_BASIC_PROCESS_ID_LIST(ctypes.Structure):
                _fields_ = [
                    ("NumberOfAssignedProcesses", wintypes.DWORD),
                    ("NumberOfProcessIdsInList", wintypes.DWORD),
                    ("ProcessIdList", ctypes.c_size_t * 256),
                ]

            info = JOBOBJECT_BASIC_PROCESS_ID_LIST()
            needed = wintypes.DWORD()
            ok = ctypes.windll.kernel32.QueryInformationJobObject(
                job,
                JobObjectBasicProcessIdList,
                ctypes.byref(info),
                ctypes.sizeof(info),
                ctypes.byref(needed),
            )
            if not ok:
                return set()
            n = int(info.NumberOfProcessIdsInList)
            return {int(info.ProcessIdList[i]) for i in range(min(n, 256))}
        except Exception:
            return set()

    def _windows_descendants(self, root_pid: int) -> set[int]:
        if os.name != "nt":
            return set()
        try:
            import ctypes
            from ctypes import wintypes

            TH32CS_SNAPPROCESS = 0x2

            class PROCESSENTRY32W(ctypes.Structure):
                _fields_ = [
                    ("dwSize", wintypes.DWORD),
                    ("cntUsage", wintypes.DWORD),
                    ("th32ProcessID", wintypes.DWORD),
                    ("th32DefaultHeapID", ctypes.POINTER(ctypes.c_ulong)),
                    ("th32ModuleID", wintypes.DWORD),
                    ("cntThreads", wintypes.DWORD),
                    ("th32ParentProcessID", wintypes.DWORD),
                    ("pcPriClassBase", ctypes.c_long),
                    ("dwFlags", wintypes.DWORD),
                    ("szExeFile", wintypes.WCHAR * 260),
                ]

            kernel32 = ctypes.windll.kernel32
            snap = kernel32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            if snap == -1:
                return set()
            entry = PROCESSENTRY32W()
            entry.dwSize = ctypes.sizeof(PROCESSENTRY32W)
            children: dict[int, list[int]] = {}
            ok = kernel32.Process32FirstW(snap, ctypes.byref(entry))
            while ok:
                children.setdefault(int(entry.th32ParentProcessID), []).append(int(entry.th32ProcessID))
                ok = kernel32.Process32NextW(snap, ctypes.byref(entry))
            kernel32.CloseHandle(snap)
            found: set[int] = set()
            stack = [root_pid]
            seen = set()
            while stack:
                cur = stack.pop()
                if cur in seen:
                    continue
                seen.add(cur)
                for child in children.get(cur, []):
                    found.add(child)
                    stack.append(child)
            return found
        except Exception:
            return set()

    def _owned_pids(self, pid: int) -> set[int]:
        ident = self._idents.get(pid) or {}
        owned = {pid}
        owned.update(ident.get("descendants") or [])
        pgid = ident.get("pgid")
        if pgid:
            owned.update(self.group_members(int(pgid)))
        return {p for p in owned if p}

    def send_signal(self, pid: int, sig: int) -> None:
        if pid in (0, 1):
            return
        if os.name == "nt":
            popen = self._popens.get(pid)
            if popen is not None and getattr(popen, "poll", lambda: 0)() is None:
                try:
                    if sig == SIGKILL:
                        popen.kill()
                    else:
                        popen.terminate()
                except Exception:
                    pass
            if sig == SIGKILL:
                try:
                    import ctypes

                    PROCESS_TERMINATE = 0x0001
                    handle = ctypes.windll.kernel32.OpenProcess(PROCESS_TERMINATE, False, int(pid))
                    if handle:
                        ctypes.windll.kernel32.TerminateProcess(handle, 1)
                        ctypes.windll.kernel32.CloseHandle(handle)
                except Exception:
                    pass
            import subprocess

            argv = ["taskkill", "/PID", str(pid)]
            if sig == SIGKILL:
                argv = ["taskkill", "/F", "/T", "/PID", str(pid)]
            try:
                subprocess.call(argv, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            except Exception:
                pass
            return
        try:
            os.kill(pid, sig)
        except OSError:
            pass

    def send_group_signal(self, pgid: int, sig: int) -> None:
        if pgid in (None, 0, 1):
            raise RuntimeError("refusing to signal unowned/init process group")
        if hasattr(os, "killpg") and os.name != "nt":
            try:
                os.killpg(pgid, sig)
                return
            except OSError:
                pass
        for pid in list(self.group_members(pgid)):
            self.send_signal(pid, sig)

    def alive(self, pid: int) -> bool:
        popen = self._popens.get(pid)
        if popen is not None and popen.poll() is not None:
            return False
        ident = self._idents.get(pid) or {}
        if ident.get("exit_code") is not None:
            return False
        from process_alive import process_live

        return process_live(pid)

    def reap(self, pid: int) -> int | None:
        popen = self._popens.get(pid)
        if popen is not None:
            return popen.poll()
        if os.name != "nt":
            try:
                wpid, status = os.waitpid(pid, os.WNOHANG)
                if wpid == 0:
                    return None
                return os.waitstatus_to_exitcode(status) if hasattr(os, "waitstatus_to_exitcode") else status
            except (ChildProcessError, OSError):
                return None
        return None

    def read_stdout(self, pid: int) -> str:
        ident = self._idents.get(pid) or {}
        path = ident.get("stdout_path")
        if path and os.path.isfile(path):
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        return ""

    def read_stderr(self, pid: int) -> str:
        ident = self._idents.get(pid) or {}
        path = ident.get("stderr_path")
        if path and os.path.isfile(path):
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        return ""


def _windows_console_helper(pid: int) -> bool:
    if os.name != "nt" or pid <= 0:
        return False
    try:
        import ctypes
        from ctypes import wintypes

        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, int(pid))
        if not handle:
            err = kernel32.GetLastError()
            return err == 5
        try:
            buf = ctypes.create_unicode_buffer(32768)
            size = wintypes.DWORD(len(buf))
            ok = kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size))
            if not ok:
                return kernel32.GetLastError() == 5
            name = os.path.basename(buf.value).lower()
            return name in _WINDOWS_HELPER_EXES
        finally:
            kernel32.CloseHandle(handle)
    except Exception:
        return False


def verify_identity(
    proc: ProcAdapter,
    pid: int,
    expected_js: str,
    expected_node: str,
) -> ProcessIdentity:
    try:
        cmd = proc.cmdline(pid)
    except OSError:
        return ProcessIdentity(pid, None, "", False, "CMDLINE_UNREADABLE")
    pgid = proc.pgid(pid)
    if pgid is None:
        return ProcessIdentity(pid, None, cmd, False, "PGID_UNREADABLE")
    if pgid != pid:
        return ProcessIdentity(pid, pgid, cmd, False, "NOT_SESSION_LEADER")
    if pgid in (0, 1):
        return ProcessIdentity(pid, pgid, cmd, False, "PGID_FORBIDDEN")
    if expected_js not in cmd:
        return ProcessIdentity(pid, pgid, cmd, False, "CMDLINE_JS_MISMATCH")
    if expected_node not in cmd and "node" not in cmd:
        return ProcessIdentity(pid, pgid, cmd, False, "CMDLINE_NODE_MISMATCH")
    return ProcessIdentity(pid, pgid, cmd, True, "OK")


def _reap_owned(
    proc: ProcAdapter,
    identity: ProcessIdentity,
    term_grace_ms: int,
    now: Callable[[], int],
) -> list[int]:
    """TERM then KILL owned pid/group/descendants. Return live survivors."""
    pid = identity.pid
    pgid = identity.pgid
    refresh = getattr(proc, "refresh_owned_descendants", None)
    if callable(refresh):
        refresh(pid)
    if pgid and pgid not in (0, 1) and pgid == pid:
        proc.send_group_signal(pgid, SIGTERM)
    else:
        proc.send_signal(pid, SIGTERM)
        for member in proc.group_members(pgid or pid):
            if member != pid:
                proc.send_signal(member, SIGTERM)
    term_start = now()
    while not deadline_reached(term_start, term_grace_ms, now()):
        if callable(refresh):
            refresh(pid)
        members = list(proc.group_members(pgid or pid))
        live_members = [
            p for p in members if p != pid and proc.alive(p) and not _windows_console_helper(p)
        ]
        if (not proc.alive(pid)) and (not live_members):
            break
        time.sleep(KILL_POLL_MS / 1000.0)
    if callable(refresh):
        refresh(pid)
    members = list(proc.group_members(pgid or pid))
    still = proc.alive(pid) or any(
        proc.alive(p) and not _windows_console_helper(p) for p in members if p != pid
    )
    if still:
        if pgid and pgid not in (0, 1) and pgid == pid:
            proc.send_group_signal(pgid, SIGKILL)
        else:
            proc.send_signal(pid, SIGKILL)
            for member in proc.group_members(pgid or pid):
                if member != pid:
                    proc.send_signal(member, SIGKILL)
        kill_start = now()
        while not deadline_reached(kill_start, min(2000, term_grace_ms), now()):
            if callable(refresh):
                refresh(pid)
            members = list(proc.group_members(pgid or pid))
            if (not proc.alive(pid)) and (
                not any(
                    proc.alive(p) and not _windows_console_helper(p) for p in members if p != pid
                )
            ):
                break
            time.sleep(KILL_POLL_MS / 1000.0)
    reap = getattr(proc, "reap", None)
    survivors = []
    seen = set()
    check = [pid]
    if pgid:
        check.extend(proc.group_members(pgid))
    owned_fn = getattr(proc, "_owned_pids", None)
    if callable(owned_fn):
        try:
            check.extend(owned_fn(pid))
        except Exception:
            pass
    for member in check:
        if member in seen:
            continue
        seen.add(member)
        if callable(reap):
            try:
                reap(member)
            except Exception:
                pass
        if proc.alive(member):
            if os.name == "nt" and _windows_console_helper(member):
                continue
            survivors.append(member)
    return survivors


def supervise(
    argv: Sequence[str],
    env: dict[str, str],
    timeout_ms: int,
    expected_js: str,
    expected_node: str = "/usr/bin/node",
    proc: ProcAdapter | None = None,
    now: Callable[[], int] | None = None,
    term_grace_ms: int = TERM_GRACE_MS,
) -> SuperviseResult:
    if timeout_ms <= 0:
        raise ValueError("timeout_ms must be positive")
    adapter = proc or LinuxProc()
    clock = now or monotonic_ms
    started = clock()
    result = SuperviseResult(
        exit_code=None,
        timed_out=False,
        killed=False,
        identity_failed=False,
        interrupted=False,
        started_ms=started,
    )
    pid = adapter.spawn(argv, env, new_session=True)
    identity = verify_identity(adapter, pid, expected_js, expected_node)
    result.identity = identity
    if not identity.verified:
        result.identity_failed = True
        result.killed = True
        result.surviving_pids = _reap_owned(adapter, identity, term_grace_ms, clock)
        result.elapsed_ms = clock() - started
        result.stdout = adapter.read_stdout(pid)
        result.stderr = adapter.read_stderr(pid)
        result.abandoned = False
        return result

    try:
        while True:
            exit_code = adapter.wait_nonblocking(pid)
            refresh = getattr(adapter, "refresh_owned_descendants", None)
            if callable(refresh):
                refresh(pid)
            if exit_code is not None:
                result.exit_code = exit_code
                result.elapsed_ms = clock() - started
                result.stdout = adapter.read_stdout(pid)
                result.stderr = adapter.read_stderr(pid)
                # Parent may have spawned owned descendants and exited 0.
                result.surviving_pids = _reap_owned(adapter, identity, term_grace_ms, clock)
                return result
            if deadline_reached(started, timeout_ms, clock()):
                result.timed_out = True
                result.killed = True
                result.surviving_pids = _reap_owned(adapter, identity, term_grace_ms, clock)
                result.elapsed_ms = clock() - started
                result.stdout = adapter.read_stdout(pid)
                result.stderr = adapter.read_stderr(pid)
                return result
            time.sleep(KILL_POLL_MS / 1000.0)
    except KeyboardInterrupt:
        result.interrupted = True
        result.killed = True
        result.surviving_pids = _reap_owned(adapter, identity, term_grace_ms, clock)
        result.elapsed_ms = clock() - started
        result.stdout = adapter.read_stdout(pid)
        result.stderr = adapter.read_stderr(pid)
        result.abandoned = False
        return result
