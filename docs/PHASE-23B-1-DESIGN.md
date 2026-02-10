# PHASE 23B-1 DESIGN: Billing Read Model (Design Only)

**Status:** DESIGN-ONLY (No Implementation)
**Nature:** Read-Only Billing View Design
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 23B (Billing Implementation)
**Prerequisite:** Phase 22 (Usage Ledger) COMPLETE, Phase 23A (Billing Design) COMPLETE

---

## 1. Overview

### 1.1 Purpose

Phase 23B-1 defines a read-only Billing View that queries and aggregates immutable Usage Ledger records (Phase 22) to support future billing calculation. This design establishes how usage data is queried, grouped, and aggregated without performing any pricing or monetary calculations.

### 1.2 Scope

**Design Scope:**
- Billing period definitions (daily, monthly)
- Aggregation grouping keys (apiKeyId, provider, model)
- Aggregation outputs (totalTokens, totalRequests, totalDuration)
- Read semantics (query patterns, consistency)
- Failure behavior (errors, no retries)

**Implementation Scope:**
- NONE in this phase (Phase 23B-1 is design only)
- Phase 23B-2 will implement the design

### 1.3 Core Principles

**Read Model Principles:**
- ✅ Read-only (no writes, no updates)
- ✅ Derived from Usage Ledger (source of truth)
- ✅ Deterministic (same inputs → same outputs)
- ✅ No caching (query on demand)
- ✅ No mutation (immutable source data)
- ✅ No external dependencies (self-contained)

---

## 2. Billing Read Model

### 2.1 Logical Model Definition

**BillingView (Conceptual):**
```typescript
interface BillingView {
  // Aggregation Period
  period: BillingPeriod;           // Time period for aggregation

  // Grouping Keys
  apiKeyId: string;                // API key identifier
  provider: string;                // AI provider (e.g., 'anthropic')
  model: string;                   // Model (e.g., 'claude-3-5-sonnet-20241022')

  // Aggregation Outputs
  totalTokens: number;             // Sum of tokensUsed
  totalRequests: number;           // Count of executions
  totalDurationMs: number;         // Sum of executionDurationMs

  // Metadata
  periodStart: Date;               // Period start timestamp (UTC)
  periodEnd: Date;                 // Period end timestamp (UTC)
}
```

### 2.2 Billing Period Definitions

**Supported Periods:**

**Daily Period:**
- Duration: 24 hours
- Boundary: 00:00:00 UTC to 23:59:59.999 UTC
- Start: YYYY-MM-DD 00:00:00 UTC
- End: YYYY-MM-DD 23:59:59.999 UTC
- Example: 2026-02-06 00:00:00 to 2026-02-06 23:59:59.999

**Monthly Period:**
- Duration: Calendar month (28-31 days)
- Boundary: First day 00:00:00 UTC to last day 23:59:59.999 UTC
- Start: YYYY-MM-01 00:00:00 UTC
- End: YYYY-MM-[last day] 23:59:59.999 UTC
- Example: 2026-02-01 00:00:00 to 2026-02-28 23:59:59.999

**Period Characteristics:**
- Fixed boundaries (clock-based, not sliding)
- UTC timezone only (no local timezone handling)
- Inclusive start, inclusive end
- No overlap between periods
- No gaps between periods

### 2.3 Grouping Keys

**Primary Grouping: apiKeyId**
- Purpose: Aggregate usage per API key (for per-customer billing)
- Cardinality: One BillingView per apiKeyId per period
- Example: key-test → total usage for key-test in February 2026

**Secondary Grouping: provider + model**
- Purpose: Breakdown usage by AI provider and model
- Cardinality: One BillingView per (apiKeyId, provider, model) per period
- Example: (key-test, anthropic, claude-3-5-sonnet-20241022) → usage for this specific model

**Grouping Levels (Design Options):**

