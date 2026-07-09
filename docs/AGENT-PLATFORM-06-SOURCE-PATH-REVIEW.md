# AGENT-PLATFORM-06 — Source-Path Review for Upstream Identity Propagation

**Task ID:** AGENT-PLATFORM-06
**Step:** 2 — Readiness / Source-Path Review
**Status:** Step 2 COMPLETE
**Date:** 2026-07-09
**Nature:** Read-only static review — no implementation, no runtime execution
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-06 ACTIVE | **PASS** — registered in TASKS.md and TASKS_BACKLOG_FULL.md; Step 1 COMPLETE (Registration 2026-07-09); Keith approval recorded |
| AGENT-PLATFORM-05 COMPLETE and LOCKED | **PASS** — 2026-07-09; Multi-Builder Runtime Orchestration Plan; all 4 steps complete |
| AGENT-PLATFORM-04 COMPLETE and LOCKED | **PASS** — 2026-07-07; Multi-Builder Runtime Topology Plan; role+profile identity model |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **PASS** — 2026-07-07; Per-Builder Harness Config Adapter; all 3 child slices complete |
| AGENT-HARNESS-06E COMPLETE and LOCKED | **PASS** — 2026-07-09; Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary; PASS |
| One-active-task rule satisfied | **PASS** — only AGENT-PLATFORM-06 is ACTIVE |

**Governance readiness: PASS — all prerequisites satisfied.**

---

## 2. Exact Current Execution Path

### 2.1 Frontend Request Origin

**Primary execution file:** `frontend/app/[locale]/app/page.tsx`

The frontend calls `POST /api/ai/execute` with the following payload:

```typescript
{
  prompt: string,
  provider: string,             // e.g. 'anthropic', 'openai'
  model: string,                // e.g. 'claude-3-5-sonnet-20241022'
  sessionId: string,            // session UUID
  conversationId: string,       // same as sessionId currently
  workspaceContext?: object,     // optional file tree / selected file context
}
```

**Identity fields in frontend request: ALL ABSENT.** No `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`, `harnessVersion`, or `apiKeyId` in the frontend request body.

The driver page (`frontend/app/[locale]/driver/page.tsx`) uses the same `/api/ai/execute` endpoint with the same payload shape.

### 2.2 API Gateway — AIExecutionRequest Type

**File:** `services/api-gateway/src/clients/ai-service-http.client.ts` (lines 43–53)

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
}
```

**Identity fields on AIExecutionRequest: ABSENT.** No `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`.

### 2.3 API Gateway — AIExecutionController

**File:** `services/api-gateway/src/ai/ai-execution.controller.ts`

**Endpoint:** `POST /api/ai/execute` (line 380)

Guard chain: `SessionOrApiKeyAuthGuard` → `AuthorizationGuard` → `ExecutionSafetyGuard` → `LaunchGuard` → `AbortGuard` → `IdempotencyGuard` → `QuotaGuard` → `TokenQuotaGuard` → `RateLimitGuard`

The `execute()` method (line 385):
1. Validates `sessionId` is a valid UUID
2. Validates `harnessVersion` allow-list (only `'v1'` accepted)
3. Checks harness entitlement if `harnessVersion` is present
4. Verifies session ownership via `SessionService`
5. Resolves provider, model, global instructions, project instructions, repo doc context
6. Writes execution intent to ledger via `UsageLedgerService.writeExecutionIntent()`
7. Enqueues execution via `QueueService.enqueueExecution()`

### 2.4 API Gateway — UsageLedgerService.writeExecutionIntent()

**File:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` (line 126)

Intent write creates a `UsageRecord` with:

```typescript
{
  executionId,
  apiKeyId,
  userId,
  sessionId,
  conversationId,
  provider,
  adapter,
  requestId,
  metadata,
  executionStatus: 'pending',
}
```

**Identity fields written to UsageRecord intent: ABSENT.** No `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`.

### 2.5 API Gateway — QueueService.enqueueExecution()

**File:** `services/api-gateway/src/queue/queue.service.ts` (line 39)

```typescript
async enqueueExecution(jobData: any): Promise<void> {
  await this.queue.add('execute-ai', jobData, {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  });
}
```

The controller passes this job payload to `enqueueExecution()` (controller lines 568–584):

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
}
```

**Identity fields in BullMQ job payload: ABSENT.** No `agentRole`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`, `collaborationRunId`, `referralTraceId`.

