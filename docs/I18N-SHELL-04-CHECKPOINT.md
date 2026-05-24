# I18N-SHELL-04 Checkpoint — Workspace/Project Modal Action Button Labels i18n

**Status:** COMPLETE and LOCKED
**Task ID:** I18N-SHELL-04
**Family:** I18N
**Completed:** 2026-05-24
**Checkpoint doc:** `docs/I18N-SHELL-04-CHECKPOINT.md`
**Depends on:** I18N-SHELL-03 (COMPLETE and LOCKED)

---

## Objective

Remove hardcoded English user-facing workspace/project management labels, placeholders, dropdown defaults, and button loading states from `HistoryProjectPanel` and `HistorySnapshotPanel` inside `workspace-shell.tsx`, and wire them into the existing locale-switch pattern across all three supported locales (en, zh-TW, zh-CN). This extends the pattern established by I18N-SHELL-01 through I18N-SHELL-03.

20 target strings addressed: workspace select placeholder, workspace name inputs, create/rename/delete workspace button labels and loading states, project name input, create/open project button labels and loading states, project select placeholder, move-to-workspace select and button, sharing/visibility heading, public project view/fork button labels and loading states, and snapshot save/restore/download/import button labels and loading states.

---

## Exact Files Changed

### Production source files

- `frontend/components/workspace/workspace-shell.tsx` — 20 hardcoded workspace/project management strings replaced with locale-backed bindings; `HistoryProjectPanel` wired to receive `workspaceMessages`, `projectMessages`, and `commonMessages` props; `HistorySnapshotPanel` wired to receive `projectMessages` and `commonMessages` props; both panels threaded through from `WorkspaceShell`
- `frontend/messages/en.json` — 10 new `common.*` keys, 9 new `workspace.*` keys, and 11 new `project.*` keys added
- `frontend/messages/zh-TW.json` — same 30 keys added (Traditional Chinese)
- `frontend/messages/zh-CN.json` — same 30 keys added (Simplified Chinese)

### Test files

- `frontend/components/workspace/workspace-shell.test.tsx` — new `describe` block `workspace/project modal action button labels i18n wiring — I18N-SHELL-04` added with four source-assertion tests

---

## Keys Added / Reused per Locale File

All three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`) received these new keys:

### `common` namespace — new keys added

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `common.creating` | "Creating..." | "建立中..." | "创建中..." |
| `common.renaming` | "Renaming..." | "重新命名中..." | "重命名中..." |
| `common.deleting` | "Deleting..." | "刪除中..." | "删除中..." |
| `common.opening` | "Opening..." | "開啟中..." | "打开中..." |
| `common.moving` | "Moving..." | "移動中..." | "移动中..." |
| `common.forking` | "Forking..." | "分叉中..." | "分叉中..." |
| `common.saving` | "Saving..." | "儲存中..." | "保存中..." |
| `common.restoring` | "Restoring..." | "還原中..." | "恢复中..." |
| `common.exporting` | "Exporting..." | "匯出中..." | "导出中..." |
| `common.importing` | "Importing..." | "匯入中..." | "导入中..." |

### `common` namespace — existing key reused

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `common.loading` | "Loading..." | "載入中..." | "加载中..." |

### `workspace` namespace — new keys added

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.selectWorkspace` | "Select a workspace" | "選擇工作區" | "选择工作区" |
| `workspace.newWorkspaceName` | "New workspace name" | "新工作區名稱" | "新工作区名称" |
| `workspace.createWorkspace` | "Create Workspace" | "建立工作區" | "创建工作区" |
| `workspace.renameSelectedWorkspace` | "Rename selected workspace" | "重新命名已選工作區" | "重命名所选工作区" |
| `workspace.renameWorkspace` | "Rename Workspace" | "重新命名工作區" | "重命名工作区" |
| `workspace.deleteWorkspace` | "Delete Workspace" | "刪除工作區" | "删除工作区" |
| `workspace.selectTargetWorkspace` | "Select target workspace" | "選擇目標工作區" | "选择目标工作区" |
| `workspace.noOtherWorkspaces` | "No other workspaces available" | "沒有其他可用工作區" | "没有其他可用工作区" |
| `workspace.moveToWorkspace` | "Move to Workspace" | "移動到工作區" | "移动到工作区" |

