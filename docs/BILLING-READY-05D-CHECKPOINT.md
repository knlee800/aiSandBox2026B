# BILLING-READY-05D — Checkpoint

**Task ID:** BILLING-READY-05D
**Parent:** BILLING-READY-05
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-15
**Nature:** Webhook Event Ingestion / Idempotency foundation

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-05D |
| Parent | BILLING-READY-05 |
| Family | BILLING READY / STRIPE PAYMENT PROVIDER / WEBHOOK EVENT INGESTION / IDEMPOTENCY |
| Risk | HIGH — 4-step child-slice loop |
| Registered | 2026-07-15 |
| Completed | 2026-07-15 |
| Keith approval | Keith explicitly approved BILLING-READY-05D registration 2026-07-15. Keith explicitly approved `webhook_events` migration and raw-body implementation before Step 3. |
| Status | **COMPLETE and LOCKED** |

---

## 2. Step 2 Readiness Summary

**Readiness review:** `docs/BILLING-READY-05D-WEBHOOK-INGESTION-IDEMPOTENCY-READINESS.md`

| Decision | Outcome |
|----------|---------|
| Provider-call boundary | **Decision A — one bounded stub/test-mode-ready no-provider-call Step 3** |
| Keith approved `webhook_events` migration and raw-body implementation | **CONFIRMED** — explicitly approved before Step 3 |
| No Stripe SDK | **CONFIRMED** — no `stripe` package import in any 05D file |
| No stripe package install | **CONFIRMED** — `services/api-gateway/package.json` unchanged |
| No env/secrets changes | **CONFIRMED** — no new env keys, no `.env.example` changes |
| No real provider calls | **CONFIRMED** — all provider calls mocked in tests; no network calls |
| No Stripe CLI/webhook tests | **CONFIRMED** — no Stripe CLI, no real webhook delivery |
| No frontend/i18n | **CONFIRMED** — no UI changes, no translation key updates |
| No credit grant/top-up accounting | **CONFIRMED** — deferred to 05E |
| Further split required | **NO** — single bounded Step 3 sufficient |

---

## 3. Production Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/entities/webhook-event.entity.ts` | TypeORM `WebhookEvent` entity for `webhook_events` table |
| 2 | `services/api-gateway/src/billing/webhook/webhook.controller.ts` | `@Controller('billing/webhooks')` — `POST stripe` — public unauthenticated, signature-protected |
| 3 | `services/api-gateway/src/billing/webhook/webhook.service.ts` | Event verification, parsing, idempotency, routing, subscription updates, event status persistence |
| 4 | `services/api-gateway/src/billing/webhook/webhook-event.repository.ts` | `WebhookEventRepository` — CRUD, idempotency queries |
| 5 | `services/api-gateway/src/billing/webhook/webhook.module.ts` | Module wiring — imports `PaymentsModule`, `SubscriptionModule`, `TypeOrmModule.forFeature([WebhookEvent, User])` |
| 6 | `services/api-gateway/src/migrations/1772300000000-CreateWebhookEventsTable.ts` | Create `webhook_events` table with idempotency constraints and indexes — file created, NOT executed |

---

## 4. Production Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/entities/index.ts` | Added `WebhookEvent` export |
| 2 | `services/api-gateway/src/main.ts` | Added `rawBody: true` to `NestFactory.create()` options |
| 3 | `services/api-gateway/src/app.module.ts` | Added `WebhookModule` import |

---

## 5. Test Files Created

| # | File | Tests |
|---|------|-------|
| 1 | `services/api-gateway/src/billing/webhook/__tests__/webhook.controller.spec.ts` | 13 tests — endpoint, signature, response shape |
| 2 | `services/api-gateway/src/billing/webhook/__tests__/webhook.service.spec.ts` | 41 tests — verification, parsing, idempotency, routing, subscription updates |
| 3 | `services/api-gateway/src/billing/webhook/__tests__/webhook-event.repository.spec.ts` | 13 tests — CRUD, idempotency queries |
| 4 | `services/api-gateway/src/billing/webhook/__tests__/webhook-event.entity.spec.ts` | 22 tests — entity shape, columns, constraints, defaults |
| 5 | `services/api-gateway/src/billing/webhook/__tests__/webhook-event-migration.spec.ts` | 12 tests — migration SQL structure, idempotency guards, indexes |
| 6 | `services/api-gateway/src/billing/webhook/__tests__/webhook.module.spec.ts` | 9 tests — module composition |

