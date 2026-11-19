# COS-EVAL-FAILCHAIN-TIDY-01 — Checkpoint

**Task:** COS-EVAL-FAILCHAIN-TIDY-01 — Tidy the chain-failed eval case's request and live report
**Status:** COMPLETE AND LOCKED — 2026-11-19. Built, not deployed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** AI-SERVICE.
**Source:** registered 2026-11-19 by the COS-EVAL-FAILCHAIN-01 LOCK (the worker's follow-ups). Keith chose it on 2026-11-19 ("yes admit").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with AI-SERVICE; 11-path write set; the design in the backlog body | b3e72cb |
| 2. Implementation | sonnet subagent (Sonnet 5.5), fast-forwarded | a7f658f |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## What changed

**The failure request moved.**
- `chainFailedOwnerRequest`, `chainFailedWorkflowLabel`, `CHAIN_FAILED_CATEGORIES`, `CHAIN_FAILED_CATEGORY_LINES`, `CHAIN_FAILED_LABEL_MAX` and their private patterns moved from `briefing-prompt.ts` into `briefing-instructions.ts`, beside `chainTriggerOwnerRequest`.
- The moved lines are the removed lines unchanged. The control plane compared them: every removed line that does not reappear is a comment about the old place or the removed function.
- `briefing-instructions.ts` imports only a type from `briefing-types.ts`, so there is no import cycle.

**One request function.**
- `briefingTaskOwnerRequest` now returns:
  - the Morning briefing preset when there is no request;
  - the mail-trigger request for `mail-trigger`;
  - the failure request for `chain-failed`;
  - the chain-trigger request for `chain-trigger`.
- Any other kind reaches a private `assertNever` and throws, so no kind falls through by accident.
- `briefingCaseOwnerRequest` is removed, and every caller uses `briefingTaskOwnerRequest`.
- The runner spec pin now says `briefingTaskOwnerRequest` returns the failure request. Before, it said the two functions differ.

**The field keeps its name.** `completedAt` is the gateway's own `chainTriggerTask` input name. The case, the loader rules and the types are unchanged. `briefing-types.ts` was in the write set and needed no change.

**The live console report.**
- Each case line now prints `reasonUnavailable=<n>` and `causeClaims=<n>` after `actionClaims`.
- The totals line prints `causeClaims=<n>`.
- A row written before COS-EVAL-FAILCHAIN-01 prints 0, as `briefing-results.ts` counts it.

**The token-cap comment** now says thirteen cases. The cap stays at 150,000.

**Unchanged:** the Chief of Staff instruction copy and its version, the phrase lists, scoring, cases and baselines.

## Gates (rerun by the control plane)

| Gate | Worker baseline | Branch (control plane) | main after landing |
|---|---|---|---|
| ai-service `npm test` | 1467 passed, 1 skipped | 1468 passed, 1 skipped (68 suites) | 1468 passed, 1 skipped |
| ai-service `npx tsc --noEmit -p tsconfig.json` | – | rc 0 | – |
| ai-service `npm run build` | – | rc 0 | – |

The diff was read. It changes 10 of the 11 write-set paths, with LF line endings, and no tracked build artifact changed.

**New test:** `prints reasonUnavailable and causeClaims per case and causeClaims in the totals line` in `live/briefing-live-runner.spec.ts`. It also covers a row with no arrays.

## Worker process

The worker did not fully do the boot sequence:
- It read AGENTS.md and the task body.
- It found the board lines by search and did not read the board itself.
- It did not read the two CLAUDE.md sections. It said the brief already carried their rules.

It reported EVERY 11/11; the control plane counts item 4 (do the boot sequence) as not met. Its work stayed inside the write set and the gates pass, so nothing in the result depends on the missed reads.

## Limits

- The new report fields are checked only on synthetic rows. A real run's output shows them first in COS-EVAL-LIVE-04.

CHECKLIST: EVERY 10/11 (4: the worker skipped the CLAUDE.md section reads and read the board by search; 8: no runtime or provider call), BACKEND 6/6 (eval code only; no guard, route, schema or frozen-contract file; no known ai-service failures and none new)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-19 by the control plane:
- Lane 1 released EMPTY;
- AI-SERVICE released UNOWNED.

The next deploy of main (STAGING-DEPLOY-EVALFAIL-01) carries this change along with COS-EVAL-FAILCHAIN-01. Staging is unchanged (d6530ad).
