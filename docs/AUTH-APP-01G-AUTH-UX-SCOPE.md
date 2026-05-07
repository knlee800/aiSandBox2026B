# AUTH-APP-01G Auth UX Scope

**Document ID:** AUTH-APP-01G-AUTH-UX-SCOPE
**Task:** AUTH-APP-01G1 — Auth UX Inventory + Scope
**Date:** 2026-05-07
**Status:** APPROVED — gates AUTH-APP-01G2 through AUTH-APP-01G4 implementation
**Nature:** INVENTORY AND SCOPE DOCUMENT ONLY — no source implementation in G1
**Parent spec:** `docs/AUTH-APP-01-SPEC.md`

---

## 1. Purpose

This document is the governing scope for AUTH-APP-01G — Auth UX Integration. It records the current state of all auth-related UX surfaces, identifies gaps, and defines the bounded implementation scope for the G2, G3, and G4 child slices.

No source implementation is performed in G1. This document gates all G2–G4 work.

**Child slice assignments:**
- **G2** — Login/register OAuth error display + OAuth button polish
- **G3** — Logout + basic account surface
- **G4** — Validation and checkpoint

---

## 2. Prerequisite State

The following are confirmed complete and locked as of AUTH-APP-01G1 stage-start:

| Prerequisite | Status | Reference |
|---|---|---|
| Password login/register (email + password) | COMPLETE | `docs/AUTH-APP-01-SPEC.md` Section 1 |
| HTTP-only cookie session (`aisandbox_session`) | COMPLETE and LOCKED | `docs/AUTH-APP-01C1A-CHECKPOINT.md` |
| Frontend localStorage/Bearer migration | COMPLETE and LOCKED | `docs/AUTH-APP-01C1B-CHECKPOINT.md` |
| Google OAuth (passport-google-oauth20) | COMPLETE and LOCKED | `docs/AUTH-APP-01D-CHECKPOINT.md` |
| Apple OAuth | COMPLETE and LOCKED | `docs/AUTH-APP-01E-CHECKPOINT.md` |
| Route/API protection (F-family) | VALIDATION COMPLETE — carry-forwards pending | `docs/AUTH-APP-01F-CHECKPOINT.md` |
| UX-IA-02 design tokens (10 tokens, 5 groups) | COMPLETE and LOCKED | `docs/UX-IA-02-CHECKPOINT.md` |
| Login/register page UX polish (UX-IA-03) | COMPLETE and LOCKED | `docs/UX-IA-03-CHECKPOINT.md` |
| `POST /api/auth/logout` backend endpoint | COMPLETE (SessionCookieGuard, revokes session, clears cookie) | `docs/AUTH-APP-01C1A-CHECKPOINT.md` |
| AUTH-APP-01C2 (email verification/password reset) | BLOCKED — email provider unresolved | `docs/AUTH-APP-01-SPEC.md` Section 7 |

---

## 3. Login Page Inventory

**File:** `frontend/app/[locale]/login/page.tsx`

### Password login behavior

- Form submits `POST /api/auth/login` with `email` and `password` via axios
- `Accept-Language: ${locale}` header included
- On success: `router.push(/${locale}/app)` — session cookie is set server-side by backend
- No `access_token` stored anywhere — cookie-session only (AUTH-APP-01C1B locked)

### Google OAuth link

- `<a href="/api/auth/google?locale=${locale}">` — full page navigation, not `fetch`
- On success: backend sets `aisandbox_session` cookie and redirects to `/${locale}/app`
- On failure: backend redirects to `/${locale}/login?error=oauth_failed`

### Apple OAuth link

- `<a href="/api/auth/apple?locale=${locale}">` — full page navigation
- On success: backend sets `aisandbox_session` cookie and redirects to `/${locale}/app`
- On failure: backend redirects to `/${locale}/login?error=oauth_failed` or `?error=account_conflict`

### Loading and error states

| State | Behavior |
|---|---|
| Loading | Button text changes: `t('loginButton')` → `t('loggingIn')`; button disabled |
| Error (password) | Inline `<div>` with `bg-red-100 text-red-700`; message from axios error or `t('loginFailed')` |
| Error (OAuth) | **NOT HANDLED** — see OAuth error gap below |
| Success | Immediate redirect — no success state displayed |

### i18n coverage

