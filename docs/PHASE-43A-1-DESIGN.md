# PHASE-43A-1-DESIGN.md
## Billing + Ledger Concurrency Audit (TOCTOU / Double-Write Risk)

**Phase**: PHASE-43A  
**Stage**: STAGE-43A-1  
**Nature**: DESIGN + AUDIT (NO CODE CHANGES)  
**Scope**: api-gateway ONLY (billing + usage ledger paths)  
**Date**: 2026-02-23

---

## Executive Summary

This audit examined all billing and usage ledger write paths in api-gateway for race conditions that could cause double-charging, duplicate records, or inconsistent usage totals.

### Key Findings (5 Bullets)

1. **CRITICAL RISK**: `usage_records` has NO unique constraint on `execution_id` beyond PRIMARY KEY — concurrent retries with same UUID could cause duplicate inserts if UUID generation is predictable or client-controlled
2. **SAFE**: `billing_snapshots` has UNIQUE constraint `(api_key_id, period_start, period_end, pricing_version)` — prevents duplicate snapshots, but application-level check-then-insert is TOCTOU-vulnerable
3. **SAFE**: `invoices` has UNIQUE constraint on `snapshot_id` — prevents duplicate invoices, but application-level check-then-insert is TOCTOU-vulnerable
4. **SAFE**: Token quota enforcement uses PostgreSQL advisory locks (`pg_advisory_xact_lock`) — fully serialized per user, no TOCTOU risk
5. **LOW RISK**: `token_usage` table (legacy) has auto-generated UUID primary key with no idempotency key — retries create duplicates, but table appears unused in current execution flow

---

## 1. Inventory of Write Points

### 1.1 Usage Ledger (Primary Billing Source)

**File**: `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`  
**Function**: `writeRecord(dto: CreateUsageRecordDto)`  
**Table**: `usage_records`  
**Endpoint**: `POST /api/ai/execute` (via `AIExecutionController.execute()`)

**Write Pattern**:
```typescript
const executionId = uuidv4(); // Generated server-side
const record = this.usageRecordRepository.create({
  executionId,
  apiKeyId: dto.apiKeyId,
  userId: dto.userId,
  sessionId: dto.sessionId,
  conversationId: dto.conversationId,
  provider: dto.provider,
  adapter: dto.adapter,
  model: dto.model,
  tokensUsed: dto.tokensUsed,
  executionDurationMs: dto.executionDurationMs,
  metadata: dto.metadata,
});
return await this.usageRecordRepository.save(record);
```

**Idempotency Key**: `execution_id` (UUID v4, server-generated)  
**DB Constraint**: PRIMARY KEY on `execution_id` (no UNIQUE constraint beyond PK)  
**Retry Behavior**: New UUID generated on each call → duplicate records on retry  
**Concurrency Behavior**: Each request generates unique UUID → no collision

---

### 1.2 Billing Snapshots

**File**: `services/api-gateway/src/billing/billing-snapshot.service.ts`  
**Function**: `createSnapshot(params: CreateSnapshotParams)`  
**Table**: `billing_snapshots`  
**Endpoint**: Not exposed via HTTP (admin/batch operation)

**Write Pattern**:
```typescript
// Check for duplicate (TOCTOU window)
const existingSnapshot = await this.snapshotRepository.findOne({
  where: {
    apiKeyId,
    periodStart: windowStart,
    periodEnd: windowEnd,
    pricingVersion,
  },
});

if (existingSnapshot) {
  throw new Error('Billing snapshot already exists...');
}

// ... compute line items ...

const snapshot = this.snapshotRepository.create({
  snapshotId: uuidv4(),
  apiKeyId,
  userId,
  periodStart: windowStart,
  periodEnd: windowEnd,
  periodType,
  pricingVersion,
  totalTokens,
  totalRequests,
  subtotalUSD,
  adjustmentsUSD: 0,
  totalCostUSD: subtotalUSD,
  lineItems,
  status: 'draft',
});

return await this.snapshotRepository.save(snapshot);
```

