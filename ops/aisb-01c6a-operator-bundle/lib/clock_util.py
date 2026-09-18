"""Monotonic clock helpers for EXEC-01C6A operator supervision."""

from __future__ import annotations

import time
from typing import Callable


def monotonic_ms(now: Callable[[], float] | None = None) -> int:
    """Return a monotonic millisecond timestamp.

    Uses time.monotonic() so wall-clock adjustments cannot extend or shrink
    the supervision deadline. Inject ``now`` only in tests.
    """
    fn = now or time.monotonic
    return int(fn() * 1000)


def deadline_reached(started_ms: int, timeout_ms: int, now_ms: int) -> bool:
    if timeout_ms < 0:
        raise ValueError("timeout_ms must be >= 0")
    return (now_ms - started_ms) >= timeout_ms
