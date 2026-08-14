# PRIVATE-BETA-BLOCKER-03D — Stage-Start: Accounting Lifecycle Diagnosis + Credit Policy Matrix

**Task ID:** PRIVATE-BETA-BLOCKER-03D
**Title:** No-Workspace-Result Credit Policy
**Step:** Step 2 — Accounting Lifecycle Diagnosis + Credit Policy Matrix
**Status:** STAGE-START COMPLETE — CORRECTED 2026-08-14
**Author:** Cursor / Opus 4.6 (read-only diagnosis; no source modification; no runtime mutation)

---

## Correction Notice

**This document replaces the initial Stage Start completed earlier on 2026-08-14.**

The initial Stage Start concluded that Scenarios D (Build apply failure) and E (partial apply) were "POLICY BLOCKED" and should be deferred, with Step 3 reduced to validation tests only. That conclusion was insufficient because:

1. **03D was registered specifically** to determine and implement the credit policy when provider usage exists but the requested Builder workspace result is not successfully delivered. Declaring "we can't do anything" without evaluating whether a bounded architecture addition is feasible fails the registered objective.

2. **The architecture gap is small and bounded.** The backend lacks apply-result visibility, but the frontend already has the `executionId`, the per-action apply results, and the aggregate apply status at apply completion time. A single new endpoint and a conditional check in `triggerDeductionForExecution()` closes the gap without new services, queues, or cross-cutting refactors.

3. **The "delay deduction" approach fits the existing architecture.** The current `sourceEventId = executionId` idempotent deduction mechanism naturally supports delayed triggering. No refund mechanism is needed.

4. **Deferring D/E means knowingly charging users for failed Build delivery** without an explicit evidence-backed product policy deliberately choosing that outcome. For 03D's registered purpose, this is not acceptable as a default.

The lifecycle diagnosis (Parts A–D), schema analysis, and scenarios A/C/F/G from the initial Stage Start remain valid and are preserved below with corrections where needed.

---

## 1. Objective

Diagnose the complete credit/accounting lifecycle and produce an explicit outcome-policy matrix with a corrected architecture direction that handles ALL scenarios (A–G) including Build apply failure, to inform Step 3 implementation.

**This document does NOT implement the policy.** It establishes the architecture baseline, identifies constraints, selects a policy direction, and defines the smallest safe implementation surface.

---

## 2. Authoritative Predecessor State

| Task | Status |
|------|--------|
| PRIVATE-BETA-BLOCKER-03A | COMPLETE AND LOCKED — ROOT CAUSE PROVEN |
| PRIVATE-BETA-BLOCKER-03B | COMPLETE AND LOCKED — 2026-08-11 — PASS |
| BUILDER-INTENT-01 | COMPLETE AND LOCKED — 2026-08-13 |
| PRIVATE-BETA-BLOCKER-03C | COMPLETE AND LOCKED — 2026-08-14 |
| PRIVATE-BETA-BLOCKER-03E | COMPLETE AND LOCKED — 2026-08-13 |
| PRIVATE-BETA-BLOCKER-03D | REGISTERED / ACTIVE — Step 1 COMPLETE — Step 2 this document (CORRECTED) |

Safety state: `GLOBAL_EXECUTION_ENABLED=false`, `BILLING_CHARGES_ENABLED=false`

---

## 3. Current Execution Lifecycle (Part A) — Preserved from Initial Stage Start

### Ordered lifecycle stages

| # | Stage | Service | Source file | Function/Method | Persisted record | Key status/metadata | Boundary to next |
|---|-------|---------|-------------|-----------------|-----------------|---------------------|------------------|
| 1 | User submits prompt | Frontend | `frontend/app/[locale]/app/page.tsx` | `handleSubmitChatPrompt()` | — | `executionIntent` from `useState` | HTTP POST `/api/ai/execute` |
| 2 | Validation + intent write | API Gateway | `services/api-gateway/src/ai/ai-execution.controller.ts` | `AIExecutionController.execute()` | `usage_records` row, `execution_status='pending'` | executionId, userId, provider, sessionId, requestId | Guards → `usageLedgerService.writeExecutionIntent()` |
| 3 | Queue enqueue | API Gateway | `ai-execution.controller.ts` | `queueService.enqueueExecution()` | BullMQ job | `AiExecutionJob` payload incl. `executionIntent` | BullMQ Redis queue |
| 4 | Worker claims job | AI Service | `services/ai-service/src/worker/worker.processor.ts` | `process()` | `usage_records` UPDATE → `execution_status='running'` | atomic pending→running transition | Direct SQL UPDATE |
| 5 | Build prompt + call provider | AI Service | `worker.processor.ts` → `ai-execution.service.ts` → `xai-ai.adapter.ts` | `AIExecutionService.execute()` → `adapter.execute()` | — | provider API call | OpenAI SDK HTTP |
| 6 | Parse response | AI Service | `file-actions.parser.ts` | `extractFileActionsFromOutput()` | — | `parseMethod`, `fileActions[]`, `workspaceMutationAttempted` | Return to worker |
| 7 | Contract validation | AI Service | `worker.processor.ts` | `validatePlainPathFileActionContract()` | — | `isContractFailure`, `executionIntent` | Branches: failure or completion |
| 8a | Contract failure path | AI Service | `worker.processor.ts` | Inline | `usage_records` UPDATE → `execution_status='failed'`, `tokens_used`, `metadata` | `file_action_contract_failure` | `publishCompletion()` — NO `notifyExecutionComplete()` |
| 8b | Completion path | AI Service | `worker.processor.ts` | Inline | `usage_records` UPDATE → `execution_status='completed'`, `tokens_used`, `metadata` | tokens, model, aiExecutionResult | `publishCompletion()` THEN `notifyExecutionComplete()` |
| 9 | Accounting notification | AI Service → API Gateway | `api-gateway-http.client.ts` → `internal-accounting.controller.ts` | `notifyExecutionComplete()` → `finalizeAccounting()` | — | HTTP POST `/api/internal/executions/:id/finalize-accounting` | Internal service key auth |
| 10 | Deduction trigger | API Gateway | `usage-ledger.service.ts` | `triggerDeductionForExecution()` | — | Checks `executionStatus === 'completed'`; skips non-completed | Calls `emitDeductionAttempt()` |
| 11 | Credit deduction | API Gateway | `persistent-credit-deduction.gateway.ts` | `applyDeduction()` | `credit_deduction_records` row + `credit_balances` UPDATE | Atomic transaction: lock→insert→update | `sourceEventId = executionId` for idempotency |
| 12 | Frontend SSE/poll | Frontend | `page.tsx` | SSE stream + poll | — | `nextStatus`, `fileActions[]` | `applySequentialFileActions()` |
| 13 | Workspace file apply | Frontend → API Gateway → Container Manager | `page.tsx` → `workspace-file-navigation.logic.ts` → `container-manager` | `writeWorkspaceFile()` per action | Workspace filesystem | `applyStatus: 'applied'/'skipped'` | Per-file HTTP POST |
| 14 | Post-apply coherence | Frontend | `page.tsx` | `maybeRunExecutionCoherence()` | — | file tree refresh, preview refresh, checkpoint | — |

