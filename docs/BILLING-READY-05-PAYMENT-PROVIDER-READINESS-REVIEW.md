# BILLING-READY-05 — Payment Provider Readiness / Source-Path Review

**Task ID:** BILLING-READY-05
**Step:** 2 — Payment Provider Readiness / Source-Path Review
**Status:** COMPLETE
**Date:** 2026-07-13
**Nature:** Static readiness review — read-only — no implementation

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05 ACTIVE | **CONFIRMED** — Step 1 COMPLETE (Registration — 2026-07-13). Keith approval recorded. |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-13. All child slices COMPLETE and LOCKED. Regression matrix PASS 12/12. |
| BILLING-READY-04A COMPLETE and LOCKED | **CONFIRMED** — CreditBalanceGuard foundation. |
| BILLING-READY-04B COMPLETE and LOCKED | **CONFIRMED** — Execution-start gate wiring validation. |
| BILLING-READY-04C COMPLETE and LOCKED | **CONFIRMED** — Worker finalization / accounting bridge. |
| BILLING-READY-04D COMPLETE and LOCKED | **CONFIRMED** — Regression matrix + parent consolidation. |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. All 7 child slices COMPLETE and LOCKED. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | **CONFIRMED** — 2026-07-12. Live runtime orchestration canary PASS. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. Per-builder harness config adapter. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-09. Full E2E canary PASS. |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05 is ACTIVE. |

---

## 2. Foundation Summary

### BILLING-READY-03 — Credit Balance Persistence Foundation (COMPLETE and LOCKED)

- `CreditBalance` entity: per-user balance with `ownerId`/`ownerType` discriminator, `planId`, `balance` (integer, non-negative CHECK), `monthlyAllocation`, `rolloverBalance`, `periodStart`/`periodEnd`, `status`.
- `CreditDeductionRecord` entity: immutable deduction audit trail with `sourceEventId` unique idempotency, `balanceBefore`/`balanceAfter`, `appliedCredits`/`overflowCredits`, JSONB `lineItems`.
- `PersistentCreditDeductionGateway`: atomic transactional deduction with `SELECT ... FOR UPDATE`, `sourceEventId` duplicate detection, 23505 race fallback.
- Overflow semantics: deductions non-blocking; `appliedCredits = min(requested, available)`; `balanceAfter >= 0` always.

### BILLING-READY-04 — Balance Enforcement Foundation (COMPLETE and LOCKED)

- **04A**: `CreditBalanceGuard` at `POST /api/ai/execute` and `POST /v1/ai/execute` — enforces `balance > 0`, admin bypass, HTTP 402 on exhaustion/missing.
- **04B**: Guard order locked: `IdempotencyGuard → CreditBalanceGuard → QuotaGuard`. Enqueue/no-enqueue behavior validated.
- **04C**: Worker finalization bridge: `notifyExecutionComplete` → `POST /api/internal/executions/:id/finalize-accounting` → `triggerDeductionForExecution`. Only `completed` executions deduct. `sourceEventId = executionId` idempotency.
- **04D**: Regression matrix 12/12 PASS. All invariants confirmed.

---

## 3. Current Payment/Provider Source-Path Findings

### 3.1 Existing Stripe/Payment Code

| Path | Description | Status |
|------|-------------|--------|
| `services/api-gateway/src/payments/payments.module.ts` | NestJS module exporting `StripePaymentProvider` | **STUB ONLY** — Task 10B2. No API calls. No SDK. |
| `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Stub implementation | **STUB ONLY** — returns placeholders, no network calls. |
| `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | `PaymentProvider` interface with `prepareInvoice` / `validateConfiguration` | **STUB ONLY** — invoice preview context only. |
| `services/api-gateway/src/admin/charge-readiness.service.ts` | `ChargeReadinessService` — financial kill-switch gate | **GATE ONLY** — reads `BILLING_CHARGES_ENABLED` env, validates readiness conditions, does NOT charge. |

### 3.2 Existing Stubs/Placeholders

