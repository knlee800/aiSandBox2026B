# Runbook: Audit Log Review

## Title

Audit Log Review

## Trigger

Monthly review (per PHASE-63A Section 3.2). May also be triggered by security incident or access control review.

## Severity

Operational (not incident severity). Required monthly.

## Purpose

Detect anomalies, unauthorized access, and policy violations in operational audit records.

## Prerequisites

- Access to operational audit records (operator-only)
- Audit records retained per policy (12 months minimum)

## Verification

1. **Confirm audit log availability** — Records accessible; retention meets 12-month minimum.
2. **Review scope** — Operator access, secrets rotation, restore operations, incident response, security-relevant config changes.

## Procedure

1. **Retrieve audit records** for the review period (e.g. last 30 days).
2. **Review for anomalies:**
   - Unauthorized or unexpected operator actions
   - Unusual timing or frequency of access
   - Config changes without documented approval
   - Restore operations without incident ticket
3. **Document findings** — Anomalies documented or "none" if clean.
4. **Escalate** — Any suspicious activity → security incident triage (P2 or P3).

## Evidence

- Review log (date, operator, period covered)
- Anomalies documented or none
- Sign-off

## Sign-off

Operator sign-off required. Per PHASE-63A Section 8.3.

## Post-review

- Retain evidence per retention policy (12 months minimum).
- If anomalies found, create ticket and follow security-incident-triage-escalation runbook.

**Reference:** PHASE-63A-DESIGN.md Section 3
