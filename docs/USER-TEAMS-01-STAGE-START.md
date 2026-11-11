# USER-TEAMS-01 — Stage-start

**Task:** USER-TEAMS-01 — User teams and who hands work to whom (plan row 35, `docs/AGENT-OPS-PLAN.md:53`; section 3.2 `:195`; D5 `:265`; A9 part 7 `:160`, `:242`; A5 `:156`; A8 `:159`)
**Status:** STAGE-START — APPROVED 2026-11-11. Drafted read-only by a fable subagent (Fable 5.1). Keith approved the plan and DECISIONs A to D ("Yes, approve"); DECISIONs E and F settled by the control plane on their recommendations. USER-TEAMS-01 is slice 01A; 01B and 01C are registered as USER-TEAMS-01B and USER-TEAMS-01C.
**Registered body:** `TASKS_BACKLOG_FULL.md:86994-87020` (4-STEP, LOCAL-TESTS, OPTIONAL, APPROVED_FUTURE, depends on COS-FRONTDOOR-01 (LOCKED 2026-11-10), write set "set at admission", PROVISIONAL, NOT_READY until Keith decides). Sidecar candidate `docs/control-plane/lane-saturation-state.json:4741-4753` (mutexes and writePaths empty). Body note (COS-FRONTDOOR-01B LOCK): reuse `CollaborationRosterService.membersForStart`'s validation and the per-child workflow snapshot copy.
**Model:** `docs/COS-FRONTDOOR-01-STAGE-START.md` (approved 2026-11-10) and the 01B, 01C and FRONTDOOR-LIVE-01 checkpoints. The front door is deployed on staging 537ebfb and passed Keith's live check (`docs/FRONTDOOR-LIVE-01-CHECKPOINT.md:4, :18`).
**Proposed shape:** three bounded slices, each locked on its own: **01A** team column and validation, **01B** team runs with report-back, **01C** workflow form and Team page. Section 8.

## 1. Goal

A user's own workflow gets what the Chief of Staff has today: a team of up to three agents (the two system advisors or the owner's other workflows) it may hand one bounded question to, with report-back, so the workflow writes the final answer for the owner. The team is part of the workflow's form (A9 part 7, under Advanced). Every hand-off waits for the owner's approval as today; APPROVAL-SET-01 changes that later and is not designed here. Direct jobs to any agent stay as they are (A8): a workflow with an empty team runs exactly as it runs now.

## 2. What is true today

Verified by reading on 2026-11-11 at main 1cb4bef8. Nothing was run.

### 2.1 The Chief of Staff roster and the front-door run

| Fact | Where |
|---|---|
| One roster per owner: `collaboration_rosters` (`user_id` PK, `member_ids` jsonb, `updated_at`), migration 1805, no relation decorators. The PK is the owner, so a second roster per owner is not possible in this table. | `collaboration-roster.entity.ts:11-21`; `migrations/1805000000000-CreateCollaborationRostersTable.ts:27-33` |
| A member is a system agent (read profile, team role outside coding, not `chief-of-staff` or `advisors-lead`, active) or one of the owner's `user_agents` rows; at most 3 (`MAX_ROSTER_MEMBERS`); `readRosterMemberIds` checks shape, count and repeats; `put` checks every id before writing and answers 400 with a stable code. | `collaboration-roster.ts:36, :41-48, :100-133, :194-219, :305-329` |
| `membersForStart(userId)` reads the stored ids and re-checks each: a workflow must be the owner's, not off, not a draft, renderable and tested at its version, else skipped with a reason (`off`, `draft`, `invalid`, `not_tested`, `missing`, `coming_soon`); a usable workflow becomes an agent-list entry `{ name: row.id, instructions, label: row.name, summary: row.description }` plus a `ReferralPendingWorkflow` snapshot with `testRun: false`. | `collaboration-roster.ts:338-362, :364-438` |
| The agent list holds 1 to 4 entries; `label` is at most 100 chars and `summary` at most 300, and a longer value is refused, not cut. `membersForStart` passes `row.description` whole as `summary`, and the DTO allows a description of 2000 chars. So a roster workflow with a description over 300 chars makes the Chief of Staff start fail with 400 `agents[i].summary is invalid` when the first hand-off reads the list. Verified by reading, not run. | `handoff-request.ts:10-22, :58-63, :102-109`; `collaboration-roster.ts:424`; `user-agent/dto/update-agent.dto.ts:55-58`; `orchestration.service.ts:2866-2871` |
| A chief-of-staff team start takes the agent list from `frontDoorAgentList(lead.instructions, members.agents)`, the snapshots as `rosterWorkflows`, and reports `roster: { used, skipped }` in the start response. The body never carries the roster. | `collaboration.controller.ts:646-690, :278-295`; `collaboration-front-door.ts:71-87` |
| A front-door run is "agents.length > 1 and agents[0].name === 'chief-of-staff'". The lead id is a constant used in: the edge classifier, `needsReportBack`, `reportBackFromAnswer`, `rosterWorkflowFor`, the `roster_reply` refusal and the `rosterWorkflows` gate on the first hand-off. | `collaboration-front-door.ts:15, :50-54, :107-164`; `orchestration.service.ts:1507-1519, :2617-2625, :2664-2694, :2768-2790, :3188-3190, :2908-2917` |
| `preparePendingReferral`: `agents`, `workflow` and `rosterWorkflows` only on the first hand-off; a child copies its parent's `agents`; a target off the list is refused; `rosterWorkflows` need a Chief of Staff first target with file access and no `workflow` snapshot; a child whose target has a snapshot in `rosterWorkflows` copies it as its own `workflow` (D12). | `orchestration.service.ts:2830-2838, :2860-2884, :2908-2948` |
| `workflowOfEntity` returns the step's snapshot only when `workflow.id` equals the step's target; it drives grants at enqueue, budgets and tested state at approve, and the version stamp. The report-back child's target is the lead; today the lead is a system agent and needs no snapshot. | `orchestration.service.ts:3002-3010, :844, :1123` |
| `requestHandoffFromAnswer`: in a front-door run a tag from any step other than the lead is `refused: roster_reply`; a target off the list is `refused: agent_not_on_list`; a workflow member's child runs on `resolveWorkflowProviderModel(snapshot.model)`. | `orchestration.service.ts:3186-3204, :3231-3245` |
| Report-back: created by the server after a dispatched member completes, key `report-back:<id>`, recovered by the sweep, awaited by settle; `report_back` edges skip depth and loop, `dispatch` edges skip depth only, `MAX_FRONT_DOOR_ROUNDS = 2` refuses a third round. Depth 3, 4 agents, 8 hand-offs, 2 send-back rounds unchanged. | `orchestration.service.ts:2644-2760, :2596-2615, :1513-1600`; `orchestration.contracts.ts:87-96` |
| `pending_job` (`collaboration_referrals`) holds `agents`, `workflow`, `rosterWorkflows`, `reportBackChecked`; these are orchestration-internal and not keys of the AI job, which is signed at `withHarnessEntitlementProof`. 01B added two of them and reported the key set unchanged. | `orchestration.service.ts:1067-1088, :903`; `orchestration.contracts.ts:197-232`; `docs/COS-FRONTDOOR-01B-CHECKPOINT.md:54-57, :85` |

