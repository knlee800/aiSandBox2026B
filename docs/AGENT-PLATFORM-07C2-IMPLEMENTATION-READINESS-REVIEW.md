# AGENT-PLATFORM-07C2 — Implementation Readiness / Exact Source-Path Review

**Task ID:** AGENT-PLATFORM-07C2
**Parent Task:** AGENT-PLATFORM-07C — Read-Only Referral Enqueue Flow + Cancel Redesign
**Step:** 2 — Implementation Readiness / Exact Source-Path Review
**Status:** Step 2 COMPLETE
**Date:** 2026-07-09
**Nature:** Static read-only design review — no implementation, no runtime execution
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07C2 ACTIVE | **PASS** — registered in TASKS.md and TASKS_BACKLOG_FULL.md; Step 1 COMPLETE (Registration 2026-07-09); HIGH risk — 4-step loop; Keith approval recorded 2026-07-09 |
| AGENT-PLATFORM-07C1 COMPLETE and LOCKED | **PASS** — 2026-07-09; Orchestration Core Methods + In-Memory Store; 3 in-memory stores + 7 core methods; Jest PASS (1 suite, 13 tests); TypeScript clean |
| AGENT-PLATFORM-07C parent split state correct | **PASS** — Split into 3 child slices approved (07C1/07C2/07C3); 07C1 COMPLETE and LOCKED; 07C2 ACTIVE — Step 1 COMPLETE; 07C3 NOT registered |
| AGENT-PLATFORM-07B COMPLETE and LOCKED | **PASS** — 2026-07-09; API Gateway Orchestration Module Skeleton; `OrchestrationModule` + `OrchestrationService` skeleton; Jest PASS (1 suite, 3 tests); TypeScript clean |
| AGENT-PLATFORM-07A COMPLETE and LOCKED | **PASS** — 2026-07-09; Coordinator Contracts / Schema; `orchestration.contracts.ts` created; TypeScript clean |
| AGENT-PLATFORM-07 COMPLETE and LOCKED | **PASS** — 2026-07-09; Read-Only Orchestration Coordinator Planning; 22-section coordinator plan; source-path review |
| AGENT-PLATFORM-06 COMPLETE and LOCKED | **PASS** — 2026-07-09; Upstream Identity Propagation; 8 files changed; 34 suites / 654 passed |
| AGENT-PLATFORM-05 COMPLETE and LOCKED | **PASS** — 2026-07-09; Multi-Builder Runtime Orchestration Plan; 19-section plan |
| AGENT-PLATFORM-04 COMPLETE and LOCKED | **PASS** — 2026-07-07; Multi-Builder Runtime Topology Plan |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **PASS** — 2026-07-07; Per-Builder Harness Config Adapter; all 3 child slices |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **PASS** — 2026-07-09; Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary; PASS |
| One-active-task rule satisfied | **PASS** — only AGENT-PLATFORM-07C2 (child of AGENT-PLATFORM-07C) is ACTIVE |

**Governance readiness: PASS — all 12 criteria satisfied.**

---

## 2. Foundation Summary

### 2.1 07C Readiness/Design Review (Step 2 COMPLETE 2026-07-09)

- Cancel redesign risk downgraded from HIGH to LOW–MEDIUM
- `queue.obliterate()` confirmed absent from codebase
- Cancel is per-execution via `ExecutionResultService.requestCancel(executionId)` → `usage_records.execution_status = 'cancel_requested'`
- Split into 3 child slices (07C1/07C2/07C3) approved
- In-memory store + JSONB metadata — no DB migration

### 2.2 07C1 In-Memory Orchestration Core (COMPLETE and LOCKED 2026-07-09)

- `OrchestrationService` extended with 3 in-memory `Map` stores:
  - `collaborationRunStore: Map<CollaborationRunId, CollaborationRun>`
  - `referralStore: Map<ReferralId, CollaborationReferral>`
  - `idempotencyStore: Map<IdempotencyKey, ReferralId>`
- 7 core methods: `createCollaborationRun()`, `getCollaborationRun()`, `createReferral()`, `getReferral()`, `completeReferral()`, `failReferral()`, `validateReferral()`
- Safety limits: max depth 3, max agents 4, loop prevention, idempotency
- Jest PASS: 1 suite, 13 tests
- No enqueue, no cancel, no worker changes, no DB migration

### 2.3 07B Module Skeleton (COMPLETE and LOCKED 2026-07-09)

- `OrchestrationModule` + `OrchestrationService` skeleton
- `AppModule` updated with `OrchestrationModule` import
- Two methods: `getDefaultReferralConstraints()`, `getReadOnlyPolicy()`

### 2.4 07A Contracts/Schema (COMPLETE and LOCKED 2026-07-09)

- `orchestration.contracts.ts`: 10 ID type aliases, agent identity types, status unions, safety constants, 8 core interfaces including `OrchestrationJobMetadata`

### 2.5 AGENT-PLATFORM-06 Identity Propagation (COMPLETE and LOCKED 2026-07-09)

- `agentRole`, `builderProfileId` — full path: `AIExecutionRequest` → controller → `usage_records.metadata` JSONB → BullMQ job → worker `nextMetadata` finalization
- `collaborationRunId`, `referralTraceId` — type-level placeholders on `AIExecutionRequest` and `AiExecutionJob`; NOT stored in usage records yet; always `undefined` today

### 2.6 AGENT-HARNESS-06E Read-Only E2E Path (COMPLETE and LOCKED 2026-07-09)

- Full E2E tool dispatch validated: Worker → ToolDispatcher → file-tool-handlers → ApiGatewayHttpClient → API Gateway → container-manager → Docker container
- `list_files` SUCCESS; `read_file` SUCCESS; zero billing; 718ms

---

## 3. Current Source-Path Map

### 3.1 OrchestrationService Current State

**File:** `services/api-gateway/src/orchestration/orchestration.service.ts` (522 lines)

