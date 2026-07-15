# BILLING-READY-05E — Credit Grant / Top-Up Accounting Readiness Review

**Task ID:** BILLING-READY-05E
**Step:** 2 — Credit Grant / Top-Up Accounting Readiness / Exact Ledger Boundary
**Status:** COMPLETE
**Date:** 2026-07-15
**Nature:** Static readiness review — read-only — no implementation

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05E ACTIVE | **CONFIRMED** — Step 1 COMPLETE (Registration — 2026-07-15). Step 2 is this review. |
| BILLING-READY-05 ACTIVE (parent) | **CONFIRMED** — Steps 1–2 COMPLETE (2026-07-13). Keith approved split into 05A–05G. Step 3 IN PROGRESS via child slices. 05A COMPLETE and LOCKED. 05B COMPLETE and LOCKED. 05C COMPLETE and LOCKED. 05D COMPLETE and LOCKED. 05E is current ACTIVE child slice. |
| BILLING-READY-05A COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. Provider mode contract (`disabled`/`stub`/`test`/`live`), `ProviderResult<T>`, `ProviderErrorCode`, mode-aware `StripePaymentProvider` with `verifyWebhookSignature()`, `parseWebhookEvent()`, `mapEventType()`. 79 tests PASS. No Stripe SDK. No provider API calls. |
| BILLING-READY-05B COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. `Subscription` entity, `SubscriptionRepository`, `SubscriptionModule`, 2 migrations (not executed). 53 tests PASS. No Stripe SDK. No provider API calls. |
| BILLING-READY-05C COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. `CheckoutController` (`POST subscription`, `POST topup`), `CheckoutService`, `CheckoutModule`, DTOs, price map config (`TOP_UP_PACK_MAP`, `CHECKOUT_PLAN_PRICE_MAP`), URL validator, `AppModule` update. 58 tests PASS. No Stripe SDK. No provider API calls. |
| BILLING-READY-05D COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. `WebhookEvent` entity, `WebhookEventRepository`, `WebhookService`, `WebhookController`, `WebhookModule`, `main.ts` rawBody, migration (not executed), `AppModule` update. 108 tests PASS. No Stripe SDK. No provider API calls. No credit balance mutation. Top-up events recorded with status `ignored` — credit grant deferred to 05E. |
| BILLING-READY-05F/05G | **PLANNED ONLY** — not registered. Registration deferred. |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-13. All child slices (04A/04B/04C/04D) COMPLETE and LOCKED. Regression matrix PASS 12/12. Credit balance persistence, deduction gateway, CreditBalanceGuard, worker finalization bridge. |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. All 7 child slices COMPLETE and LOCKED. Credit ledger foundation. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | **CONFIRMED** — 2026-07-12. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-09. |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05E is the current ACTIVE child slice; parent BILLING-READY-05 is ACTIVE with child-slice execution in progress. |

---

## 2. Source-of-Truth Summary

### 2.1 From BILLING-READY-04 (Credit Balance / Deduction Foundations)

| Asset | Detail |
|-------|--------|
| `CreditBalance` entity | `@Entity('credit_balances')` — `id` (UUID PK), `ownerId`, `ownerType` (default `'user'`), `planId`, `balance`, `monthlyAllocation`, `rolloverBalance`, `status`, `periodStart`, `periodEnd`, `resetAt`, `createdAt`, `updatedAt`. Unique index on `(ownerId, ownerType)`. CHECK: `balance >= 0`. |
| `CreditBalanceRepository` | `findByOwner()`, `findByOwnerForUpdate()` (pessimistic_write lock), `create()`, `deductBalance()`, `resetForNewPeriod()`. |
| `PersistentCreditDeductionGateway` | `applyDeduction()` — atomic `DataSource.transaction()` → lock balance FOR UPDATE → calculate → INSERT deduction record → UPDATE balance → commit. Idempotency via `sourceEventId` unique constraint on `credit_deduction_records`. Race handled by 23505 catch. |
| `CreditDeductionRecord` entity | `@Entity('credit_deduction_records')` — immutable, `sourceEventId` unique index, `ownerId`, `requestedCredits`, `appliedCredits`, `overflowCredits`, `balanceBefore`, `balanceAfter`, `lineItems` JSONB. |
| `CreditPersistenceModule` | Imports `TypeOrmModule.forFeature([CreditBalance, CreditDeductionRecord])`, provides/exports `CreditBalanceRepository`, `CreditDeductionRecordRepository`. |
| `CreditBalanceGuard` | Enforces `balance > 0` at execution-start. Admin bypass. HTTP 402 on insufficient balance. |
| Transaction pattern | `DataSource.transaction(async (manager) => { ... })` using passed `EntityManager` for lock + update atomicity. |

### 2.2 From BILLING-READY-05C (Top-Up Package Mapping and Checkout Response)

| Asset | Detail |
|-------|--------|
| `TOP_UP_PACK_MAP` | `topup_1000` → 1,000 credits, `topup_5000` → 5,000 credits, `topup_20000` → 20,000 credits. Placeholder `stripePriceId` values. |
| `CHECKOUT_PLAN_PRICE_MAP` | `starter` → 5,000 monthlyCredits, `pro` → 25,000 monthlyCredits, `team` → 100,000 monthlyCredits. |
| Checkout metadata gap | `userId`, `checkoutType`, `planId`/`topUpPackId` are passed to `createCheckoutSession()` but NOT embedded as Stripe session metadata. Webhook cannot identify which topUpPackId was purchased without metadata. |
| Top-up checkout creates `mode = 'payment'` | Distinguishes from subscription (`mode = 'subscription'`). |

### 2.3 From BILLING-READY-05D (Webhook Event Ingestion and Top-Up Deferral)

| Asset | Detail |
|-------|--------|
| `WebhookService.handleCheckoutCompleted()` | If `mode === 'payment'` → logs "deferred to 05E" and returns early. Event status: `processed` (not `ignored` — the event handler returns without throwing). |
| `WebhookService.handleInvoicePaid()` | If no `subscriptionId` → logs "deferred to 05E" and returns early (non-subscription invoice). |
| `WebhookEvent` entity | Records all events with `providerEventId`, `provider`, `eventType`, `internalEventType`, `status`, `payloadHash`, `errorMessage`, `errorCode`, `attempts`, timestamps. |
| `WebhookEventRepository` | `findByProviderEventId()`, `createEvent()`, `updateEventStatus()`, `incrementAttempts()`. |
| Idempotency | Unique constraint on `(provider, providerEventId)`. Duplicates increment `attempts`, skip processing. |
| Event status model | `received` → `verified` → `processing` → `processed` / `ignored` / `failed`. |
| Top-up deferral pattern | Top-up `checkout_completed` events flow through the normal handler, log deferral, and return. The webhook_event status ends as `processed` (not `ignored`). Credit grant is the deferred action. |

### 2.4 From BILLING-READY-05 Parent (Payment Readiness Decisions)

| Decision | Outcome |
|----------|---------|
| Stripe selected | CONFIRMED |
| 05E scope (from parent split) | `credit_grants` table/entity, `CreditGrantService`, monthly allocation resets, top-up credit additions, balance crediting for deferred events. |
| No provider calls in 05E registration | CONFIRMED — no Stripe SDK, no env/secrets, no package changes, no migrations, no credit balance mutation approved during registration. |

