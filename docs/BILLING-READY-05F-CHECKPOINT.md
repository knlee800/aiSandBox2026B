# BILLING-READY-05F — Checkpoint

**Task ID:** BILLING-READY-05F
**Parent:** BILLING-READY-05
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-15
**Nature:** Billing UI / Customer Portal frontend+backend surface

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-05F |
| Parent | BILLING-READY-05 |
| Family | BILLING READY / STRIPE PAYMENT PROVIDER / BILLING UI / CUSTOMER PORTAL |
| Risk | HIGH — 4-step child-slice loop |
| Registered | 2026-07-15 |
| Completed | 2026-07-15 |
| Keith approval | Keith explicitly approved BILLING-READY-05F registration 2026-07-15. |
| Status | **COMPLETE and LOCKED** |

---

## 2. Step 2 Readiness Summary

**Readiness review:** `docs/BILLING-READY-05F-BILLING-UI-CUSTOMER-PORTAL-READINESS.md`

| Decision | Outcome |
|----------|---------|
| Step 3 structure | **Decision B — one bounded frontend+backend Step 3** |
| Backend read endpoints needed | **YES** — `GET /api/billing/balance` and `GET /api/billing/subscription` |
| Dedicated frontend billing route | **`frontend/app/[locale]/billing/page.tsx`** — new dedicated billing page |
| Customer portal | **Disabled / stub only** — "Coming soon" UI, no backend portal endpoint, no provider/portal API call |
| No provider/customer portal API calls | **CONFIRMED** — not approved |
| No Stripe SDK/package/env/secrets changes | **CONFIRMED** — not approved |
| No migrations | **CONFIRMED** — not approved |
| No browser smoke | **CONFIRMED** — not performed |
| Multilingual-first required | **CONFIRMED** — en.json, zh-TW.json, zh-CN.json all updated |
| Heroicons v2 Outline only | **CONFIRMED** — all icons from `@heroicons/react/24/outline` |

---

## 3. Backend Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/billing/billing-read.controller.ts` | `BillingReadController` — `GET /api/billing/balance`, `GET /api/billing/subscription` |
| 2 | `services/api-gateway/src/billing/billing-read.module.ts` | `BillingReadModule` — imports `CreditPersistenceModule`, `SubscriptionModule`, `AuthModule` |
| 3 | `services/api-gateway/src/billing/__tests__/billing-read.controller.spec.ts` | Unit tests for read endpoints — 12 tests |

---

## 4. Backend File Modified

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/app.module.ts` | `BillingReadModule` import only — one line added |

---

## 5. Frontend Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `frontend/app/[locale]/billing/page.tsx` | Billing page — server component wrapper |
| 2 | `frontend/components/billing/billing-page-client.tsx` | Client component with data fetching, state, and UI |
| 3 | `frontend/components/billing/billing-balance-card.tsx` | Credit balance display card |
| 4 | `frontend/components/billing/billing-subscription-card.tsx` | Subscription status card |
| 5 | `frontend/components/billing/billing-topup-section.tsx` | Top-up pack grid with checkout buttons |
| 6 | `frontend/hooks/useBillingData.ts` | Custom hook for fetching balance + subscription |
| 7 | `frontend/components/billing/__tests__/billing-page-client.test.tsx` | Component render/behavior tests — 22 tests |

---

## 6. Translation Files Modified

| File | Action |
|------|--------|
| `frontend/messages/en.json` | Added `"billing"` namespace — 30 keys |
| `frontend/messages/zh-TW.json` | Added `"billing"` namespace — 30 keys |
| `frontend/messages/zh-CN.json` | Added `"billing"` namespace — 30 keys |

- New billing namespace with identical key set across all three locales
- `useTranslations('billing')` hook used in all billing components
- No hardcoded English UI copy

---

## 7. Backend Endpoint Behavior

### GET /api/billing/balance

| Aspect | Detail |
|--------|--------|
| Returns | `{ balance, monthlyAllocation, planId, periodStart, periodEnd, status }` |
| Empty/free state | Returns safe default `{ balance: 0, monthlyAllocation: 0, planId: 'free', periodStart: null, periodEnd: null, status: 'active' }` when no balance row |
| Auth | `SessionCookieGuard` only — browser-session cookies |
| API key access | **NO** — `ApiKeyAuthGuard` not used |
| Cross-user access | **NO** — only reads `req.user.userId` |
| Provider calls | **NONE** |
| Credit mutation | **NONE** |
| Secrets in response | **NONE** |

### GET /api/billing/subscription

| Aspect | Detail |
|--------|--------|
| Returns | `{ planType, status, currentPeriodStart, currentPeriodEnd, cancelAt }` or `null` |
| No subscription | Returns `null` — safe empty state |
| Auth | `SessionCookieGuard` only |
| API key access | **NO** |
| Cross-user access | **NO** |
| Provider calls | **NONE** |
| Provider IDs in response | **NONE** — `stripeSubscriptionId`, `stripePriceId` not returned |

---

## 8. Billing Page / Component Behavior

| Feature | Detail |
|---------|--------|
| Route | `/[locale]/billing` — dedicated billing page |
| Balance card | Shows current credit balance, monthly allocation, plan |
| Subscription card | Shows current plan type, status, renewal date |
| Top-up package section | Grid of 3 packs (1,000 / 5,000 / 20,000 credits) with checkout buttons |
| Upgrade section | Shown for free-plan users — prompts upgrade |
| Customer portal card | Disabled — "Coming soon" UI |
| Loading state | Skeleton/shimmer placeholder while fetching |
| Error state | Error banner with retry button |
| Empty/free state | Free plan informational display — no error styling |
| Checkout success banner | Shown when `?checkout=success` query param present |
| Checkout cancelled banner | Shown when `?checkout=cancelled` query param present |
| Responsive layout | `max-w-2xl mx-auto` centered, cards stack vertically |
| Navigation/sidebar changes | **NONE** — changes confined to new `/billing` route |

---

## 9. Checkout Flow

| Aspect | Detail |
|--------|--------|
| Subscription checkout | Calls `POST /api/billing/checkout/subscription` with `{ planId, successUrl, cancelUrl }` |
| Top-up checkout | Calls `POST /api/billing/checkout/topup` with `{ topUpPackId, successUrl, cancelUrl }` |
| Success URL | `${window.location.origin}/${locale}/billing?checkout=success` — same-origin |
| Cancel URL | `${window.location.origin}/${locale}/billing?checkout=cancelled` — same-origin |
| Redirect | `window.location.href = checkoutUrl` — full page redirect |
| Error mapping | 503 → billing unavailable; 409 → active subscription exists; 400 → invalid request |
| User-supplied price IDs | **REJECTED** — none accepted |

---

## 10. Customer Portal Behavior

| Aspect | Detail |
|--------|--------|
| UI | Disabled button — "Manage Subscription" with "Coming soon" subtext |
| Backend portal endpoint | **DOES NOT EXIST** — no controller created for portal |
| `createBillingPortalSession()` | **NOT CALLED** — provider method exists but not exposed |
| Provider/customer portal API call | **NONE** |

---

## 11. Heroicons Usage

| Icon | Usage | Import |
|------|-------|--------|
| `CreditCardIcon` | Credit balance card header | `@heroicons/react/24/outline` |
| `BanknotesIcon` | Top-up section header | `@heroicons/react/24/outline` |
| `ArrowPathIcon` | Subscription renewal indicator | `@heroicons/react/24/outline` |
| `SparklesIcon` | Upgrade prompt accent | `@heroicons/react/24/outline` |
| `ArrowLeftIcon` | "Back to Workspace" navigation | `@heroicons/react/24/outline` |
| `CheckCircleIcon` | Checkout success state | `@heroicons/react/24/outline` |
| `XCircleIcon` | Checkout cancelled / error state | `@heroicons/react/24/outline` |
| `ExclamationTriangleIcon` | Billing unavailable banner | `@heroicons/react/24/outline` |

All icons: `h-5 w-5` sizing, Tailwind color classes. No Lucide / Font Awesome / Material Icons / emoji.

---

## 12. UX/UI Boundedness

| Constraint | Status |
|-----------|--------|
| Changes confined to new `/billing` route | **CONFIRMED** |
| No workspace/sidebar/account/navigation modifications | **CONFIRMED** |
| No broad redesign | **CONFIRMED** — net-new page |
| No dependency additions | **CONFIRMED** — `@heroicons/react` already installed |
| Existing Tailwind patterns | **CONFIRMED** |
| Impeccable/Emil advisory constraints preserved | **CONFIRMED** — advisory only, did not override governance |

---

## 13. Tests and Validation

| Suite / Command | Count | Result |
|----------------|-------|--------|
| `billing-read.controller.spec.ts` | 12 tests | **PASS** |
| `billing-page-client.test.tsx` | 22 tests | **PASS** |
| `npx jest --runInBand "billing-read"` (api-gateway) | 12/12 | **PASS** |
| `npx jest --runInBand "checkout"` (api-gateway) | 58/58 | **PASS** |
| `npx tsc --noEmit` (api-gateway) | — | **PASS, exit code 0** |
| `npx tsx --test "components/billing/__tests__/*"` (frontend) | 22/22 | **PASS** |
| `npm test` (frontend) | 640/640 | **PASS** |
| `npx tsc --noEmit` (frontend) | — | **PASS, exit code 0** |
| Linter on all new/changed files | — | **PASS, 0 errors** |

---

## 14. Safety Confirmations

| Constraint | Status |
|-----------|--------|
| No subagents used | **CONFIRMED** |
| No Stripe SDK / package / env / secrets changes | **CONFIRMED** |
| No provider / payment / customer portal API calls | **CONFIRMED** |
| No Stripe CLI / webhook tests | **CONFIRMED** |
| No migrations | **CONFIRMED** |
| No Docker changes | **CONFIRMED** |
| No governance changes during Step 3 | **CONFIRMED** |
| No Docker / Postgres / Redis / runtime calls | **CONFIRMED** |
| No real DB calls | **CONFIRMED** |
| No credit balance mutation / accounting changes | **CONFIRMED** |
| No browser smoke | **CONFIRMED** |
| No AGENT-HARNESS write canary | **CONFIRMED** |

---

## 15. Parent / Child Status

| Task | Status |
|------|--------|
| BILLING-READY-05 | **ACTIVE** — Steps 1–2 COMPLETE. Step 3 IN PROGRESS via child slices |
| BILLING-READY-05A | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05B | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05C | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05D | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05E | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05F | **COMPLETE and LOCKED** — 2026-07-15 |
| BILLING-READY-05G | Planned only — next recommended — not registered |
| BILLING-READY-04 | **COMPLETE and LOCKED** — 2026-07-13 |
| BILLING-READY-03 | **COMPLETE and LOCKED** — 2026-07-07 |
| AGENT-PLATFORM-07F | **COMPLETE and LOCKED** — 2026-07-12 |
| AGENT-HARNESS-07 | **COMPLETE and LOCKED** — 2026-07-07 |
| AGENT-HARNESS-06E | **COMPLETE and LOCKED** — 2026-07-09 |

---

## 16. Next Recommended Task

**BILLING-READY-05G — Regression / Runtime Validation + Parent Consolidation**

- Not registered.
- Owns: full regression matrix across all 05A–05F slices, parent BILLING-READY-05 close checkpoint, optional live runtime/browser smoke for billing UI.
- Prerequisite: 05F COMPLETE and LOCKED (satisfied).
- Registration requires Keith explicit approval.
- Note: 05G will likely need explicit approval for Docker/Postgres/Redis readiness and runtime/browser/provider-safety decisions before Step 3. Provider/payment/customer portal calls remain not approved. Stripe SDK/package install remains not approved. Browser smoke requires explicit Keith approval.

---

## 17. Files Changed During Consolidation

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-05F-CHECKPOINT.md` | CREATED — this file |
| 2 | `TASKS.md` | UPDATED — 05F COMPLETE and LOCKED, split table updated, validation recorded |
| 3 | `TASKS_BACKLOG_FULL.md` | UPDATED — mirrors TASKS.md |
| 4 | `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATED — 05F COMPLETE and LOCKED, 05G next recommended not registered |

**No implementation, test, migration, translation, or runtime files changed during consolidation.**
