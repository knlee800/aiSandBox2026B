# TRIGGER-EVENT-01 — Checkpoint

**Task:** TRIGGER-EVENT-01 — Trigger before a calendar event
**Status:** COMPLETE AND LOCKED — 2026-11-15. Built, not deployed: STAGING-DEPLOY-EVENT-01 (Keith approves) and TRIGGER-EVENT-LIVE-01 follow.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS.
**Mutexes, by slice:**
- S1: GATEWAY, plus five connectors-mcp HOTFILE leases;
- S2: GATEWAY, MIGRATION, ENV;
- S3: GATEWAY;
- S4: FRONTEND, I18N.

**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan section 3.4, F2). Keith chose it on 2026-11-15 ("Start TRIGGER-EVENT-01").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex | baf07f9 |
| 2. Stage-start | `docs/TRIGGER-EVENT-01-STAGE-START.md`, fable subagent (Fable 5.1, stage-start drafts) | 92fc178 |
| 2. Approval, S1 admitted | Keith: "Yes, approve all sixteen" | 54b2401 |
| 3. S1 calendar window read | opus (credentials, a child process, two services), fast-forwarded | 265256d |
| 3. S1 landed, S2 admitted (and COS-EVAL-DRIFT-01 in Lane 2) | | 4ca3586 |
| 3. S2 tables, routes, switch | opus (a migration, new owner-scoped routes), cherry-picked | d6fbff0 |
| 3. S2 landed, S3 admitted | | 808bc2a |
| 3. S3 timer, reads, claim, start, skip | opus (unattended spend, the approval gate, cross-module calls), fast-forwarded | d460bec |
| 3. S3 landed, S4 admitted | | adad1f8 |
| 3. S4 page section | sonnet (UI in the frontend), fast-forwarded | 06512ff |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Keith's decisions (2026-11-15, stage-start section 15, all as recommended)

1. **Q1:** the run is told the event's times only and reads the event with its own calendar tool.
2. **Q2:** the first step starts without a click.
3. **Q3:** every timed event, or an optional title word.
4. **Q4:** lead 5 to 120 minutes, default 15.
5. **Q5:** 3 triggers per owner and 3 starts per trigger per day.
6. **Q6:** a moved event fires again within the day limit.
7. **Q7:** own tables and `/api/event-triggers`.
8. **Q8:** a new gateway-only `calendar_list_window`.
9. **Q9:** reads every 10 minutes plus one before each start.
10. **Q10:** every read audited without content.
11. **Q11:** a new `EVENT_TRIGGERS_ENABLED`.
12. **Q12:** no reads while runs are off.
13. **Q13:** a workflow without the calendar tool is allowed, with a warning.
14. **Q14:** the added task lines are in English.
15. **Q15:** the page section is part of this task.
16. **Q16:** the switch goes back off after the live check.

## What changed

- **S1** (`services/connectors-mcp`, `services/api-gateway/src/connectors/`):
  - **The tool:** `calendar_list_window` returns only uid, title, start and end of the timed, not-cancelled occurrences that start in a window of at most 3 hours, with repeating events expanded. node-ical 0.27.3 gives `uid`, and `status` as raw text, compared ignoring case.
  - **The broker:** `ConnectorBroker.readCalendarWindow` reuses the decrypt, child, 25-second timeout, 64 KB cap, in-flight limit and scrubbing, and writes one content-free `connector.trigger_read` audit row.
  - **Gateway-only:** the tool is not in the catalogue, the allowlist, any grant or the internal route.
  - **Unchanged:** `calendar_list_today` is byte for byte unchanged.
- **S2:**
  - **Migration 1811:** `agent_event_triggers` and `agent_event_trigger_runs`, unique on trigger and occurrence key.
  - **Routes:** `/api/event-triggers` (GET, POST, PATCH, DELETE, GET runs) with a browser session and harness access, owner-scoped, at most 3 per owner under a per-owner lock, with `armed_at`.
  - **Switch:** `EVENT_TRIGGERS_ENABLED`, default false, with its env template line.
  - **Audit rows:** ids and the target kind only.
- **S3:**
  - **Timer:** its own 60-second timer, silent while the switch is off.
  - **Calendar reads:** per owner every 10 minutes, kept in memory only for 20 minutes. There are no reads while runs are off, and no broker call without a calendar connection.
  - **Calendar state:** read_failed after three failures, written to all of the owner's triggers.
  - **Claiming:** the due rule; a claim on the SHA-256 of trigger id, uid and start; the day limit of 3; a confirm read (event_changed, calendar_read_failed, connector_missing).
  - **Starting:** the schedule pre-checks, then a start as the owner with the saved task plus fixed English lines giving the event's times, the first step approved as the owner, and a refusal that cancels the run.
  - **Upkeep:** stale claims closed and history pruned.
  - **Never logged or audited:** no title, uid, hash, event time, task or filter in audit rows or logs.
- **S4:** the "Before a meeting" section on the Schedules page:
  - list, create, edit, switch, delete with a confirm step, and history;
  - the switch and runs banners, the calendar state with a Connections link, the limit of 3, the 10-minute read notice and the workflow warning;
  - every state and code in en, zh-TW and zh-CN, with the code lists pinned to the gateway source.
- **Unchanged:**
  - nothing under `orchestration/`, `chat/`, `ai/`, `auth/`, `guards/` or `safety/`;
  - `/api/schedules` and its files (only the pinning assertions in `schedule.controller.spec.ts`);
  - `HARNESS_ENTITLEMENT_PROOF_V1`.

## Control-plane review and gates (rerun on every branch)

