# BILLING-READY-07 Step 2 — Authenticated Billing Smoke Preflight / Readiness and Exact Safety Plan

**Task ID:** BILLING-READY-07  
**Step:** 2 — Preflight / Readiness and Exact Safety Plan  
**Parent Task:** BILLING-READY-07 — Authenticated Billing Data Smoke  
**Status:** Step 2 COMPLETE  
**Date:** 2026-07-17  
**Nature:** Static read-only preflight — no execution, no implementation, no runtime commands

---

## 1. Task Identity and Status

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-07 |
| Name | Authenticated Billing Data Smoke |
| Family | BILLING READY / AUTHENTICATED BILLING DATA / LOCAL AUTH SESSION / FRONTEND BROWSER SMOKE / PROVIDER SAFETY |
| Risk | HIGH — 4-step loop |
| Step 1 Status | COMPLETE (Registration — 2026-07-17) |
| Step 2 Status | COMPLETE (this document) |
| Step 3 Status | NOT STARTED — awaiting Step 2 sign-off and Keith approval |
| Step 4 Status | NOT STARTED |
| Keith Approval | Keith approved BILLING-READY-07 registration 2026-07-17; Keith approved proceeding to Step 2 after registration completed successfully |

---

## 2. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-07 ACTIVE — Step 1 COMPLETE (Registration — 2026-07-17) | **CONFIRMED** |
| BILLING-READY-06 COMPLETE and LOCKED (2026-07-17) | **CONFIRMED** |
| BILLING-READY-06A COMPLETE and LOCKED (2026-07-16) | **CONFIRMED** |
| BILLING-READY-06B COMPLETE and LOCKED (2026-07-17) | **CONFIRMED** |
| BILLING-READY-05 / 05A–05G COMPLETE and LOCKED | **CONFIRMED** |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** |
| AGENT-PLATFORM-00 through 07F3 COMPLETE and LOCKED | **CONFIRMED** |
| AGENT-HARNESS through AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-07 is ACTIVE |
| AGENT-HARNESS write canary remains separate | **CONFIRMED** — not registered, not part of BILLING-READY-07 |

---

## 3. Historical BILLING-READY-07 Naming Verification

**Verification required**: Historical BILLING-READY-00 audit documents proposed `BILLING-READY-07` as "Overage and Soft-Stop Logic."

**Result: NO CONFLICT. SAFE TO PROCEED.**

Evidence gathered from `TASKS.md` and `TASKS_BACKLOG_FULL.md`:

- Both files contain a single BILLING-READY-07 entry.
- That entry is titled **"Authenticated Billing Data Smoke"**, registered 2026-07-17.
- Both files contain an explicit **Naming note** that reads:
  > *"Historical BILLING-READY-00 audit docs proposed `BILLING-READY-07` as 'Overage and Soft-Stop Logic.' That overage/soft-stop scope was never registered as an active task in `TASKS.md` / `TASKS_BACKLOG_FULL.md`. This registration reuses the ID for Authenticated Billing Data Smoke..."*
- The historical "Overage and Soft-Stop Logic" scope was a **proposal/reference only** — it was never registered, never activated, never marked ACTIVE, COMPLETE, or LOCKED in any governance file.
- The new "Authenticated Billing Data Smoke" registration is the **only authoritative registered BILLING-READY-07 entry**.
- BILLING-READY-06 / 06A / 06B remain COMPLETE and LOCKED — not reopened.

**Conclusion**: No previously registered, locked, or active BILLING-READY-07 task exists under any other scope. The registered authenticated billing smoke is the sole authoritative BILLING-READY-07 task. No conflict. Step 2 may continue.

---

## 4. Files Inspected

### Governance Documents (read-only)

| File | Purpose |
|------|---------|
| `TASKS.md` | Active execution ledger — BILLING-READY-07 entry (grep) |
| `TASKS_BACKLOG_FULL.md` | Authoritative backlog — BILLING-READY-07 entry (grep) |
| `docs/BILLING-READY-06B-CHECKPOINT.md` | 06B complete checkpoint — prior smoke findings |
| `docs/BILLING-READY-06-CHECKPOINT.md` | 06 parent checkpoint — prior smoke summary |
| `docs/BILLING-READY-06B-BACKEND-BROWSER-SMOKE-PREFLIGHT.md` | 06B preflight — runtime setup reference |

### Application Source (read-only)

| File | Purpose |
|------|---------|
| `services/api-gateway/src/auth/auth.controller.ts` | Auth endpoints, session cookie setter, login/register/logout |
| `services/api-gateway/src/auth/auth.service.ts` | Auth business logic — login, register, session validation |
| `services/api-gateway/src/auth/session-cookie.guard.ts` | Session guard — cookie name and validation flow |
| `services/api-gateway/src/email/email.module.ts` | Email provider factory — stub vs resend selection |
| `services/api-gateway/src/email/stub-email.provider.ts` | Stub email provider — confirmed no-op |
| `services/api-gateway/src/billing/billing-read.controller.ts` | Billing read endpoints — balance and subscription |
| `services/api-gateway/src/billing/billing-read.module.ts` | Billing read module — imports and guards |
| `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Balance repo — findByOwner behavior |
| `services/api-gateway/src/billing/subscription/subscription.repository.ts` | Subscription repo — findActiveByUserId behavior |
| `services/api-gateway/src/billing/checkout/checkout.controller.ts` | Checkout endpoints — guarded by SessionCookieGuard |
| `services/api-gateway/src/billing/checkout/checkout.service.ts` | Checkout service — ChargeReadinessService gate |
| `services/api-gateway/src/admin/charge-readiness.service.ts` | Charge readiness gate — BILLING_CHARGES_ENABLED check |
| `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Stripe provider — disabled/stub mode behavior |
| `services/api-gateway/src/entities/user.entity.ts` | User entity — fields, isActive, emailVerified |
| `services/api-gateway/src/entities/credit-balance.entity.ts` | CreditBalance entity — fields, nullable |
| `services/api-gateway/src/entities/subscription.entity.ts` | Subscription entity — status enum |
| `services/api-gateway/src/entities/auth-session.entity.ts` | AuthSession entity — fields, TTL |
| `frontend/app/[locale]/billing/page.tsx` | Billing route — delegates to BillingPageClient |
| `frontend/components/billing/billing-page-client.tsx` | Main billing UI — all UI states and handlers |
| `frontend/components/billing/billing-balance-card.tsx` | Balance card component |
| `frontend/components/billing/billing-subscription-card.tsx` | Subscription card component |
| `frontend/components/billing/billing-topup-section.tsx` | Top-up section — topup checkout buttons |
| `frontend/components/billing/__tests__/billing-page-client.test.tsx` | Frontend billing tests |
| `frontend/hooks/useBillingData.ts` | Billing data hook — fetch pattern |
| `frontend/hooks/useTranslations.ts` | Translation hook — namespace pattern |
| `frontend/app/[locale]/login/page.tsx` | Login page — login form and redirect |
| `frontend/app/[locale]/register/page.tsx` | Register page — registration form |
| `frontend/messages/en.json` | English translation file (billing section) |
| `frontend/messages/zh-TW.json` | Traditional Chinese translation file (billing section) |
| `frontend/messages/zh-CN.json` | Simplified Chinese translation file (billing section) |
| `frontend/next.config.js` | Next.js config — API proxy rewrite rule |
| `services/api-gateway/package.json` | API Gateway scripts — dev, migration |
| `frontend/package.json` | Frontend scripts — dev port 3002 |
| `docker-compose.yml` | Docker service definitions — postgres, redis, prometheus, grafana |

