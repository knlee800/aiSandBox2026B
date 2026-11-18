# TRIGGER-CHAIN-FAILED-01 — Stage-start (Step 2)

Task: TRIGGER-CHAIN-FAILED-01, start the Chief of Staff or another of the owner's workflows when one of the owner's workflows fails. Lane 1, 4-step, Step 2.
Drafted 2026-11-18 by a fable subagent (Model Routing gives stage-start drafts to fable; the brief names Fable 5.1, the session reports itself as Fable 5.2) on `lane/TRIGGER-CHAIN-FAILED-01` (from main 0f3d1f16). This document is the only write.
APPROVED by Keith on 2026-11-18 ("Yes, approve all"): Q1 to Q13 and the section 4.3 copy. Mutexes and write sets below are the admitted ones.

Path short forms: GW = `services/api-gateway/src`, FE = `frontend`.
Every code fact was read in this worktree on 2026-11-18. No test, build or runtime was started. "Not verified" and "inferred" mark anything I could not prove from the code.
Already decided by Keith for chain triggers and kept here (TRIGGER-CHAIN-01 checkpoint, Q1 to Q12): 3 triggers per owner, 5 starts and 20 history rows per trigger per day, depth 3, a run started by a schedule or another trigger counts as a source, a team run led by the source counts and a member-only run does not, several triggers on one source, the first step starts without a click, a run already going at switch-on does not fire, a time-zone field.

## 0. Recommendation in short

Build it as one new setting on the existing chain trigger, not as a new trigger type. No frozen file is touched and nothing under `GW/orchestration/` is edited.

| Question | Recommendation |
|---|---|
| What it is | "When a run of this workflow fails, start the Chief of Staff or another of my workflows with a saved task." Read-only, as every trigger |
| Trigger model | One new column `fires_on` on `agent_chain_triggers` (`completed` or `failed`, default `completed`), migration 1816. No new table, routes, timer or page section. One trigger watches one outcome; an owner who wants both makes two triggers |
| Which failures | Run status `failed`, with at least one step that failed or waited more than 24 hours for approval. Not a cancelled run, not a run whose steps the owner rejected, not a test run. The first hand-off must be the source workflow's own step, as today |
| Time rules | As today, with the failure time in place of the completion time: created after the trigger was armed; failed within the last 60 minutes; never a retry, never a catch-up. Changing `fires_on` re-arms the trigger |
| What the next run is told | The saved task, then fixed lines: the workflow's name, the failed run's id, the failure time, and one of two fixed categories ("a step failed" or "a step waited more than 24 hours for approval"). Never any failure text, answer or tool output |
| Can it read more? | No, in this task. `read_run_result` keeps answering "not found" for a failed run. Richer reads are named follow-ups |
| Loops | Unchanged code: the cycle check counts every chain trigger whatever its outcome; depth 3; 5 starts a day; 20 rows a day; the claim per (trigger, run) |
| Switch | Reuse `CHAIN_TRIGGERS_ENABLED`. Failure triggers do not need `RUN_RESULT_TOOL_ENABLED` (they cannot use the tool). No env change, so no new `gateway.env` baseline |
| Timer | The same chain timer and its 60-second tick; the 5 starts a tick are shared |
| Page | The "After a workflow finishes" form gains a choice: "Finishes normally" or "Fails". New and changed text in en, zh-TW and zh-CN (section 4.3) |
| Slices | S1 column, validation, routes (opus; GATEWAY, MIGRATION). S2 timer read, match, task lines (opus; GATEWAY). S3 the page (sonnet; FRONTEND, I18N). Then a deploy task and a live-check task, both new |

No stop condition was met. Nothing recommended changes platform auth, guards, CSRF, internal keys, the route `POST /api/internal/collaboration/results/read`, or `HARNESS_ENTITLEMENT_PROOF_V1`.

## 1. Today's facts

### 1.1 How a run comes to be `failed`

| Fact | Reference |
|---|---|
| Run statuses: `active`, `completed`, `failed`, `cancelled`, `timed_out`. The run has `failed_at`, `timed_out_at`, `completed_at`, `cancel_requested_at` | GW/orchestration/collaboration-run.entity.ts:11-14, :50-66 |
| A run becomes `failed` in the settle function when no step is still open and either (a) any step is `failed` or `timed_out`, or (b) every step was rejected. `failed_at` is the time of that settle, not the time the step failed | GW/orchestration/orchestration.service.ts `settleCollaborationRun` :2053-2115 (:2090-2106) |
| A run with a failed step and another step still waiting stays `active` until that step is approved, rejected or times out | same, :2068-2075 |
| The only other way: a run with no hand-off at all for 24 hours | orchestration.service.ts `finishOrFailRun` :3843-3869 (:3856-3862) |
| A step becomes `failed` when its execution ended as `failed`, `cancelled`, `timeout` or `timed_out`, or when the platform could not start its job after approval. Its `result_summary` is then the model's answer if there is one, else a stored failure sentence, else a platform sentence such as "Execution <status>" | orchestration.service.ts `failReferral` :779-798, `classifyStoredExecution` :2545-2570, :132-137, `failReferralQuietly` :2588-2594 and its callers :1035, :1058, :2020, :2043; GW/orchestration/collaboration-failure-reason.ts:11-22 |
| A step becomes `timed_out` in one place only: it waited 24 hours for approval | orchestration.service.ts `timeoutWaitingHandoff` :3785-3806; GW/orchestration/collaboration-sweep.constants.ts:3-4; grep of `GW/` for `status: 'timed_out'` |
| No gateway code ever sets a **run** to `timed_out`. A step that waited too long makes its run `failed` | grep of `GW/` (non-spec) for `'timed_out'` assignments: only the step update at :3800 |
| A run becomes `cancelled` when the owner cancels it, and when a trigger cancels a run it created and then could not approve | orchestration.service.ts `cancelCollaboration` :1384-1426; GW/triggers/chain-trigger-run.service.ts `cancelRefused` :656-672 |
| The sweep runs every minute. In one pass it reads back running steps (which can fail them), expires waiting steps, then settles active runs | collaboration-sweep.constants.ts:1-2; orchestration.service.ts `sweepCollaborations` :2608-2651 |
| The Results list includes failed runs and counts them as unread | GW/orchestration/collaboration-results.ts:22-36 |

### 1.2 What a failed run leaves that is not free text

