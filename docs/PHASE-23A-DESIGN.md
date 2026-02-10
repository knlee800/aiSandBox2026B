# PHASE 23A DESIGN: Billing Architecture (Design Only)

**Status:** DESIGN-ONLY (No Implementation)
**Nature:** Billing System Design (api-gateway only)
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 23 (Billing)
**Prerequisite:** Phase 22 (Usage Ledger) COMPLETE

---

## 1. Billing Scope (What Billing IS)

### 1.1 Core Definition

**Billing is:**
- A read-only consumer of the Usage Ledger (Phase 22)
- A deterministic transformation: `UsageRecord → BillableUsage`
- A post-execution concern only (never affects execution)
- Entirely decoupled from execution flow
- Owned and operated exclusively by api-gateway

### 1.2 Billing as Read-Only Consumer

**Read-Only Characteristics:**
- Billing reads from usage_records table (Phase 22)
- Billing NEVER writes to usage_records table
- Billing NEVER modifies ledger records
- Billing NEVER deletes ledger records
- Ledger remains immutable source of truth

**Consumption Model:**
```
Usage Ledger (Phase 22)
  ↓ (read-only)
Billing Logic (Phase 23)
  ↓ (transform)
Billable Usage
  ↓ (external)
Invoicing System (Phase 24+)
```

### 1.3 Deterministic Transformation

**Transformation Guarantee:**
- Same UsageRecord → same BillableUsage (always)
- No randomness in billing calculation
- No timing dependence
- No external API calls for pricing
- Pure function semantics

**Transformation Formula (Conceptual):**
```
BillableUsage = f(UsageRecord, PricingConfig)

Where:
  f is deterministic
  PricingConfig is static (no runtime changes)
  Output depends ONLY on inputs
```

### 1.4 Post-Execution Concern

**Timing Separation:**
- Billing occurs AFTER execution completes
- Billing occurs AFTER ledger write succeeds
- Billing occurs AFTER client receives response
- Billing is asynchronous to execution

**Critical Guarantee:**
- Billing NEVER affects execution success/failure
- Billing NEVER blocks execution
- Billing failures do NOT propagate to execution
- Execution and billing are independent systems

### 1.5 Decoupling from Execution

**Decoupling Principles:**
- Execution does NOT wait for billing
- Execution does NOT know about billing
- Billing errors do NOT fail requests
- Billing logic is separate from execution logic

**Decoupling Benefits:**
- Execution latency unaffected by billing
- Billing complexity isolated
- Billing changes don't affect execution
- Billing failures don't affect availability

---

## 2. Explicit Non-Goals (What Billing is NOT)

### 2.1 NOT in Phase 23A/23B

**❌ No Pricing Enforcement at Execution Time:**
- Billing does NOT check "can afford" before execution
- Billing does NOT block execution based on balance
- Billing does NOT enforce spending limits
- Billing does NOT reject requests based on cost
- Rationale: Execution and billing are decoupled

**❌ No Real-Time Billing Decisions:**
- Billing does NOT make synchronous decisions
- Billing does NOT return costs in execution response
- Billing does NOT provide real-time balance updates
- Rationale: Billing is asynchronous, post-execution

**❌ No Quota Enforcement:**
- Billing does NOT enforce rate limits
- Billing does NOT limit requests per period
- Billing does NOT enforce token quotas
- Rationale: Quota enforcement is Phase 21B (separate)

**❌ No Retries or Execution Coupling:**
- Billing does NOT retry failed executions
- Billing does NOT trigger re-execution
- Billing does NOT affect execution retry logic
- Rationale: Execution is Phase 12-15 (locked)

**❌ No Invoice Generation:**
- Billing does NOT create invoices
- Billing does NOT send bills
- Billing does NOT format billing statements
- Rationale: Invoicing is Phase 24+ (separate)

**❌ No Payment Processing:**
- Billing does NOT charge credit cards
- Billing does NOT collect payments
- Billing does NOT integrate with Stripe/PayPal
- Rationale: Payment processing is Phase 24+ (separate)

**❌ No Refunds or Disputes:**
- Billing does NOT process refunds
- Billing does NOT handle billing disputes
- Billing does NOT adjust charges retroactively
- Rationale: Refunds are Phase 24+ (separate)

