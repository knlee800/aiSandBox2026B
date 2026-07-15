# BILLING-READY-05A — Provider Configuration / Contracts Readiness Review

**Task ID:** BILLING-READY-05A
**Step:** 2 — Provider Configuration / Contracts Readiness Review
**Status:** COMPLETE
**Date:** 2026-07-15
**Nature:** Static readiness review — read-only — no implementation

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05A ACTIVE | **CONFIRMED** — Step 1 COMPLETE (Registration — 2026-07-13). Step 2 is this review. |
| BILLING-READY-05 ACTIVE (parent) | **CONFIRMED** — Steps 1–2 COMPLETE (2026-07-13). Keith approved split into 05A–05G. BILLING-READY-05A is current ACTIVE child slice. |
| BILLING-READY-05B/05C/05D/05E/05F/05G | **PLANNED ONLY** — not registered. Registration deferred until 05A is complete. |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-13. All child slices COMPLETE and LOCKED. Regression matrix PASS 12/12. |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. All 7 child slices COMPLETE and LOCKED. All 11 parent close criteria satisfied. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | **CONFIRMED** — 2026-07-12. Live runtime orchestration canary PASS. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. Per-builder harness config adapter. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-09. Full E2E canary PASS. |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05A is the current ACTIVE child slice; parent BILLING-READY-05 is ACTIVE with child-slice execution in progress. |

---

## 2. Step 2 Source-of-Truth Summary

Summarized from `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` (BILLING-READY-05 Step 2 — COMPLETE 2026-07-13):

| Decision | Outcome |
|----------|---------|
| Provider selected | **Stripe** — aligns with existing `users.stripe_customer_id`, `subscriptions.stripe_subscription_id` in DB schema, existing `StripePaymentProvider` stub, and `ChargeReadinessService` gate. |
| Target for BILLING-READY-05 | **Stub-only + test-mode-ready contracts** — implement contracts, types, webhook handler structure, customer mapping, credit grant logic. NO live Stripe API calls in BILLING-READY-05. |
| Provider API calls in future | **Deferred to child slices** — actual `stripe` SDK calls require configured API keys and Keith explicit approval per slice. |
| Live/test-mode provider calls | **Require explicit Keith approval** — no live Stripe calls without Keith providing API keys and explicit approval. Test-mode keys configuration is a manual Keith step. |
| 05A scope (from parent review) | First child slice for provider configuration/contracts/readiness — install `stripe` package; create real `StripePaymentProvider` with SDK; env key validation; `ChargeReadinessService` update; TypeORM subscription entity. No live API calls. |
| Split decision | Parent 05 split into 05A–05G approved by Keith 2026-07-13. |

---

## 3. Existing Payment Module Source-Path Findings

### 3.1 Files and Classes

| Path | Class/Interface | Current State |
|------|-----------------|---------------|
| `services/api-gateway/src/payments/payments.module.ts` | `PaymentsModule` | NestJS module — exports `StripePaymentProvider`. Task 10B2 stub. No imports from `@nestjs/config`. No Stripe SDK. |
| `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | `StripePaymentProvider` | Task 10B2 stub — `prepareInvoice()` returns placeholders; `validateConfiguration()` always returns `true`; `console.log` on construction. No API calls. No SDK. |
| `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | `PaymentProvider`, `InvoicePreview`, `ProviderInvoiceContext` | Invoice-preview-only interface. `getProviderName()`, `prepareInvoice()`, `validateConfiguration()`. No checkout/subscription/webhook/customer methods. |
| `services/api-gateway/src/admin/charge-readiness.service.ts` | `ChargeReadinessService` | Financial kill-switch gate — reads `BILLING_CHARGES_ENABLED` env via `process.env` (not `ConfigService`). Calls `ReconciliationService.getInvoiceDriftReport()` and `StripePaymentProvider.validateConfiguration()`. Does NOT charge. |
| `services/api-gateway/src/admin/admin.module.ts` | `AdminModule` | Imports `PaymentsModule`; provides and exports `ChargeReadinessService`. |
| `services/api-gateway/src/startup/production-guardrails.validator.ts` | `ProductionGuardrailsValidator` | Validates `BILLING_CHARGES_ENABLED` is explicitly set in production. Fail-fast if missing or invalid. |

### 3.2 Current Stub Behavior

- `StripePaymentProvider.prepareInvoice()` → `{ provider: 'stripe', externalCustomerId: null, externalInvoiceId: null, status: 'not_sent' }`.
- `StripePaymentProvider.validateConfiguration()` → always `true` (stub mode).
- `StripePaymentProvider` constructor → `console.log` with stub-mode message.
- No `stripe` npm package installed.
- No Stripe SDK imported anywhere in the codebase.
- No checkout session creation, webhook endpoint, subscription management, or customer creation code.

