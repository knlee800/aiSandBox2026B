# Runbook: API Gateway Unreachable

## Title

API Gateway Unreachable

## Trigger

- `GET /api/health` returns non-200 or times out (>10s), or
- `GET /api/health/ready` returns 503.

## Severity

P1 (Critical)

## Verification

1. Poll `GET /api/health`; confirm non-200 or timeout.
2. Poll `GET /api/health/ready`; confirm 503 if health returns 200 (readiness can fail independently).
3. Check api-gateway process status on host.

## Remediation

1. Restart api-gateway service.
2. Check api-gateway logs for startup failures (environment validation, database connection, kill switches, safety limits).
3. Verify required environment variables are set (per startup checks).
4. If readiness fails: verify database connectivity, kill switch config, and safety limits are loaded.
5. Re-poll `/api/health` and `/api/health/ready`; confirm 200 and ready status.

## Escalation

- **P1:** Page on-call immediately.
- Escalate to platform owner if unresolved in 30 minutes.

## Post-incident

- Document root cause (process crash, OOM, config error, etc.).
- Note duration of outage.
- Update runbook if new patterns identified.
