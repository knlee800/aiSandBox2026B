"""Independent overlay restoration with injectable PM2.

HMAC ABSENT→EMPTY is a named exception requiring later authorization.
It is not extended to other variables. PM2 --update-env merges; omission
does not restore absence. Unsupported ABSENT restoration is refused before
mutation. Vault is preserved on mismatch or partial failure.

PM2-OVERLAY-UNKNOWN-01 (stage-start §4 as corrected by §10.3, controlling):

* Every PM2 mutation is a journaled *command attempt* (INTENT persisted
  before spawn, DISPATCHED after spawn, then ACKED / NOT_DELIVERED /
  UNCERTAIN). Uncertain fate latches ``UNKNOWN_PENDING_OVERLAY`` and the
  latch is never cleared by this bundle.
* Restore is single-owner. Ownership and dispatch admission share one
  coordination lock; a pre-spawn re-check under that lock makes a
  post-ownership spawn impossible by construction.
* Command acknowledgement and dual-field snapshot matching are reported as
  separate *evidence* fields. They never produce a restoration-success claim:
  PM2-FENCE-01 F5 requires F1–F4 proof and this bundle has **no authorized
  production proof provider and no override** (no parameter, flag,
  environment variable, configuration value, file, or caller assertion).
  ``restore_ok`` / ``overlays_restored`` are therefore always False here.
"""

from __future__ import annotations

import inspect
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
    FATE_ACKED,
    FATE_NOT_DELIVERED,
    FATE_UNCERTAIN,
    HMAC_NAMES,
    CommandJournal,
    VaultRunLock,
    VaultStateError,
    clear_pending_app,
    entry_is_terminal,
    entry_is_unresolved,
    latch_unknown,
    load_app_metadata,
    load_metadata,
    load_protected,
    mark_pending_apps,
    restore_plan,
    unknown_latched,
    var_entries,
    write_app_vault,
    write_restore_result,
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
DEFAULT_ACCOUNTING_WAIT_SEC = 2.0

# F5 boundary (stage-start §10.3.A.2). This is the only fence-proof value any
# shipped code path produces. There is no provider, no override, and no
# parameter that accepts another value.
FENCE_PROOF_NONE = "NONE"

# Result classes (§10.3.A.3). RESULT_RESTORED_PROVEN is listed for
# completeness of the frozen vocabulary; it is unreachable from every entry
# point in this bundle because no proof provider exists.
RESULT_UNKNOWN_PENDING_OVERLAY = "UNKNOWN_PENDING_OVERLAY"
RESULT_RESTORE_FAILED = "RESTORE_FAILED"
RESULT_PENDING_HMAC = "PENDING_HMAC"
RESULT_UNSUPPORTED_ABSENT_RESTORE = "UNSUPPORTED_ABSENT_RESTORE"
RESULT_RESTORE_INTERRUPTED = "RESTORE_INTERRUPTED"
RESULT_ATTEMPTED_ACKED_MATCHED_UNPROVEN = "RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN"
RESULT_RESTORED_PROVEN = "RESTORED_PROVEN"
RESULT_RUN_LOCK_HELD = "RUN_LOCK_HELD"

# In-memory attempt states (§10.3.B).
ATTEMPT_ADMITTED_NOT_SPAWNED = "ADMITTED_NOT_SPAWNED"
ATTEMPT_SPAWNED_UNRECORDED = "SPAWNED_UNRECORDED"
ATTEMPT_DISPATCHED = "DISPATCHED"
ATTEMPT_SETTLED = "SETTLED"

OP_APPLY = "APPLY"
OP_RESTORE = "RESTORE"


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
    """Outcome of one restore run.

    ``commands_acked`` and ``snapshot_matched`` are evidence fields only.
    ``ok`` (== ``overlays_restored``) additionally requires an F1–F4 fence
    proof, which no code path in this bundle can supply; in production it is
    always False. ``unknown_pending_overlay=True`` implies ``ok=False``.
    """

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
    result_class: str = RESULT_RESTORE_FAILED
    unknown_pending_overlay: bool = False
    snapshot_matched: bool = False
    commands_acked: bool = False
    attempts: list[str] = field(default_factory=list)
    fence_proof: str = FENCE_PROOF_NONE
    run_id: str = ""
    latch_reasons: list[str] = field(default_factory=list)

    @property
    def overlays_restored(self) -> bool:
        return self.ok

    @property
    def restore_proven(self) -> bool:
        """True only for a proof-bearing successful restore. Unreachable here."""
        return bool(self.ok and self.fence_proof != FENCE_PROOF_NONE and not self.unknown_pending_overlay)


