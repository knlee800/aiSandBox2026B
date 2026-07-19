# ANOMALY-01 Step 2 — Investigation / Preflight / Fix Proposal

**Task ID:** ANOMALY-01
**Step:** 2 — Investigation / Preflight / Fix Proposal
**Date:** 2026-07-19
**Status:** COMPLETE
**Nature:** Investigation and fix proposal only — no source/test/translation/package changes

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | ANOMALY-01 |
| Title | Auth Route Multilingual UX/UI Regression Investigation |
| Family | ANOMALY / AUTH ROUTES / MULTILINGUAL UX/UI / REGRESSION INVESTIGATION |
| Risk | HIGH |
| Step 1 | COMPLETE (Registration — 2026-07-19) |
| Step 2 | COMPLETE (this document — 2026-07-19) |
| Step 3 | PENDING |
| Parent tasks | BILLING-READY-07 COMPLETE and LOCKED; BILLING-READY-07A COMPLETE and LOCKED |
| First observed | BILLING-READY-07 Step 3 (2026-07-17) — Keith manual visual browser smoke |
| Keith approval | "go" — 2026-07-19 |

---

## 2. Files Inspected

| File | Purpose |
|------|---------|
| `TASKS.md` (ANOMALY-01 section) | Task registration and acceptance criteria |
| `TASKS_BACKLOG_FULL.md` (ANOMALY-01 section) | Backlog entry and context |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence governance |
| `frontend/app/[locale]/login/page.tsx` | Current login page renderer |
| `frontend/app/[locale]/register/page.tsx` | Current register page renderer |
| `frontend/app/[locale]/login/page.test.tsx` | Login page test harness |
| `frontend/app/[locale]/layout.tsx` | Locale layout (TranslationProvider) |
| `frontend/app/[locale]/page.tsx` | Landing page (PublicLandingSlice reference) |
| `frontend/app/[locale]/billing/page.tsx` | Billing page (modern design reference) |
| `frontend/components/public/public-landing-slice.tsx` | Landing page component (modern design reference) |
| `frontend/components/public/login.test.tsx` | Login test assertions |
| `frontend/components/public/register.test.tsx` | Register test assertions |
| `frontend/components/billing/billing-page-client.tsx` | Billing client (current design standard reference) |
| `frontend/components/auth/logout-button.tsx` | Logout component |
| `frontend/hooks/useTranslations.ts` | Translation hook |
| `frontend/messages/en.json` | English translations (login/register keys) |
| `frontend/messages/zh-TW.json` | Traditional Chinese translations (login/register keys) |
| `frontend/messages/zh-CN.json` | Simplified Chinese translations (login/register keys) |
| `frontend/package.json` | Dependencies (`@heroicons/react` confirmed) |
| `docs/UX-IA-03-CHECKPOINT.md` | Login/register polish history |
| `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` | Auth UX inventory |
| `docs/AUTH-APP-01G2-CHECKPOINT.md` | OAuth button polish history |
| `docs/AUTH-APP-01C2E-CHECKPOINT.md` | Email verification UX history |
| `docs/AUTH-UX-01-CHECKPOINT.md` | Auth guard + router.replace history |
| `docs/BILLING-READY-07-CHECKPOINT.md` | ANOMALY-01 deferred recording |
| `docs/BILLING-READY-07-AUTHENTICATED-BILLING-SMOKE-EXECUTION.md` | Original ANOMALY-01 observation |
| `docs/BILLING-READY-07A-VISUAL-BROWSER-PREFLIGHT.md` | ANOMALY-01 boundary documentation |
| `docs/BILLING-READY-07A-VISUAL-BROWSER-RERUN-EXECUTION.md` | Rerun ANOMALY-01 confirmation |
| `docs/BILLING-READY-07-CONSOLIDATION-DECISION.md` | Outcome B documentation |

Git log evidence: `git log --oneline --follow -20` for both login and register page files.

---

## 3. Current Route Rendering Map

| Route | Renderer | Component type |
|-------|----------|---------------|
| `/en/login` | `frontend/app/[locale]/login/page.tsx` → `LoginPage` | Self-contained page component (inline UI) |
| `/en/register` | `frontend/app/[locale]/register/page.tsx` → `RegisterPage` | Self-contained page component (inline UI) |
| `/zh-TW/login` | Same file → `LoginPage` (via `[locale]` dynamic segment) | Same component, locale-aware |
| `/zh-TW/register` | Same file → `RegisterPage` (via `[locale]` dynamic segment) | Same component, locale-aware |
| `/zh-CN/login` | Same file → `LoginPage` (via `[locale]` dynamic segment) | Same component, locale-aware |
| `/zh-CN/register` | Same file → `RegisterPage` (via `[locale]` dynamic segment) | Same component, locale-aware |

