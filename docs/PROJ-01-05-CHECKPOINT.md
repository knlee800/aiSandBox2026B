# PROJ-01-05 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-05
- Title: Diagnose Project Open Still Shows Empty Workspace
- Nature: BUG INVESTIGATION (PROJECT OPEN FLOW, REAL UI FAILURE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-05-CHECKPOINT.md`

## Objective

Determine why the real UI can still show an empty workspace after "Project opened in selected session."

## Exact Commands / Actions / Checks Run

1. Read required governance/task/checkpoint context:
   - `CLAUDE.md`
   - `TASKS.md` (PROJ-01 section)
   - `TASKS_BACKLOG_FULL.md` (PROJ-01 section)
   - `docs/PROJ-01-01-CHECKPOINT.md`
   - `docs/PROJ-01-02-CHECKPOINT.md`
   - `docs/PROJ-01-03-CHECKPOINT.md`
   - `docs/PROJ-01-04-CHECKPOINT.md`
2. Verified frontend open-project and snapshot-selection path in:
   - `frontend/app/[locale]/app/page.tsx`
   - `frontend/components/workspace/workspace-snapshots.logic.ts`
3. Reproduced real UI/API behavior via PowerShell against `http://localhost:4000`:
   - register/login
   - create project and project-content snapshot
   - create unrelated empty snapshot later (newest snapshot)
   - fetch `/api/users/me/snapshots` to mirror frontend selected snapshot resolution
   - call `POST /api/projects/:id/open` with payload matching frontend path
   - inspect session file list/content after open
   - control check: open with explicit correct project snapshot

## Exact Evidence Collected

- Frontend snapshot-selection behavior:
  - `loadWorkspaceSnapshotsForUser()` sets `selectedSnapshotId` to `snapshots[0].id` when current selection is missing.
  - `handleOpenWorkspaceProject()` sends `snapshotId: selectedSnapshotId ?? undefined`.
  - This means open-project request often carries the globally latest user snapshot id.

- Reproduction outputs:
  - `SNAP_PROJECT_ID=eb351b9c-073e-48c7-a438-83c75c35e199`
  - `SNAP_EMPTY_LATEST_ID=01f79595-c548-4a1c-880f-7165faffbcf1`
  - `SELECTED_SNAPSHOT_ID_FROM_USERS_ME=01f79595-c548-4a1c-880f-7165faffbcf1`
  - `OPEN_PAYLOAD={"sessionId":"b20d7d66-31aa-4870-9d97-f215ba64e4f6","snapshotId":"01f79595-c548-4a1c-880f-7165faffbcf1"}`
  - `OPEN_RESULT={"projectId":"365b5943-438d-4c76-8f6a-f6edd72dd4c6","sessionId":"b20d7d66-31aa-4870-9d97-f215ba64e4f6","restoredSnapshotId":"01f79595-c548-4a1c-880f-7165faffbcf1"}`
  - `FILE_COUNT_AFTER_OPEN_WITH_SELECTED=0`
  - `SESSION_PROJECT_ID_AFTER_OPEN=365b5943-438d-4c76-8f6a-f6edd72dd4c6`
  - Control:
    - `OPEN_RESULT_EXPLICIT={"projectId":"365b5943-438d-4c76-8f6a-f6edd72dd4c6","sessionId":"b20d7d66-31aa-4870-9d97-f215ba64e4f6","restoredSnapshotId":"eb351b9c-073e-48c7-a438-83c75c35e199"}`
    - `READ_INDEX_AFTER_OPEN_WITH_EXPLICIT=PROJECT_FILE_A`

## Exact Failing Stage Identified

The remaining failure is in **frontend open payload snapshot targeting**, not in the backend open/restore execution path:

1. Frontend often sends an explicit `snapshotId` derived from global user snapshot list default (`snapshots[0]`), not project-scoped snapshot intent.
2. Backend correctly restores the explicit snapshot it receives.
3. When that explicit snapshot is unrelated/empty, open call still succeeds (`projectId` bound, restore completed), but workspace appears empty.

So the effective failing stage is:
- **Request-construction/state-selection stage in frontend project-open flow** (wrong snapshot id chosen/sent for the project open action).

## Conclusion

Diagnosis is complete and narrow. The issue is ready for one bounded follow-up fix task focused on project-open snapshot selection behavior in the frontend open flow.
