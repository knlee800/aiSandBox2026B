# PRIVATE-BETA-BLOCKER-03E — Stage Start / Session Lifecycle Architecture Decision

**Task:** PRIVATE-BETA-BLOCKER-03E — Session Idle Timeout / File-Apply Lifecycle  
**Step:** 2 — Stage Start / Architecture Decision  
**Status:** COMPLETE  
**Date:** 2026-08-13  
**Model used for analysis:** Opus 4.6  
**Safety state:** `GLOBAL_EXECUTION_ENABLED=false` — confirmed  

---

## 1. Executive Decision

**Architecture:** Decouple idle-timeout enforcement from container teardown within the request path. Enforce timeout via fast deterministic in-memory check → return machine-readable HTTP 410 immediately → defer container cleanup to fire-and-forget background task.

**Verdict:** READY FOR CHILD-SLICE IMPLEMENTATION

Three independent child slices are required:
- **03E-A** — Deterministic idle-timeout response semantics (eliminate gateway timeout race)
- **03E-B** — Cross-store session state synchronization (propagate termination to Postgres)
- **03E-C** — Builder preflight viability + apply-time deterministic failure

---

## 2. Current Proven Failure

Session `e0c1d71a-35ff-4ea4-aad0-b897fc28ba45` — ~51 minutes old at file-apply time.

container-manager `SESSION_IDLE_TIMEOUT_MS=1800000` (30 min).

Failure sequence:
1. File-write request reached container-manager via Gateway (`writeSessionFile`)
2. `checkAndEnforceIdleTimeout()` detected elapsed > 30 min
3. Method wrote `terminated_at` / `termination_reason='idle_timeout'` to SQLite
4. Method called `removeSessionContainer()` which calls `container.stop({ t: 10 })` + `container.remove()`
5. Docker stop waited up to 10s for graceful shutdown
6. Gateway axios client has `timeout: 10000` (10s) for the `writeSessionFile` call
7. Gateway timeout fired before container-manager responded → axios threw `ECONNABORTED` / timeout
8. Gateway caught error → surfaced as HTTP 502
9. Frontend displayed `File write failed (502)`
10. Container-manager eventually completed cleanup (SQLite: terminated; container: removed)
11. API Gateway Postgres remained: `status=active`, `terminated_at=null`

---

## 3. Current Lifecycle Implementation (from source inspection)

### 3.1 Activity tracking

| Store | Field | Location |
|-------|-------|----------|
| container-manager in-memory Map | `lastActivity: Map<string, number>` | `sessions.service.ts:42` |
| container-manager SQLite | `last_activity_at TEXT` | `sessions.service.ts:71` |
| API Gateway Postgres | `lastActivityAt: Date` | `session.entity.ts` / `session.repository.ts:111` |

**In-memory Map is the authoritative source for idle enforcement.** The SQLite `last_activity_at` is written by `updateActivity()` (called by FilesService) but is NOT read by the idle-timeout check. The Postgres `lastActivityAt` is updated by `touchLastActivity()` but only via explicit calls from api-gateway side (not triggered by container-manager operations).

### 3.2 Operations that update in-memory `lastActivity`

Container-manager `updateLastActivity(sessionId)` is called AFTER successful:
- `execInContainer`
- `readFileFromContainer`
- `writeFileToContainer`
- `deleteFileFromContainer`
- `searchFilesInContainer`
- `listDirectoryInContainer`
- `statPathInContainer`

### 3.3 Operations that do NOT update activity

- Preview proxy requests (go directly to Docker network, bypass sessions.service)
- Preview status check
- Preview start/stop (calls `assertSessionUsable` only — no activity update)
- Session creation (initializes `lastActivity` to current time implicitly on first request)
- Any request that fails the idle check (activity is updated AFTER success only)
- API Gateway session reads
- Execution submission (api-gateway side only)

### 3.4 First-access initialization

