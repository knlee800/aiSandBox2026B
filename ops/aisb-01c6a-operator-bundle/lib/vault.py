"""Split protected secrets from redacted overlay metadata.

Permission-setting failures are not ignored. Secret values never enter
metadata.json or stdout.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from secret_io import secure_replace_file

PROTECTED_NAMES = frozenset(
    {
        "HARNESS_ENTITLEMENT_HMAC_SECRET",
        "AISB_01C6A_HMAC_SECRET",
        "XAI_API_KEY",
        "AISB_01C6A_API_KEY_TOKEN",
        "DATABASE_URL",
        "REDIS_URL",
    }
)

ORDINARY_FLAGS = (
    "AGENT_HARNESS_ENABLE_TOOL_LOOP",
    "GLOBAL_EXECUTION_ENABLED",
    "PROVIDER_XAI_ENABLED",
    "AGENT_HARNESS_ENABLE_WRITE_TOOLS",
    "AGENT_HARNESS_STUB_WRITE_MODE",
)

HMAC_NAMES = ("HARNESS_ENTITLEMENT_HMAC_SECRET", "AISB_01C6A_HMAC_SECRET")
META_SKIP = frozenset({"_pending_apps", "_format"})


@dataclass
class OverlayVar:
    name: str
    state: str  # SET | EMPTY | ABSENT
    restore_value: str | None  # exact SET value; None for EMPTY/ABSENT
    secret: bool


def classify_state(raw: str | None) -> str:
    if raw is None:
        return "ABSENT"
    if raw == "":
        return "EMPTY"
    return "SET"


def _entries_from_captured(vault_dir: str, captured: Mapping[str, str | None], *, rel_protected: str) -> dict[str, Any]:
    protected = os.path.join(vault_dir, rel_protected)
    os.makedirs(protected, exist_ok=True)
    meta: dict[str, Any] = {}
    for name, raw in captured.items():
        if name in META_SKIP:
            continue
        state = classify_state(raw)
        secret = name in PROTECTED_NAMES
        entry: dict[str, Any] = {"state": state, "secret": secret}
        if secret:
            path = os.path.join(protected, f"{name}.value")
            if state == "SET":
                secure_replace_file(path, raw or "", mode=0o600)
                entry["protected_file"] = f"{rel_protected}/{name}.value"
            else:
                entry["protected_file"] = None
        else:
            entry["value"] = raw if state == "SET" else None
        meta[name] = entry
    return meta


def write_vault(vault_dir: str, captured: Mapping[str, str | None]) -> None:
    os.makedirs(vault_dir, exist_ok=True)
    meta = _entries_from_captured(vault_dir, captured, rel_protected="protected")
    meta["_format"] = "shared"
    meta_path = os.path.join(vault_dir, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write("\n")


def write_app_vault(vault_dir: str, app: str, captured: Mapping[str, str | None]) -> None:
    if not app or app.startswith("."):
        raise ValueError("invalid app name")
    app_dir = os.path.join(vault_dir, "apps", app)
    os.makedirs(app_dir, exist_ok=True)
    meta = _entries_from_captured(app_dir, captured, rel_protected="protected")
    meta["_format"] = "app"
    meta_path = os.path.join(app_dir, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write("\n")


def mark_pending_apps(vault_dir: str, apps: list[str]) -> None:
    os.makedirs(vault_dir, exist_ok=True)
    path = os.path.join(vault_dir, "pending_apps.json")
    existing: list[str] = []
    if os.path.isfile(path):
        try:
            raw = json.loads(Path(path).read_text(encoding="utf-8"))
            if isinstance(raw, list):
                existing = [str(x) for x in raw]
        except json.JSONDecodeError:
            existing = []
    merged = list(dict.fromkeys([*existing, *apps]))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(merged, f)
        f.write("\n")


def load_pending_apps(vault_dir: str) -> list[str]:
    path = os.path.join(vault_dir, "pending_apps.json")
    if not os.path.isfile(path):
        return []
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [str(x) for x in raw]
    return []


def clear_pending_app(vault_dir: str, app: str) -> None:
    pending = [a for a in load_pending_apps(vault_dir) if a != app]
    path = os.path.join(vault_dir, "pending_apps.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(pending, f)
        f.write("\n")


def load_metadata(vault_dir: str) -> dict[str, Any]:
    path = os.path.join(vault_dir, "metadata.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_app_metadata(vault_dir: str, app: str) -> dict[str, Any]:
    app_meta = os.path.join(vault_dir, "apps", app, "metadata.json")
    if os.path.isfile(app_meta):
        with open(app_meta, "r", encoding="utf-8") as f:
            return json.load(f)
    return load_metadata(vault_dir)


def var_entries(metadata: Mapping[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in metadata.items() if k not in META_SKIP and isinstance(v, dict) and "state" in v}


def load_protected(vault_dir: str, name: str, *, app: str | None = None) -> str | None:
    candidates = []
    if app:
        candidates.append(os.path.join(vault_dir, "apps", app, "protected", f"{name}.value"))
    candidates.append(os.path.join(vault_dir, "protected", f"{name}.value"))
    for path in candidates:
        if os.path.isfile(path):
            return Path(path).read_text(encoding="utf-8")
    return None


def protected_recovery_present(vault_dir: str) -> bool:
    """True when protected recovery material still exists."""
    pending_path = os.path.join(vault_dir, "pending_apps.json")
    if os.path.isfile(pending_path):
        pending = load_pending_apps(vault_dir)
        if pending:
            return True
    roots = [os.path.join(vault_dir, "protected")]
    apps_dir = os.path.join(vault_dir, "apps")
    if os.path.isdir(apps_dir):
        for name in os.listdir(apps_dir):
            roots.append(os.path.join(apps_dir, name, "protected"))
    for root in roots:
        if not os.path.isdir(root):
            continue
        for fname in os.listdir(root):
            if fname.endswith(".value") and os.path.isfile(os.path.join(root, fname)):
                return True
    return False


def refuse_unresolved_vault(vault_dir: str) -> None:
    if os.path.isdir(vault_dir) and protected_recovery_present(vault_dir):
        raise RuntimeError("UNRESOLVED_VAULT_EXISTS")


def delete_protected_recovery(vault_dir: str) -> None:
    """Delete protected recovery secrets only. Keep redacted metadata."""
    roots = [os.path.join(vault_dir, "protected")]
    apps_dir = os.path.join(vault_dir, "apps")
    if os.path.isdir(apps_dir):
        for name in os.listdir(apps_dir):
            roots.append(os.path.join(apps_dir, name, "protected"))
    for root in roots:
        if not os.path.isdir(root):
            continue
        for fname in os.listdir(root):
            path = os.path.join(root, fname)
            if os.path.isfile(path):
                os.remove(path)
        try:
            os.rmdir(root)
        except OSError:
            pass
    pending_path = os.path.join(vault_dir, "pending_apps.json")
    if os.path.isfile(pending_path):
        os.remove(pending_path)


def restore_plan(metadata: Mapping[str, Any], hmac_absent_empty_authorized: bool) -> dict[str, OverlayVar]:
    plan: dict[str, OverlayVar] = {}
    for name, entry in var_entries(metadata).items():
        state = entry["state"]
        secret = bool(entry.get("secret"))
        value = entry.get("value")
        if name in HMAC_NAMES and state == "ABSENT":
            if hmac_absent_empty_authorized:
                plan[name] = OverlayVar(name, "EMPTY", "", secret)
            else:
                plan[name] = OverlayVar(name, "ABSENT", None, secret)
            continue
        if state == "SET":
            plan[name] = OverlayVar(name, "SET", value, secret)
        elif state == "EMPTY":
            plan[name] = OverlayVar(name, "EMPTY", "", secret)
        else:
            plan[name] = OverlayVar(name, "ABSENT", None, secret)
    return plan
