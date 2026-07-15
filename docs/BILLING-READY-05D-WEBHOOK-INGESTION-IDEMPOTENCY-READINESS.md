# BILLING-READY-05D — Webhook Ingestion / Idempotency Readiness Review

**Task ID:** BILLING-READY-05D
**Step:** 2 — Webhook Ingestion / Idempotency Readiness / Exact Raw-Body and Provider Boundary
**Status:** COMPLETE
**Date:** 2026-07-15
**Nature:** Static readiness review — read-only — no implementation

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05D ACTIVE | **CONFIRMED** — Step 1 COMPLETE (Registration — 2026-07-15). Step 2 is this review. |
| BILLING-READY-05 ACTIVE (parent) | **CONFIRMED** — Steps 1–2 COMPLETE (2026-07-13). Keith approved split into 05A–05G. Step 3 IN PROGRESS via child slices. 05A COMPLETE and LOCKED. 05B COMPLETE and LOCKED. 05C COMPLETE and LOCKED. 05D is current ACTIVE child slice. |
| BILLING-READY-05A COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. Provider mode contract (`disabled`/`stub`/`test`/`live`), `ProviderResult<T>`, `ProviderErrorCode`, mode-aware `StripePaymentProvider` with `verifyWebhookSignature()`, `parseWebhookEvent()`, `mapEventType()`. 79 tests PASS. No Stripe SDK. No provider API calls. |
| BILLING-READY-05B COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. `Subscription` entity, `SubscriptionRepository` (`findActiveByUserId`, `findByStripeSubscriptionId`, `findByUserId`, `createSubscription`, `updateSubscription`), `SubscriptionModule`, 2 migrations (not executed). 53 tests PASS. No Stripe SDK. No provider API calls. |
| BILLING-READY-05C COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. `CheckoutController` (`POST subscription`, `POST topup`), `CheckoutService`, `CheckoutModule`, DTOs, price map config, URL validator, `AppModule` update. 58 tests PASS. No Stripe SDK. No provider API calls. |
| BILLING-READY-05E/05F/05G | **PLANNED ONLY** — not registered. Registration deferred until 05D is complete. |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-13. All child slices (04A/04B/04C/04D) COMPLETE and LOCKED. Regression matrix PASS 12/12. |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. All 7 child slices COMPLETE and LOCKED. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | **CONFIRMED** — 2026-07-12. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-09. |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05D is the current ACTIVE child slice; parent BILLING-READY-05 is ACTIVE with child-slice execution in progress. |

---

## 2. Source-of-Truth Summary

### 2.1 From BILLING-READY-05A (Provider Webhook Contracts)

| Contract | Signature | Behavior |
|----------|-----------|----------|
| `verifyWebhookSignature(rawBody: Buffer, signature: string)` | `ProviderResult<WebhookVerificationResult>` | `disabled` → `PROVIDER_DISABLED`; `stub` → `{ valid: true }`; `test`/`live` → `PROVIDER_NOT_CONFIGURED` (SDK deferred to 05D). |
| `parseWebhookEvent(rawBody: Buffer, signature: string)` | `ProviderResult<ParsedWebhookEvent>` | `disabled` → `PROVIDER_DISABLED`; `stub` → `{ eventId: 'stub_evt_placeholder', eventType: 'checkout_completed', data: {} }`; `test`/`live` → `PROVIDER_NOT_CONFIGURED`. |
| `mapEventType(providerEventType: string)` | `MappedEventType \| null` | Pure static map — works in all modes. Returns `{ internal, stripe }` or `null` for unknown types. |
| `InternalEventType` | Union type | `checkout_completed`, `subscription_created`, `subscription_updated`, `subscription_deleted`, `invoice_paid`, `invoice_payment_failed`. |
| `WebhookVerificationResult` | Interface | `{ valid: boolean }`. |
| `ParsedWebhookEvent` | Interface | `{ eventId: string, eventType: InternalEventType \| string, data: Record<string, unknown> }`. |
| `MappedEventType` | Interface | `{ internal: InternalEventType, stripe: string }`. |
| `ProviderErrorCode` relevant | `SIGNATURE_INVALID`, `EVENT_PARSE_ERROR` — defined, not yet returned by real implementation. |

**Static event type map (in `stripe-payment.provider.ts`):**

| Stripe Event Type | Internal Event Type |
|--------------------|---------------------|
| `checkout.session.completed` | `checkout_completed` |
| `customer.subscription.created` | `subscription_created` |
| `customer.subscription.updated` | `subscription_updated` |
| `customer.subscription.deleted` | `subscription_deleted` |
| `invoice.paid` | `invoice_paid` |
| `invoice.payment_failed` | `invoice_payment_failed` |

### 2.2 From BILLING-READY-05B (Subscription / Customer Persistence)

| Asset | Details |
|-------|---------|
| `Subscription` entity | `@Entity('subscriptions')` — `id` (UUID PK), `userId` (FK), `stripeSubscriptionId`, `stripePriceId`, `planType`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`, `cancelAtPeriodEnd`, `cancelledAt`, `createdAt`, `updatedAt`. |
| `SUBSCRIPTION_STATUSES` | `active`, `trialing`, `past_due`, `cancelled`, `expired`, `unpaid`. |
| `SUBSCRIPTION_PLAN_TYPES` | `free`, `starter`, `pro`, `team`. |
| `SubscriptionRepository` | `findActiveByUserId()`, `findByStripeSubscriptionId()`, `findByUserId()`, `createSubscription()`, `updateSubscription()`. |
| `SubscriptionModule` | `TypeOrmModule.forFeature([Subscription])`, provides/exports `SubscriptionRepository`. |
| `users.stripe_customer_id` | Nullable `varchar(255)` with unique partial index `idx_users_stripe_customer_id` (migration created, not executed). |
| One-active-subscription invariant | Partial unique index `idx_subscriptions_one_active_per_user` (migration created, not executed). |

### 2.3 From BILLING-READY-05C (Checkout Metadata / Session)

| Asset | Details |
|-------|---------|
| `CheckoutController` | `POST /api/billing/checkout/subscription`, `POST /api/billing/checkout/topup`. `SessionCookieGuard`. |
| `CheckoutService` | Gate check → customer resolution → plan/price mapping → provider delegation → result mapping. |
| `CheckoutSessionResponseDto` | `checkoutSessionId`, `checkoutUrl`, `providerMode`, `checkoutType` (`subscription` \| `topup`), optional `planType`, `topUpPackage`, `customerId`. |
| `CHECKOUT_PLAN_PRICE_MAP` | `starter`, `pro`, `team` → placeholder price IDs. |
| `TOP_UP_PACK_MAP` | `topup_1000`, `topup_5000`, `topup_20000` → placeholder price IDs. |
| Checkout metadata available | `userId` (from session), `planId` / `topUpPackId` (from request), `checkoutType` (`subscription` / `topup`). Currently passed to provider via `CreateCheckoutSessionParams` but **not** embedded as Stripe checkout metadata. |

### 2.4 From BILLING-READY-05 Parent (Webhook / Event Decisions)

| Decision | Outcome |
|----------|---------|
| Webhook events to support | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. |
| Idempotency model | Stripe event ID (`evt_xxx`) stored in `webhook_events` table. Duplicate → skip processing, return 200. |
| Signature verification | REQUIRED — `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. |
| Raw body parsing | REQUIRED — NestJS must provide raw body for webhook endpoint (not JSON-parsed). |
| Error/retry behavior | Return HTTP 200 on success. Return 4xx/5xx to trigger Stripe retry. |
| Audit logging | All webhook events logged to `webhook_events` table. |

### 2.5 Provider Call / SDK / Env Confirmation

- **No provider API calls approved** by 05D registration.
- **No Stripe SDK/package install approved** by 05D registration.
- **No env/secrets/package changes approved** by 05D registration.
- **No raw-body source changes, Stripe CLI/webhook testing, or runtime validation approved** by 05D registration.
- All of these require explicit Keith approval before implementation.

---

## 3. Existing Webhook / Payment Source-Path Findings

### 3.1 PaymentProvider Webhook-Related Methods

| Method | File | Lines | Behavior |
|--------|------|-------|----------|
| `verifyWebhookSignature()` | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | 209–222 | `disabled` → `PROVIDER_DISABLED`; `stub` → `{ valid: true }`; `test`/`live` → `PROVIDER_NOT_CONFIGURED` ("deferred to 05D"). |
| `parseWebhookEvent()` | Same file | 228–245 | `disabled` → `PROVIDER_DISABLED`; `stub` → stub parsed event; `test`/`live` → `PROVIDER_NOT_CONFIGURED` ("deferred to 05D"). |
| `mapEventType()` | Same file | 251–257 | Pure static map from `STRIPE_EVENT_TYPE_MAP`. Works in all modes. |

