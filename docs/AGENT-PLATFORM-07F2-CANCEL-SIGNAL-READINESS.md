# AGENT-PLATFORM-07F2 — Cancel Signal Path Canary — Runtime Execution Readiness Plan

**Task ID:** AGENT-PLATFORM-07F2
**Step:** 2 — Runtime Execution Readiness / DB Safety Gate
**Status:** Step 2 COMPLETE
**Date:** 2026-07-10
**Nature:** Static readiness/planning only — no implementation, no runtime execution, no service startup
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07F2 ACTIVE — Step 1 COMPLETE (Registration 2026-07-10) | PASS |
| Parent AGENT-PLATFORM-07F ACTIVE — Step 2 COMPLETE (Preflight Plan / Split Decision, 2026-07-10) with split child-slice status | PASS |
| AGENT-PLATFORM-07F1 COMPLETE and LOCKED (2026-07-10) — Queue Transport + Metadata Preservation Canary PASS | PASS |
| AGENT-PLATFORM-07F3 PLANNED ONLY — not registered | PASS |
| AGENT-PLATFORM-07E COMPLETE and LOCKED (2026-07-10) — Unit/in-process canary PASS, 16+40 tests, TypeScript clean | PASS |
| AGENT-PLATFORM-07D COMPLETE and LOCKED (2026-07-10) — Collaboration Audit Events, 40 tests | PASS |
| AGENT-PLATFORM-07C COMPLETE and LOCKED (2026-07-10) — All 3 child slices COMPLETE and LOCKED; cancel redesign risk downgraded to LOW–MEDIUM | PASS |
| AGENT-PLATFORM-07B COMPLETE and LOCKED (2026-07-09) — Orchestration Module Skeleton | PASS |
| AGENT-PLATFORM-07A COMPLETE and LOCKED (2026-07-09) — Coordinator Contracts / Schema | PASS |
| AGENT-PLATFORM-07 COMPLETE and LOCKED (2026-07-09) — Coordinator Planning | PASS |
| AGENT-PLATFORM-06 COMPLETE and LOCKED (2026-07-09) — Upstream Identity Propagation | PASS |
| AGENT-HARNESS-07 COMPLETE and LOCKED (2026-07-07) — Per-Builder Harness Config Adapter | PASS |
| AGENT-HARNESS-06E COMPLETE and LOCKED (2026-07-09) — Full E2E Canary | PASS |
| One-active-task rule satisfied — only AGENT-PLATFORM-07F (with child 07F2) is ACTIVE | PASS |
| AGENT-HARNESS write canary not involved — separate track | PASS |
| Predecessor tasks remain COMPLETE and LOCKED | PASS |

**Governance readiness: PASS — all 16 criteria satisfied.**

---

## 2. Cancel Path Source Review

### 2.1 Exact Method

**`ExecutionResultService.requestCancel(executionId: string): Promise<boolean>`**

Location: `services/api-gateway/src/ai/execution-result.service.ts`, lines 60–73.

### 2.2 Exact SQL

```sql
UPDATE usage_records
SET execution_status = 'cancel_requested'
WHERE execution_id = $1
AND execution_status = 'running'
RETURNING execution_id
```

### 2.3 Table and Column

| Item | Value |
|------|-------|
| Table | `usage_records` |
| Column updated | `execution_status` |
| Column type | `varchar(20)` |
| WHERE condition | `execution_id = $1 AND execution_status = 'running'` |
| Return clause | `RETURNING execution_id` |

### 2.4 Before/After Status Values

| Before | After | Condition |
|--------|-------|-----------|
| `'running'` | `'cancel_requested'` | `execution_id` matches AND current status is `'running'` |
| Any other status | *unchanged* | UPDATE affects 0 rows → returns `false` |

### 2.5 Service Dependencies

| Dependency | Required? | Notes |
|------------|-----------|-------|
| Nest runtime | YES (for production) | `ExecutionResultService` is a NestJS `@Injectable` with `DataSource` injected via constructor |
| TypeORM DataSource | YES | The service uses `this.dataSource.query(...)` — raw SQL via TypeORM DataSource |
| Full API Gateway module graph | NO | Only needs `DataSource` connection to PostgreSQL |

