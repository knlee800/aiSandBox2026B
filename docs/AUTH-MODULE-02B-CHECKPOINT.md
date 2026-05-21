# AUTH-MODULE-02B Checkpoint — Checkpoint Revert Has No Effect

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-02B |
| Title | Checkpoint Revert Has No Effect |
| Parent | AUTH-MODULE-02 — Auth Module Live Smoke Blockers |
| Family | AUTH |
| Status | COMPLETE and LOCKED |
| Nature | FULL-STACK — frontend, api-gateway, container-manager |
| Date | 2026-05-21 |
| Depends on | AUTH-MODULE-02A (COMPLETE and LOCKED — `docs/AUTH-MODULE-02A-CHECKPOINT.md`) |
| Checkpoint | `docs/AUTH-MODULE-02B-CHECKPOINT.md` |

---

## Objective

Fix the checkpoint revert flow so that confirming a revert in the UI actually restores workspace files to the selected checkpoint state. The end-to-end flow was silently failing at multiple layers, resulting in the UI reporting "Revert failed" (or appearing to succeed while files remained unchanged).

---

## Root Cause Chain

Four distinct bugs were identified and fixed in sequence through iterative live re-testing:

### Bug 1 — Frontend Route Mismatch

**Layer:** Frontend  
**File:** `frontend/components/workspace/workspace-checkpoint-revert.logic.ts`

The revert helper called `POST /api/git/:sessionId/revert`. This endpoint does not exist on the api-gateway. The correct route is `POST /api/sessions/:sessionId/revert`.

**Evidence:** Network tab showed `404 Not Found` — response: `Cannot POST /api/git/...`

---

### Bug 2 — api-gateway Route Registration Failure

**Layer:** api-gateway  
**File:** `services/api-gateway/src/checkpoints/checkpoints.controller.ts`

`CheckpointsController` was registered as `@Controller('sessions/:id/checkpoints')` with `@Post('../revert')`. NestJS does not normalize `../revert` as a relative path traversal in route decorators, so `POST /api/sessions/:id/revert` was never registered as a valid route.

**Evidence:** Network tab showed `404 Not Found` — response body: `{ "message": "Cannot POST /api/sessions/...", "statusCode": 404 }`

---

### Bug 3 — Container-Manager `simple-git` Path Error

**Layer:** container-manager  
**File:** `services/container-manager/src/git/git.service.ts`

`GitService.revert()` used `simpleGit(workspacePath).reset(['--hard', commitHash])`. The `workspacePath` (e.g. `/workspace/...`) does not exist on the container-manager's host filesystem — it only exists inside the sandbox container. This caused a runtime error: `Cannot use simple-git on a directory that does not exist`.

**Evidence:** Container-manager Docker logs: `Error: Cannot use simple-git on a directory that does not exist`; api-gateway returned `500 Internal server error`.

---

### Bug 4 — `userId` Not Forwarded to Container-Manager

**Layer:** api-gateway  
**Files:** `services/api-gateway/src/clients/container-manager-http.client.ts`, `services/api-gateway/src/checkpoints/checkpoints.service.ts`, `services/api-gateway/src/checkpoints/checkpoints.controller.ts`

After the `git reset --hard` succeeded, `GitService.revert()` called `createCheckpoint(sessionId, userId, ...)` but `userId` was `undefined`. The api-gateway's `ContainerManagerHttpClient.revertToCheckpoint()` sent only `{ commitHash }` in the POST body, not including `userId`. The container-manager's `GitController.revert` extracted `@Body('userId')` which resolved as `undefined`, causing a SQLite `NOT NULL constraint failed: checkpoints.user_id` error.

**Evidence:** Container-manager Docker logs: `NOT NULL constraint failed: checkpoints.user_id`; api-gateway returned `500 Internal server error`.

---

## Files Changed

