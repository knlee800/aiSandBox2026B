"""Distinguish EPERM (alive, unprivileged) from ESRCH (dead)."""

from __future__ import annotations

import errno
import os
from typing import Callable

KillFn = Callable[[int, int], None]


def _windows_process_exists(pid: int) -> bool:
    import ctypes
    from ctypes import wintypes

    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    ERROR_ACCESS_DENIED = 5
    kernel32 = ctypes.windll.kernel32
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, int(pid))
    if handle:
        kernel32.CloseHandle(handle)
        return True
    err = kernel32.GetLastError()
    if err == ERROR_ACCESS_DENIED:
        return True
    return False


def process_live(pid: int, kill: KillFn | None = None) -> bool:
    """True if pid exists and is not a zombie."""
    if not process_exists(pid, kill=kill):
        return False
    if os.name == "nt":
        return True
    try:
        with open(f"/proc/{pid}/stat", encoding="utf-8") as f:
            parts = f.read().split()
        if len(parts) >= 3 and parts[2] == "Z":
            return False
    except OSError:
        return False
    return True


def process_exists(pid: int, kill: KillFn | None = None) -> bool:
    """Return True if pid exists.

    PermissionError / EPERM / ACCESS_DENIED means the process exists but this
    uid cannot signal it. ProcessLookupError / ESRCH means it is gone.
    """
    if pid <= 0:
        return False
    if kill is not None:
        fn = kill
        try:
            fn(pid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        except OSError as exc:
            err = getattr(exc, "errno", None)
            if err == errno.ESRCH:
                return False
            if err == errno.EPERM:
                return True
            raise
    if os.name == "nt":
        return _windows_process_exists(pid)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError as exc:
        err = getattr(exc, "errno", None)
        if err == errno.ESRCH:
            return False
        if err == errno.EPERM:
            return True
        raise