### 2.6 Can It Be Invoked Through a Small Script?

**YES.** The SQL is a single raw query (`dataSource.query()`). A canary script can:
1. Create a standalone TypeORM `DataSource` pointed at PostgreSQL (same pattern as 07F1's `pg.Client`)
2. Execute the exact same SQL
3. Check `result.length > 0` for success/failure

This validates the **exact SQL path** that `requestCancel()` uses without needing the full NestJS module graph. The NestJS DI wiring was already validated by 07B/07C/07E tests (Jest with mocked DataSource).

### 2.7 Worker Cancel-Check Integration (Context Only)

The worker checks for `cancel_requested` at multiple points:
- **Before execution** (line 633): `SELECT execution_status ... WHERE execution_id = $1` → if `cancel_requested`, sets `cancelled`
- **During execution** (line 726): Polls `execution_status` every 1s → aborts if `cancel_requested`
- **During harness loop** (line 924): Checks mid-iteration → aborts if `cancel_requested`
- **On claim failure** (line 587): If status is already `cancel_requested`, sets `cancelled`

07F2 does NOT test the worker's cancel-check loop. It only tests the `requestCancel()` SQL transition: `running` → `cancel_requested`. Worker-side cancel behavior was validated by 07E canary tests (mocked).

---

## 3. Runtime Topology Decision

| Component | Required? | Justification |
|-----------|-----------|---------------|
| Docker Desktop | YES | Hosts PostgreSQL container via docker-compose |
| PostgreSQL (`aisandbox-postgres`) | YES | Contains `usage_records` table; target of INSERT/UPDATE/SELECT/DELETE |
| Redis (`aisandbox-redis`) | **NO** | 07F2 does not use BullMQ — direct PostgreSQL only |
| API Gateway runtime | **NO** | Canary script executes the exact same SQL directly; NestJS DI wiring was validated by unit tests |
| AI Service Worker | **NO** | 07F2 does not submit BullMQ jobs; no job processing needed |
| BullMQ | **NO** | No queue transport involved in cancel signal verification |
| container-manager | **NO** | No file tools, no workspace container |
| Frontend / browser | **NO** | Not applicable |
| Provider / API keys | **NO** | No AI execution; no external calls |

### 3.1 Topology Comparison: 07F1 vs 07F2

| Aspect | 07F1 | 07F2 |
|--------|------|------|
| Docker | YES | YES |
| PostgreSQL | YES | YES |
| Redis | YES | **NO** |
| AI Service Worker | YES | **NO** |
| BullMQ queue | YES | **NO** |
| API Gateway | NO | **NO** |
| container-manager | NO | **NO** |
| Total services | 3 (Docker + PG + Redis + Worker) | **1** (Docker + PostgreSQL) |
| Risk level | HIGH | **MEDIUM** |

### 3.2 Why Redis/BullMQ Is Not Required

07F2 tests the cancel signal SQL path (`UPDATE usage_records SET execution_status = 'cancel_requested' ...`). This is a direct PostgreSQL operation. No BullMQ job submission, no queue transport, no worker processing. Redis is only needed to start the Redis container, which is unnecessary for 07F2.

**Note:** Docker Compose may start Redis alongside PostgreSQL by default. This is acceptable but Redis is not *used* by the canary.

### 3.3 Why API Gateway Is Not Required

`ExecutionResultService.requestCancel()` executes raw SQL via `DataSource.query()`. The canary script replicates this exact SQL. The NestJS DI container is not needed — the SQL is the verification target, not the injection wiring (already validated by 07B/07C/07E unit tests with mocked DataSource).

---

## 4. Controlled DB Row Plan

### 4.1 Key Finding from 07F1

**`execution_id` column is UUID type** (not varchar). Cannot use `canary-07f2-` string prefix as execution_id. Must use proper UUIDs and identify canary rows via `metadata` JSONB marker.

### 4.2 Canary Row — Running State (Primary Test)

| Column | Value | Notes |
|--------|-------|-------|
| `execution_id` | `randomUUID()` (proper UUID) | Generated at runtime; stored in variable for reuse |
| `api_key_id` | `'canary-07f2-apikey'` | Canary-prefixed for identification |
| `user_id` | `'canary-07f2-user'` | Canary-prefixed for identification |
| `session_id` | `'00000000-07f2-4000-a000-000c07f20001'` | Synthetic UUID |
| `conversation_id` | `'00000000-07f2-4000-a000-000c07f20002'` | Synthetic UUID |
| `provider` | `'stub'` | No real provider |
| `adapter` | `'stub'` | No real adapter |
| `model` | `'stub'` | No real model |
| `execution_status` | `'running'` | **Pre-condition for cancel test** |
| `tokens_used` | `0` | No real execution |
| `metadata` | `{ "canary": "AGENT-PLATFORM-07F2", "step": 3, "scenario": "cancel-running" }` | Marker for identification and cleanup |

### 4.3 Canary Row — Completed State (Negative Test)

| Column | Value | Notes |
|--------|-------|-------|
| `execution_id` | `randomUUID()` (second UUID) | Different from primary row |
| `api_key_id` | `'canary-07f2-apikey'` | Same canary prefix |
| `user_id` | `'canary-07f2-user'` | Same canary prefix |
| `session_id` | `'00000000-07f2-4000-a000-000c07f20003'` | Synthetic UUID |
| `conversation_id` | `'00000000-07f2-4000-a000-000c07f20004'` | Synthetic UUID |
| `provider` | `'stub'` | No real provider |
| `adapter` | `'stub'` | No real adapter |
| `model` | `'stub'` | No real model |
| `execution_status` | `'completed'` | **Already completed — cancel must return false** |
| `tokens_used` | `0` | No real execution |
| `metadata` | `{ "canary": "AGENT-PLATFORM-07F2", "step": 3, "scenario": "cancel-completed" }` | Marker for identification and cleanup |

### 4.4 Timestamp Fields

The `timestamp` column uses `@CreateDateColumn` (auto-generated by TypeORM). For raw INSERT via `pg` Client, this column has a default (`NOW()`) in the database, so it does not need to be explicitly provided.

### 4.5 Row Identification Strategy

All canary rows identified by: `metadata->>'canary' = 'AGENT-PLATFORM-07F2'`

This is consistent with the 07F1 pattern (which used `metadata->>'canary' = 'AGENT-PLATFORM-07F1'`).

---

## 5. ExecutionResultService Invocation Path

### 5.1 Decision: Direct SQL Replication via Canary Script

**Selected approach:** Canary script executes the exact same SQL that `ExecutionResultService.requestCancel()` uses, via a standalone `pg.Client` connection.

### 5.2 Why This Approach

| Factor | Assessment |
|--------|-----------|
| What the canary must prove | The cancel SQL correctly transitions `execution_status` from `running` to `cancel_requested` in real PostgreSQL |
| What it does NOT need to prove | NestJS DI wiring, module imports, guard behavior (already validated by 07B/07C/07E tests) |
| Simplest safe path | Direct SQL via `pg.Client` — same pattern proven by 07F1 canary |
| Full NestJS bootstrap risk | Importing `ExecutionResultService` via `NestFactory.create()` or `Test.createTestingModule()` would require TypeORM entity registration, module imports, and potentially pull in unneeded services |
| SQL equivalence guarantee | The canary script uses the **character-for-character identical SQL** from `execution-result.service.ts` lines 62–68 |

### 5.3 Why This Still Validates the Cancel Signal Path

1. **The SQL is the contract.** `requestCancel()` is a thin wrapper around raw SQL (`dataSource.query()`). There is no ORM abstraction, no QueryBuilder, no conditional logic beyond the SQL itself.
2. **The canary executes identical SQL** against the same table, same column, same WHERE clause, same RETURNING clause.
3. **The DI wiring** (DataSource injection into ExecutionResultService, OrchestrationService → ExecutionResultService call chain) was validated by 25 Jest tests in 07C2/07E.
4. **What remains unproven without live runtime** is whether the SQL works against the real PostgreSQL schema — which is exactly what this canary proves.

### 5.4 Alternative Considered: NestJS TestingModule

Rejected because:
- Requires importing `TypeOrmModule.forRoot(...)`, entity registration, and potentially other modules
- The `ExecutionResultService` constructor only needs `DataSource` — but TypeORM `DataSource` creation requires config, entities, migrations state
- Adds complexity without adding verification value (the SQL is the same either way)
- Risk of accidentally triggering other module initialization side effects

### 5.5 Exact SQL the Canary Script Will Execute

```sql
-- Cancel request (same as ExecutionResultService.requestCancel):
UPDATE usage_records
SET execution_status = 'cancel_requested'
WHERE execution_id = $1
AND execution_status = 'running'
RETURNING execution_id
```

The script checks `result.rows.length > 0` for success (same semantic as `result.length > 0` in the TypeORM DataSource.query return).

---

## 6. Verification Method

### 6.1 Primary Verification — Cancel Running Row

```sql
SELECT execution_id, execution_status
FROM usage_records
WHERE execution_id = $1;
```

**Assert:** `execution_status = 'cancel_requested'`

### 6.2 Negative Verification — Cancel Completed Row

```sql
-- Execute cancel SQL against completed row:
UPDATE usage_records
SET execution_status = 'cancel_requested'
WHERE execution_id = $2
AND execution_status = 'running'
RETURNING execution_id
```

**Assert:** Returns 0 rows (update affects nothing because status is `completed`, not `running`)

```sql
-- Confirm status unchanged:
SELECT execution_id, execution_status
FROM usage_records
WHERE execution_id = $2;
```

**Assert:** `execution_status = 'completed'` (unchanged)

### 6.3 Row Scope Verification

```sql
-- Confirm only canary rows exist with our marker:
SELECT COUNT(*) FROM usage_records
WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';
```

**Assert:** Count = 2 (exactly the two canary rows inserted)

### 6.4 Non-Canary Row Safety

```sql
-- Confirm no non-canary rows were touched:
SELECT COUNT(*) FROM usage_records
WHERE metadata->>'canary' != 'AGENT-PLATFORM-07F2'
  OR metadata->>'canary' IS NULL;
```

**Assert:** Count equals the pre-insertion count (unchanged). The canary script records the pre-insertion count before inserting canary rows.

---

## 7. Cleanup Method

### 7.1 Database Cleanup

```sql
-- Remove all canary rows:
DELETE FROM usage_records
WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';
```

### 7.2 Cleanup Verification

```sql
-- Verify 0 remaining:
SELECT COUNT(*) FROM usage_records
WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';
```

**Assert:** Count = 0

### 7.3 No Unrelated Data Deletion

| Safeguard | Mechanism |
|-----------|-----------|
| Metadata marker | `WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2'` — cannot match real execution data (which has no `canary` metadata key) |
| Pre-cleanup count check | Script verifies exactly 2 canary rows before DELETE |
| Post-cleanup verification | Script verifies 0 rows remain |
| No broad WHERE clause | Never uses `LIKE '%canary%'` or unqualified DELETE |

### 7.4 No `canary-07f2-` Prefix on execution_id

Unlike the original preflight plan (which assumed varchar execution_id), the canary uses proper UUIDs for `execution_id` and relies on `metadata->>'canary'` for identification. This was established by the 07F1 execution finding that `execution_id` is UUID type.

### 7.5 Rollback (If Cleanup Script Fails)

```powershell
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "DELETE FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"
```

---

## 8. Exact Allowed Step 3 Files

### 8.1 Files That MAY Be Created During Step 3

| # | Action | Absolute Path | Purpose |
|---|--------|---------------|---------|
| 1 | CREATE | `C:\Users\knlee\aiSandBox2026B\services\api-gateway\scripts\canary-07f2-cancel-signal.ts` | Canary script: insert controlled rows, execute cancel SQL, verify, cleanup |
| 2 | CREATE | `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-07F2-CANCEL-SIGNAL-CANARY-EXECUTION-REPORT.md` | Execution report documenting results |

### 8.2 Why Script Is in api-gateway/scripts/

The cancel SQL is defined in `services/api-gateway/src/ai/execution-result.service.ts`. Placing the canary script under `services/api-gateway/scripts/` keeps it co-located with the service it validates. The `pg` package is available in api-gateway's `node_modules` (TypeORM uses `pg` under the hood; it's a transitive dependency). If `pg` is not directly accessible, the script can use `typeorm`'s `DataSource` directly without NestJS.