### 2.2 User workflows

| Fact | Where |
|---|---|
| `user_agents` carries name (100), role, description, status (`active`/`draft`/`disabled`), tone, reply language, purpose, procedure, result, tool profile (`read` only), scope ids, connector tool ids, model, two budgets, template id, soft delete. Migration 1803 added the twelve workflow columns in one `ALTER TABLE`, probe-guarded both ways. | `entities/user-agent.entity.ts:19-98`; `migrations/1803000000000-AddUserAgentWorkflowColumns.ts:6-14, :46-57`; `user-workflow-grants.ts:15` |
| `renderWorkflow` builds the prompt from the spec and the platform rules; `workflowVersion` hashes id, spec, prompt, scopes, tools and model. `workflowNormalRunAllowed` = active and tested at that version. | `collaboration-workflow.ts:158-183, :190, :319-325`; `user-workflow-rules.ts:13-15` |
| `prepareStart` refuses not-found, disabled, invalid, (unless a test run) untested and over-budget, then returns a team of one: `agents: [{ name: row.id, instructions }]` and the `workflow` snapshot with `testRun`. The controller's `workflowStartPlan` wraps it with `rosterWorkflows: []`, `roster: null`. | `collaboration-workflow.ts:386-436`; `collaboration.controller.ts:693-703` |
| A workflow start may omit `sessionId` and uses the business project and session (read profile asserted); the caller note is passed. | `collaboration.controller.ts:243-250, :283`; stage-start `:69` |
| `UserAgentService.update` validates the merged fields (`validateWorkflow`: spec, length, model, budgets, grants) and runs the switch-on check only when a PATCH turns the row active. `CreateAgentDto` and `UpdateAgentDto` carry the same workflow fields. The user-agent folder already imports functions from `orchestration/collaboration-workflow` by file, so a file import of roster helpers makes no module cycle; `UserAgentModule` exports `UserAgentService`, and `OrchestrationModule` imports it and provides `CollaborationRosterService`. | `user-agent.service.ts:258-302, :357-420`; `dto/create-agent.dto.ts:44-131`; `user-workflow-switch-on.ts:3-10`; `user-agent.module.ts`; `orchestration.module.ts:26, :51, :81` |
| `GET /api/agents/options` returns reply languages, scopes, tools, connected kinds, models, templates and limits behind `SessionCookieGuard`; `toAgentResponse` adds derived `neverDo`, `grants` and the prompt length. | `user-agent.controller.ts:60-100, :140, :168-189` |
| The editor: `WorkflowBasicFields`, `WorkflowAccessFields`, `WorkflowAdvancedFields` (a `<details>` "Advanced: model and budget" with model and the two budgets); `buildBlankBody` and `buildPatchBody` map the draft to the DTOs; copy under `platform.agentWorkflow` (`sectionAdvanced` at `en.json:755`, `zh-TW.json:755`, `zh-CN.json:755`). The summary panel shows folders, model, budgets and tested state. | `agent-workflow-fields.tsx:356-470`; `agent-workflow-model.ts:33-67, :211-265`; `create-agent-form.tsx:425-451`; `agent-workflow-summary.tsx:105-149` |
| The Team page: `useCollaborationRoster` loads the roster only for the chief-of-staff option; `readStartSkipped` and `readRunAgents` are generic readers of `roster.skipped` and the detail's `agents`; `isReportBackHandoff` hard-codes the target `chief-of-staff`; the report-back step label is `reportBackStep`. The skipped hint renders after any start (`rosterSkipped` is set from every start response), but it names members from `rosterKnown`, built from the roster view, which is not loaded for a workflow start; the frontend agent type with the workflow fields lives in `frontend/hooks/useUserAgents.ts`. | `frontend/components/collaboration/collaboration-roster.ts:170-213, :257`; `collaboration-page.tsx:583-585, :642-652, :708-713, :787`; `frontend/hooks/useUserAgents.ts` |
| PRD: user workflows and teams are APPROVED FUTURE; ARCHITECTURE 13.1 has the front-door row. | `PRD.md:623`; `ARCHITECTURE.md:1048` |
| HARNESS_ENTITLEMENT_PROOF_V1 is FROZEN over `ai-execution.controller.ts`, `job.types.ts`, `worker.processor.ts` and `orchestration.service.ts`. | `lane-saturation-state.json:7225-7233` |

