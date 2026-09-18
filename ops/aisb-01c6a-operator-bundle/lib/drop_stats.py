"""Parse tcpdump stderr statistics. Missing or non-zero drops are INCOMPLETE."""

from __future__ import annotations

import re
from dataclasses import dataclass

_RE_CAPTURED = re.compile(r"^(\d+)\s+packets captured\s*$", re.M)
_RE_RECEIVED = re.compile(r"^(\d+)\s+packets received by filter\s*$", re.M)
_RE_KERNEL = re.compile(r"^(\d+)\s+packets dropped by kernel\s*$", re.M)
_RE_IFACE = re.compile(r"^(\d+)\s+packets dropped by interface\s*$", re.M)


@dataclass
class DropStats:
    ok: bool
    code: str
    captured: int | None
    received_by_filter: int | None
    dropped_kernel: int | None
    dropped_interface: int | None
    message: str


def parse_tcpdump_stderr(text: str) -> DropStats:
    captured = _first_int(_RE_CAPTURED, text)
    received = _first_int(_RE_RECEIVED, text)
    kernel = _first_int(_RE_KERNEL, text)
    iface = _first_int(_RE_IFACE, text)
    if kernel is None:
        return DropStats(
            ok=False,
            code="DROP_STATS_MISSING",
            captured=captured,
            received_by_filter=received,
            dropped_kernel=None,
            dropped_interface=iface,
            message="tcpdump stderr did not contain 'packets dropped by kernel'",
        )
    if kernel > 0:
        return DropStats(
            ok=False,
            code="DROPPED_BY_KERNEL",
            captured=captured,
            received_by_filter=received,
            dropped_kernel=kernel,
            dropped_interface=iface,
            message=f"kernel dropped {kernel} packets; independent capture is INCOMPLETE",
        )
    if iface is not None and iface > 0:
        return DropStats(
            ok=False,
            code="DROPPED_BY_INTERFACE",
            captured=captured,
            received_by_filter=received,
            dropped_kernel=kernel,
            dropped_interface=iface,
            message=f"interface dropped {iface} packets; independent capture is INCOMPLETE",
        )
    return DropStats(
        ok=True,
        code="DROP_STATS_OK",
        captured=captured,
        received_by_filter=received,
        dropped_kernel=kernel,
        dropped_interface=iface,
        message="zero kernel/interface drops",
    )


def _first_int(pattern: re.Pattern[str], text: str) -> int | None:
    m = pattern.search(text)
    if not m:
        return None
    return int(m.group(1))
