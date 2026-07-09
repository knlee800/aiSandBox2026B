# AGENT-PLATFORM-07 — Source-Path Review for Read-Only Orchestration Coordinator

**Task ID:** AGENT-PLATFORM-07
**Step:** 2 — Coordinator Readiness / Source-Path Review
**Status:** Step 2 COMPLETE
**Date:** 2026-07-09
**Nature:** Read-only static review — no implementation, no runtime execution
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07 ACTIVE | **PASS** — registered in TASKS.md and TASKS_BACKLOG_FULL.md; Step 1 COMPLETE (Registration 2026-07-09); Keith approval recorded |
| AGENT-PLATFORM-06 COMPLETE and LOCKED | **PASS** — 2026-07-09; Upstream Identity Propagation; all 4 steps complete; 8 files changed; 34 suites / 654 passed |
| AGENT-PLATFORM-05 COMPLETE and LOCKED | **PASS** — 2026-07-09; Multi-Builder Runtime Orchestration Plan; all 4 steps complete; 19-section plan document |
| AGENT-PLATFORM-04 COMPLETE and LOCKED | **PASS** — 2026-07-07; Multi-Builder Runtime Topology Plan; role+profile identity model |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **PASS** — 2026-07-07; Per-Builder Harness Config Adapter; all 3 child slices complete |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **PASS** — 2026-07-09; Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary; PASS |
| One-active-task rule satisfied | **PASS** — only AGENT-PLATFORM-07 is ACTIVE |

**Governance readiness: PASS — all criteria satisfied.**

---

## 2. Foundation Summary

### 2.1 AGENT-PLATFORM-05 Orchestration Decisions

From `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` (19 sections, COMPLETE and LOCKED 2026-07-09):

| Decision | Choice |
|----------|--------|
| Initial orchestration mode | Read-only — no shared workspace writes |
| Routing model | Single `ai-execution` BullMQ queue with metadata routing |
| Session isolation | 1 builder profile = 1 session = 1 container |
| Write strategy | Deferred entirely — requires separate canary, conflict model, and Keith approval |
| Referral model | Async referral with explicit approval gates |
| Lock strategy (future) | Workspace-level mutex (sequential execution) |
| Max referral depth | 3 (configurable) |
| Max agents per collaboration | 4 (configurable) |
| First implementation slice | Upstream identity propagation (AGENT-PLATFORM-06 — COMPLETE) |
| Billing enforcement | Deferred to BILLING-READY-04+ |

Key design elements from the plan:
- `CollaborationReferral` object shape defined (§8.2) — `referralId`, `collaborationRunId`, `referralTraceId`, `parentReferralTraceId`, `sourceAgent`, `targetAgent`, `referralType`, `taskDescription`, `contextFiles`, `constraints`, `status`, `result`
- `ReferralStatus` enum: `pending_approval`, `approved`, `in_progress`, `completed`, `failed`, `cancelled`, `timed_out`
- `ReferralConstraints`: `maxDurationMs`, `maxToolIterations`, `readOnly`, `allowedTools`
- `CollaborationAgentIdentity`: `{ agentRole, builderProfileId }`
- `OrchestrationAuditEvent` interface defined (§13.3)
- Timeout model: per-referral (300s), collaboration-level (1800s), idle (120s)
- Idempotency key: `collaborationRunId` + source + target + type + task hash

### 2.2 AGENT-PLATFORM-06 Identity Propagation Result

From `docs/AGENT-PLATFORM-06-CHECKPOINT.md` (COMPLETE and LOCKED 2026-07-09):

| Field | Where Propagated |
|-------|-----------------|
| `agentRole` | `AIExecutionRequest` → controller → `WriteExecutionIntentDto` → `usage_records.metadata` JSONB → BullMQ job payload → worker `nextMetadata` finalization |
| `builderProfileId` | Same full path as `agentRole` |
| `collaborationRunId` | `AIExecutionRequest` → controller → BullMQ job payload → `AiExecutionJob` type (future-safe placeholder — always `undefined` today) |
| `referralTraceId` | `AIExecutionRequest` → controller → BullMQ job payload → `AiExecutionJob` type (future-safe placeholder — always `undefined` today) |

All four identity fields are now optional on `AIExecutionRequest`, forwarded by the controller, and present in the BullMQ job payload. `agentRole` and `builderProfileId` are stored in `usage_records.metadata` JSONB at both intent write and worker finalization. `collaborationRunId` and `referralTraceId` are on the `AiExecutionJob` type but not yet stored in usage records (they are always `undefined` in single-builder mode).

### 2.3 AGENT-HARNESS-07 Builder Profile Config Path

From `docs/AGENT-HARNESS-07-CHECKPOINT.md` (COMPLETE and LOCKED 2026-07-07):

- `resolveBuilderHarnessConfig()` — pure function at `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts`
- Resolution paths: `global-default-non-builder-role`, `global-default-missing-profile`, `global-default-unknown-profile`, `builder-profile`
- `DEFAULT_BUILDER_PROFILE_V1` — `builderProfileId: 'builder-default'`, `agentRole: 'builder'`
- `WorkerProcessor` calls adapter before harness dispatch; resolved config used throughout harness branch
- Platform safety enforcement: approval floors cannot be weakened, `allowArbitraryShell` platform veto
- Input: `{ agentRole, builderProfileId }` from `job.data` + `DEFAULT_AGENT_HARNESS_CONFIG_V1`
- When identity fields are absent → `global-default-missing-profile` fallback (current production behavior)

### 2.4 AGENT-HARNESS-06E Read-Only E2E Tool Path

From `docs/AGENT-HARNESS-06E-CHECKPOINT.md` (COMPLETE and LOCKED 2026-07-09):

- Full E2E path validated: Worker → ToolDispatcher → file-tool-handlers → ApiGatewayHttpClient → API Gateway → container-manager → Docker container filesystem
- `list_files` SUCCESS — actual file entries returned (not HANDLER_ERROR)
- `read_file` SUCCESS — actual file content returned (not HANDLER_ERROR)
- Provider: `test-harness-stub` — zero billing, zero external API calls
- Write tools disabled; validation tools disabled; browser smoke disabled
- Duration: 718ms for full E2E tool dispatch through 4 services

---

## 3. Existing Execution / Source-Path Map

### 3.1 Frontend Execution Boundary

**Primary execution entry:** `frontend/app/[locale]/app/page.tsx`
**Secondary execution entry:** `frontend/app/[locale]/driver/page.tsx`

The frontend calls `POST /api/ai/execute` via `useAIExecution` hook (`frontend/hooks/useAIExecution.ts`). The execution request payload is assembled in `handleSendMessage()`:

```typescript
{
  prompt: string,
  provider: string,             // e.g. 'anthropic', 'openai'
  model: string,                // e.g. 'claude-sonnet-4-20250514'
  sessionId: string,            // session UUID
  conversationId: string,       // same as sessionId currently
  workspaceContext?: {           // optional file tree / selected file context
    selectedFile?: string,
    fileTree?: any,
    openFiles?: string[],
  },
}
```