class Pm2Adapter:
    #: Adapters that can run the spawn step under the caller-supplied gate
    #: (see ``dispatch_restart``) set this True and accept ``spawn_gate=``.
    supports_spawn_gate: bool = False

    def restart_update_env(self, app: str, env: Mapping[str, str | None]) -> None:
        raise NotImplementedError

    def dump_env(self, app: str) -> dict[str, str | None]:
        raise NotImplementedError

    def dump_env_dual(self, app: str) -> tuple[dict[str, str | None], dict[str, str | None]]:
        """Return ``(pm2_env top-level, pm2_env.env nested)``.

        Default for single-field adapters: if the dump carries an ``env``
        mapping it is the nested field; otherwise the adapter models one
        spawned, self-consistent process and both fields are the same dump.
        ``CliPm2`` reads both fields from one ``jlist``.
        """
        dump = self.dump_env(app)
        nested = dump.get("env") if isinstance(dump, dict) else None
        if isinstance(nested, dict):
            top = {k: v for k, v in dump.items() if k != "env"}
            return top, dict(nested)
        return dict(dump), dict(dump)


_CHILD_ENV_ALWAYS = (
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "SYSTEMDRIVE",
    "WINDIR",
    "COMSPEC",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "LANG",
    "LC_ALL",
)
# Forwarded only when the PM2 "binary" is the .py mock CLI (§4.10): with the
# live binary these would be merged into the target app's pm2_env.env.
_CHILD_ENV_MOCK_ONLY = (
    "MOCK_PM2_STATE",
    "PYTHONPATH",
    "PYTHONHOME",
    "PYTHONIOENCODING",
)


def _child_env_for_pm2(overlay: Mapping[str, str], *, mock_cli: bool = False) -> dict[str, str]:
    keep: tuple[str, ...] = _CHILD_ENV_ALWAYS + (_CHILD_ENV_MOCK_ONLY if mock_cli else ())
    child: dict[str, str] = {}
    for key in keep:
        if key in os.environ:
            child[key] = os.environ[key]
    for key, value in overlay.items():
        child[key] = value
    return child


class CliPm2(Pm2Adapter):
    supports_spawn_gate = True

    def __init__(self, pm2_bin: str, timeout_sec: float = DEFAULT_RESTORE_TIMEOUT_SEC) -> None:
        self.pm2_bin = pm2_bin
        self.timeout_sec = timeout_sec

    def _is_mock_cli(self) -> bool:
        return str(self.pm2_bin).endswith(".py")

    def _argv(self, *parts: str) -> list[str]:
        if self._is_mock_cli():
            return [sys.executable, self.pm2_bin, *parts]
        return [self.pm2_bin, *parts]

    def _refuse_mock_state_in_live_env(self) -> None:
        if not self._is_mock_cli() and "MOCK_PM2_STATE" in os.environ:
            raise OverlayError(
                "MOCK_STATE_IN_LIVE_ENV",
                "MOCK_PM2_STATE is set while the PM2 binary is live; refusing before mutation",
            )

    def restart_update_env(
        self,
        app: str,
        env: Mapping[str, str | None],
        *,
        spawn_gate: Callable[[Callable[[], Any]], Any] | None = None,
    ) -> None:
        overlay: dict[str, str] = {}
        for key, value in env.items():
            if value is None:
                raise UnsupportedAbsentRestore(key)
            overlay[key] = value
        self._refuse_mock_state_in_live_env()
        argv = self._argv("restart", app, "--update-env")
        child_env = _child_env_for_pm2(overlay, mock_cli=self._is_mock_cli())
        if spawn_gate is None:
            # Direct (non-journaled) call. Bundle code always dispatches
            # through ``dispatch_restart``; this path exists for callers that
            # bypass the journal deliberately (tests) and keeps the historical
            # synchronous behaviour.
            subprocess.check_call(argv, env=child_env, timeout=self.timeout_sec)
            return
        proc = spawn_gate(lambda: subprocess.Popen(argv, env=child_env, stdin=subprocess.DEVNULL))
        try:
            rc = proc.wait(timeout=self.timeout_sec)
        except subprocess.TimeoutExpired:
            try:
                proc.kill()
                proc.wait(timeout=5)
            except Exception:
                pass
            raise
        if rc != 0:
            raise subprocess.CalledProcessError(rc, argv)

    def _pm2_env(self, app: str) -> dict[str, Any]:
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
        pm2_env = found[0].get("pm2_env") or {}
        if not isinstance(pm2_env, dict):
            raise OverlayError("BASELINE_READ_FAILED", f"pm2_env is not a mapping for {app}")
        return dict(pm2_env)

    def dump_env(self, app: str) -> dict[str, str | None]:
        """Top-level ``pm2_env`` (environment of the last spawn); ``env`` excluded."""
        return {k: v for k, v in self._pm2_env(app).items() if k != "env"}

    def dump_env_dual(self, app: str) -> tuple[dict[str, str | None], dict[str, str | None]]:
        pm2_env = self._pm2_env(app)
        nested = pm2_env.get("env")
        top = {k: v for k, v in pm2_env.items() if k != "env"}
        return top, (dict(nested) if isinstance(nested, dict) else {})


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