| Method | Origin | Status |
|--------|--------|--------|
| `getDefaultReferralConstraints()` | 07B | Implemented — returns frozen copy of default constraints |
| `getReadOnlyPolicy()` | 07B | Implemented — returns read-only policy object |
| `createCollaborationRun()` | 07C1 | Implemented — creates and stores `CollaborationRun` in memory |
| `getCollaborationRun()` | 07C1 | Implemented — retrieves stored run by ID |
| `createReferral()` | 07C1 | Implemented — validates, creates, stores referral; updates collaboration run |
| `getReferral()` | 07C1 | Implemented — retrieves stored referral by ID |
| `completeReferral()` | 07C1 | Implemented — transitions referral to `completed` with result; idempotent |
| `failReferral()` | 07C1 | Implemented — transitions referral to `failed` with result; idempotent |
| `validateReferral()` | 07C1 | Implemented — enforces depth, loop, agent count, idempotency |
| `startReferralExecution()` | — | **NOT YET IMPLEMENTED — 07C2 scope** |
| `cancelReferral()` | — | **NOT YET IMPLEMENTED — 07C2 scope** |
| `cancelCollaboration()` | — | **NOT YET IMPLEMENTED — 07C2 scope** |

**Private helpers (07C1):** `resolveConstraints()`, `getStoredCollaborationRun()`, `getStoredReferral()`, `assertCanFinalizeReferral()`, `cloneCollaborationRun()`, `cloneReferral()`, `uniqueBuilderIds()`, `generateId()`, `buildIdempotencyStoreKey()`, `now()`

### 3.2 QueueService Enqueue Path

**File:** `services/api-gateway/src/queue/queue.service.ts` (51 lines)

| Aspect | Current State |
|--------|--------------|
| `enqueueExecution(jobData: any)` | Adds `execute-ai` job to `ai-execution` BullMQ queue; `attempts: 1`, `removeOnComplete: true`, `removeOnFail: false` |
| Cancel method | **NONE on QueueService** — QueueService has NO cancel method |
| `obliterate()` | **NOT PRESENT** — confirmed via grep: zero `.ts` source files contain `obliterate`; only governance/doc files reference it as a corrected error |
| Job payload type | `any` — no typed constraint on enqueue side |
| Queue name | `ai-execution` |
| Job name | `execute-ai` |

### 3.3 API Gateway Execute Path

**File:** `services/api-gateway/src/ai/ai-execution.controller.ts`

| Step | Code Location | Detail |
|------|---------------|--------|
| 1 | `POST /api/ai/execute` | Guard chain: `SessionOrApiKeyAuthGuard` → `AuthorizationGuard` → `ExecutionSafetyGuard` → `LaunchGuard` → `AbortGuard` → `IdempotencyGuard` → `QuotaGuard` → `TokenQuotaGuard` → `RateLimitGuard` |
| 2 | `execute()` method | Validates sessionId, harnessVersion, harnessEntitlement, session ownership |
| 3 | `usageLedgerService.writeExecutionIntent()` | Writes `usage_records` row with `execution_status = 'pending'`; includes `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` in metadata |
| 4 | `queueService.enqueueExecution()` | Enqueues BullMQ job with all identity fields conditionally spread |
| 5 | Return 202 | `{ executionId, status: 'queued' }` |

**AIExecutionRequest type:** `services/api-gateway/src/clients/ai-service-http.client.ts` — includes `agentRole?`, `builderProfileId?`, `collaborationRunId?`, `referralTraceId?` (AGENT-PLATFORM-06)

### 3.4 Cancel Path Through ExecutionResultService.requestCancel()

**File:** `services/api-gateway/src/ai/execution-result.service.ts`

| Step | Detail |
|------|--------|
| Cancel endpoint | `POST /api/ai/executions/:executionId/cancel` |
| Controller | `AIExecutionController.cancelExecution(executionId)` — guarded by `SessionOrApiKeyAuthGuard` |
| Service call | `ExecutionResultService.requestCancel(executionId)` |
| SQL | `UPDATE usage_records SET execution_status = 'cancel_requested' WHERE execution_id = $1 AND execution_status = 'running' RETURNING execution_id` |
| Return | `true` if update succeeded; controller returns 409 Conflict if `false` |

**This is a per-execution cancel mechanism.** Targets one specific `executionId`. Does not touch BullMQ queue. Does not affect other executions.

### 3.5 AI Service AiExecutionJob Type

**File:** `services/ai-service/src/queue/job.types.ts` (87 lines)

| Field | Type | Origin |
|-------|------|--------|
| `executionId` | `string` | Required — original |
| `userId`, `apiKeyId` | `string` | Required — original |
| `sessionId`, `conversationId` | `string` | Required — original |
| `provider`, `adapter` | Union type | Required — original |
| `prompt` | `string` | Required — original |
| `workspaceContext?` | `WorkspaceContext` | Optional — original |
| `model?` | `string` | Optional — original |
| `harnessVersion?` | `string` | Optional — harness gate |
| `agentRole?` | `string` | Optional — AGENT-HARNESS-07B |
| `builderProfileId?` | `string` | Optional — AGENT-HARNESS-07B |
| `harnessProfileId?`, `modelProfileId?`, `toolPermissionProfileId?` | `string` | Optional — AGENT-HARNESS-07B |
| `collaborationRunId?` | `string` | Optional — AGENT-PLATFORM-06 |
| `referralTraceId?` | `string` | Optional — AGENT-PLATFORM-06 |
| `requestId?` | `string` | Optional — original |
| `submittedAt` | `string` | Required — original |

**Missing fields for 07C2:**

| Field | Type | Purpose |
|-------|------|---------|
| `parentReferralTraceId?` | `string` | Links to parent referral in chain |
| `referringBuilderProfileId?` | `string` | Which builder triggered this job |
| `orchestrationPriority?` | `number` | Queue priority hint (placeholder) |
| `referralId?` | `string` | Links to specific referral record |
| `isReferralExecution?` | `boolean` | Distinguishes referred jobs from direct |

### 3.6 Worker Job Consumption and Cancel Polling

**File:** `services/ai-service/src/worker/worker.processor.ts` (1166 lines)

