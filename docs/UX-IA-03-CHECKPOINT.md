# UX-IA-03 Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-03 |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND UI / I18N |
| Date | 2026-05-06 |
| Source | UX-IA-00 master plan (May 2026) — public landing and login/register are the first user-facing surfaces; must reflect the new product direction before workspace redesign begins |

---

## Objective

Transform the public landing page into the "Build anything" entry experience with a prompt chatbox and sign-in/register CTA. Polish login and register pages using the UX-IA-02 design token foundation and achieve full i18n coverage. No authentication, no workspace, no AI-WS changes.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/public/public-landing-slice.tsx` | Major redesign: added `useTranslations`, added prompt state and `handlePromptSubmit`, redesigned layout with design tokens, added `LanguageSwitcher` via `headerAuxiliary` prop, passed `strings` object to view, removed feature cards / trust note / `LandingStateMessage` |
| `frontend/components/public/public-landing-slice.test.tsx` | Updated: replaced old content assertions with new landing structure assertions; introduced `baseProps` helper; preserved workspace-scope exclusion test |
| `frontend/app/[locale]/login/page.tsx` | Now uses `t('needAccount')` and `t('startHere')` (previously hardcoded); switched Tailwind classes to UX-IA-02 design tokens |
| `frontend/app/[locale]/register/page.tsx` | Added `useTranslations('register')`; replaced all hardcoded user-facing strings with `t(key)`; switched Tailwind classes to design tokens |
| `frontend/messages/en.json` | Added `landing.promptSubmit`, `landing.signIn`, `register.successMessage` |
| `frontend/messages/zh-TW.json` | Same three additions |
| `frontend/messages/zh-CN.json` | Same three additions |

`frontend/tsconfig.tsbuildinfo` — modified by build/typecheck validation; **restored** via `git restore` afterward.

---

## Implementation Summary

### Landing Page Redesign

The public landing was rebuilt around a "Build anything" entry surface:

- **Header**: app name + `LanguageSwitcher` (injected via `headerAuxiliary?: React.ReactNode` prop to keep `PublicLandingSliceView` statically testable) + sign-in or continue-to-workspace CTA
- **Hero section**: `t('hero')` headline, `t('heroSubtitle')` subtitle, prompt `<textarea>`, submit button (`t('promptSubmit')`), sign-in link, and register link
- **Authenticated state**: when `state === 'ready'`, the CTA links to `/[locale]/app` and the "Need an account?" row is hidden
- **Feature cards, trust note, and `LandingStateMessage`**: removed — these were MVP scaffolding, not part of the new product direction

All Tailwind classes use UX-IA-02 design tokens (`bg-surface-base`, `bg-surface-raised`, `text-text-primary`, `border-border`, `bg-brand`, `hover:bg-brand-hover`, etc.).

### Landing Prompt / sessionStorage Behavior

| Decision | Value |
|---|---|
| sessionStorage key | `aisandbox_pending_prompt` |
| Prompt trimmed before store | Yes |
| Empty prompt behavior | No-op — redirect and storage are skipped |
| sessionStorage write failure | Silently caught — redirect still proceeds |
| On submit | `sessionStorage.setItem(key, trimmedPrompt)` then `router.push('/${locale}/login')` |
| Project creation | None — no API call, no project created |
| Prompt consumption | Deferred to UX-IA-04 (workspace home view); UX-IA-03 only writes the value |

### Component Architecture

`useTranslations` is called in `PublicLandingSlice` (the stateful parent), not in `PublicLandingSliceView`. All resolved strings are passed to the view as a typed `strings: PublicLandingStrings` prop. `LanguageSwitcher` is injected as `headerAuxiliary?: React.ReactNode`. This keeps `PublicLandingSliceView` testable with `renderToStaticMarkup` without any React context requirement.

### Login Polish

- `handleLogin`, `localStorage.setItem`, `router.push`, and `axios.post('/api/auth/login', ...)` unchanged
- Replaced two hardcoded strings with `t('needAccount')` and `t('startHere')` (keys already existed in `en.json`)
- Tailwind class token migration applied; semantic error color (`bg-red-100 text-red-700`) preserved

### Register Polish

- `handleRegister`, `axios.post('/api/auth/register', ...)`, success/error state behavior unchanged
- Added `useTranslations('register')` — all user-facing strings now use `t(key)`
- Added `register.successMessage` key to all three locale files
- Tailwind class token migration applied; semantic success/error colors preserved

---

## i18n Keys Added

| Namespace | Key | en | zh-TW | zh-CN |
|---|---|---|---|---|
| `landing` | `promptSubmit` | `"Get started"` | `"立即開始"` | `"立即开始"` |
| `landing` | `signIn` | `"Sign In"` | `"登入"` | `"登录"` |
| `register` | `successMessage` | `"Account created successfully. You can now sign in."` | `"帳號建立成功。您現在可以登入。"` | `"帐号创建成功。您现在可以登录。"` |

All other needed keys already existed in the locale files. UX-IA-01 English fallback behavior (`active locale → English → raw key`) unchanged.

---

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` (from `frontend/`) | Passed — no type errors |
| `npm run test` (from `frontend/`) | Passed — 253 tests, 0 failures |
| `npm run build` (from `frontend/`) | Passed — Next.js production build successful |
| `ReadLints` on all 7 touched files | No linter errors |
| `frontend/tsconfig.tsbuildinfo` | Modified by build — **restored** via `git restore` |

---

## Auth Non-Goals Confirmed

No changes were made to:
- Auth.js / NextAuth
- Google OAuth / Apple OAuth
- `handleLogin` or `handleRegister` logic
- `localStorage` auth token behavior
- `router.push` redirect targets after login/register
- `axios.post('/api/auth/login', ...)` or `axios.post('/api/auth/register', ...)`
- Any backend auth service, database session model, or API guards
- Password reset, email verification, provider account linking, or route protection

All auth functionality belongs to AUTH-APP-01, which follows UX-IA-03 in the roadmap.

---

## Visual Edit Mode Non-Goal Confirmed

UX-IA-03 touched only the public landing, login, and register pages. No preview component, project mode, iframe, workspace shell, or AI-WS code was changed. Visual Edit Mode remains roadmap-only (master plan Section 12, UX-IA-15 through UX-IA-17).

---

## Risks / Invariants Preserved

- Auth form submit and redirect logic is functionally identical to before this slice
- UX-IA-01 locale middleware redirects and English fallback behavior unchanged
- UX-IA-02 font and CSS token variables unchanged
- All existing workspace, AI-WS, and project-mode capabilities unchanged
- All prior checkpoint invariants (UX-IA-01, UX-IA-02) remain intact
- Login page structure does not hardcode auth provider assumptions — AUTH-APP-01 can add OAuth buttons without structural conflict
- Landing prompt chatbox does not attempt project creation — AUTH-APP-01 + UX-IA-04 will complete that flow

---

## Next Recommended Task

**AUTH-APP-01 — aiSandBox First-Party User Authentication**

The master plan places AUTH-APP-01 between UX-IA-03 and UX-IA-04. Production authentication (email, Google, Apple, session model, route protection) must be in place before workspace/project-mode redesign reaches real users. AUTH-APP-01 is a multi-slice phase — begin with a planning/spec step and register under the AUTH task family before implementation.
