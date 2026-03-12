# PHASE-76A-CHECKPOINT.md

## Metadata

**Phase:** 76  
**Stage:** 76A  
**Task ID:** TASK-76A  
**Title:** End-to-End Manual App Validation Planning  
**Status:** COMPLETE  
**Date:** 2026-03-12  
**Nature:** DOCUMENTATION / PLANNING ONLY (NO CODE)

---

## 1. Objective

Define a practical manual validation/UAT plan for the current app before resuming further readiness or commercial-readiness family execution. All implemented product surfaces must be manually exercised and confirmed working before additional planning or commercial progression continues.

---

## 2. Why Phase 76A Is Needed Now

Phases 68–70 delivered frontend and backend UX/UI slices, validated them at a documentation/checklist level, and confirmed launch-readiness on paper. Phases 73–75 advanced non-monetary commercial-readiness families. However, no human has manually operated the live app end to end and confirmed that all surfaces actually work together in a running environment. Until that happens, further readiness/commercial work risks building on unverified foundations.

**Commercial-readiness family execution (Phase 75 bounded family and beyond) is explicitly paused until the current app passes end-to-end manual validation.**

---

## 3. Input Artifacts Reviewed

- `CLAUDE.md`
- `PRD.md`
- `ARCHITECTURE.md`
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/PHASE-68-FINAL-CHECKPOINT.md`
- `docs/PHASE-68B-CHECKPOINT.md`
- `docs/PHASE-68B-2-CHECKPOINT.md`
- `docs/PHASE-68B-3-CHECKPOINT.md`
- `docs/PHASE-68C-CHECKPOINT.md`
- `docs/PHASE-68D-CHECKPOINT.md`
- `docs/PHASE-68E-CHECKPOINT.md`
- `docs/PHASE-68F-CHECKPOINT.md`
- `docs/PHASE-68G-CHECKPOINT.md`
- `docs/PHASE-69-FINAL-CHECKPOINT.md`
- `docs/PHASE-70-FINAL-CHECKPOINT.md`
- `docs/PHASE-74-FINAL-CHECKPOINT.md`
- `docs/PHASE-75A-CHECKPOINT.md`

---

## 4. Implemented Product Surfaces (Validation Target Inventory)

### 4.1 Backend Endpoints (API Gateway)

| # | Endpoint | Source |
|---|----------|--------|
| 1 | `POST /api/sessions` | Core platform |
| 2 | `GET /api/sessions` (active only) | Core platform |
| 3 | `GET /api/sessions?includeTerminated=true` | TASK-68B-2 |
| 4 | `GET /api/sessions/:id` | Core platform |
| 5 | `DELETE /api/sessions/:id` | Core platform |
| 6 | `POST /api/sessions/:id/exec` | Core platform |
| 7 | `GET /api/sessions/:id/checkpoints` | TASK-68B |
| 8 | `GET /api/sessions/:id/checkpoints/:hash/diff` | TASK-68B |
| 9 | `POST /api/sessions/:id/revert` | TASK-68B |
| 10 | `GET /api/users/me` | TASK-68B-2 |
| 11 | `GET /api/users/me/usage` | TASK-68B-2 |
| 12 | `GET /api/users/me/quotas` | TASK-68B-2 |
| 13 | `GET /api/runtime/metrics` | TASK-41A |
| 14 | `GET /api/internal/admin/users` | TASK-68B-3 |
| 15 | `GET /api/internal/admin/sessions` | TASK-68B-3 |
| 16 | Internal session lifecycle endpoints | Core platform |
| 17 | Internal git checkpoint endpoint | Core platform |

### 4.2 Frontend Surfaces

| # | Surface | Route | Source |
|---|---------|-------|--------|
| A | Public landing page | `/{locale}/` | TASK-68F |
| B | Authenticated workspace shell | `/{locale}/app` | TASK-68C |
| C | Session sidebar (create/select) | inside workspace shell | TASK-68C |
| D | History/control section (checkpoint list) | inside workspace shell | TASK-68D |
| E | Dashboard section (user info, usage, quotas) | inside workspace shell | TASK-68E |
| F | Launch polish (responsive, state clarity, trust notes) | across all surfaces | TASK-68G |

### 4.3 Governance & Enforcement

| # | Mechanism | Source |
|---|-----------|--------|
| I | Rate limiting (sessions, delete, AI exec) | TASK-41B/41C |
| II | Hard quota: max active sessions per user | TASK-42A-1 |
| III | Hard quota: max sessions per rolling 24h | TASK-42A-2 |
| IV | Hard quota: max tokens per rolling 24h | TASK-42A-3 |
| V | Session idle timeout + max lifetime enforcement | Core platform |
| VI | Termination semantics (HTTP 410 permanent) | Core platform |

---

## 5. Manual Validation Scope Map

### Area 1: Public-Facing Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Navigate to `/{locale}/` (unauthenticated) | Landing page renders: hero, value cards, CTA to login |
| 1.2 | Verify responsive behavior at mobile (< 640px), tablet (768px), desktop (1280px+) | Layout adapts; no overflow or broken elements |
| 1.3 | Verify loading/error states render correctly if simulated | State messages follow heading/body/action format |
| 1.4 | Click CTA (unauthenticated) | Navigates to `/{locale}/login` |
| 1.5 | Navigate to `/{locale}/` (authenticated) | CTA points to `/{locale}/app` |

### Area 2: Authenticated Workspace

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Navigate to `/{locale}/app` (authenticated) | Workspace shell renders with header, footer, panel structure |
| 2.2 | Verify shell empty state (no sessions) | Empty state message with heading/body/action format |
| 2.3 | Create a new session via sidebar | Session created; sidebar shows new session; shell moves to ready state |
| 2.4 | Select the created session | Session selected; workspace panels update |
| 2.5 | Verify responsive layout: single-column (mobile), 2-col (md), 3-col (xl) | Grid adjusts at breakpoints |
| 2.6 | Verify trust note is visible in authenticated shell | Trust messaging present |
| 2.7 | Verify shell loading state (during session fetch) | Loading indicator with heading/body format |
| 2.8 | Verify shell error state (simulate API failure) | Error state message with retry action |

### Area 3: Session Lifecycle Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | `POST /api/sessions` | Returns 200/201 with session object; container starts |
| 3.2 | `GET /api/sessions/:id` | Returns session details with active status |
| 3.3 | `POST /api/sessions/:id/exec` with a simple command | Returns exit code 0, stdout, stderr |
| 3.4 | `GET /api/sessions` | Lists active sessions only |
| 3.5 | `GET /api/sessions?includeTerminated=true` | Lists all sessions including terminated |
| 3.6 | `DELETE /api/sessions/:id` | Session terminated; container stopped |
| 3.7 | `GET /api/sessions/:id` after delete | Returns session with terminated status |
| 3.8 | `POST /api/sessions/:id/exec` after delete | Returns HTTP 410 Gone |
| 3.9 | `DELETE /api/sessions/:id` again (idempotent) | Returns 410 or success (idempotent) |

### Area 4: Session History/Checkpoint Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | Create session, exec a file-modifying command, wait for checkpoint | Checkpoint recorded |
| 4.2 | `GET /api/sessions/:id/checkpoints` | Returns checkpoint list, newest first |
| 4.3 | `GET /api/sessions/:id/checkpoints/:hash/diff` | Returns structured diff with files array |
| 4.4 | Frontend history/control section shows checkpoints for selected session | Checkpoint list renders in UI |
| 4.5 | Verify history loading/error/empty/ready states in UI | State messages follow format |
| 4.6 | `POST /api/sessions/:id/revert` with valid hash | Returns success with new checkpoint |
| 4.7 | `POST /api/sessions/:id/revert` on terminated session | Returns HTTP 410 Gone |
| 4.8 | `GET /api/sessions/:id/checkpoints` on terminated session | Returns checkpoints (read-only allowed) |

### Area 5: Dashboard Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | `GET /api/users/me` | Returns userId, email, createdAt |
| 5.2 | `GET /api/users/me/usage` | Returns activeSessions, sessionsCreated24h, tokensUsed24h, estimatedCost, resetAt |
| 5.3 | `GET /api/users/me/quotas` | Returns limits + current usage + resetAt |
| 5.4 | Dashboard section in UI shows user info, usage, quotas | Cards render with correct data |
| 5.5 | Verify dashboard loading/error/empty/ready states in UI | State messages follow format |
| 5.6 | Create/terminate sessions, then refresh dashboard | Usage/quota numbers reflect changes |

### Area 6: Quota & Rate Limiting Enforcement

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Create sessions until max active sessions quota hit | HTTP 403 with quota details on next create |
| 6.2 | Create sessions until rolling 24h session quota hit | HTTP 403 with reset_at timestamp |
| 6.3 | Rapid `POST /api/sessions` calls exceeding rate limit | HTTP 429 with Retry-After header |
| 6.4 | Rapid `DELETE /api/sessions/:id` calls exceeding rate limit | HTTP 429 with Retry-After header |
| 6.5 | Verify session idle timeout terminates session after inactivity | Session terminated with reason; subsequent requests return 410 |
| 6.6 | Verify max lifetime terminates session after max duration | Session terminated with reason; subsequent requests return 410 |

### Area 7: Admin Visibility (Internal Endpoints)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 7.1 | `GET /api/internal/admin/users` with valid internal key | Returns user summaries with usage/quota signals |
| 7.2 | `GET /api/internal/admin/users?search=email` | Filters by email substring |
| 7.3 | `GET /api/internal/admin/users?quotaStatus=EXCEEDED` | Filters to exceeded-quota users |
| 7.4 | `GET /api/internal/admin/sessions` with valid internal key | Returns cross-user session list |
| 7.5 | `GET /api/internal/admin/sessions?status=active` | Filters to active sessions |
| 7.6 | `GET /api/internal/admin/sessions?userId=X` | Filters to sessions for user X |
| 7.7 | Call admin endpoints without internal key | HTTP 401 Unauthorized |

### Area 8: Responsive & Cross-State Behavior

| Step | Action | Expected Result |
|------|--------|-----------------|
| 8.1 | Test all frontend surfaces at viewport < 640px | Single-column layout; no overflow |
| 8.2 | Test all frontend surfaces at viewport ~768px | Mid-breakpoint layout; readable |
| 8.3 | Test all frontend surfaces at viewport 1280px+ | Full multi-column layout |
| 8.4 | Trigger loading states across workspace, history, dashboard | All show heading/body/action format |
| 8.5 | Trigger error states across workspace, history, dashboard | All show heading/body with retry action |
| 8.6 | Trigger empty states across workspace, history, dashboard | All show heading/body with guidance |

### Area 9: Runtime Metrics & Health

| Step | Action | Expected Result |
|------|--------|-----------------|
| 9.1 | `GET /api/runtime/metrics` | Returns session stats, container stats, health diagnostics |
| 9.2 | Verify metrics reflect current session/container state | Numbers match actual active sessions/containers |

---

## 6. Recommended Validation Execution Order

| Order | Area | Rationale |
|-------|------|-----------|
| 1 | Area 9: Runtime Metrics & Health | Confirm the environment is healthy before testing anything else |
| 2 | Area 1: Public-Facing Flow | Fastest to validate; no auth dependency |
| 3 | Area 3: Session Lifecycle Flow | Core platform behavior; everything else depends on sessions working |
| 4 | Area 4: Session History/Checkpoint Flow | Depends on session lifecycle being confirmed |
| 5 | Area 6: Quota & Rate Limiting Enforcement | Depends on session create/delete working |
| 6 | Area 5: Dashboard Flow | Depends on sessions/usage existing to show data |
| 7 | Area 2: Authenticated Workspace | Frontend integration of backend areas 3–5 |
| 8 | Area 7: Admin Visibility | Internal-only; lower user-facing priority |
| 9 | Area 8: Responsive & Cross-State Behavior | Polish sweep after functional correctness confirmed |

---

## 7. Environment Prerequisites

Before starting manual validation, confirm:

1. **Database:** SQLite database is initialized and accessible
2. **API Gateway:** Running and reachable (default: `http://localhost:3000`)
3. **Container Manager:** Running and reachable (default: `http://localhost:3001`)
4. **Docker:** Docker daemon running; containers can be created/started/stopped
5. **Frontend:** Next.js dev server running and reachable (default: `http://localhost:3002` or configured port)
6. **Auth:** At least one test user with valid JWT available for authenticated requests
7. **Internal Key:** `X-Internal-Service-Key` value known for admin endpoint testing
8. **Browser:** Modern browser available with dev tools for responsive testing
9. **HTTP Client:** curl, Postman, or PowerShell `Invoke-WebRequest` available for direct API testing

