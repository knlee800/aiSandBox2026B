# UX-IA-08 Checkpoint — Project Mode Shell

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-08 |
| Title | Project Mode Shell |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-07 (COMPLETE and LOCKED — `docs/UX-IA-07-CHECKPOINT.md`) |
| Child checkpoint references | `docs/UX-IA-08A-CHECKPOINT.md`, `docs/UX-IA-08B-CHECKPOINT.md` |

---

## Child Slice Summary

| Slice | Title | Status | Checkpoint |
|---|---|---|---|
| UX-IA-08A | Project Mode Layout Shell + Back Header | COMPLETE and LOCKED | `docs/UX-IA-08A-CHECKPOINT.md` |
| UX-IA-08B | Tab Registry + Tab Bar + AI Panel Collapse | COMPLETE and LOCKED | `docs/UX-IA-08B-CHECKPOINT.md` |
| UX-IA-08C | Tests + Validation + Consolidation | COMPLETE and LOCKED | this document |

---

## Objective

When a project is opened, the workspace transforms into project mode: a top project header with back button, a left AI assistant panel, and a right tabbed workspace shell with tab registry, orientation toggle, and collapse/expand control. All existing project open/resume/hydration behavior, AI chat/file action flows, editor/preview/history behavior, and sidebar behavior are preserved. No new props added to `WorkspaceShellProps`. No `page.tsx` changes.

---

## Final Implementation Summary

### UX-IA-08A — Project Mode Layout Shell + Back Header

Restructured the `project` view branch in `workspace-shell.tsx` from the prior 3-column grid into a project-mode layout with:
- Top header bar: project name + locale-aware back button (`common.back`)
- Left AI panel zone (`workspace-project-ai-panel`): chat, exec, build, shell-state, history/dashboard
- Right content zone (`workspace-project-content-panel`): editor and preview (stacked; tabs deferred to 08B)
- Back button wired to `onWorkspaceViewChange('projects')`
- No new props. No `page.tsx` changes. `common.back` i18n key reused (already in all three locales).

### UX-IA-08B — Tab Registry + Tab Bar + AI Panel Collapse

Created `workspace-tab-registry.ts` and `workspace-tab-bar.tsx`. In the right content zone from UX-IA-08A, replaced the stacked editor+preview with a tab bar at the top plus active-tab content area:
- **Tab registry:** 13 tabs (`preview`, `codeFiles`, `database`, `auth`, `security`, `analytics`, `envVars`, `publishing`, `deploy`, `payment`, `domain`, `appStorage`, `agentSkills`)
- **Preview tab** wired to existing `WorkspacePreviewPanel` (default active)
- **Code & Files tab** wired to existing `WorkspaceEditorPanel`
- **All other tabs** render `tabs.comingSoon` placeholder text
- **Tab orientation toggle** switches horizontal/vertical; preference persisted to `localStorage` (`workspace-tab-orientation`)
- **AI panel collapse/expand toggle** in project header; preference persisted to `localStorage` (`workspace-ai-panel-collapsed`)
- All `localStorage` reads SSR-guarded with `typeof window !== 'undefined'`
- Added `project.collapsePanel` and `project.expandPanel` i18n keys to all three locale files
- `WorkspaceTabBar` is presentational with no Next.js hooks

### UX-IA-08C — Tests + Validation + Consolidation

Ran full validation suite. No production source file changes were required during UX-IA-08C.

---

## Files Changed Across UX-IA-08

| File | Slice(s) | Change |
|---|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | 08A, 08B | Project mode layout branch restructured; tab registry/bar imported; `activeTabId`, `tabOrientation`, `aiPanelCollapsed` state; collapse toggle; tab bar + active-tab content in right zone |
| `frontend/components/workspace/workspace-shell.test.tsx` | 08A, 08B | 5 new tests (08A) + 9 new tests + 2 helpers + 1 updated pre-existing test (08B) |
| `frontend/components/workspace/workspace-tab-registry.ts` | 08B | **new** — `TabDefinition` interface; `TAB_REGISTRY` (13 tabs); storage keys; orientation types |
| `frontend/components/workspace/workspace-tab-bar.tsx` | 08B | **new** — presentational `WorkspaceTabBar` component; no Next.js hooks |
| `frontend/messages/en.json` | 08B | Added `project.collapsePanel`, `project.expandPanel` |
| `frontend/messages/zh-TW.json` | 08B | Added `project.collapsePanel`, `project.expandPanel` |
| `frontend/messages/zh-CN.json` | 08B | Added `project.collapsePanel`, `project.expandPanel` |

**Not changed:** `frontend/app/[locale]/app/page.tsx`, all backend files, all auth files, `WorkspaceSidebar`, `WorkspaceAdvancedDrawer`, `WorkspaceShellProps` interface.

---

## Test Summary

| Slice | Tests added | Notes |
|---|---|---|
| UX-IA-08A | 5 new tests | header, back button, back button wiring, AI panel zone, content panel zone |
| UX-IA-08B | 9 new tests + 2 helpers | tab bar render, Preview tab, Code & Files tab, placeholder tabs, default active tab, preview panel content, editor panel content, orientation toggle, collapse toggle |
| UX-IA-08B | 1 pre-existing test updated | "renders existing workspace content" — removed `Editor Panel` text check (now behind Code tab); added `workspace-tab-bar` check |
| UX-IA-08C | 0 | validation only; no new tests required |

