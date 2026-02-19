# PHASE-40B-2 CHECKPOINT (CORRECTED)
## Session State Transitions & Expiry Semantics Verification

**Date:** 2026-02-19  
**Phase:** 40B  
**Stage:** 40B-2  
**Task ID:** TASK-40B-2  
**Nature:** DIAGNOSTIC + VERIFICATION  
**Status:** ⚠️ CRITICAL FINDINGS — ARCHITECTURE MISMATCH DETECTED

---

## Executive Summary

**CRITICAL FINDING:** Runtime evidence contradicts PHASE-8.3 and PHASE-8.4 checkpoint claims.

**Actual State:**
- ✅ `terminated_at` and `termination_reason` columns **DO EXIST** in SQLite schema
- ✅ container-manager **DOES IMPLEMENT** termination enforcement
- ❌ api-gateway uses **PostgreSQL**, NOT SQLite
- ❌ api-gateway schema **DOES NOT HAVE** termination columns
- ❌ **DUAL DATABASE ARCHITECTURE** — services use different databases

**Root Cause:** Architecture split between PostgreSQL (api-gateway) and SQLite (container-manager) creates schema divergence.

---

## Actual Database Architecture

### Database 1: PostgreSQL (api-gateway)
**Location:** External PostgreSQL server (configured via `DATABASE_URL`)  
**Schema Source:** TypeORM migrations in `services/api-gateway/src/migrations/`  
**Current Schema:** `1769160618009-InitSchema20260123.ts`

```sql
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY,
  "status" "session_status" NOT NULL DEFAULT 'pending',
  "container_id" character varying(255),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP NOT NULL,
  "last_activity_at" TIMESTAMP NOT NULL,
  "user_id" uuid NOT NULL
)
-- NO terminated_at column
-- NO termination_reason column
```

**Status Enum:**
```typescript
export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  STOPPED = 'stopped',
  EXPIRED = 'expired',
  ERROR = 'error'
}
```

---

