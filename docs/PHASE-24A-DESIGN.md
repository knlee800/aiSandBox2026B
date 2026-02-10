# PHASE 24A DESIGN: Billing Visibility (Read-Only Access)

**Phase:** 24A
**Nature:** DESIGN ONLY (No Implementation)
**Scope:** api-gateway only
**Status:** DESIGN COMPLETE
**Date:** 2026-02-06
**Prerequisite:** Phase 23 (Billing Core Design) COMPLETE
**Next Phase:** Phase 24B (Billing Visibility Implementation)

---

## 1. Phase Overview

### 1.1 What Phase 24A Defines

Phase 24A establishes the design for **Billing Visibility**—a read-only interface for querying cost information derived from immutable Billing Snapshots (Phase 23).

**Core Achievement:**
A visibility layer that:
- Exposes read-only views over Billing Snapshots (Phase 23)
- Enables cost transparency without financial side effects
- Provides internal dogfooding and debugging capabilities
- Establishes foundation for future user-facing billing dashboards
- Maintains complete separation from execution, billing calculation, and payments

**Key Architectural Principle:**
Billing Visibility is a **pure read interface**—it queries existing billing data without creating, modifying, or deleting any billing records, and never affects execution flow or billing correctness.

### 1.2 Why Billing Visibility is Separated from Billing Calculation

**Critical Design Decision:**
Phase 24A intentionally separates **reading billing data** from **calculating billing data** (Phase 23) and **collecting payments** (Phase 25+).

**Rationale:**
- **Separation of Concerns:** Query ≠ Calculation ≠ Payment
- **Performance:** Visibility can be cached/optimized independently
- **Security:** Read access can be granted without write privileges
- **Auditability:** Visibility never modifies billing records
- **Flexibility:** Multiple visibility interfaces (API, UI, CSV) can share same read layer

**Clear Boundary:**
```
Phase 23: Usage → Aggregation → Pricing → Snapshot (Calculation)
Phase 24: Snapshot → Query → Response (THIS: Visibility)
Phase 25+: Snapshot → Invoice → Payment (Future: Money Movement)
```

---

## 2. Billing Visibility Goals

### 2.1 Primary Goals

**Cost Transparency:**
- Users/admins can view costs derived from usage
- Costs are presented per API key, provider, model, and time window
- Historical cost trends are accessible
- Pricing version used for each snapshot is visible

**Debugging and Reconciliation:**
- Internal teams can verify billing correctness
- Cost discrepancies can be investigated via snapshot metadata
- Deterministic queries enable reproducible debugging
- Audit trail preserved (snapshotId, pricingVersion, periodStart/End)

**Internal Dogfooding:**
- Platform developers can validate billing design
- Cost calculations can be verified against expected results
- Edge cases can be identified before customer-facing rollout

**Future UI Groundwork:**
- Read models designed for dashboard consumption
- Query patterns optimized for common UI use cases
- Response formats suitable for charting/graphing libraries
- Extensible to support filters, sorting, pagination

### 2.2 Non-Functional Goals

**Determinism:**
- Same query → same response (always)
- No timing-dependent behavior
- No random sampling or approximations

**Strong Consistency:**
- Queries return committed data only
- No stale reads
- No eventual consistency

**Security:**
- No sensitive data exposure (prompts, responses, conversation history)
- Identity-scoped access (apiKeyId-based filtering)
- No privilege escalation (users see only their own costs)

**Fail-Safe:**
- Visibility failures NEVER affect execution
- Visibility failures NEVER modify billing records
- Visibility failures are isolated to query responses

---

## 3. Billing Visibility Scope

### 3.1 What Phase 24A Defines

**Read-Only Data Models:**
- `BillingSnapshotSummary`: High-level cost overview per snapshot
- `CostBreakdown`: Cost details per provider/model within snapshot
- `TimeWindowCostSummary`: Aggregated costs across multiple snapshots
- `SnapshotMetadata`: Non-sensitive snapshot metadata (pricing version, period)

**Query Patterns:**
- List snapshots for apiKeyId (with optional time window filter)
- Get single snapshot by snapshotId
- Get cost breakdown for snapshot
- Get aggregated costs across time window (daily/monthly/custom)
- Get snapshot metadata for audit trail

**Response Formats:**
- JSON (primary format for API responses)
- Structured fields suitable for UI rendering
- Error responses with clear error codes/messages

**Error Handling:**
- 404 for missing snapshots
- 403 for unauthorized access (apiKeyId mismatch)
- 500 for database failures
- No partial responses (all-or-nothing)

