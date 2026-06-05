# AI-CONTEXT-01B Checkpoint — Inject Global AI Instructions into Prompt Assembly

**Task ID:** AI-CONTEXT-01B
**Family:** AI-CONTEXT (Global AI Instructions)
**Status:** COMPLETE and LOCKED
**Priority:** High
**Nature:** BACKEND / AI PROMPT ASSEMBLY
**Risk:** Medium
**Depends on:** AI-CONTEXT-01A (COMPLETE and LOCKED)
**Checkpoint created:** 2026-06-05

---

## Problem

AI-CONTEXT-01A created backend storage and API for user-scoped global AI instructions, but those instructions were not consumed by the AI execution pipeline. Agents did not receive the user's global instructions.

---

## Objective

Wire saved user global AI instructions into the AI execution prompt assembly path so every AI execution includes them predictably and safely.

---

## Exact Files Changed

```
services/api-gateway/src/ai/ai-execution.controller.ts
services/api-gateway/src/ai/ai.module.ts
services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts
services/ai-service/src/queue/job.types.ts
services/ai-service/src/worker/worker.processor.ts
services/ai-service/src/worker/worker.processor.spec.ts
```

No frontend files were changed.
No governance/checkpoint/docs files were changed during implementation.

---

## Payload / Type Changes

- `services/ai-service/src/queue/job.types.ts`: Added optional `globalInstructions?: string` to `AiExecutionJob`.
- Queue payload from api-gateway now includes `globalInstructions` only when the value is non-empty after trimming. Empty/whitespace/null produces no field.

---

## Prompt Flow Summary

1. `POST /api/ai/execute` reaches `AIExecutionController.execute()`.
2. Before enqueueing, the controller calls `UserAiInstructionsService.getByUserId(identity.userId)` (injected via `@Optional()`).
3. The result is normalized: trimmed; if null/empty/whitespace → `undefined`; otherwise → trimmed string.
4. Normalized value is included as `globalInstructions` in the BullMQ enqueue payload.
5. The ai-service worker receives `job.data.globalInstructions`.
6. `buildExecutionPromptWithFileActionContract(prompt, workspaceContext, globalInstructions)` assembles the prompt.

---

## Prompt Ordering

```
FILE_ACTION_OUTPUT_CONTRACT
[Global AI Instructions block — only when non-empty]
[Workspace context block — only when present]
User request:
{user prompt}
```

`FILE_ACTION_OUTPUT_CONTRACT` always comes first and is never overridden.
The Global AI Instructions block is skipped entirely when instructions are empty/null/whitespace.
Existing workspace context behavior is unchanged.

---

## Module Wiring

- `UserAiInstructionsModule` imported into `AIModule` so `UserAiInstructionsService` is available to `AIExecutionController`.
- `UserAiInstructionsService` injected with `@Optional()` to preserve backward compatibility with test modules that do not provide it.

---

## Tests Updated

### `services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts`
- Existing two tests updated: pass `userAiInstructionsService` mock to controller constructor (returns `null`).
- New: queue payload includes trimmed `globalInstructions` when service returns a non-empty value.
- New: queue payload omits `globalInstructions` when returned value is whitespace-only.

### `services/ai-service/src/worker/worker.processor.spec.ts`
- Existing workspace-context ordering test updated to reflect new prompt order (FILE_ACTION_OUTPUT_CONTRACT now leads).
- New: Global AI Instructions block is included when instructions are provided (and trimmed of surrounding whitespace).
- New: Global AI Instructions block is omitted when instructions are `null` or whitespace.
- New: ordering assertion verifies FILE_ACTION_OUTPUT_CONTRACT → Global AI Instructions → workspace context → User request.

---

## Validation Results

| Command | Result |
|---|---|
| `npm test -- src/ai/__tests__/ai-execution.workspace-context.spec.ts src/user-ai-instructions/user-ai-instructions.service.spec.ts` (api-gateway) | PASS — 2 suites, 7 tests |
| `npm run build` (api-gateway) | PASS |
| `npm test -- src/worker/worker.processor.spec.ts` (ai-service) | PASS — 1 suite, 8 tests |
| `npm run build` (ai-service) | PASS |
| ReadLints on touched files | PASS — no linter errors |

---

## Broader Suite Exception

Broader `npm test` runs failed in both services. Failures are pre-existing and unrelated to AI-CONTEXT-01B:

**api-gateway broader suite:**
- Older ai-execution spec files use test module setups that do not provide `QueueService`, causing `Nest can't resolve dependencies` on those legacy test setups. These failures existed before AI-CONTEXT-01B.
- Integration/orphan suites fail with `AggregateError` due to no database connectivity (Docker/PostgreSQL not running in this environment). Consistent with carry-forward from `AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` and `WORKSPACE-DEFAULT-01-CHECKPOINT.md`.

**ai-service broader suite:**
- Adapter spec failures are caused by external provider connectivity (real API calls). Consistent with carry-forward.
- `app.module.spec.ts` fails due to DB connectivity. Consistent with carry-forward.

**Classification:** Not a regression from AI-CONTEXT-01B. All targeted tests for changed paths pass. Both service builds pass.

---

## Non-Goals Confirmed

- No frontend files changed.
- No project instructions implemented.
- No repo docs registry touched.
- No repo map touched.
- No validation contract touched.
- No checkpoint/history/file-tree UI changes.
- No database schema changes beyond AI-CONTEXT-01A.
- No unrelated AI execution refactor.

---

## Next Recommended Step

**AI-CONTEXT-01C** — Global AI Instructions Frontend Settings UI

Allow users to view and save their global AI instructions from the aiSandBox frontend. This would wire the existing `GET /api/user/ai-instructions` and `PUT /api/user/ai-instructions` endpoints into a settings panel with i18n-first copy.