### 2.5 From Credit-Ledger Foundation (BILLING-READY-01/03)

| Asset | Detail |
|-------|--------|
| `MONTHLY_CREDIT_ALLOCATIONS` | `free: 500`, `starter: 5000`, `pro: 25000`, `team: 100000`. |
| `PLAN_IDS` | `['free', 'starter', 'pro', 'team']` |
| `PLAN_DEFINITIONS` | Full plan config with `monthlyCredits`, entitlements. |

### 2.6 Provider Call / SDK / Env Confirmation

- **No provider API calls approved** by 05E registration.
- **No Stripe SDK/package install approved** by 05E registration.
- **No env/secrets/package changes approved** by 05E registration.
- **No migration creation/execution approved** during registration.
- **No credit balance mutation approved** during registration.
- All of these require explicit Keith approval before Step 3 implementation.

---

## 3. Existing Credit/Accounting Source-Path Findings

### 3.1 CreditBalance Entity/Table/Repository

| Item | Location |
|------|----------|
| Entity | `services/api-gateway/src/entities/credit-balance.entity.ts` — `@Entity('credit_balances')` |
| Repository | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` — `CreditBalanceRepository` |
| Module | `services/api-gateway/src/billing/credit-deduction/credit-persistence.module.ts` — `CreditPersistenceModule` |
| Table columns | `id`, `owner_id`, `owner_type`, `plan_id`, `balance`, `monthly_allocation`, `rollover_balance`, `status`, `period_start`, `period_end`, `reset_at`, `created_at`, `updated_at` |
| Key methods | `findByOwner(ownerId, ownerType)`, `findByOwnerForUpdate(ownerId, ownerType, manager)`, `create(params)`, `deductBalance(id, newBalance, manager)`, `resetForNewPeriod(id, params)` |
| No `addBalance` method | Does not exist — only `deductBalance` and `resetForNewPeriod`. 05E will need a new method for balance addition. |

### 3.2 Credit Deduction Gateway/Service

| Item | Location |
|------|----------|
| Gateway | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` — `PersistentCreditDeductionGateway` |
| Pattern | `DataSource.transaction()` → `findByOwnerForUpdate()` → calculate → `create()` deduction record → `deductBalance()` → commit |
| Idempotency | `sourceEventId` unique index on `credit_deduction_records` + pre-transaction check + 23505 race fallback |
| Reference for 05E | This is the reference pattern for atomic credit balance mutation with idempotency. 05E credit grant will follow the same transactional pattern in reverse (balance addition instead of deduction). |

### 3.3 Usage Ledger / Idempotency Patterns

| Item | Location |
|------|----------|
| Service | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` — `UsageLedgerService` |
| Idempotency | `requestId` unique constraint on `usage_records`. 23505 → fetch existing. |
| Deduction trigger | `emitDeductionAttempt()` after `updateExecutionResult()` or `triggerDeductionForExecution()`. |
| Transaction pattern | Deduction uses `DataSource.transaction()` internally. Usage ledger service does not wrap deduction in its own transaction. |

### 3.4 Checkout Top-Up Package Mapping

| Item | Location |
|------|----------|
| Config | `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts` |
| Interface | `TopUpPackEntry` — `{ packId, displayName, credits, stripePriceId }` |
| Values | `topup_1000: 1000 credits`, `topup_5000: 5000 credits`, `topup_20000: 20000 credits` |
| Export | `TOP_UP_PACK_MAP`, `VALID_TOP_UP_PACK_IDS` |

### 3.5 Webhook Event Repository/Service

| Item | Location |
|------|----------|
| Entity | `services/api-gateway/src/entities/webhook-event.entity.ts` — `WebhookEvent` |
| Repository | `services/api-gateway/src/billing/webhook/webhook-event.repository.ts` — `WebhookEventRepository` |
| Service | `services/api-gateway/src/billing/webhook/webhook.service.ts` — `WebhookService` |
| Module | `services/api-gateway/src/billing/webhook/webhook.module.ts` — `WebhookModule` (exports `WebhookService`) |
| Top-up deferral | `handleCheckoutCompleted()` returns early for `mode === 'payment'`; `handleInvoicePaid()` returns early for missing `subscriptionId`. |

### 3.6 Subscription Renewal Event Handling

| Event | Current Behavior |
|-------|-----------------|
| `invoice_paid` (with subscriptionId) | Updates `currentPeriodStart`/`currentPeriodEnd`, sets status `active`. No credit grant. |
| `invoice_paid` (without subscriptionId) | Returns early — "deferred to 05E". No credit grant. |
| `checkout_completed` (subscription mode) | Creates subscription, updates user plan. No credit grant. |
| `checkout_completed` (payment/top-up mode) | Returns early — "deferred to 05E". No credit grant. |

### 3.7 Existing Migration Conventions

| Convention | Pattern |
|-----------|---------|
| Filename | `{timestamp}-{PascalCaseName}.ts` |
| Latest timestamp | `1772300000000` (webhook_events table from 05D) |
| SQL style | Raw SQL via `queryRunner.query()` |
| Idempotency | `CREATE TABLE IF NOT EXISTS`, `IF NOT EXISTS` / `IF EXISTS` |
| Down migration | Full reverse: drop indexes, drop table |
| No data mutation | Schema-only |

### 3.8 Any Existing Credit Grant/Top-Up Placeholders

| Finding | Detail |
|---------|--------|
| `credit_grants` table | **DOES NOT EXIST** — no entity, no migration, no table anywhere. |
| `CreditGrant` class | **DOES NOT EXIST** — only referenced in 05D webhook service test as a negative assertion (`expect(source).not.toContain('CreditGrant')`). |
| `CreditGrantService` | **DOES NOT EXIST** — deferred to 05E per 05D checkpoint. |
| Credit balance `addBalance` or `addCredits` | **DOES NOT EXIST** — `CreditBalanceRepository` has `deductBalance()` and `resetForNewPeriod()` but no `addBalance()` method. |
| `purchased_credits` / `subscription_credits` columns | **DO NOT EXIST** on `credit_balances`. Only a single `balance` column. |

---

## 4. credit_grants Schema / Migration Decision

### 4.1 Whether credit_grants Table Already Exists

**NO.** No `credit_grants` table, entity, or migration exists anywhere in the codebase.

### 4.2 Whether New TypeORM Entity Is Needed

**YES.** A new `CreditGrant` entity at `services/api-gateway/src/entities/credit-grant.entity.ts`.

### 4.3 Whether Migration Is Needed

**YES.** A new migration to create the `credit_grants` table. Migration file created but NOT executed (consistent with 05B/05D convention). Keith must approve migration before Step 3 implementation.

### 4.4 Exact Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Internal PK |
| `owner_id` | `varchar(50)` | NOT NULL | — | User ID (matches `credit_balances.owner_id`) |
| `owner_type` | `varchar(20)` | NOT NULL | `'user'` | Discriminator for future team/org (matches `credit_balances.owner_type`) |
| `grant_type` | `varchar(30)` | NOT NULL | — | `'topup'` \| `'subscription_monthly'` \| `'subscription_initial'` \| `'admin'` \| `'promotional'` |
| `source_type` | `varchar(30)` | NOT NULL | — | `'webhook'` \| `'system'` \| `'admin'` |
| `source_event_id` | `varchar(255)` | NOT NULL | — | Idempotency key — Stripe event ID for webhook grants, or deterministic composite for system/admin grants |
| `provider` | `varchar(50)` | NOT NULL | `'stripe'` | Payment provider identifier |
| `provider_event_id` | `varchar(255)` | NULL | — | Stripe event ID (`evt_xxx`) — denormalized from `webhook_events` for audit |
| `webhook_event_id` | `uuid` | NULL | — | FK reference to `webhook_events.id` (nullable — admin/system grants have no webhook) |
| `plan_type` | `varchar(50)` | NULL | — | Plan type at time of grant (`starter`/`pro`/`team`) — for subscription grants |
| `top_up_pack_id` | `varchar(50)` | NULL | — | Top-up pack identifier (`topup_1000`/`topup_5000`/`topup_20000`) — for top-up grants |
| `amount` | `integer` | NOT NULL | — | Credit amount granted (positive integer) |
| `balance_before` | `integer` | NOT NULL | — | Balance snapshot before grant |
| `balance_after` | `integer` | NOT NULL | — | Balance snapshot after grant |
| `status` | `varchar(20)` | NOT NULL | `'pending'` | Grant status (see Section 5) |
| `error_code` | `varchar(50)` | NULL | — | Error code if grant failed |
| `error_message` | `text` | NULL | — | Error detail if grant failed |
| `granted_at` | `timestamptz` | NULL | — | When credits were actually applied to balance |
| `created_at` | `timestamptz` | NOT NULL | `NOW()` | Record creation time |
| `updated_at` | `timestamptz` | NOT NULL | `NOW()` | Record update time |

### 4.5 Unique Idempotency Constraint

**UNIQUE index on `source_event_id`** — prevents double-credit on retries, duplicate webhooks, or concurrent processing.

```
idx_credit_grants_source_event_id UNIQUE (source_event_id)
```

Rationale: `source_event_id` is the global idempotency key. For webhook-triggered grants, this is the Stripe `evt_xxx` event ID. For subscription monthly grants from `invoice_paid`, this is the event ID. Since each Stripe event has a globally unique ID and each event should produce at most one credit grant, this is the natural idempotency boundary.

### 4.6 Additional Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_credit_grants_owner` | `(owner_id, owner_type)` | Fast lookup by owner |
| `idx_credit_grants_webhook_event` | `(webhook_event_id)` WHERE NOT NULL | Join to webhook_events for audit |
| `idx_credit_grants_status` | `(status)` | Status-based queries (e.g., find failed grants) |
| `idx_credit_grants_created_at` | `(created_at DESC)` | Ordering/pagination |
| `idx_credit_grants_grant_type` | `(grant_type)` | Filter by grant category |