- `StripePaymentProvider.prepareInvoice()` returns `{ provider: 'stripe', externalCustomerId: null, externalInvoiceId: null, status: 'not_sent' }`.
- `StripePaymentProvider.validateConfiguration()` always returns `true` (stub mode).
- No `stripe` npm package installed.
- No Stripe SDK imported anywhere.
- No checkout session creation.
- No webhook endpoint.
- No subscription management.

### 3.3 Existing Env/Config References

| Key | Location | Value |
|-----|----------|-------|
| `BILLING_CHARGES_ENABLED` | `.env.example` | `false` — hard kill-switch |

No `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, or any other Stripe env keys exist in `.env.example` or any config file.

### 3.4 Existing Package Dependencies

No `stripe` package in any `package.json`. The `services/api-gateway/package.json` includes standard NestJS, TypeORM, BullMQ, passport, axios, etc. No payment SDK installed.

### 3.5 Existing Billing/Credits/Usage Entities and Repositories

| Entity | Table | Purpose |
|--------|-------|---------|
| `User` | `users` | Has `stripeCustomerId` (nullable), `planType`, `planStatus` |
| `CreditBalance` | `credit_balances` | Per-user balance, period, allocation |
| `CreditDeductionRecord` | `credit_deduction_records` | Immutable deduction audit |
| `BillingSnapshot` | `billing_snapshots` | Point-in-time billing records |
| `Invoice` | `invoices` | Derived invoice records (status: draft only) |
| `Plan` | `plans` | Plan definitions (code, maxActiveSessions, maxTokens24h) |
| `UsageRecord` | `usage_records` | Per-execution usage tracking |

DB schema also has: `subscriptions` table (Stripe subscription ID, plan_type, status, periods).

### 3.6 Existing Frontend Billing/Account Pages

- `frontend/app/[locale]/account/page.tsx` — currently redirects to `/app`. No billing UI.
- Translation keys: only `"payment": "Payment"` exists in `en.json`/`zh-TW.json`/`zh-CN.json` under an unrelated section.
- No pricing page, billing settings, checkout flow, or billing portal link exists.

---

## 4. Provider Decision

| Decision | Outcome |
|----------|---------|
| Provider selected | **Stripe** — aligns with existing `stripeCustomerId` on User, existing `subscriptions.stripe_subscription_id` in DB schema, existing stub `StripePaymentProvider`, and existing `ChargeReadinessService` gate. |
| Target for BILLING-READY-05 | **Stub-only + test-mode-ready contracts** — implement contracts, types, webhook handler structure, customer mapping, and credit grant logic. NO live Stripe API calls in BILLING-READY-05 implementation. |
| Provider API calls in future Step 3 | **Deferred to child slices** — actual `stripe` SDK calls require configured API keys and Keith explicit approval per slice. |
| Keith approval required before live provider calls | **YES** — no live Stripe calls without Keith providing API keys and explicit approval. Test-mode keys configuration is a manual Keith step. |

---

## 5. Subscription Lifecycle Scope

| Event | In scope for BILLING-READY-05? | Notes |
|-------|-------------------------------|-------|
| Create checkout session | YES (contract + stub) | Stripe `checkout.sessions.create` contract. No live call. |
| `checkout.session.completed` | YES (webhook handler stub) | Maps to subscription creation + credit provision. |
| Subscription created | YES (persistence) | Store subscription record, link to user. |
| Subscription active | YES (status tracking) | Update user `planType`/`planStatus`. |
| Subscription cancelled | YES (status tracking) | Update status. Credits remain until period end. |
| Subscription expired/past_due | YES (status tracking) | Downgrade to free. Credits stop at period end. |
| Plan upgrade/downgrade | DEFERRED | Complex proration logic — separate slice recommended. |
| Renewal | YES (credit reset) | Reset monthly credit allocation at period renewal. |
| Failed payment | YES (status tracking) | Mark past_due. Grace period before downgrade. |
| Refunds/chargebacks | DEFERRED | Complex reversal logic — separate slice recommended. |
| Admin/internal/beta/free users | YES (bypass logic) | Admin bypass exists. Free users have 500 credits. Beta users follow plan allocation. Internal test users bypass balance gate. |

---

## 6. Credit Top-Up Scope

| Decision | Outcome |
|----------|---------|
| Credits purchased as one-time top-up | **YES — future** — one-time credit packs via Stripe checkout session. Contract defined in 05; implementation deferred to child slice. |
| Credits granted monthly by subscription | **YES** — primary credit source. Monthly allocation from `PLAN_DEFINITIONS.monthlyCredits` (free: 500, starter: 5000, pro: 25000, team: 100000). |
| Credits expire | **YES** — at `periodEnd`. `CreditBalance.periodEnd` already exists. Unused monthly credits do not carry over by default (rollover logic deferred). |
| Top-up and subscription credits share `credit_balances` | **YES** — single balance row per user. Top-up adds to `balance`. Monthly reset replaces balance to allocation amount. |
| Relationship to existing `credit_balances` | Additive — top-up credits add to current balance. Monthly renewal sets balance to `monthlyAllocation` (preserving top-up purchased credits requires a `purchased_credits` field — migration likely needed). |
| Relationship to existing `credit_deduction_records` | Unchanged — deductions continue using existing `sourceEventId` idempotency. Top-up grants create a separate audit trail. |
| New credit grant/audit table needed | **LIKELY YES** — `credit_grants` or `credit_transactions` table to record: subscription provisioning, monthly resets, top-up purchases, admin grants. Existing `credit_deduction_records` is write-only for deductions. |

---

## 7. Webhook/Event Scope

| Decision | Outcome |
|----------|---------|
| Webhook events to support | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` |
| Idempotency key model | Stripe event ID (`evt_xxx`) stored in a `webhook_events` table. Duplicate `event_id` → skip processing. |
| Duplicate event handling | Idempotent — check event ID existence before processing. Return 200 on duplicate. |
| Event ordering/replay | Events processed idempotently; no strict ordering required. Stripe retries on failure. State is derived from latest subscription status, not event sequence. |
| Signature verification | **REQUIRED** — `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. Must verify HMAC signature on every webhook. |
| Raw body parsing | **REQUIRED** — NestJS must be configured to provide raw body for the webhook endpoint (not JSON-parsed). Requires middleware or `rawBody: true` on specific route. |
| Error/retry behavior | Return HTTP 200 on success. Return 4xx/5xx to trigger Stripe retry (up to ~3 days). Idempotency ensures safe replay. |
| Audit logging | All webhook events logged to `webhook_events` table with: `event_id`, `event_type`, `payload_hash`, `processed_at`, `status` (received/processed/failed/duplicate). |

---

## 8. User/Customer Mapping

| Decision | Outcome |
|----------|---------|
| Mapping model | 1:1 — one Stripe customer per aiSandBox user. |
| Store provider customer ID | **YES** — already exists: `users.stripe_customer_id` column (nullable varchar(255)). |
| Where to store | Existing `users.stripe_customer_id` field. No migration needed for this field. |
| Email sufficient? | **Insufficient alone** — email is used for Stripe customer creation, but `stripe_customer_id` is the authoritative link. Email changes should not break the mapping. |
| Customer creation trigger | On first paid checkout session or explicit subscription start. Free users do NOT get a Stripe customer until they upgrade. |
| Account deletion / customer deletion | User deletion → Stripe customer NOT automatically deleted (audit/legal retention). Mark locally as deleted. |
| Multi-user/team/org implications | Deferred — `CreditBalance.ownerType` discriminator (`user`/`team`/`org`) already exists for future team billing. Not in scope for BILLING-READY-05. |

---

## 9. Product/Price/Plan Mapping

| Decision | Outcome |
|----------|---------|
| Mapping between PLAN_DEFINITIONS and Stripe | `PLAN_DEFINITIONS` IDs (`free`, `starter`, `pro`, `team`) map to Stripe Price IDs. Mapping stored in config (env or static file). |
| Plan definitions stay static code | **YES for now** — `PLAN_DEFINITIONS` remains in `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts`. DB-backed plan config deferred. |
| Free/beta/admin/internal users | `free` plan → no Stripe subscription required. `admin`/`beta` roles → balance gate bypass (existing). Internal test users → admin bypass. |
| Price IDs as env/config | **YES** — `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_TEAM` in env. Separate config for top-up pack price IDs. |
| Currency | **USD assumed** — existing `Invoice.currency = 'USD'`, existing `BillingSnapshot` in USD. HKD/multi-currency deferred to future task. |

---

## 10. Database/Migration Decision

| Decision | Outcome |
|----------|---------|
| Migration needed | **YES — migration required** |
| Migration timing | Created during implementation child slice (not in Step 2). |

### Likely New Tables/Columns

| Table/Column | Purpose |
|--------------|---------|
| `webhook_events` (NEW) | Idempotency: `id`, `stripe_event_id` (unique), `event_type`, `payload_hash`, `status`, `processed_at`, `created_at` |
| `credit_grants` (NEW) | Audit trail for credit provisioning: `id`, `owner_id`, `grant_type` (subscription_renewal / top_up_purchase / admin_grant), `credits_amount`, `source_event_id`, `stripe_payment_intent_id`, `created_at` |
| `users.plan_status` | Already exists — update enum values if needed (add `past_due`). Currently default `'active'`. |
| `subscriptions` table | Already exists in DB schema (not yet a TypeORM entity) — `stripe_subscription_id`, `plan_type`, `status`, `current_period_start`, `current_period_end`, `cancel_at` |
| `credit_balances.purchased_credits` (NEW column) | Separate purchased top-up credits from monthly allocation (so monthly reset doesn't erase purchased credits). |

### Existing Schema Already Present

- `users.stripe_customer_id` — already exists, nullable.
- `users.plan_type` — already exists.
- `users.plan_status` — already exists.
- `subscriptions` table — exists in raw SQL schema but NOT as a TypeORM entity/migration.
- `credit_balances` — exists with balance, allocation, period tracking.
- `credit_deduction_records` — exists with full idempotency.

---

## 11. Env/Package Decision

| Decision | Outcome |
|----------|---------|
| Env keys likely needed (later) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_TEAM`, `STRIPE_PRICE_ID_TOPUP_*` |
| Package dependency already present | **NO** — `stripe` npm package not installed. |
| Package dependency must be added later | **YES** — `stripe` package required in `services/api-gateway/package.json` during implementation. |
| Do not add env/package in Step 2 | **CONFIRMED** — no changes made. |
| Secrets configured manually by Keith | **YES** — Keith must configure Stripe API keys (test-mode first, then production) in a later step. Keys never committed to source. |

