# UX-IA-26 Checkpoint — Focused Create Workspace Panel from Dropdown

**Date:** 2026-05-27
**Task ID:** UX-IA-26
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Depends on:** UX-IA-25 (`docs/UX-IA-25-CHECKPOINT.md`), UX-IA-24 (`docs/UX-IA-24-CHECKPOINT.md`)

---

## Problem solved

Selecting "Create new workspace" from the sidebar workspace dropdown previously routed users to the generic Projects page. The intended UX is a focused creation flow, not a page navigation.

---

## Files changed

### Production source (implementation)
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

### Tests
- `frontend/components/workspace/workspace-shell.test.tsx`

### In-scope but unchanged
- `frontend/components/workspace/workspace-sidebar.tsx` — sidebar dropdown wiring from UX-IA-24 already correct; no changes required.

### Consolidation only (no production source changes)
- `docs/UX-IA-26-CHECKPOINT.md` (this file)
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`

---

## Focused panel UX and wiring summary

- `isCreateWorkspacePanelOpen` local state added to `WorkspaceShell`.
- `handleOpenCreateWorkspacePanel` callback wired to `onOpenCreateWorkspaceFlow` prop on `WorkspaceSidebar`, replacing the previous `() => props.onWorkspaceViewChange?.('projects')` stub.
- `handleWorkspaceViewChange` and `handleSelectWorkspaceId` wrappers ensure that any nav or workspace selection also closes the focused panel.
- `focusedCreateWorkspaceContent` renders when `projectFirstUxEnabled && isCreateWorkspacePanelOpen`, taking over the main content area from whichever workspace view was active.

Panel content (all text i18n-backed):
- Title: `workspaceMessages.createWorkspaceTitle`
- Description: `workspaceMessages.createWorkspaceDescription`
- Label + input for workspace name (reuses `workspaceCreateNameInput` / `onWorkspaceCreateNameInputChange`)
- Cancel: closes panel, clears input via `handleCloseCreateWorkspacePanel`
- Create: calls `onCreateWorkspace`; disabled/prevented when trimmed name is empty or action in flight

Success-close: `useEffect` watches `workspaceActionState` transition from `creating` → `idle` with no error while panel is open, and auto-closes + clears input.

No routing change. No Projects view or Projects nav behavior altered. No backend or API changes.

---

## i18n keys added

All three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`):

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.createWorkspaceTitle` | Create a Workspace | 建立工作區 | 创建工作区 |
| `workspace.createWorkspaceDescription` | Create a new place to make projects or collaborate with others. | 建立一個新的空間來製作專案或與他人協作。 | 创建一个新的空间来制作项目或与他人协作。 |
| `workspace.workspaceNameLabel` | Workspace name | 工作區名稱 | 工作区名称 |

## i18n keys reused (no changes needed)

- `workspace.createWorkspace` — Create button label
- `common.cancel` — Cancel button label
- `common.creating` — in-flight Create button label

---

## Tests updated

`frontend/components/workspace/workspace-shell.test.tsx` — within the `UX-IA-22` describe block (shared UX-IA sidebar wiring suite):

- New key assertions: `createWorkspaceTitle`, `createWorkspaceDescription`, `workspaceNameLabel` in all three locales
- Shell source assertion: `isCreateWorkspacePanelOpen` state, `handleOpenCreateWorkspacePanel` wiring, `shouldShowFocusedCreateWorkspacePanel` guard, i18n message references, no legacy `onWorkspaceViewChange?.('projects')` stub
- Dropdown create-new-workspace: now asserts panel opens (`isCreatePanelOpen === true`), no workspace ID selected, no view change fired
- Panel render: title, description, label, input, Cancel, Create all present
- Cancel: closes panel + clears input
- Create (name present): calls `onCreateWorkspace` once
- Create (empty / whitespace name): button disabled, handler not called
- Projects nav button: still fires `onWorkspaceViewChange('projects')` correctly
- Existing template-search hook-index test: adjusted from index 4 to index 5 to account for the new `isCreateWorkspacePanelOpen` state hook

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` (499 tests, 498 pass previously; 499 pass after adding new tests) | PASS |
| `ReadLints` on touched files | PASS — 0 errors |

---

## Non-goals confirmed

- No backend / API / service changes
- No route, model, or entity changes
- No modal library added
- No workspace settings/rename redesign
- No TASK-75A work
- No broad redesign of Projects page or Templates page
- No unrelated refactors

---

## Next recommended step

Live smoke test in browser with `projectFirstUxEnabled = true`:

1. Open the workspace dropdown in the sidebar.
2. Select "Create new workspace".
3. Confirm focused panel appears (title, description, input, Cancel, Create).
4. Confirm Cancel closes panel and clears input.
5. Confirm Create is disabled with empty name.
6. Enter a name and confirm Create calls the workspace creation handler.
7. Confirm panel closes on successful creation.
8. Confirm normal workspace selection still switches workspace without opening panel.
9. Confirm Projects nav tab still navigates to the Projects view.
