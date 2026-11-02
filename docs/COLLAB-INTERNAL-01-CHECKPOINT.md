# COLLAB-INTERNAL-01 — Checkpoint

**Task:** COLLAB-INTERNAL-01 — Internal routes and result read-back for the collaboration coordinator
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-02. Registered and admitted in 28c965012693c595ce5bb2f1b851be6aafb2786d. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

Three routes under `/api/internal/collaboration`, behind the internal key: create a run, create and start a referral, read a run with its referrals. Reading a run marks a finished referral completed or failed from the stored execution result. A ledger row is written before enqueue. Referral jobs are Ask jobs (`executionIntent: conversation`, `runMode: ask`) with no harnessVersion, so a text answer completes and is charged like any Ask.

## Found in review

The first build left referral jobs as Build jobs, which the worker fails when there are no file actions, so every referral would have failed. The returned run was also read before the sync. Both fixed. `orchestration.persistence.spec.ts` asserted the module has no controller; the control plane added it to the write scope and it now asserts only this controller.

## Implementer

Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 1dfdceae-e9e5-46f5-93ef-67205770f55f.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npx jest` | 2474 passed, 7 skipped, 14 failed; only the known smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| Validator | exit 0 at this record |

## Limits

Not deployed, not run against a real provider. Nothing proves the migration ran on staging; COLLAB-LIVE-01 checks it. The caller is trusted through the internal key, so the route does not check that the session belongs to the user. Referral duration stays 0. The separate `collaboration_referral` credit rate is not used.
