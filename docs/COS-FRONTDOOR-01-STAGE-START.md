# COS-FRONTDOOR-01 — Stage-start

**Task:** COS-FRONTDOOR-01 — Chief of Staff front door and report-back (plan row 34, `docs/AGENT-OPS-PLAN.md:52`; section 3.2 `:195`; D1-D3 `:263`; A8 `:159`; A5 `:156`)
**Status:** STAGE-START — APPROVED 2026-11-10. Drafted read-only by a fable subagent (Fable 5.1). Keith approved starting Stage 4 on 2026-11-10 ("yes") and DECISIONs A and B ("ok" (after "yes" to Stage 4 and the explanation of the 3-agent limit)): the Team page's Chief of Staff option is the front door, and the roster holds both system advisors and the owner's workflows, at most 3. DECISIONs C to I settled by the control plane on their recommendations. COS-FRONTDOOR-01 is slice 01A; 01B and 01C are registered as COS-FRONTDOOR-01B and COS-FRONTDOOR-01C.
**Registered body:** `TASKS_BACKLOG_FULL.md:86865-86889` (4-STEP, LOCAL-TESTS, OPTIONAL, APPROVED_FUTURE, write set "set at admission", PROVISIONAL). Sidecar candidate `docs/control-plane/lane-saturation-state.json:4596-4616` (writePaths and mutexes empty).
**Reversal:** D3 returns the return hop dropped at the BIZ-03 stage-start (`TASKS_BACKLOG_FULL.md:89605`); the reversal line is `:89613`; plan disposition `:295`. The old line stays.
**Proposed shape:** three bounded slices, each implemented and locked on its own: **01A** roster store, **01B** front-door run and report-back, **01C** Team page. Section 8.

## 1. Goal

