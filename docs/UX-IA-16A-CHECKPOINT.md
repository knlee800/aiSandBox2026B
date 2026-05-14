# UX-IA-16A Checkpoint — Visual Edit Prompt Contract + Force-Confirmation

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-16A
**Parent:** UX-IA-16 — Visual Edit AI Patch Flow
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Completed:** 2026-05-14
**Checkpoint file:** `docs/UX-IA-16A-CHECKPOINT.md`
**Upstream checkpoint:** `docs/UX-IA-15C-CHECKPOINT.md`
**Next task:** UX-IA-16B — Visual Edit Diff Preview in Confirmation UI

---

## Objective

Enhance the visual-edit prompt contract so the AI receives explicit directive instructions to identify source files and propose focused file-action patches for the selected preview element. Force all visual-edit-sourced executions through the existing file-action confirmation dialog — regardless of batch size or risk classification — without bypassing the confirmation flow or changing the apply/cancel behavior for non-visual-edit executions.

---

## Exact Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-preview.logic.ts` | Enhanced `buildPromptWithSelectedPreviewElement` with Visual Edit Mode contract block |
| `frontend/app/[locale]/app/page.tsx` | Added `visualEditExecutionIdsRef`; recorded on submit (both paths); checked in `maybeApplyExecutionFileActions`; cleared on reset; passed `visualEditExecutionIds` prop |
| `frontend/components/workspace/workspace-shell.tsx` | Added `visualEditExecutionIds` prop to `WorkspaceShellProps` and `WorkspaceChatPanel`; threaded to `WorkspaceAssistantFileActionSummary`; added minimal visual-edit attribution label |
| `frontend/components/workspace/workspace-shell.test.tsx` | Updated prompt-contract test; added visual-edit attribution render test; added static page-source assertion tests |

No other files were changed. No backend files. No auth files. No i18n files. No governance docs changed during implementation.

---

## Prompt Contract Summary

### What changed in `buildPromptWithSelectedPreviewElement`

When `selectedPreviewElement` is non-null, the output prompt now includes the following block inserted between the existing element metadata and the user request:

```
[Visual Edit Mode Contract]
User is in Visual Edit Mode.
Treat the selected preview element as the target of the requested change.
Identify the source file responsible for rendering or styling the selected element before proposing edits.
Propose focused file-actions only for files directly required to satisfy this request.
Follow the existing file-action output contract exactly.
```

### Element metadata preserved (unchanged)

- `Tag: <tagName>`
- `Selector: <selector>`
- `Text: <textContent>`
- `Classes: <classList>`
- `Bounds: x=..., y=..., width=..., height=...`

### Original user request preserved

- Appended as `User request:\n<prompt>` after the contract block.

### Null behavior preserved

- When `selectedPreviewElement` is `null`, the function returns the original prompt string unchanged — no modification, no contract block.

---

## Force-Confirmation Summary

### New ref added in `page.tsx`

```typescript
const visualEditExecutionIdsRef = useRef<Set<string>>(new Set());
```

Added alongside `appliedFileActionsExecutionIdsRef`, `pendingConfirmationExecutionIdsRef`, `cancelledFileActionsExecutionIdsRef`.

### Execution ID recording — non-orchestration path

In `handleSubmitChatPrompt`, after `selectedPreviewElement` presence is captured:

```typescript
const isVisualEditPrompt = selectedPreviewElement !== null;
```

After the API response returns `nextExecutionId`:

```typescript
if (isVisualEditPrompt && nextExecutionId) {
  visualEditExecutionIdsRef.current.add(nextExecutionId);
}
```

### Execution ID recording — orchestration path

`submitOrchestratedChatPrompt` accepts `isVisualEditPrompt: boolean`. For each step's resolved `executionId`:

```typescript
if (input.isVisualEditPrompt) {
  visualEditExecutionIdsRef.current.add(executionId);
}
```

Recording happens before `consumeExecutionFileActions` is called in both paths.

### Force-confirmation in `maybeApplyExecutionFileActions`

The visual-edit check runs **before** `isRiskyFileActionBatch`. If the execution is visual-edit-sourced:

1. `pendingConfirmationExecutionIdsRef.current.add(executionId)` — adds to the pending set so confirmation/cancel handlers operate correctly.
2. Sets `applyStatus: 'awaiting-confirmation'`, `confirmationRequired: true`.
3. Returns early — does not reach the risky-batch check or `applyExecutionFileActions`.

### Existing behaviors preserved

- `isRiskyFileActionBatch` logic — unchanged; still governs non-visual-edit executions.
- `acquireExecutionApplyGuard` apply-once guard — unchanged; runs at the start of `applyExecutionFileActions`.
- `cancelledFileActionsExecutionIdsRef` and `pendingConfirmationExecutionIdsRef` — checked before the visual-edit check; early exits preserved.
- `handleConfirmExecutionFileActions` and `handleCancelExecutionFileActions` — unchanged; operate on `pendingConfirmationExecutionIdsRef` as before.
- Backend request shape — unchanged.
- No file-action apply code changed.

### Clear on chat reset

In the `useEffect` triggered by `selectedSessionId`/`userId` (existing chat reset path), added:

```typescript
visualEditExecutionIdsRef.current = new Set<string>();
```

Cleared alongside `appliedFileActionsExecutionIdsRef`, `pendingConfirmationExecutionIdsRef`, `cancelledFileActionsExecutionIdsRef`, `coheredExecutionIdsRef`.

