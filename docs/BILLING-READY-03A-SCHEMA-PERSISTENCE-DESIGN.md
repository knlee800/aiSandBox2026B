# BILLING-READY-03A — Schema and Persistence Design

**Task ID:** BILLING-READY-03A
**Parent:** BILLING-READY-03
**Status:** COMPLETE and LOCKED
**Created:** 2026-07-07
**Family:** BILLING / CREDIT BALANCE PERSISTENCE
**Nature:** Governance/design only — no implementation

---

## 1. Overview

This document defines the database schema, entity design, repository contracts, idempotency model, transaction semantics, and migration plan for credit balance persistence. It serves as the authoritative design reference for BILLING-READY-03B (implementation) and subsequent child slices.

The persistence layer introduces two new tables:
- `credit_balances` — stores per-user credit balance state
- `credit_deduction_records` — stores immutable deduction event records

---

## 2. Entity Designs

### 2.1 CreditBalance Entity

**Table name:** `credit_balances`

| Field | DB Column | Type | Nullable | Default | Description |
|-------|-----------|------|----------|---------|-------------|
| `id` | `id` | `uuid` (PK, generated) | NO | `uuid_generate_v4()` | Unique balance record identifier |
| `ownerId` | `owner_id` | `varchar(50)` | NO | — | Billable user ID (references `users.id`) |
| `ownerType` | `owner_type` | `varchar(20)` | NO | `'user'` | Owner type discriminator (`user`, future: `team`, `org`) |
| `planId` | `plan_id` | `varchar(50)` | NO | `'free'` | Current plan ID (from `PLAN_IDS`: free/starter/pro/team) |
| `balance` | `balance` | `integer` | NO | `0` | Current available credit balance (non-negative) |
| `monthlyAllocation` | `monthly_allocation` | `integer` | NO | `0` | Credits allocated per billing period |
| `rolloverBalance` | `rollover_balance` | `integer` | NO | `0` | Credits rolled over from prior period (if applicable) |
| `status` | `status` | `varchar(20)` | NO | `'active'` | Balance status: `active`, `suspended`, `exhausted` |
| `periodStart` | `period_start` | `timestamp` | NO | — | Current billing period start (UTC) |
| `periodEnd` | `period_end` | `timestamp` | NO | — | Current billing period end (UTC) |
| `resetAt` | `reset_at` | `timestamp` | YES | `NULL` | Next scheduled balance reset timestamp |
| `createdAt` | `created_at` | `timestamp` | NO | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updatedAt` | `updated_at` | `timestamp` | NO | `CURRENT_TIMESTAMP` | Last modification timestamp |

**Constraints:**

| Constraint | Type | Columns | Notes |
|-----------|------|---------|-------|
| PK | Primary Key | `id` | UUID v4 |
| UQ_credit_balances_owner | Unique | `owner_id`, `owner_type` | One balance record per owner |
| CHK_credit_balances_balance_non_negative | Check | `balance >= 0` | Balance cannot go negative |
| CHK_credit_balances_period_valid | Check | `period_start < period_end` | Period must be valid range |

**Indexes:**

| Index | Columns | Unique | Notes |
|-------|---------|--------|-------|
| `idx_credit_balances_owner` | `owner_id`, `owner_type` | YES | Fast lookup by owner (also enforces uniqueness) |
| `idx_credit_balances_status` | `status` | NO | Filter by balance status |
| `idx_credit_balances_reset_at` | `reset_at` | NO | Periodic reset job queries |

**Design decisions:**
- One balance row per user (not per plan or per period). Plan changes update the existing row.
- `balance` is always non-negative. The application layer enforces this via `creditsOverflow` semantics.
- `ownerType` discriminator enables future team/org billing without schema migration.
- `rolloverBalance` is tracked separately from `balance` for audit purposes but is included in the effective `balance`.

---

### 2.2 CreditDeductionRecord Entity

**Table name:** `credit_deduction_records`

| Field | DB Column | Type | Nullable | Default | Description |
|-------|-----------|------|----------|---------|-------------|
| `id` | `id` | `uuid` (PK, generated) | NO | `uuid_generate_v4()` | Unique deduction record identifier |
| `ownerId` | `owner_id` | `varchar(50)` | NO | — | Billable user ID |
| `sourceEventId` | `source_event_id` | `varchar(255)` | NO | — | Idempotency key — globally unique per deduction attempt |
| `sourceEventType` | `source_event_type` | `varchar(50)` | NO | — | Source system type (maps to `CreditDeductionSource`: `usage_ledger`, `token_usage`) |
| `agentId` | `agent_id` | `varchar(100)` | YES | `NULL` | Agent identifier if deduction is agent-associated |
| `sessionId` | `session_id` | `uuid` | YES | `NULL` | Session identifier if available |
| `executionId` | `execution_id` | `uuid` | YES | `NULL` | Execution identifier if available |
| `modelId` | `model_id` | `varchar(100)` | YES | `NULL` | AI model identifier if applicable |
| `requestedCredits` | `requested_credits` | `integer` | NO | `0` | Total credits calculated/requested for this event |
| `appliedCredits` | `applied_credits` | `integer` | NO | `0` | Credits actually deducted from balance |
| `overflowCredits` | `overflow_credits` | `integer` | NO | `0` | Credits that exceeded available balance (overflow) |
| `balanceBefore` | `balance_before` | `integer` | NO | — | User's balance before this deduction |
| `balanceAfter` | `balance_after` | `integer` | NO | — | User's balance after this deduction |
| `lineItems` | `line_items` | `jsonb` | NO | `'[]'` | Per-category breakdown (array of `CreditDeductionLineItemResult`) |
| `metadata` | `metadata` | `jsonb` | YES | `NULL` | Arbitrary metadata from the source event |
| `status` | `status` | `varchar(20)` | NO | `'applied'` | Record status: `applied`, `skipped_duplicate`, `failed`, `reversed` |
| `createdAt` | `created_at` | `timestamp` | NO | `CURRENT_TIMESTAMP` | Record creation timestamp |

**Constraints:**

| Constraint | Type | Columns | Notes |
|-----------|------|---------|-------|
| PK | Primary Key | `id` | UUID v4 |
| UQ_credit_deduction_records_source_event | Unique | `source_event_id` | Idempotency — one record per source event |
| CHK_credit_deduction_records_credits_non_negative | Check | `requested_credits >= 0 AND applied_credits >= 0 AND overflow_credits >= 0` | Credits cannot be negative |
| CHK_credit_deduction_records_balance_consistency | Check | `balance_before >= balance_after` | Balance must not increase from a deduction |

**Indexes:**

| Index | Columns | Unique | Notes |
|-------|---------|--------|-------|
| `idx_credit_deduction_records_source_event` | `source_event_id` | YES | Fast idempotency lookup (also enforces uniqueness) |
| `idx_credit_deduction_records_owner_created` | `owner_id`, `created_at` | NO | User deduction history queries (ordered) |
| `idx_credit_deduction_records_owner_status` | `owner_id`, `status` | NO | Filter by owner + status (e.g., find applied deductions) |
| `idx_credit_deduction_records_session` | `session_id` | NO | Session-level deduction lookup (where NOT NULL) |
| `idx_credit_deduction_records_execution` | `execution_id` | NO | Execution-level deduction lookup (where NOT NULL) |
| `idx_credit_deduction_records_created_at` | `created_at` | NO | Time-range audit queries |

**Design decisions:**
- `sourceEventId` unique constraint is the core idempotency mechanism. No second row can exist for the same source event.
- `lineItems` stored as JSONB array — preserves the per-category breakdown without a separate join table. Schema matches `CreditDeductionLineItemResult[]`.
- Immutable after creation: no UPDATE operations permitted on deduction records (except `status` for reversals, which are a future concern).
- `balanceBefore` and `balanceAfter` are snapshot values captured at deduction time for audit trail.
- `status = 'skipped_duplicate'` is never written as a row — duplicates return the existing row with the existing status. The `skippedDuplicate` flag in the gateway response is derived from the duplicate detection path, not from a stored status.

---

## 3. Idempotency Model

### 3.1 Core Principle

Every credit deduction is identified by a unique `sourceEventId`. The uniqueness constraint on `credit_deduction_records.source_event_id` guarantees that no source event can produce more than one deduction record.

### 3.2 Deduplication Flow

```
1. Gateway receives CreditDeductionEvent with sourceEventId
2. Query: SELECT * FROM credit_deduction_records WHERE source_event_id = :sourceEventId
3. IF row exists:
   → Return existing result with skippedDuplicate = true (per line item)
   → No balance mutation
   → No new row inserted
