# BILLING-READY-05C — Checkout / Credit Top-Up Readiness Review

**Task ID:** BILLING-READY-05C
**Step:** 2 — Checkout / Credit Top-Up Readiness / Exact Provider-Call Boundary
**Status:** COMPLETE
**Date:** 2026-07-15
**Nature:** Static readiness review — read-only — no implementation

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05C ACTIVE | **CONFIRMED** — Step 1 COMPLETE (Registration — 2026-07-15). Step 2 is this review. |
| BILLING-READY-05 ACTIVE (parent) | **CONFIRMED** — Steps 1–2 COMPLETE (2026-07-13). Keith approved split into 05A–05G. Step 3 IN PROGRESS via child slices. 05A COMPLETE and LOCKED. 05B COMPLETE and LOCKED. 05C is current ACTIVE child slice. |
| BILLING-READY-05A COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. 4 production files + 3 test files. 79 tests PASS. Provider mode contract (`disabled`/`stub`/`test`/`live`), `ProviderResult<T>`, `ProviderErrorCode`, mode-aware `StripePaymentProvider`, `ChargeReadinessService` extension. No Stripe SDK. No provider API calls. No env changes. |
| BILLING-READY-05B COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. 4 production files + 2 migration files (not executed) + 4 test files. 53/53 subscription tests PASS. `Subscription` entity, `SubscriptionRepository`, `SubscriptionModule`, customer ID unique index migration. No Stripe SDK. No provider API calls. No env changes. |
| BILLING-READY-05D/05E/05F/05G | **PLANNED ONLY** — not registered. Registration deferred until 05C is complete. |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-13. All child slices (04A/04B/04C/04D) COMPLETE and LOCKED. Regression matrix PASS 12/12. |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. All 7 child slices COMPLETE and LOCKED. All 11 parent close criteria satisfied. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | **CONFIRMED** — 2026-07-12. Live runtime orchestration canary PASS. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. Per-builder harness config adapter. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-09. Full E2E canary PASS. |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05C is the current ACTIVE child slice; parent BILLING-READY-05 is ACTIVE with child-slice execution in progress. |

---

## 2. Source-of-Truth Summary

### 2.1 From BILLING-READY-05A (Provider Contracts and Mode Infrastructure)

| Decision | Outcome |
|----------|---------|
| Provider modes | `disabled` (default) / `stub` / `test` / `live` — four distinct states LOCKED. |
| `ProviderResult<T>` contract | `success`, `data?`, `error?`, `message?` — LOCKED. |
| `ProviderErrorCode` values | `PROVIDER_DISABLED`, `PROVIDER_NOT_CONFIGURED`, `INVALID_PARAMS`, `PROVIDER_API_ERROR`, `SIGNATURE_INVALID`, `EVENT_PARSE_ERROR` — LOCKED. |
| `createCheckoutSession()` contract | `(params: CreateCheckoutSessionParams) => Promise<ProviderResult<CheckoutSessionResult>>` — LOCKED. |
| `CreateCheckoutSessionParams` | `userId`, `userEmail`, `planId`, `successUrl`, `cancelUrl` — LOCKED. |
| `CheckoutSessionResult` | `sessionId: string | null`, `url: string | null` — LOCKED. |
| `createOrRetrieveCustomer()` contract | `(params: CustomerParams) => Promise<ProviderResult<CustomerResult>>` — LOCKED. |
| `CustomerParams` | `userId`, `email`, `name?` — LOCKED. |
| `CustomerResult` | `customerId: string | null`, `isNew: boolean` — LOCKED. |
| `createBillingPortalSession()` contract | `(params: PortalSessionParams) => Promise<ProviderResult<PortalSessionResult>>` — LOCKED. |
| `disabled` mode behavior | All methods return `{ success: false, error: 'PROVIDER_DISABLED' }`. |
| `stub` mode behavior | `createCheckoutSession` → `{ success: true, data: { sessionId: 'stub_cs_placeholder', url: null } }`. `createOrRetrieveCustomer` → `{ success: true, data: { customerId: null, isNew: false } }`. |
| `test`/`live` mode behavior | Returns `{ success: false, error: 'PROVIDER_NOT_CONFIGURED' }` — SDK deferred. |
| No Stripe SDK in 05A | Deferred to 05C decision. No `stripe` package. |
| `ChargeReadinessService` extended | `providerMode` and `providerModeValid` fields in `SystemChargeReadiness`. |

### 2.2 From BILLING-READY-05B (Customer / Subscription Persistence)

