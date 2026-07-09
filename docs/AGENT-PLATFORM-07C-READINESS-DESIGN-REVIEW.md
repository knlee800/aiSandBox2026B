# AGENT-PLATFORM-07C — Readiness / Design Review

**Task ID:** AGENT-PLATFORM-07C
**Step:** 2 — Readiness / Design Review
**Status:** Step 2 COMPLETE
**Date:** 2026-07-09
**Nature:** Static read-only design review — no implementation, no runtime execution
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07C ACTIVE | **PASS** — registered in TASKS.md and TASKS_BACKLOG_FULL.md; Step 1 COMPLETE (Registration 2026-07-09); HIGH risk — 4-step loop; Keith approval recorded 2026-07-09 |
| AGENT-PLATFORM-07B COMPLETE and LOCKED | **PASS** — 2026-07-09; API Gateway Orchestration Module Skeleton; `OrchestrationModule` + `OrchestrationService` skeleton; Jest PASS (1 suite, 3 tests); TypeScript clean |
| AGENT-PLATFORM-07A COMPLETE and LOCKED | **PASS** — 2026-07-09; Coordinator Contracts / Schema; `orchestration.contracts.ts` created; TypeScript clean |
| AGENT-PLATFORM-07 COMPLETE and LOCKED | **PASS** — 2026-07-09; Read-Only Orchestration Coordinator Planning; 22-section coordinator plan; source-path review |
| AGENT-PLATFORM-06 COMPLETE and LOCKED | **PASS** — 2026-07-09; Upstream Identity Propagation; 8 files changed; 34 suites / 654 passed |
| AGENT-PLATFORM-05 COMPLETE and LOCKED | **PASS** — 2026-07-09; Multi-Builder Runtime Orchestration Plan; 19-section plan |
| AGENT-PLATFORM-04 COMPLETE and LOCKED | **PASS** — 2026-07-07; Multi-Builder Runtime Topology Plan |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **PASS** — 2026-07-07; Per-Builder Harness Config Adapter; all 3 child slices |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **PASS** — 2026-07-09; Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary; PASS |
| One-active-task rule satisfied | **PASS** — only AGENT-PLATFORM-07C is ACTIVE |

**Governance readiness: PASS — all 10 criteria satisfied.**

---

## 2. Foundation Summary

### 2.1 AGENT-PLATFORM-07 Plan Decisions (COMPLETE and LOCKED 2026-07-09)

22-section coordinator plan establishing:

| Decision | Choice |
|----------|--------|
| Coordinator boundary | Separate `orchestration/` module within API Gateway |
| Initial orchestration mode | Read-only — no shared workspace writes |
| Queue routing | Single `ai-execution` BullMQ queue with metadata routing |
| Session isolation | 1 builder = 1 session = 1 container |
| Write canary | Separate track — NOT part of AGENT-PLATFORM-07 |
| Persistence model | In-memory first, JSONB metadata for audit, tables later |
| Referral model | Async referral with explicit approval gates |
| Safety limits | Max depth 3, max agents 4, loop prevention, idempotency |

### 2.2 AGENT-PLATFORM-07A Contracts/Schema (COMPLETE and LOCKED 2026-07-09)

`services/api-gateway/src/orchestration/orchestration.contracts.ts` created with:

- 10 ID type aliases (`CollaborationRunId`, `ReferralTraceId`, `ReferralId`, etc.)
- `CollaborationAgentIdentity`, `SourceBuilderIdentity`, `TargetBuilderIdentity`
- Status unions: `CollaborationRunStatus`, `ReferralStatus`, `ReferralResultStatus`, `ReferralCancelStatus`, `OrchestrationMode`
- Safety constants: `DEFAULT_MAX_REFERRAL_DEPTH` (3), `DEFAULT_MAX_AGENTS_PER_COLLABORATION` (4), `READ_ONLY_ALLOWED_TOOL_IDS`, `READ_ONLY_BLOCKED_TOOL_IDS`
- Core interfaces: `ReferralConstraints`, `CollaborationRun`, `CollaborationReferral`, `ReferralResult`, `OrchestrationAuditEvent`, `ReadOnlyContextSnapshot`, `ReferralCreateRequest`, `OrchestrationJobMetadata`

### 2.3 AGENT-PLATFORM-07B Module Skeleton (COMPLETE and LOCKED 2026-07-09)

- `OrchestrationModule` — NestJS module; `OrchestrationService` registered and exported; no controllers; no queue wiring
- `OrchestrationService` — two deterministic read-only methods: `getDefaultReferralConstraints()`, `getReadOnlyPolicy()`
- `AppModule` updated with `OrchestrationModule` import
- Jest PASS (1 suite, 3 tests); TypeScript clean

### 2.4 AGENT-PLATFORM-06 Identity Propagation (COMPLETE and LOCKED 2026-07-09)

- `agentRole`, `builderProfileId` — full path: `AIExecutionRequest` → controller → usage intent `metadata` JSONB → BullMQ job → worker `nextMetadata` finalization
- `collaborationRunId`, `referralTraceId` — type-level placeholders: `AIExecutionRequest` → controller → BullMQ job → `AiExecutionJob` type; NOT stored in usage records; always `undefined` today
- All four identity fields are optional; backward compatible

### 2.5 AGENT-HARNESS-06E Read-Only E2E Path (COMPLETE and LOCKED 2026-07-09)

