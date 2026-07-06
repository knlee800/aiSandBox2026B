# BILLING-READY-00 — Billing, Plan, Credit, and Entitlement Audit

**Task ID:** BILLING-READY-00
**Family:** BILLING / COMMERCIAL READINESS
**Status:** ACTIVE — planning pass
**Created:** 2026-07-06
**Nature:** PLANNING/GOVERNANCE — documentation only, no implementation
**Authority:** Follows ROADMAP-00, governed by AGENT-PLATFORM-00 master plan

---

## 1. Executive Summary

ainow.biz is evolving from a standalone AI coding sandbox (aiSandBox) into a general-purpose multi-agent work platform. This audit inspects all existing billing, plan, quota, usage, and entitlement surfaces across the codebase, identifies gaps for commercial readiness, and proposes the Free / Starter / Pro / Team plan model with monthly credits.

Key findings:

- **Existing token-level usage recording is mature.** The `UsageRecord` entity with two-phase write, idempotency, and orphan reconciliation provides a solid foundation.
- **Existing billing snapshots and invoices are stub-level.** The snapshot/invoice pipeline exists as infrastructure but with no real payment integration.
- **Existing plan model is limited.** The `plans` table and `plan_type` field use a simple `free / pro / enterprise` enum. No credit ledger. No monthly credit allocation.
- **Existing quota enforcement is session/token-focused.** Quotas enforce session count and token consumption per 24h rolling window. No credit-based enforcement.
- **Stripe integration is a stub.** `StripePaymentProvider` makes zero API calls. Safe to deploy, no side effects.
- **No entitlement gates for agent access, knowledge, collaboration, or tool scope.** These are not yet built.
- **No frontend billing/account/settings UI exists.** The app has no user-facing billing page.

This document defines the proposed credit model, entitlement model, and implementation roadmap without implementing any of it.

---

## 2. Existing Billing-Related Surface Inventory

### 2.1 Database Tables (from `database/schema.sql` and migrations)

| Table | Purpose | Status |
|-------|---------|--------|
| `users` | Stores `plan_type`, `plan_status`, `stripe_customer_id` | Active |
| `plans` | Plan definitions: code, name, `max_active_sessions`, `max_sessions_24h`, `max_tokens_24h` | Active (migration `1771589000000`) |
| `usage_quotas` | Token/session/storage limits per user with monthly reset | Schema exists, uncertain active use |
| `subscriptions` | `stripe_subscription_id`, plan_type, period | Schema exists (no active Stripe calls) |
| `invoices` (schema.sql) | Stripe-oriented invoice table with amount_usd, period | Legacy schema |
| `token_usage` | Per-session token consumption records (input/output/cost) | Active (sqlite + postgres) |
| `resource_usage` | CPU/memory/disk/network per session | Schema exists |
| `usage_records` | Two-phase immutable execution ledger (api-gateway TypeORM) | Active |
| `billing_snapshots` | Point-in-time cost aggregation from usage_records | Active |
| `invoices` (api-gateway TypeORM) | Derived from billing snapshots, status: draft only | Active (no payment) |

### 2.2 Backend Services (api-gateway)

| Service/Module | Path | Purpose |
|----------------|------|---------|
| `UsageLedgerService` | `services/api-gateway/src/usage-ledger/` | Write/query immutable usage records |
| `BillingSnapshotService` | `services/api-gateway/src/billing/` | Generate billing snapshots from usage records |
| `BillingVisibilityService` | `services/api-gateway/src/billing-visibility/` | Read-only snapshot visibility for cost transparency |
| `InvoiceService` | `services/api-gateway/src/invoice/` | Create invoices from snapshots (draft-only) |
| `InvoicesService` (legacy) | `services/api-gateway/src/invoices/` | Older invoice service |
| `QuotaService` | `services/api-gateway/src/quota/` | In-memory rate/token quota + DB session quotas |
| `QuotaGuard` | `services/api-gateway/src/quota/` | Pre-execution quota enforcement |
| `SessionQuotaGuard` | `services/api-gateway/src/quota/` | Session-level quota enforcement |
| `TokenUsageService` | `services/api-gateway/src/token-usage/` | Session-based token recording |
| `AdminService` | `services/api-gateway/src/admin/` | Admin reporting/reconciliation |
| `StripePaymentProvider` | `services/api-gateway/src/payments/providers/` | Stub (zero API calls) |
| `PaymentsModule` | `services/api-gateway/src/payments/` | Provider abstraction shell |

