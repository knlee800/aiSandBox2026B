# AINOW-EXECUTION-ROADMAP — ainow.biz Execution Roadmap and Priority Guardrails

**Created:** 2026-07-06
**Task:** ROADMAP-00
**Status:** ACTIVE governance document
**Authority:** This document controls execution order. Product architecture remains governed by AGENT-PLATFORM-00.

---

## 1. Purpose

This document controls execution order, not product architecture.

Product architecture remains governed by `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` (the master plan).

This document prevents priority drift across task families:
- Agent Harness
- Agent Platform
- Knowledge
- Collaboration
- Billing
- Beta preparation

It establishes the agreed sequence, guardrails, and rules for when that sequence may change.

---

## 2. Current Completed Foundation

| Task ID | Name | Status |
|---------|------|--------|
| AGENT-HARNESS-05C9 | Structured Harness Audit Events | COMPLETE and LOCKED |
| AGENT-HARNESS-06 | Read-Only Harness Canary Readiness Review | COMPLETE and LOCKED |
| AGENT-HARNESS-06A | Read-Only Canary Hardening Slice | COMPLETE and LOCKED |
| AGENT-PLATFORM-00 | ainow.biz Multi-Agent Platform Master Plan | COMPLETE and LOCKED |
| AGENT-PLATFORM-01 | Agent Registry Foundation | COMPLETE and LOCKED |
| AGENT-PLATFORM-02 | Static RPG Office/Town Dashboard Shell | COMPLETE and LOCKED |
| AGENT-PLATFORM-03 | Builder Agent Route Integration Review | COMPLETE and LOCKED |
| BILLING-READY-00 | Billing, Plan, Credit, and Entitlement Audit | COMPLETE and LOCKED |
| BILLING-READY-01 | Credit Ledger Foundation | COMPLETE and LOCKED |
| BILLING-READY-02A/02B/02C | Credit Deduction Pipeline Foundation | COMPLETE and LOCKED |
| BILLING-READY-02D | Credit Deduction Pipeline — Simulation-Only Validation | COMPLETE and LOCKED |
| BILLING-READY-03A | Schema and Persistence Design | COMPLETE and LOCKED |
| BILLING-READY-03B | DB Schema, Migration, and Repository Foundation | COMPLETE and LOCKED |
| BILLING-READY-03C1 | Persistent Gateway Implementation (Not Runtime-Bound) | COMPLETE and LOCKED |

---

## 3. Strategic Execution Sequence

