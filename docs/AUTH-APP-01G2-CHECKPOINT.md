# AUTH-APP-01G2 Checkpoint — Login/Register OAuth Error + Button Polish

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01G2 |
| Title | Login/Register OAuth Error + Button Polish |
| Family | AUTH |
| Parent | AUTH-APP-01G (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND UI ONLY — no backend files changed |
| Date | 2026-05-07 |
| Depends on | AUTH-APP-01G1 (COMPLETE and LOCKED) |
| Checkpoint | `docs/AUTH-APP-01G2-CHECKPOINT.md` |
| Scope spec | `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Sections 5 and 10 |

---

## Objective

Consume OAuth error query params on the login page, make `errors.oauthFailed` provider-agnostic across all three locales, add minimal OAuth button polish (advisory-driven), and decide register success behavior. No backend changes. No auth protocol changes.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/login/page.tsx` | Added `OAuthErrorBanner` sub-component + `<Suspense fallback={null}>` wrapper; added `Suspense` import from react; added `useSearchParams` import from next/navigation; applied OAuth button polish to Google and Apple links |
| `frontend/app/[locale]/register/page.tsx` | Applied OAuth button polish to Google and Apple links only |
| `frontend/messages/en.json` | Updated `errors.oauthFailed` to provider-agnostic wording |
| `frontend/messages/zh-TW.json` | Updated `errors.oauthFailed` to provider-agnostic wording |
| `frontend/messages/zh-CN.json` | Updated `errors.oauthFailed` to provider-agnostic wording |
| `frontend/app/[locale]/login/page.test.tsx` | New file — 3 targeted tests for `OAuthErrorBanner` |

**No backend files changed. No auth protocol changes. No new npm dependencies.**

---

## OAuth Error Rendering

### Implementation

An internal `OAuthErrorBanner` component was added to `login/page.tsx` (not exported):

```tsx
function OAuthErrorBanner() {
  const searchParams = useSearchParams();
  const tErrors = useTranslations('errors');
  const error = searchParams.get('error');

  if (!error) return null;

  return (
    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
      {error === 'account_conflict' ? tErrors('accountConflict') : tErrors('oauthFailed')}
    </div>
  );
}
```

- Reads `?error` query param via `useSearchParams()`
- Uses `useTranslations('errors')` — consistent with existing i18n namespace
- `error === 'account_conflict'` → renders `errors.accountConflict`
- All other error codes (including `oauth_failed`) → renders `errors.oauthFailed`
- Returns `null` when no `?error` param is present
- Styled with existing red error classes: `mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm`

### Suspense boundary

`OAuthErrorBanner` is the only component in the file that calls `useSearchParams()`. It is wrapped at its call site:

```tsx
<Suspense fallback={null}>
  <OAuthErrorBanner />
</Suspense>
```

Placed above the existing local form error block inside the form, so both error types may display simultaneously. The outer `LoginPage` component required no structural change.

### Login behavior preserved

- `POST /api/auth/login` — unchanged
- `router.push(/${locale}/app)` on success — unchanged
- Local form error state (`setError`) — unchanged
- UX-IA token styling — unchanged

### Register page

The register page does not receive OAuth error redirects from the backend (all errors redirect to `/login`). No OAuth error handling was added to the register page. Register success behavior (stay-on-page success message) was preserved with no change.

---

## OAuth Error Wording Changes

`errors.oauthFailed` updated to remove Google-specific reference. `errors.accountConflict` unchanged.

| Locale | Before | After |
|---|---|---|
| en | `"Sign in with Google failed. Please try again."` | `"Sign-in failed. Please try again."` |
| zh-TW | `"使用 Google 登入失敗，請再試一次。"` | `"登入失敗，請再試一次。"` |
| zh-CN | `"使用 Google 登录失败，请重试。"` | `"登录失败，请重试。"` |

---

## OAuth Button Polish

Applied to all four OAuth `<a>` links (login Google, login Apple, register Google, register Apple).

| Property | Before | After |
|---|---|---|
| Transition | `transition-colors` | `transition` |
| Active feedback | (none) | `active:scale-[0.97]` |
| Focus visibility | (none) | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand` |

All changes are pure Tailwind class additions. No new dependencies. Existing `href`, text, i18n keys, `mt-3` spacing on Apple links, and overall layout structure preserved.

---

## Register Success Behavior

**Decision: preserved unchanged.** The register page retains the current stay-on-page success message. No auto-redirect to login was added. Rationale: smallest safe change; email verification flow (AUTH-APP-01C2) is blocked and a redirect pattern could create UX confusion when email verification is eventually added.

---

## Test Coverage

**New file:** `frontend/app/[locale]/login/page.test.tsx`

Three targeted tests:

| Test | Assertion |
|---|---|
| No `?error` param | Neither `errors.oauthFailed` nor `errors.accountConflict` appears in rendered HTML |
| `?error=oauth_failed` | `errors.oauthFailed` appears; `errors.accountConflict` does not |
| `?error=account_conflict` | `errors.accountConflict` appears; `errors.oauthFailed` does not |

Test uses the same `node:test` + `renderToStaticMarkup` + `Module._load` harness pattern as `frontend/app/[locale]/keys/page.test.tsx`. Mocks in place: `next/navigation` (including `useSearchParams`), `hooks/useTranslations`, `next/link`, `axios`, `LanguageSwitcher`.

---

## Validation Results

| Command | Result |
|---|---|
| `npm run build` | PASS — Next.js 15.5.12, compiled in 3.3s |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 253 tests, 22 suites, 0 failures |
| `npx tsx "app/[locale]/login/page.test.tsx"` | PASS — 3 tests, 1 suite, 0 failures |

### `[locale]` test runner note

Running `npx tsx --test "app/[locale]/login/page.test.tsx"` discovered 0 tests because the shell/test runner does not resolve the bracketed `[locale]` directory name as a literal glob target. The correct invocation for this file is direct execution: `npx tsx "app/[locale]/login/page.test.tsx"` (without `--test`). This is the same behavior as the existing `app/[locale]/keys/page.test.tsx`. The file content and tests are correct; this is a runner-path issue only.

### `tsconfig.tsbuildinfo` restore

`frontend/tsconfig.tsbuildinfo` was modified by `npm run build`. It was restored:
```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```
Post-restore `git status`: clean — no modification.

---

## Non-Goals Confirmed

- No backend changes
- No OAuth callback protocol changes
- No account surface changes
- No logout implementation
- No full page redesign
- No keys page changes
- No workspace changes
- No Visual Edit Mode
- No new npm dependencies

---

## Invariants Preserved

- Cookie-session auth behavior unchanged (`aisandbox_session` cookie flow)
- `POST /api/auth/login` endpoint and redirect behavior unchanged
- UX-IA-02 design token usage on login/register pages preserved
- UX-IA-03 login/register page structure preserved
- All existing i18n keys in all three locales preserved

---

## Next Recommended Task

**AUTH-APP-01G3 — Logout + Basic Account Surface**

Stage-start should:
1. Read `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Sections 6 and 11
2. Inspect `frontend/app/[locale]/app/page.tsx` to locate account/user menu before committing to logout placement
3. Confirm: if logout + account surface is too large for a single slice, split to G3a (logout only) and G3b (account surface) before implementing
4. Confirm logout calls `POST /api/auth/logout`, clears state via `handleWorkspaceUnauthorizedAccess()` pattern, redirects to `/${locale}/login`

---

## Reference

- `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` — governing scope for AUTH-APP-01G
- `docs/AUTH-APP-01G1-CHECKPOINT.md` — G1 inventory and scope
- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions
- `TASKS.md` → AUTH-APP-01G2
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01G2
