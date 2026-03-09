# Runbook: Database Connectivity Lost

## Title

Database Connectivity Lost

## Trigger

- `GET /api/runtime/metrics` returns `databaseConnectivity === false`, or
- `GET /api/health/db` returns 503.

## Severity

P1 (Critical)

## Verification

1. Poll `GET /api/runtime/metrics`; confirm `databaseConnectivity` is `false`.
2. Poll `GET /api/health/db`; confirm 503 response.
3. Optionally: verify PostgreSQL is running on database host.

## Remediation

1. Verify PostgreSQL is running (e.g. `pg_isready` or service status).
2. Check connection string (e.g. `DATABASE_URL` or equivalent in api-gateway env).
3. Verify network connectivity between api-gateway and database host.
4. Restart api-gateway if database is confirmed healthy but api-gateway still reports disconnected.
5. Re-poll `/api/runtime/metrics`; confirm `databaseConnectivity` is `true`.

## Escalation

- **P1:** Page on-call immediately.
- Escalate to platform owner if unresolved in 30 minutes.

## Post-incident

- Document root cause (DB crash, connection pool exhaustion, network issue, etc.).
- Note duration of outage.
- Update runbook if new patterns identified.
