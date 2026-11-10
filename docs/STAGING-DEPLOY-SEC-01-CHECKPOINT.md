# STAGING-DEPLOY-SEC-01 — Checkpoint

**Task:** STAGING-DEPLOY-SEC-01 — Deploy the loopback binds and the ai-service guard to staging
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered by the AI-SERVICE-AUTH-01 LOCK (facfb9f). Keith approved the deploy on 2026-11-10 ("Yes, deploy it"). It waited until BIZ-USER-01C locked, so one migrating deploy carries everything.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | 9d56779 |
| 2. Deploy and host checks | sec-deploy.sh, from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (sec-deploy.sh, done 2026-11-10T05:47:00Z UTC)

fbbf41d → 9d56779 with aisandbox-deploy rc 0. It carried:
- AI-SERVICE-AUTH-01 and LOCAL-DEV-SYNC-01;
- BIZ-USER-01A, 01B and 01C (user workflows: migration, editor, Team page runs);
- AGENT-SPEC-01, OFFICE-07, DESIGN-GAPS-01 and 01B, DESIGN-CONTRAST-01, FE-TEST-COVERAGE-01 and FE-TEST-GLOB-01.

**Before the deploy:**
- HEAD and DEPLOYED were at fbbf41d, the migration hash was ece5f19b, and the tracked tree was clean.
- All eleven configuration files matched their baseline hashes.
- AI_PROVIDER and EMAIL_PROVIDER were stub, and GLOBAL_EXECUTION_ENABLED was false.
- Nothing was running, and the ops library was 3f380d7c in both places. Nothing under ops/ changed since fbbf41d.

**The migration:**
- The migration hash went from ece5f19b to **c4265632** (c426563297b5c6a6c68b447b5f37af8756d84176e8018f03badd4ee28534c704).
- `AddUserAgentWorkflowColumns` was applied: all 12 columns are present.
- aisandbox-deploy wrote its pre-migration backup to `/var/backups/aisandbox/20261110T054442Z`: COMPLETE, with db.dump, a manifest and checksums. The deploy record is `records/deploy-20261110T054426Z`.

**After the deploy, standard checks:**
- HEAD and DEPLOYED are at 9d56779. The configuration files are unchanged, and runs stay off.
- All eight units are active.
- Caddy answers 401 without login on 5 paths; the gateway health checks return 200 on 3 paths.
- Nine frontend pages return 200 in three languages.
- All 25 guard checks return 401, and the static test key returns 403.
- CORS refuses a foreign origin and echoes the app origin.
- The connector server lists both tools, and nothing was running.

**Security checks (AI-SERVICE-AUTH-01):**

| Check | Result |
|---|---|
| `ss -ltn` for 4000, 4001 and 4002 | 127.0.0.1:4000, 127.0.0.1:4001, 127.0.0.1:4002 only |
| LISTEN_HOST in gateway.env, ai.env and cm.env | 0 lines each: the default applies, and there was no env change |
| INTERNAL_SERVICE_KEY, gateway vs ai.env | match (only the comparison result was printed) |
| ai-service `/api/internal/queue/stats` | no key 401, wrong key 401, right key 200 |
| ai-service open routes | `/metrics` 200, `/api/conversations` 200, `POST /api/messages/health` 201 |
| container-manager `/api/health` | 200 |
| Throwaway `node:24-alpine` container on the default bridge (`--pull never`) → 172.17.0.1 | 4000, 4001 and 4002 all **ECONNREFUSED** |
| Startup journal | http://127.0.0.1:4000, :4001, :4002 |

The key went through a 0600 header file that was deleted afterwards. No output contains key text.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SEC-01/`:

| File | SHA-256 |
|---|---|
| `sec-deploy.sh` | `bd6d7c3582ad3dc554be66f72baff09402dafbe41f3996893f843944b02544b9` |
| `sec-deploy.out` | `173b96e81fdb79bdb5509357a0733a19cf9fd50d85dc747dfb24cddc8b72d4ca` |
| `sec-backup-check.out` | the read-only backup listing |

## Limits

- Runs stay off.
- The browser checks for today's frontend work are still owed, because they need Keith in the app with runs on. That covers the design slices, OFFICE-07 cancel, the Create Agent editor and the Team page workflows. They are listed in each task's checkpoint, and STAGING-DEPLOY-WF-01 / BIZ-LIVE-04 carries them.
- Container-manager routes still have no key check; only host processes can reach them now (CM-AUTH-01).

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING held; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, commit and the expected new migration hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The browser checks of today's frontend work are superseded by STAGING-DEPLOY-WF-01 / BIZ-LIVE-04, which already list them.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED, and stagingAuthorized is false;
- staging runs 9d56779, with migration hash c4265632 and runs off.