### 3.3 Existing Config/Env References

| Key | Location | Purpose |
|-----|----------|---------|
| `BILLING_CHARGES_ENABLED` | `.env.example` (default: `false`) | Hard kill-switch — read by `ChargeReadinessService` via `process.env`, validated by `ProductionGuardrailsValidator` in production. |

No `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, or any Stripe price ID env keys exist in `.env.example` or any config file.

### 3.4 Existing Tests

- **No tests exist** under `services/api-gateway/src/payments/__tests__/`. The payments module has zero test coverage.
- `ChargeReadinessService` is tested indirectly through `production-guardrails.validator.spec.ts` and `startup-failfast.integration.spec.ts`.

### 3.5 Existing Package/Dependency State

- **No `stripe` package** in `services/api-gateway/package.json` or root `package.json`.
- API Gateway dependencies include NestJS, TypeORM, BullMQ, passport, axios, ioredis, `@nestjs/config` (v4.0.3), pg, bcrypt, etc. — no payment SDK.

### 3.6 Existing Related Entities

| Entity | Key Fields | Relevance |
|--------|-----------|-----------|
| `User` | `stripeCustomerId` (nullable varchar(255)), `planType` (default 'free'), `planStatus` (default 'active') | Already has Stripe customer ID column. |
| `CreditBalance` | `ownerId`, `ownerType`, `planId`, `balance`, `monthlyAllocation`, `periodStart`/`periodEnd`, `status` | Per-user balance. No `purchasedCredits` column yet. |
| `CreditDeductionRecord` | `sourceEventId` (unique), `balanceBefore`/`balanceAfter`, `appliedCredits`/`overflowCredits` | Immutable deduction audit trail. |
| `Invoice` | `userId`, `totalCostUSD`, `currency` (default 'USD'), `status` (default 'draft') | Legacy invoice model — not Stripe-linked. |
| `BillingSnapshot` | `userId`, `totalCostUSD`, `lineItems`, `status` | Point-in-time billing record. |

### 3.7 Existing `ChargeReadinessService` Configuration Path

`ChargeReadinessService` reads `BILLING_CHARGES_ENABLED` via raw `process.env` (not `@nestjs/config` `ConfigService`). This is a direct env read at construction time, stored as a private `chargesEnabled` boolean. The service depends on `ReconciliationService` and `StripePaymentProvider`.

---

## 4. Provider Configuration Contract Decision

### 4.1 Provider Mode Names

| Mode | Value | Description |
|------|-------|-------------|
| `disabled` | `'disabled'` | Provider is completely off. All provider methods return no-op results. No SDK instantiation. No env keys required. This is the default. |
| `stub` | `'stub'` | Provider returns static placeholder data. No SDK instantiation. No env keys required. Current Task 10B2 behavior. |
| `test` | `'test'` | Provider is configured with Stripe test-mode keys (`sk_test_*`). SDK is instantiated. Real Stripe test-mode API calls are permitted but gated by `ChargeReadinessService`. |
| `live` | `'live'` | Provider is configured with Stripe live keys (`sk_live_*`). SDK is instantiated. Real Stripe live API calls are permitted but gated by `ChargeReadinessService` + additional safety. |

### 4.2 Default Mode

**`disabled`** — when no `STRIPE_PROVIDER_MODE` env key is set or when the value is empty, the provider operates in `disabled` mode. This is the safest default.

### 4.3 Disabled vs Stub: Separate States

**Yes — `disabled` and `stub` are separate states.**

- `disabled`: provider methods throw or return an error result indicating the provider is off. No placeholder data returned. Callers know the provider is not available.
- `stub`: provider methods return static placeholder results (current Task 10B2 behavior). Callers receive data shaped like real responses, enabling development/testing of downstream flows without env keys.

Rationale: separating these prevents confusion between "provider is intentionally off" and "provider is returning fake data for development." The `disabled` state is appropriate for production free-tier; `stub` is for local development.

### 4.4 Configuration Read Path

- Provider mode read from `ConfigService.get<string>('STRIPE_PROVIDER_MODE')` via `@nestjs/config`.
- `@nestjs/config` is already a dependency (`^4.0.3` in api-gateway `package.json`).
- Centralizes env access through NestJS standard pattern.
- Falls back to `'disabled'` when the key is absent.

### 4.5 Missing Config Behavior

| Condition | Behavior |
|-----------|----------|
| `STRIPE_PROVIDER_MODE` not set | Mode defaults to `disabled`. No SDK instantiation. No error. |
| `STRIPE_SECRET_KEY` not set when mode is `test` or `live` | Provider constructor logs error and degrades to `disabled` mode. `ChargeReadinessService` reports `paymentProviderConfigured: false`. |
| `STRIPE_WEBHOOK_SECRET` not set when mode is `test` or `live` | Webhook verification unavailable. Webhook endpoint returns 500 with clear error. Provider remains operational for non-webhook flows. |
| Price IDs not set when mode is `test` or `live` | Checkout session creation returns error. Non-checkout flows unaffected. |

### 4.6 Invalid Config Behavior

| Condition | Behavior |
|-----------|----------|
| `STRIPE_PROVIDER_MODE` set to unrecognized value | Provider logs warning and degrades to `disabled` mode. Does not crash. |
| `STRIPE_SECRET_KEY` set but invalid format (not `sk_test_*` or `sk_live_*`) | Provider logs warning. SDK instantiation proceeds (Stripe SDK validates on first call, not construction). `ChargeReadinessService` cannot detect format issues until an API call is attempted (deferred to 05C/05D). |
| Mode is `test` but key is `sk_live_*` | **Mismatch detection**: provider logs critical warning. `ChargeReadinessService` blocks. Provider degrades to `disabled` to prevent accidental live charges in test configuration. |
| Mode is `live` but key is `sk_test_*` | Provider logs warning. Allows operation (test keys in live mode are non-destructive). |

### 4.7 Configuration Location

Provider configuration belongs **in the payments module** (`PaymentsModule`), not in shared config. Rationale:

- Provider mode is payment-specific, not platform-wide.
- `PaymentsModule` already owns `StripePaymentProvider`.
- `ChargeReadinessService` (in `AdminModule`) imports `PaymentsModule` to access provider — this relationship is already established.
- Config values are read via `ConfigService` which is globally available through `@nestjs/config`.

---

## 5. Disabled / Stub / Test / Live Behavior Decision

### 5.1 Mode Behavior Matrix

| Operation | `disabled` | `stub` | `test` | `live` |
|-----------|-----------|--------|--------|--------|
| SDK instantiated | No | No | Yes (`sk_test_*`) | Yes (`sk_live_*`) |
| `createCheckoutSession()` | Returns `ProviderDisabledError` | Returns static placeholder URL | Creates real Stripe test checkout | Creates real Stripe live checkout |
| `createOrRetrieveCustomer()` | Returns `ProviderDisabledError` | Returns `{ customerId: null }` | Creates/retrieves real test customer | Creates/retrieves real live customer |
| `createBillingPortalSession()` | Returns `ProviderDisabledError` | Returns static placeholder URL | Creates real test portal session | Creates real live portal session |
| `verifyWebhookSignature()` | Returns `ProviderDisabledError` | Returns `{ valid: true }` (no-op) | Verifies real test signature | Verifies real live signature |
| `parseWebhookEvent()` | Returns `ProviderDisabledError` | Returns static placeholder event | Parses real test event | Parses real live event |
| `validateConfiguration()` | Returns `false` | Returns `true` (stub always valid) | Validates test key presence | Validates live key presence |

### 5.2 BILLING_CHARGES_ENABLED Interaction

| `BILLING_CHARGES_ENABLED` | Provider Mode | Net Effect |
|---------------------------|---------------|------------|
| `false` | Any | `ChargeReadinessService.isChargingEnabledAtSystemLevel()` returns `false`. All charging paths blocked at system level. Provider mode is irrelevant for charging. |
| `true` | `disabled` | System-level gate passes, but provider returns `ProviderDisabledError`. Net: no charging possible. |
| `true` | `stub` | System-level gate passes, provider returns placeholders. Net: no real charging. |
| `true` | `test` | System-level gate passes, provider can make test-mode calls. Net: test charges possible (requires test keys). |
| `true` | `live` | System-level gate passes, provider can make live calls. Net: live charges possible (requires live keys + additional safety gates). |

### 5.3 Missing Secrets Behavior

| Missing Secret | In `disabled`/`stub` | In `test`/`live` |
|----------------|---------------------|-------------------|
| `STRIPE_SECRET_KEY` | No effect — not needed. | Provider degrades to `disabled`. `ChargeReadinessService` reports not ready. Startup does not crash. Warning logged. |
| `STRIPE_WEBHOOK_SECRET` | No effect — not needed. | Webhook signature verification fails. Webhook endpoint rejects all events. Non-webhook flows continue. |
| `STRIPE_PRICE_ID_*` | No effect — not needed. | Checkout session creation fails for affected plans. Other flows continue. |

---

## 6. ChargeReadinessService / Kill-Switch Decision

### 6.1 Top-Level Safety Gate

**Yes — `ChargeReadinessService` remains the top-level safety gate.** All paths that could result in real payment provider calls must pass through `ChargeReadinessService` first.

### 6.2 Provider Call Blocking

**Yes — payment provider calls are blocked unless `ChargeReadinessService` says ready.** The relationship is:

```
ChargeReadinessService.isChargingEnabledAtSystemLevel() → false → block all provider calls
ChargeReadinessService.isChargingEnabledAtSystemLevel() → true → check provider mode
  provider mode = disabled → block (ProviderDisabledError)
  provider mode = stub → allow (returns placeholders, no real calls)
  provider mode = test/live → allow real calls (requires valid keys)
