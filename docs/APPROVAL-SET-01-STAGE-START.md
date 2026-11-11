# APPROVAL-SET-01 — Stage-start

**Task:** APPROVAL-SET-01 — Approval setting per team or workflow (plan row 36, `docs/AGENT-OPS-PLAN.md:54`; section 3.2 `:195`; A5 `:156`; A9 part 8 `:160`, `:242`; D4 `:264`; section 7 row `:306`)
**Status:** STAGE-START — APPROVED 2026-11-11. Drafted read-only by a fable subagent (Fable 5.1). Keith approved the plan and DECISIONs A to D with the recommendations ("Yes, approve both"): A two columns on user_agents (approval_mode default every, approval_credit_limit; migration 1807); B "only over X credits" estimated from the target's last completed step cost in the owner's runs, unknown waits; C the setting applies in a test run; D workflow leads only, the Chief of Staff roster setting registered as APPROVAL-SET-02. Control plane: E auto approvals recorded with decidedBy = owner and decisionReason auto:..., shown as "Approved automatically". Slices: APPROVAL-SET-01 = 01A (this admission: GATEWAY, MIGRATION; opus), APPROVAL-SET-01B (GATEWAY; opus) and APPROVAL-SET-01C (FRONTEND, I18N; sonnet).
**Registered body:** `TASKS_BACKLOG_FULL.md:87095-87119` (4-STEP, LOCAL-TESTS, OPTIONAL, APPROVED_FUTURE, depends on USER-TEAMS-01 (LOCKED 2026-11-11), write set "set at admission", PROVISIONAL, NOT_READY until Keith decides). Body note from the USER-TEAMS-01 approval (`:87119`): the setting is a column beside `team_member_ids` on `user_agents`, read by the run's lead (`pending_job.teamLeadId`). Sidecar candidate `lane-saturation-state.json:4893-4910` (mutexes and writePaths empty). COS-DRAFTS-01 depends on this task (`:87133`); STAGING-DEPLOY-FD-02 deploys it (`:88444-88445`).
**History:** reverses, for auto-approval only, the 2026-11-05 drop "auto-approved plans" (`TASKS_BACKLOG_FULL.md:89870`); the reversal line is `:89888`. Free agent messaging and agents claiming tasks stay dropped.
**Model:** `docs/USER-TEAMS-01-STAGE-START.md` (approved 2026-11-11) and the USER-TEAMS-01, -01B, -01C and COS-FRONTDOOR-01B checkpoints.
**Proposed shape:** three bounded slices, each locked on its own: **01A** columns and validation, **01B** the server's auto-approve path, **01C** form, summary and Team page. Section 8.

## 1. Goal

The owner of a workflow with a team chooses how its hand-offs are approved: every hand-off waits (today, and the default); hand-offs at or under a credit amount run without waiting; or hand-offs to read-only agents run without waiting. Nothing that can write, send or delete is ever automatic, whatever the setting says. Depth 3, 4 agents, 8 hand-offs, 2 rounds and the budgets stay. Every automatic approval is recorded like a manual one and shown on the Team page. The server decides; the browser only saves the setting.

## 2. What is true today

Verified by reading on 2026-11-11 at main 3fada70d.

### 2.1 The approval gate

