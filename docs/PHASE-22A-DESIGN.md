# PHASE 22A DESIGN: Usage Ledger (Design Only)

**Status:** DESIGN-ONLY (No Implementation)
**Nature:** Ledger Design (usage recording)
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 22 (Usage Ledger)
**Prerequisite:** Phase 21B (Quota Enforcement) COMPLETE

---

## 1. Overview

### 1.1 Purpose

Phase 22A defines a Usage Ledger that records successful AI executions to support future billing, analytics, and reporting. This is a design-only phase that establishes what will be recorded, where it will live, when it will be written, and who owns it.

### 1.2 Scope

**Design Scope:**
- Ledger ownership model (which service owns/writes/reads)
- Ledger record shape (exact fields to capture)
- Write semantics (success-only, atomicity, failure handling)
- Read semantics (consumers, access patterns, guarantees)
- Storage strategy options (in-memory, database, event log)
- Non-goals (explicit exclusions)

**Implementation Scope:**
- NONE in this phase
- Phase 22B will implement the design

### 1.3 Core Principles

**Recording Principles:**
- ✅ Success-only (no failed executions)
- ✅ Immutable records (write-once, never update)
- ✅ Append-only ledger (no deletions)
- ✅ Verified identity only (userId from api-gateway)
- ✅ Actual tokens only (from ai-service response)
- ✅ No sensitive content (no prompts, no responses)

**Service Boundaries:**
- ✅ api-gateway: Coordinates ledger writes (owns orchestration)
- ✅ ai-service: Provides execution data (stateless)
- ✅ Ledger service/storage: Stores records (append-only)
- ✅ Clear separation maintained

---

## 2. Ledger Ownership

### 2.1 Ownership Model

**Who Owns the Ledger:**
- api-gateway owns the ledger conceptually
- api-gateway is responsible for ledger integrity
- api-gateway controls when records are written
- api-gateway provides verified identity (userId, apiKeyId)

**Rationale:**
- api-gateway is the enforcement boundary (Phase 20A/20B/21B)
- api-gateway has verified identity from authentication
- api-gateway has actual execution results from ai-service
- Centralizes ledger logic at single boundary

### 2.2 Who Writes Entries

**Writer: api-gateway ONLY**

**Write Trigger:**
- After successful AI execution
- After receiving AIExecutionResult from ai-service
- After verifying execution succeeded (no exceptions)
- Before returning response to client

**Write Flow:**
```
1. Client → api-gateway: POST /api/ai/execute
2. api-gateway: Auth + Authz + Quota (Phase 20/21)
3. api-gateway → ai-service: Execute request
4. ai-service → api-gateway: AIExecutionResult (success)
5. api-gateway: Write ledger entry ← NEW (Phase 22B)
6. api-gateway → client: Return AIExecutionResult
```

**Why api-gateway Writes:**
- Has verified userId (Phase 20A)
- Has apiKeyId (Phase 20A)
- Has actual AIExecutionResult (tokensUsed, model, etc.)
- Can enforce write-once semantics
- Single point of truth for billing/audit

**Why NOT ai-service:**
- ai-service remains stateless (Phase 12B)
- ai-service does not have apiKeyId
- ai-service does not have verified userId
- ai-service should not have side effects

### 2.3 Who Reads Entries

**Readers (Future Phases):**
- Billing service (Phase 23+): Calculate charges
- Analytics service (Phase 24+): Usage reports
- Admin dashboard (Phase 25+): User audit logs
- Reconciliation service (Phase 26+): Quota vs usage validation

**Read Access Model:**
- Read-only access (no mutations)
- Query by apiKeyId (for billing per key)
- Query by userId (for user usage reports)
- Query by time range (for period billing)
- Aggregate queries (total tokens, total requests)

**api-gateway Read Semantics:**
- api-gateway writes but does NOT read for operational purposes
- api-gateway does not query ledger during execution
- api-gateway does not use ledger for quota (Phase 21 remains separate)
- Read access only for admin/reporting endpoints (future)

### 2.4 Trust Boundaries

