# BILLING-READY-00 — Consolidation / Checkpoint

**Task ID:** BILLING-READY-00
**Family:** BILLING / COMMERCIAL READINESS
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-06
**Nature:** AUDIT/PLANNING — governance and documentation only, no implementation
**Checkpoint document:** `docs/BILLING-READY-00-CHECKPOINT.md`
**Audit/planning document:** `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md`

---

## 1. Task Summary

BILLING-READY-00 was a read-only audit and planning task for the ainow.biz commercial layer. It produced a comprehensive billing, plan, credit, and entitlement audit document without implementing any code, touching any runtime, making any provider calls, or activating the Agent Harness.

The task was registered on 2026-07-06 following Keith's explicit decision to prioritize billing readiness over AGENT-HARNESS-06C (canary execution). The planning pass was executed in the same window. All 19 audit/planning acceptance criteria were satisfied.

---

## 2. Exact Files Changed

### During Registration (prior step)
- `TASKS.md` — BILLING-READY-00 registered
- `TASKS_BACKLOG_FULL.md` — BILLING-READY-00 mirrored
- `docs/AINOW-EXECUTION-ROADMAP.md` — BILLING-READY-00 set to ACTIVE

### During Planning Pass
- `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md` — created (planning document, 27 sections)

### During This Consolidation
- `docs/BILLING-READY-00-CHECKPOINT.md` — created (this file)
- `TASKS.md` — BILLING-READY-00 status updated to COMPLETE and LOCKED
- `TASKS_BACKLOG_FULL.md` — BILLING-READY-00 status updated to COMPLETE and LOCKED
- `docs/AINOW-EXECUTION-ROADMAP.md` — BILLING-READY-00 updated to COMPLETE and LOCKED; next step recorded as Keith decision required

### Files NOT Changed
- No source files (`services/`, `frontend/`) modified
- No test files modified
- No package files modified (`package.json`, `package-lock.json`)
- No environment files modified (`.env`, `.env.*`)
- No Docker files modified
- No database schema files modified
- No migration files modified

---

## 3. Billing Audit Document Reference

**Primary artifact:** `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md`

27-section planning document covering:
- Existing billing surfaces inventory (sections 2–10)
- Identified gaps (section 11)
- Proposed Free / Starter / Pro / Team plan model (section 12)
- Proposed credit model (section 13)
- Credit consumption categories (section 14)
- Agent, tool, knowledge, collaboration entitlement models (sections 15–18)
- Harness entitlement relationship (section 19)
- Usage event and credit ledger models (sections 20–22)
- Billing safety rules (section 23)
- Stripe/payment deferral (section 24)
- Implementation roadmap (section 25)
- Open questions (section 26)
- Acceptance criteria mapping (section 27)

---

## 4. Existing Billing Surface Inventory Summary

### Database Tables
| Table | Status |
|-------|--------|
| `users` (plan_type, plan_status, stripe_customer_id) | Active |
| `plans` (code, name, max_active_sessions, max_sessions_24h, max_tokens_24h) | Active |
| `usage_quotas` (token/session/storage limits) | Schema exists, uncertain active use |
| `subscriptions` (stripe_subscription_id, plan_type) | Schema exists (no active Stripe calls) |
| `token_usage` (per-session token consumption) | Active |
| `usage_records` (two-phase immutable execution ledger) | Active |
| `billing_snapshots` (cost aggregation) | Active |
| `invoices` (derived from snapshots, draft-only) | Active (no payment) |
| `resource_usage` (CPU/memory/disk/network per session) | Schema exists |

### Backend Services
- **api-gateway:** UsageLedgerService, BillingSnapshotService, BillingVisibilityService, InvoiceService, QuotaService, QuotaGuard, SessionQuotaGuard, TokenUsageService, AdminService, StripePaymentProvider (stub)
- **container-manager:** PlanQuotaConfig (static limits), QuotaEvaluationService (read-only), UsageAggregationService, BillingExportController
- **ai-service:** quota.config.ts (100K per-session limit), QuotaService, HarnessAuditEvents

### Frontend Surfaces
- `TokenCounter.tsx` — displays session token count in workspace
- `workspace-quota-usage.logic.ts` — parses rate-limit/quota error messages for UX
- No billing/account/settings page exists