### 4.7 Payload/Reference Storage Decision

**No full payload stored.** The `webhook_event_id` FK links back to the `webhook_events` record which stores the `payloadHash`. Stripe event payloads are NOT persisted (per 05D decision). The `credit_grants` record stores only the derived grant data (amount, type, pack ID, etc.).

### 4.8 CHECK Constraints

```sql
CHECK ("amount" > 0)
CHECK ("balance_after" >= "balance_before")
```

### 4.9 Down Migration Expectations

Full reverse: drop indexes first, then drop table. `IF EXISTS` guards for idempotency.

### 4.10 Whether Migration Approval Is Needed Before Step 3

**YES** — migration creates a new table. Keith must approve before Step 3 (migration file created but NOT executed, consistent with 05B/05D convention).

---

## 5. Credit Grant Status/Model Decision

### 5.1 Exact Statuses

| Status | Description | Terminal? |
|--------|-------------|-----------|
| `pending` | Grant record created, balance not yet updated | No |
| `granted` | Credits applied to balance successfully | Yes |
| `failed` | Grant processing failed (DB error, missing balance) | Yes |
| `ignored` | Grant intentionally skipped (duplicate, unknown pack, etc.) | Yes |

### 5.2 Which Statuses Are Persisted

ALL statuses are persisted to `credit_grants`. Every grant attempt produces a record regardless of outcome — full audit trail.

### 5.3 What Failures Are Stored

| Failure | Stored | `error_code` | `error_message` |
|---------|--------|--------------|-----------------|
| Balance row not found | YES | `BALANCE_NOT_FOUND` | `No credit_balance row for owner` |
| Unknown top-up pack | YES | `UNKNOWN_PACK` | `Top-up pack ID not in TOP_UP_PACK_MAP` |
| Amount resolution failed | YES | `AMOUNT_RESOLUTION_FAILED` | `Cannot determine credit amount` |
| DB/transaction error | YES | `TRANSACTION_ERROR` | DB error message (no secrets) |
| Duplicate grant (source_event_id exists) | NO — returns existing without new record | — | — |

### 5.4 Whether Grants Are Immutable After `granted`

**YES.** Once a grant reaches `granted` status, it is immutable. No further status transitions permitted. `balance_before`/`balance_after` are snapshot values captured at grant time.

### 5.5 Whether Reversals/Refunds Are Deferred

**YES — fully deferred.** Refund/reversal logic (e.g., `charge.refunded` → deduct previously-granted credits) is out of scope for 05E. Future task 05G or a follow-up will handle reversals. If needed, a new `reversed` status and a corresponding negative credit entry pattern will be introduced then.

---

## 6. Top-Up Package to Credit Amount Decision

### 6.1 Exact Top-Up Packages from 05C

| Pack ID | Credits | Display Name |
|---------|---------|-------------|
| `topup_1000` | 1,000 | 1,000 Credits |
| `topup_5000` | 5,000 | 5,000 Credits |
| `topup_20000` | 20,000 | 20,000 Credits |

### 6.2 Whether Amount Is Credits, Tokens, or Billing Units

**Credits.** The amount is in platform credits — the same unit as `credit_balances.balance`, `credit_deduction_records.appliedCredits`, and `MONTHLY_CREDIT_ALLOCATIONS`. Not raw tokens. Not billing currency.

### 6.3 Whether Real Price IDs Remain Placeholder/Deferred

**YES — deferred.** `TOP_UP_PACK_MAP` uses `price_placeholder_topup_*` values. Real Stripe price IDs will be supplied via environment configuration in a future approved task. 05E does not need real price IDs — it maps from `topUpPackId` to credits, not from `stripePriceId`.

### 6.4 Whether User-Supplied Amount Is Rejected

**YES.** Users cannot supply arbitrary credit amounts. The grant amount is always derived server-side from `TOP_UP_PACK_MAP[topUpPackId].credits`. No user input controls the granted amount.

### 6.5 Whether Package Mapping Should Be Shared with 05C or Duplicated Safely

**Shared — import from 05C config.** The `CreditGrantService` will import `TOP_UP_PACK_MAP` from `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts`. No duplication. Single source of truth for pack → credits mapping.

---

## 7. Subscription Monthly/Renewal Credit Model Decision

### 7.1 Whether 05E Handles Subscription Monthly Credit Grants Now

