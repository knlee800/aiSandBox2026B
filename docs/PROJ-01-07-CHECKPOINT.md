# PROJ-01-07 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-07
- Title: Diagnose Real UI Save And Open Project Flow Still Opens Empty
- Nature: BUG INVESTIGATION (PROJECT FLOW, REAL USER PATH)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-07-CHECKPOINT.md`

## Objective

Determine why the real UI still opens a saved project into an empty workspace, despite earlier fixes to snapshot selection and refresh behavior.

## Exact Commands / Actions / Checks Run

1. Read required governance/task/checkpoint context:
   - `CLAUDE.md`
   - `TASKS.md` (PROJ-01 section)
   - `TASKS_BACKLOG_FULL.md` (PROJ-01 section)
   - `docs/PROJ-01-01-CHECKPOINT.md`
   - `docs/PROJ-01-02-CHECKPOINT.md`
   - `docs/PROJ-01-03-CHECKPOINT.md`
   - `docs/PROJ-01-04-CHECKPOINT.md`
   - `docs/PROJ-01-05-CHECKPOINT.md`
   - `docs/PROJ-01-06-CHECKPOINT.md`
2. Traced real frontend save/open handlers and payload paths:
   - `frontend/components/workspace/workspace-shell.tsx`
   - `frontend/app/[locale]/app/page.tsx`
   - `frontend/components/workspace/workspace-projects.logic.ts`
   - `frontend/components/workspace/workspace-snapshots.logic.ts`
3. Runtime reproduction against `http://localhost:4000` with the same endpoint sequence used by current UI logic:
   - register/login
   - create source session and write `index.html`
   - `POST /api/projects` (Create Project)
   - `GET /api/users/me/snapshots` and project-label filter check
   - create target session and execute no-snapshot open path (`POST /api/projects/:id/sessions/:sessionId`)
   - verify session project binding and file list/read result
   - save snapshot explicitly (`POST /api/sessions/:id/snapshot`) with `[project-id:<projectId>]` label
   - open through snapshot restore path (`POST /api/projects/:id/open` with explicit `snapshotId`)
   - verify restored file content
4. String-surface check for user-visible actions:
   - searched for `Save Project`, `Create Project`, and `Save Snapshot` in frontend.

## Exact Chain (Real UI Logic)

### A) Project metadata save path

1. Trigger in UI:
   - `Create Project` button in `HistoryProjectPanel`
2. Frontend handler:
   - `handleCreateWorkspaceProject()` in `frontend/app/[locale]/app/page.tsx`
3. Request:
   - `POST /api/projects`
   - payload: `{ name }`
4. Behavior:
   - creates project metadata record only
   - does not save workspace file content
   - success message: `Project created.`

### B) Content snapshot save path

1. Trigger in UI:
   - `Save Snapshot` button in `HistorySnapshotPanel`
2. Frontend handler:
   - `handleSaveWorkspaceSnapshot()`
3. Request:
   - `POST /api/sessions/:sessionId/snapshot`
   - payload includes project-scoped label when project selected: `[project-id:<projectId>]`
4. Behavior:
   - this is the path that persists restorable workspace content

### C) Open project path

1. Trigger in UI:
   - `Open Project` button in `HistoryProjectPanel`
2. Frontend handler:
   - `handleOpenWorkspaceProject()`
3. Request branching:
   - if snapshot id exists (explicit or project-scoped fallback), call `POST /api/projects/:id/open` with `{ sessionId, snapshotId }`
   - if no snapshot id exists, call `POST /api/projects/:id/sessions/:sessionId` (bind-only, no restore)

## Smallest Evidence Set

- `CREATE_PROJECT_RESPONSE_FIELDS=userId,name,slug,visibility,id,createdAt,updatedAt`
- `PROJECT_SCOPED_SNAPSHOTS_BEFORE_SAVE=0`
- `OPEN_FLOW_NO_SNAPSHOT_USED=POST /api/projects/f113ee4a-2c2d-49d1-b48c-91f60d65c11f/sessions/b256e70b-f868-4bfb-a2d3-9042efd0dc4b`
- `SESSION_B_PROJECT_ID_AFTER_ASSOC=f113ee4a-2c2d-49d1-b48c-91f60d65c11f`
- `SESSION_B_ROOT_FILE_COUNT=0`
- `PROJECT_SCOPED_SNAPSHOTS_AFTER_SAVE=1`
- `OPEN_FLOW_WITH_SNAPSHOT_USED=POST /api/projects/f113ee4a-2c2d-49d1-b48c-91f60d65c11f/open payload{sessionId:816d77a2-004c-4d69-ad4a-b97932e6a1f6,snapshotId:8a92e225-8c26-4311-922a-5c6c013915e5}`
- `OPEN_RESPONSE_RESTORED=8a92e225-8c26-4311-922a-5c6c013915e5`
- `SESSION_C_INDEX_CONTENT=REAL_USER_CONTENT`

UI copy evidence:
- `Create Project` exists
- `Save Snapshot` exists
- `Save Project` does not exist

## Exact Failing Stage Identified

The remaining real-user failure is in the **workflow semantics stage (save-vs-snapshot path), not restore execution**:

1. Real user flow `create/edit files -> Create Project -> Open Project in another session` does not create a project-scoped snapshot.
2. At open time, the selected project has no restorable project-scoped snapshot (`PROJECT_SCOPED_SNAPSHOTS_BEFORE_SAVE=0`).
3. Frontend correctly takes the no-snapshot branch and sends bind-only association (`POST /projects/:id/sessions/:sessionId`), which updates `session.projectId` but does not restore files.
4. Result: target session remains empty (`SESSION_B_ROOT_FILE_COUNT=0`), which matches the user-reported symptom.
5. When a snapshot is explicitly saved first, open+restore works and content appears (`SESSION_C_INDEX_CONTENT=REAL_USER_CONTENT`).

## Clear Separation of Concerns

- Project metadata save:
  - `Create Project` (`POST /api/projects`)
  - persists project record only
- Snapshot/content save:
  - `Save Snapshot` (`POST /api/sessions/:id/snapshot`)
  - persists restorable workspace content
- Project open/restore:
  - with snapshot -> restore path (`POST /api/projects/:id/open`)
  - without snapshot -> bind-only path (`POST /api/projects/:id/sessions/:sessionId`)

## Conclusion

Diagnosis is complete and narrow. The real empty-open symptom occurs when users run metadata-only project creation and then open without first creating a project-scoped snapshot. The issue is now narrowed enough for one bounded follow-up fix task focused on aligning real UI save/open user flow semantics with user expectations.
