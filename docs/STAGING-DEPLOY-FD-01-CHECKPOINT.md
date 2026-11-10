# STAGING-DEPLOY-FD-01 — Checkpoint

**Task:** STAGING-DEPLOY-FD-01 — Deploy the Chief of Staff front door
**Status:** COMPLETE AND LOCKED — 2026-11-11. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-ONE-PLAN-01. Keith approved the deploy ("Yes, deploy it"). At admission it was re-scoped: the front door (COS-FRONTDOOR-01, -01B, -01C) deploys now, and the rest of Stage 4 deploys with STAGING-DEPLOY-FD-02.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission and re-scope | Lane 1 with STAGING and ENV; stagingAuthorized true; STAGING-DEPLOY-FD-02 registered | 537ebfb |
| 2. Deploy and host checks | fd-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (fd-deploy.sh; aisandbox-deploy done 2026-11-10T16:49:50Z UTC)

f423859 → 537ebfb, aisandbox-deploy rc 0. It carries COS-FRONTDOOR-01, -01B and -01C.

**Before:**
- HEAD and DEPLOYED were at f423859, the migration hash was 976a9358, and the tree was clean.
- The configuration files matched their baselines. Flags: stub, stub, false. Nothing was running.
- `INTERNAL_SERVICE_KEY` matched across gateway.env, ai.env and cm.env, compared by hash; only "match" was printed.

**Migration:**
- The deploy tool took a pre-migration backup, `/var/backups/aisandbox/20261110T164607Z`.
- It applied `CreateCollaborationRostersTable1805000000000`, which is now the latest migration row.
- `collaboration_rosters` exists with `member_ids`, `updated_at` and `user_id`, and has 0 rows.
- The migration hash moved from 976a9358 to bf6d40ae30679bd6818735493131dbed7a6bb0693e0c5b77009e34aaa08e3156.
- Down path, not run: the migration's down() drops the table, which loses only saved rosters. The backup above is the alternative.

**After:**
- HEAD and DEPLOYED are at 537ebfb. The configuration files and flags are unchanged, and all 8 units are active.
- **Standard checks:**
  - Caddy answers 401 without login.
  - Gateway health answers 200 on 3 paths.
  - 12 frontend pages answer 200.
  - 31 guard checks answer 401 without login. That includes `GET /api/collaboration/roster` and `PUT /api/collaboration/roster`.
  - The static test key gets 403.
  - CORS refuses a foreign origin and echoes the app's.
  - The connector server lists both tools.
- **Earlier checks, all passing:**
  - Ports listen on 127.0.0.1 only.
  - ai-service guard: no key 401, wrong key 401, right key 200.
  - Container-manager: the guard holds; the nine removed host-side routes and the earlier removed routes answer 404 with the key; a `%2E%2E` session id gets 400 with the key and 403 without.
  - No CORS headers on 4002, and the WebSocket upgrade is refused.
  - The traversal URLs answer 401.
  - No key text in the journals, and no switch-on binding errors.
  - No open runs.
- **New code in the builds:**
  - gateway: `CollaborationRosterController` in 3 files, `collaboration-front-door.js` present, and `report_back` in 3 files;
  - frontend: the roster picker test id in 8 files.
- **One probe proved nothing:** `/api/internal/sessions/a%2Fb/stats` answered 404 because that route doesn't exist, as in the last deploy.
- **Known blank lines:** the script's build lines that look under `dist/src/...` for container-manager, or under `dist/user-agent/` for the gateway, print blank or 0. Those paths are wrong (container-manager compiles to `dist/`, the gateway to `dist/src/`), and the real files were checked in STAGING-DEPLOY-CMSEC-01 and STAGING-DEPLOY-WS3-01.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-FD-01/`:

| File | SHA-256 |
|---|---|
| `fd-deploy.sh` | `d41cc6b7150afb1902795e22df0136752eefbf3a2e789921db22ce118dd4e0a6` |
| `fd-deploy.out` | `5aac796f82fe2653894ae078d02f042cc9c033c7e8b00014f30936525d58fbe6` |

## Limits

The front-door flows need a login and a real model, so they belong to Keith's live check, FRONTDOOR-LIVE-01 (runs on). It covers:
- saving a roster;
- dispatch and report-back;
- the final answer in Results;
- a second round;
- a skipped draft;
- an empty roster;
- direct runs unchanged;
- the eval rerun with the new prompt.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, the expected migration applied after a backup, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The logged-in checks are superseded by FRONTDOOR-LIVE-01's acceptance lines.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 537ebfb with migration hash bf6d40ae, and runs are off.
