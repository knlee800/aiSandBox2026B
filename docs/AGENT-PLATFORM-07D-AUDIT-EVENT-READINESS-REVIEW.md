# AGENT-PLATFORM-07D — Audit Event Readiness / Source-Path Review

**Task ID:** AGENT-PLATFORM-07D
**Step:** 2 — Audit Event Readiness / Source-Path Review
**Status:** Step 2 COMPLETE
**Date:** 2026-07-10
**Nature:** Static read-only review/design only — no implementation, no runtime execution
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07D ACTIVE | PASS — registered in TASKS.md and AINOW-EXECUTION-ROADMAP.md; Step 1 COMPLETE (Registration 2026-07-10); Keith approval recorded ("approve") |
| AGENT-PLATFORM-07C COMPLETE and LOCKED | PASS — 2026-07-10; all 3 child slices COMPLETE and LOCKED (07C1/07C2/07C3) |
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
| One-active-task rule satisfied | PASS — only AGENT-PLATFORM-07D is ACTIVE |

**Governance readiness: PASS — all 14 criteria satisfied.**

---

## 2. Foundation Summary

| Foundation Slice | Summary |
|------------------|---------|
| 07 — Plan | Read-Only Orchestration Coordinator Plan. 22-section plan. Defined 14 orchestration audit event names (§15.1), `OrchestrationAuditEvent` interface shape (§15.4), coordinator boundary (API Gateway `orchestration/` module), in-memory-first persistence, cancel redesign requirement. |
| 07A — Contracts | `orchestration.contracts.ts` created. Pure TypeScript types: `OrchestrationAuditEvent`, `OrchestrationAuditEventType` (14-member union), `CollaborationRun`, `CollaborationReferral`, `ReferralResult`, `ReferralConstraints`, all ID aliases, status unions, safety constants. No runtime. |
| 07B — Module Skeleton | `OrchestrationModule` + `OrchestrationService` skeleton. `getDefaultReferralConstraints()`, `getReadOnlyPolicy()`. Registered in `AppModule`. Jest 3 tests. No runtime coordinator. |
| 07C — Parent Completion | All 3 child slices COMPLETE and LOCKED. Cancel redesign risk downgraded from HIGH to LOW–MEDIUM (no obliterate exists). |
| 07C1 — Core In-Memory Lifecycle | 3 in-memory stores, 7 core methods: `createCollaborationRun()`, `getCollaborationRun()`, `createReferral()`, `getReferral()`, `completeReferral()`, `failReferral()`, `validateReferral()`. Safety limits. 13 tests. |
| 07C2 — Referral Enqueue/Cancel | `startReferralExecution()`, `cancelReferral()`, `cancelCollaboration()`, `referralExecutionMap`. `AiExecutionJob` extended with 5 fields. Worker finalization preserves 5 fields. 25 orchestration tests + 55 worker tests. |
| 07C3 — Validation | Regression PASS. No implementation changes. Parent 07C closed. |

---

## 3. Existing Audit/Logging Source-Path Findings

### 3.1 API Gateway — AuditLogService (Operator Audit)

**File:** `services/api-gateway/src/safety/audit-log.service.ts`

- **Purpose:** Operator audit log for kill switch changes, safety limit changes, emergency overrides, abort mode changes, launch state rollbacks.
- **Pattern:** In-memory `AuditLogEntry[]` array; `this.logger.warn()/error()` structured log; each method pushes to array.
- **Shape:** `{ timestamp, actor, action, resource, oldValue?, newValue?, reason?, incidentId?, ipAddress? }`.
- **Relevance:** This is an **operator** audit system, not a collaboration/orchestration event system. Different domain. Not reusable for orchestration events.
- **Verdict:** Not reusable — different event shape, different semantic purpose.

### 3.2 AI Service — Harness Audit Events (Structured Events)

**File:** `services/ai-service/src/agent-harness/audit/harness-audit-events.ts`
**File:** `services/ai-service/src/agent-harness/audit/harness-audit-recorder.ts`

