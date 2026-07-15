# BILLING-READY-05E — Checkpoint

**Task ID:** BILLING-READY-05E
**Parent:** BILLING-READY-05
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-15
**Nature:** Credit Grant / Top-Up Accounting foundation

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-05E |
| Parent | BILLING-READY-05 |
| Family | BILLING READY / STRIPE PAYMENT PROVIDER / CREDIT GRANT / TOP-UP ACCOUNTING |
| Risk | HIGH — 4-step child-slice loop |
| Registered | 2026-07-15 |
| Completed | 2026-07-15 |
| Keith approval | Keith explicitly approved BILLING-READY-05E registration 2026-07-15. Keith explicitly approved `credit_grants` migration and credit balance accounting implementation before Step 3. |
| Status | **COMPLETE and LOCKED** |

---

## 2. Step 2 Readiness Summary

**Readiness review:** `docs/BILLING-READY-05E-CREDIT-GRANT-TOP-UP-ACCOUNTING-READINESS.md`

| Decision | Outcome |
|----------|---------|
| Provider-call boundary | **Decision A — one bounded no-provider-call Step 3** |
| Keith approved `credit_grants` migration and credit balance accounting implementation | **CONFIRMED** — explicitly approved before Step 3 |
| No Stripe SDK | **CONFIRMED** — no `stripe` package import in any 05E file |
| No package install | **CONFIRMED** — `services/api-gateway/package.json` unchanged |
| No env/secrets changes | **CONFIRMED** — no new env keys, no `.env.example` changes |
| No provider/payment API calls | **CONFIRMED** — all provider calls mocked in tests; no network calls |
| No Stripe CLI/webhook tests | **CONFIRMED** — no Stripe CLI, no real webhook delivery |
| No frontend/i18n | **CONFIRMED** — no UI changes, no translation key updates |
| No real DB migration execution | **CONFIRMED** — migration file created, NOT executed |
| Further split required | **NO** — single bounded Step 3 sufficient |

---

## 3. Production Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/entities/credit-grant.entity.ts` | TypeORM `CreditGrant` entity for `credit_grants` table |
| 2 | `services/api-gateway/src/billing/credit-grant/credit-grant.repository.ts` | `CreditGrantRepository` — CRUD, idempotency queries |
| 3 | `services/api-gateway/src/billing/credit-grant/credit-grant.service.ts` | `CreditGrantService` — grant processing, amount resolution, transaction, idempotency |
| 4 | `services/api-gateway/src/billing/credit-grant/credit-grant.module.ts` | Module wiring — imports `CreditPersistenceModule`, `TypeOrmModule.forFeature([CreditGrant, WebhookEvent])` |
| 5 | `services/api-gateway/src/billing/credit-grant/index.ts` | Barrel export |
| 6 | `services/api-gateway/src/migrations/1772400000000-CreateCreditGrantsTable.ts` | Create `credit_grants` table with idempotency constraint and indexes — file created, NOT executed |

---

## 4. Production Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/entities/index.ts` | Added `CreditGrant` export |
| 2 | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Added `addBalance(id, newBalance, manager?)` method |
| 3 | `services/api-gateway/src/billing/webhook/webhook.service.ts` | Added `CreditGrantService` injection; modified `handleCheckoutCompleted()` (payment mode) and `handleInvoicePaid()` (subscription renewal + non-subscription) to call grant service |
| 4 | `services/api-gateway/src/billing/webhook/webhook.module.ts` | Imported `CreditGrantModule` |

---

## 5. Test Files Created

