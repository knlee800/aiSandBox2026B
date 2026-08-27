# GATEWAY-TEST-FIXTURE-02 — Step 2R Replan — Hermetic Relational Test Architecture

**Task ID:** GATEWAY-TEST-FIXTURE-02
**Step:** 2R — Revised architecture after Step 2A STOP
**Date:** 2026-08-27
**Status:** STEP 2R COMPLETE — revised architecture frozen — implementation resume pending
**Base HEAD:** `0abc337abcd869c48f6592825ebb62d5481c4475` (`register hermetic gateway test repair`)
**Branch:** main
**Tree:** CLEAN (verified before and after probe)

---

## 1. Step 2A STOP evidence

### Failed architecture

```
DIRECT_PRODUCTION_ENTITY_SQLITE=REJECTED
```

Step 1 selected architecture: `TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', entities: [UsageRecord], synchronize: true, dropSchema: true })` — directly passing the production `UsageRecord` decorated class to a `better-sqlite3` DataSource.

### Observed failure

```
BETTER_SQLITE3_ARCHITECTURE_COMPATIBLE=NO

DataTypeNotSupportedError:
Data type "timestamp" in "UsageRecord.timestamp" is not supported by
"better-sqlite3" database.
```

The production `UsageRecord` entity (`services/api-gateway/src/entities/usage-record.entity.ts`) contains PostgreSQL-oriented TypeORM decorator metadata that `better-sqlite3` cannot validate:

| Production decorator | Type | SQLite support |
|---|---|---|
| `@PrimaryColumn({ type: 'uuid' })` | `uuid` | Not reached (stopped at timestamp) |
| `@Column({ type: 'uuid' })` (session_id, conversation_id) | `uuid` | Not reached |
| `@CreateDateColumn({ type: 'timestamp' })` | `timestamp` | **REJECTED** — DataTypeNotSupportedError |
| `@Column({ type: 'jsonb' })` | `jsonb` | Not reached |

Validation stopped at the first unsupported type (`timestamp`). The remaining PostgreSQL-specific types (`uuid`, `jsonb`) would also fail if reached.

### Production preservation

No production workaround was attempted. No production entity, decorator, column type, transformer, migration, or TypeORM configuration was modified.

```
PRODUCTION_SOURCE_CHANGE_REQUIRED=NO
```

---

## 2. Options evaluated

### OPTION A — Test-only EntitySchema + real SQLite repository + UsageRecord DI-token bridge

Create a test-only `EntitySchema` with `name: 'UsageRecord'` using SQLite-portable column types. Initialize a dedicated `better-sqlite3` `:memory:` DataSource with the EntitySchema (NOT the production decorated class). Obtain the real TypeORM repository from the hermetic DataSource. Supply that repository to production services under the `getRepositoryToken(UsageRecord)` = `'UsageRecordRepository'` Nest injection token.

| Criterion | Rating |
|---|---|
| Preserves relational semantics | Excellent — real CRUD, unique index, status UPDATE, JSON metadata |
| No external runtime | Excellent — in-process `better-sqlite3` already declared |
| Production change required | NO |
| Package/config change required | NO |
| Metadata collision risk | None — EntitySchema does not use decorators |
| DI token compatibility | Exact — EntitySchema `name: 'UsageRecord'` → token `'UsageRecordRepository'` |
| SQLite type compatibility | Verified — all columns use portable types |
| Deterministic | Excellent |
| Complexity | Medium (schema definition + manual DI bridge) |
| Reversibility | Excellent (test files only) |

**SELECTED.**

### OPTION B — Test-only decorated portable class + real SQLite repository + DI bridge

Create a `@Entity('usage_records')` decorated class with SQLite-portable types. Use `TypeOrmModule.forRoot({ entities: [TestUsageRecord] })`.

| Criterion | Rating |
|---|---|
| Metadata collision risk | **HIGH** — two decorated classes for same table. TypeORM may merge decorator metadata when both are imported in the same process |
| Token mismatch | `getRepositoryToken(TestUsageRecord)` ≠ `getRepositoryToken(UsageRecord)` — requires manual rebinding |
| Complexity | Higher than Option A with worse risk profile |

**REJECTED.** Decorator metadata merging risk is unacceptable.

### OPTION C — Existing in-repo hermetic helper

