# AGENT-PLATFORM-05 — Multi-Builder Runtime Orchestration Plan

**Task ID:** AGENT-PLATFORM-05
**Status:** Step 3 COMPLETE — Orchestration Plan Created (2026-07-09)
**Family:** AGENT PLATFORM / MULTI-BUILDER ORCHESTRATION
**Nature:** ARCHITECTURE / PLANNING / GOVERNANCE — no implementation
**Scope:** Documentation only — no source edits, no runtime changes, no checkpoint

---

## 1. Task Summary

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-05 |
| Step | 3 — Multi-Builder Orchestration Plan Document |
| Nature | Planning/governance only |
| Implementation | NONE — this document defines orchestration architecture for future implementation tasks |
| Runtime execution | NONE — no services started, no jobs executed, no containers created |
| Keith approval | Registration approved 2026-07-09 |

This plan defines how multiple Builder profiles collaborate safely within the ainow.biz platform. It establishes identity propagation, routing, session ownership, referral protocols, safety limits, write deferral, audit attribution, and the recommended implementation sequence for future tasks.

---

## 2. Foundation Summary

### 2.1 AGENT-PLATFORM-04 — Role + Profile Identity Model

Established in `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` (COMPLETE and LOCKED 2026-07-07):

- **agentRole:** Stable role category (`builder`, `chief-of-staff`, `product-strategy`, `technology-advisor`)
- **builderProfileId:** Specific Builder profile within the `builder` role (e.g., `builder-default`, `builder-fullstack`)
- Identity model is orthogonal: role × profile
- Session isolation: 1 builder profile execution = 1 session = 1 container
- Shared workspace writes explicitly deferred
- Non-Builder agents use `agentRole` only (no `builderProfileId`)

### 2.2 AGENT-HARNESS-07 — Per-Builder Config Path

Implemented in `services/ai-service/src/agent-harness/builder-profiles/` (COMPLETE and LOCKED 2026-07-07):

- V1 typed contracts: `BuilderProfileV1`, `BuilderHarnessProfileV1`, `BuilderHarnessConfigAdapterResultV1`
- Static `DEFAULT_BUILDER_PROFILE_V1` (`builderProfileId: 'builder-default'`, `agentRole: 'builder'`)
- `resolveBuilderHarnessConfig()` — pure function, per-builder config resolution with global fallback
- Platform safety enforcement: approval floors cannot be weakened, `allowArbitraryShell` platform veto
- `WorkerProcessor` calls adapter before harness dispatch; resolved config used throughout

### 2.3 AGENT-HARNESS-06E — Full E2E Read-Only File Path Validated

Validated in `docs/AGENT-HARNESS-06E-CHECKPOINT.md` (COMPLETE and LOCKED 2026-07-09):

- Full service chain: Worker → ToolDispatcher → file-tool-handlers → ApiGatewayHttpClient → API Gateway → container-manager → Docker container filesystem
- `list_files` SUCCESS (actual file entries returned)
- `read_file` SUCCESS (actual file content returned)
- Provider: `test-harness-stub` (zero billing)
- Write tools disabled; validation tools disabled; browser smoke disabled

---

## 3. Orchestration Goal

### 3.1 Primary Objective

Support multiple Builder profiles collaborating safely on a shared project without data loss, resource exhaustion, or uncontrolled scope escalation.

### 3.2 Initial Stance

**Read-only orchestration first.** The initial multi-builder orchestration phase allows:

- Builder A: read-only tools (`list_files`, `read_file`)
- Builder B: read-only tools (`list_files`, `read_file`)
- Collaboration: referral routing, identity metadata passing, audit event creation
- No shared workspace writes

### 3.3 Write Deferral

Shared workspace writes are explicitly deferred until:

1. Write tool activation canary is validated (single builder, controlled session)
2. Write safety model is designed and approved
3. Conflict resolution strategy is defined and tested
4. Write canary is executed successfully in isolation before multi-builder write activation

---

## 4. Identity Model

### 4.1 Per-Execution Identity Fields

Every multi-builder orchestration execution carries:

