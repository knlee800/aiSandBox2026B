# PHASE-60A-CHECKPOINT.md

## Metadata

**Phase:** 60  
**Stage:** 60A  
**Task ID:** TASK-60A  
**Title:** Alerting & Incident Readiness Design  
**Status:** COMPLETE  
**Date:** 2026-03-09  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)

---

## 1. Scope

### Objective

Define production alerting scope, alert thresholds, incident signal definitions, and runbook requirements aligned with current architecture (no background workers, request-driven, external polling only).

### In-Scope

- Alerting scope (what to alert on, what not)
- Alert thresholds with rationale
- Incident signal definitions and severity classification
- Runbook requirements (structure, categories, minimum actions)
- Architecture fit (external polling, constraints, known gaps)

### Out-of-Scope

- No code changes
- No schema changes
- No implementation of alerting systems
- No changes to existing endpoints or metrics

---

## 2. Deliverables

| Document | Path | Purpose |
|----------|------|---------|
| Design | `docs/PHASE-60A-DESIGN.md` | Full design specification |
| Checkpoint | `docs/PHASE-60A-CHECKPOINT.md` | This completion record |

---

## 3. Summary of Design

### Alerting Scope

- **Critical:** Docker connectivity, database connectivity, API Gateway unreachable, readiness failing
- **Warning:** Session–container drift (persistent), elevated error termination rate (>20%)
- **Not alerted:** Idle/max_lifetime/manual terminations, transient drift, cost metrics

### Thresholds

- Connectivity: `dockerConnectivity` or `databaseConnectivity` === false → Critical
- Drift: `activeSessionCount ≠ runningContainerCount` for 3+ poll cycles → Warning
- Error rate: `error` terminations > 20% of total (with volume floor 10) → Warning

### Runbook Requirements

- Structure: Title, Trigger, Severity, Verification, Remediation, Escalation, Post-incident
- Categories: Connectivity, Session/Container, Termination
- P1: Immediate response; P2: Within 4 hours

### Architecture Fit

- External monitor polls `/api/runtime/metrics`, `/api/health`, `/api/health/ready`
- No in-process alert dispatch; no workers, cron, or event bus
- Known gaps: Prometheus format, historical alerting, cost-based alerts—deferred

---

## 4. Invariants Preserved

- No code changes
- No schema changes
- No background workers
- No cron jobs
- No event bus
- No changes to execution, quota, billing, ledger, or observability behavior

---

## 5. Files Created

| Path | Purpose |
|------|---------|
| `docs/PHASE-60A-DESIGN.md` | Design specification |
| `docs/PHASE-60A-CHECKPOINT.md` | Checkpoint record |

---

## 6. Files Modified

None.

---

## 7. References

- ARCHITECTURE.md Section 11 (Explicit Non-Goals)
- PHASE-41A-CHECKPOINT.md (Runtime Metrics)
- PHASE-58-FINAL-CHECKPOINT.md (Operational Metrics)
- PHASE-59-FINAL-CHECKPOINT.md (Cost Monitoring)
- TASKS_BACKLOG_FULL.md → TASK-60A

---

**Phase 60A:** COMPLETE  
**Code changes:** NONE

---

**END OF CHECKPOINT**