---

## 5. Authentication/Session Architecture

### Auth Controller Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/auth/register` | POST | Email/password registration — creates user, sends verification email (stub = no-op) |
| `POST /api/auth/login` | POST | Email/password login — validates credentials, sets session cookie |
| `GET /api/auth/me` | GET | Authenticated user info — requires SessionCookieGuard |
| `POST /api/auth/logout` | POST | Revoke session, clear cookie — requires SessionCookieGuard + CsrfGuard |
| `GET /api/auth/email/verify` | GET | Email verification token consumption |
| `GET /api/auth/google` | GET | Google OAuth initiation (not needed for smoke) |
| `GET /api/auth/apple` | GET | Apple OAuth initiation (not needed for smoke) |

### Session Cookie

| Attribute | Value |
|-----------|-------|
| Cookie name | `aisandbox_session` |
| HttpOnly | `true` |
| Secure | `false` (in non-production = local dev) |
| SameSite | `lax` |
| Path | `/` |
| MaxAge | 7 days (604,800,000 ms) |
| Domain | Not set (defaults to `localhost`) |
| Token storage | Raw token returned to browser; SHA-256 hash stored in DB (`auth_sessions.session_token_hash`) |

### Session Guard (`SessionCookieGuard`)

File: `services/api-gateway/src/auth/session-cookie.guard.ts`

- Reads `request.cookies?.aisandbox_session`
- Calls `authService.validateSessionToken(rawToken)`
- Checks: session exists + not revoked + not expired + user.isActive
- Attaches `request.user = { userId, email, role, plan }` on success
- Throws `UnauthorizedException` (401) on any failure

### Login Flow (source-verified)

```
AuthController.login()
  → AuthService.validateUser(email, password, lang)
      → userRepository.findOne({ email, isActive: true })
      → bcrypt.compare(password, user.passwordHash)
      → NO emailVerified check (confirmed in source)
  → AuthService.createSession(userId)
      → generates raw token (32 bytes, base64url)
      → stores SHA-256 hash in auth_sessions table
      → returns raw token
  → setSessionCookie(response, rawToken)
      → response.cookie('aisandbox_session', rawToken, { httpOnly: true, sameSite: 'lax', ... })
  → returns { user: { id, email, role, plan_type } }
```

### Registration Flow (source-verified)

```
AuthController.register()
  → AuthService.register(email, password, locale)
      → checks no existing user
      → bcrypt.hash(password, 12)
      → creates user: { isActive: true, emailVerified: false, authProvider: 'email', planType: 'free' }
      → generates email verification token
      → calls sendVerificationEmail (stub mode = no-op, APP_BASE_URL used for URL construction but stub discards it)
  → returns { message, user: { id, email, role, plan_type } }
  → does NOT auto-login
  → does NOT set session cookie
```

### CSRF Handling

- `CsrfGuard` is present on `POST /api/auth/logout` only
- No CSRF protection on `POST /api/auth/login` or `POST /api/auth/register`
- Login and registration do not require CSRF tokens
- Logout requires the CSRF token; the frontend must include it if logging out during smoke

---

## 6. Exact Supported Local Login Strategy

**Strategy: Normal email/password registration followed by normal login.**

### Rationale

1. Registration creates a user with `isActive: true` and `emailVerified: false`
2. Login does NOT check `emailVerified` (confirmed in `AuthService.validateUser` source)
3. Email provider is stub in local dev (EMAIL_PROVIDER defaults to 'stub') — verification email is a no-op
4. APP_BASE_URL is confirmed set in the local env (API Gateway started successfully in 06B)
5. No CAPTCHA, no SMS, no external authentication services required
6. No development-only bypass required

### Step-by-step (for Step 3 guidance)

1. Ensure API Gateway and frontend are running
2. Navigate to `http://localhost:3002/en/register`
3. Register with a test email address (e.g. `smoke-test-07@local.test`)
4. Choose a test password (minimum 6 characters)
5. Registration success message will appear — user is created in local DB
6. Navigate to `http://localhost:3002/en/login`
7. Login with the same credentials
8. Browser receives `aisandbox_session` httpOnly cookie
9. Redirect to `http://localhost:3002/en/app` confirms login succeeded
10. Navigate back to billing page to start smoke

### Proof of No Email Verification Barrier

Source evidence — `services/api-gateway/src/auth/auth.service.ts`, `validateUser()`:

```typescript
async validateUser(email: string, password: string, lang: string = 'en'): Promise<any> {
  const user = await this.userRepository.findOne({
    where: { email, isActive: true },
  });
  // ...
  // Only checks: user exists, isActive, authProvider === 'email', passwordHash set, password matches
  // NO emailVerified check
```

### Alternative: Reuse existing local user from prior sessions

If a local user already exists from prior development sessions (e.g. created during earlier debugging), login directly without registration. The registration step is only required if no suitable local user exists.

---

## 7. Credential and Secret Handling

- **Credentials must NOT be pasted into chat, commands, or any document.**
- Keith manages test credentials locally.
- The agent does not open, read, or print any `.env` file.
- The `aisandbox_session` cookie is httpOnly — it cannot be read by JavaScript and must not be extracted or printed.
- No CSRF token is needed for login or registration.
- Logout requires CSRF guard — Keith should log out via the browser UI or the frontend's logout mechanism, not via a raw API call, unless the frontend already handles CSRF token injection.

---

## 8. Authenticated Frontend Request Flow

The frontend proxies all `/api/*` requests through Next.js rewrites to the API Gateway.

Configuration: `frontend/next.config.js`

```javascript
async rewrites() {
  const apiBase = process.env.API_GATEWAY_URL || 'http://localhost:4000';
  return [
    {
      source: '/api/:path*',
      destination: `${apiBase}/api/:path*`,
    },
  ];
}
```

