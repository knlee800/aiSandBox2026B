# UX-IA-36 CHECKPOINT — History Icon + Chat-History Panel Replacement

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-36
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Completed:** 2026-06-04
**Checkpoint doc:** `docs/UX-IA-36-CHECKPOINT.md`
**Depends on:** UX-IA-35 (COMPLETE and LOCKED — `docs/UX-IA-35-CHECKPOINT.md`)

---

## Task Metadata

| Field | Value |
|---|---|
| Task | UX-IA-36 — History Icon + Drawer (evolved to Chat-History Panel Replacement) |
| Priority | Medium |
| Nature | FRONTEND-ONLY / PROJECT WORKSPACE IA CLEANUP |
| Risk | Low-Medium |
| Validation | tsc PASS — npm test 576/576 PASS — ReadLints PASS — Live browser PASS |

---

## Exact Files Changed

| File | Change type |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Production — icon swap, in-panel history replacement, layout/scroll fix |
| `frontend/components/workspace/workspace-shell.test.tsx` | Tests — updated and new assertions |
| `frontend/messages/en.json` | i18n — added `project.openHistory`, `project.closeHistory`, `project.backToChat` |
| `frontend/messages/zh-TW.json` | i18n — same three keys, Traditional Chinese |
| `frontend/messages/zh-CN.json` | i18n — same three keys, Simplified Chinese |
| `frontend/app/[locale]/layout.tsx` | Layout — added `h-full` to `<html>` and `<body>` for height chain |

No backend, route, entity, model, sidebar, Command Input, or Build Targets files were changed.

---

## Chat/History Replacement Summary

The original scope called for a right-side drawer. After live UX review the implementation evolved through three revisions:

1. **Initial implementation:** ClockIcon in project header opens a right-side drawer with XMarkIcon close and backdrop.
2. **Revision 1:** Moved ClockIcon from project header to top-right of chat panel.
3. **Revision 2:** Replaced right-side drawer with in-panel content replacement — history content replaces chat thread content within the same chat panel. No drawer, no backdrop, no XMarkIcon.

**Final delivered behavior:**

- Old Chat / History segmented tab toggle removed entirely (`workspace-ai-panel-toggle`, `workspace-ai-panel-view-chat`, `workspace-ai-panel-view-history` gone).
- A single icon button sits in the top-right of the chat panel (`data-testid="workspace-history-drawer-toggle"`).
- **History mode OFF (default):** `ClockIcon` shown; `aria-label` / `title` = `project.openHistory`; chat content visible; history content hidden.
- **History mode ON:** `ChatBubbleLeftIcon` shown; `aria-label` / `title` = `project.backToChat`; history content visible; chat content hidden (in-panel replacement, not a drawer).
- Toggling again returns to chat mode.
- No right-side drawer, no backdrop, no XMarkIcon.
- All restore confirm UI (`workspace-restore-confirm-bar`, `workspace-restore-confirm-button`, `workspace-restore-cancel-button`) remains inside the history panel.
- All `history-*` child test IDs and history/checkpoint/revert/diff/compare/pin/snapshot/project behavior paths through `makeHistoryAndDashboardContent()` are fully preserved.

---

## Scroll / Height-Chain Fix Summary

The chat/history panel was unable to own its internal scrollbar because the top-level height chain was broken. Three root causes were identified and fixed across multiple revision passes:

| Fix | Element | Change |
|---|---|---|
| 1 | `<html>` in `layout.tsx` | Added `h-full` to className |
| 2 | `<body>` in `layout.tsx` | Added `className="h-full"` |
| 3 | `workspace-shell` root div (both paths) | Changed `min-h-screen` → `h-screen` |
| 4 | `workspace-project-view` | Added `overflow-hidden` |
| 5 | `workspace-project-ai-panel` aside | Changed `overflow-y-auto` → `overflow-hidden` |
| 6 | `chat-panel-shell` | Added `flex-1 min-h-0` |
| 7 | `workspace-chat-ai-panel` | Added `flex-1 min-h-0` |
| 8 | `workspace-ai-panel-chat-content` | Added `flex-1 min-h-0 flex flex-col` |
| 9 | `workspace-ai-panel-history-content` | Added `flex-1 min-h-0 overflow-y-auto` |
| 10 | `WorkspaceChatPanel` root div | Changed `flex flex-col` → `flex flex-col flex-1 min-h-0` |
| 11 | `workspace-chat-thread` | Changed `max-h-[60vh] overflow-y-auto` → `flex-1 min-h-0 overflow-y-auto` |

**Result:** Browser page no longer scrolls due to chat/history content. Chat thread scrolls inside its panel. Composer stays pinned at the bottom. History content scrolls inside the same panel when toggled on. Home / Projects / Templates views are unaffected (`workspace-content-shell` retains `overflow-y-auto`).