| # | Task ID | Name | Status |
|---|---------|------|--------|
| 1 | AGENT-HARNESS-05C9 | Structured Harness Audit Events | COMPLETE |
| 2 | AGENT-PLATFORM-02 | Static RPG Office/Town Dashboard Shell | COMPLETE |
| 3 | AGENT-PLATFORM-03 | Builder Agent Route Integration Review | COMPLETE |
| 4 | AGENT-KNOWLEDGE-00 | Common Knowledge Base Architecture Plan | COMPLETE |
| 5 | AGENT-COLLAB-00 | Agent Referral and Collaboration Protocol Plan | COMPLETE |
| 6 | AGENT-HARNESS-06 | Read-Only Harness Canary Readiness Review | COMPLETE — NO-GO finding |
| 6A | AGENT-HARNESS-06A | Read-Only Canary Hardening Slice | COMPLETE |
| 6B | AGENT-HARNESS-06B | Read-Only Harness Canary Plan | COMPLETE and LOCKED |
| 7 | BILLING-READY-00 | Billing, Plan, Credit, and Entitlement Audit | **COMPLETE and LOCKED** — 2026-07-06. Audit/planning complete. No implementation. See `docs/BILLING-READY-00-CHECKPOINT.md`. |
| 7A | BILLING-READY-01A | Billing Implementation Architecture Review | **COMPLETE and LOCKED** — 2026-07-06. Read-only architecture review complete. All 18 criteria satisfied. Option A recommended for BILLING-READY-01. See `docs/BILLING-READY-01A-CHECKPOINT.md`. |
| 7B | BILLING-READY-01 | Credit Ledger Foundation | **COMPLETE and LOCKED — 2026-07-06.** TypeScript-only credit ledger domain/types/config (Option A). 10 source files + 3 test files. 16 tests pass. No database migration. See `docs/BILLING-READY-01-CHECKPOINT.md`. |
| 7C | BILLING-READY-02A/02B/02C | Credit Deduction Pipeline Foundation | **COMPLETE and LOCKED — 2026-07-07.** Abstract gateway contract, NoOp + calculating implementations, single runtime wiring point in usage-ledger, deterministic credit calculation layer. 9 source files + 5 test files. No persistence, no balance enforcement, no Stripe. See `docs/BILLING-READY-02A-02B-02C-CHECKPOINT.md`. |
| 7D | BILLING-READY-02D | Credit Deduction Pipeline — Simulation-Only Validation | **COMPLETE and LOCKED — 2026-07-07.** Simulation-only validation of the full `CreditDeductionEvent` → `applyDeduction` → `CreditDeductionResult` pipeline. 1 test file modified, 2 simulation tests added. No production source changes. 4 suites / 53 tests passed. See `docs/BILLING-READY-02D-CHECKPOINT.md`. |
| 7E | BILLING-READY-03 | Credit Balance Persistence Foundation | **ACTIVE — 2026-07-07.** DB-backed credit balance persistence. Split into child slices: 03A (schema design — COMPLETE and LOCKED), 03B (DB migration/repository — COMPLETE and LOCKED), 03C1 (persistent gateway — COMPLETE and LOCKED), 03C2 (runtime binding — not registered), 03D (overflow/concurrency semantics — not registered). |
| 7E-a | BILLING-READY-03A | Schema and Persistence Design | **COMPLETE and LOCKED — 2026-07-07.** Design-only child slice. `CreditBalance` and `CreditDeductionRecord` entity schemas, repository contracts, idempotency model, transaction semantics, migration plan. See `docs/BILLING-READY-03A-CHECKPOINT.md`. |
| 7E-b | BILLING-READY-03B | DB Schema, Migration, and Repository Foundation | **COMPLETE and LOCKED — 2026-07-07.** TypeORM entities (`CreditBalance`, `CreditDeductionRecord`), migration (`gen_random_uuid()`), `CreditBalanceRepository`, `CreditDeductionRecordRepository`, `CreditPersistenceModule`. 8 source files + 6 test files. 13 suites / 122 tests passed. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`. |
| 7E-c | BILLING-READY-03C1 | Persistent Gateway Implementation (Not Runtime-Bound) | **COMPLETE and LOCKED — 2026-07-07.** Third child slice of BILLING-READY-03. `PersistentCreditDeductionGateway` implementation, generic base class update (sync default preserved), `sourceEventId` idempotency, atomic deduction flow, `balanceAfter` population, overflow capping, race condition fallback, unit tests. 3 source files + 1 test file. 11 suites / 136 tests passed (credit-deduction); 14 suites / 152 tests passed (credit). No runtime binding swap (`CalculatingCreditDeductionGateway` remains bound). See `docs/BILLING-READY-03C1-CHECKPOINT.md`. |
| 8 | Beta preparation | Beta readiness checklist | After Billing foundation |

---

## 4. Current Next Task

**BILLING-READY-03C1 — COMPLETE and LOCKED (2026-07-07).** Persistent Gateway Implementation (Not Runtime-Bound). Third child slice of BILLING-READY-03. `PersistentCreditDeductionGateway` implemented, generic base class update (sync default preserved; async opt-in via type parameter), `sourceEventId` idempotency, atomic deduction flow, `balanceAfter` population, overflow capping, race condition fallback. 3 source files + 1 test file. 11 suites / 136 tests passed; 14 suites / 152 tests passed (credit). No runtime binding swap (`CalculatingCreditDeductionGateway` remains bound). See `docs/BILLING-READY-03C1-CHECKPOINT.md`.

**BILLING-READY-03C2 — Not yet registered.** Controlled runtime binding, async `UsageLedgerService` integration, DB validation. Next slice after BILLING-READY-03C1. Register now that BILLING-READY-03C1 is COMPLETE and LOCKED.

**BILLING-READY-03B — COMPLETE and LOCKED (2026-07-07).** DB Schema, Migration, and Repository Foundation. Second child slice of BILLING-READY-03. TypeORM entities (`CreditBalance`, `CreditDeductionRecord`), database migration (`1772100000000-CreateCreditBalanceAndDeductionTables.ts`, uses `gen_random_uuid()`), `CreditBalanceRepository`, `CreditDeductionRecordRepository`, `CreditPersistenceModule`. 8 source files + 6 test files. 13 suites / 122 tests passed. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`.

