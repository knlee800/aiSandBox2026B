# Audit / Evidence / Signoff Requirements for Admin Actions

**Phase:** 65B  
**Reference:** PHASE-65A-DESIGN.md Section 7

---

## Purpose

Define required records, review expectations, retention, and operator accountability for admin actions. Ensures admin mutations are auditable and operators are accountable.

## Scope

**In scope:**
- Invoice void and finalize (platform API)
- Refund, credit, quota adjustment (out-of-band)
- Ban/suspension (out-of-band)
- Admin action audit and review

**Excluded:**
- Automated audit enforcement (deferred)
- User-facing audit (operator-only)

## Required Records for Admin Actions

| Action | Record | Retention |
|--------|--------|-----------|
| **Invoice void** | voidedBy, voidedAt in DB; X-Admin-Actor in request | Per ledger retention |
| **Invoice finalize** | finalizedBy, finalizedAt in DB; X-Admin-Actor in request | Per ledger retention |
| **Refund (out-of-band)** | Ticket; amount; user_id; reason; operator; date | 12 months minimum |
| **Credit (out-of-band)** | Ticket; amount; user_id; reason; operator; date | 12 months minimum |
| **Quota adjustment (out-of-band)** | Ticket; user_id; old/new limit; reason; operator; date | 12 months minimum |
| **Ban/suspension** | Ticket; user_id; evidence; decision; operator; date | 12 months minimum |

## Review Expectations

| Review | Frequency | Owner | Purpose |
|--------|-----------|-------|---------|
| **Admin action audit** | Monthly | Platform operator | Review void/finalize and out-of-band actions; anomalies |
| **Abuse decision review** | Quarterly | Platform owner | Abuse handling consistency; escalation patterns |
| **Financial adjustment review** | Monthly | Platform owner or delegate | Refunds, credits; policy compliance |

## Retention / Operator Accountability

| Requirement | Expectation |
|-------------|-------------|
| **Retention** | 12 months minimum for admin action records |
| **Accountability** | X-Admin-Actor and voidedBy/finalizedBy provide operator identity for invoice mutations |
| **No PII in audit** | Operational metadata only; user_id as reference, not PII |
| **Access** | Restricted to operators and platform owner |

## Evidence Format

For out-of-band actions, document:

- **Who:** Operator identity (name or role)
- **When:** Date and timestamp
- **What:** Action (refund, credit, quota, ban, suspension)
- **Why:** Reason; ticket reference
- **Outcome:** Completion confirmation; any correction

## Signoff Format

- **Who:** Name or role of signer
- **Date:** Date of sign-off
- **Activity:** Brief description

Example: `Platform owner: _________________ Date: ______ Activity: Refund approved for user_id X, amount Y`

## Invoice Mutations (Platform API)

For `POST /api/internal/admin/invoices/:invoiceId/void` and `finalize`:

- **Required header:** X-Admin-Actor (operator identity)
- **Persisted:** voidedBy, voidedAt or finalizedBy, finalizedAt in database
- **Missing X-Admin-Actor:** Returns 400 Bad Request; do not proceed without it

---

**Reference:** PHASE-65A-DESIGN.md Section 7; docs/security/evidence-signoff-requirements.md (PHASE-63B)