4. IF row does NOT exist:
   → Proceed to deduction transaction (see Section 4)
   → INSERT new deduction record
   → UPDATE balance
   → Return result with skippedDuplicate = false
```

### 3.3 Race Condition Handling

If two concurrent requests arrive with the same `sourceEventId`:
- The unique constraint on `source_event_id` prevents double-insert.
- The second INSERT will fail with a unique constraint violation.
- The gateway catches this specific error and falls back to the SELECT path (returns existing row).
- This is retry-safe: the caller gets the same result regardless of timing.

### 3.4 Idempotency Guarantee

- **Same input → same output** (within the same balance state).
- **No double deduction** — the `source_event_id` unique constraint makes this physically impossible.
- **Retry-safe** — callers may safely retry failed network calls. If the deduction was committed, the retry returns the prior result. If the deduction was not committed, the retry creates a new deduction.

---

## 4. Transaction Model

### 4.1 Atomic Deduction Transaction

Each deduction executes within a single database transaction:

```
BEGIN TRANSACTION (SERIALIZABLE or FOR UPDATE row lock)

  1. SELECT balance FROM credit_balances WHERE owner_id = :ownerId FOR UPDATE
     → Acquires row lock, prevents concurrent balance reads from seeing stale data

  2. Calculate: appliedCredits = min(requestedCredits, currentBalance)
              overflowCredits = requestedCredits - appliedCredits
              newBalance = currentBalance - appliedCredits

  3. INSERT INTO credit_deduction_records (...)
     → With balanceBefore = currentBalance, balanceAfter = newBalance
     → Status = 'applied'
     → sourceEventId = event.sourceEventId

  4. UPDATE credit_balances SET balance = :newBalance, updated_at = NOW()
     WHERE owner_id = :ownerId AND balance = :currentBalance
     → Optimistic check: if balance changed between step 1 and 4, retry

