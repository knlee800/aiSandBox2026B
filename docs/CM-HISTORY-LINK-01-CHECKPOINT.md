# CM-HISTORY-LINK-01 — Checkpoint

**Task:** CM-HISTORY-LINK-01 — Checkpoint history copies follow symlinks in the workspace
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY (security, reachable from a user flow). **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CM-GIT-HOST-01 LOCK. Admitted 2026-11-10 (106db30) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with CONTAINER-MANAGER, write set services/container-manager/src/git/ | 106db30 |
| 2. Implementation | opus subagent (Opus 5.5: a security fix in the user-reachable checkpoint-history path) in worktree lane/CM-HISTORY-LINK-01, fast-forwarded onto main | a8d3ac9 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

Checkpoint-history save and restore (`GitService.saveProjectHistory` and `restoreProjectHistory`) used to copy bundles with host-side `fs.copyFile` through the sandbox-writable, bind-mounted workspace. That followed symlinks. The gateway calls both through checkpoint-history save and restore.

**Save is streamed through docker exec.** The host never opens a workspace path.
- One exec (`[ -f B ] && [ ! -L B ] && wc -c < B`) gets the size. A link or anything other than a regular file is refused inside the container.
- Further execs (`dd … | base64`) read 8 MiB slices. Each slice is strictly decoded and must have exactly the expected length, otherwise the save fails with "History bundle changed while it was read".
- On the host, the bytes go to a temp file created with `O_CREAT|O_EXCL` in the history directory. The same `stat`, the same `rename` to `historyBundlePath` and the same cleanup follow.
- Memory stays bounded.
- No-follow alone would not do here: the sandbox controls `.git`, and could swap the whole folder for a link.

**Restore uses exclusive, no-follow host I/O.** The current exec helpers have no stdin, so a streamed write was not possible inside the write set.
- It unlinks any entry at `<workspace>/.aisb-history-restore.bundle`. Unlink removes a link, never its target, and a directory is refused.
- It then creates the file with `O_WRONLY|O_CREAT|O_EXCL` (plus `O_NOFOLLOW` where Node defines it) and copies the stored bundle in 1 MiB reads.
- `O_CREAT|O_EXCL` never follows a link and fails on any existing entry. So a link planted after the unlink fails the restore and cannot redirect the write.
- The parent is the bind-mount root, which the sandbox cannot replace.

**Unchanged:**
- the stored path (`projects/_checkpoint-history/<projectId>.bundle`) and the stored bytes;
- the id checks, the skipped and none results and the error messages;
- the restore steps (list-heads, fetch, symbolic-ref or update-ref, reset) and both cleanups;
- commit, revert, diff and the file-action code.

**Remaining gaps:**
- A sandbox can fail its own save or restore, or change its own bundle. Both only affect its own data.
- A save now takes 2 + ceil(size / 8 MiB) execs.
- On restore the host still writes one freshly created file into the workspace. A stdin exec helper would remove that (registered below).

**Tests:** +15 passed and 3 skipped on Windows, for 19 suites, 586 passed and 3 skipped.
- **`git.service.spec.ts`:** the existing save and restore tests now assert the new calls in place of `copyFile`, and the no-op cases gain "nothing opened". 10 new tests cover:
  - the container commands, with the `-L` refusal and the 1 MiB block size;
  - that save never touches a workspace path;
  - a 16 MiB + 5 byte bundle read in 3 slices, every byte kept;
  - a refused size probe;
  - short, long and non-base64 slices refused, with cleanup;
  - EEXIST and EISDIR on restore;
  - the stored path unchanged.
- **`git.service.history-links.spec.ts`** (new, real temporary directories and real `fs`). 5 passed:
  - a 3 MiB binary round trip;
  - save refuses `.git` swapped for a directory link to a host folder;
  - restore fails on a racing entry;
  - restore refuses a directory;
  - restore replaces a stale file.

  3 tests that need file symlinks are skipped on this Windows machine (EPERM without Developer Mode). They run on Linux: a save through a planted link, a restore through a planted link, and a link appearing after the unlink.
- **`no-host-git.spec.ts`:** fixture changes only; no assertion changed.
- **Mutation check:** with the old `copyFile` put back on both paths, 13 tests failed. They include the real-file tests in which the old code read the "secret" through the directory link.

Files: `services/container-manager/src/git/git.service.ts`, `git.service.spec.ts`, `git.service.history-links.spec.ts` (new), `src/__tests__/no-host-git.spec.ts` (fixture).

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| container-manager `npm test` | 19 suites, 586 passed, 3 skipped (Windows file-symlink privilege), 0 failed |
| container-manager `npm run build` | exit 0 |
| `copyFile` in git.service.ts | none |
| line endings | the 4 files are LF in this checkout |

## Limits

Not deployed. The checkpoint live smoke (FLOWS 5) and the three Linux-only symlink tests' real-world equivalent belong to the deploy, STAGING-DEPLOY-CMSEC-01:
1. A checkpoint in a real session stores `projects/_checkpoint-history/<projectId>.bundle`, `git bundle verify` passes, and no `aisb-history.bundle` is left in `.git`.
2. Reopening the project in a new session restores the same HEAD and checkpoint list, and no `.aisb-history-restore.bundle` is left.
3. A bundle over 8 MiB still saves and restores.
4. Optional: a link planted at the restore path leaves its target unchanged.

CHECKLIST: EVERY 11/11, FLOWS 5/5 (1-4: same stored path, bytes, results and messages, revert, commit and file actions untouched; 5: tests added, the live smoke moved to the deploy), BACKEND 6/6 (1-2: no guard, key or route change; 3: templates untouched; 4: no frozen contract; 5: n/a; 6: no new failures)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Registered: CM-EXEC-01, NOT_READY.** The container exec helper (`execInContainerBySessionId`) needs three things:
  - a cap on collected stdout, since today a huge output can throw "Invalid string length" and crash container-manager;
  - binary-safe stdout, since today it decodes as UTF-8, which corrupts binary reads through `readFileFromContainer`;
  - a stdin variant, so restore can pipe the bundle into the container and the host never writes into the workspace.
- **Superseded:** the checkpoint live smoke, by acceptance lines in STAGING-DEPLOY-CMSEC-01.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY, and CONTAINER-MANAGER is released UNOWNED.