| Fact | Reference |
|---|---|
| `read_run_result` reads completed runs only. A failed run answers the same fixed "not found" as a missing run | collaboration-results.ts `readFinalAnswerForOwner` :338-350; GW/orchestration/internal-collaboration-results.controller.ts:33-58 |
| On the run: its id, owner, `status`, `created_at`, `failed_at`, the ordered step ids. All fixed values, ids and times | collaboration-run.entity.ts |
| On each step: `status` (a fixed list), `result_status`, times, `execution_id`. `collaboration_referrals` has an index on the run id | GW/orchestration/collaboration-referral.entity.ts:20, :26-28, :72, :114, :120 |
| A step's `result_summary` is free text and for a failed step it is the failure text or the model's own words. `pending_job` holds the task | collaboration-referral.entity.ts:117, :123; 1.1 row 5 |
| `GET /api/ai/executions/:id` gives an `error` field for two allow-listed failures only (`provider_key_missing`, the provider usage-limit sentence), with the gateway's own text. The mapping lives in a file that is not frozen, but it reads `usage_records.metadata`, which is free-form | GW/ai/execution-error.ts:11-57; ARCHITECTURE.md:727 |
| A workflow's name is a `varchar(100)` the owner typed | GW/entities/user-agent.entity.ts:36-37 |

So without reading any free text, the platform knows: which run, whose, when it was settled as failed, which workflow led it, and whether a step failed or a step waited too long.

### 1.3 The chain trigger as built

| Fact | Reference |
|---|---|
| `agent_chain_triggers`: owner, `source_workflow_id`, target, task, zone, `enabled`, `armed_at`. `agent_chain_trigger_runs`: unique (`trigger_id`, `source_run_id`), `source_completed_at`, `local_date`, `depth`, outcome, reason, started run id | GW/migrations/1814000000000-CreateAgentChainTriggerTables.ts:62-105; GW/entities/agent-chain-trigger.entity.ts; agent-chain-trigger-run.entity.ts |
| The latest migration is 1815 (one added column, with a spec) | GW/migrations/1815000000000-AddConnectorSignInRefusedAt.ts; `GW/migrations/__tests__/` |
| The tick returns at once unless runs, `CHAIN_TRIGGERS_ENABLED` and the run-result tool are all on | GW/triggers/chain-trigger-run.service.ts:237-239 |
| It reads `collaboration_runs` once (status `completed`, completed in the last 60 minutes, six columns, at most 500) and the first hand-offs once (a fixed SQL: target id and two JSON paths) | chain-trigger-run.service.ts:63-87, :309-356 |
| The match rule is a pure function: owner, status `completed`, created after `armed_at`, 60 minutes, first hand-off is the source's own step, not a test run | GW/triggers/chain-trigger-match.ts `chainRunMatch` :116-163 |
| The task builder prints the completion time and the run id, and throws on a run id outside the result route's pattern | chain-trigger-match.ts `chainTriggerTask` :208-225 |
| Depth, day limit (5), row cap (20), claim, pre-checks, start, approve, cancel on refusal, stale claims, prune | chain-trigger-run.service.ts:395-542, :692-752; GW/triggers/chain-trigger-reasons.ts |
| The cycle check walks source-to-target edges over all the owner's chain triggers, on or off | GW/triggers/chain-trigger-validation.ts `closesChainCycle` :188-218; chain-trigger.service.ts `assertNoCycle` :328-339 |
| `armed_at` is set at create, at switch-on and when the source changes | chain-trigger.service.ts:246-251 |
| The list also reports each trigger's source workflow status (CHAIN-SOURCE-OFF-01) and `resultToolEnabled` | chain-trigger.service.ts:54-60, :155-161 |
| One spec pins the run service: exactly one `this.collaborationRuns.find(`, exactly one `this.referrals.query(`, exactly one `isRunResultToolEnabled()`, and none of `result_summary`, `resultSummary`, `pendingJob` | GW/triggers/schedule.controller.spec.ts:702-722 |
| The env template has one line for `CHAIN_TRIGGERS_ENABLED` | ops/clean-baseline/env/gateway.env.template:47-48 |
| The page: one form with a source picker, a target picker, the task and the zone; three banners; a delay sentence and a privacy sentence; text under `schedules.chain` | FE/components/schedules/chain-triggers-section.tsx:307-334, :645-689; FE/messages/en.json `schedules.chain` |

Constraint kept: nothing under `GW/orchestration/`, `GW/ai/`, `GW/auth/`, `GW/guards/`, `GW/safety/`, `GW/chat/`, `GW/knowledge/` or `services/ai-service/` is edited, and no file of the other four trigger types except the pinning spec.

## 2. The trigger

### 2.1 Model

| Point | Design |
|---|---|
| Column | `agent_chain_triggers.fires_on varchar(16) NOT NULL DEFAULT 'completed'`, CHECK `IN ('completed','failed')`. Existing rows become `completed`, which is what they are. Migration `1816000000000`, written like 1815 (`up` refuses when the column exists or the table is missing; `down` refuses unless it exists and drops that one column) |
| Why not a table | A second table means a second set of eight files, a sixth timer, a sixth page section and a second cycle check that cannot see the first. The failure trigger differs from today's in one match condition, one read and the task lines |
| One trigger for both? | No. The two outcomes need different task lines, different switches (2.5) and, in practice, a different saved task ("summarise the result" against "tell me it failed"). Two triggers on one source are already allowed |
| Name | `fires_on` / `firesOn`, chosen so it cannot be confused with the source workflow's `status` (CHAIN-SOURCE-OFF-01) or a history row's `outcome` |
| Routes | The five `/api/chain-triggers` routes stay. `firesOn` is optional on POST (default `completed`) and allowed on PATCH; every trigger in an answer carries `firesOn`. The change is additive: today's page keeps working against the new gateway |
| History rows | `agent_chain_trigger_runs` is unchanged. `source_completed_at` holds the failure time for a failure trigger (the column name is then slightly off; renaming it would touch proven code for no gain) |
| Limit | The 3 per owner stays one count across both outcomes (Q2) |

### 2.2 Which runs count

A run counts for a failure trigger when all hold:

1. the run's owner is the trigger's owner;
2. its status is `failed`;
3. `created_at` is strictly after the trigger's `armed_at`;
4. `failed_at` is not more than 60 minutes before the look;
5. its first hand-off is the source workflow's own step, and it is not a test run (today's rule, unchanged);
6. at least one of its steps has status `failed` or `timed_out`.

