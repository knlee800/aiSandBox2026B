# STAGING-DEPLOY-CMSEC-01 — Checkpoint

**Task:** STAGING-DEPLOY-CMSEC-01 — Deploy the container-manager security fixes
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed** (host checks). Keith's checkpoint live smoke is still to come.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CM-GIT-HOST-01 LOCK, with acceptance lines added by the CM-HISTORY-LINK-01 LOCK. Keith approved the deploy on 2026-11-10 ("Yes, deploy it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | f423859 |
| 2. Deploy and host checks | cmsec-deploy.sh from the staging host, then a read-only check of the compiled history fix (cmsec-after) | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (cmsec-deploy.sh; aisandbox-deploy done 2026-11-10T13:28:31Z UTC)

8e1f8d3 → f423859, aisandbox-deploy rc 0. It carried four container-manager fixes:
- **CM-PATH-01:** path and session-id containment.
- **CM-SYMLINK-01:** the host-side `/api/files` routes removed, and the session-id pipe added.
- **CM-GIT-HOST-01:** the host-side git and shell paths removed.
- **CM-HISTORY-LINK-01:** checkpoint history no longer follows symlinks.

**Before.**
- HEAD and DEPLOYED were 8e1f8d3, migration hash 976a9358, clean tree.
- Configuration at the baselines; flags stub, stub, false; nothing running.
- The key matched across the three env files (compared by hash; only "match" printed).

**After.**
- HEAD and DEPLOYED are f423859. Migration hash unchanged; configuration and flags unchanged; all 8 units active.
- Standard checks:
  - Caddy answers 401 without login;
  - gateway health answers 200 on 3 routes;
  - 12 frontend pages answer 200;
  - 29 guard checks answer 401 without login;
  - the static test key gets 403;
  - CORS behaves as before;
  - the connector server lists both tools.

| Check | Result |
|---|---|
| Ports | 127.0.0.1 only |
| Guarded container-manager routes (`/api/git/x/checkpoints`, `/api/preview/x/status`, `/api/internal/stats`, billing-export, quota-visibility) | 403 with no key and with a wrong key; 200 with the key where checked |
| Removed routes with the key: `POST /api/sessions`, `POST /api/git/x/init`, `GET /api/git/x/history`, and the six `/api/files` routes (list, read, write, delete, mkdir, search) | 404 on all nine, so the stale dist files are not loaded |
| Earlier removed routes (executor, previews, `/api/api/internal`, `GET /api/sessions`) | 404 with the key |
| Bad session id with the key: `/api/git/%2E%2E/checkpoints`, `/api/preview/%2E%2E/status` | 400 on both (the session-id pipe) |
| `/api/internal/sessions/a%2Fb/stats` with the key | 404: no such route, so this probe proves nothing |
| Bad session id without the key | 403 (the guard runs before the pipe) |
| CORS preflight on 4002; WebSocket upgrade without the key | no CORS headers; 403 |
| Compiled container-manager | `SessionIdPipe` in 10 files, `isSinglePathSegment` in 4 |
| Compiled history fix (cmsec-after, `dist/git/git.service.js`) | `O_EXCL` present, 2 `base64` uses, no `copyFile`, no `require("simple-git")` |
| Journals | no key text; no binding errors; no open runs |

Two of the script's new build checks looked under `dist/src/git/`, but container-manager compiles to `dist/git/` (the gateway uses `dist/src/`). They printed blank, and neither can fail the script. cmsec-after checked the real path.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-CMSEC-01/`:

| File | SHA-256 |
|---|---|
| `cmsec-deploy.sh` | `c6ed5829cb8abcf02ab747747dd776dc29b3ad71ed852f6cc4deb6a0e338c9a7` |
| `cmsec-deploy.out` | `2ed551c2bd048174b939d103231b5a30c450597d4617497033908687b415f5d7` |
| `cmsec-after.out` | `b501e8b077f51dceb0a4f0078c55fb0f4a67f313499f70480b7820e29bf879b4` |

## Limits

Keith's checkpoint live smoke (FLOWS 5 for CM-HISTORY-LINK-01) needs a logged-in workspace session, so the host cannot run it. Runs are not needed:
1. make a checkpoint;
2. reopen the project in a new session, and the same checkpoints come back.

The bundle-file and over-8 MiB checks in the acceptance line are host reads the control plane can make after Keith's session. They are listed in CM-HISTORY-LINK-01's checkpoint.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, migration hash unchanged, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed. Registered: CHECKPOINT-LIVE-01, NOT_READY (Keith decides when): his checkpoint save and restore smoke on staging, after which the control plane checks the stored bundle (`git bundle verify`, no leftover bundle files) from the host.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs f423859, migration hash 976a9358, runs off.
