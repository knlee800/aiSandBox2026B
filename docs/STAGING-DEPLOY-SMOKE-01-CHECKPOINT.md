# STAGING-DEPLOY-SMOKE-01 — Checkpoint

**Task:** STAGING-DEPLOY-SMOKE-01 — Deploy the browser-smoke preview fix
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the BROWSER-SMOKE-01 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 1d91897 |
| 2. Deploy and host checks | smoke1-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (smoke1-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T06:45:37Z UTC)

d610df8 → 1d91897. It carries BROWSER-SMOKE-01.

**Before:**
- HEAD and DEPLOYED were at d610df8.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 1d91897.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- **The container-manager started with the new module wiring:** `aisandbox-cm` is active, and `GET /api/internal/stats` with the key answers 200. Nest resolves dependencies at start-up, so a broken provider would have stopped it.
- The standard checks pass, and so do the earlier security checks.
- **Body limits on the file write route:**

| Request | Result |
|---|---|
| 1 MB with the key | 404 |
| 1 MB with a wrong key | 413 |
| 1 MB without the key | 413 |
| A small body without the key | 403 |

- **New code in the build:** `registerBrowserSmokeTarget` is in `preview/preview.service.js` (2 matches), and `sessions.module.js` is present.
- There is no key text in the journals, and no runs were open.

No Keith step was required.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SMOKE-01/`:

| File | SHA-256 |
|---|---|
| `smoke1-deploy.sh` | `737ece7332930891993252da3dc11d5b52c7d56898f5a3e294488ab868e7b519` |
| `smoke1-deploy.out` | `15d057bdd8620253658b43bc1dc2337fad0e2e28c569560e468e8cdb71823145` |

The output was checked for key text, and none was found.

## Limits

- **No live check of browser smoke was run.** It needs runs on, a real model, and a session on the browser-capable image, which the UI cannot start today. It is registered as BROWSER-SMOKE-LIVE-01, for Keith to decide.
- **Still registered, not ready:** BROWSER-SMOKE-02, which is optional.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 1 registered (BROWSER-SMOKE-LIVE-01, the optional Agent-mode live check) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 1d91897 with migration hash 9cfde25f, and runs are off.
