# PHASE-40B-2: Session Storage Unification Design
## PostgreSQL Single Source of Truth

**Date:** 2026-02-19  
**Phase:** 40B  
**Stage:** 40B-2  
**Nature:** ARCHITECTURE DESIGN (Implementation Deferred)  
**Status:** DESIGN COMPLETE — AWAITING APPROVAL

---

## Executive Summary

**Objective:** Unify session storage from dual-database architecture (PostgreSQL + SQLite) to single PostgreSQL database.

**Scope:** Minimal schema changes to eliminate architecture divergence.

**Principle:** PostgreSQL becomes single source of truth for all session state.

**Services Affected:**
- api-gateway (schema addition)
- container-manager (database client replacement)

**Risk Level:** MEDIUM (requires data migration, service coordination)

---

## Current Architecture (Problem State)

### Database 1: PostgreSQL (api-gateway)
**Purpose:** Session creation and high-level lifecycle  
**Location:** External PostgreSQL server (via `DATABASE_URL`)  
**Schema:** TypeORM migrations  
**Columns:** `id`, `status`, `container_id`, `created_at`, `expires_at`, `last_activity_at`, `user_id`

**Missing:**
- `terminated_at`
- `termination_reason`

### Database 2: SQLite (container-manager)
**Purpose:** Session enforcement and termination tracking  
**Location:** `database/aisandbox.db` (local file)  
**Schema:** SQL schema file + migrations  
**Columns:** All of above PLUS `terminated_at`, `termination_reason`

**Problem:** Duplicate session records, schema divergence, no synchronization.

---

## Target Architecture (Solution State)

### Single Database: PostgreSQL
**Purpose:** Authoritative session state for all services  
**Location:** External PostgreSQL server (via `DATABASE_URL`)  
**Schema:** Unified TypeORM migrations  
**Columns:** All fields from both current schemas

**Ownership:**
- api-gateway: Session creation, status updates
- container-manager: Termination writes, governance enforcement

**Benefits:**
- Single source of truth
- No schema divergence
- Termination state visible to all services
- Simplified architecture

---

## Data Ownership Model

### api-gateway Owns (WRITE)
1. **Session Creation**
   - `id` (generated)
   - `user_id` (from JWT)
   - `status` (initial: PENDING)
   - `created_at` (timestamp)
   - `expires_at` (calculated)
   - `last_activity_at` (initial: now)

2. **Status Transitions**
   - `status` updates (PENDING → ACTIVE → STOPPED/ERROR)
   - Called by internal APIs from container-manager

3. **Activity Tracking (Optional)**
   - `last_activity_at` updates on chat/AI operations

### container-manager Owns (WRITE)
1. **Termination State**
   - `terminated_at` (timestamp when terminated)
   - `termination_reason` (max_lifetime, idle_timeout, manual, etc.)

2. **Container Metadata (Optional)**
   - `container_id` (Docker container ID)

### Both Services (READ)
- All services can read all session fields
- No exclusive read ownership
- Queries use indexed columns

---

## Minimal Schema Delta

### PostgreSQL Migration (api-gateway)

**File:** `services/api-gateway/src/migrations/[TIMESTAMP]-AddSessionTermination.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionTermination[TIMESTAMP] implements MigrationInterface {
  name = 'AddSessionTermination[TIMESTAMP]';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add terminated_at column (nullable timestamp)
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      ADD COLUMN "terminated_at" TIMESTAMP NULL
    `);

    // Add termination_reason column (nullable varchar)
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      ADD COLUMN "termination_reason" character varying(255) NULL
    `);

    // Add index for termination queries
    await queryRunner.query(`
      CREATE INDEX "idx_sessions_terminated_at" 
      ON "sessions" ("terminated_at")
    `);

    // Add index for termination reason queries
    await queryRunner.query(`
      CREATE INDEX "idx_sessions_termination_reason" 
      ON "sessions" ("termination_reason")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Drop indexes
    await queryRunner.query(`
      DROP INDEX "idx_sessions_termination_reason"
    `);
    await queryRunner.query(`
      DROP INDEX "idx_sessions_terminated_at"
    `);

    // Rollback: Drop columns
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      DROP COLUMN "termination_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      DROP COLUMN "terminated_at"
    `);
  }
}
```