**Trust Model:**
```
┌──────────────────────────────────────┐
│ api-gateway (Trusted)                │
│ - Verifies identity (Phase 20A)      │
│ - Enforces authorization (Phase 20B) │
│ - Enforces quota (Phase 21B)         │
│ - Writes ledger (Phase 22B)          │
│ - Provides verified data             │
└──────────────────────────────────────┘
         ↓ writes verified records
┌──────────────────────────────────────┐
│ Usage Ledger (Trusted Storage)       │
│ - Immutable records                  │
│ - Append-only                        │
│ - Source of truth for billing        │
└──────────────────────────────────────┘
         ↓ reads for billing/analytics
┌──────────────────────────────────────┐
│ Billing/Analytics Services (Consumer)│
│ - Read-only access                   │
│ - Trusts ledger integrity            │
│ - No mutation capability             │
└──────────────────────────────────────┘
```

**Trust Guarantees:**
- api-gateway guarantees userId is verified (Phase 20A)
- api-gateway guarantees apiKeyId is authentic (Phase 20A)
- api-gateway guarantees tokensUsed is from ai-service (Phase 18A)
- Ledger guarantees immutability (write-once)
- Ledger guarantees append-only (no deletions)

---

## 3. Ledger Record Shape

### 3.1 Logical Record Definition

**UsageRecord (Conceptual Schema):**
```typescript
interface UsageRecord {
  // Unique Identifiers
  executionId: string;          // Unique execution identifier

  // Identity (Verified by api-gateway)
  apiKeyId: string;             // API key that made the request (Phase 20A)
  userId: string;               // Verified user identity (Phase 20A)

  // Execution Details
  sessionId: string;            // Session identifier from request
  conversationId: string;       // Conversation identifier from request

  // Provider Details
  provider: string;             // AI provider (e.g., 'anthropic', 'openai')
  adapter: string;              // Adapter used (e.g., 'claude-stub', 'anthropic-http')
  model: string;                // Model used (e.g., 'claude-3-5-sonnet-20241022')

  // Resource Consumption
  tokensUsed: number;           // Actual tokens consumed (from AIExecutionResult)
  executionDurationMs: number;  // Execution duration in milliseconds

  // Timestamps
  timestamp: string;            // ISO 8601 timestamp of execution completion

  // Metadata (Optional)
  metadata?: {
    // Reserved for future use (e.g., region, version, etc.)
    [key: string]: unknown;
  };
}
```

### 3.2 Field Definitions

**executionId:**
- Type: string (UUID v4 recommended)
- Purpose: Unique identifier for this specific execution
- Generated by: api-gateway (Phase 22B)
- Immutable: Yes
- Indexed: Yes (primary key)

**apiKeyId:**
- Type: string
- Purpose: Links usage to API key (for billing per key)
- Source: ApiKeyIdentity from Phase 20A
- Immutable: Yes
- Indexed: Yes (for billing queries)

**userId:**
- Type: string
- Purpose: Links usage to user (for user-level reporting)
- Source: Verified ApiKeyIdentity.userId from Phase 20A
- Immutable: Yes
- Indexed: Yes (for user queries)

**sessionId:**
- Type: string
- Purpose: Links usage to session (for session-level analytics)
- Source: AIExecutionRequest.sessionId
- Immutable: Yes
- Indexed: Optional (for session analytics)

**conversationId:**
- Type: string
- Purpose: Links usage to conversation (for conversation-level analytics)
- Source: AIExecutionRequest.conversationId
- Immutable: Yes
- Indexed: Optional (for conversation analytics)

**provider:**
- Type: string
- Purpose: Identifies AI provider (for provider-level reporting)
- Source: ai-service response or adapter configuration
- Examples: 'anthropic', 'openai', 'stub'
- Immutable: Yes
- Indexed: Optional (for provider analytics)

**adapter:**
- Type: string
- Purpose: Identifies specific adapter used
- Source: ai-service adapter name
- Examples: 'claude-stub', 'anthropic-http', 'openai-http'
- Immutable: Yes
- Indexed: Optional (for adapter analytics)