**Level 1: Per API Key Only**
```typescript
interface BillingViewL1 {
  period: BillingPeriod;
  apiKeyId: string;
  totalTokens: number;
  totalRequests: number;
  totalDurationMs: number;
}
```
- Simplest aggregation
- Total usage per customer
- No model breakdown

**Level 2: Per API Key + Provider + Model**
```typescript
interface BillingViewL2 {
  period: BillingPeriod;
  apiKeyId: string;
  provider: string;
  model: string;
  totalTokens: number;
  totalRequests: number;
  totalDurationMs: number;
}
```
- Detailed breakdown
- Usage per model (for model-based pricing)
- Recommended for Phase 23B-2

### 2.4 Aggregation Outputs

**totalTokens:**
- Definition: SUM(tokensUsed) across all UsageRecords in period
- Type: number (integer, non-negative)
- Source: UsageRecord.tokensUsed (Phase 22)
- Usage: Basis for token-based pricing (Phase 23C+)

**totalRequests:**
- Definition: COUNT(*) of UsageRecords in period
- Type: number (integer, non-negative)
- Source: Count of UsageRecord rows
- Usage: Request-based analytics, quota validation

**totalDurationMs:**
- Definition: SUM(executionDurationMs) across all UsageRecords in period
- Type: number (integer, non-negative)
- Source: UsageRecord.executionDurationMs (Phase 22)
- Usage: Performance analytics, optional time-based pricing (future)

**Aggregation Formula (Conceptual SQL):**
```sql
SELECT
  apiKeyId,
  provider,
  model,
  SUM(tokens_used) AS totalTokens,
  COUNT(*) AS totalRequests,
  SUM(execution_duration_ms) AS totalDurationMs
FROM usage_records
WHERE timestamp >= :period_start
  AND timestamp < :period_end
GROUP BY apiKeyId, provider, model;
```

### 2.5 Source of Truth

**Single Source: Usage Ledger (Phase 22)**
- ✅ usage_records table is sole data source
- ✅ No secondary data sources
- ✅ No caching (always query live)
- ✅ No derived tables (Phase 23B-1, future: materialized views)
- ✅ No redundant storage

**Derivation Guarantee:**
- BillingView is always derived from current usage_records state
- No stale data possible (no caching)
- Deterministic (same ledger → same view)

---

## 3. Read Semantics

### 3.1 Read-Only Characteristics

**Read Model Properties:**
- ✅ No writes to usage_records (read-only)
- ✅ No updates to usage_records (immutable)
- ✅ No deletes from usage_records (append-only)
- ✅ No mutations of any kind

**Query-Only Operations:**
- SELECT queries only
- Aggregation queries (SUM, COUNT)
- GROUP BY queries
- WHERE filtering (time-range, apiKeyId)
- ORDER BY sorting (optional)

### 3.2 Query Patterns

**Query Pattern 1: Usage by API Key for Period**
```sql
-- Conceptual query (design only)
SELECT
  apiKeyId,
  provider,
  model,
  SUM(tokens_used) AS totalTokens,
  COUNT(*) AS totalRequests,
  SUM(execution_duration_ms) AS totalDurationMs
FROM usage_records
WHERE apiKeyId = :api_key_id
  AND timestamp >= :period_start
  AND timestamp < :period_end
GROUP BY apiKeyId, provider, model
ORDER BY model;
```

**Query Pattern 2: Usage by All Keys for Period**
```sql
-- Conceptual query (design only)
SELECT
  apiKeyId,
  provider,
  model,
  SUM(tokens_used) AS totalTokens,
  COUNT(*) AS totalRequests,
  SUM(execution_duration_ms) AS totalDurationMs
FROM usage_records
WHERE timestamp >= :period_start
  AND timestamp < :period_end
GROUP BY apiKeyId, provider, model
ORDER BY apiKeyId, model;
```

**Query Pattern 3: Total Usage Across All Keys**
```sql
-- Conceptual query (design only)
SELECT
  SUM(tokens_used) AS totalTokens,
  COUNT(*) AS totalRequests,
  SUM(execution_duration_ms) AS totalDurationMs
FROM usage_records
WHERE timestamp >= :period_start
  AND timestamp < :period_end;
```