No TypeORM-sqlite helper exists in the repository. The existing `better-sqlite3` usage (`sqlite-database-path.spec.ts`) is raw `Database` without TypeORM. The opt-in Postgres DataSource (`credit-deduction-concurrency.integration.spec.ts`) is external-runtime (forbidden).

**NOT AVAILABLE.**

### OPTION D — Repository mocks / Map-based fake

Would weaken tests into duplicates of the already-passing `ai-execution-idempotency.integration.spec.ts`. Drops real unique constraint, row reuse, JSON metadata persistence, pending 409 against real rows.

**REJECTED.** Class 2 exists specifically because these invariants must exercise real relational persistence.

### OPTION E — External/local PostgreSQL

```
REJECT for this task. Pilot gate is explicitly non-live and runtime-free.
```

---

## 3. Temporary architecture probe

### Probe performed

```
TEMPORARY_PROBE_PERFORMED=YES
PROBE_LOCATION=C:\Users\knlee\AppData\Local\Temp\gateway-test-fixture-02-probe.js
PROBE_CLEANUP_VERIFIED=YES (file deleted, git status --short empty, git diff --check clean)
```

### Probe results

```
schemaInit               = PASS
createSave               = PASS
findOne                  = PASS
update                   = PASS
jsonRoundTrip            = PASS
createDateColumn         = PASS (type: object [Date], value: proper Date)
partialUniqueAllows      = PASS (different requestId pairs accepted)
partialUniqueRejects     = PASS (SqliteError: UNIQUE constraint failed)
nullRequestIdDuplicates  = PASS (multiple null-requestId rows for same userId)
tokenString              = PASS (EntitySchema name='UsageRecord' => token='UsageRecordRepository')

OVERALL: ALL PASS
BETTER_SQLITE3_ENTITYSCHEMA_ARCHITECTURE_COMPATIBLE=YES
```

---

## 4. Selected revised architecture

```
SELECTED = OPTION A
TEST-ONLY ENTITYSCHEMA + REAL BETTER-SQLITE3 REPOSITORY + USAGERECORD DI-TOKEN BRIDGE
```

### Architecture overview

```
                    ┌─────────────────────────────────────────┐
                    │  Test-only EntitySchema                  │
                    │  name: 'UsageRecord'                    │
                    │  tableName: 'usage_records'             │
                    │  SQLite-portable column types            │
                    │  partial unique index preserved          │
                    └──────────┬──────────────────────────────┘
                               │
                    ┌──────────▼──────────────────────────────┐
                    │  DataSource                              │
                    │  type: 'better-sqlite3'                  │
                    │  database: ':memory:'                    │
                    │  synchronize: true                       │
                    │  dropSchema: true                        │
                    └──────────┬──────────────────────────────┘
                               │
                    ┌──────────▼──────────────────────────────┐
                    │  Real TypeORM Repository                 │
                    │  (from hermetic DataSource)              │
                    └──────────┬──────────────────────────────┘
                               │
              ┌────────────────▼────────────────────────────┐
              │  Nest DI token bridge:                      │
              │  provide: getRepositoryToken(UsageRecord)   │
              │         = 'UsageRecordRepository'           │
              │  useValue: testRepo                         │
              └────────────────┬────────────────────────────┘
                               │
           ┌───────────────────▼────────────────────────────┐
           │  CURRENT production UsageLedgerService          │
           │  (@InjectRepository(UsageRecord) → testRepo)   │
           │  UNMODIFIED                                     │
           └───────────────────┬────────────────────────────┘
                               │
           ┌───────────────────▼────────────────────────────┐
           │  CURRENT production IdempotencyGuard            │
           │  (depends on UsageLedgerService)                │
           │  UNMODIFIED                                     │
           └────────────────────────────────────────────────┘
```

### Why no TypeOrmModule.forRoot or forFeature

The revised architecture does NOT use `TypeOrmModule.forRoot()` or `TypeOrmModule.forFeature()` in the TestingModule. This is deliberate:

1. `TypeOrmModule.forRoot()` would register the DataSource in Nest DI and attempt to resolve entity metadata from the `entities` array. Passing the production `UsageRecord` class causes the PostgreSQL type validation failure. Passing the EntitySchema works at the DataSource level but `TypeOrmModule.forFeature([UsageRecord])` would try to resolve the class against the DataSource, creating a metadata mismatch.

2. Instead, the DataSource and repository are created manually outside Nest DI. The repository is provided directly under the correct token. This cleanly decouples the test fixture from the production entity's decorator metadata.

