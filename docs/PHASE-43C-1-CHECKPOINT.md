# PHASE-43C-1 CHECKPOINT
## Execution Observability & Integrity Telemetry — Log-Only Structured JSON

**Phase:** PHASE-43C  
**Stage:** STAGE-43C-1  
**Nature:** IMPLEMENTATION (Log-Only Telemetry Instrumentation)  
**Scope:** api-gateway ONLY  
**Status:** LOCKED  
**Date:** 2026-03-03  
**Design Reference:** `docs/PHASE-43C-1-DESIGN.md`  
**Previous Checkpoint:** `docs/PHASE-43B-4-CHECKPOINT.md`

---

## ULTRA-BRIEF SUMMARY (≤5 bullets)

1. **Log-only telemetry** — all instrumentation emits structured JSON via the existing NestJS `Logger`; no new tables, no migrations, no Prometheus, zero breaking changes
2. **Eleven stable event names** — `idempotency.*` and `execution.*` events added as structured log lines at existing decision points in three files; no new files created
3. **Try/catch rethrow only** — the sole structural addition in `ai-execution.controller.ts` is a minimal try/catch/rethrow wrapper around the AI call and ledger update; error propagation and HTTP status codes are unchanged
4. **Unit layer green** — 35/35 suites, 559/559 tests passing after unit stabilization; integration tier excluded intentionally (requires live PostgreSQL + AI provider)
5. **Locked invariants preserved** — idempotency replay/orphan/conflict behavior is semantically unchanged; no quota, provider, or ledger side-effects introduced on any path

---

## 1. Overview and Purpose

### What PHASE-43C-1 Adds

PHASE-43C-1 instruments the api-gateway execution pipeline with structured JSON telemetry. Prior to this phase, log output from `IdempotencyGuard`, `AIExecutionController`, and `UsageLedgerService` was free-text or absent. After this phase, every significant execution lifecycle event emits a stable, machine-parseable JSON log line.

**Problem Solved:**
- Execution lifecycle was opaque — no structured signal for orphan accumulation, replay rate, ledger write failures, or AI provider failures
- Distinguishing AI-service failures (no tokens consumed) from ledger write failures (tokens consumed, ledger not updated) required manual log inspection
- No stable event vocabulary existed for future counter aggregation or Prometheus integration

**Implementation Strategy:**
- Enhance existing `logger.log/error/warn` calls to emit structured JSON (no new log calls in `UsageLedgerService`)
- Add minimal try/catch/rethrow wrappers in `AIExecutionController.execute()` for failure-path logging (log + rethrow — zero semantic change)
- Add structured log calls in `IdempotencyGuard.canActivate()` at existing decision points
- No new files, no new dependencies, no schema changes, no migrations

---

## 2. Stable Event Names and Triggers

All events are emitted via `this.logger.log(JSON.stringify({...}))` or `this.logger.error(JSON.stringify({...}))`.

### 2.1 `idempotency.*` Events

| Event Name | Emitter | Trigger |
|---|---|---|
| `idempotency.replay` | `IdempotencyGuard.canActivate()` | A `completed` record is found for `(userId, requestId)`; `IdempotentReplayException` is about to be thrown; `outcome` is `cache_hit` if `metadata.aiExecutionResult` is present, `fallback_placeholder` if absent |
| `idempotency.orphan_transitioned` | `UsageLedgerService.transitionOrphanToTimeout()` | A `pending` record older than `ORPHAN_TIMEOUT_MS` (5 min) is successfully transitioned to `timeout` |
| `idempotency.orphan_transition_noop` | `UsageLedgerService.transitionOrphanToTimeout()` | Transition attempted but record was already transitioned (no-op branch) |
| `idempotency.conflict_pending` | `IdempotencyGuard.canActivate()` | A `pending` record younger than `ORPHAN_TIMEOUT_MS` is found; 409 Conflict is about to be thrown |
| `idempotency.retry_allowed` | `IdempotencyGuard.canActivate()` | A `timeout` or `failed` record is found; guard passes through to allow retry |

### 2.2 `execution.*` Events