```

### 6.3 BILLING_CHARGES_ENABLED vs Provider Mode Relationship

These are **independent, layered gates**:

1. `BILLING_CHARGES_ENABLED` (env) → system-level kill-switch → `ChargeReadinessService`.
2. `STRIPE_PROVIDER_MODE` (env) → provider-level mode → `StripePaymentProvider`.
3. Both must allow for real provider calls to proceed.

This dual-gate design means:
- Setting `BILLING_CHARGES_ENABLED=false` blocks all charging regardless of provider mode.
- Setting provider mode to `disabled` blocks all provider calls regardless of kill-switch.
- Both must be correctly configured for real charges.

### 6.4 Future Checkout/Webhook Endpoints

**Yes — future checkout and webhook endpoints must check the kill-switch.**

- Checkout endpoint (`POST /api/billing/checkout` — 05C): must call `ChargeReadinessService.isChargingEnabledAtSystemLevel()` or equivalent before creating a Stripe checkout session.
- Webhook endpoint (`POST /api/billing/webhook` — 05D): webhook processing itself does not need the kill-switch (Stripe sends events regardless), but any action triggered by a webhook (credit grants, status changes) should verify system consistency.

### 6.5 Readiness Result Contract Adjustments for 05A

**Yes — 05A should extend `ChargeReadinessService` readiness results** to include provider mode information:

- Add `providerMode: 'disabled' | 'stub' | 'test' | 'live'` to `SystemChargeReadiness`.
- Add `providerModeValid: boolean` to indicate whether the current provider mode is properly configured.
- Update `validateConfiguration()` on `StripePaymentProvider` to check actual key presence when mode is `test` or `live`.
- Existing `chargesEnabledAtSystemLevel`, `paymentProviderConfigured`, `ready`, `blockingReasons` fields remain.

---

## 7. Provider Interface / Contract Decision

### 7.1 Methods to Add to `PaymentProvider` Interface

The existing `PaymentProvider` interface has only `getProviderName()`, `prepareInvoice()`, and `validateConfiguration()`. The following methods are needed for the full subscription/checkout/webhook lifecycle:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `createCheckoutSession` | `(params: CreateCheckoutSessionParams) => Promise<CheckoutSessionResult>` | Create Stripe Checkout session for plan subscription or one-time top-up. |
| `createOrRetrieveCustomer` | `(params: CustomerParams) => Promise<CustomerResult>` | Create or retrieve Stripe customer by aiSandBox user ID + email. |
| `createBillingPortalSession` | `(params: PortalSessionParams) => Promise<PortalSessionResult>` | Create Stripe Customer Portal session for self-service billing management. |
| `verifyWebhookSignature` | `(rawBody: Buffer, signature: string) => WebhookVerificationResult` | Verify Stripe webhook HMAC signature. |
| `parseWebhookEvent` | `(rawBody: Buffer, signature: string) => ParsedWebhookEvent` | Parse and validate a Stripe webhook event. |
| `mapEventType` | `(providerEventType: string) => MappedEventType \| null` | Map Stripe event type string to internal event type enum. |
| `getProviderMode` | `() => ProviderMode` | Return current provider mode. |

### 7.2 No-Op / Stub Behavior

When provider mode is `disabled`:
- All methods return a typed error result: `{ success: false, error: 'PROVIDER_DISABLED', message: '...' }`.
- No exceptions thrown — callers handle the error result.

When provider mode is `stub`:
- `createCheckoutSession` → `{ success: true, sessionId: 'stub_cs_xxx', url: null }`.
- `createOrRetrieveCustomer` → `{ success: true, customerId: null }`.
- `createBillingPortalSession` → `{ success: true, url: null }`.
- `verifyWebhookSignature` → `{ valid: true }` (always passes in stub).
- `parseWebhookEvent` → returns a static placeholder event object.
- `mapEventType` → returns the corresponding internal type if recognized, `null` otherwise.

### 7.3 Error Behavior

All provider methods return typed result objects, not exceptions:

```typescript
interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: ProviderErrorCode;
  message?: string;
}