def compare_restore_dual(
    metadata: Mapping[str, Any],
    top: Mapping[str, str | None],
    nested: Mapping[str, str | None],
    hmac_absent_empty_authorized: bool,
) -> tuple[bool, dict[str, dict[str, str]], list[str]]:
    """Dual-field named-key comparison (§4.8).

    Each named key is classified SET/EMPTY/ABSENT in ``pm2_env`` and in
    ``pm2_env.env`` with the existing rules; both must match the expectation.
    A per-field state difference, or both SET with different values, is
    DIVERGENT (returned separately; the caller latches UNKNOWN). Named
    exceptions (HMAC ABSENT→EMPTY, UNSUPPORTED_ABSENT_RESTORE) apply
    identically to both fields; no new exception is introduced.
    """
    matched_top, compared_top = compare_restore(metadata, top, hmac_absent_empty_authorized)
    matched_nested, compared_nested = compare_restore(metadata, nested, hmac_absent_empty_authorized)
    compared: dict[str, dict[str, str]] = {}
    divergent: list[str] = []
    for name in var_entries(metadata):
        state_top = env_state(top, name)
        state_nested = env_state(nested, name)
        values_differ = state_top == "SET" and state_nested == "SET" and top.get(name) != nested.get(name)
        if state_top != state_nested or values_differ:
            divergent.append(name)
            compared[name] = {
                "expected": compared_top.get(name, {}).get("expected", "?"),
                "actual": f"DIVERGENT(top={state_top},env={state_nested})",
            }
        else:
            compared[name] = compared_top.get(name) or compared_nested.get(name) or {}
    matched = matched_top and matched_nested and not divergent
    return matched, compared, divergent


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


def assert_baseline_consistent(pm2: Pm2Adapter, apps: list[str], keys: Mapping[str, Any] | list[str]) -> None:
    """Pre-mutation guard (§4.8): refuse when a named key already diverges
    between ``pm2_env`` and ``pm2_env.env`` — a latent pending overlay exists
    and the host is not a clean base. Runs before the first mutation."""
    names = list(keys)
    for app in apps:
        try:
            top, nested = pm2.dump_env_dual(app)
        except OverlayError:
            raise
        except Exception as exc:
            raise OverlayError("BASELINE_READ_FAILED", f"{app}: {type(exc).__name__}") from exc
        for name in names:
            state_top = env_state(top, name)
            state_nested = env_state(nested, name)
            if state_top != state_nested or (
                state_top == "SET" and top.get(name) != nested.get(name)
            ):
                raise OverlayError(
                    "BASELINE_DIVERGENT",
                    f"{app}:{name} pm2_env={state_top} pm2_env.env={state_nested}; latent overlay; refuse",
                )


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


# ---------------------------------------------------------------------------
# Command attempts, dispatch admission, restore ownership (§4.1, §4.6, §10.3.B)
# ---------------------------------------------------------------------------


@dataclass
class Attempt:
    """One LIVE command attempt owned by this process (§10.3.B.2)."""

    attempt_id: str
    op: str
    app: str
    keys: list[str]
    timeout_sec: float
    state: str = ATTEMPT_ADMITTED_NOT_SPAWNED
    fate: str | None = None
    reason: str | None = None
    client_pid: int | None = None
    admitted_mono: float = field(default_factory=time.monotonic)
    dispatched_mono: float | None = None
    settled_mono: float | None = None
    acked_late: bool = False
    settled: threading.Event = field(default_factory=threading.Event)

    def settle(self, fate: str, reason: str | None = None) -> None:
        if self.settled.is_set() and self.fate == FATE_UNCERTAIN:
            return  # uncertainty stays latched
        self.fate = fate
        self.reason = reason
        self.state = ATTEMPT_SETTLED
        self.settled_mono = time.monotonic()
        self.settled.set()