**Alternative location** (if api-gateway lacks a `scripts/` directory or `pg` direct access): `C:\Users\knlee\aiSandBox2026B\services\ai-service\scripts\canary-07f2-cancel-signal.ts` — ai-service already has `pg` as a direct dependency (proven by 07F1 canary).

### 8.3 Script Execution Method

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsx scripts/canary-07f2-cancel-signal.ts
```

Uses `npx tsx` (same as 07F1) — TypeScript execution without compilation. Script placed under ai-service (which has `pg` as proven dependency) but validates api-gateway's SQL logic.

### 8.4 Files That Must NOT Be Changed

- All production source files (`services/**/*.ts` outside the canary script)
- `execution-result.service.ts`
- `orchestration.service.ts`, `orchestration.contracts.ts`, `orchestration.module.ts`
- `worker.processor.ts`, `job.types.ts`
- `usage-ledger.service.ts`, `usage-record.entity.ts`
- All test files
- Frontend files
- Database/migration files
- `.env*` files
- `docker*` files
- `package.json` / `package-lock.json`
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md`

---

## 9. Exact Step 3 Commands

### 9.1 Preflight Checks (May Run After Keith Approves Step 3)

```powershell
# [PREFLIGHT-1] Verify Docker Desktop is running
docker info

# [PREFLIGHT-2] Verify PostgreSQL container is healthy
docker ps --filter "name=aisandbox-postgres" --format "{{.Status}}"

# [PREFLIGHT-3] Start PostgreSQL container if not running
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres

# [PREFLIGHT-4] Wait for health check
Start-Sleep -Seconds 10

# [PREFLIGHT-5] Verify PostgreSQL accepts connections
docker exec aisandbox-postgres pg_isready -U aisandbox -d aisandbox

# [PREFLIGHT-6] Verify usage_records schema has execution_status column
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usage_records' AND column_name IN ('execution_id', 'execution_status', 'metadata') ORDER BY column_name;"

# [PREFLIGHT-7] Verify no pre-existing 07F2 canary rows
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"

# [PREFLIGHT-8] Record pre-existing row count (for non-canary safety check)
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records;"
```