type ProviderErrorCode =
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'INVALID_PARAMS'
  | 'PROVIDER_API_ERROR'
  | 'SIGNATURE_INVALID'
  | 'EVENT_PARSE_ERROR';
```

### 7.4 Typed Result Shapes

```typescript
interface CheckoutSessionResult {
  sessionId: string | null;
  url: string | null;
}

interface CustomerResult {
  customerId: string | null;
  isNew: boolean;
}

interface PortalSessionResult {
  url: string | null;
}

interface WebhookVerificationResult {
  valid: boolean;
}

type InternalEventType =
  | 'checkout_completed'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_deleted'
  | 'invoice_paid'
  | 'invoice_payment_failed';

interface ParsedWebhookEvent {
  eventId: string;
  eventType: InternalEventType | string;
  data: Record<string, unknown>;
}

interface MappedEventType {
  internal: InternalEventType;
  stripe: string;
}
```

---

## 8. Env / Package Decision

### 8.1 Env Keys Likely Needed Later

| Key | When Needed | Required By |
|-----|-------------|-------------|
| `STRIPE_PROVIDER_MODE` | 05A (Step 3) | Provider mode selection |
| `STRIPE_SECRET_KEY` | 05C (checkout) / 05D (webhooks) | Stripe SDK initialization |
| `STRIPE_PUBLISHABLE_KEY` | 05F (frontend checkout redirect) | Client-side Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | 05D (webhooks) | Webhook HMAC verification |
| `STRIPE_PRICE_ID_STARTER` | 05C (checkout) | Checkout session creation |
| `STRIPE_PRICE_ID_PRO` | 05C (checkout) | Checkout session creation |
| `STRIPE_PRICE_ID_TEAM` | 05C (checkout) | Checkout session creation |
| `STRIPE_PRICE_ID_TOPUP_*` | 05C (checkout) | Top-up credit pack checkout |

### 8.2 Env Key Changes in 05A

**Only `STRIPE_PROVIDER_MODE` should be added to `.env.example` in 05A Step 3** (with default value `disabled`). All other Stripe env keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs) are deferred to 05C/05D when they are actually consumed.

However: `.env.example` changes require Keith explicit approval. If Keith prefers to defer even `STRIPE_PROVIDER_MODE` to a later slice, 05A can hardcode the default `disabled` value and add the env key later.

**Decision: defer `.env.example` changes to Step 3 implementation — do not add env keys in Step 2.**

### 8.3 Stripe Package Status

- **Not installed.** No `stripe` package in any `package.json`.
- **Must be added later** during 05A Step 3 implementation (or deferred to 05C if 05A is contracts-only).
- Package installation requires Keith explicit approval per CLAUDE.md ("Ask before adding dependencies").

### 8.4 Package Installation Timing

**Decision: add `stripe` package in 05A Step 3 only if 05A includes SDK setup.** If 05A is scoped to contracts/interfaces only (no SDK instantiation), defer `stripe` package to 05C.

The parent review (BILLING-READY-05 Step 2) proposed 05A as "Install `stripe` package; create real `StripePaymentProvider` with SDK." This suggests 05A should include the package. But the readiness review below (Section 10) will finalize this.

### 8.5 No Env/Package Changes in Step 2

**CONFIRMED — no env or package changes in this Step 2 review.**

---

## 9. Security / Provider-Call Safety Decision

| Safety Rule | Decision |
|-------------|----------|
| No live provider calls without Keith approval | **MANDATORY** — no `sk_live_*` API calls without explicit Keith approval, legal/compliance review, and monitoring in place. |
| Test-mode provider calls require Keith's test keys | **MANDATORY** — Keith must provide `sk_test_*` keys. These are not committed to source. Test-mode calls require explicit Keith approval. |
| No provider calls in unit tests | **MANDATORY** — all Stripe SDK calls mocked in unit tests. No network calls. No test keys in CI. |
| Webhook signature verification mandatory later | **MANDATORY** — all webhook requests must pass HMAC verification (05D). |
| Raw body handling deferred to 05D | **CONFIRMED** — NestJS raw body middleware configuration is 05D scope. |
| Secret leakage prevention | **MANDATORY** — `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` never logged, never in source, never in error messages. Provider logs must redact key values. |
| Test/live mode confusion prevention | **MANDATORY** — provider validates key prefix (`sk_test_` vs `sk_live_`) against declared mode. Mismatch → degrade to `disabled` + critical warning. Separate env files for test vs live recommended. |
| `BILLING_CHARGES_ENABLED` default | **MUST remain `false`** in `.env.example` and in all development environments. |
| Provider mode default | **MUST be `disabled`** when `STRIPE_PROVIDER_MODE` is absent or empty. |

---

## 10. Implementation vs Validation-Only Decision

**Decision: B — 05A needs bounded implementation of provider config/contracts/stub.**

### Rationale

- 05A is the first child slice of the provider integration chain. Subsequent slices (05B–05G) depend on having typed contracts and provider mode infrastructure in place.
- A readiness-only 05A (Option A) would leave no usable artifacts for 05B/05C. Contracts are needed before persistence (05B) or checkout (05C) can begin.
- The scope is bounded: provider mode enum, extended `PaymentProvider` interface, typed result contracts, `StripePaymentProvider` mode-aware refactor, `ChargeReadinessService` readiness result extension, unit tests. No SDK installation, no live calls, no env keys, no migrations, no frontend.
- Validation-only (Option C) has nothing to validate yet — there is no provider config code to test.
- Further split (Option D) is unnecessary — the scope is a single bounded implementation pass.

### Scope Boundary for 05A Step 3

05A Step 3 implementation is **contracts and mode infrastructure only**:

1. Provider mode enum and configuration reading.
2. Extended `PaymentProvider` interface with all method signatures.
3. Typed result/error contracts.
4. `StripePaymentProvider` refactored to be mode-aware (disabled/stub behavior only in 05A; test/live deferred).
5. `ChargeReadinessService` readiness result extended with provider mode info.
6. Unit tests for disabled/stub mode behavior, mode defaulting, invalid mode handling.

05A Step 3 does **NOT** include:

- `stripe` package installation (deferred to 05C when SDK is first needed).
- Any Stripe SDK instantiation or import.
- Any real API calls (test or live).
- Webhook endpoint, raw body middleware, or signature verification (05D).
- Checkout session creation (05C).
- Database migrations or new entities (05B).
- Frontend changes (05F).
- `.env.example` changes (deferred — hardcode default in code).

---

## 11. Exact Step 3 File Boundary

### Production Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | EXTEND | Add checkout/customer/portal/webhook/event method signatures. Add typed result interfaces. Add `ProviderMode` enum. Add `ProviderErrorCode` type. |
| 2 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | REFACTOR | Make mode-aware (`disabled`/`stub`). Read `STRIPE_PROVIDER_MODE` from `ConfigService`. Implement all new interface methods with disabled/stub behavior. Remove Task 10B2 `console.log` construction noise. |
| 3 | `services/api-gateway/src/payments/payments.module.ts` | EXTEND | Import `ConfigModule` (if not already globally registered). Ensure `ConfigService` is available to `StripePaymentProvider`. |
| 4 | `services/api-gateway/src/admin/charge-readiness.service.ts` | MODIFY | Extend `SystemChargeReadiness` with `providerMode` and `providerModeValid`. Update `validateConfiguration()` call to reflect mode-aware behavior. |

### Test Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/payments/__tests__/stripe-payment.provider.spec.ts` | CREATE | Tests for disabled/stub mode behavior, mode defaulting, invalid mode, all interface methods in both modes. |
| 2 | `services/api-gateway/src/payments/__tests__/payment-provider.interface.spec.ts` | CREATE (optional) | Type-level smoke tests for contract shapes if practical. May be omitted if TypeScript compilation is sufficient. |
| 3 | `services/api-gateway/src/admin/__tests__/charge-readiness.service.spec.ts` | CREATE or EXTEND | Tests for extended readiness result with provider mode info. |

