# AGENT-PLATFORM-07E — Canary Readiness / Preflight Plan

**Task ID:** AGENT-PLATFORM-07E
**Step:** 2 — Canary Readiness / Preflight Plan
**Status:** Step 2 COMPLETE
**Date:** 2026-07-10
**Nature:** Static planning only — no implementation, no runtime execution, no service startup
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07E ACTIVE | PASS — registered in TASKS.md and AINOW-EXECUTION-ROADMAP.md; Step 1 COMPLETE (Registration 2026-07-10); Keith approval recorded |
| AGENT-PLATFORM-07D COMPLETE and LOCKED | PASS — 2026-07-10; Collaboration Audit Events; 40 tests; TypeScript clean |
| AGENT-PLATFORM-07C COMPLETE and LOCKED | PASS — 2026-07-10; All 3 child slices COMPLETE and LOCKED (07C1/07C2/07C3) |
| AGENT-PLATFORM-07C1 COMPLETE and LOCKED | PASS — 2026-07-09; Orchestration Core Methods + In-Memory Store |
| AGENT-PLATFORM-07C2 COMPLETE and LOCKED | PASS — 2026-07-09; Referral Enqueue + Cancel + AiExecutionJob Extension |
| AGENT-PLATFORM-07C3 COMPLETE and LOCKED | PASS — 2026-07-10; Targeted Tests and Parent Consolidation |
| AGENT-PLATFORM-07B COMPLETE and LOCKED | PASS — 2026-07-09; API Gateway Orchestration Module Skeleton |
| AGENT-PLATFORM-07A COMPLETE and LOCKED | PASS — 2026-07-09; Coordinator Contracts / Schema |
| AGENT-PLATFORM-07 COMPLETE and LOCKED | PASS — 2026-07-09; Read-Only Orchestration Coordinator Planning |
| AGENT-PLATFORM-06 COMPLETE and LOCKED | PASS — 2026-07-09; Upstream Identity Propagation |
| AGENT-PLATFORM-05 COMPLETE and LOCKED | PASS — 2026-07-09; Multi-Builder Runtime Orchestration Plan |
| AGENT-PLATFORM-04 COMPLETE and LOCKED | PASS — 2026-07-07; Multi-Builder Runtime Topology Plan |
| AGENT-HARNESS-07 COMPLETE and LOCKED | PASS — 2026-07-07; Per-Builder Harness Config Adapter |
| AGENT-HARNESS-06E COMPLETE and LOCKED | PASS — 2026-07-09; Full E2E Canary |
| One-active-task rule satisfied | PASS — only AGENT-PLATFORM-07E is ACTIVE |

**Governance readiness: PASS — all 15 criteria satisfied.**

---

## 2. Runtime Sensitivity Assessment

### 2.1 Options Considered

| Option | Description | Runtime Dependencies |
|--------|-------------|---------------------|
| A | Unit/in-process canary with mocked `QueueService` and `ExecutionResultService` | None — Jest + TypeScript only |
| B | Local runtime canary using Docker/Postgres/Redis/API Gateway/BullMQ | Full local stack |
| C | Split 07E into child slices: 07E1 in-process canary first, then 07E2 runtime canary later | Phased |

### 2.2 Analysis

| Factor | Assessment |
|--------|-----------|
| What does the canary need to verify? | OrchestrationService lifecycle flows, metadata propagation, audit event emission, cancel mechanics, read-only policy enforcement — all in-memory |
| Does `OrchestrationService` require runtime? | NO — all 3 stores are in-memory Maps; no DB, no Redis direct usage |
| Does `QueueService` require runtime? | YES for real calls — connects to Redis/BullMQ in constructor |
| Does `ExecutionResultService` require runtime? | YES for real calls — queries PostgreSQL via TypeORM `DataSource` |
| Are both already mocked in existing tests? | YES — `orchestration.service.spec.ts` already mocks both with `jest.fn()` and the service operates correctly with these mocks |
| Is there behavior that can ONLY be proven with live runtime? | NO for orchestration lifecycle correctness. The live BullMQ enqueue and live cancel are downstream of the orchestration logic. The orchestration-level canary (create → start → verify metadata → cancel → verify audit) is fully verifiable with mocked dependencies. |
| Precedent | AGENT-HARNESS-06C used Jest/mock-executor path (231 tests, 13 suites), proving the in-process canary pattern. AGENT-HARNESS-06D/06E later did live runtime separately. Same phased approach applies here. |