---

## 5. Test-only schema representation

### Column type mappings (TEST FIXTURE ONLY)

| Production column | Production type | Test-only type | Rationale |
|---|---|---|---|
| `execution_id` (PK) | `uuid` | `varchar` | String storage; SQLite has no uuid type |
| `request_id` | `varchar(100)` | `varchar(100)` | Compatible as-is |
| `api_key_id` | `varchar(50)` | `varchar(50)` | Compatible as-is |
| `user_id` | `varchar(50)` | `varchar(50)` | Compatible as-is |
| `session_id` | `uuid` | `varchar` | String storage |
| `conversation_id` | `uuid` | `varchar` | String storage |
| `provider` | `varchar(50)` | `varchar(50)` | Compatible as-is |
| `adapter` | `varchar(50)` | `varchar(50)` | Compatible as-is |
| `model` | `varchar(100), nullable` | `varchar(100), nullable` | Compatible as-is |
| `tokens_used` | `integer, nullable` | `integer, nullable` | Compatible as-is |
| `execution_duration_ms` | `integer, nullable` | `integer, nullable` | Compatible as-is |
| `execution_status` | `varchar(20), default 'pending'` | `varchar(20), default 'pending'` | Compatible as-is |
| `timestamp` | `timestamp` (CreateDateColumn) | `datetime` (createDate: true) | SQLite datetime; TypeORM handles Date serialization |
| `metadata` | `jsonb, nullable` | `simple-json, nullable` | Text-backed JSON; TypeORM auto-serializes/deserializes |

### UUID strategy

UUIDs are stored as varchar strings. Application code generates UUIDs via `uuid.v4()` and passes them as strings. The TypeORM repository stores and retrieves them as strings. No type-level UUID validation is needed at the SQLite layer.

### Timestamp strategy

`CreateDateColumn` with type `datetime`. TypeORM serializes Date objects to ISO string on write and deserializes to Date object on read. Probe verified: `createDateColumn = PASS (type: object [Date])`.

### JSON persistence strategy

`simple-json` type. TypeORM calls `JSON.stringify()` on write and `JSON.parse()` on read. Probe verified: nested object with special characters round-trips correctly. This preserves the `metadata.aiExecutionResult` structure used by `IdempotencyGuard` and `UsageLedgerService`.

### Partial unique index strategy

```
EntitySchema indices:
  name: 'idx_usage_records_user_request_id'
  columns: ['userId', 'requestId']
  unique: true
  where: '"request_id" IS NOT NULL'
```

SQLite supports partial indices natively. Probe verified:
- Duplicate `(userId, requestId)` with non-null requestId → `SqliteError: UNIQUE constraint failed`
- Multiple rows with null requestId for same userId → allowed (partial index excludes NULLs)

### Relational semantics retained

```
REAL_RELATIONAL_SEMANTICS_RETAINED=YES
```

All invariants these four suites test:
- `executionId` primary key uniqueness: **retained** (varchar PK)
- `(userId, requestId)` partial unique index: **retained** (SQLite partial index)
- `executionStatus` default `'pending'`: **retained**
- `CreateDateColumn` auto-population: **retained**
- JSON metadata round-trip: **retained** (simple-json)
- `findOne`, `find`, `save`, `update`, `insert`, `clear`, `delete` repository operations: **all retained** (real TypeORM repository)
- Row count assertions: **retained**
- Status transition (pending → timeout → reuse → pending → completed): **retained**

---

## 6. UsageRecord repository-token bridge

### Injection chain

```
@InjectRepository(UsageRecord)
  → @Inject(getRepositoryToken(UsageRecord))
  → @Inject('UsageRecordRepository')
```

### Token proof

`getRepositoryToken(UsageRecord)` returns `'UsageRecordRepository'` because:
- `UsageRecord` is a class (Function)
- Token = `${entity.name}Repository` = `'UsageRecordRepository'`

The EntitySchema has `name: 'UsageRecord'`, so `getRepositoryToken(testSchema)` also returns `'UsageRecordRepository'`. Probe verified.

### DI provider

```typescript
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsageRecord } from '../../entities/usage-record.entity';

// In TestingModule providers:
{ provide: getRepositoryToken(UsageRecord), useValue: testRepo }
```

This satisfies `@InjectRepository(UsageRecord)` in `UsageLedgerService` without registering the production `UsageRecord` decorator metadata with any DataSource.

### Production service changes required

