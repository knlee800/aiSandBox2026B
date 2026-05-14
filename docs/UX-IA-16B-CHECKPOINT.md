# UX-IA-16B Checkpoint — Visual Edit Diff Preview in Confirmation UI

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-16B
**Parent:** UX-IA-16 — Visual Edit AI Patch Flow
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Completed:** 2026-05-14
**Checkpoint file:** `docs/UX-IA-16B-CHECKPOINT.md`
**Upstream checkpoint:** `docs/UX-IA-16A-CHECKPOINT.md`
**Next task:** UX-IA-17 — Visual Edit Undo / Checkpoint Integration

---

## Objective

When a visual-edit execution reaches `awaiting-confirmation`, display a line-level diff preview of the proposed file changes inside the existing confirmation UI so the user can review source diffs before approving. Compute the diff purely in the frontend using the existing session file-read API. Non-visual-edit confirmation behavior is preserved unchanged.

---

## Exact Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-diff.logic.ts` | **NEW** — pure `computeLineDiff` helper, `LineDiff` type, `FileDiffResult` type, `DIFF_MAX_LINES` constant |
| `frontend/components/workspace/workspace-diff.logic.test.ts` | **NEW** — pure unit tests for diff helper |
| `frontend/components/workspace/workspace-shell.tsx` | Added `selectedSessionId` prop to `WorkspaceAssistantFileActionSummary`; added diff fetch `useEffect` and local state; added diff preview rendering inside the visual-edit awaiting-confirmation block |
| `frontend/components/workspace/workspace-shell.test.tsx` | Updated risky-batch confirmation test; added visual-edit diff loading, non-visual isolation, and source/wiring assertion tests |

No other files were changed. No backend files. No auth files. No i18n files. No governance docs changed during implementation.

---

## Diff Helper Summary

### New file: `workspace-diff.logic.ts`

**Exports:**

- `LineDiff` — interface with `type: 'added' | 'removed' | 'context'`, `lineNumber: number`, `content: string`
- `FileDiffResult` — interface with `path: string`, `action: 'create' | 'write' | 'update' | 'delete'`, `lines: LineDiff[]`, `truncated: boolean`
- `DIFF_MAX_LINES = 200`
- `computeLineDiff(currentContent: string, proposedContent: string): { lines: LineDiff[]; truncated: boolean }`

**Algorithm:**

1. Split both strings on `\n` to produce line arrays.
2. Build an LCS (Longest Common Subsequence) table from both line arrays.
3. Backtrack through the LCS table to produce a full `InternalDiffLine[]` sequence with type `'added' | 'removed' | 'context'`.
4. Collect only changed regions with ±3 lines of surrounding context.
5. Cap the windowed output at `DIFF_MAX_LINES = 200` lines; set `truncated: true` when exceeded.
6. Empty `currentContent` → all proposed lines are `'added'`.
7. Empty `proposedContent` → all current lines are `'removed'`.

**No imports** from other workspace files. No fetch. No React. Pure TypeScript only.

---

## File-Read / Diff Fetch Summary

### What changed in `workspace-shell.tsx`

**Import additions:**

- `readWorkspaceFile` imported (value import, not type-only) from `workspace-file-navigation.logic`.
- `{ DIFF_MAX_LINES, computeLineDiff, type FileDiffResult }` imported from `workspace-diff.logic`.

**New prop on `WorkspaceAssistantFileActionSummary`:**

```typescript
selectedSessionId: string | null
```

Threaded from `WorkspaceChatPanel` at the existing call site — `WorkspaceChatPanel` already held `selectedSessionId`.

**New local state in `WorkspaceAssistantFileActionSummary`:**

```typescript
const [diffState, setDiffState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>(...)
const [fileDiffResults, setFileDiffResults] = React.useState<FileDiffResult[]>([])
```

Initial `diffState` is `'loading'` when `isVisualEditAwaitingConfirmation` is true on mount; `'idle'` otherwise.

**New `useEffect` guard:**

