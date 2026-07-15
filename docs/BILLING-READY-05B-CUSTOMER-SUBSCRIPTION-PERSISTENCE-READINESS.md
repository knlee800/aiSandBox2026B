# BILLING-READY-05B — Customer / Subscription Persistence Readiness Review

**Task ID:** BILLING-READY-05B
**Step:** 2 — Customer / Subscription Persistence / Exact Schema Boundary
**Status:** COMPLETE
**Date:** 2026-07-15
**Nature:** Static readiness review — read-only — no implementation

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05B ACTIVE | **CONFIRMED** — Step 1 COMPLETE (Registration — 2026-07-15). Step 2 is this review. |
| BILLING-READY-05 ACTIVE (parent) | **CONFIRMED** — Steps 1–2 COMPLETE (2026-07-13). Keith approved split into 05A–05G. Step 3 IN PROGRESS via child slices. 05A COMPLETE and LOCKED. 05B is current ACTIVE child slice. |
| BILLING-READY-05A COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. 4 production files + 3 test files. 79 tests PASS. No Stripe SDK. No provider API calls. No env changes. No migrations. |
| BILLING-READY-05C/05D/05E/05F/05G | **PLANNED ONLY** — not registered. Registration deferred until 05B is complete. |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-13. All child slices (04A/04B/04C/04D) COMPLETE and LOCKED. Regression matrix PASS 12/12. |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. All 7 child slices COMPLETE and LOCKED. All 11 parent close criteria satisfied. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | **CONFIRMED** — 2026-07-12. Live runtime orchestration canary PASS. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. Per-builder harness config adapter. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-09. Full E2E canary PASS. |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05B is the current ACTIVE child slice; parent BILLING-READY-05 is ACTIVE with child-slice execution in progress. |

---

## 2. Source-of-Truth Summary

### 2.1 From BILLING-READY-05 Step 2 (Payment Provider Readiness Review)

| Decision | Outcome |
|----------|---------|
| Provider selected | **Stripe** — aligns with existing `users.stripe_customer_id`, `subscriptions.stripe_subscription_id` in DB schema, existing `StripePaymentProvider` stub, and `ChargeReadinessService` gate. |
| 05B scope (from parent review) | Customer/subscription persistence: `webhook_events` + `credit_grants` + subscription TypeORM entities; migrations; repositories; unit tests. No webhook endpoint, no live calls. |
| User/customer mapping | 1:1 — one Stripe customer per aiSandBox user. `users.stripe_customer_id` already exists (nullable varchar(255)). |
| Subscription persistence | `subscriptions` table exists in raw SQL schema but NOT as a TypeORM entity. Needs TypeORM entity alignment. |
| Webhook events | `webhook_events` table proposed for idempotency: `stripe_event_id` unique, `event_type`, `status`, `processed_at`. |
| Credit grants | `credit_grants` table proposed for audit: `owner_id`, `grant_type`, `credits_amount`, `source_event_id`. |
| Plan definitions | `PLAN_DEFINITIONS` remains code-only (`plan-definitions.config.ts`). Stripe price IDs are env/config. |
| Currency | USD assumed — existing `Invoice.currency = 'USD'`, existing `BillingSnapshot` in USD. |

### 2.2 From BILLING-READY-05A Checkpoint

| Decision | Outcome |
|----------|---------|
| Provider mode contract | `disabled` / `stub` / `test` / `live` — four modes established and LOCKED. |
| `ProviderResult<T>` contract | `success`, `data?`, `error?`, `message?` — LOCKED. |
| No Stripe SDK in 05A | Deferred to 05C. No `stripe` package. |
| No provider API calls | Deferred to 05C/05D. |
| `ChargeReadinessService` extended | `providerMode` and `providerModeValid` fields added. |
| 05B recommended next | Customer/subscription persistence — NOT REGISTERED at time of 05A checkpoint. Now ACTIVE. |

### 2.3 Provider Call Boundary

- **No provider API calls approved for 05B.**
- **No env/package changes approved for 05B.**
- Provider customer/subscription IDs will be stored from future 05C/05D inputs only.
- 05A provider mode contracts remain untouched in 05B.

---

## 3. Existing Schema / Source-Path Findings

### 3.1 Users Table and User Entity

| Item | Location | Details |
|------|----------|---------|
| Entity file | `services/api-gateway/src/entities/user.entity.ts` | TypeORM `@Entity('users')` |
| `stripe_customer_id` column | Line 82–83 | `@Column({ type: 'varchar', length: 255, name: 'stripe_customer_id', nullable: true })` — property `stripeCustomerId: string \| null` |
| `plan_type` column | Line 70–71 | `@Column({ type: 'varchar', length: 50, name: 'plan_type', default: 'free' })` — property `planType: string` |
| `plan_status` column | Line 76–77 | `@Column({ type: 'varchar', length: 20, name: 'plan_status', default: 'active' })` — property `planStatus: string` |
| `email` column | Line 31–33 | `varchar(255)`, unique, indexed |
| `role` column | Line 60–65 | `UserRole` enum — `admin`, `user`, `beta` |
| Raw SQL schema | `database/init/001_schema.sql` line 43 | `stripe_customer_id VARCHAR(255)` — nullable |
| Raw SQL schema | `database/schema.sql` line 40 | Same |
| Migration | `1771589000000-AddPlansFoundation.ts` | Added `plan_type` and `plan_status` columns to `users` |
| No unique index on `stripe_customer_id` | **GAP** — column exists but has no UNIQUE constraint in entity or raw SQL |