### 3.2 StripePaymentProvider Webhook Stub Behavior

- In `stub` mode, `verifyWebhookSignature()` always returns `{ success: true, data: { valid: true } }` — no actual HMAC verification.
- In `stub` mode, `parseWebhookEvent()` returns `{ success: true, data: { eventId: 'stub_evt_placeholder', eventType: 'checkout_completed', data: {} } }` — deterministic placeholder.
- Both methods accept `rawBody: Buffer` and `signature: string` as parameters — the interface is ready for real implementation.

### 3.3 PaymentsModule

| File | `services/api-gateway/src/payments/payments.module.ts` |
|------|------------------------------------------------------|
| Providers | `StripePaymentProvider` |
| Exports | `StripePaymentProvider` |
| No entity imports | Module is provider-only |

### 3.4 CheckoutController / CheckoutService Metadata Available from 05C

| Field | Source | Available for Webhook? |
|-------|--------|-----------------------|
| `userId` | `request.user.userId` (session) | Available if embedded as Stripe metadata on checkout session. Currently passed to `createCheckoutSession()` but NOT embedded as Stripe `metadata`. **Metadata embedding is a 05C gap — see Section 15.** |
| `planId` / `topUpPackId` | Request body → `createCheckoutSession()` | Same — must be embedded as Stripe metadata for webhook to know what was purchased. |
| `checkoutType` | `'subscription'` / `'topup'` | Same — must be embedded for webhook to distinguish subscription vs top-up. |
| `userEmail` | `request.user.email` (session) | Available in Stripe customer object if customer was created. |

### 3.5 SubscriptionRepository and Subscription Entity

| Item | Location |
|------|----------|
| Entity | `services/api-gateway/src/entities/subscription.entity.ts` (05B LOCKED) |
| Repository | `services/api-gateway/src/billing/subscription/subscription.repository.ts` (05B LOCKED) |
| Module | `services/api-gateway/src/billing/subscription/subscription.module.ts` (05B LOCKED) |
| Key methods | `findByStripeSubscriptionId()`, `findActiveByUserId()`, `createSubscription()`, `updateSubscription()` |

### 3.6 User Entity and stripe_customer_id

| Item | Location |
|------|----------|
| Entity | `services/api-gateway/src/entities/user.entity.ts` |
| `stripeCustomerId` | `varchar(255)`, nullable, column `stripe_customer_id` |
| `planType` | `varchar(50)`, default `'free'` |
| `planStatus` | `varchar(20)`, default `'active'` |

### 3.7 Current App Bootstrap / Body Parser Behavior in main.ts

| Aspect | Finding |
|--------|---------|
| File | `services/api-gateway/src/main.ts` |
| App creation | `NestFactory.create(AppModule, { logger: [...] })` — default NestJS/Express setup. No `rawBody: true` option. |
| Body parsing | Default Express JSON parser applied globally by NestJS. No explicit `express.raw()` or `express.json()` call. |
| Middleware chain | `cookieSession()` → `cookieParser()` → CSRF cookie middleware. No raw body preservation. |
| Global prefix | `app.setGlobalPrefix('api')` — all routes under `/api/*`. |
| Global pipes | `ValidationPipe({ whitelist: true, transform: true })`. |
| Global filters | `HttpExceptionFilter`. |
| Global guards | `InternalServiceAuthGuard` (APP_GUARD), `IdempotentReplayExceptionFilter` (APP_FILTER). |
| Raw body support | **NOT PRESENT** — default Express JSON middleware consumes the body. Raw body is not preserved. |

### 3.8 Current Controller/Module Patterns

| Pattern | Convention |
|---------|-----------|
| Controller path | `@Controller('billing/checkout')` → `/api/billing/checkout/*` (with global prefix) |
| Auth for user-facing | `@UseGuards(SessionCookieGuard)` |
| Auth for internal | `InternalServiceAuthGuard` (global) |
| Public unauthenticated | No existing pattern — webhook would be the first. Must exclude from `InternalServiceAuthGuard` global guard. |
| Module imports | Feature modules import their dependencies explicitly. `AppModule` imports top-level feature modules. |

### 3.9 Existing Migration Conventions

| Convention | Pattern |
|------------|---------|
| Filename | `{timestamp}-{PascalCaseName}.ts` — e.g., `1772200000000-AlignSubscriptionsTableWithTypeORM.ts` |
| Class name | `{PascalCaseName}{Timestamp}` — e.g., `AlignSubscriptionsTableWithTypeORM1772200000000` |
| SQL style | Raw SQL strings via `queryRunner.query()` |
| Idempotency | `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` |
| Down migration | Full reverse: drop indexes, constraints, columns |
| No data mutation | Schema-only migrations |

### 3.10 Existing Webhook/Event/Idempotency Patterns

| Pattern | Finding |
|---------|---------|
| Webhook controller | **DOES NOT EXIST** — no webhook endpoint anywhere in the codebase. |
| `webhook_events` table | **DOES NOT EXIST** — no entity, no migration, no table. |
| Event idempotency for webhooks | **DOES NOT EXIST** — the existing `IdempotencyGuard` is AI-execution-specific (`usage_records.request_id`). |
| Credit deduction idempotency | EXISTS — `credit_deduction_records.source_event_id` unique constraint with 23505 conflict handling (`PersistentCreditDeductionGateway`). This is a reference pattern for webhook event idempotency. |
| `credit_grants` table | **DOES NOT EXIST** — deferred to 05E. |

---

## 4. Webhook Endpoint / Controller / Service / Module Boundary Decision

### 4.1 Endpoint Path

**Decision: `POST /api/billing/webhooks/stripe`**

| Aspect | Decision |
|--------|----------|
| Full path | `POST /api/billing/webhooks/stripe` (global prefix `api` applied by `main.ts`) |
| Controller decorator | `@Controller('billing/webhooks')` |
| Method decorator | `@Post('stripe')` |
| Provider-specific path | Path includes `/stripe` to allow future alternative provider webhook endpoints (e.g., `/billing/webhooks/paypal`). |

### 4.2 Controller

| Aspect | Decision |
|--------|----------|
| File | `services/api-gateway/src/billing/webhook/webhook.controller.ts` |
| Class | `WebhookController` |
| Auth | **PUBLIC UNAUTHENTICATED** — no `SessionCookieGuard`, no `ApiKeyAuthGuard`. Protected by Stripe HMAC signature verification only. |
| `InternalServiceAuthGuard` bypass | The global `InternalServiceAuthGuard` only activates on `/api/internal/*` routes (checks path prefix). Since the webhook endpoint is at `/api/billing/webhooks/stripe`, it is NOT intercepted by the internal guard. **No bypass needed.** |
| Raw body access | Controller receives raw body via custom parameter decorator or NestJS `rawBody` option (see Section 5). |
| `stripe-signature` header | Read from request headers. |
| Response | Always returns HTTP 200 `{ received: true }` on successful receipt (even if event is a duplicate or ignored type). Returns HTTP 400 on invalid/missing signature. Returns HTTP 500 only on unexpected processing failures. |

### 4.3 Service

| Aspect | Decision |
|--------|----------|
| File | `services/api-gateway/src/billing/webhook/webhook.service.ts` |
| Class | `WebhookService` |
| Responsibility | Signature verification → event parsing → idempotency check → event routing → subscription/status updates → event status persistence. |
| Dependencies | `StripePaymentProvider` (for `verifyWebhookSignature`, `parseWebhookEvent`, `mapEventType`), `WebhookEventRepository` (for idempotency/persistence), `SubscriptionRepository` (for subscription updates), `UserRepository` (for customer mapping), `Logger`. |

### 4.4 Module

| Aspect | Decision |
|--------|----------|
| File | `services/api-gateway/src/billing/webhook/webhook.module.ts` |
| Class | `WebhookModule` |
| Imports | `PaymentsModule` (for `StripePaymentProvider`), `SubscriptionModule` (for `SubscriptionRepository`), `TypeOrmModule.forFeature([WebhookEvent, User])`. |
| Providers | `WebhookController`, `WebhookService`, `WebhookEventRepository`. |
| Exports | `WebhookService` (for potential future internal use). |
| `AppModule` | Must import `WebhookModule`. |

### 4.5 Auth Boundary

| Aspect | Decision |
|--------|----------|
| Browser/session/API-key auth | **NOT USED** — webhook endpoint is provider-to-server. No user session, no API key. |
| Signature verification | **SOLE authentication mechanism** — Stripe HMAC signature verification via `verifyWebhookSignature()`. |
| No CSRF | Webhook endpoint has no CSRF cookie requirement. The CSRF middleware in `main.ts` sets a cookie on response but does not block requests lacking the cookie. |
| No rate limiting | Stripe controls delivery rate. Standard rate limiting should still apply (existing `ThrottlerModule` with 10 req/60s may be too restrictive for webhook bursts). **The webhook endpoint should be excluded from the global throttler or have a webhook-specific higher limit.** |

