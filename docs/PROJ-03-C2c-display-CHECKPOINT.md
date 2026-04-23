# PROJ-03-C2c-display CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2c-display
- Title: Show Parsed Snapshot Name In Project History Rows Behind Feature Flag
- Nature: FRONTEND / PHASE C NAMED SAVE — HISTORY ROW DISPLAY
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2c-display-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c fifth slice: named-save row display
- Depends on: PROJ-03-C2c-cta-button (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, update project history row labeling so named snapshots show the parsed user-supplied name, while unnamed snapshots continue to display the existing default label `Saved version`. **Narrowly bounded to history-row display text only.** No layout change, no new component, no new prop, no handler change.

## Scope Statement

This is a **history-row-display-only slice**. C2c-display modifies `computeProjectHistoryRows` inside `workspace-shell.tsx` and adds tests. No page handler, no named-save helper, and no visible-button logic was changed. The only modified source files were:

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`

`frontend/app/[locale]/app/page.tsx` and `frontend/components/workspace/workspace-snapshots.logic.ts` are confirmed **unchanged** in this slice.

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Additive only. Added runtime import for `parseProjectScopedSnapshotName`; extended filter predicate and updated map callback in `computeProjectHistoryRows`. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Additive only. New mixed named/unnamed snapshot fixture and three focused tests. |

## Implementation Details

### `frontend/components/workspace/workspace-shell.tsx` — additive changes

#### Import change

Upgraded the `workspace-snapshots.logic` import from a type-only import to a value+type import to bring in `parseProjectScopedSnapshotName` at runtime:

```diff
-import type { WorkspaceSnapshotSummary } from './workspace-snapshots.logic';
+import {
+  parseProjectScopedSnapshotName,
+  type WorkspaceSnapshotSummary,
+} from './workspace-snapshots.logic';
```

#### `computeProjectHistoryRows` filter predicate — minimal in-function adjustment

The existing `.filter` only passed snapshots whose label matched the old unnamed format via `parseProjectIdFromProjectScopedSnapshotLabel`. Named snapshot labels (`[project-id:<projectId>:name:<name>]`) were silently excluded because that local helper does not recognise them. The fix adds a second branch to the predicate using `startsWith` / `endsWith` guards without modifying the local helper:

```diff
-.filter(
-  (snapshot) =>
-    parseProjectIdFromProjectScopedSnapshotLabel(snapshot.label) === normalizedProjectId,
-)
+.filter(
+  (snapshot) => {
+    if (
+      parseProjectIdFromProjectScopedSnapshotLabel(snapshot.label) ===
+      normalizedProjectId
+    ) {
+      return true;
+    }
+
+    const trimmedLabel = snapshot.label?.trim();
+    return (
+      typeof trimmedLabel === 'string' &&
+      trimmedLabel.startsWith(
+        `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${normalizedProjectId}:name:`,
+      ) &&
+      trimmedLabel.endsWith(PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX)
+    );
+  },
+)
```

- The local `parseProjectIdFromProjectScopedSnapshotLabel` helper was **not modified**.
- Named snapshots for other projects continue to be excluded by the pattern check.

#### `computeProjectHistoryRows` map callback — label field

```diff
-.map((snapshot) => ({
-  id: snapshot.id,
-  label: 'Saved version',
-  createdAt: snapshot.createdAt,
-}))
+.map((snapshot) => ({
+  id: snapshot.id,
+  label: parseProjectScopedSnapshotName(snapshot.label) ?? 'Saved version',
+  createdAt: snapshot.createdAt,
+}))
```

- `parseProjectScopedSnapshotName` is the locked helper from C2c-label-format.
- Returns `null` for unnamed / pre-C2c labels → fallback `'Saved version'`.
- Returns the trimmed user-supplied name for named labels.

### `frontend/components/workspace/workspace-shell.test.tsx` — additive changes

#### New test fixture `projectHistorySnapshotsWithNames`

Three entries: one named snapshot for `project-1`, one unnamed snapshot for `project-1`, and one named snapshot for a different project `project-2` (to confirm filtering).

```ts
const projectHistorySnapshotsWithNames: WorkspaceSnapshotSummary[] = [
  {
    id: 'snapshot-named',
    userId: 'user-123',
    label: '[project-id:project-1:name:Working draft]',
    createdAt: '2026-04-05T12:00:00.000Z',
    fileCount: 2,
  },
  {
    id: 'snapshot-unnamed',
    userId: 'user-123',
    label: '[project-id:project-1]',
    createdAt: '2026-04-04T12:00:00.000Z',
    fileCount: 3,
  },
  {
    id: 'snapshot-other-named',
    userId: 'user-123',
    label: '[project-id:project-2:name:Other project draft]',
    createdAt: '2026-04-06T12:00:00.000Z',
    fileCount: 1,
  },
];
```

#### Three new focused tests (all pass)

1. `renders parsed snapshot name for named project history rows behind feature flag`
   - Asserts `history-project-history-label-snapshot-named` exists and its `children` equals `'Working draft'`.

2. `keeps the existing default label for unnamed project history rows`
   - Asserts `history-project-history-label-snapshot-unnamed` exists and its `children` equals `'Saved version'`.

3. `renders mixed named and unnamed project history rows without changing project filtering`
   - Asserts HTML contains both label test-ids and their text.
   - Asserts HTML does **not** contain `history-project-history-row-snapshot-other-named` or `'Other project draft'`, confirming cross-project filtering is preserved.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| `frontend/lib/project-named-save.ts` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` | Unchanged |
| `frontend/lib/recovery-copy.ts` | Unchanged |
| Save button, Restore buttons, header, timestamps, empty-state | Unchanged |
| Local `parseProjectIdFromProjectScopedSnapshotLabel` helper | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c-label-format/C2c-handler/C2c-cta-handler-pre/C2c-cta-button paths | Unchanged |

## Fallback Behaviour Note

- Unnamed / pre-C2c snapshot labels (`[project-id:<projectId>]`) continue to display `'Saved version'` — the existing default — because `parseProjectScopedSnapshotName` returns `null` for them and the `??` fallback applies.
- Named snapshot labels (`[project-id:<projectId>:name:<name>]`) display the trimmed user-supplied name extracted by the locked `parseProjectScopedSnapshotName` helper.

## Working Tree Note

Implementation diff is limited to:

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty in the working tree before the implementation step and were not modified during implementation.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused component suite

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 100/100 tests, 0 failures.

### 3. Full focused regression suite

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx lib/project-named-save.test.ts lib/project-autosave.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 146/146 tests, 0 failures. No regressions.

### 4. Lint

Targeted `npm run lint` encountered the known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. `ReadLints` on both changed source files: **no linter errors found**.

### 5. Cleanup

`frontend/tsconfig.tsbuildinfo` regenerated by the typecheck run and restored via `git restore -- frontend/tsconfig.tsbuildinfo`.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Narrowly bounded to history-row display text only; no layout, no new component, no new prop | ✅ |
| Local `parseProjectIdFromProjectScopedSnapshotLabel` helper not modified | ✅ |
| Named labels use locked `parseProjectScopedSnapshotName`; no duplicate parsing logic | ✅ |
| Unnamed / pre-C2c labels fall back to `'Saved version'` via `?? 'Saved version'` | ✅ |
| Cross-project snapshot filtering preserved; other-project named labels excluded | ✅ |
| Sort order, timestamps, Restore buttons, Save button, header, empty-state unchanged | ✅ |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Feature-flag gate on `projectHistoryRows` computation unchanged |
| No `page.tsx` change | ✅ `handleSaveNamedProjectSnapshot` from C2c-cta-handler-pre already present; not modified |
| No `workspace-snapshots.logic.ts` change | ✅ |
| No new effect, ref, or layout restructuring | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No C2d/C2e/C2f, C3, C4, or later-phase work | ✅ |
