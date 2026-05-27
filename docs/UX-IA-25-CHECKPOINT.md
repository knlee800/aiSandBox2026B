# UX-IA-25 CHECKPOINT — Projects Page IA Cleanup — Hide Workspace Admin Controls from Projects View

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-25
**Family:** UX-IA
**Nature:** FRONTEND-ONLY / UX IA CLEANUP
**Risk:** Low
**Completed:** 2026-05-27
**Depends on:** UX-IA-24 (COMPLETE and LOCKED — `docs/UX-IA-24-CHECKPOINT.md`)

---

## Problem solved

The Projects view (`projectsWorkspaceContent`) appended `historyAndDashboardContent`, which rendered `HistoryProjectPanel` including full workspace admin controls — workspace selector, create workspace, rename workspace, delete workspace. These controls are already accessible in the sidebar dropdown and were polluting the Projects page with duplicate admin UI.

---

## Files changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Added `hideWorkspaceAdminControls?: boolean` to `HistoryProjectPanel` props; added `shouldShowWorkspaceAdminControls` gate; converted `historyAndDashboardContent` const into `makeHistoryAndDashboardContent(opts?)` function; Projects view call site passes `{ hideWorkspaceAdminControls: true }`; project/session view and aside panel call sites pass no opts (admin controls shown) |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added tests: Projects view hides workspace admin controls; active project view still shows workspace admin controls; source assertions verify options signature, prop pass-through, Projects view usage, and absence of new hardcoded copy |

No backend, API, route, model, entity, i18n, or governance files were changed.

---

## IA cleanup summary

- `history-workspace-select` — hidden in Projects view, still present in project/session view and aside panel.
- `history-workspace-create-input` / `history-workspace-create-button` — hidden in Projects view, still present in project/session view and aside panel.
- `history-workspace-rename-input` / `history-workspace-rename-button` / `history-workspace-delete-button` — hidden in Projects view, still present in project/session view and aside panel.
- `history-workspace-action-error` — hidden in Projects view when admin controls hidden.
- All other `HistoryProjectPanel` content (project list, session history, dashboard) unaffected.

---

## Multilingual compliance

No new user-facing text was added. No i18n files were changed. Multilingual compliance maintained.

---

## Tests updated

| Test | Assertion |
|---|---|
| `Projects view hides workspace-admin controls` | `history-workspace-select`, `history-workspace-create-input`, `history-workspace-rename-input`, `history-workspace-delete-button` absent from render |
| `Active project view still shows workspace-admin controls` | Same controls present when `hideWorkspaceAdminControls` not set |
| Source assertions | `makeHistoryAndDashboardContent` options signature, `hideWorkspaceAdminControls` pass-through, Projects view passes `hideWorkspaceAdminControls: true`, no new hardcoded copy string |

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 492 tests, 492 pass, 0 fail |
| `ReadLints` on all touched files | PASS — 0 errors |

---

## Non-goals confirmed

- No backend or API changes.
- No i18n files changed.
- No route, model, or entity changes.
- No new modal or prompt system.
- No broad workspace shell redesign.
- No TASK-75A work.
- No hardcoded English user-facing copy.
- No governance file changes during implementation.

---

## Next recommended step

UX-IA-26 Slice B — focused Create Workspace panel from dropdown: replace the current route-to-Projects redirect with an inline or panel-based workspace creation flow triggered directly from the sidebar dropdown "Create new workspace" option.