### 2.3 Decision: Option A — Unit/In-Process Canary with Mocked Dependencies

**Rationale:**
1. `OrchestrationService` stores are entirely in-memory — no runtime infrastructure needed to exercise the full lifecycle.
2. `QueueService.enqueueExecution()` is already mocked in the existing test module (`jest.fn().mockResolvedValue(undefined)`) — canary can verify the correct payload was passed to the mock.
3. `ExecutionResultService.requestCancel()` is already mocked (`jest.fn().mockResolvedValue(true)`) — canary can verify cancel was invoked with correct `executionId`.
4. All 40 existing tests already use this pattern and pass.
5. A live runtime canary (Docker + Postgres + Redis + API Gateway + AI Service) would test BullMQ transport, not orchestration logic — that can be a separate future task if needed.
6. Smallest safe option. No runtime approval required.

---

## 3. Exact Recommended Step 3 Scenario

The canary should execute the following **full collaboration lifecycle** in a single dedicated Jest test file:

### 3.1 Canary Flow

| # | Action | Verification |
|---|--------|-------------|
| 1 | Create collaboration run | Returns `active` status; `collaborationRunId` present; `orchestrationMode = 'read_only'`; audit event: `orchestration.collaboration_created` with correct metadata |
| 2 | Validate referral | Returns `{ outcome: 'valid' }` |
| 3 | Create referral | Returns `pending_approval` status; `referralId`, `referralTraceId`, `parentReferralTraceId` present; audit event: `orchestration.referral_created` with full metadata |
| 4 | Start referral execution (mocked enqueue) | Returns `{ executionId }`;  referral transitions to `in_progress`; mock `QueueService.enqueueExecution` called with correct orchestration fields (`collaborationRunId`, `referralTraceId`, `parentReferralTraceId`, `referringBuilderProfileId`, `referralId`, `isReferralExecution: true`); audit event: `orchestration.referral_started` with `transitionDetail: 'referral_enqueued'` |
| 5 | Complete referral | Status → `completed`; result present; audit event: `orchestration.referral_completed` |
| 6 | Create second referral (same idempotency key) | Returns duplicate; audit event: `referral_duplicate_detected` lifecycle in payload |
| 7 | Create third referral (different target) | Success; new referral created |
| 8 | Cancel referral | Status → `cancelled`; mock `ExecutionResultService.requestCancel` called with correct `executionId`; audit event: `orchestration.referral_cancelled` |
| 9 | Cancel collaboration | Run status → `cancelled`; remaining active referrals cancelled; audit event: `orchestration.collaboration_cancelled` with `affectedReferralIds` |
| 10 | Validate referral exceeding depth | Throws; audit event: `orchestration.safety_limit_breached` with `limitType: 'depth'` |
| 11 | Validate referral with loop | Throws; audit event: `orchestration.safety_limit_breached` with `limitType: 'loop'` |
| 12 | Validate referral exceeding agent limit | Throws; audit event: `orchestration.safety_limit_breached` with `limitType: 'agent_limit'` |
| 13 | Verify read-only policy | `getReadOnlyPolicy()` returns `readOnly: true`, `allowWriteTools: false`, `blockedToolIds` includes `write_file`/`delete_file`/`run_validation` |
| 14 | Verify blocked write tools | Referral `constraints.allowedTools` contains only `list_files`/`read_file`; blocked tools are NOT in `allowedTools` |
| 15 | Verify NO AGENT-HARNESS write canary | Test does not import/invoke/reference any write-harness functionality; test does not enable `AGENT_HARNESS_ENABLE_TOOL_LOOP`; test does not call `write_file`/`delete_file`/`run_validation` tools |

### 3.2 What This Canary Does NOT Do

- Does NOT submit real BullMQ jobs
- Does NOT connect to Redis/Postgres
- Does NOT start Docker/API Gateway/AI Service/container-manager
- Does NOT make provider/API calls
- Does NOT use browser smoke
- Does NOT run DB migrations
- Does NOT activate Agent Harness write tools
- Does NOT reference AGENT-HARNESS write canary work