### 3.3 Consistency Model

**Read Consistency:**
- Strong consistency (PostgreSQL ACID guarantees)
- No eventual consistency
- No stale reads
- Queries reflect all committed usage_records

**Concurrent Read/Write:**
- Reads do NOT block writes (Phase 22 ledger writes)
- Writes do NOT block reads
- PostgreSQL MVCC handles concurrency
- No read locks required

### 3.4 Performance Characteristics

**Query Performance:**
- Time-range queries use idx_usage_records_timestamp (Phase 22)
- API key queries use idx_usage_records_api_key_timestamp (Phase 22)
- Aggregations may be expensive for large periods
- No optimization in Phase 23B-2 (future: materialized views)

**Expected Query Time (Estimates):**
- Daily period, single API key: < 100ms
- Monthly period, single API key: < 500ms
- Monthly period, all API keys: < 5s (depends on volume)

---

## 4. Failure Semantics

### 4.1 Read Failure Behavior

**Failure Principle:**
- Read failures throw (no silent failures)
- No retries on failure
- No fallback data
- No partial results

**Failure Scenarios:**

**Database Connection Failure:**
- Throw: DatabaseConnectionError
- No retry in Phase 23B-2
- No cached fallback
- Caller must handle error

**Query Timeout:**
- Throw: QueryTimeoutError
- No automatic retry
- No partial results returned
- Caller must handle error

**Invalid Period:**
- Throw: InvalidPeriodError (validation error)
- Example: periodStart > periodEnd
- No fallback to valid period

**No Data Found:**
- Return: Empty aggregation (totalTokens=0, totalRequests=0)
- NOT an error (valid result)
- Empty result is deterministic

### 4.2 Error Handling

**Error Types:**
```typescript
// Conceptual error types (design only)
class BillingReadError extends Error {
  executionId?: string;
  apiKeyId?: string;
  period?: BillingPeriod;
}

class DatabaseConnectionError extends BillingReadError {}
class QueryTimeoutError extends BillingReadError {}
class InvalidPeriodError extends BillingReadError {}
```

**Error Logging:**
- ✅ Log error type
- ✅ Log apiKeyId (if known)
- ✅ Log period (if known)
- ✅ Log timestamp
- ❌ NO prompt content (privacy)
- ❌ NO AI output (privacy)
- ❌ NO user PII

### 4.3 Partial Results

**No Partial Results:**
- Aggregation queries are atomic (all or nothing)
- No partial sums returned
- No partial counts returned
- If query fails mid-execution → entire query fails

**Rationale:**
- Partial results would misrepresent usage
- Partial results would cause incorrect billing
- All-or-nothing semantics ensure correctness

### 4.4 Retry Semantics

**No Automatic Retries (Phase 23B-2):**
- Read failures do NOT retry
- Caller must retry if desired
- No exponential backoff
- No retry queue

**Rationale:**
- Simplicity (Phase 23B-2 MVP)
- Determinism (retries complicate behavior)
- Caller control (external systems decide retry policy)

**Future: Automatic Retries (Phase 23C+):**
- Configurable retry policy
- Exponential backoff
- Circuit breaker pattern
- NOT in Phase 23B-2

---

## 5. Data Boundaries

### 5.1 What is Exposed

**Exposed Data (From UsageRecord):**
- ✅ apiKeyId (identifier)
- ✅ provider (string)
- ✅ model (string)
- ✅ tokensUsed (numeric, aggregated)
- ✅ executionDurationMs (numeric, aggregated)
- ✅ timestamp (for period filtering)
- ✅ Aggregation outputs (totalTokens, totalRequests, totalDurationMs)

### 5.2 What is NOT Exposed

