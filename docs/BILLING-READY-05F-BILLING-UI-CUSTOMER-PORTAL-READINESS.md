# BILLING-READY-05F — Billing UI / Customer Portal Readiness Review

**Task ID:** BILLING-READY-05F
**Step:** 2 — Billing UI / Customer Portal Readiness / Exact UX and API Boundary
**Status:** COMPLETE
**Date:** 2026-07-15
**Nature:** Static readiness review — read-only — no implementation

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-05F ACTIVE | **CONFIRMED** — Step 1 COMPLETE (Registration — 2026-07-15). Keith approval recorded. |
| Parent BILLING-READY-05 ACTIVE | **CONFIRMED** — Steps 1–2 COMPLETE (2026-07-13). Step 3 IN PROGRESS via child slices. Split table: 05A–05E COMPLETE and LOCKED; 05F ACTIVE; 05G planned. |
| BILLING-READY-05A COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. Provider configuration/contracts. |
| BILLING-READY-05B COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. Customer/subscription persistence. |
| BILLING-READY-05C COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. Checkout/credit top-up session creation. |
| BILLING-READY-05D COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. Webhook event ingestion/idempotency. |
| BILLING-READY-05E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-15. Credit grant/top-up accounting. |
| BILLING-READY-05G planned only, not registered | **CONFIRMED** — appears only as "planned" in TASKS.md. |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-13. Balance enforcement foundation. |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. Credit balance persistence foundation. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | **CONFIRMED** — 2026-07-12. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **CONFIRMED** — 2026-07-07. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **CONFIRMED** — 2026-07-09. |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-05F is the active child slice. |

---

## 2. Source-of-Truth Summary

### 05C Checkout Endpoint/Response Contracts

- **Controller:** `services/api-gateway/src/billing/checkout/checkout.controller.ts`
- **Route prefix:** `@Controller('billing/checkout')` → `/api/billing/checkout/*`
- **Endpoints:**
  - `POST /api/billing/checkout/subscription` — accepts `{ planId, successUrl, cancelUrl }` → returns `CheckoutSessionResponseDto`
  - `POST /api/billing/checkout/topup` — accepts `{ topUpPackId, successUrl, cancelUrl }` → returns `CheckoutSessionResponseDto`
- **Auth:** `SessionCookieGuard` (browser-session only, no API key)
- **Response DTO:** `CheckoutSessionResponseDto` — `{ checkoutSessionId, checkoutUrl, providerMode, checkoutType, planType?, topUpPackage?, customerId? }`
- **Plans:** `starter`, `pro`, `team` (free rejected). Top-up packs: `topup_1000`, `topup_5000`, `topup_20000`.
- **URL validation:** `new URL()`, max 2048 chars, HTTPS required (HTTP localhost in dev), origin allowlist, open redirect blocked.
- **Gate:** `ChargeReadinessService.getSystemChargeReadiness()` → HTTP 503 when charges disabled.
- **Provider delegation:** returns `checkoutUrl` for redirect when real provider is configured; `null` in stub mode.

### 05E Credit Grant/Top-Up Accounting Implications