### 3.2 Existing Subscriptions Table (Raw SQL Only)

| Item | Location | Details |
|------|----------|---------|
| Raw SQL (`database/schema.sql`) | Lines 215–224 | `subscriptions` table exists |
| Raw SQL (`database/init/001_schema.sql`) | Lines 231–239 | Same table in init script |
| Columns | | `id UUID PK`, `user_id UUID FK → users`, `stripe_subscription_id VARCHAR(255)`, `plan_type VARCHAR(50)`, `status VARCHAR(50)`, `current_period_start TIMESTAMPTZ`, `current_period_end TIMESTAMPTZ`, `cancel_at TIMESTAMPTZ` |
| `plan_type` CHECK | | `IN ('free', 'pro', 'enterprise')` |
| `status` CHECK | | `IN ('active', 'cancelled', 'past_due')` |
| Index | `idx_subscriptions_user_status` | `ON subscriptions(user_id, status)` |
| TypeORM entity | **DOES NOT EXIST** | No `subscription.entity.ts` in `services/api-gateway/src/entities/` |
| TypeORM migration | **DOES NOT EXIST** | No migration creates this table via TypeORM — it exists only in raw SQL init scripts |
| Repository | **DOES NOT EXIST** | No subscription repository or service |

### 3.3 Existing Payment/Customer/Subscription Stubs

| Path | Status |
|------|--------|
| `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Mode-aware (05A). `createOrRetrieveCustomer()` returns stub/disabled result. No real customer persistence. |
| `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Extended in 05A with `CustomerParams`, `CustomerResult`, checkout/webhook contracts. |
| `services/api-gateway/src/payments/payments.module.ts` | Exports `StripePaymentProvider`. No entity imports. |
| No subscription entity | No TypeORM entity file exists for `subscriptions` table |
| No subscription service | No service manages subscription lifecycle in code |
| No subscription repository | No TypeORM repository for subscriptions |
| No webhook event entity | No `webhook_events` table or entity exists |
| No credit grant entity | No `credit_grants` table or entity exists |

### 3.4 Current PLAN_DEFINITIONS Model

| Item | Location | Details |
|------|----------|---------|
| Plan IDs | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | `'free' \| 'starter' \| 'pro' \| 'team'` |
| Allocations | Same file | `free: 500, starter: 5000, pro: 25000, team: 100000` |
| Plan definitions | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | Static `PLAN_DEFINITIONS` array with entitlements |
| DB `plans` table | `services/api-gateway/src/entities/plan.entity.ts` | `code`, `name`, `maxActiveSessions`, `maxSessions24h`, `maxTokens24h` — quota limits only |
| Plans migration | `1771589000000-AddPlansFoundation.ts` | Seeds `free` and `pro` plans. Does NOT include `starter` or `team` in DB. |
| Plan type mismatch | **GAP** | Raw SQL `subscriptions.plan_type` CHECK allows `('free', 'pro', 'enterprise')`. `PLAN_DEFINITIONS` uses `('free', 'starter', 'pro', 'team')`. The values do not align. |

### 3.5 Current Credit Balances Relation to User

| Item | Details |
|------|---------|
| `CreditBalance` entity | `services/api-gateway/src/entities/credit-balance.entity.ts` — linked via `ownerId` (varchar(50)) + `ownerType` (default `'user'`). No TypeORM FK to `users`. |
| Unique constraint | `idx_credit_balances_owner` on `(owner_id, owner_type)` — one balance row per user |
| No `purchasedCredits` column | **GAP** — `CreditBalance` has `balance`, `monthlyAllocation`, `rolloverBalance` but no `purchasedCredits` field to separate top-up from monthly |
| `CreditDeductionRecord` entity | Linked via `ownerId`. Immutable audit trail. `sourceEventId` unique idempotency. |

### 3.6 Current Migrations

| Migration | Purpose |
|-----------|---------|
| `1769160618009-InitSchema20260123.ts` | Initial TypeORM schema |
| `1771589000000-AddPlansFoundation.ts` | `plans` table, `plan_type`/`plan_status` columns on `users` |
| `1771700000000-AddAuthSchemaFoundation.ts` | Auth schema — includes `stripe_customer_id` on `users` |
| `1772100000000-CreateCreditBalanceAndDeductionTables.ts` | `credit_balances` and `credit_deduction_records` tables (BILLING-READY-03B) |
| **No subscription migration** | `subscriptions` table exists in raw SQL init only, not via TypeORM migration |
| **No webhook_events migration** | Table does not exist |
| **No credit_grants migration** | Table does not exist |

---

## 4. Customer Identity Persistence Decision

### 4.1 1:1 User to Provider Customer Mapping

**Decision: YES — 1:1 mapping.** One Stripe customer per aiSandBox user.

Rationale: The existing `users.stripe_customer_id` column already implements this model. Multi-user/team/org billing uses the `CreditBalance.ownerType` discriminator (deferred).

### 4.2 Whether `users.stripe_customer_id` Is Sufficient

**Decision: YES — sufficient with one enhancement.** The existing column stores the Stripe customer ID. However, it lacks a UNIQUE constraint, which must be added to prevent duplicate customer mappings.

### 4.3 Whether Provider/Customer Mapping Table Is Needed

**Decision: NO — not needed in 05B.** The 1:1 model does not require a separate mapping table. `users.stripe_customer_id` is the authoritative link. A separate table would be needed only for multi-provider support (deferred indefinitely).