### 2.3 Backend Services (container-manager)

| Service | Path | Purpose |
|---------|------|---------|
| `PlanQuotaConfig` | `services/container-manager/src/config/plan-quota.config.ts` | Static plan limits (free/pro/enterprise) |
| `QuotaEvaluationService` | `services/container-manager/src/usage/quota-evaluation.service.ts` | Read-only quota status evaluation |
| `UsageAggregationService` | `services/container-manager/src/usage/usage-aggregation.service.ts` | Token/governance/session aggregation |
| `BillingExportController` | `services/container-manager/src/billing/` | Internal billing data export |

### 2.4 Backend Services (ai-service)

| Service | Path | Purpose |
|---------|------|---------|
| `quota.config.ts` | `services/ai-service/src/config/` | Per-session token limits (100K) |
| `QuotaService` | `services/ai-service/src/quota/` | AI-service quota checks |
| `HarnessAuditEvents` | `services/ai-service/src/agent-harness/audit/` | Structured execution audit (tokens, duration, tool calls) |

### 2.5 Frontend Surfaces

| Component/Logic | Path | Purpose |
|-----------------|------|---------|
| `TokenCounter.tsx` | `frontend/components/` | Display token count in workspace |
| `workspace-quota-usage.logic.ts` | `frontend/components/workspace/` | Parse rate-limit/quota error messages for UX |
| No billing/account/settings page | — | Does not exist |

---

## 3. Existing Auth/User Model Summary

| Aspect | Current State |
|--------|--------------|
| User entity | `User` with UUID, email, passwordHash, role (admin/user/beta), planType (free/pro/enterprise), planStatus (active/cancelled/expired), stripeCustomerId |
| Auth providers | Google, Apple, email/password. Multi-provider via `OauthAccount` entity |
| Session model | Cookie-based (`aisandbox_session`), CSRF protection, API key auth |
| Role model | `admin`, `user`, `beta` — flat role enum |
| Plan field | `plan_type` VARCHAR on users table (free/pro/enterprise) |
| Plan status | `plan_status` VARCHAR (active/cancelled/expired) |

---

## 4. Existing Session/Workspace Ownership Model Summary

| Aspect | Current State |
|--------|--------------|
| Session table | `sessions` with user_id FK, container_id, status, expires_at, resource_limits JSONB |
| Project table | `projects` with user_id FK. Projects own checkpoints via storage_path |
| Workspace entity | `Workspace` entity with user_id FK (one-to-many from User) |
| Container lifecycle | Container-manager creates/stops containers per session. Internal API to api-gateway |
| Ownership isolation | User owns sessions → sessions own containers. No cross-user access |
| Multi-tenant | Not explicit in schema (single-user per account). No org/team table |

---

## 5. Existing Entitlement/Quota Enforcement Points

| Enforcement Point | Location | What It Enforces |
|-------------------|----------|------------------|
| `QuotaGuard` | api-gateway | Requests per minute, tokens per day (in-memory, per apiKeyId) |
| `SessionQuotaGuard` | api-gateway | Max active sessions per user (DB-backed) |
| Session rolling 24h | api-gateway `QuotaService` | Max sessions in 24h window |
| Token rolling 24h | api-gateway `QuotaService` | Max tokens in 24h window |
| Per-session token limit | ai-service `quota.config.ts` | 100K tokens per session hard cap |
| `QuotaEvaluationService` | container-manager | Read-only evaluation (no enforcement) |
| Rate limit guard | api-gateway `rate-limit.guard.ts` | Global rate limiting |
| Public API rate limit | api-gateway `public-api-rate-limit.guard.ts` | Public API throttle |
| Kill switch | api-gateway `kill-switch.config.ts` | Emergency kill switch |
| Execution safety guard | api-gateway `execution-safety.guard.ts` | Safety-level enforcement |
| Launch guard | api-gateway `launch.guard.ts` | Session launch gating |