- Full E2E tool dispatch validated: Worker → ToolDispatcher → file-tool-handlers → ApiGatewayHttpClient → API Gateway → container-manager → Docker container filesystem
- `list_files` SUCCESS; `read_file` SUCCESS; `test-harness-stub` provider; zero billing; 718ms

---

## 3. Current Source-Path Findings

### 3.1 OrchestrationService Current Methods

**File:** `services/api-gateway/src/orchestration/orchestration.service.ts`

| Method | Behavior | Status |
|--------|----------|--------|
| `getDefaultReferralConstraints()` | Returns frozen copy of default `ReferralConstraints` (timeoutMs: 300000, maxDepth: 3, maxAgents: 4, readOnly: true, allowWriteTools: false) | Implemented (07B) |
| `getReadOnlyPolicy()` | Returns `ReadOnlyPolicy` object (read_only mode, blocked/allowed tool lists) | Implemented (07B) |
| `createCollaborationRun()` | Not implemented | **NEEDED** |
| `createReferral()` | Not implemented | **NEEDED** |
| `validateReferral()` | Not implemented | **NEEDED** |
| `startReferralExecution()` | Not implemented | **NEEDED** |
| `completeReferral()` | Not implemented | **NEEDED** |
| `cancelReferral()` | Not implemented | **NEEDED** |
| `cancelCollaboration()` | Not implemented | **NEEDED** |
| `getCollaborationRun()` | Not implemented | **NEEDED** |
| `getReferral()` | Not implemented | **NEEDED** |

### 3.2 Contracts Available

All required TypeScript contracts are already defined in `orchestration.contracts.ts` (07A):

| Contract | Status |
|----------|--------|
| `CollaborationRun` | DEFINED |
| `CollaborationReferral` | DEFINED |
| `ReferralResult` | DEFINED |
| `ReferralConstraints` | DEFINED |
| `ReferralCreateRequest` | DEFINED |
| `OrchestrationJobMetadata` | DEFINED |
| `OrchestrationAuditEvent` | DEFINED |
| `ReadOnlyContextSnapshot` | DEFINED |
| All status unions | DEFINED |
| All ID type aliases | DEFINED |

### 3.3 QueueService Enqueue/Cancel Behavior

**File:** `services/api-gateway/src/queue/queue.service.ts`

| Aspect | Current State |
|--------|--------------|
| `enqueueExecution(jobData: any)` | Adds `execute-ai` job to `ai-execution` BullMQ queue; `attempts: 1`, `removeOnComplete: true`, `removeOnFail: false` |
| Cancel method | **NONE on QueueService** — QueueService has NO cancel method |
| `obliterate()` | **NOT PRESENT** — no obliterate call anywhere in the codebase (confirmed via grep) |
| Job payload type | `any` — no typed constraint on enqueue side |
| Queue name | `ai-execution` |
| Job name | `execute-ai` |

**Critical correction to AGENT-PLATFORM-07 source-path review:** The earlier review (§4.2, §5.4, §7.4, §12.1) stated that `QueueService.cancelExecution(sessionId)` calls `this.queue.obliterate({ force: true })`. **This is incorrect.** No `cancelExecution` method exists on `QueueService` and no `obliterate()` call exists anywhere in the codebase. The cancel mechanism is entirely ledger-based (see §3.4 below).

### 3.4 Execution Controller/Service Cancel Path

**Cancel endpoint:** `POST /api/ai/executions/:executionId/cancel`

**Flow:**
1. `AIExecutionController.cancelExecution(executionId)` — guarded by `SessionOrApiKeyAuthGuard`
2. Calls `ExecutionResultService.requestCancel(executionId)`
3. `requestCancel()` executes: `UPDATE usage_records SET execution_status = 'cancel_requested' WHERE execution_id = $1 AND execution_status = 'running'`
4. Returns `true` if update succeeded; controller returns 409 Conflict if not

**Worker cancel detection:**
1. Worker polls `usage_records` every ~1000ms for `cancel_requested` status
2. When detected, worker calls `abortController.abort()` to terminate execution
3. Worker then sets `execution_status = 'cancelled'`

**This is a per-execution cancel mechanism** — targets a specific `executionId`, not a session or queue-wide. This is compatible with multi-builder orchestration.

### 3.5 Worker Job Consumption Path

**File:** `services/ai-service/src/worker/worker.processor.ts`

| Aspect | Current State |
|--------|--------------|
| Queue consumed | `ai-execution` |
| Job claim | Atomically updates `usage_records` from `pending` → `running` |
| Identity usage | Reads `agentRole`, `builderProfileId` from `job.data`; passes to `resolveBuilderHarnessConfig()` |
| Harness gate | `job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` |
| Cancel mechanism | `AbortController` + periodic polling of `usage_records.execution_status` |
| Finalization | Merges `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` into `nextMetadata` JSONB |
| Missing new fields | `parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution` — NOT read from `job.data` |

### 3.6 Metadata/Usage Persistence Path

| Location | `agentRole`/`builderProfileId` | `collaborationRunId`/`referralTraceId` |
|----------|-------------------------------|---------------------------------------|
| Usage intent write | Stored in `metadata` JSONB | **NOT stored** |
| Worker finalization | Preserved in `nextMetadata` | Conditionally preserved in `nextMetadata` (AGENT-PLATFORM-06) |
| `CreditDeductionEvent` | **ABSENT** | **ABSENT** |
| `CreditDeductionRecord.agentId` | Column exists, never populated | N/A |

---

## 4. Cancel Redesign Analysis

### 4.1 Current Cancel Behavior

**The cancel mechanism is already per-execution.** This is a significant correction to the risk assessment from AGENT-PLATFORM-07.

