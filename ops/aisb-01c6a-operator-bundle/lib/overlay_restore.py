"""Independent overlay restoration with injectable PM2.

HMAC ABSENT→EMPTY is a named exception requiring later authorization.
It is not extended to other variables. PM2 --update-env merges; omission
does not restore absence. Unsupported ABSENT restoration is refused before
mutation. Vault is preserved on mismatch or partial failure.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from vault import (
    HMAC_NAMES,
    load_app_metadata,
    load_metadata,
    load_protected,
    restore_plan,
    var_entries,
    write_app_vault,
    mark_pending_apps,
    clear_pending_app,
)

WORKER_WINDOW_SEC = 1800
GATEWAY_WINDOW_SEC = 300
TOOL_LOOP_NAME = "AGENT_HARNESS_ENABLE_TOOL_LOOP"
HMAC_PROCESS_NAME = "HARNESS_ENTITLEMENT_HMAC_SECRET"
DUMMY_XAI_KEY_DEFAULT = "01C6A-NONSECRET-DUMMY-XAI-KEY"
DUMMY_XAI_ENV = "AISB_01C6A_DUMMY_XAI_API_KEY"

HMAC_AUTH_ENV = "AISB_01C6A_HMAC_ABSENT_EMPTY_RESTORE_AUTHORIZED"
DEFAULT_RESTORE_TIMEOUT_SEC = 20
CAPTURE_STOP_RESERVE_SEC = 7.0  # INT wait 5s + TERM grace 2s
PCAP_PARSE_RESERVE_SEC = 20.0
WATCHDOG_POLL_SEC = 0.02


class OverlayError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class UnsupportedAbsentRestore(OverlayError):
    def __init__(self, name: str) -> None:
        super().__init__(
            "UNSUPPORTED_ABSENT_RESTORE",
            f"PM2 --update-env cannot restore {name} to ABSENT; refuse before mutation",
        )
        self.name = name


@dataclass
class RestoreResult:
    ok: bool
    matched: bool
    pending_hmac_authorization: bool
    preserved_vault: bool
    compared: dict[str, dict[str, str]] = field(default_factory=dict)
    message: str = ""
    apps_restored: list[str] = field(default_factory=list)
    apps_failed: list[str] = field(default_factory=list)
    interrupted: bool = False
    attempted: bool = False

    @property
    def overlays_restored(self) -> bool:
        return self.ok


class Pm2Adapter:
    def restart_update_env(self, app: str, env: Mapping[str, str | None]) -> None:
        raise NotImplementedError

    def dump_env(self, app: str) -> dict[str, str | None]:
        raise NotImplementedError


def _child_env_for_pm2(overlay: Mapping[str, str]) -> dict[str, str]:
    keep = (
        "PATH",
        "PATHEXT",
        "SYSTEMROOT",
        "SYSTEMDRIVE",
        "WINDIR",
        "COMSPEC",
        "MOCK_PM2_STATE",
        "PYTHONPATH",
        "PYTHONHOME",
        "PYTHONIOENCODING",
        "TEMP",
        "TMP",
        "HOME",
        "USERPROFILE",
        "LANG",
        "LC_ALL",
    )
    child: dict[str, str] = {}
    for key in keep:
        if key in os.environ:
            child[key] = os.environ[key]
    for key, value in overlay.items():
        child[key] = value
    return child


class CliPm2(Pm2Adapter):
    def __init__(self, pm2_bin: str, timeout_sec: float = DEFAULT_RESTORE_TIMEOUT_SEC) -> None:
        self.pm2_bin = pm2_bin
        self.timeout_sec = timeout_sec

    def _argv(self, *parts: str) -> list[str]:
        if str(self.pm2_bin).endswith(".py"):
            return [sys.executable, self.pm2_bin, *parts]
        return [self.pm2_bin, *parts]

    def restart_update_env(self, app: str, env: Mapping[str, str | None]) -> None:
        overlay: dict[str, str] = {}
        for key, value in env.items():
            if value is None:
                raise UnsupportedAbsentRestore(key)
            overlay[key] = value
        subprocess.check_call(
            self._argv("restart", app, "--update-env"),
            env=_child_env_for_pm2(overlay),
            timeout=self.timeout_sec,
        )

    def dump_env(self, app: str) -> dict[str, str | None]:
        out = subprocess.check_output(
            self._argv("jlist"),
            text=True,
            timeout=self.timeout_sec,
        )
        try:
            apps = json.loads(out)
        except json.JSONDecodeError as exc:
            raise OverlayError("BASELINE_READ_FAILED", f"pm2 jlist is not JSON for {app}") from exc
        if not isinstance(apps, list):
            raise OverlayError("BASELINE_READ_FAILED", "pm2 jlist is not a list")
        found = [item for item in apps if isinstance(item, dict) and item.get("name") == app]
        if not found:
            raise OverlayError("BASELINE_APP_MISSING", f"pm2 jlist missing app {app}")
        if len(found) > 1:
            raise OverlayError("BASELINE_APP_DUPLICATE", f"pm2 jlist duplicate app {app}")
        return dict(found[0].get("pm2_env") or {})


def desired_env_for_restore(
    vault_dir: str,
    hmac_absent_empty_authorized: bool,
    *,
    app: str | None = None,
) -> tuple[dict[str, str], str | None]:
    """Return (desired SET/EMPTY map, refuse_reason).

    refuse_reason is PENDING_HMAC or UNSUPPORTED_ABSENT_RESTORE.
    Never includes None; ABSENT is not a PM2 merge operation.
    """
    metadata = load_app_metadata(vault_dir, app) if app else load_metadata(vault_dir)
    plan = restore_plan(metadata, hmac_absent_empty_authorized)
    desired: dict[str, str] = {}
    for name, var in plan.items():
        if name in HMAC_NAMES and var.state == "ABSENT":
            return {}, "PENDING_HMAC"
        if var.state == "ABSENT":
            return {}, "UNSUPPORTED_ABSENT_RESTORE"
        if var.state == "SET":
            if var.secret:
                secret = load_protected(vault_dir, name, app=app)
                if secret is None:
                    raise OverlayError("MISSING_PROTECTED", f"missing protected value for SET {name}")
                desired[name] = secret
            else:
                desired[name] = var.restore_value if var.restore_value is not None else ""
        elif var.state == "EMPTY":
            desired[name] = ""
    return desired, None


def _state_of(value: str | None) -> str:
    if value is None:
        return "ABSENT"
    if value == "":
        return "EMPTY"
    return "SET"


def compare_restore(
    metadata: Mapping[str, Any],
    actual: Mapping[str, str | None],
    hmac_absent_empty_authorized: bool,
) -> tuple[bool, dict[str, dict[str, str]]]:
    compared: dict[str, dict[str, str]] = {}
    matched = True
    for name, entry in var_entries(metadata).items():
        expected_state = entry["state"]
        if name in HMAC_NAMES and expected_state == "ABSENT":
            if hmac_absent_empty_authorized:
                expected_state = "EMPTY"
            else:
                compared[name] = {
                    "expected": "ABSENT_PENDING_AUTH",
                    "actual": _state_of(actual.get(name) if name in actual else None),
                }
                matched = False
                continue
        actual_present = name in actual
        actual_value = actual.get(name) if actual_present else None
        actual_state = _state_of(actual_value if actual_present else None)
        expected_value = entry.get("value")
        if entry.get("secret") and expected_state == "SET":
            ok = actual_state == "SET"
            compared[name] = {"expected": "SET", "actual": actual_state}
            if not ok:
                matched = False
            continue
        if expected_state == "SET":
            ok = actual_present and actual.get(name) == expected_value
            compared[name] = {
                "expected": "SET",
                "actual": "SET" if actual_present and actual.get(name) is not None else "ABSENT",
            }
            if not ok:
                matched = False
        else:
            ok = actual_state == expected_state
            compared[name] = {"expected": expected_state, "actual": actual_state}
            if not ok:
                matched = False
    return matched, compared


def dump_app_envs(apps: list[str], pm2: Pm2Adapter) -> dict[str, dict[str, str | None]]:
    """Read PM2 env for each app. Fail closed on read/missing/duplicate."""
    if len(apps) != len(set(apps)):
        raise OverlayError("BASELINE_APP_DUPLICATE", "duplicate overlay app names")
    dumps: dict[str, dict[str, str | None]] = {}
    for app in apps:
        try:
            actual = pm2.dump_env(app)
        except OverlayError:
            raise
        except KeyError as exc:
            raise OverlayError("BASELINE_APP_MISSING", f"pm2 dump missing app {app}") from exc
        except Exception as exc:
            raise OverlayError("BASELINE_READ_FAILED", f"{app}: {type(exc).__name__}") from exc
        if not isinstance(actual, dict):
            raise OverlayError("BASELINE_READ_FAILED", f"{app}: env dump is not a mapping")
        dumps[app] = actual
    return dumps


def write_baselines_from_dumps(
    vault_dir: str,
    apps: list[str],
    dumps: Mapping[str, Mapping[str, str | None]],
    overlay_keys: Mapping[str, str | None],
) -> None:
    """Store observed values only. Caller defaults are never substituted."""
    for app in apps:
        actual = dumps.get(app)
        if actual is None:
            raise OverlayError("BASELINE_APP_MISSING", f"no dump for {app}")
        baseline: dict[str, str | None] = {}
        for name in overlay_keys:
            if name in actual:
                baseline[name] = actual[name]
            else:
                baseline[name] = None
        try:
            write_app_vault(vault_dir, app, baseline)
        except Exception as exc:
            raise OverlayError("BASELINE_VAULT_WRITE_FAILED", f"{app}: {type(exc).__name__}") from exc


def record_baselines_from_pm2(
    vault_dir: str,
    apps: list[str],
    pm2: Pm2Adapter,
    overlay_keys: Mapping[str, str | None],
) -> dict[str, dict[str, str | None]]:
    """Record observed per-app baselines. Fail closed on read/write errors.

    Missing keys are stored as ABSENT (None). Caller defaults are never
    substituted for unread or missing values.
    """
    dumps = dump_app_envs(apps, pm2)
    write_baselines_from_dumps(vault_dir, apps, dumps, overlay_keys)
    return dumps


def assert_payloads_restorable(
    dumps: Mapping[str, Mapping[str, str | None]],
    payloads: Mapping[str, Mapping[str, str]],
    hmac_absent_empty_authorized: bool,
) -> None:
    """Refuse unrestorable overlays before any vault write or PM2 mutation."""
    for app, payload in payloads.items():
        if not payload:
            continue
        observed = dumps.get(app)
        if observed is None:
            raise OverlayError("BASELINE_APP_MISSING", f"no dump for {app}")
        for name in payload:
            state = env_state(observed, name)
            if state != "ABSENT":
                continue
            if name in HMAC_NAMES:
                if not hmac_absent_empty_authorized:
                    raise OverlayError(
                        "PENDING_HMAC",
                        "HMAC ABSENT→EMPTY is not authorized; refuse before mutation",
                    )
                continue
            raise OverlayError(
                "UNSUPPORTED_ABSENT_RESTORE",
                f"cannot restore {name} to ABSENT after overlay; refuse before mutation",
            )


def env_state(dump: Mapping[str, str | None], name: str) -> str:
    if name not in dump:
        return "ABSENT"
    value = dump.get(name)
    if value is None:
        return "ABSENT"
    if value == "":
        return "EMPTY"
    return "SET"


def hmac_secret_from_env(env: Mapping[str, str]) -> str:
    return (env.get("AISB_01C6A_HMAC_SECRET") or env.get(HMAC_PROCESS_NAME) or "").strip()


def dummy_xai_key_from_env(env: Mapping[str, str]) -> str:
    raw = (env.get(DUMMY_XAI_ENV) or "").strip()
    return raw or DUMMY_XAI_KEY_DEFAULT


def build_overlay_payloads(
    which: str,
    dumps: Mapping[str, Mapping[str, str | None]],
    env: Mapping[str, str],
    gateway_app: str,
    worker_app: str,
) -> dict[str, dict[str, str]]:
    """Specified overlays only. Stub does not enable Gateway execution."""
    hmac_secret = hmac_secret_from_env(env)
    dummy = dummy_xai_key_from_env(env)
    payloads: dict[str, dict[str, str]] = {gateway_app: {}, worker_app: {}}
    wdump = dumps.get(worker_app) or {}
    gdump = dumps.get(gateway_app) or {}

    if wdump.get(TOOL_LOOP_NAME) != "true":
        payloads[worker_app][TOOL_LOOP_NAME] = "true"
    worker_hmac_state = env_state(wdump, HMAC_PROCESS_NAME)
    if worker_hmac_state != "SET" or wdump.get(HMAC_PROCESS_NAME) != hmac_secret:
        if not hmac_secret:
            raise OverlayError("MISSING_HMAC_SECRET", "worker HMAC overlay requires a non-empty secret")
        payloads[worker_app][HMAC_PROCESS_NAME] = hmac_secret
    if wdump.get("XAI_API_KEY") != dummy:
        payloads[worker_app]["XAI_API_KEY"] = dummy

    if which == "xai":
        gw_hmac_state = env_state(gdump, HMAC_PROCESS_NAME)
        if gw_hmac_state != "SET" or gdump.get(HMAC_PROCESS_NAME) != hmac_secret:
            if not hmac_secret:
                raise OverlayError("MISSING_HMAC_SECRET", "Gateway HMAC overlay requires a non-empty secret")
            payloads[gateway_app][HMAC_PROCESS_NAME] = hmac_secret
        if gdump.get("GLOBAL_EXECUTION_ENABLED") != "true":
            payloads[gateway_app]["GLOBAL_EXECUTION_ENABLED"] = "true"
    return payloads


def apply_overlay_payloads(
    pm2: Pm2Adapter,
    payloads: Mapping[str, Mapping[str, str]],
    abort: Callable[[], bool] | None = None,
) -> None:
    for app, payload in payloads.items():
        if abort and abort():
            return
        if payload:
            pm2.restart_update_env(app, payload)


def assert_restore_feasible(
    vault_dir: str,
    apps: list[str],
    hmac_absent_empty_authorized: bool,
) -> None:
    """Refuse HMAC ABSENT and other unrestorable ABSENT keys before mutation."""
    for app in apps:
        metadata = load_app_metadata(vault_dir, app)
        plan = restore_plan(metadata, hmac_absent_empty_authorized)
        for name, var in plan.items():
            if name in HMAC_NAMES and var.state == "ABSENT":
                if not hmac_absent_empty_authorized:
                    raise OverlayError(
                        "PENDING_HMAC",
                        "HMAC ABSENT→EMPTY is not authorized; refuse before mutation",
                    )
            elif var.state == "ABSENT":
                raise OverlayError(
                    "UNSUPPORTED_ABSENT_RESTORE",
                    f"cannot restore {name} to ABSENT after overlay; refuse before mutation",
                )


def _validate_window_limit(value: float, maximum: float, name: str) -> float:
    if not math.isfinite(value) or value < 0 or value > maximum:
        raise OverlayError(
            "WINDOW_LIMIT_INVALID",
            f"{name} window must be a finite number in 0..{int(maximum)} seconds (not 86400)",
        )
    return value


@dataclass
class OverlayWindowState:
    worker_app: str
    gateway_app: str
    worker_limit_sec: float = WORKER_WINDOW_SEC
    gateway_limit_sec: float = GATEWAY_WINDOW_SEC
    worker_started_mono: float | None = None
    gateway_started_mono: float | None = None
    restore_reserve_sec: float = DEFAULT_RESTORE_TIMEOUT_SEC

    def __post_init__(self) -> None:
        self.worker_limit_sec = _validate_window_limit(
            float(self.worker_limit_sec), WORKER_WINDOW_SEC, "worker"
        )
        self.gateway_limit_sec = _validate_window_limit(
            float(self.gateway_limit_sec), GATEWAY_WINDOW_SEC, "gateway"
        )
        reserve = float(self.restore_reserve_sec)
        if not math.isfinite(reserve) or reserve < 0:
            raise OverlayError("WINDOW_LIMIT_INVALID", "restore reserve must be a finite number >= 0")
        self.restore_reserve_sec = reserve

    def mark_applied(self, app: str, now_mono: float) -> None:
        """Arm once. Later marks must not restart the bounded window."""
        if app == self.worker_app and self.worker_started_mono is None:
            self.worker_started_mono = now_mono
        if app == self.gateway_app and self.gateway_started_mono is None:
            self.gateway_started_mono = now_mono

    def arm_apps(self, apps: list[str], now_mono: float) -> None:
        for app in apps:
            self.mark_applied(app, now_mono)

    def remaining_hard_sec(self, now_mono: float) -> float | None:
        limits: list[float] = []
        if self.worker_started_mono is not None:
            limits.append(self.worker_limit_sec - (now_mono - self.worker_started_mono))
        if self.gateway_started_mono is not None:
            limits.append(self.gateway_limit_sec - (now_mono - self.gateway_started_mono))
        if not limits:
            return None
        return min(limits)

    def remaining_work_sec(self, now_mono: float) -> float | None:
        hard = self.remaining_hard_sec(now_mono)
        if hard is None:
            return None
        return hard - self.restore_reserve_sec

    def violation(self, now_mono: float) -> str | None:
        if self.worker_started_mono is not None:
            if (now_mono - self.worker_started_mono) >= self.worker_limit_sec:
                return "WORKER_WINDOW_EXCEEDED"
        if self.gateway_started_mono is not None:
            if (now_mono - self.gateway_started_mono) >= self.gateway_limit_sec:
                return "GATEWAY_WINDOW_EXCEEDED"
        return None

    def restore_due(self, now_mono: float) -> str | None:
        """Hard expiry, or remaining time is within the restore/verify reserve."""
        hard = self.violation(now_mono)
        if hard:
            return hard
        work = self.remaining_work_sec(now_mono)
        if work is not None and work <= 0:
            if self.gateway_started_mono is not None:
                gw_left = self.gateway_limit_sec - (now_mono - self.gateway_started_mono)
                if gw_left <= self.restore_reserve_sec:
                    return "GATEWAY_WINDOW_EXCEEDED"
            if self.worker_started_mono is not None:
                return "WORKER_WINDOW_EXCEEDED"
        return None


def compute_restore_reserve_sec(n_apps: int = 2) -> float:
    """Reserve capture stop, pcap parse, and cumulative PM2 restore/verify time.

    The reserve is capped so it remains inside the 1800s worker and 300s
    Gateway overlay windows.
    """
    n = max(1, int(n_apps))
    pm2_sec = n * DEFAULT_RESTORE_TIMEOUT_SEC * 2
    total = CAPTURE_STOP_RESERVE_SEC + PCAP_PARSE_RESERVE_SEC + pm2_sec
    return min(float(total), float(GATEWAY_WINDOW_SEC), float(WORKER_WINDOW_SEC))


def normalize_restore_reserve_sec(
    raw: str | None,
    worker_limit_sec: float,
    gateway_limit_sec: float,
    n_apps: int = 2,
) -> float:
    if raw is None or str(raw).strip() == "":
        value = compute_restore_reserve_sec(n_apps)
    else:
        try:
            value = float(str(raw).strip())
        except (TypeError, ValueError) as exc:
            raise OverlayError("WINDOW_LIMIT_INVALID", "restore reserve is not a number") from exc
        if not math.isfinite(value) or value < 0:
            raise OverlayError("WINDOW_LIMIT_INVALID", "restore reserve must be a finite number >= 0")
    cap = min(float(worker_limit_sec), float(gateway_limit_sec), float(WORKER_WINDOW_SEC), float(GATEWAY_WINDOW_SEC))
    return min(value, cap)


def start_restore_watchdog(
    windows: OverlayWindowState,
    *,
    clock: Callable[[], float],
    on_due: Callable[[str], None],
    stop: threading.Event,
    poll_sec: float = WATCHDOG_POLL_SEC,
    sleep: Callable[[float], None] | None = None,
) -> threading.Thread:
    """Restore when the window is due even if a blocked caller has not returned.

    ``sleep`` defaults to wall-clock time.sleep so a virtual test clock is
    not advanced from this thread.
    """
    sleeper = sleep or time.sleep

    def run() -> None:
        while not stop.is_set():
            try:
                due = windows.restore_due(clock())
            except Exception:
                return
            if due:
                try:
                    on_due(due)
                except Exception:
                    pass
                return
            try:
                work = windows.remaining_work_sec(clock())
            except Exception:
                return
            wait = poll_sec
            if work is not None:
                if work <= 0:
                    try:
                        on_due(windows.restore_due(clock()) or "WORKER_WINDOW_EXCEEDED")
                    except Exception:
                        pass
                    return
                wait = max(0.001, min(poll_sec, work))
            try:
                sleeper(wait)
            except Exception:
                return

    thread = threading.Thread(target=run, name="aisb-01c6a-restore-watchdog", daemon=True)
    thread.start()
    return thread


def parse_window_limit(raw: str | None, default: float, maximum: float, name: str) -> float:
    if raw is None or str(raw).strip() == "":
        return float(default)
    try:
        value = float(str(raw).strip())
    except (TypeError, ValueError) as exc:
        raise OverlayError("WINDOW_LIMIT_INVALID", f"{name} window is not a number") from exc
    return _validate_window_limit(value, maximum, name)


def window_limits_from_env(env: Mapping[str, str]) -> tuple[float, float]:
    worker_sec = parse_window_limit(
        env.get("AISB_01C6A_WORKER_WINDOW_SEC"), WORKER_WINDOW_SEC, WORKER_WINDOW_SEC, "worker"
    )
    gateway_sec = parse_window_limit(
        env.get("AISB_01C6A_GATEWAY_WINDOW_SEC"), GATEWAY_WINDOW_SEC, GATEWAY_WINDOW_SEC, "gateway"
    )
    return worker_sec, gateway_sec


def restore_overlays(
    vault_dir: str,
    apps: list[str],
    pm2: Pm2Adapter,
    hmac_absent_empty_authorized: bool,
    delete_vault_on_success: bool = True,
) -> RestoreResult:
    compared_all: dict[str, dict[str, str]] = {}
    apps_restored: list[str] = []
    apps_failed: list[str] = []
    interrupted = False
    attempted = False
    pending_any = False
    unsupported_any = False

    shared_desired: dict[str, str] = {}
    shared_refuse = None
    shared_meta = os.path.join(vault_dir, "metadata.json")
    if os.path.isfile(shared_meta):
        shared_desired, shared_refuse = desired_env_for_restore(
            vault_dir, hmac_absent_empty_authorized
        )
        if shared_refuse == "PENDING_HMAC":
            return RestoreResult(
                ok=False,
                matched=False,
                pending_hmac_authorization=True,
                preserved_vault=True,
                message="HMAC ABSENT→EMPTY named exception is not authorized; vault preserved",
                attempted=False,
            )

    for app in apps:
        try:
            desired, refuse = desired_env_for_restore(
                vault_dir, hmac_absent_empty_authorized, app=app
            )
            if refuse == "PENDING_HMAC":
                pending_any = True
                apps_failed.append(app)
                continue
            if refuse == "UNSUPPORTED_ABSENT_RESTORE" or shared_refuse == "UNSUPPORTED_ABSENT_RESTORE":
                unsupported_any = True
                apps_failed.append(app)
                continue
            if not desired and not shared_desired:
                apps_failed.append(app)
                continue
            payload = desired or shared_desired
            attempted = True
            pm2.restart_update_env(app, payload)
            actual = pm2.dump_env(app)
            metadata = load_app_metadata(vault_dir, app)
            ok, compared = compare_restore(metadata, actual, hmac_absent_empty_authorized)
            for name, entry in var_entries(metadata).items():
                if entry.get("secret") and entry.get("state") == "SET":
                    expected = load_protected(vault_dir, name, app=app)
                    if actual.get(name) != expected:
                        ok = False
                        compared[name] = {"expected": "SET_EXACT", "actual": "MISMATCH"}
            compared_all[app] = {k: f"{v['expected']}->{v['actual']}" for k, v in compared.items()}
            if ok:
                apps_restored.append(app)
                clear_pending_app(vault_dir, app)
            else:
                apps_failed.append(app)
        except KeyboardInterrupt:
            interrupted = True
            apps_failed.append(app)
            continue
        except Exception as exc:
            apps_failed.append(app)
            compared_all[app] = {"error": f"{type(exc).__name__}"}
            continue

    matched = not apps_failed and not pending_any and not unsupported_any and not interrupted
    ok = matched and (not apps or len(apps_restored) == len(apps))
    if pending_any and not attempted:
        message = "HMAC ABSENT→EMPTY named exception is not authorized; vault preserved"
    elif unsupported_any:
        message = "UNSUPPORTED_ABSENT_RESTORE; vault preserved; remaining apps attempted"
    elif interrupted:
        message = "restore interrupted; vault preserved; remaining apps attempted"
    elif not ok:
        message = "overlay restore mismatch or partial failure; vault preserved"
    else:
        message = "overlay restore matched"
    return RestoreResult(
        ok=ok,
        matched=matched,
        pending_hmac_authorization=pending_any,
        preserved_vault=not ok,
        compared=compared_all,
        message=message,
        apps_restored=apps_restored,
        apps_failed=apps_failed,
        interrupted=interrupted,
        attempted=attempted,
    )
