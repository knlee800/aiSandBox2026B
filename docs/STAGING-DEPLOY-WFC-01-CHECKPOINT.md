# STAGING-DEPLOY-WFC-01 — Checkpoint

**Task:** STAGING-DEPLOY-WFC-01 — Deploy the workflow draft and switch-on fixes
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered and admitted in one record (678d511) after WORKFLOW-CREATE-01 and WORKFLOW-STATUS-02 locked. Keith approved the deploy on 2026-11-10 ("Yes, deploy it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 678d511 |
| 2. Deploy and host checks | wfc-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (wfc-deploy.sh; aisandbox-deploy done 2026-11-10T10:40:58Z UTC)

324ccca → 678d511, aisandbox-deploy rc 0. It carried WORKFLOW-CREATE-01 (new agents stored as drafts; Role and Description prefilled, with a hint) and WORKFLOW-STATUS-02 (the server refuses switching on an untested workflow; the Draft badge).

**Before.**
- HEAD and DEPLOYED were 324ccca, migration hash 976a9358, clean tree.
- Configuration files at their baselines; flags stub, stub, false; nothing running.
- `INTERNAL_SERVICE_KEY` matches across the three env files (hash comparison; only "match" printed).
- Ops library 3f380d7c.

**After.**
- HEAD and DEPLOYED are 678d511. The migration hash is **unchanged** (976a9358; none was expected), and the latest migration row is still `AddCollaborationRunResultSeenAt1804000000000`.
- Configuration files and flags unchanged; all 8 units active.
- **Standard checks:**
  - Caddy answers 401 without login.
  - Gateway health answers 200 on 3 routes.
  - 12 frontend pages answer 200, the Results page in three languages among them.
  - 29 guard checks answer 401 without login.
  - The static test key gets 403.
  - CORS refuses a foreign origin and echoes the app's.
  - The connector server lists both tools.

| Check | Result |
|---|---|
| Ports 4000, 4001, 4002 | 127.0.0.1 only |
| ai-service guard; removed chat routes | 401, 401, 200; 404 on all three |
| container-manager guard, corrected routes, removed routes, CORS, WebSocket upgrade | 403/403 on five routes; 200 with the key on three; 404 on six removed routes; no CORS headers; upgrade 403 |
| Gateway traversal URLs without login | 401 on all three |
| Gateway build | `USER_WORKFLOW_SWITCH_ON_CHECK` in 4 files, `NEW_USER_AGENT_STATUS` in 2, plus the earlier markers |
| Frontend build | the Draft badge test id (`agent-station-status-`) in 4 files |
| `user_agents` by status | active=1 (Keith's CoSCopy; existing rows unchanged, as designed) |
| Key text in journals; open runs | 0 lines each; none |
| Business rows | 1 project, 1 session (from BIZ-LIVE-04) |
| Runs | off |

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-WFC-01/`:

| File | SHA-256 |
|---|---|
| `wfc-deploy.sh` | `f95bb8ef5df14a257c443168a6933d44b4e0654695a8c7ed38b02c180886781b` |
| `wfc-deploy.out` | `4ea30e5de699caf1e4ae4626891556ab5d8038cd2af734ba93093b521714699d` |

## Limits

The switch-on refusal and the draft default need a logged-in owner, so the host cannot check them. They are covered by tests: WORKFLOW-STATUS-02 has 28 gateway tests, including a two-module wiring test. Keith's browser checks, whenever he next opens staging, with no runs needed:
- a new or copied workflow shows the amber Draft badge;
- Role and Description arrive prefilled, with the hints;
- the panel switch stays off-limits until a test run passes.

These are listed in the WORKFLOW-CREATE-01 and WORKFLOW-STATUS-02 checkpoints.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, migration hash unchanged, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The logged-in browser checks are superseded by the live-check lists in the WORKFLOW-CREATE-01 and WORKFLOW-STATUS-02 checkpoints, which Keith runs when he next opens staging.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 678d511, migration hash 976a9358, runs off.
