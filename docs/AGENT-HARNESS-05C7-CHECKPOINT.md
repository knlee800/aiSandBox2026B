# AGENT-HARNESS-05C7 — Checkpoint

**Task ID:** AGENT-HARNESS-05C7
**Title:** Harness Identity Entitlement Gate
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-01

---

## 1. Dependency Context

| Task | Status | Role |
|---|---|---|
| AGENT-HARNESS-05C4 | COMPLETE and LOCKED | Security review; identified HIGH finding: no harness-mode authorization gate. |
| AGENT-HARNESS-05C5 | COMPLETE and LOCKED | Session ownership validation added to controller (03-step before entitlement). |
| AGENT-HARNESS-05C5A | COMPLETE and LOCKED | Consolidation/checkpoint for 05C5. |
| AGENT-HARNESS-05C6 | COMPLETE and LOCKED | LaunchGuard / `AGENT_HARNESS_ENABLE_TOOL_LOOP` flag implementation. |
| AGENT-HARNESS-05C6A | COMPLETE and LOCKED | Consolidation/checkpoint for 05C6; confirmed `enableToolLoop` remains `false`. |

This task closes the HIGH security gap identified in 05C4: no entitlement check existed before ledger write or BullMQ enqueue, meaning any `ai:execute` caller could request `harnessVersion: "v1"`.

---

## 2. Objective

Implement a harness-specific entitlement gate that:

1. Prevents non-entitled identities from entering the Agent Harness route.
2. Is independent of `ai:execute`, LaunchGuard, `isInternal`, and session ownership.
3. Rejects non-entitled `harnessVersion: "v1"` requests with `403 Forbidden` before ledger write and BullMQ enqueue.
4. Leaves plain execution (no `harnessVersion`) completely unchanged.
5. Does not activate `enableToolLoop` (remains `false`).

---

## 3. Root Cause / Security Gap

From AGENT-HARNESS-05C4 HIGH finding:

> No harness-mode authorization exists. Any authenticated `ai:execute` user can currently request `harnessVersion: "v1"`. Once `enableToolLoop` is true, they would enter harness mode unless a separate entitlement gate exists.

Specific gaps closed by this task:
- `isInternal: true` did not scope harness access.
- `ai:execute` scope did not scope harness access.
- `admin` role was not an entitlement source.
- Browser-session users were not explicitly excluded.
- Static/dev API keys were not explicitly excluded.
- No entitlement check existed before ledger write or BullMQ enqueue.

---

## 4. Exact Files Changed

1. `services/api-gateway/src/auth/api-key.config.ts`
2. `services/api-gateway/src/auth/api-key-auth.guard.ts`
3. `services/api-gateway/src/ai/ai-execution.controller.ts`
4. `services/api-gateway/src/ai/ai-execution.controller.spec.ts`

No other source, test, package, Docker, frontend, database, ai-service, schema, or environment files were changed.

---

## 5. Entitlement Model

### Field Added
`harnessEntitled?: boolean` added to `ApiKeyIdentity` in `api-key.config.ts`.

### Entitlement Rules

| Identity Source | Entitlement | Notes |
|---|---|---|
| Browser-session user | `false` | Defaults to not entitled. |
| Static/dev API key | `false` by default | Only keys with explicit `harnessEntitled: true` in config are entitled. |
| Database-backed API key | `false` by default | Entitled iff `scopes.includes("ai:harness")`. |
| `isInternal: true` | `false` | `isInternal` does NOT imply harness entitlement. |
| `admin` role | `false` | `admin` does NOT imply harness entitlement. |
| `ai:execute` scope | `false` | `ai:execute` does NOT imply harness entitlement. |
| Explicitly entitled identity | `true` | Only path to `harnessEntitled: true`. |

### Static Harness Test Key Added (api-key.config.ts)
```
token:    test-harness-api-key
identity: user-harness / key-harness
scopes:   ["ai:execute", "ai:harness"]
isInternal: true
harnessEntitled: true
```
Existing static keys remain unchanged and are NOT harness-entitled.

### Database-backed API Key Mapping (api-key-auth.guard.ts)
`scopes.includes("ai:harness")` → `harnessEntitled: true`.

---

## 6. Controller Validation Order

After AGENT-HARNESS-05C7, the controller validates in this sequence:

1. `sessionId` UUID validation — 05B9
2. `harnessVersion` allow-list validation (`"v1"` or absent) — 05C2
3. **Harness entitlement gate** — 05C7 (NEW): `identity.harnessEntitled === true` required when `harnessVersion === "v1"`
4. Session ownership lookup/check — 05C5
5. Idempotency key validation/normalization
6. Provider resolution
7. User/project instruction enrichment
8. Usage ledger intent flow
9. `queueService.enqueueExecution`

---

## 7. Forbidden Response and Side-Effect Safety

- **Rejection HTTP status:** `403 Forbidden`
- **Rejection via:** `ForbiddenException("Forbidden")`
- **Message:** Does not leak entitlement configuration, key names, or internal identity details.
- **Side-effect safety:** Rejection at step 3 ensures:
  - `sessionService.getSessionById` — NOT called
  - `userAiInstructionsService.getByUserId` — NOT called
  - `projectAiContextService.getByProjectId` — NOT called
  - `usageLedgerService.reuseExecutionIntent` — NOT called
  - `usageLedgerService.writeExecutionIntent` — NOT called
  - `queueService.enqueueExecution` — NOT called
  - No `usage_records` row created.
  - No BullMQ job enqueued.

---

## 8. Test Coverage Added / Updated

### New describe block added
`AIExecutionController — harness identity entitlement gate (AGENT-HARNESS-05C7)`

