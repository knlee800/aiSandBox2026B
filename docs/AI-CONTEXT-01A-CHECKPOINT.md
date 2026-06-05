# AI-CONTEXT-01A Checkpoint — Global AI Instructions Backend Foundation

**Date:** 2026-06-05
**Status:** COMPLETE and LOCKED
**Task ID:** AI-CONTEXT-01A
**Family:** AI-CONTEXT
**Priority:** High
**Nature:** BACKEND / DATABASE / AI CONTEXT FOUNDATION
**Risk:** Medium
**Depends on:** UX-PV-02B (COMPLETE and LOCKED)

---

## Summary

Created the backend database/API foundation for user-scoped Global AI Instructions. This slice covers the migration, TypeORM entity, DTO validation, service, auth-guarded controller, NestJS module wiring, and targeted unit tests. No prompt injection, no frontend UI, and no project-scoped or repo-docs instruction layers were included.

---

## Exact Files Changed

**New files:**
- `services/api-gateway/src/migrations/1771800000000-CreateUserAiInstructionsTable.ts`
- `services/api-gateway/src/entities/user-ai-instructions.entity.ts`
- `services/api-gateway/src/user-ai-instructions/dto/upsert-user-ai-instructions.dto.ts`
- `services/api-gateway/src/user-ai-instructions/user-ai-instructions.service.ts`
- `services/api-gateway/src/user-ai-instructions/user-ai-instructions.controller.ts`
- `services/api-gateway/src/user-ai-instructions/user-ai-instructions.module.ts`
- `services/api-gateway/src/user-ai-instructions/user-ai-instructions.service.spec.ts`
- `services/api-gateway/src/user-ai-instructions/user-ai-instructions.controller.spec.ts`

**Modified files:**
- `services/api-gateway/src/entities/index.ts` — added `UserAiInstructions` export
- `services/api-gateway/src/app.module.ts` — registered `UserAiInstructionsModule`

**Governance files (registration + consolidation only):**
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/AI-CONTEXT-01A-CHECKPOINT.md` (this file)

---

## Migration / Entity / API Summary

### Migration
File: `1771800000000-CreateUserAiInstructionsTable.ts`

Creates table `user_ai_instructions`:
- `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
- `global_instructions` text NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- Index: `idx_user_ai_instructions_user_id`

### Entity
`UserAiInstructions` TypeORM entity matches migration schema.
One-to-one with `User` via `user_id` unique FK, `onDelete: 'CASCADE'`.

### DTO
`UpsertUserAiInstructionsDto`
- `globalInstructions?: string | null`
- Validators: `@IsOptional()`, `@IsString()`, `@MaxLength(4000)`

### Service — `UserAiInstructionsService`
- `getByUserId(userId: string): Promise<string | null>` — returns instructions or null if no record
- `upsert(userId: string, globalInstructions: string | null): Promise<string | null>` — creates or updates row

### Controller — `UserAiInstructionsController`
Route base: `user/ai-instructions` (resolved as `GET /api/user/ai-instructions`, `PUT /api/user/ai-instructions` with global `api` prefix)

- `GET /api/user/ai-instructions` — returns `{ globalInstructions: string | null }` for authenticated user
- `PUT /api/user/ai-instructions` — body `{ globalInstructions?: string | null }`, returns `{ globalInstructions: string | null }`
- Auth guard: `SessionCookieGuard` applied at controller level, user ID extracted via `req.user.userId`
- Max 4000 chars enforced by global `ValidationPipe` + DTO `@MaxLength(4000)`

### Module
`UserAiInstructionsModule` — imports `TypeOrmModule.forFeature([UserAiInstructions])` and `AuthModule`, provides `UserAiInstructionsService`, exports `UserAiInstructionsService`.

---

## Tests Added

File: `user-ai-instructions.service.spec.ts` (3 tests)
- `getByUserId` returns null when no record exists
- `upsert` creates a new row when no record exists
- `upsert` updates an existing row

File: `user-ai-instructions.controller.spec.ts` (4 tests)
- Guard metadata check: `SessionCookieGuard` applied at controller level
- GET maps service result to `{ globalInstructions }` response shape
- PUT maps service result to `{ globalInstructions }` response shape
- DTO `@MaxLength(4000)` rejects `globalInstructions` over 4000 chars

---

## Validation Results

| Check | Result |
|---|---|
| `npm test -- user-ai-instructions` | **PASS** — 2 suites, 7 tests, 0 failures |
| `npm run build` | **PASS** |
| ReadLints on touched files | **PASS** — no linter errors |
| Full `npm test` | **PARTIAL** — see exception below |

### Full-suite validation exception

Full `npm test` attempted three times with `REDIS_URL` and `DATABASE_URL` resolved from the running Docker containers (varying host/IP strategies). All three runs produced the same pre-existing failure pattern:

- `TypeOrmModule Unable to connect to the database. Retrying...` — `ECONNREFUSED 127.0.0.1:5432` and `Connection terminated unexpectedly` in integration specs that require a live DB connection to the Jest process
- `smoke.integration.spec.ts` — `beforeAll` exceeds 5s hook timeout (app init fails before any test runs)
- `AIExecutionController` and orphan-reconciliation integration suites — `AggregateError` from DB connection

**Classification: pre-existing environment/connectivity constraint — not caused by AI-CONTEXT-01A.**

Evidence:
- The 9 failing suites and their failure patterns are identical across three separate runs (before, during, and after this task).
- `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` explicitly documents this blocker: "The api-gateway's full `npm test` is not expected to pass without a running Redis instance."
- `docs/WORKSPACE-DEFAULT-01-CHECKPOINT.md` records the same exception for a prior unrelated task: "pre-existing unrelated failures: REDIS_URL not set, integration test timeouts in env-dependent suites not part of this task".
- `docs/AUTH-MODULE-02B-CHECKPOINT.md` documents: "Full api-gateway `npm test` smoke suite — pre-existing failures related to REDIS_URL / test environment setup. Not caused by this task."
- `jest.config.js` has no test env bootstrap. Integration suites that boot the full `AppModule` in-process require direct TCP access to PostgreSQL and Redis, which is not available from this host shell context (Docker network not bridged to host).
- New tests (`user-ai-instructions.service.spec.ts`, `user-ai-instructions.controller.spec.ts`) are fully isolated unit tests and pass without any external dependencies.

---

## Non-Goals Confirmed

- No frontend UI changes
- No AI prompt assembly changes
- No project-scoped instructions
- No repo docs registry
- No governance implementation changes beyond this consolidation

---

## Next Recommended Step

`AI-CONTEXT-01B` — inject `global_instructions` from `UserAiInstructionsService` into the AI prompt assembly layer, or register the next AI-CONTEXT family slice as approved.