### Entity Update (api-gateway)

**File:** `services/api-gateway/src/entities/session.entity.ts`

```typescript
/**
 * Termination timestamp (nullable)
 * Set when session is terminated by governance violation or manual action
 * Once set, session is irreversibly terminated (HTTP 410 Gone)
 */
@Index('idx_sessions_terminated_at')
@Column({ type: 'timestamp', nullable: true, name: 'terminated_at' })
terminatedAt: Date | null;

/**
 * Termination reason (nullable)
 * Examples: 'max_lifetime', 'idle_timeout', 'manual', 'error'
 * Provides context for why session was terminated
 */
@Index('idx_sessions_termination_reason')
@Column({ type: 'varchar', length: 255, nullable: true, name: 'termination_reason' })
terminationReason: string | null;
```

**No other schema changes required.**

---

## Migration Steps

### Phase 1: Schema Addition (Zero Downtime)

**Step 1.1: Add Columns to PostgreSQL**
```bash
# In api-gateway directory
npm run typeorm migration:generate -- -n AddSessionTermination
npm run typeorm migration:run
```

**Result:**
- PostgreSQL now has `terminated_at` and `termination_reason` columns
- All existing sessions have NULL values (not terminated)
- api-gateway can continue operating normally

**Downtime:** ZERO (additive schema change)

---

### Phase 2: container-manager Database Client Replacement

**Step 2.1: Install PostgreSQL Client**
```bash
# In container-manager directory
npm install pg
npm uninstall better-sqlite3
```

**Step 2.2: Create Database Configuration**

**File:** `services/container-manager/src/config/database.config.ts` (NEW)

```typescript
import { Pool } from 'pg';

export class DatabaseConfig {
  private static pool: Pool | null = null;

  static getPool(): Pool {
    if (!this.pool) {
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        throw new Error(
          'DATABASE_URL is required for container-manager. ' +
          'Example: postgresql://user:pass@localhost:5432/aisandbox'
        );
      }

      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 20, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      console.log('[container-manager] PostgreSQL pool initialized');
    }

    return this.pool;
  }

  static async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('[container-manager] PostgreSQL pool closed');
    }
  }
}
```

**Step 2.3: Update SessionsService**

**File:** `services/container-manager/src/sessions/sessions.service.ts`

**Changes:**
```typescript
// BEFORE (SQLite)
import Database from 'better-sqlite3';
private db: Database.Database;

constructor(...) {
  const dbPath = path.join(__dirname, '../../../..', 'database', 'aisandbox.db');
  this.db = new Database(dbPath);
}

// Query example (SQLite)
const session = this.db
  .prepare('SELECT terminated_at, termination_reason FROM sessions WHERE id = ?')
  .get(sessionId);

// AFTER (PostgreSQL)
import { Pool } from 'pg';
import { DatabaseConfig } from '../config/database.config';
private pool: Pool;

constructor(...) {
  this.pool = DatabaseConfig.getPool();
}

// Query example (PostgreSQL)
const result = await this.pool.query(
  'SELECT terminated_at, termination_reason FROM sessions WHERE id = $1',
  [sessionId]
);
const session = result.rows[0];
```

**Key Changes:**
- Replace `better-sqlite3` with `pg`
- Replace synchronous queries with async/await
- Replace `?` placeholders with `$1, $2, ...`
- Replace `.prepare().get()` with `.query()`
- Replace `.prepare().run()` with `.query()`

**Step 2.4: Update All Database Queries**

**Services to Update:**
1. `SessionsService` — Session queries
2. `GovernanceEventsService` — Event logging
3. `UsageAggregationService` — Usage queries
4. `QuotaEvaluationService` — Quota queries
5. `ProjectsService` — Project queries

**SQL Syntax Changes:**
- `datetime('now')` → `NOW()`
- `TEXT` → `VARCHAR` or `TEXT`
- `INTEGER` → `INT` or `BIGINT`
- Single quotes for strings (same)
- Parameterized queries: `?` → `$1, $2, ...`

**Step 2.5: Remove SQLite Database File**
```bash
# After verification
rm database/aisandbox.db
rm services/container-manager/container-manager.db
```

**Downtime:** ZERO (if done with blue-green deployment)

---