**❌ No Usage Aggregation APIs:**
- Billing does NOT expose query endpoints
- Billing does NOT provide usage reports
- Billing does NOT create dashboards
- Rationale: Reporting APIs are Phase 24+ (separate)

**❌ No UI or Reporting Dashboards:**
- Billing does NOT provide web UI
- Billing does NOT create usage graphs
- Billing does NOT show real-time costs
- Rationale: UI is Phase 25+ (separate)

**❌ No Changes to ai-service:**
- Billing does NOT modify ai-service
- Billing does NOT add ai-service logic
- ai-service remains unaware of billing
- Rationale: Service boundary preservation (Phase 12B)

### 2.2 Future Enhancements (NOT NOW)

**Phase 24+ (Potential Future):**
- Invoice generation (PDF, email)
- Payment processing (Stripe integration)
- Billing cycles (monthly, annual)
- Usage reports (API endpoints)
- Refund processing
- Dispute handling
- Credit system
- Prepaid balances

**Phase 25+ (Potential Future):**
- Billing dashboard (web UI)
- Real-time cost tracking
- Budget alerts
- Usage forecasting
- Cost optimization recommendations

---

## 3. Ownership & Responsibility Boundaries

### 3.1 api-gateway Ownership

**api-gateway OWNS:**
- Billing logic and calculations
- Pricing configuration (price tables)
- Billable usage derivation
- Billing record generation
- Billing error handling
- Billing audit trail

**api-gateway RESPONSIBILITIES:**
- Read usage_records table (Phase 22)
- Apply pricing rules to usage records
- Calculate billable amounts
- Store billable usage records
- Log billing errors
- Maintain billing determinism

**api-gateway DOES NOT:**
- Generate invoices (Phase 24+)
- Process payments (Phase 24+)
- Send billing notifications (Phase 24+)
- Provide billing APIs (Phase 24+)

### 3.2 ai-service Ownership

**ai-service OWNS:**
- NOTHING related to billing

**ai-service RESPONSIBILITIES:**
- Execute AI requests (Phase 12-15, unchanged)
- Return AIExecutionResult (Phase 12B, unchanged)
- Remain stateless (Phase 12B, unchanged)

**ai-service DOES NOT:**
- Know about billing
- Know about pricing
- Calculate costs
- Store billing data
- Affect billing in any way

**ai-service Changes in Phase 23:**
- ZERO files modified
- ZERO files added
- ZERO behavior changes
- Complete isolation from billing

### 3.3 Caller Ownership

**Callers (External Systems) OWN:**
- Invoice generation (external to platform)
- Payment processing (external to platform)
- Billing notifications (external to platform)
- Customer billing portals (external to platform)
- Payment reconciliation (external to platform)

**Callers CONSUME:**
- Billable usage records (from api-gateway)
- Pricing configuration (from api-gateway)
- Usage ledger (via read APIs, Phase 24+)

**Callers DO NOT:**
- Modify usage ledger
- Calculate billing directly
- Access execution logic

### 3.4 Service Boundary Diagram

```
┌──────────────────────────────────────────────┐
│ Client (Frontend)                            │
│ - Executes AI requests                       │
│ - NO billing awareness                       │
└─────────────┬────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────┐
│ api-gateway                                  │
│ 1. Execute request (Phase 12-21)             │
│ 2. Write usage ledger (Phase 22)             │
│ 3. Return result to client                   │
│ 4. (Later) Calculate billing (Phase 23) ←    │
│    - Read usage_records                      │
│    - Apply pricing                           │
│    - Write billable_usage                    │
└─────────────┬────────────────────────────────┘
              ↓ (unchanged)
┌──────────────────────────────────────────────┐
│ ai-service                                   │
│ - Execute AI requests (unchanged)            │
│ - NO billing logic                           │
└──────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────┐
│ PostgreSQL (aisandbox database)              │
│ - usage_records (Phase 22, input)            │
│ - billable_usage (Phase 23B, output)         │
└──────────────────────────────────────────────┘
              ↓ (external)
┌──────────────────────────────────────────────┐
│ External Billing System (Phase 24+)          │
│ - Invoicing                                  │
│ - Payment processing                         │
│ - Customer portal                            │
└──────────────────────────────────────────────┘
```

