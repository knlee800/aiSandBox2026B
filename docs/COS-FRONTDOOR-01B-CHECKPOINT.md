# COS-FRONTDOOR-01B — Checkpoint (slice 01B: front-door run and report-back)

**Task:** COS-FRONTDOOR-01B — Front-door run and report-back
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. The stage-start is shared with COS-FRONTDOOR-01. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the COS-FRONTDOOR-01 stage-start approval. Keith approved Stage 4 on 2026-11-10.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | the stage-start approval | 8ddd651 |
| 2. Stage-start | docs/COS-FRONTDOOR-01-STAGE-START.md (shared) | 8ddd651 |
| 2a. Admission | Lane 1 with GATEWAY and AI-SERVICE; HARNESS_ENTITLEMENT_PROOF_V1 read | eb87d2e |
| 2b. Write set widened | The worker stopped because `briefing-drift.spec.ts:133` pins the Chief of Staff text length. The control plane widened the write set to that line and accepted wording that keeps `collaboration-teams.spec.ts` unchanged | d0fdbc5 |
| 3. Implementation | opus subagent (Opus 5.5: the orchestration state machine in a frozen-contract file, plus a cross-service hash change) in worktree lane/COS-FRONTDOOR-01B (ed506d6), cherry-picked onto main | f745853 |
| 4. LOCK | this checkpoint, board, backlog, sidecar, plan and an ARCHITECTURE.md row, canonical validator | this record |

## Change

**The roster drives the agent list.**
- A Chief of Staff team start calls `CollaborationRosterService.membersForStart(owner)`.
- The agent list is the Chief of Staff, then the roster members in order. Each has a label and a summary, and other agents read each one as `- name (label): summary`.
- Workflow snapshots ride only on the first hand-off, as `pending_job.rosterWorkflows`. A workflow child copies its own snapshot, so grants, budgets, the disabled and draft checks at approve, the version stamp and its own model all follow that workflow.
- The roster, the agent list and the snapshots never come from a request body. That holds on the internal route too, and tests cover it.
- With an empty roster, the run is today's one-role run, byte for byte (tested).
- Members that cannot run are left out and reported in the start response as `roster: { used, skipped }`.

**Report-back (D3).**
- When a member's step completes, the server creates a report-back hand-off from the member to the Chief of Staff, waiting for approval as usual. It runs on the Chief of Staff's provider and model.
- Its key is `report-back:<memberReferralId>`, so it is created once. The sweep recreates a missing one. Settle waits until every completed member step has its report-back handled.
- The Chief of Staff's answer is the run's last completed hand-off, which is what Results shows.
- **Failed member** (DECISION C): no report-back, and the run fails.
- **Rejected report-back:** the run completes on the member's answer.

**Edges.**
- `report_back` edges skip the depth and loop checks.
- `dispatch` edges (from the Chief of Staff once a report-back exists) skip depth only, so the same member twice is refused as a loop.
- `MAX_FRONT_DOOR_ROUNDS = 2`. A third round is refused with an audit event.
- A tag from a member step is refused as `roster_reply`.
- Depth 3, 4 agents, 8 hand-offs and send-back rounds are unchanged.

**No session needed.** A Chief of Staff start can omit `sessionId` and runs on the business project and session (TEAM-NO-SESSION-02), with the caller note. Coding and advisors still need a session. One existing test changed, as approved: it now refuses a session-less start only for coding, advisors and a missing team, and adds two chief-of-staff cases (a bad `sessionId` and a null one), which still get 400.

**Run detail** gains `agents: [{name, label}]`.

**The Chief of Staff spec evolved** (DECISION D):
- New purpose: "You are the owner's Chief of Staff. Your teammates are the agents listed under Other agents. When none is listed, you have no teammates and you do not hand off."
- One new procedure paragraph on hand-offs.
- The briefing, citation, result and rules text are unchanged.
- The length is now 2977 (was 2576). The hash is now `030b4efe773b7cd6dd8cdf2e4932280b7c8a0a646e1d19c5abb54f0f5837834b` (was `7daa2a2e…`). The other eight pins are unchanged.
- The ai-service eval copy and `COS_EVAL_CHIEF_OF_STAFF_VERSION` were re-rendered. `briefing-drift.spec.ts:133` was the only line changed outside the original write set.