## 3. Design

### 3.1 Storage (DECISION A)

| # | Decision |
|---|---|
| D1 **Where the team lives** | One column on `user_agents`: `team_member_ids jsonb NOT NULL DEFAULT '[]'::jsonb`, migration `1806000000000-AddUserAgentTeamColumn` in the 1803 pattern (probe `information_schema.columns`; up refuses when present; down drops only that column; down loses teams only). Entity field `teamMemberIds: string[]`; `WorkflowRow` gains it. Why a column: the team is a part of the workflow's form and is saved with the workflow's POST and PATCH, like model and budgets; the row already holds the spec the run snapshots. Why not `collaboration_rosters`: its PK is the owner, one roster per owner. **A migration is needed either way. MIGRATION mutex.** The 1805 spec's "is the latest" line (`1805…spec.ts:59-69`) moves to the `< timestamp` form. |
| D2 **Who may be a member** (DECISION D) | The same rule as the Chief of Staff roster: `isRosterSystemCandidate` and active (today `product-strategy`, `technology-advisor`), or one of the owner's own `user_agents` rows (any status at save time), at most 3 (`MAX_ROSTER_MEMBERS`), no repeats. New refusal `ROSTER_MEMBER_SELF` (400) when a workflow lists itself. The per-id checks of `put` (`collaboration-roster.ts:307-326`) move into an exported `assertRosterMemberIds(ids, { ownerRow(id) })` that `put` and `UserAgentService.validateWorkflow` both call; `readRosterMemberIds` is reused for the shape. `UserAgentService` passes its own `findOneByIdAndUserId`; no new provider, no slot, no module cycle (2.2). On create, `teamMemberIds` is accepted too; a self-reference cannot occur there. |
| D3 **Response and choices** | `GET /api/agents`, `/:id`, POST and PATCH responses carry `teamMemberIds`. `GET /api/agents/options` gains `teamChoices: [{ id, kind, name, status }]` from `rosterSystemChoices()` and the owner's rows, so the form has its choices behind the guard it already uses (`user-agent.controller.ts:140`). Usability is decided at start, not in the form (D7). Alternative: the form reads `GET /api/collaboration/roster` `choices`; rejected because that route sits behind `assertEntitled` on the collaboration controller and the form would then depend on a second module's rules. |

### 3.2 Team runs (reuse of 01B)

