# WS-05 CHECKPOINT — Workspace Selector And Filtered Project List

## Task Metadata

| Field | Value |
|---|---|
| Task ID | WS-05 |
| Family | WS (Workspace Rollout) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND / UX — workspace selector and project list filtering |
| Date completed | 2026-04-28 |
| Source | WS v1 rollout — fifth slice; follows WS-04 frontend plumbing |

---

## Objective

Add the first visible workspace UX: load workspaces, show a workspace selector in the existing project-first surface, persist the selection in tab-scoped sessionStorage, and filter the project list to the active workspace. Stop before workspace management UI.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-projects.logic.ts` | Extended `loadWorkspaceProjects` with optional `workspaceId?: string`; forwards `?workspaceId=...` when provided |
| `frontend/app/[locale]/app/page.tsx` | Added workspace state, bootstrap, persistence, filter path, and handler; wired selector props into `WorkspaceShell` |
| `frontend/components/workspace/workspace-shell.tsx` | Added workspace selector props to interface; passed them into `HistoryProjectPanel`; rendered minimal `<select>` in the project surface |
| `frontend/components/workspace/workspace-projects.logic.test.ts` | Added test for workspace query forwarding |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added workspace selector render/change test; updated snapshot-surface and selector-facing fixtures for new required props |

No backend, entity, migration, schema, or non-UI-frontend file changed in WS-05.

---

## Implementation Summary

### `workspace-projects.logic.ts`

- `LoadProjectsArgs` extended with `workspaceId?: string`
- `loadWorkspaceProjects(...)` builds endpoint as `/api/projects?workspaceId=<id>` when provided; falls back to `/api/projects` when omitted

### `page.tsx`

- Added state: `workspaces: Workspace[]`, `selectedWorkspaceId: string | null`
- Added ref: `coldMountSeededWorkspaceIdRef` (mirrors existing `coldMountSeededProjectIdRef` pattern)
- Added constant: `TAB_SELECTED_WORKSPACE_STORAGE_KEY = 'workspace_tab_selected_workspace_id'`
- Bootstrap path: replaces `loadWorkspaceProjectsForUser(token)` with `loadWorkspacesForUser(token)` in the mount effect; `loadWorkspacesForUser` calls `loadWorkspaces(...)`, seeds `selectedWorkspaceId` from sessionStorage (falling back to `isDefault === true` workspace), then the `selectedWorkspaceId` effect triggers project loading
- Persistence: dedicated `useEffect([selectedWorkspaceId])` mirrors the existing `selectedProjectId` pattern
- Reload path: dedicated `useEffect([selectedSessionId, selectedWorkspaceId])` guarded by `PROJECT_FIRST_UX` and `projectOpenInProgressRef` — fires `loadWorkspaceProjectsForUser(token, selectedWorkspaceId)` without modifying the existing unrelated session/history effect chain
- `loadWorkspaceProjectsForUser` now takes an optional `workspaceId` arg (defaults to `selectedWorkspaceId` closure value); returns empty project list when workspace id is not yet resolved
- `handleWorkspaceSelection`: clears `selectedProjectId` and resets project action state, then sets `selectedWorkspaceId` (triggering the dedicated reload effect)
- `handleCreateWorkspaceProject`: passes `selectedWorkspaceId` to `createWorkspaceProject`; post-create reload uses the created project's `workspaceId` to reload
- All `loadWorkspaceProjectsForUser` call sites in the `selectedSessionId` effect and other reload flows were reviewed and kept consistent
- `WorkspaceShell` render site: adds `workspaces`, `selectedWorkspaceId`, `onSelectWorkspaceId`
- Workspace load error: clears project list and surfaces error through existing `projectListState`/`projectActionError` state
- Auth logout handler: clears `workspaces` and `selectedWorkspaceId`

### `workspace-shell.tsx`

- `WorkspaceShellProps` interface: added `workspaces?: Workspace[]`, `selectedWorkspaceId?: string | null`, `onSelectWorkspaceId?: (workspaceId: string) => void`
- Import added: `Workspace` from `./workspace-workspaces.logic`
- `HistoryProjectPanel` internal prop set: added `workspaces`, `selectedWorkspaceId`, `onSelectWorkspaceId`; the null-guard for required handlers now includes `onSelectWorkspaceId`
- Minimal `<select>` rendered above the project name/create input with `data-testid="history-workspace-select"`
- No management actions (create/rename/delete workspace) were added

---

## What Was Not Implemented

- No workspace create UI
- No workspace rename UI
- No workspace delete UI
- No move-project-between-workspaces
- No backend changes
- No entity, migration, or schema changes
- No later workspace slices

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` (from `frontend/`) | Passed — clean typecheck |
| `npx tsx --test workspace-projects.logic.test.ts workspace-shell.test.tsx` | Passed — 120/120 tests green |
| `ReadLints` on all touched WS-05 files | No linter errors |
| `frontend/tsconfig.tsbuildinfo` | Regenerated by `tsc`, restored with `git restore` |
| Frontend lint script (`npm run lint`) | Not run — known repo script/path issue; lint confirmed via `ReadLints` only |

Note: one intermediate test run failed because the snapshot-surface fixture in `workspace-shell.test.tsx` did not include the new required selector props. The fixture was updated with `workspaces`, `selectedWorkspaceId`, `onSelectWorkspaceId`; subsequent run was 120/120 green.

---

## Preserved Invariants

- Selector/filter UX only — no workspace CRUD management UI
- Existing project-open/session/history behavior preserved
- Workspace model remains personal-only in v1
- Compatibility with current backend response shapes preserved
- Scope stayed minimal so WS-06 can build on top cleanly
