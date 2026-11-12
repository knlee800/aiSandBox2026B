# COS-DRAFTS-POLISH-01 — Checkpoint

**Task:** COS-DRAFTS-POLISH-01 — Draft card reply language as a name
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** AGENT. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the COS-DRAFTS-01B LOCK. Admitted by the control plane on Keith's "you can keep working on other tasks first".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with FRONTEND and I18N. The admission record carries the date 2026-11-11 from a stale template; the correct date is 2026-11-12, and this lock corrects the board | 0f3d0e1 |
| 1. Implementation | sonnet subagent (Sonnet 5.5: one frontend component and its test) in worktree lane/COS-DRAFTS-POLISH-01, fast-forwarded onto main | b836dcd |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **The draft card:** the Chief of Staff draft card on the Team page now shows the reply language as a translated name instead of the code. It does this through a new `draftReplyLanguageName(code, t)` in `collaboration-draft.ts`, used by `buildDraftCard`. An unknown code is shown as it is.
- **New keys:** four keys in the `collaboration` namespace, in all three message files:

| Code | en | zh-TW | zh-CN |
|---|---|---|---|
| owner | The language I write in | 與我書寫的語言相同 | 与我书写的语言相同 |
| en | English | 英文 | 英文 |
| zh-TW | Traditional Chinese | 繁體中文 | 繁体中文 |
| zh-CN | Simplified Chinese | 簡體中文 | 简体中文 |

  The wording copies the workflow form's names. The existing `platform.agentWorkflow.replyLanguage.*` keys could not be reused, because the card's translator is the `collaboration` namespace, and passing a second translator would mean changing `collaboration-page.tsx`, which is outside the write set.
- **Unchanged:** `collaboration-view.tsx` and the test ids.

**Tests:** a new test covers all four codes in en, zh-TW and zh-CN, on the card value and in the rendered markup, and checks that unknown codes are shown as they are. The existing valid-draft test now expects "Traditional Chinese".

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | same tree after the fast-forward |
| frontend `npm test` | 1800 of 1800 passed (1799 + 1) | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| line endings | the 5 files are LF | — |

## Limits

- **Not deployed.** It goes out with STAGING-DEPLOY-POLISH-01.
- **The same four names now live in two places:** `platform.agentWorkflow.replyLanguage` and `collaboration.draftReplyLanguage*`. Sharing one source is registered as REPLY-LANG-KEYS-01, which is optional and which Keith may drop.
- **Skills:** the worker did not read the Impeccable and Emil Kowalski skills, because this is a text-only change.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, fast-forwarded by the control plane), UI 8/9 (1 and 2: four keys in all three files under the I18N lease, real translations tested; 3: no icon; 4: not met, the skills were not read, though the change is text only; 5: no styling change; 6: the unknown-code fallback is tested; 7: no redesign; 8: test ids kept; 9: rendered markup tested)
FOLLOWUPS: 1 registered (REPLY-LANG-KEYS-01) / 0 superseded / 0 dropped / 0 undisposed. The deploy is STAGING-DEPLOY-POLISH-01, registered in the same record as a follow-up of CM-CONTENT-TYPE-02.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- not deployed.
