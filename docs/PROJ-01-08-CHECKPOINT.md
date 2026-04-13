# PROJ-01-08 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-08
- Title: Auto Save Initial Project Snapshot On Project Create
- Nature: UX FIX (PROJECT SAVE SEMANTICS, CONTENT PERSISTENCE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-08-CHECKPOINT.md`

## Objective

Make project creation persist the current workspace content by automatically saving an initial project-scoped snapshot, so users experience "create/save project" as saving both project identity and current files.

## Root Cause Confirmed

- `Create Project` (`POST /api/projects`) persists project metadata only.
- Open-project restore depends on a project-scoped snapshot existing.
- Without a project-scoped snapshot, open path is bind-only and can appear empty.

## Smallest Safe Fix Implemented

- Updated `handleCreateWorkspaceProject()` in `frontend/app/[locale]/app/page.tsx`:
  - After successful project creation, check current active session workspace for content by loading file tree and resolving first file path.
  - If workspace has files, automatically save one initial project-scoped snapshot using existing snapshot save path:
    - `saveWorkspaceSnapshot({ token, sessionId, label: [project-id:<createdProjectId>] })`
  - If workspace is empty, skip auto snapshot safely.
  - If auto-snapshot attempt fails, keep project create flow successful (log only, no create failure).
  - Existing explicit `Save Snapshot` behavior remains unchanged.
  - Existing project open/restore behavior remains unchanged.

## Files Changed

- `frontend/app/[locale]/app/page.tsx`
- `docs/PROJ-01-08-CHECKPOINT.md`
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

### 3) Runtime UI/API-equivalent flow checks

Command:

- One PowerShell script against `http://localhost:4000` reproducing updated create/open semantics:
  - create workspace with file content
  - create project
  - run create-flow-equivalent auto-snapshot branch on non-empty workspace
  - open project without manual snapshot step and verify restore
  - verify empty-workspace create branch remains safe
  - verify explicit snapshot open still works

Observed outputs:

- `AUTO_INITIAL_SNAPSHOT_CREATED=True`
- `AUTO_PROJECT_SCOPED_SNAPSHOT_COUNT=1`
- `OPEN_WITHOUT_MANUAL_SNAPSHOT_RESTORED=c69f7d13-bb2b-4cdd-a16e-a3c6f91914f2`
- `OPEN_WITHOUT_MANUAL_SNAPSHOT_CONTENT=AUTO_SNAP_CONTENT`
- `EMPTY_WORKSPACE_FILE_COUNT=0`
- `EMPTY_PROJECT_SCOPED_SNAPSHOT_COUNT=0`
- `EXPLICIT_SNAPSHOT_OPEN_RESTORED=8aa95517-ff8f-4a7b-9126-e11df7ae460d`
- `EXPLICIT_SNAPSHOT_OPEN_CONTENT=AUTO_SNAP_CONTENT`

Interpretation:

- Non-empty workspace create path now yields an initial project-scoped snapshot.
- Open-project can restore content without a separate manual snapshot first.
- Empty-workspace create remains safe (no forced snapshot).
- Explicit snapshot behavior remains intact.

## Scope and Invariants Preserved

- No project-system redesign
- No snapshot-system redesign
- No workspace redesign
- No scope expansion