**YES — 05E implements subscription monthly credit grants** triggered by `invoice_paid` events with a subscription ID. This is core credit accounting.

### 7.2 How plan_type Maps to Monthly Credits

| Plan Type | Monthly Credits | Source |
|-----------|----------------|--------|
| `free` | 500 | `MONTHLY_CREDIT_ALLOCATIONS.free` |
| `starter` | 5,000 | `MONTHLY_CREDIT_ALLOCATIONS.starter` |
| `pro` | 25,000 | `MONTHLY_CREDIT_ALLOCATIONS.pro` |
| `team` | 100,000 | `MONTHLY_CREDIT_ALLOCATIONS.team` |

The `CreditGrantService` will import `MONTHLY_CREDIT_ALLOCATIONS` from `services/api-gateway/src/credit-ledger/types/plan-definition.ts` via the barrel export.

### 7.3 Whether Monthly Grants Occur on invoice_paid Only

**YES.** Monthly/renewal credit grants are triggered only by `invoice_paid` events with a valid subscription ID. This represents a successful billing cycle renewal by Stripe.

### 7.4 Whether checkout.session.completed Subscription Grants Initial Credits

**YES.** Initial subscription credits are granted on `checkout.session.completed` with `mode === 'subscription'`. This represents the first billing cycle. The `source_event_id` is the checkout session event ID — preventing double-grant if both `checkout.session.completed` and the initial `invoice_paid` arrive for the same subscription start.

**Decision for overlap:** If Stripe sends both `checkout.session.completed` AND `invoice.paid` for the initial subscription payment, the idempotency key will prevent double-credit. The `source_event_id` for the initial grant will use the Stripe event ID of whichever event arrives first. The second event will hit the unique constraint and be treated as a duplicate (no double-credit). In practice, 05E will grant on `checkout.session.completed` for initial subscription; `invoice_paid` will be the trigger for renewals only.

**Practical approach:** The `handleCheckoutCompleted()` for subscription mode triggers an initial credit grant. The `handleInvoicePaid()` for subscription renewal triggers monthly credit grants. The idempotency key (`source_event_id = evt_xxx`) ensures no overlap.

### 7.5 How Renewal Idempotency Works

Each `invoice_paid` event has a unique Stripe event ID (`evt_xxx`). This becomes the `source_event_id` in `credit_grants`. The unique constraint prevents double-credit if the same event is delivered multiple times. No billing period deduplication is needed beyond the event-level idempotency.

### 7.6 Whether Free/Admin/Beta/Internal Users Get Grants

| User Type | Grant Behavior |
|-----------|---------------|
| Free users | Free plan users don't subscribe via Stripe. No `invoice_paid` events for free users. Monthly reset via `CreditBalanceRepository.resetForNewPeriod()` is a separate system process (not webhook-driven). NOT in 05E scope. |
| Admin/beta users | If they have a Stripe subscription and `invoice_paid` fires, they receive grants like normal. Admin role does not suppress credit grants. |
| Internal service users | No Stripe subscriptions. Not affected. |

### 7.7 Whether Plan Downgrade/Upgrade Proration Is Deferred

**YES — fully deferred.** Plan changes (upgrade/downgrade) may produce prorated `invoice_paid` events or subscription update events. 05E does not handle proration. If a `subscription_updated` event changes the plan type, the next `invoice_paid` uses the new plan's monthly allocation. Mid-cycle proration logic is deferred to a future task.

---

## 8. credit_balances Mutation Boundary Decision

### 8.1 Exact Repository/Service Used to Mutate Balances

**`CreditBalanceRepository`** from `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts`, imported via `CreditPersistenceModule`.

A new method will be added: `addBalance(id: string, newBalance: number, manager?: EntityManager)` — symmetric to the existing `deductBalance()`. This keeps the existing repository as the single mutation surface for `credit_balances`.

### 8.2 Whether to Add purchased_credits / subscription_credits Columns

**NO — use existing `balance` column only.** The single `balance` integer is the authoritative current balance. Credit type breakdown is tracked via `credit_grants` records (queryable by `grant_type`). Adding separate columns would complicate the existing deduction logic (which checks a single `balance` field) and violate 04 locked invariants.

### 8.3 Whether Credit Balance Rows Must Exist or Be Created on Grant

**Must exist.** A `credit_balances` row for the owner should already exist (created during user registration / plan provisioning as established in BILLING-READY-03). If a grant is attempted for an owner without a balance row, the grant fails with status `failed` and error code `BALANCE_NOT_FOUND`. The grant service does NOT auto-create balance rows.

Rationale: Balance row creation is a provisioning concern, not a payment-event concern. Auto-creation during a webhook-triggered grant would bypass plan validation, period setting, and other provisioning logic.

### 8.4 How ownerId/ownerType Are Used

- `ownerId` = `user.id` (UUID string)
- `ownerType` = `'user'` (default)
- Matches `credit_balances.owner_id` / `credit_balances.owner_type` exactly
- The webhook handler resolves the user via `stripeCustomerId` → `user.id`
- `credit_grants.owner_id` = `credit_balances.owner_id` — same value

### 8.5 How Transaction Locks Are Handled

Same pattern as `PersistentCreditDeductionGateway`:

```
DataSource.transaction(async (manager) => {
  1. findByOwnerForUpdate(ownerId, 'user', manager)  // pessimistic_write lock
  2. INSERT credit_grants record (pending)
  3. UPDATE credit_balances.balance += amount
  4. UPDATE credit_grants.status = 'granted', balance_before, balance_after, granted_at
})
```

If any step fails, the entire transaction rolls back. No partial credit.

### 8.6 Whether 04 Deduction Invariants Are Affected

