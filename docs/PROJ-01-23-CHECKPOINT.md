# PROJ-01-23 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-23
- Title: Suppress Project State Reset During Project Open Session Transition
- Nature: BUG FIX (PROJECT OPEN FLOW, SESSION EFFECT RACE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-23-CHECKPOINT.md`

## Objective

Prevent the selected-session change effect from clearing project/open UI state while Open Project is still executing across a session transition.

## Root Cause (from PROJ-01-22)

The `useEffect([selectedSessionId])` at L463 fires when `setSelectedSessionId(openSessionId)` is called at L1097 during a cross-session project open. This effect:
- Clears `projectActionState` to `'idle'` (stomping the handler's `'opening'`)
- Clears `selectedProjectId`, `workspaceProjects`, `workspaceSnapshots`
- Fires five concurrent fire-and-forget async operations that race with the handler

The handler then races with these concurrent operations for the rest of its execution.

## Fix Applied

Extended the existing `projectOpenInProgressRef` (added in PROJ-01-19) to also gate the session-change effect at L463. When the ref is `true`, the effect returns early without clearing state or launching concurrent operations. After the handler completes and clears the ref, the handler explicitly calls the reload operations that the suppressed effect would have fired.

**Guard added to session-change effect (L464-466):**
```typescript
useEffect(() => {
  if (projectOpenInProgressRef.current) {
    return;
  }
  // ... existing reset + reload logic unchanged ...
}, [selectedSessionId]);
```

**Deferred reloads added to handler success path (L1123-1126):**
```typescript
projectOpenInProgressRef.current = false;
setProjectActionState('success');
setProjectActionMessage('Project opened in selected session.');
setProjectActionError(null);
void loadWorkspaceSnapshotsForUser(token);
void loadWorkspaceProjectsForUser(token);
void loadPublicWorkspaceProjectsList();
void loadDashboardSlice(token);
```

### How it works

1. `handleOpenWorkspaceProject` sets `projectOpenInProgressRef.current = true` at start (existing PROJ-01-19 behavior).
2. Handler calls `setSelectedSessionId(openSessionId)` at L1097 for cross-session open.
3. React flushes state and fires the `useEffect([selectedSessionId])` at L463.
4. The effect checks `projectOpenInProgressRef.current` — it is `true`, so it returns immediately.
5. No project state is cleared. No concurrent operations are launched.
6. The handler's `loadWorkspaceFilesForSession` runs without interference.
7. The handler completes its await chain (refreshPreview, loadCheckpoints, loadSessions).
8. `projectOpenInProgressRef.current` is set to `false`.
9. Handler sets success state.
10. Handler fires the deferred reload operations (snapshots, projects, public projects, dashboard) as fire-and-forget — these now run after the handler has finished, not concurrently with it.

### Why a ref guard instead of a skip-ref

The `projectOpenInProgressRef` already exists (from PROJ-01-19) and is synchronously readable inside effects. Reusing it is consistent with the existing pattern, avoids adding a new ref, and clearly communicates that the session-change effect should not interfere during project open.

### Why deferred reloads are needed

The session-change effect normally reloads snapshots, projects, public projects, and dashboard data when the user switches sessions. When this effect is suppressed during project open, the handler must explicitly perform these reloads after its main work completes. The handler already called `loadCheckpoints` and `loadSessions`, so only `loadWorkspaceSnapshotsForUser`, `loadWorkspaceProjectsForUser`, `loadPublicWorkspaceProjectsList`, and `loadDashboardSlice` needed to be added.

## Files Changed

- `frontend/app/[locale]/app/page.tsx` — added `projectOpenInProgressRef` guard to session-change effect at L463; added deferred reload calls to handler success path

## Validation

### 1) TypeScript type-check

Command: `npx tsc --noEmit`
Result: PASS — no errors

### 2) Focused frontend tests

Command: `npm test -- workspace-shell.test.tsx workspace-projects.logic.test.ts workspace-snapshots.logic.test.ts workspace-ai-coherence.logic.test.ts workspace-file-navigation.logic.test.ts`
Result: PASS — 21 suites, 164 tests, 0 failures

### 3) Lint check

Action: `ReadLints` on `frontend/app/[locale]/app/page.tsx`
Result: no linter errors

## Validation Coverage

- Cross-session project open no longer races with session-change effect — the effect is suppressed for the duration of the handler.
- Same-session project open is unaffected — `setSelectedSessionId` is a no-op, effect doesn't fire.
- Normal manual session switching is preserved — `projectOpenInProgressRef.current` is `false` outside the handler.
- Deferred reloads ensure session-switch data (snapshots, projects, dashboard) is loaded after handler completes.
- Coherence guard (PROJ-01-19) is preserved — the ref gates both the coherence effect and the session-change effect.
- File-reload skip (PROJ-01-09/13) is preserved — `skipNextSessionEffectFileReloadRef` still gates the L671 effect independently.
- The ref is always cleared (both success and error paths) — no stuck state.

## Scope and Invariants Preserved

- No backend changes
- No project-system redesign
- No snapshot redesign
- No workspace redesign
- No editor redesign
- No broad state-management rewrite
- No scope expansion
- Existing PROJ-01-17 snapshot fetch fix preserved
- Existing PROJ-01-19 coherence guard preserved
- Existing PROJ-01-13 session ID guard preserved
- Normal session-switch behavior preserved
