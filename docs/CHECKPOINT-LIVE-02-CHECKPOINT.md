# CHECKPOINT-LIVE-02 — Checkpoint

**Task:** CHECKPOINT-LIVE-02 — Keith's checkpoint restore smoke through the container stdin
**Status:** COMPLETE AND LOCKED — 2026-11-11. Result: **partial**. The three new paths passed. Reopening the project in the browser failed on an older defect in the snapshot path, which is registered as SNAPSHOT-BINARY-01.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-EXEC-01 LOCK, and widened by the CM-BINARY-01 and CM-UNTRACKED-DASH-01 LOCKs. Keith admitted it on 2026-11-11 ("Yes, start it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING (read-only host checks); stagingAuthorized true | 0598094 |
| 2. Keith's browser steps and host reads | the `cl2-*` scripts and outputs | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## What happened (staging 7ac9084, runs off, no AI)

Keith's steps, in a new empty project, **CL2 test** (`c46cddc0…`):
1. He opened the project, and session `5c76e4fb…` started at 14:27:19 UTC on `node:24-alpine`.
2. He ran one guarded command from Advanced → Command Input. It created `red.png` (a 70-byte PNG), `index.html` and `cl2-untracked.txt`.
3. **Preview** showed the heading and the red square.
4. He made a **Save Point**, "d2 test".
5. He ran a second command that added `cl2-untracked-2.txt`.
6. He clicked Stop, then opened the project again. The new session `94af909d…` started at 14:35:41, and the page showed **Internal server error**.

| Check | Result |
|---|---|
| **Binary preview** (CM-BINARY-01) | **Passed.** The static preview served `red.png` (served by `npx serve`), and Keith saw the red square. In the container, `red.png` has SHA-256 `bc09c259…`, identical to the source image. |
| **Save** (raw slices through the binary exec) | **Passed.** The checkpoint row "d2 test" (`ebd7e4fd568e`, 3 files) was recorded at 14:32:41. The bundle `_checkpoint-history/c46cddc0….bundle` was written at 14:32:43: 716 bytes, mode 640, header `# v2 git bundle`, with 1 checkpoint ref. No `aisb-history.bundle` was left in `.git`. |
| **Untracked file in the working-tree diff** (CM-UNTRACKED-DASH-01, Alpine image, busybox `sh`) | **Passed.** The container-manager worktree-diff route against HEAD `ebd7e4fd…` returned a `new file mode 100644` diff for `cl2-untracked-2.txt` with content `two` and `truncated:false`. |
| **Reopen in the browser** | **Failed.** The reopen restored the user's snapshot, and the container-manager refused to write `red.png` five times (14:35:43 to 14:36:37): "Failed to write file: red.png", HTTP 500. `index.html` and `cl2-untracked.txt` were written. Because the snapshot restore threw, the history restore never ran: the container had no git. |
| **History restore through the container's stdin** (CM-EXEC-01) | **Passed, host-driven.** The control plane called the same internal route the reopen calls (`POST /api/internal/checkpoint-history/94af909d…/restore`, project `c46cddc0…`) and got `{"status":"restored","head":"ebd7e4fd…"}`, HTTP 200. The container then showed HEAD `ebd7e4fd…`, 1 commit, 1 checkpoint ref and latest subject "d2 test". No restore bundle was left in the container or on the host, and the restore wrote no journal errors. |

## Finding: SNAPSHOT-BINARY-01

The workspace snapshot path is text-only. This is older code that CM-BINARY-01 did not touch:
- **Save:** `SnapshotPersistenceService.collectWorkspaceFiles` reads each file through the text file-read route.
- **Restore:** it writes each file through `writeSessionFile`. The container-manager's `writeFileToContainer` passes the content in an environment variable to `printf`, which cannot carry NUL bytes. So `red.png` fails, and the whole reopen fails with a 500 before `restoreCheckpointHistory` runs.

As a result, any project with an image or font cannot be reopened, and its checkpoint history is not restored. This is registered as **SNAPSHOT-BINARY-01** (GATEWAY and CONTAINER-MANAGER). Keith's browser reopen check moves to its acceptance.

A second point turned up while reading that code. `ProjectsService.openProjectIntoSession` falls back to the user's newest snapshot of any project when no snapshot id is sent. The frontend sends one only when the user picked a snapshot. So reopening project B can restore project A's newest snapshot. This is registered as **SNAPSHOT-PICK-01** (confirm first, then fix).

Keith's CL2 test project cannot be reopened until SNAPSHOT-BINARY-01 is deployed. It is a test project only.

## Not exercised

- **The browser sandbox image.** No gateway or frontend path sets `browserCapable`, so a user cannot start a session on `aisandbox-workspace-browser:local`. The CM-UNTRACKED-DASH-01 tests run the script under real dash and bash.
- **A history bundle over 8 MiB.** This was optional in the scope, and a unit test covers it.
- **The `./` prefix in untracked diff paths** (`a/./cl2-untracked-2.txt`). This is existing behaviour, the same before CM-UNTRACKED-DASH-01, and it keeps names that start with `-` safe. It is not a follow-up.

Evidence in `C:/Users/knlee/aisb-preflight/CHECKPOINT-LIVE-02/`:

| File | SHA-256 |
|---|---|
| `cl2-evidence.sh` (read-only) | `6489d5942220c3cacc9a056ff42ecbae9001f71f2a530d5fb133a47b92e936ad` |
| `cl2-diff.sh` (read-only) | `6e923e1bba887855241101cd0157e0292ec9b2ca9ca093b36de12e6d2912702c` |
| `cl2-logs.sh` (read-only) | `1732ad0321b4374b88607d5158b0c6e64e37eed19d41b37990c24dc11ff945ae` |
| `cl2-restore.sh` (calls the product's restore route for Keith's test session only) | `70fbd39b767085768e25908491c8a430b6a23b72b90a917bdd75b9faaa76113d` |
| `cl2-ev1.out` to `cl2-ev4.out`, `cl2-diff.out`, `cl2-logs1.out`, `cl2-restore.out` | outputs; checked for key text, none found |

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING held; 2: no configuration change; 3 and 7: n/a, tester window closed; 4: no deploy; the only host write was the product's own restore route on Keith's test session; 5: from the host; 6: outputs checked for key text), FLOWS 5/5 (5: the live smoke this task exists for; the reopen failure is recorded and registered, not hidden)
FOLLOWUPS: 2 registered / 0 superseded / 0 dropped / 0 undisposed.
- **SNAPSHOT-BINARY-01:** binary-safe snapshot save and restore; a failed snapshot file must not block the history restore. Keith's browser reopen of a project with an image is in its acceptance.
- **SNAPSHOT-PICK-01:** reopen restores only a snapshot of the same project.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED, with stagingAuthorized false;
- staging runs 7ac9084, and runs are off.
