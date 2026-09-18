"""End-to-end operator orchestration with independent overlay restore."""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from accepted_result import AcceptedScriptResult, allows_next_canary, parse_accepted_script_result
from capture import (
    CaptureAdapter,
    CaptureHandle,
    CaptureStartError,
    CaptureStopResult,
    ENS5_FILTER,
    LO_FILTER,
    persist_handle,
    start_capture,
    stop_capture,
)
from config_deadlines import CAPTURE_TAIL_AFTER_TERMINAL_SEC, outer_timeout_ms, reconcile_timeout_ms
from coverage import CoverageReport, assess_coverage, coverage_from_env_files, read_optional_file
from network_evidence import classify_network
from overlay_restore import (
    FENCE_PROOF_NONE,
    OP_APPLY,
    RESULT_UNKNOWN_PENDING_OVERLAY,
    DispatchContext,
    OverlayError,
    OverlayWindowState,
    Pm2Adapter,
    RestoreResult,
    apply_overlay_payloads,
    assert_baseline_consistent,
    assert_payloads_restorable,
    assert_restore_feasible,
    build_overlay_payloads,
    dispatch_restart,
    dump_app_envs,
    normalize_restore_reserve_sec,
    restore_overlays,
    start_restore_watchdog,
    window_limits_from_env,
    write_baselines_from_dumps,
)
from pcap_flows import parse_pcap_flows
from reconcile import (
    RecordedIds,
    ReconcileError,
    SubmitterOutcome,
    decide_terminal,
    extract_recorded_ids,
    run_readonly_reconcile,
)
from supervise import ProcAdapter, supervise
from vault import (
    VaultRunLock,
    VaultStateError,
    delete_protected_recovery,
    mark_pending_apps,
    protected_recovery_present,
    refuse_unresolved_vault,
    unresolved_state_codes,
)


@dataclass
class OrchestrateResult:
    """Run outcome.

    ``restore_ok`` / ``overlays_restored`` are restoration-success claims and
    require an F1–F4 fence proof that this bundle cannot produce; they are
    always False in production (stage-start §10.3.A). ``commands_acked`` and
    ``snapshot_matched`` are evidence only.
    """

    classification: str
    next_canary_allowed: bool
    capture_tail_started: bool
    overlays_restored: bool
    vault_preserved: bool
    network_independent: str
    script_provider_traffic_proof: str
    reasons: list[str] = field(default_factory=list)
    restore_ok: bool = False
    accepted: AcceptedScriptResult | None = None
    result_class: str = "NOT_ATTEMPTED"
    unknown_pending_overlay: bool = False
    commands_acked: bool = False
    snapshot_matched: bool = False
    restore_attempts: list[str] = field(default_factory=list)
    run_id: str = ""
    fence_proof: str = FENCE_PROOF_NONE