### Phase 3: Data Migration (If Needed)

**Scenario:** Existing SQLite data needs to be preserved.

**Step 3.1: Export SQLite Data**
```bash
sqlite3 database/aisandbox.db ".dump sessions" > sessions_export.sql
```

**Step 3.2: Transform SQL (SQLite → PostgreSQL)**
```bash
# Replace SQLite-specific syntax
sed -i 's/datetime('"'"'now'"'"')/NOW()/g' sessions_export.sql
sed -i 's/INTEGER PRIMARY KEY AUTOINCREMENT/SERIAL PRIMARY KEY/g' sessions_export.sql
```

**Step 3.3: Import to PostgreSQL**
```bash
psql $DATABASE_URL < sessions_export.sql
```

**Step 3.4: Verify Data**
```sql
-- Check record counts match
SELECT COUNT(*) FROM sessions;
```

**Risk:** Data loss if export/import fails. **Mitigation:** Backup before migration.

---

### Phase 4: Verification

**Step 4.1: Verify Schema**
```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
  AND column_name IN ('terminated_at', 'termination_reason');

-- Expected output:
-- terminated_at    | timestamp without time zone | YES
-- termination_reason | character varying         | YES
```

**Step 4.2: Verify Indexes**
```sql
-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'sessions' 
  AND indexname LIKE '%terminated%';

-- Expected output:
-- idx_sessions_terminated_at
-- idx_sessions_termination_reason
```

**Step 4.3: Test Termination Write**
```sql
-- Test idempotent termination write
UPDATE sessions 
SET terminated_at = NOW(), termination_reason = 'test'
WHERE id = '<test-session-id>' AND terminated_at IS NULL;

-- Verify write succeeded
SELECT id, terminated_at, termination_reason 
FROM sessions 
WHERE id = '<test-session-id>';
```

**Step 4.4: Test Termination Read**
```bash
# In container-manager
curl -X POST http://localhost:3003/sessions/<test-session-id>/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "echo test"}'

# Expected: HTTP 410 Gone
# Response: {"statusCode":410,"message":"Session terminated (reason: test)"}
```

---

## Rollback Strategy

### Scenario 1: Migration Fails (Phase 1)
**State:** PostgreSQL migration failed or columns not created.

**Rollback:**
```bash
npm run typeorm migration:revert
```

**Result:** PostgreSQL schema restored to previous state.

**Impact:** ZERO (no code changes deployed yet)

---

### Scenario 2: container-manager Fails After Deployment (Phase 2)
**State:** container-manager cannot connect to PostgreSQL or queries fail.

**Rollback:**
1. Revert container-manager code to previous commit
2. Restart container-manager service
3. Verify SQLite database file still exists

**Result:** container-manager uses SQLite again.

**Impact:** MEDIUM (requires service restart, potential data loss if SQLite deleted)

**Prevention:** Keep SQLite file until full verification complete.

---

### Scenario 3: Data Migration Corruption (Phase 3)
**State:** Data imported to PostgreSQL is corrupted or incomplete.

**Rollback:**
1. Truncate sessions table in PostgreSQL
2. Re-import from SQLite backup
3. Verify record counts match

**Result:** PostgreSQL restored from backup.

**Impact:** HIGH (requires database operations, potential downtime)

**Prevention:** 
- Backup PostgreSQL before import
- Verify checksums after import
- Test queries before cutover

---

### Scenario 4: Production Issues After Full Cutover
**State:** Undetected bugs in production, need to rollback entire change.

**Rollback:**
1. Revert api-gateway migration: `npm run typeorm migration:revert`
2. Revert container-manager code to previous commit
3. Restore SQLite database from backup
4. Restart both services

**Result:** Full rollback to dual-database architecture.

**Impact:** CRITICAL (full service restart, potential data loss)

**Prevention:**
- Test in staging environment first
- Deploy during low-traffic window
- Monitor error rates closely
- Keep SQLite backup for 7 days

---

## Risk Analysis

### Risk 1: Data Loss During Migration ⚠️ HIGH
**Probability:** LOW  
**Impact:** CRITICAL  
**Scenario:** SQLite data not fully migrated to PostgreSQL.

**Mitigation:**
- Backup both databases before migration
- Verify record counts match
- Test queries before cutover
- Keep SQLite file for 7 days post-migration

