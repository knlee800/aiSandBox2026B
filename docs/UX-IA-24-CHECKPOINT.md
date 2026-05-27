# UX-IA-24 CHECKPOINT — Add Create Workspace Option to Workspace Dropdown

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-24
**Family:** UX-IA
**Nature:** FRONTEND-ONLY / UX FLOW FIX
**Risk:** Low-Medium
**Completed:** 2026-05-27
**Depends on:** WORKSPACE-DEFAULT-01 (COMPLETE and LOCKED), UX-IA-23 (COMPLETE and LOCKED)

---

## Problem solved

The workspace dropdown in the sidebar showed only existing workspace options. There was no way for users to discover workspace creation from that selector. Users expected a "Create new workspace" entry directly in the dropdown.

---

## Files changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-sidebar.tsx` | Added `onOpenCreateWorkspaceFlow` prop, `CREATE_NEW_WORKSPACE_OPTION_VALUE` constant, `handleWorkspaceSelectorChange` dispatcher, `createNewWorkspace` message key read, and create-new `<option>` at the bottom of the workspace selector |
| `frontend/components/workspace/workspace-shell.tsx` | Threaded `onOpenCreateWorkspaceFlow` to `WorkspaceSidebar`, wired to `() => props.onWorkspaceViewChange?.('projects')` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added 5 new focused tests in the UX-IA-22 describe block (see tests section below) |
| `frontend/messages/en.json` | Added `workspace.createNewWorkspace: "Create new workspace"` |
| `frontend/messages/zh-TW.json` | Added `workspace.createNewWorkspace: "建立新工作區"` |
| `frontend/messages/zh-CN.json` | Added `workspace.createNewWorkspace: "创建新工作区"` |

No backend, API, route, model, entity, or governance files were changed.

---

## i18n key added

`workspace.createNewWorkspace`

| Locale | Value |
|---|---|
| `en` | `Create new workspace` |
| `zh-TW` | `建立新工作區` |
| `zh-CN` | `创建新工作区` |

---

## UX and wiring summary

- The existing `<select>` workspace dropdown in the sidebar now appends a terminal `<option value="__create-new-workspace__">` below workspace entries.
- `handleWorkspaceSelectorChange` intercepts that sentinel value before delegating to `onSelectWorkspaceId`, so no spurious workspace ID is forwarded to the parent.
- Selecting "Create new workspace" fires `onOpenCreateWorkspaceFlow`, which in `WorkspaceShell` routes the view to `'projects'` — the view where workspace creation controls (`history-workspace-create-input` / `history-workspace-create-button`) already live.
- No workspace is created immediately; no name prompt was introduced.
- Normal workspace selection (`onSelectWorkspaceId`) is unaffected.
- Projects nav tab wiring (`messages.projects`) is unaffected.

---

## Tests updated

All tests added to the existing `describe('workspace sidebar workspace-label wiring — UX-IA-22')` block in `workspace-shell.test.tsx`.

| Test | Assertion |
|---|---|
| `locale files define workspace.createNewWorkspace in all supported locales` | Exact value checks for `en`, `zh-TW`, `zh-CN` |
| `workspace sidebar source wires create-new option to create-workspace flow` | Source-level assertions for key lookup, constant, branch handler, and `<option>` element |
| `workspace sidebar dropdown includes create-new-workspace option in project-first mode` | Rendered HTML contains `value="__create-new-workspace__"` and `>Create new workspace<` |
| `selecting create-new-workspace routes to projects view without selecting another workspace` | `onSelectWorkspaceId` not called; `onWorkspaceViewChange` called with `'projects'` |
| `selecting a normal workspace still calls onSelectWorkspaceId` | `onSelectWorkspaceId` called with workspace id; `onWorkspaceViewChange` not called |

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 489 tests, 489 pass, 0 fail |
| `ReadLints` on all touched files | PASS — 0 errors |

---

## Non-goals confirmed

- No backend or API changes.
- No route, model, or entity rename.
- No new modal system.
- No broad sidebar redesign.
- No TASK-75A work.
- No hardcoded English user-facing copy.

---

## Next recommended step

Live browser smoke: log in, open the workspace sidebar, verify "Create new workspace" appears at the bottom of the workspace dropdown, click it, confirm the view switches to the Projects tab where workspace creation controls are available, and confirm selecting an existing workspace continues to select it normally.
