# PROJ-02-03 CHECKPOINT

## Task Metadata

- Task ID: PROJ-02-03
- Title: Exclude Git Internals From Project Snapshots And Restore
- Nature: BUG FIX (PROJECT SNAPSHOTS, RESTORE BINARY FILE FAILURE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-02-03-CHECKPOINT.md`

## Objective

Prevent project snapshots/restores from including `.git/` internals so restoring a saved project does not fail on binary git files like `.git/index`.

## Background (from PROJ-02-02 diagnosis)

PROJ-02-02 isolated the live 500 on `POST /api/projects/:id/open` to the snapshot restore loop:

- The auto-checkpoint git subsystem creates `.git/` inside `/workspace`.
- `SnapshotPersistenceService.collectWorkspaceFiles` recursed into `.git/` and captured 25 internal files including binary `.git/index` (NUL-byte content).
- On restore, the per-file write loop pushed each file through `ContainerManagerHttpClient.writeSessionFile` → `DockerRuntimeService.writeFileToContainer`. That write path uses `sh -c 'mkdir -p ... && printf "%s" "$CONTENT" > "$FILE"'` with content as an env var, which cannot transport NUL bytes; the in-container shell exited non-zero, throwing `Error: Failed to write file: .git/index`, which surfaced as the HTTP 500 returned to the live UI.

The fix is to never put `.git/` into snapshots and to skip any `.git/*` entries that already exist in legacy snapshot payloads. The git-checkpoint subsystem owns `.git/` itself, so excluding it from the user-workspace snapshot is also semantically correct.

## Locked Scope

- Frontend: no changes.
- Backend: localized change to `SnapshotPersistenceService` only.
- No binary file restore redesign, no git implementation redesign, no snapshot storage redesign, no workspace redesign, no scope expansion.

## Implementation

Single file modified: `services/api-gateway/src/snapshots/snapshot-persistence.service.ts`.

1. Added a small module-local exclusion helper:

```ts
const SNAPSHOT_EXCLUDED_PATH_PREFIXES: readonly string[] = ['.git'];

function isPathExcludedFromSnapshot(workspaceRelativePath: string): boolean {
  if (!workspaceRelativePath) return false;
  for (const prefix of SNAPSHOT_EXCLUDED_PATH_PREFIXES) {
    if (workspaceRelativePath === prefix) return true;
    if (workspaceRelativePath.startsWith(`${prefix}/`)) return true;
  }
  return false;
}
```

2. In `collectFilePathsRecursively`, the exclusion is applied to each entry's workspace-relative path before deciding whether to recurse or to add it to the result. This prevents `.git/` from entering any newly created snapshot payload.

3. In `restoreSnapshot`, the exclusion is applied per file inside the existing write loop. Legacy snapshots that already contain `.git/*` entries (including binary `.git/index`) are silently skipped instead of aborting the open with HTTP 500.

The change is additive and minimal:

- No path-validation guard is weakened.
- No new endpoints, services, dependencies, env vars, or storage formats.
- No broader workspace, snapshot, project, preview, or git-checkpoint behavior is touched.
- Existing PROJ-01-21 snapshot persistence behavior (volume-backed `/snapshot-store`) is preserved.

Spec file `services/api-gateway/src/snapshots/snapshot-persistence.service.spec.ts` was updated:

- The previous test that asserted `.git/` was traversed and `.git/HEAD` was read is now an inverted assertion: snapshot collection must NOT recurse into `.git/` and must NOT read `.git/HEAD`.
- A second test was added that constructs a synthetic legacy snapshot payload containing `index.html`, `.git/HEAD`, and a binary `.git/index` (with embedded NUL), and asserts `restoreSnapshot` writes only `index.html` while never invoking `writeSessionFile` for any `.git/*` entry.

## Files Changed

- `services/api-gateway/src/snapshots/snapshot-persistence.service.ts`
- `services/api-gateway/src/snapshots/snapshot-persistence.service.spec.ts`
- `docs/PROJ-02-03-CHECKPOINT.md` (this file, new)
- `TASKS.md` (status fields for PROJ-02-03 set to COMPLETE and LOCKED)
- `TASKS_BACKLOG_FULL.md` (status field for PROJ-02-03 set to COMPLETE and LOCKED)

No other source files were modified.

## Validation

### 1. Type check

```
cd services/api-gateway
npx tsc --noEmit -p tsconfig.json
```

Result: clean exit (no type errors).

### 2. Targeted unit tests

```
npx jest src/snapshots/snapshot-persistence.service.spec.ts --colors=false
```

Result:

```
PASS src/snapshots/snapshot-persistence.service.spec.ts
  SnapshotPersistenceService (PR-01-01)
    saveSnapshot persists metadata and durable payload (15 ms)
    restoreSnapshot clears workspace then writes snapshot files (3 ms)
    saveSnapshot excludes the auto-checkpoint .git directory from the snapshot payload (PROJ-02-03) (2 ms)
    restoreSnapshot skips legacy .git/ entries already present in older snapshots (PROJ-02-03) (3 ms)
Tests:       4 passed, 4 total
```

### 3. Adjacent regression — projects service

```
npx jest src/projects/projects.service.spec.ts --colors=false
```

Result: 12/12 tests pass (project open + snapshot integration unaffected).

### 4. Live end-to-end through running Docker stack

Rebuilt and restarted only the api-gateway service:

```
docker compose -f docker-compose.prod.yml build api-gateway
docker compose -f docker-compose.prod.yml up -d api-gateway
docker exec aisandbox-api-gateway wget -qO- http://localhost:4000/api/health
=> {"status":"ok",...}
```

Then ran a full register → session → write → snapshot → open scenario through the public API (the same flow the real UI exercises). The script populated `.git/` with text files (`.git/HEAD`, `.git/config`, `.git/refs/heads/main`) directly via `/sessions/:id/files/write` to deterministically reproduce the auto-checkpoint workspace shape; an out-of-scope intermittent 10s timeout in the manual `POST /sessions/:id/checkpoints` path made running real auto-checkpoint flaky, but it produces the same `.git/` tree shape, so the substitution is exact for what `collectWorkspaceFiles` sees.

Output highlights:

```
session A root entries:           index.html:file, .git:directory
snapshot.fileCount =              1
occurrences of '.git/' in
  on-disk snapshot payload =      0
open project (NEW snapshot)  =>   200 OK { restoredSnapshotId: ..., sessionId: <B> }
session B root entries after open: index.html:file        ← .git absent, file restored
read index.html in session B:     '<h1>hello world</h1>'  ← content matches
```

A second pass exercised the legacy-snapshot defensive skip path. A synthetic legacy payload was written directly into `/snapshot-store/<userId>/<id>.data.json` from inside the api-gateway container using Node (so binary NUL bytes in `.git/index` content are preserved without PowerShell encoding ambiguity):

```
legacy snapshot diag: on_disk_files=3 git_index_has_nul=true
```

Then opening the same project with that legacy snapshot ID into a third session:

```
open project (LEGACY snapshot containing .git/index) => 200 OK
session C root entries after legacy open: index.html:file
```

Pre-fix behavior on this exact payload was: HTTP 500 with `Failed to write file: .git/index`. Post-fix behavior is: HTTP 200, `index.html` restored, all `.git/*` entries skipped silently. The validation script printed `PROJ-02-03 LIVE VALIDATION OK`.

### 5. Acceptance criteria status

| Acceptance criterion | Status |
|---|---|
| New project snapshots do not include `.git/` internals | ✅ confirmed (live grep on persisted payload returned 0 matches; unit test asserts collection does not list/read `.git/`) |
| Restore ignores/skips `.git/` internals if present in older snapshots | ✅ confirmed (live legacy-payload open returns 200; unit test asserts `writeSessionFile` is never called for `.git/HEAD` or `.git/index`) |
| Project open no longer returns 500 due to `.git/index` | ✅ confirmed (the exact previously-failing call shape now returns 200) |
| Normal source files still restore correctly | ✅ confirmed (`index.html` restored, content byte-equal in both new and legacy paths) |
| Fix is documented clearly | ✅ this checkpoint |

## Out-of-scope observations (not addressed in this task)

- The intermittent `Failed to create manual checkpoint ... timeout of 10000ms exceeded` from the api-gateway → container-manager call during the live re-test is a pre-existing infra timing issue (10s HTTP client timeout vs. cold-container `git init/add/commit` work). It is unrelated to PROJ-02-03 and should be tracked separately if it becomes problematic.
- The `[Task 9.5A] Quota evaluation failed ... no such table` log noise in container-manager is unrelated FREE-tier fail-open behavior.
- The container `printf "%s"` write path is still NOT binary-safe. Once `.git/` is excluded, no shipped flow tries to write binary content through it. If a future task ever needs to transport binary content (e.g., PNG asset upload through the snapshot system), a bounded follow-up would generalize the write path. Out of scope here.

## Scope and Invariants Preserved

- Frontend untouched.
- Container-manager untouched.
- Snapshot file format on disk unchanged (same `*.meta.json` / `*.data.json` shape, same persistence volume from PROJ-01-21).
- `validateWorkspacePath` and other security guards untouched.
- Project open / association / restore semantics from PR-01/PR-02/PR-03 untouched.
- Project open hydration sequence from PROJ-02-01 untouched.
- All prior checkpoint invariants intact (PROJ-01-17/18/19/20/21/22/23, PROJ-02-01, PROJ-02-02, PREV-02-01/02-02, OPS-01-04).
