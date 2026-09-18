"""Separate submitter completion from execution terminal status.

ACK_UNKNOWN, timeout, or killed submitter must not start terminal+5s.
Read-only reconcile uses recorded execution/request IDs only. Never resubmit.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

EXIT_SUCCESS = 0
EXIT_FAILURE = 1
EXIT_REFUSED = 2
EXIT_INCOMPLETE = 3
EXIT_ACK_UNKNOWN = 4
EXIT_TIMEOUT = 5
EXIT_CLEANUP_INCOMPLETE = 6

TERMINAL_JOB_STATES = frozenset({"completed", "failed"})
TERMINAL_LEDGER = frozenset({"completed", "failed"})


class ReconcileError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class RecordedIds:
    execution_id: str | None = None
    request_id: str | None = None
    job_id: str | None = None
    user_id: str | None = None
    which: str = ""


@dataclass
class SubmitterOutcome:
    exit_code: int | None
    killed: bool
    timed_out: bool
    identity_failed: bool
    stdout: str
    stderr: str
    ids: RecordedIds = field(default_factory=RecordedIds)


@dataclass
class TerminalDecision:
    submitter_completed: bool
    execution_terminal: bool
    start_capture_tail: bool
    require_reconcile: bool
    prohibit_next_canary: bool
    classification: str
    reason: str
    ids: RecordedIds
    timed_out: bool = False
    killed: bool = False


def is_uuid(value: str | None) -> bool:
    return bool(value) and bool(UUID_RE.match(value or ""))


def parse_json_events(text: str) -> list[dict[str, Any]]:
    events = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            start = line.find("{")
            end = line.rfind("}")
            if start == -1 or end <= start:
                continue
            try:
                obj = json.loads(line[start : end + 1])
            except json.JSONDecodeError:
                continue
        if isinstance(obj, dict):
            events.append(obj)
    return events


def extract_recorded_ids(stdout: str, stderr: str, which: str) -> RecordedIds:
    ids = RecordedIds(which=which)
    for obj in parse_json_events(stdout + "\n" + stderr):
        event = obj.get("event")
        if event in ("stub_identifiers_recorded", "stub_enqueued", "stub_canary_result"):
            if isinstance(obj.get("executionId"), str):
                ids.execution_id = obj["executionId"]
            if isinstance(obj.get("jobId"), str):
                ids.job_id = obj["jobId"]
        if event in ("xai_identifiers_recorded", "xai_accepted", "xai_canary_result"):
            if isinstance(obj.get("requestId"), str):
                ids.request_id = obj["requestId"]
            if isinstance(obj.get("executionId"), str):
                ids.execution_id = obj["executionId"]
        if isinstance(obj.get("executionId"), str) and is_uuid(obj["executionId"]):
            ids.execution_id = ids.execution_id or obj["executionId"]
        if isinstance(obj.get("requestId"), str) and is_uuid(obj["requestId"]):
            ids.request_id = ids.request_id or obj["requestId"]
        if isinstance(obj.get("jobId"), str):
            ids.job_id = ids.job_id or obj["jobId"]
    return ids


def _result_terminal(events: list[dict[str, Any]], which: str = "") -> bool:
    for obj in events:
        event = obj.get("event")
        outcome = obj.get("outcome")
        if which == "xai" or event == "xai_canary_result":
            if outcome in ("EXPECTED_XAI_REJECTION", "UNEXPECTED_ROUTING_RESULT"):
                return True
        if which == "stub" or event == "stub_canary_result":
            job_state = obj.get("jobState")
            ledger = obj.get("executionStatus") or obj.get("execution_status")
            if outcome in ("completed", "failed") and obj.get("proofAccepted") in (
                "accepted",
                "rejected",
            ):
                return True
            if job_state == "missing" and (
                ledger in TERMINAL_LEDGER or outcome == "completed"
            ):
                return True
        job_state = obj.get("jobState")
        ledger = obj.get("executionStatus") or obj.get("execution_status")
        if job_state in TERMINAL_JOB_STATES:
            return True
        if ledger in TERMINAL_LEDGER:
            return True
        nested = obj.get("ledger")
        if isinstance(nested, dict) and nested.get("executionStatus") in TERMINAL_LEDGER:
            return True
    return False


def decide_terminal(outcome: SubmitterOutcome) -> TerminalDecision:
    ids = outcome.ids
    events = parse_json_events(outcome.stdout + "\n" + outcome.stderr)
    submitter_completed = (
        outcome.exit_code is not None and not outcome.killed and not outcome.timed_out
    )
    if outcome.identity_failed:
        return TerminalDecision(
            submitter_completed=False,
            execution_terminal=False,
            start_capture_tail=False,
            require_reconcile=True,
            prohibit_next_canary=True,
            classification="INCOMPLETE",
            reason="SUBMITTER_IDENTITY_FAILED",
            ids=ids,
        )
    if outcome.killed:
        return TerminalDecision(
            submitter_completed=False,
            execution_terminal=False,
            start_capture_tail=False,
            require_reconcile=True,
            prohibit_next_canary=True,
            classification="INCOMPLETE",
            reason="SUBMITTER_KILLED",
            ids=ids,
        )
    if outcome.timed_out or outcome.exit_code == EXIT_TIMEOUT:
        return TerminalDecision(
            submitter_completed=False,
            execution_terminal=False,
            start_capture_tail=False,
            require_reconcile=True,
            prohibit_next_canary=True,
            classification="INCOMPLETE",
            reason="SUBMITTER_TIMEOUT",
            ids=ids,
        )
    if outcome.exit_code == EXIT_ACK_UNKNOWN:
        return TerminalDecision(
            submitter_completed=True,
            execution_terminal=False,
            start_capture_tail=False,
            require_reconcile=True,
            prohibit_next_canary=True,
            classification="INCOMPLETE",
            reason="ACK_UNKNOWN",
            ids=ids,
        )
    if outcome.exit_code in (EXIT_REFUSED,):
        return TerminalDecision(
            submitter_completed=True,
            execution_terminal=False,
            start_capture_tail=False,
            require_reconcile=False,
            prohibit_next_canary=True,
            classification="INCOMPLETE",
            reason="SUBMITTER_REFUSED",
            ids=ids,
        )
    if _result_terminal(events, ids.which):
        return TerminalDecision(
            submitter_completed=submitter_completed,
            execution_terminal=True,
            start_capture_tail=True,
            require_reconcile=False,
            prohibit_next_canary=False,
            classification="TERMINAL",
            reason="LEDGER_OR_JOB_TERMINAL",
            ids=ids,
        )
    # Submitter exited but execution terminal was not established.
    return TerminalDecision(
        submitter_completed=submitter_completed,
        execution_terminal=False,
        start_capture_tail=False,
        require_reconcile=True,
        prohibit_next_canary=True,
        classification="INCOMPLETE",
        reason="EXECUTION_TERMINAL_NOT_ESTABLISHED",
        ids=ids,
    )


def build_reconcile_env(
    base: Mapping[str, str],
    ids: RecordedIds,
    which: str,
) -> dict[str, str]:
    """Build env for accepted-script RECONCILE mode. Never sets LIVE_SUBMIT.

    Missing AISB_01C6A_STAGING_EXECUTION_AUTHORIZED is left unset (unauthorized).
    It is never defaulted to YES.
    """
    env = {k: v for k, v in base.items() if k != "AISB_01C6A_LIVE_SUBMIT"}
    env.pop("AISB_01C6A_ISOLATED_MOCK", None)
    env["AISB_01C6A_RECONCILE"] = "YES"
    # Copy authorization only when present. Do not invent YES.
    if "AISB_01C6A_STAGING_EXECUTION_AUTHORIZED" in base:
        env["AISB_01C6A_STAGING_EXECUTION_AUTHORIZED"] = base["AISB_01C6A_STAGING_EXECUTION_AUTHORIZED"]
    else:
        env.pop("AISB_01C6A_STAGING_EXECUTION_AUTHORIZED", None)
    if which == "stub":
        if not is_uuid(ids.execution_id):
            raise ReconcileError(
                "MISSING_EXECUTION_ID",
                "stub reconcile requires recorded AISB_01C6A_RECONCILE_EXECUTION_ID; do not resubmit",
            )
        env["AISB_01C6A_RECONCILE_EXECUTION_ID"] = ids.execution_id  # type: ignore[assignment]
        if ids.job_id:
            env["AISB_01C6A_RECONCILE_JOB_ID"] = ids.job_id
    elif which == "xai":
        if ids.execution_id and is_uuid(ids.execution_id):
            env["AISB_01C6A_RECONCILE_EXECUTION_ID"] = ids.execution_id
        if ids.request_id and is_uuid(ids.request_id):
            env["AISB_01C6A_IDEMPOTENCY_KEY"] = ids.request_id
        if not env.get("AISB_01C6A_RECONCILE_EXECUTION_ID") and not env.get("AISB_01C6A_IDEMPOTENCY_KEY"):
            raise ReconcileError(
                "MISSING_REQUEST_OR_EXECUTION_ID",
                "xAI reconcile requires recorded requestId and/or executionId; do not POST again",
            )
    else:
        raise ReconcileError("UNKNOWN_WHICH", which)
    if "AISB_01C6A_LIVE_SUBMIT" in env:
        raise ReconcileError("SUBMISSION_AMBIGUITY", "LIVE_SUBMIT must not be set with RECONCILE")
    return env


def classify_reconcile_result(
    exit_code: int | None,
    stdout: str,
    stderr: str,
    timed_out: bool,
    killed: bool,
) -> TerminalDecision:
    ids = extract_recorded_ids(stdout, stderr, "")
    if timed_out:
        return TerminalDecision(
            submitter_completed=False,
            execution_terminal=False,
            start_capture_tail=False,
            require_reconcile=False,
            prohibit_next_canary=True,
            classification="INCOMPLETE",
            reason="RECONCILE_BOUND_EXPIRED",
            ids=ids,
            timed_out=True,
            killed=killed,
        )
    if killed:
        return TerminalDecision(
            submitter_completed=False,
            execution_terminal=False,
            start_capture_tail=False,
            require_reconcile=False,
            prohibit_next_canary=True,
            classification="INCOMPLETE",
            reason="RECONCILE_KILLED",
            ids=ids,
            timed_out=False,
            killed=True,
        )
    outcome = SubmitterOutcome(
        exit_code=exit_code,
        killed=killed,
        timed_out=timed_out,
        identity_failed=False,
        stdout=stdout,
        stderr=stderr,
        ids=ids,
    )
    decision = decide_terminal(outcome)
    if decision.execution_terminal:
        return TerminalDecision(
            submitter_completed=True,
            execution_terminal=True,
            start_capture_tail=True,
            require_reconcile=False,
            prohibit_next_canary=True,
            classification="TERMINAL_VIA_RECONCILE",
            reason="RECONCILE_ESTABLISHED_TERMINAL",
            ids=ids,
            timed_out=False,
            killed=False,
        )
    return TerminalDecision(
        submitter_completed=True,
        execution_terminal=False,
        start_capture_tail=False,
        require_reconcile=False,
        prohibit_next_canary=True,
        classification="INCOMPLETE",
        reason="RECONCILE_TERMINAL_NOT_ESTABLISHED",
        ids=ids,
        timed_out=False,
        killed=False,
    )


ReconcileRunner = Callable[[dict[str, str], int], tuple[int, str, str, bool, bool]]


def run_readonly_reconcile(
    which: str,
    ids: RecordedIds,
    base_env: Mapping[str, str],
    timeout_ms: int,
    runner: ReconcileRunner,
) -> TerminalDecision:
    """Invoke accepted-script RECONCILE via injected runner. Never resubmits."""
    env = build_reconcile_env(base_env, ids, which)
    if env.get("AISB_01C6A_LIVE_SUBMIT"):
        raise ReconcileError("SUBMISSION_AMBIGUITY", "runner env still has LIVE_SUBMIT")
    exit_code, stdout, stderr, timed_out, killed = runner(env, timeout_ms)
    return classify_reconcile_result(exit_code, stdout, stderr, timed_out, killed)


def maybe_write_reconcile_env_file(env: Mapping[str, str]) -> None:
    """Refuse credential-bearing env files. If a path is required, it must be in the vault."""
    from secret_io import is_secret_name, secure_create_file

    path = env.get("AISB_01C6A_RECONCILE_ENV_PATH")
    if not path:
        return
    vault = env.get("AISB_01C6A_VAULT_DIR")
    if not vault:
        raise ReconcileError("ENV_FILE_NOT_IN_VAULT", "reconcile env path requires AISB_01C6A_VAULT_DIR")
    abs_path = os.path.abspath(path)
    abs_vault = os.path.abspath(vault)
    try:
        common = os.path.commonpath([abs_path, abs_vault])
    except ValueError as exc:
        raise ReconcileError("ENV_FILE_NOT_IN_VAULT", "reconcile env path is not in the vault") from exc
    if common != abs_vault:
        raise ReconcileError("ENV_FILE_NOT_IN_VAULT", "reconcile env path must stay inside the vault")
    secret_keys = [k for k in env if is_secret_name(k) and env.get(k)]
    if secret_keys:
        raise ReconcileError(
            "REFUSE_SECRET_ENV_FILE",
            "will not write a credential-bearing reconcile env file",
        )
    lines = []
    for key in sorted(env):
        if not key.startswith("AISB_01C6A_"):
            continue
        if is_secret_name(key):
            continue
        lines.append("%s=%s" % (key, env[key]))
    secure_create_file(abs_path, "\n".join(lines) + "\n", mode=0o600)


def make_observer_runner(js: str, node: str, log_dir: str | None = None):
    import sys as sys_mod

    def runner(env: dict[str, str], timeout_ms: int) -> tuple[int, str, str, bool, bool]:
        from supervise import LinuxProc, supervise

        if str(js).endswith(".py") or str(node).endswith(".py"):
            argv = [sys_mod.executable, js]
            expected_node = sys_mod.executable
        else:
            argv = [node, js]
            expected_node = node
        proc = LinuxProc(log_dir=log_dir or env.get("AISB_01C6A_PROC_LOG_DIR"))
        result = supervise(
            argv=argv,
            env=env,
            timeout_ms=timeout_ms,
            expected_js=js,
            expected_node=expected_node,
            proc=proc,
        )
        code = result.exit_code if result.exit_code is not None else 1
        return code, result.stdout, result.stderr, result.timed_out, result.killed

    return runner


def main(argv: list[str] | None = None) -> int:
    import argparse
    import json as json_mod
    import sys

    from config_deadlines import reconcile_timeout_ms
    from secret_io import (
        AuthorizationError,
        collect_secret_needles,
        live_capable_adapters,
        live_capable_node,
        redact_text,
        require_explicit_live_authorization,
    )

    parser = argparse.ArgumentParser(description="Read-only reconcile observer")
    parser.add_argument("--prep", required=True)
    parser.add_argument("--which", required=True, choices=["stub", "xai"])
    parser.add_argument("--ids", required=True)
    parser.add_argument("--js", default="")
    args = parser.parse_args(argv)
    raw = json_mod.loads(open(args.ids, encoding="utf-8").read())
    ids = RecordedIds(
        execution_id=raw.get("execution_id"),
        request_id=raw.get("request_id"),
        job_id=raw.get("job_id"),
        which=args.which,
    )
    base = {k: v for k, v in os.environ.items() if v is not None}
    env = build_reconcile_env(base, ids, args.which)
    if env.get("AISB_01C6A_LIVE_SUBMIT"):
        raise ReconcileError("LIVE_SUBMIT_FORBIDDEN_ON_RECONCILE", "LIVE_SUBMIT must not be set")
    js = args.js or env.get("AISB_01C6A_RECONCILE_JS") or ""
    if not js:
        print("RECONCILE_JS_MISSING", file=sys.stderr)
        return 2
    node = env.get("NODE_BIN", "/usr/bin/node")
    try:
        if live_capable_adapters(env) or live_capable_node(env):
            require_explicit_live_authorization(env, what="reconcile observer")
        maybe_write_reconcile_env_file(env)
        timeout_ms = reconcile_timeout_ms(env)
        log_dir = env.get("AISB_01C6A_PROC_LOG_DIR")
        runner = make_observer_runner(js, node, log_dir=log_dir)
        decision = run_readonly_reconcile(args.which, ids, env, timeout_ms, runner)
    except AuthorizationError as exc:
        print("%s" % exc.code, file=sys.stderr)
        return 2
    except ReconcileError as exc:
        print("%s" % exc.code, file=sys.stderr)
        return 2
    needles = collect_secret_needles(env)
    print(
        "RECONCILE_DONE which=%s classification=%s reason=%s terminal=%s prohibit_next=%s execution_id=%s"
        % (
            args.which,
            decision.classification,
            decision.reason,
            int(decision.execution_terminal),
            int(decision.prohibit_next_canary),
            decision.ids.execution_id or ids.execution_id or "",
        )
    )
    _ = needles
    _ = redact_text
    if decision.classification == "INCOMPLETE":
        return 3
    return 0


if __name__ == "__main__":
    import sys as _sys

    _sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    raise SystemExit(main())