| Fact | Where |
|---|---|
| Every hand-off is created at `pending_approval` with `decidedBy: null` and `decisionReason: null` in `pending_job`; `teamLeadId` sits beside them. There is one creation function, `createPendingReferral`. | `orchestration.service.ts:1048-1096` (`:1080-1081`, `:1088`) |
| `approveReferral` refuses any status but `pending_approval`, requires the proof secret for file-access jobs, runs `assertCanApprove` on the step's workflow snapshot (row exists, not off, draft only in a test run, budgets), then `assertHandoffAllowed` (kill switch, safety, abort, credit balance, token quota), then the tests gate (login route only), claims the row with a conditional update, writes `decidedBy`, emits `orchestration.referral_approved` and enqueues. | `orchestration.service.ts:1100-1198`; `:1115-1120`; `:1124-1131`; `:1133-1148`; `:1151-1168`; `:1173-1187`; `:1848-1905`; `collaboration-workflow.ts:455-479` |
| `DecideReferralInput` carries `decidedBy`, an optional `reason` (used by reject into `decisionReason`), `enforceTestsGate`, `approveWithoutPassingTests`. The login route sets `decidedBy = caller.userId`; the internal route takes it from the body. | `orchestration.service.ts:253-261`, `:1222`; `collaboration.controller.ts:398-437` (`:413-414`); `internal-collaboration.controller.ts:74-91`, `:201-208` |
| The server creates two kinds of child in a team run: the lead's dispatch to a listed member (`requestHandoffFromAnswer`; a non-lead tag is `refused: roster_reply`) and the member's report-back to the lead (`reportBackFromAnswer`). Both call `createPendingReferral`. The first hand-off of a run is created by the start route from the owner's click. | `orchestration.service.ts:3205-3330` (`:3244-3247`, `:3295`); `:2629-2639`, `:2679-2762` (`:2727`); `collaboration.controller.ts:281-302` |
| `leadIdOf(job)` = `teamLeadId` when it is the first listed agent, else `chief-of-staff` for a pre-change front-door list, else null. Coding and advisors runs have no lead. | `collaboration-front-door.ts:58-70`, `:84-99` |
| The step's signed tool profile comes from the registry (`read`, `review`, `write`); an id not in the registry, or one with profile null (`builder`), falls back to `read`. A workflow job must be `read` with `harnessReadOnly` or enqueue throws. Writer is `write`, reviewer `review`, lead and all business roles `read`; the Chief of Staff lists the two connector tools. | `collaboration-tool-profile.ts:9`, `:44-52`, `:53-70`; `orchestration.service.ts:3100-3102`, `:871`; `system-agent-registry.ts:24`, `:374`, `:388`, `:402`, `:416`, `:430-431`, `:444`, `:458`, `:472` |
| The worker gives write tools to `write` and `agent-write` and validation tools (commands) to `review` and `write`; `read` gets neither. Agent mode (`POST /api/ai/execute`) picks `agent-write` or `read` itself and is not a collaboration referral. | `services/ai-service/src/worker/worker.processor.ts:553-556`, `:1787-1817`; `services/api-gateway/src/ai/ai-execution.controller.ts:767-773` |
| Referral constraints are read-only with no write tools, checked at creation and at enqueue. | `orchestration.service.ts:2094-2104`, `:1717-1723`; `orchestration.contracts.ts:100` |
| Connector tools: `mail_list_unread_metadata` and `calendar_list_today`; `ConnectorToolDefinition` has no read-only flag. User workflows may only hold the `read` profile. | `connectors/connector-servers.ts:23-24`, `:26-36`; `user-workflow-grants.ts:15` |
| Audit events go through `emitAuditEvent` to `audit_events`; the type list has no auto-approval type; refusals use `safety_limit_breached` with a `lifecycleEvent`. | `orchestration.service.ts:2415-2441`, `:3347-3371`; `orchestration.contracts.ts:254-269`; `ARCHITECTURE.md:226` |
| Limits: depth 3, 4 agents, 8 hand-offs, 2 send-back rounds, 2 front-door rounds. | `orchestration.contracts.ts:87-96` |

### 2.2 Credits and estimates

| Fact | Where |
|---|---|
| There is no per-step pre-run cost estimate. The credit guard uses `estimatePreExecutionTokens`: 60,000 tokens for any harness job, else 8,000 or twice the prompt's tokens; credits = ceil(tokens / 1000). `assertHandoffAllowed` passes `{prompt, provider}` with no `harnessVersion`, so hand-offs are checked at about 8 credits. Platform models cost 1 credit per 1K tokens. | `quota/quota.config.ts:55`, `:140-160`, `:167-177`; `billing/credit-balance.guard.ts:80-81`; `orchestration.service.ts:1862-1865`; `system-agents/platform-models.ts:25-30` |
| Budgets are enforced after the fact: per day = today's deductions of the workflow's steps; per run = the last completed run's deductions. `usageFor` reads the workflow's own referrals (`pendingJob.workflow.id`) in the owner's runs and their `credit_deduction_records` by `executionId` (`requestedCredits`). A system advisor has no budget and no usage read. | `collaboration-workflow.ts:286-321`, `:519-604` (`:528`, `:580-599`) |

### 2.3 The workflow row, form and page

