# PROJ-03-C2d-expiry-warn CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2d-expiry-warn
- Title: Add Session-Expiry Warning Autosave Trigger Behind Feature Flag
- Nature: FRONTEND / PHASE C AUTOSAVE TRIGGER — SESSION-EXPIRY WARNING
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2d-expiry-warn-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2d first slice: in-app expiry-warning lifecycle trigger
- Depends on: PROJ-03-C2c-display (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, when the workspace detects a session-expiry warning (or equivalent session-terminated warning boundary), attempt one project-scoped autosave snapshot using the locked `attemptProjectAutosave` helper and the existing `lastProjectAutosaveAtRef` rate-limit ref, then reload the snapshot list. Skip silently when the flag is off, when no project or session is selected, when project-open hydration is in progress, when rate-limited, or when the save fails.

**This is an in-app lifecycle autosave trigger only.** It is bounded to the in-app session-terminated boundary. `beforeunload` / `pagehide` / `visibilitychange` / route-away / tab-close handling is explicitly deferred to the separate `C2d-unload` slice, which is not registered or started.

## Scope Statement

C2d-expiry-warn makes one additive change to one existing file. No UI surface was changed. No new helper module was introduced. No existing handlers or effects were modified. No test file required change since no new testable pure-logic path was introduced.

The only modified source file was:

- `frontend/app/[locale]/app/page.tsx`

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty in the working tree from the earlier registration step and were not modified during the implementation step.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Additive only. One new `useEffect` added. |

No other source files were modified.

## Implementation Details

### `frontend/app/[locale]/app/page.tsx` — additive change

One new `useEffect` was added, placed before the existing `selectedSessionIdRef` sync effect. The effect detects the in-app session-expiry boundary and fires a best-effort autosave.

#### Full effect body

```ts
useEffect(() => {
  if (!PROJECT_FIRST_UX) {
    return;
  }

  const token = localStorage.getItem('access_token');
  if (!token) {
    return;
  }

  if (!selectedProjectId) {
    return;
  }

  if (projectOpenInProgressRef.current) {
    return;
  }

  const selectedSessionIdAtExpiryWarning = selectedSessionIdRef.current ?? selectedSessionId;
  if (!selectedSessionIdAtExpiryWarning) {
    return;
  }

  const selectedSessionAtExpiryWarning = sessions.find(
    (session) => session.id === selectedSessionIdAtExpiryWarning,
  );
  if (!selectedSessionAtExpiryWarning?.terminatedAt) {
    return;
  }

  void (async () => {
    const autosaveAttemptedAt = Date.now();
    const autosaveResult = await attemptProjectAutosave({
      token,
      sessionId: selectedSessionIdAtExpiryWarning,
      projectId: selectedProjectId,
      now: autosaveAttemptedAt,
      lastAutosaveAt: lastProjectAutosaveAtRef.current,
    });
    if (autosaveResult.status === 'saved') {
      lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
      void loadWorkspaceSnapshotsForUser(token);
    }
  })();
}, [selectedProjectId, selectedSessionId, sessions]);
```

#### Guard execution order

1. `PROJECT_FIRST_UX` — kill switch; skips when flag is off
2. `token` from `localStorage.getItem('access_token')` — skips if not logged in
3. `selectedProjectId` — skips if no project selected
4. `!projectOpenInProgressRef.current` — skips during project-open hydration
5. `selectedSessionIdRef.current ?? selectedSessionId` — uses the ref-backed session id to see the just-terminated session before `loadSessions()` may have changed `selectedSessionId` to a fallback
6. `sessions.find(...)?.terminatedAt` — skips if the selected session is still active (non-null `terminatedAt` is the in-app terminated-session signal)

#### On `saved`

- `lastProjectAutosaveAtRef.current = autosaveAttemptedAt` — records the timestamp for the next rate-limit check
- `void loadWorkspaceSnapshotsForUser(token)` — best-effort snapshot list reload so the new row appears in the locked `ProjectHistoryPanel`; intentionally `void` so a reload failure cannot surface as an unhandled promise rejection

#### On `skipped-rate-limited` or `failed`

- No-op. The per-minute rate limit (C2a) is the defense against duplicate fires on repeated `sessions` refreshes.

#### Dependency array

`[selectedProjectId, selectedSessionId, sessions]` — the effect re-runs on any of these changing, which is the correct trigger set: the termination is detected reactively via the `sessions` state array being refreshed by `loadSessions`.

### Expiry-detection hook note

- The new effect is placed **before** the `selectedSessionIdRef` sync effect at the top of the effects section in `page.tsx`.
- Session termination is detected via `session.terminatedAt` being truthy in the current `sessions` array. This is the existing in-app signal used throughout `page.tsx` for terminated-session guards (exec, build, checkpoint, revert, diff, compare, etc.).
- `selectedSessionIdRef.current ?? selectedSessionId` is used to read the session id because `loadSessions()` may advance `selectedSessionId` to a fallback before the effect fires. The ref-backed value captures the pre-fallback selection, so the autosave can still see the terminated session's id.
- The effect will re-run every time `sessions` is refreshed. The per-minute rate limit from C2a means only the first re-run within the 60-second window produces a save; subsequent re-runs skip silently.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/project-named-save.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| `frontend/lib/recovery-copy.ts` | Unchanged |
| Named-save flow, label helpers, UI surfaces | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c paths | Unchanged |

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

## Best-Effort Reload Note

Snapshot list reload after a `saved` result is intentionally best-effort: `void loadWorkspaceSnapshotsForUser(token)`. A reload failure cannot propagate as an unhandled promise rejection, matching the identical pattern used in the locked C2b preview-start trigger.

## Preserved Invariants

| Invariant | Status |
|---|---|
| In-app session-terminated boundary only; `beforeunload`/`pagehide`/`visibilitychange`/route-away deferred to C2d-unload | ✅ |
| Reuse locked `attemptProjectAutosave` and `lastProjectAutosaveAtRef`; no new save path | ✅ |
| `projectOpenInProgressRef` guard mandatory | ✅ Present as guard 4 in the effect |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Guard 1 |
| Per-minute rate limit (C2a) protects against duplicate fires | ✅ Delegated to `attemptProjectAutosave` |
| No UI affordance, toast, banner, or new visible status surface | ✅ |
| No `workspace-shell.tsx` change | ✅ |
| No named-save flow or label helper change | ✅ |
| No backend/API/schema change | ✅ |
| No C2d-unload/C2e/C2f, C3, C4, or Phase D/E work | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
