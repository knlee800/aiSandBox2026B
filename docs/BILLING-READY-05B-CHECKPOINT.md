# BILLING-READY-05B — Checkpoint

**Task ID:** BILLING-READY-05B
**Parent:** BILLING-READY-05
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-15
**Nature:** Customer / Subscription Persistence Foundation

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-05B |
| Parent | BILLING-READY-05 |
| Family | BILLING READY / STRIPE PAYMENT PROVIDER / CUSTOMER SUBSCRIPTION PERSISTENCE |
| Risk | HIGH — 4-step child-slice loop |
| Registered | 2026-07-15 |
| Completed | 2026-07-15 |
| Keith approval | Keith explicitly approved BILLING-READY-05B registration 2026-07-15. Migration approved by Keith before Step 3 execution. |
| Status | **COMPLETE and LOCKED** |

---

## 2. Step 2 Readiness Summary

**Readiness review:** `docs/BILLING-READY-05B-CUSTOMER-SUBSCRIPTION-PERSISTENCE-READINESS.md`

| Decision | Outcome |
|----------|---------|
| Implementation vs split | **Option A — one bounded Step 3 implementation** |
| Migration required | **YES** — subscription table alignment + customer ID unique index — approved by Keith before Step 3 |
| No provider API calls | **CONFIRMED** — no `stripe` package, no SDK, no network calls |
| No env/secrets/package changes | **CONFIRMED** — deferred to 05C |
| No frontend/i18n | **CONFIRMED** — no UI changes |
| No checkout/webhook/credit-grant code | **CONFIRMED** — deferred to 05C/05D/05E |
| Further split required | **NO** — single bounded Step 3 sufficient |

---

## 3. Workflow Steps

| Step | Description | Status |
|------|-------------|--------|
| 1 | Registration | COMPLETE (2026-07-15) |
| 2 | Customer/subscription persistence readiness / exact schema boundary | COMPLETE (2026-07-15) — `docs/BILLING-READY-05B-CUSTOMER-SUBSCRIPTION-PERSISTENCE-READINESS.md` |
| 3 | Bounded implementation — entity, repository, module, migrations, tests | COMPLETE (2026-07-15) |
| 4 | Consolidation / checkpoint | COMPLETE (2026-07-15) — this file |

---

## 4. Production Files Created / Changed

| # | File | Action |
|---|------|--------|
| 1 | `services/api-gateway/src/entities/subscription.entity.ts` | CREATED — TypeORM `Subscription` entity for `subscriptions` table |
| 2 | `services/api-gateway/src/entities/index.ts` | EXTENDED — added `Subscription` export |
| 3 | `services/api-gateway/src/billing/subscription/subscription.repository.ts` | CREATED — `SubscriptionRepository` with typed query methods |
| 4 | `services/api-gateway/src/billing/subscription/subscription.module.ts` | CREATED — `SubscriptionModule` wiring `TypeOrmModule.forFeature([Subscription])` |

---

## 5. Migration Files Created (Not Executed)

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/migrations/1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | Align existing raw SQL `subscriptions` table with TypeORM entity; add columns, update CHECK constraints, add indexes |
| 2 | `services/api-gateway/src/migrations/1772200100000-AddStripeCustomerIdUniqueIndex.ts` | Add unique partial index `idx_users_stripe_customer_id` on `users.stripe_customer_id` |

Migration files are created but **not executed**. No live DB migration occurred in 05B. Execution requires Docker/PostgreSQL readiness and Keith guidance.

---

## 6. Test Files Created

| # | File | Tests |
|---|------|-------|
| 1 | `services/api-gateway/src/billing/subscription/__tests__/subscription.entity.spec.ts` | 16 tests — entity shape, column types, defaults, nullable fields |
| 2 | `services/api-gateway/src/billing/subscription/__tests__/subscription.repository.spec.ts` | 14 tests — repository method behavior (mocked DataSource) |
| 3 | `services/api-gateway/src/billing/subscription/__tests__/subscription.module.spec.ts` | 3 tests — module composition, providers/exports |
| 4 | `services/api-gateway/src/billing/subscription/__tests__/subscription-migration.spec.ts` | 20 tests — migration SQL structure, idempotency guards, index definitions |