### Critical observation

**Workspace file application (stage 13) occurs AFTER credit deduction (stage 11).** The frontend applies file actions to the workspace only after receiving the completion event, which is published AFTER the worker writes `completed` status and calls `notifyExecutionComplete()`. By the time the frontend begins applying files, credit deduction has already been triggered and likely completed.

---

## 4. Exact Credit Deduction Timing (Part B) — Preserved from Initial Stage Start

Credits are deducted **AFTER provider response AND AFTER execution status is set to `completed` in `usage_records`**.

Evidence chain:

1. **Worker `worker.processor.ts` ~line 1227–1236:** After `AIExecutionService.execute()` returns, after contract validation passes, the worker writes `execution_status='completed'`, `tokens_used`, and full metadata (including `executionIntent` in `aiExecutionResult`) via a single atomic SQL UPDATE.

2. **Worker ~line 1262–1268:** Immediately after completion SQL write, calls `this.apiGatewayHttpClient.notifyExecutionComplete(executionId)`.

3. **`api-gateway-http.client.ts` ~line 347–367:** `notifyExecutionComplete()` POSTs to `/api/internal/executions/:executionId/finalize-accounting`.

4. **`internal-accounting.controller.ts` ~line 23–41:** Calls `usageLedgerService.triggerDeductionForExecution(executionId)`.

5. **`usage-ledger.service.ts` ~line 736–778:** `triggerDeductionForExecution()` reads the `usage_records` row, checks `record.executionStatus !== 'completed'` → skips if not completed, then calls `emitDeductionAttempt()`.

6. **`usage-ledger.service.ts` ~line 793–864:** `emitDeductionAttempt()` builds a `CreditDeductionEvent` with `sourceEventId = record.executionId` and `unitCount = record.tokensUsed ?? 0`, then calls `creditDeductionGateway.applyDeduction()`.

7. **`persistent-credit-deduction.gateway.ts` ~line 42–182:** Within a database transaction: checks idempotency via `sourceEventId`, acquires pessimistic write lock on `credit_balances`, calculates credits from token count, creates `credit_deduction_records` row, updates `credit_balances.balance`.

### Deduction timing summary

| Question | Answer |
|----------|--------|
| Before provider request? | NO |
| After provider response? | YES — but only after completion SQL write |
| After execution completion? | YES — this is the trigger |
| Before workspace apply? | **YES — deduction occurs BEFORE frontend applies files** |
| After workspace apply? | NO — deduction precedes workspace apply |

### Refund/reversal capability

**No existing refund/reversal mechanism.** The `credit_deduction_records` table has a `status` column (default `'applied'`) with a comment about "future reversals," but no reversal code exists.

---

## 5. Accounting Records/Schema (Part C) — Preserved from Initial Stage Start

### `usage_records` table

| Column | Type | Purpose |
|--------|------|---------|
| `execution_id` | UUID PK | Unique execution identifier |
| `request_id` | VARCHAR(100) nullable | Client idempotency key; UNIQUE constraint on `(user_id, request_id)` |
| `user_id` | VARCHAR(50) | Billable user |
| `session_id` | UUID | Session link |
| `conversation_id` | UUID | Conversation link |
| `provider` | VARCHAR(50) | e.g. 'xai' |
| `adapter` | VARCHAR(50) | e.g. 'xai-http' |
| `model` | VARCHAR(100) nullable | Populated after execution |
| `tokens_used` | INTEGER nullable | Provider token count |
| `execution_duration_ms` | INTEGER nullable | Duration |
| `execution_status` | VARCHAR(20) default 'pending' | `pending`, `running`, `completed`, `failed`, `timeout`, `cancel_requested`, `cancelled` |
| `timestamp` | TIMESTAMP | Record creation time |
| `metadata` | JSONB nullable | `aiExecutionResult`, `executionIntent`, `executionError`, etc. |

### `credit_deduction_records` table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK (auto) | Deduction record ID |
| `owner_id` | VARCHAR(50) | Billable user |
| `source_event_id` | VARCHAR(255) UNIQUE | `= execution_id` — idempotency key |
| `execution_id` | UUID nullable | Execution link |
| `requested_credits` | INTEGER default 0 | Credits calculated from tokens |
| `applied_credits` | INTEGER default 0 | Credits actually deducted (≤ balance) |
| `overflow_credits` | INTEGER default 0 | Credits that exceeded balance |
| `balance_before` | INTEGER | Snapshot |
| `balance_after` | INTEGER | Snapshot |
| `status` | VARCHAR(20) default 'applied' | Deduction status |
| `created_at` | TIMESTAMP | Deduction time |

### `credit_balances` table

| Column | Type | Purpose |
|--------|------|---------|
| `owner_id` | VARCHAR(50) | User |
| `balance` | INTEGER | Current credit balance |
| `status` | VARCHAR(20) default 'active' | Balance status |

### Architecture support assessment

| Capability | Supported? | Evidence |
|------------|-----------|----------|
| Pending/reserved credits | NO | No reservation/hold mechanism exists |
| Applied deductions | YES | `credit_deduction_records.status = 'applied'` |
| Refund/reversal rows | NO — schema prepared, no code | `status` column exists but no reversal code path |
| Execution-linked deductions | YES | `source_event_id = execution_id`, `execution_id` column |
| Unique execution accounting | YES | `source_event_id` UNIQUE constraint on `credit_deduction_records` |
| Atomic balance updates | YES | Pessimistic write lock + single transaction in `PersistentCreditDeductionGateway` |

---

## 6. Durable Source of executionIntent (Part 1 — CORRECTED)

### Where is executionIntent available server-side?