**model:**
- Type: string
- Purpose: Identifies specific AI model (for model-level costing)
- Source: AIExecutionResult.model from ai-service
- Examples: 'claude-3-5-sonnet-20241022', 'gpt-4', 'stub'
- Immutable: Yes
- Indexed: Yes (for model-based billing)

**tokensUsed:**
- Type: number (integer, non-negative)
- Purpose: Actual tokens consumed (basis for billing)
- Source: AIExecutionResult.tokensUsed from ai-service
- Immutable: Yes
- Validation: Must be > 0 (success-only guarantees this)

**executionDurationMs:**
- Type: number (integer, non-negative)
- Purpose: Execution time (for performance analytics)
- Source: api-gateway measures time between request and response
- Unit: Milliseconds
- Immutable: Yes

**timestamp:**
- Type: string (ISO 8601 format)
- Purpose: When execution completed
- Source: api-gateway system time at ledger write
- Format: "2026-02-06T10:45:30.123Z"
- Timezone: UTC
- Immutable: Yes
- Indexed: Yes (for time-range queries)

**metadata (optional):**
- Type: object (key-value pairs)
- Purpose: Reserved for future extensibility
- Source: Future phases may add metadata
- Immutable: Yes
- Examples: { "region": "us-east-1", "version": "1.0.0" }

### 3.3 What is NOT Recorded

**Explicitly FORBIDDEN from UsageRecord:**

**❌ Prompt Content:**
- No user prompts
- No user input text
- No conversation history
- Rationale: Privacy policy (Phase 15B)

**❌ AI Output Content:**
- No AI responses
- No generated text
- No completion content
- Rationale: Privacy policy (Phase 15B)

**❌ API Key Values:**
- No actual API key strings
- Only apiKeyId (identifier, not credential)
- Rationale: Security policy (Phase 20A)

**❌ Internal URLs:**
- No service URLs
- No internal endpoints
- Rationale: Security policy

**❌ Request/Response Bodies:**
- No full AIExecutionRequest
- No full AIExecutionResult
- Rationale: Privacy and storage efficiency

**❌ Failure Information:**
- No error messages
- No stack traces
- No failure reasons
- Rationale: Success-only ledger (failures not recorded)

**❌ Quota State:**
- No quota limits
- No quota remaining
- No quota usage
- Rationale: Quota is separate system (Phase 21B)

**❌ Pricing/Billing:**
- No cost calculations
- No prices
- No charges
- Rationale: Billing is separate phase (Phase 23+)

### 3.4 Record Size Estimate

**Estimated Record Size:**
- executionId: ~36 bytes (UUID)
- apiKeyId: ~20 bytes
- userId: ~20 bytes
- sessionId: ~36 bytes (UUID)
- conversationId: ~36 bytes (UUID)
- provider: ~10 bytes
- adapter: ~20 bytes
- model: ~30 bytes
- tokensUsed: ~4 bytes (integer)
- executionDurationMs: ~4 bytes (integer)
- timestamp: ~24 bytes (ISO 8601)
- metadata: ~50 bytes (optional)

**Total: ~290 bytes per record**

**Storage Projections:**
- 1,000 executions/day: ~290 KB/day, ~8.7 MB/month
- 10,000 executions/day: ~2.9 MB/day, ~87 MB/month
- 100,000 executions/day: ~29 MB/day, ~870 MB/month

---

## 4. Write Semantics

### 4.1 When Records Are Written

**Write Trigger:**
- Write occurs ONLY after successful AI execution
- Write occurs AFTER receiving AIExecutionResult from ai-service
- Write occurs BEFORE returning response to client

**Write Flow:**
```
1. api-gateway receives AIExecutionResult from ai-service
2. api-gateway validates result is success (no exception)
3. api-gateway constructs UsageRecord
4. api-gateway writes record to ledger
5. api-gateway returns AIExecutionResult to client
```

**Timing Guarantee:**
- Record written synchronously before client receives response
- Client receives response only after ledger write succeeds
- If ledger write fails, client may receive error (or success, see below)

### 4.2 Success-Only Rule

