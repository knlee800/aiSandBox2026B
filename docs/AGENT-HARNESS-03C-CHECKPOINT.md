# AGENT-HARNESS-03C Checkpoint — Pre-Apply Checkpoint / Mutation Rollback Safety

**Task ID:** AGENT-HARNESS-03C
**Title:** Pre-Apply Checkpoint / Mutation Rollback Safety
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-22

---

## Architecture / Security Review Summary

A dedicated architecture and security review was completed before implementation began. The review confirmed:

1. **Checkpoint-before-mutation approach is correct.** The existing API Gateway internal checkpoint API (`POST /api/internal/git-checkpoints`) is owned by the frontend-triggered flow. A new parallel internal endpoint (`POST /api/internal/workspace/:sessionId/checkpoint`) was added for ai-service use, maintaining the established architecture boundary without coupling the harness to the frontend-owned flow.
2. **Service boundary confirmed correct.** ai-service → API Gateway internal endpoint → container-manager → workspace. No direct ai-service → container-manager mutation call is permitted. No direct filesystem access from ai-service.
3. **Single checkpoint per execution enforced.** `executeAgentHarnessLoop` creates at most one pre-apply checkpoint per loop execution, tracked via a `checkpointCreated` flag in loop state. Subsequent mutating tool calls in the same loop reuse the same checkpoint context.
4. **No mutation before checkpoint.** If the `createCheckpointFn` callback throws or rejects, the mutating tool call returns `success: false` with `CHECKPOINT_FAILED` and no file write or delete is performed.
5. **Read-only tools do not trigger checkpoint.** `read_file` and `list_files` are not in `mutatingToolNames` and never cause a checkpoint to be created.
6. **No automatic rollback implemented.** The pre-apply checkpoint hash is recorded in `AgentHarnessLoopResult.preApplyCheckpointHash` and in `WorkerProcessor` execution metadata, providing a safe reference for manual or future automatic rollback. Automatic rollback is deferred to a future slice.
7. **`enablePreApplyCheckpoint` config flag defaults to `true`.** This ensures the checkpoint behavior is always active when the double-gated harness path runs. `enableToolLoop` remains `false` by default — no current production jobs enter the harness path.
8. **No frontend/UI changes required.** The checkpoint endpoint addition is an internal API Gateway route protected by `InternalServiceGuard`. Frontend checkpoint flows are unaffected.

---

## Problem

AGENT-HARNESS-03B implemented mutating `write_file` and `delete_file` tools behind the double-gated Agent Harness path. These tools preserve the API Gateway boundary and remain gated, but they can mutate workspace files without the existing frontend-owned file-action apply and post-apply checkpoint flow. The master plan defines AGENT-HARNESS-03C as the safety slice to add pre-apply checkpoint and rollback protection before harness mutation tools are considered production-ready.

---

## Objective

Add pre-apply checkpoint / mutation rollback safety for Agent Harness mutating tools:

- Before the first `write_file` or `delete_file` tool call in a harness loop execution, create a git checkpoint via the API Gateway internal checkpoint boundary.
- Store the checkpoint hash in `AgentHarnessLoopResult.preApplyCheckpointHash` and in `WorkerProcessor` execution metadata.
- If checkpoint creation fails, the mutating tool call must fail safely with no mutation.
- Read-only tools (`read_file`, `list_files`) must not trigger checkpoint creation.
- Create at most one pre-apply checkpoint per harness loop execution.
- No automatic rollback in this slice — checkpoint hash provides reference for future rollback.

---

## Implementation Summary