---

## Visual-Edit Attribution Summary

### What was added in `workspace-shell.tsx`

- `visualEditExecutionIds?: string[]` prop added to `WorkspaceShellProps`.
- Prop threaded to `WorkspaceChatPanel` as `visualEditExecutionIds: string[]`.
- Inside `WorkspaceChatPanel`: `const visualEditExecutionIdSet = new Set(props.visualEditExecutionIds)` computed once per render.
- `WorkspaceAssistantFileActionSummary` receives `isVisualEditExecution?: boolean` prop, derived from whether `message.executionId` is in the set.
- When `isVisualEditExecution` is true, renders a minimal attribution label above the existing confirmation block:

```html
<p data-testid="workspace-chat-file-actions-visual-edit-attribution">
  Source: Visual Edit mode selection.
</p>
```

### What was not changed

- Non-visual-edit `awaiting-confirmation` UI — unchanged.
- Apply and Cancel buttons — unchanged.
- `confirmationRequired` logic — unchanged.
- No diff preview added (belongs to UX-IA-16B).
- No bypass of confirmation added.

---

## Test Summary

### Tests updated

| Test | Result |
|---|---|
| `buildPromptWithSelectedPreviewElement prefixes prompt metadata when element exists` | Updated — now also asserts `[Visual Edit Mode Contract]`, all five instruction lines, and original user request |
| `renders confirmation notice for risky assistant file-action batches` | Updated — added `doesNotMatch` assertion for `workspace-chat-file-actions-visual-edit-attribution` to confirm non-visual attribution is absent |

### Tests added

| Test | Assertion |
|---|---|
| `renders visual-edit attribution for visual-edit-sourced execution file actions` | `visualEditExecutionIds: ['exec-visual-1']` + matching `executionId` → `workspace-chat-file-actions-visual-edit-attribution` present; `Source: Visual Edit mode selection.` rendered; confirmation block still present |
| `tracks visual-edit execution ids in both submit paths and clears them on reset` | Static page-source assertions: `visualEditExecutionIdsRef` declaration present; orchestration recording present; non-orchestration recording present; reset clear present |
| `forces awaiting confirmation for visual-edit execution file actions` | Static page-source assertions: `visualEditExecutionIdsRef.current.has(executionId)` check present; `pendingConfirmationExecutionIdsRef.current.add` present; `applyStatus: 'awaiting-confirmation'` present; `confirmationRequired: true` present |

### Existing tests preserved

- `buildPromptWithSelectedPreviewElement keeps prompt unchanged when no element exists` — passes unchanged.
- All existing risky-batch confirmation, cancel, apply, skip, coherence, and shell render tests — passes unchanged.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` (from `frontend/`) | PASS — 0 errors |
| `npm test` (from `frontend/`) | PASS — 356 tests, 356 passed, 0 failed |
| `npm run build` (from `frontend/`) | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed after build |
| `ReadLints` on all touched files | PASS — 0 linter errors |

---

## Non-Goals Confirmed

- No UX-IA-16B diff preview implemented.
- No backend or API changes.
- No auth changes.
- No direct DOM mutation.
- No automatic apply of file actions.
- No bypass of file-action confirmation flow.
- No new npm dependencies.
- No changes to picker script, postMessage listener, or any UX-IA-15 wiring.
- No changes to i18n files.
- No changes to routes.
- No changes to `workspace-tab-registry.ts` or `workspace-tab-bar.tsx`.
- No checkpoint or governance files changed during implementation.

---

## Invariants Preserved

| Invariant | Status |
|---|---|
| UX-IA-15A/15B/15C: types, helpers, postMessage listener, prompt prefix shape | Fully preserved |
| `isRiskyFileActionBatch` logic for non-visual-edit executions | Unchanged |
| `acquireExecutionApplyGuard` apply-once safety | Unchanged |
| `applySequentialFileActions` per-action session validation | Unchanged |
| `maybeRunExecutionCoherence` (file tree refresh, preview refresh, checkpoint, autosave) | Unchanged |
| Cancel path (`handleCancelExecutionFileActions`) | Unchanged |
| Confirm path (`handleConfirmExecutionFileActions`) | Unchanged |
| All UX-IA-04 through UX-IA-15 `data-testid` contracts and component interfaces | Unaffected |
| `buildPromptWithSelectedPreviewElement` null behavior | Unchanged — returns original prompt when no element |

---

## Carry-Forwards

- `visualEditExecutionIds` prop is passed as `Array.from(visualEditExecutionIdsRef.current)` on each render. This is a snapshot; ref mutations between renders do not cause re-renders. This is intentional and consistent with how other execution-tracking refs work in this codebase.
- Manual validation (DevTools prompt inspection + single-file safe-write confirmation check) is deferred to the product team.
- UX-IA-16B (diff preview) will read `isVisualEditExecution` from the same prop thread established in this slice.

---

## Next Recommended Task

**UX-IA-16B — Visual Edit Diff Preview in Confirmation UI**

Status: ACTIVE — current stage (unblocked by this checkpoint)

Depends on: `docs/UX-IA-16A-CHECKPOINT.md` (this file)

Scope: Add pure line-level unified diff computation; for visual-edit confirmations, fetch current file content and render diff preview inside `WorkspaceAssistantFileActionSummary`; non-visual-edit confirmation path unchanged; no new npm dependencies.