---

## 7. Subscription Entity Behavior

| Attribute | Value |
|-----------|-------|
| Decorator | `@Entity('subscriptions')` |
| Primary key | UUID — `id` |
| Foreign key | `userId` — FK to `users(id)` |
| Relation | `@ManyToOne(() => User)` with `@JoinColumn({ name: 'user_id' })` |
| `stripeSubscriptionId` | `varchar(255)`, nullable — `sub_xxx` from Stripe |
| `stripePriceId` | `varchar(255)`, nullable — `price_xxx` from Stripe |
| `planType` | `varchar(50)`, NOT NULL, default `'free'` |
| `status` | `varchar(20)`, NOT NULL, default `'active'` |
| `currentPeriodStart` | `timestamptz`, NOT NULL |
| `currentPeriodEnd` | `timestamptz`, NOT NULL |
| `cancelAt` | `timestamptz`, nullable |
| `cancelAtPeriodEnd` | `boolean`, NOT NULL, default `false` |
| `cancelledAt` | `timestamptz`, nullable |
| `createdAt` | `timestamptz`, NOT NULL, auto-set |
| `updatedAt` | `timestamptz`, NOT NULL, auto-updated |
| Exported constants | `SUBSCRIPTION_STATUSES` and `SUBSCRIPTION_PLAN_TYPES` |
| Auto-loading | Picked up by existing `database.config.ts` entity glob pattern `**/*.entity{.ts,.js}` |

### Plan Type Values

`free` | `starter` | `pro` | `team`

### Status Values

`active` | `trialing` | `past_due` | `cancelled` | `expired` | `unpaid`

---

## 8. Customer Identity Persistence

| Aspect | Decision |
|--------|----------|
| Mapping model | 1:1 — one Stripe customer per aiSandBox user |
| `users.stripe_customer_id` | Remains nullable `varchar(255)` — free/admin/beta users have NULL |
| Unique constraint | `idx_users_stripe_customer_id` — UNIQUE WHERE `stripe_customer_id IS NOT NULL` |
| Multiple NULLs | Allowed — PostgreSQL partial UNIQUE index permits multiple NULL values |
| No Stripe customer creation | Deferred to 05C |
| No provider API calls | CONFIRMED |

---

## 9. Migration Summary

### Migration 1: `1772200000000-AlignSubscriptionsTableWithTypeORM`

- `CREATE TABLE IF NOT EXISTS subscriptions` — idempotent table creation
- FK to `users(id)` guarded with `IF NOT EXISTS`
- Adds columns: `stripe_price_id`, `cancel_at_period_end`, `cancelled_at`, `created_at`, `updated_at`
- Updates `plan_type` CHECK constraint to `('free', 'starter', 'pro', 'team')`
- Updates `status` CHECK constraint to `('active', 'trialing', 'past_due', 'cancelled', 'expired', 'unpaid')`
- Adds `idx_subscriptions_stripe_subscription_id` — unique partial index WHERE NOT NULL
- Adds `idx_subscriptions_one_active_per_user` — partial unique index WHERE `status IN ('active', 'trialing', 'past_due')`
- Adds `idx_subscriptions_user_id` index
- Adds `idx_subscriptions_status` index
- Full `down()` migration restores original CHECK constraints and drops added columns/indexes

### Migration 2: `1772200100000-AddStripeCustomerIdUniqueIndex`

- Adds `idx_users_stripe_customer_id` — UNIQUE WHERE `stripe_customer_id IS NOT NULL`
- Idempotent: `IF NOT EXISTS` on up / `IF EXISTS` on down
- No data mutation

---

## 10. Repository / Module Summary

### SubscriptionRepository

| Aspect | Value |
|--------|-------|
| Injectable | YES — `@Injectable()` |
| Construction | `@InjectRepository(Subscription)` wraps TypeORM `Repository<Subscription>` |
| `findActiveByUserId(userId)` | Returns subscription with `status IN ('active', 'trialing', 'past_due')` |
| `findByStripeSubscriptionId(stripeSubscriptionId)` | Returns subscription by Stripe subscription ID |
| `findByUserId(userId)` | Returns all subscriptions for user (including historical) |
| `createSubscription(data)` | Creates and saves a new subscription record |
| `updateSubscription(id, updates)` | Updates subscription by ID and returns updated record |