**Security Model:**
- Caller identity derived from api-gateway authentication (Phase 20)
- Access scoped to apiKeyId (users see only their own billing)
- No admin override (Phase 24A: user-scoped only, admin features Phase 24C+)
- No cross-apiKey queries

### 3.2 What Phase 24A Does NOT Define

**❌ No Billing Calculations:**
- Visibility does NOT create Billing Snapshots
- Visibility does NOT calculate costs
- Visibility does NOT apply pricing logic
- All calculation is Phase 23 responsibility

**❌ No Writes or Mutations:**
- Visibility does NOT modify snapshots
- Visibility does NOT delete snapshots
- Visibility does NOT finalize snapshots (status transition)
- Read-only semantics strictly enforced

**❌ No Payments:**
- Visibility does NOT trigger payments
- Visibility does NOT show payment status
- Visibility does NOT show invoice PDFs
- Payment concerns are Phase 25+

**❌ No Real-Time Costing:**
- Visibility does NOT show costs for in-progress executions
- Visibility does NOT integrate with execution flow
- Visibility queries committed snapshots only
- Real-time costing is NOT a goal (billing is async)

**❌ No Advanced Features:**
- No pagination (Phase 24B: simple limit/offset if needed)
- No complex filters (Phase 24C+: advanced filtering)
- No sorting options (Phase 24C+: sortable fields)
- No caching (Phase 24B: query live data, optimize later)
- No CSV export (Phase 24C+: export features)
- No cost alerts (Phase 25+: notification system)

---

## 4. Read-Only Data Models

### 4.1 BillingSnapshotSummary

**Purpose:** High-level overview of a single billing snapshot.

**Structure:**
```typescript
interface BillingSnapshotSummary {
  snapshotId: string;              // UUID, unique identifier
  apiKeyId: string;                // Who this snapshot is for
  userId: string;                  // User associated with API key
  periodStart: Date;               // Period start (UTC, inclusive)
  periodEnd: Date;                 // Period end (UTC, inclusive)
  periodType: 'daily' | 'monthly'; // Period type
  pricingVersion: string;          // Pricing version used (e.g., "2026-02-v1")
  status: 'draft' | 'finalized';   // Snapshot status
  totalTokens: number;             // Sum of all tokens across line items
  totalRequests: number;           // Sum of all requests across line items
  totalCostUSD: number;            // Final total cost (USD, 3 decimals)
  createdAt: Date;                 // When snapshot was created
}
```

**Usage:**
- List view in billing dashboard (table of snapshots)
- Cost timeline chart (x-axis: periodStart, y-axis: totalCostUSD)
- Quick cost summary without drilling into line items

**Query Pattern:**
```
GET /api/billing/snapshots?apiKeyId=xyz&periodStart=2026-02-01&periodEnd=2026-02-28
→ Returns BillingSnapshotSummary[] (array of snapshots in time window)
```

### 4.2 CostBreakdown

**Purpose:** Detailed cost breakdown by provider/model within a single snapshot.

**Structure:**
```typescript
interface CostBreakdown {
  snapshotId: string;              // Which snapshot this breakdown is for
  lineItems: CostLineItem[];       // Breakdown by provider/model
  summary: CostSummary;            // Aggregated totals
}

interface CostLineItem {
  provider: string;                // e.g., 'anthropic'
  model: string;                   // e.g., 'claude-3-5-sonnet-20241022'
  totalTokens: number;             // Tokens used for this provider/model
  totalRequests: number;           // Requests for this provider/model
  pricePerThousandTokens: number;  // Pricing rate applied (USD per 1K tokens)
  costUSD: number;                 // Cost for this line item (USD, 3 decimals)
}

interface CostSummary {
  totalTokens: number;             // Sum across all line items
  totalRequests: number;           // Sum across all line items
  subtotal: number;                // Sum of line item costs (USD)
  adjustments: number;             // Discounts, credits (always 0 in Phase 24A)
  total: number;                   // Final total (subtotal + adjustments)
}
```

**Usage:**
- Drill-down view in billing dashboard
- Cost breakdown pie chart (by provider or model)
- Identify which models are most expensive
- Verify pricing correctness

**Query Pattern:**
```
GET /api/billing/snapshots/:snapshotId/breakdown
→ Returns CostBreakdown (single object with line items)
```

### 4.3 TimeWindowCostSummary

**Purpose:** Aggregated costs across multiple snapshots in a time window.