| Aspect | Current Implementation |
|--------|----------------------|
| Cancel target | Per-`executionId` — updates one specific row in `usage_records` |
| Cancel mechanism | Ledger-based: `execution_status = 'cancel_requested'` on `usage_records` |
| Worker detection | Polls `usage_records` every ~1000ms; aborts via `AbortController` |
| Queue impact | **NONE** — cancel does not touch BullMQ queue at all |
| Other executions | **UNAFFECTED** — only the targeted `executionId` is cancelled |

### 4.2 Whether Obliterate/All-Job Cancellation Exists

**NO.** There is no `obliterate()` call, no `cancelExecution()` on `QueueService`, and no queue-wide cancel mechanism anywhere in the codebase. The AGENT-PLATFORM-07 source-path review's claim about obliterate was incorrect — this was likely based on a stale version of the code or an extrapolation from the cancel design discussion.

### 4.3 Per-Execution/Per-Referral Cancellation Needs

Since the existing cancel is already per-execution, the extensions needed are:

| Need | Implementation Approach | Complexity |
|------|------------------------|------------|
| Per-execution cancel | **ALREADY WORKS** — `ExecutionResultService.requestCancel(executionId)` | None |
| Per-referral cancel | Look up `executionId` from referral record → call existing `requestCancel()` | Low |
| Per-collaboration cancel (cascade) | Look up all referral `executionId`s for `collaborationRunId` → call `requestCancel()` for each | Low–Medium |
| Cancel status on referral object | Update `CollaborationReferral.cancelStatus` in in-memory store | Low |
| Cancel status on collaboration run | Update `CollaborationRun.status` to `cancelled` in in-memory store | Low |

### 4.4 Ownership Checks Required

| Check | Current State | 07C Need |
|-------|--------------|----------|
| `userId` matches project/collaboration owner | Cancel endpoint uses `SessionOrApiKeyAuthGuard` (auth only, no ownership check on specific execution) | Must verify `userId` owns the collaboration before allowing cancel |
| Inter-service cancel | Not applicable currently | Coordinator cancels referred jobs on behalf of the owning user |
| Worker self-cancel | Worker can detect failure and abort | No change needed |

### 4.5 In-Progress Job Cancel Flag Needs

The existing mechanism (polling `usage_records.execution_status`) already serves as a cancel flag for in-progress jobs. **No new cancel flag mechanism is needed.** The worker already checks for `cancel_requested` via periodic polling and aborts via `AbortController`.

For referral-aware cancel:
1. Coordinator calls `ExecutionResultService.requestCancel(executionId)` for the referral's execution
2. Worker's existing poll detects `cancel_requested` and aborts
3. Coordinator updates referral status to `cancelled` in in-memory store

### 4.6 Worker Polling Implications

- Worker already polls `usage_records` every ~1000ms for cancel status
- No additional polling mechanism needed for referral cancel
- Worker does NOT need to be aware of referrals/collaborations for cancel to work — cancel is at execution level
- Worker finalization already preserves `collaborationRunId`/`referralTraceId` in metadata (AGENT-PLATFORM-06)

### 4.7 Timeout Behavior

| Timer | Implementation Approach | Where |
|-------|------------------------|-------|
| Per-referral timeout (300s default) | `setTimeout()` in `OrchestrationService` when referral starts; on timeout, call `requestCancel()` for the referral's `executionId` | OrchestrationService |
| Collaboration-level timeout (1800s) | `setTimeout()` in `OrchestrationService` when collaboration starts; on timeout, cascade cancel all referral executions | OrchestrationService |
| Worker execution timeout | Already implemented via `EXECUTION_TIMEOUT_MS` + `AbortController` in `WorkerProcessor` | Worker — no change |

### 4.8 Cancel Redesign Risk Assessment — REVISED

| Original Risk (07 Review) | Revised Assessment |
|---------------------------|-------------------|
| HIGH — obliterate destroys all jobs | **NOT APPLICABLE** — obliterate does not exist |
| Cancel redesign is a prerequisite blocker | **DOWNGRADED to LOW–MEDIUM** — existing per-execution cancel is compatible; only need cascade logic |
| Worker needs new abort mechanism | **NOT NEEDED** — existing `AbortController` + poll is sufficient |
| QueueService needs redesign | **NOT NEEDED** — QueueService is not involved in cancel |

**Cancel redesign risk: LOW–MEDIUM (downgraded from HIGH).** The existing per-execution cancel mechanism is compatible with multi-builder orchestration. Only cascade logic (per-collaboration cancel) needs to be added in `OrchestrationService`.

---

## 5. Referral Enqueue Flow Design

### 5.1 Read-Only Referral Create Path

1. Builder A's harness (during execution) determines a subtask should be referred to Builder B
2. Worker emits referral request to coordinator (mechanism TBD — HTTP callback or internal method)
3. `OrchestrationService.createCollaborationRun()` — generates `collaborationRunId` if first referral
4. `OrchestrationService.validateReferral()` — depth, loop, agent count, idempotency checks
5. `OrchestrationService.createReferral()` — generates `referralTraceId`, stores in-memory referral record
6. `OrchestrationService.startReferralExecution()`:
   a. Creates Builder B session via `SessionService` (new session, same `projectId`)
   b. Builds job payload with orchestration metadata
   c. Calls `QueueService.enqueueExecution()` with enriched job payload
7. Worker picks up Builder B's job; resolves per-builder config; executes with read-only tools