- **Purpose:** Structured typed audit events for Agent Harness v1 tool loop.
- **Pattern:** `InMemoryHarnessAuditRecorder` implements `HarnessAuditRecorder` interface. Records typed `HarnessAuditEvent` discriminated union. Worker iterates `auditRecorder.getEvents()` and logs each as `JSON.stringify(event)` via `this.logger.log()`.
- **Event types:** 13 event types (`harness.route_evaluated`, `harness.loop_started`, `harness.model_invocation_started/completed/failed`, `harness.tool_dispatch_started/completed/failed`, `harness.tool_result_budget_exceeded`, `harness.loop_completed/max_turns/aborted/no_dispatcher`).
- **Base shape:** `{ eventType, timestamp, executionId, sessionId, harnessVersion }`.
- **Key observation:** Harness events do **NOT** carry `collaborationRunId`, `referralTraceId`, `agentRole`, `builderProfileId`, or any orchestration identity fields. These are execution-scoped only.
- **Relevance:** Proves the project already uses in-memory structured typed event recording + JSON log emission as an established pattern. The orchestration audit events should follow the same pattern: typed discriminated union + recorder + `this.logger.log(JSON.stringify(event))`.
- **Verdict:** Reusable pattern — not the exact recorder, but the approach is the template.

### 3.3 Worker — Structured JSON Logging

**File:** `services/ai-service/src/worker/worker.processor.ts`

The worker already emits structured JSON via `this.logger.log(JSON.stringify({...}))` for:
- `agent_harness.route_evaluated` (line 758)
- `agent_harness.config_resolved` (line 776)
- All harness audit events (line 886 — iterates `auditRecorder.getEvents()`)
- `execution_completed` via `logExecutionCompletion()` (line 385)

No `EventEmitter` or NestJS event system is used. The pattern is pure structured logger output.

### 3.4 OrchestrationService — No Event Emission Today

**File:** `services/api-gateway/src/orchestration/orchestration.service.ts`

The `OrchestrationService` currently emits **zero** audit events. State transitions (create, complete, fail, cancel) happen in-memory with no logging, no event emission, no structured audit trail. The `OrchestrationAuditEvent` type exists in contracts (07A) but is never instantiated or emitted.

### 3.5 WorkerProcessor — No Orchestration Event Emission Today

The worker preserves orchestration identity fields in `nextMetadata` (07C2) but emits no orchestration-specific events. Harness audit events exist but do not carry orchestration context (`collaborationRunId`, `referralTraceId`).

---

## 4. Orchestration Lifecycle Transition Points

These are the `OrchestrationService` methods where audit events should be emitted:

| # | Method | Transition | Event |
|---|--------|-----------|-------|
| 1 | `createCollaborationRun()` | → `active` | `collaboration_started` |
| 2 | `createReferral()` | → `pending_approval` | `referral_created` |
| 3 | `createReferral()` (duplicate path) | idempotency hit | `referral_duplicate_detected` |
| 4 | `startReferralExecution()` | → `in_progress` | `referral_enqueued` + `referral_started` |
| 5 | `completeReferral()` | → `completed` | `referral_completed` |
| 6 | `failReferral()` | → `failed` | `referral_failed` |
| 7 | `cancelReferral()` | → `cancelled` | `referral_cancelled` |
| 8 | `cancelCollaboration()` | → `cancelled` (cascade) | `collaboration_cancelled` |
| 9 | `validateReferral()` — depth breach | throws | `referral_depth_blocked` |
| 10 | `validateReferral()` — loop detected | throws | `referral_loop_blocked` |
| 11 | `validateReferral()` — agent limit | throws | `referral_agent_limit_blocked` |

**Points NOT in current code but in future scope:**
- `referral_timeout` — requires timeout timer (not implemented)
- `collaboration_completed` — requires all-referrals-resolved detection (not implemented)

---

## 5. Event Name Decision

Based on the 14-member `OrchestrationAuditEventType` union in `orchestration.contracts.ts` (07A), the 07 plan §15.1 event names, and the current lifecycle transition points, the following event names are decided for Step 3:

| # | Event Name | Trigger Point | Emittable in Step 3? |
|---|-----------|---------------|---------------------|
| 1 | `orchestration.collaboration_started` | `createCollaborationRun()` creates new run | YES |
| 2 | `orchestration.collaboration_completed` | All referrals resolved (requires detection logic) | YES — add to existing method or new helper |
| 3 | `orchestration.collaboration_cancelled` | `cancelCollaboration()` cascades | YES |
| 4 | `orchestration.referral_created` | `createReferral()` stores new referral | YES |
| 5 | `orchestration.referral_enqueued` | `startReferralExecution()` enqueues job | **NEW** — not in 07A union; maps to `orchestration.referral_started` |
| 6 | `orchestration.referral_started` | `startReferralExecution()` transitions to `in_progress` | YES — existing in 07A union |
| 7 | `orchestration.referral_completed` | `completeReferral()` transitions to `completed` | YES |
| 8 | `orchestration.referral_failed` | `failReferral()` transitions to `failed` | YES |
| 9 | `orchestration.referral_cancelled` | `cancelReferral()` transitions to `cancelled` | YES |
| 10 | `orchestration.referral_timed_out` | Timeout timer fires (not implemented) | NO — requires timer infrastructure |
| 11 | `orchestration.referral_duplicate` | `createReferral()` idempotency duplicate path | YES — use existing `orchestration.referral_duplicate` from 07A union; maps to `referral_duplicate_detected` |
| 12 | `orchestration.referral_loop_detected` | `validateReferral()` loop prevention | **NEW** — not in 07A union directly; maps to `orchestration.safety_limit_breached` with `limitType: 'loop_detected'` |
| 13 | `orchestration.referral_depth_exceeded` | `validateReferral()` depth > max | YES — existing in 07A union; maps to `orchestration.safety_limit_breached` with `limitType: 'depth_exceeded'` |
| 14 | `orchestration.agent_limit_exceeded` | `validateReferral()` agents > max | YES — existing in 07A union; maps to `orchestration.safety_limit_breached` with `limitType: 'agent_limit_exceeded'` |

### Event Name Mapping Decision

The existing `OrchestrationAuditEventType` union in `orchestration.contracts.ts` already covers:
- `orchestration.collaboration_created` (maps to `collaboration_started`)
- `orchestration.referral_created`
- `orchestration.referral_started` (covers enqueue + start)
- `orchestration.referral_completed`
- `orchestration.referral_failed`
- `orchestration.referral_cancelled`
- `orchestration.referral_timed_out` (deferred — no timer)
- `orchestration.collaboration_completed`
- `orchestration.collaboration_cancelled`
- `orchestration.referral_duplicate` (covers duplicate detection)
- `orchestration.safety_limit_breached` (covers depth/loop/agent-limit)
- `orchestration.safety_limit_approached` (deferred — no threshold warning)
- `orchestration.referral_approved` (deferred — no approval gate runtime)
- `orchestration.referral_rejected` (deferred — no approval gate runtime)
- `orchestration.collaboration_timed_out` (deferred — no timer)

**Decision:** Use the existing `OrchestrationAuditEventType` union as-is. No union expansion needed. The task prompt's `referral_duplicate_detected` / `referral_loop_blocked` / `referral_depth_blocked` / `referral_agent_limit_blocked` / `referral_enqueued` names map to existing union members:

| Task Prompt Name | Maps To (07A union) |
|------------------|---------------------|
| `collaboration_started` | `orchestration.collaboration_created` |
| `collaboration_completed` | `orchestration.collaboration_completed` |
| `collaboration_cancelled` | `orchestration.collaboration_cancelled` |
| `referral_created` | `orchestration.referral_created` |
| `referral_enqueued` | `orchestration.referral_started` (combined with start) |
| `referral_started` | `orchestration.referral_started` |
| `referral_completed` | `orchestration.referral_completed` |
| `referral_failed` | `orchestration.referral_failed` |
| `referral_cancelled` | `orchestration.referral_cancelled` |
| `referral_timeout` | `orchestration.referral_timed_out` (deferred) |
| `referral_duplicate_detected` | `orchestration.referral_duplicate` |
| `referral_loop_blocked` | `orchestration.safety_limit_breached` + `payload.limitType: 'loop_detected'` |
| `referral_depth_blocked` | `orchestration.safety_limit_breached` + `payload.limitType: 'depth_exceeded'` |
| `referral_agent_limit_blocked` | `orchestration.safety_limit_breached` + `payload.limitType: 'agent_limit_exceeded'` |

---

## 6. Event Contract Shape

### 6.1 Existing Contract — `OrchestrationAuditEvent` (07A)