| # | Decision |
|---|---|
| D4 **The lead-run marker** (DECISION E) | `ReferralPendingJob.teamLeadId?: string`, set by the server on the first hand-off when the agent list has more than one entry (the chief-of-staff start sets `'chief-of-staff'`; a workflow start with members sets the row id), copied to every child with `agents` (`orchestration.service.ts:2866-2871`). `leadIdOf(job)`: `teamLeadId` when it equals `agents[0].name`; else `'chief-of-staff'` when `isFrontDoorRun(agents)` (runs stored before this change); else null. A body can never set it: `createPendingReferral` has no such input; the server derives it in `preparePendingReferral`. It lives in `pending_job` like `rosterWorkflows` (2.1), not in the AI job. |
| D5 **Lead as a parameter** | `collaboration-front-door.ts` keeps its names and gains the lead as a parameter: `isTeamRun(agents, leadId)`, `teamAgentList(lead: FrontDoorMember, members)` (the lead entry gets `label` = the workflow's name and `summary` = "Leads this run for the owner. Your answer goes back to <name>, who writes the final answer."; the Chief of Staff keeps `FRONT_DOOR_LEAD_LABEL`/`_SUMMARY`), `classifyFrontDoorEdge(source, target, existing, leadId, agentsCount)` with `leadId` in place of the constant at `:107-121, :143`. In `orchestration.service.ts` every use listed in 2.1 reads `leadIdOf(...)` instead of `FRONT_DOOR_LEAD_ID`. Behaviour for the Chief of Staff is byte-identical; its 25 tests from 01B pin that. |
| D6 **Start** | `prepareStart` returns `teamMemberIds` from the row (ids only, nothing evaluated). In the controller, `workflowStartPlan` calls `rosterService.evaluateMembers(userId, ids.filter(id => id !== row.id))` — `membersForStart(userId)` becomes `evaluateMembers(userId, await this.get(userId))`, same checks, same reasons — and builds `agents = teamAgentList(leadEntry, members.agents)`, `rosterWorkflows = members.rosterWorkflows`, `roster = { used, skipped }`, keeping `workflow` = the lead's snapshot. With no members: `agents` is today's one entry, no `teamLeadId`, `roster: null`; the run is today's run byte for byte (tested). The assembly is in the controller because `CollaborationRosterService` already depends on `CollaborationWorkflowService` (`collaboration-roster.ts:258`). |
| D7 **Unusable members** | Skipped with a reason, never a refusal of the start (DECISION F of the front door): `roster.skipped` in the start response, the Team page hint. A member that is draft, untested, off, invalid or gone is left out by `evaluateWorkflow`/`evaluateSystem` unchanged (`collaboration-roster.ts:364-438`). A lead listing itself (stored before D2, or by a race) is dropped silently at start. |
| D8 **First hand-off gate** | The `rosterWorkflows` gate (`:2908-2917`) becomes: first target is the lead, file access, and either the lead is `chief-of-staff` with no `workflow` snapshot, or the lead is a workflow whose `workflow.id` equals the target. Snapshots must still match listed members, never the lead, never `testRun` (`:2919-2930`). |
| D9 **Hand-off validation** | Unchanged mechanisms with the lead parameterised: a target off the copied list is refused (`:2877-2884`, `:3201-3204`); a tag from any step other than the lead is `refused: roster_reply` (`:3188-3190`); a workflow member's child copies its own snapshot and runs on its own model (`:2936-2948`, `:3231-3245`); `dispatch` keeps the loop check so each member runs once; `MAX_FRONT_DOOR_ROUNDS = 2` caps the rounds. `advisors_reply` stays for advisors runs. |
| D10 **Report-back for a workflow lead** | `needsReportBack`: source is the lead, target is not, lead run (`:2617-2625` generalised). Prompt from `buildReportBackPrompt` unchanged, with the member's label. **New rule in `rosterWorkflowFor`:** when the target is the lead and the first step's `workflow.id` equals the lead, return a copy of that first-step snapshot, so the report-back child's `workflowOfEntity` holds and the lead's grants (`:844`), budgets and tested state (`:1123`) and version stamp apply to its report-back step as to its first step. Without this the lead's second step would run as an unknown id with the default `read` profile and no scopes. Its provider and model come from the lead's first step as today. Failed member: no report-back, the run fails (DECISION C of the front door; FRONTDOOR-FAIL-REPORT-01 covers the alternative for both leads). Rejected report-back: the run completes on the member's answer. Settle and sweep (`:2036`, `:2605-2609`) follow `needsReportBack` and need no new code. |
| D11 **Limits** | Unchanged constants: depth 3, 4 agents, 8 hand-offs, 2 send-back rounds, 2 front-door rounds (`orchestration.contracts.ts:87-96`); team of at most 3 (`MAX_ROSTER_MEMBERS`), so lead + 3 = 4 listed agents (`handoff-request.ts:58-63`); with `user` counted, at most 2 members run in one run (stage-start D16). |
| D12 **Loops** | A workflow listing itself: 400 at save (D2), dropped at start (D7). Two workflows listing each other: in a run led by A, B is a one-step child with its own snapshot; B's `team_member_ids` is never read at run time (nothing in the run path reads the column; only `prepareStart` of the first step does), and B's tag is `refused: roster_reply`. A member that is itself on the Chief of Staff roster: the same. Team depth is 1 by construction; there is no recursion to bound. |
| D13 **Test runs** (DECISION B) | A test run of a lead with a team runs the team: the lead's snapshot carries `testRun: true`, members' snapshots `testRun: false` (`collaboration-roster.ts:433`), so a member's budgets and tested state are enforced at approve as in a real run, and a draft or untested member is skipped. One path, no special case; the owner sees the whole team before switching the lead on. Alternative: a test run runs the lead alone. |
| D14 **Prompt and version** (DECISION C) | The rendered workflow prompt does not change: the wrapper already lists "Other agents" with `- <name> (<label>): <summary>` and the request format for every role (`handoff-request.ts:143-160`; stage-start `:31`), and the report-back prompt tells the lead to write the final answer (`collaboration-front-door.ts:89-105`). So `workflowVersion` excludes the team (`collaboration-workflow.ts:190`), and changing the team never forces a re-test; the per-hand-off approval is the safeguard. Alternative: the team joins the version and a changed team needs a test run before the lead runs again. |
| D15 **Summary length** (DECISION F, control plane) | `evaluateWorkflow` cuts `summary` to `MAX_AGENT_SUMMARY_CHARS` (300) and `label` to `MAX_AGENT_LABEL_CHARS`; one line in a file 01A already edits. This also fixes the Chief of Staff start for a roster workflow with a long description (2.1). Verified by reading; a test pins it. Alternative: a separate tiny task. |
| D16 **Direct jobs (A8)** | Unchanged: an empty team is today's team of one (D6); coding and advisors starts, Agent mode and the bound-agent path are not touched; the front door keeps its tests. The 3.4 table of the front-door stage-start applies as is. |

### 3.3 Form and Team page

| # | Decision |
|---|---|
| D17 **Form** | `WorkflowAdvancedFields` gains a "Team" block after the model: a checkbox list from `options.teamChoices` without the row being edited, kind text (Advisor / Your workflow), a status note for draft and off rows, "{count} of 3", a fourth tick refused with a hint (the roster picker's pattern, `collaboration-view.tsx:380-470`), a hint that every hand-off waits for approval. The `<details>` opens when the team is non-empty. `WorkflowDraft.teamMemberIds`; `buildBlankBody` and `buildPatchBody` send `teamMemberIds` (PATCH always, so an emptied team saves). `sectionAdvanced` is reworded to "Advanced: model, budget and team". |
| D18 **Summary panel and list** | `agent-workflow-summary.tsx` adds one line "Team: <names>" or "Team: none". The Team page's workflow picker is unchanged. |
| D19 **Team page labels** | `isReportBackHandoff(source, target, leadId)` takes the run's lead (first entry of the detail's `agents`); the step label uses `reportBackStep` for the Chief of Staff and a new `reportBackStepLead` "{agent} → {lead} (report-back)" otherwise; the no-edit note (01C) applies to both. `roster.skipped` from a workflow start already renders the hint (`collaboration-page.tsx:642-652, :787`), but the names come from the roster view, which a workflow start does not load; 01C resolves a skipped member's name from the Team page's workflow list (`useCollaborationWorkflowList`) and the fixed advisor labels, falling back to `rosterMemberUnknown`. |
| D20 **Copy** | New keys in `platform.agentWorkflow` (team label, hint, count, limit, none, kinds, status notes, `summary.team`, `summary.teamNone`) and `collaboration.reportBackStepLead`; `sectionAdvanced` reworded; in en, zh-TW and zh-CN with real Chinese. No hardcoded English. |

### 3.4 Frozen contract

HARNESS_ENTITLEMENT_PROOF_V1 is **used, not changed**, in the 01B form (`docs/COS-FRONTDOOR-01B-CHECKPOINT.md:54-57`): no job key added or removed; `withHarnessEntitlementProof`, `startReferralExecution`'s payload, `src/ai/`, `job.types.ts`, `worker.processor.ts` untouched; `teamLeadId` lives in `pending_job` only. 01B edits `orchestration.service.ts` and therefore declares `sharedContractIds: [HARNESS_ENTITLEMENT_PROOF_V1]`, `mutatesSharedContractIds: []`, extends the key-set pins (a user lead's first step, a dispatch to a member and the report-back are signed with the same key set as a chief-of-staff job) and reports `git diff --stat main -- services/api-gateway/src/ai services/ai-service` empty. **No contract change is needed. No ai-service file changes** (no system-agent spec or hash changes). 01A and 01C leave `orchestration.service.ts` with an empty diff.

