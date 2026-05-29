# AUTH-UX-01 Checkpoint — Prevent Back Navigation to Login After Authentication

**Date:** 2026-05-29
**Task ID:** AUTH-UX-01
**Family:** AUTH / UX
**Status:** COMPLETE and LOCKED
**Risk:** Low

---

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-UX-01 |
| Family | AUTH / UX |
| Nature | FRONTEND-ONLY / AUTH NAVIGATION UX FIX |
| Depends on | AUTH family COMPLETE and LOCKED |
| Checkpoint | `docs/AUTH-UX-01-CHECKPOINT.md` |

---

## Root Cause

`frontend/app/[locale]/login/page.tsx` used `router.push(\`/${locale}/app\`)` after successful login, pushing a new history entry and leaving `/login` in the browser history stack. Pressing Back returned the user to the login page even when authenticated.

Neither `login/page.tsx` nor `register/page.tsx` checked session state on mount. An authenticated user who navigated directly to `/login` or `/register` (including via Back) saw the public auth form without being redirected away.

`frontend/middleware.ts` handles only locale routing and was not involved.

---

## Files Changed

- `frontend/app/[locale]/login/page.tsx`
- `frontend/app/[locale]/register/page.tsx`
- `frontend/app/[locale]/login/page.test.tsx`

---

## Auth Navigation Fix Summary

### `login/page.tsx`
- Changed post-login navigation from `router.push(\`/${locale}/app\`)` to `router.replace(\`/${locale}/app\`)`. This removes `/login` from the browser history stack so Back cannot return to the login page after a successful login.
- Added authenticated-user guard via `useSafeEffect` on mount:
  - `fetch('/api/auth/me')`
  - If `response.ok` and the JSON payload contains a truthy string `id`, call `router.replace(\`/${locale}/app\`)`.
  - If unauthenticated or fetch throws, the login form remains visible with no new UI text.
- `useSafeEffect` wraps `useEffect` with a silent catch so existing direct-invocation test harnesses that do not provide a React renderer context continue to work.

### `register/page.tsx`
- Added the same `useSafeEffect` authenticated-user guard on mount.
- `useRouter` imported alongside existing `useParams`.
- `router` accessed conditionally (`typeof useRouter === 'function' ? useRouter() : null`) to preserve compatibility with the existing register test harness, which mocks `next/navigation` without `useRouter`.
- Existing register flow, verify-email success state, and resend-verification behavior unchanged.

---

## Tests Updated

**`frontend/app/[locale]/login/page.test.tsx`**

Harness extended:
- `router` mock now exposes both `push` and `replace`, each capturing calls to typed arrays (`pushCalls`, `replaceCalls`).
- `useEffect` stub added to harness `fakeReact` to collect mount effects.
- `fetchImpl` option added to harness so tests can control `/api/auth/me` response.
- `axiosPostImpl` option added for login submission tests.
- `runEffects()` helper executes collected effects and awaits microtasks.
- `renderElement()` helper invokes the page component directly for tree inspection.
- Helper functions `toNodeArray` and `findElementByType` added for tree traversal.

New tests in `LoginPage redirects` describe block:
1. `successful login navigates with router.replace and not push` — verifies `replaceCalls` contains `/en/app` and `pushCalls` is empty after form submit.
2. `auth guard redirects authenticated user on mount` — fetch returns `{ ok: true, json: { id: 'user-123' } }`; after `runEffects()`, `replaceCalls` contains `/en/app`.
3. `auth guard does not redirect unauthenticated user` — fetch returns `{ ok: false }`; after `runEffects()`, `replaceCalls` is empty.
4. `fetch failure keeps login form visible` — fetch throws; after `runEffects()`, `replaceCalls` is empty and rendered HTML contains `login.title`.

Existing `LoginPage OAuth error banner` tests unchanged and still pass.

---

## Validation Results

From `C:\Users\knlee\aiSandBox2026B\frontend`:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 512 tests, 512 pass, 0 fail |
| ReadLints on touched files | PASS — no linter errors |

---

## Non-Goals Confirmed

- No backend changes.
- No middleware changes.
- No auth session logic changes.
- No register success-flow redesign.
- No new visible user-facing text.
- No i18n message file changes (`frontend/messages/*.json` untouched).
- No TASK-75A work.
- No governance/checkpoint files modified during the implementation step.

---

## Acceptance Checks

- [x] AUTH-UX-01 registered in TASKS.md and TASKS_BACKLOG_FULL.md
- [x] `login/page.tsx` uses `router.replace` for post-login navigation
- [x] `login/page.tsx` has authenticated-user guard (fetch `/api/auth/me` on mount; `router.replace` to `/app` if authenticated)
- [x] `register/page.tsx` has authenticated-user guard (fetch `/api/auth/me` on mount; `router.replace` to `/app` if authenticated)
- [x] `login/page.test.tsx` updated: `router` mock exposes `replace`; tests cover `router.replace` call and auth guard redirect
- [x] No new visible text added
- [x] No i18n files modified
- [x] `npx tsc --noEmit` passes
- [x] `npm test` passes — 512 tests, 512 pass, 0 fail
- [x] ReadLints passes
- [x] No unrelated files changed

---

## Next Live-Test Step

Smoke test in a running browser session:

1. Start the frontend dev server.
2. Log in with a valid account.
3. Confirm the app navigates to `/app`.
4. Press browser Back — confirm the browser does **not** return to `/login` (the history entry has been replaced).
5. While logged in, navigate directly to `/{locale}/login` — confirm an immediate redirect to `/app` occurs.
6. While logged in, navigate directly to `/{locale}/register` — confirm an immediate redirect to `/app` occurs.
7. Log out, then navigate to `/login` — confirm the login form is shown normally (no spurious redirect).
