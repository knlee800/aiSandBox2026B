# STAGING-DEPLOY-SNAP-01 — Checkpoint

**Task:** STAGING-DEPLOY-SNAP-01 — Deploy binary-safe snapshots and the 16 MB limit, then Keith's reopen check
**Status:** COMPLETE AND LOCKED — 2026-11-11. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the SNAPSHOT-BINARY-01 LOCK. Keith approved on 2026-11-11 ("Yes, fix then deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 7399830 |
| 2. Deploy, host checks and Keith's reopen check | snap-deploy.sh from the staging host; Keith in the browser; read-only host checks | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (snap-deploy.sh; aisandbox-deploy rc 0 at 2026-11-11T15:37:38Z UTC)

7ac9084 → 7399830. It carries SNAPSHOT-BINARY-01 (binary-safe snapshots, history always restored) and SNAPSHOT-SIZE-01 (16 MB JSON limit in container-manager).

**Before:**
- HEAD and DEPLOYED were at 7ac9084.
- `INTERNAL_SERVICE_KEY` matched across the three env files, compared by hash.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 7399830.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f. Migrations 1806 and 1807 are still present.
- The configuration files and flags are unchanged, and all 8 units are active.
- The standard checks pass, and so do the earlier route, CORS, session-id and guard checks.
- **New code in the builds:**
  - gateway: `isStorableAsText`, `failedPaths`, `writeSnapshotFile`;
  - container-manager: `decodeStrictBase64` and the stdin `cat > "$FILE"` write; no old `printf "%s" "$CONTENT"` write is left; `'16mb'` in `app-setup.js`.
- A 1 MB JSON body without the key gets **403, not 413**: the larger limit is in force, and the guard still answers.
- There is no key text in the journals, and no runs were open.
- **Harmless lines:** the `curl: (7) Failed to connect` lines come from the health wait while the services restart.

## Keith's reopen check (CL2 test project `c46cddc0…`, 2026-11-11 UTC)

| Check | Result |
|---|---|
| **Reopen with an image in the project** (session `b951696d…`, 16:37:49) | **Passed.** The project opened without an error; before the fix it gave **Internal server error**. The snapshot fd3196db was restored, including `red.png`, and the history restore ran. |
| **Save point restored** | **Passed.** The container's HEAD is `ebd7e4fd…`, with 1 checkpoint ref and latest subject "d2 test". Keith saw **d2 test** in the History save-point list. The Project History box above it lists saved versions, not save points. |
| **Old snapshot image** | **As expected.** fd3196db was saved at 14:31:59, before the fix, by the old text read. It stores `red.png` as 92 bytes of text with no encoding marker; the first bytes are `ef bf bd 50 4e 47`, a replacement character in place of 0x89. It restores as stored. Nothing can repair it, so Keith rewrote the image. |
| **Save a new version with an image** | **Passed.** Keith rewrote `red.png` (70 bytes) and saved the version "snap fix" (`5ceb7ae2…`, 16:49:06). In the store, `red.png` has `encoding: base64`, decodes to 70 bytes, and its SHA-256 `bc09c259…` matches the source image. The text files are stored as text, as before. |
| **Stop, reopen and Preview** (session `72d14c60…`, 16:50:38) | **Passed.** Keith saw the red square in **Preview**. In the container, `red.png` is 70 bytes with the PNG header `89 50 4e 47 0d 0a 1a 0a`, HEAD is `ebd7e4fd…` and the latest subject is "d2 test". |

At 16:50:37 the reopen first tried the stopped session `b951696d…`. The container-manager answered 410 (`container_lost`), and the page opened a fresh session. This is the SESSION-STALE-01 path. Keith saw no error.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SNAP-01/`:

| File | SHA-256 |
|---|---|
| `snap-deploy.sh` | `25dd6008c11404dc1abecf9b35ec3dc4494bf34e2a617bec21b51ec3ca3478f8` |
| `snap-deploy.out` | `5715c9f6feefd53af5da1a863d14c3b92cd11e9323da7bc16a2570cd5c31eb38` |
| `snap-reopen.sh` (read-only; it was run twice) | `28ac4ead2413e095abbdb4c97f319341c019f9d71da378e3ec958ddf8a452cd6` |
| `snap-reopen.out` (after the first reopen) | `c4cd342ea2944a25bc70f33ee1bae9d291c0f0a4b1195ce38d336f53eb462e0d` |
| `snap-reopen2.out` (after the second reopen) | `205d2d973abd766609c0a8b0272a3531b7d185ea8aee1b13f444d6f2b4b53158` |
| `snap-store2.sh` (read-only; prints sizes and hash prefixes, never content) | `f695ce577fc3456aeb30787480be914605e3e5c5bc19361ab0392890d4579fe1` |
| `snap-store2.out` | `e70892503c1ee5113b41cf0a0be7c03118e170e8299f447f3158b03027473d5d` |

Every output was checked for key text, and none was found. The `snap-reopen2.sh` file in the folder is a byte-identical copy of `snap-reopen.sh`; its edit did not apply.

## Limits

- **Images in snapshots saved before the fix stay damaged.** They were stored as replacement text and restore as stored. The user has to add the image again and save. No code can recover them.
- **Still registered and not ready:**
  - SNAPSHOT-PICK-01: which snapshot a reopen picks;
  - SNAPSHOT-NOTICE-01: telling the user which files were not restored;
  - ARCHIVE-BINARY-01: binary-safe zip export and import;
  - CM-BODY-ROUTE-01: the 16 MB limit on the one route only.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed. The damaged pre-fix image is a limit with no possible fix, not a follow-up.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 7399830 with migration hash 9cfde25f, and runs are off.