### Database 2: SQLite (container-manager)
**Location:** `database/aisandbox.db` (shared SQLite file)  
**Schema Source:** `database/schema-sqlite.sql` + migrations  
**Migration Applied:** `database/migrations/002_add_session_termination.sql`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  container_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  git_initialized INTEGER DEFAULT 0,
  resource_limits TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+2 hours')),
  last_activity_at TEXT DEFAULT (datetime('now')),
  metadata TEXT,
  orchestrator_enabled INTEGER DEFAULT 0,
  orchestrator_mode TEXT DEFAULT 'off',
  terminated_at TEXT,              -- ✅ EXISTS
  termination_reason TEXT          -- ✅ EXISTS
)
```

---

## Verification Results (Corrected)

### 1. Session State Transitions ⚠️ SPLIT IMPLEMENTATION

**api-gateway (PostgreSQL):**
- ✅ Has `status` enum field
- ✅ Tracks PENDING → ACTIVE → STOPPED/EXPIRED/ERROR
- ❌ Does NOT have `terminated_at` or `termination_reason`
- ❌ Does NOT enforce termination semantics
- ✅ Provides internal APIs for status updates

**container-manager (SQLite):**
- ✅ Has `status` text field
- ✅ Has `terminated_at` and `termination_reason` fields
- ✅ Enforces termination semantics
- ✅ Writes termination state to SQLite
- ✅ Returns HTTP 410 Gone for terminated sessions

**Problem:** Two separate session tables in two different databases with different schemas.

---

### 2. container_id Persistence ❌ NOT POPULATED

**api-gateway schema:**
```typescript
@Column({ type: 'varchar', length: 255, nullable: true, name: 'container_id' })
containerId: string | null;
```

**Current State:**
- Field exists in api-gateway PostgreSQL schema
- Field remains `null` throughout session lifecycle
- container-manager tracks container IDs internally (not written back)

**Finding:** `container_id` field is unused in api-gateway.

---

### 3. last_activity_at Updates ❌ NOT IMPLEMENTED IN API-GATEWAY

**api-gateway:**
- ✅ Has `last_activity_at` column in PostgreSQL
- ✅ Has `touchSessionActivity()` method
- ❌ Method is **NEVER CALLED** by any endpoint
- ❌ No activity tracking on message sends, file operations, or AI execution

**container-manager:**
- ✅ Has `last_activity_at` column in SQLite
- ✅ Tracks activity in-memory (`Map<sessionId, timestamp>`)
- ✅ Updates activity on exec, file read/write, directory list, stat
- ✅ Uses for idle timeout enforcement

**Finding:** Activity tracking exists only in container-manager, not in api-gateway.

---

### 4. Idle Timeout Enforcement ✅ IMPLEMENTED (container-manager only)

**Location:** `services/container-manager/src/sessions/sessions.service.ts:709-766`

**Enforcement:**
- ✅ Request-driven (no background workers)
- ✅ In-memory tracking (`Map<sessionId, timestamp>`)
- ✅ Writes `terminated_at` and `termination_reason='idle_timeout'` to **SQLite**
- ✅ Returns HTTP 410 Gone
- ✅ Container cleanup (best-effort)

**Database:** SQLite (`database/aisandbox.db`)

**Finding:** Idle timeout works correctly in container-manager, but api-gateway has no visibility into termination state.

---

### 5. Max Lifetime Enforcement ✅ IMPLEMENTED (container-manager only)

**Location:** `services/container-manager/src/sessions/sessions.service.ts:641-698`

**Enforcement:**
- ✅ Request-driven (no background workers)
- ✅ Reads `created_at` from **SQLite** as source of truth
- ✅ Writes `terminated_at` and `termination_reason='max_lifetime'` to **SQLite**
- ✅ Returns HTTP 410 Gone
- ✅ Container cleanup (best-effort)

**Database:** SQLite (`database/aisandbox.db`)

**Finding:** Max lifetime works correctly in container-manager, but api-gateway has no visibility into termination state.

---

### 6. Deterministic DB State ⚠️ SPLIT ACROSS TWO DATABASES

**PostgreSQL (api-gateway):**
- Tracks high-level session metadata
- No termination semantics
- Status enum provides lifecycle visibility

**SQLite (container-manager):**
- Tracks detailed session state
- Has termination semantics
- Enforces governance violations

**Problem:** Session state is split across two databases. If api-gateway queries its PostgreSQL database, it cannot see termination state.

---

### 7. HTTP 410 Gone Enforcement ✅ IMPLEMENTED (container-manager only)

**Enforcement Locations:**
All container-manager operations check termination state:
- ✅ `execInContainer`
- ✅ `readFileFromContainer`
- ✅ `writeFileToContainer`
- ✅ `listDirectoryInContainer`
- ✅ `statPathInContainer`
- ✅ Preview health checks
- ✅ Preview proxy traffic

**Finding:** HTTP 410 enforcement works correctly in container-manager. api-gateway endpoints do NOT check termination state.

---

## Architecture Mismatch Analysis

### Intended Design (per PRD/ARCHITECTURE)

**Single Source of Truth:**
- Session state should be authoritative in one database
- Termination state should be visible to all services
- HTTP 410 should be enforced consistently

**Actual Implementation:**
- api-gateway owns session creation (PostgreSQL)
- container-manager owns session enforcement (SQLite)
- No synchronization between databases
- Termination state invisible to api-gateway

---

### Why This Happened

1. **PHASE-8.3 and PHASE-8.4** implemented termination in container-manager (SQLite)
2. **api-gateway** was never migrated to include termination columns
3. **Dual database architecture** was not explicitly designed
4. **container-manager** creates its own session records in SQLite (duplicates api-gateway sessions)

---

### Current Behavior

**Session Creation Flow:**
1. User calls `POST /api/sessions` (api-gateway)
2. api-gateway creates session in **PostgreSQL** with `status=PENDING`
3. api-gateway calls container-manager `POST /sessions/:id/start`
4. container-manager creates session in **SQLite** (duplicate record)
5. container-manager starts Docker container

**Termination Flow:**
1. User calls container-manager operation (exec, file read, etc.)
2. container-manager checks **SQLite** for termination state
3. container-manager enforces idle timeout / max lifetime
4. container-manager writes `terminated_at` to **SQLite**
5. api-gateway **NEVER SEES** termination state in its PostgreSQL database

**Problem:** api-gateway can continue to show session as "active" even after container-manager has terminated it.

---

## Defects Found

### DEFECT 1: Schema Divergence ⚠️ CRITICAL
**Description:** api-gateway (PostgreSQL) and container-manager (SQLite) have different session schemas.

**Impact:**
- Termination state not visible to api-gateway
- api-gateway cannot enforce HTTP 410 on its endpoints
- Session status in api-gateway may be stale

**Root Cause:** Dual database architecture without schema synchronization.

---

### DEFECT 2: Unused Fields in api-gateway ⚠️ MEDIUM
**Description:** `container_id` and `last_activity_at` fields exist but are never populated.

**Impact:**
- Dead code in schema
- Misleading to developers
- No actual functionality loss (container-manager tracks these)

---

### DEFECT 3: No Activity Tracking in api-gateway ⚠️ LOW
**Description:** `touchSessionActivity()` method exists but is never called.

**Impact:**
- api-gateway has no visibility into session activity
- Idle timeout only enforced by container-manager
- Chat/AI operations don't update activity timestamp

---

## Intended Lifecycle Model (Per PRD/ARCHITECTURE)

### Option A: Single Database (Recommended)
**Design:** All services use same PostgreSQL database.

**Pros:**
- Single source of truth
- No schema divergence
- Termination state visible to all services

**Cons:**
- Requires container-manager to use PostgreSQL
- Requires migration of existing SQLite data

---

### Option B: Dual Database with Sync (Current + Fixes)
**Design:** Keep dual databases, synchronize termination state.

**Pros:**
- Minimal changes to existing architecture
- Preserves container-manager's SQLite usage

**Cons:**
- Complex synchronization logic
- Potential for inconsistency
- Higher maintenance burden

---

### Option C: api-gateway as Authoritative (Hybrid)
**Design:** api-gateway owns session lifecycle, container-manager queries api-gateway for termination state.

**Pros:**
- Clear ownership boundary
- api-gateway remains source of truth
- container-manager becomes stateless for session metadata

**Cons:**
- Requires HTTP calls from container-manager to api-gateway
- Latency on every operation
- Violates current architecture (no service-to-service dependencies)

---

## Minimal Corrective Plan

### Recommendation: Option A (Single Database)

**Rationale:**
- Aligns with PRD/ARCHITECTURE intent
- Eliminates schema divergence
- Simplifies system architecture
- Provides single source of truth

**Steps:**

#### 1. Add Termination Columns to api-gateway PostgreSQL Schema
**File:** New migration in `services/api-gateway/src/migrations/`

```typescript
export class AddSessionTermination[TIMESTAMP] implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sessions 
      ADD COLUMN terminated_at TIMESTAMP NULL
    `);
    
    await queryRunner.query(`
      ALTER TABLE sessions 
      ADD COLUMN termination_reason VARCHAR(255) NULL
    `);
    
    await queryRunner.query(`
      CREATE INDEX idx_sessions_terminated_at 
      ON sessions(terminated_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_sessions_terminated_at`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN termination_reason`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN terminated_at`);
  }
}
```

#### 2. Update Session Entity in api-gateway
**File:** `services/api-gateway/src/entities/session.entity.ts`

```typescript
@Column({ type: 'timestamp', nullable: true, name: 'terminated_at' })
terminatedAt: Date | null;

@Column({ type: 'varchar', length: 255, nullable: true, name: 'termination_reason' })
terminationReason: string | null;
```

#### 3. Migrate container-manager to Use PostgreSQL
**Scope:** Replace SQLite with PostgreSQL connection in container-manager.

**Files to Change:**
- `services/container-manager/src/sessions/sessions.service.ts`
- `services/container-manager/src/governance/governance-events.service.ts`
- `services/container-manager/src/usage/usage-aggregation.service.ts`
- `services/container-manager/src/projects/projects.service.ts`

**Changes:**
- Replace `better-sqlite3` with `pg` (PostgreSQL client)
- Update connection string to use `DATABASE_URL`
- Update SQL syntax (SQLite → PostgreSQL)
- Migrate existing SQLite data to PostgreSQL

#### 4. Remove Duplicate Session Creation in container-manager
**Current:** container-manager creates its own session records.  
**Target:** container-manager only reads/updates sessions created by api-gateway.

#### 5. Implement Termination Enforcement in api-gateway
**Scope:** Add termination checks to api-gateway endpoints.

**Files to Change:**
- `services/api-gateway/src/sessions/session.service.ts`
- `services/api-gateway/src/sessions/session.controller.ts`
- `services/api-gateway/src/ai/ai-execution.controller.ts`

**Logic:**
```typescript
async checkIfTerminated(sessionId: string): Promise<void> {
  const session = await this.sessionRepository.findById(sessionId);
  
  if (!session) {
    throw new NotFoundException(`Session ${sessionId} not found`);
  }
  
  if (session.terminatedAt !== null) {
    const reason = session.terminationReason 
      ? ` (reason: ${session.terminationReason})` 
      : '';
    throw new GoneException(
      `Session ${sessionId} has been terminated${reason}`
    );
  }
}
```

---

## Schema Change Required

### YES — PostgreSQL Migration Required

**Target:** api-gateway PostgreSQL database

**Migration:**
```sql
ALTER TABLE sessions ADD COLUMN terminated_at TIMESTAMP NULL;
ALTER TABLE sessions ADD COLUMN termination_reason VARCHAR(255) NULL;
CREATE INDEX idx_sessions_terminated_at ON sessions(terminated_at);
```

**Rollback:**
```sql
DROP INDEX idx_sessions_terminated_at;
ALTER TABLE sessions DROP COLUMN termination_reason;
ALTER TABLE sessions DROP COLUMN terminated_at;
```

---

## Status Field Authority

### Current State: Dual Authority (Problem)
- api-gateway: `status` enum (PostgreSQL)
- container-manager: `status` text + `terminated_at` (SQLite)

### Recommended: api-gateway Authoritative
**Rationale:**
- api-gateway owns session creation
- api-gateway is public API surface
- container-manager should be implementation detail

**Design:**
- `status` field: High-level lifecycle (PENDING, ACTIVE, STOPPED, EXPIRED, ERROR)
- `terminated_at` field: Precise termination timestamp
- `termination_reason` field: Detailed reason (max_lifetime, idle_timeout, manual, etc.)

**Relationship:**
- When `terminated_at` is set, `status` should be EXPIRED or STOPPED
- `status` provides human-readable state
- `terminated_at` provides enforcement semantics

---

## Invariants Preserved

✅ **Request-Driven Enforcement:**
- No background workers required
- Enforcement happens at request boundaries

✅ **Idempotent Termination Writes:**
- `WHERE terminated_at IS NULL` clause preserved
- Safe to call multiple times

✅ **HTTP 410 Gone Semantics:**
- Terminated sessions return 410
- Clear error messages with reason

✅ **No Scope Expansion:**
- No new features
- No background cleanup
- No distributed coordination

---

## Summary

**Critical Finding:** Architecture split between PostgreSQL (api-gateway) and SQLite (container-manager) creates schema divergence and prevents unified termination enforcement.

**Actual State:**
- ✅ Termination columns exist in SQLite
- ✅ container-manager enforces termination correctly
- ❌ api-gateway missing termination columns
- ❌ Dual database architecture not documented
- ❌ No synchronization between databases

**Recommendation:** Migrate to single PostgreSQL database for all services.

**Minimal Fix:**
1. Add termination columns to api-gateway PostgreSQL schema
2. Migrate container-manager from SQLite to PostgreSQL
3. Remove duplicate session creation in container-manager
4. Implement termination checks in api-gateway endpoints

**Effort:** Medium (4-6 hours)  
**Risk:** Medium (requires data migration)  
**Priority:** High (architecture correctness)

---

**End of PHASE-40B-2 Checkpoint (Corrected)**
