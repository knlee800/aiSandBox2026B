# UX-IA-35 Checkpoint — Build Targets Placement

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-35 |
| Title | Build Targets Placement |
| Family | UX-IA (Product & UX/UI Redesign — Evolutionary) |
| Status | COMPLETE and LOCKED |
| Priority | Medium |
| Nature | FRONTEND-ONLY / PROJECT WORKSPACE IA CLEANUP |
| Risk | Low-Medium |
| Depends on | UX-IA-34 (COMPLETE and LOCKED — `docs/UX-IA-34-CHECKPOINT.md`) |

---

## Problem

`WorkspaceBuildPanel` / Build Targets was rendered inside `projectChatSection`, directly below the AI chat thread. Build Targets is a project-level action useful to normal users; it does not belong in the AI conversation panel. Its prior placement cluttered the chat panel and was architecturally misplaced.

---

## Objective

Move Build Targets out of the chat panel and into a compact project-level toolbar row rendered under the Project Workspace header and before the trust note and content area. Replace all hardcoded English strings in `WorkspaceBuildPanel` with i18n keys.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Removed `<WorkspaceBuildPanel>` from `projectChatSection`; added `projectBuildToolbar` variable; rendered it under the project header before `projectTrustNote`; added `workspaceMessages` prop to `WorkspaceBuildPanel`; replaced 4 hardcoded English strings with i18n references |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added placement test (header → build toolbar → trust note order); added chat isolation test; added i18n key coverage test; added source assertion test; existing build behavior tests preserved |
| `frontend/messages/en.json` | Added `workspace.buildTargets`, `workspace.buildTargetLabel`, `workspace.runBuild`, `workspace.building` |
| `frontend/messages/zh-TW.json` | Added same keys (Traditional Chinese) |
| `frontend/messages/zh-CN.json` | Added same keys (Simplified Chinese) |

---

## Build Targets Relocation Summary

**Before:** `WorkspaceBuildPanel` rendered inside `projectChatSection` (the AI conversation section), below the chat thread and above `ShellStateMessage`.

**After:** `WorkspaceBuildPanel` rendered as `projectBuildToolbar` — a compact row with `border-b border-gray-200 bg-white px-2 py-2` — placed:
- Between the project mode header and `projectTrustNote` in the project-first project view.
- At the top of `projectWorkspaceContent` in the legacy (non-project-first) project view.

Build Targets is no longer inside the chat conversation area. It is visible and discoverable at project-level for normal users.

---

## i18n Keys Added

All keys added to `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json` under the `workspace` namespace:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `buildTargets` | Build Targets | 建構目標 | 构建目标 |
| `buildTargetLabel` | Build Target | 建構目標 | 构建目标 |
| `runBuild` | Run Build | 執行建構 | 运行构建 |
| `building` | Building... | 建構中... | 构建中... |

Wired via `workspaceMessages` prop passed from `WorkspaceShell` using the existing `getWorkspaceMessages(locale)` helper. No new translation infrastructure required.

---

## data-testid Preservation

All existing `data-testid` values preserved without change:

- `workspace-build-panel`
- `workspace-build-target-selector`
- `workspace-build-trigger`
- `workspace-build-status`
- `workspace-build-error`
- `workspace-build-output`

---

## Tests Updated

File: `frontend/components/workspace/workspace-shell.test.tsx`

New tests added (describe: `workspace shell component`):
- `renders build targets toolbar between project header and trust note in project view` — asserts DOM order: header index < build-panel index < trust-note index.
- `does not render build targets panel inside chat conversation area` — asserts `workspace-ai-panel-chat-content` and `chat-panel-shell` do not contain `workspace-build-panel`.

New test suite added (`workspace build targets i18n wiring — UX-IA-35`):
- `locale files define required workspace keys for build targets toolbar copy` — asserts all 4 keys present and non-empty in en / zh-TW / zh-CN.
- `workspace build panel source uses workspace i18n keys for targeted labels` — asserts `workspaceMessages` is passed; checks `{props.workspaceMessages.buildTargets}`, `buildTargetLabel`, `building`/`runBuild` expressions; asserts no hardcoded `>Build Targets<`, `>Build Target<`, `'Run Build'`, `'Building...'` literals remain.

Existing build tests preserved:
- `workspace-build-panel` render assertion.
- Build status, error, and output render assertions.

---

## Acceptance Criteria

- [x] UX-IA-35 registered in TASKS.md and TASKS_BACKLOG_FULL.md
- [x] `WorkspaceBuildPanel` is NOT inside `chat-panel-shell` in rendered output
- [x] `WorkspaceBuildPanel` renders as a compact toolbar between the project header and trust note
- [x] All visible text in `WorkspaceBuildPanel` uses i18n keys
- [x] `workspace.buildTargets`, `workspace.buildTargetLabel`, `workspace.runBuild`, `workspace.building` added to `en.json`, `zh-TW.json`, `zh-CN.json`
- [x] All `data-testid` values preserved
- [x] Existing build behavior preserved
- [x] Tests updated for new placement
- [x] No new hardcoded user-facing English copy
- [x] `frontend/messages/en.json` updated
- [x] `frontend/messages/zh-TW.json` updated
- [x] `frontend/messages/zh-CN.json` updated
- [x] Component uses the existing translation hook/pattern

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 567 pass, 0 fail |
| ReadLints | PASS — no linter errors on touched files |
| Live browser test | PASS |
| `frontend/tsconfig.tsbuildinfo` | Restored via `git restore` |

---

## Non-Goals Confirmed

- No backend changes
- No routing changes
- No new dependencies
- No Command Input changes
- No History drawer/tab changes
- No chat panel redesign
- No sidebar changes
- No build behavior redesign
- No unrelated hardcoded-string cleanup

---

## Scope Boundary Confirmation

No changes made to:
- Any backend or service files
- Any sidebar files
- Any routing or page-level files
- `TASKS.md` or `TASKS_BACKLOG_FULL.md` during implementation
- Any governance or checkpoint documents during implementation
- `frontend/tsconfig.tsbuildinfo` (restored)

---

## Next Recommended Step

Begin the next UX-IA slice in a new window, or continue with backlog grooming for the next Project Workspace IA cleanup item.
