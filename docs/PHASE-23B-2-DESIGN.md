# PHASE 23B-2 DESIGN: Pricing and Cost Calculation (Design Only)

**Status:** DESIGN-ONLY (No Implementation)
**Nature:** Pricing Logic Design
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 23B (Billing Implementation)
**Prerequisite:** Phase 23B-1 (Billing Read Model) COMPLETE

---

## 1. Overview

### 1.1 Purpose

Phase 23B-2 defines a deterministic pricing and cost calculation model that operates on aggregated usage data from the Billing Read Model (Phase 23B-1). This design establishes pricing units, cost computation rules, rounding behavior, and pricing versioning strategy.

### 1.2 Scope

**Design Scope:**
- Pricing model definition (per-1K-token basis)
- Pricing scope (provider + model granularity)
- Cost calculation formulas (deterministic computation)
- Rounding rules (explicit, deterministic)
- Pricing versioning strategy (immutable pricing history)
- Failure behavior (throw on missing/invalid pricing)

**Implementation Scope:**
- NONE in this phase (Phase 23B-2 is design only)
- Phase 23B-3 will implement the design

### 1.3 Core Principles

**Pricing Principles:**
- ✅ Deterministic (same input → same output)
- ✅ Config-based (no hardcoded prices)
- ✅ Versioned (immutable pricing history)
- ✅ Provider + model scoped (granular pricing)
- ✅ Token-based (per-1K-token pricing unit)
- ✅ Explicit rounding (no floating ambiguity)

---

## 2. Pricing Model

### 2.1 Pricing Unit Definition

**Base Unit: Cost per 1,000 Tokens**

**Rationale:**
- Industry standard (most AI providers price per 1K tokens)
- Avoids floating point precision issues (integer math at scale)
- Human-readable (easier to communicate pricing)

**Unit Representation:**
```typescript
// Conceptual pricing structure (design only)
interface PricingRate {
  provider: string;              // e.g., 'anthropic', 'openai'
  model: string;                 // e.g., 'claude-3-5-sonnet-20241022'
  pricePerThousandTokens: number; // USD per 1,000 tokens (e.g., 0.01 = $0.01/1K tokens)
  effectiveFrom: Date;           // When this price becomes active
  effectiveUntil: Date | null;   // When this price expires (null = active)
  pricingVersion: string;        // Immutable version identifier
}
```

### 2.2 Pricing Scope

**Pricing Granularity:**
- Primary: Provider (e.g., 'anthropic', 'openai', 'stub')
- Secondary: Model (e.g., 'claude-3-5-sonnet-20241022', 'gpt-4')
- Combined: (provider, model) tuple is pricing key

**Pricing Key Examples:**
```
('anthropic', 'claude-3-5-sonnet-20241022') → $0.01 per 1K tokens
('anthropic', 'claude-3-opus-20240229')     → $0.05 per 1K tokens
('openai', 'gpt-4')                          → $0.03 per 1K tokens
('openai', 'gpt-3.5-turbo')                  → $0.002 per 1K tokens
('stub', 'stub')                             → $0.00 per 1K tokens (free)
```

**Pricing Scope Characteristics:**
- Each (provider, model) has one active price at a time
- No user-specific pricing (Phase 23B, future: Phase 24+)
- No tier-based pricing (Phase 23B, future: Phase 24+)
- No volume discounts (Phase 23B, future: Phase 24+)

### 2.3 Pricing Table Structure

**Static Pricing Configuration (Conceptual YAML):**
```yaml
# Example pricing configuration (design only)
pricing:
  version: "2026-02-v1"  # Pricing version identifier
  effective_from: "2026-02-01T00:00:00Z"
  effective_until: null  # Active until changed

  rates:
    - provider: "anthropic"
      model: "claude-3-5-sonnet-20241022"
      price_per_thousand_tokens: 0.01  # $0.01 per 1K tokens

    - provider: "anthropic"
      model: "claude-3-opus-20240229"
      price_per_thousand_tokens: 0.05  # $0.05 per 1K tokens

    - provider: "openai"
      model: "gpt-4"
      price_per_thousand_tokens: 0.03  # $0.03 per 1K tokens

    - provider: "openai"
      model: "gpt-3.5-turbo"
      price_per_thousand_tokens: 0.002  # $0.002 per 1K tokens

    - provider: "stub"
      model: "stub"
      price_per_thousand_tokens: 0.0   # Free (testing)
```

**Configuration Characteristics:**
- Config-based (YAML or JSON file)
- Loaded at service startup
- Immutable during service lifetime
- Changes require service restart (Phase 23B-3)

### 2.4 Pricing Storage

**Phase 23B-3 Storage Options:**

**Option A: Config File Only**
- Pricing in YAML/JSON config file
- Loaded at startup
- No database storage
- Simple for Phase 23B-3 MVP

**Option B: Database Table**
- Pricing stored in pricing_rates table
- Versioned pricing history
- Query-based pricing lookup
- Better for pricing history/audit

**Recommendation: Option A for Phase 23B-3**
- Simplicity (no new database table)
- Sufficient for MVP (pricing changes are rare)
- Future: Phase 23C+ can migrate to database

---

## 3. Cost Calculation Rules

### 3.1 Cost Calculation Formula

**Input: BillingView (from Phase 23B-1)**
```typescript
interface BillingView {
  apiKeyId: string;
  provider: string;
  model: string;
  totalTokens: number;
  totalRequests: number;
  totalDurationMs: number;
  periodStart: Date;
  periodEnd: Date;
}
```

**Output: CostCalculation**
```typescript
interface CostCalculation {
  // Input identifiers
  apiKeyId: string;
  provider: string;
  model: string;
  periodStart: Date;
  periodEnd: Date;

  // Usage inputs
  totalTokens: number;
  totalRequests: number;

  // Pricing inputs
  pricePerThousandTokens: number;
  pricingVersion: string;

  // Calculated costs
  costUSD: number;              // Total cost in USD
  costBreakdown: CostBreakdown; // Detailed breakdown
}

interface CostBreakdown {
  tokenCost: number;     // Cost from tokens
  timeCost: number;      // Cost from duration (Phase 23B: always 0)
  subtotal: number;      // Sum of all costs
  adjustments: number;   // Future: discounts, credits (Phase 23B: always 0)
  total: number;         // Final cost (= subtotal + adjustments)
}
```

### 3.2 Token-Based Cost Formula

**Formula:**
```
tokenCost = (totalTokens / 1000) × pricePerThousandTokens
```

**Example Calculation:**
```
Given:
  totalTokens = 5,432
  pricePerThousandTokens = $0.01

Calculation:
  tokenCost = (5,432 / 1000) × $0.01
            = 5.432 × $0.01
            = $0.05432
            = $0.054 (rounded to 3 decimal places)
```

**Cost Calculation Steps:**
1. Divide totalTokens by 1,000 (get thousands)
2. Multiply by pricePerThousandTokens
3. Round to 3 decimal places (see Section 4)
4. Return tokenCost

### 3.3 Time-Based Cost (Future)

**Phase 23B-3: Time-Based Cost = $0**
- timeCost is always 0 in Phase 23B-3
- totalDurationMs is captured but not priced
- Future: Phase 23C+ may add time-based pricing

**Future Formula (Phase 23C+):**
```
timeCost = (totalDurationMs / 1000) × pricePerSecond
```

**Rationale for Deferral:**
- Simplicity: Token-based pricing sufficient for MVP
- Uncertainty: Time-based pricing model needs validation
- Optional: Most AI providers price by tokens only

### 3.4 Total Cost Calculation

**Total Cost Formula:**
```
subtotal = tokenCost + timeCost
adjustments = 0  (Phase 23B-3, future: discounts/credits)
total = subtotal + adjustments
```

**Phase 23B-3 Simplification:**
```
total = tokenCost
      (timeCost = 0, adjustments = 0)
```

### 3.5 Cost Aggregation

**Aggregating Across Models:**
```
totalCostForApiKey = SUM(CostCalculation.total for each (provider, model))
```

**Example:**
```
API Key: key-test
Period: February 2026

Usage:
  (anthropic, claude-3-5-sonnet-20241022): 10,000 tokens → $0.10
  (openai, gpt-4):                          5,000 tokens → $0.15

Total Cost: $0.10 + $0.15 = $0.25
```

---

## 4. Determinism & Rounding

### 4.1 Determinism Guarantees

**Deterministic Properties:**
- Same BillingView + same PricingConfig → same CostCalculation (always)
- No randomness in calculation
- No timing dependence
- No external API calls
- Pure function semantics

**Deterministic Formula:**
```
CostCalculation = f(BillingView, PricingConfig)

Where f is:
  - Pure function (no side effects)
  - Deterministic (same inputs → same output)
  - Idempotent (multiple calls → same result)
```

### 4.2 Rounding Rules

**Rounding Policy: Round to 3 Decimal Places**

**Rounding Method: Banker's Rounding (Round Half to Even)**
- 0.0125 → 0.012 (round down, 5 is halfway, round to even)
- 0.0135 → 0.014 (round up, 5 is halfway, round to even)
- 0.0124 → 0.012 (round down)
- 0.0126 → 0.013 (round up)

**Rationale:**
- Industry standard (reduces bias over many transactions)
- Deterministic (no ambiguity)
- Fair (no systematic advantage to buyer or seller)

**Implementation Note (Phase 23B-3):**
```typescript
// Conceptual rounding function (design only)
function roundCost(cost: number): number {
  // Round to 3 decimal places using banker's rounding
  return Math.round(cost * 1000) / 1000;
}
```

### 4.3 Floating Point Precision

**Precision Strategy:**
- Use floating point for calculation (sufficient for MVP)
- Round final result to 3 decimal places
- No integer arithmetic (too complex for MVP)

**Future: Decimal Arithmetic (Phase 23C+):**
- Use decimal library (e.g., decimal.js) for exact arithmetic
- Eliminates floating point precision issues
- Recommended for production billing

**Phase 23B-3: Floating Point Acceptable**
- Precision issues unlikely at current scale
- 3 decimal places mitigates most issues
- Future migration path available

### 4.4 Zero Cost Handling

**Zero Cost Models:**
- Some models may have pricePerThousandTokens = 0 (e.g., stub)
- Zero cost is valid (not an error)
- CostCalculation.total = $0.00 is valid

**Zero Token Handling:**
- BillingView.totalTokens = 0 is valid (no usage in period)
- CostCalculation.total = $0.00 (no cost)
- NOT an error (valid billing result)

---

## 5. Pricing Versioning

### 5.1 Pricing Version Identifier

**Version Format: "YYYY-MM-vN"**
- Example: "2026-02-v1", "2026-03-v1", "2026-03-v2"
- YYYY-MM: Year-Month when pricing takes effect
- vN: Version number within that month

**Version Characteristics:**
- Immutable (once created, never changes)
- Unique (no duplicate version identifiers)
- Sequential (version numbers increase)

### 5.2 Pricing History

**Pricing Version Timeline:**
```
2026-01-v1: Active 2026-01-01 to 2026-01-31
2026-02-v1: Active 2026-02-01 to 2026-02-28
2026-03-v1: Active 2026-03-01 to present
```

**Version Storage (Future):**
- Phase 23B-3: Single active pricing config (no history)
- Phase 23C+: Database-backed pricing with version history
- Version history enables historical billing recalculation

### 5.3 Pricing Changes

**Pricing Change Process:**
1. Create new pricing config with new version identifier
2. Set effectiveFrom date (future date)
3. Old pricing remains active until effectiveFrom
4. New pricing becomes active at effectiveFrom
5. Both versions stored for audit (future)

**Phase 23B-3 Limitation:**
- Only one active pricing config at a time
- Pricing changes require service restart
- No automated pricing transitions

**Future: Automatic Transitions (Phase 23C+):**
- Multiple pricing versions stored in database
- Service automatically switches at effectiveFrom
- No service restart required

### 5.4 Audit Trail

**Pricing Audit Requirements:**
- Every CostCalculation records pricingVersion
- Can trace cost back to specific pricing config
- Can reproduce cost calculation with historical pricing

**Audit Query (Conceptual):**
```
Given: CostCalculation with pricingVersion = "2026-02-v1"
Find:  Pricing config for version "2026-02-v1"
Verify: Recalculate cost and confirm match
```

---

## 6. Failure Semantics

### 6.1 Pricing Failure Scenarios

**Missing Pricing:**
- Scenario: (provider, model) not found in pricing config
- Behavior: Throw PricingNotFoundError
- No fallback (do not assume zero cost)
- No default pricing (must be explicit)

**Invalid Pricing:**
- Scenario: pricePerThousandTokens is negative
- Behavior: Throw InvalidPricingError
- No correction (pricing must be valid)

**Expired Pricing:**
- Scenario: effectiveUntil is in the past (future: Phase 23C+)
- Behavior: Throw ExpiredPricingError
- No fallback to default pricing

### 6.2 Calculation Failure Scenarios

**Invalid Input:**
- Scenario: totalTokens is negative
- Behavior: Throw InvalidUsageError
- Should not occur (Phase 23B-1 validates)