| Field | Type | Purpose |
|-------|------|---------|
| `agentRole` | `string` | Role discriminator — `builder`, `chief-of-staff`, etc. |
| `builderProfileId` | `string` | Specific builder profile identity — `builder-default`, `builder-fullstack`, etc. |
| `collaborationRunId` | `string (UUID)` | Groups all executions in a single multi-builder collaboration workflow |
| `referralTraceId` | `string (UUID)` | Traces individual referral steps; forms parent→child chain |
| `sourceAgent` | `{ agentRole, builderProfileId }` | Identity of the builder that initiated the referral |
| `targetAgent` | `{ agentRole, builderProfileId }` | Identity of the builder that receives the referral |

### 4.2 collaborationRunId Semantics

- Generated once at collaboration initiation (when the first multi-builder referral is created)
- Propagated through ALL related jobs in the collaboration workflow
- Stored on `UsageRecord`, `CreditDeductionRecord`, and audit events
- Nullable on all database columns (backward-compatible with single-builder executions)
- Immutable once generated — no re-generation mid-collaboration

### 4.3 referralTraceId Semantics

- Generated at each referral step (Builder A → Builder B = one referralTraceId)
- Forms a chain: each referralTraceId references a `parentReferralTraceId` (null for the first referral)
- Used for:
  - Chain reconstruction (audit trail)
  - Depth calculation (count chain length for max depth enforcement)
  - Loop detection (check if target is already in the referral chain)
- Stored on job payload, audit events, and deduction records

### 4.4 sourceAgent / targetAgent Identity

```typescript
interface CollaborationAgentIdentity {
  readonly agentRole: string;
  readonly builderProfileId: string;
}
```

- `sourceAgent`: the builder profile that initiates a referral
- `targetAgent`: the builder profile that receives and executes the referred work
- Both stored on referral objects, audit events, and tracing metadata

---

## 5. Initial Orchestration Topology

### 5.1 Core Rule

**1 builder profile execution = 1 session = 1 container.**

| Property | Value |
|----------|-------|
| Session-to-builder-profile | 1:1 per active execution |
| Container-to-session | 1:1 |
| Workspace-to-session | 1:1 |
| File operations scope | Session-scoped |
| Preview scope | Session-scoped |
| Checkpoint/revert scope | Session-scoped |
| Git operations scope | Session-scoped |

### 5.2 Single Shared Project Context

- Multiple builder sessions can be linked to the same `projectId`
- Each builder operates in its own workspace copy (separate `workspaces/{sessionId}/`)
- Project-level integration (merging results) occurs after individual builder completion
- No real-time shared filesystem between concurrent builder sessions

### 5.3 No Shared Workspace Writes Initially

- Builder A and Builder B each have isolated workspaces
- No cross-session file mutation
- No real-time file synchronization between builders
- Integration happens at the project level (post-completion merge)

### 5.4 Read-Only Cross-Builder Context Sharing

Initial orchestration allows:

- Builder B can read project files via its own session (restored from project archive)
- Builder A's work results can be committed to the project before Builder B starts
- Sequential builder execution is the safe default (Builder A completes → project updated → Builder B starts with updated project state)
- Concurrent read-only context sharing is safe (both builders read the same project baseline)

---

## 6. Builder A/B Routing Model

### 6.1 How Builder A and Builder B Jobs Are Distinguished

Jobs are distinguished by their `builderProfileId` field on `AiExecutionJob`:

| Field | Builder A | Builder B |
|-------|-----------|-----------|
| `agentRole` | `'builder'` | `'builder'` |
| `builderProfileId` | `'builder-default'` | `'builder-fullstack'` (example) |
| `collaborationRunId` | Same UUID | Same UUID |
| `referralTraceId` | First referral UUID | Child referral UUID |
| `referringBuilderProfileId` | `null` (initiator) | `'builder-default'` (referred by A) |

### 6.2 Queue/Job Metadata Required

New fields on `AiExecutionJob` for orchestration routing:

| Field | Type | Purpose |
|-------|------|---------|
| `collaborationRunId` | `string?` (UUID) | Groups related jobs |
| `referralTraceId` | `string?` (UUID) | Traces referral chain |
| `parentReferralTraceId` | `string?` (UUID) | Links to parent referral |
| `referringBuilderProfileId` | `string?` | Which builder triggered this job |
| `orchestrationPriority` | `number?` | Queue priority hint (higher = more urgent) |

### 6.3 Recommendation: Single Queue with Metadata Routing

**Initial implementation: same `ai-execution` BullMQ queue, metadata-based routing.**

Rationale:

- Simplest architecture — no queue infrastructure changes required
- `WorkerProcessor` already resolves per-builder config from `builderProfileId` on job data
- Adding orchestration metadata to existing job type is backward-compatible (optional fields)
- Priority can be handled via BullMQ's built-in job priority mechanism
- No new queue creation, no new worker process, no new connection management

### 6.4 When Separate Queues Might Be Needed Later

Separate per-profile queues should be considered only when:

- Different builder profiles need independent concurrency limits (e.g., Builder A: 3 concurrent, Builder B: 1 concurrent)
- Different builder profiles need independent rate limiting that cannot be expressed via job priority
- Resource isolation between profiles is required at the queue infrastructure level
- The single queue becomes a bottleneck due to high collaboration volume

This is **not needed** for initial orchestration. Defer to a future implementation task if volume warrants it.

---

## 7. Session/Workspace/Container Ownership

### 7.1 Per-Builder Session Ownership

| Property | Model |
|----------|-------|
| Session owner | `userId` (human user who initiated the project) |
| Session executor | `builderProfileId` (which builder profile is operating in this session) |
| Session creation trigger | Orchestration coordinator (or frontend if single-builder) |

Future `sessions` table additions (design only — no migration in this task):

- `agent_role` — nullable, populated when session is created for a builder execution
- `builder_profile_id` — nullable, populated when session is created for a builder execution
- `collaboration_run_id` — nullable, links session to a collaboration workflow

### 7.2 Project Linkage

- Sessions link to projects via `project_id`
- Multiple sessions (from different builders) can share the same `project_id`
- Each session gets its own workspace directory, container, and git history
- The project represents the shared artifact; sessions represent isolated execution environments

### 7.3 Workspace Isolation

| Aspect | Behavior |
|--------|----------|
| File system | Fully isolated per session (`workspaces/{sessionId}/`) |
| Git history | Per-session (independent commits, checkpoints) |
| Container | Per-session Docker container |
| Network | Per-session network isolation (existing model) |
| Environment variables | Per-session |

### 7.4 Preview/Checkpoint Scope

