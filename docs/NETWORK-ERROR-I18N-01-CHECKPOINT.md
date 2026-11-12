# NETWORK-ERROR-I18N-01 — Checkpoint

**Task:** NETWORK-ERROR-I18N-01 — One fetch helper with a translated network error for the workspace page
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the AUTHMOD-I18N-01 LOCK. Admitted by the control plane on Keith's "Small follow-ups".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with FRONTEND and I18N: a new `frontend/lib/network-error.ts` and its test, `page.tsx`, `workspace-shell.test.tsx`, the message files if needed | 94e7f15 |
| 1. Implementation | sonnet subagent (Sonnet 5.5: a small helper and message copy in one page) in worktree lane/NETWORK-ERROR-I18N-01, fast-forwarded onto main | 1d2ebec |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **The helper:** `frontend/lib/network-error.ts` exports `isNetworkFailure(error)`. It is true only for a `TypeError` whose message matches a browser fetch-failure text, compared without case:
  - "failed to fetch" (Chrome and Edge);
  - "NetworkError when attempting to fetch resource" (Firefox);
  - "Load failed" (Safari);
  - "fetch failed" (undici);
  - "Network request failed" (polyfills).

  A `TypeError` thrown by our own code no longer counts as a network failure. `AbortError` and `TimeoutError` are not matched, because the page has no aborts or timeouts on its fetches.
- **In `page.tsx`,** the local check from AUTHMOD-I18N-01 is replaced by the helper. 23 places now show `pageStatus.networkError` on a network failure. Otherwise they keep the text they showed before. The 23 places are:
  - the "error message, else translated fallback" blocks for workspaces, projects (open three times, fork twice), project history, snapshots and archives;
  - the session bootstrap `[FETCH]` and `[UNEXPECTED]` catches;
  - both chat fallbacks; the quota guidance is unchanged;
  - the `{detail}` in "pre-install checkpoint failed" and in the generic generation-failure message;
  - session create and session stop, which now use the stricter rule.
- **Left unchanged:**
  - catches that already show a fixed translated message: file save, revert, compare, diff, checkpoint snapshot, live open, dashboard and preview;
  - the JSON parse catch, because a parse failure is not a network failure;
  - catches that only log, or are silent;
  - the 410 check.
- **No new keys,** so the message files are untouched.

**Tests:**
- New `frontend/lib/network-error.test.ts`, 11 tests: each failure text, any letter case, our own `TypeError`, a plain `Error`, `AbortError` and `TimeoutError`, and non-errors.
- `workspace-shell.test.tsx`:
  - the session catch test now checks the helper import, and that `instanceof TypeError` is gone;
  - a new source test checks that 20 or more message-or-fallback blocks use the helper, and that the bare `error.message` pattern is gone.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | same tree after the fast-forward |
| frontend `npm test` | 1799 of 1799 passed (1788 + 11) | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| diff scope | 4 files, no message file | — |
| line endings | LF | — |

## Limits

- **Not deployed.** It goes out with STAGING-DEPLOY-I18N-02.
- **Not checked offline in a browser.** That would need Keith, and the helper's rule is unit-tested.
- **Skills:** the worker did not read the Impeccable and Emil Kowalski skills, because there is no visual or interaction change.
- **Still open:** three things remain:
  - the fixed-message catches show no separate network message;
  - the bootstrap `[PARSE]` catch shows raw text;
  - some checks depend on raw English helper text, such as the 410 check.

  All three are registered as one optional task, PAGE-ERROR-POLISH-01.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, fast-forwarded by the control plane; 11: dispositions below), UI 8/9 (1: no new strings, and the existing `networkError` has real translations; 2: no message-file edit; 3: no icon; 4: not met, the skills were not read, though no visual or interaction change was made; 5: no visual change; 6: the failed states show translated text and are covered by tests; 7: no redesign; 8: test ids kept; 9: unit-tested, no live check required)
FOLLOWUPS: 1 registered (PAGE-ERROR-POLISH-01) / 2 superseded (the raw [PARSE] text, and the checks that depend on raw English text, into PAGE-ERROR-POLISH-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- not deployed.
