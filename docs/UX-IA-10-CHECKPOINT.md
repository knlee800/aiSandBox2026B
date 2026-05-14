# UX-IA-10 Checkpoint — Preview + Code & Files Tabs

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-10 |
| Title | Preview + Code & Files Tabs |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-09 (COMPLETE and LOCKED — `docs/UX-IA-09-CHECKPOINT.md`) |
| Risk | Medium |
| Loop | 3-step (implement — verify tests — consolidate) |
| Model | Sonnet 4.6 |

---

## Objective

Wire the Preview and Code & Files tabs inside the UX-IA-08 project-mode tab shell to render their content panels at full height. The Preview tab iframe and the Code & Files tab textarea/file-tree now fill the available vertical space in the right content zone. The legacy non-project-first-UX path is preserved unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Tab content wrapper CSS; full-height tab rendering; `fillHeight` prop on `WorkspacePreviewPanel` and `WorkspaceEditorPanel` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Updated 2 existing tests; added 5 new focused tests |

**Not changed:** `frontend/messages/*.json`, `workspace-tab-registry.ts`, `workspace-tab-bar.tsx`, `page.tsx`, `WorkspaceShellProps` interface, all backend files, all auth files.

---

## Implementation Summary

### Tab content wrapper

Changed `workspace-tab-content` wrapper:
- **Before:** `flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-2`
- **After:** `flex-1 min-h-0 overflow-hidden flex flex-col`

The wrapper no longer scrolls itself or adds padding/gap. Individual tab panels are responsible for their own overflow behaviour.

### Preview tab — full-height wiring

Replaced inline tab rendering for `activeTabId === 'preview'` from the old `projectPreviewSection` variable (card-wrapped, debug heading) to a full-height shell:

```tsx
<div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="preview-panel-shell">
  <WorkspacePreviewPanel ... fillHeight />
</div>
```

Added optional `fillHeight?: boolean` to `WorkspacePreviewPanel`. When `true`:
- Panel container: `flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-gray-50 p-2`
- iframe: `mt-2 w-full flex-1 min-h-0 rounded border border-gray-200 bg-white`

When `false`/undefined (legacy path):
- Panel container: `rounded border border-gray-200 bg-gray-50 p-2` (unchanged)
- iframe: `mt-2 h-56 w-full rounded border border-gray-200 bg-white` (unchanged)

All iframe props untouched: `src`, `onLoad`, `onError`, `title`, `data-testid`. The `window.postMessage` path and Visual Edit Mode compatibility constraint (UX-IA-15) are fully preserved.

### Code & Files tab — full-height wiring

Replaced inline tab rendering for `activeTabId === 'codeFiles'` from the old `projectEditorSection` variable to a full-height shell:

```tsx
<div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="editor-panel-shell">
  <WorkspaceEditorPanel ... fillHeight />
</div>
```

Added optional `fillHeight?: boolean` to `WorkspaceEditorPanel`. When `true`:
- Panel container: `flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-gray-50 p-2`
- Ready-state layout: `mt-2 flex flex-1 min-h-0 gap-2`
- File tree pane: `flex flex-col min-h-0 w-56 shrink-0 overflow-y-auto rounded border border-gray-200 bg-white p-2` (scrolls independently)
- Editor pane: `flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-white p-2`
- Textarea: `mt-2 flex-1 min-h-0 w-full resize-none overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-800 disabled:bg-gray-100 disabled:text-gray-500`

When `false`/undefined (legacy path):
- All existing classes preserved: `grid gap-2 md:grid-cols-[14rem_1fr]`, `h-56` textarea (unchanged)

All editor behaviour unchanged: file tree selection, file content display, save handler, `onChange`, AI-WS file action flow.

### Placeholder tab

Placeholder `workspace-tab-placeholder` rendering unchanged in content; added `p-4` padding to the container for better visual spacing.

### Legacy path preservation

`projectPreviewSection`, `projectEditorSection`, and `projectWorkspaceContent` variables remain **unchanged**. They are still used by the `!projectFirstUxEnabled` early-return path. Those panels call `WorkspacePreviewPanel` and `WorkspaceEditorPanel` without `fillHeight`, preserving the existing fixed-height behaviour in the legacy layout.

---

## Test Summary

