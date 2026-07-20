# AGENT-PLATFORM-CREATE-01A — Step 3 Implementation Report

**Task ID:** AGENT-PLATFORM-CREATE-01A
**Step:** 3 — Implementation / Backend Persistence + Validation
**Status:** COMPLETE (implementation + validation)
**Date:** 2026-07-20
**Nature:** Backend/API Gateway implementation — no frontend, no ai-service, no container-manager

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-CREATE-01A |
| Title | Create Agent Backend Minimal Persistence |
| Family | AGENT PLATFORM / AGENT CREATION / BACKEND PERSISTENCE |
| Step | 3 — Implementation |
| Predecessor Step | Step 2 — Stage-Start (COMPLETE — `docs/AGENT-PLATFORM-CREATE-01A-STAGE-START.md`) |
| Predecessor Task | AGENT-PLATFORM-RPG-03B — COMPLETE and LOCKED — 2026-07-20 |

---

## 2. Implementation Summary

Implemented the minimal DB-backed created-agent persistence foundation:

- `UserAgent` TypeORM entity with UUID PK, `userId` FK → `users(id)`, soft-delete via `@DeleteDateColumn`
- Reversible TypeORM migration creating `user_agents` table with FK, indexes, and partial composite index
- `CreateAgentDto` with class-validator validation
- `UserAgentController` with 3 endpoints (`POST`, `GET` list, `GET :id`), all guarded by `SessionCookieGuard`
- `UserAgentService` with create, list, and findOne methods, all scoped by `userId`
- `UserAgentModule` registered in `AppModule`
- 30 passing tests covering guard metadata, CRUD, validation, cross-user isolation, HTTP contract, and security

---

## 3. Files Inspected

| # | File | Method |
|---|------|--------|
| 1 | `TASKS.md` | Read (attempted — too large, read context from roadmap) |
| 2 | `TASKS_BACKLOG_FULL.md` | Read (attempted — too large, read context from roadmap) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Read — full |
| 4 | `docs/AGENT-PLATFORM-CREATE-01A-STAGE-START.md` | Read — full |
| 5 | `services/api-gateway/src/entities/user-ai-instructions.entity.ts` | Read — full |
| 6 | `services/api-gateway/src/entities/index.ts` | Read — full |
| 7 | `services/api-gateway/src/entities/subscription.entity.ts` | Read — full |
| 8 | `services/api-gateway/src/app.module.ts` | Read — full |
| 9 | `services/api-gateway/src/user-ai-instructions/user-ai-instructions.module.ts` | Read — full |
| 10 | `services/api-gateway/src/user-ai-instructions/user-ai-instructions.controller.ts` | Read — full |
| 11 | `services/api-gateway/src/user-ai-instructions/user-ai-instructions.service.ts` | Read — full |
| 12 | `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts` | Read — full |
| 13 | `services/api-gateway/src/billing/__tests__/billing-read.controller.spec.ts` | Read — full |
| 14 | `services/api-gateway/src/auth/session-cookie.guard.ts` | Read — full |

No `.env`, `.env.local`, secret, credential, key, certificate, or token files were opened.

---

## 4. Files Created

| # | Path | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/entities/user-agent.entity.ts` | UserAgent TypeORM entity |
| 2 | `services/api-gateway/src/user-agent/user-agent.module.ts` | NestJS module |
| 3 | `services/api-gateway/src/user-agent/user-agent.controller.ts` | HTTP controller (3 endpoints) |
| 4 | `services/api-gateway/src/user-agent/user-agent.service.ts` | Business logic service |
| 5 | `services/api-gateway/src/user-agent/dto/create-agent.dto.ts` | Create request DTO |
| 6 | `services/api-gateway/src/migrations/1772500000000-CreateUserAgentsTable.ts` | Database migration |
| 7 | `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts` | Controller/integration tests |

Total: 7 files created.

---

## 5. Files Modified

| # | Path | Change |
|---|------|--------|
| 8 | `services/api-gateway/src/entities/index.ts` | Added `UserAgent` export + `USER_AGENT_STATUSES` constant + `UserAgentStatus` type export |
| 9 | `services/api-gateway/src/app.module.ts` | Added `UserAgentModule` import + registration in imports array |

Total: 2 files modified.

---

## 6. Entity Implementation

```typescript
@Entity('user_agents')
export class UserAgent {
  @PrimaryGeneratedColumn('uuid')    id: string;
  @Column({ type: 'uuid', name: 'user_id' })    userId: string;
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })    user: User;
  @Column({ type: 'varchar', length: 100 })    name: string;
  @Column({ type: 'varchar', length: 200 })    role: string;
  @Column({ type: 'text' })    description: string;
  @Column({ type: 'varchar', length: 20, default: 'active' })    status: string;
  @Column({ type: 'varchar', length: 4, nullable: true })    initials: string | null;
  @CreateDateColumn({ name: 'created_at' })    createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })    updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' })    deletedAt: Date | null;
}
```

Status constants: `USER_AGENT_STATUSES = ['active', 'draft', 'disabled'] as const`
Type: `UserAgentStatus = (typeof USER_AGENT_STATUSES)[number]`