| Fact | Where |
|---|---|
| `user_agents` holds `tool_profile` (read), two budgets, `team_member_ids` (migration 1806). The 1806 spec asserts 1806 is the latest migration. Budget DTO fields: `@IsInt @Min(1) @Max(MAX_USER_WORKFLOW_BUDGET_CREDITS)` (1,000,000); `teamMemberIds` at most 3. | `entities/user-agent.entity.ts:69-70`, `:81-85`, `:93-94`; `migrations/1806000000000-AddUserAgentTeamColumn.ts:1-30`; `__tests__/1806…spec.ts:52-64` (`:63`); `dto/update-agent.dto.ts:119-128`, `:136-140`; `dto/create-agent.dto.ts:29` |
| `UserAgentService.validateWorkflow` validates the merged fields, `validateTeam` applies the roster rule; a team-only PATCH runs no switch-on check; responses carry `teamMemberIds`; `GET /api/agents/options` has `teamChoices` and `limits`. | `user-agent.service.ts:194`, `:310`, `:323`, `:382`, `:479`, `:503-511`; `user-agent.controller.ts:111`, `:153`, `:190-222` |
| The Advanced `<details>` holds model, budgets and the Team fieldset, whose last hint says every hand-off waits for approval (`teamApprovalHint`). `WorkflowDraft.teamMemberIds`; `buildBlankBody` / `buildPatchBody`; the summary has a team line. | `agent-workflow-fields.tsx:360-549` (`:407`, `:492-547`, `:543-545`); `agent-workflow-model.ts:33-50`, `:218-237`, `:257-275`, `:332`; `agent-workflow-summary.tsx:107-135`; `en.json:755`, `:858-859`; `zh-TW.json:859`; `zh-CN.json:859` |
| The Team page card shows "Decided by: <decidedBy>" raw, the Approve button, status "Waiting for you"; `CollaborationHandoffView` and the frontend type carry `decidedBy` and `handoffNote`. | `collaboration-view.tsx:48-49`, `:1020-1024`, `:1165-1182`; `collaboration-page.tsx:415-416`, `:728-730`, `:919-929`; `collaboration.controller.ts:120-135` (`:128`), `:1068`; `frontend/lib/collaboration/api.ts:4-13`; `en.json:1222-1223`, `:1245` |
| The Chief of Staff roster: one row per owner (`collaboration_rosters`, PK `user_id`, `member_ids`), `GET/PUT /api/collaboration/roster`. | `collaboration-roster.entity.ts:11-19`; `collaboration-roster.ts:167`, `:210-219`; `collaboration-roster.controller.ts:29-46` |
| PRD: approval gates are approved FUTURE; user workflows and teams are approved FUTURE. ARCHITECTURE 13.1 has the OrchestrationService, front-door and user-teams rows. HARNESS_ENTITLEMENT_PROOF_V1 is FROZEN over `ai-execution.controller.ts`, `job.types.ts`, `worker.processor.ts`, `orchestration.service.ts`. | `PRD.md:479`, `:623`; `ARCHITECTURE.md:1041`, `:1048-1049`; `lane-saturation-state.json:7365-7373` |

## 3. Design

### 3.1 Storage and shape (DECISION A)

