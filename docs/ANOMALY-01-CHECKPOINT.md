# ANOMALY-01 Checkpoint — Auth Route Multilingual UX/UI Regression Investigation

**Task ID:** ANOMALY-01
**Final Status:** COMPLETE and LOCKED — 2026-07-19
**Checkpoint Date:** 2026-07-19
**Nature:** Governance/consolidation only — no source/test/translation/package/migration/entity/environment/Docker files changed in this step.

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
| Step 3 | COMPLETE (Implementation — 2026-07-19) |
| Step 3B first attempt | BLOCKED (frontend-only, API Gateway unavailable) |
| Step 3B rerun | COMPLETE — PASS (API Gateway allowed — 2026-07-19) |
| Step 4 | COMPLETE (Consolidation / Checkpoint — 2026-07-19, this document) |
| Parent tasks | BILLING-READY-07 COMPLETE and LOCKED — 2026-07-17; BILLING-READY-07A COMPLETE and LOCKED — 2026-07-17 |
| Keith approval | "go" — 2026-07-19 |
| First observed | BILLING-READY-07 Step 3 (2026-07-17) — Keith manual visual browser smoke |

---

## 2. Final Status

**ANOMALY-01 — COMPLETE and LOCKED — 2026-07-19**

- Step 1 COMPLETE (Registration — 2026-07-19)
- Step 2 COMPLETE (Investigation / Preflight — 2026-07-19)
- Step 3 COMPLETE (Implementation — 2026-07-19)
- Step 3B PASS after rerun with API Gateway allowed (2026-07-19)
- Step 4 consolidation COMPLETE (2026-07-19)

Do not modify this task entry after locking except by an explicitly approved follow-up task.

---

## 3. Original Anomaly

Active localized login and registration routes (`/en/login`, `/en/register`, `/zh-TW/login`, `/zh-TW/register`, `/zh-CN/login`, `/zh-CN/register`) rendered the older/legacy auth UI instead of the current application design standard.

- **Functional authentication:** PASS throughout — registration, login, and authenticated sessions worked correctly.
- **Effect:** Real user-facing UX/UI regression. Non-blocking for authenticated billing-data validation.
- **First observed:** During BILLING-READY-07 Step 3 visual smoke (2026-07-17) by Keith.
- **Deferred during:** BILLING-READY-07 consolidation and BILLING-READY-07A. Record-only. Not fixed during those tasks.
- **Registration:** ANOMALY-01 registered ACTIVE — 2026-07-19 — with Keith explicit approval ("go").

---

## 4. Root Cause

**Design-language drift.**

The auth pages (`login/page.tsx`, `register/page.tsx`) were last visually polished on 2026-05-06 (UX-IA-03) and functionally extended through 2026-05-29 (AUTH-UX-01). Since then, the application's visual design standard evolved significantly — particularly through the billing UI (BILLING-READY-05F, 2026-07-15) and workspace improvements. The auth pages retained their May 2026 visual design while the rest of the app moved to a more polished standard with Heroicons, responsive layouts, and icon-enhanced feedback patterns.

This is NOT:
- A route/component wiring problem
- A file reversion
- A lost newer implementation
- A backend issue
- An auth logic issue

There is no separate "newer" auth UI component that should be rendered but isn't. The current `login/page.tsx` and `register/page.tsx` ARE the latest implemented auth page versions. Git history confirmed the most recent functional commits were AUTH-UX-01 (2026-05-29), AUTH-APP-01C2E (2026-05-08), AUTH-APP-01G2 (2026-05-07), and UX-IA-03 (2026-05-06).

---

## 5. Route Rendering Map

| Route | Renderer | Component type |
|-------|----------|---------------|
| `/en/login` | `frontend/app/[locale]/login/page.tsx` → `LoginPage` | Self-contained page component (inline UI) |
| `/en/register` | `frontend/app/[locale]/register/page.tsx` → `RegisterPage` | Self-contained page component (inline UI) |
| `/zh-TW/login` | Same file → `LoginPage` (via `[locale]` dynamic segment) | Same component, locale-aware |
| `/zh-TW/register` | Same file → `RegisterPage` (via `[locale]` dynamic segment) | Same component, locale-aware |
| `/zh-CN/login` | Same file → `LoginPage` (via `[locale]` dynamic segment) | Same component, locale-aware |
| `/zh-CN/register` | Same file → `RegisterPage` (via `[locale]` dynamic segment) | Same component, locale-aware |