def _write_json(path: str, obj: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


def _load_xai_addrs(path: str | None) -> set[str]:
    addrs: set[str] = set()
    if not path or not os.path.isfile(path):
        return addrs
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        addrs.add(line)
    return addrs


def observe_from_handles(
    handles: list[CaptureHandle],
    *,
    lifecycle_ok: bool,
    lifecycle_reason: str,
    xai_addrs: set[str],
    ss_before: set[str],
    route_coverage_ok: bool = True,
    resolver_coverage_ok: bool = True,
) -> Any:
    flows = []
    qnames = []
    unparsed = 0
    parse_complete = True
    coverage_reason = ""
    if not handles:
        parse_complete = False
        coverage_reason = "NO_CAPTURE_HANDLES"
    for h in handles:
        obs = parse_pcap_flows(h.pcap_path)
        if not obs.parse_complete:
            parse_complete = False
            coverage_reason = obs.message or "CAPTURE_PARSE_INCOMPLETE"
            unparsed += obs.unparsed
        flows.extend(obs.flows)
        qnames.extend(obs.dns_qnames)
        unparsed += 0 if obs.parse_complete else obs.unparsed
    return classify_network(
        capture_lifecycle_ok=lifecycle_ok,
        lifecycle_reason=lifecycle_reason,
        flows=flows,
        xai_addrs=xai_addrs,
        ss_before=ss_before,
        dns_qnames=qnames,
        coverage_complete=parse_complete,
        coverage_reason=coverage_reason,
        route_coverage_ok=route_coverage_ok,
        resolver_coverage_ok=resolver_coverage_ok,
    )


def _stop_all(
    handles: list[CaptureHandle],
    adapter: CaptureAdapter,
    tail_sec: float,
    *,
    now_ms: Callable[[], int] | None = None,
    sleep: Callable[[float], None] | None = None,
    remaining_sec: float | None = None,
    read_timeout_sec: float | None = None,
) -> tuple[bool, str, list[CaptureStopResult]]:
    stop_results: list[CaptureStopResult] = []
    lifecycle_ok = True
    lifecycle_reason = "OK"
    for h in handles:
        try:
            sr = stop_capture(
                h,
                adapter,
                tail_sec=tail_sec,
                now=now_ms,
                sleep=sleep,
                remaining_sec=remaining_sec,
                read_timeout_sec=read_timeout_sec,
            )
        except Exception as exc:
            sr = CaptureStopResult(False, type(exc).__name__, h, False, False, str(exc))
        stop_results.append(sr)
        persist_handle(h)
        if not sr.ok:
            lifecycle_ok = False
            lifecycle_reason = sr.code
    return lifecycle_ok, lifecycle_reason, stop_results


def orchestrate(
    *,
    which: str,
    workdir: str,
    vault_dir: str,
    submit_argv: list[str],
    submit_env: dict[str, str],
    expected_js: str,
    overlay_apps: list[str],
    captured_overlay: Mapping[str, str | None],
    pm2: Pm2Adapter,
    proc: ProcAdapter,
    capture_adapter: CaptureAdapter,
    exec_helper: str,
    resolv_conf: str,
    hmac_absent_empty_authorized: bool,
    reconcile_runner,
    apply_overlays: Callable[[], None] | None = None,
    delete_vault: Callable[[], None] | None = None,
    flows=None,
    xai_addrs: set[str] | None = None,
    ss_before: set[str] | None = None,
    dns_qnames=None,
    capture_tail_sec: float | None = None,
    xai_addrs_path: str | None = None,
    route_coverage_ok: bool = True,
    resolver_coverage_ok: bool | None = None,
    overlay_windows: OverlayWindowState | None = None,
    route_table: str = "",
    route_table_v6: str = "",
    evidence: Mapping[str, Any] | None = None,
    preflight: Mapping[str, Any] | str | None = None,
    coverage: CoverageReport | None = None,
    now: Callable[[], float] | None = None,
    sleep: Callable[[float], None] | None = None,
) -> OrchestrateResult:
    os.makedirs(workdir, exist_ok=True)
    next_allowed = False
    tail_started = False
    handles: list[CaptureHandle] = []
    reasons: list[str] = []
    if flows is not None:
        reasons.append("CALLER_FLOWS_IGNORED")
    if dns_qnames is not None:
        reasons.append("CALLER_DNS_IGNORED")
    network_independent = "INCOMPLETE"
    restore_ok = False
    vault_preserved = True
    overlays_restored = False
    accepted: AcceptedScriptResult | None = None
    known_xai = set(xai_addrs or ())
    known_xai |= _load_xai_addrs(xai_addrs_path)
    ss_set = set(ss_before or ())
    if delete_vault is None:
        # Default deletion path passes the restore result so the vault-side
        # gate (RESTORE_UNPROVEN / UNKNOWN_LATCHED) is enforced.
        delete_vault_fn = lambda res: delete_protected_recovery(vault_dir, proven_result=res)
    else:
        delete_vault_fn = lambda res: delete_vault()
    gateway_app = overlay_apps[0] if overlay_apps else ""
    worker_app = overlay_apps[1] if len(overlay_apps) > 1 else (overlay_apps[0] if overlay_apps else "")
    mutated_apps = list(overlay_apps)
    windows = overlay_windows
    overlay_applied = False
    apply_fn = apply_overlays
    clock = now or time.monotonic
    sleeper = sleep or time.sleep
    now_ms = lambda: int(clock() * 1000)
    # Coordination context (§10.3.B): ownership, admission, journal, latch.
    os.makedirs(vault_dir, exist_ok=True)
    ctx = DispatchContext(vault_dir)
    restore_pub: dict[str, Any] = {"result": None, "in_flight": False, "done": threading.Event()}
    restore_result: RestoreResult | None = None
    run_lock = VaultRunLock(vault_dir)
    watch_stop = threading.Event()
    watch_thread: threading.Thread | None = None

    def _synthetic_unknown(message: str) -> RestoreResult:
        return RestoreResult(
            ok=False,
            matched=False,
            pending_hmac_authorization=False,
            preserved_vault=True,
            message=message,
            result_class=RESULT_UNKNOWN_PENDING_OVERLAY,
            unknown_pending_overlay=True,
            run_id=ctx.run_id,
            latch_reasons=list(ctx.latch_reasons),
        )

    def restore_always() -> RestoreResult:
        nonlocal restore_ok, vault_preserved, overlays_restored, restore_result
        wait_for = False
        with ctx.restore_lock:
            if ctx.started:
                existing = restore_pub["result"]
                if existing is not None:
                    return existing
                wait_for = bool(restore_pub["in_flight"])
                if not wait_for:
                    # Owner finished without publishing: never re-run restore.
                    return _synthetic_unknown("restore owner published no result")
            else:
                ctx.take_ownership_locked()
                restore_pub["in_flight"] = True
        if wait_for:
            restore_pub["done"].wait(timeout=120)
            existing = restore_pub["result"]
            if existing is not None:
                return existing
            return _synthetic_unknown("restore owner did not publish a result")
        apps = mutated_apps or overlay_apps
        try:
            try:
                result = restore_overlays(
                    vault_dir,
                    apps,
                    pm2,
                    hmac_absent_empty_authorized=hmac_absent_empty_authorized,
                    ctx=ctx,
                    run_lock=run_lock if run_lock.held else None,
                    accounting_bound_sec=windows.restore_reserve_sec if windows is not None else None,
                )
            except BaseException as exc:  # noqa: BLE001 - never propagate to the watchdog thread
                ctx.latch(apps=list(apps), reasons=[f"RESTORE_EXCEPTION:{type(exc).__name__}"])
                result = _synthetic_unknown(f"restore raised {type(exc).__name__}; UNKNOWN latched; vault preserved")
            restore_ok = result.ok
            overlays_restored = result.ok
            due = windows.restore_due(clock()) if windows is not None else None
            if result.ok and due is None and not ctx.is_latched() and not unresolved_state_codes(vault_dir):
                # Requires a proven restore (unreachable in this bundle).
                try:
                    delete_vault_fn(result)
                except VaultStateError as exc:
                    reasons.append(exc.code)
            vault_preserved = protected_recovery_present(vault_dir)
            restore_result = result
            restore_pub["result"] = result
            return result
        finally:
            restore_pub["in_flight"] = False
            restore_pub["done"].set()

    def finish(
        classification: str,
        *,
        next_canary: bool,
        tail: bool,
        net: str,
        extra: list[str] | None = None,
    ) -> OrchestrateResult:
        watch_stop.set()
        if watch_thread is not None:
            watch_thread.join(timeout=2.0)
        if extra:
            reasons.extend(extra)
        rr = restore_result
        latched = bool(rr.unknown_pending_overlay) if rr is not None else (ctx.latched or (overlay_applied and ctx.is_latched()))
        if latched and "UNKNOWN_PENDING_OVERLAY" not in reasons:
            reasons.append("UNKNOWN_PENDING_OVERLAY")
        run_lock.release()
        return OrchestrateResult(
            classification=classification,
            next_canary_allowed=next_canary,
            capture_tail_started=tail,
            overlays_restored=overlays_restored,
            vault_preserved=vault_preserved,
            network_independent=net,
            script_provider_traffic_proof="NOT_ESTABLISHED",
            reasons=list(reasons),
            restore_ok=restore_ok,
            accepted=accepted,
            result_class=rr.result_class if rr is not None else ("UNKNOWN_PENDING_OVERLAY" if latched else "NOT_ATTEMPTED"),
            unknown_pending_overlay=latched,
            commands_acked=bool(rr.commands_acked) if rr is not None else False,
            snapshot_matched=bool(rr.snapshot_matched) if rr is not None else False,
            restore_attempts=list(rr.attempts) if rr is not None else [],
            run_id=ctx.run_id,
            fence_proof=FENCE_PROOF_NONE,
        )

    def window_due() -> str | None:
        if windows is None:
            return None
        return windows.restore_due(clock())

    def remaining_work() -> float | None:
        if windows is None:
            return None
        value = windows.remaining_work_sec(clock())
        if value is None:
            return None
        return value

    def stop_handles(target: list[CaptureHandle], tail: float) -> tuple[bool, str, list[CaptureStopResult]]:
        rem = remaining_work()
        if rem is not None:
            rem = max(0.0, rem)
        return _stop_all(
            target,
            capture_adapter,
            tail,
            now_ms=now_ms,
            sleep=sleeper,
            remaining_sec=rem,
        )

    def abort_window(code: str) -> OrchestrateResult:
        reasons.append(code)
        if overlay_applied:
            restore_always()
        stop_handles(handles, 0)
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")

    # Cross-process exclusion first (§10.3.C): a competing run on the same
    # vault performs no mutation at all.
    try:
        run_lock.acquire()
    except VaultStateError as exc:
        reasons.append(exc.code)
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")

    try:
        refuse_unresolved_vault(vault_dir)
    except VaultStateError as exc:
        for code in exc.codes:
            if code not in reasons:
                reasons.append(code)
        if "UNRESOLVED_VAULT_EXISTS" not in reasons and exc.codes:
            reasons.append("UNRESOLVED_VAULT_EXISTS")
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
    except Exception:
        reasons.append("UNRESOLVED_VAULT_EXISTS")
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")

    cov = coverage
    if cov is None:
        if route_coverage_ok is False:
            cov = CoverageReport(
                ok=False,
                code="ROUTE_COVERAGE_MISSING",
                route_ok=False,
                resolver_ok=False,
                loopback_required=False,
                reasons=["ROUTE_COVERAGE_MISSING"],
                source="flag",
            )
        elif resolver_coverage_ok is False:
            cov = CoverageReport(
                ok=False,
                code="RESOLVER_COVERAGE_MISSING",
                route_ok=False,
                resolver_ok=False,
                loopback_required=False,
                reasons=["RESOLVER_COVERAGE_MISSING"],
                source="flag",
            )
        else:
            cov = assess_coverage(
                resolv_conf=resolv_conf,
                route_table=route_table,
                route_table_v6=route_table_v6,
                evidence=evidence,
                preflight=preflight,
            )
    if not cov.ok:
        reasons.append(cov.code)
        for item in cov.reasons:
            if item not in reasons:
                reasons.append(item)
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
    route_ok = cov.route_ok
    resolver_ok = cov.resolver_ok

    try:
        dumps = dump_app_envs(overlay_apps, pm2)
        if apply_fn is None:
            payloads = build_overlay_payloads(which, dumps, submit_env, gateway_app, worker_app)
            mutated_apps = [app for app, payload in payloads.items() if payload]
            assert_payloads_restorable(dumps, payloads, hmac_absent_empty_authorized)
            # §4.8 pre-mutation guard: named keys must agree in pm2_env and
            # pm2_env.env before the first mutation.
            named_keys = sorted({k for payload in payloads.values() for k in payload})
            assert_baseline_consistent(pm2, mutated_apps, named_keys)
            for app, payload in payloads.items():
                if not payload:
                    continue
                observed = dumps.get(app) or {}
                baseline = {name: (observed[name] if name in observed else None) for name in payload}
                try:
                    from vault import write_app_vault

                    write_app_vault(vault_dir, app, baseline)
                except OverlayError:
                    raise
                except Exception as exc:
                    raise OverlayError("BASELINE_VAULT_WRITE_FAILED", f"{app}: {type(exc).__name__}") from exc

            def driver_apply() -> None:
                # Each app passes through the journaled admission path; a
                # restore starting between two apps refuses the second before
                # spawn (OVERLAY_AFTER_RESTORE) and an uncertain fate latches.
                for app, payload in payloads.items():
                    if ctx.started:
                        return
                    if payload:
                        try:
                            dispatch_restart(pm2, app, payload, ctx, op=OP_APPLY)
                        except OverlayError as exc:
                            if exc.code == "OVERLAY_AFTER_RESTORE":
                                return
                            raise

            apply_fn = driver_apply
        else:
            write_baselines_from_dumps(vault_dir, overlay_apps, dumps, captured_overlay)
            assert_restore_feasible(vault_dir, overlay_apps, hmac_absent_empty_authorized)
            assert_baseline_consistent(pm2, overlay_apps, list(captured_overlay))
    except OverlayError as exc:
        reasons.append(exc.code)
        vault_preserved = protected_recovery_present(vault_dir) or True
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
    except Exception as exc:
        reasons.append(f"BASELINE_CAPTURE_FAILED:{type(exc).__name__}")
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")

    try:
        mark_pending_apps(vault_dir, mutated_apps or overlay_apps)
    except (OSError, VaultStateError) as exc:
        reasons.append(f"PENDING_MARK_WRITE_FAILED:{type(exc).__name__}")
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
    if windows is not None:
        windows.arm_apps(list(mutated_apps or overlay_apps), clock())
    overlay_applied = True
    orig_restart = pm2.restart_update_env
    ctx.orig_restart = orig_restart

    def gated_restart(app: str, envmap: Mapping[str, str | None], **kw: Any) -> None:
        """Every restart on this adapter object is a journaled, admission-gated
        attempt. Apply callers hold no owner token; only the restore owner's
        dispatches (which call ``ctx.orig_restart`` directly) bypass this
        wrapper. The shared ``in_restore`` flag no longer exists (§4.6)."""
        dispatch_restart(pm2, app, envmap, ctx, op=OP_APPLY, owner_token=None)

    pm2.restart_update_env = gated_restart  # type: ignore[method-assign]

    def on_window_due(_code: str) -> None:
        if overlay_applied:
            restore_always()

    if windows is not None:
        watch_thread = start_restore_watchdog(
            windows,
            clock=clock,
            on_due=on_window_due,
            stop=watch_stop,
        )
    try:
        if ctx.started:
            return abort_window(window_due() or "WORKER_WINDOW_EXCEEDED")
        try:
            apply_fn()
        except OverlayError as exc:
            if exc.code == "OVERLAY_AFTER_RESTORE" and ctx.started:
                return abort_window(window_due() or "WORKER_WINDOW_EXCEEDED")
            raise
        if ctx.started:
            return abort_window(window_due() or "WORKER_WINDOW_EXCEEDED")
        expired = window_due()
        if expired:
            return abort_window(expired)
        handles.append(
            start_capture(
                name=f"{which}-ens5",
                iface="ens5",
                bpf=ENS5_FILTER,
                workdir=workdir,
                exec_helper=exec_helper,
                adapter=capture_adapter,
            )
        )
        if cov.loopback_required:
            handles.append(
                start_capture(
                    name=f"{which}-lo",
                    iface="lo",
                    bpf=LO_FILTER,
                    workdir=workdir,
                    exec_helper=exec_helper,
                    adapter=capture_adapter,
                )
            )
        if any(not h.listening for h in handles):
            reasons.append("CAPTURE_NOT_LISTENING")
            stop_handles(handles, 0)
            restore_always()
            return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")

        expired = window_due()
        if expired:
            return abort_window(expired)
        timeout_ms = outer_timeout_ms(submit_env)
        work = remaining_work()
        if work is not None:
            timeout_ms = min(timeout_ms, max(1, int(work * 1000)))
        sup = supervise(
            argv=submit_argv,
            env=submit_env,
            timeout_ms=timeout_ms,
            expected_js=expected_js,
            proc=proc,
            now=now_ms,
        )
        expired = window_due()
        if expired:
            return abort_window(expired)
        ids = extract_recorded_ids(sup.stdout, sup.stderr, which)
        accepted = parse_accepted_script_result(which, sup.stdout, sup.stderr, sup.exit_code, ids)
        reasons.extend(accepted.reasons)
        outcome = SubmitterOutcome(
            exit_code=sup.exit_code,
            killed=sup.killed,
            timed_out=sup.timed_out,
            identity_failed=sup.identity_failed,
            stdout=sup.stdout,
            stderr=sup.stderr,
            ids=ids,
        )
        decision = decide_terminal(outcome)
        reasons.append(decision.reason)

        if (not decision.execution_terminal) and decision.require_reconcile:
            expired = window_due()
            if expired:
                return abort_window(expired)
            rec_timeout = reconcile_timeout_ms(submit_env)
            work = remaining_work()
            if work is not None:
                rec_timeout = min(rec_timeout, max(1, int(work * 1000)))
            try:
                rec = run_readonly_reconcile(
                    which,
                    ids,
                    submit_env,
                    rec_timeout,
                    reconcile_runner,
                )
            except ReconcileError as exc:
                reasons.append(exc.code)
                stop_handles(handles, 0)
                restore_always()
                return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
            reasons.append(rec.reason)
            if rec.timed_out or rec.reason == "RECONCILE_BOUND_EXPIRED":
                stop_handles(handles, 0)
                restore_always()
                return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
            if rec.execution_terminal:
                decision = rec
            else:
                stop_handles(handles, 0)
                restore_always()
                return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
            expired = window_due()
            if expired:
                return abort_window(expired)

        if decision.start_capture_tail and decision.execution_terminal:
            tail_started = True
            sleep_sec = CAPTURE_TAIL_AFTER_TERMINAL_SEC if capture_tail_sec is None else capture_tail_sec
        else:
            sleep_sec = 0.0
            tail_started = False

        expired = window_due()
        if expired:
            tail_started = False
            return abort_window(expired)
        work = remaining_work()
        if work is not None and sleep_sec > work:
            sleep_sec = max(0.0, work)
        lifecycle_ok, lifecycle_reason, _stop_results = stop_handles(handles, sleep_sec)
        net = observe_from_handles(
            handles,
            lifecycle_ok=lifecycle_ok,
            lifecycle_reason=lifecycle_reason,
            xai_addrs=known_xai,
            ss_before=ss_set,
            route_coverage_ok=route_ok,
            resolver_coverage_ok=resolver_ok,
        )
        network_independent = net.independent_result
        reasons.extend(net.reasons)
        expired = window_due()
        rr = restore_always()
        if expired:
            reasons.append(expired)
            return finish("INCOMPLETE", next_canary=False, tail=tail_started, net=network_independent)
        late = window_due()
        if late:
            reasons.append(late)
            return finish("INCOMPLETE", next_canary=False, tail=tail_started, net=network_independent)
        if rr.result_class not in reasons:
            reasons.append(rr.result_class)
        # F5 boundary: ``restore_ok`` / ``overlays_restored`` are True only for
        # a proof-bearing restore, which no shipped path produces. Evidence
        # fields (commands_acked, snapshot_matched) never substitute for them.
        next_allowed = allows_next_canary(
            which,
            accepted,
            restore_ok=restore_ok,
            overlays_restored=overlays_restored,
            network_independent=network_independent,
        )
        # Terminal-rejection evidence is preserved separately from the run
        # classification: a terminal outcome the accepted-script parser did not
        # accept is recorded as a reason, never as a classification of its own.
        terminal_not_accepted = bool(accepted and not accepted.intended_accepted and decision.execution_terminal)
        if terminal_not_accepted and "TERMINAL_NOT_ACCEPTED" not in reasons:
            reasons.append("TERMINAL_NOT_ACCEPTED")
        if next_allowed:
            classification = "OBSERVATION_COMPLETE"
        elif (
            accepted
            and accepted.intended_accepted
            and network_independent == "PASS"
            and restore_ok
        ):
            classification = "OBSERVATION_COMPLETE"
        else:
            # §10.3.A.3: an unproven restoration (every shipped path, including
            # RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN) yields INCOMPLETE. The
            # historical TERMINAL_NOT_ACCEPTED classification is withdrawn: it
            # implied that the run itself had reached a terminal state, which
            # cannot be claimed while restoration is unproven.
            classification = "INCOMPLETE"
        return finish(
            classification,
            next_canary=next_allowed,
            tail=tail_started,
            net=network_independent,
        )
    except OverlayError as exc:
        reasons.append(exc.code)
        stop_handles(handles, 0)
        if overlay_applied:
            restore_always()
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
    except CaptureStartError as exc:
        reasons.append(exc.code)
        to_stop = list(handles)
        if exc.handle is not None and exc.handle not in to_stop:
            to_stop.append(exc.handle)
        stop_handles(to_stop, 0)
        if overlay_applied:
            restore_always()
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
    except KeyboardInterrupt:
        reasons.append("ORCHESTRATE_INTERRUPTED")
        stop_handles(handles, 0)
        if overlay_applied:
            restore_always()
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")
    except Exception as exc:
        reasons.append(f"ORCHESTRATE_ERROR:{type(exc).__name__}:{exc}")
        stop_handles(handles, 0)
        if overlay_applied:
            restore_always()
        return finish("INCOMPLETE", next_canary=False, tail=False, net="INCOMPLETE")


def _load_env_file(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def main(argv: list[str] | None = None) -> int:
    from linux_capture import LinuxCapture
    from overlay_restore import CliPm2
    from secret_io import (
        AuthorizationError,
        is_explicit_yes,
        live_capable_adapters,
        live_capable_node,
        redact_mapping,
        require_explicit_live_authorization,
    )
    from supervise import LinuxProc
    from reconcile import make_observer_runner

    parser = argparse.ArgumentParser(description="EXEC-01C6A operator orchestrator")
    parser.add_argument("--prep", required=True)
    parser.add_argument("--which", required=True, choices=["stub", "xai"])
    parser.add_argument("--workdir", required=True)
    parser.add_argument("--vault", required=True)
    parser.add_argument("--js", required=True)
    parser.add_argument("--envfile", default="")
    parser.add_argument("--resolv", default="")
    parser.add_argument("--routes", default="")
    parser.add_argument("--preflight", default="")
    args = parser.parse_args(argv)

    env = dict(os.environ)
    if args.envfile:
        env.update(_load_env_file(args.envfile))
    try:
        if live_capable_adapters(env) or live_capable_node(env):
            require_explicit_live_authorization(env, what="orchestrate live-capable adapters")
    except AuthorizationError as exc:
        print(exc.code, file=sys.stderr)
        return 2

    prep = args.prep
    node = env.get("NODE_BIN", "/usr/bin/node")
    pm2 = CliPm2(env.get("PM2_BIN", "pm2"))
    proc = LinuxProc(log_dir=os.path.join(args.workdir, "proc"))
    capture_adapter = LinuxCapture(
        sudo_bin=env.get("AISB_SUDO_BIN", "sudo"),
        python_bin=env.get("PYTHON3") or env.get("PYTHON") or sys.executable,
        exec_py=os.path.join(prep, "bin", "tcpdump-exec.py"),
    )
    overlay_apps = [
        env.get("GATEWAY_APP", "aisandbox-api-gateway"),
        env.get("WORKER_APP", "aisandbox-ai-service"),
    ]
    captured = {
        "AGENT_HARNESS_ENABLE_TOOL_LOOP": None,
        "HARNESS_ENTITLEMENT_HMAC_SECRET": None,
        "XAI_API_KEY": None,
        "GLOBAL_EXECUTION_ENABLED": env.get("AISB_01C6A_CAPTURED_GLOBAL_EXECUTION_ENABLED", "false"),
    }
    hmac_auth = is_explicit_yes(env.get("AISB_01C6A_HMAC_ABSENT_EMPTY_RESTORE_AUTHORIZED"))
    js = args.js
    try:
        worker_limit, gateway_limit = window_limits_from_env(env)
        windows = OverlayWindowState(
            worker_app=overlay_apps[1],
            gateway_app=overlay_apps[0],
            worker_limit_sec=worker_limit,
            gateway_limit_sec=gateway_limit,
            restore_reserve_sec=normalize_restore_reserve_sec(
                env.get("AISB_01C6A_RESTORE_RESERVE_SEC"),
                worker_limit,
                gateway_limit,
                n_apps=len(overlay_apps),
            ),
        )
    except OverlayError as exc:
        print(exc.code, file=sys.stderr)
        os.makedirs(args.workdir, exist_ok=True)
        _write_json(
            os.path.join(args.workdir, "orchestrate-result.json"),
            {"classification": "INCOMPLETE", "reasons": [exc.code], "next_canary_allowed": False},
        )
        print("ORCHESTRATE_DONE classification=INCOMPLETE next_canary_allowed=0 overlays_restored=0 network=INCOMPLETE")
        return 3

    resolv = ""
    if args.resolv and os.path.isfile(args.resolv):
        resolv = open(args.resolv, encoding="utf-8").read()
    route_text = read_optional_file(args.routes or env.get("AISB_01C6A_ROUTE_TABLE_FILE"))
    route_v6_text = read_optional_file(env.get("AISB_01C6A_ROUTE_TABLE_V6_FILE") or "")
    evidence_text = read_optional_file(env.get("AISB_01C6A_COVERAGE_EVIDENCE") or "")
    evidence_obj: dict[str, Any] | None = None
    if evidence_text.strip():
        try:
            parsed = json.loads(evidence_text)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, dict):
            evidence_obj = parsed
    preflight_text = read_optional_file(args.preflight or env.get("AISB_01C6A_PREFLIGHT_RECORD"))
    max_age = env.get("AISB_01C6A_PREFLIGHT_MAX_AGE_SEC")
    cov = coverage_from_env_files(
        resolv_conf=resolv,
        route_table_text=route_text,
        route_table_v6_text=route_v6_text,
        evidence_text=evidence_text,
        preflight_text=preflight_text,
        route_flag_yes=is_explicit_yes(env.get("AISB_01C6A_ROUTE_COVERAGE_OK")),
        max_age_sec=float(max_age) if max_age not in (None, "") else None,
    )
    runner = make_observer_runner(js, node, log_dir=os.path.join(args.workdir, "proc"))
    result = orchestrate(
        which=args.which,
        workdir=args.workdir,
        vault_dir=args.vault,
        submit_argv=[node, js],
        submit_env=env,
        expected_js=js,
        overlay_apps=overlay_apps,
        captured_overlay=captured,
        pm2=pm2,
        proc=proc,
        capture_adapter=capture_adapter,
        exec_helper=os.path.join(prep, "bin", "tcpdump-exec.py"),
        resolv_conf=resolv,
        hmac_absent_empty_authorized=hmac_auth,
        reconcile_runner=runner,
        apply_overlays=None,
        # delete_vault=None -> vault-side gate (requires a proven restore).
        delete_vault=None,
        xai_addrs_path=os.path.join(prep, "config", "xai-observation-addrs.txt"),
        coverage=cov,
        route_table=route_text,
        route_table_v6=route_v6_text,
        evidence=evidence_obj,
        preflight=preflight_text or None,
        overlay_windows=windows,
    )
    payload = {
        "classification": result.classification,
        "next_canary_allowed": result.next_canary_allowed,
        "capture_tail_started": result.capture_tail_started,
        "overlays_restored": result.overlays_restored,
        "vault_preserved": result.vault_preserved,
        "network_independent": result.network_independent,
        "script_provider_traffic_proof": result.script_provider_traffic_proof,
        "reasons": result.reasons,
        "restore_ok": result.restore_ok,
        # Evidence fields (never a restoration-success claim):
        "result_class": result.result_class,
        "unknown_pending_overlay": result.unknown_pending_overlay,
        "commands_acked": result.commands_acked,
        "snapshot_matched": result.snapshot_matched,
        "restore_attempts": result.restore_attempts,
        "run_id": result.run_id,
        "fence_proof": result.fence_proof,
    }
    out_path = os.path.join(args.workdir, "orchestrate-result.json")
    _write_json(out_path, redact_mapping(payload))
    print(
        "ORCHESTRATE_DONE classification=%s next_canary_allowed=%s overlays_restored=%s network=%s "
        "result_class=%s unknown_pending_overlay=%s commands_acked=%s snapshot_matched=%s"
        % (
            result.classification,
            int(result.next_canary_allowed),
            int(result.overlays_restored),
            result.network_independent,
            result.result_class,
            int(result.unknown_pending_overlay),
            int(result.commands_acked),
            int(result.snapshot_matched),
        )
    )
    if result.classification == "OBSERVATION_COMPLETE":
        return 0
    if result.classification == "INCOMPLETE":
        return 3
    return 1


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    raise SystemExit(main())