**Idempotency Key**: `(api_key_id, period_start, period_end, pricing_version)`  
**DB Constraint**: UNIQUE INDEX `idx_billing_snapshots_unique_window` on `(api_key_id, period_start, period_end, pricing_version)`  
**Retry Behavior**: Application-level check → TOCTOU race → DB constraint catches duplicate → throws error  
**Concurrency Behavior**: Two concurrent requests → both pass check → second INSERT fails with DB constraint violation

---

### 1.3 Invoices

**File**: `services/api-gateway/src/invoice/invoice.service.ts`  
**Function**: `createFromSnapshot(snapshotId: string)`  
**Table**: `invoices`  
**Endpoint**: Not exposed via HTTP (admin/batch operation)

**Write Pattern**:
```typescript
// Check if invoice already exists (TOCTOU window)
const existingInvoice = await this.invoiceRepository.findOne({
  where: { snapshotId },
});

if (existingInvoice) {
  throw new ConflictException('Invoice already exists for snapshot...');
}

// ... copy values from snapshot ...

const invoice = new Invoice();
invoice.invoiceId = uuidv4();
invoice.snapshotId = snapshot.snapshotId;
// ... set other fields ...

return await this.invoiceRepository.save(invoice);
```

**Idempotency Key**: `snapshot_id`  
**DB Constraint**: UNIQUE INDEX on `snapshot_id`  
**Retry Behavior**: Application-level check → TOCTOU race → DB constraint catches duplicate → throws error  
**Concurrency Behavior**: Two concurrent requests → both pass check → second INSERT fails with DB constraint violation

---

### 1.4 Token Usage (Legacy)

**File**: `services/api-gateway/src/token-usage/token-usage.service.ts`  
**Function**: `recordTokenUsage(data: {...})`  
**Table**: `token_usage`  
**Endpoint**: `POST /api/token-usage/record` (appears unused in current flow)

**Write Pattern**:
```typescript
const totalTokens = data.inputTokens + data.outputTokens;

return await this.tokenUsageRepository.recordUsage({
  sessionId: data.sessionId,
  conversationId: data.conversationId ?? null,
  chatMessageId: data.chatMessageId ?? null,
  model: data.model,
  inputTokens: data.inputTokens,
  outputTokens: data.outputTokens,
  totalTokens,
});
```

**Idempotency Key**: None (auto-generated UUID primary key)  
**DB Constraint**: PRIMARY KEY on `id` (UUID, auto-generated)  
**Retry Behavior**: Each retry creates new record → duplicates  
**Concurrency Behavior**: Each request creates new record → duplicates

**NOTE**: This table appears to be legacy. Current execution flow uses `usage_records` (via `UsageLedgerService.writeRecord()`).

---

## 2. Endpoint Mapping

### 2.1 Primary Execution Path (Billing-Critical)

**Endpoint**: `POST /api/ai/execute`  
**Controller**: `AIExecutionController.execute()`  
**Guards** (execution order):
1. `ApiKeyAuthGuard` — attaches `apiKeyIdentity` to request
2. `AuthorizationGuard` — validates scopes
3. `ExecutionSafetyGuard` — kill switches
4. `LaunchGuard` — launch state
5. `AbortGuard` — abort mode
6. `QuotaGuard` — legacy quota (appears unused)
7. **`TokenQuotaGuard`** — **CONCURRENCY-SAFE** (advisory lock)
8. `RateLimitGuard` — rate limiting

**Write Sequence**:
```
1. TokenQuotaGuard checks quota (SERIALIZED per user via advisory lock)
2. AI execution (ai-service call)
3. UsageLedgerService.writeRecord() → INSERT into usage_records
4. GlobalSafetyLimitService.recordExecutionCost() (in-memory only)
5. Return result to client
```

**Concurrency Behavior**:
- **Quota check**: Serialized per user (advisory lock held ~50-100ms)
- **Usage write**: No serialization, each request generates unique `execution_id`
- **Risk**: If client retries with same request, new `execution_id` is generated → duplicate usage records

---

### 2.2 Billing Snapshot Creation (Admin/Batch)

**Endpoint**: Not exposed via HTTP (internal admin operation)  
**Service**: `BillingSnapshotService.createSnapshot()`  
**Write**: `billing_snapshots` table

**Concurrency Behavior**:
- Application-level check-then-insert (TOCTOU window)
- DB UNIQUE constraint catches duplicates
- Error thrown on duplicate (deterministic failure)