---

## 5. Existing Usage/Token Accounting Summary

| Layer | What It Records |
|-------|-----------------|
| `token_usage` table (SQLite) | Per-session: model, input_tokens, output_tokens, cost_usd |
| `usage_records` table (Postgres) | Per-execution: provider, adapter, model, tokens_used, duration_ms, status |
| `resource_usage` table | CPU seconds, memory MB·hours, disk GB·hours, network bytes |
| `BillingSnapshot` entity | Aggregated cost by provider/model per time window |
| `Invoice` entity | Derived from snapshot (draft-only, no payment) |
| Harness audit events | Per-iteration: tokensUsed, cumulativeTokensUsed, durationMs, toolCallCount |

**Key gaps:** No credit deduction. No monthly credit balance tracking. No per-agent attribution. No knowledge or collaboration cost attribution. No tool-call cost attribution separate from token cost.

---

## 6. Existing Plan/Quota Model Summary

| Aspect | Current State |
|--------|--------------|
| Plan enum | `free`, `pro`, `enterprise` — three tiers only |
| Plan limits | `max_active_sessions`, `max_sessions_24h`, `max_tokens_24h` per plan |
| Quota enforcement | In-memory rolling 24h window (api-gateway QuotaService) |
| Session quota | DB-backed (SessionQuotaGuard) |
| Per-session token cap | 100K tokens hard cap (ai-service) |
| Credit model | Does not exist |
| Monthly credit allocation | Does not exist |

---

## 7. Existing Entitlement Gaps

| Gap | Impact |
|-----|--------|
| No credit ledger | Cannot enforce credit-based limits |
| No monthly credit allocation | Cannot implement credit model |
| No credit deduction logic | Usage tracked but not billed |
| No Starter/Team plan tiers | Cannot offer tiered pricing |
| No agent access entitlements | All users can access all agents regardless of plan |
| No knowledge processing billing | Cannot charge for knowledge work |
| No collaboration billing | Cannot charge for collaboration |
| No tool-call cost model | Cannot charge per tool call |
| No workspace runtime billing | Container runtime hours not linked to credits |
| No frontend billing UI | Users cannot see or manage billing |
| No overage enforcement | No behavior when credits exhausted |
| No team/org model | Cannot support Team plan (multi-seat) |

---

## 8. Existing Stripe/Payment Status

- `StripePaymentProvider` is a **safe stub** — makes zero API calls, returns placeholder values.
- `PaymentsModule` is a provider abstraction shell.
- No Stripe API keys are consumed at runtime.
- No subscriptions, customers, webhooks, invoices, or payment methods exist in Stripe.
- The stub is safe to deploy; it has no side effects.
- Real Stripe integration is deferred to a future task (BILLING-READY-06 or equivalent).

---

## 9. Proposed Free / Starter / Pro / Team Plan Model

| Plan | Target User | Monthly Credits | Price Direction |
|------|-------------|-----------------|-----------------|
| **Free** | Evaluation / exploration | 500 | $0 |
| **Starter** | Solo founder, light usage | 5,000 | ~$19–29 |
| **Pro** | Active solo / small team lead | 25,000 | ~$79–99 |
| **Team** | Collaborative team (multi-seat) | 100,000 shared | ~$299–499 (3–5 seats) |

Feature matrix (agent access, concurrent sessions, workspace storage, knowledge base size, collaboration referrals, support tier, overage behavior) is documented in `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md` section 12.1.

---

## 10. Proposed Monthly Credit Model

- One credit is a normalized billing unit abstracting per-model, per-tool, and per-operation complexity.
- Each plan includes a fixed monthly allocation that resets at the billing cycle boundary.
- Unused credits may roll over up to a plan-dependent cap.
- Credit balance tracked via a **CreditLedger** entity (one per user/org per billing cycle).
- Ledger operations: `allocate`, `rollover`, `deduct`, `getBalance`, `getHistory`, `checkBudget`.
- Ledger properties: append-only deductions, atomic balance updates, cycle-bound, deterministic, auditable.
- Overage behaviors: hard stop (Free), soft warning + hard stop (Starter), soft warning + 10% overage (Pro), soft warning + 20% overage + admin alert (Team).