**Success-Only Recording:**
- ✅ Record written ONLY if ai-service returns AIExecutionResult
- ✅ Record written ONLY if no exceptions thrown
- ❌ NO record written if auth fails (Phase 20A)
- ❌ NO record written if authz fails (Phase 20B)
- ❌ NO record written if quota fails (Phase 21B)
- ❌ NO record written if ai-service throws exception (Phase 15A)
- ❌ NO record written if execution times out
- ❌ NO record written if any other error occurs

**Rationale:**
- Billing only for successful executions
- No billing for failed requests
- No billing for rate-limited requests
- Ledger is source of truth for billable usage

**Success Criteria:**
- ai-service returns AIExecutionResult with tokensUsed > 0
- No exceptions thrown during execution
- api-gateway receives complete response

### 4.3 Atomicity Expectations

**Write Atomicity:**
- Each UsageRecord write is atomic (all fields or none)
- No partial records allowed
- Write either succeeds completely or fails completely

**Transaction Guarantees:**
- Record write is independent of response delivery (design choice in Phase 22B)
- Two design options:

**Option A: Write-Before-Response (Strict Guarantee):**
```
1. Execution succeeds
2. Write ledger record (MUST succeed)
3. Return response to client
If ledger write fails → return 500 to client
```
- ✅ Guarantee: Every successful response has a ledger record
- ❌ Risk: Client sees 500 even though execution succeeded

**Option B: Write-After-Response (Best Effort):**
```
1. Execution succeeds
2. Return response to client
3. Write ledger record asynchronously
If ledger write fails → log error, alert, retry
```
- ✅ Guarantee: Client always gets successful response
- ❌ Risk: Ledger record may be missing (requires reconciliation)

**Design Decision (Phase 22B):**
- Phase 22A leaves this decision open
- Phase 22B must choose based on tradeoffs
- Recommendation: Option A (Write-Before-Response) for Phase 22B MVP

### 4.4 Failure Behavior

**Ledger Write Failure:**
- If ledger write fails, no partial record exists
- Error is logged for monitoring
- Depending on design choice (Option A or B above):
  - Option A: Client receives 500 error
  - Option B: Client receives success, ledger record missing

**No Retries in Phase 22B:**
- Phase 22B does not retry failed writes automatically
- Retries are future enhancement (Phase 22C+)
- Failed writes are logged for manual reconciliation

**Duplicate Prevention:**
- executionId uniqueness enforced by ledger storage
- Duplicate writes (same executionId) should be rejected
- Idempotent writes preferred (retry-safe)

### 4.5 Write Performance

**Write Latency:**
- Ledger write adds latency to client response
- Target: < 50ms additional latency (Phase 22B)
- Measure: p95, p99 latency impact

**Write Throughput:**
- Ledger must support peak execution rate
- Example: 100 executions/second = 100 writes/second
- Must not become bottleneck

---

## 5. Read Semantics

### 5.1 Intended Consumers

**Primary Consumers (Future Phases):**

**Billing Service (Phase 23+):**
- Query: Get all records for apiKeyId in time range
- Purpose: Calculate monthly/daily charges
- Access: Read-only

**Analytics Service (Phase 24+):**
- Query: Aggregate tokensUsed by model, provider, user
- Purpose: Usage dashboards, trends
- Access: Read-only

**Admin Dashboard (Phase 25+):**
- Query: Get records by userId, apiKeyId, sessionId
- Purpose: User audit logs, support tickets
- Access: Read-only

**Reconciliation Service (Phase 26+):**
- Query: Compare ledger vs quota vs token-usage table
- Purpose: Detect discrepancies, ensure consistency
- Access: Read-only

### 5.2 Read Access Model

**Read-Only Semantics:**
- Consumers NEVER update records
- Consumers NEVER delete records
- Consumers ONLY read records
- Immutable ledger guarantee

**Query Patterns (Design):**

**Query by apiKeyId:**
```
Get all UsageRecords where apiKeyId = "key-123"
  AND timestamp >= "2026-02-01T00:00:00Z"
  AND timestamp < "2026-03-01T00:00:00Z"
Order by timestamp ASC
```
- Purpose: Billing per API key
- Index: apiKeyId + timestamp

