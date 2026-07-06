# BILLING-READY-01A — Billing Implementation Architecture Review

**Task ID:** BILLING-READY-01A
**Family:** BILLING / COMMERCIAL READINESS
**Status:** COMPLETE
**Created:** 2026-07-06
**Nature:** READ-ONLY ARCHITECTURE REVIEW — no implementation
**Authority:** BILLING-READY-00, CLAUDE.md, TASKS.md, AINOW-EXECUTION-ROADMAP

---

## 1. Executive Summary

This document is the output of BILLING-READY-01A — a read-only architecture review of the existing billing, usage, quota, and plan infrastructure in the ainow.biz codebase. Its purpose is to identify the safest, smallest first implementation slice for BILLING-READY-01 (Credit Ledger Foundation) without introducing any code, schema, or runtime changes.

**Key findings:**

1. The existing `UsageRecord` + `BillingSnapshot` + `Invoice` pipeline in api-gateway is mature, immutable, and well-tested. It provides the accounting substrate for future credit deductions.
2. The existing `Plan` entity and `PlanQuotaConfig` use a limited `free/pro/enterprise` model. Extending these to support credit allocations is straightforward.
3. No credit ledger table, credit balance, or credit deduction logic exists anywhere in the codebase.
4. The safest first slice is **TypeScript-only domain types and static plan configuration** (Option A) — zero database migration risk.
5. Harness audit events already emit structured `tokensUsed` and `toolCallCount` per iteration, providing ready event sources for future credit deduction.

**Recommendation:** Proceed with BILLING-READY-01 using **Option A** (TypeScript-only credit ledger domain/types/config with no database migration).

---

## 2. Files Inspected

### Governance/Context
- `TASKS.md` (lines 26467–26607 — BILLING-READY-01A section)
- `TASKS_BACKLOG_FULL.md` (BILLING-READY-01A mirror — confirmed via grep)
- `docs/AINOW-EXECUTION-ROADMAP.md` (full file)
- `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md` (full file, 676 lines)
- `docs/BILLING-READY-00-CHECKPOINT.md` (full file, 444 lines)

### Database/Schema
- `database/schema.sql` (full file, 385 lines)

### API Gateway — Entities
- `services/api-gateway/src/entities/usage-record.entity.ts`
- `services/api-gateway/src/entities/billing-snapshot.entity.ts`
- `services/api-gateway/src/entities/invoice.entity.ts`
- `services/api-gateway/src/entities/plan.entity.ts`
- `services/api-gateway/src/entities/user.entity.ts`
- `services/api-gateway/src/entities/index.ts` (file listing)

### API Gateway — Usage Ledger
- `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`

### API Gateway — Billing
- `services/api-gateway/src/billing/billing-snapshot.service.ts`

### API Gateway — Billing Visibility
- `services/api-gateway/src/billing-visibility/billing-visibility.service.ts`

### API Gateway — Invoice
- `services/api-gateway/src/invoice/invoice.service.ts`

### API Gateway — Quota
- `services/api-gateway/src/quota/quota.service.ts`
- `services/api-gateway/src/quota/quota.config.ts`

### API Gateway — Token Usage
- `services/api-gateway/src/token-usage/token-usage.service.ts`

### API Gateway — Payments
- `services/api-gateway/src/payments/providers/stripe-payment.provider.ts`

### API Gateway — Migrations (file listing)
- 19 migration files total; billing-relevant: `CreateUsageRecordsTable`, `CreateBillingSnapshotsTable`, `CreateInvoicesTable`, `AddPlansFoundation`, `AddRequestIdToUsageRecords`, `AddExecutionStatusToUsageRecords`

### Container-Manager
- `services/container-manager/src/config/plan-quota.config.ts`
- `services/container-manager/src/usage/quota-evaluation.service.ts`
- `services/container-manager/src/usage/usage-aggregation.service.ts`

### AI-Service
- `services/ai-service/src/config/quota.config.ts`
- `services/ai-service/src/agent-harness/audit/harness-audit-events.ts`

### Frontend
- `frontend/components/workspace/workspace-quota-usage.logic.test.ts`
- `frontend/lib/agent-platform/agent-registry.ts`

---

