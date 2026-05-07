# AUTH-APP-01C1B Checkpoint

**Task ID:** AUTH-APP-01C1B
**Title:** Frontend localStorage / Bearer Migration
**Date:** 2026-05-06
**Status:** COMPLETE and LOCKED

---

## Objective

Remove all frontend dependence on `localStorage` for `access_token` and `userId`, and remove all manual `Authorization: Bearer ${token}` headers from browser-side fetch calls that use session-cookie authentication. After this slice, the browser relies entirely on the HTTP-only `aisandbox_session` cookie set by AUTH-APP-01C1A. The DRIVER_API_KEY / AI driver bearer flow was explicitly preserved and is out of scope for removal.

---

## Files Changed

### Production files

- `frontend/app/[locale]/app/page.tsx`
- `frontend/app/[locale]/keys/page.tsx`
- `frontend/app/[locale]/login/page.tsx`
- `frontend/app/[locale]/share/[projectId]/page.tsx`
- `frontend/components/public/public-landing-slice.tsx`
- `frontend/components/workspace/workspace-chat-persistence.logic.ts`
- `frontend/components/workspace/workspace-checkpoint-create.logic.ts`
- `frontend/components/workspace/workspace-checkpoint-diff.logic.ts`
- `frontend/components/workspace/workspace-checkpoint-revert.logic.ts`
- `frontend/components/workspace/workspace-exec.logic.ts`
- `frontend/components/workspace/workspace-file-navigation.logic.ts`
- `frontend/components/workspace/workspace-projects.logic.ts`
- `frontend/components/workspace/workspace-snapshots.logic.ts`
- `frontend/components/workspace/workspace-workspaces.logic.ts`
- `frontend/lib/open-project-in-fresh-session.ts`
- `frontend/lib/project-autosave.ts`
- `frontend/lib/project-named-save.ts`

### Test files

- `frontend/components/workspace/workspace-chat-persistence.logic.test.ts`
- `frontend/components/workspace/workspace-checkpoint-create.logic.test.ts`
- `frontend/components/workspace/workspace-checkpoint-diff.logic.test.ts`
- `frontend/components/workspace/workspace-checkpoint-revert.logic.test.ts`
- `frontend/components/workspace/workspace-exec.logic.test.ts`
- `frontend/components/workspace/workspace-file-navigation.logic.test.ts`
- `frontend/components/workspace/workspace-projects.logic.test.ts`
- `frontend/components/workspace/workspace-snapshots.logic.test.ts`
- `frontend/components/workspace/workspace-workspaces.logic.test.ts`
- `frontend/lib/open-project-in-fresh-session.test.ts`

---

## Implementation Summary

### Login behavior changes

- `login/page.tsx` no longer reads `response.data.access_token` from the POST `/api/auth/login` response.
- `login/page.tsx` no longer writes `localStorage.setItem('access_token', ...)` or `localStorage.setItem('userId', ...)`.
- Login relies on the backend setting the `aisandbox_session` HttpOnly cookie automatically. After successful login the page redirects to `/${locale}/app` as before.

### App bootstrap behavior changes

- `app/page.tsx` init-time `useEffect` no longer reads `localStorage.getItem('access_token')` or `localStorage.getItem('userId')`.
- Bootstrap now issues `GET /api/auth/me` asynchronously; derives `userId` from the JSON response (`me.id`).
- If the `/api/auth/me` request returns a non-OK status or the response lacks a valid `id`, the user is redirected to `/${locale}/login`.
- Auth-gated `useEffect` hooks that previously guarded on `if (!token)` now guard on `if (!userId)` (derived from the `/api/auth/me` response); their dependency arrays include `userId` accordingly.
- `handleWorkspaceUnauthorizedAccess` no longer calls `localStorage.removeItem('access_token')` or `localStorage.removeItem('userId')`.

### API header migration summary

All browser-side fetch calls that previously included `Authorization: Bearer ${token}` for session-cookie-protected endpoints were updated:

- All workspace logic helper interfaces (`LoadWorkspacesArgs`, `CreateWorkspaceArgs`, etc.) had their `token: string` fields changed to `token?: string` (TypeScript backward-compatible) and the corresponding `Authorization` headers were removed from the fetch calls.
- All inline fetch calls inside `app/page.tsx` (`loadSessions`, `loadDashboardSlice`, `loadCheckpoints`, `refreshPreviewForSession`, `handleStartPreview`, etc.) had their `Authorization: Bearer ${token}` headers removed.
- `keys/page.tsx` — `loadKeys`, `handleCreateKey`, `handleRevokeKey` no longer include `Authorization: Bearer` headers and no longer read from `localStorage`.
- `open-project-in-fresh-session.ts` — `token` removed from `OpenProjectInFreshSessionArgs`; all internal pass-throughs removed.
- `project-autosave.ts` — `token` removed from `attemptProjectAutosave` args and from the downstream `saveWorkspaceSnapshot` call.
- `project-named-save.ts` — `token` removed from `attemptNamedProjectSave` args and from the downstream `saveWorkspaceSnapshot` call.