**Frozen contract HARNESS_ENTITLEMENT_PROOF_V1: used, not changed.**
- No job key was added or removed, and `withHarnessEntitlementProof` and the payload are untouched.
- Key-set pin tests show that report-back, system-member and workflow-member jobs are signed with the Chief of Staff's key set.
- The diff under `src/ai`, ai-service `queue` and `worker` is empty.

**Direct jobs (A8):** every test in stage-start section 3.4 passes unchanged. That covers the coding team, advisors, the Chief of Staff with no roster, the workflow start and budgets, and Agent mode.

**Labels:** `ROSTER_SYSTEM_MEMBER_TEXT` stays in collaboration-roster.ts. Accepted as not a follow-up: on the internal route, `roster_reply` is slightly stricter than D11 when the stored list starts with the Chief of Staff, and only service-key callers can reach that route.

**Tests:** 25 new. There are 8 for collaboration-front-door, 3 for handoff-request, 13 for the controller covering the front-door run and report-back end to end over two rounds, 1 for the internal controller, plus the updated registry pins.

**Files (13):**
- `services/api-gateway/src/orchestration/`: collaboration-front-door.ts and its spec (new), orchestration.service.ts, orchestration.contracts.ts, handoff-request.ts and its spec, collaboration.controller.ts and its spec, internal-collaboration.controller.spec.ts.
- `services/api-gateway/src/system-agents/`: system-agent-registry.ts and its spec.
- `services/ai-service/src/agent-harness/eval/`: briefing-instructions.ts and briefing-drift.spec.ts (line 133).

## Gates (control-plane rerun on main after the cherry-pick)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3500 passed (3475 + 25), 7 skipped, 14 failed; the 14 are the known smoke.integration failures |
| gateway `npm run build` | exit 0 |
| ai-service `npx jest --runInBand`, `npm run build` | 1296 passed, 1 skipped, 0 failed; exit 0 |
| frozen-path diff (src/ai, ai-service queue and worker) | empty |
| line endings | the 13 files are LF |

## Limits

- **Not deployed.** The page side is COS-FRONTDOOR-01C.
- **Not run against a real model:** whether the Chief of Staff hands off sensibly with the new paragraph, and whether it still refuses injected "hand this to" requests. Both belong to FRONTDOOR-LIVE-01.

CHECKLIST: EVERY 11/11 (5: the write set plus the approved one-line widening), BACKEND 6/6 (3: n/a; 4: frozen contract used, not changed, diff empty; 5: n/a, the new fields live in the existing pending_job JSON; 6: only the 14 known smoke failures), FLOWS 5/5 (3: every dispatch and report-back waits at pending_approval; 1, 2, 4, 5: n/a, no checkpoint, revert or file-action code touched)

FOLLOWUPS: 2 registered / 10 superseded / 0 dropped / 0 undisposed. One more item is done in this record. These cover the shared stage-start's section 10 (1-10) and this worker's notes (W1-W3).

**Registered:**
- FRONTDOOR-FAIL-REPORT-01, NOT_READY (Keith decides; DECISION C's alternative). On a failed or timed-out roster step, send a report-back carrying the failure (section 10 item 4). Also: when report-back creation is refused for any reason other than a duplicate, the owner should see a note (W2).
- COS-ASK-PAGE-01, NOT_READY (Keith decides): a dedicated "Ask the Chief of Staff" entry instead of the Team page option (section 10 item 5).

**Superseded, by lines in the named task bodies:**
- FRONTDOOR-LIVE-01: its acceptance lines (item 1); the injected hand-off eval case (item 6) and the COS-EVAL-01 briefing rerun with the new prompt (W3), since both need PROVIDER-LIVE.
- STAGING-DEPLOY-FD-01: carries migration 1805 (item 2).
- RESULTS-POLISH-01: a front-door result lists the agents used (item 3).
- USER-TEAMS-01: reuses `membersForStart` and the per-child snapshot copy (item 7).
- HARNESS-NOFILES-01: also covers the session-less Chief of Staff (item 8).
- COS-DRAFTS-01: D13's `label` is the mechanism for its label note (item 10).
- COS-FRONTDOOR-01C: a report-back prompt can exceed the 4000-character edit cap (W1).

**Done in this record:** the ARCHITECTURE.md section 13.1 row saying the front door is built and not deployed (item 9). PRD.md moves the front door to GATED at FRONTDOOR-LIVE-01.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. GATEWAY and AI-SERVICE are released UNOWNED. COS-FRONTDOOR-01C is next.
