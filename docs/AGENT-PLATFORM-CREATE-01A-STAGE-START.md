# AGENT-PLATFORM-CREATE-01A — Stage-Start / Persistence Design / API Contract Plan

**Task ID:** AGENT-PLATFORM-CREATE-01A
**Step:** 2 — Stage-Start / Persistence Design / API Contract Plan
**Status:** COMPLETE (design/planning only — no implementation)
**Date:** 2026-07-20
**Nature:** Read-only source inspection + design document creation

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-CREATE-01A |
| Title | Create Agent Backend Minimal Persistence |
| Family | AGENT PLATFORM / AGENT CREATION / BACKEND PERSISTENCE |
| Priority | CRITICAL |
| Nature | HIGH-RISK BACKEND PERSISTENCE — 4-step workflow |
| Risk | HIGH |
| Step 1 | COMPLETE — Registration — 2026-07-20 |
| Step 2 | This document — Stage-Start / Persistence Design / API Contract Plan — 2026-07-20 |
| Keith Approval | "go" — 2026-07-20 |
| Predecessor | AGENT-PLATFORM-RPG-03B — COMPLETE and LOCKED — 2026-07-20 |
| Planning Authority | `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` Section 15 / Section 22 Slice 3 |

---

## 2. Stage-Start Purpose

This document answers all 25 stage-start questions, defines the exact API contract, entity model, migration strategy, test strategy, and Step 3 file plan for minimal DB-backed user-created agent persistence.

This is design only. No implementation, no migrations, no entities, no source, no tests, no runtime, no Docker, no DB, no browser, no API, no provider calls.

---

## 3. Files Inspected

### Governance / Checkpoint Documents

