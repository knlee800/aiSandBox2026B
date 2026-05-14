# UX-IA-15 Checkpoint — Visual Edit Mode Foundation

**Task ID:** UX-IA-15
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-14
**Risk:** Medium
**Model used:** Sonnet 4.6 (consolidation); GPT-5.3 Codex / Sonnet 4.6 (implementation slices)

---

## Objective

Add a preview element picker / selection overlay to the project mode Preview tab. When the user activates the picker toggle and clicks an element in the preview iframe, capture its DOM metadata (CSS selector, text content, bounding box, applied CSS classes) via cross-frame `postMessage` and surface it as structured context appended to the AI chat prompt. The AI uses the existing AI-WS file-action system to propose and apply source changes. All existing file-action confirmation and checkpoint safety rules are preserved without bypass.

---

## Child Slice Summary

### UX-IA-15A — Preview Picker Infrastructure
**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-15A-CHECKPOINT.md`

Established the type foundation, helper utilities, iframeRef wiring, picker toggle button, and i18n keys required for the Visual Edit Mode picker. No script injection, no postMessage listener, no prompt injection performed.

Key deliverables:
- `SelectedPreviewElement`, `VisualEditMessage` union, and related types in `workspace-preview.logic.ts`
- `buildCssSelectorFromSegments` and `isValidVisualEditMessageOriginAndSource` pure helpers
- `previewIframeRef`, `pickerActive` state, `handlePickerToggle`, and picker toggle button in `WorkspaceShell`
- 4 i18n keys added to all 3 locale files (`selectElement`, `pickerActive`, `elementSelected`, `deselectElement`)
- 5 new tests; test count: 317 → 328

---

### UX-IA-15B — Cross-Frame Picker Script + postMessage Listener
**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-15B-CHECKPOINT.md`

Injected a self-contained element picker script into the same-origin preview iframe, added postMessage listener with origin and source validation, captured selected element metadata, surfaced the selection in the UI, and handled re-injection on iframe reload.

Key deliverables:
- `generatePickerScriptSource`, `getPickerScriptId`, `getPickerOverlayId`, `getMaxTextContentLength`, `isVisualEditElementSelectedMessage` exports in `workspace-preview.logic.ts`
- Picker script IIFE: full-viewport overlay, click capture, element metadata payload, self-cleanup, deactivate-picker listener
- `injectPickerScript`, `removePickerScript`, `handlePreviewLoadWithPicker`, postMessage `handleMessage` in `WorkspaceShell`
- `selectedPreviewElement` local state in `WorkspaceShell`; selected element emerald indicator in `WorkspacePreviewPanel`
- 4 shell tests + 17 pure logic tests; test count: 328 → 349

---

