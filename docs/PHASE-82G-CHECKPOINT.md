# PHASE-82G-CHECKPOINT.md

## Metadata

**Phase:** 82  
**Stage:** 82G  
**Task ID:** TASK-82G  
**Title:** History Surface Preset Reset Slice  
**Status:** COMPLETE and LOCKED  
**Date:** 2026-03-16  
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)

---

## 1. Objective

Add a bounded reset-to-default visibility preset control to the existing history control surface so users can recover from temporary visibility preset changes without altering underlying history actions.

---

## 2. Input Artifacts Reviewed

- `CLAUDE.md`
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/PHASE-82F-CHECKPOINT.md`

---

## 3. Implemented Scope

All TASK-82G changes are localized to `HistoryCheckpointList` in `frontend/components/workspace/workspace-shell.tsx`, plus focused tests.

### 3.1 Added Compact Reset-to-Default Visibility Preset Control

Added a compact reset control in the existing `history-section-visibility-preset-controls` surface:

- `data-testid="history-section-visibility-preset-reset-default"`

Behavior:

- Resets visibility/collapse presentation state to bounded default (all major history sections expanded).
- Uses only existing in-session `collapsedHistorySections` frontend state.
- Reset is disabled while default visibility state is already active.
- No backend access, no schema changes, and no fetches.

### 3.2 Added Bounded Default Visibility Preset Helper

Added helper export:

- `getDefaultHistorySectionVisibilityPresetState()`

Behavior:

- Returns a bounded default collapsed-section map for existing history section keys:
  - `controls`
  - `summaries`
  - `inspectors`
  - `checkpoint-browser`
- Reuses already-derived frontend state from TASK-82A through TASK-82F.

### 3.3 Updated Active Preset Indicator

Updated active visibility preset indicator behavior:

- Reports `Default` when section visibility state matches bounded default.
- Continues to report `Overview-Oriented`, `Inspection-Oriented`, or `Custom` for non-default states.

### 3.4 Preserved Existing History Behaviors

All existing history/control actions remain unchanged, including:

- section collapse/expand controls and per-section toggles
- section ordering controls and reset from TASK-82D/TASK-82E
- visibility presets from TASK-82F
- search/filter/reset controls
- compare, diff, snapshot, open-in-live, and revert flows
- timeline, checkpoint browser, inspectors, working set, density, and focus mode

---

## 4. Files Changed

| File | Type | Summary |
|------|------|---------|
| `frontend/components/workspace/workspace-shell.tsx` | UPDATED | Added reset-to-default visibility preset control, bounded default visibility helper, and default-aware active preset label in existing history section controls. |
| `frontend/components/workspace/workspace-shell.test.tsx` | UPDATED | Extended history section control rendering assertions for reset-default visibility control and added helper test for bounded default visibility state. |
| `docs/PHASE-82G-CHECKPOINT.md` | NEW | TASK-82G checkpoint documentation. |

---

## 5. Tests Run and Results

**Command:** `npm test` (from `frontend/`)  
**Runner:** `npx tsx --test components/workspace/*.test.ts* components/public/*.test.ts*`  
**Result:** PASS

**Suite totals:** 100 passing, 0 failing (baseline 99; net +1).

---

## 6. Validation Against Acceptance Criteria

| Acceptance Criterion | Result |
|----------------------|--------|
| User can reset section visibility preset state back to default inside existing `history-control-slice` | PASS |
| Behavior uses only existing frontend state and already-loaded checkpoint data | PASS |
| Active-session scoping preserved | PASS |
| All closed Phase 81 surfaces and TASK-82A/TASK-82F behavior remain intact | PASS |
| No backend/schema/endpoint/refactor/fetch/polling/websocket changes | PASS |
| Test baseline stays green or increases | PASS |

---

## 7. Constraints and Invariants Confirmation

- Frontend-only changes
- Additive-only updates
- No backend/schema/endpoint changes
- No refactors outside this slice
- No new fetches
- No durable state outside active session
- No polling/websocket behavior
- No follow-up slice started

---

## 8. Sign-Off

**Task:** TASK-82G  
**Status:** COMPLETE and LOCKED  
**Checkpoint:** `docs/PHASE-82G-CHECKPOINT.md`  
**Validated:** 2026-03-16  
**Test gate:** ✅ 100/100 passing (baseline 99; net +1)  
**Lint gate:** ✅ no linter errors in changed files  
**Scope gate:** ✅ frontend-only, additive, no backend/schema/endpoint/refactor/fetch/polling/websocket changes