**Query by userId:**
```
Get all UsageRecords where userId = "user-456"
  AND timestamp >= "2026-02-01T00:00:00Z"
  AND timestamp < "2026-03-01T00:00:00Z"
Order by timestamp ASC
```
- Purpose: User-level reporting
- Index: userId + timestamp

**Aggregate by model:**
```
SELECT model, SUM(tokensUsed), COUNT(*)
FROM UsageRecords
WHERE timestamp >= "2026-02-01T00:00:00Z"
  AND timestamp < "2026-03-01T00:00:00Z"
GROUP BY model
```
- Purpose: Model-level analytics
- Index: timestamp + model (or full table scan)

### 5.3 Read Consistency

**Consistency Model:**
- Eventually consistent reads acceptable (for Phase 22B)
- Strong consistency not required for billing (daily/monthly cycles)
- Reads may lag writes by seconds (acceptable)

**Stale Reads:**
- Billing queries tolerate stale data (batch processing)
- Analytics queries tolerate stale data (near real-time acceptable)
- Admin queries may want recent data (eventual consistency acceptable)

**No Mutation Guarantees:**
- Once written, records NEVER change
- Immutability simplifies caching, replication
- No update conflicts possible

### 5.4 Read Performance

**Query Performance:**
- Billing queries may scan millions of records (monthly billing)
- Analytics queries may aggregate millions of records (dashboards)
- Admin queries should be fast (< 1 second for user audit)

**Index Requirements:**
- Primary index: executionId (unique)
- Secondary index: apiKeyId + timestamp (billing)
- Secondary index: userId + timestamp (reporting)
- Secondary index: timestamp only (time-range scans)

---

## 6. Storage Strategy (Design Options)

### 6.1 Option 1: Database Table (PostgreSQL)

**Approach:**
- Store UsageRecords in PostgreSQL table
- Append-only writes (INSERT only)
- Indexed queries for billing/analytics

**Schema (Conceptual):**
```sql
CREATE TABLE usage_records (
  execution_id UUID PRIMARY KEY,
  api_key_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  session_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  adapter VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  tokens_used INTEGER NOT NULL,
  execution_duration_ms INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB,
  INDEX idx_api_key_timestamp (api_key_id, timestamp),
  INDEX idx_user_timestamp (user_id, timestamp),
  INDEX idx_timestamp (timestamp)
);
```

**Advantages:**
- ✅ Mature, reliable technology
- ✅ ACID guarantees
- ✅ Rich query capabilities (SQL)
- ✅ Existing PostgreSQL infrastructure
- ✅ Supports indexes for fast queries
- ✅ Supports aggregations (SUM, COUNT, GROUP BY)
- ✅ Backup/restore well understood

**Disadvantages:**
- ❌ Write latency (tens of ms)
- ❌ Table growth over time (millions of rows)
- ❌ Requires vacuuming/maintenance
- ❌ Limited horizontal scaling (single-node writes)

**When to Use:**
- Phase 22B MVP (simplest implementation)
- Low-to-medium volume (< 10,000 executions/day)
- Query flexibility more important than write throughput

### 6.2 Option 2: Event Log (Append-Only File)

**Approach:**
- Append UsageRecords to log file
- One record per line (JSON or CSV)
- No indexes (sequential scan or external indexer)

**Format (Conceptual):**
```
2026-02-06T10:45:30.123Z|exec-123|key-test|user-1|session-1|conv-1|anthropic|claude-stub|claude-3-5-sonnet-20241022|100|1234
2026-02-06T10:46:15.456Z|exec-124|key-1|user-2|session-2|conv-2|anthropic|claude-stub|claude-3-5-sonnet-20241022|200|2345
...
```

**Advantages:**
- ✅ Extremely fast writes (append-only)
- ✅ Simple implementation (file I/O)
- ✅ No database overhead
- ✅ Easy to archive/compress (gzip)
- ✅ Immutable by design