## 3. Current Billing Architecture Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (NestJS)                              │
│                                                                          │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │ UsageLedgerSvc  │───▶│ BillingSnapshot  │───▶│   InvoiceSvc     │   │
│  │ (two-phase      │    │ Svc (periodic    │    │ (draft-only,     │   │
│  │  write, idem-   │    │  aggregation)    │    │  no payment)     │   │
│  │  potent)        │    └──────────────────┘    └──────────────────┘   │
│  └─────────────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │ TokenUsageSvc   │    │ QuotaService     │    │ BillingVisibility│   │
│  │ (per-session    │    │ (in-mem + DB     │    │ Svc (read-only   │   │
│  │  tracking)      │    │  enforcement)    │    │  snapshot queries)│   │
│  └─────────────────┘    └──────────────────┘    └──────────────────┘   │
│                                                                          │
│  ┌─────────────────┐    ┌──────────────────┐                           │
│  │ Stripe Payment  │    │ Plan Entity      │                           │
│  │ Provider (STUB) │    │ (free/pro/ent.)  │                           │
│  └─────────────────┘    └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────┐     ┌────────────────────────────┐
│    CONTAINER-MANAGER       │     │        AI-SERVICE           │
│                            │     │                            │
│  PlanQuotaConfig (static)  │     │  quota.config.ts (100K/   │
│  QuotaEvaluationSvc (RO)   │     │    session limit)         │
│  UsageAggregationSvc (RO)  │     │  HarnessAuditEvents       │
│  BillingExportController   │     │    (structured token/     │
│                            │     │     tool call events)     │
└────────────────────────────┘     └────────────────────────────┘

┌────────────────────────────┐
│         FRONTEND           │
│                            │
│  TokenCounter.tsx          │
│  workspace-quota-usage     │
│    .logic.ts (error parse) │
│  agent-registry.ts         │
│  (NO billing UI page)      │
└────────────────────────────┘
```

---

## 4. Database/Schema Inventory

### Tables Relevant to Billing

| Table | Database | Status | Reusable? |
|-------|----------|--------|-----------|
| `users` (plan_type, plan_status, stripe_customer_id) | Postgres | Active | Yes — extend plan_type values later |
| `plans` (code, name, max_active_sessions, max_sessions_24h, max_tokens_24h) | Postgres | Active (TypeORM) | Yes — add credit allocation columns later |
| `usage_records` (execution_id, user_id, tokens_used, provider, model, execution_status) | Postgres | Active (TypeORM, immutable) | Yes — source of truth for token usage |
| `billing_snapshots` (period, pricing_version, line_items, total_cost_usd) | Postgres | Active (TypeORM, immutable) | Yes — aggregation layer |
| `invoices` (api-gateway TypeORM: snapshot_id, total_cost_usd, status=draft) | Postgres | Active (TypeORM, draft-only) | Yes — billing output layer |
| `token_usage` (session_id, user_id, model, input/output_tokens, cost_usd) | Postgres + SQLite | Active | Yes — per-session accounting |
| `usage_quotas` (tokens_used_month, tokens_limit_month, storage_gb) | Postgres | Schema exists, uncertain active use | Candidate for future credit balance |
| `subscriptions` (stripe_subscription_id, plan_type, period) | Postgres | Schema exists (no Stripe calls) | Reuse when Stripe integrated |
| `invoices` (schema.sql: stripe_invoice_id, amount_usd, token_usage_count) | Postgres | Legacy schema.sql version | Superseded by TypeORM Invoice entity |
| `resource_usage` (cpu_seconds, memory_mb_hours, disk_gb_hours) | Postgres | Schema exists | Reuse for workspace_runtime credit category |

### Tables That Need Extension Later (NOT in BILLING-READY-01)

| Table | Extension Needed | When |
|-------|-----------------|------|
| `plans` | Add `monthly_credits`, `max_rollover_credits`, `allowed_agent_ids`, `overage_behavior` | BILLING-READY-04 |
| `users` | Extend `plan_type` CHECK constraint to include 'starter', 'team' | BILLING-READY-04 |
| `usage_quotas` | Repurpose or replace with credit_ledger semantics | BILLING-READY-02+ |

### Is a New Credit Ledger Table Needed?

**Not yet.** For BILLING-READY-01 (TypeScript-only domain types), no new table is needed. The existing `usage_records` table already contains all the raw event data. A dedicated `credit_ledger` table will be needed at BILLING-READY-02 (Credit Deduction Pipeline) when atomic balance decrements must be transactional.

**Can credit ledger behavior initially be represented in existing usage records?**

Partially. The `usage_records` table records consumption events but lacks:
- Monthly credit allocation tracking
- Running balance (remaining credits)
- Rollover credits
- Credit categories beyond model_tokens

For BILLING-READY-01 (types-only), no table changes are needed at all. For BILLING-READY-02, a new `credit_ledger` + `credit_deduction_events` table pair will likely be needed for transactional balance management.

---

## 5. Existing Usage Ledger Flow

```
Client request → QuotaGuard (pre-flight check)
  → UsageLedgerService.writeExecutionIntent() [status: 'pending']
  → ai-service call
  → UsageLedgerService.updateExecutionResult() [status: 'completed', tokens_used populated]
  → OrphanReconciliationWorker (background) [marks stale 'pending' → 'timeout']
