# Runbook: Suspected Credential Compromise

## Title

Suspected Credential Compromise

## Trigger

Evidence or suspicion that INTERNAL_SERVICE_KEY, JWT_SECRET, POSTGRES_PASSWORD, REDIS_PASSWORD, or other production credentials have been exposed or compromised.

## Severity

P1 (Critical)

## Verification

1. **Confirm compromise** — Assess: leaked, stolen, or suspected exposure.
2. **Identify scope** — Which credentials; which systems.

## Remediation

1. **Immediate** — Page on-call; treat as P1.
2. **Rotate all secrets** — Per `secrets-rotation.md` (emergency procedure). Do not reuse any values.
3. **Revoke compromised access** — Any accounts or tokens that may have used old credentials.
4. **Contain** — Isolate affected systems if propagation suspected.
5. **Verify health** — Full smoke test after rotation.

## Escalation

- Escalate to platform owner if unresolved in 30 minutes.
- Post-incident review required.

## Post-incident

- Document root cause, exposure vector, remediation.
- Update runbooks if gaps found.
- Sign-off.

**Reference:** PHASE-63A-DESIGN.md Section 4.4, secrets-rotation.md