**Rollback:** Restore from SQLite backup.

---

### Risk 2: Query Performance Degradation ⚠️ MEDIUM
**Probability:** MEDIUM  
**Impact:** MEDIUM  
**Scenario:** PostgreSQL queries slower than SQLite (network latency).

**Mitigation:**
- Add indexes on frequently queried columns
- Use connection pooling (max 20 connections)
- Monitor query execution times
- Optimize slow queries

**Rollback:** Revert to SQLite if performance unacceptable.

---

### Risk 3: Connection Pool Exhaustion ⚠️ MEDIUM
**Probability:** LOW  
**Impact:** HIGH  
**Scenario:** container-manager exhausts PostgreSQL connection pool.

**Mitigation:**
- Configure pool size (max 20)
- Set connection timeout (2 seconds)
- Monitor active connections
- Implement connection retry logic

**Rollback:** Increase pool size or revert to SQLite.

---

### Risk 4: Schema Divergence During Transition ⚠️ MEDIUM
**Probability:** MEDIUM  
**Impact:** MEDIUM  
**Scenario:** api-gateway and container-manager use different schemas during rollout.

**Mitigation:**
- Deploy schema changes first (Phase 1)
- Wait for verification before deploying code (Phase 2)
- Use feature flags to control cutover
- Test both old and new code paths

**Rollback:** Revert code changes, keep schema (backward compatible).

---

### Risk 5: Termination State Inconsistency ⚠️ LOW
**Probability:** LOW  
**Impact:** MEDIUM  
**Scenario:** Session terminated in SQLite but not in PostgreSQL during transition.

**Mitigation:**
- Complete migration before enabling termination writes
- Verify no in-flight terminations during cutover
- Test termination writes immediately after cutover

**Rollback:** Manual reconciliation or revert to SQLite.

---

### Risk 6: Service Downtime During Deployment ⚠️ LOW
**Probability:** LOW  
**Impact:** HIGH  
**Scenario:** Services unavailable during database cutover.

**Mitigation:**
- Use blue-green deployment
- Deploy schema changes first (zero downtime)
- Deploy code changes with rolling restart
- Monitor health checks continuously

**Rollback:** Revert deployment, restart services.

---

## Exact Scope Boundaries

### IN SCOPE ✅

**Schema Changes:**
- Add `terminated_at` column to PostgreSQL sessions table
- Add `termination_reason` column to PostgreSQL sessions table
- Add indexes on new columns

**Code Changes:**
- Replace `better-sqlite3` with `pg` in container-manager
- Update all database queries to use PostgreSQL syntax
- Update all services to use `DATABASE_URL` environment variable
- Add PostgreSQL connection pool configuration

**Data Migration:**
- Export existing SQLite session data (if needed)
- Import to PostgreSQL (if needed)
- Verify data integrity

**Testing:**
- Verify schema changes applied correctly
- Verify termination writes work
- Verify termination reads work
- Verify HTTP 410 enforcement

**Documentation:**
- Update ARCHITECTURE.md with single-database model
- Update README with PostgreSQL setup instructions
- Document migration procedure

---

### OUT OF SCOPE ❌

**Schema Changes:**
- ❌ No new columns beyond `terminated_at` and `termination_reason`
- ❌ No changes to existing columns
- ❌ No new tables
- ❌ No foreign key changes

**Code Changes:**
- ❌ No background workers
- ❌ No scheduled cleanup jobs
- ❌ No authentication changes
- ❌ No authorization changes
- ❌ No API endpoint changes
- ❌ No new features
- ❌ No refactoring beyond database client replacement

**Data Migration:**
- ❌ No migration of other tables (projects, token_usage, etc.)
- ❌ No data transformation beyond SQLite → PostgreSQL syntax
- ❌ No data cleanup or archival

**Infrastructure:**
- ❌ No PostgreSQL server setup (assumed existing)
- ❌ No database replication
- ❌ No backup automation
- ❌ No monitoring setup

**Testing:**
- ❌ No new test suites
- ❌ No performance testing
- ❌ No load testing

---

## Constraints Verified

### ✅ No Background Workers
- All enforcement remains request-driven
- No cron jobs or schedulers added
- No polling mechanisms