### Frontend

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-checkpoint-revert.logic.ts` | Fixed revert URL from `/api/git/:sessionId/revert` to `/api/sessions/:sessionId/revert` |
| `frontend/components/workspace/workspace-checkpoint-revert.logic.test.ts` | Updated URL assertion to expect `/api/sessions/session-abc/revert` |

### api-gateway — Route Registration

| File | Change |
|---|---|
| `services/api-gateway/src/checkpoints/checkpoints.controller.ts` | Changed `@Controller('sessions/:id/checkpoints')` to `@Controller('sessions/:id')`; changed `@Post('../revert')` to `@Post('revert')`; made all method paths explicit: `@Post('checkpoints')`, `@Get('checkpoints')`, `@Get('checkpoints/:hash/diff')` |
| `services/api-gateway/src/checkpoints/__tests__/checkpoints.routes-http.spec.ts` | New file — supertest HTTP integration tests verifying `POST /api/sessions/:id/revert` is registered, forwards `commitHash`, handles validation errors, and that `GET /api/sessions/:id/checkpoints` remains functional |

### container-manager — Git Reset in Container

| File | Change |
|---|---|
| `services/container-manager/src/git/git.service.ts` | Replaced `simpleGit(workspacePath).reset(['--hard', commitHash])` with `sessionsService.execInContainer(sessionId, ['sh', '-lc', 'git reset --hard "$COMMIT_HASH"'], '/workspace', { COMMIT_HASH: commitHash })` |
| `services/container-manager/src/git/git.service.spec.ts` | New file — unit tests verifying `execInContainer` is called with the correct command, `cwd`, and env vars; verifies error handling for non-zero exit codes |

### api-gateway — userId Forwarding

| File | Change |
|---|---|
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Added `userId: string` parameter to `revertToCheckpoint()`; included `userId` in POST body: `{ commitHash, userId }` |
| `services/api-gateway/src/checkpoints/checkpoints.service.ts` | Added `userId: string` parameter to `revertToCheckpoint()`; forwarded to `ContainerManagerHttpClient.revertToCheckpoint()` |
| `services/api-gateway/src/checkpoints/checkpoints.controller.ts` | Forwarded `req.user.userId` into `checkpointsService.revertToCheckpoint()` |
| `services/api-gateway/src/checkpoints/checkpoints.service.spec.ts` | Updated all `service.revertToCheckpoint(...)` calls to include `userId` |
| `services/api-gateway/src/checkpoints/checkpoints.controller.spec.ts` | Updated `expect(service.revertToCheckpoint).toHaveBeenCalledWith(...)` to include `userId` |
| `services/api-gateway/src/checkpoints/__tests__/checkpoints.integration.spec.ts` | Updated `expect(containerManagerClient.revertToCheckpoint).toHaveBeenCalledWith(...)` to include `userId` |
| `services/api-gateway/src/checkpoints/__tests__/checkpoints.routes-http.spec.ts` | Updated `expect(service.revertToCheckpoint).toHaveBeenCalledWith(...)` to include `authenticatedUserId` |

---

## Four-Fix Implementation Summary

### Fix 1 — Frontend URL correction

```
Before: POST /api/git/${sessionId}/revert
After:  POST /api/sessions/${sessionId}/revert
```

### Fix 2 — api-gateway controller route restructure

```
Before: @Controller('sessions/:id/checkpoints') + @Post('../revert')
After:  @Controller('sessions/:id') + @Post('revert')
        + explicit @Post('checkpoints'), @Get('checkpoints'), @Get('checkpoints/:hash/diff')
```

### Fix 3 — container-manager in-container git reset

```
Before: simpleGit(workspacePath).reset(['--hard', commitHash])  // host-side, path doesn't exist
After:  sessionsService.execInContainer(
          sessionId,
          ['sh', '-lc', 'git reset --hard "$COMMIT_HASH"'],
          '/workspace',
          { COMMIT_HASH: commitHash }
        )
```

### Fix 4 — userId forwarding chain

```
req.user.userId
  → CheckpointsController.revertToCheckpoint(id, revertDto, req)
    → CheckpointsService.revertToCheckpoint(sessionId, commitHash, userId)
      → ContainerManagerHttpClient.revertToCheckpoint(sessionId, commitHash, userId)
        → POST /api/git/:sessionId/revert  { commitHash, userId }
