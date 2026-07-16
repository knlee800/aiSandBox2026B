# BILLING-READY-05G — Regression / Runtime Validation Readiness and Exact Safety Plan

**Task ID:** BILLING-READY-05G
**Parent:** BILLING-READY-05
**Step:** 2 — Regression / Runtime Validation Readiness and Exact Safety Plan
**Status:** Step 2 COMPLETE
**Date:** 2026-07-16
**Nature:** Static readiness/safety planning — no execution

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05G ACTIVE — Step 1 COMPLETE (Registration — 2026-07-16) | **CONFIRMED** |
| Parent BILLING-READY-05 ACTIVE — Steps 1–2 COMPLETE, Step 3 IN PROGRESS via child slices | **CONFIRMED** |
| BILLING-READY-05A COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05B COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05C COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05D COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05E COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05F COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| Parent BILLING-READY-05 NOT complete yet | **CONFIRMED** — parent completion requires 05G completion |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05G is ACTIVE |
| BILLING-READY-04 COMPLETE and LOCKED (2026-07-13) | **CONFIRMED** |
| BILLING-READY-03 COMPLETE and LOCKED (2026-07-07) | **CONFIRMED** |

---

## 2. Completed Child-Slice Summary (Validation-Relevant)

### 05A — Provider Configuration / Contracts / Readiness

| Deliverable | Validation Relevance |
|-------------|---------------------|
| `ProviderMode` enum (`disabled`/`stub`/`test`/`live`) | Default `disabled` must remain; mode resolution/degradation must be tested |
| `ProviderResult<T>` contract, `ProviderErrorCode` values | Contract shape validation exists — 15 tests |
| `StripePaymentProvider` mode-aware refactor | 49 tests cover disabled/stub behavior |
| `ChargeReadinessService` extended with `providerMode`/`providerModeValid` | 15 tests cover gate behavior |
| **Total 05A tests:** 79 | Must remain PASS in regression |
| No Stripe SDK | Confirmed — no `stripe` package |
| No env/secrets changes | Confirmed |

### 05B — Customer / Subscription Persistence

| Deliverable | Validation Relevance |
|-------------|---------------------|
| `Subscription` entity + `SubscriptionRepository` + `SubscriptionModule` | 53 tests (entity, repository, module, migration) |
| 2 migration files — `AlignSubscriptionsTableWithTypeORM` + `AddStripeCustomerIdUniqueIndex` | Files created, NOT executed — 20 migration-shape tests |
| **Total 05B tests:** 53 | Must remain PASS in regression |
| No real migration execution | Confirmed — migration execution deferred |

### 05C — Checkout / Credit Top-Up Session Creation

| Deliverable | Validation Relevance |
|-------------|---------------------|
| `CheckoutController` + `CheckoutService` + DTOs + price map + URL validator | 58 checkout tests |
| `ChargeReadinessService` gate integration | 15 charge-readiness tests |
| No Stripe SDK, no provider API calls | Confirmed |
| **Total 05C tests:** 58 (+ 15 charge-readiness regression) | Must remain PASS |

### 05D — Webhook Event Ingestion / Idempotency

| Deliverable | Validation Relevance |
|-------------|---------------------|
| `WebhookEvent` entity + `WebhookEventRepository` + `WebhookController` + `WebhookService` + `WebhookModule` | 108 tests (6 suites) |
| `main.ts` `rawBody: true` | Additive — no behavioral change to existing routes |
| Migration `CreateWebhookEventsTable` — file created, NOT executed | 12 migration-shape tests |
| **Total 05D tests:** 108 | Must remain PASS |
| Regression: stripe-payment.provider 49, subscription 53, checkout 58, credit-balance 74 | All must remain PASS |

### 05E — Credit Grant / Top-Up Accounting

| Deliverable | Validation Relevance |
|-------------|---------------------|
| `CreditGrant` entity + `CreditGrantRepository` + `CreditGrantService` + `CreditGrantModule` | 96 tests (6 suites) |
| `CreditBalanceRepository.addBalance()` method | Existing deduction tests unaffected (additive method) |
| `WebhookService` grant integration points | 24 integration tests |
| Migration `CreateCreditGrantsTable` — file created, NOT executed | 17 migration-shape tests |
| **Total 05E tests:** 96 | Must remain PASS |
| Regression: webhook 108, credit-balance 74, checkout 58, usage-ledger 60 | All must remain PASS |

