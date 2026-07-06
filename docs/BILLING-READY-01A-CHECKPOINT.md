# BILLING-READY-01A — Consolidation / Checkpoint

**Task ID:** BILLING-READY-01A
**Family:** BILLING / COMMERCIAL READINESS
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-06
**Nature:** READ-ONLY ARCHITECTURE REVIEW — no implementation
**Checkpoint document:** `docs/BILLING-READY-01A-CHECKPOINT.md`
**Architecture review document:** `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md`

---

## 1. Task Summary

BILLING-READY-01A was a read-only architecture review of the existing billing, usage, quota, invoice, plan, and service boundary infrastructure in the ainow.biz codebase. It was registered on 2026-07-06 following Keith's explicit decision to proceed with a deeper architecture review before implementing any credit ledger code.

The review inspected all existing billing-related services, database tables, TypeORM entities, quota enforcement flows, token tracking flows, billing snapshot flows, invoice flows, service ownership boundaries, and entitlement gaps. It produced a comprehensive architecture review document (`docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md`) and recommended Option A (TypeScript-only credit ledger domain/types/config with no database migration) as the safest first implementation slice for BILLING-READY-01.

All 18 Review Acceptance Criteria were satisfied. No implementation occurred. No runtime commands were executed.

---

## 2. Exact Files Changed

### During Registration (prior step — same window)
- `TASKS.md` — BILLING-READY-01A registered
- `TASKS_BACKLOG_FULL.md` — BILLING-READY-01A mirrored
- `docs/AINOW-EXECUTION-ROADMAP.md` — BILLING-READY-01A set to ACTIVE

### During Architecture Review Pass
- `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md` — created (review document, 24 sections, 644 lines)

### During This Consolidation
- `docs/BILLING-READY-01A-CHECKPOINT.md` — created (this file)
- `TASKS.md` — BILLING-READY-01A status updated to COMPLETE and LOCKED
- `TASKS_BACKLOG_FULL.md` — BILLING-READY-01A status updated to COMPLETE and LOCKED
- `docs/AINOW-EXECUTION-ROADMAP.md` — BILLING-READY-01A updated to COMPLETE and LOCKED; BILLING-READY-01 recorded as next recommended (not registered)

### Files NOT Changed
- No source files (`services/`, `frontend/`) modified
- No test files modified
- No package files modified (`package.json`, `package-lock.json`)
- No environment files modified (`.env`, `.env.*`)
- No Docker files modified
- No database schema files modified
- No migration files modified

---

## 3. Architecture Review Document Reference

**Primary artifact:** `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md`

24-section architecture review document covering:
- Executive summary and key findings (section 1)
- All files inspected (section 2)
- Current billing architecture map with ASCII diagram (section 3)
- Database/schema inventory — billing-relevant tables (section 4)
- Existing usage ledger flow (section 5)
- Existing token usage flow (section 6)
- Existing billing snapshot flow (section 7)
- Existing invoice flow (section 8)
- Existing quota enforcement flow — api-gateway, container-manager, ai-service (section 9)
- Existing plan model — Plan entity, PlanQuotaConfig, User.planType (section 10)
- Existing frontend billing/quota surfaces (section 11)
- Service ownership boundary recommendation (section 12)
- Credit ledger placement recommendation (section 13)
- Whether to create a new credit ledger table (section 14)
- Entitlement boundary recommendations (section 15)
- Migration strategy (section 16)
- Smallest safe BILLING-READY-01 implementation slice (section 17)
- Exact files proposed for BILLING-READY-01 (section 18)
- Tests proposed for BILLING-READY-01 (section 19)
- Validation commands proposed for BILLING-READY-01 (section 20)
- Explicit non-goals for BILLING-READY-01 (section 21)
- Risk assessment (section 22)
- Proceed/do-not-proceed recommendation (section 23)
- Acceptance criteria mapping (section 24)

---

## 4. Current Billing Architecture Summary

The ainow.biz billing infrastructure is concentrated in **api-gateway** (NestJS):

- **UsageLedgerService** — two-phase write (intent → result), immutable append-only, idempotent via requestId
- **BillingSnapshotService** — periodic aggregation from usage_records; immutable once written; kill-switch guarded
- **InvoiceService** — one invoice per snapshot (draft-only); no payment logic; kill-switch guarded
- **TokenUsageService** — per-session per-message token tracking (input/output split)
- **QuotaService** — in-memory rolling rate limits + DB-backed session/token quotas
- **BillingVisibilityService** — read-only snapshot queries for frontend consumption
- **StripePaymentProvider** — safe zero-call stub; no Stripe API calls at runtime
- **Plan entity** — TypeORM entity: free/pro/enterprise plan codes with session and token limits

**container-manager** maintains a read-only static `PlanQuotaConfig` and `QuotaEvaluationService` (read-only plan-aware evaluation, never enforces).

**ai-service** emits structured `HarnessAuditEvents` per harness iteration (tokensUsed, cumulativeTokensUsed, toolCallCount, durationMs) and enforces a hard 100K per-session token cap.

**frontend** has no billing page; only `TokenCounter.tsx` (workspace header token count) and `workspace-quota-usage.logic.ts` (quota error message parsing).

**No credit ledger, no credit balance, no credit deduction logic exists anywhere in the codebase.**

---

## 5. Database/Schema Findings Summary

### Billing-Relevant Tables (all in PostgreSQL unless noted)

| Table | Status | Reusable for Billing |
|-------|--------|---------------------|
| `users` (plan_type, plan_status, stripe_customer_id) | Active | Yes — extend plan_type values at BILLING-READY-04 |
| `plans` (code, name, max_active_sessions, max_sessions_24h, max_tokens_24h) | Active (TypeORM) | Yes — add credit allocation columns at BILLING-READY-04 |
| `usage_records` (execution_id, user_id, tokens_used, provider, model, execution_status) | Active (TypeORM, immutable) | Yes — source of truth for credit deduction events |
| `billing_snapshots` (period, pricing_version, line_items, total_cost_usd) | Active (TypeORM, immutable) | Yes — aggregation layer |
| `invoices` (TypeORM: snapshot_id, total_cost_usd, status=draft) | Active (TypeORM, draft-only) | Yes — billing output layer |
| `token_usage` (session_id, user_id, model, input/output_tokens, cost_usd) | Active (Postgres + SQLite) | Yes — per-session accounting |
| `usage_quotas` (tokens_used_month, tokens_limit_month, storage_gb) | Schema exists, uncertain active use | Candidate for future credit balance |
| `subscriptions` (stripe_subscription_id, plan_type, period) | Schema exists (no Stripe calls) | Reuse when Stripe integrated |
| `resource_usage` (cpu_seconds, memory_mb_hours, disk_gb_hours) | Schema exists | Reuse for workspace_runtime credit category |

### Key Finding: No Credit Ledger Table
No `credit_ledger`, `credit_balance`, or `credit_deduction_events` table exists. **Not needed for BILLING-READY-01** (TypeScript-only types). A new `credit_ledger` + `credit_deduction_events` table pair will be needed at BILLING-READY-02 for atomic balance decrements.

---

## 6. Existing Usage Ledger Flow Summary

```
Client request → QuotaGuard (pre-flight check)
  → UsageLedgerService.writeExecutionIntent() [status: 'pending']
  → ai-service call
  → UsageLedgerService.updateExecutionResult() [status: 'completed', tokens_used populated]
  → OrphanReconciliationWorker (background) [marks stale 'pending' → 'timeout']
```

**Key properties:** Two-phase write (intent before AI call, result after success). Immutable append-only ledger. Idempotent retries via `requestId` (unique constraint on user_id + request_id). Orphan cleanup via background worker. The `UsageRecord` entity is the authoritative execution event source for future credit deduction.

---

## 7. Existing Token Usage Flow Summary

```
AI execution completes → TokenUsageService.recordTokenUsage()
  → TokenUsageRepository (writes to token_usage table)
  → Fields: session_id, model, input_tokens, output_tokens, total_tokens
```

**Key properties:** Per-session, per-message granularity. Records input/output tokens separately (richer than usage_records which only stores total). Used by container-manager's UsageAggregationService for plan-based quota evaluation. No credit deduction logic. `usage_records` (not `token_usage`) is the better source for credit billing due to idempotency and execution status lifecycle.

---

## 8. Existing Billing Snapshot Flow Summary

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

**Key properties:** Immutable after creation (draft → finalized only allowed transition). Deterministically reproducible from usage_records + pricing version. Hardcoded pricing: `anthropic/claude-3-5-sonnet-20241022` at $0.01/1K tokens, `stub/stub` at $0.00. Kill switch integration. The `pricingVersion` pattern extends naturally to credit rate versions.

---

## 9. Existing Invoice Flow Summary

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

**Key properties:** One-to-one BillingSnapshot → Invoice (unique constraint on snapshot_id). No billing calculations (values copied verbatim). No payment logic (deferred to BILLING-READY-06+). Status: 'draft' only. Kill switch integration. Invoice infrastructure exists but is dormant — future credit invoices will reuse this pipeline.

---

## 10. Existing Quota Enforcement Flow Summary

**api-gateway QuotaService (primary enforcer):**
```
Request → QuotaGuard → checkRequestQuota(apiKeyId) [in-memory, per-minute]
                     → checkTokenQuota(apiKeyId, estimated) [in-memory, per-day]
       → SessionQuotaGuard → checkSessionQuota(userId) [DB-backed, max active]
                            → checkRolling24hSessionQuota(userId) [DB-backed]
       → TokenQuotaGuard → checkRolling24hTokenQuota(userId) [DB-backed, SUM usage_records]
```
In-memory rate limits lost on restart. DB-backed session/token quotas. Static config with env-configurable limits. Not plan-aware at the guard level (flat limits per API key).

**container-manager QuotaEvaluationService (read-only, plan-aware):** evaluates user quota vs plan limits; returns OK/WARN/EXCEEDED; never blocks requests.

**ai-service:** Hard cap of 100K tokens per session (`QuotaExceededException` on breach).

Future credit-based enforcement (`CreditBudgetGuard`) will be added alongside existing guards at BILLING-READY-07. No guard changes needed for BILLING-READY-01.

---

## 11. Existing Plan Model Summary

**Plan Entity (api-gateway TypeORM):** id (UUID), code ('free'/'pro'/'enterprise'), name, maxActiveSessions, maxSessions24h, maxTokens24h, isActive.

**User.planType:** varchar(50), default 'free', values: 'free'/'pro'/'enterprise'. No CHECK constraint in TypeORM (only in schema.sql).

**PlanQuotaConfig (container-manager, static):**
| Plan | maxTokensPerMonth | maxCostUsdPerMonth | maxTerminationsPerMonth |
|------|-------------------|--------------------|------------------------|
| free | 100,000 | $5.00 | 20 |
| pro | 2,000,000 | $100.00 | 200 |
| enterprise | 10,000,000 | $500.00 | 1,000 |

**Gap:** No `monthlyCredits`, no `maxRolloverCredits`, no `allowedAgentIds`, no `overageBehavior`, no `supportTier`. These will be added in BILLING-READY-04.

---

## 12. Service Ownership Boundary Recommendation

| Domain | Recommended Owner | Justification |
|--------|-------------------|---------------|
| Credit ledger (types, config) | **api-gateway** | Already owns billing pipeline, entities, and plan data |
| Credit balance tracking | **api-gateway** | Close to usage_records and billing_snapshots |
| Credit deduction logic | **api-gateway** | Consumes its own usage_records events |
| Usage event emission | **ai-service** (harness audit) + **api-gateway** (usage_records) | Each service emits its own structured events |
| Workspace runtime reporting | **container-manager** | Already tracks session lifecycle and terminations |
| Plan definitions | **api-gateway** (Plan entity, source of truth) + **container-manager** (PlanQuotaConfig, read-only copy) | api-gateway is authoritative |
| Quota enforcement | **api-gateway** (guards) | Already enforces all pre-execution quota checks |
| Billing visibility | **api-gateway** (BillingVisibilityService) | Already provides read-only snapshot access |
| Frontend display | **frontend** | Read-only consumer of api-gateway billing APIs |

**Clean ownership rule:** ai-service emits events only. container-manager reports runtime only. api-gateway owns credit ledger, plan definitions, and enforcement. frontend only displays billing state.

---

## 13. Credit Ledger Placement Recommendation

**The credit ledger lives in api-gateway.**

Rationale: api-gateway owns all billing-adjacent entities (UsageRecord, BillingSnapshot, Invoice, Plan, User), owns quota enforcement guards, is the orchestration layer with write-before-call semantics, and placing credit ledger here avoids cross-service transactional coupling.

For BILLING-READY-01 (types-only), the types/config files live under `services/api-gateway/src/credit-ledger/`.

---

## 14. Entitlement Boundary Recommendations

| Entitlement Type | Where to Check | When to Implement |
|------------------|----------------|-------------------|
| Plan entitlements (credit budget) | api-gateway `CreditBudgetGuard` (new) | BILLING-READY-07 |
| Agent access | api-gateway `AgentAccessGuard` (new) | BILLING-READY-03 |
| Tool access | ai-service harness tool dispatch (before dispatch) | BILLING-READY-03 |
| Knowledge/collaboration limits | Future knowledge/collaboration services | Deferred |
| Session/token quotas | api-gateway existing guards | Already active |

**Deferred:** Knowledge processing entitlements, collaboration entitlements, team/org shared credit pools, Stripe subscription state sync.

---

## 15. Migration Strategy Recommendation

**Safest first slice (BILLING-READY-01):** TypeScript-only domain types and static plan configuration. Zero database migration. Zero runtime risk. Pure compile-time validation. Current free/pro/enterprise behavior is fully preserved — all existing entities, guards, and configs are unchanged. New credit types are additive only.

**What NOT to migrate yet:**
- No `plan_type` CHECK constraint changes (BILLING-READY-04)
- No new database tables (BILLING-READY-02)
- No credit deduction logic (BILLING-READY-02)
- No entitlement guard enforcement (BILLING-READY-03)
- No plan upgrade flow (BILLING-READY-04)
- No Stripe SDK (BILLING-READY-06)
- No frontend UI (BILLING-READY-05)

**How Free/Starter/Pro/Team is introduced later:** BILLING-READY-04 migrates `plan_type` CHECK constraint and Plan table rows. Backward compatibility: map existing 'free' → 'free', 'pro' → 'pro', 'enterprise' → 'team' (grandfathered). Static config in BILLING-READY-01 defines new plan tiers without any database changes.

---

## 16. Recommended BILLING-READY-01 Strategy

**Option A — TypeScript-only credit ledger domain/types/config with no database migration.**

Rationale:
1. Zero runtime risk (no database, no migrations, no enforcement changes)
2. Establishes canonical credit model types that all future BILLING-READY tasks will import
3. Static plan definitions codify the Free/Starter/Pro/Team model from BILLING-READY-00 audit
4. Credit rate table establishes versioned pricing before any deduction logic exists
5. Unit tests validate type/config correctness at build time
6. Option B (extend existing tables) or Option C (new tables) introduces migration risk too early — domain types should be validated before schema is committed

---

## 17. Exact Files Proposed for BILLING-READY-01

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

No existing files modified. No database files modified. No migration files created.

---

## 18. Exact Tests Proposed for BILLING-READY-01

| # | Test File | What It Tests |
|---|-----------|---------------|
| 1 | `services/api-gateway/src/credit-ledger/__tests__/plan-definitions.config.spec.ts` | All plans have valid credit allocations; all required fields present; credit values are positive; plan codes are unique |
| 2 | `services/api-gateway/src/credit-ledger/__tests__/credit-rates.config.spec.ts` | All credit categories have rates; all model tiers have rates; rates are positive numbers; pricing version is set |
| 3 | `services/api-gateway/src/credit-ledger/__tests__/credit-category.spec.ts` | Category enum/const completeness matches audit document categories |

**Test nature:** Unit tests only. No database. No HTTP. No mocks of external services. Pure TypeScript type/config validation.

---

## 19. Validation Plan Proposed for BILLING-READY-01

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

## 20. Risk Assessment Summary

| Risk | Level | Mitigation |
|------|-------|------------|
| Credit types misaligned with future DB schema | Low | Types designed from BILLING-READY-00 audit and BILLING-READY-01A review; DB schema will be derived from these types at BILLING-READY-02 |
| Plan definitions change before DB implementation | Low | Static config is version-controlled; cheap to update; no runtime dependency |
| Credit rates need adjustment before enforcement | Low | Rates are static config; pricing version pattern enables versioned changes |
| Agent access entitlement types don't match future registry | Low | Types reference `AgentId` from existing `agent-registry.ts` |
| No runtime correctness risk in types-only slice | None | Zero runtime behavior change — pure compile-time artifacts |
| Zero migration risk for types-only slice | None | No database operations |
| Future plan_type migration may conflict | Low | BILLING-READY-01 does not touch plan_type; migration deferred to BILLING-READY-04 |
| Types reference Stripe IDs but Stripe is a stub | Low | Stripe fields are optional/nullable; no Stripe calls possible |

---

## 21. Confirmation: No Implementation Occurred

**Confirmed.** BILLING-READY-01A was read-only architecture review only.

- Zero source files changed (`services/api-gateway/`, `services/ai-service/`, `services/container-manager/`, `frontend/`).
- Zero test files added or modified.
- Zero package files changed.
- Zero database schema or migration files changed.
- Zero environment files changed.
- Zero Docker files changed.
- The only files changed during the review pass were governance/documentation files: `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md` (created).
- During this consolidation: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md`, and this checkpoint file only.

---

## 22. Confirmation: No Stripe/Payment/Provider Calls Occurred

**Confirmed.** No Stripe API calls were made. No payment provider calls were made. No external API calls of any kind were made during this task. `StripePaymentProvider` remains a safe zero-call stub. No Stripe API keys were consumed or referenced at runtime. The review only read existing source files — it made no runtime calls of any kind.

---

## 23. Confirmation: No Agent Harness Activation Occurred

**Confirmed.** `AGENT_HARNESS_ENABLE_TOOL_LOOP` was not set to `true`. The Agent Harness tool loop was not activated at any point during BILLING-READY-01A. No canary execution occurred. No harness iterations executed.

---

## 24. Confirmation: BILLING-READY-01 Remains Unregistered

**Confirmed.** BILLING-READY-01 (Credit Ledger Foundation) was not registered during BILLING-READY-01A or during this consolidation. It is recorded as the recommended next task only. It does not appear as an active or registered task in TASKS.md or TASKS_BACKLOG_FULL.md. Registration requires Keith's explicit decision.

---

## 25. Confirmation: AGENT-HARNESS-06C Remains Unregistered

**Confirmed.** AGENT-HARNESS-06C (Read-Only Harness Canary Execution) was not registered during BILLING-READY-01A or during this consolidation. It remains deferred as an explicit future decision for Keith. It appears only as a reference in prior task sections — it is not an active or registered task.

---

## 26. Remaining Risks

| Risk | Level | Notes |
|------|-------|-------|
| Credit rates not finalized | Low | Rates in review document are directional. Keith must approve final rates at BILLING-READY-01. |
| Plan pricing not finalized | Low | Price points are directional (~$19–29, ~$79–99, ~$299–499). Keith must approve at BILLING-READY-01. |
| Multi-tenant / org model complexity | Medium | Team plan requires org/tenant entity. BILLING-READY-08 is a significant scope item. |
| Stripe integration timeline | Medium | Deferred to BILLING-READY-06 or later. No real payments possible until then. |
| Existing free/pro/enterprise plan migration | Medium | Existing users on `enterprise` plan must be migrated or grandfathered at BILLING-READY-04. |
| No frontend billing UI | Medium | Users have no visibility into credits until BILLING-READY-05. |
| Knowledge/collaboration credit attribution | Low | Open question: which tenant owns credits for collaboration actions. |
| AGENT-HARNESS-06C remains deferred | Low | Canary execution is not blocked by billing work but remains an open decision item. |

---

## 27. Next Recommended Task

**BILLING-READY-01 — Credit Ledger Foundation**

Strategy: Option A — TypeScript-only credit ledger domain/types/config with no database migration.

Scope (10 new files, all under `services/api-gateway/src/credit-ledger/`):
- 5 TypeScript type files (credit-category, credit-rate, credit-ledger, plan-definition, user-entitlement)
- 2 static config files (plan-definitions.config, credit-rates.config)
- 3 barrel exports (types/index, config/index, module index)
- 3 unit test files (plan-definitions.config.spec, credit-rates.config.spec, credit-category.spec)

Validation: `npx tsc --noEmit` + `npx jest --testPathPattern="credit-ledger"` + `npm test` + `npm run build`.

**Status: Proposed only — not registered. Requires Keith's explicit decision to register.**

---

## 28. Final Status

| Item | Status |
|------|--------|
| BILLING-READY-01A | **COMPLETE and LOCKED** |
| Architecture review document | COMPLETE — `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md` |
| Checkpoint document | COMPLETE — `docs/BILLING-READY-01A-CHECKPOINT.md` (this file) |
| All 18 review acceptance criteria | ALL `[x]` CONFIRMED |
| Implementation performed | NONE |
| Stripe/payment/provider calls | NONE |
| Agent Harness activated | NO |
| BILLING-READY-01 registered | NO — proposed only, requires Keith decision |
| AGENT-HARNESS-06C registered | NO — remains deferred |
| Follow-up tasks registered | NONE |
| Subagents used | NONE |
| Recommended next task | BILLING-READY-01 — Credit Ledger Foundation (Option A) |

---

*Checkpoint created: 2026-07-06*
*Governed by: CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP*
