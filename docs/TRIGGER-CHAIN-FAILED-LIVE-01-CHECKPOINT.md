# TRIGGER-CHAIN-FAILED-LIVE-01 — Checkpoint

**Task:** TRIGGER-CHAIN-FAILED-LIVE-01 — Live check of failed-run chain triggers
**Status:** COMPLETE AND LOCKED — 2026-11-18. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE.
**Mutexes:** STAGING, ENV, PROVIDER-LIVE, CREDIT; GOVERNANCE held for the wording.
**Source:** registered 2026-11-18 by the TRIGGER-CHAIN-FAILED-01 LOCK. Keith opened the window on 2026-11-18 ("Yes, run it") and approved the wording ("Yes, land it").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT; the three authorizations true | 78e0018 |
| 2. Window | from the staging host on d6530ad, 2026-11-18 14:08:44Z to 14:36:35Z | no code change |
| 3. LOCK | this checkpoint, the PRD.md and ARCHITECTURE.md wording, board, backlog, sidecar and plan; validator | this record |

## How a run was made to fail

With the AI service's tool loop off, a harness run fails closed with `tool_loop_disabled` before any provider call (`resolveHarnessRouting`, worker.processor.ts). The window used this:
1. With the chain switch off, the source runs were started and allowed to fail.
2. Then the tool loop and the chain switch went on together.
3. The failed runs were still within the 60 minutes, so the failure trigger could see them.

## Phases

| Phase | Time (UTC) | Settings |
|---|---|---|
| a | 14:09:45 | env files saved at the baselines (gateway.env 616841ca, ai.env 721f4772); nothing changed |
| b | 14:26:10 | the stored Anthropic test key (never shown), `claude-opus-5-5`, runs on; **tool loop off**; write and validation tools off; `CHAIN_TRIGGERS_ENABLED` and `RUN_RESULT_TOOL_ENABLED` false |
| c | 14:29:32 | tool loop on; `CHAIN_TRIGGERS_ENABLED=true`; `RUN_RESULT_TOOL_ENABLED` still false |
| off | 14:36:35 | env files restored byte for byte; every flag back (AI_PROVIDER stub; runs and every trigger switch off; Discord on) |

The source runs were started through `POST /api/collaboration/runs` with temporary API keys on Keith's account. The keys were made on the host, never shown and revoked. The first step of each run was approved as the owner.

## Results

| # | Step | Result |
|---|---|---|
| 1 | Keith set chain trigger 5f1793e3 to "Fails" on the Schedules page | stored `fires_on=failed`, re-armed 14:14:14; one `chain_trigger_updated` audit row with codes and ids only ✓ |
| 2 | Phase b: source run f1 (collab_1c7a582) and test run t1 (collab_314dda1) | both `failed`; the step's stored failure text (63 characters) names the tool loop; 0 credits ✓ |
| 3 | Phase c | the failure trigger started **one** Chief of Staff run (collab_45e3b6d) at 14:30:31, for f1 only: depth 1, source time 14:27:09 (the settle). Its task says "a step of that run failed" and that no answer or error text is available, and holds **no tool-loop text** ✓ |
| 4 | The chained run's answer | completed 14:31:31; 742 characters; says the run failed; quotes **no** error text (no tool-loop text) ✓ |
| 5 | Test run t1 | no chain row ✓ |
| 6 | Gateway restart at 14:31:40 | no second row, no second run ✓ |
| 7 | Source run c1 (collab_6f0f5ed), completed at 14:32:42 | no row for the failure trigger ✓ |
| 8 | Privacy | no PINEAPPLE8 marker or workflow name in any app-service journal line, audit row or chain history row. The chain-run audit payload keys are collaborationRunId, depth, failureKind, firesOn, localDate, sourceRunId, sourceWorkflowId, targetKind, triggerId, workflowId ✓ |
| 9 | Credits | 17 over 2 real runs (8 and 9); the two failed runs cost nothing ✓ |
| 10 | After the close (checked 14:43:37Z) | 0 connector rows, 0 usage records, 0 open executions and 0 active runs since the close; the 3 temporary keys revoked; env files and Caddyfile at 616841ca, 721f4772, 205770cf ✓ |

**A note on two log lines.** The status counted 2 "run-result" journal lines with the tool off. The trimmed lines (cfl-snip.out) show they are only the gateway's route mapping at each start: `Mapped {/api/internal/collaboration/results/read, POST}`. No read happened.

## Wording landed with this record (Keith: "Yes, land it")

**PRD.md, the chain-trigger row:**
- triggers fire on a completed or a failed run;
- what a failure-chain run is told;
- which failures count;
- failed-run triggers need only `CHAIN_TRIGGERS_ENABLED`;
- proven 2026-11-18 (TRIGGER-CHAIN-FAILED-LIVE-01).

**ARCHITECTURE.md:**
- the GATED sentence: completed-run triggers also need the result tool;
- the data-model row: `fires_on`;
- the status row: deployed d6530ad by STAGING-DEPLOY-CHAINFAIL-01, and this check;
- the timer line: the timer starts runs when a workflow "completes or fails a run";
- section 13.7: a paragraph on failed-run triggers.

