# AUTHMOD-I18N-01 — Checkpoint

**Task:** AUTHMOD-I18N-01 — Translate the auth-module eligibility and generation messages and the network fallback
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PAGE-CHAT-I18N-01 LOCK. Admitted by the control plane on Keith's "Yes, keep going".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with FRONTEND and I18N: auth-module detection and generator files and their tests, `page.tsx`, `workspace-shell.test.tsx` and the three message files; the template files were excluded | c8537fd |
| 1. Implementation | sonnet subagent (Sonnet 5.5: message copy and codes in the frontend) in worktree lane/AUTHMOD-I18N-01, fast-forwarded onto main | 713baee |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **Codes already existed.**
  - `AuthModuleEligibilityResult.code` is one of `MISSING_PACKAGE_JSON`, `MALFORMED_PACKAGE_JSON`, `UNSUPPORTED_FRAMEWORK` or `ELIGIBLE`.
  - `AuthModuleGenerationError.code` is one of `INELIGIBLE`, `MALFORMED_PACKAGE_JSON`, `UNSAFE_TEMPLATE_PATH` or `FORBIDDEN_TEMPLATE_CONTENT`.
  - The only library change: `AuthModuleGenerationError` gains an optional `subject` field (the eligibility code or the file path), passed as an optional third constructor argument. Existing fields and English messages are unchanged.
  - `auth-module-detection.ts` and all template files are untouched.
- **Translation in `page.tsx`:**
  - `AUTH_REASON_KEYS` and `AUTH_ERROR_KEYS` map the codes to 8 new `pageStatus` keys, through `translateAuthReason` and `translateAuthGenerationError`.
  - An unknown code falls back to the English text.
  - The forbidden-content message leaves out the token name, which stays in the English `error.message` for logs.
- **Network fallback:**
  - The session create and session stop catch blocks show `pageStatus.networkError` when the error is a `TypeError`, which is how a failed fetch rejects.
  - HTTP errors keep the translated "failed ({status})" text.
- **New text** (en / zh-TW / zh-CN):
  - "Network error. Check your connection and try again." / 網路錯誤，請檢查連線後再試一次。 / 网络错误，请检查连接后重试。
  - three eligibility reasons, for example "Auth module installation currently supports Next.js projects only." / 目前驗證模組僅支援 Next.js 專案。 / 当前认证模块仅支持 Next.js 项目。
  - four generation errors, with the `{reason}` and `{path}` placeholders.

**Tests:**
- New in `workspace-shell.test.tsx`, 3 tests:
  - the keys and translations, with matching placeholders;
  - every code mapped to its key;
  - both catch blocks use `networkError`.
- `auth-module-generator.test.ts` also checks the `subject` and the unchanged English message.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | same tree after the fast-forward |
| frontend `npm test` | 1788 of 1788 passed (1785 + 3) | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| template files | none in the diff | — |
| line endings | the 7 files are LF | — |

## Limits

- **Not deployed.** It goes out with STAGING-DEPLOY-I18N-01.
- **The `TypeError` check is loose.** Any other `TypeError` inside those two try blocks would also show the network text.
- **Other flows still show the browser's English** text for a network failure. Their catch blocks still show `error.message`.
- **Raw text inside the messages:** the `{detail}` in "pre-install checkpoint failed", and in the generic generation-failure path, is still the raw error text.
- All three are registered as one task, NETWORK-ERROR-I18N-01: a shared fetch helper with a translated network error.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, fast-forwarded by the control plane; 11: dispositions below), UI 9/9 (1 and 2: 8 keys in all three files under the I18N lease, real translations tested; 3: no icon change; 4: skills not opened by the worker, because this is copy only and matches the existing terms; 5: no visual change; 6: the failed and ineligible states are translated and key-tested; 7: no redesign; 8: test ids kept; 9: no flow change), BACKEND item 3 (no generated-app template touched)
FOLLOWUPS: 1 registered (NETWORK-ERROR-I18N-01) / 2 superseded (the raw detail texts, and the loose TypeError check, into NETWORK-ERROR-I18N-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- not deployed.