### `project` namespace — new keys added

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `project.newProjectName` | "New project name" | "新專案名稱" | "新项目名称" |
| `project.createProject` | "Create Project" | "建立專案" | "创建项目" |
| `project.selectProject` | "Select a project" | "選擇專案" | "选择项目" |
| `project.openProject` | "Open Project" | "開啟專案" | "打开项目" |
| `project.sharingVisibilityOptional` | "Sharing / Visibility (optional)" | "分享 / 可見性（選填）" | "分享 / 可见性（可选）" |
| `project.view` | "View" | "檢視" | "查看" |
| `project.fork` | "Fork" | "分叉" | "分叉" |
| `project.saveSnapshot` | "Save Snapshot" | "儲存快照" | "保存快照" |
| `project.restoreSnapshot` | "Restore Snapshot" | "還原快照" | "恢复快照" |
| `project.downloadProject` | "Download Project" | "下載專案" | "下载项目" |
| `project.importProject` | "Import Project" | "匯入專案" | "导入项目" |

---

## Wiring Summary (`workspace-shell.tsx`)

### `HistoryProjectPanel` — new prop types added and replacements applied

`HistoryProjectPanel` now receives `workspaceMessages`, `projectMessages`, and `commonMessages` as props, threaded from the parent `WorkspaceShell`.

| Hardcoded string removed | Replacement |
|---|---|
| `"Select a workspace"` (option) | `{props.workspaceMessages.selectWorkspace}` |
| `placeholder="New workspace name"` | `placeholder={props.workspaceMessages.newWorkspaceName}` |
| `'creating' ? 'Creating...' : 'Create Workspace'` | `? props.commonMessages.creating : props.workspaceMessages.createWorkspace` |
| `placeholder="Rename selected workspace"` | `placeholder={props.workspaceMessages.renameSelectedWorkspace}` |
| `'renaming' ? 'Renaming...' : 'Rename Workspace'` | `? props.commonMessages.renaming : props.workspaceMessages.renameWorkspace` |
| `'deleting' ? 'Deleting...' : 'Delete Workspace'` | `? props.commonMessages.deleting : props.workspaceMessages.deleteWorkspace` |
| `placeholder="New project name"` | `placeholder={props.projectMessages.newProjectName}` |
| `'creating' ? 'Creating...' : 'Create Project'` | `? props.commonMessages.creating : props.projectMessages.createProject` |
| `<option value="">Select a project</option>` | `<option value="">{props.projectMessages.selectProject}</option>` |
| `'opening' ? 'Opening...' : 'Open Project'` | `? props.commonMessages.opening : props.projectMessages.openProject` |
| `? 'Select target workspace' : 'No other workspaces available'` | `? props.workspaceMessages.selectTargetWorkspace : props.workspaceMessages.noOtherWorkspaces` |
| `'moving' ? 'Moving...' : 'Move to Workspace'` | `? props.commonMessages.moving : props.workspaceMessages.moveToWorkspace` |
| `"Sharing / Visibility (optional)"` (heading) | `{props.projectMessages.sharingVisibilityOptional}` |
| `'viewing' ? 'Loading...' : 'View'` | `? props.commonMessages.loading : props.projectMessages.view` |
| `'forking' ? 'Forking...' : 'Fork'` | `? props.commonMessages.forking : props.projectMessages.fork` |

### `HistorySnapshotPanel` — new prop types added and replacements applied

`HistorySnapshotPanel` now receives `projectMessages` and `commonMessages` as props, threaded from the parent `WorkspaceShell`.