**Gaps:** No enforcement based on plan-level credits. No agent access gate. No knowledge processing gate. No collaboration gate. No tool-scope gate.

---

## 6. Existing Usage/Token Accounting

| Layer | What It Records |
|-------|-----------------|
| `token_usage` table (SQLite) | Per-session: model, input_tokens, output_tokens, cost_usd |
| `usage_records` table (Postgres/TypeORM) | Per-execution: provider, adapter, model, tokens_used, execution_duration_ms, execution_status |
| `resource_usage` table | CPU seconds, memory MB·hours, disk GB·hours, network bytes |
| `BillingSnapshot` entity | Aggregated cost by provider/model per time window |
| `Invoice` entity | Derived from snapshot (draft-only) |
| Harness audit events | Per-iteration: tokensUsed, cumulativeTokensUsed, durationMs, toolCallCount |

**Gaps:** No credit deduction. No monthly credit balance tracking. No per-agent attribution. No knowledge processing cost attribution. No collaboration cost attribution. No tool-call cost attribution separate from token cost.

---

## 7. Existing Database Models Relevant to Billing

Already covered in section 2.1. Key entities:

- `User` (plan_type, plan_status, stripe_customer_id)
- `Plan` (code, max_active_sessions, max_sessions_24h, max_tokens_24h)
- `UsageRecord` (execution_id, tokens_used, provider, model, execution_status)
- `BillingSnapshot` (period, pricing_version, line_items, total_cost_usd)
- `Invoice` (snapshot_id, subtotal_usd, adjustments_usd, total_cost_usd)

---

## 8. Existing API Gateway Boundaries

| Boundary | Description |
|----------|-------------|
| AI execution controller | Pre-execution: quota guard, idempotency guard, abort guard. Post-execution: usage ledger write |
| Session lifecycle | Internal endpoints for session start/stop/error from container-manager |
| Billing visibility controller | Read-only snapshot/breakdown/time-window endpoints |
| Admin controller | Admin reporting, reconciliation, charge readiness |
| Token usage controller | Internal token recording endpoints |
| Public API | Rate-limited public execution endpoint |

---

## 9. Existing ai-service / Agent Harness Accounting Boundaries

| Boundary | Description |
|----------|-------------|
| Worker processor | Routes between harness and plain paths. Emits `route_evaluated` log |
| Harness audit events | `model_invocation_completed`: tokens, cumulative tokens, duration, tool call count |
| Tool dispatch events | Per-tool: duration, result bytes |
| Cumulative token accounting | Harness loop tracks total tokens across iterations |
| Quota exceeded exception | `QuotaExceededException` thrown when session token limit hit |

**Key observation:** The harness already emits structured events with token counts and tool call counts per iteration. These can feed directly into a credit deduction system.

---

## 10. Existing Frontend Account/Settings/Billing Surfaces

**None exist.** The frontend has:
- A token counter component showing session tokens used
- Quota/rate-limit error message parsing in workspace logic
- No billing page, no plan selector, no usage dashboard, no credit display, no settings/account page

---

## 11. Gaps in Current Billing Readiness

| Gap | Description | Impact |
|-----|-------------|--------|
| No credit ledger | No running credit balance per user per billing cycle | Cannot enforce credit-based limits |
| No monthly credit allocation | Plans define token/session limits but not a credit budget | Cannot implement credit model |
| No credit deduction logic | Usage records exist but no credit subtraction happens | Usage is tracked but not billed |
| No plan tiers beyond free/pro/enterprise | Missing Starter/Team. No monthly credit amounts | Cannot offer tiered pricing |
| No agent access entitlements | All users can access Builder Agent regardless of plan | Cannot gate agent access by plan |
| No knowledge processing billing | Knowledge ingestion/summarization has no cost model | Cannot charge for knowledge work |
| No collaboration billing | Multi-agent referrals have no cost attribution | Cannot charge for collaboration |
| No tool-call cost model | Tool calls are counted but not priced separately | Cannot charge per tool call |
| No workspace runtime billing | Container runtime hours not linked to credits | Cannot charge for runtime |
| No frontend billing UI | No plan selection, upgrade, usage dashboard | Users cannot see or manage billing |
| No Stripe integration | Provider is a stub | Cannot accept real payments |
| No webhook handling | No subscription state sync from Stripe | Cannot handle subscription events |
| No team/org model | No multi-seat, shared credits, team ownership | Cannot support Team plan |
| No overage model | No behavior when credits exhausted | Cannot enforce soft/hard stops |

