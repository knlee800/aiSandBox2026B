# PROJ-03-D1c CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-D1c
- **Title:** Add Heuristic Content-Related Automatic Version Labels Behind Feature Flag
- **Nature:** FRONTEND / UX LABEL IMPROVEMENT
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-D1c-CHECKPOINT.md`
- **Source:** Post-D1b gap: source-only labels like "AI changes saved" are still too generic when multiple nearby automatic versions exist in the history list. Deterministic heuristics derived from already-available saved context (changed file paths, file counts, trigger source) can make these labels more distinguishable without AI-generated labeling and without backend or schema changes.
- **Depends on:** PROJ-03-D1b (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, improve automatic project-history labels using deterministic heuristics derived from existing saved context (changed file paths / file counts / trigger source) so nearby versions are easier to distinguish, without requiring AI-generated labels.

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Added optional `:hint:` encoding in `buildProjectScopedSnapshotLabel`, extended parser to return hint, added `normalizeProjectScopedSnapshotHint`, and added `parseProjectScopedSnapshotHint` export. |
| `frontend/lib/project-autosave.ts` | Added optional `hint?: string` parameter, threaded to `buildProjectScopedSnapshotLabel`. |
| `frontend/app/[locale]/app/page.tsx` | Added `getWorkspacePathBasename` and `buildAutosaveHintFromFileActions` helpers; passed deterministic hints at AI, file-save, and preview autosave call sites. Expiry and initial project-create autosaves left source-only. |
| `frontend/components/workspace/workspace-shell.tsx` | Added `parseProjectScopedSnapshotHint` import and `PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR` local constant; updated `formatProjectHistoryFallbackLabel` to append `· hint` when present; added hint separator to `parseProjectIdFromProjectScopedSnapshotLabel` guard list. |
| `frontend/components/workspace/workspace-snapshots.logic.test.ts` | Added two new focused tests: hint builder with sanitization and `parseProjectScopedSnapshotHint` round-trip. Updated the existing source-tagged `resolveProjectScopedLatestSnapshotId` test to use a hint-bearing label. Extended the existing `parseProjectScopedSnapshotSource` test to assert that parsing source from a source+hint label is correct. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added `projectHistorySnapshotsWithHints` fixture and one focused test for hint-bearing display labels. |
| `frontend/lib/project-autosave.test.ts` | Updated the existing source-tagged autosave test to pass `hint: 'index.html'` and assert `[project-id:project-1:source:preview:hint:index.html]` in the request body. Test name updated from source-tagged to source-plus-hint. |

**No task files (`TASKS.md`, `TASKS_BACKLOG_FULL.md`) were edited during the implementation step.**

## Locked Scope Actually Implemented

This is a label-generation and label-display-only change. All handler semantics, session flows, restore paths, backend calls, autosave trigger logic, save/restore semantics, and legacy code paths are untouched.

### Automatic Label Format Extension

The label format for automatic saves is extended with an optional third segment:

| Label shape | Format | Notes |
|---|---|---|
| Unlabeled (pre-D1b) | `[project-id:<id>]` | Unchanged; fully backward-compatible |
| Source-only (D1b) | `[project-id:<id>:source:<tag>]` | Unchanged; fully backward-compatible |
| Source + hint (D1c new) | `[project-id:<id>:source:<tag>:hint:<text>]` | New; only produced by D1c hint-passing call sites |
| Named save | `[project-id:<id>:name:<text>]` | Unchanged; mutually exclusive from source/hint |

### `frontend/components/workspace/workspace-snapshots.logic.ts`

#### 1. Added hint separator constant, max-length constant, and sanitizer

```ts
const PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR = ':hint:';
const PROJECT_SCOPED_SNAPSHOT_HINT_MAX_LENGTH = 40;
```

Private `normalizeProjectScopedSnapshotHint` sanitizes any raw hint:
- trims
- replaces `]` with space
- strips `:name:`, `:source:`, `:hint:` substrings (replaced with space)
- collapses whitespace
- caps at 40 characters
- returns `null` for empty result

#### 2. Extended `buildProjectScopedSnapshotLabel` to accept optional hint

```ts
export function buildProjectScopedSnapshotLabel(
  projectId: string,
  source?: ProjectScopedSnapshotSource,
  hint?: string,
): string
```

Without `source`: unchanged — produces `[project-id:<id>]`.  
With `source`, no hint: unchanged — produces `[project-id:<id>:source:<tag>]`.  
With `source` + hint: produces `[project-id:<id>:source:<tag>:hint:<sanitized-hint>]`.

#### 3. Extended `parseProjectScopedSnapshotLabelParts` to return hint

The parser extracts `:hint:` only when `:source:` is present and `:name:` is absent. The `source` parse correctly strips the trailing `:hint:<text>` before normalizing. Backward-compatible: old labels without `:hint:` return `hint: null`.

#### 4. Added `parseProjectScopedSnapshotHint`

```ts
export function parseProjectScopedSnapshotHint(
  label: string | null,
): string | null
```

Returns the sanitized hint text or `null`.

### `frontend/lib/project-autosave.ts`

`attemptProjectAutosave` now accepts an optional `hint?: string` and threads it to `buildProjectScopedSnapshotLabel`.

### `frontend/app/[locale]/app/page.tsx`

Two new module-level helper functions (not exported, no new props/routes):

- `getWorkspacePathBasename(filePath)` — portable client-side basename utility using `/`+`\` split; returns `null` for blank/null paths.
- `buildAutosaveHintFromFileActions(actions)` — derives a hint from `WorkspaceFileAction[]`: single file → basename; multiple files → `basename +N`.

Three call sites updated (no handler logic changed):

| Call site | Hint passed |
|---|---|
| AI autosave (`maybeRunExecutionCoherence`) | `buildAutosaveHintFromFileActions(executionFileActionsByExecutionIdRef.current[executionId] ?? [])` |
| File-save autosave (`handleSaveWorkspaceFile`) | `getWorkspacePathBasename(selectedFilePath)` |
| Preview autosave (`handleStartPreview`) | `getWorkspacePathBasename(selectedFilePath)` |
| Expiry autosave (expiry `useEffect`) | No hint — remains source-only |
| Initial project-create snapshot (`handleCreateWorkspaceProject`) | No hint — remains source-only |

Null hints from helpers are converted to `undefined` at the call sites (matching the `hint?: string` param type).

### `frontend/components/workspace/workspace-shell.tsx`

- Imported `parseProjectScopedSnapshotHint` from `./workspace-snapshots.logic`.
- Added `PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR = ':hint:'` local constant.
- Added `:hint:` separator to `parseProjectIdFromProjectScopedSnapshotLabel`'s separator guard list — ensures hint-bearing labels project-id-filter correctly.
- Updated `formatProjectHistoryFallbackLabel` to append `· <hint>` when a hint is present: `"Source label · hint"`.

Named saves continue to return the user-supplied text from `parseProjectScopedSnapshotName`; the fallback path is not reached for named labels. Older unlabeled snapshots still return `'Saved version'`.

### Tests

`workspace-snapshots.logic.test.ts` — 2 new tests + 2 updated:
1. *(new)* `'buildProjectScopedSnapshotLabel optionally encodes a sanitized deterministic hint'` — verifies sanitization strips separator substrings and `]`.
2. *(new)* `'parseProjectScopedSnapshotHint returns the sanitized hint only for source-plus-hint labels'` — round-trip for all label shapes.
3. *(updated)* `'parseProjectScopedSnapshotSource returns the source tag only for source-tagged labels'` — added assertion that source is correctly parsed from a source+hint label.
4. *(updated)* `'resolveProjectScopedLatestSnapshotId matches source-tagged project labels'` — fixture updated to use hint-bearing label.

`workspace-shell.test.tsx` — 1 new fixture + 1 new test:
- `projectHistorySnapshotsWithHints` fixture
- `'appends deterministic hints to automatic source-based fallback labels when present'`

`project-autosave.test.ts` — 1 test updated (name and body changed):
- `'returns saved and calls save once with the source-plus-hint project-scoped snapshot label'` — asserts `[project-id:project-1:source:preview:hint:index.html]` in request body.

## Explicit Statements

- **No new props were added.**
- **No new routes were added.**
- **No backend/API/schema changes were made.**
- **No AI-generated labels.**
- **No new UI structures were added.**
- **No save/restore semantic changes were made.**
- **No broader D1 history redesign.**
- **No task files were edited during the implementation step.**

## Validation

### 1. TypeScript typecheck

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

Note: initial run produced `TS2322: Type 'string | null' is not assignable to type 'string | undefined'` at three hint call sites. Fixed by converting `null` to `undefined` via `?? undefined`. Typecheck then passed clean.

### 2. Focused regression suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx components/workspace/workspace-snapshots.logic.test.ts lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts
```