## 4. Files

### 01A — Team column and validation (GATEWAY, MIGRATION)

| File | Change |
|---|---|
| `services/api-gateway/src/migrations/1806000000000-AddUserAgentTeamColumn.ts` (new) + `migrations/__tests__/1806…spec.ts` (new) | D1 |
| `services/api-gateway/src/migrations/__tests__/1805000000000-CreateCollaborationRostersTable.spec.ts` | the "is the latest" line (`:59-69`) |
| `services/api-gateway/src/entities/user-agent.entity.ts` | `teamMemberIds` |
| `services/api-gateway/src/user-agent/dto/create-agent.dto.ts`, `dto/update-agent.dto.ts` | `teamMemberIds?: string[]` (array, at most 3, strings of 1 to 64 chars) |
| `services/api-gateway/src/user-agent/user-agent.service.ts` + `__tests__` | D2 validation in `validateWorkflow`; `teamMemberIds` saved on create and update |
| `services/api-gateway/src/user-agent/user-agent.controller.ts` + spec | D3 `teamMemberIds` on responses, `teamChoices` on options |
| `services/api-gateway/src/orchestration/collaboration-roster.ts` + `.spec.ts` | `assertRosterMemberIds`, `ROSTER_MEMBER_SELF`, `evaluateMembers(userId, ids)` with `membersForStart` on top of it (D6), summary and label cut (D15) |
| `services/api-gateway/src/orchestration/collaboration-workflow.ts` | `WorkflowRow` gains `teamMemberIds`; `PreparedWorkflowStart.teamMemberIds` (ids only; the controller ignores it until 01B) |

Not changed: `orchestration.service.ts` (empty diff), `collaboration.controller.ts`, `collaboration-front-door.ts`, the registry, ai-service, frontend.

### 01B — Team runs with report-back (GATEWAY)