---

## 12. Proposed Free / Starter / Pro / Team Plan Model

| Plan | Target User | Monthly Credits | Monthly Price Direction |
|------|-------------|-----------------|----------------------|
| **Free** | Evaluation, exploration | 500 credits | $0 |
| **Starter** | Solo founder, light usage | 5,000 credits | ~$19–29 |
| **Pro** | Active solo or small team lead | 25,000 credits | ~$79–99 |
| **Team** | Collaborative team (multi-seat) | 100,000 shared credits | ~$299–499 (3–5 seats included) |

### 12.1 Plan Feature Matrix

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Monthly credits | 500 | 5,000 | 25,000 | 100,000 (shared) |
| Agents accessible | Builder only | Builder only | Builder + 1 future agent | All agents |
| Max concurrent sessions | 1 | 3 | 5 | 10 |
| Max workspace storage | 500 MB | 2 GB | 10 GB | 50 GB |
| Knowledge base size | 10 MB | 100 MB | 1 GB | 10 GB |
| Knowledge scopes | Shared only | Shared only | Shared + 1 specialist | All scopes |
| Collaboration referrals/month | 0 | 0 | 50 | Unlimited |
| Premium integrations | None | None | 1 | All |
| Support tier | Community | Email | Priority | Dedicated |
| Credit rollover | No | No | Up to 5,000 | Up to 25,000 |
| Overage behavior | Hard stop | Soft warning + stop | Soft warning + purchase | Soft warning + purchase |

---

## 13. Proposed Monthly Credit Model

### 13.1 Credit as Universal Currency

One credit is a normalized billing unit. All platform operations consume credits at defined rates. Credits abstract away per-model, per-tool, and per-operation pricing complexity from users.

### 13.2 Credit Allocation

- Each plan includes a fixed monthly credit allocation.
- Credits reset at the billing cycle boundary (monthly).
- Unused credits may roll over up to a cap (plan-dependent).
- Additional credit packs can be purchased (future).

### 13.3 Credit Balance Tracking

A **credit ledger** tracks the running balance per user/org per billing cycle:

```
CreditLedger {
  id: string
  tenantId: string
  userId: string
  billingCycleStart: timestamp
  billingCycleEnd: timestamp
  allocatedCredits: number       // monthly allocation
  rolledOverCredits: number      // from prior cycle
  purchasedCredits: number       // add-on purchases
  consumedCredits: number        // sum of all deductions
  remainingCredits: number       // computed: allocated + rolledOver + purchased - consumed
  lastUpdatedAt: timestamp
}
```

### 13.4 Credit Deduction Events

Each credit-consuming action produces a deduction event:

```
CreditDeductionEvent {
  id: string
  ledgerId: string
  tenantId: string
  userId: string
  agentId: string
  sessionId: string | null
  category: CreditCategory        // see section 14
  quantity: number                 // units consumed (tokens, calls, minutes, etc.)
  creditsDeducted: number
  description: string
  sourceEventId: string            // links to usage_record, harness event, etc.
  createdAt: timestamp
}
```

---

## 14. Credit Consumption Categories

| Category | Unit | Rate Direction | Description |
|----------|------|----------------|-------------|
| **model_tokens** | 1K tokens | 1–10 credits per 1K tokens (model-dependent) | LLM input/output tokens consumed by agent model calls |
| **tool_calls** | 1 call | 0.5–2 credits per call (tool-dependent) | Agent tool invocations (file read/write, validation, preview) |
| **workspace_runtime** | 1 minute | 0.1–0.5 credits per minute | Container runtime time |
| **knowledge_ingestion** | 1 document | 5–20 credits per document | Source upload + normalization + chunking |
| **knowledge_summarization** | 1 summary | 2–10 credits per summary | LLM-based summary/key-fact extraction |
| **collaboration_referral** | 1 referral | 3–5 credits per referral | Agent-to-agent referral invocation |
| **collaboration_contribution** | 1 contribution | 1–3 credits per contribution | Agent comment/analysis on work object |
| **validation_action** | 1 run | 1–3 credits per run | Validation runner execution |
| **browser_action** | 1 action | 2–5 credits per action | Browser smoke/interaction |