| # | File | Method |
|---|------|--------|
| 1 | `TASKS.md` | Read — sections extracted (file too large for single read) |
| 2 | `TASKS_BACKLOG_FULL.md` | Read — sections extracted (file too large for single read) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Read — full |
| 4 | `docs/AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md` | Read — full |
| 5 | `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` | Read — full |
| 6 | `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md` | Read — full |
| 7 | `docs/AGENT-PLATFORM-RPG-03B-CHECKPOINT.md` | Read — full |
| 8 | `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | Read — full |

### API Gateway Source Inspection (Read-Only)

| # | File / Pattern | Method |
|---|----------------|--------|
| 9 | `services/api-gateway/package.json` | Read — full |
| 10 | `services/api-gateway/src/entities/user.entity.ts` | Read — full |
| 11 | `services/api-gateway/src/entities/index.ts` | Read — full |
| 12 | `services/api-gateway/src/entities/user-ai-instructions.entity.ts` | Read — full |
| 13 | `services/api-gateway/src/entities/subscription.entity.ts` | Read — full |
| 14 | `services/api-gateway/src/entities/credit-grant.entity.ts` | Read — full |
| 15 | `services/api-gateway/src/auth/auth.controller.ts` | Read — full |
| 16 | `services/api-gateway/src/auth/auth.service.ts` | Read — full |
| 17 | `services/api-gateway/src/auth/session-cookie.guard.ts` | Read — full |
| 18 | `services/api-gateway/src/auth/dto/auth.dto.ts` | Read — full |
| 19 | `services/api-gateway/src/app.module.ts` | Read — full |
| 20 | `services/api-gateway/src/config/database.config.ts` | Read — full |
| 21 | `services/api-gateway/data-source.ts` | Read — full |
| 22 | `services/api-gateway/src/user-ai-instructions/user-ai-instructions.controller.ts` | Read — full |
| 23 | `services/api-gateway/src/user-ai-instructions/user-ai-instructions.service.ts` | Read — full |
| 24 | `services/api-gateway/src/user-ai-instructions/user-ai-instructions.module.ts` | Read — full |
| 25 | `services/api-gateway/src/billing/__tests__/billing-read.controller.spec.ts` | Read — full |
| 26 | `services/api-gateway/migrations/1770461376029-InitialSchema.ts` | Read — full |
| 27 | `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts` | Read — full |
| 28 | All `*.entity.ts` files — glob listing (25 entity files) | Glob |
| 29 | All `*.controller.ts` files — glob listing (38 controller files) | Glob |
| 30 | All `*.service.ts` files — glob listing (39 service files) | Glob |
| 31 | All `*.module.ts` files — glob listing (44 module files) | Glob |
| 32 | All `*.spec.ts` files — glob listing (156+ spec files) | Glob |
| 33 | All `src/migrations/*.ts` files — glob listing (24 migration files) | Glob |
| 34 | `services/api-gateway/migrations/` — glob listing (5 files including legacy) | Glob |

No `.env`, `.env.local`, secret, credential, key, certificate, or token files were opened.

---

## 4. Existing API Gateway Architecture / Persistence Pattern

### Framework

- **Runtime:** NestJS 10.3.x
- **ORM:** TypeORM 0.3.28 via `@nestjs/typeorm` 11.0.0
- **Database:** PostgreSQL (`pg` 8.17.2)
- **Validation:** `class-validator` 0.14.1 + `class-transformer` 0.5.1
- **Test:** Jest 30.2.0 + `@nestjs/testing` 10.4.22 + supertest 7.2.2

### Entity Pattern

Entities reside in `services/api-gateway/src/entities/*.entity.ts`. The `databaseConfig()` auto-loads all files matching `src/**/*.entity{.ts,.js}`. Entities use:

- `@Entity('table_name')` — snake_case table name
- `@PrimaryGeneratedColumn('uuid')` — UUID primary key
- `@Column({ type, name, ... })` — explicit `name` mapping for snake_case DB columns
- `@CreateDateColumn({ name: 'created_at' })` — auto-set on insert
- `@UpdateDateColumn({ name: 'updated_at' })` — auto-set on update
- `@Index('idx_table_column')` — named indexes
- `@ManyToOne(() => User)` + `@JoinColumn({ name: 'user_id' })` — FK relations

Entity barrel export at `src/entities/index.ts`. Status constants use `as const` arrays with derived types (see `subscription.entity.ts`, `credit-grant.entity.ts`).

### Module Pattern

Each feature domain has its own folder under `src/` containing:

- `feature.module.ts` — NestJS module
- `feature.controller.ts` — HTTP controller
- `feature.service.ts` — business logic
- `dto/*.dto.ts` — request/response DTOs with `class-validator`
- `__tests__/feature.*.spec.ts` — Jest tests

Modules import `TypeOrmModule.forFeature([Entity])` and `AuthModule` when auth guard is needed. Modules are registered in `app.module.ts` imports array.

---

## 5. Existing Migration Pattern

### Location

Two migration directories exist:

1. **Legacy:** `services/api-gateway/migrations/` — 3 legacy migration files (timestamps 1770–1770)
2. **Active:** `services/api-gateway/src/migrations/` — 24 migration files (timestamps 1738–1772)

The `data-source.ts` CLI config reads from `src/migrations/*.{ts,js}`. **Step 3 must place the new migration in `src/migrations/`.**

### Naming Convention

```
{timestamp}-{DescriptivePascalCaseName}.ts
```

Examples:
- `1772100000000-CreateCreditBalanceAndDeductionTables.ts`
- `1772400000000-CreateCreditGrantsTable.ts`
- `1771800000000-CreateUserAiInstructionsTable.ts`

The class name appends the timestamp: `CreateUserAgentsTable{timestamp}`.

### Style

- Implements `MigrationInterface` with `up()` and `down()`
- Uses raw SQL via `queryRunner.query()` — not TypeORM schema builder
- Uses `gen_random_uuid()` for UUID defaults
- Uses `CURRENT_TIMESTAMP` or `NOW()` for timestamp defaults
- Includes `CREATE UNIQUE INDEX` / `CREATE INDEX` statements
- `down()` drops indexes first, then tables
- Both `up()` and `down()` are fully reversible

### Timestamp

The latest existing migration timestamp is `1772400000000`. Step 3 should use a timestamp > `1772400000000` — suggested: `1772500000000`.

---

## 6. Existing Auth / Session / Current-User Pattern

### Session Cookie Guard

`SessionCookieGuard` (at `src/auth/session-cookie.guard.ts`) is the primary authentication mechanism for user-facing routes:

1. Reads `aisandbox_session` cookie from request
2. Calls `AuthService.validateSessionToken()` to resolve the session to a `User` entity
3. Populates `request.user` with:
   ```typescript
   {
     userId: string;   // User.id (UUID)
     email: string;    // User.email
     role: string;     // User.role
     plan: string;     // User.planType
   }
   ```
4. Throws `UnauthorizedException` if session is invalid/expired

### How Controllers Access Current User

Controllers use `@UseGuards(SessionCookieGuard)` at class or method level, then access `req.user.userId`:

```typescript
@Controller('user/ai-instructions')
@UseGuards(SessionCookieGuard)
export class UserAiInstructionsController {
  @Get()
  async getGlobalInstructions(@Request() req) {
    const result = await this.service.getByUserId(req.user.userId);
    return { globalInstructions: result };
  }
}
```

### User ID Field

The `req.user.userId` value is `User.id` — a UUID string. This is the canonical owner identifier for user-scoped data.

---

## 7. Proposed `UserAgent` Entity Model

### Answer to Q3: What existing entity style should `UserAgent` follow?

`UserAgent` should follow the `UserAiInstructions` entity pattern (user-scoped, `ManyToOne` relation to `User`, UUID PK, snake_case column names, `CreateDateColumn`/`UpdateDateColumn`).

### Answer to Q5: What user ID / owner ID field should created agents reference?

`userId` — UUID type, FK → `users.id`. Matches `UserAiInstructions.userId`, `Subscription.userId`.

### Answer to Q6: Does an existing user/account entity exist? Relation style?

Yes — `User` entity at `src/entities/user.entity.ts`. Relation style: `@ManyToOne(() => User)` + `@JoinColumn({ name: 'user_id' })`, matching existing patterns in `UserAiInstructions`, `Subscription`.

### Answer to Q7: Exact minimal fields

```typescript
@Entity('user_agents')
export class UserAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_user_agents_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 200 })
  role: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 4, nullable: true })
  initials: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
```

---

## 8. Ownership / Scoping Design

### Answer to Q18: How will list/create/get enforce user ownership?

- **Create:** `userId` comes from `req.user.userId` (session). Never from request body.
- **List:** Service queries with `WHERE userId = :userId AND deletedAt IS NULL`.
- **Get by ID:** Service queries with `WHERE id = :id AND userId = :userId AND deletedAt IS NULL`. Returns 404 if not found (includes cases where the agent belongs to another user).

### Answer to Q19: How will tests prove users cannot access other users' agents?

Tests will:

1. Create a mock agent with `userId = 'user-A'`
2. Attempt `GET /api/agents/:id` with `req.user.userId = 'user-B'`
3. Assert 404 is returned (not 403 — per existing convention: `UserAiInstructions` and `BillingRead` return not-found/empty rather than forbidden for cross-user queries, preventing enumeration)

Additional tests:

4. Assert list endpoint only returns agents matching `req.user.userId`
5. Assert create endpoint sets `userId` from session, not from body
6. Assert body-supplied `userId` is ignored even if present

---

## 9. Status Model

### Answer to Q8: Exact status values

```typescript
export const USER_AGENT_STATUSES = ['active', 'draft', 'disabled'] as const;
export type UserAgentStatus = (typeof USER_AGENT_STATUSES)[number];
```

### Answer to Q9: Enum/string/union based on conventions?

**`as const` array + derived type** — matching `SUBSCRIPTION_STATUSES`, `CREDIT_GRANT_STATUSES`, `WEBHOOK_EVENT_STATUSES`. The DB column uses `varchar(20)`, not a Postgres `ENUM` type. This is consistent with the billing entity pattern.

### Status semantics

| Status | Meaning |
|--------|---------|
| `active` | Agent is visible and operational on dashboard |
| `draft` | Agent is saved but not visible on dashboard |
| `disabled` | Agent is explicitly deactivated by user |

Default status for newly created agents: `active`.

Note: The MVP-RESET plan suggested `coming_soon` as a status. However, `coming_soon` is a display-only status from the static registry; user-created agents should not have `coming_soon` status. The MVP CREATE-01B frontend can treat static registry `coming_soon` agents separately. Step 3 uses `active`, `draft`, `disabled` — which are the actionable user-controllable states.

---

## 10. Avatar / Initials Metadata Design

### Answer to Q11: What avatar/initials metadata should be persisted now?

`initials` — `varchar(4)`, nullable. Stores 1–4 uppercase letter initials derived from the agent name.

### Answer to Q12: What should be generated server-side vs supplied by client?

- **Server-generated:** `id`, `userId`, `createdAt`, `updatedAt`, `deletedAt`
- **Server-computed (default, overridable by client):** `initials` — if client does not supply, server computes from name (first letter of first two words, uppercased). If client supplies, server validates (1–4 chars, letters/digits only).
- **Client-supplied:** `name`, `role`, `description`, `status`

No avatar image upload in MVP. Initials-based display only. This matches the existing `AgentStationCard` frontend pattern.

---

## 11. Validation Rules

### Answer to Q10: Validation rules for name/role/description/status

| Field | Type | Required | Min | Max | Additional |
|-------|------|----------|-----|-----|------------|
| `name` | string | YES | 1 | 100 | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)` |
| `role` | string | YES | 1 | 200 | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `description` | string | YES | 1 | 2000 | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(2000)` |
| `status` | string | NO | — | — | `@IsOptional()`, `@IsIn(USER_AGENT_STATUSES)`, default `'active'` |
| `initials` | string | NO | 1 | 4 | `@IsOptional()`, `@IsString()`, `@MinLength(1)`, `@MaxLength(4)`, `@Matches(/^[A-Za-z0-9]+$/)` |

Note: `description` max length increased from 500 (in MVP-RESET plan) to 2000 — 500 chars is too restrictive for meaningful agent descriptions. TypeORM `text` column has no DB-level length limit; validation is DTO-level only.

Fields explicitly **NOT** accepted from client:

- `id` — server-generated UUID
- `userId` — from session only
- `createdAt`, `updatedAt`, `deletedAt` — server-managed

---

## 12. API Contract

### Answer to Q13: What API endpoints should be added?

### Answer to Q14: What route prefix should be used?

Route prefix: `agents` (under global `/api` prefix → `/api/agents`).

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/agents` | `SessionCookieGuard` | Create a new user-owned agent |
| `GET` | `/api/agents` | `SessionCookieGuard` | List current user's agents |
| `GET` | `/api/agents/:id` | `SessionCookieGuard` | Get one user-owned agent by ID |

No `PUT`, `PATCH`, or `DELETE` in this slice. Edit/delete deferred to future task.

### POST /api/agents — Create Agent

**Request:**

```json
{
  "name": "Research Assistant",
  "role": "Gathers and synthesizes information from multiple sources",
  "description": "A specialized agent that can search, read, and summarize documentation...",
  "status": "active",
  "initials": "RA"
}
```

`status` and `initials` are optional. Defaults: `status = "active"`, `initials = auto-computed`.

**Response (201 Created):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Research Assistant",
  "role": "Gathers and synthesizes information from multiple sources",
  "description": "A specialized agent that can search, read, and summarize documentation...",
  "status": "active",
  "initials": "RA",
  "createdAt": "2026-07-20T10:30:00.000Z",
  "updatedAt": "2026-07-20T10:30:00.000Z"
}
```

**Error responses:**

- `400` — Validation failed (missing required fields, length exceeded)
- `401` — Not authenticated

### GET /api/agents — List User's Agents

**Request:** No body. Session cookie required.

**Response (200 OK):**

```json
{
  "agents": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Research Assistant",
      "role": "Gathers and synthesizes information from multiple sources",
      "description": "A specialized agent that can search...",
      "status": "active",
      "initials": "RA",
      "createdAt": "2026-07-20T10:30:00.000Z",
      "updatedAt": "2026-07-20T10:30:00.000Z"
    }
  ]
}
```

Empty list returns `{ "agents": [] }`.

**Error responses:**

- `401` — Not authenticated

### GET /api/agents/:id — Get Single Agent

**Request:** Agent ID in URL path. Session cookie required.

**Response (200 OK):** Same shape as a single item from the list response.

**Error responses:**

- `401` — Not authenticated
- `404` — Agent not found (or belongs to another user — returns 404, not 403, to prevent enumeration)

---

## 13. DTO Design

### Answer to Q15: What DTOs should be added?

### CreateAgentDto

```typescript
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { USER_AGENT_STATUSES } from '../../entities/user-agent.entity';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsIn([...USER_AGENT_STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4)
  @Matches(/^[A-Za-z0-9]+$/)
  initials?: string;
}
```

### AgentResponseDto

Not a class-validator DTO but a TypeScript interface for response shape documentation:

```typescript
export interface AgentResponseDto {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  initials: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

Response explicitly **excludes**: `userId`, `deletedAt`, `user` relation object.

---

## 14. Controller / Service / Module Design

### Answer to Q16: What service methods should be added?

### Answer to Q17: What module/controller/service structure?

### Module: `UserAgentModule`

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([UserAgent]), AuthModule],
  controllers: [UserAgentController],
  providers: [UserAgentService],
  exports: [UserAgentService],
})
export class UserAgentModule {}
```

Registered in `app.module.ts` imports array.

### Controller: `UserAgentController`

```typescript
@Controller('agents')
@UseGuards(SessionCookieGuard)
export class UserAgentController {
  constructor(private readonly userAgentService: UserAgentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateAgentDto) { ... }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Request() req) { ... }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(@Request() req, @Param('id') id: string) { ... }
}
```

### Service: `UserAgentService`

```typescript
@Injectable()
export class UserAgentService {
  constructor(
    @InjectRepository(UserAgent)
    private readonly userAgentRepository: Repository<UserAgent>,
  ) {}

  async create(userId: string, dto: CreateAgentDto): Promise<UserAgent> { ... }
  async listByUserId(userId: string): Promise<UserAgent[]> { ... }
  async findOneByIdAndUserId(id: string, userId: string): Promise<UserAgent | null> { ... }
}
```

Service methods:

| Method | Purpose | Query Pattern |
|--------|---------|---------------|
| `create(userId, dto)` | Creates agent, computes initials if not provided, saves | `repository.create()` + `repository.save()` |
| `listByUserId(userId)` | Lists user's agents ordered by `createdAt DESC` | `repository.find({ where: { userId }, order: { createdAt: 'DESC' } })` |
| `findOneByIdAndUserId(id, userId)` | Gets single agent scoped to user | `repository.findOne({ where: { id, userId } })` |

TypeORM soft-delete: `@DeleteDateColumn` automatically adds `deletedAt IS NULL` to all `find` queries when using the default repository. No explicit soft-delete filter needed in service code.

---

## 15. Migration Strategy

### Migration File

```
src/migrations/1772500000000-CreateUserAgentsTable.ts
```

### SQL (up)

```sql
CREATE TABLE "user_agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "role" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "initials" VARCHAR(4) NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP NULL
);

CREATE INDEX "idx_user_agents_user_id" ON "user_agents" ("user_id");
CREATE INDEX "idx_user_agents_status" ON "user_agents" ("status");
CREATE INDEX "idx_user_agents_user_id_status" ON "user_agents" ("user_id", "status")
  WHERE "deleted_at" IS NULL;
```

### SQL (down)

```sql
DROP INDEX IF EXISTS "idx_user_agents_user_id_status";
DROP INDEX IF EXISTS "idx_user_agents_status";
DROP INDEX IF EXISTS "idx_user_agents_user_id";
DROP TABLE IF EXISTS "user_agents";
```

### Notes

- FK references `users(id)` with `ON DELETE CASCADE` — matches `UserAiInstructions` pattern
- No Postgres `ENUM` type — uses `VARCHAR(20)` for status
- Partial composite index `(user_id, status) WHERE deleted_at IS NULL` optimizes the most common query (list active user agents)
- `gen_random_uuid()` — matches `CreateCreditBalanceAndDeductionTables` pattern
- Reversible: `down()` drops all indexes and the table

---

## 16. Test Strategy

### Test File

```
src/user-agent/__tests__/user-agent.controller.spec.ts
```

### Test Categories

Following the `billing-read.controller.spec.ts` pattern:

#### Guard Metadata Tests

1. Controller uses `SessionCookieGuard` at class level
2. Controller does NOT use `ApiKeyAuthGuard` or `InternalServiceAuthGuard`

#### POST /api/agents — Create

3. Creates agent with valid input, returns 201 with response shape
4. Sets `userId` from session, NOT from request body
5. Ignores `userId` field if client sends it in body
6. Returns 400 for missing `name`
7. Returns 400 for name exceeding 100 chars
8. Returns 400 for missing `role`
9. Returns 400 for missing `description`
10. Returns 400 for invalid `status` value
11. Default status is `active` when not provided
12. Computes initials from name when not provided
13. Uses client-supplied initials when provided and valid

#### GET /api/agents — List

14. Returns empty array when user has no agents
15. Returns only agents belonging to authenticated user
16. Does NOT return soft-deleted agents
17. Returns agents ordered by `createdAt DESC`

#### GET /api/agents/:id — Get One

18. Returns agent when it exists and belongs to user
19. Returns 404 when agent does not exist
20. Returns 404 when agent belongs to another user (NOT 403)
21. Returns 404 when agent is soft-deleted

#### Cross-User Isolation (Critical Security)

22. User B cannot list User A's agents
23. User B cannot get User A's agent by ID
24. Response does not contain `userId` or `deletedAt` fields

#### HTTP Contract Tests

25. Unauthenticated request returns 401
26. Response shape matches documented contract (no extra fields)
27. Response does not contain internal/secret fields

#### No Provider Calls

28. No billing, payment, AI provider, or external service calls during agent CRUD

### Approximate test count: 25–30 tests in 1 spec file.

---

## 17. Static Registry + User-Created Merge Plan for CREATE-01B

### Answer to Q20: How will static system agents remain unaffected?

Static agents (`builder`, `chief-of-staff`, `product-strategy`, `technology-advisor`) live in the frontend-only `agent-registry.ts` file. They are NOT stored in the database. They are NOT returned by `/api/agents`.

The `user_agents` table contains ONLY user-created agents. No migration inserts static agents. No API endpoint returns static agents.

### Answer to Q21: How will CREATE-01B later merge static agents + user-created agents?

CREATE-01B (frontend) will:

1. Import static agents from `agent-registry.ts` (existing `listAgents()`)
2. Fetch user-created agents from `GET /api/agents`
3. Merge both arrays for dashboard display
4. Static agents use `nameKey`/`roleKey` translation keys for display
5. User-created agents use direct `name`/`role` strings
6. `AgentStationCard` will accept both data shapes (or a normalized shape)

The backend (CREATE-01A) does NOT need to know about static agents. The merge is a frontend concern.

---

## 18. Security Review

### Ownership / Scoping Enforcement

- All three endpoints require `SessionCookieGuard`
- `userId` is extracted from `req.user.userId` (populated by guard from validated session cookie)
- Service methods always include `userId` in query WHERE clause
- No endpoint accepts `userId` from request body/params

### Input Validation

- `CreateAgentDto` uses `class-validator` decorators
- All string fields have max length constraints
- `status` is validated against an explicit allowlist
- `initials` is validated with regex for alphanumeric only
- No HTML/script injection risk: agent name/role/description are plain text stored and returned as-is; XSS prevention is the frontend's responsibility (React auto-escapes)

### Auth / Session Dependency

- `UserAgentModule` imports `AuthModule` to make `SessionCookieGuard` available
- Session validation uses `AuthService.validateSessionToken()` — same as all other user-facing endpoints
- Cookie name: `aisandbox_session` — unchanged

### Forbidden Fields from Client

- `id` — ignored; server-generated
- `userId` — ignored; from session
- `createdAt`, `updatedAt`, `deletedAt` — ignored; server-managed

### Response Shape

Response includes: `id`, `name`, `role`, `description`, `status`, `initials`, `createdAt`, `updatedAt`.

Response excludes: `userId`, `deletedAt`, `user` (relation object).

### Error Behavior

| Scenario | HTTP Status | Body |
|----------|-------------|------|
| Not authenticated | 401 | `{ "message": "Authentication required" }` |
| Validation failed | 400 | `{ "message": [...], "error": "Bad Request" }` |
| Agent not found (or wrong user) | 404 | `{ "message": "Not Found" }` |

404 for cross-user access (not 403) to prevent ID enumeration.

### Tests for Cross-User Isolation

See Test Strategy Section 16 — tests 19, 20, 22, 23 explicitly verify cross-user isolation.

### No Exposure of Internal Tool Permissions

No `toolPermissions`, `knowledgeScopes`, `skills`, `referralRules`, `approvalRules` fields exist on the entity or in the response. These are deferred to future tasks.

### No Activation of Agent Tools / Knowledge / Skills / Referrals / Approvals

This slice is persistence-only. No agent execution, no tool dispatch, no knowledge retrieval, no referral, no approval flow.

### No AI Provider Calls

No import of AI adapter, queue service, or execution service. No BullMQ job creation. No token usage.

### No Billing / Payment / Stripe Involvement

No import of billing modules. No credit check. No deduction. No Stripe.

### No Secrets

No API keys, tokens, or provider credentials stored in or returned from agent records.

---

## 19. Non-Goals Preserved

The following remain explicitly out of scope for AGENT-PLATFORM-CREATE-01A:

| # | Non-Goal |
|---|----------|
| 1 | Update/edit agent endpoint (`PUT /api/agents/:id`) |
| 2 | Delete agent endpoint (`DELETE /api/agents/:id`) |
| 3 | Tool permissions field or configuration |
| 4 | Knowledge scopes field or configuration |
| 5 | Skills field or configuration |
| 6 | Referral rules field or configuration |
| 7 | Approval rules field or configuration |
| 8 | Agent execution or dispatch |
| 9 | AI provider integration for agents |
| 10 | Model profile configuration |
| 11 | Agent image/sprite/avatar upload |
| 12 | Billing/credit integration |
| 13 | Frontend Create Agent UI (owned by CREATE-01B) |
| 14 | Static agent registry mutation |
| 15 | Dynamic registry merge (owned by CREATE-01B frontend) |
| 16 | Translation/i18n files (backend-only slice) |
| 17 | Platform dashboard UI changes |
| 18 | Docker/container changes |
| 19 | ai-service changes |
| 20 | container-manager changes |

---

## 20. Step 3 Exact File Plan

### Answer to Q23: Exact files to create/modify

### Files to CREATE

| # | Path | Purpose |
|---|------|---------|
| 1 | `services/api-gateway/src/entities/user-agent.entity.ts` | UserAgent TypeORM entity |
| 2 | `services/api-gateway/src/user-agent/user-agent.module.ts` | NestJS module |
| 3 | `services/api-gateway/src/user-agent/user-agent.controller.ts` | HTTP controller (3 endpoints) |
| 4 | `services/api-gateway/src/user-agent/user-agent.service.ts` | Business logic service |
| 5 | `services/api-gateway/src/user-agent/dto/create-agent.dto.ts` | Create request DTO |
| 6 | `services/api-gateway/src/migrations/1772500000000-CreateUserAgentsTable.ts` | Database migration |
| 7 | `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts` | Controller/integration tests |

### Files to MODIFY

| # | Path | Change |
|---|------|--------|
| 8 | `services/api-gateway/src/entities/index.ts` | Add `UserAgent` export + status constant/type exports |
| 9 | `services/api-gateway/src/app.module.ts` | Add `UserAgentModule` to imports |

### Total: 7 files created + 2 files modified = 9 files

This is within the < 10 file stop condition from the MVP-RESET plan.

---

## 21. Step 3 Validation Commands

### Answer to Q24: Exact validation commands

Do NOT run these now. These are defined for Step 3 execution.

```powershell
# 1. Run user-agent specific tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- user-agent

# 2. Run full API Gateway test suite
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test

# 3. TypeScript type check
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit

# 4. Build check
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build

# 5. Migration show (DEFERRED — requires Docker + PostgreSQL running)
# Only run if Docker/PostgreSQL are already running from prior tasks:
# Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run migration:show
```

Migration execution (`npm run migration:run`) is NOT part of Step 3 validation. Migration execution requires a running PostgreSQL instance and is deferred to a future runtime validation task or manual Keith step.

---

## 22. Split Decision

### Answer to Q25: Is Step 3 safe as one implementation slice?

**YES — Step 3 is safe as one implementation slice.**

Rationale:

1. **File count:** 9 files (7 new + 2 modified) — within the < 10 stop condition
2. **Scope:** Single entity, single module, single controller, single migration — no cross-cutting changes
3. **Risk:** The only modified existing files are `entities/index.ts` (add export) and `app.module.ts` (add import) — both are trivial, low-risk barrel/wiring changes
4. **No runtime dependency:** Tests use mocked repositories (same as billing-read tests). No Docker/DB required for test execution.
5. **No frontend changes:** Backend-only slice. No translation files, no React components, no visual changes.
6. **Pattern precedent:** Similar slices (UserAiInstructions, BillingRead) were implemented in single bounded slices successfully.

**No split required.**

---

## 23. Risks and Stop Conditions

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| TypeORM auto-load picks up entity without migration → schema sync error at runtime | LOW | `synchronize: false` prevents auto-sync; migration must be run manually |
| `gen_random_uuid()` not available on PostgreSQL < 13 | LOW | Project uses pg 8.17.2 driver; PostgreSQL 13+ assumed per prior migrations |
| `class-validator` ValidationPipe not globally enabled | LOW | Check `main.ts` or use explicit `@UsePipes()` — prior controllers work with class-validator, so global pipe is likely enabled |
| Entity auto-loading path pattern mismatch | VERY LOW | Entity is placed in `src/entities/` matching `src/**/*.entity{.ts,.js}` glob |
| Conflict with existing `/api/agents` route | VERY LOW | Searched all controllers — no existing `agents` route prefix found |

### Stop Conditions

Stop Step 3 and escalate if:

1. `class-validator` ValidationPipe is not globally enabled and manual wiring is needed
2. Global prefix configuration is different from expected `/api`
3. Another controller already uses the `agents` route prefix
4. `SessionCookieGuard` requires `AuthModule` import in a way that creates a circular dependency
5. Entity auto-loading does not work for the new entity file
6. More than 10 files need modification
7. Any change to locked tasks, ai-service, container-manager, or frontend is required
8. Migration conflicts with an existing table or index name

---

## 24. Safety Confirmations

- [x] No source files were modified during this planning pass.
- [x] No test files were modified.
- [x] No translation files were modified.
- [x] No package files were modified.
- [x] No migration/entity/schema files were modified.
- [x] No environment files were opened.
- [x] No Docker commands were run.
- [x] No database was queried or mutated.
- [x] No runtime was started.
- [x] No browser was opened.
- [x] No API calls were made.
- [x] No build or test commands were run.
- [x] No git commit or push was performed.
- [x] No subagents were used.
- [x] No secret-bearing environment file was opened.
- [x] TASKS.md was not modified.
- [x] TASKS_BACKLOG_FULL.md was not modified.
- [x] docs/AINOW-EXECUTION-ROADMAP.md was not modified.
- [x] All locked tasks remain locked and unmodified.
- [x] Only one file was created: this stage-start document.

---

## 25. CREATE-01B Handoff Requirements

### What frontend Create Agent UI will need later

| # | Item | Detail |
|---|------|--------|
| 1 | API route: create | `POST /api/agents` |
| 2 | API route: list | `GET /api/agents` |
| 3 | API route: get | `GET /api/agents/:id` |
| 4 | Request body shape | `{ name, role, description, status?, initials? }` |
| 5 | Response body shape | `{ id, name, role, description, status, initials, createdAt, updatedAt }` |
| 6 | List shape | `{ agents: AgentResponseDto[] }` |
| 7 | Status display values | `active`, `draft`, `disabled` |
| 8 | Avatar/initials behavior | `initials` field — 1–4 chars; auto-computed from name if not supplied |
| 9 | Validation error response | 400 with `{ message: string[], error: "Bad Request" }` |
| 10 | Auth error response | 401 with `{ message: "Authentication required" }` |
| 11 | No advanced config fields | No tool permissions, knowledge, skills, referral, approval fields in request or response |
| 12 | Cookie auth | Uses existing `aisandbox_session` cookie — no special auth setup needed |
| 13 | Static + user merge | Frontend merges `listAgents()` (static) + `GET /api/agents` (user-created) |
| 14 | Empty state | `GET /api/agents` returns `{ agents: [] }` when no user agents exist |

---

## 26. Exact Next Action

**Proceed to AGENT-PLATFORM-CREATE-01A Step 3 — Implementation.**

Step 3 should:

1. Create the 7 new files listed in Section 20
2. Modify the 2 existing files listed in Section 20
3. Follow entity/module/controller/service/DTO/migration patterns documented in this stage-start
4. Run validation commands from Section 21 (except migration:show which requires runtime)
5. Report exact test results
6. Not start runtime, Docker, DB, browser, or provider
7. Not modify frontend, ai-service, container-manager, translation, or governance files

After Step 3, Step 4 will consolidate: create checkpoint document, update TASKS.md, TASKS_BACKLOG_FULL.md, and AINOW-EXECUTION-ROADMAP.md.
