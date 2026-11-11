# USER-TEAMS-01B — Checkpoint (slice 01B: team runs with report-back)

**Task:** USER-TEAMS-01B — User-team runs with report-back
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** AGENT. **Lifecycle:** 4-STEP; the stage-start is shared with USER-TEAMS-01. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the USER-TEAMS-01 stage-start approval. Keith approved it ("Yes, approve").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1-2. Registration and stage-start | shared with USER-TEAMS-01 | 0b05d92 |
| 2a. Admission | Lane 1 with GATEWAY; HARNESS_ENTITLEMENT_PROOF_V1 read, not changed | 0449d89 |
| 3. Implementation | opus subagent (Opus 5.5: the orchestration state machine in a frozen-contract file) in worktree lane/USER-TEAMS-01B, cherry-picked onto main | e468bce |
| 4. LOCK | this checkpoint, board, backlog, sidecar, plan and ARCHITECTURE.md 13.1, canonical validator | this record |

## Change

**D4, the lead marker.** `ReferralPendingJob.teamLeadId` is set by the server in `preparePendingReferral`, on the first hand-off only, when all of these hold:
- the agent list has more than one entry;
- `agents[0]` is the target;
- the target is `chief-of-staff`, or the step's own workflow snapshot.

Children inherit it with the agent list. It is never read from a request body; both body readers ignore it, and tests pin that.

**D5, the lead as a parameter.**
- `collaboration-front-door.ts` gains `isTeamRun`, `leadIdOf` (falling back to the Chief of Staff rule for rows stored before this change), `teamLeadSummary` and `teamAgentList`. `isFrontDoorRun` and `frontDoorAgentList` now sit on top of these and behave the same.
- `classifyFrontDoorEdge` takes the run's lead.
- In `orchestration.service.ts`, every place that read the fixed Chief of Staff id now reads `leadIdOf(...)`: edge classes, `needsReportBack`, `reportBackFromAnswer`, the `roster_reply` refusal and `rosterWorkflowFor`.

**D6, starting a workflow with a team.** `workflowStartPlan` evaluates the stored team (the row's own id dropped) with `evaluateMembers`. It builds a labelled agent list with the workflow first, plus `rosterWorkflows` and `roster { used, skipped }`, keeping `workflow` as the lead's snapshot. With no members left, the plan is exactly today's: a byte comparison test covers no column, `[]` and `[self]`.

**D8 to D13.**
- The first hand-off gate is generalised.
- Only the lead hands off, and a member's tag is `refused: roster_reply`.
- A target off the stored list, or a loop, is refused. A third round is capped, with an audit event.
- **D10:** the report-back child of a workflow lead gets a copy of the lead's first-step snapshot, so the lead's grants, budgets, tested state and version stamp apply to its second step. A mutation check confirmed the tests catch a missing snapshot.
- Members' own teams are never read at run time.
- A test run marks the lead `testRun: true` and the members `false`.
- The run detail marks a workflow-led team's member answers that cite no source as unsourced, as the front door already does.

**Frozen contract.** HARNESS_ENTITLEMENT_PROOF_V1 is used, not changed. All 5 jobs of a workflow-lead run (first step, the dispatch to an advisor and its report-back, the dispatch to a workflow and its report-back) have the same `Object.keys` as a Chief of Staff job. A `teamLeadId` stored in `pending_job` never reaches the enqueued job. `src/ai`, `job.types.ts`, `worker.processor.ts` and ai-service are untouched.

**Files (8):**
- `orchestration.contracts.ts`, `collaboration-front-door.ts` and its spec;
- `orchestration.service.ts`;
- `collaboration.controller.ts` and its spec;
- `internal-collaboration.controller.spec.ts`, `__tests__/orchestration.service.spec.ts`.

19 new tests. No existing test changed; the COS-FRONTDOOR-01B tests are unchanged and pass.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3601 passed (3582 + 19), 7 skipped, 14 failed: only the known `smoke.integration` failures, on the branch and on main |
| gateway `npm run build` | exit 0, on the branch and on main |
| frozen and out-of-slice paths | `git diff --stat 0449d896..lane/USER-TEAMS-01B` over src/ai, src/ai-execution, src/queue, ai-service, frontend, collaboration-roster.ts and collaboration-workflow.ts: empty |
| line endings | the 8 files are LF in the work tree and in the committed blobs |

## Review notes (accepted as designed)

- **Advisor model on a workflow-led run.** A system advisor on a workflow's team runs on the lead step's provider and model. That's the lead workflow's platform model when it has one; on the front door it's the server model. This is the approved D9 rule, and a test pins it. Keith hears it in the closing message and may ask for a change.
- **Budgets.** The lead's report-back steps count toward the lead's per-run and per-day budgets, because they carry its snapshot. That is D10's intent.
- **Chief of Staff runs.** A Chief of Staff run with members now stores `teamLeadId: 'chief-of-staff'` as well. Rows stored without it still run as front-door runs through the fallback.
- **Refusal text.** The internal refusal reads "rosterWorkflows need a team start with members". Only a server-built call can reach it.

## Limits

Not deployed. No real model or Postgres was used. The deploy is STAGING-DEPLOY-FD-02 (migrating, 1806). Keith's live check is USER-TEAMS-LIVE-01.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (4: frozen contract used, not changed, key sets pinned; 5: no schema change, teamLeadId lives in the existing pending_job JSON; 6: only the 14 known smoke failures)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed.
- Stage-start section 10 item 5: the ARCHITECTURE.md 13.1 row is done in this record. The PRD.md wording for the front door, which was due at the FRONTDOOR-LIVE-01 lock and missed there, and for user teams is superseded into GOV-PRD-SYNC-01; a line was added to its body.
- The worker's advisor-model observation is accepted as designed (above).

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED. USER-TEAMS-01, -01B and -01C are complete. User teams are built and not deployed.

ARCHITECTURE.md 13.1 changes in this record:
- The front-door row now reads STAGING (deployed 537ebfb, live-checked).
- A user-teams row is added (BUILT, not deployed).