| Location | When available | Durable? | Authoritative? |
|----------|---------------|----------|----------------|
| `request.executionIntent` (HTTP request body) | At request time | NO — transient | YES (client declaration) |
| `AIExecutionController.normalizeExecutionIntent()` | At validation time | NO — transient | YES (validated) |
| BullMQ job payload `job.data.executionIntent` | At enqueue → worker claim | Semi-durable (Redis) | YES |
| `usage_records.metadata` at intent write time | At `writeExecutionIntent()` | **NOT PRESENT** — metadata contains `request.metadata + apiKeyId + requestedProvider + requestedModel` but NOT `executionIntent` explicitly | N/A |
| `usage_records.metadata.aiExecutionResult.executionIntent` after completion | At worker completion SQL write | **YES — durable** | YES — written atomically with `completed` status in single SQL UPDATE |
| `usage_records.metadata.aiExecutionResult.executionIntent` after contract failure | At worker failure SQL write | **YES — durable** | YES — same metadata write path |

### Key findings

1. **At deduction time (after completion), `executionIntent` IS durably available** in `usage_records.metadata.aiExecutionResult.executionIntent`. The worker writes metadata and status in a single atomic SQL UPDATE (`worker.processor.ts` line 1227–1236). If `completed` is written, the intent is also written.

2. **At intent write time, `executionIntent` is NOT in metadata.** The `writeExecutionIntent()` call passes `metadata: { ...request.metadata, apiKeyId, requestedProvider, requestedModel }` but does not include `executionIntent` as a standalone metadata field. This does not affect 03D because deduction only occurs after completion.

3. **`triggerDeductionForExecution()` reads the full `usage_records` row** (line 739–741), which includes the `metadata` JSONB column. After completion, `metadata.aiExecutionResult.executionIntent` is accessible.

### Migration requirement for executionIntent

**NO MIGRATION REQUIRED.** The intent is already persisted in `metadata` JSONB by the worker at completion time. `triggerDeductionForExecution()` can read it from the JSONB without any schema change.

**Optional improvement (not required for 03D):** Add `executionIntent` to the metadata at intent write time for earlier-stage audit visibility. This is a one-line addition to the `writeExecutionIntent()` metadata object — no migration needed.

---

## 7. Exact Frontend Apply Pipeline (Part 2 — CORRECTED)

### Apply sequence

```
Worker: execution completed → single SQL UPDATE: execution_status='completed' + metadata (incl. executionIntent)
Worker: notifyExecutionComplete(executionId) → API Gateway finalizes accounting → credits deducted
Worker: publishCompletion(executionId) via Redis Pub/Sub
Frontend: receives completion event via SSE
Frontend: polls GET /api/ai/executions/:id for final status + fileActions
Frontend: checks shouldApplyFileActionsForExecutionIntent(executionIntent)
  → If 'conversation': skips apply entirely
  → If 'workspace_mutation': proceeds with apply
Frontend: checks isRiskyFileActionBatch() → may require user confirmation
Frontend: calls applyExecutionFileActions(executionId, source, executionSessionId, actions)
  → acquireExecutionApplyGuard(executionId, appliedExecutionIds) — apply-once gate
  → applySequentialFileActions({sessionId, actions, writeFile, ...})
    → For each action: writeWorkspaceFile({sessionId, filePath, content})
      → POST /api/sessions/:sessionId/files/write  {path, content}
      → Gateway SessionController.writeSessionFile() → containerManagerHttpClient.writeSessionFile()
      → Container Manager → Docker workspace filesystem
    → Each action produces a result: { status: 'success' | 'failed' | 'skipped', error? }
  → Returns { applyStatus: 'applied'|'skipped', skipReason, results[] }
Frontend: sets executionFileActionState with applyStatus + results
Frontend: runs maybeRunExecutionCoherence() → file tree refresh, preview refresh, checkpoint
```

### Exact files/functions/API routes

| Step | File | Function | API Route |
|------|------|----------|-----------|
| Apply orchestration | `frontend/app/[locale]/app/page.tsx` | `applyExecutionFileActions()` (line ~4979) | — |
| Apply-once guard | `frontend/components/workspace/workspace-ai-file-actions.logic.ts` | `acquireExecutionApplyGuard()` | — |
| Sequential apply | `workspace-ai-file-actions.logic.ts` | `applySequentialFileActions()` | — |
| Per-action session gate | `workspace-ai-file-actions.logic.ts` | `ensureSessionUsable()` | — |
| File write call | `frontend/components/workspace/workspace-file-navigation.logic.ts` | `writeWorkspaceFile()` | `POST /api/sessions/:id/files/write` |
| File delete call | `workspace-file-navigation.logic.ts` | `deleteWorkspaceFile()` | `DELETE /api/sessions/:id/files/delete` |
| Gateway write handler | `services/api-gateway/src/sessions/session.controller.ts` | `writeSessionFile()` (line ~257) | — |
| Container write | `container-manager` HTTP client | `writeSessionFile()` | Internal |

### Critical answers for 03D

| Question | Answer | Evidence |
|----------|--------|----------|
| Does each apply call carry executionId? | **NO.** `writeWorkspaceFile()` sends only `{path, content}` in the body. The Gateway `writeSessionFile()` endpoint receives only `{id (sessionId), path, content}`. | `workspace-file-navigation.logic.ts` line 188; `session.controller.ts` line 261–262 |
| Does it carry action index/count? | **NO.** No index or total count in the request. | Same evidence |
| Does Gateway know which execution produced the action? | **NO.** The file write endpoint is a generic session-file write, not execution-aware. | `session.controller.ts` — no execution references |
| Is there a final "all actions applied" signal? | **NO.** No endpoint or event reports aggregate apply completion. | No such endpoint exists in API Gateway |
| Is there an existing endpoint/event that could safely become the accounting trigger? | **NO.** The existing file-write endpoint is per-file, per-session, and not execution-aware. | Architecture analysis |
| Can the Gateway infer full success without trusting a new frontend assertion? | **NO.** The Gateway receives individual file writes without execution context. It cannot correlate writes to executions or count expected vs actual. | Architecture analysis |
| Does the frontend have executionId at apply completion time? | **YES.** `applyExecutionFileActions(executionId, ...)` has the executionId throughout. After `applySequentialFileActions()` returns, the frontend has `executionId`, `applyResult.applyStatus`, and `applyResult.results[]`. | `page.tsx` line 4980, 4989, 5012 |