```typescript
// checkAndEnforceIdleTimeout:
if (lastActivityAt === undefined) {
  this.lastActivity.set(sessionId, now);
  return; // no timeout on first access
}
```

If container-manager process restarts, all in-memory `lastActivity` is lost. The next request to any session initializes it fresh, effectively resetting the idle timer.

### 3.5 Timeout values from source

| Parameter | Value | Source |
|-----------|-------|--------|
| `SESSION_IDLE_TIMEOUT_MS` | 1,800,000 (30 min) | `governance.config.ts:92` |
| `SESSION_MAX_LIFETIME_MS` | 86,400,000 (24 hr) | `governance.config.ts:88` |
| Gateway → container-manager timeout (default) | 10,000 ms | `container-manager-http.client.ts:38` |
| Gateway → container-manager timeout (stop/delete) | 30,000 ms | `container-manager-http.client.ts:129,170` |
| Docker `container.stop({ t: 10 })` | 10s graceful | `docker-runtime.service.ts:224` |
| `execInContainerBySessionId` default timeout | 300,000 ms | `docker-runtime.service.ts:311` |
| File read/write/delete/stat/list timeout | 30,000 ms | Various calls in `docker-runtime.service.ts` |

---

## 4. Decision A — Session Activity Authority

### Selected rule

**In-memory `lastActivity` Map in container-manager remains authoritative for idle enforcement.** This is correct — it is cheap, fast, and request-driven.

### Activity events that extend idle lifetime

All container-manager data-plane operations (after successful completion):
- exec
- file read / write / delete
- directory list
- file stat
- file search

### Activity events that do NOT extend idle lifetime

- Preview proxy traffic (see Section 16)
- Session metadata reads
- Execution submission (happens in api-gateway, not container-manager data-plane)
- Failed/rejected requests

### Store responsibilities

| Store | Purpose |
|-------|---------|
| container-manager in-memory Map | Real-time idle enforcement (request-driven) |
| container-manager SQLite `last_activity_at` | Diagnostic/audit trail (best-effort) |
| API Gateway Postgres `lastActivityAt` | Application-visible timestamp (eventual) |

### Reconciliation after process restart

Current behavior (re-initialize on first access) is acceptable for private beta. A session that was genuinely idle across a process restart will get one free request before the next check enforces timeout. This is benign and bounded.

---

## 5. Decision B — Pre-Provider Runtime Viability

### Selected policy: Lightweight session-status preflight for `workspace_mutation` intent

**Before enqueuing a mutation-intent execution**, API Gateway must verify the session is not terminated in Postgres (this check already exists at `ai-execution.controller.ts:441` via `getSessionById` + ownership check). However, this does NOT verify container-manager runtime health.

**After provider completion, before file-apply**, the frontend file-apply call goes through `session.controller.ts:writeSessionFile` → checks `session.terminatedAt !== null` in Postgres → then calls container-manager.

**Problem:** Postgres shows `active` even when container-manager has already terminated the session.

**Solution (03E-B):** After container-manager terminates a session for idle/lifetime timeout, it MUST propagate termination to API Gateway Postgres via the existing `notifySessionStopped()` path (or a new termination-specific notification). This makes the existing Postgres preflight checks effective.

**No new runtime-creation or heavyweight preflight is needed.** The existing Postgres `terminatedAt` check at api-gateway session controller level is sufficient IF cross-store synchronization is fixed (03E-B).

**Ask/conversation behavior:** Unaffected. No mutation runtime required. Execution submission already validates session existence and ownership.

**Where check belongs:** Existing location at `session.controller.ts:272` (checks `terminatedAt`) is correct and sufficient after 03E-B makes the data reliable.

---

## 6. Decision C — Apply-Time Recovery Semantics

### Selected policy: Deterministic expired-session failure — NO automatic recovery

**Behavior when valid mutation exists + runtime unavailable at apply time:**

Return a deterministic, machine-readable HTTP error (410 Gone with structured body). Do NOT attempt automatic session recreation or retry.