### Files NOT Changed in 05A

- No `.env.example` changes (provider mode default hardcoded in code).
- No `package.json` changes (no `stripe` package until 05C).
- No frontend files.
- No database migration files.
- No entity files (subscription/webhook-event/credit-grant entities are 05B scope).
- No new controllers or endpoints.
- No worker/ai-service changes.

---

## 12. Test Plan

| # | Test | Type | Assertions |
|---|------|------|------------|
| 1 | Default mode is `disabled` when `STRIPE_PROVIDER_MODE` not set | Unit | Provider mode is `disabled`. |
| 2 | Explicit `disabled` mode recognized | Unit | `getProviderMode()` returns `'disabled'`. |
| 3 | Explicit `stub` mode recognized | Unit | `getProviderMode()` returns `'stub'`. |
| 4 | Explicit `test` mode recognized (without SDK) | Unit | `getProviderMode()` returns `'test'`. Provider degrades if `STRIPE_SECRET_KEY` missing. |
| 5 | Invalid mode value degrades to `disabled` | Unit | Unrecognized mode string → `disabled`. |
| 6 | `disabled` mode: all methods return `ProviderDisabledError` | Unit | Each method returns `{ success: false, error: 'PROVIDER_DISABLED' }`. |
| 7 | `stub` mode: `createCheckoutSession` returns placeholder | Unit | Returns `{ success: true, data: { sessionId: 'stub_...', url: null } }`. |
| 8 | `stub` mode: `createOrRetrieveCustomer` returns placeholder | Unit | Returns `{ success: true, data: { customerId: null, isNew: false } }`. |
| 9 | `stub` mode: `verifyWebhookSignature` returns valid | Unit | Returns `{ success: true, data: { valid: true } }`. |
| 10 | `stub` mode: `validateConfiguration` returns `true` | Unit | Stub mode always valid. |
| 11 | `disabled` mode: `validateConfiguration` returns `false` | Unit | Disabled mode is not configured. |
| 12 | No Stripe SDK/API calls in any test | Unit | No `stripe` import. No network mocks. No `nock`/`msw`. |
| 13 | `ChargeReadinessService` blocks when `BILLING_CHARGES_ENABLED=false` | Unit | `isChargingEnabledAtSystemLevel()` returns `false`. |
| 14 | `ChargeReadinessService` extended result includes `providerMode` | Unit | `getSystemChargeReadiness()` result has `providerMode` field. |
| 15 | `ChargeReadinessService` reports `providerModeValid: false` when `disabled` | Unit | Provider in `disabled` mode → `paymentProviderConfigured: false`. |
| 16 | `ChargeReadinessService` reports `providerModeValid: true` when `stub` | Unit | Provider in `stub` mode → `paymentProviderConfigured: true`. |
| 17 | Typed contract result shapes compile correctly | Compile | `npx tsc --noEmit` passes with all new interfaces. |
| 18 | Provider mode config missing secrets when `test` mode | Unit | Mode is `test` but `STRIPE_SECRET_KEY` is absent → provider degrades to `disabled`. |