```

**Key properties:**
- Two-phase write: intent before AI call, result after AI success
- Immutable append-only ledger
- Idempotent retries via `requestId` (unique constraint on user_id + request_id)
- Orphan cleanup: background worker transitions stale pending records to timeout
- Retry-after-timeout: reuses existing row (no duplicate inserts)

**Reuse for BILLING-READY-01:** The `UsageRecord` entity and `UsageLedgerService` are the authoritative execution event source. Future credit deduction should consume these events. No changes needed for types-only work.

---

## 6. Existing Token Usage Flow

```
AI execution completes → TokenUsageService.recordTokenUsage()
  → TokenUsageRepository (writes to token_usage table)
  → Fields: session_id, model, input_tokens, output_tokens, total_tokens
```

**Key properties:**
- Per-session, per-message granularity
- Records input/output tokens separately (richer than usage_records which only stores total)
- Used by container-manager's UsageAggregationService for plan-based quota evaluation
- No credit deduction logic

**Relationship to usage_records:** Both record token consumption but at different granularity. `token_usage` has per-message detail (input/output split); `usage_records` has per-execution detail (includes provider, adapter, execution status, two-phase lifecycle). For credit billing, `usage_records` is the better source (it has idempotency, execution status, and is the BillingSnapshot source).

---

## 7. Existing Billing Snapshot Flow

```
BillingSnapshotService.createSnapshot(apiKeyId, userId, windowStart, windowEnd, pricingVersion)
  → Query usage_records for time window (read-only)
  → Aggregate by (provider, model)
  → Apply pricing: PRICING_2026_02_V1 (hardcoded per 1K tokens)
  → Calculate cost with standard rounding (3 decimals)
  → Write immutable BillingSnapshot with line_items JSONB
  → Kill switch check (BILLING_SNAPSHOT_ENABLED)
  → Duplicate detection (throw if same window + pricing version exists)
```

**Key properties:**
- Immutable after creation (status: draft → finalized is the only allowed transition)
- Deterministically reproducible from usage_records + pricing version
- Line items: { provider, model, totalTokens, totalRequests, pricePerThousandTokens, costUSD }
- Hardcoded pricing: `anthropic/claude-3-5-sonnet-20241022` at $0.01/1K tokens, `stub/stub` at $0.00
- Kill switch integration for safety

**Reuse for BILLING-READY-01:** Pricing version concept is directly reusable. The `pricingVersion` pattern extends naturally to credit rate versions. No changes needed for types-only work.

---

## 8. Existing Invoice Flow

```
InvoiceService.createFromSnapshot(snapshotId)
  → Kill switch check (INVOICE_GENERATION_ENABLED)
  → Load BillingSnapshot (read-only)
  → Validate snapshot exists (404 if not)
  → Duplicate check (409 if invoice exists for snapshot)
  → Copy values verbatim from snapshot to invoice (no recalculation)
  → Invoice status: 'draft' only (no payment logic)
  → Persist invoice
