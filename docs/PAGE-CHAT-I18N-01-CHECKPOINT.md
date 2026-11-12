# PAGE-CHAT-I18N-01 — Checkpoint

**Task:** PAGE-CHAT-I18N-01 — Translate the remaining English chat lines and visible error text on the workspace page
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PAGE-STATUS-I18N-01 LOCK. Admitted by the control plane on Keith's "Yes, keep going".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with FRONTEND and I18N: `page.tsx`, `workspace-shell.test.tsx` and the three message files | f642db2 |
| 1. Implementation | sonnet subagent (Sonnet 5.5: UI copy in one page and the message files) in worktree lane/PAGE-CHAT-I18N-01, fast-forwarded onto main | e942dd9 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **New keys:** 12 flat keys in the existing `pageStatus` namespace in en, zh-TW and zh-CN, filled with the existing `fill` helper.
  - "Auth module" follows the existing terms: 驗證模組 in zh-TW and 认证模块 in zh-CN.
  - The dynamic parts `{reason}`, `{detail}`, `{count}` and `{status}` stay dynamic.
- **Moved:**
  - the auth-module install chat lines: missing user, no session, inactive session (2 uses), file surface not ready, not available `{reason}`, pre-install checkpoint unavailable or failed `{detail}`, and template list empty;
  - generation failed `{detail}` (2 uses);
  - the "files are ready" summary with its next steps. Commands, file names and env names stay in English.
  - two `throw new Error` messages that reach the screen: "Session create failed ({status})" through `sessionCreateError`, and "Session stop failed ({status})" through `sessionActionError`.
- **Left on purpose:** five `throw new Error` literals whose text never reaches the screen:
  - checkpoint, dashboard and preview status loads, which are logged and replaced by translated text;
  - two chat paths that already throw translated text.

**Tests:**
- New, in `workspace-shell.test.tsx`:
  - the 12 keys exist in all three files, zh differs from en, placeholders match, and the key sets are equal;
  - `page.tsx` has none of the 13 moved literals and references every key.
- Updated:
  - the auth install checkpoint test now expects the key;
  - the summary test now checks `{count}`, `npm install` and `SETUP-AUTH.md` in all three files;
  - the PAGE-STATUS-I18N-01 key test now asserts each original key is present, instead of the exact 99-key set.

**Control-plane review:** the diff only swaps literals for keys. The zh-TW and zh-CN summaries were read in full.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | same tree after the fast-forward |
| frontend `npm test` | 1785 of 1785 passed (1783 + 2) | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| message files | valid JSON, LF | — |
| diff scope | the five write-set files | — |

## Limits

- **Not deployed.** It goes out with STAGING-DEPLOY-I18N-01.
- **English still appears inside the translated sentences** in two places:
  - the `{reason}` and `{detail}` parts come from `lib/auth-module` (`detectAuthModuleEligibility` and the generator) and are English;
  - a network failure shows the browser's own error text, such as "Failed to fetch".

  Both are registered as AUTHMOD-I18N-01. The network fallback is part of its scope.
- **DESIGN.md:** the worker wrote that DESIGN.md does not exist. It does exist at the repository root. UI item 5 is not affected, because nothing visual changed.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, fast-forwarded by the control plane; 11: dispositions below), UI 9/9 (1 and 2: 12 keys in all three files under the I18N lease, real translations tested; 3: no icon change; 4: skills read, copy tone only; 5: no styling change; 6: the messages are the failed and success states, key-tested; 7: no redesign; 8: test ids kept; 9: no flow change, and the text is seen after the deploy)
FOLLOWUPS: 2 registered (AUTHMOD-I18N-01; STAGING-DEPLOY-I18N-01) / 1 superseded (the untranslatable network fallback, into AUTHMOD-I18N-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- not deployed.
