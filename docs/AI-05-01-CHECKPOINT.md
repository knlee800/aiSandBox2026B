# AI-05-01 CHECKPOINT

## Task Metadata

- Task ID: AI-05-01
- Title: Diagnose AI File Creation Failure Path
- Nature: BUG INVESTIGATION (CORE PRODUCT LOOP, AI-TO-WORKSPACE FAILURE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/AI-05-01-CHECKPOINT.md`

## Objective

Trace why the AI says it cannot create a file despite the existing AI-to-workspace file-action pipeline, and isolate the exact failing stage with bounded evidence.

## Exact Commands / Actions / Checks Run

1. Read governance/task/checkpoint prerequisites:
   - Read `CLAUDE.md`
   - Read `TASKS.md` AI-05 section
   - Read `TASKS_BACKLOG_FULL.md` AI-05-01 entries
   - Read:
     - `docs/AI-03-01A-CHECKPOINT.md`
     - `docs/AI-03-01B-CHECKPOINT.md`
     - `docs/AI-03-01C-CHECKPOINT.md`
     - `docs/AI-03-02-CHECKPOINT.md`
     - `docs/ADV-01-01-CHECKPOINT.md`
     - `docs/ADV-02-01-CHECKPOINT.md`
     - `docs/REL-01-02-CHECKPOINT.md`
2. Verified live stack availability:
   - `Invoke-WebRequest http://localhost:4000/api/health`
3. Bounded live reproduction (real API path used by workspace chat):
   - Register/login test user via `/api/auth/register`, `/api/auth/login`
   - Create API key via `/api/keys` with scope `ai:execute`
   - Submit file-creation request to `POST /api/ai/execute` with:
     - provider: `xai`
     - model: `grok-3`
     - prompt requesting file creation
     - sessionId/conversationId UUIDs
   - Observe stream payload via:
     - `curl.exe -sN --max-time 12 http://localhost:4000/api/ai/executions/{executionId}/stream`
   - Observe persisted/completion payload via:
     - `GET /api/ai/executions/{executionId}`
4. Differential validation run (to isolate stage):
   - Run A (plain natural-language file-create prompt)
   - Run B (explicit instruction to output fenced `file-actions` JSON only)
   - Compare `GET /api/ai/executions/{executionId}` results.
5. Code-path inspection across required chain:
   - Provider/model selection and request payload:
     - `frontend/app/[locale]/app/page.tsx`
     - `services/api-gateway/src/ai/ai-execution.controller.ts`
   - AI raw output -> parser:
     - `services/ai-service/src/ai-execution/ai-execution.service.ts`
     - `services/ai-service/src/ai-execution/file-actions.parser.ts`
   - Stream/completion payload:
     - `services/ai-service/src/worker/worker.processor.ts`
     - `services/ai-service/src/streaming/execution-stream.publisher.ts`
     - `services/api-gateway/src/ai/ai-execution.controller.ts`
   - Frontend apply/guard path:
     - `frontend/app/[locale]/app/page.tsx`
     - `frontend/components/workspace/workspace-ai-file-actions.logic.ts`

## Evidence (Smallest Set)

### Repro A: Plain file-creation request (fails to produce structured actions)

- Request (real execute path):
  - `provider=xai`, `model=grok-3`
  - Prompt: create a file in `notes/...`
- Stream output included:
  - `{"type":"token","content":"I've created ..."}`
  - `{"type":"file_actions","actions":[]}`
  - `{"type":"complete"}`
- Completion output (`GET /api/ai/executions/{id}`):
  - `status: "completed"`
  - `provider: "xai"`
  - `model: "grok-3"`
  - `output`: natural-language claim of file creation
  - `fileActions: []`

### Repro B: Explicit structured output request (pipeline works)

- Request (same provider/model/path):
  - `provider=xai`, `model=grok-3`
  - Prompt explicitly requires fenced `file-actions` JSON.
- Completion output (`GET /api/ai/executions/{id}`):
  - `status: "completed"`
  - `output: ""` (fenced block stripped by parser)
  - `fileActions: [{"action":"create","path":"notes/structured-request.txt","content":"hello from structured request"}]`
- Stream output included:
  - `{"type":"file_actions","actions":[{"action":"create","path":"notes/stream-structured.txt","content":"stream structured"}]}`
  - `{"type":"complete"}`

## Exact Failing Stage Identified

The failure occurs at the **model output contract stage** (before backend parse/application):

- For normal user prompts, the model returns natural-language text (e.g., "I've created the file") but does **not** emit fenced `file-actions` JSON blocks.
- Backend parser (`extractFileActionsFromOutput`) is functioning as designed and therefore extracts `fileActions: []`.
- Stream path, persisted metadata path, status endpoint, and frontend consumption/apply path all preserve that empty list correctly.

So the break is:

1. request reaches provider/model correctly,
2. model output is unstructured for file-action contract,
3. parser returns empty actions,
4. downstream receives/applies nothing.

## Session / Stale / Terminated Guard Outcome

Guards were inspected and are not the failing stage for this bug. They execute in frontend apply logic after actions exist. In the failing repro, actions are empty before guard decisions matter.

## Scope Compliance

- Investigation only.
- No fix implemented.
- No contract redesign.
- No UX work.
- No unrelated code changes.

## Conclusion

AI-05-01 diagnosis is complete and bounded. The next task can be a single fix focused on ensuring normal prompts reliably produce structured `file-actions` output (prompting/contract emission), without redesigning downstream parsing/apply infrastructure.
