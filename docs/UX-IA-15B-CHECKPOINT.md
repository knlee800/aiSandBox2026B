# UX-IA-15B Checkpoint — Cross-Frame Picker Script + postMessage Listener

**Task ID:** UX-IA-15B
**Parent:** UX-IA-15 — Visual Edit Mode Foundation
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-14
**Risk:** Medium
**Model used:** Sonnet 4.6

---

## Objective

Inject a self-contained element picker script into the same-origin preview iframe when the picker toggle is active, listen for cross-frame `postMessage` events with origin and source validation, capture selected element metadata, surface the selection in the UI, handle re-injection on iframe reload, and gracefully handle iframe access failures. No AI prompt injection is performed in this slice.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-preview.logic.ts` | Added picker script generation helpers, message type guard, and ID/constant accessors |
| `frontend/components/workspace/workspace-shell.tsx` | Added injection/removal helpers, message listener, onLoad re-injection, selected element state and indicator |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added 4 shell tests + 17 pure logic helper tests |

**No other files were changed.** `page.tsx`, `messages/*.json`, backend files, auth files, and governance docs were not modified during implementation.

---

## Picker Script Injection Summary

Added to `frontend/components/workspace/workspace-preview.logic.ts`:

### New Exports

- `generatePickerScriptSource()` — returns a self-contained IIFE string for injection into the preview iframe
- `getPickerScriptId()` — returns the stable `<script>` / marker element ID used to prevent double-injection
- `getPickerOverlayId()` — returns the stable overlay `<div>` ID
- `getMaxTextContentLength()` — returns 200 (the truncation limit for captured text content)
- `isVisualEditElementSelectedMessage(data)` — type guard; validates the shape of an incoming `MessageEvent.data` object: checks `type === 'visual-edit:element-selected'` and that `payload` contains `tagName` (string), `selector` (string), `textContent` (string), `classList` (array), and `boundingBox` (object)

### Picker Script Behaviour (IIFE)

- Injects a full-viewport zero-pointer-event overlay `<div>` with a hover highlight child (violet `2px solid #7c3aed`, 8% fill)
- Attaches `mousemove` (capture) to update highlight position over the hovered element
- Attaches `click` (capture) with `preventDefault` + `stopPropagation` + `stopImmediatePropagation`
- On click, captures:
  - `tagName` (lowercased)
  - `selector` (built by walking the DOM upwards: uses `#id` when present, otherwise `.class` chain + `:nth-of-type(n)` when siblings exist)
  - `textContent` truncated to 200 characters
  - `classList` (array)
  - `boundingBox` (`{ x, y, width, height }` from `getBoundingClientRect()`)
  - `id` (nullable string)
- Posts `{ type: 'visual-edit:element-selected', payload }` to `window.parent` with origin `'*'`
- Self-cleans after selection: removes overlay, marker `<meta>`, and event listeners
- Listens for `{ type: 'visual-edit:deactivate-picker' }` from parent to clean up externally
- Uses a `<meta id="__visual_edit_picker_script__-active">` marker for idempotent injection — re-entry is a no-op if already active

### Preserved from UX-IA-15A

- All types: `SelectedPreviewElement`, `SelectedPreviewElementBoundingBox`, `VisualEditMessage` union, all four message type variants, `CssSelectorSegment`, `VisualEditMessageValidationInput`
- All helpers: `buildCssSelectorFromSegments`, `isValidVisualEditMessageOriginAndSource`
- All private helpers: `normalizeTagName`, `normalizeToken`, `escapeCssIdentifier`

---

## postMessage Validation / Listener Summary

Changes to `frontend/components/workspace/workspace-shell.tsx`:

### Message Listener

- `useEffect` in `WorkspaceShell` adds `window.addEventListener('message', handleMessage)` with cleanup on unmount
- `handleMessage`:
  1. Calls `isVisualEditElementSelectedMessage(event.data)` — short-circuits on type/shape mismatch
  2. Resolves `expectedSource = previewIframeRef.current?.contentWindow ?? null`
  3. Resolves `expectedOrigin = window.location.origin`
  4. Calls `isValidVisualEditMessageOriginAndSource({ expectedOrigin, messageOrigin: event.origin, expectedSource, messageSource: event.source })`
  5. On failure: silently returns (ignores unknown or cross-origin messages)
  6. On success: calls `setSelectedPreviewElement(event.data.payload)` and `setPickerActive(false)`

---

## Selected Element Indicator Summary

- `selectedPreviewElement` local `useState<SelectedPreviewElement | null>` in `WorkspaceShell` — display-only, not forwarded to `page.tsx`
- Passed as `selectedPreviewElement` prop to both `WorkspacePreviewPanel` usages
- Rendered inside `WorkspacePreviewPanel` as an emerald-styled banner:
  - `data-testid="workspace-preview-selected-element"`
  - Shows: `Element selected: <tagName> selector` (selector in monospace)
  - Visible only when `pickerActive === false` and `selectedPreviewElement !== null`
  - Hidden when picker is re-activated (cleared in toggle-on path)
- `WorkspacePreviewPanel` props type extended: `'elementSelected'` added to the `Pick` of `enMessages.project`

---

## Injection / Removal Wiring Summary

- `injectPickerScript()` — `useCallback`; safely accesses `iframe.contentDocument`; creates a `<script>` element with the generated source and appends it to `document.body`; no-ops if marker already present or if `contentDocument`/`contentWindow` access throws (cross-origin or not-yet-loaded); idempotent
- `removePickerScript()` — `useCallback`; posts `visual-edit:deactivate-picker` to the iframe's `contentWindow`, then removes marker, overlay, and script elements from `contentDocument`; no-ops gracefully on access failure
- `handlePickerToggle` — updated: toggle-on clears `selectedPreviewElement` and schedules `injectPickerScript()` via `setTimeout(0)`; toggle-off calls `removePickerScript()`
- `handlePreviewLoadWithPicker` — `useCallback`; calls original `props.onPreviewLoad()` then re-injects picker script if `pickerActive === true`; used as `onPreviewLoad` on both `WorkspacePreviewPanel` instances
- Existing `useEffect` for preview URL / state reset — now also calls `removePickerScript()` when preview becomes unavailable

---

## Tests Added

Added to `frontend/components/workspace/workspace-shell.test.tsx`:

### Shell Tests (static renderer)

| Test | Assertion |
|---|---|
| `selected element indicator is absent by default` | `workspace-preview-selected-element` not present in default HTML |
| `picker toggle still renders after 15B implementation` | picker toggle, Start, and Refresh controls all present |
| `preview iframe still renders after 15B wiring` | `workspace-preview-iframe` present |
| `picker-active banner is absent by default after 15B` | `workspace-preview-picker-active` not present by default |

### Pure Logic Tests (new `describe` block: `workspace preview logic — UX-IA-15B helpers`)

| Test | Assertion |
|---|---|
| `generatePickerScriptSource returns a non-empty string` | string, length > 100 |
| `generatePickerScriptSource contains picker script ID` | source includes `getPickerScriptId()` value |
| `generatePickerScriptSource contains overlay ID` | source includes `getPickerOverlayId()` value |
| `generatePickerScriptSource contains element-selected message type` | source includes `'visual-edit:element-selected'` |
| `generatePickerScriptSource contains deactivate-picker listener` | source includes `'visual-edit:deactivate-picker'` |
| `generatePickerScriptSource contains max text content length` | source includes `String(getMaxTextContentLength())` |
| `getPickerScriptId returns a stable value` | value equals itself; non-empty |
| `getPickerOverlayId returns a stable value` | value equals itself; non-empty |
| `isVisualEditElementSelectedMessage accepts valid message` | returns `true` for well-formed payload |
| `isVisualEditElementSelectedMessage rejects wrong type` | returns `false` for wrong `type` |
| `isVisualEditElementSelectedMessage rejects null` | returns `false` for `null` |
| `isVisualEditElementSelectedMessage rejects missing payload` | returns `false` when `payload` absent |
| `isVisualEditElementSelectedMessage rejects incomplete payload` | returns `false` when payload missing required fields |
| `isValidVisualEditMessageOriginAndSource rejects mismatched origin` | returns `false` |
| `isValidVisualEditMessageOriginAndSource rejects null expected origin` | returns `false` |
| `isValidVisualEditMessageOriginAndSource rejects null message source` | returns `false` |
| `isValidVisualEditMessageOriginAndSource accepts matching origin and source` | returns `true` |

Test baseline before UX-IA-15B: **328 tests**. After: **349 tests** (328 + 21 new; all pass, 0 fail).

---

## Validation Results

Run from `C:\Users\knlee\aiSandBox2026B\frontend`:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm test` | PASS — 349 tests, 349 passed, 0 failed |
| `npm run build` | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed — build artifact removed from working tree |
| `ReadLints` on all 3 touched files | PASS — 0 linter errors |

---

## Non-Goals Confirmed

The following were explicitly NOT implemented in this slice:

- No `page.tsx` changes
- No AI prompt context injection (`selectedPreviewElement` not yet forwarded to `page.tsx` or `WorkspacePromptContext`)
- No `WorkspacePromptContext` changes
- No backend, API, or auth changes
- No `messages/*.json` changes
- No DOM-to-source mapping beyond simple CSS selector metadata
- No file-action confirmation changes
- No new npm dependencies
- No checkpoint for UX-IA-15 parent (created on UX-IA-15C completion)

---

## Invariants Preserved

- UX-IA-08: project mode is locked inside `workspace-shell.tsx` — unchanged
- UX-IA-10: preview iframe `src`, `fillHeight`, and layout wiring — unchanged
- UX-IA-15A: all types, interfaces, helpers, testids from 15A — fully preserved
- Existing `workspace-preview-start`, `workspace-preview-refresh`, `workspace-preview-iframe`, `workspace-preview-picker-toggle`, `workspace-preview-picker-active` testids — preserved
- `props.onPreviewLoad` behavior — preserved (called first inside `handlePreviewLoadWithPicker` before re-injection logic)
- AI-WS file-action confirmation flow — unaffected
- No pointer-event-blocking wrapper added to preview iframe

---

## Carry-Forwards to UX-IA-15C

- `selectedPreviewElement` state is captured in `WorkspaceShell` and ready to be forwarded to `page.tsx`
- `isVisualEditElementSelectedMessage` type guard is proven and tested
- Picker toggle auto-deactivates after selection
- Selected element indicator is visible in the UI (display-only)
- Next step: wire `selectedPreviewElement` into `WorkspacePromptContext` via `page.tsx`; prefix AI prompt with element context; clear after submit; write `docs/UX-IA-15-CHECKPOINT.md`; close UX-IA-15 parent

---

## Next Task

**UX-IA-15C — AI Prompt Context Injection + Validation + Consolidation**

Status: ACTIVE
Scope: Add `selectedPreviewElement` state and `handlePreviewElementSelected` callback to `page.tsx`; extend `WorkspacePromptContext` with optional `selectedPreviewElement`; prefix AI prompt with element context block when set; clear after prompt submit; full validation; create `docs/UX-IA-15-CHECKPOINT.md`; close UX-IA-15 parent as COMPLETE and LOCKED.