class DispatchContext:
    """Shared coordination state for one run: ownership, admission, journal, latch.

    Lock order (§10.3.C): ``restore_lock`` (coordination) → ``journal.lock``.
    No path acquires ``restore_lock`` while holding the journal lock.
    """

    def __init__(
        self,
        vault_dir: str,
        *,
        journal: CommandJournal | None = None,
        restore_lock: threading.Lock | None = None,
        accounting_wait_sec: float = DEFAULT_ACCOUNTING_WAIT_SEC,
    ) -> None:
        self.vault_dir = vault_dir
        self.journal = journal or CommandJournal(vault_dir)
        self.restore_lock = restore_lock or threading.Lock()
        self.started = False
        self.owner_token: object | None = None
        self.ownership_mono: float | None = None
        self.attempts: dict[str, Attempt] = {}
        self.latched = False
        self.latch_reasons: list[str] = []
        self.accounting_wait_sec = float(accounting_wait_sec)
        #: The raw adapter method to dispatch through (captured before any
        #: gating wrapper is installed by the orchestrator).
        self.orig_restart: Callable[..., Any] | None = None

    @property
    def run_id(self) -> str:
        return self.journal.run_id

    def take_ownership_locked(self) -> object | None:
        """Caller holds ``restore_lock``. Returns the owner token or None if taken."""
        if self.started:
            return None
        self.started = True
        self.owner_token = object()
        self.ownership_mono = time.monotonic()
        return self.owner_token

    def take_ownership(self) -> object | None:
        with self.restore_lock:
            return self.take_ownership_locked()

    def latch(
        self,
        *,
        attempts: list[str] | None = None,
        apps: list[str] | None = None,
        keys: list[str] | None = None,
        reasons: list[str] | None = None,
    ) -> None:
        """Latch UNKNOWN in memory and on disk (best effort; never clears)."""
        self.latched = True
        for reason in reasons or []:
            if reason not in self.latch_reasons:
                self.latch_reasons.append(reason)
        try:
            latch_unknown(
                self.vault_dir,
                attempts=attempts,
                apps=apps,
                keys=keys,
                reasons=reasons,
                journal=self.journal,
            )
        except VaultStateError as exc:
            # The marker write failed; the in-memory latch and the journal's
            # UNCERTAIN/non-terminal entries still latch the vault (§4.3).
            if exc.code not in self.latch_reasons:
                self.latch_reasons.append(exc.code)

    def is_latched(self) -> bool:
        return self.latched or unknown_latched(self.vault_dir)


def _settle_uncertain(
    ctx: DispatchContext,
    attempt: Attempt,
    reason: str,
    *,
    exit_code: int | None = None,
) -> None:
    try:
        ctx.journal.terminal(attempt.attempt_id, FATE_UNCERTAIN, exit_code=exit_code, reason=reason)
    except VaultStateError as exc:
        reason = f"{reason};{exc.code}"
    ctx.latch(
        attempts=[attempt.attempt_id],
        apps=[attempt.app],
        keys=list(attempt.keys),
        reasons=[f"{attempt.op}_{reason}"],
    )
    attempt.settle(FATE_UNCERTAIN, reason)


def _settle_not_delivered(ctx: DispatchContext, attempt: Attempt, reason: str) -> None:
    try:
        ctx.journal.terminal(attempt.attempt_id, FATE_NOT_DELIVERED, reason=reason)
    except VaultStateError:
        # Cannot record the proven non-delivery: fail closed to uncertainty.
        _settle_uncertain(ctx, attempt, f"{reason};TERMINAL_WRITE_FAILED")
        return
    attempt.settle(FATE_NOT_DELIVERED, reason)


def _record_late_ack_after_settled(ctx: DispatchContext, attempt: Attempt) -> None:
    """Caller holds ``restore_lock``. The client returned 0 *after* the owner's
    accounting already settled this attempt (UNCERTAIN, e.g.
    ``UNSETTLED_AT_RESTORE``). The terminal and its reason are immutable
    (§10.3.B.5): the acknowledgement is recorded as *late evidence* only —
    an annotation on the journal entry plus ``APPLY_ACKED_LATE`` widened into
    the monotonic marker. The attempt is never converted back to ACKED and
    no restore is re-run.
    """
    if attempt.op != OP_APPLY or attempt.fate != FATE_UNCERTAIN:
        return
    attempt.acked_late = True
    extra: list[str] = ["APPLY_ACKED_LATE"]
    try:
        ctx.journal.annotate(
            attempt.attempt_id,
            late_ack="ACKED_LATE_AFTER_UNCERTAIN",
            late_ack_exit_code=0,
            late_ack_mono_ts=time.monotonic(),
        )
    except VaultStateError as exc:
        extra.append(exc.code)
    ctx.latch(
        attempts=[attempt.attempt_id],
        apps=[attempt.app],
        keys=list(attempt.keys),
        reasons=extra,
    )


def _settle_acked(ctx: DispatchContext, attempt: Attempt, owner_token: object | None) -> None:
    # Total order against ownership: decided under the coordination lock.
    with ctx.restore_lock:
        if attempt.settled.is_set():
            # Settled meanwhile by the restore owner's accounting: keep that
            # terminal; record the acknowledgement as late evidence only.
            _record_late_ack_after_settled(ctx, attempt)
            return
        late = bool(ctx.started and owner_token is not ctx.owner_token and attempt.op == OP_APPLY)
        try:
            ctx.journal.terminal(attempt.attempt_id, FATE_ACKED, exit_code=0, reason="ACKED_LATE" if late else None)
        except VaultStateError:
            _settle_uncertain(ctx, attempt, "ACK_RECORD_FAILED")
            return
        if late:
            attempt.acked_late = True
            ctx.latch(
                attempts=[attempt.attempt_id],
                apps=[attempt.app],
                keys=list(attempt.keys),
                reasons=["APPLY_ACKED_LATE"],
            )
    attempt.settle(FATE_ACKED, "ACKED_LATE" if late else None)


