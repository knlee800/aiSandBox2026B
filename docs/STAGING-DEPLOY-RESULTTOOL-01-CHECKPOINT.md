# STAGING-DEPLOY-RESULTTOOL-01 — Checkpoint

**Task:** STAGING-DEPLOY-RESULTTOOL-01 — Deploy the run-result tool
**Status:** COMPLETE AND LOCKED — 2026-11-16. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (tester window closed).
**Source:** registered 2026-11-16 by the RESULT-TOOL-01 LOCK (Keith's Q3). Keith approved the deploy on 2026-11-16 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized true | df9f2b5 |
| 2. Deploy and env step, from the host (no page to check) | host state only | none |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Script and output

The files are in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-RESULTTOOL-01\`. The control plane made `rtool1-deploy.sh` from `know1-deploy.sh` using `mk_rtool1.py` in its scratchpad, and asserted each change.

| File | SHA-256 |
|---|---|
| `rtool1-deploy.sh` | `62689214946c924d29b84ca9d9ecde2a035954206b85f2871923aba0d52f73ba` |

The output is `rtool1-deploy.out`. A scan for key text found none. The internal key was written only to a 600 file under `/root/aisb-rtool1/` and shredded right after the route checks.

## Deploy (2026-11-16T12:27:45Z, rc 0)

| Check | Result |
|---|---|
| Before | host at c091b53; migration hash 4913e9f7; configuration at the baselines (gateway.env 2abb4049, ai.env 721f4772, Caddyfile 205770cf); runs off; nothing open |
| Deploy | `aisandbox-deploy df9f2b5` rc 0; HEAD and DEPLOYED at df9f2b5 (code equal to 5252393) |
| Migration | none: the hash stays 4913e9f7, and the latest migration is still `CreateAgentKnowledgeTriggerTables1813000000000` |
| Earlier checks | as before: preview host, guards, cookies, CORS, ports, keys, provider switch, Discord, schedules, and the event, mail and knowledge triggers (rows unchanged, all switches false); the eval copy hash 8f655afb is unchanged; time zones UTC |
| Internal results route | 401 without a key and with a wrong key; 400 for a bad user id with the key; 404 with the fixed body (`"code":"NOT_FOUND"`) for a made-up run with the key |
| Builds | gateway: internal results controller and result-grant files; AI service: run-result handler and grant files, `read_run_result` in 13 files |
| Before the env step | no `RUN_RESULT_TOOL_ENABLED` line |
| After | `/schedules` 200; Discord ready after the restart; the temporary API key revoked; nothing open |

## Env step

- **The line:** `RUN_RESULT_TOOL_ENABLED=false` was added to `gateway.env` with its comment line. The old content was checked byte for byte as the start of the new file, and a copy was kept at `/root/aisb-rtool1/gateway.env.before`.
- **The restart:** the gateway was restarted. It came back ready with Discord ready.
- **New gateway.env baseline:** `dc089a702d7d15dab288e0cc6ced56de3e7a95bcc159135ecd98eeedd7b96318` (600 root:root). ai.env and the Caddyfile are unchanged.
- **Flags:** `RUN_RESULT_TOOL_ENABLED=false`, `KNOWLEDGE_TRIGGERS_ENABLED=false`, `MAIL_TRIGGERS_ENABLED=false`, `EVENT_TRIGGERS_ENABLED=false`, `SCHEDULES_ENABLED=false`, `CHAT_DISCORD_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`.

## What this proves, and what is left

**Proven on staging:**
- the new code boots in the gateway and the AI worker;
- the internal route is reachable only with the internal key, refuses a bad user id, and gives the fixed not-found body;
- the switch is in place and off, so no job carries the grant.

**Left for RESULT-TOOL-LIVE-01** (a run window):
- a model calling the tool from a task that carries only a run id;
- the not-found cases through the tool;
- a workflow reading a result;
- a planted instruction in a result;
- `result_seen_at` and status unchanged;
- the cost, and the wording.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before, the gateway.env change checked byte for byte and its new hash recorded; 3 and 7: n/a, tester window closed; 4: nothing open before or after, health ready, units active; 5: from the host; 6: output scanned for key text, the internal key shredded after use, the temporary API key revoked, no secret printed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false;
- staging runs df9f2b5 with the run-result tool switched off, and all triggers, schedules and runs off.
