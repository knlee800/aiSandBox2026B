# UX-IA-23 Checkpoint — Fix Projects Tab New Project Flow

**Task ID:** UX-IA-23
**Family:** UX-IA
**Status:** COMPLETE and LOCKED
**Depends on:** UX-IA-22 (`docs/UX-IA-22-CHECKPOINT.md`)
**Date:** 2026-05-27

---

## Root Cause

The "New Project" button in the Projects tab (`data-testid="workspace-projects-new-project-button"`) appeared unresponsive on click. The button called `onCreateWorkspaceProject` directly, which maps to `handleCreateWorkspaceProject` in `page.tsx`. That handler returns early with an error when `projectNameInput` is empty. The Projects tab contained no input field for the project name — the only such input existed in `HistoryProjectPanel` (history side panel, far from the button). The error state was displayed in the history panel, invisible to the user near the button.

---

## Files Changed

### Production source
- `frontend/components/workspace/workspace-shell.tsx`

### Test
- `frontend/components/workspace/workspace-shell.test.tsx`

### Tooling / test-runner determinism
- `frontend/package.json`

---

## UX Fix Summary

In `WorkspaceShell` (`workspace-shell.tsx`):

1. Added local state: `const [showNewProjectRow, setShowNewProjectRow] = React.useState(false)`
2. Added derived constant: `const trimmedProjectNameInput = (props.projectNameInput ?? '').trim()`
3. Added `useEffect` to auto-close the inline row after successful creation (`props.projectActionState === 'success'`)
4. Replaced only the Projects tab header "New Project" button block with a two-state inline form:
   - **Collapsed (default):** existing button preserved with `data-testid="workspace-projects-new-project-button"`; click sets `showNewProjectRow = true`
   - **Expanded:** inline input + confirm button + cancel button + conditional error
     - Input: `value={props.projectNameInput ?? ''}`, `onChange → props.onProjectNameInputChange`, `placeholder={projectPanelMessages.newProjectName}`; Enter triggers create (when valid); Escape cancels
     - Confirm: `onClick → void props.onCreateWorkspaceProject?.()`, disabled when `hasProjectActionInFlight` or name empty; label uses `commonMessages.creating` / `projectPanelMessages.createProject`
     - Cancel: hides row, clears input via `props.onProjectNameInputChange?.('')`
     - Error: renders `props.projectActionError` inline (`data-testid="workspace-projects-create-error"`)

New test IDs added:
- `workspace-projects-new-project-input`
- `workspace-projects-create-confirm-button`
- `workspace-projects-create-cancel-button`
- `workspace-projects-create-error`

No new props on `WorkspaceShell`. No new locale keys. No backend or API changes.

---

## Test-Runner Determinism Fix

Prior to implementation, `frontend/package.json` test script used `npx tsx --test ...`. `tsx` was not in workspace dependencies, so `npx` attempted an external registry fetch that failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in this environment.

Fix applied:
- Added `tsx` to `frontend` devDependencies (`"tsx": "^4.22.3"`)
- Changed test script from `npx tsx --test ...` to `tsx --test ...` (local runner, no registry fetch)

---

## Tests Updated

`frontend/components/workspace/workspace-shell.test.tsx`:

- Added `withPatchedReactHooksWithCustomUseState` helper for controlled `useState` behavior in interaction tests
- Added 4 new tests:
  - `clicking projects new project button reveals inline input row`
  - `projects inline create confirm button calls onCreateWorkspaceProject`
  - `projects inline create cancel button hides row and clears input`
  - `projects inline input Enter triggers create and Escape cancels`
- Fixed mocking call-index offset in existing `search filter hides non-matching template cards` test (useStateCallIndex 3 → 4) to account for new `showNewProjectRow` state insertion

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` from `frontend/` | PASS |
| `npm test` from `frontend/` | PASS — 484 tests, 484 pass, 0 fail |
| `ReadLints` on touched files | PASS — 0 new errors |
| `frontend/tsconfig.tsbuildinfo` | Restored after validation |

---

## Non-Goals Confirmed

- No backend or API changes
- No new locale keys (`project.newProjectName`, `project.createProject`, `common.cancel`, `common.creating` already existed)
- No modal system introduced
- No new props added to `WorkspaceShell`
- No route, model, or entity changes
- No broad project/workspace redesign
- No governance docs edited during implementation step

---

## Acceptance Checks

- [x] UX-IA-23 registered in TASKS.md and TASKS_BACKLOG_FULL.md
- [x] Inline new-project row appears on button click in projects tab
- [x] Confirm button calls `onCreateWorkspaceProject` with non-empty name
- [x] Cancel button hides row and clears `projectNameInput`
- [x] Row auto-closes on `projectActionState === 'success'`
- [x] `projectActionError` displayed inline in the row
- [x] `data-testid="workspace-projects-new-project-button"` preserved
- [x] No new locale keys added
- [x] tsc, tests, and lints pass
- [x] `docs/UX-IA-23-CHECKPOINT.md` created

---

## Next Recommended Step

UX-IA family is complete through UX-IA-23. Register next task from `TASKS_BACKLOG_FULL.md` or conduct a live browser smoke test of the Projects tab New Project flow to confirm the inline input renders and creation completes end-to-end.
