# Operator Permissions / Approval Workflow Guidance

**Phase:** 65B  
**Reference:** PHASE-65A-DESIGN.md Section 3

---

## Purpose

Define operator roles, permission expectations, and approval workflow for admin actions. No RBAC in platform; access control is operational. This document provides guidance for organizational permission boundaries.

## Scope

**In scope:**
- Role expectations (platform operator, incident responder, platform owner)
- Approval requirements for sensitive actions
- Workflow guidance for invoice, refund, credit, quota, ban/suspension

**Excluded:**
- Platform RBAC implementation (deferred)
- Automated approval workflows

## Prerequisites

- INTERNAL_SERVICE_KEY for admin endpoint access
- Network access to api-gateway
- Organizational assignment of roles (platform operator, incident responder, platform owner)
- Designated platform owner or delegate for approvals

## Role Expectations

| Role | Allowed Actions | Constraint |
|------|-----------------|------------|
| **Platform operator** | Read all admin endpoints; call void/finalize with X-Admin-Actor | Must have INTERNAL_SERVICE_KEY; individual identity in X-Admin-Actor |
| **Incident responder** | Same as platform operator; per PHASE-60/63 runbooks | Escalation per runbook |
| **Platform owner** | All operator actions; approval for sensitive actions | Per approval matrix below |

**Design-level expectation:** No RBAC in platform. Only operators with INTERNAL_SERVICE_KEY and network access can call admin endpoints. Permission boundaries are organizational.

## Approval Matrix

| Action | Who May Execute | Approval Required |
|--------|-----------------|-------------------|
| **View user ops summary** | Operator | None |
| **List/view invoices** | Operator | None |
| **Invoice void** | Operator | Operator discretion; document reason in ticket |
| **Invoice finalize** | Operator | Operator discretion; reconciliation enforced by endpoint |
| **Refund** | Operator (out-of-band) | Platform owner or delegate |
| **Credit** | Operator (out-of-band) | Platform owner or delegate |
| **Manual quota adjustment** | Operator (out-of-band) | Platform owner or delegate |
| **Warning (abuse)** | Operator | Operator sign-off |
| **Temporary restriction** | Operator | Platform owner or delegate |
| **Account suspension** | Operator | Platform owner |
| **Ban** | Operator | Platform owner; legal if needed |

**Sensitive = financial impact or user restriction.** Approval is operational, not automated.

## Workflow Guidance

### Invoice Void / Finalize

1. Operator has INTERNAL_SERVICE_KEY and X-Admin-Actor
2. Document reason in ticket or runbook before or after action
3. Call endpoint; verify response includes voidedBy/finalizedBy
4. No separate approval required; operator discretion
5. Monthly audit reviews these actions

### Refund / Credit / Quota Adjustment

1. Receive request or identify need
2. **Obtain approval** — Platform owner or delegate sign-off
3. Execute per procedure (refund-credit-handling-procedure.md, manual-quota-adjustment-procedure.md)
4. Document: action, user_id, amount/limit, reason, operator, date
5. Retain evidence 12 months minimum

### Abuse: Warning

1. Operator may issue warning without platform owner approval
2. Document in ticket; notify user
3. Log decision

### Abuse: Restriction / Suspension / Ban

1. **Restriction:** Platform owner or delegate approval
2. **Suspension:** Platform owner approval
3. **Ban:** Platform owner approval; legal/compliance input if needed
4. Execute per abuse-suspension-ban-handling-procedure.md
5. Retain evidence 12 months minimum

## Exception / Escalation

| Condition | Action |
|-----------|--------|
| **Approval unclear** | Escalate to platform owner |
| **Urgent (e.g. credential compromise)** | Per PHASE-63 security incident; contain first; document after |
| **Legal/compliance question** | Escalate to legal/compliance; do not act until resolved |
| **Dispute** | Escalate to platform owner; document resolution |

## Evidence to Retain

- Approval records (who approved, when, for what)
- Operator identity for all mutations
- Ticket references
- Per audit-evidence-signoff-requirements.md

---

**Reference:** PHASE-65A-DESIGN.md Section 3