def _accepts_spawn_gate(restart: Callable[..., Any], pm2: Pm2Adapter) -> bool:
    """True when ``restart`` can run its spawn step under the caller's gate.

    Decided from the callable actually being invoked (a subclass or wrapper
    may drop the keyword even when the adapter class advertises support), so
    a legacy two-argument override is never called with ``spawn_gate=``.
    """
    if not getattr(pm2, "supports_spawn_gate", False):
        return False
    try:
        params = inspect.signature(restart).parameters
    except (TypeError, ValueError):
        return False
    if "spawn_gate" in params:
        return True
    return any(p.kind is inspect.Parameter.VAR_KEYWORD for p in params.values())


def dispatch_restart(
    pm2: Pm2Adapter,
    app: str,
    envmap: Mapping[str, str | None],
    ctx: DispatchContext,
    *,
    op: str = OP_APPLY,
    owner_token: object | None = None,
    timeout_sec: float | None = None,
) -> Attempt:
    """Journaled, admission-gated PM2 restart (§10.3.B.4).

    (a) Under ``restore_lock``: refuse if restore has started and the caller
        is not the owner; else register a LIVE attempt and persist INTENT.
    (b) Immediately before spawn, re-acquire ``restore_lock``: if ownership
        was taken meanwhile → NOT_DELIVERED/REFUSED_BEFORE_SPAWN (proven: no
        process was created); else spawn while holding the lock and persist
        DISPATCHED.
    (c) Wait outside the lock; classify the terminal fate. Any fate that is
        not proven-ACKED or proven-NOT_DELIVERED is UNCERTAIN and latches.
    """
    restart = ctx.orig_restart or pm2.restart_update_env
    keys = sorted(str(k) for k in envmap.keys())
    timeout = float(timeout_sec if timeout_sec is not None else getattr(pm2, "timeout_sec", DEFAULT_RESTORE_TIMEOUT_SEC))
    spawning_adapter = _accepts_spawn_gate(restart, pm2)

    # (a) admission — atomic with ownership
    with ctx.restore_lock:
        if ctx.started and owner_token is not ctx.owner_token:
            raise OverlayError("OVERLAY_AFTER_RESTORE", "refusing to re-enable overlay after restore")
        try:
            attempt_id = ctx.journal.intent(op, app, keys)
        except VaultStateError as exc:
            # Nothing spawned, nothing registered: refuse the dispatch.
            raise OverlayError("JOURNAL_WRITE_FAILED", f"{op} {app}: {exc.code}") from exc
        attempt = Attempt(attempt_id=attempt_id, op=op, app=app, keys=keys, timeout_sec=timeout)
        ctx.attempts[attempt_id] = attempt

    gate_entered = {"v": False}

    def spawn_gate(thunk: Callable[[], Any]) -> Any:
        # (b) pre-spawn re-check and spawn under the coordination lock
        with ctx.restore_lock:
            gate_entered["v"] = True
            if ctx.started and owner_token is not ctx.owner_token:
                _settle_not_delivered(ctx, attempt, "REFUSED_BEFORE_SPAWN")
                raise OverlayError("OVERLAY_AFTER_RESTORE", "refusing to re-enable overlay after restore")
            handle = thunk()
            attempt.state = ATTEMPT_SPAWNED_UNRECORDED
            attempt.client_pid = getattr(handle, "pid", None)
            attempt.dispatched_mono = time.monotonic()
            try:
                ctx.journal.dispatched(attempt.attempt_id, attempt.client_pid)
            except VaultStateError as exc:
                # A process may exist but is unrecorded: uncertainty.
                _settle_uncertain(ctx, attempt, f"DISPATCH_RECORD_FAILED;{exc.code}")
                raise OverlayError("JOURNAL_WRITE_FAILED", f"{op} {app}: {exc.code}") from exc
            attempt.state = ATTEMPT_DISPATCHED
            return handle

    try:
        if spawning_adapter:
            restart(app, envmap, spawn_gate=spawn_gate)
        else:
            # Legacy synchronous adapter: the whole call is the spawn step and
            # completes (acks) before returning; it runs under the lock.
            spawn_gate(lambda: restart(app, envmap))
    except OverlayError as exc:
        if not attempt.settled.is_set():
            if attempt.state == ATTEMPT_ADMITTED_NOT_SPAWNED:
                _settle_not_delivered(ctx, attempt, exc.code)
            else:
                _settle_uncertain(ctx, attempt, exc.code)
        raise
    except subprocess.TimeoutExpired:
        _settle_uncertain(ctx, attempt, "TIMEOUT")
        raise OverlayError("COMMAND_UNCERTAIN", f"{op} {app}: client timeout; fate uncertain")
    except subprocess.CalledProcessError as exc:
        _settle_uncertain(ctx, attempt, f"EXIT_{exc.returncode}", exit_code=exc.returncode)
        raise OverlayError("COMMAND_UNCERTAIN", f"{op} {app}: non-zero exit; fate uncertain") from exc
    except KeyboardInterrupt:
        _settle_uncertain(ctx, attempt, "INTERRUPTED")
        raise
    except BaseException as exc:
        if not attempt.settled.is_set():
            if attempt.state == ATTEMPT_ADMITTED_NOT_SPAWNED and (
                not gate_entered["v"] or (spawning_adapter and isinstance(exc, OSError))
            ):
                # Raised before the gate, or Popen itself failed: no process.
                _settle_not_delivered(ctx, attempt, type(exc).__name__)
                raise OverlayError("COMMAND_NOT_DELIVERED", f"{op} {app}: {type(exc).__name__}") from exc
            _settle_uncertain(ctx, attempt, type(exc).__name__)
        raise OverlayError("COMMAND_UNCERTAIN", f"{op} {app}: {type(exc).__name__}; fate uncertain") from exc
    else:
        # Decided under ``restore_lock``: a first ack settles ACKED (late if
        # ownership was taken meanwhile); an ack arriving after the owner's
        # accounting already settled the attempt is recorded as late evidence
        # only and never re-opens the UNCERTAIN terminal.
        _settle_acked(ctx, attempt, owner_token)
    return attempt


