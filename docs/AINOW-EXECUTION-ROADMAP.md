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
| BILLING-READY-03C2 | Controlled Runtime Binding for Persistent Deduction Gateway | COMPLETE and LOCKED |
| BILLING-READY-03D1 | Transaction Boundary and Repository Contract Hardening | COMPLETE and LOCKED |
| BILLING-READY-03D2 | Concurrency and Idempotency Integration Validation | COMPLETE and LOCKED |
| BILLING-READY-03D3 | Overflow Semantics Finalization and BILLING-READY-03 Close Checkpoint | COMPLETE and LOCKED |
| BILLING-READY-03 | Credit Balance Persistence Foundation | COMPLETE and LOCKED |
| AGENT-PLATFORM-04 | Multi-Builder Runtime Topology Plan | COMPLETE and LOCKED |

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
| 7E | BILLING-READY-03 | Credit Balance Persistence Foundation (**COMPLETE and LOCKED — 2026-07-07** — all 7 child slices COMPLETE and LOCKED: 03A/03B/03C1/03C2/03D1/03D2/03D3. All 11 parent close criteria satisfied. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 7E-a | BILLING-READY-03A | Schema and Persistence Design | **COMPLETE and LOCKED — 2026-07-07.** Design-only child slice. `CreditBalance` and `CreditDeductionRecord` entity schemas, repository contracts, idempotency model, transaction semantics, migration plan. See `docs/BILLING-READY-03A-CHECKPOINT.md`. |
| 7E-b | BILLING-READY-03B | DB Schema, Migration, and Repository Foundation | **COMPLETE and LOCKED — 2026-07-07.** TypeORM entities (`CreditBalance`, `CreditDeductionRecord`), migration (`gen_random_uuid()`), `CreditBalanceRepository`, `CreditDeductionRecordRepository`, `CreditPersistenceModule`. 8 source files + 6 test files. 13 suites / 122 tests passed. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`. |
| 7E-c | BILLING-READY-03C1 | Persistent Gateway Implementation (Not Runtime-Bound) | **COMPLETE and LOCKED — 2026-07-07.** Third child slice of BILLING-READY-03. `PersistentCreditDeductionGateway` implementation, generic base class update (sync default preserved), `sourceEventId` idempotency, atomic deduction flow, `balanceAfter` population, overflow capping, race condition fallback, unit tests. 3 source files + 1 test file. 11 suites / 136 tests passed (credit-deduction); 14 suites / 152 tests passed (credit). No runtime binding swap (`CalculatingCreditDeductionGateway` remains bound). See `docs/BILLING-READY-03C1-CHECKPOINT.md`. |
| 7E-d | BILLING-READY-03C2 | Controlled Runtime Binding for Persistent Deduction Gateway | **COMPLETE and LOCKED — 2026-07-07.** Fourth child slice of BILLING-READY-03. `CreditDeductionModule` binding swapped to `PersistentCreditDeductionGateway`, `CreditPersistenceModule` imported, `UsageLedgerService.emitDeductionAttempt()` now awaits gateway, failure suppression preserved, DB validation completed. 2 source files + 2 test files. 11 suites / 137 tests (credit-deduction); 14 suites / 153 tests (credit); 2 suites / 45 tests (usage-ledger). See `docs/BILLING-READY-03C2-CHECKPOINT.md`. |
| 7E-e | BILLING-READY-03D1 | Transaction Boundary and Repository Contract Hardening | **COMPLETE and LOCKED — 2026-07-07.** Fifth child slice of BILLING-READY-03. First child slice of BILLING-READY-03D. `PersistentCreditDeductionGateway` wraps deduction flow in single TypeORM `DataSource.transaction()`. Transactional `EntityManager` passed to `findByOwnerForUpdate`, record `create`, and `deductBalance`. `sourceEventId` pre-check outside transaction preserved. 23505 race fallback after rollback preserved. Zero-balance overflow: `balanceAfter` non-negative. 3 source files + 4 test files. 11 suites / 151 tests (credit-deduction); 14 suites / 167 tests (credit). See `docs/BILLING-READY-03D1-CHECKPOINT.md`. |
| 7E-f | BILLING-READY-03D2 | Concurrency and Idempotency Integration Validation | **COMPLETE and LOCKED — 2026-07-07.** Sixth child slice of BILLING-READY-03. Second child slice of BILLING-READY-03D. Live PostgreSQL integration validation of `SELECT ... FOR UPDATE` concurrency, duplicate `sourceEventId` idempotency under race conditions, no double deduction under concurrent same-event execution, non-negative balance under concurrent different-event execution, cleanup verified zero residue. 1 integration spec file created. 6/6 scenarios passed with `RUN_CREDIT_DB_INTEGRATION=true` via one-off `node:20-alpine` container. 151 passed/6 skipped without DB flag. Typecheck and build clean. See `docs/BILLING-READY-03D2-CHECKPOINT.md`. |
| 7E-g | BILLING-READY-03D3 | Overflow Semantics Finalization and BILLING-READY-03 Close Checkpoint (**COMPLETE and LOCKED — 2026-07-07** — Overflow semantics finalized: deductions non-blocking, `appliedCredits` capped at available balance, `creditsOverflow` records unmet credits, `balanceAfter` always >= 0, zero-balance deductions produce `appliedCredits=0`/`creditsOverflow=requestedCredits`/`balanceAfter=0`, line-item overflow sequential, entitlement enforcement deferred to BILLING-READY-04+. All 11 BILLING-READY-03 parent close criteria satisfied. BILLING-READY-03 COMPLETE and LOCKED. No production code changes. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 8 | AGENT-PLATFORM-04 | Multi-Builder Runtime Topology Plan | **COMPLETE and LOCKED — 2026-07-07.** All 4 steps complete. Topology plan: `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md`. Role+profile identity model (agentRole + builderProfileId), 1:1 session/container isolation, per-builder harness config with global fallback, session-scoped preview/checkpoint. AGENT-HARNESS-07 now ACTIVE. AGENT-HARNESS-06C remains deferred. See `docs/AGENT-PLATFORM-04-CHECKPOINT.md`. |
| 9 | AGENT-HARNESS-07 | Per-Builder Harness Config Adapter | **COMPLETE and LOCKED — 2026-07-07.** All 3 child slices COMPLETE and LOCKED: AGENT-HARNESS-07A (builder profile registry + adapter contract), AGENT-HARNESS-07B (Worker Integration + Resolved Config Flow), AGENT-HARNESS-07C (Validation/Regression Matrix and Parent Close Checkpoint). See `docs/AGENT-HARNESS-07-CHECKPOINT.md`. AGENT-HARNESS-06C prerequisite is now satisfied; AGENT-HARNESS-06C registered ACTIVE — Keith explicit approval recorded 2026-07-07. |
| 10 | AGENT-HARNESS-06C | Read-Only Harness Canary Execution | **COMPLETE and LOCKED — 2026-07-07.** All 4 steps COMPLETE. Canary result: PASS — 231 tests, 13 suites, 0 failures. Path: Jest harness test suite / mock executor. No live BullMQ canary (`StubAIAdapter.supportsToolUse = false`). No production activation. No env changes. No source changes. See `docs/AGENT-HARNESS-06C-CHECKPOINT.md`. Future option (not registered): live worker/BullMQ canary with real provider. |
| 11 | AGENT-HARNESS-06D | Live Worker/BullMQ Read-Only Canary Gap Closure | **COMPLETE and LOCKED — 2026-07-08.** All 4 steps complete. Live Worker/BullMQ canary PASS: `selectedPath: 'harness'`; `source: 'builder-profile'`; 3 iterations; 2 tool calls dispatched (`list_files`, `read_file`); HANDLER_ERROR on both (API Gateway not running — expected per design §7.8); `terminationReason: 'completed'`; `durationMs: 33`. No paid calls. No .env changes. No production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06D-CHECKPOINT.md`. |
| 11a | AGENT-HARNESS-06D1 | Test Tool-Capable Stub Adapter for Live Worker Canary | **COMPLETE and LOCKED — 2026-07-08.** Child slice of AGENT-HARNESS-06D. `TestToolCapableStubAdapter` created with `supportsToolUse = true`; deterministic `list_files` — `read_file` — `completed` sequence; zero external API calls; zero billing risk; normal `stub` unchanged; routing/factory wired. 34 suites / 646 tests passed; typecheck and build clean. No live canary executed. No env changes. No production activation. Checkpoint: `docs/AGENT-HARNESS-06D1-CHECKPOINT.md`. |
| 12 | AGENT-HARNESS-06E | Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary | **COMPLETE and LOCKED — 2026-07-09.** All 4 steps complete. Full E2E canary PASS: `list_files` SUCCESS (actual `["README.md", ".git/"]`, not HANDLER_ERROR); `read_file` SUCCESS (actual README.md content, not HANDLER_ERROR); `terminationReason: 'completed'`; `durationMs: 718`; `tokens: 0`; no paid calls; no .env changes; no production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06E-CHECKPOINT.md`. |
| 13 | AGENT-PLATFORM-05 | Multi-Builder Runtime Orchestration Plan | **COMPLETE and LOCKED — 2026-07-09.** All 4 steps complete. Planning/governance only. No implementation. Readiness review: `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md`. Orchestration plan (19 sections): `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-05-CHECKPOINT.md`. Next recommended: AGENT-PLATFORM-06 — Upstream Identity Propagation (COMPLETE and LOCKED). |
| 14 | AGENT-PLATFORM-06 | Upstream Identity Propagation | **COMPLETE and LOCKED — 2026-07-09.** All 4 steps complete. `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` propagated through full execution path (API Gateway → BullMQ → Worker → UsageRecord metadata). 8 files changed. 34 suites / 654 passed; TypeScript clean. No migration. Backward compatible. Checkpoint: `docs/AGENT-PLATFORM-06-CHECKPOINT.md`. |
| 15 | AGENT-PLATFORM-07 | Read-Only Orchestration Coordinator Planning | **COMPLETE and LOCKED — 2026-07-09.** All 4 steps complete. Planning/governance only. No implementation. Source-path review: `docs/AGENT-PLATFORM-07-SOURCE-PATH-REVIEW.md`. Coordinator plan (22 sections): `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-07-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 16 | AGENT-PLATFORM-07A | Coordinator Contracts / Schema | **COMPLETE and LOCKED — 2026-07-09.** All 3 steps complete. TypeScript-only orchestration contracts/schema. `services/api-gateway/src/orchestration/orchestration.contracts.ts` created. `npx tsc --noEmit` exit code 0, no errors. No NestJS providers, no module wiring, no runtime behavior. Checkpoint: `docs/AGENT-PLATFORM-07A-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 17 | AGENT-PLATFORM-07B | API Gateway Orchestration Module Skeleton | **COMPLETE and LOCKED — 2026-07-09.** All 3 steps complete. `OrchestrationModule` + `OrchestrationService` skeleton created; `AppModule` updated. Jest PASS (1 suite, 3 tests). TypeScript clean (exit code 0). No runtime coordinator behavior, no endpoints, no queue enqueue flow, no cancel redesign, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 18 | AGENT-PLATFORM-07C | Read-Only Referral Enqueue Flow + Cancel Redesign | **ACTIVE — Step 2 COMPLETE (Readiness/Design Review — 2026-07-09).** HIGH risk — 4-step loop. Keith approval recorded 2026-07-09. Step 2 COMPLETE: split into 3 child slices approved. 07C1 COMPLETE and LOCKED (2026-07-09). 07C2 next recommended, not registered. 07C3 not registered. Cancel redesign risk downgraded from HIGH to LOW–MEDIUM (obliterate does not exist; cancel already per-execution). AGENT-HARNESS write canary remains a separate track. |
| 18a | AGENT-PLATFORM-07C1 | Orchestration Core Methods + In-Memory Store | **COMPLETE and LOCKED — 2026-07-09.** MEDIUM risk — 3-step child-slice loop. All 3 steps complete. `OrchestrationService` extended with 3 in-memory stores + 7 core methods; safety limits (depth 3, agents 4, loop prevention, idempotency). Jest PASS: 1 suite, 13 tests. TypeScript clean. No enqueue, no cancel, no worker changes, no DB migration, no controller/endpoints. Checkpoint: `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 19 | Beta preparation | Beta readiness checklist | After Billing foundation and multi-builder topology |

---

## 4. Current Next Task

**COMPLETE and LOCKED: AGENT-PLATFORM-07C1 — Orchestration Core Methods + In-Memory Store — 2026-07-09.** MEDIUM risk — 3-step child-slice loop. All 3 steps complete. `OrchestrationService` extended with 3 in-memory stores and 7 core methods. Jest PASS (1 suite, 13 tests). TypeScript clean. No enqueue, no cancel, no worker changes, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.

**NEXT RECOMMENDED (NOT REGISTERED): AGENT-PLATFORM-07C2 — Referral Enqueue + Cancel + AiExecutionJob Extension.** Pending Keith approval. Not registered. AGENT-HARNESS write canary remains a separate track and must not be mixed into AGENT-PLATFORM-07 child slices. AGENT-PLATFORM-07C3 NOT registered.

**AGENT-PLATFORM-07C1 — COMPLETE and LOCKED (2026-07-09).** Orchestration Core Methods + In-Memory Store. MEDIUM risk — 3-step child-slice loop. All 3 steps complete. Checkpoint: `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.

**AGENT-PLATFORM-07C — ACTIVE (parent) — Step 2 COMPLETE (Readiness/Design Review — 2026-07-09).** Read-Only Referral Enqueue Flow + Cancel Redesign. HIGH risk — 4-step loop. Step 2 COMPLETE: split into 3 child slices (07C1/07C2/07C3). 07C1 COMPLETE and LOCKED. 07C2 next recommended, not registered. 07C3 not registered. Cancel redesign risk downgraded from HIGH to LOW–MEDIUM — obliterate does not exist; cancel already per-execution. AGENT-HARNESS write canary remains a separate track.

**AGENT-PLATFORM-07B — COMPLETE and LOCKED — 2026-07-09.** API Gateway Orchestration Module Skeleton. All 3 steps complete. `OrchestrationModule` + `OrchestrationService` skeleton created; `AppModule` updated. Jest PASS (1 suite, 3 tests). TypeScript clean (exit code 0). No runtime coordinator behavior, no endpoints, no queue enqueue flow, no cancel redesign, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.

**AGENT-PLATFORM-07A — COMPLETE and LOCKED (2026-07-09).** Coordinator Contracts / Schema. All 3 steps complete. TypeScript-only contracts/schema delivered. `services/api-gateway/src/orchestration/orchestration.contracts.ts` created. TypeScript clean (`npx tsc --noEmit` exit code 0). No NestJS providers, no module wiring, no runtime behavior, no tests added. Checkpoint: `docs/AGENT-PLATFORM-07A-CHECKPOINT.md`.

**AGENT-PLATFORM-07 — COMPLETE and LOCKED (2026-07-09).** Read-Only Orchestration Coordinator Planning. All 4 steps complete. Planning/governance only. No implementation. Checkpoint: `docs/AGENT-PLATFORM-07-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.

**AGENT-PLATFORM-06 — COMPLETE and LOCKED (2026-07-09).** Upstream Identity Propagation. All 4 steps complete. `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` propagated through full execution path (API Gateway request boundary → BullMQ job payload → Worker → UsageRecord metadata JSONB). 8 files changed (5 production, 3 test). 34 suites / 654 passed; 1 skipped; 0 failed; TypeScript clean in both api-gateway and ai-service. No migration. No frontend UI changes. Backward compatible. Source-path review: `docs/AGENT-PLATFORM-06-SOURCE-PATH-REVIEW.md`. Checkpoint: `docs/AGENT-PLATFORM-06-CHECKPOINT.md`. See `TASKS.md` → AGENT-PLATFORM-06.

**AGENT-PLATFORM-05 — COMPLETE and LOCKED (2026-07-09).** Multi-Builder Runtime Orchestration Plan. All 4 steps complete. Planning/governance only — no implementation, no runtime execution. Readiness review: `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md`. Orchestration plan: `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-05-CHECKPOINT.md`. See `TASKS.md` → AGENT-PLATFORM-05.

**AGENT-HARNESS-06E — COMPLETE and LOCKED (2026-07-09).** Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary. All 4 steps complete. Full E2E canary PASS: `list_files` SUCCESS (actual file data returned, not HANDLER_ERROR); `read_file` SUCCESS (actual README.md content returned, not HANDLER_ERROR); `terminationReason: 'completed'`; `durationMs: 718`; `tokens: 0`; no paid calls; no .env changes; no production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06E-CHECKPOINT.md`.

**AGENT-HARNESS-06D — COMPLETE and LOCKED (2026-07-08).** Live Worker/BullMQ Read-Only Canary Gap Closure. All 4 steps complete. Live Worker/BullMQ canary PASS: `selectedPath: 'harness'`; `source: 'builder-profile'`; 3 iterations; 2 tool calls dispatched (`list_files`, `read_file`); HANDLER_ERROR on both (API Gateway not running — expected per design §7.8); `terminationReason: 'completed'`; `durationMs: 33`. No paid calls. No .env changes. No production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06D-CHECKPOINT.md`.

**AGENT-HARNESS-06D1 — COMPLETE and LOCKED (2026-07-08).** Test Tool-Capable Stub Adapter for Live Worker Canary. Child slice of AGENT-HARNESS-06D. `TestToolCapableStubAdapter` created with `supportsToolUse = true`; deterministic tool calls (`list_files` — `read_file` — `finishReason: 'completed'`); zero external API calls; zero billing risk; normal `stub` unchanged; routing/factory wired; 34 suites / 646 tests passed; typecheck and build clean. No live canary executed in this slice. `AGENT_HARNESS_ENABLE_TOOL_LOOP` remains absent/false in all .env files. Checkpoint: `docs/AGENT-HARNESS-06D1-CHECKPOINT.md`.

**AGENT-HARNESS-06C — COMPLETE and LOCKED (2026-07-07).** Read-Only Harness Canary Execution. All 4 steps COMPLETE. Canary result: PASS — 231 tests, 13 suites, 0 failures. Path: Jest harness test suite / mock executor (stub label). No live BullMQ canary (`StubAIAdapter.supportsToolUse = false`). No production activation. No env changes. No source changes. `AGENT_HARNESS_ENABLE_TOOL_LOOP` remains absent/false in all .env files. See `docs/AGENT-HARNESS-06C-CHECKPOINT.md`.

**AGENT-HARNESS-07C — COMPLETE and LOCKED (2026-07-07).** Validation/Regression Matrix and Parent Close Checkpoint. All 3 steps complete. Regression matrix at `docs/AGENT-HARNESS-07C-REGRESSION-MATRIX.md`. Parent checkpoint at `docs/AGENT-HARNESS-07-CHECKPOINT.md`. All 16 AGENT-HARNESS-07 acceptance criteria satisfied. AGENT-HARNESS-07 marked COMPLETE and LOCKED.

**AGENT-HARNESS-07 — COMPLETE and LOCKED (2026-07-07).** Per-Builder Harness Config Adapter. All 3 child slices COMPLETE and LOCKED: AGENT-HARNESS-07A (builder profile registry + adapter contract, 32 suites / 594 tests), AGENT-HARNESS-07B (Worker Integration + Resolved Config Flow, 33 suites / 629 tests), AGENT-HARNESS-07C (Validation/Regression Matrix). See `docs/AGENT-HARNESS-07-CHECKPOINT.md`. AGENT-HARNESS-06C prerequisite was satisfied; AGENT-HARNESS-06C registered ACTIVE then executed and COMPLETE and LOCKED 2026-07-07.

**AGENT-HARNESS-06D is COMPLETE and LOCKED (2026-07-08).** All 4 steps complete. Live Worker/BullMQ canary PASS. Checkpoint: `docs/AGENT-HARNESS-06D-CHECKPOINT.md`. **AGENT-HARNESS-06D1 is COMPLETE and LOCKED (2026-07-08).** All 3 steps complete. `TestToolCapableStubAdapter` created; routing/types wired; 34 suites / 646 tests passed; typecheck and build clean. Checkpoint: `docs/AGENT-HARNESS-06D1-CHECKPOINT.md`. **AGENT-HARNESS-06E is COMPLETE and LOCKED (2026-07-09).** All 4 steps complete. Full E2E canary PASS. Checkpoint: `docs/AGENT-HARNESS-06E-CHECKPOINT.md`. No new task registered.

**AGENT-PLATFORM-04 — COMPLETE and LOCKED (2026-07-07).**

**BILLING-READY-03D3 — COMPLETE and LOCKED (2026-07-07).** Overflow Semantics Finalization and BILLING-READY-03 Close Checkpoint. Seventh child slice of BILLING-READY-03. Overflow semantics finalized: deductions non-blocking; `appliedCredits = Math.min(totalRequestedCredits, availableBalance)`; `creditsOverflow = Math.max(totalRequestedCredits - availableBalance, 0)`; `balanceAfter` always >= 0; zero-balance deductions produce `appliedCredits=0`/`creditsOverflow=requestedCredits`/`balanceAfter=0`; line-item overflow sequential; entitlement enforcement deferred to BILLING-READY-04+. All 11 BILLING-READY-03 parent close criteria satisfied. BILLING-READY-03 COMPLETE and LOCKED. No production code changes. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.

**BILLING-READY-03D2 — COMPLETE and LOCKED (2026-07-07).** Concurrency and Idempotency Integration Validation. Sixth child slice of BILLING-READY-03. Second child slice of BILLING-READY-03D. Live PostgreSQL integration validation of `SELECT ... FOR UPDATE` concurrency, duplicate `sourceEventId` idempotency under race conditions, no double deduction under concurrent same-event execution, non-negative balance under concurrent different-event execution, cleanup verified zero residue. 1 integration spec file created. 6/6 scenarios passed with `RUN_CREDIT_DB_INTEGRATION=true` via one-off `node:20-alpine` container on `aisandbox2026b_aisandbox-network`. 151 passed/6 skipped without DB flag. Typecheck clean. Build clean. See `docs/BILLING-READY-03D2-CHECKPOINT.md`.

**BILLING-READY-03D1 — COMPLETE and LOCKED (2026-07-07).** Transaction Boundary and Repository Contract Hardening. Fifth child slice of BILLING-READY-03. First child slice of BILLING-READY-03D. `PersistentCreditDeductionGateway` wraps new deduction flow in a single TypeORM `DataSource.transaction()`. Transactional `EntityManager` passed into balance lock, deduction record creation, and balance update. `sourceEventId` pre-check remains outside transaction. 23505 race fallback after transaction rollback preserved. Zero-balance overflow: `balanceAfter` non-negative. 3 source files + 4 test files. 11 suites / 151 tests (credit-deduction); 14 suites / 167 tests (credit). See `docs/BILLING-READY-03D1-CHECKPOINT.md`.

**BILLING-READY-03C2 — COMPLETE and LOCKED (2026-07-07).** Controlled Runtime Binding for Persistent Deduction Gateway. Fourth child slice of BILLING-READY-03. `CreditDeductionModule` binding swapped to `PersistentCreditDeductionGateway`, `CreditPersistenceModule` imported, `UsageLedgerService.emitDeductionAttempt()` now awaits gateway call, failure suppression preserved, DB validation completed. 2 source files + 2 test files. 11 suites / 137 tests (credit-deduction); 14 suites / 153 tests (credit); 2 suites / 45 tests (usage-ledger). See `docs/BILLING-READY-03C2-CHECKPOINT.md`.

**BILLING-READY-03C1 — COMPLETE and LOCKED (2026-07-07).** Persistent Gateway Implementation (Not Runtime-Bound). Third child slice of BILLING-READY-03. `PersistentCreditDeductionGateway` implemented, generic base class update (sync default preserved; async opt-in via type parameter), `sourceEventId` idempotency, atomic deduction flow, `balanceAfter` population, overflow capping, race condition fallback. 3 source files + 1 test file. 11 suites / 136 tests passed; 14 suites / 152 tests passed (credit). No runtime binding swap (`CalculatingCreditDeductionGateway` remains bound). See `docs/BILLING-READY-03C1-CHECKPOINT.md`.

**BILLING-READY-03B — COMPLETE and LOCKED (2026-07-07).** DB Schema, Migration, and Repository Foundation. Second child slice of BILLING-READY-03. TypeORM entities (`CreditBalance`, `CreditDeductionRecord`), database migration (`1772100000000-CreateCreditBalanceAndDeductionTables.ts`, uses `gen_random_uuid()`), `CreditBalanceRepository`, `CreditDeductionRecordRepository`, `CreditPersistenceModule`. 8 source files + 6 test files. 13 suites / 122 tests passed. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`.

**BILLING-READY-03A — COMPLETE and LOCKED (2026-07-07).** Schema and Persistence Design. First child slice of BILLING-READY-03. Governance/design-only. Produced `docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md` defining `CreditBalance` entity, `CreditDeductionRecord` entity, repository contracts, idempotency model, transaction semantics, migration plan, and BILLING-READY-03B acceptance criteria. No implementation files changed. See `docs/BILLING-READY-03A-CHECKPOINT.md`.

**BILLING-READY-03 — COMPLETE and LOCKED (2026-07-07).** Credit Balance Persistence Foundation. DB-backed credit balance persistence, durable deduction records, `sourceEventId` idempotency, `balanceAfter` semantics, `creditsOverflow` enforcement, and audit trail. All 7 child slices COMPLETE and LOCKED (03A, 03B, 03C1, 03C2, 03D1, 03D2, 03D3). All 11 parent close criteria satisfied. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.

**BILLING-READY-02D — COMPLETE and LOCKED (2026-07-07).** Credit Deduction Pipeline — Simulation-Only Validation. Simulation-only validation of the full `CreditDeductionEvent` → `applyDeduction` → `CreditDeductionResult` pipeline. 1 test file modified (`calculating-credit-deduction.gateway.spec.ts`), 2 simulation tests added. No production source changes. 4 suites / 53 tests passed. No persistence, no balance enforcement, no Stripe. Pre-persistence acceptance criteria for BILLING-READY-03 documented. See `docs/BILLING-READY-02D-CHECKPOINT.md`.

**BILLING-READY-02A/02B/02C — COMPLETE and LOCKED (2026-07-07).** Credit Deduction Pipeline Foundation. Abstract gateway contract (`CreditDeductionGateway`), `NoOpCreditDeductionGateway` and `CalculatingCreditDeductionGateway` implementations, `CreditCalculationService` (deterministic `unitCount × creditsPerUnit` from `CREDIT_RATES`), single runtime wiring point in `UsageLedgerService.updateExecutionResult()`, `CreditDeductionModule` imported into `UsageLedgerModule`. 9 source files + 5 test files. No persistence, no balance enforcement, no Stripe, no entitlement enforcement. See `docs/BILLING-READY-02A-02B-02C-CHECKPOINT.md`.

**BILLING-READY-01A — COMPLETE and LOCKED (2026-07-06).** Produced `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md` and `docs/BILLING-READY-01A-CHECKPOINT.md`. Read-only architecture review complete. All 18 review acceptance criteria satisfied. Recommended Option A (TypeScript-only) for BILLING-READY-01. No implementation. No Stripe/payment calls. No Agent Harness activation.

**BILLING-READY-01 — COMPLETE and LOCKED (2026-07-06).** Credit Ledger Foundation. TypeScript-only credit ledger domain/types/config (Option A), no database migration. 10 source files + 3 test files. 16 tests pass. Typecheck and build clean. See `docs/BILLING-READY-01-CHECKPOINT.md`.

**BILLING-READY-00 — COMPLETE and LOCKED (2026-07-06).** Produced `docs/BILLING-READY-00-BILLING-ENTITLEMENT-AUDIT.md` and `docs/BILLING-READY-00-CHECKPOINT.md`. Audit and planning complete. No implementation. No Stripe/payment calls. No Agent Harness activation. All 19 audit/planning acceptance criteria satisfied.

**AGENT-HARNESS-06C status:** COMPLETE and LOCKED — 2026-07-07. Canary result: PASS (231 tests, 13 suites, mock-executor/Jest path). No live BullMQ canary. No production activation. No env changes. No source changes. See `docs/AGENT-HARNESS-06C-CHECKPOINT.md`.

**BILLING-READY-04+ status:** Not registered. Deferred. Balance enforcement, entitlement gating, Stripe/payment integration, frontend billing UI, and subscription billing all remain future scope. BILLING-READY-03 is now COMPLETE and LOCKED, unlocking BILLING-READY-04+ planning when Keith approves.

**AGENT-PLATFORM-04 sequencing (COMPLETE and LOCKED — 2026-07-07):** AGENT-PLATFORM-04 — Multi-Builder Runtime Topology Plan is COMPLETE and LOCKED. Topology plan at `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md`. Checkpoint at `docs/AGENT-PLATFORM-04-CHECKPOINT.md`. AGENT-HARNESS-07 is COMPLETE and LOCKED (2026-07-07) — all 3 child slices (07A, 07B, 07C) COMPLETE and LOCKED. See `docs/AGENT-HARNESS-07-CHECKPOINT.md`. AGENT-HARNESS-06C is COMPLETE and LOCKED (2026-07-07) — canary result: PASS (231 tests, mock-executor/Jest path); no production activation. See `docs/AGENT-HARNESS-06C-CHECKPOINT.md`. Multi-builder collaboration/runtime orchestration: AGENT-PLATFORM-05 COMPLETE and LOCKED (2026-07-09). All 4 steps complete. Checkpoint: `docs/AGENT-PLATFORM-05-CHECKPOINT.md`. Do not edit AGENT-PLATFORM-00.

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
| 7E | BILLING-READY-03 | Credit Balance Persistence Foundation (**COMPLETE and LOCKED — 2026-07-07** — all 7 child slices COMPLETE and LOCKED: 03A/03B/03C1/03C2/03D1/03D2/03D3. All 11 parent close criteria satisfied. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 7E-a | BILLING-READY-03A | Schema and Persistence Design (**COMPLETE and LOCKED — 2026-07-07** — governance/design only. See `docs/BILLING-READY-03A-CHECKPOINT.md`.) |
| 7E-b | BILLING-READY-03B | DB Schema, Migration, and Repository Foundation (**COMPLETE and LOCKED — 2026-07-07** — TypeORM entities, migration, repositories, `CreditPersistenceModule`. 13 suites / 122 tests. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`.) |
| 7E-c | BILLING-READY-03C1 | Persistent Gateway Implementation, Not Runtime-Bound (**COMPLETE and LOCKED — 2026-07-07** — `PersistentCreditDeductionGateway`, generic base class, `sourceEventId` idempotency, overflow capping, unit tests. 11 suites / 136 tests. No runtime swap. See `docs/BILLING-READY-03C1-CHECKPOINT.md`.) |
| 7E-d | BILLING-READY-03C2 | Controlled Runtime Binding for Persistent Deduction Gateway (**COMPLETE and LOCKED — 2026-07-07** — `CreditDeductionModule` binding swapped, `CreditPersistenceModule` imported, `emitDeductionAttempt()` awaits gateway, failure suppression preserved, DB validation completed. 11 suites / 137 tests (credit-deduction); 14 suites / 153 tests (credit). See `docs/BILLING-READY-03C2-CHECKPOINT.md`.) |
| 7E-e | BILLING-READY-03D1 | Transaction Boundary and Repository Contract Hardening (**COMPLETE and LOCKED — 2026-07-07** — `DataSource.transaction()` wraps deduction flow, transactional `EntityManager` passed to lock/insert/update, `sourceEventId` pre-check preserved outside transaction, 23505 race fallback preserved, zero-balance overflow enforced. 3 source files + 4 test files. 11 suites / 151 tests (credit-deduction); 14 suites / 167 tests (credit). See `docs/BILLING-READY-03D1-CHECKPOINT.md`.) |
| 7E-f | BILLING-READY-03D2 | Concurrency and Idempotency Integration Validation (**COMPLETE and LOCKED — 2026-07-07** — live PostgreSQL integration validation of `SELECT ... FOR UPDATE` concurrency, duplicate `sourceEventId` idempotency under race conditions, no double deduction, non-negative balance under concurrent deductions, cleanup verified. 1 integration spec file created. 6/6 integration tests passed with `RUN_CREDIT_DB_INTEGRATION=true`. 151 passed/6 skipped without DB flag. Typecheck and build clean. See `docs/BILLING-READY-03D2-CHECKPOINT.md`.) |
| 7E-g | BILLING-READY-03D3 | Overflow Semantics Finalization and BILLING-READY-03 Close Checkpoint (**COMPLETE and LOCKED — 2026-07-07** — Overflow semantics finalized: deductions non-blocking, `appliedCredits` capped at available balance, `creditsOverflow` records unmet credits, `balanceAfter` always >= 0, zero-balance deductions produce `appliedCredits=0`/`creditsOverflow=requestedCredits`/`balanceAfter=0`, line-item overflow sequential, entitlement enforcement deferred to BILLING-READY-04+. All 11 BILLING-READY-03 parent close criteria satisfied. BILLING-READY-03 COMPLETE and LOCKED. No production code changes. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 8 | AGENT-PLATFORM-04 | Multi-Builder Runtime Topology Plan (**COMPLETE and LOCKED — 2026-07-07** — All 4 steps complete. Role+profile identity model (agentRole + builderProfileId), 1:1 session/container isolation, per-builder harness config with global fallback, session-scoped preview/checkpoint. See `docs/AGENT-PLATFORM-04-CHECKPOINT.md`. AGENT-HARNESS-07 next: ACTIVE. AGENT-HARNESS-06C remains deferred.) |
| 9 | AGENT-HARNESS-07 | Per-Builder Harness Config Adapter (**COMPLETE and LOCKED — 2026-07-07** — All 3 child slices COMPLETE and LOCKED: AGENT-HARNESS-07A (builder profile registry + adapter contract), AGENT-HARNESS-07B (Worker Integration + Resolved Config Flow), AGENT-HARNESS-07C (Validation/Regression Matrix and Parent Close Checkpoint). See `docs/AGENT-HARNESS-07-CHECKPOINT.md`. AGENT-HARNESS-06C prerequisite is now satisfied; AGENT-HARNESS-06C registered ACTIVE — Keith explicit approval recorded 2026-07-07.) |
| 10 | AGENT-HARNESS-06C | Read-Only Harness Canary Execution (**COMPLETE and LOCKED — 2026-07-07** — All 4 steps COMPLETE. Canary result: PASS — 231 tests, 13 suites, 0 failures. Jest harness test suite / mock executor. No live BullMQ canary. No production activation. No env changes. See `docs/AGENT-HARNESS-06C-CHECKPOINT.md`.) |
| 11 | AGENT-HARNESS-06D | Live Worker/BullMQ Read-Only Canary Gap Closure (**COMPLETE and LOCKED — 2026-07-08** — All 4 steps complete. Live Worker/BullMQ canary PASS: `selectedPath: 'harness'`; `source: 'builder-profile'`; 3 iterations; 2 tool calls dispatched; HANDLER_ERROR on `list_files`/`read_file` (API Gateway not running — expected per design §7.8); `terminationReason: 'completed'`; `durationMs: 33`. No paid calls. No .env changes. No production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06D-CHECKPOINT.md`.) |
| 11a | AGENT-HARNESS-06D1 | Test Tool-Capable Stub Adapter for Live Worker Canary (**COMPLETE and LOCKED — 2026-07-08** — Child slice of 06D. `TestToolCapableStubAdapter` created with `supportsToolUse = true`; deterministic; zero billing; normal `stub` unchanged; routing wired. 34 suites / 646 tests. No live canary. No env changes. Checkpoint: `docs/AGENT-HARNESS-06D1-CHECKPOINT.md`.) |
| 12 | AGENT-HARNESS-06E | Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary (**COMPLETE and LOCKED — 2026-07-09** — All 4 steps complete. Full E2E canary PASS: `list_files`/`read_file` SUCCESS (actual file data, not HANDLER_ERROR); `durationMs: 718`; `tokens: 0`; no paid calls; no .env changes. Checkpoint: `docs/AGENT-HARNESS-06E-CHECKPOINT.md`.) |
| 13 | AGENT-PLATFORM-05 | Multi-Builder Runtime Orchestration Plan (**COMPLETE and LOCKED — 2026-07-09** — All 4 steps complete. Planning/governance only. No implementation. Readiness review: `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md`. Orchestration plan: `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-05-CHECKPOINT.md`. Next recommended: AGENT-PLATFORM-06 — Upstream Identity Propagation, COMPLETE and LOCKED.) |
| 14 | AGENT-PLATFORM-06 | Upstream Identity Propagation (**COMPLETE and LOCKED — 2026-07-09** — All 4 steps complete. `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` propagated through full execution path. 8 files changed. 34 suites / 654 passed; TypeScript clean. No migration. Backward compatible. Checkpoint: `docs/AGENT-PLATFORM-06-CHECKPOINT.md`.) |
| 15 | AGENT-PLATFORM-07 | Read-Only Orchestration Coordinator Planning (**COMPLETE and LOCKED — 2026-07-09** — All 4 steps complete. Planning/governance only. No implementation. Source-path review: `docs/AGENT-PLATFORM-07-SOURCE-PATH-REVIEW.md`. Coordinator plan (22 sections): `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-07-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 16 | AGENT-PLATFORM-07A | Coordinator Contracts / Schema (**COMPLETE and LOCKED — 2026-07-09** — All 3 steps complete. TypeScript-only orchestration contracts/schema. `services/api-gateway/src/orchestration/orchestration.contracts.ts` created. `npx tsc --noEmit` exit code 0. No NestJS providers, no module wiring, no runtime behavior. Checkpoint: `docs/AGENT-PLATFORM-07A-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 17 | AGENT-PLATFORM-07B | API Gateway Orchestration Module Skeleton (**COMPLETE and LOCKED — 2026-07-09** — All 3 steps complete. `OrchestrationModule` + `OrchestrationService` skeleton created; `AppModule` updated. Jest PASS (1 suite, 3 tests). TypeScript clean (exit code 0). No runtime coordinator behavior, no endpoints, no queue enqueue flow, no cancel redesign, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 18 | AGENT-PLATFORM-07C | Read-Only Referral Enqueue Flow + Cancel Redesign (**ACTIVE — Step 2 COMPLETE — Readiness/Design Review — 2026-07-09** — HIGH risk — 4-step loop. Keith approval recorded 2026-07-09. Step 2 COMPLETE: split into 3 child slices approved. 07C1 COMPLETE and LOCKED (2026-07-09). 07C2 next recommended, not registered. 07C3 not registered. Cancel redesign risk downgraded from HIGH to LOW–MEDIUM (obliterate does not exist; cancel already per-execution via `ExecutionResultService.requestCancel(executionId)`). AGENT-HARNESS write canary remains a separate track.) |
| 18a | AGENT-PLATFORM-07C1 | Orchestration Core Methods + In-Memory Store (**COMPLETE and LOCKED — 2026-07-09** — MEDIUM risk — 3-step child-slice loop. All 3 steps complete. `OrchestrationService` extended with 3 in-memory stores + 7 core methods (`createCollaborationRun`, `getCollaborationRun`, `createReferral`, `getReferral`, `completeReferral`, `failReferral`, `validateReferral`); safety limits (depth 3, agents 4, loop prevention, idempotency). Jest PASS: 1 suite, 13 tests. TypeScript clean. No enqueue, no cancel, no worker changes, no DB migration, no controller/endpoints. Checkpoint: `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |

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
