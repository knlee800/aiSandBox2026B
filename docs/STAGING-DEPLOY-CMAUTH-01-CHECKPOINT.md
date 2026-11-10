# STAGING-DEPLOY-CMAUTH-01 — Checkpoint

**Task:** STAGING-DEPLOY-CMAUTH-01 — Deploy the container-manager key guard and the preview traversal fix
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered by the CM-AUTH-01 LOCK (7615c7b). Keith approved the deploy on 2026-11-10 ("Yes, deploy it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | 2052c36 |
| 2. Deploy and host checks | cma-deploy.sh, then cma-after.sh, from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (cma-deploy.sh; aisandbox-deploy done 2026-11-10T06:48:18Z UTC)

9d56779 → 2052c36, aisandbox-deploy rc 0. It carried:
- CM-AUTH-01 and DRIFT-FIX-01;
- TEAM-PRESELECT-01, TEAM-NO-SESSION-01 and BIZ-USER-01D.

**Before:**
- HEAD and DEPLOYED were at 9d56779; the migration hash was c4265632 and the tree was clean.
- The configuration files matched their baselines.
- Flags: stub, stub, false. Nothing was running.
- `INTERNAL_SERVICE_KEY` matched across gateway.env, ai.env and cm.env, compared by hash; only "match" was printed.

**After:**
- **Deploy state:** HEAD and DEPLOYED are at 2052c36. The migration hash is unchanged (none was expected). The configuration files and flags are unchanged, and all eight units are active.
- **Standard checks:**
  - Caddy answers 401 without login on 5 paths.
  - Gateway health answers 200 on 3 paths.
  - Nine frontend pages answer 200 in three languages.
  - All 25 guard checks answer 401, and the static test key answers 403.
  - CORS refuses a foreign origin and echoes the app's.
  - The connector server lists both tools.

**CM-AUTH-01 checks:**

| Check | Result |
|---|---|
| container-manager `GET /api/health`, no key | 200 |
| `/api/executor/commands`, `/api/sessions`, `/api/files/x/list`, `/api/preview/x/status`, `/api/internal/stats`, `/api/api/internal/billing-export/limits` | 403 with no key and with a wrong key, on all six |
| `/api/executor/commands` and `/api/internal/stats` with the key | 200 |
| WebSocket upgrade to 4002 without the key | 403, not upgraded |
| Gateway traversal URLs (`/api/preview/x/%2e%2e/%2e%2e/executor/commands`, `.../files/y/list`, `proxy/%2e%2e x3/internal/stats`) sent raw, without login | 401; none answered 200 |
| The preview allowlist (`resolvePreviewForward`) in the gateway build | present (2 files) |
| `ws: true` in container-manager's build, comments included | 0 |
| 4000, 4001 and 4002 | 127.0.0.1 only |
| Key text in container-manager's journal | 0 lines |
| Open runs after the deploy; runs | none; off (AI_PROVIDER stub, GLOBAL_EXECUTION_ENABLED false) |

The key went through a 0600 header file, deleted afterwards. No output contains key text.

**The script exit.** cma-deploy.sh exited 1 straight after the allowlist check. The cause was the script, not the deploy: its `ws: true` grep found no match, which is the good result. grep then exits 1, and under `pipefail` with `set -e` the script stopped without a message. The remaining checks (ws, ports, journal, open runs, done marker) were rerun read-only in cma-after.sh, and all passed.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-CMAUTH-01/`:

| File | SHA-256 |
|---|---|
| `cma-deploy.sh` | `07bed4091ae97fb064342effa2cb0c979b3259bdde506458b9f8af54fb16b0c8` |
| `cma-deploy.out` | `0abfa3a9c86cd7a9098e581015c84bbaf8fc849aa01fa8435e89f5304e089703` |
| `cma-after.sh` | `52b7bb1e031292ed817273d3c3cc16f1238a42e745c63235ae57571b47a06b46` |
| `cma-after.out` | `b7c6a852df34b1175f613cbf7e061f9aef3911555c05b160ddfbbe8ef544088a` |

## Limits

- **Logged-in checks not run.** The owner path through Caddy needs a platform login, which the host does not have. That covers:
  - the workspace file list, read and write;
  - preview start, status, stop and assets;
  - checkpoint save, restore, revert and diff;
  - Agent-mode exec;
  - a logged-in owner sending the traversal URLs, which should answer 404.

  The traversal is covered by CM-AUTH-01's 97 tests against the real ownership guard, where the owner mock owns every session. The browser checks go to Keith's next live session, STAGING-DEPLOY-WF-01 / BIZ-LIVE-04.
- **Runs stay off.**

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING held; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit and an unchanged migration hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The logged-in owner checks are superseded by STAGING-DEPLOY-WF-01 / BIZ-LIVE-04. Lesson, recorded in the control plane's tooling notes: guard every grep count under `pipefail` with `|| true`.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED, with stagingAuthorized false;
- staging runs 2052c36 with runs off.
