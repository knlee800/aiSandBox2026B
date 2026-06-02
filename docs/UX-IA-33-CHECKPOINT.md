# UX-IA-33 CHECKPOINT — Professional AI Conversation Panel Baseline

**Task ID:** UX-IA-33
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Date:** 2026-06-02
**Nature:** FRONTEND-ONLY / PROJECT WORKSPACE CHAT UX
**Risk:** Medium
**Depends on:** UX-IA-32 (COMPLETE and LOCKED — `docs/UX-IA-32-CHECKPOINT.md`)

---

## Problem

The Project Workspace middle chat panel rendered as separate prompt/response form boxes rather than a professional AI conversation panel. Layout was input-first, messages were 11px, role labels were form-like, and the Send button and Enter-to-send were broken after restructuring.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-shell.tsx` | Thread-first layout, message alignment, composer overflow fix, Enter-to-send, isSending guards, focus-after-send |
| `frontend/components/workspace/workspace-shell.test.tsx` | Tests added/updated for all revisions |
| `frontend/app/[locale]/app/page.tsx` | Prompt clear after accepted submit (two locations) |
| `frontend/messages/en.json` | Added `ai.chatInputPlaceholder` |
| `frontend/messages/zh-TW.json` | Added `ai.chatInputPlaceholder` |
| `frontend/messages/zh-CN.json` | Added `ai.chatInputPlaceholder` |

---

## Chat Layout Summary

- `WorkspaceChatPanel` now renders conversation thread before input composer.
- Thread area is scrollable (`max-h-[60vh] overflow-y-auto`).
- User messages: right-aligned (`ml-8`), blue-tinted bubble.
- Assistant/system messages: left-aligned (`mr-8`), white/gray bubble.
- Message content uses `text-sm` for readability.
- Role labels softened to `text-xs text-gray-500`.
- Visible "Chat Panel" heading removed from `projectChatSection`.
- Composer pinned at bottom with `flex-shrink-0 border-t`.
- Model selector and orchestration controls wrapped in secondary row with `flex-wrap`.

---

## Revisions Completed

### 1. Send button visibility / composer overflow
- Reworked composer into two rows: textarea+Send button (top), secondary controls (bottom).
- Send button has `shrink-0`; textarea wrapper has `flex-1 min-w-0`.
- Secondary controls use `flex-wrap min-w-0 max-w-full`; orchestration label uses `break-words`.
- `workspace-chat-submit` test ID preserved.

### 2. Enter / Shift+Enter
- `onKeyDown` handler on textarea: `Enter` calls `submitPromptAndRefocus()`.
- `Shift+Enter` inserts newline and does not submit.
- Blocked submits are ignored.

### 3. Duplicate response / debug clutter
- `workspace-chat-response`, `workspace-chat-execution-id`, `workspace-chat-status` gated on `isSending`.
- These blocks are hidden once request completes; final response committed to thread renders once.
- `workspace-chat-error` remains visible unconditionally.

### 4. Prompt clear after send
- `handleSubmitChatPrompt` in `page.tsx` calls `setChatPromptInput('')` immediately after `setChatRequestState('submitting')`.
- Auth-module intent branch also clears prompt after user message is appended.
- Blocked submits leave text untouched.

### 5. Focus-after-send
- `promptInputRef` attached to the textarea.
- `prevIsSendingRef` tracks previous `isSending` value.
- `React.useEffect` watches `isSending`; calls `.focus()` when `isSending` transitions `true → false` (textarea re-enabled).
- Removed ineffective `requestAnimationFrame` focus attempt (was firing while textarea was still disabled).

---

## i18n Keys Added

| Key | en | zh-TW | zh-CN |
|-----|----|-------|-------|
| `ai.chatInputPlaceholder` | Ask the assistant for help with your current workspace task. | 向助理詢問您目前工作區任務的協助。 | 向助理询问您当前工作区任务的协助。 |

---

## Tests Updated

`frontend/components/workspace/workspace-shell.test.tsx` — from 548 to 561 tests:

- Thread-before-input layout order
- User message `ml-8` right-alignment
- Assistant/system message `mr-8` left-alignment
- Chat heading removed assertion
- `ai.chatInputPlaceholder` key present in all locale files
- Source uses `ai.chatInputPlaceholder` for textarea placeholder
- Send button visible in composer row
- Composer overflow prevention classes (`min-w-0`, `max-w-full`, `flex-wrap`, `shrink-0`, `break-words`)
- Enter-to-send / Shift+Enter source behavior
- Response block hidden when `requestState` is `'completed'`
- Response block visible while `requestState` is `'running'`
- Execution ID / status hidden after completion
- Errors remain visible after completion
- Prompt clear source assertions (normal path and auth-module path)
- Focus-after-send via `useEffect` on `isSending` transition (with `prevIsSendingRef`, no `requestAnimationFrame`)

---

## Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 561 tests, 561 pass, 0 fail |
| ReadLints | PASS — no errors |
| Live browser test | PASS |

---

## Non-Goals Confirmed

- No Command Input relocation.
- No Build Targets relocation.
- No History drawer.
- No backend / API changes.
- No broad Project Workspace redesign.
- No sidebar changes.
- No route / model / entity changes.

---

## No Backend / Sidebar / Route / Entity Changes

No backend files, sidebar files, route definitions, entity files, or governance docs were modified during implementation. Only the six files listed above were changed.

---

## Next Recommended Step

Register and plan UX-IA-34 — the next UX-IA slice per the master plan backlog.