All six locale routes render through the same two page files. The `[locale]/layout.tsx` wraps them in `TranslationProvider` with locale-specific messages. There is no separate "newer" auth UI component. Fixing `login/page.tsx` and `register/page.tsx` fixes all six routes simultaneously.

---

## 6. Implementation Summary

Bounded visual refresh of `frontend/app/[locale]/login/page.tsx` and `frontend/app/[locale]/register/page.tsx` to align with current application design standard.

### Layout changes (both pages)
- Outer container: added `px-4` for mobile responsiveness
- Card wrapper: added `w-full max-w-md` parent for responsive width
- Card: `w-96 rounded-lg shadow-md p-8` → `rounded-xl shadow-lg px-8 pb-8 pt-6`
- LanguageSwitcher: moved from floating `absolute top-4 right-4` to integrated card header row

### Header changes (both pages)
- Title and new subtitle text in left-aligned header block
- LanguageSwitcher aligned to right side of header row
- Subtitle provides contextual guidance (new i18n keys: `login.subtitle`, `register.subtitle`)

### Form field changes (both pages)
- Email field: added `EnvelopeIcon` (left-aligned, decorative) with `pl-10` input padding
- Password field: added `LockClosedIcon` (left-aligned, decorative) with `pl-10` input padding
- Input height: `py-2` → `py-2.5` for more generous touch target

### Banner changes (both pages)
- Error banners: plain `bg-red-100` → icon-enhanced `rounded-lg border border-red-200 bg-red-50 flex items-center gap-2` with `ExclamationTriangleIcon`
- Success banners: plain `bg-green-100` → icon-enhanced `rounded-lg border border-green-200 bg-green-50 flex items-center gap-2` with `CheckCircleIcon`
- Banners moved above form for better visibility

### No auth logic changed
No auth handler, guard, redirect, session cookie, OAuth link, resend verification, or error state management logic was modified.

---

## 7. Exact Files Changed

| # | File | Action |
|---|------|--------|
| 1 | `frontend/app/[locale]/login/page.tsx` | MODIFIED — visual refresh |
| 2 | `frontend/app/[locale]/register/page.tsx` | MODIFIED — visual refresh |
| 3 | `frontend/messages/en.json` | MODIFIED — added 2 translation keys |
| 4 | `frontend/messages/zh-TW.json` | MODIFIED — added 2 translation keys |
| 5 | `frontend/messages/zh-CN.json` | MODIFIED — added 2 translation keys |
| 6 | `frontend/app/[locale]/login/page.test.tsx` | MODIFIED — added Heroicons module mock |
| 7 | `frontend/components/public/login.test.tsx` | MODIFIED — added Heroicons module mock |
| 8 | `frontend/components/public/register.test.tsx` | MODIFIED — added Heroicons module mock |

Documents created during this task:
- `docs/ANOMALY-01-INVESTIGATION-PREFLIGHT.md` (Step 2 — investigation report)
- `docs/ANOMALY-01-IMPLEMENTATION.md` (Step 3 — implementation report)
- `docs/ANOMALY-01-VISUAL-SMOKE.md` (Step 3B first attempt — BLOCKED)
- `docs/ANOMALY-01-VISUAL-SMOKE-RERUN.md` (Step 3B rerun — PASS)
- `docs/ANOMALY-01-CHECKPOINT.md` (this document — Step 4)

---

## 8. Translation Changes

### New keys added (all 3 locales updated together)

| Key | en | zh-TW | zh-CN |
|-----|-----|-------|-------|
| `login.subtitle` | Sign in to continue building | 登入以繼續建構 | 登录以继续构建 |
| `register.subtitle` | Create your account to get started | 建立帳號以開始使用 | 创建账号以开始使用 |

### Existing keys preserved