**Rationale:**
1. Private beta scope must remain bounded
2. Auto-recreation introduces unbounded complexity (workspace state, git state, preview state)
3. The correct fix is preventing the stale state in the first place (03E-A + 03E-B)
4. The user can explicitly start a new session after seeing the deterministic error
5. The provider work is already recorded and could be retried by the user

**Future consideration:** Automatic recovery may be added post-beta as an enhancement, but is explicitly out of scope for 03E.

---

## 7. Decision D — Idle Termination Response Semantics

### Selected architecture: Mark expired + return immediately; cleanup is fire-and-forget

**Current problem:** `checkAndEnforceIdleTimeout()` calls `removeSessionContainer()` synchronously, which calls `container.stop({ t: 10 })`. This blocks the response for up to 10+ seconds, racing the Gateway 10s timeout.

**New semantics:**

```
1. Check idle timeout → exceeded
2. Write terminated_at/termination_reason to SQLite (synchronous, fast)
3. Clean up in-memory tracking (synchronous, fast)
4. Schedule container cleanup asynchronously (fire-and-forget, non-blocking)
5. Throw GoneException immediately (< 100ms total)
```

**Container cleanup becomes fire-and-forget:**

```typescript
// Instead of:
await this.removeSessionContainer(sessionId);
throw new GoneException(...);

// Becomes:
this.scheduleContainerCleanup(sessionId); // non-blocking
throw new GoneException(...);
```

The cleanup can be a simple `setImmediate()` / `process.nextTick()` or a queued microtask. It does not block the HTTP response.

**Same change applies to `checkAndEnforceMaxLifetime()`.**

### Expected HTTP response contract

| Aspect | Value |
|--------|-------|
| HTTP status | 410 Gone |
| Machine-readable error | `{ "statusCode": 410, "message": "Session {id} expired due to inactivity (reason: idle_timeout)", "error": "Gone" }` |
| Response time | < 100ms (no Docker wait) |
| Cleanup blocking | No — fire-and-forget |
| Cleanup failure handling | Logged; orphan container cleaned on next interaction or restart |

### Gateway timeout race: ELIMINATED

With cleanup decoupled, the response returns in < 100ms. The Gateway 10s timeout is irrelevant.

---

## 8. Decision E — Cross-Store Lifecycle Consistency

### Selected ownership model: Container-manager owns lifecycle transitions; propagates to API Gateway

| Store | Role | Owns transitions |
|-------|------|------------------|
| container-manager SQLite | Runtime lifecycle source-of-truth | YES — idle_timeout, max_lifetime, manual stop |
| container-manager in-memory | Enforcement cache | YES — enforces, then writes to SQLite |
| Docker runtime | Physical container state | Follows SQLite decisions |
| API Gateway Postgres | Application-visible state | NO — receives notifications from container-manager |

### Transition propagation contract

When container-manager terminates a session (idle_timeout or max_lifetime):
1. Write `terminated_at` + `termination_reason` to SQLite (already exists)
2. **NEW: Notify API Gateway via `notifySessionStopped(sessionId)`** (existing endpoint, already handles status → STOPPED)
3. Clean up in-memory state (already exists)
4. Schedule container cleanup (fire-and-forget per Decision D)

The `notifySessionStopped` call is best-effort in the termination path. If it fails:
- Container-manager SQLite is already correct
- API Gateway Postgres remains stale until next interaction
- The next interaction from api-gateway side will hit container-manager, which will return 410 (session already terminated in SQLite via `assertSessionUsableOrThrow`)
- The Gateway can then update Postgres on receiving 410

### Reconciliation for stale Postgres state

If Postgres says `active` but container-manager returns 410:
- Gateway should update Postgres to reflect termination
- This is the "lazy reconciliation" path and handles notification failures

### Idempotency