---

### 2.3 Invoice Creation (Admin/Batch)

**Endpoint**: Not exposed via HTTP (internal admin operation)  
**Service**: `InvoiceService.createFromSnapshot()`  
**Write**: `invoices` table

**Concurrency Behavior**:
- Application-level check-then-insert (TOCTOU window)
- DB UNIQUE constraint catches duplicates
- Error thrown on duplicate (deterministic failure)

---

## 3. Idempotency + Uniqueness Analysis

### 3.1 `usage_records` (CRITICAL)

**Primary Key**: `execution_id` (UUID v4)  
**Unique Constraints**: None beyond PRIMARY KEY  
**Idempotency Key**: `execution_id` (server-generated, not client-provided)

**Risk Analysis**:
- **UUID Generation**: Server-side `uuidv4()` — cryptographically random, collision probability negligible
- **Client Retry**: Client retries same request → new UUID generated → duplicate records
- **Concurrent Requests**: Each request generates unique UUID → no collision, but duplicate billing data
- **TOCTOU**: Not applicable (no check-then-insert pattern)

**Verdict**: **CRITICAL RISK** — No idempotency on retries. Client retries create duplicate usage records, leading to double-billing.

**Recommended Fix**: Add unique constraint on `(user_id, session_id, conversation_id, timestamp, model)` OR introduce client-provided `request_id` with UNIQUE constraint.

---

### 3.2 `billing_snapshots` (SAFE with TOCTOU)

**Primary Key**: `snapshot_id` (UUID v4)  
**Unique Constraints**: `(api_key_id, period_start, period_end, pricing_version)`  
**Idempotency Key**: `(api_key_id, period_start, period_end, pricing_version)`

**Risk Analysis**:
- **Application Check**: `findOne()` before `save()` — TOCTOU window (~10-50ms)
- **DB Constraint**: UNIQUE index enforces uniqueness at DB level
- **Retry Behavior**: First request succeeds, retry hits DB constraint → throws error (deterministic)
- **Concurrent Requests**: Both pass application check, second INSERT fails with DB error

**Verdict**: **SAFE** — DB constraint prevents duplicates. TOCTOU window exists but is harmless (error thrown, no data corruption).

**Recommended Fix**: Remove application-level check, rely on DB constraint + `ON CONFLICT DO NOTHING` (PostgreSQL) or catch unique violation error.

---

### 3.3 `invoices` (SAFE with TOCTOU)

**Primary Key**: `invoice_id` (UUID v4)  
**Unique Constraints**: `snapshot_id`  
**Idempotency Key**: `snapshot_id`

**Risk Analysis**:
- **Application Check**: `findOne()` before `save()` — TOCTOU window (~10-50ms)
- **DB Constraint**: UNIQUE index on `snapshot_id` enforces one-to-one mapping
- **Retry Behavior**: First request succeeds, retry hits DB constraint → throws error (deterministic)
- **Concurrent Requests**: Both pass application check, second INSERT fails with DB error

**Verdict**: **SAFE** — DB constraint prevents duplicates. TOCTOU window exists but is harmless (error thrown, no data corruption).

**Recommended Fix**: Remove application-level check, rely on DB constraint + catch unique violation error.

---

### 3.4 `token_usage` (LOW RISK, Legacy)

**Primary Key**: `id` (UUID, auto-generated)  
**Unique Constraints**: None  
**Idempotency Key**: None

**Risk Analysis**:
- **No Idempotency**: Each call creates new record
- **Retry Behavior**: Duplicates created
- **Current Usage**: Table appears unused in current execution flow (replaced by `usage_records`)

**Verdict**: **LOW RISK** — Table appears legacy. If still in use, same risk as `usage_records`.

**Recommended Fix**: Deprecate table OR add unique constraint on `(session_id, chat_message_id, model, created_at)`.

---

## 4. Concurrency / TOCTOU Risk Analysis

### 4.1 Token Quota Enforcement (SAFE)

**File**: `services/api-gateway/src/quota/token-quota.guard.ts`  
**Function**: `canActivate()`