---

## 6. Raw-Body / main.ts Behavior

| Aspect | Detail |
|--------|--------|
| Change | `rawBody: true` added to `NestFactory.create()` options |
| Nature | Additive — single-line addition |
| Effect | `req.rawBody` (Buffer) available on all requests |
| Existing `@Body()` routes | Unchanged — JSON body parsing preserved |
| Existing routes | No behavioral change |
| `ValidationPipe`, filters, guards | Unaffected |

---

## 7. Webhook Endpoint / Controller Behavior

| Aspect | Detail |
|--------|--------|
| Path | `POST /api/billing/webhooks/stripe` |
| Auth | Public unauthenticated — no `SessionCookieGuard`, no `ApiKeyAuthGuard` |
| Protection | Stripe HMAC signature verification only |
| `InternalServiceAuthGuard` | Not intercepted — `/api/billing/*` is not an `/api/internal/*` route |
| Missing signature | HTTP 400 `{ error: 'MISSING_SIGNATURE' }` |
| Invalid verification | HTTP 400 |
| Verified duplicate | HTTP 200 `{ received: true }` |
| Verified ignored | HTTP 200 `{ received: true }` |
| Verified processed | HTTP 200 `{ received: true }` |
| Processing failure | HTTP 200 `{ received: true }` — error persisted in `webhook_events` |

---

## 8. WebhookEvent Entity Behavior

| Aspect | Detail |
|--------|--------|
| Decorator | `@Entity('webhook_events')` |
| Primary key | `id` — UUID |
| `providerEventId` | `varchar(255)` NOT NULL |
| `provider` | `varchar(50)` NOT NULL, default `'stripe'` |
| `eventType` | `varchar(100)` NOT NULL |
| `internalEventType` | `varchar(100)` nullable |
| `status` | `varchar(20)` NOT NULL, default `'received'` |
| `payloadHash` | `varchar(64)` nullable — SHA-256 of raw payload |
| `errorMessage` | `text` nullable |
| `errorCode` | `varchar(50)` nullable |
| `attempts` | `integer` NOT NULL, default `1` |
| `receivedAt` | `timestamptz` NOT NULL |
| `processedAt` | `timestamptz` nullable |
| `createdAt` / `updatedAt` | `timestamptz` NOT NULL |
| Unique constraint | `provider` + `providerEventId` (compound) |
| Indexes | `eventType`, `status`, `receivedAt DESC` |
| Exported constants | `WEBHOOK_EVENT_STATUSES`, `WEBHOOK_PROVIDERS` |

---

## 9. Migration Summary

| Aspect | Detail |
|--------|--------|
| File | `services/api-gateway/src/migrations/1772300000000-CreateWebhookEventsTable.ts` |
| SQL | `CREATE TABLE IF NOT EXISTS webhook_events` |
| Unique index | `uq_webhook_events_provider_event_id` on `(provider, provider_event_id)` |
| Index on event_type | `idx_webhook_events_event_type` |
| Index on status | `idx_webhook_events_status` |
| Index on received_at | `idx_webhook_events_received_at DESC` |
| CHECK constraint | `status IN ('received', 'verified', 'processing', 'processed', 'ignored', 'failed')` |
| Down migration | Full reverse: drop indexes, drop table |
| Idempotency | `IF NOT EXISTS` / `IF EXISTS` guards |
| Data mutation | None — schema only |
| Execution | **NOT executed** — file created only |

---

## 10. WebhookEventRepository Behavior

| Method | Behavior |
|--------|---------|
| `findByProviderEventId(provider, providerEventId)` | Query by compound `(provider, providerEventId)` for idempotency check |
| `createEvent(data)` | INSERT new `WebhookEvent` record with status `received` |
| `updateEventStatus(id, status, extras?)` | UPDATE status, optional `errorMessage`, `errorCode`, `processedAt` |
| `incrementAttempts(id)` | Increment `attempts` counter for duplicate receipt tracking |
| Terminal statuses | `processed`, `ignored`, `failed` — set `processedAt` on update |
| Process-once | Idempotency check before routing; duplicates increment `attempts` only |

---