**Structure:**
```typescript
interface TimeWindowCostSummary {
  apiKeyId: string;                // Whose costs are summarized
  periodStart: Date;               // Time window start (UTC, inclusive)
  periodEnd: Date;                 // Time window end (UTC, inclusive)
  totalCostUSD: number;            // Sum of all snapshot totals in window
  totalTokens: number;             // Sum of all tokens in window
  totalRequests: number;           // Sum of all requests in window
  snapshotCount: number;           // How many snapshots included
  byProvider: ProviderCostSummary[]; // Breakdown by provider
}

interface ProviderCostSummary {
  provider: string;                // e.g., 'anthropic'
  totalCostUSD: number;            // Sum of costs for this provider
  totalTokens: number;             // Sum of tokens for this provider
  totalRequests: number;           // Sum of requests for this provider
}
```

**Usage:**
- Monthly invoice view (sum all daily snapshots in month)
- Cost trend chart (multiple time windows)
- Budget tracking (compare actual vs expected)
- Provider cost comparison

**Query Pattern:**
```
GET /api/billing/summary?apiKeyId=xyz&periodStart=2026-02-01&periodEnd=2026-02-28
→ Returns TimeWindowCostSummary (single aggregated object)
```

**Calculation:**
```
TimeWindowCostSummary = SUM(BillingSnapshots WHERE
  apiKeyId = :apiKeyId AND
  periodStart >= :windowStart AND
  periodEnd <= :windowEnd
)
```

### 4.4 SnapshotMetadata

**Purpose:** Non-sensitive metadata for audit trail and debugging.

**Structure:**
```typescript
interface SnapshotMetadata {
  snapshotId: string;              // UUID
  apiKeyId: string;                // Whose snapshot
  periodStart: Date;               // Period boundaries
  periodEnd: Date;
  periodType: 'daily' | 'monthly';
  pricingVersion: string;          // Pricing config version used
  status: 'draft' | 'finalized';   // Lifecycle status
  createdAt: Date;                 // Creation timestamp
  usageRecordCount: number;        // How many usage records included
}
```

**Usage:**
- Audit log verification
- Debugging cost discrepancies
- Validate pricing version applied
- Verify period boundaries

**Query Pattern:**
```
GET /api/billing/snapshots/:snapshotId/metadata
→ Returns SnapshotMetadata (single object)
```

---

## 5. Query Patterns and Access Semantics

### 5.1 List Snapshots

**Query:**
```
GET /api/billing/snapshots?apiKeyId={apiKeyId}&periodStart={start}&periodEnd={end}
```

**Parameters:**
- `apiKeyId` (required): Filter by API key
- `periodStart` (optional): Filter snapshots with periodStart >= start
- `periodEnd` (optional): Filter snapshots with periodEnd <= end

**Response:**
```json
{
  "snapshots": [
    {
      "snapshotId": "550e8400-e29b-41d4-a716-446655440000",
      "apiKeyId": "ak_xyz",
      "userId": "user_123",
      "periodStart": "2026-02-01T00:00:00.000Z",
      "periodEnd": "2026-02-01T23:59:59.999Z",
      "periodType": "daily",
      "pricingVersion": "2026-02-v1",
      "status": "finalized",
      "totalTokens": 50000,
      "totalRequests": 10,
      "totalCostUSD": 0.500,
      "createdAt": "2026-02-02T00:05:00.000Z"
    }
  ]
}
```

**Semantics:**
- Returns array of BillingSnapshotSummary
- Ordered by periodStart DESC (most recent first)
- Empty array if no snapshots found (not an error)
- Filtered by caller's apiKeyId (no cross-key access)

### 5.2 Get Single Snapshot

**Query:**
```
GET /api/billing/snapshots/:snapshotId
```

**Parameters:**
- `snapshotId` (required): UUID of snapshot

**Response:**
```json
{
  "snapshotId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKeyId": "ak_xyz",
  "userId": "user_123",
  "periodStart": "2026-02-01T00:00:00.000Z",
  "periodEnd": "2026-02-01T23:59:59.999Z",
  "periodType": "daily",
  "pricingVersion": "2026-02-v1",
  "status": "finalized",
  "totalTokens": 50000,
  "totalRequests": 10,
  "totalCostUSD": 0.500,
  "createdAt": "2026-02-02T00:05:00.000Z"
}
```

**Semantics:**
- Returns single BillingSnapshotSummary
- 404 if snapshotId not found
- 403 if snapshotId exists but apiKeyId doesn't match caller
- Strong consistency (reads committed data)

### 5.3 Get Cost Breakdown

**Query:**
```
GET /api/billing/snapshots/:snapshotId/breakdown
```