COMMIT

Return CreditDeductionResult with balanceAfter = newBalance
```

### 4.2 Concurrency Strategy

**Primary:** `SELECT ... FOR UPDATE` row-level lock on `credit_balances`.

This serializes deductions for the same user. Concurrent deductions for different users proceed in parallel without contention.

**Why not SERIALIZABLE isolation?** PostgreSQL SERIALIZABLE can cause serialization failures that require full transaction retry. `FOR UPDATE` row locks are simpler, more predictable, and sufficient for the single-row-per-user balance model.

### 4.3 Rollback Behavior

- If any step (INSERT or UPDATE) fails, the entire transaction rolls back.
- Balance remains unchanged.
- No deduction record is persisted.
- The gateway returns a failed result (or throws, caught by the non-breaking error wrapper in `UsageLedgerService`).

### 4.4 Failure Modes

| Failure | Behavior | Caller Impact |
|---------|----------|---------------|
| DB connection error | Transaction never starts | Gateway throws; caught by caller wrapper as WARN |
| Balance row not found | Transaction aborts | Gateway returns error; balance must be provisioned before deduction |
| Unique constraint on sourceEventId | Caught; SELECT fallback | Caller receives existing result (idempotent) |
| Optimistic balance check fails | Retry within transaction | Transparent to caller (implementation detail) |
| Unexpected DB error | Transaction rolls back | Gateway throws; caught by caller wrapper |

---

## 5. Repository and Service Contracts

### 5.1 CreditBalanceRepository

```typescript
interface CreditBalanceRepository {
  /**
   * Find balance record by owner. Returns null if not provisioned.
   */
  findByOwner(ownerId: string, ownerType?: string): Promise<CreditBalance | null>;

  /**
   * Find balance and acquire row lock (FOR UPDATE).
   * Must be called within an active transaction.
   */
  findByOwnerForUpdate(ownerId: string, ownerType?: string): Promise<CreditBalance | null>;

  /**
   * Create a new balance record (used during user provisioning / plan activation).
   */
  create(params: CreateCreditBalanceParams): Promise<CreditBalance>;

  /**
   * Update balance after deduction. Only updates balance and updatedAt.
   * Returns updated entity.
   */
  deductBalance(id: string, newBalance: number): Promise<CreditBalance>;

  /**
   * Reset balance for a new billing period.
   * Sets balance = monthlyAllocation + rolloverBalance, updates period dates.
   */
  resetForNewPeriod(id: string, params: ResetBalanceParams): Promise<CreditBalance>;
}
```

### 5.2 CreditDeductionRecordRepository

```typescript
interface CreditDeductionRecordRepository {
  /**
   * Find existing deduction record by sourceEventId (idempotency lookup).
   */
  findBySourceEventId(sourceEventId: string): Promise<CreditDeductionRecord | null>;

