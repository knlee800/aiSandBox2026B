# AI-03-01A-CHECKPOINT.md

## Metadata

**Task ID:** AI-03-01A
**Parent:** AI-03-01 (Umbrella)
**Title:** Backend File-Action Output Pipeline
**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (CORE PRODUCT LOOP, BACKEND FIRST SLICE)
**Checkpoint path:** `docs/AI-03-01A-CHECKPOINT.md`
**Date:** 2026-04-03

---

## 1. Objective Completed

Implemented the first backend slice of AI-03-01 so AI execution can produce structured file-action instructions, validate them, and expose them through both the execution stream and the durable execution result/status path, without yet applying any file writes to the workspace.

This slice establishes the contract and dual-channel delivery path needed for later slices (AI-03-01B, AI-03-01C) while fully preserving existing text-response behavior and all Phase 84/79/80 surfaces.

---

## 2. Delivered Capability

### Structured FileAction contract

`FileAction` type defined in `ai-service`:

```
action: 'create' | 'write' | 'update'
path: string
content: string
```

Corresponding `FileActionDto` defined in `api-gateway` DTO layer.

### Parser + path validation

New `file-actions.parser.ts` module in `ai-service`:

- Extracts `file-actions` fenced code blocks from AI model output
- Parses JSON payload within each block
- Validates action type, path, and content fields
- Rejects malformed blocks silently (they are dropped, not propagated as errors)
- Path validation rejects:
  - path traversal (`../` or normalized equivalent)
  - empty paths
  - absolute paths (`/etc/...`, `C:\...`)
  - home-relative paths (`~`)
  - null bytes

### Additive `file_actions` stream event

`ExecutionStreamPublisher.publishFileActions()` added. The worker publishes a `{"type":"file_actions","actions":[...]}` event before the existing `{"type":"complete"}` event. Non-file-action prompts produce `actions: []`.

### Additive `fileActions` on `GET /api/ai/executions/:id` (completed status)

`ai-execution.controller.ts` reads `metadata.aiExecutionResult.fileActions` and returns it additively when execution status is `completed`. Non-file-action executions return `fileActions: []`. All non-completed statuses are unaffected.

Worker stores parsed `fileActions` in `metadata.aiExecutionResult` on the `usage_records` row when marking an execution `completed`.

### Non-file-action prompts degrade correctly

Prompts that produce no `file-actions` blocks result in:
- `fileActions: []` in the stream event
- `fileActions: []` in `GET /api/ai/executions/:id`
- Normal text response behavior unchanged

---

## 3. Files Changed

### ai-service

| File | Change |
|------|--------|
| `services/ai-service/src/ai-execution/types.ts` | Added `FileAction` type, `FileActionType` union, and optional `fileActions` field to `AIExecutionResult` |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | Wired parser: normalizes `AIExecutionResult` to separate `output` from parsed `fileActions` before returning |
| `services/ai-service/src/ai-execution/file-actions.parser.ts` | New — parser + path validation module |
| `services/ai-service/src/ai-execution/__tests__/file-actions.parser.spec.ts` | New — focused tests for parser and path validation |
| `services/ai-service/src/streaming/execution-stream.publisher.ts` | Added `publishFileActions()` method |
| `services/ai-service/src/streaming/__tests__/execution-stream.publisher.spec.ts` | New — tests verifying `file_actions` event published before `complete` |
| `services/ai-service/src/worker/worker.processor.ts` | On successful execution: calls `publishFileActions()`, stores `fileActions` in `metadata.aiExecutionResult`, includes in `UPDATE usage_records` |

### api-gateway

| File | Change |
|------|--------|
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Added `FileAction` interface, optional `fileActions` field on `AIExecutionResult` |
| `services/api-gateway/src/ai/dto/execution-result.dto.ts` | Added `FileActionDto` interface, optional `fileActions` field on `ExecutionResultDto` |
| `services/api-gateway/src/ai/execution-result.service.ts` | `getExecution()` now selects and parses `metadata` column, returning it alongside existing fields |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | `getExecution()` reads `metadata.aiExecutionResult.fileActions`, validates and returns additive `fileActions` on completed executions |
| `services/api-gateway/src/ai/idempotency.guard.ts` | Type-narrowed `aiExecutionResult` to include optional `fileActions`; propagated to reconstructed result |
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | `UpdateExecutionResultDto` extended with optional `fileActions` array; `updateExecutionResult()` includes it in `metadata.aiExecutionResult` |
| `services/api-gateway/src/ai/__tests__/ai-execution.get-execution-file-actions.spec.ts` | New — focused tests for additive `fileActions` on `getExecution()` |
| `services/api-gateway/src/ai/__tests__/ai-execution-idempotency.integration.spec.ts` | Updated to match current async queue-submit contract (`{ executionId, status: 'queued' }`) and inject required DI providers |