| Decision | Outcome |
|----------|---------|
| `Subscription` entity | CREATED — `@Entity('subscriptions')`, UUID PK, `userId` FK, `stripeSubscriptionId`, `stripePriceId`, `planType`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`, `cancelAtPeriodEnd`, `cancelledAt`, `createdAt`, `updatedAt`. |
| `SubscriptionRepository` | CREATED — `findActiveByUserId()`, `findByStripeSubscriptionId()`, `findByUserId()`, `createSubscription()`, `updateSubscription()`. |
| `SubscriptionModule` | CREATED — imports `TypeOrmModule.forFeature([Subscription])`, provides/exports `SubscriptionRepository`. |
| Customer identity | `users.stripe_customer_id` — nullable varchar(255), 1:1 mapping, unique partial index `idx_users_stripe_customer_id` (migration created, not executed). |
| One-active-subscription enforcement | Partial unique index `idx_subscriptions_one_active_per_user` on `(user_id) WHERE status IN ('active', 'trialing', 'past_due')` (migration created, not executed). |
| No customer creation in 05B | Deferred to 05C. |
| No controller endpoints in 05B | Deferred to 05C/05D. |
| No `SubscriptionModule` import in `AppModule` | Deferred to 05C/05D — when a consumer needs it. |

### 2.3 From BILLING-READY-05 Parent (Payment Provider Readiness Review)

| Decision | Outcome |
|----------|---------|
| Provider selected | **Stripe**. |
| 05C scope (from parent review) | `POST /api/billing/checkout` endpoint; Stripe `checkout.sessions.create` (test-mode); success/cancel URL handling; guards. Requires test-mode API key from Keith. |
| Plan IDs | `free`, `starter`, `pro`, `team` — from `PLAN_DEFINITIONS`. |
| Stripe price IDs are env/config only | `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_TEAM` — not yet added. |
| One-time credit top-up | Future — one-time credit packs via Stripe checkout session. Contract defined in 05; implementation deferred to child slice. |

### 2.4 Provider Call / SDK / Env Confirmation

- **No provider API calls approved** by 05C registration.
- **No Stripe SDK/package install approved** by 05C registration.
- **No env/secrets/package changes approved** by 05C registration.
- All of these require explicit Keith approval before implementation.

---

## 3. Existing Checkout/Payment Source-Path Findings

### 3.1 PaymentProvider Interface

| Item | Location | Details |
|------|----------|---------|
| File | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Full contract — 05A LOCKED. |
| `CreateCheckoutSessionParams` | Lines 101–107 | `userId`, `userEmail`, `planId`, `successUrl`, `cancelUrl`. |
| `CheckoutSessionResult` | Lines 68–71 | `sessionId: string | null`, `url: string | null`. |
| `CustomerParams` | Lines 109–113 | `userId`, `email`, `name?`. |
| `CustomerResult` | Lines 73–76 | `customerId: string | null`, `isNew: boolean`. |
| `PortalSessionParams` | Lines 115–118 | `customerId`, `returnUrl`. |
| `ProviderResult<T>` | Lines 45–50 | Generic typed result wrapper. |
| `ProviderMode` | Line 15 | `'disabled' | 'stub' | 'test' | 'live'`. |

### 3.2 StripePaymentProvider

| Item | Location | Details |
|------|----------|---------|
| File | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Mode-aware — 05A. |
| `createCheckoutSession()` | Lines 149–164 | `disabled` → `PROVIDER_DISABLED`; `stub` → `{ sessionId: 'stub_cs_placeholder', url: null }`; `test`/`live` → `PROVIDER_NOT_CONFIGURED`. |
| `createOrRetrieveCustomer()` | Lines 170–185 | `disabled` → `PROVIDER_DISABLED`; `stub` → `{ customerId: null, isNew: false }`; `test`/`live` → `PROVIDER_NOT_CONFIGURED`. |
| `createBillingPortalSession()` | Lines 191–203 | Same pattern. |
| Mode resolution | Lines 65–100 | Reads `STRIPE_PROVIDER_MODE` from `ConfigService`; defaults to `disabled`; validates key prefix/mode match. |
| No Stripe SDK | **CONFIRMED** — no `stripe` import anywhere. |

### 3.3 PaymentsModule

| Item | Location | Details |
|------|----------|---------|
| File | `services/api-gateway/src/payments/payments.module.ts` | Provides and exports `StripePaymentProvider`. No entity imports. |
| `ConfigService` | Available via global `ConfigModule.forRoot({ isGlobal: true })` in `AppModule`. |

### 3.4 ChargeReadinessService

| Item | Location | Details |
|------|----------|---------|
| File | `services/api-gateway/src/admin/charge-readiness.service.ts` | Financial kill-switch gate. |
| `isChargingEnabledAtSystemLevel()` | Line 190 | Returns `BILLING_CHARGES_ENABLED === 'true'`. |
| `getSystemChargeReadiness()` | Lines 200–234 | Returns `SystemChargeReadiness` with `chargesEnabledAtSystemLevel`, `paymentProviderConfigured`, `providerMode`, `providerModeValid`, `ready`, `blockingReasons`. |
| `checkInvoiceChargeReadiness()` | Lines 87–176 | Invoice-specific gate — calls `reconciliationService` + `validateConfiguration()`. |
| Kill-switch | `BILLING_CHARGES_ENABLED` via `process.env` (not `ConfigService`). Default: `false`. |
| Export | Exported from `AdminModule`. |

### 3.5 SubscriptionRepository and Subscription Entity

| Item | Location | Details |
|------|----------|---------|
| Entity | `services/api-gateway/src/entities/subscription.entity.ts` | 05B — LOCKED. |
| Repository | `services/api-gateway/src/billing/subscription/subscription.repository.ts` | 05B — LOCKED. |
| Module | `services/api-gateway/src/billing/subscription/subscription.module.ts` | 05B — LOCKED. |
| Entity index | `services/api-gateway/src/entities/index.ts` | Exports `Subscription`, `SUBSCRIPTION_STATUSES`, `SUBSCRIPTION_PLAN_TYPES`. |
| `AppModule` import | **NOT YET** — `SubscriptionModule` not imported into `AppModule` (deferred to consumer). |

### 3.6 User Entity and `stripe_customer_id`

| Item | Location | Details |
|------|----------|---------|
| Entity | `services/api-gateway/src/entities/user.entity.ts` | TypeORM `@Entity('users')`. |
| `stripeCustomerId` | Line 82–83 | `varchar(255)`, nullable, column name `stripe_customer_id`. |
| `planType` | Line 70–71 | `varchar(50)`, default `'free'`. |
| `planStatus` | Line 76–77 | `varchar(20)`, default `'active'`. |
| `UsersService` | `services/api-gateway/src/users/users.service.ts` | Resolves plan state via DB lookup. Has `userRepository` (standard `Repository<User>`). |

### 3.7 Auth / Session / User Identity Guards

| Guard | File | Purpose |
|-------|------|---------|
| `SessionCookieGuard` | `services/api-gateway/src/auth/session-cookie.guard.ts` | Browser session auth — reads `aisandbox_session` cookie, validates via `AuthService.validateSessionToken()`, attaches `{ userId, email, role, plan }` to `request.user`. |
| `ApiKeyAuthGuard` | `services/api-gateway/src/auth/api-key-auth.guard.ts` | API key auth — for public API endpoints. |
| `AuthorizationGuard` | `services/api-gateway/src/auth/authorization.guard.ts` | Authorization check — runs after auth guard. |
| `IdempotencyGuard` | `services/api-gateway/src/ai/idempotency.guard.ts` | AI execution idempotency — checks `Idempotency-Key` header, queries `usage_records`. Specific to AI execution flow. |
| `CreditBalanceGuard` | `services/api-gateway/src/billing/credit-balance.guard.ts` | Balance enforcement — `balance > 0`, admin bypass. On AI execution endpoints only. |
| `InternalServiceAuthGuard` | Internal service endpoints | Guards internal-only routes (e.g., finalization bridge). |

### 3.8 Existing Controller Patterns

| Controller | Path | Auth |
|------------|------|------|
| `BillingVisibilityController` | `@Controller('billing')` → `/api/billing/*` | `ApiKeyAuthGuard`, `AuthorizationGuard` — API key access only. |
| `UsersController` | `@Controller('users')` → `/api/users/*` | `SessionCookieGuard` — browser session. |
| `SessionController` | `@Controller('sessions')` → `/api/sessions/*` | `SessionCookieGuard`. |
| `AdminController` | Internal admin routes | `InternalServiceAuthGuard`. |
| `AiExecutionController` | `@Controller('ai')` → `/api/ai/*` | `SessionCookieGuard` (browser) or `ApiKeyAuthGuard` (public API). |

### 3.9 PLAN_DEFINITIONS and Price Mapping

| Item | Location | Details |
|------|----------|---------|
| `PLAN_IDS` | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` line 8 | `['free', 'starter', 'pro', 'team']`. |
| `MONTHLY_CREDIT_ALLOCATIONS` | Same file lines 14–19 | `free: 500, starter: 5000, pro: 25000, team: 100000`. |
| `PLAN_DEFINITIONS` | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | Full plan definitions with entitlements. |
| Stripe price IDs | **NOT YET CONFIGURED** — no `STRIPE_PRICE_ID_*` env keys exist. Mapping from `planId` → Stripe price ID is 05C scope. |

### 3.10 Package State

| Item | Status |
|------|--------|
| `stripe` npm package | **NOT INSTALLED** — not in `services/api-gateway/package.json`. |
| `@stripe/stripe-js` | **NOT INSTALLED** — no frontend Stripe.js either. |

### 3.11 Existing Checkout Source Code

| Item | Status |
|------|--------|
| Checkout controller | **DOES NOT EXIST** — no `checkout.controller.ts` or similar. |
| Checkout service | **DOES NOT EXIST** — no `checkout.service.ts` or similar. |
| Checkout DTOs | **DO NOT EXIST**. |
| Billing portal controller | **DOES NOT EXIST**. |
| Success/cancel pages | **DO NOT EXIST** — no frontend checkout flow. |

---

## 4. Provider-Call Boundary Decision

### 4.1 Decision: B — Test-mode-ready but no provider call in 05C Step 3

**05C creates the complete checkout/top-up controller, service, DTO, and gate infrastructure that works end-to-end in `disabled` and `stub` modes, and is structurally ready for `test`/`live` modes when the Stripe SDK is installed and Keith provides test keys.**

### 4.2 Rationale

- The 05A `StripePaymentProvider` already handles mode-aware behavior for `createCheckoutSession()` and `createOrRetrieveCustomer()`:
  - `disabled` → returns `PROVIDER_DISABLED`
  - `stub` → returns deterministic placeholder data
  - `test`/`live` → returns `PROVIDER_NOT_CONFIGURED` (until SDK is wired)
- 05C adds the **consumer layer** (controller, service, DTOs, guards, validation) that calls into the existing provider abstraction.
- No `stripe` SDK import or installation is needed for the consumer layer.
- The consumer layer validates inputs, checks `ChargeReadinessService`, resolves customers, creates checkout sessions, and returns results — all through the existing `StripePaymentProvider` interface.
- Real Stripe test-mode calls will work automatically when: (a) `stripe` package is installed, (b) `StripePaymentProvider` `test`/`live` branches are implemented with real SDK calls, (c) Keith provides test keys, and (d) `STRIPE_PROVIDER_MODE=test` is set.

### 4.3 Exact Provider-Call Rules

| Rule | Status |
|------|--------|
| No live Stripe API calls | **MANDATORY** — no `sk_live_*` calls without Keith explicit approval. |
| No test-mode Stripe API calls | **MANDATORY** — no `sk_test_*` calls without Keith providing test keys and explicit approval. |
| No Stripe SDK import in 05C source | **CONFIRMED** — 05C source calls `StripePaymentProvider` interface methods only. |
| No direct `stripe` package usage | **CONFIRMED** — 05C never imports `stripe`. |
| Stub mode behavior | Checkout service calls `StripePaymentProvider.createCheckoutSession()` → returns stub `CheckoutSessionResult`. Consumer layer returns the stub result to caller. |
| Disabled mode behavior | Checkout service calls `StripePaymentProvider.createCheckoutSession()` → returns `PROVIDER_DISABLED` error. Consumer layer returns appropriate HTTP error. |
| `ChargeReadinessService` gate | Checkout service must call `getSystemChargeReadiness()` before any provider operation. If `ready === false`, return HTTP 503 with blocking reasons (no secret leakage). |

---

## 5. Stripe SDK / Package / Env Decision

### 5.1 Stripe npm package

**Decision: NOT needed in 05C. Deferred.**

- 05C source code calls only `StripePaymentProvider` methods, which are already defined in 05A.
- The `StripePaymentProvider` handles mode-aware responses internally.
- No `import Stripe from 'stripe'` appears in any 05C file.
- SDK installation is needed only when `test`/`live` branches of `StripePaymentProvider` are implemented with real SDK calls (separate future task or 05C2 split).

### 5.2 Environment keys

**Decision: NOT needed in 05C. Deferred.**

| Key | Needed in 05C? | Rationale |
|-----|----------------|-----------|
| `STRIPE_SECRET_KEY` | NO | Only needed when `StripePaymentProvider` makes real SDK calls. 05C consumer layer does not read this key. |
| `STRIPE_PRICE_ID_STARTER` | NO | Price ID mapping uses an in-code config map (plan ID → price ID). The price ID values themselves are placeholder strings in 05C (e.g., `'price_placeholder_starter'`). Real price IDs supplied by Keith later via env. |
| `STRIPE_PRICE_ID_PRO` | NO | Same. |
| `STRIPE_PRICE_ID_TEAM` | NO | Same. |
| `STRIPE_PRICE_ID_TOPUP_*` | NO | Same — top-up pack price IDs deferred. |
| `STRIPE_PUBLISHABLE_KEY` | NO | Frontend only — deferred to 05F. |
| `STRIPE_WEBHOOK_SECRET` | NO | Webhook only — deferred to 05D. |
| `BILLING_CHARGES_ENABLED` | Already exists | `false` by default. 05C reads via `ChargeReadinessService`. No change needed. |
| `STRIPE_PROVIDER_MODE` | Already read by 05A | `StripePaymentProvider` reads this. No change needed. |

### 5.3 Whether Step 3 can proceed without package/env changes

**YES.** Step 3 can proceed without any `package.json`, `.env.example`, or env key changes. The checkout controller/service/DTO layer is fully testable with mocked `StripePaymentProvider` and `ChargeReadinessService`.

### 5.4 Whether Keith must supply Stripe test keys before implementation

**NO — not for Step 3.** Keith test keys are needed only for future test-mode validation (when `StripePaymentProvider` `test` branch makes real Stripe calls). 05C Step 3 uses mocked provider in tests.

### 5.5 Exact approval gates

| Gate | Status |
|------|--------|
| Stripe SDK/package install | **NOT APPROVED** — requires Keith explicit approval before installation. |
| Env/secrets changes | **NOT APPROVED** — requires Keith explicit approval. |
| Test-mode provider calls | **NOT APPROVED** — requires Keith test keys + explicit approval. |
| Live provider calls | **NOT APPROVED** — requires Keith live keys + explicit approval + legal/compliance. |

---

## 6. Checkout Session Scope Decision

### 6.1 Subscription checkout

**INCLUDED in 05C.** The checkout controller accepts a `planId` (`starter`, `pro`, `team`) and creates a checkout session for that subscription plan. In stub/disabled mode, returns the provider result directly. In future test/live mode, creates a real Stripe Checkout session.

### 6.2 One-time credit top-up checkout

**INCLUDED in 05C (contract only).** The checkout controller accepts a `topUpPackId` for one-time credit purchases. The same `createCheckoutSession()` flow is used with `planId` replaced by the top-up pack identifier. The exact top-up pack definitions (credit amounts, prices) are defined as a static config in 05C source (not env). Actual credit grants after payment are 05E scope.

### 6.3 Billing portal

**DEFERRED to 05F.** The billing portal session creation (`createBillingPortalSession`) is a separate endpoint that requires an existing `stripe_customer_id`. The controller contract is defined in 05C, but the endpoint implementation and frontend integration are 05F scope.

### 6.4 Whether 05C should create only contract endpoints and stub URLs

**NO — 05C creates functional endpoints.** The endpoints call through the provider abstraction and return real results (stub or disabled results per mode). They are not "contract-only" — they validate input, check gates, and call the provider.

### 6.5 Whether 05D webhook is required before real payment completion

**YES.** Real payment completion requires:
1. 05C: Checkout session created → user redirected to Stripe → Stripe processes payment.
2. 05D: Stripe sends `checkout.session.completed` webhook → 05D ingests → creates `Subscription` record → updates `users.plan_type`.

Without 05D, a successful checkout would result in payment but no subscription record. This is acceptable because:
- 05C in stub mode returns `url: null` (no real redirect).
- 05C in test/live mode (future) would redirect to Stripe, but without 05D the webhook would not be processed.
- Stripe retries webhooks for ~3 days, so 05D can be implemented after 05C without data loss.

### 6.6 Whether 05E credit grants are required before top-up completion

**YES — for real top-up completion.** Credit grants after top-up payment require:
1. 05C: Top-up checkout session created.
2. 05D: Webhook ingestion for `checkout.session.completed` (with top-up metadata).
3. 05E: Credit grant service adds credits to `credit_balances.balance`.

Without 05E, a top-up payment would be processed but credits would not be added. This is acceptable for 05C because stub mode does not process real payments.

---

## 7. API Endpoint / Controller / Service Boundary

### 7.1 Controller

| Aspect | Decision |
|--------|----------|
| File | `services/api-gateway/src/billing/checkout/checkout.controller.ts` |
| Decorator | `@Controller('billing/checkout')` → `/api/billing/checkout/*` |
| Auth guard | `@UseGuards(SessionCookieGuard)` — browser-session only. Checkout is a user-facing browser action. |
| No public API key access | Checkout must NOT be accessible via API key. Only authenticated browser sessions can create checkout sessions. |
| No admin/internal special rules | Admin users can create checkout sessions like any user. Admin bypass applies to balance gate only (04A), not checkout. |

### 7.2 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST /api/billing/checkout/subscription` | Create subscription checkout session | Accepts `planId`, `successUrl`, `cancelUrl`. Validates plan, checks gates, creates checkout session. |
| `POST /api/billing/checkout/topup` | Create credit top-up checkout session | Accepts `topUpPackId`, `successUrl`, `cancelUrl`. Validates pack, checks gates, creates checkout session. |

### 7.3 Service

| Aspect | Decision |
|--------|----------|
| File | `services/api-gateway/src/billing/checkout/checkout.service.ts` |
| Injectable | YES — `@Injectable()`. |
| Dependencies | `StripePaymentProvider`, `ChargeReadinessService`, `SubscriptionRepository`, `UserRepository` (via `TypeOrmModule.forFeature([User])`). |
| Responsibility | Input validation, gate checks, customer resolution, price/plan mapping, checkout session creation delegation, result mapping. |

### 7.4 Module wiring

| Aspect | Decision |
|--------|----------|
| File | `services/api-gateway/src/billing/checkout/checkout.module.ts` |
| Imports | `PaymentsModule`, `AdminModule` (for `ChargeReadinessService`), `SubscriptionModule`, `TypeOrmModule.forFeature([User])`, `AuthModule` (for `SessionCookieGuard` / `AuthService`). |
| Providers | `CheckoutService`. |
| Exports | `CheckoutService` (for potential future internal use). |
| `AppModule` | Must import `CheckoutModule`. |

### 7.5 Request DTOs

```typescript
interface CreateSubscriptionCheckoutDto {
  planId: string;       // 'starter' | 'pro' | 'team' — validated against PLAN_IDS
  successUrl: string;   // Validated against allowlist
  cancelUrl: string;    // Validated against allowlist
}

interface CreateTopUpCheckoutDto {
  topUpPackId: string;  // Validated against TOP_UP_PACK_IDS
  successUrl: string;   // Validated against allowlist
  cancelUrl: string;    // Validated against allowlist
}
```

### 7.6 Response DTOs

```typescript
interface CheckoutSessionResponseDto {
  sessionId: string | null;
  url: string | null;
  mode: ProviderMode;
}
```

### 7.7 Authenticated session/API guard boundary

- Checkout endpoints use `SessionCookieGuard` ONLY (browser session).
- The `request.user.userId` is used to identify the user creating the checkout.
- API key (`ApiKeyAuthGuard`) access is NOT allowed for checkout — prevents programmatic mass checkout creation.
- The controller extracts `userId` and `email` from `request.user` (set by `SessionCookieGuard`).

---

## 8. Customer Creation / Reuse Decision

### 8.1 How `users.stripe_customer_id` is read

- `CheckoutService` reads `user.stripeCustomerId` from the `User` entity via `userRepository.findOne({ where: { id: userId } })`.
- If `stripeCustomerId` is not null, it is passed to `createCheckoutSession()` as part of the customer lookup.

### 8.2 Whether customer creation is stubbed/deferred

**Customer creation is handled by `StripePaymentProvider.createOrRetrieveCustomer()`.** In 05C:
- `stub` mode: returns `{ customerId: null, isNew: false }` — no real customer created.
- `disabled` mode: returns `PROVIDER_DISABLED`.
- `test`/`live` mode: returns `PROVIDER_NOT_CONFIGURED` (until SDK is wired).

The `CheckoutService` calls `createOrRetrieveCustomer()` BEFORE `createCheckoutSession()`. If customer creation succeeds and returns a new `customerId`, the service updates `user.stripeCustomerId` in the database. In stub mode, `customerId` is `null`, so no DB update occurs.

### 8.3 How customer ID persistence from provider result would happen later

When `test`/`live` mode is wired with real SDK:
1. `createOrRetrieveCustomer()` returns `{ customerId: 'cus_xxx', isNew: true }`.
2. `CheckoutService` calls `userRepository.update({ id: userId }, { stripeCustomerId: 'cus_xxx' })`.
3. `stripeCustomerId` is now persisted for reuse.

### 8.4 Duplicate customer prevention

- The `idx_users_stripe_customer_id` unique partial index (05B migration, not yet executed) prevents two users from having the same `stripe_customer_id`.
- Application-level check: `CheckoutService` first reads `user.stripeCustomerId`. If already set, passes it to `createOrRetrieveCustomer()` for retrieval instead of creation.
- Provider-level check: In future real SDK mode, `createOrRetrieveCustomer()` should search Stripe by metadata (`userId`) before creating a new customer.

### 8.5 Behavior for users without `stripe_customer_id`

- `stripeCustomerId` is `null` (default for new users, free users, admin/beta/internal users).
- `CheckoutService` calls `createOrRetrieveCustomer({ userId, email })`.
- In stub mode: returns `null` customer ID — checkout proceeds with `null` customer.
- In future real mode: creates a new Stripe customer, returns `cus_xxx`, updates `user.stripeCustomerId`.

### 8.6 Behavior for free/admin/beta/internal users

| User type | `stripeCustomerId` | Checkout behavior |
|-----------|--------------------|--------------------|
| Free user | `NULL` | Can create checkout session for upgrade. Customer created on first checkout. |
| Admin | `NULL` or populated | Can create checkout session. Admin bypass does NOT apply to checkout (no free upgrades for admin). |
| Beta | `NULL` or populated | Can create checkout session. Same as regular user. |
| Internal test | `NULL` | Can create checkout session in stub mode. No real charges. |

---

## 9. ChargeReadinessService Gate Decision

### 9.1 Checkout must call ChargeReadinessService

**YES.** The `CheckoutService` must call `chargeReadinessService.getSystemChargeReadiness()` before delegating to the provider:
1. If `ready === false`, return HTTP 503 Service Unavailable with `{ message: 'Payment system is not available', reasons: blockingReasons }`.
2. If `ready === true`, proceed with provider call.

### 9.2 Behavior when `BILLING_CHARGES_ENABLED=false`

- `getSystemChargeReadiness()` returns `{ ready: false, blockingReasons: ['BILLING_CHARGES_ENABLED=false'] }`.
- Checkout endpoint returns HTTP 503.
- No provider call is made.

### 9.3 Behavior in disabled/stub/test/live provider modes

| `BILLING_CHARGES_ENABLED` | Provider Mode | `ChargeReadinessService.ready` | Checkout behavior |
|---------------------------|---------------|-------------------------------|-------------------|
| `false` | Any | `false` | HTTP 503 — blocked by kill-switch. |
| `true` | `disabled` | `false` | HTTP 503 — provider disabled. |
| `true` | `stub` | `true` | Checkout proceeds → returns stub result (`sessionId: 'stub_cs_placeholder', url: null`). |
| `true` | `test` | `true` (if `STRIPE_SECRET_KEY` set) | Checkout proceeds → returns `PROVIDER_NOT_CONFIGURED` (until SDK wired). |
| `true` | `live` | `true` (if `STRIPE_SECRET_KEY` set) | Checkout proceeds → returns `PROVIDER_NOT_CONFIGURED` (until SDK wired). |

### 9.4 Whether stub checkout is allowed when charges disabled

**NO.** When `BILLING_CHARGES_ENABLED=false`, the kill-switch blocks all checkout attempts regardless of provider mode. This is intentional — the kill-switch is a system-level safety control. Developers who want stub checkout must set `BILLING_CHARGES_ENABLED=true` AND `STRIPE_PROVIDER_MODE=stub`.

### 9.5 Exact error/result behavior

- Gate blocked → HTTP 503 `{ error: 'SERVICE_UNAVAILABLE', message: 'Payment system is not available' }`. Blocking reasons NOT exposed to end users (security — but available in server logs).
- Provider returns `PROVIDER_DISABLED` → HTTP 503 (same shape).
- Provider returns `PROVIDER_NOT_CONFIGURED` → HTTP 503 `{ error: 'SERVICE_UNAVAILABLE', message: 'Payment provider is not configured' }`.
- Provider returns `INVALID_PARAMS` → HTTP 400 Bad Request.
- Provider returns `PROVIDER_API_ERROR` → HTTP 502 Bad Gateway.
- Provider returns success → HTTP 201 Created with `CheckoutSessionResponseDto`.

---

## 10. Success / Cancel URL Decision

### 10.1 Where URLs come from

**Request-provided.** The `successUrl` and `cancelUrl` are provided in the POST body by the frontend. This allows the frontend to include locale, plan, and session context in the URLs.

### 10.2 Allowlist / validation requirements

| Rule | Decision |
|------|----------|
| URL format | Must be valid URL (parsed with `new URL()`). |
| Protocol | Must be `https://` in production. Allow `http://localhost:*` in development (when `NODE_ENV !== 'production'`). |
| Origin allowlist | Must match a configurable allowlist of allowed origins. Default: `[process.env.FRONTEND_URL]` (already exists in env). In stub mode, validation is relaxed (any valid URL accepted). |
| Path restrictions | No path restrictions — frontend determines the success/cancel path. |
| Query parameters | Allowed — frontend may include `?session_id={CHECKOUT_SESSION_ID}` template (Stripe standard). |
| Maximum length | 2048 characters. |

### 10.3 Locale implications for future frontend

- Success/cancel URLs should include the `[locale]` segment (e.g., `/en/billing/checkout/success`).
- 05C does not enforce locale in URLs — the frontend is responsible for constructing locale-aware URLs.
- 05F (frontend) will provide the correct locale-prefixed URLs.

### 10.4 Safe fallback behavior

- If `successUrl` or `cancelUrl` fails validation, return HTTP 400 with `{ error: 'INVALID_URL', field: 'successUrl' | 'cancelUrl' }`.
- No default fallback URL — the request must provide valid URLs. Fallback URLs risk sending users to unexpected pages.

### 10.5 No open redirect risk

- URLs are validated against an origin allowlist before being passed to the provider.
- In stub mode, the `url` field in the response is `null` (no redirect).
- In future test/live mode, the `url` field is a Stripe-hosted checkout URL (e.g., `https://checkout.stripe.com/...`), which is safe.
- The `successUrl` and `cancelUrl` are passed to Stripe, which redirects the user after checkout. Stripe validates these URLs against its own dashboard configuration.
- The allowlist prevents an attacker from setting `successUrl` to an external domain.

---

## 11. Idempotency / Duplicate Session Decision

### 11.1 Whether existing IdempotencyGuard applies

**NO.** The existing `IdempotencyGuard` is specific to AI execution — it checks `Idempotency-Key` header against `usage_records` for AI execution idempotency. It does not apply to checkout.

### 11.2 Whether checkout session requests need idempotency keys

**DEFERRED to future task.** In 05C, checkout requests are NOT idempotent:
- Each `POST /api/billing/checkout/subscription` creates a new checkout session.
- In stub mode, this is harmless (no real session created).
- In future test/live mode, Stripe checkout sessions are short-lived (~24h expiry) and creating duplicates is low-risk (user can only complete one).

### 11.3 Whether duplicate pending sessions are prevented in 05C

**DEFERRED.** Preventing duplicate pending checkout sessions (e.g., user clicks "Upgrade" twice) requires:
- Tracking pending checkout sessions in a local table (not yet created).
- Or relying on Stripe's own session management.
- This is 05F (frontend) and 05G (regression) scope.

In 05C, the service creates a new checkout session on each call. The frontend (05F) can implement client-side debouncing.

### 11.4 How idempotency relates to future webhook events

- Webhook event idempotency is 05D scope (`webhook_events.stripe_event_id` unique constraint).
- Checkout session idempotency is separate from webhook idempotency.
- A user completing the same checkout session twice is prevented by Stripe (session can only be completed once).
- Duplicate webhook delivery for the same `checkout.session.completed` event is handled by 05D idempotency.

---

## 12. Security Decision

| Security control | Decision |
|------------------|----------|
| No secret leakage | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` never in responses, logs, or error messages. Checkout service does not read these keys — provider handles them internally. |
| No user-provided price IDs | `planId` is validated against `PLAN_IDS` (`'starter'`, `'pro'`, `'team'`). The service maps `planId` → internal price config. Users cannot supply arbitrary Stripe price IDs. `topUpPackId` is validated against a static `TOP_UP_PACK_IDS` config. |
| No open redirect | `successUrl` and `cancelUrl` validated against origin allowlist. Stub mode returns `url: null`. |
| Auth required | `SessionCookieGuard` on all checkout endpoints. No unauthenticated checkout. |
| User can only create checkout for self | `userId` extracted from `request.user` (session-authenticated). Cannot create checkout for another user. |
| Price/plan allowlist | Only `PLAN_IDS` plans are accepted. `free` is excluded from subscription checkout (cannot "subscribe" to free — free is the default). |
| Provider mode/test-live mismatch protection | `StripePaymentProvider` validates key prefix against mode (05A LOCKED). `ChargeReadinessService` blocks if provider is misconfigured. |
| Audit/logging expectations | Checkout service logs: `userId`, `planId`/`topUpPackId`, `providerMode`, `success`/`error` result. No secrets in logs. No request body (contains URLs) in full — log only sanitized fields. |
| Rate limiting | Checkout endpoints should be rate-limited (e.g., 10 requests per minute per user). If existing rate-limit middleware exists at the route level, apply it. If not, add a simple guard-based limit or defer to 05G. |

---

## 13. Implementation vs Split Decision

**Decision: B — 05C can proceed as test-mode-ready but no-provider-call Step 3.**

### Rationale

The scope is well-bounded:
1. One new controller file (`CheckoutController`).
2. One new service file (`CheckoutService`).
3. One new module file (`CheckoutModule`).
4. Request/response DTOs.
5. Plan/price mapping config.
6. Top-up pack config.
7. Success/cancel URL validation.
8. `AppModule` import update.
9. Unit tests for controller, service, gate behavior, validation.

All of this uses existing infrastructure:
- `StripePaymentProvider` (05A — LOCKED).
- `ChargeReadinessService` (05A — LOCKED, from `AdminModule`).
- `SubscriptionRepository` (05B — LOCKED).
- `User` entity (existing).
- `SessionCookieGuard` (existing).
- `PLAN_DEFINITIONS` (existing).

No new dependencies. No SDK. No env changes. No migrations. No frontend.

### Why Not A (Stub-Only)

Option B is already stub-compatible AND structurally ready for test/live mode. There is no additional cost to being "test-mode-ready" since the provider abstraction handles mode switching.

### Why Not C (Real Stripe Test-Mode Calls)

Real Stripe calls require:
- `stripe` npm package installation (Keith approval required).
- `StripePaymentProvider` `test`/`live` branch implementation with real SDK calls.
- Keith test-mode API keys.
- None of these are approved for 05C.

### Why Not D (Split into 05C1/05C2)

The consumer layer (controller/service/DTO) is a single bounded scope. Splitting would create unnecessary coordination overhead. The provider layer is already complete (05A). 05C adds only the consumer layer.

### Why Not E (Pause)

No blockers exist for the consumer layer implementation. It can proceed without SDK/env/keys.

---

## 14. Exact Step 3 File Boundary

### Production Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/billing/checkout/checkout.controller.ts` | CREATE | `@Controller('billing/checkout')` — `POST subscription`, `POST topup`. `SessionCookieGuard`. |
| 2 | `services/api-gateway/src/billing/checkout/checkout.service.ts` | CREATE | Gate check, customer resolution, plan/price mapping, provider delegation. |
| 3 | `services/api-gateway/src/billing/checkout/checkout.module.ts` | CREATE | Module wiring — imports `PaymentsModule`, `AdminModule`, `SubscriptionModule`, `AuthModule`, `TypeOrmModule.forFeature([User])`. |
| 4 | `services/api-gateway/src/billing/checkout/dto/create-subscription-checkout.dto.ts` | CREATE | Request DTO with class-validator decorators. |
| 5 | `services/api-gateway/src/billing/checkout/dto/create-topup-checkout.dto.ts` | CREATE | Request DTO for top-up. |
| 6 | `services/api-gateway/src/billing/checkout/dto/checkout-session-response.dto.ts` | CREATE | Response DTO. |
| 7 | `services/api-gateway/src/billing/checkout/dto/index.ts` | CREATE | DTO barrel export. |
| 8 | `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts` | CREATE | Static plan ID → price placeholder mapping + top-up pack definitions. |
| 9 | `services/api-gateway/src/app.module.ts` | MODIFY | Import `CheckoutModule`. |

### Test Files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `services/api-gateway/src/billing/checkout/__tests__/checkout.controller.spec.ts` | CREATE | Controller endpoint tests — auth, validation, response shape. |
| 2 | `services/api-gateway/src/billing/checkout/__tests__/checkout.service.spec.ts` | CREATE | Service logic tests — gate, customer, plan validation, provider delegation. |
| 3 | `services/api-gateway/src/billing/checkout/__tests__/checkout.module.spec.ts` | CREATE | Module composition test. |
| 4 | `services/api-gateway/src/billing/checkout/__tests__/checkout-price-map.spec.ts` | CREATE | Price map validation tests — plan/pack allowlist, no unknown IDs. |

### Files NOT Changed in 05C

- No `services/api-gateway/package.json` changes (no `stripe` package).
- No `.env.example` changes.
- No `StripePaymentProvider` changes (05A LOCKED).
- No `ChargeReadinessService` changes (05A LOCKED).
- No `Subscription` entity changes (05B LOCKED).
- No `SubscriptionRepository` changes (05B LOCKED).
- No `PaymentsModule` changes (05A LOCKED).
- No migration files.
- No frontend files.
- No worker/ai-service changes.
- No `database/schema.sql` or `database/init/001_schema.sql` changes.
- No governance files changed during Step 3 implementation.

---

## 15. Test Plan

| # | Test | Type | Assertions |
|---|------|------|------------|
| 1 | Auth required — no session cookie → 401 | Unit | `SessionCookieGuard` rejects unauthenticated request. |
| 2 | Auth required — valid session → proceeds | Unit | Controller receives request with `request.user` populated. |
| 3 | `ChargeReadinessService` gate — `ready=false` → 503 | Unit | Service returns 503 when `getSystemChargeReadiness()` returns `{ ready: false }`. |
| 4 | `ChargeReadinessService` gate — `ready=true` → proceeds | Unit | Service calls provider when gate passes. |
| 5 | Provider in disabled mode → 503 | Unit | Provider returns `PROVIDER_DISABLED` → service returns 503. |
| 6 | Provider in stub mode → 201 with stub result | Unit | Provider returns stub `CheckoutSessionResult` → service returns 201. |
| 7 | Provider in test/live mode (no SDK) → 503 | Unit | Provider returns `PROVIDER_NOT_CONFIGURED` → service returns 503. |
| 8 | Subscription checkout — valid `planId` (`starter`) | Unit | Accepted, provider called with correct params. |
| 9 | Subscription checkout — valid `planId` (`pro`) | Unit | Same. |
| 10 | Subscription checkout — valid `planId` (`team`) | Unit | Same. |
| 11 | Subscription checkout — `planId` = `free` → 400 | Unit | Cannot subscribe to free plan. |
| 12 | Subscription checkout — invalid `planId` → 400 | Unit | Unknown plan ID rejected. |
| 13 | Credit top-up checkout — valid `topUpPackId` | Unit | Accepted, provider called with correct params. |
| 14 | Credit top-up checkout — invalid `topUpPackId` → 400 | Unit | Unknown pack ID rejected. |
| 15 | Plan/price allowlist — only known plan IDs accepted | Unit | Validate against `PLAN_IDS`. |
| 16 | `successUrl` validation — valid HTTPS URL | Unit | Accepted. |
| 17 | `successUrl` validation — invalid URL → 400 | Unit | Rejected. |
| 18 | `cancelUrl` validation — invalid URL → 400 | Unit | Rejected. |
| 19 | `successUrl` validation — HTTP in production → 400 | Unit | Only HTTPS allowed in production. |
| 20 | Customer reuse — user with existing `stripeCustomerId` | Unit | Passes existing customer ID to provider. |
| 21 | Customer creation — user without `stripeCustomerId` | Unit | Calls `createOrRetrieveCustomer()`, updates user if new customer returned. |
| 22 | Idempotency — duplicate requests create separate sessions | Unit | No idempotency enforcement in 05C. |
| 23 | No provider API calls in any test | Unit | Mocked `StripePaymentProvider`. No `stripe` import. No network mocks. |
| 24 | No env/package dependency | Unit | No env reads for Stripe keys. No `stripe` package import. |
| 25 | 04 balance/deduction invariants unaffected | Compile | `npx tsc --noEmit` passes. Existing credit balance, deduction, guard tests remain passing. |
| 26 | Module composition — `CheckoutModule` provides `CheckoutService` | Unit | Module metadata inspection. |
| 27 | Price map — all plan IDs have price mapping | Unit | `PLAN_IDS` except `free` are in price map. |
| 28 | Price map — no unknown plan IDs in price map | Unit | Only valid `PlanId` values. |
| 29 | User identity — `userId` from session, not request body | Unit | Controller extracts from `request.user.userId`. |
| 30 | No public API key access to checkout | Unit | Only `SessionCookieGuard` applied, not `ApiKeyAuthGuard`. |

### Test Non-Goals

- No Stripe SDK mock tests (SDK not installed in 05C).
- No integration tests requiring DB, Docker, Redis.
- No webhook tests (05D).
- No credit grant tests (05E).
- No frontend/browser tests (05F).
- No real checkout session creation tests.
- No real payment validation.

---

## 16. Runtime / Provider Validation Decision

| Constraint | Status |
|-----------|--------|
| Docker/PostgreSQL/Redis required for Step 3 | **NO** — 05C is controller/service/DTO creation + unit tests. All dependencies mocked. |
| Stripe/payment/provider API calls | **NONE** — no `stripe` package. No SDK. No network calls. Mocked provider in tests. |
| Live/test-mode provider validation | **NONE** — deferred until Keith provides keys and approves test-mode validation. |
| Browser smoke | **NONE** — no frontend changes. |
| AGENT-HARNESS write canary | **NONE** — remains a separate track. |
| Migrations | **NONE** — no new migrations. 05B migrations remain not executed. |
| Runtime commands for validation | `npx tsc --noEmit` and `npm test` (targeted suites) only. |
| If future test-mode validation is needed | Requires explicit Keith approval, Stripe test keys, and likely `stripe` package installation. |

---

## 17. UX/UI Constraints

| Constraint | Status |
|-----------|--------|
| UI implementation in 05C | **NONE** — no frontend changes. |
| Translation key updates | **NONE** — no user-facing text added. |
| Heroicons v2 Outline only | N/A — no UI. |
| Impeccable / Emil Kowalski advisory only | N/A — no UI. |
| Future UI implications | If future billing checkout UI is added (05F), translation keys must be updated in `en.json`, `zh-TW.json`, `zh-CN.json` per multilingual-first rule. |
| Success/cancel pages | **DEFERRED to 05F** — no frontend success/cancel page created in 05C. |

---

## 18. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Accidental live provider call | HIGH | No `stripe` package installed. No SDK import. Provider returns `PROVIDER_NOT_CONFIGURED` for `test`/`live` modes. `ChargeReadinessService` gate blocks when not ready. Double-gate safety. |
| 2 | Test/live key mismatch | HIGH | Provider validates key prefix against mode (05A LOCKED). Mismatch → degrades to `disabled`. Not applicable in 05C (no keys). |
| 3 | Open redirect via success/cancel URL | HIGH | URL validated against origin allowlist. Only allowed origins accepted. HTTPS enforced in production. Stub mode returns `url: null`. |
| 4 | User-supplied price ID injection | HIGH | Users supply `planId` (validated against `PLAN_IDS`) or `topUpPackId` (validated against static config). Price IDs are server-side only, never from user input. |
| 5 | Idempotency / duplicate session | MEDIUM | Deferred to 05F/05G. In 05C, each request creates a new checkout session. Stub mode creates no real sessions. Low risk in stub mode. |
| 6 | Customer duplication | MEDIUM | Application-level check: read `user.stripeCustomerId` before calling `createOrRetrieveCustomer()`. DB unique index (05B migration) prevents duplicates at DB level. In stub mode, `customerId` is `null` — no DB update. |
| 7 | Webhook / payment-completion gap | MEDIUM | Without 05D, a real payment would not create a subscription record. Acceptable because: (a) 05C runs in stub mode (no real payments), (b) Stripe retries webhooks for ~3 days. |
| 8 | Credit top-up without credit grant | MEDIUM | Without 05E, a real top-up payment would not add credits. Acceptable because: (a) 05C runs in stub mode, (b) grant logic is 05E scope. |
| 9 | Env/package approval | LOW | No env or package changes in 05C. Approval deferred to when SDK is needed. |
| 10 | Test false-confidence | MEDIUM | Tests use mocked provider — validate controller/service/gate logic, not real Stripe behavior. Real Stripe behavior tested when SDK is installed and Keith provides keys. |
| 11 | `ChargeReadinessService` env read pattern | LOW | `ChargeReadinessService` reads `BILLING_CHARGES_ENABLED` via `process.env` (not `ConfigService`). Existing behavior preserved. |
| 12 | `AdminModule` circular dependency risk | LOW | `CheckoutModule` imports `AdminModule` (for `ChargeReadinessService`). `AdminModule` does not import `CheckoutModule`. No circular dependency. |
| 13 | `AppModule` import order | LOW | `CheckoutModule` must be imported after `AuthModule` and `PaymentsModule` in `AppModule`. Standard NestJS module ordering. |
| 14 | Subscription already active for user | MEDIUM | If user already has an active subscription and tries to create a subscription checkout, the service should check `SubscriptionRepository.findActiveByUserId()` and return HTTP 409 Conflict. Prevents double-subscription. |
| 15 | `SubscriptionModule` not yet in `AppModule` | LOW | 05B deferred `SubscriptionModule` import to consumer. 05C's `CheckoutModule` imports `SubscriptionModule` directly — no `AppModule` import of `SubscriptionModule` needed (NestJS module scoping). |

---

## 19. Step 3 Readiness Conclusion

| Criterion | Status |
|-----------|--------|
| Ready for Step 3? | **YES** — scope is well-bounded: `CheckoutController`, `CheckoutService`, `CheckoutModule`, DTOs, price map config, URL validation, gate integration, `AppModule` update, unit tests. |
| Further split required? | **NO** — single bounded Step 3 is sufficient. Consumer layer only — no SDK, no provider changes, no env changes. |
| Package/env/provider-call approval needed? | **NO** — not for Step 3 consumer layer. Approval needed only for future SDK installation and test-mode validation. |
| Recommended model | **GPT-5.3 Codex High** — checkout controller with auth guards, financial safety gates, URL validation, and security-adjacent input validation. Not routine (security boundary + gate integration). |
| Exact next prompt type | **Implementation prompt** — 05C Step 3 bounded implementation with exact file boundary from Section 14. |

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
| No AGENT-HARNESS write canary involvement | **CONFIRMED** |
| No child slices registered (05D/05E/05F/05G) | **CONFIRMED** |
| No env keys added | **CONFIRMED** |
| No package dependencies added | **CONFIRMED** |
| No secrets or placeholder secrets added | **CONFIRMED** |
| No checkout/session source code created | **CONFIRMED** |

---

## 21. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05C-CHECKOUT-CREDIT-TOP-UP-READINESS.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task/child-slice confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, current active task |
| 4 | `docs/BILLING-READY-05B-CHECKPOINT.md` | 05B completion record — customer/subscription persistence LOCKED |
| 5 | `docs/BILLING-READY-05B-CUSTOMER-SUBSCRIPTION-PERSISTENCE-READINESS.md` | 05B Step 2 readiness review — source-of-truth for 05B decisions |
| 6 | `docs/BILLING-READY-05A-CHECKPOINT.md` | 05A completion record — provider contracts LOCKED |
| 7 | `docs/BILLING-READY-05A-PROVIDER-CONTRACTS-READINESS.md` | 05A Step 2 readiness review |
| 8 | `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent 05 Step 2 readiness review — Stripe selection, split decision |
| 9 | `docs/BILLING-READY-04-CHECKPOINT.md` | Predecessor parent checkpoint — COMPLETE and LOCKED |
| 10 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Provider contracts (05A LOCKED) |
| 11 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Mode-aware Stripe provider (05A LOCKED) |
| 12 | `services/api-gateway/src/payments/payments.module.ts` | Payments module |
| 13 | `services/api-gateway/src/admin/charge-readiness.service.ts` | Financial kill-switch gate |
| 14 | `services/api-gateway/src/admin/admin.module.ts` | Admin module — exports ChargeReadinessService |
| 15 | `services/api-gateway/src/entities/subscription.entity.ts` | Subscription entity (05B LOCKED) |
| 16 | `services/api-gateway/src/billing/subscription/subscription.repository.ts` | Subscription repository (05B LOCKED) |
| 17 | `services/api-gateway/src/billing/subscription/subscription.module.ts` | Subscription module (05B LOCKED) |
| 18 | `services/api-gateway/src/entities/user.entity.ts` | User entity — `stripeCustomerId` column |
| 19 | `services/api-gateway/src/entities/index.ts` | Entity index exports |
| 20 | `services/api-gateway/src/auth/session-cookie.guard.ts` | Browser session auth guard |
| 21 | `services/api-gateway/src/ai/idempotency.guard.ts` | AI execution idempotency guard |
| 22 | `services/api-gateway/src/billing/credit-balance.guard.ts` | Credit balance enforcement guard (04A) |
| 23 | `services/api-gateway/src/billing/billing.module.ts` | Billing module — BillingSnapshot only |
| 24 | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | Plan definitions (free/starter/pro/team) |
| 25 | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | Plan type definitions, MONTHLY_CREDIT_ALLOCATIONS |
| 26 | `services/api-gateway/src/billing-visibility/billing-visibility.controller.ts` | Existing billing controller pattern |
| 27 | `services/api-gateway/src/users/users.service.ts` | User service — plan state resolution |
| 28 | `services/api-gateway/package.json` | API Gateway dependencies — no `stripe` package |

---

## 22. Summary

BILLING-READY-05C Step 2 checkout / credit top-up readiness review is **COMPLETE**. Key decisions:

1. **Provider-call boundary**: Option B — test-mode-ready but no provider call. Consumer layer (controller/service/DTOs) calls existing `StripePaymentProvider` interface. Works in `disabled`/`stub` modes. Ready for `test`/`live` when SDK is installed.
2. **Stripe SDK/package**: NOT needed in 05C. Consumer layer does not import `stripe`. Deferred.
3. **Env/secrets**: NOT needed in 05C. No new env keys. `BILLING_CHARGES_ENABLED` and `STRIPE_PROVIDER_MODE` already exist.
4. **Checkout scope**: Subscription checkout (`POST /api/billing/checkout/subscription`) and credit top-up checkout (`POST /api/billing/checkout/topup`) both included. Billing portal deferred to 05F.
5. **Auth**: `SessionCookieGuard` only — browser-session access. No API key access to checkout.
6. **Customer creation**: Delegated to `createOrRetrieveCustomer()`. Stub mode returns `null`. Customer ID persisted when real mode returns a value.
7. **ChargeReadinessService gate**: Mandatory before provider call. Blocks when `BILLING_CHARGES_ENABLED=false` or provider disabled/not configured.
8. **Success/cancel URLs**: Request-provided, validated against origin allowlist. No open redirect.
9. **Idempotency**: Deferred — each request creates a new session. Low risk in stub mode.
10. **Security**: Auth required, plan/price allowlist, no user-supplied price IDs, no secret leakage, no open redirect.
11. **Implementation**: Single bounded Step 3 — no further split needed. No SDK/env/package changes.
12. **Model**: GPT-5.3 Codex High — security-adjacent with gate integration.
13. **Zero source/env/package/governance/migration changes** in this Step 2 review.