- SQLite `terminated_at` write uses `WHERE terminated_at IS NULL` (already idempotent)
- `notifySessionStopped` calls `updateStatus(sessionId, STOPPED)` — idempotent (can be called multiple times)
- Container cleanup with missing container returns gracefully (already handles 404)

---

## 9. Decision F — User-Visible Error Contract

### Error flow: container-manager → API Gateway → frontend

**container-manager response (from `checkAndEnforceIdleTimeout`):**

```
HTTP 410 Gone
{
  "statusCode": 410,
  "message": "Session {id} expired due to inactivity (reason: idle_timeout)",
  "error": "Gone"
}
```

**API Gateway translation (`writeSessionFile` in `container-manager-http.client.ts`):**

Currently: catches axios errors and re-throws as `HttpException(message, status)`.

When status is 410, it will propagate as HTTP 410 to the frontend (already supported by existing error propagation pattern in `container-manager-http.client.ts:440-446`).

**Frontend behavior:**

The existing pattern in `workspace-file-navigation.logic.ts:106-108`:
```typescript
throw new Error(`File write failed (${response.status})`);
```

With 410 instead of 502, the frontend gets `File write failed (410)`.

**UX improvement (03E-C scope):** The frontend file-apply surface should detect 410 specifically and show a session-expired message instead of a generic write failure.

If new user-facing copy is needed, it will use i18n keys in:
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

But: the primary structural fix (deterministic 410) does not require new translations. The existing workspace error surfaces may already handle session-expired states. Final copy decision deferred to implementation.

---

## 10. Decision G — Accounting Boundary

- Failed Build provider execution consumed 2,145 credits
- Provider work (grok-4.5) completed correctly (structured JSON, valid file action)
- Downstream persistence failed (502 from stale session)
- Accounting/refund policy belongs exclusively to **PRIVATE-BETA-BLOCKER-03D**
- 03E ensures machine-readable failure information is emitted (410 with reason) that 03D can later consume
- 03E does NOT decide refund policy, credit adjustment, or user compensation

---

## 11. Decision H — 03C Boundary

- **PRIVATE-BETA-BLOCKER-03C** (Grok 4.2 Timeout Diagnosis) remains fully separate
- No provider timeout diagnosis in 03E
- No provider-adapter changes in 03E
- The execution timeout (`EXECUTION_TIMEOUT_MS`) is managed by ai-service worker, not by session lifecycle
- 03E only addresses the session/container runtime lifecycle, not provider communication

---

## 12. Selected Session Lifecycle State Machine

```
┌─────────┐
│ pending │ ── createSession ──► ┌────────┐
└─────────┘                      │ active │
                                 └────┬───┘
                                      │
             ┌────────────────────────┼────────────────────────────┐
             │                        │                            │
     idle_timeout detected    max_lifetime detected      user explicit stop
             │                        │                            │
             ▼                        ▼                            ▼
  ┌──────────────────┐    ┌──────────────────┐         ┌─────────────┐
  │ terminated       │    │ terminated       │         │ stopped     │
  │ reason:          │    │ reason:          │         │             │
  │ idle_timeout     │    │ max_lifetime     │         └──────┬──────┘
  └──────────────────┘    └──────────────────┘                │
                                                       container removed
```

### State transitions

| Trigger | Service | Persistent update | Runtime action | Client outcome |
|---------|---------|-------------------|----------------|----------------|
| Session created | container-manager + api-gateway | SQLite: insert active; Postgres: insert pending | Create workspace dir | 201 Created |
| Container started | container-manager | SQLite: active; Postgres: active (via notify) | Docker create+start | Success |
| Data-plane request (active) | container-manager | Update `lastActivity` in-memory | Execute in container | Normal response |
| Idle timeout detected | container-manager | SQLite: set `terminated_at`, reason=`idle_timeout` | Fire-and-forget cleanup | HTTP 410 Gone |
| Max lifetime exceeded | container-manager | SQLite: set `terminated_at`, reason=`max_lifetime` | Fire-and-forget cleanup | HTTP 410 Gone |
| User stop | container-manager | SQLite: status=stopped | Container stop+remove | Success |
| State propagation | container-manager → api-gateway | Postgres: status=STOPPED | None | N/A (internal) |

