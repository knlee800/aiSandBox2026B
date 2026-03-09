# Runbook: Privacy / Compliance Request Handling

## Title

Privacy / Compliance Request Handling

## Trigger

- User data deletion request (right to erasure)
- Data retention policy review
- Breach notification (see security-incident-triage-escalation for P1 data breach)
- Compliance audit or checklist review

## Severity

Operational. Data breach is P1; see security-incident-triage-escalation.

## Purpose

Handle privacy and compliance requests per PHASE-63A Section 7. Design supports: user deletion can cascade to sessions, usage; operational procedures for deletion runbook.

## Prerequisites

- Operator access to database (if manual deletion required)
- Understanding of data model: sessions, usage_records, ledger
- Policy on retention and deletion timelines

## Data Handling Expectations

| Area | Expectation |
|------|-------------|
| **User data** | Sessions, workspace: ephemeral per container; not persisted beyond session |
| **Usage/billing data** | Ledger: immutable; retention per policy; deletion procedure documented |
| **Operational logs** | No PII; retention per policy; operator access only |
| **Deletion** | Runbook for user data deletion; cascade rules; verification steps |

## Right to Erasure (User Deletion)

1. **Verify request** — Valid user identity; authorization to request deletion.
2. **Identify scope** — Sessions (terminated), usage_records, ledger entries for user.
3. **Cascade deletion** — Delete or anonymize user-associated records per policy. Order: sessions → usage_records → ledger (if applicable).
4. **Verification** — Confirm no residual user data; document deletion.
5. **Audit** — Log deletion: when, operator, user id (hashed or reference only); no PII in audit.

## Data Retention Review

- Policy-driven; operator enforces.
- Document retention periods per asset type.
- Review annually or per policy.

## Breach Notification

- Per security-incident-triage-escalation: contain, document, notify per organizational policy.
- No PII in incident documentation where avoidable.

## Evidence / Sign-off

- Deletion requests: document completion; operator sign-off.
- Retention review: document findings; platform owner sign-off.

**Reference:** PHASE-63A-DESIGN.md Section 7
