# TRIGGER-01 — Checkpoint

**Task:** TRIGGER-01 — Schedules that start a workflow
**Status:** COMPLETE AND LOCKED — 2026-11-15. Built, not deployed: STAGING-DEPLOY-TRIG-01 (after TRIGGER-UI-01) and TRIGGER-LIVE-01 follow.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** GATEWAY (S1 and S2), MIGRATION and ENV (S1).
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan section 3.4, F1 and F4). Keith chose Phase 4 on 2026-11-15 ("Start triggers (Stage 6)").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex | 7cca420 |
| 2. Stage-start | `docs/TRIGGER-01-STAGE-START.md`, fable subagent (Fable 5.1, stage-start drafts) | 6786647 |
| 2. Approval, slice S1 admitted | Keith: "Yes, approve all twelve"; GATEWAY, MIGRATION, ENV | 3a56112 |
| 3. Slice S1 | opus subagent (Opus 5.5: a migration and new owner-scoped routes), fast-forwarded | 566ef48 |
| 3. S1 landed, slice S2 admitted | GATEWAY; MIGRATION and ENV released | 40a8fb0 |
| 3. Slice S2 | opus subagent (Opus 5.5: unattended spend, the approval gate, cross-module calls), fast-forwarded | bf6e4c4 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Keith's decisions (2026-11-15, stage-start section 14, all as recommended)

| # | Decision |
|---|---|
| Q1 | The saved schedule is the owner's request for the first step: it starts without a click; every check in the approve path still runs |
| Q2 | Read-only only: no session, so read-profile by the existing rule; coding and advisors teams cannot be scheduled |
| Q3 | One start per schedule per local day; at most 5 schedules per owner |
| Q4 | Start if at most 60 minutes late, otherwise record `missed` |
| Q5 | The routes work while `SCHEDULES_ENABLED` is off; GET reports `enabled: false` |
| Q6 | Switch off: the timer is silent, it reads and writes nothing |
| Q7 | Browser session only (no API key) |
| Q8 | Discord delivery of scheduled results later, in CHAT-RESULTS-OTHER-01 |
| Q9 | 5 schedules per owner |
| Q10 | A schedule whose workflow is gone is switched off with a reason |
| Q11 | One migration for both tables (1810) |
| Q12 | `SCHEDULES_ENABLED` back to false after the live check |

## What changed (services/api-gateway/src unless noted)

- **Slice S1 (566ef48, 16 files):**
  - migration `1810000000000-CreateAgentScheduleTables` with `agent_schedules` and `agent_schedule_runs`; the unique (schedule_id, local_date) index is the idempotency record; CHECKs and cascades; up and down refuse a wrong before-state;
  - the entities `AgentSchedule` and `AgentScheduleRun`;
  - `triggers/`: the module, `ScheduleService`, `ScheduleController`, validation and the `SCHEDULES_ENABLED` switch (exact `true` only, read live);
  - the five `/api/schedules` routes, guarded by `SessionCookieGuard` with harness access read live; owner-scoped (404 otherwise); a limit of 5 (409); `armed_at` re-set on switch-on and on time, days or zone changes;
  - `schedule_created`, `schedule_updated` and `schedule_deleted` audit rows, holding ids and the target kind only;
  - `app.module.ts`, `entities/index.ts`, and `ops/clean-baseline/env/gateway.env.template` (`SCHEDULES_ENABLED=false`).
- **Slice S2 (bf6e4c4, 10 files):**
  - `schedule-due.ts`: the due rule in the schedule's IANA zone with `Intl.DateTimeFormat`, the 60-minute window, `armed_at`, DST table tests;
  - `schedule-timer.ts`: 60 seconds, `unref()`, no timer under Jest, no overlapping ticks, silent while the switch is off;
  - `schedule-run.service.ts`: claim by inserting the day's row, then pre-checks (runs off, inactive, no harness access, workflow gone, daily cap), then `CollaborationStartService.start` as the owner with the session guard's identity and the Team page's body (never `sessionId` or `testRun`), then `approveStep` for the first hand-off. A refusal cancels a created run with `schedule_skipped:<reason>`. There is no retry that day. A claim older than 10 minutes is closed as `interrupted`, history is kept 90 days, and at most 5 starts and 200 schedules are handled per tick;
  - `schedule-refusal.ts`: reason codes, pinned to the chat mapper on the same errors;
  - `run_started`, `run_skipped` and `schedule_disabled` audit rows;
  - `triggers.module.ts` imports OrchestrationModule and SafetyModule;
  - `schedule.controller.spec.ts`: the S1 "no timer" check widened to the S2 files.
- **Unchanged:** nothing under `orchestration/`, `chat/`, `ai/`, `auth/`, `guards/` or `safety/`. The frozen contract HARNESS_ENTITLEMENT_PROOF_V1 was untouched, and the approval code did not change.
- **Approve only queues:** `approveReferral` enqueues the step, so a tick never waits on a model.

## Control-plane review and gates

The control plane read every non-test source file of both slices and reran the gates on each branch. Main fast-forwarded to the same trees.

| Gate | S1 branch | S2 branch (= main bf6e4c4) |
|---|---|---|
| Gateway `npx jest --maxWorkers=2` | 4852 passed, 7 skipped, 14 failed | 4973 passed, 7 skipped, 14 failed |
| Failures | only the 14 known `smoke.integration` tests (need a database) | the same 14 |
| `npx tsc --noEmit` | rc 0 (worker) | rc 0 |
| `npm run build` | rc 0 | rc 0 |
| Files outside the write set | none | none |
| Line endings | LF | LF |