### Share / fork behavior changes

- `share/[projectId]/page.tsx` no longer reads `localStorage.getItem('access_token')` to gate fork behavior.
- Fork now fires `forkPublicWorkspaceProject({ projectId })` without a token; if the backend returns a 401 or 403, the user is redirected to `/${locale}/login`. Public read-only viewing is unaffected.

### Public landing readiness changes

- `public-landing-slice.tsx` no longer reads `window.localStorage.getItem('access_token')` in `useEffect` to set `hasAccessToken`.
- Landing page now issues `GET /api/auth/me` to determine whether a session exists (`hasSession`); result drives the "Continue to Workspace" CTA as before.
- `sessionStorage.setItem('aisandbox_pending_prompt', ...)` and prompt-submit routing to `/${locale}/login` are preserved.

### DRIVER_API_KEY preservation

- `DRIVER_API_KEY_STORAGE_KEY = 'driver_api_key'` and all `Authorization: Bearer ${apiKey}` headers for the AI execution endpoints (`/api/ai/execute`, `/api/ai/executions/:id`) in `app/page.tsx` were **not touched**. This flow is distinct from session authentication and is explicitly preserved.

### Test updates

- All affected `*.logic.test.ts` and `*.test.ts` files had `token` arguments removed from function call-sites.
- Assertions checking for `Authorization: 'Bearer token-xxx'` headers were removed from the test for `workspace-file-navigation.logic.test.ts`, `workspace-exec.logic.test.ts`, `workspace-checkpoint-diff.logic.test.ts`, and `workspace-checkpoint-revert.logic.test.ts`.
- No new test architecture was introduced.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS |
| `npm test` (frontend) | PASS |
| `npm run build` (frontend) | PASS |
| `ReadLints` on touched files | PASS — no linter errors |

### Safety grep results (all zero matches)

| Pattern | Matches |
|---|---|
| `localStorage.getItem('access_token')` | 0 |
| `localStorage.setItem('access_token'` | 0 |
| `localStorage.removeItem('access_token')` | 0 |
| `localStorage.getItem('userId')` | 0 |
| `localStorage.setItem('userId')` | 0 |
| `localStorage.removeItem('userId')` | 0 |
| `Bearer ${token}` | 0 |

### DRIVER_API_KEY preserved

`Authorization: Bearer ${apiKey}` confirmed present in `frontend/app/[locale]/app/page.tsx` (AI execution flow, two call-sites).

### tsconfig.tsbuildinfo

`frontend/tsconfig.tsbuildinfo` was modified by the `npm run build` validation run and was restored via `git restore -- frontend/tsconfig.tsbuildinfo` before the final summary. It is not part of the AUTH-APP-01C1B changeset.

---

## Scope Confirmation

The four additional production files that were added to the allowed list during implementation (`project-autosave.ts`, `project-named-save.ts`, `share/[projectId]/page.tsx`, `public-landing-slice.tsx`) were confirmed as active production session-auth `access_token` usages — not DRIVER_API_KEY flows, not test fixtures, not dead code. Their inclusion was explicitly approved during the implementation stage before any edits were made.

---

## Non-goals Confirmed

- No backend changes beyond AUTH-APP-01C1A infrastructure already in place.
- No Google/Apple OAuth.
- No email verification or password reset.
- No rate limiting.
- No auth UX redesign.
- No billing or subscription changes.
- No Visual Edit Mode.
- No unrelated frontend refactors.

---

## Risks / Invariants Preserved

- `JwtAuthGuard` and `JwtStrategy` remain in the backend codebase (preserved by AUTH-APP-01C1A; not altered here).
- `DRIVER_API_KEY_STORAGE_KEY` bearer token flow for AI execution is intact and not migrated.
- `sessionStorage.setItem('aisandbox_pending_prompt', ...)` behavior in the public landing slice is preserved.
- Existing `localStorage` usage for non-auth keys (e.g., `getChatThreadStorageKey`, `HIDDEN_UNUSABLE_SESSIONS_STORAGE_KEY`, `TAB_SELECTED_SESSION_STORAGE_KEY`, `TAB_EDITOR_DRAFT_STORAGE_KEY`) is preserved.
- Pre-existing backend carry-forward blockers from AUTH-APP-01C1A are unchanged (Redis test env, ESLint config discovery, `ai-execution.controller.spec.ts` pre-existing failures).

---

## Next Recommended Child Task

**AUTH-APP-01C2 — Email Verification / Password Reset / Rate Limiting** remains PLANNED and BLOCKED on transactional email provider selection.

**AUTH-APP-01D — Google OAuth** is available as the next unblocked slice. It depends on AUTH-APP-01C1A (complete) and preferably AUTH-APP-01C1B (now complete). It does not require AUTH-APP-01C2.

Recommended next step: stage-start for AUTH-APP-01D, or choose a transactional email provider to unblock AUTH-APP-01C2.