Added an internal API Gateway checkpoint endpoint for ai-service use. Added a corresponding client method in the ai-service `ApiGatewayHttpClient`. Added `enablePreApplyCheckpoint` to `AgentHarnessConfigV1` (default `true`). Extended `executeAgentHarnessLoop` with checkpoint-before-mutation logic using an optional `createCheckpointFn` callback and `mutatingToolNames` set. Added `preApplyCheckpointHash` to `AgentHarnessLoopResult`. Wired the checkpoint callback and mutating tool names into the double-gated `WorkerProcessor` harness branch. Updated `agent-harness.contracts.spec.ts` to cover the new config and result fields.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | Updated — added `POST /api/internal/workspace/:sessionId/checkpoint` endpoint; guarded with `InternalServiceGuard`; delegates to existing `ContainerManagerHttpClient` checkpoint method |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.spec.ts` | Updated — grew from 15 to 19 tests; added 4 new tests for the checkpoint endpoint |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | Updated — added `createWorkspaceCheckpoint(sessionId, description?)` method |
| `services/ai-service/src/clients/api-gateway-http.client.spec.ts` | Updated — grew from 9 to 12 tests; added 3 new tests for the checkpoint client method |
| `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | Updated — added `enablePreApplyCheckpoint: boolean` to `AgentHarnessConfigV1`; added `preApplyCheckpointHash?: string` to `AgentHarnessLoopResult` |
| `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.spec.ts` | Updated — 2 tests confirming new config and result contract fields |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Updated — `enablePreApplyCheckpoint: true` added to `DEFAULT_AGENT_HARNESS_CONFIG_V1` |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Updated — added `createCheckpointFn` optional callback and `mutatingToolNames` optional set to loop options; checkpoint-before-mutation logic with `checkpointCreated` flag; `preApplyCheckpointHash` stored in result |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | Updated — grew from prior count to 28 tests; added 10 new tests for checkpoint-before-mutation behavior |
| `services/ai-service/src/worker/worker.processor.ts` | Updated — passes `createCheckpointFn` and `mutatingToolNames` only inside the existing double-gated harness branch; records `preApplyCheckpointHash` in execution metadata |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Updated — grew from 32 to 40 tests; added 8 new tests for checkpoint callback wiring |

**Total files changed: 11** (6 source files, 5 test files). No frontend, no package, no database, no Docker files changed.

---

## Tests Added / Updated

### `internal-workspace-files.controller.spec.ts` — 19 total tests (grew from 15)

| # | Test |
|---|------|
| 1–15 | All 15 prior AGENT-HARNESS-03B tests preserved and passing |
| 16 | Returns 200 with checkpoint hash on successful checkpoint creation |
| 17 | Returns 400 when sessionId is missing |
| 18 | Returns 500 on container-manager checkpoint error |
| 19 | Passes optional description to container-manager checkpoint method |

### `api-gateway-http.client.spec.ts` — 12 total tests (grew from 9)

| # | Test |
|---|------|
| 1–9 | All 9 prior AGENT-HARNESS-03B tests preserved and passing |
| 10 | `createWorkspaceCheckpoint` calls correct API Gateway internal checkpoint endpoint |
| 11 | `createWorkspaceCheckpoint` returns checkpoint hash on success |
| 12 | `createWorkspaceCheckpoint` passes optional description in request body |

### `agent-harness.contracts.spec.ts` — 2 total tests

| # | Test |
|---|------|
| 1 | `AgentHarnessConfigV1` includes `enablePreApplyCheckpoint` field |
| 2 | `AgentHarnessLoopResult` includes optional `preApplyCheckpointHash` field |

### `agent-harness-loop.spec.ts` — 28 total tests (10 new checkpoint tests added)

| # | Test |
|---|------|
| 1–18 | All 18 prior AGENT-HARNESS-03B/02C loop tests preserved and passing |
| 19 | `calls checkpoint callback before first write_file dispatch` |
| 20 | `calls checkpoint callback before first delete_file dispatch` |
| 21 | `calls checkpoint callback only once per loop execution` |
| 22 | `does not call checkpoint callback for read_file/list_files only` |
| 23 | `does not dispatch mutating tool if checkpoint callback fails` |
| 24 | `includes preApplyCheckpointHash in AgentHarnessLoopResult after checkpoint creation` |
| 25 | `preserves no_dispatcher behavior when dispatcher is absent with checkpoint options` |
| 26 | `still enforces maxToolIterations with checkpoint callback` |
| 27 | `preserves toolResults field behavior with checkpoint` |
| 28 | `still returns no_dispatcher when no dispatcher is passed and tool calls appear` |