All six locale routes render through the same page files. The `[locale]/layout.tsx` wraps them in `TranslationProvider` with locale-specific messages.

---

## 4. Intended Auth UI Source

**There is no separate "newer" auth UI component that should be rendered but isn't.**

The current `login/page.tsx` and `register/page.tsx` ARE the latest implemented auth page versions. Git history confirms the most recent commits:

1. `4bc0366` — AUTH-UX-01 (2026-05-29): auth guard + router.replace
2. `a67b907` — AUTH-APP-01C2E (2026-05-08): AuthStatusBanner, forgot-password link, resend verification
3. `374622e` — AUTH-APP-01G2 (2026-05-07): OAuth error banner, button polish
4. `fd83feb` — UX-IA-03 (2026-05-06): Design token migration, i18n completion

No subsequent commit reverted or replaced these files. No parallel "v2 auth page" component exists anywhere in the codebase. The `frontend/lib/auth-module/` directory is for generated sandbox apps, not the platform's own auth pages.

---

## 5. Legacy Auth UI Source

The "legacy" label refers to the current login/register pages themselves. They are NOT a prior version that was accidentally restored — they ARE the latest version, but their visual design has not evolved to match the application's current design standard.

**Current auth page design characteristics (visually dated):**
- Minimal centered card: `flex min-h-screen items-center justify-center bg-surface-raised`
- Fixed-width: `w-96 rounded-lg border border-border bg-surface-base p-8 shadow-md`
- No application logo or contextual branding in the card
- No Heroicons anywhere on the page
- Basic inline error display without icons
- No loading skeleton state
- No contextual navigation (back link)
- `LanguageSwitcher` floating in top-right corner (detached from card context)

**Current application design standard (billing page, July 2026):**
- Responsive layout: `max-w-2xl mx-auto px-4 py-8`
- Heroicons throughout: `ArrowLeftIcon`, `CheckCircleIcon`, `XCircleIcon`, `ExclamationTriangleIcon`
- Icon-enhanced banners: `rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-2`
- Loading skeleton: `animate-pulse space-y-4`
- Error state with icon: `ExclamationTriangleIcon` + retry button
- Back navigation: `ArrowLeftIcon` + text link
- Card-based sections with consistent spacing

---

## 6. Root Cause

**Design-language drift.** The auth pages were last visually polished on 2026-05-06 (UX-IA-03) and functionally extended through 2026-05-29 (AUTH-UX-01). Since then, the application's visual design standard evolved significantly — particularly through the billing UI (BILLING-READY-05F, 2026-07-15) and workspace improvements. The auth pages retained their May 2026 visual design while the rest of the app moved to a more polished standard with Heroicons, responsive layouts, and icon-enhanced feedback patterns.

This is a design-standard drift issue, NOT:
- A route/component wiring problem
- A file reversion
- A lost newer implementation
- A backend issue
- An auth logic issue

---

## 7. Locale Impact

**All six locale routes are affected through the same component path.**

- `/en/login` and `/en/register` — affected
- `/zh-TW/login` and `/zh-TW/register` — affected (same page components)
- `/zh-CN/login` and `/zh-CN/register` — affected (same page components)

All locale variants share the same page files via the `[locale]` dynamic segment. Fixing `login/page.tsx` and `register/page.tsx` fixes all six routes simultaneously.

---

## 8. Auth Logic Impact

**This does NOT affect authentication logic.**

All auth functionality is fully operational and unchanged:
- `POST /api/auth/login` — works correctly
- `POST /api/auth/register` — works correctly
- Session cookie (`aisandbox_session`) — set correctly
- Auth guard redirect (authenticated user → `/[locale]/app`) — works correctly
- `router.replace` post-login — works correctly
- OAuth links (Google, Apple) — functional
- Email verification banner — functional
- Forgot-password link — functional
- Resend verification — functional
- `LanguageSwitcher` — functional
- i18n keys — all present in all three locales

**Confirmed during BILLING-READY-07 Step 3 and BILLING-READY-07A Step 3 rerun:** Keith successfully registered, logged in, and reached authenticated billing pages. Functional auth PASS.

---

## 9. Smallest Safe Fix Proposal

**Bounded visual refresh of login and register page components to align with current application design standard.**