Result: **PASS** — 160/160 tests passing, 0 failures (5 new/updated tests, 155 prior tests). No regressions.

### 3. Targeted lint attempt

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npm run lint -- --file "app/[locale]/app/page.tsx" ...
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. Same issue documented in all prior PROJ-03 checkpoints from A0 onward.

Fallback: `ReadLints` on all seven changed files — **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run. Restored via `git restore -- "frontend/tsconfig.tsbuildinfo"` so the working-tree diff is limited to the seven changed production/test files.

## Honest Note

Automatic version labels are now more specific when hint context is available. The history list will show labels like `"AI changes saved · app.tsx +2"` or `"File saved · index.html"` instead of the source-only `"AI changes saved"` or `"File saved"`. Manual named saves still render the user-supplied name unchanged. Older unlabeled and source-only snapshots (including the legacy direct manual snapshot-save path) still render safely as `'Saved version'` or the source-only string respectively.

The extended label format `[project-id:<id>:source:<tag>:hint:<text>]` is stored in the opaque backend `label` field — no backend migration is needed. Existing stored labels are fully backward-compatible. Source-only labels already in storage will continue to render without a hint.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Deterministic heuristic-only labeling | ✅ |
| No AI dependency or async naming flow | ✅ |
| No backend/history semantic changes | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: byte-identical to pre-D1c |
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
| No AI-generated labels | ✅ Not implemented |
| No later-phase work | ✅ Label generation + display only |
