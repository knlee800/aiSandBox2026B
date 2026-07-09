# AGENT-PLATFORM-07 — Read-Only Orchestration Coordinator Plan

**Task ID:** AGENT-PLATFORM-07
**Step:** 3 — Read-Only Orchestration Coordinator Plan Document
**Status:** Step 3 COMPLETE
**Date:** 2026-07-09
**Nature:** Planning/governance only — no implementation, no runtime execution
**Author:** AI-assisted governance pass

---

## 1. Task Summary

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-07 |
| Step | 3 — Read-Only Orchestration Coordinator Plan Document |
| Nature | Planning/governance only |
| Purpose | Define a read-only orchestration coordinator that routes referrals between multiple Builder profiles without shared workspace writes |
| Implementation | NONE — this document defines coordinator architecture for future implementation tasks |
| Runtime execution | NONE — no services started, no jobs executed, no containers created |
| Scope | Read-only coordinator plan only — no write tools, no shared workspace mutation, no AGENT-HARNESS write canary |

This plan defines how a read-only orchestration coordinator should be designed and implemented within the existing aiSandBox platform architecture. It covers referral lifecycle, queue routing, session ownership, cancel/timeout redesign, safety limits, approval gates, audit, persistence, and the recommended implementation sequence for future child tasks.

**Explicit non-goals:**

- No implementation of any source code
- No runtime coordinator service
- No service startup, Docker, Postgres, Redis
- No database migration
- No frontend UI changes
- No write tools (`write_file`, `delete_file`, `run_validation`)
- No shared workspace writes
- No AGENT-HARNESS write canary work
- No billing enforcement
- No provider/API calls
- No tests, builds, or browser smoke

---

## 2. Prerequisite Foundation

### 2.1 AGENT-PLATFORM-05 — Orchestration Decisions (COMPLETE and LOCKED 2026-07-09)

19-section multi-builder orchestration plan establishing:

| Decision | Choice |
|----------|--------|
| Initial orchestration mode | Read-only — no shared workspace writes |
| Routing model | Single `ai-execution` BullMQ queue with metadata routing |
| Session isolation | 1 builder profile = 1 session = 1 container |
| Write strategy | Deferred entirely — requires separate canary, conflict model, Keith approval |
| Referral model | Async referral with explicit approval gates |
| Lock strategy (future) | Workspace-level mutex (sequential execution) |
| Max referral depth | 3 (configurable) |
| Max agents per collaboration | 4 (configurable) |
| First implementation slice | Upstream identity propagation (AGENT-PLATFORM-06 — COMPLETE) |
| Billing enforcement | Deferred to BILLING-READY-04+ |

Key design artifacts from AGENT-PLATFORM-05:
- `CollaborationReferral` object shape (§8.2)
- `ReferralStatus` enum: `pending_approval`, `approved`, `in_progress`, `completed`, `failed`, `cancelled`, `timed_out`
- `ReferralConstraints`: `maxDurationMs`, `maxToolIterations`, `readOnly`, `allowedTools`
- `CollaborationAgentIdentity`: `{ agentRole, builderProfileId }`
- `OrchestrationAuditEvent` interface (§13.3)
- Timeout model: per-referral (300s), collaboration-level (1800s), idle (120s)
- Idempotency key: `collaborationRunId` + source + target + type + task hash

### 2.2 AGENT-PLATFORM-06 — Identity Propagation (COMPLETE and LOCKED 2026-07-09)

Upstream identity field propagation through the full execution path:

| Field | Propagation Status |
|-------|-------------------|
| `agentRole` | Full path: `AIExecutionRequest` → controller → `WriteExecutionIntentDto` → `usage_records.metadata` JSONB → BullMQ job payload → worker `nextMetadata` finalization |
| `builderProfileId` | Same full path as `agentRole` |
| `collaborationRunId` | `AIExecutionRequest` → controller → BullMQ job payload → `AiExecutionJob` type (future-safe placeholder — always `undefined` today) |
| `referralTraceId` | Same as `collaborationRunId` — type-level placeholder only |

All four identity fields are optional. Single-builder executions are unaffected when fields are absent. 8 source/test files changed; 34 suites / 654 tests passed.

### 2.3 AGENT-HARNESS-07 — Builder Profile Config Path (COMPLETE and LOCKED 2026-07-07)

- `resolveBuilderHarnessConfig()` — pure function at `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts`
- Resolution paths: `global-default-non-builder-role`, `global-default-missing-profile`, `global-default-unknown-profile`, `builder-profile`
- `DEFAULT_BUILDER_PROFILE_V1` — `builderProfileId: 'builder-default'`, `agentRole: 'builder'`
- `WorkerProcessor` calls adapter before harness dispatch; resolved config flows through harness branch
- Platform safety enforcement: approval floors cannot be weakened, `allowArbitraryShell` platform veto

### 2.4 AGENT-HARNESS-06E — Read-Only E2E File Path (COMPLETE and LOCKED 2026-07-09)

- Full E2E path validated: Worker → ToolDispatcher → file-tool-handlers → ApiGatewayHttpClient → API Gateway → container-manager → Docker container filesystem
- `list_files` SUCCESS — actual file entries returned
- `read_file` SUCCESS — actual file content returned
- Provider: `test-harness-stub` — zero billing, zero external API calls
- Write tools disabled; validation tools disabled; browser smoke disabled
- Duration: 718ms for full E2E tool dispatch through 4 services

---

## 3. Coordinator Goal

### 3.1 Primary Objective

Coordinate multiple Builder profiles collaborating on a shared project via a referral-based model. The coordinator manages collaboration lifecycle, referral creation/validation, session creation, job enqueue, result delivery, and safety enforcement.

### 3.2 Read-Only Orchestration First

The initial coordinator operates in **read-only mode only**:

| Capability | Status |
|-----------|--------|
| Builder A read-only tools (`list_files`, `read_file`) | ENABLED |
| Builder B read-only tools (`list_files`, `read_file`) | ENABLED |
| Collaboration metadata (referral objects, identity propagation) | ENABLED |
| Referral routing and lifecycle management | ENABLED |
| Audit event creation | ENABLED |
| `write_file` | DISABLED — not activated |
| `delete_file` | DISABLED — not activated |
| `run_validation` | DISABLED — not activated |
| `browser_smoke` | DISABLED — not activated |
| Shared workspace writes | DISABLED — no cross-session file mutation |

### 3.3 No Shared Writes

- Each builder operates in its own isolated session and container
- No cross-session filesystem access
- No real-time file synchronization between builders
- Builder B reads project files from its own workspace copy (restored from project archive)
- Integration happens at the project level (post-completion merge — future)

### 3.4 Write Canary Separation

The AGENT-HARNESS write canary track (single-builder write tool activation) is a **separate track** and must not be mixed into AGENT-PLATFORM-07 coordinator work. Write tool activation requires its own registration, canary, and Keith approval before any multi-builder write orchestration.

---