| File | Change |
|---|---|
| `services/api-gateway/src/orchestration/orchestration.contracts.ts` | `teamLeadId` on `ReferralPendingJob` (D4) |
| `services/api-gateway/src/orchestration/collaboration-front-door.ts` + `.spec.ts` | D5 lead parameter, `teamAgentList`, `leadIdOf` |
| `services/api-gateway/src/orchestration/orchestration.service.ts` | D4 set and copy `teamLeadId`; D5 lead reads; D8 gate; D10 lead snapshot on the report-back child |
| `services/api-gateway/src/orchestration/collaboration.controller.ts` + `.spec.ts` | D6 `workflowStartPlan` with members, `roster` on workflow starts |
| `services/api-gateway/src/orchestration/internal-collaboration.controller.spec.ts`, `orchestration/__tests__/*` | section 6; key-set pins |

Not changed: `services/api-gateway/src/ai/`, ai-service, `collaboration-roster.ts` beyond what 01A did, `collaboration-send-back.ts`, `collaboration-results.ts`, `system-agent-registry.ts`, frontend.

### 01C — Form and Team page (FRONTEND, I18N)

| File | Change |
|---|---|
| `frontend/components/platform/agent-workflow-fields.tsx`, `agent-workflow-model.ts`, `create-agent-form.tsx`, `agent-workflow-summary.tsx` + their tests (`agent-workflow-editor.test.tsx`, `agent-workflow-summary.test.tsx`) | D17, D18 |
| `frontend/components/collaboration/collaboration-roster.ts`, `collaboration-page.tsx` + `collaboration-workflows.test.tsx` | D19 |
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | D20 |
| `frontend/hooks/useUserAgents.ts` | `teamMemberIds` on the agent type and the options type (`teamChoices`); nothing else in the hook |

Not changed: `frontend/components/workspace/`, `frontend/components/office/`, `frontend/app/`, the other hooks, `frontend/lib/collaboration/logic.ts` and `api.ts`.

**Registered provisional scope:** the body sets no write set; every file above is set at admission, per slice, EXACT.

## 5. Write set, mutexes, lifecycle

| Item | 01A | 01B | 01C |
|---|---|---|---|
| Mutexes | GATEWAY, MIGRATION | GATEWAY | FRONTEND, I18N |
| PACKAGE | no | no | no |
| Hot files | none | none | none |
| Shared contracts | none touched (`orchestration.service.ts` and the four frozen paths: empty diff) | HARNESS_ENTITLEMENT_PROOF_V1 read, not mutated (3.4) | none |
| Revert isolation | migration down; nothing runs a team until 01B (the controller ignores `teamMemberIds`) | the lead parameterisation; with an empty team the old path runs; a chief-of-staff run before the change still reads as a front-door run (D4 fallback) | the form and labels; the column and routes stay callable |
| Evidence class | LOCAL-TESTS | LOCAL-TESTS | LOCAL-TESTS |
| Lifecycle | 4-STEP: registration (done), this stage-start, implementation (three slices, each LANE-DONE and LOCK), consolidation per slice | | |
| Order | first | after 01A LOCK (uses `evaluateMembers`, `teamMemberIds`) | after 01A LOCK (uses `teamMemberIds`, `teamChoices`); D19 uses the detail's `agents`, which exists since 01B of the front door |
| Deploy | STAGING-DEPLOY-FD-02 becomes a migrating deploy (1806): pre-migration backup, new migration hash | | |

## 6. Tests and gates

**01A, gateway.** Migration spec: 1806 is the latest and after 1805; up refuses when the column exists; down refuses when it is absent; mocked. Service: create and PATCH save `teamMemberIds`; PATCH with `teamMemberIds: []` empties it; 400 with a stable code for a fourth id, a repeat, the row itself, an unknown system id, `chief-of-staff`, `advisors-lead`, a coding id, another owner's row and a deleted row, and nothing is saved; a draft or off member is accepted at save (checked at start); a PATCH that only changes the team on an active row does not run the switch-on check and does not change the version. Controller: responses carry `teamMemberIds`; `options.teamChoices` lists the two advisors and the owner's rows only, without another owner's. Roster: `membersForStart` unchanged behaviour (existing 20 tests); `evaluateMembers` with an explicit list; a 2000-char description yields a 300-char summary and the agent list is accepted by `readCollaborationAgents`.

**01B, gateway.** Start: a workflow with team `[product-strategy, <wf2>]` stores a 3-entry list with the lead labelled, `teamLeadId` = the row id, `workflow` = the lead's snapshot, `rosterWorkflows` with one snapshot, `roster.used`; a draft, off, untested or self member is in `roster.skipped`; an empty team stores exactly today's one-entry job (byte compare) and no `teamLeadId`; a test run stores `testRun: true` on the lead and `false` on members; the session-less start works. Hand-offs: the lead's tag to a listed workflow creates a waiting child with that member's snapshot and model; approve on it runs `assertCanApprove`; a member's tag is `refused: roster_reply`; a target off the list is `refused: agent_not_on_list`. Report-back: completing the member creates one `pending_approval` hand-off member → lead, key `report-back:<id>`, no depth or loop refusal, the child's `workflowOfEntity` is the lead's snapshot (grants, budgets, version stamp asserted), provider and model the lead's; idempotent; recovered by the sweep; settle waits; a second member round allowed, a third refused; the lead's answer is last and `finalAnswerOf` returns it; a rejected report-back completes on the member's answer; a failed member fails the run. Front door: every COS-FRONTDOOR-01B test unchanged (the 25 of `docs/COS-FRONTDOOR-01B-CHECKPOINT.md:63`), plus one that a pre-change row without `teamLeadId` still classifies as a front-door run. A body with `teamLeadId` or `rosterWorkflows` on a child is refused (internal route too). Key-set pins extended (3.4).

