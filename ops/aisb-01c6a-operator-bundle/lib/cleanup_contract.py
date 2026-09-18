"""Cleanup contract (2026-09-10 amendment). Operator enforcement, not AC change."""

from __future__ import annotations

from dataclasses import dataclass, field

BASELINE_FAILED_JOBS = (1, 2, 3)


@dataclass
class CleanupPlan:
    retain_usage_records: bool = True
    retain_zero_token_credit_rows: bool = True
    baseline_failed_jobs: tuple[int, ...] = BASELINE_FAILED_JOBS
    canary_failed_job_ids: list[str] = field(default_factory=list)
    canary_failed_job_removal_authorized: bool = False
    evidence_captured: bool = False
    session_ids: list[str] = field(default_factory=list)
    key_ids: list[str] = field(default_factory=list)


@dataclass
class CleanupAction:
    allowed: bool
    code: str
    message: str


def may_remove_canary_failed_job(plan: CleanupPlan, job_id: str | int) -> CleanupAction:
    try:
        n = int(job_id)
    except (TypeError, ValueError):
        n = None
    if n in plan.baseline_failed_jobs:
        return CleanupAction(False, "BASELINE_FAILED_JOB", f"job {job_id} is baseline 1/2/3; untouched")
    if not plan.evidence_captured:
        return CleanupAction(False, "EVIDENCE_NOT_CAPTURED", "canary-owned failed job removal waits for evidence")
    if not plan.canary_failed_job_removal_authorized:
        return CleanupAction(
            False,
            "REMOVAL_NOT_AUTHORIZED",
            "canary-owned failed-job removal requires later execution authorization",
        )
    if str(job_id) not in plan.canary_failed_job_ids and job_id not in plan.canary_failed_job_ids:
        return CleanupAction(False, "NOT_CANARY_OWNED", f"job {job_id} is not a recorded canary-owned failed job")
    return CleanupAction(True, "REMOVE_CANARY_FAILED_JOB", f"remove canary-owned failed job {job_id}")


def session_terminate_action(session_id: str | None) -> CleanupAction:
    if not session_id:
        return CleanupAction(False, "SESSION_NOT_IDENTIFIABLE", "do not terminate unrelated sessions")
    return CleanupAction(True, "DELETE_SESSION", f"DELETE /api/sessions/{session_id}")


def key_revoke_action(key_id: str | None) -> CleanupAction:
    if not key_id:
        return CleanupAction(False, "KEY_NOT_IDENTIFIABLE", "do not create a replacement key")
    return CleanupAction(True, "DELETE_KEY", f"DELETE /api/keys/{key_id}")