---

## 8. Build Deduction Trigger Assessment (Part 3 — NEW)

### Option A — Frontend apply-result acknowledgement

**Mechanism:** Worker does not deduct Build at AI completion. `triggerDeductionForExecution()` checks `executionIntent` and skips deduction for `workspace_mutation`. Frontend reports execution-level apply result after sequential apply completes. Gateway validates and triggers idempotent deduction for qualifying results.

| Criterion | Assessment |
|-----------|------------|
| Trust boundary | Frontend is the authenticated user. A forged "success" would charge the user MORE, not less. A forged "failure" would avoid charges — limited risk for 1–3 trusted private beta users. Gateway validates executionId ownership and execution status. |
| Duplicate reporting | Prevented by existing `sourceEventId = executionId` UNIQUE constraint on `credit_deduction_records`. Second report is a safe no-op. |
| Tab close / network failure | Frontend never reports → no deduction. Requires fallback reconciliation policy (see below). |
| executionId validation | Gateway reads `usage_records` by `executionId`, verifies `completed` status and `workspace_mutation` intent before triggering deduction. |
| Forged success | Limited impact: user would charge themselves. For private beta with trusted users, acceptable. |
| Race behavior | Idempotency guard (`sourceEventId` UNIQUE) prevents double deduction even with concurrent/duplicate reports. |

**Fallback for tab close:** A reconciliation scan finds `completed` + `workspace_mutation` executions older than N minutes with no matching `credit_deduction_records` row → auto-deduct. This is the conservative default: charge if we cannot confirm failure.

**Verdict: VIABLE for private beta. Selected.**

### Option B — Gateway tracks execution-linked file-action application

**Mechanism:** Each file-action write request carries executionId. Gateway counts applied actions per execution. Gateway triggers deduction when expected count reached.

| Criterion | Assessment |
|-----------|------------|
| Expected action count persisted? | **NO.** Not in any server-side record. Worker metadata has `fileActions[]` but count is not exposed to Gateway at write time. |
| Required state | New per-execution action tracking state in Gateway or database. |
| Migration | Likely required — tracking table or column for action counts. |
| Complexity | Higher: changes file-write API contract, adds tracking state, adds count matching logic. |
| Retry handling | Must distinguish retries from new actions. |

**Verdict: Too broad for 03D. Rejected.**

### Option C — Single backend apply-all operation

**Mechanism:** Move sequential file apply to backend. Gateway receives all actions as a batch, writes them in a single operation, and deducts only on batch success.

**Verdict: Substantial architecture change. Far beyond 03D scope. Rejected.**

### Option D — Existing mechanism

**Assessment:** No existing mechanism links workspace apply results to accounting. The file-write endpoint is generic and session-scoped, not execution-scoped.

### Selected trigger: Option A — Frontend apply-result acknowledgement with reconciliation fallback

---

## 9. Ask Behavior (Part 4 — CORRECTED)

### Policy: Ask deduction is UNCHANGED — immediate after completion

For `executionIntent = 'conversation'`:
- Worker writes `completed` → calls `notifyExecutionComplete()`
- `triggerDeductionForExecution()` reads metadata, finds `executionIntent = 'conversation'`
- **Proceeds immediately to deduction** (existing behavior)
- No workspace apply is expected; no delay is needed

### Preservation mechanism

`triggerDeductionForExecution()` gains an intent-conditional gate:

```
if executionStatus === 'completed':
  read metadata.aiExecutionResult.executionIntent
  if executionIntent === 'conversation' → proceed to emitDeductionAttempt() [UNCHANGED]
  if executionIntent === 'workspace_mutation' → return { triggered: false, reason: 'build_awaiting_apply' }
  if executionIntent is missing/unknown → proceed to deduction [SAFE DEFAULT: charge]
```

Ask charging path remains identical. Build charging path gains the delay gate.

---

## 10. Build Behavior (Part 5 — CORRECTED)

### Policy: Build deduction DELAYED until qualifying workspace result

For `executionIntent = 'workspace_mutation'`:

**Desired trigger:** Successful completion of ALL requested file actions in the workspace.

**Definition of "successful workspace result":**
- `applySequentialFileActions()` returns `applyStatus: 'applied'`
- All actions in `results[]` have `status: 'success'`
- Frontend reports this aggregate result to the Gateway via a new endpoint

### Build outcome handling

| Build Outcome | Deduction? | Trigger |
|---------------|-----------|---------|
| All actions applied successfully | YES | Frontend reports apply success → Gateway triggers deduction |
| Zero actions (contract failure) | NO | Execution status is `failed` → existing `triggerDeductionForExecution()` skips |
| First action fails, rest skipped | NO | Frontend reports failure → Gateway does not deduct |
| Some succeed, some fail | NO (private beta policy) | Frontend reports partial failure → Gateway does not deduct |
| Frontend disappears before apply | Deferred to reconciliation | Reconciliation auto-deducts after timeout |
| Frontend disappears after apply but before report | Deferred to reconciliation | Reconciliation auto-deducts after timeout |
| Duplicate apply attempt | Prevented | `acquireExecutionApplyGuard()` frontend guard + `sourceEventId` UNIQUE |
| Retry after failure | Safe | Idempotency: if already deducted, second call is no-op |

---

## 11. Partial Apply Policy (Part 6 — CORRECTED)

### Private-beta decision: NO CHARGE if full requested action set did not complete

**Selected: Option 1 — NO CHARGE if full requested action set did not complete.**

Justification:
1. The user requested a specific workspace mutation. If only part of it was delivered, the workspace may be in an inconsistent state.
2. Proportional charging is not supported by the current schema (`credit_deduction_records` is per-execution, not per-action).
3. "Charge if any mutation succeeded" is misleading — a partial mutation may leave the project broken.
4. For 1–3 trusted private beta users, simplicity is preferred over edge-case monetization.
5. Partial apply should be rare after 03E session-lifecycle fixes.

**Workspace rollback behavior is a separate concern.** 03D does not implement rollback. Git checkpoint/revert exists as a manual recovery path.

---

## 12. Apply Failure Policy (Part 7 — CORRECTED)

### Policy: NO CHARGE for valid provider actions that fail to apply

**Rationale:** The registered 03D principle states: "Users should not silently pay full execution credits for a failed Build result without an explicit evidence-backed product policy."

