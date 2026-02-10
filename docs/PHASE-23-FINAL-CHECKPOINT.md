# PHASE 23 FINAL CHECKPOINT: Billing Core (Design + Implementation)

**Status:** COMPLETE AND LOCKED
**Nature:** Billing System Foundation (Design Only)
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 23 (Billing)
**Prerequisite:** Phase 22 (Usage Ledger) COMPLETE

---

## 1. Phase Overview

### 1.1 What Phase 23 Establishes

Phase 23 establishes the complete architectural foundation for the AI Sandbox Platform's billing system. This phase delivers comprehensive design specifications across four sub-phases, defining how usage transforms into billable charges through a deterministic, auditable, and reproducible pipeline.

**Core Achievement:**
A billing system architecture that:
- Consumes immutable Usage Ledger records (Phase 22) in read-only mode
- Applies deterministic pricing logic with versioned configurations
- Produces immutable billing snapshots (invoice-like records)
- Maintains complete separation from payment execution
- Preserves all privacy guarantees from Phase 15B and Phase 22

**Key Architectural Principle:**
Billing is derived data—a pure, deterministic transformation from usage to cost that never affects execution flow, never modifies the ledger, and never blocks user operations.

### 1.2 Why Billing is Separated from Payments

**Critical Design Decision:**
Phase 23 intentionally implements billing calculation WITHOUT payment processing, invoice delivery, or customer-facing billing actions.

**Rationale:**
- **Separation of Concerns:** Cost calculation ≠ money movement
- **Testability:** Can verify billing correctness without payment infrastructure
- **Flexibility:** Billing system can support multiple payment backends
- **Auditability:** Billing records are immutable financial artifacts
- **Regulatory Compliance:** Billing and payment have different legal requirements

**Clear Boundary:**
```
Phase 23: Usage → Aggregation → Pricing → Snapshot (THIS)
Phase 24+: Snapshot → Invoice → Payment → Receipt (FUTURE)
```

---

## 2. Completed Sub-Phases

### 2.1 Phase 23A: Billing Design (Architecture)

**Document:** `docs/PHASE-23A-DESIGN.md`
**Status:** COMPLETE (Design Only)
**Date:** 2026-02-06

**What Phase 23A Defined:**

**Billing Scope:**
- Billing as read-only consumer of Usage Ledger
- Deterministic transformation: `UsageRecord → BillableUsage`
- Post-execution concern (never affects execution)
- Complete decoupling from execution flow
- Exclusive ownership by api-gateway

**Ownership Boundaries:**
- **api-gateway:** Owns all billing logic, pricing, calculation, storage
- **ai-service:** ZERO billing awareness, ZERO modifications
- **External Systems:** Invoice generation, payment processing (Phase 24+)

**Explicit Non-Goals:**
- ❌ No pricing enforcement at execution time
- ❌ No real-time billing decisions
- ❌ No quota enforcement (separate: Phase 21B)
- ❌ No retries or execution coupling
- ❌ No invoice generation (Phase 24+)
- ❌ No payment processing (Phase 24+)
- ❌ No refunds or disputes (Phase 24+)
- ❌ No usage aggregation APIs (Phase 24+)
- ❌ No UI or dashboards (Phase 25+)
- ❌ No changes to ai-service (ZERO files modified)

**Privacy Guarantees (Re-Asserted):**
- ✅ No prompt content in billing
- ✅ No AI output in billing
- ✅ No conversation history in billing
- ✅ Only non-sensitive metadata (executionId, apiKeyId, userId, model, tokensUsed, executionDurationMs, timestamp)

**Failure Semantics:**
- Billing failures do NOT affect execution
- Billing failures do NOT modify ledger
- Billing failures do NOT propagate to client
- Billing failures are logged for manual reconciliation

### 2.2 Phase 23B-1: Billing Read Model (Aggregation)

**Document:** `docs/PHASE-23B-1-DESIGN.md`
**Status:** COMPLETE (Design Only)
**Date:** 2026-02-06

**What Phase 23B-1 Defined:**

