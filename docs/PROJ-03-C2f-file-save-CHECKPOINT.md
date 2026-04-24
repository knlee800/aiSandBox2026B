# PROJ-03-C2f-file-save CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2f-file-save
- Title: Add User-File-Save Autosave Trigger Behind Feature Flag
- Nature: FRONTEND / PHASE C AUTOSAVE TRIGGER — USER FILE SAVE
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2f-file-save-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2f first slice: user file-save boundary trigger
- Depends on: PROJ-03-C2e (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, after the user successfully saves a file via `handleSaveWorkspaceFile`, attempt one project-scoped autosave snapshot using the locked `attemptProjectAutosave` helper and the existing `lastProjectAutosaveAtRef` rate-limit ref. Skip silently when the flag is off, when guards fail, or when rate-limited.

## Scope Statement

C2f-file-save makes one small additive change to one existing file. No new refs, constants, helper modules, UI, or tests were added.

The only modified source file was:

- `frontend/app/[locale]/app/page.tsx`

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty in the working tree from the earlier registration step and were not modified during the implementation step.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Additive only. One guarded autosave block added inside `handleSaveWorkspaceFile`. |

No other source files were modified.

## Implementation Details

### `frontend/app/[locale]/app/page.tsx` — additive change

One small autosave block was added inside `handleSaveWorkspaceFile`, in the `try` branch success path.

#### Placement

The block is inserted immediately after all three of:

1. The stale-request guard: `if (fileSaveRequestIdRef.current !== requestId) { return; }`
2. `setSavedFileContent(selectedFileContent)`
3. `setFileSaveState('saved')`
4. `setFileSaveError(null)`

This ensures the trigger fires only for a confirmed, non-superseded, fully acknowledged file save. If `writeWorkspaceFile` throws, the block is never reached (execution jumps to `catch`). If the save was superseded by a newer request, the early-return guard above fires before the block.

#### Full block

```ts
if (PROJECT_FIRST_UX && selectedProjectId && !projectOpenInProgressRef.current) {
  const autosaveAttemptedAt = Date.now();
  const autosaveResult = await attemptProjectAutosave({
    token,
    sessionId: selectedSessionId,
    projectId: selectedProjectId,
    now: autosaveAttemptedAt,
    lastAutosaveAt: lastProjectAutosaveAtRef.current,
  });
  if (autosaveResult.status === 'saved') {
    lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
    void loadWorkspaceSnapshotsForUser(token);
  }
}
```

#### Guard execution order

1. `PROJECT_FIRST_UX` — kill switch; skips when flag is off
2. `selectedProjectId` — skips if no project selected
3. `!projectOpenInProgressRef.current` — skips during project-open hydration
4. `token` — already fetched and validated non-null at the top of `handleSaveWorkspaceFile`
5. `selectedSessionId` — already validated non-null by the handler's precondition check at line 3737

#### On `saved`

- `lastProjectAutosaveAtRef.current = autosaveAttemptedAt` — records the timestamp for the next rate-limit check
- `void loadWorkspaceSnapshotsForUser(token)` — best-effort snapshot list reload so the new row appears in the locked `ProjectHistoryPanel`; intentionally `void` so a reload failure cannot surface as an unhandled promise rejection and cannot interfere with the file-save success path

#### On `skipped-rate-limited` or `failed`

- No-op. The per-minute rate limit (C2a) prevents duplicate snapshots on rapid Ctrl+S presses.

### File-save boundary hook note

- The chosen hook is the existing successful file-save boundary inside `handleSaveWorkspaceFile`, after the stale-request guard has already passed and after the saved-state updates have completed.
- This keeps the trigger tightly bounded to actual persisted user file writes — content that is already committed to the container filesystem. Unsaved editor buffer changes (`handleWorkspaceEditorContentChange`) are explicitly not covered, matching the C2f-file-save non-goal list.
- Snapshot reload remains intentionally best-effort via `void loadWorkspaceSnapshotsForUser(token)`, matching the identical pattern used in C2b, C2d-expiry-warn, and C2e.

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
| All locked Phase A/B/C1/C2a/C2b/C2c/C2d-expiry-warn/C2e paths | Unchanged |

No tests were added. No helper or logic modules were changed. No new refs or constants were introduced.

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
| Bounded to successful file-save boundary only; autosave placed after stale-request guard | ✅ |
| No timer-based idle debounce; no max-deferral behavior | ✅ |
| No debounce on editor keystrokes / unsaved Monaco buffer changes | ✅ |
| No unload/close lifecycle handling | ✅ |
| No C2f-idle-timer | ✅ |
| No C2d-unload | ✅ |
| No C3 / C4 / Phase D/E work | ✅ |
| Snapshot reload best-effort; cannot interfere with file-save success path | ✅ |
| Reuse locked `attemptProjectAutosave` and `lastProjectAutosaveAtRef`; no new save path | ✅ |
| Per-minute rate limit (C2a) protects against rapid Ctrl+S duplicates | ✅ Delegated to `attemptProjectAutosave` |
| `projectOpenInProgressRef` guard mandatory | ✅ Guard 3 in the block |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Guard 1 |
| No UI affordance, toast, banner, or new visible status surface | ✅ |
| No `workspace-shell.tsx` change | ✅ |
| No named-save flow or label helper change | ✅ |
| No backend/API/schema change | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