All existing `login.*`, `register.*`, and `errors.*` keys remain unchanged in all 3 locales. No keys removed, renamed, or modified.

### No hardcoded English UI copy

All visible text uses the `useTranslations` hook with translation keys. No hardcoded English strings in production source.

---

## 9. Heroicons Usage

| Icon | Import path | Usage | Decorative? |
|------|-------------|-------|-------------|
| `EnvelopeIcon` | `@heroicons/react/24/outline` | Email form field (left icon) | YES |
| `LockClosedIcon` | `@heroicons/react/24/outline` | Password form field (left icon) | YES |
| `ExclamationTriangleIcon` | `@heroicons/react/24/outline` | Error banners (left icon) | YES |
| `CheckCircleIcon` | `@heroicons/react/24/outline` | Success banners (left icon) | YES |

- `@heroicons/react` already installed at `^2.2.0` in `frontend/package.json` — no new dependency added
- Only `@heroicons/react/24/outline` variant used (per governance rules)
- Icons supplement text labels; they do not replace them
- Heroicons React v2 components render with `aria-hidden="true"` by default
- No Lucide, Font Awesome, Material Icons, or emoji icons used

---

## 10. Auth Logic Preservation

All auth logic preserved exactly, line-for-line:

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
| `AuthStatusBanner` search params logic (verified, error) | PRESERVED |
| Forgot-password link (`/\${locale}/forgot-password`) | PRESERVED |
| Register/Login cross-links | PRESERVED |
| Form element IDs (`email`, `password`, `register-email`, `register-password`) | PRESERVED |
| `Suspense` boundary around `AuthStatusBanner` | PRESERVED |
| `typeof useRouter === 'function'` guard in register page | PRESERVED |

No backend/session/API/billing/payment/provider logic was changed.

---

## 11. Validation Results

| # | Command | Result |
|---|---------|--------|
| 1 | `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm test` | PASS — 640/640 tests, 53 suites, 0 failures |
| 2 | `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit` | PASS — exit code 0, no type errors |
| 3 | `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build` | PASS — compiled successfully, all routes generated |
| 4 | `git -C "C:\Users\knlee\aiSandBox2026B" restore -- "frontend/tsconfig.tsbuildinfo"` | DONE — build artifact restored |
| 5 | ReadLints on changed production files | PASS — 0 linter errors |

---

## 12. First Visual Smoke — BLOCKED

Step 3B first attempt was BLOCKED. Report: `docs/ANOMALY-01-VISUAL-SMOKE.md`.

- Frontend-only dev server started on port 3002.
- `http://localhost:3002/en/login` returned HTTP 200.
- Page displayed API Gateway health error panel (`Failed to connect to API Gateway`).
- Frontend runtime logs showed repeated `ECONNREFUSED` errors on `/api/health` proxy.
- Visual smoke criteria could not pass under frontend-only / no-API-Gateway constraint.
- Routes 2–6 (`/en/register`, `/zh-TW/*`, `/zh-CN/*`) not executed — blocked by prerequisite.
- No source/governance files changed during this execution.
- Frontend dev process stopped. Port 3002 confirmed closed.

---

## 13. Visual Smoke Rerun — PASS

Step 3B rerun allowed API Gateway + Postgres/Redis. Report: `docs/ANOMALY-01-VISUAL-SMOKE-RERUN.md`.

### Health endpoint results

| Endpoint | Status | Response |
|----------|--------|----------|
| `http://localhost:4000/api/health` | **200** | `{"status":"ok","service":"api-gateway","version":"0.1.0"}` |
| `http://localhost:4000/api/health/db` | **200** | `{"status":"ok","database":"connected"}` |
| `http://localhost:4000/api/health/ready` | **200** | `{"status":"ready","environment":"development","checks":{...}}` |

Frontend startup: `http://localhost:3002/en/login` → **200**

### Route-by-route results