### `worker.processor.spec.ts` — 40 total tests (grew from 32)

| # | Test |
|---|------|
| 1–32 | All 32 prior AGENT-HARNESS-03B tests preserved and passing |
| 33–40 | 8 new tests for checkpoint callback wiring in double-gated harness branch |

### `file-tool-handlers.spec.ts` — 38 total tests (unchanged)

All 38 prior AGENT-HARNESS-03B tests preserved and passing.

### `tool-registry.spec.ts` — 13 total tests (unchanged)

All 13 prior AGENT-HARNESS-03B tests preserved and passing.

### `tool-dispatcher.spec.ts` — 9 total tests (unchanged)

All 9 prior AGENT-HARNESS-02C tests preserved and passing.

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --no-cache src/sessions/internal-workspace-files.controller.spec.ts` | **PASS — 19 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/clients/api-gateway-http.client.spec.ts` | **PASS — 12 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | **PASS — 28 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/worker/worker.processor.spec.ts` | **PASS — 40 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/handlers/file-tool-handlers.spec.ts` | **PASS — 38 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/tool-registry.spec.ts` | **PASS — 13 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/tool-dispatcher.spec.ts` | **PASS — 9 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/contracts/agent-harness.contracts.spec.ts` | **PASS — 2 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build` | **PASS — tsc clean** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS — tsc clean** |
| ReadLints on all 11 touched source/test files | **PASS — no linter errors** |

### Resolved validation test total

**Total: 161 tests** across 8 spec files, both service builds clean.

The implementation report referenced "162 tests" but this was a transcription error. The arithmetic (19 + 12 + 28 + 40 + 38 + 13 + 9 + 2) sums to **161**, and live test runs during consolidation confirmed:

- api-gateway `internal-workspace-files.controller.spec.ts`: **19 tests** (confirmed by live run)
- ai-service (all 7 specs combined): **142 tests** (confirmed by live run: 12 + 28 + 40 + 38 + 13 + 9 + 2 = 142)
- **Grand total: 19 + 142 = 161 tests**

There is no suite that accounts for an extra test. The correct documented total is **161**.

---

## API Gateway Checkpoint Endpoint Behavior

### `POST /api/internal/workspace/:sessionId/checkpoint`

- Protected by `InternalServiceGuard` (requires `X-Internal-Service-Key` header).
- Accepts `sessionId` (path param) and optional `description` (body field).
- Delegates to the existing `ContainerManagerHttpClient` checkpoint method for the session workspace.
- Returns `200` with `{ ok: true, checkpointHash }` on success.
- Returns `400` if `sessionId` is missing or invalid.
- Returns `500` on unexpected container-manager errors.
- Not exposed to the frontend or external users.
- Does not conflict with the existing frontend-owned `POST /api/internal/git-checkpoints` route; both are protected internal endpoints serving different callers.

---

## ai-service Checkpoint Client Behavior

### `createWorkspaceCheckpoint(sessionId: string, description?: string): Promise<{ ok: boolean; checkpointHash: string }>`

- Calls `POST /api/internal/workspace/:sessionId/checkpoint` on the API Gateway internal service.
- Sends `X-Internal-Service-Key` header using the existing internal service key pattern.
- Sends `{ description }` as JSON body (description is optional).
- Returns `{ ok, checkpointHash }` on success.
- Throws a typed error on non-200 responses.
- No direct filesystem or container-manager access — all calls go through API Gateway.

---

## Agent Harness Config Changes

### `AgentHarnessConfigV1.enablePreApplyCheckpoint`

- Added boolean field `enablePreApplyCheckpoint` to `AgentHarnessConfigV1`.
- Default value in `DEFAULT_AGENT_HARNESS_CONFIG_V1`: **`true`**.
- When `true`, `executeAgentHarnessLoop` will call `createCheckpointFn` before the first mutating tool dispatch, if a `createCheckpointFn` is supplied via loop options.
- `enableToolLoop` remains **`false`** by default — no current production jobs enter the harness path.

---

## Loop Checkpoint-Before-Mutation Behavior