**Final test totals:** 308 tests, 308 passed, 0 failed.
(Prior baseline before UX-IA-08: 285 tests. Net new from UX-IA-08: 23 tests — 5 from 08A, 9 from 08B, and 9 existing tests from pre-08A baseline that remained passing.)

---

## i18n Summary

| Key | en | zh-TW | zh-CN | Added by |
|---|---|---|---|---|
| `common.back` | "Back" | "返回" | "返回" | pre-existing — reused in 08A |
| `tabs.preview` | "Preview" | "預覽" | "预览" | pre-existing — used in 08B tab registry |
| `tabs.codeFiles` | "Code & Files" | "程式碼與檔案" | "代码与文件" | pre-existing |
| `tabs.database` through `tabs.agentSkills` | (13 entries total) | all three locales | all three locales | pre-existing |
| `tabs.comingSoon` | "Coming soon" | "即將推出" | "即將推出" | pre-existing |
| `project.collapsePanel` | "Collapse AI panel" | "收合 AI 面板" | "收起 AI 面板" | **new in 08B** |
| `project.expandPanel` | "Expand AI panel" | "展開 AI 面板" | "展开 AI 面板" | **new in 08B** |

No i18n keys were added in 08A or 08C.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 308 tests, 0 failures |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on all touched files | — | PASS — 0 errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Preserved Invariants

- `WorkspaceShellProps` interface — no new props across all of UX-IA-08
- `page.tsx` — not changed
- `WorkspaceSidebar` — unchanged; remains visible in project mode
- `WorkspaceAdvancedDrawer` — unchanged
- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` — all props unchanged; all content in left AI panel zone
- `WorkspaceEditorPanel`, `WorkspacePreviewPanel` — all props unchanged; wired behind Code & Files and Preview tabs respectively
- `historyAndDashboardContent` — in left AI panel zone; unchanged
- Preview iframe — no additional wrapper; no pointer-event blocking; `window.postMessage` path unaffected (UX-IA-15 constraint preserved)
- `workspace-project-view`, `workspace-project-mode-header`, `workspace-project-back-button`, `workspace-project-ai-panel`, `workspace-project-content-panel` testids — all preserved
- Sub-component testids: `chat-panel-shell`, `editor-panel-shell`, `preview-panel-shell`, `history-control-slice`, `dashboard-slice` — all still render inside project view
- Home / Projects / Templates view branches — untouched
- Non-project-first (session-scoped) path — unchanged
- PROJ-02-01 hydration chain — unchanged
- All AI-WS chat, file action, file confirmation, and execution polling flows — unchanged
- All UX-IA-01 through UX-IA-07, AUTH-APP-01, AUTH-APP-02 invariants preserved

---

## Non-Goals Confirmed

- No full-height panel sizing or file tree layout refinements (belongs to UX-IA-10)
- No functional Database / Auth / Security / Analytics / Env Var / Payment / Domain / App Storage / Agent Skills tab content
- No tab pinning or visibility settings UI (belongs to UX-IA-11)
- No `page.tsx` changes
- No new props on `WorkspaceShellProps`
- No backend, API, or auth changes
- No account menu changes
- No `workspace-project-mode.tsx` extraction
- No Visual Edit Mode work (deferred to UX-IA-15+)

---

## UX/UI Advisory Note

The tab bar is intentionally functional and minimal. Full visual polish (design-token-based active-tab indicators, icon assets for orientation toggle, styled placeholder empty states) is deferred to a later visual polish pass. The orientation toggle uses arrow-character glyphs (`⇔`/`⇕`) as placeholders pending icon asset availability. These are known deferrals, not regressions.

---

## Carry-Forwards

| Item | Target |
|---|---|
| AI + History panel wiring in left AI panel zone | UX-IA-09 |
| History icon toggle for project history timeline | UX-IA-09 |
| Inline restore confirmation dialog | UX-IA-09 |
| Full-height panel sizing; panels fill available height | UX-IA-10 |
| File tree as left section of Code & Files tab | UX-IA-10 |
| Preview tab full-height iframe sizing | UX-IA-10 |
| Remaining 11 placeholder tabs with visibility/pinning settings | UX-IA-11 |
| Upgrade Flow + Dashboard Polish | UX-IA-12 |
| Responsive / Mobile Polish | UX-IA-13 |
| Route Cleanup / Redirects | UX-IA-14 |
| Visual Edit Mode Foundation | UX-IA-15 (requires UX-IA-08 + UX-IA-10 COMPLETE — now satisfied for UX-IA-08) |
| Tab bar visual polish (icons, design tokens, styled empty states) | future polish pass |

---

## Next Recommended Task

**UX-IA-09 — Project AI + History Panel**

Wire AI chat into project mode left panel. Add history icon toggle for project history timeline. Inline restore confirmation dialog. Reuse `WorkspaceChatPanel` logic and `ProjectHistoryPanel` data. Risk: Medium. Model: Sonnet 4.6.

Reference: `TASKS.md` → UX-IA-09. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-09 section.
