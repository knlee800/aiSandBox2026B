"""Secure file creation, explicit authorization, and secret redaction.

Do not print secret values. Permission-setting failures are not ignored.
"""

from __future__ import annotations

import os
import stat
from typing import Any, Mapping

SECRET_ENV_NAMES = frozenset(
    {
        "HARNESS_ENTITLEMENT_HMAC_SECRET",
        "AISB_01C6A_HMAC_SECRET",
        "XAI_API_KEY",
        "AISB_01C6A_API_KEY_TOKEN",
        "DATABASE_URL",
        "REDIS_URL",
        "PASSWORD",
        "SECRET",
        "TOKEN",
        "AUTHORIZATION",
    }
)

SECRET_KEY_FRAGMENTS = (
    "secret",
    "password",
    "token",
    "authorization",
    "api_key",
    "apikey",
    "database_url",
    "redis_url",
    "hmac",
    "bearer",
)


class SecretIOError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class AuthorizationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def is_explicit_yes(raw: str | None) -> bool:
    if raw is None:
        return False
    return raw.strip() in ("1", "YES", "TRUE", "yes", "true", "Yes", "True")


def is_secret_name(name: str) -> bool:
    lowered = name.lower()
    if name in SECRET_ENV_NAMES:
        return True
    return any(frag in lowered for frag in SECRET_KEY_FRAGMENTS)


def require_explicit_live_authorization(env: Mapping[str, str], *, what: str) -> None:
    """Live-capable adapters require an explicit YES. Missing is not YES."""
    if not is_explicit_yes(env.get("AISB_01C6A_STAGING_EXECUTION_AUTHORIZED")):
        raise AuthorizationError(
            "STAGING_NOT_AUTHORIZED",
            f"{what} requires explicit AISB_01C6A_STAGING_EXECUTION_AUTHORIZED; missing defaults to unauthorized",
        )


def looks_live_capable_bin(path: str | None) -> bool:
    if not path:
        return True
    base = os.path.basename(path).lower()
    if base.startswith("mock-") or base.startswith("mock_"):
        return False
    if "mock-sudo" in base or "mock-pm2" in base or "mock-tcpdump" in base:
        return False
    return True


def live_capable_node(env: Mapping[str, str]) -> bool:
    node_bin = env.get("NODE_BIN") or "/usr/bin/node"
    return looks_live_capable_bin(node_bin)


def live_capable_adapters(env: Mapping[str, str]) -> bool:
    sudo_bin = env.get("AISB_SUDO_BIN") or env.get("SUDO_BIN") or "sudo"
    pm2_bin = env.get("PM2_BIN") or "pm2"
    tcpdump_bin = env.get("AISB_TCPDUMP_BIN") or env.get("TCPDUMP_BIN") or "/usr/bin/tcpdump"
    return any(looks_live_capable_bin(p) for p in (sudo_bin, pm2_bin, tcpdump_bin))


def redact_value(name: str, value: Any) -> Any:
    if is_secret_name(str(name)):
        return "<redacted>"
    if isinstance(value, str) and len(value) > 0 and is_secret_name(str(name)):
        return "<redacted>"
    return value


def redact_mapping(data: Mapping[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in data.items():
        if is_secret_name(str(key)):
            out[str(key)] = "<redacted>"
        elif isinstance(value, dict):
            out[str(key)] = redact_mapping(value)
        else:
            out[str(key)] = value
    return out


def redact_text(text: str, extra_needles: list[str] | None = None) -> str:
    redacted = text
    for needle in extra_needles or []:
        if needle:
            redacted = redacted.replace(needle, "<redacted>")
    return redacted


def _verify_mode_or_raise(fd: int, path: str, mode: int) -> None:
    if os.name == "nt":
        return
    if hasattr(os, "fchmod"):
        os.fchmod(fd, mode)
    st = os.fstat(fd)
    actual = stat.S_IMODE(st.st_mode)
    if actual & 0o077:
        raise SecretIOError(
            "PERMISSION_TOO_PERMISSIVE",
            f"protected file {path} mode {actual:o} allows group/other",
        )
    if actual != mode:
        raise SecretIOError(
            "PERMISSION_SET_FAILED",
            f"protected file {path} mode {actual:o} != {mode:o}",
        )


def secure_create_file(path: str, data: bytes | str, mode: int = 0o600) -> None:
    """Create path with restrictive permissions from the outset (O_CREAT|O_EXCL)."""
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    payload = data if isinstance(data, bytes) else data.encode("utf-8")
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(path, flags, mode)
    try:
        os.write(fd, payload)
        _verify_mode_or_raise(fd, path, mode)
    except Exception:
        try:
            os.close(fd)
        except OSError:
            pass
        try:
            os.remove(path)
        except OSError:
            pass
        raise
    else:
        os.close(fd)


def secure_replace_file(path: str, data: bytes | str, mode: int = 0o600) -> None:
    """Replace an existing protected file without a world-readable create-then-chmod window."""
    if os.path.isfile(path):
        os.remove(path)
    secure_create_file(path, data, mode=mode)


def collect_secret_needles(env: Mapping[str, str]) -> list[str]:
    needles = []
    for key, value in env.items():
        if value and is_secret_name(key):
            needles.append(value)
    return needles
