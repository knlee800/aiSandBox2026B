# UX-IA-17A Checkpoint — Visual Edit Checkpoint Labeling

**Task ID:** UX-IA-17A
**Parent:** UX-IA-17 — Visual Edit Undo / Checkpoint Integration
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-19
**Model:** GPT-5.3 Codex (implementation)

---

## Objective

When a visual-edit execution's file actions are applied and the coherence checkpoint is created, use a distinct description string so the checkpoint appears with a visual-edit label in the history timeline. Non-visual-edit executions continue to use the existing `AI_AUTO_CHECKPOINT_DESCRIPTION` label unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/app/[locale]/app/page.tsx` | Added `VISUAL_EDIT_CHECKPOINT_DESCRIPTION` constant; conditional `checkpointDescription` selection inside `maybeRunExecutionCoherence` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added focused unit tests asserting conditional checkpoint description logic and both constants |

**Files NOT changed (confirmed):**
- `frontend/components/workspace/workspace-ai-coherence.logic.ts` — unchanged
- `frontend/components/workspace/workspace-shell.tsx` — unchanged
- All backend files — unchanged
- All checkpoint API call signatures — unchanged

---

## Checkpoint Labeling Summary

### New constant added (`page.tsx`)

```
VISUAL_EDIT_CHECKPOINT_DESCRIPTION = 'Visual Edit: applied file changes'
```

### Conditional logic in `maybeRunExecutionCoherence` (`page.tsx`)

```
const checkpointDescription = visualEditExecutionIdsRef.current.has(executionId)
  ? VISUAL_EDIT_CHECKPOINT_DESCRIPTION
  : AI_AUTO_CHECKPOINT_DESCRIPTION;
```

- Visual-edit executions → `'Visual Edit: applied file changes'`
- Non-visual-edit executions → `'AI: applied workspace file actions'` (existing `AI_AUTO_CHECKPOINT_DESCRIPTION`, unchanged)

### Unchanged call site

`runAiActionCoherence(...)` receives `checkpointDescription` as before — the function signature and its internals are unchanged. Checkpoint API calls are unchanged.

---

## Tests Added

File: `frontend/components/workspace/workspace-shell.test.tsx`

- Assert `VISUAL_EDIT_CHECKPOINT_DESCRIPTION` constant equals `'Visual Edit: applied file changes'`
- Assert `AI_AUTO_CHECKPOINT_DESCRIPTION` constant equals `'AI: applied workspace file actions'`
- Assert visual-edit execution ID causes `checkpointDescription` to resolve to `VISUAL_EDIT_CHECKPOINT_DESCRIPTION`
- Assert non-visual-edit execution ID causes `checkpointDescription` to resolve to `AI_AUTO_CHECKPOINT_DESCRIPTION`

---

## Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend/) | PASS — 0 errors |
| `npm test` (frontend/) | PASS — 374 tests, 374 passed, 0 failed |
| `npm run build` (frontend/) | PASS |
| `ReadLints` on touched files | PASS — 0 new errors |
| `frontend/tsconfig.tsbuildinfo` | Restored |

Baseline before this slice: 370 tests. Tests added by UX-IA-17A: 4. Post-implementation total: 374.

---

## Non-Goals Confirmed

- No UX-IA-17B behavior added: no undo button, no prop threading, no restore UI changes
- No changes to `runAiActionCoherence` internals or signature
- No changes to `workspace-ai-coherence.logic.ts`
- No changes to checkpoint API call structure
- No backend changes
- No auth, route, or i18n changes
- No new dependencies

---

## Invariants Preserved

- `runAiActionCoherence` — unchanged
- `acquireExecutionApplyGuard` apply-once safety — unchanged
- `handleConfirmExecutionFileActions` / `handleCancelExecutionFileActions` — unchanged
- All UX-IA-15 invariants — fully preserved
- All UX-IA-16 invariants — fully preserved

---

## Carry-Forwards to UX-IA-17B

- The `visualEditExecutionIdsRef` ref is readable throughout `page.tsx` including inside `maybeRunExecutionCoherence` — confirmed usable for checkpoint association
- `runAiActionCoherence` returns `{ checkpointCreated: boolean; commitHash?: string }` — the `commitHash` is available for UX-IA-17B's `visualEditCheckpointByExecutionIdRef` storage
- `onInitiateCheckpointRevert(checkpointId)` multi-step flow is confirmed as the correct undo delegation target — no new mechanism needed

---

## Next Task

**UX-IA-17B — Visual Edit Undo Affordance** (ACTIVE — current stage)

- Surface an Undo/Revert button in `WorkspaceAssistantFileActionSummary` post-apply result area for visual-edit executions
- Wire button to `onInitiateCheckpointRevert(checkpointId)`
- Thread checkpoint ID from `page.tsx` to `WorkspaceAssistantFileActionSummary` via new optional prop
- Preserve non-visual-edit file-action result display unchanged
- Checkpoint: `docs/UX-IA-17B-CHECKPOINT.md` (pending)

---

## Acceptance Checks

- UX-IA-17A registered in TASKS.md and TASKS_BACKLOG_FULL.md — DONE
- Status set to ACTIVE — DONE
- Scope, non-goals, files, and validation plan recorded — DONE
- Implementation complete and validated — DONE (tsc PASS, 374/374 tests PASS, build PASS, lints PASS)
- `docs/UX-IA-17A-CHECKPOINT.md` created — DONE

**Reference:** See `TASKS.md` -> UX-IA-17A. Parent: UX-IA-17. Depends on: `docs/UX-IA-16-CHECKPOINT.md`.