All keys used by the current login page are present and translated in all three locales (en, zh-TW, zh-CN):

`login.title`, `login.email`, `login.password`, `login.loginButton`, `login.loggingIn`, `login.loginFailed`, `login.orContinueWith`, `login.continueWithGoogle`, `login.continueWithApple`, `login.needAccount`, `login.startHere`

**Dead key noted:** `login.testCredentials` exists in all three message files but is not rendered in the current login page. Deferred — no action in G2.

### Token and design consistency

- Login page fully uses UX-IA-02 design tokens: `bg-surface-raised`, `bg-surface-base`, `border-border`, `text-text-primary`, `text-text-secondary`, `bg-brand`, `hover:bg-brand-hover`, `ring-brand`
- OAuth buttons use token-consistent neutral style (`border-border bg-surface-base hover:bg-surface-raised`) but have **no visual brand identity** — no Google "G" icon, no Apple logo, no provider color

### Critical OAuth error gap

**The login page does not read `?error` query parameters from the URL.**

The backend `auth.controller.ts` emits the following redirect codes on OAuth failure:

| Error code | Trigger |
|---|---|
| `oauth_failed` | Google: any callback failure; Apple: non-`UnauthorizedException` |
| `account_conflict` | Apple: `UnauthorizedException` with "account conflict" in message |

The `errors.oauthFailed` and `errors.accountConflict` i18n keys are translated in all three locales but are **never rendered anywhere in the frontend**. After an OAuth failure, the user lands on the login page with no visible error message.

This gap must be closed in G2.

---

## 4. Register Page Inventory

**File:** `frontend/app/[locale]/register/page.tsx`

### Password register behavior

- Form submits `POST /api/auth/register` with `email` and `password` via axios
- `Accept-Language: ${locale}` header included
- On success: shows `t('successMessage')` in a green inline div — **page does not redirect**
- User must manually navigate to login after registration
- Whether to add auto-redirect after success is a decision deferred to G2 stage-start

### Google OAuth link

- `<a href="/api/auth/google?locale=${locale}">` — identical to login page link

### Apple OAuth link

- `<a href="/api/auth/apple?locale=${locale}">` — identical to login page link

### Loading/error/success states

| State | Behavior |
|---|---|
| Loading | Button text changes: `t('registerButton')` → `t('registering')`; button disabled |
| Error | Inline `<div>` with `bg-red-100 text-red-700` |
| Success | Inline `<div>` with `bg-green-100 text-green-700`; stays on page; email/password fields reset |

### Backend OAuth error redirects

The backend always redirects OAuth errors to `/${locale}/login`, never to `/${locale}/register`. The register page does not receive OAuth error redirects. However, because the register page contains OAuth links, a user could trigger an OAuth failure from the register page and land on login with an unhandled error param.

### i18n coverage

All keys used by the current register page are present and translated in all three locales:

`register.title`, `register.email`, `register.password`, `register.registerButton`, `register.registering`, `register.registerFailed`, `register.successMessage`, `register.orContinueWith`, `register.continueWithGoogle`, `register.continueWithApple`, `register.alreadyHaveAccount`, `register.loginHere`

**Note:** `register.name` exists in all three message files but no "name" field is rendered in the current register page. Deferred — no action.

### Token and design consistency

Register page fully uses UX-IA-02 design tokens — same token set as login page. OAuth button styling is identical to login page (generic, no brand identity).

---

## 5. OAuth Error Gap

### Summary

| Component | State |
|---|---|
| Backend error emit | Working — emits `?error=oauth_failed` or `?error=account_conflict` |
| Frontend error consumption | **Missing** — login page does not read query params |
| i18n keys | Present in all three locales (`errors.oauthFailed`, `errors.accountConflict`) |
| User-visible feedback after OAuth failure | None |

### G2 requirement

The login page must:

1. Read `?error` from the URL on mount using `useSearchParams()`
2. If `error === 'oauth_failed'`, display using `errors.oauthFailed` i18n key (provider-agnostic wording — see below)
3. If `error === 'account_conflict'`, display using `errors.accountConflict` i18n key
4. Render the error in the existing inline error `<div>` pattern (`bg-red-100 text-red-700`)

### Provider-agnostic copy requirement

`errors.oauthFailed` currently reads: `"Sign in with Google failed. Please try again."` (en).