### 14.1 Model Token Pricing Tiers

| Model Tier | Examples | Credits per 1K tokens |
|------------|----------|----------------------|
| Low-cost | Groq, small models, stubs | 1 credit |
| Standard | Claude 3.5 Haiku, GPT-4o mini | 3 credits |
| Premium | Claude 3.5 Sonnet, GPT-4o | 5 credits |
| High-end | Claude Opus, GPT-4, o1 | 10 credits |

### 14.2 Rate Governance

- Credit rates are defined in a **pricing version** document (versioned, auditable).
- Rate changes require explicit governance approval.
- Existing billing snapshots reference their pricing version for reproducibility.
- Users are notified before rate changes take effect.

---

## 15. Agent Access Entitlement Model

| Plan | Agents Accessible |
|------|-------------------|
| Free | Builder Agent only |
| Starter | Builder Agent only |
| Pro | Builder Agent + 1 additional agent (when available) |
| Team | All agents (Builder + Chief of Staff + Product Strategy + Technology Advisor + future) |

### 15.1 Entitlement Check

```
canAccessAgent(userId, agentId) → boolean
  1. Get user's plan
  2. Get plan's allowedAgentIds
  3. Return agentId ∈ allowedAgentIds
```

### 15.2 Future Agent Unlock

When a new agent becomes active (transitions from `coming_soon` to `active`), users on qualifying plans automatically gain access — no per-user migration required. The entitlement is plan-level, not user-level.

---

## 16. Tool Access Entitlement Model

| Tool Category | Free | Starter | Pro | Team |
|---------------|------|---------|-----|------|
| File read/write | ✓ | ✓ | ✓ | ✓ |
| Validation runner | ✓ | ✓ | ✓ | ✓ |
| Browser smoke | ✗ | ✓ | ✓ | ✓ |
| Preview server | ✓ | ✓ | ✓ | ✓ |
| Knowledge upload | ✗ | Limited (10 docs) | ✓ | ✓ |
| Premium integrations | ✗ | ✗ | 1 connector | All connectors |
| Scheduled jobs | ✗ | ✗ | ✗ | ✓ |

### 16.1 Entitlement Check

Tool access is gated at the platform layer (before tool dispatch), not inside individual agent harness executions. The check references:
1. User's plan
2. Plan's tool entitlements
3. Agent manifest's `toolPermissions`

Both must allow the tool for the dispatch to proceed.

---

## 17. Knowledge Processing Entitlement Model

| Dimension | Free | Starter | Pro | Team |
|-----------|------|---------|-----|------|
| Knowledge base size | 10 MB | 100 MB | 1 GB | 10 GB |
| Max documents | 5 | 50 | 500 | 5,000 |
| Summarization | Manual only | Manual only | Manual + weekly refresh | Manual + daily refresh |
| Specialist scopes | 0 | 0 | 1 | Unlimited |
| Raw content access | No | No | Yes (own scopes) | Yes (all scopes) |
| Connectors | None | None | 1 | All |

### 17.1 Knowledge Credit Consumption

Knowledge processing consumes credits per the rates in section 14:
- Ingestion: document normalization + chunking
- Summarization: LLM calls for summary + key fact extraction
- Refresh: re-processing on schedule

### 17.2 Knowledge Quota Enforcement

When credits are exhausted, knowledge processing jobs are queued but not executed until credits are available. Existing knowledge remains accessible.

---

## 18. Collaboration Entitlement Model