### Pre-Validation Health Check

Run before starting:

1. `GET /api/runtime/metrics` — confirms API gateway + Docker healthy
2. Open frontend root URL — confirms Next.js serving
3. Create one session via API — confirms container manager + Docker integration working

If any prerequisite fails, stop and resolve before proceeding.

---

## 8. Evidence Capture Requirements

For each validation area, capture:

| Evidence Type | When | Format |
|---------------|------|--------|
| API response body | Every API test step | Copy/paste JSON response |
| HTTP status code | Every API test step | Record status code |
| Screenshot | Every UI test step | Browser screenshot (PNG) |
| Browser viewport width | Every responsive test | Note width in px |
| Error message | Any failure | Full error text or response body |
| Console errors | Every UI test step | Browser console output if errors present |

### Evidence Storage

Store evidence in a working document or folder. Recommended: `docs/phase-76-validation-evidence/` with one file per area (e.g., `area-3-session-lifecycle.md`).

---

## 9. Pass/Fail Criteria

### Per-Step Criteria

Each step in the validation scope map has an "Expected Result" column. A step **passes** if the observed behavior matches the expected result. A step **fails** if:

- The HTTP status code does not match expected
- The response body shape differs from the documented contract
- The UI does not render the expected content or state
- The UI has visible layout breakage at the tested viewport
- An unexpected error appears (console, network, or server-side)