**NOT Exposed (Privacy):**
- ❌ executionId (internal identifier)
- ❌ userId (privacy, unless explicitly queried by user)
- ❌ sessionId (internal identifier)
- ❌ conversationId (internal identifier)
- ❌ adapter (internal implementation detail)
- ❌ metadata (reserved for internal use)
- ❌ Individual UsageRecord details (only aggregates)

**NOT Exposed (Privacy Policy Phase 15B):**
- ❌ Prompt content (never stored)
- ❌ AI output (never stored)
- ❌ User conversation history (never stored)
- ❌ Request/response bodies (never stored)

### 5.3 Aggregation Boundaries

**Aggregation Only:**
- BillingView returns ONLY aggregated data
- BillingView does NOT return individual UsageRecords
- BillingView does NOT expose executionId list
- BillingView does NOT expose per-execution details

**Rationale:**
- Privacy: Aggregation obscures individual requests
- Performance: Aggregation reduces data volume
- Billing: Aggregation is sufficient for billing

**Exception (Future):**
- Phase 24+ may allow per-execution queries for audit
- Requires explicit authorization
- Requires audit logging
- NOT in Phase 23B-2

---

## 6. Explicit Non-Goals

### 6.1 NOT in Phase 23B-1/23B-2

**❌ No Pricing Logic:**
- No cost calculation
- No price per token
- No price per model
- No total cost output
- Rationale: Pricing is Phase 23C+

**❌ No Invoices:**
- No invoice generation
- No invoice formatting
- No invoice delivery
- Rationale: Invoicing is Phase 24+

**❌ No Currency:**
- No dollar amounts
- No currency conversion
- No currency symbols
- Rationale: Currency is Phase 24+

**❌ No Discounts:**
- No discount codes
- No promotional pricing
- No volume discounts
- Rationale: Discounts are Phase 24+

**❌ No Tax Logic:**
- No tax calculation
- No tax rates
- No tax jurisdictions
- Rationale: Tax is Phase 24+

**❌ No External Billing Integrations:**
- No Stripe integration
- No payment gateway
- No invoice delivery system
- Rationale: Integrations are Phase 24+

**❌ No API Endpoints:**
- No public API routes
- No REST endpoints
- No GraphQL endpoints
- Rationale: APIs are Phase 24+

**❌ No Caching:**
- No materialized views
- No Redis caching
- No query result caching
- Rationale: Optimization is Phase 23C+

**❌ No Reconciliation:**
- No quota vs usage reconciliation
- No ledger vs billing reconciliation
- No correction logic
- Rationale: Reconciliation is Phase 25+

**❌ No Mutation:**
- No updates to usage_records
- No billing adjustments
- No corrections
- Rationale: Immutability guarantee (Phase 22)

**❌ No Background Jobs:**
- No scheduled aggregation
- No batch processing
- No async computation
- Rationale: On-demand queries only (Phase 23B-2)

### 6.2 Future Enhancements (NOT NOW)

**Phase 23C+ (Potential Future):**
- Pricing calculation (cost per token × totalTokens)
- Materialized views for performance
- Query result caching
- Background aggregation jobs
- Query optimization

**Phase 24+ (Potential Future):**
- Public API endpoints (GET /api/billing/usage)
- Invoice generation from BillingView
- External billing integrations (Stripe)
- Real-time cost tracking
- Budget alerts

**Phase 25+ (Potential Future):**
- Reconciliation system (quota vs billing)
- Usage analytics dashboard
- Anomaly detection
- Usage forecasting
- Cost optimization recommendations

---

## 7. Design Decisions & Rationale

### 7.1 Why No Caching

**Decision:** No caching in Phase 23B-2

**Rationale:**
- Simplicity: Caching adds complexity
- Correctness: Caching introduces staleness
- Consistency: Always query live data
- Determinism: Same query → same result

**Trade-offs:**
- Performance: Queries may be slow for large periods
- Acceptable for Phase 23B-2 MVP
- Future: Phase 23C+ can add materialized views

### 7.2 Why Daily and Monthly Only

**Decision:** Support only daily and monthly periods (Phase 23B-2)