**BILLING-READY-03A — COMPLETE and LOCKED (2026-07-07).** Schema and Persistence Design. First child slice of BILLING-READY-03. Governance/design-only. Produced `docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md` defining `CreditBalance` entity, `CreditDeductionRecord` entity, repository contracts, idempotency model, transaction semantics, migration plan, and BILLING-READY-03B acceptance criteria. No implementation files changed. See `docs/BILLING-READY-03A-CHECKPOINT.md`.

**BILLING-READY-03 — ACTIVE (registered 2026-07-07).** Credit Balance Persistence Foundation. DB-backed credit balance persistence, durable deduction records, `sourceEventId` idempotency, `balanceAfter` semantics, `creditsOverflow` enforcement, and audit trail. Split into child slices: 03A (schema and persistence design — COMPLETE and LOCKED), 03B (DB schema/migration/repository — COMPLETE and LOCKED), 03C1 (persistent gateway implementation — COMPLETE and LOCKED), 03C2 (runtime binding — not registered), 03D (balance/overflow/concurrency semantics — not yet registered).

**BILLING-READY-02D — COMPLETE and LOCKED (2026-07-07).** Credit Deduction Pipeline — Simulation-Only Validation. Simulation-only validation of the full `CreditDeductionEvent` → `applyDeduction` → `CreditDeductionResult` pipeline. 1 test file modified (`calculating-credit-deduction.gateway.spec.ts`), 2 simulation tests added. No production source changes. 4 suites / 53 tests passed. No persistence, no balance enforcement, no Stripe. Pre-persistence acceptance criteria for BILLING-READY-03 documented. See `docs/BILLING-READY-02D-CHECKPOINT.md`.

**BILLING-READY-02A/02B/02C — COMPLETE and LOCKED (2026-07-07).** Credit Deduction Pipeline Foundation. Abstract gateway contract (`CreditDeductionGateway`), `NoOpCreditDeductionGateway` and `CalculatingCreditDeductionGateway` implementations, `CreditCalculationService` (deterministic `unitCount × creditsPerUnit` from `CREDIT_RATES`), single runtime wiring point in `UsageLedgerService.updateExecutionResult()`, `CreditDeductionModule` imported into `UsageLedgerModule`. 9 source files + 5 test files. No persistence, no balance enforcement, no Stripe, no entitlement enforcement. See `docs/BILLING-READY-02A-02B-02C-CHECKPOINT.md`.

**BILLING-READY-01A — COMPLETE and LOCKED (2026-07-06).** Produced `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md` and `docs/BILLING-READY-01A-CHECKPOINT.md`. Read-only architecture review complete. All 18 review acceptance criteria satisfied. Recommended Option A (TypeScript-only) for BILLING-READY-01. No implementation. No Stripe/payment calls. No Agent Harness activation.

**BILLING-READY-01 — COMPLETE and LOCKED (2026-07-06).** Credit Ledger Foundation. TypeScript-only credit ledger domain/types/config (Option A), no database migration. 10 source files + 3 test files. 16 tests pass. Typecheck and build clean. See `docs/BILLING-READY-01-CHECKPOINT.md`.

**BILLING-READY-00 — COMPLETE and LOCKED (2026-07-06).** Produced `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md` and `docs/BILLING-READY-00-CHECKPOINT.md`. Audit and planning complete. No implementation. No Stripe/payment calls. No Agent Harness activation. All 19 audit/planning acceptance criteria satisfied.

**AGENT-HARNESS-06C status:** Not registered. Deferred. Runtime canary execution remains a separate explicit future decision by Keith.

**BILLING-READY-04+ status:** Not registered. Deferred. Balance enforcement, Stripe/payment integration, frontend billing UI, and subscription billing all remain future scope after BILLING-READY-03 is complete.

**AGENT-PLATFORM-04 future sequencing note (not registered):** AGENT-PLATFORM-04 — Multi-Builder Runtime Topology Plan should be planned and registered before any multi-builder runtime orchestration, AGENT-HARNESS-07, billing enforcement, or beta activation work begins. Do not register AGENT-PLATFORM-04 now. Do not edit AGENT-PLATFORM-00.

**Keith chose Option C (2026-07-06): BILLING-READY-01A — Billing Implementation Architecture Review. COMPLETE and LOCKED.**

**Candidates that were available (Keith chose Option C — all others deferred):**

_Retained for reference only (decision made — Keith chose Option C):_

- **Option A — BILLING-READY-01:** Credit Ledger Foundation. TypeScript types, static plan definitions, in-memory/DB-backed credit balance tracking. Risk: Low–Medium. **Not registered. Now the recommended next task after BILLING-READY-01A completed.**
- **Option B — AGENT-HARNESS-06C:** Read-Only Harness Canary Execution. Single controlled canary run of Agent Harness tool loop. Risk: Medium (requires Docker + sandbox environment). **Not registered. Deferred.**
- **Option C — BILLING-READY-01A:** Billing Implementation Architecture Review. Deeper read-only architecture review before any code implementation. Risk: Low. **CHOSEN — COMPLETE and LOCKED.**

**Prior step (for reference):**

AGENT-HARNESS-06B — Read-Only Harness Canary Plan — COMPLETE and LOCKED (2026-07-06). Produced `docs/AGENT-HARNESS-06B-CANARY-PLAN.md` and `docs/AGENT-HARNESS-06B-CHECKPOINT.md`. Runtime activation deferred. `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` was not set. No canary execution occurred.

---

## 5. Task Family Ordering Rules

- Knowledge comes before Collaboration.
- Collaboration comes before deeper automation/integrations.
- Billing readiness comes after Knowledge and Collaboration plans are complete.
- Platform UI implementation should not outrun underlying architecture.
- Harness work can interrupt Platform work only when it protects execution safety.
- Only one ACTIVE task at a time unless Keith explicitly approves parallel work.

---

## 6. One Active Task Rule

Only one task may be ACTIVE at a time unless Keith explicitly approves parallel work.

If a second task needs attention urgently, the current ACTIVE task must be paused first. See section 7 for pause/resume rules.

---

## 7. Pause / Resume Rules

- If execution priority changes, pause the current ACTIVE task before registering another ACTIVE task.
- Resume paused tasks only after the interrupting task is COMPLETE and LOCKED.
- Record pause/resume reason in TASKS.md and TASKS_BACKLOG_FULL.md.
- Paused tasks retain their position in the sequence — they are not demoted or deprioritized unless Keith explicitly changes priority.

---

## 8. Drift Prevention Rules

- Do not jump to AGENT-COLLAB-00 before AGENT-KNOWLEDGE-00 unless Keith explicitly changes priority.
- Do not start Billing before Knowledge and Collaboration foundations are planned.
- Do not start external integrations before collaboration and approval gates are planned.
- Do not add new agent runtime behavior before registry, knowledge, collaboration, and approval models are defined.
- Do not activate Agent Harness tool loop unless a validated activation/canary task explicitly does so.
- Do not register or suggest tasks out of sequence without citing this document and recording the deviation reason.

---

## 9. When Priority May Change

Priority may change only for:

- Security/safety issue
- Data loss risk
- Broken build or production-blocking bug
- Harness execution flaw that blocks safe platform work
- Explicit Keith decision

Any priority change must be recorded: who changed it, why, when, and what the new next task is.

---

## 10. What Not To Start Yet

The following must not be started until their prerequisites in the strategic sequence are complete:

- Real Gmail/Slack/Notion integrations
- Legal Advisor implementation
- Stripe/payment integration
- Real multi-agent runtime orchestration
- Walking character/gameplay
- Production Agent Harness activation
- Database schema for collaboration or knowledge unless registered as a dedicated architecture/schema task

---

## 11. Near-Term Sequence

| # | Task | Nature |
|---|------|--------|
| 1 | ROADMAP-00 | This roadmap doc (governance only) |
| 2 | AGENT-KNOWLEDGE-00 | Register + planning doc |
| 3 | AGENT-COLLAB-00 | Register + planning doc |
| 4 | AGENT-HARNESS-06 | Read-only canary readiness review (COMPLETE — NO-GO) |
| 5 | AGENT-HARNESS-06A | Read-only canary hardening slice (COMPLETE) |
| 6 | AGENT-HARNESS-06B | Read-only harness canary plan (COMPLETE and LOCKED) |
| 7 | BILLING-READY-00 | Audit/planning (COMPLETE and LOCKED) |
| 7A | BILLING-READY-01A | Read-only architecture review (**COMPLETE and LOCKED**) |
| 7B | BILLING-READY-01 | Credit Ledger Foundation (**COMPLETE and LOCKED — 2026-07-06**) |
| 7C | BILLING-READY-02A/02B/02C | Credit Deduction Pipeline Foundation (**COMPLETE and LOCKED — 2026-07-07**) |
| 7D | BILLING-READY-02D | Credit Deduction Pipeline — Simulation-Only Validation (**COMPLETE and LOCKED — 2026-07-07**) |
| 7E | BILLING-READY-03 | Credit Balance Persistence Foundation (**ACTIVE — 2026-07-07** — 4 child slices: 03A/03B/03C/03D.) |
| 7E-a | BILLING-READY-03A | Schema and Persistence Design (**COMPLETE and LOCKED — 2026-07-07** — governance/design only. See `docs/BILLING-READY-03A-CHECKPOINT.md`.) |
| 7E-b | BILLING-READY-03B | DB Schema, Migration, and Repository Foundation (**COMPLETE and LOCKED — 2026-07-07** — TypeORM entities, migration, repositories, `CreditPersistenceModule`. 13 suites / 122 tests. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`.) |
| 7E-c | BILLING-READY-03C1 | Persistent Gateway Implementation, Not Runtime-Bound (**COMPLETE and LOCKED — 2026-07-07** — `PersistentCreditDeductionGateway`, generic base class, `sourceEventId` idempotency, overflow capping, unit tests. 11 suites / 136 tests. No runtime swap. See `docs/BILLING-READY-03C1-CHECKPOINT.md`.) |

---

## 12. Medium-Term Sequence

- Knowledge ingestion architecture
- Work object schema planning
- Collaboration protocol implementation slices
- Approval gate implementation slices
- Platform UI improvements
- Agent Harness canary planning

---

## 13. Beta Readiness Sequence

- Billing/credits/entitlement readiness
- Usage limits
- Security/privacy review
- Browser smoke and UX validation
- Harness read-only canary
- Production activation checklist

---

## 14. Update Policy

- Update this roadmap only during explicit roadmap/governance tasks.
- Do not edit this roadmap inside unrelated implementation tasks.
- If priority changes, record who/why/when and the new next task.
- Keep it concise. It is a guide, not a full architecture plan.

---

## 15. Final Notes

- This document is a guardrail, not a straitjacket. Keith can change priority at any time with explicit recorded justification.
- The strategic sequence was agreed after drift occurred (AGENT-COLLAB-00 was suggested before AGENT-KNOWLEDGE-00). This document prevents recurrence.
- Architecture remains in `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md`.
- Active task ledger remains in `TASKS.md`.
- Master backlog remains in `TASKS_BACKLOG_FULL.md`.
- This document adds execution-order governance that those files do not provide.
