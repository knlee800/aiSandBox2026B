# UX-PV-02A Checkpoint — Preview Failure Diagnostic Copy

## Task metadata

| Field | Value |
|---|---|
| Task ID | UX-PV-02A |
| Family | UX-PV (Preview UX Reliability) |
| Status | COMPLETE and LOCKED |
| Priority | High |
| Nature | FRONTEND-ONLY / PREVIEW UX RECOVERY |
| Risk | Low |
| Depends on | UX-PV-01 (COMPLETE and LOCKED — `docs/UX-PV-01-CHECKPOINT.md`) |

## Problem addressed

After preview auto-start retries are exhausted, users saw a generic "Preview error" message that gave no indication of the likely cause. The message did not explain that the app may have a build, startup, or runtime error that prevented the dev server from responding.

## Objective

Replace the generic preview error copy with clearer multilingual diagnostic copy while preserving the Refresh fallback. No Ask AI button in this slice.

## Exact files changed during implementation

Production source files changed:

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

Test files changed:

- `frontend/components/workspace/workspace-shell.test.tsx`

Files NOT changed:

- `frontend/app/[locale]/app/page.tsx`
- All backend / API / service files
- `workspace-tab-registry.ts`, `workspace-tab-bar.tsx`, `workspace-sidebar.tsx`
- Command Input, Build Targets, Chat/History, file-tree, checkpoint/history logic
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`

## Diagnostic copy summary

`PreviewStateMessage` error branch in `workspace-shell.tsx` was updated. The generic hardcoded "Preview error" heading, body, and action were replaced with three new i18n recovery keys, routed through `recoveryCopy.workspace.*`.

### Before

```
heading: "Preview error"
body:    "The preview failed to load for this active session."
action:  "Choose Refresh to retry the preview surface."
```

### After

```
heading: recoveryCopy.workspace.previewErrorHeading
body:    recoveryCopy.workspace.previewErrorBody
action:  recoveryCopy.workspace.previewErrorAction
```

Fallback strings (non-projectFirstUx path) were also updated to use the same diagnostic language.

## i18n keys added

All keys added under `recovery.workspace` in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `previewErrorHeading` | Preview could not load | 預覽無法載入 | 预览无法加载 |
| `previewErrorBody` | The preview failed to connect after multiple retries. The app may have a build or startup error. | 預覽在多次重試後仍無法連線。應用程式可能有建構或啟動錯誤。 | 预览在多次重试后仍无法连接。应用程序可能有构建或启动错误。 |
| `previewErrorAction` | Use Refresh to retry, or ask AI to diagnose and fix the issue. | 使用重新整理再試一次，或請 AI 診斷並修復問題。 | 使用刷新再试一次，或请 AI 诊断并修复问题。 |

The existing `previewError` key was preserved to avoid breaking any other references.

## Tests updated

`frontend/components/workspace/workspace-shell.test.tsx`:

- Updated `renders preview error state` to assert new diagnostic heading, body, and action copy.
- Extended recovery workspace-key i18n coverage to include `previewErrorHeading`, `previewErrorBody`, `previewErrorAction` for `en`, `zh-TW`, and `zh-CN`.

## Preserved invariants from UX-PV-01

- Preview auto-start on project open: unchanged.
- First-load iframe error silent retry (3 attempts, 2 s): unchanged.
- Start Preview and Refresh manual fallbacks: unchanged.
- Existing preview test IDs: unchanged.

## Non-goals confirmed

- No `page.tsx` chat-submit wiring.
- No "Ask AI to Fix" button (deferred to UX-PV-02B).
- No backend log API.
- No Preview service changes.
- No Chat/History changes.
- No Build Targets changes.
- No Command Input changes.
- No sidebar changes.

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 589 tests, 589 pass, 0 fail |
| ReadLints | PASS — no linter errors |
| `tsconfig.tsbuildinfo` | Restored after validation |
| Live browser test | PASS |

## Next recommended step

UX-PV-02B — Preview Failure Ask AI Fix Prompt.

Wire an "Ask AI to Fix" button into the `PreviewStateMessage` error state that fills the chat prompt with a structured diagnostic request and auto-submits through the existing `onSubmitChatPrompt` path in `page.tsx`.
