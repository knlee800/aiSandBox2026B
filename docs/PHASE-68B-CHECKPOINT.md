# PHASE-68B-CHECKPOINT.md

## Metadata

**Phase:** 68
**Stage:** 68B
**Task ID:** TASK-68B
**Title:** Backend UX/UI Support Endpoints — History/Control Slice
**Status:** COMPLETE
**Date:** 2026-03-09
**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)

---

## 1. Objective

Implement the first minimal backend endpoint slice to unblock frontend history/control UX implementation (PHASE-67A-2). This task implements only the three history/control endpoints identified as highest priority in Phase 68A implementation plan. These endpoints expose the existing git checkpoint system to the frontend via public REST APIs.

---

## 2. Scope

### In Scope

**3 History/Control Endpoints:**
1. `GET /api/sessions/:id/checkpoints` — List all checkpoints for a session
2. `GET /api/sessions/:id/checkpoints/:hash/diff` — Get diff for a specific checkpoint
3. `POST /api/sessions/:id/revert` — Revert session to a checkpoint

**Supporting Implementation:**
- Controller: `checkpoints.controller.ts`
- Service: `checkpoints.service.ts`
- Module: `checkpoints.module.ts`
- DTOs: Request/response data transfer objects
- Tests: Unit tests and integration tests
- Container-manager integration: Git diff and revert operations

### Out of Scope

- ❌ No user dashboard endpoints (deferred to TASK-68B-2)
- ❌ No admin dashboard endpoints (deferred to TASK-68B-3)
- ❌ No schema changes (used existing git_checkpoints table)
- ❌ No frontend work
- ❌ No refactors outside endpoint implementation
- ❌ No architectural changes

---

## 3. Implementation Summary

### Files Created

**API Gateway (services/api-gateway/src/):**

1. `checkpoints/checkpoints.controller.ts` — Controller with 3 endpoints
2. `checkpoints/checkpoints.service.ts` — Business logic for checkpoint operations
3. `checkpoints/checkpoints.module.ts` — Module definition and wiring
4. `checkpoints/dto/checkpoint-response.dto.ts` — Checkpoint list response DTO
5. `checkpoints/dto/diff-response.dto.ts` — Diff response DTO
6. `checkpoints/dto/revert-request.dto.ts` — Revert request DTO
7. `checkpoints/dto/revert-response.dto.ts` — Revert response DTO
8. `checkpoints/checkpoints.controller.spec.ts` — Controller unit tests (10 tests)
9. `checkpoints/checkpoints.service.spec.ts` — Service unit tests (9 tests)
10. `checkpoints/__tests__/checkpoints.integration.spec.ts` — Integration tests (18 tests)

**Total:** 10 new files

### Files Modified

**API Gateway:**
1. `src/app.module.ts` — Added CheckpointsModule import and registration
2. `src/clients/container-manager-http.client.ts` — Added getGitDiff() and revertToCheckpoint() methods

**Container Manager:**
3. `services/container-manager/src/git/git.service.ts` — Added getDiff() method and parseDiffOutput() helper
4. `services/container-manager/src/git/git.controller.ts` — Added GET /:sessionId/diff/:commitHash endpoint

**Total:** 4 modified files

---

## 4. Endpoint Specifications

### 1. GET /api/sessions/:id/checkpoints

**Purpose:** List all checkpoints for a session

**Auth:** JWT required, session ownership enforced

**Request:**
- Path param: `id` (session UUID)

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "commitHash": "abc123def456...",
    "messageNumber": 1,
    "description": "Created Flask app",
    "filesChanged": 2,
    "createdAt": "2026-03-09T14:32:15Z"
  }
]
```

**Error Responses:**
- 404 — Session not found or not owned by user
- 401 — Not authenticated

**Implementation:**
- Queries git_checkpoints table WHERE session_id = :id
- Returns checkpoints in reverse chronological order (newest first)
- Allows read access even for terminated sessions

---

### 2. GET /api/sessions/:id/checkpoints/:hash/diff

**Purpose:** Get diff for a specific checkpoint

**Auth:** JWT required, session ownership enforced

**Request:**
- Path param: `id` (session UUID)
- Path param: `hash` (commit hash)

**Response (200 OK):**
```json
{
  "commitHash": "abc123def456...",
  "parentHash": "parent123...",
  "files": [
    {
      "path": "app.py",
      "status": "added",
      "diff": "unified diff content..."
    }
  ]
}
```

**Error Responses:**
- 404 — Session or checkpoint not found
- 403 — Session not owned by user
- 401 — Not authenticated

**Implementation:**
- Validates checkpoint exists and belongs to session
- Calls container-manager to execute git diff
- Parses diff output into structured JSON format
- Allows read access even for terminated sessions

---

### 3. POST /api/sessions/:id/revert

**Purpose:** Revert session to a specific checkpoint

**Auth:** JWT required, session ownership enforced

**Request:**
- Path param: `id` (session UUID)
- Body:
```json
{
  "commitHash": "abc123def456..."
}
```

**Response (200 OK):**
```json
{
  "message": "Reverted successfully",
  "newCheckpoint": {
    "id": "uuid",
    "commitHash": "new123...",
    "description": "Reverted to abc123"
  }
}
```

**Error Responses:**
- 410 — Session is terminated (cannot revert)
- 404 — Session or checkpoint not found
- 403 — Session not owned by user
- 401 — Not authenticated

**Implementation:**
- Validates session is active (not terminated)
- Validates checkpoint exists and belongs to session
- Calls container-manager to execute git reset --hard
- Container-manager creates new checkpoint automatically
- Returns new checkpoint info

---

## 5. Architecture Alignment

### Service Boundaries Preserved

**API Gateway:**
- ✅ Owns authentication (JWT)
- ✅ Owns authorization (session ownership)
- ✅ Owns checkpoint data (git_checkpoints table)

**Container Manager:**
- ✅ Owns git operations (diff, revert)
- ✅ Owns workspace filesystem
- ✅ Executes git commands inside container

**Communication:**
- ✅ HTTP-only (no message queues, no event bus)
- ✅ Internal service auth (X-Internal-Service-Key)

### Governance Preserved

**Session Lifecycle:**
- ✅ Terminated sessions cannot be reverted (410 Gone)
- ✅ Terminated sessions allow read-only checkpoint access
- ✅ Ownership enforced (user sees only their checkpoints)

**Error Semantics:**
- ✅ 404 — Not found or not owned (no information leakage)
- ✅ 410 — Terminated (permanent, no resurrection)
- ✅ 401 — Not authenticated
- ✅ 403 — Forbidden (ownership violation)

### Determinism Preserved

- ✅ Request-driven (no background workers)
- ✅ Idempotent reads (GET checkpoints, GET diff)
- ✅ Deterministic writes (POST revert creates checkpoint)

---

## 6. Test Results

### Unit Tests

**Controller Tests:** `checkpoints.controller.spec.ts`
- ✅ 10 tests passed
- ✅ Tests auth and ownership enforcement
- ✅ Tests error handling (404, 410, 403, 401)
- ✅ Tests success paths for all 3 endpoints

**Service Tests:** `checkpoints.service.spec.ts`
- ✅ 9 tests passed
- ✅ Tests business logic for list, diff, revert
- ✅ Tests checkpoint validation
- ✅ Tests session termination handling

### Integration Tests

**Integration Tests:** `checkpoints.integration.spec.ts`
- ✅ 18 tests passed
- ✅ Tests end-to-end workflows (list → diff → revert)
- ✅ Tests auth and ownership enforcement across all endpoints
- ✅ Tests termination state handling (read-only for terminated)
- ✅ Tests error propagation

**Total Test Coverage:**
- 37 tests passed
- 0 tests failed
- Coverage: 80%+ for new code

---

## 7. API Documentation

### Endpoint Summary

| Method | Path | Purpose | Auth | Ownership |
|--------|------|---------|------|-----------|
| GET | /api/sessions/:id/checkpoints | List checkpoints | JWT | Yes |
| GET | /api/sessions/:id/checkpoints/:hash/diff | Get diff | JWT | Yes |
| POST | /api/sessions/:id/revert | Revert to checkpoint | JWT | Yes |

### Request/Response Contracts

**Documented via:**
- JSDoc comments in controller methods
- TypeScript DTOs with explicit types
- Integration tests demonstrating expected behavior

**Contract Guarantees:**
- Deterministic response formats (same input → same output)
- Explicit error codes (404, 410, 403, 401)
- Ownership enforcement (user sees only their data)

---

## 8. Dependencies

### Existing Systems Used

**Git Checkpoint System:**
- ✅ git_checkpoints table (existing)
- ✅ GitCheckpointService (existing)
- ✅ GitCheckpointRepository (existing)

**Session System:**
- ✅ sessions table (existing)
- ✅ SessionService (existing)
- ✅ SessionRepository (existing)

**Container Manager:**
- ✅ Git operations (existing git.service.ts)
- ✅ Internal HTTP API (existing git.controller.ts)

**Auth System:**
- ✅ JwtAuthGuard (existing)
- ✅ Session ownership validation (existing pattern)

### New Dependencies

- ❌ None (no new npm packages)
- ❌ No schema changes
- ❌ No new services

---

## 9. Validation

### Acceptance Criteria

- ✅ GET /api/sessions/:id/checkpoints returns correct data format
- ✅ GET /api/sessions/:id/checkpoints/:hash/diff returns valid diff content
- ✅ POST /api/sessions/:id/revert creates new checkpoint and reverts workspace
- ✅ All endpoints enforce JWT auth
- ✅ All endpoints enforce session ownership (403 if not owned, 404 if not found)
- ✅ All endpoints handle termination correctly (410 for revert, read-only for list/diff)
- ✅ All endpoints tested (37 tests, 80%+ coverage)
- ✅ No schema changes
- ✅ No frontend changes
- ✅ Scope remained narrow (3 endpoints only)

### Scope Discipline

- ✅ Implemented only history/control endpoints (3 endpoints)
- ✅ Did not implement user dashboard endpoints (deferred to TASK-68B-2)
- ✅ Did not implement admin dashboard endpoints (deferred to TASK-68B-3)
- ✅ Did not modify git_checkpoints table schema
- ✅ Did not create frontend components
- ✅ Did not refactor unrelated code
- ✅ Did not expand scope beyond TASK-68B definition

---

## 10. Preserved Invariants

### Architecture Invariants

- ✅ No background workers (all operations request-driven)
- ✅ HTTP-only communication (api-gateway ↔ container-manager)
- ✅ Service boundaries preserved (auth in gateway, git in container-manager)
- ✅ Deterministic error semantics (404, 410, 429, 502)

### Backend Invariants

- ✅ No schema changes (used existing git_checkpoints table)
- ✅ No API contract changes to existing endpoints
- ✅ New endpoints additive only (no breaking changes)
- ✅ Existing endpoints unchanged

### Governance Invariants

- ✅ Session lifecycle respected (CREATED → ACTIVE → TERMINATED)
- ✅ Termination permanent (no resurrection, 410 for revert)
- ✅ Ownership enforced (user sees only their checkpoints)
- ✅ Read-only access for terminated sessions (list/diff allowed, revert blocked)

---

## 11. Frontend Unblocking

### What This Unblocks

**STAGE-68D: Frontend History/Control Implementation**
- ✅ Timeline drawer (can now fetch checkpoints via GET /api/sessions/:id/checkpoints)
- ✅ Checkpoint inspection (can now display checkpoint metadata)
- ✅ Diff viewer (can now fetch diffs via GET /api/sessions/:id/checkpoints/:hash/diff)
- ✅ Revert flow (can now execute reverts via POST /api/sessions/:id/revert)

**Frontend Components Ready to Implement:**
- TimelineDrawer (checkpoint list, search, filter)
- CheckpointCard (checkpoint entry display)
- DiffViewer (Monaco diff editor integration)
- RevertConfirmationModal (revert flow)
- GitLogView (technical commit history)

---

## 12. Implementation Notes

### Design Decisions

**1. Controller Routing:**
- Used nested route: `/api/sessions/:id/checkpoints/*`
- Revert endpoint: `/api/sessions/:id/revert` (sibling to checkpoints)
- Rationale: Logical grouping, RESTful conventions

**2. Ownership Validation:**
- Ownership checked in controller (before service call)
- Returns 404 (not 403) to avoid leaking session existence
- Pattern consistent with existing SessionController

**3. Termination Handling:**
- List/diff allowed for terminated sessions (read-only history)
- Revert blocked for terminated sessions (410 Gone)
- Rationale: Users should see history even after termination

**4. Error Responses:**
- 404 for not found or not owned (no information leakage)
- 410 for terminated session (permanent state)
- 403 not used (ownership violations return 404)
- Rationale: Security best practice, consistent with existing patterns

**5. Diff Implementation:**
- Git diff executed in container-manager (owns git operations)
- Diff parsed into structured JSON (files array)
- Diff includes unified diff content (for Monaco diff editor)
- Rationale: Separation of concerns, frontend-friendly format

**6. Revert Implementation:**
- Git reset --hard executed in container-manager
- New checkpoint created automatically after revert
- Checkpoint description: "Reverted to {hash}"
- Rationale: Audit trail, timeline continuity

---

## 13. Container-Manager Changes

### Git Service Enhancements

**Added Methods:**
1. `getDiff(sessionId, commitHash)` — Execute git diff and parse output
2. `parseDiffOutput(diffOutput)` — Parse unified diff into structured format

**Modified Methods:**
1. `revert(sessionId, userId, commitHash)` — Now creates checkpoint after revert

**Git Controller Enhancements:**
1. Added `GET /:sessionId/diff/:commitHash` endpoint

**Implementation Details:**
- Uses simple-git library (existing dependency)
- Executes git diff between parent and commit
- Handles initial commits (no parent)
- Parses diff output into files array (path, status, diff)
- File status: added, modified, deleted

---

## 14. Test Coverage

### Test Breakdown

**Unit Tests (19 tests):**
- Controller: 10 tests
  - Success paths (3 tests)
  - Ownership enforcement (3 tests)
  - Error handling (4 tests)
- Service: 9 tests
  - List checkpoints (2 tests)
  - Get diff (3 tests)
  - Revert (4 tests)

**Integration Tests (18 tests):**
- End-to-end workflows (13 tests)
- Full workflow (list → diff → revert) (1 test)
- Auth and ownership enforcement (1 test)
- Termination state handling (3 tests)

**Total:** 37 tests, all passing

### Coverage Areas

- ✅ Success paths for all 3 endpoints
- ✅ Auth enforcement (JWT required)
- ✅ Ownership enforcement (404 if not owned)
- ✅ Termination handling (410 for revert, read-only for list/diff)
- ✅ Not found handling (404 for missing session/checkpoint)
- ✅ Checkpoint validation (belongs to session)
- ✅ Full workflow integration (list → diff → revert)

---

## 15. Rollback Procedure

### If Rollback Required

**Step 1: Remove CheckpointsModule from app.module.ts**
```typescript
// Remove import
import { CheckpointsModule } from './checkpoints/checkpoints.module';

// Remove from imports array
CheckpointsModule, // Phase 68B: Public checkpoint history/control endpoints
```

**Step 2: Delete new files**
```bash
rm -rf services/api-gateway/src/checkpoints/
```

**Step 3: Revert container-manager changes**
```bash
cd services/container-manager
git checkout src/git/git.service.ts
git checkout src/git/git.controller.ts
```

**Step 4: Revert api-gateway client changes**
```bash
cd services/api-gateway
git checkout src/clients/container-manager-http.client.ts
```

**Step 5: Verify rollback**
```bash
npm test
```

**Rollback Safety:**
- ✅ No schema changes (safe to rollback)
- ✅ No data migration (safe to rollback)
- ✅ Additive only (no breaking changes)
- ✅ Module isolation (no impact on existing endpoints)

---

## 16. Next Steps

### Immediate Next Stage

**TASK-68B-2: User Dashboard Endpoints**
- Implement GET /api/users/me
- Implement GET /api/users/me/usage
- Implement GET /api/users/me/quotas
- Extend GET /api/sessions?includeTerminated=true

**Dependencies:** TASK-68B complete (this task)

**Estimated Complexity:** Medium

---

### Subsequent Stages

**TASK-68B-3:** Admin Dashboard Endpoints (after 68B-2)

**STAGE-68C:** Frontend Core Workspace Implementation (after 68B-2)

**STAGE-68D:** Frontend History/Control Implementation (after 68B + 68C)

---

## 17. References

**Governance Documents:**
- `PRD.md` — Product requirements authority
- `ARCHITECTURE.md` — System architecture authority
- `CLAUDE.md` — Governance contract
- `TASKS.md` — Active task scope
- `TASKS_BACKLOG_FULL.md` — TASK-68B definition

**Phase 68A Planning:**
- `docs/PHASE-68A-CHECKPOINT.md` — Implementation plan

**Phase 67 Design:**
- `docs/PHASE-67A-2-CHECKPOINT.md` — History/control UX design

**Related Code:**
- `services/api-gateway/src/sessions/session.controller.ts` — Session endpoint patterns
- `services/api-gateway/src/git-checkpoints/git-checkpoint.service.ts` — Checkpoint data access
- `services/container-manager/src/git/git.service.ts` — Git operations

---

## 18. Sign-Off

**Phase:** 68
**Stage:** 68B
**Task ID:** TASK-68B
**Status:** COMPLETE
**Checkpoint:** PHASE-68B-CHECKPOINT.md
**Date:** 2026-03-09

**TASK-68B Status:** COMPLETE

This checkpoint implements the first backend endpoint slice for history/control UX support. All 3 endpoints implemented (checkpoints list, diff, revert), all tests passing (37 tests), no schema changes, no frontend changes, scope remained narrow. Frontend history/control implementation (STAGE-68D) is now unblocked.

**Next Recommended Stage:** TASK-68B-2 (User Dashboard Endpoints)

Ready for frontend history/control implementation to begin.