---

## 13. Concurrency / Race Handling

### Race 1: Runtime becomes idle between preflight viability check and provider completion

**Scenario:** Session appears active in Postgres at execution submission time (api-gateway check). During provider execution (~seconds to minutes), the session idle-times out in container-manager.

**Expected outcome:** Provider completes successfully. Frontend attempts file-apply. Gateway checks Postgres `terminatedAt` — if 03E-B propagation succeeded, gets 410 at Gateway level. If propagation hasn't completed yet, request reaches container-manager which returns 410 (SQLite already terminated). Either way: deterministic 410 to frontend.

**Recovery:** User sees session-expired error. Can start a new session.

### Race 2: Runtime terminated while file apply is starting

**Scenario:** Container is being removed (fire-and-forget cleanup from Decision D) at the exact moment a file-write exec is attempted.

**Expected outcome:** `findContainerBySessionId` fails (container not found) OR `inspect.State.Running` is false. Both paths throw errors. But this won't happen because `assertSessionUsableOrThrow` runs FIRST in `writeFileToContainer` — if terminated_at is already set in SQLite, it throws 410 before attempting Docker operations.

**Recovery:** Deterministic 410.

### Race 3: Two requests simultaneously discover the same expired session

**Scenario:** Two concurrent requests hit `checkAndEnforceIdleTimeout` for the same session simultaneously.

**Expected outcome:**
- Both detect elapsed > idle timeout
- Both attempt SQLite UPDATE: `WHERE id = ? AND terminated_at IS NULL` — only first succeeds (idempotent)
- Both delete in-memory entries (idempotent — `Map.delete` on absent key is no-op)
- Both schedule container cleanup — `removeSessionContainer` handles "container not found" gracefully (404 → no-op)
- Both throw 410

**Idempotency:** All operations are safe to run concurrently.

### Race 4: Cleanup succeeds but canonical session-state update fails

**Scenario:** Container removed, but `notifySessionStopped` call to api-gateway fails (network issue).

**Expected outcome:** 
- Container-manager SQLite: correctly terminated
- Postgres: stale (still active)
- Next request from api-gateway that reaches container-manager: gets 410 (assertSessionUsableOrThrow)
- Gateway should lazily update Postgres on receiving 410 from container-manager

**Recovery:** Lazy reconciliation. No user impact — they get 410 either way.

### Race 5: Canonical state says active but Docker container is already absent

**Scenario:** Container was removed externally or crashed, but SQLite still shows active and `terminated_at` is null.

**Expected outcome:**
- `assertSessionUsableOrThrow` passes (not terminated)
- `checkAndEnforceIdleTimeout` passes (may not be expired yet)
- Actual Docker operation (`findContainerBySessionId`) fails with "container not found"
- Error propagates as HTTP 500 from container-manager
- Gateway surfaces appropriate error to frontend

**This is not a new failure mode introduced by 03E.** It exists today and is bounded. A future enhancement could add container-presence validation, but it is out of scope.

---

## 14. Timeout Contract

### Current values (no changes needed for 03E-A/B)

| Timeout | Current value | Change needed? |
|---------|---------------|----------------|
| Gateway → container-manager (file ops) | 10,000 ms | NO — with cleanup decoupled, response < 100ms |
| Gateway → container-manager (stop/delete) | 30,000 ms | NO — stop/delete already has extended timeout |
| Docker `container.stop({ t: 10 })` | 10s | NO — still used in fire-and-forget cleanup |
| `SESSION_IDLE_TIMEOUT_MS` | 1,800,000 (30 min) | NO — value is correct |
| `SESSION_MAX_LIFETIME_MS` | 86,400,000 (24 hr) | NO — value is correct |