```typescript
interface OrchestrationAuditEvent {
  readonly eventType: OrchestrationAuditEventType;
  readonly collaborationRunId: CollaborationRunId;
  readonly referralTraceId: ReferralTraceId | null;
  readonly sourceBuilder: SourceBuilderIdentity;
  readonly targetBuilder: TargetBuilderIdentity | null;
  readonly timestamp: IsoTimestamp;
  readonly payload: Readonly<Record<string, unknown>>;
}
```

### 6.2 Required Fields (from task prompt, mapped to existing contract)

| Field | Required/Optional | Present in 07A Contract? | Decision |
|-------|-------------------|-------------------------|----------|
| `eventName` / `eventType` | Required | YES — `eventType` | Use existing `eventType` |
| `timestamp` | Required | YES | Use existing |
| `collaborationRunId` | Required | YES | Use existing |
| `referralTraceId` | Required (nullable) | YES — `ReferralTraceId \| null` | Use existing |
| `referralId` | Required where applicable | NO — not in contract | Add to `payload` |
| `parentReferralTraceId` | Optional | NO — not in contract | Add to `payload` |
| `sourceBuilder` (identity) | Required | YES — `SourceBuilderIdentity` | Use existing |
| `targetBuilder` (identity) | Required (nullable) | YES — `TargetBuilderIdentity \| null` | Use existing |
| `builderProfileId` | Implicit in source/target | YES — via identity objects | Covered by `sourceBuilder.builderProfileId` / `targetBuilder.builderProfileId` |
| `agentRole` | Implicit in source/target | YES — via identity objects | Covered by `sourceBuilder.agentRole` / `targetBuilder.agentRole` |
| `userId` | Required for attribution | NO — not in contract | Add to `payload` |
| `projectId` | Required for context | NO — not in contract | Add to `payload` |
| `sessionId` | Optional (where available) | NO — not in contract | Add to `payload` when available |
| `executionId` | Optional (where available) | NO — not in contract | Add to `payload` when available |
| `status` / `result` | Event-specific | NO — not in contract | Add to `payload` |
| `reason` / `error` | Event-specific | NO — not in contract | Add to `payload` |
| `metadata` extension | Optional | YES — `payload` is `Record<string, unknown>` | Use existing `payload` |

### 6.3 Decision: Keep Existing Contract + Use `payload` for Event-Specific Fields

The existing `OrchestrationAuditEvent` contract from 07A is sufficient. Event-specific fields (`referralId`, `userId`, `projectId`, `sessionId`, `executionId`, `status`, `reason`, `error`, `limitType`, `currentValue`, `maxValue`) go into the `payload` field.

**No contract type changes needed.** The existing union + interface handles all 14 event types.

### 6.4 Payload Shape per Event Type

| Event Type | Payload Fields |
|------------|---------------|
| `orchestration.collaboration_created` | `{ userId, projectId, orchestrationMode, timeoutMs }` |
| `orchestration.collaboration_completed` | `{ userId, projectId, referralCount, activeBuilderCount }` |
| `orchestration.collaboration_cancelled` | `{ userId, projectId, cancelledByUserId, cancelReason, affectedReferralIds }` |
| `orchestration.referral_created` | `{ referralId, userId, projectId, idempotencyKey, depth, maxDepth }` |
| `orchestration.referral_started` | `{ referralId, executionId, sessionId, orchestrationPriority }` |
| `orchestration.referral_completed` | `{ referralId, executionId, resultStatus, durationMs }` |
| `orchestration.referral_failed` | `{ referralId, executionId, resultStatus, durationMs, summary }` |
| `orchestration.referral_cancelled` | `{ referralId, executionId, cancelledByUserId, cancelReason }` |
| `orchestration.referral_duplicate` | `{ referralId, existingReferralId, idempotencyKey }` |
| `orchestration.safety_limit_breached` | `{ limitType, currentValue, maxValue, referralId? }` |
| `orchestration.referral_timed_out` | `{ referralId, executionId, timeoutMs }` (deferred) |
| `orchestration.collaboration_timed_out` | `{ timeoutMs, affectedReferralIds }` (deferred) |
| `orchestration.safety_limit_approached` | `{ limitType, currentValue, maxValue }` (deferred) |
| `orchestration.referral_approved` | `{ referralId, approvedBy }` (deferred) |
| `orchestration.referral_rejected` | `{ referralId, rejectedBy, reason }` (deferred) |

---

## 7. Emission Boundary Decision

### 7.1 Options

| Option | Boundary |
|--------|----------|
| A | API Gateway `OrchestrationService` only — all orchestration events emitted here |
| B | AI Service `WorkerProcessor` only — events emitted when worker processes referral jobs |
| C | Both — orchestration events in API Gateway, harness event enrichment in AI Service |

### 7.2 Analysis

| Concern | Assessment |
|---------|-----------|
| Where do lifecycle transitions happen? | API Gateway `OrchestrationService` — all `create*`, `complete*`, `fail*`, `cancel*`, `validate*` |
| Where does harness event recording happen? | AI Service `WorkerProcessor` → `InMemoryHarnessAuditRecorder` |
| Where does identity metadata finalization happen? | AI Service `WorkerProcessor` → `nextMetadata` JSONB |
| Does `WorkerProcessor` know about `collaborationRunId`? | YES — reads from `job.data.collaborationRunId` and preserves in `nextMetadata` |
| Does `WorkerProcessor` know about `OrchestrationAuditEvent` type? | NO — it only knows `AiExecutionJob` fields |
| Would adding orchestration event emission to worker couple AI Service to orchestration? | YES — undesirable cross-boundary coupling |

### 7.3 Recommendation: Option A — API Gateway `OrchestrationService` Only

**Safest boundary:** Emit all `orchestration.*` audit events in `OrchestrationService` only.

Rationale:
1. All orchestration lifecycle transitions happen in `OrchestrationService` — events should be emitted at the transition point.
2. The worker already preserves orchestration identity fields in `nextMetadata` (07C2) — this is sufficient for post-hoc query/attribution.
3. Adding event emission to `WorkerProcessor` would create cross-boundary coupling between AI Service and orchestration domain contracts.
4. The harness audit events (`harness.*`) remain a separate concern in AI Service — they can be enriched with `collaborationRunId`/`referralTraceId` from `job.data` in a future slice without importing orchestration contracts.
5. The NestJS `Logger` pattern used by worker for structured JSON logging can be replicated in `OrchestrationService` without shared infrastructure.

**Worker changes NOT recommended for Step 3.** The worker already preserves all identity/orchestration fields in metadata. Enriching harness events with `collaborationRunId`/`referralTraceId` is a separate concern that can be done in a future slice.

---

## 8. Persistence Decision

### 8.1 Options

| Option | Mechanism | Migration? |
|--------|-----------|-----------|
| A | Console/logger structured events only (`this.logger.log(JSON.stringify(event))`) | No |
| B | In-memory event sink for tests + console logger for production | No |
| C | `usage_records.metadata` JSONB enrichment | No |
| D | Dedicated `orchestration_audit_events` table | YES |

### 8.2 Analysis

| Concern | Assessment |
|---------|-----------|
| Current harness pattern | `InMemoryHarnessAuditRecorder` + `this.logger.log(JSON.stringify(event))` — no DB persistence |
| Current operator audit pattern | `AuditLogService` — in-memory array + `this.logger.warn()` — no DB persistence |
| DB migration risk | HIGH for first orchestration audit implementation — premature schema commitment |
| Queryability need | Not immediate — no dashboard, no reporting, no billing attribution via events yet |
| Test observability need | YES — tests need to verify events were emitted with correct shape |

### 8.3 Recommendation: Option B — In-Memory Event Sink + Console Logger

**First implementation should use:**

1. **In-memory recorder** — `InMemoryOrchestrationAuditRecorder` following the same pattern as `InMemoryHarnessAuditRecorder`. Records `OrchestrationAuditEvent[]` in memory.
2. **Console/logger emission** — `this.logger.log(JSON.stringify(event))` for production observability, following the exact same pattern as the worker's harness event logging.
3. **No DB migration** — no `orchestration_audit_events` table. Events are transient in memory and visible in structured logs.
4. **Test sink** — Tests can access the recorder to verify event emission shape and count.

This matches both established project patterns:
- `InMemoryHarnessAuditRecorder` (AI Service harness audit)
- `AuditLogService` (API Gateway operator audit)

**DB migration is NOT needed for Step 3.**

---

## 9. Implementation Boundary for Step 3

### 9.1 Files Likely to Change

| # | File | Change Type | Scope |
|---|------|-------------|-------|
| 1 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Modified | Add event emission calls at each lifecycle transition point; inject or instantiate recorder; add `private emitEvent()` helper method |
| 2 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | Modified | Add event emission verification tests for each lifecycle transition; verify event shape, count, and fields |

