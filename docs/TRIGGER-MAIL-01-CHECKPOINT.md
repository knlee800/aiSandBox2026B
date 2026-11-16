# TRIGGER-MAIL-01 — Checkpoint

**Task:** TRIGGER-MAIL-01 — Trigger on mail that matches a filter
**Status:** COMPLETE AND LOCKED — 2026-11-16. Built, not deployed: STAGING-DEPLOY-MAIL-01 (Keith approves) and TRIGGER-MAIL-LIVE-01 follow.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS.
**Mutexes, by slice:**
- S1: GATEWAY, plus seven connectors-mcp HOTFILE leases;
- S2: GATEWAY, MIGRATION, ENV;
- S3: GATEWAY;
- S4: FRONTEND, I18N.

**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan section 3.4, F3). Keith chose it on 2026-11-16 ("Start TRIGGER-MAIL-01").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex | 26cadc5 |
| 2. Stage-start | `docs/TRIGGER-MAIL-01-STAGE-START.md`, fable subagent (Fable 5.1, stage-start drafts) | 511b34c |
| 2. Approval, S1 admitted | Keith: "Yes, approve all" | 2623634 |
| 3. S1 recent-mail read | opus (mailbox credentials, a child process, two services), fast-forwarded | aa581dd |
| 3. S1 landed, S2 admitted | | 2d9d8b9 |
| 3. S2 tables, routes, switch | opus (a migration, new owner-scoped routes), fast-forwarded | eb5f2d6 |
| 3. S2 landed, S3 admitted | | 1e108f6 |
| 3. S3 timer, sign-ins, match, claim, start, skip | opus (unattended spend, the approval gate, cross-module calls), fast-forwarded | 822e530 |
| 3. S3 landed, S4 admitted | | 93cb259 |
| 3. S4 page section | sonnet (UI in the frontend); three new files converted to LF by the control plane (d696c66, no content change); fast-forwarded | a11e010, d696c66 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Keith's decisions (2026-11-16, stage-start section 15, all as recommended)

1. **Q1:** the run is told the arrival time and the message number only.
2. **Q2:** the first step starts without a click.
3. **Q3:** a sender (an address or @domain) is required; a subject word is optional.
4. **Q4:** unread Inbox mail only.
5. **Q5:** up to 60 minutes late, with older mail ignored.
6. **Q6:** one run per message within the day limit.
7. **Q7:** 3 triggers per owner and 5 starts per trigger per day.
8. **Q8:** own tables and `/api/mail-triggers`.
9. **Q9:** a new gateway-only `mail_list_recent` with no body.
10. **Q10:** a sign-in every 10 minutes, hourly after three failures.
11. **Q11:** a workflow without the mail tool is allowed, with a warning.
12. **Q12:** every read audited without content.
13. **Q13:** a new `MAIL_TRIGGERS_ENABLED`.
14. **Q14:** no sign-in while runs are off.
15. **Q15:** the page section is part of this task.
16. **Q16:** the switch goes back off after the live check.

## What changed

- **S1:**
  - **The tool:** `mail_list_recent` in connectors-mcp.
    - It opens the Inbox read-only with `EXAMINE INBOX`, then runs `UID SEARCH UNSEEN SINCE` and `UID FETCH (UID ENVELOPE INTERNALDATE)`.
    - It never sets Seen and never fetches a body section.
    - It returns `uidValidity` and, per message, `uid`, `fromAddress`, `subject` and `arrivedAt`: at most 25, newest first, at most 2 hours back.
    - Its output shape follows the approved stage-start. The S1 brief had named other field names and a limit of 50, and the stage-start's version was kept.
  - **The broker:** `ConnectorBroker.readRecentMail` reuses the decrypt, child, timeout, result cap, in-flight limit and scrubbing, and writes one content-free `connector.trigger_read` row.
  - **Gateway-only:** the tool is not in the catalogue, the allowlist, any grant or the internal route.
  - **Unchanged:** `mail_list_unread_metadata` is byte for byte unchanged.
- **S2:**
  - **Migration 1812:** `agent_mail_triggers`, with a required sender filter (CHECK) stored lower-cased and trimmed, and `agent_mail_trigger_runs`, unique on trigger and `message_key`.
  - **Routes:** `/api/mail-triggers` (GET, POST, PATCH, DELETE, GET runs) with a browser session and harness access, owner-scoped, at most 3 per owner under its own lock, with `armed_at`.
  - **Switch:** `MAIL_TRIGGERS_ENABLED`, default false, with its env template line.
  - **Audit rows:** ids and the target kind only.
- **S3:**
  - **Timer:** its own 60-second timer, silent while the switch is off.
  - **Sign-ins:** one per owner every 10 minutes and hourly after three failures. There are none while runs are off, and no broker call without a mail connection.
  - **Mailbox state:** written to all of the owner's triggers.
  - **Matching:** on the sender (address or the exact domain after the last @) and the optional subject word; mail must be unread, after `armed_at` and at most 60 minutes old.
  - **Claiming:** on the SHA-256 of trigger id, UIDVALIDITY and UID; the day limit of 5 and the row cap; the schedule pre-checks.
  - **Starting:** a start as the owner with the saved task plus fixed English lines giving the arrival time and the message number only; the first step approved as the owner; a refusal cancels the run.
  - **Never logged or audited:** no sender, subject, body, UID, task or filter in audit rows or logs.
- **S4:** the "When mail arrives" section on the Schedules page:
  - list, create, edit, switch, delete with a confirm step, and history;
  - the banners, the mailbox state with a Connections link, the limit, the sign-in notice, the sender rule hint and the workflow warning;
  - every state and code in en, zh-TW and zh-CN, with the code lists pinned to the gateway source.
