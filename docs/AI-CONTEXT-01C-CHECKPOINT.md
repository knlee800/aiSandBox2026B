# AI-CONTEXT-01C CHECKPOINT — Global AI Instructions Frontend Settings UI

**Status:** COMPLETE and LOCKED
**Task ID:** AI-CONTEXT-01C
**Family:** AI-CONTEXT (Global AI Instructions)
**Priority:** High
**Nature:** FRONTEND / SETTINGS UI / AI CONTEXT
**Risk:** Medium
**Depends on:** AI-CONTEXT-01B (COMPLETE and LOCKED)
**Date:** 2026-06-05

---

## Problem

Global AI instructions were stored in the backend and injected into prompt assembly
(AI-CONTEXT-01A + AI-CONTEXT-01B), but users had no frontend surface to view or edit them.
The feature was invisible to end users.

---

## Objective

Add a frontend settings UI where users can view, edit, save, and clear Global AI Instructions
using the existing backend endpoints:
- `GET /api/user/ai-instructions`
- `PUT /api/user/ai-instructions`

---

## Files Changed

- `frontend/components/workspace/workspace-account-menu.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

No backend, service, or governance docs were changed during implementation.

---

## UI Placement

Global AI Instructions is placed inside the existing account/settings surface: the sidebar
account menu (`Settings` button). Clicking **Settings** opens an inline panel beneath the
button with the full instructions editor. This keeps the feature in the natural account
settings area without any sidebar redesign or new navigation.

---

## UI Controls Implemented

- Title: `globalAiInstructionsTitle`
- Helper text: `globalAiInstructionsDescription`
- Textarea with placeholder
- Character count display: `current / 4000`
- Save button (disabled and grayed when over limit or while loading/saving)
- Clear button (disabled while loading/saving)
- Loading state while fetching on menu open
- Saving state while PUT is in flight
- Saved/success state after successful save or clear
- Load error state if GET fails
- Save error state if PUT fails
- Over-limit validation message when `> 4000` characters

---

## API Wiring

All wiring is in `workspace-account-menu.tsx` using the same authenticated same-origin
`fetch('/api/...')` pattern as the rest of the frontend:

| Action | Method | Endpoint | Body |
|---|---|---|---|
| Load on menu open | GET | `/api/user/ai-instructions` | — |
| Save | PUT | `/api/user/ai-instructions` | `{ globalInstructions: string \| null }` |
| Clear | PUT | `/api/user/ai-instructions` | `{ globalInstructions: null }` |

Blank/whitespace input normalizes to `null` before PUT (via `normalizeGlobalAiInstructionsForApi`).
Load/save cancellation guard prevents stale async updates after menu close.

---

## i18n Keys Added

All keys added under the `account` namespace in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `globalAiInstructionsTitle` | Global AI Instructions | 全域 AI 指令 | 全局 AI 指令 |
| `globalAiInstructionsDescription` | These instructions apply… | 這些指令會套用… | 这些指令会应用… |
| `globalAiInstructionsPlaceholder` | Add persistent instructions… | 新增持久化指令… | 添加持久化指令… |
| `globalAiInstructionsSave` | Save | 儲存 | 保存 |
| `globalAiInstructionsClear` | Clear | 清除 | 清除 |
| `globalAiInstructionsLoading` | Loading global instructions… | 正在載入… | 正在加载… |
| `globalAiInstructionsSaving` | Saving… | 儲存中… | 保存中… |
| `globalAiInstructionsSaved` | Saved. | 已儲存。 | 已保存。 |
| `globalAiInstructionsLoadError` | Failed to load… | 無法載入… | 无法加载… |
| `globalAiInstructionsSaveError` | Failed to save… | 無法儲存… | 无法保存… |
| `globalAiInstructionsCharacterCount` | Character count | 字元數 | 字符数 |
| `globalAiInstructionsTooLong` | …cannot exceed 4000 characters. | …不可超過 4000 字元。 | …不能超过 4000 个字符。 |

---

## Tests Added / Updated

`frontend/components/workspace/workspace-shell.test.tsx`:

- `account menu renders global AI instructions controls when settings panel opens` — render test for panel, title, textarea, character count, Save, Clear
- `account menu disables save when global AI instructions exceed max length` — over-4000 disables Save and shows too-long error
- `global AI instructions normalization maps blank values to null` — unit test for `normalizeGlobalAiInstructionsForApi`
- `account menu source wires GET and PUT for global AI instructions` — source assertion for both fetch calls and clear path
- `global AI instructions locale keys exist in en, zh-TW, and zh-CN` — i18n coverage for all 12 keys
- Existing account-menu interaction tests (`clicking logout`, `clicking language option`) wrapped in `withPatchedReactHooks` to accommodate hook-based component logic.

Helper added: `withPatchedFetch` — patches `globalThis.fetch` for targeted test scope.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS |
| `npm test` (frontend) | PASS — 604 tests, 604 pass, 0 fail |
| ReadLints on touched files | PASS — no lint errors |
| Live browser test | PASS |

### Live Browser Test Evidence

- Instructions loaded on account menu open ✓
- Instructions saved via Save button ✓
- Instructions persisted after menu close and reopen ✓
- Instructions cleared via Clear button ✓
- Cleared state persisted after close and reopen ✓
- Over-4000 input disabled Save and showed validation message ✓

---

## Non-goals Confirmed

- Backend endpoints unchanged (`services/api-gateway/`)
- Prompt assembly unchanged (`services/ai-service/`)
- Project-scoped instructions not implemented (future slice)
- Repo docs registry not touched
- Repo map not touched
- Validation contract not touched
- Build Targets tab not changed
- Chat / History replacement mode not changed
- Command Input not changed
- Sidebar navigation not redesigned
- No new npm dependencies added

---

## Note: DEVOPS-DOCKER-01

During this session, a separate pre-existing `ai-service` Docker build failure was investigated
and fixed under `DEVOPS-DOCKER-01` (COMPLETE and LOCKED — `docs/DEVOPS-DOCKER-01-CHECKPOINT.md`).
That fix is in `services/ai-service/Dockerfile` and is unrelated to AI-CONTEXT-01C.

---

## Next Recommended Step

The full AI-CONTEXT family (01A → 01B → 01C) is now COMPLETE and LOCKED.

Suggested next tasks (from backlog):
- Return to other ACTIVE items in `TASKS.md`
- Live environment smoke test of end-to-end AI instructions flow (edit in UI → instructions
  appear in AI execution prompt)
