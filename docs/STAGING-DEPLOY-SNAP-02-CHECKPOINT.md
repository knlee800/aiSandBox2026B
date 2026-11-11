# STAGING-DEPLOY-SNAP-02 — Checkpoint

**Task:** STAGING-DEPLOY-SNAP-02 — Deploy the snapshot pick and the route-scoped body limit
**Status:** COMPLETE AND LOCKED — 2026-11-11. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the SNAPSHOT-PICK-01 and CM-BODY-ROUTE-01 LOCK. Keith approved on 2026-11-11 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | a64c82d |
| 2. Deploy and host checks | snap2-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (snap2-deploy.sh; aisandbox-deploy rc 0 at 2026-11-11T17:21:37Z UTC)

7399830 → a64c82d. It carries SNAPSHOT-PICK-01 (a reopen restores only the same project's snapshot) and CM-BODY-ROUTE-01 (16 MB JSON only on the internal file write route).

**Before:**
- HEAD and DEPLOYED were at 7399830.
- `INTERNAL_SERVICE_KEY` matched across the three env files, compared by hash.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at a64c82d.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- The standard checks pass, and so do the earlier route, CORS, session-id and guard checks.
- **New code in the builds:**
  - gateway: `parseProjectIdFromSnapshotLabel` (2 files);
  - container-manager `app-setup.js`: `isFileWriteRequest` and the `'100kb'` default.

**Body limits, checked without the internal key:**

| Request | Result |
|---|---|
| 1 MB to the file write route | 403: parsed at 16 MB, then refused by the guard |
| 1 MB to `files/search` | 413: the 100 KB parser |
| A small body to `files/search` | 403 |

The earlier SNAPSHOT-BINARY-01 and SNAPSHOT-SIZE-01 build checks still pass. There is no key text in the journals, and no runs were open. The `curl: (7) Failed to connect` lines come from the health wait while the services restart, and are harmless.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SNAP-02/`:

| File | SHA-256 |
|---|---|
| `snap2-deploy.sh` | `5d75f392e88f2895277829fdb0eeb3fb4fb6dc06ec0778c6df0ee467af796b7c` |
| `snap2-deploy.out` | `04c15f8798922885587e9b5fcc892b36cd7e55b37a3c08ced2aa053237067492` |

The output was checked for key text, and none was found.

## Limits

- **No browser check.** The pick change is covered by unit tests, and no Keith step was required. Keith's CL2 test project can be reopened at any time to see it still opens with its image.
- **Still registered, not ready:** SNAPSHOT-NOTICE-01, ARCHIVE-BINARY-01, SNAPSHOT-LABEL-01 and CM-BODY-KEY-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs a64c82d with migration hash 9cfde25f, and runs are off.