---

## 4. Billing Input Model

### 4.1 Input: Immutable UsageRecord

**Billing Input (From Phase 22):**
```typescript
interface UsageRecord {
  executionId: string;           // Unique execution ID
  apiKeyId: string;              // API key identifier
  userId: string;                // Verified user ID
  sessionId: string;             // Session ID
  conversationId: string;        // Conversation ID
  provider: string;              // AI provider (e.g., 'anthropic')
  adapter: string;               // Adapter (e.g., 'claude-stub')
  model: string;                 // Model (e.g., 'claude-3-5-sonnet-20241022')
  tokensUsed: number;            // Actual tokens consumed
  executionDurationMs: number;   // Execution duration
  timestamp: Date;               // Execution timestamp
  metadata?: Record<string, unknown>; // Optional metadata
}
```

**Input Characteristics:**
- ✅ Immutable (never changes after write)
- ✅ Success-only (no failed executions)
- ✅ Verified identity (userId, apiKeyId from Phase 20A)
- ✅ Actual tokens (from ai-service, not estimated)
- ✅ No sensitive content (no prompts, no responses)

### 4.2 Input Guarantees

**Billing Input Guarantees (From Phase 22):**
- ✅ Every UsageRecord represents successful execution
- ✅ tokensUsed is actual tokens (from AIExecutionResult)
- ✅ model is actual model used (from AIExecutionResult)
- ✅ provider and adapter are accurate
- ✅ timestamp is accurate (UTC)
- ✅ No duplicate executionIds
- ✅ No missing required fields

**Critical Guarantee:**
- Billing MUST NOT infer or estimate tokens
- Billing MUST use tokensUsed from UsageRecord (exact)
- Billing MUST NOT bill failed executions (guaranteed by Phase 22)

### 4.3 Input Query Model

**How Billing Accesses Input:**
```sql
-- Conceptual query (design only)
SELECT *
FROM usage_records
WHERE timestamp >= :billing_period_start
  AND timestamp < :billing_period_end
  AND apiKeyId = :api_key_id
ORDER BY timestamp ASC;
```

**Query Characteristics:**
- Read-only queries (no writes)
- Time-range based (billing periods)
- Per-API-key aggregation
- No filtering by success/failure (all records are success)

### 4.4 Input Validation

**Validation Rules (Design):**
- Billing MUST validate UsageRecord completeness
- Billing MUST reject records with missing fields
- Billing MUST reject records with invalid data
- Billing errors MUST be logged (no silent failures)

**Validation Does NOT:**
- Modify ledger records
- Retry failed executions
- Estimate missing data
- Fill in defaults

---

## 5. Pricing Model (DESIGN ONLY)

### 5.1 Pricing Structure

**Pricing Basis:**
- Primary: Token-based pricing (cost per token)
- Secondary: Time-based pricing (cost per second, optional)
- Granularity: Per provider + per model
- Configuration: Static pricing table (no runtime changes)

**Pricing Formula (Conceptual):**
```
BillableAmount = (tokensUsed × pricePerToken) + (executionDurationMs / 1000 × pricePerSecond)

Where:
  pricePerToken = PricingTable[provider][model].tokenPrice
  pricePerSecond = PricingTable[provider][model].timePrice (optional)
```

### 5.2 Example Pricing Table (Illustrative Only)

**Pricing Configuration (Design Concept):**
```yaml
# Example pricing (NOT final, design only)
pricing:
  anthropic:
    claude-3-5-sonnet-20241022:
      token_price: 0.00001  # $0.01 per 1000 tokens
      time_price: 0.0       # $0 per second (token-only)
    claude-3-opus-20240229:
      token_price: 0.00005  # $0.05 per 1000 tokens
      time_price: 0.0
  openai:
    gpt-4:
      token_price: 0.00003  # $0.03 per 1000 tokens
      time_price: 0.0
    gpt-3.5-turbo:
      token_price: 0.000002 # $0.002 per 1000 tokens
      time_price: 0.0
  stub:
    stub:
      token_price: 0.0      # Free (testing)
      time_price: 0.0
```

**Pricing Table Characteristics:**
- Config-driven (no hardcoded prices)
- Per provider + per model granularity
- Token-based primary
- Time-based optional (design allows, may not implement)
- Zero-cost models allowed (e.g., stub, testing)

