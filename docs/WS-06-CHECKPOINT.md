# WS-06 CHECKPOINT — Workspace Create/Rename/Delete UI

## Task Metadata

| Field | Value |
|---|---|
| Task ID | WS-06 |
| Family | WS (Workspace Rollout) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND / UX — workspace management UI |
| Date completed | 2026-04-29 |
| Source | WS v1 rollout — sixth slice; follows WS-05 selector/filter surface |

---

## Objective

Add the minimal user-facing UI for creating, renaming, and deleting personal workspaces using the existing WS-02 CRUD API and WS-05 selector surface. Keep it lightweight, safe, and additive. Stop before project move UI and broader workspace redesign.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added workspace management state, input state, CRUD handlers, `applyLoadedWorkspaces` helper, and wired new props into `WorkspaceShell` |
| `frontend/components/workspace/workspace-shell.tsx` | Added workspace management props to `WorkspaceShellProps` and `HistoryProjectPanel`; rendered inline create/rename/delete controls in the project surface |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added focused tests for create/rename/delete controls; updated `projectPanelRenderOverrides` and `buildWorkspaceShellProps` with new required props |

### Not Changed

| File | Reason |
|---|---|
| `frontend/components/workspace/workspace-workspaces.logic.ts` | Already had the needed `createWorkspace`, `updateWorkspace`, `deleteWorkspace` helpers from WS-04 |

No backend, entity, migration, schema, or non-UI-frontend file changed in WS-06.

---

## Implementation Summary

### `page.tsx`

- Added state: `workspaceCreateNameInput`, `workspaceRenameNameInput`, `workspaceActionState` (`'idle' | 'creating' | 'renaming' | 'deleting'`), `workspaceActionError` (`string | null`)
- Added `useEffect([workspaces, selectedWorkspaceId])` to seed rename input from the selected workspace name
- Extracted `applyLoadedWorkspaces(loadedWorkspaces, preferredSelectedWorkspaceId?)` from the existing `loadWorkspacesForUser` to share workspace-list application logic across bootstrap and CRUD flows
- Updated `loadWorkspacesForUser` to accept optional `preferredSelectedWorkspaceId` and delegate to `applyLoadedWorkspaces`
- Added `handleWorkspaceCreateNameInputChange(value)` and `handleWorkspaceRenameNameInputChange(value)` following the existing `handleProjectNameInputChange` pattern
- Added `handleCreateWorkspace(name)`:
  - calls `createWorkspace(...)` from WS-04 helpers
  - reloads workspaces via `loadWorkspaces(...)`
  - applies loaded workspaces with `preferredSelectedWorkspaceId` set to the new workspace id
  - clears create input on success
- Added `handleRenameWorkspace(workspaceId, name)`:
  - calls `updateWorkspace(...)` from WS-04 helpers
  - reloads workspaces, preserves `selectedWorkspaceId`
- Added `handleDeleteWorkspace(workspaceId)`:
  - frontend guard: rejects if selected workspace is default (`isDefault === true`)
  - calls `deleteWorkspace(...)` from WS-04 helpers
  - reloads workspaces with `preferredSelectedWorkspaceId` set to `null` so `resolveSelectedWorkspaceId` falls back to the default workspace
- Updated `handleWorkspaceSelection` to clear workspace action state
- Updated `handleWorkspaceUnauthorizedAccess` to clear workspace action/input state
- Updated error path in `loadWorkspacesForUser` to clear rename input
- Passed new props into `<WorkspaceShell>`: `workspaceActionState`, `workspaceActionError`, `workspaceCreateNameInput`, `workspaceRenameNameInput`, `onWorkspaceCreateNameInputChange`, `onWorkspaceRenameNameInputChange`, `onCreateWorkspace`, `onRenameWorkspace`, `onDeleteWorkspace`

### `workspace-shell.tsx`

