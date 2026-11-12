# STAGING-DEPLOY-I18N-02 — Checkpoint

**Task:** STAGING-DEPLOY-I18N-02 — Deploy the shared history-list parser and the translated network error
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the SNAPSHOT-LABEL-02 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 884110c |
| 2. Deploy and host checks | i18n2-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (i18n2-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T05:00:29Z UTC)

f3de35a → 884110c. It carries two tasks:
- SNAPSHOT-LABEL-02: the history list uses the shared label parser;
- NETWORK-ERROR-I18N-01: a network-failure helper and the translated network error on the workspace page.

**Before:**
- HEAD and DEPLOYED were at f3de35a.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 884110c.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- The standard checks pass, and so do the earlier security checks.
- **Body limits on the file write route:**

| Request | Result |
|---|---|
| 1 MB with the key | 404 |
| 1 MB with a wrong key | 413 |
| 1 MB without the key | 413 |
| A small body without the key | 403 |

- **New code in the build:** the fetch-failure patterns (4 files). The earlier translated text is still present.
- There is no key text in the journals, and no runs were open.

No Keith step was required.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-I18N-02/`:

| File | SHA-256 |
|---|---|
| `i18n2-deploy.sh` | `5c5575f9740abe2326714999a10f1c8a876f79a4cd751eef9a033edff38446be` |
| `i18n2-deploy.out` | `c12ab9841a45786fd969e75e2e476a50d566523a2c3b06c3986c6d42a3d675bb` |

The output was checked for key text, and none was found.

## Limits

- **Still registered, not ready:** PAGE-ERROR-POLISH-01, which is optional.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 884110c with migration hash 9cfde25f, and runs are off.