### 5.2 collaborationRunId/referralTraceId Lifecycle

| Field | Generation | Immutability | Propagation |
|-------|-----------|-------------|-------------|
| `collaborationRunId` | Generated once by `OrchestrationService.createCollaborationRun()` when first multi-builder referral is created | Immutable once generated | ALL related jobs in the collaboration carry this ID |
| `referralTraceId` | Generated per referral step by `OrchestrationService.createReferral()` | Immutable per referral | Specific to one referral step |

### 5.3 referralId/parentReferralTraceId Lifecycle

| Field | Generation | Purpose |
|-------|-----------|---------|
| `referralId` | UUID generated at referral creation | Unique identifier for the referral record |
| `parentReferralTraceId` | Copied from the referring builder's `referralTraceId`; `null` for first referral | Links referral chain for depth calculation and loop detection |

### 5.4 Source/Target Builder Identity

| Field | Builder A (source) | Builder B (target) |
|-------|-------------------|-------------------|
| `builderProfileId` | `'builder-default'` | Target builder profile (e.g., `'builder-fullstack'`) |
| `agentRole` | `'builder'` | `'builder'` |
| `collaborationRunId` | Shared UUID | Same shared UUID |
| `referralTraceId` | Source referral step UUID | Child referral step UUID |
| `isReferralExecution` | `false` (initiator) | `true` (referred) |
| `referringBuilderProfileId` | `null` | Source's `builderProfileId` |

### 5.5 Queue Job Metadata

The job payload for Builder B's execution includes all existing fields plus new orchestration metadata spread from `OrchestrationJobMetadata`:

```typescript
{
  // Existing fields...
  executionId, userId, sessionId, conversationId, provider, adapter,
  prompt, workspaceContext, model, harnessVersion,
  agentRole, builderProfileId,
  // New orchestration fields:
  collaborationRunId,
  referralTraceId,
  parentReferralTraceId,
  referringBuilderProfileId,
  orchestrationPriority,
  referralId,
  isReferralExecution: true,
}
```

### 5.6 Builder A/B Distinction

Builder A and Builder B jobs use the same `ai-execution` BullMQ queue and same `WorkerProcessor`. They are distinguished by:
- `builderProfileId` — different profiles → different harness config via `resolveBuilderHarnessConfig()`
- `isReferralExecution: true` — marks Builder B's job as a referral execution
- `referralId` / `referralTraceId` — links to the specific referral record
- `collaborationRunId` — groups all jobs in the same collaboration

### 5.7 Idempotency and Loop Prevention

| Safety Mechanism | Implementation |
|-----------------|----------------|
| Idempotency key | `collaborationRunId` + source `builderProfileId` + target `builderProfileId` + SHA-256(`taskDescription`) |
| Duplicate detection | Check in-memory store; if key exists and referral is `in_progress`/`completed` → reject |
| Retry after failure | If key exists and referral is `failed`/`cancelled` → allow retry with new `referralTraceId` |
| Loop prevention | `visitedBuilderProfileIds` array maintained in referral chain; if target already visited → reject |
| Depth enforcement | `depth` tracked per referral; if `depth >= maxDepth` → reject |
| Agent count enforcement | `activeBuilderProfileIds` tracked per collaboration; if count >= `maxAgentsPerCollaboration` → reject |

---

## 6. Persistence Decision

### 6.1 Whether AGENT-PLATFORM-07C Needs DB Migration

**NO.** AGENT-PLATFORM-07C should NOT introduce a database migration.

| Reason | Detail |
|--------|--------|
| Premature schema commitment | Collaboration/referral table schemas should stabilize before migration |
| Complexity risk | Migration adds deployment complexity to an already HIGH risk task |
| In-memory is sufficient for initial read-only orchestration | Collaborations are transient; restart clears state (acceptable for first slice) |
| JSONB metadata provides audit trail | `collaborationRunId`/`referralTraceId` already flow to usage record metadata via worker finalization |

### 6.2 Whether Metadata JSONB Is Enough for First Slice

**YES.** The existing `usage_records.metadata` JSONB column is sufficient for the first slice:

- `collaborationRunId` and `referralTraceId` already preserved in worker finalization metadata (AGENT-PLATFORM-06)
- New fields (`parentReferralTraceId`, `referringBuilderProfileId`, `referralId`, `isReferralExecution`) can be added to the same JSONB without migration
- Audit trail is queryable via JSON operators if needed

### 6.3 Whether In-Memory Is Acceptable for First Implementation

**YES, with documented limitations.**

| Aspect | Assessment |
|--------|-----------|
| `CollaborationRun` objects | In-memory `Map<CollaborationRunId, CollaborationRun>` in `OrchestrationService` |
| `CollaborationReferral` objects | In-memory `Map<ReferralId, CollaborationReferral>` in `OrchestrationService` |
| Idempotency tracking | In-memory `Map<IdempotencyKey, ReferralId>` |
| Durability | Volatile — lost on API Gateway restart |
| Restart impact | Active collaborations lost; new collaborations can be started; no data corruption risk |
| Scalability | Single-process only; sufficient for initial controlled orchestration |

### 6.4 Risks of Each Option

| Option | Risk |
|--------|------|
| In-memory only | Data lost on restart; single-process limit; no SQL reporting |
| JSONB metadata only | Not queryable for collaboration-level aggregation; denormalized |
| Dedicated DB tables | Premature schema; migration complexity; schema changes hard to reverse |

### 6.5 Recommended Boundary

