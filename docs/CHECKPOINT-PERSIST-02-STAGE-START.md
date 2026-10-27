# CHECKPOINT-PERSIST-02 — Stage-start (Step 2)

**Task:** CHECKPOINT-PERSIST-02 — Keep checkpoint history across sessions of a project
**Date:** 2026-10-27. **Design approved by Keith:** option 1, a git history bundle per project kept by the container-manager.
**Source:** the CLEAN-BASELINE-DEPLOY-01 C1 check 9 failure; registration commits 7f76134f57eb34b53f223af661501dab41d75ca0 and c6b8c547cf68439aeee923bc53a7c13ede482871; dependency CHECKPOINT-PERSIST-01 COMPLETE AND LOCKED (repository commit 22cd8d585495b7cb225a7d0b0256c7308ba70c02).

## Problem, as found in the source

- A checkpoint is a git commit in the session's own workspace (`<workspaces root>/<sessionId>`, bind-mounted at `/workspace`); revert is `git reset --hard <commit>` in that container (`services/container-manager/src/git/git.service.ts`).
- Every checkpoint, including reverts and the initial commit, is recorded through `POST /api/internal/git-checkpoints` in the gateway ledger `git_checkpoints`, keyed by session. `CheckpointsService` lists rows for one session and refuses revert and diff for a checkpoint of another session.
- The gateway creates sessions itself, with `sessions.project_id`, and only asks the container-manager to start a container for a session id, so the container-manager does not know the gateway project.
- Project snapshots are text-only and exclude `.git` (PROJ-02-03); restoring one clears `/workspace`, `.git` included, and writes the files back. A new session of a project therefore has no git history, and a commit left behind by `reset --hard` is unreachable from any ref.

## Design (frozen)

1. **Checkpoint refs.** After each checkpoint commit, and for the revert checkpoint, the container-manager runs `git update-ref refs/checkpoints/<hash> <hash>` in the container before it records the checkpoint, so `git reset --hard` cannot make a checkpoint unreachable. A failure is logged and does not block the checkpoint.
2. **History store.** The container-manager keeps one bundle per gateway project at `<projects root>/_checkpoint-history/<projectId>.bundle`, where `<projects root>` is the existing container-manager projects root (`/opt/aisandbox/projects` on the clean-baseline host, inside the OPS-01 backup scope). `projectId` and `sessionId` must match the UUID format. Writes go to a temporary file in the same folder and are renamed into place.
3. **Save.** `POST /api/internal/checkpoint-history/:sessionId/save` with body `{ projectId }`: in the container, `git bundle create /workspace/.git/aisb-history.bundle --all`; the container-manager reads that file through the host workspace path, stores it, and removes it in the container. Response `{ status: 'saved', bytes }`, or `{ status: 'skipped' }` when the workspace has no repository or no commit.
4. **Restore.** `POST /api/internal/checkpoint-history/:sessionId/restore` with body `{ projectId }`: with no stored bundle, `{ status: 'none' }`. Otherwise the container-manager writes the bundle to `<workspace>/.aisb-history-restore.bundle`; in the container it makes sure git is installed and `/workspace` is a safe directory, initialises a repository if there is none, fetches `+refs/*:refs/*` from the bundle with `--update-head-ok`, points HEAD at the same branch and commit as the saved repository, runs `git reset -q` (index only; the restored files stay as they are), and deletes the temporary bundle. Response `{ status: 'restored', head }`.
5. **Both endpoints** are in a new `InternalCheckpointHistoryController` in the container-manager git module, behind the existing `InternalServiceAuthGuard`, and the gateway calls them with `X-Internal-Service-Key` through `ContainerManagerHttpClient`.
6. **Gateway, after each recorded checkpoint.** The internal ledger endpoint records the row as now; then, if the session has a project, it requests a save for that session and project without awaiting it, and logs any failure.
7. **Gateway, project open.** The session snapshot restore endpoint restores the files as now; then, if the session has a project, it awaits a history restore. A failure is logged and does not fail the open.
8. **Gateway, listing.** `CheckpointsService.listCheckpoints` returns the ledger rows of all sessions of the same project and the same user, newest first, when the session has a project; otherwise it is unchanged.
9. **Gateway, revert and diff.** A checkpoint is accepted when its session is the current session, or belongs to the same project and the same user. Everything else is unchanged.
10. **Failure behaviour.** History work never blocks a checkpoint, a revert or a project open; the worst case is today's behaviour.