```

**Key properties:**
- One-to-one: BillingSnapshot → Invoice (unique constraint on snapshot_id)
- No billing calculations (values copied verbatim)
- No payment logic (Phase 25B-2+ deferred)
- Status: 'draft' only (future: draft, finalized, pending_payment, paid, failed, written_off)
- Kill switch integration

**Reuse for BILLING-READY-01:** Invoice infrastructure exists but is dormant. No changes needed for types-only work. Future credit invoices will use this pipeline.

---

## 9. Existing Quota Enforcement Flow

### api-gateway QuotaService (primary enforcer)

```
Request → QuotaGuard → checkRequestQuota(apiKeyId) [in-memory, per-minute]
                     → checkTokenQuota(apiKeyId, estimated) [in-memory, per-day]
       → SessionQuotaGuard → checkSessionQuota(userId) [DB-backed, max active]
                            → checkRolling24hSessionQuota(userId) [DB-backed]
       → TokenQuotaGuard → checkRolling24hTokenQuota(userId) [DB-backed, SUM usage_records]
```

**Key properties:**
- In-memory rate limits: requests/minute, tokens/day (lost on restart)
- DB-backed session quotas: max active sessions, rolling 24h session count
- DB-backed token quota: rolling 24h token sum from `usage_records`
- Static config: `QuotaConfig` class with env-configurable limits
- Not plan-aware at the guard level (uses flat limits per API key)

### container-manager QuotaEvaluationService (read-only)

```
QuotaEvaluationService.evaluateUserQuota(userId, start, end)
  → Get user plan from SQLite DB
  → Get plan limits from PlanQuotaConfig
  → Aggregate token usage via UsageAggregationService
  → Calculate percentages vs plan limits
  → Return status: OK | WARN | EXCEEDED (read-only, no enforcement)
```

**Key properties:**
- Plan-aware: uses PlanQuotaConfig (free/pro/enterprise limits)
- Read-only: never blocks requests
- SQLite-based token_usage aggregation
- Thresholds: WARN at 80%, EXCEEDED at 100%

### ai-service quota (per-session hard cap)

```
quota.config.ts: MAX_TOKENS_PER_SESSION = 100,000
  → QuotaExceededException thrown when session token limit hit
