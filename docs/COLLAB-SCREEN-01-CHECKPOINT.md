# COLLAB-SCREEN-01 — Checkpoint

**Task:** COLLAB-SCREEN-01 — A page to start, follow, approve and reject collaboration runs
**Status:** COMPLETE AND LOCKED — 2026-11-03
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-03. Registered and admitted in 261e1e30223e9e5d313f99766d60ff93608ce740. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

Login-based routes under /api/collaboration: start a run with the fixed lead, writer and reviewer team and file access on, list runs for a project, read a run, approve, reject. Not entitled is 403; another user's run is 404 on every route; another user's session is 404; decidedBy is the caller; provider, model and team come from the server. New page `/[locale]/collaboration` with the chain, plain-text answers, approve and reject, plain-word refusals, past runs, a 5-second refresh while active and a double-click guard. A Team link in the workspace for entitled users with a session. All text in en, zh-TW and zh-CN.

The control plane added `frontend/components/workspace/workspace-shell.test.tsx` and `frontend/lib/collaboration.test.ts` to the write scope during review.

## Implementer

Cursor CLI, requested grok-4.7-xhigh, one run. No browser check; COLLAB-LIVE-05 is that check.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npx jest` | 2546 passed, 7 skipped, 14 failed; only the known smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 829 passed, 0 failed |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| Validator | exit 0 at this record |

## Limits

The readable failure reason is partial: it uses the worker's stored executionError, which exists only on the file-action path. tool_loop_disabled and other thrown worker errors still show "Execution failed", because fixing that needs the worker, which was out of scope. Not deployed; never seen in a browser.