**Response:**
```json
{
  "snapshotId": "550e8400-e29b-41d4-a716-446655440000",
  "lineItems": [
    {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "totalTokens": 50000,
      "totalRequests": 10,
      "pricePerThousandTokens": 0.01,
      "costUSD": 0.500
    }
  ],
  "summary": {
    "totalTokens": 50000,
    "totalRequests": 10,
    "subtotal": 0.500,
    "adjustments": 0.000,
    "total": 0.500
  }
}
```

**Semantics:**
- Returns CostBreakdown with line items
- 404 if snapshotId not found
- 403 if apiKeyId doesn't match caller
- Line items ordered by costUSD DESC (most expensive first)

### 5.4 Get Time Window Summary

**Query:**
```
GET /api/billing/summary?apiKeyId={apiKeyId}&periodStart={start}&periodEnd={end}
```

**Parameters:**
- `apiKeyId` (required): Filter by API key
- `periodStart` (required): Window start (UTC)
- `periodEnd` (required): Window end (UTC)

**Response:**
```json
{
  "apiKeyId": "ak_xyz",
  "periodStart": "2026-02-01T00:00:00.000Z",
  "periodEnd": "2026-02-28T23:59:59.999Z",
  "totalCostUSD": 15.750,
  "totalTokens": 1575000,
  "totalRequests": 280,
  "snapshotCount": 28,
  "byProvider": [
    {
      "provider": "anthropic",
      "totalCostUSD": 15.750,
      "totalTokens": 1575000,
      "totalRequests": 280
    }
  ]
}
```

**Semantics:**
- Aggregates all snapshots in time window
- Returns zero totals if no snapshots found (not an error)
- Window boundaries are inclusive
- Filtered by caller's apiKeyId

### 5.5 Get Snapshot Metadata

**Query:**
```
GET /api/billing/snapshots/:snapshotId/metadata
```

**Response:**
```json
{
  "snapshotId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKeyId": "ak_xyz",
  "periodStart": "2026-02-01T00:00:00.000Z",
  "periodEnd": "2026-02-01T23:59:59.999Z",
  "periodType": "daily",
  "pricingVersion": "2026-02-v1",
  "status": "finalized",
  "createdAt": "2026-02-02T00:05:00.000Z",
  "usageRecordCount": 10
}
```

**Semantics:**
- Returns SnapshotMetadata (audit trail info)
- 404 if snapshotId not found
- 403 if apiKeyId doesn't match caller
- No cost data included (metadata only)

---

## 6. Error Handling Semantics

### 6.1 Error Response Format

**Standard Error Response:**
```json
{
  "error": {
    "code": "SNAPSHOT_NOT_FOUND",
    "message": "Billing snapshot not found",
    "snapshotId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Codes:**
- `SNAPSHOT_NOT_FOUND`: 404, requested snapshot doesn't exist
- `UNAUTHORIZED_ACCESS`: 403, caller lacks permission to access snapshot
- `INVALID_QUERY_PARAMS`: 400, query parameters are malformed
- `DATABASE_ERROR`: 500, database query failed
- `INTERNAL_ERROR`: 500, unexpected error

### 6.2 Error Semantics

**Visibility Failures NEVER Affect Execution:**
```
Time T0: User executes AI request
Time T1: Execution succeeds, usage recorded (Phase 22)
Time T2: Billing snapshot created (Phase 23)
Time T3: User queries billing visibility → ERROR
Time T4: User can still execute AI requests (execution unaffected)
```

**No Partial Responses:**
```
If breakdown has 5 line items and database fails reading item 3:
❌ DO NOT return 2 line items
✅ DO return 500 error (all-or-nothing)
```

**No Automatic Retries:**
```
Visibility query fails → return error immediately
Caller decides retry policy (exponential backoff, etc.)
No hidden retries (predictable behavior)
```

**Throw-Only Semantics:**
```
Missing snapshot → throw SnapshotNotFoundError (not empty result)
Database failure → throw DatabaseError (not stale cached data)
Invalid period → throw InvalidQueryParamsError (not fallback to default)
```

### 6.3 Failure Isolation

**Visibility is Isolated from Billing Core:**
```
Phase 23 (Billing Calculation):
  UsageRecord → BillingView → CostCalculation → BillingSnapshot
  (Failure here: billing snapshot not created)

Phase 24 (Billing Visibility):
  BillingSnapshot → Query → Response
  (Failure here: query returns error, snapshot unaffected)
```

**Visibility is Isolated from Execution:**
```
Visibility query fails → NO impact on:
  - ai-service execution
  - Usage Ledger writes
  - Future billing calculations
  - User's ability to make API calls