### SubscriptionModule

| Aspect | Value |
|--------|-------|
| `imports` | `TypeOrmModule.forFeature([Subscription])` |
| `providers` | `SubscriptionRepository` |
| `exports` | `SubscriptionRepository` |
| `BillingModule` | NOT MODIFIED |
| `PaymentsModule` | NOT MODIFIED |
| `AppModule` | NOT MODIFIED — no `SubscriptionModule` import until a consumer (05C/05D) needs it |
| Controller endpoints | NONE — deferred to 05C/05D |

---

## 11. Validation Results

| Suite / Check | Result | Tests |
|---------------|--------|-------|
| `subscription.entity.spec.ts` | **PASS** | 16/16 |
| `subscription.repository.spec.ts` | **PASS** | 14/14 |
| `subscription.module.spec.ts` | **PASS** | 3/3 |
| `subscription-migration.spec.ts` | **PASS** | 20/20 |
| `npx jest --runInBand "subscription"` | **PASS** | 53/53 |
| `npx jest --runInBand "migration"` | **PASS** | 39/39 |
| `npx jest --runInBand "customer"` | No matching tests — customer ID index covered by `subscription-migration.spec.ts` | — |
| `npx jest --runInBand "credit-balance"` | **PASS** — regression | 74/74 |
| `npx tsc --noEmit` (api-gateway) | **PASS** | exit code 0 |
| Linter (new/changed files) | **PASS** | 0 errors |

---

## 12. Safety Confirmations

| Constraint | Status |
|-----------|--------|
| No Stripe SDK/package installed or imported | **CONFIRMED** |
| No provider API calls | **CONFIRMED** |
| No env/secrets changes | **CONFIRMED** |
| No frontend changes | **CONFIRMED** |
| No Docker/Postgres/Redis/runtime calls | **CONFIRMED** |
| No real DB migration execution | **CONFIRMED** — migration files created only |
| No governance files changed during Step 3 | **CONFIRMED** |
| No AGENT-HARNESS write canary | **CONFIRMED** |
| No new package dependencies added | **CONFIRMED** |
| No secrets or placeholder secrets added to source | **CONFIRMED** |
| No checkout implementation | **CONFIRMED** — deferred to 05C |
| No webhook implementation | **CONFIRMED** — deferred to 05D |
| No credit-grant/top-up implementation | **CONFIRMED** — deferred to 05E |
| No `webhook_events` or `credit_grants` entities | **CONFIRMED** — deferred to 05D/05E |

---

## 13. Parent / Child Status

| Task | Status |
|------|--------|
| BILLING-READY-05 | **ACTIVE** — Steps 1–2 COMPLETE. Step 3 in progress via child slices. 05A COMPLETE and LOCKED. 05B COMPLETE and LOCKED. |
| BILLING-READY-05A | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05B | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05C | Planned only — next recommended — **NOT REGISTERED** |
| BILLING-READY-05D | Planned only — **NOT REGISTERED** |
| BILLING-READY-05E | Planned only — **NOT REGISTERED** |
| BILLING-READY-05F | Planned only — **NOT REGISTERED** |
| BILLING-READY-05G | Planned only — **NOT REGISTERED** |
| BILLING-READY-04 | **COMPLETE and LOCKED** — 2026-07-13 |
| BILLING-READY-03 | **COMPLETE and LOCKED** — 2026-07-07 |
| AGENT-PLATFORM-07F | **COMPLETE and LOCKED** — 2026-07-12 |
| AGENT-HARNESS-07 | **COMPLETE and LOCKED** — 2026-07-07 |
| AGENT-HARNESS-06E | **COMPLETE and LOCKED** — 2026-07-09 |

---

## 14. Next Recommended Task

**BILLING-READY-05C — Checkout / Credit Top-Up Session Creation**