When the provider generates valid actions but workspace apply fails (session expired, container error, etc.):
- The user did not receive the requested workspace result
- Provider tokens were consumed (this is a platform cost, not a user charge)
- Under the DELAY DEDUCTION architecture, no deduction was triggered at completion
- The frontend does not report apply success → no deduction occurs

**Implementation:** Prevention, not refund. By delaying Build deduction until qualifying apply result, the failure case naturally results in no charge without requiring a refund mechanism.

---

## 13. Scenario Analysis (Part E — CORRECTED)

### Scenario A — Successful Ask

| Field | Value |
|-------|-------|
| `executionIntent` | `conversation` |
| Provider outcome | Succeeds, returns assistantText |
| File actions | `[]` (zero — expected for conversation) |
| Current execution status | `completed` |
| Current credit behavior | CHARGED |
| **Desired policy** | **CHARGE** — user received conversational value |
| **Corrected trigger** | `triggerDeductionForExecution()` → intent is `conversation` → immediate deduction (UNCHANGED) |

### Scenario B — Successful Build with complete apply

| Field | Value |
|-------|-------|
| `executionIntent` | `workspace_mutation` |
| Provider outcome | Succeeds, returns valid file actions |
| Workspace apply | All actions succeed |
| Current execution status | `completed` |
| Current credit behavior | CHARGED (at completion, before apply) |
| **Desired policy** | **CHARGE** — user received workspace mutation |
| **Corrected trigger** | `triggerDeductionForExecution()` skips (intent is `workspace_mutation`). Frontend reports apply success → new endpoint triggers deduction |

### Scenario C — Build zero usable actions (contract failure)

| Field | Value |
|-------|-------|
| `executionIntent` | `workspace_mutation` |
| Provider outcome | Returns response but zero safe actions |
| Current execution status | `failed` with `file_action_contract_failure` |
| Current credit behavior | NOT CHARGED |
| **Desired policy** | **DO NOT CHARGE** — already correct |
| **Implementation** | No change — `failed` status skips deduction via existing gate |

### Scenario D — Build apply failure (CORRECTED — previously deferred)

| Field | Value |
|-------|-------|
| `executionIntent` | `workspace_mutation` |
| Provider outcome | Succeeds with valid file actions |
| Execution status | `completed` |
| Workspace apply | Fails (session expired, container error) |
| Current credit behavior | **CHARGED** (deduction precedes apply) |
| **Desired policy** | **DO NOT CHARGE** |
| **Corrected trigger** | `triggerDeductionForExecution()` skips (intent is `workspace_mutation`). Frontend does not report apply success. No deduction occurs. |
| **Reconciliation fallback** | If frontend disappears without reporting, reconciliation auto-deducts after timeout — conservative default |
| **Why this is now addressable** | Delay-deduction architecture means no deduction happens until qualifying result. Apply failure = no qualifying result = no deduction. No refund needed. |

### Scenario E — Partial workspace mutation (CORRECTED — previously deferred)

| Field | Value |
|-------|-------|
| `executionIntent` | `workspace_mutation` |
| Provider outcome | Succeeds with valid file actions |
| Execution status | `completed` |
| Workspace apply | Partial (some succeed, some fail) |
| Current credit behavior | **CHARGED** |
| **Desired policy** | **DO NOT CHARGE** (private beta: full-or-nothing) |
| **Corrected trigger** | Frontend reports partial result. Gateway sees incomplete apply → does not trigger deduction. |
| **Why this is now addressable** | Same delay-deduction mechanism. Frontend reports aggregate result with success count. Gateway requires all actions succeeded to trigger deduction. |

### Scenario F — Provider timeout / failure

| Field | Value |
|-------|-------|
| Provider outcome | Timeout or HTTP error |
| Execution status | `timeout` or `failed` |
| Current credit behavior | NOT CHARGED |
| **Desired policy** | **DO NOT CHARGE** — already correct |
| **Implementation** | No change |

### Scenario G — Cancellation

| Field | Value |
|-------|-------|
| Execution status | `cancelled` |
| Current credit behavior | NOT CHARGED |
| **Desired policy** | **DO NOT CHARGE** — already correct |
| **Implementation** | No change |

---

## 14. Corrected Policy Matrix (Part 11)

| Scenario | Intent | Provider Result | File Actions | Workspace Apply | Current Charge | Desired Charge | Trigger | Idempotency | Implementation Required |
|----------|--------|----------------|-------------|----------------|---------------|---------------|---------|-------------|------------------------|
| A Ask success | `conversation` | success | `[]` | N/A | CHARGED | **CHARGE** | `triggerDeductionForExecution()` immediate (intent=conversation) | `sourceEventId` UNIQUE | Intent gate in `triggerDeductionForExecution()` (conversation path unchanged) |
| B Build + complete apply | `workspace_mutation` | success | ≥1 | All succeed | CHARGED | **CHARGE** | Frontend reports apply success → new endpoint triggers deduction | `sourceEventId` UNIQUE | Intent gate + new confirm-apply endpoint + frontend integration |
| C Build zero actions | `workspace_mutation` | success | `[]` | None | NOT CHARGED | **DO NOT CHARGE** | Already correct (status=`failed` → skipped) | N/A | No change |
| D Build apply failure | `workspace_mutation` | success | ≥1 | Failed | **CHARGED** | **DO NOT CHARGE** | Frontend does not report success → no deduction | `sourceEventId` UNIQUE | Same as B (delay gate prevents premature deduction) |
| E Build partial apply | `workspace_mutation` | success | ≥1 | Partial | **CHARGED** | **DO NOT CHARGE** | Frontend reports partial → Gateway does not deduct | `sourceEventId` UNIQUE | Same as B (confirm endpoint validates full success) |
| F Provider timeout | any | timeout | `[]` | None | NOT CHARGED | **DO NOT CHARGE** | Already correct (status=`timeout` → skipped) | N/A | No change |
| G Cancellation | any | aborted | `[]` | None | NOT CHARGED | **DO NOT CHARGE** | Already correct (status=`cancelled` → skipped) | N/A | No change |

---

## 15. Primary Architecture Direction (Part 12 — CORRECTED)

### Selected: A — DELAY BUILD CREDIT DEDUCTION UNTIL QUALIFYING WORKSPACE RESULT

**Rationale for A over alternatives:**