| Event Name | Emitter | Trigger |
|---|---|---|
| `execution.intent_written` | `UsageLedgerService.writeExecutionIntent()` | New `pending` row inserted into `usage_records`; `flow: "new"` |
| `execution.intent_reused` | `UsageLedgerService.reuseExecutionIntent()` | Existing `timeout`/`failed` row recycled as new `pending`; `flow: "reuse"` |
| `execution.ai_success` | `AIExecutionController.execute()` | `aiServiceHttpClient.execute()` returned successfully; emitted before ledger update |
| `execution.ai_failure` | `AIExecutionController.execute()` | `aiServiceHttpClient.execute()` threw; emitted in catch block before rethrow; `pending` record remains |
| `execution.result_updated` | `UsageLedgerService.updateExecutionResult()` | `usage_records` row transitioned from `pending` → `completed`; full result stored in metadata |
| `execution.result_update_failed` | `UsageLedgerService.updateExecutionResult()` error branch | Ledger UPDATE threw after AI success — **CRITICAL**: tokens consumed but ledger not updated |

---

## 3. Hook Points

### 3.1 `IdempotencyGuard.canActivate()`
**File:** `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\idempotency.guard.ts`

Structured log calls added at four existing decision points within `canActivate()`:
- Before throwing `IdempotentReplayException` (completed record found) → `idempotency.replay`
- After `transitionOrphanToTimeout()` call (pending record age > `ORPHAN_TIMEOUT_MS`) → `idempotency.orphan_transitioned`
- Before throwing 409 (pending record age ≤ `ORPHAN_TIMEOUT_MS`) → `idempotency.conflict_pending`
- When guard passes through on retryable status (`timeout`/`failed`) → `idempotency.retry_allowed`

No changes to guard return values, exception types, or guard ordering.

### 3.2 `AIExecutionController.execute()`
**File:** `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\ai-execution.controller.ts`

Two minimal try/catch/rethrow wrappers added around:
1. `aiServiceHttpClient.execute()` — on success emits `execution.ai_success`; on catch emits `execution.ai_failure` then rethrows
2. `updateExecutionResult()` — on success emits `execution.result_updated`; on catch emits `execution.result_update_failed` then rethrows

Both wrappers are log + rethrow only. No new HTTP status codes. No new error types. No behavioral change on any path.

### 3.3 `UsageLedgerService`
**File:** `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\usage-ledger\usage-ledger.service.ts`

Existing `logger.log/error/warn` calls enhanced to emit structured JSON at six points:

| Method | Branch | Event |
|---|---|---|
| `writeExecutionIntent()` | Success | `execution.intent_written` |
| `reuseExecutionIntent()` | Success | `execution.intent_reused` |
| `updateExecutionResult()` | Success | `execution.result_updated` |
| `updateExecutionResult()` | Error | `execution.result_update_failed` |
| `transitionOrphanToTimeout()` | Transition applied | `idempotency.orphan_transitioned` |
| `transitionOrphanToTimeout()` | No-op branch | `idempotency.orphan_transition_noop` |

No new log calls added. Format changes from free-text to structured JSON only.

---

## 4. Event Schema (Stable Contract)

The following fields form the stable contract for all telemetry events. Field names MUST NOT be renamed or removed once published.

| Field | Type | Description | Required |
|---|---|---|---|
| `event` | `string` | Stable event name (see Section 2) | Always |
| `timestamp` | `string` | ISO 8601 UTC timestamp | Always |
| `userId` | `string` | Verified user identifier (from `ApiKeyIdentity`) | Always |
| `apiKeyId` | `string` | API key identifier (from `ApiKeyIdentity`) | Always |
| `requestId` | `string \| null` | Client-provided `Idempotency-Key` value; `null` if not provided | Always |
| `executionId` | `string` | UUID of the `usage_records` row | Always |
| `status` | `string` | `pending \| completed \| timeout \| failed` | Always |
| `provider` | `string \| null` | AI provider name (e.g., `stub`, `openai`) | When known |
| `model` | `string \| null` | AI model name (e.g., `gpt-4`, `stub-model`) | After AI call |
| `tokensUsed` | `number \| null` | Actual tokens consumed | After AI call |
| `durationMs` | `number \| null` | Total execution wall-clock time (ms) | After AI call |
| `outcome` | `string \| null` | Sub-classification: `cache_hit`, `fallback_placeholder`, `new`, `reuse` | When applicable |
| `errorClass` | `string \| null` | Error constructor name (e.g., `HttpException`, `QueryFailedError`) | On failures |
| `errorMessage` | `string \| null` | Error message string | On failures |
| `flow` | `string \| null` | `new` (writeExecutionIntent) or `reuse` (reuseExecutionIntent) | On intent write |
| `pendingAgeMs` | `number \| null` | Age of `pending` record in ms at detection time | On orphan events |
| `priorStatus` | `string \| null` | Previous `execution_status` before transition | On transitions |