```

**Reuse for BILLING-READY-01:** The guard infrastructure exists and works. Future credit-based enforcement (BILLING-READY-07) will add a `CreditBudgetGuard` alongside existing guards. No changes needed for types-only work.

---

## 10. Existing Plan Model

### Plan Entity (api-gateway TypeORM)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | varchar(50) | 'free', 'pro', 'enterprise' (unique) |
| name | varchar(120) | Display name |
| maxActiveSessions | integer | Max concurrent sessions |
| maxSessions24h | integer | Max sessions per 24h |
| maxTokens24h | integer | Max tokens per 24h |
| isActive | boolean | Active flag |

### User.planType (api-gateway TypeORM)

- Type: varchar(50), default 'free'
- Values: 'free', 'pro', 'enterprise'
- No CHECK constraint in TypeORM (only in schema.sql)

### PlanQuotaConfig (container-manager, static)

| Plan | maxTokensPerMonth | maxCostUsdPerMonth | maxTerminationsPerMonth |
|------|-------------------|--------------------|------------------------|
| free | 100,000 | $5.00 | 20 |
| pro | 2,000,000 | $100.00 | 200 |
| enterprise | 10,000,000 | $500.00 | 1,000 |

**Gap:** No `monthlyCredits`, no `maxRolloverCredits`, no `allowedAgentIds`, no `overageBehavior`, no `supportTier`. These will be added in BILLING-READY-04 (plan upgrade task).

---

## 11. Existing Frontend Billing/Quota Surfaces

| Surface | Location | Functionality |
|---------|----------|---------------|
| `TokenCounter.tsx` | `frontend/components/` | Displays session token count in workspace header |
| `workspace-quota-usage.logic.ts` | `frontend/components/workspace/` | Parses 429/403 error messages into user-friendly quota/rate-limit guidance |
| `workspace-quota-usage.logic.test.ts` | `frontend/components/workspace/` | 10 tests covering rate-limit/quota error message parsing |
| Agent Registry | `frontend/lib/agent-platform/agent-registry.ts` | Defines agent manifests (4 agents), statuses, tool permissions — no billing gates |

**Gap:** No billing page, no plan selector, no credit balance display, no usage dashboard, no account settings page. These are deferred to BILLING-READY-05.

---

## 12. Service Ownership Boundary Recommendation

| Domain | Recommended Owner | Justification |
|--------|-------------------|---------------|
| **Credit ledger (types, config)** | api-gateway | Already owns billing pipeline, entities, and plan data |
| **Credit balance tracking** | api-gateway | Close to usage_records and billing_snapshots |
| **Credit deduction logic** | api-gateway | Consumes its own usage_records events |
| **Usage event emission** | ai-service (harness audit events) + api-gateway (usage_records) | Each service emits its own structured events |
| **Workspace runtime reporting** | container-manager | Already tracks session lifecycle and terminations |
| **Plan definitions** | api-gateway (Plan entity) + container-manager (PlanQuotaConfig) | api-gateway is source of truth; container-manager has a read-only copy |
| **Quota enforcement** | api-gateway (guards) | Already enforces all pre-execution quota checks |
| **Billing visibility** | api-gateway (BillingVisibilityService) | Already provides read-only snapshot access |
| **Frontend display** | frontend | Read-only consumer of api-gateway billing APIs |

### Clean Ownership Boundaries

- **ai-service:** Only emits usage events (harness audit events with tokensUsed, toolCallCount). Never reads or writes credit balance.
- **container-manager:** Only reports runtime usage (session lifecycle, termination events). Never reads or writes credit balance. Maintains a read-only `PlanQuotaConfig` for evaluation purposes.
- **api-gateway:** Owns the credit ledger, plan definitions, billing pipeline, and enforcement guards. Single source of truth for balance.
- **frontend:** Only displays billing state. Never mutates credits directly.

---

## 13. Credit Ledger Placement Recommendation

**The credit ledger should live in api-gateway.**

Rationale:
1. api-gateway already owns `UsageRecord`, `BillingSnapshot`, `Invoice`, `Plan`, `User` entities — all billing-adjacent.
2. api-gateway already owns quota enforcement guards (QuotaGuard, SessionQuotaGuard, TokenQuotaGuard).
3. api-gateway is the orchestration layer that sees all execution events (write-before-call semantics).
4. Placing the credit ledger in api-gateway avoids cross-service transactional coupling.
5. ai-service and container-manager should remain event emitters only, never writing to the credit balance.

For BILLING-READY-01 (types-only), the types/config files live in api-gateway's billing or credit-ledger module directory.

---

## 14. Whether to Create a New Credit Ledger Table

**Not in BILLING-READY-01.**

| Option | When | Risk |
|--------|------|------|
| Option A: TypeScript-only (NO table) | BILLING-READY-01 | Zero migration risk. Types validate at compile time. |
| Option B: Extend existing tables | BILLING-READY-02+ | Low risk but couples credit to existing billing snapshot pipeline |
| Option C: New `credit_ledger` + `credit_deduction_events` tables | BILLING-READY-02 | Medium risk (new migration, new entity). Cleanest design. |

**Recommendation:** BILLING-READY-01 creates TypeScript types and static config only. BILLING-READY-02 introduces the new tables when atomic balance operations are needed.

---

## 15. Entitlement Boundary Recommendations

| Entitlement Type | Where to Check | When to Implement |
|------------------|----------------|-------------------|
| **Plan entitlements** (credit budget) | api-gateway `CreditBudgetGuard` (new, pre-execution) | BILLING-READY-07 |
| **Agent access** | api-gateway `AgentAccessGuard` (new, pre-execution) | BILLING-READY-03 |
| **Tool access** | ai-service harness tool dispatch (before dispatch) | BILLING-READY-03 |
| **Knowledge/collaboration limits** | Future knowledge/collaboration services | Deferred |
| **Session/token quotas** | api-gateway existing guards (already implemented) | Already active |

**What remains deferred:**
- Knowledge processing entitlements (no knowledge service exists)
- Collaboration entitlements (no collaboration service exists)
- Team/org shared credit pools (no org model exists)
- Stripe subscription state sync (no real Stripe connection)

---

## 16. Migration Strategy

### Safest First Implementation Slice (BILLING-READY-01)

Create TypeScript-only domain types and static plan configuration:
1. Credit category enum/type
2. Credit rate configuration (pricing version concept, model tier mapping)
3. Plan definition types with credit allocations
4. Credit ledger types (balance, deduction event, allocation)
5. User entitlement types
6. Static plan definitions (Free/Starter/Pro/Team with credit amounts)
7. Credit rate table (per-category, per-model-tier)

**Zero database migration. Zero runtime risk. Pure compile-time validation.**

### What Should NOT Be Migrated Yet

- ❌ No `plan_type` CHECK constraint changes (BILLING-READY-04)
- ❌ No new database tables (BILLING-READY-02)
- ❌ No credit deduction logic (BILLING-READY-02)
- ❌ No entitlement guard enforcement (BILLING-READY-03)
- ❌ No plan upgrade flow (BILLING-READY-04)
- ❌ No Stripe SDK (BILLING-READY-06)
- ❌ No frontend UI (BILLING-READY-05)

### How Current free/pro/enterprise Behavior Is Preserved

- Existing `Plan` entity unchanged
- Existing `User.planType` field unchanged
- Existing `PlanQuotaConfig` in container-manager unchanged
- Existing `QuotaService` in api-gateway unchanged
- Existing guards unchanged
- New credit types are additive — they define the future model without altering current enforcement

### How Free/Starter/Pro/Team Is Introduced Later

- BILLING-READY-04 migrates `plan_type` CHECK constraint and Plan table rows
- Backward compatibility: map existing 'free' → 'free', 'pro' → 'pro', 'enterprise' → 'team' (grandfather)
- Static config in BILLING-READY-01 defines the new plan tiers without database changes

---

## 17. Smallest Safe BILLING-READY-01 Implementation Slice

**Scope:** TypeScript-only credit ledger domain/types/config with no database migration.

### Deliverables

1. `services/api-gateway/src/credit-ledger/types/credit-category.ts` — Credit category enum
2. `services/api-gateway/src/credit-ledger/types/credit-rate.ts` — Credit rate per category per model tier
3. `services/api-gateway/src/credit-ledger/types/credit-ledger.ts` — CreditLedger, CreditDeductionEvent, CreditAllocation types
4. `services/api-gateway/src/credit-ledger/types/plan-definition.ts` — PlanDefinition type with credit allocations
5. `services/api-gateway/src/credit-ledger/types/user-entitlement.ts` — UserEntitlement type
6. `services/api-gateway/src/credit-ledger/types/index.ts` — Barrel export
7. `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` — Static Free/Starter/Pro/Team definitions
8. `services/api-gateway/src/credit-ledger/config/credit-rates.config.ts` — Credit rate table (pricing version '2026-07-v1')
9. `services/api-gateway/src/credit-ledger/config/index.ts` — Barrel export
10. `services/api-gateway/src/credit-ledger/index.ts` — Module barrel export

---

## 18. Files Proposed for BILLING-READY-01

| # | File | Nature |
|---|------|--------|
| 1 | `services/api-gateway/src/credit-ledger/types/credit-category.ts` | New: enum/type |
| 2 | `services/api-gateway/src/credit-ledger/types/credit-rate.ts` | New: interface |
| 3 | `services/api-gateway/src/credit-ledger/types/credit-ledger.ts` | New: interfaces |
| 4 | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | New: interface |
| 5 | `services/api-gateway/src/credit-ledger/types/user-entitlement.ts` | New: interface |
| 6 | `services/api-gateway/src/credit-ledger/types/index.ts` | New: barrel |
| 7 | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | New: static config |
| 8 | `services/api-gateway/src/credit-ledger/config/credit-rates.config.ts` | New: static config |
| 9 | `services/api-gateway/src/credit-ledger/config/index.ts` | New: barrel |
| 10 | `services/api-gateway/src/credit-ledger/index.ts` | New: module barrel |

**No existing files modified. No database files modified. No migration files created.**

---

## 19. Tests Proposed for BILLING-READY-01

| # | Test File | What It Tests |
|---|-----------|---------------|
| 1 | `services/api-gateway/src/credit-ledger/__tests__/plan-definitions.config.spec.ts` | All plans have valid credit allocations; all required fields present; credit values are positive; plan codes are unique |
| 2 | `services/api-gateway/src/credit-ledger/__tests__/credit-rates.config.spec.ts` | All credit categories have rates; all model tiers have rates; rates are positive numbers; pricing version is set |
| 3 | `services/api-gateway/src/credit-ledger/__tests__/credit-category.spec.ts` | Category enum/const completeness matches audit document categories |

**Test nature:** Unit tests only. No database. No HTTP. No mocks of external services. Pure TypeScript type/config validation.

---

## 20. Validation Commands Proposed for BILLING-READY-01

```powershell
# TypeScript compilation check (entire api-gateway)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit

# Run credit-ledger unit tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPattern="credit-ledger"

# Full api-gateway test suite (regression check)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test

# Build check
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

---

## 21. Explicit Non-Goals for BILLING-READY-01

- ❌ No database migration
- ❌ No new database tables
- ❌ No schema.sql changes
- ❌ No existing entity modifications
- ❌ No credit deduction logic
- ❌ No credit balance operations (allocate, deduct, getBalance)
- ❌ No entitlement enforcement
- ❌ No guard modifications
- ❌ No plan_type migration
- ❌ No Stripe SDK
- ❌ No payment provider changes
- ❌ No frontend changes
- ❌ No container-manager changes
- ❌ No ai-service changes
- ❌ No runtime commands (queues, workers)
- ❌ No Agent Harness activation
- ❌ No AGENT-HARNESS-06C registration

---

## 22. Risk Assessment

### Data Model Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Credit types become misaligned with future DB schema | Low | Types are designed to match the CreditLedger and CreditDeductionEvent models from BILLING-READY-00 audit. DB schema will be derived from these types. |
| Plan definitions change before DB implementation | Low | Static config is version-controlled and cheap to update. No runtime dependency. |
| Credit rates need adjustment before enforcement | Low | Rates are static config, easily updated. Pricing version pattern enables versioned changes. |

