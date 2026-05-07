# AUTH-APP-01G3 Checkpoint — Logout + Basic Account Surface

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01G3 |
| Title | Logout + Basic Account Surface |
| Family | AUTH |
| Parent | AUTH-APP-01G (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND ONLY — no backend files changed |
| Date | 2026-05-07 |
| Depends on | AUTH-APP-01G2 (COMPLETE and LOCKED) |
| Checkpoint | `docs/AUTH-APP-01G3-CHECKPOINT.md` |
| Scope spec | `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Sections 6, 7, and 11 |

---

## Objective

Add a logout button wired to `POST /api/auth/logout`, clear local workspace UI state on logout, redirect to `/${locale}/login`, and add a minimal account/auth surface accessible when `PROJECT_FIRST_UX=true`. No backend changes. No auth protocol changes. No workspace redesign. No new dependencies.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added `handleLogout()` function; passed `onLogout={handleLogout}` to `<WorkspaceShell>` |
| `frontend/components/workspace/workspace-shell.tsx` | Added `onLogout?: () => void` to `WorkspaceShellProps`; added logout button in header for both PROJECT_FIRST_UX paths |
| `frontend/app/[locale]/account/page.tsx` | Preserved `PROJECT_FIRST_UX=false` redirect; added `<LogoutButton />` above `<ApiKeysPage />` for `PROJECT_FIRST_UX=true` path |
| `frontend/components/auth/logout-button.tsx` | New file — small `'use client'` component for account surface logout and email display |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added 3 focused tests for logout button render and call behavior |

**No backend files changed. No message JSON files changed. No new npm dependencies.**

---

## Logout Behavior

`handleLogout()` in `frontend/app/[locale]/app/page.tsx`:

```typescript
async function handleLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // still redirect and clear local UI state
  }

  handleWorkspaceUnauthorizedAccess();
}
```

- Calls `POST /api/auth/logout` (server revokes `auth_sessions` record and clears `aisandbox_session` cookie)
- On any outcome — success, 401, or network failure — calls `handleWorkspaceUnauthorizedAccess()`
- `handleWorkspaceUnauthorizedAccess()` already clears all local workspace state and pushes `/${locale}/login`
- No `localStorage` access_token/userId cleanup added (none exists post-AUTH-APP-01C1B)
- No client-side cookie manipulation
- `onLogout={handleLogout}` passed to `<WorkspaceShell>` as an optional prop

---

## Logout Placement

### `PROJECT_FIRST_UX=true` path
Logout button placed inside the existing header `<nav>` element (Projects / Gallery / Account) immediately after the Account link. Renders only when `onLogout` prop is provided. Uses `<button type="button">` with `data-testid="workspace-header-logout-button"`.

### `PROJECT_FIRST_UX=false` path
Logout button placed in the existing right-side header area immediately below the API Keys link. Same test ID and interaction classes as the true path. Renders only when `onLogout` prop is provided.

### Interaction polish (Emil Kowalski advisory, accepted)
Both placements use:
- `transition`
- `active:scale-[0.97]`
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`

No layout restructuring. No header redesign.

---

## Account Surface

### `PROJECT_FIRST_UX=false`
`account/page.tsx` continues to redirect to `/${locale}/keys` unchanged. Logout is accessible from the workspace header only for this path.

### `PROJECT_FIRST_UX=true`
`account/page.tsx` now renders `<LogoutButton />` above `<ApiKeysPage />`.

**`frontend/components/auth/logout-button.tsx`:**
- `'use client'` component
- Calls `GET /api/auth/me` on mount to display user email when available
- Redirects to `/${locale}/login` if the `GET /api/auth/me` call fails or returns a non-OK status
- Renders the user email in a `data-testid="account-auth-email"` paragraph when available
- Renders a logout button with `data-testid="account-logout-button"` using the existing `account.logout` translation key
- On click: calls `POST /api/auth/logout`, then redirects to `/${locale}/login`
- Uses the same interaction polish: `transition`, `active:scale-[0.97]`, `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`
- No provider management, no profile editing, no account redesign

**i18n:** Uses existing `account.logout` key. No new keys added. No message JSON files modified.

---

## Test Coverage

**Updated file:** `frontend/components/workspace/workspace-shell.test.tsx`

Three tests added:

| Test | Assertion |
|---|---|
| Logout button absent when `onLogout` omitted | `doesNotMatch` on `workspace-header-logout-button` in the base session-scoped render |
| Logout button renders in session-scoped header when `onLogout` provided | `match` on `workspace-header-logout-button` and `>Log out<` |
| Logout button renders in project-first header when `onLogout` provided | `match` on `workspace-header-logout-button` and `>Log out<` with `projectFirstUxEnabled: true` |
| Clicking logout calls `onLogout` | Uses `renderWorkspaceShellElementByTestId`; verifies `onClick` calls the prop once |

No account page test was added. G4 manual smoke checklist (items 7 and 8) covers integration validation.

---

## Validation Results

| Command | Result |
|---|---|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build` | PASS — Next.js 15.5.12, compiled in 4.2s |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit` | PASS |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test` | PASS — 256 tests, 22 suites, 0 failures |

### `tsconfig.tsbuildinfo` restore

`frontend/tsconfig.tsbuildinfo` was modified by `npm run build`. Restored:

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

Post-restore `git status`: clean — no modification.

---

## Non-Goals Confirmed

- No backend changes
- No auth protocol changes
- No OAuth callback changes
- No email verification
- No password reset
- No route/API protection changes
- No workspace redesign
- No full account redesign
- No provider management UI
- No password change UI
- No billing section
- No keys page token migration
- No Visual Edit Mode
- No new npm dependencies
- No message JSON changes

---

## Invariants Preserved

- Cookie-session auth behavior unchanged (`aisandbox_session` cookie flow)
- `POST /api/auth/logout` endpoint and session revocation behavior unchanged
- `handleWorkspaceUnauthorizedAccess()` function unchanged
- UX-IA-02 design token usage on login/register pages preserved
- UX-IA-03 login/register page structure preserved
- All existing i18n keys in all three locales preserved
- AUTH-APP-01G2 OAuth error display behavior preserved
- `PROJECT_FIRST_UX=false` account redirect to `/keys` preserved
- No existing tests broken (256 passing, up from 253 after G2 + 3 new workspace-shell tests)

---

## Next Recommended Task

**AUTH-APP-01G4 — Auth UX Validation + Checkpoint**

Stage-start should:
1. Read `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Section 12 (G4 validation scope)
2. Run the full automated validation suite: `npm run build`, `npx tsc --noEmit`, `npm test`
3. Execute the 10-item manual smoke checklist from Section 12 (items 7 and 8 specifically cover logout)
4. Create `docs/AUTH-APP-01G-CHECKPOINT.md` (parent family checkpoint)
5. Update `TASKS.md` and `TASKS_BACKLOG_FULL.md` to mark AUTH-APP-01G4 and AUTH-APP-01G COMPLETE and LOCKED

---

## Reference

- `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` — governing scope for AUTH-APP-01G
- `docs/AUTH-APP-01G1-CHECKPOINT.md` — G1 inventory and scope
- `docs/AUTH-APP-01G2-CHECKPOINT.md` — G2 OAuth error + button polish
- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions
- `docs/AUTH-APP-01C1A-CHECKPOINT.md` — `POST /api/auth/logout` backend endpoint
- `docs/UX-IA-02-CHECKPOINT.md` — design token definitions
- `TASKS.md` → AUTH-APP-01G3
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01G3
