# PHASE 23B-3 DESIGN: Billing Snapshot (Design Only)

**Status:** DESIGN-ONLY (No Implementation)
**Nature:** Billing Snapshot Exposure Layer
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 23B (Billing Implementation)
**Prerequisite:** Phase 23B-1 (Billing Read Model) COMPLETE, Phase 23B-2 (Pricing Model) COMPLETE

---

## 1. Overview

### 1.1 Purpose

Phase 23B-3 defines a read-only billing exposure layer that produces immutable billing snapshots. A billing snapshot is an invoice-like object that captures aggregated usage, applied pricing, and calculated costs for a specific billing period. This design establishes what an invoice is conceptually, without defining how it is charged, paid, or delivered.

### 1.2 Scope

**Design Scope:**
- Billing snapshot structure (immutable record)
- Snapshot creation semantics (deterministic, reproducible)
- Line item breakdown (per provider/model)
- Aggregation totals (total cost)
- Snapshot status lifecycle (draft/finalized)
- Failure behavior (throw on missing dependencies)

**Implementation Scope:**
- NONE in this phase (Phase 23B-3 is design only)
- Phase 23B-4 will implement the design

### 1.3 Core Principles

**Snapshot Principles:**
- ✅ Immutable (never updated after creation)
- ✅ Deterministic (reproducible from inputs)
- ✅ Read-only (no mutation operations)
- ✅ Self-contained (includes all billing data)
- ✅ Versioned (references pricingVersion)
- ✅ Auditable (traceable to usage ledger)

---

## 2. Billing Snapshot

### 2.1 Snapshot Structure Definition

**BillingSnapshot (Core Data Structure):**
```typescript
interface BillingSnapshot {
  // Unique Identifier
  snapshotId: string;              // UUID, unique per snapshot

  // Billing Subject
  apiKeyId: string;                // Who this snapshot is for
  userId: string;                  // User associated with API key

  // Billing Period
  periodStart: Date;               // Period start (UTC, inclusive)
  periodEnd: Date;                 // Period end (UTC, inclusive)
  periodType: 'daily' | 'monthly'; // Period type

  // Pricing Context
  pricingVersion: string;          // Pricing version used (e.g., "2026-02-v1")

  // Usage & Cost Details
  lineItems: BillingLineItem[];    // Breakdown by provider/model
  summary: BillingSummary;         // Aggregated totals

  // Snapshot Metadata
  createdAt: Date;                 // When snapshot was created
  status: BillingSnapshotStatus;   // draft | finalized
}
```

**BillingLineItem (Detailed Breakdown):**
```typescript
interface BillingLineItem {
  // Grouping Keys
  provider: string;                // e.g., 'anthropic', 'openai'
  model: string;                   // e.g., 'claude-3-5-sonnet-20241022'

  // Usage Quantities
  totalTokens: number;             // Total tokens used (from Phase 23B-1)
  totalRequests: number;           // Total request count (from Phase 23B-1)

  // Pricing Applied
  pricePerThousandTokens: number;  // Price per 1K tokens (from Phase 23B-2)

  // Calculated Cost
  costUSD: number;                 // Cost for this line item (USD)
}
```

**BillingSummary (Aggregated Totals):**
```typescript
interface BillingSummary {
  // Aggregate Quantities
  totalTokens: number;             // Sum across all line items
  totalRequests: number;           // Sum across all line items

  // Aggregate Costs
  subtotal: number;                // Sum of line item costs (USD)
  adjustments: number;             // Discounts, credits (Phase 23B-4: always 0)
  total: number;                   // Final total (subtotal + adjustments)
}
```

**BillingSnapshotStatus (Lifecycle):**
```typescript
type BillingSnapshotStatus = 'draft' | 'finalized';

// draft: Snapshot created but not finalized (can be regenerated)
// finalized: Snapshot locked (immutable, ready for external billing)
```

### 2.2 Snapshot Immutability

**Immutability Guarantee:**
- Once created, BillingSnapshot fields NEVER change
- No UPDATE operations allowed
- No DELETE operations allowed (Phase 23B-4, future: soft delete)
- Append-only semantics

**Exception: Status Transition**
- Status can transition: draft → finalized (one-way)
- Finalization is immutable (cannot go back to draft)
- All other fields remain frozen