**Cookie forwarding path:**

1. Login: browser POSTs to `http://localhost:3002/api/auth/login` → Next.js proxies to `http://localhost:4000/api/auth/login` → API Gateway sets `Set-Cookie: aisandbox_session=...` → response forwarded back through Next.js → browser stores cookie for `localhost` domain
2. Billing fetch: browser GETs `http://localhost:3002/api/billing/balance` with `Cookie: aisandbox_session=...` → Next.js proxy forwards cookie to `http://localhost:4000/api/billing/balance` → API Gateway validates session → returns billing data

The `aisandbox_session` cookie is set on `localhost` with no port restriction. Both port 3002 (frontend) and port 4000 (API Gateway) share the same `localhost` domain for cookie purposes.

All billing fetch calls use `credentials: 'include'` explicitly:

```typescript
// useBillingData.ts
const [balanceRes, subscriptionRes] = await Promise.all([
  fetch('/api/billing/balance', { credentials: 'include' }),
  fetch('/api/billing/subscription', { credentials: 'include' }),
]);
```

---

## 9. Billing API Read-Path Analysis

### Endpoints

| Endpoint | Guard | Method | No-Provider Proof |
|----------|-------|--------|-------------------|
| `GET /api/billing/balance` | `SessionCookieGuard` only | DB read | `CreditBalanceRepository.findByOwner()` — TypeORM query, no provider call |
| `GET /api/billing/subscription` | `SessionCookieGuard` only | DB read | `SubscriptionRepository.findActiveByUserId()` — TypeORM query, no provider call |

### Response Shapes

**Balance (missing balance row — expected for new local user):**
```json
{
  "balance": 0,
  "monthlyAllocation": 0,
  "planId": "free",
  "periodStart": null,
  "periodEnd": null,
  "status": "active"
}
```

**Subscription (no subscription row — expected for new local user):**
```json
null
```

### Source Evidence — No Provider Calls on Read

File: `services/api-gateway/src/billing/billing-read.controller.ts`

```typescript
@Controller('billing')
@UseGuards(SessionCookieGuard)
export class BillingReadController {
  constructor(
    private readonly creditBalanceRepository: CreditBalanceRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}
  // No payment provider injected. No StripePaymentProvider. No ChargeReadinessService.
```

The `BillingReadController` has no payment provider dependency. It queries only local DB repositories.

### Safe Default Behavior (confirmed in tests)

`billing-read.controller.spec.ts` test: "should return empty/free-state when no balance record exists":
- `findByOwner` returns `null` → response is `{ balance: 0, monthlyAllocation: 0, planId: 'free', ... }`
- `findActiveByUserId` returns `null` → response is `null`
- Frontend handles `null` subscription gracefully (shows free plan state)

---

## 10. Provider/Payment Safety Proof

### Kill Switch — BILLING_CHARGES_ENABLED

| Source | Location | Value | Effect |
|--------|----------|-------|--------|
| `ChargeReadinessService` | `services/api-gateway/src/admin/charge-readiness.service.ts` | `process.env.BILLING_CHARGES_ENABLED === 'true' ? true : false` | Any value other than `'true'` → charges disabled |
| 06B startup log | Confirmed in BILLING-READY-06B-CHECKPOINT.md | `BILLING_CHARGES_ENABLED=false` | Confirmed false in local env |

**Mechanism**: `getSystemChargeReadiness()` returns `{ ready: false, blockingReasons: ['BILLING_CHARGES_ENABLED=false', ...] }`. `CheckoutService.assertSystemReady()` throws `ServiceUnavailableException` (503) before any provider call.

### Provider Mode — STRIPE_PROVIDER_MODE

| Source | Location | Value | Effect |
|--------|----------|-------|--------|
| `StripePaymentProvider` | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | `STRIPE_PROVIDER_MODE` blank/unset → `'disabled'` | All operations return `PROVIDER_DISABLED` result |
| 06B startup log | Confirmed in BILLING-READY-06B-CHECKPOINT.md | `Provider mode resolved: disabled` | Confirmed disabled in local env |

**Mechanism in disabled mode**: `createCheckoutSession()` returns `disabledResult()` immediately — no Stripe SDK, no HTTP calls, no API interaction. `validateConfiguration()` returns `false`.

### Safety Table

| Risk | Safeguard | Source Evidence |
|------|-----------|----------------|
| Stripe API calls on page load | Billing read endpoints use only DB repositories — no provider injected | `billing-read.controller.ts` constructor has no payment provider |
| Checkout session creation | `assertSystemReady()` throws 503 before any provider call | `checkout.service.ts` lines 149–161 |
| Customer portal session creation | Customer portal is a permanently disabled `<button disabled>` — no click handler, no API call | `billing-page-client.tsx` lines 236–246 |
| Query param `?checkout=success` triggering API call | Banner is pure client-side state: `useState` initializer reads URL params and sets local React state — zero network requests | `billing-page-client.tsx` lines 25–32 |
| Query param `?checkout=cancelled` triggering API call | Same as above | `billing-page-client.tsx` line 30 |
| External Stripe navigation | No `checkoutUrl` is returned in disabled mode; `StripePaymentProvider.createCheckoutSession()` returns `PROVIDER_DISABLED` which maps to 503 before any redirect | `checkout.service.ts` lines 225–231 |
| Webhook routes called | Webhook routes are separate endpoints not visited during billing page smoke | Not applicable to this scope |

**Conclusion: Authenticated billing page load (balance + subscription reads) and query-banner display are provably provider-call-free.**

**EXCEPTION — Checkout buttons (upgrade plan + top-up packs):**

The billing page renders enabled checkout buttons for free users:
- Three "Upgrade to {Plan}" buttons (starter, pro, team)
- Three "Buy N Credits" top-up buttons

Clicking any of these would trigger `POST /api/billing/checkout/subscription` or `POST /api/billing/checkout/topup`. These POSTs:
- Are blocked by `assertSystemReady()` → 503 (no charges, no Stripe call)
- But ARE POST requests to write-path endpoints

These buttons are enabled in the UI (`disabled={checkoutDisabled}` where `checkoutDisabled = !!checkoutLoading`, and `checkoutLoading` starts as `null`).

**Stop condition for Step 3: Keith must NOT click any upgrade or top-up button. These are outside the approved smoke scope.**

---

## 11. Billing Frontend Behaviour

### Component File Map

