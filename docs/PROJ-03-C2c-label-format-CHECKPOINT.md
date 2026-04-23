# PROJ-03-C2c-label-format CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2c-label-format
- Title: Add Project Snapshot Label Name Extension Pure-Logic Helpers Behind Feature Flag
- Nature: FRONTEND / PHASE C SNAPSHOT LABEL FORMAT EXTENSION — PURE LOGIC
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2c-label-format-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c first slice: label-format scaffolding
- Depends on: PROJ-03-C2b-trigger-preview (COMPLETE and LOCKED)

## Objective

Add pure-logic helpers that support an optional user-supplied name in project-scoped snapshot labels while preserving exact backward compatibility with the current unnamed `[project-id:...]` label shape produced and consumed since B0/B4. No consumers yet. No write-path change. No UI change. Mirrors the C2a-rate-limit and A0 mechanical-scaffolding pattern.

## Scope Statement

This is **pure-logic scaffolding only with no consumer wiring, no UI change, and no production-file modification outside `workspace-snapshots.logic.ts`**. C2c-label-format adds two new exported helpers and a shared internal parser refactor inside the one allowed production file. No existing exported signature was changed. No consumer was wired. No UI was changed. No `page.tsx`, `workspace-shell.tsx`, `recovery-copy.ts`, `attempt ProjectAutosave`, or any locked Phase A/B/C path was touched. No C2c-handler, C2c-cta, C2c-display, C2d/C2e/C2f, C3, C4, or later-phase work was performed.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty from the earlier registration step and were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Modified. Added `PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR` constant, `normalizeProjectScopedSnapshotName` and `parseProjectScopedSnapshotLabelParts` internal helpers, exported `buildProjectScopedSnapshotLabelWithName`, exported `parseProjectScopedSnapshotName`, and refactored `parseProjectIdFromSnapshotLabel` to delegate to the shared internal parser. |
| `frontend/components/workspace/workspace-snapshots.logic.test.ts` | Modified. Five additive tests added for new helpers plus one new mixed-label regression test for `resolveProjectScopedLatestSnapshotId`. |

No other source files were modified. `frontend/app/[locale]/app/page.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/lib/recovery-copy.ts`, `frontend/lib/project-autosave.ts`, and `frontend/lib/open-project-in-fresh-session.ts` are all unchanged.

## Implementation Details

### Label format extension

**Unnamed label (unchanged):** `[project-id:<projectId>]`

**Named label (new):** `[project-id:<projectId>:name:<trimmedName>]`

The separator `:name:` was chosen because project IDs are UUID-style strings that cannot contain `:name:` literally. The separator is module-private.

### `workspace-snapshots.logic.ts` changes

**New module-private constant (line 42):**
```ts
const PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR = ':name:';
```

**`buildProjectScopedSnapshotLabel(projectId)` — unchanged.** Output for unnamed labels is byte-identical to pre-C2c.

**New module-private helper `normalizeProjectScopedSnapshotName(name)`:**
Trims `name`; returns `null` if the result is empty, otherwise the trimmed string.

**New module-private helper `parseProjectScopedSnapshotLabelParts(label)`:**
Replaces the previous inline logic of `parseProjectIdFromSnapshotLabel` with a canonical parser that returns `{ projectId, name }` or `null`. Handles both old unnamed format and new named format:
- Strips `PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX` / `SUFFIX`.
- Searches for `PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR` in the inner body.
- If found: `projectId` = body up to the separator; `name` = body after the separator, normalized.
- If not found: `projectId` = entire body; `name` = `null`.

**`parseProjectIdFromSnapshotLabel(label)` — internal only, refactored:**
Now a one-liner that delegates to `parseProjectScopedSnapshotLabelParts`:
```ts
function parseProjectIdFromSnapshotLabel(label: string | null): string | null {
  return parseProjectScopedSnapshotLabelParts(label)?.projectId ?? null;
}
```
This function was never exported, so the refactor has no public-surface impact. `resolveProjectScopedLatestSnapshotId` continues to call it without change, and it now works correctly for both unnamed and named labels.

**New exported helper `buildProjectScopedSnapshotLabelWithName(projectId, name)`:**
```ts
export function buildProjectScopedSnapshotLabelWithName(
  projectId: string,
  name: string,
): string {
  const normalizedName = normalizeProjectScopedSnapshotName(name);
  if (!normalizedName) {
    return buildProjectScopedSnapshotLabel(projectId);
  }
  return `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${projectId.trim()}${PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR}${normalizedName}${PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX}`;
}
```
Empty or whitespace-only `name` falls back to the unnamed label shape — byte-identical to `buildProjectScopedSnapshotLabel(projectId)`. No `[name:]` artifact is ever produced.

**New exported helper `parseProjectScopedSnapshotName(label)`:**
```ts
export function parseProjectScopedSnapshotName(label: string | null): string | null {
  return parseProjectScopedSnapshotLabelParts(label)?.name ?? null;
}
```
Returns the trimmed name when present; returns `null` for unnamed labels, blank-name labels, and `null` input.