| Aspect | Current State |
|--------|--------------|
| Queue consumed | `ai-execution` |
| Claim | Atomically updates `usage_records` from `pending` → `running` |
| Identity usage | Reads `job.data.agentRole`, `job.data.builderProfileId`; passes to `resolveBuilderHarnessConfig()` |
| Cancel detection | `AbortController` + `pollCancel()` every 1000ms — checks `usage_records.execution_status` for `cancel_requested` |
| Abort | `abortController.abort()` when `cancel_requested` detected |
| Timeout | `EXECUTION_TIMEOUT_MS` + timeout watchdog; sets `execution_status = 'timeout'` |
| Finalization (lines 1002–1017) | Merges `nextMetadata` with: `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` — all from `job.data` |
| **Missing new fields** | `parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution` — NOT read from `job.data`; NOT preserved in `nextMetadata` |

### 3.7 usage_records Metadata Persistence

| Location | `agentRole`/`builderProfileId` | `collaborationRunId`/`referralTraceId` |
|----------|-------------------------------|---------------------------------------|
| Intent write (controller) | Stored in `metadata` JSONB | Stored in `metadata` JSONB (AGENT-PLATFORM-06) |
| Worker finalization | Preserved in `nextMetadata` (lines 1014–1017) | Conditionally preserved in `nextMetadata` (lines 1016–1017) |
| `CreditDeductionEvent` | ABSENT | ABSENT |
| `CreditDeductionRecord.agentId` | Column exists, never populated | N/A |

---

## 4. Critical Cancel Correction

### 4.1 No queue.obliterate Call Exists

**CONFIRMED.** Grep for `obliterate` across all source files returns zero matches in `.ts` source files. Only governance/doc files reference obliterate as a corrected error from the AGENT-PLATFORM-07 source-path review.

### 4.2 Current Cancel Is Per-Execution via usage_records

**CONFIRMED.** The cancel mechanism is:
1. `POST /api/ai/executions/:executionId/cancel` → `ExecutionResultService.requestCancel(executionId)`
2. SQL: `UPDATE usage_records SET execution_status = 'cancel_requested' WHERE execution_id = $1 AND execution_status = 'running'`
3. Worker's `pollCancel()` detects `cancel_requested` every ~1000ms → `abortController.abort()`
4. Worker then sets `execution_status = 'cancelled'`

This targets **one specific executionId**. It does not touch BullMQ queue. It does not affect other executions.

### 4.3 Worker AbortController Behavior

**CONFIRMED.** Worker creates `const abortController = new AbortController()` per job (line 667). Cancel polling triggers `abortController.abort()`. Abort signal propagates to:
- AI provider execution (via `signal` parameter)
- Sleep during retry backoff (via `sleep(delay, abortController.signal)`)
- Agent harness loop (via `signal: abortController.signal` in loop options)

### 4.4 What 07C2 Should and Should Not Change About Cancel

| Should Change | Detail |
|---------------|--------|
| Add `cancelReferral()` | Look up referral's `executionId` → call existing `requestCancel(executionId)` → update referral `cancelStatus` in in-memory store |
| Add `cancelCollaboration()` | Iterate all active referrals for `collaborationRunId` → call `cancelReferral()` for each → update `CollaborationRun.status` to `cancelled` |
| Track `executionId` per referral | `OrchestrationService` must record which `executionId` was created for each referral during `startReferralExecution()` |

| Should NOT Change | Detail |
|-------------------|--------|
| `ExecutionResultService.requestCancel()` | Already per-execution — no change needed |
| Worker `pollCancel()` mechanism | Already detects `cancel_requested` — no change needed |
| Worker `AbortController` | Already aborts on cancel — no change needed |
| `QueueService` | No cancel method needed — cancel is ledger-based, not queue-based |
| Cancel endpoint URL | `POST /api/ai/executions/:executionId/cancel` remains — future orchestration-level cancel endpoint is a separate concern |

---

## 5. Referral Enqueue Design Boundary

### 5.1 Whether 07C2 Should Prepare Metadata or Actually Enqueue

**07C2 should both prepare referral job metadata AND call `QueueService.enqueueExecution()`.** Reason: preparing metadata without enqueue would leave the referral in `pending_approval` / `approved` state with no mechanism to actually start Builder B's execution. The enqueue is the minimal next step that makes the referral lifecycle functional.

However, 07C2 does NOT need to create Builder B sessions or call `SessionService`. Session creation is a runtime concern that requires Docker/container-manager and can be deferred to the canary task (07E) or a later slice. For now, `startReferralExecution()` will accept a pre-existing `sessionId` and `conversationId` as input and build the enriched job payload around them.

### 5.2 Exact Methods to Add to OrchestrationService

| Method | Purpose | Inputs | Key Behavior |
|--------|---------|--------|--------------|
| `startReferralExecution(input)` | Transitions referral to `in_progress`; builds enriched job payload with orchestration metadata; calls `QueueService.enqueueExecution()` | `referralId`, `executionId`, `sessionId`, `conversationId`, `prompt`, `workspaceContext`, `provider`, `adapter`, `model`, `harnessVersion` | Records `executionId` on referral; builds `OrchestrationJobMetadata`; enqueues via `QueueService` |
| `cancelReferral(input)` | Cancels a specific referral's execution | `referralId`, `cancelledByUserId`, `cancelReason` | Looks up execution ID; calls `ExecutionResultService.requestCancel()`; updates referral `cancelStatus` + `status` |
| `cancelCollaboration(input)` | Cascade-cancels all active referrals in a collaboration | `collaborationRunId`, `cancelledByUserId`, `cancelReason` | Iterates all referral IDs for the run; calls `cancelReferral()` for each with active execution; updates `CollaborationRun.status` to `cancelled` |

### 5.3 How collaborationRunId / referralTraceId / referralId Should Flow