**Rationale:**
- Audit trail integrity (billing records are legal documents)
- Reproducibility (same inputs always produce same snapshot)
- Trust (customers rely on snapshot accuracy)

### 2.3 Snapshot Determinism

**Deterministic Guarantee:**
```
BillingSnapshot = f(apiKeyId, period, pricingVersion)

Where f is:
  - Deterministic (same inputs → same output)
  - Reproducible (can recreate identical snapshot)
  - Idempotent (calling f twice → same result)
```

**Reproduction Formula:**
```
1. Query UsageRecords (Phase 22) for apiKeyId + period
2. Aggregate usage (Phase 23B-1) into BillingView
3. Apply pricing (Phase 23B-2) to calculate costs
4. Construct BillingSnapshot with results
5. Verify: recreated snapshot matches original
```

**Determinism Uses:**
- Audit verification (reproduce snapshot to verify correctness)
- Dispute resolution (regenerate to confirm charges)
- Correction detection (compare regenerated vs original)

### 2.4 Snapshot as NOT a Live View

**Critical Distinction:**
- BillingSnapshot is a SNAPSHOT (point-in-time capture)
- BillingSnapshot is NOT a live view (does not update)
- BillingSnapshot is NOT recalculated after creation

**Snapshot Semantics:**
```
Time T0: Usage occurs (Phase 22 writes to ledger)
Time T1: BillingSnapshot created (reads ledger at T1)
Time T2: More usage occurs (ledger updated)
Time T3: Query BillingSnapshot → still shows T1 data (not T3)
```

**Implication:**
- To include T2 usage, must create NEW snapshot
- Cannot update existing snapshot with T2 data
- Snapshots are frozen in time

---

## 3. Exposure Semantics

### 3.1 Read-Only Operations

**Allowed Operations:**
- CREATE BillingSnapshot (from usage + pricing)
- READ BillingSnapshot (query existing snapshot)
- FINALIZE BillingSnapshot (transition draft → finalized)

**Forbidden Operations:**
- UPDATE BillingSnapshot fields (immutable)
- DELETE BillingSnapshot (Phase 23B-4, future: soft delete)
- RECALCULATE BillingSnapshot in-place (must create new)

### 3.2 Snapshot Creation Process

**Creation Flow:**
```
1. Input: apiKeyId, periodStart, periodEnd
2. Query Usage Ledger (Phase 22)
   → UsageRecords for period
3. Aggregate Usage (Phase 23B-1)
   → BillingView (totalTokens, totalRequests per provider/model)
4. Load Pricing (Phase 23B-2)
   → PricingConfig for pricingVersion
5. Calculate Costs (Phase 23B-2)
   → CostCalculation per line item
6. Construct BillingSnapshot
   → snapshotId, lineItems, summary
7. Store BillingSnapshot
   → Write to billing_snapshots table (immutable)
8. Return BillingSnapshot
```

**Creation Characteristics:**
- Synchronous (no background jobs in Phase 23B-4)
- Deterministic (same inputs → same output)
- Atomic (all or nothing)
- Idempotent (creating twice → same result, different snapshotId)

### 3.3 Snapshot Query Operations

**Query Patterns:**

**Query by snapshotId:**
```
GET BillingSnapshot WHERE snapshotId = :snapshot_id
```

**Query by apiKeyId + period:**
```
GET BillingSnapshot
WHERE apiKeyId = :api_key_id
  AND periodStart = :period_start
  AND periodEnd = :period_end
```

**Query all snapshots for apiKeyId:**
```
GET BillingSnapshot
WHERE apiKeyId = :api_key_id
ORDER BY periodStart DESC
```

### 3.4 Snapshot Finalization

**Finalization Semantics:**
- Transition: draft → finalized (one-way, irreversible)
- Purpose: Mark snapshot as ready for external billing
- Effect: No data changes, only status change

**Finalization Rules:**
- Only draft snapshots can be finalized
- Finalized snapshots cannot be edited
- Finalized snapshots cannot be deleted (Phase 23B-4)
- Finalization is idempotent (finalizing twice is safe)

**Finalization Flow:**
```
1. Verify snapshot exists
2. Verify snapshot.status == 'draft'
3. Update snapshot.status = 'finalized'
4. Return updated snapshot
```

---

## 4. Failure Semantics

### 4.1 Snapshot Creation Failures