### 2.6 BullMQ Job Submission Boundary

Queue name: `ai-execution`
Job name: `execute-ai`
BullMQ options: `{ attempts: 1, removeOnComplete: true, removeOnFail: false }`

The `QueueService.enqueueExecution()` accepts `jobData: any` — no type constraint. It passes the entire object to `queue.add()` verbatim.

### 2.7 AI Service — AiExecutionJob Type

**File:** `services/ai-service/src/queue/job.types.ts` (lines 34–65)

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

  /** Per-builder identity fields (AGENT-HARNESS-07B). */
  agentRole?: string;
  builderProfileId?: string;
  harnessProfileId?: string;
  modelProfileId?: string;
  toolPermissionProfileId?: string;
}
```

**`agentRole`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`** — PRESENT as optional fields on the type, added by AGENT-HARNESS-07B.

**`collaborationRunId`, `referralTraceId`** — ABSENT from the type.

### 2.8 AI Service — WorkerProcessor Job Consumption

**File:** `services/ai-service/src/worker/worker.processor.ts`

The worker reads identity fields from `job.data` in the harness branch (lines 767–774):

```typescript
const { config: resolvedConfig, metadata: configResolutionMetadata } =
  resolveBuilderHarnessConfig(
    {
      agentRole: job.data.agentRole,
      builderProfileId: job.data.builderProfileId,
    },
    DEFAULT_AGENT_HARNESS_CONFIG_V1,
  );
```

Since the API Gateway **never populates** `agentRole` or `builderProfileId` on the job payload, `resolveBuilderHarnessConfig` always receives `{ agentRole: undefined, builderProfileId: undefined }`, which triggers the `global-default-missing-profile` resolution path.

### 2.9 AI Service — Harness Audit Event

The worker emits `agent_harness.config_resolved` event (lines 776–784) with:

```typescript
{
  event: 'agent_harness.config_resolved',
  executionId: job.data.executionId,
  source: configResolutionMetadata.source,           // always 'global-default-missing-profile'
  builderProfileId: configResolutionMetadata.builderProfileId ?? null,  // always null
  harnessProfileId: configResolutionMetadata.harnessProfileId ?? null,
  fieldsOverridden: configResolutionMetadata.fieldsOverridden,
  warnings: configResolutionMetadata.warnings,
}
```

`AgentHarnessAuditEventV1.payload` is `Record<string, unknown>` — untyped, so identity fields CAN be added to audit event payloads without contract changes.

### 2.10 AI Service — UsageRecord Update (Ledger Finalization)

The worker updates `usage_records` directly via raw SQL (lines 1017–1026):

```sql
UPDATE usage_records
SET execution_status = 'completed',
    tokens_used = $2,
    metadata = $3::jsonb
WHERE execution_id = $1
```

**Identity fields NOT written** — the UPDATE only touches `execution_status`, `tokens_used`, and `metadata`. The `metadata` JSONB column stores `aiExecutionResult` (output, tokens, model, provider, fileActions) and optionally `preApplyCheckpointHash`. No `agentRole`, `builderProfileId`, `collaborationRunId`, or `referralTraceId` in the metadata.

### 2.11 API Gateway — Credit Deduction / Billing Attribution