def account_live_attempts(
    ctx: DispatchContext,
    *,
    bound_sec: float | None = None,
) -> list[str]:
    """Owner accounting after ownership (§10.3.B.5). Returns latch reasons added.

    Every LIVE APPLY attempt is waited on with a bound; anything unsettled,
    non-ACKED, or acked after ownership is uncertainty. Every on-disk entry
    lacking a terminal after this — including ORPHANED entries from other
    runs — is latched. Orphans are never adopted or rewritten.
    """
    added: list[str] = []
    with ctx.restore_lock:
        snapshot = list(ctx.attempts.values())
    for attempt in snapshot:
        if attempt.op != OP_APPLY:
            continue
        if not attempt.settled.is_set():
            if attempt.state == ATTEMPT_ADMITTED_NOT_SPAWNED:
                wait = ctx.accounting_wait_sec
            else:
                elapsed = time.monotonic() - (attempt.dispatched_mono or attempt.admitted_mono)
                wait = max(0.0, attempt.timeout_sec - elapsed) + ctx.accounting_wait_sec
            if bound_sec is not None:
                wait = min(wait, max(0.0, float(bound_sec)))
            if not attempt.settled.wait(wait):
                _settle_uncertain(ctx, attempt, "UNSETTLED_AT_RESTORE")
                added.append("APPLY_UNSETTLED_AT_RESTORE")
                continue
        if attempt.fate == FATE_ACKED and attempt.acked_late:
            added.append("APPLY_ACKED_LATE")
        elif attempt.fate == FATE_UNCERTAIN:
            added.append(f"APPLY_{attempt.reason}")
    try:
        entries = ctx.journal.entries()
    except VaultStateError as exc:
        ctx.latch(reasons=[exc.code])
        added.append(exc.code)
        return added
    for entry in entries:
        if entry_is_terminal(entry):
            continue
        if entry.get("run_id") != ctx.run_id:
            ctx.latch(
                attempts=[str(entry.get("attempt_id"))],
                apps=[str(entry.get("app"))],
                keys=[str(k) for k in entry.get("keys") or []],
                reasons=["ORPHANED_ATTEMPT"],
            )
            added.append("ORPHANED_ATTEMPT")
            continue
        live = ctx.attempts.get(str(entry.get("attempt_id")))
        if live is None or not live.settled.is_set():
            # Our own entry with no accountable in-memory attempt: uncertainty.
            ctx.latch(
                attempts=[str(entry.get("attempt_id"))],
                apps=[str(entry.get("app"))],
                keys=[str(k) for k in entry.get("keys") or []],
                reasons=["UNACCOUNTED_ATTEMPT"],
            )
            added.append("UNACCOUNTED_ATTEMPT")
    return added


# ---------------------------------------------------------------------------
# Overlay windows and watchdog (unchanged semantics)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Restore (owner algorithm §4.5 as corrected by §10.3.A / §10.3.B)
# ---------------------------------------------------------------------------


