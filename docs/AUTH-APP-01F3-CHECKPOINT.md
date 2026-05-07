# AUTH-APP-01F3 Checkpoint — Frontend Protected Route Behavior

**Task ID:** AUTH-APP-01F3
**Date:** 2026-05-07
**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND IMPLEMENTATION — no backend files changed, no new dependencies
**Parent:** AUTH-APP-01F (ACTIVE)
**Depends on:** AUTH-APP-01F2 (COMPLETE and LOCKED)
**Spec:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` (Sections 3.2, 7)

---

## Objective

Implement the frontend protected route behavior gaps identified in AUTH-APP-01F1. Specifically: add a cookie-session auth bootstrap to the `/[locale]/keys` page so that unauthenticated access redirects to `/${locale}/login` instead of showing an error overlay. The pattern mirrors the existing `/[locale]/app` bootstrap exactly. All other frontend routes required no change.

No backend files changed. No `middleware.ts` added. No new npm dependencies. No OAuth or email/password changes.

---

## Files Changed

### Modified

| File | Change |
|---|---|
| `frontend/app/[locale]/keys/page.tsx` | Added `authLoading` state; replaced mount-only `loadKeys()` effect with `GET /api/auth/me` bootstrap; added early loading gate |

### Added

| File | Purpose |
|---|---|
| `frontend/app/[locale]/keys/page.test.tsx` | Focused auth bootstrap tests for the `/keys` page |

**No other files changed.** No backend files, no i18n files, no other frontend pages, no configuration files, no npm dependencies.

---

## Implementation Summary

### `frontend/app/[locale]/keys/page.tsx`

Three targeted additions to the existing client component:

**1. `authLoading` state** added alongside existing state declarations:
```tsx
const [authLoading, setAuthLoading] = useState(true);
```

**2. Mount effect replaced** — the original `useEffect(() => { loadKeys(); }, [])` was replaced with a `GET /api/auth/me` bootstrap matching the `/app` pattern:
```tsx
useEffect(() => {
  void (async () => {
    try {
      const meResponse = await fetch('/api/auth/me');
      if (!meResponse.ok) {
        router.push(`/${locale}/login`);
        return;
      }
      const me = (await meResponse.json()) as { id?: unknown };
      if (typeof me.id !== 'string' || !me.id.trim()) {
        router.push(`/${locale}/login`);
        return;
      }
      setAuthLoading(false);
      void loadKeys();
    } catch {
      router.push(`/${locale}/login`);
    }
  })();
}, [locale, router]);
```

**3. Loading gate** added before the existing main render:
```tsx
if (authLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  );
}
```

**Preserved without change:** `loadKeys()`, `handleCreateKey()`, `handleRevokeKey()`, `handleCopyKey()`, existing authenticated error handling via `ErrorRemediation`, all key-management UI, all existing user-facing text and styling.

---

## Route Behavior Summary

| Route | Before F3 | After F3 | File changed |
|---|---|---|---|
| `/[locale]/keys` (unauthenticated) | Shows `ErrorRemediation` overlay on 401 from `GET /api/keys` | Redirects to `/${locale}/login` before rendering | `keys/page.tsx` |
| `/[locale]/keys` (authenticated) | Loads and renders key management surface | Identical — loads and renders key management surface | No behavioral change for auth users |
| `/[locale]/account` (unauthenticated) | Inherits gap from `/keys` | Inherits fix — either `redirect(/${locale}/keys)` or renders same `ApiKeysPage` component | No file change |
| `/[locale]/projects` | Delegates to `/app`; already protected | Unchanged | No file change |
| `/[locale]/driver` | Intentionally separate `DRIVER_API_KEY` flow | Unchanged — locked in spec Section 5 decision 10 | No file change |
| `/test` | Dev artifact; unprotected by design | Unchanged — locked in spec Section 5 decision 11 | No file change |

---

## Test Coverage Summary

**File added:** `frontend/app/[locale]/keys/page.test.tsx`

**Tests:** 3 focused tests using Node.js built-in `node:test` + `tsx` runner, consistent with the rest of the frontend test suite.

| Test | Assertion |
|---|---|
| `/api/auth/me` returns non-OK (401) | `router.push('/en/login')` called; `/api/keys` never called |
| `/api/auth/me` returns OK but missing/invalid `id` | `router.push('/en/login')` called; `/api/keys` never called |
| `/api/auth/me` returns valid `{ id: 'user-1' }` + `/api/keys` returns `[]` | No redirect; page renders `API Key Management`, `Create New API Key`, `Your API Keys`; loading gate is gone |

**Note on test discovery:** The repository's `npm test` script glob pattern (`components/workspace/*.test.ts*` and `components/public/*.test.ts*`) does not cover `app/[locale]/keys/`. The new test file is run directly:
```bash
npx tsx "$(Resolve-Path -LiteralPath 'app\[locale]\keys\page.test.tsx')"
```
This is consistent with the repo's Node test runner. The test file does not require modification of `package.json`.

---

## Validation

### Ordered sequence (build first, then typecheck, then test suite)

```
npm run build
Result: PASS

npx tsc --noEmit (after build)
Result: PASS

npm test
Result: PASS — 253 tests, 22 suites, 0 failures
```

### Targeted new route test

```
npx tsx <literal path to app/[locale]/keys/page.test.tsx>
Result: PASS — 3 tests, 0 failures
```

### Next.js typegen ordering note

Running `npx tsc --noEmit` **before** `npm run build` fails with `TS6053: File '... .next/types/...' not found` errors. This is a pre-existing environment characteristic: `tsconfig.json` includes `.next/types/**/*.ts`, and those files are only generated when Next.js builds the project. The errors are **not caused by any F3 file**; after `npm run build` generates `.next/types`, `npx tsc --noEmit` passes cleanly. This matches prior slices (AUTH-APP-01F2 backend had the same pre-existing `npm test` Redis env issue unrelated to that slice's changes).

### `tsconfig.tsbuildinfo` restore status

`frontend/tsconfig.tsbuildinfo` was modified by the validation sequence and restored with:
```bash
git restore -- frontend/tsconfig.tsbuildinfo
```
Final status: clean (no uncommitted modification).

---

## Non-Goals Confirmed

- No backend files changed
- No `middleware.ts` created
- No `/driver` changes
- No `/test` changes
- No `/account` changes (inherits fix automatically)
- No `/projects` changes
- No i18n message key additions
- No OAuth or email/password changes
- No workspace UX changes
- No Visual Edit Mode
- No new npm dependencies

---

## Governing Invariants Preserved

All invariants from AUTH-APP-01A and AUTH-APP-01C1A remain intact:

1. `SessionCookieGuard` is the backend browser auth path — not altered
2. `ApiKeyAuthGuard` / `DRIVER_API_KEY` Bearer flows — unchanged
3. `InternalServiceAuthGuard` on `/api/internal/*` — unchanged
4. No `Authorization: Bearer` session-token restoration — not introduced
5. No `localStorage` `access_token` restoration — not introduced
6. OAuth entry/callback routes remain public — not altered
7. `/[locale]/driver` remains the intentionally separate `DRIVER_API_KEY` auth path — no cookie-session enforcement added

---

## Acceptance Gate (spec Section 7.5)

- [x] `/[locale]/keys` redirects to `/${locale}/login` on unauthenticated access
- [x] `/[locale]/account` inherits the redirect via delegation (component-level fix)
- [x] `npx tsc --noEmit` passes after `npm run build`
- [x] `npm test` passes in `frontend`
- [x] `npm run build` passes in `frontend`
- [x] No backend files changed

---

## Reference

- `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` — sections 3.2, 7 (governing spec for this task)
- `docs/AUTH-APP-01F1-CHECKPOINT.md` — inventory/spec checkpoint
- `docs/AUTH-APP-01F2-CHECKPOINT.md` — backend guard fixes
- `docs/AUTH-APP-01C1A-CHECKPOINT.md` — `SessionCookieGuard` implementation (the backend guard that enforces the session check)
- `TASKS.md` → AUTH-APP-01F3
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01F3
