# REL-01-02C CHECKPOINT - Fix Snapshot Path Validation After Checkpoint

## Task Metadata

- Task ID: REL-01-02C
- Title: Fix Snapshot Path Validation After Checkpoint
- Nature: BUG FIX (RELEASE READINESS, LIVE-SMOKE BLOCKER)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-02C-CHECKPOINT.md`

## Objective Completed

Fixed the deterministic live-stack blocker where `POST /api/sessions/:id/snapshot` failed after checkpoint creation in the same session with `400` (`Absolute paths outside /workspace not allowed`).

## Root Cause

- `SnapshotPersistenceService.collectFilePathsRecursively()` built recursive directory paths with a leading slash (for example `/.git`).
- After checkpoint creation, `.git` exists in workspace; recursion attempted `listSessionDirectory(sessionId, '/.git')`.
- Container-manager correctly rejected that input as an absolute path outside `/workspace`.
- Before checkpoint creation (and without directory recursion), snapshot could still pass.

## Smallest Safe Fix Applied

- File changed: `services/api-gateway/src/snapshots/snapshot-persistence.service.ts`
- Fix scope:
  - Kept root list call as `'/'` only for initial traversal.
  - Normalized recursive traversal to workspace-relative paths (for example `.git`, `.git/HEAD`, `src/app.ts`) with no leading slash.
  - Preserved existing container-manager path protection (no weakening of outside-workspace rejection).

## Additional Targeted Test Added

- File changed: `services/api-gateway/src/snapshots/snapshot-persistence.service.spec.ts`
- Added regression test:
  - `saveSnapshot keeps recursive paths workspace-relative after checkpoint-created .git dir`
  - Verifies recursive listing uses `.git` (not `/.git`) and reads relative file paths.

## Exact Commands / Tests / Checks Run

1. Targeted unit test:
   - `npm test -- src/snapshots/snapshot-persistence.service.spec.ts`  
   - Result: PASS (1 suite, 3 tests)
2. Build:
   - `npm run build` (in `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)  
   - Result: PASS
3. Live stack refresh:
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" build api-gateway`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d --no-deps api-gateway`
4. Focused live validation:
   - Health check: `GET /api/health` -> `200`
   - Flow A (before checkpoint):
     - create session -> write file -> `POST /api/sessions/:id/snapshot` -> `201`
   - Flow B (after checkpoint in same session):
     - create session -> write file -> `POST /api/sessions/:id/checkpoints` -> `201`
     - `POST /api/sessions/:id/snapshot` -> `201`
   - Outside-workspace rejection guard:
     - `POST /api/sessions/:id/files/read` with `path='/etc/passwd'` -> `400`

## Results

- Snapshot before checkpoint creation: PASS (`201`)
- Snapshot after checkpoint creation in same session: PASS (`201`)
- Outside-workspace path rejection still enforced: PASS (`400`)
- REL-01-02C blocker is resolved with bounded scope.

## Scope Compliance

- Preserved checkpoint behavior.
- Preserved snapshot behavior and safety guardrails.
- No broader snapshot redesign.
- No checkpoint redesign.
- No unrelated schema/path cleanup.
- No feature work.