| Dimension | Free | Starter | Pro | Team |
|-----------|------|---------|-----|------|
| Collaboration referrals/month | 0 | 0 | 50 | Unlimited |
| Max agents per collaboration | 1 (self only) | 1 (self only) | 4 | 5 |
| Approval gate access | N/A | N/A | Yes | Yes |
| Shared work objects | N/A | N/A | Yes | Yes |
| Scheduled collaboration scans | N/A | N/A | No | Yes |

### 18.1 Collaboration Credit Consumption

Each collaboration action that invokes an agent consumes credits (referral invocation, agent comment generation). The costs are defined in section 14.

### 18.2 Collaboration Safety Interaction

Collaboration safety limits (section 8 of AGENT-COLLAB-00) remain enforced regardless of plan level. No plan can override safety limits.

---

## 19. Harness/Canary Entitlement Relationship

| Aspect | Relationship |
|--------|--------------|
| Harness availability | The Agent Harness tool loop is a platform capability, not a plan entitlement. It is gated by `AGENT_HARNESS_ENABLE_TOOL_LOOP`, not by plan |
| Harness credit consumption | When active, harness tool loop iterations consume credits via model_tokens and tool_calls categories |
| Canary execution | AGENT-HARNESS-06C (canary execution) is a development/validation task, not a user-facing feature. Not billed |
| Harness audit events | Feed into credit deduction system — `model_invocation_completed` provides tokens_used, `tool_dispatch_completed` provides tool call count |

---

## 20. Usage Event Model

All billable platform activity produces a **UsageEvent** that feeds into the credit ledger:

```
UsageEvent {
  id: string
  tenantId: string
  userId: string
  agentId: string | null
  sessionId: string | null
  executionId: string | null
  eventType: UsageEventType
  category: CreditCategory
  quantity: number
  metadata: Record<string, unknown>
  createdAt: timestamp
}

UsageEventType:
  'ai_execution'
  'tool_dispatch'
  'workspace_runtime_tick'
  'knowledge_ingestion'
  'knowledge_summarization'
  'collaboration_referral'
  'collaboration_contribution'
  'validation_run'
  'browser_action'
```

### 20.1 Event Sources

| Event Type | Source System | Existing Data |
|------------|--------------|---------------|
| `ai_execution` | api-gateway UsageLedgerService | `usage_records` table |
| `tool_dispatch` | ai-service harness audit events | `tool_dispatch_completed` events |
| `workspace_runtime_tick` | container-manager session lifecycle | `resource_usage` table |
| `knowledge_ingestion` | Future knowledge service | Not yet implemented |
| `knowledge_summarization` | Future knowledge service | Not yet implemented |
| `collaboration_referral` | Future collaboration service | Not yet implemented |
| `collaboration_contribution` | Future collaboration service | Not yet implemented |
| `validation_run` | ai-service harness tools | Harness tool dispatch events |
| `browser_action` | container-manager browser-smoke | Browser smoke service |

---

## 21. Credit Ledger Concept

The credit ledger is the authoritative source of truth for a user's credit balance within a billing cycle.

### 21.1 Ledger Properties

- **Append-only deductions:** Credit consumption events are append-only (no edits, no deletions).
- **Atomic balance updates:** Each deduction atomically decrements the remaining balance.
- **Cycle-bound:** Each ledger record covers one billing cycle (monthly).
- **Deterministic:** Given the same events, the balance is always the same.
- **Auditable:** Full event trail from allocation → deductions → final balance.

### 21.2 Ledger Operations

| Operation | Description |
|-----------|-------------|
| `allocate(userId, credits)` | Set monthly allocation at cycle start |
| `rollover(userId, credits)` | Add rolled-over credits from prior cycle |
| `deduct(userId, event)` | Subtract credits for a usage event |
| `getBalance(userId)` | Return current remaining credits |
| `getHistory(userId, from, to)` | Return deduction events in time range |
| `checkBudget(userId, estimatedCost)` | Pre-flight check: can this action proceed? |

### 21.3 Overage Behavior

| Plan | Behavior When Credits Exhausted |
|------|----------------------------------|
| Free | Hard stop — no further executions until next cycle |
| Starter | Soft warning at 90%, hard stop at 100% |
| Pro | Soft warning at 90%, allow overage up to 10% with notification |
| Team | Soft warning at 90%, allow overage up to 20% with notification + admin alert |

