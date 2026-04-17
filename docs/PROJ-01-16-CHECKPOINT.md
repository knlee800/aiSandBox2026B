# PROJ-01-16 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-16
- Title: Diagnose Project Open Files Still Not Reloading Automatically
- Nature: BUG INVESTIGATION (PROJECT OPEN FLOW, REAL UI REGRESSION)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-16-CHECKPOINT.md`

## Objective

Determine why project-open still does not automatically reload files into the workspace in real UI usage, despite the earlier project-open refresh and race-condition fixes.

## Investigation Result

The remaining failure is a **stale snapshot state race** in `handleOpenWorkspaceProject`. The handler reads `workspaceSnapshots` from the React closure. After a session switch, this array is cleared to `[]` before the async reload completes. If the handler runs while the snapshot reload is still in-flight, it silently takes an associate-only code path that performs NO snapshot restore, leaving the target session empty.

### Exact remaining failing stage

In `frontend/app/[locale]/app/page.tsx`:

1. User switches to session B. The `useEffect([selectedSessionId])` at L462-523 fires:
   - L497: `setWorkspaceSnapshots([])` — synchronous clear
   - L498: `setSelectedSnapshotId(null)` — synchronous clear
   - L503: `setSelectedProjectId(null)` — synchronous clear
   - L519: `void loadWorkspaceSnapshotsForUser(token)` — fire-and-forget async
   - L520: `void loadWorkspaceProjectsForUser(token)` — fire-and-forget async

2. `loadWorkspaceProjectsForUser` completes and auto-selects a project (`setSelectedProjectId(projects[0].id)`). The UI now shows the project list and the "Open Project" button is enabled.

3. User clicks "Open Project." `handleOpenWorkspaceProject` runs:
   - L1065: `resolveProjectScopedLatestSnapshotId({snapshots: workspaceSnapshots, projectId: selectedProjectId})`
   - If `workspaceSnapshots` is still `[]` (snapshot reload not completed), this returns `null`.
   - L1069-1070: `snapshotIdToOpen = null?.trim() ? ... : null ?? undefined = undefined`

4. Since `snapshotIdToOpen` is `undefined`, code enters `else` branch at L1079:
   - Calls `associateWorkspaceProjectSession()` — associates project with session only.
   - Sets `openResult.restoredSnapshotId = null`.
   - **NO snapshot restore is performed.**

5. `loadWorkspaceFilesForSession(token, B)` loads files for session B — session B is empty → files are empty.

6. The retry loop at L1097-1106 does NOT fire because `openResult.restoredSnapshotId` is `null`.

7. User sees "Project opened in selected session." with an empty editor.

8. After browser refresh: bootstrap loads everything fresh; by the time the user interacts, `workspaceSnapshots` is populated; next open attempt resolves the snapshot correctly; restore happens; files appear.

### Why this is structurally reliable (not just a narrow race)

- The snapshot API (`GET /api/users/me/snapshots`) reads metadata files from disk inside the Docker container. The project API (`GET /api/projects`) reads from PostgreSQL. On Docker-on-Windows, filesystem I/O can be consistently slower than database queries.
- `loadWorkspaceProjectsForUser` auto-selects the first project, making "Open Project" clickable immediately when projects load — without waiting for snapshots.
- There is no guard or await that ensures `workspaceSnapshots` is populated before the open-path decision.

## Evidence

### A) Backend restore confirmed via API

- Created session A, wrote `index.txt`, saved project-scoped snapshot, created project.
- Created session B (empty).
- `POST /api/projects/:id/open` with `snapshotId` → `restoredSnapshotId` returned, session B has 1 file. ✅
- `POST /api/projects/:id/sessions/:sessionId` (associate only, no snapshotId) → session remains at 0 files. ❌

```
CASE_A (snapshots loaded): snapshotIdToOpen=37d8bae7-... -> openWorkspaceProject (WITH restore) -> 1 file
CASE_B (snapshots empty []): snapshotIdToOpen=undefined -> associateWorkspaceProjectSession (NO restore) -> 0 files
```

### B) Code path analysis confirms bifurcation

In `handleOpenWorkspaceProject` (L1048-1126):

- L1072-1078: `if (snapshotIdToOpen)` → calls `openWorkspaceProject()` which calls `POST /api/projects/:id/open` with `snapshotId` → backend restores snapshot
- L1079-1089: `else` → calls `associateWorkspaceProjectSession()` which calls `POST /api/projects/:id/sessions/:sessionId` → no restore

The decision depends entirely on `snapshotIdToOpen`, which depends on `resolveProjectScopedLatestSnapshotId({snapshots: workspaceSnapshots, ...})`, which returns `null` when `workspaceSnapshots` is `[]`.

### C) Prior fixes do not address this stage

- PROJ-01-09: Added retry loop for file loading after restore — irrelevant when no restore occurs.
- PROJ-01-11: Added skip guard for duplicate `useEffect` file reload — irrelevant when `selectedSessionId` doesn't change.
- PROJ-01-13: Added `selectedSessionId` preservation after `loadSessions` error — irrelevant; the issue is snapshot state, not session state.

None of these fixes prevent the stale-snapshot code path from being taken.

## Scope and Invariants

- Investigation only; no fix applied in this task.
- No project-system redesign.
- No snapshot redesign.
- No workspace redesign.
- No scope expansion.

## Narrow Follow-up

One bounded fix task can ensure `handleOpenWorkspaceProject` has access to current snapshot data before the restore-vs-associate decision. The smallest safe options:

1. Await a fresh `loadWorkspaceSnapshotsForUser(token)` inside `handleOpenWorkspaceProject` before calling `resolveProjectScopedLatestSnapshotId`, or
2. Fetch snapshots directly in the handler (bypassing React state) for the resolution, or
3. Disable "Open Project" UI while `snapshotListState !== 'ready'`.