This is stage-start section 7's text, filled in with the deploy and live references.

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/TRIGGER-CHAIN-FAILED-LIVE-01/`. The scripts were made from the TRIGGER-CHAIN-LIVE-01 and MAIL-AUTH-LIVE-01 scripts by `mk_cfl.py` in the control plane's scratchpad, with each change asserted.

| File | SHA-256 |
|---|---|
| `cfl-phase.sh` | `815d5ce46406fb3bc9b6585b964176264b677a8858e231fad3b48db5c7088593` |
| `cfl-run.sh` | `3267332b7311c6fa70ae17c2a5fadec5ae60d12889228e7864933bbb28f03e1c` |
| `cfl-status.sh` | `877eadb5a68f9213ba090870ec8ce04e630fb2a4fbba6526266a2ac784991c45` |
| `cfl-restart.sh` | `321244b7ce613f02f2fb28c497bc2b2852585b559f4a66157a877a87e6dcc294` |
| `cfl-snip.sh` | `9231705f3c0300ac2b053a127bc3dffcc6bb9b53e280cdc53b3097066322cc70` |
| `cfl-off.sh` | `ce95cf9dea8b37b00c92513f7d714275ab2f86df36a721a0e801a56f8d97cc92` |
| `cfl-after.sh` | `b2c09d5abb0a5e23e4265ffcdd3dc973c4f992a0dbdef087b46e72c05f665eeb` |
| `run.sh` | `81da17a5f9406a018f0a2f9642bc47aecae2190ae1acab5d246cac8ebcdea4b2` |
| `cfl-a.out` | `4227053ebb513f8cfdfd5c9d916582dfb6a2437830754e1e19ca542f5b04ca9d` |
| `cfl-b.out` | `329d92dd59880a33fcce97a05084358567bfcd0334a1616a00f568860f9df3f4` |
| `cfl-c.out` | `1195c7b63046ec47c38fa0ba7724a113590fa2efca91532ba32ef5df869c7a5d` |
| `cfl-f1.out` | `c0b344820cad0c349d89b0cd8fdf2f569c572f0b3a050f936d8ee48190a221be` |
| `cfl-t1.out` | `dd83c4b93b0e1072a164fd904851dd145c645bbdb818614ee584b566b7897673` |
| `cfl-c1.out` | `440132529b15aebc909883e1dfda37ac512f4ced253c9ab2c8b5bbd29f7f968e` |
| `cfl-r1.out` | `cc4d75be5d99901b388052f4c818497a8c2d2e8d1e77134c4bcf5a5d6db4b888` |
| `cfl-s0.out` | `a28a9f1cb61e4a779942a670f63b5d8c11ba9937038d9722ffb58ee892b6bde6` |
| `cfl-s1.out` | `c5d65645aa41786f632608a5239cfd8edec7ea43caace88f9daf7e022d13ea53` |
| `cfl-s2.out` | `084e711f0f5ce0cc8522385dce405bb9744ecc0babbcfd3603f3a8e1b620a007` |
| `cfl-s3.out` | `bba2b586b0795ede14d96fd82b4d38ca44cd537e1e8a298d1a21e4ff988ee945` |
| `cfl-s4.out` | `49171f408646daafdecd60f0e46c8c58d7988e752a7434c0632de58d22cf05d7` |
| `cfl-snip.out` | `94afa271313302530ce26f647ce5362a1e2840846fe0a3ea0b1d00b4c6a3e9b3` |
| `cfl-off.out` | `9d9841e5e0fd05c698e74c4176b72f1f30aabd89084fe87a3ffebd5f0ef2073a` |
| `cfl-after.out` | `daa0d5b587a943f1e56660ebf937249c8dea0e28ed7b5604f1e4978a08801e66` |

Every output was scanned for key text; none was found.

## Limits

- **The page.** Keith set the trigger and said "Done". The page rendering, including zh-TW and phone width, was not described in words. The stored `failed` and the re-arm show that the form worked.
- **Not tested live:**
  - the `approval_timed_out` category (24 hours; tests only);
  - depth past 1;
  - a run the owner rejects or cancels (tests only);
  - a completed-run trigger beside a failure trigger with the tool off (tests only).
- **Whether the answer named the workflow** was not checked. The task carries the name, and only the absence of error text was checked.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records, the two wording files and host state only, restored; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), LIVE 3/4 + 1 n/a (1: PROVIDER-LIVE and CREDIT held; 2: the expected spend (10 to 30 credits) stated before the window, the key read from the stored key file on the host and never shown; 3: every result from host-side audit, usage, run and chain rows; 4: n/a, no fix was needed, so no pause), GOVERNANCE 9/9 for the wording (Keith approved the exact text; GOVERNANCE held for the record and released)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- GOVERNANCE held for the wording and released;
- the three authorizations false.

Staging runs d6530ad, with runs and every trigger switch off.