def _result_payload(result: RestoreResult) -> dict[str, Any]:
    """Names and states only; never values."""
    return {
        "format": 1,
        "run_id": result.run_id,
        "result_class": result.result_class,
        "ok": result.ok,
        "restore_ok": result.ok,
        "overlays_restored": result.overlays_restored,
        "restore_proven": result.restore_proven,
        "fence_proof": result.fence_proof,
        "commands_acked": result.commands_acked,
        "snapshot_matched": result.snapshot_matched,
        "unknown_pending_overlay": result.unknown_pending_overlay,
        "pending_hmac_authorization": result.pending_hmac_authorization,
        "preserved_vault": result.preserved_vault,
        "interrupted": result.interrupted,
        "attempted": result.attempted,
        "attempts": list(result.attempts),
        "apps_restored": list(result.apps_restored),
        "apps_failed": list(result.apps_failed),
        "compared": {app: dict(states) for app, states in result.compared.items()},
        "latch_reasons": list(result.latch_reasons),
        "message": result.message,
    }


def restore_overlays(
    vault_dir: str,
    apps: list[str],
    pm2: Pm2Adapter,
    hmac_absent_empty_authorized: bool,
    delete_vault_on_success: bool = True,
    *,
    ctx: DispatchContext | None = None,
    run_lock: VaultRunLock | None = None,
    accounting_bound_sec: float | None = None,
) -> RestoreResult:
    """Restore recorded baselines for ``apps``.

    Standalone use (``ctx=None``; e.g. ``bin/restore-overlays.sh``): this call
    takes the vault run lock and becomes the restore owner with a fresh
    journal run. Orchestrated use passes the owning ``ctx`` (ownership already
    taken under its lock) and its held ``run_lock`` so the nested call neither
    re-locks nor mistakes its own lock for a competing process.

    ``delete_vault_on_success`` is retained for signature compatibility and
    has no effect: recovery deletion requires a proven restore
    (``vault.delete_protected_recovery``), which this bundle cannot produce.
    """
    own_lock: VaultRunLock | None = None
    if run_lock is None:
        own_lock = VaultRunLock(vault_dir)
        try:
            own_lock.acquire()
        except VaultStateError as exc:
            return RestoreResult(
                ok=False,
                matched=False,
                pending_hmac_authorization=False,
                preserved_vault=True,
                message=f"{exc.code}: another run holds the vault; no mutation performed",
                result_class=RESULT_RUN_LOCK_HELD,
            )
    try:
        if ctx is None:
            ctx = DispatchContext(vault_dir)
            ctx.orig_restart = pm2.restart_update_env
            token = ctx.take_ownership()
        else:
            token = ctx.owner_token
            if not ctx.started or token is None:
                raise OverlayError("RESTORE_NOT_OWNER", "restore_overlays requires the restore owner's context")
        return _restore_owned(
            vault_dir,
            apps,
            pm2,
            hmac_absent_empty_authorized,
            ctx=ctx,
            token=token,
            accounting_bound_sec=accounting_bound_sec,
        )
    finally:
        if own_lock is not None:
            own_lock.release()


