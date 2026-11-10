# BIZ-USER-01C — Checkpoint

**Task:** BIZ-USER-01C — Run a user workflow from the Team page
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** AGENT. **Lifecycle:** 4-STEP (corrected at admission). **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (C13, C15). Admitted on 2026-11-10 (6c53c2a) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission (corrected to 4-STEP) | Lane 1 with GATEWAY, FRONTEND and I18N | 6c53c2a |
| 2. Stage-start | docs/BIZ-USER-01C-STAGE-START.md, drafted by a fable subagent. The control plane settled DECISIONs A to C and S1 to S4 with the drafter's recommendations | 6c53c2a |
| — Write set widened | PACKAGE and frontend/package.json, for the Team page test glob. The worker stopped correctly rather than edit outside its scope | 5bfc1a8 |
| 3. Implementation | opus subagent in worktree lane/BIZ-USER-01C (7952f1b, d6754a7), cherry-picked onto main | ccc25ab, fc0361e |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## What changed (18 files)

| Design | How it was met |
|---|---|
| D1 Start | `POST /api/collaboration/runs` accepts `{sessionId, task, workflowId, testRun?}` instead of `team`. It answers 400 if both are sent, if `workflowId` is not a UUID, if `testRun` is not a boolean, or if `testRun` comes without `workflowId`. The three-team body is unchanged. |
| D2 Order | The checks run before any conversation or run is created: not found 404, disabled, invalid (spec, the 4000 limit, model), provider off 503, not tested, then the budgets. |
| D3 Team of one | The target and agent are the row id, the instructions are the rendered prompt plus `USER_WORKFLOW_RULES`, and `fileAccess: true`. Hand-offs to anyone else, or to itself, are refused. |
| D4 Snapshot | The pending job carries `workflow {id, name, version, knowledgeScopeIds, connectorToolIds, model, testRun, budgets}`. It is accepted only on the first hand-off, for its own target. `name` is for display only. |
| D5 Model | A platform model goes to anthropic with `isPlatformModelId` checked and the provider kill switch honored. `server` keeps the env model. |
| D6 Version | `agentVersionFor` is exported from the registry, and all eight system-agent hashes are unchanged (pinned, and reproduced by a new test). It is recorded as `agentDefinitionVersion` with `agentDefinitionId` = the row id. |
| D7 Test run (C13) | A normal run needs `active` plus a completed test run at the current version. A draft can only test-run, and editing forces a new test run. |
| D8 Budgets (C15) | Per day: today's credits ≥ budget gives 429 `WORKFLOW_BUDGET_DAY {budget, spent}`. Per run: if the last completed run cost more than the budget, 409 `WORKFLOW_BUDGET_RUN {budget, lastRun}`. Both are checked at start and again at approve, reading `CreditDeductionRecord` by this workflow's execution ids. |
| D9 Grants | At enqueue, `userWorkflowGrants` uses the owner's connections as they are now, then the existing job-field builders. The result is stored spec ∩ allowlist ∩ connections, and a failed lookup grants nothing. |
| D10 Frozen contract | HARNESS_ENTITLEMENT_PROOF_V1 is used, not changed. No job key was added or removed, and `agentId` is never set. Two key-set tests pin a workflow job's keys to the chief-of-staff job's. ai/, job.types.ts, worker.processor.ts, ai-execution.controller.ts and services/ai-service are untouched (diff empty). |
| D11 Approve | The row is reloaded, and missing, deleted, disabled, untested or over-budget workflows are refused before `assertHandoffAllowed`. If the workflow service is missing, it fails closed with 503. |
| D12 Lists | New owner-scoped `GET /api/collaboration/workflows`, with no instructions or tokens. Run list and detail carry `workflow {id,name,testRun}` and `teamId: 'workflow'`. |
| D13 Team page | A "Your workflows" picker with loading, empty, failed-with-retry and loaded states. Start test run, and Start only when the workflow is on and tested, otherwise a hint. A spend line shows when a day budget is set. Past runs and the chain show the workflow name and a Test run badge. 27 new `collaboration.*` keys in each language. |
| D14 Ask link | Unchanged. |
| D15 Service | `CollaborationWorkflowService.prepareStart` can be called without HTTP; TRIGGER-01 will reuse it. |

Refusal codes: WORKFLOW_NOT_FOUND 404, WORKFLOW_DISABLED 409, WORKFLOW_INVALID 409, WORKFLOW_NOT_TESTED 409, WORKFLOW_BUDGET_DAY 429, WORKFLOW_BUDGET_RUN 409.

Tests:
- gateway: 41 new;
- frontend: `collaboration-workflows.test.tsx` with 23 tests, plus `components/collaboration/*.test.ts*` added to the test script, so the Team page folder is covered from now on.

Skills: Impeccable (the existing radio-card pattern and tokens, a dashed empty state) and Emil Kowalski (motion only on the retry button, clear disabled and starting states). The new icons are Heroicons Beaker, InformationCircle and ArrowPath.

## Gates (control-plane rerun on the branch)

| Command | Result | Baseline |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 3065 passed, 7 skipped; 14 failed, all in `smoke.integration.spec.ts` | 3024 + 41 new; the same 14 known smoke failures |
| api-gateway `npm run build` | exit 0 | |
| frontend `npx tsc --noEmit` | exit 0 | |
| frontend `npm test` | 1384 tests, 1384 pass, 0 fail; the test-script guard passes | 1361 + 23 |
| frontend `npm run build` (PowerShell) | exit 0; tsconfig.tsbuildinfo restored | |

- Every changed file is inside the (widened) write set.
- After the cherry-pick, the gateway and frontend on main are identical to the branch. The only other difference under `services/` is LOCAL-DEV-SYNC-01's ai-service spec, already on main.
- The changed files are LF.

## Live check (at the next staging deploy with runs on: STAGING-DEPLOY-WF-01 / BIZ-LIVE-04)

In en, zh-TW and zh-CN:
- copy the template, run a test, and Start appears;
- edit, and Start goes until a new test;
- a draft can only test-run, and an off workflow offers neither;
- both budget refusals show their numbers;
- a platform-model run;
- the name and Test run badge in past runs and the chain;
- the workflows list states.

CHECKLIST: EVERY 11/11 (3: opus, passed explicitly; 5: write set widened by the control plane for the test glob; 6: tests added in both services), UI 8/9 (9: the live check above), BACKEND 5/6 (5: n/a, no schema change; 4: frozen contract used, not changed, and pinned)
FOLLOWUPS: 2 registered / 4 superseded / 0 dropped / 0 undisposed:
- **Registered:** RUN-CUTOFF-01, a hard per-run cutoff that changes the frozen contract, waiting for Keith; and BIZ-USER-01D, the workflow summary, switch on or off and Open on Team on the agent panel, plus the editor's budget hint.
- **Superseded:**
  - the run history shape, by RESULTS-01;
  - triggers starting the same way, by TRIGGER-01;
  - "You are <uuid>." in the project instructions, by COS-DRAFTS-01, whose body now names it;
  - the editor budget hint, by BIZ-USER-01D.
- **Not follow-ups (accepted on record):** the worker's notes on `name` in the snapshot, query counts and the doubled connections read.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND, I18N and PACKAGE released UNOWNED. STAGING-DEPLOY-SEC-01 is next (Keith approved, "Yes, deploy it").