### Per-Area Criteria

An area **passes** if all steps within it pass. An area **fails** if any step fails.

### Overall Validation Criteria

| Result | Condition |
|--------|-----------|
| **PASS** | All 9 areas pass |
| **CONDITIONAL PASS** | All areas pass except Area 8 (responsive/cross-state) with only cosmetic issues |
| **FAIL** | Any area 1–7 or 9 has a failing step, OR Area 8 has functional (non-cosmetic) failures |

Commercial-readiness family execution remains paused until overall result is PASS or CONDITIONAL PASS.

---

## 10. Issue Recording and Prioritization Method

### Issue Recording Format

When a validation step fails, record an issue:

```
ISSUE-76-NNN
Area: [area number and name]
Step: [step number]
Severity: BLOCKING | NON-BLOCKING | COSMETIC
Summary: [one-line description]
Observed: [what actually happened]
Expected: [what should have happened]
Evidence: [link to screenshot/response]
```

### Severity Definitions

| Severity | Definition | Example |
|----------|------------|---------|
| **BLOCKING** | Core flow is broken; user cannot complete the action | Session create returns 500; workspace shell does not render |
| **NON-BLOCKING** | Feature works but with incorrect data, wrong format, or degraded experience | Usage numbers don't update after action; checkpoint list shows wrong order |
| **COSMETIC** | Visual/polish issue that does not prevent functionality | Spacing off at mobile viewport; trust note misaligned |

