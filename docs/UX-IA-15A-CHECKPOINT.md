# UX-IA-15A Checkpoint — Preview Picker Infrastructure

**Task ID:** UX-IA-15A
**Parent:** UX-IA-15 — Visual Edit Mode Foundation
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-14
**Risk:** Low
**Model used:** Sonnet 4.6

---

## Objective

Establish the type foundation, helper utilities, iframeRef wiring, picker toggle button, and i18n keys required for the Visual Edit Mode picker. No script injection, no postMessage listener, no prompt injection performed in this slice.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-preview.logic.ts` | Added types, interfaces, helpers |
| `frontend/components/workspace/workspace-shell.tsx` | Added picker state, iframeRef, toggle button |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added 5 focused tests |
| `frontend/messages/en.json` | Added 4 i18n keys in `project` namespace |
| `frontend/messages/zh-TW.json` | Added 4 i18n keys in `project` namespace |
| `frontend/messages/zh-CN.json` | Added 4 i18n keys in `project` namespace |

**No other files were changed.** `page.tsx`, backend files, auth files, and governance docs were not modified during implementation.

---

## Preview Logic Types and Helpers

Added to `frontend/components/workspace/workspace-preview.logic.ts`:

### Interfaces

- `SelectedPreviewElementBoundingBox` — `{ x, y, width, height }` bounding box for a selected DOM element
- `SelectedPreviewElement` — full selection payload: `selector`, `textContent`, `classList`, `boundingBox`, `tagName`, optional `id`
- `CssSelectorSegment` — input segment for selector building: `tagName`, optional `id`, `classList`, `nthOfType`
- `VisualEditMessageValidationInput` — origin/source validation input: `expectedOrigin`, `messageOrigin`, `expectedSource`, `messageSource`

### Message Types

- `VisualEditElementSelectedMessage` — `{ type: 'visual-edit:element-selected', payload: SelectedPreviewElement }`
- `VisualEditPickerReadyMessage` — `{ type: 'visual-edit:picker-ready' }`
- `VisualEditActivatePickerMessage` — `{ type: 'visual-edit:activate-picker' }`
- `VisualEditDeactivatePickerMessage` — `{ type: 'visual-edit:deactivate-picker' }`
- `VisualEditMessage` — union of all four message types above

### Exported Helpers

- `buildCssSelectorFromSegments(segments)` — pure function; builds a CSS selector string from an array of `CssSelectorSegment` items; normalises tag names, escapes identifiers, emits `#id`, `.class`, and `:nth-of-type()` as appropriate; returns `''` for empty input
- `isValidVisualEditMessageOriginAndSource(input)` — pure function; returns `true` only when `messageOrigin === expectedOrigin` and `messageSource === expectedSource` and neither expected value is null; used to validate incoming postMessage events against a known iframe source

### Private Helpers (module-internal)

- `normalizeTagName(tagName)` — lowercases and trims; returns `'*'` for empty string
- `normalizeToken(value)` — trims string or returns `''` for null/empty
- `escapeCssIdentifier(value)` — escapes non-`[a-zA-Z0-9_-]` characters for safe CSS use

No runtime side-effects. All helpers are pure and independently testable.

---

## Picker Toggle Infrastructure

Changes to `frontend/components/workspace/workspace-shell.tsx`:

### State added in `WorkspaceShell`

- `pickerActive` (`boolean`, initial `false`) — tracks whether the element picker overlay is active
- `previewIframeRef` (`React.useRef<HTMLIFrameElement | null>(null)`) — stable ref to the preview iframe; used by UX-IA-15B for script injection

### Handlers added in `WorkspaceShell`

- `handlePickerToggle` — `useCallback`; toggles `pickerActive`
- `useEffect` reset — clears `pickerActive` whenever `props.previewUrl` is falsy or `props.previewState !== 'ready'`; prevents stale picker-active state after preview becomes unavailable

### `WorkspacePreviewPanel` prop additions (all optional)

- `projectMessages: Pick<typeof enMessages.project, 'selectElement' | 'pickerActive' | 'deselectElement'>` — required for i18n labels; passed as `projectPanelMessages` from shell
- `iframeRef?: React.RefObject<HTMLIFrameElement | null>` — forwarded to iframe `ref`; consumed by UX-IA-15B
- `pickerActive?: boolean` — controls button `aria-pressed` and status indicator visibility
- `onPickerToggle?: () => void` — wired to toggle button `onClick`

### Picker toggle button

