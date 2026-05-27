# UX-IA-27 CHECKPOINT — Project Card Actions Menu for Move and Visibility

**Task ID:** UX-IA-27
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND-ONLY / UX IA CLEANUP
**Risk:** Low-Medium
**Depends on:** UX-IA-26 (COMPLETE and LOCKED — `docs/UX-IA-26-CHECKPOINT.md`)
**Checkpoint date:** 2026-05-27

---

## Problem Solved

Project-level secondary actions (Move to workspace, Sharing / visibility) were only accessible from the old admin-style `HistoryProjectPanel`. This slice adds a restrained "..." actions menu on each project card so users can access these actions from the project itself.

---

## Files Changed (Production Source)

- `frontend/components/workspace/workspace-project-card.tsx`
- `frontend/components/workspace/workspace-shell.tsx`

## Files Changed (Locale / i18n)

- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

## Files Changed (Tests)

- `frontend/components/workspace/workspace-shell.test.tsx`

---

## Card Menu UX / Wiring Summary

- Each project card in the Projects view now has a restrained `...` actions button (top-right of card).
- Actions button is `type="button"`, `aria-haspopup="menu"`, and uses a locale-backed `aria-label` (`project.actionsMenuLabel`).
- Clicking the button calls `stopPropagation()` — the card open/resume handler is never triggered.
- The menu exposes two items:
  - **Move to workspace** — selects the project (`onSelectProjectId`) and resets the move target workspace state (`onProjectMoveTargetWorkspaceIdChange`), ready for use in the existing HistoryProjectPanel move flow.
  - **Sharing / visibility** — selects the project (`onSelectProjectId`) and syncs the selected visibility state from the project's current visibility (`onSelectedProjectVisibilityChange`), ready for use in the existing sharing controls.
- A read-only visibility status line is shown in the menu (current visibility in locale-backed label).
- Both grid and list view card placements receive the menu.
- Normal card click/open behavior is fully preserved.
- `data-testid` values follow the pattern `workspace-project-card-actions-{button|menu|move|visibility}-{projectId}`.

---

## Important Scope Note

This slice makes project-level actions accessible directly from each project card and routes into the **existing** move/visibility flow in `HistoryProjectPanel`. It does not yet fully replace the old HistoryProjectPanel controls or implement inline move/visibility editing inside the card menu. Old controls remain intact. Removal or replacement can be a later slice.

---

## i18n Keys Added

All six keys added under `project` in all three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`):

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `actionsMenuLabel` | Project actions | 專案操作 | 项目操作 |
| `moveToWorkspace` | Move to workspace | 移動到工作區 | 移动到工作区 |
| `visibility` | Visibility | 可見性 | 可见性 |
| `sharingVisibility` | Sharing / visibility | 分享 / 可見性 | 分享 / 可见性 |
| `privateVisibility` | Private | 私人 | 私有 |
| `publicVisibility` | Public | 公開 | 公开 |

All new visible text in `workspace-project-card.tsx` is passed through props (locale-backed). No hardcoded English user-facing copy.

---

## Tests Updated

`frontend/components/workspace/workspace-shell.test.tsx`:

- Actions menu button renders on project cards in projects view (grid and list).
- Menu exposes move and visibility action items.
- Clicking the actions button does not call `onResumeWorkspaceProjectById` (stopPropagation verified).
- Normal card-area click still opens the project (existing assertion retained).
- Old history move/visibility controls remain available in non-Projects context.
- Locale key coverage extended to all six new `project.*` menu keys.
- Source-level check: no hardcoded English label strings in `workspace-project-card.tsx`.
- Source-level check: locale-backed wiring of all new card menu labels in `workspace-shell.tsx`.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS |
| `ReadLints` (touched files) | PASS — 0 new errors |

---

## Non-Goals Confirmed

- No backend or API changes.
- No route, model, or entity renames.
- No broad project card redesign.
- No workspace settings work.
- No public projects relocation.
- No TASK-75A work.
- No HistoryProjectPanel controls removed in this slice.

---

## No Backend / Governance / Route / Entity Changes

No backend files, route files, model/entity files, governance docs (`TASKS.md`, `TASKS_BACKLOG_FULL.md`), or other checkpoint docs were changed during implementation.

---

## Next Recommended Step

If desired, a follow-up slice can:
- Implement inline move-target workspace selector and confirm button directly inside the card menu (eliminating the HistoryProjectPanel dependency for this action).
- Implement inline visibility toggle directly inside the card menu.
- Hide or remove old HistoryProjectPanel move/visibility controls once the card-based flow is proven.

Register that as a new task (e.g., UX-IA-28) before implementation.

---

**Reference:** See `TASKS.md` -> UX-IA-27 and `TASKS_BACKLOG_FULL.md` -> UX-IA-27.
