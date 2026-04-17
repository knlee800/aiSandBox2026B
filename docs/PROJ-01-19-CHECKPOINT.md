# PROJ-01-19 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-19
- Title: Prevent AI File Action Coherence From Invalidating Project Open Editor Load
- Nature: BUG FIX (PROJECT OPEN FLOW, EDITOR STATE RACE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-19-CHECKPOINT.md`

## Objective

Fix the project-open editor load race where AI file-action coherence invalidates the in-flight editor content request after project open.

## Root Cause (from PROJ-01-18)

The `useEffect` at L3207 (`[chatExecutionFileActionStates, selectedFilePath, userId]`) fires when `selectedFilePath` changes during `loadWorkspaceFileContent` (called by the project-open handler). If `chatExecutionFileActionStates` has un-cohered entries with `applyStatus === 'applied'`, `maybeRunExecutionCoherence` calls `loadWorkspaceFilesForSession(token, executionSessionId)`, which increments `fileContentRequestIdRef`. The in-flight `loadWorkspaceFileContent` from the project-open handler then fails its staleness check at L3324, returning `false` without setting `fileSurfaceState` to `'ready'`. The editor panel stays in `'loading'` or `'empty'`.

## Fix Applied

Added a `projectOpenInProgressRef` (React ref, `useRef(false)`) that is set to `true` at the start of `handleOpenWorkspaceProject` and `false` at the end (in both success and error paths). The AI file-action coherence `useEffect` checks this ref and returns early when it is `true`.

**Ref declaration (L367):**
```typescript
const projectOpenInProgressRef = useRef(false);
```

**Set before try block (L1065):**
```typescript
projectOpenInProgressRef.current = true;
```

**Cleared on success (L1116):**
```typescript
projectOpenInProgressRef.current = false;
```

**Cleared on error (L1121):**
```typescript
projectOpenInProgressRef.current = false;
```

**Guard in coherence effect (L3208-3210):**
```typescript
useEffect(() => {
  if (projectOpenInProgressRef.current) {
    return;
  }
  // ... existing coherence logic unchanged ...
}, [chatExecutionFileActionStates, selectedFilePath, userId]);
```

### How it works

1. When `handleOpenWorkspaceProject` starts, `projectOpenInProgressRef.current` is set to `true`.
2. The handler calls `loadWorkspaceFilesForSession` → `loadWorkspaceFileContent`, which sets `selectedFilePath` and yields at `await readWorkspaceFile`.
3. React flushes state and fires the coherence `useEffect`. The effect checks `projectOpenInProgressRef.current` — it is `true`, so the effect returns immediately without running coherence.
4. `readWorkspaceFile` returns. The staleness check at L3324 passes because `fileContentRequestIdRef` was not incremented by coherence. `fileSurfaceState` is set to `'ready'`.
5. After the handler completes (success or error), `projectOpenInProgressRef.current` is set to `false`.
6. The coherence effect can run normally on subsequent triggers (e.g., new AI file actions).

### Why a ref instead of state

A React ref is synchronously readable inside effects without needing to be in the dependency array. Using state would require adding it to the dependency array, which would cause unnecessary effect re-fires. The ref approach is zero-overhead and doesn't change the effect's trigger conditions.

## Files Changed

- `frontend/app/[locale]/app/page.tsx` — added `projectOpenInProgressRef`; set/clear in `handleOpenWorkspaceProject`; guard in coherence `useEffect`

## Validation

### 1) TypeScript type-check

Command: `npx tsc --noEmit`
Result: PASS — no errors

### 2) Focused frontend tests

Command: `npm test -- workspace-ai-coherence.logic.test.ts workspace-shell.test.tsx workspace-projects.logic.test.ts workspace-snapshots.logic.test.ts`
Result: PASS — 21 suites, 164 tests, 0 failures

### 3) Lint check

Action: `ReadLints` on `frontend/app/[locale]/app/page.tsx`
Result: no linter errors

## Validation Coverage

- Project open no longer races with AI file-action coherence — the coherence effect is suppressed for the duration of the handler.
- Normal AI file-action coherence is preserved — the guard only blocks during `handleOpenWorkspaceProject` (ref is `false` at all other times).
- Existing project-open restore behavior is preserved — the handler logic is unchanged.
- Existing file tree/editor loading behavior is preserved — `loadWorkspaceFilesForSession` and `loadWorkspaceFileContent` are unchanged.
- The ref is always cleared (both success and error paths) — no stuck state.

## Scope and Invariants Preserved

- No backend changes
- No AI file-action redesign
- No project-system redesign
- No workspace redesign
- No editor redesign
- No scope expansion
- Existing AI-03-02 coherence behavior preserved
- Existing PROJ-01-17 snapshot fetch fix preserved
- Existing PROJ-01-13 session ID guard preserved
