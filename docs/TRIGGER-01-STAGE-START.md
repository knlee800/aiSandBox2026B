# TRIGGER-01 — Stage-start (Step 2)

Task: TRIGGER-01, schedules that start a workflow (plan `docs/AGENT-OPS-PLAN.md` 3.4, F1, F4). Lane 1, 4-step, Step 2.
Drafted 2026-11-15 by a fable subagent (Fable 5.1; Model Routing gives stage-start drafts to fable) on `lane/TRIGGER-01` (from main 7cca420). This document is the only write.
Nothing here is approved. Step 3 starts only after Keith approves; mutexes and write sets below are proposals.

Path short forms: GW = `services/api-gateway/src`, FE = `frontend`, OPS = `ops/clean-baseline`.
Every code fact was read in this worktree on 2026-11-15. No test, build or runtime was started. "Not verified" marks anything I could not prove from the code.

## 0. Recommendation in short

| Question | Recommendation |
|---|---|
| Where it runs | A new gateway module `GW/triggers/`, in the gateway process, with a 60-second in-process timer. No new service, unit, port, dependency or internal route |
| Tables | `agent_schedules` (the owner's schedules) and `agent_schedule_runs` (one row per schedule per local day; the unique index is the idempotency key). One migration, `1810000000000` |
| What a schedule starts | The Chief of Staff or one of the owner's own workflows, with a fixed task text, through `CollaborationStartService` — the same code as the Team page and Discord. Never a session, so read-only by the existing rule |
| Approval | The saved schedule is the owner's request for the first step, as `/ask` is in Discord. Later steps follow the existing rules (the workflow's approval setting; the Chief of Staff's steps wait for the owner). Nothing in the approval code changes |
| "Due" | Read in the schedule's own IANA time zone with `Intl.DateTimeFormat`. No stored next-run time. At most one start per schedule per local day. Late by more than 60 minutes = recorded as missed, not started |
| Switch | `SCHEDULES_ENABLED`, default false, gates only the timer. Runs still need `GLOBAL_EXECUTION_ENABLED`, the provider switch, credits, caps and harness access |
| Skips | Every skipped occurrence writes one `agent_schedule_runs` row and one audit row with ids and a reason code. Never a retry |
| Owner's notice | The Results unread badge. Discord delivery stays with the registered CHAT-RESULTS-OTHER-01 |
| Slices | S1 tables, service, routes, switch, env template; S2 timer, due rule, start and skip. Then TRIGGER-UI-01, STAGING-DEPLOY-TRIG-01, TRIGGER-LIVE-01 as registered |

No file outside the registered write scope is needed. No frozen-contract file is edited. No stop condition was met.

## 1. Today's facts

### 1.1 The shared start code

| Fact | Reference |
|---|---|
| `CollaborationStartService.start(caller, input)` makes the run and its first hand-off in `pending_approval`. It is the Team page's code, moved out of the controller for Discord | GW/orchestration/collaboration-start.service.ts:60-80, :168-252 |
| Without `sessionId` only the chief-of-staff team or a workflow may start, and only when the signed profile is `read`; the run is anchored on the owner's business session (`ensureForOwner`) | collaboration-start.service.ts:185-193, :389-403; GW/orchestration/collaboration-business-session.ts:63-73 |
| A workflow start is refused before anything is created when the workflow is not the owner's, is off, is invalid, is untested, or is over its per-run or per-day budget | GW/orchestration/collaboration-workflow.ts:60-67, :530-562 |
| The first hand-off's idempotency key is made inside `start` (`screen:` plus a random id). A caller cannot pass its own | collaboration-start.service.ts:213 |
| `approveStep` is `approveReferral` with the owner as `decidedBy` and the tests gate on | collaboration-start.service.ts:259-272 |
| Approve runs every safety check: workflow still on and within budget, provider switch, `ExecutionSafetyGuard` (global switch, provider switch, daily credit caps), abort guard, credit balance, token quota | GW/orchestration/orchestration.service.ts:1112-1160, :1873-1930; GW/safety/execution-safety.guard.ts:56-69, :134; GW/safety/daily-credit-cap.service.ts:31-54 |
| Daily caps are counted per UTC day, platform and per user (defaults 1000 and 500 credits) | daily-credit-cap.service.ts:12-13, :19, :37 |
| Automatic approval acts only on a later step of a run led by a user workflow, for a positively read-only target. The first hand-off and Chief of Staff runs never reach it | orchestration.service.ts:3434-3444, :3474-3479, :3486-3489 |
| `OrchestrationModule` exports `OrchestrationService` and `CollaborationStartService` | GW/orchestration/orchestration.module.ts:93 |
| The task text is trimmed, required, at most 8000 characters | collaboration-start.service.ts:338-352; GW/orchestration/collaboration-team.ts:46 |

### 1.2 The Discord precedent (closest to an unattended start)

| Fact | Reference |
|---|---|
| Discord starts a run as the linked owner with no session: it builds the session guard's identity (`apiKeyId: 'browser-session'`, `harnessEntitled: true` after a live check) | GW/chat/chat-run.service.ts:332-340; GW/auth/session-or-api-key.guard.ts:57-63; GW/chat/chat-commands.ts:175-181 |
| Order: global switch pre-check, limits, start, then approve the first step as the owner; a refusal at approve cancels the run with a reason code | chat-run.service.ts:195-261, :429-439 |
| Refusals are mapped to reason codes from the status, a code and the platform's own message only | chat-run.service.ts:112-141 |
| The switch is one small file: only the exact string `true` is on, read live | GW/chat/chat-switch.ts:15-19 |
| Audit rows hold ids, reason codes and counts; never text | chat-run.service.ts:449-468 |

### 1.3 Timers, results, audit, switches, process

| Fact | Reference |
|---|---|
| The existing in-process timer: `setInterval`, `unref()`, off under Jest, a flag stops overlapping ticks | GW/orchestration/collaboration-sweep.worker.ts:13-22, :31-49 |
| That sweep runs every 5 minutes, settles runs nobody is reading and times out a hand-off that waited 24 hours. So an unattended run finishes without a page open | GW/orchestration/collaboration-sweep.constants.ts:1-2; orchestration.service.ts:2595-2638 |
| Results: `GET /api/results`, `GET /api/results/unread-count`, `POST /api/results/:runId/seen`. Unread = completed, failed or timed out and not opened. Cancelled is never unread | GW/orchestration/collaboration-results.controller.ts:154-175; GW/orchestration/collaboration-results.ts:17-22 |
| `audit_events` is append-only; `category` 32 characters, `event_type` 64, `subject_type` 32, `subject_id` 64, free `payload` | GW/entities/audit-event.entity.ts:3-8, :19-35 |
| `GLOBAL_EXECUTION_ENABLED` is on only for the exact string `true`; provider switches per provider | GW/safety/kill-switch.config.ts:17-19, :64 |
| `SafetyModule` exports `DailyCreditCapService` | GW/safety/safety.module.ts:30-35 |
| Harness access is read live from `user_entitlements` | GW/auth/entitlement.service.ts:63-77 |
| Latest migration is `1809000000000-CreateChatRunDeliveries.ts`; it probes the table state and refuses a wrong before-state in `up` and `down` | GW/migrations/1809000000000-CreateChatRunDeliveries.ts:28-39, :59-66 |
| Every write is covered by the global same-origin guard; link routes use `SessionCookieGuard` plus a live harness check | GW/guards/same-origin-write.guard.ts:33-40; GW/app.module.ts:112-113; GW/chat/chat-link.controller.ts:43-44, :90-99 |
| The gateway on staging is one systemd unit running one Node process | OPS/systemd/aisandbox-gateway.service:11-16; ARCHITECTURE.md:1202-1205 |
| `users` has no time-zone or language column. The morning-briefing preset takes the time zone from the browser | GW/entities/user.entity.ts:20-99; FE/components/collaboration/collaboration-page.tsx:103 |
| An IANA time zone is already validated with `Intl.DateTimeFormat` (no library) | GW/connectors/connector-broker.ts:452-460; services/connectors-mcp/src/clients/ical-feed.ts:40-43, :91 |
| The tester window appears in no source or env file. It is a sidecar value the validator reads | scripts/validate-lane-capacity.ps1:1084-1090 |
| `GW/startup/configuration.validator.ts` names `GLOBAL_EXECUTION_ENABLED` (:252) but not `CHAT_DISCORD_ENABLED`; a new off-by-default flag needs no validator change | configuration.validator.ts:252 |

Constraint: `GW/orchestration/orchestration.service.ts` and `GW/ai/ai-execution.controller.ts` are in the frozen contract HARNESS_ENTITLEMENT_PROOF_V1 (`docs/control-plane/lane-saturation-state.json:9767-9771`). This design edits neither, and nothing else under `GW/orchestration/` or `GW/chat/`.

## 2. Data model

One migration: `GW/migrations/1810000000000-CreateAgentScheduleTables.ts` (next after 1809000000000), in the probe-guarded style of 1809. `down()` refuses unless both tables are present, then drops `agent_schedule_runs` and `agent_schedules`; it loses schedules and their history only. Runs and results stay.

`agent_schedules`

| Column | Type | Note |
|---|---|---|
| `id` | uuid, primary key | |
| `user_id` | uuid, foreign key to `users`, cascade delete | the owner |
| `target_kind` | varchar(16), CHECK `chief-of-staff` or `workflow` | |
| `workflow_id` | uuid null, no foreign key | set only when `target_kind = workflow` (CHECK). No foreign key, so a deleted workflow leaves the schedule to be skipped with a reason instead of vanishing |
| `task` | text, CHECK length 1 to 8000 | the task text; owner data |
| `time_of_day` | smallint, CHECK 0 to 1439 | minutes after local midnight |
| `days` | smallint, CHECK 1 to 127 | bit mask, Monday = 1 … Sunday = 64 |
| `time_zone` | varchar(64) | IANA name, sent by the Schedules page from the browser and editable there |
| `enabled` | boolean, default true | the owner's own on/off |
| `armed_at` | timestamptz | set at create, at switch-on, and when time, days or zone change. An occurrence earlier than this is not evaluated |
| `created_at`, `updated_at` | timestamptz | |

Index: (`user_id`). Index: (`enabled`).

`agent_schedule_runs` (the idempotency record and the "last run" source)

| Column | Type | Note |
|---|---|---|
| `id` | uuid, primary key | |
| `schedule_id` | uuid, foreign key to `agent_schedules`, cascade delete | |
| `user_id` | uuid | copied, for owner-scoped reads |
| `local_date` | date | the owner's local date of the occurrence |
| `outcome` | varchar(16), CHECK `claimed`, `started`, `skipped` | |
| `reason` | varchar(32) null | a reason code from section 5 |
| `collaboration_run_id` | text null | set when a run was created |
| `created_at` | timestamptz | |

Unique (`schedule_id`, `local_date`). Index (`user_id`, `created_at`). No task or result text. Rows older than 90 days are pruned by the timer.

"Last run" is read from the newest row; no `last_run` column to keep in step.

## 3. The timer

| Point | Design |
|---|---|
| Shape | `ScheduleTimer` in `GW/triggers/`, copied from the sweep worker's pattern: `setInterval` every 60 seconds, `unref()`, nothing under Jest unless a test allows it, a flag stops overlapping ticks, errors logged by name only |
| Flag off | The tick returns at once. The table is not read, nothing is evaluated, no row is written |
| Each tick | Read the enabled schedules (at most 200 per tick, oldest evaluation first; today the table is tiny). For each, compute the local date, weekday and minute in `time_zone` with `Intl.DateTimeFormat`. Pure function `scheduleDue(schedule, now)` in its own file |
| Due | Today's weekday is ticked, local minute >= `time_of_day`, the occurrence is after `armed_at`, and no `agent_schedule_runs` row exists for (schedule, local date) |
| On time or late | Within 60 minutes of `time_of_day`: start. Later than that (a restart, a long deploy): one `skipped / missed` row and audit row. No catch-up for earlier days: only today's local date is ever looked at |
| DST | Spring forward: a time inside the missing hour is first seen after the jump and starts then. Fall back: the first 01:30 starts; the second finds the day's row. Both follow from the unique index and are table-tested (America/New_York 2026-03-08 and 2026-11-01; Asia/Singapore; a zone a day ahead of UTC) |
| Idempotency | Claim first: insert the (`schedule_id`, `local_date`) row with `outcome = claimed`. A unique violation means another tick or process has it: stop. Only the inserter starts the run |
| No retry | The claimed row is the day's one attempt. Whatever happens next (started, skipped, an error) it is never tried again that day. A `claimed` row older than 10 minutes with no run is closed as `skipped / interrupted` with an audit row |
| Two processes | Staging runs one gateway process (section 1.3). If two ever ran, both timers would tick and the unique index lets exactly one claim each occurrence. No lock, no leader election |
| Load | At most 5 starts per tick, the rest wait for the next tick (still inside the 60-minute window) |

The start service makes its own random hand-off key (section 1.1), so the plan's "idempotency key" is this unique index, not the hand-off's key. See P3.

## 4. Starting the run

1. Claim the occurrence (section 3).
2. Pre-checks, each a skip with nothing else created: `GLOBAL_EXECUTION_ENABLED` off; owner missing or inactive; no harness access (read live); workflow row gone; the owner's daily cap already reached (`DailyCreditCapService.assertWithinDailyCap`, read-only).
3. Build the page's body, `{team: 'chief-of-staff', task}` or `{workflowId, task}`, read by `readStartBody`. Never a `sessionId`, never `testRun`.
4. `CollaborationStartService.start` with the identity the session guard builds for the owner (as chat-run.service.ts:332-340).
5. `approveStep` for the first hand-off with `decidedBy` = the owner.
6. A refusal at step 4 or 5 is mapped to a reason code; a run that was created is cancelled through `cancelCollaboration` with `schedule_skipped:<reason>`. The row becomes `skipped`.
7. Otherwise the row becomes `started` with the run id, and one `run_started` audit row is written.

| Decision | Recommendation and reason |
|---|---|
| D1 Profile | Read-only, as Discord. A start with no session is read-profile only by the existing rule, and an unattended run that could write, send or delete has no one watching. The coding and advisors teams need a session and cannot be scheduled |
| D2 First step | The schedule approves it as the owner. The owner wrote the task, picked the target and switched the schedule on; that is the request for exactly this step, the same reasoning Keith accepted for `/ask` (CHAT-DISCORD-01 Q7). Every check in `approveReferral` still runs. Without this a schedule only makes a waiting item each morning |
| D3 APPROVAL-SET-01 | Not changed and not needed for the first step. The automatic-approval code still never touches a first hand-off. Later steps: a workflow lead set to "automatic for read-only" or "only over X credits" proceeds as today; a lead set to "every hand-off", and every Chief of Staff run, waits for the owner on the Team page and times out after 24 hours |
| D4 Unchanged checks | Entitlement, workflow on and tested, workflow budgets, provider switch, global switch, daily caps, credits, token quota: all run in the existing code. This module adds pre-checks only to avoid creating a run that would be cancelled |
| D5 Refusal mapping | `GW/triggers/` has its own small mapper with the same rules as `chatRunRefusalOf`, pinned by a test against the same messages. Sharing one mapper is follow-up F6 (it would edit `GW/chat/`, outside this write scope) |
| D6 No orchestration edits | The module calls only exported services. If the implementer finds an edit under `GW/orchestration/`, `GW/chat/` or `GW/ai/` is needed: stop and return |

## 5. Skip rules and audit

| Reason code | When | A run row was created? |
|---|---|---|
| (none; silent) | `SCHEDULES_ENABLED` off: the timer does nothing | no |
| `runs_off` | `GLOBAL_EXECUTION_ENABLED` is not `true` | no |
| `inactive` | owner missing or not active | no |
| `not_entitled` | no harness access now | no |
| `workflow_gone` | the workflow row is gone or not the owner's. The schedule is also switched off (`schedule_disabled` audit row), so it does not skip every day | no |
| `workflow_off`, `workflow_not_tested`, `workflow_invalid`, `workflow_budget` | the start's own refusals | no |
| `over_cap` | daily platform or per-user cap reached, or token quota | no at the pre-check; cancelled if found at approve |
| `provider_off`, `no_credits` | found at approve | created, then cancelled |
| `missed` | more than 60 minutes late | no |
| `interrupted` | claimed but never finished (restart mid-start) | maybe; left as it is |
| `refused` | anything else | cancelled if created |

Audit rows (`audit_events`, category `trigger`, subject type `agent_schedule`, subject id = the schedule id, `user_id` = the owner): `schedule_created`, `schedule_updated`, `schedule_deleted`, `schedule_disabled`, `run_started`, `run_skipped`. The payload holds the schedule id, local date, target kind, workflow id, run id and reason code only. Never the task text. One `run_skipped` row per skipped occurrence. Log lines carry the same ids and codes.

Tester window: nothing in code knows about it, and `SCHEDULES_ENABLED` is a separate flag that a window-opening task does not touch. A window turns runs on; schedules stay off unless a registered task holding ENV sets the flag. The rule is added to the tester-window checklist as follow-up F5. While a window is open with the flag off, the timer is silent.

A cancelled run (the two "created, then cancelled" rows) shows in Results as cancelled and is never unread. The owner sees a skip on the Schedules page, from the last `agent_schedule_runs` row.

## 6. The owner's notice

| Item | Position |
|---|---|
| Finished scheduled run | The Results unread badge, unchanged (completed, failed and timed out count as unread). This is the notice TRIGGER-01 names |
| Skipped occurrence | The Schedules page shows each schedule's last outcome and reason. No badge |
| A step waiting for approval | Team page only, today. Nothing tells the owner. Named as F2 |
| Discord | Not in TRIGGER-01. CHAT-RESULTS-OTHER-01 is registered for exactly this ("runs started on the Team page and later triggers") and owns `GW/chat/`. It needs an opt-in and a look at what leaves to Discord |
| "Started by a schedule" on the Results list | Not in TRIGGER-01: it needs a field on the Results route, under `GW/orchestration/`. Named as F3. Until then the Schedules page links each last run to its result |

## 7. API routes (the frozen contract for TRIGGER-UI-01)

Controller `schedules` in `GW/triggers/`. `SessionCookieGuard` only: a schedule is a standing instruction to spend, so an API key alone gets 401 (as the chat link routes). Harness access is read live: without it 403. Writes are covered by the global same-origin guard; no new CSRF code. Every lookup is by owner; another owner's id, an unknown id and an unknown workflow all answer 404.

| Route | Does |
|---|---|
| `GET /api/schedules` | `{ enabled, runsEnabled, limit, schedules: [...] }`; `enabled` is `SCHEDULES_ENABLED` |
| `POST /api/schedules` | creates one (201) |
| `PATCH /api/schedules/:id` | changes task, target, time, days, zone or `enabled` |
| `DELETE /api/schedules/:id` | deletes it and its history rows |
| `GET /api/schedules/:id/runs` | the last 30 history rows (ids, local date, outcome, reason, run id) |

A schedule in a response: `id`, `target` (`{kind: 'chief-of-staff'}` or `{kind: 'workflow', workflowId, name, status}`), `task`, `timeOfDay` (`"HH:MM"`), `days` (numbers 1 to 7, Monday = 1), `timeZone`, `enabled`, `createdAt`, `updatedAt`, `lastRun` (`{localDate, outcome, reason, collaborationRunId, at}` or null).

Validation: `task` by the page's rule (trimmed, 1 to 8000); `timeOfDay` `HH:MM`, 00:00 to 23:59; `days` a non-empty set of 1 to 7; `timeZone` a string of at most 64 characters that `Intl.DateTimeFormat` accepts; `workflowId` one of the owner's own workflows (off or untested is allowed at save and shown; it is refused at run time with its reason). Body fields not listed are refused. Nothing in the body sets provider, model, approval, budget or profile.

Limits: 5 schedules per owner, switched on or not (409 with a code past that). One start per schedule per local day by the unique index.

With `SCHEDULES_ENABLED` off the routes still work; the page shows "schedules are switched off; nothing will start". The flag gates the timer, not the owner's data (Q5).

## 8. Env

| Key | Where | Default |
|---|---|---|
| `SCHEDULES_ENABLED` | `OPS/env/gateway.env.template`, with a comment line: off unless exactly `true`; it never turns runs on; a tester window never sets it | `false` |

Read by `GW/triggers/schedule-switch.ts`, the same shape as `chat-switch.ts`. No interval setting: the 60-second tick, the 60-minute window and the limit of 5 are code constants with tests. Fewer knobs, fewer baseline changes. STAGING-DEPLOY-TRIG-01 adds the line to the host `gateway.env` as `false`, which changes that file's baseline hash once.

## 9. Privacy and safety

| Topic | Position |
|---|---|
| Task text | Owner data. Stored in `agent_schedules.task` and, per run, where every task is stored today. Never in audit rows or logs (a test asserts the log and audit calls). Deleted with the schedule; removed with the account by the cascade |
| What leaves the platform | Nothing new. A scheduled run sends to the model provider what the same run from the Team page sends |
| Prompt injection | Unchanged. The task is the owner's own saved text; tool text is data; the run is read-only; limits are the tools granted, not the prompt |
| Unattended spend | Bounded by: 5 schedules per owner, one start each per local day, workflow budgets, the per-user and platform daily caps, credits, and three switches (`SCHEDULES_ENABLED`, `GLOBAL_EXECUTION_ENABLED`, the provider switch) |
| Who can change a schedule | Only the signed-in owner. Not an API key, not Discord, not an agent |
| Other users | Gated per account by harness access, read live at save and at every tick |
| Retention | History rows 90 days. Audit rows stay (ids and codes only) |

## 10. i18n

| Text | Task | Where | Mutex |
|---|---|---|---|
| Backend | TRIGGER-01 | None. The routes answer codes and ids; no sentence is shown to a user. The gateway's own locale files are not touched | — |
| Schedules page: headings, form labels, day names, time and zone fields, empty, loading, error and saved states, the "switched off" banner, the limit notice, the read-only and approval hints, every reason code in section 5 as a sentence | TRIGGER-UI-01 | `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | I18N |
| Header link to Schedules | TRIGGER-UI-01 | same three files | I18N |
| A "started by a schedule" label in Results | F3, not now | — | — |

TRIGGER-UI-01's test asserts that every reason code this document lists has a key in all three files.

## 11. Slices for Step 3

Baseline: gateway `npx jest --maxWorkers=2` 4623 passed, 7 skipped, plus the 14 known `smoke.integration` failures that need a database; `npm run build` rc 0. Frontend, ai-service and container-manager are not touched and not rerun.

Common stop conditions: a needed edit outside the write set; any edit to a frozen-contract file or under `GW/orchestration/`, `GW/chat/`, `GW/ai/`, `GW/auth/`, `GW/guards/`; a new dependency; a gate failure not in the known list.

| Slice | What | Write set (N = new) | Mutexes | Model |
|---|---|---|---|---|
| **S1** Tables, service, routes | Migration; two entities; switch; schedule service (create, list, change, delete, history, limit, validation, owner scoping); controller; CRUD audit rows; module wired in; env template key. No timer | N `GW/migrations/1810000000000-CreateAgentScheduleTables.ts` and its spec under `GW/migrations/__tests__/`; N `GW/entities/agent-schedule.entity.ts`, `agent-schedule-run.entity.ts`; `GW/entities/index.ts`; N `GW/triggers/triggers.module.ts`, `schedule-switch.ts`, `schedule.service.ts`, `schedule.controller.ts`, `schedule-validation.ts`, their specs; `GW/app.module.ts`; `OPS/env/gateway.env.template` | GATEWAY, MIGRATION, ENV | opus (migration; new owner-scoped routes) |
| **S2** Timer, due rule, start and skip | `scheduleDue`; the timer; claim; pre-checks; start and approve through `CollaborationStartService`; refusal mapping; cancel on refusal; run and skip audit rows; closing interrupted claims; the 90-day prune | N `GW/triggers/schedule-due.ts`, `schedule-timer.ts`, `schedule-run.service.ts`, `schedule-refusal.ts`, their specs; `GW/triggers/triggers.module.ts` | GATEWAY | opus (unattended spend, the approval gate, cross-module calls) |

S1 then S2, one after the other (both hold GATEWAY). The section 7 route shapes are frozen when S1 locks, so TRIGGER-UI-01 could run beside S2 (FRONTEND and I18N against GATEWAY, no shared file) if the control plane admits it then; as registered it waits for TRIGGER-01's LOCK.

Gates for both slices: `services/api-gateway`: `npx jest --maxWorkers=2` (4623 plus the new tests, 7 skipped, the same 14 known failures) and `npm run build` rc 0. S1 also shows `git diff --stat` with no file outside its write set.

Tests to add and acceptance criteria:

| Slice | Criteria (each with a test) |
|---|---|
| S1 | (1) Migration `up` refuses when either table exists; `down` refuses unless both exist; the unique index, CHECKs and both cascades are in the SQL. (2) Routes: 401 without a session and with an API key alone; 403 without harness access. (3) Another owner's schedule id and another owner's workflow id answer 404; nothing is changed. (4) Validation of section 7, including an invalid zone and an empty day set. (5) The sixth schedule is refused. (6) Changing time, days or zone, or switching on, sets `armed_at`. (7) Audit rows carry no task text; no log call carries it. (8) `SCHEDULES_ENABLED`: only exact `true` is on; routes work when off and report `enabled: false`. (9) The gateway boots with the flag unset |
| S2 | (1) `scheduleDue` table tests: weekday mask, before and after the time, the 60-minute window, `armed_at`, the DST dates and zones of section 3, the day boundary. (2) Flag off: the tick reads nothing and writes nothing. (3) Two concurrent claims for one occurrence: one start. (4) A second tick the same local day: nothing. (5) Each reason code of section 5 from its cause, with one row and one audit row, and no retry on the next tick. (6) A refusal at approve cancels the run with the reason. (7) The start body never has `sessionId` or `testRun`; the identity equals the session guard's. (8) The stored first hand-off equals the Team page's for the same owner and body (as the Discord test compares). (9) `workflow_gone` switches the schedule off. (10) No timer under Jest unless allowed; ticks never overlap. (11) `git diff --stat` shows no file under `GW/orchestration/`, `GW/chat/` or `GW/ai/` |

CHECKLIST plan for Step 3 (from `docs/control-plane/task-checklists.md`, copied into each brief from that file): S1 meets EVERY, BACKEND and MIGRATION; S2 meets EVERY and BACKEND (MIGRATION n/a: no schema change in S2). UI and FLOWS do not apply (no frontend; no checkpoint, revert or file-action change). MIGRATION item 1 names grok-4.7-xhigh for a Cursor run; with a Claude subagent the Model Routing table gives migrations to opus.

## 12. Live checks (TRIGGER-LIVE-01, driven from the staging host)

Staging today: runs off, every provider switch off, tester window closed (TASKS.md:1105). So, as with Discord, the check is staged.

**Inside STAGING-DEPLOY-TRIG-01 (flag off, no runs, no credits):** migration 1810 applied after the backup; the gateway boots; `SCHEDULES_ENABLED=false` on the host; Keith creates, edits and deletes a schedule on the page and sees the "switched off" banner; the host confirms the rows and the CRUD audit rows hold no task text, and that no `agent_schedule_runs` row appears across a due time.

**TRIGGER-LIVE-01 (a run window: STAGING, ENV, PROVIDER-LIVE, CREDIT; tester window closed):**

| # | Who | Step | Pass |
|---|---|---|---|
| 1 | Host | Set `SCHEDULES_ENABLED=true` only; runs still off. Keith's schedule is due in a few minutes | one `skipped / runs_off` row and audit row; no run row; no second attempt on later ticks |
| 2 | Host | Open the run window (stored Anthropic test key, global and Anthropic switches on, write tools off). Keith makes a second schedule a few minutes ahead, Chief of Staff, a marker word in the task | at the minute: one `started` row, one run, first step approved by the owner id; the answer appears; the Results badge shows 1 |
| 3 | Host | Restart the gateway just after the start | no second run for that local date |
| 4 | Keith | A schedule for one of his workflows set to "every hand-off" that hands off | the child step waits on the Team page; nothing auto-approves |
| 5 | Host | A schedule made for a time 2 hours ago today | not evaluated (after `armed_at` rule); no row |
| 6 | Host | Per-user daily cap set to a value already reached, a schedule due | `skipped / over_cap`; no run row |
| 7 | Host | Search the journal and `audit_events` for the marker word | absent from both |
| 8 | Host | Cost of the scheduled runs from the usage rows | recorded |
| 9 | Host | Everything off; env files back to the baseline hashes byte for byte, `SCHEDULES_ENABLED=false` | hashes match; a due schedule writes nothing |

## 13. PRD.md and ARCHITECTURE.md wording (drafts for Keith; lands with the TRIGGER-LIVE-01 record, GOVERNANCE held)

PRD.md section 11, GATED table, new row:

> | Schedules: an owner sets a time, days and time zone at which the Chief of Staff or one of their own workflows starts with a saved task; at most one start per schedule per day and five schedules per owner; runs are read-only; the first step starts without a click, later steps follow the usual approval rules; a skipped start is recorded with its reason and is not retried; the result shows in Results | Gated per account (harness access) and behind `SCHEDULES_ENABLED` (default off); proven on staging DATE (TRIGGER-LIVE-01); not in the private-beta promise |

PRD.md:627, the triggers clause of one sentence replaced:

> The Discord chat channel and schedules are now GATED (see GATED); LINE, WhatsApp, WeChat via WeCom and Slack, and the other triggers (before a calendar event, matching mail), come later, off by default with daily limits.

PRD.md section 8, new non-goal line (plan section 7); PRD.md:472 is left as it is:

> - **Platform maintenance schedulers**: The schedules feature (GATED, section 11) starts an owner's own workflow at a time the owner set. It is not a maintenance scheduler: no cron-based session cleanup or platform housekeeping jobs exist.

ARCHITECTURE.md:188 (section 2) replaced:

> - User-visible schedules (TRIGGER-01) are GATED: an in-process gateway timer, off by default (`SCHEDULES_ENABLED`), one start per schedule per local day, bounded by the daily caps. See 13.7. They never touch session idle or lifetime.

ARCHITECTURE.md:1210 (section 15), one clause added to the list of in-process timers:

> …; the Gateway's in-process schedule timer (TRIGGER-01, 60 seconds, off unless `SCHEDULES_ENABLED`) starts owners' scheduled runs — none of these touches session idle)

ARCHITECTURE.md, new subsection after 13.6:

> ### 13.7 Triggers (GATED)
> The gateway module `triggers/` starts runs at times an owner set. `agent_schedules` holds the owner, the target (the Chief of Staff or one of the owner's workflows), the task text, a time of day, days and an IANA time zone. A 60-second in-process timer, active only when `SCHEDULES_ENABLED` is exactly `true`, reads the local time in each schedule's zone and claims an occurrence by inserting into `agent_schedule_runs`, whose unique index on schedule and local date allows one start per schedule per local day across restarts and processes. A claimed occurrence is never retried; one more than 60 minutes late is recorded as missed. The start goes through the same start code as `POST /api/collaboration/runs`, as the owner, without a session, so read-profile only; the timer approves the first step as the owner, and the approval gate, entitlements, credits, daily caps and provider switches apply unchanged. Skips (runs off, no access, workflow gone or off, cap, credits, provider off, missed) write a history row and an `audit_events` row with ids and a reason code; task text is never logged or audited. `SCHEDULES_ENABLED` never enables runs and is not set by a tester window. The schedule routes need a browser session.

Smaller lines: section 3 gateway list ("Triggers (`agent_schedules`, `agent_schedule_runs`, `/api/schedules`; TRIGGER-01)"); section 7 a data-model row for the two tables; section 8 the five `/api/schedules` routes; 13.1 a status row.

## 14. Open questions for Keith (recommendation first)

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| Q1 | May a schedule start its first step without a click? | Yes: the saved schedule is the owner's request, every check still runs | No: each occurrence waits for approval on the Team page |
| Q2 | Read-only only? | Yes, as Discord (no session) | Allow a project session later, as its own task (F4) |
| Q3 | "One per owner per local day" means | One per schedule per local day, at most 5 schedules per owner | One scheduled start per owner per day in total |
| Q4 | Late start after a restart | Start if at most 60 minutes late, else record `missed` | Start any time the same local day |
| Q5 | Routes while `SCHEDULES_ENABLED` is off | Work, with a "switched off" banner (lets the deploy check use the page) | Refuse writes with 503, as the chat link routes do |
| Q6 | Flag off: record each passed occurrence? | No: silent, the timer reads nothing | Yes: one `skipped` row per occurrence |
| Q7 | Who may manage schedules | Browser session only | Session or API key, as the Team page routes (host-driven checks get easier; a leaked key could plant a standing schedule) |
| Q8 | Discord delivery of scheduled results | Later, in CHAT-RESULTS-OTHER-01 | Now, in TRIGGER-01 (adds `GW/chat/` to the write set) |
| Q9 | Max schedules per owner | 5 | Another number |
| Q10 | A deleted workflow | The schedule is switched off with a reason | The schedule is deleted with it |
| Q11 | Migration: one for both tables | One (1810) | Two |
| Q12 | After the live check | `SCHEDULES_ENABLED` back to false with the baselines; schedules on staging need runs on, which is a later decision | Leave it on (it would only write `runs_off` skips) |

## 15. Things in the plan and records that turned out different

| # | Finding |
|---|---|
| P1 | The records say TRIGGER-LIVE-01 amends "ARCHITECTURE.md lines 177 and 1116". Today :177 is the heading "Determinism" and :1116 is blank. The lines meant are :186-188 (section 2, schedulers; :188 already names TRIGGER-01 as approved FUTURE) and :1209-1210 (section 15). The drafts in section 13 use those. PRD.md:472 is still the session-cleanup line and is left alone |
| P2 | "New section 13.7": 13.6 is now Chat channels, so 13.7 is free and fits |
| P3 | "One idempotency key per owner per local day": the start service makes its own random hand-off key (collaboration-start.service.ts:213) and a caller cannot set it. The idempotency record is the unique index on `agent_schedule_runs`. It is per schedule per local day (Q3) |
| P4 | "Skipped when a cap would be exceeded": the caps are counted per UTC day (daily-credit-cap.service.ts:19), not the owner's local day. The cap check is reused as it is |
| P5 | "Never enabled by a tester window": nothing in code or env knows the tester window. It is kept by the flag being separate and by a checklist line (F5), not by code |
| P6 | "No retry" also applies to `runs_off`: a schedule due during the few minutes a deploy pauses runs (GOV-DEPLOY-WINDOW-01) is skipped for that day |
| P7 | The brief named `collaboration-roster*` and `collaboration-teams.ts` as inputs. The schedule needs neither directly: the roster is read inside `start` for a Chief of Staff run, as on the page |
| P8 | The brief asked for an interval setting in the env template. Section 8 recommends none (constants) |
| P9 | The body's write scope is enough as registered. `GW/entities/index.ts` and the migration spec fall inside `entities/` and `migrations/` |
| P10 | LIMITS-PER-USER-01 and TESTER-WINDOW-01 have no body under those headings in `TASKS_BACKLOG_FULL.md`; they appear only inside other records (for example :84324 and TASKS.md:1105). Not needed for this design |
| P11 | MIGRATION checklist item 1 names only grok-4.7-xhigh; Model Routing gives a subagent migration to opus. The lists differ in wording, not in intent |

## 16. Follow-ups noticed (named, not registered)

| # | Follow-up |
|---|---|
| F1 | CHAT-RESULTS-OTHER-01 (registered): include scheduled runs, and say so in its body |
| F2 | TRIGGER-WAIT-NOTICE-01: tell the owner when a step of an unattended run waits for approval (badge or Discord) |
| F3 | TRIGGER-ORIGIN-01: show "started by a schedule" on the Results list and the Team page (a field on the Results route) |
| F4 | TRIGGER-SESSION-01: schedules for the coding and advisors teams, which need a project session and a write decision |
| F5 | A line in the tester-window checklist and in `docs/control-plane/task-checklists.md` (DEPLOY or LIVE): a window never sets `SCHEDULES_ENABLED` (governance record) |
| F6 | REFUSAL-MAP-01: one shared refusal-to-reason mapper for chat and triggers |
| F7 | APPROVAL-SET-02 (registered): once the Chief of Staff roster has an approval setting, scheduled Chief of Staff runs can go past their first hand-off unattended; say so in its body |
| F8 | TRIGGER-SCALE-01: a stored next-due time and index when the number of schedules makes the per-tick read too wide; with it, more than one start a day if ever wanted |
| F9 | Privacy inventory: add `agent_schedules.task` to the list of stored owner text, before any second user (ACCESS-READY-01) |
| F10 | Schedules-on on staging needs runs on outside a run window; that is a tester-window or launch decision, not this task (Q12) |
| F11 | Align the MIGRATION checklist's model line with Model Routing for subagents (P11) |

## 17. Sources read (all 2026-11-15, in the worktree at 7cca420)

| Source | Used for |
|---|---|
| `AGENTS.md`; `CLAUDE.md` (as given in the brief); `TASKS.md` board (:1-28, :994-999, :1102-1105) | boot, admission, tester window state |
| `TASKS_BACKLOG_FULL.md` :88653-88760 (TRIGGER-01, TRIGGER-UI-01, STAGING-DEPLOY-TRIG-01, TRIGGER-LIVE-01), :88022 (APPROVAL-SET-02), :88333 (CHAT-RESULTS-OTHER-01) | scope, notes, registered follow-ups |
| `docs/AGENT-OPS-PLAN.md` section 0 row 42, 3.4, F rows, section 7 (last changed 2026-11-15) | plan |
| `docs/CHAT-DISCORD-01-STAGE-START.md` (2026-11-13) | format and precedent decisions |
| `docs/control-plane/task-checklists.md`; `docs/control-plane/lane-saturation-state.json:9767-9771` | checklists, frozen contract paths |
| `GW/orchestration/`: collaboration-start.service.ts, collaboration-business-session.ts, collaboration-sweep.worker.ts and constants, collaboration-run.entity.ts, collaboration-results.ts and controller, collaboration-workflow.ts (:60-67, :530-611), orchestration.service.ts (:1112-1160, :1873-1930, :2595-2638, :3430-3575), orchestration.module.ts, collaboration.controller.ts (:192-229) | start, approve, sweep, results |
| `GW/chat/`: chat-run.service.ts, chat-switch.ts, chat.module.ts, chat-link.controller.ts, chat-delivery.service.ts (:1-140), chat-commands.ts (:175-181) | precedent |
| `GW/safety/`: execution-safety.guard.ts, kill-switch.config.ts, daily-credit-cap.service.ts, safety.module.ts; `GW/auth/entitlement.service.ts`, session-or-api-key.guard.ts; `GW/guards/same-origin-write.guard.ts`; `GW/app.module.ts`; `GW/startup/configuration.validator.ts` (:252) | switches, caps, guards |
| `GW/migrations/1809000000000-CreateChatRunDeliveries.ts`, the migrations list and README; `GW/entities/audit-event.entity.ts`, chat-run-delivery.entity.ts, user.entity.ts, index.ts | migration style, audit, entities |
| `GW/connectors/connector-broker.ts:452-460`; `services/connectors-mcp/src/clients/ical-feed.ts`; `FE/components/collaboration/collaboration-page.tsx:103` | time zone precedent |
| `OPS/env/gateway.env.template` (key names only, no values read); `OPS/systemd/aisandbox-gateway.service`; `scripts/validate-lane-capacity.ps1:1084-1090` | env, process model, tester window |
| `PRD.md` :472, :484, :593, :627; `ARCHITECTURE.md` :177, :186-188, :1116, :1150-1152, :1199-1210 | wording drafts |

Not verified: how many gateway processes run on the host right now (read from the unit file, not the host); behaviour of `Intl.DateTimeFormat` for every zone on the host's Node build (the S2 table tests pin the cases named).

CHECKLIST: EVERY 11/11 for this step as a document-only write (1 admitted; 2 4-step, Step 2; 3 fable passed explicitly; 4 self-contained brief, no further subagent; 5 one file, inside the write set; 6 n/a, no behaviour change; 7 n/a, no code, so no gates were run; 8 no runtime started; 9 n/a, no build; 10 commit on lane/TRIGGER-01 only, no push or merge; 11 follow-ups named in section 16). Step 3 lists are in section 11.
FOLLOWUPS: 11 named in section 16, none registered here (registration is the control plane's step).