---

## 4. Tests Run and Results

| Service | Command | Result |
|---------|---------|--------|
| ai-service | `npm test -- file-actions.parser.spec.ts execution-stream.publisher.spec.ts` | PASS — 2 suites, 5 tests |
| ai-service | `npm test -- ai-execution.service.spec.ts` | PASS — 1 suite, 3 tests |
| api-gateway | `npm test -- ai-execution.get-execution-file-actions.spec.ts` | PASS — 1 suite, 2 tests |
| api-gateway | `npm test -- ai-execution-idempotency.integration.spec.ts` | PASS — 1 suite, 7 tests |

---

## 5. No Migration Required

No database schema migration was required. File actions are stored additively in the existing `metadata` JSONB column on `usage_records` under `metadata.aiExecutionResult.fileActions`. No new columns, tables, or constraints were added.

---

## 6. Scope Statement

Scope stayed fully within AI-03-01A. Specifically:

- Backend-only implementation (ai-service and api-gateway)
- No workspace file writes at any point
- No file tree refresh, editor reload, or preview refresh logic
- No auto-checkpoint logic
- No chat panel rendering changes
- No shell-first or agent-framework behavior
- No quota, billing, or auth redesign
- No AI-03-02 behavior of any kind

---

## 7. Preserved Behaviors

| Behavior | Status |
|----------|--------|
| Existing AI execution submit (`POST /api/ai/execute`) | Preserved — returns `{ executionId, status: 'queued' }` unchanged |
| Existing execution poll (`GET /api/ai/executions/:id`) | Preserved — `fileActions` is additive only; all non-completed status paths unchanged |
| Existing execution stream (`GET /api/ai/executions/:id/stream`) | Preserved — `token` and `complete` events unchanged; `file_actions` is an additive event before `complete` |
| Existing execution cancel | Preserved — no changes to cancel path |
| Existing text response behavior | Preserved — parser separates text from file-action blocks; text-only responses remain intact |
| Phase 84 chat panel (84A–84G) | Unchanged — no frontend behavioral changes |
| Phase 79 preview, file tree | Unchanged |
| Phase 80 editor save, manual checkpoint, revert | Unchanged |
| No workspace file writes | Confirmed — this slice produces file-action payloads only; writes are AI-03-01B |

---

## 8. Non-Goal Compliance

| Non-Goal | Assessment |
|----------|------------|
| No file writes to workspace | ✅ Confirmed — no file write calls in any changed file |
| No frontend behavioral changes | ✅ Confirmed — no frontend files changed |
| No file tree / editor / preview / checkpoint behavior | ✅ Confirmed |
| No chat result rendering changes | ✅ Confirmed |
| No multi-step orchestration | ✅ Confirmed |
| No shell-first behavior | ✅ Confirmed |
| No agent framework | ✅ Confirmed |
| No schema migration | ✅ Confirmed |
| No quota / billing / auth redesign | ✅ Confirmed |

---

## 9. Follow-Up Boundary (AI-03-01B Only)

AI-03-01B is the next child slice. It is NOT registered or started.

AI-03-01B scope (for future reference only — do not act on this):
- Frontend consumes `fileActions` from stream event and/or `GET /api/ai/executions/:id` status poll
- Frontend applies each file action exactly once per execution ID via existing `writeWorkspaceFile()` helper
- Explicit guards: once-only apply per execution ID, stale-session guard, terminated-session guard
- Sequential application for first slice; partial failure does not block subsequent writes
- No chat panel result rendering (that is AI-03-01C)
- No file tree refresh, editor reload, preview refresh, or auto-checkpoint (those are AI-03-02)

---

## 10. Sign-Off

**Task:** AI-03-01A
**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-03-01A-CHECKPOINT.md`
**Tests:** All relevant suites PASS
**Backend changes only:** Confirmed
**Schema changes:** None
**Workspace file writes:** None
**Follow-up slice started:** No
