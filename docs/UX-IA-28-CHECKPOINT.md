# UX-IA-28 Checkpoint — Focused Project Action Panels for Move and Visibility

**Task ID:** UX-IA-28
**Status:** COMPLETE and LOCKED
**Family:** UX-IA
**Nature:** FRONTEND-ONLY / UX IA CLEANUP
**Risk:** Low-Medium
**Depends on:** UX-IA-27 (COMPLETE and LOCKED — `docs/UX-IA-27-CHECKPOINT.md`)
**Checkpoint date:** 2026-05-27

---

## Problem solved

The project card "..." menu exposed Move to workspace and Sharing / visibility actions, but both still routed users into the old admin-style My Projects panel. That panel mixes unrelated workspace and project controls and does not provide a focused experience for a single action.

## Objective achieved

When a user clicks a project card menu action, a focused panel is shown inside the Projects surface dedicated only to that task — Move to workspace or Sharing / visibility — with clear labels, a targeted control, and Cancel / primary action buttons.

---

## Files changed during implementation

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Added `focusedProjectAction` local state; updated card action handlers to open focused panels; added focused Move and Visibility panel JSX inside `projectsWorkspaceContent`; gated HistoryAndDashboard content on `!shouldShowFocusedProjectActionPanel` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added 8 new tests covering focused panel open/close/submit wiring; added locale key existence checks for new panel keys; updated existing template-search `useState` index to account for new local state; updated source-level wiring assertion for `makeHistoryAndDashboardContent` gating pattern |
| `frontend/messages/en.json` | Added 4 new keys under `project` namespace |
| `frontend/messages/zh-TW.json` | Added 4 new keys under `project` namespace |
| `frontend/messages/zh-CN.json` | Added 4 new keys under `project` namespace |

**Not changed:** `frontend/components/workspace/workspace-project-card.tsx` (no changes required in this slice)

---

## Focused panel UX/wiring summary

**Local state added to `WorkspaceShell`:**

```ts
focusedProjectAction: null | { type: 'move' | 'visibility'; projectId: string }
```

**Move panel (`workspace-projects-focused-move-*`):**
- Opened when user clicks Move to workspace in a project card menu
- Selects the project via `onSelectProjectId`
- Displays workspace target dropdown using `projectMoveTargetWorkspaceId` / `onProjectMoveTargetWorkspaceIdChange`
- Available target workspaces exclude the project's current workspace
- Move submit disabled when target workspace is missing/invalid or action is in-flight
- Calls `onMoveWorkspaceProject` on submit
- Cancel clears focused panel and calls `onWorkspaceViewChange('projects')`

**Visibility panel (`workspace-projects-focused-visibility-*`):**
- Opened when user clicks Sharing / visibility in a project card menu
- Selects the project and syncs current visibility via `onSelectedProjectVisibilityChange`
- Displays Private / Public select using `selectedProjectVisibility`
- Save disabled when selected visibility matches existing project visibility (no effective change) or action is in-flight
- Calls `onUpdateWorkspaceProjectVisibility` on submit
- Cancel clears focused panel and calls `onWorkspaceViewChange('projects')`

**Automatic close on success:**
- When `projectActionState === 'success'` and a focused action is active, the panel is cleared and `onWorkspaceViewChange('projects')` is called

**Preserved behaviors:**
- Normal card click/open behavior unaffected
- Project card grid/list layout shown when no focused panel is active
- Old `HistoryProjectPanel` controls remain available in non-Projects contexts
- `HistoryAndDashboard` content hidden while focused panel is active in Projects view

---

## i18n keys added

All keys added under `project` namespace in `en.json`, `zh-TW.json`, `zh-CN.json`:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `movePanelTitle` | Move to Workspace | 移動到工作區 | 移动到工作区 |
| `movePanelDescription` | Choose where to move this project. | 選擇要將此專案移動到哪個工作區。 | 选择要将此项目移动到哪个工作区。 |
| `visibilityPanelTitle` | Sharing / Visibility | 分享 / 可見性 | 分享 / 可见性 |
| `visibilityPanelDescription` | Choose who can access this project. | 選擇誰可以存取此專案。 | 选择谁可以访问此项目。 |

## i18n keys reused (no changes)

- `project.moveToWorkspace`
- `project.sharingVisibility`
- `project.privateVisibility`
- `project.publicVisibility`
- `common.cancel`
- `common.save`
- `common.saving`
- `workspace.selectTargetWorkspace`
- `workspace.noOtherWorkspaces`

---

## Tests updated

File: `frontend/components/workspace/workspace-shell.test.tsx`

New tests added (all in workspace shell component describe block):
1. `clicking project card move action opens focused move panel state and selects project`
2. `clicking project card visibility action opens focused visibility panel state and syncs visibility`
3. `focused move panel renders title, description, target selector, and action buttons`
4. `focused move panel cancel clears focused action and keeps projects view`
5. `focused move panel calls move handler when target workspace is valid`
6. `focused visibility panel renders title, description, visibility selector, and action buttons`
7. `focused visibility panel cancel clears focused action and keeps projects view`
8. `focused visibility panel save calls visibility update handler when selection changes`

Updated existing tests:
- `search filter hides non-matching template cards if testable` — `useState` call index adjusted from `5` to `6` due to new `focusedProjectAction` state
- `workspace shell source wires projects-only workspace-admin hiding without new hardcoded copy` — assertion updated to match new conditional gating pattern `{!shouldShowFocusedProjectActionPanel ? makeHistoryAndDashboardContent(...) : null}`

Updated i18n key checks (in I18N-SHELL-04 describe block):
- `movePanelTitle`, `movePanelDescription`, `visibilityPanelTitle`, `visibilityPanelDescription` added to required project key list
- Source-level assertions added for `{projectPanelMessages.movePanelTitle}`, `{projectPanelMessages.movePanelDescription}`, `{projectPanelMessages.visibilityPanelTitle}`, `{projectPanelMessages.visibilityPanelDescription}`, and `{hasProjectActionInFlight ? commonMessages.saving : commonMessages.save}`
- Negative assertions added confirming no hardcoded panel titles or descriptions in shell source

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 512 tests, 512 pass, 0 fail |
| `ReadLints` on touched files | PASS — 0 new errors |

---

## Non-goals confirmed

- No backend changes
- No route/model/entity rename
- No workspace settings work
- No public projects relocation
- No removal of old admin controls
- No TASK-75A work
- No new dependencies

---

## No backend/governance/route/entity changes

No backend files, API gateway, container manager, route definitions, DB entities, or governance documents were modified during the implementation step. TASKS.md and TASKS_BACKLOG_FULL.md were updated only during this consolidation step.

---

## Next live-test step

1. Run the dev frontend: `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run dev`
2. Log in and navigate to the Projects view.
3. Open a project card "..." menu and click **Move to workspace** — verify the focused Move panel appears inside the Projects surface with a workspace dropdown, Cancel, and Move button.
4. Select a target workspace and confirm Move is enabled; click Move and confirm the action fires and the panel closes.
5. Open a project card "..." menu and click **Sharing / visibility** — verify the focused Visibility panel appears with Private / Public selector, Cancel, and Save button.
6. Change the visibility selection and confirm Save is enabled; click Save and confirm the action fires and the panel closes.
7. Confirm that clicking Cancel on either panel returns to the normal Projects list.
8. Confirm that clicking a project card directly (not the "..." menu) still opens the project normally.
9. Confirm old HistoryProjectPanel move and sharing controls remain visible in the project (non-Projects) view.

**Reference:** See `TASKS.md` -> UX-IA-28 and `TASKS_BACKLOG_FULL.md` -> UX-IA-28.