Apple OAuth failures also use the `oauth_failed` error code. The current wording is incorrect for Apple. This key must be updated to provider-agnostic wording in all three locales (en, zh-TW, zh-CN) as part of G2.

Suggested direction: "OAuth sign-in failed. Please try again." — exact copy is a G2 decision.

### Next.js App Router `useSearchParams` constraint

`useSearchParams()` in the Next.js App Router requires the calling component to be wrapped in a `<Suspense>` boundary, or the page must be structured to avoid blocking static rendering. The login page is currently a plain `'use client'` component with no Suspense. G2 must handle this constraint — either by wrapping the param-reading logic in a separate `<Suspense>`-wrapped child component, or by restructuring the page. The exact pattern is a G2 implementation decision.

---

## 6. Logout Gap

### Current state

**Logout does not exist in the frontend in any form.**

- No component in `frontend/components/` references a logout call
- No page in `frontend/app/` calls `POST /api/auth/logout`
- The main workspace `app/page.tsx` contains no logout handler or button
- The account/keys pages contain no logout button
- Two i18n keys are orphaned: `account.logout` and `sandbox.logout` (present and translated in all three locales, but never rendered)

### Backend state

`POST /api/auth/logout` is fully implemented:
- Protected by `SessionCookieGuard`
- Revokes the `auth_sessions` record in the database
- Clears the `aisandbox_session` cookie
- Returns `{ ok: true }`

### G3 requirement

G3 must add logout UX:

1. A logout button must be wired to `POST /api/auth/logout`
2. On success: clear local UI state, redirect to `/${locale}/login`
3. The existing `handleWorkspaceUnauthorizedAccess()` function in `app/page.tsx` already clears state and pushes to login — logout can reuse this pattern
4. The `aisandbox_session` cookie revocation is handled server-side by the existing endpoint — no client-side cookie manipulation needed

### Redirect target

`/${locale}/login` — consistent with the existing unauthenticated redirect behavior.

### Cookie-session behavior preserved

The backend logout endpoint is the correct path. No client-side cookie deletion or localStorage clearing is required. The session revocation is server-side.

---

## 7. Account Surface State

**File:** `frontend/app/[locale]/account/page.tsx`

### Current behavior

The `/account` route is gated by the `PROJECT_FIRST_UX` feature flag (`process.env.NEXT_PUBLIC_PROJECT_FIRST_UX`):

| Flag value | Behavior |
|---|---|
| `false` (Dockerfile default) | `redirect(/${locale}/keys)` — route silently redirects |
| `true` | Renders `<ApiKeysPage />` directly |

In both cases, the rendered surface is the API key management page. There is no profile section, no user email display, no auth provider display, and no logout button.

### API keys page token state

**File:** `frontend/app/[locale]/keys/page.tsx`

The keys page uses **zero UX-IA-02 design tokens**. The entire page uses raw Tailwind utility classes:

- `bg-gray-100`, `bg-white`, `text-gray-900`, `text-gray-600`, `text-gray-700`
- `border-gray-200`, `border-gray-300`
- `bg-blue-600`, `hover:bg-blue-700`
- `bg-red-600`, `hover:bg-red-700`

This is a pre-existing inconsistency from before UX-IA-02 and UX-IA-03 were completed. It is **out of scope for G2 and G3** unless explicitly registered as a separate task. Do not allow token cleanup to expand G2 or G3.

### G3 minimum safe scope

G3 should add only:

1. A basic logout mechanism accessible from the account/app surface
2. Optionally: display the current user email from `GET /api/auth/me` if it can be done without a full page restructure

G3 is **not** a full account redesign. No profile editing, no provider management UI, no password change, no billing section.

G3 must inspect `app/page.tsx` carefully at stage-start to locate the account/user menu before committing to a placement. That file is very large (~5000+ lines). If logout + account surface is too large for a single slice, G3 must be split further.

---

## 8. UX-IA-02 Token and Design Gaps

| Surface | Token state | Action |
|---|---|---|
| Login page | Fully token-consistent | No change needed |
| Register page | Fully token-consistent | No change needed |
| OAuth buttons (login + register) | Token-consistent but visually generic (no provider icon/color) | G2: minimal polish only |
| Keys page | Zero design tokens (raw Tailwind) | Deferred — out of G2/G3 scope |
| Account page | Redirects to keys; inherits keys token gap | Deferred |
| App workspace | Mixed; large surface | Not in scope for AUTH-APP-01G |