Scope includes: Stripe SDK installation (requires Keith approval), `createCheckoutSession()` implementation in `StripePaymentProvider`, customer creation/retrieval via `createOrRetrieveCustomer()`, checkout endpoint (`POST /api/billing/checkout`), redirect/callback handling, subscription record population after checkout completion.

**Status: NOT REGISTERED.** Requires Keith explicit approval before registration.

---

## 15. Locked Invariants

After BILLING-READY-05B is COMPLETE and LOCKED, the following invariants are established and must not be altered without an explicitly registered task:

| Invariant | Description |
|-----------|-------------|
| `Subscription` entity | `@Entity('subscriptions')` — UUID PK, userId FK, all fields from Section 7 |
| `SUBSCRIPTION_STATUSES` | `active`, `trialing`, `past_due`, `cancelled`, `expired`, `unpaid` — exported constant |
| `SUBSCRIPTION_PLAN_TYPES` | `free`, `starter`, `pro`, `team` — exported constant |
| `SubscriptionRepository` | Injectable — `findActiveByUserId`, `findByStripeSubscriptionId`, `findByUserId`, `createSubscription`, `updateSubscription` |
| `SubscriptionModule` | `TypeOrmModule.forFeature([Subscription])`, provides/exports `SubscriptionRepository` |
| Unique partial index on `users.stripe_customer_id` | `idx_users_stripe_customer_id` — UNIQUE WHERE NOT NULL (migration created, not yet executed) |
| One-active-subscription partial index | `idx_subscriptions_one_active_per_user` — UNIQUE ON `user_id` WHERE `status IN ('active', 'trialing', 'past_due')` (migration created, not yet executed) |
| No `stripe` SDK | Deferred to 05C — no import, no package |
| No live/test-mode API calls | Deferred to 05C/05D — no network calls |
| No checkout implementation | Deferred to 05C |
| No webhook ingestion | Deferred to 05D |
| No credit grant | Deferred to 05E |
| AGENT-HARNESS write canary | Remains a separate track — not registered |

---

## 16. Provider / Payment Call Safety

**Provider and payment calls remain NOT APPROVED.**

- No `stripe` SDK call is permitted in any future task without Keith explicit approval.
- No live Stripe API calls without Keith providing API keys and explicit per-slice approval.
- Test-mode calls require Keith's test-mode keys and explicit approval (deferred to 05C).
- `BILLING_CHARGES_ENABLED` must remain `false` in all development environments.
- Provider mode default must remain `disabled`.

---

## 17. Related Documents

| Document | Purpose |
|----------|---------|
| `docs/BILLING-READY-05B-CUSTOMER-SUBSCRIPTION-PERSISTENCE-READINESS.md` | Step 2 readiness review — source-of-truth for 05B decisions |
| `docs/BILLING-READY-05A-CHECKPOINT.md` | 05A completion record — provider contracts LOCKED |
| `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent 05 Step 2 readiness review — Stripe selection, split decision |
| `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor parent checkpoint — COMPLETE and LOCKED |
| `docs/BILLING-READY-03D3-CHECKPOINT.md` | Foundation checkpoint — COMPLETE and LOCKED |

---

## 18. Status Summary

**BILLING-READY-05B: COMPLETE and LOCKED — 2026-07-15**

All 4 steps complete:
1. Registration — COMPLETE (2026-07-15)
2. Customer/subscription persistence readiness review — COMPLETE (2026-07-15)
3. Bounded implementation (entity, repository, module, migrations, tests) — COMPLETE (2026-07-15)
4. Consolidation / checkpoint — COMPLETE (2026-07-15) — this file

Production files changed: 4. Migration files created (not executed): 2. Test files created: 4. Tests: 53/53 PASS (subscription suites). TypeScript clean (exit code 0). Linter 0 errors.
No Stripe SDK. No provider API calls. No env changes. No real migration execution. No frontend. No AGENT-HARNESS write canary.
AGENT-HARNESS write canary remains a separate track — not registered.
Parent BILLING-READY-05 remains ACTIVE with child-slice execution in progress.
Next recommended: BILLING-READY-05C — Checkout / Credit Top-Up Session Creation — NOT REGISTERED.