## 11. WebhookService Behavior

| Aspect | Detail |
|--------|--------|
| Signature verification | Delegates to `StripePaymentProvider.verifyWebhookSignature()` — provider contract from 05A |
| Event parsing | Delegates to `StripePaymentProvider.parseWebhookEvent()` |
| Event type mapping | Delegates to `StripePaymentProvider.mapEventType()` |
| Payload hash | SHA-256 of raw body — stored in `payloadHash`, not the full payload |
| Record creation | `WebhookEventRepository.createEvent()` on first receipt |
| Duplicate check | `WebhookEventRepository.findByProviderEventId()` before processing |
| Duplicate handling | Increment `attempts`, return accepted — no reprocessing |
| Event routing | 6 allowed internal event types dispatched to handlers |
| Unknown events | Persisted with status `ignored` |
| Error handling | `WebhookVerificationError` / `WebhookProcessingError` — no secrets leaked |
| No Stripe SDK | No `stripe` import, no network calls |

---

## 12. Signature Verification Behavior

| Scenario | Provider Mode | Behavior |
|----------|---------------|---------|
| Missing `stripe-signature` header | Any | Controller returns HTTP 400 `MISSING_SIGNATURE` before provider call |
| Signature present, `disabled` mode | `disabled` | Provider returns `PROVIDER_DISABLED` → HTTP 400 |
| Signature present, `stub` mode | `stub` | Provider returns `{ valid: true }` → processing continues |
| Signature present, `test`/`live` (no SDK) | `test`/`live` | Provider returns `PROVIDER_NOT_CONFIGURED` → HTTP 400 |
| Future: SDK wired, invalid signature | `test`/`live` | Provider calls real HMAC → `SIGNATURE_INVALID` → HTTP 400 |

---

## 13. Idempotency / Duplicate Handling

| Aspect | Detail |
|--------|--------|
| Unique constraint | `(provider, provider_event_id)` — compound unique index |
| Duplicate event | Increments `attempts`, returns HTTP 200 accepted |
| Duplicate event | Not reprocessed — process-once semantics |
| `attempts` counter | Tracks Stripe retry frequency |
| Failed events | Marked `failed` — require manual review or background reprocessor |

---

## 14. Event Type / Status Model

**Statuses:**

| Status | Description |
|--------|-------------|
| `received` | Event received and recorded, not yet processed |
| `verified` | Signature verification passed |
| `processing` | Event being processed (transient) |
| `processed` | Event successfully processed |
| `ignored` | Event type not in allowlist or explicitly deferred (e.g., top-up) |
| `failed` | Processing failed with error |

**Event types in scope:**

| Stripe Event Type | Internal Type |
|-------------------|--------------|
| `checkout.session.completed` | `checkout_completed` |
| `customer.subscription.created` | `subscription_created` |
| `customer.subscription.updated` | `subscription_updated` |
| `customer.subscription.deleted` | `subscription_deleted` |
| `invoice.paid` | `invoice_paid` |
| `invoice.payment_failed` | `invoice_payment_failed` |

**Unknown event status:** `ignored`

**Error codes:**

| Code | Scenario |
|------|----------|
| `UNKNOWN_CUSTOMER` | No matching `stripeCustomerId` in users |
| `SUBSCRIPTION_NOT_FOUND` | No matching subscription on update/delete events |
| `PROCESSING_ERROR` | DB / persistence error |
| `UNKNOWN_EVENT_TYPE` | Event type not in allowlist (status = `ignored`) |

---

## 15. Subscription / User Update Behavior

| Event | Behavior |
|-------|---------|
| `checkout_completed` (subscription mode) | Creates `Subscription`, updates `users.plan_type` / `users.plan_status` |
| `checkout_completed` (payment/top-up mode) | Records event with status `ignored` — no credit mutation (deferred to 05E) |
| `subscription_created` | Creates subscription if missing, updates user plan |
| `subscription_updated` | Updates subscription status, period, cancellation, price and user plan |
| `subscription_deleted` | Sets subscription `cancelled`, user plan `free` / `cancelled` |
| `invoice_paid` (subscription) | Updates subscription period and active status for renewal |
| `invoice_paid` (non-subscription) | Records event with status `ignored` (deferred to 05E) |
| `invoice_payment_failed` | Sets subscription `past_due`, updates user `planStatus` |
| Missing user | Event `failed` — error code `UNKNOWN_CUSTOMER` |
| Missing subscription | Event `failed` — error code `SUBSCRIPTION_NOT_FOUND` |
| Stripe `canceled` | Normalized to local `cancelled` (spelling) |

