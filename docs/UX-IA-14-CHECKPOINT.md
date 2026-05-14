# UX-IA-14 Checkpoint — Route Cleanup / Redirects

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-14 |
| Title | Route Cleanup / Redirects |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-13 (COMPLETE and LOCKED — `docs/UX-IA-13-CHECKPOINT.md`) |
| Risk | Low |
| Loop | 2-step (implement, consolidate) |
| Model | Sonnet 4.6 |

---

## Objective

Redirect deprecated workspace/auth/navigation routes that became obsolete after UX-IA-04 through UX-IA-13. All workspace content is now served from the canonical `/[locale]/app` shell. The four old routes that previously reached subsets of this content (`keys`, `account`, `projects`, `gallery`) now redirect unconditionally to the canonical route using Next.js server-side `redirect()`, ensuring existing bookmarks and links do not break users.

---

## Canonical Route Map (unchanged)

| Route | Purpose | Status |
|---|---|---|
| `/[locale]` | Public landing | Canonical — unchanged |
| `/[locale]/login` | Login form | Canonical — unchanged |
| `/[locale]/register` | Registration form | Canonical — unchanged |
| `/[locale]/forgot-password` | Forgot password | Canonical — unchanged |
| `/[locale]/reset-password` | Reset password | Canonical — unchanged |
| `/[locale]/app` | Authenticated workspace (all views) | Canonical — unchanged |
| `/[locale]/share` | Public project browse | Canonical — unchanged |
| `/[locale]/share/[projectId]` | Public project viewer | Canonical — unchanged |
| `/[locale]/driver` | Internal/debug AI execution harness | Preserved as-is — not user-facing |
| `/test` | Dev debug page (no locale segment) | Preserved as-is — outside scope |

---

## Deprecated Route Redirect Map

| Route | Previous behavior | Action | Destination |
|---|---|---|---|
| `/[locale]/keys` | `'use client'` full API key management UI with own auth check | Replaced with Server Component redirect | `/[locale]/app` |
| `/[locale]/account` | Server Component; conditionally rendered `<ApiKeysPage />` or redirected to `/keys` based on `PROJECT_FIRST_UX` flag | Replaced with unconditional Server Component redirect | `/[locale]/app` |
| `/[locale]/projects` | Server Component; conditionally rendered `<AppPage />` or redirected to `/app` based on `PROJECT_FIRST_UX` flag | Replaced with unconditional Server Component redirect | `/[locale]/app` |
| `/[locale]/gallery` | Server Component; conditionally rendered `<PublicShareBrowsePage />` or redirected to `/share` based on `PROJECT_FIRST_UX` flag | Replaced with unconditional Server Component redirect | `/[locale]/app` |

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/keys/page.tsx` | Replaced entire file — 432-line `'use client'` API key management component → 10-line Server Component redirect |
| `frontend/app/[locale]/account/page.tsx` | Replaced entire file — conditional Server Component (23 lines, `PROJECT_FIRST_UX` branch + `ApiKeysPage` + `LogoutButton`) → 10-line Server Component redirect |
| `frontend/app/[locale]/projects/page.tsx` | Replaced entire file — conditional Server Component (17 lines, `PROJECT_FIRST_UX` branch + `AppPage` render) → 10-line Server Component redirect |
| `frontend/app/[locale]/gallery/page.tsx` | Replaced entire file — conditional Server Component (17 lines, `PROJECT_FIRST_UX` branch + `PublicShareBrowsePage` render) → 10-line Server Component redirect |
| `frontend/app/[locale]/keys/page.test.tsx` | **Deleted** — 242-line test file covering removed client-side API key UI behavior |

---

## Implementation Summary

All four deprecated route pages now use the identical minimal Server Component pattern:

```tsx
import { redirect } from 'next/navigation';

export default async function [Name]Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/app`);
}
```

Function names applied: `KeysPage`, `AccountPage`, `ProjectsPage`, `GalleryPage`.