**Rule:** Token cleanup of the keys page or workspace must not be absorbed into G2 or G3. Any such work requires a separate registered task.

---

## 9. UX/UI Advisory Skill Usage

The project has Impeccable and Emil Kowalski design engineering skills installed. Their role in AUTH-APP-01G is advisory-only.

### Permitted usage

| Skill | When | What |
|---|---|---|
| Impeccable | G2 stage-start | Advisory audit of login/register auth UX: error display, OAuth button appearance, state feedback |
| Emil Kowalski | G2 or G3 stage-start | Advisory observation on one bounded component (OAuth buttons or logout button) |
| find-skills | Only if needed | Discover additional relevant skills |

### Hard constraints

- Skills **cannot edit files**
- Skills **cannot override** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, current registered scope, architecture decisions, or tests
- Skills must return bounded observations only — a short list of specific actionable issues
- Each skill observation must be explicitly accepted or rejected before implementation
- Skills do not expand scope — if a skill identifies an issue outside G2/G3 scope, it is recorded for a future task

---

## 10. G2 Bounded Scope

**AUTH-APP-01G2 — Login/Register OAuth Error + Button Polish**

### Files in scope

```
frontend/app/[locale]/login/page.tsx
frontend/app/[locale]/register/page.tsx
frontend/messages/en.json
frontend/messages/zh-TW.json
frontend/messages/zh-CN.json
```

### Changes

1. **OAuth error query param consumption** — login page reads `?error=oauth_failed` or `?error=account_conflict`; renders in existing error div pattern using `errors.*` i18n keys; Suspense boundary required
2. **Provider-agnostic `errors.oauthFailed` copy** — update in all three message files; exact wording decided at G2 stage-start
3. **Minimal OAuth button polish** — bounded visual improvement to Google/Apple buttons (advisory-driven); no full redesign; no external icon libraries unless already installed
4. **Register success behavior decision** — whether to add auto-redirect to login after successful registration; decided at G2 stage-start

### Non-goals for G2

- No backend changes
- No auth protocol changes
- No OAuth implementation changes
- No account surface changes
- No logout implementation
- No full page redesign
- No keys page changes
- No new npm dependencies

---

## 11. G3 Bounded Scope

**AUTH-APP-01G3 — Logout + Basic Account Surface**

### Files likely in scope

```
frontend/app/[locale]/app/page.tsx
frontend/app/[locale]/account/page.tsx
frontend/components/auth/logout-button.tsx  (possibly new)
frontend/messages/en.json                   (if new i18n keys needed)
frontend/messages/zh-TW.json
frontend/messages/zh-CN.json
```

### Changes

1. **Logout button** — located in or near the existing account/user menu in `app/page.tsx`; calls `POST /api/auth/logout`; on success reuses `handleWorkspaceUnauthorizedAccess()` pattern or equivalent; redirects to `/${locale}/login`
2. **Redirect target** — `/${locale}/login`; cookie revocation is server-side
3. **Basic account/auth info** — optionally display current user email from `GET /api/auth/me` if achievable without restructuring; minimum viable surface only

### G3 pre-implementation requirement

G3 must inspect `app/page.tsx` at stage-start to locate the account/user menu or header before any implementation. The file is very large. If logout + account surface proves too large for a single clean slice, G3 must be split into G3a (logout only) and G3b (account surface) before proceeding.

### Non-goals for G3

- No backend changes
- No full account redesign
- No provider management UI
- No password change UI
- No billing section
- No keys page token migration
- No email verification
- No workspace redesign

---

## 12. G4 Validation Scope

**AUTH-APP-01G4 — Auth UX Validation + Checkpoint**

### Automated checks

- `npx tsc --noEmit` (frontend)
- `npm run build` (frontend)
- `npm test` (frontend) — targeted tests if new testable behavior was added in G2/G3; full suite for regression

### Targeted tests if added in G2

- Login page renders error message when `?error=oauth_failed` query param is present
- Login page renders error message when `?error=account_conflict` query param is present
- Login page does not render OAuth error when no `?error` param is present

### Manual smoke checklist