### Test Non-Goals

- No Stripe SDK mock tests (SDK not installed in 05A).
- No integration tests requiring DB, Docker, Redis.
- No webhook signature verification tests with real crypto.
- No checkout session creation tests with real parameters.
- No package dependency tests.

---

## 13. Split Decision

**Decision: Proceed with one bounded Step 3.**

05A Step 3 is a single bounded implementation pass covering:
- Provider mode enum + config reading.
- Extended `PaymentProvider` interface.
- Typed result/error contracts.
- Mode-aware `StripePaymentProvider` (disabled + stub only).
- `ChargeReadinessService` readiness extension.
- Unit tests.

No further split is needed. The scope is well-bounded and does not require multiple implementation passes.

---

## 14. Runtime / Provider Validation Decision

| Constraint | Status |
|-----------|--------|
| Docker/PostgreSQL/Redis required for Step 3 | **NO** — 05A is TypeScript-only contracts and unit tests. No DB access, no BullMQ, no Redis. |
| Stripe/payment/provider API calls | **NONE** — no `stripe` package installed. No SDK. No network calls. |
| Live/test-mode provider validation in 05A | **NONE** — deferred to 05C/05D when Keith provides keys. |
| Browser smoke | **NONE** — no frontend changes. |
| AGENT-HARNESS write canary | **NONE** — remains a separate track. |
| Runtime commands for validation | `npx tsc --noEmit` and `npm test` (targeted suites) only. No `npm run build` required unless TypeScript check reveals issues. |