---

## 4. Exact Safety Gates

| # | Safety Gate | Enforcement |
|---|------------|-------------|
| 1 | No `write_file`/`delete_file`/`run_validation` activation | Test file does NOT reference these tool IDs except to assert they are BLOCKED |
| 2 | No shared workspace writes | Test operates entirely in-memory; no filesystem operations |
| 3 | No provider/API calls | No OpenAI/Anthropic/Groq/xAI/DeepSeek adapter calls; mocked `QueueService` prevents real enqueue |
| 4 | No browser smoke | No Playwright/Puppeteer/browser commands |
| 5 | No DB migration | No TypeORM migration commands; mocked `ExecutionResultService` prevents real SQL |
| 6 | No source changes except approved canary files | Only the canary test file and canary report may be created; no production source modifications |
| 7 | Stop on unexpected service/runtime dependency | If any test requires `REDIS_URL`, `DATABASE_URL`, Docker, or live service, STOP and escalate to Keith |
| 8 | No `.env` changes | No environment variable files may be modified |
| 9 | No Docker/Postgres/Redis startup | Commands must not start containers or services |
| 10 | No AGENT-HARNESS write canary | Do not import, reference, or enable write-tool harness functionality |

---

## 5. Exact Allowed Step 3 Files

### 5.1 Decision: Create a Dedicated Canary Test File

**Rationale:** A dedicated canary test file clearly separates canary validation from the existing 40-test unit suite. This avoids coupling canary-specific assertions (lifecycle flow, metadata completeness, audit event ordering) with the existing modular unit tests.

### 5.2 Allowed Files

| # | Action | File Path |
|---|--------|-----------|
| 1 | CREATE | `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\orchestration\__tests__\orchestration.canary.spec.ts` |
| 2 | CREATE | `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-07E-CANARY-EXECUTION-REPORT.md` |

### 5.3 Files That Must NOT Be Changed

- All production source files (`*.ts` outside `__tests__/`)
- `orchestration.contracts.ts`
- `orchestration.service.ts`
- `orchestration.module.ts`
- `orchestration-audit.recorder.ts`
- All worker/queue files
- Frontend files
- Database/migration files
- `.env*` files
- `docker*` files
- `package.json` / `package-lock.json`
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md`

---

## 6. Exact Step 3 Commands

### 6.1 Canary Execution (PowerShell)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "orchestration.canary"
```

### 6.2 Regression Validation (existing tests still pass)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "orchestration.service"
```

### 6.3 TypeScript Check

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
```

### 6.4 Summary

All commands are:
- Jest + TypeScript only
- No Docker
- No Postgres
- No Redis
- No API Gateway startup
- No AI Service startup
- No container-manager startup
- No BullMQ job submission
- No provider/API calls
- No browser smoke

---

## 7. QueueService Decision

| Decision | Mocked QueueService |
|----------|---------------------|
| Approach | `jest.fn().mockResolvedValue(undefined)` — same pattern as existing `orchestration.service.spec.ts` |
| Justification | Real `QueueService` constructor requires `REDIS_URL` and immediately connects to Redis. Mocking isolates orchestration logic from transport. The canary verifies the correct payload was passed to `enqueueExecution()` — this proves the orchestration layer correctly builds the job payload including all identity/referral fields. |
| Why not real QueueService? | Would require Redis running. Live BullMQ transport testing is a downstream concern — if needed, it belongs in a separate runtime canary (like AGENT-HARNESS-06D/06E did for the harness). |
| Why not QueueService without runtime? | `QueueService` has no "dry-run" mode. Its constructor immediately connects to Redis. Cannot instantiate without Redis. |
| What the mock verifies | `mockQueueService.enqueueExecution` called exactly once per `startReferralExecution()`; call args include `collaborationRunId`, `referralTraceId`, `parentReferralTraceId`, `referringBuilderProfileId`, `referralId`, `isReferralExecution: true`, `agentRole`, `builderProfileId`, `orchestrationPriority` |

---

## 8. ExecutionResultService Decision