```
UsageLedgerService_PRODUCTION_CHANGE_REQUIRED=NO
IdempotencyGuard_PRODUCTION_CHANGE_REQUIRED=NO
AIExecutionController_PRODUCTION_CHANGE_REQUIRED=NO
IdempotentReplayExceptionFilter_PRODUCTION_CHANGE_REQUIRED=NO
```

---

## 7. isUniqueViolation compatibility note

Production `UsageLedgerService.isUniqueViolation()` checks for Postgres error code `23505` or constraint name `idx_usage_records_user_request_id`. SQLite unique violations throw `SqliteError` without these Postgres-specific properties.

This does NOT affect the four test suites because:
- The `IdempotencyGuard` pre-checks `findByRequestId()` before any insert
- Duplicate `(userId, requestId)` is detected by the guard (returning 409 or replay)
- The `writeExecutionIntent` unique-violation catch path is never exercised
- The retry-after-timeout path uses `reuseExecutionIntent()` which does UPDATE (not INSERT)

The unique index still exists and enforces integrity. The error-code-specific catch is a safety net that is not tested by these suites.

---

## 8. Shared helper decision

### Decision

```
SHARED_HELPER_REQUIRED=YES
SHARED_HELPER_COUNT=1
```

### Rationale

The EntitySchema definition is ~30+ lines with 14 columns and a partial unique index. All four suites use an identical schema, identical DataSource configuration, and identical setup/teardown pattern. Duplicating this across 4 files would produce ~200 lines of copy-paste with risk of subtle mismatches.

### Exact proposed helper path

```
services/api-gateway/src/ai/__tests__/hermetic-usage-record-fixture.ts
```

This is consistent with the existing test file layout (flat in `__tests__`, no subdirectories). The filename clearly identifies it as a test fixture, not a test suite.

### Helper exports

1. `testUsageRecordSchema` — the EntitySchema definition (for reference/debugging)
2. `createHermeticUsageRecordFixture()` — async factory returning `{ dataSource, repository }`
3. No Nest provider helper — each suite constructs its own `TestingModule` with the manual token bridge

### Helper boundary

The helper ONLY handles DataSource/repository lifecycle. It does NOT:
- Create a TestingModule
- Import or configure Nest modules
- Define test cases
- Import production source (except the `UsageRecord` class reference for token resolution)
- Export production types or services

---

## 9. Exact writable files (revised Step 2 freeze)

```
services/api-gateway/src/ai/__tests__/hermetic-usage-record-fixture.ts       (NEW)
services/api-gateway/src/ai/__tests__/ai-execution-two-phase.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts
```

Exactly 5 files. No production files. No package/config files.

---

## 10. Implementation order

| Order | File | What changes |
|---|---|---|
| 1 | `hermetic-usage-record-fixture.ts` | Create shared helper: EntitySchema, DataSource factory, repository accessor |
| 2 | `ai-execution-two-phase.integration.spec.ts` | Remove DATABASE_URL skip; replace TypeOrmModule.forRoot with hermetic fixture; add current constructor mocks (QueueService, SessionService, ExecutionResultService, ExecutionStreamService, UserAiInstructionsService, ProjectAiContextService); overrideGuard(CreditBalanceGuard); retarget assertions to 202 queued; remove spyOn(aiServiceHttpClient.execute) |
| 3 | `ai-execution-replay-quota-bypass.integration.spec.ts` | Same fixture swap; retarget first-call assertions to 202 queued; completed-replay still 200; preserve TokenQuotaGuard spy semantics |
| 4 | `ai-execution-deterministic-replay.integration.spec.ts` | Same fixture swap; seed completed records for replay tests; retarget first-call assertions; preserve JSON metadata deep equality; preserve long/special text round-trip |
| 5 | `ai-execution-orphan-reconciliation.integration.spec.ts` | Same fixture swap; replace `dataSource.query($1 SQL)` with TypeORM repository.update or usageLedgerService.transitionOrphanToTimeout; retarget assertions; preserve row-count/reuse invariants |

Each suite is validated individually before proceeding to the next.

---

## 11. Current-contract assertion retargeting

All four suites were written for the obsolete synchronous execution path where `POST /ai/execute` returned HTTP 200 with `body.output` immediately. Current production returns HTTP 202 with `{ executionId, status: 'queued' }`. The `AIServiceHttpClient.execute` spy is no longer valid (the controller no longer calls it; execution is async via `QueueService`).

