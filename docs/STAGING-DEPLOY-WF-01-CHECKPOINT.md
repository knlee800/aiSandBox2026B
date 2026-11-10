# STAGING-DEPLOY-WF-01 — Checkpoint

**Task:** STAGING-DEPLOY-WF-01 — Deploy user workflows
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan row 32). Keith approved the deploy on 2026-11-10 ("Yes, deploy it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 324ccca |
| 2. Deploy and host checks | wf-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (wf-deploy.sh; aisandbox-deploy done 2026-11-10T08:18:16Z UTC)

2052c36 → 324ccca, aisandbox-deploy rc 0. 324ccca is the admission record; its code equals eed33f9. It carried:
- CM-PREFIX-01, CM-CLEANUP-01 and CM-CLEANUP-01B;
- RESULTS-01, with migration 1804000000000;
- TEAM-NO-SESSION-02.

**Before:**
- HEAD and DEPLOYED were at 2052c36, with migration hash c4265632 and a clean tree.
- The configuration files matched the baselines. Flags: stub, stub, false. Nothing was running.
- `INTERNAL_SERVICE_KEY` matched across gateway.env, ai.env and cm.env, compared by hash.
- The ops library was 3f380d7c.

**Migration:**
- The deploy tool took a pre-migration backup, `/var/backups/aisandbox/20261110T081546Z`. Its manifest checks were all OK.
- It applied `AddCollaborationRunResultSeenAt1804000000000`, the latest migration row. `collaboration_runs.result_seen_at` exists as a nullable `timestamp with time zone`.
- The migration hash went from c4265632 to 976a9358db4db4ef24fbb116b0943e3600bfc734b448a552920692c69e66b2f9.
- **Down path, not run:** the migration's down() drops the column, losing only the seen marks. Alternatively, restore the backup above.

**After:**
- HEAD and DEPLOYED are at 324ccca. The tree is clean, the configuration files and flags are unchanged, and all eight units are active.
- **Standard checks:**
  - Caddy answers 401 without login on 5 paths; gateway health answers 200 on 3.
  - 12 frontend pages answer 200, including `/en/results`, `/zh-TW/results` and `/zh-CN/results`.
  - 29 guard checks answer 401 without login, including `GET /api/results`, `GET /api/results/unread-count`, `POST /api/results/none/seen` and `GET /api/collaboration/workflows`.
  - The static test key gets 403. CORS refuses a foreign origin and echoes the app's. The connector server lists both tools.

| Check | Result |
|---|---|
| 4000, 4001, 4002 | 127.0.0.1 only |
| ai-service queue/stats | no key 401, wrong key 401, right key 200; /metrics and /api/conversations open (200) |
| ai-service `POST /api/messages/chat`, `POST /api/messages/health`, `GET /api/messages/chat/stream` with the key (CM-CLEANUP-01 F4) | 404 on all three |
| container-manager health, no key | 200 |
| `/api/files/x/list`, `/api/preview/x/status`, `/api/internal/stats`, `/api/internal/billing-export/limits`, `/api/internal/quota-visibility/user/<uuid>` | 403 with no key and with a wrong key, on all five |
| `/api/internal/stats`, `/api/internal/billing-export/limits`, `/api/internal/quota-visibility/user/<uuid>` with the key (CM-PREFIX-01) | 200 on all three |
| Removed routes with the key: `/api/api/internal/billing-export/limits`, `GET /api/executor/commands`, `POST /api/executor/x/execute`, `GET /api/sessions`, `/api/previews/x/health`, `/api/internal-previews/proxy/x/a` | 404 on all six. The 12 stale `dist/` files for the removed modules are not loaded |
| container-manager CORS preflight from a foreign origin (CM-CLEANUP-01 F5) | no `Access-Control-Allow-*` headers |
| WebSocket upgrade to 4002 without the key | 403 |
| Gateway traversal URLs without login | 401 on all three; none answered 200 |
| Gateway build | resolvePreviewForward 2, filterProxyResponseHeaders 3, CollaborationResultsController 3, CollaborationBusinessSessionService 5 files |
| `ws: true` in container-manager's build | 0 |
| Key text in the gateway, ai and cm journals | 0 lines each |
| Open runs after the deploy; business rows | none; 0 projects, 0 sessions (created at the first session-less start) |
| Runs | off (AI_PROVIDER stub, GLOBAL_EXECUTION_ENABLED false) |

The key went through a 0600 header file, deleted afterwards. No output contains key text.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-WF-01/`:

| File | SHA-256 |
|---|---|
| `wf-deploy.sh` | `440381a5b748efd2c5d5db89fe9788d6fc5343dfbdcdcb1254787edc176f75c9` |
| `wf-deploy.out` | `46011947ba7ad21aa64e7ad1d91b8dc4be6fc63c8d7f5449e23b0b45dcb626ac` |

## Limits

- **Logged-in checks not run.** They go through Caddy and need a platform login, so they belong to Keith's live check, BIZ-LIVE-04:
  - the Results page with data, and the unread badge;
  - a session-less workflow run, and the two business rows on real Postgres;
  - the preview path with real headers.
- **Runs stay off.**

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, the expected migration applied with a backup first, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The logged-in checks are superseded by BIZ-LIVE-04's acceptance lines.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 324ccca, with migration hash 976a9358 and runs off.