| Decision | Mocked ExecutionResultService |
|----------|-------------------------------|
| Approach | `jest.fn().mockResolvedValue(true)` — same pattern as existing `orchestration.service.spec.ts` |
| Justification | Real `ExecutionResultService` constructor requires TypeORM `DataSource` (PostgreSQL). It executes raw SQL queries. Mocking isolates cancel logic from DB. The canary verifies `requestCancel()` was called with the correct `executionId`. |
| Why not real service without DB? | `ExecutionResultService` has no fallback. It needs a live `DataSource`. Cannot instantiate without PostgreSQL. |
| Why not real DB/runtime path? | This is an in-process canary. DB-backed cancel verification belongs in a future integration canary. |
| What the mock verifies | `mockExecutionResultService.requestCancel` called exactly once per `cancelReferral()` when an active execution exists; call arg matches the `executionId` from `startReferralExecution()` |

---

## 9. Audit Event Checks

### 9.1 Events to Verify

| # | Event Type | Lifecycle Marker | When Emitted | Metadata Verified |
|---|-----------|------------------|--------------|-------------------|
| 1 | `orchestration.collaboration_created` | `collaboration_started` | After `createCollaborationRun()` | `collaborationRunId`, `userId`, `projectId`, `sourceBuilderProfileId`, `sourceAgentRole` |
| 2 | `orchestration.referral_created` | `referral_created` | After `createReferral()` (new) | `referralId`, `referralTraceId`, `parentReferralTraceId`, `idempotencyKey`, `sourceBuilderProfileId`, `targetBuilderProfileId`, `userId`, `projectId` |
| 3 | `orchestration.referral_created` | `referral_duplicate_detected` | After `createReferral()` (duplicate) | `referralId`, `idempotencyKey`, `result: 'duplicate'` |
| 4 | `orchestration.referral_started` | `referral_started` + `transitionDetail: 'referral_enqueued'` | After `startReferralExecution()` | `referralId`, `executionId`, `sessionId`, `parentReferralTraceId`, `userId`, `projectId` |
| 5 | `orchestration.referral_completed` | `referral_completed` | After `completeReferral()` | `referralId`, `executionId`, `resultStatus`, `userId`, `projectId` |
| 6 | `orchestration.referral_failed` | `referral_failed` | After `failReferral()` | `referralId`, `executionId`, `resultStatus`, `summary`, `userId`, `projectId` |
| 7 | `orchestration.referral_cancelled` | `referral_cancelled` | After `cancelReferral()` | `referralId`, `executionId`, `cancelledByUserId`, `reason` |
| 8 | `orchestration.collaboration_cancelled` | `collaboration_cancelled` | After `cancelCollaboration()` | `cancelledByUserId`, `reason`, `affectedReferralIds` |
| 9 | `orchestration.safety_limit_breached` | `referral_depth_blocked` | `validateReferral()` depth breach | `limitType: 'depth'`, `currentValue`, `maxValue` |
| 10 | `orchestration.safety_limit_breached` | `referral_loop_blocked` | `validateReferral()` loop detection | `limitType: 'loop'`, `currentValue`, `maxValue` |
| 11 | `orchestration.safety_limit_breached` | `referral_agent_limit_blocked` | `validateReferral()` agent limit | `limitType: 'agent_limit'`, `currentValue`, `maxValue` |

### 9.2 Verification Method

- Access audit events via `service.getAuditEvents()`
- Assert event count at each lifecycle step
- Assert `eventType` field matches expected type
- Assert `payload.lifecycleEvent` matches expected marker
- Assert all identity/metadata fields are present and non-null where expected
- Clear events between test scenarios via `service.clearAuditEvents()` to isolate assertions

---

## 10. Metadata Checks

### 10.1 Required Fields Per Context

| # | Field | Where Required | Source |
|---|-------|---------------|--------|
| 1 | `collaborationRunId` | All events + job payload + referral objects | `CollaborationRun.collaborationRunId` |
| 2 | `referralTraceId` | All referral events + job payload | `CollaborationReferral.referralTraceId` |
| 3 | `referralId` | Referral-scoped events + job payload | `CollaborationReferral.referralId` |
| 4 | `parentReferralTraceId` | Referral events + job payload (nullable) | `CollaborationReferral.parentReferralTraceId` |
| 5 | `sourceBuilderProfileId` | All events via `sourceBuilder.builderProfileId` | Builder identity |
| 6 | `sourceAgentRole` | All events via `sourceBuilder.agentRole` | Builder identity |
| 7 | `targetBuilderProfileId` | Referral events via `targetBuilder.builderProfileId` | Builder identity |
| 8 | `targetAgentRole` | Referral events via `targetBuilder.agentRole` | Builder identity |
| 9 | `userId` | All event payloads | `CollaborationRun.userId` |
| 10 | `projectId` | All event payloads | `CollaborationRun.projectId` |
| 11 | `sessionId` | `referral_started` event payload + job payload | `StartReferralExecutionInput.sessionId` |
| 12 | `executionId` | `referral_started`/`completed`/`failed`/`cancelled` event payloads | `StartReferralExecutionInput.executionId` |
| 13 | `isReferralExecution` | Job payload to `QueueService.enqueueExecution` | Always `true` for orchestration referrals |
| 14 | Read-only/no-write policy indicators | Referral `constraints` object | `readOnly: true`, `allowWriteTools: false`, `allowedTools: ['list_files', 'read_file']` |

### 10.2 Job Payload Fields (passed to mocked `QueueService.enqueueExecution`)

| # | Field | Expected Value |
|---|-------|---------------|
| 1 | `collaborationRunId` | Matches run ID |
| 2 | `referralTraceId` | Matches referral trace ID |
| 3 | `parentReferralTraceId` | Matches parent trace or undefined |
| 4 | `referringBuilderProfileId` | Matches source builder profile ID |
| 5 | `referralId` | Matches referral ID |
| 6 | `isReferralExecution` | `true` |
| 7 | `agentRole` | Matches target builder agent role |
| 8 | `builderProfileId` | Matches target builder profile ID |
| 9 | `orchestrationPriority` | Matches input priority |

---

## 11. PASS/FAIL Criteria

### 11.1 PASS Criteria (ALL must be satisfied)

| # | Criterion | Objective Measure |
|---|-----------|-------------------|
| 1 | Canary test file executes without errors | `npx jest --runInBand "orchestration.canary"` → exit code 0, all tests PASS |
| 2 | Full lifecycle coverage | ≥ 15 test cases covering all 15 scenarios in §3.1 |
| 3 | Audit events verified | All 11 event types from §9.1 verified with correct `eventType` and `payload.lifecycleEvent` |
| 4 | Metadata completeness | All 14 metadata fields from §10.1 verified as present where expected |
| 5 | Job payload correctness | All 9 job payload fields from §10.2 verified via mock assertion |
| 6 | Cancel flow correctness | `requestCancel()` mock called with correct `executionId` |
| 7 | Read-only policy enforced | Policy assertions pass; blocked tools confirmed |
| 8 | Safety limits verified | All 3 safety limit types (depth/loop/agent-limit) throw and emit audit events |
| 9 | Existing tests unaffected | `npx jest --runInBand "orchestration.service"` → 40 tests PASS |
| 10 | TypeScript clean | `npx tsc --noEmit` → exit code 0, no errors |
| 11 | No source changes | Only `__tests__/orchestration.canary.spec.ts` and `docs/AGENT-PLATFORM-07E-CANARY-EXECUTION-REPORT.md` created |
| 12 | No runtime dependency used | No Redis/Postgres/Docker/service startup in test |
| 13 | No AGENT-HARNESS write canary confusion | Test does not reference or enable write-harness tools |

### 11.2 FAIL Criteria (ANY triggers FAIL)

| # | Criterion | Trigger |
|---|-----------|---------|
| 1 | Any canary test fails | Jest reports failure |
| 2 | TypeScript errors introduced | `tsc --noEmit` reports errors |
| 3 | Existing 40 tests break | Regression detected |
| 4 | Runtime dependency required | Test needs `REDIS_URL`, `DATABASE_URL`, Docker, or live service |
| 5 | Source file modified | Any non-test, non-report file changed |
| 6 | Write tool activation | Test invokes or enables `write_file`/`delete_file`/`run_validation` |
| 7 | AGENT-HARNESS write canary crossed | Test references harness write canary functionality |
| 8 | Provider/API call made | Test triggers real LLM provider interaction |

---

## 12. Split Decision

### 12.1 Assessment

| Factor | Assessment |
|--------|-----------|
| Files to create | 1 test file + 1 report doc |
| Files to modify | 0 |
| Runtime requirements | None — Jest/TypeScript only |
| Risk level | LOW — existing mocking pattern proven in 40 tests; no new infrastructure |
| Test count | ~15–20 canary scenarios |
| Estimated scope | Single bounded window |

### 12.2 Decision: A — Proceed with One Bounded Step 3 Canary Execution

The scope is bounded:
- Only creates a single canary test file using the established mocking pattern
- Zero production source changes
- Zero runtime dependencies
- Proven by 40 existing tests using the same pattern
- Estimated implementation: single bounded window

**Split is NOT recommended.** The scope fits a single Step 3 canary execution.

---

## 13. Keith Approval Decision

### 13.1 Decision: Step 3 Can Proceed WITHOUT Further Keith Approval

**Rationale:**
1. Keith approval was recorded for AGENT-PLATFORM-07E registration (Step 1 — 2026-07-10).
2. The canary is **unit/in-process** (Option A) — no Docker, no Postgres, no Redis, no BullMQ runtime, no provider calls, no browser smoke.
3. All dependencies are mocked using the same pattern already validated in 40 existing tests.
4. Zero production source changes — only a test file and report doc are created.
5. No runtime approval trigger conditions are met.

### 13.2 When Keith Approval WOULD Be Required

Keith approval would be required if:
- The canary needed Docker/Postgres/Redis startup (Option B)
- The canary needed real BullMQ job submission
- The canary needed provider/API calls
- The canary modified production source files
- The canary modified `.env` files or activated `AGENT_HARNESS_ENABLE_TOOL_LOOP`
- The canary scope expanded beyond the declared allowed files

None of these apply to the recommended Option A in-process canary.

---

## 14. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Runtime dependency risk | NONE | In-process canary with mocked `QueueService` and `ExecutionResultService`; no Redis/Postgres required |
| 2 | Queue/cancel mocking risk | LOW | Mocking pattern identical to existing 40-test suite; proven stable. Mock verifies payload shape, not transport. |
| 3 | Audit event false-positive risk | LOW | Events verified by exact `eventType` + `payload.lifecycleEvent` match, not timing-dependent. `clearAuditEvents()` between scenarios prevents cross-contamination. |
| 4 | DB side-effect risk | NONE | `ExecutionResultService` is fully mocked; no SQL executed |
| 5 | Workspace write risk | NONE | Test operates entirely in-memory; no filesystem writes |
| 6 | AGENT-HARNESS write canary confusion risk | LOW | Test file explicitly does NOT import harness write functionality; canary scenario §3.1 item #15 explicitly asserts no write-tool activation. Safety gate §4 #10 enforces separation. |
| 7 | Mock fidelity risk | LOW | Mocks match the actual interface shapes (`enqueueExecution(jobData: any)`, `requestCancel(executionId: string): Promise<boolean>`). The canary tests orchestration logic, not transport/DB fidelity. |
| 8 | Test isolation risk | LOW | Dedicated `orchestration.canary.spec.ts` is independent from existing `orchestration.service.spec.ts`; uses same `TestingModule` setup pattern but separate describe block |

**No blockers identified.** All risks are LOW or NONE.

---

## 15. UX/UI Constraints

- No UI expected in AGENT-PLATFORM-07E.
- If future UI text is added for orchestration/canary visibility, update:
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`).
- Do NOT add hardcoded English UI copy.
- Icons: **Heroicons v2 Outline only**.
- Impeccable / Emil Kowalski design engineering: **advisory only** — must not override governance, scope, architecture, or tests.

---

## 16. Step 3 Readiness Conclusion

### 16.1 Ready / Not Ready

**READY — AGENT-PLATFORM-07E Step 3 canary execution can proceed.**

### 16.2 Recommended Model

- **Model:** GPT-5.3 Codex (routine bounded implementation; established test patterns; no security-adjacent work; no architecture changes; no runtime dependencies)
- **Loop:** HIGH risk — 4-step loop. Step 1 COMPLETE (Registration). Step 2 COMPLETE (this document). Step 3: canary execution. Step 4: consolidation/checkpoint.
- **Window:** New window recommended (current context is large from planning review).

### 16.3 Exact Next Prompt Type

Implementation prompt for Step 3 — bounded to:
1. Create `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\orchestration\__tests__\orchestration.canary.spec.ts` (dedicated canary test file following existing `orchestration.service.spec.ts` mocking pattern)
2. Run canary: `npx jest --runInBand "orchestration.canary"`
3. Run regression: `npx jest --runInBand "orchestration.service"`
4. Run typecheck: `npx tsc --noEmit`
5. Create canary execution report: `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-07E-CANARY-EXECUTION-REPORT.md`

---

## 17. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — 07E ACTIVE confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Backlog — 07E position confirmed |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence — 07E position §4 Current Next Task |
| 4 | `docs/AGENT-PLATFORM-07D-CHECKPOINT.md` | 07D completion — 40 tests, TypeScript clean |
| 5 | `docs/AGENT-PLATFORM-07D-AUDIT-EVENT-READINESS-REVIEW.md` | 07D design — audit event patterns established |
| 6 | `services/api-gateway/src/orchestration/orchestration.contracts.ts` | Contracts — `OrchestrationAuditEvent`, `OrchestrationAuditEventType` 14-member union, all type aliases |
| 7 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Service — full lifecycle methods, 4 in-memory stores, `emitAuditEvent()` helper, mocked DI pattern |
| 8 | `services/api-gateway/src/orchestration/orchestration.module.ts` | Module — `QueueModule` import, `ExecutionResultService` provider |
| 9 | `services/api-gateway/src/orchestration/orchestration-audit.recorder.ts` | Audit recorder — `InMemoryOrchestrationAuditRecorder` pattern |
| 10 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | Existing tests — mocking pattern for `QueueService`/`ExecutionResultService`, 40 tests |
| 11 | `services/api-gateway/src/queue/queue.service.ts` | QueueService — Redis/BullMQ constructor, `enqueueExecution()` signature |
| 12 | `services/api-gateway/src/ai/execution-result.service.ts` | ExecutionResultService — TypeORM `DataSource`, `requestCancel()` signature |
| 13 | `services/api-gateway/package.json` | Package dependencies — Jest, TypeScript, NestJS versions |
| 14 | `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` — 5 orchestration fields (07C2) |
| 15 | `services/ai-service/src/worker/worker.processor.ts` (grep only) | Worker metadata finalization — `collaborationRunId`, `referralTraceId`, `isReferralExecution` preservation confirmed |
| 16 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` (grep only) | Worker tests — 55 tests covering orchestration field propagation |

---

## 18. Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | Exact file created: `docs/AGENT-PLATFORM-07E-CANARY-READINESS-PREFLIGHT.md` | CONFIRMED |
| 2 | No source/service files changed | CONFIRMED |
| 3 | No frontend files changed | CONFIRMED |
| 4 | No database/migration files changed | CONFIRMED |
| 5 | No `.env` files changed | CONFIRMED |
| 6 | No `docker*` files changed | CONFIRMED |
| 7 | No package files changed | CONFIRMED |
| 8 | No test files changed | CONFIRMED |
| 9 | No governance files changed (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | CONFIRMED |
| 10 | No git commits/pushes | CONFIRMED |
| 11 | No tests/builds run | CONFIRMED |
| 12 | No Docker/Postgres/Redis/API Gateway/container-manager/AI Service started | CONFIRMED |
| 13 | No BullMQ jobs submitted | CONFIRMED |
| 14 | No provider/API calls | CONFIRMED |
| 15 | No browser smoke | CONFIRMED |
| 16 | No child slices registered | CONFIRMED |
| 17 | AGENT-HARNESS write canary not touched | CONFIRMED |
| 18 | AGENT-PLATFORM-07E ready for Step 3 | CONFIRMED |

---

## Document Metadata

- **Created:** 2026-07-10
- **Task:** AGENT-PLATFORM-07E Step 2 — Canary Readiness / Preflight Plan
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