### 9.2 Files Likely to Add

| # | File | Type | Scope |
|---|------|------|-------|
| 1 | `services/api-gateway/src/orchestration/orchestration-audit.recorder.ts` | New | `OrchestrationAuditRecorder` interface + `InMemoryOrchestrationAuditRecorder` class (following harness pattern) |

### 9.3 Files NOT Expected to Change

| File | Reason |
|------|--------|
| `orchestration.contracts.ts` | `OrchestrationAuditEvent` and `OrchestrationAuditEventType` already defined in 07A — no additions needed |
| `orchestration.module.ts` | May need to add recorder provider if using DI, but minimal change |
| `worker.processor.ts` | NOT in scope — worker already preserves identity fields; harness event enrichment is a separate concern |
| `job.types.ts` | NOT in scope — no new job fields needed |
| `worker.processor.builder-config.spec.ts` | NOT in scope — no worker changes |
| Any database migration | NOT in scope — no DB migration |
| Frontend files | NOT in scope — no UI |

### 9.4 Methods Likely to Add/Change

| Method | Change |
|--------|--------|
| `OrchestrationService.createCollaborationRun()` | Add `emitEvent('orchestration.collaboration_created', ...)` |
| `OrchestrationService.createReferral()` | Add `emitEvent('orchestration.referral_created', ...)` + conditional `emitEvent('orchestration.referral_duplicate', ...)` |
| `OrchestrationService.startReferralExecution()` | Add `emitEvent('orchestration.referral_started', ...)` |
| `OrchestrationService.completeReferral()` | Add `emitEvent('orchestration.referral_completed', ...)` |
| `OrchestrationService.failReferral()` | Add `emitEvent('orchestration.referral_failed', ...)` |
| `OrchestrationService.cancelReferral()` | Add `emitEvent('orchestration.referral_cancelled', ...)` |
| `OrchestrationService.cancelCollaboration()` | Add `emitEvent('orchestration.collaboration_cancelled', ...)` |
| `OrchestrationService.validateReferral()` | Add `emitEvent('orchestration.safety_limit_breached', ...)` before throw for depth/loop/agent-limit |
| New: `OrchestrationService.emitEvent()` | Private helper: builds `OrchestrationAuditEvent`, records in recorder, logs via `Logger` |
| New: `OrchestrationService.getAuditEvents()` | Public accessor for test observation |

### 9.5 Tests Likely to Add/Update

| # | Test Description | Type |
|---|-----------------|------|
| 1 | `createCollaborationRun()` emits `collaboration_created` event | New |
| 2 | `createReferral()` emits `referral_created` event with correct fields | New |
| 3 | `createReferral()` duplicate path emits `referral_duplicate` event | New |
| 4 | `startReferralExecution()` emits `referral_started` event with executionId | New |
| 5 | `completeReferral()` emits `referral_completed` event with result | New |
| 6 | `failReferral()` emits `referral_failed` event with result | New |
| 7 | `cancelReferral()` emits `referral_cancelled` event with reason | New |
| 8 | `cancelCollaboration()` emits `collaboration_cancelled` event with affected referral IDs | New |
| 9 | `validateReferral()` depth breach emits `safety_limit_breached` event before throw | New |
| 10 | `validateReferral()` loop detected emits `safety_limit_breached` event before throw | New |
| 11 | `validateReferral()` agent limit emits `safety_limit_breached` event before throw | New |
| 12 | All emitted events match `OrchestrationAuditEvent` contract shape | New |
| 13 | Events carry correct `collaborationRunId` and `referralTraceId` | New |
| 14 | Events carry correct source/target builder identity | New |
| 15 | All pre-existing 07B/07C1/07C2 tests continue to pass (backward compatibility) | Existing — regression |

Estimated test additions: ~14 new tests added to existing spec file.

---

## 10. Split Decision

### 10.1 Scope Assessment

| Factor | Assessment |
|--------|-----------|
| Files to change | 2 modified + 1 new (recorder) |
| Methods to change | 8 existing methods + 2 new methods |
| New tests | ~14 |
| Contracts changes | NONE — existing union is sufficient |
| Worker changes | NONE |
| DB migration | NONE |
| Frontend changes | NONE |
| Risk level | LOW–MEDIUM (existing patterns, no new infrastructure, no cross-service coupling) |