### ✅ No Schema Expansion Beyond Termination Columns
- Only `terminated_at` and `termination_reason` added
- No other columns modified
- No new tables created

### ✅ No Auth Changes
- No JWT changes
- No API key changes
- No permission changes

### ✅ No Feature Expansion
- No new endpoints
- No new functionality
- No behavior changes (except unified database)

### ✅ Minimal Change Principle
- Smallest possible schema delta
- Minimal code changes (database client only)
- No architectural redesign beyond database unification

---

## Success Criteria

### Technical Success ✅
1. PostgreSQL has `terminated_at` and `termination_reason` columns
2. container-manager uses PostgreSQL instead of SQLite
3. All database queries work correctly
4. Termination writes are idempotent
5. HTTP 410 enforcement works in both services
6. No data loss during migration
7. No performance degradation

### Operational Success ✅
1. Zero downtime deployment
2. Rollback plan tested and documented
3. Monitoring shows no errors
4. All tests pass
5. Documentation updated

### Architectural Success ✅
1. Single source of truth for session state
2. No schema divergence between services
3. Clear data ownership model
4. Simplified architecture

---

## Implementation Phases (Recommended Order)

### Phase 1: Schema Preparation (Day 1)
- Add termination columns to PostgreSQL
- Verify migration successful
- Deploy to staging environment
- Test schema changes

**Risk:** LOW  
**Downtime:** ZERO

---

### Phase 2: Code Preparation (Day 2-3)
- Update container-manager to use PostgreSQL client
- Update all database queries
- Test locally with PostgreSQL
- Test in staging environment

**Risk:** MEDIUM  
**Downtime:** ZERO (not deployed yet)

---

### Phase 3: Staging Deployment (Day 4)
- Deploy container-manager changes to staging
- Verify all operations work
- Test termination writes
- Test HTTP 410 enforcement
- Monitor for errors

**Risk:** MEDIUM  
**Downtime:** ZERO (staging only)

---

### Phase 4: Production Deployment (Day 5)
- Deploy container-manager changes to production
- Monitor error rates
- Verify termination writes
- Test sample operations
- Keep SQLite backup for 7 days

**Risk:** HIGH  
**Downtime:** ZERO (rolling restart)

---

### Phase 5: Cleanup (Day 12)
- Remove SQLite database files
- Remove SQLite dependencies
- Update documentation
- Archive migration scripts

**Risk:** LOW  
**Downtime:** ZERO

---

## Monitoring Plan

### Metrics to Track
1. **Database Connection Pool**
   - Active connections
   - Idle connections
   - Connection errors
   - Query execution time

2. **Termination Writes**
   - Write success rate
   - Write latency
   - Idempotency violations (should be zero)

3. **HTTP 410 Responses**
   - Count of 410 responses
   - Response time
   - Error rate

4. **Service Health**
   - api-gateway uptime
   - container-manager uptime
   - Database connectivity

### Alerts to Configure
1. **Connection pool exhaustion** (> 18/20 connections)
2. **Query timeout** (> 2 seconds)
3. **Database connection errors** (> 5/minute)
4. **HTTP 410 error rate spike** (> 10% increase)
5. **Service restart** (any unplanned restart)

---

## Approval Checklist

Before proceeding with implementation:

- [ ] Design reviewed and approved
- [ ] Risk analysis accepted
- [ ] Rollback strategy validated
- [ ] Scope boundaries confirmed
- [ ] PostgreSQL server available and configured
- [ ] `DATABASE_URL` environment variable set
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Staging environment ready
- [ ] Deployment window scheduled

---

## Next Steps (After Approval)

1. **Create Migration File**
   - Generate TypeORM migration
   - Review SQL statements
   - Test in local environment

2. **Update container-manager**
   - Install `pg` package
   - Create database configuration
   - Update all queries
   - Test locally

3. **Deploy to Staging**
   - Run migration
   - Deploy code changes
   - Verify functionality
   - Monitor for issues

4. **Deploy to Production**
   - Schedule deployment window
   - Run migration
   - Deploy code changes
   - Monitor closely
   - Keep rollback ready

---

**End of Unification Design**

**Status:** DESIGN COMPLETE — AWAITING APPROVAL  
**Implementation:** DEFERRED PENDING APPROVAL
