# HOME-START-01 Checkpoint — Build Anything One-Click Start and Send

**Task ID:** HOME-START-01
**Family:** HOME-START
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-31
**Depends on:** UX-IA-31 (COMPLETE and LOCKED — `docs/UX-IA-31-CHECKPOINT.md`)

---

## Root Cause

Two UX bugs in the Home "Build anything" Start flow:

1. **First-click non-response (stale closure):** `handleCreateProjectFromPrompt` used `flushSync` to set `projectNameInput` state, then immediately called `handleCreateWorkspaceProject` from the same (now-stale) render closure. That closure still captured `projectNameInput = ''` (the pre-flushSync value). The required-name guard fired silently. The Home view had no error display, so the user saw nothing happen. Second click succeeded because the first `flushSync` had already committed the new state into the next render's closure.

2. **Prompt not auto-sent:** After successful project creation, `handleCreateProjectFromPrompt` only called `setChatPromptInput(trimmedPrompt)` — it never called `handleSubmitChatPrompt`. The user had to press Send manually.

---

## Stale-Closure Fix

- `handleCreateWorkspaceProject` signature changed to `(overrideName?: string): Promise<boolean>`.
- Name resolution now uses `(overrideName ?? projectNameInput).trim()` — no stale-state dependency.
- Guard/failure paths return `false`; successful create/open returns `true`.
- `handleCreateProjectFromPrompt` removes `flushSync` entirely. It sets state normally, then passes `autoProjectName` directly as `overrideName`.
- `createProjectFromPromptInFlightRef` prevents duplicate in-flight calls.
- On failure (`created === false`): pending ref is cleared, `chatPromptInput` is restored, no auto-send fires.

---

## One-Click Auto-Send

- `pendingAutoSendPromptRef` (`useRef<string | null>`) stores the prompt to send.
- `autoSendFromHomeTick` (`useState(0)`) is incremented after successful creation to trigger the send effect.
- `useEffect([autoSendFromHomeTick, chatPromptInput, handleSubmitChatPrompt, selectedSessionId, workspaceView])`:
  - Guards: `autoSendFromHomeTick !== 0`, `workspaceView === 'project'`, `selectedSessionId` present, ref has a prompt.
  - Aligns `chatPromptInput` before sending (re-runs on next tick if out of sync).
  - Consumes/clears ref before calling canonical `handleSubmitChatPrompt` — prevents double-send.
- `onCreateWorkspaceProject` prop wrapper updated to satisfy `Promise<void>` signature from the shell.

---

## i18n Keys Added

| File | Key | Value |
|---|---|---|
| `frontend/messages/en.json` | `workspace.starting` | `"Starting..."` |
| `frontend/messages/zh-TW.json` | `workspace.starting` | `"啟動中..."` |
| `frontend/messages/zh-CN.json` | `workspace.starting` | `"启动中..."` |

Wired via `getWorkspaceScaffoldMessages` in `workspace-sidebar.tsx`: `starting: read('workspace.starting')`.

---

## Home View UX Changes

- Start button label: `scaffoldMessages.starting` while `isCreatingProjectFromPrompt`, otherwise `scaffoldMessages.start`.
- `projectActionError` is now shown on the Home view (`data-testid="workspace-home-error"`) when not in creating state.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | `handleCreateWorkspaceProject` overrideName param + boolean return; remove `flushSync`; one-shot auto-send refs/effect; in-flight guard |
| `frontend/components/workspace/workspace-shell.tsx` | Start button loading label; home error display |
| `frontend/components/workspace/workspace-sidebar.tsx` | Add `starting` to scaffold messages |
| `frontend/messages/en.json` | `workspace.starting` |
| `frontend/messages/zh-TW.json` | `workspace.starting` |
| `frontend/messages/zh-CN.json` | `workspace.starting` |
| `frontend/components/workspace/workspace-shell.test.tsx` | New tests + source assertions |

---

## Tests Updated

- Home view renders `workspace-home-error` when `projectActionState='error'`.
- Home Start button shows `Starting...` label when `projectActionState='creating'`.
- Source assertion: `handleCreateWorkspaceProject(overrideName?: string): Promise<boolean>`.
- Source assertion: `flushSync` removed from Home prompt flow.
- Source assertion: one-shot pending auto-send guard/effect wiring.
- Source assertion: `workspace.starting` present in en/zh-TW/zh-CN.
- Source assertion: `workspace-sidebar` maps `workspace.starting`.
- Existing Home prompt input and submit tests: still pass.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 536 tests, 536 pass, 0 fail |
| `ReadLints` | PASS — no linter errors |
| Live browser test | PASS — single click on Start creates project and auto-sends prompt |

---

## Non-Goals Confirmed

- No backend changes.
- No API route, model, entity, or service changes.
- No broad redesign.
- No new AI execution path.
- No auth/session refactor.
- No unrelated UX-IA work.

---

## Next Recommended Step

Register and implement the next active task in TASKS.md, or proceed to a new user-facing feature or bug fix as prioritized.