**In-memory store for collaboration/referral lifecycle + JSONB metadata on usage records for audit trail.** No database migration. Dedicated tables deferred to future slice after coordinator behavior stabilizes.

---

## 7. Safety Limits

### 7.1 Max Referral Depth: 3

- Constant: `DEFAULT_MAX_REFERRAL_DEPTH = 3` (already in `orchestration.contracts.ts`)
- Enforcement: `OrchestrationService.validateReferral()` rejects when `depth >= maxDepth`
- Chain: `visitedBuilderProfileIds` array tracks depth; `parentReferralTraceId` links chain

### 7.2 Max Agents: 4

- Constant: `DEFAULT_MAX_AGENTS_PER_COLLABORATION = 4` (already in `orchestration.contracts.ts`)
- Enforcement: reject when `activeBuilderProfileIds.length >= maxAgentsPerCollaboration`

### 7.3 Duplicate Referral Idempotency

- Key: `collaborationRunId` + source `builderProfileId` + target `builderProfileId` + SHA-256(`taskDescription`)
- In-progress/completed → reject duplicate, return existing referral reference
- Failed/cancelled → allow retry with new `referralTraceId`

### 7.4 Loop Prevention

- `visitedBuilderProfileIds` maintained per referral chain
- Target already in chain → reject referral, log warning, emit `orchestration.referral_rejected` event
- Examples: A→B→C valid; A→B→A invalid; A→B→C→A invalid

### 7.5 Read-Only Enforcement

- `READ_ONLY_ALLOWED_TOOL_IDS`: `['list_files', 'read_file']`
- `READ_ONLY_BLOCKED_TOOL_IDS`: `['write_file', 'delete_file', 'run_validation']`
- `readOnly: true`, `allowWriteTools: false` in all referral constraints
- Enforced by `resolveBuilderHarnessConfig()` platform safety enforcement (AGENT-HARNESS-07)

### 7.6 No Write Tools

- `write_file`, `delete_file`, `run_validation` remain disabled
- Write canary is a separate track — NOT part of AGENT-PLATFORM-07

---

## 8. Exact Step 3 Implementation Boundary

### 8.1 Exact Files Likely to Change

| # | File | Change Type | Change Scope |
|---|------|-------------|-------------|
| 1 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Modified | Add `createCollaborationRun()`, `createReferral()`, `validateReferral()`, `startReferralExecution()`, `completeReferral()`, `cancelReferral()`, `cancelCollaboration()`, `getCollaborationRun()`, `getReferral()`, `getReferralChain()`; add in-memory stores |
| 2 | `services/api-gateway/src/orchestration/orchestration.module.ts` | Modified | Import `QueueModule` / inject `QueueService` if needed for enqueue |
| 3 | `services/ai-service/src/queue/job.types.ts` | Modified | Add `parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution` to `AiExecutionJob` |
| 4 | `services/ai-service/src/worker/worker.processor.ts` | Modified | Read new orchestration fields from `job.data`; include in `nextMetadata` finalization |
| 5 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | Modified | Add tests for new methods |

### 8.2 Exact Tests Likely to Add/Update

| # | Test File | Test Scope |
|---|-----------|------------|
| 1 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | `createCollaborationRun()`, `createReferral()`, `validateReferral()` (depth, loop, idempotency), `cancelReferral()`, `cancelCollaboration()`, `getCollaborationRun()`, `getReferral()` |
| 2 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | New orchestration fields preserved in finalization metadata |
| 3 | Possibly new: `services/api-gateway/src/orchestration/__tests__/orchestration.validation.spec.ts` | Dedicated safety limit validation tests (depth, loop, agent count, idempotency) |

### 8.3 Whether AppModule or Existing Module Wiring Changes Are Needed

**Likely minimal.** `OrchestrationModule` is already imported in `AppModule` (07B). If `OrchestrationService` needs `QueueService` for enqueue, then `OrchestrationModule` must import `QueueModule` or have `QueueService` injected. This is a module-level import change, not an `AppModule` change.

**Decision:** For the first implementation, `OrchestrationService` will NOT directly call `QueueService.enqueueExecution()`. Instead, it will prepare the enriched job payload and expose it via a method. The actual enqueue trigger will come from whatever mechanism triggers the referral (controller endpoint, internal caller, or future worker callback). This keeps the orchestration module decoupled from the queue module initially.

**If direct enqueue is needed:** `OrchestrationModule` imports `QueueModule` (or receives `QueueService` via constructor injection). No `AppModule` change needed because `QueueModule` already exports `QueueService`.

### 8.4 Whether Database Migration Is Needed

**NO.** No database migration. In-memory store + JSONB metadata.

### 8.5 Whether AI Service Worker Change Is Needed

**YES — minimal.** The worker needs to:
1. Read new orchestration fields from `job.data` (`parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution`)
2. Preserve them in `nextMetadata` during finalization (same pattern as existing `collaborationRunId`/`referralTraceId`)

This is a small, backward-compatible change following the exact pattern established by AGENT-PLATFORM-06.

### 8.6 Whether QueueService Change Is Needed

**NO.** `QueueService.enqueueExecution(jobData: any)` already accepts any payload. The new orchestration fields are just additional properties on the job payload object. No `QueueService` code change needed.

### 8.7 Whether OrchestrationService Change Is Enough

**Almost.** OrchestrationService is the primary change target. The only other production changes needed are:
- `AiExecutionJob` type extension (ai-service, 5 new optional fields)
- Worker finalization metadata extension (ai-service, ~5 lines)

---

## 9. Split Decision