1. Password login — succeeds and redirects to app
2. Password login — wrong credentials shows error
3. OAuth link present and styled on login page
4. OAuth error query param `?error=oauth_failed` — user-facing error message displayed on login page
5. OAuth error query param `?error=account_conflict` — user-facing error message displayed on login page
6. Password register — succeeds (with decided success behavior from G2)
7. Logout — calls backend, clears session cookie, redirects to login
8. Logout — revisiting `/app` after logout redirects back to login (session revoked)
9. Account page — renders expected minimal surface
10. All surfaces behave correctly in zh-TW and zh-CN

### Checkpoint documents

- Create `docs/AUTH-APP-01G-CHECKPOINT.md`
- Update `TASKS.md`
- Update `TASKS_BACKLOG_FULL.md`
- Mark AUTH-APP-01G4 COMPLETE and LOCKED
- Mark AUTH-APP-01G COMPLETE and LOCKED (if all carry-forwards resolved)

---

## 13. Risks and Open Questions

| Risk / Question | Detail | Target |
|---|---|---|
| `useSearchParams` Suspense requirement | Next.js App Router requires `useSearchParams()` inside a `<Suspense>` boundary or equivalent structure. Login page currently has no Suspense. G2 must handle this without breaking static rendering or page structure. | G2 stage-start |
| Provider-agnostic OAuth error wording | `errors.oauthFailed` currently says "Sign in with Google failed." — incorrect for Apple. Exact replacement wording must be decided at G2 stage-start and applied consistently across en, zh-TW, zh-CN. | G2 |
| Google callback hardcodes `oauth_failed` | `auth.controller.ts` Google callback always emits `?error=oauth_failed` regardless of error type; `account_conflict` is only reachable via the Apple callback today. This is a backend behavior note — no backend change in G2. | Documentation only |
| Register success behavior | Currently stays on page with a success message. Whether to auto-redirect to login after registration is a UX decision to be made at G2 stage-start. | G2 |
| Logout placement in `app/page.tsx` | The workspace page is very large (~5000+ lines). The account/user menu location must be inspected at G3 stage-start before committing to a placement. | G3 stage-start |
| `PROJECT_FIRST_UX` flag in `/account` | The account page behavior differs based on flag. G3 must ensure logout works regardless of which code path is active. | G3 |
| Keys page raw Tailwind classes | Entire keys page uses zero UX-IA-02 tokens — pre-existing since before UX-IA-02. Out of scope for G2/G3. Must not expand scope. | Deferred — future task |
| `login.testCredentials` dead key | Key exists in all three message files but is not rendered in the current login page. | Deferred |
| `register.name` dead key | Key exists in all three message files but no name field is rendered in the current register page. | Deferred |

---

## 14. Non-Goals

The following are explicitly out of scope for all of AUTH-APP-01G (G1 through G4):

- No OAuth backend implementation changes (Google or Apple callback logic)
- No email verification implementation (AUTH-APP-01C2 — BLOCKED on email provider)
- No password reset implementation (AUTH-APP-01C2 — BLOCKED)
- No transactional email provider setup
- No route/API protection work (AUTH-APP-01F carry-forwards tracked separately)
- No workspace redesign (UX-IA-04 and later)
- No Visual Edit Mode
- No AUTH-MODULE-01 (reusable generated app-auth for user-created apps — separate later family)
- No new npm dependencies
- No keys page token migration (deferred)
- No full account redesign or profile editing
- No provider management UI (linking/unlinking OAuth accounts)
- No admin user-management dashboard
- No billing/subscription changes

---

## Reference

- `docs/AUTH-APP-01-SPEC.md` — governing auth architecture decisions
- `docs/AUTH-APP-01C1A-CHECKPOINT.md` — cookie session foundation including `POST /api/auth/logout`
- `docs/AUTH-APP-01D-CHECKPOINT.md` — Google OAuth
- `docs/AUTH-APP-01E-CHECKPOINT.md` — Apple OAuth
- `docs/AUTH-APP-01F-CHECKPOINT.md` — route/API protection family summary
- `docs/UX-IA-02-CHECKPOINT.md` — design token definitions
- `docs/UX-IA-03-CHECKPOINT.md` — login/register polish
- `TASKS.md` → AUTH-APP-01G, AUTH-APP-01G1
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01G, AUTH-APP-01G1