## 4. Existing Execution Path

### 4.1 Frontend

- Primary entry: `frontend/app/[locale]/app/page.tsx`
- Secondary entry: `frontend/app/[locale]/driver/page.tsx`
- Calls `POST /api/ai/execute` via `useAIExecution` hook
- Payload: `{ prompt, provider, model, sessionId, conversationId, workspaceContext }`
- Identity fields sent by frontend: **NONE** — no `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`
- Cancel: `POST /api/ai/execute/cancel` with `{ sessionId }` + `AbortController`
- Streaming: `fetch()` with `ReadableStream` (SSE-style)
- Agent registry: `frontend/lib/agent-platform/agent-registry.ts` — `AGENT_IDS = ['builder', 'chief-of-staff', 'product-strategy', 'technology-advisor']` — frontend-only, no backend registry

### 4.2 API Gateway Controller / Service / Enqueue Path

- Controller: `services/api-gateway/src/ai/ai-execution.controller.ts`
- Endpoint: `POST /api/ai/execute`
- Guard chain: `SessionOrApiKeyAuthGuard` → `AuthorizationGuard` → `ExecutionSafetyGuard` → `LaunchGuard` → `AbortGuard` → `IdempotencyGuard` → `QuotaGuard` → `TokenQuotaGuard` → `RateLimitGuard`
- Flow: validate → check harness entitlement → verify session ownership → resolve provider/model/instructions → write usage intent → enqueue BullMQ job
- Cancel: `POST /api/ai/execute/cancel` → `QueueService.cancelExecution(sessionId)` → `queue.obliterate({ force: true })` — **cancels ALL jobs**

### 4.3 BullMQ ai-execution Queue

- Queue name: `ai-execution`
- Job name: `execute-ai`
- `QueueService.enqueueExecution(jobData: any)` — untyped, passes payload verbatim
- Options: `{ attempts: 1, removeOnComplete: true, removeOnFail: false }`
- Job payload includes all four identity fields (AGENT-PLATFORM-06): `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` — conditionally spread

### 4.4 AI Service Worker

- `WorkerProcessor` at `services/ai-service/src/worker/worker.processor.ts`
- Reads identity fields from `job.data`
- Calls `resolveBuilderHarnessConfig({ agentRole, builderProfileId }, DEFAULT_AGENT_HARNESS_CONFIG_V1)` before harness dispatch
- Logs `agent_harness.config_resolved` event
- Finalization: raw SQL `UPDATE usage_records SET ... metadata = $3::jsonb` with `nextMetadata` containing `agentRole`, `builderProfileId`

### 4.5 Harness Loop / Config Resolution

- `resolveBuilderHarnessConfig()` pure function
- Resolution paths: `global-default-non-builder-role`, `global-default-missing-profile`, `global-default-unknown-profile`, `builder-profile`
- Platform safety: approval floors cannot be weakened; `allowArbitraryShell` veto
- Resolved config used for all harness branch decisions: tool registration, limits, audit, pre-apply checkpoint

### 4.6 Usage Records Metadata Finalization

- Intent write: `agentRole` and `builderProfileId` stored in `metadata` JSONB (AGENT-PLATFORM-06)
- Worker finalization: `agentRole` and `builderProfileId` preserved in `nextMetadata`
- `collaborationRunId` and `referralTraceId`: **NOT stored** in usage records (type-level placeholders only)
- Credit deduction: `CreditDeductionRecord.agentId` column exists but never populated

---

## 5. Current Identity State

### 5.1 agentRole and builderProfileId — Full Backend Path

Both fields are present throughout the full backend execution path from API Gateway through worker finalization (AGENT-PLATFORM-06). They are always `undefined` in production because the frontend never sends them. When populated, they resolve to the correct builder profile config path.

| Location | Status |
|----------|--------|
| `AIExecutionRequest` type | PRESENT — optional |
| Controller → `writeExecutionIntent()` | PRESENT — stored in `metadata` JSONB |
| Controller → `enqueueExecution()` | PRESENT — in job payload |
| `AiExecutionJob` type | PRESENT — optional |
| `usage_records.metadata` (intent + finalization) | PRESENT |
| `WorkerProcessor` → `resolveBuilderHarnessConfig` | PRESENT |
| Frontend request | ABSENT — never sent |
| `CreditDeductionEvent` metadata | ABSENT |

### 5.2 collaborationRunId and referralTraceId — Placeholder Only

| Location | Status |
|----------|--------|
| `AIExecutionRequest` type | PRESENT — optional |
| Controller forwarding to `enqueueExecution()` | PRESENT — conditionally spread |
| `AiExecutionJob` type | PRESENT — optional |
| `usage_records.metadata` | **ABSENT** — neither intent nor finalization |
| Worker code | **ABSENT** — never read from `job.data` |
| `CreditDeductionEvent` metadata | **ABSENT** |
| `AgentHarnessAuditEventV1` payload | **ABSENT** — not populated |
| Frontend request | **ABSENT** |
| Database columns | **ABSENT** |

### 5.3 Fields Missing for Coordinator

| Missing Element | Impact |
|----------------|--------|
| `collaborationRunId` not stored in usage records | Cannot query usage by collaboration |
| `referralTraceId` not stored in usage records | Cannot trace referral cost attribution |
| `parentReferralTraceId` field does not exist | Cannot build referral chain |
| `referringBuilderProfileId` field does not exist | Cannot trace which builder triggered referral |
| `orchestrationPriority` field does not exist | Cannot priority-route jobs |
| `referralId` field does not exist | Cannot link jobs to specific referral records |
| `isReferralExecution` field does not exist | Cannot distinguish referred jobs from direct |
| No `CollaborationReferral` entity/table | No persistent referral tracking |
| No `collaboration_runs` table | No persistent collaboration lifecycle |
| No orchestration coordinator service | No service to create/manage collaborations |
| No referral lifecycle management | No referral status transitions |
| No depth/loop enforcement runtime | Safety limits are design-only |
| No cascade cancel by `collaborationRunId` | Cannot cancel all jobs in a collaboration |
| `QueueService.cancelExecution()` cancels ALL jobs | Cannot selectively cancel per-session/per-collaboration |
| Frontend does not send identity fields | Coordinator cannot be triggered from frontend today |

---

## 6. Coordinator Boundary Decision

### 6.1 Recommendation: Separate Orchestration Module Inside API Gateway

**Option C from the Step 2 Source-Path Review — a separate `orchestration/` module within the API Gateway** — is the recommended boundary.

**Proposed module path:** `services/api-gateway/src/orchestration/`

### 6.2 Why Not Frontend-Only

| Concern | Assessment |
|---------|-----------|
| Frontend lacks queue access | Cannot enqueue BullMQ jobs |
| Frontend lacks session creation | Cannot create Builder B sessions |
| Frontend lacks usage ledger | Cannot attribute orchestration costs |
| Orchestration requires backend state | Referral lifecycle, timeout, cancel require server-side coordination |
| Security | Coordinator decisions must not be client-controlled |