  /**
   * Create a new deduction record. Throws on unique constraint violation
   * (caller handles as idempotency race condition).
   */
  create(params: CreateDeductionRecordParams): Promise<CreditDeductionRecord>;

  /**
   * Find deduction history for an owner, ordered by createdAt descending.
   * Supports pagination via offset/limit.
   */
  findByOwner(ownerId: string, options?: PaginationOptions): Promise<CreditDeductionRecord[]>;

  /**
   * Find deduction records by session (for session-level audit).
   */
  findBySession(sessionId: string): Promise<CreditDeductionRecord[]>;

  /**
   * Find deduction records by execution (for execution-level audit).
   */
  findByExecution(executionId: string): Promise<CreditDeductionRecord[]>;
}
```

### 5.3 PersistentCreditDeductionGateway

```typescript
/**
 * Replaces CalculatingCreditDeductionGateway as the bound implementation
 * in CreditDeductionModule. Persists deduction records and mutates balance.
 *
 * Implements:
 * - Idempotency via sourceEventId lookup
 * - Atomic transaction (balance lock → deduct → record → commit)
 * - creditsOverflow enforcement (balance ceiling)
 * - balanceAfter population from actual stored balance
 * - Non-breaking error semantics (extends CreditDeductionGateway)
 */
class PersistentCreditDeductionGateway extends CreditDeductionGateway {
  constructor(
    private readonly creditBalanceRepository: CreditBalanceRepository,
    private readonly deductionRecordRepository: CreditDeductionRecordRepository,
    private readonly creditCalculationService: CreditCalculationService,
    private readonly dataSource: DataSource,
  ) { super(); }

  async applyDeduction(event: CreditDeductionEvent): Promise<CreditDeductionResult> {
    // 1. Idempotency check
    // 2. Begin transaction with FOR UPDATE lock
    // 3. Calculate credits via CreditCalculationService
    // 4. Apply overflow logic (cap at available balance)
    // 5. Insert deduction record
    // 6. Update balance
    // 7. Commit and return result
  }
}
```

**Key design note:** The gateway signature changes from synchronous (`CreditDeductionResult`) to asynchronous (`Promise<CreditDeductionResult>`) when persistence is introduced. The abstract `CreditDeductionGateway` base class must be updated to return `Promise<CreditDeductionResult>` (or `CreditDeductionResult | Promise<CreditDeductionResult>`). The existing `CalculatingCreditDeductionGateway` and `NoOpCreditDeductionGateway` continue to work because sync return values are valid Promises. The caller (`UsageLedgerService.emitDeductionAttempt()`) already wraps the call in a try/catch; it must `await` the result.

### 5.4 Interaction with Existing CreditDeductionGateway

The existing `CreditDeductionGateway` abstract class remains the single entry point token. `PersistentCreditDeductionGateway` extends it. The `CreditDeductionModule` provider binding changes from:

```typescript
{ provide: CreditDeductionGateway, useClass: CalculatingCreditDeductionGateway }
```

to:

```typescript
{ provide: CreditDeductionGateway, useClass: PersistentCreditDeductionGateway }
```

`CalculatingCreditDeductionGateway` remains available as a utility (used internally by the persistent gateway for credit calculation) but is no longer the primary bound gateway.

---

## 6. Migration Plan (BILLING-READY-03B)

### 6.1 Migration File

**Filename:** `1772100000000-CreateCreditBalanceAndDeductionTables.ts`  
(Timestamp chosen to be after the latest migration `1772000000000`)

### 6.2 Migration UP — Create Tables

```sql
-- Table: credit_balances
CREATE TABLE credit_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id VARCHAR(50) NOT NULL,
  owner_type VARCHAR(20) NOT NULL DEFAULT 'user',
  plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
  balance INTEGER NOT NULL DEFAULT 0,
  monthly_allocation INTEGER NOT NULL DEFAULT 0,
  rollover_balance INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  reset_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_credit_balances_balance_non_negative CHECK (balance >= 0),
  CONSTRAINT chk_credit_balances_period_valid CHECK (period_start < period_end)
);

