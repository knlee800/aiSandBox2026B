"""Capture lifecycle for ens5 and conditional loopback.

tcpdump identity comes from the exec pidfile written immediately before exec,
not from guessing a sudo PID. Shutdown targets recorded PIDs only.
"""

from __future__ import annotations

import ipaddress
import os
import signal
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any, Callable

import json
import argparse
import sys

from clock_util import deadline_reached, monotonic_ms
from drop_stats import parse_tcpdump_stderr
from pcap_validate import validate_pcap_file


LISTEN_WAIT_MS = 5000
INT_WAIT_MS = 5000
TERM_GRACE_MS = 2000
SIGINT = signal.SIGINT
SIGTERM = signal.SIGTERM
SIGKILL = getattr(signal, "SIGKILL", signal.SIGTERM)


@dataclass
class CaptureHandle:
    name: str
    iface: str
    filter: str
    pcap_path: str
    stderr_path: str
    stdout_path: str
    pidfile: str
    stat_path: str
    tcpdump_pid: int | None = None
    sudo_parent_pid: int | None = None
    pgid: int | None = None
    listening: bool = False
    running: bool = False
    handle_path: str = ""
    start_identity: str | None = None
    tcpdump_argv: list[str] | None = None


@dataclass
class CaptureStopResult:
    ok: bool
    code: str
    handle: CaptureHandle
    drop_ok: bool
    pcap_ok: bool
    message: str
    packet_count: int = 0


class CaptureAdapter:
    def start(
        self,
        iface: str,
        bpf: str,
        pcap_path: str,
        stderr_path: str,
        stdout_path: str,
        pidfile: str,
        exec_helper: str,
    ) -> tuple[int, int | None]:
        """Start privileged tcpdump. Return (tcpdump_pid, sudo_parent_or_none)."""
        raise NotImplementedError

    def alive(self, pid: int) -> bool:
        raise NotImplementedError

    def cmdline(self, pid: int) -> str:
        raise NotImplementedError

    def ppid(self, pid: int) -> int | None:
        raise NotImplementedError

    def pgid(self, pid: int) -> int | None:
        raise NotImplementedError

    def send(self, pid: int, sig: int, privileged: bool, **kwargs) -> None:
        raise NotImplementedError

    def tcpdump_read(self, pcap_path: str, err_path: str, timeout_sec: float | None = None) -> int:
        """Run tcpdump -nn -r over the whole file. Return exit code."""
        raise NotImplementedError

    def attach_handle(self, handle: "CaptureHandle") -> None:
        return


def wait_listening(stderr_path: str, iface: str, timeout_ms: int, now: Callable[[], int]) -> bool:
    needle = f"listening on {iface}"
    start = now()
    while not deadline_reached(start, timeout_ms, now()):
        if os.path.isfile(stderr_path):
            text = Path(stderr_path).read_text(encoding="utf-8", errors="replace")
            if needle in text:
                return True
        time.sleep(0.05)
    return False


def read_pidfile(path: str) -> int | None:
    if not os.path.isfile(path):
        return None
    raw = Path(path).read_text(encoding="utf-8").strip()
    if not raw.isdigit():
        return None
    return int(raw)


TCPDUMP_BASENAMES = frozenset({"tcpdump", "tcpdump.exe"})