**BillingView (Read Model):**
```typescript
interface BillingView {
  period: BillingPeriod;           // daily | monthly
  apiKeyId: string;                // Who used the service
  provider: string;                // e.g., 'anthropic'
  model: string;                   // e.g., 'claude-3-5-sonnet-20241022'
  totalTokens: number;             // SUM(tokensUsed)
  totalRequests: number;           // COUNT(*)
  totalDurationMs: number;         // SUM(executionDurationMs)
  periodStart: Date;
  periodEnd: Date;
}
```

**Billing Periods:**
- **Daily:** 00:00:00 UTC to 23:59:59.999 UTC (24 hours)
- **Monthly:** First day 00:00:00 UTC to last day 23:59:59.999 UTC (28-31 days)
- UTC timezone only, fixed boundaries, no gaps/overlaps

**Aggregation Logic:**
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

**Read Semantics:**
- Read-only queries (no writes, updates, or deletes)
- Strong consistency (PostgreSQL ACID guarantees)
- No caching (always query live data)
- Throw on failure (no partial results)
- No automatic retries (caller decides retry policy)

**Explicit Non-Goals:**
- ❌ No pricing logic (Phase 23B-2)
- ❌ No invoices (Phase 24+)
- ❌ No currency (Phase 24+)
- ❌ No discounts (Phase 24+)
- ❌ No API endpoints (Phase 24+)
- ❌ No caching or materialized views (Phase 23C+)
- ❌ No background jobs (Phase 23C+)

### 2.3 Phase 23B-2: Pricing Calculation (Cost Logic)

**Document:** `docs/PHASE-23B-2-DESIGN.md`
**Status:** COMPLETE (Design Only)
**Date:** 2026-02-06

**What Phase 23B-2 Defined:**

**Pricing Model:**
- **Base Unit:** Cost per 1,000 tokens (industry standard)
- **Granularity:** Per (provider, model) tuple
- **Configuration:** Static YAML/JSON file (loaded at startup)
- **Versioning:** Immutable pricing versions (format: "YYYY-MM-vN")

**Pricing Structure:**
```yaml
pricing:
  version: "2026-02-v1"
  effective_from: "2026-02-01T00:00:00Z"
  effective_until: null
  rates:
    - provider: "anthropic"
      model: "claude-3-5-sonnet-20241022"
      price_per_thousand_tokens: 0.01  # $0.01 per 1K tokens
    - provider: "stub"
      model: "stub"
      price_per_thousand_tokens: 0.0   # Free (testing)
```

**Cost Calculation Formula:**
```
tokenCost = (totalTokens / 1000) × pricePerThousandTokens
timeCost = 0  (Phase 23B-3: deferred to Phase 23C+)
subtotal = tokenCost + timeCost
adjustments = 0  (Phase 23B-3: discounts/credits deferred to Phase 24+)
total = subtotal + adjustments
```

**Rounding Rules:**
- Round to 3 decimal places
- Banker's rounding (round half to even): 0.0125 → 0.012, 0.0135 → 0.014
- Deterministic (no ambiguity)
- Industry standard (reduces bias)

**Determinism Guarantees:**
```
CostCalculation = f(BillingView, PricingConfig)

Where f is:
  - Pure function (no side effects)
  - Deterministic (same inputs → same output)
  - Idempotent (multiple calls → same result)
  - Reproducible (can verify billing correctness)
```

**Failure Semantics:**
- Missing pricing → throw PricingNotFoundError (no fallback)
- Invalid pricing → throw InvalidPricingError (no correction)
- Zero cost is valid (e.g., stub model = $0.00)
- No automatic retries (simplicity for MVP)

**Explicit Non-Goals:**
- ❌ No invoices (Phase 24+)
- ❌ No billing cycles execution (Phase 24+)
- ❌ No payment processing (Phase 24+)
- ❌ No customer notifications (Phase 24+)
- ❌ No refunds or credits (Phase 24+)
- ❌ No discounts or promotions (Phase 24+)
- ❌ No user-specific pricing (Phase 24+)
- ❌ No API endpoints (Phase 24+)
- ❌ No real-time costing (billing is async)
- ❌ No tax calculation (Phase 24+)

### 2.4 Phase 23B-3: Billing Snapshot (Immutable Records)

