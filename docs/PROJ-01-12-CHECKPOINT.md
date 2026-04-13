# PROJ-01-12 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-12
- Title: Diagnose Real UI File Tree Still Empty After Project Open
- Nature: BUG INVESTIGATION (PROJECT OPEN FLOW, RENDERED UI STATE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-12-CHECKPOINT.md`

## Objective

Determine why the real UI still renders an empty file tree after successful project open, even after the duplicate reload race fix, while a full browser refresh makes the files appear.

## Investigation Result

The remaining failure is NOT a file-loading bug in the direct project-open path. The direct `loadWorkspaceFilesForSession` call chain is structurally correct. The file tree rendering gate (`fileSurfaceState === 'ready'`) and all state setters work as expected.

### Exact remaining failing stage

`loadSessions(token)` at L1111 inside `handleOpenWorkspaceProject` has destructive error semantics that can silently clear the just-loaded file state:

1. `handleOpenWorkspaceProject` succeeds: backend restores snapshot, `loadWorkspaceFilesForSession` loads files, `fileSurfaceState` = 'ready', file tree is populated.
2. Then `await loadSessions(token)` is called (L1111).
3. If `loadSessions` encounters ANY error (fetch failure, non-200 non-401 HTTP response, JSON parse error, unexpected error), it calls `setSelectedSessionId(null)` (L708, L722, L735, L750).
4. `setSelectedSessionId(null)` triggers all `[selectedSessionId]` effects, including the file-loading effect at L670.
5. The file-loading effect sees `!selectedSessionId` → calls `resetWorkspaceFileSurface()`.
6. `resetWorkspaceFileSurface()` clears: `fileSurfaceState` → 'empty', `workspaceFileTree` → `[]`, `selectedFilePath` → null, `selectedFileContent` → ''.
7. ALL successfully loaded file state is destroyed.
8. The handler then proceeds to `setProjectActionState('success')` and `setProjectActionMessage('Project opened in selected session.')` — showing a misleading success.

The user sees "Project opened in selected session" with an empty file tree.

After a browser refresh, `loadSessions` succeeds, auto-selects a usable session, and the file-loading effect fires normally — files appear.

### Secondary vulnerability: snapshot-state race

The big `selectedSessionId` effect (L462-522) resets `workspaceSnapshots` to `[]` and `selectedSnapshotId` to `null` whenever `selectedSessionId` changes. If the user triggers project open before the snapshot reload (from `void loadWorkspaceSnapshotsForUser(token)`) completes, `resolveProjectScopedLatestSnapshotId` returns null, causing the bind-only path (no restore). This is a timing-dependent secondary issue, not the primary structural vulnerability.

## Evidence

### A) Backend restore confirmed immediately at API level

Action:

- Created session, wrote file (`index.txt` with `PROJ0112_TEST`), saved project-scoped snapshot, created project.
- Called `POST /api/projects/:projectId/open` with `sessionId` and `snapshotId`.

Observed output:

- `OPEN_SESSION=d974f6bf-83ab-40d1-8da3-2c3395a84a39`
- `OPEN_RESTORED=6e19ddb2-8572-4477-8650-9dbc6121dd06`
- `SAME_SESSION=True`
- `POST_OPEN_FILE_COUNT=1`
- `FIRST_FILE=index.txt`
- `FILE_CONTENT=PROJ0112_TEST`

Interpretation:

- Backend restore works. Files are immediately available. Backend always returns the same `sessionId` that was sent.

### B) Frontend same-session flow is structurally correct

Observed in `frontend/app/[locale]/app/page.tsx`:

- Backend always returns `sessionId === selectedSessionId` (same session).
- `skipNextSessionEffectFileReloadRef.current = false` (same session).
- `setSelectedSessionId(openSessionId)` is a no-op (same value, React bails out).
- No `[selectedSessionId]` effects fire.
- Direct `loadWorkspaceFilesForSession(token, openSessionId)` is the only file-loading path.
- `loadWorkspaceFileTree` fetches files (confirmed available at API level).
- `findFirstFilePath` finds first file.
- `loadWorkspaceFileContent` loads content.
- `fileSurfaceState` = 'ready'. File tree renders via `WorkspaceEditorPanel` (rendering gate: `props.state === 'ready'`).

This chain is correct. The file state IS successfully loaded.

### C) `loadSessions(token)` has destructive error handling

Observed at L689-777:

- Four distinct error paths (L708, L722, L735, L750) all call `setSelectedSessionId(null)`.
- The 401 path (L714) calls `handleWorkspaceUnauthorizedAccess()` which also clears `selectedSessionId`.
- `loadSessions` catches all errors internally and returns normally — it does NOT throw.
- `handleOpenWorkspaceProject` calls `await loadSessions(token)` at L1111 and then unconditionally shows the success message.

If `loadSessions` fails for any reason:

- `setSelectedSessionId(null)` triggers the file-loading effect at L670.
- The effect sees `!selectedSessionId` → calls `resetWorkspaceFileSurface()` → destroys file state.
- Handler continues to show "Project opened in selected session." (success).

### D) All other code paths confirmed non-interfering

Verified:

- `fileNavigationRequestIdRef` is only incremented by `resetWorkspaceFileSurface` and `loadWorkspaceFilesForSession`. No other code increments it during the project-open flow.
- `fileSurfaceState` is only set by `resetWorkspaceFileSurface`, `loadWorkspaceFilesForSession`, `loadWorkspaceFileContent`, and `handleSelectWorkspaceFile`. None fire unexpectedly.
- The PROJ-01-11 skip guard correctly prevents the file-loading effect in the different-session case. But in the same-session case (which is always the case), the guard is not needed and not set.
- The big effect at L462-522 does NOT touch file state (`workspaceFileTree`, `fileSurfaceState`, `selectedFilePath`, `selectedFileContent`).
- AI coherence effect at L3201 returns early when `chatExecutionFileActionStates` is empty.
- No `useEffect` depends on `workspaceFileTree` or `fileSurfaceState`.

## Scope and Invariants

- Investigation only; no fix applied in this task.
- No project-system redesign.
- No snapshot redesign.
- No workspace redesign.
- No scope expansion.

## Narrow Follow-up

One bounded fix task can now target the `loadSessions` call inside `handleOpenWorkspaceProject` to prevent its error paths from destroying file state. The smallest safe fix is to either:

1. Remove the `loadSessions(token)` call from the project-open success path (it's not essential to the open flow), or
2. Replace it with a resilient variant that does not call `setSelectedSessionId(null)` on error, or
3. Capture and restore the `selectedSessionId` around the `loadSessions` call so that errors cannot clear it.