### 4.6 Response Semantics to Provider

| Scenario | HTTP Status | Body |
|----------|-------------|------|
| Signature valid, event processed | 200 | `{ received: true }` |
| Signature valid, duplicate event (idempotent skip) | 200 | `{ received: true }` |
| Signature valid, unknown/ignored event type | 200 | `{ received: true }` |
| Missing `stripe-signature` header | 400 | `{ error: 'MISSING_SIGNATURE' }` |
| Invalid signature | 400 | `{ error: 'INVALID_SIGNATURE' }` |
| Internal processing error | 200 | `{ received: true }` (prefer 200 to prevent Stripe retries for transient failures; log error internally) |

**Rationale for 200 on processing errors:** Returning 5xx causes Stripe to retry the event, which is desirable for transient DB failures. However, repeated retries of permanently failing events can mask issues. **Decision: return 200 on all verified events; persist error status in `webhook_events` for monitoring.** If a processing failure is transient (DB timeout), the event status can be reprocessed manually or via a background job. This prevents Stripe retry storms.

**Alternative (deferred):** Return 500 on transient processing errors to leverage Stripe's automatic retry. This requires distinguishing transient from permanent failures. Deferred to 05G or a follow-up task.

### 4.7 Module Wiring

- `CheckoutModule` does NOT need modification for 05D — it creates checkout sessions but does not handle webhooks.
- `BillingModule` does NOT need modification — it handles `BillingSnapshot` only.
- `WebhookModule` is a new standalone module imported into `AppModule`.

---

## 5. Raw-Body Parser / Bootstrap Boundary Decision

### 5.1 Whether Raw Body Is Needed in Step 3

**YES — raw body is required for signature verification.** Stripe HMAC signature verification requires the exact raw request body bytes (not JSON-parsed). The `verifyWebhookSignature(rawBody: Buffer, signature: string)` contract from 05A explicitly takes a `Buffer`.

### 5.2 Exact Framework / Bootstrap File Boundary

**Decision: Use NestJS `rawBody: true` option on `NestFactory.create()` in `main.ts`.** This is the minimal, framework-supported approach:

```typescript
const app = await NestFactory.create(AppModule, {
  logger: ['log', 'error', 'warn', 'debug'],
  rawBody: true,
});
```

With `rawBody: true`, NestJS preserves the raw body as `req.rawBody` (a `Buffer`) on every request. The webhook controller accesses it via `@Req() req` and reads `req.rawBody`.

### 5.3 Whether Raw Body Can Be Isolated to Webhook Route Only

**Partial isolation possible but not necessary.** The `rawBody: true` option stores the raw body on ALL requests, not just the webhook route. However:

- The raw body is stored **in addition to** the parsed JSON body — existing routes continue to work with `@Body()` decorators unchanged.
- Memory overhead is minimal (raw body is the same bytes, stored as a Buffer reference alongside the parsed object).
- No existing route behavior changes.
- The alternative (route-specific `express.raw()` middleware) would require complex NestJS middleware routing that bypasses the global JSON parser for only one route — significantly more complex and fragile.

**Decision: `rawBody: true` on `NestFactory.create()` is safe for all routes. Only the webhook controller reads `req.rawBody`. No other controller or service is affected.**

### 5.4 Whether Body Parser / Global JSON Behavior Is at Risk

**NO.** The `rawBody: true` option does NOT change the JSON body parser. The default Express JSON middleware still parses `application/json` bodies for all routes. `req.body` continues to be the parsed JSON object. `req.rawBody` is an additional property containing the raw bytes.

**Verified invariants:**
- `@Body()` decorators continue to work on all existing routes.
- `ValidationPipe` continues to work (it operates on the parsed `@Body()` result).
- Cookie session, cookie parser, CSRF middleware are unaffected.
- `HttpExceptionFilter`, `IdempotentReplayExceptionFilter`, `InternalServiceAuthGuard` are unaffected.

### 5.5 Whether Raw Body Changes Are Safe in One Step 3 or Require Split

**Safe in one Step 3.** The `rawBody: true` change is a single-line addition to `NestFactory.create()` options. It has no side effects on existing routes. It can be tested in isolation (verify `req.rawBody` exists on webhook route, verify existing routes still work with `@Body()`).

### 5.6 Whether Step 3 Can Avoid Raw-Body Changes by Using Stub-Only Parsed Payload Tests

**YES — Step 3 CAN proceed without raw-body changes by testing with stub provider only.** In `stub` mode, `verifyWebhookSignature()` ignores the raw body and returns `{ valid: true }`. `parseWebhookEvent()` ignores the raw body and returns a stub event. Tests can pass a dummy `Buffer.from('{}')` as the raw body argument.

**However, adding `rawBody: true` to `main.ts` is low-risk and establishes the correct infrastructure for future test/live mode. Decision: include `rawBody: true` in Step 3 if implementation is approved. If Keith prefers to defer raw-body changes, Step 3 can still function with stub-only tests.**

---

## 6. Signature Verification Strategy Decision

### 6.1 Whether 05D Implements Stub/Test-Mode-Ready Signature Contract Only

**YES — 05D implements a test-mode-ready signature verification flow that works end-to-end in `disabled` and `stub` modes.** Real Stripe HMAC verification requires the `stripe` SDK (`stripe.webhooks.constructEvent()`) and `STRIPE_WEBHOOK_SECRET`, which are not yet installed/configured.

### 6.2 Whether Real Stripe Signature Verification Requires SDK/Env and Must Be Deferred

**YES — real verification requires:**
1. `stripe` npm package installed (not yet approved).
2. `STRIPE_WEBHOOK_SECRET` env key configured (not yet approved).
3. `StripePaymentProvider.verifyWebhookSignature()` and `parseWebhookEvent()` `test`/`live` branches implemented with real SDK calls.

**Real signature verification is deferred until the Stripe SDK is installed and Keith provides the webhook signing secret.**

### 6.3 Whether Webhook Signing Secret Env Key Is Needed Now or Deferred

**DEFERRED.** `STRIPE_WEBHOOK_SECRET` is not needed in Step 3. The webhook controller calls `StripePaymentProvider.verifyWebhookSignature()`, which in `stub` mode returns `{ valid: true }` without reading any env key. In `disabled` mode, it returns `PROVIDER_DISABLED` and the webhook is rejected.

### 6.4 How Invalid/Missing Signatures Behave

| Scenario | Provider Mode | Behavior |
|----------|---------------|----------|
| Missing `stripe-signature` header | Any | Controller returns HTTP 400 `{ error: 'MISSING_SIGNATURE' }` before calling provider. |
| Signature present, `disabled` mode | `disabled` | Provider returns `PROVIDER_DISABLED`. Controller returns HTTP 400 `{ error: 'PROVIDER_DISABLED' }`. |
| Signature present, `stub` mode | `stub` | Provider returns `{ valid: true }`. Processing continues. |
| Signature present, `test`/`live` mode (no SDK) | `test`/`live` | Provider returns `PROVIDER_NOT_CONFIGURED`. Controller returns HTTP 400 `{ error: 'PROVIDER_NOT_CONFIGURED' }`. |
| Signature present, `test`/`live` mode (SDK wired, future) | `test`/`live` | Provider calls `stripe.webhooks.constructEvent()`. Invalid → `SIGNATURE_INVALID`. Valid → `{ valid: true }`. |

### 6.5 How to Avoid Secret Leakage

- `STRIPE_WEBHOOK_SECRET` is never logged, never in error messages, never in responses.
- The provider reads it internally from `ConfigService` (future).
- The webhook controller never touches the secret directly.
- Error responses use generic error codes (`INVALID_SIGNATURE`, `PROVIDER_DISABLED`) without revealing secret/key details.

### 6.6 Whether Keith Test Keys / Webhook Secret Are Required Before Step 3

**NO.** Step 3 can proceed entirely in `stub` mode without any Stripe keys or webhook secret. Real signature verification requires Keith to provide `STRIPE_WEBHOOK_SECRET` in a future approved step.

---

## 7. Stripe SDK / Package / Env Decision

### 7.1 Whether `stripe` npm Package Is Needed in 05D

**NO — deferred.** The webhook controller and service call `StripePaymentProvider` interface methods. The `StripePaymentProvider` `stub` mode handles everything without the SDK. The `stripe` package is needed only when implementing real HMAC verification and event construction in the `test`/`live` branches.

### 7.2 Whether `STRIPE_WEBHOOK_SECRET` Is Needed in 05D

**NO — deferred.** Stub mode does not read the webhook secret. The env key is needed only for real signature verification.

