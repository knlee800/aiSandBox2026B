"""Deadline derivation matching accepted canary script ranges.

Does not import or execute the accepted TypeScript canaries.
Ranges copied from canary-01c6a-stub-submit.ts / canary-01c6a-xai-negative.ts:
  DEFAULT_WAIT_MS=20000 (1..120000)
  DEFAULT_OP_TIMEOUT_MS=8000 (20..30000)
  SHUTDOWN_TIMEOUT_MS=5000 (20..30000)
  CONNECT_TIMEOUT_MS=5000
"""

from __future__ import annotations

from typing import Mapping

DEFAULT_WAIT_MS = 20000
DEFAULT_OP_TIMEOUT_MS = 8000
SHUTDOWN_TIMEOUT_MS = 5000
CONNECT_TIMEOUT_MS = 5000
OUTER_SLACK_MS = 15000
OBSERVE_SETTLE_MS = 5000

CAPTURE_TAIL_AFTER_TERMINAL_SEC = 5
CAPTURE_LISTEN_WAIT_MS = 5000
CAPTURE_SHUTDOWN_INT_WAIT_MS = 5000
CAPTURE_TERM_GRACE_MS = 2000
SUPERVISOR_TERM_GRACE_MS = 5000
RECONCILE_BOUND_MS = None  # derived: waitMs + opTimeout + CONNECT_TIMEOUT_MS


class ConfigError(ValueError):
    pass


def _parse_int(raw: str | None, default: int) -> int | None:
    if raw is None or str(raw).strip() == "":
        return default
    try:
        n = float(str(raw).strip())
    except (TypeError, ValueError):
        return None
    if not n == n:  # NaN
        return None
    return int(n)


def parse_wait_ms(env: Mapping[str, str]) -> int:
    n = _parse_int(env.get("AISB_01C6A_WAIT_MS"), DEFAULT_WAIT_MS)
    if n is None or n <= 0 or n > 120000:
        raise ConfigError("AISB_01C6A_WAIT_MS must be a positive number <= 120000")
    return n


def parse_op_timeout_ms(env: Mapping[str, str]) -> int:
    n = _parse_int(env.get("AISB_01C6A_OP_TIMEOUT_MS"), DEFAULT_OP_TIMEOUT_MS)
    if n is None or n < 20 or n > 30000:
        raise ConfigError("AISB_01C6A_OP_TIMEOUT_MS must be 20..30000")
    return n


def parse_shutdown_timeout_ms(env: Mapping[str, str]) -> int:
    n = _parse_int(env.get("AISB_01C6A_SHUTDOWN_TIMEOUT_MS"), SHUTDOWN_TIMEOUT_MS)
    if n is None or n < 20 or n > 30000:
        raise ConfigError("AISB_01C6A_SHUTDOWN_TIMEOUT_MS must be 20..30000")
    return n


def outer_timeout_ms(env: Mapping[str, str]) -> int:
    """Elapsed outer bound for the live submitter process.

    T_outer_ms = waitMs + 5000 + 3*opTimeout + shutdownTimeout + 15000
    """
    wait_ms = parse_wait_ms(env)
    op_ms = parse_op_timeout_ms(env)
    shut_ms = parse_shutdown_timeout_ms(env)
    return wait_ms + OBSERVE_SETTLE_MS + (3 * op_ms) + shut_ms + OUTER_SLACK_MS


def reconcile_timeout_ms(env: Mapping[str, str]) -> int:
    """Bounded read-only reconcile: connect + one observe window, no submit."""
    return CONNECT_TIMEOUT_MS + parse_wait_ms(env) + parse_op_timeout_ms(env) + parse_shutdown_timeout_ms(env)