Full `CreditLedger` and `CreditDeductionEvent` schema in section 13 of the audit document.

---

## 11. Proposed Credit Consumption Categories

| Category | Unit | Rate Direction |
|----------|------|----------------|
| `model_tokens` | 1K tokens | 1–10 credits per 1K (model tier-dependent) |
| `tool_calls` | 1 call | 0.5–2 credits per call (tool-dependent) |
| `workspace_runtime` | 1 minute | 0.1–0.5 credits per minute |
| `knowledge_ingestion` | 1 document | 5–20 credits per document |
| `knowledge_summarization` | 1 summary | 2–10 credits per summary |
| `collaboration_referral` | 1 referral | 3–5 credits per referral |
| `collaboration_contribution` | 1 contribution | 1–3 credits per contribution |
| `validation_action` | 1 run | 1–3 credits per run |
| `browser_action` | 1 action | 2–5 credits per action |

Model token tier breakdown: Low-cost (1 credit/1K), Standard (3), Premium (5), High-end (10).

Credit rates are versioned and governed; rate changes require explicit governance approval.

---

## 12. Proposed Agent Entitlement Model

| Plan | Agents Accessible |
|------|-------------------|
| Free | Builder Agent only |
| Starter | Builder Agent only |
| Pro | Builder Agent + 1 additional agent (when available) |
| Team | All agents (Builder + Chief of Staff + Product Strategy + Technology Advisor + future) |

Entitlement check: `canAccessAgent(userId, agentId)` — resolves user plan → plan's `allowedAgentIds` → membership check. When a new agent transitions from `coming_soon` to `active`, qualifying plan users automatically gain access (plan-level, not per-user migration).

---

## 13. Proposed Tool Entitlement Model

| Tool Category | Free | Starter | Pro | Team |
|---------------|------|---------|-----|------|
| File read/write | ✓ | ✓ | ✓ | ✓ |
| Validation runner | ✓ | ✓ | ✓ | ✓ |
| Browser smoke | ✗ | ✓ | ✓ | ✓ |
| Preview server | ✓ | ✓ | ✓ | ✓ |
| Knowledge upload | ✗ | Limited (10 docs) | ✓ | ✓ |
| Premium integrations | ✗ | ✗ | 1 connector | All connectors |
| Scheduled jobs | ✗ | ✗ | ✗ | ✓ |

Tool access is gated at the platform layer before tool dispatch; both user plan and agent manifest `toolPermissions` must allow the tool.

---

## 14. Proposed Knowledge Entitlement Model

| Dimension | Free | Starter | Pro | Team |
|-----------|------|---------|-----|------|
| Knowledge base size | 10 MB | 100 MB | 1 GB | 10 GB |
| Max documents | 5 | 50 | 500 | 5,000 |
| Summarization | Manual only | Manual only | Manual + weekly refresh | Manual + daily refresh |
| Specialist scopes | 0 | 0 | 1 | Unlimited |
| Raw content access | No | No | Yes (own scopes) | Yes (all scopes) |
| Connectors | None | None | 1 | All |

Knowledge processing consumes credits per section 14 of the audit document. When credits exhausted, jobs are queued but not executed; existing knowledge remains accessible.

---

## 15. Proposed Collaboration Entitlement Model

| Dimension | Free | Starter | Pro | Team |
|-----------|------|---------|-----|------|
| Collaboration referrals/month | 0 | 0 | 50 | Unlimited |
| Max agents per collaboration | 1 (self only) | 1 (self only) | 4 | 5 |
| Approval gate access | N/A | N/A | Yes | Yes |
| Shared work objects | N/A | N/A | Yes | Yes |
| Scheduled collaboration scans | N/A | N/A | No | Yes |

Collaboration safety limits (from AGENT-COLLAB-00) remain enforced regardless of plan level — no plan can override safety limits.

---

## 16. Proposed Usage Event / Credit Ledger Model

All billable platform activity produces a `UsageEvent` routed into the credit ledger:

```
UsageEvent {
  id, tenantId, userId, agentId, sessionId, executionId,
  eventType: UsageEventType,
  category: CreditCategory,
  quantity, metadata, createdAt
}
```

