# AGENT-HARNESS-05B9 — Checkpoint

**Task ID:** AGENT-HARNESS-05B9
**Title:** AI Execute SessionId UUID Validation
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-26
**Verdict:** PASS

---

## 1. Context from AGENT-HARNESS-05B7

AGENT-HARNESS-05B7 (ai-service Provider/Model Execution Validation Against Production Compose) is COMPLETE and LOCKED as of 2026-06-26.

During 05B7, the first live xAI execution attempt used the non-UUID sessionId value `"05b7-xai-test"`. That value propagated through the AI execution controller unchecked, reached `UsageLedgerService.writeExecutionIntent()`, and caused an unhandled Postgres UUID type error. The API returned HTTP 500 instead of a clean HTTP 400 client error. Correcting the sessionId to a valid UUID (`35d53116-6723-4571-af12-ac256977c007`) allowed 05B7 to pass. AGENT-HARNESS-05B9 was registered to fix the missing validation boundary.

AGENT-HARNESS-05B8 (Seed Test User Password Hash Correction) is also COMPLETE and LOCKED as of 2026-06-26. Its locked invariants (bcrypt hashes, seed files) are unaffected by this task.

---

## 2. Root Cause Confirmation

`AIExecutionRequest` is a plain TypeScript **interface**, not a class DTO.

The global `ValidationPipe` registered in `main.ts` relies on `class-validator` decorators applied to class instances. It cannot validate interface-only request bodies. As a result, `request.sessionId` arrived at `UsageLedgerService.writeExecutionIntent()` with no validation. The `usage_records.session_id` column is UUID-typed in Postgres. Passing a non-UUID string (`"05b7-xai-test"`) caused a Postgres type mismatch error that surfaced as HTTP 500.

**Finding summary:**
- Invalid sessionId `"05b7-xai-test"` → HTTP 500 (unhandled DB type mismatch)
- Valid UUID `35d53116-6723-4571-af12-ac256977c007` → execution proceeds normally
- Root cause: no controller-boundary UUID check; `@IsUUID()` cannot apply to interfaces

---

## 3. Files Changed

The following files were changed during the implementation step. No other files were modified.

| File | Change |
|------|--------|
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Added `uuidValidate` import; added explicit UUID guard at top of `execute()` |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Added new describe block with 4 focused tests for AGENT-HARNESS-05B9 |

No auth logic, no provider adapters, no queue schema, no database schema, no migration files, no frontend, no package files, no Docker files, no `.env`, and no other source files were modified.

---

## 4. Implementation Summary

### Controller change (`ai-execution.controller.ts`)

Added `validate as uuidValidate` import from the `uuid` package (already a project dependency). Added an explicit controller-boundary guard at the top of `execute()`, before any side-effecting call:

```typescript
import { validate as uuidValidate } from 'uuid';

// Inside execute():
if (!uuidValidate(request.sessionId)) {
  throw new BadRequestException('sessionId must be a valid UUID');
}
```

Validation fires before:
- Idempotency key handling
- `UsageLedgerService.writeExecutionIntent()`
- `QueueService.enqueueExecution()`

No auth guard, no provider resolution, no queue job payload shape, and no database schema were changed.

---

## 5. Why Explicit Controller Validation Was Chosen Over DTO `@IsUUID()`

`AIExecutionRequest` is a TypeScript interface. `class-validator` decorators (`@IsUUID()`) cannot be applied to interfaces — only to class instances. Converting the request to a class DTO would require renaming and refactoring the DTO layer, touching multiple files, and constituting broader scope than the approved slice.

Explicit `uuidValidate()` in the controller is:
- The smallest safe fix
- Applied at the correct boundary (controller entry, before any service call)
- Uses an existing `uuid` package already imported in the controller
- Fully tested by the new spec block

---

## 6. Tests Added

New describe block in `ai-execution.controller.spec.ts`:

**`AIExecutionController — sessionId UUID validation (AGENT-HARNESS-05B9)`**

| # | Test | Assertion |
|---|------|-----------|
| 1 | Invalid sessionId `"not-a-uuid"` | Throws `BadRequestException` with message `"sessionId must be a valid UUID"` |
| 2 | Invalid sessionId `"05b7-xai-test"` | Does not call `writeExecutionIntent()` or `reuseExecutionIntent()` |
| 3 | Invalid sessionId `"plainstring"` | Does not call `enqueueExecution()` |
| 4 | Valid UUID `"35d53116-6723-4571-af12-ac256977c007"` | Returns `{ executionId, status: "queued" }`; calls `writeExecutionIntent()` and `enqueueExecution()` exactly once |

---

## 7. Validation Results

### Targeted controller spec

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest --no-cache --testPathPatterns="ai-execution.controller.spec" --verbose
```

**Result: PASS**

- New AGENT-HARNESS-05B9 describe block: **4 tests PASS**
- Legacy describe block: 4 FAIL — pre-existing QueueService DI failures, matching known AGENT-HARNESS-05B8 baseline
- **No new failures attributed to AGENT-HARNESS-05B9**

### api-gateway build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npm run build
```

**Result: PASS** — exit code 0, clean TypeScript compilation.

### Lint

No errors on changed files.

### Pre-existing api-gateway test failures (not caused by this task)

The following failures are pre-existing and were present before this task:
- QueueService DI resolution failures (legacy describe block in `ai-execution.controller.spec.ts`)
- Jest worker crash failures

These are documented in AGENT-HARNESS-05B8 and earlier checkpoints and are unrelated to AGENT-HARNESS-05B9.

---

## 8. Confirmations and Non-Goals

- No auth guard changes.
- No provider resolution changes.
- No queue job payload shape changes.
- No database schema changes.
- No `usage_records` schema changes.
- No UUID typing loosened anywhere.
- No `.env` changes.
- No Dockerfile changes.
- No frontend changes.
- No provider/model execution run.
- No browser_smoke run.
- No runtime DB mutation.
- No Docker commands executed.
- No xAI execution rerun.
- No `harnessVersion` behavior changes.
- No Agent Harness wiring changes.
- No seed hash changes (locked by AGENT-HARNESS-05B8).

---

## 9. Locked Invariants

The following invariants are locked and must be preserved by all subsequent tasks:

1. `POST /api/ai/execute` must reject any non-UUID `sessionId` with HTTP 400 and message `"sessionId must be a valid UUID"` before any service call.
2. UUID validation must occur before `UsageLedgerService.writeExecutionIntent()` and before `QueueService.enqueueExecution()`.
3. The `uuid` package's `validate` function is the implementation-level validator for this boundary — do not replace or weaken it without a registered task.
4. `AIExecutionRequest` remains a TypeScript interface. Any conversion to a class DTO is out of scope unless explicitly registered as a separate task.
5. The 4 AGENT-HARNESS-05B9 tests in `ai-execution.controller.spec.ts` must remain passing. Do not remove or disable them.
6. All locked invariants from AGENT-HARNESS-05B7 (provider/model execution, xAI adapter, auth guards) and AGENT-HARNESS-05B8 (seed hashes) remain in force.

---

## 10. Next Recommended Task

Register **Agent Harness `harnessVersion` queue/API wiring validation or implementation review** — after Keith approval.

This covers verifying that the `harnessVersion` field is correctly wired through the execution queue payload and handled by the AI service, ensuring the harness version contract is enforced end-to-end. This was deferred during prior AGENT-HARNESS phases and is the logical next hardening step in the API Gateway / Agent Harness slice.