### 6.3 Why Not AI Service-Only

| Concern | Assessment |
|---------|-----------|
| AI Service is consumption-side | Coordination is submission-side logic |
| Would need to call back to API Gateway | Session creation and usage tracking live in API Gateway |
| Splits submission logic across two services | Violates existing service boundary semantics (API Gateway submits, AI Service processes) |
| Boundary risk | HIGH — breaks current architecture |

### 6.4 Why API Gateway Orchestration Module

| Advantage | Detail |
|-----------|--------|
| Preserves service topology | No new service, no new deployment, no new Docker container |
| Reuses existing infrastructure | `SessionService` for session creation, `QueueService` for job enqueue, `UsageLedgerService` for usage tracking |
| Clean internal boundary | `OrchestrationModule` with its own service, contracts, and types |
| Extractable later | Can be moved to a dedicated service if scale demands |
| Read-only first | Initial coordinator only reads project state and creates referral metadata |
| Matches AGENT-PLATFORM-05 plan | Plan assumed access to existing API Gateway infrastructure |
| Least disruption | No Docker Compose changes, no new ports, no new env vars |

### 6.5 Key Internal Boundaries

| Component | Responsibility |
|-----------|---------------|
| `OrchestrationService` | Collaboration lifecycle, referral creation/validation, depth/loop enforcement, timeout management, cancel cascade |
| `OrchestrationContracts` | `CollaborationRun`, `CollaborationReferral`, `ReferralResult`, identity types |
| `OrchestrationEventEmitter` | Typed orchestration audit events |
| `OrchestrationGuard` (optional) | Distinct auth/ownership checks for orchestration requests if needed |

### 6.6 Extraction Path

If the orchestration module becomes too complex or needs independent scaling:

1. Extract `orchestration/` module to a dedicated NestJS service
2. Add inter-service HTTP communication (API Gateway → Orchestration Service)
3. New Docker Compose entry, new port, new env vars
4. Requires explicit architecture change task and Keith approval

This extraction is NOT expected in the initial implementation phase.

---

## 7. Read-Only Collaboration Lifecycle

### 7.1 Start Collaboration

1. **Trigger:** Builder A's harness determines a subtask should be referred to Builder B during execution
2. **Worker emits referral request** to coordinator (mechanism: HTTP callback from worker to API Gateway orchestration endpoint, or BullMQ event — see §9)
3. **Coordinator validates** referral (depth, loop, safety limits, idempotency)
4. **Coordinator generates** `collaborationRunId` if this is the first referral in the workflow (the coordinator is the sole generator — neither frontend nor worker generates it)
5. **Coordinator stores** collaboration run metadata

### 7.2 Create / Assign collaborationRunId

- Generated once at collaboration initiation (when the first multi-builder referral is created)
- Immutable once generated — no re-generation mid-collaboration
- Propagated to ALL related jobs in the collaboration workflow
- If Builder A's execution is part of a single-builder workflow, `collaborationRunId` remains `undefined`
- Generated by: `OrchestrationService.createCollaborationRun()`

### 7.3 Create referralTraceId

- Generated at each referral step: Builder A → Builder B = one `referralTraceId`
- Each `referralTraceId` references a `parentReferralTraceId` (null for the first referral)
- Chain example: `A→B` has `referralTraceId: uuid-1, parentReferralTraceId: null`; `B→C` has `referralTraceId: uuid-2, parentReferralTraceId: uuid-1`
- Generated by: `OrchestrationService.createReferral()`

### 7.4 Builder A Request

1. Builder A (worker) identifies subtask requiring Builder B's capabilities
2. Builder A's harness creates a referral request containing: target builder profile, task description, context files, constraints
3. Referral request sent to coordinator

### 7.5 Builder B Read-Only Response

1. Coordinator creates Builder B session via `SessionService` (new session, same `projectId`)
2. Container-manager starts Builder B's container, initializes workspace from project archive
3. Coordinator enqueues Builder B job via `QueueService` with `collaborationRunId`, `referralTraceId`, `builderProfileId`, `isReferralExecution: true`
4. Worker picks up Builder B's job; resolves per-builder config; executes with read-only tools only
5. Builder B completes execution; result stored in usage record

### 7.6 Return / Handoff Behavior

- Builder B's result is returned to the coordinator (not directly to Builder A)
- Coordinator packages `ReferralResult` with `status`, `summary`, `outputFiles`, `duration_ms`
- Coordinator delivers result to Builder A's context
- Builder A resumes with Builder B's result available
- Async model: Builder A is not necessarily blocked during Builder B's execution (but may be in initial implementation for simplicity)

### 7.7 Completion Behavior

- When all referrals in a collaboration are resolved (completed, failed, cancelled, or timed_out), the coordinator marks the `CollaborationRun` as complete
- Coordinator emits `orchestration.collaboration_completed` event
- No automatic cleanup of Builder B sessions — session lifecycle managed independently

---

## 8. Referral Object Model

### 8.1 CollaborationReferral

```typescript
interface CollaborationReferral {
  readonly referralId: string;                    // UUID — unique referral identifier
  readonly collaborationRunId: string;            // UUID — groups all referrals in this collaboration
  readonly referralTraceId: string;               // UUID — this specific referral step
  readonly parentReferralTraceId: string | null;  // UUID — parent referral (null if first)
  readonly sourceAgent: CollaborationAgentIdentity;
  readonly targetAgent: CollaborationAgentIdentity;
  readonly referralType: 'subtask' | 'review' | 'assist';
  readonly taskDescription: string;
  readonly contextFiles: readonly string[];
  readonly constraints: ReferralConstraints;
  readonly status: ReferralStatus;
  readonly idempotencyKey: string;
  readonly createdAt: string;                     // ISO 8601
  readonly updatedAt: string;                     // ISO 8601
  readonly completedAt: string | null;
  readonly result: ReferralResult | null;
}

interface CollaborationAgentIdentity {
  readonly agentRole: string;
  readonly builderProfileId: string;
}

type ReferralStatus =
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

interface ReferralConstraints {
  readonly maxDurationMs: number;       // default: 300000 (5 min)
  readonly maxToolIterations: number;
  readonly readOnly: boolean;           // true for initial orchestration
  readonly allowedTools: readonly string[];
}

interface ReferralResult {
  readonly status: 'success' | 'partial' | 'failed';
  readonly summary: string;
  readonly outputFiles: readonly string[];
  readonly duration_ms: number;
}
```

### 8.2 CollaborationRun

```typescript
interface CollaborationRun {
  readonly collaborationRunId: string;         // UUID
  readonly userId: string;                     // Owner
  readonly projectId: string;                  // Shared project
  readonly initiatorAgent: CollaborationAgentIdentity;
  readonly status: CollaborationRunStatus;
  readonly referralIds: readonly string[];      // All referrals in this run
  readonly activeAgentProfileIds: readonly string[];
  readonly createdAt: string;                  // ISO 8601
  readonly updatedAt: string;                  // ISO 8601
  readonly completedAt: string | null;
  readonly timeoutMs: number;                  // default: 1800000 (30 min)
}

type CollaborationRunStatus =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'timed_out';
```