| Field | Source | Job Payload | Worker Reads | Worker Preserves |
|-------|--------|-------------|--------------|------------------|
| `collaborationRunId` | `CollaborationRun` → referral → `startReferralExecution()` | `job.data.collaborationRunId` | Already reads (PLATFORM-06) | Already preserves (PLATFORM-06) |
| `referralTraceId` | `CollaborationReferral.referralTraceId` | `job.data.referralTraceId` | Already reads (PLATFORM-06) | Already preserves (PLATFORM-06) |
| `parentReferralTraceId` | `CollaborationReferral.parentReferralTraceId` | `job.data.parentReferralTraceId` | **NEW** — must read | **NEW** — must preserve |
| `referringBuilderProfileId` | `CollaborationReferral.sourceBuilder.builderProfileId` | `job.data.referringBuilderProfileId` | **NEW** — must read | **NEW** — must preserve |
| `referralId` | `CollaborationReferral.referralId` | `job.data.referralId` | **NEW** — must read | **NEW** — must preserve |
| `isReferralExecution` | Hardcoded `true` for referral jobs | `job.data.isReferralExecution` | **NEW** — must read | **NEW** — must preserve |
| `orchestrationPriority` | Caller-provided or `undefined` | `job.data.orchestrationPriority` | **NEW** — must read | **NEW** — must preserve |

### 5.4 How Source/Target Builder Identity Should Flow

| Field | Builder A (Source) Job | Builder B (Target) Job |
|-------|----------------------|----------------------|
| `builderProfileId` | Source's `builderProfileId` | Target's `builderProfileId` |
| `agentRole` | Source's `agentRole` | Target's `agentRole` |
| `referringBuilderProfileId` | `null` (initiator) | Source's `builderProfileId` |
| `isReferralExecution` | `false` or `undefined` | `true` |
| `collaborationRunId` | Shared UUID | Same shared UUID |
| `referralTraceId` | Source step trace | Child referral trace |

### 5.5 Idempotency and Safety Checks Reuse

| Safety Check | Method | Reuse Status |
|--------------|--------|-------------|
| Depth enforcement | `validateReferral()` — 07C1 | **Already implemented** — called by `createReferral()` |
| Loop prevention | `validateReferral()` — 07C1 | **Already implemented** — checks `visitedBuilderProfileIds` |
| Agent count | `validateReferral()` — 07C1 | **Already implemented** — checks projected count vs max |
| Idempotency | `validateReferral()` + `idempotencyStore` — 07C1 | **Already implemented** — returns existing referral on duplicate |
| Read-only enforcement | `resolveConstraints()` — 07C1 | **Already implemented** — throws on `readOnly: false` or `allowWriteTools: true` |

`startReferralExecution()` will call `assertCanFinalizeReferral()` equivalent to verify referral is in `pending_approval` or `approved` state before enqueue. It does NOT re-run `validateReferral()` since that was already called during `createReferral()`.

### 5.6 Read-Only Mode Enforcement Before Enqueue

**YES.** The referral's `constraints` field already enforces `readOnly: true` and `allowWriteTools: false` (07C1's `resolveConstraints()` throws on violations). `startReferralExecution()` should verify that the referral's stored constraints still satisfy read-only policy before building the job payload. This is a lightweight safety check, not a re-validation.

---

## 6. AiExecutionJob Extension Decision

### 6.1 Whether Fields Are Needed Now

| Field | Needed for 07C2? | Rationale |
|-------|-------------------|-----------|
| `parentReferralTraceId?` | **YES** | Required to link referral chain; needed for per-referral cancel cascade and depth auditing |
| `referringBuilderProfileId?` | **YES** | Required to trace which builder triggered the referral; needed for audit and billing attribution |
| `orchestrationPriority?` | **YES (placeholder)** | Type-level placeholder; not used by BullMQ priority yet but needed in job payload for future activation |
| `referralId?` | **YES** | Required to link job to specific referral record; needed for cancel lookup and result delivery |
| `isReferralExecution?` | **YES** | Required to distinguish referred jobs from direct; needed for worker finalization metadata |

### 6.2 Exact Files That Would Change

| File | Change |
|------|--------|
| `services/ai-service/src/queue/job.types.ts` | Add 5 new optional fields to `AiExecutionJob` interface |

### 6.3 Backward Compatibility Requirements

| Requirement | How Satisfied |
|-------------|---------------|
| All 5 new fields are optional | Existing jobs without these fields continue to work |
| Worker must not crash when fields absent | Worker reads with `job.data.fieldName !== undefined` check (same pattern as AGENT-PLATFORM-06) |
| Existing tests must pass | No required field signature changes; all existing `AiExecutionJob` test fixtures remain valid |
| `AiExecutionResult` unchanged | Result type not modified |

---

## 7. QueueService Decision

### 7.1 Whether QueueService Needs a New Method

**NO.** `QueueService.enqueueExecution(jobData: any)` already accepts any payload. The new orchestration fields are additional properties on the job payload object. No `QueueService` code change is needed.

### 7.2 How Referral Metadata Should Be Included

`OrchestrationService.startReferralExecution()` builds the complete job payload object with all standard fields plus orchestration fields (spread from `OrchestrationJobMetadata`), then passes the entire object to `QueueService.enqueueExecution()`.

### 7.3 Whether BullMQ Priority Should Be Used Now

**NO — deferred.** The `orchestrationPriority` field will be a type-level placeholder on the job payload. BullMQ's built-in job priority mechanism will NOT be activated in 07C2. Activation requires careful testing of priority queue semantics and is better suited for a future slice.

### 7.4 Exact Tests Needed for QueueService

**NONE.** `QueueService` itself is not modified. Tests for enqueue behavior belong in `OrchestrationService` tests where the `QueueService` is mocked.

---

## 8. Cancel Cascade Decision

### 8.1 Whether 07C2 Should Implement Per-Collaboration/Per-Referral Cancel Cascade

**YES — bounded scope.** 07C2 should implement:
1. `cancelReferral(referralId, cancelledByUserId, cancelReason)` — per-referral cancel
2. `cancelCollaboration(collaborationRunId, cancelledByUserId, cancelReason)` — cascade cancel for all active referrals in a collaboration

