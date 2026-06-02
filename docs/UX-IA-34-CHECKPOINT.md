# UX-IA-34 CHECKPOINT — Move Command Input to Advanced Developer Tools

**Task ID:** UX-IA-34
**Family:** UX-IA
**Status:** COMPLETE and LOCKED
**Checkpoint date:** 2026-06-02
**Depends on:** UX-IA-33 (COMPLETE and LOCKED — `docs/UX-IA-33-CHECKPOINT.md`)
**Priority:** Low
**Nature:** FRONTEND-ONLY / PROJECT WORKSPACE IA CLEANUP
**Risk:** Low

---

## Problem Solved

`WorkspaceExecPanel` (Command Input) was rendered in the Project Workspace middle content area, visible to all users at all times. It is a shell/container execution tool appropriate only for developers and power users, not a normal-user chat control.

---

## What Was Done

Command Input was moved from the normal Project Workspace middle area into the Advanced drawer (`WorkspaceAdvancedDrawer`). It is now hidden by default and only accessible when a user explicitly opens Advanced.

---

## Files Changed

Production source files (implementation — prior step):
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

Governance files (registration + consolidation):
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/UX-IA-34-CHECKPOINT.md` (this file)

---

## Command Relocation Summary

| Before | After |
|---|---|
| `WorkspaceExecPanel` rendered in Project Workspace middle content area, always visible | `WorkspaceExecPanel` rendered inside `WorkspaceAdvancedDrawer` open content, hidden by default |
| `<p>Command Input</p>` hardcoded label above exec panel in middle area | Section heading `workspaceMessages.commandInput` inside Advanced drawer content |
| Placeholder `"Enter shell command (e.g. ls -la)"` hardcoded | Placeholder uses `workspaceMessages.commandInputPlaceholder` |
| Button text `'Run'` / `'Running...'` hardcoded | Button text uses `workspaceMessages.commandRun` / `workspaceMessages.commandRunning` |

Implementation approach:
- Added optional `execPanelContent?: React.ReactNode` slot prop to `WorkspaceAdvancedDrawer`
- Expanded `workspaceMessages` Pick on `WorkspaceAdvancedDrawer` to include `'commandInput'`
- Removed `WorkspaceExecPanel` and its label from the middle content area
- Passed `WorkspaceExecPanel` as the `execPanelContent` slot at the `WorkspaceAdvancedDrawer` call site
- Added `messages` prop to `WorkspaceExecPanel` for i18n strings
- Added optional `advancedDrawerInitialOpen?: boolean` prop to `WorkspaceShell` (default `false`) for test support only

---

## i18n Keys Added

Added to `workspace` object in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.commandInput` | `"Command Input"` | `"指令輸入"` | `"命令输入"` |
| `workspace.commandInputPlaceholder` | `"Enter shell command (e.g. ls -la)"` | `"輸入 shell 指令（例如 ls -la）"` | `"输入 shell 命令（例如 ls -la）"` |
| `workspace.commandRun` | `"Run"` | `"執行"` | `"执行"` |
| `workspace.commandRunning` | `"Running..."` | `"執行中..."` | `"执行中..."` |

---

## data-testid Preservation

All existing `data-testid` values preserved:
- `workspace-exec-panel` ✓
- `workspace-exec-input` ✓
- `workspace-exec-submit` ✓
- `workspace-exec-reopen-project` ✓

---

## Tests Updated

`frontend/components/workspace/workspace-shell.test.tsx`:
- Default layout smoke test: `Command Input` is no longer expected in the normal middle content area
- Advanced drawer collapsed test: exec panel is not present when Advanced is closed
- New test: `advancedDrawerInitialOpen: true` renders exec panel inside Advanced drawer
- New test: `WorkspaceAdvancedDrawer` renders `execPanelContent` when open
- Existing exec result/state/disabled tests updated with `advancedDrawerInitialOpen: true` and `workspaceView: 'home'` to ensure exec panel is in scope
- Existing `WorkspaceAdvancedDrawer` unit-test props updated for expanded `workspaceMessages` typing
- I18N-SHELL-03 locale coverage extended to include 4 new `commandInput*` keys
- I18N-SHELL-03 source-wiring assertions added confirming exec panel uses i18n props (no hardcoded English)

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 563 tests, 563 pass, 0 fail |
| ReadLints | PASS — no linter errors |
| Live browser test | PASS |

---

## Non-Goals Confirmed

- No backend/API changes
- No routing changes
- No new dependencies
- No Command Input behavior redesign
- No broad Advanced drawer redesign
- Pre-existing Advanced drawer strings (Session ID, Copy, Runtime status, Stopping..., Stop) not i18n'd in this task
- Build Targets not touched
- History drawer/tab behavior not touched
- Chat panel UX from UX-IA-33 not touched
- `frontend/components/workspace/workspace-sidebar.tsx` not touched

---

## No Production Source Changes During Consolidation

No production source files were modified during this consolidation step. The implementation was completed and validated in the prior step.

---

## Next Recommended Step

The UX-IA family is ACTIVE. Identify the next candidate slice from the UX-IA backlog, register it as UX-IA-35, and proceed.
