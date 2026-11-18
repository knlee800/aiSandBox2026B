# RUN-FINISH-EVENT-01 — Checkpoint

**Task:** RUN-FINISH-EVENT-01 — Settle a run at its last step or emit a run-finished event
**Status:** COMPLETE AND LOCKED — 2026-11-18. Built, not deployed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP (was 4-step; Keith chose the one-constant fix). **Evidence class:** LOCAL-TESTS. **Mutexes:** GATEWAY; GOVERNANCE held for the ARCHITECTURE.md wording in this record.
**Source:** registered 2026-11-16 by the TRIGGER-CHAIN-01 LOCK. Keith chose it on 2026-11-18 ("You pick one", then "Sweep every minute").

## Decision

Settling a run the moment its last step completes would change `orchestration.service.ts`, a file of the frozen contract HARNESS_ENTITLEMENT_PROOF_V1. That would need the contract change protocol and a stage-start. Keith chose the alternative: run the existing collaboration sweep every minute instead of every 5 minutes.

The sweep already does three things:
- syncs in-progress steps from their executions;
- recovers hand-off requests;
- settles finished runs.

So finished steps, finished runs, the Results badge and chain triggers now follow within about 1 to 2 minutes instead of up to about 6. Today's MAIL-AUTH-LIVE-01 run showed the old lag: its step stayed "in progress" for minutes after its execution ended.

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY; 2-path write set | 3caa07f |
| 2. Implementation | sonnet subagent (Sonnet 5.5: one constant and its test), fast-forwarded | 9e2a1c9 |
| 3. LOCK | this checkpoint, the ARCHITECTURE.md wording, board, backlog, sidecar and plan; validator | this record |

## Change

```diff
-export const COLLABORATION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
+// RUN-FINISH-EVENT-01: every minute, so finished steps and runs settle within about 1 to 2 minutes.
+export const COLLABORATION_SWEEP_INTERVAL_MS = 60 * 1000;
```

The spec now pins `60 * 1000`. Nothing else changed: the 24-hour hand-off timeout, `orchestration.service.ts` and the frozen contract are untouched.

**ARCHITECTURE.md** (Keith: "Yes, land it"). Five lines now say the sweep runs every minute:
- the timer rule;
- the gateway module list;
- the chain-trigger paragraph ("up to about two minutes");
- the in-process timer table;
- the no-schedulers line.

## Gates (rerun by the control plane on the branch)

| Gate | Result |
|---|---|
| gateway `npx tsc --noEmit` | rc 0 |
| gateway `npm test -- --maxWorkers=2` | 6634 passed, 7 skipped, 14 failed: only the known `smoke.integration.spec.ts` failures, which need a database (same counts as before the change) |
| gateway `npm run build` | rc 0 |

The diff was read: two files, three added lines and two removed, exactly the write set.

## Worker findings

The worker skipped the boot reads (AGENTS.md, CLAUDE.md, board, backlog) and the targeted baseline run. Even so, it reported EVERY 11/11. The change is the two lines above, and the control plane reran every gate. The shortfall is recorded here.

## Limits

- Not deployed. STAGING-DEPLOY-SWEEP-01 rides with the next deploy.
- The sweep's per-minute load on staging is not measured. It runs indexed lookups of in-progress and active rows only, which are few.

CHECKLIST: EVERY 10/11 (4: the worker skipped the boot reads; 7: the worker's baseline was not run, the control plane reran all gates; 8: no runtime), BACKEND 6/6 (4: no frozen-contract file touched; 5: no schema change; 6: only the 14 known failures), GOVERNANCE 9/9 for the wording (Keith approved the exact text; GOVERNANCE held for the record and released)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-SWEEP-01) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY released UNOWNED;
- GOVERNANCE held for the wording and released.