| Route | Result | Notes |
|-------|--------|-------|
| `/en/login` | **PASS** | No crash, no API Gateway error panel, refreshed visual style, LanguageSwitcher in card header, icons visible, controls usable |
| `/en/register` | **PASS** | No crash, no API Gateway error panel, refreshed visual style, LanguageSwitcher in card header, icons visible, controls usable |
| `/zh-TW/login` | **PASS** | Primary copy in Traditional Chinese, no hardcoded English |
| `/zh-TW/register` | **PASS** | Primary copy in Traditional Chinese, no hardcoded English |
| `/zh-CN/login` | **PASS** | Primary copy in Simplified Chinese, no hardcoded English |
| `/zh-CN/register` | **PASS** | Primary copy in Simplified Chinese, no hardcoded English |

---

## 14. Desktop / Mobile Result

| Check | Result |
|-------|--------|
| Desktop layout — all six routes | **PASS** — no major clipping or overlap |
| ~390 px mobile width — all six routes | **PASS** — no major horizontal overflow |

---

## 15. Localization / Hardcoded-English Result

| Check | Result |
|-------|--------|
| `/en/*` routes — English copy | **PASS** — renders correctly |
| `/zh-TW/*` routes — Traditional Chinese | **PASS** — primary copy localized; no obvious hardcoded English in primary UI |
| `/zh-CN/*` routes — Simplified Chinese | **PASS** — primary copy localized; no obvious hardcoded English in primary UI |

---

## 16. Runtime Cleanup Result

- Frontend dev process stopped.
- API Gateway dev process stopped.
- `docker compose stop postgres redis` executed successfully.
- Final `docker compose ps` showed no running services.
- Port checks confirmed:
  - `LISTENING_3002_4000=NONE`
  - `TCP3002=False`
  - `TCP4000=False`
- No destructive command used. No `docker compose down -v`.
- No volumes deleted.

---

## 17. Safety Confirmations

| Confirmation | Status |
|--------------|--------|
| No backend source modified in any step of ANOMALY-01 | CONFIRMED |
| No auth/session/backend policy changed | CONFIRMED |
| No authentication logic changed | CONFIRMED |
| No login/register submit behavior changed | CONFIRMED |
| No redirects changed | CONFIRMED |
| No session/cookie handling changed | CONFIRMED |
| No packages/dependencies added or modified | CONFIRMED |
| No migrations/entities/schema modified | CONFIRMED |
| No environment files modified or opened | CONFIRMED |
| No Docker files modified | CONFIRMED |
| No API contracts changed | CONFIRMED |
| No billing/payment/provider/Stripe work | CONFIRMED |
| No provider/payment/Stripe/customer-portal/webhook work registered | CONFIRMED |
| No AGENT-HARNESS write canary registered | CONFIRMED |
| No destructive command and no `docker compose down -v` | CONFIRMED |
| No git commit or push | CONFIRMED |
| No subagents used in any step | CONFIRMED |
| No secret-bearing environment file opened | CONFIRMED |
| BILLING-READY-07 remains COMPLETE and LOCKED — 2026-07-17 | CONFIRMED |
| BILLING-READY-07A remains COMPLETE and LOCKED — 2026-07-17 | CONFIRMED |
| No source/test/translation/package/migration/entity/environment/Docker files changed in Step 4 (this consolidation) | CONFIRMED |

---

## 18. Acceptance Criteria Disposition

### Step 1 — Registration (COMPLETE 2026-07-19)
All Step 1 criteria satisfied — see TASKS.md and TASKS_BACKLOG_FULL.md.

### Step 2 — Investigation / Preflight / Fix Proposal (COMPLETE 2026-07-19)
- [x] Root cause identified: design-language drift.
- [x] Active rendering component for `/[locale]/login` identified: `frontend/app/[locale]/login/page.tsx`.
- [x] Active rendering component for `/[locale]/register` identified: `frontend/app/[locale]/register/page.tsx`.
- [x] Intended current auth UI confirmed: same page files — no separate newer implementation exists.
- [x] zh-TW and zh-CN auth routes assessed: affected through the same `[locale]` dynamic segment.
- [x] Authentication functionality confirmed safe and unchanged.
- [x] Smallest safe fix proposed: bounded visual refresh of login/register pages.
- [x] Required tests/checks identified: tsc, npm test, npm run build, ReadLints.
- [x] Fix scope confirmed as bounded — no child task split needed.
- [x] No source changes made during investigation.

