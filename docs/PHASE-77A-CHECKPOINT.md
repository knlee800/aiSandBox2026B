# PHASE-77A-CHECKPOINT.md

## Metadata

**Phase:** 77  
**Stage:** 77A  
**Task ID:** TASK-77A  
**Title:** Resolve ISSUE-76-005 — POST /api/sessions/:id/exec Route Gap  
**Status:** COMPLETE  
**Date:** 2026-03-13  
**Nature:** IMPLEMENTATION (MINIMAL, TARGETED FIX)

---

## 1. Objective

Resolve ISSUE-76-005 identified during Phase 76H full post-fix manual validation rerun: `POST /api/sessions/:id/exec` returns HTTP 404 because the route does not exist in the API Gateway. The route is defined as a public API in both PRD Section 8 and ARCHITECTURE Section 8.

---

## 2. Issue Summary (ISSUE-76-005)

```
ISSUE-76-005
Area: Area 3 — Session Lifecycle Flow
Steps: 3.3 (POST /api/sessions/:id/exec active) and 3.8 (POST /api/sessions/:id/exec after delete)
Severity: NON-BLOCKING (pre-existing)
Summary: POST /api/sessions/:id/exec route does not exist in the API Gateway
Observed: HTTP 404 on both active and terminated session; route-not-found response
Expected: HTTP 200 with exitCode/stdout/stderr on active; HTTP 410 Gone on terminated
Root cause: Route was never implemented in SessionController; container-manager has the
  internal exec capability at POST /api/internal/sessions/:id/exec but no public route
  in the API Gateway delegates to it
```

---

## 3. Authority Basis

**PRD Section 3B (Code Execution):**
- "Commands are executed inside the session's Docker container"
- "Output includes exit code, stdout, and stderr"
- "Executions on terminated sessions return HTTP 410 Gone"

**ARCHITECTURE Section 8 (Public APIs):**
```
POST   /api/sessions/:id/exec
JWT required.
Ownership enforced.
```

**ARCHITECTURE Section 4 (Enforcement Order):**
```
1. Exists? → 404
2. Terminated? → 410
3. Execute
```

---

## 4. Root Cause Analysis

The container-manager already has a working internal exec endpoint (`POST /api/internal/sessions/:id/exec`) that executes commands inside Docker containers and returns `{ exitCode, stdout, stderr }`. However:

1. The API Gateway's `SessionController` never implemented a public `POST /api/sessions/:id/exec` route
2. The API Gateway's `ContainerManagerHttpClient` lacked an `execInSession()` method to call the internal exec endpoint

The AI execution path (`POST /api/ai/execute`) is a separate, more complex system for AI-assisted code generation with queue, ledger, idempotency, and API key auth. It is NOT the same as the session-scoped command execution defined in PRD/ARCHITECTURE.

---

## 5. Fix Applied

### 5.1 ContainerManagerHttpClient — Added `execInSession()` method

**File:** `services/api-gateway/src/clients/container-manager-http.client.ts`

**Change:** Added `execInSession()` method that calls `POST /api/internal/sessions/:sessionId/exec` on the container-manager with `X-Internal-Service-Key` authentication. Added `ExecResult` interface.

### 5.2 SessionController — Added `POST ':id/exec'` route

**File:** `services/api-gateway/src/sessions/session.controller.ts`

**Change:** Added `execInSession()` method implementing:
- JWT authentication (inherited from controller-level `@UseGuards(JwtAuthGuard)`)
- Session existence check (via `sessionService.getSessionById` → 404)
- Ownership validation (→ 404)
- Termination check (→ 410 Gone)
- Command validation (→ 400 Bad Request)
- Delegation to `containerManagerHttpClient.execInSession()` with `['sh', '-c', command]`
- Returns `{ exitCode, stdout, stderr }`

Added imports: `Body`, `GoneException`, `BadRequestException`.

---

## 6. Files Changed

| File | Change Type |
|------|-------------|
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Added `execInSession()` method + `ExecResult` interface |
| `services/api-gateway/src/sessions/session.controller.ts` | Added `POST ':id/exec'` route + imports |
| `services/api-gateway/src/sessions/session.controller.spec.ts` | Added 7 ISSUE-76-005 regression tests |

---

## 7. Public API Contract (Implemented)

### POST /api/sessions/:id/exec

**Request:**
```json
{
  "command": "echo hello"
}
```

**Response (200 OK):**
```json
{
  "exitCode": 0,
  "stdout": "hello\n",
  "stderr": ""
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing or empty command |
| 404 | Session not found or not owned by user |
| 410 | Session is terminated |

**Auth:** JWT required (controller-level guard)  
**Ownership:** Enforced (userId match)

---

## 8. Test Results

### PHASE-77A Tests (7/7 PASS)

| Test | Result |
|------|--------|
| Executes command on active session and returns result | ✅ PASS |
| Returns 410 Gone for terminated session | ✅ PASS |
| Returns 404 for non-owned session | ✅ PASS |
| Returns 404 for non-existent session | ✅ PASS |
| Returns 400 for empty command | ✅ PASS |
| Returns 400 for null/undefined command | ✅ PASS |
| Propagates non-zero exit codes | ✅ PASS |

### Pre-existing Tests (No Regressions)

| Suite | Tests | Result |
|-------|-------|--------|
| SessionController (TASK-68B-2) | 4/4 | ✅ PASS |
| SessionController (PHASE-76F) | 6/6 | ✅ PASS |
| CheckpointsService (PHASE-68B) | 9/9 | ✅ PASS |
| CheckpointsController (PHASE-68B) | 10/10 | ✅ PASS |
| Checkpoints Integration (PHASE-68B) | 18/18 | ✅ PASS |

**Total: 54/54 tests pass, 0 regressions**

---

## 9. ISSUE-76-005 Resolution Status

| Before Fix | After Fix |
|------------|-----------|
| `POST /api/sessions/:id/exec` on active session → HTTP 404 | → HTTP 200 with `{ exitCode, stdout, stderr }` |
| `POST /api/sessions/:id/exec` on terminated session → HTTP 404 | → HTTP 410 Gone |
| `POST /api/sessions/:id/exec` on non-existent session → HTTP 404 | → HTTP 404 (correct) |

**ISSUE-76-005 STATUS: RESOLVED**

---

## 10. Preserved Invariants

- ✅ No schema changes
- ✅ No new endpoints beyond the one required route (`POST /api/sessions/:id/exec`)
- ✅ No refactors
- ✅ No architecture expansion (uses existing internal exec endpoint)
- ✅ No unrelated fixes
- ✅ One issue at a time (ISSUE-76-005 only)
- ✅ PRD.md and ARCHITECTURE.md treated as higher authority
- ✅ JWT authentication preserved (controller-level guard)
- ✅ Ownership enforcement preserved
- ✅ Termination semantics preserved (410 Gone)
- ✅ Existing service boundaries preserved (API Gateway → Container Manager delegation)
- ✅ Minimal diff only (2 source files changed, 1 test file updated)
- ✅ No commercial-readiness work

---

## 11. Explicit Out-of-Scope Confirmation

- No AI execution path changes (`POST /api/ai/execute` untouched)
- No session lifecycle changes (create/list/get/stop/delete untouched)
- No checkpoint endpoint changes
- No dashboard endpoint changes
- No admin endpoint changes
- No frontend changes
- No container-manager changes
- No schema changes
- No architecture expansion

---

## 12. Sign-Off

**Task:** TASK-77A  
**Status:** COMPLETE  
**Checkpoint:** `docs/PHASE-77A-CHECKPOINT.md`
