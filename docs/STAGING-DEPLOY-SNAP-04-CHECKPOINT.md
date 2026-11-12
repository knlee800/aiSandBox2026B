# STAGING-DEPLOY-SNAP-04 — Checkpoint

**Task:** STAGING-DEPLOY-SNAP-04 — Deploy the not-restored files notice and Keith checks it
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the SNAPSHOT-NOTICE-01 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 91149ed |
| 2. Deploy, host checks and Keith's live check | snap4-deploy.sh from the staging host; Keith in the browser; read-only host checks | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (snap4-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T01:53:59Z UTC)

7c2a401 → 91149ed. It carries SNAPSHOT-NOTICE-01.

**Before:**
- HEAD and DEPLOYED were at 7c2a401.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 91149ed.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- The standard checks pass, and so do the earlier security checks.
- **New code in the builds:**
  - the frontend test id `workspace-restore-failed-notice` (4 files);
  - `failedPaths` in the gateway's `projects.service.js` (7 lines).
- **Body limits:** the keyed checks now run before the header file is removed, which fixes the STAGING-DEPLOY-SNAP-03 fault.

| Request to the file write route | Result |
|---|---|
| 1 MB with the key (an unknown session) | 404 |
| 1 MB with a wrong key | 413 |
| 1 MB without the key | 413 |
| A small body without the key | 403 |

- There is no key text in the journals, and no runs were open.

## Keith's live check (CL2 test project `c46cddc0…`, 2026-11-12 UTC)

| Step | Result |
|---|---|
| A 13 MB file, with one command: `head -c 13000000 /dev/urandom > big.bin` | 13000000 bytes |
| Save a version | The first save went to a **save point** "big test" (`a4cdc1006a99`), not a version. On the second try he used the Project History **Save**, and the version "big test" (`5dd5abd4`, 02:03:27) was stored with `big.bin` as base64, 13000000 bytes. |
| Stop and reopen | **Passed.** The amber notice named `big.bin`. A 13 MB file is about 17.3 MB as base64, which is over the 16 MB write limit. |
| Dismiss, then a manual restore of "big test" | **Passed.** The notice went away, then came back naming `big.bin`. |
| Restore "snap fix" | **Passed.** No notice. |
| Clean up | He removed `big.bin` and saved the version "clean" (`d0f5a380`, 02:12:46), which has 3 files and no `big.bin`. It is now the newest version, so a reopen shows no notice. |

**Seen on the host after the check:**
- Session `17579e6d` has HEAD `a4cdc100…`, 2 commits, 2 checkpoint refs ("d2 test" and "big test"), and a 70-byte PNG.
- The history bundle is now 13,004,995 bytes, because the accidental "big test" save point committed `big.bin`. It saved and restored without error. There is no bundle size limit in the container-manager.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SNAP-04/`:

| File | SHA-256 |
|---|---|
| `snap4-deploy.sh` | `fa97873ab2044b4e1dc43adfefe5cb55dca04aee97b0f47ebfa6ea284296808d` |
| `snap4-deploy.out` | `74eb5d66a2402e477a2449de53aee0bfa5e8638f6ec2df45461c835498e19f28` |
| `snap4-store.sh` (read-only, sizes and hash prefixes only) | `f695ce577fc3456aeb30787480be914605e3e5c5bc19361ab0392890d4579fe1` |
| `snap4-store.out`, `snap4-store2.out`, `snap4-store3.out` | `e70892503c1ee5113b41cf0a0be7c03118e170e8299f447f3158b03027473d5d`, `f3a3edbf4768a4f9bdabb3723b49727f3856a5eb22e5a4b8c198a964b84fb6cb`, `2df11b16f792c12e8cf214510beca1493b7a6a5ae739fa1b367227bbc2a07495` |
| `snap4-why.sh` / `.out` (read-only) | `d7a4ed5c2236a6ce31447ea082f817d4f667aa9c9a7ecaaffeff0a7154b23cb3` / `ab7b0b71d4e47ace2fcd87b7d667ba14c9c5333f93cd3e7e795883a9b7643214` |
| `snap4-bundle.sh` / `.out` (read-only) | `4a59174d5c9554a3ecbdd60d3a2fb2a0c770fa35b88dc898d0ec7adc598f8122` / `574ab108eeff3488e7815f5d4ec85e791fdde9bb648a7e09e6aa997b65fde8dd` |
| `snap4-reopen.sh` / `.out` (read-only) | `28ac4ead2413e095abbdb4c97f319341c019f9d71da378e3ec958ddf8a452cd6` / `c3cfdda530fd437b8f4816947f930f757512d4003eb61bd8ec239244f5b81e59` |

Every output was checked for key text, and none was found.

## Limits

- **The test data stays.** The "big test" version (about 17 MB in the store) and the "big test" save point (`big.bin` in the git history, a 13 MB bundle) remain in the CL2 test project. The workspace's HEAD tree still contains `big.bin`, while the working files do not. It is a test project, and nothing depends on it.
- **The two save buttons look alike.** Keith first used the Save Point button instead of the Project History Save. The two look similar, and his first try went to the wrong one. This is UI wording; no follow-up is registered, because the existing labels are per the PRD.
- **Still registered, not ready:** SNAPSHOT-LABEL-01, SNAPSHOT-NOTICE-02 and PAGE-STATUS-I18N-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text), UI 9/9 for SNAPSHOT-NOTICE-01 (9: Keith's live check passed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 91149ed with migration hash 9cfde25f, and runs are off.