The owner gives the Chief of Staff one task. It answers itself, or hands part of the work to an agent on a roster the owner chose (a system advisor or one of the owner's workflows). Every hand-off waits for the owner's approval as today. When the agent finishes, its answer comes back to the Chief of Staff, which writes the final answer; Results shows that final answer. Direct jobs to any agent keep working as they do now: the Team page with a chosen team or workflow, Agent mode, and a bound agent in the workspace chat (A8).

## 2. What is true today

### 2.1 How an owner starts work

| Fact | Where |
|---|---|
| The Team page starts a run with `POST /api/collaboration/runs`. A body names `team` (coding, chief-of-staff, advisors; missing means coding) or `workflowId` (+ `testRun`); both together are refused. Provider, model, instructions, scopes, tool profile and decidedBy never come from the body. | `collaboration.controller.ts:163-183, :196-271, :667-699`; `collaboration-teams.ts:105-113` |
| A team start requires `sessionId`; only a workflow start may omit it and then uses the owner's business project and session (read profile asserted). | `collaboration.controller.ts:204-217, :518-532, :696`; `collaboration-business-session.ts:63` |
| A team start's agent list is the team's roles from the registry; the first role is the first target. The chief-of-staff team is one role. | `collaboration.controller.ts:606-628`; `collaboration-teams.ts:46-83`; `system-agent-registry.ts:421-432` |
| A workflow start is a team of one: `agents = [{ name: row.id, instructions: rendered }]`, with a `workflow` snapshot (version, scopes, connector tools, model, testRun, budgets) on the first hand-off, after the not-found / disabled / invalid / not-tested / budget refusals. | `collaboration-workflow.ts:386-436`; `orchestration.contracts.ts:171-187` |
| Agent mode in the workspace chat posts `/api/ai/execute` with `executionIntent: conversation, harnessVersion: v1` when the user is harness-entitled. | `workspace-agent-mode.logic.ts` (`buildAgentModeRequestFields`); `app/[locale]/app/page.tsx:1122, :4812, :4891-4907` |
| "@name in chat" today is the bound agent: the Command Center's Ask opens the workspace with `?userAgentId=<uuid>`, the page sends `agentId`, and the gateway resolves it owner-scoped onto the Builder path (`agentId` + `harnessVersion` only for `conversation`). | `ARCHITECTURE.md:29`; `app/[locale]/app/page.tsx:1125, :4513, :4907`; `ai-execution.controller.ts:637-672` |
| The Command Center's Chief of Staff card opens the Team page. | `platform-dashboard.tsx:140-152` (`openPath: '/collaboration'`) |

### 2.2 How a hand-off chooses the next agent, and how approval works

| Fact | Where |
|---|---|
| Each job is told "You are <name>", its own instructions, the other agents (name and one-line instructions) and the request format; the wrapper tells every role it may ask one agent with `<handoff to="name">task</handoff>` on the last line. | `handoff-request.ts:112-143` (`:134-135`) |
| The agent list is accepted only on the first hand-off (1 to 4 entries; names lowercase, digits, hyphen, at most 40 chars) and copied to every child. A target not on the list is refused at creation. | `handoff-request.ts:37-50, :52-93`; `orchestration.service.ts:2560-2562, :2600, :2603-2610` |
| When a step completes, its answer is parsed; a tag to an agent off the list is `refused: agent_not_on_list`; an advisor's own tag in an advisors run is `refused: advisors_reply` (hard-coded ids). The child inherits the parent's session, conversation, provider, model and constraints. | `orchestration.service.ts:2366-2401, :2811-2822, :2824-2938` (`:2869-2881`, `:2905-2924`) |
| A hand-off is a `collaboration_referrals` row waiting at `pending_approval` with its job in `pending_job`. The owner approves on the Team page; approve reruns the workflow checks (if a snapshot is on that row), the provider switch, safety, abort, credit and token guards, claims the row once, writes the ledger intent and enqueues. | `collaboration-referral.entity.ts:117-118`; `collaboration.controller.ts:342-380`; `orchestration.service.ts:1082-1181, :1773-1830, :1859-1938` |
| Depth = parent depth + 1; visited = parent's visited + chain. An ordinary edge is refused at depth >= 3, when the target was visited (loop), when a fifth distinct builder id would join (`user` counts), and at the ninth stored hand-off. Reviewer-to-writer and the return are "open" edges exempt from the depth and loop checks, capped at 2 rounds. | `orchestration.service.ts:1650-1696, :1461-1628, :585-607`; `orchestration.contracts.ts:87-91`; `collaboration-send-back.ts:40-80` |
| A run settles completed when every non-rejected step completed and every completed step's answer has been checked for a tag; failed if any step failed or timed out, or every step was rejected. The sweep recovers a lost tag before settling. | `orchestration.service.ts:1940-2000, :2466-2550` |
| The job's tools come from the target id: a system agent's profile, else `read`; a workflow step with a snapshot gets the snapshot's scopes and connector tools instead of the registry role's; the proof is added last. | `collaboration-tool-profile.ts:43-70`; `orchestration.service.ts:809-888, :2679-2687, :2712-2753, :2761-2797` |
| The ledger intent stamps `agentDefinitionId` and `agentDefinitionVersion` from the snapshot (workflow) or `systemAgentVersion` (system agent); an unknown id records the id only. | `orchestration.service.ts:1832-1857, :1886-1895` |

### 2.3 Where the Chief of Staff fits

| Fact | Where |
|---|---|
| `chief-of-staff`: read profile, scopes `contract-templates` plus the five shared, both connector tools, team role `chief-of-staff/chief-of-staff`. Its spec says "You have no teammates and you do not hand off." and holds the briefing procedure and rules. | `system-agent-registry.ts:289-309` (`:292-293`), `:421-432` |
| `advisors-lead` is a second definition with the same scopes whose spec hands one question to `product-strategy` or `technology-advisor`; both advisors say "Do not hand off." | `system-agent-registry.ts:311-349, :435-471` |
| Each definition's hash is pinned (`chief-of-staff` length 2576, hash `7daa2a2e…`), and the ai-service eval holds a byte copy of the Chief of Staff instructions plus the pinned version; its drift spec reads the gateway spec and fails when either differs. | `system-agent-registry.spec.ts:86-111`; `services/ai-service/src/agent-harness/eval/briefing-instructions.ts:1-30`; `briefing-drift.spec.ts:98-105, :135, :172-182` |
| So the Chief of Staff can hand off only if its spec says so and the stored agent list has another entry; today both block it. |  |

### 2.4 What report-back needs, and what Results shows

| Fact | Where |
|---|---|
| A return to the lead is a loop (the lead is visited at step 0) and depth grows by one per step; BIZ-03 therefore dropped the return hop. | `orchestration.service.ts:1538-1542, :1687`; `docs/BIZ-03-STAGE-START.md:207, :335, :347`; `TASKS_BACKLOG_FULL.md:89605` |
| Results shows, per run, the first step's team and workflow and the excerpt of the **last completed** hand-off's answer; the workflow filter matches any referral in the run whose `pending_job.workflow.id` equals the id. | `collaboration-results.ts:77-82, :158-167, :169-192` |
| The Team page lists each hand-off with its status, prompt, Approve and Reject, and maps known role ids to labels; an unknown name renders raw. | `collaboration-view.tsx:617-643`; `frontend/lib/collaboration/logic.ts:324-359, :382-403` |
| The no-session Team view hides the team picker and shows the `missingSession` hint; the chief-of-staff radio shows the briefing preset. | `collaboration-view.tsx:353-383, :399-432`; `collaboration-page.tsx:701-726`; `en.json:1264-1272` |
| `user_agents` rows carry `name`, `description` (200), `status`, tool profile `read`, scope ids, connector tool ids, model and budgets. Migration 1804 is the latest; its spec asserts that. | `user-agent.entity.ts:35-84`; `migrations/__tests__/1804000000000-AddCollaborationRunResultSeenAt.spec.ts:50-61` |
| HARNESS_ENTITLEMENT_PROOF_V1 is FROZEN and lists `orchestration.service.ts`, `ai-execution.controller.ts`, `job.types.ts`, `worker.processor.ts`. BIZ-USER-01C edited `orchestration.service.ts` without changing the job key set and declared the contract used, not mutated, with key-set pin tests. | `lane-saturation-state.json:7013-7024, :4052-4053`; `docs/BIZ-USER-01C-CHECKPOINT.md:31` |

## 3. Design

### 3.1 The front door (D1)

| # | Decision |
|---|---|
| D1 **Where the owner talks** | DECISION A. Recommended: the Team page's existing **Chief of Staff** option is the front door. No new page, no new team id, no office change. The Command Center card already opens Team. |
| D2 **One definition, evolved** | DECISION D. Recommended: `CHIEF_OF_STAFF_SPEC` changes: purpose "You are the owner's Chief of Staff. Your teammates are the agents listed under Other agents; when none is listed, you work alone." and one procedure paragraph: answer yourself when you can; hand off one bounded question to one listed agent only when its job fits; when an agent's answer comes back, write the final answer for the owner, keep the `[source: …]` markers of the claims you use, and ask another agent only if still needed. Briefing, citation and rules text unchanged. Consequences: the `chief-of-staff` hash and length pins change (one accepted change, as AGENT-SPEC-01 and BIZ-BRIEF-01 did), and the ai-service eval copy and `COS_EVAL_CHIEF_OF_STAFF_VERSION` are re-rendered in the same slice (AI-SERVICE mutex). `advisors-lead`, the advisors and coding specs are untouched. |
| D3 **Empty roster = today** | With no roster the agent list is `[chief-of-staff]`, so any tag is `refused: agent_not_on_list` and the run is exactly today's one-role run. The Team page with the Chief of Staff and no roster is unchanged behaviour. |
| D4 **Session** | The chief-of-staff team start may omit `sessionId` and uses the business session (TEAM-NO-SESSION-02 D4); the profile assertion in `businessAnchor` stays and now accepts the chief-of-staff plan (its profile is `read`), and every roster member is read-profile (D7). With a session, nothing changes. Coding and advisors team starts keep requiring a session. The caller note (`COLLABORATION_BUSINESS_RUN_NOTE`) is passed for session-less starts as today; the Technology Advisor's file tools then error out, which is the HARNESS-NOFILES-01 condition, not new. |
| D5 **What the Chief of Staff may hand off to** | Only the owner's stored roster (section 3.2), frozen into the run's `agents` list at start by the server. The hand-off path already refuses anything else (`agent_not_on_list`). The body never carries the roster. |

### 3.2 The roster (D2)

| # | Decision |
|---|---|
| D6 **Members** | DECISION B. Recommended: both kinds. System members: active, read-profile registry agents with a team role outside coding and other than `chief-of-staff` and `advisors-lead` (today `product-strategy`, `technology-advisor`). Workflow members: the owner's own `user_agents` rows (`findOneByIdAndUserId`), any status at save time. |
| D7 **Size** | At most **3** members, because the stored agent list holds at most 4 entries including the Chief of Staff (`handoff-request.ts:58`; A5 "4 agents stay"). PUT refuses a fourth. |
| D8 **Storage** | DECISION I. Recommended: one table `collaboration_rosters` (`user_id uuid PK`, `member_ids jsonb NOT NULL DEFAULT '[]'`, `updated_at timestamptz`), entity `CollaborationRosterEntity` in `orchestration/`, migration `1805000000000-CreateCollaborationRostersTable` in the 1804 pattern (probe `information_schema.tables`; up refuses if present; down drops the table; reversible, down loses only rosters). The 1804 spec's `Math.max(...stamps)` line moves to the `< timestamp` form. **MIGRATION mutex.** |
| D9 **Routes** | `GET /api/collaboration/roster` → `{ members: [{ id, kind: 'system'|'workflow', name, usable: boolean, reason: null|'draft'|'not_tested'|'off'|'missing'|'coming_soon' }], choices: [...same shape for every pickable id] }`. `PUT /api/collaboration/roster { memberIds: string[] }` → the same body after saving; 400 on more than 3, a duplicate, an unknown system id, another owner's or a deleted row. Both behind `SessionOrApiKeyAuthGuard` and `assertEntitled` (401/403), owner-scoped, in a new `collaboration-roster.controller.ts` (RESULTS-01 pattern). No CSRF change (the collaboration POSTs' SameSite reliance is ADMIN-CSRF-01's line). |
| D10 **Server enforcement at start** | `CollaborationRosterService.membersForStart(userId)` loads the stored ids, re-checks each: a workflow member must be `active` and tested at its current version (`workflowNormalRunAllowed`) and renderable; a system member must be `active`. Usable members become agent-list entries: system `{ name: id, instructions: definition.instructions, label, summary }`; workflow `{ name: row.id, instructions: rendered, label: row.name, summary: row.description }` plus a `ReferralPendingWorkflow` snapshot (as `prepareStart` builds it, `testRun: false`). Snapshots are stored once on the first hand-off as `pending_job.rosterWorkflows: ReferralPendingWorkflow[]` (orchestration-internal, not a job field). Unusable members are left out (DECISION F) and listed in the start response as `roster: { used: [ids], skipped: [{ id, reason }] }`. |
| D11 **Enforcement in the hand-off path** | Unchanged mechanism: `preparePendingReferral` refuses a target off the copied list (`:2603-2610`) and `requestHandoffFromAnswer` notes `refused: agent_not_on_list` (`:2869-2873`). New: in a front-door run (first target `chief-of-staff` and the stored list has more than one entry) a tag in any step whose target is not `chief-of-staff` is `refused: roster_reply`; this generalises `advisors_reply`, which stays for advisors runs. |
| D12 **A workflow member's hand-off** | When the tag names a workflow member, the child copies that member's snapshot into its own `pending_job.workflow`, so `workflowOfEntity(child)` holds: grants from the snapshot at enqueue (`:827-835`), budgets and tested state at approve (`:1106-1112`), the version stamp (`:1840-1846`), and the Results workflow filter. The child's provider, adapter and model come from `resolveWorkflowProviderModel(snapshot.model)` instead of the parent's (`:2909-2911` today). The "workflow only on the first hand-off" rule (`:2563-2565`) becomes "on the first hand-off, or copied from `rosterWorkflows` for its own target"; a body can still never place one on a child. |
| D13 **The Chief of Staff's view of members** | DECISION G. Recommended: `CollaborationListedAgent` gains optional `label` and `summary`; the wrapper's "Other agents" line reads `- <name> (<label>): <summary>` when present and stays `- <name>: <oneLine(instructions)>` otherwise, so coding and advisors prompts and their pins do not change. A workflow's name is its row id; the label tells the Chief of Staff what it is. |

### 3.3 Report-back (D3)

| # | Decision |
|---|---|
| D14 **Who creates it** | The server, never the agent. After `completeReferral` of a step whose parent's target is `chief-of-staff` in a front-door run (`syncReferralFromExecution :2381-2386`, after `maybeRequestHandoff`), `maybeReportBack` creates one `pending_approval` hand-off: source = the agent, target = `chief-of-staff`, parent = the agent's step, idempotency key `report-back:<agentReferralId>`, prompt = "The owner asked:\n<first step's prompt>\n\n<label> answered:\n<answer>\n\nWrite the final answer for the owner. Keep the [source: …] markers of the claims you use. If you still need another listed agent, end with one hand-off request; otherwise no request." The agent's answer is included whole up to 12000 chars, then cut with "[answer cut]". The child's `pending_job.reportBackChecked: true` marks it done, mirroring `handoffChecked`. |
| D15 **Edge class** | New pure `classifyFrontDoorEdge(source, target, existing, firstTarget, agentsCount)` in `collaboration-front-door.ts`, consulted in `validateReferralWithRepos` beside `classifySendBackEdge`: `report_back` (agent → chief-of-staff whose parent step was the Chief of Staff) and `dispatch` (chief-of-staff → listed agent from a report-back step). Both skip the depth check like send-back edges (A5 "depth 3 stays" as a constant; a star-shaped chain is not a deeper chain). `report_back` skips the loop check (the Chief of Staff is visited at step 0). `dispatch` keeps the loop check, so each roster agent runs at most once per run. The agent cap and the 8-hand-off cap apply unchanged. |
| D16 **Rounds** | A round = one dispatch + one report-back. With `user`, `chief-of-staff` and the 4-agent cap, at most **2 distinct roster agents** fit, so at most **2 rounds** (5 hand-offs: start, d1, rb1, d2, rb2; the 8-cap is not reached). An explicit `MAX_FRONT_DOOR_ROUNDS = 2` in `orchestration.contracts.ts` pins it independently of the agent cap. A third dispatch is refused with the existing audit event and a `refused: …` note on the Chief of Staff's step; the run then completes with that step's answer as the final one. |
| D17 **Approval** | Every hand-off waits, dispatch and report-back alike (A5 default; APPROVAL-SET-01 later adds the per-team setting). The Team page shows the report-back step as "<agent> → Chief of Staff" with Approve, Reject and Edit task as for any waiting step. |
| D18 **Settle and recovery** | `settleCollaborationRun` waits while a completed agent step in a front-door run has no report-back yet (`isReportBackProcessed`, like `isAnswerHandoffProcessed :2536-2550`); `recoverMissedAnswerHandoffs` also recovers a missing report-back, so a gateway stop between completion and creation loses nothing (COLLAB-HANDOFF-RECOVER-01 model). A **rejected** report-back leaves the agent's answer as the last completed step: Results then shows it (today's rule). A **failed or timed-out** agent step gets no report-back and the run fails as today (DECISION C alternative registered, section 10). |
| D19 **Cost and budgets** | Each hand-off is its own execution and ledger intent as today. A workflow member's steps carry its snapshot, so its per-run and per-day budgets, tested state and model are enforced at approve exactly as a Team-page workflow run (D12). The Chief of Staff's steps have no budget (system agent). No run-level budget exists; RESULTS-COST-01 shows cost later. |
| D20 **Results** | `finalAnswerOf` is the last completed hand-off (`collaboration-results.ts:158-167`): the Chief of Staff's report-back answer is last, so Results shows the final answer with no Results change. The list item's team is `chief-of-staff` and `workflow` null (first step); a front-door run also matches the workflow filter of any member it used (D12), which is the "runs that used this workflow" reading. Showing the agents used on the result is a RESULTS-POLISH-01 line (section 10). |
| D21 **Detail** | `GET /api/collaboration/runs/:id` adds `agents: [{ name, label }]` from the first step's stored list so the page labels a workflow member by name instead of its id. `team` and `teamId` unchanged. |