-- Table: credit_deduction_records
CREATE TABLE credit_deduction_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id VARCHAR(50) NOT NULL,
  source_event_id VARCHAR(255) NOT NULL,
  source_event_type VARCHAR(50) NOT NULL,
  agent_id VARCHAR(100) NULL,
  session_id UUID NULL,
  execution_id UUID NULL,
  model_id VARCHAR(100) NULL,
  requested_credits INTEGER NOT NULL DEFAULT 0,
  applied_credits INTEGER NOT NULL DEFAULT 0,
  overflow_credits INTEGER NOT NULL DEFAULT 0,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'applied',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_credit_deduction_records_credits_non_negative
    CHECK (requested_credits >= 0 AND applied_credits >= 0 AND overflow_credits >= 0),
  CONSTRAINT chk_credit_deduction_records_balance_consistency
    CHECK (balance_before >= balance_after)
);
```

### 6.3 Migration UP — Create Indexes

```sql
-- credit_balances indexes
CREATE UNIQUE INDEX idx_credit_balances_owner ON credit_balances (owner_id, owner_type);
CREATE INDEX idx_credit_balances_status ON credit_balances (status);
CREATE INDEX idx_credit_balances_reset_at ON credit_balances (reset_at) WHERE reset_at IS NOT NULL;

