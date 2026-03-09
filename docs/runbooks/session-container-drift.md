# Runbook: Session–Container Drift

## Title

Session–Container Drift

## Trigger

`activeSessionCount !== runningContainerCount` for 3+ consecutive poll cycles (e.g. 3 × 60s) when polling `GET /api/runtime/metrics`.

## Severity

P2 (Warning)

## Verification

1. Poll `GET /api/runtime/metrics` over multiple cycles.
2. Confirm `activeSessionCount` and `runningContainerCount` differ persistently (not transient during lifecycle transitions).
3. Note which value is higher (orphaned sessions vs orphaned containers).

## Remediation

1. Run reconciliation per PHASE-43C (orphan cleanup, pending execution reconciliation).
2. Verify orphan cleanup completes; re-poll metrics.
3. Check container-manager logs for container lifecycle errors.
4. If drift persists: inspect database sessions vs Docker containers manually; consider manual cleanup as last resort.

## Escalation

- **P2:** Create ticket; investigate within 4 hours.
- Escalate if unresolved in 4 hours.

## Post-incident

- Document root cause (container-manager restart, Docker restart, race condition, etc.).
- Note drift magnitude and duration.
- Update runbook if new patterns identified.
