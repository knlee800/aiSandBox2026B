# PROJ-01-11 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-11
- Title: Remove Duplicate File Reload Race After Project Open
- Nature: BUG FIX (PROJECT OPEN FLOW, FRONTEND STATE RACE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-11-CHECKPOINT.md`

## Objective

Fix the post-open frontend state race so restored project files appear immediately without browser reload by ensuring project open performs one coherent file-tree/editor refresh for the selected session.

## Root Cause Confirmed

From PROJ-01-10:

- Project open triggered two file reload paths for the same session:
  1) direct reload inside `handleOpenWorkspaceProject()`
  2) session-change reload in `useEffect([selectedSessionId])`
- `loadWorkspaceFilesForSession(...)` clears file-tree/editor state at start, so a later duplicate reload could overwrite a successful loaded state with an empty state.

## Smallest Safe Fix Implemented

Updated `frontend/app/[locale]/app/page.tsx` with a one-shot coordination guard:

- Added `skipNextSessionEffectFileReloadRef` to gate exactly one `selectedSessionId` effect reload.
- In `handleOpenWorkspaceProject()`:
  - when open targets a different session than `selectedSessionIdRef.current`, set the guard before `setSelectedSessionId(openSessionId)`.
  - continue using the direct project-open reload path (`loadWorkspaceFilesForSession(token, openSessionId)`) as the authoritative refresh.
- In `useEffect([selectedSessionId])` for file loading:
  - if the one-shot guard is set, consume it and return without reloading.
  - otherwise preserve existing normal selected-session reload behavior.
- In open-project error path:
  - clear the guard to avoid stale skip behavior.

This removes duplicate project-open reload races without redesigning workspace state flow.

## Files Changed

- `frontend/app/[locale]/app/page.tsx`
- `docs/PROJ-01-11-CHECKPOINT.md`
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`

## Validation Run

### 1) Focused frontend tests

Command:

- `npm test -- components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts components/workspace/workspace-shell.test.tsx`

Result:

- PASS
- 21 suites passed
- 164 tests passed
- 0 failed

### 2) Frontend type-check

Command:

- `npx tsc --noEmit`

Result:

- PASS

### 3) Lint check on changed file

Action:

- `ReadLints` for `frontend/app/[locale]/app/page.tsx`

Result:

- No linter errors on changed file

## Validation Coverage

- Open Project now has one authoritative post-open file reload for project-open flow.
- Effect-based selected-session reload remains intact outside project-open flow.
- File tree/editor reset/load sequence remains coherent and local.
- Existing backend restore behavior and project-scoped snapshot selection behavior are unchanged.

## Scope and Invariants Preserved

- No backend project restore changes
- No project-system redesign
- No snapshot redesign
- No workspace redesign
- No scope expansion
