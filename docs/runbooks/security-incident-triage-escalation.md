# Runbook: Security Incident Triage and Escalation

## Title

Security Incident Triage and Escalation

## Trigger

Any security-relevant event requiring operational response: suspected credential compromise, unauthorized operator access, backup exposure, data breach, PII exposure, or PHASE-60 connectivity/operational incidents with security implications.

## Severity

| Class | Definition | Examples |
|-------|------------|----------|
| **P1 — Critical** | Platform down or core dependency compromised | Docker down, DB down, suspected credential compromise |
| **P2 — Warning** | Degraded state or potential security impact | Session–container drift, elevated errors, suspected abuse |
| **P3 — Informational** | Security-relevant but no immediate impact | Audit anomaly, policy violation |

## Verification

1. **Identify incident type** — Credential compromise, unauthorized access, backup exposure, data breach, or operational (per PHASE-60).
2. **Confirm severity** — P1: immediate; P2: within 4 hours; P3: within 24 hours.
3. **Gather context** — When detected, by whom, what systems affected.

## Triage / Escalation

| Severity | Triage Target | Escalation |
|----------|---------------|------------|
| P1 | Immediate | Page on-call; escalate to platform owner if unresolved in 30 min |
| P2 | Within 4 hours | Create ticket; escalate if unresolved in 4 hours |
| P3 | Within 24 hours | Log; review in next audit cycle |

## Remediation (by incident type)

- **Credential compromise:** See `secrets-rotation.md` (emergency rotation).
- **Unauthorized operator access:** Revoke access; audit log review; contain.
- **Backup exposure:** Rotate secrets; secure backup; investigate.
- **Data breach / PII exposure:** Contain; notify per policy; document.
- **PHASE-60 connectivity/operational:** Use existing runbooks (docker-connectivity-lost, database-connectivity-lost, api-gateway-unreachable, session-container-drift, elevated-error-termination-rate).

## Containment / Recovery / Post-Incident

| Phase | Requirements |
|-------|--------------|
| **Containment** | Isolate affected systems; revoke compromised credentials; stop propagation |
| **Recovery** | Restore per PHASE-61 runbooks; rotate secrets if compromise suspected; verify health |
| **Post-incident** | Document incident, root cause, remediation; update runbooks if gaps found; sign-off |

## Escalation Path

- **P1:** Page on-call immediately. Escalate to platform owner if unresolved in 30 minutes.
- **P2:** Create ticket. Escalate if unresolved in 4 hours.
- **P3:** Log; review in next audit cycle.

## Post-incident

- Document root cause, actions taken, resolution.
- Update runbooks if gaps identified.
- Sign-off per evidence/signoff requirements.

**Reference:** PHASE-63A-DESIGN.md Section 4
