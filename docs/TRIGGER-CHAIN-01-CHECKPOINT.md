# TRIGGER-CHAIN-01 — Checkpoint

**Task:** TRIGGER-CHAIN-01 — Start a workflow after another workflow finishes
**Status:** COMPLETE AND LOCKED — 2026-11-16. Built, not deployed: STAGING-DEPLOY-CHAIN-01 (Keith approves) and TRIGGER-CHAIN-LIVE-01 follow.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS.
**Mutexes by slice:** S1 GATEWAY, MIGRATION, ENV; S2 GATEWAY; S3 FRONTEND, I18N.
**Source:** registered 2026-11-16 by the TRIGGER-MORE-01 LOCK. Keith chose it on 2026-11-16 ("Start TRIGGER-CHAIN-01").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex | 4cad441 |
| 2. Stage-start | `docs/TRIGGER-CHAIN-01-STAGE-START.md`, fable subagent (Fable 5.1, stage-start drafts) | 9676d0d |
| 2. Approval, S1 admitted | Keith: "Yes, approve all" | c65d711 |
| 3. S1 tables, routes, cycle check, switch | opus (a migration, new owner-scoped routes), fast-forwarded | 5fb2ee6 |
| 3. S1 landed, S2 admitted | | b73c66a |
| 3. S2 timer, run read, depth, claim, start, skip | opus (unattended spend, the approval gate, a cross-module read), fast-forwarded | 687d7d3 |
| 3. S2 landed, S3 admitted | | 45a3f16 |
| 3. S3 page section | sonnet (UI in the frontend). The control plane sent it back once to read DESIGN.md, which gave a dashed empty state. Fast-forwarded | 0c26b64, bf9de19 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Keith's decisions (2026-11-16, stage-start section 8, all as recommended)

| # | Decision |
|---|---|
| Q1 | The chain timer does nothing while the run-result tool is off; the page shows a banner |
| Q2 | The next run's task gets the finished run's id and time only |
| Q3 | 3 triggers; 5 starts and 20 rows per trigger per day; depth 3 |
| Q4 | A run started by a schedule or another trigger counts as a source |
| Q5 | A team run led by the source counts; one that only used it as a member does not |
| Q6 | Several triggers on one source are allowed |
| Q7 | The first step starts without a click |
| Q8 | A run already going when the trigger is switched on does not fire |
| Q9 | A time-zone field |
| Q10 | The page section is slice S3, "After a workflow finishes" |
| Q11 | Both switches go back off after the live check |
| Q12 | COS-MAIL-BODY-RULE-01 is required before real use |

## What changed

- **S1:**
  - **Migration 1814:** `agent_chain_triggers` holds a source workflow and a target, with a CHECK that they differ. `agent_chain_trigger_runs` is unique on trigger and source run, with a depth.
  - **Routes:** `/api/chain-triggers`.
    - Browser session and harness access.
    - Owner-scoped, at most 3 per owner.
    - Source = target is refused, and so is any cycle among the owner's chain triggers (switched-off ones count; the Chief of Staff never closes a cycle). Both checks run under lock namespace 1814.
    - `armed_at` is set at create, at switch-on and when the source changes.
    - GET also reports whether the run-result tool is on, read through the imported `isRunResultToolEnabled`.
  - **Switch:** `CHAIN_TRIGGERS_ENABLED`, default false, with its env template line.
  - **Audit rows:** ids and the target kind only.
- **S2:**
  - **Timer:** its own 60-second timer. Nothing is read or recorded unless the chain switch, runs and the run-result tool are all on.
  - **The reads:** one read of the owners' completed runs a tick, with a fixed select list and at most 500 runs. One fixed SQL then reads the first hand-offs, taking only the workflow id and test-run JSON paths; it never reads the task or the answer.
  - **Matching:** first hand-off only, on the source's own step.
  - **Claiming and limits:** a claim per finished run; the depth rule, with `chain_depth` past 3; the day limit of 5 and the 20-row cap.
  - **Starting:** as the owner, with the saved task plus one fixed line giving the finished run's id and time and telling the run to read it with `read_run_result` as data. A run id is checked against the result route's pattern. The first step is approved as the owner, and a refusal cancels the created run.
- **S3:** the "After a workflow finishes" section on the Schedules page:
  - list, create, edit, switch, delete with a confirm step, and history with the chain step;
  - three banners (switch off, runs off, result tool off), the limit, the delay sentence, the privacy line, and a deleted-source label;
  - the same-workflow and loop refusals shown inline;
  - every code, reason (including `chain_depth`) and outcome in en, zh-TW and zh-CN, pinned to the gateway source.
- **Unchanged:**
  - nothing under `orchestration/`;
  - no auth, guard, CSRF or key;
  - no frozen contract: HARNESS_ENTITLEMENT_PROOF_V1 and the internal results route are untouched;
  - the other four trigger types.

## Control-plane review and gates (rerun on every branch)