Effect fires only when:
- `isVisualEditAwaitingConfirmation === true` (computed from `isVisualEditExecution && applyStatus === 'awaiting-confirmation'`)
- `selectedSessionId` is non-null

**Per-action fetch behavior:**

| Action | Behavior |
|---|---|
| `create` | No read call; computes diff from `''` (empty) → `action.content` — all lines are added |
| `write` / `update` | Calls `readWorkspaceFile({ sessionId, filePath: action.path })`; on success diffs current against `action.content` |
| `delete` | Tries `readWorkspaceFile`; on read failure falls back to `''`; diffs current → `''` — all lines are removed |

**Resilience:**

- `Promise.allSettled` — one failed read does not cancel the remaining fetches.
- Any `rejected` settled result: `diffState` is set to `'error'` after the batch settles; successfully fetched diffs are still shown.
- Unmount/cancel guard: `let cancelled = true; return () => { cancelled = true; }` prevents stale state updates after component unmount.

**Effect dependencies:** `[isVisualEditAwaitingConfirmation, fileActionState.fileActions, fileActionState.executionId, selectedSessionId]`

### What was not changed

- `readWorkspaceFile` itself — used as-is; no changes to `workspace-file-navigation.logic.ts`.
- `page.tsx` — `selectedSessionId` was already threaded through `WorkspaceChatPanel` props; no additional threading needed at the page level.

---

## Confirmation UI Summary

### What was added inside `WorkspaceAssistantFileActionSummary`

Visual-edit diff preview is rendered only when `isVisualEditAwaitingConfirmation` is true, inside the existing amber awaiting-confirmation block, between the attribution label (from UX-IA-16A) and the existing file path list.

**Render order inside the amber block (unchanged structure):**

1. "Approval required before applying risky file actions." heading
2. *(visual-edit only)* Diff preview state:
   - `diffState === 'loading'` → `<p data-testid="workspace-chat-file-actions-diff-loading">Loading diff preview...</p>`
   - `diffState === 'error'` → `<p data-testid="workspace-chat-file-actions-diff-error">Diff preview unavailable for one or more files. You can still apply or cancel.</p>`
   - `diffState === 'ready'` → renders `fileDiffResults` per file:
     - `create`/`write`/`update` actions → `data-testid="workspace-chat-file-actions-diff-create"` or `"workspace-chat-file-actions-diff-update"` with inline diff lines (added green, removed red, context gray)
     - `delete` actions → `data-testid="workspace-chat-file-actions-diff-delete"` with `[file will be deleted]` marker
     - `truncated: true` → appended note: "Diff truncated to the first 200 lines."
3. Existing file path list (`data-testid="workspace-chat-file-actions-awaiting-list"`) — unchanged
4. Apply button (`data-testid="workspace-chat-file-actions-confirm-button"`) — unchanged
5. Cancel button (`data-testid="workspace-chat-file-actions-cancel-button"`) — unchanged

### What was not changed

- Non-visual-edit awaiting-confirmation block — unchanged; no diff preview rendered.
- Attribution label position and content — unchanged (UX-IA-16A deliverable preserved).
- Apply/Cancel button wiring — unchanged.
- `confirmationRequired`, `handleConfirmExecutionFileActions`, `handleCancelExecutionFileActions` — all unchanged.

---

## Test Summary

### New: `workspace-diff.logic.test.ts`

Pure unit tests — no DOM, no fetch.

| Test | Assertion |
|---|---|
| identical content | `lines.length === 0`, `truncated === false` |
| added line | `lines` contains `{ type: 'added', content: 'bravo' }` |
| removed line | `lines` contains `{ type: 'removed', content: 'bravo' }` |
| mixed add/remove | both removed `'b'` and added `'x'` present |
| empty current content | all lines `type === 'added'`; content matches proposed lines |
| empty proposed content | all lines `type === 'removed'`; content matches current lines |
| truncation cap | `truncated === true`; `lines.length === DIFF_MAX_LINES` |
| context window | context lines at distance ≤3 from change included; lines outside excluded |

### Updated: `workspace-shell.test.tsx`