---

## 15. UX / UI Constraints

| Constraint | Status |
|-----------|--------|
| UI implementation in 05A | **NONE** — no frontend changes in 05A. |
| Translation key updates | **NONE** — no user-facing text added. |
| Heroicons v2 Outline only | N/A — no UI. |
| Impeccable / Emil Kowalski advisory only | N/A — no UI. |
| Future UI implications | If future billing UI is added (05F), translation keys must be updated in `en.json`, `zh-TW.json`, `zh-CN.json` per multilingual-first rule. |

---

## 16. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Live/test-mode confusion | HIGH | Provider validates key prefix against declared mode. Mismatch → degrade to `disabled`. Dual-gate with `BILLING_CHARGES_ENABLED`. |
| 2 | Secret leakage | HIGH | No secrets committed. Provider redacts keys in logs. `STRIPE_SECRET_KEY` never in error messages. Startup validator enforces presence in production when needed. |
| 3 | Accidental provider call | HIGH | No `stripe` package installed in 05A. No SDK import. No network calls possible. `disabled` default mode. |
| 4 | Disabled/stub semantics ambiguity | MEDIUM | Clear documentation: `disabled` = provider off (error results); `stub` = provider returns placeholders (development use). Enum values are distinct. |
| 5 | Env/package approval risk | LOW | `stripe` package deferred to 05C. No env keys added in 05A. Keith approval required before adding dependencies. |
| 6 | Checkout/webhook future coupling risk | MEDIUM | 05A defines contracts only — checkout (05C) and webhook (05D) implementation is separate. Contracts are designed for extension without breaking changes. |
| 7 | Kill-switch bypass risk | HIGH | `ChargeReadinessService` remains mandatory gate. Future endpoints must check it. Tests verify gate behavior. |
| 8 | Test false-confidence risk | MEDIUM | Tests cover disabled/stub behavior only. Real Stripe SDK behavior (test/live modes) tested in 05C/05D with actual SDK mocks. 05A tests make no SDK assumptions. |
| 9 | `ChargeReadinessService` env read pattern | LOW | Currently reads `process.env` directly. 05A refactor opportunity to use `ConfigService` for consistency. If changed, must preserve backward compatibility and test behavior. |
| 10 | Interface evolution risk | LOW | Extended `PaymentProvider` interface may need adjustment when real SDK is integrated in 05C. Contracts designed to be additive, not breaking. |