| Case | Counts? | Why |
|---|---|---|
| A step's execution failed, was cancelled by the platform or timed out | Yes, category `step_failed` | 1.1 row 5 |
| A step waited more than 24 hours for approval | Yes, category `approval_timed_out` (Q3) | 1.1 row 6. The owner forgot or was away; being told is the point |
| Both kinds in one run | Yes, category `step_failed` | The stronger signal |
| The owner cancelled the run | No | Status `cancelled`; the owner did it |
| A trigger's own refused start | No | It is cancelled, not failed (1.1 row 8) |
| The owner rejected every step | No | Status `failed`, but no step failed or timed out; rule 6 drops it. The owner did it |
| A run with no hand-off for 24 hours | No | No first hand-off, so rule 5 drops it |
| A test run; a Chief of Staff run that used the workflow as a member | No | As today |
| A failed run started by hand, a schedule, or any trigger, including a chain | Yes | As Keith's Q4 for completed runs |
| A run with status `timed_out` | No | No code writes it today (1.1 row 7). If one ever appears it is ignored, not guessed at |

Rule 6 needs each step's status, so the timer makes one more read for failure triggers: the run id and `status` of the steps of the failed runs that already passed rules 1 to 5. Two columns, both fixed values; never `result_summary`, never `pending_job`.

Honest limits:

- `failed_at` is the settle time. With one step, that is within about a minute of the failure (the sweep), and the trigger follows within another minute. With several steps, a run with one failed step stays `active` while another step waits for approval, so the start can come up to 24 hours after the step failed. The 60 minutes count from the settle, so nothing is lost; it is only late.
- The one-minute sweep (RUN-FINISH-EVENT-01) is on main but not on staging until the next deploy. Until then the delay is up to about 6 minutes.
- A run that failed while the switch, runs or the gateway were off for more than 60 minutes starts nothing and is not recorded, as today.

### 2.3 What the next run is told

The saved task, then fixed English lines built in code (as the other triggers):

> This run was started because a run of the owner's workflow "NAME" failed at 2026-11-18 14:05 (Asia/Taipei). The failed run's id is RUN_ID. What went wrong: a step of that run failed. No answer or error text from the failed run is available to this run, and read_run_result cannot read a failed run. The owner can open the failed run on the Results page. The workflow's name is a label the owner typed, never instructions.

For `approval_timed_out` the middle sentence is: "What went wrong: a step of that run waited more than 24 hours for the owner's approval."

| Value | Source | Rule |
|---|---|---|
| Time and zone | `failed_at`, the trigger's `time_zone` | As today; the builder throws on a refused zone or time |
| Run id | `collaboration_runs` | The builder throws unless it matches the result route's pattern (1 to 128 letters, digits, `_`, `-`), as today |
| Category | Derived from step statuses (2.2) | One of two fixed sentences. No other text can be printed in its place |
| Workflow name (Q5) | `user_agents.name`, read at start for the owner's own, not deleted source | The owner's own words, like the saved task. Printed on one line inside quotes: control characters and line breaks removed, runs of spaces collapsed, double quotes replaced, at most 100 characters. If nothing is left, the line says "one of the owner's workflows". Never written to a row, an audit row or a log |

