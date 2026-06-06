# AI-CONTEXT-03A Checkpoint — Active Context Indicator

**Task ID:** AI-CONTEXT-03A
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-06

---

## Summary

Added a compact Active Context Indicator to the chat composer area in the project workspace. The indicator shows whether Global AI Instructions and Project AI Instructions are currently active before the user sends a prompt.

---

## Files Changed

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-account-menu.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

---

## Implementation Detail

### UI Placement

Indicator rendered directly above the prompt textarea inside `WorkspaceChatPanel`, within the existing chat composer wrapper (`border-t border-gray-200 bg-white px-3 py-2`). Rendered as a compact text row:

```
Context: Global On/Off · Project On/Off
```

- `data-testid="workspace-chat-context-indicator"` (container)
- `data-testid="workspace-chat-context-global-status"` (global status span)
- `data-testid="workspace-chat-context-project-status"` (project status span)
- `title` on container uses `contextIndicatorHelp` i18n key (tooltip)

No chat panel, history, preview, build, or editor layout was changed.

### Active/Inactive State Logic

- **Global active:** `globalInstructions` trimmed non-empty after fetch from `GET /api/user/ai-instructions`
- **Global inactive:** null / empty / whitespace
- **Project active:** `projectInstructions` trimmed non-empty after fetch from `GET /api/projects/:projectId/ai-context`
- **Project inactive:** null / empty / whitespace, or no selected project

Helper: `isAiInstructionActive(value: string | null | undefined): boolean` (exported from `workspace-shell.tsx`)

### State Refresh

- Global status fetched on component mount; updated via `CustomEvent('workspace:global-ai-instructions-updated')` dispatched by `saveGlobalAiInstructionsToApi` in `workspace-account-menu.tsx` after every save/clear.
- Project status fetched when `selectedProjectId` changes; updated via `CustomEvent('workspace:project-ai-instructions-updated')` dispatched by `saveProjectAiInstructionsToApi` in `workspace-shell.tsx` after every save/clear, filtered to the active project ID.
- Both effects use cancellation flags to prevent stale state from dropped fetches.

### New Exported Symbols from `workspace-shell.tsx`

- `GLOBAL_AI_INSTRUCTIONS_UPDATED_EVENT` (event name constant)
- `PROJECT_AI_INSTRUCTIONS_UPDATED_EVENT` (event name constant)
- `isAiInstructionActive` (activity helper function)
- `fetchGlobalAiInstructionStatusFromApi` (status fetch helper)

### i18n Keys Added (`ai` namespace)

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `contextIndicatorTitle` | Context | 上下文 | 上下文 |
| `contextIndicatorGlobal` | Global | 全域 | 全局 |
| `contextIndicatorProject` | Project | 專案 | 项目 |
| `contextIndicatorActive` | On | 啟用 | 启用 |
| `contextIndicatorInactive` | Off | 停用 | 停用 |
| `contextIndicatorHelp` | Active context is included in agent prompts. | 啟用的上下文會包含在代理提示中。 | 启用的上下文会包含在代理提示中。 |

---

## Tests Added (`workspace-shell.test.tsx`)

- `isAiInstructionActive` helper-state test (null / empty / whitespace → false; non-empty → true)
- Source assertion: global status fetch endpoint wired via `GET /api/user/ai-instructions`
- Source assertion: `window.dispatchEvent(new CustomEvent(GLOBAL_AI_INSTRUCTIONS_UPDATED_EVENT` in account menu
- Source assertion: `window.dispatchEvent(new CustomEvent(PROJECT_AI_INSTRUCTIONS_UPDATED_EVENT` in shell
- Render test: indicator present near prompt area (`workspace-chat-context-indicator` before `workspace-chat-composer-row`)
- Render-state test: both inactive (default)
- Render-state test: global active / project inactive
- Render-state test: global inactive / project active
- i18n key existence test: all 6 `contextIndicator*` keys verified in en / zh-TW / zh-CN
- Source assertion: indicator uses `props.aiMessages.contextIndicator*` keys (no hardcoded labels)

---

## Validation

- `npx tsc --noEmit` — **PASS**
- `npm test` — **PASS** (617 passed, 0 failed)
- ReadLints on touched files — **PASS**
- `frontend/tsconfig.tsbuildinfo` — restored

## Live Browser Smoke

**PASS** — 5-step scenario:
1. Clear Global + Project → `Global Off · Project Off`
2. Save Global only → `Global On · Project Off`
3. Save Project only → `Global Off · Project On`
4. Save both → `Global On · Project On`
5. Clear both → `Global Off · Project Off`

Indicator appeared near chat prompt area; layout compact and non-disruptive; multilingual text confirmed via locale keys.

---

## Non-Goals Confirmed

- No backend changes
- No ai-service changes
- No prompt assembly changes
- No repo docs registry
- No repo map
- No validation contract
- No Build Targets changes
- No Chat/History replacement changes
- No Command Input changes
- No unrelated files changed