| Component | File | Routes |
|-----------|------|--------|
| Billing route shell | `frontend/app/[locale]/billing/page.tsx` | `/en/billing`, `/zh-TW/billing`, `/zh-CN/billing` |
| Main UI logic | `frontend/components/billing/billing-page-client.tsx` | All billing routes |
| Balance card | `frontend/components/billing/billing-balance-card.tsx` | Embedded in page |
| Subscription card | `frontend/components/billing/billing-subscription-card.tsx` | Embedded in page |
| Top-up section | `frontend/components/billing/billing-topup-section.tsx` | Embedded in page |
| Billing data hook | `frontend/hooks/useBillingData.ts` | Used by BillingPageClient |

### Page Load Sequence (authenticated)

1. `BillingPageClient` renders with `loading: true` → shows skeleton placeholder
2. `useBillingData` fires parallel fetch to `/api/billing/balance` and `/api/billing/subscription`
3. Both return 200 with data (or safe defaults)
4. `BillingPageClient` re-renders with data
5. Query params parsed from `window.location.search` (synchronous, no network)
6. Final rendered state: balance card + subscription card + upgrade section (if free) + top-up section + customer portal card

### Loading State

Renders animated skeleton (`animate-pulse` divs) — no translation key, pure visual

### Error State

Renders `ExclamationTriangleIcon` + `t('loadError')` + `t('retry')` button — fully translated

### Empty/No-Subscription State (expected for new test user)

- `BillingSubscriptionCard` with `subscription = null` shows `planFree` label + `statusActive` badge + `freeCreditsNote` text
- `BillingBalanceCard` with `balance = null` shows `balance: 0` and `monthlyAllocation: 0`
- `isFreeUser = true` → upgrade section is visible

### Checkout Buttons (enabled — STOP CONDITION)

The upgrade section renders for free users: three enabled `<button>` elements for starter/pro/team plans. Three top-up buttons in the top-up section are also enabled. **Keith must not click these.**

### Customer Portal Card

```tsx
{/* Customer Portal — disabled/coming-soon */}
<div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
  <h2 className="text-sm font-medium text-gray-600 mb-2">{t('manageSubscription')}</h2>
  <p className="text-xs text-gray-400 mb-3">{t('manageSubscriptionComingSoon')}</p>
  <button
    type="button"
    disabled
    className="rounded-md border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
  >
    {t('manageSubscription')}
  </button>
</div>
```

- Button has `disabled` attribute — cannot be clicked
- No `onClick` handler
- Label uses `t('manageSubscription')` — translated
- Coming-soon note uses `t('manageSubscriptionComingSoon')` — translated
- **Conclusion: Customer portal button cannot trigger any API call**

---

## 12. Query-Banner Behaviour

### Expected Query Parameters

| Parameter | Value | Banner |
|-----------|-------|--------|
| `?checkout=success` | `success` | Green success banner: `t('checkoutSuccess')` |
| `?checkout=cancelled` | `cancelled` | Yellow cancelled banner: `t('checkoutCancelled')` |

**Note**: The code checks for `'cancelled'` (not `'cancel'` or `'canceled'`).

Source (`billing-page-client.tsx` lines 26–31):
```typescript
const result = params.get('checkout');
if (result === 'success') setCheckoutResult('success');
else if (result === 'cancelled') setCheckoutResult('cancelled');
```

The `cancelUrl` for checkout is built as:
```typescript
cancelUrl: `${origin}/${locale}/billing?checkout=cancelled`,
```

So the URL to use for cancel banner testing is `?checkout=cancelled`.

### Network Safety of Query Banners

The banner display mechanism is **pure client-side state with zero network requests**:

1. On mount, `useState` initializer reads `window.location.search`
2. Sets `checkoutResult` state to `'success'` or `'cancelled'`
3. Component renders the appropriate banner div
4. No `useEffect`, no `fetch`, no API call triggered by query params

Manually navigating to `http://localhost:3002/en/billing?checkout=success` will:
- Load the billing page (triggering the normal balance/subscription fetch)
- Set the success banner state
- Render the green success banner alongside the normal billing data

No Stripe API call, no checkout session creation, no provider contact occurs.

### zh-TW and zh-CN Banner Testing

The same query parameters work for all locales:
- `http://localhost:3002/zh-TW/billing?checkout=success` → `t('checkoutSuccess')` renders in Traditional Chinese
- `http://localhost:3002/zh-TW/billing?checkout=cancelled` → `t('checkoutCancelled')` renders in Traditional Chinese
- `http://localhost:3002/zh-CN/billing?checkout=success` → `t('checkoutSuccess')` renders in Simplified Chinese
- `http://localhost:3002/zh-CN/billing?checkout=cancelled` → `t('checkoutCancelled')` renders in Simplified Chinese

Banner checks on zh-TW and zh-CN are recommended to verify multilingual-first completeness.

---

## 13. Customer Portal Disabled/Stub Behaviour

### Source Evidence

File: `frontend/components/billing/billing-page-client.tsx`, lines 236–246:

```tsx
<div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
  <h2 className="text-sm font-medium text-gray-600 mb-2">{t('manageSubscription')}</h2>
  <p className="text-xs text-gray-400 mb-3">{t('manageSubscriptionComingSoon')}</p>
  <button
    type="button"
    disabled
    className="... cursor-not-allowed"
  >
    {t('manageSubscription')}
  </button>
</div>
```

### Behaviour Summary

| Check | Finding |
|-------|---------|
| Button rendered in authenticated state | YES — always rendered |
| Button disabled | YES — hardcoded `disabled` attribute, no condition |
| Click handler | NONE — no `onClick` prop |
| API call possible | IMPOSSIBLE — disabled button cannot be clicked, no handler |
| Customer portal endpoint on backend | NOT FOUND — no `POST /api/billing/portal` endpoint exists in current source |
| Translation | YES — `t('manageSubscription')` and `t('manageSubscriptionComingSoon')` in all 3 locales |

**Conclusion: The customer portal button is permanently disabled in the current codebase. No portal session API call is possible. No external navigation is possible. Safe to inspect in all three locales.**

---

## 14. Multilingual Source/Translation Review

### Translation Hook Pattern

All billing text uses the custom `useTranslations('billing')` hook:
```typescript
const t = useTranslations('billing');
// t('key') resolves to messages.billing.key for the active locale
// Falls back to en.json values if locale key is missing
// Falls back to key string if both are missing
```

File: `frontend/hooks/useTranslations.ts` — fully functional namespace-based resolver.

### Translation Key Coverage

All keys required by the current billing components are present in all three locale files.

Required keys (27 total):

