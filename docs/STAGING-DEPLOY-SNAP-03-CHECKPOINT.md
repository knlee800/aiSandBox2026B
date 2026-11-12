# STAGING-DEPLOY-SNAP-03 — Checkpoint

**Task:** STAGING-DEPLOY-SNAP-03 — Deploy binary-safe zip export and import and the keyed body limit
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the ARCHIVE-BINARY-01 and CM-BODY-KEY-01 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 7c2a401 |
| 2. Deploy and host checks | snap3-deploy.sh, then snap3-keycheck.sh, from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (snap3-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T01:21:17Z UTC)

a64c82d → 7c2a401. It carries:
- ARCHIVE-BINARY-01: byte-exact zip export and import;
- CM-BODY-KEY-01: the 16 MB file write parser runs only with the valid internal key.

**Before:**
- HEAD and DEPLOYED were at a64c82d.
- `INTERNAL_SERVICE_KEY` matched across the three env files, compared by hash.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 7c2a401.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- The standard checks pass, and so do the earlier route, CORS, session-id and guard checks.
- **New code in the builds:**
  - `internalKeyMatches` is in container-manager `app-setup.js`;
  - gateway `src/snapshots/workspace-archive.service.js` has the base64 calls (5), and the old "non-UTF8" refusal is gone (0).
- The SNAPSHOT-PICK-01, CM-BODY-ROUTE-01, SNAPSHOT-BINARY-01 and SNAPSHOT-SIZE-01 build checks still pass.
- There is no key text in the journals, and no runs were open.

**Body limits:**

| Request | Result |
|---|---|
| 1 MB to the file write route, without the key | **413** (was 403 before CM-BODY-KEY-01) |
| A small body to the file write route, without the key | 403 |
| 1 MB to `files/search`, without the key | 413 |
| A small body to `files/search`, without the key | 403 |
| 1 MB to the file write route, with the key (an unknown session) | 404: read in full, reaches the handler, not refused for size |
| 1 MB to the file write route, with a wrong key | 413 |
| `GET /api/internal/stats` with the key | 200 |

**A script fault, corrected:** the keyed 1 MB check in snap3-deploy.sh did not run. Its header file had already been removed earlier in the script, so curl printed "error encountered when reading a file". The check's condition accepted the empty result. The control plane reran that check correctly in a separate read-only script, `snap3-keycheck.sh`, which builds its own header file (mode 600, removed on exit) and requires a 3-digit code. The last three rows of the table come from that rerun. The deploy itself was not affected.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SNAP-03/`:

| File | SHA-256 |
|---|---|
| `snap3-deploy.sh` | `7034dafe5e0fa2f6f01aa6a6121146a9beb90d806e8c9d8a317d882b4d19f43f` |
| `snap3-deploy.out` | `731133bd6567eff0c680c74c731b7593e0e9ced4204a0aacd0647eb3ec03a503` |
| `snap3-keycheck.sh` | `566a74193d16f6c558379643d873e9db7c24c5c66c836bba3039bc779ff6664b` |
| `snap3-keycheck.out` | `bfd6c28d21ab54be8b30fa090c2ae0df4e703cb99e2d45e9f96e96dae42859c7` |

Every output was checked for key text, and none was found.

## Limits

- **No browser check.** Zip export and import are covered by unit tests, and no Keith step was required.
- **Still registered, not ready:** SNAPSHOT-NOTICE-01 and SNAPSHOT-LABEL-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged, and the one script fault was rerun correctly; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed. The script fault was fixed in this task by the rerun. Future deploy scripts will be generated from a corrected base, with the keyed check placed before the header file is removed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 7c2a401 with migration hash 9cfde25f, and runs are off.