| # | Decision |
|---|---|
| D1 **Columns** | Two columns on `user_agents`, migration `1807000000000-AddUserAgentApprovalColumns` in the 1806 pattern (probe `information_schema.columns`; up refuses when either exists; one `ALTER TABLE` adds both; down drops both and loses settings only): `approval_mode varchar(16) NOT NULL DEFAULT 'every'`, `approval_credit_limit integer NULL`. Entity `approvalMode: UserWorkflowApprovalMode`, `approvalCreditLimit: number | null`. The 1806 spec's "is the latest" line (`:63`) moves to the `<` form. **MIGRATION mutex.** Alternative: one jsonb column; rejected, two typed columns validate in SQL and read like the budgets. |
| D2 **Values** | `every` (default; today's behaviour), `credits` (hand-offs at or under `approvalCreditLimit` run without waiting), `read_only` (hand-offs to read-only agents run without waiting). Exported as `USER_WORKFLOW_APPROVAL_MODES` in `user-agent/user-workflow-rules.ts`. DTOs: `@IsIn(modes) approvalMode?`, `@IsInt @Min(1) @Max(MAX_USER_WORKFLOW_BUDGET_CREDITS) approvalCreditLimit?: number | null` (the budget validators, `update-agent.dto.ts:119-128`). Service: `credits` without a limit is 400 `APPROVAL_LIMIT_REQUIRED`; a limit with another mode is stored as null; an absent field keeps the stored value. Responses carry both; `options.limits` gains nothing (the max is the budget max already there). |
| D3 **Version** (control plane) | Not part of `workflowVersion` (`collaboration-workflow.ts:196`), like the team (USER-TEAMS-01 D14): the prompt does not change and a re-test would prove nothing about approval. A setting-only PATCH on an active row runs no switch-on check (`user-agent.service.ts:323` pattern). |

### 3.2 Who may run without waiting (DECISIONS B, C, D)

| # | Decision |
|---|---|
| D4 **Where the decision is made** | In the two server paths only, right after `createPendingReferral` returns: `requestHandoffFromAnswer` (`:3295`) and `reportBackFromAnswer` (`:2727`) call a new private `maybeAutoApprove(referral, run)`. The first hand-off of a run (the owner's click, `collaboration.controller.ts:281-302`) and referrals created through the internal route never reach it. Unattended starts are TRIGGER-01's question, not this task's. |
| D5 **The lead's setting** | `leadIdOf(job)` must be a workflow row id (not `chief-of-staff`, section 3.5); the row is read live with `findOneByIdAndUserId(leadId, run.userId)`; missing, another owner's, `disabled`, or `approvalMode === 'every'` → the step waits. Live read, not a snapshot: a tightened setting applies to the next step at once. |
| D6 **Fail-closed capability rule** | The step waits unless the target is positively read-only: (a) a system agent whose registry `toolProfile === 'read'` (null → waits, so `builder` never qualifies; `writer`, `reviewer` never qualify), or (b) a workflow with a snapshot in this run (`rosterWorkflowFor`, or the lead's own snapshot on a report-back; `USER_WORKFLOW_TOOL_PROFILES` is `['read']`); and every connector tool the target may be granted is read-only: `ConnectorToolDefinition` gains `readOnly: true` (both tools today), and any tool without it, or any id not in the allowlist, → waits. The coding team cannot be a lead or a member (`isRosterSystemCandidate`), Agent mode is not a referral, and the constraints check (`:2094-2104`) still runs. A future send or write tool (ACTIONS-APPROVAL-01, CONN-DRAFT-01) is refused by the flag, not by a list. |
| D7 **"Only over X credits"** (DECISION B) | Estimate = the target's last completed step in the owner's runs: a generalisation of `usageFor` (`:519-604`) as `lastStepCreditsFor(userId, targetProfileId)` without the `pendingJob.workflow.id` filter (`:528`): the latest completed referral with that target and an `executionId`, summed over its `credit_deduction_records.requestedCredits`. No such step, or no deduction row → `null` → the step waits (`unknown_cost`). Auto when `estimate <= approvalCreditLimit` and D6 holds. The platform pre-run estimate (60 credits flat for harness jobs, 2.2) is not used: it is not per agent. |
| D8 **Then the real approve** | `maybeAutoApprove` calls the existing `approveReferral({ decidedBy: run.userId, decisionReason: 'auto:<mode>[:<estimate>/<limit>]' })` (one new optional field on `DecideReferralInput`, written where reject writes `reason`, `:1222`). So every check a click runs still runs: proof secret, `assertCanApprove` (the member's own snapshot on a dispatch, the lead's on a report-back: USER-TEAMS-01B D10), kill switch, safety, abort, credit balance, token quota. Any exception → caught, logged without contents, the step stays `pending_approval` (`checks_failed`). The conditional claim (`:1151-1168`) makes a race with the owner's click harmless. The sweep's recovery of a hand-off also passes through the same two functions, so a Gateway restart changes nothing. |
| D9 **Test runs** (DECISION C) | The setting applies in a test run as in a real one (one path; the owner sees what will run unattended before switching on; USER-TEAMS-01 D13 runs the team in a test). Alternative: a test run always waits. |
| D10 **Limits** | Unchanged constants (`orchestration.contracts.ts:87-96`), `MAX_ROSTER_MEMBERS`. An auto-approved chain is still capped: 2 front-door rounds, 8 hand-offs, the lead's budgets on its report-back steps, each member workflow's budgets on its dispatch, the account's credit balance and token quota on every step. A system advisor has no budget of its own (2.2); under `credits` its estimate is the cap, under `read_only` only the account guards cap it. This is stated to Keith in 3.6 copy, not hidden. |

### 3.3 Audit and display (DECISION E, control plane)

| # | Decision |
|---|---|
| D11 **Record** | `pending_job.decidedBy = run.userId`, `decisionReason = 'auto:read_only'` or `'auto:credits:<estimate>/<limit>'`; the `orchestration.referral_approved` payload gains `autoApproval: { mode, estimateCredits, creditLimit }`. When the lead's mode is not `every` and the step waits anyway, `pending_job.autoApproval = { outcome: 'waiting', reason }` with reason `writes`, `unknown_cost`, `over_limit`, `checks_failed` or `lead_missing`, and one `safety_limit_breached` audit event with `lifecycleEvent: 'auto_approval_declined'` (`auditAnswerRefusal` pattern, `:3347-3371`). Both fields live in `pending_job`, orchestration-internal like `teamLeadId`; no new audit event type. |
| D12 **View** | `CollaborationHandoffView` gains `autoApproved: { mode, estimateCredits } \| null` and `autoApprovalWaiting: reason \| null`, derived from `decisionReason` and `pending_job.autoApproval` in `toHandoff` (`collaboration.controller.ts:1040-1086`). The Team page shows "Approved automatically: read-only agent" or "Approved automatically: about N credits, under your limit of M" in place of the raw "Decided by" line, and under "Waiting for you" a small reason line ("Waits: this agent can change files" and so on). No new control; the Approve and Reject buttons are unchanged. |

### 3.4 Enforcement, not UI

The browser saves `approvalMode` and `approvalCreditLimit` through the owner-scoped PATCH it already uses (`user-agent.controller.ts`), validated by the DTO and `validateWorkflow`. Nothing else is accepted from a body: `maybeAutoApprove` reads the lead row, the registry, the run's stored snapshots and the deductions table. A client that calls the approve route still goes through `assertEntitled`, `requireOwnedRun` and the same `approveReferral`. The internal approve route is unchanged (`internal-collaboration.controller.ts:74-91`).

### 3.5 The front door (DECISION D)

The Chief of Staff lead has no `user_agents` row; its team is `collaboration_rosters` (one row per owner, 2.3). **Recommendation: this task covers workflow leads only; a Chief of Staff run keeps "every hand-off"; a roster-level setting is registered as APPROVAL-SET-02, NOT_READY, Keith decides.** Why: the front door is deployed and live-checked (`ARCHITECTURE.md:1048`); the body note names `user_agents`; a second table in the migration widens STAGING-DEPLOY-FD-02; and the Chief of Staff is the one agent holding connector tools, so Keith may want to see read-only auto-approval work on a workflow first. Alternative: add `approval_mode` and `approval_credit_limit` to `collaboration_rosters` in migration 1807 as well, a PUT body field, and D5 reads the roster row when `leadIdOf` is `chief-of-staff`; one more slice (roster picker UI) or folded into 01C.

### 3.6 Form, summary and Team page copy

| # | Decision |
|---|---|
| D13 **Form** | `WorkflowAdvancedFields` gains an "Approval" fieldset after Team (`agent-workflow-fields.tsx:547`): three radios (every / credits with a number input / read-only), a hint "Agents that can change files, send or delete always wait for you, whatever you choose here", and when the team is empty a note that the setting has no effect without a team. `teamApprovalHint` (`:543-545`) becomes mode-aware: today's text for `every`; otherwise "Read-only hand-offs within your limit run without waiting; everything else waits for you". `WorkflowDraft.approvalMode`, `approvalCreditLimit` (string, parsed like the budgets); `buildBlankBody` and `buildPatchBody` send both (PATCH always); a limit is required for `credits` (`errors.approvalLimitInvalid`). `sectionAdvanced` reworded to "Advanced: model, budget, team and approval". The `<details>` opens when the mode is not `every`. |
| D14 **Summary** | `agent-workflow-summary.tsx` adds "Approval: every hand-off" / "over N credits" / "automatic for read-only agents" (`summary.approval*`). |
| D15 **Team page** | D12's two lines (`collaboration.autoApprovedReadOnly`, `autoApprovedCredits`, `autoApprovalWaiting.<reason>`); existing test IDs kept; `collaboration-approve-<id>` unchanged. |
| D16 **Copy** | New keys under `platform.agentWorkflow` (`approvalLabel`, `approvalHint`, `approvalEvery`, `approvalCredits`, `approvalCreditsLimit`, `approvalReadOnly`, `approvalNever`, `approvalNoTeam`, `teamApprovalHintAuto`, `summary.approval`, `summary.approvalEvery`, `summary.approvalCredits`, `summary.approvalReadOnly`, `errors.approvalLimitInvalid`, `errors.approvalLimitRequired`) and `collaboration.autoApproved*`, `collaboration.autoApprovalWaiting.*`; in en, zh-TW and zh-CN with real Chinese; the three files keep identical key sets. No hardcoded English. |

### 3.7 Frozen contract

HARNESS_ENTITLEMENT_PROOF_V1 is **used, not changed**: no job key is added or removed; `withHarnessEntitlementProof` (`:3139`), `startReferralExecution`'s payload (`:852-884`), `collaboration-tool-profile.ts`, `src/ai/`, `job.types.ts`, `worker.processor.ts` and ai-service are untouched. `decisionReason` and `autoApproval` live in `pending_job` only and never reach the enqueued job. 01B edits `orchestration.service.ts` and declares `sharedContractIds: [HARNESS_ENTITLEMENT_PROOF_V1]`, `mutatesSharedContractIds: []`, extends the key-set pins (an auto-approved dispatch and report-back are signed with the same key set as a clicked one) and reports `git diff --stat main -- services/api-gateway/src/ai services/ai-service` empty. 01A and 01C leave `orchestration.service.ts` with an empty diff. **No contract change is needed.** If the implementer finds one is, it stops (section 11).

## 4. Files

### 01A — Columns and validation (GATEWAY, MIGRATION)

| File | Change |
|---|---|
| `services/api-gateway/src/migrations/1807000000000-AddUserAgentApprovalColumns.ts` (new) + `migrations/__tests__/1807…spec.ts` (new) | D1 |
| `services/api-gateway/src/migrations/__tests__/1806000000000-AddUserAgentTeamColumn.spec.ts` | the "is the latest" line (`:63`) |
| `services/api-gateway/src/entities/user-agent.entity.ts` | `approvalMode`, `approvalCreditLimit` |
| `services/api-gateway/src/user-agent/user-workflow-rules.ts` + spec | `USER_WORKFLOW_APPROVAL_MODES`, `readApprovalSetting` (fail-closed read: unknown mode → `every`) |
| `services/api-gateway/src/user-agent/dto/create-agent.dto.ts`, `dto/update-agent.dto.ts` | D2 fields |
| `services/api-gateway/src/user-agent/user-agent.service.ts` + `__tests__` | D2 validation and save on create and update; D3 no switch-on check |
| `services/api-gateway/src/user-agent/user-agent.controller.ts` + spec | both fields on responses |
| `services/api-gateway/src/connectors/connector-servers.ts` + spec | `readOnly: true` on `MAIL_TOOL` and `CALENDAR_TOOL` (D6; a constant, no behaviour change) |

Not changed: `orchestration.service.ts` (empty diff), `collaboration.controller.ts`, `collaboration-workflow.ts`, `collaboration-roster.ts`, ai-service, frontend.

### 01B — The auto-approve path (GATEWAY)

| File | Change |
|---|---|
| `services/api-gateway/src/orchestration/orchestration.contracts.ts` | `autoApproval` on `ReferralPendingJob` (D11) |
| `services/api-gateway/src/orchestration/orchestration.service.ts` | `decisionReason` on `DecideReferralInput` and in `approveReferral` (D8); `maybeAutoApprove` called at `:2727` and `:3295` (D4-D8); audit payloads (D11) |
| `services/api-gateway/src/orchestration/collaboration-workflow.ts` + spec | `lastStepCreditsFor` (D7) |
| `services/api-gateway/src/orchestration/collaboration.controller.ts` + spec | `autoApproved`, `autoApprovalWaiting` on the handoff view (D12) |
| `services/api-gateway/src/orchestration/internal-collaboration.controller.spec.ts`, `orchestration/__tests__/*` | section 6; key-set pins |

Not changed: `collaboration-tool-profile.ts`, `collaboration-front-door.ts`, `collaboration-roster.ts`, `src/ai/`, ai-service, frontend, the registry.

### 01C — Form, summary and Team page (FRONTEND, I18N)

| File | Change |
|---|---|
| `frontend/components/platform/agent-workflow-fields.tsx`, `agent-workflow-model.ts`, `create-agent-form.tsx`, `agent-workflow-summary.tsx`, `platform-dashboard.tsx` + their tests | D13, D14 |
| `frontend/components/collaboration/collaboration-page.tsx`, `collaboration-view.tsx` + `collaboration-workflows.test.tsx` | D15 |
| `frontend/lib/collaboration/api.ts`, `frontend/hooks/useUserAgents.ts` + test | the two view fields; `approvalMode`, `approvalCreditLimit` on the agent type and DTOs |
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | D16 |

Not changed: `frontend/components/workspace/`, `frontend/components/office/`, `frontend/app/`, the other hooks.

**Registered provisional scope:** the body sets no write set; every file above is set at admission, per slice, EXACT.

## 5. Write set, mutexes, lifecycle

| Item | 01A | 01B | 01C |
|---|---|---|---|
| Mutexes | GATEWAY, MIGRATION | GATEWAY | FRONTEND, I18N |
| PACKAGE / hot files | no / none | no / none | no / none |
| Shared contracts | none touched (`orchestration.service.ts` and the four frozen paths: empty diff) | HARNESS_ENTITLEMENT_PROOF_V1 read, not mutated (3.7) | none |
| Revert isolation | migration down; nothing reads the columns until 01B | revert the commit: with `every` stored everywhere the path is a no-op (tested byte for byte) | the form and labels; the columns and routes stay callable |
| Evidence class | LOCAL-TESTS | LOCAL-TESTS | LOCAL-TESTS |
| Lifecycle | 4-STEP: registration (done), this stage-start, implementation (three slices, each LANE-DONE and LOCK), consolidation per slice | | |
| Order | first | after 01A LOCK (reads the columns, the flag) | after 01A LOCK (fields on responses); D15 after 01B LOCK, or 01C ships the form first and the page lines wait |
| Deploy | STAGING-DEPLOY-FD-02 carries 1806 and 1807 (pre-migration backup, new migration hash) | | |

## 6. Tests and gates

**01A, gateway.** Migration spec: 1807 is the latest and after 1806; up refuses when a column exists; down refuses when absent; mocked. Service: create and PATCH save both fields; `credits` without a limit is 400 `APPROVAL_LIMIT_REQUIRED`; a limit with `every` or `read_only` is stored null; an unknown mode is 400; 0 and 1,000,001 refused; an absent field keeps the stored value; a setting-only PATCH on an active row runs no switch-on check and does not change the version. Controller: responses carry both fields. Rules: `readApprovalSetting` on malformed stored values yields `every`. Connectors: both tools `readOnly: true`.

**01B, gateway.** With `every` (or no column, or the Chief of Staff lead): the dispatch and report-back jobs stored after an answer are byte for byte today's, no audit event. With `read_only` on a workflow lead with team `[product-strategy, <wf2>]`: the dispatch to the advisor is `approved` and enqueued in the same call, `decidedBy` the owner, `decisionReason 'auto:read_only'`, the approved audit payload carries `autoApproval`; the dispatch to `<wf2>` likewise with its own snapshot; the report-back to the lead likewise with the lead's snapshot; a third round is still refused. Fail-closed: a target with profile `write`, `review` or null waits with `writes`; a target whose connector tool lacks `readOnly` waits with `writes`; a lead row deleted mid-run waits with `lead_missing`; a budget refusal, an exhausted credit balance or a disabled provider leaves the step `pending_approval` with `checks_failed` and the run alive; the owner's click on such a step still works. With `credits`: estimate from the last completed step's deductions; at the limit → approved; one over → waits with `over_limit`; no history → waits with `unknown_cost`. A body with `decisionReason` or `autoApproval` on any route is ignored (login and internal). Sweep recovery after a simulated restart approves once (idempotent). Front door and coding: every COS-FRONTDOOR-01B and USER-TEAMS-01B test unchanged. Key-set pins: an auto-approved dispatch, report-back and the lead's step have the same `Object.keys` as a clicked one.

**01C, frontend.** Editor: the fieldset renders three choices, default `every`; `credits` needs a number (error key) and the body carries both fields on create and PATCH; `read_only` sends a null limit; the details open for a non-default mode; the team hint changes with the mode; existing test IDs kept. Summary: the three approval lines. Team page: an approved hand-off with `autoApproved` shows the automatic line, not the raw id; a waiting one with a reason shows the reason line; the Approve button is unchanged. Key parity in three languages with real Chinese.

| Area | Command | Compare with |
|---|---|---|
| api-gateway | `npx jest --maxWorkers=2`, then `npm run build` | 3601 passed, 7 skipped, plus the 14 known `smoke.integration` failures (`docs/USER-TEAMS-01B-CHECKPOINT.md:50`); each slice moves the count by its new tests only; build exit 0 |
| ai-service | not touched; `npx jest --runInBand` only if a file under `services/ai-service` changes (it must not) | 1296 passed, 1 skipped |
| frontend | `npx tsc --noEmit`, `npm test`, `npm run build`, then `git restore -- frontend/tsconfig.tsbuildinfo` | tsc 0; 1604 passed (`docs/USER-TEAMS-01C-CHECKPOINT.md:62-64`); build exit 0 |
| files | changed files are LF; 01A and 01C: `git diff --stat main -- services/api-gateway/src/orchestration/orchestration.service.ts services/api-gateway/src/ai services/ai-service` empty; 01B: `git diff --stat main -- services/api-gateway/src/ai services/ai-service frontend` empty | |

Checklists on each checkpoint (`docs/control-plane/task-checklists.md`): EVERY, BACKEND (01A, 01B), MIGRATION (01A), UI (01C). FLOWS n/a (no checkpoint, revert or file-action code). Skills before UI work: `.agents/skills/impeccable`, `.agents/skills/emil-design-eng`; DESIGN.md applies (the budget inputs and the Team fieldset patterns).

## 7. Implementer model (GOV-ROUTING-01)

| Slice | Model | Why |
|---|---|---|
| 01A | **opus** (Opus 5.5) | a migration and owner-scoped validation across two folders (the MIGRATION list names the stronger model) |
| 01B | **opus** (Opus 5.5) | approval logic (auth-like) in the frozen-path orchestration file; the design is settled so the work is bounded; re-dispatch on fable if opus stops twice on the fail-closed rule |
| 01C | **sonnet** (Sonnet 5.5) | frontend-only form, summary and labels with copy in three languages; no auth or contract change |

## 8. Split and order

| Slice | Delivers | Lockable alone because |
|---|---|---|
| **01A** columns and validation | migration 1807, entity, DTOs, save rule, responses, the connector read-only flag | nothing reads the columns at run time yet; the routes are owner-scoped and complete |
| **01B** auto-approve path | `maybeAutoApprove`, `decisionReason`, the estimate, audit, view fields | with `every` stored the path is today's path, pinned byte for byte |
| **01C** form and page | approval fieldset, summary line, Team page lines, copy | pure UI over 01A's fields and 01B's view fields |

Order 01A → 01B → 01C. 01A and 01B hold GATEWAY, so one lane in sequence. 01C depends on 01A (and on 01B for D15) and holds FRONTEND and I18N, so it may run in Lane 2 beside 01B if the validator admits the pair; otherwise after 01B. The control plane registers 01B and 01C as APPROVAL-SET-01B and APPROVAL-SET-01C with APPROVAL-SET-01 as 01A (the USER-TEAMS pattern).

## 9. Admission

Lane 1 is EMPTY; Lane 2 holds CM-EXEC-01 with CONTAINER-MANAGER (`TASKS.md:6-9`, `:829-834`); GOVERNANCE UNOWNED; GATEWAY, MIGRATION, FRONTEND and I18N UNOWNED (`:848-852`); the tester window is CLOSED (`:844-845`). APPROVAL-SET-01 depends on USER-TEAMS-01 (LOCKED 2026-11-11). Start condition "Keith decides": this approval. On approval the control plane sets the EXACT write sets and mutexes per slice (section 5), registers 01B and 01C, and admits 01A to Lane 1 with GATEWAY and MIGRATION beside CM-EXEC-01 (disjoint write sets; no shared contract touched by 01A).

## 10. Follow-ups (named here, disposed at the LOCKs)

1. **STAGING-DEPLOY-FD-02** carries migration 1807 as well as 1806: a line in its body.
2. **APPROVAL-SET-02** (if DECISION D is approved as recommended): the same setting on the Chief of Staff roster (`collaboration_rosters`), read when `leadIdOf` is `chief-of-staff`; NOT_READY, Keith decides.
3. **A live check** (Keith, on staging after STAGING-DEPLOY-FD-02, three languages): save `read_only` on a workflow with one advisor and one workflow member; run it; the dispatch and the report-back run without a click and the Team page shows the automatic line; switch to `credits` with a small limit and see a step wait with its reason; `every` behaves as today. Keith folds it into USER-TEAMS-LIVE-01 or registers APPROVAL-SET-LIVE-01 NOT_READY.
4. **ACTIONS-APPROVAL-01** and **CONN-DRAFT-01**: a new tool that sends or writes is registered with `readOnly: false` (or without the flag); one line in each body.
5. **TRIGGER-01**: whether an unattended start may auto-approve its first step under this setting is decided there; one line in its body.
6. **ARCHITECTURE.md 13.1** OrchestrationService row at 01B's LOCK (built, not deployed); **PRD.md** section 11 wording at the live check (plan `:306`). Control plane.

## 11. Stop conditions for the implementer

STOP and report if:
- a job key would be added or removed, or `withHarnessEntitlementProof`, `startReferralExecution`'s payload shape, `collaboration-tool-profile.ts`, `job.types.ts`, `worker.processor.ts`, anything under `services/api-gateway/src/ai/` or any ai-service file would change;
- a step would be approved by any path other than `approveReferral`, or `approveReferral` would skip `assertCanApprove`, `assertHandoffAllowed` or the conditional claim for an automatic approval;
- a target whose profile is not positively `read` (null, `review`, `write`, an unknown id without a snapshot), or any target holding a connector tool without `readOnly: true`, could be approved automatically;
- the first hand-off of a run, a referral created through the internal route, a coding or advisors step, or (under DECISION D as recommended) a Chief of Staff run would be approved automatically;
- the setting, the estimate, `decisionReason` or `autoApproval` would be read from a request body;
- `DEFAULT_MAX_REFERRAL_DEPTH`, `DEFAULT_MAX_AGENTS_PER_COLLABORATION`, `MAX_HANDOFFS_PER_RUN`, `MAX_SEND_BACK_ROUNDS`, `MAX_FRONT_DOOR_ROUNDS` or `MAX_ROSTER_MEMBERS` would change, or a third round would be possible;
- a guard, the session cookie, CSRF, the internal key, the entitlement check or the 404-for-another-owner rule would change;
- `workflowVersion` would change (D3), a system-agent pin would change, or a registry profile would change;
- a migration other than 1807 (01A), an entity change outside the two columns, a change to `collaboration_rosters`, or a new dependency seems needed;
- a Chief of Staff, coding, advisors or empty-team run, or any COS-FRONTDOOR-01B or USER-TEAMS-01B test, would change behaviour;
- a file outside the slice's write set would change;
- a gate fails outside the 14 known smoke failures.

## 12. Approval

Approved 2026-11-11. Keith approved the plan and DECISIONs A to D with the recommendations ("Yes, approve both"): A two columns on user_agents (approval_mode default every, approval_credit_limit; migration 1807); B "only over X credits" estimated from the target's last completed step cost in the owner's runs, unknown waits; C the setting applies in a test run; D workflow leads only, the Chief of Staff roster setting registered as APPROVAL-SET-02. Control plane: E auto approvals recorded with decidedBy = owner and decisionReason auto:..., shown as "Approved automatically". Slices: APPROVAL-SET-01 = 01A (this admission: GATEWAY, MIGRATION; opus), APPROVAL-SET-01B (GATEWAY; opus) and APPROVAL-SET-01C (FRONTEND, I18N; sonnet).

Original draft text of this section:


Pending. Product decisions are Keith's; E is the control plane's, recommended as below.

| ID | Choice | Recommendation |
|---|---|---|
| DECISION A | Storage and shape: two columns on `user_agents` (`approval_mode` with default `every`, `approval_credit_limit`), migration 1807; or one jsonb column. | **Two columns.** Typed, defaulted and validated like the budgets; one migration either way. |
| DECISION B | "Only over X credits": estimate = the target's last completed step cost in the owner's runs, unknown waits; or leave `credits` out of this task and ship `every` and `read_only` until a per-step estimate exists. | **The last-step estimate.** It is what the per-run budget already uses; unknown fails closed; the platform's flat estimate is not per agent. |
| DECISION C | Test runs: the setting applies in a test run, or a test run always waits. | **Applies.** One path; the owner sees before switching on exactly what will run unattended. |
| DECISION D | The Chief of Staff front door: workflow leads only in this task, the roster as APPROVAL-SET-02 NOT_READY; or add the setting to `collaboration_rosters` in the same migration and task. | **Workflow leads only.** The front door is deployed and live-checked; the body names `user_agents`; see 3.5. |
| DECISION E (control plane) | Audit: `decidedBy` = the owner with `decisionReason 'auto:…'` and the view's automatic line; or a sentinel `decidedBy` such as `system`. | **The owner with `decisionReason`.** The owner's standing rule approved it; the page says so; nothing downstream has to learn a new actor. |

Settled by the approved plan, not asked again: `every` is the default (A5); nothing that writes, sends or deletes is ever automatic (A5, enforced by D6); depth 3, 4 agents and the daily caps stay (A5); the setting sits under Advanced as part 8 (A9); the first hand-off stays the owner's click (TRIGGER-01 decides unattended starts); the setting is not part of the version (D3, the team's precedent).