-- credit_deduction_records indexes
CREATE UNIQUE INDEX idx_credit_deduction_records_source_event ON credit_deduction_records (source_event_id);
CREATE INDEX idx_credit_deduction_records_owner_created ON credit_deduction_records (owner_id, created_at DESC);
CREATE INDEX idx_credit_deduction_records_owner_status ON credit_deduction_records (owner_id, status);
CREATE INDEX idx_credit_deduction_records_session ON credit_deduction_records (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_credit_deduction_records_execution ON credit_deduction_records (execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX idx_credit_deduction_records_created_at ON credit_deduction_records (created_at);
```

### 6.4 Migration DOWN — Rollback

```sql
DROP INDEX IF EXISTS idx_credit_deduction_records_created_at;
DROP INDEX IF EXISTS idx_credit_deduction_records_execution;
DROP INDEX IF EXISTS idx_credit_deduction_records_session;
DROP INDEX IF EXISTS idx_credit_deduction_records_owner_status;
DROP INDEX IF EXISTS idx_credit_deduction_records_owner_created;
DROP INDEX IF EXISTS idx_credit_deduction_records_source_event;
DROP INDEX IF EXISTS idx_credit_balances_reset_at;
DROP INDEX IF EXISTS idx_credit_balances_status;
DROP INDEX IF EXISTS idx_credit_balances_owner;
DROP TABLE IF EXISTS credit_deduction_records;
DROP TABLE IF EXISTS credit_balances;
```

### 6.5 Nullable vs Required Fields

| Entity | Nullable Fields | Required Fields |
|--------|----------------|-----------------|
| `CreditBalance` | `resetAt` | All others (id, ownerId, ownerType, planId, balance, monthlyAllocation, rolloverBalance, status, periodStart, periodEnd, createdAt, updatedAt) |
| `CreditDeductionRecord` | `agentId`, `sessionId`, `executionId`, `modelId`, `metadata` | All others (id, ownerId, sourceEventId, sourceEventType, requestedCredits, appliedCredits, overflowCredits, balanceBefore, balanceAfter, lineItems, status, createdAt) |

### 6.6 Rollback Notes

- Both tables are new — rollback simply drops them.
- No existing tables are modified.
- No foreign key references to/from existing tables (by design — loose coupling via `ownerId` value match, not FK constraint).
- No data migration required (fresh tables, empty on creation).

---

## 7. lineItems JSONB Schema

The `line_items` column stores an array of objects matching this TypeScript interface:

```typescript
interface StoredLineItemResult {
  category: string;        // CreditCategory value
  creditsRequested: number;
  creditsApplied: number;
  creditsOverflow: number;
  skippedDuplicate: boolean; // always false for stored records
}
```

This matches `CreditDeductionLineItemResult` from `billing/credit-deduction/types.ts`.

---

## 8. Explicit Non-Goals

- **No Stripe/payment integration** — this is credit ledger persistence only
- **No payment processing** — no charges, no invoices, no payment methods
- **No frontend billing UI** — no UI changes of any kind
- **No entitlement enforcement** — balance reaching 0 does not block execution
- **No production billing activation** — the pipeline records but does not gate
- **No Agent Harness activation** — remains deferred
- **No foreign keys to users table** — loose coupling via `ownerId` value matching
- **No balance provisioning automation** — manual/seeded for now; provisioning flow is a later slice
- **No rollover calculation automation** — `rolloverBalance` is stored but rollover logic is future scope
- **No multi-currency** — credits are a single abstract unit

---

## 9. BILLING-READY-03B Acceptance Criteria

The following checklist defines the concrete implementation requirements for BILLING-READY-03B:

### Entities
- [ ] `CreditBalance` TypeORM entity created at `services/api-gateway/src/entities/credit-balance.entity.ts`
- [ ] `CreditDeductionRecord` TypeORM entity created at `services/api-gateway/src/entities/credit-deduction-record.entity.ts`
- [ ] Entity field types, column names, constraints, and decorators match this design document exactly
- [ ] Entities registered in TypeORM module configuration

### Migration
- [ ] Migration file created: `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts`
- [ ] Migration UP creates both tables with all columns, constraints, and indexes per Section 6
- [ ] Migration DOWN drops both tables and all indexes cleanly
- [ ] Migration runs successfully against local PostgreSQL (forward and rollback)

### Repositories
- [ ] `CreditBalanceRepository` implemented with all methods from Section 5.1
- [ ] `CreditDeductionRecordRepository` implemented with all methods from Section 5.2
- [ ] Repositories use TypeORM `Repository<T>` or `EntityManager` patterns consistent with existing codebase
- [ ] `findByOwnerForUpdate` correctly uses `SELECT ... FOR UPDATE` within a transaction context

### Tests
- [ ] Repository unit tests created and passing
- [ ] Entity column mapping tests (verify TypeORM decorators produce correct SQL)
- [ ] Idempotency lookup test (`findBySourceEventId` returns existing record)
- [ ] `findByOwnerForUpdate` locking behavior test (within transaction context)

### Module Integration
- [ ] Repositories registered as NestJS providers in a dedicated persistence module
- [ ] Module can be imported by `CreditDeductionModule` (preparation for 03C)
- [ ] No gateway swap yet (CalculatingCreditDeductionGateway remains bound)

### Invariants
- [ ] No gateway swap (remains CalculatingCreditDeductionGateway)
- [ ] No balance enforcement (no blocking of execution)
- [ ] No Stripe/payment behavior
- [ ] No frontend changes
- [ ] Existing tests continue to pass
- [ ] TypeScript typecheck clean (`npx tsc --noEmit`)
- [ ] Build clean (`npm run build`)

---

## 10. Design Rationale Summary

| Decision | Rationale |
|----------|-----------|
| One balance row per user | Simplest model; plan changes update in place; no complex multi-row aggregation |
| Integer credits (not decimal) | Credit amounts are whole units per CREDIT_RATES config; avoids floating-point issues |
| `sourceEventId` unique constraint for idempotency | Database-enforced guarantee; no application-level race conditions possible |
| `FOR UPDATE` row lock (not SERIALIZABLE) | Simpler, more predictable; sufficient for single-row-per-user model |
| JSONB lineItems (not join table) | Fewer queries; atomic read/write; matches existing `BillingSnapshot.lineItems` pattern |
| No FK to users table | Loose coupling; credit system should not cascade on user deletion; value-based matching |
| Immutable deduction records | Audit-safe; reversals create new records, not mutations |
| `balanceBefore`/`balanceAfter` snapshot | Full audit trail without requiring ledger replay |
| Partial indexes for nullable columns | Smaller index size; better write performance for sparse columns |

---

## 11. Dependency Chain

```
BILLING-READY-00 (Audit/Planning) — COMPLETE and LOCKED
  └── BILLING-READY-01A (Architecture Review) — COMPLETE and LOCKED
        └── BILLING-READY-01 (Credit Ledger Foundation) — COMPLETE and LOCKED
              └── BILLING-READY-02A (Gateway Architecture) — COMPLETE and LOCKED
                    └── BILLING-READY-02B (Runtime Wiring) — COMPLETE and LOCKED
                          └── BILLING-READY-02C (Calculation Layer) — COMPLETE and LOCKED
                                └── BILLING-READY-02D (Simulation Validation) — COMPLETE and LOCKED
                                      └── BILLING-READY-03 (Registration) — ACTIVE
                                            └── BILLING-READY-03A (Schema Design) — COMPLETE and LOCKED
                                                  └── BILLING-READY-03B (Implementation) — NEXT
```

---

## 12. Document Authority

This document is the authoritative schema design reference for BILLING-READY-03B implementation. If implementation discovers a conflict between this design and runtime requirements, the conflict must be documented and resolved before proceeding — not silently deviated from.