Event types: `ai_execution`, `tool_dispatch`, `workspace_runtime_tick`, `knowledge_ingestion`, `knowledge_summarization`, `collaboration_referral`, `collaboration_contribution`, `validation_run`, `browser_action`.

Event sources: api-gateway `UsageLedgerService` (ai_execution), ai-service harness audit events (tool_dispatch), container-manager session lifecycle (workspace_runtime_tick), future knowledge service (knowledge events), future collaboration service (collaboration events).

Full `PlanDefinition` and `UserEntitlement` TypeScript schemas are in section 22 of the audit document.

---

## 17. Billing Safety Rules

Ten rules documented in section 23 of the audit document:

1. No deduction without a corresponding `UsageEvent` — no silent billing.
2. Idempotency keys prevent double-deduction (extends existing `request_id` pattern).
3. No cross-tenant credit consumption.
4. Pre-flight credit check before expensive operations.
5. Graceful degradation on credit exhaustion — hard stop does not mean data loss.
6. No retroactive rate changes — pricing version active at event time is used.
7. Full deduction history retained for billing disputes and reconciliation.
8. No real charges without Stripe integration.
9. Admin (Keith) can manually adjust credits for testing, support, or dispute resolution.
10. Billing failures must never prevent login or basic account access.

---

## 18. Stripe/Payment Deferral Confirmation

**Confirmed deferred to future task (BILLING-READY-06 or equivalent):**

- Stripe SDK integration
- Customer creation in Stripe
- Subscription creation/management
- Webhook handler for subscription events
- Payment method collection (Checkout/Elements)
- Invoice finalization in Stripe
- Refund/credit handling
- Tax calculation
- Plan upgrade/downgrade flow

`StripePaymentProvider` remains a safe zero-call stub. No Stripe API calls were made during BILLING-READY-00. No Stripe API keys were consumed or referenced at runtime.

---

## 19. Recommended Implementation Roadmap

| # | Task ID | Name | Dependencies |
|---|---------|------|--------------|
| 1 | BILLING-READY-01 | Credit Ledger Foundation | BILLING-READY-00 |
| 2 | BILLING-READY-02 | Credit Deduction Pipeline | BILLING-READY-01 |
| 3 | BILLING-READY-03 | Entitlement Gate Foundation | BILLING-READY-01 |
| 4 | BILLING-READY-04 | Plan Upgrade (Free/Starter/Pro/Team) | BILLING-READY-01 |
| 5 | BILLING-READY-05 | Frontend Billing UI Foundation | BILLING-READY-03 |
| 6 | BILLING-READY-06 | Stripe Integration | BILLING-READY-04 |
| 7 | BILLING-READY-07 | Overage and Soft-Stop Logic | BILLING-READY-02, -03 |
| 8 | BILLING-READY-08 | Team/Org Multi-Seat Foundation | BILLING-READY-04 |

None of these tasks were registered during BILLING-READY-00. They are proposed options for Keith's decision.

---

## 20. Validation Evidence

All validation is read-only (no builds, no tests, no runtime commands executed).

### Audit document completeness
- `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md` — 676 lines, 27 sections, all acceptance criteria `[x]`.

### Task registration completeness
- BILLING-READY-00 registered in TASKS.md at line 26326 with all 19 audit/planning criteria `[x]`.
- BILLING-READY-00 mirrored in TASKS_BACKLOG_FULL.md at line 36832 with all 19 audit/planning criteria `[x]`.

### Roadmap update completeness
- `docs/AINOW-EXECUTION-ROADMAP.md` section 3 shows BILLING-READY-00 as ACTIVE at time of planning pass (updated to COMPLETE and LOCKED during this consolidation).

### Source / runtime / provider isolation
- Grep across `services/`, `frontend/` for BILLING-READY-00 references — zero implementation added.
- No `StripePaymentProvider` method calls introduced.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` was not set or referenced.

---

## 21. Confirmation: No Implementation Occurred

**Confirmed.** BILLING-READY-00 was audit and planning only.

- Zero source files changed (`services/api-gateway/`, `services/ai-service/`, `services/container-manager/`, `frontend/`).
- Zero test files added or modified.
- Zero package files changed.
- Zero database schema or migration files changed.
- Zero environment files changed.
- Zero Docker files changed.
- The only files changed were governance/documentation files: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md`, `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md`, and this checkpoint file.

