# I18N-SHELL-03 Checkpoint — Workspace Session and Preview Controls i18n

**Status:** COMPLETE and LOCKED
**Task ID:** I18N-SHELL-03
**Family:** I18N
**Completed:** 2026-05-24
**Checkpoint doc:** `docs/I18N-SHELL-03-CHECKPOINT.md`
**Depends on:** I18N-SHELL-02 (COMPLETE and LOCKED)

---

## Objective

Remove hardcoded English user-facing session management and live preview control strings from `workspace-shell.tsx` and wire them into the existing locale-switch pattern across all three supported locales (en, zh-TW, zh-CN). This extends the pattern established by I18N-SHELL-01 and I18N-SHELL-02.

Target strings: "No session selected", "New Session", "Creating...", stop-session confirmation dialog copy, "Live Preview", "Start Preview", "Refresh", and "Refreshing...".

---

## Exact Files Changed

### Production source files

- `frontend/components/workspace/workspace-shell.tsx` — 8 hardcoded session/preview control strings replaced with locale-backed bindings; `WorkspaceAdvancedDrawer` wired to receive `workspaceMessages` prop; `WorkspacePreviewPanel` wired to receive `previewMessages` and `commonMessages` props
- `frontend/messages/en.json` — 4 new `workspace.*` keys and 2 new `preview.*` keys added; 2 new `common.*` keys added
- `frontend/messages/zh-TW.json` — same 8 keys added (Traditional Chinese)
- `frontend/messages/zh-CN.json` — same 8 keys added (Simplified Chinese)

### Test files

- `frontend/components/workspace/workspace-shell.test.tsx` — `WorkspaceAdvancedDrawer` render tests updated to pass required `workspaceMessages` prop; new `describe` block `workspace session and preview controls i18n wiring — I18N-SHELL-03` added with source-assertion tests

---

## Keys Added per Locale File

All three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`) received these new keys:

### `workspace` namespace

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.noSessionSelected` | "No session selected" | "未選擇工作階段" | "未选择会话" |
| `workspace.newSession` | "New Session" | "新工作階段" | "新会话" |
| `workspace.creatingSession` | "Creating..." | "建立中..." | "创建中..." |
| `workspace.stopSessionConfirm` | "Stop this session? Unsaved running work in this session may be interrupted." | "停止此工作階段？此工作階段中未儲存的執行中工作可能會被中斷。" | "停止此会话？此会话中未保存的运行中工作可能会被中断。" |

### `preview` namespace

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `preview.livePreview` | "Live Preview" | "即時預覽" | "实时预览" |
| `preview.startPreview` | "Start Preview" | "開始預覽" | "开始预览" |

### `common` namespace

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `common.refresh` | "Refresh" | "重新整理" | "刷新" |
| `common.refreshing` | "Refreshing..." | "重新整理中..." | "刷新中..." |

---

## Wiring Summary (`workspace-shell.tsx`)

### Session controls — `WorkspaceAdvancedDrawer`

`WorkspaceAdvancedDrawer` now receives `workspaceMessages` as a prop (new prop threading from the parent `WorkspaceShell`).

| Hardcoded string removed | Replacement |
|---|---|
| `"No session selected"` | `{props.workspaceMessages.noSessionSelected}` |
| `"New Session"` | `{props.workspaceMessages.newSession}` |
| `"Creating..."` | `{props.workspaceMessages.creatingSession}` |
| `"Stop this session? Unsaved running work in this session may be interrupted."` | `{props.workspaceMessages.stopSessionConfirm}` |

### Preview controls — `WorkspacePreviewPanel`

`WorkspacePreviewPanel` now receives `previewMessages` and `commonMessages` as props (new prop threading from the parent `WorkspaceShell`).

| Hardcoded string removed | Replacement |
|---|---|
| `"Live Preview"` | `{props.previewMessages.livePreview}` |
| `"Start Preview"` | `{props.previewMessages.startPreview}` |
| `"Refresh"` | `{props.commonMessages.refresh}` |
| `"Refreshing..."` | `{props.commonMessages.refreshing}` |

Layout, classNames, behavior, and all `data-testid` values were fully preserved.

---

## Tests Added / Updated

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

### Updated tests

- `WorkspaceAdvancedDrawer` render tests updated to pass the required `workspaceMessages` prop alongside existing props.

### New `describe` block: `workspace session and preview controls i18n wiring — I18N-SHELL-03`

Three source-assertion tests added:

1. **`locale files define required workspace/preview/common keys for session and preview controls`** — reads all 3 locale JSON files and asserts each of the 8 required keys (`workspace.noSessionSelected`, `workspace.newSession`, `workspace.creatingSession`, `workspace.stopSessionConfirm`, `preview.livePreview`, `preview.startPreview`, `common.refresh`, `common.refreshing`) is a non-empty string in all 3 locales.
2. **`workspace shell source removes targeted hardcoded English session/preview control strings`** — reads `workspace-shell.tsx` source and asserts `doesNotMatch` for all 8 removed hardcoded patterns in the targeted session/preview control source areas.
3. **`workspace session and preview panel use locale message values for targeted labels`** — reads `workspace-shell.tsx` source and asserts `match` for `getWorkspaceMessages`, `getPreviewMessages`, `workspaceMessages`, `previewMessages`, and `commonMessages.refresh`/`commonMessages.refreshing` wiring expressions.

---

## Validation Results

All validation run from `C:\Users\knlee\aiSandBox2026B\frontend`.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 457 tests, 0 failed |
| ReadLints on touched files | PASS — no linter errors |
| `npm run build` | ENVIRONMENTAL FAILURE — Google Fonts TLS/cert issue (see below) |
| `frontend/tsconfig.tsbuildinfo` | Restored via `git restore` |

### Known build environment caveat

`npm run build` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` when `next/font` attempts to fetch `Inter` from Google Fonts. This is a recurring TLS/certificate environment limitation, identical to the caveat recorded in I18N-SHELL-01, I18N-PAGE-01, and I18N-SHELL-02 checkpoints. It is not caused by any code change in this task. The build artifact `frontend/tsconfig.tsbuildinfo` was restored after the attempt.

---

## Non-Goals Confirmed

The following were explicitly out of scope and were not touched:

- `frontend/app/[locale]/app/page.tsx` — not modified
- Core chat-panel strings already handled by I18N-SHELL-01/02 — not modified
- AUTH-MODULE strings — not modified
- Status panel full migration — not modified
- Workspace/project modal copy — not modified
- `recoveryCopy.ts` — not modified
- Backend services — not modified
- No new npm dependencies introduced
- No UI redesign or layout changes
- No TASK-73C-1 work

---

## Invariants Preserved

- `getWorkspaceMessages(locale)` and `getPreviewMessages(locale)` helpers follow the same pattern established by `getAiMessages` / `getCommonMessages` in prior slices
- All `data-testid` values in `WorkspaceAdvancedDrawer` and `WorkspacePreviewPanel` preserved
- All classNames and layout structure preserved
- Existing tests from I18N-SHELL-01, I18N-PAGE-01, and I18N-SHELL-02 continue to pass (457 total, 0 failed)
- No locked tasks modified
- No production source files were modified during this consolidation step

---

## Next Recommended Task

The I18N family has remaining hardcoded English UX copy in `workspace-shell.tsx` outside the areas covered by I18N-SHELL-01 through I18N-SHELL-03: status panel labels, workspace/project modal copy, and `recoveryCopy.ts` strings. The next bounded slice should be registered and scoped accordingly before implementation begins.