**01C, frontend.** Editor: the team block lists `teamChoices` without the edited row, a fourth tick is refused with the hint, the body carries `teamMemberIds` on create and on PATCH (and `[]` when emptied), the details open when a team is set; existing test IDs kept. Summary: the team line with names and with none. Team page: a step to a workflow lead reads "{agent} → {lead} (report-back)" with no Edit; the Chief of Staff label unchanged; the skipped hint renders after a workflow start. Key parity in three languages with real Chinese.

| Area | Command | Compare with |
|---|---|---|
| api-gateway | `npx jest --maxWorkers=2`, then `npm run build` | 3500 passed, 7 skipped, plus the 14 known `smoke.integration` failures; each slice moves the count by its new tests only |
| ai-service | not touched; `npx jest --runInBand` only if a file under `services/ai-service` changes (it must not) | 1296 passed, 1 skipped |
| frontend | `npx tsc --noEmit`, `npm test`, `npm run build`, then `git restore -- frontend/tsconfig.tsbuildinfo` | 1573 passed |
| files | changed files are LF; 01A and 01C: `git diff --stat main -- services/api-gateway/src/orchestration/orchestration.service.ts services/api-gateway/src/ai services/ai-service` empty; 01B: `git diff --stat main -- services/api-gateway/src/ai services/ai-service` empty | |