### 9.1 Risk Re-Assessment

The original risk assessment (HIGH — cancel redesign required, obliterate incompatible) has been **downgraded** based on source-code review findings:

| Risk Factor | Original Assessment | Revised Assessment |
|-------------|--------------------|--------------------|
| Cancel redesign | HIGH — obliterate destroys all jobs | **LOW** — obliterate does not exist; per-execution cancel already works |
| QueueService redesign | Required | **NOT REQUIRED** — QueueService has no cancel method to redesign |
| Worker abort mechanism | Needs new mechanism | **ALREADY EXISTS** — `AbortController` + poll |
| OrchestrationService complexity | HIGH | **MEDIUM** — mostly in-memory CRUD + validation logic |
| AiExecutionJob extension | LOW | **LOW** — 5 new optional fields; backward compatible |
| Worker finalization extension | LOW | **LOW** — ~5 lines; same pattern as AGENT-PLATFORM-06 |

### 9.2 Decision: Split into Child Slices

**Decision: B — Split into child slices.**

Despite the reduced cancel risk, AGENT-PLATFORM-07C still introduces:
- 9+ new methods on `OrchestrationService`
- In-memory state management (3 Maps)
- Safety limit enforcement logic (4 types of validation)
- Type extension across two services
- Substantial test surface

Per CLAUDE.md governance: "Always prefer smaller bounded child slices over large mixed changes." A single implementation step for all of this would be too large for a HIGH risk task.

### 9.3 Recommended Child Slices (Not Registered)

**AGENT-PLATFORM-07C1 — Orchestration Core Methods + In-Memory Store**

| Field | Value |
|-------|-------|
| Nature | Implementation — Medium risk |
| Scope | `OrchestrationService` core methods: `createCollaborationRun()`, `createReferral()`, `validateReferral()`, `getCollaborationRun()`, `getReferral()`, `getReferralChain()`; in-memory `Map` stores for collaborations, referrals, and idempotency keys; safety limit enforcement (depth, loop, agent count, idempotency); no enqueue, no cancel, no worker changes |
| Files changed | `orchestration.service.ts`, `orchestration.service.spec.ts` |
| Tests | Unit tests for all validation logic, CRUD operations, safety limits |
| Risk | Medium — substantial new logic but self-contained within `OrchestrationService`; no cross-service changes |

**AGENT-PLATFORM-07C2 — Referral Enqueue + Cancel + AiExecutionJob Extension**

| Field | Value |
|-------|-------|
| Nature | Implementation — Medium risk |
| Scope | `OrchestrationService.startReferralExecution()` (builds enriched job payload, calls `QueueService.enqueueExecution()`), `completeReferral()`, `failReferral()`, `cancelReferral()`, `cancelCollaboration()` (cascade cancel via `ExecutionResultService.requestCancel()`); `AiExecutionJob` type extended with 5 new fields; worker finalization extended to preserve new fields; `OrchestrationModule` wiring update if needed |
| Files changed | `orchestration.service.ts`, `orchestration.module.ts`, `job.types.ts`, `worker.processor.ts`, test files |
| Tests | Enqueue tests, cancel tests, cascade cancel tests, worker finalization tests |
| Risk | Medium — cross-service type changes + enqueue/cancel integration; existing patterns reduce risk |

**AGENT-PLATFORM-07C3 — Targeted Tests and Consolidation**

| Field | Value |
|-------|-------|
| Nature | Validation + governance — Low risk |
| Scope | Additional integration-style tests (if needed); backward compatibility verification; consolidation checkpoint; TASKS.md/TASKS_BACKLOG_FULL.md/AINOW-EXECUTION-ROADMAP.md updates |
| Files changed | Test files, governance docs only |
| Tests | Backward compatibility tests (single-builder unaffected); safety limit edge case tests |
| Risk | Low — validation and governance only |

### 9.4 Why 3 Slices, Not 4

The original task description suggested 4 possible child slices (07C1–07C4). Based on the reduced cancel risk, the cancel redesign (originally 07C2) can be combined with the enqueue flow (originally 07C3) because:
- Cancel is already per-execution — only cascade logic is new
- Cascade cancel is 2–3 methods that naturally belong with the enqueue/complete/fail lifecycle
- Separating cancel from enqueue would create an artificially incomplete lifecycle

---

## 10. Test Plan

### 10.1 Unit Tests (07C1)

| Test | Scope |
|------|-------|
| `createCollaborationRun()` returns valid `CollaborationRun` with generated `collaborationRunId` | OrchestrationService |
| `createReferral()` returns valid `CollaborationReferral` with generated `referralTraceId`, `referralId` | OrchestrationService |
| `validateReferral()` rejects when depth >= maxDepth | OrchestrationService |
| `validateReferral()` rejects when target in `visitedBuilderProfileIds` (loop) | OrchestrationService |
| `validateReferral()` rejects when agent count >= maxAgentsPerCollaboration | OrchestrationService |
| `validateReferral()` rejects duplicate idempotency key for in-progress/completed referral | OrchestrationService |
| `validateReferral()` allows retry for failed/cancelled referral with same idempotency key | OrchestrationService |
| `getCollaborationRun()` returns stored run | OrchestrationService |
| `getReferral()` returns stored referral | OrchestrationService |
| `getReferralChain()` returns ordered chain | OrchestrationService |

### 10.2 Service Tests (07C2)