**Document:** `docs/PHASE-23B-3-DESIGN.md`
**Status:** COMPLETE (Design Only)
**Date:** 2026-02-06

**What Phase 23B-3 Defined:**

**BillingSnapshot (Invoice-Like Object):**
```typescript
interface BillingSnapshot {
  snapshotId: string;              // UUID, unique identifier
  apiKeyId: string;                // Who this bill is for
  userId: string;                  // User associated with API key
  periodStart: Date;               // Period start (UTC, inclusive)
  periodEnd: Date;                 // Period end (UTC, inclusive)
  periodType: 'daily' | 'monthly'; // Period type
  pricingVersion: string;          // Pricing version used (e.g., "2026-02-v1")
  lineItems: BillingLineItem[];    // Breakdown by provider/model
  summary: BillingSummary;         // Aggregated totals
  createdAt: Date;                 // When snapshot was created
  status: 'draft' | 'finalized';   // Lifecycle status
}

interface BillingLineItem {
  provider: string;
  model: string;
  totalTokens: number;
  totalRequests: number;
  pricePerThousandTokens: number;
  costUSD: number;
}

interface BillingSummary {
  totalTokens: number;             // Sum across all line items
  totalRequests: number;           // Sum across all line items
  subtotal: number;                // Sum of line item costs (USD)
  adjustments: number;             // Discounts, credits (Phase 23B-4: always 0)
  total: number;                   // Final total (subtotal + adjustments)
}
```

**Snapshot Immutability:**
- Once created, fields NEVER change
- No UPDATE operations allowed
- No DELETE operations allowed (Phase 23B-4, future: soft delete)
- Append-only semantics
- Exception: Status transition draft → finalized (one-way, irreversible)

**Snapshot Determinism:**
```
BillingSnapshot = f(apiKeyId, period, pricingVersion)

Reproduction Formula:
1. Query UsageRecords (Phase 22) for apiKeyId + period
2. Aggregate usage (Phase 23B-1) into BillingView
3. Apply pricing (Phase 23B-2) to calculate costs
4. Construct BillingSnapshot with results
5. Verify: recreated snapshot matches original
```

**Snapshot Semantics (NOT a Live View):**
```
Time T0: Usage occurs (Phase 22 writes to ledger)
Time T1: BillingSnapshot created (reads ledger at T1)
Time T2: More usage occurs (ledger updated)
Time T3: Query BillingSnapshot → still shows T1 data (not T3)
         To include T2 usage, must create NEW snapshot
```

**Operations:**
- CREATE BillingSnapshot (from usage + pricing)
- READ BillingSnapshot (query existing snapshot)
- FINALIZE BillingSnapshot (transition draft → finalized)
- ❌ No UPDATE (immutable)
- ❌ No DELETE (Phase 23B-4)
- ❌ No RECALCULATE in-place (must create new)

**Failure Semantics:**
- Missing usage data → create snapshot with zero usage (total = $0.00, not an error)
- Missing pricing → throw PricingNotFoundError (no partial snapshot)
- Invalid period → throw InvalidPeriodError (no snapshot creation)
- Database failure → throw DatabaseError (no partial storage)
- Snapshots are atomic (all or nothing)

**Explicit Non-Goals:**
- ❌ No payment collection (Phase 24+)
- ❌ No invoice emailing (Phase 24+)
- ❌ No PDF generation (Phase 24+)
- ❌ No accounting export (Phase 24+)
- ❌ No refunds or adjustments (Phase 24+)
- ❌ No invoice numbering (uses snapshotId UUID)
- ❌ No payment status tracking (status is draft/finalized only)
- ❌ No tax calculation (Phase 24+)
- ❌ No multi-currency (USD only)
- ❌ No public APIs (internal service only)

---

## 3. Billing Architecture Summary