---

## 22. Plan/Entitlement Object Concept

```
PlanDefinition {
  id: string
  code: string                         // 'free' | 'starter' | 'pro' | 'team'
  name: string
  monthlyCredits: number
  maxRolloverCredits: number
  maxConcurrentSessions: number
  maxWorkspaceStorageMB: number
  knowledgeBaseSizeLimitMB: number
  maxKnowledgeDocuments: number
  allowedAgentIds: string[]
  allowedToolCategories: string[]
  maxCollaborationReferralsPerMonth: number
  maxAgentsPerCollaboration: number
  premiumIntegrations: string[]
  supportTier: 'community' | 'email' | 'priority' | 'dedicated'
  overageBehavior: 'hard_stop' | 'soft_stop_10pct' | 'soft_stop_20pct'
  isActive: boolean
  pricingVersion: string
  createdAt: timestamp
  updatedAt: timestamp
}

UserEntitlement {
  id: string
  userId: string
  tenantId: string
  planId: string
  planCode: string
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  billingCycleStart: timestamp
  billingCycleEnd: timestamp
  creditLedgerId: string
  stripeSubscriptionId: string | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## 23. Billing Safety Rules

1. **No deduction without event:** Credits may only be deducted when a corresponding `UsageEvent` exists. No silent billing.
2. **No double-deduction:** Idempotency keys on usage events prevent duplicate deductions. Existing `request_id` pattern extends to all credit events.
3. **No cross-tenant billing:** Credits belong to a tenant. No cross-tenant credit consumption.
4. **Pre-flight check before expensive operations:** Before knowledge ingestion, collaboration referrals, or expensive model calls, the system checks available credits and blocks if insufficient (respecting overage rules).
5. **Graceful degradation on credit exhaustion:** Hard stop means queued operations wait; it does not mean data loss or session corruption.
6. **No retroactive rate changes:** Credit deductions use the pricing version active at the time of the event. Rate changes apply only to future events.
7. **Audit trail:** Full deduction history is retained for billing disputes and reconciliation.
8. **No real charges without Stripe integration:** Until Stripe is integrated, credits are tracked internally but no real money moves.
9. **Admin override:** Platform admin (Keith) can manually adjust credits for testing, support, or dispute resolution.
10. **Billing isolation from auth:** Billing failures must never prevent login or basic account access. A user with zero credits can still log in and view their dashboard.

---

## 24. Stripe/Payment Implementation Deferral

The following are explicitly deferred to a future task (BILLING-READY-01 or equivalent):

| Deferred Item | Reason |
|---------------|--------|
| Stripe SDK integration | Requires API keys, webhooks, and real money |
| Customer creation in Stripe | Requires Stripe SDK |
| Subscription creation/management | Requires Stripe Billing |
| Webhook handler for subscription events | Requires Stripe webhook secret |
| Payment method collection (Checkout/Elements) | Requires frontend Stripe.js |
| Invoice finalization in Stripe | Requires live Stripe connection |
| Refund/credit handling | Requires Stripe API |
| Tax calculation | Requires Stripe Tax or third-party |
| Plan upgrade/downgrade flow | Requires subscription proration logic |

**Current state:** `StripePaymentProvider` is a safe stub that makes zero API calls and returns placeholder values.

---

## 25. Recommended Implementation Roadmap

| # | Task ID | Name | Description | Dependencies |
|---|---------|------|-------------|--------------|
| 1 | BILLING-READY-01 | Credit Ledger Foundation | Define credit ledger TypeScript types, create static plan definitions with credit allocations, implement in-memory or DB-backed credit balance tracking | BILLING-READY-00 |
| 2 | BILLING-READY-02 | Credit Deduction Pipeline | Wire existing `UsageRecord` and harness audit events to produce `CreditDeductionEvent` records. Implement atomic balance decrements | BILLING-READY-01 |
| 3 | BILLING-READY-03 | Entitlement Gate Foundation | Implement plan-based entitlement checks for agent access, tool access, knowledge limits, and collaboration limits | BILLING-READY-01 |
| 4 | BILLING-READY-04 | Plan Upgrade from Free/Pro/Enterprise to Free/Starter/Pro/Team | Migrate `plans` table and `plan_type` field. Backfill existing users. Maintain backward compatibility | BILLING-READY-01 |
| 5 | BILLING-READY-05 | Frontend Billing UI Foundation | Account settings page, plan display, credit balance, usage history. Multilingual-first | BILLING-READY-03 |
| 6 | BILLING-READY-06 | Stripe Integration | Connect real Stripe SDK. Customer creation, subscription management, webhooks, checkout | BILLING-READY-04 |
| 7 | BILLING-READY-07 | Overage and Soft-Stop Logic | Implement plan-specific overage behavior (hard stop, soft stop with notification) | BILLING-READY-02, BILLING-READY-03 |
| 8 | BILLING-READY-08 | Team/Org Multi-Seat Foundation | Org entity, shared credit pool, seat management, admin roles | BILLING-READY-04 |

---

## 26. Open Questions / Deferred Decisions

| Question | Deferred To |
|----------|-------------|
| Exact credit amounts per plan tier | BILLING-READY-01 (pricing decision by Keith) |
| Exact credit rates per model tier | BILLING-READY-01 (pricing decision by Keith) |
| Credit rollover cap per plan | BILLING-READY-01 |
| Whether to offer credit packs (one-time purchase) | Product decision |
| Trial period for Starter/Pro/Team | Product decision |
| Billing cycle: calendar month vs subscription anniversary | BILLING-READY-04 |
| Multi-currency support | Future |
| Tax handling (Stripe Tax vs third-party) | BILLING-READY-06 |
| Refund policy and credit reversal | BILLING-READY-06 |
| Enterprise custom pricing / annual contracts | Future |
| GDPR implications of billing data retention | Future compliance review |
| Whether collaboration credits count against the referring agent's owner or the target agent's owner | BILLING-READY-02 |
| Whether knowledge refresh credits count at ingestion time or summary generation time | BILLING-READY-02 |
| Free plan: whether to allow any collaboration at all | Product decision |
| Whether to grandfather existing test users on enterprise plan | BILLING-READY-04 |

---

## 27. Acceptance Criteria Mapping

- [x] Planning document created: `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md`
- [x] Executive summary (section 1)
- [x] Existing billing-related surface inventory (section 2)
- [x] Existing auth/user model summary (section 3)
- [x] Existing session/workspace ownership model summary (section 4)
- [x] Existing entitlement/quota enforcement points (section 5)
- [x] Existing usage/token accounting (section 6)
- [x] Existing database models relevant to billing (section 7)
- [x] Existing API Gateway boundaries (section 8)
- [x] Existing ai-service / Agent Harness accounting boundaries (section 9)
- [x] Existing frontend account/settings/billing surfaces (section 10)
- [x] Gaps in current billing readiness (section 11)
- [x] Proposed Free / Starter / Pro / Team plan model (section 12)
- [x] Proposed monthly credit model (section 13)
- [x] Credit consumption categories (section 14)
- [x] Agent access entitlement model (section 15)
- [x] Tool access entitlement model (section 16)
- [x] Knowledge processing entitlement model (section 17)
- [x] Collaboration entitlement model (section 18)
- [x] Harness/canary entitlement relationship (section 19)
- [x] Usage event model (section 20)
- [x] Credit ledger concept (section 21)
- [x] Plan/entitlement object concept (section 22)
- [x] Billing safety rules (section 23)
- [x] Stripe/payment implementation deferral (section 24)
- [x] Recommended implementation roadmap (section 25)
- [x] Open questions / deferred decisions (section 26)
- [x] Acceptance criteria mapping (this section)

---

## Document Metadata

- **Created:** 2026-07-06
- **Task:** BILLING-READY-00
- **Status:** Planning complete — ready for Keith review and consolidation/checkpoint
- **Author:** AI-assisted planning pass
- **Source:** Existing codebase inspection, AGENT-PLATFORM-00, AGENT-KNOWLEDGE-00, AGENT-COLLAB-00, AINOW-EXECUTION-ROADMAP
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP
