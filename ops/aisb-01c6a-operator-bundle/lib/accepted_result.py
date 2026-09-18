"""Parse accepted canary-script JSON shapes. Terminal is not acceptance."""

from __future__ import annotations

from dataclasses import dataclass, field

from reconcile import (
    EXIT_CLEANUP_INCOMPLETE,
    EXIT_FAILURE,
    EXIT_SUCCESS,
    RecordedIds,
    parse_json_events,
)

STUB_INTENDED_OUTCOME = "completed"
XAI_INTENDED_OUTCOME = "EXPECTED_XAI_REJECTION"
STUB_RESULT_EVENT = "stub_canary_result"
XAI_RESULT_EVENT = "xai_canary_result"


@dataclass
class AcceptedScriptResult:
    which: str
    event: str | None = None
    outcome: str | None = None
    proof_accepted: str | None = None
    accounting_evidence: str | None = None
    job_state: str | None = None
    execution_status: str | None = None
    execution_id: str | None = None
    request_id: str | None = None
    job_id: str | None = None
    exit_code: int | None = None
    cleanup_complete: bool = True
    identity_match: bool = False
    intended_accepted: bool = False
    execution_terminal: bool = False
    provider_traffic_proof: str = "NOT_ESTABLISHED"
    reasons: list[str] = field(default_factory=list)


def cleanup_complete_from(exit_code: int | None, stderr: str) -> bool:
    if exit_code == EXIT_CLEANUP_INCOMPLETE:
        return False
    if "CLEANUP_INCOMPLETE" in (stderr or ""):
        return False
    if "shutdown_cleanup_incomplete" in (stderr or ""):
        return False
    return True


def parse_accepted_script_result(
    which: str,
    stdout: str,
    stderr: str,
    exit_code: int | None,
    recorded: RecordedIds | None = None,
) -> AcceptedScriptResult:
    events = parse_json_events((stdout or "") + "\n" + (stderr or ""))
    result = AcceptedScriptResult(which=which, exit_code=exit_code)
    result.cleanup_complete = cleanup_complete_from(exit_code, stderr)
    wanted = STUB_RESULT_EVENT if which == "stub" else XAI_RESULT_EVENT
    chosen: dict | None = None
    for obj in events:
        if obj.get("event") == wanted:
            chosen = obj
    if chosen is None:
        for obj in reversed(events):
            if "outcome" in obj and ("proofAccepted" in obj or "proof_accepted" in obj):
                chosen = obj
                break
    if chosen is None:
        result.reasons.append("ACCEPTED_SCRIPT_RESULT_MISSING")
        result.intended_accepted = False
        result.identity_match = False
        return result

    result.event = str(chosen.get("event") or "")
    result.outcome = chosen.get("outcome")
    result.proof_accepted = chosen.get("proofAccepted") or chosen.get("proof_accepted")
    result.accounting_evidence = chosen.get("accountingEvidence") or chosen.get("accounting_evidence")
    result.job_state = chosen.get("jobState") or chosen.get("job_state")
    result.execution_status = chosen.get("executionStatus") or chosen.get("execution_status")
    if isinstance(chosen.get("executionId"), str):
        result.execution_id = chosen["executionId"]
    if isinstance(chosen.get("requestId"), str):
        result.request_id = chosen["requestId"]
    if chosen.get("jobId") is not None:
        result.job_id = str(chosen["jobId"])
    result.provider_traffic_proof = str(
        chosen.get("providerTrafficProof") or chosen.get("provider_traffic_proof") or "NOT_ESTABLISHED"
    )

    if recorded is not None:
        if which == "stub":
            result.identity_match = bool(
                result.execution_id
                and recorded.execution_id
                and result.execution_id == recorded.execution_id
            )
        else:
            exec_ok = (not recorded.execution_id) or result.execution_id == recorded.execution_id
            req_ok = (not recorded.request_id) or result.request_id == recorded.request_id
            result.identity_match = bool(result.execution_id or result.request_id) and exec_ok and req_ok
    else:
        result.identity_match = bool(result.execution_id or result.request_id)

    job_state = (result.job_state or "").lower()
    exec_status = (result.execution_status or "").lower()
    if which == "xai":
        result.execution_terminal = result.outcome in (
            "EXPECTED_XAI_REJECTION",
            "UNEXPECTED_ROUTING_RESULT",
        )
    else:
        result.execution_terminal = job_state in ("completed", "failed") or exec_status in (
            "completed",
            "failed",
        )
        if not result.execution_terminal and result.outcome in ("completed", "failed"):
            if result.proof_accepted in ("accepted", "rejected"):
                result.execution_terminal = True
        if job_state == "missing" and exec_status in ("completed", "failed"):
            result.execution_terminal = True
        if job_state == "missing" and result.outcome == "completed" and result.proof_accepted == "accepted":
            result.execution_terminal = True

    if not result.cleanup_complete:
        result.reasons.append("CLEANUP_INCOMPLETE")
    if which == "stub":
        if result.outcome != STUB_INTENDED_OUTCOME:
            result.reasons.append("STUB_OUTCOME_NOT_COMPLETED")
        if result.proof_accepted != "accepted":
            result.reasons.append("STUB_PROOF_NOT_ACCEPTED")
        if result.accounting_evidence != "pass":
            result.reasons.append("STUB_ACCOUNTING_NOT_PASS")
        if exit_code not in (EXIT_SUCCESS,):
            result.reasons.append("STUB_EXIT_NOT_SUCCESS")
        result.intended_accepted = (
            result.event == STUB_RESULT_EVENT
            and result.outcome == STUB_INTENDED_OUTCOME
            and result.proof_accepted == "accepted"
            and result.accounting_evidence == "pass"
            and result.cleanup_complete
            and exit_code == EXIT_SUCCESS
            and result.identity_match
        )
    elif which == "xai":
        if result.outcome != XAI_INTENDED_OUTCOME:
            result.reasons.append("XAI_OUTCOME_NOT_EXPECTED_REJECTION")
        if result.proof_accepted != "accepted":
            result.reasons.append("XAI_PROOF_NOT_ACCEPTED")
        if exit_code not in (EXIT_SUCCESS,):
            result.reasons.append("XAI_EXIT_NOT_SUCCESS")
        result.intended_accepted = (
            result.event == XAI_RESULT_EVENT
            and result.outcome == XAI_INTENDED_OUTCOME
            and result.proof_accepted == "accepted"
            and result.cleanup_complete
            and exit_code == EXIT_SUCCESS
            and result.identity_match
        )
    else:
        result.reasons.append("UNKNOWN_WHICH")
        result.intended_accepted = False

    if result.outcome in ("failed", "incomplete", "timeout", "ack_unknown", "refused", "INCOMPLETE_OBSERVATIONS", "TIMEOUT", "REFUSED"):
        result.intended_accepted = False
    if exit_code in (EXIT_FAILURE, EXIT_CLEANUP_INCOMPLETE):
        if which == "stub" and result.outcome != STUB_INTENDED_OUTCOME:
            result.intended_accepted = False
        if exit_code == EXIT_CLEANUP_INCOMPLETE:
            result.intended_accepted = False
    return result


def allows_next_canary(
    which: str,
    accepted: AcceptedScriptResult,
    *,
    restore_ok: bool,
    overlays_restored: bool,
    network_independent: str,
) -> bool:
    if which != "stub":
        return False
    if not accepted.intended_accepted:
        return False
    if not restore_ok or not overlays_restored:
        return False
    if network_independent != "PASS":
        return False
    if accepted.outcome in ("failed", "incomplete", "timeout", "ack_unknown", "refused"):
        return False
    if not accepted.cleanup_complete:
        return False
    if accepted.accounting_evidence != "pass":
        return False
    if not accepted.identity_match:
        return False
    return True
