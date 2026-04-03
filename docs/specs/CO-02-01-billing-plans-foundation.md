# Spec: CO-02-01 — Billing and Plans Foundation

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | CO-02-01 |
| **Title** | Billing and Plans Foundation |
| **Status** | Draft |
| **Master plan alignment** | Section 7.5 CO-02, Phase 5 |
| **Related task IDs** | None yet registered |
| **Depends on** | CO-01-01 (Quota UX aligned), AI-03-01/02 (core loop working) |
| **Enables** | Commercial operation, paid user access |

---

## 2. Problem

Backend billing entities exist (invoice, billing-snapshot) but no complete subscription/plan flow, no payment integration, and no billing UX is available to users.

---

## 3. Why This Matters

The master plan Phase 5 requires the product to "operate safely with real users, quotas, and billing." Without billing, the platform cannot sustain commercial operation.

---

## 4. Goal

Implement subscription/plan model with invoice/ledger correctness sufficient for safe commercial operation.

---

## 5. Non-Goals

- No complex enterprise billing/reporting
- No self-serve plan management beyond basic needs
- No multi-currency support
- No complex proration logic
- No partner/reseller billing

---

## 6. Existing Relevant Completed Work to Preserve

- Backend invoice and billing-snapshot entities
- Backend billing-visibility controller
- Backend token-usage tracking
- Quota enforcement

---

## 7. Scope

1. Plan definitions with quota limits
2. User-plan assignment
3. Subscription lifecycle (active, cancelled, expired)
4. Invoice generation from usage data
5. Billing visibility to user (current plan, usage, invoices)
6. Payment integration if required for beta (Stripe or equivalent)

---

## 8. Functional Requirements

1. Plans exist with defined resource limits (tokens, sessions, etc.)
2. Users are assigned to a plan
3. Usage is tracked against plan limits
4. Invoices are generated correctly from usage records
5. Users can see their plan, usage, and invoices

---

## 9. UX Requirements

1. Current plan and usage visible in account/settings area
2. Invoice list accessible to user
3. Plan limits clearly communicated
4. Upgrade/downgrade path if multiple plans exist

---

## 10. Backend Requirements

1. Plan entity and seed data
2. User-plan association
3. Invoice generation from usage records
4. Billing API endpoints (plan info, invoices, usage summary)
5. Payment webhook handling if payment provider is integrated

---

## 11. Frontend Requirements

1. Account/billing page or section
2. Plan display, usage summary, invoice list
3. Payment flow UI if payment provider is integrated

---

## 12. Data/State Expectations

- Plan entity: id, name, limits (tokens, sessions, etc.), price
- Subscription: user_id, plan_id, status, period
- Invoice: user_id, period, amount, status, line items

---

## 13. Error Handling Requirements

1. Payment failure → clear message, grace period or service limitation
2. Invoice generation failure → admin alert, no silent failure
3. Plan not found → appropriate error

---

## 14. Acceptance Criteria

- [ ] Plans exist with defined limits
- [ ] Users are assigned to plans
- [ ] Invoices are generated correctly
- [ ] Billing is visible to users
- [ ] Quota enforcement respects plan limits
- [ ] Existing product behavior preserved

---

## 15. Invariants to Preserve

- Token usage tracking accuracy
- Quota enforcement
- Session lifecycle
- Auth/ownership on billing endpoints

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| CO-01-01 | Planned | Quota/usage alignment |
| Backend billing entities | Exist | Storage layer |
| Token usage tracking | Complete | Usage data for invoices |

---

## 17. Risks / Edge Cases

- Payment provider integration adds external dependency
- Invoice accuracy depends on usage tracking correctness
- Plan changes mid-period need clear proration rules (or defer proration)

---

## 18. Suggested Implementation Slices

1. **Backend: Plan entity and seed data** — Define plans, create migration.
2. **Backend: User-plan assignment and enforcement** — Wire plans to quota enforcement.
3. **Backend: Invoice generation** — Generate invoices from usage records.
4. **Frontend: Billing page** — Display plan, usage, invoices.
5. **Payment integration** — If required for beta, integrate payment provider.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Enterprise billing/custom plans
- Usage-based variable pricing
- Billing analytics/reporting
- Partner/reseller billing