### 4.4 Uniqueness Constraints

| Constraint | Decision |
|-----------|----------|
| `users.stripe_customer_id` UNIQUE | **ADD** — must be unique across all users. One Stripe customer per user, one user per Stripe customer. Nullable (free users have no Stripe customer). PostgreSQL UNIQUE on nullable column allows multiple NULLs. |
| Index | **ADD** — `idx_users_stripe_customer_id` unique partial index `WHERE stripe_customer_id IS NOT NULL` for clean semantics |

### 4.5 Nullability Rules

| Rule | Decision |
|------|----------|
| `stripe_customer_id` nullable | **YES** — free users, admin users, beta users, and internal test users do not require a Stripe customer. Column remains nullable. |
| When populated | On first checkout (05C) or explicit customer creation via `createOrRetrieveCustomer()`. Not populated in 05B (no provider calls). |
| When cleared | Never — once a Stripe customer is created, the mapping persists even if the subscription is cancelled. Cleared only on account hard-delete (audit/legal deferred). |

### 4.6 Free/Admin/Beta/Internal/Test User Handling

| User Type | `stripe_customer_id` | Behavior |
|-----------|----------------------|----------|
| Free user | `NULL` | No Stripe customer until first upgrade attempt. Balance gate uses `CreditBalance` only. |
| Admin | `NULL` | Admin bypass via `CreditBalanceGuard` (04A). No Stripe customer needed. May optionally have one for testing. |
| Beta | `NULL` or populated | Beta users follow plan allocation. May have Stripe customer if they subscribe. |
| Internal test | `NULL` | Uses admin bypass or provisioned test balance. No Stripe customer. |
| Paid user (after 05C) | `cus_xxx` populated | Populated when first checkout completes or customer is created. |

### 4.7 Email as Metadata vs Lookup Key

**Decision: email is metadata only, NOT a lookup key for Stripe customer mapping.**

- `stripe_customer_id` is the authoritative link between aiSandBox user and Stripe customer.
- Email is passed to Stripe at customer creation for display/receipt purposes.
- Email changes on the aiSandBox side do NOT break the customer mapping.
- Stripe customer email updates may be deferred to a separate task.

### 4.8 What 05C Checkout Will Need From This Model

05C will need:
1. `users.stripe_customer_id` column (already exists).
2. Ability to read/write `stripe_customer_id` (existing User entity supports this).
3. UNIQUE constraint on `stripe_customer_id` (added in 05B migration).
4. `Subscription` entity to create a subscription record after checkout completion (created in 05B).
5. No changes to `CreditBalance` from the customer identity model — credit provisioning is 05E scope.

---

## 5. Subscription Persistence Decision

### 5.1 Whether Existing Subscriptions Table Is Sufficient

**Decision: PARTIALLY — table structure is usable but needs alignment.**

The existing raw SQL `subscriptions` table has the right core columns (`user_id`, `stripe_subscription_id`, `plan_type`, `status`, `current_period_start`, `current_period_end`, `cancel_at`). However:

1. **No TypeORM entity** — must be created to enable repository/service access.
2. **`plan_type` CHECK constraint mismatch** — raw SQL allows `('free', 'pro', 'enterprise')` but `PLAN_DEFINITIONS` uses `('free', 'starter', 'pro', 'team')`. The CHECK constraint must be updated.
3. **`status` CHECK needs expansion** — raw SQL allows `('active', 'cancelled', 'past_due')`. Need to add `'trialing'` and `'expired'` for full lifecycle coverage.
4. **Missing fields** — need `stripe_price_id`, `cancelled_at`, `cancel_at_period_end`, `created_at`, `updated_at`.

### 5.2 Whether TypeORM Subscription Entity Is Needed

**Decision: YES — required.** A TypeORM `Subscription` entity must be created to:
- Enable repository pattern access consistent with other entities.
- Support TypeORM query builder and transactional operations.
- Provide type safety for subscription status values.
- Align with the entity auto-load pattern in `database.config.ts` (`entities: [__dirname + '/../**/*.entity{.ts,.js}']`).

### 5.3 Exact Subscription Status Values

| Status | Description | Source |
|--------|-------------|--------|
| `active` | Subscription is active and current | Stripe `active` |
| `trialing` | Subscription is in trial period | Stripe `trialing` — included for future use |
| `past_due` | Payment failed; grace period | Stripe `past_due` |
| `cancelled` | User cancelled; access until period end | Stripe `canceled` (mapped) |
| `expired` | Period ended after cancellation | Internal — post-period-end for cancelled subscriptions |
| `unpaid` | Multiple failed payments; access may be restricted | Stripe `unpaid` — included for completeness |

### 5.4 Exact Subscription Entity Fields

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | uuid PK | NO | `gen_random_uuid()` | Primary key |
| `user_id` | uuid FK → users | NO | — | Owning user |
| `stripe_subscription_id` | varchar(255) | YES | NULL | Stripe subscription ID (`sub_xxx`). NULL for locally-tracked free subscriptions if needed. |
| `stripe_price_id` | varchar(255) | YES | NULL | Stripe price ID (`price_xxx`) for the current plan. |
| `plan_type` | varchar(50) | NO | `'free'` | Internal plan ID matching `PLAN_DEFINITIONS` (`free`, `starter`, `pro`, `team`). |
| `status` | varchar(20) | NO | `'active'` | Subscription status (see 5.3). |
| `current_period_start` | timestamptz | NO | — | Current billing period start. |
| `current_period_end` | timestamptz | NO | — | Current billing period end. |
| `cancel_at` | timestamptz | YES | NULL | Scheduled cancellation time (if user requested future cancel). |
| `cancel_at_period_end` | boolean | NO | `false` | Whether subscription cancels at period end (vs immediately). |
| `cancelled_at` | timestamptz | YES | NULL | When cancellation was requested. |
| `created_at` | timestamptz | NO | `NOW()` | Record creation time. |
| `updated_at` | timestamptz | NO | `NOW()` | Last update time. |