def _restore_owned(
    vault_dir: str,
    apps: list[str],
    pm2: Pm2Adapter,
    hmac_absent_empty_authorized: bool,
    *,
    ctx: DispatchContext,
    token: object,
    accounting_bound_sec: float | None,
) -> RestoreResult:
    compared_all: dict[str, dict[str, str]] = {}
    apps_restored: list[str] = []
    apps_failed: list[str] = []
    attempt_ids: list[str] = []
    interrupted = False
    attempted = False
    pending_any = False
    unsupported_any = False
    acked_apps: set[str] = set()
    attempted_apps: list[str] = []

    # §10.3.B.5 — account for every admitted attempt before restoring.
    account_live_attempts(ctx, bound_sec=accounting_bound_sec)

    def finalize(*, early_message: str | None = None, early_class: str | None = None) -> RestoreResult:
        try:
            entries = ctx.journal.entries()
        except VaultStateError as exc:
            ctx.latch(reasons=[exc.code])
            entries = []
        run_entries = [e for e in entries if e.get("run_id") == ctx.run_id]
        restore_entries = [e for e in run_entries if e.get("op") == OP_RESTORE]
        unresolved_any = any(entry_is_unresolved(e) for e in entries)
        commands_acked = (
            attempted
            and not unresolved_any
            and bool(restore_entries)
            and all(e.get("phase") == FATE_ACKED for e in restore_entries)
            and set(attempted_apps) <= acked_apps
        )
        snapshot_matched = attempted and not apps_failed and set(attempted_apps) == set(apps_restored)
        latched = ctx.is_latched()
        # F5 boundary: no proof provider exists in this bundle. Not a parameter.
        fence_proof = FENCE_PROOF_NONE
        proven = fence_proof != FENCE_PROOF_NONE
        ok = bool(proven and commands_acked and snapshot_matched and not latched and not apps_failed)
        if latched:
            result_class = RESULT_UNKNOWN_PENDING_OVERLAY
            message = "command fate uncertain; UNKNOWN_PENDING_OVERLAY latched; recovery material retained"
        elif early_class is not None:
            result_class = early_class
            message = early_message or early_class
        elif pending_any and not attempted:
            result_class = RESULT_PENDING_HMAC
            message = "HMAC ABSENT→EMPTY named exception is not authorized; vault preserved"
        elif unsupported_any:
            result_class = RESULT_UNSUPPORTED_ABSENT_RESTORE
            message = "UNSUPPORTED_ABSENT_RESTORE; vault preserved; remaining apps attempted"
        elif interrupted:
            result_class = RESULT_RESTORE_INTERRUPTED
            message = "restore interrupted; vault preserved; remaining apps attempted"
        elif not commands_acked or not snapshot_matched or apps_failed:
            result_class = RESULT_RESTORE_FAILED
            message = "overlay restore mismatch or partial failure; vault preserved"
        elif ok:
            result_class = RESULT_RESTORED_PROVEN
            message = "overlay restore proven"
        else:
            result_class = RESULT_ATTEMPTED_ACKED_MATCHED_UNPROVEN
            message = (
                "restore clients acked and dual-field snapshot matched (evidence only); "
                "no F1-F4 proof; restoration not claimed; recovery material retained"
            )
        result = RestoreResult(
            ok=ok,
            matched=snapshot_matched,
            pending_hmac_authorization=pending_any,
            preserved_vault=not ok,
            compared=compared_all,
            message=message,
            apps_restored=apps_restored,
            apps_failed=apps_failed,
            interrupted=interrupted,
            attempted=attempted,
            result_class=result_class,
            unknown_pending_overlay=latched,
            snapshot_matched=snapshot_matched,
            commands_acked=commands_acked,
            attempts=attempt_ids,
            fence_proof=fence_proof,
            run_id=ctx.run_id,
            latch_reasons=list(ctx.latch_reasons),
        )
        try:
            write_restore_result(vault_dir, _result_payload(result))
        except VaultStateError as exc:
            result.message = f"{result.message}; RESULT_WRITE_FAILED:{exc.code}"
        if result.ok:
            # Unreachable without proof; kept so the gate is structural.
            for app in apps_restored:
                clear_pending_app(vault_dir, app)
        return result

    shared_desired: dict[str, str] = {}
    shared_refuse = None
    shared_meta = os.path.join(vault_dir, "metadata.json")
    if os.path.isfile(shared_meta):
        shared_desired, shared_refuse = desired_env_for_restore(
            vault_dir, hmac_absent_empty_authorized
        )
        if shared_refuse == "PENDING_HMAC":
            pending_any = True
            return finalize(
                early_class=RESULT_PENDING_HMAC,
                early_message="HMAC ABSENT→EMPTY named exception is not authorized; vault preserved",
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
            attempted_apps.append(app)
            attempt = dispatch_restart(pm2, app, payload, ctx, op=OP_RESTORE, owner_token=token)
            attempt_ids.append(attempt.attempt_id)
            acked_apps.add(app)
            try:
                top, nested = pm2.dump_env_dual(app)
            except OverlayError as exc:
                ctx.latch(apps=[app], reasons=[f"SNAPSHOT_READ_FAILED:{exc.code}"])
                apps_failed.append(app)
                compared_all[app] = {"error": exc.code}
                continue
            except Exception as exc:
                ctx.latch(apps=[app], reasons=[f"SNAPSHOT_READ_FAILED:{type(exc).__name__}"])
                apps_failed.append(app)
                compared_all[app] = {"error": type(exc).__name__}
                continue
            metadata = load_app_metadata(vault_dir, app)
            matched_app, compared, divergent = compare_restore_dual(
                metadata, top, nested, hmac_absent_empty_authorized
            )
            for name, entry in var_entries(metadata).items():
                if entry.get("secret") and entry.get("state") == "SET":
                    expected = load_protected(vault_dir, name, app=app)
                    if top.get(name) != expected or nested.get(name) != expected:
                        matched_app = False
                        compared[name] = {"expected": "SET_EXACT", "actual": "MISMATCH"}
            compared_all[app] = {k: f"{v.get('expected')}->{v.get('actual')}" for k, v in compared.items()}
            if divergent:
                ctx.latch(apps=[app], keys=list(divergent), reasons=["DIVERGENT"])
            if matched_app and not divergent:
                apps_restored.append(app)
            else:
                apps_failed.append(app)
        except KeyboardInterrupt:
            interrupted = True
            apps_failed.append(app)
            continue
        except OverlayError as exc:
            apps_failed.append(app)
            compared_all[app] = {"error": exc.code}
            continue
        except Exception as exc:
            apps_failed.append(app)
            compared_all[app] = {"error": f"{type(exc).__name__}"}
            continue

    return finalize()