### Test scenarios A–J
| Scenario | Description | Expected |
|---|---|---|
| A | Non-entitled browser-session + no `harnessVersion` | succeeds (plain path unchanged) |
| B | Non-entitled browser-session + `harnessVersion: "v1"` | `403 Forbidden`, no side effects |
| C | `isInternal: true`, not harness-entitled + `harnessVersion: "v1"` | `403 Forbidden`, no side effects |
| D | `ai:execute` scope, not harness-entitled + `harnessVersion: "v1"` | `403 Forbidden`, no side effects |
| E | Explicitly harness-entitled identity + `harnessVersion: "v1"` | accepted and queued (`enableToolLoop: false`) |
| F | Explicitly harness-entitled identity + no `harnessVersion` | plain path unchanged, no entitlement lookup |
| G | Session ownership mismatch (05C5 invariant) | rejects at correct boundary, no side effects |
| H | Invalid `harnessVersion` (not `"v1"`) | `BadRequest` before entitlement lookup |
| I | Rejection error response content | does not leak entitlement config, key names, or identity |
| J | Existing 05B9, 05C2, 05C5 tests | remain passing |

### No-side-effect assertions (forbidden paths B, C, D)
Asserted `not.toHaveBeenCalled()` for: `sessionService.getSessionById`, `userAiInstructionsService.getByUserId`, `projectAiContextService.getByProjectId`, `usageLedgerService.reuseExecutionIntent`, `usageLedgerService.writeExecutionIntent`, `queueService.enqueueExecution`.

### Updates to existing tests
- Existing 05C2 `harnessVersion v1` success path identity updated to `harnessEntitled: true`.
- Existing focused harness/session tests updated as needed for compatibility.

---

## 9. Validation Results

### Focused harness test suite
**Command:** `npx jest --no-cache --testPathPatterns="ai-execution.controller.spec" --verbose`

| Describe block | Result |
|---|---|
| AGENT-HARNESS-05B9 | PASSED |
| AGENT-HARNESS-05C2 | PASSED |
| AGENT-HARNESS-05C5 | PASSED |
| AGENT-HARNESS-05C7 | PASSED |

### Build
**Command:** `npm run build` (api-gateway)
**Result:** PASSED — tsc success, clean build.

### Overall verdict: **PASS**

---

## 10. Pre-existing Legacy DI Failures (Separated)

The legacy top-level describe block `AIExecutionController (Phase 18A + ...)` contains 4 failing tests due to missing `QueueService` provider wiring in an obsolete test setup. These failures:

- Pre-date AGENT-HARNESS-05C7.
- Are unrelated to any change made in this task.
- Were not introduced or modified by this task.
- Do not affect 05B9, 05C2, 05C5, or 05C7 focused harness test results.

These failures are a known pre-existing issue and must be tracked and resolved separately.

---

## 11. Scope Confirmations and Non-Goals

**Confirmed scope (files changed):**
- `services/api-gateway/src/auth/api-key.config.ts`
- `services/api-gateway/src/auth/api-key-auth.guard.ts`
- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `services/api-gateway/src/ai/ai-execution.controller.spec.ts`

**Confirmed non-goals (not done):**
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` was NOT set to `true`.
- Agent Harness was NOT activated.
- `enableToolLoop` remains `false`.
- xAI tool-use was NOT implemented.
- Tool audit events were NOT implemented.
- Read-only tool canary was NOT implemented.
- Mutating-tool approval workflow was NOT implemented.
- `browser_smoke` was NOT run.
- Real `.env` was NOT read or modified.
- No Docker, compose, live API, queue, database, or runtime commands were executed.
- No source files outside the approved four were changed.
- No `.env` changes.
- No Docker/compose/database/ai-service/package/schema/frontend changes.
- Worker/ai-service unchanged.

---

## 12. Locked Invariants

The following invariants are locked as of this checkpoint and must not be altered by future tasks without explicit approval:

1. `harnessEntitled: false` is the default for all identity sources unless explicitly configured.
2. `isInternal: true` does NOT imply `harnessEntitled: true`.
3. `ai:execute` scope does NOT imply `harnessEntitled: true`.
4. `admin` role does NOT imply `harnessEntitled: true`.
5. Non-entitled `harnessVersion: "v1"` requests are rejected at `ForbiddenException` before any ledger write or BullMQ enqueue.
6. Controller validation order (05B9 → 05C2 → 05C7 → 05C5 → ledger → queue) is locked.
7. Plain execution (no `harnessVersion`) is completely unchanged and requires no entitlement check.
8. `enableToolLoop` remains `false`; the tool loop is not activated.
9. The static harness test key (`test-harness-api-key`) is the only entitled static key; existing static keys remain not entitled.
10. Database-backed API key entitlement requires explicit `ai:harness` scope membership.

---

## 13. Deployment / Runtime Validation Pending

AGENT-HARNESS-05C7 is **source/build/unit validated**.

Runtime validation (Docker, live api-gateway, live ai-service, live BullMQ, live database) remains pending. This must be registered separately as:

**AGENT-HARNESS-05C7A — Harness Entitlement Runtime Validation**

No runtime validation was performed during this implementation step. `enableToolLoop` must remain `false` during runtime validation unless explicitly approved by a separate task.

---

## 14. Next Recommended Task

**Register AGENT-HARNESS-05C7A — Harness Entitlement Runtime Validation**

Scope: Runtime smoke validation of the 05C7 entitlement gate against live Docker/api-gateway/queue stack. Confirm `403 Forbidden` for non-entitled identities and acceptance for the harness test key, with `enableToolLoop` still `false`.

Registration only — no implementation or activation of `enableToolLoop` during registration.
