# Runbook: Unauthorized Operator Access

## Title

Unauthorized Operator Access

## Trigger

Evidence that an operator or account has accessed systems or performed actions without authorization (e.g. from audit log review, access control review, or anomaly detection).

## Severity

P1 (Critical)

## Verification

1. **Confirm unauthorized access** — Audit log; access records; timestamps.
2. **Identify scope** — What was accessed; what actions performed.

## Remediation

1. **Immediate** — Revoke access for the compromised account.
2. **Contain** — Prevent further access; revoke tokens, keys, or session access.
3. **Audit log review** — Full review of actions by suspect account; document findings.
4. **Rotate secrets** — If credentials may have been used; per `secrets-rotation.md` (emergency).
5. **Verify** — No residual unauthorized access; health checks pass.

## Escalation

- Page on-call; escalate to platform owner if unresolved in 30 minutes.

## Post-incident

- Document root cause, actions taken, remediation.
- Update access control; quarterly review.
- Sign-off.

**Reference:** PHASE-63A-DESIGN.md Section 4.4, audit-log-review.md