### 3.1 Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ EXECUTION PHASE (Phase 12-21)                               │
│ ------------------------------------------------------------ │
│ Client Request → Auth → Authz → Quota → ai-service Execute  │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ USAGE LEDGER (Phase 22) — Write-Only, Immutable             │
│ ------------------------------------------------------------ │
│ UsageRecord:                                                 │
│   - executionId, apiKeyId, userId, sessionId                │
│   - provider, adapter, model                                │
│   - tokensUsed (actual), executionDurationMs                │
│   - timestamp (UTC)                                          │
│   - NO prompt content, NO AI output (privacy)               │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ (read-only)
┌──────────────────────────────────────────────────────────────┐
│ BILLING READ MODEL (Phase 23B-1) — Aggregation              │
│ ------------------------------------------------------------ │
│ BillingView = Aggregate UsageRecords by:                     │
│   - Period (daily/monthly)                                   │
│   - Grouping (apiKeyId, provider, model)                    │
│   - Outputs (totalTokens, totalRequests, totalDurationMs)   │
│ Query-on-demand, no caching, strong consistency              │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ (apply pricing)
┌──────────────────────────────────────────────────────────────┐
│ PRICING CALCULATION (Phase 23B-2) — Deterministic Logic     │
│ ------------------------------------------------------------ │
│ CostCalculation = f(BillingView, PricingConfig)             │
│   - Formula: (totalTokens / 1000) × pricePerThousandTokens │
│   - Rounding: Banker's rounding to 3 decimals              │
│   - Versioned: pricingVersion (e.g., "2026-02-v1")         │
│ Pure function, reproducible, idempotent                      │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ (create snapshot)
┌──────────────────────────────────────────────────────────────┐
│ BILLING SNAPSHOT (Phase 23B-3) — Immutable Records          │
│ ------------------------------------------------------------ │
│ BillingSnapshot:                                             │
│   - snapshotId, apiKeyId, userId, periodStart/End           │
│   - pricingVersion, lineItems (per provider/model)          │
│   - summary (totalTokens, totalRequests, subtotal, total)   │
│   - status (draft | finalized)                              │
│   - createdAt (immutable point-in-time capture)             │
│ Point-in-time capture, append-only, deterministically        │
│ reproducible from usage ledger + pricing config              │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ (future: external billing)
┌──────────────────────────────────────────────────────────────┐
│ EXTERNAL BILLING (Phase 24+) — NOT IMPLEMENTED              │
│ ------------------------------------------------------------ │
│ - Public API endpoints (GET /api/billing/snapshots)         │
│ - PDF invoice generation                                     │
│ - Email invoice delivery                                     │
│ - Payment processing (Stripe integration)                   │
│ - Payment status tracking (paid/unpaid/overdue)             │
│ - Invoice numbering system                                  │
│ - Refunds, adjustments, credits                             │
│ - Tax calculation (sales tax, VAT)                          │
│ - Multi-currency support                                    │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Deterministic Replay Guarantee

**Core Property:**
Any billing snapshot can be deterministically reproduced from:
1. Usage Ledger records (immutable, Phase 22)
2. Pricing configuration at time of creation (versioned)
3. Aggregation logic (Phase 23B-1, deterministic)
4. Cost calculation logic (Phase 23B-2, pure function)

**Reproduction Process:**
```
Given: snapshotId
1. Read BillingSnapshot.periodStart, periodEnd, pricingVersion
2. Query UsageRecords WHERE timestamp IN [periodStart, periodEnd]
3. Aggregate by (provider, model) → totalTokens
4. Load PricingConfig for pricingVersion
5. Calculate cost per line item: (totalTokens / 1000) × price
6. Construct BillingSnapshot with same inputs
7. Verify: reproduced snapshot matches original
```

**Uses:**
- Audit verification (reproduce to verify correctness)
- Dispute resolution (regenerate to confirm charges)
- Compliance reporting (demonstrate calculation accuracy)
- Historical analysis (recreate billing for any period)

---

## 4. Locked Invariants

### 4.1 Usage Ledger is Write-on-Success Only (Phase 22)

**Guarantee:**
- Every UsageRecord represents successful execution
- NO records written on auth failures
- NO records written on quota exceeded
- NO records written on execution failures
- Ledger is append-only, immutable source of truth

**Implication for Billing:**
- Billing can trust every UsageRecord is billable
- No need to filter out failed executions
- No need to validate execution success

### 4.2 Billing is Derived Data ONLY