**Disadvantages:**
- ❌ No indexes (slow queries)
- ❌ Requires separate indexing system (e.g., load into DB later)
- ❌ No query capabilities (must parse entire file)
- ❌ Limited durability (file system only)
- ❌ Harder to query in real-time

**When to Use:**
- High write throughput required (> 10,000 executions/day)
- Batch processing acceptable (load into DB nightly)
- Real-time queries not required

### 6.3 Option 3: Time-Series Database (InfluxDB, TimescaleDB)

**Approach:**
- Store UsageRecords in time-series database optimized for time-based queries
- Leverage time-series indexing for fast time-range queries

**Advantages:**
- ✅ Optimized for time-series data (timestamp-based queries)
- ✅ Fast time-range queries
- ✅ Automatic data retention policies
- ✅ Compression for old data

**Disadvantages:**
- ❌ Additional infrastructure (new database)
- ❌ Learning curve (new technology)
- ❌ May be overkill for Phase 22B MVP

**When to Use:**
- Large scale (> 100,000 executions/day)
- Time-series queries dominant (billing cycles, trends)
- Infrastructure investment justified

### 6.4 Option 4: Event Stream (Kafka, RabbitMQ)

**Approach:**
- Publish UsageRecords to event stream
- Consumers subscribe to stream for billing/analytics
- Persistent storage optional (stream retention)

**Advantages:**
- ✅ Decouples writers from readers
- ✅ Supports multiple consumers
- ✅ Scales horizontally (partitioned topics)
- ✅ Real-time event processing

**Disadvantages:**
- ❌ Additional infrastructure (message broker)
- ❌ Requires separate storage for historical queries
- ❌ More complex architecture
- ❌ Overkill for Phase 22B MVP

**When to Use:**
- Event-driven architecture required
- Multiple consumers need real-time events
- Decoupling critical

### 6.5 Recommendation for Phase 22B

**Recommended: Option 1 (PostgreSQL Database Table)**

**Rationale:**
- Simplest implementation for MVP
- Leverages existing PostgreSQL infrastructure
- Supports rich queries out of the box
- ACID guarantees for correctness
- Well-understood backup/restore
- Sufficient performance for initial scale (< 10,000 executions/day)

**Migration Path:**
- Phase 22B: PostgreSQL table
- Phase 22C+: Migrate to time-series DB or event stream if scale requires
- Design allows storage implementation to change without affecting API

---

## 7. Non-Goals (Explicitly NOT Implemented)

### 7.1 NOT in Phase 22A/22B

**❌ Billing Calculations:**
- No cost per token
- No pricing logic
- No invoice generation
- No charge calculations
- Rationale: Billing is separate phase (Phase 23+)

**❌ Pricing Configuration:**
- No price tables
- No per-model pricing
- No per-provider pricing
- Rationale: Pricing is separate phase (Phase 23+)

**❌ Invoicing:**
- No invoice generation
- No payment processing
- No billing cycles
- Rationale: Invoicing is separate phase (Phase 23+)

**❌ Quota Reconciliation:**
- No comparison of quota vs ledger
- No quota adjustment based on ledger
- No quota refunds
- Rationale: Phase 21B quota is independent

**❌ Real-Time Aggregation:**
- No real-time dashboards
- No live usage meters
- No streaming aggregates
- Rationale: Batch processing sufficient for Phase 22B

**❌ Reporting APIs:**
- No public APIs to query ledger
- No user-facing usage reports
- No admin dashboards
- Rationale: Reporting is separate phase (Phase 24+)

**❌ Data Export:**
- No CSV export
- No data dumps
- No S3 archival
- Rationale: Export is future enhancement

**❌ Data Retention Policies:**
- No automatic deletion of old records
- No archival to cold storage
- No GDPR compliance (yet)
- Rationale: Retention policies are future phase

**❌ Ledger Mutations:**
- No updates to existing records
- No deletions
- No corrections
- Rationale: Immutable ledger by design

**❌ Distributed Ledger:**
- No multi-region writes
- No distributed consensus
- No blockchain
- Rationale: Single-region sufficient for Phase 22B

### 7.2 Future Enhancements (NOT NOW)