### 5.5 Provider Subscription ID Field

**Field: `stripe_subscription_id` — varchar(255), nullable.**

- Nullable to allow local tracking of free-tier "subscriptions" if needed (deferred decision — may not be used).
- Unique constraint: **YES** — UNIQUE WHERE NOT NULL. One Stripe subscription maps to one local record.
- Populated by 05D webhook ingestion when `customer.subscription.created` or `checkout.session.completed` events arrive.

### 5.6 Provider Price/Product Fields

**Field: `stripe_price_id` — varchar(255), nullable.**

- Records which Stripe price ID is active for this subscription.
- Used to reverse-map from Stripe price to internal `plan_type`.
- Nullable because free-tier records may not have a Stripe price.
- No `stripe_product_id` field in 05B — price ID is sufficient for plan mapping. Product ID can be derived from price if needed later.

### 5.7 Plan Type Relationship

- `subscriptions.plan_type` maps directly to `PLAN_DEFINITIONS.id` values: `free`, `starter`, `pro`, `team`.
- When a subscription is created/updated, `users.plan_type` is also updated to match.
- `users.plan_status` reflects subscription status (`active`, `cancelled`, `past_due`, `expired`).
- Canonical plan type truth is in the `subscriptions` record; `users.plan_type` is a denormalized cache for quick access.

### 5.8 Current Period Fields

- `current_period_start` and `current_period_end` — populated from Stripe subscription data.
- Updated on each renewal (webhook `customer.subscription.updated` in 05D).
- Used by credit grant logic (05E) to determine when to reset monthly allocation.

### 5.9 Cancellation Fields

| Field | Purpose |
|-------|---------|
| `cancel_at` | Scheduled future cancellation time (Stripe `cancel_at`). |
| `cancel_at_period_end` | Whether to cancel at period end or immediately. Stripe standard behavior. |
| `cancelled_at` | Timestamp when cancellation was requested. Audit/display purposes. |

### 5.10 Failed Payment / Past Due Fields

- `status = 'past_due'` indicates payment failure.
- No separate `failed_payment_count` or `last_payment_attempt_at` fields in 05B — Stripe manages retry logic.
- 05D webhook handler will update status to `past_due` on `invoice.payment_failed` events.
- Grace period and dunning behavior are Stripe-side configuration (not platform code).

### 5.11 One Active Subscription Per User Enforcement

**Decision: YES — enforced at application level, not DB constraint.**

- The `Subscription` entity does not have a unique constraint on `user_id` alone (a user may have historical cancelled/expired records).
- Application logic (in future 05C/05D service code) must enforce: at most one subscription with `status IN ('active', 'trialing', 'past_due')` per user.
- A partial unique index could be added: `UNIQUE (user_id) WHERE status IN ('active', 'trialing', 'past_due')` — **recommended** for safety.
- Free users may or may not have a subscription row. Free-tier behavior is determined by `users.plan_type = 'free'` and absence of active subscription.

### 5.12 How 05D Webhook Ingestion Will Update Subscription State

05D will:
1. Receive webhook event → verify signature → check idempotency in `webhook_events` table.
2. For `customer.subscription.created`: create `Subscription` row, update `users.plan_type` and `users.plan_status`.
3. For `customer.subscription.updated`: update existing `Subscription` row (status, period, plan_type), update `users.plan_type` and `users.plan_status`.
4. For `customer.subscription.deleted`: update `Subscription` status to `cancelled` or `expired`, update `users.plan_type` to `'free'` and `users.plan_status` to `'cancelled'`.
5. For `invoice.payment_failed`: update `Subscription` status to `past_due`, update `users.plan_status` to `'past_due'`.

All of this requires the `Subscription` entity and repository created in 05B.

---

## 6. Plan/Price Mapping Persistence Decision

### 6.1 PLAN_DEFINITIONS Remains Code-Only

**Decision: YES — code-only for now.**

`PLAN_DEFINITIONS` in `plan-definitions.config.ts` remains the authoritative source for plan metadata (monthly credits, entitlements). No DB-backed plan config in 05B.

### 6.2 Stripe Price IDs Are Env/Config Only

**Decision: YES — env-only.**

Stripe price IDs (`STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_TEAM`) will be environment variables read at checkout time (05C). Not stored in DB. Not added in 05B.

### 6.3 Price IDs Do Not Belong in DB

**Decision: CORRECT — not in DB in 05B.**

Price IDs are Stripe-side configuration that maps to internal plan IDs. The mapping is: env var → checkout code → Stripe creates subscription with price → webhook returns price ID → stored in `subscriptions.stripe_price_id` for reverse lookup.

### 6.4 USD-Only Assumption

**Decision: USD-only does not affect schema.**

All monetary fields remain USD. No currency column needed on `subscriptions`. Stripe handles currency at the checkout/price level. Multi-currency is deferred.