Follows `UserAiInstructions` entity pattern: user-scoped, `ManyToOne` → `User`, UUID PK, snake_case columns.

---

## 7. Migration Implementation

File: `src/migrations/1772500000000-CreateUserAgentsTable.ts`
Class: `CreateUserAgentsTable1772500000000`
Style: Raw SQL via `queryRunner.query()` — matches existing migration pattern.

**up():**
- Creates `user_agents` table with UUID PK (`gen_random_uuid()`), FK → `users(id) ON DELETE CASCADE`
- `idx_user_agents_user_id` — index on `user_id`
- `idx_user_agents_status` — index on `status`
- `idx_user_agents_user_id_status` — partial composite index `(user_id, status) WHERE deleted_at IS NULL`

**down():**
- Drops indexes in reverse order, then drops table

Reversible: YES.
Executed against live DB: NO — migration file created only.

---

## 8. DTO Validation

| Field | Type | Required | Min | Max | Additional |
|-------|------|----------|-----|-----|------------|
| `name` | string | YES | 1 | 100 | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)` |
| `role` | string | YES | 1 | 200 | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `description` | string | YES | 1 | 2000 | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(2000)` |
| `status` | string | NO | — | — | `@IsOptional()`, `@IsIn(USER_AGENT_STATUSES)` |
| `initials` | string | NO | 1 | 4 | `@IsOptional()`, `@IsString()`, `@MinLength(1)`, `@MaxLength(4)`, `@Matches(/^[A-Za-z0-9]+$/)` |

Fields NOT accepted: `id`, `userId`, `createdAt`, `updatedAt`, `deletedAt`.

ValidationPipe with `whitelist: true` strips unknown fields.

---

## 9. Controller/Service/Module Implementation

### Controller: `UserAgentController`

- Route prefix: `agents` (→ `/api/agents` under global prefix)
- Class-level `@UseGuards(SessionCookieGuard)`
- `POST /api/agents` → `create()` — 201 Created
- `GET /api/agents` → `list()` — 200 OK, returns `{ agents: AgentResponseDto[] }`
- `GET /api/agents/:id` → `getOne()` — 200 OK or 404

### Response shape (`AgentResponseDto`):

`{ id, name, role, description, status, initials, createdAt, updatedAt }`

Excludes: `userId`, `deletedAt`, `user` relation.

### Service: `UserAgentService`

- `create(userId, dto)` — creates agent, auto-computes initials from name if not provided
- `listByUserId(userId)` — returns user's agents ordered by `createdAt DESC`
- `findOneByIdAndUserId(id, userId)` — returns single agent scoped to user

### Module: `UserAgentModule`

- Imports: `TypeOrmModule.forFeature([UserAgent])`, `AuthModule`
- Exports: `UserAgentService`

---

## 10. Ownership / Scoping Enforcement

- **Create:** `userId` comes from `req.user.userId` (session). Never from request body. `whitelist: true` strips any body-supplied `userId`.
- **List:** Service queries with `{ userId }` — TypeORM soft-delete auto-filters `deletedAt IS NULL`.
- **Get:** Service queries with `{ id, userId }` — returns null if wrong user. Controller throws 404.
- **Cross-user get:** Returns 404 (not 403) — prevents ID enumeration.

---

## 11. Security Notes

- All endpoints guarded by `SessionCookieGuard` at class level.
- `userId` extracted from validated session (`req.user.userId`).
- Client-supplied `userId` stripped by `whitelist: true` ValidationPipe.
- Cross-user access returns 404 (not 403).
- Response excludes `userId`, `deletedAt`, `user` relation.
- No `toolPermissions`, `knowledgeScopes`, `skills`, `referralRules`, `approvalRules` fields.
- No AI provider calls.
- No billing/payment/Stripe involvement.
- No secrets stored or returned.
- No internal tool permissions exposed.

---

## 12. Tests Added

File: `src/user-agent/__tests__/user-agent.controller.spec.ts`

| # | Category | Test | Result |
|---|----------|------|--------|
| 1 | Guard metadata | SessionCookieGuard at controller level | PASS |
| 2 | Guard metadata | NOT ApiKeyAuthGuard/InternalServiceAuthGuard | PASS |
| 3 | Create | Valid input returns response shape | PASS |
| 4 | Create | userId from session, not body | PASS |
| 5 | Create | Session userId used regardless of body content | PASS |
| 6 | Create | Client-supplied initials accepted | PASS |
| 7 | List | Empty array when no agents | PASS |
| 8 | List | Only authenticated user's agents | PASS |
| 9 | List | Response shape excludes userId/deletedAt | PASS |
| 10 | Get | Returns agent when found | PASS |
| 11 | Get | 404 when not found | PASS |
| 12 | Get | 404 for cross-user (not 403) | PASS |
| 13 | Isolation | User B list empty | PASS |
| 14 | Isolation | User B cannot get User A's agent | PASS |
| 15 | Isolation | Response excludes userId/deletedAt | PASS |
| 16 | HTTP | POST 201 correct shape | PASS |
| 17 | HTTP | POST 400 missing name | PASS |
| 18 | HTTP | POST 400 name > 100 chars | PASS |
| 19 | HTTP | POST 400 missing role | PASS |
| 20 | HTTP | POST 400 missing description | PASS |
| 21 | HTTP | POST 400 invalid status | PASS |
| 22 | HTTP | POST strips userId from body (whitelist) | PASS |
| 23 | HTTP | GET list 200 with agents array | PASS |
| 24 | HTTP | GET list 200 empty array | PASS |
| 25 | HTTP | GET :id 200 when found | PASS |
| 26 | HTTP | GET :id 404 when not found | PASS |
| 27 | HTTP | 401 unauthenticated | PASS |
| 28 | HTTP | Response shape matches contract (no extra fields) | PASS |
| 29 | HTTP | No internal/secret fields in response | PASS |
| 30 | No-call | No billing/AI/external service calls | PASS |

