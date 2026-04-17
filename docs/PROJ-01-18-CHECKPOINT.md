# PROJ-01-18 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-18
- Title: Diagnose Editor Panel Not Updating After Project Open
- Nature: BUG INVESTIGATION (PROJECT OPEN FLOW, EDITOR STATE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-18-CHECKPOINT.md`

## Objective

Determine why the editor panel does not update automatically after opening a project, even after project snapshot restore and file reload fixes.

## Investigation Result

The remaining failure is a **coherence-effect race condition** that can stomp on the file content request during project open.

### Confirmed: backend and handler flow are structurally correct

- Backend snapshot restore works (confirmed via API: session B receives 1 file immediately after `POST /api/projects/:id/open` with snapshotId).
- `handleOpenWorkspaceProject` at L1048 correctly fetches fresh snapshots (PROJ-01-17 fix at L1065-1071), opens the project (L1073-1091), and calls `await loadWorkspaceFilesForSession(token, openSessionId)` at L1097.
- `loadWorkspaceFilesForSession` (L3229-3300) correctly loads the file tree (L3245), auto-selects the first file via `findFirstFilePath` (L3254), and calls `loadWorkspaceFileContent` (L3267).
- `loadWorkspaceFileContent` (L3302-3348) sets `setSelectedFilePath(filePath)` (L3313), reads the file (L3318), and sets `setFileSurfaceState('ready')` (L3333).
- `WorkspaceEditorPanel` (L1401-1469 in workspace-shell.tsx) renders the file tree + editor content when `props.state === 'ready'` (L1418), and shows state messages for other states.
- Staleness guards (`fileNavigationRequestIdRef`, `fileContentRequestIdRef`) correctly prevent concurrent `loadWorkspaceFilesForSession` calls from overwriting each other.
- `skipNextSessionEffectFileReloadRef` correctly prevents the `useEffect([selectedSessionId])` at L670 from re-loading files when the handler has already started its own load.
- In the same-session scenario (the typical case: user is already on session B, opens project into B), `setSelectedSessionId(B)` at L1095 is a no-op — effects do NOT re-fire.

### Exact remaining failing stage

In `frontend/app/[locale]/app/page.tsx`, the `useEffect` at **L3203-3213** fires in response to `selectedFilePath` changing:

```
useEffect(() => {
  const executionIds = Object.keys(chatExecutionFileActionStates);
  if (executionIds.length === 0) {
    return;
  }
  void (async () => {
    for (const executionId of executionIds) {
      await maybeRunExecutionCoherence(executionId);
    }
  })();
}, [chatExecutionFileActionStates, selectedFilePath, userId]);
```

When `loadWorkspaceFileContent` sets `setSelectedFilePath(filePath)` at L3313, and then yields at L3318 (`await readWorkspaceFile`), React flushes state and fires the above effect.

If `chatExecutionFileActionStates` has entries with `applyStatus === 'applied'` and successful results that have not been cohered yet, `maybeRunExecutionCoherence` calls `runAiActionCoherence`, which calls:

```
refreshFileTree: async () => {
  await loadWorkspaceFilesForSession(token, executionSessionId);
},
```

This calls `loadWorkspaceFilesForSession` with the **execution session ID** (which may differ from the currently selected session). That call:

1. Increments `fileNavigationRequestIdRef` and `fileContentRequestIdRef` (L3230-3232)
2. Sets `setFileSurfaceState('loading')` and clears file tree/content (L3235-3242)
3. Starts a new `loadWorkspaceFileTree` for the execution session

When the original `readWorkspaceFile` (from the handler's `loadWorkspaceFileContent`) returns, the staleness check at L3324 (`fileContentRequestIdRef.current !== requestId`) **fails**, and the function returns `false` without setting `fileSurfaceState` to `'ready'`.

Result: the editor panel stays in `'loading'` or shows the wrong session's files, depending on which `loadWorkspaceFilesForSession` completes last.

### When this race occurs

1. User uses chat on the current session, producing file actions that reach `applyStatus === 'applied'`.
2. Coherence has not yet run (or `coheredExecutionIdsRef` was recently cleared).
3. User clicks "Open Project" on the same session (no session switch to clear `chatExecutionFileActionStates`).
4. `loadWorkspaceFileContent` sets `selectedFilePath`, triggering the coherence effect.
5. Coherence calls `loadWorkspaceFilesForSession(token, executionSessionId)`, stomping on the in-flight content request.

### When this race does NOT occur

- If the user switches sessions before opening the project: the `useEffect([selectedSessionId])` at L571 clears `chatExecutionFileActionStates` to `{}` (L582). The coherence effect fires but exits immediately at L3204-3206 (empty object).
- If there are no chat execution file actions: the coherence effect exits immediately.
- If all executions have already been cohered: `acquireExecutionCoherenceGuard` returns `false` and `maybeRunExecutionCoherence` returns early (L3044).

### Secondary contributing factor: no forced editor reload after project open

Even without the coherence race, the handler at L1097-1107 relies entirely on `loadWorkspaceFilesForSession` succeeding on the first call or within 6 retries (1.5 seconds total). If the coherence effect keeps stomping on each retry, all retries fail and the editor never reaches `'ready'`.

## Evidence

### A) Backend restore confirmed via API

```
Session B files BEFORE open: 0
Open result: restoredSnapshotId=9531b55f-a517-47bb-a961-da1206806978
Session B files IMMEDIATELY after open: 1
    hello.txt type=file
File content: Hello from proj18 test!
```

Backend works correctly. Files are immediately available.

### B) Code path analysis confirms handler is structurally correct

- `handleOpenWorkspaceProject` (L1048-1127): fetches fresh snapshots (PROJ-01-17), opens project, calls `loadWorkspaceFilesForSession`, retries up to 6 times if needed.
- `loadWorkspaceFilesForSession` (L3229-3300): loads tree, auto-selects first file, loads content.
- `loadWorkspaceFileContent` (L3302-3348): reads file, sets state to `'ready'`.
- Staleness guards prevent concurrent loads from interfering — EXCEPT for the coherence effect.
- Six `useEffect([selectedSessionId])` hooks (L456, L462, L523, L569, L668, L687) do NOT touch file state during same-session project open.

### C) Coherence effect at L3203 can stomp on in-flight content load

- Dependency array: `[chatExecutionFileActionStates, selectedFilePath, userId]`
- `selectedFilePath` changes during `loadWorkspaceFileContent` (L3313)
- Effect fires during the `await readWorkspaceFile(...)` yield (L3318)
- If execution states exist and coherence conditions are met, `loadWorkspaceFilesForSession` is called for the execution session
- This increments `fileContentRequestIdRef`, failing the staleness check at L3324

### D) Prior fixes do not address this stage

- PROJ-01-17: Fixed stale snapshot state race in open handler — does not prevent coherence-effect stomp.
- PROJ-01-13: Preserved session ID after loadSessions error — irrelevant to coherence race.
- PROJ-01-09: Added retry loop for file loading — retries are also stomped by coherence.

## Scope and Invariants

- Investigation only; no fix applied in this task.
- No project-system redesign.
- No snapshot redesign.
- No workspace redesign.
- No editor redesign.
- No scope expansion.

## Narrow Follow-up

One bounded fix task should ensure the coherence effect at L3203 does not stomp on the handler's in-flight file content load. The smallest safe options:

1. **Guard the coherence effect**: skip the effect body when `fileSurfaceState === 'loading'` (file navigation is in progress, coherence should not interfere).
2. **Use a ref-based guard**: set a ref (e.g., `projectOpenInProgressRef`) to `true` at the start of `handleOpenWorkspaceProject` and `false` at the end. The coherence effect checks this ref and skips if true.
3. **Remove `selectedFilePath` from the coherence effect dependency array**: this would prevent the effect from firing in response to file selection changes during the handler's load. Coherence would only fire when `chatExecutionFileActionStates` changes (which is the primary trigger).