**Identity fields sent by frontend: NONE.** No `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`, `harnessVersion` in the frontend request body. These fields are accepted by the API Gateway (AGENT-PLATFORM-06) but the frontend never sends them.

**Session management:** `useSession` hook (`frontend/hooks/useSession.ts`) calls `POST /api/sessions` to create sessions. Session creation payload: `{ projectId }`. The hook stores `sessionId` in React state. No `agentRole` or `builderProfileId` in session creation.

**Project management:** `useProjects` hook (`frontend/hooks/useProjects.ts`) manages project listing. Projects have `id`, `name`, `userId`, `createdAt`, `updatedAt`. No agent identity on projects.

**Cancel mechanism:** `useAIExecution` has an `abortController` ref and `cancelExecution()` method that calls `POST /api/ai/execute/cancel` with `{ sessionId }` and aborts the SSE fetch.

**Streaming:** Frontend uses `fetch()` with streaming response (SSE-style) via `ReadableStream`. The `useAIExecution` hook reads chunks from the response stream and dispatches them to the UI via state updates.

**Agent registry:** `frontend/lib/agent-platform/agent-registry.ts` defines agent manifests with `AGENT_IDS = ['builder', 'chief-of-staff', 'product-strategy', 'technology-advisor']`. Each manifest has `id`, `nameKey`, `descriptionKey`, `role`, `skills`. The registry is frontend-only — no backend registry service exists.

### 3.2 API Gateway Controller / Service / Enqueue Path

**Controller:** `services/api-gateway/src/ai/ai-execution.controller.ts`

**Endpoint:** `POST /api/ai/execute` — `execute()` method

**Guard chain:** `SessionOrApiKeyAuthGuard` → `AuthorizationGuard` → `ExecutionSafetyGuard` → `LaunchGuard` → `AbortGuard` → `IdempotencyGuard` → `QuotaGuard` → `TokenQuotaGuard` → `RateLimitGuard`

The `execute()` method:
1. Validates `sessionId` is a valid UUID
2. Validates `harnessVersion` allow-list (only `'v1'` accepted)
3. Checks harness entitlement if `harnessVersion` is present
4. Verifies session ownership via `SessionService`
5. Resolves provider, model, global instructions, project instructions, repo doc context
6. Writes execution intent to ledger via `UsageLedgerService.writeExecutionIntent()` — includes `agentRole`, `builderProfileId` in metadata
7. Enqueues execution via `QueueService.enqueueExecution()` — includes all four identity fields in job payload

**Cancel endpoint:** `POST /api/ai/execute/cancel` — `cancelExecution()` method. Validates session ownership, calls `QueueService.cancelExecution(sessionId)`.

**AIExecutionRequest type** (`services/api-gateway/src/clients/ai-service-http.client.ts`):

```typescript
export interface AIExecutionRequest {
  sessionId: string;
  conversationId: string;
  userId: string;
  prompt: string;
  provider?: 'stub' | 'anthropic' | 'openai' | 'groq' | 'xai' | 'deepseek';
  model?: string;
  harnessVersion?: 'v1';
  workspaceContext?: WorkspaceContext;
  metadata?: Record<string, unknown>;
  agentRole?: string;
  builderProfileId?: string;
  collaborationRunId?: string;
  referralTraceId?: string;
}
```

All four identity fields are present as optional — added by AGENT-PLATFORM-06.

### 3.3 BullMQ Job Payload

**QueueService:** `services/api-gateway/src/queue/queue.service.ts`

```typescript
async enqueueExecution(jobData: any): Promise<void> {
  await this.queue.add('execute-ai', jobData, {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  });
}
```

Queue name: `ai-execution`
Job name: `execute-ai`
Payload type: `any` — no typed constraint on the enqueue side.

The controller builds the job payload with these fields:

```typescript
{
  executionId,
  userId: identity.userId,
  apiKeyId: identity.apiKeyId,
  sessionId: request.sessionId,
  conversationId: request.conversationId,
  provider,
  adapter: provider,
  prompt: request.prompt,
  workspaceContext: enrichedWorkspaceContext,
  model: requestedModel,
  globalInstructions,
  projectInstructions,
  requestId,
  submittedAt,
  ...(request.harnessVersion !== undefined && { harnessVersion: request.harnessVersion }),
  // Identity fields added by AGENT-PLATFORM-06:
  ...(request.agentRole !== undefined && { agentRole: request.agentRole }),
  ...(request.builderProfileId !== undefined && { builderProfileId: request.builderProfileId }),
  ...(request.collaborationRunId !== undefined && { collaborationRunId: request.collaborationRunId }),
  ...(request.referralTraceId !== undefined && { referralTraceId: request.referralTraceId }),
}
```

**Cancel:** `QueueService.cancelExecution(sessionId)` calls `this.queue.obliterate({ force: true })` — cancels ALL jobs, not per-session. This is a gap.

### 3.4 AI Service Worker Consumption

**WorkerProcessor:** `services/ai-service/src/worker/worker.processor.ts`

**AiExecutionJob type** (`services/ai-service/src/queue/job.types.ts`):

```typescript
export interface AiExecutionJob {
  executionId: string;
  userId: string;
  apiKeyId: string;
  sessionId: string;
  conversationId: string;
  provider: 'openai' | 'anthropic' | 'groq' | 'xai' | 'deepseek' | 'stub' | 'test-harness-stub';
  adapter: 'openai' | 'anthropic' | 'groq' | 'xai' | 'deepseek' | 'stub' | 'test-harness-stub';
  prompt: string;
  workspaceContext?: WorkspaceContext;
  globalInstructions?: string;
  projectInstructions?: string;
  model?: string;
  harnessVersion?: string;
  requestId?: string;
  submittedAt: string;

  // Per-builder identity fields (AGENT-HARNESS-07B):
  agentRole?: string;
  builderProfileId?: string;
  harnessProfileId?: string;
  modelProfileId?: string;
  toolPermissionProfileId?: string;

  // Orchestration identity fields (AGENT-PLATFORM-06):
  collaborationRunId?: string;
  referralTraceId?: string;
}
```

The worker reads identity fields from `job.data` and uses them:

1. **Harness config resolution:** `resolveBuilderHarnessConfig({ agentRole: job.data.agentRole, builderProfileId: job.data.builderProfileId }, DEFAULT_AGENT_HARNESS_CONFIG_V1)` — resolves per-builder config before harness dispatch
2. **Audit event:** `agent_harness.config_resolved` event logged with resolution metadata
3. **Ledger finalization:** `agentRole` and `builderProfileId` from `job.data` included in `nextMetadata` written to `usage_records.metadata` JSONB via raw SQL `UPDATE`