Total: 30 tests, 30 passed, 0 failed.

---

## 13. Validation Commands

```powershell
# 1. Targeted tests
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- user-agent

# 2. Full API Gateway test suite
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test

# 3. TypeScript type check
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit

# 4. Build check
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build

# 5. Linter check (ReadLints on all 9 touched files)
```

---

## 14. Validation Results

| # | Command | Exit Code | Result |
|---|---------|-----------|--------|
| 1 | `npm test -- user-agent` | 0 | 1 suite, 30 tests, 30 passed |
| 2 | `npm test` (full suite) | 1 | 146 suites passed, 10 failed (pre-existing integration failures requiring DB/runtime), 1 skipped. 1826 tests passed, 76 failed (all pre-existing). User-agent suite: 30/30 PASS. |
| 3 | `npx tsc --noEmit` | 0 | No errors |
| 4 | `npm run build` | 0 | Clean build |
| 5 | ReadLints (8 files) | — | 0 linter errors |

Pre-existing test failures (10 suites, 76 tests) are integration/smoke tests requiring running Docker/PostgreSQL/API Gateway runtime — not related to this change:
- `users.integration.spec.ts`
- `execution-safety.integration.spec.ts`
- `ai-execution-idempotency.integration.spec.ts`
- `ai-execution-deterministic-replay.integration.spec.ts`
- `ai-execution-two-phase.integration.spec.ts`
- `ai-execution-orphan-reconciliation.integration.spec.ts`
- `ai-execution-replay-quota-bypass.integration.spec.ts`
- `ai-execution.get-execution-file-actions.spec.ts`
- `ai-execution.provider-selection.spec.ts`
- `smoke.integration.spec.ts`

---

## 15. Deferred Live DB / Migration Note

Migration file `1772500000000-CreateUserAgentsTable.ts` has been created but NOT executed against any database.

Execution requires:
1. Docker Desktop running
2. PostgreSQL container running (`aisandbox-postgres`)
3. `npm run migration:run` from `services/api-gateway`

Migration execution is deferred to a future runtime validation task or manual Keith step.

---

## 16. Non-Goals Preserved

All 20 non-goals from the stage-start document (Section 19) remain preserved:
- No update/delete endpoints
- No tool permissions, knowledge, skills, referral, approval fields
- No agent execution or dispatch
- No AI provider integration
- No model profile configuration
- No avatar upload
- No billing/credit integration
- No frontend Create Agent UI
- No static registry mutation
- No dynamic registry merge
- No translation/i18n files
- No platform dashboard UI changes
- No Docker/container changes
- No ai-service changes
- No container-manager changes

---

## 17. Safety Confirmations

- [x] All endpoints guarded by `SessionCookieGuard`
- [x] Owner/user id comes from authenticated request only
- [x] Create ignores/rejects client owner/user id
- [x] List is scoped by current user id
- [x] Get is scoped by current user id
- [x] Cross-user get returns 404
- [x] Response does not expose internal tool permissions
- [x] No AI provider call
- [x] No billing/payment/Stripe behavior
- [x] No static registry mutation
- [x] No secrets opened
- [x] No frontend/Create Agent UI work
- [x] No ai-service/container-manager changes
- [x] No package/dependency/environment/Docker files changed
- [x] No runtime, Docker, DB, browser, API call, provider, payment, Stripe CLI, webhook, git commit, or git push occurred
- [x] No subagents used

---

## 18. Exact Next Action

**Proceed to AGENT-PLATFORM-CREATE-01A Step 4 — Consolidation.**

Step 4 should:

1. Create checkpoint document: `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md`
2. Update `TASKS.md` — mark Step 3 COMPLETE, task COMPLETE and LOCKED
3. Update `TASKS_BACKLOG_FULL.md` — mirror status
4. Update `docs/AINOW-EXECUTION-ROADMAP.md` — record completion
5. Not modify source/test files
6. Not start runtime, Docker, DB, browser, or provider
7. Recommend next task: AGENT-PLATFORM-CREATE-01B (Create Agent MVP UI — frontend)

---

## Path Difference Note

The user's prompt suggested files under `src/agent-platform/` but the stage-start document (Section 20) specifies `src/user-agent/`. Per instructions ("follow the stage-start doc and report the difference"), implementation follows the stage-start doc's `src/user-agent/` path.
