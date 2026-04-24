# PROJ-03-C2e-hotfix CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-C2e-hotfix
- **Title:** Autosave After Every Successful AI Action Boundary Behind Feature Flag
- **Nature:** FRONTEND / AUTOSAVE CADENCE HOTFIX
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-C2e-hotfix-CHECKPOINT.md`
- **Source:** Post-C2e behavioral gap: `AI_ACTIONS_PER_AUTOSAVE = 5` threshold counter caused project snapshot capture to be delayed until after the 5th successful AI coherence completion; AI-created/modified files could be lost from project history if the browser/session ended before the threshold was reached
- **Depends on:** PROJ-03-C2e (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, change the AI-action autosave trigger so every successful AI coherence completion (`coherenceResult.ran === true`) attempts a project autosave immediately, instead of waiting for the 5-action threshold. Reuse the existing `attemptProjectAutosave(...)` path and all existing guards. No UI change.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Surgical removal of threshold counter constant, ref, reset, and counter-gate block. |

**`frontend/app/[locale]/app/page.tsx` was the only production file changed.**

**No test files were added or modified in this step.**

## Locked Scope Actually Implemented

This is an AI autosave cadence-only change. All handler semantics, guards, result handling, backend calls, and all other autosave trigger paths are untouched.

### `frontend/app/[locale]/app/page.tsx`

Five localized removals were made:

#### 1. Removed module-level constant (was after `AI_AUTO_CHECKPOINT_DESCRIPTION`)

```ts
// REMOVED:
const AI_ACTIONS_PER_AUTOSAVE = 5;
```

#### 2. Removed ref (was after `lastProjectAutosaveAtRef`)

```ts
// REMOVED:
const aiActionsCompletedSinceLastAutosaveRef = useRef<number>(0);
```

#### 3. Removed counter reset from the existing project/session reset effect (was after `coheredExecutionIdsRef.current = new Set<string>()`)

```ts
// REMOVED:
aiActionsCompletedSinceLastAutosaveRef.current = 0;
```

#### 4. Removed counter-increment and threshold-gate block from `maybeRunExecutionCoherence(...)` (was between `coherenceResult.ran` guard and the autosave guard block)

```ts
// REMOVED:
aiActionsCompletedSinceLastAutosaveRef.current += 1;
if (aiActionsCompletedSinceLastAutosaveRef.current < AI_ACTIONS_PER_AUTOSAVE) {
  return;
}
```

#### 5. Removed the now-dead pre-autosave counter reset (was immediately after the threshold-gate block, before the autosave guard block)

```ts
// REMOVED:
aiActionsCompletedSinceLastAutosaveRef.current = 0;
```

### Left intact

The following were not changed:

- `coherenceResult.ran` guard — still the first check after `runAiActionCoherence` returns
- Existing autosave guard block — `PROJECT_FIRST_UX`, token, `selectedProjectId`, `selectedSessionIdRef.current`, `!projectOpenInProgressRef.current` guards unchanged
- `attemptProjectAutosave(...)` call — unchanged
- `lastProjectAutosaveAtRef.current` update on `saved` — unchanged
- Best-effort `void loadWorkspaceSnapshotsForUser(token)` on `saved` — unchanged
- On `skipped-rate-limited` or `failed` — no-op, no crash, no UI change — unchanged

### Net effect

After `coherenceResult.ran` passes, execution now falls straight through to the existing autosave guard block on every successful AI coherence completion. Cadence control is left to the existing rate-limit path (`attemptProjectAutosave(...)` / `lastProjectAutosaveAtRef`) rather than the removed every-5th counter.

## No Backend / API / Schema Changes

No backend/API/schema changes were made. No new UI surface was introduced. No handler redesign beyond the AI autosave cadence change.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/components/workspace/workspace-ai-coherence.logic.ts` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/project-named-save.ts` | Unchanged |
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| Preview-start autosave (C2b) | Unchanged |
| Expiry-warning autosave (C2d-expiry-warn) | Unchanged |
| Explicit file-save autosave (C2f-file-save) | Unchanged |
| Named-save flow and label helpers | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c/C2d-expiry-warn/C2e/C2f-file-save/C4/D0/D0b/D0c/D0d paths | Unchanged |

No tests were added. No helper or logic modules were changed.

## Validation

### 1. TypeScript typecheck

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused regression suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 150/150 tests passing, 0 failures. No regressions across all seven suites.

### 3. Targeted lint attempt

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npm run lint -- --file "app/[locale]/app/page.tsx"
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. Same issue documented in all prior PROJ-03 checkpoints from A0 onward.

Fallback: `ReadLints` on `frontend/app/[locale]/app/page.tsx` — **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run. Restored via `git restore -- "frontend/tsconfig.tsbuildinfo"` so the working-tree diff is limited to the single changed production file.

## Honest Note

Every successful AI coherence completion now falls through to the existing autosave guard block on every call. Cadence control is now left entirely to the existing rate-limit path inside `attemptProjectAutosave(...)` (driven by `lastProjectAutosaveAtRef`), which enforces a per-minute minimum interval. The removed every-5th counter no longer delays snapshot capture beyond that rate-limit.

This means a burst of N rapid AI actions will trigger at most one autosave per rate-limit window (typically 60 seconds), not once per 5 actions as before — and the first action in each window now captures a snapshot rather than requiring 5 to accumulate first.

## Preserved Invariants

| Invariant | Status |
|---|---|
| AI autosave cadence only — no other autosave trigger changed | ✅ |
| No non-AI autosave trigger changes (preview-start, expiry-warning, file-save, named-save) | ✅ |
| No UI/UX surface changes | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: unchanged behavior |
| `projectOpenInProgressRef` guard mandatory | ✅ Preserved in guard block |
| Per-minute rate limit (C2a) protects against excessive saves | ✅ Delegated to `attemptProjectAutosave` |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No D1 work | ✅ Not implemented |
| No C3 work | ✅ Not implemented |
| No C2d-unload work | ✅ Not implemented |
| No manual editor draft protection | ✅ Not implemented |
| No later-phase work | ✅ AI autosave cadence change only |