---

## 12. Frontend/UX Scope

### Future UI Needed

| UI Element | Needed? | Priority |
|------------|---------|----------|
| Pricing page | YES | Medium — can be deferred to separate frontend task |
| Billing settings page | YES | Medium — subscription status, plan info, usage |
| Checkout redirect | YES | High — redirect to Stripe Checkout for plan upgrade |
| Billing portal link | YES | Medium — link to Stripe Customer Portal for self-service |
| Credit balance display | YES | High — already blocked (402) users need to see balance |
| Top-up flow | YES | Low — can be deferred to separate task |
| Subscription status | YES | Medium — show current plan, renewal date |
| Payment success/cancel pages | YES | High — redirect targets after Stripe Checkout |

### Multilingual-First Requirement

All future billing UI text must be implemented multilingual-first:

- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

Use existing translation hook pattern. Heroicons v2 Outline only. Impeccable/Emil Kowalski advisory only.

### Current State

- `frontend/app/[locale]/account/page.tsx` — redirects to `/app`. No billing content.
- Only one billing-adjacent translation key exists: `"payment": "Payment"`.
- No pricing, billing settings, checkout, or portal pages exist.

---

## 13. Security/Risk Decisions

| Risk | Mitigation |
|------|-----------|
| Webhook signature verification | **MANDATORY** — all webhook requests must pass `stripe.webhooks.constructEvent` HMAC verification. Reject unsigned/invalid requests with 400. |
| Raw body parsing risk | NestJS JSON middleware strips raw body. Must use `rawBody: true` option or dedicated middleware on webhook route only. Route isolation prevents accidental exposure. |
| Replay/idempotency risk | `webhook_events.stripe_event_id` UNIQUE constraint. Duplicate events return 200 immediately without reprocessing. |
| Double-credit risk | Credit grant idempotency via `credit_grants.source_event_id` unique constraint. Same subscription renewal event cannot grant credits twice. |
| Missed-credit risk | Stripe retries failed webhooks for ~3 days. Idempotent handlers ensure safe replay. Monitor for webhook delivery failures via Stripe dashboard. |
| Customer mismatch risk | Webhook handler must verify `customer` field maps to known `users.stripe_customer_id`. Reject events for unknown customers. |
| Secret leakage risk | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` never logged, never in source, never in error messages. Validate env at startup; fail-fast if missing when `BILLING_CHARGES_ENABLED=true`. |
| Test-mode/live-mode confusion risk | Use separate env files. `STRIPE_SECRET_KEY` prefix distinguishes (`sk_test_` vs `sk_live_`). Log mode at startup. `ChargeReadinessService` gate provides additional system-level lock. |
| Refund/chargeback risk | Deferred — not in initial scope. When implemented: revoke credits on refund; flag account on chargeback; audit trail required. |
| Billing fraud/abuse risk | Rate limit checkout session creation. One active subscription per user. Free plan cannot bypass balance gate (except admin). Monitor for repeated failed payments. |
| Concurrency/race risk | Existing `SELECT ... FOR UPDATE` on `credit_balances` protects concurrent deductions. Credit grants should also use transactional writes with conflict detection. Webhook event idempotency prevents concurrent duplicate processing. |

---

## 14. Implementation Boundary Recommendation

### API Gateway Backend

| File | Action | Purpose |
|------|--------|---------|
| `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | REPLACE | Real Stripe SDK integration (customer creation, checkout session) |
| `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | EXTEND | Add checkout session, subscription, webhook methods |
| `services/api-gateway/src/payments/payments.module.ts` | EXTEND | Import Stripe SDK, configure with env keys |
| `services/api-gateway/src/payments/stripe-webhook.controller.ts` | CREATE | Webhook endpoint with raw body + signature verification |
| `services/api-gateway/src/payments/stripe-webhook.service.ts` | CREATE | Event routing + idempotency check |
| `services/api-gateway/src/payments/stripe-checkout.controller.ts` | CREATE | `POST /api/billing/checkout` — create checkout session |
| `services/api-gateway/src/payments/stripe-checkout.service.ts` | CREATE | Checkout session creation logic |
| `services/api-gateway/src/payments/stripe-subscription.service.ts` | CREATE | Subscription lifecycle handlers |
| `services/api-gateway/src/billing/credit-grant.service.ts` | CREATE | Credit provisioning on subscription/renewal/top-up |
| `services/api-gateway/src/billing/credit-grant.repository.ts` | CREATE | Repository for `credit_grants` table |
| `services/api-gateway/src/entities/webhook-event.entity.ts` | CREATE | `webhook_events` TypeORM entity |
| `services/api-gateway/src/entities/credit-grant.entity.ts` | CREATE | `credit_grants` TypeORM entity |
| `services/api-gateway/src/entities/subscription.entity.ts` | CREATE | `subscriptions` TypeORM entity (table already exists in raw SQL) |
| `services/api-gateway/src/admin/charge-readiness.service.ts` | MODIFY | Update readiness conditions for real Stripe config |
| `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | INSPECT ONLY | Provide plan → price ID mapping in separate config |