### 8.2 Whether Existing ExecutionResultService.requestCancel() Is Enough

**YES for the per-execution cancel primitive.** `requestCancel(executionId)` is the atomic cancel operation. 07C2 wraps it with orchestration-level cancel logic:
- `cancelReferral()` looks up the referral's `executionId`, calls `requestCancel()`, then updates in-memory referral state
- `cancelCollaboration()` iterates all referrals, calls `cancelReferral()` for each with an active execution

### 8.3 Whether OrchestrationService Should Track executionIds Per Referral

**YES.** `startReferralExecution()` must record the `executionId` on the referral record. This requires extending the in-memory `CollaborationReferral` data to include an `executionId` field. Two options:

**Option A (recommended):** Add a private `referralExecutionMap: Map<ReferralId, string>` store in `OrchestrationService` to track which `executionId` was created for each referral. This avoids modifying the `CollaborationReferral` contract type (07A).

**Option B:** Add `executionId?: string` to the `CollaborationReferral` interface in `orchestration.contracts.ts`. This modifies a COMPLETE and LOCKED contract file (07A).

**Recommendation: Option A** — use a separate private map. The contract type remains unchanged. The `executionId` is an implementation detail of the enqueue flow, not a core referral contract field.

### 8.4 Ownership Checks Required

| Check | Implementation |
|-------|----------------|
| `cancelReferral()` ownership | Verify `cancelledByUserId` matches the collaboration run's `userId` |
| `cancelCollaboration()` ownership | Verify `cancelledByUserId` matches `CollaborationRun.userId` |
| Worker self-cancel | Not applicable — worker does not call `cancelReferral()` |
| Cross-user access | `cancelReferral()` and `cancelCollaboration()` throw if userId mismatch |

### 8.5 What Remains Deferred

| Deferred Item | Reason |
|---------------|--------|
| Per-referral timeout (`setTimeout`) | Runtime timer behavior requires careful lifecycle management; deferred to canary or later slice |
| Collaboration-level timeout | Same as above |
| Idle timeout | Same as above |
| Cancel endpoint for orchestration (`POST /api/internal/orchestration/referrals/:id/cancel`) | Controller/endpoint creation is a separate scope item |
| Frontend cancel UI for collaboration-level cancel | No UI in 07C2 |

---

## 9. Persistence Decision

### 9.1 Whether DB Migration Is Needed

**NO.** No database migration. In-memory store + JSONB metadata on `usage_records` is sufficient for the first implementation.

### 9.2 Whether In-Memory + Metadata JSONB Remains Enough

**YES.** The in-memory stores (`collaborationRunStore`, `referralStore`, `idempotencyStore`, plus the new `referralExecutionMap`) are sufficient for initial controlled orchestration. JSONB metadata on `usage_records` provides audit trail without migration.

### 9.3 Whether usage_records Metadata Is Enough for First Implementation

**YES.** The 5 new orchestration fields (`parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution`) will be preserved in `usage_records.metadata` JSONB via worker finalization (same pattern as AGENT-PLATFORM-06). This provides:
- Per-referral cost attribution via `referralId` in metadata
- Per-collaboration grouping via `collaborationRunId` in metadata
- Referral chain auditing via `parentReferralTraceId` in metadata

### 9.4 Risks and Recommendation

| Risk | Severity | Mitigation |
|------|----------|------------|
| In-memory data lost on restart | LOW | Acceptable for initial controlled orchestration; collaborations are transient |
| JSONB not efficiently queryable for reporting | LOW | Sufficient for audit; dedicated tables deferred to future slice |
| No relational integrity | LOW | In-memory checks sufficient for first slice; DB tables later |

**Recommendation: In-memory store + JSONB metadata. No database migration.**

---

## 10. Exact Step 3 Implementation Boundary

### 10.1 Exact Files Likely to Change

| # | File | Change Type | Change Scope |
|---|------|-------------|-------------|
| 1 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Modified | Add `startReferralExecution()`, `cancelReferral()`, `cancelCollaboration()`; add `referralExecutionMap` private store; add input interfaces |
| 2 | `services/api-gateway/src/orchestration/orchestration.module.ts` | Modified | Import `QueueModule`; inject `ExecutionResultService` provider (or its module) for cancel |
| 3 | `services/ai-service/src/queue/job.types.ts` | Modified | Add 5 new optional fields to `AiExecutionJob` interface |
| 4 | `services/ai-service/src/worker/worker.processor.ts` | Modified | Read 5 new orchestration fields from `job.data`; preserve in `nextMetadata` finalization (~5 lines) |
| 5 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | Modified | Add tests for `startReferralExecution()`, `cancelReferral()`, `cancelCollaboration()` |
| 6 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | Modified | Add tests for new orchestration fields preserved in finalization metadata |

### 10.2 Exact Methods Likely to Add/Change

**OrchestrationService — new methods:**

| Method | Signature (simplified) | Purpose |
|--------|----------------------|---------|
| `startReferralExecution(input)` | `(input: StartReferralExecutionInput) => Promise<{ executionId: string }>` | Transitions referral to `in_progress`; builds enriched job payload; enqueues via `QueueService` |
| `cancelReferral(input)` | `(input: CancelReferralInput) => Promise<CollaborationReferral>` | Cancels referral's execution via `requestCancel()`; updates in-memory state |
| `cancelCollaboration(input)` | `(input: CancelCollaborationInput) => Promise<CollaborationRun>` | Cascade-cancels all active referral executions; updates collaboration run status |

**OrchestrationService — new private members:**

| Member | Type | Purpose |
|--------|------|---------|
| `referralExecutionMap` | `Map<ReferralId, string>` | Maps referral ID → execution ID for cancel lookup |

**OrchestrationService — new input interfaces:**