| Hardcoded string removed | Replacement |
|---|---|
| `'saving' ? 'Saving...' : 'Save Snapshot'` | `? props.commonMessages.saving : props.projectMessages.saveSnapshot` |
| `'restoring' ? 'Restoring...' : 'Restore Snapshot'` | `? props.commonMessages.restoring : props.projectMessages.restoreSnapshot` |
| `'exporting' ? 'Exporting...' : 'Download Project'` | `? props.commonMessages.exporting : props.projectMessages.downloadProject` |
| `'importing' ? 'Importing...' : 'Import Project'` | `? props.commonMessages.importing : props.projectMessages.importProject` |

Layout, classNames, behavior, and all `data-testid` values were fully preserved.

---

## Tests Added / Updated

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

### New `describe` block: `workspace/project modal action button labels i18n wiring — I18N-SHELL-04`

Four source-assertion tests added:

1. **`locale files define required workspace/project/common keys for workspace project panel actions`** — reads all 3 locale JSON files and asserts each of the 30 required keys across `workspace`, `project`, and `common` namespaces is a non-empty string in all 3 locales.

2. **`workspace shell source removes targeted hardcoded English in workspace project panel action areas`** — reads `workspace-shell.tsx` source and asserts `doesNotMatch` for all 15 removed hardcoded string patterns in the `HistoryProjectPanel` target areas, and all 4 removed patterns in `HistorySnapshotPanel` target areas.

3. **`workspace project panel and snapshot actions use locale-backed message values`** — reads `workspace-shell.tsx` source and asserts `match` for the `workspaceMessages`, `projectMessages`, and `commonMessages` prop pass-through expressions, all placeholder bindings, the select option binding, and all action-state ternary locale expressions.

4. **`workspace project panel keeps existing target data-testid values`** — reads `workspace-shell.tsx` source and asserts `match` for all 20 preserved `data-testid` attribute values in the target panel areas.

---

## Validation Results

All validation run from `C:\Users\knlee\aiSandBox2026B\frontend`.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 461 tests, 0 failed |
| ReadLints on touched files | PASS — no linter errors |
| `npm run build` | ENVIRONMENTAL FAILURE — Google Fonts TLS/cert issue (see below) |
| `frontend/tsconfig.tsbuildinfo` | Restored via `git restore` |

### Known build environment caveat

`npm run build` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` when `next/font` attempts to fetch `Inter` from Google Fonts. This is a recurring TLS/certificate environment limitation, identical to the caveat recorded in I18N-SHELL-01, I18N-PAGE-01, I18N-SHELL-02, and I18N-SHELL-03 checkpoints. It is not caused by any code change in this task. The build artifact `frontend/tsconfig.tsbuildinfo` was restored after the attempt.

---

## Non-Goals Confirmed

The following were explicitly out of scope and were not touched:

- `frontend/app/[locale]/app/page.tsx` — not modified
- `recoveryCopy.ts` — not modified
- Status panel heading/body/action strings — not modified
- Stop/build/exec button labels — not modified
- Checkpoint/history/revert UI strings — not modified
- Auth-module strings — not modified
- Core chat-panel strings already handled by I18N-SHELL-01/02 — not modified
- Session/preview controls already handled by I18N-SHELL-03 — not modified
- Backend services — not modified
- No new npm dependencies introduced
- No UI redesign or layout changes
- No TASK-73C-1 work

---

## Invariants Preserved

- `getWorkspaceMessages`, `getProjectPanelMessages`, and `getCommonMessages` helpers follow the locale-switch pattern established by prior slices
- All `data-testid` values in `HistoryProjectPanel` and `HistorySnapshotPanel` preserved
- All classNames and layout structure preserved
- Existing tests from I18N-SHELL-01, I18N-PAGE-01, I18N-SHELL-02, and I18N-SHELL-03 continue to pass (461 total, 0 failed)
- No locked tasks modified
- No production source files were modified during this consolidation step

---

## Next Recommended Task

The I18N family has remaining hardcoded English UX copy in `workspace-shell.tsx` outside the areas covered by I18N-SHELL-01 through I18N-SHELL-04: status panel labels, `recoveryCopy.ts` integration strings, and any remaining hardcoded copy in other panels. The next bounded slice should be identified via a read-only audit, registered, and scoped before implementation begins.
