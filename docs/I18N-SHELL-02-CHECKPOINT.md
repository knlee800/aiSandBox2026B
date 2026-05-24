# I18N-SHELL-02 Checkpoint — Wire Core Chat Panel i18n Keys

**Status:** COMPLETE and LOCKED
**Task ID:** I18N-SHELL-02
**Family:** I18N
**Completed:** 2026-05-22
**Checkpoint doc:** `docs/I18N-SHELL-02-CHECKPOINT.md`
**Depends on:** I18N-SHELL-01 (COMPLETE and LOCKED), I18N-PAGE-01 (COMPLETE and LOCKED)

---

## Objective

Remove hardcoded English user-facing core chat-panel strings from `WorkspaceChatPanel` in `workspace-shell.tsx` and wire them into the existing locale-switch pattern (`aiMessages` / `commonMessages`) across all three supported locales (en, zh-TW, zh-CN).

Target strings: AI Prompt label, Model Provider label, bounded orchestration toggle label, Message Thread heading, no-messages empty state, User/Assistant role labels, waiting-for-response placeholder, Sending… state, and Send button.

---

## Exact Files Changed

### Production source files

- `frontend/components/workspace/workspace-shell.tsx` — 10 hardcoded core chat-panel strings replaced with `props.aiMessages.*` / `props.commonMessages.*` bindings
- `frontend/messages/en.json` — 8 new `ai.*` keys added
- `frontend/messages/zh-TW.json` — 8 new `ai.*` keys added (Traditional Chinese)
- `frontend/messages/zh-CN.json` — 8 new `ai.*` keys added (Simplified Chinese)

### Test files

- `frontend/components/workspace/workspace-shell.test.tsx` — new `describe` block `workspace core chat panel i18n wiring — I18N-SHELL-02` added with 3 source-assertion tests

---

## Keys Added per Locale File

All three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`) received these new keys under the `ai` namespace:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `ai.promptLabel` | "AI Prompt" | "AI 提示" | "AI 提示" |
| `ai.modelProviderLabel` | "Model Provider" | "模型提供者" | "模型提供方" |
| `ai.orchestrationLabel` | "Enable bounded orchestration (up to 3 sequential steps)" | "啟用有界編排（最多 3 個連續步驟）" | "启用有界编排（最多 3 个连续步骤）" |
| `ai.messageThread` | "Message Thread" | "訊息串" | "消息线程" |
| `ai.noMessages` | "No messages yet." | "尚無訊息。" | "暂无消息。" |
| `ai.roleUser` | "User" | "使用者" | "用户" |
| `ai.roleAssistant` | "Assistant" | "助理" | "助手" |
| `ai.waitingForResponse` | "(waiting for response...)" | "（等待回應中...）" | "（等待响应中...）" |

### Existing keys reused (not duplicated)

- `ai.sending` — already present in all 3 locale files; used for "Sending..." state
- `common.send` — already present in all 3 locale files; used for "Send" button label

---

## Wiring Summary (`workspace-shell.tsx`)

All replacements are inside `WorkspaceChatPanel`, which already received `aiMessages` and `commonMessages` as props (established by I18N-SHELL-01). No new prop threading was required.

| Hardcoded string removed | Replacement |
|---|---|
| `AI Prompt` | `{props.aiMessages.promptLabel}` |
| `Model Provider` | `{props.aiMessages.modelProviderLabel}` |
| `Enable bounded orchestration (up to 3 sequential steps)` | `{props.aiMessages.orchestrationLabel}` |
| `{isSending ? 'Sending...' : 'Send'}` | `{isSending ? props.aiMessages.sending : props.commonMessages.send}` |
| `Message Thread` | `{props.aiMessages.messageThread}` |
| `No messages yet.` | `{props.aiMessages.noMessages}` |
| `'(waiting for response...)'` | `props.aiMessages.waitingForResponse` |
| `message.role === 'user' ? 'User' : 'Assistant'` | `message.role === 'user' ? props.aiMessages.roleUser : props.aiMessages.roleAssistant` |

Layout, classNames, behavior, and all `data-testid` values were fully preserved.

---

## Tests Added / Updated

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

New `describe` block: `workspace core chat panel i18n wiring — I18N-SHELL-02`

Three tests added:

1. **`locale files define required ai/common keys for core chat panel copy`** — reads all 3 locale JSON files and asserts each of the 9 required `ai.*` keys and `common.send` is a non-empty string in all 3 locales.
2. **`workspace shell source removes targeted hardcoded English core chat-panel strings`** — reads `workspace-shell.tsx` source and asserts `doesNotMatch` for all 8 removed hardcoded patterns.
3. **`workspace chat panel uses ai/common message values for targeted labels and states`** — reads `workspace-shell.tsx` source and asserts `match` for all 10 wired expression patterns, including the role-label ternary and the isSending branch.

---

## Validation Results

All validation run from `C:\Users\knlee\aiSandBox2026B\frontend`.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 454 tests, 0 failed |
| ReadLints on touched files | PASS — no linter errors |
| `npm run build` | ENVIRONMENTAL FAILURE — Google Fonts TLS/cert issue (see below) |
| `frontend/tsconfig.tsbuildinfo` | Restored via `git restore` |

### Known build environment caveat

`npm run build` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` when `next/font` attempts to fetch `Inter` from Google Fonts. This is a recurring TLS/certificate environment limitation, identical to the caveat recorded in I18N-SHELL-01 and I18N-PAGE-01 checkpoints. It is not caused by any code change in this task. The build artifact `frontend/tsconfig.tsbuildinfo` was restored after the attempt.

---

## Non-Goals Confirmed

The following were explicitly out of scope and were not touched:

- `frontend/app/[locale]/app/page.tsx` — not modified
- AUTH-MODULE chat-message strings — not modified
- Visual-edit / file-action strings from I18N-SHELL-01 — not modified
- Checkpoint description strings — not modified
- Status panel copy — not modified
- Workspace/project modal copy — not modified
- `recoveryCopy.ts` — not modified
- Backend services — not modified
- No new npm dependencies introduced
- No UI redesign or layout changes
- No TASK-73C-1 work

---

## Invariants Preserved

- `getAiMessages(locale)` helper unchanged — this slice only added keys to the locale JSON files and consumed them via the existing `aiMessages` prop already wired by I18N-SHELL-01
- All `data-testid` values in `WorkspaceChatPanel` preserved
- All classNames and layout structure preserved
- Existing tests from I18N-SHELL-01 and I18N-PAGE-01 continue to pass (454 total, 0 failed)
- `common.send` and `ai.sending` keys were reused, not duplicated
- No locked tasks modified

---

## Next Recommended Task

The I18N family still has remaining hardcoded English UX copy in `workspace-shell.tsx` outside the core chat panel: session-hint messages, status panel labels, workspace/project modal copy, and `recoveryCopy.ts` strings. The next bounded slice should be registered and scoped accordingly before implementation begins.
