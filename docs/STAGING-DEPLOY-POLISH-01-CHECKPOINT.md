# STAGING-DEPLOY-POLISH-01 — Checkpoint

**Task:** STAGING-DEPLOY-POLISH-01 — Deploy the draft card language names, the preview content types, the dependency clean-up and the cut-diff notice
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the COS-DRAFTS-POLISH-01 and CM-CONTENT-TYPE-02 LOCK, with CM-DEPS-01 and CM-DIFF-NOTICE-01 added. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | d610df8 |
| 2. Deploy and host checks | polish1-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (polish1-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T06:21:09Z UTC)

884110c → d610df8. It carries four tasks:
- COS-DRAFTS-POLISH-01;
- CM-CONTENT-TYPE-02;
- CM-DEPS-01, a lockfile change;
- CM-DIFF-NOTICE-01.

**Before:**
- HEAD and DEPLOYED were at 884110c.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at d610df8.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- The deploy's install step accepted the changed lockfile.
- The standard checks and the earlier security checks pass.
- **Body limits on the file write route:**

| Request | Result |
|---|---|
| 1 MB with the key | 404 |
| 1 MB with a wrong key | 413 |
| 1 MB without the key | 413 |
| A small body without the key | 403 |

- **New code in the builds:**

| Task | Check | Found |
|---|---|---|
| COS-DRAFTS-POLISH-01 | the zh-TW draft-card language name 與我書寫的語言相同 in the frontend build | 16 files |
| CM-DIFF-NOTICE-01 | the notice test id `history-diff-truncated-notice` in the frontend build | 4 files |
| CM-DIFF-NOTICE-01 | `diffLimitBytes` in the gateway build | 2 files |
| CM-CONTENT-TYPE-02 | `application/pdf` in `preview/preview.service.js` | present |
| CM-DEPS-01 | `jsonwebtoken` lines left in container-manager's `package.json` | 0 |

- There is no key text in the journals, and no runs were open.

No Keith step was required.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-POLISH-01/`:

| File | SHA-256 |
|---|---|
| `polish1-deploy.sh` | `2b7014063e417301dde163b6e799c83d2d20740f7fda37d10cd6a45d8a1f361b` |
| `polish1-deploy.out` | `31f06cc0250238910d5791ca060617f3a94e1e00bf425841be9ad54d0e90bf0b` |

The output was checked for key text, and none was found.

## Limits

- **Still registered, not ready, all optional:**
  - CM-DIFF-NOTICE-02;
  - REPLY-LANG-KEYS-01;
  - PAGE-ERROR-POLISH-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, the lockfile installed, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs d610df8 with migration hash 9cfde25f, and runs are off.