- Preview server: per-session (each builder's preview reflects its own workspace state)
- Checkpoints: per-session git commits
- Revert: per-session (reverts only the session's workspace, not other builders')
- File tree: per-session workspace only

### 7.5 Shared Workspace Write Deferral

Shared workspace writes (multiple builders writing to the same workspace simultaneously) require:

1. Write lock protocol (file-level or directory-level)
2. Conflict detection strategy
3. Notification/sync mechanism between concurrent sessions
4. Merge strategy for divergent workspace states
5. Ordering semantics for sequential vs concurrent writes

**All of the above are explicitly deferred.** Initial orchestration uses separate sessions with project-level integration only.

---

## 8. Referral/Collaboration Flow

### 8.1 Builder A Requests Help from Builder B

Collaboration lifecycle:

```
1. Builder A identifies subtask requiring Builder B's capabilities
2. Builder A creates a Referral Request
3. Orchestration coordinator validates the referral
4. Owner approval gate (if required by policy)
5. Orchestration coordinator creates Builder B session
6. Builder B executes its scoped work
7. Builder B returns result to orchestration coordinator
8. Orchestration coordinator delivers result to Builder A
9. Builder A continues with Builder B's result
```

### 8.2 Referral Object Shape (Conceptual)

```typescript
interface CollaborationReferral {
  readonly referralId: string;                    // UUID — unique referral identifier
  readonly collaborationRunId: string;           // UUID — groups all referrals in this collaboration
  readonly referralTraceId: string;              // UUID — this specific referral step
  readonly parentReferralTraceId: string | null; // UUID — parent referral (null if first)
  readonly sourceAgent: CollaborationAgentIdentity;
  readonly targetAgent: CollaborationAgentIdentity;
  readonly referralType: 'subtask' | 'review' | 'assist';
  readonly taskDescription: string;              // What Builder B should do
  readonly contextFiles: readonly string[];      // Files relevant to the subtask
  readonly constraints: ReferralConstraints;     // Time/scope/safety limits
  readonly status: ReferralStatus;
  readonly createdAt: string;                    // ISO 8601
  readonly completedAt: string | null;
  readonly result: ReferralResult | null;
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
  readonly maxDurationMs: number;
  readonly maxToolIterations: number;
  readonly readOnly: boolean;        // true for initial orchestration
  readonly allowedTools: readonly string[];
}

interface ReferralResult {
  readonly status: 'success' | 'partial' | 'failed';
  readonly summary: string;
  readonly outputFiles: readonly string[];  // Files created/modified by Builder B
  readonly duration_ms: number;
}
```

### 8.3 Approval Points

| Trigger | Approval Required |
|---------|-------------------|
| First referral in a collaboration | Owner notification (informational) |
| Referral to a builder profile not previously used | Owner approval required |
| Referral depth > configurable threshold (default: 2) | Owner approval required |
| Referral involving write tools | Owner approval required (when writes are enabled) |
| Referral involving high-risk actions (§12) | Platform-level approval required |
| Budget threshold exceeded | Owner approval required |

### 8.4 Return/Handoff Behavior

- Builder B completes → result delivered to orchestration coordinator
- Orchestration coordinator packages `ReferralResult` and returns it to Builder A's context
- Builder A resumes its execution with Builder B's result available as context
- Builder A is not blocked during Builder B's execution (async referral) unless explicitly declared as blocking

### 8.5 Cancellation/Failure Behavior

| Scenario | Behavior |
|----------|----------|
| Builder B fails | Result status = `failed`; Builder A receives failure notification; Builder A may retry, abort, or continue without result |
| Builder B times out | Result status = `timed_out`; Builder B's job cancelled; Builder A notified |
| Collaboration cancelled by owner | All related jobs cancelled; cascade cancel via `collaborationRunId` |
| Builder A cancelled while Builder B running | Builder B continues (its result is discarded); no cascade by default |
| Builder A cancelled with cascade flag | Builder B also cancelled |

---

## 9. Safety Limits

### 9.1 Max Referral Depth

| Parameter | Default | Configurable |
|-----------|---------|--------------|
| `maxReferralDepth` | 3 | Yes — platform-level, per-collaboration override with owner approval |

Enforcement: orchestration coordinator rejects referrals where `referralChainLength >= maxReferralDepth`. Returns error to referring builder.

### 9.2 Max Agents Per Collaboration

| Parameter | Default | Configurable |
|-----------|---------|--------------|
| `maxAgentsPerCollaboration` | 4 | Yes — platform-level |

Enforcement: orchestration coordinator rejects agent additions where `distinctBuilderProfileIds.length >= maxAgentsPerCollaboration`. Returns error to referring builder.

### 9.3 Duplicate Referral Idempotency

Idempotency key: `collaborationRunId` + `sourceAgent.builderProfileId` + `targetAgent.builderProfileId` + `referralType` + `taskDescription hash`

Behavior:
- If a referral with the same idempotency key already exists and is `in_progress` or `completed` → reject duplicate, return existing referral reference
- If the existing referral is `failed` or `cancelled` → allow retry (new `referralTraceId`)

### 9.4 Referral Loop Prevention

Chain path tracking:
- Maintain ordered list of `builderProfileId` values in the referral chain
- Before creating a new referral, check if `targetAgent.builderProfileId` already appears in the current chain
- If target is already in the chain → reject referral, log warning, return error to referring builder

Example:
- A → B → C is valid (chain: [A, B, C])
- A → B → A is invalid (A already in chain) — rejected
- A → B → C → A is invalid (A already in chain) — rejected

### 9.5 Timeout/Cancel Behavior

| Timer | Default | Scope |
|-------|---------|-------|
| Per-referral timeout | 300,000 ms (5 min) | Individual referral |
| Collaboration-level timeout | 1,800,000 ms (30 min) | Entire `collaborationRunId` |
| Idle timeout | 120,000 ms (2 min) | Builder idle after receiving referral result |

Timeout actions:
- Per-referral timeout → cancel the specific Builder B job, mark referral `timed_out`
- Collaboration timeout → cascade cancel ALL related jobs, mark all referrals `timed_out`
- Idle timeout → notify owner; auto-terminate after grace period

### 9.6 Owner Approval on Threshold Breach

When any safety limit is approached (but not yet exceeded):

| Threshold | Action |
|-----------|--------|
| Referral depth = `maxReferralDepth - 1` | Warn owner; next referral requires explicit approval |
| Active agents = `maxAgentsPerCollaboration - 1` | Warn owner; next addition requires explicit approval |
| Collaboration duration > 80% of timeout | Warn owner; option to extend or cancel |
| Credit usage > per-collaboration budget threshold | Warn owner; option to approve continuation or cancel |

---

## 10. File/Write Safety Model

### 10.1 Read-Only Orchestration First

Initial orchestration operates with:

| Capability | Status |
|-----------|--------|
| `list_files` | ENABLED (validated by AGENT-HARNESS-06E) |
| `read_file` | ENABLED (validated by AGENT-HARNESS-06E) |
| `write_file` | DISABLED |
| `delete_file` | DISABLED |
| `run_validation` | DISABLED |
| `browser_smoke` | DISABLED |

### 10.2 Write/Delete/Run_Validation Not Part of Initial Orchestration

The following are explicitly excluded from the initial multi-builder orchestration phase:

- `write_file` — file creation/modification
- `delete_file` — file deletion
- `run_validation` — shell command execution
- `browser_smoke` — browser interaction

These tools remain gated by `resolvedConfig.enableWriteTools`, `resolvedConfig.enableValidationTools`, and `resolvedConfig.enableBrowserSmoke` — all `false` in production.

### 10.3 Conflict Rules Needed Before Writes

Before any multi-builder write activation, the following must be designed and implemented:

1. **Single-builder write canary** — validate `write_file` works correctly for one builder in isolation
2. **Sequential write model** — Builder A writes → project updated → Builder B starts with updated state
3. **Write lock protocol** — prevent concurrent writes to the same file by different builders
4. **Conflict detection** — identify when two builders have modified the same file independently
5. **Conflict resolution** — strategy for merging or choosing between conflicting changes
6. **Checkpoint/revert interaction** — how revert behaves when multiple builders have written to the project

### 10.4 Future Write Canary Dependency

Multi-builder writes depend on:

1. Single-builder write canary (not yet registered — requires Keith approval)
2. Write canary success and stability confirmation
3. Multi-builder write safety plan (separate future document)
4. Write conflict resolution implementation
5. Keith explicit approval for multi-builder write activation

---

## 11. Shared Workspace Conflict Strategy

### 11.1 No Shared Writes in Initial Phase

The initial orchestration phase does NOT support:
- Two builders writing to the same workspace simultaneously
- Real-time file synchronization between builder sessions
- Automatic merge of divergent workspace states

### 11.2 Future Lock Model Options

When shared writes are eventually needed, the following options should be evaluated:

| Option | Description | Trade-offs |
|--------|-------------|------------|
| **File-level pessimistic locks** | Builder acquires exclusive lock on file before writing; other builders blocked | Simple; no conflicts; but limits concurrency |
| **Directory-level locks** | Lock entire directory for a builder's scope of work | Coarser granularity; easier to implement; more blocking |
| **Workspace-level locks** | Only one builder can write at a time (mutex) | Simplest; most restrictive; sequential-only writes |
| **Optimistic concurrency** | Builders write freely; detect conflicts at commit/merge time | Maximum concurrency; complex conflict resolution |

### 11.3 Recommended Initial Lock Strategy (When Writes Are Enabled)

**Workspace-level mutex with sequential builder execution.**

Rationale:
- Simplest correct implementation
- No conflict resolution needed
- Matches the "Builder A completes → Builder B starts" sequential model
- Low risk of data loss
- Can be relaxed to file-level locks in a future iteration

### 11.4 Merge/Conflict Handling (Future)

When concurrent writes are eventually supported:
- Git-based merge at the project level (each builder's session is a branch)
- Three-way merge using the project baseline as common ancestor
- Conflict markers or automated resolution based on file type and scope
- Owner approval for unresolvable conflicts

### 11.5 Checkpoint/Revert Implications

- Each builder's session has independent checkpoints
- Reverting one builder's session does not affect another builder's session
- Project-level revert (reverting the merged result) requires reverting all contributing sessions or selecting a specific merge point
- Checkpoint scope remains per-session in the initial model

---

## 12. Approval Model

### 12.1 Platform-Level Mandatory Approvals (Cannot Be Overridden)

The following always require owner approval regardless of builder profile configuration:

| Category | Reason |
|----------|--------|
| Legal commitments | Liability risk |
| Financial transactions | Monetary risk |
| Contract acceptance/modification | Binding obligation |
| Public-facing content publishing | Reputation risk |
| External communications | Unauthorized outreach |
| Permission/access changes | Security escalation |
| Data deletion (irreversible) | Data loss risk |

These are enforced at the platform level by `resolveBuilderHarnessConfig()` safety enforcement (approval floors cannot be weakened).

### 12.2 Write/Delete/Env/Package Approval Gates

| Action | Gate |
|--------|------|
| `write_file` (any file) | `resolvedConfig.enableWriteTools` must be `true` |
| `delete_file` (any file) | `resolvedConfig.requireApprovalForDelete` — always `true` at platform level |
| `.env` file write | `resolvedConfig.requireApprovalForEnvFileWrite` — always `true` at platform level |
| Package install | `resolvedConfig.requireApprovalForPackageInstall` — always `true` at platform level |
| Large file write (> threshold) | `resolvedConfig.requireApprovalForLargeWrite` — always `true` at platform level |

### 12.3 Owner Confirmation Requirements for Orchestration

| Event | Approval Type |
|-------|---------------|
| Collaboration initiation (first referral) | Informational notification (no blocking approval) |
| Referral to new builder profile | Owner approval required |
| Safety threshold approached (§9.6) | Owner approval required to continue |
| Write tool activation (future) | Owner approval required per session |
| High-risk action (§12.1) | Platform-level approval required |
| Budget threshold exceeded | Owner approval required |

---

## 13. Audit and Observability

### 13.1 collaborationRunId in Events

All events emitted during a collaboration must carry `collaborationRunId`:

- `agent_harness.route_evaluated`
- `agent_harness.config_resolved`
- `harness.loop_started`
- `harness.tool_dispatch_completed`
- `harness.model_invocation_completed`
- `harness.loop_completed`
- `execution_completed`
- Credit deduction events

### 13.2 referralTraceId in Events

Referral-specific events must carry `referralTraceId`:

- `orchestration.referral_created`
- `orchestration.referral_approved`
- `orchestration.referral_started`
- `orchestration.referral_completed`
- `orchestration.referral_failed`
- `orchestration.referral_cancelled`
- `orchestration.referral_timed_out`

### 13.3 Source/Target Builder Identity in Events

All orchestration events carry both `sourceAgent` and `targetAgent`:

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

### 13.4 Harness Audit Event Implications

`AgentHarnessAuditEventV1.payload` (currently `Record<string, unknown>`) should include:

- `collaborationRunId` (nullable — null for non-collaborative executions)
- `referralTraceId` (nullable — null for non-referral executions)
- `agentRole`
- `builderProfileId`

This does not require changing the `AgentHarnessAuditEventV1` type shape (payload is already untyped). It requires consistent population by the worker/harness code.

### 13.5 Usage Ledger Implications

`UsageRecord` columns needed (future migration):

| Column | Type | Purpose |
|--------|------|---------|
| `agent_role` | `varchar(50) nullable` | Role attribution |
| `builder_profile_id` | `varchar(100) nullable` | Profile attribution |
| `collaboration_run_id` | `uuid nullable` | Collaboration grouping |
| `referral_trace_id` | `uuid nullable` | Referral chain trace |

---

## 14. Billing Attribution

### 14.1 agentRole/builderProfileId Attribution

- Every execution within a collaboration carries `agentRole` and `builderProfileId`
- Credit deductions are attributed to the specific builder profile that consumed resources
- Aggregate billing remains at `userId` level (builder profiles are for attribution/reporting, not separate billing buckets)

### 14.2 collaborationRunId/referralTraceId Future Fields

- `collaborationRunId` on `CreditDeductionRecord` — enables per-collaboration cost analysis
- `referralTraceId` on `CreditDeductionRecord` — enables per-referral cost breakdown
- Both nullable — backward-compatible with existing single-builder deduction records

### 14.3 No Billing Enforcement in This Plan

This plan does NOT implement:
- Per-builder credit limits
- Per-collaboration budget caps (enforcement)
- Entitlement gating based on builder profile
- Stripe/payment integration for multi-builder billing

These remain deferred to BILLING-READY-04+ family.

### 14.4 BILLING-READY-04+ Dependency

If per-builder or per-collaboration billing enforcement is needed:
- Requires `agentRole` and `builderProfileId` populated on `UsageRecord` (upstream identity wiring)
- Requires `collaborationRunId` populated on `CreditDeductionRecord`
- Requires entitlement check service that respects per-collaboration budgets
- All of the above are implementation tasks after this plan

---

## 15. API Gateway / Upstream Identity Wiring Needs

### 15.1 Current Gap

The API Gateway `enqueueExecution()` path (`ai-execution.controller.ts`) does NOT populate:
- `agentRole`
- `builderProfileId`
- `harnessProfileId`
- `modelProfileId`
- `toolPermissionProfileId`
- `collaborationRunId`
- `referralTraceId`

These fields exist on `AiExecutionJob` but are NEVER populated by the upstream enqueue path. The worker always resolves as `global-default-missing-profile`.

### 15.2 Required Future Implementation Points

| Implementation Point | Service | Change Required |
|---------------------|---------|-----------------|
| Frontend profile selection | `frontend` | Pass `builderProfileId` in execution request |
| API Gateway enqueue | `services/api-gateway` | Accept and forward `agentRole`, `builderProfileId` to job payload |
| API Gateway usage record | `services/api-gateway` | Populate agent identity on `UsageRecord` at intent-write time |
| Orchestration coordinator | New or existing service | Generate `collaborationRunId`, `referralTraceId`; populate on enqueued jobs |
| Job type extension | `services/ai-service` | Add `collaborationRunId`, `referralTraceId`, `parentReferralTraceId`, `referringBuilderProfileId` to `AiExecutionJob` |

### 15.3 No Implementation in This Task

All of the above are future implementation tasks. This plan defines WHAT needs to be wired; it does not implement the wiring.

---

## 16. UX/UI Future Constraints

### 16.1 Multilingual-First

aiSandBox is multilingual-first. Any future UI for multi-builder orchestration must:

- Add or update keys in:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use the existing translation hook/pattern (`useTranslations` / `next-intl`)
- Do NOT add hardcoded English UI copy

### 16.2 Potential Future UI Surfaces

| Surface | Description |
|---------|-------------|
| Builder profile selector | Choose which builder to use for a task |
| Collaboration status indicator | Show active collaboration, participating builders, progress |
| Referral chain visualization | Show referral depth, source→target flow |
| Per-builder attribution in usage dashboard | Show cost/usage breakdown per builder profile |
| Approval gate UI | Approve/reject pending actions from builders |
| Collaboration history | Past collaborations with results and audit trail |

### 16.3 Design Constraints

- Icons: Heroicons v2 Outline only
- Impeccable and Emil Kowalski design engineering skills are advisory only
- Advisory skills must NOT override governance, scope, architecture, or tests
- No hardcoded English strings — all text via translation keys
- Empty/loading/error/success states must be multilingual

---

## 17. Recommended Implementation Sequence

### 17.1 Next Child/Task Candidates After AGENT-PLATFORM-05

| # | Candidate Task | Nature | Risk | Rationale |
|---|----------------|--------|------|-----------|
| 1 | **Upstream Identity Propagation** | Implementation | Medium | Wire `agentRole`/`builderProfileId` from frontend → API Gateway → job payload. Unblocks all downstream attribution. |
| 2 | **collaborationRunId / referralTraceId Schema** | Implementation (DB migration) | Medium | Add columns to `UsageRecord`, `CreditDeductionRecord`; define collaboration table. |
| 3 | **Orchestration Coordinator Service (Read-Only)** | Implementation | High | Core orchestration logic: referral creation, validation, depth/loop enforcement, timeout management. Read-only tools only. |
| 4 | **Collaboration Audit Events** | Implementation | Low | Typed orchestration events, emit/store collaboration lifecycle events. |
| 5 | **Single-Builder Write Canary** | Runtime canary | High | Validate `write_file` works for one builder in isolation. Prerequisite for multi-builder writes. |
| 6 | **Write Safety Model Design** | Planning | Medium | Define conflict rules, lock protocol, merge strategy before multi-builder writes. |
| 7 | **Multi-Builder Write Activation** | Runtime | Very High | Enable writes for multiple builders with conflict resolution. Only after steps 5 and 6. |

### 17.2 Suggested First Implementation Slice

**Upstream identity propagation (Step 1 above) — not shared writes.**

Rationale:
- Low runtime risk (no new tools activated, no write capability)
- Unblocks all downstream work (audit, billing attribution, orchestration coordinator)
- Uses existing infrastructure (API Gateway, job types, worker)
- Backward-compatible (all fields optional)
- Testable without Docker/containers/full stack

### 17.3 Write Canary Must Remain Separate

The write canary (single-builder write tool activation) must:
- Be a separate, explicitly registered task
- Require Keith approval before execution
- Use process-scoped env (not persistent `.env` changes)
- Be validated in isolation (single builder, controlled session) before multi-builder context
- NOT be bundled into the orchestration implementation

### 17.4 Full Orchestration Runtime Must Wait

Full multi-builder orchestration runtime (coordinator service, live referral routing, concurrent execution) should wait until:

1. Upstream identity propagation is implemented and validated
2. Safety limits (§9) are implemented and enforced
3. Audit/observability (§13) is implemented
4. Read-only orchestration is proven safe in controlled conditions
5. Write canary is validated (before enabling write orchestration)
6. Write safety model is designed (before enabling shared writes)

---

## 18. Non-Goals

This plan document explicitly does NOT:

| Non-Goal | Rationale |
|----------|-----------|
| Implement any source code | Planning/governance only |
| Execute any runtime orchestration | No services started |
| Start Docker/Postgres/Redis | No infrastructure commands |
| Run database migrations | Schema design only |
| Create frontend UI | No user-facing changes |
| Activate write tools | Writes remain disabled |
| Call external providers/APIs | Zero external calls |
| Enforce billing/entitlement | Billing attribution defined, not enforced |
| Register implementation tasks | Deferred to Keith approval |
| Modify TASKS.md or TASKS_BACKLOG_FULL.md | Consolidation step will do this |
| Run tests or builds | No validation commands |
| Start BullMQ jobs | No queue operations |
| Execute browser smoke | No browser automation |

---

## 19. Readiness Conclusion

### 19.1 Can AGENT-PLATFORM-05 Proceed to Step 4 Consolidation?

**YES — AGENT-PLATFORM-05 is ready for Step 4 (Consolidation/Checkpoint).**

### 19.2 Blockers

**None.** All prerequisites are satisfied:

| Prerequisite | Status |
|--------------|--------|
| AGENT-PLATFORM-04 COMPLETE and LOCKED | PASS |
| AGENT-HARNESS-07 COMPLETE and LOCKED | PASS |
| AGENT-HARNESS-06E COMPLETE and LOCKED | PASS |
| Readiness Review (Step 2) COMPLETE | PASS |
| Orchestration Plan (Step 3 — this document) | COMPLETE |
| No implementation required | PASS |
| No runtime execution required | PASS |

### 19.3 What Step 4 Must Do

1. Mark AGENT-PLATFORM-05 as COMPLETE and LOCKED in TASKS.md
2. Mirror in TASKS_BACKLOG_FULL.md
3. Update AINOW-EXECUTION-ROADMAP.md
4. Create `docs/AGENT-PLATFORM-05-CHECKPOINT.md`
5. Record all plan sections, key decisions, deferred items
6. No implementation files changed

---

## 20. Key Orchestration Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Initial orchestration mode | Read-only | Safety first; write tools not validated for multi-builder |
| Routing model | Single queue, metadata routing | Simplest; uses existing BullMQ; no infrastructure changes |
| Session isolation | 1 builder = 1 session = 1 container | Preserves AGENT-PLATFORM-04 topology; no shared workspace |
| Write strategy | Deferred entirely | Requires separate canary, conflict model, and Keith approval |
| Referral model | Async referral with explicit approval gates | Prevents runaway chains; owner retains control |
| Lock strategy (future) | Workspace-level mutex (sequential execution) | Simplest correct model when writes are enabled |
| Max referral depth | 3 (configurable) | Prevents deep chains; owner approval at depth-1 |
| Max agents per collaboration | 4 (configurable) | Prevents resource exhaustion; owner approval at limit-1 |
| Identity propagation first | Yes — recommended first implementation slice | Unblocks all downstream work; low risk |
| Billing enforcement | Deferred to BILLING-READY-04+ | Attribution designed; enforcement separate |

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-05 Step 3 — Multi-Builder Orchestration Plan Document
- **Status:** Step 3 COMPLETE — Orchestration Plan Created
- **Author:** AI-assisted governance pass
- **Source:** AGENT-PLATFORM-05 Readiness Review (Step 2), AGENT-PLATFORM-04 Topology Plan, AGENT-HARNESS-07 Checkpoint, AGENT-HARNESS-06E Checkpoint, current codebase architecture
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
