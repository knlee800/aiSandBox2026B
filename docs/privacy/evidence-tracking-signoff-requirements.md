# Evidence / Tracking / Signoff Requirements

**Phase:** 64B  
**Reference:** PHASE-64A-DESIGN.md Section 5.1, 5.2, 5.3

---

## Purpose

Define evidence retention, tracking, and signoff expectations for legal/privacy request handling. Ensures auditability and compliance readiness.

## Scope

**Applies to:**
- User data export requests
- User data deletion requests
- Policy updates
- Retention reviews
- Cookie/consent changes (where applicable)

## Tracking Requirements

| Requirement | Expectation |
|-------------|-------------|
| **Request log** | Every request logged with date, type, requestor identifier, ticket ID |
| **Status** | Status tracked: received, in progress, completed, rejected |
| **Timeline** | Fulfillment within policy timeline (e.g. 30 days for GDPR); document if extended |

## Evidence Requirements by Activity

### Export Request

| Evidence | Retention |
|----------|-----------|
| Request log (date, type, requestor, ticket) | Per policy (e.g. 12 months) |
| Verification record (method, outcome) | Per policy |
| Export package reference or checksum | Per policy |
| Completion date and operator | Per policy |
| Delivery confirmation (if applicable) | Per policy |

### Deletion Request

| Evidence | Retention |
|----------|-----------|
| Request log (date, type, requestor, ticket) | Per policy (e.g. 12 months) |
| Verification record (method, outcome) | Per policy |
| Cascade deletion confirmation | Per policy |
| Completion date and operator | Per policy |
| Audit log reference (deletion event; no PII) | Per policy |

### Policy Update

| Evidence | Retention |
|----------|-----------|
| Version history | Permanent |
| Publication date | Permanent |
| Notification method | Per policy |

### Retention Review

| Evidence | Retention |
|----------|-----------|
| Review date | Per policy |
| Findings | Per policy |
| Changes made | Per policy |
| Sign-off | Per policy |

## Signoff Requirements

| Activity | Signoff |
|----------|---------|
| **Export request completed** | Operator sign-off; platform owner or delegate review (scope correctness) |
| **Deletion request completed** | Operator sign-off; platform owner or delegate review (no residual data) |
| **Policy update** | Platform owner sign-off |
| **Retention review** | Platform owner or operator sign-off |

## Escalation Rules

| Condition | Escalation |
|-----------|------------|
| Identity unclear | Platform owner before fulfilling |
| Legal/compliance question | Legal or compliance (organizational) |
| Bulk or complex request | Platform owner for scope and timeline |
| Data breach suspected | Per PHASE-63 security incident; P1 |
| Dispute | Platform owner; document resolution |

## Storage

- Evidence stored in operator-only or platform-owner access
- No PII in audit logs (user_id hashed or reference only)
- Retention per organizational policy (e.g. 12 months minimum for request/fulfillment)

---

**Reference:** PHASE-64A-DESIGN.md Section 5.1, 5.2, 5.3; docs/security/evidence-signoff-requirements.md