| Change | Description |
|---|---|
| Updated existing | `'renders existing workspace content when project view is selected'` — replaced assertion for removed tab-context `"Preview Panel"` heading with `workspace-preview-panel` testid assertion |
| Updated existing | `'active tab content shows preview panel when Preview tab is active'` — added `workspace-preview-panel` match; added `doesNotMatch` for old `"Preview Panel"` heading |
| New test | `'tab content wrapper renders with full-height overflow-hidden layout'` — uses `renderWorkspaceShellElementByTestId` to verify `workspace-tab-content` className contains `overflow-hidden`, not `overflow-y-auto` |
| New test | `'preview panel shell renders full-height tab content and contains workspace preview panel'` — verifies `preview-panel-shell` and `workspace-preview-panel` elements exist; asserts className contains `flex`, `flex-col`, `flex-1`, `min-h-0`, `overflow-hidden` |
| New test | `'editor panel shell can render in Code & Files tab path where statically testable'` — verifies `workspace-tab-codeFiles` button is found and exposes `onClick` handler |
| New test | `'default preview tab does not render workspace tab placeholder'` — verifies `workspace-tab-placeholder` is absent in default preview-active state |
| New test | `'legacy non-project-first path still renders preview-panel-shell and editor-panel-shell'` — regression guard for legacy layout |

Prior baseline: 313 tests. Net new from UX-IA-10: 4 new tests (1 existing renamed/replaced) = 317 total.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 317 tests, 317 passed, 0 failed |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — 0 errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No Visual Edit Mode (deferred to UX-IA-15+)
- No new functional Database/Auth/Security/Analytics/Env Var/Payment/Domain/App Storage/Agent Skills tab content
- No tab pinning or visibility settings UI (deferred to UX-IA-11)
- No backend/API changes
- No auth changes
- No route cleanup
- No account menu changes
- No Templates/Community changes
- No Monaco Editor integration or new editor features
- No broad refactor
- No new dependencies
- No `workspace-project-mode.tsx` created
- No `page.tsx` changes
- No new props on `WorkspaceShellProps`
- No new i18n keys

---

## Preserved Invariants

- `WorkspaceShellProps` interface — unchanged
- `page.tsx` — not changed
- `WorkspaceSidebar`, `WorkspaceAdvancedDrawer` — unchanged
- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` — all props unchanged; all AI-WS chat, file action, and execution polling flows unaffected
- `WorkspacePreviewPanel` iframe — `src`, `onLoad`, `onError`, `title`, `data-testid` all unchanged; `window.postMessage` path preserved; Visual Edit Mode compatibility maintained (UX-IA-15 constraint)
- `WorkspaceEditorPanel` — file tree selection, file content display, save handler, `onChange`, and all AI-WS file action flows unchanged
- UX-IA-09 testids: `workspace-ai-panel-toggle`, `workspace-ai-panel-view-chat`, `workspace-ai-panel-view-history`, `workspace-restore-confirm-bar`, `workspace-restore-confirm-button`, `workspace-restore-cancel-button` — all preserved
- UX-IA-08 testids: `workspace-project-view`, `workspace-project-mode-header`, `workspace-project-back-button`, `workspace-project-ai-panel`, `workspace-project-content-panel` — all preserved
- UX-IA-08B testids: `workspace-tab-bar`, `workspace-ai-panel-collapse-toggle`, `workspace-tab-content` — all preserved
- Sub-component testids: `workspace-preview-panel`, `workspace-editor-panel`, `workspace-file-tree`, `workspace-save-file`, `workspace-selected-file-content`, `preview-panel-shell`, `editor-panel-shell`, `history-control-slice`, `dashboard-slice` — all still render
- `projectPreviewSection`, `projectEditorSection`, `projectWorkspaceContent` variables — unchanged; legacy path continues working
- PROJ-02-01 hydration chain — unaffected
- AUTH-APP-01/02 invariants — preserved
- All UX-IA-04 through UX-IA-09 invariants — preserved

---

## Carry-Forwards

| Item | Target |
|---|---|
| Remaining 11 placeholder tabs with visibility/pinning settings | UX-IA-11 |
| Upgrade Flow + Dashboard Polish | UX-IA-12 |
| Responsive / Mobile Polish | UX-IA-13 |
| Route Cleanup / Redirects | UX-IA-14 |
| Visual Edit Mode Foundation | UX-IA-15 (requires UX-IA-08 + UX-IA-10 COMPLETE — now met) |
| Tab bar visual polish (icons, design tokens, styled empty states) | future polish pass |
| AUTH-MODULE-01 enablement | requires UX-IA-08 + UX-IA-10 COMPLETE — now met |

---

## Next Recommended Task

**UX-IA-11 — Future Product Tab Placeholders**

Register all remaining 11 placeholder tabs with placeholder content and tab pinning/visibility settings in localStorage. Risk: Low. Model: Sonnet 4.6.

Reference: `TASKS.md` → UX-IA-11. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-11 section.
