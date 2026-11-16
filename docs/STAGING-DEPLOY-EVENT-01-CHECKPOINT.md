# STAGING-DEPLOY-EVENT-01 — Checkpoint

**Task:** STAGING-DEPLOY-EVENT-01 — Deploy event triggers and check the page
**Status:** COMPLETE AND LOCKED — 2026-11-16. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (tester window closed).
**Source:** registered 2026-11-15 by the TRIGGER-EVENT-01 LOCK. Keith approved the deploy on 2026-11-16 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized true | 60fe280 |
| 2. Deploy, env step, Keith's page check, host evidence | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts and outputs

The files are in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-EVENT-01\`. `event1-deploy.sh` was made from `trig1-deploy.sh` by `mk_event1.py` in the control plane's scratchpad, with each change asserted.

| File | SHA-256 |
|---|---|
| `event1-deploy.sh` | `f46877e5250655d6f249363f718aa71b6c6249fc4d3008505b854e888a79e527` |
| `event1-evidence.sh` (read only) | `d7af7e2978ed8f72d3f53aab6d60169bb1b204afb9fa0d4fb1b5888ff6e8b78b` |

The outputs are `event1-deploy.out` and `event1-evidence.out`. A scan for key text found none.

## Deploy (2026-11-16T00:55:43Z, rc 0)

| Check | Result |
|---|---|
| Before | host at f32d88b; migration hash 03e88640; configuration at the baselines (gateway.env 15000e51, ai.env 721f4772, Caddyfile 205770cf); runs off; nothing open |
| Deploy | `aisandbox-deploy 60fe280` rc 0, with the tool's pre-migration backup; HEAD and DEPLOYED at 60fe280 (code equal to bc63c28) |
| Migration 1811 | hash 03e88640 to 2bbd0c4f; `agent_event_triggers` and `agent_event_trigger_runs` present; the unique (trigger_id, occurrence_key) index, 6 CHECKs, 2 cascades; 0 rows; latest migration `CreateAgentEventTriggerTables1811000000000` |
| Connector server | `tools/list` names mail, calendar and calendar window |
| Earlier checks | preview host, same-origin guard, cookies, picker, guards, CORS, ports, ai-service and container-manager keys, provider availability and switch, Discord, schedules (`SCHEDULES_ENABLED=false`, Keith's four test schedules and their four rows unchanged): as before |
| Event-trigger routes | GET without a session 401; with an API key alone 401; POST without a session 401; POST cross-origin 403 |
| Builds | gateway event-trigger controller, timer, run service and calendar files; connectors-mcp `calendar_list_window`; the frontend section (zh-TW heading present) |
| Before the env step | no `EVENT_TRIGGERS_ENABLED` line; 0 `connector.trigger_read` rows; no event-trigger journal lines |
| Pages | `/en`, `/zh-TW` and `/zh-CN` `/schedules` 200; Discord ready after the restart |

## Env step

- **The line:** `EVENT_TRIGGERS_ENABLED=false` was added to `gateway.env` with its comment line. The old content was checked byte for byte as the start of the new file, and a copy was kept at `/root/aisb-event1/gateway.env.before`.
- **The restart:** the gateway was restarted: ready, Discord ready, the routes refuse without a session, no schedule or event-trigger lines.
- **New gateway.env baseline:** `23c838b8ef0677683db95b5bc6912fc29930e957cac161bf3c0463d36c37e85b` (600 root:root). ai.env and the Caddyfile are unchanged.
- **Flags:** `EVENT_TRIGGERS_ENABLED=false`, `SCHEDULES_ENABLED=false`, `CHAT_DISCORD_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`.

## Keith's page check ("Done, calendar connected")

In the Before a meeting section, Keith:
- saw the banners, the limit and his calendar as connected;
- created a Chief of Staff trigger with the marker PINEAPPLE20 in the task and the title word PINEAPPLE21;
- changed it (lead 30);
- created a trigger for one of his workflows and deleted it after the confirm step;
- looked at the page in 繁體中文 and at phone width.

## Host evidence (read only)

| Check | Result |
|---|---|
| Triggers | 1, Keith's: Chief of Staff, lead 30, an 11-character title word, enabled, task with the marker (text not shown), `calendar_state` ok |
| Calendar connection | 1 `ical` row for Keith |
| Run rows | 0 |
| Audit rows (`agent_event_trigger`) | created 2, updated 1, deleted 1; payload keys triggerId, targetKind, workflowId only |
| Markers | PINEAPPLE20 and PINEAPPLE21 in no audit row and no journal line (whole boot) |
| Calendar reads | 0 `connector.trigger_read` rows; no event-trigger run or calendar journal lines |
| State | gateway.env 23c838b8, ai.env 721f4772, Caddyfile 205770cf; all switches off; nothing open; DEPLOYED 60fe280 |

## What this proves, and what is left

**Proven on staging:**
- migration 1811 and the per-owner create path against PostgreSQL;
- the TriggersModule boot with the ConnectorsModule import;
- the new connector tool listed by the child;
- the session-only, owner-scoped routes;
- the Before a meeting section in a browser, in two languages and at phone width;
- audit rows and logs without task or filter text;
- no calendar read with the switch off.

**Left for TRIGGER-EVENT-LIVE-01** (a run window): the window read against Keith's real iCal feed, a real triggered run, a restart, `event_changed`, the cap skip, the read cost and the feed's freshness, and the wording.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before, the gateway.env change checked byte for byte and its new hash recorded; 3 and 7: n/a, tester window closed; 4: nothing open before or after, health ready, units active; 5: from the host; 6: outputs scanned for key text, the temporary API key revoked, no secret printed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false;
- staging runs 60fe280 with event triggers, schedules and runs off.