### 7.3 Whether Step 3 Can Proceed Without Package/Env Changes

**YES.** Step 3 can proceed without any `package.json`, `.env.example`, or env key changes. All webhook infrastructure is testable with mocked `StripePaymentProvider` and `stub` mode behavior.

### 7.4 Whether Keith Must Supply Stripe Test Keys / Webhook Secret Before Step 3

**NO.** Step 3 is self-contained with stub/mock tests.

### 7.5 Exact Approval Gates for SDK / Package / Env / Test-Mode Webhook Events

| Gate | Status |
|------|--------|
| `stripe` npm package install | **NOT APPROVED** — requires Keith explicit approval. |
| `STRIPE_WEBHOOK_SECRET` env key | **NOT APPROVED** — requires Keith explicit approval. |
| `STRIPE_SECRET_KEY` env key | Already exists in concept from 05A but NOT configured — requires Keith approval for real keys. |
| Test-mode Stripe CLI webhook delivery | **NOT APPROVED** — requires Keith approval + running infrastructure. |
| Live webhook delivery | **NOT APPROVED** — requires production deployment + Keith approval. |

---

## 8. `webhook_events` Schema / Migration Decision

### 8.1 Whether `webhook_events` Table Already Exists

**NO.** No `webhook_events` table, entity, or migration exists anywhere in the codebase.

### 8.2 Whether a New TypeORM Entity Is Needed

**YES.** A new `WebhookEvent` entity at `services/api-gateway/src/entities/webhook-event.entity.ts`.

### 8.3 Whether a Migration Is Needed

**YES.** A new migration to create the `webhook_events` table. Migration file created but NOT executed (consistent with 05B pattern).

### 8.4 Exact Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Internal PK |
| `provider_event_id` | `varchar(255)` | NOT NULL | — | Stripe event ID (`evt_xxx`). UNIQUE constraint for idempotency. |
| `provider` | `varchar(50)` | NOT NULL | `'stripe'` | Payment provider identifier. Future-proofs for multi-provider. |
| `event_type` | `varchar(100)` | NOT NULL | — | Stripe event type string (e.g., `checkout.session.completed`). |
| `internal_event_type` | `varchar(100)` | NULL | — | Mapped internal event type (e.g., `checkout_completed`). NULL if unmapped/unknown. |
| `status` | `varchar(20)` | NOT NULL | `'received'` | Event processing status (see Section 10). |
| `payload_hash` | `varchar(64)` | NULL | — | SHA-256 hash of the raw payload. For audit/debugging — NOT the full payload. |
| `error_message` | `text` | NULL | — | Error details if processing failed. No secrets. |
| `error_code` | `varchar(50)` | NULL | — | Machine-readable error code if processing failed. |
| `attempts` | `integer` | NOT NULL | `1` | Number of times this event was received (incremented on duplicate receipt). |
| `received_at` | `timestamptz` | NOT NULL | `NOW()` | When the event was first received. |
| `processed_at` | `timestamptz` | NULL | — | When processing completed (success, ignored, or failed). |
| `created_at` | `timestamptz` | NOT NULL | `NOW()` | Record creation time. |
| `updated_at` | `timestamptz` | NOT NULL | `NOW()` | Record update time. |

### 8.5 Constraints and Indexes

| Constraint/Index | Definition |
|------------------|-----------|
| Primary key | `id` (UUID) |
| Unique constraint | `idx_webhook_events_provider_event_id` — UNIQUE on `(provider, provider_event_id)`. Compound to support multi-provider future. |
| Index | `idx_webhook_events_event_type` on `event_type` |
| Index | `idx_webhook_events_status` on `status` |
| Index | `idx_webhook_events_received_at` on `received_at DESC` |
| CHECK constraint | `status IN ('received', 'verified', 'processing', 'processed', 'ignored', 'failed')` |

### 8.6 No Full Payload Storage

**Decision: Do NOT store the full webhook payload.** Stripe payloads can be large (subscription objects include plan details, customer info, etc.) and may contain PII. Store only the `payload_hash` (SHA-256) for audit and deduplication verification. The full payload is processed in memory and not persisted. This avoids PII storage concerns and reduces DB bloat.

### 8.7 Down Migration

Full reverse: drop table `webhook_events` (with IF EXISTS). Drop indexes first, then table.

### 8.8 Whether Migration Approval Is Needed Before Step 3

**YES — migration creates a new table.** Keith must approve the migration before Step 3 implementation. The migration file will be created but NOT executed during Step 3 (consistent with 05B convention).

---

## 9. Event Idempotency and Duplicate Handling Model

### 9.1 Unique Provider Event ID Behavior

- Every Stripe webhook event has a unique `evt_xxx` ID.
- `webhook_events.provider_event_id` has a UNIQUE constraint (compound with `provider`).
- On receiving an event, the service first queries `webhook_events` by `(provider, provider_event_id)`.

### 9.2 Duplicate Event Response Behavior

| Scenario | Behavior |
|----------|----------|
| Event ID not found in `webhook_events` | Insert new record with status `received`. Proceed with processing. |
| Event ID already exists, status = `processed` | Skip processing. Increment `attempts`. Return HTTP 200 `{ received: true }`. |
| Event ID already exists, status = `ignored` | Skip processing. Increment `attempts`. Return HTTP 200 `{ received: true }`. |
| Event ID already exists, status = `failed` | **Do NOT reprocess automatically.** Increment `attempts`. Return HTTP 200. Failed events require manual review or a background reprocessor. |
| Event ID already exists, status = `received` or `processing` | Possible concurrent delivery. Return HTTP 200 to prevent Stripe retry. The first processor will complete. |

### 9.3 Transactional Boundary

- The `webhook_events` INSERT and the subsequent subscription/status updates should be within a transaction where practical.
- If subscription update fails after `webhook_events` INSERT, the event status is updated to `failed` with the error message.
- The `SELECT ... FOR UPDATE` pattern from 04 credit deductions is the reference for concurrency safety.
- However, 05D Step 3 may use simpler INSERT + UPDATE without explicit transaction wrapping, given that webhook events are idempotent by nature (Stripe retries on failure).

### 9.4 Process-Once Semantics

- Each unique `(provider, provider_event_id)` is processed at most once.
- Duplicate deliveries are acknowledged (HTTP 200) but not reprocessed.
- The `attempts` counter provides visibility into Stripe retry frequency.

### 9.5 Failed/Retry Behavior

- If processing fails (e.g., DB error during subscription update), the event is marked `failed` with error details.
- The webhook endpoint returns HTTP 200 (to prevent Stripe retry storms).
- Failed events can be reprocessed via a future admin/background job (not in 05D scope).

### 9.6 Ignored Event Behavior

- Events with unknown/unmapped event types (where `mapEventType()` returns `null`) are persisted with status `ignored`.
- Events for unknown customers (no matching `stripe_customer_id` in users) are persisted with status `failed` and error code `UNKNOWN_CUSTOMER`.
- Ignored events return HTTP 200.

### 9.7 Ordering Limitations

- Stripe does NOT guarantee event ordering.
- 05D does NOT enforce strict ordering.
- State is derived from the latest subscription status field in the event payload, not from event sequence.
- If a `subscription_updated` event arrives before `subscription_created`, the service should handle gracefully (create subscription on first seen event, update on subsequent).

### 9.8 Relationship to Future 05E Credit Grants

- 05D records `checkout_completed` events that are top-up type.
- 05D does NOT grant credits — status is `processed` (subscription updates applied) or `ignored` (top-up events where credit grant is deferred).
- 05E will query `webhook_events` for unprocessed top-up completion events (or add its own credit grant idempotency via `credit_grants.source_event_id`).

---

## 10. Event Status / Error Model

### 10.1 Statuses

| Status | Description | Persisted |
|--------|-------------|-----------|
| `received` | Event received and recorded but not yet processed | YES — initial insert |
| `verified` | Signature verification passed | YES — updated after verification |
| `processing` | Event is being processed (transient state) | YES — updated before event routing |
| `processed` | Event successfully processed (subscription updated, etc.) | YES — terminal success state |
| `ignored` | Event type is not in allowlist or explicitly deferred (e.g., top-up credit grant) | YES — terminal state |
| `failed` | Processing failed with an error | YES — terminal failure state |

### 10.2 Status Transitions

```
received → verified → processing → processed
                                  → ignored
                                  → failed
received → failed (signature verification failure — recorded but not verified)
```

### 10.3 What Errors Are Stored

