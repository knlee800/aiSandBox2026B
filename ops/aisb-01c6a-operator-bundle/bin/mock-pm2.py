#!/usr/bin/env python3
"""Mock PM2 for local overlay restore verification. Not used on staging.

Models the two PM2 fields that dual-field verification reads separately
(PM2-OVERLAY-UNKNOWN-01 stage-start §4.8):

* ``pm2_env`` top-level keys — the environment of the last *spawned* process;
* ``pm2_env.env`` — the daemon's merged declared environment.

``restart <app> --update-env`` merges the overlay keys present in this
process environment into ``pm2_env.env`` (PM2 --update-env merge; omission
never restores absence) and then performs an explicit "spawn" step that
copies ``pm2_env.env`` onto the top-level fields.

Failure-injection controls are read from an optional sidecar file
``<MOCK_PM2_STATE>.controls.json`` (never from the environment, so the
``CliPm2`` child-environment allowlist is unchanged):
``{"latent": true}`` skips the spawn step (daemon merged, no spawned process
reflects it — a latent pending overlay); ``{"exit": 3}`` exits non-zero
*after* the merge (daemon merged, client failed); ``{"sleep": 30}`` delays
the exit (client timeout after delivery). Test-only.

State file (``MOCK_PM2_STATE``): ``{"apps": {name: {"top": {...}, "env": {...}}}}``.
A legacy flat mapping ``{name: {...}}`` is read as an already-spawned app
(top == env).
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

OVERLAY_KEYS = (
    "HARNESS_ENTITLEMENT_HMAC_SECRET",
    "AISB_01C6A_HMAC_SECRET",
    "AGENT_HARNESS_ENABLE_TOOL_LOOP",
    "AGENT_HARNESS_TOOL_LOOP_ENABLED",
    "GLOBAL_EXECUTION_ENABLED",
    "PROVIDER_XAI_ENABLED",
    "XAI_API_KEY",
    "WRITE_ENABLED",
    "STUB_WRITE_ENABLED",
)


def state_path() -> Path:
    raw = os.environ.get("MOCK_PM2_STATE")
    if not raw:
        raise SystemExit("MOCK_PM2_STATE is required")
    return Path(raw)


def controls() -> dict:
    path = Path(str(state_path()) + ".controls.json")
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return raw if isinstance(raw, dict) else {}


def _normalize_app(record: dict) -> dict:
    if isinstance(record, dict) and ("top" in record or "env" in record):
        top = dict(record.get("top") or {})
        env = dict(record.get("env") or {})
        return {"top": top, "env": env}
    flat = dict(record or {})
    return {"top": dict(flat), "env": dict(flat)}


def load() -> dict:
    path = state_path()
    if not path.is_file():
        return {"apps": {}}
    state = json.loads(path.read_text(encoding="utf-8"))
    apps = state.get("apps") or {}
    state["apps"] = {name: _normalize_app(rec) for name, rec in apps.items()}
    return state


def save(state: dict) -> None:
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def jlist() -> None:
    state = load()
    apps = []
    for name, rec in state.get("apps", {}).items():
        pm2_env = dict(rec["top"])
        pm2_env["env"] = dict(rec["env"])
        apps.append({"name": name, "pm2_env": pm2_env})
    sys.stdout.write(json.dumps(apps) + "\n")


def restart(app: str, update_env: bool) -> int:
    state = load()
    ctl = controls()
    apps = state.setdefault("apps", {})
    rec = apps.get(app) or {"top": {}, "env": {}}
    if update_env:
        # PM2 --update-env: merge this process's env into the declared env.
        # Omitted keys are preserved. Absence is not restored.
        nested = dict(rec["env"])
        for key in OVERLAY_KEYS:
            if key in os.environ:
                nested[key] = os.environ[key]
        rec["env"] = nested
        latent = bool(ctl.get("latent"))
        if not latent:
            # Explicit spawn step: the new process sees the merged env.
            rec["top"] = dict(nested)
        history = state.setdefault("history", [])
        history.append({"app": app, "env": dict(rec["top"]), "nested": dict(rec["env"]), "latent": latent})
    apps[app] = rec
    save(state)
    sleep_sec = ctl.get("sleep")
    if isinstance(sleep_sec, (int, float)) and sleep_sec > 0:
        time.sleep(float(sleep_sec))
    exit_code = ctl.get("exit")
    if isinstance(exit_code, int) and exit_code != 0:
        return exit_code
    return 0


def main(argv: list[str]) -> int:
    if not argv:
        print("mock-pm2: missing command", file=sys.stderr)
        return 2
    if argv[0] == "jlist":
        jlist()
        return 0
    if argv[0] == "restart":
        app = argv[1]
        update = "--update-env" in argv
        return restart(app, update)
    print("mock-pm2: unsupported", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