| Key | en.json | zh-TW.json | zh-CN.json |
|-----|---------|------------|------------|
| `pageTitle` | "Billing" | "帳務" | "账单" |
| `balance` | "Credit Balance" | "信用餘額" | "信用余额" |
| `monthlyAllocationValue` | "{count} credits/month" | "{count} 點數/月" | "{count} 点数/月" |
| `subscription` | "Subscription" | "訂閱" | "订阅" |
| `planFree` | "Free" | "免費" | "免费" |
| `planStarter` | "Starter" | "入門" | "入门" |
| `planPro` | "Pro" | "專業" | "专业" |
| `planTeam` | "Team" | "團隊" | "团队" |
| `statusActive` | "Active" | "有效" | "有效" |
| `statusTrialing` | "Trial" | "試用中" | "试用中" |
| `statusPastDue` | "Past Due" | "逾期" | "逾期" |
| `statusCancelled` | "Cancelled" | "已取消" | "已取消" |
| `statusExpired` | "Expired" | "已到期" | "已过期" |
| `renewsOn` | "Renews on {date}" | "續約日期 {date}" | "续约日期 {date}" |
| `cancelledOn` | "Cancelled — expires {date}" | "已取消 — 到期日 {date}" | "已取消 — 到期日 {date}" |
| `checkoutSuccess` | "Payment successful!..." | "付款成功！..." | "支付成功！..." |
| `checkoutCancelled` | "Checkout was cancelled..." | "結帳已取消..." | "结账已取消..." |
| `manageSubscription` | "Manage Subscription" | "管理訂閱" | "管理订阅" |
| `manageSubscriptionComingSoon` | "Coming soon — ..." | "即將推出 — ..." | "即将推出 — ..." |
| `billingUnavailable` | "Billing is currently unavailable." | "帳務目前無法使用。" | "账单目前不可用。" |
| `loadError` | "Failed to load billing information." | "無法載入帳務資訊。" | "无法加载账单信息。" |
| `retry` | "Retry" | "重試" | "重试" |
| `freeCreditsNote` | "Free plan includes {count} credits per month." | "免費方案每月包含 {count} 點數。" | "免费方案每月包含 {count} 点数。" |
| `upgradePlan` | "Upgrade Plan" | "升級方案" | "升级方案" |
| `upgradeTo` | "Upgrade to {plan}" | "升級至 {plan}" | "升级至 {plan}" |
| `topUp` | "Top Up Credits" | "儲值點數" | "充值点数" |
| `topUpPack` | "{count} Credits" | "{count} 點數" | "{count} 点数" |
| `buyCredits` | "Buy {count} Credits" | "購買 {count} 點數" | "购买 {count} 点数" |
| `backToWorkspace` | "Back to Workspace" | "返回工作區" | "返回工作区" |
| `activeSubscriptionExists` | "You already have an active subscription." | "您已有有效的訂閱。" | "您已有有效的订阅。" |
| `invalidRequest` | "Invalid request. Please try again." | "無效的請求，請再試一次。" | "无效的请求，请重试。" |
| `checkoutError` | "Checkout failed. Please try again." | "結帳失敗，請再試一次。" | "结账失败，请重试。" |

**All 31 verified keys present in all three locales. No missing translation keys.**

### Hardcoded English Check

Review of all billing components reveals:

| Component | Hardcoded English? | Notes |
|-----------|--------------------|-------|
| `billing-page-client.tsx` | NONE identified | All visible text uses `t()` |
| `billing-balance-card.tsx` | NONE identified | All visible text uses `t()` |
| `billing-subscription-card.tsx` | NONE identified | All visible text uses `t()` |
| `billing-topup-section.tsx` | NONE identified | All visible text uses `t()` |

**Minor observation (non-blocking, not a defect):**
- Loading button state shows `'...'` (lines 218 and 48 of billing-topup-section.tsx) for in-progress checkout. This is a visual indicator, not substantive user text, and is common practice. This is NOT logged as a defect.
- `formatDate()` in `billing-subscription-card.tsx` uses `toLocaleDateString(undefined, ...)` which formats dates using the browser's default locale rather than the app's selected locale. This is only visible when a paid subscription exists (which will not be the case for a new test user). Not a defect for this smoke scope but noted for future review.

**Conclusion: No hardcoded English user-facing copy found in the billing UI. Multilingual-first requirement is satisfied.**

---

## 15. Local Data Prerequisites

### Minimum Required Records

| Record | Required? | Source |
|--------|-----------|--------|
| `users` row | **YES** — created via registration | `auth.service.ts` register() |
| `auth_sessions` row | **YES** — created via login | `auth.service.ts` createSession() |
| `credit_balances` row | **NO** — safe zero default | `billing-read.controller.ts` getBalance(): `if (!balance) return { balance: 0, ... }` |
| `subscriptions` row | **NO** — null is handled gracefully | `billing-read.controller.ts` getSubscription(): `if (!subscription) return null` |

**All required records can be created through normal application behaviour (registration + login). No direct DB operations required.**

### How Minimum Data Is Created

1. Navigate to `http://localhost:3002/en/register` → submit form with test credentials → `users` row created
2. Navigate to `http://localhost:3002/en/login` → submit credentials → `auth_sessions` row created
3. No further data preparation required

---

## 16. Local Data Preparation Decision

**Decision: NO direct DB preparation required.**

Normal registration and login are sufficient. The billing read endpoints return safe defaults for absent balance/subscription records. No seed scripts, fixtures, or direct SQL operations are needed.

**Verification sources:**

- `CreditBalanceRepository.findByOwner()` returns `null` when no row exists → controller returns zero balance
- `SubscriptionRepository.findActiveByUserId()` returns `null` when no active subscription → controller returns `null`
- Frontend `useBillingData` and `BillingPageClient` handle both null states gracefully (free plan UI)

---

## 17. Migration Decision

**Decision: NO new migration required.**

BILLING-READY-06A confirmed 24/24 migrations executed, 0 pending. The billing page smoke requires no schema changes. The current schema supports:
- `users` table (for new registrations)
- `auth_sessions` table (for new sessions)
- `credit_balances` table (queried, may be empty — safe)
- `subscriptions` table (queried, may be empty — safe)

If any source inspection had suggested a missing column or constraint, it would have been recorded here as a defect requiring a separate task with Keith's explicit approval. None was found.

---

## 18. Docker/PostgreSQL/Redis Prerequisites

### Services Required for Step 3

| Service | Container | Required | Why |
|---------|-----------|----------|-----|
| Docker Desktop | Host | **YES** | Container runtime |
| `postgres` | `aisandbox-postgres` | **YES** | API Gateway DB connection, user/session/billing data |
| `redis` | `aisandbox-redis` | **YES** | API Gateway BullMQ queues (required for startup) |
| `prometheus` | `aisandbox-prometheus` | **NO** | Monitoring only — do not start |
| `grafana` | `aisandbox-grafana` | **NO** | Port 3000 conflict risk — do not start |
| AI Service | — | **NO** | Not needed for billing smoke |
| Container Manager | — | **NO** | Not needed for billing smoke |
| Worker | — | **NO** | No BullMQ job processing needed |

