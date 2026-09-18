#!/usr/bin/env python3
"""Privileged-or-mock tcpdump exec helper.

Writes the tcpdump PID to pidfile. On POSIX this is the PID after exec.
On Windows mocks, the child is launched and its PID is recorded.
Identity is never inferred from a sudo PID.
"""

from __future__ import annotations

import os
import subprocess
import sys


def _write_pid(pidfile: str, pid: int) -> None:
    with open(pidfile, "w", encoding="utf-8") as f:
        f.write(str(pid) + "\n")
        f.flush()
        os.fsync(f.fileno())


def main(argv: list[str]) -> int:
    if len(argv) < 4:
        print("usage: tcpdump-exec.py PIDFILE IFACE PCAP FILTER...", file=sys.stderr)
        return 2
    pidfile, iface, pcap = argv[0], argv[1], argv[2]
    bpf = argv[3:]
    tcpdump = os.environ.get("AISB_TCPDUMP_BIN", "/usr/bin/tcpdump")
    os.environ["AISB_TCPDUMP_PIDFILE"] = pidfile
    new_argv = ["-nn", "-i", iface, "-U", "-w", pcap, *bpf]
    if tcpdump.endswith(".py"):
        cmd = [sys.executable, tcpdump, *new_argv]
    else:
        cmd = [tcpdump, "-nn", "-i", iface, "-U", "-w", pcap, *bpf]
    if os.name == "nt":
        proc = subprocess.Popen(cmd, env=os.environ.copy())
        _write_pid(pidfile, proc.pid)
        return int(proc.wait())
    _write_pid(pidfile, os.getpid())
    os.execv(cmd[0], cmd)
    return 127


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
