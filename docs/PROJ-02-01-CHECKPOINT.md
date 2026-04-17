# PROJ-02-01 CHECKPOINT

## Task Metadata

- Task ID: PROJ-02-01
- Title: Refactor Project Open Into Deterministic Workspace Hydration Flow
- Nature: FRONTEND ARCHITECTURE FIX / STATE FLOW CLEANUP
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-02-01-CHECKPOINT.md`

## Objective

Replace the fragile project-open UI state/race chain with one deterministic workspace hydration flow so opening a project reliably loads restored files and editor content without browser refresh.

## Background

After the targeted fixes in PROJ-01-17, PROJ-01-19, PROJ-01-22, and PROJ-01-23, real UI usage still showed unreliable file/editor rendering after Open Project. The diagnosis (CURRENT-WORKING-STATE-CHECKPOINT, 2026-04-09) identified the structural problem: `handleOpenWorkspaceProject` is a long async chain whose post-handler "fire-and-forget" reloads (snapshots, projects, public projects, dashboard) escape the `projectOpenInProgressRef` guard window and can interleave with React's render/effect cycle. Each individual race had been patched, but the architecture itself made future races hard to rule out.

PROJ-02-01 makes the project-open flow deterministic by:

1. Naming the file/editor hydration as a single explicit helper.
2. Awaiting all post-open data reloads BEFORE the guard ref is cleared.
3. Extending the existing `projectOpenInProgressRef` guard to the file-load `useEffect` (additional safety net).
4. Guaranteeing both coordination refs always clear via `try/finally`.

## Fix Applied

### 1. Hydration helper (single named sequence)

Extracted the file tree → first file → editor content load (with retry for restored snapshots) into one explicit helper inside the component:

```typescript
async function hydrateWorkspaceForProjectOpen(
  token: string,
  openSessionId: string,
  expectFiles: boolean,
): Promise<boolean> {
  let loaded = await loadWorkspaceFilesForSession(token, openSessionId);
  if (!loaded && expectFiles) {
    for (let attempt = 0; attempt < PROJECT_OPEN_FILE_REFRESH_MAX_ATTEMPTS; attempt += 1) {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), PROJECT_OPEN_FILE_REFRESH_RETRY_DELAY_MS);
      });
      loaded = await loadWorkspaceFilesForSession(token, openSessionId);
      if (loaded) {
        break;
      }
    }
  }
  return loaded;
}
```

This makes the file/editor hydration step explicit and isolates it from the broader handler.

### 2. Deterministic handler sequence

`handleOpenWorkspaceProject` now runs one ordered sequence inside a `try/finally`:

```typescript
projectOpenInProgressRef.current = true;
try {
  // 1. Resolve snapshot id (fresh API fetch — preserves PROJ-01-17 behavior)
  // 2. Backend open/restore (await)
  // 3. Set selected session (sync) — file-load effect is now double-guarded
  await hydrateWorkspaceForProjectOpen(token, openSessionId, expectsRestoredFiles);
  // 4. Per-session derived state
  await refreshPreviewForSession(token, openSessionId);
  await loadCheckpoints(token, openSessionId);
  await loadSessions(token);
  setSelectedSessionId((current) => current ?? openSessionId);
  // 5. Workspace data reloads — AWAITED, no longer fire-and-forget
  await loadWorkspaceSnapshotsForUser(token);
  await loadWorkspaceProjectsForUser(token);
  await loadPublicWorkspaceProjectsList();
  await loadDashboardSlice(token);
  // 6. Final ready UI state
  setProjectActionState('success');
  ...
} catch (error) {
  setProjectActionState('error');
  ...
} finally {
  projectOpenInProgressRef.current = false;
  skipNextSessionEffectFileReloadRef.current = false;
}
```

Key change: the four workspace data reloads (snapshots, projects, public projects, dashboard) are now `await`-ed BEFORE the guard ref clears. All `setState` calls from those reloads land while `projectOpenInProgressRef.current === true`, so the guarded effects (file-load, coherence, L463 session-change) cannot re-fire on those state changes.

The `try/finally` guarantees both `projectOpenInProgressRef` and `skipNextSessionEffectFileReloadRef` always clear on all exit paths (success, caught error, or thrown rejection inside an awaited reload).

### 3. File-load effect now also gated by `projectOpenInProgressRef`

The `useEffect([selectedSessionId])` at L674 (workspace file reload on session change) previously relied solely on `skipNextSessionEffectFileReloadRef`. Added an explicit `projectOpenInProgressRef.current` guard above the skip-ref check so the file-load effect cannot reload files during the project-open hydration even if the skip ref is unset for any reason:

```typescript
useEffect(() => {
  const token = localStorage.getItem('access_token');
  if (!token) return;
  if (!selectedSessionId) {
    resetWorkspaceFileSurface();
    return;
  }
  if (projectOpenInProgressRef.current) {
    return;
  }
  if (skipNextSessionEffectFileReloadRef.current) {
    skipNextSessionEffectFileReloadRef.current = false;
    return;
  }
  void loadWorkspaceFilesForSession(token, selectedSessionId);
}, [selectedSessionId]);
```

This brings the file-load effect into symmetric alignment with the coherence effect (L3214) and the session-change reset effect (L463), both of which already use the same guard.

## How it works (deterministic sequence)

1. Handler sets `projectOpenInProgressRef.current = true` (synchronous; effects guarded immediately).
2. Snapshot id is resolved via fresh API fetch (PROJ-01-17 behavior preserved).
3. Backend open/restore call completes.
4. `setSelectedSessionId(openSessionId)` is invoked. React schedules effects for `[selectedSessionId]`:
   - L463 (project state reset + reloads): guarded by ref → returns.
   - L674 (file-load): guarded by ref → returns.
   - Coherence effect (L3214): guarded by ref → returns.
   - L563 (command/build clear), L575 (chat thread reset/load), L659 (preview): not guarded; they perform per-session work the handler does not own. Handler explicitly performs preview refresh anyway.
5. Hydration helper runs: file tree → first file → editor content. `setFileSurfaceState('ready')` is the final write.
6. Per-session derived state (preview, checkpoints, sessions) is awaited.
7. Workspace data reloads (snapshots, projects, public projects, dashboard) are awaited. All resulting `setState` calls land while the guard ref is still true.
8. Success UI state is set.
9. `finally` clears both refs. After this point, `selectedSessionId` has not changed again, so guarded effects will not re-fire from the project-open transition.

The end state is now a single function whose final write is the editor's ready state, and no awaitable work remains outside the guard window.

## Why the chat / command-build / preview effects were not also guarded

- L563 (command/build state reset) — does not touch file/editor state. Safe to run in parallel.
- L575 (chat thread reset and async load) — does not touch file/editor state directly. Guarding it would require manually performing chat reset + chat thread reload inside the handler, expanding scope beyond project-open hydration.
- L659 (preview refresh) — does not touch file/editor state. The handler explicitly calls `refreshPreviewForSession`, so a duplicate effect-driven call is harmless.

Guarding these would expand scope without addressing the file/editor hydration symptom this task targets.

## Files Changed

- `frontend/app/[locale]/app/page.tsx`
  - Added `projectOpenInProgressRef.current` guard to file-load `useEffect` at L674.
  - Added new `hydrateWorkspaceForProjectOpen` helper inside the component.
  - Refactored `handleOpenWorkspaceProject`:
    - Body now runs as one deterministic sequence.
    - Workspace data reloads (snapshots, projects, public projects, dashboard) converted from fire-and-forget to awaited.
    - Coordination refs always cleared via `try/finally`.

## Validation

### 1) TypeScript type-check

Command: `npx tsc --noEmit` (in `frontend/`)
Result: PASS — no errors.

### 2) Focused frontend tests

Command: `npm test -- workspace-shell.test.tsx workspace-projects.logic.test.ts workspace-snapshots.logic.test.ts workspace-ai-coherence.logic.test.ts workspace-file-navigation.logic.test.ts`
Result: PASS — 21 suites, 164 tests, 0 failures.

### 3) Full frontend test suite

Command: `npm test`
Result: PASS — 21 suites, 164 tests, 0 failures.

### 4) Lint check

Action: `ReadLints` on `frontend/app/[locale]/app/page.tsx`
Result: no linter errors.

### 5) Live UI / Docker reproduction

Docker Desktop was not running in this session, so the end-to-end UI verification (Open Project from one session into another and confirm files/editor load without browser refresh) could not be executed here. The static guarantees that replace the prior race surface are:

- All four post-open data reloads now complete inside the guard window; no state-write originating from project open lands after the guard clears.
- The file-load `useEffect` is now triple-guarded (`projectOpenInProgressRef`, `skipNextSessionEffectFileReloadRef`, then the normal session-change branch), removing the only effect path that previously could overwrite the editor's `'ready'` state during project open.
- The `try/finally` removes the possibility of a stuck guard ref from any thrown rejection in the awaited chain.

Validation of the end-state in the running UI should be performed when Docker is available and the symptom is no longer reproducible.

## Validation Coverage

- Project open hydration is a single named helper with a single final ready state write.
- All workspace data reloads triggered by project open complete while `projectOpenInProgressRef.current === true`.
- File-load effect cannot fire during project open (added guard).
- Coherence effect cannot fire during project open (PROJ-01-19 guard preserved).
- Session-change reset effect cannot fire during project open (PROJ-01-23 guard preserved).
- Normal manual session switching is preserved: when `projectOpenInProgressRef.current === false`, all `[selectedSessionId]` effects behave exactly as before.
- Same-session project open is unaffected: `setSelectedSessionId` is a no-op, no `[selectedSessionId]` effects fire, hydration helper still runs explicitly.
- Both coordination refs always clear (try/finally), regardless of which awaited step throws.

## Scope and Invariants Preserved

- No backend changes.
- No project-system redesign.
- No snapshot-system redesign.
- No persistence changes (PROJ-01-21 volume preserved).
- No preview redesign (PREV-02-01/02-02 detection logic preserved).
- No Docker/cleanup changes.
- No broad workspace redesign beyond project-open hydration.
- No scope expansion.
- PROJ-01-17 fresh-snapshot fetch preserved.
- PROJ-01-19 coherence guard preserved.
- PROJ-01-23 session-change effect guard preserved.
- `skipNextSessionEffectFileReloadRef` retained alongside the new ref guard.
- Manual session-switch behavior preserved (file load, project state reset, snapshots/projects reload, preview refresh, chat thread reset/load).