| Slice | What the control plane read | Gates |
|---|---|---|
| S1 | the cycle check (a walk from the new target along the owner's other edges back to the source) and the lock | gateway 6425 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S2 | the run read's select list, the first-hand-off SQL and the order of the three switch checks | gateway 6549 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S3 | the gate rerun after the DESIGN.md fix | frontend tsc rc 0, 2167 of 2167, build rc 0, `tsconfig.tsbuildinfo` restored |

The 14 known failures are in `smoke.integration.spec.ts` and need a database. Every landed file is LF.

**Reported:** the S1 worker's one shell edit of `triggers.module.ts` was refused by the permission check. It made the same in-scope change with the Edit tool.

**S3 and the UI rules:**
- The worker read both skills in full: Impeccable's SKILL.md with its product, polish and harden references, and Emil Kowalski's SKILL.md.
- Sent back once, it read DESIGN.md and changed the empty state to the dashed pattern.
- Three differences from DESIGN.md are shared by all five dark Schedules sections, so the worker kept them for consistency:
  - text links use indigo-300;
  - the amber warning shade;
  - red on a dark surface.

  These are superseded by TRIGGER-UI-POLISH-01 (note).

**Design calls the workers made inside the approved design** (accepted by the control plane):
- **S1:**
  - `chain_trigger_cycle` answers 409;
  - a source that is not a uuid gives 400 and a missing workflow 404;
  - PATCH takes the lock only when the source or target changes.
- **S2:**
  - the depth is read just before the claim;
  - two reads rather than one join;
  - no row for a run id outside the pattern or a refused zone;
  - a 500-run read cap.
- **S3:**
  - the loop check is mirrored on the client, so it can refuse before saving.

## Not proven here

- **Database:** migration 1814 and the per-owner lock against PostgreSQL.
- **A real chain:** a real completion starting the next run, which then reads the result with the tool.
- **Timing:** the settle delay seen live.
- **The page:** in a browser and at phone width, and the Chinese wording, which was written by the worker.

These belong to STAGING-DEPLOY-CHAIN-01 and TRIGGER-CHAIN-LIVE-01. The live check needs two active, tested workflows on Keith's account.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| F1 deploy and live check | registered STAGING-DEPLOY-CHAIN-01 and TRIGGER-CHAIN-LIVE-01 |
| F2 a readiness condition and an eval case | superseded by COS-MAIL-BODY-RULE-01 (note) |
| F3 "started after a workflow finished" | superseded by TRIGGER-ORIGIN-01 and TRIGGER-WAIT-NOTICE-01 (notes) |
| F4 inventory and cap arithmetic | superseded by ACCESS-READY-01 (note) |
| F5 the switch line | superseded by GOV-CHECKLIST-01 (note) |
| F6 a sixth mapper user, a fifth helper copy | superseded by REFUSAL-MAP-01 and TRIGGER-TIDY-01 (notes) |
| F7 the timer's reads each tick, and the 500-run cap | superseded by TRIGGER-SCALE-01 (note) |
| F8 settle at the last step or a run-finished event | registered RUN-FINISH-EVENT-01 |
| F9 if the result access becomes a per-workflow tick | superseded by RESULT-GRANT-FORM-01 (note) |
| F10 a native-speaker review, and the DESIGN.md differences of the five sections | superseded by TRIGGER-UI-POLISH-01 (note) |
| F11 a trigger for failed runs | registered TRIGGER-CHAIN-FAILED-01 |
| S2: the copied run-id pattern | superseded by TRIGGER-TIDY-01 (note) |

CHECKLIST: EVERY 11/11 (1: admitted 4cad441 and each slice admitted; 2: 4-step with an approved stage-start; 3: fable, opus and sonnet named before each dispatch; 4: self-contained briefs, no further subagents; 5: each slice inside its write set; 6: tests in every slice; 7: gates rerun by the control plane on every branch; 8: no runtime started; 9: tsconfig.tsbuildinfo restored, dist ignored; 10: worktrees and fast-forwards by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, internal-key or guard change; 2: internal routes untouched; 3: no generated-app template; 4: the four other trigger routes, HARNESS_ENTITLEMENT_PROOF_V1 and the internal results route untouched, the `/api/chain-triggers` shapes kept by S3; 5: the schema change under MIGRATION in S1; 6: compared with the baselines), MIGRATION 4/4 (1: held for S1, opus; 2: ordered after 1813, tested; 3: up and down tested with mocks; 4: down drops only its two tables), UI 9/9 (S3: three languages through the hook, real Chinese; I18N held; Heroicons v2 Outline; both skills read in full; DESIGN.md read after the control plane sent the slice back, with three shared differences recorded; every state translated and tested; one section, no backend; existing test ids kept; the browser flows named for STAGING-DEPLOY-CHAIN-01)
FOLLOWUPS: 4 registered (STAGING-DEPLOY-CHAIN-01; TRIGGER-CHAIN-LIVE-01; RUN-FINISH-EVENT-01; TRIGGER-CHAIN-FAILED-01) / 9 superseded (F2; F3; F4; F5; F6; F7 with the 500-run cap; F9; F10 with the DESIGN.md differences; the copied run-id pattern) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED (the other mutexes were released at their slices);
- nothing deployed: staging still runs df9f2b5.