| Error | Stored In |
|-------|-----------|
| Signature verification failure | `error_message`, `error_code = 'SIGNATURE_INVALID'` |
| Event parse failure | `error_message`, `error_code = 'EVENT_PARSE_ERROR'` |
| Unknown customer | `error_message`, `error_code = 'UNKNOWN_CUSTOMER'` |
| Subscription not found | `error_message`, `error_code = 'SUBSCRIPTION_NOT_FOUND'` |
| DB/persistence error | `error_message`, `error_code = 'PROCESSING_ERROR'` |
| Unknown event type | `error_code = 'UNKNOWN_EVENT_TYPE'` (status = `ignored`) |

### 10.4 What Is Returned to Provider on Failure

- **Always HTTP 200** for verified events (even if processing fails internally).
- **HTTP 400** only for signature/header failures (before the event is considered "received").
- No error details leaked to the provider response.

### 10.5 Whether Processing Failures Should Return 2xx or 5xx

**Decision: Return 200 for all verified events.** Rationale:
- Returning 5xx causes Stripe to retry, which can create retry storms for permanently failing events.
- Failed events are tracked in `webhook_events` with status `failed`.
- Manual or background reprocessing handles failures.
- This is a conservative approach suitable for initial implementation.
- If automatic retries are desired later, switch to 5xx for transient failures in 05G or a follow-up task.

### 10.6 Retry Implications

- Stripe retries webhooks on 4xx/5xx responses for up to ~3 days with exponential backoff.
- By returning 200 on all verified events, Stripe will not retry.
- If the initial processing fails, the event is marked `failed` and can be replayed manually.
- This prevents duplicate side effects from automatic retries of events that have partially processed (e.g., subscription created but user plan not updated).

---

## 11. Event Type Allowlist Decision

### 11.1 Events In 05D Scope

| Stripe Event Type | Internal Type | 05D Action |
|--------------------|---------------|------------|
| `checkout.session.completed` | `checkout_completed` | Record event. For subscription checkouts: create/update `Subscription` record, update `users.plan_type`. For top-up checkouts: record event with status `ignored` (credit grant deferred to 05E). |
| `customer.subscription.created` | `subscription_created` | Create `Subscription` record if not exists (may already exist from `checkout_completed`). Update status/period fields. |
| `customer.subscription.updated` | `subscription_updated` | Update `Subscription` record: status, period, cancellation fields. Update `users.plan_type` / `users.plan_status` if needed. |
| `customer.subscription.deleted` | `subscription_deleted` | Update `Subscription` record: set status to `cancelled` or `expired`. Update `users.plan_type` to `'free'`, `users.plan_status` to `'cancelled'`. |
| `invoice.paid` | `invoice_paid` | Record event. For subscription invoices: update `Subscription.currentPeriodStart/End` (renewal). For top-up invoices: record with status `ignored` (credit grant deferred to 05E). |
| `invoice.payment_failed` | `invoice_payment_failed` | Update `Subscription.status` to `'past_due'`. Update `users.plan_status` to `'past_due'`. |

### 11.2 Events Deferred / Out of Scope

| Event Category | Status |
|----------------|--------|
| Credit top-up grant completion | **Deferred to 05E** — 05D records `checkout_completed` for top-ups but does NOT grant credits or mutate `credit_balances`. |
| Refunds (`charge.refunded`) | **Out of scope** — complex reversal logic. |
| Chargebacks (`charge.dispute.*`) | **Out of scope** — complex dispute handling. |
| Deep proration (`customer.subscription.updated` with proration) | **Out of scope** — plan upgrade/downgrade proration deferred. |
| Payment intent events (`payment_intent.*`) | **Out of scope** — not needed for checkout/subscription flow. |
| Customer events (`customer.created`, `customer.updated`) | **Out of scope** — customer creation handled in checkout flow (05C). |

---

## 12. Subscription Update Model

### 12.1 Which Events Update SubscriptionRepository

| Internal Event Type | SubscriptionRepository Method | Updates |
|--------------------|-----------------------------|---------|
| `checkout_completed` (subscription type) | `createSubscription()` | Create new subscription record with `stripeSubscriptionId`, `stripePriceId`, `planType`, `status = 'active'`, `currentPeriodStart`, `currentPeriodEnd`. |
| `subscription_created` | `findByStripeSubscriptionId()` → `createSubscription()` or no-op if exists | Create if not exists (may race with `checkout_completed`). |
| `subscription_updated` | `findByStripeSubscriptionId()` → `updateSubscription()` | Update `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`, `cancelAtPeriodEnd`, `cancelledAt`, `stripePriceId`. |
| `subscription_deleted` | `findByStripeSubscriptionId()` → `updateSubscription()` | Set `status = 'cancelled'`, `cancelledAt = now`. |
| `invoice_paid` | `findByStripeSubscriptionId()` → `updateSubscription()` | Update `currentPeriodStart`, `currentPeriodEnd` (renewal). |
| `invoice_payment_failed` | `findByStripeSubscriptionId()` → `updateSubscription()` | Set `status = 'past_due'`. |

### 12.2 How Provider Subscription ID Maps to Subscription

- Stripe webhook event data includes `subscription` field (the Stripe subscription ID, `sub_xxx`).
- `SubscriptionRepository.findByStripeSubscriptionId(sub_xxx)` locates the local record.
- If not found on `subscription_created` or `checkout_completed`, a new record is created.
- If not found on `subscription_updated` / `subscription_deleted` / `invoice_*`, the event is recorded with status `failed` and error code `SUBSCRIPTION_NOT_FOUND`.

### 12.3 How Customer ID Maps to User

- Stripe webhook event data includes `customer` field (the Stripe customer ID, `cus_xxx`).
- `userRepository.findOne({ where: { stripeCustomerId: cus_xxx } })` locates the platform user.
- If not found, the event is recorded with status `failed` and error code `UNKNOWN_CUSTOMER`.
- The `userId` from the matched user is used when creating a `Subscription` record.

### 12.4 Status Mapping

| Stripe Status | Subscription Entity Status |
|---------------|---------------------------|
| `active` | `active` |
| `trialing` | `trialing` |
| `past_due` | `past_due` |
| `canceled` | `cancelled` (note spelling normalization: Stripe uses `canceled`, entity uses `cancelled`) |
| `unpaid` | `unpaid` |
| `incomplete` | (not mapped — subscription not yet active) |
| `incomplete_expired` | `expired` |

### 12.5 Current Period Update Rules

- `currentPeriodStart` and `currentPeriodEnd` are updated from `subscription.current_period_start` and `subscription.current_period_end` in the Stripe event payload.
- On `invoice_paid` for renewal: period fields are updated to the new billing period.
- Timestamps are converted from Stripe Unix epoch (seconds) to JavaScript `Date`.

### 12.6 Cancellation Field Update Rules

- On `subscription_updated` with `cancel_at_period_end = true`: set `cancelAtPeriodEnd = true`, `cancelAt` from Stripe `cancel_at` field.
- On `subscription_deleted`: set `cancelledAt = now`, `status = 'cancelled'`.
- On `subscription_updated` with `cancel_at_period_end = false` (cancellation reversed): set `cancelAtPeriodEnd = false`, `cancelAt = null`.

### 12.7 One-Active-Subscription Invariant

- The partial unique index `idx_subscriptions_one_active_per_user` enforces at most one active/trialing/past_due subscription per user.
- When creating a new subscription from `checkout_completed`, the service must verify no conflicting active subscription exists.
- If a conflict exists, the event is recorded with status `failed` and error code `SUBSCRIPTION_CONFLICT`.

### 12.8 Behavior When Subscription/User Is Missing

| Missing Entity | Behavior |
|----------------|----------|
| User (no matching `stripeCustomerId`) | Event persisted with status `failed`, error code `UNKNOWN_CUSTOMER`. |
| Subscription (on update/delete events) | Event persisted with status `failed`, error code `SUBSCRIPTION_NOT_FOUND`. |
| Subscription (on create/checkout events) | New subscription record created. |

### 12.9 Whether Updates Are Pure Persistence Only

**YES — updates are pure persistence.** 05D updates `Subscription` entity fields and `User.planType` / `User.planStatus` based on webhook event data. No side effects:
- No credit balance mutations (deferred to 05E).
- No email/notification sending.
- No WebSocket push to frontend.
- No provider API callbacks.

---

## 13. Checkout Metadata Dependency Decision

### 13.1 Whether 05C Checkout Session Metadata Is Sufficient for 05D

**PARTIALLY — a gap exists.** The current 05C `CreateCheckoutSessionParams` passes `userId`, `userEmail`, `planId`, `successUrl`, `cancelUrl` to the provider. However, these are used to CREATE the checkout session — they are NOT automatically embedded as Stripe checkout session metadata.

When Stripe fires `checkout.session.completed`, the webhook payload includes:
- `customer` (Stripe customer ID) — maps to `users.stripe_customer_id`.
- `subscription` (Stripe subscription ID) — for subscription checkouts.
- `metadata` — only if explicitly set during session creation.
- `mode` — `subscription` or `payment` (one-time).