**Missing Usage Data:**
- Scenario: No UsageRecords found for period
- Behavior: Create snapshot with zero usage (not an error)
- Result: BillingSnapshot with empty lineItems, total = $0.00

**Missing Pricing:**
- Scenario: Pricing not found for (provider, model)
- Behavior: Throw PricingNotFoundError
- No fallback, no partial snapshot

**Invalid Period:**
- Scenario: periodStart > periodEnd
- Behavior: Throw InvalidPeriodError
- No snapshot creation

**Database Failure:**
- Scenario: Cannot write snapshot to database
- Behavior: Throw DatabaseError
- No partial snapshot stored

### 4.2 Snapshot Query Failures

**Snapshot Not Found:**
- Scenario: snapshotId does not exist
- Behavior: Throw SnapshotNotFoundError
- No fallback, no default snapshot

**Database Failure:**
- Scenario: Cannot query database
- Behavior: Throw DatabaseError
- No cached fallback

### 4.3 Partial Snapshot Prohibition

**Critical Guarantee:**
- Snapshots are atomic (all or nothing)
- No partial line items (either all models or none)
- No partial costs (either all calculated or none)
- No partial storage (either fully stored or not stored)

**Rationale:**
- Partial snapshots would misrepresent billing
- Partial snapshots would cause incorrect charges
- All-or-nothing semantics ensure correctness

### 4.4 No Retry Logic

**Phase 23B-4: No Automatic Retries**
- Snapshot creation failures do NOT retry
- Caller must retry if desired
- No exponential backoff
- No retry queue

**Rationale:**
- Simplicity (Phase 23B-4 MVP)
- Determinism (retries complicate behavior)
- Caller control (external systems decide retry policy)

---

## 5. Data Boundaries

### 5.1 What is Exposed

**Exposed in BillingSnapshot:**
- ✅ snapshotId (identifier)
- ✅ apiKeyId (identifier)
- ✅ userId (identifier)
- ✅ periodStart, periodEnd (dates)
- ✅ periodType (daily/monthly)
- ✅ pricingVersion (version string)
- ✅ lineItems (provider, model, usage, cost)
- ✅ summary (totals)
- ✅ createdAt (timestamp)
- ✅ status (draft/finalized)

### 5.2 What is NOT Exposed

**NOT Exposed (Privacy):**
- ❌ executionId (internal, not in snapshot)
- ❌ sessionId (internal, not in snapshot)
- ❌ conversationId (internal, not in snapshot)
- ❌ Individual UsageRecords (aggregated only)
- ❌ Prompt content (never stored, Phase 15B)
- ❌ AI output (never stored, Phase 15B)

**NOT Exposed (Implementation Details):**
- ❌ Adapter name (internal implementation)
- ❌ Execution duration (captured but not exposed in snapshot)
- ❌ Internal metadata (reserved for system use)

### 5.3 Aggregation Level

**Snapshot Aggregation:**
- Line items grouped by (provider, model)
- No per-execution breakdown in snapshot
- No per-day breakdown in snapshot (monthly shows monthly total)
- Summary shows totals across all line items

**Rationale:**
- Privacy: Aggregation obscures individual requests
- Simplicity: Customers care about totals, not per-request
- Performance: Aggregation reduces snapshot size

---

## 6. Explicit Non-Goals

### 6.1 NOT in Phase 23B-3/23B-4

**❌ No Payment Collection:**
- No credit card charging
- No payment processing
- No payment confirmation
- Rationale: Payment is Phase 24+

**❌ No Invoice Emailing:**
- No email delivery
- No email templates
- No email notifications
- Rationale: Delivery is Phase 24+

**❌ No PDF Generation:**
- No PDF rendering
- No invoice formatting
- No printable invoices
- Rationale: Formatting is Phase 24+

**❌ No Accounting Export:**
- No QuickBooks export
- No CSV export
- No accounting system integration
- Rationale: Exports are Phase 24+

**❌ No Refunds or Adjustments:**
- No refund processing
- No credit application
- No billing adjustments
- Rationale: Adjustments are Phase 24+

**❌ No Invoice Numbering:**
- No sequential invoice numbers
- No invoice ID generation (uses snapshotId)
- No invoice number schema
- Rationale: Numbering is external system concern (Phase 24+)

**❌ No Payment Status Tracking:**
- No "paid" status (status is draft/finalized only)
- No payment date tracking
- No payment method tracking
- Rationale: Payment tracking is Phase 24+