**Example — successful new execution (three events in sequence):**
```json
{"event":"execution.intent_written","timestamp":"2026-03-03T10:00:00.000Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-001","status":"pending","flow":"new","provider":"stub"}
{"event":"execution.ai_success","timestamp":"2026-03-03T10:00:02.150Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-001","provider":"stub","model":"stub-model","tokensUsed":42,"durationMs":2150}
{"event":"execution.result_updated","timestamp":"2026-03-03T10:00:02.200Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-001","status":"completed","model":"stub-model","tokensUsed":42,"durationMs":2200}
```

**Example — idempotency replay (cache hit):**
```json
{"event":"idempotency.replay","timestamp":"2026-03-03T10:01:00.000Z","userId":"user-abc","apiKeyId":"key-123","requestId":"client-key-xyz","executionId":"exec-uuid-001","status":"completed","outcome":"cache_hit","quota_bypassed":true}
```

**Example — critical: AI success + ledger write failure:**
```json
{"event":"execution.ai_success","timestamp":"2026-03-03T10:05:00.000Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-003","provider":"stub","model":"stub-model","tokensUsed":100,"durationMs":1500}
{"event":"execution.result_update_failed","timestamp":"2026-03-03T10:05:00.100Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-003","errorClass":"QueryFailedError","errorMessage":"connection refused"}
```

---

## 5. Locked Invariants

### 5.1 Log-Only — No DB Counters, No Prometheus

All telemetry output is structured JSON emitted via the NestJS `Logger`. No new database tables, columns, or rows are written. No Prometheus metrics are registered. No `prom-client` dependency is introduced. This invariant holds for the lifetime of PHASE-43C-1.

**Rationale:** No generic counters table exists in the api-gateway schema. No Prometheus scraping infrastructure exists (the `/api/runtime/metrics` endpoint from PHASE-41A returns custom JSON, not Prometheus format).

### 5.2 Idempotency Replay/Orphan/Conflict Behavior Unchanged

The semantic behavior of `IdempotencyGuard.canActivate()` is identical before and after this phase:
- `completed` record → `IdempotentReplayException` thrown (HTTP 200 via filter) — unchanged
- `pending` record < 5 min → 409 Conflict thrown — unchanged
- `pending` record ≥ 5 min → `transitionOrphanToTimeout()` called, guard continues — unchanged
- `timeout`/`failed` record → guard passes through — unchanged

Structured log calls are inserted at these decision points but do not alter control flow, return values, or exception types.

### 5.3 No Quota, Provider, or Ledger Side-Effects on Replay

Replay path (`idempotency.replay` event) terminates the guard pipeline via `IdempotentReplayException` before `QuotaGuard`, `TokenQuotaGuard`, `AIServiceHttpClient.execute()`, or `UsageLedgerService.writeExecutionIntent()` are invoked. This invariant is inherited from PHASE-43B-2-HOTFIX and PHASE-43B-3 and is not altered by PHASE-43C-1.

### 5.4 No Semantic Changes — Only Try/Catch Rethrow for Logging

The only structural code addition in `AIExecutionController.execute()` is try/catch/rethrow wrappers. Every catch block logs the failure event and then rethrows the original error unchanged. The caller receives the same exception, the same HTTP status code, and the same response body as before instrumentation. No new error types are introduced.

### 5.5 Backward-Compatible Log Format

Existing log consumers (stdout, any log aggregator) receive richer JSON output but no removed fields. Free-text log lines in `UsageLedgerService` that previously existed are replaced with structured JSON equivalents carrying the same information plus the stable event fields.

---

## 6. Verification Evidence

### 6.1 Unit Layer — Green

```
Test Suites: 35 passed, 35 total
Tests:       559 passed, 559 total
Snapshots:   0 total
```