### Volume State

- `postgres_data` volume: preserved from BILLING-READY-06A/06B with all 24 migrations applied
- `redis_data` volume: preserved from BILLING-READY-06B
- Volumes must NOT be deleted (`docker compose down -v` is prohibited)

---

## 19. Exact Future PowerShell Command Plan

**These commands are for future Step 3 execution only. Do NOT run now.**

All commands use PowerShell syntax and full absolute Windows paths.

### Phase A — Confirm Docker Desktop Readiness

```powershell
docker info --format "{{.ServerVersion}}"
```

Expected: version string (e.g. `29.2.1`). If command fails, Docker Desktop is not running — STOP.

### Phase B — Start PostgreSQL and Redis Only

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis
```

### Phase C — Confirm Container Health

```powershell
Start-Sleep -Seconds 15; docker compose ps
```

Expected: `aisandbox-postgres` healthy, `aisandbox-redis` healthy. If either shows unhealthy — STOP.

### Phase D — Start API Gateway

In a dedicated terminal:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run dev
```

Wait for:
- `API Gateway started!`
- `Listening on: http://localhost:4000`
- `Redis connected`
- `DB connected`
- `Provider mode resolved: disabled`
- `BILLING_CHARGES_ENABLED=false`

If any of these are absent or if startup fails — STOP.

### Phase E — Verify API Gateway Health

In a second terminal (API Gateway must be running in another terminal):

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method GET
Invoke-RestMethod -Uri "http://localhost:4000/api/health/db" -Method GET
Invoke-RestMethod -Uri "http://localhost:4000/api/health/ready" -Method GET
```

Expected: all 200 OK with `status: "ok"/"ready"`. If any fails — STOP.

### Phase F — Start Frontend Dev Server

In a dedicated terminal:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run dev
```

Wait for: `ready on http://localhost:3002` (or similar Next.js ready message). If port 3002 is not confirmed ready — STOP.

### Phase G — Stop Services (Cleanup)

After browser smoke is complete:

```powershell
# Stop frontend: Ctrl+C in frontend terminal

# Stop API Gateway: Ctrl+C in API Gateway terminal

# Stop containers (preserve volumes — NEVER use docker compose down -v)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis

# Confirm stopped
docker compose ps
```

Expected: both containers show `Exited` status. Volumes preserved.

---

## 20. Exact Keith-Guided Browser Smoke Plan

**Keith must remain at the keyboard for all browser steps. Cursor cannot access Keith's browser.**

All steps are observation-only except login/registration. No checkout buttons may be clicked.

### Step A — Authentication

1. Open browser to `http://localhost:3002/en/register`
2. Enter test email (e.g. `smoke-test-07@local.test`) and password (min 6 chars)
3. Submit registration form
4. Expected: success message appears ("User registered successfully" or translated equivalent)
5. Navigate to `http://localhost:3002/en/login`
6. Enter same credentials and submit
7. Expected: redirect to `http://localhost:3002/en/app`
8. **Confirm session is active**: navigate to `http://localhost:3002/en/billing`
9. Expected: billing page loads (balance + subscription data visible, NOT the 401 error state seen in 06B)

**Proof of active session**: if the billing page shows billing data cards (not the red error card with "Failed to load billing information"), the session cookie is active.

**Do NOT paste test credentials into chat or terminal output.**

### Step B — English Billing Page

Navigate to: `http://localhost:3002/en/billing`

Expected observations:

| Item | Expected |
|------|----------|
| Balance card | Visible — shows 0 credits, 0 credits/month (no balance row for new user) |
| Subscription card | Visible — shows "Free" plan label, "Active" status badge |
| Free credits note | Visible — "Free plan includes 500 credits per month." |
| Upgrade section | Visible (free user) — shows "Upgrade Plan" heading + 3 plan buttons (Starter, Pro, Team) |
| Top-up section | Visible — shows "Top Up Credits" heading + 3 pack buttons |
| Customer portal card | Visible — shows "Manage Subscription" heading, "Coming soon..." note, disabled button |
| Error state | ABSENT — should NOT see red error card |
| Loading skeleton | ABSENT — should disappear after data loads |

**STOP CONDITION**: Do NOT click any Upgrade, Buy Credits, or Manage Subscription button.

### Step C — Traditional Chinese Billing Page

Navigate to: `http://localhost:3002/zh-TW/billing`

Expected observations:

| Item | Expected |
|------|----------|
| Page title | "帳務" |
| Balance card heading | "信用餘額" |
| Subscription card heading | "訂閱" |
| Free plan label | "免費" |
| Active status badge | "有效" |
| Free credits note | "免費方案每月包含 500 點數。" |
| Upgrade section heading | "升級方案" |
| Customer portal heading | "管理訂閱" |
| Customer portal coming-soon | "即將推出 — 透過客戶入口管理訂閱。" |
| Customer portal button | "管理訂閱" (disabled) |
| Hardcoded English | ABSENT — no English text visible except possibly technical placeholders |

**STOP CONDITION**: Do NOT click any checkout or upgrade button.

### Step D — Simplified Chinese Billing Page

Navigate to: `http://localhost:3002/zh-CN/billing`

Expected observations:

| Item | Expected |
|------|----------|
| Page title | "账单" |
| Balance card heading | "信用余额" |
| Subscription card heading | "订阅" |
| Free plan label | "免费" |
| Active status badge | "有效" |
| Free credits note | "免费方案每月包含 500 点数。" |
| Upgrade section heading | "升级方案" |
| Customer portal heading | "管理订阅" |
| Customer portal coming-soon | "即将推出 — 通过客户门户管理订阅。" |
| Customer portal button | "管理订阅" (disabled) |
| Hardcoded English | ABSENT — no English text visible except possibly technical placeholders |

**STOP CONDITION**: Do NOT click any checkout or upgrade button.

### Step E — Checkout Success Banner

Navigate to: `http://localhost:3002/en/billing?checkout=success`

Expected observations:
- Green banner visible at top of billing content: "Payment successful! Your credits have been added."
- Billing data cards still visible below the banner
- No API error state
- Network log (see Step G): NO new POST or Stripe request triggered by the URL parameter

Navigate to: `http://localhost:3002/zh-TW/billing?checkout=success`
- Green banner in Traditional Chinese: "付款成功！點數已加入您的帳戶。"

Navigate to: `http://localhost:3002/zh-CN/billing?checkout=success`
- Green banner in Simplified Chinese: "支付成功！点数已添加到您的账户。"

### Step F — Checkout Cancelled Banner

Navigate to: `http://localhost:3002/en/billing?checkout=cancelled`

