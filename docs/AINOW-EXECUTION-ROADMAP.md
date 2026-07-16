# AINOW-EXECUTION-ROADMAP �X ainow.biz Execution Roadmap and Priority Guardrails

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
| BILLING-READY-02D | Credit Deduction Pipeline �X Simulation-Only Validation | COMPLETE and LOCKED |
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
| 6 | AGENT-HARNESS-06 | Read-Only Harness Canary Readiness Review | COMPLETE �X NO-GO finding |
| 6A | AGENT-HARNESS-06A | Read-Only Canary Hardening Slice | COMPLETE |
| 6B | AGENT-HARNESS-06B | Read-Only Harness Canary Plan | COMPLETE and LOCKED |
| 7 | BILLING-READY-00 | Billing, Plan, Credit, and Entitlement Audit | **COMPLETE and LOCKED** �X 2026-07-06. Audit/planning complete. No implementation. See `docs/BILLING-READY-00-CHECKPOINT.md`. |
| 7A | BILLING-READY-01A | Billing Implementation Architecture Review | **COMPLETE and LOCKED** �X 2026-07-06. Read-only architecture review complete. All 18 criteria satisfied. Option A recommended for BILLING-READY-01. See `docs/BILLING-READY-01A-CHECKPOINT.md`. |
| 7B | BILLING-READY-01 | Credit Ledger Foundation | **COMPLETE and LOCKED �X 2026-07-06.** TypeScript-only credit ledger domain/types/config (Option A). 10 source files + 3 test files. 16 tests pass. No database migration. See `docs/BILLING-READY-01-CHECKPOINT.md`. |
| 7C | BILLING-READY-02A/02B/02C | Credit Deduction Pipeline Foundation | **COMPLETE and LOCKED �X 2026-07-07.** Abstract gateway contract, NoOp + calculating implementations, single runtime wiring point in usage-ledger, deterministic credit calculation layer. 9 source files + 5 test files. No persistence, no balance enforcement, no Stripe. See `docs/BILLING-READY-02A-02B-02C-CHECKPOINT.md`. |
| 7D | BILLING-READY-02D | Credit Deduction Pipeline �X Simulation-Only Validation | **COMPLETE and LOCKED �X 2026-07-07.** Simulation-only validation of the full `CreditDeductionEvent` �� `applyDeduction` �� `CreditDeductionResult` pipeline. 1 test file modified, 2 simulation tests added. No production source changes. 4 suites / 53 tests passed. See `docs/BILLING-READY-02D-CHECKPOINT.md`. |
| 7E | BILLING-READY-03 | Credit Balance Persistence Foundation (**COMPLETE and LOCKED �X 2026-07-07** �X all 7 child slices COMPLETE and LOCKED: 03A/03B/03C1/03C2/03D1/03D2/03D3. All 11 parent close criteria satisfied. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 7E-a | BILLING-READY-03A | Schema and Persistence Design | **COMPLETE and LOCKED �X 2026-07-07.** Design-only child slice. `CreditBalance` and `CreditDeductionRecord` entity schemas, repository contracts, idempotency model, transaction semantics, migration plan. See `docs/BILLING-READY-03A-CHECKPOINT.md`. |
| 7E-b | BILLING-READY-03B | DB Schema, Migration, and Repository Foundation | **COMPLETE and LOCKED �X 2026-07-07.** TypeORM entities (`CreditBalance`, `CreditDeductionRecord`), migration (`gen_random_uuid()`), `CreditBalanceRepository`, `CreditDeductionRecordRepository`, `CreditPersistenceModule`. 8 source files + 6 test files. 13 suites / 122 tests passed. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`. |
| 7E-c | BILLING-READY-03C1 | Persistent Gateway Implementation (Not Runtime-Bound) | **COMPLETE and LOCKED �X 2026-07-07.** Third child slice of BILLING-READY-03. `PersistentCreditDeductionGateway` implementation, generic base class update (sync default preserved), `sourceEventId` idempotency, atomic deduction flow, `balanceAfter` population, overflow capping, race condition fallback, unit tests. 3 source files + 1 test file. 11 suites / 136 tests passed (credit-deduction); 14 suites / 152 tests passed (credit). No runtime binding swap (`CalculatingCreditDeductionGateway` remains bound). See `docs/BILLING-READY-03C1-CHECKPOINT.md`. |
| 7E-d | BILLING-READY-03C2 | Controlled Runtime Binding for Persistent Deduction Gateway | **COMPLETE and LOCKED �X 2026-07-07.** Fourth child slice of BILLING-READY-03. `CreditDeductionModule` binding swapped to `PersistentCreditDeductionGateway`, `CreditPersistenceModule` imported, `UsageLedgerService.emitDeductionAttempt()` now awaits gateway, failure suppression preserved, DB validation completed. 2 source files + 2 test files. 11 suites / 137 tests (credit-deduction); 14 suites / 153 tests (credit); 2 suites / 45 tests (usage-ledger). See `docs/BILLING-READY-03C2-CHECKPOINT.md`. |
| 7E-e | BILLING-READY-03D1 | Transaction Boundary and Repository Contract Hardening | **COMPLETE and LOCKED �X 2026-07-07.** Fifth child slice of BILLING-READY-03. First child slice of BILLING-READY-03D. `PersistentCreditDeductionGateway` wraps deduction flow in single TypeORM `DataSource.transaction()`. Transactional `EntityManager` passed to `findByOwnerForUpdate`, record `create`, and `deductBalance`. `sourceEventId` pre-check outside transaction preserved. 23505 race fallback after rollback preserved. Zero-balance overflow: `balanceAfter` non-negative. 3 source files + 4 test files. 11 suites / 151 tests (credit-deduction); 14 suites / 167 tests (credit). See `docs/BILLING-READY-03D1-CHECKPOINT.md`. |
| 7E-f | BILLING-READY-03D2 | Concurrency and Idempotency Integration Validation | **COMPLETE and LOCKED �X 2026-07-07.** Sixth child slice of BILLING-READY-03. Second child slice of BILLING-READY-03D. Live PostgreSQL integration validation of `SELECT ... FOR UPDATE` concurrency, duplicate `sourceEventId` idempotency under race conditions, no double deduction under concurrent same-event execution, non-negative balance under concurrent different-event execution, cleanup verified zero residue. 1 integration spec file created. 6/6 scenarios passed with `RUN_CREDIT_DB_INTEGRATION=true` via one-off `node:20-alpine` container. 151 passed/6 skipped without DB flag. Typecheck and build clean. See `docs/BILLING-READY-03D2-CHECKPOINT.md`. |
| 7E-g | BILLING-READY-03D3 | Overflow Semantics Finalization and BILLING-READY-03 Close Checkpoint (**COMPLETE and LOCKED �X 2026-07-07** �X Overflow semantics finalized: deductions non-blocking, `appliedCredits` capped at available balance, `creditsOverflow` records unmet credits, `balanceAfter` always >= 0, zero-balance deductions produce `appliedCredits=0`/`creditsOverflow=requestedCredits`/`balanceAfter=0`, line-item overflow sequential, entitlement enforcement deferred to BILLING-READY-04+. All 11 BILLING-READY-03 parent close criteria satisfied. BILLING-READY-03 COMPLETE and LOCKED. No production code changes. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 8 | AGENT-PLATFORM-04 | Multi-Builder Runtime Topology Plan | **COMPLETE and LOCKED �X 2026-07-07.** All 4 steps complete. Topology plan: `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md`. Role+profile identity model (agentRole + builderProfileId), 1:1 session/container isolation, per-builder harness config with global fallback, session-scoped preview/checkpoint. AGENT-HARNESS-07 now ACTIVE. AGENT-HARNESS-06C remains deferred. See `docs/AGENT-PLATFORM-04-CHECKPOINT.md`. |
| 9 | AGENT-HARNESS-07 | Per-Builder Harness Config Adapter | **COMPLETE and LOCKED �X 2026-07-07.** All 3 child slices COMPLETE and LOCKED: AGENT-HARNESS-07A (builder profile registry + adapter contract), AGENT-HARNESS-07B (Worker Integration + Resolved Config Flow), AGENT-HARNESS-07C (Validation/Regression Matrix and Parent Close Checkpoint). See `docs/AGENT-HARNESS-07-CHECKPOINT.md`. AGENT-HARNESS-06C prerequisite is now satisfied; AGENT-HARNESS-06C registered ACTIVE �X Keith explicit approval recorded 2026-07-07. |
| 10 | AGENT-HARNESS-06C | Read-Only Harness Canary Execution | **COMPLETE and LOCKED �X 2026-07-07.** All 4 steps COMPLETE. Canary result: PASS �X 231 tests, 13 suites, 0 failures. Path: Jest harness test suite / mock executor. No live BullMQ canary (`StubAIAdapter.supportsToolUse = false`). No production activation. No env changes. No source changes. See `docs/AGENT-HARNESS-06C-CHECKPOINT.md`. Future option (not registered): live worker/BullMQ canary with real provider. |
| 11 | AGENT-HARNESS-06D | Live Worker/BullMQ Read-Only Canary Gap Closure | **COMPLETE and LOCKED �X 2026-07-08.** All 4 steps complete. Live Worker/BullMQ canary PASS: `selectedPath: 'harness'`; `source: 'builder-profile'`; 3 iterations; 2 tool calls dispatched (`list_files`, `read_file`); HANDLER_ERROR on both (API Gateway not running �X expected per design ��7.8); `terminationReason: 'completed'`; `durationMs: 33`. No paid calls. No .env changes. No production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06D-CHECKPOINT.md`. |
| 11a | AGENT-HARNESS-06D1 | Test Tool-Capable Stub Adapter for Live Worker Canary | **COMPLETE and LOCKED �X 2026-07-08.** Child slice of AGENT-HARNESS-06D. `TestToolCapableStubAdapter` created with `supportsToolUse = true`; deterministic `list_files` �X `read_file` �X `completed` sequence; zero external API calls; zero billing risk; normal `stub` unchanged; routing/factory wired. 34 suites / 646 tests passed; typecheck and build clean. No live canary executed. No env changes. No production activation. Checkpoint: `docs/AGENT-HARNESS-06D1-CHECKPOINT.md`. |
| 12 | AGENT-HARNESS-06E | Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary | **COMPLETE and LOCKED �X 2026-07-09.** All 4 steps complete. Full E2E canary PASS: `list_files` SUCCESS (actual `["README.md", ".git/"]`, not HANDLER_ERROR); `read_file` SUCCESS (actual README.md content, not HANDLER_ERROR); `terminationReason: 'completed'`; `durationMs: 718`; `tokens: 0`; no paid calls; no .env changes; no production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06E-CHECKPOINT.md`. |
| 13 | AGENT-PLATFORM-05 | Multi-Builder Runtime Orchestration Plan | **COMPLETE and LOCKED �X 2026-07-09.** All 4 steps complete. Planning/governance only. No implementation. Readiness review: `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md`. Orchestration plan (19 sections): `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-05-CHECKPOINT.md`. Next recommended: AGENT-PLATFORM-06 �X Upstream Identity Propagation (COMPLETE and LOCKED). |
| 14 | AGENT-PLATFORM-06 | Upstream Identity Propagation | **COMPLETE and LOCKED �X 2026-07-09.** All 4 steps complete. `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` propagated through full execution path (API Gateway �� BullMQ �� Worker �� UsageRecord metadata). 8 files changed. 34 suites / 654 passed; TypeScript clean. No migration. Backward compatible. Checkpoint: `docs/AGENT-PLATFORM-06-CHECKPOINT.md`. |
| 15 | AGENT-PLATFORM-07 | Read-Only Orchestration Coordinator Planning | **COMPLETE and LOCKED �X 2026-07-09.** All 4 steps complete. Planning/governance only. No implementation. Source-path review: `docs/AGENT-PLATFORM-07-SOURCE-PATH-REVIEW.md`. Coordinator plan (22 sections): `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-07-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 16 | AGENT-PLATFORM-07A | Coordinator Contracts / Schema | **COMPLETE and LOCKED �X 2026-07-09.** All 3 steps complete. TypeScript-only orchestration contracts/schema. `services/api-gateway/src/orchestration/orchestration.contracts.ts` created. `npx tsc --noEmit` exit code 0, no errors. No NestJS providers, no module wiring, no runtime behavior. Checkpoint: `docs/AGENT-PLATFORM-07A-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 17 | AGENT-PLATFORM-07B | API Gateway Orchestration Module Skeleton | **COMPLETE and LOCKED �X 2026-07-09.** All 3 steps complete. `OrchestrationModule` + `OrchestrationService` skeleton created; `AppModule` updated. Jest PASS (1 suite, 3 tests). TypeScript clean (exit code 0). No runtime coordinator behavior, no endpoints, no queue enqueue flow, no cancel redesign, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 18 | AGENT-PLATFORM-07C | Read-Only Referral Enqueue Flow + Cancel Redesign | **COMPLETE and LOCKED �X 2026-07-10.** HIGH risk �X 4-step loop. All 4 steps complete. All 3 child slices COMPLETE and LOCKED: 07C1 COMPLETE and LOCKED (2026-07-09), 07C2 COMPLETE and LOCKED (2026-07-09), 07C3 COMPLETE and LOCKED (2026-07-10). Cancel redesign risk downgraded from HIGH to LOW�VMEDIUM (obliterate does not exist; cancel already per-execution). Parent checkpoint: `docs/AGENT-PLATFORM-07C-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 18a | AGENT-PLATFORM-07C1 | Orchestration Core Methods + In-Memory Store | **COMPLETE and LOCKED �X 2026-07-09.** MEDIUM risk �X 3-step child-slice loop. All 3 steps complete. `OrchestrationService` extended with 3 in-memory stores + 7 core methods; safety limits (depth 3, agents 4, loop prevention, idempotency). Jest PASS: 1 suite, 13 tests. TypeScript clean. No enqueue, no cancel, no worker changes, no DB migration, no controller/endpoints. Checkpoint: `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 18b | AGENT-PLATFORM-07C2 | Referral Enqueue + Cancel + AiExecutionJob Extension | **COMPLETE and LOCKED �X 2026-07-09.** HIGH risk �X 4-step loop. All 4 steps complete. `startReferralExecution()`, `cancelReferral()`, `cancelCollaboration()` added; `AiExecutionJob` extended with 5 new optional fields; worker finalization preserves new fields. Jest PASS: `orchestration.service` 25 tests; `worker.processor.builder-config` 55 tests. TypeScript clean. Checkpoint: `docs/AGENT-PLATFORM-07C2-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 18c | AGENT-PLATFORM-07C3 | Targeted Tests and Parent Consolidation | **COMPLETE and LOCKED �X 2026-07-10.** MEDIUM risk �X 3-step child-slice loop. All 3 steps complete. Targeted validation/regression PASS: `orchestration.service` 25 tests; `worker.processor.builder-config` 55 tests; api-gateway/ai-service tsc PASS. No implementation changes. Checkpoint: `docs/AGENT-PLATFORM-07C3-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 19 | AGENT-PLATFORM-07D | Collaboration Audit Events | **COMPLETE and LOCKED �X 2026-07-10.** MEDIUM/HIGH risk �X 4-step loop. All 4 steps complete. `InMemoryOrchestrationAuditRecorder` created; 8 event types emitted at OrchestrationService lifecycle transitions; 40 tests pass; TypeScript clean. No contract changes, no worker changes, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07D-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 20 | AGENT-PLATFORM-07E | Read-Only Coordinator Canary | **COMPLETE and LOCKED �X 2026-07-10.** HIGH risk �X 4-step loop. All 4 steps complete. Unit/in-process canary PASS: Option A (mocked `QueueService` + `ExecutionResultService`); 16 canary tests; 40 regression tests; TypeScript clean. Preflight: `docs/AGENT-PLATFORM-07E-CANARY-READINESS-PREFLIGHT.md`. Execution report: `docs/AGENT-PLATFORM-07E-CANARY-EXECUTION-REPORT.md`. Checkpoint: `docs/AGENT-PLATFORM-07E-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21 | AGENT-PLATFORM-07F | Live Runtime Orchestration Integration Canary | **COMPLETE and LOCKED �X 2026-07-12.** HIGH risk �X 4-step loop. All 4 steps complete. Keith approval recorded. Split decision: 07F �� child slices 07F1 (COMPLETE and LOCKED), 07F2 (COMPLETE and LOCKED), 07F3 (COMPLETE and LOCKED). Preflight: `docs/AGENT-PLATFORM-07F-LIVE-RUNTIME-CANARY-PREFLIGHT.md`. Checkpoint: `docs/AGENT-PLATFORM-07F-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21a | AGENT-PLATFORM-07F1 | Queue Transport + Metadata Preservation Canary | **COMPLETE and LOCKED �X 2026-07-10.** HIGH risk �X 4-step child-slice loop. All 4 steps complete. Live runtime canary PASS. Execution ID: `8da5403a-f20e-480e-b7d8-196b18f7faef`. `stub` provider; zero tokens; zero provider/API calls. 9 orchestration fields verified in `usage_records.metadata` JSONB. Docker + PostgreSQL + Redis + AI Service Worker (no API Gateway, no container-manager). Cleanup complete. Readiness: `docs/AGENT-PLATFORM-07F1-RUNTIME-EXECUTION-READINESS.md`. Report: `docs/AGENT-PLATFORM-07F1-RUNTIME-CANARY-EXECUTION-REPORT.md`. Checkpoint: `docs/AGENT-PLATFORM-07F1-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21b | AGENT-PLATFORM-07F2 | Cancel Signal Path Canary | **COMPLETE and LOCKED �X 2026-07-10.** HIGH risk �X 4-step child-slice loop. All 4 steps complete. Cancel signal path canary PASS. All 18 pass criteria satisfied. `running` �� `cancel_requested` SQL confirmed; negative test (completed row) confirmed 0 rows updated. Docker + PostgreSQL only (no Redis, no BullMQ, no Worker, no API Gateway, no container-manager). Cleanup: 2 rows deleted, 0 remaining. Readiness: `docs/AGENT-PLATFORM-07F2-CANCEL-SIGNAL-READINESS.md`. Report: `docs/AGENT-PLATFORM-07F2-CANCEL-SIGNAL-CANARY-EXECUTION-REPORT.md`. Checkpoint: `docs/AGENT-PLATFORM-07F2-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21c | AGENT-PLATFORM-07F3 | Consolidation Checkpoint | **COMPLETE and LOCKED �X 2026-07-12.** Parent: AGENT-PLATFORM-07F. 3-step child-slice loop. All 3 steps complete. Parent consolidation/checkpoint. No implementation. No runtime execution. Checkpoint: `docs/AGENT-PLATFORM-07F3-CHECKPOINT.md`. AGENT-HARNESS write canary remains separate. |
| 21d | BILLING-READY-04 | Balance Enforcement, Entitlement Gating, and Billing Foundation Phase 2 | **COMPLETE and LOCKED — 2026-07-13.** HIGH risk — 4-step loop. All 4 steps complete. All child slices COMPLETE and LOCKED: 04A/04B/04C/04D. Regression matrix PASS — 12/12 commands. No Stripe/payment/provider. No migration. No frontend. Checkpoint: `docs/BILLING-READY-04-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. **BILLING-READY-05 ACTIVE — Step 1 COMPLETE (Registration — 2026-07-13).** |
| 21d-i | BILLING-READY-04A | API Gateway Balance Gate Foundation | **COMPLETE and LOCKED �X 2026-07-13.** HIGH risk �X 4-step child-slice loop. All 4 steps complete. Parent: BILLING-READY-04 (COMPLETE and LOCKED). `CreditBalanceGuard` implemented and wired. 24/24 unit tests PASS. 68/68 controller tests PASS. 30/30 integration tests PASS (test-only validation fix). 31/31 guard integration tests PASS. TypeScript clean. No migration, no frontend, no Stripe. Checkpoint: `docs/BILLING-READY-04A-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21d-ii | BILLING-READY-04B | Execution-Start Gate Wiring | **COMPLETE and LOCKED �X 2026-07-13.** HIGH risk �X 4-step child-slice loop. All 4 steps complete. Parent: BILLING-READY-04 (COMPLETE and LOCKED). Decision: validation-only �X no production changes. 1 new test file. 13/13 integration tests PASS; 37/37 guard unit tests PASS; 68/68 controller tests PASS; 3/3 public-api tests PASS; TypeScript clean. No migration, no frontend, no Stripe. Checkpoint: `docs/BILLING-READY-04B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21d-iii | BILLING-READY-04C | Worker Finalization / Accounting Guardrails | **COMPLETE and LOCKED �X 2026-07-13.** HIGH risk �X 4-step child-slice loop. All 4 steps complete. Parent: BILLING-READY-04 (COMPLETE and LOCKED). Critical finding: credit deduction had never fired in async BullMQ flow. Finalization bridge implemented: worker �� `notifyExecutionComplete` �� `POST /api/internal/executions/:id/finalize-accounting` �� `triggerDeductionForExecution`. 56/56 usage-ledger PASS; 6/6 internal-accounting PASS; 25/25 api-gateway-http.client PASS; 135/135 worker.processor PASS; TypeScript clean; linter 0 errors. No migration, no frontend, no Stripe. Checkpoint: `docs/BILLING-READY-04C-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
|| 21d-iv | BILLING-READY-04D | Regression Matrix + Parent Consolidation | **COMPLETE and LOCKED — 2026-07-13.** HIGH risk — 4-step child-slice loop. All 4 steps complete. Parent: BILLING-READY-04 (COMPLETE and LOCKED). Validation-only — no implementation in 04D. Regression matrix PASS — 12/12 commands, zero failures. All 04A/04B/04C test suites PASS; both service typechecks exit 0. Checkpoint: `docs/BILLING-READY-04D-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21e | BILLING-READY-05 | Stripe / Payment Provider Integration, Subscription Lifecycle, Credit Top-Up | **COMPLETE and LOCKED — 2026-07-16.** HIGH risk — 4-step loop — all 4 parent steps complete. Step 2 COMPLETE — Stripe selected — split into 05A–05G approved by Keith 2026-07-13. All child slices COMPLETE and LOCKED: 05A (2026-07-15), 05B (2026-07-15), 05C (2026-07-15), 05D (2026-07-15), 05E (2026-07-15), 05F (2026-07-15), 05G (2026-07-16). Static regression matrix PASS. Migration execution deferred. Docker/Postgres/Redis/runtime/browser/provider deferred — owned by BILLING-READY-06. No Stripe SDK. No env/secrets changes. Checkpoint: `docs/BILLING-READY-05-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21e-i | BILLING-READY-05A | Provider Configuration / Contracts / Readiness | **COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. First child slice of BILLING-READY-05. 4 production files + 3 test files. 79 tests PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No frontend. Checkpoint: `docs/BILLING-READY-05A-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21e-ii | BILLING-READY-05B | Customer / Subscription Persistence | **COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Second child slice of BILLING-READY-05. 4 production files + 2 migration files (not executed) + 4 test files. 53/53 subscription tests PASS. 74/74 credit-balance regression PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No real migration execution. No frontend. Checkpoint: `docs/BILLING-READY-05B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21e-iii | BILLING-READY-05C | Checkout / Credit Top-Up Session Creation | **COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Third child slice of BILLING-READY-05. 9 production files created + 1 modified (`app.module.ts`) + 4 test files. 58/58 checkout tests PASS. `stripe-payment.provider` 49/49 PASS. `charge-readiness.service` 15/15 PASS. `credit-balance` 74/74 regression PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No frontend. Checkpoint: `docs/BILLING-READY-05C-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21e-iv | BILLING-READY-05D | Webhook Event Ingestion / Idempotency | **COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Fourth child slice of BILLING-READY-05. 6 production files created + 3 modified (`entities/index.ts`, `main.ts` rawBody:true, `app.module.ts`) + 6 test files. webhook 108/108 PASS (6 suites). Regression: `stripe-payment.provider` 49/49, `subscription` 53/53, `checkout` 58/58, `credit-balance` 74/74. Total: 342/342 PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. Migration created, NOT executed. No frontend. Checkpoint: `docs/BILLING-READY-05D-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21e-v | BILLING-READY-05E | Credit Grant / Top-Up Accounting | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Fifth child slice of BILLING-READY-05. 6 production files created + 4 modified (entities/index.ts, credit-balance.repository.ts, webhook.service.ts, webhook.module.ts) + 6 test files. credit-grant 96/96 PASS (6 suites). Regression: webhook 108/108, credit-balance 74/74, checkout 58/58, usage-ledger 60/60. Total: 96 new + 300 regression = 396/396 PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. Migration created, NOT executed. No frontend. Checkpoint: docs/BILLING-READY-05E-CHECKPOINT.md. AGENT-HARNESS write canary remains a separate track.) |
|| 21e-vi | BILLING-READY-05F | Billing UI / Customer Portal | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Sixth child slice of BILLING-READY-05. 3 backend files created + 1 modified (app.module.ts) + 7 frontend files created + 3 translation files modified (30 keys per locale, billing namespace). billing-read 12/12 PASS; billing-page-client 22/22 PASS; checkout 58/58 PASS; frontend 640/640 PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No customer portal backend endpoint. No browser smoke. Checkpoint: `docs/BILLING-READY-05F-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 21e-vii | BILLING-READY-05G | Regression / Runtime Validation + Parent Consolidation | **COMPLETE and LOCKED — 2026-07-16.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Seventh/final planned child slice of BILLING-READY-05. Decision A: static/test-only validation. R1–R13 PASS (621 backend tests), T1–T3 PASS, F1 corrected PASS (22 tests — Jest TSX/JSX transform mismatch; tooling only; no source defect), F2 PASS (640 frontend tests), B1 PASS. Migration execution deferred. Docker/Postgres/Redis/runtime/browser/provider deferred. No source changes. No subagents. Checkpoint: `docs/BILLING-READY-05G-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21f | BILLING-READY-06 | Local Runtime / Migration / Browser Smoke Validation Plan | **ACTIVE — Step 1 COMPLETE (Registration — 2026-07-16). Step 2 COMPLETE (2026-07-16).** HIGH risk — 4-step loop. Decision B split: 06A (Docker/DB/Migration) + 06B (Backend + Browser Smoke). Readiness: `docs/BILLING-READY-06-RUNTIME-MIGRATION-BROWSER-SMOKE-READINESS.md`. BILLING-READY-06A COMPLETE and LOCKED (2026-07-16) — Checkpoint: `docs/BILLING-READY-06A-CHECKPOINT.md`. BILLING-READY-06B planned only / next recommended / not registered. BILLING-READY-05 remains COMPLETE and LOCKED. AGENT-HARNESS write canary remains a separate track. Next: BILLING-READY-06B (not registered — requires Keith approval). |
| 21f-i | BILLING-READY-06A | Docker / Local DB / Migration Validation | **COMPLETE and LOCKED — 2026-07-16.** HIGH risk — 4-step child-slice loop — all 4 steps complete. First child slice of BILLING-READY-06 (Decision B). Docker v29.2.1 / Compose v5.0.2 PASS. PostgreSQL + Redis healthy. Local-only DB (`localhost:5432`). All 4 billing migrations executed successfully (24/24, 0 pending). Evidence: 34 tables, 132 indexes, 24 migration records. Containers stopped; volumes preserved for 06B. No production DB. No source changes. No API Gateway/frontend/browser/provider. No subagents. Checkpoint: `docs/BILLING-READY-06A-CHECKPOINT.md`. Preflight: `docs/BILLING-READY-06A-DOCKER-DB-MIGRATION-PREFLIGHT.md`. Parent BILLING-READY-06 remains ACTIVE. BILLING-READY-06B planned only / not registered. AGENT-HARNESS write canary remains a separate track. |
| 22 | Beta preparation | Beta readiness checklist | After Billing foundation and multi-builder topology |

---

## 4. Current Next Task

**COMPLETE and LOCKED: BILLING-READY-05E — Credit Grant / Top-Up Accounting — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Fifth child slice of BILLING-READY-05. 6 production files created + 4 modified. 96 new + 300 regression = 396/396 PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env/secrets changes. Migration created, NOT executed. No frontend. Checkpoint: \docs/BILLING-READY-05E-CHECKPOINT.md\. AGENT-HARNESS write canary remains a separate track. See \TASKS.md\ — BILLING-READY-05E.

**COMPLETE and LOCKED: BILLING-READY-05D — Webhook Event Ingestion / Idempotency — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Fourth child slice of BILLING-READY-05. 6 production files created + 3 modified (\entities/index.ts\, \main.ts\ rawBody:true, \pp.module.ts\ WebhookModule) + 6 test files. webhook 108/108 PASS (6 suites). Regression: \stripe-payment.provider\ 49/49, \subscription\ 53/53, \checkout\ 58/58, \credit-balance\ 74/74. Total: 342/342 PASS. px tsc --noEmit\ exit 0. Linter 0 errors. No Stripe SDK. No provider API calls. No env/secrets changes. Migration created, NOT executed. No frontend. Checkpoint: \docs/BILLING-READY-05D-CHECKPOINT.md\. AGENT-HARNESS write canary remains a separate track. See \TASKS.md\ — BILLING-READY-05D.

**COMPLETE and LOCKED: BILLING-READY-05C — Checkout / Credit Top-Up Session Creation — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Third child slice of BILLING-READY-05. 9 production files created + 1 modified (\pp.module.ts\) + 4 test files. 58/58 checkout tests PASS. \stripe-payment.provider\ 49/49 PASS. \charge-readiness.service\ 15/15 PASS. \credit-balance\ 74/74 regression PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No frontend. Checkpoint: \docs/BILLING-READY-05C-CHECKPOINT.md\. AGENT-HARNESS write canary remains a separate track. See \TASKS.md\ — BILLING-READY-05C.

**COMPLETE and LOCKED: BILLING-READY-05B — Customer / Subscription Persistence — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Second child slice of BILLING-READY-05. 4 production files + 2 migration files (not executed) + 4 test files. 53/53 subscription tests PASS. 74/74 credit-balance regression PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No real migration execution. No frontend. Checkpoint: \docs/BILLING-READY-05B-CHECKPOINT.md\. AGENT-HARNESS write canary remains a separate track. See \TASKS.md\ — BILLING-READY-05B.

**COMPLETE and LOCKED: BILLING-READY-05A — Provider Configuration / Contracts / Readiness — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. First child slice of BILLING-READY-05. 4 production files + 3 test files. 79 tests PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No frontend. Checkpoint: \docs/BILLING-READY-05A-CHECKPOINT.md\. AGENT-HARNESS write canary remains a separate track. See \TASKS.md\ — BILLING-READY-05A.

**COMPLETE and LOCKED: BILLING-READY-05F — Billing UI / Customer Portal — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Sixth child slice of BILLING-READY-05. 3 backend files created (billing-read.controller.ts, billing-read.module.ts, billing-read.controller.spec.ts) + 1 modified (app.module.ts BillingReadModule import) + 7 frontend files created (billing/page.tsx, billing-page-client.tsx, billing-balance-card.tsx, billing-subscription-card.tsx, billing-topup-section.tsx, useBillingData.ts, billing-page-client.test.tsx) + 3 translation files modified (en.json, zh-TW.json, zh-CN.json — 30 keys each, billing namespace). billing-read 12/12 PASS; billing-page-client 22/22 PASS; checkout 58/58 PASS; frontend 640/640 PASS. TypeScript clean. Linter 0 errors. No Stripe SDK. No provider API calls. No env/secrets changes. No migrations. No customer portal backend endpoint. No browser smoke. No AGENT-HARNESS write canary. Checkpoint: `docs/BILLING-READY-05F-CHECKPOINT.md`. See `TASKS.md` — BILLING-READY-05F.

**COMPLETE and LOCKED: BILLING-READY-05G — Regression / Runtime Validation + Parent Consolidation — 2026-07-16.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Decision A: static/test-only validation. R1–R13 PASS (621 backend tests), T1–T3 PASS, F1 corrected PASS (22 tests), F2 PASS (640 tests), B1 PASS. No source changes. No runtime/Docker/Postgres/Redis/browser/provider/migration execution. No subagents. Deferred items owned by BILLING-READY-06. Checkpoint: `docs/BILLING-READY-05G-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. See `TASKS.md` — BILLING-READY-05G.

**COMPLETE and LOCKED: BILLING-READY-05 (parent) — Stripe / Payment Provider Integration, Subscription Lifecycle, Credit Top-Up — 2026-07-16.** HIGH risk — 4-step loop — all 4 parent steps complete. All child slices COMPLETE and LOCKED: 05A (2026-07-15), 05B (2026-07-15), 05C (2026-07-15), 05D (2026-07-15), 05E (2026-07-15), 05F (2026-07-15), 05G (2026-07-16). Static regression matrix PASS. Migration execution deferred — 4 migrations created, not executed — owned by BILLING-READY-06. Docker/Postgres/Redis/runtime/browser smoke/Stripe live/test/CLI/webhook/customer portal/real payment deferred — owned by BILLING-READY-06. No Stripe SDK. No env/secrets/package changes. Checkpoint: `docs/BILLING-READY-05-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. See `TASKS.md` — BILLING-READY-05.

**ACTIVE: BILLING-READY-06 — Local Runtime / Migration / Browser Smoke Validation Plan — Step 1 COMPLETE (Registration — 2026-07-16). Step 2 COMPLETE (2026-07-16).** HIGH risk — 4-step loop. Decision B split into 06A/06B. Readiness: `docs/BILLING-READY-06-RUNTIME-MIGRATION-BROWSER-SMOKE-READINESS.md`. BILLING-READY-06A COMPLETE and LOCKED (2026-07-16) — Checkpoint: `docs/BILLING-READY-06A-CHECKPOINT.md`. BILLING-READY-06B planned only / next recommended / not registered. BILLING-READY-05 / 05A–05G / 04 / 03 remain COMPLETE and LOCKED. AGENT-HARNESS write canary remains a separate track. See `TASKS.md` — BILLING-READY-06.

**COMPLETE and LOCKED: BILLING-READY-06A — Docker / Local DB / Migration Validation — 2026-07-16.** HIGH risk — 4-step child-slice loop — all 4 steps complete. First child slice of BILLING-READY-06 (Decision B). Docker v29.2.1 / Compose v5.0.2 PASS. PostgreSQL (`aisandbox-postgres`) + Redis (`aisandbox-redis`) healthy. Local-only DB (`localhost:5432`). All 4 billing migrations executed successfully (migration:show BEFORE 20/4 pending; AFTER 24/24, 0 pending). Evidence: 34 tables, 132 indexes, 24 migration records. Containers stopped; volumes preserved for 06B. No production DB. No source changes. No API Gateway/frontend/browser/provider/Stripe CLI. No subagents. Checkpoint: `docs/BILLING-READY-06A-CHECKPOINT.md`. Preflight: `docs/BILLING-READY-06A-DOCKER-DB-MIGRATION-PREFLIGHT.md`. Parent BILLING-READY-06 remains ACTIVE. BILLING-READY-06B planned only / not registered. BILLING-READY-05 / 05A–05G / 04 / 03 remain COMPLETE and LOCKED. AGENT-HARNESS write canary remains a separate track. See `TASKS.md` — BILLING-READY-06A.

**NEXT RECOMMENDED:** BILLING-READY-06B — Backend Runtime + Frontend Browser Smoke — planned only / not registered. Requires Keith explicit approval before registration/execution. Browser smoke additionally requires Keith explicit approval and step-by-step guidance. Do not register AGENT-HARNESS write canary.

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
- Paused tasks retain their position in the sequence �X they are not demoted or deprioritized unless Keith explicitly changes priority.

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
| 4 | AGENT-HARNESS-06 | Read-only canary readiness review (COMPLETE �X NO-GO) |
| 5 | AGENT-HARNESS-06A | Read-only canary hardening slice (COMPLETE) |
| 6 | AGENT-HARNESS-06B | Read-only harness canary plan (COMPLETE and LOCKED) |
| 7 | BILLING-READY-00 | Audit/planning (COMPLETE and LOCKED) |
| 7A | BILLING-READY-01A | Read-only architecture review (**COMPLETE and LOCKED**) |
| 7B | BILLING-READY-01 | Credit Ledger Foundation (**COMPLETE and LOCKED �X 2026-07-06**) |
| 7C | BILLING-READY-02A/02B/02C | Credit Deduction Pipeline Foundation (**COMPLETE and LOCKED �X 2026-07-07**) |
| 7D | BILLING-READY-02D | Credit Deduction Pipeline �X Simulation-Only Validation (**COMPLETE and LOCKED �X 2026-07-07**) |
| 7E | BILLING-READY-03 | Credit Balance Persistence Foundation (**COMPLETE and LOCKED �X 2026-07-07** �X all 7 child slices COMPLETE and LOCKED: 03A/03B/03C1/03C2/03D1/03D2/03D3. All 11 parent close criteria satisfied. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 7E-a | BILLING-READY-03A | Schema and Persistence Design (**COMPLETE and LOCKED �X 2026-07-07** �X governance/design only. See `docs/BILLING-READY-03A-CHECKPOINT.md`.) |
| 7E-b | BILLING-READY-03B | DB Schema, Migration, and Repository Foundation (**COMPLETE and LOCKED �X 2026-07-07** �X TypeORM entities, migration, repositories, `CreditPersistenceModule`. 13 suites / 122 tests. No gateway swap. See `docs/BILLING-READY-03B-CHECKPOINT.md`.) |
| 7E-c | BILLING-READY-03C1 | Persistent Gateway Implementation, Not Runtime-Bound (**COMPLETE and LOCKED �X 2026-07-07** �X `PersistentCreditDeductionGateway`, generic base class, `sourceEventId` idempotency, overflow capping, unit tests. 11 suites / 136 tests. No runtime swap. See `docs/BILLING-READY-03C1-CHECKPOINT.md`.) |
| 7E-d | BILLING-READY-03C2 | Controlled Runtime Binding for Persistent Deduction Gateway (**COMPLETE and LOCKED �X 2026-07-07** �X `CreditDeductionModule` binding swapped, `CreditPersistenceModule` imported, `emitDeductionAttempt()` awaits gateway, failure suppression preserved, DB validation completed. 11 suites / 137 tests (credit-deduction); 14 suites / 153 tests (credit). See `docs/BILLING-READY-03C2-CHECKPOINT.md`.) |
| 7E-e | BILLING-READY-03D1 | Transaction Boundary and Repository Contract Hardening (**COMPLETE and LOCKED �X 2026-07-07** �X `DataSource.transaction()` wraps deduction flow, transactional `EntityManager` passed to lock/insert/update, `sourceEventId` pre-check preserved outside transaction, 23505 race fallback preserved, zero-balance overflow enforced. 3 source files + 4 test files. 11 suites / 151 tests (credit-deduction); 14 suites / 167 tests (credit). See `docs/BILLING-READY-03D1-CHECKPOINT.md`.) |
| 7E-f | BILLING-READY-03D2 | Concurrency and Idempotency Integration Validation (**COMPLETE and LOCKED �X 2026-07-07** �X live PostgreSQL integration validation of `SELECT ... FOR UPDATE` concurrency, duplicate `sourceEventId` idempotency under race conditions, no double deduction, non-negative balance under concurrent deductions, cleanup verified. 1 integration spec file created. 6/6 integration tests passed with `RUN_CREDIT_DB_INTEGRATION=true`. 151 passed/6 skipped without DB flag. Typecheck and build clean. See `docs/BILLING-READY-03D2-CHECKPOINT.md`.) |
| 7E-g | BILLING-READY-03D3 | Overflow Semantics Finalization and BILLING-READY-03 Close Checkpoint (**COMPLETE and LOCKED �X 2026-07-07** �X Overflow semantics finalized: deductions non-blocking, `appliedCredits` capped at available balance, `creditsOverflow` records unmet credits, `balanceAfter` always >= 0, zero-balance deductions produce `appliedCredits=0`/`creditsOverflow=requestedCredits`/`balanceAfter=0`, line-item overflow sequential, entitlement enforcement deferred to BILLING-READY-04+. All 11 BILLING-READY-03 parent close criteria satisfied. BILLING-READY-03 COMPLETE and LOCKED. No production code changes. See `docs/BILLING-READY-03D3-CHECKPOINT.md`.) |
| 8 | AGENT-PLATFORM-04 | Multi-Builder Runtime Topology Plan (**COMPLETE and LOCKED �X 2026-07-07** �X All 4 steps complete. Role+profile identity model (agentRole + builderProfileId), 1:1 session/container isolation, per-builder harness config with global fallback, session-scoped preview/checkpoint. See `docs/AGENT-PLATFORM-04-CHECKPOINT.md`. AGENT-HARNESS-07 next: ACTIVE. AGENT-HARNESS-06C remains deferred.) |
| 9 | AGENT-HARNESS-07 | Per-Builder Harness Config Adapter (**COMPLETE and LOCKED �X 2026-07-07** �X All 3 child slices COMPLETE and LOCKED: AGENT-HARNESS-07A (builder profile registry + adapter contract), AGENT-HARNESS-07B (Worker Integration + Resolved Config Flow), AGENT-HARNESS-07C (Validation/Regression Matrix and Parent Close Checkpoint). See `docs/AGENT-HARNESS-07-CHECKPOINT.md`. AGENT-HARNESS-06C prerequisite is now satisfied; AGENT-HARNESS-06C registered ACTIVE �X Keith explicit approval recorded 2026-07-07.) |
| 10 | AGENT-HARNESS-06C | Read-Only Harness Canary Execution (**COMPLETE and LOCKED �X 2026-07-07** �X All 4 steps COMPLETE. Canary result: PASS �X 231 tests, 13 suites, 0 failures. Jest harness test suite / mock executor. No live BullMQ canary. No production activation. No env changes. See `docs/AGENT-HARNESS-06C-CHECKPOINT.md`.) |
| 11 | AGENT-HARNESS-06D | Live Worker/BullMQ Read-Only Canary Gap Closure (**COMPLETE and LOCKED �X 2026-07-08** �X All 4 steps complete. Live Worker/BullMQ canary PASS: `selectedPath: 'harness'`; `source: 'builder-profile'`; 3 iterations; 2 tool calls dispatched; HANDLER_ERROR on `list_files`/`read_file` (API Gateway not running �X expected per design ��7.8); `terminationReason: 'completed'`; `durationMs: 33`. No paid calls. No .env changes. No production activation. No new task registered. Checkpoint: `docs/AGENT-HARNESS-06D-CHECKPOINT.md`.) |
| 11a | AGENT-HARNESS-06D1 | Test Tool-Capable Stub Adapter for Live Worker Canary (**COMPLETE and LOCKED �X 2026-07-08** �X Child slice of 06D. `TestToolCapableStubAdapter` created with `supportsToolUse = true`; deterministic; zero billing; normal `stub` unchanged; routing wired. 34 suites / 646 tests. No live canary. No env changes. Checkpoint: `docs/AGENT-HARNESS-06D1-CHECKPOINT.md`.) |
| 12 | AGENT-HARNESS-06E | Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary (**COMPLETE and LOCKED �X 2026-07-09** �X All 4 steps complete. Full E2E canary PASS: `list_files`/`read_file` SUCCESS (actual file data, not HANDLER_ERROR); `durationMs: 718`; `tokens: 0`; no paid calls; no .env changes. Checkpoint: `docs/AGENT-HARNESS-06E-CHECKPOINT.md`.) |
| 13 | AGENT-PLATFORM-05 | Multi-Builder Runtime Orchestration Plan (**COMPLETE and LOCKED �X 2026-07-09** �X All 4 steps complete. Planning/governance only. No implementation. Readiness review: `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md`. Orchestration plan: `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-05-CHECKPOINT.md`. Next recommended: AGENT-PLATFORM-06 �X Upstream Identity Propagation, COMPLETE and LOCKED.) |
| 14 | AGENT-PLATFORM-06 | Upstream Identity Propagation (**COMPLETE and LOCKED �X 2026-07-09** �X All 4 steps complete. `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` propagated through full execution path. 8 files changed. 34 suites / 654 passed; TypeScript clean. No migration. Backward compatible. Checkpoint: `docs/AGENT-PLATFORM-06-CHECKPOINT.md`.) |
| 15 | AGENT-PLATFORM-07 | Read-Only Orchestration Coordinator Planning (**COMPLETE and LOCKED �X 2026-07-09** �X All 4 steps complete. Planning/governance only. No implementation. Source-path review: `docs/AGENT-PLATFORM-07-SOURCE-PATH-REVIEW.md`. Coordinator plan (22 sections): `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md`. Checkpoint: `docs/AGENT-PLATFORM-07-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 16 | AGENT-PLATFORM-07A | Coordinator Contracts / Schema (**COMPLETE and LOCKED �X 2026-07-09** �X All 3 steps complete. TypeScript-only orchestration contracts/schema. `services/api-gateway/src/orchestration/orchestration.contracts.ts` created. `npx tsc --noEmit` exit code 0. No NestJS providers, no module wiring, no runtime behavior. Checkpoint: `docs/AGENT-PLATFORM-07A-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 17 | AGENT-PLATFORM-07B | API Gateway Orchestration Module Skeleton (**COMPLETE and LOCKED �X 2026-07-09** �X All 3 steps complete. `OrchestrationModule` + `OrchestrationService` skeleton created; `AppModule` updated. Jest PASS (1 suite, 3 tests). TypeScript clean (exit code 0). No runtime coordinator behavior, no endpoints, no queue enqueue flow, no cancel redesign, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 18 | AGENT-PLATFORM-07C | Read-Only Referral Enqueue Flow + Cancel Redesign (**COMPLETE and LOCKED �X 2026-07-10** �X HIGH risk �X 4-step loop. All 4 steps complete. All 3 child slices COMPLETE and LOCKED: 07C1/07C2/07C3. Cancel redesign risk downgraded from HIGH to LOW�VMEDIUM (obliterate does not exist; cancel already per-execution via `ExecutionResultService.requestCancel(executionId)`). Parent checkpoint: `docs/AGENT-PLATFORM-07C-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 18a | AGENT-PLATFORM-07C1 | Orchestration Core Methods + In-Memory Store (**COMPLETE and LOCKED �X 2026-07-09** �X MEDIUM risk �X 3-step child-slice loop. All 3 steps complete. `OrchestrationService` extended with 3 in-memory stores + 7 core methods (`createCollaborationRun`, `getCollaborationRun`, `createReferral`, `getReferral`, `completeReferral`, `failReferral`, `validateReferral`); safety limits (depth 3, agents 4, loop prevention, idempotency). Jest PASS: 1 suite, 13 tests. TypeScript clean. No enqueue, no cancel, no worker changes, no DB migration, no controller/endpoints. Checkpoint: `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 18b | AGENT-PLATFORM-07C2 | Referral Enqueue + Cancel + AiExecutionJob Extension (**COMPLETE and LOCKED �X 2026-07-09** �X HIGH risk �X 4-step loop. All 4 steps complete. `startReferralExecution()`, `cancelReferral()`, `cancelCollaboration()` added; `referralExecutionMap` private store; `OrchestrationModule` wired with `QueueService` and `ExecutionResultService`; `AiExecutionJob` extended with 5 new optional fields; worker finalization preserves new fields. Jest PASS: `orchestration.service` 1 suite 25 tests; `worker.processor.builder-config` 1 suite 55 tests. TypeScript clean in api-gateway and ai-service. No DB migration, no controller/endpoints, no runtime canary. Checkpoint: `docs/AGENT-PLATFORM-07C2-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 18c | AGENT-PLATFORM-07C3 | Targeted Tests and Parent Consolidation (**COMPLETE and LOCKED �X 2026-07-10** �X MEDIUM risk �X 3-step child-slice loop. All 3 steps complete. Targeted validation/regression of 07C1+07C2 integration: orchestration.service 25 tests PASS; worker.processor.builder-config 55 tests PASS; api-gateway/ai-service tsc PASS. No implementation changes. Parent AGENT-PLATFORM-07C COMPLETE and LOCKED. Checkpoint: `docs/AGENT-PLATFORM-07C3-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 19 | AGENT-PLATFORM-07D | Collaboration Audit Events (**COMPLETE and LOCKED �X 2026-07-10** �X MEDIUM/HIGH risk �X 4-step loop. All 4 steps complete. `InMemoryOrchestrationAuditRecorder` created; 8 event types emitted at OrchestrationService lifecycle transitions; 40 tests pass; TypeScript clean. No contract changes, no worker changes, no DB migration. Checkpoint: `docs/AGENT-PLATFORM-07D-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 20 | AGENT-PLATFORM-07E | Read-Only Coordinator Canary (**COMPLETE and LOCKED �X 2026-07-10** �X HIGH risk �X 4-step loop. All 4 steps complete. Unit/in-process canary PASS: Option A (mocked `QueueService` + `ExecutionResultService`); 16 canary tests; 40 regression tests; TypeScript clean (0 errors). No production source changes, no contract changes, no worker changes, no DB migration, no runtime/provider/browser smoke. Preflight: `docs/AGENT-PLATFORM-07E-CANARY-READINESS-PREFLIGHT.md`. Execution report: `docs/AGENT-PLATFORM-07E-CANARY-EXECUTION-REPORT.md`. Checkpoint: `docs/AGENT-PLATFORM-07E-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 21 | AGENT-PLATFORM-07F | Live Runtime Orchestration Integration Canary (**COMPLETE and LOCKED �X 2026-07-12** �X HIGH risk �X 4-step loop. All 4 steps complete. Keith approval recorded. Split child slices: 07F1 COMPLETE and LOCKED, 07F2 COMPLETE and LOCKED, 07F3 COMPLETE and LOCKED. Preflight: `docs/AGENT-PLATFORM-07F-LIVE-RUNTIME-CANARY-PREFLIGHT.md`. Checkpoint: `docs/AGENT-PLATFORM-07F-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. Next recommended roadmap item: BILLING-READY-04+ �X not registered.) |
| 21e | BILLING-READY-05 | Stripe / Payment Provider Integration, Subscription Lifecycle, Credit Top-Up | **COMPLETE and LOCKED — 2026-07-16.** HIGH risk — 4-step loop — all 4 parent steps complete. All child slices COMPLETE and LOCKED: 05A–05G. Static regression matrix PASS. Migration execution deferred. Docker/Postgres/Redis/runtime/browser/provider deferred. No Stripe SDK. No env/secrets changes. No new task registered. Checkpoint: `docs/BILLING-READY-05-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. |
| 21e-i | BILLING-READY-05A | Provider Configuration / Contracts / Readiness | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. First child slice of BILLING-READY-05. 4 production files + 3 test files. 79 tests PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No frontend. Checkpoint: `docs/BILLING-READY-05A-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 21e-ii | BILLING-READY-05B | Customer / Subscription Persistence | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Second child slice of BILLING-READY-05. 4 production files + 2 migration files (not executed) + 4 test files. 53/53 subscription tests PASS. 74/74 credit-balance regression PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No real migration execution. No frontend. Checkpoint: `docs/BILLING-READY-05B-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 21e-iii | BILLING-READY-05C | Checkout / Credit Top-Up Session Creation | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Third child slice of BILLING-READY-05. 9 production files created + 1 modified + 4 test files. 58/58 checkout tests PASS. `stripe-payment.provider` 49/49 PASS. `charge-readiness.service` 15/15 PASS. `credit-balance` 74/74 regression PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No frontend. Checkpoint: `docs/BILLING-READY-05C-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 21e-iv | BILLING-READY-05D | Webhook Event Ingestion / Idempotency | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Fourth child slice of BILLING-READY-05. 6 production files created + 3 modified (`entities/index.ts`, `main.ts` rawBody:true, `app.module.ts`) + 6 test files. webhook 108/108 PASS (6 suites). Regression: `stripe-payment.provider` 49/49, `subscription` 53/53, `checkout` 58/58, `credit-balance` 74/74. Total: 342/342 PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. Migration created, NOT executed. No frontend. Checkpoint: `docs/BILLING-READY-05D-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 21e-v | BILLING-READY-05E | Credit Grant / Top-Up Accounting | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Fifth child slice of BILLING-READY-05. 6 production files created + 4 modified (entities/index.ts, credit-balance.repository.ts, webhook.service.ts, webhook.module.ts) + 6 test files. credit-grant 96/96 PASS (6 suites). Regression: webhook 108/108, credit-balance 74/74, checkout 58/58, usage-ledger 60/60. Total: 96 new + 300 regression = 396/396 PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. Migration created, NOT executed. No frontend. Checkpoint: docs/BILLING-READY-05E-CHECKPOINT.md. AGENT-HARNESS write canary remains a separate track.) |
|| 21e-vi | BILLING-READY-05F | Billing UI / Customer Portal | (**COMPLETE and LOCKED — 2026-07-15.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Sixth child slice of BILLING-READY-05. 3 backend files created + 1 modified (app.module.ts) + 7 frontend files created + 3 translation files modified (30 keys per locale, billing namespace). billing-read 12/12 PASS; billing-page-client 22/22 PASS; checkout 58/58 PASS; frontend 640/640 PASS. TypeScript clean. No Stripe SDK. No provider API calls. No env changes. No migrations. No customer portal backend endpoint. No browser smoke. Checkpoint: `docs/BILLING-READY-05F-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track.) |
| 21e-vii | BILLING-READY-05G | Regression / Runtime Validation + Parent Consolidation | **COMPLETE and LOCKED — 2026-07-16.** HIGH risk — 4-step child-slice loop — all 4 steps complete. Decision A: static/test-only. All 19 commands PASS. No source changes. No runtime/browser/provider/migration execution. Checkpoint: `docs/BILLING-READY-05G-CHECKPOINT.md`. AGENT-HARNESS write canary remains a separate track. No new task registered. |

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