### 05F — Billing UI / Customer Portal

| Deliverable | Validation Relevance |
|-------------|---------------------|
| `BillingReadController` + `BillingReadModule` (3 backend files) | 12 backend tests |
| 7 frontend files (billing page, components, hook, test) | 22 component tests |
| 3 translation files modified (30 keys each, `billing` namespace) | Multilingual coverage verified |
| `app.module.ts` BillingReadModule import | Module wiring only |
| Heroicons v2 Outline only | Confirmed |
| **Total 05F tests:** 12 backend + 22 frontend + 640 frontend full suite | Must remain PASS |
| No customer portal backend endpoint | Portal disabled — "Coming soon" UI |
| No browser smoke performed | Confirmed — deferred |

---

## 3. Migration Readiness Decision

### Migrations to Review

| # | Migration | Source Slice | Status |
|---|-----------|-------------|--------|
| 1 | `1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | 05B | File created, NOT executed |
| 2 | `1772200100000-AddStripeCustomerIdUniqueIndex.ts` | 05B | File created, NOT executed |
| 3 | `1772300000000-CreateWebhookEventsTable.ts` | 05D | File created, NOT executed |
| 4 | `1772400000000-CreateCreditGrantsTable.ts` | 05E | File created, NOT executed |

### Migration File Quality Assessment

All 4 migrations have been inspected. Findings:

- All use `IF NOT EXISTS` / `IF EXISTS` idempotency guards — safe for repeated execution
- All have complete `down()` migrations with proper reverse operations
- No data mutation — schema-only (table creation, column additions, index/constraint updates)
- No destructive operations on existing data
- No dependency on external services or env variables
- Migration-shape tests exist: 05B (20 tests), 05D (12 tests), 05E (17 tests) — total 49 migration-shape tests

### Decision

**Step 3 should inspect migration files (already done above) and run migration-shape tests only.**

Real DB migration execution requires:
1. Docker Desktop running with PostgreSQL container healthy
2. Keith explicit approval before any DB command
3. A separate explicit approval task if migration validation reveals issues

**Recommendation:** Real DB migration validation should be split into a separate explicit Keith-approved task (BILLING-READY-06 or similar) after parent BILLING-READY-05 is closed. Migration-shape tests in Step 3 are sufficient for parent completion.

---

## 4. Static Regression Matrix

### Backend — API Gateway Test Suites

| ID | Suite | Command | Expected |
|----|-------|---------|----------|
| R1 | stripe-payment.provider | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "stripe-payment.provider"` | 49/49 PASS |
| R2 | charge-readiness.service | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "charge-readiness.service"` | 15/15 PASS |
| R3 | payment-provider.contracts | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "payment-provider.contracts"` | 15/15 PASS |
| R4 | subscription | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "subscription"` | 53/53 PASS |
| R5 | checkout | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "checkout"` | 58/58 PASS |
| R6 | webhook | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "webhook"` | 108/108 PASS |
| R7 | credit-grant | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-grant"` | 96/96 PASS |
| R8 | credit-balance | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-balance"` | 74/74 PASS |
| R9 | billing-read | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "billing-read"` | 12/12 PASS |
| R10 | usage-ledger | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "usage-ledger"` | 60/60 PASS |

### Backend — Pre-existing 04 Regression Suites

| ID | Suite | Command | Expected |
|----|-------|---------|----------|
| R11 | credit-balance.guard | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-balance.guard"` | 37/37 PASS |
| R12 | internal-accounting | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "internal-accounting"` | 6/6 PASS |
| R13 | ai-execution.controller.spec | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "ai-execution.controller.spec"` | 38/38 PASS |

### TypeScript Checks