**Calculation Overflow:**
- Scenario: totalTokens × price exceeds number precision
- Behavior: Throw CalculationOverflowError
- Unlikely at current scale

### 6.3 Error Handling

**Error Types:**
```typescript
// Conceptual error types (design only)
class PricingError extends Error {
  provider?: string;
  model?: string;
  pricingVersion?: string;
}

class PricingNotFoundError extends PricingError {}
class InvalidPricingError extends PricingError {}
class ExpiredPricingError extends PricingError {}
class InvalidUsageError extends PricingError {}
class CalculationOverflowError extends PricingError {}
```

**Error Logging:**
- ✅ Log error type
- ✅ Log provider + model (if known)
- ✅ Log pricingVersion (if known)
- ✅ Log timestamp
- ❌ NO sensitive user data
- ❌ NO prompt content
- ❌ NO AI output

### 6.4 Failure Isolation

**Critical Guarantee:**
- Pricing failures do NOT affect execution (Phase 12-22 unchanged)
- Pricing failures do NOT modify ledger (Phase 22 unchanged)
- Pricing failures do NOT propagate to client (billing is async)

**Failure Boundary:**
```
Execution succeeds (Phase 12-22)
  ↓
Ledger write succeeds (Phase 22)
  ↓
Client receives success
  ↓
(Later) Billing read succeeds (Phase 23B-1)
  ↓
(Later) Cost calculation fails ← ISOLATED
```

---

## 7. Explicit Non-Goals

### 7.1 NOT in Phase 23B-2/23B-3

**❌ No Invoices:**
- No invoice generation
- No invoice formatting
- No invoice delivery
- Rationale: Invoicing is Phase 24+

**❌ No Billing Cycles Execution:**
- No automatic monthly billing runs
- No scheduled cost calculations
- No billing job scheduler
- Rationale: On-demand only (Phase 23B-3)

**❌ No Payment Processing:**
- No credit card charging
- No payment collection
- No payment confirmation
- Rationale: Payments are Phase 24+

**❌ No Customer Notifications:**
- No email notifications
- No billing alerts
- No cost warnings
- Rationale: Notifications are Phase 24+

**❌ No Refunds or Credits:**
- No refund processing
- No credit application
- No billing adjustments
- Rationale: Refunds are Phase 24+

**❌ No Discounts or Promotions:**
- No discount codes
- No promotional pricing
- No volume discounts
- Rationale: Discounts are Phase 24+

**❌ No User-Specific Pricing:**
- No custom pricing per user
- No negotiated rates
- No tier-based pricing
- Rationale: Custom pricing is Phase 24+

**❌ No API Endpoints:**
- No public cost calculation APIs
- No pricing query APIs
- No billing APIs
- Rationale: APIs are Phase 24+

**❌ No Real-Time Costing:**
- No cost returned in execution response
- No real-time cost tracking
- No live cost meters
- Rationale: Billing is async, post-execution

**❌ No Tax Calculation:**
- No sales tax
- No VAT
- No tax jurisdictions
- Rationale: Tax is Phase 24+

### 7.2 Future Enhancements (NOT NOW)

**Phase 23C+ (Potential Future):**
- Database-backed pricing (version history)
- Automatic pricing transitions (effectiveFrom)
- Time-based pricing (pricePerSecond)
- Decimal arithmetic (exact cost calculation)
- Background billing jobs (scheduled calculations)

**Phase 24+ (Potential Future):**
- Invoice generation (PDF, email)
- Payment processing (Stripe integration)
- Customer notifications (email alerts)
- Refunds and credits (billing adjustments)
- Discounts and promotions (promo codes)
- User-specific pricing (custom rates)
- Public APIs (GET /api/billing/cost)
- Real-time cost tracking (live meters)

---

## 8. Design Decisions & Rationale

### 8.1 Why Per-1K-Token Pricing

**Decision:** Cost per 1,000 tokens (not per token)

**Rationale:**
- Industry standard (Anthropic, OpenAI use per-1K pricing)
- Human-readable (easier to communicate: "$0.01/1K tokens")
- Avoids floating point issues (fewer decimal places)

**Trade-offs:**
- Requires division by 1,000 in formula
- Acceptable: Simple arithmetic

### 8.2 Why Banker's Rounding