### Entitlement Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Agent access entitlement types don't match future registry | Low | Types reference `AgentId` from existing `agent-registry.ts`. Alignment is straightforward. |
| Tool access categories evolve before enforcement | Low | Tool categories in types match existing harness tool permissions. |

### Billing Correctness Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| No runtime correctness risk in types-only slice | None | Zero runtime behavior change. Pure compile-time artifacts. |
| Credit rates may not reflect actual costs | Low | Rates are directional (from BILLING-READY-00 audit). Keith must approve final rates. |

### Migration Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Zero migration risk for types-only slice | None | No database operations. |
| Future plan_type migration may conflict | Low | BILLING-READY-01 does not touch plan_type. Migration deferred to BILLING-READY-04. |

### Stripe Deferral Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Types reference Stripe IDs but Stripe is a stub | Low | Stripe fields are optional/nullable in types. No Stripe calls possible. |
| No real payment testing possible | Accepted | Explicitly deferred to BILLING-READY-06. Credits are internal-only until Stripe integration. |

---

## 23. Proceed / Do Not Proceed Recommendation

**PROCEED with BILLING-READY-01 using Option A (TypeScript-only credit ledger domain/types/config with no database migration).**

Justification:
1. Zero runtime risk (no database, no migrations, no enforcement changes)
2. Establishes the canonical credit model types that all future BILLING-READY tasks will import
3. Static plan definitions codify the Free/Starter/Pro/Team model from BILLING-READY-00 audit
4. Credit rate table establishes versioned pricing before any deduction logic exists
5. Unit tests validate type/config correctness at build time
6. The alternative (Option B: extend existing tables, or Option C: new tables) introduces migration risk too early — domain types should be validated before schema is committed

---

## 24. Acceptance Criteria Mapping

- [x] Existing billing modules inspected (sections 3, 5–9)
- [x] Existing database/schema billing tables inspected (section 4)
- [x] Existing usage ledger flow documented (section 5)
- [x] Existing token usage flow documented (section 6)
- [x] Existing billing snapshot flow documented (section 7)
- [x] Existing invoice flow documented (section 8)
- [x] Existing quota enforcement flow documented (section 9)
- [x] Existing plan model documented (section 10)
- [x] Existing frontend billing/quota surfaces inspected (section 11)
- [x] Service ownership boundaries recommended (section 12)
- [x] Credit ledger placement recommended (section 13)
- [x] Entitlement boundary recommendations documented (section 15)
- [x] Migration strategy recommended (section 16)
- [x] Smallest safe BILLING-READY-01 implementation slice proposed (section 17)
- [x] Focused test strategy proposed (section 19)
- [x] Risk assessment completed (section 22)
- [x] No implementation performed
- [x] Review document created

---

## Document Metadata

- **Created:** 2026-07-06
- **Task:** BILLING-READY-01A
- **Status:** COMPLETE — ready for Keith review
- **Author:** AI-assisted architecture review
- **Source:** Existing codebase inspection, BILLING-READY-00 audit document, governance docs
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP
