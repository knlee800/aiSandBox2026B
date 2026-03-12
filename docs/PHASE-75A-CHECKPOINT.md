# PHASE-75A-CHECKPOINT.md

## Metadata

**Phase:** 75  
**Stage:** 75A  
**Task ID:** TASK-75A  
**Title:** Next Bounded Commercial Family Selection  
**Status:** COMPLETE  
**Date:** 2026-03-12  
**Nature:** DOCUMENTATION / PLANNING ONLY (NO CODE)

---

## 1. Objective

Select the next bounded commercial-foundation family after Phase 74 completion, using current governance artifacts and current `PRD.md` / `ARCHITECTURE.md` authority constraints only.

---

## 2. Why Phase 75A Is Needed Now

Phase 73 completed the first bounded non-monetary usage/quota readiness family (contract baseline normalization). Phase 74 completed the second bounded non-monetary family (cross-surface visibility/reporting coherence and determinism). A next-step bounded family must now be selected so commercial progression remains incremental, deterministic, and within current authority limits.

---

## 3. Input Artifacts Reviewed

- `CLAUDE.md`
- `PRD.md`
- `ARCHITECTURE.md`
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `AI-SANDBOX-PLATFORM-PLAN (2).md`
- `docs/PHASE-74-FINAL-CHECKPOINT.md`
- `docs/PHASE-74A-CHECKPOINT.md`
- `docs/PHASE-74B-CHECKPOINT.md`
- `docs/PHASE-73-FINAL-CHECKPOINT.md`
- `docs/PHASE-73A-CHECKPOINT.md`

---

## 4. Completed Commercial Families (Summary)

| Phase | Family | Outcome |
|-------|--------|---------|
| 73 | Non-Monetary Usage/Quota Commercial Readiness (contract baseline normalization) | COMPLETE |
| 74 | Non-Monetary Visibility and Usage Reporting Readiness (cross-surface coherence + reporting determinism) | COMPLETE |

---

## 5. Deferred Commercial Candidates Reviewed

From current governance sources and the broader plan, the following deferred commercial candidates were reviewed:

1. Monetary billing execution (payment processing/charges/refunds)
2. Subscription and plan lifecycle management (Stripe integration, plan entities)
3. Invoicing/tax/accounting outputs
4. Overage charging and payment-failure lifecycle behavior
5. Public API commercialization surfaces (API key management and external paid API access model)
6. Project persistence and sharing (save/load/fork/share as persistent entities)
7. Project import/export (ZIP/TAR.GZ upload/download, Git remote integration)
8. Multi-AI collaboration (ChatGPT + Claude orchestration)
9. Non-monetary quota configuration and plan-tier readiness (config-driven limit differentiation on existing infrastructure)

---

## 6. Excluded Candidates and Why

### 6.1 Monetary billing execution
Excluded because current `PRD.md` Section 3.F keeps monetary billing as "Future Extensions (Out of Scope for Current Implementation)." `PRD.md` Section 8 explicitly lists billing enforcement logic as a non-goal for the current phase.

### 6.2 Subscription and plan lifecycle management
Excluded because this introduces monetization domain expansion (Stripe integration, subscription entities, plan lifecycle state machines) not yet authorized by current `PRD.md` or `ARCHITECTURE.md`.

### 6.3 Invoicing/tax/accounting outputs
Excluded because this is monetary/compliance expansion beyond current bounded scope and requires billing activation first.

### 6.4 Overage charging / payment-failure lifecycle
Excluded because it depends on monetization policy and billing lifecycle behavior not currently authorized.

### 6.5 Public API key commercialization
Excluded because this introduces a new authentication mechanism (API key auth alongside JWT), new schema (`api_keys` table), new public endpoints, and broader external API/commercial boundary expansion not permitted under current `ARCHITECTURE.md` constraints.

### 6.6 Project persistence and sharing
Excluded because this introduces a fundamentally new entity model (projects as persistent, shareable objects), requires new schema (`projects` table and relationships), new endpoints (project CRUD), and architectural boundary expansion beyond current session-based architecture.

### 6.7 Project import/export
Excluded for this immediate family because it requires new endpoints (`POST /api/project/import`, `GET /api/project/export/:sessionId`), new service logic (archive handling, malware scanning), and file-handling infrastructure expansion beyond current session-scoped operations. While `PRD.md` Key Goals include "Easy import/export of projects," the implementation requires endpoint/service additions that exceed the current bounded-family scope.

### 6.8 Multi-AI collaboration
Excluded because this requires significant architectural expansion (new AI conversation tables, new orchestration logic, external API integrations for additional AI providers), which is well beyond current `ARCHITECTURE.md` constraints.

---

## 7. Selected Next Bounded Commercial Family

**Selected family:** **Non-Monetary Quota Configuration and Plan-Tier Readiness (Architecture-Neutral, Existing-Infrastructure Only)**.

This family focuses on ensuring existing quota enforcement infrastructure supports configurable, plan-tier-differentiated limits on existing enforcement guards and surfaces, without introducing monetization, new endpoints, new service boundaries, or schema changes.

---

## 8. Why This Family Is Allowed Under Current PRD/ARCHITECTURE Constraints

1. **PRD.md Section 3.A** explicitly states governance limits are "config-driven and enforced by the system." Ensuring quota limits are genuinely config-driven aligns with existing PRD intent, not scope expansion.
2. **PRD.md Section 3.F** allows usage/quota foundation work where usage activity is observable, while keeping monetary billing out of current scope. Configurable limits are foundation work, not monetization.
3. **ARCHITECTURE.md** requires deterministic, request-driven behavior. Config-driven quota limits remain deterministic and request-driven — the enforcement path does not change, only the limit values become externalized.
4. This family stays within existing service boundaries (api-gateway quota guards from Phase 42).
5. No new endpoints are required — the family operates on existing quota enforcement infrastructure.
6. No background-worker patterns are introduced.
7. No monetization activation occurs — plan-tier configuration readiness is structural preparation, not billing.

---

## 9. What This Family Covers

1. **Config-driven quota limit verification/normalization:** Verify and, if needed, normalize that existing hard quota enforcement limits (Phase 42: max concurrent sessions, max sessions per 24h, max tokens per 24h) are config-driven per `PRD.md` Section 3.A requirements.
2. **Plan-tier configuration contract definition:** Define a configuration contract that maps plan tiers (e.g., free/pro/enterprise) to differentiated quota limits, as a config-driven structure that existing enforcement guards can consume.
3. **Tier-aware enforcement readiness validation:** Validate that existing quota enforcement guards can serve differentiated limits via configuration without requiring schema changes, new endpoints, or architecture expansion.

---

## 10. What This Family Does NOT Cover

1. No monetary billing activation
2. No subscription or plan lifecycle management
3. No invoicing/tax/accounting
4. No payment processing or Stripe integration
5. No new endpoints or surfaces
6. No new service boundaries
7. No schema changes (plan-tier mapping is config-driven, not DB-driven)
8. No background-worker patterns
9. No architecture expansion

---

## 11. Immediate Sequencing Recommendation (Family Only)

1. **75B (bounded planning slice):** Define/plan the bounded quota configuration family — allowed scope, minimum slices, constraints, and sequencing under current authority.
2. **75C-1 (bounded baseline slice):** Verify and normalize config-driven quota limit behavior on existing enforcement guards; define plan-tier configuration contract.
3. **75C-2 (bounded validation slice):** Validate tier-aware enforcement readiness and confirm existing guards can serve differentiated limits without schema/endpoint/architecture changes.
4. **75C-FINAL (family consolidation):** Consolidate findings and confirm bounded-family completion under preserved constraints.

Progression remains checkpoint-gated between each sub-stage.

---

## 12. Preserved Invariants

- ✅ No platform code changes
- ✅ No frontend changes
- ✅ No backend changes
- ✅ No schema changes
- ✅ No endpoint changes
- ✅ No refactors
- ✅ No broader architectural expansion
- ✅ No monetization scope expansion beyond current authority constraints
- ✅ Documentation/planning-only scope preserved
- ✅ `PRD.md` and `ARCHITECTURE.md` remained higher authority
- ✅ Minimal diff only

---

## 13. Explicit Out-of-Scope

- No implementation work in this stage
- No platform/frontend/backend code changes
- No schema/endpoint changes
- No refactors
- No broader architecture expansion
- No monetary billing/subscription/invoicing/tax implementation
- No broader roadmap expansion beyond this immediate bounded-family selection

---

## 14. Recommended Next Stage (High-Level Only)

Proceed to Phase 75B bounded planning sub-stage for the selected family, keeping scope strictly non-monetary, deterministic, request-driven, and limited to existing quota enforcement infrastructure.

---

## 15. Sign-Off

**Task:** TASK-75A  
**Status:** COMPLETE  
**Checkpoint:** `docs/PHASE-75A-CHECKPOINT.md`