**Decision:** Round half to even (banker's rounding)

**Rationale:**
- Industry standard (reduces bias)
- Deterministic (no ambiguity)
- Fair (no systematic advantage)

**Trade-offs:**
- Slightly more complex than "round up" or "round down"
- Acceptable: Well-supported in libraries

### 8.3 Why No Time-Based Pricing in Phase 23B-3

**Decision:** Token-based pricing only (no time-based)

**Rationale:**
- Simplicity (one pricing dimension)
- Sufficient for MVP (most providers price by tokens)
- Uncertainty (time-based pricing model needs validation)

**Trade-offs:**
- Cannot charge for execution time
- Acceptable: Can add in Phase 23C+

### 8.4 Why Config-Based Pricing (Not Database)

**Decision:** Pricing in config file (Phase 23B-3)

**Rationale:**
- Simplicity (no new database table)
- Sufficient for MVP (pricing changes are rare)
- Easy to version control (config in git)

**Trade-offs:**
- No pricing history (single version only)
- Service restart required for changes
- Acceptable for MVP: Can migrate to database in Phase 23C+

### 8.5 Why No Automatic Retries

**Decision:** Cost calculation failures throw (no retries)

**Rationale:**
- Simplicity (no retry logic)
- Determinism (retries complicate behavior)
- Billing is async (manual retry acceptable)

**Trade-offs:**
- Transient failures require manual intervention
- Acceptable for MVP: Can add retry logic in Phase 23C+

---

## 9. Safe Resume Point

### 9.1 Phase 23B-2 Completion

**Phase 23B-2 Unlocks:**
- Phase 23B-3: Pricing and Cost Calculation Implementation
- Clear design for pricing model
- Clear design for cost calculation formulas
- Clear design for determinism guarantees

**Phase 23B-2 Does NOT Unlock:**
- Phase 23C (requires Phase 23B-3 complete)
- Phase 24 (requires Phase 23B-3 + 23C complete)
- API endpoints (Phase 24+)

### 9.2 Dependencies for Phase 23B-3

**Phase 23B-3 Can Depend On:**
- ✅ BillingView service exists (Phase 23B-1, to be implemented)
- ✅ usage_records table exists (Phase 22)
- ✅ Aggregation logic designed (Phase 23B-1)
- ✅ Pricing model designed (Phase 23B-2)
- ✅ Cost formulas designed (Phase 23B-2)

**Phase 23B-3 Cannot Assume:**
- ❌ Database-backed pricing (Phase 23C+)
- ❌ Automatic pricing transitions (Phase 23C+)
- ❌ API endpoints (Phase 24+)
- ❌ Invoice generation (Phase 24+)

### 9.3 What Phase 23B-3 Will Implement

**Implementation Scope (Phase 23B-3):**
- Pricing configuration loader (YAML/JSON)
- Cost calculation service (formulas from this design)
- Rounding logic (banker's rounding)
- Error handling (throw on missing pricing)
- Unit tests (cost calculation correctness)
- Integration tests (end-to-end cost calculation)

**Implementation Will NOT Include:**
- Invoice generation (Phase 24+)
- Payment processing (Phase 24+)
- API endpoints (Phase 24+)
- Background jobs (Phase 23C+)
- Database-backed pricing (Phase 23C+)

### 9.4 What Phase 23B-3 Will Expose

**Phase 23B-3 Will Provide:**
- Internal cost calculation service
- Cost calculation for single BillingView
- Cost aggregation across multiple BillingViews
- Pricing query (get price for provider + model)

**Phase 23B-3 Will NOT Provide:**
- Public API endpoints (Phase 24+)
- Real-time cost tracking (Phase 24+)
- Cost notifications (Phase 24+)
- Billing dashboards (Phase 25+)

---

## ULTRA-BRIEF SUMMARY

• **Pricing model defined as cost per 1,000 tokens** scoped by (provider, model) tuple with static config-based pricing table (YAML/JSON) and immutable versioning (pricingVersion format "YYYY-MM-vN") enabling audit trail from cost back to specific pricing config

• **Determinism guarantees through explicit rounding rules** using banker's rounding (round half to even) to 3 decimal places with token-based cost formula (totalTokens / 1000 × pricePerThousandTokens) and throw-on-failure semantics for missing/invalid pricing (no fallbacks, no partial results)

• **Phase 23B-3 will implement internal cost calculation service** consuming BillingView aggregates from Phase 23B-1, loading pricing from config file, calculating deterministic costs with rounding, and exposing cost calculation logic for future invoice generation (Phase 24+) and API endpoints (Phase 24+) without implementing invoicing, payments, or customer-facing features

---

**END OF PHASE 23B-2 DESIGN**