| # | File | Tests |
|---|------|-------|
| 1 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.entity.spec.ts` | 10 tests — entity shape, columns, constraints, defaults |
| 2 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.repository.spec.ts` | 13 tests — CRUD, idempotency queries |
| 3 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.service.spec.ts` | 27 tests — grant processing, amount resolution, transaction, idempotency, error handling |
| 4 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.module.spec.ts` | 5 tests — module composition |
| 5 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant-migration.spec.ts` | 17 tests — migration SQL structure, idempotency guards, indexes |
| 6 | `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant-integration.spec.ts` | 24 tests — webhook → grant integration, no-double-credit, balance update |

---

## 6. CreditGrant Entity Behavior

| Aspect | Detail |
|--------|--------|
| Decorator | `@Entity('credit_grants')` |
| Columns | 20 columns: `id`, `owner_id`, `owner_type`, `grant_type`, `source_type`, `source_event_id`, `provider`, `provider_event_id`, `webhook_event_id`, `plan_type`, `top_up_pack_id`, `amount`, `balance_before`, `balance_after`, `status`, `error_code`, `error_message`, `granted_at`, `created_at`, `updated_at` |
| `status` default | `pending` |
| `owner_type` default | `user` |
| `provider` default | `stripe` |
| `source_event_id` | Unique idempotency key |
| CHECK constraints | `amount > 0`; `balance_after >= balance_before` |
| Exported constants | `CREDIT_GRANT_STATUSES`, `CREDIT_GRANT_TYPES`, `CREDIT_GRANT_SOURCE_TYPES` |

---

## 7. Migration Summary

| Aspect | Detail |
|--------|--------|
| File | `services/api-gateway/src/migrations/1772400000000-CreateCreditGrantsTable.ts` |
| SQL | `CREATE TABLE IF NOT EXISTS credit_grants` |
| Unique index | `idx_credit_grants_source_event_id` UNIQUE on `source_event_id` |
| Index on owner | `idx_credit_grants_owner` on `(owner_id, owner_type)` |
| Index on webhook_event | `idx_credit_grants_webhook_event` on `(webhook_event_id)` WHERE NOT NULL |
| Index on status | `idx_credit_grants_status` on `(status)` |
| Index on created_at | `idx_credit_grants_created_at` on `(created_at DESC)` |
| Index on grant_type | `idx_credit_grants_grant_type` on `(grant_type)` |
| CHECK constraints | `amount > 0`; `balance_after >= balance_before`; `status IN (...)` ; `grant_type IN (...)`; `source_type IN (...)` |
| Down migration | Full reverse: drop indexes first, drop table — `IF EXISTS` guards |
| Data mutation | None — schema only |
| Execution | **NOT executed** — file created only |

---

## 8. CreditBalanceRepository.addBalance() Behavior

| Aspect | Detail |
|--------|--------|
| Method signature | `addBalance(id: string, newBalance: number, manager?: EntityManager)` |
| Symmetry | Symmetric to existing `deductBalance()` method |
| Transaction pattern | Uses same transactional `EntityManager` pattern — compatible with `FOR UPDATE` lock |
| Balance assertion | Does not alter deduction code; CHECK constraint `balance >= 0` never violated by additions |
| Impact | Preserves all existing public behavior; adds one new method only |

---

## 9. CreditGrantRepository Behavior

| Method | Behavior |
|--------|---------|
| `findBySourceEventId(sourceEventId)` | Query by unique `source_event_id` for idempotency pre-check |
| `findByWebhookEventId(webhookEventId)` | Query by `webhook_event_id` for audit/lookup |
| `createGrant(data)` | INSERT new `CreditGrant` record with status `pending` |
| `markGranted(id, params, manager?)` | UPDATE status to `granted`, set `balance_before`, `balance_after`, `granted_at` |
| `markFailed(id, errorCode, errorMessage, manager?)` | UPDATE status to `failed`, set `error_code`, `error_message` |
| `markIgnored(id, manager?)` | UPDATE status to `ignored` |
| Optional `EntityManager` | Supports transactional `EntityManager` for atomic operations |
| No provider calls | No Stripe/provider interaction; no real DB calls during tests |

---

## 10. CreditGrantService Behavior

| Aspect | Detail |
|--------|--------|
| Transaction boundary | `DataSource.transaction()` wraps: credit_grant insert/update + credit balance lock + credit balance update + mark granted/failed/ignored |
| Idempotency — layer 1 | 05D `WebhookEventRepository.findByProviderEventId()` prevents reprocessing duplicates |
| Idempotency — layer 2 | `CreditGrantRepository.findBySourceEventId()` pre-transaction check returns existing grant |
| Idempotency — layer 3 | Unique `source_event_id` constraint + 23505 catch fallback resolves races |
| Granted grants | Immutable — no further status transitions after `granted` |
| Failed grants | Persist `error_code`/`error_message`; NOT auto-retried |
| Ignored grants | Do not mutate balance; used for unknown/unsupported event types |
| No Stripe/provider calls | `CreditGrantService` consumes already-parsed event data only |
| No env/package dependency | No external packages; no env keys read |

---

## 11. Top-Up Grant Model

| Aspect | Detail |
|--------|--------|
| Pack mapping | Uses `TOP_UP_PACK_MAP` from 05C — `topup_1000` → 1,000 credits; `topup_5000` → 5,000 credits; `topup_20000` → 20,000 credits |
| Pack ID resolution | From `request.topUpPackId` or `metadata.aisandbox_topup_pack_id` |
| Missing metadata | Grant fails — error code `AMOUNT_RESOLUTION_FAILED` |
| Unknown pack | Grant fails — error code `UNKNOWN_PACK` |
| User-supplied amounts | Rejected — amount always derived server-side from `TOP_UP_PACK_MAP` |
| Unknown pack credits | No credits granted — safe failure mode |

---

## 12. Subscription Monthly/Renewal Grant Model

| Aspect | Detail |
|--------|--------|
| Plan allocation mapping | Uses `MONTHLY_CREDIT_ALLOCATIONS` — `free: 500`; `starter: 5,000`; `pro: 25,000`; `team: 100,000` |
| Initial grant trigger | `checkout.session.completed` with subscription mode |
| Renewal grant trigger | `invoice_paid` with valid `subscriptionId` |
| Grant types | `subscription_initial` / `subscription_monthly` |
| Idempotency | Event-level `source_event_id` (Stripe event ID) prevents duplicate grants |
| Proration/upgrade/downgrade | Deferred — not in 05E scope |
| Unknown plan | Grant fails — error code `AMOUNT_RESOLUTION_FAILED` |

---

## 13. WebhookService Integration

| Aspect | Detail |
|--------|--------|
| `CreditGrantService` injection | Injected into `WebhookService` constructor |
| `handleCheckoutCompleted()` payment mode | `processGrant(topup)` called — replaces previous early-return deferral |
| `handleCheckoutCompleted()` subscription mode | Existing subscription logic preserved + `processGrant(subscription_initial)` added |
| `handleInvoicePaid()` non-subscription | `processGrant(topup)` called — replaces previous early-return deferral |
| `handleInvoicePaid()` subscription renewal | Existing renewal logic preserved + `processGrant(subscription_monthly)` added |
| Grant failure handling | Failures caught and logged; do not fail overall webhook event processing |
| `webhook_events.status` | Remains `processed` regardless of grant outcome |
| `routeEvent()` passthrough | Passes `webhookEventId` and `providerEventId` to grant service |
| 05D behavior preserved | All 05D invariants preserved except the approved 05E integration points |

---

## 14. Transaction / Idempotency / No-Double-Credit

| Layer | Description |
|-------|------------|
| Layer 1 | 05D `WebhookEventRepository.findByProviderEventId()` — prevents duplicate webhook reprocessing |
| Layer 2 | `CreditGrantRepository.findBySourceEventId()` pre-check — returns existing grant without mutation |
| Layer 3 | Unique `source_event_id` + 23505 catch fallback — resolves concurrent race conditions |
| Single transaction | `DataSource.transaction()` — lock + insert + update — all-or-nothing |
| Partial credit | Not possible — transaction atomicity guarantees complete rollback on any failure |
| Duplicate `sourceEventId` | Does not double-credit — returns existing grant result |

---

## 15. Module Wiring

| Aspect | Detail |
|--------|--------|
| `CreditGrantModule` imports | `CreditPersistenceModule` + `TypeOrmModule.forFeature([CreditGrant, WebhookEvent])` |
| `CreditGrantModule` provides | `CreditGrantRepository` + `CreditGrantService` |
| `CreditGrantModule` exports | `CreditGrantService` |
| `WebhookModule` | Imports `CreditGrantModule` only |
| `AppModule` | No broadening — `CreditGrantModule` imported into `WebhookModule` only |

---

## 16. Tests and Validation

| Suite | Count | Result |
|-------|-------|--------|
| `credit-grant.entity.spec.ts` | 10 | PASS |
| `credit-grant.repository.spec.ts` | 13 | PASS |
| `credit-grant.service.spec.ts` | 27 | PASS |
| `credit-grant.module.spec.ts` | 5 | PASS |
| `credit-grant-migration.spec.ts` | 17 | PASS |
| `credit-grant-integration.spec.ts` | 24 | PASS |
| **Total credit-grant tests** | **96/96** | **PASS** |

**Regression results:**

| Command | Result |
|---------|--------|
| `npx jest --runInBand "credit-grant"` | PASS — 96/96, 6 suites |
| `npx jest --runInBand "webhook"` | PASS — 108/108, 6 suites |
| `npx jest --runInBand "credit-balance"` | PASS — 74/74, 5 suites |
| `npx jest --runInBand "checkout"` | PASS — 58/58, 4 suites |
| `npx jest --runInBand "usage-ledger"` | PASS — 60/60, 2 suites |
| `npx tsc --noEmit` | PASS — exit code 0 |
| Linter (new/changed files) | PASS — 0 errors |
| **Total: 96 new + 300 regression** | **396/396** | **PASS** |

---

## 17. Safety Confirmations

| Constraint | Status |
|-----------|--------|
| No subagents used in Step 3 | **CONFIRMED** |
| No Stripe SDK / package / env / secrets changes | **CONFIRMED** |
| No provider / payment API calls | **CONFIRMED** |
| No Stripe CLI / webhook tests | **CONFIRMED** |
| No frontend changes | **CONFIRMED** |
| No Docker / Postgres / Redis / runtime calls | **CONFIRMED** |
| No real DB calls | **CONFIRMED** |
| Migration file created but NOT executed | **CONFIRMED** |
| No real provider / payment validation | **CONFIRMED** |
| 04 credit balance / deduction invariants preserved | **CONFIRMED** |
| 05D webhook behavior preserved except approved 05E integration | **CONFIRMED** |
| No governance changes during Step 3 | **CONFIRMED** |
| No AGENT-HARNESS write canary | **CONFIRMED** |

---

## 18. Parent / Child Status

| Task | Status |
|------|--------|
| BILLING-READY-05 | **ACTIVE** — Steps 1–2 COMPLETE. Step 3 IN PROGRESS via child slices |
| BILLING-READY-05A | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05B | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05C | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05D | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05E | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05F | Planned only — next recommended — not registered |
| BILLING-READY-05G | Planned only — not registered |
| BILLING-READY-04 | **COMPLETE and LOCKED** — 2026-07-13 |

---

## 19. Next Recommended Task

**BILLING-READY-05F — Billing UI / Customer Portal**

- Not registered.
- Owns: billing portal frontend, subscription management UI, credit balance display, purchase/top-up flow UI, billing history.
- Prerequisite: 05E COMPLETE and LOCKED (satisfied).
- Registration requires Keith explicit approval.
- Note: 05F is UX/UI work and must follow the multilingual-first rule (update `en.json`, `zh-TW.json`, `zh-CN.json`), use Heroicons v2 Outline only, and the Impeccable and Emil Kowalski advisory skills.

---

## 20. Files Changed During Consolidation

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05E-CHECKPOINT.md` | CREATED — this file |
| 2 | `TASKS.md` | UPDATED — 05E COMPLETE and LOCKED, split table updated, validation recorded |
| 3 | `TASKS_BACKLOG_FULL.md` | UPDATED — mirrors TASKS.md |
| 4 | `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATED — 05E COMPLETE and LOCKED, 05F next recommended not registered |

**No implementation, test, migration, or runtime files changed during consolidation.**
