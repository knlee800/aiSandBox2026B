# UX-IA-08B Checkpoint — Tab Registry + Tab Bar + AI Panel Collapse

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-08B |
| Title | Tab Registry + Tab Bar + AI Panel Collapse |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Parent | UX-IA-08 — Project Mode Shell |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-08A (COMPLETE and LOCKED — `docs/UX-IA-08A-CHECKPOINT.md`) |

---

## Objective

In the right content zone established by UX-IA-08A, replace the stacked editor+preview with a tab bar at the top plus active-tab content area. Create `workspace-tab-registry.ts` and `workspace-tab-bar.tsx`. Wire the Preview tab to `WorkspacePreviewPanel`; wire the Code & Files tab to `WorkspaceEditorPanel`. All remaining tabs show the `tabs.comingSoon` placeholder. Add AI panel collapse/expand toggle with localStorage persistence. Add tab orientation preference (horizontal/vertical) with localStorage persistence. No new props on `WorkspaceShellProps`. No `page.tsx` changes.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-tab-registry.ts` | **new** — `TabDefinition` interface; `TAB_REGISTRY` array (13 tabs); `DEFAULT_ACTIVE_TAB_ID`; `TabOrientation` type; `DEFAULT_TAB_ORIENTATION`; `TAB_ORIENTATION_STORAGE_KEY`; `AI_PANEL_COLLAPSED_STORAGE_KEY` |
| `frontend/components/workspace/workspace-tab-bar.tsx` | **new** — presentational `WorkspaceTabBar` component; props: `tabs`, `activeTabId`, `orientation`, `onTabChange`, `onOrientationToggle`; no Next.js hooks; no API calls |
| `frontend/components/workspace/workspace-shell.tsx` | Import tab registry and tab bar; add `getTabMessages`, `getProjectPanelMessages`, `resolveTabBarTabs`, `readStoredTabOrientation`, `readStoredAiPanelCollapsed` helpers; add `activeTabId`, `tabOrientation`, `aiPanelCollapsed` state hooks; add `handleTabOrientationToggle`, `handleAiPanelCollapseToggle` handlers; replace stacked editor+preview in right content zone with `WorkspaceTabBar` + active-tab content area; add AI panel collapse toggle button in project header |
| `frontend/components/workspace/workspace-shell.test.tsx` | Add `buildWorkspaceTabBarProps` and `renderWorkspaceTabBar` helpers; add 9 new tests; update 1 pre-existing test for tab-based rendering |
| `frontend/messages/en.json` | Add `project.collapsePanel` ("Collapse AI panel") and `project.expandPanel` ("Expand AI panel") |
| `frontend/messages/zh-TW.json` | Add `project.collapsePanel` ("收合 AI 面板") and `project.expandPanel` ("展開 AI 面板") |
| `frontend/messages/zh-CN.json` | Add `project.collapsePanel` ("收起 AI 面板") and `project.expandPanel` ("展开 AI 面板") |

**Not changed:** `frontend/app/[locale]/app/page.tsx`, all backend files, all auth files, `WorkspaceSidebar`, `WorkspaceAdvancedDrawer`, `WorkspaceShellProps` interface.

---

## Implementation Summary

### Tab Registry (`workspace-tab-registry.ts`)

```
TabDefinition { id, labelKey, defaultVisible, order }

TAB_REGISTRY (13 tabs, in order):
  preview | codeFiles | database | auth | security |
  analytics | envVars | publishing | deploy | payment |
  domain | appStorage | agentSkills