- **Grant entity:** `CreditGrant` in `services/api-gateway/src/entities/credit-grant.entity.ts` with 20 columns.
- **Grant service:** `CreditGrantService` processes grants atomically — locks balance row, inserts grant record, updates balance via `addBalance()`.
- **Top-up packs:** `TOP_UP_PACK_MAP` — `topup_1000` → 1,000; `topup_5000` → 5,000; `topup_20000` → 20,000 credits.
- **Subscription allocations:** `MONTHLY_CREDIT_ALLOCATIONS` — free: 500; starter: 5,000; pro: 25,000; team: 100,000.
- **Balance read:** `CreditBalanceRepository.findByOwner(ownerId, ownerType)` returns `CreditBalance` with `balance`, `monthlyAllocation`, `periodStart`, `periodEnd`, `planId`, `status`.
- **Subscription read:** `SubscriptionRepository.findActiveByUserId(userId)` returns `Subscription | null` with `planType`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`.
- **No dedicated HTTP read endpoints exist** for credit balance or subscription status from the frontend.

### 05A Provider/Customer Portal Contract Status

- **Interface method:** `createBillingPortalSession(params: PortalSessionParams): Promise<ProviderResult<PortalSessionResult>>`
- **Params:** `{ customerId: string; returnUrl: string }`
- **Result:** `{ url: string | null }`
- **Implementation:** `StripePaymentProvider.createBillingPortalSession()` — returns `{ url: null }` in stub mode; `PROVIDER_DISABLED` in disabled mode; `PROVIDER_NOT_CONFIGURED` in test/live mode.
- **No backend HTTP endpoint** exists for billing portal session creation. The provider method exists but is not exposed via a controller.

### Parent 05 Payment Readiness Decisions

- Provider: Stripe selected.
- Split: 05A–05G approved.
- Frontend billing UI: recommended route `[locale]/billing/page.tsx` with checkout success/cancel pages.
- Target: stub-only + test-mode-ready contracts. No live Stripe API calls.
- All Stripe SDK, env keys, provider calls deferred per-slice with explicit Keith approval.

### Registration Boundary Confirmation

| Constraint | Status |
|-----------|--------|
| No provider calls | **CONFIRMED** — not approved |
| No customer portal API calls | **CONFIRMED** — not approved |
| No Stripe SDK install | **CONFIRMED** — not approved |
| No env/secrets changes | **CONFIRMED** — not approved |
| No package changes | **CONFIRMED** — not approved |
| No migrations | **CONFIRMED** — not approved |
| No DB access | **CONFIRMED** — not approved |
| No frontend edits | **CONFIRMED** — not approved (Step 2 is review only) |
| No translation edits | **CONFIRMED** — not approved (Step 2 is review only) |
| No tests | **CONFIRMED** — not approved (Step 2 is review only) |
| No runtime work | **CONFIRMED** — not approved |

---

## 3. Existing Frontend Source-Path Findings

### Account/Settings Routes

| Path | Status |
|------|--------|
| `frontend/app/[locale]/account/page.tsx` | **EXISTS** — currently redirects to `/${locale}/app`. No billing UI. |
| `frontend/app/[locale]/settings/**` | **DOES NOT EXIST** — no settings route. |
| `frontend/app/[locale]/billing/**` | **DOES NOT EXIST** — no billing route. |

### Existing Billing/Usage/Credits UI

- **No billing UI exists.** The `account` page is a redirect.
- The workspace sidebar shows `quotaSummary` (maxActiveSessions, maxTokens24h, maxSessions24h) and `usageSummary` (tokensUsed24h, sessionsCreated24h) as small inline stats — but no credit balance display.
- The `workspace.upgrade` translation key exists ("Upgrade") but no upgrade UI is implemented.
- The `tabs.payment` key exists ("Payment") in tool-tabs context but is marked "Coming soon."

### Existing Authenticated API Client/Fetch Patterns

- **Direct `fetch()` calls** with relative URLs and `credentials: 'include'` (browser-session cookies).
- Pattern: `workspace-account-menu.tsx` uses `fetch('/api/user/ai-instructions', { method: 'GET' })` and `fetch('/api/user/ai-instructions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: ... })`.
- No centralized API client/Axios instance in frontend.
- Session cookie (`aisandbox_session`) automatically sent via same-origin fetch.

### Existing Translation Hook/Pattern

| Component | Path |
|-----------|------|
| `useTranslations` hook | `frontend/hooks/useTranslations.ts` |
| `TranslationProvider` | `frontend/components/TranslationProvider.tsx` |
| Locale layout | `frontend/app/[locale]/layout.tsx` — loads messages by locale, wraps with `TranslationProvider` |
| Message files | `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json` |
| Usage pattern | `const t = useTranslations('namespace'); t('key')` — supports dot-nested keys, falls back to en.json |
| Direct import pattern | `workspace-sidebar.tsx` imports JSON directly and resolves keys with `resolveNestedMessage()` |

### Existing Loading/Error/Empty State Patterns

- **Loading:** `"Loading..."` via `common.loading` key; component-level state like `globalInstructionsLoading` with conditional rendering.
- **Error:** Red text `className="text-red-600"` with error messages from translation keys; `ErrorRemediation.tsx` component.
- **Empty state:** Conditional renders with descriptive messages (e.g. `workspace.noProjects`, `workspace.openProjectToStart`).
- Pattern: inline conditional rendering (`{loading ? <p>...</p> : null}`) — no shared Skeleton/Spinner component identified.

### Existing Button/Card/Dialog/Table Components

- No shared component library (`ui/button.tsx`, `ui/card.tsx`, etc.) — all components are page-specific inline Tailwind.
- `workspace-account-menu.tsx`: inline button styles with `rounded border px-3 py-1.5 text-sm font-medium`.
- `workspace-sidebar.tsx`: navigation buttons with active/inactive states.
- `platform-dashboard.tsx`: agent station cards with status badges.
- No dialog/modal abstraction — inline `div` overlays with `absolute`/`z-*` positioning.

### Existing Icon Usage and Heroicons Availability

- **Package:** `@heroicons/react: ^2.2.0` in `frontend/package.json` — **already installed**.
- **Import pattern:** `import { IconName } from '@heroicons/react/24/outline'` — Outline variant, 24px.
- **Usage in sidebar:** `ArrowsRightLeftIcon`, `ArrowUpIcon`, `BriefcaseIcon`, `BuildingOffice2Icon`, `FolderIcon`, `HomeIcon`, `Squares2X2Icon`.
- **Usage in platform:** `ArrowLeftIcon`, `BuildingOffice2Icon`.
- **Sizing/color:** Tailwind classes (`h-5 w-5`, `text-gray-*`, `currentColor` via `stroke`).

### Current Route/Layout Locale Patterns

- Locale segment: `frontend/app/[locale]/layout.tsx` — validates locale (`en`, `zh-TW`, `zh-CN`), loads messages, wraps in `TranslationProvider`.
- All pages under `[locale]/*`.
- Existing routes: `/[locale]/app`, `/[locale]/login`, `/[locale]/register`, `/[locale]/account`, `/[locale]/platform`, `/[locale]/gallery`, `/[locale]/keys`, `/[locale]/projects`, `/[locale]/driver`, etc.

---

## 4. Existing Backend/API Source-Path Findings

### CheckoutController Endpoints from 05C

| Endpoint | File |
|----------|------|
| `POST /api/billing/checkout/subscription` | `services/api-gateway/src/billing/checkout/checkout.controller.ts` |
| `POST /api/billing/checkout/topup` | `services/api-gateway/src/billing/checkout/checkout.controller.ts` |

### Checkout Response DTO

- `services/api-gateway/src/billing/checkout/dto/checkout-session-response.dto.ts`
- Returns: `{ checkoutSessionId, checkoutUrl, providerMode, checkoutType, planType?, topUpPackage?, customerId? }`

### Top-Up Package Mapping

- `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts`
- `TOP_UP_PACK_MAP`: `topup_1000` (1,000 credits), `topup_5000` (5,000 credits), `topup_20000` (20,000 credits)
- `CHECKOUT_PLAN_PRICE_MAP`: starter (5,000/mo), pro (25,000/mo), team (100,000/mo)
- Placeholder price IDs — real Stripe price IDs deferred.

### Credit Balance Read API

- **No HTTP read endpoint exists.** `CreditBalanceRepository.findByOwner()` exists in backend but is not exposed via any controller GET route.
- The `BillingVisibilityController` (`/api/billing/snapshots`, `/api/billing/summary`) exposes billing _snapshots_ (not live credit balance). It uses `ApiKeyAuthGuard` + `AuthorizationGuard` — **not browser-session auth**.

### Subscription Read API

- **No HTTP read endpoint exists.** `SubscriptionRepository.findActiveByUserId()` exists but is not exposed via any controller.

### Customer Portal Provider Method from 05A

- `StripePaymentProvider.createBillingPortalSession(params)` — method exists.
- Returns `{ url: null }` in stub mode.
- **No HTTP controller endpoint** exposes this to the frontend.

### Whether Billing Portal Backend Endpoint Exists

- **DOES NOT EXIST.** No controller exposes `createBillingPortalSession`. Only the provider method exists internally.

### Whether 05F Needs Backend Read Endpoints

- **YES — 05F needs backend read endpoints** for:
  1. `GET /api/billing/balance` — return current user credit balance (from `CreditBalanceRepository.findByOwner(userId)`)
  2. `GET /api/billing/subscription` — return current user subscription status (from `SubscriptionRepository.findActiveByUserId(userId)`)
- These are simple passthrough read-only endpoints under `SessionCookieGuard`.
- Portal endpoint can be deferred.

---

## 5. Billing UI Surface Decision

| Decision | Outcome |
|----------|---------|
| Exact route/page for billing UI | **`frontend/app/[locale]/billing/page.tsx`** — new dedicated billing page |
| Under account/settings or dedicated? | **Dedicated `/billing` route** — keeps billing separated from workspace. The existing `/account` route redirects to `/app` and has no UI. Creating billing UI inside the workspace account menu would be too cramped. |
| Component hierarchy | `BillingPage` → `BillingBalanceCard`, `BillingSubscriptionCard`, `BillingTopUpSection`, `BillingCheckoutButton` |
| Full page vs section? | **Full page** — billing needs its own focused layout with balance, subscription, top-up packs, and checkout buttons. |
| Mobile/responsive | Standard Tailwind responsive (`max-w-2xl mx-auto` centered layout). Cards stack vertically. No special mobile handling beyond responsive grid. |
| Broad redesign required? | **NO** — no existing billing UI to redesign. Net-new page. No routing/architecture changes to existing workspace/account flows. |

---

## 6. Data Display Decision

| Element | Display Approach |
|---------|-----------------|
| Current credit balance | Large prominent number card with icon. Shows `balance` integer. Falls back to "—" or 0 when no balance record. |
| Subscription plan/status | Card showing current `planType` (free/starter/pro/team), `status` (active/trialing/past_due/cancelled/expired), renewal date (`currentPeriodEnd`). Free users see "Free plan" with upgrade prompt. |
| Monthly credit allowance | Shown inside subscription card: "5,000 credits/month" based on plan. |
| Top-up packages | Grid of 3 cards (1,000 / 5,000 / 20,000 credits) each with checkout button. |
| Recent credit grants | **DEFERRED** — no read endpoint for grants list. Can be added in 05G or later. |
| Billing/payment provider unavailable/disabled | Banner: "Billing is currently unavailable. Contact support." — when `ChargeReadinessService` returns `ready: false` or provider is disabled. Checkout buttons disabled. |
| Empty state (free/no subscription/no credits) | Show "Free plan — 500 credits/month" with upgrade prompt and top-up options. No error styling — informational display. |
| Loading state | Skeleton/shimmer placeholder for balance number and subscription card while fetch is in-flight. |
| Error state | Red banner: "Failed to load billing information. Please try again." with retry button. |

---

## 7. Checkout Button Flow Decision

| Decision | Outcome |
|----------|---------|
| Subscription checkout button behavior | Button "Upgrade to [Plan]" on each plan option. Calls `POST /api/billing/checkout/subscription` with `{ planId, successUrl, cancelUrl }`. On success, `window.location.href = checkoutUrl` to redirect to Stripe Checkout. |
| Top-up checkout button behavior | Button "Buy [N] Credits" on each top-up card. Calls `POST /api/billing/checkout/topup` with `{ topUpPackId, successUrl, cancelUrl }`. Redirects to `checkoutUrl`. |
| Success/cancel URL generation | `successUrl` = `${window.location.origin}/${locale}/billing?checkout=success`; `cancelUrl` = `${window.location.origin}/${locale}/billing?checkout=cancelled`. Both are same-origin HTTPS URLs passing URL validation. |
| Redirect behavior | `window.location.href = response.checkoutUrl` — full page redirect to Stripe-hosted checkout. No iframe/embed. |
| Disabled state | When provider is unavailable or charges disabled: buttons show `disabled` attribute, `cursor-not-allowed`, tooltip/text "Billing unavailable". |
| Error toast/banner | On checkout API error: inline error message below button or top banner. Map known errors: 503 → "Billing unavailable"; 409 → "Active subscription exists"; 400 → "Invalid request". |
| Browser live smoke needed later? | **YES** — redirect flow requires live smoke after implementation. Will ask Keith step-by-step in Step 3. |

---

## 8. Customer Portal Decision

| Decision | Outcome |
|----------|---------|
| Whether 05F implements a customer portal button | **YES — as a disabled/stub button** |
| Whether it is stubbed/disabled/deferred | **DEFERRED functionality** — button rendered but disabled with "Coming soon" text. No provider/portal API call. |
| Whether backend portal endpoint exists | **NO** — provider method exists but no controller endpoint. |
| Whether backend portal endpoint must be deferred | **YES** — creating a portal backend endpoint requires either a stub response (which adds no value) or a real Stripe portal session (not approved). Defer to post-05F. |
| Whether provider/customer portal API calls remain not approved | **CONFIRMED** — not approved per registration. |
| Exact copy/state for "coming later" | Button text: "Manage Subscription" (disabled). Tooltip/subtext: "Coming soon — subscription management via customer portal." |

---

## 9. Backend Contract Decision

| Decision | Outcome |
|----------|---------|
| Whether Step 3 is frontend-only | **NO** — frontend needs read endpoints that don't exist. |
| Whether backend read endpoints are needed | **YES** — two new GET endpoints required: |
| Endpoint 1 | `GET /api/billing/balance` — returns `{ balance, monthlyAllocation, planId, periodStart, periodEnd, status }` from `CreditBalanceRepository.findByOwner(userId)` |
| Endpoint 2 | `GET /api/billing/subscription` — returns `{ planType, status, currentPeriodStart, currentPeriodEnd, cancelAt } | null` from `SubscriptionRepository.findActiveByUserId(userId)` |
| Auth for new endpoints | `SessionCookieGuard` (same as checkout endpoints) |
| Exact backend files | New controller or extend existing. Recommended: new `BillingReadController` in `services/api-gateway/src/billing/billing-read.controller.ts` separate from existing `BillingVisibilityController` (which uses ApiKey auth). |
| Customer portal backend endpoint | **OUT OF SCOPE** for 05F. |
| Whether 05F should split | **Decision C — split into 05F-backend and 05F-frontend.** However, given the backend work is trivial (2 GET endpoints, ~50 lines each, no migration, no provider calls), a combined bounded Step 3 is acceptable. **Final decision: Option B — one bounded frontend+backend Step 3.** |

---

## 10. Multilingual Translation Decision

### Namespace

New top-level namespace: `"billing"` in all three message files.

### Exact Key Structure

```json
{
  "billing": {
    "pageTitle": "Billing",
    "balance": "Credit Balance",
    "balanceCredits": "{count} credits",
    "monthlyAllocation": "Monthly Allowance",
    "monthlyAllocationValue": "{count} credits/month",
    "subscription": "Subscription",
    "currentPlan": "Current Plan",
    "planFree": "Free",
    "planStarter": "Starter",
    "planPro": "Pro",
    "planTeam": "Team",
    "statusActive": "Active",
    "statusTrialing": "Trial",
    "statusPastDue": "Past Due",
    "statusCancelled": "Cancelled",
    "statusExpired": "Expired",
    "renewsOn": "Renews on {date}",
    "cancelledOn": "Cancelled — expires {date}",
    "upgradePlan": "Upgrade Plan",
    "upgradeTo": "Upgrade to {plan}",
    "topUp": "Top Up Credits",
    "topUpPack": "{count} Credits",
    "buyCredits": "Buy {count} Credits",
    "checkoutSuccess": "Payment successful! Your credits have been added.",
    "checkoutCancelled": "Checkout was cancelled. No charges were made.",
    "manageSubscription": "Manage Subscription",
    "manageSubscriptionComingSoon": "Coming soon — subscription management via customer portal.",
    "billingUnavailable": "Billing is currently unavailable.",
    "billingUnavailableDetail": "Payment processing is not active. Contact support if this persists.",
    "loadError": "Failed to load billing information.",
    "retry": "Retry",
    "loading": "Loading billing...",
    "noSubscription": "No active subscription",
    "freeCreditsNote": "Free plan includes {count} credits per month.",
    "activeSubscriptionExists": "You already have an active subscription.",
    "invalidRequest": "Invalid request. Please try again.",
    "checkoutError": "Checkout failed. Please try again.",
    "backToWorkspace": "Back to Workspace"
  }
}
```

### Translation Files to Update

| File | Action |
|------|--------|
| `frontend/messages/en.json` | Add `"billing": { ... }` namespace with English copy |
| `frontend/messages/zh-TW.json` | Add `"billing": { ... }` namespace with Traditional Chinese copy |
| `frontend/messages/zh-CN.json` | Add `"billing": { ... }` namespace with Simplified Chinese copy |

### Pattern

- Use `useTranslations('billing')` hook in billing components.
- No hardcoded English UI text.

---

## 11. Icon Decision

| Icon | Usage | Import |
|------|-------|--------|
| `CreditCardIcon` | Credit balance card header | `@heroicons/react/24/outline` |
| `BanknotesIcon` | Top-up section header | `@heroicons/react/24/outline` |
| `ArrowPathIcon` | Subscription renewal indicator | `@heroicons/react/24/outline` |
| `CheckCircleIcon` | Checkout success state | `@heroicons/react/24/outline` |
| `XCircleIcon` | Checkout cancelled / error state | `@heroicons/react/24/outline` |
| `ExclamationTriangleIcon` | Billing unavailable banner | `@heroicons/react/24/outline` |
| `ArrowLeftIcon` | "Back to Workspace" navigation | `@heroicons/react/24/outline` |
| `SparklesIcon` | Upgrade prompt accent | `@heroicons/react/24/outline` |

**Convention:** `h-5 w-5` sizing, `text-gray-500` or `text-current` color, Tailwind utility classes. No Lucide/Font Awesome/Material Icons/emoji.

---

## 12. UX/UI Advisory Decision

| Advisory | Usage | Constraint |
|----------|-------|-----------|
| Impeccable | Broad audit of billing page layout, visual hierarchy, spacing, and information architecture. Review balance display prominence, button placement, card spacing. | Must not trigger broad redesigns, routing changes, or dependency additions. |
| Emil Kowalski | Bounded component polish: checkout button interaction quality, loading shimmer, disabled state treatment, error banner motion, empty state clarity. | Must stay within billing page scope only. No workspace-wide refactor. |
| Advisory authority | Advisory only — must not override CLAUDE.md, TASKS.md, registered scope, architecture, or tests. | If advisory conflicts with governance, governance wins. |

---

## 13. Implementation vs Split Decision

**Decision: Option B — one bounded frontend+backend Step 3.**

Rationale:
- Backend work is minimal: 2 read-only GET endpoints (~100 lines total including tests).
- No migrations, no provider calls, no package changes.
- Frontend work is net-new page with no existing UI to refactor.
- Combined slice keeps billing UI + its required data endpoints coherent.
- Total estimated scope: ~8–12 files (frontend page + components + translations + backend controller + tests).

---

## 14. Exact Step 3 File Boundary

### Frontend Route/Page Files

| # | File | Action |
|---|------|--------|
| 1 | `frontend/app/[locale]/billing/page.tsx` | CREATE — billing page (server component wrapper) |

### Frontend Component Files

| # | File | Action |
|---|------|--------|
| 2 | `frontend/components/billing/billing-page-client.tsx` | CREATE — client component with data fetching, state, UI |
| 3 | `frontend/components/billing/billing-balance-card.tsx` | CREATE — credit balance display card |
| 4 | `frontend/components/billing/billing-subscription-card.tsx` | CREATE — subscription status card |
| 5 | `frontend/components/billing/billing-topup-section.tsx` | CREATE — top-up pack grid with checkout buttons |

### Frontend API Client/Hook Files

| # | File | Action |
|---|------|--------|
| 6 | `frontend/hooks/useBillingData.ts` | CREATE — custom hook for fetching balance + subscription |

### Backend Files

| # | File | Action |
|---|------|--------|
| 7 | `services/api-gateway/src/billing/billing-read.controller.ts` | CREATE — `GET /api/billing/balance`, `GET /api/billing/subscription` |
| 8 | `services/api-gateway/src/billing/billing-read.module.ts` | CREATE — module importing repositories |

### Translation Files

| # | File | Action |
|---|------|--------|
| 9 | `frontend/messages/en.json` | MODIFY — add `"billing"` namespace |
| 10 | `frontend/messages/zh-TW.json` | MODIFY — add `"billing"` namespace |
| 11 | `frontend/messages/zh-CN.json` | MODIFY — add `"billing"` namespace |

### Test Files

| # | File | Action |
|---|------|--------|
| 12 | `services/api-gateway/src/billing/__tests__/billing-read.controller.spec.ts` | CREATE — unit tests for read endpoints |
| 13 | `frontend/components/billing/__tests__/billing-page-client.test.tsx` | CREATE — component render/behavior tests |

### NOT Included

- No migrations
- No env/package files
- No provider SDK files
- No `.env.example` changes
- No `package.json` changes
- No customer portal backend endpoint

---

## 15. Test Plan

| # | Test | Type |
|---|------|------|
| 1 | Translation key presence in en.json / zh-TW.json / zh-CN.json (`billing.*`) | Source check |
| 2 | No hardcoded English UI text in billing components | Source check / grep |
| 3 | Checkout request flow — subscription: correct body sent, redirect on success | Unit test (frontend mock) |
| 4 | Checkout request flow — topup: correct body sent, redirect on success | Unit test (frontend mock) |
| 5 | Success/cancel URL generation uses `window.location.origin` + locale | Unit test |
| 6 | Disabled/unavailable billing state — buttons disabled, banner shown | Component test |
| 7 | Loading state — shimmer/skeleton rendered while fetching | Component test |
| 8 | Error state — error banner rendered, retry button functional | Component test |
| 9 | Empty state (free plan, no subscription) — informational, not error | Component test |
| 10 | Top-up package rendering — 3 packs displayed with correct credit counts | Component test |
| 11 | Subscription status rendering — all plan/status combos | Component test |
| 12 | Heroicons-only usage — no Lucide/FA/Material/emoji imports | Source grep |
| 13 | No provider/payment/customer portal API calls in any 05F file | Source grep |
| 14 | Backend `GET /api/billing/balance` returns correct shape | Unit test (backend) |
| 15 | Backend `GET /api/billing/subscription` returns correct shape / null | Unit test (backend) |
| 16 | Backend endpoints use `SessionCookieGuard` | Unit test |
| 17 | Existing checkout endpoint regression (`POST /api/billing/checkout/*`) | Existing test suite |
| 18 | TypeScript clean (`npx tsc --noEmit` in frontend and api-gateway) | Build check |

---

## 16. Runtime/Browser Validation Decision

| Constraint | Status |
|-----------|--------|
| No Docker/Postgres/Redis required for readiness | **CONFIRMED** |
| No provider/payment/customer portal calls | **CONFIRMED** |
| No Stripe CLI/webhook testing | **CONFIRMED** |
| No browser smoke in Step 2 | **CONFIRMED** |
| Step 3 browser/live smoke | **WILL ASK KEITH** — redirect flow and UI layout need live visual confirmation. Guide step-by-step (start frontend dev server, navigate to `/en/billing`, verify layout, test checkout button disabled state). |
| No AGENT-HARNESS write canary | **CONFIRMED** |

---

## 17. Risks/Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Hardcoded copy risk | HIGH | Translation key audit in acceptance; grep for unkeyed strings |
| 2 | Translation drift risk | MEDIUM | Same-slice i18n updates required; test all three files |
| 3 | Billing data API gap | HIGH | 05F creates required read endpoints (balance + subscription) |
| 4 | Provider/customer portal unavailable | LOW | Portal button is deferred/disabled; checkout uses stub mode safely |
| 5 | Checkout redirect risk | MEDIUM | `checkoutUrl` may be `null` in stub mode → button disabled or shows "unavailable" |
| 6 | Open redirect/success URL risk | LOW | URL validation in 05C backend already enforces origin allowlist |
| 7 | Accidental provider call risk | HIGH | No Stripe SDK imported; provider in disabled/stub mode; grep-verify no real calls |
| 8 | User confusion from stub/disabled payment | MEDIUM | Clear "Billing unavailable" messaging with explanation |
| 9 | UI scope creep risk | MEDIUM | Bounded to billing page only; no workspace/sidebar/account refactor |
| 10 | Test false-confidence risk | LOW | Tests mock fetch; live smoke deferred to Keith-approved step |

---

## 18. Step 3 Readiness Conclusion

| Question | Answer |
|----------|--------|
| Ready for Step 3? | **YES** |
| Further split required? | **NO** — one bounded frontend+backend Step 3 is sufficient |
| Backend implementation required? | **YES** — 2 GET read endpoints (balance + subscription) |
| Browser smoke approval needed later? | **YES** — will ask Keith explicitly in Step 3 |
| Package/env/provider-call approval needed? | **NO** — no new packages, no env changes, no provider calls |
| Recommended model | **GPT-5.3 Codex** — routine implementation, frontend+backend, bounded scope |
| Exact next prompt type | **Step 3 implementation prompt** — bounded frontend+backend billing UI with multilingual translations, Heroicons, checkout buttons, balance/subscription display, and read endpoints |

---

## 19. Files Inspected

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Task status, 05F registration details |
| 2 | `docs/BILLING-READY-05E-CHECKPOINT.md` | Credit grant/top-up accounting summary |
| 3 | `docs/BILLING-READY-05C-CHECKPOINT.md` | Checkout endpoint contracts |
| 4 | `docs/BILLING-READY-05A-CHECKPOINT.md` | Provider configuration/contracts |
| 5 | `docs/BILLING-READY-05-PAYMENT-PROVIDER-READINESS-REVIEW.md` | Parent readiness review |
| 6 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence governance |
| 7 | `frontend/app/[locale]/account/page.tsx` | Account route (redirect only) |
| 8 | `frontend/app/[locale]/layout.tsx` | Locale layout with TranslationProvider |
| 9 | `frontend/app/[locale]/app/page.tsx` | Main workspace page (for fetch patterns) |
| 10 | `frontend/components/TranslationProvider.tsx` | Translation context provider |
| 11 | `frontend/components/LanguageSwitcher.tsx` | Language switch + useTranslations usage |
| 12 | `frontend/components/workspace/workspace-account-menu.tsx` | Account menu (existing fetch patterns) |
| 13 | `frontend/components/workspace/workspace-sidebar.tsx` | Sidebar (Heroicons, message resolution) |
| 14 | `frontend/components/platform/platform-dashboard.tsx` | Platform page (Heroicons usage) |
| 15 | `frontend/hooks/useTranslations.ts` | Translation hook implementation |
| 16 | `frontend/messages/en.json` | English translations (full) |
| 17 | `services/api-gateway/src/billing/checkout/checkout.controller.ts` | Checkout controller |
| 18 | `services/api-gateway/src/billing/checkout/config/checkout-price-map.config.ts` | Price/pack mapping |
| 19 | `services/api-gateway/src/billing/checkout/dto/checkout-session-response.dto.ts` | Response DTO |
| 20 | `services/api-gateway/src/billing/subscription/subscription.module.ts` | Subscription module |
| 21 | `services/api-gateway/src/billing/subscription/subscription.repository.ts` | Subscription repository |
| 22 | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Balance repository |
| 23 | `services/api-gateway/src/billing-visibility/billing-visibility.controller.ts` | Existing billing visibility (ApiKey auth) |
| 24 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Provider interface contracts |
| 25 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Provider implementation |

---

## 20. Safety Confirmations

| Constraint | Status |
|-----------|--------|
| No source/governance/frontend/backend/env/package/migration files changed | **CONFIRMED** — only this readiness doc created |
| No tests/builds/runtime/provider/browser calls | **CONFIRMED** |
| No subagents used | **CONFIRMED** |
| BILLING-READY-05F ready for Step 3 | **YES** |

---

## 21. Summary

**BILLING-READY-05F Step 2: COMPLETE.**

One readiness document created. No implementation, no source changes, no provider calls, no runtime work, no subagents. Step 3 can proceed as one bounded frontend+backend implementation slice with GPT-5.3 Codex.