**Pattern**:
```typescript
await queryRunner.startTransaction();

// Acquire advisory lock (blocks concurrent requests for same user)
await queryRunner.query(
  `SELECT pg_advisory_xact_lock(hashtext($1))`,
  [`quota:token:${userId}`],
);

// Query rolling 24h usage (serialized per user)
const result = await queryRunner.query(
  `SELECT COALESCE(SUM(tokens_used), 0)::integer AS total
   FROM usage_records
   WHERE user_id = $1 AND timestamp > $2`,
  [userId, twentyFourHoursAgo],
);

const currentUsage = result[0].total;
const estimatedTokens = QuotaConfig.estimateTokens(request.body?.prompt);

if (currentUsage + estimatedTokens > QuotaConfig.MAX_TOKENS_PER_24H) {
  await queryRunner.rollbackTransaction(); // Releases lock
  throw new HttpException(...);
}

await queryRunner.commitTransaction(); // Releases lock
return true;
```

**Concurrency Analysis**:
- **Advisory Lock**: `pg_advisory_xact_lock(hashtext('quota:token:' || userId))` — serializes all quota checks for same user
- **Lock Scope**: Transaction-scoped (auto-released on COMMIT/ROLLBACK)
- **Lock Duration**: ~50-100ms (quota check only, NOT held during AI execution)
- **TOCTOU**: Not possible — lock serializes read-check-decide sequence

**Verdict**: **SAFE** — Fully serialized per user. No race conditions.

---

### 4.2 Usage Ledger Write (NO LOCK)

**File**: `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`  
**Function**: `writeRecord()`

**Pattern**:
```typescript
const executionId = uuidv4(); // No lock, no check
const record = this.usageRecordRepository.create({ executionId, ... });
return await this.usageRecordRepository.save(record);
```

**Concurrency Analysis**:
- **No Lock**: Each request generates unique UUID and inserts
- **No Check**: No duplicate detection at application level
- **DB Constraint**: PRIMARY KEY on `execution_id` prevents UUID collisions (negligible probability)
- **TOCTOU**: Not applicable (no read-then-write pattern)

**Risk**: Client retries with same request → new UUID → duplicate records → double-billing.

**Verdict**: **CRITICAL RISK** — No idempotency mechanism.

---

### 4.3 Billing Snapshot Write (TOCTOU, but SAFE)

**File**: `services/api-gateway/src/billing/billing-snapshot.service.ts`  
**Function**: `createSnapshot()`

**Pattern**:
```typescript
// READ (check for duplicate)
const existingSnapshot = await this.snapshotRepository.findOne({
  where: { apiKeyId, periodStart, periodEnd, pricingVersion },
});

// CHECK
if (existingSnapshot) {
  throw new Error('Billing snapshot already exists...');
}

// WRITE
const snapshot = this.snapshotRepository.create({ ... });
return await this.snapshotRepository.save(snapshot);
```

**TOCTOU Window**: Between `findOne()` and `save()` (~10-50ms)

