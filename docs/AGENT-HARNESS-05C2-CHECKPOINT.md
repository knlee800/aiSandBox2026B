# AGENT-HARNESS-05C2 — Harness Version API-to-Queue Wiring — CHECKPOINT

**Task ID:** AGENT-HARNESS-05C2
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-26
**Family:** AGENT-HARNESS
**Phase:** 5C
**Nature:** IMPLEMENTATION

---

## 1. Context from 05C1

AGENT-HARNESS-05C1 confirmed a producer/consumer gap:

- **Consumer ready:** `ai-service` `AiExecutionJob` already included `harnessVersion?: string`. `WorkerProcessor` already branched on `job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop`.
- **Producer unwired:** `api-gateway` `AIExecutionRequest` did not include `harnessVersion`. `AIExecutionController` did not validate or forward it. The field never reached the BullMQ job payload.

Double gate confirmed safe: wiring `harnessVersion` alone could not activate the Agent Harness loop because `enableToolLoop` defaults to `false`.

**Approved strategy (from 05C1):** Strategy A — add optional `harnessVersion?: 'v1'` to the public request body with explicit allow-list validation in the controller.

---

## 2. Root Cause / Gap Confirmed

| Gap | Detail |
|-----|--------|
| `AIExecutionRequest` missing field | No `harnessVersion` property in the interface |
| `AIExecutionController` no validation | Field not read, not validated, not forwarded |
| BullMQ job payload never set | `harnessVersion` absent from every queued job |
| Consumer already ready | `AiExecutionJob.harnessVersion` and `WorkerProcessor` branch were already in place since the ai-service harness work |

---

## 3. Files Changed

| File | Change |
|------|--------|
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Added `harnessVersion?: 'v1'` to `AIExecutionRequest` interface |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Added allow-list validation and conditional queue payload forwarding |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Added new describe block with 5 tests for 05C2 behavior |

**Files unchanged:**
- `services/ai-service/` — no changes
- `services/ai-service/src/worker/worker.processor.ts` — no changes
- `services/ai-service/src/agent-harness/config/agent-harness.config.ts` — no changes
- All frontend, database, Docker, `.env`, and package files — no changes

---

## 4. Implementation Summary

### `ai-service-http.client.ts`
Added `harnessVersion?: 'v1'` to the `AIExecutionRequest` interface. No runtime behavior change — type-level addition only.

### `ai-execution.controller.ts`
Added allow-list validation in `AIExecutionController.execute()`:

```typescript
const hv = body.harnessVersion;
if (hv !== undefined && hv !== 'v1') {
  throw new BadRequestException('Invalid harnessVersion');
}
```

Forwarded `harnessVersion` into `QueueService.enqueueExecution()` payload using a conditional spread:

```typescript
...(hv === 'v1' ? { harnessVersion: hv } : {}),
```

Property is omitted when `undefined`. Property is included only when `harnessVersion === 'v1'`.

### `ai-execution.controller.spec.ts`
Added describe block: `AIExecutionController — harnessVersion wiring (AGENT-HARNESS-05C2)` with 5 targeted tests (see §6).

---

## 5. Validation Order and Side-Effect Safety

Validation runs in this order inside `AIExecutionController.execute()`:

1. `sessionId` UUID validation (from AGENT-HARNESS-05B9 — preserved intact)
2. `harnessVersion` allow-list validation (new — 05C2)
3. Idempotency handling
4. Provider resolution
5. Ledger write
6. Queue enqueue

**Side-effect safety:**
- Invalid `harnessVersion` throws `BadRequestException` before any ledger write.
- Invalid `harnessVersion` throws `BadRequestException` before any queue enqueue.
- Invalid `sessionId` remains rejected before `harnessVersion` check — 05B9 order preserved.

---

## 6. Tests Added

**Describe block:** `AIExecutionController — harnessVersion wiring (AGENT-HARNESS-05C2)`
**File:** `services/api-gateway/src/ai/ai-execution.controller.spec.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | `harnessVersion` undefined | Proceeds; `harnessVersion` absent from queue payload |
| 2 | `harnessVersion: 'v1'` | Accepted; queue payload includes `harnessVersion: 'v1'` |
| 3 | `harnessVersion: 'v2'` | Rejected with `BadRequestException`; no ledger or enqueue side effects |
| 4 | `harnessVersion: 123` | Rejected with `BadRequestException`; no ledger or enqueue side effects |
| 5 | Invalid `sessionId` with valid `harnessVersion` | Still rejected before `harnessVersion` check; confirms 05B9 behavior intact |

---

## 7. Validation Results

### Targeted test run
```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest --no-cache --testPathPatterns="ai-execution.controller.spec" --verbose
```

**Result:**
- 9 passed (includes 05B9 + 05C2 new tests)
- 4 failed — pre-existing `QueueService` DI baseline failures, present since AGENT-HARNESS-05B8, not introduced by 05C2
- No new failures attributed to 05C2

### Build
```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npm run build
```

**Result:** PASS — exit code 0, clean TypeScript compilation.

### Lint
No errors on changed files.

**Final verdict:** PASS — new 05C2 tests pass; 4 pre-existing legacy DI failures unchanged; build clean.

---

## 8. Confirmations / No-Goals

| Item | Status |
|------|--------|
| `enableToolLoop` remains `false` | Confirmed |
| `ai-service` unchanged | Confirmed |
| `DEFAULT_AGENT_HARNESS_CONFIG_V1` unchanged | Confirmed |
| Auth/guard behavior unchanged | Confirmed |
| Provider resolution unchanged | Confirmed |
| Queue implementation unchanged except optional `harnessVersion` payload | Confirmed |
| Database schema unchanged | Confirmed |
| `.env` unchanged | Confirmed |
| Docker unchanged | Confirmed |
| Frontend unchanged | Confirmed |
| No live provider/model execution run | Confirmed |
| No `browser_smoke` run | Confirmed |
| No git commit/push during consolidation | Confirmed |

---

## 9. Locked Invariants

The following invariants are locked from this checkpoint forward:

- `AIExecutionRequest.harnessVersion` is `undefined | 'v1'` only. No other values are accepted.
- `harnessVersion` validation fires after `sessionId` UUID check and before any ledger write or queue enqueue.
- `harnessVersion` is omitted from job payload when `undefined`; included only when `=== 'v1'`.
- `enableToolLoop` must remain `false` until an explicit approved task enables it.
- `ai-service` worker branching logic is unchanged.
- 05B9 `sessionId` UUID validation remains first in the validation chain.
- Pre-existing 4 legacy `QueueService` DI spec failures are a known baseline — do not treat as regressions.

---

## 10. Next Recommended Task

**AGENT-HARNESS-05C3 — Harness Version Runtime Validation**

- Scope: validate that a request with `harnessVersion: 'v1'` reaches the worker and the harness branch condition is evaluated (with `enableToolLoop` still `false`).
- Prerequisites: Keith approval; `enableToolLoop` must remain `false` throughout 05C3.
- Registration only; no implementation during registration step.

---

> LOCKED — do not modify this checkpoint.
