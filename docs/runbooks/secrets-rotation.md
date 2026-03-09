# Runbook: Secrets / Credential Handling and Emergency Rotation

## Title

Secrets / Credential Handling and Emergency Rotation

## Trigger

- **Scheduled:** Annually minimum; per policy.
- **Emergency:** Suspected credential compromise (P1).

## Severity

- Scheduled: Operational
- Emergency: P1 (Critical)

## Prerequisites

- Operator access to `.env` or equivalent
- Ability to restart all services (api-gateway, ai-service, container-manager, frontend if applicable)

## Secrets in Scope

| Secret | Services | Storage |
|--------|----------|---------|
| INTERNAL_SERVICE_KEY | api-gateway, ai-service, container-manager | `.env`; must be identical across all three |
| JWT_SECRET | api-gateway | `.env` |
| POSTGRES_PASSWORD | All services using DB | `.env` |
| REDIS_PASSWORD | If Redis in use | `.env` |

## Procedure (Scheduled Rotation)

1. **Generate new values** — Cryptographically secure; document generation method.
2. **Update `.env`** — Replace old values with new. Ensure INTERNAL_SERVICE_KEY identical in all three service configs.
3. **Stop application services** — Preserve DB and Redis if not rotating their passwords.
4. **Restart services** with new `.env`.
5. **Verify health** — `GET /api/health`, `GET /api/health/ready`, `GET /api/health/db`.
6. **Log rotation** — Who, when, which secrets; append to audit record.

## Procedure (Emergency Rotation)

1. **Immediate** — Treat as P1; page on-call.
2. **Contain** — Revoke any suspected compromised access; isolate if needed.
3. **Rotate all secrets** — INTERNAL_SERVICE_KEY, JWT_SECRET, POSTGRES_PASSWORD, REDIS_PASSWORD. Do not reuse old values.
4. **Update `.env`** across all services; restart.
5. **Verify health** — Full smoke test.
6. **Document** — Incident, root cause, remediation; post-incident review required.

## Post-Rotation

- Audit log entry: when, which secret(s), operator.
- Emergency only: post-incident sign-off.

## Escalation

- Emergency: Escalate to platform owner if compromise confirmed or unresolved in 30 min.

**Reference:** PHASE-63A-DESIGN.md Section 5
