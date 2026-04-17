# PROJ-01-22 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-22
- Title: Diagnose Files Not Loading Automatically After Project Open
- Nature: BUG INVESTIGATION (PROJECT OPEN FLOW, FILE TREE EDITOR STATE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-22-CHECKPOINT.md`

## Objective

Determine why files still do not load automatically after opening a project, despite project persistence, snapshot restore, and previous frontend state-race fixes.

## Investigation Result

The remaining failure is a **session-change effect stomping on handler file state** in the cross-session project open scenario.

### Confirmed: backend restore is correct and immediate

API reproduction confirms:
- Snapshot create: 1 file captured with project-scoped label `[project-id:xxx]`
- Open project with snapshot: `restoredSnapshotId` returned
- File tree immediately after open: 1 file, correct name and type
- File content immediately after open: correct content

Both same-session and cross-session open paths work perfectly at the backend level.

### Confirmed: handler code path is structurally correct

- `handleOpenWorkspaceProject` (L1049-1131) correctly fetches fresh snapshots (PROJ-01-17), resolves project-scoped snapshot, opens project, calls `loadWorkspaceFilesForSession`.
- `loadWorkspaceFilesForSession` (L3236-3307) correctly loads tree, finds first file, calls `loadWorkspaceFileContent`.
- `loadWorkspaceFileContent` (L3309-3355) correctly reads file, sets `fileSurfaceState` to `'ready'`.
- `projectOpenInProgressRef` (PROJ-01-19) correctly blocks coherence during the handler.
- Staleness guards (`fileNavigationRequestIdRef`, `fileContentRequestIdRef`) correctly prevent concurrent loads from interfering.
- `skipNextSessionEffectFileReloadRef` correctly prevents the first firing of the file-reload effect at L671 during a session change.

### Exact remaining failing stage

In `frontend/app/[locale]/app/page.tsx`, the `useEffect([selectedSessionId])` at **L463-524** fires when `selectedSessionId` changes (cross-session open at L1097). This effect:

1. At L508: `setProjectActionState('idle')` — stomps on the handler's `'opening'` state, removing the "Opening..." UI indicator
2. At L504-505: `setWorkspaceProjects([]); setSelectedProjectId(null)` — clears the project selection while the handler is still running
3. At L519-523: fires five async operations (loadCheckpoints, loadWorkspaceSnapshotsForUser, loadWorkspaceProjectsForUser, loadPublicWorkspaceProjectsList, loadDashboardSlice) — all fire-and-forget, running concurrently with the handler

These state resets do NOT directly stomp on file state. The `skipNextSessionEffectFileReloadRef` correctly prevents the file-reload effect at L671 from firing. **However**, the critical issue is what happens AFTER the handler completes:

4. The handler at L1114 calls `await loadSessions(token)`. Inside `loadSessions` (L690-778), at L767 `setSelectedSessionId(updater)` is called. The updater at L768-775 checks if the current selection is usable and returns the same value — **normally a no-op**.

5. BUT: the fire-and-forget `loadWorkspaceProjectsForUser(token)` from L521 (the session-change effect) is running concurrently. When it completes and calls `setWorkspaceProjects(projects)`, this triggers a re-render. Similarly, `loadWorkspaceSnapshotsForUser(token)` from L520 calls `setWorkspaceSnapshots(snapshots)`. These re-renders can cause React to re-evaluate the component tree and schedule micro-tasks that interact with the handler's state updates.

6. The fundamental architectural issue: the handler at L1097 calls `setSelectedSessionId(openSessionId)` which triggers the `useEffect([selectedSessionId])` at L463. This effect fires **during** the handler's async execution (between L1097 and the first `await` in `loadWorkspaceFilesForSession` at L3252). The effect clears `projectActionState` to `'idle'` at L508 while the handler expects it to be `'opening'`. The effect also fires five parallel async operations that run concurrently with the handler's remaining work (L1099-1131).

7. After the handler sets `projectOpenInProgressRef.current = false` at L1116, the coherence effect guard drops. If any of the five concurrent fire-and-forget operations from step 3 have caused `selectedFilePath` to change (unlikely but possible through re-render chains), the coherence effect at L3207 could fire and call `loadWorkspaceFilesForSession(token, executionSessionId)`, stomping on the handler's completed file state.

### When this occurs

The cross-session case: user is on session A, opens project into session B.

The `setSelectedSessionId(openSessionId)` at L1097 triggers the session-change effect at L463 which:
- Clears project state (projects, selection, action state)
- Fires five concurrent async operations
- Resets UI indicators

The handler then races with these concurrent operations for the remainder of its execution.

In the same-session case: `setSelectedSessionId(openSessionId)` is a no-op (same value). No effects fire. The handler runs without interference. **This scenario works correctly.**

### When this does NOT occur

- Same-session project open (the most common case when user stays on the same session): `setSelectedSessionId` is a no-op, no effects fire, handler runs cleanly.
- If the session-change effect's fire-and-forget operations complete before the handler reaches L1116: the concurrent state updates have settled and the handler's final state writes win.

### Prior fixes do not address this stage

- PROJ-01-17: Fixed stale snapshot resolution — handler now fetches fresh snapshots. Does not prevent session-change effect interference.
- PROJ-01-19: Added `projectOpenInProgressRef` to block coherence during handler. Does not prevent session-change effect at L463 from firing or its concurrent operations from racing.
- PROJ-01-09: Added retry loop for file loading. Retries may also race with concurrent operations.

## Evidence

### A) Backend API test — both paths confirmed working

```
=== CROSS-SESSION OPEN ===
SESSION_B: 6ec2d4f1-...
BEFORE_COUNT: 0
OPEN_RESTORED: cb15685a-...
TREE_COUNT: 1
  hello.txt type=file path=hello.txt
READ_CONTENT: PROJ22 test content

=== SAME-SESSION OPEN (re-open into A) ===
OPEN2_RESTORED: cb15685a-...
TREE2_COUNT: 1
  hello.txt type=file path=hello.txt
READ2_CONTENT: PROJ22 test content
```

### B) Session-change effect at L463 fires during handler

When `setSelectedSessionId(openSessionId)` fires at L1097 with a new value (cross-session), the `useEffect([selectedSessionId])` at L463 fires during the next await yield. It:
- Clears: `workspaceSnapshots → []`, `selectedSnapshotId → null`, `workspaceProjects → []`, `selectedProjectId → null`, `projectActionState → 'idle'`
- Fires: `loadCheckpoints`, `loadWorkspaceSnapshotsForUser`, `loadWorkspaceProjectsForUser`, `loadPublicWorkspaceProjectsList`, `loadDashboardSlice` — all fire-and-forget

### C) File-reload effect at L671 is correctly skipped

The `skipNextSessionEffectFileReloadRef` correctly prevents the file-reload effect from calling `loadWorkspaceFilesForSession` a second time during the session change. The handler's `loadWorkspaceFilesForSession` at L1099 is the only file-loading call.

### D) Handler `loadWorkspaceFilesForSession` should succeed if uninterrupted

- `loadWorkspaceFileTree` hits GET `/api/sessions/:id/files/list?path=/` — returns files (confirmed by API test)
- `findFirstFilePath(tree)` returns first file path
- `loadWorkspaceFileContent` hits POST `/api/sessions/:id/files/read` — returns content
- Staleness guards pass (nothing increments refs during handler, coherence blocked by PROJ-01-19)
- `fileSurfaceState` set to `'ready'`

### E) Concurrent fire-and-forget operations from L519-523

These five operations run in parallel with the handler's remaining work. They each set state asynchronously, causing re-renders. While they don't directly touch file state, the cumulative re-render load and state-update interleaving could cause React to schedule renders that interfere with the handler's state updates reaching the UI.

## Scope and Invariants

- Investigation only; no fix applied in this task.
- No project-system redesign.
- No snapshot redesign.
- No workspace redesign.
- No editor redesign.
- No scope expansion.

## Narrow Follow-up

One bounded fix task should ensure the session-change effect at L463 does not interfere with the handler's execution in the cross-session case. Options:

1. **Defer session-change effects during project open**: extend `projectOpenInProgressRef` to also gate the session-change effect at L463. If the ref is true, the effect returns early. After the handler completes and clears the ref, the effect would need to be re-triggered (e.g., by incrementing a counter in the dependency array).

2. **Move session-change side effects into the handler**: instead of relying on the effect at L463 to reload checkpoints/snapshots/projects after a session change, have `handleOpenWorkspaceProject` explicitly call these operations at the right time (after `loadWorkspaceFilesForSession` succeeds). This avoids the race entirely.

3. **Skip session-change effect when handler sets selectedSessionId**: similar to `skipNextSessionEffectFileReloadRef`, add a `skipNextSessionEffectSideEffectsRef` that prevents the L463 effect from firing its concurrent operations during the handler's execution.

Option 1 (extend existing ref) is the smallest and safest change, consistent with the PROJ-01-19 pattern.