**File:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` (lines 717–788)

`emitDeductionAttempt()` constructs a `CreditDeductionEvent` with:

```typescript
{
  source: 'usage_ledger',
  sourceEventId: record.executionId,
  ownerId: record.userId,
  lineItems: [{ category: 'model_tokens', unit: 'token', unitCount, creditsRequested: 0 }],
  metadata: { model, executionDurationMs, sessionId },
}
```

**Identity fields in CreditDeductionEvent: ABSENT.** No `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`.

---

## 3. Current Identity Support

### 3.1 Where `agentRole` Exists

| Location | Status |
|----------|--------|
| `AiExecutionJob` type (`services/ai-service/src/queue/job.types.ts`) | OPTIONAL field — present since AGENT-HARNESS-07B |
| `AgentHarnessRunRequestV1` contract | OPTIONAL field — present since AGENT-HARNESS-07B |
| `WorkerProcessor` — `resolveBuilderHarnessConfig` call | READ from `job.data.agentRole` — always `undefined` today |
| `BuilderProfileV1` contract | Typed field on builder profile |
| `DEFAULT_BUILDER_PROFILE_V1` registry | `agentRole: 'builder'` |
| Orchestration plan (§4 design doc) | Designed — not implemented |

### 3.2 Where `builderProfileId` Exists

| Location | Status |
|----------|--------|
| `AiExecutionJob` type | OPTIONAL field — present since AGENT-HARNESS-07B |
| `AgentHarnessRunRequestV1` contract | OPTIONAL field — present since AGENT-HARNESS-07B |
| `WorkerProcessor` — `resolveBuilderHarnessConfig` call | READ from `job.data.builderProfileId` — always `undefined` today |
| `BuilderProfileV1` contract | Typed field on builder profile |
| `DEFAULT_BUILDER_PROFILE_V1` registry | `builderProfileId: 'builder-default'` |
| `agent_harness.config_resolved` audit event payload | Present (via adapter metadata) — always `null` today |

### 3.3 Where `harnessProfileId` / `modelProfileId` / `toolPermissionProfileId` Exist

| Location | Status |
|----------|--------|
| `AiExecutionJob` type | OPTIONAL fields — present since AGENT-HARNESS-07B |
| `AgentHarnessRunRequestV1` contract | OPTIONAL fields — present since AGENT-HARNESS-07B |
| `BuilderProfileV1` contract | Sub-profile references |
| Never populated by API Gateway | Always `undefined` on job data |

### 3.4 Where `collaborationRunId` / `referralTraceId` Are Absent

| Location | Status |
|----------|--------|
| `AiExecutionJob` type | **ABSENT** — not defined |
| `AgentHarnessRunRequestV1` | **ABSENT** — not defined |
| `AIExecutionRequest` (API Gateway) | **ABSENT** — not defined |
| `UsageRecord` entity | **ABSENT** — no DB column |
| `CreditDeductionEvent` | **ABSENT** — not defined |
| `CreditDeductionRecord` entity | **ABSENT** — no DB column |
| `AgentHarnessAuditEventV1` | **ABSENT** — not in contract (could be in payload) |
| Frontend request | **ABSENT** — not sent |
| Worker code | **ABSENT** — never referenced |
| All source code in `services/` | **ABSENT** — only exists in docs |

### 3.5 Backward Compatibility Today

All identity fields on `AiExecutionJob` and `AgentHarnessRunRequestV1` are OPTIONAL. The `resolveBuilderHarnessConfig` adapter handles `undefined` gracefully via `global-default-missing-profile` fallback. Adding values to these fields is fully backward-compatible — existing single-builder behavior is preserved when fields are absent.

---

## 4. Current Gaps

### Gap 1 — Frontend Missing Identity Fields

**Location:** `frontend/app/[locale]/app/page.tsx`
**Gap:** The execution request payload (`POST /api/ai/execute`) sends only `{ prompt, provider, model, sessionId, conversationId, workspaceContext }`. No `agentRole`, `builderProfileId`, `harnessVersion`, or collaboration fields are included.
**Impact:** API Gateway cannot forward identity fields it never receives.
**Fix complexity:** LOW — add optional fields to the request body.

### Gap 2 — AIExecutionRequest Type Missing Identity Fields

**Location:** `services/api-gateway/src/clients/ai-service-http.client.ts`
**Gap:** `AIExecutionRequest` interface does not include `agentRole`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`, `collaborationRunId`, or `referralTraceId`.
**Impact:** The controller's type system cannot express identity fields on incoming requests.
**Fix complexity:** LOW — add optional fields to the interface.

### Gap 3 — API Gateway Controller Does Not Forward Identity Fields

**Location:** `services/api-gateway/src/ai/ai-execution.controller.ts` (lines 568–584)
**Gap:** The `execute()` method constructs the job payload for `queueService.enqueueExecution()` without including `agentRole`, `builderProfileId`, or any identity fields (beyond what `harnessVersion` already covers).
**Impact:** Even if the frontend or API Gateway type system included these fields, they would not reach the BullMQ job.
**Fix complexity:** LOW — spread or explicitly add identity fields to the job payload.

### Gap 4 — UsageRecord Entity Missing Identity Columns

**Location:** `services/api-gateway/src/entities/usage-record.entity.ts`
**Gap:** The `usage_records` table has no columns for `agent_role`, `builder_profile_id`, `collaboration_run_id`, or `referral_trace_id`.
**Impact:** Identity cannot be attributed on usage records even if propagated through the job path.
**Fix complexity:** MEDIUM — requires adding nullable columns. This can be done via:
  - Option A: New TypeORM migration (proper but requires DB migration)
  - Option B: Store in existing `metadata` JSONB column (no migration but not queryable via SQL)