`executeAgentHarnessLoop` accepts two new optional loop options:

- `createCheckpointFn?: () => Promise<string>` — async callback that creates a checkpoint and returns the checkpoint hash.
- `mutatingToolNames?: Set<string>` — set of tool names that require a pre-apply checkpoint.

Behavior:

1. On each loop iteration, before dispatching a tool call, the orchestrator checks whether the tool name is in `mutatingToolNames`.
2. If it is, and `createCheckpointFn` is provided, and no checkpoint has been created yet in this execution (`checkpointCreated === false`):
   - Calls `await createCheckpointFn()`.
   - If the call resolves, sets `checkpointCreated = true` and stores the returned hash as `preApplyCheckpointHash` in loop state.
   - If the call throws, the mutating tool call returns `{ success: false, error: { code: 'CHECKPOINT_FAILED', message: '...' } }` and **no mutation is performed**.
3. Once `checkpointCreated === true`, subsequent mutating tool calls in the same loop execution skip checkpoint creation (at most one checkpoint per execution).
4. `read_file` and `list_files` are not in `mutatingToolNames` and never trigger checkpoint creation.
5. `preApplyCheckpointHash` is included in the returned `AgentHarnessLoopResult` when a checkpoint was created.

---

## WorkerProcessor Checkpoint Callback Wiring

`WorkerProcessor` constructs and passes `createCheckpointFn` and `mutatingToolNames` to `executeAgentHarnessLoop` exclusively inside the existing double-gated harness branch:

```
if (job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop === true) {
  const dispatcher = new ToolDispatcher();
  // ... register handlers ...

  const mutatingToolNames = new Set(['write_file', 'delete_file']);
  const createCheckpointFn = () =>
    this.apiGatewayHttpClient
      .createWorkspaceCheckpoint(sessionId, 'pre-apply harness checkpoint')
      .then(r => r.checkpointHash);

  const result = await executeAgentHarnessLoop({
    // ...
    createCheckpointFn,
    mutatingToolNames,
  });

  if (result.preApplyCheckpointHash) {
    // record in execution metadata
  }
}
```

- `createCheckpointFn` and `mutatingToolNames` are only constructed and passed inside the double-gated harness branch.
- The single-shot path (`this.aiExecutionService.execute()`) is completely unchanged.
- `preApplyCheckpointHash` is recorded in execution metadata when present, providing a rollback reference for future use.

---

## Rollback / Reference Behavior

- **No automatic rollback was implemented in AGENT-HARNESS-03C.**
- The `preApplyCheckpointHash` is recorded in `AgentHarnessLoopResult` and in `WorkerProcessor` execution metadata.
- This provides a safe reference for manual rollback or future automatic rollback implementation.
- Automatic rollback, SSE rollback events, and audit logging are deferred to a future slice (section 13.3 of the master plan).

---

## Safety Confirmations

- **No mutation happens if checkpoint creation fails.** If `createCheckpointFn` throws, the mutating tool returns `CHECKPOINT_FAILED` and no file is written or deleted. Confirmed by test 23: `does not dispatch mutating tool if checkpoint callback fails`.
- **Read-only tools do not create checkpoints.** `read_file` and `list_files` are not in `mutatingToolNames`. Confirmed by test 22: `does not call checkpoint callback for read_file/list_files only`.
- **Checkpoint is created at most once per loop execution.** The `checkpointCreated` flag prevents duplicate checkpoint creation within a single loop run. Confirmed by test 21: `calls checkpoint callback only once per loop execution`.
- **No automatic rollback was implemented.** Checkpoint hash is recorded as a reference only.
- **No frontend/UI/package/database changes.** No frontend files touched. No new npm packages introduced. No database schema changes.
- **No direct ai-service → container-manager calls.** All checkpoint and file operations go through the API Gateway internal boundary.
- **No checkpoint document was created before consolidation.** This document is the first and only checkpoint for AGENT-HARNESS-03C, created in the consolidation step per governance rules.

---

## Architecture Boundary Confirmation

ai-service accesses workspace checkpoint creation exclusively through the API Gateway internal boundary:

```
ai-service WorkerProcessor
  → executeAgentHarnessLoop (createCheckpointFn callback)
    → ApiGatewayHttpClient.createWorkspaceCheckpoint(sessionId, description)
      → API Gateway: POST /api/internal/workspace/:sessionId/checkpoint
        → ContainerManagerHttpClient.createSessionCheckpoint(sessionId, description)
          → container-manager → GitService → workspace git commit
```

No ai-service → container-manager direct call exists. No ai-service direct filesystem access exists.

---

## Security Invariants Confirmed

- **No direct filesystem access from ai-service.** All checkpoint creation goes through API Gateway → container-manager.
- **No direct ai-service → container-manager mutation or checkpoint calls.** The API Gateway internal endpoint is the only boundary.
- **No mutation before checkpoint succeeds.** Enforced in `executeAgentHarnessLoop`.
- **No hidden bypass of checkpoint/revert safety.** The `createCheckpointFn` gate is structurally required before any mutating dispatch.
- **No `run_validation` implementation.** Handler not created, not registered.
- **No `browser_smoke` implementation.** Handler not created, not registered.
- **No `start_preview` implementation.** Handler not created, not registered.
- **No `search_workspace` implementation.** Handler not created, not registered.
- **No shell execution.** No shell commands added anywhere.
- **No frontend/UI changes.** No frontend files touched.
- **No package/dependency changes.** No new npm packages introduced.
- **No database schema changes.**
- **No SSE event changes.** Existing SSE publisher untouched.
- **Existing single-shot path preserved.** `aiExecutionService.execute()` path unchanged.
- **`enableToolLoop` default `false` remains effective.** No current jobs enter the harness path.
- **`harnessVersion === 'v1'` gate remains effective.** Both gates must be true.
- **Existing `read_file`, `list_files`, `write_file`, `delete_file` behavior preserved.** Prior handler factories unchanged.
- **Existing frontend checkpoint flow preserved.** `POST /api/internal/git-checkpoints` (frontend-owned) is not touched.

---

## Invariant: No Checkpoint Before Consolidation

No checkpoint document was created before this consolidation step. Implementation was completed and validated first. This document is the first and only checkpoint for AGENT-HARNESS-03C, created in the consolidation step per governance rules.

---

## Dependency Chain

| Predecessor | Status |
|-------------|--------|
| AGENT-HARNESS-00 | COMPLETE and LOCKED |
| AGENT-HARNESS-01A | COMPLETE and LOCKED |
| AGENT-HARNESS-01B | COMPLETE and LOCKED |
| AGENT-HARNESS-01C | COMPLETE and LOCKED |
| AGENT-HARNESS-01D | COMPLETE and LOCKED |
| AGENT-HARNESS-01E | COMPLETE and LOCKED |
| AGENT-HARNESS-02A | COMPLETE and LOCKED |
| AGENT-HARNESS-02B | COMPLETE and LOCKED |
| AGENT-HARNESS-02C | COMPLETE and LOCKED |
| AGENT-HARNESS-03A | COMPLETE and LOCKED |
| AGENT-HARNESS-03B | COMPLETE and LOCKED |
| **AGENT-HARNESS-03C** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

**AGENT-HARNESS-04A — Validation Runner Tool**

Per the master plan (section 14) and the AGENT-HARNESS-04A roadmap entry:

- Implement the `run_validation` tool handler.
- Match command against policy allow-list.
- Execute via container-manager.
- Capture stdout/stderr with truncation.
- Return structured validation result to the harness loop.

AGENT-HARNESS-04A is the next defined slice in the master plan after the 03 checkpoint/patch series.

Per CLAUDE.md governance: **register AGENT-HARNESS-04A first in a separate step, then implement.**

Do NOT implement AGENT-HARNESS-04A here.

---

## Document Metadata

- **Created:** 2026-06-22
- **Task:** AGENT-HARNESS-03C
- **Status:** COMPLETE and LOCKED
- **Author:** AI-assisted consolidation pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AGENT-HARNESS-V1-MASTER-PLAN.md