### 5.3 Pricing Configuration Ownership

**Who Owns Pricing:**
- api-gateway owns pricing configuration
- Pricing is static (no runtime changes in Phase 23B)
- Pricing is read from config file or environment
- Pricing is NOT stored in database (Phase 23B)

**Future: Dynamic Pricing (Phase 23C+):**
- Database-backed pricing (future)
- Admin API for pricing updates (future)
- Pricing history tracking (future)
- NOT in Phase 23A/23B

### 5.4 Pricing Determinism

**Determinism Requirements:**
- Same UsageRecord + same PricingConfig → same BillableAmount
- No time-of-day pricing (no variable pricing)
- No promotional pricing (no temporary discounts)
- No user-specific pricing (Phase 23B, future: Phase 23C+)

**Rationale:**
- Determinism enables audit trail
- Determinism enables reproducibility
- Determinism enables dispute resolution

### 5.5 Missing Price Handling

**If Model Price Not Found:**
- Option A: Default to zero (no charge, log warning)
- Option B: Fail billing calculation (log error)
- Option C: Default to base price (fallback)

**Design Decision (Phase 23B):**
- Recommendation: Option A (default to zero, log warning)
- Rationale: Billing failures should not affect execution
- Future: Phase 23C+ can add strict pricing enforcement

---

## 6. Determinism & Auditability

### 6.1 Determinism Guarantees

**Billing Determinism:**
- Same UsageRecord → same BillableUsage (always)
- Same pricing config → same result (always)
- No randomness in calculations
- No timing dependence (billing at time T or T+1 yields same result)
- No external API calls (all data is local)

**Mathematical Determinism:**
```
f(UsageRecord, PricingConfig) = BillableUsage

Where f is:
  - Pure function (no side effects)
  - Deterministic (same inputs → same output)
  - Idempotent (multiple calls → same result)
```

### 6.2 Auditability

**Audit Trail:**
```
executionId (Phase 22)
  ↓
UsageRecord (Phase 22, immutable)
  ↓
BillableUsage (Phase 23, immutable)
  ↓
Invoice (Phase 24+, immutable)
```

**Audit Capabilities:**
- Trace any charge back to specific execution
- Reproduce billing calculation from ledger
- Verify pricing was applied correctly
- Detect billing errors or anomalies

### 6.3 Reproducibility

**Billing Reproducibility:**
- Given: executionId
- Find: UsageRecord in usage_records table
- Apply: PricingConfig at time of billing
- Reproduce: Exact BillableAmount

**Rationale:**
- Enables dispute resolution
- Enables billing corrections
- Enables audit compliance
- Enables historical analysis

### 6.4 Immutability

**Immutability Guarantees:**
- UsageRecords are immutable (Phase 22)
- BillableUsage records are immutable (Phase 23B)
- No retroactive billing changes (Phase 23B)
- No updates to past billing (Phase 23B)

**Exception: Corrections (Future):**
- Phase 24+ may allow billing corrections
- Corrections are new records (not updates)
- Original records remain unchanged
- Correction audit trail maintained

---

## 7. Failure Semantics

### 7.1 Billing Failure Behavior

**Critical Guarantee:**
- Billing failures do NOT affect execution
- Billing failures do NOT modify ledger
- Billing failures do NOT propagate to client
- Billing failures do NOT fail requests

**Failure Isolation:**
```
Execution succeeds
  ↓
Ledger write succeeds
  ↓
Client receives success
  ↓
(Later) Billing calculation runs
  ↓
Billing fails ← ISOLATED (no impact on execution)
```

### 7.2 Billing Error Types

**Possible Billing Errors:**
- Database connection failure (cannot read usage_records)
- Pricing config missing or invalid
- Model price not found
- Calculation overflow (very large amounts)
- Billing record write failure

**Error Handling:**
- Log error (with executionId, apiKeyId, timestamp)
- Alert monitoring system
- Do NOT retry automatically (Phase 23B)
- Manual reconciliation may be needed

### 7.3 Billing Error Logging

**What to Log:**
- ✅ executionId (for tracing)
- ✅ apiKeyId (for customer identification)
- ✅ Error message (for debugging)
- ✅ Timestamp (for audit)
- ❌ NO prompt content (privacy)
- ❌ NO AI output (privacy)
- ❌ NO user PII beyond identifiers