### Key insight

**No timeout value changes are required.** The problem was not the timeout values themselves but the synchronous blocking of container cleanup within the request path. Decision D eliminates the race by making cleanup asynchronous.

---

## 15. Fresh-Session Invariants

**Must preserve proven-good behavior from PRIVATE-BETA-BLOCKER-03B:**

Execution `babb474a-59d1-47cb-9e81-2eabef052d34` — fresh session file-apply succeeded.

**Path preserved:**
1. Frontend calls `/api/sessions/:id/files/write`
2. Gateway checks ownership + `terminatedAt` — passes (active session)
3. Gateway calls container-manager `writeSessionFile(id, path, content)`
4. Container-manager `writeFileToContainer`:
   - `assertSessionUsableOrThrow` — passes (not terminated)
   - `checkAndEnforceMaxLifetime` — passes (fresh)
   - `checkAndEnforceIdleTimeout` — passes (recent activity or first access)
   - `checkAndEnforceQuota` — passes
   - `dockerRuntimeService.writeFileToContainer` — executes in running container
   - `updateLastActivity` — refreshes timer
5. Returns success to Gateway → frontend

**None of the 03E changes touch this happy path.** The only changes are:
- How the timeout enforcement responds (faster, non-blocking) — does not affect non-expired sessions
- Cross-store propagation (new notification) — only fires on termination, not on active operations

---

## 16. Preview Activity Policy

### Decision: Preview traffic does NOT count as session activity

**Rationale:**
1. Preview proxy goes directly to the container's IP via `http-proxy-middleware` — it bypasses all session lifecycle checks in `sessions.service.ts`
2. Preview polling (status checks, iframe refreshes) can be automated/passive — a user may leave a browser tab open with preview polling while not actively working
3. Counting preview as activity would keep abandoned sessions alive indefinitely
4. The failed session (`e0c1d71a-35ff-4ea4-aad0-b897fc28ba45`) received preview traffic before the build apply, yet was correctly idle from a workspace-mutation perspective

**Exception:** `preview.start()` and `preview.stop()` call `assertSessionUsable()` which verifies the session isn't terminated, but do NOT update activity. This is correct.

**Net result:** If a user is only viewing preview (not editing files, running commands, or interacting with workspace), the session will correctly idle-expire after 30 minutes of no workspace activity.

---

## 17. Exact Implementation Surfaces

### 03E-A: Deterministic idle-timeout response semantics

| File | Change |
|------|--------|
| `services/container-manager/src/sessions/sessions.service.ts` | Refactor `checkAndEnforceIdleTimeout()` and `checkAndEnforceMaxLifetime()` to make container cleanup fire-and-forget |

### 03E-B: Cross-store session state synchronization

| File | Change |
|------|--------|
| `services/container-manager/src/sessions/sessions.service.ts` | After termination, call `notifySessionStopped()` (best-effort) |
| `services/api-gateway/src/sessions/internal-session.controller.ts` | Existing endpoint — no change needed |
| `services/api-gateway/src/sessions/session.service.ts` | Existing `stopSession()` — no change needed |

### 03E-C: Builder preflight/apply deterministic failure

| File | Change |
|------|--------|
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Ensure 410 from container-manager propagates correctly (may already work) |
| `services/api-gateway/src/sessions/session.controller.ts` | Verify 410 propagation in writeSessionFile |
| `frontend/components/workspace/workspace-file-navigation.logic.ts` | Detect 410 and provide specific error message |
| `frontend/messages/en.json` | Session-expired file-write error key (if needed) |
| `frontend/messages/zh-TW.json` | Same key |
| `frontend/messages/zh-CN.json` | Same key |

---

## 18. Child-Slice Plan

### 03E-A — Deterministic Idle-Timeout Response Semantics

**Scope:** Make container cleanup fire-and-forget in idle-timeout and max-lifetime enforcement.

**Dependencies:** None — independent.

