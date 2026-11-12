# STAGING-DEPLOY-CLEANUP-02 — Checkpoint

**Task:** STAGING-DEPLOY-CLEANUP-02 — Deploy CM-CLEANUP-02
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the CM-CLEANUP-02 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 7a5bf0c |
| 2. Deploy and host checks | cleanup2-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (cleanup2-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T07:37:48Z UTC)

8427c2f → 7a5bf0c. It carries CM-CLEANUP-02.

**Before:**
- HEAD and DEPLOYED were at 8427c2f.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 7a5bf0c.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- `aisandbox-cm` is active, and its keyed stats answer 200.
- The standard, security, path and body-limit checks pass.
- **The removed routes:** `DELETE /api/internal/sessions/<id>/container` answers 404 with the key and without it, for two ids. So does `POST /api/internal/sessions/<id>/previews`, which BROWSER-SMOKE-02 removed.
- **The build:** `sessions/sessions.service.js` no longer has `removeSessionContainer`, and `sessions/internal-sessions.controller.js` has no `:id/container` route.
- There is no key text in the journals, and no runs were open.

No Keith step was required.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-CLEANUP-02/`:

| File | SHA-256 |
|---|---|
| `cleanup2-deploy.sh` | `c5ffe9d963ac7fe553dd3518aecd3bab45e1d0986745bdeaf892d51ecc5028b9` |
| `cleanup2-deploy.out` | `a048f3501c9a5462b6d64af373b0b2a63d56ef338605e4fc6f94581fef7e696f` |

The output was checked for key text, and none was found.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 7a5bf0c with migration hash 9cfde25f, and runs are off.