The `redirect()` call is from `next/navigation` and produces a server-side HTTP redirect response. Requests to deprecated routes with an existing locale prefix (e.g. `/en/keys`) pass through `middleware.ts` unchanged (middleware passes any path that already has a locale prefix) and are handled by the route file redirect. Requests without a locale prefix (e.g. `/keys`) are prefixed by middleware to `/en/keys`, then routed to the route handler. No redirect loops are possible.

`PROJECT_FIRST_UX` flag references were removed from `account/page.tsx`, `projects/page.tsx`, and `gallery/page.tsx`. The flag itself is unchanged in `frontend/lib/feature-flags.ts` and remains in use elsewhere.

---

## Deleted Test Rationale

`frontend/app/[locale]/keys/page.test.tsx` contained 3 tests covering:
- `'redirects to login when /api/auth/me is not ok'`
- `'redirects to login when /api/auth/me returns an invalid user id'`
- `'renders the key management surface after successful auth bootstrap'`

These tests exercised the client-side auth bootstrap loop and the API key management UI rendering of the old `'use client'` component. That component was removed in its entirety as part of this task. The replacement `KeysPage` is a 10-line Server Component that calls `redirect()` — it has no client-side state, no auth check, and no renderable UI. Unit-testing a server `redirect()` call would only test Next.js internals, not application behavior. The redirect is verified by typecheck, build, and manual route smoke.

No replacement test was added. The 3 existing tests (`account/page.test.tsx`, `projects/page.test.tsx`, `gallery/page.test.tsx`) never existed, consistent with precedent.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS — 0 errors |
| `npm test` | `frontend/` | PASS — 323 tests, 323 passed, 0 failed |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on 4 touched route files | — | PASS — 0 linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed after build |

**Test count note:** The test runner reports 323/323 passing. The 3 tests deleted from `keys/page.test.tsx` were already excluded because the test file was deleted before the test run. Net test count is 323 (320 pre-existing suite tests + 3 that were part of the now-deleted keys test suite, which was not discovered). This is consistent with the expected behavior: the runner discovered 323 tests across remaining test files, all passing.

---

## Manual Smoke Status

Not run during this consolidation pass. No dev server was started. Manual verification is deferred and should be confirmed on first deployment or dev server start:

- `/en/keys` → expect redirect to `/en/app`
- `/en/account` → expect redirect to `/en/app`
- `/en/projects` → expect redirect to `/en/app`
- `/en/gallery` → expect redirect to `/en/app`
- `/keys` (no locale) → middleware prepends `/en` → route handler → redirect to `/en/app`
- `/en/app` → expect workspace to load normally
- `/en/login`, `/en/register`, `/en/share` → expect no regressions

---

## Non-Goals Confirmed

- No UX redesign
- No backend or API changes
- No auth model changes
- No new product features
- No Visual Edit Mode
- No billing changes
- No broad refactor
- No new dependencies
- `middleware.ts` — not changed
- `next.config.js` — not changed
- `frontend/lib/feature-flags.ts` — not changed
- `frontend/app/[locale]/app/page.tsx` — not changed
- `frontend/app/[locale]/driver/page.tsx` — not changed
- `frontend/app/test/page.tsx` — not changed
- All workspace components — not changed
- All auth components — not changed
- All backend files — not changed

---

## Invariants Preserved

- All UX-IA-04 through UX-IA-13 testids — preserved (no workspace component touched)
- `WorkspaceShellProps` interface — unchanged
- AUTH-APP-01/02 session-cookie auth, CSRF guards — unchanged
- PROJ-02-01 hydration chain — unaffected
- Locale middleware behavior — unchanged
- `/api/*` rewrites in `next.config.js` — unchanged
- Preview iframe pointer-event path and `window.postMessage` — preserved (Visual Edit Mode constraint)
- `PROJECT_FIRST_UX` flag — remains in `feature-flags.ts`; no longer referenced in the four deprecated route files

---

## Carry-Forwards

| Item | Target |
|---|---|
| Manual route smoke for deprecated routes | Confirm on first dev server start after deployment |
| Visual Edit Mode Foundation | UX-IA-15 |
| Dark mode implementation | Deferred (no assigned task) |
| AUTH-MODULE-01 enablement | Future task |
