# PROJ-02-02 CHECKPOINT

## Task Metadata

- Task ID: PROJ-02-02
- Title: Validate Real UI Project Open Hydration Failure With Docker Running
- Nature: BUG INVESTIGATION (PROJECT OPEN HYDRATION, REAL UI VALIDATION)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-02-02-CHECKPOINT.md`

## Objective

Reproduce and diagnose why the real UI fails to load files automatically after project open, despite PROJ-02-01's deterministic hydration refactor passing static/unit validation.

## Real-UI Evidence Provided

A live browser request from the real UI returned 500:

- Request: `POST http://localhost:3000/api/projects/dcfd6b65-d7ea-42fe-bf88-54b25f880498/open`
- Payload: `{ "sessionId":"1c519e2c-26dd-48d8-870a-773186bea09c", "snapshotId":"0259c4da-8186-4524-91d5-6dd826a52a7f" }`
- Response: `500 {"statusCode":500,"message":"Internal server error"}`

This is NOT a frontend hydration / React render issue. It is a backend `restoreSnapshot` failure that aborts the open call before any frontend hydration can run. The earlier "files don't load in UI" symptom was masking a server-side 500 on `/projects/:id/open`.

## Environment

- Date: 2026-04-17
- Docker stack: all services `Up` and `healthy` per `docker compose -f docker-compose.prod.yml ps`.
- Frontend container is on PROJ-02-01 code (`hydrateWorkspaceForProjectOpen` present in built bundle).

## Investigation — exact commands and findings

### 1) Locate the 500 in api-gateway / container-manager logs

```
docker logs aisandbox-api-gateway --since 30m | Select-String -Pattern "dcfd6b65|0259c4da|1c519e2c|/projects/.*/open|ERROR|Exception"
docker logs aisandbox-container-manager --since 30m | Select-String -Pattern "dcfd6b65|0259c4da|1c519e2c|snapshot|restore|ERROR|Exception" -Context 0,4
```

`api-gateway` shows the matching internal `start` for the target session at `01:54:47Z`, then a long burst of unrelated quota-evaluation warnings (`no such table: token_usage` / `no such table: users`). These are pre-existing FREE-tier fallback noise, not the cause of the 500.

`container-manager` (and api-gateway exception output) shows the exact failure:

```
[Nest] ERROR [ExceptionsHandler]
Failed to write file to container for session 1c519e2c-26dd-48d8-870a-773186bea09c:
Failed to write file: .git/index
    at DockerRuntimeService.writeFileToContainer (/app/dist/docker/docker-runtime.service.js:296:19)
    at SessionsService.writeFileToContainer (/app/dist/sessions/sessions.service.js:343:9)
    at InternalSessionsController.writeFile (/app/dist/sessions/internal-sessions.controller.js:52:9)
```

The thrown error message format `Failed to write file: ${filePath}` is produced by `DockerRuntimeService.writeFileToContainer` only when the in-container shell exit code is non-zero:

```ts
// services/container-manager/src/docker/docker-runtime.service.ts
const result = await this.execInContainerBySessionId(
  sessionId,
  ['sh', '-c', 'mkdir -p "$(dirname "$FILE")" && printf "%s" "$CONTENT" > "$FILE"'],
  '/workspace',
  { FILE: fullPath, CONTENT: content },
  30000,
);
if (result.exitCode !== 0) {
  throw new Error(`Failed to write file: ${filePath}`);
}
```

The failed write target is `.git/index` — a binary git index file.

### 2) Confirm snapshot files exist on persistent volume

```
docker exec aisandbox-api-gateway sh -c "find /snapshot-store -name '0259c4da*'"
=>
/snapshot-store/35b6dd3b-417c-49e7-a47d-958a52853353/0259c4da-8186-4524-91d5-6dd826a52a7f.meta.json
/snapshot-store/35b6dd3b-417c-49e7-a47d-958a52853353/0259c4da-8186-4524-91d5-6dd826a52a7f.data.json
```

Snapshot metadata + data both present. PROJ-01-21 persistence is intact. Not a missing-snapshot case.

### 3) Inspect snapshot payload

A small Node script run inside the api-gateway container against the snapshot's `.data.json`:

```
META={"id":"0259c4da-8186-4524-91d5-6dd826a52a7f","userId":"35b6dd3b-417c-49e7-a47d-958a52853353","label":"[project-id:dcfd6b65-d7ea-42fe-bf88-54b25f880498]","createdAt":"2026-04-17T01:38:07.157Z","fileCount":26}
DATA_BYTES=26667
FILE_COUNT=26
GIT_FILES=25
FILES_WITH_NUL=3
TOTAL_CONTENT_LEN=22765
SAMPLES=
  hi_april17.html        len=225  hasNul=false
  .git/COMMIT_EDITMSG    len=35   hasNul=false
  .git/HEAD              len=23   hasNul=false
  .git/config            len=149  hasNul=false
  .git/description       len=73   hasNul=false
  .git/index             len=141  hasNul=true
```

Findings:

- The snapshot contains 1 user file (`hi_april17.html`) and **25 internal git files** under `.git/`.
- 3 of those files contain NUL bytes (binary content) — including `.git/index`.
- The session was already a git-checkpoint-managed workspace (auto-checkpoints under `.git/`), and `SnapshotPersistenceService.collectWorkspaceFiles` has no exclusion for `.git/` so it captured the entire git internal store, including binary objects.

### 4) Confirm the restore path in source

`services/api-gateway/src/snapshots/snapshot-persistence.service.ts`:

```ts
async restoreSnapshot(args): Promise<WorkspaceSnapshotMetadata> {
  const payload = await this.loadSnapshotPayload(args.userId, args.snapshotId);
  await this.clearWorkspace(args.sessionId);
  for (const file of payload.files) {
    await this.containerManagerHttpClient.writeSessionFile(
      args.sessionId,
      file.path,
      file.content,
    );
  }
  return payload.metadata;
}
```

There is no per-file try/catch, no exclusion list, and no binary-safe write path. The first failed write aborts the loop and propagates as the 500 returned to the frontend's `POST /api/projects/:id/open`.

### 5) Why `.git/index` write produces non-zero exit code

`DockerRuntimeService.writeFileToContainer` writes via:

```
sh -c 'mkdir -p "$(dirname "$FILE")" && printf "%s" "$CONTENT" > "$FILE"'
```

with `CONTENT` passed as an environment variable. Two layers reject NUL-byte content here:

1. POSIX environment variables cannot carry embedded NUL bytes; many shells (BusyBox `sh` inside the alpine sandbox) reject or truncate such values.
2. `printf "%s"` truncates at the first NUL even if the env var were preserved.

The combination causes the in-container write of `.git/index` to fail (non-zero exit), so the wrapper throws `Error: Failed to write file: .git/index`, which surfaces as the observed 500.

## Exact failing stage (one sentence)

`SnapshotPersistenceService.restoreSnapshot` in `api-gateway` aborts when it tries to push the binary `.git/index` file from the snapshot back into the target session through `ContainerManagerHttpClient.writeSessionFile` → `DockerRuntimeService.writeFileToContainer`, because the in-container write path uses an env-var + `printf "%s"` shell pipeline that cannot transport NUL-byte (binary) content; the resulting non-zero shell exit becomes `Error: Failed to write file: .git/index`, which propagates as the HTTP 500 response on `POST /api/projects/:id/open`.

## Failure category (per prompt)

- ❌ Missing snapshot file — refuted (both `.meta.json` and `.data.json` present).
- ❌ Missing snapshot metadata — refuted.
- ❌ Missing/invalid session — refuted (`/internal/sessions/.../start` succeeded; container created and running).
- ❌ Path validation failure — refuted (`.git/index` passes `validateWorkspacePath`; the BadRequestException path was not taken; the failure is a non-zero exit, not a thrown validation error).
- ✅ **Restore write failure** — confirmed. Specifically a *binary-content write* failure on `.git/index` (and would also affect the other 2 NUL-containing files in the snapshot).
- ❌ Other backend exception — refuted (the noisy `git_checkpoints.session_id` and `no such table` log lines are unrelated subsystems and pre-date this open call).

## Why this surfaces as "files don't load in UI"

When `POST /api/projects/:id/open` returns 500:

- `frontend/app/[locale]/app/page.tsx` `handleOpenWorkspaceProject` catches the rejection from `openWorkspaceProject(...)` and routes to its `catch` branch, setting `projectActionState='error'`. It never reaches the hydration helper, never sets `selectedSessionId`, never lists/reads files.
- The PROJ-02-01 deterministic hydration is correct; it simply has no chance to run because the awaited backend call rejects.
- A browser refresh appears to "fix" the symptom because:
  - On reload, no project-open call is made.
  - The bootstrap path uses `loadWorkspaceFilesForSession` against whatever session is selected. If `clearWorkspace` had partially run (it ran successfully before the failed write), the session is now empty and the file panel renders the empty state — i.e., it looks "loaded" but is actually empty. If the user is on a different session, that session's files load normally.

This is consistent with the user-reported behavior.

## Out-of-scope observations (NOT addressed in this investigation per scope rules)

These appear in surrounding logs but are unrelated to the 500 in scope and must be handled by their own bounded tasks if desired:

- `aisandbox-container-manager` repeatedly logs `[Task 9.5A] Quota evaluation failed ... no such table: token_usage` and `no such table: users`. This is FREE-tier fail-open behavior; it does not block any flow but indicates a missing migration in the container-manager's local SQLite metadata DB.
- `aisandbox-api-gateway` logged a `git_checkpoints.session_id` not-null violation during a chat-execution flow at `01:37:34Z` — unrelated to project open.

## Recommended bounded follow-up (NOT registered in this checkpoint)

Restore must be made tolerant of binary content from `.git/*` files captured by snapshots. Possible bounded fixes (one task each, choose one):

1. Exclude `.git/` (and conventional ignore patterns) from `SnapshotPersistenceService.collectWorkspaceFiles` so binary git internals are never captured nor restored.
2. Make `DockerRuntimeService.writeFileToContainer` and `ContainerManagerHttpClient.writeSessionFile` binary-safe (e.g., base64-encode payload, decode in-container with `base64 -d`, or use `docker cp` for content with NUL).
3. Make `SnapshotPersistenceService.restoreSnapshot` per-file fault-tolerant (skip-and-log binary write failures) so partial restore returns success rather than aborting on first binary file.

Option 1 is the smallest and most architecturally correct change because the snapshot system is for user workspace content, not the auto-checkpoint git repo (`.git/` is recreated by the existing git-checkpoint subsystem at restore time anyway).

These are recommendations only. No code change is made in PROJ-02-02.

## Files Changed

- `docs/PROJ-02-02-CHECKPOINT.md` (rewritten with full diagnosis).

No source code, configuration, or task-status files modified by the investigation itself.

## Validation summary

| Check | Command | Result |
|-------|---------|--------|
| Stack health | `docker compose -f docker-compose.prod.yml ps` | all `Up`/`healthy` |
| api-gateway logs around event | `docker logs aisandbox-api-gateway --since 30m` | `internal sessions/.../start` at 01:54:47Z then quota noise; no project-system exception text |
| container-manager logs around event | `docker logs aisandbox-container-manager --since 30m` | `Failed to write file: .git/index` exception at 01:55:13Z with full stack trace |
| Snapshot files exist | `find /snapshot-store -name '0259c4da*'` | both `.meta.json` and `.data.json` present (PROJ-01-21 volume) |
| Snapshot payload inspection | Node script in `aisandbox-api-gateway` | 26 files, 25 under `.git/`, 3 with NUL bytes incl. `.git/index` |
| Source confirms throw site | `docker-runtime.service.ts` L505-508 | `if (result.exitCode !== 0) throw new Error('Failed to write file: ' + filePath)` |
| Source confirms restore loop is not fault-tolerant | `snapshot-persistence.service.ts` L91-106 | Single `for (...) await writeSessionFile(...)`; first failure aborts the open |

## Status decision

The exact 500 cause is clearly diagnosed (snapshot restore fails on binary `.git/index` due to env-var + `printf "%s"` write path). PROJ-02-02 is therefore marked COMPLETE and LOCKED. A bounded follow-up task should be registered separately to apply one of the recommended fixes (Option 1 preferred); that is intentionally NOT registered in this checkpoint to keep PROJ-02-02 strictly within investigation scope.

## Scope and Invariants Preserved

- Investigation only; no code changes.
- No project-system, snapshot, persistence, preview, Docker, or workspace redesign.
- No new task registered.
- All prior checkpoint invariants intact (PROJ-01-17/18/19/20/21/22/23, PROJ-02-01, PREV-02-01/02-02, OPS-01-04).
