# TRIGGER-CHAIN-FAILED-01 — Checkpoint

**Task:** TRIGGER-CHAIN-FAILED-01 — Start a run when one of the owner's workflows fails
**Status:** COMPLETE AND LOCKED — 2026-11-18. Built, not deployed.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS.
**Mutexes:**

| Slice | Mutexes |
|---|---|
| S1 | GATEWAY, MIGRATION |
| S2 | GATEWAY |
| S3, S4 | FRONTEND, I18N |

**Source:** registered 2026-11-16 by the TRIGGER-CHAIN-01 LOCK. Keith chose it on 2026-11-18 ("You pick one", then "Yes, chain-on-failure"). He approved the stage-start ("Yes, approve all"), and later "Fix now" for the source label and "Register all three" for the follow-ups.

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission (Step 2) | Lane 1; write set: the stage-start | 0f3d1f1 |
| 2. Stage-start | fable subagent draft, fast-forwarded; key facts checked by the control plane; approved | dd1db89, bbc13ff |
| 3a. S1 column and routes | opus; one write-set widening (d2e52c2) when the worker stopped on the 1814 spec pin | 5007ccb, cherry-picked as 1e6305c |
| 3b. S2 failure matching | opus | 1749f5d |
| 3c. S3 page | sonnet | 32922d6 |
| 3d. S4 source label | sonnet | 4b77ec4 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## What was built (as approved, Q1 to Q13)

**S1: the column and the routes (Q1, Q2, Q4, Q7)**
- Migration 1816 adds `agent_chain_triggers.fires_on`: `completed` or `failed`, NOT NULL, default `completed`, with a CHECK. Its `down` drops the column.
- `/api/chain-triggers` takes and shows `firesOn`. Any other value is `chain_trigger_invalid_fires_on` (400), and the refusal never repeats the value.
- Changing the outcome re-arms the trigger.
- The limit of three, and the cycle check, count both outcomes together.
- CRUD audit rows carry the code only.

**S2: the failure matching (Q3, Q5, Q6, Q8, Q9, Q11)**
- The same 60-second chain timer reads the owners' failed runs. The select list is ids, status, times and step ids.
- It then reads their steps' statuses with a fixed SQL that selects no text column.
- A run counts only when a step failed (`step_failed`) or waited 24 hours for approval (`approval_timed_out`). Runs that were cancelled, rejected by the owner, or test runs do not count.
- The started run gets the saved task plus fixed lines:
  - the workflow name, cleaned to one line of at most 100 characters and marked as a label, never instructions;
  - the failed run's id and time;
  - the category;
  - and that no answer or error text is available.
- Failure triggers work with the run-result tool off; completed triggers still need it.
- Depth, the day limit, the row cap, the claims and the 5 starts a tick are shared across both outcomes.

**S3: the page (Q10)**
- The Schedules form offers "Start when the run: Finishes normally / Fails", with help text and a hint that swap with the choice.
- Each row shows its outcome. The banner and notices are updated.
- All new and changed strings are in en, zh-TW and zh-CN; the Chinese are real translations, as listed in the S3 report.

**S4: the source label**
- It reads "Source workflow" (來源工作流程 / 来源工作流), Keith's "Fix now".

## Gates (rerun by the control plane on each branch)

| Slice | Result |
|---|---|
| S1 | gateway tsc rc 0; 6699 passed, 7 skipped, the 14 known `smoke.integration` failures (need a database); build rc 0 |
| S2 | gateway tsc rc 0; 6808 passed, 7 skipped, the 14 known failures; build rc 0 |
| S3 | frontend tsc rc 0; 2252 of 2252; build rc 0; `tsconfig.tsbuildinfo` restored |
| S4 | frontend tsc rc 0; 2252 of 2252; build rc 0; restored |

The diffs were read. Every slice stayed in its write set. No frozen-contract file and nothing under `orchestration/` was touched.

## Findings and deviations

