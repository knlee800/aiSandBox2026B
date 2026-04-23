# PROJ-03-C1a CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C1a
- Title: Add Read-Only Project History Panel Behind Feature Flag
- Nature: FRONTEND / PHASE C READ-ONLY HISTORY PANEL
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C1a-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C1 Workspace History tab (split: C1a read-only panel, C1b Restore wiring)
- Depends on: PROJ-03-B4b (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, add a read-only History panel inside the workspace that lists the current project's existing project-scoped snapshots newest-first, with a human label and timestamp. No Restore action, no writes, no new endpoints, no git-checkpoint union.

## Scope Statement

This is a **read-only, display-only slice**. C1a adds exactly one panel — the `ProjectHistoryPanel` — behind `PROJECT_FIRST_UX`, mounted inside the existing `history-control-slice` slot. It introduces no Restore action, no writes, no new fetcher, and no git-checkpoint union. `page.tsx` remained unchanged: both `workspaceSnapshots` and `selectedProjectId` were already supplied as props from an earlier slice. No Phase C1b/C1c/C2/C3/C4 or later-phase work was performed.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/recovery-copy.ts` | One new additive entry: `workspace.noProjectHistoryYet`. |
| `frontend/components/workspace/workspace-shell.tsx` | Added `computeProjectHistoryRows` helper, `ProjectHistoryPanel` sub-component, and mount site inside history area. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added `WorkspaceSnapshotSummary` import, `projectHistorySnapshots` fixture, and four focused C1a tests. |

No other source files were modified. `frontend/app/[locale]/app/page.tsx` unchanged.

## Implementation Details

### `recovery-copy.ts`

One new additive entry under `workspace`:

```ts
noProjectHistoryYet: 'No history yet for this project.',
```

No existing entries changed.

### `workspace-shell.tsx` — label-parsing constants (local, module-level)

Two local constants that mirror the existing `[project-id:...]` semantics from `workspace-snapshots.logic.ts` — copied locally so that file does not need modification:

```ts
const PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX = '[project-id:';
const PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX = ']';
```

### `workspace-shell.tsx` — `parseProjectIdFromProjectScopedSnapshotLabel` (local helper)

Mirrors the existing `parseProjectIdFromSnapshotLabel` from `workspace-snapshots.logic.ts`. Returns the project id encoded in a snapshot label, or `null` if not a project-scoped label.

### `workspace-shell.tsx` — `formatProjectHistoryTimestamp` (local helper)

Converts an ISO `createdAt` string to a human-readable locale string using `new Date(value).toLocaleString()`. Falls back to the raw string if parsing fails.

### `workspace-shell.tsx` — `computeProjectHistoryRows` (local helper)

```ts
function computeProjectHistoryRows(
  snapshots: WorkspaceSnapshotSummary[],
  projectId: string,
): ProjectHistoryRow[]
```

- Normalizes `projectId` and returns `[]` if empty.
- Filters `snapshots` to those whose `label` matches `[project-id:<projectId>]`.
- Sorts by `createdAt` descending; tie-breaks by `id` ascending (deterministic).
- Maps to `{ id, label: 'Saved version', createdAt }` view-model.

Source: existing `props.workspaceSnapshots` only. No new fetcher, no new API call.

### `workspace-shell.tsx` — derivation inside `WorkspaceShell`

```ts
const projectHistoryRows =
  projectFirstUxEnabled && props.selectedProjectId
    ? computeProjectHistoryRows(props.workspaceSnapshots ?? [], props.selectedProjectId)
    : [];
```

Only called when the flag is on and a project is selected.

### `workspace-shell.tsx` — `ProjectHistoryPanel` sub-component

New local function component. Props: `projectFirstUxEnabled`, `selectedProjectId`, `rows: ProjectHistoryRow[]`.

- Returns `null` when `!projectFirstUxEnabled || !selectedProjectId`.
- When `rows.length === 0`: renders `data-testid="history-project-history-empty"` with `recoveryCopy.workspace.noProjectHistoryYet`.
- When rows present: renders a `<ul>` with one `<li>` per row, each at `data-testid="history-project-history-row-{id}"`.
  - Label at `data-testid="history-project-history-label-{id}"`.
  - Timestamp at `data-testid="history-project-history-timestamp-{id}"` using `<time dateTime={row.createdAt}>`.
- No buttons, no click handlers, no interactive elements.

### `workspace-shell.tsx` — mount site

`<ProjectHistoryPanel>` is mounted inside the existing `history-control-slice` section, immediately after `<HistorySnapshotPanel>`. No new layout section, no new `<section>` wrapper.

## What Was Explicitly Not Added

| Missing from C1a (by design) | Notes |
|---|---|
| Restore action | No button, no handler; belongs to C1b |
| Row click handler | Rows are display-only |
| Any write path | No snapshot create, no state mutation |
| New fetcher or new API call | Reuses existing `workspaceSnapshots` prop |
| Git-checkpoint union | Snapshots only; belongs to C1c |
| Change to existing `HistorySnapshotPanel` actions | Existing panel unchanged |
| Vocabulary purge across rest of UI | Only the new panel uses `noProjectHistoryYet` |

## Tests Added

Four focused render tests in `workspace-shell.test.tsx`:

| Test | What it proves |
|---|---|
| `does not render project history panel when feature flag is off` | Flag off: `history-project-history-surface` absent even with `workspaceSnapshots` and `selectedProjectId` present |
| `renders project history rows in deterministic newest-first order behind feature flag` | Flag on + `selectedProjectId: 'project-1'` + `projectHistorySnapshots`: panel renders; rows for `project-1` appear newest-first; `snapshot-a` before `snapshot-b` (same `createdAt`, id tie-break ascending); `snapshot-other` (different project) absent |
| `renders project history empty state when selected project has no matching snapshots` | Flag on + `selectedProjectId: 'project-1'` + only a `project-2` snapshot: empty-state string renders |
| `does not render project history panel without a selected project` | Flag on + `selectedProjectId: null`: panel absent |

Supporting fixture `projectHistorySnapshots` added at module level (three snapshots for `project-1`, one for `project-2`). Same-`createdAt` tie-break is exercised by `snapshot-b` and `snapshot-a`, which resolve in `snapshot-a` < `snapshot-b` order (id ascending tie-break).

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused tests

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts lib/open-project-in-fresh-session.test.ts
```

Result: **PASS** — 108 tests / 5 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 83/83 pass (includes all 4 new C1a tests)
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file components/workspace/workspace-shell.tsx --file components/workspace/workspace-shell.test.tsx --file lib/recovery-copy.ts
```

Result: Known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C1a. Same issue documented in all prior Phase A and B checkpoints.

### 4. File-level lint check

`ReadLints` on all three changed source files: **no linter errors**.

### 5. Coverage note (honest)

C1a verifies the `WorkspaceShell` component seam only:
- flag gating
- selected-project label filtering (only snapshots matching the selected project's id appear)
- deterministic `createdAt` descending + id ascending sort order
- empty-state behavior when no matching snapshots

C1a does **not** add browser/manual E2E verification, a Restore action, git-checkpoint union, autosave, or named-save behavior. `page.tsx` was confirmed as already supplying `workspaceSnapshots` and `selectedProjectId` without modification.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the three changed source files.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Read-only, no Restore, no writes, no new fetcher | ✅ |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ `computeProjectHistoryRows` not called when flag is off |
| Reuses existing in-memory `workspaceSnapshots` prop only | ✅ No new API call |
| No layout regression outside existing history slot | ✅ Mounted after `HistorySnapshotPanel`, no new `<section>` |
| No change to existing `HistorySnapshotPanel` or its test ids | ✅ |
| No change to locked B-phase handlers | ✅ |
| `page.tsx` unchanged | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ |
| No C1b/C1c/C2/C3/C4 or later-phase work | ✅ |