**Rationale:**
- Simplicity: Two periods cover most use cases
- Common: Daily for monitoring, monthly for billing
- Sufficient for MVP

**Trade-offs:**
- No weekly periods (can add in Phase 23C+)
- No hourly periods (can add in Phase 23C+)
- No custom periods (can add in Phase 23C+)

### 7.3 Why No Background Jobs

**Decision:** On-demand queries only (no background aggregation)

**Rationale:**
- Simplicity: No job scheduler required
- Consistency: Always compute from live data
- Determinism: Same query time → same result

**Trade-offs:**
- Performance: Large queries may be slow
- Acceptable for Phase 23B-2 MVP
- Future: Phase 23C+ can add background jobs

### 7.4 Why Group by Provider + Model

**Decision:** Include provider and model in grouping keys

**Rationale:**
- Pricing: Future pricing will be per-model (Phase 23C+)
- Analytics: Model-level breakdown useful for optimization
- Flexibility: Allows different pricing for different models

**Trade-offs:**
- Complexity: More granular than apiKeyId-only
- Acceptable: Still simple aggregation

### 7.5 Why No API Endpoints in Phase 23B-2

**Decision:** Internal service only (no public APIs)

**Rationale:**
- Scope: Phase 23B-2 is foundation only
- Simplicity: No API design, no authentication, no rate limiting
- Future: Phase 24+ adds public APIs

**Trade-offs:**
- Limited usefulness (no external access)
- Acceptable: Foundation must be solid first

---

## 8. Safe Resume Point

### 8.1 Phase 23B-1 Completion

**Phase 23B-1 Unlocks:**
- Phase 23B-2: Billing Read Model Implementation
- Clear design for read semantics
- Clear design for aggregation logic
- Clear design for failure handling

**Phase 23B-1 Does NOT Unlock:**
- Phase 23C (requires Phase 23B-2 complete)
- Pricing implementation (Phase 23C+)
- API endpoints (Phase 24+)

### 8.2 Dependencies for Phase 23B-2

**Phase 23B-2 Can Depend On:**
- ✅ usage_records table exists (Phase 22)
- ✅ Indexes exist (Phase 22 migration)
- ✅ Immutable ledger guarantees (Phase 22)
- ✅ Success-only recording (Phase 22)
- ✅ Privacy preserved (Phase 22)

**Phase 23B-2 Cannot Assume:**
- ❌ Pricing configuration (Phase 23C+)
- ❌ API endpoints (Phase 24+)
- ❌ External integrations (Phase 24+)
- ❌ Background jobs (Phase 23C+)

### 8.3 What Phase 23B-2 Will Implement

**Implementation Scope (Phase 23B-2):**
- BillingViewService (read service)
- Period calculation logic (daily, monthly boundaries)
- Aggregation queries (SQL implementation)
- Error handling (throw on failure)
- Unit tests (service logic)
- Integration tests (database queries)

**Implementation Will NOT Include:**
- Pricing calculation (Phase 23C+)
- API controllers (Phase 24+)
- Background jobs (Phase 23C+)
- Caching (Phase 23C+)

---

## ULTRA-BRIEF SUMMARY

• **Designed read-only BillingView aggregating usage_records** by billing period (daily/monthly) and grouping keys (apiKeyId, provider, model) with outputs (totalTokens, totalRequests, totalDurationMs) derived deterministically from immutable Usage Ledger (Phase 22)

• **No pricing, no invoices, no currency, no API endpoints** with Phase 23B-1 strictly defining read model semantics (query patterns, aggregation, failure behavior) while deferring monetary calculations to Phase 23C+ and external integrations to Phase 24+

• **Phase 23B-2 will implement BillingViewService** with on-demand SQL aggregation queries (no caching, no background jobs), strong consistency from PostgreSQL, and throw-on-failure semantics enabling future pricing layer (Phase 23C+) to consume aggregated usage data

---

**END OF PHASE 23B-1 DESIGN**