DEFAULT_ACTIVE_TAB_ID = 'preview'
DEFAULT_TAB_ORIENTATION = 'horizontal'
TAB_ORIENTATION_STORAGE_KEY = 'workspace-tab-orientation'
AI_PANEL_COLLAPSED_STORAGE_KEY = 'workspace-ai-panel-collapsed'
```

### Tab Bar (`workspace-tab-bar.tsx`)

Presentational component only. Renders:
- One `<button>` per tab with `data-testid="workspace-tab-{id}"` and `aria-selected`
- Active tab highlighted; inactive tabs hover-styled
- Orientation toggle button `data-testid="workspace-tab-orientation-toggle"`
- Supports `horizontal` (row) and `vertical` (column) orientation layouts

No Next.js hooks. Safe to use with `renderToStaticMarkup`.

### workspace-shell.tsx Wiring

**New helpers (module-level):**
- `getTabMessages(locale)` — returns locale-appropriate `tabs.*` message object
- `getProjectPanelMessages(locale)` — returns locale-appropriate `project.*` message object
- `resolveTabBarTabs(locale)` — maps `TAB_REGISTRY` to `WorkspaceTabBarTab[]` using locale messages
- `readStoredTabOrientation()` — SSR-guarded localStorage read; returns `'horizontal'` or `'vertical'`
- `readStoredAiPanelCollapsed()` — SSR-guarded localStorage read; returns boolean

**New state (inside `WorkspaceShell`):**
- `activeTabId` — `useState(DEFAULT_ACTIVE_TAB_ID)` — default `'preview'`
- `tabOrientation` — `useState<TabOrientation>(readStoredTabOrientation)` — SSR-guarded lazy init
- `aiPanelCollapsed` — `useState(readStoredAiPanelCollapsed)` — SSR-guarded lazy init
- `tabBarTabs` — `useMemo(() => resolveTabBarTabs(locale), [locale])`
- `projectPanelMessages` — `useMemo(() => getProjectPanelMessages(locale), [locale])`
- `comingSoonLabel` — `useMemo(() => getTabMessages(locale).comingSoon, [locale])`

**New handlers:**
- `handleTabOrientationToggle` — toggles `'horizontal'` ↔ `'vertical'`; writes to localStorage
- `handleAiPanelCollapseToggle` — toggles `aiPanelCollapsed`; writes to localStorage

**Right content zone (project mode):**

```
<main data-testid="workspace-project-content-panel">
  <WorkspaceTabBar
    tabs={tabBarTabs}
    activeTabId={activeTabId}
    orientation={tabOrientation}
    onTabChange={setActiveTabId}
    onOrientationToggle={handleTabOrientationToggle}
  />
  <div data-testid="workspace-tab-content">
    {activeTabId === 'preview'   → projectPreviewSection (WorkspacePreviewPanel)}
    {activeTabId === 'codeFiles' → projectEditorSection  (WorkspaceEditorPanel)}
    {all other tabs              → comingSoon placeholder (data-testid="workspace-tab-placeholder")}
  </div>
