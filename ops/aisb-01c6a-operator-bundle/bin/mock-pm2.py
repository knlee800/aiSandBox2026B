#!/usr/bin/env python3
"""Mock PM2 for local overlay restore verification. Not used on staging."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def state_path() -> Path:
    raw = os.environ.get("MOCK_PM2_STATE")
    if not raw:
        raise SystemExit("MOCK_PM2_STATE is required")
    return Path(raw)


def load() -> dict:
    path = state_path()
    if not path.is_file():
        return {"apps": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def save(state: dict) -> None:
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def jlist() -> None:
    state = load()
    apps = []
    for name, env in state.get("apps", {}).items():
        apps.append({"name": name, "pm2_env": env})
    sys.stdout.write(json.dumps(apps) + "\n")


def restart(app: str, update_env: bool) -> None:
    state = load()
    apps = state.setdefault("apps", {})
    current = dict(apps.get(app, {}))
    if update_env:
        # Copy current mock process env for known keys already in the app plus
        # any overlay keys present in this process environment.
        overlay_keys = (
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
        new_env = dict(current)
        for key in overlay_keys:
            if key in os.environ:
                new_env[key] = os.environ[key]
            # Omitted keys are preserved (PM2 --update-env merge). Absence is not restored.
        apps[app] = new_env
        history = state.setdefault("history", [])
        history.append({"app": app, "env": dict(new_env)})
    else:
        apps.setdefault(app, current)
    save(state)


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
        restart(app, update)
        return 0
    print("mock-pm2: unsupported", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
