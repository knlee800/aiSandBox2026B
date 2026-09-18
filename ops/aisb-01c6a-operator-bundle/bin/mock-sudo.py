#!/usr/bin/env python3
"""Mock sudo -n: exec the helper without privilege. Local tests only."""

from __future__ import annotations

import os
import subprocess
import sys


def _run(cmd: list[str]) -> int:
    if not cmd:
        return 2
    if cmd[0].endswith(".py"):
        cmd = [sys.executable, *cmd]
    if os.name == "nt":
        return int(subprocess.call(cmd))
    os.execv(cmd[0], cmd)
    return 127


def main(argv: list[str]) -> int:
    if not argv or argv[0] != "-n":
        print("mock-sudo: only -n is supported", file=sys.stderr)
        return 2
    cmd = argv[1:]
    if not cmd:
        return 2
    return _run(cmd)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
