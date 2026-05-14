# UX-IA-16 Checkpoint — Visual Edit AI Patch Flow

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-16
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Completed:** 2026-05-14
**Checkpoint file:** `docs/UX-IA-16-CHECKPOINT.md`
**Upstream checkpoint:** `docs/UX-IA-15-CHECKPOINT.md`
**Next task:** UX-IA-17 — Visual Edit Undo / Checkpoint Integration

---

## Objective

Wire the visual-edit element selection context (captured in UX-IA-15) into the AI patch request cycle. Ensure AI-proposed file changes triggered by visual-edit mode flow through the existing AI-WS file-action confirmation flow with a diff preview, without bypassing any safety rules.

---

## Child Slice Summary

### UX-IA-16A — Visual Edit Prompt Contract + Force-Confirmation
**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-16A-CHECKPOINT.md`
**Completed:** 2026-05-14

Enhanced the visual-edit prompt contract so the AI receives directive instructions to identify source files and propose focused file-action patches. All visual-edit-sourced executions are forced through the existing file-action confirmation dialog regardless of batch size or risk classification.

Key deliverables:
- `buildPromptWithSelectedPreviewElement` enhanced with `[Visual Edit Mode Contract]` instruction block in `workspace-preview.logic.ts`
- `visualEditExecutionIdsRef` (`useRef<Set<string>>`) added in `page.tsx`; recorded on submit in both orchestration and non-orchestration paths; checked in `maybeApplyExecutionFileActions` before `isRiskyFileActionBatch`; cleared on chat reset
- `visualEditExecutionIds` prop threaded from `page.tsx` → `WorkspaceShell` → `WorkspaceChatPanel` → `WorkspaceAssistantFileActionSummary`
- Minimal visual-edit attribution label added to `WorkspaceAssistantFileActionSummary` for visual-edit executions (`data-testid="workspace-chat-file-actions-visual-edit-attribution"`)
- 3 new tests (prompt contract, attribution render, static page-source assertions); 356 tests total after 16A

### UX-IA-16B — Visual Edit Diff Preview in Confirmation UI
**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-16B-CHECKPOINT.md`
**Completed:** 2026-05-14

Added a pure frontend line-level diff computation helper and wired it into the visual-edit awaiting-confirmation block so the user can review proposed source changes before approving.

Key deliverables:
- `workspace-diff.logic.ts` (new) — `computeLineDiff` pure helper using LCS backtracking; 3-line context window; 200-line output cap; `DIFF_MAX_LINES` constant; `LineDiff` and `FileDiffResult` types
- `workspace-diff.logic.test.ts` (new) — 8 pure unit tests covering all diff cases
- `WorkspaceAssistantFileActionSummary` in `workspace-shell.tsx` — added `selectedSessionId` prop; `useEffect` for visual-edit diff fetch using existing `readWorkspaceFile`; `diffState` and `fileDiffResults` local state; full testid suite for diff preview states
- `workspace-shell.test.tsx` — updated risky-batch test + 6 new tests; 370 tests total after 16B

---

## Final Visual Edit AI Patch Flow Summary

The full Visual Edit AI Patch Flow is complete. The end-to-end flow is:

1. **Element selection** — user activates picker, clicks an element in the preview iframe; `selectedPreviewElement` is captured and forwarded to `page.tsx` via `onPreviewElementSelected` (UX-IA-15).
2. **Prompt context injection** — when the user submits a prompt, `buildPromptWithSelectedPreviewElement` prepends the `[Visual Edit Context]` metadata block and the `[Visual Edit Mode Contract]` instruction block; the chat thread shows the original user-visible message (UX-IA-15C / UX-IA-16A).
3. **Execution ID tracking** — the resulting execution ID is recorded in `visualEditExecutionIdsRef` before `consumeExecutionFileActions` is called in both orchestration and non-orchestration paths (UX-IA-16A).
4. **Force-confirmation** — `maybeApplyExecutionFileActions` checks `visualEditExecutionIdsRef` before `isRiskyFileActionBatch`; visual-edit executions always enter `awaiting-confirmation` regardless of batch size or risk level (UX-IA-16A).
5. **Diff preview** — when the confirmation UI renders for a visual-edit execution, `WorkspaceAssistantFileActionSummary` fetches current file content via `readWorkspaceFile` and computes a line-level diff using `computeLineDiff`; the preview shows added/removed/context lines per file (UX-IA-16B).
6. **User decision** — the user reviews the diff and clicks Apply or Cancel; existing `handleConfirmExecutionFileActions` / `handleCancelExecutionFileActions` handlers run unchanged (UX-IA-15 / UX-IA-16A preserved).
7. **Apply and coherence** — on confirm, `applySequentialFileActions` applies file changes; `maybeRunExecutionCoherence` triggers file tree refresh, preview refresh, checkpoint creation, and autosave as before (unchanged across UX-IA-16).