**Phase 22C+ (Potential Future):**
- Ledger read APIs (public endpoints)
- Real-time aggregation (streaming)
- Data export (CSV, JSON)
- Data retention policies (delete old records)
- Multi-region replication (geo-distributed)
- Ledger analytics (built-in dashboards)

**Phase 23+ (Billing):**
- Cost calculation (price per token)
- Invoice generation (monthly bills)
- Payment processing (Stripe integration)

**Phase 24+ (Analytics):**
- Usage dashboards (charts, graphs)
- Trend analysis (usage over time)
- Anomaly detection (unusual usage patterns)

---

## 8. Integration with Existing Phases

### 8.1 Phase 13 (Token Recording)

**Current State (Phase 13):**
- Token recording occurs in token-usage table (PostgreSQL)
- Records every successful execution
- Purpose: Internal tracking, not billing

**Phase 22B Relationship:**
- Usage Ledger is NEW, independent of token-usage table
- Both write to separate tables
- Both triggered by successful execution
- Token-usage table remains unchanged (Phase 13 locked)

**Future Reconciliation (Phase 26+):**
- Reconciliation service can compare:
  - token-usage table (Phase 13)
  - usage_records table (Phase 22B)
  - Detect discrepancies
- Phase 22B does not reconcile

### 8.2 Phase 20A/20B (Authentication/Authorization)

**Integration:**
- Usage Ledger uses verified userId from Phase 20A
- Usage Ledger uses apiKeyId from Phase 20A
- Usage Ledger records only after Phase 20B authz passes

**Trust Boundary:**
- api-gateway provides verified identity
- Ledger trusts api-gateway (no re-verification)

### 8.3 Phase 21B (Quota Enforcement)

**Integration:**
- Quota enforcement (Phase 21B) is independent of Usage Ledger (Phase 22B)
- Quota uses estimated tokens (pre-execution)
- Ledger uses actual tokens (post-execution)
- No reconciliation between quota and ledger in Phase 22B

**Future Integration (Phase 26+):**
- Reconciliation service can compare:
  - Quota usage (Phase 21B in-memory state)
  - Ledger records (Phase 22B actual usage)
  - Detect over/under counting
- Phase 22B does not affect quota

### 8.4 Phase 15B (Privacy Policy)

**Privacy Compliance:**
- Usage Ledger respects Phase 15B privacy policy
- NO prompt content recorded
- NO response content recorded
- NO sensitive user data

**Allowed:**
- User ID (identifier only)
- API key ID (identifier only)
- Session ID (identifier only)
- Tokens used (numeric)
- Model name (string)

---

## 9. Design Decisions & Rationale

### 9.1 Why api-gateway Owns Ledger

**Decision:** api-gateway writes ledger records

**Rationale:**
- api-gateway is enforcement boundary (Phase 20/21)
- api-gateway has verified identity (Phase 20A)
- api-gateway has actual execution results
- Centralizes billing-critical logic
- ai-service remains stateless (Phase 12B)

**Alternative Rejected:**
- ai-service writes ledger: Violates stateless guarantee (Phase 12B)
- Separate ledger service: Adds complexity for Phase 22B MVP

### 9.2 Why Success-Only Recording

**Decision:** Record only successful executions

**Rationale:**
- Billing only for successful AI responses
- No billing for rate-limited requests (Phase 21B)
- No billing for failed executions (Phase 15A)
- Simplifies ledger (no error codes, no failure types)

**Alternative Rejected:**
- Record all requests (including failures): Complicates billing logic

### 9.3 Why Immutable Records

**Decision:** Records are write-once, never updated

**Rationale:**
- Audit trail integrity
- Simplifies consistency (no update conflicts)
- Simplifies replication (append-only)
- Billing accuracy (no retroactive changes)

**Alternative Rejected:**
- Mutable records: Complicates audit trail, risk of tampering

### 9.4 Why Synchronous Write

**Decision (Recommended):** Write ledger before returning response

**Rationale:**
- Guarantees every successful response has ledger record
- Simplifies billing (no missing records)
- Acceptable latency impact (< 50ms target)