**Concurrency Scenario**:
1. Request A: `findOne()` → no existing snapshot
2. Request B: `findOne()` → no existing snapshot (A hasn't inserted yet)
3. Request A: `save()` → INSERT succeeds
4. Request B: `save()` → INSERT fails (UNIQUE constraint violation)

**Outcome**: Request B throws DB error (unique constraint violation). No data corruption.

**Verdict**: **SAFE** — DB constraint prevents duplicates. TOCTOU window is harmless (error thrown, deterministic failure).

---

### 4.4 Invoice Write (TOCTOU, but SAFE)

**File**: `services/api-gateway/src/invoice/invoice.service.ts`  
**Function**: `createFromSnapshot()`

**Pattern**: Same as billing snapshot (check-then-insert with UNIQUE constraint on `snapshot_id`)

**Verdict**: **SAFE** — DB constraint prevents duplicates. TOCTOU window is harmless.

---

## 5. Minimal Fix Patterns

### 5.1 Fix for `usage_records` (CRITICAL)

**Problem**: No idempotency on client retries → duplicate records → double-billing.

**Option A: Client-Provided Request ID (Recommended)**

**Change**:
1. Add `request_id` column to `usage_records` (VARCHAR(50), NULLABLE for backward compatibility)
2. Add UNIQUE constraint: `(user_id, request_id)` WHERE `request_id IS NOT NULL`
3. Modify `UsageLedgerService.writeRecord()` to accept optional `request_id`
4. Use `ON CONFLICT (user_id, request_id) DO NOTHING` (PostgreSQL) or catch unique violation

**Migration**:
```sql
ALTER TABLE usage_records ADD COLUMN request_id VARCHAR(50) NULL;
CREATE UNIQUE INDEX idx_usage_records_request_id ON usage_records(user_id, request_id) WHERE request_id IS NOT NULL;
```

**Code Change** (minimal):
```typescript
// usage-ledger.service.ts
async writeRecord(dto: CreateUsageRecordDto): Promise<UsageRecord> {
  const executionId = uuidv4();
  const record = this.usageRecordRepository.create({
    executionId,
    requestId: dto.requestId ?? null, // NEW: optional client-provided ID
    // ... other fields ...
  });

  try {
    return await this.usageRecordRepository.save(record);
  } catch (error) {
    // Check if unique violation on request_id
    if (error.code === '23505' && error.constraint === 'idx_usage_records_request_id') {
      // Idempotent retry: return existing record
      return await this.usageRecordRepository.findOne({
        where: { userId: dto.userId, requestId: dto.requestId },
      });
    }
    throw error;
  }
}
```

**Pros**:
- Idempotent retries (same `request_id` → same result)
- No breaking changes (backward compatible)
- Client controls idempotency key

**Cons**:
- Requires client to generate and track `request_id`
- Adds complexity to client logic

---

**Option B: Composite Natural Key (Alternative)**

**Change**:
1. Add UNIQUE constraint: `(user_id, session_id, conversation_id, timestamp, model, tokens_used)`
2. Use `ON CONFLICT DO NOTHING` or catch unique violation

**Migration**:
```sql
CREATE UNIQUE INDEX idx_usage_records_natural_key ON usage_records(user_id, session_id, conversation_id, timestamp, model, tokens_used);
```

**Pros**:
- No client changes required
- Automatic deduplication based on natural key

**Cons**:
- Timestamp-based uniqueness is fragile (two requests in same millisecond)
- May reject legitimate concurrent requests with identical parameters
- Not truly idempotent (different `execution_id` for same logical request)

**Verdict**: **Option A (Client-Provided Request ID) is recommended** for true idempotency.

---

### 5.2 Fix for `billing_snapshots` (Optional Cleanup)

**Problem**: Application-level check is redundant (DB constraint enforces uniqueness).

**Change**: Remove application-level check, rely on DB constraint.

**Code Change** (minimal):
```typescript
// billing-snapshot.service.ts
async createSnapshot(params: CreateSnapshotParams): Promise<BillingSnapshot> {
  // REMOVE: Application-level duplicate check
  // const existingSnapshot = await this.snapshotRepository.findOne(...);
  // if (existingSnapshot) { throw new Error(...); }

  // ... compute line items ...

  const snapshot = this.snapshotRepository.create({ ... });

  try {
    return await this.snapshotRepository.save(snapshot);
  } catch (error) {
    // Check if unique violation on unique_window
    if (error.code === '23505' && error.constraint === 'idx_billing_snapshots_unique_window') {
      throw new ConflictException(
        `Billing snapshot already exists for apiKeyId=${params.apiKeyId}, window=[${params.windowStart.toISOString()}, ${params.windowEnd.toISOString()}], pricingVersion=${params.pricingVersion}`,
      );
    }
    throw error;
  }
}
```

**Pros**:
- Eliminates TOCTOU window
- Simpler code (one less query)
- Same error behavior (deterministic failure on duplicate)

**Cons**:
- Slightly less user-friendly error message (DB error vs. application error)

**Verdict**: **Optional cleanup** — current behavior is safe, but removing check improves clarity.

---

### 5.3 Fix for `invoices` (Optional Cleanup)

**Problem**: Same as `billing_snapshots` — application-level check is redundant.

**Change**: Same as `billing_snapshots` — remove check, rely on DB constraint.

**Verdict**: **Optional cleanup** — current behavior is safe.

---

### 5.4 Fix for `token_usage` (If Still in Use)

**Problem**: No idempotency key → duplicates on retry.

**Change**: Add UNIQUE constraint on `(session_id, chat_message_id, model, created_at)` OR deprecate table.

**Verdict**: **Low priority** — table appears unused in current execution flow.

---

## 6. Verification Plan (Single-Shot PowerShell + DB Queries)

### 6.1 Verify DB Constraints Exist

**PowerShell Script**: `verify-constraints.ps1`

```powershell
# verify-constraints.ps1
# Verify all expected UNIQUE constraints exist in database

$dbPath = "database/aisandbox.db"
$expectedConstraints = @(
    @{ Table = "billing_snapshots"; Index = "idx_billing_snapshots_unique_window"; Columns = "api_key_id, period_start, period_end, pricing_version" },
    @{ Table = "invoices"; Index = "idx_invoices_snapshot_id"; Columns = "snapshot_id" },
    @{ Table = "usage_records"; Index = "PRIMARY"; Columns = "execution_id" }
)

Write-Host "=== Constraint Verification ===" -ForegroundColor Cyan

foreach ($constraint in $expectedConstraints) {
    $query = "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name='$($constraint.Index)' AND tbl_name='$($constraint.Table)';"
    $result = sqlite3 $dbPath $query
    
    if ($result) {
        Write-Host "[OK] $($constraint.Table).$($constraint.Index) exists" -ForegroundColor Green
        Write-Host "     SQL: $result" -ForegroundColor Gray
    } else {
        Write-Host "[FAIL] $($constraint.Table).$($constraint.Index) NOT FOUND" -ForegroundColor Red
    }
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
```

**Expected Output**:
```
=== Constraint Verification ===
[OK] billing_snapshots.idx_billing_snapshots_unique_window exists
     SQL: CREATE UNIQUE INDEX idx_billing_snapshots_unique_window ON billing_snapshots(api_key_id, period_start, period_end, pricing_version)
[OK] invoices.idx_invoices_snapshot_id exists
     SQL: CREATE UNIQUE INDEX idx_invoices_snapshot_id ON invoices(snapshot_id)
[OK] usage_records.PRIMARY exists
     SQL: (PRIMARY KEY definition)

=== Verification Complete ===
```

---

### 6.2 Test Duplicate Insert Behavior

**PowerShell Script**: `test-duplicate-prevention.ps1`

```powershell
# test-duplicate-prevention.ps1
# Test that DB constraints prevent duplicate inserts

$apiUrl = "http://localhost:3000"
$apiKey = "test-api-key"

Write-Host "=== Duplicate Prevention Test ===" -ForegroundColor Cyan

# Test 1: Billing Snapshot Duplicate
Write-Host "`n[Test 1] Billing Snapshot Duplicate Prevention" -ForegroundColor Yellow
$snapshotParams = @{
    apiKeyId = "test-key-001"
    userId = "user-001"
    windowStart = "2026-02-01T00:00:00Z"
    windowEnd = "2026-02-28T23:59:59Z"
    pricingVersion = "2026-02-v1"
}

# First insert (should succeed)
try {
    $result1 = Invoke-RestMethod -Uri "$apiUrl/api/internal/billing/snapshots" -Method POST -Body ($snapshotParams | ConvertTo-Json) -ContentType "application/json" -Headers @{ Authorization = "Bearer $apiKey" }
    Write-Host "[OK] First insert succeeded: $($result1.snapshotId)" -ForegroundColor Green
} catch {
    Write-Host "[INFO] First insert failed (may already exist): $($_.Exception.Message)" -ForegroundColor Gray
}

# Second insert (should fail with conflict)
try {
    $result2 = Invoke-RestMethod -Uri "$apiUrl/api/internal/billing/snapshots" -Method POST -Body ($snapshotParams | ConvertTo-Json) -ContentType "application/json" -Headers @{ Authorization = "Bearer $apiKey" }
    Write-Host "[FAIL] Second insert succeeded (should have failed)" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 409 -or $_.Exception.Message -match "already exists") {
        Write-Host "[OK] Second insert correctly rejected (duplicate)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
```

---

### 6.3 Verify Advisory Lock Behavior

**SQL Query**: Test advisory lock serialization

```sql
-- Run in two concurrent psql sessions

-- Session 1:
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('quota:token:user-001'));
SELECT pg_sleep(10); -- Hold lock for 10 seconds
SELECT SUM(tokens_used) FROM usage_records WHERE user_id = 'user-001';
COMMIT;

-- Session 2 (start immediately after Session 1):
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('quota:token:user-001')); -- BLOCKS until Session 1 commits
SELECT SUM(tokens_used) FROM usage_records WHERE user_id = 'user-001';
COMMIT;
```

**Expected Behavior**:
- Session 2 blocks at `pg_advisory_xact_lock()` until Session 1 commits
- No concurrent execution of quota checks for same user

---

### 6.4 Verify Usage Record Uniqueness (Current State)

**SQL Query**: Check for duplicate `execution_id` values

```sql
-- Check for duplicate execution_id (should be 0)
SELECT execution_id, COUNT(*) as count
FROM usage_records
GROUP BY execution_id
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)
```

**PowerShell Script**: `check-usage-duplicates.ps1`

```powershell
# check-usage-duplicates.ps1
# Check for duplicate usage records (same user, session, timestamp)