## Internal contract frozen here

| Endpoint (container-manager) | Body | Responses |
|---|---|---|
| `POST /api/internal/checkpoint-history/:sessionId/save` | `{ projectId }` | `{ status: 'saved', bytes }`, `{ status: 'skipped' }` |
| `POST /api/internal/checkpoint-history/:sessionId/restore` | `{ projectId }` | `{ status: 'restored', head }`, `{ status: 'none' }` |

Both require `X-Internal-Service-Key`. No public route, schema or frontend contract changes.

## Scope (frozen)

**Write scope, exactly:**

- `services/container-manager/src/git/git.service.ts`
- `services/container-manager/src/git/git.service.spec.ts`
- `services/container-manager/src/git/git.module.ts`
- `services/container-manager/src/git/internal-checkpoint-history.controller.ts`
- `services/container-manager/src/git/internal-checkpoint-history.controller.spec.ts`
- `services/api-gateway/src/clients/container-manager-http.client.ts`
- `services/api-gateway/src/clients/container-manager-http.client.spec.ts`
- `services/api-gateway/src/git-checkpoints/git-checkpoint.module.ts`
- `services/api-gateway/src/git-checkpoints/git-checkpoint.service.ts`
- `services/api-gateway/src/git-checkpoints/git-checkpoint.service.spec.ts`
- `services/api-gateway/src/git-checkpoints/internal-git-checkpoint.controller.ts`
- `services/api-gateway/src/git-checkpoints/internal-git-checkpoint.controller.spec.ts`
- `services/api-gateway/src/checkpoints/checkpoints.service.ts`
- `services/api-gateway/src/checkpoints/checkpoints.service.spec.ts`
- `services/api-gateway/src/sessions/session.controller.ts`
- `services/api-gateway/src/sessions/session.controller.spec.ts`

**Mutexes:** CONTAINER-MANAGER, GATEWAY. Not FRONTEND, I18N, MIGRATION, PACKAGE, COMPOSE, ENV, LOCAL-RUNTIME or STAGING. **Hot files:** none. **Shared contracts:** the internal contract above, frozen here (single lane). **Evidence class:** LOCAL-TESTS. **Revert isolation:** acceptable; backend only, and reverting it leaves CHECKPOINT-PERSIST-01 intact.

**Gates:** `npm test` and `npm run build` in `services/container-manager` and in `services/api-gateway`, run before and after the change.

**Required tests:** the checkpoint ref; save with and without a repository; restore with and without a stored bundle, including HEAD and the untouched working tree (exec calls mocked); UUID validation; the guard on both endpoints; the client methods; the non-awaited save after a recorded checkpoint, including its failure being logged only; restore after a snapshot restore, including failure not failing the open; project-wide listing for the owner only; revert and diff accepted for a same-project checkpoint and refused for another project or user.

**Not in scope:** the frontend, message files, the snapshot format, the database schema, ops scripts and backup, any runtime or staging action. The staging proof is the CLEAN-BASELINE-DEPLOY-01 C1 repeat.

## Risks recorded

- Bundle size grows with history; there is no pruning in this task.
- Restore installs git in the container on demand (`apk add`), as checkpoints already do, so it needs the container's network.
- Two saves for one project can overlap; the rename keeps the stored file whole, and the later one wins.
- An older bundle may miss checkpoints made in a session whose save failed; listing still shows them, and a revert to such a commit fails as a revert does today.

## Lifecycle

Step 1 registration (complete); Step 2 this stage-start, with ARCHITECTURE.md section 11.5 updated (the cross-session row is PLANNED until the lock) and the task admitted to Lane 1; Step 3 implementation; Step 4 consolidation, checkpoint and LOCK, which turns the ARCHITECTURE.md row to CURRENT.
