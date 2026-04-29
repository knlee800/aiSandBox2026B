# WS-07 CHECKPOINT — Move Project Between Workspaces

## Task Metadata

| Field | Value |
|---|---|
| Task ID | WS-07 |
| Family | WS (Workspace Rollout) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND + FRONTEND — move project workspace assignment |
| Date completed | 2026-04-29 |
| Source | WS v1 rollout — seventh slice; follows WS-06 workspace management UI |

---

## Objective

Allow a user to move an existing owned project from its current workspace to another owned workspace, with strict ownership validation and safe frontend state refresh. The move changes only the `project.workspaceId` relationship and does not affect sessions, files, snapshots, history, or saved versions.

---

## Files Changed

### Created

| File | Change |
|---|---|
| `services/api-gateway/src/projects/dto/move-project.dto.ts` | New DTO with `targetWorkspaceId: string` validated by `@IsUUID()` |

### Updated

| File | Change |
|---|---|
| `services/api-gateway/src/projects/projects.controller.ts` | Added `PATCH :id/workspace` endpoint delegating to `moveProjectToWorkspace` |
| `services/api-gateway/src/projects/projects.service.ts` | Added `moveProjectToWorkspace(userId, projectId, targetWorkspaceId)` method |
| `services/api-gateway/src/projects/projects.controller.spec.ts` | Updated service mock; added controller delegation test for move endpoint |
| `services/api-gateway/src/projects/projects.service.spec.ts` | Added 3 focused service tests for successful move, cross-user target workspace rejection, cross-user project rejection |
| `frontend/components/workspace/workspace-projects.logic.ts` | Added `MoveProjectArgs` interface and `moveWorkspaceProject(args)` helper |
| `frontend/components/workspace/workspace-projects.logic.test.ts` | Added focused test for `moveWorkspaceProject` helper |
| `frontend/app/[locale]/app/page.tsx` | Added `projectMoveTargetWorkspaceId` state; extended `projectActionState` with `'moving'`; added `handleProjectMoveTargetWorkspaceSelection` and `handleMoveWorkspaceProject` handlers; wired new props into `WorkspaceShell` |
| `frontend/components/workspace/workspace-shell.tsx` | Extended `WorkspaceShellProps` and `HistoryProjectPanel` with move props; rendered move target select and button in the project surface |
| `frontend/components/workspace/workspace-shell.test.tsx` | Updated fixtures with move props and project `workspaceId`; added 2 focused move control tests |

### Not Changed

| File | Reason |
|---|---|
| `frontend/components/workspace/workspace-workspaces.logic.ts` | No changes needed — existing helpers sufficient |
| All schema / migration files | No schema or migration changes in this slice |

---

## Implementation Summary

### Backend

**`dto/move-project.dto.ts`**

- Defines `MoveProjectDto` with a single field: `targetWorkspaceId: string`, validated by `@IsUUID()`.

**`projects.controller.ts`**

- Added `@Patch(':id/workspace')` route with `@HttpCode(HttpStatus.OK)`.
- Extracts `id` from route params, `body` as `MoveProjectDto`, and `req.user.userId` from the JWT guard.
- Delegates to `this.projectsService.moveProjectToWorkspace(userId, id, body.targetWorkspaceId)`.

**`projects.service.ts`**

- Added `moveProjectToWorkspace(userId: string, projectId: string, targetWorkspaceId: string): Promise<Project>`.
- Loads the project via `getProjectByIdForUser(userId, projectId)` — throws `NotFoundException` if not found or not owned.
- Validates target workspace ownership via `WorkspacesService.getWorkspaceByIdForUser(userId, targetWorkspaceId)` — throws `NotFoundException` if not found or not owned.
- If `project.workspaceId === targetWorkspaceId`, returns the project as a no-op (self-move allowed).
- Otherwise sets `project.workspaceId = targetWorkspaceId` and saves via `projectRepository.save(project)`.
- Only `project.workspaceId` is mutated — no other project fields are touched.

### Frontend

**`workspace-projects.logic.ts`**

- Added `MoveProjectArgs` interface: `{ token: string; projectId: string; targetWorkspaceId: string; fetchImpl?: typeof fetch }`.
- Added `moveWorkspaceProject(args)`: sends `PATCH /api/projects/:projectId/workspace` with `{ targetWorkspaceId: args.targetWorkspaceId.trim() }` in the JSON body and `Authorization: Bearer` header. Returns `WorkspaceProjectSummary`. Throws on non-OK responses.

**`workspace-projects.logic.test.ts`**

- Added `moveWorkspaceProject patches the target workspace id` test: verifies correct URL, trimmed body payload, and returned `workspaceId`.