### Prioritization Rule

**Fix one issue at a time.** Ordering:

1. All BLOCKING issues first, in validation execution order
2. All NON-BLOCKING issues next, in validation execution order
3. COSMETIC issues last, in validation execution order

Each fix produces its own checkpoint before moving to the next issue.

### Issue-to-Task Mapping

Each BLOCKING or NON-BLOCKING issue becomes a task:

```
TASK-76B-NNN: Fix [issue summary]
Nature: IMPLEMENTATION (MINIMAL, TARGETED FIX)
Scope: Fix only the specific issue identified
```

COSMETIC issues may be batched into a single polish task after all BLOCKING and NON-BLOCKING issues are resolved.

---

## 11. Commercial-Readiness Pause Gate

**Explicit pause:** Further commercial-readiness family execution (Phase 75 bounded family implementation and beyond) is paused until:

1. Manual validation execution is complete (all 9 areas tested)
2. Overall result is PASS or CONDITIONAL PASS
3. All BLOCKING issues are resolved
4. All NON-BLOCKING issues are resolved or explicitly deferred with documented rationale

This pause gate is the primary governance control for Phase 76.

---

## 12. Preserved Invariants

- ✅ No platform code changes
- ✅ No frontend changes
- ✅ No backend changes
- ✅ No schema changes
- ✅ No endpoint changes
- ✅ No refactors
- ✅ No broader architectural expansion
- ✅ No commercial-readiness work until manual validation passes
- ✅ Documentation/planning-only scope preserved
- ✅ `PRD.md` and `ARCHITECTURE.md` remained higher authority
- ✅ Minimal diff only

---

## 13. Explicit Out-of-Scope

- No implementation work in this stage
- No platform/frontend/backend code changes
- No schema/endpoint changes
- No refactors
- No broader architecture expansion
- No commercial-readiness family execution
- No broader roadmap expansion beyond this immediate validation planning

---

## 14. Recommended Next Stage (High-Level Only)

Proceed to Phase 76B: execute the manual validation plan defined above against the running app. Record evidence and findings per area. If issues are found, follow the one-at-a-time issue resolution model before resuming commercial-readiness family progression.

---

## 15. Sign-Off

**Task:** TASK-76A  
**Status:** COMPLETE  
**Checkpoint:** `docs/PHASE-76A-CHECKPOINT.md`