**Recommendation for Step 3:** Use `metadata` JSONB for now (no migration). Register a future task for proper column migration if query-based attribution is needed.

### Gap 5 — UsageLedgerService writeExecutionIntent Does Not Accept Identity Fields

**Location:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`
**Gap:** `WriteExecutionIntentDto` does not include identity fields. `writeExecutionIntent()` does not write them to the usage record.
**Impact:** Even if the controller had identity fields, the usage intent write would not persist them.
**Fix complexity:** LOW — add optional fields to DTO and include in metadata or future columns.

### Gap 6 — Worker Ledger Finalization Does Not Write Identity Fields

**Location:** `services/ai-service/src/worker/worker.processor.ts` (lines 1017–1026)
**Gap:** The `UPDATE usage_records` SQL sets `execution_status`, `tokens_used`, `metadata` — identity fields from `job.data` are not included in the metadata merge.
**Impact:** Even after identity propagation to the job payload, the worker's ledger finalization does not persist `agentRole` or `builderProfileId` to the usage record.
**Fix complexity:** LOW — add identity fields to the `nextMetadata` object before the UPDATE.

### Gap 7 — CreditDeductionEvent Missing Identity Fields

**Location:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` (lines 731–748)
**Gap:** `emitDeductionAttempt()` constructs `CreditDeductionEvent` without `agentRole`, `builderProfileId`, `collaborationRunId`, or `referralTraceId`.
**Impact:** Per-builder billing attribution is impossible at the deduction record level.
**Fix complexity:** LOW — add fields to deduction event metadata. No `CreditDeductionEvent` contract change needed if stored in `metadata` field.

### Gap 8 — Tests Missing

No existing tests verify identity field propagation through the execution path. Key test gaps:
- Controller test: identity fields forwarded to `enqueueExecution()`
- Queue service test: identity fields present in BullMQ job data
- Worker test: identity fields read from job data and written to usage record metadata
- Usage ledger test: identity fields persisted to usage record

---

## 5. Safe Step 3 Implementation Boundary

### 5.1 Exact Files Likely to Change

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/clients/ai-service-http.client.ts` | Add optional `agentRole`, `builderProfileId` to `AIExecutionRequest` |
| 2 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Forward `agentRole`, `builderProfileId` from request to job payload |
| 3 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Add identity fields to `WriteExecutionIntentDto`; persist in `metadata` JSONB |
| 4 | `services/ai-service/src/queue/job.types.ts` | Add optional `collaborationRunId`, `referralTraceId` (future-safe placeholders) |
| 5 | `services/ai-service/src/worker/worker.processor.ts` | Include `agentRole`, `builderProfileId` in `nextMetadata` during ledger finalization |
| 6 | `frontend/app/[locale]/app/page.tsx` | Add optional `agentRole`, `builderProfileId` to execution request body (can default to `undefined` initially) |

### 5.2 Exact Tests Likely to Add/Update

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Test identity fields forwarded to enqueue |
| 2 | `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts` | Test identity fields persisted in metadata |
| 3 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | Test identity fields written to usage record metadata during finalization |

### 5.3 Implementation Constraints

- **Optional fields only** — all identity fields must be optional; single-builder executions must be unaffected
- **Preserve existing single-builder behavior** — when fields are absent, resolution defaults to `global-default-missing-profile`
- **No migration** — use `metadata` JSONB column for identity attribution; defer proper column migration to future task
- **No runtime orchestration** — no collaboration coordinator, no referral routing
- **No write tool activation** — read-only tools remain the only activated tools
- **No frontend UI redesign** — only add optional fields to the request body; no new UI components, no user-facing text
- **No billing enforcement** — attribution only; no per-builder credit limits

---

## 6. Recommended Implementation Shape

### 6.1 Assessment: One Bounded Step 3 Is Safe

The scope is bounded, all changes are optional-field additions, and no migration is needed. The total diff is estimated at ~80–120 lines of production code changes across 6 files, plus ~60–100 lines of test additions/updates across 3 test files.

**Recommendation: ONE bounded Step 3 implementation is safe.**

### 6.2 Why Splitting Is Not Necessary

| Proposed Child Slice | Assessment |
|---------------------|------------|
| AGENT-PLATFORM-06A — API Gateway DTO/enqueue identity propagation | ~40 lines of changes across 3 files; too small to justify a separate slice |
| AGENT-PLATFORM-06B — Frontend request identity propagation | ~10 lines of changes in 1 file; trivially small |
| AGENT-PLATFORM-06C — Usage/audit attribution preservation | ~30 lines of changes across 2 files; interdependent with 06A (needs the fields to flow through first) |

All three would share the same validation commands, the same test scope, and the same consolidation checkpoint. Splitting would triple the governance overhead (3 registrations, 3 checkpoints, 3 TASKS.md updates) for a combined ~80–120 line diff.

### 6.3 Conditions That Would Require Splitting

If Step 3 implementation reveals any of the following, splitting should be reconsidered:

- DB migration is required (e.g., `UsageRecord` needs proper columns instead of JSONB metadata)
- Frontend changes require new user-facing UI text (multilingual updates needed)
- The combined diff exceeds ~200 lines of production code changes
- Test failures reveal unexpected dependencies

---

## 7. Test Plan for Step 3

### 7.1 Targeted Unit Tests

| Test | File | Scope |
|------|------|-------|
| Controller forwards identity fields to enqueue | `ai-execution.controller.spec.ts` | Verify `agentRole`, `builderProfileId` from request body appear in `enqueueExecution()` call args |
| Controller omits identity fields when absent | `ai-execution.controller.spec.ts` | Verify backward compatibility — existing tests continue to pass without identity fields |
| Usage intent persists identity in metadata | `usage-ledger.service.spec.ts` | Verify `writeExecutionIntent()` stores `agentRole`, `builderProfileId` in record metadata |
| Worker writes identity to ledger metadata | `worker.processor.builder-config.spec.ts` | Verify `agentRole`, `builderProfileId` from `job.data` appear in finalized usage record metadata |

### 7.2 Validation Commands

```powershell
# API Gateway tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test