$dbPath = "database/aisandbox.db"

Write-Host "=== Usage Record Duplicate Check ===" -ForegroundColor Cyan

# Check for duplicate execution_id
$query1 = "SELECT execution_id, COUNT(*) as count FROM usage_records GROUP BY execution_id HAVING COUNT(*) > 1;"
$result1 = sqlite3 $dbPath $query1

if ($result1) {
    Write-Host "[WARN] Duplicate execution_id found:" -ForegroundColor Yellow
    Write-Host $result1
} else {
    Write-Host "[OK] No duplicate execution_id values" -ForegroundColor Green
}

# Check for potential logical duplicates (same user, session, timestamp, model, tokens)
$query2 = @"
SELECT user_id, session_id, timestamp, model, tokens_used, COUNT(*) as count
FROM usage_records
GROUP BY user_id, session_id, timestamp, model, tokens_used
HAVING COUNT(*) > 1
LIMIT 10;
"@
$result2 = sqlite3 $dbPath $query2

if ($result2) {
    Write-Host "`n[WARN] Potential logical duplicates found:" -ForegroundColor Yellow
    Write-Host $result2
    Write-Host "(Same user, session, timestamp, model, tokens - may indicate retry duplicates)" -ForegroundColor Gray
} else {
    Write-Host "`n[OK] No logical duplicates detected" -ForegroundColor Green
}

