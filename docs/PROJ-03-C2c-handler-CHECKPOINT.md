# PROJ-03-C2c-handler CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2c-handler
- Title: Add Named Project Snapshot Save Pure-Logic Helper Behind Feature Flag
- Nature: FRONTEND / PHASE C NAMED SAVE PURE LOGIC — HELPER SCAFFOLDING
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2c-handler-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c second slice: named-save handler helper
- Depends on: PROJ-03-C2c-label-format (COMPLETE and LOCKED)

## Objective

Provide a pure-logic helper that performs a single project-scoped named save by composing the locked C2c-label-format `buildProjectScopedSnapshotLabelWithName` helper with the existing `saveWorkspaceSnapshot` fetcher. Returns a discriminated result and never throws. No consumer wiring. No UI. Mirrors the helper-only scaffolding pattern used by C2a-rate-limit and C2c-label-format.

## Scope Statement

This is **pure-logic helper scaffolding only with no consumer wiring, no UI change, and no modification to any existing production file**. C2c-handler adds exactly two new files: the helper and its tests. No existing imported module was changed. No `page.tsx`, `workspace-shell.tsx`, `recovery-copy.ts`, `project-autosave.ts`, or any locked Phase A/B/C path was touched. No C2c-cta, C2c-display, C2d/C2e/C2f, C3, C4, or later-phase work was performed.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty from the earlier registration step and were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/project-named-save.ts` | New. Exports `NamedProjectSaveResult` type and `attemptNamedProjectSave` helper. |
| `frontend/lib/project-named-save.test.ts` | New. Four focused unit tests under `node:test`. |

No other source files were modified. `frontend/app/[locale]/app/page.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/lib/recovery-copy.ts`, `frontend/lib/project-autosave.ts`, `frontend/lib/autosave-rate-limit.ts`, `frontend/lib/open-project-in-fresh-session.ts`, and `frontend/components/workspace/workspace-snapshots.logic.ts` are all unchanged.

## Implementation Details

### `frontend/lib/project-named-save.ts`

```ts
import {
  buildProjectScopedSnapshotLabelWithName,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshotSummary,
} from '../components/workspace/workspace-snapshots.logic';

export type NamedProjectSaveResult =
  | { status: 'saved'; savedSnapshot: WorkspaceSnapshotSummary }
  | { status: 'failed' };