**For subscription checkouts:** The `subscription` field in the webhook is sufficient to create a `Subscription` record and link to the user via `customer` → `users.stripe_customer_id`.

**For top-up checkouts:** Without metadata, the webhook cannot identify which `topUpPackId` was purchased or confirm the checkout type. The `mode = 'payment'` distinguishes it from subscriptions, but the credit amount must come from metadata.

### 13.2 Whether Metadata Needs to Include userId, checkoutType, planType/topUpPackId, Idempotency Key

**YES — for full functionality, the following metadata should be embedded in the Stripe checkout session:**

| Key | Value | Purpose |
|-----|-------|---------|
| `aisandbox_user_id` | UUID | Map back to platform user (backup to `customer` field). |
| `aisandbox_checkout_type` | `subscription` \| `topup` | Distinguish checkout type in webhook handler. |
| `aisandbox_plan_id` | `starter` \| `pro` \| `team` | Subscription plan identifier. |
| `aisandbox_topup_pack_id` | `topup_1000` \| `topup_5000` \| `topup_20000` | Top-up pack identifier (only for top-up checkouts). |

### 13.3 Whether 05C Source Must Be Modified in 05D

**NO — 05C source is LOCKED.** The metadata embedding must happen in the `StripePaymentProvider.createCheckoutSession()` `test`/`live` branch (when real SDK calls are implemented). In `stub` mode, metadata is not relevant because no real checkout session is created.

**The metadata gap does NOT block 05D Step 3** because:
1. 05D tests use mocked/stub events where event data is controlled by the test.
2. Real metadata embedding will be addressed when `StripePaymentProvider.createCheckoutSession()` is wired to the real SDK (future task).
3. For subscription checkouts, the `subscription` and `customer` fields in the Stripe event are sufficient to identify the user and subscription without metadata.
4. For top-up checkouts, metadata is essential — but top-up credit grants are deferred to 05E, so 05D only records the event with status `ignored`.

### 13.4 Whether Any 05C Metadata Gap Forces Split or Follow-Up

**NO split required.** The metadata gap is documented and will be addressed when the Stripe SDK `test`/`live` branches are implemented. 05D can proceed with stub-mode tests. A follow-up task should be registered to ensure metadata embedding is implemented before real top-up checkouts are processed.

### 13.5 No Credit Grant Issuance in 05D

**CONFIRMED.** 05D does not issue credit grants. Top-up checkout completion events are recorded but not acted upon for credits. Credit grant issuance is 05E scope.

---

## 14. Credit Top-Up / Credit Grant Deferral Boundary

| Decision | Outcome |
|----------|---------|
| 05D may record/ignore top-up completion events | **CONFIRMED** — `checkout.session.completed` with `mode = 'payment'` (top-up) is recorded with status `ignored` and a note that credit grant is deferred to 05E. |
| 05E owns `credit_grants` and balance crediting | **CONFIRMED** — 05E will create the `credit_grants` table/entity, implement `CreditGrantService`, and handle monthly allocation resets and top-up credit additions. |
| 05D must not mutate credit balances for top-ups | **CONFIRMED** — no writes to `credit_balances` in 05D for any top-up event. |
| No credit grant / top-up accounting in 05D | **CONFIRMED** — 05D is pure event ingestion, idempotency, and subscription persistence. |
| 05D subscription events may update user plan fields | **CONFIRMED** — `users.plan_type` and `users.plan_status` are updated by subscription events. This does NOT affect credit balances (which are managed by the credit ledger separately). |

---

## 15. Provider Boundary Decision

| Decision | Outcome |
|----------|---------|
| No Stripe/provider API calls in Step 3 unless Keith explicitly approves later | **CONFIRMED** — Step 3 uses `StripePaymentProvider` in `disabled`/`stub` mode only. No real SDK calls. |
| Provider event parsing may use existing interface only | **CONFIRMED** — `verifyWebhookSignature()`, `parseWebhookEvent()`, `mapEventType()` from the 05A `PaymentProvider` interface. |
| No SDK/package/env changes unless explicitly approved later | **CONFIRMED** — no `stripe` package install, no env keys added, no `package.json` changes. |
| No test-mode Stripe CLI/webhook delivery unless explicitly approved later | **CONFIRMED** — no Stripe CLI, no real webhook event delivery, no test-mode webhook testing. |

---

## 16. Implementation vs Split Decision

**Decision: A — 05D can proceed as one bounded stub/test-mode-ready no-provider-call Step 3.**

### Rationale

The scope is well-bounded:
1. One new entity file (`WebhookEvent`).
2. One new migration file (not executed).
3. One new controller file (`WebhookController`).
4. One new service file (`WebhookService`).
5. One new repository file (`WebhookEventRepository`).
6. One new module file (`WebhookModule`).
7. One `main.ts` change (`rawBody: true`).
8. One `AppModule` change (import `WebhookModule`).
9. Unit tests for all components.

All of this uses existing infrastructure:
- `StripePaymentProvider` (05A — LOCKED) for `verifyWebhookSignature`, `parseWebhookEvent`, `mapEventType`.
- `SubscriptionRepository` (05B — LOCKED) for subscription persistence.
- `User` entity (existing) for customer mapping.
- Existing TypeORM/NestJS patterns.

No external dependencies. No SDK. No env changes. No frontend.

### Why Not B (Split into 05D1/05D2)

The raw-body change is a single line in `main.ts` (`rawBody: true`). Splitting raw-body/signature from persistence would create unnecessary coordination overhead. The webhook controller, service, entity, and repository are tightly coupled and should be delivered together.

### Why Not C (Requires Stripe SDK/env/test webhook secret)

Step 3 works entirely in `stub` mode without the Stripe SDK or any env keys. Real verification is deferred to when the SDK is installed.

### Why Not D (Validation-only)

05D requires new production files (entity, controller, service, module, migration). It is not validation-only.

### Why Not E (Pause)

No blockers exist. All prerequisites (05A, 05B, 05C) are COMPLETE and LOCKED.

---

## 17. Exact Step 3 File Boundary

### Production Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/entities/webhook-event.entity.ts` | CREATE | TypeORM `WebhookEvent` entity for `webhook_events` table. |
| 2 | `services/api-gateway/src/entities/index.ts` | MODIFY | Add `WebhookEvent` export. |
| 3 | `services/api-gateway/src/billing/webhook/webhook.controller.ts` | CREATE | `@Controller('billing/webhooks')` — `POST stripe`. Public unauthenticated. Raw body + signature verification. |
| 4 | `services/api-gateway/src/billing/webhook/webhook.service.ts` | CREATE | Event verification, parsing, idempotency, routing, subscription updates, event status persistence. |
| 5 | `services/api-gateway/src/billing/webhook/webhook-event.repository.ts` | CREATE | `WebhookEventRepository` — `findByProviderEventId()`, `createEvent()`, `updateEventStatus()`, `incrementAttempts()`. |
| 6 | `services/api-gateway/src/billing/webhook/webhook.module.ts` | CREATE | Module wiring — imports `PaymentsModule`, `SubscriptionModule`, `TypeOrmModule.forFeature([WebhookEvent, User])`. |
| 7 | `services/api-gateway/src/main.ts` | MODIFY | Add `rawBody: true` to `NestFactory.create()` options. |
| 8 | `services/api-gateway/src/app.module.ts` | MODIFY | Import `WebhookModule`. |

### Migration Files (Not Executed)

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/migrations/1772300000000-CreateWebhookEventsTable.ts` | Create `webhook_events` table with idempotency constraints and indexes. |

### Test Files

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/billing/webhook/__tests__/webhook.controller.spec.ts` | Controller endpoint tests — signature, response shape, raw body handling. |
| 2 | `services/api-gateway/src/billing/webhook/__tests__/webhook.service.spec.ts` | Service logic tests — verification, parsing, idempotency, routing, subscription updates. |
| 3 | `services/api-gateway/src/billing/webhook/__tests__/webhook-event.repository.spec.ts` | Repository method tests — CRUD, idempotency queries. |
| 4 | `services/api-gateway/src/billing/webhook/__tests__/webhook-event.entity.spec.ts` | Entity shape tests — columns, constraints, defaults. |
| 5 | `services/api-gateway/src/billing/webhook/__tests__/webhook-event-migration.spec.ts` | Migration SQL structure tests — idempotency guards, indexes. |
| 6 | `services/api-gateway/src/billing/webhook/__tests__/webhook.module.spec.ts` | Module composition test. |

### Files NOT Changed in 05D