Scope:
1. Update card/page layout from fixed `w-96` to responsive design
2. Add application branding (existing `common.appName` key — no new translation needed)
3. Add contextual Heroicons for visual consistency (e.g., envelope icon near email, lock near password)
4. Update banner styling to use icon-enhanced pattern (matching billing page)
5. Add loading state visual feedback during form submission
6. Improve `LanguageSwitcher` placement (integrate into card header vs floating detached)
7. Preserve ALL existing auth logic, handlers, guards, OAuth links, and redirect behavior exactly

Constraints honored:
- Frontend-only
- Route/component wiring preserved (same page files, same routes)
- Multilingual-safe (use existing keys; add new keys only if new UI text introduced)
- Minimal and reversible
- No backend/session/auth policy change
- No billing/payment/provider work
- No dependency/package change (`@heroicons/react` already in `package.json` at `^2.2.0`)
- No broad redesign (bounded to login + register pages only)
- No app-wide navigation rewrite

---

## 10. Exact Files Proposed for Step 3

| File | Action | Purpose |
|------|--------|---------|
| `frontend/app/[locale]/login/page.tsx` | MODIFY | Visual refresh — layout, icons, branding, banner styling |
| `frontend/app/[locale]/register/page.tsx` | MODIFY | Visual refresh — layout, icons, branding |
| `frontend/messages/en.json` | MODIFY (if needed) | Add any new translation keys for new UI text |
| `frontend/messages/zh-TW.json` | MODIFY (if needed) | Same keys in Traditional Chinese |
| `frontend/messages/zh-CN.json` | MODIFY (if needed) | Same keys in Simplified Chinese |
| `frontend/app/[locale]/login/page.test.tsx` | MODIFY | Update assertions if rendered structure changes |
| `frontend/components/public/login.test.tsx` | MODIFY (if needed) | Update test mocks if imports change |
| `frontend/components/public/register.test.tsx` | MODIFY (if needed) | Update test mocks if imports change |

**Maximum proposed: 8 files. Minimum proposed: 2 files** (login/page.tsx + register/page.tsx if no new i18n keys and tests pass without modification).

---

## 11. Translation Impact

**Minimal to moderate.**

Existing keys sufficient for current UI text:
- `login.title`, `login.email`, `login.password`, `login.loginButton`, `login.loggingIn`, `login.loginFailed`, `login.orContinueWith`, `login.continueWithGoogle`, `login.continueWithApple`, `login.needAccount`, `login.startHere`, `login.forgotPassword`, `login.emailVerified`
- `register.title`, `register.email`, `register.password`, `register.registerButton`, `register.registering`, `register.registerFailed`, `register.successMessage`, `register.orContinueWith`, `register.continueWithGoogle`, `register.continueWithApple`, `register.alreadyHaveAccount`, `register.loginHere`, `register.resendVerification`, `register.verificationResent`
- `errors.oauthFailed`, `errors.accountConflict`, `errors.verificationExpired`

Potential new keys (only if new subtitle/welcome text added):
- `login.subtitle` — e.g., "Sign in to continue building" / equivalent zh-TW / zh-CN
- `register.subtitle` — e.g., "Create your account to get started" / equivalent zh-TW / zh-CN

**All translation changes must update en.json, zh-TW.json, and zh-CN.json together.**

---

## 12. Icon Impact

**Yes — Heroicons v2 Outline will be added.**

Import pattern (matching existing billing page usage):
```typescript
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';
```

- `@heroicons/react` already installed at `^2.2.0` in `frontend/package.json`
- No new package dependency required
- Only `@heroicons/react/24/outline` variant permitted per governance rules
- Icons are decorative/contextual — they do not replace text labels

---

## 13. Validation Plan

Step 3 targeted validation:

| # | Command | Purpose |
|---|---------|---------|
| 1 | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit` | TypeScript type-check |
| 2 | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test` | Full frontend test suite |
| 3 | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build` | Production build |
| 4 | `git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo` | Restore build artifact |
| 5 | ReadLints on changed files | Confirm no linter errors introduced |

**Live browser smoke is NOT required for Step 3** — auth logic is unchanged; only visual styling changes. However, Keith may optionally perform visual confirmation after Step 3 completes.

---

## 14. Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| Auth logic regression | LOW | No auth handler, guard, or redirect logic modified |
| i18n regression | LOW | Existing keys preserved; new keys added to all 3 locales together |
| Test breakage | LOW-MEDIUM | Tests may need mock updates if rendered HTML structure changes |
| Visual regression elsewhere | NONE | Changes confined to login + register page components only |
| Route breakage | NONE | No routing changes; same file paths, same exports |
| Accessibility regression | LOW | Same form structure; icons are decorative |
| Billing/payment interference | NONE | Auth pages have no billing code |
| Backend interference | NONE | Frontend-only changes |

---

## 15. Split Decision

**Step 3 can implement safely within ANOMALY-01.**

Justification:
- Only 2 production source files change (login/page.tsx, register/page.tsx)
- Translation files change only if new keys added (3 files maximum)
- Test files may need update (2-3 files maximum)
- Total maximum: 8 files
- All changes are frontend-only, visual-only, and reversible
- No architectural change
- No dependency change
- No backend impact
- Bounded and small enough for a single implementation step

**No child task split needed.**

---

## 16. Non-Goals Confirmed

Step 3 will NOT:
- Change authentication logic, session handling, or auth guards
- Change backend services, controllers, or modules
- Change routing structure or route paths
- Add new pages or routes
- Change navigation architecture
- Add new npm dependencies
- Change billing, payment, provider, or Stripe-related code
- Change Docker, database, migration, or entity files
- Change the workspace, landing page, or other non-auth pages
- Perform a broad app-wide redesign
- Change internal service communication
- Touch environment files or secrets
- Alter CSRF, rate limiting, or security hardening

---

## 17. Safety Confirmations

| Confirmation | Status |
|--------------|--------|
| No source files modified in this step | CONFIRMED |
| No test files modified in this step | CONFIRMED |
| No translation files modified in this step | CONFIRMED |
| No package files modified in this step | CONFIRMED |
| No migration/entity/schema files modified | CONFIRMED |
| No environment files modified or inspected | CONFIRMED |
| No Docker files modified | CONFIRMED |
| No governance files modified | CONFIRMED |
| No runtime/Docker/DB/browser/API activity | CONFIRMED |
| No tests/build/lint/typecheck run | CONFIRMED |
| No git commit or push | CONFIRMED |
| No subagents used | CONFIRMED |
| No secret-bearing environment file opened | CONFIRMED |
| No billing/payment/provider/Stripe work | CONFIRMED |

---

## 18. Exact Next Action

**ANOMALY-01 Step 3 — Implementation.**

Execute bounded visual refresh of `frontend/app/[locale]/login/page.tsx` and `frontend/app/[locale]/register/page.tsx`:
1. Update card layout to responsive design matching current app standard
2. Add Heroicons (outline, decorative)
3. Add application branding via existing `common.appName` translation key
4. Improve LanguageSwitcher integration
5. Enhance loading/error state visual feedback
6. Add translation keys to all 3 locales if new UI text introduced
7. Update tests as needed
8. Run validation commands (tsc, test, build)
9. Produce Step 3 checkpoint

**Model recommendation:** GPT-5.3 Codex — routine bounded frontend implementation.

---

## Investigation Questions — Final Answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Which file renders `/[locale]/login`? | `frontend/app/[locale]/login/page.tsx` → `LoginPage` component |
| 2 | Which file renders `/[locale]/register`? | `frontend/app/[locale]/register/page.tsx` → `RegisterPage` component |
| 3 | Intended current auth UI? | The same page files — there is no separate "newer" implementation |
| 4 | Older/legacy auth UI? | The same page files — "legacy" refers to their visual design being dated vs current app standard |
| 5 | Why are active routes using legacy UI? | Design-language drift — pages polished May 2026, app standard evolved July 2026 |
| 6 | zh-TW and zh-CN affected same path? | YES — all six locale routes share the same page components via `[locale]` segment |
| 7 | Auth logic affected? | NO — visual/UX only; all auth functionality works correctly |
| 8 | Smallest safe fix? | Bounded visual refresh of login + register page components |
| 9 | Files for Step 3? | 2-8 files (login/page.tsx, register/page.tsx, translations×3, tests×3 maximum) |
| 10 | Translation changes? | Possibly 0-2 new keys (subtitle text); all existing keys preserved |
| 11 | Icon changes? | YES — add Heroicons v2 Outline (already installed, no new dep) |
| 12 | Targeted validation? | `npx tsc --noEmit`, `npm test`, `npm run build`, ReadLints |
| 13 | Safe for Step 3 or split? | Safe for Step 3 — no child task split needed |

---

## Multilingual Requirements Confirmed

- App is multilingual-first.
- No hardcoded English UX/UI copy permitted.
- Any auth copy changes must update together:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use existing `useTranslations` hook pattern.
- Icon changes must use Heroicons v2 Outline only: `@heroicons/react/24/outline`.
- Existing translation keys: all present and verified in all 3 locales.

---

**ANOMALY-01 Step 2 — COMPLETE.**