- `WorkspaceShellProps`: added `workspaceActionState?`, `workspaceActionError?`, `workspaceCreateNameInput?`, `workspaceRenameNameInput?`, `onSelectWorkspaceId?` (unchanged), `onWorkspaceCreateNameInputChange?`, `onWorkspaceRenameNameInputChange?`, `onCreateWorkspace?`, `onRenameWorkspace?`, `onDeleteWorkspace?`
- `HistoryProjectPanel` internal props: added matching workspace action/input/handler props; added to the null-guard check for required handlers
- Computed derived state: `selectedWorkspace`, `isWorkspaceActionBusy`, `hasProjectActionInFlight`, `workspaceControlsDisabled`, `canDeleteSelectedWorkspace`
- Rendered inline controls between the existing workspace selector and the project name input:
  - Create: text input (`data-testid="history-workspace-create-input"`) + button (`data-testid="history-workspace-create-button"`)
  - Rename: text input (`data-testid="history-workspace-rename-input"`) + button (`data-testid="history-workspace-rename-button"`)
  - Delete: button (`data-testid="history-workspace-delete-button"`) — disabled when `canDeleteSelectedWorkspace` is false (i.e. default workspace or no workspace selected)
  - Error: `<p>` with `data-testid="history-workspace-action-error"` shown when `workspaceActionError` is non-null
- Workspace selector and all workspace controls are disabled when `workspaceControlsDisabled` is true (workspace action busy OR project create/open in flight)
- No modal, drawer, or broader sidebar redesign was introduced

### Tests (`workspace-shell.test.tsx`)

- Updated `projectPanelRenderOverrides` with workspace management props: `workspaceActionState`, `workspaceActionError`, `workspaceCreateNameInput`, `workspaceRenameNameInput`, handler stubs
- Updated `buildWorkspaceShellProps` default props with workspace management props and full project/public-project prop set to prevent null-guard early-return
- Added 4 new tests:
  1. `renders workspace create controls and forwards create requests` — verifies input value, onChange forwarding, button enabled state, onClick forwarding
  2. `renders workspace rename controls and forwards rename requests` — verifies input value, onChange forwarding, button enabled state, onClick forwarding
  3. `keeps workspace delete disabled for the default workspace` — verifies disabled state when `selectedWorkspaceId` is `'workspace-1'` (isDefault: true)
  4. `enables workspace delete and forwards requests for non-default workspace` — verifies enabled state and onClick forwarding when `selectedWorkspaceId` is `'workspace-2'` (isDefault: false)

---

## What Was Not Implemented

- No move-project-between-workspaces
- No broader workspace redesign
- No nested workspaces
- No members / roles / billing / shared integrations
- No session-to-workspace relationship
- No D1/PROJ-03 work
- No later workspace slices

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` (from `frontend/`) | Passed — clean typecheck |
| `npx tsx --test workspace-shell.test.tsx workspace-workspaces.logic.test.ts` | Passed — 119/119 tests green |
| `ReadLints` on all touched WS-06 files | No linter errors |
| `frontend/tsconfig.tsbuildinfo` | Regenerated by `tsc`, restored with `git restore` |
| Frontend lint script (`npm run lint`) | Not run — known repo script/path issue; lint confirmed via `ReadLints` only |

---

## State Refresh Behavior

- Create: reloads workspaces and selects the new workspace
- Rename: reloads workspaces and preserves the selected workspace
- Delete: reloads workspaces and falls back through the existing `resolveSelectedWorkspaceId` logic, returning the default workspace when needed
- Default workspace delete is protected in UI (`canDeleteSelectedWorkspace` derived flag) and also rechecked in the page handler (`isDefault` guard)

---

## Preserved Invariants

- Workspace management UI only — no move-project-between-workspaces
- Existing project-open/session/history behavior preserved
- Workspace model remains personal-only in v1
- Compatibility with current backend CRUD behavior preserved
- Scope stayed minimal — no broader sidebar or workspace redesign