**`page.tsx`**

- Added `projectMoveTargetWorkspaceId: string | null` state (initialized `null`).
- Extended `projectActionState` union type to include `'moving'`.
- Added `useEffect([selectedProjectId])` that resets `projectMoveTargetWorkspaceId` to `null` when the selected project changes.
- Added `handleProjectMoveTargetWorkspaceSelection(workspaceId: string)` — sets `projectMoveTargetWorkspaceId`.
- Added `handleMoveWorkspaceProject(projectId: string | null, targetWorkspaceId: string | null)`:
  - Guards against null project/workspace, concurrent actions, and matching current project workspace.
  - Sets `projectActionState` to `'moving'`.
  - Calls `moveWorkspaceProject(...)` helper.
  - If the moved project is attached to the active session (`projectId === sessionProjectId`), explicitly preserves `selectedProjectId` and `selectedProjectVisibility` so the open session/files/history are not closed.
  - Reloads the current filtered project list via `loadWorkspaceProjectsForUser(token, selectedWorkspaceId, preserveFlag)`.
  - Resets state to `'idle'` on completion or error.
- Passed `projectMoveTargetWorkspaceId`, `onProjectMoveTargetWorkspaceIdChange`, and `onMoveWorkspaceProject` props into `<WorkspaceShell>`.

**`workspace-shell.tsx`**

- Extended `WorkspaceShellProps` with: `projectMoveTargetWorkspaceId?`, `onProjectMoveTargetWorkspaceIdChange?`, `onMoveWorkspaceProject?`.
- Extended `HistoryProjectPanel` internal props identically.
- Rendered a move control block, visible only when `props.selectedProjectId` is non-null:
  - `<select data-testid="history-project-move-workspace-select">` — lists all workspaces except the currently selected project's own workspace; value bound to `projectMoveTargetWorkspaceId`.
  - `<button data-testid="history-project-move-button">Move to Workspace</button>` — disabled while any project or workspace action is in flight, or when no target is selected.
- Move controls are disabled when `isWorkspaceActionBusy || hasProjectActionInFlight` is true, matching the pattern used for other controls.

**`workspace-shell.test.tsx`**

- Updated `projectPanelRenderOverrides` and `buildWorkspaceShellProps` default props to include `projectMoveTargetWorkspaceId: null`, `onProjectMoveTargetWorkspaceIdChange: () => {}`, `onMoveWorkspaceProject: async () => {}`, and `workspaceId: 'workspace-1'` on the test project fixture.
- Added `renders project move workspace selector for selected project` — verifies the select renders and its `value` is the `projectMoveTargetWorkspaceId`.
- Added `forwards project move target changes and move requests` — verifies `onChange` forwards the selected workspace id, the move button is enabled, and `onClick` invokes `onMoveWorkspaceProject`.

---

## What Was Not Implemented

- No drag-and-drop move UI
- No bulk move
- No nested workspaces
- No members / roles / billing / shared integrations
- No session-to-workspace relationship
- No file, session, snapshot, history, or saved-version mutation
- No schema or migration files changed
- No D1/PROJ-03 work
- No later workspace slices

---

## Validation

| Check | Result |
|---|---|
| `cd services/api-gateway && npm run build` | Passed — clean build |
| `cd services/api-gateway && npx jest "src/projects/projects.service.spec.ts" --runInBand` | Passed |
| `cd services/api-gateway && npx jest "src/projects/projects.controller.spec.ts" --runInBand` | Passed |
| `cd frontend && npx tsc --noEmit -p tsconfig.json` | Passed — clean typecheck |
| `cd frontend && npx tsx --test components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-shell.test.tsx` | Passed |
| `ReadLints` on all touched WS-07 backend/frontend files | No linter errors |
| `frontend/tsconfig.tsbuildinfo` | Regenerated by `tsc`, restored with `git restore` |

---

## Honest Notes

- Move is **metadata-only**: only `project.workspaceId` is updated.
- No file, session, snapshot, history, or saved-version mutation was added.
- After a move, the current workspace-filtered project list reloads.
- If the moved project leaves the currently selected workspace, it drops out of that visible filtered list.
- If the moved project is attached to the active session, the handler preserves the current project context so the open session, files, and history are not closed or mutated in this slice.

---

## Preserved Invariants

- Metadata-only project move — no session, file, snapshot, or history mutation
- Strict user-scoped ownership validation for both project and target workspace
- Current open project/session preserved when the moved project is active
- Project-first UX and workspace selector/filter behavior preserved
- No broad redesign — move control is minimal and inline in the existing project surface
- Workspace model remains personal-only in v1