| Interface | Fields |
|-----------|--------|
| `StartReferralExecutionInput` | `referralId`, `executionId`, `sessionId`, `conversationId`, `userId`, `apiKeyId`, `prompt`, `workspaceContext?`, `provider`, `adapter`, `model?`, `harnessVersion?`, `globalInstructions?`, `projectInstructions?`, `submittedAt` |
| `CancelReferralInput` | `referralId`, `cancelledByUserId`, `cancelReason` |
| `CancelCollaborationInput` | `collaborationRunId`, `cancelledByUserId`, `cancelReason` |

### 10.3 Exact Tests Likely to Add/Update

| # | Test File | Tests to Add |
|---|-----------|-------------|
| 1 | `orchestration.service.spec.ts` | `startReferralExecution()` builds enriched job payload with all orchestration fields |
| 2 | `orchestration.service.spec.ts` | `startReferralExecution()` transitions referral to `in_progress` |
| 3 | `orchestration.service.spec.ts` | `startReferralExecution()` rejects if referral not in valid state |
| 4 | `orchestration.service.spec.ts` | `startReferralExecution()` records executionId in referralExecutionMap |
| 5 | `orchestration.service.spec.ts` | `cancelReferral()` calls requestCancel with correct executionId |
| 6 | `orchestration.service.spec.ts` | `cancelReferral()` updates referral cancelStatus and status |
| 7 | `orchestration.service.spec.ts` | `cancelReferral()` enforces userId ownership |
| 8 | `orchestration.service.spec.ts` | `cancelCollaboration()` cascade-cancels all active referral executions |
| 9 | `orchestration.service.spec.ts` | `cancelCollaboration()` updates collaboration run status to cancelled |
| 10 | `orchestration.service.spec.ts` | `cancelCollaboration()` enforces userId ownership |
| 11 | `orchestration.service.spec.ts` | Backward compatibility: existing 13 tests continue to pass |
| 12 | `worker.processor.builder-config.spec.ts` | `AiExecutionJob` accepts 5 new optional fields |
| 13 | `worker.processor.builder-config.spec.ts` | Worker source preserves new orchestration fields in `nextMetadata` |
| 14 | `worker.processor.builder-config.spec.ts` | Existing identity fields still preserved when new fields absent |

### 10.4 Whether API Gateway Controller Changes Are Needed

**NO.** No new controller endpoints in 07C2. The `OrchestrationService` methods are internal service methods, not HTTP endpoints. Future controller/endpoint creation (e.g., `POST /api/internal/orchestration/referrals/:id/cancel`) is a separate scope item.

### 10.5 Whether AI Service Worker Changes Are Needed

**YES — minimal.** The worker needs to:
1. Read 5 new orchestration fields from `job.data` (same pattern as existing `collaborationRunId`/`referralTraceId`)
2. Preserve them in `nextMetadata` during finalization (~5 lines of `if (job.data.fieldName !== undefined) nextMetadata.fieldName = job.data.fieldName;`)

### 10.6 Whether DB Migration Is Needed

**NO.**

### 10.7 Whether Runtime Canary Is Deferred

**YES.** Runtime canary (AGENT-PLATFORM-07E) is a future task. 07C2 is a code-level implementation validated by unit tests. No Docker/Postgres/Redis/BullMQ runtime execution in 07C2.

---

## 11. Split Decision

### 11.1 Scope Assessment

07C2 as registered includes:
1. `startReferralExecution()` — builds enriched job payload, enqueues via `QueueService` (~60–80 lines)
2. `cancelReferral()` — per-referral cancel via `requestCancel()` (~30–40 lines)
3. `cancelCollaboration()` — cascade cancel (~30–40 lines)
4. `AiExecutionJob` type extension — 5 new optional fields (~10 lines)
5. Worker finalization extension — ~5 lines
6. `OrchestrationModule` wiring — QueueService import + ExecutionResultService injection (~5–10 lines)
7. Input interfaces — ~30 lines
8. Tests — ~14 new tests

**Estimated total production code change: ~180–220 lines across 4 files.**
**Estimated total test code change: ~200–250 lines across 2 files.**

### 11.2 Decision: A — Proceed with One Bounded Step 3 Implementation

**Decision: A — Proceed with one bounded Step 3 implementation.**

Rationale:
- The cancel redesign risk was downgraded from HIGH to LOW–MEDIUM (07C readiness review)
- `startReferralExecution()`, `cancelReferral()`, and `cancelCollaboration()` are tightly coupled lifecycle methods that belong together
- The AI Service changes are minimal (~15 lines total)
- The total production code change (~200 lines) is within the bounded implementation norm for a MEDIUM risk slice
- Splitting further would create artificially incomplete lifecycle: enqueue without cancel, or cancel without enqueue
- All 3 new `OrchestrationService` methods depend on the same `referralExecutionMap` store
- The worker changes follow the exact established pattern from AGENT-PLATFORM-06

**If during implementation the scope proves larger than expected, a further split should be proposed before continuing.**

---

## 12. Test Plan

### 12.1 OrchestrationService Tests

| # | Test | Scope |
|---|------|-------|
| 1 | `startReferralExecution()` builds enriched job payload with all orchestration metadata fields | Verify `collaborationRunId`, `referralTraceId`, `parentReferralTraceId`, `referringBuilderProfileId`, `referralId`, `isReferralExecution`, `orchestrationPriority` on enqueued payload |
| 2 | `startReferralExecution()` transitions referral status to `in_progress` | Verify referral status change |
| 3 | `startReferralExecution()` rejects if referral not in valid starting state | Verify throw for completed/failed/cancelled referral |
| 4 | `startReferralExecution()` records executionId in private map | Verify lookup for cancel |
| 5 | `cancelReferral()` calls requestCancel with correct executionId | Mock `ExecutionResultService.requestCancel()` |
| 6 | `cancelReferral()` updates referral cancelStatus to `cancelled` | Verify in-memory state update |
| 7 | `cancelReferral()` enforces userId ownership | Verify throw when userId doesn't match |
| 8 | `cancelReferral()` handles case when execution already completed | Verify graceful handling |
| 9 | `cancelCollaboration()` cascade-cancels all active referral executions | Verify all referrals cancelled |
| 10 | `cancelCollaboration()` updates collaboration run status to `cancelled` | Verify run status |
| 11 | `cancelCollaboration()` enforces userId ownership | Verify throw on mismatch |