---

## 22. Confirmation: No Stripe/Payment/Provider Calls Occurred

**Confirmed.** No Stripe API calls were made. No payment provider calls were made. No external API calls of any kind were made during this task. `StripePaymentProvider` remains a safe zero-call stub. No Stripe API keys were consumed or referenced at runtime.

---

## 23. Confirmation: No Agent Harness Activation Occurred

**Confirmed.** `AGENT_HARNESS_ENABLE_TOOL_LOOP` was not set to `true`. The Agent Harness tool loop was not activated at any point during BILLING-READY-00. No canary execution occurred. No harness iterations executed.

---

## 24. Confirmation: AGENT-HARNESS-06C Remains Unregistered

**Confirmed.** AGENT-HARNESS-06C (Read-Only Harness Canary Execution) was not registered during BILLING-READY-00 or during this consolidation. It remains deferred as an explicit future decision for Keith. It appears in TASKS.md and TASKS_BACKLOG_FULL.md only as a "next recommended task candidate" reference in the AGENT-HARNESS-06B section — it is not an active or registered task.

---

## 25. Remaining Risks

| Risk | Level | Notes |
|------|-------|-------|
| Credit rates not finalized | Low | Rates in audit document are directional. Keith must approve final rates at BILLING-READY-01. |
| Plan pricing not finalized | Low | Price points are directional (~$19–29, ~$79–99, ~$299–499). Keith must approve at BILLING-READY-01. |
| Multi-tenant / org model complexity | Medium | Team plan requires org/tenant entity. BILLING-READY-08 is a significant scope item. |
| Stripe integration timeline | Medium | Deferred to BILLING-READY-06 or later. Until then, no real payments are possible. |
| Existing `free/pro/enterprise` plan migration | Medium | Existing users on `enterprise` plan must be migrated or grandfathered at BILLING-READY-04. |
| No frontend billing UI | Medium | Users have no visibility into credits until BILLING-READY-05. |
| Knowledge/collaboration credit attribution | Low | Open question: which tenant owns the credit for collaboration actions (section 26 of audit doc). |
| AGENT-HARNESS-06C remains deferred | Low | Canary execution is not blocked by billing work but remains an open decision item. |

---

## 26. Next Recommended Task Options

**Keith decision required.** None of the following are registered. Do not auto-select.

**Option A — BILLING-READY-01: Credit Ledger Foundation**
- Define TypeScript types for `CreditLedger`, `CreditDeductionEvent`, `UsageEvent`, `PlanDefinition`, `UserEntitlement`
- Create static plan definitions with credit allocations
- Implement in-memory or DB-backed credit balance tracking
- Prerequisites: BILLING-READY-00 (complete)
- Risk: Low–Medium (bounded schema/type work)

**Option B — AGENT-HARNESS-06C: Read-Only Harness Canary Execution**
- Execute a single controlled canary run of the Agent Harness tool loop
- Prerequisites: AGENT-HARNESS-06B (complete), runtime environment validation
- Risk: Medium (runtime execution, requires Docker + sandbox environment)

**Option C — BILLING-READY-01A: Billing Implementation Architecture Review**
- Deeper architecture review before any code implementation
- Evaluate whether to use existing `usage_records`/`billing_snapshots` tables as the credit ledger foundation or introduce new tables
- Risk: Low (read-only, governance only)

---

## 27. Final Status

| Item | Status |
|------|--------|
| BILLING-READY-00 | **COMPLETE and LOCKED** |
| Audit document | COMPLETE — `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md` |
| Checkpoint document | COMPLETE — `docs/BILLING-READY-00-CHECKPOINT.md` (this file) |
| All 19 audit/planning acceptance criteria | ALL `[x]` CONFIRMED |
| Implementation performed | NONE |
| Stripe/payment/provider calls | NONE |
| Agent Harness activated | NO |
| AGENT-HARNESS-06C registered | NO — remains deferred |
| Follow-up tasks registered | NONE |
| Subagents used | NONE |
| Next step | Keith decision required — see section 26 |

---

*Checkpoint created: 2026-07-06*
*Governed by: CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP*