```

---

## Validation Results

### Frontend

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `npm test` | **PASS — 437 tests, 437 passed, 0 failed** |
| `ReadLints` on touched files | **PASS** |

### api-gateway

| Command | Result |
|---|---|
| Focused checkpoint suites (4 files) | **PASS — 4 suites, 40 tests** |
| `npm run build` | **PASS — TypeScript compile succeeded, 0 errors** |
| `ReadLints` on touched files | **PASS** |
| Full `npm test` | Pre-existing REDIS_URL / smoke-suite environment failures unrelated to this fix — not treated as regression |

### container-manager

| Command | Result |
|---|---|
| `npm test` | **PASS — 5 suites, 35 tests** |
| `npm run build` | **PASS — TypeScript compile succeeded, 0 errors** |
| `ReadLints` on touched files | **PASS** |

---

## Live Re-Test Evidence — Round 4 (PASS)

**Session:** `c741fe05-ae3c-48c1-90eb-7916ca17f474`  
**Checkpoint:** `revert-test-baseline-4`  
**File modified:** `second-page.html` (marker: `REVERT-TEST-MARKER-4`)

| Check | Result |
|---|---|
| `POST /api/sessions/:id/revert` HTTP status | **200 OK** |
| Response body | `{ "message": "Reverted successfully", "newCheckpoint": { "id": "...", "commitHash": "3d5feb4af75a...", "description": "revert-test-baseline-4" } }` |
| `REVERT-TEST-MARKER-4` removed from `second-page.html` | **PASS** |
| Editor content refreshed automatically | **PASS** |
| File tree refreshed | **PASS** |
| Checkpoint list updated | **PASS** |
| `checkpoints.user_id NOT NULL` error | **GONE** |
| `simple-git missing directory` error | **GONE** |

---

## Known Out-of-Scope Background Errors

These errors appear in Docker logs during the revert flow but do **not block success**:

### 1. api-gateway PostgreSQL internal ledger callback — `session_id` null

```
QueryFailedError: null value in column "session_id" of relation "git_checkpoints"
violates not-null constraint
```

- **Path:** container-manager → `POST /api/internal/git-checkpoints` → api-gateway PostgreSQL
- **Cause:** After the revert commit, the container-manager calls back to the api-gateway's internal checkpoint recording endpoint. The `sessionId` field in that callback is null or missing.
- **Impact:** The new post-revert checkpoint is not persisted to the PostgreSQL `git_checkpoints` ledger. The revert itself completes correctly.
- **Action:** Carry-forward. Separate task required.

### 2. container-manager — failed ledger recording confirmation

```
[ApiGatewayHttpClient] Failed to record git checkpoint for <sessionId>: Request failed with status code 500
Failed to record checkpoint in api-gateway: Request failed with status code 500
```

- **Cause:** Direct consequence of the api-gateway internal ledger callback returning 500 (see above).
- **Impact:** Same as above — does not block revert success.

### 3. Quota/billing table warnings (pre-existing, fail-open)

```
no such table: users
no such table: token_usage
```

- **Cause:** Quota evaluation tables not yet provisioned in this environment.
- **Impact:** None — quota evaluation fails open by design.

---

## Non-Goals Confirmed

- No use of `"system"` fallback for `userId`
- No frontend changes beyond the URL fix
- No `GitService.revert` changes beyond the `execInContainer` replacement
- No checkpoint/revert flow redesign
- No new undo system
- No changes to `TASKS.md`, `TASKS_BACKLOG_FULL.md`, or other checkpoint docs during implementation phases

---

## Invariants Preserved

- `POST /api/sessions/:id/checkpoints` (create manual checkpoint) — unchanged
- `GET /api/sessions/:id/checkpoints` (list checkpoints) — unchanged
- `GET /api/sessions/:id/checkpoints/:hash/diff` (get diff) — unchanged
- Session ownership verification in all controller methods — unchanged
- `SessionCookieGuard` on all checkpoint endpoints — unchanged
- All existing container-manager session/docker/git service contracts — unchanged
- No breaking changes to existing checkpoint response shapes

---

## Carry-Forwards

1. **Internal ledger `session_id` null on post-revert checkpoint recording** — container-manager callback to `POST /api/internal/git-checkpoints` sends a null `session_id`. Requires a separate investigation and fix task.
2. **Quota/billing tables** (`users`, `token_usage`) — not provisioned in dev environment. Pre-existing, deferred.
3. **Full api-gateway `npm test` smoke suite** — pre-existing failures related to REDIS_URL / test environment setup. Not caused by this task.

---

## Reference

- `TASKS.md` → AUTH-MODULE-02B
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-02B
- Parent: `docs/AUTH-MODULE-02-CHECKPOINT.md`
- Sibling: `docs/AUTH-MODULE-02A-CHECKPOINT.md`