| Test | Scope |
|------|-------|
| `startReferralExecution()` builds enriched job payload with all orchestration metadata fields | OrchestrationService |
| `completeReferral()` updates referral status and stores result | OrchestrationService |
| `failReferral()` updates referral status | OrchestrationService |
| `cancelReferral()` calls existing `requestCancel()` for referral's execution | OrchestrationService |
| `cancelCollaboration()` cascade-cancels all active referral executions | OrchestrationService |

### 10.3 Queue/Cancel Tests (07C2)

| Test | Scope |
|------|-------|
| Per-referral cancel correctly targets specific `executionId` | OrchestrationService + ExecutionResultService mock |
| Per-collaboration cascade cancel targets all active referral `executionId`s | OrchestrationService |
| Cancel does not affect unrelated executions | OrchestrationService |

### 10.4 Worker Tests (07C2)

| Test | Scope |
|------|-------|
| New orchestration fields (`parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution`) preserved in worker finalization metadata | WorkerProcessor |
| Existing identity fields still preserved when new fields absent (backward compat) | WorkerProcessor |

### 10.5 Backward Compatibility Tests (07C3)

| Test | Scope |
|------|-------|
| Single-builder execution (no orchestration fields) unaffected | WorkerProcessor |
| `AiExecutionJob` without new fields processes normally | WorkerProcessor |
| `OrchestrationService` existing methods (`getDefaultReferralConstraints`, `getReadOnlyPolicy`) unchanged | OrchestrationService |

### 10.6 No Browser Smoke

No browser smoke tests. No frontend UI changes. No runtime canary in this task.

---

## 11. Risks/Blockers

### 11.1 Cancel Correctness

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cascade cancel races with execution completion | LOW | Check execution status before cancel; `cancel_requested` only applies to `running` status |
| Cancel after referral already completed | LOW | `requestCancel()` returns `false` for non-running executions; coordinator handles gracefully |
| Orphaned referral state (cancel succeeds but in-memory not updated) | LOW | Update in-memory store first, then cancel execution; if cancel fails, referral state already reflects intent |

### 11.2 Ownership Checks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cross-user collaboration access | MEDIUM | All orchestration methods must verify `userId` matches collaboration owner |
| Inter-service authentication for cancel | LOW | `ExecutionResultService.requestCancel()` is an internal service call, not HTTP — no auth needed within same process |

### 11.3 DB Migration Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| No migration needed | N/A | In-memory store + JSONB metadata — no migration |
| Future migration when tables are needed | LOW | Deferred to separate future task with stable schema |

### 11.4 Queue Behavior Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| QueueService accepts `any` payload | LOW | Existing behavior; new fields are just additional properties |
| BullMQ job priority not used | LOW | `orchestrationPriority` is a placeholder for future use; no priority queue behavior initially |

### 11.5 Worker Cancellation Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Worker does not immediately detect cancel | LOW | 1-second poll interval is acceptable; worker aborts at next poll |
| Worker continues execution after cancel request | LOW | Existing behavior with `AbortController` handles this; execution aborts at provider API call boundary |

### 11.6 Runtime Canary Needs Later

| Risk | Severity | Mitigation |
|------|----------|------------|
| No runtime validation in 07C | MEDIUM | AGENT-PLATFORM-07E (Read-Only Coordinator Canary) planned as future task |
| In-memory store not validated under load | LOW | First slice is controlled/low-volume |

---

## 12. UX/UI Constraints

### 12.1 No UI Expected

AGENT-PLATFORM-07C is backend-only. No user-facing UI is created or modified.

### 12.2 Future UI Text Requirements

If future implementation adds UI text for orchestration:

- Update `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
- Update `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
- Update `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`)
- Do NOT add hardcoded English UI copy
- Icons: **Heroicons v2 Outline only**
- Impeccable / Emil Kowalski skills are **advisory only**

---

## 13. Step 3 Readiness Conclusion

### 13.1 Ready/Not Ready

**READY — AGENT-PLATFORM-07C is ready for Step 3 implementation.**

All prerequisites are satisfied. The cancel redesign risk has been significantly downgraded. The implementation boundary is well-defined. Child slices are recommended for governance safety.

### 13.2 Recommended Implementation Model

**Split into 3 child slices (07C1, 07C2, 07C3) — not registered.**

| # | Slice | Risk | Step Loop |
|---|-------|------|-----------|
| 1 | AGENT-PLATFORM-07C1 — Orchestration Core Methods + In-Memory Store | Medium | 3-step loop (registration, implementation, consolidation) |
| 2 | AGENT-PLATFORM-07C2 — Referral Enqueue + Cancel + AiExecutionJob Extension | Medium | 3-step loop |
| 3 | AGENT-PLATFORM-07C3 — Targeted Tests and Consolidation | Low | 2-step loop (implementation, consolidation) |

### 13.3 Exact Next Prompt Type

**Keith decision required:**
1. Approve child slice split (07C1/07C2/07C3)
2. Register AGENT-PLATFORM-07C1 as ACTIVE
3. Step 3 of AGENT-PLATFORM-07C becomes "register and implement child slices"

### 13.4 Key Correction to Prior Documentation

The AGENT-PLATFORM-07 source-path review (§4.2, §5.4, §7.4, §12.1) incorrectly stated that `QueueService.cancelExecution(sessionId)` calls `this.queue.obliterate({ force: true })`. **This is incorrect.** No obliterate call exists. Cancel is per-execution via `ExecutionResultService.requestCancel(executionId)` which sets `execution_status = 'cancel_requested'` on `usage_records`. This significantly reduces the cancel redesign complexity and risk.

---

## 14. Final Report Summary

### 14.1 Exact File Created