Checklists on each checkpoint (`docs/control-plane/task-checklists.md`): EVERY, BACKEND (01A, 01B), MIGRATION (01A), UI (01C). FLOWS n/a. Skills before UI work: `.agents/skills/impeccable`, `.agents/skills/emil-design-eng`; DESIGN.md applies (the roster picker's checkbox, hint and count patterns).

## 7. Implementer model (GOV-ROUTING-01)

| Slice | Model | Why |
|---|---|---|
| 01A | **opus** (Opus 5.5) | a migration and owner-scoped validation across two folders |
| 01B | **opus** (Opus 5.5) | the orchestration state machine in a frozen-path file; the design is settled so the work is bounded; re-dispatch on fable if opus stops twice on the lead parameterisation |
| 01C | **sonnet** (Sonnet 5.5) | frontend-only form and labels with copy in three languages, no auth or contract change |

## 8. Split and order

| Slice | Delivers | Lockable alone because |
|---|---|---|
| **01A** column and validation | migration 1806, entity, DTOs, save-time rule, responses, `teamChoices`, `evaluateMembers`, summary cut | nothing reads the column at run time yet; the routes are owner-scoped and complete |
| **01B** team runs | lead marker, lead parameter, team start, report-back to a workflow lead, rounds | with an empty team the run is today's run; the front door is unchanged and pinned |
| **01C** form and page | team block, summary line, lead label, copy | pure UI over 01A's fields and the existing detail `agents` |

Order 01A → 01B → 01C. 01A and 01B both hold GATEWAY, so one lane in sequence. 01C depends on 01A only and holds FRONTEND and I18N, so it may run in Lane 2 beside 01B if the validator admits the pair; otherwise after 01B. The control plane registers 01B and 01C as USER-TEAMS-01B and USER-TEAMS-01C (the COS-FRONTDOOR pattern) with USER-TEAMS-01 as 01A.

## 9. Admission

Both lanes are EMPTY, GOVERNANCE UNOWNED (`TASKS.md:2-13`); the tester window is CLOSED (`TASKS.md:828-829`). USER-TEAMS-01 depends on COS-FRONTDOOR-01 (LOCKED 2026-11-10, `TASKS_BACKLOG_FULL.md:86875`); the whole front door is deployed and live-checked (`docs/FRONTDOOR-LIVE-01-CHECKPOINT.md:4`). Start condition "Keith decides": this approval. On approval the control plane sets the EXACT write sets and mutexes per slice (section 5), registers 01B and 01C, and admits 01A to Lane 1 with GATEWAY and MIGRATION. Lane 2 may take a LOCAL-TESTS task that holds none of the slice's mutexes.

## 10. Follow-ups (named here, disposed at the LOCKs)

1. **STAGING-DEPLOY-FD-02** carries migration 1806 (migrating deploy: pre-migration backup, new migration hash): a line in its body.
2. **A live check of a user team on staging** (Keith, three languages): save a team of one advisor and one workflow on a workflow; run it; approve the dispatch and the report-back; the final answer is the lead's and Results shows it; a draft member is skipped with the hint; a workflow with an empty team runs as before; the Chief of Staff front door unchanged. Keith registers it NOT_READY (USER-TEAMS-LIVE-01) or folds it into STAGING-DEPLOY-FD-02's acceptance.
3. **APPROVAL-SET-01**: its approval setting is a column beside `team_member_ids` on `user_agents`, and the approve path reads it by the run's lead (`teamLeadId`): one line in its body (`TASKS_BACKLOG_FULL.md:87034` already names "user_agents and teams columns").
4. **FRONTDOOR-FAIL-REPORT-01**: a failed member's report-back applies to a workflow lead as well: one line in its body.
5. **ARCHITECTURE.md 13.1**: one line at 01B's LOCK that user teams are built and not deployed; **PRD.md** wording moves at the live check (plan section 7 pattern). Control plane.

## 11. Stop conditions for the implementer

STOP and report if:
- a job key would be added or removed, or `withHarnessEntitlementProof`, `startReferralExecution`'s payload shape, `job.types.ts`, `worker.processor.ts`, anything under `services/api-gateway/src/ai/` or any ai-service file would change;
- the team, a snapshot, `teamLeadId`, instructions, model, scopes or tool profile would be read from a request body on a hand-off, or a hand-off target would be accepted that is not on the run's stored agent list;
- a step whose target is not the run's lead would be allowed to request a hand-off in a team run, or a member's own team would be read at run time;
- a report-back or dispatch would be created without `pending_approval`, or any step would be approved without the owner;
- `DEFAULT_MAX_REFERRAL_DEPTH`, `DEFAULT_MAX_AGENTS_PER_COLLABORATION`, `MAX_HANDOFFS_PER_RUN`, `MAX_SEND_BACK_ROUNDS`, `MAX_FRONT_DOOR_ROUNDS` or `MAX_ROSTER_MEMBERS` would change, or a third round would be possible;
- the Chief of Staff front door, a coding or advisors start, a direct workflow start with an empty team, Agent mode or the bound-agent path would change behaviour, or any COS-FRONTDOOR-01B test would need a change;
- a guard, the session cookie, CSRF, the internal key, the entitlement check or the 404-for-another-owner rule would change;
- `workflowVersion` would change (D14), a system-agent pin would change, or the Chief of Staff spec would need a new paragraph;
- a migration other than 1806 (01A), an entity change outside `teamMemberIds`, a change to `collaboration_rosters`, or a new dependency seems needed;
- the report-back child of a workflow lead would run without the lead's snapshot (D10);
- a file outside the slice's write set would change;
- a gate fails outside the 14 known smoke failures.

## 12. Approval

Approved 2026-11-11. Keith ("Yes, approve"): A a team_member_ids column on user_agents saved with the form (migration 1806); B a test run of a lead runs its team; C the team is not part of workflowVersion; D members follow the Chief of Staff roster rule (two advisors and the owner's other workflows, at most 3). Control plane: E teamLeadId on pending_job, server-set; F the 300-character summary cut fixed in 01A. Slices: USER-TEAMS-01 = 01A (this admission: GATEWAY, MIGRATION; opus), USER-TEAMS-01B (GATEWAY; opus) and USER-TEAMS-01C (FRONTEND, I18N; sonnet), in that order; 01C may run beside 01B if the validator admits the pair.

Original draft text of this section:


Pending. Product decisions are Keith's; E and F are the control plane's, recommended as below.

| ID | Choice | Recommendation |
|---|---|---|
| DECISION A | Where a workflow's team is stored: a `team_member_ids` column on `user_agents` saved with the form (migration 1806), or a separate table keyed by workflow. | **The column.** The team is a form part saved with the rest of the workflow; one migration either way; no second entity. |
| DECISION B | Test runs: a test run of a lead with a team runs the team, or the lead alone. | **Runs the team.** One code path; the owner sees the whole team before switching on; members keep their own budgets and tested-state checks. |
| DECISION C | Whether the team is part of the workflow's version (a changed team needs a new test run). | **Not part of the version.** The prompt the owner wrote does not change; every hand-off is approved anyway; adding a member never blocks a working workflow. |
| DECISION D | Who may be a member: the Chief of Staff rule (two advisors and the owner's other workflows, at most 3), or workflows only. | **The Chief of Staff rule.** Same validation, same reasons, same Team page labels; nothing new to explain. |
| DECISION E (control plane) | The lead-run marker: `teamLeadId` on `pending_job` set by the server, or deriving the lead from the first step's snapshot in every reader. | **`teamLeadId`.** One field, set once, copied with `agents`; readers stay simple; pre-change rows fall back to the chief-of-staff rule. |
| DECISION F (control plane) | The 300-char summary refusal on roster workflows (2.1): fix in 01A by cutting the summary, or a separate tiny task. | **Fix in 01A.** One line in a file 01A edits; it blocks user teams and the front door alike. |

Settled by the approved plan, not asked again: every hand-off waits for approval (A5 default; APPROVAL-SET-01 later); depth 3, 4 agents and the daily caps stay (A5); direct jobs stay (A8); the team sits under Advanced in the form (A9 part 7); session-less read-only runs use the business session (TEAM-NO-SESSION-02).