### 8.3 Idempotency Key

Computed as: `collaborationRunId` + `sourceAgent.builderProfileId` + `targetAgent.builderProfileId` + `referralType` + SHA-256(`taskDescription`).

Behavior:
- If a referral with the same idempotency key exists and is `in_progress` or `completed` → reject duplicate, return existing referral reference
- If the existing referral is `failed` or `cancelled` → allow retry (new `referralTraceId`)

---

## 9. Queue / Job Routing Model

### 9.1 Single Queue with Metadata Routing

As established by AGENT-PLATFORM-05 §6.3: use the existing `ai-execution` BullMQ queue. Jobs are distinguished by `builderProfileId` and `collaborationRunId` metadata on the job payload. No new queues, no new worker processes, no new BullMQ connections.

### 9.2 Required Future AiExecutionJob Fields

Currently present (AGENT-PLATFORM-06):
- `agentRole` — optional
- `builderProfileId` — optional
- `collaborationRunId` — optional
- `referralTraceId` — optional

Fields still needed for coordinator:

| Field | Type | Purpose |
|-------|------|---------|
| `parentReferralTraceId` | `string?` (UUID) | Links to parent referral in chain |
| `referringBuilderProfileId` | `string?` | Which builder triggered this job |
| `orchestrationPriority` | `number?` | Queue priority hint (higher = more urgent) |
| `referralId` | `string?` (UUID) | Links to specific referral record |
| `isReferralExecution` | `boolean?` | Distinguishes referred jobs from direct |

### 9.3 How Builder A / B Jobs Are Distinguished

| Field | Builder A (initiator) | Builder B (referred) |
|-------|----------------------|---------------------|
| `builderProfileId` | `'builder-default'` | `'builder-fullstack'` (example) |
| `collaborationRunId` | `uuid-1` | `uuid-1` (same) |
| `referralTraceId` | `null` or first step | Child referral UUID |
| `parentReferralTraceId` | `null` | Builder A's `referralTraceId` |
| `referringBuilderProfileId` | `null` (initiator) | `'builder-default'` |
| `isReferralExecution` | `false` | `true` |
| `referralId` | `null` | Referral record UUID |
| `orchestrationPriority` | `null` | Set by coordinator based on referral urgency |

The `WorkerProcessor` already resolves per-builder config via `resolveBuilderHarnessConfig()` using `builderProfileId`, so different builder profiles get different harness configurations (AGENT-HARNESS-07).

### 9.4 Ordering and Priority Rules

- Default priority: `0` (normal)
- Referred jobs may be assigned higher priority by the coordinator if the referring builder is blocked waiting
- BullMQ's built-in job priority mechanism handles ordering
- FIFO within the same priority level
- No preemption — running jobs are not interrupted for higher-priority arrivals

---

## 10. Session / Project / Container Ownership

### 10.1 1 Builder = 1 Session = 1 Container

This is the topology established by AGENT-PLATFORM-04 §4.1 and confirmed by AGENT-PLATFORM-05 §5.1. Each builder profile execution gets its own isolated environment:

| Resource | Isolation Level |
|----------|----------------|
| Workspace filesystem | Per-session — `workspaces/{sessionId}/` |
| Docker container | Per-session — each builder has own container |
| Container network | Per-session |
| Environment variables | Per-session |
| Git history | Per-session (independent commits, checkpoints) |
| Preview server | Per-session |
| Checkpoints | Per-session (reverts only the session's workspace) |
| Tool dispatch context | Per-session (tool results scoped to session's container) |
| SSE/streaming connection | Per-session |

### 10.2 Project Linkage

- Sessions link to projects via `projectId`
- Multiple sessions (from different builders) can share the same `projectId`
- Builder A session: `sessionId-A`, `containerId-A`, `workspacePath-A`
- Builder B session: `sessionId-B`, `containerId-B`, `workspacePath-B`
- Both share the same `projectId`
- No cross-session filesystem access

### 10.3 Per-Builder Session Creation

The coordinator creates Builder B's session using the existing `SessionService`:

1. `POST /api/sessions` with `{ projectId }` — creates session record
2. `POST /api/sessions/{sessionId}/start` — starts Docker container, initializes workspace from project archive
3. Builder B's workspace contains the project's current state (baseline files)
4. Session ownership: `userId` remains the human user who owns the project

Current session entity has no agent identity fields (`agentRole`, `builderProfileId`, `collaborationRunId`). Future task may add these columns — see §17.

### 10.4 Read-Only Context Sharing

Builder B can access project context through:

- Its own workspace copy (restored from project archive at session start)
- Coordinator-provided context in the referral's `contextFiles` and `taskDescription`
- No direct read access to Builder A's workspace

### 10.5 No Shared Workspace Writes

- Each builder writes only to its own `workspaces/{sessionId}/` directory
- No cross-session filesystem mutation
- No real-time file synchronization
- In initial read-only orchestration, neither builder writes at all — read-only tools only

---

## 11. Read-Only Context Sharing Model

### 11.1 Project Archive / Context Snapshot

When the coordinator creates Builder B's session, Builder B's workspace is initialized from the project archive. This is the same mechanism used when any session is created for a project — `container-manager` restores the workspace from the project's current state.

### 11.2 Repo Docs

Builder B can read repository documentation files via `read_file` tool calls against its own workspace. These are the same project files available to Builder A (at session creation time).

### 11.3 Selected Files / Search Results

The coordinator passes context to Builder B through the referral object:

- `taskDescription` — what Builder B should do
- `contextFiles` — list of file paths relevant to the subtask
- These are included in Builder B's job payload as part of `workspaceContext` or prompt enrichment

### 11.4 No Direct Write Sharing

- Builder B cannot write to Builder A's workspace
- Builder A cannot read Builder B's workspace changes
- Builder B's analysis results are returned as structured `ReferralResult` text, not as workspace file mutations
- In read-only mode, neither builder modifies any files

### 11.5 What Builder B Can See

| Source | Access |
|--------|--------|
| Project baseline files (via own workspace) | `list_files`, `read_file` |
| Coordinator-provided task description | In prompt/instructions |
| Coordinator-provided context file list | In `workspaceContext` or prompt |
| Builder A's runtime state | NOT accessible |
| Builder A's workspace changes | NOT accessible |
| Builder A's conversation history | NOT accessible |
| Other referrals in the collaboration | NOT accessible |

---

## 12. Cancel / Timeout Redesign

### 12.1 Critical Gap: Existing Cancel Is Ledger/Status-Based

The current `QueueService.cancelExecution(sessionId)` calls `this.queue.obliterate({ force: true })` — this cancels **ALL** jobs in the `ai-execution` queue, not just the jobs for a specific session. This is a critical gap for multi-builder orchestration.

### 12.2 Current Obliterate Incompatibility

| Problem | Impact |
|---------|--------|
| `obliterate()` destroys all queued jobs | Cancelling Builder A would cancel Builder B (and any unrelated executions) |
| No per-session job identification | Cannot target specific builder's jobs for cancellation |
| No per-collaboration cancel | Cannot cascade cancel all jobs with matching `collaborationRunId` |
| No per-referral cancel | Cannot cancel individual referred jobs on timeout |
| Worker has no abort mechanism | Worker cannot receive cancel signals mid-execution |

### 12.3 Required Per-Execution / Per-Referral Cancel Model

The cancel system must be redesigned to support:

**Per-session cancel:**
- Cancel all jobs with a specific `sessionId`
- Use BullMQ's `getJobs()` + filter by `sessionId` + `job.remove()` for waiting/delayed jobs
- For active (in-progress) jobs: set a cancel flag in Redis or a shared store that the worker checks periodically

**Per-referral cancel:**
- Cancel a specific referral's job by `referralId` or `referralTraceId`
- Coordinator updates referral status to `cancelled`
- Worker checks referral status before continuing execution

**Per-collaboration cancel (cascade):**
- Cancel ALL jobs with matching `collaborationRunId`
- Coordinator iterates all referrals in the collaboration, cancels each
- Coordinator marks collaboration as `cancelled`

### 12.4 Timeout Behavior

| Timer | Default | Scope | Action |
|-------|---------|-------|--------|
| Per-referral timeout | 300,000 ms (5 min) | Individual referral | Cancel Builder B's job; mark referral `timed_out`; notify Builder A |
| Collaboration-level timeout | 1,800,000 ms (30 min) | Entire `collaborationRunId` | Cascade cancel ALL related jobs; mark all referrals `timed_out` |
| Idle timeout | 120,000 ms (2 min) | Builder idle after receiving referral result | Notify owner; auto-terminate after grace period |

### 12.5 Cancellation Ownership Checks

- Only the collaboration owner (the `userId` who initiated the project) can cancel a collaboration
- The coordinator can cancel individual referrals (timeout, safety limit breach)
- The worker can self-cancel on internal error
- The frontend cancel button must be updated to cancel per-session instead of obliterating all jobs

### 12.6 Stop Conditions

| Condition | Behavior |
|-----------|----------|
| Builder B fails | `ReferralResult.status = 'failed'`; Builder A notified; may retry/abort/continue |
| Builder B times out | Job cancelled; referral `timed_out`; Builder A notified |
| Collaboration cancelled by owner | Cascade cancel all jobs via `collaborationRunId` |
| Builder A cancelled while Builder B running | Builder B continues (result discarded) unless cascade flag set |
| Builder A cancelled with cascade | Builder B also cancelled |
| Collaboration timeout (1800s) | All related jobs cancelled |
| Idle timeout (120s) | Owner notified; auto-terminate after grace |

### 12.7 Cancel Redesign Decision

**The `QueueService.cancelExecution()` method must be redesigned before coordinator implementation.** The current `obliterate()` approach is not compatible with multi-builder orchestration. This is a HIGH severity prerequisite.

Recommended approach:
1. Replace `obliterate()` with per-job cancellation via `getJobs()` + filter + `remove()`
2. Add a Redis-based cancel flag store keyed by `sessionId` and `collaborationRunId`
3. Worker polls cancel flag at tool dispatch boundaries (between harness iterations)
4. Coordinator manages cancel lifecycle with ownership verification

---

## 13. Safety Limits

### 13.1 Max Referral Depth: 3

- Default: `maxReferralDepth = 3`
- Configurable at platform level
- Enforcement: coordinator rejects referrals where `referralChainLength >= maxReferralDepth`
- Chain length calculated by traversing `parentReferralTraceId` links
- When depth = `maxReferralDepth - 1`: warn owner; next referral requires explicit approval

### 13.2 Max Agents: 4

- Default: `maxAgentsPerCollaboration = 4`
- Configurable at platform level
- Enforcement: coordinator rejects agent additions where `distinctBuilderProfileIds.length >= maxAgentsPerCollaboration`
- When active agents = `maxAgentsPerCollaboration - 1`: warn owner; next addition requires explicit approval

### 13.3 Duplicate Referral Idempotency

- Idempotency key: `collaborationRunId` + `sourceAgent.builderProfileId` + `targetAgent.builderProfileId` + `referralType` + SHA-256(`taskDescription`)
- If duplicate exists and is `in_progress` or `completed` → reject, return existing referral reference
- If duplicate is `failed` or `cancelled` → allow retry with new `referralTraceId`
- Requires a referral tracking store (in-memory or database) to check idempotency

### 13.4 Referral Loop Prevention

- Maintain ordered list of `builderProfileId` values in the referral chain
- Before creating a new referral, check if `targetAgent.builderProfileId` already appears in the chain
- If target already in chain → reject referral, log warning, return error to referring builder
- Examples:
  - A → B → C valid (chain: [A, B, C])
  - A → B → A invalid (A already in chain) — rejected
  - A → B → C → A invalid (A already in chain) — rejected

### 13.5 Owner Approval Boundaries

| Threshold | Action |
|-----------|--------|
| Referral depth = `maxReferralDepth - 1` | Warn owner; next referral requires explicit approval |
| Active agents = `maxAgentsPerCollaboration - 1` | Warn owner; next addition requires explicit approval |
| Collaboration duration > 80% of timeout | Warn owner; option to extend or cancel |
| Credit usage > per-collaboration budget threshold | Warn owner; option to approve or cancel |

### 13.6 Threshold Breach Behavior

When a safety limit is breached (not just approached):
- Coordinator rejects the action immediately
- Error returned to the referring builder's harness
- Audit event emitted with breach details
- Owner notification sent
- No automatic retry — requires owner action to override (if the limit is configurable)

---

## 14. Approval Model

### 14.1 Read-Only Default

All initial orchestration operates in read-only mode. No write tools are activated. This eliminates the most dangerous approval scenarios (file mutation, package install, env changes).

### 14.2 High-Risk Action Default Block

The following always require owner approval regardless of builder profile or orchestration context:

| Category | Reason |
|----------|--------|
| Legal commitments | Liability risk |
| Financial transactions | Monetary risk |
| Contract acceptance/modification | Binding obligation |
| Public-facing content publishing | Reputation risk |
| External communications | Unauthorized outreach |
| Permission/access changes | Security escalation |
| Data deletion (irreversible) | Data loss risk |

These are enforced at the platform level by `resolveBuilderHarnessConfig()` safety enforcement (AGENT-HARNESS-07).

### 14.3 No Write/Delete/Env/Package Action

In read-only orchestration:
- `write_file` → DISABLED (`enableWriteTools: false`)
- `delete_file` → DISABLED (`enableWriteTools: false`)
- `.env` file write → DISABLED + platform approval floor
- Package install → DISABLED + platform approval floor
- Large file write → DISABLED + platform approval floor

### 14.4 Orchestration-Level Approval Gates

| Event | Approval Type |
|-------|---------------|
| First referral in collaboration | Informational notification (no blocking) |
| Referral to new builder profile | Owner approval required |
| Safety threshold approached (§13.5) | Owner approval required to continue |
| Write tool activation (future) | Owner approval required per session |
| High-risk action (§14.2) | Platform-level approval required |
| Budget threshold exceeded | Owner approval required |

### 14.5 No AGENT-HARNESS Write Canary in This Task

Write tool activation, write canary validation, and write safety are explicitly **separate tracks**. They must not be mixed into AGENT-PLATFORM-07 coordinator work.

---

## 15. Audit and Observability

### 15.1 Proposed Orchestration Event Names

| Event Name | When |
|------------|------|
| `orchestration.collaboration_created` | New `collaborationRunId` generated |
| `orchestration.referral_created` | New referral step created |
| `orchestration.referral_approved` | Owner approves referral |
| `orchestration.referral_rejected` | Referral rejected (depth, loop, safety) |
| `orchestration.referral_started` | Builder B job enqueued |
| `orchestration.referral_completed` | Builder B returns result |
| `orchestration.referral_failed` | Builder B job failed |
| `orchestration.referral_cancelled` | Referral explicitly cancelled |
| `orchestration.referral_timed_out` | Per-referral timeout triggered |
| `orchestration.collaboration_completed` | All referrals resolved |
| `orchestration.collaboration_cancelled` | Owner or system cancels collaboration |
| `orchestration.collaboration_timed_out` | Collaboration-level timeout triggered |
| `orchestration.safety_limit_approached` | Threshold warning (depth, agent count, budget) |
| `orchestration.safety_limit_breached` | Hard limit reached, action rejected |

### 15.2 collaborationRunId in All Events

All events during a collaboration must carry `collaborationRunId`:

- Existing harness events (`agent_harness.config_resolved`, `harness.loop_started`, `harness.tool_dispatch_completed`, `harness.loop_completed`, `execution_completed`) — **currently ABSENT** (gap to be filled)
- Credit deduction events — **currently ABSENT** (gap to be filled)
- All new `orchestration.*` events — included by design

### 15.3 referralTraceId in All Events

Referral-specific events must carry `referralTraceId`:
- All `orchestration.referral_*` events
- Builder B's harness events during referred execution

### 15.4 Source / Target Builder Identity

All orchestration events carry both `sourceAgent` and `targetAgent`:

```typescript
interface OrchestrationAuditEvent {
  readonly eventType: string;
  readonly collaborationRunId: string;
  readonly referralTraceId: string;
  readonly sourceAgent: CollaborationAgentIdentity;
  readonly targetAgent: CollaborationAgentIdentity;
  readonly timestamp: string;          // ISO 8601
  readonly payload: Record<string, unknown>;
}
```

### 15.5 Queue Lifecycle Events

| Event | Payload |
|-------|---------|
| `orchestration.referral_started` | `{ referralId, jobId, targetSessionId, targetBuilderProfileId }` |
| `orchestration.referral_completed` | `{ referralId, jobId, result, durationMs }` |
| `orchestration.referral_failed` | `{ referralId, jobId, error, durationMs }` |
| `orchestration.referral_timed_out` | `{ referralId, jobId, timeoutMs }` |

### 15.6 Failure / Cancel / Timeout Events

| Event | Payload |
|-------|---------|
| `orchestration.referral_cancelled` | `{ referralId, cancelledBy, reason }` |
| `orchestration.collaboration_cancelled` | `{ collaborationRunId, cancelledBy, reason, affectedReferrals }` |
| `orchestration.collaboration_timed_out` | `{ collaborationRunId, timeoutMs, affectedReferrals }` |
| `orchestration.safety_limit_breached` | `{ limitType, currentValue, maxValue, action }` |

---

## 16. Usage / Billing Attribution Readiness

### 16.1 What AGENT-PLATFORM-06 Already Enables

- `agentRole` stored in `usage_records.metadata` JSONB at intent write and worker finalization
- `builderProfileId` stored in `usage_records.metadata` JSONB at intent write and worker finalization
- Per-builder attribution is possible for single-builder executions

### 16.2 Per-Builder Metadata Attribution

Each builder's execution in a collaboration carries `agentRole` and `builderProfileId` through the full path. Credit deductions can be attributed to the specific builder profile that consumed resources. Aggregate billing remains at `userId` level.

### 16.3 collaborationRunId / referralTraceId Implications

- `collaborationRunId` on usage records → enables per-collaboration cost analysis
- `referralTraceId` on usage records → enables per-referral cost breakdown
- Both are NOT yet stored in usage records (type-level placeholders only)
- Must be added to worker finalization `nextMetadata` when coordinator populates them on job payloads

### 16.4 Billing Enforcement Deferred

No billing enforcement in AGENT-PLATFORM-07:
- No per-builder credit limits
- No per-collaboration budget caps (enforcement)
- No entitlement gating based on builder profile
- No Stripe/payment integration for multi-builder billing
- All deferred to BILLING-READY-04+ family

---

## 17. Persistence Model Options

### 17.1 No Migration in AGENT-PLATFORM-07

This planning task does not create any database migration. Persistence model decisions here inform future implementation tasks.

### 17.2 Metadata JSONB Short-Term Option

Store `CollaborationRun` and `CollaborationReferral` data in the existing `usage_records.metadata` JSONB column or in a new in-memory store within the API Gateway process.

| Aspect | Assessment |
|--------|-----------|
| Pros | No migration; fast to implement; backward-compatible; sufficient for initial audit/debugging |
| Cons | Not queryable via SQL for reporting; lost on API Gateway restart (if in-memory); no relational integrity |
| Durability | In-memory: volatile. JSONB: durable but denormalized |

### 17.3 Future Table Option

Create dedicated tables: `collaboration_runs` and `collaboration_referrals`.

| Aspect | Assessment |
|--------|-----------|
| Pros | Proper relational model; SQL-queryable; durable; supports reporting; foreign key integrity |
| Cons | Requires TypeORM migration; more implementation work; schema design must be stable before migration |
| When needed | When SQL-based collaboration reporting or dashboard queries are required |

Possible future schema:

```sql
CREATE TABLE collaboration_runs (
  collaboration_run_id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  initiator_agent_role VARCHAR(50) NOT NULL,
  initiator_builder_profile_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  timeout_ms INTEGER NOT NULL DEFAULT 1800000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE collaboration_referrals (
  referral_id UUID PRIMARY KEY,
  collaboration_run_id UUID NOT NULL REFERENCES collaboration_runs(collaboration_run_id),
  referral_trace_id UUID NOT NULL,
  parent_referral_trace_id UUID,
  source_agent_role VARCHAR(50) NOT NULL,
  source_builder_profile_id VARCHAR(100) NOT NULL,
  target_agent_role VARCHAR(50) NOT NULL,
  target_builder_profile_id VARCHAR(100) NOT NULL,
  referral_type VARCHAR(50) NOT NULL,
  task_description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
  idempotency_key VARCHAR(255) NOT NULL,
  target_session_id VARCHAR(255),
  target_job_id VARCHAR(255),
  max_duration_ms INTEGER NOT NULL DEFAULT 300000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result_status VARCHAR(50),
  result_summary TEXT,
  result_duration_ms INTEGER,
  UNIQUE (idempotency_key)
);
```

### 17.4 Recommendation for First Implementation Slice

**Start with in-memory store + JSONB metadata for initial implementation. Defer dedicated tables to a later slice.**

Rationale:
- In-memory store is sufficient for initial read-only orchestration (collaborations are transient)
- JSONB metadata on usage records provides audit trail without migration
- If the coordinator proves stable, migrate to dedicated tables for reporting
- Avoids premature schema commitment

---

## 18. API Surface Proposal

### 18.1 Internal Coordinator Methods

These are internal methods on `OrchestrationService` — not HTTP endpoints initially:

| Method | Input | Output |
|--------|-------|--------|
| `createCollaborationRun(userId, projectId, initiatorAgent)` | User/project/initiator identity | `CollaborationRun` |
| `createReferral(collaborationRunId, sourceAgent, targetAgent, taskDescription, contextFiles, constraints)` | Referral details | `CollaborationReferral` |
| `validateReferral(collaborationRunId, targetAgent, referralChain)` | Depth/loop/safety check | `{ valid, errors }` |
| `approveReferral(referralId, approvedBy)` | Approval action | Updated `CollaborationReferral` |
| `rejectReferral(referralId, rejectedBy, reason)` | Rejection action | Updated `CollaborationReferral` |
| `startReferralExecution(referralId)` | Session creation + job enqueue | `{ sessionId, jobId }` |
| `completeReferral(referralId, result)` | Result delivery | Updated `CollaborationReferral` |
| `failReferral(referralId, error)` | Failure recording | Updated `CollaborationReferral` |
| `cancelReferral(referralId, cancelledBy, reason)` | Per-referral cancel | Updated `CollaborationReferral` |
| `cancelCollaboration(collaborationRunId, cancelledBy, reason)` | Cascade cancel | Updated `CollaborationRun` + all referrals |
| `getCollaborationRun(collaborationRunId)` | Lookup | `CollaborationRun` |
| `getReferral(referralId)` | Lookup | `CollaborationReferral` |
| `getReferralChain(collaborationRunId)` | Chain reconstruction | `CollaborationReferral[]` |

### 18.2 Possible Future API Gateway Endpoints

When the coordinator needs to be invoked externally (e.g., from frontend or inter-service):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/internal/orchestration/collaborations` | POST | Start a new collaboration |
| `/api/internal/orchestration/collaborations/:id` | GET | Get collaboration status |
| `/api/internal/orchestration/collaborations/:id/cancel` | POST | Cancel entire collaboration |
| `/api/internal/orchestration/referrals` | POST | Create a new referral |
| `/api/internal/orchestration/referrals/:id` | GET | Get referral status |
| `/api/internal/orchestration/referrals/:id/approve` | POST | Approve a pending referral |
| `/api/internal/orchestration/referrals/:id/cancel` | POST | Cancel a specific referral |

These are **internal** endpoints — not public. They should use the existing `X-Internal-Service-Key` guard or equivalent auth.

### 18.3 No Public UI Required Initially

The coordinator operates entirely through internal service methods and inter-service endpoints. No frontend UI is required for the initial implementation. The frontend will continue to use the existing `POST /api/ai/execute` endpoint — the coordinator intervenes transparently when a referred job is created.

### 18.4 Ownership / Auth Checks Required

All coordinator operations must verify:
- `userId` matches the project/collaboration owner
- `X-Internal-Service-Key` for inter-service calls
- Session ownership for session-scoped operations
- No cross-user collaboration access

---

## 19. Failure Modes

### 19.1 Builder B Fails

- Builder B's job fails (harness error, provider error, tool error)
- Worker reports failure via usage record finalization
- Coordinator detects failure, updates referral status to `failed`
- Coordinator packages `ReferralResult { status: 'failed', summary: errorMessage }`
- Builder A receives failure notification; may retry, abort, or continue without result
- Audit event: `orchestration.referral_failed`

### 19.2 Referral Timeout

- Per-referral timer (300s default) expires
- Coordinator attempts to cancel Builder B's active job
- Referral status updated to `timed_out`
- Builder A receives timeout notification
- Audit event: `orchestration.referral_timed_out`

### 19.3 Duplicate Referral

- Builder A submits a referral with the same idempotency key as an existing `in_progress` or `completed` referral
- Coordinator rejects the duplicate, returns the existing referral reference
- No new job enqueued
- Audit event: `orchestration.referral_rejected` with `reason: 'duplicate'`

### 19.4 Loop Detected

- Builder A requests referral to a builder profile already in the referral chain
- Coordinator rejects the referral immediately
- Error returned to Builder A's harness
- Audit event: `orchestration.referral_rejected` with `reason: 'loop_detected'`

### 19.5 Session Unavailable

- Coordinator attempts to create Builder B's session but `SessionService` fails
- Referral status updated to `failed` with session creation error
- Builder A notified of failure
- No job enqueued
- Audit event: `orchestration.referral_failed` with `reason: 'session_creation_failed'`

### 19.6 Queue Failure

- Coordinator successfully creates Builder B's session but `QueueService.enqueueExecution()` fails
- Session may need cleanup (stop container)
- Referral status updated to `failed` with queue error
- Builder A notified
- Audit event: `orchestration.referral_failed` with `reason: 'enqueue_failed'`

### 19.7 Partial Completion

- Builder B partially completes work before failure or timeout
- `ReferralResult { status: 'partial', summary: partialResults }`
- Builder A receives partial results and decides how to proceed
- No automatic retry for partial completion

---

## 20. Recommended Implementation Sequence

The following are **future child tasks, not yet registered**. Registration requires Keith approval.

### 20.1 AGENT-PLATFORM-07A — Coordinator Contracts / Schema

| Field | Value |
|-------|-------|
| Nature | Implementation — TypeScript types only |
| Risk | Low |
| Scope | `CollaborationRun`, `CollaborationReferral`, `ReferralResult`, `ReferralConstraints`, `ReferralStatus`, `CollaborationRunStatus`, `OrchestrationAuditEvent` types. No service logic, no module, no endpoints. |
| Files touched | New: `services/api-gateway/src/orchestration/orchestration.contracts.ts` |
| Dependencies | None beyond existing types |

### 20.2 AGENT-PLATFORM-07B — API Gateway Orchestration Module Skeleton

| Field | Value |
|-------|-------|
| Nature | Implementation — NestJS module + service skeleton |
| Risk | Medium |
| Scope | `OrchestrationModule`, `OrchestrationService` with method stubs, module registration in `AppModule`, in-memory referral store. No active orchestration yet. |
| Files touched | New: `services/api-gateway/src/orchestration/orchestration.module.ts`, `orchestration.service.ts`; Modified: `app.module.ts` |
| Dependencies | AGENT-PLATFORM-07A contracts |

### 20.3 AGENT-PLATFORM-07C — Read-Only Referral Enqueue Flow

| Field | Value |
|-------|-------|
| Nature | Implementation — active orchestration |
| Risk | High |
| Scope | `createReferral()`, `validateReferral()`, `startReferralExecution()` (session creation + job enqueue), `completeReferral()`, result delivery. Cancel redesign (`QueueService` improvements). Worker-to-coordinator communication mechanism. |
| Files touched | `orchestration.service.ts`, `queue.service.ts` (cancel redesign), `worker.processor.ts` (referral request mechanism), new `AiExecutionJob` fields |
| Dependencies | AGENT-PLATFORM-07A, 07B, cancel redesign |

### 20.4 AGENT-PLATFORM-07D — Collaboration Audit Events

| Field | Value |
|-------|-------|
| Nature | Implementation — audit/observability |
| Risk | Low |
| Scope | Emit all `orchestration.*` events, add `collaborationRunId`/`referralTraceId` to existing harness events, structured event logging |
| Files touched | `orchestration.service.ts`, `worker.processor.ts` (event enrichment) |
| Dependencies | AGENT-PLATFORM-07A, 07B |

### 20.5 AGENT-PLATFORM-07E — Read-Only Coordinator Canary

| Field | Value |
|-------|-------|
| Nature | Runtime canary — controlled execution |
| Risk | High |
| Scope | End-to-end validation: Builder A refers to Builder B; Builder B reads files in its own session; result returned to coordinator. Process-scoped env, `test-harness-stub` provider, zero billing. |
| Files touched | New canary script; validation doc |
| Dependencies | AGENT-PLATFORM-07A, 07B, 07C, 07D |

### 20.6 AGENT-HARNESS Write Canary — Separate Track

The AGENT-HARNESS write canary (single-builder write tool activation) is **not part of AGENT-PLATFORM-07**. It must be registered, planned, and executed as a separate task family. Write canary must be validated before any multi-builder write orchestration.

---

## 21. UX/UI Future Constraints

### 21.1 No UI Expected Now

AGENT-PLATFORM-07 is a planning task. No user-facing UI is created or modified.

### 21.2 Future UI Text Requirements

When future implementation tasks add user-facing UI for orchestration, aiSandBox is **multilingual-first** and must update:

- `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`

### 21.3 Translation Hooks

Use existing translation hook/pattern (`useTranslations` / `next-intl`). Do NOT add hardcoded English UI copy.

### 21.4 Icons

**Heroicons v2 Outline only** for any future orchestration UI icons.

### 21.5 Design Skills

Impeccable and Emil Kowalski design engineering skills are **advisory only** — must not override governance, scope, architecture, or tests.

### 21.6 Potential Future UI Surfaces

| Surface | Description |
|---------|-------------|
| Builder profile selector | Choose which builder to use for a task |
| Collaboration status indicator | Show active collaboration, participating builders, progress |
| Referral chain visualization | Show referral depth, source → target flow |
| Per-builder attribution in usage dashboard | Show cost/usage breakdown per builder profile |
| Approval gate UI | Approve/reject pending referral actions |
| Collaboration history | Past collaborations with results and audit trail |
| Cancel collaboration button | Per-collaboration cancel (replaces obliterate-all) |

All future UI text must follow the multilingual-first rule.

---

## 22. Readiness Conclusion

### 22.1 AGENT-PLATFORM-07 Step 3 Status

**COMPLETE — Read-Only Orchestration Coordinator Plan Document created with all 22 sections.**

### 22.2 Ready for Step 4 Consolidation?

**YES — AGENT-PLATFORM-07 is ready for Step 4 (Consolidation/Checkpoint).**

### 22.3 Blockers

**None for planning completion.** All implementation risks are documented and addressable in future child tasks.

| Risk | Severity | Status |
|------|----------|--------|
| Cancel redesign complexity | HIGH | Documented in §12; must be addressed in AGENT-PLATFORM-07C |
| Coordinator–worker communication model | MEDIUM | Documented in §7, §9; architecture decision needed in 07B/07C |
| Referral tracking persistence | MEDIUM | Documented in §17; in-memory first, tables later |
| Builder B session creation latency | LOW | Container startup takes seconds; referral flow accounts for this |
| Worker referral mechanism (no existing mechanism) | MEDIUM | Worker needs a new mechanism to request referrals mid-execution |
| JSONB metadata limitations | LOW | Sufficient for initial audit; proper columns deferred |
| Scope creep into write canary | LOW | Strict boundary maintained; write canary is separate track |

### 22.4 Next Recommended Task (Not Registered)

**AGENT-PLATFORM-07 Step 4 — Consolidation/Checkpoint.**

After consolidation, the recommended first implementation child slice is **AGENT-PLATFORM-07A — Coordinator Contracts/Schema** (TypeScript types only, low risk). Registration requires Keith approval.

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coordinator boundary | Separate `orchestration/` module within API Gateway | Preserves service topology; reuses existing services; extractable later |
| Initial orchestration mode | Read-only | Safety first; write tools not validated for multi-builder |
| Queue routing | Single `ai-execution` queue with metadata routing | Simplest; uses existing BullMQ; no infrastructure changes |
| Session isolation | 1 builder = 1 session = 1 container | Preserves AGENT-PLATFORM-04 topology |
| Cancel redesign | Required — replace `obliterate()` with per-job cancellation | Current approach incompatible with multi-builder |
| Persistence model | In-memory first, JSONB metadata for audit, dedicated tables later | Avoids premature schema commitment |
| Referral model | Async referral with explicit approval gates | Prevents runaway chains; owner retains control |
| Safety limits | Max depth 3, max agents 4, loop prevention, idempotency | Prevents resource exhaustion and referral loops |
| Billing enforcement | Deferred to BILLING-READY-04+ | Attribution designed; enforcement separate |
| Write canary | Separate track — not part of AGENT-PLATFORM-07 | Strict boundary; write activation needs own canary |
| Implementation sequence | 5 child slices (07A–07E) | Incremental; each slice is independently validatable |

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-07 Step 3 — Read-Only Orchestration Coordinator Plan Document
- **Status:** Step 3 COMPLETE
- **Author:** AI-assisted governance pass
- **Source:** AGENT-PLATFORM-07 Source-Path Review (Step 2), AGENT-PLATFORM-05 Orchestration Plan, AGENT-PLATFORM-06 Checkpoint, AGENT-PLATFORM-04 Topology Plan, AGENT-HARNESS-07 Checkpoint, AGENT-HARNESS-06E Checkpoint
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md