| ID | Check | Command | Expected |
|----|-------|---------|----------|
| T1 | api-gateway tsc | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit` | exit code 0 |
| T2 | ai-service tsc | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsc --noEmit` | exit code 0 |
| T3 | frontend tsc | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit` | exit code 0 |

### Frontend Test Suites

| ID | Suite | Command | Expected |
|----|-------|---------|----------|
| F1 | billing-page-client | `Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\frontend'; npx tsx --test "components/billing/__tests__/*"` | 22/22 PASS |
| F2 | frontend full suite | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test` | 640/640 PASS |

### Build Checks

| ID | Check | Command | Expected |
|----|-------|---------|----------|
| B1 | api-gateway build | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build` | exit code 0 |

### Total Regression Matrix

- **R1–R13:** 13 backend test commands
- **T1–T3:** 3 TypeScript checks
- **F1–F2:** 2 frontend test commands
- **B1:** 1 build command
- **Total: 19 commands**

---

## 5. Runtime Validation Decision

**Decision: A — No runtime required for Step 3.**

Rationale:

1. All 05A–05F child slices were validated with mocked unit/integration tests — no runtime required during their implementation.
2. Migrations are created but NOT executed — no DB schema changes to validate at runtime.
3. No provider/payment API calls exist or need runtime validation.
4. Frontend billing page was validated with component tests — browser smoke is optional and requires Keith approval.
5. All TypeScript, test, and build validation can be performed statically.
6. Runtime validation (Docker/PostgreSQL/Redis, migration execution, API Gateway startup, browser smoke) should be a separate Keith-approved task after parent close.

**Step 3 is static/test-only. No Docker, no PostgreSQL, no Redis, no API Gateway startup, no frontend dev server, no browser smoke.**

---

## 6. Docker / PostgreSQL / Redis Readiness Plan

**Not required for Step 3.** Documented here for future reference when Keith approves runtime validation.

### Services Required (Future)

| Service | Purpose | Container |
|---------|---------|-----------|
| PostgreSQL 15 | Migration execution, entity validation | `aisandbox-postgres` via `docker-compose.yml` |
| Redis 7 | Required for API Gateway startup (BullMQ) | `aisandbox-redis` via `docker-compose.yml` |

### Safe Readiness Checks (Future)

```powershell
# 1. Verify Docker Desktop running
docker info

# 2. Start only postgres and redis (not prometheus/grafana)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis

# 3. Wait for health checks
docker compose ps

# 4. Verify PostgreSQL responding
docker exec aisandbox-postgres pg_isready -U $env:POSTGRES_USER -d $env:POSTGRES_DB

# 5. Verify Redis responding
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ping
```

### Migration Execution (Future — Requires Keith Approval)

```powershell
# Only after Keith explicit approval
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm migration:run -d src/database/database.config.ts
```

### Stop Conditions

- **STOP** if PostgreSQL container fails health check
- **STOP** if Redis container fails health check
- **STOP** if migration produces errors (do not retry without diagnosis)
- **STOP** if any migration mutates existing data (all 4 are schema-only — if behavior differs, stop)
- No destructive DB commands (`DROP DATABASE`, `TRUNCATE`, `DELETE FROM` on production tables)
- No production database access
- No env/secrets exposure in logs or output
- Keith must explicitly approve before execution

---

## 7. Provider / Payment Safety Plan

| Constraint | Status |
|-----------|--------|
| No live Stripe API calls | **CONFIRMED — not approved, not executed** |
| No test Stripe API calls | **CONFIRMED — not approved unless Keith explicitly approves later** |
| No Stripe CLI usage | **CONFIRMED — not approved unless Keith explicitly approves later** |
| No customer portal API calls | **CONFIRMED — no backend portal endpoint exists** |
| No real payment validation | **CONFIRMED — all provider interactions mocked** |
| No `stripe` npm package installed | **CONFIRMED — not in any package.json** |
| No env/secrets changes | **CONFIRMED — no `.env` modifications** |
| No `STRIPE_SECRET_KEY` in source or env | **CONFIRMED** |
| No `STRIPE_WEBHOOK_SECRET` in source or env | **CONFIRMED** |
| `BILLING_CHARGES_ENABLED` default | **`false` — kill-switch active** |
| `STRIPE_PROVIDER_MODE` default | **`disabled` — provider off** |
| Provider mode in 05A tests | **Mocked — no real SDK or API path** |
| Webhook signature verification | **Mocked — no real HMAC validation against Stripe servers** |
| Checkout session creation | **Stub returns only — no real Stripe checkout session** |

**No provider/payment/Stripe calls of any kind in Step 3.**

---

## 8. Browser Smoke Plan

**Browser smoke is NOT required for Step 3.**

However, browser smoke is recommended as a future task for comprehensive billing UI validation. When Keith approves, the following should be tested:

| # | Scenario | Expected Behavior |
|---|----------|------------------|
| 1 | `/[locale]/billing` page load (en) | Billing page renders with balance card, subscription card, top-up section |
| 2 | `/[locale]/billing` page load (zh-TW) | Same layout with Traditional Chinese labels |
| 3 | `/[locale]/billing` page load (zh-CN) | Same layout with Simplified Chinese labels |
| 4 | Loading state | Skeleton/shimmer placeholders visible during fetch |
| 5 | Error state (API unreachable) | Error banner with retry button |
| 6 | Empty/free state (no balance row) | Free plan informational display — no error styling |
| 7 | Checkout button behavior (charges disabled) | Buttons present but checkout returns 503 error (provider disabled) |
| 8 | `?checkout=success` query param | Green success banner displayed |
| 9 | `?checkout=cancelled` query param | Amber cancelled banner displayed |
| 10 | Customer portal "Coming soon" | Disabled button with "Coming soon" subtext |

**Requirements for browser smoke execution:**
- Keith must explicitly approve
- Frontend dev server must be running (`npm run dev` in frontend)
- API Gateway must be running (requires Docker + PostgreSQL + Redis)
- Keith will be guided step-by-step through each scenario
- No actual provider checkout session created
- No real Stripe redirect
- No payment processing

---

## 9. Parent Consolidation Criteria

To mark parent BILLING-READY-05 as COMPLETE and LOCKED after 05G, all of the following must be satisfied:

| # | Criterion | Required |
|---|-----------|----------|
| 1 | BILLING-READY-05A COMPLETE and LOCKED | **YES** — confirmed 2026-07-15 |
| 2 | BILLING-READY-05B COMPLETE and LOCKED | **YES** — confirmed 2026-07-15 |
| 3 | BILLING-READY-05C COMPLETE and LOCKED | **YES** — confirmed 2026-07-15 |
| 4 | BILLING-READY-05D COMPLETE and LOCKED | **YES** — confirmed 2026-07-15 |
| 5 | BILLING-READY-05E COMPLETE and LOCKED | **YES** — confirmed 2026-07-15 |
| 6 | BILLING-READY-05F COMPLETE and LOCKED | **YES** — confirmed 2026-07-15 |
| 7 | BILLING-READY-05G COMPLETE and LOCKED | **PENDING** — requires Step 3 + Step 4 |
| 8 | Static regression matrix PASS or explicitly deferred with recorded reason | **PENDING** — Step 3 will execute |
| 9 | Migration execution status recorded (executed or deferred with reason) | **PENDING** — migrations NOT executed; deferral reason: no runtime approved |
| 10 | Provider/runtime/browser smoke status recorded (executed or deferred with reason) | **PENDING** — all deferred; deferral reason: no provider/runtime/browser approved |
| 11 | Remaining deferred items listed clearly | **PENDING** — will be listed in parent checkpoint |
| 12 | No unresolved safety blockers | **PENDING** — Step 3 will confirm |

### Deferred Items to Record at Parent Close

| Deferred Item | Reason | Future Task |
|---------------|--------|-------------|
| Migration execution (4 migrations) | No Docker/PostgreSQL runtime approved | Separate Keith-approved task |
| Live Stripe provider calls | No Stripe SDK, no API keys, no provider calls approved | Separate Keith-approved task |
| Stripe CLI / webhook testing | Not approved | Separate Keith-approved task |
| Browser smoke for billing page | No frontend dev server / API Gateway runtime approved | Separate Keith-approved task |
| Customer portal backend endpoint | Intentionally deferred — UI shows "Coming soon" | Future billing task |
| Real DB migration validation | No runtime approved | Separate task with Keith approval |
| Plan upgrade/downgrade proration | Out of 05 scope | Future billing task |
| Refunds/chargebacks | Out of 05 scope | Future billing task |
| `purchased_credits` column | Deferred per 05 readiness review | Future billing task |

---

## 10. Implementation vs Split Decision

**Decision: A — Step 3 can be static/test-only validation, no Docker/runtime/browser.**

Rationale:

1. All 05A–05F child slices completed their own targeted validation during implementation.
2. 05G Step 3 is a cross-slice regression matrix — running existing test suites to confirm no regressions across the full 05 family.
3. No new implementation code is created in 05G — it is validation + parent consolidation only.
4. Migration-shape tests already exist and cover SQL structure without requiring real PostgreSQL.
5. Runtime/browser/provider validation is valuable but should not block parent completion — it can be a follow-up task.
6. Step 4 (consolidation/checkpoint) can immediately follow Step 3 in the same window if Step 3 passes cleanly.

**Step 3 and Step 4 (consolidation) can proceed as one bounded validation+consolidation execution if the regression matrix passes without issues.**

---

## 11. Exact Step 3 Prompt Boundary

### Exact Commands to Run (19 total)

**Backend test suites (13 commands):**

1. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "stripe-payment.provider"`
2. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "charge-readiness.service"`
3. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "payment-provider.contracts"`
4. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "subscription"`
5. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "checkout"`
6. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "webhook"`
7. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-grant"`
8. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-balance"`
9. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "billing-read"`
10. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "usage-ledger"`
11. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-balance.guard"`
12. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "internal-accounting"`
13. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "ai-execution.controller.spec"`

**TypeScript checks (3 commands):**

14. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit`
15. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsc --noEmit`
16. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit`

**Frontend test suites (2 commands):**

17. `Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\frontend'; npx tsx --test "components/billing/__tests__/*"`
18. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test`

**Build check (1 command):**

19. `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build`

### Exact Files Allowed to Change in Step 3 + Step 4

| # | File | Allowed Action |
|---|------|----------------|
| 1 | `docs/BILLING-READY-05G-REGRESSION-VALIDATION-REPORT.md` | CREATE — validation results report |
| 2 | `docs/BILLING-READY-05G-CHECKPOINT.md` | CREATE — 05G checkpoint |
| 3 | `docs/BILLING-READY-05-CHECKPOINT.md` | CREATE — parent 05 close checkpoint |
| 4 | `TASKS.md` | UPDATE — 05G COMPLETE and LOCKED, parent 05 COMPLETE and LOCKED |
| 5 | `TASKS_BACKLOG_FULL.md` | UPDATE — mirror TASKS.md |
| 6 | `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATE — 05G and parent 05 COMPLETE and LOCKED |

### Exact Forbidden Actions in Step 3

- No source file changes under `services/` or `frontend/`
- No test file changes
- No migration file changes
- No migration execution
- No package.json changes
- No `.env` or secrets changes
- No Docker/PostgreSQL/Redis commands
- No API Gateway startup
- No frontend dev server startup
- No browser smoke
- No Stripe/payment/provider/customer portal API calls
- No Stripe CLI/webhook tests
- No subagents
- No git commits/pushes unless Keith explicitly requests
- No `tsconfig.tsbuildinfo` modification (restore if build updates it)

### Exact Stop Conditions

- **STOP** if any test suite FAILS with code failures (not environmental/timeout)
- **STOP** if TypeScript check produces errors
- **STOP** if build fails
- **STOP** if a test suite pattern matches unexpectedly broad files
- If a test failure is environmental (e.g., timeout, memory), record it and continue with remaining commands
- If `frontend/tsconfig.tsbuildinfo` is modified by build, restore it: `git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo`

---

## 12. UX/UI Validation Notes

Because 05F included UX/UI work, the following must be confirmed in Step 3:

| # | Check | Method |
|---|-------|--------|
| 1 | Multilingual billing namespace exists in `en.json` | Grep for `"billing"` key — **CONFIRMED** (30 keys) |
| 2 | Multilingual billing namespace exists in `zh-TW.json` | Grep for `"billing"` key — **CONFIRMED** (30 keys) |
| 3 | Multilingual billing namespace exists in `zh-CN.json` | Grep for `"billing"` key — **CONFIRMED** (30 keys) |
| 4 | Heroicons v2 Outline only | 05F checkpoint confirms all icons from `@heroicons/react/24/outline` — **CONFIRMED** |
| 5 | No new UI copy without translations | 05F added no hardcoded English UI copy — **CONFIRMED** |
| 6 | Impeccable/Emil Kowalski skills advisory only | 05F checkpoint confirms skills did not override governance — **CONFIRMED** |
| 7 | No broad redesign | 05F confined to new `/billing` route — **CONFIRMED** |
| 8 | No workspace/sidebar/navigation changes | 05F checkpoint confirms — **CONFIRMED** |
| 9 | Component test coverage | 22 billing-page-client tests — **will be re-validated in Step 3 (F1)** |
| 10 | Frontend full suite clean | 640 tests — **will be re-validated in Step 3 (F2)** |

**No new UI copy will be created in 05G. No translation file changes. No component changes.**

---

## 13. Risks and Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **False confidence from mocked tests** | MEDIUM | All 05A–05F tests use mocked providers/repositories. No real DB, no real Stripe. This is by design for this phase — real integration deferred. Record this in parent checkpoint. |
| 2 | **Migration not executed** | MEDIUM | 4 migration files exist but have never run against a real PostgreSQL database. Migration-shape tests validate SQL structure but not actual DB execution. Deferral recorded. Future task required. |
| 3 | **Docker/runtime instability** | LOW (for Step 3) | Step 3 does not use Docker/runtime. Risk applies only to future runtime validation tasks. |
| 4 | **Provider-call leakage** | LOW | No `stripe` package installed. No SDK import anywhere. No env keys configured. Multiple layers prevent accidental calls. Verified in every 05A–05F checkpoint. |
| 5 | **Browser smoke ambiguity** | LOW | Browser smoke not performed in any 05 child slice. 05F component tests cover render/behavior. Browser smoke deferred with clear future plan. |
| 6 | **Checkout redirect risk** | LOW | Checkout buttons exist in UI but `BILLING_CHARGES_ENABLED=false` and provider `disabled` mode block any real redirect. Stub mode returns `url: null`. No real Stripe checkout session possible. |
| 7 | **Multilingual drift** | LOW | All 3 locale files confirmed to have identical `billing` namespace with 30 keys each. Component tests verify translation hook usage. |
| 8 | **Parent completion too early** | MEDIUM | Parent BILLING-READY-05 must NOT be marked COMPLETE until Step 3 regression matrix passes AND Step 4 consolidation records all deferred items. Deferred items must be explicitly listed. |
| 9 | **Hidden dependency on env/secrets** | LOW | Tests do not read real env. `ConfigService` mocked in all provider tests. `BILLING_CHARGES_ENABLED` defaults to `false`. `STRIPE_PROVIDER_MODE` defaults to `disabled`. No `.env` file read during test execution. |
| 10 | **Test suite pattern overlap** | LOW | Some Jest patterns (e.g., `"credit-balance"`) may match broader than intended. Monitor matched file count in output. If a pattern matches unexpected files, record and assess. |

---

## 14. Step 3 Readiness Conclusion

| Criterion | Status |
|-----------|--------|
| **Ready for Step 3?** | **YES — ready** |
| Step 3 nature | Static/test-only regression validation — no runtime, no Docker, no browser |
| Recommended Step 3 model | GPT-5.3 Codex or Sonnet 4.6 (validation-only — no implementation risk) |
| Keith approval needed before runtime/browser/DB work? | **YES — Keith must approve separately for any Docker/PostgreSQL/Redis/browser/provider work** |
| Can Step 3 and Step 4 combine? | **YES — if regression matrix passes cleanly, Step 4 consolidation can follow immediately** |
| Parent completion timing | Parent BILLING-READY-05 may be marked COMPLETE and LOCKED in Step 4 (consolidation) — not before Step 3 results are confirmed |
| Subagents in Step 3? | **NO — prohibited by user instruction** |

### Step 3 Success Criteria

