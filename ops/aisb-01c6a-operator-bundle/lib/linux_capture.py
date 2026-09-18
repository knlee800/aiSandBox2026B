#!/usr/bin/env python3
"""Linux capture adapter: sudo -n helper, identity from pidfile+cmdline only.

Do not import subprocess inside send(). A function-local import makes
``subprocess`` a local name for the whole function and breaks the POSIX
privileged ``sudo -n kill`` path with UnboundLocalError.
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from typing import Any, Callable

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from capture import (  # type: ignore  # noqa: E402
    CaptureAdapter,
    CaptureHandle,
    CaptureSignalError,
    match_tcpdump_argv,
    parse_cmdline_tokens,
    parse_proc_starttime,
)
from process_alive import process_exists  # type: ignore  # noqa: E402

RunCmd = Callable[..., Any]


def privileged_kill_argv(sudo_bin: str, sig: int, target: int) -> list[str]:
    return [sudo_bin, "-n", "kill", f"-{int(sig)}", str(int(target))]


def posix_privileged_kill(
    sudo_bin: str,
    sig: int,
    target: int,
    *,
    run: RunCmd | None = None,
    timeout: float = 5,
) -> None:
    """Issue ``sudo -n kill`` and fail closed on non-zero or timeout.

    ``run`` is subprocess.run by default so tests can spy on the real
    privileged argv without using a .py mock-sudo wrapper.
    """
    runner = run or subprocess.run
    argv = privileged_kill_argv(sudo_bin, sig, target)
    try:
        proc = runner(
            argv,
            timeout=timeout,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except subprocess.TimeoutExpired as exc:
        raise CaptureSignalError("PRIVILEGED_KILL_TIMEOUT", f"sudo kill timed out for pid {target}") from exc
    except OSError as exc:
        raise CaptureSignalError("PRIVILEGED_KILL_FAILED", f"sudo kill exec failed: {exc}") from exc
    rc = getattr(proc, "returncode", proc)
    if int(rc) != 0:
        raise CaptureSignalError("PRIVILEGED_KILL_FAILED", f"sudo kill exited {rc} for pid {target}")


class LinuxCapture(CaptureAdapter):
    def __init__(self, sudo_bin: str, python_bin: str, exec_py: str) -> None:
        self.sudo_bin = sudo_bin
        self.python_bin = python_bin
        self.exec_py = exec_py
        self._popens: dict[int, subprocess.Popen] = {}
        self._idents: dict[int, dict] = {}
        self._files: dict[int, tuple] = {}

    def _close_files(self, err, out) -> None:
        for fh in (err, out):
            try:
                if fh is not None:
                    fh.close()
            except Exception:
                pass

    def _cleanup_popen(self, p: subprocess.Popen, err, out) -> None:
        try:
            if p.poll() is None:
                try:
                    p.kill()
                except Exception:
                    pass
                try:
                    p.wait(timeout=2)
                except Exception:
                    pass
        except Exception:
            pass
        self._close_files(err, out)
        self._files.pop(p.pid, None)

    def start(self, iface, bpf, pcap_path, stderr_path, stdout_path, pidfile, exec_helper):
        err = open(stderr_path, "w", encoding="utf-8")
        out = open(stdout_path, "w", encoding="utf-8")
        helper = exec_helper or self.exec_py
        sudo_prefix = [self.python_bin, self.sudo_bin] if str(self.sudo_bin).endswith(".py") else [self.sudo_bin]
        argv = [
            *sudo_prefix,
            "-n",
            self.python_bin,
            helper,
            pidfile,
            iface,
            pcap_path,
            *bpf.split(),
        ]
        child_env = os.environ.copy()
        p = subprocess.Popen(argv, stdout=out, stderr=err, stdin=subprocess.DEVNULL, env=child_env)
        self._popens[p.pid] = p
        self._files[p.pid] = (err, out)
        tcpdump_pid = None
        try:
            for _ in range(50):
                if os.path.isfile(pidfile):
                    with open(pidfile, encoding="utf-8") as pf:
                        raw = pf.read().strip()
                    if raw.isdigit():
                        tcpdump_pid = int(raw)
                        tcpdump_argv = [
                            "/usr/bin/tcpdump",
                            "-nn",
                            "-i",
                            iface,
                            "-U",
                            "-w",
                            pcap_path,
                            *str(bpf).split(),
                        ]
                        start_identity = f"{tcpdump_pid}:{p.pid}"
                        if os.name != "nt":
                            try:
                                start_identity = self._read_proc_start_identity(tcpdump_pid)
                            except OSError:
                                pass
                        ident = {
                            "tcpdump_pid": tcpdump_pid,
                            "sudo_parent_pid": p.pid,
                            "pidfile": pidfile,
                            "pcap_path": pcap_path,
                            "iface": iface,
                            "argv": argv,
                            "tcpdump_argv": tcpdump_argv,
                            "tcpdump_cmdline": " ".join(tcpdump_argv),
                            "start_identity": start_identity,
                        }
                        self._idents[tcpdump_pid] = ident
                        self._idents[p.pid] = ident
                        ident_path = pidfile + ".identity.json"
                        with open(ident_path, "w", encoding="utf-8") as f:
                            json.dump(ident, f)
                            f.write("\n")
                        self._close_files(err, out)
                        self._files.pop(p.pid, None)
                        return tcpdump_pid, p.pid
                if p.poll() is not None:
                    break
                time.sleep(0.05)
            self._cleanup_popen(p, err, out)
            raise RuntimeError("tcpdump pidfile was not written")
        except Exception:
            if tcpdump_pid is None:
                self._cleanup_popen(p, err, out)
            raise

    def alive(self, pid: int) -> bool:
        ident = self._idents.get(pid) or {}
        tcpdump_pid = ident.get("tcpdump_pid")
        target = int(tcpdump_pid) if tcpdump_pid is not None else pid
        return process_exists(int(target))

    def _read_proc_start_identity(self, pid: int) -> str:
        with open(f"/proc/{pid}/stat", encoding="utf-8") as f:
            return f"{int(pid)}:{parse_proc_starttime(f.read())}"

    def live_argv(self, pid: int) -> list[str]:
        """Current process argv tokens. POSIX reads /proc cmdline as NUL fields."""
        if "live_cmdline" in self.__dict__:
            return parse_cmdline_tokens(self.live_cmdline(pid))
        if os.name != "nt":
            with open(f"/proc/{pid}/cmdline", "rb") as f:
                raw = f.read()
            tokens = parse_cmdline_tokens(raw)
            if not tokens:
                raise OSError("empty cmdline")
            return tokens
        ident = self._ident_for(pid)
        argv = ident.get("tcpdump_argv")
        if isinstance(argv, list) and argv:
            return [str(item) for item in argv]
        return parse_cmdline_tokens(self.live_cmdline(pid))

    def live_start_identity(self, pid: int) -> str:
        if "live_start_identity" in self.__dict__:
            return str(self.__dict__["live_start_identity"](pid))
        if os.name != "nt":
            return self._read_proc_start_identity(pid)
        ident = self._ident_for(pid)
        sid = ident.get("start_identity")
        if not sid:
            raise OSError("start identity unreadable")
        return str(sid)

    def live_cmdline(self, pid: int) -> str:
        """Current process cmdline. POSIX reads /proc; recorded identity is not a substitute."""
        if os.name != "nt":
            with open(f"/proc/{pid}/cmdline", "rb") as f:
                return f.read().replace(b"\0", b" ").decode("utf-8", "replace")
        ident = self._idents.get(pid) or {}
        if ident.get("tcpdump_cmdline"):
            return str(ident["tcpdump_cmdline"])
        return os.environ.get(f"MOCK_CMDLINE_{pid}", "")

    def cmdline(self, pid: int) -> str:
        if os.name != "nt":
            return self.live_cmdline(pid)
        ident = self._idents.get(pid) or {}
        if ident.get("tcpdump_cmdline"):
            return str(ident["tcpdump_cmdline"])
        return os.environ.get(f"MOCK_CMDLINE_{pid}", "tcpdump -i iface -w pcap")

    def attach_handle(self, handle: CaptureHandle) -> None:
        """Recover identity in a fresh process from the persisted identity file."""
        ident_path = (handle.pidfile or "") + ".identity.json"
        if not handle.pidfile or not os.path.isfile(ident_path):
            raise CaptureSignalError(
                "CAPTURE_IDENTITY_UNREADABLE",
                "persisted capture identity file is missing",
            )
        try:
            with open(ident_path, encoding="utf-8") as f:
                ident = json.load(f)
        except (OSError, json.JSONDecodeError) as exc:
            raise CaptureSignalError(
                "CAPTURE_IDENTITY_UNREADABLE",
                "persisted capture identity file is unreadable",
            ) from exc
        if not isinstance(ident, dict):
            raise CaptureSignalError("CAPTURE_IDENTITY_UNREADABLE", "persisted identity is not an object")
        if not ident.get("start_identity"):
            raise CaptureSignalError("CAPTURE_IDENTITY_UNREADABLE", "persisted start identity is missing")
        if handle.start_identity and str(ident.get("start_identity")) != str(handle.start_identity):
            raise CaptureSignalError(
                "CAPTURE_IDENTITY_CONFLICT",
                "handle start identity does not match persisted identity",
            )
        if handle.pcap_path and ident.get("pcap_path") not in (None, handle.pcap_path):
            raise CaptureSignalError(
                "CAPTURE_HANDLE_PCAP_MISMATCH",
                "persisted identity pcap_path does not match handle",
            )
        argv = ident.get("tcpdump_argv")
        if handle.tcpdump_argv and isinstance(argv, list) and [str(x) for x in argv] != [str(x) for x in handle.tcpdump_argv]:
            raise CaptureSignalError(
                "CAPTURE_IDENTITY_CONFLICT",
                "handle argv does not match persisted identity",
            )
        ident["pcap_path"] = handle.pcap_path
        ident["iface"] = handle.iface or ident.get("iface")
        ident["pidfile"] = handle.pidfile or ident.get("pidfile")
        if handle.start_identity:
            ident["start_identity"] = handle.start_identity
        tcpdump_pid = ident.get("tcpdump_pid") or handle.tcpdump_pid
        sudo_pid = ident.get("sudo_parent_pid") or handle.sudo_parent_pid
        if tcpdump_pid is not None:
            ident["tcpdump_pid"] = int(tcpdump_pid)
            self._idents[int(tcpdump_pid)] = ident
        if sudo_pid is not None:
            ident["sudo_parent_pid"] = int(sudo_pid)
            self._idents[int(sudo_pid)] = ident

    def ppid(self, pid: int) -> int | None:
        ident = self._idents.get(pid)
        if ident and ident.get("tcpdump_pid") == pid:
            return ident.get("sudo_parent_pid")
        if os.name == "nt":
            return None
        with open(f"/proc/{pid}/stat", encoding="utf-8") as f:
            return int(f.read().split()[3])

    def pgid(self, pid: int) -> int | None:
        if os.name != "nt":
            try:
                with open(f"/proc/{pid}/stat", encoding="utf-8") as f:
                    return int(f.read().split()[4])
            except OSError:
                return None
        ident = self._idents.get(pid)
        if ident and ident.get("tcpdump_pid") == pid:
            return pid
        return pid

    def _ident_for(self, pid: int) -> dict:
        ident = self._idents.get(pid) or {}
        if ident:
            return ident
        nested = self._idents.get(pid)
        if isinstance(nested, dict) and nested.get("tcpdump_pid") in self._idents:
            return self._idents[nested.get("tcpdump_pid")]
        for stored in self._idents.values():
            if pid in (stored.get("tcpdump_pid"), stored.get("sudo_parent_pid")):
                return stored
        return {}

    def send(
        self,
        pid: int,
        sig: int,
        privileged: bool,
        *,
        platform: str | None = None,
        run_cmd: RunCmd | None = None,
        expected_pcap: str | None = None,
        expected_iface: str | None = None,
    ) -> None:
        plat = os.name if platform is None else platform
        ident = self._ident_for(pid)
        recorded = ident.get("tcpdump_pid")
        sudo_pid = ident.get("sudo_parent_pid")
        if recorded is None:
            raise CaptureSignalError("CAPTURE_IDENTITY_MISSING", f"no persisted tcpdump identity for pid {pid}")
        recorded = int(recorded)
        if pid == recorded:
            target = recorded
        elif sudo_pid is not None and pid == int(sudo_pid) and recorded != int(sudo_pid):
            target = recorded
        else:
            raise CaptureSignalError("CAPTURE_SIGNAL_PID_MISMATCH", f"refusing to signal unrecorded pid {pid}")
        pcap_path = expected_pcap or ident.get("pcap_path") or ""
        iface = expected_iface or ident.get("iface") or ""
        if not self.alive(int(target)):
            return
        try:
            tokens = self.live_argv(target)
        except OSError as exc:
            raise CaptureSignalError("TCPDUMP_CMDLINE_UNREADABLE", f"cmdline unread for pid {target}") from exc
        ok, reason = match_tcpdump_argv(tokens, pcap_path=pcap_path, iface=iface)
        if not ok:
            code = "TCPDUMP_PID_REUSED" if reason != "TCPDUMP_CMDLINE_IFACE_MISMATCH" else reason
            raise CaptureSignalError(code, f"pid {target} live argv rejected: {reason}")
        persisted_sid = ident.get("start_identity")
        if not persisted_sid:
            raise CaptureSignalError("CAPTURE_IDENTITY_UNREADABLE", f"missing start identity for pid {target}")
        try:
            live_sid = self.live_start_identity(target)
        except OSError as exc:
            raise CaptureSignalError("CAPTURE_IDENTITY_UNREADABLE", f"start identity unread for pid {target}") from exc
        if not live_sid:
            raise CaptureSignalError("CAPTURE_IDENTITY_UNREADABLE", f"empty start identity for pid {target}")
        if str(live_sid) != str(persisted_sid):
            raise CaptureSignalError(
                "TCPDUMP_PID_REUSED",
                f"pid {target} start identity does not match the recorded capture",
            )
        pidfile = ident.get("pidfile")
        if pidfile:
            try:
                with open(str(pidfile) + ".stop", "w", encoding="utf-8") as sf:
                    sf.write("1\n")
            except OSError:
                pass
        if plat == "nt":
            if sig == signal.SIGINT and pidfile:
                return
            argv = ["taskkill", "/PID", str(target)]
            if sig in (signal.SIGTERM, getattr(signal, "SIGKILL", signal.SIGTERM)):
                argv = ["taskkill", "/F", "/PID", str(target)]
            runner = run_cmd or subprocess.run
            try:
                proc = runner(
                    argv,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=5,
                )
            except subprocess.TimeoutExpired as exc:
                raise CaptureSignalError("CAPTURE_SIGNAL_TIMEOUT", f"taskkill timed out for pid {target}") from exc
            except OSError as exc:
                raise CaptureSignalError("CAPTURE_SIGNAL_FAILED", str(exc)) from exc
            rc = getattr(proc, "returncode", 0)
            if rc not in (0, 128, 1):
                raise CaptureSignalError("CAPTURE_SIGNAL_FAILED", f"taskkill exited {rc}")
            return
        if privileged and not str(self.sudo_bin).endswith(".py"):
            posix_privileged_kill(self.sudo_bin, sig, target, run=run_cmd)
            return
        try:
            os.kill(target, sig)
        except ProcessLookupError:
            return
        except PermissionError as exc:
            raise CaptureSignalError("CAPTURE_SIGNAL_EPERM", f"unprivileged kill of pid {target} failed") from exc
        except OSError as exc:
            raise CaptureSignalError("CAPTURE_SIGNAL_FAILED", str(exc)) from exc

    def tcpdump_read(self, pcap_path: str, err_path: str, timeout_sec: float | None = None) -> int:
        tcpdump = os.environ.get("AISB_TCPDUMP_BIN", "/usr/bin/tcpdump")
        err = open(err_path, "w", encoding="utf-8")
        bound = timeout_sec
        if bound is None:
            bound = float(os.environ.get("AISB_01C6A_TCPDUMP_READ_TIMEOUT_SEC") or "20")
        try:
            if tcpdump.endswith(".py"):
                argv = [self.python_bin, tcpdump, "-nn", "-r", pcap_path]
            else:
                argv = [tcpdump, "-nn", "-r", pcap_path]
            try:
                proc = subprocess.run(argv, stdout=subprocess.DEVNULL, stderr=err, timeout=bound)
            except subprocess.TimeoutExpired:
                return 124
            return int(proc.returncode)
        finally:
            err.close()
