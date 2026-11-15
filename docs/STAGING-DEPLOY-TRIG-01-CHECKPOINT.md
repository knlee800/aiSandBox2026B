# STAGING-DEPLOY-TRIG-01 — Checkpoint

**Task:** STAGING-DEPLOY-TRIG-01 — Deploy triggers
**Status:** COMPLETE AND LOCKED — 2026-11-15. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (tester window closed).
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01. Keith approved the deploy on 2026-11-15 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized true | f32d88b |
| 2. Deploy, env step, Keith's page check, host evidence | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts and outputs

The files are in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-TRIG-01\`. `trig1-deploy.sh` was made from the Discord deploy script by `mk_trig1.py` in the control plane's scratchpad, with each change asserted.

| File | SHA-256 |
|---|---|
| `trig1-deploy.sh` | `7d721d79e41fa662924da1938096237d0b00e57d2c8e0855b4a220af9d90596f` |
| `trig1-evidence.sh` (read only, run twice) | `c67268c0e10406ffd09113bd08580f3e047e42c469986be59a18822eceb09d16` |

The outputs are `trig1-deploy.out`, `trig1-evidence.out` and `trig1-evidence2.out`. A scan for key text found none.

## Deploy (2026-11-15T06:32:47Z, rc 0)

| Check | Result |
|---|---|
| Before | host at 7fcc46d; migration hash fa23a84d; configuration at the baselines (gateway.env 1ecb298f, ai.env 721f4772, Caddyfile 205770cf); runs off; nothing open; INTERNAL_SERVICE_KEY matches across the three services |
| Deploy | `aisandbox-deploy f32d88b` rc 0, with the tool's pre-migration backup; HEAD and DEPLOYED at f32d88b (code equal to 36f84fd) |
| Migration 1810 | hash fa23a84d to 03e88640; `agent_schedules` and `agent_schedule_runs` present; the unique (schedule_id, local_date) index, 6 CHECKs and 2 cascades present; 0 rows; latest migration `CreateAgentScheduleTables1810000000000` |
| Earlier checks | preview host, same-origin guard, cookies, picker bridge, internal guards, static key, CORS, connector server, ports on 127.0.0.1 only, ai-service and container-manager keys, provider availability, provider switch, Discord tables and routes: all as before |
| Schedule routes | GET without a session 401; with an API key alone 401 (session only); POST without a session 401; POST with a foreign Origin 403; DELETE with a cookie and no Origin 403 |
| Pages | `/en/schedules`, `/zh-TW/schedules`, `/zh-CN/schedules` 200; the Schedules link test id in the frontend build |
| Discord | ready after the deploy's restart; keys present (names only) |
| Timer | no schedule tick or run line in the journal (switch off) |
| Journal | no key text in the gateway, ai or cm journals |

## Env step

- **The line:** `SCHEDULES_ENABLED=false` was added to `/etc/aisandbox/gateway.env` with its comment line. The old content was checked byte for byte as the start of the new file, and a copy was kept at `/root/aisb-trig1/gateway.env.before`.
- **The restart:** the gateway was restarted. Health was ready, Discord reported ready, the routes answered 401 without a session, and no schedule lines appeared. The units are active.
- **New gateway.env baseline:** `15000e5107a0806fdb9267130dddc9ea0facbee43a9c402996a4cad10892633f` (600 root:root). ai.env and the Caddyfile are unchanged.
- **Flags:** `SCHEDULES_ENABLED=false`, `CHAT_DISCORD_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`.

## Keith's page check ("Done, all fine")

On the Schedules page Keith:
- saw the switched-off and runs-off banners;
- created a Chief of Staff schedule with the marker PINEAPPLE7 in its task, a few minutes ahead;
- created a schedule for one of his workflows, with his workflows in the picker;
- changed the first schedule, deleted the second after the confirm step;
- looked at the page in 繁體中文 and at phone width.

## Host evidence (read only; the second run was after the due time)

| Check | Result |
|---|---|
| Schedules | 1 left, Keith's: Chief of Staff, 14:50 Sundays, Asia/Hong_Kong, enabled, task 38 characters with the marker (text not shown) |
| Due time | passed (local 14:52) with `SCHEDULES_ENABLED=false` |
| Run rows | 0 |
| Audit rows (category `trigger`) | schedule_created 2, schedule_updated 1, schedule_deleted 1, all Keith's; payload keys scheduleId, targetKind, workflowId only |
| Marker | in no audit row and no journal line (gateway and the whole boot) |
| Journal | created, updated and deleted lines 2, 1, 1; no run or tick lines |
| State | gateway.env 15000e51, ai.env 721f4772, Caddyfile 205770cf; runs off; nothing open; DEPLOYED f32d88b |

## What this proves, and what is left

**Proven on staging:**
- migration 1810 and the per-owner create path against PostgreSQL, including the advisory lock on create;
- the TriggersModule boot;
- the session-only, owner-scoped schedule routes and their guards;
- the Schedules page in a browser in two languages and at phone width;
- audit rows without task text;
- the switch-off silence: no run past a due time.

**Left for TRIGGER-LIVE-01** (a run window, PROVIDER-LIVE and CREDIT):
- a real scheduled run;
- one start per day across a restart;
- the cap skip;
- an "every hand-off" workflow waiting;
- the cost;
- the ARCHITECTURE.md and PRD.md wording in Keith's words.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before, the gateway.env change checked byte for byte and its new hash recorded; 3 and 7: n/a, tester window closed; 4: nothing open before or after, health ready, units active; 5: from the host; 6: outputs scanned for key text, the temporary API key revoked, no secret printed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane:
- Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false;
- staging runs f32d88b with schedules off and runs off.
