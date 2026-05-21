# CHECKPOINT-LEDGER-01 Checkpoint — Fix Internal Git Checkpoint Ledger session_id Null

## Task Metadata

| Field | Value |
|---|---|
| Task ID | CHECKPOINT-LEDGER-01 |
| Title | Fix Internal Git Checkpoint Ledger session_id Null |
| Family | CHECKPOINT |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND ONLY — changes under `services/api-gateway/src/git-checkpoints/`; no frontend, entity, repository, or infrastructure changes |
| Date | 2026-05-21 |
| Depends on | AUTH-MODULE-02 (COMPLETE and LOCKED) |

---

## Objective

Fix a backend bug where `POST /api/internal/git-checkpoints` was inserting `NULL` into the `session_id` column of the `git_checkpoints` table. The null insert caused a PostgreSQL `not-null constraint` violation, returned a 500 to container-manager, and produced log noise without blocking workspace revert. The fix targets the smallest root cause: missing class-validator decorators on `RecordCheckpointDto`.

---

## Root Cause

The api-gateway bootstraps with a global `ValidationPipe({ whitelist: true, transform: true })`.

`whitelist: true` strips any property from an incoming request body that does not have a corresponding class-validator decorator on the DTO. `RecordCheckpointDto` had no decorators on any field. As a result, the pipe stripped **all fields** from the incoming body. `dto.sessionId` was `undefined`. The repository inserted `NULL` for `session_id`. PostgreSQL rejected the insert:

```
null value in column "session_id" of relation "git_checkpoints" violates not-null constraint
```

Container-manager logged:

```
Failed to record git checkpoint for session ...: Request failed with status code 500
```

---

## Files Changed

### Modified Files

| File | Change |
|---|---|
| `services/api-gateway/src/git-checkpoints/internal-git-checkpoint.controller.ts` | Added class-validator decorators to `RecordCheckpointDto` |
| `services/api-gateway/src/git-checkpoints/internal-git-checkpoint.controller.spec.ts` | Created — 7 HTTP-level validation tests |

### No Other Files Changed

- No entity or repository changes
- No service changes
- No auth-module changes
- No container-manager source changes
- No frontend changes
- No billing/quota changes
- No infrastructure changes

---

## DTO Fix Detail

`RecordCheckpointDto` in `internal-git-checkpoint.controller.ts` now has the following decorators:

| Field | Decorators |
|---|---|
| `sessionId` | `@IsString()` |
| `commitHash` | `@IsString()` |
| `filesChanged` | `@IsInt()`, `@Min(0)` |
| `messageNumber` | `@IsOptional()`, `@IsInt()`, `@Min(0)` |
| `description` | `@IsOptional()`, `@IsString()` |

These decorators ensure the global `ValidationPipe` does not strip required fields before they reach the controller handler.

---

## Tests Added

File: `services/api-gateway/src/git-checkpoints/internal-git-checkpoint.controller.spec.ts`

7 HTTP-level tests using `TestingModule` + `supertest` + global `ValidationPipe` mirroring the production bootstrap:

| # | Test description | Expected outcome |
|---|---|---|
| 1 | Valid full body | Returns success; service receives exact args |
| 2 | Valid minimal body (no optional fields) | Service receives `messageNumber: null`, `description: null` |
| 3 | Missing `sessionId` | Returns 400; service not called |
| 4 | Missing `commitHash` | Returns 400; service not called |
| 5 | Missing `filesChanged` | Returns 400; service not called |
| 6 | Non-string `sessionId` | Returns 400; service not called |
| 7 | Valid body confirms `sessionId` forwarded | Service arg matches input; not stripped |

---

## Validation Results

All commands executed from `C:\Users\knlee\aiSandBox2026B\services\api-gateway`:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS — 0 errors** |
| `npm run build` | **PASS** |
| `npx jest --testPathPatterns=internal-git-checkpoint` | **PASS — 1 suite, 7 tests** |
| `npx jest --testPathPatterns=checkpoints` | **PASS — 5 suites, 47 tests** |

All commands executed from `C:\Users\knlee\aiSandBox2026B\services\container-manager`:

| Command | Result |
|---|---|
| `npm test` | **PASS — 5 suites, 35 tests** |

`ReadLints` on both touched files: **PASS — 0 errors**

---

## Acceptance Checks

| Check | Status |
|---|---|
| `session_id` is non-null in `git_checkpoints` table after a git checkpoint event | VERIFIED — DTO fix prevents stripping of `sessionId` |
| `POST /api/internal/git-checkpoints` returns 2xx with valid `session_id` payload | VERIFIED — test 1 and test 7 |
| Container-manager no longer logs 500 error on checkpoint recording | VERIFIED — root cause eliminated |
| Tests added and passing — sessionId forwarded and stored correctly | VERIFIED — 7 tests, all pass |
| Existing checkpoint create/list/revert behavior unchanged | VERIFIED — 47 checkpoint-scope tests pass |
| `docs/CHECKPOINT-LEDGER-01-CHECKPOINT.md` created | VERIFIED — this file |

---

## Non-Goals Confirmed

- No broad checkpoint redesign
- No new undo system
- No auth-module changes
- No frontend UX changes
- No billing/quota table fixes
- No unrelated api-gateway/container-manager refactor
- No entity/repository/service changes
- No container-manager source changes
- No architectural boundaries crossed

---

## Invariants Preserved

- `npx tsc --noEmit` 0-error baseline maintained
- `npm run build` passes
- All 47 checkpoint-scope tests pass (api-gateway)
- All 35 container-manager tests pass
- Global `ValidationPipe` bootstrap behavior unchanged — decorators align to existing pipe configuration
- No pre-existing controller or service logic modified
- No repository insert logic changed — fix is at DTO decoration layer only

---

## Live Re-Test Recommendation

Against a running stack, verify end-to-end:

1. Trigger a workspace git checkpoint via container-manager (e.g., via a file-write chat action)
2. Confirm container-manager logs no `500` error for `POST /api/internal/git-checkpoints`
3. Query `git_checkpoints` table — `session_id` must be non-null
4. Confirm workspace revert still succeeds after the fix

This smoke check was not executed during implementation (no live stack available in this environment).

---

## Carry-Forwards / Known Limitations

1. **Live-stack smoke SKIPPED** — end-to-end verification against a running app/session should be executed before production deployment.
2. **Container-manager integration test** — no container-manager-side integration test was added (out of scope for this fix). A future task may add one.

---

## Reference

- `TASKS.md` → CHECKPOINT-LEDGER-01
- `TASKS_BACKLOG_FULL.md` → CHECKPOINT-LEDGER-01
- `services/api-gateway/src/git-checkpoints/internal-git-checkpoint.controller.ts`
- `services/api-gateway/src/git-checkpoints/internal-git-checkpoint.controller.spec.ts`