### Database/Migrations

| File | Action |
|------|--------|
| `services/api-gateway/src/migrations/XXXXXXXXX-CreateWebhookEventsTable.ts` | CREATE |
| `services/api-gateway/src/migrations/XXXXXXXXX-CreateCreditGrantsTable.ts` | CREATE |
| `services/api-gateway/src/migrations/XXXXXXXXX-CreateSubscriptionsTypeORMEntity.ts` | CREATE (align existing raw SQL table with TypeORM) |
| `services/api-gateway/src/migrations/XXXXXXXXX-AddPurchasedCreditsToBalances.ts` | CREATE (add `purchased_credits` column) |

### Frontend/UI

| File | Action |
|------|--------|
| `frontend/app/[locale]/billing/page.tsx` | CREATE — billing settings page |
| `frontend/app/[locale]/billing/checkout/success/page.tsx` | CREATE — post-checkout success |
| `frontend/app/[locale]/billing/checkout/cancel/page.tsx` | CREATE — post-checkout cancel |
| `frontend/components/billing/plan-card.tsx` | CREATE — plan display component |
| `frontend/components/billing/credit-balance-display.tsx` | CREATE — balance widget |
| `frontend/messages/en.json` | MODIFY — add billing translation keys |
| `frontend/messages/zh-TW.json` | MODIFY — add billing translation keys |
| `frontend/messages/zh-CN.json` | MODIFY — add billing translation keys |

