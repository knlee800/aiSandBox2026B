# PROJ-01-13 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-13
- Title: Preserve Selected Session And File State When Session Reload Fails After Project Open
- Nature: BUG FIX (PROJECT OPEN FLOW, FRONTEND STATE DESTRUCTION)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-13-CHECKPOINT.md`

## Objective

Prevent successful project-open file state from being destroyed when the post-open session reload path encounters an error.

## Root Cause (from PROJ-01-12)

`loadSessions(token)` called at L1111 inside `handleOpenWorkspaceProject` has four error paths (L708, L722, L735, L750) that call `setSelectedSessionId(null)`. This triggers the file-loading `useEffect` (which sees `!selectedSessionId`) → `resetWorkspaceFileSurface()` → destroys `fileSurfaceState`, `workspaceFileTree`, `selectedFilePath`, and `selectedFileContent`. The handler then shows the success message, creating "successful open with empty workspace."

## Fix Applied

Added a single-line session-ID restoration guard after `await loadSessions(token)` in `handleOpenWorkspaceProject`:

```typescript
await loadSessions(token);
setSelectedSessionId((current) => current ?? openSessionId);
```

### How it works

React 18 batches all `setState` calls between two `await` boundaries. The functional updater runs after any earlier `setSelectedSessionId` calls from `loadSessions` are applied in order:

- **Error path:** `loadSessions` queues `setSelectedSessionId(null)`. Our guard queues `setSelectedSessionId((current) => current ?? openSessionId)`. React applies them in order: `null` → `(null ?? openSessionId)` = `openSessionId`. The session is restored. No `[selectedSessionId]` effects fire (value reverts to `openSessionId` which is the same as before).
- **Success path, same session usable:** `loadSessions` queues `setSelectedSessionId((current) => current)` (returns same value). Our guard queues `setSelectedSessionId((current) => current ?? openSessionId)`. React applies: `openSessionId` → `(openSessionId ?? openSessionId)` = `openSessionId`. No change.
- **Success path, fallback session:** `loadSessions` selects a different usable session. Our guard sees a non-null value → keeps it. No interference with legitimate fallback.

## Files Changed

- `frontend/app/[locale]/app/page.tsx` — added L1112: `setSelectedSessionId((current) => current ?? openSessionId);`

## Validation

- TypeScript type-check (`npx tsc --noEmit`): clean, no errors
- Workspace shell tests (`workspace-shell.test.tsx`): 164 tests, 0 failures
- Projects logic tests (`workspace-projects.logic.test.ts`): 164 tests, 0 failures
- Linter: no errors on changed file

## Scope and Invariants

- No project-system redesign.
- No snapshot redesign.
- No workspace redesign.
- No scope expansion.
- Existing `loadSessions` behavior preserved — the guard only restores `selectedSessionId` when it was destructively cleared to `null`.
- Normal session reload behavior (bootstrap, create session, etc.) is unaffected — the guard only exists inside `handleOpenWorkspaceProject`.
