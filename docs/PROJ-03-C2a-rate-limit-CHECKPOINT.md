# PROJ-03-C2a-rate-limit CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2a-rate-limit
- Title: Add Per-Minute Autosave Safety-Net Pure-Logic Helper Behind Feature Flag
- Nature: FRONTEND / PHASE C AUTOSAVE RATE-LIMIT SCAFFOLDING
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2a-rate-limit-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2 first slice: pure-logic safety-net helper
- Depends on: PROJ-03-C1b-cta (COMPLETE and LOCKED)

## Objective

Add a single pure-logic helper module that defines the autosave rate-limit contract every future C2 trigger will use, with no consumers yet and no write-path changes. Mirrors the A0 mechanical-scaffolding pattern.

## Scope Statement

This is **pure-logic scaffolding only with no consumer wiring and no production-file modifications**. C2a-rate-limit adds exactly two new files — `frontend/lib/autosave-rate-limit.ts` and `frontend/lib/autosave-rate-limit.test.ts`. No existing production files were modified. No trigger was wired. No write path was changed. No UI was changed. No backend was changed. No C2b/C2c/C2d/C2e/C2f, C3, C4, or later-phase work was performed.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/autosave-rate-limit.ts` | New. Exports `AUTOSAVE_MIN_INTERVAL_MS` constant and `shouldAllowAutosaveNow` pure function. |
| `frontend/lib/autosave-rate-limit.test.ts` | New. Nine focused unit tests under `node:test`. |

No other source files were modified. `frontend/app/[locale]/app/page.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-snapshots.logic.ts`, `frontend/lib/open-project-in-fresh-session.ts`, and all locked Phase A/B/C1 paths are unchanged.

## Implementation Details

### `frontend/lib/autosave-rate-limit.ts`

```ts
export const AUTOSAVE_MIN_INTERVAL_MS = 60_000;

export function shouldAllowAutosaveNow(args: {
  now: number;
  lastSnapshotAt: number | null;
  minIntervalMs?: number;
}): boolean {
  if (args.lastSnapshotAt === null) {
    return true;
  }

  return args.now - args.lastSnapshotAt >= (args.minIntervalMs ?? AUTOSAVE_MIN_INTERVAL_MS);
}
```

**Design decisions:**
- No imports. No side effects. No state. No `window`, `Date`, or `fetch` calls.
- Named exports only (no default export), consistent with `open-project-in-fresh-session.ts` convention.
- `minIntervalMs` is optional so future consumers can use the default constant without repeating it.
- The function deliberately accepts caller-supplied `now` and `lastSnapshotAt` integers so it is fully testable without any time mocking and requires no storage decision from this slice. Where those values come from (`useRef`, `localStorage`, module-level state) is deferred to the first consumer slice (C2b).

### `frontend/lib/autosave-rate-limit.test.ts`

Nine focused tests using `node:test` + `node:assert/strict` (matching the `open-project-in-fresh-session.test.ts` convention):

| # | Test | What it proves |
|---|---|---|
| 1 | `returns true when no prior snapshot timestamp exists` | `lastSnapshotAt: null` → `true` |
| 2 | `returns false when elapsed time is less than the default interval` | `now = AUTOSAVE_MIN_INTERVAL_MS - 1`, `lastSnapshotAt: 0` → `false` |
| 3 | `returns true when elapsed time is exactly the default interval boundary` | `now = AUTOSAVE_MIN_INTERVAL_MS`, `lastSnapshotAt: 0` → `true` (boundary is **inclusive**) |
| 4 | `returns true when elapsed time is greater than the default interval` | `now = AUTOSAVE_MIN_INTERVAL_MS + 1`, `lastSnapshotAt: 0` → `true` |
| 5 | `respects a custom interval override` | `minIntervalMs: 3_000`; under-boundary → `false`; at boundary → `true` |
| 6 | `treats a zero interval as immediately eligible when a prior timestamp exists` | `minIntervalMs: 0`, `now === lastSnapshotAt` → `true` |
| 7 | `treats a negative interval as immediately eligible under the raw comparison contract` | `minIntervalMs: -1`, `now === lastSnapshotAt` → `true` |
| 8 | `returns false for clock-skew cases where now is earlier than the last snapshot timestamp` | `now: 999`, `lastSnapshotAt: 1_000` → `false` (conservative behavior) |
| 9 | `is deterministic for identical inputs` | same args invoked twice → same result both times |

## Edge-Case Behavior (Documented Choices)

| Edge case | Chosen behavior | Rationale |
|---|---|---|
| Exact boundary (`elapsed === minIntervalMs`) | Returns `true` (`>=`) | The design intent is "at least one per minute" with no accumulation — allowing at the exact boundary is the most natural choice for a recurring safety net. |
| Zero interval (`minIntervalMs = 0`) | Returns `true` when `elapsed >= 0` | Zero-ms interval = no rate limit. Caller passing 0 explicitly opts out; function follows the raw arithmetic. |
| Negative interval (`minIntervalMs = -1`) | Returns `true` | Same as zero — result of the raw `>=` comparison. Documented so consumers are not surprised. |
| Clock skew (`now < lastSnapshotAt`) | Returns `false` | Elapsed is negative; fails `>= interval`. Conservative — if the clock is unreliable, no new snapshot is triggered. |

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Isolated unit tests

```
frontend $ npx tsx --test lib/autosave-rate-limit.test.ts
```

Result: **PASS** — 9 tests / 1 suite, 0 failures.

### 3. Full focused regression suite

```
frontend $ npx tsx --test lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 122 tests / 6 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 88/88 pass
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `autosave-rate-limit` — 9/9 pass
- `open-project-in-fresh-session` — 6/6 pass

### 4. Targeted lint attempt

```
frontend $ npm run lint -- --file lib/autosave-rate-limit.ts --file lib/autosave-rate-limit.test.ts
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C2a-rate-limit. Same issue documented in all prior Phase A, B, and C checkpoints.

### 5. File-level lint check

`ReadLints` on both new files: **no linter errors found**.

### 6. Coverage note (honest)

C2a-rate-limit is pure arithmetic with no async surface, no imports, and no I/O. The nine tests exercise the full decision tree. No browser/E2E verification was performed or necessary. No page-handler test was added — there is no consumer to test.

### 7. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the two new files.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| `frontend/lib/recovery-copy.ts` | Unchanged |
| `frontend/lib/feature-flags.ts` | Unchanged |
| All locked Phase A/B/C1 paths | Unchanged |

## Preserved Invariants

| Invariant | Status |
|---|---|
| Pure logic only; no consumer wiring in this slice | ✅ The new files are not imported anywhere in production code |
| `PROJECT_FIRST_UX` remains the kill-switch posture for future consumers | ✅ No consumer introduced; future trigger slices will gate on the flag |
| No trigger wiring of any kind | ✅ |
| No write-path change | ✅ |
| No UI change | ✅ |
| No new fetcher, no new effect, no new `useEffect` | ✅ |
| No backend change | ✅ |
| No label-format extension | ✅ |
| No retention/compaction (C3) | ✅ |
| No vocabulary purge (C4) | ✅ |
| No C2b/C2c/C2d/C2e/C2f, C3, C4, or Phase D/E work | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