### Config/Env

| File | Action |
|------|--------|
| `.env.example` | MODIFY — add Stripe env key placeholders |
| `services/api-gateway/src/startup/configuration.validator.ts` | MODIFY — validate Stripe keys when charging enabled |

### Tests

| File | Action |
|------|--------|
| `services/api-gateway/src/payments/__tests__/stripe-webhook.controller.spec.ts` | CREATE |
| `services/api-gateway/src/payments/__tests__/stripe-webhook.service.spec.ts` | CREATE |
| `services/api-gateway/src/payments/__tests__/stripe-checkout.service.spec.ts` | CREATE |
| `services/api-gateway/src/payments/__tests__/stripe-subscription.service.spec.ts` | CREATE |
| `services/api-gateway/src/billing/__tests__/credit-grant.service.spec.ts` | CREATE |
| Existing 04A/04B/04C/04D test suites | REGRESSION — must remain passing |

### Docs/Checkpoints

| File | Action |
|------|--------|
| `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | CREATED (this file) |
| `docs/BILLING-READY-05-CHECKPOINT.md` | CREATE (at parent close) |
| `docs/BILLING-READY-05X-CHECKPOINT.md` | CREATE (per child slice) |

---

## 15. Split Decision

**Decision: B — Split BILLING-READY-05 into child slices.**

### Rationale

BILLING-READY-05 is HIGH risk with multiple independent subsystems (Stripe SDK, webhook handler, subscription persistence, credit grants, checkout flow, frontend billing UI). A single bounded Step 3 implementation would:

- Exceed reasonable single-pass scope.
- Mix security-critical webhook code with frontend UI work.
- Require Stripe API keys at varying stages.
- Make regression analysis difficult.

### Proposed Child Slices (NOT REGISTERED — requires Keith approval)

| Slice | Name | Scope | Risk |
|-------|------|-------|------|
| **05A** | Provider Configuration / Contracts / SDK Setup | Install `stripe` package; create real `StripePaymentProvider` with SDK; env key validation; `ChargeReadinessService` update; TypeORM subscription entity. No live API calls. | MEDIUM |
| **05B** | Customer/Subscription Persistence | `webhook_events` + `credit_grants` + subscription TypeORM entities; migrations; repositories; unit tests. No webhook endpoint, no live calls. | MEDIUM |
| **05C** | Checkout Session Creation | `POST /api/billing/checkout` endpoint; Stripe `checkout.sessions.create` (test-mode); success/cancel URL handling; guards. Requires test-mode API key from Keith. | HIGH |
| **05D** | Webhook Event Ingestion / Idempotency | Webhook controller; raw body middleware; signature verification; event routing; idempotency; subscription status updates; credit grant trigger. Requires webhook secret from Keith. | HIGH |
| **05E** | Credit Grant / Top-Up Accounting | `CreditGrantService`; monthly allocation reset on renewal; top-up credit addition; `purchased_credits` migration; grant idempotency; concurrency safety. | HIGH |
| **05F** | Billing UI / Customer Portal | Frontend billing page; plan display; checkout redirect; balance display; success/cancel pages; multilingual translations. | MEDIUM |
| **05G** | Regression / Runtime Validation + Parent Consolidation | Full regression matrix; test-mode smoke (if Keith provides keys); parent BILLING-READY-05 close. | MEDIUM |

### Dependency Order

```
05A → 05B → 05C → 05D → 05E → 05F → 05G
              ↘           ↗
               (05C and 05D can partially parallel after 05B)