**❌ No Tax Calculation:**
- No sales tax
- No VAT
- No tax jurisdiction logic
- Rationale: Tax is Phase 24+

**❌ No Multi-Currency:**
- No currency conversion
- No non-USD currencies
- USD only (Phase 23B-4)
- Rationale: Multi-currency is Phase 24+

**❌ No Public APIs:**
- No REST endpoints (Phase 24+)
- No GraphQL endpoints (Phase 24+)
- Internal service only (Phase 23B-4)
- Rationale: APIs are Phase 24+

### 6.2 Future Enhancements (NOT NOW)

**Phase 24+ (Potential Future):**
- Public API endpoints (GET /api/billing/snapshots)
- Invoice PDF generation
- Invoice email delivery
- Payment processing integration (Stripe)
- Payment status tracking (paid/unpaid/overdue)
- Invoice numbering system
- Refund and adjustment logic
- Accounting system exports (QuickBooks, Xero)
- Tax calculation (sales tax, VAT)
- Multi-currency support

**Phase 25+ (Potential Future):**
- Billing dashboard (web UI)
- Invoice history viewer
- Payment history
- Billing analytics
- Cost forecasting

---

## 7. Design Decisions & Rationale

### 7.1 Why Immutable Snapshots

**Decision:** Snapshots are immutable (never updated)

**Rationale:**
- Audit trail integrity (legal requirement)
- Trust (customers rely on snapshot accuracy)
- Reproducibility (can verify snapshot correctness)
- Simplicity (no update logic needed)

**Trade-offs:**
- Cannot correct errors (must create new snapshot)
- Acceptable: Corrections are rare, new snapshot acceptable

### 7.2 Why Snapshot Not Live View

**Decision:** Snapshot is point-in-time capture (not live view)