**`resolveProjectScopedLatestSnapshotId` — unchanged.** It continues to call `parseProjectIdFromSnapshotLabel` internally, which now delegates to the shared parser and handles both label shapes. No call-site change was needed.

### Normalization behavior (explicit)

| Input name | Output label behavior |
|---|---|
| `'  Working draft  '` | Named label `[project-id:...:name:Working draft]` |
| `'   '` (whitespace only) | Falls back to unnamed `[project-id:...]` |
| `''` (empty) | Falls back to unnamed `[project-id:...]` |

| Input `parseProjectScopedSnapshotName` | Return value |
|---|---|
| `'[project-id:p-1:name:Working draft]'` | `'Working draft'` |
| `'  [project-id:p-1:name:Working draft]  '` | `'Working draft'` (outer label whitespace tolerated) |
| `'[project-id:p-1:name:   ]'` (blank name) | `null` |
| `'[project-id:p-1]'` (unnamed) | `null` |
| `null` | `null` |

### Export surface change

Additive only. Two new named exports added:
- `buildProjectScopedSnapshotLabelWithName`
- `parseProjectScopedSnapshotName`

No existing exported signatures were changed or removed.

## Tests Added

Six additive tests in `workspace-snapshots.logic.test.ts` (total suite count: 13, up from 8):

| Test | What it proves |
|---|---|
| `buildProjectScopedSnapshotLabelWithName encodes a deterministic named label` | Named build path is deterministic; same inputs → same output; exact expected label string |
| `buildProjectScopedSnapshotLabelWithName falls back to the unnamed label shape for blank names` | Blank name collapses to the exact unnamed shape returned by `buildProjectScopedSnapshotLabel` — byte-identical |
| `parseProjectScopedSnapshotName returns the trimmed name when present` | Returns trimmed name; outer label whitespace tolerated |
| `parseProjectScopedSnapshotName returns null for unnamed or blank-name labels` | Returns `null` for unnamed label, blank-name named label, and `null` input |
| `resolveProjectScopedLatestSnapshotId matches both unnamed and named project labels` | `find()` returns first (newest) match regardless of whether the matching label is unnamed or named; a different project's named label is correctly excluded |

The pre-existing `buildProjectScopedSnapshotLabel encodes project id marker` test remains unchanged and continues to assert `[project-id:project-123]`, proving the unnamed build path is byte-identical.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused test suite (workspace-snapshots.logic only)

```
frontend $ npx tsx --test components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 13 tests / 1 suite, 0 failures. Includes all 5 new C2c-label-format tests and all 8 prior tests.

### 3. Full focused regression suite

```
frontend $ npx tsx --test components/workspace/workspace-snapshots.logic.test.ts lib/project-autosave.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts
```

Result: **PASS** — 133 tests / 6 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 88/88 pass
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 13/13 pass
- `autosave-rate-limit` — 9/9 pass
- `open-project-in-fresh-session` — 6/6 pass
- `project-autosave` — 6/6 pass (top-level, counted in total)

### 4. Targeted lint attempt

```
frontend $ npm run lint -- --file components/workspace/workspace-snapshots.logic.ts --file components/workspace/workspace-snapshots.logic.test.ts
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C2c-label-format. Same issue documented in A0/A1/A3/A2a/A2b/B0/B1/B2a/B2b/B3a/B4a/B4b/C1a/C1b-pre/C1b-cta/C2a-rate-limit/C2b-trigger-preview checkpoints.

### 5. File-level lint check

`ReadLints` run on both changed source files: **no linter errors found**.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the two changed source files.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `frontend/lib/recovery-copy.ts` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| All locked Phase A/B/C1/C2a/C2b paths | Unchanged |

## Preserved Invariants

| Invariant | Status |
|---|---|
| Pure logic only; no consumer wiring in this slice | ✅ New exports are not imported anywhere in production code |
| `buildProjectScopedSnapshotLabel(projectId)` output byte-identical | ✅ Function body unchanged; existing test still asserts `[project-id:project-123]` |
| `parseProjectIdFromSnapshotLabel` continues to work for both label shapes | ✅ Delegates to shared parser; backward-compatible for old labels; new labels parsed correctly |
| `resolveProjectScopedLatestSnapshotId` works without caller changes | ✅ Inherits fix via internal parser; no external interface change |
| `PROJECT_FIRST_UX` remains the kill-switch posture for future consumers | ✅ No consumer introduced; future C2c-handler/C2c-cta slices will gate on the flag |
| No consumer wiring | ✅ |
| No page.tsx change | ✅ |
| No workspace-shell.tsx or recovery-copy.ts change | ✅ |
| No preview autosave behavior change | ✅ `attemptProjectAutosave` still calls `buildProjectScopedSnapshotLabel`; untouched |
| No backend/API/schema change | ✅ |
| No retention/compaction (C3) | ✅ |
| No vocabulary purge (C4) | ✅ |
| No git-checkpoint union (deferred C1c) | ✅ |
| No C2c-handler, C2c-cta, C2c-display, C2d/C2e/C2f, C3, C4, or later-phase work | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
