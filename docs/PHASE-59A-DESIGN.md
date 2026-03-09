# PHASE 59A DESIGN: Cost Monitoring & Resource Efficiency

**Phase:** 59A
**Stage:** STAGE-59A
**Task:** TASK-59A — Cost Monitoring & Resource Efficiency Design
**Nature:** DESIGN ONLY (No Implementation)
**Scope:** api-gateway (read-only extensions); design for future dashboards
**Status:** DESIGN COMPLETE
**Date:** 2026-03-09
**Prerequisite:** Phase 23 (Billing Snapshots), Phase 24 (Billing Visibility), Phase 58 COMPLETE
**Next Phase:** Phase 59B (Implementation — when authorized)

---

## 1. Phase Overview

### 1.1 What Phase 59A Defines

Phase 59A establishes the design for **Provider Cost Visibility** and **Resource Efficiency Monitoring**—extending the existing billing visibility layer to support operational cost monitoring and efficiency signals without modifying execution, quota, billing, or ledger behavior.

**Core Achievement:**
A design that:
- Extends provider cost visibility for operational monitoring
- Defines efficiency signals derived from existing usage_records and billing snapshots
- Enables cost dashboards and optimization awareness
- Preserves all existing execution, quota, billing, and ledger invariants

**Key Architectural Principle:**
Cost monitoring and efficiency signals are **read-only projections** over existing data. No new writes, no schema changes to usage_records, no changes to billing snapshot creation, and no coupling to execution flow.

### 1.2 Boundaries and Invariants

**MUST PRESERVE:**
- Usage ledger (usage_records): append-only, two-phase, immutable
- Billing snapshots: creation logic, pricing, rounding
- Quota enforcement: session, rolling 24h, token limits
- Execution flow: ai-service, api-gateway, container-manager unchanged

**MUST NOT:**
- Add JWT guards, API keys, or auth middleware to new endpoints (per CLAUDE.md Internal API Rules)
- Modify internal endpoints
- Introduce background workers for cost aggregation
- Change billing calculation or snapshot semantics

---

## 2. Current State (Baseline)

### 2.1 Existing Provider Cost Visibility

| Capability | Source | Data |
|------------|--------|------|
| Snapshot list | BillingVisibilityService | BillingSnapshotSummary[] |
| Cost breakdown | BillingVisibilityService | CostBreakdown (by provider/model) |
| Time window summary | BillingVisibilityService | TimeWindowCostSummary with byProvider |
| Snapshot metadata | BillingVisibilityService | SnapshotMetadata |

**TimeWindowCostSummary.byProvider** already provides:
- `provider`, `totalCostUSD`, `totalTokens`, `totalRequests`

**Gap:** No provider-level view across arbitrary time windows without snapshots; no efficiency metrics.

### 2.2 Existing Data Sources

| Source | Owner | Relevant Fields |
|--------|-------|-----------------|
| usage_records | api-gateway | provider, model, tokensUsed, executionDurationMs, execution_status, timestamp |
| billing_snapshots | api-gateway | lineItems (provider, model, costUSD, totalTokens, totalRequests) |
| /api/runtime/metrics | api-gateway | session/container counts, connectivity (no cost) |

---

## 3. Provider Cost Visibility Design

### 3.1 Provider Cost Summary (Extended)

**Purpose:** Operational view of provider costs for a time window, derived from usage_records or billing snapshots.

**Design Option A — Snapshot-Based (Preferred):**
- Reuse existing `getTimeWindowSummary(apiKeyId, periodStart, periodEnd)`
- Already returns `byProvider` with totalCostUSD, totalTokens, totalRequests
- **No new API required** for provider cost visibility within snapshot-covered windows

**Design Option B — Ledger-Based (For Unsnapshotted Windows):**
- New read-only query: aggregate usage_records by provider for (apiKeyId, periodStart, periodEnd)
- Apply same pricing logic as BillingSnapshotService (deterministic)
- Use case: near-real-time cost view before snapshots exist
- **Scope:** Design only; implementation deferred to Phase 59B

**Data Model (unchanged from Phase 24):**
```typescript
interface ProviderCostSummary {
  provider: string;
  totalCostUSD: number;
  totalTokens: number;
  totalRequests: number;
}
```

### 3.2 Provider Cost Comparison View

**Purpose:** Compare costs across providers for the same time window (e.g., "anthropic vs openai this month").

**Design:**
- Derived from `TimeWindowCostSummary.byProvider`
- Sort by totalCostUSD DESC
- Optional: add `costPerThousandTokens` (totalCostUSD / totalTokens * 1000) for comparison
- **Implementation:** Client-side or thin API wrapper over existing `getTimeWindowSummary`

### 3.3 Provider Cost Trends

**Purpose:** Time-series view of provider costs (e.g., daily cost by provider for last 7 days).

**Design:**
- Multiple calls to `getTimeWindowSummary` with daily buckets
- Or: new read-only endpoint `GET /api/billing/provider-trends?apiKeyId=&periodStart=&periodEnd=&granularity=daily`
- Returns: `{ byDay: [{ date, byProvider: ProviderCostSummary[] }] }`
- **Data source:** billing_snapshots (if granularity aligns) or usage_records aggregation

---

## 4. Resource Efficiency Monitoring Design

### 4.1 Efficiency Signals (Read-Only, Derived)