**Plain execution path:** When `useHarness` is `false`, the worker delegates to `aiExecutionService.execute(executionRequest)` — no harness, no builder config resolution, no identity-aware path.

### 3.5 Harness Config Resolution

**File:** `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts`

`resolveBuilderHarnessConfig(input, globalDefault)`:
- `global-default-non-builder-role` — non-builder `agentRole` → global default + warning
- `global-default-missing-profile` — no `builderProfileId` → global default, no warnings (current production path)
- `global-default-unknown-profile` — unknown `builderProfileId` → global default + warning
- `builder-profile` — known profile; harness fields merged over global default with platform safety enforcement

Platform safety enforcement:
- Approval floors (`requireApprovalForDelete`, `requireApprovalForPackageInstall`, `requireApprovalForEnvFileWrite`, `requireApprovalForLargeWrite`) cannot be weakened below `true`
- `allowArbitraryShell` cannot become `true` if global default is `false`

### 3.6 Usage / Audit Metadata Finalization

**Intent write** (`UsageLedgerService.writeExecutionIntent()`):
- Creates `UsageRecord` with `execution_status: 'pending'`
- `agentRole` and `builderProfileId` stored in `metadata` JSONB column
- `collaborationRunId` and `referralTraceId` are NOT stored in usage intent metadata (they exist on the request type but are not written to usage records during intent)

**Worker finalization** (`WorkerProcessor`):
- `UPDATE usage_records SET execution_status = 'completed', tokens_used = $2, metadata = $3::jsonb WHERE execution_id = $1`
- `nextMetadata` includes: `aiExecutionResult` (output, tokens, model, provider, fileActions), `agentRole`, `builderProfileId`
- `collaborationRunId` and `referralTraceId` are NOT included in `nextMetadata`

**Credit deduction** (`UsageLedgerService.emitDeductionAttempt()`):
- `CreditDeductionEvent` carries: `source`, `sourceEventId`, `ownerId`, `lineItems`, `metadata: { model, executionDurationMs, sessionId }`
- Identity fields NOT in deduction event metadata
- `CreditDeductionRecord` entity has `agentId` column (nullable) — exists since billing schema but never populated

---

## 4. Current Identity State

### 4.1 Where `collaborationRunId` Exists

| Location | Status |
|----------|--------|
| `AIExecutionRequest` type (API Gateway) | **PRESENT** — optional field, added by AGENT-PLATFORM-06 |
| Controller forwarding to `enqueueExecution()` | **PRESENT** — conditionally spread if not `undefined` |
| `AiExecutionJob` type (AI Service) | **PRESENT** — optional field, added by AGENT-PLATFORM-06 |
| Controller forwarding to `writeExecutionIntent()` | **ABSENT** — not forwarded to usage intent metadata |
| `usage_records.metadata` JSONB (intent) | **ABSENT** — not stored during intent write |
| `usage_records.metadata` JSONB (finalization) | **ABSENT** — not in worker `nextMetadata` |
| `CreditDeductionEvent` metadata | **ABSENT** |
| `CreditDeductionRecord` entity | **ABSENT** — no column |
| Worker `resolveBuilderHarnessConfig` input | **ABSENT** — not passed to adapter |
| `AgentHarnessAuditEventV1` payload | **ABSENT** — not populated |
| Frontend request | **ABSENT** — never sent |
| Database columns | **ABSENT** — only in JSONB metadata conceptually; not actually stored |

**Summary:** `collaborationRunId` exists as a type-level placeholder on `AIExecutionRequest` and `AiExecutionJob`. It is forwarded to the BullMQ job payload. It is NOT stored in usage records, NOT included in audit events, and NOT sent by the frontend. It is always `undefined` today.

### 4.2 Where `referralTraceId` Exists

| Location | Status |
|----------|--------|
| `AIExecutionRequest` type (API Gateway) | **PRESENT** — optional field |
| Controller forwarding to `enqueueExecution()` | **PRESENT** — conditionally spread |
| `AiExecutionJob` type (AI Service) | **PRESENT** — optional field |
| Controller forwarding to `writeExecutionIntent()` | **ABSENT** |
| `usage_records.metadata` JSONB | **ABSENT** — neither intent nor finalization |
| `CreditDeductionEvent` metadata | **ABSENT** |
| `CreditDeductionRecord` entity | **ABSENT** |
| Worker code | **ABSENT** — never read from `job.data` |
| `AgentHarnessAuditEventV1` payload | **ABSENT** |
| Frontend request | **ABSENT** |
| Database columns | **ABSENT** |

**Summary:** Same state as `collaborationRunId` — type-level placeholder only. Forwarded to BullMQ job but never consumed, stored, or surfaced.

### 4.3 Where `agentRole` Exists

| Location | Status |
|----------|--------|
| `AIExecutionRequest` type | **PRESENT** — optional |
| Controller → `writeExecutionIntent()` | **PRESENT** — stored in `metadata` JSONB |
| Controller → `enqueueExecution()` | **PRESENT** — in job payload |
| `AiExecutionJob` type | **PRESENT** — optional |
| `usage_records.metadata` JSONB (intent) | **PRESENT** — stored by `UsageLedgerService` |
| `usage_records.metadata` JSONB (finalization) | **PRESENT** — merged into `nextMetadata` by worker |
| `WorkerProcessor` → `resolveBuilderHarnessConfig` | **PRESENT** — read from `job.data.agentRole` |
| `agent_harness.config_resolved` audit event | **PRESENT** (via resolution metadata) |
| `BuilderProfileV1` contract | **PRESENT** — typed field |
| `DEFAULT_BUILDER_PROFILE_V1` | **PRESENT** — `agentRole: 'builder'` |
| `AgentHarnessRunRequestV1` | **PRESENT** — optional readonly field |
| Frontend request | **ABSENT** — never sent |
| `CreditDeductionEvent` metadata | **ABSENT** |
| Database column on `usage_records` | **ABSENT** — only in JSONB metadata |

**Summary:** `agentRole` is present throughout the full backend execution path from API Gateway through worker finalization. Always `undefined` in production because the frontend never sends it. When populated, it resolves to the correct builder profile config path.

### 4.4 Where `builderProfileId` Exists

| Location | Status |
|----------|--------|
| `AIExecutionRequest` type | **PRESENT** — optional |
| Controller → `writeExecutionIntent()` | **PRESENT** — stored in `metadata` JSONB |
| Controller → `enqueueExecution()` | **PRESENT** — in job payload |
| `AiExecutionJob` type | **PRESENT** — optional |
| `usage_records.metadata` JSONB (intent) | **PRESENT** |
| `usage_records.metadata` JSONB (finalization) | **PRESENT** |
| `WorkerProcessor` → `resolveBuilderHarnessConfig` | **PRESENT** — read from `job.data.builderProfileId` |
| `agent_harness.config_resolved` audit event | **PRESENT** (via resolution metadata) |
| `BuilderProfileV1` contract | **PRESENT** |
| `DEFAULT_BUILDER_PROFILE_V1` | **PRESENT** — `builderProfileId: 'builder-default'` |
| `AgentHarnessRunRequestV1` | **PRESENT** — optional readonly field |
| Static registry (`getBuilderProfile`) | **PRESENT** — lookup by `builderProfileId` |
| Frontend request | **ABSENT** — never sent |
| `CreditDeductionEvent` metadata | **ABSENT** |
| Database column on `usage_records` | **ABSENT** — only in JSONB metadata |
| `CreditDeductionRecord.agentId` | **ABSENT** — column exists but never populated |