### 10.2 Decision: **A — Proceed with one bounded Step 3 implementation**

The scope is bounded:
- Only touches `OrchestrationService` and its test file in API Gateway
- One new file (recorder) following established pattern
- No contract changes, no worker changes, no DB migration, no frontend
- All events follow the existing `OrchestrationAuditEvent` contract from 07A
- Pattern matches `InMemoryHarnessAuditRecorder` exactly
- ~14 new tests; all existing tests remain backward compatible
- Estimated implementation: single bounded window

**Split is NOT recommended.** The scope fits a single 3-step child-slice loop (registration COMPLETE → implementation → consolidation).

---

## 11. Test Plan

### 11.1 OrchestrationService Audit Event Tests

| # | Test | Validation |
|---|------|-----------|
| 1 | `collaboration_created` event shape | Verify `eventType`, `collaborationRunId`, `sourceBuilder`, `timestamp`, `payload.userId`, `payload.projectId` |
| 2 | `referral_created` event shape | Verify `eventType`, `collaborationRunId`, `referralTraceId`, `sourceBuilder`, `targetBuilder`, `payload.referralId` |
| 3 | `referral_duplicate` event shape | Verify `eventType`, `payload.existingReferralId`, `payload.idempotencyKey` |
| 4 | `referral_started` event shape | Verify `eventType`, `payload.referralId`, `payload.executionId` |
| 5 | `referral_completed` event shape | Verify `eventType`, `payload.referralId`, `payload.resultStatus` |
| 6 | `referral_failed` event shape | Verify `eventType`, `payload.referralId`, `payload.resultStatus` |
| 7 | `referral_cancelled` event shape | Verify `eventType`, `payload.referralId`, `payload.cancelReason` |
| 8 | `collaboration_cancelled` event shape | Verify `eventType`, `payload.cancelledByUserId`, `payload.affectedReferralIds` |
| 9 | `safety_limit_breached` (depth) | Verify `eventType`, `payload.limitType: 'depth_exceeded'` |
| 10 | `safety_limit_breached` (loop) | Verify `eventType`, `payload.limitType: 'loop_detected'` |
| 11 | `safety_limit_breached` (agent) | Verify `eventType`, `payload.limitType: 'agent_limit_exceeded'` |
| 12 | Event contract shape compliance | All events match `OrchestrationAuditEvent` interface fields |
| 13 | `collaborationRunId` presence | Non-null on all events |
| 14 | Source/target builder identity | Correct agent identity on all referral events |

### 11.2 Backward Compatibility

All 25 existing `orchestration.service.spec.ts` tests must pass unchanged.

### 11.3 Not in Test Plan

| Exclusion | Reason |
|-----------|--------|
| Worker metadata preservation tests | Already covered by 55 tests in `worker.processor.builder-config.spec.ts` — no worker changes |
| Browser smoke | No UI |
| Runtime canary | No runtime execution |
| DB integration | No DB migration |
| Harness event enrichment | Separate concern — not in scope |

---

## 12. Risks/Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Event shape compatibility | LOW | Existing `OrchestrationAuditEvent` contract from 07A covers all fields; `payload` provides extensibility |
| 2 | Noisy logging risk | LOW | Events are emitted only at lifecycle transition points (not per-iteration); structured JSON prevents log flood; same density as existing harness events |
| 3 | Future billing/audit attribution alignment | LOW | Events carry `collaborationRunId`, `referralTraceId`, builder identity — sufficient for future billing attribution correlation; no billing enforcement in this task |
| 4 | Migration risk | NONE | No DB migration; in-memory + logger only |
| 5 | WorkerProcessor coupling risk | NONE | Worker is NOT modified in this task; orchestration events stay in API Gateway boundary |
| 6 | Test fragility risk | LOW | New tests verify event emission count and shape; existing tests are backward compatible; no timing-dependent assertions |
| 7 | Deferred events (timeout, approval) | LOW | `referral_timed_out`, `collaboration_timed_out`, `referral_approved`, `referral_rejected`, `safety_limit_approached` require infrastructure not yet built; these are explicitly deferred and documented |
| 8 | Recorder memory growth | LOW | In-memory recorder grows with lifecycle events per collaboration run; bounded by max agents (4) × max depth (3) = ~20 events max per collaboration; process restart clears |