**Alternative:**
- Asynchronous write: Faster response, but risk of missing records

### 9.5 Why PostgreSQL for Phase 22B

**Decision (Recommended):** Use PostgreSQL for Phase 22B MVP

**Rationale:**
- Existing infrastructure (no new services)
- ACID guarantees (correctness)
- Rich query capabilities (SQL)
- Sufficient performance for initial scale
- Simpler implementation (fewer moving parts)

**Alternative:**
- Event stream, time-series DB: More scalable but overkill for MVP

---

## 10. Phase 22B Implementation Guidance (Preview)

### 10.1 Implementation Checklist (NOT TO BE EXECUTED IN PHASE 22A)

**Files to Create (Phase 22B):**
- `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`
- `services/api-gateway/src/usage-ledger/usage-ledger.module.ts`
- `services/api-gateway/src/usage-ledger/usage-record.entity.ts`
- `services/api-gateway/src/usage-ledger/usage-ledger.repository.ts`

**Files to Modify (Phase 22B):**
- `services/api-gateway/src/ai/ai-execution.controller.ts` (write ledger after success)

**Files NOT to Modify (Phase 22B):**
- ✅ All ai-service files (ai-service unchanged)
- ✅ AIExecutionRequest/AIExecutionResult (contracts locked)

### 10.2 Write Flow (Phase 22B)

```typescript
// Conceptual flow (NOT implementation)

async execute(request: AIExecutionRequest, identity: ApiKeyIdentity): Promise<AIExecutionResult> {
  const startTime = Date.now();

  // 1. Forward to ai-service (existing Phase 20/21 logic)
  const result = await this.aiServiceHttpClient.execute(verifiedRequest);

  // 2. Calculate duration
  const durationMs = Date.now() - startTime;

  // 3. Construct ledger record (NEW in Phase 22B)
  const usageRecord: UsageRecord = {
    executionId: generateUUID(),
    apiKeyId: identity.apiKeyId,
    userId: identity.userId,
    sessionId: request.sessionId,
    conversationId: request.conversationId,
    provider: result.provider || 'unknown',
    adapter: result.adapter || 'unknown',
    model: result.model,
    tokensUsed: result.tokensUsed,
    executionDurationMs: durationMs,
    timestamp: new Date().toISOString(),
  };

  // 4. Write to ledger (NEW in Phase 22B)
  await this.usageLedgerService.writeRecord(usageRecord);

  // 5. Return result (existing Phase 20/21 logic)
  return result;
}
```

### 10.3 Testing Requirements (Phase 22B)

**Unit Tests Required:**
- UsageLedgerService: write record success
- UsageLedgerService: write record failure handling
- UsageLedgerService: duplicate executionId rejection
- UsageRecord validation

**Integration Tests Required:**
- End-to-end: Successful execution → ledger record exists
- End-to-end: Failed execution → no ledger record
- End-to-end: Quota exceeded → no ledger record
- Ledger query by apiKeyId
- Ledger query by userId
- Ledger query by time range

---

## ULTRA-BRIEF SUMMARY

• **api-gateway owns ledger** with exclusive write responsibility after successful AI execution, maintaining verified userId and apiKeyId from Phase 20A while ai-service remains stateless and unchanged

• **Success-only immutable records** append to ledger containing executionId, apiKeyId, userId, provider, model, tokensUsed, executionDurationMs, and timestamp with NO prompt/response content (Phase 15B privacy preserved)

• **Write-before-response semantics** recommended for Phase 22B with synchronous ledger write occurring after ai-service success but before client response, guaranteeing every successful response has corresponding ledger entry (no partial executions)

• **PostgreSQL table storage** recommended for Phase 22B MVP with indexes on apiKeyId+timestamp and userId+timestamp enabling billing and analytics queries while supporting future migration to time-series or event-stream architectures

• **Explicit non-goals** include billing calculations, pricing, invoicing, quota reconciliation, real-time aggregation, and reporting APIs (deferred to Phase 23+ for billing, Phase 24+ for analytics, Phase 26+ for reconciliation)

---

**END OF PHASE 22A DESIGN**