**Summary:** Same coverage as `agentRole` — full backend path, never populated by frontend.

### 4.5 What Is Still Missing for a Coordinator

| Missing Element | Impact on Coordinator |
|----------------|----------------------|
| `collaborationRunId` not stored in usage records | Cannot query usage by collaboration |
| `referralTraceId` not stored in usage records | Cannot trace referral cost attribution |
| `collaborationRunId`/`referralTraceId` not in audit events | Cannot correlate harness events to collaborations |
| `parentReferralTraceId` field does not exist | Cannot build referral chain |
| `referringBuilderProfileId` field does not exist | Cannot trace which builder triggered referral |
| `orchestrationPriority` field does not exist | Cannot priority-route jobs |
| No `CollaborationReferral` entity/table | No persistent referral tracking |
| No `collaboration_runs` table | No persistent collaboration lifecycle tracking |
| No orchestration coordinator service | No service to create/manage collaborations |
| No referral lifecycle management | No referral status transitions |
| No depth/loop enforcement runtime | Safety limits are design-only |
| No cascade cancel by `collaborationRunId` | Cannot cancel all jobs in a collaboration |
| Frontend does not send identity fields | Coordinator cannot be triggered from frontend today |
| `QueueService.cancelExecution()` cancels ALL jobs | Cannot selectively cancel per-session/per-collaboration |

---

## 5. Coordinator Boundary Options

### 5.1 Option A — API Gateway Service Boundary

Place the coordinator as a NestJS service inside the API Gateway.

| Aspect | Assessment |
|--------|-----------|
| Pros | Closest to the enqueue path; can intercept execution requests before enqueue; direct access to `SessionService`, `UsageLedgerService`, `QueueService`; no new service startup |
| Cons | Increases API Gateway complexity; mixes request-handling with orchestration logic; harder to scale independently; coordinator state tied to API Gateway lifecycle |
| Boundary risk | Medium — API Gateway already handles auth, sessions, usage, enqueue; adding orchestration is a significant responsibility increase |

### 5.2 Option B — AI Service Boundary

Place the coordinator inside the AI Service alongside the worker.

| Aspect | Assessment |
|--------|-----------|
| Pros | Close to worker and harness; can observe job completion events directly; already has builder profile system |
| Cons | AI Service is consumption-side; coordination is submission-side logic; would need to call back to API Gateway for session creation and usage; splits submission logic across two services |
| Boundary risk | High — violates existing service boundary semantics (API Gateway submits, AI Service processes) |

### 5.3 Option C — Separate Orchestration Module in API Gateway

Create a new `orchestration/` module within the API Gateway but with a clear internal boundary.

| Aspect | Assessment |
|--------|-----------|
| Pros | Clean internal module boundary; can import existing API Gateway services (session, queue, usage); no new service deployment; preserves existing service topology; can be extracted to a separate service later if needed |
| Cons | Still within API Gateway process; coordinator lifecycle tied to API Gateway; requires careful module isolation |
| Boundary risk | Low-Medium — cleanest balance of reuse and separation |

### 5.4 Recommendation

**Option C — Separate orchestration module within API Gateway — is the safest boundary.**

Rationale:
1. **Preserves service topology** — no new service, no new deployment, no new Docker container
2. **Reuses existing infrastructure** — `SessionService` for session creation, `QueueService` for job enqueue, `UsageLedgerService` for usage tracking
3. **Clean internal boundary** — `OrchestrationModule` with its own service, contracts, and types; can be extracted to a dedicated service later if scale demands
4. **Read-only first** — initial coordinator only reads project state and creates referral metadata; no shared workspace mutation
5. **Matches AGENT-PLATFORM-05 plan** — the plan specified "orchestration coordinator" without specifying a new service; it assumed access to existing API Gateway infrastructure
6. **Least disruption** — no changes to Docker Compose, no new ports, no new env vars for a new service

**Proposed module path:** `services/api-gateway/src/orchestration/`

**Key internal boundaries:**
- `OrchestrationService` — collaboration lifecycle, referral creation/validation, depth/loop enforcement
- `OrchestrationContracts` — `CollaborationRun`, `CollaborationReferral`, identity types
- `OrchestrationGuard` or middleware — optional, if orchestration requests need distinct auth

### 5.5 Read-Only First Assumption

The coordinator must be read-only first:
- Creates/manages collaboration metadata (collaborationRunId, referralTraceId, referral status)
- Enqueues read-only Builder B jobs via existing `QueueService`
- No shared workspace writes
- No `write_file`, `delete_file`, `run_validation` activation
- Builder B operates in its own isolated session/container with read-only tools only
- Builder A continues in its own session after Builder B returns a result

---

## 6. Read-Only Referral Flow Needs

### 6.1 Builder A Starts Request

1. Frontend or API-key client sends `POST /api/ai/execute` with `agentRole: 'builder'`, `builderProfileId: 'builder-default'`
2. API Gateway controller validates, writes usage intent, enqueues job
3. Worker processes Builder A's job using harness loop
4. During execution, Builder A's harness determines a subtask should be referred to Builder B

### 6.2 Coordinator Creates / Uses `collaborationRunId`

**Lifecycle:**
1. `collaborationRunId` is generated when the first multi-builder referral in a workflow is created
2. If Builder A's execution is part of a single-builder workflow, `collaborationRunId` remains `undefined`
3. Once generated, `collaborationRunId` is immutable and propagated to ALL related jobs
4. The coordinator is the sole generator of `collaborationRunId` — neither the frontend nor the worker generates it

**Where generated:** `OrchestrationService.createCollaborationRun()` — inside the API Gateway orchestration module

**Storage:** Initially in-memory or in `metadata` JSONB on relevant usage records; future: dedicated `collaboration_runs` table

### 6.3 `referralTraceId` Lifecycle

1. Generated at each referral step — Builder A → Builder B = one `referralTraceId`
2. Each `referralTraceId` references a `parentReferralTraceId` (null for the first referral)
3. Chain: `A→B` has `referralTraceId: uuid-1, parentReferralTraceId: null`; `B→C` has `referralTraceId: uuid-2, parentReferralTraceId: uuid-1`
4. Used for: depth calculation, loop detection, audit trail reconstruction

