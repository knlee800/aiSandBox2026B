# CM-UNTRACKED-DASH-01 — Checkpoint

**Task:** CM-UNTRACKED-DASH-01 — Untracked files in the working-tree diff under dash
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-DIFF-CAP-01 LOCK. Admitted under Keith's instruction to keep starting the next task.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered at the CM-DIFF-CAP-01 LOCK (296e5d4); admitted to Lane 2 with CONTAINER-MANAGER | b4c71c7 |
| 2. Implementation | opus subagent (Opus 5.5: a shell script run through container exec) in worktree lane/CM-UNTRACKED-DASH-01, cherry-picked onto main | a443762 |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Change

**The bug.** The worker reproduced it under real dash: the old script printed `read: Illegal option -d`, exited 0 and returned empty output. So in browser-image sessions, untracked files never appeared in the working-tree diff, and no error was shown.

**The fix.** `WORKTREE_UNTRACKED_DIFF_SCRIPT` is rewritten for POSIX sh, so it no longer uses pipefail, `read -d`, arrays or `[[ ]]`.
- The listing runs as `git ls-files --others --exclude-standard -z | xargs -0 sh -c "$each" sh "$DIFF_BUDGET" "$out" "$tmp"`, with `set -f`. The shell never parses the listing: each path reaches the batch script as one argv item and is used only as a quoted `"./$path"` after `--`. This is correct for every byte except NUL, which git paths can't contain.
- A check at module load refuses a batch script that contains a single quote.
- The budget across xargs batches lives in one `$out` file that each batch measures with `wc -c`.
- git's exit status comes out through fd 3, as in `boundedDiffCommand`.
- The output format, `DIFF_BUDGET`, the per-file `head -c`, the accepted statuses `0|1|141` and the non-fatal handling are unchanged.
- One deliberate difference: a listing or xargs failure after the pre-check now exits 1, which keeps only the tracked diff. Before, it exited 0 with partial output.

**Checked against the old script.** Output is byte-identical to the old script under bash for:
- awkward names: spaces, `'`, a leading `-`, `$( )`, newline, CR, tab, backslash, backticks, `*`, `%s` and invalid UTF-8;
- budget cuts;
- multiple xargs batches;
- a failing path, which is skipped.

No injected command ran.

**Files (3):** git.service.ts, git.service.spec.ts (12 new tests, including real-shell runs under dash and bash, with busybox skipped when it's missing), `__tests__/no-host-git.spec.ts`. One existing assertion changed: it pinned the removed bash-only `read -d` line, and now pins the `xargs -0` and `for path in "$@"` form.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| container-manager `npm test` | 20 suites; 731 passed (719 + 12), 3 skipped (2 Windows symlink tests, 1 "busybox sh is not installed here"), 0 failed; on the branch and on main |
| container-manager `npm run build` | exit 0, on the branch and on main |
| other code | `git diff --stat b4c71c79..lane/CM-UNTRACKED-DASH-01` over the gateway, ai-service, frontend and container-manager docker, sessions and preview folders: empty |
| line endings | the 3 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed; it rides STAGING-DEPLOY-FD-02.
- Not run inside the real sandbox images: node:24-alpine (busybox ash and busybox `xargs -0`) and the node:20-slim browser image (dash with GNU xargs). If xargs lacked `-0`, the script would exit 1 and the diff would keep only the tracked part. That's fail-safe.
- On Windows, the real-shell tests add about 40 seconds to the suite.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (4: no frozen contract; exec arguments and output format unchanged; 5: no schema change)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The check inside both sandbox images that untracked files show in the working-tree diff is superseded into CHECKPOINT-LIVE-02; a line was added to its body.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 2 released EMPTY; CONTAINER-MANAGER released UNOWNED.