- Rendered in `WorkspacePreviewPanel` toolbar alongside existing Start / Refresh buttons
- `data-testid="workspace-preview-picker-toggle"`
- `aria-pressed={pickerActive}` — reflects current state
- `disabled` when `!selectedSessionId || !previewUrl || previewState !== 'ready'`
- Label: `selectElement` when inactive, `deselectElement` when active (from `projectMessages`)
- Styled with `border-violet-300 / text-violet-700` to visually distinguish from the blue session-action buttons

### Active state indicator

- When `pickerActive === true`, a `<p>` banner is shown below the toolbar (`data-testid="workspace-preview-picker-active"`) with `projectMessages.pickerActive` text
- Not shown by default

### Unchanged

- Preview iframe `src`, `onLoad`, `onError`, `className` — untouched
- Existing `workspace-preview-start` and `workspace-preview-refresh` buttons — untouched
- All other tabs, panels, testids — untouched
- UX-IA-08 invariant: project mode lives in `workspace-shell.tsx`; no new mode file created

Both `WorkspacePreviewPanel` usages (legacy layout and project-first layout) received the same new props.

---

## i18n Summary

Added to `project` namespace in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `selectElement` | `Select Element` | `選取元素` | `选取元素` |
| `pickerActive` | `Picker active — click an element in the preview` | `選取模式 — 在預覽中點選元素` | `选取模式 — 在预览中点选元素` |
| `elementSelected` | `Element selected` | `已選取元素` | `已选取元素` |
| `deselectElement` | `Clear selection` | `清除選取` | `清除选取` |

Keys added at the end of the `project` object in each locale file, after `expandPanel`.

---

## Tests Added

Added to `frontend/components/workspace/workspace-shell.test.tsx`, inside the existing `describe('workspace shell component')` block, using the same `renderWorkspaceShell` / `renderToStaticMarkup` harness. Existing harness was not modified.

| Test | Assertion |
|---|---|
| `renders preview picker toggle in Preview tab toolbar` | `data-testid="workspace-preview-picker-toggle"` present in ready-state HTML |
| `disables preview picker toggle when preview URL is missing` | `workspace-preview-picker-toggle` has `disabled` attribute when `previewUrl: null` |
| `sets preview picker toggle aria-pressed false by default` | `aria-pressed="false"` on toggle button by default |
| `keeps preview Start and Refresh controls visible with picker infrastructure` | `workspace-preview-start` and `workspace-preview-refresh` still present |
| `keeps preview iframe rendering when preview URL exists` | `workspace-preview-iframe` still present when URL is set |

Test baseline before UX-IA-15A: **317 tests**. After: **328 tests** (317 existing + 5 new UX-IA-15A + 6 previously added in prior session = 328 total; all pass, 0 fail).

---

## Validation Results

Run from `C:\Users\knlee\aiSandBox2026B\frontend`:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm test` | PASS — 328 tests, 328 passed, 0 failed |
| `npm run build` | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed — build artifact removed from working tree |
| `ReadLints` on all 6 touched files | PASS — 0 linter errors |

---

## Non-Goals Confirmed

The following were explicitly NOT implemented in this slice:

- No script injection into preview iframe
- No `window.postMessage` listener
- No selected element metadata capture
- No `page.tsx` changes
- No AI prompt context injection
- No backend, API, or auth changes
- No DOM-to-source mapping
- No new npm dependencies

---

## Invariants Preserved

- UX-IA-08: project mode is locked inside `workspace-shell.tsx` — `workspace-project-mode.tsx` was not created
- UX-IA-10: preview iframe `src` and `fillHeight` wiring unchanged
- All prior UX-IA-04 through UX-IA-14 `data-testid` contracts and component interfaces — unaffected
- AI-WS file-action confirmation flow — unaffected (no prompt injection)
- Existing `workspace-preview-start`, `workspace-preview-refresh`, and `workspace-preview-iframe` testids — preserved

---

## Carry-Forwards to UX-IA-15B

- `previewIframeRef` is wired to the iframe and ready to receive script injection
- `VisualEditActivatePickerMessage` / `VisualEditDeactivatePickerMessage` types are ready for use in the picker script
- `isValidVisualEditMessageOriginAndSource` is ready for the postMessage listener
- `buildCssSelectorFromSegments` is ready for selector generation in the picker script payload
- `pickerActive` state in `WorkspaceShell` is available for UX-IA-15B to drive re-injection on iframe reload

---

## Next Task

**UX-IA-15B — Cross-Frame Picker Script + postMessage Listener**

Status: ACTIVE
Scope: inject picker script into same-origin preview iframe via `iframeRef`; add postMessage listener with origin + source validation using helpers from UX-IA-15A; capture `{ selector, textContent, classList, boundingBox }`; auto-deactivate after selection; re-inject on iframe reload if picker remains active; surface selected element UI indicator.