def parse_cmdline_tokens(raw: Any) -> list[str]:
    """Turn a live cmdline into argv tokens. NUL-separated /proc cmdline preferred."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(item) for item in raw]
    if isinstance(raw, tuple):
        return [str(item) for item in raw]
    if isinstance(raw, (bytes, bytearray)):
        data = bytes(raw)
        if b"\0" in data:
            return [part.decode("utf-8", "replace") for part in data.split(b"\0") if part]
        return data.decode("utf-8", "replace").split()
    text = str(raw)
    if "\0" in text:
        return [part for part in text.split("\0") if part]
    return text.split()


def argv_option(tokens: list[str], flag: str) -> str | None:
    for idx, tok in enumerate(tokens):
        if tok == flag and idx + 1 < len(tokens):
            return tokens[idx + 1]
        prefix = flag + "="
        if tok.startswith(prefix) and len(tok) > len(prefix):
            return tok.split("=", 1)[1]
    return None


def executable_is_tcpdump(tokens: list[str]) -> bool:
    if not tokens:
        return False
    base = os.path.basename(tokens[0].replace("\\", "/")).lower()
    return base in TCPDUMP_BASENAMES


def match_tcpdump_argv(tokens: list[str], *, pcap_path: str, iface: str) -> tuple[bool, str]:
    """Exact argv-token match. Substring / prefix matching is not identity."""
    if not executable_is_tcpdump(tokens):
        return False, "TCPDUMP_CMDLINE_NOT_TCPDUMP"
    if argv_option(tokens, "-i") != iface:
        return False, "TCPDUMP_CMDLINE_IFACE_MISMATCH"
    if argv_option(tokens, "-w") != pcap_path:
        return False, "TCPDUMP_CMDLINE_PCAP_MISMATCH"
    return True, "OK"


def parse_proc_starttime(stat_text: str) -> str:
    rparen = stat_text.rfind(")")
    if rparen < 0:
        raise ValueError("stat comm field is missing")
    rest = stat_text[rparen + 1 :].split()
    if len(rest) < 20:
        raise ValueError("stat starttime field is missing")
    return rest[19]


def adapter_live_argv(adapter: CaptureAdapter, pid: int) -> list[str]:
    fn = getattr(adapter, "live_argv", None)
    if callable(fn):
        return parse_cmdline_tokens(fn(pid))
    live = getattr(adapter, "live_cmdline", None)
    try:
        cmd = live(pid) if callable(live) else adapter.cmdline(pid)
    except OSError:
        raise
    return parse_cmdline_tokens(cmd)


def adapter_start_identity(adapter: CaptureAdapter, pid: int) -> str | None:
    fn = getattr(adapter, "live_start_identity", None)
    if not callable(fn):
        return None
    value = fn(pid)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def persisted_start_identity(adapter: CaptureAdapter, pid: int, handle: CaptureHandle | None = None) -> str | None:
    if handle is not None and handle.start_identity:
        return str(handle.start_identity)
    ident = getattr(adapter, "_idents", None)
    if isinstance(ident, dict):
        stored = ident.get(pid) or {}
        sid = stored.get("start_identity")
        if sid:
            return str(sid)
    return None


def verify_tcpdump_pid(adapter: CaptureAdapter, pid: int, pcap_path: str, iface: str) -> tuple[bool, str]:
    try:
        tokens = adapter_live_argv(adapter, pid)
    except OSError:
        return False, "TCPDUMP_CMDLINE_UNREADABLE"
    return match_tcpdump_argv(tokens, pcap_path=pcap_path, iface=iface)


def verify_start_identity(
    adapter: CaptureAdapter,
    pid: int,
    expected: str | None,
) -> tuple[bool, str]:
    if expected is None or str(expected).strip() == "":
        return False, "CAPTURE_IDENTITY_UNREADABLE"
    try:
        live = adapter_start_identity(adapter, pid)
    except OSError:
        return False, "CAPTURE_IDENTITY_UNREADABLE"
    if live is None:
        return False, "CAPTURE_IDENTITY_UNREADABLE"
    if str(live) != str(expected):
        return False, "TCPDUMP_PID_REUSED"
    return True, "OK"


def verify_live_signal_target(
    adapter: CaptureAdapter,
    pid: int | None,
    pcap_path: str,
    iface: str,
    *,
    expected_start_identity: str | None = None,
) -> tuple[bool, str]:
    """Confirm the current process is still the recorded capture before signaling."""
    if pid is None:
        return False, "NO_TCPDUMP_PID"
    if not adapter.alive(int(pid)):
        return False, "TCPDUMP_PID_DEAD"
    ok, reason = verify_tcpdump_pid(adapter, int(pid), pcap_path, iface)
    if not ok and reason in ("TCPDUMP_CMDLINE_NOT_TCPDUMP", "TCPDUMP_CMDLINE_PCAP_MISMATCH"):
        return False, "TCPDUMP_PID_REUSED"
    if not ok:
        return False, reason
    sid_fn = getattr(adapter, "live_start_identity", None)
    if callable(sid_fn):
        expected = expected_start_identity or persisted_start_identity(adapter, int(pid))
        sid_ok, sid_reason = verify_start_identity(adapter, int(pid), expected)
        if not sid_ok:
            return False, sid_reason
    return True, "OK"


def start_capture(
    name: str,
    iface: str,
    bpf: str,
    workdir: str,
    exec_helper: str,
    adapter: CaptureAdapter,
    now: Callable[[], int] | None = None,
    listen_wait_ms: int = LISTEN_WAIT_MS,
) -> CaptureHandle:
    clock = now or monotonic_ms
    os.makedirs(workdir, exist_ok=True)
    handle = CaptureHandle(
        name=name,
        iface=iface,
        filter=bpf,
        pcap_path=os.path.join(workdir, f"{name}.pcap"),
        stderr_path=os.path.join(workdir, f"{name}.tcpdump.stderr"),
        stdout_path=os.path.join(workdir, f"{name}.tcpdump.stdout"),
        pidfile=os.path.join(workdir, f"{name}.tcpdump.pid"),
        stat_path=os.path.join(workdir, f"{name}.capture.stat"),
        handle_path=os.path.join(workdir, f"{name}.handle.json"),
    )
    for path in (handle.stderr_path, handle.stdout_path, handle.stat_path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("")
    tcpdump_pid, sudo_pid = adapter.start(
        iface=iface,
        bpf=bpf,
        pcap_path=handle.pcap_path,
        stderr_path=handle.stderr_path,
        stdout_path=handle.stdout_path,
        pidfile=handle.pidfile,
        exec_helper=exec_helper,
    )
    file_pid = read_pidfile(handle.pidfile)
    if file_pid is None or file_pid != tcpdump_pid:
        handle.tcpdump_pid = tcpdump_pid
        handle.sudo_parent_pid = sudo_pid
        handle.running = True
        persist_handle(handle)
        _write_stat(handle, f"PIDFILE_MISMATCH file={file_pid} reported={tcpdump_pid}")
        raise CaptureStartError("PIDFILE_MISMATCH", handle)
    sid_fn = getattr(adapter, "live_start_identity", None)
    if callable(sid_fn):
        try:
            handle.start_identity = adapter_start_identity(adapter, tcpdump_pid)
        except OSError:
            handle.start_identity = None
    argv_fn = getattr(adapter, "live_argv", None)
    if callable(argv_fn):
        try:
            handle.tcpdump_argv = parse_cmdline_tokens(argv_fn(tcpdump_pid))
        except OSError:
            handle.tcpdump_argv = None
    ok, reason = verify_tcpdump_pid(adapter, tcpdump_pid, handle.pcap_path, iface)
    handle.tcpdump_pid = tcpdump_pid
    handle.sudo_parent_pid = sudo_pid
    handle.pgid = adapter.pgid(tcpdump_pid)
    handle.running = True
    persist_handle(handle)
    if not ok:
        _write_stat(handle, f"IDENTITY_FAIL {reason}")
        raise CaptureStartError(reason, handle)
    if not wait_listening(handle.stderr_path, iface, listen_wait_ms, clock):
        _write_stat(handle, "NOT_LISTENING")
        raise CaptureStartError("NOT_LISTENING", handle)
    handle.listening = True
    persist_handle(handle)
    _write_stat(
        handle,
        f"LISTENING iface={iface} filter={bpf} tcpdump_pid={tcpdump_pid} "
        f"sudo_parent={sudo_pid} pgid={handle.pgid}",
    )
    return handle


class CaptureStartError(Exception):
    def __init__(self, code: str, handle: CaptureHandle) -> None:
        super().__init__(code)
        self.code = code
        self.handle = handle


class CaptureSignalError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def stop_capture(
    handle: CaptureHandle,
    adapter: CaptureAdapter,
    tail_sec: float,
    now: Callable[[], int] | None = None,
    tcpdump_read: bool = True,
    sleep: Callable[[float], None] | None = None,
    remaining_sec: float | None = None,
    read_timeout_sec: float | None = None,
) -> CaptureStopResult:
    clock = now or monotonic_ms
    sleeper = sleep or time.sleep
    attach = getattr(adapter, "attach_handle", None)
    try:
        if callable(attach):
            attach(handle)
    except CaptureSignalError as exc:
        return CaptureStopResult(False, exc.code, handle, False, False, str(exc))
    effective_tail = tail_sec
    if remaining_sec is not None:
        if remaining_sec <= 0:
            effective_tail = 0.0
        else:
            effective_tail = min(effective_tail, remaining_sec)
    if effective_tail > 0:
        sleeper(effective_tail)
    pid = handle.tcpdump_pid
    if pid is None:
        return CaptureStopResult(False, "NO_TCPDUMP_PID", handle, False, False, "no recorded tcpdump pid")
    live_ok, live_reason = verify_live_signal_target(
        adapter,
        pid,
        handle.pcap_path,
        handle.iface,
        expected_start_identity=handle.start_identity,
    )
    if not live_ok and live_reason == "TCPDUMP_PID_REUSED":
        return CaptureStopResult(False, "TCPDUMP_PID_REUSED", handle, False, False, "refusing to signal reused pid")
    if not live_ok and live_reason not in ("TCPDUMP_PID_DEAD",):
        if live_reason != "NO_TCPDUMP_PID":
            # Identity unreadable while process still claims alive: fail closed.
            if adapter.alive(int(pid)):
                return CaptureStopResult(False, live_reason, handle, False, False, live_reason)
    try:
        if live_ok:
            adapter.send(
                pid,
                SIGINT,
                privileged=True,
                expected_pcap=handle.pcap_path,
                expected_iface=handle.iface,
            )
    except CaptureSignalError as exc:
        return CaptureStopResult(False, exc.code, handle, False, False, str(exc))
    start = clock()
    stderr = ""
    while not deadline_reached(start, INT_WAIT_MS, clock()):
        if os.path.isfile(handle.stderr_path):
            stderr = Path(handle.stderr_path).read_text(encoding="utf-8", errors="replace")
            if "packets dropped by kernel" in stderr:
                break
        if not adapter.alive(pid):
            break
        sleeper(0.05)
    if adapter.alive(pid):
        try:
            adapter.send(
                pid,
                SIGTERM,
                privileged=True,
                expected_pcap=handle.pcap_path,
                expected_iface=handle.iface,
            )
        except CaptureSignalError as exc:
            return CaptureStopResult(False, exc.code, handle, False, False, str(exc))
        t2 = clock()
        while adapter.alive(pid) and not deadline_reached(t2, TERM_GRACE_MS, clock()):
            sleeper(0.05)
    if adapter.alive(pid):
        try:
            adapter.send(
                pid,
                SIGKILL,
                privileged=True,
                expected_pcap=handle.pcap_path,
                expected_iface=handle.iface,
            )
        except CaptureSignalError as exc:
            return CaptureStopResult(False, exc.code, handle, False, False, str(exc))
        sleeper(0.05)
    handle.running = adapter.alive(pid)
    if os.path.isfile(handle.stderr_path):
        stderr = Path(handle.stderr_path).read_text(encoding="utf-8", errors="replace")
    drops = parse_tcpdump_stderr(stderr)
    read_rc = 0
    read_err = handle.pcap_path + ".read.err"
    if tcpdump_read:
        bound = read_timeout_sec
        if remaining_sec is not None:
            bound = remaining_sec if bound is None else min(bound, remaining_sec)
        try:
            read_rc = adapter.tcpdump_read(handle.pcap_path, read_err, timeout_sec=bound)
        except TypeError:
            read_rc = adapter.tcpdump_read(handle.pcap_path, read_err)
    pcap = validate_pcap_file(handle.pcap_path, tcpdump_rc=read_rc, tcpdump_err_path=read_err)
    handle.listening = False
    if handle.running:
        return CaptureStopResult(False, "CAPTURE_SURVIVED", handle, drops.ok, pcap.ok, "tcpdump still alive")
    if not drops.ok:
        return CaptureStopResult(False, drops.code, handle, False, pcap.ok, drops.message, pcap.packet_count)
    if not pcap.ok:
        return CaptureStopResult(False, pcap.code, handle, True, False, pcap.message, pcap.packet_count)
    return CaptureStopResult(True, "CAPTURE_STOPPED", handle, True, True, "ok", pcap.packet_count)


def persist_handle(handle: CaptureHandle) -> None:
    if not handle.handle_path:
        return
    payload = {
        "name": handle.name,
        "iface": handle.iface,
        "filter": handle.filter,
        "pcap_path": handle.pcap_path,
        "stderr_path": handle.stderr_path,
        "stdout_path": handle.stdout_path,
        "pidfile": handle.pidfile,
        "stat_path": handle.stat_path,
        "tcpdump_pid": handle.tcpdump_pid,
        "sudo_parent_pid": handle.sudo_parent_pid,
        "pgid": handle.pgid,
        "listening": handle.listening,
        "running": handle.running,
        "handle_path": handle.handle_path,
        "start_identity": handle.start_identity,
        "tcpdump_argv": handle.tcpdump_argv,
    }
    with open(handle.handle_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")


def load_handle(path: str) -> CaptureHandle:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return CaptureHandle(
        name=raw["name"],
        iface=raw["iface"],
        filter=raw.get("filter") or "",
        pcap_path=raw["pcap_path"],
        stderr_path=raw["stderr_path"],
        stdout_path=raw["stdout_path"],
        pidfile=raw["pidfile"],
        stat_path=raw["stat_path"],
        tcpdump_pid=raw.get("tcpdump_pid"),
        sudo_parent_pid=raw.get("sudo_parent_pid"),
        pgid=raw.get("pgid"),
        listening=bool(raw.get("listening")),
        running=bool(raw.get("running")),
        handle_path=raw.get("handle_path") or path,
        start_identity=raw.get("start_identity"),
        tcpdump_argv=list(raw["tcpdump_argv"]) if isinstance(raw.get("tcpdump_argv"), list) else None,
    )


def handle_path_for(workdir: str, name: str) -> str:
    return os.path.join(workdir, f"{name}.handle.json")


def _write_stat(handle: CaptureHandle, line: str) -> None:
    with open(handle.stat_path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


ENS5_FILTER = (
    "tcp port 80 or tcp port 443 or udp port 53 or tcp port 53 or tcp port 853 or udp port 853"
)
LO_FILTER = "udp port 53 or tcp port 53"


def resolver_needs_loopback(resolv_conf: str) -> bool:
    for line in resolv_conf.splitlines():
        line = line.strip()
        parts = line.split()
        if len(parts) >= 2 and parts[0] == "nameserver":
            try:
                if ipaddress.ip_address(parts[1]).is_loopback:
                    return True
            except ValueError:
                continue
    return False


def stop_named_capture(
    workdir: str,
    name: str,
    tail_sec: float,
    adapter: CaptureAdapter,
    *,
    terminal_established: bool,
) -> CaptureStopResult:
    refused_tail = False
    effective_tail = tail_sec
    if effective_tail > 0 and not terminal_established:
        refused_tail = True
        effective_tail = 0.0
    path = handle_path_for(workdir, name)
    if not os.path.isfile(path):
        dummy = CaptureHandle(
            name=name,
            iface="",
            filter="",
            pcap_path=os.path.join(workdir, f"{name}.pcap"),
            stderr_path=os.path.join(workdir, f"{name}.tcpdump.stderr"),
            stdout_path=os.path.join(workdir, f"{name}.tcpdump.stdout"),
            pidfile=os.path.join(workdir, f"{name}.tcpdump.pid"),
            stat_path=os.path.join(workdir, f"{name}.capture.stat"),
        )
        return CaptureStopResult(False, "HANDLE_MISSING", dummy, False, False, "capture handle missing")
    handle = load_handle(path)
    result = stop_capture(handle, adapter, tail_sec=effective_tail)
    persist_handle(handle)
    if refused_tail:
        return CaptureStopResult(
            False,
            "TAIL_REFUSED_WITHOUT_TERMINAL",
            handle,
            result.drop_ok,
            result.pcap_ok,
            "TAIL_SEC>0 requires established terminal status",
            result.packet_count,
        )
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="EXEC-01C6A capture stop/validate")
    parser.add_argument("command", choices=["stop"])
    parser.add_argument("--prep", required=True)
    parser.add_argument("--workdir", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--tail-sec", type=float, default=0.0)
    args = parser.parse_args(argv)
    from linux_capture import LinuxCapture
    from secret_io import is_explicit_yes, live_capable_adapters, require_explicit_live_authorization

    env = os.environ
    adapter = LinuxCapture(
        sudo_bin=env.get("AISB_SUDO_BIN", "sudo"),
        python_bin=env.get("PYTHON3") or env.get("PYTHON") or sys.executable,
        exec_py=os.path.join(args.prep, "bin", "tcpdump-exec.py"),
    )
    if live_capable_adapters(env):
        from secret_io import AuthorizationError

        try:
            require_explicit_live_authorization(env, what="LinuxCapture stop")
        except AuthorizationError as exc:
            print(exc.code, file=sys.stderr)
            return 2
    terminal = is_explicit_yes(env.get("AISB_01C6A_TERMINAL_ESTABLISHED"))
    result = stop_named_capture(
        args.workdir,
        args.name,
        args.tail_sec,
        adapter,
        terminal_established=terminal,
    )
    print(
        "CAPTURE_STOP ok=%s code=%s tail=%s packets=%s"
        % (int(result.ok), result.code, args.tail_sec, result.packet_count)
    )
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    raise SystemExit(main())