**NO.** The deduction path (`PersistentCreditDeductionGateway`) locks `FOR UPDATE` before deducting. The grant path also locks `FOR UPDATE` before adding. These are compatible — both hold a row-level write lock for the duration of their transaction. No deadlock risk because each transaction locks only one `credit_balances` row (the owner's row). The CHECK constraint `balance >= 0` remains valid — adding credits never violates non-negative balance.

---

## 9. Transaction/Idempotency/No-Double-Credit Decision

### 9.1 Atomic Boundary

Single `DataSource.transaction()` encompassing:
1. `credit_balances` row lock (`FOR UPDATE`)
2. `credit_grants` INSERT with `source_event_id`
3. `credit_balances` balance UPDATE (increment)
4. `credit_grants` status UPDATE to `granted`

All-or-nothing. If any step fails, the entire transaction rolls back.

### 9.2 Unique Source Event ID Behavior

`credit_grants.source_event_id` has a UNIQUE index. For webhook-triggered grants, this is the Stripe event ID (`evt_xxx`). If a duplicate grant is attempted (same `source_event_id`), the INSERT will either:
- Hit a pre-transaction check (query first) → return existing grant → no double-credit
- Hit a 23505 unique constraint violation (race condition) → catch → fetch existing → no double-credit

This is the exact same pattern used by `PersistentCreditDeductionGateway` for deduction idempotency.

### 9.3 Duplicate Webhook Event Behavior

If the same Stripe event is delivered twice:
1. First delivery: `WebhookEventRepository.findByProviderEventId()` returns null → event is processed → credit grant fires → credits applied
2. Second delivery: `WebhookEventRepository.findByProviderEventId()` returns existing → `incrementAttempts()` → return HTTP 200 without reprocessing → NO credit grant fires

This is the 05D idempotency layer. Credit grant service has its own `source_event_id` idempotency as a defense-in-depth measure.

### 9.4 Duplicate Grant Behavior

If `CreditGrantService.processGrant()` is called twice with the same `source_event_id`:
- Pre-transaction check: query `credit_grants` by `source_event_id`
- If exists with status `granted`: return existing grant result (no mutation)
- If exists with status `failed`: DO NOT retry automatically — failed grants require investigation

### 9.5 Retry After Failure Behavior

- If the transaction fails (DB timeout, connection error), no `credit_grants` record exists (rolled back)
- A future retry of the same Stripe event would hit the webhook idempotency layer (05D already processed it)
- Manual reprocess: a future admin/background job could find `webhook_events` with `status = 'processed'` that have no corresponding `credit_grants` record — and retry the credit grant
- This is deferred to 05G or a follow-up task

### 9.6 Relationship to webhook_events Status

- `webhook_events.status` remains `processed` regardless of whether the credit grant succeeds or fails
- The webhook event was successfully "processed" in the sense that the event handler ran
- Credit grant success/failure is tracked in `credit_grants.status`, not `webhook_events.status`
- This separation preserves 05D's clean status model

### 9.7 Process-Once Semantics

Each unique `source_event_id` produces at most one successful credit grant. Multiple calls with the same ID return the same result. No double-credit is possible.

### 9.8 Whether Failed Grant Can Be Safely Retried

**Not automatically.** Failed grants (e.g., `BALANCE_NOT_FOUND`) indicate a data integrity issue that requires investigation. The grant record with status `failed` persists for audit. Manual retry would require:
1. Fix the underlying issue (e.g., create the missing balance row)
2. Delete or update the failed `credit_grants` record to allow re-attempt with the same `source_event_id`
3. Or use a different `source_event_id` for the manual grant (e.g., `admin_retry_{original_event_id}`)

Automatic retry is deferred.

---

## 10. Webhook Integration Decision

### 10.1 Whether 05D WebhookService Should Call a CreditGrantService in 05E

**YES.** The `WebhookService.handleCheckoutCompleted()` and `WebhookService.handleInvoicePaid()` methods currently return early for top-up/renewal events. 05E will modify these two methods to call `CreditGrantService.processGrant()` instead of returning early.

### 10.2 Exact Files That May Need Bounded Modification in 05D Webhook Code

| File | Modification |
|------|-------------|
| `services/api-gateway/src/billing/webhook/webhook.service.ts` | Add `CreditGrantService` dependency injection. Modify `handleCheckoutCompleted()` (payment mode branch) and `handleInvoicePaid()` (subscription renewal branch + non-subscription branch) to call `CreditGrantService`. |
| `services/api-gateway/src/billing/webhook/webhook.module.ts` | Import new `CreditGrantModule` (or add `CreditGrantService` + its dependencies). |

These are **bounded, minimal modifications** to 05D code — adding a new dependency and replacing early-return with a service call.

### 10.3 Which Event Types Trigger Credit Grant Processing

| Internal Event Type | Trigger Condition | Grant Type |
|--------------------|-------------------|------------|
| `checkout_completed` | `mode === 'payment'` (top-up) | `topup` |
| `checkout_completed` | `mode === 'subscription'` (initial subscription) | `subscription_initial` |
| `invoice_paid` | With `subscriptionId` (renewal) | `subscription_monthly` |
| `invoice_paid` | Without `subscriptionId` (non-subscription top-up invoice) | `topup` |

### 10.4 How Top-Up Events Are Identified Despite 05C Metadata Gap

**Problem:** The webhook payload for top-up `checkout.session.completed` events does not contain `aisandbox_topup_pack_id` metadata (05C gap — metadata not embedded in Stripe session).

**Resolution for Step 3 (stub/test mode):**
- In `stub` mode, the parsed event data is controlled by the test. Tests can include `metadata.aisandbox_topup_pack_id` in the mock event data.
- In real Stripe mode (future), metadata embedding in `StripePaymentProvider.createCheckoutSession()` must be implemented before real top-up grants work.

**Practical approach for 05E:**
- The `CreditGrantService.resolveTopUpAmount()` method reads `data.metadata.aisandbox_topup_pack_id` from the webhook event data.
- If metadata is present: look up `TOP_UP_PACK_MAP[packId].credits` → use as grant amount.
- If metadata is absent: grant fails with error code `AMOUNT_RESOLUTION_FAILED`. The grant record is persisted with status `failed`.
- This is safe — no credits are granted when the amount cannot be determined.

### 10.5 Whether Metadata Gap Blocks Step 3

**NO.** Step 3 can proceed because:
1. Tests control mock event data and can include metadata
2. Real Stripe metadata embedding is a separate concern (future task)
3. The `CreditGrantService` gracefully handles missing metadata (fails the individual grant, not the entire webhook processing)
4. Subscription grants use plan_type resolution (independent of checkout metadata)

### 10.6 Whether 05C Metadata Must Be Modified in 05E

**NO.** 05C source is LOCKED. Metadata embedding will be addressed when `StripePaymentProvider.createCheckoutSession()` `test`/`live` branches are implemented with the real Stripe SDK (future task). 05E does not modify 05C code.

### 10.7 Whether invoice.paid Subscription Renewals Trigger Grants

**YES.** `invoice_paid` with a valid `subscriptionId` triggers a `subscription_monthly` credit grant. The amount is derived from the user's current `planType` via `MONTHLY_CREDIT_ALLOCATIONS`.

---

## 11. Audit/Error/Retry Behavior Decision

### 11.1 Where Errors Are Recorded

| Error Type | Recorded In |
|-----------|-------------|
| Grant processing failure | `credit_grants.status = 'failed'`, `credit_grants.error_code`, `credit_grants.error_message` |
| Missing balance row | `credit_grants.status = 'failed'`, `error_code = 'BALANCE_NOT_FOUND'` |
| Unknown top-up pack | `credit_grants.status = 'failed'`, `error_code = 'UNKNOWN_PACK'` |
| Transaction/DB error | `credit_grants.status = 'failed'`, `error_code = 'TRANSACTION_ERROR'` |
| Webhook event processing error | `webhook_events.status = 'failed'` (only if entire handler throws) |

### 11.2 Whether webhook_events Status Changes After Credit Grant Failure

**NO.** If `CreditGrantService.processGrant()` fails, the failure is recorded in `credit_grants` only. The webhook event handler catches the error and lets the overall webhook processing continue to completion (`webhook_events.status` remains `processed`). This matches the existing 05D pattern where processing errors don't necessarily fail the entire event.

**Exception:** If the credit grant failure is fatal and the handler throws (which it should NOT for grant failures), then `webhook_events.status` would become `failed`. But by design, grant failures are caught and recorded gracefully.

### 11.3 Whether credit_grants Stores Failure Reason

**YES.** `error_code` (varchar 50) and `error_message` (text) on the `credit_grants` table. No secrets in error messages.

### 11.4 Whether Manual Reprocess Is Deferred

**YES — deferred.** Admin UI / background job to retry failed grants is out of 05E scope. 05E provides the data model for failed grants; a future task will provide the retry mechanism.

### 11.5 Whether Background Job/Queue Is Deferred

**YES — deferred.** No BullMQ job, no background worker, no cron for credit grant retry in 05E. Credit grants are processed synchronously within the webhook handler.

### 11.6 Provider Response Behavior

Provider response behavior (Stripe SDK signature verification, event parsing) stays in 05D/05A. 05E does not interact with the provider directly.

---

## 12. Provider/Payment Boundary Decision

| Constraint | Status |
|-----------|--------|
| No Stripe/provider API calls in Step 3 unless Keith explicitly approves later | **CONFIRMED** |
| No Stripe SDK/package/env changes | **CONFIRMED** |
| No Stripe CLI/webhook tests | **CONFIRMED** |
| 05E consumes already-parsed webhook data only | **CONFIRMED** — `CreditGrantService` receives parsed event data (the `Record<string, unknown>` from `WebhookService.routeEvent()`). No raw body. No signature. No provider calls. |
| No live/test payment validation in 05E | **CONFIRMED** |

---

## 13. Implementation vs Split Decision

**Decision: A — 05E can proceed as one bounded no-provider-call Step 3.**

### Rationale

The scope is well-bounded:
1. One new entity file (`CreditGrant`)
2. One new migration file (not executed)
3. One new service file (`CreditGrantService`)
4. One new repository file (`CreditGrantRepository`)
5. One new module file (`CreditGrantModule`)
6. Two modified webhook files (bounded additions to `webhook.service.ts` and `webhook.module.ts`)
7. One modified entity barrel (`entities/index.ts`)
8. One new `addBalance` method on existing `CreditBalanceRepository`
9. Unit tests for all components

All uses existing infrastructure:
- `CreditBalanceRepository` / `CreditPersistenceModule` (04 — LOCKED)
- `WebhookService` / `WebhookModule` (05D — LOCKED)
- `TOP_UP_PACK_MAP` (05C — LOCKED, import only)
- `MONTHLY_CREDIT_ALLOCATIONS` (03 — LOCKED, import only)
- `DataSource` transaction pattern (04 — established)
- Existing TypeORM/NestJS patterns

No external dependencies. No SDK. No env changes. No frontend.

### Why Not B (Split into 05E1 persistence / 05E2 integration)

The grant service and webhook integration are tightly coupled — the service exists solely to be called from the webhook handler. Splitting would create an incomplete 05E1 with an entity/migration that serves no purpose until 05E2 integrates it. The total file count is modest (8–9 production files, comparable to 05D's 6+3).

### Why Not C (Requires runtime DB migration validation)

Step 3 works entirely with mocked repositories and in-memory tests. The migration is created but not executed. No DB access needed.

### Why Not D (Validation-only)

05E requires new production files. It is not validation-only.

### Why Not E (Pause)

No blockers exist. All prerequisites (05A–05D) are COMPLETE and LOCKED.

---

## 14. Exact Step 3 File Boundary

### Production Files — CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/entities/credit-grant.entity.ts` | TypeORM `CreditGrant` entity for `credit_grants` table |
| 2 | `services/api-gateway/src/billing/credit-grant/credit-grant.repository.ts` | `CreditGrantRepository` — CRUD, idempotency queries |
| 3 | `services/api-gateway/src/billing/credit-grant/credit-grant.service.ts` | `CreditGrantService` — grant processing, amount resolution, transaction, idempotency |
| 4 | `services/api-gateway/src/billing/credit-grant/credit-grant.module.ts` | Module wiring — imports `CreditPersistenceModule`, `TypeOrmModule.forFeature([CreditGrant, WebhookEvent])` |
| 5 | `services/api-gateway/src/billing/credit-grant/index.ts` | Barrel export |

### Production Files — MODIFY

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/entities/index.ts` | Add `CreditGrant` export |
| 2 | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Add `addBalance(id, newBalance, manager?)` method |
| 3 | `services/api-gateway/src/billing/webhook/webhook.service.ts` | Add `CreditGrantService` injection. Modify `handleCheckoutCompleted()` (payment mode) and `handleInvoicePaid()` (subscription renewal + non-subscription) to call grant service. |
| 4 | `services/api-gateway/src/billing/webhook/webhook.module.ts` | Import `CreditGrantModule` |

### Migration Files (Not Executed)

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/migrations/1772400000000-CreateCreditGrantsTable.ts` | Create `credit_grants` table with idempotency constraint and indexes |

### Test Files — CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.entity.spec.ts` | Entity shape, columns, constraints |
| 2 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.repository.spec.ts` | Repository CRUD, idempotency queries |
| 3 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.service.spec.ts` | Service logic — grant processing, amount resolution, transaction, idempotency, error handling |
| 4 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.module.spec.ts` | Module composition |
| 5 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant-migration.spec.ts` | Migration SQL structure, idempotency guards, indexes |
| 6 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant-integration.spec.ts` | Webhook → grant integration, no-double-credit, balance update |

### Files NOT Changed

- No `services/api-gateway/package.json` changes
- No `.env.example` changes
- No `StripePaymentProvider` changes (05A LOCKED)
- No `Subscription` entity changes (05B LOCKED)
- No `CheckoutController` / `CheckoutService` changes (05C LOCKED)
- No `checkout-price-map.config.ts` changes (05C LOCKED — imported only)
- No frontend files
- No worker/ai-service changes
- No `database/schema.sql` or `database/init/001_schema.sql` changes
- No governance files changed during Step 3 implementation
- No `credit_deduction_records` mutation logic changes
- No `PersistentCreditDeductionGateway` changes

---

## 15. Test Plan

| # | Test | Type | Assertions |
|---|------|------|------------|
| 1 | `CreditGrant` entity has correct columns, types, constraints | Unit | All expected columns/types/defaults match; CHECK constraints present |
| 2 | Migration SQL creates table with correct schema | Unit | CREATE TABLE includes all columns; indexes and constraints present; IF NOT EXISTS |
| 3 | Migration down drops table cleanly | Unit | DROP TABLE IF EXISTS; drop indexes |
| 4 | `CreditGrantRepository.findBySourceEventId()` returns existing grant | Unit | Query by source_event_id returns entity |
| 5 | `CreditGrantRepository.createGrant()` persists record | Unit | INSERT and return entity with pending status |
| 6 | `CreditGrantRepository.updateStatus()` transitions status | Unit | UPDATE status + granted_at on terminal states |
| 7 | Grant idempotency — duplicate source_event_id returns existing | Unit | Second call with same source_event_id → returns existing record, no INSERT |
| 8 | Grant idempotency — 23505 race fallback | Unit | Simulated unique violation → catch → fetch existing → no double-credit |
| 9 | Top-up grant resolves amount from TOP_UP_PACK_MAP | Unit | `topup_1000` → 1000 credits; `topup_5000` → 5000; `topup_20000` → 20000 |
| 10 | Unknown top-up pack → grant failed with UNKNOWN_PACK | Unit | Invalid packId → credit_grants.status = 'failed', error_code = 'UNKNOWN_PACK' |
| 11 | Subscription monthly grant resolves amount from MONTHLY_CREDIT_ALLOCATIONS | Unit | `starter` → 5000; `pro` → 25000; `team` → 100000 |
| 12 | Free plan subscription monthly grant gives 500 credits | Unit | `free` → 500 |
| 13 | Transaction boundary: grant INSERT + balance UPDATE atomic | Unit | Both succeed or both rollback; no partial credit |
| 14 | Transaction rollback: DB error → no balance change, grant failed | Unit | Simulated error → balance unchanged; credit_grants.status = 'failed' |
| 15 | Missing credit_balance row → grant failed with BALANCE_NOT_FOUND | Unit | No balance row → grant persisted as 'failed'; no crash |
| 16 | `addBalance()` correctly increments balance | Unit | balance_before + amount = balance_after |
| 17 | Balance locked FOR UPDATE during grant | Unit | `findByOwnerForUpdate()` called with manager within transaction |
| 18 | Duplicate webhook event → no credit grant (05D idempotency layer) | Unit | Second webhook delivery → 05D skips processing → grant service not called |
| 19 | Top-up checkout_completed triggers grant | Integration | WebhookService receives top-up event → CreditGrantService.processGrant() called |
| 20 | Subscription checkout_completed triggers initial grant | Integration | WebhookService receives subscription checkout → initial credit grant fires |
| 21 | invoice_paid subscription renewal triggers monthly grant | Integration | WebhookService receives renewal invoice → monthly credit grant fires |
| 22 | invoice_paid non-subscription triggers top-up grant | Integration | WebhookService receives non-subscription invoice → top-up credit grant fires |
| 23 | No credit mutation on unknown/ignored events | Unit | Unknown event type → no CreditGrantService call; balance unchanged |
| 24 | No Stripe/provider API calls in any test | Unit | No `stripe` import; mocked provider |
| 25 | No env/package dependency | Unit | No env reads for grant service; no `stripe` import |
| 26 | 04 deduction/balance invariants unaffected | Compile+Unit | `npx tsc --noEmit` passes; existing `credit-balance` 74/74 tests pass |
| 27 | 05D webhook regression unchanged | Unit | Existing webhook 108/108 tests pass |
| 28 | `balance_before` and `balance_after` correctly captured | Unit | Snapshots match actual balance pre/post grant |
| 29 | Grant with metadata.aisandbox_topup_pack_id resolves correctly | Unit | Metadata present → amount resolved from TOP_UP_PACK_MAP |
| 30 | Grant without metadata → failed with AMOUNT_RESOLUTION_FAILED (top-up) | Unit | Missing metadata → grant status 'failed' |
| 31 | Module composition correct | Unit | `CreditGrantModule` provides service, repository; imports CreditPersistenceModule |
| 32 | No credit mutation on ignored/unknown events in webhook flow | Integration | `WebhookService` does not call grant for ignored events |

### Test Non-Goals

- No Stripe SDK mock tests (SDK not installed)
- No integration tests requiring DB, Docker, Redis
- No real webhook delivery tests (Stripe CLI not approved)
- No frontend/browser tests
- No real signature verification tests
- No end-to-end payment flow tests

---

## 16. Runtime/Provider Validation Decision

| Constraint | Status |
|-----------|--------|
| Docker/PostgreSQL/Redis required for Step 3 | **NO** — 05E is entity/service/repository creation + unit tests. All dependencies mocked. |
| Stripe/payment/provider API calls | **NONE** — no `stripe` package. No SDK. No network calls. |
| Stripe CLI/webhook testing | **NONE** — no real webhook delivery. |
| Live/test-mode provider validation | **NONE** — deferred. |
| Browser smoke | **NONE** — no frontend changes. |
| AGENT-HARNESS write canary | **NONE** — remains a separate track. |
| Migrations | **NONE executed** — migration file created but NOT run. |
| Runtime commands for validation | `npx tsc --noEmit` and `npm test` (targeted suites) only. |
| If future DB/runtime validation is needed | Requires explicit Keith approval, Docker/PostgreSQL running, migration execution approval. |

---

## 17. UX/UI Constraints

| Constraint | Status |
|-----------|--------|
| UI implementation in 05E | **NONE** — no frontend changes |
| Translation key updates | **NONE** — no user-facing text added |
| Future UI implications | If credit grant history/admin UI is added later, translation keys must be updated in `en.json`, `zh-TW.json`, `zh-CN.json` per multilingual-first rule |
| Heroicons v2 Outline only | N/A — no UI |
| Impeccable / Emil Kowalski advisory only | N/A — no UI |

---

## 18. Risks/Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | **Double-credit risk** | CRITICAL | Three layers of defense: (a) 05D webhook idempotency prevents reprocessing; (b) `credit_grants.source_event_id` unique constraint prevents duplicate grants; (c) pre-transaction check + 23505 race fallback. Tests verify all three layers. |
| 2 | **Failed transaction partial-credit risk** | HIGH | Single `DataSource.transaction()` — if INSERT credit_grant OR UPDATE balance fails, entire transaction rolls back. No partial state possible. Tests verify rollback behavior. |
| 3 | **Webhook duplicate/retry risk** | HIGH | 05D layer handles this — duplicates increment attempts but do not reprocess. 05E is not exposed to Stripe retries. |
| 4 | **Checkout metadata gap risk** | MEDIUM | Top-up grants require `metadata.aisandbox_topup_pack_id` in the event data. Missing metadata → grant fails gracefully with `AMOUNT_RESOLUTION_FAILED`. No credits granted on unknown amounts. Safe failure mode. Tests cover both present and absent metadata. |
| 5 | **Subscription renewal ambiguity** | MEDIUM | Initial subscription may produce both `checkout.session.completed` and `invoice_paid`. Event-level idempotency (`source_event_id = evt_xxx`) prevents double-grant. Each event has a unique Stripe ID. |
| 6 | **Top-up amount mapping risk** | LOW | Amount derived from `TOP_UP_PACK_MAP` — a static, server-side config. No user input determines the amount. Unknown pack IDs fail gracefully. |
| 7 | **Credit balance invariant regression risk** | HIGH | `addBalance()` is a new method on `CreditBalanceRepository`. Must not break `deductBalance()` or `resetForNewPeriod()`. The CHECK constraint `balance >= 0` is not violated by additions. Existing 04 tests run as regression. |
| 8 | **Migration risk** | LOW | New table (`credit_grants`) with no FK dependencies on existing tables (except optional `webhook_event_id`). No modification to existing tables. `IF NOT EXISTS` guards. Created but not executed. |
| 9 | **Provider/payment call boundary risk** | HIGH | No Stripe SDK. No `stripe` import. No env keys. No network calls. All provider interaction is via mocked `WebhookService` dependency injection. Double-gate safety. |
| 10 | **Test false-confidence risk** | MEDIUM | Tests use mocked repositories and in-memory transaction simulations. They validate logic but not real DB behavior (row locks, unique constraints in PostgreSQL). Real DB validation requires Docker/PostgreSQL (deferred). |
| 11 | **Refund/chargeback deferral risk** | LOW | 05E does not handle reversals. If a user is refunded before a future reversal mechanism is built, granted credits remain. Acceptable for initial implementation — manual admin correction possible. |
| 12 | **Concurrent grant + deduction race risk** | MEDIUM | Both grant and deduction use `FOR UPDATE` row lock on the same `credit_balances` row. PostgreSQL serializes these — one waits for the other to commit. No deadlock (single row locked). No lost updates. |
| 13 | **WebhookService modification risk** | MEDIUM | 05D webhook.service.ts is LOCKED. Modifications are bounded: add DI constructor param + replace two early-return statements with service calls. Existing 108 webhook tests must pass as regression. |

---

## 19. Step 3 Readiness Conclusion

| Criterion | Status |
|-----------|--------|
| Ready for Step 3? | **YES** — scope is well-bounded: `CreditGrant` entity, `CreditGrantRepository`, `CreditGrantService`, `CreditGrantModule`, migration (not executed), `addBalance()` on existing repository, bounded webhook.service.ts modifications, unit tests. |
| Further split required? | **NO** — single bounded Step 3 is sufficient. Entity + service + webhook integration are tightly coupled. |
| Migration approval needed? | **YES** — Keith must approve `credit_grants` table migration before Step 3 implementation (create but not execute). |
| Runtime DB validation approval needed? | **NO** — not for Step 3. All tests use mocked repos. |
| Package/env/provider-call approval needed? | **NO** — Step 3 uses no external packages, no env keys, no provider calls. |
| Recommended model | **GPT-5.3 Codex High** — credit accounting, transaction atomicity, idempotency, balance mutation, webhook integration. Security-adjacent (balance integrity). |
| Exact next prompt type | **Implementation prompt** — 05E Step 3 bounded implementation with exact file boundary from Section 14. |

---

## 20. Safety Confirmations

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
| No Stripe CLI/webhook tests | **CONFIRMED** |
| No env keys added | **CONFIRMED** |
| No package dependencies added | **CONFIRMED** |
| No secrets or placeholder secrets added | **CONFIRMED** |
| No credit balance mutation | **CONFIRMED** |
| No credit grant source code created | **CONFIRMED** |
| No AGENT-HARNESS write canary | **CONFIRMED** |
| No subagents used | **CONFIRMED** |

---

## 21. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05E-CREDIT-GRANT-TOP-UP-ACCOUNTING-READINESS.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task/child-slice confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation (via grep) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — 05E ACTIVE Step 1 COMPLETE confirmed |
| 4 | `docs/BILLING-READY-05D-CHECKPOINT.md` | 05D completion — webhook ingestion LOCKED |
| 5 | `docs/BILLING-READY-05D-WEBHOOK-INGESTION-IDEMPOTENCY-READINESS.md` | 05D Step 2 — webhook decisions, credit deferral |
| 6 | `docs/BILLING-READY-05C-CHECKPOINT.md` | 05C completion — checkout LOCKED |
| 7 | `docs/BILLING-READY-05C-CHECKOUT-CREDIT-TOP-UP-READINESS.md` | 05C Step 2 — checkout decisions, top-up packs |
| 8 | `docs/BILLING-READY-04-CHECKPOINT.md` | 04 parent — credit balance/deduction LOCKED |
| 9 | `services/api-gateway/src/entities/credit-balance.entity.ts` | CreditBalance entity schema |
| 10 | `services/api-gateway/src/entities/credit-deduction-record.entity.ts` | CreditDeductionRecord entity — idempotency reference |
| 11 | `services/api-gateway/src/entities/webhook-event.entity.ts` | WebhookEvent entity schema |
| 12 | `services/api-gateway/src/entities/user.entity.ts` | User entity — stripeCustomerId, planType, planStatus |
| 13 | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | CreditBalanceRepository — existing methods |
| 14 | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` | Transaction/idempotency reference pattern |
| 15 | `services/api-gateway/src/billing/credit-deduction/credit-deduction-record.repository.ts` | Deduction record repository — idempotency reference |
| 16 | `services/api-gateway/src/billing/credit-deduction/credit-persistence.module.ts` | CreditPersistenceModule structure |
| 17 | `services/api-gateway/src/billing/webhook/webhook.service.ts` | WebhookService — top-up/renewal deferral points |
| 18 | `services/api-gateway/src/billing/webhook/webhook-event.repository.ts` | WebhookEventRepository — existing methods |
| 19 | `services/api-gateway/src/billing/webhook/webhook.module.ts` | WebhookModule — current imports/exports |
| 20 | `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts` | TOP_UP_PACK_MAP, CHECKOUT_PLAN_PRICE_MAP |
| 21 | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | MONTHLY_CREDIT_ALLOCATIONS, PLAN_IDS |
| 22 | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | PLAN_DEFINITIONS full config |
| 23 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Transaction and deduction patterns |
| 24 | `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts` | Migration convention reference |
| 25 | `services/api-gateway/src/billing/webhook/__tests__/webhook.service.spec.ts` | Existing test patterns for top-up deferral |

---

## 22. Summary

BILLING-READY-05E Step 2 credit grant / top-up accounting readiness review is **COMPLETE**. Key decisions:

1. **credit_grants table**: New entity + migration (not executed). Columns: `source_event_id` (unique idempotency key), `owner_id`/`owner_type`, `grant_type`, `source_type`, `provider_event_id`, `webhook_event_id`, `plan_type`/`top_up_pack_id`, `amount`, `balance_before`/`balance_after`, `status`, timestamps, error fields.
2. **Grant statuses**: `pending` → `granted` / `failed` / `ignored`. Immutable after terminal.
3. **Top-up amounts**: From `TOP_UP_PACK_MAP` — 1000/5000/20000 credits. Server-side only. No user-supplied amounts.
4. **Subscription monthly grants**: From `MONTHLY_CREDIT_ALLOCATIONS` — 500/5000/25000/100000. Triggered by `invoice_paid` with subscription.
5. **Initial subscription grant**: Triggered by `checkout.session.completed` (subscription mode). Event-level idempotency prevents overlap with first `invoice_paid`.
6. **Balance mutation**: `CreditBalanceRepository.addBalance()` — new method, symmetric to `deductBalance()`. Same `FOR UPDATE` lock pattern within `DataSource.transaction()`.
7. **Idempotency**: Three layers — (a) 05D webhook duplicate detection, (b) `source_event_id` unique constraint pre-check, (c) 23505 race fallback. No double-credit possible.
8. **Transaction**: Single `DataSource.transaction()` for lock + INSERT grant + UPDATE balance. All-or-nothing.
9. **Webhook integration**: Bounded modifications to `webhook.service.ts` (replace early-return with service call) and `webhook.module.ts` (import module).
10. **Metadata gap**: Top-up grants require `metadata.aisandbox_topup_pack_id`. Missing → fail gracefully. Not blocking.
11. **No provider calls**: Confirmed — consumes already-parsed webhook data only.
12. **Implementation**: Single bounded Step 3 — no further split needed.
13. **Migration approval**: Required from Keith before Step 3.
14. **Model**: GPT-5.3 Codex High — credit accounting, balance mutation, idempotency, transaction safety.
15. **Zero source/env/package/governance/migration changes** in this Step 2 review.
16. **No subagents used**.
