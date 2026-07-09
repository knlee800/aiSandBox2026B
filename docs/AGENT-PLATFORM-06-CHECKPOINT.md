# AGENT-PLATFORM-06 — Upstream Identity Propagation — Checkpoint

**Task ID:** AGENT-PLATFORM-06
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-09
**Family:** AGENT PLATFORM / MULTI-BUILDER ORCHESTRATION
**Nature:** IMPLEMENTATION — bounded upstream identity field propagation through execution path
**Checkpoint created:** 2026-07-09

---

## 1. Task Summary

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-06 |
| Steps | 4-step loop (Registration → Readiness/Source-Path Review → Bounded Implementation → Consolidation) |
| Nature | Implementation — upstream identity propagation |
| Purpose | Wire `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` from API Gateway request boundary through BullMQ job payload to AI Service worker and UsageRecord attribution, enabling future multi-builder orchestration routing and per-builder billing attribution |
| Implementation | COMPLETE — 8 source/test files changed across API Gateway and AI Service |
| Runtime execution | NONE — no services started, no jobs executed, no containers created |
| Keith approval | Registration approved 2026-07-09 |
| Final status | COMPLETE and LOCKED |

---

## 2. Workflow Steps — All COMPLETE

| Step | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Registration | COMPLETE and LOCKED | 2026-07-09 |
| 2 | Readiness / Source-Path Review | COMPLETE and LOCKED | 2026-07-09 |
| 3 | Bounded Implementation | COMPLETE and LOCKED | 2026-07-09 |
| 4 | Consolidation / Checkpoint (this step) | COMPLETE and LOCKED | 2026-07-09 |

---

## 3. Purpose

Upstream identity propagation for multi-builder orchestration readiness.

The AGENT-PLATFORM-05 orchestration plan established that identity fields (`agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`) were absent from the full execution path above the AI Service worker. AGENT-HARNESS-07 had already wired `agentRole`/`builderProfileId` into the worker's harness config resolution path, but these fields were never populated upstream in the API Gateway or job payload. Without upstream propagation, downstream audit attribution, orchestration routing, and billing attribution cannot be completed when multi-builder orchestration is eventually activated.

---

## 4. Identity Fields Implemented

| Field | Type | Boundary Added |
|-------|------|----------------|
| `agentRole` | `string?` | `AIExecutionRequest` type, controller forwarding, usage intent metadata, worker finalization metadata |
| `builderProfileId` | `string?` | `AIExecutionRequest` type, controller forwarding, usage intent metadata, worker finalization metadata |
| `collaborationRunId` | `string?` | `AIExecutionRequest` type, controller forwarding, `AiExecutionJob` type (future-safe placeholder) |
| `referralTraceId` | `string?` | `AIExecutionRequest` type, controller forwarding, `AiExecutionJob` type (future-safe placeholder) |

All fields are optional. Single-builder executions are unaffected when fields are absent.

---

## 5. Execution Path Covered

| Boundary | Status |
|----------|--------|
| Frontend execution request boundary (`POST /api/ai/execute`) | Identity fields accepted as optional on `AIExecutionRequest` |
| `AIExecutionController.execute()` | Forwards `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` to both usage intent and queue payload |
| `UsageLedgerService.writeExecutionIntent()` | `agentRole` and `builderProfileId` stored in `usage_records.metadata` JSONB |
| `QueueService.enqueueExecution()` | BullMQ `ai-execution` job payload includes all four identity fields |
| `AiExecutionJob` type | `collaborationRunId` and `referralTraceId` added as optional fields |
| `WorkerProcessor.process()` | Reads `agentRole`/`builderProfileId` from `job.data`; included in finalization `nextMetadata` written to `usage_records` |
| `usage_records` metadata finalization | `agentRole` and `builderProfileId` preserved in final `metadata` JSONB update |

---

## 6. Implementation Summary

- `AIExecutionRequest` type extended with four optional identity fields: `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`
- `AIExecutionController.execute()` spreads identity fields into both `writeExecutionIntent()` call and `enqueueExecution()` job payload
- `UsageLedgerService.writeExecutionIntent()` accepts identity fields in DTO; stores `agentRole` and `builderProfileId` in existing `metadata` JSONB column — **no database migration required**
- `AiExecutionJob` type extended with `collaborationRunId` and `referralTraceId` as optional future-safe placeholder fields
- `WorkerProcessor.process()` reads `agentRole`/`builderProfileId` from `job.data` and merges them into `nextMetadata` before the final `UPDATE usage_records ... SET metadata = $3::jsonb` raw SQL call
- All changes are backward compatible — when identity fields are absent, existing single-builder resolution path (`global-default-missing-profile`) is unchanged
- No database migration — identity stored in existing `metadata` JSONB; proper columns deferred to future task if SQL-based attribution queries are needed