**Guarantee:**
- Billing NEVER writes to usage_records table
- Billing NEVER modifies ledger records
- Billing NEVER deletes ledger records
- Billing is read-only consumer of immutable ledger

**Implication:**
- Ledger remains authoritative source of truth
- Billing cannot corrupt usage data
- Billing disputes resolved from ledger

### 4.3 Pricing Logic is Pure and Versioned

**Guarantee:**
- Same inputs → same outputs (always)
- No randomness in calculation
- No timing dependence
- No external API calls
- Pricing version tracked for every calculation

**Implication:**
- Billing is reproducible
- Billing is auditable
- Billing disputes can be verified mathematically

### 4.4 Billing Snapshots are Immutable and Reproducible

**Guarantee:**
- Once created, snapshots NEVER change (except status: draft → finalized)
- Snapshots are point-in-time captures
- Snapshots can be deterministically reproduced from ledger

**Implication:**
- Billing records are legal financial artifacts
- Customers can trust billing stability
- Audits can verify billing accuracy

### 4.5 ai-service Remains Completely Unchanged

**Guarantee:**
- ZERO files modified in ai-service
- ai-service has NO billing awareness
- ai-service continues returning AIExecutionResult (Phase 12B, unchanged)

**Implication:**
- Service boundary preserved
- Execution logic unaffected by billing
- Billing is truly decoupled

### 4.6 api-gateway Owns ALL Billing Logic

**Guarantee:**
- api-gateway owns pricing configuration
- api-gateway owns aggregation logic
- api-gateway owns cost calculation
- api-gateway owns snapshot creation
- NO billing logic in ai-service, container-manager, or frontend

**Implication:**
- Single source of truth for billing
- No distributed billing logic
- Billing changes isolated to api-gateway

### 4.7 No Retries, No Side Effects, No Async Billing

**Guarantee:**
- Billing calculation failures throw (no silent failures)
- No automatic retries on failure (Phase 23B MVP)
- No background jobs (Phase 23B MVP)
- No async billing computation (on-demand only)

**Implication:**
- Simplicity (no retry logic, no job scheduler)
- Determinism (no timing-dependent behavior)
- Caller control (external systems decide retry policy)

### 4.8 Throw-Only Error Semantics Preserved

**Guarantee:**
- Missing pricing → throw (no fallback to zero)
- Invalid input → throw (no correction)
- Database failure → throw (no partial results)
- No silent failures, no partial snapshots

**Implication:**
- Billing correctness guaranteed
- No misrepresented charges
- Audit trail integrity maintained

### 4.9 Privacy Guarantees Preserved

**Guarantee:**
- NO prompt content in billing
- NO AI output in billing
- NO conversation history in billing
- Only non-sensitive metadata (identifiers, counts, timestamps)

**Implication:**
- Phase 15B privacy policy maintained
- GDPR/CCPA compliance preserved
- Customer data protection guaranteed

---

## 5. Explicit Non-Goals (Intentionally Deferred)

### 5.1 NOT in Phase 23 (Design Complete, No Implementation)

Phase 23 is a **DESIGN-ONLY phase**. All four sub-phases (23A, 23B-1, 23B-2, 23B-3) produced comprehensive design documents but **ZERO implementation**.

**What Phase 23 Did:**
- ✅ Defined billing architecture (23A)
- ✅ Defined aggregation logic (23B-1)
- ✅ Defined pricing model (23B-2)
- ✅ Defined snapshot structure (23B-3)

**What Phase 23 Did NOT Do:**
- ❌ NO database tables created (no billing_snapshots table)
- ❌ NO TypeScript services implemented (no BillingService, PricingService, SnapshotService)
- ❌ NO database migrations written
- ❌ NO controllers or API endpoints
- ❌ NO unit or integration tests
- ❌ NO configuration files (no pricing.yaml)
- ❌ NO deployment scripts

**Future Implementation:**
- Phase 23B-4 (future): Implement BillingViewService, CostCalculationService, BillingSnapshotService
- Phase 23C+ (future): Add caching, background jobs, database-backed pricing
- Phase 24+ (future): Add public APIs, invoice generation, payment processing

### 5.2 NOT in Phase 23 (Money Movement and Delivery)

