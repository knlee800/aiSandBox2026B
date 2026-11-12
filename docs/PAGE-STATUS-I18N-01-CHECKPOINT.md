# PAGE-STATUS-I18N-01 — Checkpoint

**Task:** PAGE-STATUS-I18N-01 — Translate the older hardcoded status messages on the workspace page
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the SNAPSHOT-NOTICE-01 LOCK. Admitted by the control plane on Keith's "Yes, keep going".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with FRONTEND and I18N: `page.tsx`, `workspace-shell.test.tsx` and the three message files | 116c1f8 |
| 1. Implementation | sonnet subagent (Sonnet 5.5: UI copy in one page and the message files) in worktree lane/PAGE-STATUS-I18N-01, fast-forwarded onto main | cfc862a |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **New namespace:** `pageStatus`, with 99 keys in each of en, zh-TW and zh-CN, added at the end of each file. No existing key was changed.
- **The page:** `page.tsx` gets `getPageStatusMessages(locale)`, in the same pattern as `getWorkspaceMessages`. A small `fill` helper fills the placeholders `{target}`, `{exitCode}`, `{step}`, `{total}` and `{status}`.
- **What moved:** every hardcoded English status and error string the page sets, and every English fallback used when the server gives no message. Examples:
  - "Project opened." is 專案已開啟。 in zh-TW and 项目已打开。 in zh-CN.
  - "Workspace snapshot restored." is 工作區快照已還原。 in zh-TW and 工作区快照已恢复。 in zh-CN.
  - The build, chat and orchestration progress lines.
- **Terms** follow the existing files:
  - zh-TW: 專案, 工作區, 工作階段, 檢查點, 還原, 快照;
  - zh-CN: 项目, 工作区, 会话, 检查点, 恢复, 快照;
  - "archive" is new: 封存檔 in zh-TW and 压缩包 in zh-CN.
- **One deliberate change:** the visibility message used to show the raw enum. It now picks the public or private sentence, which matches how the page already normalises the value.
- **Unchanged:** behaviour, control flow, state names, test ids and server messages.

**Left on purpose:**
- `console.error` text and internal `throw new Error(...)` literals, which are mostly caught and replaced before display;
- about 9 `appendAssistantMessage('Auth module installation …')` chat lines.

Both are registered as PAGE-CHAT-I18N-01 (see Limits).

**Tests:** 3 new in `workspace-shell.test.tsx`:
- every key exists in all three files, is not empty, and zh-TW and zh-CN differ from en;
- the placeholders match in all three files;
- `page.tsx` contains none of the moved English literals, and references every key.

No existing assertion changed.

**Control-plane review:** the diff only swaps literals for keys and adds the getter and `fill`. The translations were spot-checked in all three languages.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | same tree after the fast-forward |
| frontend `npm test` | 1675 of 1675 passed (1672 + 3) | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| message files | valid JSON, LF | — |
| diff scope | the five write-set files | — |

## Limits

- **Not deployed.** It goes out with the next deploy, STAGING-DEPLOY-SNAP-05, which deploys main.
- **Chat lines and errors still in English:** the auth-module assistant chat lines, and any internal error text that can reach the screen. Registered as PAGE-CHAT-I18N-01.
- **Stray files:** the worker left four untracked scratch files in its worktree root: `scratch-conv.cjs`, `scratch-conv2.cjs`, `scratch-test.cjs` and `scratch-keys.json`. Its own delete was refused by permissions, and the control plane did not delete them on its behalf.
  - So the worktree `C:\Users\knlee\aisb-worktrees\PAGE-STATUS-I18N-01` and branch `lane/PAGE-STATUS-I18N-01` stay until Keith removes them. Its `node_modules` link is already removed.
  - The branch is fully merged into main.

CHECKLIST: EVERY 10/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: not met in full, because the worktree and branch could not be removed while the worker's scratch files remain; 11: dispositions below), UI 8/9 (1 and 2: 99 keys in all three files under the I18N lease, real translations tested; 3: no icon change; 4: skills read for copy tone, no visual change; 5: n/a, no styling change; 6: the status and error texts are the states themselves, covered by key and source tests; 7: no redesign; 8: test ids kept; 9: not required, only the text source changed, and it is seen with the next deploy)
FOLLOWUPS: 1 registered (PAGE-CHAT-I18N-01) / 1 superseded (internal error text that can surface, into PAGE-CHAT-I18N-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- not deployed.