### 9.2 PostgreSQL Readiness Verification

```powershell
# [PG-READY-1] Verify execution_id column is UUID type
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usage_records' AND column_name = 'execution_id';"

# [PG-READY-2] Verify execution_status column accepts 'running' and 'cancel_requested'
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, character_maximum_length FROM information_schema.columns WHERE table_name = 'usage_records' AND column_name = 'execution_status';"

# [PG-READY-3] Verify metadata column is jsonb
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usage_records' AND column_name = 'metadata';"
```

### 9.3 Canary Script Execution (REQUIRES EXPLICIT KEITH RUNTIME APPROVAL)

```powershell
# [CANARY-1] Run cancel signal canary script
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsx scripts/canary-07f2-cancel-signal.ts
```

The script performs all steps internally:
1. Connects to PostgreSQL
2. Records pre-existing row count
3. Inserts canary row with `execution_status = 'running'`
4. Inserts canary row with `execution_status = 'completed'`
5. Executes cancel SQL against running row → asserts success (returns true)
6. Verifies running row status changed to `cancel_requested`
7. Executes cancel SQL against completed row → asserts failure (returns false)
8. Verifies completed row status unchanged
9. Verifies non-canary row count unchanged
10. Cleans up canary rows
11. Verifies 0 canary rows remain
12. Reports PASS/FAIL