**Acceptance:**
- Expired-session request returns HTTP 410 in < 100ms (no Docker wait)
- Fresh-session writes continue to work unchanged
- Container cleanup still happens (eventually), just not blocking the response

### 03E-B — Cross-Store Session State Synchronization

**Scope:** Propagate idle/lifetime termination from container-manager SQLite to API Gateway Postgres.

**Dependencies:** 03E-A (semantically depends on having the termination path working cleanly, but code-wise can be implemented in parallel since notification is an additive step).

**Acceptance:**
- After container-manager terminates a session, Postgres reflects termination within seconds
- If notification fails, lazy reconciliation handles it on next request
- Concurrent termination notifications are idempotent

### 03E-C — Builder Preflight/Apply Deterministic Failure

**Scope:** Frontend receives and displays deterministic session-expired error instead of generic 502 on file-apply to an expired session.

**Dependencies:** 03E-A + 03E-B (needs deterministic 410 flowing correctly).

**Acceptance:**
- File write to expired session returns 410 (not 502)
- Frontend shows specific session-expired message
- Ask/conversation flow unaffected
- Multilingual keys added if new copy introduced

### Implementation order

```
03E-A → 03E-B → 03E-C
```

03E-A and 03E-B can technically be implemented in parallel. 03E-C depends on both being correct.

---

## 19. Targeted Test Plan

### Test file locations (based on existing patterns)

- `services/container-manager/src/sessions/sessions.service.spec.ts`
- `services/api-gateway/src/clients/container-manager-http.client.spec.ts`
- `services/api-gateway/src/sessions/session.controller.spec.ts`
- `frontend/components/workspace/workspace-file-navigation.logic.test.ts`

### Required tests

| # | Test | Slice | File |
|---|------|-------|------|
| 1 | Fresh session write continues to succeed | 03E-A | `sessions.service.spec.ts` |
| 2 | Expired session write returns 410 (GoneException) immediately | 03E-A | `sessions.service.spec.ts` |
| 3 | Expired session response time < threshold (no Docker wait) | 03E-A | `sessions.service.spec.ts` |
| 4 | Concurrent expiration handling is idempotent (two calls, both get 410) | 03E-A | `sessions.service.spec.ts` |
| 5 | Container cleanup is scheduled but does not block response | 03E-A | `sessions.service.spec.ts` |
| 6 | Termination propagation calls notifySessionStopped | 03E-B | `sessions.service.spec.ts` |
| 7 | Notification failure does not break termination flow | 03E-B | `sessions.service.spec.ts` |
| 8 | API Gateway propagates 410 from container-manager as 410 to frontend | 03E-C | `container-manager-http.client.spec.ts` |
| 9 | Session controller returns 410 when terminatedAt is set | 03E-C | `session.controller.spec.ts` |
| 10 | Ask/conversation flow does not require mutation runtime viability | N/A | Existing tests sufficient |
| 11 | No Harness behavior changes | N/A | No Harness code touched |

---

## 20. Staging Validation Plan

### Provider-minimal validation (no provider calls needed for 03E)

| Validation | Method | Provider call? |
|------------|--------|----------------|
| Fresh session write | Start session → write file → verify success | NO |
| Deliberately stale session | Start session → wait/simulate timeout → write → verify 410 | NO |
| Deterministic status code | Verify 410 (not 502) on stale write | NO |
| State synchronization | After timeout, verify Postgres shows terminated | NO |
| Service health | `npm run build` + `npm test` for both services | NO |
| Gate check | Verify `GLOBAL_EXECUTION_ENABLED=false` | NO |

### BUILDER-INTENT-01 Build E2E rerun

Only performed AFTER 03E passes. Requires one provider call (grok-4.5 or equivalent). Uses a fresh session. This is the only provider call needed.

---

## 21. Rollback Plan

### Per child slice

**03E-A rollback:** Revert the single `sessions.service.ts` change. Container cleanup returns to synchronous (re-introduces timeout race, but returns to known baseline).

