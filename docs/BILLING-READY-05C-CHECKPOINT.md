# BILLING-READY-05C — Checkpoint

**Task ID:** BILLING-READY-05C
**Parent:** BILLING-READY-05
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-15
**Nature:** Checkout / Credit Top-Up Session Creation consumer layer

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-05C |
| Parent | BILLING-READY-05 |
| Family | BILLING READY / STRIPE PAYMENT PROVIDER / CHECKOUT CREDIT TOP-UP SESSION |
| Risk | HIGH — 4-step child-slice loop |
| Registered | 2026-07-15 |
| Completed | 2026-07-15 |
| Keith approval | Keith explicitly approved BILLING-READY-05C registration 2026-07-15. |
| Status | **COMPLETE and LOCKED** |

---

## 2. Step 2 Readiness Summary

**Readiness review:** `docs/BILLING-READY-05C-CHECKOUT-CREDIT-TOP-UP-READINESS.md`

| Decision | Outcome |
|----------|---------|
| Provider-call boundary | **Option B — single bounded test-mode-ready but no-provider-call consumer layer** |
| No Stripe SDK | **CONFIRMED** — no `stripe` package import in any 05C file |
| No stripe package install | **CONFIRMED** — `services/api-gateway/package.json` unchanged |
| No env/secrets changes | **CONFIRMED** — no new env keys, no `.env.example` changes |
| No migrations | **CONFIRMED** — no new migration files in 05C |
| No frontend/i18n | **CONFIRMED** — no UI changes, no translation key updates |
| No provider API calls | **CONFIRMED** — all provider calls mocked in tests; no network calls |
| No webhook/credit-grant/billing portal implementation | **CONFIRMED** — deferred to 05D/05E/05F |
| Further split required | **NO** — single bounded Step 3 sufficient |

---

## 3. Workflow Steps

| Step | Description | Status |
|------|-------------|--------|
| 1 | Registration | COMPLETE (2026-07-15) |
| 2 | Checkout / credit top-up readiness / exact provider-call boundary | COMPLETE (2026-07-15) — `docs/BILLING-READY-05C-CHECKOUT-CREDIT-TOP-UP-READINESS.md` |
| 3 | Bounded implementation — consumer layer (controller, service, DTOs, config, validator, tests) | COMPLETE (2026-07-15) |
| 4 | Consolidation / checkpoint | COMPLETE (2026-07-15) — this file |

---

## 4. Production Files Created

| # | File | Action |
|---|------|--------|
| 1 | `services/api-gateway/src/billing/checkout/checkout.controller.ts` | CREATED — `@Controller('billing/checkout')`, `POST subscription`, `POST topup`, `SessionCookieGuard` |
| 2 | `services/api-gateway/src/billing/checkout/checkout.service.ts` | CREATED — gate check, customer resolution, plan/price mapping, provider delegation |
| 3 | `services/api-gateway/src/billing/checkout/checkout.module.ts` | CREATED — imports `PaymentsModule`, `AdminModule`, `SubscriptionModule`, `AuthModule`, `TypeOrmModule.forFeature([User])` |
| 4 | `services/api-gateway/src/billing/checkout/dto/create-subscription-checkout.dto.ts` | CREATED — request DTO with class-validator decorators |
| 5 | `services/api-gateway/src/billing/checkout/dto/create-topup-checkout.dto.ts` | CREATED — request DTO for top-up |
| 6 | `services/api-gateway/src/billing/checkout/dto/checkout-session-response.dto.ts` | CREATED — response DTO |
| 7 | `services/api-gateway/src/billing/checkout/dto/index.ts` | CREATED — DTO barrel export |
| 8 | `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts` | CREATED — static plan ID → price placeholder mapping + top-up pack definitions |
| 9 | `services/api-gateway/src/billing/checkout/checkout-url.validator.ts` | CREATED — success/cancel URL validation logic |

---