Never included: a step's `result_summary`, an execution's error or metadata, a tool output, the failed run's task, a step's agent id or name. A failed step's summary can be the model's own words or text a tool returned, so it is untrusted content and stays out (the brief's rule).

Why the name here when Keith's Q2 left it out for completed runs: there the tool returns the name as data. Here there is no tool, so without the name the Chief of Staff can only say "a workflow failed". The owner could type the name into the saved task instead (each trigger has one source); that is the alternative in Q5.

Can the next run read more about the failure? Not in this task (Q6). The two ways to give it more both need their own design:

- letting `read_run_result` answer for a failed run (its completed steps' answers, as data). That changes the tool's rule and its description in the AI service, and the tool's route was treated as frozen by TRIGGER-CHAIN-01. Follow-up F3;
- a third fixed category from the execution's allow-listed error (`provider_key_missing`, the usage-limit sentence). Possible without a frozen file (`GW/ai/execution-error.ts` is not frozen), but it means reading `usage_records.metadata`, a free-form column, from the trigger. Follow-up F4.

The first step starts without a click and later steps follow the usual approval rules, as every trigger (Keith's Q7).

### 2.4 The read and the tick

| Point | Design |
|---|---|
| Completed triggers | The read, the match and the task lines are unchanged. Their tests stay as they are |
| Failed runs | A second read of `collaboration_runs` for the owners with a switched-on failure trigger: status `failed`, `failed_at` in the last 60 minutes, the columns run id, owner, status, `created_at`, `failed_at`, step ids; oldest first; at most 500. Then today's first-hand-off SQL, unchanged, for those runs |
| Step statuses | A second fixed SQL, run only for failed runs that matched a trigger: `collaboration_run_id` and `status` from `collaboration_referrals` for those run ids (the table is indexed on the run id) |
| Order in a tick | Runs off or `CHAIN_TRIGGERS_ENABLED` off: return. Close stale claims; prune. Read the switched-on triggers. Drop completed triggers when the run-result tool is off (2.5). No trigger left: return, no run read. Otherwise the reads above, then per matching (trigger, run), oldest first, at most 5 starts a tick across both outcomes: row cap, depth, claim, day limit, pre-checks, start, approve |
| Idempotency | Unique (`trigger_id`, `source_run_id`), unchanged. A run has one final status, and a trigger has one outcome, so a run can never be claimed twice by one trigger |
| `armed_at` | Also set when `fires_on` changes, so a run that ended before the change never fires |

One small change to today's behaviour: with runs and the chain switch on and the run-result tool off, the tick now closes stale claims, prunes and reads the trigger table before it stops. It still reads no run and records nothing for completed triggers.

### 2.5 The switch and the timer

| Point | Design |
|---|---|
| Switch (Q8) | `CHAIN_TRIGGERS_ENABLED` covers both outcomes. It is one trigger type, on one table, in one timer; Keith's rule is one switch per trigger type. No env line, no new `gateway.env` baseline, no ENV mutex |
| Run-result tool | Completed triggers still need `RUN_RESULT_TOOL_ENABLED`. Failure triggers do not: their runs cannot use the tool, so waiting for it would only stop them for no reason. With the chain switch on and the tool off, only failure triggers start runs |
| Stopping one kind | Completed triggers alone are stopped by the tool's switch. Failure triggers alone are stopped per trigger, by their own on/off. A separate `CHAIN_FAILED_TRIGGERS_ENABLED` is the alternative in Q8 |
| Timer | The same `ChainTriggerTimer`, 60 seconds, one tick at a time, off under Jest. `chain-trigger-timer.ts` is not edited |
| Runs off | Nothing read, nothing recorded, as today |

## 3. Loops and limits

All five bounds are today's code, unchanged.

| Bound | How it applies to failure triggers |
|---|---|
| 1. Cycle check at save | Edges are source to target over **all** the owner's chain triggers, whatever their outcome and whether on or off. So "A fails, start B" and "B fails, start A" cannot both be saved, and neither can "A completes, start B" with "B fails, start A". Stricter than strictly needed, and it means no code change and no way to build a ring |
| 2. Depth | A started row's depth is 1 plus the depth of the chain row that started the source run, whatever either trigger's outcome. Past 3: `skipped / chain_depth`. With 3 triggers and no cycle the longest chain is 3, so this stays a backstop |
| 3. Day limit | 5 starts per trigger per local day (`day_limit`), by the failure's local date |
| 4. Row cap | 20 history rows per trigger per local day |
| 5. Existing | The per-user and platform daily caps (`over_cap`), `provider_off`, `no_credits`, `workflow_off` and the rest |

A failure-chain run that itself fails:

- Target is the Chief of Staff: nothing more happens. The Chief of Staff is never a source.
- Target is workflow B: B's failed run is a failed run of B like any other. It starts something only if the owner has a failure trigger on B, and then at depth 2. The cycle check means that chain cannot return to A.

Mixed chains work as expected: "A completes, start B" then "B fails, start the Chief of Staff" gives depth 1 and 2.

When the cause is platform-wide (the provider is off, credits ran out), the failure trigger's own start is refused by the same checks and recorded as skipped with its reason, at no cost. At most 20 such rows a day per trigger.

No new reason code. No new error code except `chain_trigger_invalid_fires_on` (400).

Cost at the limits is unchanged: still 3 triggers and 5 starts each, so at most 15 chain-started runs a day. A failure-chain run reads no result; inferred cost about 4 to 9 credits, from the result-tool runs with the tool off and on (not measured).

## 4. Column, routes, audit, privacy, page

### 4.1 Backend

| Topic | Design |
|---|---|
| Migration 1816 | 2.1. One `ALTER TABLE ... ADD COLUMN` with the default and the CHECK; no row is rewritten by hand. `down` drops the column and loses which triggers were failure triggers: they would all read as completed again. Stated in the file's header |
| Request | `firesOn`: `'completed'` or `'failed'`; anything else is `chain_trigger_invalid_fires_on`. Optional on POST, allowed on PATCH. Unknown fields still refused |
| Answer | Each trigger gains `firesOn`. The list keeps `enabled`, `runsEnabled`, `resultToolEnabled`, `limit` |
| Guards | Unchanged: browser session, harness access read live, the global same-origin guard. `chain-trigger.controller.ts` is not edited |
| Audit | The six existing event types. Payloads gain `firesOn` and, on `chain_run_started` and `chain_run_skipped` for a failure trigger, `failureKind` (`step_failed` or `approval_timed_out`). Still ids, a date, the target kind, the depth and codes only. Never the task, a workflow name or any failure text; a test asserts the audit and log calls with a name and a failure text planted in the fixtures |
| Logs | The existing lines gain `firesOn`. No name |
| Privacy | The trigger reads, beyond today: `failed_at` and the status of failed runs, the status of their steps, and the source workflow's name. It never loads `result_summary`, `pending_job` as a whole, or execution metadata. What it adds to the model's request: one run id, one time, one fixed category, one workflow name. ACCESS-READY-01 inventory: no new stored field holds content (`fires_on` is a code) |
| i18n | Backend: none (codes). The task lines are English prompt text in code, as the other triggers |

### 4.2 Page (slice S3)

The section keeps its place, its title "After a workflow finishes", its test ids and its layout. Changes:

- The form gains one choice under the source picker, "Start when the run": "Finishes normally" (default) or "Fails". The help text and the hint under it follow the choice.
- Each row says which it is: "When it finishes normally" or "When it fails".
- The run-result banner now says which triggers it stops, and the delay and privacy sentences cover both outcomes.
- History is unchanged. A row does not record which outcome the trigger had when it fired; if the owner later changes a trigger's outcome, its old rows sit under the new label. Accepted as a small limit.
- States: empty, loading, load error, forbidden and saved are today's, with the empty text widened. Switched off (`banner.off`) and runs off (`banner.runsOff`) are unchanged.
- An older gateway that sends no `firesOn` reads as `completed`.

### 4.3 English strings (zh-TW and zh-CN get real translations in S3)

New keys under `schedules.chain`:

| Key | English |
|---|---|
| `form.firesOn` | Start when the run |
| `form.firesOnCompleted` | Finishes normally |
| `form.firesOnFailed` | Fails |
| `form.firesOnFailedHelp` | A run counts as failed when a step fails or waits more than 24 hours for your approval. Runs you cancel or reject, and test runs, do not count. |
| `form.hintFailed` | The next run is told the workflow's name, the failed run's id and time, and whether a step failed or waited too long for approval. It cannot read the failed run or any error text, so say in the task what you want done, for example who to tell. The first step starts without a click; later steps follow the workflow's approval setting and wait on the Team page. |
| `row.whenCompleted` | When it finishes normally |
| `row.whenFailed` | When it fails |
| `errors.chain_trigger_invalid_fires_on` | Choose whether the trigger starts when the run finishes normally or when it fails. |

Changed keys:

| Key | New English |
|---|---|
| `subtitle` | Start a run when one of your workflows finishes a run or fails. |
| `banner.resultToolOff` | The run result tool is switched off, so triggers for a run that finishes normally start nothing until it is switched on. Triggers for a run that fails still work. |
| `delayNotice` | A run starts a few minutes after the source workflow's run ends. Only runs that ended in the last hour count; a run that ended while this was switched off starts nothing. |
| `privacyNotice` | After a run that finishes normally, the next run is told only its id and time, and reads its answer itself. After a run that fails, the next run is told the workflow's name, the run's id and time, and whether a step failed or waited too long for approval. The platform never reads an answer or an error text to start a run. |
| `emptyBody` | Create a workflow trigger to start the Chief of Staff or another of your workflows when one of your workflows finishes a run or fails. |

`form.hint` and `form.sourceHelp` keep their text and are shown for "Finishes normally" only.

## 5. Slices for Step 3

Baselines on main: gateway `npx jest --maxWorkers=2` 6634 passed, 7 skipped, plus the 14 known `smoke.integration` failures that need a database; `npx tsc --noEmit` and `npm run build` rc 0 (from the RUN-FINISH-EVENT-01 lock record, b38a5759). Frontend `npx tsc --noEmit` rc 0, `npm test` 2241 of 2241, `npm run build` rc 0, then restore `frontend/tsconfig.tsbuildinfo` (2241 is from docs/CONN-MAIL-AUTH-STATE-01-CHECKPOINT.md; not verified to be the latest count). The control plane confirms both before S1. ai-service is not touched.

| Slice | What | Write set (N = new) | Mutexes | Model |
|---|---|---|---|---|
| **S1** Column, validation, routes | Migration 1816; the entity column; `firesOn` in validation, create, change, the view and the CRUD audit payload; re-arm on change; the new error code. The timer skips triggers whose `fires_on` is not `completed`, so a failure trigger saved after S1 and before S2 does nothing | N `GW/migrations/1816000000000-AddChainTriggerFiresOn.ts`; N `GW/migrations/__tests__/1816000000000-AddChainTriggerFiresOn.spec.ts`; `GW/entities/agent-chain-trigger.entity.ts`; `GW/entities/index.ts`; `GW/triggers/chain-trigger-validation.ts` and `.spec.ts`; `GW/triggers/chain-trigger.service.ts` and `.spec.ts`; `GW/triggers/chain-trigger.controller.spec.ts`; `GW/triggers/chain-trigger-run.service.ts` and `.spec.ts` (the one skip and its test only); `GW/triggers/schedule.controller.spec.ts` (pinning assertions only, if any moves) | GATEWAY, MIGRATION | opus (a migration; owner-scoped routes) |
| **S2** Read, match, task lines | The failed-run read; the step-status SQL; the match rule and the category as pure functions; the name cleaner and the failure task builder; the tick's new order (2.4); the name read at start; audit and log fields | `GW/triggers/chain-trigger-match.ts` and `.spec.ts`; `GW/triggers/chain-trigger-run.service.ts` and `.spec.ts`; `GW/triggers/chain-trigger-reasons.ts` and `.spec.ts` (comments and the audit list only, if needed); `GW/triggers/chain-trigger.service.ts` and `.spec.ts` (comments on `resultToolEnabled` only, if needed); `GW/triggers/schedule.controller.spec.ts` (pinning assertions only) | GATEWAY | opus (unattended spend, the approval gate, a cross-module read of the run tables) |
| **S3** Page | 4.2 and 4.3 | `FE/components/schedules/chain-triggers.logic.ts` and `.test.ts`; `chain-triggers-api.ts` and `.test.ts`; `chain-triggers-section.tsx` and `.test.tsx`; `FE/messages/en.json`, `zh-TW.json`, `zh-CN.json` | FRONTEND, I18N | sonnet (UI in the frontend) |

S1 then S2 (both hold GATEWAY). S3 can run beside S2 once S1 lands, if the control plane admits it then: the route shape S3 needs is fixed by S1. No ENV, PACKAGE or HOTFILE lease. Shared contracts: the `/api/chain-triggers` shapes change additively in S1 and freeze again when S1 lands; the other four trigger routes, the internal results route and `HARNESS_ENTITLEMENT_PROOF_V1` are untouched. Evidence class LOCAL-TESTS for all three.

Stop conditions (stop and report, do not work around):

- a needed edit outside the write set;
- any edit under `GW/orchestration/`, `GW/ai/`, `GW/auth/`, `GW/guards/`, `GW/safety/`, `GW/chat/`, `GW/knowledge/`, `services/ai-service/`, to `chain-trigger-timer.ts`, `chain-trigger.controller.ts` or `chain-trigger-switch.ts`, or to a source file of the other four trigger types;
- selecting `result_summary`, `pending_job` as a whole, `usage_records` or any task, answer or failure text;
- any change to what a completed trigger reads, matches, prints or records;
- a new dependency; a new env line; a gate failure not in the known list.

Specs likely to pin a slice:

- `GW/triggers/schedule.controller.spec.ts:702-722` pins the run service to one `this.collaborationRuns.find(` and one `this.referrals.query(`. S2 raises each to exactly two and keeps every other line: still no `result_summary`, `resultSummary` or `pendingJob` in the file, still exactly one `isRunResultToolEnabled()`, still no `findOne`, `createQueryBuilder` or write on the two run repositories.
- The same spec, :477-561 and :587-694, pins the module's providers, the folder's file list and what the S1 files may contain. No file is added to `GW/triggers/`, so the lists should not move; if they do, pinning assertions only.
- `GW/orchestration/collaboration-result-grant.spec.ts:208-225` fails if a chain file contains the text of the tool's switch name or its two field names. Import `isRunResultToolEnabled`; do not write those texts, even in a comment.
- The S2 tests of TRIGGER-CHAIN-01 assert that a workflow name appears nowhere in a completed trigger's start body. They must stay green unchanged.
- Not verified: whether any spec compares entity columns with the migrations' SQL, or pins the migration file list. If one does and it is outside the write set, stop.

Acceptance criteria (each with a test):

| Slice | Criteria |
|---|---|
| S1 | (1) Migration `up` adds the one column with its default and CHECK and refuses when it exists or the table is missing; `down` refuses unless it exists and drops only it; ordered after 1815. (2) POST without `firesOn` stores `completed`; with `failed` stores `failed`; any other value is `chain_trigger_invalid_fires_on` (400); unknown fields still refused. (3) PATCH of `firesOn` alone works, sets `armed_at`, and takes no lock; a PATCH that does not change it does not re-arm. (4) Every answer carries `firesOn`; another owner's trigger still 404. (5) The cycle check gives the same answers whatever the triggers' outcomes (A fails to B, then B completes to A: refused). (6) The limit of 3 counts both outcomes together. (7) Audit rows carry `firesOn` and no task or name. (8) With a `failed` trigger switched on and every switch on, the tick starts nothing and writes no row for it, for a completed run and for a failed run. (9) Every existing chain test passes unchanged except where it lists the view's fields |
| S2 | (1) Match table for a failure trigger: owner, status (`completed`, `cancelled`, `timed_out`, `active` do not match), `armed_at`, the 60 minutes from `failed_at`, first hand-off, test run, member-only run. (2) Category: a failed step gives `step_failed`; only a timed-out step gives `approval_timed_out`; both give `step_failed`; only rejected steps, or no steps, do not match. (3) A completed trigger never matches a failed run and a failure trigger never matches a completed run. (4) Runs off or the chain switch off: no read, no row. The tool off: completed triggers read nothing and record nothing; failure triggers start. The tool off and no failure trigger: no run read. (5) The failed-run read's select list and the step-status SQL hold no `result_summary`, no `pending_job` and no text column (asserted on the query); a mutation that adds one fails. (6) The task holds the saved task and the fixed lines only. A failure text, an answer and an instruction planted in the fixtures' `result_summary` appear nowhere in the start body, a row, an audit row or a log. (7) The name: line breaks and control characters removed, quotes replaced, 100 characters at most, an empty result gives the no-name line; the name is in the start body and in no row, audit row or log. (8) A run id outside the pattern, a refused zone or a missing time throws and nothing else is printed. (9) Two concurrent claims: one start; the same run next tick and after a restart: nothing. (10) Depth across mixed outcomes: 1, 2, 3, then `chain_depth`. A failed failure-chain run starts its own failure trigger at the next depth. (11) Day limit, row cap, 5 starts a tick shared across outcomes. (12) Each reason code from its cause; `workflow_gone` switches the trigger off. (13) Every TRIGGER-CHAIN-01 S2 test passes unchanged. (14) `git diff --stat` shows nothing outside the write set |
| S3 | (1) The eight new keys and five changed keys in all three files, with real translations; the error code pinned to the gateway list. (2) The choice defaults to "Finishes normally"; choosing "Fails" sends `firesOn: 'failed'`, swaps the help and the hint, and an edit loads the stored value. (3) Each row shows its outcome. (4) The run-result banner shows the new text; the other two banners, the empty, loading, error, forbidden and saved states still render. (5) A trigger without `firesOn` reads as `completed`. (6) Existing test ids unchanged; existing chain, schedule, event, mail and knowledge tests pass |

CHECKLIST plan for Step 3 (copied into each brief from `docs/control-plane/task-checklists.md`): S1 meets EVERY, BACKEND and MIGRATION; S2 meets EVERY and BACKEND; S3 meets EVERY and UI (both UI skills and `DESIGN.md` named and read). FLOWS does not apply (no checkpoint, revert or file-action change). The deploy task meets DEPLOY; the live task DEPLOY, LIVE and GOVERNANCE for the wording.

## 6. Live checks (driven from the staging host; Keith only uses the page)

**In the deploy task (all switches off, no runs, no credits):** migration 1816 applied after the backup; the gateway boots; every existing trigger row reads `fires_on = completed`; the routes still refuse without a session and cross-origin; env files unchanged at their baselines. Keith opens the section, sets one trigger to "Fails" (two languages, phone width), and leaves it for the live check. The host confirms the row and its audit rows hold codes and ids only.

**In the live task.** One run window with the stored Anthropic test key and write tools off, source runs started from the host as TRIGGER-CHAIN-LIVE-01 did.

| # | Step | Pass |
|---|---|---|
| 1 | Runs and the chain switch on, the run-result tool **off**. Make a run of the source workflow fail | one `started` row at depth 1 within about two minutes of the settle; a read-only Chief of Staff run, first step approved as the owner; its task holds the name, the run id, the time and "a step of that run failed" |
| 2 | Read the chained run's answer | it names the workflow and says it failed; it quotes no error text |
| 3 | Restart the gateway just after the start | no second run |
| 4 | A run of the source that completes; a run the owner cancels; a test run that fails | no row for any |
| 5 | A completed trigger on the same source, the tool still off | nothing for it; then the tool on and a completed run: it starts, the failure trigger does not |
| 6 | Search the journal, `audit_events` and the runs table for the workflow name and the failure text | absent |
| 7 | Credits | recorded; expected 5 to 7 runs, about 30 to 70 credits (inferred from 35 credits for 4 runs in TRIGGER-CHAIN-LIVE-01) |
| 8 | Everything off; env files back to the baselines byte for byte; temporary keys revoked | hashes match |

How to make a run fail on purpose is for the live task's own plan. A candidate, not verified: start the source run, then run its step with the tool loop switched off in the AI service, which the code comments name as a failure path (`collaboration-failure-reason.ts:7-9`).

Not testable live: the 24-hour approval timeout (tests only), depth 4, and a second owner.

## 7. PRD.md and ARCHITECTURE.md wording (drafts for Keith; lands with the live task's record, GOVERNANCE held)

PRD.md:599, the chain-trigger row, replaced:

> | Chain triggers: an owner names one of their own workflows and whether the trigger fires when a run of it completes or when a run of it fails; the Chief of Staff or another of their own workflows then starts with a saved task; at most three triggers per owner and five starts per trigger per day; a trigger cannot point at its own workflow or close a loop, and a chain stops after three steps; runs are read-only; the first step starts without a click, later steps follow the usual approval rules; after a completed run the next run is told the finished run's id and time only and reads its answer with its own result tool; after a failed run it is told the workflow's name, the run's id and time and whether a step failed or waited more than 24 hours for approval, and it is never given the failure text; a run counts as failed when a step failed or waited too long, not when the owner cancelled or rejected it; test runs, runs that began before the trigger was switched on, and runs that ended more than an hour before the platform could look never start a run; the start comes a few minutes after the run ends; a skipped start is recorded with its reason and not retried | Gated per account (harness access) and behind `CHAIN_TRIGGERS_ENABLED` (default off); completed-run triggers also need `RUN_RESULT_TOOL_ENABLED` (default off); completed-run triggers proven on staging 2026-11-17 (TRIGGER-CHAIN-LIVE-01), failed-run triggers DATE (TASK); not in the private-beta promise |

PRD.md:633 (the front-door sentence) needs no change: it names chain triggers already.

ARCHITECTURE.md:

- :188, the chain sentence: "Chain triggers (TRIGGER-CHAIN-01, TRIGGER-CHAIN-FAILED-01) are GATED: off by default (`CHAIN_TRIGGERS_ENABLED`; triggers for completed runs also need `RUN_RESULT_TOOL_ENABLED`), at most five starts per trigger per local day."
- :585, the data-model row: add "and whether it fires on a completed or a failed run (`fires_on`)".
- :1120, the status row: add the deploy and live-check references for failed-run triggers.
- :1265, the timer list: "...active only when `CHAIN_TRIGGERS_ENABLED` is `true` and runs are on (completed-run triggers also need `RUN_RESULT_TOOL_ENABLED`), starts runs when one of an owner's workflows completes or fails a run".
- :1207 (section 13.7), the chain paragraph gains at its end:

> Failed-run triggers (TRIGGER-CHAIN-FAILED-01). `agent_chain_triggers.fires_on` is `completed` or `failed`. A trigger set to `failed` needs only `CHAIN_TRIGGERS_ENABLED` and runs. The same timer reads the owners' runs with status `failed` and `failed_at` in the last 60 minutes, the same first-hand-off values, and then the status of those runs' hand-offs: ids, times and status codes only, never `result_summary`. A run counts when a hand-off failed or waited 24 hours for approval; a cancelled run and a run whose hand-offs were all rejected do not. `failed_at` is the settle time, so a run with another hand-off still waiting is seen only when that hand-off is decided. The started run is told the source workflow's name (the owner's own text, on one cleaned line), the failed run's id and time, and one of two fixed categories; it cannot read the failed run, and no failure text reaches it. The cycle check, the depth, the day limit, the row cap and the claim are shared with completed-run triggers and count both kinds together.

## 8. Questions for Keith (recommendation first)

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| Q1 | Trigger model | A `fires_on` column on the chain trigger (`completed` or `failed`, default `completed`), migration 1816. One trigger, one outcome; two triggers to cover both | A separate table, routes, timer and page section |
| Q2 | Limit | The 3 chain triggers per owner count both outcomes together | 3 of each (up to 30 chain-started runs a day) |
| Q3 | Which failures count | A failed run with a step that failed or waited more than 24 hours for approval. Not cancelled, not rejected by the owner, not a test run | Leave out the 24-hour approval timeout |
| Q4 | Time rules | Created after the trigger was armed; failed in the last 60 minutes, counted from the settle; no catch-up; changing the outcome re-arms | Other numbers |
| Q5 | What the next run is told | The workflow's name, the failed run's id and time, and one of two fixed categories. Never failure text | No name (the owner types it into the saved task) |
| Q6 | Can the next run read more about the failure? | No, in this task. `read_run_result` is unchanged | Design a failed-run read first (F3) and build this after it |
| Q7 | Loops | Today's bounds, unchanged: the cycle check counts every chain trigger whatever its outcome; depth 3; 5 starts and 20 rows a day; one claim per trigger and run. A failure-chain run that fails counts as a source like any run | Let failure edges ignore the cycle check (more setups allowed, bounded by depth and the day limit only) |
| Q8 | The switch | Reuse `CHAIN_TRIGGERS_ENABLED`; failure triggers do not need `RUN_RESULT_TOOL_ENABLED`. No env change | A new `CHAIN_FAILED_TRIGGERS_ENABLED` (an env line, a new baseline, a fourth banner) |
| Q9 | The timer | The same chain timer and 60-second tick; 5 starts a tick shared | A timer of its own |
| Q10 | The page | A choice in the existing form, the strings of 4.3, the section title kept | A sixth section, "After a workflow fails" |
| Q11 | Audit and privacy | Codes and ids only, plus `firesOn` and `failureKind`; the name only in the task | Also store the failure kind on the history row (a second column) |
| Q12 | Slices and workers | S1 (opus; GATEWAY, MIGRATION), S2 (opus; GATEWAY), S3 (sonnet; FRONTEND, I18N), write sets as section 5 | S1 and S2 as one slice |
| Q13 | After the build | Register a deploy task that also carries the one-minute sweep (STAGING-DEPLOY-SWEEP-01), then a live task with the PRD.md and ARCHITECTURE.md wording of section 7 | Deploy the sweep on its own first |

## 9. Things that turned out different

| # | Finding |
|---|---|
| P1 | A run is also set to `failed` when the owner rejected every step. "Status failed" alone would tell the Chief of Staff about the owner's own decision. Hence the step-status read (rule 6) |
| P2 | No code sets a run to `timed_out`. A step that waited 24 hours makes its run `failed`. So "timed out" is a category inside failed runs, not a third status to watch |
| P3 | `failed_at` is the settle time, and a run does not settle while any step is open. A failed step in a run with another step waiting is reported only when that step is decided, up to 24 hours later |
| P4 | A failed step's `result_summary` can be the model's own answer, not only an error. It is untrusted either way and is never read |
| P5 | The failure trigger has no use for the run-result tool, so tying it to that switch would stop it for no reason. The tick's first line changes from three switches to two, with completed triggers dropped a few lines later when the tool is off |
| P6 | The pinning spec counts the run service's reads. Two of its numbers go from 1 to 2 in S2 |
| P7 | Between S1 and S2 a saved failure trigger would be treated as a completed trigger by the old timer. S1 therefore includes the one-line skip |
| P8 | The backlog title says "Tell the Chief of Staff when a workflow fails". The board and the brief widen the target to the Chief of Staff or another workflow, which is what the existing target picker already gives. The registered title could be updated at LOCK |
| P9 | The backlog's provisional write scope named "the run-result route or a new failure read". Neither is needed: the read lives in the chain run service |
| P10 | The page's delay sentence says "a few minutes". With the one-minute sweep it is one to two minutes once deployed; the wording is kept loose so it is true before and after |

## 10. Follow-ups noticed (named, not registered)

| # | Follow-up |
|---|---|
| F1 | A deploy task (new name, for example STAGING-DEPLOY-CHAINFAIL-01): STAGING; migration 1816 after the backup; no env change; the deploy checks of section 6. It can carry STAGING-DEPLOY-SWEEP-01 (registered, "rides with the next deploy") |
| F2 | A live task (new name, for example TRIGGER-CHAIN-FAILED-LIVE-01): STAGING, ENV, PROVIDER-LIVE, CREDIT; section 6; the section 7 wording in its LOCK record, GOVERNANCE held |
| F3 | RESULT-TOOL-FAILED-01 (new name): let `read_run_result` answer for a failed run with its completed steps' answers as data. Changes the tool's rule and its description; its own design |
| F4 | TRIGGER-CHAIN-FAILED-REASON-01 (new name): a third fixed category from the execution's allow-listed error (provider not configured, usage limit reached). Reads `usage_records`; its own design. Only if "a step failed" proves too thin in use |
| F5 | TRIGGER-ORIGIN-01 and TRIGGER-WAIT-NOTICE-01 (registered): include failure-chain runs ("started after a workflow failed", with a link to the failed run) |
| F6 | ACCESS-READY-01 (registered): the inventory note of 4.1; the workflow name now reaches the model in failure-chain runs |
| F7 | TRIGGER-TIDY-01 (registered): `source_completed_at` now also holds a failure time; a rename belongs there. TRIGGER-SCALE-01 (registered): a second run read per tick |
| F8 | TRIGGER-UI-POLISH-01 (registered): a native-speaker review of the new zh-TW and zh-CN strings |
| F9 | The Chief of Staff's instructions and eval (the suite COS-EVAL covers): a case where a failure-chain run is asked to explain a failure it cannot read, and must say so instead of inventing a cause. Name at registration |
| F10 | The backlog title of this task (P8): update at LOCK |

## 11. Sources read (all 2026-11-18, in the worktree at 0f3d1f16)

| Source | Used for |
|---|---|
| `AGENTS.md`; `CLAUDE.md` (as given with the brief); `TASKS.md` board (:1-28, :1142-1147, :1250) | boot, admission |
| `TASKS_BACKLOG_FULL.md`: TRIGGER-CHAIN-FAILED-01 (:90069-90086) and TRIGGER-CHAIN-01 (:89844-89862) whole; the status lines of STAGING-DEPLOY-SWEEP-01, TRIGGER-ORIGIN-01, TRIGGER-WAIT-NOTICE-01, ACCESS-READY-01, TRIGGER-TIDY-01, TRIGGER-UI-POLISH-01, TRIGGER-SCALE-01, COS-MAIL-BODY-RULE-01, CHAIN-SOURCE-OFF-01, TRIGGER-TARGET-OFF-01 | scope, registered follow-ups |
| `docs/TRIGGER-CHAIN-01-STAGE-START.md`, `docs/TRIGGER-CHAIN-01-CHECKPOINT.md`, `docs/TRIGGER-CHAIN-LIVE-01-CHECKPOINT.md` (whole) | format, Keith's decisions, the build as landed, live costs |
| `docs/control-plane/task-checklists.md` (whole) | checklists |
| `GW/triggers/`: chain-trigger-run.service.ts, chain-trigger-match.ts, chain-trigger-reasons.ts, chain-trigger-switch.ts, chain-trigger-timer.ts, chain-trigger-validation.ts, chain-trigger.service.ts (whole); chain-trigger.controller.ts (:25-98); schedule.controller.spec.ts (greps, :477-561, :587-722) | the trigger as built, the pins |
| `GW/entities/agent-chain-trigger.entity.ts`, `agent-chain-trigger-run.entity.ts` (whole); `user-agent.entity.ts` (:28-50); `index.ts` (grep) | columns, the name's length |
| `GW/migrations/1814000000000-...`, `1815000000000-...` (whole); `__tests__/` (file list) | migration pattern and order |
| `GW/orchestration/`: collaboration-run.entity.ts, collaboration-result-grant.ts, collaboration-failure-reason.ts, collaboration-sweep.constants.ts, collaboration-sweep.worker.ts (whole); orchestration.service.ts (:130-141, :779-810, :1405-1430, :2053-2115, :2525-2575, :2608-2700, :3770-3880, read only); collaboration-results.ts (:15-40, :110-135, :338-350); internal-collaboration-results.controller.ts (:1-90); collaboration-referral.entity.ts (decorators) | how a run fails, what is stored, the tool's rule |
| `GW/ai/execution-error.ts` (:1-57) | the allow-listed error |
| `ops/clean-baseline/env/gateway.env.template` (switch names and comments only; no values read) | env |
| `FE/components/schedules/chain-triggers.logic.ts`, `chain-triggers-api.ts` (whole); `chain-triggers-section.tsx` (key and test-id greps, :307-334, :645-689); `FE/messages/en.json` (`schedules.chain`) | the page, today's strings |
| `PRD.md` :550, :582-633 (greps and :599, :633); `ARCHITECTURE.md` :187-188, :227, :232, :585, :716-720, :727, :1095, :1120, :1207, :1265 | status, wording drafts |

Not verified:

- anything on the staging host (no host access in this step), including the current `gateway.env` baseline hash and whether Keith's account has a workflow whose run can be made to fail on purpose;
- the way to force a failed run in the live check (section 6 names a candidate from a code comment only);
- that no spec compares entity columns with migration SQL or pins the migration file list;
- that nothing else writes a run's status outside `GW/orchestration/orchestration.service.ts` (the grep covered `GW/` for the `timed_out` assignments; the AI service and container manager do not hold these tables, inferred);
- the frontend baseline count (2241, from an earlier checkpoint) and that the gateway count (6634) still holds on this branch: no test was run;
- the cost of a failure-chain run (inferred, not measured);
- the PostgreSQL cost of the step-status SQL with many runs (the run-id index exists; not measured);
- the Chinese wording, which S3's worker writes;
- that `timeZone`, the claim, and the day limit behave for `failed_at` exactly as for `completed_at` (the same code path by design; proven only when S2's tests exist).

Frozen-file cost: none. `orchestration.service.ts`, `ai-execution.controller.ts`, and the AI service's `job.types.ts` and `worker.processor.ts` are read-only references here and are not in any write set. The two follow-ups that might touch the tool (F3) or execution reads (F4) are outside this task.

CHECKLIST: EVERY 11/11 for this step as a document-only write (1 admitted, TASKS.md:1142-1147; 2 4-step, Step 2; 3 fable passed explicitly by the control plane; 4 self-contained brief, no further subagent; 5 one file, inside the write set; 6 n/a, no behaviour change; 7 n/a, no code, so no gates were run; 8 no runtime started; 9 n/a, no build; 10 commit on lane/TRIGGER-CHAIN-FAILED-01 only, no push or merge; 11 follow-ups named in section 10). Step 3 lists are in section 5.
FOLLOWUPS: 10 named in section 10, none registered here (registration is the control plane's step).