### 9.4 Manual Verification (After Script — Confirmation Only)

```powershell
# [VERIFY-1] Confirm cleanup was successful
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"

# [VERIFY-2] Confirm total row count unchanged from preflight
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records;"

# [VERIFY-3] Verify no .env files were modified
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; git diff --name-only -- "*.env*"

# [VERIFY-4] Verify no production source changes
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; git diff --stat -- services/
```

### 9.5 Cleanup (If Script Cleanup Failed)

```powershell
# [CLEANUP-1] Manual cleanup via psql
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "DELETE FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"

# [CLEANUP-2] Verify cleanup
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"
```

### 9.6 Rollback (If Unexpected State)

```powershell
# [ROLLBACK-1] Remove all 07F2 canary rows regardless of state
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "DELETE FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"

# [ROLLBACK-2] Verify
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE metadata->>'canary' = 'AGENT-PLATFORM-07F2';"
```

### 9.7 Command Category Summary

| Category | Section | Keith Approval Required |
|----------|---------|------------------------|
| Preflight checks | §9.1 | NO — read-only inspection |
| PostgreSQL readiness | §9.2 | NO — read-only schema inspection |
| Canary execution | §9.3 | **YES — explicit Keith runtime approval** |
| Manual verification | §9.4 | NO — read-only queries |
| Cleanup | §9.5 | NO — expected post-canary hygiene |
| Rollback | §9.6 | NO — safety recovery |

