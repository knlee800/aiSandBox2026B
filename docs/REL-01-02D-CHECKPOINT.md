# REL-01-02D CHECKPOINT - Fix Public API Execution Status Lookup

## Task Metadata

- Task ID: REL-01-02D
- Title: Fix Public API Execution Status Lookup
- Nature: BUG FIX (RELEASE READINESS, LIVE-SMOKE BLOCKER)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-02D-CHECKPOINT.md`

## Objective

Fix the concrete live-stack defect blocking REL-01-02 so public API execution status lookup works after successful API-key execution submission.

## Root Cause

- `PublicAIController.getExecution()` enforces ownership with `record.user_id === identity.userId`.
- `ExecutionResultService.getExecution()` did not select `user_id` from `usage_records`.
- As a result, `record.user_id` was `undefined` for public lookup, causing deterministic `404` on every `GET /api/v1/ai/executions/:executionId` request even when `POST /api/v1/ai/execute` succeeded.

## Minimal Fix Applied

- File updated: `services/api-gateway/src/ai/execution-result.service.ts`
- Added `user_id` to the `SELECT` list in `getExecution(executionId)`.
- No route changes, no controller redesign, and no internal/public architecture changes.

## Exact Commands / Checks Run

1. Targeted unit test:
   - `npm test -- public-ai.controller.spec.ts --runInBand` (working directory: `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)
2. Rebuild/restart only api-gateway container so live stack picks up fix:
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d --build api-gateway`
3. Targeted live public path validation:
   - Bounded PowerShell flow against `http://localhost:4000`:
     - register/login
     - create API key
     - create session
     - `POST /api/v1/ai/execute`
     - bounded polling `GET /api/v1/ai/executions/:executionId` (up to 10 tries, 2s interval)
4. Directly relevant internal-path regression sanity check:
   - Bounded PowerShell flow against `http://localhost:4000`:
     - `POST /api/ai/execute`
     - bounded polling `GET /api/ai/executions/:executionId`

## Validation Outcome

- Public submit path: **PASS**
  - `POST /api/v1/ai/execute` returned `202` with `status=queued` and execution ID.
- Public status path: **PASS**
  - `GET /api/v1/ai/executions/:executionId` returned `200` with coherent execution status/result shape for the submitted execution.
- Internal execution behavior (directly relevant sanity): **PASS**
  - Internal submit and status endpoints remained functional after the fix.

## Acceptance Criteria Check

- `POST /api/v1/ai/execute` succeeds: ✅
- `GET /api/v1/ai/executions/:executionId` returns coherent status/result: ✅
- Internal/public separation preserved: ✅
- No unrelated execution behavior changed (directly relevant check): ✅
- Cause + fix + validation documented: ✅