# API Gateway build
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build

# AI Service tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test

# AI Service build
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build

# Frontend typecheck (if frontend files changed)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
```

### 7.3 No Browser Smoke

No browser smoke required — this is internal identity field propagation with no user-facing UI changes.

---

## 8. UX/UI Constraints

- **No new user-facing UI text expected.** Step 3 adds optional fields to internal request/response contracts only.
- If future work adds user-facing text (e.g., builder profile selector), aiSandBox is **multilingual-first**:
  - Update `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`
  - Use existing translation hooks (`useTranslations` / `next-intl`)
  - Do NOT add hardcoded English UI copy
- **Heroicons v2 Outline only** for any future icons
- **Impeccable / Emil Kowalski skills** are advisory only — must not override governance, scope, architecture, or tests

---

## 9. Risks and Blockers

### 9.1 Type Compatibility

**Risk:** LOW. All identity fields are optional on both `AiExecutionJob` and `AIExecutionRequest`. The `QueueService.enqueueExecution()` accepts `any` — no type constraint to break. The `resolveBuilderHarnessConfig` adapter already handles `undefined` gracefully.

### 9.2 Legacy Request Compatibility

**Risk:** LOW. Existing frontend requests do not send identity fields. The API Gateway controller will simply not forward them (they remain `undefined` on the job payload). Worker resolution defaults to `global-default-missing-profile` — identical to current behavior.

### 9.3 Test Coverage

**Risk:** LOW-MEDIUM. Existing controller tests and worker tests must continue to pass. New tests must verify identity propagation without breaking existing test fixtures. The builder-config test file (`worker.processor.builder-config.spec.ts`) already tests the adapter resolution path, so the pattern is established.

### 9.4 Audit/Billing Attribution Ambiguity

**Risk:** LOW for Step 3 scope. Step 3 stores identity in `metadata` JSONB — not in proper DB columns. This is sufficient for audit logging but not for SQL-based reporting queries. Proper column migration is deferred to a future task.

### 9.5 Migration Risk

**Risk:** NONE for Step 3. No DB migration is required. Identity fields will be stored in the existing `metadata` JSONB column. A future task may add proper columns if SQL-based attribution queries are needed.

### 9.6 `collaborationRunId` / `referralTraceId` Future-Safe Placeholders

**Risk:** LOW. Step 3 should add these as optional fields on `AiExecutionJob` only (TypeScript type extension). They will remain `undefined` until the orchestration coordinator (future task) is implemented. No frontend, API Gateway service, or worker behavior changes for these fields in Step 3.

---

## 10. Step 3 Readiness Conclusion

### 10.1 Ready for Step 3?

**YES — AGENT-PLATFORM-06 is ready for Step 3 (bounded implementation).**

### 10.2 Recommended Next Prompt Type

**Implementation prompt** — 3-step loop:
1. Stage-start / registration is already done (Step 1 COMPLETE)
2. Source-path review is done (this document — Step 2 COMPLETE)
3. Bounded implementation (Step 3 — NEXT)
4. Consolidation / checkpoint (Step 4)

### 10.3 Recommended Step 3 Scope

**One bounded implementation covering:**

1. Add optional `agentRole`, `builderProfileId` to `AIExecutionRequest` type
2. Forward identity fields from controller to `enqueueExecution()` job payload
3. Add optional `agentRole`, `builderProfileId` to `WriteExecutionIntentDto`; store in `metadata` JSONB during intent write
4. Add optional `collaborationRunId`, `referralTraceId` to `AiExecutionJob` type (future-safe placeholders, always `undefined` for now)
5. Include `agentRole`, `builderProfileId` from `job.data` in worker ledger finalization `nextMetadata`
6. Add optional identity fields to frontend execution request body (default `undefined` — no UI changes)
7. Add/update targeted unit tests for identity propagation
8. Validate all API Gateway tests pass, all AI Service tests pass, frontend typecheck passes

**Do NOT register child slices.** One bounded implementation is sufficient.

---

## 11. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — AGENT-PLATFORM-06 registration, status verification |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — mirror verification |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, current next task |
| 4 | `docs/AGENT-PLATFORM-05-CHECKPOINT.md` | Prerequisite — orchestration plan checkpoint |
| 5 | `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` | Prerequisite — orchestration plan (19 sections) |
| 6 | `docs/AGENT-HARNESS-07-CHECKPOINT.md` | Prerequisite — per-builder config adapter checkpoint |
| 7 | `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Prerequisite — full E2E canary checkpoint |
| 8 | `docs/AGENT-PLATFORM-06-CHECKPOINT.md` | Checked — does not exist yet (expected) |
| 9 | `frontend/app/[locale]/app/page.tsx` | Frontend execution request origin |
| 10 | `frontend/app/[locale]/driver/page.tsx` | Secondary frontend execution request |
| 11 | `services/api-gateway/src/clients/ai-service-http.client.ts` | `AIExecutionRequest` type |
| 12 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution controller — enqueue path |
| 13 | `services/api-gateway/src/queue/queue.service.ts` | BullMQ enqueue service |
| 14 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Usage intent write, deduction attempt, two-phase lifecycle |
| 15 | `services/api-gateway/src/entities/usage-record.entity.ts` | `UsageRecord` entity — DB columns |
| 16 | `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` type |
| 17 | `services/ai-service/src/worker/worker.processor.ts` | Worker job consumption, identity usage, ledger finalization |
| 18 | `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | `AgentHarnessRunRequestV1` contract |
| 19 | `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts` | Harness config adapter (referenced in checkpoint) |
| 20 | `services/ai-service/src/agent-harness/builder-profiles/builder-profile.registry.ts` | Static builder profile registry (referenced in checkpoint) |

---

## 12. Summary

| Item | Result |
|------|--------|
| File created | `docs/AGENT-PLATFORM-06-SOURCE-PATH-REVIEW.md` (this document) |
| Files inspected | 20 source/governance files |
| Governance readiness | **PASS** — all 6 criteria satisfied |
| Execution path | Frontend → API Gateway controller → QueueService → BullMQ → Worker → usage_records (raw SQL) |
| Identity support | `agentRole`/`builderProfileId` exist on `AiExecutionJob` + worker contracts; never populated upstream |
| Gaps | 8 gaps identified (§4) — frontend, request type, controller, usage entity, usage DTO, worker finalization, credit event, tests |
| Step 3 boundary | 6 production files, 3 test files, ~80–120 lines production + ~60–100 lines tests |
| Split recommendation | **One bounded Step 3** — splitting is unnecessary |
| Test plan | 4 targeted unit test categories; no browser smoke |
| Risks/blockers | None blocking; all LOW or LOW-MEDIUM |
| Source/governance files changed | ONLY this review document created |
| Tests/builds/runtime/provider calls | NONE executed |
| AGENT-PLATFORM-06 ready for Step 3 | **YES** |

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-06 Step 2 — Readiness / Source-Path Review
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