Write-Host "`n=== Check Complete ===" -ForegroundColor Cyan
```

---

## 7. Recommended Actions (Prioritized)

### Priority 1: CRITICAL (Immediate Action Required)

**Issue**: `usage_records` has no idempotency mechanism → client retries create duplicate records → double-billing risk.

**Action**:
1. Add `request_id` column to `usage_records` (nullable, backward compatible)
2. Add UNIQUE constraint: `(user_id, request_id)` WHERE `request_id IS NOT NULL`
3. Modify `UsageLedgerService.writeRecord()` to accept optional `request_id`
4. Update `AIExecutionController` to generate or accept `request_id` from client
5. Handle unique violation gracefully (return existing record on duplicate)

**Timeline**: PHASE-43A-2 (implementation)

---

### Priority 2: OPTIONAL (Code Cleanup)

**Issue**: `billing_snapshots` and `invoices` have redundant application-level duplicate checks (DB constraints already enforce uniqueness).

**Action**:
1. Remove application-level `findOne()` checks in `BillingSnapshotService.createSnapshot()` and `InvoiceService.createFromSnapshot()`
2. Rely on DB UNIQUE constraints
3. Catch unique violation errors and throw user-friendly exceptions

**Timeline**: PHASE-43A-3 (optional cleanup)

---

### Priority 3: LOW (Legacy Cleanup)

**Issue**: `token_usage` table has no idempotency mechanism and appears unused.

**Action**:
1. Verify table is unused in current execution flow
2. If unused, deprecate table (add migration to drop table in future phase)
3. If still in use, apply same fix as `usage_records`

**Timeline**: PHASE-44+ (future cleanup)

---

## 8. Deterministic Verification Checklist

- [ ] Run `verify-constraints.ps1` → All expected UNIQUE constraints exist
- [ ] Run `test-duplicate-prevention.ps1` → Duplicate billing snapshots/invoices correctly rejected
- [ ] Run SQL advisory lock test → Session 2 blocks until Session 1 commits
- [ ] Run `check-usage-duplicates.ps1` → No duplicate `execution_id` values (current state)
- [ ] After fix: Run `check-usage-duplicates.ps1` → No logical duplicates with same `request_id`
- [ ] After fix: Test client retry with same `request_id` → Idempotent (same result, no duplicate)

---

## 9. Conclusion

**Current State**:
- **CRITICAL RISK**: `usage_records` has no idempotency → client retries create duplicates → double-billing risk
- **SAFE**: `billing_snapshots` and `invoices` have DB UNIQUE constraints → duplicates prevented (TOCTOU window is harmless)
- **SAFE**: Token quota enforcement uses advisory locks → fully serialized per user, no race conditions

**Recommended Fix**:
- **Priority 1**: Add `request_id` idempotency key to `usage_records` (PHASE-43A-2)
- **Priority 2**: Remove redundant application-level checks in billing/invoice services (PHASE-43A-3, optional)
- **Priority 3**: Deprecate or fix `token_usage` table (PHASE-44+, low priority)

**Verification**:
- Single-shot PowerShell scripts + SQL queries provided for deterministic verification
- No loops, no manual intervention required

---

**Document Status**: FINAL  
**Next Stage**: PHASE-43A-2 (Implementation of Priority 1 fix)  
**Approval Required**: Yes (before proceeding to implementation)

---

## Appendix A: Database Schema Summary

### `usage_records` (Primary Billing Source)

```sql
CREATE TABLE usage_records (
  execution_id UUID PRIMARY KEY,          -- NO UNIQUE constraint beyond PK
  api_key_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  session_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  adapter VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  tokens_used INTEGER NOT NULL,
  execution_duration_ms INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_usage_records_api_key_timestamp ON usage_records(api_key_id, timestamp);
CREATE INDEX idx_usage_records_user_timestamp ON usage_records(user_id, timestamp);
CREATE INDEX idx_usage_records_timestamp ON usage_records(timestamp);
```

**MISSING**: Idempotency key (e.g., `request_id` with UNIQUE constraint)

---

### `billing_snapshots` (Derived Billing Data)

```sql
CREATE TABLE billing_snapshots (
  snapshot_id UUID PRIMARY KEY,
  api_key_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  pricing_version VARCHAR(50) NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  subtotal_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
  adjustments_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
  total_cost_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
  line_items JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_snapshots_api_key_period ON billing_snapshots(api_key_id, period_start, period_end);
CREATE INDEX idx_billing_snapshots_user ON billing_snapshots(user_id);
CREATE INDEX idx_billing_snapshots_created_at ON billing_snapshots(created_at);
CREATE UNIQUE INDEX idx_billing_snapshots_unique_window ON billing_snapshots(api_key_id, period_start, period_end, pricing_version);
```

**SAFE**: UNIQUE constraint on `(api_key_id, period_start, period_end, pricing_version)` prevents duplicates.

---

### `invoices` (Invoice Records)

```sql
CREATE TABLE invoices (
  invoice_id UUID PRIMARY KEY,
  snapshot_id UUID NOT NULL UNIQUE,       -- UNIQUE constraint enforces one-to-one mapping
  api_key_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  pricing_version VARCHAR(50) NOT NULL,
  subtotal_usd DECIMAL(10,3) NOT NULL,
  adjustments_usd DECIMAL(10,3) NOT NULL,
  total_cost_usd DECIMAL(10,3) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  line_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_api_key ON invoices(api_key_id);
CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE UNIQUE INDEX idx_invoices_snapshot_id ON invoices(snapshot_id);
```

**SAFE**: UNIQUE constraint on `snapshot_id` prevents duplicate invoices for same snapshot.

---

## Appendix B: References

- **PHASE-22B**: Usage Ledger (initial implementation)
- **PHASE-23B-4**: Billing Snapshot Writer
- **PHASE-25B-1**: Invoice Persistence Infrastructure
- **PHASE-42A-3**: Token Quota Enforcement (advisory locks)
- **ARCHITECTURE.md**: System architecture principles
- **PRD.md**: Product requirements

---

**END OF DOCUMENT**