```

---

## 7. Security and Privacy

### 7.1 Privacy Guarantees (Re-Asserted from Phase 23)

**NO Sensitive Data in Visibility:**
- ❌ NO prompt content
- ❌ NO AI response content
- ❌ NO conversation history
- ❌ NO user messages
- ❌ NO execution results
- ✅ ONLY metadata: snapshotId, apiKeyId, userId, provider, model, tokens, requests, costs, timestamps

**Privacy Validation:**
```typescript
// Example visibility response (VALID):
{
  "snapshotId": "...",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "totalTokens": 50000,
  "totalRequests": 10,
  "costUSD": 0.500
}

// Example visibility response (INVALID):
{
  "snapshotId": "...",
  "prompt": "What is 2+2?",        // ❌ FORBIDDEN
  "response": "4",                 // ❌ FORBIDDEN
  "conversationHistory": [...]     // ❌ FORBIDDEN
}
```

### 7.2 Identity-Scoped Access

**Access Control Model:**
```
User authenticates → api-gateway validates → apiKeyId derived
Query includes apiKeyId parameter → must match authenticated apiKeyId
If mismatch → 403 Unauthorized
```

**No Cross-Key Access:**
```
User A (apiKeyId: ak_xyz) tries:
GET /api/billing/snapshots?apiKeyId=ak_abc