export async function attemptNamedProjectSave(args: {
  token: string;
  sessionId: string;
  projectId: string;
  name: string;
  fetchImpl?: typeof fetch;
}): Promise<NamedProjectSaveResult> {
  try {
    const savedSnapshot = await saveWorkspaceSnapshot({
      token: args.token,
      sessionId: args.sessionId,
      label: buildProjectScopedSnapshotLabelWithName(args.projectId, args.name),
      fetchImpl: args.fetchImpl,
    });
    return { status: 'saved', savedSnapshot };
  } catch (error) {
    console.error('Failed to save named project snapshot:', error);
    return { status: 'failed' };
  }
}
```

**Design decisions:**

- Imports `buildProjectScopedSnapshotLabelWithName` from the locked C2c-label-format slice. All name normalization is fully delegated to this helper — `attemptNamedProjectSave` passes `args.name` through verbatim with no local trim or blank-fallback logic.
- Reuses existing `saveWorkspaceSnapshot` from `workspace-snapshots.logic.ts` — no new fetcher, no new endpoint reference.
- `fetchImpl` is injectable for deterministic unit testing (mirrors the pattern from `project-autosave.ts` and `open-project-in-fresh-session.ts`).
- `NamedProjectSaveResult` is a two-variant discriminated union (`saved` / `failed`). There is deliberately **no** `skipped-rate-limited` variant — named saves are explicit user-initiated actions and are not rate-limited.
- Save errors are caught and returned as `{ status: 'failed' }` — the helper never re-throws. This ensures a named-save failure cannot propagate unexpectedly to future call sites.
- Named exports only; no default export (consistent with other `frontend/lib` helpers).

**Relationship to sibling helper `project-autosave.ts`:**

Both helpers wrap `saveWorkspaceSnapshot`. They are independent siblings: `attemptProjectAutosave` adds rate-limit gating and uses the unnamed label; `attemptNamedProjectSave` has no rate-limit and uses a named label. No shared abstraction was introduced, consistent with the C2c-handler registration scope.

### `frontend/lib/project-named-save.test.ts`

Four focused tests using `node:test` + `node:assert/strict` with injectable `fetchImpl`:

| # | Test | What it proves |
|---|---|---|
| 1 | `returns saved and sends a named project snapshot label for non-blank names` | Helper calls `saveWorkspaceSnapshot` exactly once; request body contains `[project-id:project-1:name:Working draft]` (outer whitespace of `'  Working draft  '` trimmed by `buildProjectScopedSnapshotLabelWithName`); returns `{ status: 'saved', savedSnapshot }` |
| 2 | `returns saved and sends the unnamed label shape for whitespace-only names` | When `name` is `'   '`, request body contains `[project-id:project-1]` (unnamed label); proves blank-name fallback is delegated to the locked label helper, not re-implemented locally |
| 3 | `returns failed when save fetch rejects` | `fetchImpl` throws `'network down'` → `{ status: 'failed' }`; no re-throw |
| 4 | `returns failed when save returns a non-ok response` | `fetchImpl` returns HTTP 500 → `{ status: 'failed' }`; no re-throw |

Tests 3 and 4 use a `withPatchedConsoleError` helper to suppress the expected `console.error` output produced by the helper's catch block, keeping the test output clean. The pattern mirrors `project-autosave.test.ts` exactly.

## Helper Consumption

`attemptNamedProjectSave` is **not imported anywhere in production code**. Repo search for `attemptNamedProjectSave` matched only:

- `frontend/lib/project-named-save.ts`
- `frontend/lib/project-named-save.test.ts`

No consumer wiring was performed in this slice. `PROJECT_FIRST_UX` gating is deferred to future call sites (C2c-cta and later), consistent with the `attemptProjectAutosave` design from C2b.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Isolated unit tests

```
frontend $ npx tsx --test lib/project-named-save.test.ts
```

Result: **PASS** — 4 tests / 0 suites (top-level), 0 failures.

### 3. Full focused regression suite

```
frontend $ npx tsx --test lib/project-named-save.test.ts lib/project-autosave.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 137 tests / 6 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 88/88 pass
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 13/13 pass
- `autosave-rate-limit` — 9/9 pass
- `open-project-in-fresh-session` — 6/6 pass
- `project-autosave` — 6/6 pass (top-level)
- `project-named-save` — 4/4 pass (top-level)

### 4. Targeted lint attempt

```
frontend $ npm run lint -- --file lib/project-named-save.ts --file lib/project-named-save.test.ts
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C2c-handler. Same issue documented in all prior Phase A, B, and C checkpoints.

### 5. File-level lint check

`ReadLints` run on both new source files: **no linter errors found**.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore -- frontend/tsconfig.tsbuildinfo` so the working-tree diff is limited to the two new files.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `frontend/lib/recovery-copy.ts` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c-label-format paths | Unchanged |

## Preserved Invariants

| Invariant | Status |
|---|---|
| Pure logic only; no consumer wiring in this slice | ✅ New exports not imported anywhere in production code |
| No local name normalization; delegated entirely to `buildProjectScopedSnapshotLabelWithName` | ✅ `args.name` passed through verbatim; normalization lives in the locked label helper |
| `attemptProjectAutosave` not refactored; no shared abstraction introduced | ✅ Both helpers remain independent siblings |
| `PROJECT_FIRST_UX` remains the kill-switch posture for future consumers | ✅ No flag gate in helper; gating deferred to future C2c-cta call site |
| No consumer wiring | ✅ |
| No page.tsx change | ✅ |
| No workspace-shell.tsx or recovery-copy.ts change | ✅ |
| No change to `attemptProjectAutosave` | ✅ |
| No rate-limit gating | ✅ Named saves are user-initiated; rate-limit belongs on autosave only |
| No backend/API/schema change | ✅ |
| No retention/compaction (C3) | ✅ |
| No vocabulary purge (C4) | ✅ |
| No git-checkpoint union (deferred C1c) | ✅ |
| No C2c-cta, C2c-display, C2d/C2e/C2f, C3, C4, or later-phase work | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