---

## 7. Files Changed in Implementation

| # | File | Change |
|---|------|--------|
| 1 | `services/api-gateway/src/clients/ai-service-http.client.ts` | Added optional `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` to `AIExecutionRequest` interface |
| 2 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Forwarded identity fields from request body to `writeExecutionIntent()` and `enqueueExecution()` job payload |
| 3 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Extended `WriteExecutionIntentDto` with identity fields; stored `agentRole`/`builderProfileId` in `metadata` JSONB during intent write |
| 4 | `services/ai-service/src/queue/job.types.ts` | Added optional `collaborationRunId`, `referralTraceId` to `AiExecutionJob` interface |
| 5 | `services/ai-service/src/worker/worker.processor.ts` | Included `agentRole`/`builderProfileId` from `job.data` in `nextMetadata` during ledger finalization |
| 6 | `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Added tests for identity field forwarding to `enqueueExecution()`; fixed obsolete test module setup (4 failures resolved) |
| 7 | `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts` | Added tests for identity field persistence in `metadata` JSONB |
| 8 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | Added tests for identity field preservation in worker finalization metadata |

---

## 8. Test Coverage

| Test Category | File | Coverage |
|---------------|------|---------|
| API Gateway controller identity forwarding | `ai-execution.controller.spec.ts` | `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` forwarded to `enqueueExecution()` call args |
| Usage metadata JSONB persistence | `usage-ledger.service.spec.ts` | `writeExecutionIntent()` stores `agentRole`/`builderProfileId` in `metadata`; identity absent when fields omitted |
| Queue/job identity propagation | `ai-execution.controller.spec.ts` | Identity fields present in BullMQ job payload |
| Worker finalization preservation | `worker.processor.builder-config.spec.ts` | `agentRole`/`builderProfileId` from `job.data` appear in finalized usage record metadata |
| Backward compatibility | All three spec files | Existing tests continue to pass without identity fields; single-builder execution path unaffected |

---

## 9. Validation Results

| Command | Result |
|---------|--------|
| `npx jest --runInBand "ai-execution.controller.spec"` (api-gateway) | **38 passed, 0 failed** |
| `npx jest --runInBand "usage-ledger.service.spec"` (api-gateway) | **44 passed, 0 failed** |
| `npx jest --runInBand "worker.processor.builder-config"` (ai-service) | **43 passed, 0 failed** |
| `npm test -- --runInBand` (ai-service, full suite) | **34 suites, 654 passed, 1 skipped, 0 failed** |
| `npx tsc --noEmit` (api-gateway) | **PASS** |
| `npx tsc --noEmit` (ai-service) | **PASS** |

---

## 10. Follow-Up Fix Record

- Initial `ai-execution.controller.spec.ts` had 4 failures from an obsolete test module setup that predated the identity propagation changes
- Fix applied: test module setup updated in `ai-execution.controller.spec.ts` (test-only change — no production source changes)
- Final targeted spec passes 38/38

---

## 11. Safety / Non-Goals Confirmed

| Non-Goal | Status |
|----------|--------|
| No database migration | CONFIRMED — `metadata` JSONB only |
| No env / docker / package changes | CONFIRMED |
| No frontend UI / text changes | CONFIRMED |
| No orchestration coordinator | CONFIRMED — deferred to AGENT-PLATFORM-07+ |
| No multi-builder runtime execution | CONFIRMED |
| No write_file / delete_file activation | CONFIRMED |
| No provider / API calls | CONFIRMED |
| No browser smoke | CONFIRMED |
| No git commits / pushes during consolidation | CONFIRMED |

---

## 12. UX/UI Constraints (Locked for Future Implementors)

- No new user-facing UI text was added in this task
- Future UI additions for multi-builder orchestration must be **multilingual-first**:
  - Add or update keys in `frontend/messages/en.json`
  - Add or update matching keys in `frontend/messages/zh-TW.json`
  - Add or update matching keys in `frontend/messages/zh-CN.json`
  - Use existing translation hook/pattern (`useTranslations` / `next-intl`)
  - Do not add hardcoded English UI copy
- Icons: **Heroicons v2 Outline only**
- Impeccable and Emil Kowalski design engineering skills are **advisory only** — must not override governance, scope, architecture, or tests

---

## 13. Step-by-Step Acceptance Criteria — All Satisfied

| Criterion | Status |
|-----------|--------|
| AGENT-PLATFORM-06 registered in TASKS.md as ACTIVE (Step 1) | [x] COMPLETE |
| AGENT-PLATFORM-06 mirrored in TASKS_BACKLOG_FULL.md (Step 1) | [x] COMPLETE |
| AINOW-EXECUTION-ROADMAP.md updated (Step 1) | [x] COMPLETE |
| Source-path review document created (Step 2) | [x] COMPLETE — `docs/AGENT-PLATFORM-06-SOURCE-PATH-REVIEW.md` |
| All 8 execution path gaps mapped and confirmed (Step 2) | [x] COMPLETE |
| `AIExecutionRequest` extended with identity fields (Step 3) | [x] COMPLETE |
| Controller forwards identity to intent write and job payload (Step 3) | [x] COMPLETE |
| Usage ledger stores identity in `metadata` JSONB (Step 3) | [x] COMPLETE |
| `AiExecutionJob` includes `collaborationRunId`/`referralTraceId` (Step 3) | [x] COMPLETE |
| Worker preserves identity in finalization metadata (Step 3) | [x] COMPLETE |
| All three test files pass targeted specs (Step 3) | [x] COMPLETE |
| API Gateway full test suite passes (Step 3) | [x] COMPLETE |
| AI Service full test suite passes (Step 3) | [x] COMPLETE — 34 suites, 654 passed |
| `npx tsc --noEmit` clean in api-gateway (Step 3) | [x] COMPLETE |
| `npx tsc --noEmit` clean in ai-service (Step 3) | [x] COMPLETE |
| Backward compatibility preserved — single-builder unaffected (Step 3) | [x] COMPLETE |
| AGENT-PLATFORM-05 remains COMPLETE and LOCKED | [x] CONFIRMED |
| AGENT-PLATFORM-04 remains COMPLETE and LOCKED | [x] CONFIRMED |
| AGENT-HARNESS-07 remains COMPLETE and LOCKED | [x] CONFIRMED |
| AGENT-HARNESS-06E remains COMPLETE and LOCKED | [x] CONFIRMED |
| Checkpoint document created (Step 4) | [x] COMPLETE (this document) |
| TASKS.md updated COMPLETE and LOCKED (Step 4) | [x] COMPLETE |
| TASKS_BACKLOG_FULL.md mirrored (Step 4) | [x] COMPLETE |
| AINOW-EXECUTION-ROADMAP.md updated (Step 4) | [x] COMPLETE |
| Next recommended task recorded, not registered (Step 4) | [x] AGENT-PLATFORM-07 — Read-Only Orchestration Coordinator |

---

## 14. Prerequisite Chain Integrity (Locked Invariants)

| Task | Status at Checkpoint |
|------|---------------------|
| AGENT-HARNESS-06E | COMPLETE and LOCKED — 2026-07-09 |
| AGENT-HARNESS-07 | COMPLETE and LOCKED — 2026-07-07 |
| AGENT-PLATFORM-04 | COMPLETE and LOCKED — 2026-07-07 |
| AGENT-PLATFORM-05 | COMPLETE and LOCKED — 2026-07-09 |
| AGENT-PLATFORM-06 | COMPLETE and LOCKED — 2026-07-09 |

These invariants must not be disturbed by future tasks unless an explicitly approved architecture change task targets them.

---

## 15. Files Changed During Consolidation

| File | Action |
|------|--------|
| `docs/AGENT-PLATFORM-06-CHECKPOINT.md` | CREATED (this document) |
| `TASKS.md` | UPDATED — AGENT-PLATFORM-06 marked COMPLETE and LOCKED; all acceptance criteria checked; checkpoint reference added; validation results recorded; AGENT-PLATFORM-07 noted as next recommended (not registered) |
| `TASKS_BACKLOG_FULL.md` | UPDATED — mirrored TASKS.md exactly |
| `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATED — AGENT-PLATFORM-06 marked COMPLETE and LOCKED; AGENT-PLATFORM-07 recorded as next recommended (not registered) |

### Files NOT Changed During Consolidation

- All files under `services/` — NOT CHANGED
- All files under `frontend/` — NOT CHANGED
- All files under `database/` — NOT CHANGED
- All `.env*` files — NOT CHANGED
- All `docker*` files — NOT CHANGED
- All `package*.json` files — NOT CHANGED
- All migration files — NOT CHANGED

---

## 16. Next Step (Not Registered)

**AGENT-PLATFORM-07 — Read-Only Orchestration Coordinator Planning or Registration**

Recommended next slice from the AGENT-PLATFORM-05 orchestration plan:

- Design and/or implement a read-only orchestration coordinator that accepts multi-builder execution requests
- Uses `agentRole`/`builderProfileId`/`collaborationRunId` identity fields now propagated through the execution path
- Read-only first — no shared workspace writes, no write_file/delete_file activation
- AGENT-HARNESS write canary remains a **separate** track and must not be mixed into AGENT-PLATFORM-07

**Status:** Not registered. Requires Keith approval before registration.

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-06 Step 4 — Consolidation / Checkpoint
- **Status:** COMPLETE and LOCKED
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
