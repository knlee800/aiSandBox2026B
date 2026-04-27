# PROJ-03-D1b CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-D1b
- **Title:** Add Source-Tagged Automatic Version Labels Behind Feature Flag
- **Nature:** FRONTEND / UX LABEL IMPROVEMENT
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-D1b-CHECKPOINT.md`
- **Source:** Post-D1a gap: all automatic saves (AI, file-save, preview, expiry, initial) produced the identical label `[project-id:<id>]`, which rendered as the generic fallback `'Saved version'` in the history list. Users could not distinguish AI saves, file saves, preview builds, or session-expiry saves from each other by label alone.
- **Depends on:** PROJ-03-D1a (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, make automatic project-history entries easier to distinguish by encoding a stable source tag into automatic snapshot labels and rendering source-specific fallback names in the history list, while leaving manual named saves unchanged.

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Added `ProjectScopedSnapshotSource` type, optional source-tag encoding in `buildProjectScopedSnapshotLabel`, parser extension in `parseProjectScopedSnapshotLabelParts`, and new `parseProjectScopedSnapshotSource` export. |
| `frontend/lib/project-autosave.ts` | Added optional `source` parameter, threaded to `buildProjectScopedSnapshotLabel`. |
| `frontend/app/[locale]/app/page.tsx` | Passed correct source tags at all four `attemptProjectAutosave` call sites and one direct `saveWorkspaceSnapshot` call site for initial project creation. |
| `frontend/components/workspace/workspace-shell.tsx` | Added `parseProjectScopedSnapshotSource` import, `PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR` and `PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR` locals, `formatProjectHistoryFallbackLabel` helper, and wired it into `computeProjectHistoryRows` fallback. Fixed `parseProjectIdFromProjectScopedSnapshotLabel` to tolerate `:source:` segments. |
| `frontend/lib/recovery-copy.ts` | Added `automaticVersionLabels` constant under `workspace`. |
| `frontend/components/workspace/workspace-snapshots.logic.test.ts` | Added three focused tests: source-tagged label builder, `parseProjectScopedSnapshotSource`, and `resolveProjectScopedLatestSnapshotId` with source-tagged labels. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added `projectHistorySnapshotsWithSources` fixture and one focused display test for source-based fallback labels. |
| `frontend/lib/project-autosave.test.ts` | Updated existing test to pass `source: 'preview'` and assert the `[project-id:project-1:source:preview]` label in the request body. |

**No task files (`TASKS.md`, `TASKS_BACKLOG_FULL.md`) were edited during the implementation step.**

## Locked Scope Actually Implemented

This is a label-generation and label-display-only change. All handler semantics, session flows, restore paths, backend calls, autosave trigger logic, save/restore semantics, and legacy code paths are untouched.

### `frontend/components/workspace/workspace-snapshots.logic.ts`

#### 1. Added type and source-tag normalizer

```ts
export type ProjectScopedSnapshotSource =
  | 'ai'
  | 'file-save'
  | 'preview'
  | 'expiry'
  | 'initial';