**Log Format (Conceptual):**
```
[ERROR] Billing calculation failed:
  executionId=abc-123
  apiKeyId=key-test
  error=Pricing not found for model: unknown-model
  timestamp=2026-02-06T12:00:00Z
```

### 7.4 Billing Retry Semantics

**No Automatic Retries (Phase 23B):**
- Billing does NOT retry failed calculations
- Billing does NOT queue failed records
- Billing does NOT use background jobs (Phase 23B)
- Failed billing requires manual intervention

**Rationale:**
- Simplicity (Phase 23B MVP)
- Determinism (retries complicate audit)
- Correctness (manual review ensures accuracy)

**Future: Automatic Retries (Phase 23C+):**
- Background job system (future)
- Exponential backoff (future)
- Dead letter queue (future)
- NOT in Phase 23B

---

## 8. Privacy & Compliance

### 8.1 Privacy Guarantees (Re-Asserted)

**Privacy Policy (Phase 15B) Maintained:**
- ✅ No prompt content in billing
- ✅ No AI output in billing
- ✅ No conversation history in billing
- ✅ No request/response bodies in billing

**What Billing Uses:**
- ✅ executionId (identifier only)
- ✅ apiKeyId (identifier only)
- ✅ userId (identifier only)
- ✅ model (string, non-sensitive)
- ✅ tokensUsed (numeric, non-sensitive)
- ✅ executionDurationMs (numeric, non-sensitive)
- ✅ timestamp (non-sensitive)

### 8.2 PII in Billing

**Minimal PII:**
- apiKeyId: identifier (not credential)
- userId: identifier (not name, email, etc.)
- No additional PII collected
- No sensitive user data

**PII Usage:**
- Used for billing attribution only
- Not shared with external systems (Phase 23B)
- Not logged beyond billing records

### 8.3 Compliance

**Compliance Considerations:**
- GDPR: User can request billing data deletion (future)
- PCI-DSS: No payment card data in billing (future: Phase 24+)
- SOC 2: Audit trail maintained (Phase 23)
- CCPA: User can request billing data export (future)

**Phase 23B Compliance:**
- Audit trail: ✅ (immutable ledger)
- Data deletion: ⏳ (future: Phase 24+)
- Data export: ⏳ (future: Phase 24+)
- Payment security: N/A (no payment in Phase 23B)

### 8.4 Ledger as Source of Truth

**Single Source of Truth:**
- usage_records table (Phase 22) is authoritative
- Billing derives from ledger (read-only)
- Billing does NOT create alternate truth
- Disputes resolved from ledger

**Rationale:**
- Immutability guarantees correctness
- Single source eliminates conflicts
- Ledger is append-only (no tampering)

---

## 9. Future Extension Points (Explicitly Deferred)

### 9.1 Invoicing (Phase 24+)

**NOT in Phase 23A/23B:**
- Invoice generation (PDF, HTML)
- Invoice delivery (email, download)
- Invoice numbering (sequential IDs)
- Invoice itemization (line items)
- Invoice totals (subtotal, tax, total)

**Future Design:**
- Invoices consume BillableUsage records
- Invoices are immutable (like ledger)
- Invoices are versioned (corrections create new versions)

### 9.2 Payment Processing (Phase 24+)

**NOT in Phase 23A/23B:**
- Credit card processing (Stripe, PayPal)
- Payment confirmation
- Payment receipts
- Payment failures
- Payment refunds

**Future Design:**
- Payment system consumes Invoices
- Payment system updates payment status
- Payment system is external to billing

### 9.3 Credits & Refunds (Phase 24+)

**NOT in Phase 23A/23B:**
- Credit balances (prepaid)
- Credit application to invoices
- Refund processing
- Refund tracking
- Credit expiration

**Future Design:**
- Credits are separate records (not updates)
- Refunds create negative billing records
- Audit trail for all credits/refunds

### 9.4 Discounts & Promotions (Phase 24+)

**NOT in Phase 23A/23B:**
- Discount codes
- Promotional pricing
- Volume discounts
- Tiered pricing
- Early bird pricing

