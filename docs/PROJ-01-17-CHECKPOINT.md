# PROJ-01-17 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-17
- Title: Load Project Snapshot At Open Time To Avoid Snapshot Race
- Nature: BUG FIX (PROJECT OPEN FLOW, SNAPSHOT RACE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-17-CHECKPOINT.md`

## Objective

Fix project open so it does not depend on stale or temporarily empty React snapshot state when deciding whether to restore a project snapshot.

## Root Cause (from PROJ-01-16)

`handleOpenWorkspaceProject` read `workspaceSnapshots` from the React closure. After a session switch, the `useEffect([selectedSessionId])` at L462 clears `workspaceSnapshots` to `[]` and reloads fire-and-forget. If the user clicks "Open Project" before the reload completes, `resolveProjectScopedLatestSnapshotId` sees an empty array, returns `null`, and the code takes the associate-only path (no restore). The session remains empty.

## Fix Applied

Replaced the stale-state snapshot resolution with a fresh API fetch inside `handleOpenWorkspaceProject`:

**Before (L1065-1070):**
```typescript
const fallbackProjectSnapshotId = resolveProjectScopedLatestSnapshotId({
  snapshots: workspaceSnapshots,  // <-- stale closure, may be []
  projectId: selectedProjectId,
});
const snapshotIdToOpen =
  selectedSnapshotId?.trim() ? selectedSnapshotId.trim() : fallbackProjectSnapshotId ?? undefined;
```

**After (L1065-1071):**
```typescript
let snapshotIdToOpen: string | undefined = selectedSnapshotId?.trim() || undefined;
if (!snapshotIdToOpen) {
  const freshSnapshots = await loadWorkspaceSnapshots({ token });
  setWorkspaceSnapshots(freshSnapshots);
  snapshotIdToOpen =
    resolveProjectScopedLatestSnapshotId({ snapshots: freshSnapshots, projectId: selectedProjectId }) ?? undefined;
}
```

### How it works

1. If the user has explicitly selected a snapshot (`selectedSnapshotId`), it is used directly — no API call needed.
2. Otherwise, the handler fetches the current snapshot list from `GET /api/users/me/snapshots` at open time.
3. The fresh list is used for `resolveProjectScopedLatestSnapshotId`, bypassing the potentially stale React state.
4. `setWorkspaceSnapshots(freshSnapshots)` also updates React state to keep the UI in sync.
5. If no project-scoped snapshot exists in the fresh list, `snapshotIdToOpen` remains `undefined` and the safe bind-only fallback is preserved.

## Files Changed

- `frontend/app/[locale]/app/page.tsx` — replaced stale snapshot resolution with fresh API fetch

## Validation

### 1) TypeScript type-check

Command: `npx tsc --noEmit`
Result: PASS — no errors

### 2) Focused frontend tests

Command: `npm test -- components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts components/workspace/workspace-shell.test.tsx`
Result: PASS — 21 suites, 164 tests, 0 failures

### 3) Lint check

Action: `ReadLints` on `frontend/app/[locale]/app/page.tsx`
Result: no linter errors

## Validation Coverage

- Open Project no longer reads from the potentially stale `workspaceSnapshots` closure — it fetches fresh data at open time.
- Explicit snapshot selection (`selectedSnapshotId`) is preserved and takes priority.
- Projects with no snapshots still fall back safely to the bind-only path.
- React snapshot state is kept in sync via `setWorkspaceSnapshots(freshSnapshots)`.
- No new race condition is introduced — the fetch is awaited sequentially in the handler before the restore-vs-associate decision.

## Scope and Invariants Preserved

- No backend changes
- No project-system redesign
- No snapshot-system redesign
- No workspace redesign
- No scope expansion
- Existing project open/restore behavior preserved
- Existing project-scoped snapshot semantics preserved