All 35 unit suites and all 559 unit tests pass on the current developer machine after the PHASE-43C unit stabilization (documented in `docs/PHASE-43C-UNIT-STABILIZATION-CHECKPOINT.md`).

### 6.2 Integration Tier — Excluded Intentionally

Integration specs (`*.integration.spec.ts`, `smoke.integration.spec.ts`) require a live PostgreSQL instance and a configured AI provider. They are not part of the unit layer count and are not included in the 559 figure. This exclusion is intentional and consistent with prior phase checkpoints.

### 6.3 ERROR Logs During Tests — Expected and Non-Blocking

Structured JSON telemetry output from `IdempotencyGuard`, `AIExecutionController`, and `UsageLedgerService` appears in test stdout during negative-path tests. `ERROR`-level log lines are emitted by tests that exercise failure branches (e.g., AI call failure, ledger write failure). These are correct behavior — telemetry is emitted to the NestJS logger, not to test assertions. No tests assert on log output. These ERROR logs do not indicate test failures.

### 6.4 No Production Code Regressions

The PHASE-43C unit stabilization (`docs/PHASE-43C-UNIT-STABILIZATION-CHECKPOINT.md`) confirms:
- Zero production source files were modified during stabilization
- All stabilization changes were confined to spec files
- No telemetry instrumentation added in PHASE-43C-1 was removed or altered during stabilization

---

## 7. Files Modified

| File | Change Type |
|---|---|
| `services/api-gateway/src/ai/idempotency.guard.ts` | Structured log calls added at four decision points in `canActivate()` |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Two try/catch/rethrow wrappers added; structured log calls for success and failure paths |
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Six existing `logger.log/error/warn` calls enhanced to emit structured JSON |

**New files created: 0**  
**Schema changes: 0**  
**Migration files: 0**  
**New dependencies: 0**

---

## 8. Modification Policy

### Changes Requiring a New Phase

The following changes are prohibited within PHASE-43C-1 and require a new phase designation:

| Category | Examples |
|---|---|
| **Schema changes** | Adding a counters table, adding columns to `usage_records`, any migration |
| **Prometheus integration** | Adding `prom-client`, registering metrics, exposing `/metrics` endpoint |
| **Event name changes** | Renaming any event in the stable registry (Section 2), removing fields from the schema (Section 4) |
| **Behavioral changes** | Any modification to guard return values, exception types, HTTP status codes, or guard ordering |
| **New log call locations** | Instrumenting files outside the three listed in Section 7 |
| **Counter aggregation** | Writing event counts to any persistent store (DB, Redis, file) |
| **Background workers** | Orphan reconciliation schedulers, telemetry flush workers |

### Allowed Modifications Without New Phase

- Adding new fields to existing event payloads (additive, non-breaking)
- Adding new tests
- Adding documentation
- Fixing bugs that preserve all locked invariants (Section 5)

### Rollback Policy

Revert the three files listed in Section 7. Zero database impact. Zero migration required. No data loss. The unit test suite returns to its pre-instrumentation state.

---

## 9. Cross-Reference to Prior Phases

| Prior Phase | Relevance |
|---|---|
| PHASE-43A-1 | Identified `usage_records` idempotency risk; established two-write pattern requirement |
| PHASE-43A-2B/C | Introduced `requestId` / `IdempotencyGuard`; defines replay short-circuit semantics |
| PHASE-43B-2 | Implemented two-phase write (`writeExecutionIntent` + `updateExecutionResult`) |
| PHASE-43B-3 | Stored `aiExecutionResult` in `metadata` for deterministic replay |
| PHASE-43B-4 | Implemented orphan reconciliation (`transitionOrphanToTimeout`, `reuseExecutionIntent`) |
| PHASE-43C-UNIT-STABILIZATION | Restored unit layer to green (35/35, 559/559) after machine migration; no production code changes |
| PHASE-42A-3 | Token quota guard; advisory lock; `pending` records excluded from quota SUM |
| PHASE-41A | Runtime metrics endpoint; confirms no existing Prometheus infrastructure |

---

**Document Status:** FINAL and LOCKED  
**Next Stage:** STAGE-43C-2 (Counter Aggregation — future phase; requires counters table)  
**Modification Policy:** Any change to event names, schema fields, or instrumented files requires a new phase (see Section 8)

---

**END OF CHECKPOINT**
