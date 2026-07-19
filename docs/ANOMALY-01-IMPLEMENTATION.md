# ANOMALY-01 Step 3 — Bounded Auth Route Multilingual UX/UI Refresh Implementation

**Task ID:** ANOMALY-01
**Step:** 3 — Implementation
**Date:** 2026-07-19
**Status:** COMPLETE
**Nature:** Frontend-only visual refresh — no auth/backend/billing logic changed

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | ANOMALY-01 |
| Title | Auth Route Multilingual UX/UI Regression Investigation |
| Family | ANOMALY / AUTH ROUTES / MULTILINGUAL UX/UI / REGRESSION INVESTIGATION |
| Risk | HIGH |
| Step 1 | COMPLETE (Registration — 2026-07-19) |
| Step 2 | COMPLETE (Investigation / Preflight — 2026-07-19) |
| Step 3 | COMPLETE (Implementation — 2026-07-19, this document) |
| Step 4 | PENDING (Consolidation) |
| Parent tasks | BILLING-READY-07 COMPLETE and LOCKED; BILLING-READY-07A COMPLETE and LOCKED |

---

## 2. Investigation Basis

Source of truth: `docs/ANOMALY-01-INVESTIGATION-PREFLIGHT.md` (Step 2).

Root cause: Design-language drift. Auth pages were last visually polished 2026-05-06 (UX-IA-03). The application's visual design standard evolved significantly through July 2026 billing UI work. The auth pages retained their May 2026 visual design while the rest of the app moved to a more polished standard with Heroicons, responsive layouts, and icon-enhanced feedback patterns.

This is NOT a route wiring problem, file reversion, backend issue, or lost newer implementation.

---

## 3. Files Changed

| # | File | Action |
|---|------|--------|
| 1 | `frontend/app/[locale]/login/page.tsx` | MODIFIED — visual refresh |
| 2 | `frontend/app/[locale]/register/page.tsx` | MODIFIED — visual refresh |
| 3 | `frontend/messages/en.json` | MODIFIED — added 2 keys |
| 4 | `frontend/messages/zh-TW.json` | MODIFIED — added 2 keys |
| 5 | `frontend/messages/zh-CN.json` | MODIFIED — added 2 keys |
| 6 | `frontend/app/[locale]/login/page.test.tsx` | MODIFIED — added Heroicons mock |
| 7 | `frontend/components/public/login.test.tsx` | MODIFIED — added Heroicons mock |
| 8 | `frontend/components/public/register.test.tsx` | MODIFIED — added Heroicons mock |

**Files created:**

| # | File |
|---|------|
| 1 | `docs/ANOMALY-01-IMPLEMENTATION.md` (this document) |

---

## 4. Visual Refresh Summary

### Layout changes (both pages)
- Outer container: added `px-4` for mobile responsiveness
- Card wrapper: added `w-full max-w-md` parent for responsive width
- Card: `w-96 rounded-lg shadow-md p-8` → `rounded-xl shadow-lg px-8 pb-8 pt-6` (polished elevation, responsive width)
- LanguageSwitcher: moved from floating `absolute top-4 right-4` to integrated card header row

### Header changes (both pages)
- Title and new subtitle text in left-aligned header block
- LanguageSwitcher aligned to right side of header row
- Subtitle provides contextual guidance (new i18n keys)

### Form field changes (both pages)
- Email field: added `EnvelopeIcon` (left-aligned, decorative) with `pl-10` input padding
- Password field: added `LockClosedIcon` (left-aligned, decorative) with `pl-10` input padding
- Input height: `py-2` → `py-2.5` for more generous touch target

### Banner changes (login page)
- AuthStatusBanner verified state: `bg-green-100 text-green-700 rounded-md` → `rounded-lg border border-green-200 bg-green-50 flex items-center gap-2` with `CheckCircleIcon`
- AuthStatusBanner error state: `bg-red-100 text-red-700 rounded-md` → `rounded-lg border border-red-200 bg-red-50 flex items-center gap-2` with `ExclamationTriangleIcon`
- Inline error: same icon-enhanced pattern with `ExclamationTriangleIcon`
- Banners moved above form for better visibility

### Banner changes (register page)
- Error: `bg-red-100 text-red-700 rounded-md` → `rounded-lg border border-red-200 bg-red-50 flex items-center gap-2` with `ExclamationTriangleIcon`
- Success: `bg-green-100 text-green-700 rounded-md` → `rounded-lg border border-green-200 bg-green-50 flex items-center gap-2` with `CheckCircleIcon`
- Verification resent: same icon-enhanced pattern with `CheckCircleIcon`

### Button and spacing changes (both pages)
- Submit button: added `text-sm font-medium`, `py-2` → `py-2.5`
- OAuth buttons: added `text-sm font-medium`, `py-2` → `py-2.5`, wrapped in `space-y-3` container
- Divider: `my-4` → `my-5`
- Bottom link: `mt-4` → `mt-5`

---

## 5. Auth Logic Preservation

All auth logic is preserved exactly, line-for-line:

| Behavior | Status |
|----------|--------|
| `useSafeEffect` auth guard (fetch `/api/auth/me`, redirect if authenticated) | PRESERVED |
| `handleLogin` / `handleRegister` form submit handler | PRESERVED |
| `axios.post('/api/auth/login', ...)` with `Accept-Language` header | PRESERVED |
| `axios.post('/api/auth/register', ...)` with `Accept-Language` header | PRESERVED |
| `router.replace(\`/\${locale}/app\`)` redirect after login | PRESERVED |
| `router?.replace(\`/\${locale}/app\`)` redirect after register auth guard | PRESERVED |
| OAuth links (`/api/auth/google?locale=`, `/api/auth/apple?locale=`) | PRESERVED |
| `handleResendVerification` (`/api/auth/email/verify/resend`) | PRESERVED |
| Error state management (`setError`, `setLoading`, etc.) | PRESERVED |
| Success/registered email state management | PRESERVED |
| Resend status state machine (`idle`/`sending`/`sent`/`error`) | PRESERVED |
| `AuthStatusBanner` search params logic (verified, error) | PRESERVED |
| Forgot-password link (`/\${locale}/forgot-password`) | PRESERVED |
| Register link (`/\${locale}/register`) from login page | PRESERVED |
| Login link (`/\${locale}/login`) from register page | PRESERVED |
| `typeof useRouter === 'function'` guard in register page | PRESERVED |
| `Suspense` boundary around `AuthStatusBanner` | PRESERVED |
| Form element IDs (`email`, `password`, `register-email`, `register-password`) | PRESERVED |

---

## 6. Multilingual Changes

### New keys added (all 3 locales updated together)

| Key | en | zh-TW | zh-CN |
|-----|-----|-------|-------|
| `login.subtitle` | Sign in to continue building | 登入以繼續建構 | 登录以继续构建 |
| `register.subtitle` | Create your account to get started | 建立帳號以開始使用 | 创建账号以开始使用 |

### Existing keys preserved

All existing `login.*`, `register.*`, and `errors.*` keys remain unchanged in all 3 locales. No keys removed, renamed, or modified.

### No hardcoded English UI copy

All visible text uses `useTranslations` hook with translation keys. No hardcoded English strings.

---

## 7. Icon Usage

| Icon | Import path | Usage | Decorative? |
|------|-------------|-------|-------------|
| `EnvelopeIcon` | `@heroicons/react/24/outline` | Email form field (left icon) | YES |
| `LockClosedIcon` | `@heroicons/react/24/outline` | Password form field (left icon) | YES |
| `ExclamationTriangleIcon` | `@heroicons/react/24/outline` | Error banners (left icon) | YES (text label provides meaning) |
| `CheckCircleIcon` | `@heroicons/react/24/outline` | Success banners (left icon) | YES (text label provides meaning) |

- `@heroicons/react` already installed at `^2.2.0` in `frontend/package.json`
- Only `@heroicons/react/24/outline` variant used (per governance rules)
- No Lucide, Font Awesome, Material Icons, or emoji icons used
- Icons do not replace text labels — they supplement them
- Heroicons React v2 components render with `aria-hidden="true"` by default

---

## 8. Tests Updated

| # | File | Change |
|---|------|--------|
| 1 | `frontend/app/[locale]/login/page.test.tsx` | Added `@heroicons/react/24/outline` module mock (IconStub returning `<span>`) |
| 2 | `frontend/components/public/login.test.tsx` | Added `@heroicons/react/24/outline` module mock (IconStub returning `<span>`) |
| 3 | `frontend/components/public/register.test.tsx` | Added `@heroicons/react/24/outline` module mock (IconStub returning `<span>`) |