| Test | Change |
|---|---|
| `renders confirmation notice for risky assistant file-action batches` | Updated — added `doesNotMatch` for all 5 diff testids |
| `renders diff loading state for visual-edit awaiting-confirmation execution` | **NEW** — visual-edit `awaiting-confirmation` → `diff-loading` present; diff-update/create/delete absent |
| `does not render diff for non-visual-edit awaiting-confirmation execution` | **NEW** — confirms zero diff testids appear in non-visual confirmation path |
| `renders diff preview for visual-edit update action` | **NEW** (source assertion) — `workspace-chat-file-actions-diff-update` present in shell source |
| `renders create diff marker` | **NEW** (source assertion) — `workspace-chat-file-actions-diff-create` present in shell source |
| `renders delete diff marker` | **NEW** (source assertion) — `[file will be deleted]` present in shell source |
| `renders diff error state gracefully when file read fails` | **NEW** (source assertion) — `Promise.allSettled`, error-state setter, `diff-error` testid present in shell source |

### Existing tests preserved

All 356 tests from UX-IA-16A baseline pass unchanged. No test was removed or restructured.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` (from `frontend/`) | PASS — 0 errors |
| `npm test` (from `frontend/`) | PASS — 370 tests, 370 passed, 0 failed |
| `npm run build` (from `frontend/`) | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed after build |
| `ReadLints` on all touched files | PASS — 0 linter errors |

Test baseline before UX-IA-16B: **356 tests**. Final count: **370 tests** (+14 across diff logic and shell tests).

---

## Non-Goals Confirmed

- No backend or API changes.
- No new npm dependencies.
- No automatic apply of file actions.
- No bypass of file-action confirmation flow.
- No changes to non-visual-edit confirmation behavior.
- No full side-by-side diff editor.
- No direct DOM mutation.
- No route or auth changes.
- No i18n file changes.
- No changes to `workspace-preview.logic.ts`.
- No changes to `workspace-file-navigation.logic.ts`.
- No changes to `page.tsx`.
- No checkpoint or governance files changed during implementation.

---

## Invariants Preserved

| Invariant | Status |
|---|---|
| UX-IA-16A: `visualEditExecutionIdsRef`, force-confirmation check, `visualEditExecutionIds` prop thread | Fully preserved |
| UX-IA-15A/15B/15C: types, helpers, postMessage listener, prompt prefix shape | Fully preserved |
| `isRiskyFileActionBatch` logic for non-visual-edit executions | Unchanged |
| `acquireExecutionApplyGuard` apply-once safety | Unchanged |
| `applySequentialFileActions` per-action session validation | Unchanged |
| `maybeRunExecutionCoherence` (file tree refresh, preview refresh, checkpoint, autosave) | Unchanged |
| Cancel path (`handleCancelExecutionFileActions`) | Unchanged |
| Confirm path (`handleConfirmExecutionFileActions`) | Unchanged |
| All UX-IA-04 through UX-IA-15 `data-testid` contracts and component interfaces | Unaffected |
| `buildPromptWithSelectedPreviewElement` null behavior | Unchanged |

---

## Carry-Forwards

- `readWorkspaceFile` is now used in two paths: the existing Monaco editor file-open flow and the new visual-edit diff fetch. Both use the same API endpoint; no conflict.
- The diff fetch fires on component mount when `isVisualEditAwaitingConfirmation` is already true. This means if the component is first rendered with `applyStatus === 'awaiting-confirmation'` (stream-complete path), the diff begins loading immediately and races only against the initial render.
- `diffState` is local to `WorkspaceAssistantFileActionSummary`. It is not persisted, not threaded upward, and resets if the component unmounts and remounts.
- Manual validation (DevTools prompt inspection + single-file safe-write diff check) is deferred to the product team.

---

## Next Recommended Task

**UX-IA-17 — Visual Edit Undo / Checkpoint Integration**

Status: PENDING (requires UX-IA-16 COMPLETE — now satisfied)

Scope: Integrate visual-edit confirmation apply/cancel with the existing checkpoint system; allow the user to undo a visual-edit-applied change by reverting to the pre-apply checkpoint.
