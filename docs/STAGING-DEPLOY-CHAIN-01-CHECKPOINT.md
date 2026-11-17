# STAGING-DEPLOY-CHAIN-01 — Checkpoint

**Task:** STAGING-DEPLOY-CHAIN-01 — Deploy chain triggers and check the page
**Status:** COMPLETE AND LOCKED — 2026-11-17. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (tester window closed).
**Source:** registered 2026-11-16 by the TRIGGER-CHAIN-01 LOCK. Keith approved the deploy on 2026-11-16 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized true | 12598e7 |
| 2. Deploy, env step, Keith's page check, host evidence | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts and outputs

The files are in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-CHAIN-01\`. The control plane made `chain1-deploy.sh` from `rtool1-deploy.sh` using `mk_chain1.py` in its scratchpad, and asserted each change.

| File | SHA-256 |
|---|---|
| `chain1-deploy.sh` | `23075a255bac40146f02fa4ac0e211c84001bb7bcfd4bd5177d2b555b4da218d` |
| `chain1-evidence.sh` (read only) | `f021d128d0606e9799d1e781499de000a9cd40289adbea607e4f29f97ff5355a` |

The outputs are `chain1-deploy.out` and `chain1-evidence.out`. A scan for key text found none.

## Deploy (2026-11-16T15:34:25Z, rc 0)

| Check | Result |
|---|---|
| Before | host at df9f2b5; migration hash 4913e9f7; configuration at the baselines (gateway.env dc089a70, ai.env 721f4772, Caddyfile 205770cf); runs off; nothing open |
| Deploy | `aisandbox-deploy 12598e7` rc 0, with the tool's pre-migration backup; HEAD and DEPLOYED at 12598e7 (code equal to bf9de19) |
| Migration 1814 | hash 4913e9f7 to 0f91cfda; `agent_chain_triggers` and `agent_chain_trigger_runs` present; the unique (trigger_id, source_run_id) index, 7 CHECKs, 2 cascades; 0 rows; latest migration `CreateAgentChainTriggerTables1814000000000` |
| Earlier checks | as before: preview host, guards, cookies, CORS, ports, keys, provider switch and Discord; schedules and the event, mail and knowledge triggers (rows unchanged, switches false); the run-result route (401, 401, 400 and the fixed 404); time zones UTC |
| Chain-trigger routes | GET without a session 401; POST without a session 401; POST cross-origin 403 |
| Builds | gateway: chain-trigger controller, timer, run service and match files; the frontend section (zh-TW heading 工作流程完成後) |
| Before the env step | no `CHAIN_TRIGGERS_ENABLED` line; no chain-trigger journal lines |
| Pages | `/en`, `/zh-TW` and `/zh-CN` `/schedules` 200; Discord ready after the restart; the temporary API key revoked |

## Env step

- **The line:** `CHAIN_TRIGGERS_ENABLED=false` was added to `gateway.env` with its comment line. The old content was checked byte for byte as the start of the new file, and a copy was kept at `/root/aisb-chain1/gateway.env.before`.
- **The restart:** the gateway was restarted. It came back ready with Discord ready, and the route refuses without a session.
- **New gateway.env baseline:** `616841ca2a9387f4f5605b8fe56fd04b834c40aba7e62c50a681cfe7e5047803` (600 root:root). ai.env and the Caddyfile are unchanged.
- **Flags:** `CHAIN_TRIGGERS_ENABLED=false`, `RUN_RESULT_TOOL_ENABLED=false`, `KNOWLEDGE_TRIGGERS_ENABLED=false`, `MAIL_TRIGGERS_ENABLED=false`, `EVENT_TRIGGERS_ENABLED=false`, `SCHEDULES_ENABLED=false`, `CHAT_DISCORD_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`.

## Keith's page check ("Done, all fine")

The steps given for the After a workflow finishes section:
- create a trigger from an active, tested workflow to the Chief of Staff, with the marker PINEAPPLE60 in the task;
- try the same workflow as source and target (refused);
- create A → B, then try B → A (the loop refused), and delete A → B after the confirm step;
- edit the first trigger, and switch it off and on;
- look at the section in 繁體中文 and at phone width, with the result-tool-off banner.

## Host evidence (read only)

| Check | Result |
|---|---|
| Triggers | 1, Keith's: source workflow ab4cb6ae, target the Chief of Staff, Asia/Hong_Kong, enabled, the task holding the marker (text not shown), armed after the deploy |
| Run rows | 0 |
| Audit rows (`agent_chain_trigger`) | created 2, updated 2, deleted 1. The only payload keys are sourceWorkflowId, targetKind, triggerId and workflowId. The refused saves wrote nothing. Every update writes a row, so fewer saves were made than "an edit plus an off and an on" would give. Keith reported the section fine |
| Text in logs | PINEAPPLE60 appears in no audit row and in no app-service journal line for the whole boot |
| Reads and runs | no chain-trigger run, claim, cap, disabled or history journal lines |
| State | gateway.env 616841ca, ai.env 721f4772, Caddyfile 205770cf; all switches off; nothing open; DEPLOYED 12598e7 |

## What this proves, and what is left

**Proven on staging:**
- migration 1814 and the per-owner create path with the cycle check, against PostgreSQL;
- the TriggersModule boot with the chain timer and the run-table repositories;
- the session-only, owner-scoped routes;
- the After a workflow finishes section in a browser, including both refusals;
- audit rows and logs without task text or workflow names;
- no run read with the switches off.

**Left for TRIGGER-CHAIN-LIVE-01** (a run window, with CHAIN_TRIGGERS_ENABLED and RUN_RESULT_TOOL_ENABLED on):
- a real completion of workflow ab4cb6ae starting the chained Chief of Staff run, which reads the finished run;
- the settle delay seen live;
- a restart, a member-only run, the depth and cap skips;
- the cost, and the wording.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before, the gateway.env change checked byte for byte and its new hash recorded; 3 and 7: n/a, tester window closed; 4: nothing open before or after, health ready, units active; 5: from the host; 6: outputs scanned for key text, the internal key shredded after use, the temporary API key revoked, no secret printed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-17 by the control plane:
- Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false;
- staging runs 12598e7 with chain triggers, the run-result tool, all other triggers, schedules and runs off.
