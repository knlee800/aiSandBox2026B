# STAGING-DEPLOY-SNAP-05 — Checkpoint

**Task:** STAGING-DEPLOY-SNAP-05 — Deploy the session-scoped notice, the translated page messages and the label tests, then Keith checks the notice
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the SNAPSHOT-NOTICE-02 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 01df4a7 |
| 2. Deploy, host checks and Keith's live check | snap5-deploy.sh from the staging host; Keith in the browser | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (snap5-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T03:07:48Z UTC)

91149ed → 01df4a7. It carries three tasks:
- SNAPSHOT-NOTICE-02: the notice is tied to its session;
- PAGE-STATUS-I18N-01: the page's status messages in three languages;
- SNAPSHOT-LABEL-01: tests only.

**Before:**
- HEAD and DEPLOYED were at 91149ed.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 01df4a7.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- The standard checks pass, and so do the earlier security checks.
- **Body limits:**

| Request to the file write route | Result |
|---|---|
| 1 MB with the key (an unknown session) | 404 |
| 1 MB with a wrong key | 413 |
| 1 MB without the key | 413 |
| A small body without the key | 403 |

- **New code in the builds:**
  - the zh-TW 工作區快照已還原 and zh-CN 工作区快照已恢复 strings are in the frontend build (5 files each);
  - the notice test id and the gateway `failedPaths` are still present.
- There is no key text in the journals, and no runs were open.

## Keith's live check (CL2 test, 2026-11-12 UTC)

| Step | Result |
|---|---|
| A manual restore of the version "big test" | **Passed.** The notice reads "Some files could not be restored: big.bin. They may be too large. Add them again and save." |
| Open another project | **Passed.** The notice is gone. |
| Open CL2 test again; its newest version is "clean" | **Passed.** No notice. |

**What the check could not reach:** SNAPSHOT-NOTICE-02's own path, switching sessions without opening a project, has no control in the workspace today. The shell receives an `onSelectSession` handler but renders no session switcher. So the live check covered the restore and the project switch, and source tests cover the session-switch logic. This is recorded as an observation, not a follow-up: there is nothing to fix until a session switcher exists.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SNAP-05/`:

| File | SHA-256 |
|---|---|
| `snap5-deploy.sh` | `a7947fd3c248cae152e50c1bb6dfd326009a11aa31c6fdabdc2e8df8f9d806bf` |
| `snap5-deploy.out` | `a42d26806a0cf460687a7b607756bbff40ab58ec42984d3078b72eb1f77c9f25` |

The output was checked for key text, and none was found.

## Limits

- **Still registered, not ready:** PAGE-CHAT-I18N-01 and SNAPSHOT-LABEL-02.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text), UI 9/9 for SNAPSHOT-NOTICE-02 (9: the live check passed for the paths the UI offers)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 01df4a7 with migration hash 9cfde25f, and runs are off.