## Shapes as built (the frozen contract for TRIGGER-UI-01)

Stage-start section 7, plus the details S1 settled:
- **Request target:** `{kind: 'chief-of-staff'}` or `{kind: 'workflow', workflowId}`.
- **POST:** needs target, task, timeOfDay, days and timeZone; `enabled` is optional and defaults to true.
- **PATCH:** takes any non-empty subset.
- **Workflow that is gone or not the owner's:** lists as `name: null, status: 'missing'`.
- **Responses:**
  - `GET /:id/runs` gives `{runs: [...]}`, newest first, at most 30;
  - DELETE gives `{id, deleted: true}`;
  - errors are `{statusCode, message, error, code}` with the `schedule_*` codes (`schedule_limit_reached` adds `limit`).

## Not proven here

- **Database:** migration 1810 and the per-owner advisory lock (`pg_advisory_xact_lock`) have not run against PostgreSQL. STAGING-DEPLOY-TRIG-01 runs the migration after the backup and creates a schedule on the page.
- **Full module boot:** TriggersModule has not been booted with a real TypeORM root. It is proven by the gateway starting on the host in STAGING-DEPLOY-TRIG-01.
- **Live runs:** a real scheduled run, a restart without a second run, and the cap skip are checked live in TRIGGER-LIVE-01 (stage-start section 12).

## Follow-ups

| Follow-up | Disposition |
|---|---|
| F1 scheduled runs to Discord | superseded by CHAT-RESULTS-OTHER-01 (note added to its body) |
| F2 notice when an unattended run waits for approval | registered TRIGGER-WAIT-NOTICE-01 |
| F3 "started by a schedule" in Results | registered TRIGGER-ORIGIN-01 |
| F4 schedules for the coding and advisors teams | registered TRIGGER-SESSION-01 |
| F5 tester-window checklist line for `SCHEDULES_ENABLED` | superseded by GOV-CHECKLIST-01 |
| F6 one refusal mapper for chat and triggers (also named by S2) | registered REFUSAL-MAP-01 |
| F7 Chief of Staff runs past their first hand-off once the roster has an approval setting | superseded by APPROVAL-SET-02 (note added) |
| F8 a stored next-due time when schedules grow (and S2's stored last-evaluated time in place of the in-memory cursor) | registered TRIGGER-SCALE-01 |
| F9 `agent_schedules.task` in the privacy inventory | superseded by ACCESS-READY-01 (note added) |
| F10 schedules on staging need runs on | superseded by Keith's Q12 (the switch goes back off; turning schedules on with runs on belongs to a later tester-window or launch task) |
| F11 the MIGRATION checklist's model line for subagents | superseded by GOV-CHECKLIST-01 |
| S1: English-only log lines | superseded by design: logs are not user-facing; the UI translates the codes (TRIGGER-UI-01) |
| S1: note the as-built shapes for TRIGGER-UI-01 | superseded by this checkpoint and the TRIGGER-UI-01 body note |
| S1: no database test of 1810 or the advisory lock | superseded by STAGING-DEPLOY-TRIG-01 (note added) |
| S2: a DI boot test of TriggersModule | superseded by STAGING-DEPLOY-TRIG-01 (the gateway boots on the host) |
| The leftover worktree folders TRIGGER-01-S1 and TRIGGER-01-S2 | superseded by Keith's step (delete the folders) |

CHECKLIST: EVERY 11/11 (1: admitted 7cca420, each slice admitted; 2: 4-step with an approved stage-start; 3: fable and opus named before each dispatch; 4: self-contained briefs, no further subagents; 5: each slice inside its write set, schedule.controller.spec.ts named in S2's set before dispatch; 6: tests in both slices; 7: gates rerun by the control plane on both branches; 8: no runtime started; 9: dist ignored, no tracked artifact changed; 10: worktrees, fast-forwards and branch removal by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, internal-key or guard change; the session guard, entitlement, cap, start, approve and cancel paths reused; 2: no internal endpoint; 3: no generated-app template; 4: the frozen contract untouched, the route shapes kept; 5: the schema change under MIGRATION in S1; 6: compared with the baseline, the 14 known failures only), MIGRATION 4/4 (1: held for S1, opus by Model Routing for subagents; 2: ordered after 1809, tested; 3: up and down tested with mocks; 4: down drops only its own two tables)
FOLLOWUPS: 6 registered (TRIGGER-WAIT-NOTICE-01; TRIGGER-ORIGIN-01; TRIGGER-SESSION-01; REFUSAL-MAP-01; TRIGGER-SCALE-01; GOV-CHECKLIST-01) / 11 superseded (F1 by CHAT-RESULTS-OTHER-01; F5 and F11 by GOV-CHECKLIST-01; F7 by APPROVAL-SET-02; F9 by ACCESS-READY-01; F10 by Keith's Q12; the log lines by design; the shapes note by TRIGGER-UI-01; the database and boot checks by STAGING-DEPLOY-TRIG-01; the leftover folders by Keith's step) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane: Lane 1 released EMPTY; GATEWAY released UNOWNED (MIGRATION and ENV were released at S1). Nothing deployed: staging still runs 7fcc46d with runs off.