### 6.5 Plan Change History/Audit in 05B

**Decision: NO — not in 05B.**

Plan change history (upgrade/downgrade audit trail) is deferred. The `subscriptions` table tracks current state. Historical state can be reconstructed from `webhook_events` if needed. Explicit plan change history table is not in 05B scope.

---

## 7. Migration Decision

### 7.1 Migration Needed

**Decision: YES — migration required in 05B Step 3.**

### 7.2 Migration Scope

The existing `subscriptions` table in raw SQL (`database/init/001_schema.sql`) is created by the Docker init script. However, TypeORM migrations are the authoritative schema management path (`synchronize: false` in database config). The migration must handle:

1. **`subscriptions` table alignment** — The raw SQL init script creates `subscriptions` with a different column set and CHECK constraints than what the TypeORM entity needs. The TypeORM migration should use `CREATE TABLE IF NOT EXISTS` with the updated schema, or `ALTER TABLE` to add missing columns and update CHECK constraints.

2. **New unique index on `users.stripe_customer_id`** — Add a partial unique index for customer ID dedup.

### 7.3 Exact Likely Migration Files

| # | Migration File | Tables/Columns | Purpose |
|---|---------------|---------------|---------|
| 1 | `XXXXXXXXX-CreateSubscriptionEntity.ts` | `subscriptions` — create or align with TypeORM entity. Add `stripe_price_id`, `cancel_at_period_end`, `cancelled_at`, `updated_at`. Update `plan_type` CHECK to `('free', 'starter', 'pro', 'team')`. Update `status` CHECK to `('active', 'trialing', 'past_due', 'cancelled', 'expired', 'unpaid')`. Add unique partial index on `stripe_subscription_id`. Add partial unique index for one-active-per-user. | Align raw SQL table with TypeORM entity |
| 2 | `XXXXXXXXX-AddStripeCustomerIdUniqueIndex.ts` | `users` — add unique partial index on `stripe_customer_id WHERE stripe_customer_id IS NOT NULL` | Prevent duplicate customer mappings |

### 7.4 Whether to Add Subscription TypeORM Entity Without Migration

**Decision: NO — entity and migration together.**

The entity must be created alongside the migration to ensure the DB schema matches the TypeORM metadata. Creating an entity without a migration risks runtime errors if the DB table shape doesn't match.

### 7.5 Whether Existing Raw SQL Schema Already Covers Required Table

**Decision: PARTIALLY.** The raw SQL `subscriptions` table has the core columns but:
- Missing `stripe_price_id`, `cancel_at_period_end`, `cancelled_at`, `updated_at`.
- `plan_type` CHECK too restrictive (`free`, `pro`, `enterprise` — missing `starter`, `team`; has `enterprise` which is not in `PLAN_DEFINITIONS`).
- `status` CHECK too restrictive (`active`, `cancelled`, `past_due` — missing `trialing`, `expired`, `unpaid`).

The migration must alter the existing table or drop/recreate with correct constraints.

### 7.6 Whether `credit_grants` / `webhook_events` Belong to 05B or Later

**Decision: DEFERRED to 05D/05E.**

- `webhook_events` — needed only when webhook ingestion is implemented (05D). Creating the table early adds complexity with no consumer.
- `credit_grants` — needed only when credit provisioning is implemented (05E). Creating the table early adds complexity with no consumer.
- 05B focuses on customer identity persistence and subscription entity/repository foundation only.

---

## 8. Repository/Service Boundary Decision

### 8.1 Entity Files Needed

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/entities/subscription.entity.ts` | CREATE | TypeORM `Subscription` entity for `subscriptions` table |

### 8.2 Repository/Service Files Needed

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/billing/subscription/subscription.repository.ts` | CREATE | TypeORM repository for `Subscription` entity — `findActiveByUserId`, `findByStripeSubscriptionId`, basic CRUD |
| 2 | `services/api-gateway/src/billing/subscription/subscription.module.ts` | CREATE | NestJS module providing `SubscriptionRepository` |

### 8.3 Whether a BillingSubscriptionService Is Needed

**Decision: NO — not in 05B.**

A subscription lifecycle service (create, update status, cancel, renew) requires provider integration (05C/05D). 05B creates the entity and repository foundation only. The service is 05D scope (webhook-driven state updates).

### 8.4 Whether a CustomerPersistenceService Is Needed

**Decision: NO — not in 05B.**