### 3.4 Direct jobs stay (A8)

| Path | Unchanged behaviour | Tests that pin it |
|---|---|---|
| Team page, coding team | `team: coding` with a session; lead→writer→reviewer, send-back rounds, tests gate | `collaboration.controller.spec.ts:1475-1532, :2083`; `collaboration-teams.spec.ts:16, :55, :115`; `frontend/lib/collaboration.test.ts:2299`; `collaboration-workflows.test.tsx:914, :1030` |
| Team page, advisors team | `team: advisors` with a session; one advisor; `advisors_reply` refusal | `collaboration.controller.spec.ts:1621`; `internal-collaboration.controller.spec.ts:2359`; `collaboration-teams.spec.ts:72` |
| Team page, Chief of Staff with no roster | one read-only step, briefing preset, no hand-off | `collaboration.controller.spec.ts:1532` (adapt the instruction string; the "no hand-off" assertion stays with an empty roster); `frontend/lib/collaboration.test.ts:2643` |
| Team page, a chosen workflow | `workflowId`, test run, budgets, session-less start | `collaboration.controller.spec.ts:1771-1946, :2095-2217`; `collaboration-workflows.test.tsx:892, :914, :958, :1030-1139` |
| Agent mode | `conversation` + `harnessVersion v1` on `/api/ai/execute` | `workspace-agent-mode.logic.test.ts:149`; `workspace-shell.test.tsx:10278`; `ai-execution.controller.spec.ts:2255` |
| Bound agent in chat (`?userAgentId=`) | owner-scoped `agentId` on the Builder path; `agentId` + `harnessVersion` only for conversation | `ai-execution.controller.spec.ts:1718-1969, :1987-2275, :2429, :2493`; `workspace-execution-intent.logic.test.ts:115, :125` |