---

## 10. PASS/FAIL Criteria

### 10.1 PASS Criteria — ALL Must Be Satisfied

| # | Criterion | Objective Measure |
|---|-----------|-------------------|
| 1 | PostgreSQL reachable | `pg_isready` passes; `docker ps` shows healthy container |
| 2 | Schema verified | `execution_id` is UUID; `execution_status` is varchar(20); `metadata` is jsonb |
| 3 | No pre-existing canary rows | `metadata->>'canary' = 'AGENT-PLATFORM-07F2'` count = 0 before insertion |
| 4 | Running canary row inserted | INSERT succeeds; row exists with `execution_status = 'running'` |
| 5 | Completed canary row inserted | INSERT succeeds; row exists with `execution_status = 'completed'` |
| 6 | `requestCancel` path executed against running row | Cancel SQL returns 1 row (RETURNING) |
| 7 | Status changed `running` → `cancel_requested` | SELECT confirms `execution_status = 'cancel_requested'` |
| 8 | `requestCancel` path executed against completed row | Cancel SQL returns 0 rows |
| 9 | Completed row status unchanged | SELECT confirms `execution_status = 'completed'` (not changed) |
| 10 | Exactly 2 canary rows affected (no more) | Count by metadata marker = 2 during test |
| 11 | No non-canary rows touched | Total row count unchanged (pre vs post) |
| 12 | Cleanup complete | DELETE removes canary rows; post-cleanup count = 0 |
| 13 | No runtime services beyond approved scope | No Redis, no BullMQ, no Worker, no API Gateway, no container-manager |
| 14 | No provider/API calls | No external HTTP calls; no AI execution |
| 15 | No write tools | No `write_file`, `delete_file`, `run_validation`, `browser_smoke` |
| 16 | No `.env` changes | `git diff --name-only -- "*.env*"` returns empty |
| 17 | No production source changes | `git diff --stat -- services/` shows only canary script (if newly created) |
| 18 | AGENT-HARNESS write canary not involved | Separate track — not referenced or activated |

### 10.2 FAIL Criteria — ANY Triggers FAIL

| # | Criterion | Trigger |
|---|-----------|---------|
| 1 | PostgreSQL unavailable | `pg_isready` fails; container not healthy |
| 2 | Schema mismatch | `execution_id` not UUID, `execution_status` not varchar, `metadata` not jsonb |
| 3 | Running row insertion fails | INSERT error (constraint violation, missing column, type mismatch) |
| 4 | Cancel SQL fails to update running row | Returns 0 rows when it should return 1 |
| 5 | Status NOT `cancel_requested` after cancel | SELECT shows wrong value |
| 6 | Cancel SQL updates completed row | Returns >0 rows when it should return 0 |
| 7 | Non-canary rows affected | Total row count changed |
| 8 | Cleanup fails | Canary rows remain after DELETE |
| 9 | `.env` file modified | Pre/post diff shows changes |
| 10 | Production source file modified | Any `services/**` production file changed |
| 11 | API Gateway / Worker / Redis started | Unauthorized service activation |
| 12 | Provider / API call detected | External HTTP call made |
| 13 | AGENT-HARNESS write canary activated | Write harness referenced or triggered |