- No `services/api-gateway/package.json` changes (no `stripe` package).
- No `.env.example` changes.
- No `StripePaymentProvider` changes (05A LOCKED).
- No `SubscriptionRepository` changes (05B LOCKED).
- No `Subscription` entity changes (05B LOCKED).
- No `CheckoutController` / `CheckoutService` changes (05C LOCKED).
- No frontend files.
- No worker/ai-service changes.
- No `database/schema.sql` or `database/init/001_schema.sql` changes.
- No governance files changed during Step 3 implementation.
- No `credit_balances` or `credit_deduction_records` mutations.

---

## 18. Test Plan

| # | Test | Type | Assertions |
|---|------|------|------------|
| 1 | Webhook endpoint returns 200 on valid stub event | Unit | POST `/api/billing/webhooks/stripe` with stub signature → 200 `{ received: true }`. |
| 2 | Missing `stripe-signature` header → 400 | Unit | No header → 400 `{ error: 'MISSING_SIGNATURE' }`. |
| 3 | Provider disabled mode → 400 | Unit | Provider returns `PROVIDER_DISABLED` → 400. |
| 4 | Provider `test`/`live` mode (no SDK) → 400 | Unit | Provider returns `PROVIDER_NOT_CONFIGURED` → 400. |
| 5 | Stub signature verification succeeds | Unit | Provider returns `{ valid: true }`. Processing continues. |
| 6 | Event parse in stub mode returns placeholder | Unit | Provider returns `{ eventId: 'stub_evt_placeholder', ... }`. |
| 7 | `mapEventType` for known types returns internal type | Unit | `checkout.session.completed` → `checkout_completed`, etc. |
| 8 | `mapEventType` for unknown type returns null | Unit | `unknown.event.type` → `null`. |
| 9 | Unknown event type persisted with status `ignored` | Unit | Event type not in allowlist → `webhook_events.status = 'ignored'`. |
| 10 | Idempotent: duplicate event ID returns 200 without reprocessing | Unit | Same `provider_event_id` sent twice → second call returns 200, `attempts` incremented, no duplicate subscription update. |
| 11 | `webhook_events` record created on first receipt | Unit | New event → INSERT into `webhook_events` with status `received`. |
| 12 | `webhook_events` status transitions: received → verified → processing → processed | Unit | Verify status updates through processing pipeline. |
| 13 | `checkout_completed` (subscription) creates Subscription record | Unit | Event with subscription type → `SubscriptionRepository.createSubscription()` called. |
| 14 | `checkout_completed` (top-up) records event with status `ignored` | Unit | Top-up checkout → event status = `ignored`, no credit balance mutation. |
| 15 | `subscription_created` creates Subscription if not exists | Unit | Event with new `sub_xxx` → new subscription record created. |
| 16 | `subscription_updated` updates Subscription status/period | Unit | Event with updated fields → `updateSubscription()` called with correct values. |
| 17 | `subscription_deleted` sets status to `cancelled` | Unit | Event → subscription status = `cancelled`, `cancelledAt` set. |
| 18 | `invoice_paid` updates Subscription period (renewal) | Unit | Event → `currentPeriodStart/End` updated. |
| 19 | `invoice_payment_failed` sets Subscription status to `past_due` | Unit | Event → subscription status = `past_due`. |
| 20 | Subscription update also updates `users.plan_type` / `users.plan_status` | Unit | Status change → user plan fields updated. |
| 21 | Unknown customer (`stripeCustomerId` not found) → event `failed` | Unit | No matching user → event status = `failed`, error code = `UNKNOWN_CUSTOMER`. |
| 22 | Unknown subscription (on update/delete) → event `failed` | Unit | No matching subscription → event status = `failed`, error code = `SUBSCRIPTION_NOT_FOUND`. |
| 23 | No credit balance mutation in any test | Unit | No writes to `credit_balances` in any 05D test. |
| 24 | No provider API calls in any test | Unit | Mocked `StripePaymentProvider`. No `stripe` import. |
| 25 | No env/package dependency | Unit | No env reads for Stripe keys in webhook service/controller. No `stripe` import. |
| 26 | Entity shape validation | Unit | `WebhookEvent` entity has correct columns, types, constraints. |
| 27 | Migration SQL structure | Unit | Migration creates table with correct columns, indexes, constraints, full down migration. |
| 28 | Module composition | Unit | `WebhookModule` provides `WebhookService`, `WebhookEventRepository`, `WebhookController`. |
| 29 | 04 balance/deduction invariants unaffected | Compile | `npx tsc --noEmit` passes. Existing credit balance/deduction/guard tests remain passing. |
| 30 | No 04 balance/deduction regressions | Unit | Existing `credit-balance` test suite passes (regression check). |
| 31 | `rawBody` available in request | Unit | Controller test verifies `req.rawBody` is accessible. |
| 32 | Stripe status spelling normalization | Unit | Stripe `canceled` → entity `cancelled` (British spelling). |

### Test Non-Goals

- No Stripe SDK mock tests (SDK not installed).
- No integration tests requiring DB, Docker, Redis.
- No real webhook delivery tests (Stripe CLI not approved).
- No credit grant tests (05E).
- No frontend/browser tests.
- No real signature verification tests (requires SDK + webhook secret).

---

## 19. Runtime / Provider Validation Decision

| Constraint | Status |
|-----------|--------|
| Docker/PostgreSQL/Redis required for Step 3 | **NO** — 05D is entity/controller/service/repository creation + unit tests. All dependencies mocked. |
| Stripe/payment/provider API calls | **NONE** — no `stripe` package. No SDK. No network calls. Mocked provider in tests. |
| Stripe CLI/webhook testing | **NONE** — no real webhook delivery. |
| Live/test-mode provider validation | **NONE** — deferred until Keith provides webhook secret and approves test-mode validation. |
| Browser smoke | **NONE** — no frontend changes. |
| AGENT-HARNESS write canary | **NONE** — remains a separate track. |
| Migrations | **NONE executed** — migration file created but NOT run. Execution requires Docker/PostgreSQL readiness and Keith guidance. |
| Runtime commands for validation | `npx tsc --noEmit` and `npm test` (targeted suites) only. |
| If future test-mode validation is needed | Requires explicit Keith approval, `STRIPE_WEBHOOK_SECRET` configured, `stripe` package installed, Docker/PostgreSQL running, and potentially Stripe CLI for webhook event forwarding. |

---

## 20. UX/UI Constraints

| Constraint | Status |
|-----------|--------|
| UI implementation in 05D | **NONE** — no frontend changes. |
| Translation key updates | **NONE** — no user-facing text added. |
| Heroicons v2 Outline only | N/A — no UI. |
| Impeccable / Emil Kowalski advisory only | N/A — no UI. |
| Future UI implications | If future webhook status/admin UI is added, translation keys must be updated in `en.json`, `zh-TW.json`, `zh-CN.json` per multilingual-first rule. |

---

## 21. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Raw-body parser regression risk | MEDIUM | `rawBody: true` is an additive NestJS option. Existing `@Body()` decorators continue to work. Existing tests verify this. The option stores raw bytes alongside parsed JSON — no existing behavior changes. |
| 2 | Invalid signature bypass risk | HIGH | In `stub` mode, `verifyWebhookSignature()` returns `{ valid: true }` unconditionally. This is acceptable because `stub` mode is development-only (`STRIPE_PROVIDER_MODE=stub`). In `disabled` mode (default), webhooks are rejected. In `test`/`live` mode (future), real HMAC verification prevents bypass. Production must never use `stub` mode. |
| 3 | Accidental live provider call risk | HIGH | No `stripe` package installed. No SDK import. No provider API calls. Provider returns `PROVIDER_NOT_CONFIGURED` for `test`/`live` modes. Double-gate safety (provider mode + no SDK). |
| 4 | Env secret leakage risk | HIGH | No env keys added in 05D. No secrets read by webhook controller/service. `STRIPE_WEBHOOK_SECRET` not referenced. Error responses use generic codes only. |
| 5 | Duplicate event / idempotency risk | HIGH | `webhook_events.(provider, provider_event_id)` UNIQUE constraint prevents duplicate processing. Application-level check before INSERT. `attempts` counter tracks retries. |
| 6 | Webhook retry semantics risk | MEDIUM | 05D returns HTTP 200 for all verified events (including processing failures). This prevents Stripe retry storms but means failed events require manual reprocessing. Acceptable for initial implementation. |
| 7 | Event ordering risk | MEDIUM | Stripe does not guarantee ordering. 05D derives state from latest subscription object in event payload, not from event sequence. Idempotent processing prevents stale-event overwrites by using the subscription object's own timestamps. |
| 8 | Subscription status mapping ambiguity | LOW | Stripe `canceled` vs entity `cancelled` spelling normalization documented. `incomplete` / `incomplete_expired` mapping documented. |
| 9 | Checkout metadata gap risk | MEDIUM | 05C checkout sessions do not embed metadata (userId, checkoutType, planId) in Stripe session metadata. For subscription checkouts, the `subscription` and `customer` fields in the webhook are sufficient. For top-up checkouts, metadata is needed but top-up credit grants are deferred to 05E. A follow-up task must ensure metadata embedding before real top-up processing. |
| 10 | Top-up credit grant premature mutation risk | HIGH | 05D explicitly does NOT mutate `credit_balances`. Top-up `checkout_completed` events are recorded with status `ignored`. Tests verify no credit balance writes. |
| 11 | Migration risk | LOW | Migration creates a new table (`webhook_events`) with no data dependencies. Uses `IF NOT EXISTS` for idempotency. Does not modify existing tables. Created but not executed — consistent with 05B convention. |
| 12 | Test false-confidence risk | MEDIUM | Tests use mocked provider and stub event data. They validate controller/service/repository logic but not real Stripe webhook behavior. Real behavior tested when SDK is installed and Keith provides webhook secret. |
| 13 | `InternalServiceAuthGuard` interference | LOW | The global `InternalServiceAuthGuard` checks for `/api/internal/*` path prefix. The webhook endpoint at `/api/billing/webhooks/stripe` does not match this prefix. No interference. Verified by reading `InternalServiceAuthGuard` behavior. |
| 14 | `ThrottlerModule` interference | MEDIUM | The global `ThrottlerModule` has a default limit of 10 req/60s. Stripe can send webhook bursts. The webhook controller should be decorated with `@SkipThrottle()` or the throttler should have a webhook-specific higher limit. |
| 15 | `ValidationPipe` interference with raw body | LOW | `ValidationPipe({ whitelist: true, transform: true })` operates on `@Body()` decorated parameters. The webhook controller may use `@Req() req` directly to access `req.rawBody` instead of `@Body()`, bypassing the validation pipe for the raw body. The controller does NOT need class-validator validation on the webhook payload — Stripe controls the payload format. |

