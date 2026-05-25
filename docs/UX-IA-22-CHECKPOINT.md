# UX-IA-22 Checkpoint — Fix Sidebar Workspace Selector Label

**Task ID:** UX-IA-22
**Family:** UX-IA
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-25
**Depends on:** UX-IA-21 (COMPLETE and LOCKED — `docs/UX-IA-21-CHECKPOINT.md`)

---

## Objective

The sidebar workspace selector `<label>` rendered "PROJECTS" (from `workspace.projects`) above a dropdown that selects among workspaces, not projects. This mislabeled a workspace control and confused the Workspace / Project / Session hierarchy. A dedicated `workspace.workspaceLabel` i18n key was added and applied to the three affected spots in the sidebar selector block.

---

## Files Changed

**Production source (implementation):**
- `frontend/components/workspace/workspace-sidebar.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

**Tests (updated):**
- `frontend/components/workspace/workspace-shell.test.tsx`

**Not changed:**
- All backend/API/service files — not changed.
- All routes, models, or entities — not changed.
- `frontend/app/[locale]/app/page.tsx` — not changed.
- All governance/checkpoint docs (other than this file) — not changed during implementation.

---

## i18n Key Added

Added `workspace.workspaceLabel` to all three locale files:

| Locale | Key | Value |
|---|---|---|
| `en.json` | `workspace.workspaceLabel` | `"Workspace"` |
| `zh-TW.json` | `workspace.workspaceLabel` | `"工作區"` |
| `zh-CN.json` | `workspace.workspaceLabel` | `"工作区"` |

No existing keys were renamed or removed.

---

## Wiring Summary

In `frontend/components/workspace/workspace-sidebar.tsx`, `getWorkspaceScaffoldMessages` was updated to expose the new key:

```ts
workspaceLabel: read('workspace.workspaceLabel'),
```

Three locations in the workspace-selector block were updated to use `messages.workspaceLabel` instead of `messages.projects`:

| Location | Before | After |
|---|---|---|
| `<label>` above workspace dropdown | `messages.projects` | `messages.workspaceLabel` |
| Sidebar header subtitle fallback | `selectedWorkspace?.name ?? messages.projects` | `selectedWorkspace?.name ?? messages.workspaceLabel` |
| Disabled `<option>` placeholder fallback | `selectedWorkspace?.name ?? messages.projects` | `selectedWorkspace?.name ?? messages.workspaceLabel` |

The sidebar nav tab entry (`['projects', messages.projects]`) was **not changed** — it correctly navigates to the project list view.

Layout, classNames, behavior, and all `data-testid` values were preserved.

---

## Tests Updated

`frontend/components/workspace/workspace-shell.test.tsx` — added focused describe block:

**`workspace sidebar workspace-label wiring — UX-IA-22`**

| Test | What it asserts |
|---|---|
| `locale files define workspace.workspaceLabel in all supported locales` | `en.workspace.workspaceLabel === 'Workspace'`, `zh-TW === '工作區'`, `zh-CN === '工作区'` |
| `workspace sidebar source uses workspaceLabel for workspace selector and fallbacks` | Sidebar source contains `workspaceLabel: read('workspace.workspaceLabel')`, label JSX uses `messages.workspaceLabel`, two fallback usages of `selectedWorkspace?.name ?? messages.workspaceLabel` |
| `workspace sidebar projects nav tab remains wired to messages.projects` | Sidebar source contains `['projects', messages.projects]` |

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` (from `frontend/`) | PASS |
| `npm test` (from `frontend/`) | PASS — 480 tests, 480 pass, 0 fail |
| `ReadLints` on touched files | PASS — 0 new errors |
| `frontend/tsconfig.tsbuildinfo` | Restored after validation run |

---

## Non-Goals Confirmed

- No backend or API changes.
- No route, model, or entity rename.
- No broad IA redesign.
- No cleanup of unrelated Project/Workspace copy (e.g., hardcoded strings in history panel).
- No TASK-75A work.
- No existing i18n key renamed or removed.

---

## No Backend / Governance / Route / Entity Changes

No backend files, governance docs, route files, or database entity files were changed during implementation or consolidation.

---

## Next Recommended Step

Select and register the next UX-IA slice or family task.