---

## 11. Stop Conditions

If ANY of the following occur, **STOP immediately** and escalate to Keith:

| # | Stop Condition | Action |
|---|---------------|--------|
| 1 | PostgreSQL unavailable after Keith approval | STOP — infrastructure prerequisite not met |
| 2 | Schema mismatch — `execution_status` column missing or wrong type | STOP — canary cannot proceed without correct schema |
| 3 | Schema mismatch — `metadata` column not jsonb | STOP — identification/cleanup strategy fails |
| 4 | `execution_id` column type unexpected (not UUID) | STOP — insertion strategy needs revision |
| 5 | Required columns unclear or differ from entity definition | STOP — re-inspect schema |
| 6 | Cancel SQL requires columns not present in table | STOP — possible migration needed |
| 7 | Service invocation requires broad API Gateway runtime | STOP — re-evaluate invocation path (already mitigated by direct SQL approach) |
| 8 | Migration needed for canary to work | STOP — canary must not require schema changes |
| 9 | Cleanup cannot be guaranteed (metadata marker approach fails) | STOP — investigate before continuing |
| 10 | Non-canary row risk detected (DELETE targets too broad) | STOP — refine cleanup query |
| 11 | Provider/API risk — any non-stub reference detected | STOP — review script |
| 12 | Source changes outside allowed script/report needed | STOP — register bug/gap as separate task |
| 13 | AGENT-HARNESS write canary confusion — any write harness reference | STOP — verify boundaries |
| 14 | Docker compose up starts services beyond PostgreSQL unexpectedly | STOP — use targeted `docker compose up -d postgres` only |
| 15 | Pre-existing canary rows from prior failed run | STOP — clean up manually before proceeding |

---

## 12. Runtime Safety Gate

Step 3 may proceed **only within the registered 07F2 boundary:**

| Allowed | Not Allowed |
|---------|-------------|
| Docker Desktop health check | Redis startup (not needed) |
| `docker compose up -d postgres` | `docker compose up -d redis` (unless bundled — acceptable but not used) |
| PostgreSQL readiness check (`pg_isready`) | API Gateway startup |
| Controlled canary-prefixed DB row INSERT | AI Service Worker startup |
| Cancel SQL UPDATE on canary row | BullMQ job submission |
| SELECT verification on canary rows | Provider / API calls |
| DELETE cleanup of canary rows (by metadata marker) | Browser smoke |
| Schema inspection queries | Write tool execution |
| `git diff` for safety verification | `.env` file modification |
| Creation of canary script file | Production source modification |
| Creation of execution report doc | AGENT-HARNESS write canary activation |

### 12.1 Process-Scoped Env

**None required.** 07F2 does not start the AI Service Worker. No `AGENT_HARNESS_ENABLE_*` env overrides are needed. The canary script only needs `DATABASE_URL` (read from `.env` via `dotenv.config()`).

### 12.2 Connection String Handling

Same pattern as 07F1: Root `.env` uses Docker-internal hostname (`@postgres:5432`). Canary script uses `getLocalDatabaseUrl()` helper to replace with `@localhost:5432` for host-side execution. No `.env` files modified.

---

## 13. 07F2 Step 3 Readiness Conclusion

### 13.1 Ready / Not Ready

**READY for Step 3 execution, contingent on Keith approval.**

All governance prerequisites are satisfied. The runtime topology is minimal (Docker + PostgreSQL only — no Redis, no Worker, no API Gateway). The cancel SQL is a single deterministic UPDATE. Verification is a simple SELECT. Cleanup uses metadata markers. The canary is bounded, reversible, and isolated.

### 13.2 Whether Further Split Is Needed

**No further split required.** 07F2 is a single bounded canary: two row insertions, two cancel attempts (one positive, one negative), one cleanup. The runtime scope is smaller than 07F1 (1 service vs 3). Splitting further would add governance overhead without reducing risk.

### 13.3 Recommended Model