### UX-IA-15C — AI Prompt Context Injection + Validation + Consolidation
**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-15C-CHECKPOINT.md`

Wired the captured preview element selection into the AI prompt context, validated the full end-to-end flow, and produced the final consolidation checkpoints.

Key deliverables:
- `onPreviewElementSelected` optional callback prop on `WorkspaceShell`; calls prop on valid element selection, picker toggle-on clear, and preview reset to non-ready
- `selectedPreviewElement` state and `handlePreviewElementSelected` callback in `page.tsx`
- `WorkspacePromptContext` extended with optional `selectedPreviewElement`; `buildWorkspacePromptContext` accepts and includes it when present
- `buildPromptWithSelectedPreviewElement` pure helper: prepends structured `[Visual Edit Context]` block to AI prompt; chat thread preserves original user prompt
- Clear-on-submit in both orchestration and non-orchestration paths
- 4 new tests; test count: 349 → 353

---

## Files Changed Across UX-IA-15

| File | Changed In | Summary |
|---|---|---|
| `frontend/components/workspace/workspace-preview.logic.ts` | 15A, 15B, 15C | Types, helpers, picker script generation, prompt prefix helper, `WorkspacePromptContext` extension |
| `frontend/components/workspace/workspace-shell.tsx` | 15A, 15B, 15C | Picker toggle, iframeRef, script injection/removal, postMessage listener, selected element state, `onPreviewElementSelected` prop |
| `frontend/components/workspace/workspace-shell.test.tsx` | 15A, 15B, 15C | 26 new tests total (5 + 21 + 4 across slices) |
| `frontend/app/[locale]/app/page.tsx` | 15C | `selectedPreviewElement` state, `handlePreviewElementSelected`, prompt context wiring, clear-on-submit |
| `frontend/messages/en.json` | 15A | 4 i18n keys in `project` namespace |
| `frontend/messages/zh-TW.json` | 15A | 4 i18n keys in `project` namespace |
| `frontend/messages/zh-CN.json` | 15A | 4 i18n keys in `project` namespace |

**No other files were changed across UX-IA-15.** Backend files, auth files, and governance docs were not modified during implementation.

---

## Final Visual Edit Mode Foundation Summary

The Visual Edit Mode Foundation is complete. The full round-trip is implemented:

1. **Picker toggle** — user activates the picker button in the Preview tab toolbar (`data-testid="workspace-preview-picker-toggle"`); button is disabled when no session, no preview URL, or preview not ready.
2. **Script injection** — a self-contained IIFE picker script is injected into the same-origin preview iframe via `iframeRef.current.contentDocument`; idempotent; re-injected on iframe reload if picker is still active.
3. **Element selection** — user clicks an element in the preview; the script captures `tagName`, `selector`, `textContent`, `classList`, `boundingBox`, and optional `id`; posts `visual-edit:element-selected` to `window.parent`.
4. **postMessage validation** — `WorkspaceShell` listener validates message shape (`isVisualEditElementSelectedMessage`), origin (same-origin), and source (iframe `contentWindow`); ignores all non-matching messages.
5. **UI indicator** — selected element displayed in an emerald banner in `WorkspacePreviewPanel`; picker auto-deactivates after selection.
6. **Prompt context injection** — `selectedPreviewElement` is forwarded to `page.tsx` via `onPreviewElementSelected` callback; `buildPromptWithSelectedPreviewElement` prepends a `[Visual Edit Context]` block to the AI prompt; AI prompt is prefixed, chat thread preserves the original user-visible message.
7. **Clear on submit** — `selectedPreviewElement` cleared in `page.tsx` after successful prompt submission in both orchestration and non-orchestration paths.
8. **Clear on reset** — `selectedPreviewElement` cleared when picker is toggled on or preview becomes unavailable.

---

## Final Validation Summary

| Command | Result |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS — 0 errors |
| `npm test` (frontend) | PASS — 353 tests, 353 passed, 0 failed |
| `npm run build` (frontend) | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed — build artifact cleaned |
| `ReadLints` on all touched files | PASS — 0 linter errors |

Test baseline before UX-IA-15: **317 tests**. Final count: **353 tests** (+36 across all three slices).

---

## Non-Goals Confirmed

The following were explicitly NOT implemented across UX-IA-15:

- No full visual editor
- No inline text editing directly in preview
- No drag/resize/reposition elements
- No style controls panel
- No DOM-to-source mapping (deferred to UX-IA-16+)
- No bypass of existing AI-WS file-action confirmation rules
- No backend or API changes
- No auth changes
- No route changes
- No billing changes
- No new npm dependencies
- No `workspace-project-mode.tsx` (project mode remains locked inside `workspace-shell.tsx` per UX-IA-08)

---

## Invariants Preserved

- **UX-IA-08:** project mode locked inside `workspace-shell.tsx` — `workspace-project-mode.tsx` was not created
- **UX-IA-09:** AI/history panel — unchanged
- **UX-IA-10:** preview iframe `src`, `fillHeight`, and layout wiring — unchanged; picker overlay is purely additive
- **AI-WS file-action confirmation and checkpoint safety rules** — fully preserved, no bypass path
- **`WorkspacePreviewPanel` iframe structure and `window.postMessage` path** — preserved
- **All prior UX-IA-04 through UX-IA-14 `data-testid` contracts and component interfaces** — unaffected
- **`props.onPreviewLoad` behavior** — preserved (called before re-injection logic in `handlePreviewLoadWithPicker`)
- **Chat thread display** — shows original (non-prefixed) user prompt; no user-visible contamination

---

## Carry-Forwards to UX-IA-16

- `selectedPreviewElement` state is fully wired from picker selection through to AI prompt context.
- `buildPromptWithSelectedPreviewElement` helper is proven, pure, and tested — ready for extension.
- Clearing behavior on submit, toggle, and preview reset is validated and locked.
- `WorkspacePromptContext.selectedPreviewElement` is the stable interface for downstream AI patch flow work.
- UX-IA-16 (Visual Edit AI Patch Flow) may extend the prompt context or add AI-driven patch application using the context injection contract from this task as the stable foundation.

---

## Next Task

**UX-IA-16 — Visual Edit AI Patch Flow**

Status: PENDING (requires UX-IA-15 COMPLETE — now satisfied)
Scope: Wire AI-proposed file patches triggered by visual edit element context; apply patches via existing AI-WS file-action confirmation flow; no bypass of safety rules.