---

## Files Changed Across UX-IA-16

| File | Changed In | Summary |
|---|---|---|
| `frontend/components/workspace/workspace-preview.logic.ts` | 16A | Enhanced `buildPromptWithSelectedPreviewElement` with Visual Edit Mode Contract block |
| `frontend/app/[locale]/app/page.tsx` | 16A | Added `visualEditExecutionIdsRef`; recorded on submit (both paths); checked in `maybeApplyExecutionFileActions`; cleared on reset; passed `visualEditExecutionIds` prop |
| `frontend/components/workspace/workspace-shell.tsx` | 16A, 16B | Added `visualEditExecutionIds` prop and attribution label (16A); added `selectedSessionId` prop to `WorkspaceAssistantFileActionSummary`, diff fetch effect, and diff preview rendering (16B) |
| `frontend/components/workspace/workspace-shell.test.tsx` | 16A, 16B | 3 new tests in 16A (+3); 6 new/updated tests in 16B (+11 net); 370 total |
| `frontend/components/workspace/workspace-diff.logic.ts` | 16B | **NEW** — pure diff helper |
| `frontend/components/workspace/workspace-diff.logic.test.ts` | 16B | **NEW** — 8 pure unit tests for diff helper |

**No backend files. No auth files. No i18n files. No route changes.**

---

## Final Validation Summary

| Command | Result |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS — 0 errors |
| `npm test` (frontend) | PASS — 370 tests, 370 passed, 0 failed |
| `npm run build` (frontend) | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed — build artifact cleaned |
| `ReadLints` on all touched files | PASS — 0 linter errors |

Test baseline before UX-IA-16: **353 tests** (end of UX-IA-15). Final count after UX-IA-16: **370 tests** (+17 across both child slices).

---

## Non-Goals Confirmed

The following were explicitly NOT implemented across UX-IA-16:

- No backend or API changes
- No new npm dependencies
- No automatic patch application without confirmation
- No bypass of file-action confirmation flow
- No changes to non-visual-edit confirmation behavior
- No full side-by-side diff editor
- No Visual Edit drag/drop inline editor
- No direct DOM mutation as final output
- No auth changes
- No route changes
- No billing changes
- No changes to picker script, postMessage listener, or any UX-IA-15 wiring

---

## Invariants Preserved

| Invariant | Status |
|---|---|
| UX-IA-08: project mode locked inside `workspace-shell.tsx` | Fully preserved |
| UX-IA-10: preview iframe `src`, `fillHeight`, and layout wiring | Unchanged |
| UX-IA-15A/15B/15C: types, helpers, postMessage listener, prompt prefix shape | Fully preserved |
| `isRiskyFileActionBatch` logic for non-visual-edit executions | Unchanged |
| `acquireExecutionApplyGuard` apply-once safety | Unchanged |
| `applySequentialFileActions` per-action session validation | Unchanged |
| `maybeRunExecutionCoherence` (file tree refresh, preview refresh, checkpoint, autosave) | Unchanged |
| Cancel path (`handleCancelExecutionFileActions`) | Unchanged |
| Confirm path (`handleConfirmExecutionFileActions`) | Unchanged |
| All UX-IA-04 through UX-IA-15 `data-testid` contracts and component interfaces | Unaffected |
| `buildPromptWithSelectedPreviewElement` null behavior | Unchanged — returns original prompt when no element |
| Chat thread display | Shows original (non-prefixed) user prompt; no user-visible contamination |

---

## Carry-Forwards to UX-IA-17

- The full visual-edit round-trip is validated and locked: picker → selection → prompt injection → force-confirmation → diff preview → apply/cancel.
- `visualEditExecutionIdsRef` is the stable tracking mechanism for identifying visual-edit executions. UX-IA-17 can read from it if undo/checkpoint integration requires knowing whether a confirmation event was visual-edit-sourced.
- `computeLineDiff` and `readWorkspaceFile` are the stable file-diff primitives. UX-IA-17 may reuse them if pre-apply diff snapshotting is needed.
- `maybeRunExecutionCoherence` already triggers checkpoint creation on apply. UX-IA-17 can hook into or extend that checkpoint path for undo support.
- Manual end-to-end validation (DevTools prompt inspection, single-file safe-write diff + confirm flow) is deferred to the product team.

---

## Next Recommended Task

**UX-IA-17 — Visual Edit Undo / Checkpoint Integration**

Status: PENDING (requires UX-IA-16 COMPLETE — now satisfied)

Scope: Integrate visual-edit confirmation apply/cancel with the existing checkpoint system; allow the user to undo a visual-edit-applied change by reverting to the pre-apply checkpoint; ensure the undo path does not bypass any existing session or safety constraints.