**Where generated:** `OrchestrationService.createReferral()` — inside the coordinator

### 6.4 Source Builder → Target Builder

| Step | Actor | Action |
|------|-------|--------|
| 1 | Builder A (worker) | Detects subtask; emits referral request to coordinator |
| 2 | Coordinator | Validates referral (depth, loop, safety); generates `referralTraceId` |
| 3 | Coordinator | Creates Builder B session via `SessionService` (new session, same project) |
| 4 | Coordinator | Enqueues Builder B job via `QueueService` with `collaborationRunId`, `referralTraceId`, `builderProfileId: 'builder-B-profile'` |
| 5 | Worker | Picks up Builder B's job; resolves per-builder config; executes with read-only tools |
| 6 | Builder B | Completes execution; result stored in usage record |
| 7 | Coordinator | Receives completion notification; packages `ReferralResult` |

### 6.5 Return / Handoff Behavior

- Builder B's result is returned to the coordinator (not directly to Builder A)
- Coordinator packages `ReferralResult` and delivers it to Builder A's context
- Builder A resumes with Builder B's result available
- Async model: Builder A is not necessarily blocked during Builder B's execution (but may be in initial implementation for simplicity)

### 6.6 No Write Actions

- Builder A and Builder B both operate with read-only tools (`list_files`, `read_file`)
- `enableWriteTools: false` in resolved config for all builders in initial orchestration
- No `write_file`, `delete_file`, `run_validation`, or `browser_smoke` dispatched
- Write activation requires a separate canary task (AGENT-HARNESS write canary track — not part of AGENT-PLATFORM-07)

---

## 7. Queue / Job Routing Needs

### 7.1 Single Queue with Metadata Routing

As established by AGENT-PLATFORM-05 §6.3: use the existing `ai-execution` BullMQ queue. Jobs are distinguished by `builderProfileId` and `collaborationRunId` metadata on the job payload.

No new queues, no new worker processes, no new BullMQ connections.

### 7.2 Fields Required in `AiExecutionJob`

Currently present:
- `agentRole` — **PRESENT** (optional)
- `builderProfileId` — **PRESENT** (optional)
- `collaborationRunId` — **PRESENT** (optional)
- `referralTraceId` — **PRESENT** (optional)

**Fields still needed for coordinator:**

| Field | Type | Purpose | Status |
|-------|------|---------|--------|
| `parentReferralTraceId` | `string?` (UUID) | Links to parent referral in chain | **ABSENT** |
| `referringBuilderProfileId` | `string?` | Which builder triggered this job | **ABSENT** |
| `orchestrationPriority` | `number?` | Queue priority hint | **ABSENT** |
| `referralId` | `string?` (UUID) | Links to specific referral record | **ABSENT** |
| `isReferralExecution` | `boolean?` | Distinguishes referred jobs from direct | **ABSENT** |

### 7.3 How Builder A / B Jobs Are Distinguished

Builder A and Builder B jobs use the same queue and same worker. They are distinguished by:

| Field | Builder A (initiator) | Builder B (referred) |
|-------|----------------------|---------------------|
| `builderProfileId` | `'builder-default'` | `'builder-fullstack'` (example) |
| `collaborationRunId` | `uuid-1` | `uuid-1` (same) |
| `referralTraceId` | `null` or first step | Child referral UUID |
| `parentReferralTraceId` | `null` | Builder A's `referralTraceId` |
| `referringBuilderProfileId` | `null` (initiator) | `'builder-default'` |
| `isReferralExecution` | `false` | `true` |

The `WorkerProcessor` already resolves per-builder config via `resolveBuilderHarnessConfig()` using `builderProfileId`, so different builder profiles get different harness configurations. This is already working (AGENT-HARNESS-07B).

### 7.4 Cancel / Timeout Behavior Gaps

| Gap | Current State | Required State |
|-----|--------------|----------------|
| `QueueService.cancelExecution()` | Calls `queue.obliterate({ force: true })` — cancels ALL jobs | Must support per-session or per-collaborationRunId cancellation |
| Per-referral timeout | Not implemented | Coordinator must cancel individual referred jobs on timeout |
| Collaboration-level timeout | Not implemented | Coordinator must cascade cancel all jobs with matching `collaborationRunId` |
| Idle timeout | Not implemented | Coordinator must detect idle builders after referral result delivery |
| Worker abort signal | Worker has no `AbortController` or external cancel mechanism | Worker needs a way to receive cancel signals mid-execution |

**Cancel redesign is required before coordinator implementation.** The current `obliterate()` approach is not compatible with multi-builder orchestration where multiple independent jobs may be in the queue simultaneously.

### 7.5 Idempotency Requirements

From AGENT-PLATFORM-05 §9.3:

**Idempotency key:** `collaborationRunId` + `sourceAgent.builderProfileId` + `targetAgent.builderProfileId` + `referralType` + `taskDescription hash`

Behavior:
- If a referral with the same idempotency key already exists and is `in_progress` or `completed` → reject duplicate, return existing referral reference
- If the existing referral is `failed` or `cancelled` → allow retry (new `referralTraceId`)

This requires a referral tracking store (in-memory or database) to check idempotency before creating new referrals.

---

## 8. Session / Project / Container Ownership

### 8.1 Current Session / Project Linkage

**Session entity** (`services/container-manager/src/sessions/entities/session.entity.ts`):

```typescript
{
  id: string,           // nanoid, primary key
  userId: string,       // owner
  projectId: string,    // foreign key to Project
  status: 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error',
  containerStatus: 'none' | 'creating' | 'running' | 'stopping' | 'stopped' | 'error',
  containerId?: string, // Docker container ID
  workspacePath?: string,
  port?: number,
  previewPort?: number,
  startedAt?: Date,
  stoppedAt?: Date,
  errorMessage?: string,
  createdAt: Date,
  updatedAt: Date,
}
```

**Project entity** (`services/container-manager/src/projects/entities/project.entity.ts`):

```typescript
{
  id: string,           // nanoid, primary key
  name: string,
  userId: string,       // owner
  description?: string,
  createdAt: Date,
  updatedAt: Date,
  sessions: Session[],  // OneToMany relation
}
```

**No agent identity fields** on either Session or Project entities. No `agentRole`, `builderProfileId`, `collaborationRunId`.

### 8.2 1 Builder = 1 Session = 1 Container

This is the topology established by AGENT-PLATFORM-04 §4.1 and confirmed by AGENT-PLATFORM-05 §5.1.

Current system already enforces this:
- Session creation (`POST /api/sessions`) creates one session linked to one project
- `SessionsService.startSession()` creates one Docker container per session
- Each session gets its own `workspacePath` (`workspaces/{sessionId}/`)
- Each session gets its own container with isolated filesystem, network, and env

For multi-builder orchestration:
- Builder A session: `sessionId-A`, `containerId-A`, `workspacePath-A`
- Builder B session: `sessionId-B`, `containerId-B`, `workspacePath-B`
- Both share the same `projectId`
- No cross-session filesystem access

### 8.3 How Read-Only Context Sharing Should Work

**Sequential model (recommended for initial orchestration):**
1. Builder A operates on `sessionId-A` — reads/analyzes project files
2. Builder A refers subtask to Builder B
3. Coordinator creates `sessionId-B` for Builder B, linked to the same `projectId`
4. Container-manager starts Builder B's container, initializes workspace from project archive
5. Builder B has its own copy of project files — can read but not write
6. Builder B completes; result returned to coordinator
7. Coordinator delivers result to Builder A

**Concurrent read-only model (safe for initial orchestration):**
- Both builders read the same project baseline (each has their own workspace copy)
- No write conflict possible because neither builder can write
- Builder A and Builder B can run concurrently with read-only tools

### 8.4 What Must Remain Isolated

| Resource | Isolation Level |
|----------|----------------|
| Workspace filesystem | Per-session — each builder has own `workspaces/{sessionId}/` |
| Docker container | Per-session — each builder has own container |
| Container network | Per-session |
| Environment variables | Per-session |
| Git history | Per-session (independent commits, checkpoints) |
| Preview server | Per-session (each builder's preview reflects its own workspace) |
| Checkpoints | Per-session (reverts only the session's workspace) |
| Tool dispatch context | Per-session (tool results scoped to session's container) |
| SSE/streaming connection | Per-session (each execution has its own stream) |

---

## 9. Safety Limits and Approval Model

### 9.1 Max Referral Depth

From AGENT-PLATFORM-05 §9.1:
- Default: `maxReferralDepth = 3`
- Configurable at platform level
- Enforcement: coordinator rejects referrals where `referralChainLength >= maxReferralDepth`
- **Current state:** Not implemented — design only

### 9.2 Max Agents Per Collaboration

From AGENT-PLATFORM-05 §9.2:
- Default: `maxAgentsPerCollaboration = 4`
- Configurable at platform level
- Enforcement: coordinator rejects agent additions where `distinctBuilderProfileIds.length >= maxAgentsPerCollaboration`
- **Current state:** Not implemented — design only

### 9.3 Loop Prevention

From AGENT-PLATFORM-05 §9.4:
- Maintain ordered list of `builderProfileId` values in referral chain
- Before creating new referral, check if `targetAgent.builderProfileId` already in chain
- If target already in chain → reject referral, log warning
- Example: A→B→C valid; A→B→A invalid (A already in chain)
- **Current state:** Not implemented — design only

### 9.4 Duplicate Referral Idempotency

From AGENT-PLATFORM-05 §9.3:
- Idempotency key: `collaborationRunId` + source + target + type + task hash
- Duplicate in-progress/completed → reject, return existing reference
- Duplicate failed/cancelled → allow retry with new `referralTraceId`
- **Current state:** Not implemented — design only; requires referral tracking store

### 9.5 Owner Approval Boundaries

From AGENT-PLATFORM-05 §8.3 and §12:

| Trigger | Approval Type |
|---------|---------------|
| First referral in collaboration | Informational notification (no blocking) |
| Referral to new builder profile | Owner approval required |
| Referral depth approaching limit | Owner approval required |
| Write tool activation (future) | Owner approval required |
| High-risk action (legal, financial, etc.) | Platform-level mandatory |
| Budget threshold exceeded | Owner approval required |

**Current state:** Not implemented. Platform-level approval floors exist in `resolveBuilderHarnessConfig()` (AGENT-HARNESS-07), but orchestration-level approval gates are design-only.

### 9.6 Stop Conditions

| Condition | Behavior |
|-----------|----------|
| Builder B fails | `ReferralResult.status = 'failed'`; Builder A notified; may retry/abort/continue |
| Builder B times out | Job cancelled; referral `timed_out`; Builder A notified |
| Collaboration cancelled by owner | Cascade cancel all jobs via `collaborationRunId` |
| Builder A cancelled while Builder B running | Builder B continues (result discarded) unless cascade flag set |
| Builder A cancelled with cascade | Builder B also cancelled |
| Collaboration timeout (1800s) | All related jobs cancelled |
| Idle timeout (120s) | Owner notified; auto-terminate after grace |

---

## 10. Audit / Observability Needs

### 10.1 Orchestration Event Names

From AGENT-PLATFORM-05 §13:

| Event Name | When |
|------------|------|
| `orchestration.collaboration_created` | New `collaborationRunId` generated |
| `orchestration.referral_created` | New referral step created |
| `orchestration.referral_approved` | Owner approves referral |
| `orchestration.referral_started` | Builder B job enqueued |
| `orchestration.referral_completed` | Builder B returns result |
| `orchestration.referral_failed` | Builder B job failed |
| `orchestration.referral_cancelled` | Referral explicitly cancelled |
| `orchestration.referral_timed_out` | Per-referral timeout triggered |
| `orchestration.collaboration_completed` | All referrals resolved |
| `orchestration.collaboration_cancelled` | Owner or system cancels collaboration |

### 10.2 `collaborationRunId` / `referralTraceId` in Logs/Events

All events during a collaboration must carry `collaborationRunId`:
- `agent_harness.config_resolved` — **not currently included** (gap)
- `harness.loop_started` — **not currently included** (gap)
- `harness.tool_dispatch_completed` — **not currently included** (gap)
- `harness.loop_completed` — **not currently included** (gap)
- `execution_completed` — **not currently included** (gap)
- Credit deduction events — **not currently included** (gap)

Referral-specific events must carry `referralTraceId`:
- All `orchestration.*` events — **do not exist yet** (gap)

### 10.3 Source / Target Builder Identity

`OrchestrationAuditEvent` interface (from AGENT-PLATFORM-05 §13.3):

```typescript
interface OrchestrationAuditEvent {
  readonly eventType: string;
  readonly collaborationRunId: string;
  readonly referralTraceId: string;
  readonly sourceAgent: CollaborationAgentIdentity;
  readonly targetAgent: CollaborationAgentIdentity;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}
```

**Current state:** Not implemented. `AgentHarnessAuditEventV1.payload` is `Record<string, unknown>` — can accept identity fields without contract changes, but they are not populated.

### 10.4 Usage / Billing Attribution Readiness

| Aspect | Current State | Needed |
|--------|--------------|--------|
| `agentRole` on usage records | In `metadata` JSONB | Sufficient for initial attribution |
| `builderProfileId` on usage records | In `metadata` JSONB | Sufficient for initial attribution |
| `collaborationRunId` on usage records | **ABSENT** | Must be added for per-collaboration queries |
| `referralTraceId` on usage records | **ABSENT** | Must be added for per-referral cost breakdown |
| `agentRole`/`builderProfileId` on `CreditDeductionEvent` | **ABSENT** | Future task — not blocking coordinator |
| `CreditDeductionRecord.agentId` | Column exists, never populated | Can be populated with `builderProfileId` in future task |
| `collaborationRunId` on `CreditDeductionRecord` | **ABSENT** | Future column — not blocking coordinator |
| Per-collaboration cost analysis | Not possible | Requires `collaborationRunId` on deduction records |

### 10.5 What Can Be Deferred

| Deferrable Item | Reason |
|----------------|--------|
| `collaborationRunId` proper DB column on `usage_records` | JSONB metadata is sufficient for initial auditing; proper column for SQL queries is future |
| `referralTraceId` proper DB column | Same rationale |
| `CreditDeductionEvent` identity fields | Billing attribution enforcement is deferred to BILLING-READY-04+ |
| `CreditDeductionRecord.agentId` population | Not blocking coordinator; can be done when billing attribution is implemented |
| Per-collaboration budget enforcement | Deferred to BILLING-READY-04+ |
| Structured orchestration event table | Events can start as log entries; dedicated table is future |

---

## 11. Explicit Non-Goals for Step 3 Plan

| Non-Goal | Rationale |
|----------|-----------|
| No implementation | AGENT-PLATFORM-07 is planning/governance only |
| No runtime coordinator | No service code, no module creation, no TypeScript implementation |
| No write tools | Read-only orchestration only; `write_file`/`delete_file` remain disabled |
| No shared workspace writes | Each builder isolated to its own session/container |
| No database migration | Unless the Step 3 plan explicitly justifies a future migration as part of the plan document |
| No AGENT-HARNESS write canary | Separate track — must not be mixed into AGENT-PLATFORM-07 |
| No billing enforcement | Deferred to BILLING-READY-04+ |
| No frontend UI changes | No new user-facing text |
| No tests/builds/runtime commands | Static planning only |
| No provider/API calls | No external calls |
| No Docker/Postgres/Redis startup | No infrastructure commands |
| No git commits/pushes | No VCS operations |

---

## 12. Recommended Step 3 Plan Shape

### 12.1 Exact Document Path

```
C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md
```

### 12.2 Exact Sections Needed

| # | Section | Content |
|---|---------|---------|
| 1 | Task Summary | AGENT-PLATFORM-07 Step 3 context, purpose, nature |
| 2 | Foundation Summary | PLATFORM-04/05/06, HARNESS-07, HARNESS-06E recap |
| 3 | Coordinator Architecture | Module boundary (API Gateway `orchestration/`), service shape, contract types |
| 4 | `collaborationRunId` Lifecycle | Generation, propagation, storage, immutability |
| 5 | `referralTraceId` Lifecycle | Generation, chain semantics, depth tracking |
| 6 | Referral Object Contract | TypeScript interface for `CollaborationReferral` (adapted from PLATFORM-05 §8.2) |
| 7 | `CollaborationRun` Contract | TypeScript interface for collaboration lifecycle tracking |
| 8 | Read-Only Referral Flow | Step-by-step: Builder A request → coordinator → Builder B session → Builder B execution → result return |
| 9 | Coordinator–Worker Communication | How referral requests flow from worker to coordinator and back (event-based, HTTP callback, or queue message) |
| 10 | Queue/Job Routing Model | Single queue with metadata; new fields on `AiExecutionJob`; job priority |
| 11 | Session/Project/Container Model | Per-builder session creation; project linkage; workspace isolation |
| 12 | Cancel/Timeout/Failure Model | Per-referral timeout, collaboration timeout, cascade cancel, idle timeout, `QueueService` cancel redesign |
| 13 | Safety Limits | Max depth, max agents, loop prevention, idempotency enforcement |
| 14 | Owner Approval Gates | Which events require owner approval; how approval blocks/allows referrals |
| 15 | Audit and Observability | Event names, identity fields in events, structured vs unstructured events |
| 16 | Usage/Billing Attribution | `collaborationRunId`/`referralTraceId` in usage records; billing deferred |
| 17 | Database/Schema Needs | Whether any migration is needed; JSONB-first or proper columns; collaboration/referral tables |
| 18 | UX/UI Future Constraints | Multilingual-first; no new UI in this task; future UI surfaces listed |
| 19 | Implementation Sequence | Recommended child slices for AGENT-PLATFORM-07; ordering; dependencies |
| 20 | Non-Goals | What the plan does not cover |
| 21 | Risks and Blockers | Technical risks, architecture risks, cancel redesign risk |
| 22 | Readiness Conclusion | Whether AGENT-PLATFORM-07 should proceed to Step 4 consolidation |

### 12.3 Whether AGENT-PLATFORM-07 Remains One Planning Task or Should Split

**Recommendation: AGENT-PLATFORM-07 should remain one planning task (Steps 1–4) and produce the plan document.**

Future implementation should be split into child slices:

| # | Candidate Child Slice | Nature | Risk |
|---|----------------------|--------|------|
| 1 | AGENT-PLATFORM-07A | Coordinator contracts/types/schema (TypeScript types only) | Low |
| 2 | AGENT-PLATFORM-07B | Read-only coordinator service implementation | High |
| 3 | AGENT-PLATFORM-07C | Collaboration audit events | Low |
| 4 | AGENT-PLATFORM-07D | Read-only coordinator canary (controlled execution) | High |
| 5 | AGENT-PLATFORM-07E | Cancel/timeout redesign (`QueueService` improvements) | Medium |

These child slices should NOT be registered until Step 3 plan is reviewed and Keith approves. The planning task itself (AGENT-PLATFORM-07 Steps 1–4) should complete as one planning task.

### 12.4 Risks / Blockers

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cancel redesign complexity | HIGH | `QueueService.cancelExecution()` currently obliterates all jobs; must be redesigned for per-session/per-collaboration cancellation before multi-builder is safe |
| Coordinator–worker communication model | MEDIUM | Must decide: does the worker call the coordinator via HTTP, or does the coordinator observe job events? This is an architecture decision for Step 3 |
| Referral tracking persistence | MEDIUM | Must decide: in-memory (simple but not durable) vs database table (durable but requires migration) |
| Builder B session creation latency | LOW | Creating a new session + starting a Docker container takes several seconds; referral flow must account for this |
| No existing referral mechanism in worker | MEDIUM | The worker/harness does not currently have a mechanism to request a referral mid-execution; this must be designed |
| JSONB metadata limitations | LOW | JSONB storage for `collaborationRunId`/`referralTraceId` is fine for initial audit but not queryable via SQL for reporting |
| Scope creep into write canary | LOW | Must maintain strict boundary — AGENT-HARNESS write canary is a separate track |

### 12.5 Ready / Not Ready for Step 3

**READY — AGENT-PLATFORM-07 is ready for Step 3 (Read-Only Orchestration Coordinator Plan Document).**

All prerequisites are satisfied:
- AGENT-PLATFORM-06 COMPLETE and LOCKED — identity fields propagated
- AGENT-PLATFORM-05 COMPLETE and LOCKED — orchestration plan established
- AGENT-PLATFORM-04 COMPLETE and LOCKED — topology defined
- AGENT-HARNESS-07 COMPLETE and LOCKED — builder profile config path working
- AGENT-HARNESS-06E COMPLETE and LOCKED — full E2E read-only tool path validated
- Source-path review complete (this document)
- No blockers that prevent planning (all risks are implementation risks, not planning risks)

---

## 13. UX/UI Future Constraints

- **No new UI expected in AGENT-PLATFORM-07 planning.**
- If future implementation adds user-facing UI text, aiSandBox is **multilingual-first** and must update:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`)
- Do NOT add hardcoded English UI copy
- Icons: **Heroicons v2 Outline only**
- Impeccable and Emil Kowalski design engineering skills are **advisory only** — must not override governance, scope, architecture, or tests

**Potential future UI surfaces (for future implementation tasks, not AGENT-PLATFORM-07):**
- Builder profile selector
- Collaboration status indicator
- Referral chain visualization
- Per-builder attribution in usage dashboard
- Approval gate UI
- Collaboration history

---

## 14. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — AGENT-PLATFORM-07 registration, status, acceptance criteria |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — mirror verification |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, active task verification |
| 4 | `docs/AGENT-PLATFORM-07-CHECKPOINT.md` | Checked — does not exist yet (expected) |
| 5 | `docs/AGENT-PLATFORM-06-CHECKPOINT.md` | Prerequisite — identity propagation result |
| 6 | `docs/AGENT-PLATFORM-06-SOURCE-PATH-REVIEW.md` | Reference — AGENT-PLATFORM-06 source-path review |
| 7 | `docs/AGENT-PLATFORM-05-CHECKPOINT.md` | Prerequisite — orchestration plan checkpoint |
| 8 | `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` | Prerequisite — 19-section orchestration plan |
| 9 | `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` | Prerequisite — role+profile topology plan |
| 10 | `docs/AGENT-HARNESS-07-CHECKPOINT.md` | Prerequisite — per-builder config adapter checkpoint |
| 11 | `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Prerequisite — full E2E read-only canary checkpoint |
| 12 | `frontend/app/[locale]/app/page.tsx` | Frontend execution request origin |
| 13 | `frontend/app/[locale]/driver/page.tsx` | Secondary frontend execution entry |
| 14 | `frontend/hooks/useAIExecution.ts` | Frontend execution hook — payload, streaming, cancel |
| 15 | `frontend/hooks/useSession.ts` | Frontend session management hook |
| 16 | `frontend/hooks/useProjects.ts` | Frontend project management hook |
| 17 | `frontend/lib/agent-platform/agent-registry.ts` | Frontend agent registry — AGENT_IDS, manifests |
| 18 | `services/api-gateway/src/clients/ai-service-http.client.ts` | `AIExecutionRequest` type with identity fields |
| 19 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution controller — guard chain, enqueue, cancel |
| 20 | `services/api-gateway/src/queue/queue.service.ts` | BullMQ enqueue, cancel (obliterate), queue setup |
| 21 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Usage intent write, deduction attempt, identity metadata |
| 22 | `services/api-gateway/src/sessions/sessions.service.ts` | Session lifecycle — create, verify ownership |
| 23 | `services/api-gateway/src/projects/projects.service.ts` | Project lifecycle — create, list |
| 24 | `services/api-gateway/src/entities/usage-record.entity.ts` | `UsageRecord` entity — DB columns |
| 25 | `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` type with identity fields |
| 26 | `services/ai-service/src/worker/worker.processor.ts` | Worker job consumption, identity usage, ledger finalization |
| 27 | `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | `AgentHarnessRunRequestV1`, `AgentHarnessAuditEventV1` |
| 28 | `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts` | Pure adapter — per-builder config resolution |
| 29 | `services/ai-service/src/agent-harness/builder-profiles/builder-profile.registry.ts` | Static builder profile registry |
| 30 | `services/ai-service/src/agent-harness/builder-profiles/builder-profile.contracts.ts` | V1 typed contracts |
| 31 | `services/container-manager/src/sessions/entities/session.entity.ts` | Session entity — no agent identity fields |
| 32 | `services/container-manager/src/projects/entities/project.entity.ts` | Project entity — no agent identity fields |
| 33 | `services/container-manager/src/sessions/sessions.service.ts` | Session creation, start/stop, container lifecycle |
| 34 | `services/container-manager/src/docker/docker-runtime.service.ts` | Docker container creation, workspace management |

---

## 15. Summary

| Item | Result |
|------|--------|
| File created | `docs/AGENT-PLATFORM-07-SOURCE-PATH-REVIEW.md` (this document) |
| Files inspected | 34 source/governance/doc files |
| Governance readiness | **PASS** — all 7 criteria satisfied |
| Foundation summary | PLATFORM-05 orchestration decisions locked; PLATFORM-06 identity propagation complete; HARNESS-07 config adapter working; HARNESS-06E full E2E read-only path validated |
| Execution path | Frontend → API Gateway controller → QueueService → BullMQ → Worker → usage_records (raw SQL). Identity fields (`agentRole`, `builderProfileId`) flow end-to-end. `collaborationRunId`/`referralTraceId` are type-level placeholders. |
| Identity state | `agentRole`/`builderProfileId` fully propagated (PLATFORM-06); `collaborationRunId`/`referralTraceId` on types but not stored/consumed; 14 gaps identified for coordinator |
| Coordinator boundary | **Recommended: Option C — separate `orchestration/` module within API Gateway** — safest balance of reuse and separation |
| Queue/job routing | Single queue with metadata routing (PLATFORM-05 decision); 5 new job fields needed; cancel redesign required |
| Session/project/container | 1:1:1 isolation (PLATFORM-04 decision); no agent identity on session/project entities; per-builder session creation required for coordinator |
| Safety limits | Max depth 3, max agents 4, loop prevention, idempotency — all design-only, not implemented |
| Audit/observability | 10 orchestration event types defined; `collaborationRunId`/`referralTraceId` not in existing events (gap); deduction attribution deferred |
| Cancel redesign | **Critical gap** — `QueueService.cancelExecution()` obliterates ALL jobs; must be redesigned for per-session/per-collaboration cancellation |
| Recommended plan shape | 22-section plan document at exact path specified |
| Split recommendation | AGENT-PLATFORM-07 remains one planning task; future implementation splits into 5 candidate child slices |
| Risks/blockers | Cancel redesign (HIGH), coordinator-worker communication model (MEDIUM), referral persistence (MEDIUM), worker referral mechanism (MEDIUM) |
| Source/governance files changed | ONLY this review document created |
| Tests/builds/runtime/provider calls | NONE executed |
| AGENT-PLATFORM-07 ready for Step 3 | **YES** |

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-07 Step 2 — Coordinator Readiness / Source-Path Review
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