**GPT-5.3 Codex** — bounded PostgreSQL verification, lower risk than 07F1. Direct SQL execution against well-known schema. No queue transport, no worker processing, no AI execution.

### 13.4 Exact Next Prompt Type

**Runtime execution prompt** — implement the canary script and execute Step 3 after Keith approves.

Required actions:
1. Keith approves Step 3 runtime execution
2. Run preflight checks (§9.1)
3. Verify PostgreSQL readiness (§9.2)
4. Create canary script (`services/ai-service/scripts/canary-07f2-cancel-signal.ts`)
5. Run canary script (§9.3)
6. Run manual verification (§9.4)
7. Run cleanup if needed (§9.5)
8. Create execution report doc
9. Proceed to Step 4 (consolidation) — may be combined with 07F3 parent close

---

## 14. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — 07F2 ACTIVE, Step 1 COMPLETE, parent 07F ACTIVE |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance mirror — 07F1/07F2/07F3 status |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence — 07F position, one-active-task rule |
| 4 | `docs/AGENT-PLATFORM-07F1-CHECKPOINT.md` | 07F1 completion — UUID type finding, cleanup pattern, runtime topology |
| 5 | `docs/AGENT-PLATFORM-07F1-RUNTIME-CANARY-EXECUTION-REPORT.md` | 07F1 execution — canary pattern, metadata marker approach, PostgreSQL port handling |
| 6 | `docs/AGENT-PLATFORM-07F1-RUNTIME-EXECUTION-READINESS.md` | 07F1 readiness — template/pattern for this document; canary script structure |
| 7 | `docs/AGENT-PLATFORM-07F-LIVE-RUNTIME-CANARY-PREFLIGHT.md` | Parent preflight — split decision, 07F2 scope definition, cancel path Option A |
| 8 | `services/api-gateway/package.json` | Package — scripts, dependencies |
| 9 | `services/api-gateway/src/ai/execution-result.service.ts` | **PRIMARY** — `requestCancel()` exact SQL, DataSource usage, return semantics |
| 10 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Usage ledger — `writeExecutionIntent()` pattern, metadata JSONB merge |
| 11 | `services/api-gateway/src/entities/usage-record.entity.ts` | Entity schema — column types, constraints, defaults, execution_status values |
| 12 | `services/ai-service/src/worker/worker.processor.ts` | Worker cancel-check points — confirms `cancel_requested` is checked pre/during/post execution |
| 13 | `services/ai-service/scripts/canary-07f1-submit-job.ts` | 07F1 canary script — pattern for pg.Client usage, dotenv loading, UUID execution_id, metadata marker |

---

## 15. Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | Exact file created: `docs/AGENT-PLATFORM-07F2-CANCEL-SIGNAL-READINESS.md` | CONFIRMED |
| 2 | No source/service files changed | CONFIRMED |
| 3 | No frontend files changed | CONFIRMED |
| 4 | No database/migration files changed | CONFIRMED |
| 5 | No `.env` files changed | CONFIRMED |
| 6 | No `docker*` files changed | CONFIRMED |
| 7 | No package files changed | CONFIRMED |
| 8 | No test files changed | CONFIRMED |
| 9 | No governance files changed (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | CONFIRMED |
| 10 | No git commits/pushes | CONFIRMED |
| 11 | No tests/builds run | CONFIRMED |
| 12 | No Docker/Postgres/Redis started | CONFIRMED |
| 13 | No API Gateway/AI Service/Worker started | CONFIRMED |
| 14 | No BullMQ jobs submitted | CONFIRMED |
| 15 | No PostgreSQL queries or mutations | CONFIRMED |
| 16 | No provider/API calls | CONFIRMED |
| 17 | No browser smoke | CONFIRMED |
| 18 | AGENT-PLATFORM-07F3 not registered | CONFIRMED |
| 19 | AGENT-HARNESS write canary not touched | CONFIRMED |
| 20 | AGENT-PLATFORM-07F2 ready for Step 3 (contingent on Keith approval) | CONFIRMED |

---

## Document Metadata

- **Created:** 2026-07-10
- **Task:** AGENT-PLATFORM-07F2 Step 2 — Runtime Execution Readiness / DB Safety Gate
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