**No blockers identified.** All risks are LOW severity and mitigated by existing patterns.

---

## 13. UX/UI Constraints

- No UI expected in AGENT-PLATFORM-07D.
- If future UI text is added for orchestration/audit visibility, update:
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`).
- Do NOT add hardcoded English UI copy.
- Icons: **Heroicons v2 Outline only**.
- Impeccable and Emil Kowalski skills are **advisory only** — must not override governance, scope, architecture, or tests.

---

## 14. Step 3 Readiness Conclusion

### 14.1 Ready / Not Ready

**READY — AGENT-PLATFORM-07D Step 3 implementation can proceed.**

### 14.2 Recommended Implementation Model

- **Model:** GPT-5.3 Codex (routine bounded implementation, established patterns, no security-adjacent work, no architecture changes)
- **Loop:** 3-step loop — registration COMPLETE (Step 1), readiness review COMPLETE (Step 2 — this document), implementation (Step 3), consolidation/checkpoint (Step 4)
- **Remaining steps:** Step 3 (implementation) + Step 4 (consolidation/checkpoint)
- **Window:** New window recommended (current context is large from review)

### 14.3 Exact Next Prompt Type

Implementation prompt for Step 3 — bounded to:
1. Create `orchestration-audit.recorder.ts` (in-memory recorder following harness pattern)
2. Modify `orchestration.service.ts` (add `emitEvent()` helper, inject Logger, add event emission at each lifecycle transition)
3. Modify `orchestration.service.spec.ts` (add ~14 event verification tests)
4. Run validation: `npx jest --runInBand "orchestration.service"` + `npx tsc --noEmit`

### 14.4 Keith Approval

Keith approval is NOT needed before Step 3 implementation — registration (Step 1) was already approved 2026-07-10. This readiness review (Step 2) confirms the implementation scope is bounded and safe. Step 3 can proceed directly.

---

## 15. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — 07D ACTIVE confirmation |
| 2 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence — 07D position confirmed |
| 3 | `docs/AGENT-PLATFORM-07-CHECKPOINT.md` | 07 planning checkpoint |
| 4 | `docs/AGENT-PLATFORM-07A-CHECKPOINT.md` | 07A contracts checkpoint |
| 5 | `docs/AGENT-PLATFORM-07B-CHECKPOINT.md` | 07B module skeleton checkpoint |
| 6 | `docs/AGENT-PLATFORM-07C-CHECKPOINT.md` | 07C parent close checkpoint |
| 7 | `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md` | 07C1 core methods checkpoint |
| 8 | `docs/AGENT-PLATFORM-07C2-CHECKPOINT.md` | 07C2 enqueue/cancel checkpoint |
| 9 | `docs/AGENT-PLATFORM-07C3-CHECKPOINT.md` | 07C3 validation checkpoint |
| 10 | `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md` | 22-section coordinator plan |
| 11 | `services/api-gateway/src/orchestration/orchestration.contracts.ts` | Existing contracts (07A) |
| 12 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Existing service (07B/07C1/07C2) |
| 13 | `services/api-gateway/src/orchestration/orchestration.module.ts` | Existing module (07B/07C2) |
| 14 | `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` | Existing tests (07B/07C1/07C2) |
| 15 | `services/ai-service/src/worker/worker.processor.ts` | Worker — structured logging patterns |
| 16 | `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` type |
| 17 | `services/api-gateway/src/safety/audit-log.service.ts` | Operator audit pattern (not reusable) |
| 18 | `services/ai-service/src/agent-harness/audit/harness-audit-events.ts` | Harness audit event types (reusable pattern) |
| 19 | `services/ai-service/src/agent-harness/audit/harness-audit-recorder.ts` | In-memory recorder (reusable pattern) |
| 20 | `services/ai-service/src/agent-harness/audit/index.ts` | Audit barrel exports |

---

## 16. Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | Exact file created: `docs/AGENT-PLATFORM-07D-AUDIT-EVENT-READINESS-REVIEW.md` | CONFIRMED |
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
| 18 | AGENT-PLATFORM-07D ready for Step 3 | CONFIRMED |

---

## Document Metadata

- **Created:** 2026-07-10
- **Task:** AGENT-PLATFORM-07D Step 2 — Audit Event Readiness / Source-Path Review
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
