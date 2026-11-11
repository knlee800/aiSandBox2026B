# CM-DIFF-CAP-01 — Checkpoint

**Task:** CM-DIFF-CAP-01 — Large diffs come back truncated, not failed
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-EXEC-01 LOCK. Admitted under Keith's instruction to keep starting the next task.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered at the CM-EXEC-01 LOCK (252ce1f); admitted to Lane 2 with CONTAINER-MANAGER | c68592e |
| 2. Implementation | opus subagent (Opus 5.5: commands run through container exec) in worktree lane/CM-DIFF-CAP-01, cherry-picked onto main | 22819cd |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Change

**`boundedDiffCommand`** passes git's stdout through `head -c <limit+1>` inside the container. git's own exit status comes out through a file descriptor, because dash (the `/bin/sh` of the Debian browser image) has no pipefail. The diff is read as bytes through `execInContainerBuffer`:
- More bytes than the limit means the diff was cut, whether git exited 0 or 141 (stopped by head).
- A 141 exit with short output, or any other non-zero exit, fails with the same errors as before.

**Commit diff (`getDiff`).**
- The limit is 8 MiB, half the 16 MiB exec cap. A cut diff keeps the first 8 MiB up to the last newline and gains optional `truncated: true` and `diffLimitBytes`.
- A diff under the limit comes back byte-identical, with no new field.
- `commitHash` must now be a full 40- or 64-character hex hash, or the call gets a 400 ("Invalid commit") before any exec. The parent hash must be full hex too.
- Both now reach git only as quoted environment variables. Before this, they were put straight into the shell command. The risk was low behind the internal-key guard, with the gateway sending only recorded checkpoint hashes, but it is now closed.

**Working-tree diff.** It is bounded at 1 MiB, which always decodes to more than its existing 65,536-character output cut, so its result is identical (tested). Its existing `truncated` field is unchanged.

**Files (3):** git.service.ts, git.service.spec.ts (17 new tests), `__tests__/no-host-git.spec.ts`. Existing tests changed only in mock setup, because the diffs now go through the binary exec. One expected command string changed; no assertion was weakened.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| container-manager `npm test` | 20 suites; 719 passed (702 + 17), 2 skipped (Windows symlink tests), 0 failed; on the branch and on main |
| container-manager `npm run build` | exit 0, on the branch and on main |
| other code | `git diff --stat c68592e4..lane/CM-DIFF-CAP-01` over the gateway, ai-service, frontend and container-manager docker, sessions and preview folders: empty |
| line endings | the 3 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed; it rides STAGING-DEPLOY-FD-02. The wrapper was tested with real dash, bash and git locally, not inside the Alpine or Debian sandbox images. The truncation marker is not shown anywhere yet: the gateway's checkpoint diff copies only commitHash, parentHash and files.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (1-2: guards unchanged, and the commit hash is now validated; 4: no frozen contract, only optional fields; 5: no schema change)

FOLLOWUPS: 2 registered / 0 superseded / 0 dropped / 0 undisposed.
- **CM-DIFF-NOTICE-01:** the gateway passes `truncated` and `diffLimitBytes` through, and the History diff view shows a translated "diff cut at N MB" notice.
- **CM-UNTRACKED-DASH-01:** `WORKTREE_UNTRACKED_DIFF_SCRIPT` uses `set -o pipefail` and `read -d ''`, which dash rejects. In browser-image sessions, untracked files are probably left out of the working-tree diff without any error. Make it POSIX-sh safe and test it under dash.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 2 released EMPTY; CONTAINER-MANAGER released UNOWNED. APPROVAL-SET-01B stays in Lane 1.
