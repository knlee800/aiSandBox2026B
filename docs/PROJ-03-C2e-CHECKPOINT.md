# PROJ-03-C2e CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2e
- Title: Add AI-Action-Boundary Autosave Trigger Behind Feature Flag
- Nature: FRONTEND / PHASE C AUTOSAVE TRIGGER — AI ACTION BOUNDARY
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2e-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2e: AI file-action coherence boundary trigger
- Depends on: PROJ-03-C2d-expiry-warn (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, after every Nth successful AI file-action coherence completion (`coherenceResult.ran === true` from `runAiActionCoherence`), attempt one project-scoped autosave snapshot using the locked `attemptProjectAutosave` helper and the existing `lastProjectAutosaveAtRef` rate-limit ref. Reset the counter on any threshold-triggered autosave attempt and on project switch. Skip silently when the flag is off, when guards fail, or when rate-limited.

## Scope Statement

C2e makes bounded modifications to one existing file. No new helper module was introduced. No test file was added. No existing handlers, effects, or logic modules were modified outside `maybeRunExecutionCoherence`.

The only modified source file was:

- `frontend/app/[locale]/app/page.tsx`

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty in the working tree from the earlier registration step and were not modified during the implementation step.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Bounded modification. Constant, ref, counter reset, and autosave logic added. |

No other source files were modified.

## Implementation Details

### `frontend/app/[locale]/app/page.tsx` — bounded modification

Four localized changes were made:

#### 1. New module-level constant (after `AI_AUTO_CHECKPOINT_DESCRIPTION`)

```ts
const AI_ACTIONS_PER_AUTOSAVE = 5;
```

#### 2. New ref (after `lastProjectAutosaveAtRef`)

```ts
const aiActionsCompletedSinceLastAutosaveRef = useRef<number>(0);
```

#### 3. Counter reset in the existing project/session reset effect (after `coheredExecutionIdsRef.current = new Set<string>()`)

```ts
aiActionsCompletedSinceLastAutosaveRef.current = 0;
```

This reset is placed in the same effect block that already resets `coheredExecutionIdsRef` and `appliedFileActionsExecutionIdsRef` on session/project switch. It ensures stale counts cannot bleed across project switches.

#### 4. Capture return value and autosave logic in `maybeRunExecutionCoherence(...)`

Changed the discarded `await runAiActionCoherence(...)` call to `const coherenceResult = await runAiActionCoherence(...)`, then appended the following post-coherence block:

```ts
if (!coherenceResult.ran) {
  return;
}

aiActionsCompletedSinceLastAutosaveRef.current += 1;
if (aiActionsCompletedSinceLastAutosaveRef.current < AI_ACTIONS_PER_AUTOSAVE) {
  return;
}

aiActionsCompletedSinceLastAutosaveRef.current = 0;

const selectedSessionIdAtAutosave = selectedSessionIdRef.current;
if (
  !PROJECT_FIRST_UX ||
  !selectedProjectId ||
  !selectedSessionIdAtAutosave ||
  projectOpenInProgressRef.current
) {
  return;
}

const autosaveAttemptedAt = Date.now();
const autosaveResult = await attemptProjectAutosave({
  token,
  sessionId: selectedSessionIdAtAutosave,
  projectId: selectedProjectId,
  now: autosaveAttemptedAt,
  lastAutosaveAt: lastProjectAutosaveAtRef.current,
});
if (autosaveResult.status === 'saved') {
  lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
  void loadWorkspaceSnapshotsForUser(token);
}
```

#### Guard execution order

1. `coherenceResult.ran` — skips if coherence did not actually run (e.g., stale session, no successful writes, not applied)
2. Counter increment, then threshold check — increments only on genuine coherence completions; early-returns until Nth
3. Counter reset to 0 — happens before the autosave attempt, so every threshold trigger resets regardless of autosave result
4. `PROJECT_FIRST_UX` — kill switch; skips when flag is off
5. `selectedProjectId` — skips if no project selected
6. `selectedSessionIdRef.current` — uses the ref-backed session id, consistent with how `runAiActionCoherence` itself passes `selectedSessionId`
7. `!projectOpenInProgressRef.current` — skips during project-open hydration

#### On `saved`

- `lastProjectAutosaveAtRef.current = autosaveAttemptedAt` — records the timestamp for the next rate-limit check
- `void loadWorkspaceSnapshotsForUser(token)` — best-effort snapshot list reload; intentionally `void` so a reload failure cannot surface as an unhandled promise rejection

#### On `skipped-rate-limited` or `failed`

- No-op. The counter was already reset to 0 before the attempt, so subsequent coherence completions will count toward the next threshold normally.

### AI action boundary hook note

- The trigger is the existing `maybeRunExecutionCoherence(...)` path, immediately after `runAiActionCoherence(...)` returns. This is the in-app signal for successful AI file-action completion and is already gated by `acquireExecutionCoherenceGuard`, ensuring each execution is cohered exactly once.
- `selectedSessionIdRef.current` is used inside `maybeRunExecutionCoherence` rather than the `selectedSessionId` state variable, consistent with how `runAiActionCoherence` itself receives the session id, and consistent with the existing C2b and C2d-expiry-warn patterns.
- Counter reset behavior is exact to scope: reset on project switch (in the existing cohered-IDs reset effect) and reset before every threshold-triggered autosave attempt regardless of whether the save ends up `saved`, `skipped-rate-limited`, or `failed`.

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
| Named-save flow, label helpers, UI surfaces | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c/C2d-expiry-warn paths | Unchanged |

No tests were added. No helper or logic modules were changed.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Full focused regression suite

```
frontend $ npx tsx --test lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 146/146 tests, 0 failures. No regressions.

### 3. Lint

Targeted `npm run lint` attempt encountered the known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. `ReadLints` on `frontend/app/[locale]/app/page.tsx`: **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` regenerated by the typecheck run and restored via `git restore -- frontend/tsconfig.tsbuildinfo`.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Bounded modification to `maybeRunExecutionCoherence` body only; no new save path | ✅ |
| Reuse locked `attemptProjectAutosave` and `lastProjectAutosaveAtRef`; no new save path | ✅ |
| Counter reset discipline mandatory | ✅ Reset on project switch and before every threshold-triggered attempt |
| `projectOpenInProgressRef` guard mandatory | ✅ Guard 7 in the post-coherence block |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Guard 4 |
| Per-minute rate limit (C2a) protects against excessive saves | ✅ Delegated to `attemptProjectAutosave` |
| No unload/close lifecycle handling | ✅ |
| No C2d-unload | ✅ |
| No C2f / C3 / C4 / Phase D/E work | ✅ |
| No change to `runAiActionCoherence` module or `workspace-ai-coherence.logic.ts` | ✅ |
| No UI affordance, toast, banner, or new visible status surface | ✅ |
| No `workspace-shell.tsx` change | ✅ |
| No named-save flow or label helper change | ✅ |
| No backend/API/schema change | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