### 12.2 QueueService Tests

**NONE needed.** `QueueService` is not modified. It is mocked in `OrchestrationService` tests.

### 12.3 AiExecutionJob Type / Worker Tests

| # | Test | Scope |
|---|------|-------|
| 1 | `AiExecutionJob` accepts `parentReferralTraceId` | Type-level validation in spec |
| 2 | `AiExecutionJob` accepts `referringBuilderProfileId` | Type-level validation in spec |
| 3 | `AiExecutionJob` accepts `orchestrationPriority` | Type-level validation in spec |
| 4 | `AiExecutionJob` accepts `referralId` | Type-level validation in spec |
| 5 | `AiExecutionJob` accepts `isReferralExecution` | Type-level validation in spec |
| 6 | Worker source preserves new orchestration fields in `nextMetadata` | Source code inspection test (established pattern from AGENT-HARNESS-07B) |

### 12.4 Cancel Cascade Tests

Covered in OrchestrationService tests §12.1 items 5–11.

### 12.5 Backward Compatibility Tests

| # | Test | Scope |
|---|------|-------|
| 1 | All 13 existing OrchestrationService tests continue to pass | Regression |
| 2 | `AiExecutionJob` without new fields processes normally | Type-level — existing test fixtures remain valid |
| 3 | Worker preserves existing identity fields when new fields absent | Source inspection or explicit test |

### 12.6 No Browser Smoke

No browser smoke tests. No frontend UI changes. No runtime canary in this task.

---

## 13. Risks/Blockers

### 13.1 Queue Behavior Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| `QueueService.enqueueExecution()` accepts `any` | LOW | Existing behavior; new fields are additional properties; no runtime type checking needed |
| BullMQ priority not activated | LOW | `orchestrationPriority` is a placeholder; no priority queue semantics yet |

### 13.2 Cancel Ownership Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cross-user cancel attempt | MEDIUM | `cancelReferral()` and `cancelCollaboration()` verify `cancelledByUserId` matches `CollaborationRun.userId` |
| `ExecutionResultService.requestCancel()` has no ownership check | LOW | Internal service call within same process; orchestration-level ownership check is sufficient |

### 13.3 Metadata Compatibility Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| New metadata fields in JSONB | LOW | All optional; existing records unaffected; no schema migration |
| Metadata parse failure | LOW | Worker uses defensive `!== undefined` checks |

### 13.4 Worker Contract Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Worker crash on new fields | VERY LOW | All fields optional; same pattern as AGENT-PLATFORM-06 |
| Worker doesn't preserve new fields | LOW | Explicit test verifies preservation |

### 13.5 Migration Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| No migration needed | N/A | In-memory store + JSONB metadata |

### 13.6 Runtime Canary Need Later

| Risk | Severity | Mitigation |
|------|----------|------------|
| No runtime validation in 07C2 | MEDIUM | AGENT-PLATFORM-07E (Read-Only Coordinator Canary) planned for future |
| In-memory store not validated under load | LOW | First slice is controlled/low-volume |

### 13.7 Module Wiring Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| `OrchestrationModule` needs `QueueService` | LOW | `QueueModule` already exists and exports `QueueService`; standard NestJS import |
| `OrchestrationModule` needs `ExecutionResultService` | LOW | `ExecutionResultService` is in the `ai` module area; may need to be exported from its module or directly provided |

---

## 14. UX/UI Constraints

### 14.1 No UI Expected

AGENT-PLATFORM-07C2 is backend-only. No user-facing UI is created or modified.

### 14.2 Future UI Text

If future implementation adds UI text for orchestration:
- Update `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
- Update `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
- Update `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`)
- Do NOT add hardcoded English UI copy
- Icons: **Heroicons v2 Outline only**
- Impeccable / Emil Kowalski skills are **advisory only**

---

## 15. Step 3 Readiness Conclusion

### 15.1 Ready/Not Ready

**READY — AGENT-PLATFORM-07C2 is ready for Step 3 implementation.**

All governance prerequisites satisfied. All source paths verified. Cancel mechanism confirmed compatible. Implementation boundary well-defined. No split required — proceed as one bounded Step 3.

### 15.2 Recommended Implementation Model

**GPT-5.3 Codex High** — cross-service type changes + enqueue/cancel integration; existing patterns reduce risk but security-adjacent cancel logic warrants higher-tier model.

### 15.3 Exact Next Prompt Type

**Implementation prompt for AGENT-PLATFORM-07C2 Step 3** — bounded implementation across 4 production files + 2 test files. Must include:
- This review document path for context
- 07C1 checkpoint for predecessor state
- Explicit list of files to change
- Explicit list of methods to add
- Explicit test expectations
- Confirmation of no DB migration, no controller endpoints, no runtime canary

### 15.4 Whether Keith Approval Is Needed Before Implementation

**NO additional approval needed.** Keith already approved 07C2 registration (2026-07-09). Step 2 (this readiness review) is now COMPLETE. Step 3 (implementation) can proceed per the 4-step loop.

---

## Final Report

### 1. Exact File Created/Changed

| File | Action |
|------|--------|
| `docs/AGENT-PLATFORM-07C2-IMPLEMENTATION-READINESS-REVIEW.md` | CREATED (this document) |