### First-call assertion changes (all four suites)

| Was | Is now |
|---|---|
| HTTP 200 OK | HTTP 202 ACCEPTED |
| `body.output = <AI response>` | `body.status = 'queued'`, `body.executionId` present |
| `spyOn(aiServiceHttpClient, 'execute')` | Mock `QueueService.enqueueExecution` |

### Completed-replay assertion (unchanged semantics)

Completed-replay still returns HTTP 200 via `IdempotentReplayException` → `IdempotentReplayExceptionFilter`. The guard detects the completed record and short-circuits. This behavior is unchanged.

To test completed-replay, tests must:
1. First call → HTTP 202 (intent + enqueue)
2. Seed the completed state via `usageLedgerService.updateExecutionResult()` or direct repository update
3. Replay call → HTTP 200 with exact metadata

### Pending-replay assertion (unchanged)

Second call while pending → HTTP 409 `Execution in progress` (IdempotencyGuard detects pending record < 5 minutes).

### Orphan assertion changes

| Was | Is now |
|---|---|
| `dataSource.query('UPDATE ... SET execution_status = $1', ...)` | `repository.update({ executionId }, { executionStatus: 'timeout' })` or `usageLedgerService.transitionOrphanToTimeout(executionId)` |
| Retry → HTTP 200 (synchronous) | Retry → HTTP 202 (queued); then seed completed for replay |

---

## 12. Exact validation commands

### Per-suite validation (PowerShell 5.x, `--runInBand`)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"

npx jest src/ai/__tests__/ai-execution-two-phase.integration.spec.ts --runInBand

npx jest src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts --runInBand

npx jest src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts --runInBand

npx jest src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts --runInBand
```

### All four together

```powershell
npx jest src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts src/ai/__tests__/ai-execution-two-phase.integration.spec.ts --runInBand
```

### Gateway build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

### Write-set / whitespace audit

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
```

### Production diff = 0 audit

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" diff -- "services/api-gateway/src" ":!services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/ai-execution-two-phase.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/hermetic-usage-record-fixture.ts"
```

Must show **zero production source edits**.

### Broad-gate command

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

Required result: **0 failed suites, 0 failed tests**. Only `smoke.integration.spec.ts` excluded.

---

## 13. Stop conditions

Implementation must STOP and return to control plane if:

1. Any production source file requires modification
2. A package.json / lockfile change is needed
3. Jest config change is needed
4. TypeORM production config change is needed
5. The EntitySchema cannot express a relational invariant these tests need
6. The DI token bridge fails at Nest compile time
7. A new dependency is required
8. Docker / PostgreSQL / Redis / provider / LIVE / staging runtime is needed

---

## 14. Boundaries preserved

```
PRODUCTION_SOURCE_CHANGE_REQUIRED=NO
PACKAGE_CHANGE_REQUIRED=NO
LOCKFILE_CHANGE_REQUIRED=NO
JEST_CONFIG_CHANGE_REQUIRED=NO
TYPEORM_PRODUCTION_CONFIG_CHANGE_REQUIRED=NO
Docker=0
PostgreSQL=0
Redis=0
provider=0
LIVE=0
staging=0
browser=0
dev-server=0
```

---

## 15. Pilot state preserved

```
PILOT-2LANE-01 = PAUSED / NOT LOCKED / RESUME_AUTHORIZED=NO
AGENT-PLATFORM-CREATE-01C = LANE-DONE / NOT LOCKED
I18N-SHELL-06 = LANE-DONE / NOT LOCKED
GATEWAY-TEST-FIXTURE-01 = COMPLETE AND LOCKED
Lane 3 = DISABLED
PRIVATE-BETA-INVITE-01 = PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
```

---

## 16. Step 2R activity ledger

```
LIVE=0
SSH=0
staging=0
provider=0
credits=0
runtime=0
Docker=0
Postgres=0
Redis=0
dev servers=0
browser smoke=0
production implementation=0
test implementation=0
dependencies=0
migrations=0
PRD.md=0
ARCHITECTURE.md=0
Git mutations=0
PILOT Step 4 resumed=NO
Lane 3=DISABLED
invitation registration=0
tests executed=NO (architecture probe only, in TEMP, deleted)
probe performed=YES (C:\Users\knlee\AppData\Local\Temp\gateway-test-fixture-02-probe.js, deleted)
probe cleanup=VERIFIED
```