**03E-B rollback:** Remove the `notifySessionStopped` call from the termination path. Postgres reverts to stale-until-next-request behavior (existing baseline).

**03E-C rollback:** Revert frontend error detection. Returns to generic `File write failed (status)` message (existing baseline).

### Requirements

- No destructive DB resets required
- No `docker compose down -v` required
- No broad environment reset required
- Each slice is independently revertible via `git revert`
- All changes are bounded to specific files listed in Section 17

---

## 22. Explicit Out-of-Scope List

- PRIVATE-BETA-BLOCKER-03C (Grok 4.2 timeout) — separate
- PRIVATE-BETA-BLOCKER-03D (credit/refund policy) — separate
- Builder Intent semantics or contract changes
- Harness activation / tool-loop / write-tools
- Billing / Stripe / payment changes
- Automatic session recreation/resume
- Background reaper/cron workers
- Broad frontend redesign
- Semantic search
- Automatic checkpoint rollback
- Multi-agent work
- Provider-adapter changes
- PRIVATE-BETA-INVITE-01
- Any git commit/push in this step

---

## 23. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fire-and-forget cleanup could leave orphan containers | LOW | Docker containers are bounded by `AutoRemove: false` + existing session delete path handles cleanup; future reaper can address |
| Notification failure leaves Postgres stale | LOW | Lazy reconciliation on next request; bounded inconsistency window |
| New i18n keys needed for 03E-C | LOW | Standard process; only if existing error surfaces are insufficient |
| Testing timeout simulation on Windows | MEDIUM | Use mock timers in unit tests; manual validation with reduced timeout for integration |

---

## 24. Final Readiness Verdict

### READY FOR CHILD-SLICE IMPLEMENTATION

Three child slices identified:
1. **03E-A** — Deterministic idle-timeout response semantics
2. **03E-B** — Cross-store session state synchronization  
3. **03E-C** — Builder preflight/apply deterministic failure

Implementation order: 03E-A → 03E-B → 03E-C (03E-A and 03E-B parallelizable)

### Recommended implementation model

**Grok 4.6 High** — sufficient for all three slices. The concurrency handling is straightforward (fire-and-forget pattern, idempotent writes) and does not require XHigh-level analysis during implementation. The architecture decisions are now locked by this document.

---

## Appendix: Source Files Inspected

| File | Purpose |
|------|---------|
| `services/container-manager/src/sessions/sessions.service.ts` | Core lifecycle, idle enforcement, activity tracking |
| `services/container-manager/src/sessions/sessions.controller.ts` | Session HTTP endpoints |
| `services/container-manager/src/config/governance.config.ts` | Timeout configuration values |
| `services/container-manager/src/docker/docker-runtime.service.ts` | Container operations, stop timeout |
| `services/container-manager/src/clients/api-gateway-http.client.ts` | Cross-service notification |
| `services/container-manager/src/files/files.service.ts` | FilesService (legacy path) |
| `services/container-manager/src/preview/preview.controller.ts` | Preview proxy routing |
| `services/container-manager/src/preview/preview.service.ts` | Preview lifecycle |
| `services/api-gateway/src/sessions/session.service.ts` | Gateway session business logic |
| `services/api-gateway/src/sessions/session.controller.ts` | Public session endpoints (file write) |
| `services/api-gateway/src/sessions/internal-session.controller.ts` | Internal lifecycle notifications |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Gateway → container-manager HTTP |
| `services/api-gateway/src/repositories/session.repository.ts` | Postgres session persistence |
| `services/api-gateway/src/entities/session-status.enum.ts` | Session status enum |
| `services/api-gateway/src/runtime/runtime.service.ts` | Runtime metrics |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution submission |
| `services/ai-service/src/worker/worker.processor.ts` | Execution worker, file-apply logic |
| `frontend/components/workspace/workspace-file-navigation.logic.ts` | Frontend file write surface |