All existing test assertions preserved:
- Login OAuth error banner tests (oauth_failed, account_conflict)
- Login redirect tests (router.replace, auth guard, fetch failure)
- Login auth status UX tests (forgot password, verified=1, token_expired, account_conflict, oauth_failed)
- Register email verification UX tests (success copy, resend flow, resend API call)

No behavioral test assertions changed. Only module mocking infrastructure updated.

---

## 9. Validation Commands

| # | Command | Result |
|---|---------|--------|
| 1 | `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm test` | PASS — 640 tests, 53 suites, 0 failures |
| 2 | `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit` | PASS — exit code 0, no errors |
| 3 | `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build` | PASS — compiled successfully, all routes generated |
| 4 | `git -C "C:\Users\knlee\aiSandBox2026B" restore -- "frontend/tsconfig.tsbuildinfo"` | DONE — build artifact restored |
| 5 | ReadLints on login/page.tsx and register/page.tsx | PASS — 0 linter errors |

---

## 10. Validation Results

- **npm test:** 640/640 PASS, 53 suites, 0 failures, 0 skipped
- **npx tsc --noEmit:** exit code 0, no type errors
- **npm run build:** compiled successfully in 2.3s, all routes generated
- **ReadLints:** 0 linter errors on changed production files
- **tsconfig.tsbuildinfo:** restored after build

---

## 11. Risk Notes

| Risk | Level | Status |
|------|-------|--------|
| Auth logic regression | LOW | All auth logic preserved line-for-line |
| i18n regression | LOW | Existing keys preserved; 2 new keys added to all 3 locales |
| Test breakage | NONE | 640/640 tests pass, all assertions preserved |
| Visual regression elsewhere | NONE | Changes confined to login + register pages only |
| Route breakage | NONE | No routing changes; same file paths, same exports |
| Accessibility | LOW | Same form structure; icons are decorative; Heroicons render with `aria-hidden="true"` |
| Billing/payment interference | NONE | Auth pages have no billing code |
| Backend interference | NONE | Frontend-only changes |
| Dependency risk | NONE | No new dependencies; `@heroicons/react` already installed |

---

## 12. Remaining Work

- Step 4 — Consolidation checkpoint
- Optional: Keith visual browser confirmation of refreshed auth pages
- Live browser smoke not performed (per task instructions — no frontend/Docker/browser runtime started)

---

## 13. Step 4 Consolidation Recommendation

Step 4 should:
1. Update `TASKS.md` — ANOMALY-01 Step 3 COMPLETE
2. Update `TASKS_BACKLOG_FULL.md` — ANOMALY-01 Step 3 COMPLETE
3. Update `docs/AINOW-EXECUTION-ROADMAP.md` — ANOMALY-01 status
4. Produce consolidation checkpoint document
5. Mark ANOMALY-01 COMPLETE and LOCKED if Keith approves

**Model recommendation:** Sonnet 4.6 — consolidation/governance work.

---

## 14. Safety Confirmations

| Confirmation | Status |
|--------------|--------|
| No backend source modified | CONFIRMED |
| No billing/payment/provider files modified | CONFIRMED |
| No auth/session/backend policy changed | CONFIRMED |
| No authentication logic changed | CONFIRMED |
| No login/register submit behavior changed | CONFIRMED |
| No redirects changed | CONFIRMED |
| No validation rules changed | CONFIRMED |
| No session/cookie handling changed | CONFIRMED |
| No packages/dependencies added or modified | CONFIRMED |
| No migrations/entities/schema modified | CONFIRMED |
| No environment files modified or opened | CONFIRMED |
| No Docker files modified | CONFIRMED |
| No API contracts changed | CONFIRMED |
| No hardcoded English UX/UI copy added | CONFIRMED |
| No Lucide/Font Awesome/Material Icons/emoji icons used | CONFIRMED |
| No Docker/Postgres/Redis started | CONFIRMED |
| No API Gateway started | CONFIRMED |
| No frontend dev server started | CONFIRMED |
| No browser validation performed | CONFIRMED |
| No APIs called | CONFIRMED |
| No migrations run | CONFIRMED |
| No Stripe CLI used | CONFIRMED |
| No payment/provider/customer-portal/webhook work | CONFIRMED |
| No git commit or push | CONFIRMED |
| No subagents used | CONFIRMED |
| No secret-bearing environment file opened | CONFIRMED |

---

**ANOMALY-01 Step 3 — COMPLETE.**