Expected observations:
- Yellow/amber banner visible: "Checkout was cancelled. No charges were made."
- Note: the parameter is `cancelled` (with 'led') — not `cancel` or `canceled`
- Billing data cards still visible
- No error state

Navigate to: `http://localhost:3002/zh-TW/billing?checkout=cancelled`
- Yellow banner in Traditional Chinese: "結帳已取消，未產生任何費用。"

Navigate to: `http://localhost:3002/zh-CN/billing?checkout=cancelled`
- Yellow banner in Simplified Chinese: "结账已取消，未产生任何费用。"

### Step G — Responsive Check

Set browser viewport width to approximately 390 px (e.g. using DevTools responsive mode).

Navigate to: `http://localhost:3002/en/billing`

Expected:
- Balance and subscription cards stack to single column (`grid-cols-1` on small screens)
- Upgrade section buttons stack (`grid-cols-1`)
- Top-up section cards stack
- Customer portal card still visible and usable

Note: responsive check is bounded — only verify that the layout is usable and not broken at mobile width. Full responsive audit is outside this scope.

---

## 21. Network Evidence Plan

**Perform in the browser's DevTools Network tab (F12 → Network).**

This is a manual inspection plan for Step 3.

### Before loading any billing page

1. Open DevTools → Network tab
2. Click "Clear" (trash can icon) to reset the network log
3. Check "Preserve log" to retain log across navigations

### Expected requests during normal billing page load (authenticated)

| Request | Method | Expected |
|---------|--------|----------|
| `/api/billing/balance` | GET | 200 OK — local DB read |
| `/api/billing/subscription` | GET | 200 OK (or 200 with null body) — local DB read |
| Static assets (JS, CSS, images) | GET | 200 OK — expected |

### Prohibited requests (must be ABSENT from network log)

| Domain / Pattern | Reason |
|-----------------|--------|
| `*.stripe.com` | No Stripe API calls |
| `api.stripe.com` | No Stripe API calls |
| `js.stripe.com` | No Stripe JS loaded |
| `POST /api/billing/checkout/*` | No checkout session creation |
| `POST /api/billing/portal` | No customer portal session (endpoint does not exist) |
| Any `webhook` URL | No webhook calls from browser |
| Any external payment domain | No external payment navigation |

### Banner navigation check

1. Navigate to `http://localhost:3002/en/billing?checkout=success`
2. Observe network tab
3. Expected: only the normal GET requests (balance, subscription) — **NO additional POST or external request**
4. The banner is pure client-side state — confirmed in source

### Checkout button safety check

1. Observe the upgrade buttons (visible for free user)
2. Do NOT click them
3. Confirm no network request is queued passively by inspecting network tab

---

## 22. Responsive/Mobile-Width Check

Include one bounded viewport check at approximately **390 px** width.

Use browser DevTools → responsive design mode → set width to 390 px.

Navigate to: `http://localhost:3002/en/billing`

Check:
- Layout renders in single-column stacked layout
- Balance card and subscription card are full width
- Upgrade plan buttons are usable
- Top-up section is usable
- Customer portal card is visible and disabled button is visible

This check verifies that `grid-cols-1 sm:grid-cols-2` breakpoint applies correctly at mobile width.