| Alternative | Why rejected |
|-------------|-------------|
| B — Deduct then refund | No refund mechanism exists. Building one adds: refund code, reversal records, balance adjustment, idempotent reversal, refund trigger. This is more complex than delayed deduction. |
| C — Intentionally charge apply failures | Violates 03D's registered principle. Charging for undelivered workspace results requires an explicit evidence-backed product justification. "We can't do anything" is not a justification — the architecture addition is small and bounded. |
| D — Existing accounting already supports policy | This was the initial Stage Start conclusion. It is INCORRECT for D/E because it declares the policy "blocked" when a bounded fix is feasible within 03D scope. |

**Why A fits the architecture:**

1. **Existing idempotent deduction** via `sourceEventId = executionId` UNIQUE naturally supports delayed triggering. The same deduction machinery works whether triggered immediately or later.

2. **No refund mechanism needed.** By preventing premature deduction, the no-charge scenarios naturally produce no deduction record. No reversal code required.

3. **`triggerDeductionForExecution()` is the single choke point.** Adding an intent-conditional gate is a one-method change in a single file. No cross-service refactor.

4. **New confirm-apply endpoint reuses existing deduction path.** The endpoint validates executionId, reads usage_records, and calls `emitDeductionAttempt()` — the same function already used by `triggerDeductionForExecution()`. No new deduction logic.

5. **Frontend already has all required data.** The `executionId`, `applyStatus`, and `results[]` are available in `applyExecutionFileActions()` after `applySequentialFileActions()` returns.

---

## 16. Idempotency Design (Part 8 — CORRECTED)

### Existing idempotency preserved

| Mechanism | Key | Behavior under delayed deduction |
|-----------|-----|----------------------------------|
| `credit_deduction_records.source_event_id` UNIQUE | `executionId` | Same. Whether deduction is triggered at completion or later by confirm-apply, the sourceEventId is the same executionId. Duplicate triggers are safe no-ops. |
| Pre-transaction duplicate check in `PersistentCreditDeductionGateway` | `sourceEventId` | Unchanged. Checks for existing record before transaction. |
| UNIQUE constraint race fallback | Database constraint | Unchanged. If duplicate check misses due to race, constraint catches it. |
| Pessimistic write lock (`FOR UPDATE`) | `credit_balances` row | Unchanged. Concurrent deductions are serialized. |

### New idempotency concerns and handling

| Concern | Handling |
|---------|---------|
| Duplicate apply-success frontend reports | `sourceEventId` UNIQUE ensures exactly-once deduction. Second report → Gateway calls `emitDeductionAttempt()` → `PersistentCreditDeductionGateway` returns `skippedDuplicate: true`. Safe. |
| Frontend retry after network error | Same as above. Idempotent. |
| Concurrent success callbacks | `FOR UPDATE` lock serializes balance mutations. `sourceEventId` UNIQUE prevents double insert. |
| Worker duplicate `notifyExecutionComplete()` | For `workspace_mutation`: intent gate skips deduction. Duplicate no-ops. For `conversation`: existing duplicate handling via `sourceEventId`. |
| Stale callback after apply failure | Frontend reported failure → no deduction call. If stale success callback somehow arrives, `sourceEventId` UNIQUE still prevents issues. |
| Reconciliation auto-deduct + late frontend report | Reconciliation triggers deduction via `emitDeductionAttempt()`. If frontend later also reports success, `sourceEventId` UNIQUE prevents double deduction. |
| Historical execution safety | No historical records are modified. Existing `credit_deduction_records` are untouched. Only new executions use the delayed path. |

### Transaction/locking authority

Unchanged: `PersistentCreditDeductionGateway.applyDeduction()` remains the single transactional authority for all credit deductions. It acquires `FOR UPDATE` lock on `credit_balances`, checks `sourceEventId` uniqueness, and performs atomic insert+update. This is true regardless of whether deduction is triggered by `notifyExecutionComplete()` (Ask path) or confirm-apply endpoint (Build path).

---

## 17. Failure-State Validity (Part 9 — CORRECTED)

### Selected: A — Keep AI execution status `completed` and treat apply/accounting separately

**Rationale:** "Provider execution completed" and "workspace result delivered" are fundamentally different events that occur at different times across different service boundaries.

- `execution_status = 'completed'` means: the provider returned a valid response and the worker processed it successfully.
- Workspace apply is a downstream frontend operation that happens later.
- Conflating the two (e.g., changing status back from `completed` after apply failure) would:
  - Break existing status transition guarantees (unidirectional for completion path)
  - Require the frontend to write back to `usage_records` (cross-boundary mutation)
  - Complicate idempotency (status changes after deduction check)
  - Break audit trail (status was `completed`, then became something else)

**Accounting separation:** The delayed deduction gate in `triggerDeductionForExecution()` does NOT depend on execution status changing. It depends on `executionIntent` (metadata, already written at completion) and the confirm-apply signal (new endpoint). Execution status remains `completed` throughout.

---

## 18. Migration Decision (Part 10 — CORRECTED)

### **NO MIGRATION REQUIRED.**

Evidence:

1. **`executionIntent` is already in metadata JSONB** after worker completion. No new column needed.
2. **`triggerDeductionForExecution()` already reads the full `usage_records` row** including metadata. It can extract `executionIntent` from JSONB without schema change.
3. **The new confirm-apply endpoint triggers deduction via existing `emitDeductionAttempt()`** which uses existing `credit_deduction_records` and `credit_balances` tables. No new tables.
4. **The `sourceEventId = executionId` UNIQUE constraint** already prevents duplicate deductions. No new constraint needed.
5. **Apply result reporting can optionally use metadata JSONB** to persist the frontend's apply result alongside the execution record. No new column.

### Why a column is NOT needed

The deduction decision is binary: "did the confirm-apply endpoint receive a qualifying result for this executionId?" The answer is encoded by the existence or absence of a `credit_deduction_records` row for this `sourceEventId`. If the row exists, deduction happened. If not, it hasn't. This is sufficient for the reconciliation scan to determine which Build executions need auto-deduction.

---

## 19. Reconciliation Design — Build Deduction Fallback

### Problem

If the frontend successfully applies files but disappears before reporting (tab close, network failure), no deduction occurs. The user consumed provider tokens and received workspace value but was not charged.

### Solution: Timeout-based reconciliation auto-deduction

A reconciliation scan (extending the existing orphan execution pattern) periodically finds:

```sql
SELECT execution_id FROM usage_records
WHERE execution_status = 'completed'
AND metadata->'aiExecutionResult'->>'executionIntent' = 'workspace_mutation'
AND NOT EXISTS (
  SELECT 1 FROM credit_deduction_records
  WHERE source_event_id = usage_records.execution_id
)
AND timestamp < NOW() - INTERVAL '10 minutes'
LIMIT 50
```

For each matched execution: call `emitDeductionAttempt()`. Idempotency is preserved by `sourceEventId` UNIQUE.

### Policy: conservative default-to-charge after timeout

After the timeout window, the platform assumes the user received value (they had the file actions and time to apply them). This is the conservative platform-protective policy:
- If apply actually succeeded → correct charge
- If apply failed but frontend didn't report → incorrect charge (rare edge case for private beta)

For 1–3 trusted private beta users, this is acceptable. Future work could persist apply result in metadata for more precise reconciliation.

---

## 20. Exact Implementation Surface (Part 14 — CORRECTED)

### Production files likely to change

| File | Change type | Description |
|------|------------|-------------|
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | **REQUIRED** | Add intent-conditional gate in `triggerDeductionForExecution()`: if `workspace_mutation`, skip deduction and return `{ triggered: false, reason: 'build_awaiting_apply' }`. Add new method `triggerBuildApplyDeduction(executionId, applyResult)` that validates and triggers deduction for qualifying Build results. |
| `services/api-gateway/src/ai/internal-accounting.controller.ts` (or new controller) | **REQUIRED** | Add endpoint `POST /api/internal/executions/:executionId/confirm-build-apply` that receives apply result from frontend and calls `triggerBuildApplyDeduction()`. May also be exposed as a user-facing endpoint via Next.js API proxy. |
| `frontend/app/[locale]/app/page.tsx` | **REQUIRED** | After successful `applySequentialFileActions()` with full success, call new confirm-apply endpoint with `{ executionId, applyStatus, totalActions, successCount }`. |
| `frontend/components/workspace/workspace-ai-file-actions.logic.ts` or new utility | **MINOR** | Helper function to determine qualifying apply result from `ApplySequentialFileActionsResult`. |
| `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts` | **REQUIRED** | Tests for intent-conditional deduction gate and Build apply deduction trigger. |
| `services/api-gateway/src/ai/__tests__/internal-accounting.controller.spec.ts` | **REQUIRED** | Tests for confirm-apply endpoint. |
| `services/ai-service/src/worker/worker.processor.spec.ts` | **REQUIRED** | Tests confirming `notifyExecutionComplete()` behavior is unchanged (still called for all `completed` executions). |

### Files NOT changed

- `services/ai-service/src/worker/worker.processor.ts` — Worker completion flow is UNCHANGED. `notifyExecutionComplete()` is still called for all completed executions. The difference is that `triggerDeductionForExecution()` now conditionally skips Build deductions.
- `persistent-credit-deduction.gateway.ts` — Deduction machinery unchanged.
- `credit-calculation.service.ts` — Rate calculation unchanged.
- No migration files.
- No `.env` changes.
- No new dependencies.

---

## 21. Child-Slice Decision (Part 13 — CORRECTED)

### Recommended: 2 bounded child slices

The corrected implementation crosses API Gateway (backend) and Frontend. Per governance: "prefer smaller bounded child slices over large mixed changes."

**03D-A — Backend Build Deduction Gate + Confirm-Apply Endpoint**
- Scope: API Gateway only
- Changes: `triggerDeductionForExecution()` intent gate, new confirm-apply method/endpoint, unit tests
- Risk: LOW — additive logic, existing deduction path unchanged for Ask
- Test surface: unit tests proving intent gate, confirm-apply deduction trigger, idempotency

**03D-B — Frontend Apply-Result Integration + Validation**
- Scope: Frontend + integration validation
- Changes: confirm-apply call after successful `applySequentialFileActions()`, helper utility, integration-level tests
- Risk: LOW — one fetch call after existing apply flow
- Depends on: 03D-A (endpoint must exist before frontend can call it)

**Reconciliation auto-deduction** (extending orphan scan) can be included in 03D-A or deferred to a separate follow-up. For private beta with 1–3 users and short testing windows, reconciliation is lower urgency than the core delayed-deduction gate.

**These names/slices are recommendations.** Do NOT register child slices in TASKS.md during this Stage Start correction. Registration occurs at Step 3 activation.

---

## 22. Testing Plan (Part 15 — CORRECTED)

### Required Step 3 tests

| # | Test | Expected outcome | Test location |
|---|------|-----------------|---------------|
| 1 | Ask completion triggers deduction immediately | `triggerDeductionForExecution()` returns `{ triggered: true }` for `conversation` intent | `usage-ledger.service.spec.ts` |
| 2 | Ask duplicate completion deducts once | Second call returns duplicate result | `usage-ledger.service.spec.ts` |
| 3 | Build AI completion alone does NOT deduct | `triggerDeductionForExecution()` returns `{ triggered: false, reason: 'build_awaiting_apply' }` for `workspace_mutation` intent | `usage-ledger.service.spec.ts` |
| 4 | Build full apply success deducts once | `triggerBuildApplyDeduction()` triggers deduction, returns `{ triggered: true }` | `usage-ledger.service.spec.ts` |
| 5 | Build zero actions no charge | Execution status is `failed` → `triggerDeductionForExecution()` skips (existing) | `usage-ledger.service.spec.ts` |
| 6 | Build first apply failure no charge | Confirm-apply with `applyStatus='failed'` → no deduction | `usage-ledger.service.spec.ts` |
| 7 | Build partial apply no charge | Confirm-apply with `successCount < totalActions` → no deduction | `usage-ledger.service.spec.ts` |
| 8 | Duplicate apply-success signal deducts once | Second confirm-apply call → `sourceEventId` UNIQUE prevents double deduction | `usage-ledger.service.spec.ts` |
| 9 | Apply-success after already failed state handled safely | Confirm-apply for non-completed execution → safe rejection | `usage-ledger.service.spec.ts` |
| 10 | Timeout no charge | `triggerDeductionForExecution()` returns `{ triggered: false, reason: 'status_timeout' }` (existing) | `usage-ledger.service.spec.ts` |
| 11 | Provider failure no charge | `triggerDeductionForExecution()` returns `{ triggered: false, reason: 'status_failed' }` (existing) | `usage-ledger.service.spec.ts` |
| 12 | Cancellation no charge | `triggerDeductionForExecution()` returns `{ triggered: false, reason: 'status_cancelled' }` (existing) | `usage-ledger.service.spec.ts` |
| 13 | Simultaneous/double accounting trigger safe | Concurrent calls to confirm-apply → one deduction record via `sourceEventId` UNIQUE | `usage-ledger.service.spec.ts` |
| 14 | Existing balance locking preserved | `FOR UPDATE` lock in `PersistentCreditDeductionGateway` unchanged | Existing `credit-deduction-concurrency.integration.spec.ts` |
| 15 | grok-4.5 normal successful Build still chargeable | Completed `workspace_mutation` + full apply success → deduction triggered | `usage-ledger.service.spec.ts` |
| 16 | Historical accounting unchanged | No migration, no backfill, no balance rewrite | Structural assertion |
| 17 | Worker `notifyExecutionComplete()` still called for completed | Verify worker behavior unchanged | `worker.processor.spec.ts` |
| 18 | Confirm-apply endpoint validates executionId | Invalid/missing executionId → appropriate error | `internal-accounting.controller.spec.ts` |
| 19 | Confirm-apply endpoint rejects non-completed execution | Execution with status `failed` → rejection | `internal-accounting.controller.spec.ts` |
| 20 | Confirm-apply endpoint rejects conversation intent | Conversation execution → rejection (Ask uses immediate path) | `internal-accounting.controller.spec.ts` |