---

## 22. Step 3 Readiness Conclusion

| Criterion | Status |
|-----------|--------|
| Ready for Step 3? | **YES** — scope is well-bounded: `WebhookEvent` entity, `WebhookEventRepository`, `WebhookService`, `WebhookController`, `WebhookModule`, `main.ts` raw body, `AppModule` update, migration (not executed), unit tests. |
| Further split required? | **NO** — single bounded Step 3 is sufficient. Raw-body change is one line. No SDK/env/package changes. |
| Migration approval needed? | **YES** — Keith must approve the `webhook_events` table migration before Step 3 implementation (migration created but not executed). |
| Package/env/provider-call approval needed? | **NO** — not for Step 3. Step 3 uses stub/mock provider only. |
| Recommended model | **GPT-5.3 Codex High** — webhook security boundary, signature verification, idempotency, subscription state updates, and raw-body handling. Not routine. |
| Exact next prompt type | **Implementation prompt** — 05D Step 3 bounded implementation with exact file boundary from Section 17. |

---

## 23. Safety Confirmations

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
| No AGENT-HARNESS write canary involvement | **CONFIRMED** |
| No env keys added | **CONFIRMED** |
| No package dependencies added | **CONFIRMED** |
| No secrets or placeholder secrets added | **CONFIRMED** |
| No raw-body/bootstrap source changes | **CONFIRMED** |
| No webhook/controller/service source code created | **CONFIRMED** |

---

## 24. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05D-WEBHOOK-INGESTION-IDEMPOTENCY-READINESS.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task/child-slice confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, current active task |
| 4 | `docs/BILLING-READY-05C-CHECKPOINT.md` | 05C completion record — checkout LOCKED |
| 5 | `docs/BILLING-READY-05C-CHECKOUT-CREDIT-TOP-UP-READINESS.md` | 05C Step 2 readiness review — checkout decisions |
| 6 | `docs/BILLING-READY-05B-CHECKPOINT.md` | 05B completion record — subscription persistence LOCKED |
| 7 | `docs/BILLING-READY-05A-CHECKPOINT.md` | 05A completion record — provider contracts LOCKED |
| 8 | `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent 05 Step 2 readiness review — Stripe selection, split decision, webhook/event scope |
| 9 | `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor parent checkpoint — COMPLETE and LOCKED |
| 10 | `services/api-gateway/src/main.ts` | Bootstrap — body parser, middleware, global config |
| 11 | `services/api-gateway/src/app.module.ts` | Module imports — current feature modules |
| 12 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Provider contracts — webhook method signatures (05A LOCKED) |
| 13 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Mode-aware Stripe provider — webhook stubs (05A LOCKED) |
| 14 | `services/api-gateway/src/payments/payments.module.ts` | Payments module (05A LOCKED) |
| 15 | `services/api-gateway/src/billing/checkout/checkout.controller.ts` | Checkout controller (05C LOCKED) |
| 16 | `services/api-gateway/src/billing/checkout/checkout.service.ts` | Checkout service (05C LOCKED) |
| 17 | `services/api-gateway/src/billing/checkout/checkout.module.ts` | Checkout module (05C LOCKED) |
| 18 | `services/api-gateway/src/billing/checkout/dto/checkout-session-response.dto.ts` | Checkout response DTO (05C LOCKED) |
| 19 | `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts` | Price map config (05C LOCKED) |
| 20 | `services/api-gateway/src/billing/checkout/checkout-url.validator.ts` | URL validator (05C LOCKED) |
| 21 | `services/api-gateway/src/billing/subscription/subscription.repository.ts` | Subscription repository (05B LOCKED) |
| 22 | `services/api-gateway/src/billing/subscription/subscription.module.ts` | Subscription module (05B LOCKED) |
| 23 | `services/api-gateway/src/entities/subscription.entity.ts` | Subscription entity (05B LOCKED) |
| 24 | `services/api-gateway/src/entities/user.entity.ts` | User entity — `stripeCustomerId`, `planType`, `planStatus` |
| 25 | `services/api-gateway/src/entities/index.ts` | Entity exports barrel |
| 26 | `services/api-gateway/src/billing/billing.module.ts` | Billing module — BillingSnapshot only |
| 27 | `services/api-gateway/src/migrations/1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | 05B migration — convention reference |
| 28 | `services/api-gateway/src/migrations/1772200100000-AddStripeCustomerIdUniqueIndex.ts` | 05B migration — convention reference |
| 29 | `services/api-gateway/package.json` | API Gateway dependencies — no `stripe` package |
| 30 | `package.json` | Root package — workspace config |
| 31 | `database/schema.sql` | Raw SQL schema — `subscriptions` table definition |

---

## 25. Summary

BILLING-READY-05D Step 2 webhook ingestion / idempotency readiness review is **COMPLETE**. Key decisions:

1. **Webhook endpoint**: `POST /api/billing/webhooks/stripe` — public unauthenticated, signature-protected only. `WebhookController` in `services/api-gateway/src/billing/webhook/`.
2. **Raw body**: `rawBody: true` on `NestFactory.create()` — minimal one-line change in `main.ts`. Safe for all routes. Only webhook controller reads `req.rawBody`.
3. **Signature verification**: Stub/test-mode-ready. `stub` mode → always valid. `disabled` mode → rejected. Real HMAC deferred to Stripe SDK installation.
4. **Stripe SDK/package**: NOT needed in 05D. Deferred. No env keys added. No `package.json` changes.
5. **`webhook_events` table**: New entity + migration (not executed). Columns: `provider_event_id` (unique), `provider`, `event_type`, `internal_event_type`, `status`, `payload_hash`, `error_message`, `error_code`, `attempts`, timestamps.
6. **Event idempotency**: Unique constraint on `(provider, provider_event_id)`. Duplicate events acknowledged (200) but not reprocessed. `attempts` counter tracks retries.
7. **Event status model**: `received` → `verified` → `processing` → `processed` / `ignored` / `failed`.
8. **Event type allowlist**: 6 event types in scope. Top-up credit grants deferred to 05E. Refunds/chargebacks out of scope.
9. **Subscription updates**: Pure persistence — `SubscriptionRepository` methods for create/update. `users.plan_type` / `users.plan_status` updated. No credit balance mutations.
10. **Checkout metadata gap**: 05C sessions don't embed Stripe metadata. Not blocking — subscription events have sufficient data. Top-up metadata needed for 05E — documented as follow-up.
11. **Credit deferral**: 05D records top-up events with status `ignored`. No `credit_balances` writes. 05E owns credit grants.
12. **Provider boundary**: No Stripe API calls. No SDK. No env changes.
13. **Implementation**: Single bounded Step 3 — no further split needed.
14. **Migration approval**: Required from Keith before Step 3 (create but not execute).
15. **Model**: GPT-5.3 Codex High — security-adjacent with webhook boundary, idempotency, and raw-body handling.
16. **Zero source/env/package/governance/migration changes** in this Step 2 review.