## 5. Production File Modified

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/app.module.ts` | MODIFIED — minimal `CheckoutModule` import only |

---

## 6. Test Files Created

| # | File | Tests |
|---|------|-------|
| 1 | `services/api-gateway/src/billing/checkout/__tests__/checkout.controller.spec.ts` | Created — controller endpoint tests |
| 2 | `services/api-gateway/src/billing/checkout/__tests__/checkout.service.spec.ts` | Created — service logic tests |
| 3 | `services/api-gateway/src/billing/checkout/__tests__/checkout-price-map.spec.ts` | Created — price map validation tests |
| 4 | `services/api-gateway/src/billing/checkout/__tests__/checkout.module.spec.ts` | Created — module composition test |

---

## 7. Endpoint / Controller Behavior

| Aspect | Value |
|--------|-------|
| Controller decorator | `@Controller('billing/checkout')` → `/api/billing/checkout/*` |
| `POST /api/billing/checkout/subscription` | Create subscription checkout session — accepts `planId`, `successUrl`, `cancelUrl` |
| `POST /api/billing/checkout/topup` | Create credit top-up checkout session — accepts `topUpPackId`, `successUrl`, `cancelUrl` |
| Auth guard | `@UseGuards(SessionCookieGuard)` — browser-session only |
| No API-key checkout access | Checkout not accessible via `ApiKeyAuthGuard` |
| User identity | Extracted from `request.user.userId` / `request.user.email` set by `SessionCookieGuard` |

---

## 8. CheckoutService Behavior

| Behavior | Detail |
|----------|--------|
| Subscription plan validation | Validates `planId` against allowlist (`starter`, `pro`, `team`) |
| Top-up package validation | Validates `topUpPackId` against static `TOP_UP_PACK_IDS` config |
| Free plan rejection | `planId = 'free'` rejected — HTTP 400 |
| Unknown plan rejection | Unknown `planId` or `topUpPackId` — HTTP 400 |
| No user-supplied price IDs | `planId` → server-side price mapping only; users cannot supply arbitrary Stripe price IDs |
| URL validation | Validates `successUrl` / `cancelUrl` — `new URL()`, max 2048 chars, HTTPS required, origin allowlist |
| ChargeReadinessService gate | Calls `chargeReadinessService.getSystemChargeReadiness()` before any provider delegation |
| Customer resolution | Reads `user.stripeCustomerId`; reuses existing or calls `createOrRetrieveCustomer()` |
| Provider delegation | Delegates to `StripePaymentProvider` through `PaymentProvider` interface |
| Provider error mapping | Maps `ProviderErrorCode` to HTTP status codes |
| Active subscription conflict | Checks `SubscriptionRepository.findActiveByUserId()` before subscription checkout — returns HTTP 409 if active subscription found |

---

## 9. ChargeReadinessService Gate Behavior

| Condition | Behavior |
|-----------|----------|
| `ready = false` | HTTP 503 Service Unavailable — no provider call made |
| `BILLING_CHARGES_ENABLED = false` | `ready = false` → HTTP 503 |
| Provider `disabled` | `ready = false` → HTTP 503 |
| Provider `stub` + charges enabled | `ready = true` → checkout proceeds; returns stub result |
| Provider `test`/`live` (no SDK/API path) | Returns `PROVIDER_NOT_CONFIGURED` → HTTP 503 |
| Stub checkout when charges disabled | **NOT allowed** — kill-switch blocks regardless of provider mode |

---

## 10. Provider Delegation Behavior

| Behavior | Detail |
|----------|--------|
| Method used | `createCheckoutSession()` via `PaymentProvider` interface |
| Customer method | `createOrRetrieveCustomer()` via `PaymentProvider` interface |
| No Stripe SDK import | **CONFIRMED** — no `import Stripe from 'stripe'` in any 05C file |
| No stripe package dependency | **CONFIRMED** — package.json unchanged |
| No network/API calls | **CONFIRMED** — provider mocked in all tests |
| No test/live Stripe calls | **CONFIRMED** — no real SDK calls |
| `PROVIDER_DISABLED` error | → HTTP 503 |
| `PROVIDER_NOT_CONFIGURED` error | → HTTP 503 |
| `INVALID_PARAMS` error | → HTTP 400 |
| `PROVIDER_API_ERROR` error | → HTTP 502 |
| Success | → HTTP 201 with `CheckoutSessionResponseDto` |

---

## 11. Customer Reuse / Creation Behavior

| Behavior | Detail |
|----------|--------|
| Reads `user.stripeCustomerId` | Queries user record by `userId` from session |
| Reuses existing customer ID | Passed to `createOrRetrieveCustomer()` if non-null |
| Creates customer when missing | Calls `createOrRetrieveCustomer({ userId, email })` |
| Stub mode customer ID | `customerId = null` — no DB update |
| Non-null customer ID persistence | `user.stripeCustomerId` updated when real provider returns a `customerId` |

---

## 12. Success / Cancel URL Validation

| Rule | Detail |
|------|--------|
| URL format | Parsed with `new URL()` — invalid URL → HTTP 400 |
| Max length | 2048 characters |
| HTTPS required | Production: HTTPS only |
| HTTP localhost allowed | Non-production: `http://localhost:*` and `http://127.0.0.1:*` allowed |
| Origin allowlist | Must match `FRONTEND_URL` origin or localhost development allowance |
| Invalid URLs | → HTTP 400 with `{ error: 'INVALID_URL', field: 'successUrl' | 'cancelUrl' }` |
| Open redirect blocked | URL validated against origin allowlist before provider delegation |

---

## 13. Price / Plan Allowlist

| Category | Values |
|----------|--------|
| Subscription plans | `starter`, `pro`, `team` |
| Free plan | Not checkoutable — `planId = 'free'` rejected |
| Top-up packs | `topup_1000`, `topup_5000`, `topup_20000` |
| Price ID source | Server-side static config — placeholder values only |
| Real Stripe price IDs | Deferred to later approved env/config work |
| No user-supplied price IDs | Users cannot inject arbitrary Stripe price IDs |

---

## 14. Validation Results

| Suite / Check | Result | Tests |
|---------------|--------|-------|
| `npx jest --runInBand "checkout"` | **PASS** | 58/58, 4 suites |
| `npx jest --runInBand "stripe-payment.provider"` | **PASS** | 49/49 |
| `npx jest --runInBand "charge-readiness.service"` | **PASS** | 15/15 |
| `npx jest --runInBand "credit-balance"` | **PASS** | 74/74 regression |
| `npx tsc --noEmit` (api-gateway) | **PASS** | exit code 0 |
| Linter (checkout directory) | **PASS** | 0 errors |

---

## 15. Safety Confirmations

| Constraint | Status |
|-----------|--------|
| No Stripe SDK/package installed or imported | **CONFIRMED** |
| No stripe package dependency added | **CONFIRMED** |
| No env/secrets changes | **CONFIRMED** |
| No provider/payment API calls | **CONFIRMED** |
| No migrations | **CONFIRMED** |
| No frontend changes | **CONFIRMED** |
| No Docker/Postgres/Redis/runtime calls | **CONFIRMED** |
| No real DB calls | **CONFIRMED** |
| No governance files changed during Step 3 | **CONFIRMED** |
| No webhook implementation | **CONFIRMED** — deferred to 05D |
| No credit-grant/top-up accounting implementation | **CONFIRMED** — deferred to 05E |
| No billing portal implementation | **CONFIRMED** — deferred to 05F |
| No AGENT-HARNESS write canary | **CONFIRMED** |

---

## 16. Parent / Child Status

| Task | Status |
|------|--------|
| BILLING-READY-05 | **ACTIVE** — Steps 1–2 COMPLETE. Step 3 IN PROGRESS via child slices. 05A COMPLETE and LOCKED. 05B COMPLETE and LOCKED. 05C COMPLETE and LOCKED. |
| BILLING-READY-05A | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05B | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05C | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05D | Planned only — next recommended — **NOT REGISTERED** |
| BILLING-READY-05E | Planned only — **NOT REGISTERED** |
| BILLING-READY-05F | Planned only — **NOT REGISTERED** |
| BILLING-READY-05G | Planned only — **NOT REGISTERED** |
| BILLING-READY-04 | **COMPLETE and LOCKED** — 2026-07-13 |
| BILLING-READY-03 | **COMPLETE and LOCKED** — 2026-07-07 |
| AGENT-PLATFORM-07F | **COMPLETE and LOCKED** — 2026-07-12 |
| AGENT-HARNESS-07 | **COMPLETE and LOCKED** — 2026-07-07 |
| AGENT-HARNESS-06E | **COMPLETE and LOCKED** — 2026-07-09 |

---

## 17. Next Recommended Task

**BILLING-READY-05D — Webhook Event Ingestion / Idempotency**

Scope includes: `checkout.session.completed` webhook ingestion, `webhook_events` table and idempotency key, subscription record population after payment completion, `users.plan_type` update, provider signature validation via `STRIPE_WEBHOOK_SECRET`, and credit-grant hook for top-up events (or delegation to 05E).

**Status: NOT REGISTERED.** Requires Keith explicit approval before registration.

---

## 18. Locked Invariants

After BILLING-READY-05C is COMPLETE and LOCKED, the following invariants are established and must not be altered without an explicitly registered task:

| Invariant | Description |
|-----------|-------------|
| `CheckoutController` | `@Controller('billing/checkout')` — `POST subscription`, `POST topup`, `SessionCookieGuard` only |
| `CheckoutService` | Gate check → customer resolution → plan/price mapping → provider delegation → result mapping |
| `CheckoutModule` | Imports `PaymentsModule`, `AdminModule`, `SubscriptionModule`, `AuthModule`, `TypeOrmModule.forFeature([User])` |
| Subscription checkout plans | `starter`, `pro`, `team` only — `free` not checkoutable |
| Top-up packs | `topup_1000`, `topup_5000`, `topup_20000` — static config |
| Placeholder price IDs | Real Stripe price IDs deferred — no env keys |
| URL validation | `new URL()`, max 2048 chars, HTTPS required, origin allowlist, no open redirect |
| `ChargeReadinessService` gate | Mandatory before any provider call |
| No Stripe SDK | Deferred — no `stripe` import in 05C |
| No live/test-mode API calls | Deferred — no network calls |
| No webhook ingestion | Deferred to 05D |
| No credit grant | Deferred to 05E |
| No billing portal | Deferred to 05F |
| AGENT-HARNESS write canary | Remains a separate track — not registered |

---

## 19. Provider / Payment Call Safety

**Provider and payment calls remain NOT APPROVED.**

- No `stripe` SDK call is permitted in any future task without Keith explicit approval.
- No live Stripe API calls without Keith providing API keys and explicit per-slice approval.
- Test-mode calls require Keith's test-mode keys and explicit approval (deferred to post-05C).
- `BILLING_CHARGES_ENABLED` must remain `false` in all development environments.
- Provider mode default must remain `disabled`.

---

## 20. Related Documents

| Document | Purpose |
|----------|---------|
| `docs/BILLING-READY-05C-CHECKOUT-CREDIT-TOP-UP-READINESS.md` | Step 2 readiness review — source-of-truth for 05C decisions |
| `docs/BILLING-READY-05B-CHECKPOINT.md` | 05B completion record — customer/subscription persistence LOCKED |
| `docs/BILLING-READY-05A-CHECKPOINT.md` | 05A completion record — provider contracts LOCKED |
| `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent 05 Step 2 readiness review — Stripe selection, split decision |
| `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor parent checkpoint — COMPLETE and LOCKED |

---

## 21. Status Summary

**BILLING-READY-05C: COMPLETE and LOCKED — 2026-07-15**

All 4 steps complete:
1. Registration — COMPLETE (2026-07-15)
2. Checkout / credit top-up readiness review — COMPLETE (2026-07-15)
3. Bounded implementation (controller, service, module, DTOs, price map config, URL validator, `AppModule` update, tests) — COMPLETE (2026-07-15)
4. Consolidation / checkpoint — COMPLETE (2026-07-15) — this file

Production files created: 9 (checkout controller, service, module, 3 DTOs, DTO index, price map config, URL validator). Production file modified: 1 (`app.module.ts` — `CheckoutModule` import only). Test files created: 4. Tests: 58/58 PASS (checkout suites). Regression: `stripe-payment.provider` 49/49 PASS, `charge-readiness.service` 15/15 PASS, `credit-balance` 74/74 PASS. TypeScript clean (exit code 0). Linter 0 errors.
No Stripe SDK. No provider API calls. No env changes. No migrations. No real DB calls. No frontend. No AGENT-HARNESS write canary.
Parent BILLING-READY-05 remains ACTIVE with child-slice execution in progress.
Next recommended: BILLING-READY-05D — Webhook Event Ingestion / Idempotency — NOT REGISTERED.
