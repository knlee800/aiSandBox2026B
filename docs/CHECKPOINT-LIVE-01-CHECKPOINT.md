# CHECKPOINT-LIVE-01 — Checkpoint

**Task:** CHECKPOINT-LIVE-01 — Keith checkpoint save and restore smoke on staging
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the STAGING-DEPLOY-CMSEC-01 LOCK. This is the FLOWS 5 live smoke for CM-HISTORY-LINK-01. Keith started it on 2026-11-10 ("i will do it now").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING (read-only host checks); stagingAuthorized true | (admission record) |
| 2. Keith's browser steps and host reads | cpl-save.out, cpl-restore.out, cpl-check.sh, cpl-refs.sh | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## What happened (staging f423859, runs off)

**Keith's steps (browser):**
1. He opened a project in the workspace (`e0afb191…`, session started 13:37:55 UTC).
2. He edited a file and saved it.
3. He created a save point, "smoke test", which appeared in the checkpoint list.
4. He stopped the session (13:43:20) and opened the project again. A new session started at 13:43:26, and **"smoke test" was still in the checkpoint list**.

**Host checks (read-only; any git ran inside the container, never on the host):**

| Check | Result |
|---|---|
| The checkpoint row | "smoke test" recorded 13:40:33 |
| **Save** (CM-HISTORY-LINK-01, streamed out of the container) | `projects/_checkpoint-history/e0afb191….bundle` written 13:40:35, 12,739 bytes, mode 640, header `# v2 git bundle`, `git bundle list-heads` lists `refs/checkpoints/*` |
| Leftover `aisb-history.bundle` in any `.git` | 0 |
| **Restore** (exclusive no-follow staging), in the new session's container | 28 checkpoint refs, 27 commits on HEAD, latest commit "smoke test", "smoke test" found in history |
| Leftover `.aisb-history-restore.bundle` (host search and in `/workspace`) | 0 |
| Gateway and container-manager log lines about history since 13:30 | none (no errors) |

**Not exercised:**
- A bundle over 8 MiB, which needs several slices. That is covered by a unit test (16 MiB + 5 bytes in 3 slices).
- The negative check with a planted link. That is covered by the Linux-only real-symlink tests and the real-file tests.

Evidence in `C:/Users/knlee/aisb-preflight/CHECKPOINT-LIVE-01/`:

| File | SHA-256 |
|---|---|
| `cpl-check.sh` | `cc4b38d3acefa4c3bc74681a5a3ba9fb5bc766f8cc1da40621109309e20cb471` |
| `cpl-refs.sh` | `be5522f3383d05c22897f8516c864b32b30215817952278edd81d3871ef0e178` |
| `cpl-save.out`, `cpl-restore.out`, `cpl-check.out`, `cpl-refs.out` | outputs (no key text) |

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING held for read-only checks; 2: no configuration change; 3 and 7: n/a, tester window closed; 4: no deploy, nothing changed; 5: from the host; 6: outputs checked for key text), FLOWS 5/5 (5: the live smoke this task exists for)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED (stagingAuthorized false); staging runs f423859 with runs off.