| Slice | Gates |
|---|---|
| S1 | connectors-mcp 85 of 85, build rc 0; gateway 4983 passed, 7 skipped, 14 known smoke failures; build rc 0 |
| S2 | gateway 5205 passed, 7 skipped, 14 known; tsc and build rc 0; tsc rc 0 on main after the cherry-pick |
| S3 | gateway 5337 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S4 | frontend tsc rc 0, 2007 of 2007, build rc 0, `tsconfig.tsbuildinfo` restored |

Each slice changed only its own write set, with LF line endings. The 14 known failures are in `smoke.integration.spec.ts` and need a database.

## Choices made inside the approved design (from the S2 and S3 reports)

- **The page's calendar state:** the newest state across the owner's triggers. S3 writes it to all of them.
- **The day limit:** counts started and in-flight claims on the event's local date.
- **The filter at confirm:** it is re-checked, so an event renamed out of it is `event_changed`.
- **Runs going off after a claim:** recorded as `runs_off`.
- **Reads that fail:** they keep the 10-minute pace, so `read_failed` comes after about 30 minutes.
- **"N minutes before":** the real time left, rounded.

## Not proven here

- **Database:** migration 1811 and the per-owner lock against PostgreSQL.
- **The real calendar:** the window read against a real iCal feed, its freshness and Google's limits.
- **The page:** in a browser at phone width.
- **A real triggered run:** all of these belong to STAGING-DEPLOY-EVENT-01 and TRIGGER-EVENT-LIVE-01.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| F1 deploy and live check | registered STAGING-DEPLOY-EVENT-01 and TRIGGER-EVENT-LIVE-01 |
| F2 `ownerResponse` always null; F4 cancelled events in `calendar_list_today` | registered CONN-CAL-FIXES-01 |
| F3 an agent calendar tool past today (D6) | registered CONN-CAL-WINDOW-01 |
| S2 and S3: three helper copies; out-of-date test names | registered TRIGGER-TIDY-01 |
| F5 wait notice and "started before a meeting" | superseded by TRIGGER-WAIT-NOTICE-01 and TRIGGER-ORIGIN-01 (notes added) |
| F6 Discord delivery of event-trigger runs | superseded by CHAT-RESULTS-OTHER-01 (note) |
| F7 privacy inventory lines (also named by S2) | superseded by ACCESS-READY-01 (note) |
| F8 the switch line names `EVENT_TRIGGERS_ENABLED` | superseded by GOV-CHECKLIST-01 (note) |
| F9 audit growth, 144 read rows a day per owner | superseded by TRIGGER-SCALE-01 (note) |
| F10 a third user of the refusal mapper | superseded by REFUSAL-MAP-01 (note) |
| F11 reuse for mail triggers | superseded by TRIGGER-MAIL-01 (note) |
| F12 Google's API instead of the iCal read | superseded by CONN-OAUTH-01 (note) |
| F13 copied start condition; plan section numbers | superseded by this record (TRIGGER-MORE-01's start condition and plan section 7 corrected) |
| S1: the ai-service drift test failing on main | superseded by COS-EVAL-DRIFT-01 (locked) |
| S2: confirm the calendar.state rule | superseded by slice S3 (written to all of the owner's triggers) |
| S4: a specific calendar-tool warning; a Command Center link | superseded by TRIGGER-UI-POLISH-01 (note) |

CHECKLIST: EVERY 11/11 (1: admitted baf07f9 and each slice admitted; 2: 4-step with an approved stage-start; 3: fable, opus and sonnet named before each dispatch; 4: self-contained briefs, no further subagents; 5: each slice inside its write set, the pinning spec named before dispatch; 6: tests in every slice; 7: gates rerun by the control plane on every branch; 8: no runtime started; 9: tsconfig.tsbuildinfo restored, dist ignored; 10: worktrees, fast-forwards and the S2 cherry-pick by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, internal-key or guard change; 2: the internal connectors route refuses the new tool; 3: no generated-app template; 4: `/api/schedules` and HARNESS_ENTITLEMENT_PROOF_V1 untouched, the `/api/event-triggers` shapes kept by S4; 5: the schema change under MIGRATION in S2; 6: compared with the baselines), MIGRATION 4/4 (1: held for S2, opus; 2: ordered after 1810, tested; 3: up and down tested with mocks; 4: down drops only its two tables), UI 9/9 (S4: three languages, I18N held, Heroicons v2 Outline, both skills read, DESIGN.md classes, every state translated and tested, one section and no backend, existing test ids kept, the browser flows named for STAGING-DEPLOY-EVENT-01)
FOLLOWUPS: 5 registered (STAGING-DEPLOY-EVENT-01; TRIGGER-EVENT-LIVE-01; CONN-CAL-FIXES-01; CONN-CAL-WINDOW-01; TRIGGER-TIDY-01) / 13 superseded (F5 by TRIGGER-WAIT-NOTICE-01 and TRIGGER-ORIGIN-01; F6 by CHAT-RESULTS-OTHER-01; F7 by ACCESS-READY-01; F8 by GOV-CHECKLIST-01; F9 by TRIGGER-SCALE-01; F10 by REFUSAL-MAP-01; F11 by TRIGGER-MAIL-01; F12 by CONN-OAUTH-01; F13 by this record; the ai-service drift failure by COS-EVAL-DRIFT-01; the calendar.state rule by slice S3; the specific workflow warning and a Command Center link by TRIGGER-UI-POLISH-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane:
- Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED (the other mutexes and leases were released at their slices);
- nothing deployed: staging still runs f32d88b.
