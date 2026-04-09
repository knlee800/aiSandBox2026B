# AI-05-02 CHECKPOINT

## Task Metadata

- Task ID: AI-05-02
- Title: Strengthen File Action Output Contract For Normal File Creation Prompts
- Nature: BUG FIX (CORE PRODUCT LOOP, MODEL OUTPUT CONTRACT)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/AI-05-02-CHECKPOINT.md`

## Objective

Make normal file-creation prompts reliably produce valid file-action output so the existing parser, stream, persistence, and frontend apply path can create files during ordinary usage.

## Exact Change Implemented

Updated only the normal execution prompt path in:

- `services/ai-service/src/worker/worker.processor.ts`

Change details:

- Added a bounded output-contract wrapper (`FILE_ACTION_OUTPUT_CONTRACT` + `buildExecutionPromptWithFileActionContract()`).
- Worker now sends the wrapped prompt to `AIExecutionService.execute(...)`.
- Contract explicitly requires fenced `file-actions` JSON for file create/modify requests.
- Contract explicitly preserves plain conversational behavior for non-file prompts.
- No parser, stream, persistence, frontend apply, provider selection, or model marketplace redesign.

## Validation Run (Real Path)

### Runtime prep

1. Health check:
   - `Invoke-WebRequest http://localhost:4000/api/health`
2. Rebuild/restart ai-service so live stack uses this change:
   - `docker compose -f docker-compose.prod.yml up -d --build ai-service`

### Ordinary file-create prompt (normal execution path)

Flow used:

- Register/login user via `/api/auth/register`, `/api/auth/login`
- Create API key with `ai:execute` via `/api/keys`
- Submit execution via `POST /api/ai/execute` with `provider=xai`, `model=grok-3`
- Prompt: create `notes/ai-05-02-stream.txt`
- Read completion via `GET /api/ai/executions/:executionId`
- Capture live SSE via `GET /api/ai/executions/:executionId/stream`

Observed result:

- Completion status: `completed`
- Completion `fileActions`: non-empty (1 action)
  - `{"action":"create","path":"notes/ai-05-02-stream.txt","content":"stream contract check"}`
- Stream emitted:
  - token event
  - `file_actions` event with non-empty `actions`
  - complete event

### Non-file prompt behavior check

Flow used:

- Same normal execution path (`POST /api/ai/execute` + `GET /api/ai/executions/:executionId`)
- Prompt: non-file informational question

Observed result:

- Completion status: `completed`
- Completion `fileActions`: empty (`0`)
- Output: normal conversational sentence

## Additional Checks

- Changed-file lints (`ReadLints`) on:
  - `services/ai-service/src/worker/worker.processor.ts`
- Result: no linter errors.

## Scope Compliance

- In scope only: output-contract strengthening on normal execution prompt path.
- Preserved existing parser/stream/persistence/frontend apply flow.
- Preserved non-file conversational behavior.
- No schema changes.
- No parser redesign.
- No frontend apply redesign.
- No broad orchestration redesign.
- No provider marketplace/model redesign.

## Conclusion

AI-05-02 objective is met: ordinary file-create prompts now produce valid non-empty file-actions through the existing normal path, while non-file prompts remain conversational.
