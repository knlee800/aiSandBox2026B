# UX-IA-31 CHECKPOINT — Sidebar Navigation Icons and Compact Mode

**Task ID:** UX-IA-31
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-29
**Checkpoint file:** `docs/UX-IA-31-CHECKPOINT.md`

---

## Summary

Added Heroicons v2 Outline icons to the main sidebar navigation items (Home, Projects, Templates), implemented a compact icon-only mode with a sidebar toggle, and polished the sidebar height chain, bottom controls anchoring, and compact empty-space expand behavior.

---

## What was built

### Expanded mode
- Sidebar is full height (`h-full` on `<aside>`, resolved from parent flex-row stretch).
- Width: `md:w-72`.
- Temporary AS logo mark in the header.
- Collapse toggle button (top-right header) using `ArrowsRightLeftIcon` (Heroicons v2 Outline). `aria-label` / `title` from `workspace.collapseSidebar`.
- Main nav items: Home (`HomeIcon`), Projects (`FolderIcon`), Templates (`Squares2X2Icon`) with icon + label.
- Workspace control (select dropdown) visible.
- Recent projects section and individual project rows visible.
- Advanced (`footerContent`) visible.
- Usage / Quota summary card visible.
- Upgrade button and user avatar pinned to the very bottom via `mt-auto` flex layout.

### Compact mode
- Sidebar shrinks to `md:w-20` icon rail.
- No visible toggle or expand button in compact mode.
- Main nav items: icons only; labels are `sr-only`.
- Recent projects section hidden.
- Individual project rows hidden.
- Advanced (`footerContent`) hidden.
- Usage / Quota summary card hidden.
- Workspace control replaced by compact workspace icon/mark button; clicking it opens a flyout menu for workspace selection.
- Upgrade button: icon-only (`ArrowUpIcon`).
- User avatar: letter-in-circle only.
- Upgrade and avatar remain pinned to the bottom.
- Clicking empty/background middle space of the compact sidebar expands the sidebar (guarded handler on the `flex-1` middle `<div>`: `event.target === event.currentTarget` required).
- Clicking nav icons, workspace icon, upgrade icon, or avatar does NOT expand the sidebar.

---

## Height chain fix

`<aside>` uses `h-full` (not `min-h-screen`). The parent shell wrapper is in an `md:flex-row` container with `align-items: stretch` (default), so the sidebar gets a definite height from the flex algorithm. The inner wrapper uses `flex h-full flex-col`, giving the flex column a resolved height. `flex-1` on the middle section absorbs remaining space, making both the empty-space click area and the bottom controls pin work correctly.

---

## Files changed

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-sidebar.tsx` | Icons, compact mode, height chain, compact empty-space click handler |
| `frontend/components/workspace/workspace-shell.test.tsx` | Tests for all new sidebar behavior |
| `frontend/messages/en.json` | Added `workspace.expandSidebar`, `workspace.collapseSidebar` |
| `frontend/messages/zh-TW.json` | Added `workspace.expandSidebar` (展開側邊欄), `workspace.collapseSidebar` (收合側邊欄) |
| `frontend/messages/zh-CN.json` | Added `workspace.expandSidebar` (展开侧边栏), `workspace.collapseSidebar` (收起侧边栏) |
| `frontend/package.json` | Added `@heroicons/react` dependency |

---

## Icon standard applied

- Library: `@heroicons/react/24/outline` (Heroicons v2 Outline) only.
- Icons used: `HomeIcon`, `FolderIcon`, `Squares2X2Icon`, `ArrowsRightLeftIcon`, `ArrowUpIcon`, `BriefcaseIcon`.
- `ToggleLeftIcon` / `ToggleRightIcon` confirmed absent from the installed Heroicons package; `ArrowsRightLeftIcon` used as the sidebar toggle icon.
- No Lucide, Font Awesome, Material Icons, inline SVGs, or emoji introduced.

---

## i18n

- No hardcoded English user-facing copy.
- `workspace.expandSidebar` and `workspace.collapseSidebar` added to all three locale files.
- All `aria-label`, `title`, and visible label strings routed through `getWorkspaceScaffoldMessages`.

---

## Validation results

- `npx tsc --noEmit`: PASS
- `npm test`: PASS — 529 tests, 529 pass, 0 fail
- `ReadLints` on changed files: PASS
- Live browser test: PASS

---

## Locked invariants

- Heroicons v2 Outline only from `@heroicons/react/24/outline`. No other icon library.
- `h-full` on `<aside>` and inner wrapper. Do not reintroduce `min-h-screen` on these elements.
- `mt-auto` on `workspace-sidebar-bottom-controls`. Do not remove.
- Empty-space expand guard: `event.target === event.currentTarget` on the `flex-1` middle `<div>`. Do not remove or broaden.
- Compact toggle (`workspace-sidebar-compact-toggle`) is only rendered in expanded mode. Do not render a visible toggle button in compact mode.
- All user-facing/accessibility text must remain in locale files. No hardcoded English.