```

A private `normalizeProjectScopedSnapshotSource` switch returns the exact literal or `null` for any unrecognized value.

#### 2. Extended `buildProjectScopedSnapshotLabel` to accept optional source

```ts
export function buildProjectScopedSnapshotLabel(
  projectId: string,
  source?: ProjectScopedSnapshotSource,
): string
```

Without `source`: produces `[project-id:<id>]` — byte-identical to the prior output.  
With `source`: produces `[project-id:<id>:source:<tag>]`.

#### 3. Extended `parseProjectScopedSnapshotLabelParts` to return `source`

The return shape now includes `source: ProjectScopedSnapshotSource | null`. Parser detects `:source:` in the body only when `:name:` is absent. Backward-compatible: old labels without either separator still parse correctly and return `name: null, source: null`.

#### 4. Added `parseProjectScopedSnapshotSource`

```ts
export function parseProjectScopedSnapshotSource(
  label: string | null,
): ProjectScopedSnapshotSource | null
```

Returns the stable source tag or `null`.

### `frontend/lib/project-autosave.ts`

`attemptProjectAutosave` now accepts an optional `source?: ProjectScopedSnapshotSource` and threads it to `buildProjectScopedSnapshotLabel`.

### `frontend/app/[locale]/app/page.tsx`

Five call sites updated with the correct source tag (no handler logic changed):

| Call site | Source tag |
|---|---|
| Expiry-warning autosave (`useEffect` at ~L554) | `'expiry'` |
| AI-action autosave (`maybeRunExecutionCoherence` at ~L3574) | `'ai'` |
| File-save autosave (`handleSaveWorkspaceFile` at ~L3906) | `'file-save'` |
| Preview-start autosave (`handleStartPreview` at ~L4048) | `'preview'` |
| Initial project-create snapshot (`handleCreateWorkspaceProject` at ~L1250) | `'initial'` |

The legacy direct manual snapshot-save path (`handleSaveWorkspaceSnapshot`, `saveWorkspaceSnapshot` at ~L1845) was **not** redesigned in this slice; it continues to produce an unnamed label.

### `frontend/components/workspace/workspace-shell.tsx`

- Added `parseProjectScopedSnapshotSource` to the import from `./workspace-snapshots.logic`.
- Added `PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR` and `PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR` local constants alongside the existing `PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX` / `SUFFIX`.
- Fixed `parseProjectIdFromProjectScopedSnapshotLabel` to strip `:source:` or `:name:` segments before extracting the project id (needed for the source-tagged filter path in `computeProjectHistoryRows`).
- Added `formatProjectHistoryFallbackLabel(label: string | null): string` — returns `recoveryCopy.workspace.automaticVersionLabels[source]` when a source tag is present, or `'Saved version'` otherwise.
- In `computeProjectHistoryRows` `.map(...)`, replaced `?? 'Saved version'` with `?? formatProjectHistoryFallbackLabel(snapshot.label)`.

Named saves continue to return the user-supplied text from `parseProjectScopedSnapshotName`; the fallback path is not reached for named labels.

### `frontend/lib/recovery-copy.ts`

One new nested constant added under `recoveryCopy.workspace`:

```ts
automaticVersionLabels: {
  ai: 'AI changes saved',
  'file-save': 'File saved',
  preview: 'Preview built',
  expiry: 'Session ending',
  initial: 'Project created',
},
```

No existing strings removed or renamed.

### Tests

`workspace-snapshots.logic.test.ts` — 3 new tests:
1. `'buildProjectScopedSnapshotLabel optionally encodes a stable source tag'`
2. `'parseProjectScopedSnapshotSource returns the source tag only for source-tagged labels'`
3. `'resolveProjectScopedLatestSnapshotId matches source-tagged project labels'`

`workspace-shell.test.tsx` — 1 new fixture (`projectHistorySnapshotsWithSources`) and 1 new test:
- `'renders source-based fallback labels for automatic project history rows'`

`project-autosave.test.ts` — 1 test updated (source tag passed and asserted in request body):
- `'returns saved and calls save once with the source-tagged project-scoped snapshot label'`

## Explicit Statements

- **No new props were added.**
- **No new routes were added.**
- **No backend/API/schema changes were made.**
- **No new UI structures were added.**
- **No save/restore semantic changes were made.**
- **The old direct unnamed manual snapshot-save path (`handleSaveWorkspaceSnapshot`) was not redesigned in this slice.**
- **No task files were edited during the implementation step.**

## Validation

### 1. TypeScript typecheck

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

Note: initial run produced `TS2322: Type 'string' is not assignable to type 'ProjectScopedSnapshotSource | null'` in the source-normalizer switch. Fixed by making each case return the exact literal instead of `source.trim()`. Typecheck then passed clean.

### 2. Focused regression suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx components/workspace/workspace-snapshots.logic.test.ts lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts
```

Result: **PASS** — 157/157 tests passing, 0 failures (4 new tests, 153 prior tests). No regressions.

### 3. Targeted lint attempt

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npm run lint -- --file "components/workspace/workspace-shell.tsx" ...
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. Same issue documented in all prior PROJ-03 checkpoints from A0 onward.

Fallback: `ReadLints` on all eight changed files — **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run. Restored via `git restore -- "frontend/tsconfig.tsbuildinfo"` so the working-tree diff is limited to the eight changed production/test files.

## Honest Note

Automatic version labels are now source-tagged and clearer in project history, while manual named saves still render the user-supplied name unchanged. Older unlabeled snapshots (and the direct legacy manual snapshot-save path) still render safely as `'Saved version'`.

The extended label format `[project-id:<id>:source:<tag>]` is stored in the opaque backend `label` field — no backend migration is needed because the backend stores and returns whatever string the frontend provides. Existing stored labels are fully backward-compatible.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Label generation + display only | ✅ |
| No backend/history semantic changes | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: byte-identical to pre-D1b |
| No new props added | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No broader D1 redesign | ✅ Not implemented |
| No C3 work | ✅ Not implemented |
| No C2d-unload work | ✅ Not implemented |
| No true editor autosave-to-disk | ✅ Not implemented |
| No unload handling | ✅ Not implemented |
| No later-phase work | ✅ Label generation + display only |
