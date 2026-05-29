# UX-IA-29 CHECKPOINT — Remove Legacy My Projects Admin Panel from Projects Page

**Task ID:** UX-IA-29
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-29
**Depends on:** UX-IA-28 (COMPLETE and LOCKED — `docs/UX-IA-28-CHECKPOINT.md`)

---

## What was done

Removed the legacy My Projects admin panel from the Projects page only.

The single change in `workspace-shell.tsx`: removed the `makeHistoryAndDashboardContent(...)` call from `projectsWorkspaceContent`. This eliminated the following legacy controls from the Projects page render:

- My Projects heading
- "Create and open your projects here…" prompt
- New project name / Create Project form (`history-project-name-input`, `history-project-create-button`)
- Project selector / Open Project (`history-project-select`, `history-project-open-button`)
- Move to Workspace legacy controls (`history-project-move-button`)
- Sharing / Visibility legacy controls (`history-project-sharing-surface`)
- Public Projects / View / Fork section (`history-public-project-surface`)
- History & Controls section header
- Dashboard section

`HistoryProjectPanel` / `makeHistoryAndDashboardContent` remain fully intact in:
- Active project view (History tab in the aside AI panel)
- Legacy non-project-first path

---

## Files changed

**Production source (implementation):**
- `frontend/components/workspace/workspace-shell.tsx` — removed 3-line `makeHistoryAndDashboardContent(...)` block from `projectsWorkspaceContent`

**Tests:**
- `frontend/components/workspace/workspace-shell.test.tsx` — updated Projects-view coverage:
  - Replaced two legacy tests with `'projects view keeps modern projects surface and hides legacy My Projects admin panel'` — asserts modern surface present, legacy admin panel test IDs absent
  - Updated `'keeps workspace-admin history controls in active project view'` — extended to verify all history panel test IDs are present in project view
  - Replaced `'restore-related buttons and handlers remain wired where statically testable'` with `'renders project history restore controls in active project view'` — verifies restore rows render in project view (where they actually appear)
  - Replaced `'confirms before restoring a project history row and calls handler once on accept'` with `'project history restore action queues pending restore in active project view'` — verifies pending-restore state is set (not confirm-prompt path) in project view
  - Replaced `'does not call restore handler when project history restore confirmation is declined'` with `'project restore confirm/cancel controls render from pending state and stay wired'` — verifies confirm/cancel bar renders when pending state is set
  - Updated `'workspace shell source keeps projectsWorkspaceContent free of makeHistoryAndDashboardContent call'` — source-level assertion that `projectsWorkspaceContent` no longer contains a `makeHistoryAndDashboardContent(` call

---

## What was preserved

- `workspace-projects-surface` and all contained modern controls
- New Project inline flow (`workspace-projects-new-project-button`, `workspace-projects-new-project-input`)
- Project cards (`workspace-project-card-*`)
- Card actions menu (`workspace-project-card-actions-button-*`)
- Focused Move panel (`workspace-projects-focused-move-panel`)
- Focused Visibility panel (`workspace-projects-focused-visibility-panel`)
- All active project/session and aside history controls (unmodified)

---

## Non-goals confirmed

- No backend changes
- No route/model/entity rename
- No public projects relocation implementation
- No Templates & Community changes
- No workspace settings work
- No TASK-75A work
- No i18n changes (no new visible text)
- No frontend/messages/*.json changes
- No governance or checkpoint docs changed during implementation

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 511 tests, 511 pass, 0 fail |
| `ReadLints` on touched files | PASS — 0 new errors |

---

## Next live-test step

Open the app in a browser with `projectFirstUxEnabled: true`. Navigate to the Projects tab. Confirm:
1. No "My Projects", "Create and open your projects here…", project name input, or project selector is visible.
2. Project cards, New Project button, grid/list toggle, card "…" menu, focused Move and Visibility panels all function normally.
3. Open any project → History tab → confirm History & Controls and project history rows are still present in the aside panel.