### Provider mocks only — no live xAI required.

---

## 23. Provider-Free Staging Plan (Part 16 — CORRECTED)

### Staging proof with ZERO provider calls

1. **Ask accounting trigger behavior:** Proven from compiled tests. Mock `usage_records` row with `executionIntent='conversation'` + `completed`. Verify `triggerDeductionForExecution()` returns `{ triggered: true }`.

2. **Build does not deduct before apply:** Mock `usage_records` row with `executionIntent='workspace_mutation'` + `completed`. Verify `triggerDeductionForExecution()` returns `{ triggered: false, reason: 'build_awaiting_apply' }`.

3. **Build deducts after confirm-apply:** Call `triggerBuildApplyDeduction()` with qualifying apply result. Verify deduction triggered exactly once via mock gateway.

4. **Failure path does not deduct:** Call confirm-apply with `applyStatus='failed'`. Verify no deduction call.

5. **Partial apply does not deduct:** Call confirm-apply with `successCount < totalActions`. Verify no deduction call.

### Balance mutation authorization

**NOT authorized in this Stage Start correction.** Step 3 tests use mocked credit deduction gateway. No actual balance changes. If controlled staging balance verification is later needed, it requires explicit separate authorization.

---

## 24. Explicit Exclusions

03D Step 3 must NOT:

- Implement Stripe/payment-provider integration
- Change `BILLING_CHARGES_ENABLED` flag
- Change historical execution records or balances
- Introduce automatic model fallback
- Reopen 03A, 03B, 03C, or BUILDER-INTENT-01
- Register 03E follow-ups or PRIVATE-BETA-INVITE-01
- Make provider API calls
- Run Docker/Postgres/Redis for tests
- Modify `.env`
- Deploy to staging without explicit authorization
- Create a new service
- Change deduction calculation rates
- Change `PersistentCreditDeductionGateway` deduction transaction logic
- Add automatic workspace rollback on apply failure
- Implement proportional per-action charging
- Add a general-purpose refund/reversal mechanism

---

## 25. Risks and Limitations

| Risk/Limitation | Severity | Mitigation |
|----------------|----------|------------|
| Tab close after successful apply but before confirm-apply report | MEDIUM | Reconciliation auto-deduction after timeout ensures charge. User received value but frontend didn't report. Conservative platform-protective default. |
| Tab close after apply failure with no report | LOW | Reconciliation auto-deducts incorrectly. For private beta with fresh sessions (03E fixes), apply failures should be rare. Reconciliation timeout can be generous (10+ min). |
| Frontend forges apply failure to avoid charges | LOW | Trusted private beta users (1–3). Provider tokens are a platform cost regardless. Future: server-side apply tracking for trust-independent policy. |
| Reconciliation scan performance | LOW | Private beta has a handful of executions. JSONB query on small table is fine. |
| `executionIntent` missing from metadata (legacy/edge case) | LOW | `triggerDeductionForExecution()` defaults to immediate deduction if intent is unknown. Conservative: charge if unsure. |
| Race between reconciliation and late confirm-apply | NONE | `sourceEventId` UNIQUE prevents double deduction regardless of trigger source. |

---

## 26. Go/No-Go Verdict for Step 3

### **GO — READY FOR STEP 3 (03D-A first)**

Rationale:

1. Architecture direction is now definitive: DELAY BUILD DEDUCTION UNTIL QUALIFYING WORKSPACE RESULT.
2. All seven scenarios (A–G) have explicit policies. No scenario is deferred or "blocked."
3. No migration required. Implementation uses existing metadata JSONB and deduction machinery.
4. No refund mechanism needed. Prevention (delayed deduction) replaces refund.
5. Child slices are bounded: 03D-A (backend gate + endpoint) then 03D-B (frontend integration).
6. Idempotency is preserved by existing `sourceEventId` UNIQUE constraint.
7. Ask charging path is unchanged.
8. Provider mocks only — no provider calls.
9. No Docker/Postgres/Redis required for test execution.
10. Risk is LOW-MEDIUM: additive logic with unchanged existing paths.

---

## Safety Confirmation (Step 2 — Correction)

| Safety item | Status |
|-------------|--------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| `BILLING_CHARGES_ENABLED` | `false` — preserved |
| Source files modified | NONE |
| Tests modified | NONE |
| `.env` modified | NONE |
| PM2 restarted | NO |
| Services stopped/started | NO |
| Provider calls made | NONE |
| Builder retried | NO |
| PostgreSQL mutated | NO |
| Redis mutated | NO |
| Docker/container mutated | NO |
| Dependencies added | NO |
| Git commit/push | NO |
| ARCHITECTURE.md modified | NO |
| PRD.md modified | NO |
| CLAUDE.md modified | NO |
| 03C changes | NO |
| Balance mutation | NO |
| Credits granted/refunded | NO |
| Migration run | NO |
| Stripe/payment work | NO |

---

*Stage-start document corrected: 2026-08-14 — PRIVATE-BETA-BLOCKER-03D Step 2 — read-only diagnosis only — no source/runtime mutation.*