---

## 16. Credit Top-Up / Credit Grant Deferral

| Decision | Detail |
|----------|--------|
| Top-up `checkout_completed` events | Recorded with status `ignored` — no credit mutation |
| Non-subscription `invoice_paid` events | Recorded with status `ignored` (deferred to 05E) |
| `credit_balances` writes | None in 05D |
| `credit_deduction_records` writes | None in 05D |
| `CreditGrant` entity / service | Does not exist — 05E owns credit grants and balance crediting |

---

## 17. Module Wiring

| Aspect | Detail |
|--------|--------|
| `WebhookModule` imports | `PaymentsModule`, `SubscriptionModule`, `TypeOrmModule.forFeature([WebhookEvent, User])` |
| `WebhookModule` providers | `WebhookController`, `WebhookService`, `WebhookEventRepository` |
| `WebhookModule` exports | `WebhookService` |
| `AppModule` | Imports `WebhookModule` |
| `BillingModule` / `PaymentsModule` / `CheckoutModule` / `SubscriptionModule` | No changes |

---

## 18. Tests and Validation

| Suite | Count | Result |
|-------|-------|--------|
| `webhook.controller.spec.ts` | 13 | PASS |
| `webhook.service.spec.ts` | 41 | PASS |
| `webhook-event.repository.spec.ts` | 13 | PASS |
| `webhook-event.entity.spec.ts` | 22 | PASS |
| `webhook-event-migration.spec.ts` | 12 | PASS |
| `webhook.module.spec.ts` | 9 | PASS |
| **Total webhook tests** | **108/108** | **PASS** |

**Regression results:**

| Command | Result |
|---------|--------|
| `npx jest --runInBand "webhook"` | PASS — 108/108, 6 suites |
| `npx jest --runInBand "stripe-payment.provider"` | PASS — 49/49 |
| `npx jest --runInBand "subscription"` | PASS — 53/53 |
| `npx jest --runInBand "checkout"` | PASS — 58/58 |
| `npx jest --runInBand "credit-balance"` | PASS — 74/74 |
| `npx tsc --noEmit` | PASS — exit code 0 |
| Linter (new/changed files) | PASS — 0 errors |
| **Total: 108 new + 234 regression** | **342/342** | **PASS** |

---

## 19. Safety Confirmations

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
| No credit balance mutation | **CONFIRMED** |
| No credit grant implementation | **CONFIRMED** |
| No AGENT-HARNESS write canary | **CONFIRMED** |
| No governance changes during Step 3 | **CONFIRMED** |

---

## 20. Parent / Child Status

| Task | Status |
|------|--------|
| BILLING-READY-05 | **ACTIVE** — Steps 1–2 COMPLETE. Step 3 IN PROGRESS via child slices |
| BILLING-READY-05A | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05B | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05C | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05D | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05E | Planned only — next recommended — not registered |
| BILLING-READY-05F | Planned only — not registered |
| BILLING-READY-05G | Planned only — not registered |
| BILLING-READY-04 | **COMPLETE and LOCKED** — 2026-07-13 |

---

## 21. Next Recommended Task

**BILLING-READY-05E — Credit Grant / Top-Up Accounting**

- Not registered.
- Owns: `credit_grants` table/entity, `CreditGrantService`, monthly allocation resets, top-up credit additions, balance crediting for top-up `checkout_completed` events deferred in 05D.
- Prerequisite: 05D COMPLETE and LOCKED (satisfied).
- Registration requires Keith explicit approval.

---

## 22. Files Changed During Consolidation

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05D-CHECKPOINT.md` | CREATED — this file |
| 2 | `TASKS.md` | UPDATED — 05D COMPLETE and LOCKED, split table updated, validation recorded |
| 3 | `TASKS_BACKLOG_FULL.md` | UPDATED — mirrors TASKS.md |
| 4 | `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATED — 05D COMPLETE and LOCKED, 05E next recommended not registered |

**No implementation, test, migration, or runtime files changed during consolidation.**
