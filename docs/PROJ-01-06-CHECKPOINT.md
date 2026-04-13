# PROJ-01-06 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-06
- Title: Make Project Open Use Project Scoped Latest Snapshot
- Nature: BUG FIX (PROJECT OPEN FLOW, SNAPSHOT SELECTION)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-06-CHECKPOINT.md`

## Objective

Fix project open so the default snapshot chosen for restore comes from the selected project's own latest snapshot, instead of using the user's global latest snapshot.

## Root Cause Confirmed

- Frontend default snapshot selection in `loadWorkspaceSnapshotsForUser()` set `selectedSnapshotId` to `snapshots[0]` (global latest user snapshot).
- `handleOpenWorkspaceProject()` forwarded that value directly as `snapshotId`, causing restores to unrelated snapshots.
- When the unrelated latest snapshot was empty, open succeeded but workspace appeared blank.

## Smallest Safe Fix Implemented

- `frontend/app/[locale]/app/page.tsx`
  - Removed implicit global default selection (`selectedSnapshotId` now stays `null` unless explicitly selected or just saved).
  - Added project-scoped default resolution for open flow:
    - `resolveProjectScopedLatestSnapshotId({ snapshots, projectId })`
  - Preserved explicit snapshot selection behavior:
    - If user explicitly selected a snapshot, that snapshot is still used.
  - Preserved safe bind-only fallback when selected project has no project-scoped snapshot:
    - Uses existing `POST /api/projects/:projectId/sessions/:sessionId` association path (no restore).
  - Snapshot saves now include project-scoped label marker when a project is selected:
    - `[project-id:<projectId>]`
- `frontend/components/workspace/workspace-snapshots.logic.ts`
  - Added `buildProjectScopedSnapshotLabel(projectId)`.
  - Added `resolveProjectScopedLatestSnapshotId({ snapshots, projectId })`.
- `frontend/components/workspace/workspace-projects.logic.ts`
  - Added `associateWorkspaceProjectSession(...)` helper for bind-only fallback path.

## Files Changed

- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-snapshots.logic.ts`
- `frontend/components/workspace/workspace-snapshots.logic.test.ts`
- `frontend/components/workspace/workspace-projects.logic.ts`
- `frontend/components/workspace/workspace-projects.logic.test.ts`
- `docs/PROJ-01-06-CHECKPOINT.md`
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`

## Validation Run

### 1) Focused frontend tests

Command:

- `npm test -- components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts`

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

### 3) Runtime UI/API-equivalent verification (real endpoint path)

Command:

- One PowerShell script against `http://localhost:4000` that:
  - creates user/session/project
  - saves project-scoped snapshot label `[project-id:<projectId>]`
  - creates a newer unrelated global snapshot
  - resolves project-scoped snapshot id from `/api/users/me/snapshots`
  - opens project with resolved project-scoped snapshot id
  - verifies restored file content
  - verifies no-project-snapshot branch keeps bind-only content intact via session-associate path

Observed outputs:

- `GLOBAL_LATEST=71255b99-52aa-4182-b12f-2b2583928640`
- `PROJECT_SCOPED=2a8df883-b418-4074-ac2f-0b26e9a202f0`
- `OPEN_RESTORED=2a8df883-b418-4074-ac2f-0b26e9a202f0`
- `READ_AFTER_SCOPED_OPEN=PROJECT_A_CONTENT`
- `BIND_ONLY_KEEP_CONTENT=KEEP_BIND_ONLY`

Interpretation:

- Default path no longer depends on unrelated global latest snapshot.
- Project open restores selected project's latest scoped snapshot when available.
- No project snapshot path remains safe bind-only.

## Scope and Invariants Preserved

- No backend open/restore redesign.
- No project-system redesign.
- No snapshot-system redesign.
- No workspace redesign.
- No scope expansion.
