# PROJ-01-10 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-10
- Title: Diagnose Project Open UI Still Requires Browser Reload
- Nature: BUG INVESTIGATION (PROJECT OPEN FLOW, FRONTEND STATE RACE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-10-CHECKPOINT.md`

## Objective

Determine why the real UI still requires a browser reload for restored project files to appear after Open Project, despite the earlier post-open refresh fix.

## Investigation Result

The remaining failure is a frontend state/timing race in the post-open flow, not a backend restore failure.

### Exact remaining failing stage

1. `handleOpenWorkspaceProject()` sets `selectedSessionId(openSessionId)` and also directly calls `loadWorkspaceFilesForSession(token, openSessionId)`.
2. Separately, `useEffect([selectedSessionId])` always calls `loadWorkspaceFilesForSession(token, selectedSessionId)` whenever selected session changes.
3. `loadWorkspaceFilesForSession(...)` clears file tree/editor state at start (`setWorkspaceFileTree([])`, `setSelectedFilePath(null)`, `setSelectedFileContent('')`) before fetch completes.
4. Because both reload paths can run for the same open action, a later call can overwrite a previously successful non-empty load with an empty/early result and leave the UI blank until a full browser reload triggers a fresh load cycle.

This is the remaining frontend race/order issue identified for follow-up fix.

## Evidence

### A) API-equivalent open path confirms backend restore works

Action:

- Reproduced create/edit content -> create project -> snapshot -> open in another session via API.

Observed output:

- `OPEN_RESTORED=7120b94c-d527-4778-b4f7-2f0ac9fd8c7d`
- `LIST_COUNT=1`
- `LIST_FIRST=index.txt`
- `READ_CONTENT=PROJ0110_CONTENT`

Interpretation:

- Restore succeeds and files are present immediately at API level.
- Remaining symptom is therefore in frontend state/timing after open.

### B) Frontend chain confirms duplicate post-open reload triggers

Observed in `frontend/app/[locale]/app/page.tsx`:

- Open handler path:
  - `setSelectedSessionId(openSessionId);`
  - `await loadWorkspaceFilesForSession(token, openSessionId);`
- Session-change effect path:
  - `useEffect(... [selectedSessionId])` -> `void loadWorkspaceFilesForSession(token, selectedSessionId);`
- Loader reset-at-start behavior:
  - `setWorkspaceFileTree([]);`
  - `setSelectedFilePath(null);`
  - `setSelectedFileContent('');`

This establishes a concrete race/overwrite mechanism in the real UI path.

## Scope and Invariants

- Investigation only; no fix applied in this task.
- No project-system redesign.
- No snapshot redesign.
- No workspace redesign.
- No scope expansion.

## Narrow Follow-up

One bounded fix task can now target the post-open file reload race by enforcing a single authoritative reload path (or by gating session-effect reload during open flow) so later empty refreshes cannot overwrite a successful restored tree/editor state.