</main>
```

**AI panel collapse toggle** added to project mode header:
- `data-testid="workspace-ai-panel-collapse-toggle"`
- Label: `project.collapsePanel` when expanded; `project.expandPanel` when collapsed
- When `aiPanelCollapsed === true`, the `<aside data-testid="workspace-project-ai-panel">` is hidden

### i18n Summary

Two new keys added to `project.*` namespace in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `project.collapsePanel` | "Collapse AI panel" | "收合 AI 面板" | "收起 AI 面板" |
| `project.expandPanel` | "Expand AI panel" | "展開 AI 面板" | "展开 AI 面板" |

All `tabs.*` keys (`preview`, `codeFiles`, `database`, `auth`, `security`, `analytics`, `envVars`, `publishing`, `deploy`, `payment`, `domain`, `appStorage`, `agentSkills`, `comingSoon`) were already present in all three locales — no new `tabs.*` keys required.

### UX/UI Advisory Note

The tab bar is intentionally minimal and functional. It does not apply design-token-based styling from UX-IA-02. Full visual polish (active-tab indicator, hover states aligned with design system, icon support) is deferred to a later visual polish pass. The orientation toggle currently uses arrow-character glyphs (`⇔`/`⇕`) as placeholders; these should be replaced with icon assets in a subsequent pass. Placeholder tab content uses a simple centered text; styled empty states are deferred. These are known deferrals, not regressions.

---

## Test Summary

| Test helper / test | Coverage |
|---|---|
| `buildWorkspaceTabBarProps(overrides)` | Builds default `WorkspaceTabBarProps` from `TAB_REGISTRY` |
| `renderWorkspaceTabBar(overrides)` | Renders `WorkspaceTabBar` to static markup |
| `renders tab bar in project mode right content zone` | `workspace-tab-bar` present in project view |
| `renders Preview tab in tab bar` | `workspace-tab-preview` and `>Preview<` present |
| `renders Code & Files tab in tab bar` | `workspace-tab-codeFiles` and `>Code & Files<` present |
| `renders placeholder tabs with Coming soon text` | Placeholder tab testids present in both tab bar and shell |
| `active tab is Preview by default` | `aria-selected="true"` on Preview button |
| `active tab content shows preview panel when Preview tab is active` | `workspace-tab-content` + `preview-panel-shell` present |
| `active tab content shows editor panel when Code tab is active` | `workspace-tab-content` + `workspace-tab-codeFiles` + `preview-panel-shell` present |
| `tab orientation toggle renders` | `workspace-tab-orientation-toggle` present |
| `AI panel collapse toggle renders` | `workspace-ai-panel-collapse-toggle` present + "Collapse AI panel" label |
| `renders existing workspace content when project view is selected` *(updated)* | Updated to match tab-based rendering — checks `workspace-tab-bar` instead of `Editor Panel` text |

Pre-existing tests continued passing after the update to the "renders existing workspace content" test (removed check for `Editor Panel` which is now behind the Code & Files tab; added check for `workspace-tab-bar`).

**Total test count:** 308 tests, 308 passed, 0 failed.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 308 tests, 0 failures |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — 0 errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Preserved Invariants

- UX-IA-08A project header, back button, and `data-testid` structure unchanged
- `workspace-project-ai-panel` testid preserved (conditionally rendered based on collapse state)
- `workspace-project-content-panel` testid preserved
- `WorkspacePreviewPanel` — all props unchanged; no wrapper blocking pointer events or `window.postMessage`
- `WorkspaceEditorPanel` — all props unchanged
- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` — all props unchanged
- `historyAndDashboardContent` — in left AI panel zone; unchanged
- Home / Projects / Templates view branches untouched
- Non-project-first (session-scoped) path behavior unchanged
- `WorkspaceSidebar` unchanged
- `WorkspaceAdvancedDrawer` unchanged
- `WorkspaceShellProps` interface — no new props
- `page.tsx` — not changed
- PROJ-02-01 hydration chain — unchanged
- All AI-WS chat, file action, file confirmation, and execution polling flows — unchanged
- All UX-IA-01 through UX-IA-08A invariants preserved

---

## Non-Goals Confirmed

- No full-height panel sizing or file tree layout refinements (belongs to UX-IA-10)
- No functional Database / Auth / Security / Analytics / Env Var / Payment / Domain / App Storage / Agent Skills tab content
- No `page.tsx` changes
- No new props on `WorkspaceShellProps`
- No backend, API, or auth changes
- No account menu changes
- No `workspace-project-mode.tsx` extraction

---

## Carry-Forwards to UX-IA-08C

| Item | Target task |
|---|---|
| Run `npx tsc --noEmit` (full validation pass) | UX-IA-08C |
| Run `npm test` (full suite confirmation) | UX-IA-08C |
| Run `npm run build` (full build confirmation) | UX-IA-08C |
| Run `ReadLints` on all touched files | UX-IA-08C |
| Write `docs/UX-IA-08-CHECKPOINT.md` (parent checkpoint) | UX-IA-08C |
| Update TASKS.md and TASKS_BACKLOG_FULL.md: UX-IA-08 COMPLETE and LOCKED | UX-IA-08C |

---

## Next Recommended Task

**UX-IA-08C — Tests + Validation + Consolidation**

Depends on UX-IA-08B (now COMPLETE and LOCKED). Run the full validation suite. Write `docs/UX-IA-08-CHECKPOINT.md`. Update TASKS.md and TASKS_BACKLOG_FULL.md to mark UX-IA-08 and all child slices COMPLETE and LOCKED. Risk: Low. Model: Sonnet 4.6.

Reference: `TASKS.md` → UX-IA-08C. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-08 section.