**❌ No Payments:**
- No credit card charging
- No payment collection
- No payment confirmation
- No payment status tracking
- No Stripe/PayPal integration
- **Rationale:** Payment is Phase 24+

**❌ No Invoicing:**
- No invoice generation (PDF, HTML)
- No invoice delivery (email, download)
- No invoice numbering (sequential IDs)
- No invoice templates
- No accounting system exports (QuickBooks, Xero)
- **Rationale:** Invoicing is Phase 24+

**❌ No Customer Notifications:**
- No email notifications
- No billing alerts
- No cost warnings
- No payment reminders
- **Rationale:** Notifications are Phase 24+

**❌ No Refunds or Credits:**
- No refund processing
- No credit application
- No billing adjustments
- No dispute handling
- **Rationale:** Refunds are Phase 24+

**❌ No Discounts or Promotions:**
- No discount codes
- No promotional pricing
- No volume discounts
- No tiered pricing
- No early bird pricing
- **Rationale:** Discounts are Phase 24+

**❌ No Tax Calculation:**
- No sales tax
- No VAT
- No tax jurisdictions
- No tax rates
- **Rationale:** Tax is Phase 24+

**❌ No Multi-Currency:**
- No currency conversion
- No non-USD currencies
- USD only (Phase 23B MVP)
- **Rationale:** Multi-currency is Phase 24+

### 5.3 NOT in Phase 23 (Real-Time and External APIs)

**❌ No Real-Time Billing:**
- No cost returned in execution response
- No real-time cost tracking
- No live cost meters
- No budget alerts
- **Rationale:** Billing is async, post-execution

