# Runbook: Backup Exposure (Unencrypted or Public)

## Title

Backup Exposure (Unencrypted or Public)

## Trigger

Evidence that an unencrypted backup or a backup containing sensitive data has been exposed to unauthorized parties or is publicly accessible (e.g. wrong permissions, wrong storage location, network exposure).

## Severity

P1 (Critical)

## Verification

1. **Confirm exposure** — Backup location; access permissions; network exposure.
2. **Identify scope** — Which backup; what data; who may have accessed.

## Remediation

1. **Immediate** — Page on-call; treat as P1.
2. **Secure backup** — Move to restricted location; restrict access; encrypt if not already.
3. **Rotate all secrets** — Backup may contain credentials; per `secrets-rotation.md` (emergency).
4. **Investigate** — How exposure occurred; document.
5. **Verify** — No residual exposure; health checks pass.

## Escalation

- Escalate to platform owner if unresolved in 30 minutes.
- Post-incident review required.

## Post-incident

- Document root cause, exposure vector, remediation.
- Update backup procedures per `backup-restore-sensitive-data.md`.
- Sign-off.

**Reference:** PHASE-63A-DESIGN.md Section 4.4, secrets-rotation.md, backup-restore-sensitive-data.md
