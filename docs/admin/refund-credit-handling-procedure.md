# Refund / Credit Handling Procedure

**Phase:** 65B  
**Reference:** PHASE-65A-DESIGN.md Section 5

---

## Purpose

Handle refunds and credits per Phase 65A design. Operator-driven procedure; no refund/credit API in platform. Actions are out-of-band (payment provider dashboard, manual DB updates, adjustment records).

## Scope

**In scope:**
- Refund: User overcharged; billing error; goodwill (approved)
- Credit: Compensate user; correct billing error

**Excluded:**
- Refund/credit API (deferred)
- Automated refund processing
- Stripe or payment provider integration (use provider dashboard)

## Prerequisites

- Platform owner or delegate approval for non-error refunds/credits
- Access to payment provider dashboard (if applicable)
- Access to billing/ledger data for verification
- Understanding of ledger immutability (adjustment records, not edits)

## Intake / Trigger Conditions

| Trigger | Source | Action |
|---------|--------|--------|
| **User request** | Support ticket, email | Log; verify; obtain approval |
| **Billing error** | Internal discovery, reconciliation | Document error; obtain approval |
| **Goodwill** | Business decision | Platform owner approval required |

## Review / Verification Steps

1. **Identity verification** — Confirm requestor is account owner; match user_id
2. **Verify amount** — Confirm overcharge or error amount from ledger/billing data
3. **Check for duplicate** — Ensure no prior refund/credit for same issue
4. **Approval** — Platform owner or delegate sign-off for non-routine actions
5. **Reversibility** — Document rollback steps if action incorrect

## Action Steps

### Refund

1. Obtain platform owner or delegate approval (for non-error: required)
2. Document: user_id, amount, reason, operator, timestamp
3. **Execute refund** — Via payment provider dashboard or manual process
4. Log completion: user_id, amount, reason, operator, date
5. Notify user via support channel (if applicable)

### Credit

1. Obtain platform owner or delegate approval
2. Document: user_id, credit amount, reason, operator, timestamp
3. **Execute credit** — Apply offsetting adjustment per ledger design; no edit of existing records
4. Log completion: user_id, amount, reason, operator, date
5. Notify user via support channel (if applicable)

## Exception / Escalation Handling

| Condition | Action |
|-----------|--------|
| **Identity unverified** | Do not proceed; escalate to platform owner |
| **Amount disputed** | Escalate to platform owner; document both sides |
| **Legal/compliance question** | Escalate to legal/compliance; do not act until resolved |
| **Payment provider failure** | Retry per provider docs; escalate if persistent |
| **Incorrect refund/credit** | Per rollback procedure below |

## Rollback / Correction Handling

| Scenario | Procedure |
|----------|-----------|
| **Incorrect refund** | Document; contact user; reverse per payment provider; log correction |
| **Incorrect credit** | Document; apply offsetting adjustment; log correction |

## Evidence to Retain

- Ticket; user_id; amount; reason; operator; date
- Approval record (platform owner or delegate sign-off)
- Completion confirmation
- Rollback/correction record if applicable

**Retention:** 12 months minimum per PHASE-65A Section 7.1

## Signoff / Approval Requirements

| Action | Approval | Signoff |
|--------|----------|---------|
| **Refund (billing error)** | Platform owner or delegate | Platform owner or delegate sign-off |
| **Refund (goodwill)** | Platform owner | Platform owner sign-off |
| **Credit** | Platform owner or delegate | Platform owner or delegate sign-off |

**Monthly review:** Financial adjustments reviewed per PHASE-65A Section 7.2.

---

**Reference:** PHASE-65A-DESIGN.md Section 5