**❌ No Public APIs:**
- No REST endpoints (GET /api/billing/*)
- No GraphQL endpoints
- No external API access
- Internal service only (Phase 23B MVP)
- **Rationale:** APIs are Phase 24+

**❌ No Billing Dashboard:**
- No web UI
- No cost graphs and charts
- No usage trends
- No cost breakdown visualizations
- **Rationale:** Dashboard is Phase 25+

### 5.4 NOT in Phase 23 (Advanced Billing Features)

**❌ No User-Specific Pricing:**
- No custom pricing per user
- No negotiated rates
- No tier-based pricing (free/pro/enterprise pricing)
- **Rationale:** Custom pricing is Phase 24+

**❌ No Prepaid Balances:**
- No prepaid credits
- No credit purchase
- No credit depletion
- No credit balance queries
- **Rationale:** Prepaid system is Phase 24+

**❌ No Billing Cycles Automation:**
- No scheduled monthly billing runs
- No automated snapshot creation
- No billing job scheduler
- On-demand only (Phase 23B MVP)
- **Rationale:** Background jobs are Phase 23C+

**❌ No Caching or Optimization:**
- No materialized views
- No Redis caching
- No query result caching
- Always query live data (Phase 23B MVP)
- **Rationale:** Optimization is Phase 23C+

---

## 6. Test Coverage Summary

### 6.1 No Tests Written (Design-Only Phase)

Phase 23 is **DESIGN-ONLY** with **NO implementation** and therefore **NO tests**.

**What Phase 23 Documented for Future Testing:**

**Aggregation Tests (Phase 23B-1, Future):**
- Test daily period aggregation (00:00:00 to 23:59:59.999 UTC)
- Test monthly period aggregation (first to last day of month)
- Test grouping by (apiKeyId, provider, model)
- Test SUM(tokensUsed), COUNT(*), SUM(executionDurationMs)
- Test empty usage (zero records) → totalTokens=0, totalRequests=0
- Test database query correctness

**Pricing Tests (Phase 23B-2, Future):**
- Test token-based cost formula: (totalTokens / 1000) × pricePerThousandTokens
- Test banker's rounding to 3 decimal places (0.0125 → 0.012, 0.0135 → 0.014)
- Test zero cost models (stub model = $0.00)
- Test missing pricing → throw PricingNotFoundError
- Test invalid pricing (negative price) → throw InvalidPricingError
- Test pricing versioning (pricingVersion tracked)

**Snapshot Tests (Phase 23B-3, Future):**
- Test snapshot creation (aggregate + price + store)
- Test snapshot immutability (cannot update fields)
- Test status transition (draft → finalized, one-way)
- Test deterministic reproduction (same inputs → same snapshot)
- Test point-in-time semantics (snapshot doesn't update with new usage)
- Test missing pricing → no partial snapshot
- Test zero usage → snapshot with total = $0.00

**Determinism Tests (All Phases, Future):**
- Test same UsageRecord → same BillingView (always)
- Test same BillingView + same PricingConfig → same CostCalculation (always)
- Test same inputs → same BillingSnapshot (reproducibility)
- Test snapshot reproduction matches original (verification)

### 6.2 Future Test Requirements

**Phase 23B-4 Implementation Will Include:**
- Unit tests for BillingViewService (aggregation logic)
- Unit tests for CostCalculationService (pricing logic)
- Unit tests for BillingSnapshotService (snapshot creation)
- Integration tests for end-to-end billing pipeline
- Database migration tests
- Determinism verification tests (reproduce snapshots)
- Privacy compliance tests (no sensitive data in billing)

---

## 7. Safety & Rollback

### 7.1 Why Phase 23 is Safe to Deploy

**Critical Safety Property:**
Phase 23 is a **DESIGN-ONLY phase** with **ZERO code changes**, therefore it is **100% safe** to consider complete.

**No Deployment Risks:**
- ❌ No database tables created
- ❌ No services deployed
- ❌ No API endpoints exposed
- ❌ No configuration changes
- ❌ No runtime behavior changes
- ❌ No execution flow modifications

**No Dependencies Affected:**
- ✅ Phase 22 (Usage Ledger) continues writing normally
- ✅ Phase 12-21 (Execution) continues unchanged
- ✅ Phase 20 (Auth/Authz) continues unchanged
- ✅ Phase 21 (Quota) continues unchanged
- ✅ ai-service continues unchanged (ZERO files modified)

**Design Validation:**
- ✅ Billing architecture validated (read-only consumer pattern)
- ✅ Aggregation logic validated (SQL query patterns)
- ✅ Pricing model validated (per-1K-token basis, banker's rounding)
- ✅ Snapshot structure validated (immutable, deterministic)
- ✅ Service boundaries validated (api-gateway ownership)
- ✅ Privacy guarantees validated (no sensitive data)

### 7.2 Rollback Phase 23 (No Action Required)

**Rollback Procedure:**
1. No action required (no code deployed)
2. No database migrations to revert
3. No services to stop
4. No configuration to restore

**Data Loss Risk:**
- ✅ NONE (no billing data stored yet)
- ✅ Usage Ledger (Phase 22) unaffected
- ✅ Execution data (Phase 12-22) unaffected

**Rollback Guarantee:**
- Phase 23 design documents can be archived if needed
- System continues operating normally (billing is additive)
- Future phases can proceed independently

### 7.3 Safe Pause Point

**System State After Phase 23:**
- Usage Ledger (Phase 22) continues recording usage
- Execution flow (Phase 12-21) continues unchanged
- NO billing calculation occurs
- NO billing snapshots created
- NO money charged

**If Phase 23 Implementation Paused:**
- Platform continues operating normally
- Usage continues being recorded in ledger
- Billing can be calculated retroactively when Phase 23B-4 is implemented
- No usage data is lost

**Safe to Proceed When:**
- Phase 24 (Billing Visibility) can begin after Phase 23B-4 (implementation) completes
- Phase 25 (Payments Design) can begin in parallel with Phase 23B-4
- Other features can be developed independently (Phase 23 is additive)

---

## 8. Safe Resume Point

### 8.1 Phase 23 Completion Status

**What is COMPLETE:**
- ✅ Phase 23A: Billing architecture design
- ✅ Phase 23B-1: Aggregation logic design
- ✅ Phase 23B-2: Pricing model design
- ✅ Phase 23B-3: Snapshot structure design
- ✅ All design documents written, reviewed, and locked
- ✅ Billing architecture validated
- ✅ Service boundaries defined
- ✅ Invariants documented
- ✅ Non-goals explicitly stated

**What is NOT COMPLETE:**
- ❌ Phase 23B-4: Implementation (future)
- ❌ Database tables (billing_snapshots)
- ❌ TypeScript services (BillingViewService, CostCalculationService, BillingSnapshotService)
- ❌ Database migrations
- ❌ Tests (unit, integration)
- ❌ Configuration files (pricing.yaml)

### 8.2 Next Phase Options

**Option 1: Phase 23B-4 (Billing Implementation)**
- Implement BillingViewService (aggregation)
- Implement CostCalculationService (pricing)
- Implement BillingSnapshotService (snapshot creation)
- Create billing_snapshots database table
- Write database migrations
- Write tests (unit + integration)
- Load pricing from config file
- **Prerequisite:** Phase 23A, 23B-1, 23B-2, 23B-3 (COMPLETE ✅)
- **Unlocks:** Phase 24 (Billing Visibility)

**Option 2: Phase 24 (Billing Visibility Design)**
- Design public API endpoints (GET /api/billing/snapshots)
- Design invoice PDF generation
- Design email delivery system
- Design payment status tracking
- **Prerequisite:** Phase 23 design complete (COMPLETE ✅), implementation NOT required for design phase
- **Unlocks:** Phase 24 Implementation (requires Phase 23B-4 complete first)

**Option 3: Phase 25 (Payments Design)**
- Design payment processing integration (Stripe)
- Design payment status lifecycle (pending/paid/failed)
- Design refund processing
- Design credit system
- **Prerequisite:** Phase 23 design complete (COMPLETE ✅)
- **Unlocks:** Phase 25 Implementation (requires Phase 23B-4 + Phase 24 complete first)

**Option 4: Parallel Work (Independent Features)**
- Phase 26+: Frontend billing dashboard design
- Phase 27+: Usage analytics and reporting design
- Phase 28+: Quota reconciliation design
- **Prerequisite:** None (independent of billing)
- **Benefit:** Maximize development parallelism

**Recommended Next Step:**
- **Phase 23B-4 (Billing Implementation)** to establish working billing foundation
- Rationale: Implementation validates design, enables end-to-end testing, unblocks Phase 24

### 8.3 No Blocking Dependencies

**Phase 23 Does NOT Block:**
- ✅ Execution flow (Phase 12-22 unchanged)
- ✅ Auth/authz (Phase 20 unchanged)
- ✅ Quota enforcement (Phase 21 unchanged)
- ✅ Git checkpoints (Phase 8 unchanged)
- ✅ Preview system (Phase 6 unchanged)
- ✅ Frontend development (independent)
- ✅ Container management (independent)

**Parallel Work Allowed:**
- Other features can be developed while Phase 23B-4 proceeds
- Phase 23 is additive (does not modify existing functionality)
- Phase 23 is isolated (billing logic is self-contained in api-gateway)

---

## ULTRA-BRIEF SUMMARY

• **Phase 23 establishes complete billing architecture through four design-only sub-phases** (23A: architecture, 23B-1: aggregation, 23B-2: pricing, 23B-3: snapshots) defining deterministic transformation from immutable Usage Ledger (Phase 22) to billable charges via read-only aggregation, versioned pricing, and immutable snapshots with ZERO implementation and ZERO code changes

• **Billing is derived data with guaranteed determinism and reproducibility** using read-only consumption of usage_records table, pure function pricing logic (per-1K-token basis with banker's rounding), and point-in-time immutable snapshots enabling complete audit trail from executionId → UsageRecord → BillingView → CostCalculation → BillingSnapshot with mathematical verification

• **Explicit separation from payment processing and customer-facing billing** with NO invoice generation, NO payment collection, NO email delivery, NO public APIs, NO billing dashboard, NO refunds, NO tax calculation, and NO real-time costing (all deferred to Phase 24+) while preserving privacy guarantees (no prompt/response content) and execution independence (billing failures never affect execution)

• **Safe resume point with zero deployment risk and clear next steps** as design-only phase requires no rollback, blocks no other work, and unlocks Phase 23B-4 (implementation) or Phase 24 (billing visibility design) or Phase 25 (payments design) with parallel development allowed for independent features

---

**END OF PHASE 23 FINAL CHECKPOINT**