---

## 17. Step 3 Readiness Conclusion

| Criterion | Status |
|-----------|--------|
| Ready for Step 3? | **YES** — scope is well-bounded: contracts, mode infrastructure, disabled/stub behavior, extended readiness, unit tests. |
| Further split required? | **NO** — single bounded Step 3 is sufficient. |
| Recommended model | **GPT-5.3 Codex** — routine implementation of TypeScript contracts, interface extension, mode-aware refactor, unit tests. Not security-adjacent (no SDK, no secrets, no provider calls). |
| Exact next prompt type | **Implementation prompt** — 05A Step 3 bounded implementation with exact file boundary from Section 11. |

---

## 18. Safety Confirmations

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
| No child slices registered (05B/05C/05D/05E/05F/05G) | **CONFIRMED** |
| No env keys added | **CONFIRMED** |
| No package dependencies added | **CONFIRMED** |
| No secrets or placeholder secrets added | **CONFIRMED** |

---

## 19. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05A-PROVIDER-CONTRACTS-READINESS.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task/child-slice confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, current active task |
| 4 | `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent readiness review — source-of-truth for 05A |
| 5 | `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor checkpoint — COMPLETE and LOCKED |
| 6 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | Foundation checkpoint — COMPLETE and LOCKED |
| 7 | `services/api-gateway/src/payments/payments.module.ts` | Existing payment module stub |
| 8 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Existing Stripe stub |
| 9 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Existing payment interface |
| 10 | `services/api-gateway/src/admin/charge-readiness.service.ts` | Financial kill-switch gate |
| 11 | `services/api-gateway/src/admin/admin.module.ts` | Admin module — imports PaymentsModule |
| 12 | `services/api-gateway/src/startup/production-guardrails.validator.ts` | Production billing env validation |
| 13 | `services/api-gateway/src/entities/user.entity.ts` | User entity — `stripeCustomerId` column |
| 14 | `services/api-gateway/src/entities/credit-balance.entity.ts` | Credit balance entity |
| 15 | `services/api-gateway/src/entities/credit-deduction-record.entity.ts` | Deduction record entity |
| 16 | `services/api-gateway/src/entities/invoice.entity.ts` | Invoice entity |
| 17 | `services/api-gateway/src/entities/billing-snapshot.entity.ts` | Billing snapshot entity |
| 18 | `services/api-gateway/src/billing/billing.module.ts` | Billing module |
| 19 | `services/api-gateway/src/billing/credit-balance.guard.ts` | CreditBalanceGuard |
| 20 | `services/api-gateway/src/billing/credit-balance-guard.module.ts` | Guard module |
| 21 | `services/api-gateway/src/billing/credit-deduction/types.ts` | Deduction event types |
| 22 | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | Plan definitions (free/starter/pro/team) |
| 23 | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | Plan type definitions, MONTHLY_CREDIT_ALLOCATIONS |
| 24 | `services/api-gateway/src/config/database.config.ts` | Database config |
| 25 | `services/api-gateway/package.json` | API Gateway dependencies — no `stripe` package |
| 26 | `.env.example` | Environment template — `BILLING_CHARGES_ENABLED=false` only |
| 27 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Usage ledger (not modified) |

---

## 20. Summary

BILLING-READY-05A Step 2 provider configuration/contracts readiness review is **COMPLETE**. Key decisions:

1. **Provider modes**: `disabled` (default) / `stub` / `test` / `live` — four distinct states with clear behavior per mode.
2. **Disabled vs stub are separate**: `disabled` = provider off (error results); `stub` = returns placeholders for development.
3. **Dual-gate safety**: `BILLING_CHARGES_ENABLED` (system kill-switch) + `STRIPE_PROVIDER_MODE` (provider-level gate). Both must allow for real calls.
4. **`ChargeReadinessService` remains the top-level safety gate** with extended readiness results including provider mode.
5. **No `stripe` package in 05A**: contracts and interfaces only. SDK installation deferred to 05C.
6. **05A is bounded implementation** (Option B): mode enum, extended interface, typed contracts, mode-aware provider refactor, ChargeReadinessService extension, unit tests.
7. **Single bounded Step 3**: no further split needed.
8. **Ready for Step 3**: recommended model GPT-5.3 Codex, implementation prompt.
9. **Zero source/env/package/governance changes** in this Step 2 review.