### Step 3 — Implementation + Validation (COMPLETE 2026-07-19)
- [x] Fix implemented (bounded visual refresh).
- [x] Multilingual files updated together (en.json, zh-TW.json, zh-CN.json — 2 new keys each).
- [x] Heroicons v2 Outline used for all icon additions.
- [x] Tests added/updated for changed behavior (Heroicons mocks in 3 test files).
- [x] TypeScript validation passes: `npx tsc --noEmit` — exit code 0.
- [x] Build passes: `npm run build` — compiled successfully.
- [x] ReadLints: 0 linter errors on changed production files.
- [x] npm test: 640/640 PASS, 53 suites, 0 failures.
- [x] tsconfig.tsbuildinfo restored.

### Step 3B — Visual Smoke Rerun (PASS 2026-07-19)
- [x] First visual smoke BLOCKED (frontend-only, API Gateway unavailable).
- [x] Rerun executed with API Gateway + Postgres/Redis allowed.
- [x] Health endpoints 200: `/api/health`, `/api/health/db`, `/api/health/ready`.
- [x] `/en/login` returned 200 before visual checks.
- [x] All six routes PASS.
- [x] Desktop layout PASS.
- [x] ~390 px mobile PASS.
- [x] zh-TW localized copy PASS.
- [x] zh-CN localized copy PASS.
- [x] No obvious hardcoded English in primary zh-TW/zh-CN UI.
- [x] No new defects found.
- [x] Cleanup PASS — ports 3002 and 4000 confirmed closed.
- [x] No source/governance files changed during rerun.

### Step 4 — Consolidation / Checkpoint (COMPLETE 2026-07-19)
- [x] Checkpoint document created: `docs/ANOMALY-01-CHECKPOINT.md`.
- [x] TASKS.md updated — ANOMALY-01 COMPLETE and LOCKED.
- [x] TASKS_BACKLOG_FULL.md updated — ANOMALY-01 COMPLETE and LOCKED.
- [x] AINOW-EXECUTION-ROADMAP.md updated — ANOMALY-01 COMPLETE and LOCKED, next action recorded.
- [x] BILLING-READY-07 remains COMPLETE and LOCKED.
- [x] BILLING-READY-07A remains COMPLETE and LOCKED.
- [x] No source/test/translation/package/migration/entity/environment/Docker files changed in this consolidation step.
- [x] No runtime, Docker, DB, browser, API, test, build, provider, payment, Stripe CLI, webhook, git commit, or git push occurred in this consolidation step.
- [x] No secret-bearing environment file opened.
- [x] No subagents used.

---

## 19. Locked-State Instruction

**ANOMALY-01 is COMPLETE and LOCKED as of 2026-07-19.**

Do not modify this task entry after locking except by an explicitly approved follow-up task.

All prior checkpoints and locked tasks remain intact and unchanged:
- BILLING-READY-07 — COMPLETE and LOCKED — 2026-07-17 — Outcome B — PASS WITH LIMITATIONS
- BILLING-READY-07A — COMPLETE and LOCKED — 2026-07-17 — Step 3 rerun PASS (2026-07-19)
- All BILLING-READY-03 through 07A child slices — COMPLETE and LOCKED

---

## 20. Recommended Next Action

Per the roadmap's Near-Term Sequence (`docs/AINOW-EXECUTION-ROADMAP.md`, section 11, entry 22):

**Register Beta preparation task (Beta readiness checklist).**

Prerequisites are satisfied:
- Billing foundation (BILLING-READY-03 through BILLING-READY-07A) COMPLETE and LOCKED
- Multi-builder topology (AGENT-PLATFORM-04 through AGENT-PLATFORM-07F) COMPLETE and LOCKED
- Auth route multilingual UX/UI regression (ANOMALY-01) COMPLETE and LOCKED

This next action requires Keith explicit approval before registration. Do not register Stripe/provider/webhook/customer-portal tasks. Do not register AGENT-HARNESS write canary unless the roadmap explicitly states it is next.