---

## i18n Keys Added

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `project.openHistory` | `"Open history"` | `"開啟歷史"` | `"打开历史"` |
| `project.closeHistory` | `"Close history"` | `"關閉歷史"` | `"关闭历史"` |
| `project.backToChat` | `"Back to chat"` | `"返回聊天"` | `"返回聊天"` |

All visible text uses i18n keys. No hardcoded English UI copy was added.

---

## Heroicons Used

| Icon | Source | When shown |
|---|---|---|
| `ClockIcon` | `@heroicons/react/24/outline` | History mode OFF (open history) |
| `ChatBubbleLeftIcon` | `@heroicons/react/24/outline` | History mode ON (back to chat) |

`XMarkIcon` was introduced in revision 1 (drawer) and removed in revision 2 (in-panel). No Lucide, Font Awesome, Material Icons, inline SVG, or emoji were added.

---

## data-testid Preservation

| test-id | Status |
|---|---|
| `workspace-history-drawer-toggle` | Preserved — icon button in chat panel top-right |
| `workspace-ai-panel-chat-content` | Preserved — chat content wrapper |
| `workspace-ai-panel-history-content` | Preserved — history content wrapper |
| `workspace-restore-confirm-bar` | Preserved inside history panel |
| `workspace-restore-confirm-button` | Preserved |
| `workspace-restore-cancel-button` | Preserved |
| All `history-*` child test IDs | Preserved via `makeHistoryAndDashboardContent()` |
| `workspace-ai-panel-toggle` | Removed (old segmented toggle) |
| `workspace-ai-panel-view-chat` | Removed |
| `workspace-ai-panel-view-history` | Removed |
| `workspace-history-drawer` | Never created (drawer abandoned) |
| `workspace-history-drawer-backdrop` | Never created |
| `workspace-history-drawer-close` | Never created |

---

## Tests Updated

All tests in `frontend/components/workspace/workspace-shell.test.tsx`:

- Old segmented toggle absent (`workspace-ai-panel-toggle`, `workspace-ai-panel-view-chat`, `workspace-ai-panel-view-history`)
- History toggle inside chat panel, not global project header
- Initial state: `ClockIcon`, `openHistory` label, chat content visible, history content hidden
- After toggle: `ChatBubbleLeftIcon`, `backToChat` label, history content visible, chat content hidden
- Toggle back: `ClockIcon`, `openHistory` label, chat content visible again
- No drawer / backdrop test IDs rendered (`doesNotMatch`)
- `ClockIcon` and `ChatBubbleLeftIcon` source assertions from `@heroicons/react/24/outline`
- `openHistory`, `closeHistory`, `backToChat` keys verified in all three locale files
- Chat/history panel layout class assertions (`flex-1`, `min-h-0`, `overflow-y-auto`, no `max-h-[60vh]`)
- `workspace-project-view` has `overflow-hidden`, not `overflow-y-auto`
- `workspace-project-ai-panel` has `overflow-hidden`, not `overflow-y-auto`
- `workspace-shell` has `h-screen`, not `min-h-screen`
- `layout.tsx` source has `h-full` on `<html>` and `<body>`
- All existing history/checkpoint/revert/diff/compare/pin/snapshot/project tests remain passing

**Test count:** 576 pass, 0 fail (up from ~555 before UX-IA-36).

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` (576 tests) | PASS — 576/576, 0 fail |
| `ReadLints` (all touched files) | PASS — no linter errors |
| `frontend/tsconfig.tsbuildinfo` | Restored after each validation run |
| Live browser smoke | PASS — page no longer scrolls, chat thread scrolls internally, composer pinned, history in-panel, Home/Projects/Templates unaffected |

---

## Non-Goals Confirmed

- No backend changes.
- No routing changes.
- No new npm dependencies.
- No sidebar changes (`workspace-sidebar.tsx` untouched).
- No Command Input changes.
- No Build Targets changes.
- No broad Project Workspace redesign.
- No platform auth, session, or security changes.
- No checkpoint/revert behavior altered.

---

## Next Recommended Step

Register and implement follow-up tasks identified during UX-IA-36 review:

- **UX-IA-37 — Hide Workspace Ready Status Box** (cosmetic status box in chat panel is unnecessary when workspace is loaded)
- **UX-IA-38 — Hide Project Trust Note** (recovery info note above chat/history panel is redundant for most users)
- **UX-IA-39 — Relocate Build Targets to Preview Panel** (Build Targets toolbar currently spans the full project view; should move inside the preview tab area)

These are separate tasks and must be registered before any implementation begins.