**Source reference**: `billing-page-client.tsx` line 200:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
```

---

## 23. Stop Conditions

Step 3 must STOP immediately if any of the following occur:

| # | Condition |
|---|-----------|
| 1 | Docker Desktop unavailable at smoke start |
| 2 | `aisandbox-postgres` or `aisandbox-redis` container unhealthy |
| 3 | A remote or production DATABASE_URL is detected in API Gateway startup logs |
| 4 | API Gateway startup fails or logs an error state |
| 5 | Startup logs do NOT confirm `Provider mode resolved: disabled` |
| 6 | Startup logs do NOT confirm `BILLING_CHARGES_ENABLED=false` |
| 7 | Any health endpoint returns non-200 |
| 8 | Registration fails for an unexpected reason |
| 9 | Login fails with a credential error (re-check credentials — do NOT share in chat) |
| 10 | Billing page loads as error state after login (indicates session cookie is not being forwarded correctly) |
| 11 | Network log shows a request to `*.stripe.com` or other external payment domain |
| 12 | Network log shows `POST /api/billing/checkout/*` (indicates accidental button click or auto-trigger) |
| 13 | Customer portal button appears ENABLED and clickable |
| 14 | Any checkout or upgrade button is accidentally clicked |
| 15 | `BILLING_CHARGES_ENABLED` cannot be confirmed false from startup logs |
| 16 | A migration error or pending migration warning appears in API Gateway startup logs |
| 17 | A source fix appears to be required to proceed |
| 18 | Another task becomes ACTIVE |
| 19 | Secrets would need to be printed in chat to diagnose an issue |

---

## 24. Cleanup/Rollback Plan

### After successful smoke

1. Log out via the browser UI (navigate to app and use the logout button) — this revokes the `auth_session` row in the DB
2. Stop frontend: Ctrl+C in frontend terminal
3. Stop API Gateway: Ctrl+C in API Gateway terminal
4. Stop containers: `docker compose stop postgres redis`
5. Verify: `docker compose ps` confirms stopped containers
6. Volumes preserved: `postgres_data` and `redis_data` remain intact

### Test user cleanup (optional)

The test user created during smoke (`smoke-test-07@local.test`) remains in the local `users` table. This is acceptable for local-only development. The user is isolated to the local DB and has no production impact.

If cleanup is desired, it would require a direct DB operation outside this smoke task scope — to be handled separately if required.

### If smoke is aborted

Same cleanup applies: log out if session is active, stop services, stop containers (without removing volumes).

---

## 25. Source Defects Found

### None blocking Step 3

No source defects were found that block the authenticated billing smoke.

### Minor observations (non-blocking, no fix required)

| # | Severity | File | Observation | Blocking Step 3? |
|---|----------|------|-------------|-----------------|
| 1 | Minor/style | `frontend/components/billing/billing-page-client.tsx` line 25 | `useState()` used with an initializer that has side effects (calls `setCheckoutResult`) — non-idiomatic; `useEffect` is the canonical pattern for this. Works correctly in practice; React processes the state update on the next render cycle. | NO |
| 2 | Minor/observation | `frontend/components/billing/billing-subscription-card.tsx` line 36 | `toLocaleDateString(undefined, ...)` uses the browser's default locale rather than the app's selected locale for date formatting. This affects subscription renewal/cancellation date display only — not visible for a free user with no subscription row. | NO |

Neither observation requires a fix task at this time. They may be considered for a future bounded UX/UI polish task if determined to impact real users.

---

## 26. Child-Slice Decision

### Decision: OPTION A — Keep BILLING-READY-07 as one parent execution step

**Rationale:**

| Condition | Met? |
|-----------|------|
| Normal local login is straightforward | YES — email/password, no external dependencies, no email verification required |
| No direct DB preparation required | YES — safe zero defaults; registration + login via normal app flow is sufficient |
| Browser smoke is bounded | YES — defined scope: 3 locales, 2 banner URLs, customer portal check, network log inspection |
| No source defects found blocking smoke | YES — zero blocking defects identified |
| No provider-call ambiguity exists | YES — provider is disabled; all payment paths return 503; customer portal button has no handler |

**The one elevated risk** — enabled checkout buttons for free users — is fully mitigated by explicit stop conditions in the Step 3 plan (Keith must not click them). This risk does not require splitting into child slices.

**Child slices not warranted at this time.** If Step 3 execution reveals unforeseen complexity (e.g. cookie forwarding issues through the Next.js proxy, registration failure due to missing env config), child slices may be proposed during Step 3 with Keith's approval.

---

## 27. Step 3 GO / CONDITIONAL GO / NO-GO Decision

### Decision: CONDITIONAL GO

**Step 3 (authenticated browser smoke execution) is approved to proceed**, subject to the following conditions.

### Conditions

| # | Condition |
|---|-----------|
| 1 | Keith must NOT click any Upgrade Plan button (Starter, Pro, Team) |
| 2 | Keith must NOT click any Top Up Credits / Buy N Credits button |
| 3 | Keith must NOT click any Manage Subscription button (currently disabled — confirm disabled before proceeding) |
| 4 | API Gateway startup must confirm `Provider mode resolved: disabled` and `BILLING_CHARGES_ENABLED=false` |
| 5 | Network log must show no requests to `*.stripe.com` or external payment domains |
| 6 | All Stop Conditions in Section 23 must be respected |

### GO rationale

- Authentication is straightforward (email/password, no external services, no email verification for login)
- All 24/24 migrations already executed — no new migration needed
- Billing read endpoints are provably DB-only — no provider calls
- Customer portal is permanently disabled in source
- Query banners are pure client-side state — no API calls triggered by query params
- All translation keys present in all 3 locales — no hardcoded English found
- Provider is disabled, charges kill-switch is false
- Safe zero defaults for new users (no balance/subscription rows needed)

### CONDITIONAL element

The upgrade and top-up checkout buttons are **enabled** in the UI for free users. These are click-only — no auto-trigger on page load. The conditional is that Keith must not click them. If buttons were accidentally clicked, the backend would return 503 (no charge, no provider call), but it would be outside the approved smoke scope and the session would need review.

---

## 28. Exact Next Recommended Action

After Keith reviews and approves this preflight document:

1. Keith approves Step 2 (this document) and confirms CONDITIONAL GO for Step 3
2. Proceed to **BILLING-READY-07 Step 3 — Authenticated Billing UI Browser Smoke Execution**
3. Follow the exact PowerShell command plan in Section 19
4. Follow the exact browser smoke plan in Section 20
5. Follow the network evidence plan in Section 21
6. Observe all stop conditions in Section 23
7. Record all observations (browser screenshots or written notes by Keith)
8. After smoke, proceed to **BILLING-READY-07 Step 4 — Consolidation / Checkpoint**

**No child slices required at this time.** BILLING-READY-07 remains a single parent execution track.

---

## 29. Safety Confirmations

| # | Constraint | Status |
|---|-----------|--------|
| 1 | No source implementation | **CONFIRMED** |
| 2 | No source fixes | **CONFIRMED** |
| 3 | No tests written or run | **CONFIRMED** |
| 4 | No builds executed | **CONFIRMED** |
| 5 | No linting executed | **CONFIRMED** |
| 6 | No Docker execution | **CONFIRMED** |
| 7 | No PostgreSQL execution | **CONFIRMED** |
| 8 | No Redis execution | **CONFIRMED** |
| 9 | No database queries executed | **CONFIRMED** |
| 10 | No migrations run | **CONFIRMED** |
| 11 | No service startup | **CONFIRMED** |
| 12 | No authentication/session creation | **CONFIRMED** |
| 13 | No browser smoke executed | **CONFIRMED** |
| 14 | No billing API calls | **CONFIRMED** |
| 15 | No checkout calls | **CONFIRMED** |
| 16 | No customer portal API calls | **CONFIRMED** |
| 17 | No provider calls | **CONFIRMED** |
| 18 | No Stripe CLI | **CONFIRMED** |
| 19 | No webhook tests | **CONFIRMED** |
| 20 | No real secret-bearing env file opened | **CONFIRMED** — `.env`, `.env.local`, `.env.example` not inspected |
| 21 | No passwords, cookies, JWTs, tokens, secrets printed | **CONFIRMED** |
| 22 | No TASKS.md edits | **CONFIRMED** |
| 23 | No TASKS_BACKLOG_FULL.md edits | **CONFIRMED** |
| 24 | No roadmap edits | **CONFIRMED** |
| 25 | No git commit or push | **CONFIRMED** |
| 26 | No subagents used | **CONFIRMED** |
| 27 | Only the approved preflight document created | **CONFIRMED** — `docs/BILLING-READY-07-AUTHENTICATED-BILLING-SMOKE-PREFLIGHT.md` |

---

## 30. UX/UI Advisory Skills Assessment

As required by the task scope, both available advisory skills were evaluated:

### Impeccable skill

Relevant for a broad UI/UX audit. **NOT required for this functional smoke.** The billing page components use clean Tailwind layout patterns. No broad redesign or visual hierarchy issues were identified during source inspection that would block smoke. If a separate UX/UI polish task is registered after smoke validation, the Impeccable skill may be applied in that bounded context.

### Emil Kowalski design-engineering skill

Relevant for component polish and interaction quality. **NOT required for this functional smoke.** Loading, error, empty, and success states are all implemented and translated. Interaction patterns are functional. The `useState`-as-`useEffect` observation (Section 25) is a code quality note, not a UX issue.

**Conclusion: Neither skill is required for Step 3 browser smoke.**

---

## 31. Heroicons Rule Note

The billing components use Heroicons v2 Outline as required by the workspace rule:

```tsx
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { BanknotesIcon } from '@heroicons/react/24/outline';
```

All icons are sourced from `@heroicons/react/24/outline`. No non-compliant icon libraries. No icon changes during Step 2.

---

**BILLING-READY-07 Step 2 Status: COMPLETE**  
**Next step: BILLING-READY-07 Step 3 — Authenticated Billing UI Browser Smoke Execution (CONDITIONAL GO — awaiting Keith approval)**