Result: 403 Unauthorized (User A cannot see User B's billing)
```

**No Admin Override (Phase 24A):**
```
Phase 24A: User-scoped access only
Phase 24C+: Admin role can query any apiKeyId (future)
```

### 7.3 Data Minimization

**Aggregates Only:**
```
Visibility returns BillingSnapshot data (aggregated by provider/model)
Visibility NEVER returns raw UsageRecord rows (Phase 22)
No executionId exposure (internal identifier only)
```

**No API Key Exposure:**
```
Response includes apiKeyId (user knows their own key)
Response does NOT include raw API key value (Phase 20 secret)
Response does NOT include other users' apiKeyIds
```

### 7.4 No Privilege Escalation

**Read-Only Semantics:**
```
Visibility queries can ONLY read BillingSnapshot table
Visibility queries CANNOT write to any table
Visibility queries CANNOT delete snapshots
Visibility queries CANNOT modify snapshot status
```

**No Execution Influence:**
```
Visibility failures do NOT affect quota enforcement
Visibility failures do NOT block API requests
Visibility is passive observer only
```

---

## 8. Extensibility and Future Features

### 8.1 Designed for Future Extensibility

**Phase 24B (Implementation):**
- Implement BillingVisibilityService
- Implement database queries (SELECT from billing_snapshots)
- Implement API endpoints (GET routes)
- Write tests (unit + integration)

**Phase 24C+ (Advanced Visibility):**
- Pagination (limit/offset for large result sets)
- Sorting (order by periodStart, totalCostUSD, etc.)
- Advanced filters (provider=anthropic, costUSD>10, etc.)
- CSV export (download billing data for Excel/accounting)
- Cost alerts (email when cost exceeds threshold)

**Phase 25+ (Invoicing and Payments):**
- Invoice generation (PDF invoices from snapshots)
- Invoice delivery (email invoices to users)
- Payment processing (Stripe integration)
- Payment status tracking (paid/unpaid/overdue)
- Receipt generation (payment confirmation PDFs)

**Phase 26+ (UI Dashboards):**
- Web-based billing dashboard
- Cost trend charts (line graphs over time)
- Cost breakdown pie charts (by provider/model)
- Budget tracking and forecasting
- Cost anomaly detection

### 8.2 Caching Strategy (Phase 24B+)

**Phase 24A (No Caching):**
- Query live data from billing_snapshots table
- Strong consistency (no stale reads)
- Simplicity (no cache invalidation complexity)

**Phase 24B+ (Optional Caching):**
- Cache immutable snapshots (status=finalized)
- Cache key: snapshotId
- Cache invalidation: NEVER (finalized snapshots immutable)
- Cache miss: query database, populate cache
- Cache TTL: infinite (immutable data)

**Caching Invariants:**
```
Draft snapshots: NEVER cached (may transition to finalized)
Finalized snapshots: ALWAYS safe to cache (immutable)
Time window summaries: NEVER cached (may include new snapshots)
```

### 8.3 API Evolution

**Phase 24A (Internal-Only):**
- Endpoints prefixed with `/api/billing/*`
- No versioning (internal API)
- No rate limiting (trusted internal callers)
- No pagination (small result sets expected)

**Phase 24B+ (Future Public API):**
- API versioning: `/api/v1/billing/*`
- Rate limiting: 100 requests/minute per API key
- Pagination: `?limit=50&offset=0`
- Response caching: `Cache-Control` headers
- Webhook support: notify on new snapshot creation

---

## 9. Architecture Boundaries and Ownership

### 9.1 Service Ownership

**api-gateway Owns Billing Visibility:**
- api-gateway implements BillingVisibilityService
- api-gateway owns /api/billing/* endpoints
- api-gateway queries billing_snapshots table
- api-gateway enforces access control (apiKeyId filtering)

**ai-service Remains Unchanged:**
- ❌ ai-service has NO billing visibility awareness
- ❌ ai-service does NOT query billing data
- ❌ ai-service does NOT expose billing endpoints
- ai-service continues returning AIExecutionResult (Phase 12B, unchanged)

**container-manager Remains Unchanged:**
- ❌ container-manager has NO billing visibility awareness
- ❌ container-manager does NOT query billing data

**frontend (Future):**
- frontend consumes /api/billing/* endpoints
- frontend renders billing dashboards
- frontend is read-only consumer (no writes)

### 9.2 Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ EXECUTION PHASE (Phase 12-21) — NO CHANGES                  │
│ ------------------------------------------------------------ │
│ Client Request → Auth → Authz → Quota → ai-service Execute  │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ USAGE LEDGER (Phase 22) — NO CHANGES                        │
│ ------------------------------------------------------------ │
│ UsageRecord written (immutable, append-only)                 │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ (read-only)
┌──────────────────────────────────────────────────────────────┐
│ BILLING CALCULATION (Phase 23) — NO CHANGES                 │
│ ------------------------------------------------------------ │
│ BillingView → CostCalculation → BillingSnapshot             │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ (read-only)
┌──────────────────────────────────────────────────────────────┐
│ BILLING VISIBILITY (Phase 24: THIS DESIGN)                  │
│ ------------------------------------------------------------ │
│ Query: GET /api/billing/snapshots?apiKeyId=xyz              │
│ Read billing_snapshots table (WHERE apiKeyId = :apiKeyId)   │
│ Return: BillingSnapshotSummary[]                             │
│                                                              │
│ NEVER writes to billing_snapshots                           │
│ NEVER modifies snapshots                                    │
│ NEVER affects execution flow                                │
└──────────────────────────────────────────────────────────────┘
```

### 9.3 Database Access

**Read-Only Queries:**
```sql
-- List snapshots
SELECT * FROM billing_snapshots
WHERE api_key_id = :apiKeyId
  AND period_start >= :periodStart
  AND period_end <= :periodEnd
ORDER BY period_start DESC;

-- Get single snapshot
SELECT * FROM billing_snapshots
WHERE snapshot_id = :snapshotId;

-- Get time window summary
SELECT
  SUM(total_cost_usd) AS total_cost_usd,
  SUM(total_tokens) AS total_tokens,
  SUM(total_requests) AS total_requests,
  COUNT(*) AS snapshot_count
FROM billing_snapshots
WHERE api_key_id = :apiKeyId
  AND period_start >= :periodStart
  AND period_end <= :periodEnd;
```

**No Write Queries:**
```sql
-- ❌ FORBIDDEN in Phase 24
INSERT INTO billing_snapshots ...
UPDATE billing_snapshots ...
DELETE FROM billing_snapshots ...
```

---

## 10. Explicit Non-Goals

### 10.1 NOT in Phase 24A (Calculation and Mutation)

**❌ No Billing Calculations:**
- Phase 24 does NOT calculate costs
- Phase 24 does NOT apply pricing logic
- Phase 24 does NOT create snapshots
- Phase 24 does NOT aggregate usage records
- **Rationale:** Calculation is Phase 23 responsibility

**❌ No Writes to Billing Tables:**
- Phase 24 does NOT insert billing_snapshots
- Phase 24 does NOT update billing_snapshots
- Phase 24 does NOT delete billing_snapshots
- Phase 24 does NOT modify snapshot status
- **Rationale:** Read-only semantics strictly enforced

**❌ No Pricing Logic:**
- Phase 24 does NOT load pricing.yaml
- Phase 24 does NOT calculate pricePerThousandTokens
- Phase 24 does NOT apply banker's rounding
- **Rationale:** Pricing is embedded in snapshots (Phase 23)

### 10.2 NOT in Phase 24A (Money Movement)

**❌ No Payments:**
- Phase 24 does NOT charge credit cards
- Phase 24 does NOT integrate with Stripe
- Phase 24 does NOT process refunds
- **Rationale:** Payments are Phase 25+

**❌ No Invoices:**
- Phase 24 does NOT generate PDF invoices
- Phase 24 does NOT email invoices
- Phase 24 does NOT create invoice numbers
- **Rationale:** Invoicing is Phase 25+

**❌ No Credits or Adjustments:**
- Phase 24 does NOT apply discounts
- Phase 24 does NOT apply credits
- Phase 24 does NOT process refunds
- **Rationale:** Adjustments are Phase 25+

### 10.3 NOT in Phase 24A (Advanced Features)

**❌ No Real-Time Costing:**
- Phase 24 does NOT show costs during execution
- Phase 24 does NOT integrate with execution flow
- Phase 24 queries committed snapshots only
- **Rationale:** Billing is async, post-execution

**❌ No Background Jobs:**
- Phase 24 does NOT run scheduled queries
- Phase 24 does NOT pre-compute summaries
- Phase 24 does NOT send notifications
- **Rationale:** On-demand queries only (Phase 24A MVP)

**❌ No Admin Mutation APIs:**
- Phase 24 does NOT support admin overrides
- Phase 24 does NOT support manual adjustments
- Phase 24 does NOT support snapshot deletion
- **Rationale:** Read-only visibility (admin features Phase 24C+)

**❌ No Complex Pagination/Filtering:**
- Phase 24 does NOT implement cursor pagination
- Phase 24 does NOT implement advanced filters (cost range, model filters)
- Phase 24 does NOT implement sorting options
- **Rationale:** Simple queries only (advanced features Phase 24C+)

**❌ No Caching (Phase 24A):**
- Phase 24 does NOT cache query results
- Phase 24 does NOT use Redis
- Phase 24 does NOT implement CDN caching
- **Rationale:** Query live data (caching optimization Phase 24B+)

**❌ No UI Dashboards (Phase 24A):**
- Phase 24 does NOT implement web UI
- Phase 24 does NOT render charts/graphs
- Phase 24 does NOT implement CSV export
- **Rationale:** API only (UI is Phase 26+)

---

## 11. Implementation Requirements (Phase 24B)

### 11.1 Service Structure (Not Implemented in Phase 24A)

**BillingVisibilityService (Future):**
```typescript
class BillingVisibilityService {
  // List snapshots for apiKeyId with optional time window
  async listSnapshots(
    apiKeyId: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<BillingSnapshotSummary[]>

  // Get single snapshot by ID (with access control)
  async getSnapshot(
    snapshotId: string,
    apiKeyId: string
  ): Promise<BillingSnapshotSummary>

  // Get cost breakdown for snapshot
  async getBreakdown(
    snapshotId: string,
    apiKeyId: string
  ): Promise<CostBreakdown>

  // Get aggregated costs for time window
  async getTimeWindowSummary(
    apiKeyId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<TimeWindowCostSummary>

  // Get snapshot metadata (audit trail)
  async getMetadata(
    snapshotId: string,
    apiKeyId: string
  ): Promise<SnapshotMetadata>
}
```

### 11.2 Database Queries (Not Implemented in Phase 24A)

**listSnapshots Query:**
```sql
SELECT
  snapshot_id,
  api_key_id,
  user_id,
  period_start,
  period_end,
  period_type,
  pricing_version,
  status,
  total_tokens,
  total_requests,
  total_cost_usd,
  created_at
FROM billing_snapshots
WHERE api_key_id = $1
  AND ($2::timestamp IS NULL OR period_start >= $2)
  AND ($3::timestamp IS NULL OR period_end <= $3)
ORDER BY period_start DESC;
```

**getSnapshot Query:**
```sql
SELECT * FROM billing_snapshots
WHERE snapshot_id = $1 AND api_key_id = $2;
```

**getTimeWindowSummary Query:**
```sql
SELECT
  api_key_id,
  SUM(total_cost_usd) AS total_cost_usd,
  SUM(total_tokens) AS total_tokens,
  SUM(total_requests) AS total_requests,
  COUNT(*) AS snapshot_count
FROM billing_snapshots
WHERE api_key_id = $1
  AND period_start >= $2
  AND period_end <= $3
GROUP BY api_key_id;
```

### 11.3 API Endpoints (Not Implemented in Phase 24A)

**Endpoints:**
```
GET /api/billing/snapshots                      → List snapshots
GET /api/billing/snapshots/:snapshotId          → Get single snapshot
GET /api/billing/snapshots/:snapshotId/breakdown → Get cost breakdown
GET /api/billing/summary                        → Get time window summary
GET /api/billing/snapshots/:snapshotId/metadata → Get metadata
```

**Authentication:**
- All endpoints require valid API key (Phase 20)
- apiKeyId derived from authenticated request
- Access scoped to caller's apiKeyId only

### 11.4 Test Requirements (Not Implemented in Phase 24A)

**Unit Tests:**
- Test listSnapshots (with and without time window filters)
- Test getSnapshot (found vs not found)
- Test getBreakdown (line items correctly returned)
- Test getTimeWindowSummary (aggregation correctness)
- Test getMetadata (audit trail fields)
- Test access control (403 on apiKeyId mismatch)

**Integration Tests:**
- Test end-to-end query flow (database → service → response)
- Test error handling (404, 403, 500)
- Test time window filtering (inclusive boundaries)
- Test empty result sets (no snapshots found)
- Test privacy (no sensitive data in responses)

---

## 12. Safety and Rollback

### 12.1 Why Phase 24A is Safe

**Critical Safety Property:**
Phase 24A is a **DESIGN-ONLY phase** with **ZERO code changes**, therefore it is **100% safe**.

**No Deployment Risks:**
- ❌ No services deployed
- ❌ No API endpoints exposed
- ❌ No database queries executed
- ❌ No configuration changes
- ❌ No runtime behavior changes

**No Dependencies Affected:**
- ✅ Phase 23 (Billing Calculation) continues unchanged
- ✅ Phase 22 (Usage Ledger) continues unchanged
- ✅ Phase 12-21 (Execution) continues unchanged
- ✅ ai-service continues unchanged

### 12.2 Rollback Phase 24A (No Action Required)

**Rollback Procedure:**
1. No action required (no code deployed)
2. No database to revert
3. No services to stop

**Rollback Guarantee:**
- Phase 24A design documents can be archived if needed
- System continues operating normally (visibility is additive)

### 12.3 Safe Resume Point

**Next Phase Options:**

**Option 1: Phase 24B (Billing Visibility Implementation)**
- Implement BillingVisibilityService
- Implement database queries
- Implement API endpoints
- Write tests
- **Prerequisite:** Phase 24A (COMPLETE), Phase 23B-4 (billing snapshots table exists)
- **Unlocks:** User-facing billing dashboards (Phase 26+)

**Option 2: Phase 25 (Payments Design)**
- Design payment processing integration
- Design invoice generation and delivery
- Design refund processing
- **Prerequisite:** Phase 24A (COMPLETE), Phase 23 (COMPLETE)
- **Can proceed in parallel with Phase 24B**

**Option 3: Phase 26 (UI Dashboard Design)**
- Design web-based billing dashboard
- Design cost trend visualizations
- Design cost breakdown charts
- **Prerequisite:** Phase 24A (COMPLETE)
- **Can proceed in parallel with Phase 24B**

**Recommended Next Step:**
- **Phase 24B (Billing Visibility Implementation)** if Phase 23B-4 is complete (billing snapshots exist)
- **Phase 23B-4 (Billing Implementation)** if not yet complete (create snapshots first)

---

## ULTRA-BRIEF SUMMARY

• **Phase 24A defines read-only Billing Visibility layer** that exposes immutable Billing Snapshots (Phase 23) via query-only interface enabling cost transparency, debugging, and future UI dashboards without affecting execution, billing calculation, or payments

• **Four core read models enable comprehensive cost visibility** via BillingSnapshotSummary (high-level overview), CostBreakdown (per-provider/model details), TimeWindowCostSummary (aggregated across time), and SnapshotMetadata (audit trail) with deterministic query semantics and identity-scoped access control (apiKeyId filtering)

• **Visibility is pure read interface with strict isolation guarantees** enforcing read-only database access (no writes/updates/deletes), throw-only error semantics (no partial responses), privacy preservation (no prompt/response content), and execution independence (visibility failures never affect AI execution)

• **Explicit separation from billing calculation and payment processing** with NO snapshot creation, NO pricing logic, NO invoice generation, NO payment collection, NO refunds/credits, NO real-time costing, and NO background jobs (all deferred to Phase 23 calculation or Phase 25+ payments)

• **Safe design-only phase with clear implementation path** requiring zero deployment (no code changes), unlocking Phase 24B (visibility implementation), Phase 25 (payments design), or Phase 26 (UI dashboards), with parallel work allowed and no blocking dependencies on other features

---

**END OF PHASE 24A DESIGN**