Customer ID persistence is a single column write on the `User` entity. The existing `UserRepository` (via TypeORM's standard `Repository<User>`) can handle `stripeCustomerId` updates. No separate service needed. Customer creation is 05C scope.

### 8.5 Whether Controller Endpoints Are Needed in 05B

**Decision: NO — deferred to 05C/05D.**

No REST endpoints are needed in 05B. The entity, repository, and migration are internal infrastructure. Endpoints:
- Checkout: 05C (`POST /api/billing/checkout`)
- Webhook: 05D (`POST /api/billing/webhook`)
- Billing portal: 05C/05F

### 8.6 Module Wiring Boundary

| Item | Decision |
|------|----------|
| `SubscriptionModule` | CREATE — imports `TypeOrmModule.forFeature([Subscription])`, provides and exports `SubscriptionRepository`. |
| `BillingModule` | NOT MODIFIED — existing `BillingModule` handles `BillingSnapshot` and `UsageRecord`. Subscription is a separate concern. |
| `PaymentsModule` | NOT MODIFIED — handles provider abstraction only. |
| `entities/index.ts` | EXTEND — add `Subscription` export. |
| `AppModule` | May need `SubscriptionModule` import — evaluate at Step 3 based on consumer needs. If no consumer in 05B, defer to 05C/05D. |

---

## 9. Provider Boundary Decision

| Constraint | Status |
|-----------|--------|
| 05B must not call Stripe/provider APIs | **CONFIRMED** |
| Provider customer/subscription IDs stored only from future 05C/05D inputs | **CONFIRMED** — `stripe_customer_id` and `stripe_subscription_id` columns accept values but 05B does not populate them from provider calls |
| No SDK/package/env changes in 05B | **CONFIRMED** — no `stripe` package, no env keys, no `.env.example` changes |
| 05A provider mode contracts remain untouched | **CONFIRMED** — `ProviderMode`, `ProviderResult<T>`, `ProviderErrorCode`, `StripePaymentProvider` mode behavior, `ChargeReadinessService` extension — all unchanged in 05B |

---

## 10. Implementation vs Migration/Test Split Decision

**Decision: A — 05B can proceed as one bounded Step 3 implementation.**

### Rationale

The scope is well-bounded:
1. One new entity file (`Subscription`).
2. One new repository file (`SubscriptionRepository`).
3. One new module file (`SubscriptionModule`).
4. One entity index update.
5. One or two migration files (subscription table alignment + customer ID unique index).
6. Unit tests for entity shape, repository queries, and migration correctness.

This is comparable in complexity to BILLING-READY-03B (which created `CreditBalance` and `CreditDeductionRecord` entities, repositories, migration, and module in a single Step 3). No further split is needed.

### Why Not B (Split)

- Migration and entity are tightly coupled — creating the entity without the migration is incorrect.
- Repository tests need the entity to be defined.
- Single bounded pass avoids coordination overhead.

### Why Not C (Validation-Only)

- There are concrete artifacts to create (entity, repository, migration, module).
- Validation-only would leave no usable artifacts for 05C/05D.

### Why Not D (Pause for Approval)

- Schema decisions are clear from the source-path review.
- Existing raw SQL schema provides a clear target.
- No ambiguity requiring Keith approval beyond what's already granted.

---

## 11. Exact Step 3 File Boundary

### Production Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/entities/subscription.entity.ts` | CREATE | TypeORM `Subscription` entity with fields from Section 5.4 |
| 2 | `services/api-gateway/src/entities/index.ts` | EXTEND | Add `Subscription` export |
| 3 | `services/api-gateway/src/billing/subscription/subscription.repository.ts` | CREATE | Repository with `findActiveByUserId()`, `findByStripeSubscriptionId()`, `findByUserId()` |
| 4 | `services/api-gateway/src/billing/subscription/subscription.module.ts` | CREATE | Module importing `TypeOrmModule.forFeature([Subscription])`, providing/exporting repository |

### Migration Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/migrations/XXXXXXXXX-AlignSubscriptionsTableWithTypeORM.ts` | CREATE | Align existing raw SQL `subscriptions` table: add missing columns, update CHECK constraints, add indexes |
| 2 | `services/api-gateway/src/migrations/XXXXXXXXX-AddStripeCustomerIdUniqueIndex.ts` | CREATE | Add unique partial index on `users.stripe_customer_id` |

### Test Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/billing/subscription/__tests__/subscription.entity.spec.ts` | CREATE | Entity shape/column validation tests |
| 2 | `services/api-gateway/src/billing/subscription/__tests__/subscription.repository.spec.ts` | CREATE | Repository method tests (mocked DataSource) |
| 3 | `services/api-gateway/src/billing/subscription/__tests__/subscription.module.spec.ts` | CREATE | Module composition test |

### Files NOT Changed in 05B

- No frontend files
- No `.env.example` changes
- No `package.json` changes
- No `stripe` package
- No provider files (`stripe-payment.provider.ts`, `payment-provider.interface.ts`, `payments.module.ts`)
- No `charge-readiness.service.ts` changes
- No `credit-balance.guard.ts` changes
- No controller/endpoint files
- No `credit_grants` or `webhook_events` entities (deferred to 05D/05E)
- No `credit_balances.purchased_credits` column (deferred to 05E)
- No `database/schema.sql` or `database/init/001_schema.sql` changes (those are raw SQL init, not TypeORM migrations)
- No worker/ai-service changes

---

## 12. Test Plan

| # | Test | Type | Assertions |
|---|------|------|------------|
| 1 | `Subscription` entity has correct table name | Unit | `@Entity('subscriptions')` metadata matches |
| 2 | `Subscription` entity has all required columns | Unit | All columns from Section 5.4 present with correct types and defaults |
| 3 | `Subscription.stripeSubscriptionId` is nullable | Unit | Column metadata confirms nullable |
| 4 | `Subscription.stripePriceId` is nullable | Unit | Column metadata confirms nullable |
| 5 | `Subscription.status` default is `'active'` | Unit | Column default confirmed |
| 6 | `Subscription.cancelAtPeriodEnd` default is `false` | Unit | Column default confirmed |
| 7 | `SubscriptionRepository.findActiveByUserId` returns active subscription | Unit | Mocked query returns subscription with `status IN ('active', 'trialing', 'past_due')` |
| 8 | `SubscriptionRepository.findActiveByUserId` returns null when no active subscription | Unit | Mocked query returns null |
| 9 | `SubscriptionRepository.findByStripeSubscriptionId` returns correct subscription | Unit | Mocked query matches `stripe_subscription_id` |
| 10 | `SubscriptionRepository.findByUserId` returns all subscriptions for user | Unit | Mocked query returns array |
| 11 | `SubscriptionModule` provides `SubscriptionRepository` | Unit | Module metadata inspection |
| 12 | `SubscriptionModule` exports `SubscriptionRepository` | Unit | Module metadata inspection |
| 13 | `users.stripe_customer_id` unique constraint prevents duplicates | Unit | Describe expected migration behavior — actual constraint tested at DB level |
| 14 | One-active-subscription partial unique index | Unit | Describe expected migration behavior |
| 15 | No provider API calls in any test | Unit | No `stripe` import. No network mocks. |
| 16 | No env/package dependency | Unit | No env reads. No new package imports. |
| 17 | 04 balance/deduction invariants unaffected | Compile | `npx tsc --noEmit` passes. Existing credit balance, deduction, guard tests remain passing. |
| 18 | Free/admin/beta/internal users — entity allows null `stripe_subscription_id` | Unit | Entity shape confirms nullable |

### Test Non-Goals

- No DB integration tests (Docker/Postgres not required for 05B Step 3 unless migration validation explicitly justified).
- No Stripe SDK mock tests.
- No webhook ingestion tests (05D).
- No credit grant tests (05E).
- No checkout tests (05C).
- No frontend/browser tests.

---

## 13. Runtime/Provider Validation Decision

| Constraint | Status |
|-----------|--------|
| Docker/PostgreSQL/Redis required for Step 3 | **NO** — 05B is entity/repository/migration creation + unit tests. Migration validation against live DB deferred unless explicitly justified. |
| Stripe/payment/provider API calls | **NONE** — no `stripe` package. No SDK. No network calls. |
| Live/test-mode provider validation | **NONE** — deferred to 05C/05D. |
| Browser smoke | **NONE** — no frontend changes. |
| AGENT-HARNESS write canary | **NONE** — remains a separate track. |
| Runtime commands for validation | `npx tsc --noEmit` and `npm test` (targeted suites) only. |
| If migration/runtime validation needed later | Requires explicit Docker/PostgreSQL readiness and Keith guidance. |

---

## 14. UX/UI Constraints

| Constraint | Status |
|-----------|--------|
| UI implementation in 05B | **NONE** — no frontend changes. |
| Translation key updates | **NONE** — no user-facing text added. |
| Heroicons v2 Outline only | N/A — no UI. |
| Impeccable / Emil Kowalski advisory only | N/A — no UI. |
| Future UI implications | If future billing UI is added (05F), translation keys must be updated in `en.json`, `zh-TW.json`, `zh-CN.json` per multilingual-first rule. |

---

## 15. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Schema mismatch — raw SQL `subscriptions` table shape differs from TypeORM entity | MEDIUM | Migration uses `ALTER TABLE` to add/modify columns. `IF NOT EXISTS` and `IF EXISTS` guards. Test migration up/down. |
| 2 | Migration risk — existing `subscriptions` rows with old CHECK constraints | LOW | Migration updates CHECK constraints in-place. Existing data (if any) likely conforms. Development DB can be reset. |
| 3 | Duplicate customer mapping — `stripe_customer_id` without UNIQUE allows two users with same Stripe customer | MEDIUM | Migration adds unique partial index. Application-level check in 05C `createOrRetrieveCustomer`. |
| 4 | Subscription status ambiguity — `cancelled` vs `expired` timing | LOW | Clear semantic: `cancelled` = user requested cancel, access until period end. `expired` = period ended after cancellation. Webhook handler (05D) manages transition. |
| 5 | One-active-subscription ambiguity — DB vs application enforcement | MEDIUM | Recommended: partial unique index on `(user_id) WHERE status IN ('active', 'trialing', 'past_due')`. Application-level enforcement as backup. |
| 6 | Provider ID spoofing risk — `stripe_subscription_id` written without verification | LOW | 05B does not write provider IDs. 05D webhook handler writes only after signature verification. No direct user-facing write path. |
| 7 | Future webhook ordering risk — events arrive out of order | LOW | 05B creates entity; ordering is 05D concern. Entity captures latest state, not event sequence. `updated_at` timestamp for last-write tracking. |
| 8 | Checkout/webhook coupling risk — subscription record needed before webhook | LOW | 05C creates checkout session → Stripe sends webhook → 05D creates subscription record. No coupling in 05B. |
| 9 | Test false-confidence risk — unit tests use mocked repositories | MEDIUM | Unit tests validate entity shape and repository method signatures. DB-level constraint validation requires integration tests (deferred to 05G or explicit Docker validation step). |
| 10 | Payment/provider call boundary risk — accidental provider call in 05B | LOW | No `stripe` package installed. No SDK import. No provider service called. Entity/repository are pure data access. |
| 11 | `plan_type` value mismatch between raw SQL CHECK and `PLAN_DEFINITIONS` | MEDIUM | Migration updates CHECK constraint to match `PLAN_DEFINITIONS` values (`free`, `starter`, `pro`, `team`). `enterprise` removed (not in `PLAN_DEFINITIONS`). |

---

## 16. Step 3 Readiness Conclusion

| Criterion | Status |
|-----------|--------|
| Ready for Step 3? | **YES** — scope is well-bounded: `Subscription` entity, repository, module, migration (subscription table alignment + customer ID unique index), entity index update, unit tests. |
| Further split required? | **NO** — single bounded Step 3 is sufficient. Comparable to BILLING-READY-03B scope. |
| Migration approval needed? | **YES** — migration modifies existing `subscriptions` table CHECK constraints and adds a unique index on `users.stripe_customer_id`. Keith should confirm migration is acceptable before Step 3 execution. Docker/PostgreSQL must be available for migration validation if required. |
| Recommended model | **GPT-5.3 Codex** — routine implementation of TypeORM entity, repository, module, migration, unit tests. Not security-adjacent (no SDK, no secrets, no provider calls). |
| Exact next prompt type | **Implementation prompt** — 05B Step 3 bounded implementation with exact file boundary from Section 11. Migration validation strategy (unit-only vs Docker integration) should be confirmed. |

---

## 17. Safety Confirmations

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
| No child slices registered (05C/05D/05E/05F/05G) | **CONFIRMED** |
| No env keys added | **CONFIRMED** |
| No package dependencies added | **CONFIRMED** |
| No secrets or placeholder secrets added | **CONFIRMED** |

---

## 18. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05B-CUSTOMER-SUBSCRIPTION-PERSISTENCE-READINESS.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task/child-slice confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, current active task |
| 4 | `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent readiness review — source-of-truth for 05B |
| 5 | `docs/BILLING-READY-05A-CHECKPOINT.md` | 05A completion record — provider contracts LOCKED |
| 6 | `docs/BILLING-READY-05A-PROVIDER-CONTRACTS-READINESS.md` | 05A Step 2 readiness review |
| 7 | `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor parent checkpoint — COMPLETE and LOCKED |
| 8 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | Foundation checkpoint — COMPLETE and LOCKED |
| 9 | `services/api-gateway/src/entities/user.entity.ts` | User entity — `stripeCustomerId` column |
| 10 | `services/api-gateway/src/entities/credit-balance.entity.ts` | Credit balance entity |
| 11 | `services/api-gateway/src/entities/credit-deduction-record.entity.ts` | Deduction record entity |
| 12 | `services/api-gateway/src/entities/user-role.enum.ts` | User roles (admin/user/beta) |
| 13 | `services/api-gateway/src/entities/plan.entity.ts` | Plan entity |
| 14 | `services/api-gateway/src/entities/invoice.entity.ts` | Invoice entity |
| 15 | `services/api-gateway/src/entities/billing-snapshot.entity.ts` | Billing snapshot entity |
| 16 | `services/api-gateway/src/entities/index.ts` | Entity index exports |
| 17 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Payment provider contracts (05A) |
| 18 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Mode-aware Stripe provider (05A) |
| 19 | `services/api-gateway/src/payments/payments.module.ts` | Payments module |
| 20 | `services/api-gateway/src/admin/charge-readiness.service.ts` | Financial kill-switch gate |
| 21 | `services/api-gateway/src/billing/billing.module.ts` | Billing module |
| 22 | `services/api-gateway/src/billing/credit-balance.guard.ts` | Credit balance gate guard (04A) |
| 23 | `services/api-gateway/src/billing/credit-deduction/types.ts` | Deduction event types |
| 24 | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | Plan definitions (free/starter/pro/team) |
| 25 | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | Plan type definitions, MONTHLY_CREDIT_ALLOCATIONS |
| 26 | `services/api-gateway/src/config/database.config.ts` | Database config — entity auto-load, synchronize: false |
| 27 | `services/api-gateway/src/users/users.service.ts` | User service — plan state resolution |
| 28 | `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts` | Credit balance migration (03B) |
| 29 | `services/api-gateway/src/migrations/1771589000000-AddPlansFoundation.ts` | Plans migration — plan_type/plan_status on users |
| 30 | `database/schema.sql` | Raw SQL schema — subscriptions table |
| 31 | `database/init/001_schema.sql` | Init script — subscriptions table |

---

## 19. Summary

BILLING-READY-05B Step 2 customer/subscription persistence readiness review is **COMPLETE**. Key decisions:

1. **Customer identity**: `users.stripe_customer_id` is sufficient. 1:1 mapping. Add UNIQUE partial index. Email is metadata only.
2. **Subscription entity**: CREATE TypeORM `Subscription` entity to align with existing raw SQL `subscriptions` table. Add missing columns (`stripe_price_id`, `cancel_at_period_end`, `cancelled_at`, `updated_at`). Update CHECK constraints for `plan_type` and `status`.
3. **Subscription status values**: `active`, `trialing`, `past_due`, `cancelled`, `expired`, `unpaid`.
4. **One active subscription per user**: Enforced via partial unique index + application logic.
5. **Migration required**: Two migration files — subscription table alignment + customer ID unique index.
6. **Repository/module**: `SubscriptionRepository` and `SubscriptionModule` created. No service (deferred to 05D). No controller (deferred to 05C/05D).
7. **`webhook_events` and `credit_grants` deferred**: To 05D and 05E respectively. No early table creation.
8. **PLAN_DEFINITIONS remains code-only**: Stripe price IDs are env/config.
9. **No provider API calls**: No `stripe` package, no SDK, no network calls.
10. **Single bounded Step 3**: No further split needed.
11. **Ready for Step 3**: Recommended model GPT-5.3 Codex, implementation prompt. Migration approval from Keith recommended.
12. **Zero source/env/package/governance changes** in this Step 2 review.
