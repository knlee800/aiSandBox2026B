# STAGING-DEPLOY-MAIL-01 — Checkpoint

**Task:** STAGING-DEPLOY-MAIL-01 — Deploy mail triggers and check the page
**Status:** COMPLETE AND LOCKED — 2026-11-16. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (tester window closed).
**Source:** registered 2026-11-16 by the TRIGGER-MAIL-01 LOCK. Keith approved the deploy on 2026-11-16 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized true | 4259466 |
| 2. Deploy, env step, Keith's page check, host evidence | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts and outputs

The files are in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-MAIL-01\`. The control plane made `mail1-deploy.sh` from `event1-deploy.sh` using `mk_mail1.py` in its scratchpad, and asserted each change. The diff against the event deploy shows only the mail lines and the new baselines.

| File | SHA-256 |
|---|---|
| `mail1-deploy.sh` | `2a1d62a40360239c47ab603d0a97e24108cdb282eabce7fb86969e3cf5ab307f` |
| `mail1-evidence.sh` (read only) | `26a453323c71dcb2a038119bd5acb29c0be20b7eb403b13cda9b9bd17e53097f` |

The outputs are `mail1-deploy.out` and `mail1-evidence.out`. A scan for key text found none.

## Deploy (2026-11-16T05:16:52Z, rc 0)

| Check | Result |
|---|---|
| Before | host at 60fe280; migration hash 2bbd0c4f; configuration at the baselines (gateway.env 23c838b8, ai.env 721f4772, Caddyfile 205770cf); runs off; nothing open |
| Deploy | `aisandbox-deploy 4259466` rc 0, with the tool's pre-migration backup; HEAD and DEPLOYED at 4259466 (code equal to d696c66) |
| Migration 1812 | hash 2bbd0c4f to 322865ef; `agent_mail_triggers` and `agent_mail_trigger_runs` present; the unique (trigger_id, message_key) index, 6 CHECKs, 2 cascades; 0 rows; latest migration `CreateAgentMailTriggerTables1812000000000` |
| Connector server | `tools/list` names mail, calendar, calendar window and recent mail |
| Earlier checks | as before: preview host, same-origin guard, cookies, picker, guards, CORS, ports, ai-service and container-manager keys, provider availability and switch, Discord, schedules (4 rows unchanged, `SCHEDULES_ENABLED=false`), event triggers (Keith's live-check rows unchanged, `EVENT_TRIGGERS_ENABLED=false`) |
| Mail-trigger routes | GET without a session 401; with an API key alone 401; POST without a session 401; POST cross-origin 403 |
| Builds | gateway mail-trigger controller, timer, run service and mailbox files; connectors-mcp `mail_list_recent`; the frontend section (zh-TW heading 郵件到達時 present) |
| Before the env step | no `MAIL_TRIGGERS_ENABLED` line; 0 `connector.trigger_read` rows since the deploy start; no mail-trigger or event-trigger journal lines |
| Pages | `/en`, `/zh-TW` and `/zh-CN` `/schedules` 200; Discord ready after the restart; the temporary API key revoked |

**Since-start counts:** the `connector.trigger_read` count is taken from the deploy start because TRIGGER-EVENT-LIVE-01 left earlier rows.

## Env step

- **The line:** `MAIL_TRIGGERS_ENABLED=false` was added to `gateway.env` with its comment line. The old content was checked byte for byte as the start of the new file, and a copy was kept at `/root/aisb-mail1/gateway.env.before`.
- **The restart:** the gateway was restarted. It came back ready with Discord ready, the route refuses without a session, and there were no schedule lines.
- **New gateway.env baseline:** `97471cb05f99d8033eef721cf9cdda85276667c44f7e204ab13202c84e249ca5` (600 root:root). ai.env and the Caddyfile are unchanged.
- **Flags:** `MAIL_TRIGGERS_ENABLED=false`, `EVENT_TRIGGERS_ENABLED=false`, `SCHEDULES_ENABLED=false`, `CHAT_DISCORD_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`.

## Keith's page check ("Done, all fine")

In the When mail arrives section, Keith:
- created a Chief of Staff trigger with the sender `knlee802@gmail.com` and the marker PINEAPPLE30 in the task;
- changed it, and switched it off and on;
- created a trigger for one of his workflows and deleted it after the confirm step;
- checked the mailbox state, the page in 繁體中文 and the page at phone width.

## Host evidence (read only)

| Check | Result |
|---|---|
| Triggers | 1, Keith's: Chief of Staff, the sender stored lower-cased and trimmed (his test mailbox), no subject word, Asia/Hong_Kong, enabled, the task holding the marker (text not shown), `mail_state` ok, armed after the deploy |
| Mail connection | 1 `imap` row for Keith |
| Run rows | 0 |
| Audit rows (`agent_mail_trigger`) | created 2, updated 2, deleted 1. The only payload keys are triggerId, targetKind and workflowId. The page check named a change plus an off and an on, but the host counted two update rows. Keith reported the section fine |
| Text in logs | PINEAPPLE30 and the mailbox address appear in no audit row and in no journal line for the whole boot |
| Mailbox sign-ins | 0 `connector.trigger_read` rows since the deploy start; no mail-trigger run, mailbox, read or owner journal lines |
| State | gateway.env 97471cb0, ai.env 721f4772, Caddyfile 205770cf; all switches off; nothing open; DEPLOYED 4259466 |

## What this proves, and what is left

**Proven on staging:**
- migration 1812 and the per-owner create path against PostgreSQL;
- the TriggersModule boot with the mail timer and mailbox service;
- the new connector tool listed by the child;
- the session-only, owner-scoped routes;
- the When mail arrives section in a browser, in two languages and at phone width;
- audit rows and logs without the task, sender or subject;
- no mailbox sign-in with the switch off.

**Left for TRIGGER-MAIL-LIVE-01** (a run window):
- the recent-mail read against Keith's real Gmail, including imapflow at run time and Gmail's tolerance of the sign-in pace;
- how fast new mail shows over IMAP, and whether self-sent mail arrives unread in the Inbox;
- a real triggered run, once per message across a restart, and the day-limit skip;
- the wording.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before, the gateway.env change checked byte for byte and its new hash recorded; 3 and 7: n/a, tester window closed; 4: nothing open before or after, health ready, units active; 5: from the host; 6: outputs scanned for key text, the temporary API key revoked, no secret printed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false;
- staging runs 4259466 with mail triggers, event triggers, schedules and runs off.