### 2. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task verification |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — mirror verification |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence |
| 4 | `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md` | Predecessor — orchestration core methods |
| 5 | `docs/AGENT-PLATFORM-07C-READINESS-DESIGN-REVIEW.md` | Parent task readiness review |
| 6 | `docs/AGENT-PLATFORM-07B-CHECKPOINT.md` | Predecessor — module skeleton |
| 7 | `docs/AGENT-PLATFORM-07A-CHECKPOINT.md` | Predecessor — contracts/schema |
| 8 | `docs/AGENT-PLATFORM-07-CHECKPOINT.md` | Predecessor — coordinator planning |
| 9 | `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md` | 22-section coordinator plan |
| 10 | `services/api-gateway/src/orchestration/orchestration.contracts.ts` | Contracts file (07A) — 238 lines |
| 11 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Service (07B+07C1) — 522 lines |
| 12 | `services/api-gateway/src/orchestration/orchestration.module.ts` | Module skeleton (07B) — 8 lines |
| 13 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | Tests (07B+07C1) — 426 lines |
| 14 | `services/api-gateway/src/queue/queue.service.ts` | BullMQ enqueue — 51 lines |
| 15 | `services/api-gateway/src/queue/queue.module.ts` | Queue module — 8 lines |
| 16 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution controller — 746 lines |
| 17 | `services/api-gateway/src/ai/execution-result.service.ts` | Cancel implementation — 74 lines |
| 18 | `services/api-gateway/src/clients/ai-service-http.client.ts` | `AIExecutionRequest` type |
| 19 | `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` type — 87 lines |
| 20 | `services/ai-service/src/worker/worker.processor.ts` | Worker — 1166 lines |
| 21 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | Worker builder config tests |

### 3. Governance Readiness Result

**PASS — all 12 criteria satisfied.**

### 4. Source-Path Findings

- `OrchestrationService` has 9 implemented methods (07B+07C1); 3 methods needed (07C2)
- All contracts defined in `orchestration.contracts.ts` (07A) — including `OrchestrationJobMetadata`
- `QueueService` has only `enqueueExecution(jobData: any)` — no cancel method; no obliterate; accepts any payload
- Cancel is per-execution via `ExecutionResultService.requestCancel(executionId)` → `usage_records.execution_status = 'cancel_requested'`
- Worker polls for cancel status every ~1000ms; aborts via `AbortController`
- 5 new fields needed on `AiExecutionJob`
- Worker finalization needs to preserve 5 new orchestration fields (~5 lines)

### 5. Cancel Findings

- **No `obliterate` call exists in any source file** — confirmed via codebase-wide grep
- Cancel is already per-execution, ledger-based, and compatible with multi-builder orchestration
- Only cascade logic (per-collaboration cancel) needs to be added in `OrchestrationService`
- Worker's existing `AbortController` + `pollCancel()` mechanism is sufficient
- No `QueueService` redesign needed

### 6. Referral Enqueue Boundary

- 07C2 should both prepare metadata AND enqueue via `QueueService.enqueueExecution()`
- `startReferralExecution()` accepts pre-existing `sessionId` and `conversationId` — session creation deferred
- Enriched job payload includes all standard fields plus 7 orchestration metadata fields
- Idempotency and safety checks reuse 07C1 methods — no re-validation needed

### 7. AiExecutionJob Extension Decision

- All 5 fields needed: `parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution`
- All optional — backward compatible
- Single file change: `services/ai-service/src/queue/job.types.ts`

### 8. QueueService Decision

- No new method needed — `enqueueExecution(jobData: any)` already accepts any payload
- No code change to `QueueService`
- BullMQ priority deferred

### 9. Cancel Cascade Decision

- 07C2 implements `cancelReferral()` and `cancelCollaboration()` in `OrchestrationService`
- Wraps existing `ExecutionResultService.requestCancel()` with orchestration-level logic
- Uses private `referralExecutionMap: Map<ReferralId, string>` to track execution IDs (avoids modifying 07A contract)
- Ownership checks enforce `userId` match

### 10. Persistence Recommendation

- **In-memory store + JSONB metadata on usage_records. No database migration.**
- 4 in-memory stores: `collaborationRunStore`, `referralStore`, `idempotencyStore`, `referralExecutionMap`
- JSONB provides audit trail; dedicated tables deferred

### 11. Exact Step 3 Implementation Boundary

- **Production files:** 4 (`orchestration.service.ts`, `orchestration.module.ts`, `job.types.ts`, `worker.processor.ts`)
- **Test files:** 2 (`orchestration.service.spec.ts`, `worker.processor.builder-config.spec.ts`)
- **New methods:** 3 (`startReferralExecution`, `cancelReferral`, `cancelCollaboration`)
- **New interfaces:** 3 input types
- **New private store:** 1 (`referralExecutionMap`)
- **No controller changes, no DB migration, no runtime canary**

### 12. Split Decision

**A — Proceed with one bounded Step 3 implementation.** Cancel risk is LOW–MEDIUM; methods are tightly coupled lifecycle; total change ~200 lines production + ~250 lines tests.

### 13. Test Plan

- 11 OrchestrationService tests (enqueue, cancel, cascade, ownership, backward compat)
- 6 worker/type tests (5 new fields + metadata preservation)
- All 13 existing tests must continue to pass
- No browser smoke, no runtime canary

### 14. Risks/Blockers

- Queue behavior: LOW
- Cancel ownership: MEDIUM (mitigated by userId check)
- Metadata compatibility: LOW
- Worker contract: VERY LOW
- Migration: N/A
- Runtime canary: MEDIUM (deferred to 07E)
- Module wiring: LOW

### 15. Confirmation: No Source/Governance/Env Files Changed

**CONFIRMED.** Only `docs/AGENT-PLATFORM-07C2-IMPLEMENTATION-READINESS-REVIEW.md` created. No files under `services/`, `frontend/`, `database/`, `.env*`, `docker*`, `package*`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, or `docs/AINOW-EXECUTION-ROADMAP.md` were changed.

### 16. Confirmation: No Tests/Builds/Runtime/Provider Calls

**CONFIRMED.** No tests executed. No builds executed. No Docker/Postgres/Redis/API Gateway/container-manager/AI Service started. No BullMQ jobs submitted. No browser smoke. No provider/API calls. No git commits/pushes.

### 17. Whether AGENT-PLATFORM-07C2 Is Ready for Step 3

**YES — AGENT-PLATFORM-07C2 is ready for Step 3 implementation.**

No additional Keith approval needed. Implementation can proceed with the 4-step loop (Step 3 = implementation, Step 4 = consolidation/checkpoint).

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-07C2 Step 2 — Implementation Readiness / Exact Source-Path Review
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