**Future Design:**
- Discounts applied at invoice generation
- Discounts tracked separately from base pricing
- Discount audit trail

### 9.5 Tiered Plans (Phase 24+)

**NOT in Phase 23A/23B:**
- Free tier (usage limits)
- Pro tier (higher limits, lower prices)
- Enterprise tier (custom pricing)
- Plan upgrades/downgrades
- Plan billing cycles

**Future Design:**
- Plans affect pricing config
- Plan changes create new billing records
- Plan history tracked

### 9.6 Prepaid Balances (Phase 24+)

**NOT in Phase 23A/23B:**
- Prepaid credits
- Credit purchase
- Credit depletion
- Credit balance queries
- Credit expiration

**Future Design:**
- Prepaid system separate from billing
- Credits applied to invoices
- Credit balance is external to billing

### 9.7 Real-Time Billing APIs (Phase 24+)

**NOT in Phase 23A/23B:**
- GET /api/billing/current-usage (API endpoint)
- GET /api/billing/history (API endpoint)
- Real-time cost tracking
- Budget alerts
- Cost projections

**Future Design:**
- Read APIs consume billable_usage table
- Aggregation logic separate from billing calculation
- Caching for performance

### 9.8 Billing Dashboard (Phase 25+)

**NOT in Phase 23A/23B:**
- Web UI for usage visualization
- Cost graphs and charts
- Usage trends
- Cost breakdown by model
- Budget management UI

**Future Design:**
- Dashboard consumes billing APIs (Phase 24+)
- Dashboard is frontend-only (no backend logic)
- Dashboard is read-only (no billing changes)

---

## 10. Safe Resume Point

### 10.1 Phase 23A Completion

**Phase 23A Unlocks:**
- Phase 23B: Billing Implementation
- Clear design for billing architecture
- Clear design for pricing model
- Clear design for billable usage records

**Phase 23A Does NOT Unlock:**
- Phase 24 (requires Phase 23B complete)
- Invoicing (requires billing implementation)
- Payment processing (requires invoicing)

### 10.2 No Other Phase Dependencies

**Phase 23 is Independent:**
- Phase 23 does NOT block other phases
- Execution continues normally (Phase 12-22 unchanged)
- Auth/authz continue normally (Phase 20 unchanged)
- Quota continues normally (Phase 21 unchanged)
- Ledger continues normally (Phase 22 unchanged)

**Parallel Work Allowed:**
- Other features can be developed while Phase 23 proceeds
- Phase 23 is additive (does not modify existing functionality)
- Phase 23 is isolated (billing logic is self-contained)

### 10.3 Design Readiness for Phase 23B

**Phase 23B Can Begin When:**
- ✅ Phase 23A design approved
- ✅ Pricing model agreed upon
- ✅ Billable usage schema designed
- ✅ Ownership boundaries clear

**Phase 23B Will Implement:**
- BillableUsage entity (database table)
- Billing calculation service
- Pricing configuration loader
- Billing error handling
- Billing tests (unit + integration)

**Phase 23B Will NOT Implement:**
- Invoicing (Phase 24+)
- Payment processing (Phase 24+)
- Billing APIs (Phase 24+)
- Real-time billing (Phase 24+)

---

## ULTRA-BRIEF SUMMARY

• **Billing is read-only consumer of immutable Usage Ledger** (Phase 22) performing deterministic transformation from UsageRecord to BillableUsage with no execution coupling, no blocking, and failure isolation guarantees

• **Pricing model uses provider+model-based token pricing** with static configuration (no runtime changes), zero-cost models allowed (e.g., stub), and deterministic calculation enabling full audit trail from executionId to billable amount

• **api-gateway owns billing logic exclusively** with ai-service completely unchanged (zero files modified), callers consume billing outputs externally, and execution success/failure independent of billing calculation

• **Privacy preserved with no prompt/response content in billing** using only non-sensitive metadata (executionId, apiKeyId, userId, model, tokensUsed, executionDurationMs, timestamp) maintaining Phase 15B compliance

• **Phase 23A design-only with explicit non-goals** including no invoice generation, no payment processing, no real-time billing APIs, no UI dashboards, and no pricing enforcement at execution time (all deferred to Phase 24+)

---

**END OF PHASE 23A DESIGN**
