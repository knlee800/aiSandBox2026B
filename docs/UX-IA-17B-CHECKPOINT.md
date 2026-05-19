# UX-IA-17B Checkpoint — Visual Edit Undo Affordance

**Task ID:** UX-IA-17B
**Parent:** UX-IA-17 — Visual Edit Undo / Checkpoint Integration
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-19
**Model:** GPT-5.3 Codex (implementation)

---

## Objective

After a visual-edit apply succeeds, surface an Undo/Revert button in the `WorkspaceAssistantFileActionSummary` post-apply result area. The button delegates to the existing `onInitiateCheckpointRevert` multi-step confirmation flow. Non-visual-edit file-action UI is preserved unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/app/[locale]/app/page.tsx` | Added `visualEditCheckpointByExecutionIdRef`; captured `commitHash` from `runAiActionCoherence` return for visual-edit executions; stored `executionId → commitHash` mapping after coherence returns; cleared mapping on reset; passed `visualEditCheckpointByExecutionId` into `WorkspaceShell` |
| `frontend/components/workspace/workspace-shell.tsx` | Threaded `visualEditCheckpointByExecutionId` and `onInitiateCheckpointRevert` props to `WorkspaceChatPanel`; added `onUndoVisualEdit` prop to `WorkspaceAssistantFileActionSummary`; added Undo/Revert button (`data-testid="workspace-chat-file-actions-undo-visual-edit"`) rendered only for visual-edit executions with `applyStatus === "applied"` and a valid checkpoint/revert callback |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added tests: undo button renders for visual-edit post-apply; button absent for non-visual-edit; wiring assertion for `onUndoVisualEdit` callback |

**Files NOT changed (confirmed):**
- `frontend/components/workspace/workspace-ai-coherence.logic.ts` — unchanged
- All backend files — unchanged
- All checkpoint API call signatures — unchanged
- `handleInitiateCheckpointRevert` / `handleConfirmCheckpointRevert` — unchanged

---

## CommitHash Tracking Summary

### New ref added (`page.tsx`)

```
visualEditCheckpointByExecutionIdRef: React.MutableRefObject<Record<string, string>>
```

- Initialized as empty object `{}`
- Populated inside the existing `createCheckpoint` callback after `runAiActionCoherence` returns for visual-edit executions:
  - `visualEditCheckpointByExecutionIdRef.current[executionId] = commitHash`
- Cleared to `{}` on session reset
- Passed into `WorkspaceShell` as `visualEditCheckpointByExecutionId`

### Prop threading path

```
page.tsx (visualEditCheckpointByExecutionIdRef)
  → WorkspaceShell (visualEditCheckpointByExecutionId prop)
    → WorkspaceChatPanel (visualEditCheckpointByExecutionId + onInitiateCheckpointRevert props)
      → WorkspaceAssistantFileActionSummary (onUndoVisualEdit callback)
```

---

## Undo Affordance Summary

### Button characteristics

- `data-testid="workspace-chat-file-actions-undo-visual-edit"`
- Renders only when all three conditions are true:
  1. Execution is a visual-edit execution
  2. `applyStatus === "applied"`
  3. A `commitHash` exists in `visualEditCheckpointByExecutionId` for this `executionId` AND `onInitiateCheckpointRevert` callback exists
- Hidden/absent for all non-visual-edit file-action results
- Calls `onInitiateCheckpointRevert(checkpointId)` — delegates to the existing multi-step revert confirmation dialog

### Undo behavior

- No direct DOM rollback
- No automatic undo
- Calls the existing `onInitiateCheckpointRevert` flow which opens the multi-step confirmation dialog
- User must confirm before any revert is applied
- No bypass of checkpoint restore confirmation

---

## Restore Safety Summary

- Undo button wires to `onInitiateCheckpointRevert(checkpointId)` — identical path as the history panel "Revert" action
- No new restore mechanism introduced
- Multi-step confirmation dialog is the same dialog used for all checkpoint reverts
- `handleInitiateCheckpointRevert` / `handleConfirmCheckpointRevert` — unchanged
- `acquireExecutionApplyGuard` apply-once safety — unchanged

---

## UX/UI Advisory Note

Impeccable / Emil design guidance was applied lightly and narrowly:
- Button placement was kept restrained — appended to the post-apply file-action summary area, not promoted to a primary action
- No redesign or new interaction model was introduced
- No changes to the confirmation dialog or revert flow styling
- Button visibility logic (render-only-when-safe) was kept conservative

---

## Tests Added

File: `frontend/components/workspace/workspace-shell.test.tsx`

- Assert undo button (`data-testid="workspace-chat-file-actions-undo-visual-edit"`) renders for a visual-edit execution with `applyStatus === "applied"` and a valid `commitHash`
- Assert undo button is absent for a non-visual-edit execution (even with `applyStatus === "applied"`)
- Assert undo button is absent when no `commitHash` exists for the execution
- Assert `onUndoVisualEdit` callback is invoked when button is clicked

Baseline before UX-IA-17B: 374 tests (post UX-IA-17A). Tests added by UX-IA-17B: 9. Post-implementation total: 383.

---

## Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend/) | PASS — 0 errors |
| `npm test` (frontend/) | PASS — 383 tests, 383 passed, 0 failed |
| `npm run build` (frontend/) | PASS |
| `ReadLints` on touched files | PASS — 0 new errors |
| `frontend/tsconfig.tsbuildinfo` | Restored |

---

## Non-Goals Confirmed

- No direct DOM rollback
- No automatic undo without user confirmation
- No bypass of checkpoint revert confirmation flow
- No backend or API changes
- No new revert mechanism — `onInitiateCheckpointRevert` reused as-is
- No auth, route, or i18n changes
- No new dependencies
- No redesign of `WorkspaceAssistantFileActionSummary` for non-visual-edit cases

---

## Invariants Preserved

- `handleInitiateCheckpointRevert` / `handleConfirmCheckpointRevert` — unchanged
- `acquireExecutionApplyGuard` apply-once safety — unchanged
- Non-visual-edit `WorkspaceAssistantFileActionSummary` rendering — unchanged
- `runAiActionCoherence` interface and implementation — unchanged
- `AI_AUTO_CHECKPOINT_DESCRIPTION` — unchanged
- All UX-IA-15 invariants — fully preserved
- All UX-IA-16 invariants — fully preserved
- All UX-IA-17A invariants — fully preserved

---

## Carry-Forwards

- UX-IA-17 parent is now fully complete — both child slices COMPLETE and LOCKED
- `visualEditCheckpointByExecutionIdRef` pattern (executionId → commitHash mapping) is available as a reference for any future execution-scoped metadata needs
- No technical debt introduced; undo affordance is fully scoped to visual-edit executions

---

## Acceptance Checks

- UX-IA-17B registered in TASKS.md and TASKS_BACKLOG_FULL.md — DONE
- Status set to ACTIVE — DONE
- Implementation complete and validated — DONE (tsc PASS, 383/383 tests PASS, build PASS, lints PASS)
- `docs/UX-IA-17B-CHECKPOINT.md` created — DONE

**Reference:** See `TASKS.md` -> UX-IA-17B. Parent: UX-IA-17. Depends on: `docs/UX-IA-17A-CHECKPOINT.md`.
