# PROJ-03-C1b-cta CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C1b-cta
- Title: Wire Restore Action On Project History Rows Behind Feature Flag
- Nature: FRONTEND / PHASE C RESTORE BUTTON UI
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C1b-cta-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C1b split: C1b-cta visible Restore-button UI slice
- Depends on: PROJ-03-C1b-pre (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, render one Restore button per row in the locked C1a `ProjectHistoryPanel`, gated by an inline `window.confirm`, that calls the locked C1b-pre `onRestoreWorkspaceProjectFromSnapshotById` prop with `(selectedProjectId, row.id)`. No new handler, no new fetcher, no layout change.

## Scope Statement

This is the **first visible Restore affordance in the new History panel**. C1b-cta adds exactly one interactive element — a Restore button per row inside the locked C1a `ProjectHistoryPanel` — behind `PROJECT_FIRST_UX`. No new handler was introduced; the slice wires the locked C1b-pre handler seam via a locally derived callback in `WorkspaceShell`. C1a row ordering, labels, timestamps, and empty-state behavior are unchanged. `page.tsx` and `frontend/lib/open-project-in-fresh-session.ts` remained unchanged in this slice. No Phase C1c/C2/C3/C4 or later-phase work was performed.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/recovery-copy.ts` | Two new additive entries: `actions.restoreSnapshot` and `workspace.restoreSnapshotConfirm`. |
| `frontend/components/workspace/workspace-shell.tsx` | New `handleRestoreProjectHistoryRow` callback derived in `WorkspaceShell`; `onRestore` optional prop added to `ProjectHistoryPanel`; row-level Restore button rendered when callback present; `onRestore={handleRestoreProjectHistoryRow}` passed to `<ProjectHistoryPanel>` at the existing mount site. |
| `frontend/components/workspace/workspace-shell.test.tsx` | New `withPatchedWindowConfirm` test helper; five focused C1b-cta tests added. |

No other source files were modified. `frontend/app/[locale]/app/page.tsx` unchanged. `frontend/lib/open-project-in-fresh-session.ts` unchanged.

## Implementation Details

### `recovery-copy.ts`

Two new additive entries:

```ts
// under actions:
restoreSnapshot: 'Restore',

// under workspace:
restoreSnapshotConfirm: 'Restore this version? Your current workspace will be replaced.',
```

No existing entries changed.

### `workspace-shell.tsx` — `handleRestoreProjectHistoryRow` (inside `WorkspaceShell`)

New derived callback placed immediately after the `projectHistoryRows` derivation (lines ~368–390):

```ts
const handleRestoreProjectHistoryRow =
  projectFirstUxEnabled &&
  props.selectedProjectId &&
  props.onRestoreWorkspaceProjectFromSnapshotById
    ? (() => {
        const selectedProjectId = props.selectedProjectId;
        const onRestoreWorkspaceProjectFromSnapshotById =
          props.onRestoreWorkspaceProjectFromSnapshotById;
        return (snapshotId: string) => {
          const confirmed =
            typeof window === 'undefined'
              ? true
              : window.confirm(recoveryCopy.workspace.restoreSnapshotConfirm);
          if (!confirmed) {
            return;
          }
          void onRestoreWorkspaceProjectFromSnapshotById(
            selectedProjectId,
            snapshotId,
          );
        };
      })()
    : undefined;
```

- Gated on `projectFirstUxEnabled` + `props.selectedProjectId` + `props.onRestoreWorkspaceProjectFromSnapshotById`.
- Both `selectedProjectId` and `onRestoreWorkspaceProjectFromSnapshotById` are captured locally at derivation time (IIFE), satisfying TypeScript narrowing and the race-free design principle from B4b.
- SSR-safe confirm guard mirrors the A2b pattern exactly: `typeof window === 'undefined' ? true : window.confirm(...)`.
- On decline, returns immediately. On accept, calls the handler with `(selectedProjectId, snapshotId)`.
- `void` prefix on the async call produces a synchronous outer callback — matches B4b precedent.
- No `useCallback` used; consistent with B4b derivation style.

### `workspace-shell.tsx` — `ProjectHistoryPanel` props extension

One new optional prop added to the existing `ProjectHistoryPanel` interface:

```ts
onRestore?: (snapshotId: string) => void;
```

### `workspace-shell.tsx` — Restore button inside `ProjectHistoryPanel`

Inside the `<li>` for each row, immediately after the `<time>` element:

```tsx
{props.onRestore ? (
  <button
    type="button"
    className="mt-2 rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
    onClick={() => props.onRestore?.(row.id)}
    data-testid={`history-project-history-restore-${row.id}`}
  >
    {recoveryCopy.actions.restoreSnapshot}
  </button>
) : null}
```

- Button renders only when `props.onRestore` is defined.
- `onClick` calls `props.onRestore(row.id)` directly; confirm logic lives in the `WorkspaceShell` derived callback, not in the panel.
- Deterministic `data-testid`: `history-project-history-restore-${row.id}`.

### `workspace-shell.tsx` — mount site

`onRestore={handleRestoreProjectHistoryRow}` added to the existing `<ProjectHistoryPanel>` mount at line 752. No structural change to the history area mount site.

### `workspace-shell.test.tsx` — `withPatchedWindowConfirm` helper

New test-file-local helper added immediately after `renderWorkspaceShellElementByTestId`:

```ts
function withPatchedWindowConfirm<T>(
  confirmImpl: (message?: string) => boolean,
  run: () => T,
): T {
  const globalObject = globalThis as typeof globalThis & { window?: unknown };
  const originalWindow = globalObject.window;
  (globalObject as { window?: unknown }).window = { confirm: confirmImpl };

  try {
    return run();
  } finally {
    if (originalWindow === undefined) {
      delete (globalObject as { window?: unknown }).window;
    } else {
      (globalObject as { window?: unknown }).window = originalWindow;
    }
  }
}
```

## Tests Added

Five focused tests added to `workspace-shell.test.tsx`:

| Test | What it proves |
|---|---|
| `does not render project history restore buttons when feature flag is off` | Flag off: no Restore button renders even with `workspaceSnapshots`, `selectedProjectId`, and handler present |
| `renders project history restore buttons per row behind feature flag` | Flag on + `selectedProjectId: 'project-1'` + handler present + rows present: button renders for each matching row (`snapshot-a`, `snapshot-b`, `snapshot-c`); `snapshot-other` (different project) absent |
| `does not render project history restore buttons without restore handler` | Flag on + handler absent: no Restore button |
| `confirms before restoring a project history row and calls handler once on accept` | Click with confirm accepted: `window.confirm` called once with correct message; handler called once with `(selectedProjectId, row.id)` = `('project-1', 'snapshot-a')`; `selectedProjectId` and `snapshotId` verified |
| `does not call restore handler when project history restore confirmation is declined` | Click with confirm declined: `window.confirm` called once; handler not called |

Note: the explicit "flag on + `selectedProjectId` null → no Restore button" case is covered implicitly by the existing C1a test `does not render project history panel without a selected project` (panel returns `null` when `selectedProjectId` is null, so no Restore button can render). An explicit fifth test was not added for this case to avoid duplication.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors. (Note: first typecheck run produced two TS2322/TS2790 errors in the test file's `withPatchedWindowConfirm` helper due to direct `window` assignment on `globalThis`. Resolved by widening the type cast to `{ window?: unknown }` and using explicit casts on the assignment and delete sites. Final typecheck: exit 0.)

### 2. Focused tests

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 113 tests / 5 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 88/88 pass (includes all 5 new C1b-cta tests and all prior 83 tests)
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file components/workspace/workspace-shell.tsx --file components/workspace/workspace-shell.test.tsx --file lib/recovery-copy.ts
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C1b-cta. Same issue documented in all prior Phase A, B, and C checkpoints.

### 4. File-level lint check

`ReadLints` run on all three changed source files: **no linter errors**.

### 5. Coverage note (honest)

C1b-cta verifies the `WorkspaceShell` component seam:
- confirm-gated derivation (callback present vs absent)
- Restore button rendering per row vs absent when gating conditions unmet
- handler called exactly once with correct `(selectedProjectId, snapshotId)` on accept
- handler not called on decline

C1b-cta does **not** add browser/manual E2E restore flow verification. Page-level handler internals (`handleRestoreWorkspaceProjectFromSnapshotById`) are not re-tested here — they were locked in C1b-pre. This limitation is consistent with the B4a/B4b and C1b-pre pattern.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the three changed source files.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `handleRestoreWorkspaceProjectFromSnapshotById` handler (C1b-pre) | Unchanged |
| `onRestoreWorkspaceProjectFromSnapshotById` prop on `WorkspaceShellProps` (C1b-pre) | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| C1a `computeProjectHistoryRows` helper | Unchanged |
| C1a `ProjectHistoryPanel` row ordering, labels, timestamps, empty-state | Unchanged |
| C1a `ProjectHistoryPanel` `data-testid` values for rows, labels, timestamps | Unchanged |
| Existing `HistorySnapshotPanel` actions | Unchanged |
| A3 recovery copy entries | Unchanged (only two new additive entries added) |
| B0/B1/B2a/B2b/B3a/B4a/B4b/C1a/C1b-pre locked paths | Unchanged |

## Preserved Invariants

| Invariant | Status |
|---|---|
| This is the first visible Restore affordance in the new History panel | ✅ One button per row only; narrowly bounded |
| `PROJECT_FIRST_UX` is the kill switch | ✅ Flag off: `handleRestoreProjectHistoryRow` is `undefined`; `onRestore` not passed; no button renders |
| Confirm logic lives in derived callback, not in `ProjectHistoryPanel` | ✅ Panel button calls `props.onRestore(row.id)` directly; confirm is in `WorkspaceShell` |
| SSR-safe confirm guard mirrors A2b pattern exactly | ✅ `typeof window === 'undefined' ? true : window.confirm(...)` |
| `selectedProjectId` captured at click time via IIFE | ✅ Captured in IIFE at derivation time; not read from unrelated state at click time |
| Async handler wrapped in `void`; outer callback is `() => void` | ✅ Matches B4b precedent |
| No change to C1b-pre handler internals | ✅ `handleRestoreWorkspaceProjectFromSnapshotById` not touched |
| No change to B0 helper | ✅ `open-project-in-fresh-session.ts` not touched |
| No change to C1a ordering, labels, timestamps, or empty-state | ✅ Not touched; only additive button inside each `<li>` |
| No new fetcher, endpoint, or backend change | ✅ Frontend only |
| No git-checkpoint union | ✅ Not touched |
| No autosave, named save, retention/compaction, or vocabulary purge | ✅ Not touched |
| No change to existing `HistorySnapshotPanel` actions | ✅ Not touched |
| No new layout primitive | ✅ Button added inside existing `<li>`; no new section or wrapper |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No C1c/C2/C3/C4 or later-phase work | ✅ Visible Restore-button UI slice only |