```

### Keith Decisions Required Before Child-Slice Registration

1. Approve child-slice split structure.
2. Confirm Stripe account exists (test mode).
3. Confirm willingness to provide test-mode API keys at 05C.
4. Confirm willingness to configure webhook endpoint (local tunnel or deployed) at 05D.
5. Confirm whether 05F (frontend) can be deferred or must be included.

---

## 16. Test Plan

| Test Area | Approach |
|-----------|----------|
| Provider config disabled state | Unit test: `StripePaymentProvider` returns error when keys missing; `ChargeReadinessService` blocks. |
| Checkout session creation | Unit test: mock Stripe SDK; verify correct parameters passed. Integration test: verify auth guard, request validation, response shape. |
| Customer mapping | Unit test: verify `stripe_customer_id` stored on user after customer creation. |
| Subscription event handling | Unit test: mock webhook events; verify status transitions on `users.planType`/`planStatus`. |
| Payment success / top-up credit grant | Unit test: mock `invoice.paid` event; verify credits added to `credit_balances.balance`. |
| Duplicate webhook idempotency | Unit test: send same event ID twice; verify processing occurs only once; second call returns 200 without side effects. |
| Signature verification | Unit test: invalid signature → 400; valid signature → processing. |
| Refund/chargeback handling | DEFERRED — not in initial 05 scope. |
| No live provider calls in unit tests | **MANDATORY** — all Stripe SDK calls mocked in unit/integration tests. Test-mode calls only in explicit smoke validation (Keith approval required). |
| Existing BILLING-READY-04 invariants | Regression: all 12 commands from 04D regression matrix must remain PASS. Guard behavior, deduction idempotency, finalization bridge unchanged. |

---

## 17. Runtime/Provider Validation Decision

| Decision | Outcome |
|----------|---------|
| No runtime/provider validation in Step 2 | **CONFIRMED** — this step is review-only. |
| Mocked provider validation | YES — all unit tests use mocked Stripe SDK. |
| Stripe test-mode validation | LATER — only after Keith provides test-mode keys (child slice 05C/05D). |
| Live provider validation | OUT OF SCOPE — production Stripe calls require separate Keith approval, legal/compliance review. |
| Docker/Postgres/Redis required in future | YES — migrations require PostgreSQL. Webhook handler tests may use in-memory DB. Credit grant tests require balance row. |
| Keith approval required before provider calls | **YES** — explicit Keith approval required before any Stripe API call (test-mode or live). |

---

## 18. Step 3 Readiness Conclusion

| Criterion | Status |
|-----------|--------|
| Ready for Step 3? | **NOT READY for single Step 3** — scope too large for one bounded implementation. |
| Child-slice registration required? | **YES** — split into 05A–05G recommended. |
| Recommended next action | Keith reviews this document, approves/modifies split structure, then child-slice registration occurs in a dedicated new-window session. |
| Recommended model for child-slice registration | Sonnet 4.6 (governance/planning). |
| Recommended model for 05A/05B implementation | GPT-5.3 Codex (routine implementation). |
| Recommended model for 05C/05D implementation | GPT-5.3 Codex High (security-adjacent, provider integration). |
| Recommended model for 05F implementation | GPT-5.3 Codex (frontend routine). |
| Exact next prompt type | **Child-slice registration prompt** — register 05A–05G in TASKS.md with acceptance criteria. No implementation. |

---

## 19. Safety Confirmations

| Constraint | Status |
|-----------|--------|
| No source files changed | **CONFIRMED** |
| No test files changed | **CONFIRMED** |
| No governance files changed (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | **CONFIRMED** |
| No frontend files changed | **CONFIRMED** |
| No .env files changed | **CONFIRMED** |
| No package.json files changed | **CONFIRMED** |
| No migrations created | **CONFIRMED** |
| No Docker/PostgreSQL/Redis started | **CONFIRMED** |
| No builds/tests run | **CONFIRMED** |
| No Stripe/payment/provider API calls | **CONFIRMED** |
| No AGENT-HARNESS write canary involvement | **CONFIRMED** |
| No child slices registered | **CONFIRMED** — proposed only, not registered |

---

## 20. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence |
| 4 | `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor checkpoint |
| 5 | `docs/BILLING-READY-04D-CHECKPOINT.md` | Predecessor child-slice checkpoint |
| 6 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | Foundation checkpoint |
| 7 | `services/api-gateway/src/payments/payments.module.ts` | Existing payment module stub |
| 8 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Existing Stripe stub |
| 9 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Existing payment interface |
| 10 | `services/api-gateway/src/admin/charge-readiness.service.ts` | Financial kill-switch gate |
| 11 | `services/api-gateway/src/entities/user.entity.ts` | User entity (stripeCustomerId) |
| 12 | `services/api-gateway/src/entities/credit-balance.entity.ts` | Credit balance entity |
| 13 | `services/api-gateway/src/entities/credit-deduction-record.entity.ts` | Deduction record entity |
| 14 | `services/api-gateway/src/entities/plan.entity.ts` | Plan entity |
| 15 | `services/api-gateway/src/entities/invoice.entity.ts` | Invoice entity |
| 16 | `services/api-gateway/src/entities/billing-snapshot.entity.ts` | Billing snapshot entity |
| 17 | `services/api-gateway/src/entities/user-role.enum.ts` | User roles (admin/user/beta) |
| 18 | `services/api-gateway/src/billing/billing.module.ts` | Billing module |
| 19 | `services/api-gateway/src/billing/credit-balance.guard.ts` | Balance gate guard |
| 20 | `services/api-gateway/src/billing/credit-deduction/types.ts` | Deduction event types |
| 21 | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | Plan definitions |
| 22 | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | Plan definition types |
| 23 | `services/api-gateway/src/credit-ledger/types/credit-ledger.ts` | Credit ledger types |
| 24 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Usage ledger service |
| 25 | `database/schema.sql` | Raw SQL schema (subscriptions table) |
| 26 | `package.json` | Root package.json |
| 27 | `services/api-gateway/package.json` | API Gateway dependencies |
| 28 | `.env.example` | Environment template |
| 29 | `frontend/app/[locale]/account/page.tsx` | Account page (redirect only) |
| 30 | `frontend/messages/en.json` | English translations |
| 31 | `frontend/messages/zh-TW.json` | Traditional Chinese translations |
| 32 | `frontend/messages/zh-CN.json` | Simplified Chinese translations |

---

## 21. Summary

BILLING-READY-05 Step 2 is **COMPLETE**. The payment provider readiness review confirms:

1. **Stripe** is the selected provider (aligns with existing schema/stubs).
2. Scope is **too large for a single bounded implementation** — child-slice split recommended.
3. **7 child slices** proposed: 05A (SDK/contracts) → 05B (persistence) → 05C (checkout) → 05D (webhooks) → 05E (credit grants) → 05F (frontend) → 05G (regression/close).
4. **Keith decisions required** before registration: approve split, confirm Stripe account, plan key provisioning timeline.
5. No source, env, package, test, migration, or governance files were modified.
6. All BILLING-READY-04 invariants remain intact.
7. AGENT-HARNESS write canary remains a separate track.