All signals are **derived from existing data**. No new instrumentation in execution path.

| Signal | Source | Formula | Use Case |
|--------|--------|---------|----------|
| Cost per execution | usage_records + pricing | cost(record) / 1 | Identify expensive executions |
| Tokens per execution | usage_records | tokensUsed / 1 | Token efficiency |
| Cost per 1K tokens | usage_records + pricing | cost / (tokensUsed/1000) | Provider/model efficiency |
| Failed execution cost | usage_records (execution_status='failed') | SUM(cost) where failed | Waste visibility |
| Pending/orphan count | usage_records (execution_status='pending') | COUNT | Reconciliation awareness |

### 4.2 Efficiency Summary (Proposed Read Model)

**Purpose:** High-level efficiency metrics for a time window.

```typescript
interface EfficiencySummary {
  apiKeyId: string;
  periodStart: Date;
  periodEnd: Date;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  totalTokens: number;
  totalCostUSD: number;
  avgTokensPerExecution: number;   // totalTokens / completedExecutions
  avgCostPerExecution: number;    // totalCostUSD / completedExecutions
  costPerThousandTokens: number;  // totalCostUSD / (totalTokens/1000)
  byProvider: ProviderEfficiencySummary[];
}

interface ProviderEfficiencySummary {
  provider: string;
  totalCostUSD: number;
  totalTokens: number;
  totalRequests: number;
  avgTokensPerRequest: number;
  costPerThousandTokens: number;
}
```

**Data source:** usage_records (filtered by apiKeyId, timestamp, execution_status='completed' for averages). Failed counts from execution_status='failed'.

**Implementation:** New read-only service method; no writes. Queries usage_records and applies pricing for cost fields.

### 4.3 Efficiency Optimization Signals

**Purpose:** Identify optimization opportunities (informational only; no automatic actions).

| Signal | Description | Source |
|-------|-------------|--------|
| High cost per token | Provider/model with above-average cost per 1K tokens | Compare to platform average |
| Failed execution share | % of executions that failed (potential retry waste) | usage_records |
| Token spike | Unusual token usage in short window | usage_records aggregation |
| Provider mix | Distribution of spend across providers | byProvider |

**Design:** These are **analytical views** for dashboards. No alerts, no background jobs. Query on demand.

---

## 5. API Design (Proposed)

### 5.1 New Endpoints (Phase 59B Implementation)

All endpoints are **read-only**. Access control: same as existing billing visibility (apiKeyId-scoped).

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/billing/efficiency-summary | EfficiencySummary for time window |
| GET | /api/billing/provider-trends | Provider cost trends (daily granularity) |

**Existing endpoints unchanged:**
- GET /api/billing/snapshots
- GET /api/billing/snapshots/:id
- GET /api/billing/snapshots/:id/breakdown
- GET /api/billing/summary (time window)

### 5.2 Runtime Metrics Extension (Optional)

**Current:** `/api/runtime/metrics` returns session/container stats, no cost.

**Design Option:** Add optional `costSummary` block to runtime metrics response:
- Rolling 24h total cost (from usage_records or latest snapshot)
- Provider breakdown (top 3 by cost)

**Constraint:** Only if strictly required for operational dashboards. Prefer separate billing endpoints to keep runtime metrics lightweight.

**Recommendation:** Defer runtime metrics cost extension. Use dedicated billing endpoints for cost visibility.

---

## 6. Data Flow

```
usage_records (immutable)
       │
       ├──► BillingSnapshotService (unchanged) ──► billing_snapshots
       │
       └──► EfficiencySummaryService (NEW, read-only)
                  │
                  └──► GET /api/billing/efficiency-summary
```

**No feedback loop.** Efficiency and cost monitoring never modify usage_records, billing_snapshots, or execution.

---

## 7. Non-Goals (Explicit)

- ❌ No schema changes to usage_records
- ❌ No schema changes to billing_snapshots
- ❌ No background workers for cost aggregation
- ❌ No alerts or automatic actions
- ❌ No changes to execution, quota, or ledger
- ❌ No new auth/guards on internal endpoints
- ❌ No Prometheus/OpenMetrics format (retain custom JSON)
- ❌ No real-time streaming of costs

---

## 8. Implementation Readiness

### 8.1 Prerequisites for Phase 59B

1. This design (PHASE-59A-DESIGN.md) approved
2. TASK-59A checkpoint created
3. TASK-59B created in TASKS_BACKLOG_FULL.md and activated in TASKS.md

### 8.2 Implementation Order (When Authorized)

1. EfficiencySummaryService (read-only, queries usage_records)
2. GET /api/billing/efficiency-summary
3. GET /api/billing/provider-trends (if needed)
4. Dashboard consumption (out of scope for Phase 59)

---

## 9. Summary

Phase 59A design establishes:

- **Provider cost visibility:** Extends existing TimeWindowCostSummary.byProvider; defines ledger-based option for unsnapshotted windows
- **Efficiency monitoring:** Read-only EfficiencySummary and ProviderEfficiencySummary derived from usage_records
- **Invariants preserved:** No changes to execution, quota, billing, or ledger
- **Scope:** Design only; implementation deferred to Phase 59B

**Document Status:** DESIGN COMPLETE  
**Alignment:** CLAUDE.md, PRD.md, ARCHITECTURE.md  
**Next:** Phase 59A checkpoint; await implementation prompt for Phase 59B
