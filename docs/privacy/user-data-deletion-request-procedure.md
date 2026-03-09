# User Data Deletion Request Procedure

**Phase:** 64B  
**Reference:** PHASE-64A-DESIGN.md Section 4.2, 5; extends docs/runbooks/privacy-compliance-request-handling.md

---

## Purpose

Fulfill user data deletion requests (right to erasure) per Phase 64A design. Operator-driven procedure; cascade deletion of user-associated records. No platform API.

## Scope

**In scope (cascade order):**
1. Sessions (terminated and active)
2. Usage records
3. Ledger entries (anonymize or hard delete per policy)

**Excluded / constrained:**
- Session workspace content (ephemeral; removed with container)
- Backups (deletion requires backup purge or retention expiry; document)
- Ledger immutable records (anonymization vs hard delete per policy)
- Operational audit logs (retention per policy; no PII)

## Prerequisites

- Operator access to database
- Understanding of data model: sessions, usage_records, ledger
- Cascade rules documented (sessions → usage_records → ledger)
- Designated intake channel documented in Privacy Policy
- Identity verification procedure (see identity-verification-intake-handling.md)

## Intake Steps

1. **Receive request** — Via designated channel (email, form, support ticket).
2. **Log request** — Record date, request type (deletion), requestor identifier, ticket/reference ID.
3. **Assign status** — Set status: `received`.
4. **Acknowledge** — Send acknowledgment (e.g. "Request received; we will process within [policy timeline, e.g. 30 days]").

## Verification Steps

1. **Identity verification** — Per identity-verification-intake-handling.md. Confirm requestor is account owner.
2. **Scope confirmation** — Identify all user-associated records: sessions, usage_records, ledger.
3. **Escalation check** — If identity unclear, legal question, or dispute: escalate to platform owner before proceeding.
4. **Final confirmation** — For deletion (irreversible): confirm requestor intent; document.

## Fulfillment Steps

1. **Stop active sessions** — Terminate any active sessions for user (container stop/remove per container-manager).
2. **Cascade deletion** — Delete or anonymize in order: sessions → usage_records → ledger (per policy).
3. **Verification** — Query database; confirm no residual user data (e.g. `SELECT COUNT(*) WHERE user_id = ?` returns 0).
4. **Audit log** — Log deletion: when, operator, user_id (hashed or reference only); no PII in audit.
5. **Update status** — Set status: `completed`.
6. **Notify requestor** — Confirm deletion completed.

## Exception / Rejection Handling

| Condition | Action |
|-----------|--------|
| **Identity unverified** | Reject; request additional verification; escalate if contested |
| **Request from third party** | Reject unless valid legal authority; escalate |
| **Dispute** | Escalate to platform owner; document resolution |
| **Legal hold** | Do not delete; escalate to legal; document |
| **Backup retention** | Document that backups may retain data until retention expiry; purge if policy requires |

**Rejection:** Document reason; retain evidence; notify requestor; set status: `rejected`.

## Evidence to Retain

- Request log (date, type, requestor identifier, ticket ID)
- Verification record (method used, outcome)
- Cascade deletion confirmation (records deleted per table)
- Completion date and operator
- Audit log reference (deletion event; no PII)

**Retention:** Per policy (e.g. 12 months for request/fulfillment records).

## Signoff Requirements

- Operator sign-off on completion
- Platform owner or delegate review: verify no residual user data
- Evidence retained per evidence-tracking-signoff-requirements.md

---

**Reference:** PHASE-64A-DESIGN.md Section 4.2, 5.1, 5.2, 5.3; docs/runbooks/privacy-compliance-request-handling.md
