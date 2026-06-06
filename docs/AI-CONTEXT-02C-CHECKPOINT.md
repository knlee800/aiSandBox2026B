# AI-CONTEXT-02C Checkpoint — Inject Project AI Instructions into Prompt Assembly

**Task ID:** AI-CONTEXT-02C
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-06

---

## Objective

Fetch Project AI Instructions for the current project/session and inject them into AI prompt assembly alongside Global AI Instructions, so that project-specific guidance is included in every AI execution for the associated project.

---

## Files Changed

- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `services/api-gateway/src/ai/ai.module.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts`
- `services/ai-service/src/queue/job.types.ts`
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/worker/worker.processor.spec.ts`

No frontend, database migration, Global AI Instructions UI, Project AI Instructions UI, repo docs registry, repo map, validation contract, adapter, or governance files were changed.

---

## Implementation Summary

### Project ID Resolution (`ai-execution.controller.ts`)

- Injected `ProjectAiContextService` and `SessionService` into `AIExecutionController`.
- Added private `resolveProjectInstructions(sessionId, userId)` method:
  - Resolves project via existing session association: `request.sessionId → Session.projectId`.
  - Enforces ownership before use: only proceeds when `session.userId === identity.userId`.
  - If session has no `projectId`, omits project instructions.
  - Calls `ProjectAiContextService.getByProjectId(projectId)`.
  - Trims and normalizes; null/empty/whitespace returns `undefined`.
- No new request field was introduced.
- Errors during resolution are caught and logged as debug; execution continues without project instructions.

### Queue Payload (`ai-execution.controller.ts`)

- Optional `projectInstructions` added to `enqueueExecution` call alongside `globalInstructions`.
- Field is omitted when unresolved or empty (backward compatible).

### Job Type (`job.types.ts`, ai-service)

- Added `projectInstructions?: string` to `AiExecutionJob` interface.

### Prompt Assembly (`worker.processor.ts`, ai-service)

- Added `buildProjectInstructionsBlock(projectInstructions)` helper (same shape as `buildGlobalInstructionsBlock`).
- Extended `buildExecutionPromptParts` signature with optional fourth parameter `projectInstructions`.
- Project AI Instructions block is appended to system sections after Global AI Instructions.
- Block is skipped when null/empty/whitespace.
- Worker now passes `job.data.projectInstructions` into `buildExecutionPromptParts`.

### Final System Prompt Order

1. `FILE_ACTION_OUTPUT_CONTRACT`
2. `Global AI Instructions` (if present)
3. `Project AI Instructions` (if present)

User prompt remains:
- workspace context
- `User request`

---

## Tests Added / Updated

### api-gateway — `ai-execution.workspace-context.spec.ts`

- Existing tests: updated constructor calls to pass `projectAiContextService` and `sessionService` mocks.
- New: includes trimmed `projectInstructions` in queue payload when project instructions exist.
- New: omits `projectInstructions` when null/empty/whitespace.
- New: does not call `getByProjectId` when session has no resolvable project ID.
- Existing `globalInstructions` behavior tests preserved and passing.

### ai-service — `worker.processor.spec.ts`

- New: includes trimmed `Project AI Instructions` in system prompt when provided.
- New: omits `Project AI Instructions` for null/empty/whitespace.
- Updated: ordering test verifies `contract → global → project` positions.
- Updated: authority-boundary test verifies user part does not contain `Global AI Instructions:` or `Project AI Instructions:`.

---

## Validation Results

| Check | Result |
|---|---|
| `npm test -- src/ai/__tests__/ai-execution.workspace-context.spec.ts` (api-gateway) | PASS (8/8) |
| `npm test -- src/worker/worker.processor.spec.ts` (ai-service) | PASS (11/11) |
| `npm run build` (api-gateway) | PASS |
| `npm run build` (ai-service) | PASS |
| ReadLints on touched files | PASS |
| Live browser smoke | PASS |

### Live Browser Smoke

- Saved project instruction: `For this project only, start your next response with PROJECT-INSTRUCTION-TEST.`
- Sent: `Reply with one short sentence.`
- Response began with `PROJECT-INSTRUCTION-TEST` — confirmed.
- Global + Project instruction priority test passed.

---

## Preserved Invariants

- Global AI Instructions injection behavior unchanged (AI-CONTEXT-01B / AI-CONTEXT-01D).
- Browser session identity flow unchanged (AI-CONTEXT-01E).
- No frontend files changed.
- No database migrations.
- No Global AI Instructions UI changed.
- No Project AI Instructions UI changed.
- No repo docs registry, repo map, validation contract, or adapter files changed.
- `buildExecutionPromptParts` signature extension is backward compatible (optional fourth parameter).
