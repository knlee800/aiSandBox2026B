# User Data Access / Export Request Procedure

**Phase:** 64B  
**Reference:** PHASE-64A-DESIGN.md Section 4.1, 5

---

## Purpose

Fulfill user data access and export requests (right to data portability) per Phase 64A design. Operator-driven procedure; no platform API. Export persisted user data in machine-readable format.

## Scope

**In scope:**
- Session metadata (id, user_id, created_at, last_activity_at, terminated_at, termination_reason)
- Usage records (token usage, execution counts, timestamps)
- Billing/ledger metadata (if applicable)
- Account data (user_id, email if stored, auth identifiers)

**Excluded:**
- Session workspace content (ephemeral; not persisted beyond container)
- Prompts / AI responses (never stored per PHASE-15B)
- Operational logs (operator-only; no PII)

## Prerequisites

- Operator access to database
- Understanding of data model: sessions, usage_records, ledger
- Designated intake channel (email, form) documented in Privacy Policy
- Identity verification procedure (see identity-verification-intake-handling.md)

## Intake Steps

1. **Receive request** — Via designated channel (email, form, support ticket).
2. **Log request** — Record date, request type (export), requestor identifier (e.g. email), ticket/reference ID.
3. **Assign status** — Set status: `received`.
4. **Acknowledge** — Send acknowledgment to requestor (e.g. "Request received; we will respond within [policy timeline, e.g. 30 days]").

## Verification Steps

1. **Identity verification** — Per identity-verification-intake-handling.md. Confirm requestor is account owner.
2. **Scope confirmation** — Verify requested scope matches exportable data; document any exclusions (e.g. workspace content not available).
3. **Escalation check** — If identity unclear, bulk request, or legal question: escalate to platform owner before proceeding.

## Fulfillment Steps

1. **Query data** — Extract user's sessions, usage_records, ledger entries (if applicable) from database.
2. **Format** — Produce machine-readable export (JSON or CSV).
3. **Package** — Create export package; store securely; generate secure delivery link or encrypted transfer.
4. **Deliver** — Send to verified requestor via secure channel.
5. **Update status** — Set status: `completed`.
6. **Document** — Record completion date, operator, delivery method.

## Exception / Rejection Handling

| Condition | Action |
|-----------|--------|
| **Identity unverified** | Reject; request additional verification; escalate if contested |
| **Request from third party** | Reject unless valid legal authority (e.g. power of attorney); escalate |
| **Bulk or complex request** | Escalate for scope and timeline review; may extend timeline per policy |
| **No data found** | Fulfill with empty export; document; inform requestor |
| **Legal/compliance question** | Escalate to legal/compliance; do not fulfill until resolved |

**Rejection:** Document reason; retain evidence; notify requestor; set status: `rejected`.

## Evidence to Retain

- Request log (date, type, requestor identifier, ticket ID)
- Verification record (method used, outcome)
- Export package reference or checksum
- Completion date and operator
- Delivery confirmation (if applicable)

**Retention:** Per policy (e.g. 12 months for request/fulfillment records).

## Signoff Requirements

- Operator sign-off on completion
- Platform owner or delegate review for correctness of scope (no over-disclosure, no cross-user data)
- Evidence retained per evidence-tracking-signoff-requirements.md

---

**Reference:** PHASE-64A-DESIGN.md Section 4.1, 5.1, 5.2, 5.3