- **Unchanged:**
  - nothing under `orchestration/`, `chat/`, `ai/`, `auth/`, `guards/` or `safety/`;
  - `/api/schedules` and `/api/event-triggers`;
  - `HARNESS_ENTITLEMENT_PROOF_V1`.

## Control-plane review and gates (rerun on every branch)

| Slice | Gates |
|---|---|
| S1 | connectors-mcp 103 of 103, build rc 0; gateway 5350 passed, 7 skipped, 14 known smoke failures; build rc 0 |
| S2 | gateway 5621 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S3 | gateway 5770 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S4 | frontend tsc rc 0, 2060 of 2060, build rc 0, `tsconfig.tsbuildinfo` restored; after the LF conversion the mail-section tests pass 50 of 50 and every file is LF in git |

Each slice changed only its own write set. The 14 known failures are in `smoke.integration.spec.ts` and need a database.

**Also checked by the control plane (F13):** a read-profile run never gets `browser_smoke`. The worker registers it only when the run is not read-only and the profile is agent-write (`services/ai-service/src/worker/worker.processor.ts:2024`), so a mail-triggered run cannot reach an outside address that way.

**Reported to Keith:** the S2 worker's first attempt at the env template line was a shell append, which the permission check refused. It made the same in-scope change with the Edit tool.

## Not proven here

- **Database:** migration 1812 and the per-owner lock against PostgreSQL.
- **Gmail:** the read against Gmail, including imapflow at run time, Gmail's tolerance of the sign-in pace, how fast new mail shows over IMAP, and whether self-sent mail arrives unread in the Inbox.
- **The page:** in a browser, and the Chinese wording, which was written by the worker.
- **A real triggered run:** all of these belong to STAGING-DEPLOY-MAIL-01 and TRIGGER-MAIL-LIVE-01.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| F1 deploy and live check | registered STAGING-DEPLOY-MAIL-01 and TRIGGER-MAIL-LIVE-01 |
| F2 an agent mail tool that reads one message by its number (closes D7) | registered CONN-MAIL-READ-01 |
| F3 mail bodies in the Chief of Staff's data rule, and an eval case for a mail-triggered run | registered COS-MAIL-BODY-RULE-01 |
| F4 a distinct "sign-in refused" state | registered CONN-MAIL-AUTH-STATE-01 |
| F5 wait notice, "started by new mail", Discord delivery | superseded by TRIGGER-WAIT-NOTICE-01, TRIGGER-ORIGIN-01 and CHAT-RESULTS-OTHER-01 (notes added) |
| F6 privacy inventory and the Connections data statement | superseded by ACCESS-READY-01 (note) |
| F7 the switch line names `MAIL_TRIGGERS_ENABLED` | superseded by GOV-CHECKLIST-01 (note) |
| F8 another 144 read rows a day per owner | superseded by TRIGGER-SCALE-01 (note) |
| F9 a fourth user of the mapper; more helper copies; drifting test names; the duplicated section code from S4 | superseded by REFUSAL-MAP-01 and TRIGGER-TIDY-01 (notes) |
| F10 Gmail's API and Outlook | superseded by CONN-OAUTH-01 and CONN-OUTLOOK-01 (notes) |
| F11 the plan's mail tool description | superseded by this record (plan section 2 corrected) |
| F12 later filters (several senders, To or Cc, a label or folder) | superseded by TRIGGER-MORE-01 (note) |
| F13 the outbound-path check | superseded by the control plane's check above |
| S1: the brief's shape against the stage-start's | superseded by S1, which built the approved stage-start's shape |
| S2: the sender rules explained on the form | superseded by S4 (the rule hint under the field) |
| S4: a native-speaker review of the Chinese wording | superseded by TRIGGER-UI-POLISH-01 (note) |

CHECKLIST: EVERY 11/11 (1: admitted 26cadc5 and each slice admitted; 2: 4-step with an approved stage-start; 3: fable, opus and sonnet named before each dispatch; 4: self-contained briefs, no further subagents; 5: each slice inside its write set; 6: tests in every slice; 7: gates rerun by the control plane on every branch; 8: no runtime started; 9: tsconfig.tsbuildinfo restored, dist ignored; 10: worktrees, fast-forwards and the LF fix commit by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, internal-key or guard change; 2: the internal connectors route refuses the new tool; 3: no generated-app template; 4: `/api/schedules`, `/api/event-triggers` and HARNESS_ENTITLEMENT_PROOF_V1 untouched, the `/api/mail-triggers` shapes kept by S4; 5: the schema change under MIGRATION in S2; 6: compared with the baselines), MIGRATION 4/4 (1: held for S2, opus; 2: ordered after 1811, tested; 3: up and down tested with mocks; 4: down drops only its two tables), UI 9/9 (S4: three languages, I18N held, Heroicons v2 Outline, both skills read (Impeccable skimmed, as reported), DESIGN.md classes, every state translated and tested, one section and no backend, existing test ids kept, the browser flows named for STAGING-DEPLOY-MAIL-01)
FOLLOWUPS: 5 registered (STAGING-DEPLOY-MAIL-01; TRIGGER-MAIL-LIVE-01; CONN-MAIL-READ-01; COS-MAIL-BODY-RULE-01; CONN-MAIL-AUTH-STATE-01) / 13 superseded (F5 to F13 as listed; the S1 shape by S1; the S2 sender hint by S4; the S4 Chinese review by TRIGGER-UI-POLISH-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED (the other mutexes and leases were released at their slices);
- nothing deployed: staging still runs 60fe280.