**Rationale:**
- Billing stability (snapshot doesn't change unexpectedly)
- Customer expectation (invoice is fixed, not dynamic)
- Audit requirement (billing record must be stable)

**Trade-offs:**
- Must create new snapshot to include new usage
- Acceptable: Standard billing practice

### 7.3 Why Status Field (draft/finalized)

**Decision:** Include status field for lifecycle

**Rationale:**
- Workflow support (draft allows review before finalization)
- External system coordination (finalized signals ready for payment)
- Flexibility (can regenerate draft, cannot change finalized)

**Trade-offs:**
- Additional complexity (status transitions)
- Acceptable: Common billing practice

### 7.4 Why No Invoice Numbering

**Decision:** Use snapshotId (UUID), not sequential invoice number

**Rationale:**
- Simplicity (no numbering logic in Phase 23B-4)
- Decoupling (external systems own invoice numbering)
- Uniqueness (UUID guarantees uniqueness)

**Trade-offs:**
- External system must assign invoice numbers
- Acceptable: Invoice numbering is external concern

### 7.5 Why No Payment Tracking

**Decision:** No payment status in snapshot (Phase 23B-4)

**Rationale:**
- Scope separation (billing vs payment are separate)
- Simplicity (payment tracking is complex)
- External ownership (payment system owns payment state)

**Trade-offs:**
- Cannot query payment status from snapshot
- Acceptable: Payment status is external system concern (Phase 24+)

### 7.6 Why Line Item Breakdown

**Decision:** Include per-(provider, model) breakdown

**Rationale:**
- Transparency (customers see cost by model)
- Audit support (can verify charges per model)
- Future pricing (enables model-specific pricing)

**Trade-offs:**
- More data in snapshot
- Acceptable: Essential for transparent billing

---

## 8. Safe Resume Point

### 8.1 Phase 23B-3 Completion

**Phase 23B-3 Unlocks:**
- Phase 23B-4: Billing Snapshot Implementation
- Clear design for snapshot structure
- Clear design for snapshot semantics
- Clear design for immutability guarantees

**Phase 23B-3 Does NOT Unlock:**
- Phase 24 (requires Phase 23B-4 complete)
- Payment processing (Phase 24+)
- Invoice delivery (Phase 24+)
- Public APIs (Phase 24+)

### 8.2 Dependencies for Phase 23B-4

**Phase 23B-4 Can Depend On:**
- ✅ BillingView service (Phase 23B-1, to be implemented)
- ✅ Cost calculation service (Phase 23B-2, to be implemented)
- ✅ usage_records table (Phase 22)
- ✅ Pricing configuration (Phase 23B-2 design)
- ✅ Snapshot structure defined (Phase 23B-3 design)

**Phase 23B-4 Cannot Assume:**
- ❌ Payment processing (Phase 24+)
- ❌ Invoice delivery (Phase 24+)
- ❌ Public APIs (Phase 24+)
- ❌ External integrations (Phase 24+)

### 8.3 What Phase 23B-4 Will Implement

**Implementation Scope (Phase 23B-4):**
- BillingSnapshot entity (database table)
- BillingSnapshotService (create, read, finalize)
- Snapshot creation logic (aggregate + price + store)
- Snapshot query logic (by ID, by apiKey + period)
- Finalization logic (draft → finalized)
- Unit tests (snapshot creation, query, finalization)
- Integration tests (end-to-end snapshot generation)

**Implementation Will NOT Include:**
- Payment processing (Phase 24+)
- Invoice delivery (Phase 24+)
- PDF generation (Phase 24+)
- Public APIs (Phase 24+)
- External integrations (Phase 24+)

### 8.4 Handoff to Phase 24

**Phase 24 Will Consume:**
- ✅ BillingSnapshot (immutable billing records)
- ✅ Snapshot query APIs (internal)
- ✅ Finalization status (draft/finalized)

**Phase 24 Will Add:**
- Public API endpoints (GET /api/billing/snapshots)
- PDF generation (invoice.pdf)
- Email delivery (send invoice to customer)
- Payment processing (Stripe integration)
- Payment status tracking (paid/unpaid)
- Invoice numbering (sequential IDs)

**Handoff Guarantee:**
- Phase 23B-4 provides complete billing snapshots
- Phase 24 treats snapshots as read-only (no mutation)
- Phase 24 adds external-facing features only
- Core billing logic remains in Phase 23

---

## 9. Architecture Snapshot

### 9.1 System State After Phase 23B-4

```
┌──────────────────────────────────────────────┐
│ api-gateway                                  │
│                                              │
│ Phase 22: Usage Ledger (write-only)         │
│   ↓                                          │
│ Phase 23B-1: Billing Read Model (aggregate) │
│   ↓                                          │
│ Phase 23B-2: Cost Calculation (pricing)     │
│   ↓                                          │
│ Phase 23B-3: Billing Snapshot (immutable)   │
│   → BillingSnapshot created                  │
│   → Internal service only                    │
│   → No external exposure                     │
└──────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────┐
│ Phase 24+: External Billing System           │
│ - Query snapshots via API                    │
│ - Generate PDF invoices                      │
│ - Send email notifications                   │
│ - Process payments (Stripe)                  │
│ - Track payment status                       │
└──────────────────────────────────────────────┘
```

### 9.2 Data Flow

```
Execution (Phase 12-21)
  ↓
UsageRecord (Phase 22, write)
  ↓
BillingView (Phase 23B-1, read + aggregate)
  ↓
CostCalculation (Phase 23B-2, apply pricing)
  ↓
BillingSnapshot (Phase 23B-3, immutable record)
  ↓
External Billing (Phase 24+, payment + delivery)
```

---

## ULTRA-BRIEF SUMMARY

• **Billing snapshot is immutable point-in-time capture** of aggregated usage (from Phase 23B-1) with applied pricing (from Phase 23B-2) producing self-contained record with snapshotId, apiKeyId, periodStart/End, pricingVersion, lineItems (per provider/model with totalTokens, costUSD), and summary (subtotal, total) with deterministic reproducibility guarantee from usage ledger

• **Intentionally unbuilt: payment processing, invoice delivery, PDF generation, external APIs** with Phase 23B-4 implementing internal billing snapshot service (create, read, finalize) producing draft/finalized snapshots stored immutably in billing_snapshots table without payment status tracking, invoice numbering, or customer-facing features (all deferred to Phase 24+)

• **Safe handoff to Phase 24 with complete billing foundation** where snapshots remain read-only immutable records while Phase 24+ adds external-facing layer (public APIs, PDF invoices, email delivery, Stripe payment processing, payment status tracking, invoice numbering) treating snapshots as authoritative billing records without modifying core billing logic

---

**END OF PHASE 23B-3 DESIGN**
