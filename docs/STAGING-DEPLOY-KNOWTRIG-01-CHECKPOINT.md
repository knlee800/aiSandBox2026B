# STAGING-DEPLOY-KNOWTRIG-01 — Checkpoint

**Task:** STAGING-DEPLOY-KNOWTRIG-01 — Deploy knowledge triggers and check the page
**Status:** COMPLETE AND LOCKED — 2026-11-16. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (tester window closed).
**Source:** registered 2026-11-16 by the TRIGGER-MORE-01 LOCK. Keith approved the deploy on 2026-11-16 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized true | c091b53 |
| 2. Deploy, env step, Keith's page check, host evidence | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts and outputs

The files are in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-KNOWTRIG-01\`. The control plane made `know1-deploy.sh` from `mail1-deploy.sh` using `mk_know1.py` in its scratchpad, and asserted each change. The two scripts differ in 62 lines.

| File | SHA-256 |
|---|---|
| `know1-deploy.sh` | `51bbbb880b84df31f8f5d802fcf54e9aaa553a7e0f94955bc48b24d7b2eb799b` |
| `know1-evidence.sh` (read only) | `4df200794f4bfcdf863fa3c4ffa280ef15573a072552a4c1e6bdfa56168a9844` |

The outputs are `know1-deploy.out` and `know1-evidence.out`. A scan for key text found none.

## Deploy (2026-11-16T09:00:53Z, rc 0)

| Check | Result |
|---|---|
| Before | host at 4259466; migration hash 322865ef; configuration at the baselines (gateway.env 97471cb0, ai.env 721f4772, Caddyfile 205770cf); runs off; nothing open |
| Deploy | `aisandbox-deploy c091b53` rc 0, with the tool's pre-migration backup; HEAD and DEPLOYED at c091b53 (code equal to a0d3bbd) |
| Migration 1813 | hash 322865ef to 4913e9f7; `agent_knowledge_triggers` and `agent_knowledge_trigger_runs` present; the unique (trigger_id, document_key) index, 5 CHECKs, 2 cascades; 0 rows; latest migration `CreateAgentKnowledgeTriggerTables1813000000000` |
| Earlier checks | as before. Schedules: 4 rows, switch off. Event triggers: Keith's rows unchanged, switch off. Mail triggers: Keith's 2 triggers and 4 history rows unchanged, switch off. Also the preview host, guards, cookies, CORS, ports, keys, provider switch and Discord |
| Knowledge-trigger routes | GET without a session 401; with an API key alone 401; POST without a session 401; POST cross-origin 403 |
| Builds | gateway knowledge-trigger controller, timer, run service and match files; the frontend section (zh-TW heading 新增檔案時) |
| Before the env step | no `KNOWLEDGE_TRIGGERS_ENABLED` line; no knowledge-trigger journal lines; 0 `connector.trigger_read` rows since the deploy |
| Time zones | system `Etc/UTC`; the gateway process has no `TZ` override; the database `Etc/UTC`; database `now()` in UTC equals `localtimestamp`. So the `TIMESTAMP` columns of `knowledge_documents`, compared in code, read correctly (stage-start section 4, Times) |
| Pages | `/en`, `/zh-TW` and `/zh-CN` `/schedules` 200; Discord ready after the restart; the temporary API key revoked |

## Env step

- **The line:** `KNOWLEDGE_TRIGGERS_ENABLED=false` was added to `gateway.env` with its comment line. The old content was checked byte for byte as the start of the new file, and a copy was kept at `/root/aisb-know1/gateway.env.before`.
- **The restart:** the gateway was restarted. It came back ready with Discord ready, the route refuses without a session, and there were no schedule lines.
- **New gateway.env baseline:** `2abb4049585e104957466bc7a51566ddea1050c6d1877dd44bf4afb97eae5010` (600 root:root). ai.env and the Caddyfile are unchanged.
- **Flags:** `KNOWLEDGE_TRIGGERS_ENABLED=false`, `MAIL_TRIGGERS_ENABLED=false`, `EVENT_TRIGGERS_ENABLED=false`, `SCHEDULES_ENABLED=false`, `CHAT_DISCORD_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`.

## Keith's page check ("Done, all fine")

The steps given for the When a file is added section:
- create a Chief of Staff trigger on a shared folder, with the marker PINEAPPLE40 in the task;
- try the Chief of Staff with a "(workflow only)" folder;
- change the trigger, and switch it off and on;
- create a trigger for one of his workflows and delete it after the confirm step;
- look at the section in 繁體中文 and at phone width.

## Host evidence (read only)

| Check | Result |
|---|---|
| Triggers | 1, Keith's: Chief of Staff, folder `company-monthly-reports`, Asia/Hong_Kong, enabled, the task holding the marker (text not shown), armed after the deploy |
| Run rows | 0 |
| Audit rows (`agent_knowledge_trigger`) | created 2, updated 1, deleted 1. The only payload keys are scopeId, targetKind, triggerId and workflowId. The steps named a change plus an off and an on, but the host counted one update row. Every update writes an audit row (`knowledge-trigger.service.ts:235`), so fewer saves were made than the steps listed. Keith reported the section fine |
| Text in logs | PINEAPPLE40 appears in no audit row and in no app-service journal line for the whole boot |
| Reads and runs | no knowledge-trigger run, claim, cap, disabled or history journal lines |
| State | gateway.env 2abb4049, ai.env 721f4772, Caddyfile 205770cf; all switches off; nothing open; DEPLOYED c091b53 |

## What this proves, and what is left

**Proven on staging:**
- migration 1813 and the per-owner create path against PostgreSQL;
- the TriggersModule boot with the knowledge timer and the `knowledge_documents` repository;
- the session-only, owner-scoped routes;
- the When a file is added section in a browser;
- audit rows and logs without task text;
- the UTC time zones the timestamp rule needs;
- no read or run with the switch off.

**Left for TRIGGER-KNOW-LIVE-01** (a run window):
- real batches from uploaded files and their timing;
- a real triggered run, once per document version across a restart;
- the unchanged and changed re-uploads, other folders and armed_at;
- the cap skip, the cost by batch size, and the wording.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before, the gateway.env change checked byte for byte and its new hash recorded; 3 and 7: n/a, tester window closed; 4: nothing open before or after, health ready, units active; 5: from the host; 6: outputs scanned for key text, the temporary API key revoked, no secret printed; the gateway's environment was read for its TZ line only)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false;
- staging runs c091b53 with knowledge, mail and event triggers, schedules and runs off.