| File | Action |
|------|--------|
| `docs/AGENT-PLATFORM-07C-READINESS-DESIGN-REVIEW.md` | CREATED (this document) |

### 14.2 Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — active task verification |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — mirror verification |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence |
| 4 | `docs/AGENT-PLATFORM-07B-CHECKPOINT.md` | Predecessor — module skeleton |
| 5 | `docs/AGENT-PLATFORM-07A-CHECKPOINT.md` | Predecessor — contracts/schema |
| 6 | `docs/AGENT-PLATFORM-07-CHECKPOINT.md` | Predecessor — coordinator planning |
| 7 | `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md` | 22-section coordinator plan |
| 8 | `docs/AGENT-PLATFORM-07-SOURCE-PATH-REVIEW.md` | Source-path review (contains obliterate claim — corrected herein) |
| 9 | `docs/AGENT-PLATFORM-06-CHECKPOINT.md` | Identity propagation |
| 10 | `docs/AGENT-HARNESS-07-CHECKPOINT.md` | Per-builder config adapter |
| 11 | `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Full E2E read-only canary |
| 12 | `services/api-gateway/src/orchestration/orchestration.contracts.ts` | Contracts file (07A) |
| 13 | `services/api-gateway/src/orchestration/orchestration.module.ts` | Module skeleton (07B) |
| 14 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Service skeleton (07B) |
| 15 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | Service tests (07B) |
| 16 | `services/api-gateway/src/queue/queue.service.ts` | BullMQ enqueue (no cancel method) |
| 17 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution controller (cancel endpoint) |
| 18 | `services/api-gateway/src/ai/execution-result.service.ts` | Cancel implementation (`requestCancel`) |
| 19 | `services/api-gateway/src/entities/usage-record.entity.ts` | Usage record entity |
| 20 | `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` type |
| 21 | `services/ai-service/src/worker/worker.processor.ts` | Worker job consumption |

### 14.3 Governance Readiness Result

**PASS — all 10 criteria satisfied.**

### 14.4 Source-Path Findings

- `OrchestrationService` has 2 skeleton methods; 9+ methods needed
- All contracts defined in `orchestration.contracts.ts`
- `QueueService` has only `enqueueExecution()`; no cancel method; no obliterate
- Cancel is per-execution via `ExecutionResultService.requestCancel(executionId)` → `usage_records.execution_status = 'cancel_requested'`
- Worker polls for cancel status; aborts via `AbortController`
- 5 new fields needed on `AiExecutionJob`
- Worker finalization needs to preserve new orchestration fields

### 14.5 Cancel Redesign Findings

**DOWNGRADED from HIGH to LOW–MEDIUM.** The obliterate claim from prior reviews is incorrect. Cancel is already per-execution, ledger-based, and compatible with multi-builder orchestration. Only cascade logic (per-collaboration cancel) needs to be added. No QueueService redesign needed. No new worker abort mechanism needed.

### 14.6 Referral Enqueue Design Findings

- Referral create path well-defined through existing contracts
- Job payload enrichment straightforward (spread `OrchestrationJobMetadata` into existing payload)
- In-memory store sufficient for first slice
- Safety limits (depth, loop, agent count, idempotency) implementable with in-memory Maps

### 14.7 Persistence Recommendation

**In-memory store + JSONB metadata. No database migration.** Dedicated tables deferred to future slice.

### 14.8 Exact Step 3 Implementation Boundary

- Primary: `orchestration.service.ts` (~9 new methods + in-memory stores)
- Secondary: `job.types.ts` (5 new optional fields), `worker.processor.ts` (~5 lines)
- Module wiring: `orchestration.module.ts` (QueueService injection if needed)
- Tests: Extensive unit + service tests

### 14.9 Split Decision

**B — Split into 3 child slices.** 07C1 (core methods + in-memory store), 07C2 (enqueue + cancel + type extension), 07C3 (tests + consolidation). Not registered — pending Keith approval.

### 14.10 Test Plan

Unit tests (CRUD, validation), service tests (enqueue, cancel, cascade), worker tests (metadata finalization), backward compatibility tests. No browser smoke. No runtime canary.

### 14.11 Risks/Blockers

- Cancel correctness: LOW (existing mechanism compatible)
- Ownership checks: MEDIUM (must verify userId)
- DB migration: N/A (none needed)
- Queue behavior: LOW (QueueService accepts any payload)
- Worker cancellation: LOW (existing AbortController)
- Runtime canary: MEDIUM (deferred to 07E)

### 14.12 Confirmation: No Source/Governance/Env Files Changed

**CONFIRMED.** Only `docs/AGENT-PLATFORM-07C-READINESS-DESIGN-REVIEW.md` created. No files under `services/`, `frontend/`, `database/`, `.env*`, `docker*`, `package*`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, or `docs/AINOW-EXECUTION-ROADMAP.md` were changed.

### 14.13 Confirmation: No Tests/Builds/Runtime/Provider Calls

**CONFIRMED.** No tests executed. No builds executed. No Docker/Postgres/Redis/API Gateway/container-manager/AI Service started. No BullMQ jobs created. No browser smoke. No provider/API calls. No git commits/pushes.

### 14.14 Whether AGENT-PLATFORM-07C Is Ready for Step 3

**YES — AGENT-PLATFORM-07C is ready for Step 3.**

Recommended path: Keith approves child slice split, registers 07C1 as ACTIVE, implementation proceeds with 3-step loop per child slice.

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-07C Step 2 — Readiness / Design Review
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