Nothing in this task edits `services/api-gateway/src/ai/`, the workspace page, or `frontend/components/workspace/`.

### 3.5 Frozen contract

HARNESS_ENTITLEMENT_PROOF_V1 is **used, not changed** (the BIZ-USER-01C form, `docs/BIZ-USER-01C-CHECKPOINT.md:31`): no job key is added or removed, `withHarnessEntitlementProof` and `startReferralExecution`'s payload shape are untouched, and `ai-execution.controller.ts`, `job.types.ts`, `worker.processor.ts` and every other ai-service file except the eval copy are untouched. `orchestration.service.ts` **is edited** in 01B (report-back, the roster-reply note, the snapshot copy and model choice for a workflow child, settle and recovery), which is why 01B declares `sharedContractIds: [HARNESS_ENTITLEMENT_PROOF_V1]`, `mutatesSharedContractIds: []`, carries key-set pin tests (a report-back job and a workflow-member job are signed with the same key set as a chief-of-staff job), and reports `git diff --stat main -- services/api-gateway/src/ai services/ai-service/src/queue services/ai-service/src/worker` empty. **No contract change is needed.** This is not a contract-change task. 01A and 01C leave `orchestration.service.ts` with an empty diff.

### DECISIONs the plan does not settle

**Product (Keith's call):**

| ID | Choice | Recommendation |
|---|---|---|
| DECISION A | Where the owner talks: the Team page's Chief of Staff option, a new "Ask the Chief of Staff" page, or the Command Center. | **The Team page.** The chain, approvals, past runs and Results already live there and the card already opens it. A dedicated page is one follow-up line if wanted later. |
| DECISION B | Roster members: system advisors only, the owner's workflows only, or both. | **Both**, at most 3. Workflows are what make the front door useful; the two advisors cost nothing to include. |

**Implementation (control plane):**

| ID | Choice | Recommendation |
|---|---|---|
| DECISION C | A failed or timed-out roster step: no report-back and the run fails (today), or a report-back carrying the failure so the Chief of Staff tells the owner. | **No report-back; fail as today.** Smaller slice; register the alternative NOT_READY. |
| DECISION D | Evolve `chief-of-staff` (hash change, ai-service eval copy re-rendered, AI-SERVICE mutex) or add a second definition (`front-door`: new team id, Team page option, office alias, Results label, duplicated briefing text). | **Evolve the one definition.** The front door *is* the Chief of Staff; one hash change was accepted before; the office and Results stay untouched. |
| DECISION E | Depth on front-door edges: exempt like send-back edges with `MAX_FRONT_DOOR_ROUNDS = 2`, or raise `DEFAULT_MAX_REFERRAL_DEPTH`. | **Exempt the two edge classes.** A5 keeps depth 3 and 4 agents; the rounds are bounded by the agent cap and the explicit constant. |
| DECISION F | A roster member that is not runnable at start (draft, untested, off, deleted, coming_soon): leave it out and report it, or refuse the start. | **Leave it out and report it** (`roster.skipped`, a hint on the page). A draft workflow must not stop the owner from talking to the Chief of Staff. |
| DECISION G | What the Chief of Staff reads about each member: label and description, or the one-line full prompt (today's wrapper). | **Label and description** through optional fields; the wrapper output for coding and advisors is byte-identical. |
| DECISION I | Roster storage: a per-owner table with migration 1805, or no storage (ticked per run and sent in the body, validated server-side). | **The table.** The server owns the agent list; Phase 3 chat and Phase 4 triggers start runs with no browser and need the stored roster; no migration would leave the roster in the body. |

Settled by the approved plan, not asked again: every hand-off waits for approval (A5 default; D17); depth 3, 4 agents and the daily caps stay (A5; D15-D16); direct jobs stay (A8; 3.4); session-less read-only runs use the business session (TEAM-NO-SESSION-02; D4).

## 4. Files

### 01A — Roster store (GATEWAY, MIGRATION)

| File | Change |
|---|---|
| `services/api-gateway/src/orchestration/collaboration-roster.entity.ts` (new) | D8 entity |
| `services/api-gateway/src/orchestration/collaboration-roster.ts` (new) | `CollaborationRosterService`: get, put with validation (D6, D7, D9), `membersForStart` (D10, used by 01B) |
| `services/api-gateway/src/orchestration/collaboration-roster.spec.ts` (new) | section 6 |
| `services/api-gateway/src/orchestration/collaboration-roster.controller.ts` (new) + `.spec.ts` | D9 routes |
| `services/api-gateway/src/orchestration/orchestration.module.ts` | `forFeature([CollaborationRosterEntity, UserAgent])` as needed, provider, controller |
| `services/api-gateway/src/orchestration/__tests__/orchestration.persistence.spec.ts` | the controller pin RESULTS-01 hit (`docs/RESULTS-01-CHECKPOINT.md:17`), if it needs the new controller |
| `services/api-gateway/src/migrations/1805000000000-CreateCollaborationRostersTable.ts` (new) + `migrations/__tests__/1805…spec.ts` (new) | D8 |
| `services/api-gateway/src/migrations/__tests__/1804000000000-AddCollaborationRunResultSeenAt.spec.ts` | the "latest" line (`:61`) |

Not changed: `orchestration.service.ts` (empty diff), `collaboration.controller.ts`, the registry, ai-service, frontend.

### 01B — Front-door run and report-back (GATEWAY, AI-SERVICE)

| File | Change |
|---|---|
| `services/api-gateway/src/orchestration/orchestration.service.ts` | D11 roster-reply note; D12 snapshot copy and model for a workflow child; D14 `maybeReportBack`; D15 edge classes in `validateReferralWithRepos`; D18 settle and recovery; `readReferralAgents` for D21 |
| `services/api-gateway/src/orchestration/collaboration-front-door.ts` (new) + `.spec.ts` | pure: `classifyFrontDoorEdge`, `isFrontDoorRun`, `buildReportBackPrompt`, `rosterMemberToListedAgent`, `reportBackIdempotencyKey` |
| `services/api-gateway/src/orchestration/orchestration.contracts.ts` | `label`/`summary` on `CollaborationListedAgent`; `rosterWorkflows`, `reportBackChecked` on `ReferralPendingJob`; `MAX_FRONT_DOOR_ROUNDS` |
| `services/api-gateway/src/orchestration/handoff-request.ts` + `.spec.ts` | D13 wrapper line; `readCollaborationAgents` accepts the optional fields |
| `services/api-gateway/src/orchestration/collaboration.controller.ts` + `.spec.ts` | D4 session-less chief-of-staff start; D10 agent list from `membersForStart`; `roster` in the start response; D21 `agents` on the detail |
| `services/api-gateway/src/orchestration/internal-collaboration.controller.spec.ts`, `orchestration/__tests__/*` | section 6 |
| `services/api-gateway/src/system-agents/system-agent-registry.ts` + `.spec.ts` | D2 spec text; the `chief-of-staff` length and hash pins |
| `services/ai-service/src/agent-harness/eval/briefing-instructions.ts` | D2 copy re-rendered and `COS_EVAL_CHIEF_OF_STAFF_VERSION` |

Not changed: `services/api-gateway/src/ai/`, `services/ai-service/src/queue/`, `services/ai-service/src/worker/`, `collaboration-send-back.ts`, `collaboration-results.ts`, `collaboration-workflow.ts` (its `prepareStart` is reused by the roster service's snapshot builder; if a shared helper is cleaner, it is one exported function in `collaboration-workflow.ts` and the file joins the write set at admission), `collaboration-business-session.ts`, `user-agent/`, frontend.

### 01C — Team page (FRONTEND, I18N)

| File | Change |
|---|---|
| `frontend/components/collaboration/collaboration-roster.ts` (new) + `collaboration-roster.test.tsx` (new) | fetch and read helpers (`collaborationFetch` from `lib/collaboration/api.ts`), the picker state, labels |
| `frontend/components/collaboration/collaboration-page.tsx` | roster load and save under the Chief of Staff option; session-less chief-of-staff start body `{ task, team: 'chief-of-staff' }`; `roster.skipped` hint; member labels from the detail's `agents` |
| `frontend/components/collaboration/collaboration-view.tsx` | the roster picker (checkboxes, Save, loading / empty / failed / saved states) inside the Chief of Staff option; the no-session view shows the Chief of Staff option and the form; report-back step label |
| `frontend/components/collaboration/collaboration-workflows.ts` + `.test.tsx` | start body without `sessionId` for the chief-of-staff team |
| `frontend/lib/collaboration.test.ts` | only if a BIZ-01 assertion compares the changed hint strings literally |
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | `teamChiefOfStaffHint`, `chiefOfStaffSummary`, `fileAccessReadOnly` (drop "hand off" where it now may), `missingSession` (name the Chief of Staff beside workflows), `platform.chiefOfStaffCapabilityThree`; new `collaboration.roster*` keys (heading, empty, loading, failed, save, saved, skipped hint, member kinds, "writes the final answer") |

Not changed: `frontend/lib/collaboration/logic.ts` and `api.ts`, `frontend/hooks/`, `frontend/components/platform/`, `frontend/components/office/`, `frontend/components/workspace/`, `frontend/app/`.

**Registered provisional scope:** the body sets no write set (`TASKS_BACKLOG_FULL.md:86879`; sidecar `writePaths: []`). Every file above is therefore set at admission, per slice, EXACT. Files outside `services/api-gateway/src/orchestration/` and `frontend/components/collaboration/`: the two migration files and the 1804 spec (01A), `system-agent-registry.ts` and its spec and the ai-service eval copy (01B), the three message files (01C).

## 5. Write set, mutexes, lifecycle

| Item | 01A | 01B | 01C |
|---|---|---|---|
| Mutexes | GATEWAY, MIGRATION | GATEWAY, AI-SERVICE | FRONTEND, I18N |
| PACKAGE | no | no | no (`components/collaboration/*.test.ts*` is in the test script) |
| Hot files | none | none | none |
| Shared contracts | none touched (empty diff on the four paths) | HARNESS_ENTITLEMENT_PROOF_V1 read, not mutated (3.5) | none |
| Revert isolation | migration down; no caller until 01B | the front-door branch in orchestration; with no roster the old path runs; the hash pin reverts with the spec | the page; the routes stay callable |
| Lifecycle | 4-STEP overall: registration (done), this stage-start, implementation (three slices, each with its own LANE-DONE and LOCK), consolidation per slice | | |
| Evidence class | LOCAL-TESTS | LOCAL-TESTS | LOCAL-TESTS |
| Order | first | after 01A LOCK (uses `membersForStart`) | after 01B LOCK (uses the roster routes, `roster` in the start response and `agents` on the detail) |
| Lane | one lane, sequential (01A and 01B both hold GATEWAY; 01C needs 01B's fields) | | |
| Deploy | STAGING-DEPLOY-FD-01 becomes a migrating deploy (1805): pre-migration backup, new migration hash | | |

## 6. Tests and gates

**01A, gateway.** Roster service: get returns `[]` for a new owner; put saves at most 3 unique ids and answers with names and usability; put refuses a fourth, a duplicate, `chief-of-staff`, `advisors-lead`, a coding id, `builder`, an unknown id, a deleted row and another owner's row (400, nothing saved); `choices` lists the two advisors and the owner's rows only; `membersForStart` leaves out a draft, an untested, an off and a deleted workflow with reasons, builds snapshots for usable ones with `testRun false`. Controller: 401, 403, 404-shape for another owner's ids. Migration spec: 1805 is the latest and after 1804; up refuses when present; down refuses when absent; mocked.

**01B, gateway.** Start: chief-of-staff with roster `[product-strategy, <wf>]` stores a 3-entry list with labels and summaries, `rosterWorkflows` with one snapshot, response `roster.used`; with an unusable member, `roster.skipped` and a 2-entry list; with no roster, a 1-entry list and the same job keys as today; chief-of-staff without `sessionId` uses the business rows (and coding / advisors still 400). Hand-offs: a Chief of Staff tag to a listed workflow creates a waiting child whose `pending_job.workflow` is that snapshot and whose provider/model follow the snapshot; approve on that child runs `assertCanApprove` (budget 429/409, not tested 409) and stamps the workflow version; a tag to an unlisted id is `refused: agent_not_on_list`; a workflow member's own tag is `refused: roster_reply`; `advisors_reply` unchanged. Report-back: completing the child creates one `pending_approval` hand-off agent→chief-of-staff with the prompt of D14 and key `report-back:<id>`, at depth 2 without a depth or loop refusal; twice-completed is idempotent; the sweep recovers a missing one and the run does not settle before it exists; the Chief of Staff's report-back answer with a tag to a second member is allowed (depth 3, agents 4), and a third member is refused (agent cap and `MAX_FRONT_DOOR_ROUNDS`); the run completes with the Chief of Staff's answer last and `finalAnswerOf` returns it; a rejected report-back completes the run with the agent's answer last; a failed child fails the run with no report-back. Key-set pins: a report-back job and a workflow-member job are signed with the same key set as a chief-of-staff job. Registry: new `chief-of-staff` length and hash, the eight other pins unchanged, the spec still states the briefing, citation and never-send rules. ai-service: `briefing-drift.spec.ts` passes with the re-rendered copy and version.

**01C, frontend.** Roster picker under the Chief of Staff option: loading, empty, failed with retry, loaded; ticking a fourth is refused with a hint; Save posts `memberIds` and shows saved; the picker is hidden for coding, advisors and a selected workflow; without a session the Chief of Staff option and the form show, the start body has no `sessionId`, and coding / advisors stay hidden with the reworded hint; `roster.skipped` renders the hint with the member name; a report-back step reads "<label> → Chief of Staff"; a workflow member's steps show its label from `agents`; existing test IDs kept; key parity in three languages with real Chinese.

| Area | Command | Compare with |
|---|---|---|
| api-gateway | `npx jest --maxWorkers=2`, then `npm run build` | 3404 passed, 7 skipped, plus the 14 known `smoke.integration` failures; each slice moves the count by its new tests only |
| ai-service | `npx jest --runInBand` | 1296 passed, 1 skipped; 01B changes the eval copy's content, not the count; its drift spec must pass against the new gateway spec |
| frontend | `npx tsc --noEmit`, `npm test`, `npm run build`, then `git restore -- frontend/tsconfig.tsbuildinfo` | 1535 passed |
| files | changed files are LF; 01A and 01C: `git diff --stat main -- services/api-gateway/src/orchestration/orchestration.service.ts services/api-gateway/src/ai services/ai-service` empty; 01B: `git diff --stat main -- services/api-gateway/src/ai services/ai-service/src/queue services/ai-service/src/worker` empty | |

Checklists on each checkpoint: EVERY, BACKEND (01A, 01B), MIGRATION (01A), UI (01C). FLOWS n/a (no checkpoint, revert or file-action change). Skills before UI work: `.agents/skills/impeccable`, `.agents/skills/emil-design-eng`; DESIGN.md applies (existing radio-card, checkbox, hint and button patterns).

## 7. Implementer model (GOV-ROUTING-01)

| Slice | Model | Why |
|---|---|---|
| 01A | **opus** (Opus 5.5) | a migration and owner-scoped routes |
| 01B | **opus** (Opus 5.5) | orchestration state machine, a frozen-path file, a cross-service hash change; the design above is settled, so the work is bounded. If opus stops twice on the edge classes or settle logic, re-dispatch on fable |
| 01C | **sonnet** (Sonnet 5.5) | frontend-only UI with copy in three languages, no auth or contract change; opus if the brief grows beyond the picker and labels |

## 8. Split and order

| Slice | Delivers | Lockable alone because |
|---|---|---|
| **01A** roster store | table, entity, migration 1805, roster routes, `membersForStart` | nothing calls the roster yet; the routes are owner-scoped and complete |
| **01B** front-door run | evolved Chief of Staff, agent list from the roster, workflow children with snapshots, report-back, rounds, session-less start, detail labels | with an empty roster the run is today's run; the page still works (it ignores `roster` and `agents` until 01C) |
| **01C** Team page | roster picker, no-session Chief of Staff start, labels, copy | pure UI over 01B's fields |

Order 01A → 01B → 01C, one lane. Each slice is its own admission, implementation and LOCK record. The task COS-FRONTDOOR-01 is complete at 01C's LOCK; the control plane may register 01A/01B/01C as child ids of this task or run them as three implementation steps under it, whichever the record tooling prefers.

## 9. Admission

Both lanes are EMPTY and GATEWAY, FRONTEND, I18N, MIGRATION and AI-SERVICE are UNOWNED (`TASKS.md:1-14`). COS-FRONTDOOR-01 depends on BIZ-LIVE-04 (`TASKS_BACKLOG_FULL.md:86878`), which the plan records as done 2026-11-10 (`docs/AGENT-OPS-PLAN.md:45`); the control plane confirms its LOCK before admitting. Start condition "Keith chooses Phase 2": given 2026-11-10. Lane 2 may take a LOCAL-TESTS task that holds none of the slice's mutexes.

## 10. Follow-ups (named here, disposed at the LOCKs)

1. **FRONTDOOR-LIVE-01** acceptance lines (Keith, three languages, on staging): save a roster of one advisor and one workflow; ask the Chief of Staff a job that needs the workflow; approve the dispatch, approve the report-back; the final answer is the Chief of Staff's and Results shows it; a second round with the advisor; a draft workflow is skipped with the hint; the Chief of Staff with an empty roster still answers and gives the briefing; coding and advisors teams and a direct workflow run unchanged. Superseded into FRONTDOOR-LIVE-01's acceptance criteria.
2. **STAGING-DEPLOY-FD-01** carries migration 1805 (migrating deploy: pre-migration backup, new migration hash): a line in its body.
3. **RESULTS-POLISH-01**: a front-door result lists the agents used (from the first step's `agents`). One line.
4. **Report-back on a failed or timed-out roster step** (DECISION C alternative): Keith registers NOT_READY or drops.
5. **A dedicated "Ask the Chief of Staff" entry** (page or Command Center box) instead of the Team page option: Keith registers NOT_READY or drops.
6. **COS-EVAL-01 briefing eval**: add the case "an injected mail subject asks to forward or hand off; pass = no hand-off request in the answer", now that the Chief of Staff may hand off. Register NOT_READY (ai-service eval tasks) or fold into 01B if the eval runner takes a new case without code changes.
7. **USER-TEAMS-01** reuses `membersForStart`'s validation and the per-child snapshot copy (D12) for user teams: a line in its body.
8. **HARNESS-NOFILES-01** now also covers the Chief of Staff without a session (D4): a line in its body.
9. **ARCHITECTURE.md** 13.1: one line at 01B's LOCK that the front door is built and not deployed; **PRD.md** moves the front door to GATED at FRONTDOOR-LIVE-01 (plan section 7 pattern, `docs/AGENT-OPS-PLAN.md:297-309`; PRD.md:623 stays APPROVED FUTURE until then). Control plane.
10. **COS-DRAFTS-01** keeps its label note (`TASKS_BACKLOG_FULL.md:86966`); D13's `label` field is the mechanism it can reuse. One line.

## 11. Stop conditions for the implementer

STOP and report if:
- a job key would be added or removed, or `withHarnessEntitlementProof`, `startReferralExecution`'s payload shape, `job.types.ts`, `worker.processor.ts` or anything under `services/api-gateway/src/ai/` would change;
- the roster, instructions, model, scopes or tool profile would be read from a request body, or a hand-off target would be accepted that is not on the run's stored agent list;
- a step whose target is not `chief-of-staff` would be allowed to request a hand-off in a front-door run;
- a report-back or dispatch would be created without `pending_approval`, or any step would be approved without the owner (`decidedBy` must be the owner);
- `DEFAULT_MAX_REFERRAL_DEPTH`, `DEFAULT_MAX_AGENTS_PER_COLLABORATION`, `MAX_HANDOFFS_PER_RUN` or `MAX_SEND_BACK_ROUNDS` would change, or a third round would be possible;
- a coding or advisors team start, a direct workflow start, Agent mode or the bound-agent path would change behaviour (3.4);
- a guard, the session cookie, CSRF, the internal key, the entitlement check or the 404-for-another-owner rule would change;
- any system-agent pin other than `chief-of-staff` (01B) would change, or a second Chief of Staff definition seems needed;
- a migration other than 1805 (01A), an entity change outside the roster entity, or a new dependency seems needed;
- the team picker, coding or advisors options would show without a session, or the no-session Chief of Staff start would omit the caller note;
- a file outside the slice's write set would change;
- a gate fails outside the 14 known smoke failures.

## 12. Approval

Approved 2026-11-10. Keith: Stage 4 go-ahead ("yes"); DECISION A the Team page and DECISION B both kinds of member, at most 3 ("ok" (after "yes" to Stage 4 and the explanation of the 3-agent limit)). Control plane: C no report-back on a failed step, D evolve chief-of-staff, E exempt the two front-door edge classes with MAX_FRONT_DOOR_ROUNDS = 2, F skip an unrunnable member and report it, G label and description, I a per-owner table with migration 1805. Slices: COS-FRONTDOOR-01 = 01A (this admission: GATEWAY, MIGRATION; opus), COS-FRONTDOOR-01B (GATEWAY, AI-SERVICE; opus) and COS-FRONTDOOR-01C (FRONTEND, I18N; sonnet), one lane, in that order.

Original draft text of this section:


Pending. Product DECISIONs A and B are Keith's; C to I are the control plane's, recommended as above. On approval the control plane sets the three slices' EXACT write sets and mutexes (section 5), confirms BIZ-LIVE-04 LOCKED, and admits 01A to Lane 1 with GATEWAY and MIGRATION.
