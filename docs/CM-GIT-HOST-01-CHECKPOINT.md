# CM-GIT-HOST-01 — Checkpoint

**Task:** CM-GIT-HOST-01 — Host-side git runs in the sandbox-writable workspace
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY (security). **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CM-SYMLINK-01 LOCK. Admitted 2026-11-10 (b558c75) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with CONTAINER-MANAGER | b558c75 |
| 2. Implementation | opus subagent (Opus 5.5: a security fix removing host-side command paths) in worktree lane/CM-GIT-HOST-01, fast-forwarded onto main | 183d71b |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

Every host-side git and shell path in container-manager was uncalled. All of them are removed:

| Call | Ran | Callers | Now |
|---|---|---|---|
| `GitService.initializeGit` (simple-git init, add, commit) | host, in the bind-mounted workspace | `POST /api/git/:id/init`, called only by the create self-call | removed, with its route |
| `GitService.getHistory` (simple-git log) | host | `GET /api/git/:id/history`, no caller | removed, with its route |
| `SessionsService.createSession` and its self-call | host | `POST /api/sessions` on container-manager, no caller (the gateway calls only `/start`, `/stop` and `DELETE /:id`) | removed, with its route |
| `restoreWorkspaceFromProject` (host `tar -xf`) | host | createSession only | removed |
| `ProjectsService` (host `tar -cf` snapshots) | host | createSession only | removed, with ProjectsModule |
| GitService commit, revert, diff, worktree diff, checkpoint creation, history bundle save and restore | **container**, through docker exec in `/workspace` | the gateway | unchanged |
| DockerRuntimeService file exec, BrowserSmokeService | container | the gateway | unchanged |

No production file in container-manager/src imports simple-git or child_process any more; the remaining mentions are explanatory comments. Real sessions start through the gateway's `/api/sessions/:id/start`, which never called the host-side init. The container-side commit path already runs `ensureGitInitializedInContainer`.

**Checkpoint and revert flow:** unchanged. All existing GitService tests pass unchanged. New tests drive each checkpoint path through the real GitService with child_process mocked, and assert that every git call is a docker exec in `/workspace`.

**Tests: 574 → 571.**
- **Removed (18):** the git-init self-call spec (3); the guard tests for the 3 removed routes (9); the session-id pipe tests for the 2 removed session-id routes (6).
- **Added (15):**
  - 4 removed-route 404 tests with the key;
  - a test that no git init, history or bare session-create route remains;
  - `no-host-git.spec.ts`, with 5 source checks (no simple-git, no child_process, the removed methods and the projects module gone, and a real-tree sanity check) and 5 checks that each checkpoint path runs only in the container.
- **Mutation check:** with a host simple-git call put back, the source check and the commit test both failed.

The inventory is now 49 routes (48 guarded, plus `GET /api/health`), with 28 session-id routes.

Files:
- **Deleted:** `projects/projects.service.ts`, `projects/projects.module.ts`, `sessions/dto/session.dto.ts`, `sessions/sessions.service.git-init.spec.ts`.
- **Added:** `__tests__/no-host-git.spec.ts`.
- **Modified:** `git/git.service.ts`, `git/git.controller.ts`, `sessions/sessions.service.ts`, `sessions/sessions.controller.ts`, `sessions/sessions.module.ts`, the two sessions specs (constructor arity), and the HTTP inventory spec.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| container-manager `npm test` | 18 suites, 571 passed, 0 failed |
| container-manager `npm run build` | exit 0 |
| simple-git or child_process in production source | comments only (git.controller.ts:7, git.service.ts:97, sessions.service.ts:96) |
| line endings | the added and changed files are LF |

## Limits

- **Not deployed.** STAGING-DEPLOY-CMSEC-01, registered here, carries CM-PATH-01, CM-SYMLINK-01 and this task.
- **No live smoke** of checkpoints (evidence class LOCAL-TESTS). The checkpoint code is unchanged, and tests pin that it runs in the container.

CHECKLIST: EVERY 11/11, FLOWS 5/5 (5: the checkpoint and revert code is unchanged, with tests added; no live smoke at LOCAL-TESTS), BACKEND 6/6 (1: the guard, the key and 401/403 unchanged, only routes removed; 4: no frozen contract; 5: n/a; 6: no new failures)

FOLLOWUPS: 2 registered / 2 superseded / 0 dropped / 0 undisposed.

**Registered:**
- **CM-HISTORY-LINK-01, NOT_READY (security, reachable from a user flow).** Checkpoint history copies files on the host through the sandbox-writable workspace with `fs.copyFile`, which follows symlinks:
  - `restoreProjectHistory` (git.service.ts:583) copies the stored bundle to `<workspace>/.aisb-history-restore.bundle`, so a pre-planted symlink can overwrite a host file;
  - `saveProjectHistory` (:551) copies `<workspace>/.git/aisb-history.bundle` out, so a symlink swapped in after `git bundle create` reads a host file into history, and a later restore hands it to the sandbox.

  The gateway calls both, through checkpoint-history save and restore, so a sandbox owner could reach them. Fix: refuse symlinks with `lstat`, open with no-follow, or stream the bundle through docker exec, with tests. FLOWS applies.
- **STAGING-DEPLOY-CMSEC-01, NOT_READY (Keith approves).** Deploy CM-PATH-01, CM-SYMLINK-01 and CM-GIT-HOST-01. Host checks:
  - `POST /api/sessions`, `POST /api/git/:id/init`, `GET /api/git/:id/history` and the six `/api/files` routes answer 404 with the key;
  - a `%2E%2E` session id answers 400 with the key;
  - the standard and earlier checks pass.

**Superseded, into CM-DEPS-01:**
- the now-unused `simple-git` dependency;
- the unused `HttpService` injection in GitService.

Recorded, not a follow-up: the `sessions` table keeps its `git_initialized` and `project_id` columns. Container-manager no longer creates projects; its checkpoint history still writes under `projects/_checkpoint-history`.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY, and CONTAINER-MANAGER is released UNOWNED.