1. **The 1814 spec pin (S1).** The 1814 migration spec compares the chain-trigger entity's whole column list. The worker stopped on it, as the stage-start says to. The control plane checked it and widened S1 by that spec, pinning assertions only (d2e52c2). The 1810 to 1813 specs have the same kind of pin; that is now noted on TRIGGER-TIDY-01.
2. **Four TRIGGER-CHAIN-01 assertions changed (S2).** With the result tool off, the tick now reads the trigger list to find failure triggers (Q8, P5). The four assertions that said "reads nothing at all" now say "no run read and no row". The control plane accepted this, because it follows from the approved Q8.
3. **Completed triggers record what they did before (S2).** Section 4.1 said their run audit payloads and log lines gain `firesOn`, but the stop condition forbids changing what a completed trigger records. Only failure triggers carry `firesOn=failed` and `failureKind`. The CRUD log lines carry `firesOn` for every trigger.
4. **Main's frontend suite failed one test from S1 until S3 (2240 of 2241).** That test pins the page's error-code list to the backend's, and S1 added a backend code. The control plane did not rerun the frontend on main after a backend-only slice. That was a miss: the pin crosses services. S3 repaired it.
5. **Skipped boot reads (S4).** The S4 worker skipped its boot reads and saw one unexplained build failure, rc 1, that did not recur. The control plane's rerun was clean. Its CHECKLIST counted EVERY 11/11 anyway; item 4 was not met.
6. **Backlog title.** The title now reads "Start a run when one of the owner's workflows fails" (P8, F10).

## Limits

Only a live check can prove:
- a real failed run starting the failure trigger;
- the task lines reaching the model;
- the radios in a browser and at phone width;
- the Chinese in context;
- migration 1816 on staging.

These are STAGING-DEPLOY-CHAINFAIL-01, then TRIGGER-CHAIN-FAILED-LIVE-01. The 24-hour approval timeout and depth 4 are proven by tests only.

CHECKLIST: EVERY 10/11 (4: the S4 worker skipped its boot reads; 7: the control plane reran every gate; 8: no runtime; 11: FOLLOWUPS line), BACKEND 6/6 (S1, S2: no frozen file, no internal route, owner-scoped routes and the existing start and approval path), MIGRATION 4/4 (S1: MIGRATION held, 1816 after 1815, up and down with tests on mocked SQL, down drops only the new column; not run anywhere yet), UI 9/9 for S3 (both skills and DESIGN.md read and reported; real translations; states tested; live check planned) and S4 (a one-label copy change; items 3 to 6 n/a)
FOLLOWUPS: 5 registered (STAGING-DEPLOY-CHAINFAIL-01, TRIGGER-CHAIN-FAILED-LIVE-01, RESULT-TOOL-FAILED-01, TRIGGER-CHAIN-FAILED-REASON-01, COS-EVAL-FAILCHAIN-01) / 8 superseded / 0 dropped / 0 undisposed; F10 done in this record.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| F1 deploy (also carries the one-minute sweep) | registered STAGING-DEPLOY-CHAINFAIL-01 (Keith approves; supersedes STAGING-DEPLOY-SWEEP-01 when it locks) |
| F2 live check, with the PRD.md and ARCHITECTURE.md wording of stage-start section 7 | registered TRIGGER-CHAIN-FAILED-LIVE-01 |
| F3 read_run_result for a failed run | registered RESULT-TOOL-FAILED-01 (Keith: "Register all three") |
| F4 a third failure category | registered TRIGGER-CHAIN-FAILED-REASON-01 |
| F9 Chief of Staff eval case | registered COS-EVAL-FAILCHAIN-01 |
| F5 run origin and waiting notice | superseded by TRIGGER-ORIGIN-01 and TRIGGER-WAIT-NOTICE-01 (note added) |
| F6 the name reaching the model | superseded by ACCESS-READY-01 (note added) |
| F7 `source_completed_at` naming | superseded by TRIGGER-TIDY-01 (note added) |
| F7 a second run read per tick | superseded by TRIGGER-SCALE-01 (note added) |
| F8 native-speaker review of the new Chinese | superseded by TRIGGER-UI-POLISH-01 (note added) |
| S1 worker: the 1810 to 1813 spec pins | superseded by TRIGGER-TIDY-01 (note added) |
| S2 worker: uncategorised failed runs re-read each tick | superseded by TRIGGER-SCALE-01 (note added) |
| S2 worker: the match-spec guard comment | superseded by TRIGGER-TIDY-01 (note added) |
| F10 backlog title | done in this record |

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- GATEWAY and MIGRATION had been released at the slices.

Staging is unchanged (11cf987).
