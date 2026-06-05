# UX-PV-02B Checkpoint — Preview Failure Ask AI Fix Prompt

## Task Metadata

**Task ID:** UX-PV-02B
**Family:** UX-PV (Preview UX Reliability)
**Status:** COMPLETE and LOCKED
**Priority:** High
**Nature:** FRONTEND-ONLY / PREVIEW UX RECOVERY
**Risk:** Medium
**Depends on:** UX-PV-02A (COMPLETE and LOCKED — `docs/UX-PV-02A-CHECKPOINT.md`)
**Checkpoint:** `docs/UX-PV-02B-CHECKPOINT.md`

---

## Problem

After preview auto-start/retry fails, UX-PV-02A shows clearer diagnostic copy but the user still has to manually type a request to the AI. This should be a one-click recovery action.

A live-test revision was also required after initial implementation to fix a duplicate-send race and improve the AI prompt quality.

---

## Objective

Add an "Ask AI to Fix" action to the preview error state. The action sends a structured preview-fix prompt through the existing chat flow without introducing stale-state submit bugs or duplicate sends.

---

## Files Changed

- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

---

## Ask AI to Fix UI Summary

- Added `workspace-preview-ask-ai-fix` button to the preview error state in `PreviewStateMessage`.
- Button renders **only** in project-first mode when the `onAskAiToFixPreview` callback is provided.
- Diagnostic heading/body/action copy from UX-PV-02A is preserved and unchanged.
- Refresh fallback and Start Preview fallback both preserved and functional.
- `StateMessage` extended with optional `primaryActionDisabled` prop. Button renders with `disabled` attribute and `disabled:bg-blue-300 disabled:cursor-not-allowed` styling when pending.

---

## i18n Key Added

`recovery.actions.askAiToFixPreview`:
- `en.json`: `Ask AI to Fix`
- `zh-TW.json`: `請 AI 修復`
- `zh-CN.json`: `请 AI 修复`

No other i18n keys were added or modified.

---

## Safe Deferred Submit Summary

In `page.tsx`, `handleAskAiToFixPreview` uses the same proven deferred-submit pattern as `handleCreateProjectFromPrompt`:

1. Sets `pendingPreviewFixPromptRef.current` to the structured prompt.
2. Calls `setChatPromptInput(PREVIEW_ASK_AI_FIX_PROMPT)`.
3. Increments `previewFixAutoSendTick` to trigger a `useEffect`.
4. The `useEffect` waits for `chatPromptInput` to reflect the new value, then clears the pending ref and calls `handleSubmitChatPrompt()`.

This ensures `handleSubmitChatPrompt` always reads `chatPromptInput` from a fresh render closure, eliminating stale-input submit bugs.

---

## Duplicate-Send Fix Summary

A post-implementation live-test revision added a synchronous boolean lock to close all race windows:

- Added `previewFixSubmitInFlightRef = useRef(false)`.
- `handleAskAiToFixPreview` returns immediately if any of these are true:
  - `previewFixSubmitInFlightRef.current` is true
  - `pendingPreviewFixPromptRef.current` is set
  - `chatRequestState` is `'submitting'`, `'queued'`, or `'running'`
- Lock is set **synchronously** before any `setChatPromptInput` or tick update.
- Lock is cleared in `handleSubmitChatPrompt().finally(...)` when submission completes.
- Lock is also cleared in the session-change chat reset `useEffect`.
- Button is visually and functionally disabled while `chatRequestState` is `submitting`/`queued`/`running`, via `chatRequestState` threaded into `WorkspacePreviewPanel` → `PreviewStateMessage` → `primaryActionDisabled` on `StateMessage`.

---

## Improved Prompt Summary

`PREVIEW_ASK_AI_FIX_PROMPT` was improved from a vague request to a structured 8-step investigation protocol. The prompt instructs AI to:

1. Read `package.json` to identify start/dev script, framework, and dependencies.
2. Check for missing or mismatched dependencies.
3. Inspect the framework entry file for import errors, missing exports, or broken references.
4. Check framework config files for port, output, or build misconfigurations.
5. Verify required environment variables if a `.env` file is expected.
6. If commands are available: run `npm install`, then `npm run dev`, and read the output for errors.
7. Apply targeted file fixes for any issues found.
8. Confirm the fix by explaining what was wrong and what was changed.

The prompt explicitly instructs AI not to claim success without concrete file changes or environment confirmation.

---

## Tests Updated

In `frontend/components/workspace/workspace-shell.test.tsx`:

- `workspace-preview-ask-ai-fix` button renders in preview error state when project-first + callback provided.
- Button is absent when callback missing or project-first disabled.
- `askAiToFixPreview` added to required recovery actions key list in locale coverage assertions.
- Explicit locale value assertions for en / zh-TW / zh-CN.
- `StateMessage` source assertions for `primaryActionDisabled` prop, `disabled` attribute, and disabled Tailwind classes.
- `page.tsx` source assertions for improved prompt constant content.
- `page.tsx` source assertions for `previewFixSubmitInFlightRef` lock declaration.
- `page.tsx` source assertions for lock set before `setChatPromptInput` in `handleAskAiToFixPreview`.
- `page.tsx` source assertions for `.finally()` lock clear pattern.
- `page.tsx` source assertions for session-change reset clearing lock.
- `page.tsx` source assertion that `handleAskAiToFixPreview` does not call `handleSubmitChatPrompt` directly.
- Button disabled (`true`) when `chatRequestState === 'submitting'`.
- Button enabled (`false`) when `chatRequestState === 'idle'`.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 599 tests, 599 pass, 0 fail |
| ReadLints | PASS — no linter errors |
| `tsconfig.tsbuildinfo` | restored |

---

## Live Browser Test Result

PASS

- Rapid double-click on "Ask AI to Fix" did not send duplicate prompts.
- Button was visually disabled and unclickable while chat was submitting/running.
- Improved structured prompt was submitted correctly to the chat flow.
- Refresh fallback still worked correctly in preview error state.
- Preview auto-start/retry behavior from UX-PV-01 unchanged.
- UX-PV-02A diagnostic copy unchanged.

---

## Non-Goals Confirmed

- No backend changes.
- No preview log API.
- No preview service changes.
- No Chat/History layout changes.
- No Build Targets changes.
- No Command Input changes.
- No sidebar changes.
- No tab-registry/tab-bar changes.
- No checkpoint/history/file-tree changes.

---

## Next Recommended Step

If runtime logs and root-cause diagnosis from the dev server are needed for more reliable AI-driven preview repair, register **UX-PV-03 — Preview Failure Logs and Root-Cause Diagnostics** as a new task. This would require a backend preview log API and is explicitly out of scope for UX-PV-02B.