1. All 19 regression matrix commands PASS (or environmental failures explicitly recorded)
2. Zero code failures across all test suites
3. All 3 TypeScript checks exit code 0
4. API Gateway build exits code 0
5. No source/test/migration/package/env files modified
6. No Docker/runtime/browser/provider commands executed
7. No subagents used
8. Validation report created: `docs/BILLING-READY-05G-REGRESSION-VALIDATION-REPORT.md`

### Step 4 (Consolidation) Deliverables

1. `docs/BILLING-READY-05G-CHECKPOINT.md` — 05G completion record
2. `docs/BILLING-READY-05-CHECKPOINT.md` — parent 05 close checkpoint with all deferred items listed
3. `TASKS.md` — 05G COMPLETE and LOCKED, parent 05 COMPLETE and LOCKED
4. `TASKS_BACKLOG_FULL.md` — mirror TASKS.md
5. `docs/AINOW-EXECUTION-ROADMAP.md` — 05G and parent 05 COMPLETE and LOCKED

---

## 15. Safety Confirmations for This Step (Step 2)

| Constraint | Status |
|-----------|--------|
| No subagents used | **CONFIRMED** |
| No tests run | **CONFIRMED** |
| No builds run | **CONFIRMED** |
| No Docker/PostgreSQL/Redis commands | **CONFIRMED** |
| No API Gateway startup | **CONFIRMED** |
| No frontend dev server | **CONFIRMED** |
| No browser smoke | **CONFIRMED** |
| No Stripe/payment/provider/customer portal API calls | **CONFIRMED** |
| No Stripe CLI/webhook tests | **CONFIRMED** |
| No migration execution | **CONFIRMED** |
| No env/secrets changes | **CONFIRMED** |
| No package changes | **CONFIRMED** |
| No source file changes (services/frontend/database) | **CONFIRMED** |
| No governance file changes (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | **CONFIRMED** |
| No git commits/pushes | **CONFIRMED** |
| Only file created: this readiness document | **CONFIRMED** |

---

## 16. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05G-REGRESSION-RUNTIME-VALIDATION-READINESS.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence |
| 4 | `docs/BILLING-READY-05F-CHECKPOINT.md` | 05F completion record |
| 5 | `docs/BILLING-READY-05E-CHECKPOINT.md` | 05E completion record |
| 6 | `docs/BILLING-READY-05D-CHECKPOINT.md` | 05D completion record |
| 7 | `docs/BILLING-READY-05C-CHECKPOINT.md` | 05C completion record |
| 8 | `docs/BILLING-READY-05B-CHECKPOINT.md` | 05B completion record |
| 9 | `docs/BILLING-READY-05A-CHECKPOINT.md` | 05A completion record |
| 10 | `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent 05 Step 2 readiness review |
| 11 | `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor parent checkpoint |
| 12 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | Foundation checkpoint |
| 13 | `services/api-gateway/package.json` | Dependency verification (no `stripe` package) |
| 14 | `frontend/package.json` | Dependency verification |
| 15 | `package.json` | Root package verification |
| 16 | `docker-compose.yml` | Service topology (postgres, redis, prometheus, grafana) |
| 17 | `docker-compose.local-testing.yml` | Local testing compose file |
| 18 | `docker-compose.prod.yml` | Production compose file |
| 19 | `services/api-gateway/src/migrations/1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | Migration file inspection |
| 20 | `services/api-gateway/src/migrations/1772200100000-AddStripeCustomerIdUniqueIndex.ts` | Migration file inspection |
| 21 | `services/api-gateway/src/migrations/1772300000000-CreateWebhookEventsTable.ts` | Migration file inspection |
| 22 | `services/api-gateway/src/migrations/1772400000000-CreateCreditGrantsTable.ts` | Migration file inspection |
| 23 | `frontend/app/[locale]/billing/page.tsx` | Billing page server component |
| 24 | `frontend/messages/en.json` | Translation key verification — `billing` namespace present (30 keys) |
| 25 | `frontend/messages/zh-TW.json` | Translation key verification — `billing` namespace present (30 keys) |
| 26 | `frontend/messages/zh-CN.json` | Translation key verification — `billing` namespace present (30 keys) |
| 27 | `services/api-gateway/src/billing/**` | Billing module file listing (74 files) |
| 28 | `frontend/components/billing/**` | Billing component file listing (5 files) |
