# PRIVATE-BETA-BLOCKER-03K — Stage-Start / Root-Cause Investigation Plan

**Task ID:** PRIVATE-BETA-BLOCKER-03K  
**Title:** Builder Session Idle-Timeout Investigation  
**Step:** 2 — Stage-Start / Root-Cause Investigation Plan  
**Status:** COMPLETE — 2026-08-20  
**Workstream:** RELIABILITY  
**Lifecycle:** 4-step HIGH-RISK  
**Evidence class:** STAGING-RUNTIME

---

## 1. Proven Symptom (Frozen — Do Not Reinterpret)

```
SESSION_ID=1492ed19-9417-4a93-a1fc-c5034d41d22e
CONTAINER_ID=234ec446ca6954ac66e0cb7421904cb895b78fa57562ced9450e4f29caf36423
EXECUTION_ID=12a8e444-5f4b-4966-a4ee-e040a5bfd0b5
PROJECT_ID=f5de42f3-c52d-4b48-95d5-651db1af88eb
TEST_USER_ID=7f772841-7844-401b-a3da-e928b0c7b79c

Builder execution completed with:
  execution_status=completed
  intent=workspace_mutation
  fileActions=1
  first_file_action_path=e2e-04.html
  tokens_used=1176
  usage_records.timestamp=2026-08-19 12:17:55.619175 (local / UTC+8)

AI accounting finalized:
  finalize_accounting.build_awaiting_apply @ 2026-08-19T04:17:58.575Z (UTC)

Session terminated:
  terminated_at=2026-08-19 12:17:58.819 (local / UTC+8) = 04:17:58.819 UTC
  termination_reason=idle_timeout
  container=already removed

Session created:
  SESSION_CREATED_AT=2026-08-19 11:29:46.83897 (local / UTC+8) = 03:29:46.839 UTC

Session total age at termination: ~48 min 12 sec

Workspace apply failed:
  FILE_ACTION_RESULT=FAILED
  UI message="This workspace session has expired. The file was not saved. Reopen the project before trying again."
  e2e-04.html saved=NO
```

Source: `docs/PRIVATE-BETA-E2E-04-CHECKPOINT.md` sections 11, and `docs/PRIVATE-BETA-E2E-04-EXECUTION.md` Phase W-Y.

---

## 2. Unknown Root-Cause Statement

The **proximate failure** is proven: workspace session entered `idle_timeout` before the qualifying workspace apply.

The **underlying root cause** is **UNKNOWN / UNPROVEN** at Step 2.

Possible defect classes include (but are not limited to):
- long-running Builder execution does not suppress or reset the idle timer (product contract gap)
- frontend heartbeat absent or broken
- activity-update mechanism doesn't cover the execution path
- race condition between idle cleanup and apply
- runtime configuration defect
- clock/timestamp defect

Step 3 must distinguish these using evidence. Step 2 must NOT select a repair.

---

## 3. Prior Investigation Reference (03E)

`PRIVATE-BETA-BLOCKER-03E` (2026-08-13) investigated a structurally identical symptom:
session `e0c1d71a` (~51 min old) hit idle_timeout during file apply.

**03E root cause proven:** Synchronous Docker cleanup inside the write request path raced the
Gateway 10-second HTTP client timeout → HTTP 502 (not 410).

**03E fix:** Made container cleanup non-blocking via `setImmediate` (03E-A). Propagated
termination to PostgreSQL cross-store (03E-B). Implemented deterministic 410 semantics (03E-C).

**03E explicitly deferred:** The underlying product contract gap — whether long-running
Builder executions should suppress or extend idle timeout — was NOT addressed by 03E.

**E2E-04 failure mode differs from original 03E failure:** E2E-04 returned HTTP 410 (session
expired, machine-readable), not HTTP 502 (gateway timeout). This confirms 03E-A is in
effect. The UNDERLYING session expiration during long Builder execution was NOT fixed by 03E.

03E stage-start: `docs/PRIVATE-BETA-BLOCKER-03E-STAGE-START.md`  
03E checkpoint: `docs/PRIVATE-BETA-BLOCKER-03E-CHECKPOINT.md`

---

## 4. Authoritative Source Files Inspected (Step 2)

| File | Purpose |
|------|---------|
| `services/container-manager/src/config/governance.config.ts` | Idle-timeout config, env parsing |
| `services/container-manager/src/sessions/sessions.service.ts` | Session lifecycle, idle enforcement, activity tracking, sweeper, container cleanup |
| `services/container-manager/src/sessions/sessions.controller.ts` | Container-manager public session routes |
| `services/container-manager/src/sessions/internal-sessions.controller.ts` | Container-manager internal session/file routes |
| `services/container-manager/src/git/git.service.ts` | Git operations — does NOT go through execInContainer for init |
| `services/container-manager/src/git/git.controller.ts` | Git HTTP routes |
| `services/container-manager/src/executor/executor.service.ts` | Executor routing |
| `services/api-gateway/src/entities/session.entity.ts` | PostgreSQL session schema |
| `services/api-gateway/src/sessions/session.controller.ts` | Gateway public session/file routes |
| `services/api-gateway/src/sessions/internal-session.controller.ts` | Gateway internal session stop/start routes |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Gateway → container-manager HTTP client, lazy reconciliation |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | AI execution — plain path, no container-manager calls |
| `services/ai-service/src/worker/worker.processor.ts` | Worker processor — plain vs harness path |
| `frontend/components/workspace/workspace-file-navigation.logic.ts` | File read/write — POST /api/sessions/:id/files/write |
| `frontend/components/workspace/workspace-ai-file-actions.logic.ts` | Apply file actions logic |
| `frontend/app/[locale]/app/page.tsx` | Frontend app page — no session heartbeat found |
| `frontend/components/workspace/workspace-shell.tsx` | Workspace shell — no heartbeat/keepalive/setInterval found |

---

## 5. Idle-Timeout Configuration Semantics

### 5.1 Config source

| Parameter | Exact env var | Default | Source file | Source line |
|-----------|--------------|---------|-------------|-------------|
| Idle timeout | `SESSION_IDLE_TIMEOUT_MS` | `1800000` (30 min) | `services/container-manager/src/config/governance.config.ts` | 92–95 |
| Max lifetime | `SESSION_MAX_LIFETIME_MS` | `86400000` (24 hr) | `services/container-manager/src/config/governance.config.ts` | 87–90 |

### 5.2 Parse semantics (`parseEnvInt`)

- If env var absent or empty string → use default
- If env var set to non-integer string → log `⚠ Invalid …` + use default
- If env var set to valid decimal integer string → use parsed integer value
- No fractional/float parsing: `parseInt(value, 10)`

File: `services/container-manager/src/config/governance.config.ts` lines 159–176.

### 5.3 Staging effective value

Step 3 must verify whether `SESSION_IDLE_TIMEOUT_MS` is set in the staging PM2 environment
for `aisandbox-container-manager`. The default (1,800,000 ms) is assumed unless proven otherwise.

---

## 6. Session Schema — Two Separate Stores

### 6.1 container-manager SQLite (authoritative for idle enforcement and container lifecycle)

Location: `/opt/aisandbox/database/aisandbox.db`

Table `sessions` — schema from `sessions.service.ts` lines 67–84:

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PRIMARY KEY | Session UUID |
| `user_id` | TEXT NOT NULL | |
| `project_id` | TEXT | nullable |
| `container_id` | TEXT UNIQUE | nullable until container created |
| `status` | TEXT DEFAULT `'pending'` | `active` / `stopped` etc. |
| `git_initialized` | INTEGER DEFAULT 0 | |
| `resource_limits` | TEXT | nullable |
| `created_at` | TEXT DEFAULT `datetime('now')` | UTC (SQLite datetime) |
| `expires_at` | TEXT DEFAULT `datetime('now', '+2 hours')` | UTC |
| `last_activity_at` | TEXT DEFAULT `datetime('now')` | Written by `updateActivity()` called from `FilesService.writeFile` (direct-filesystem code path, NOT the `InternalSessionsController` / `execInContainer` path). NOT read by idle enforcement. Value does NOT represent the in-memory `lastActivity` Map. |
| `metadata` | TEXT | nullable |
| `orchestrator_enabled` | INTEGER DEFAULT 0 | |
| `orchestrator_mode` | TEXT DEFAULT `'off'` | |
| `terminated_at` | TEXT | nullable — set on idle/lifetime expiry |
| `termination_reason` | TEXT | nullable — `'idle_timeout'` / `'max_lifetime'` / `'manual'` |

**CRITICAL:** `last_activity_at` (SQLite column) is written by `updateActivity()` but is **NOT READ** by `checkAndEnforceIdleTimeout`. Idle enforcement uses the in-memory Map exclusively.

### 6.2 API Gateway PostgreSQL (authoritative for public request preflight)

TypeORM entity: `services/api-gateway/src/entities/session.entity.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `status` | enum `SessionStatus` | `pending/active/stopped/expired/error` |
| `container_id` | varchar(255) nullable | |
| `created_at` | TIMESTAMP | |
| `expires_at` | TIMESTAMP | |
| `last_activity_at` | TIMESTAMP NOT NULL | Written by `touchLastActivity()` (not triggered by container-manager ops) |
| `user_id` | UUID FK | |
| `project_id` | UUID FK nullable | |
| `terminated_at` | TIMESTAMP nullable | Set by `terminateSession()` call |
| `termination_reason` | varchar(255) nullable | `'idle_timeout'` / `'max_lifetime'` / `'manual'` |

---

## 7. Authoritative Inactivity Tracking

### 7.1 Authoritative runtime value (ephemeral)

```
AUTHORITATIVE_RUNTIME_LAST_ACTIVITY =
  this.lastActivity.get(sessionId)   [in-memory Map, JavaScript Date.now() ms]
```

**Field:** `lastActivity: Map<string, number>` — in-memory JavaScript Map  
**Location:** `SessionsService` constructor, `sessions.service.ts` line 42  
**Type:** `Map<sessionId: string, lastActivityTimestamp: number>`  
**Unit:** Unix epoch milliseconds (JavaScript `Date.now()`)  
**Persistence:** NONE — cleared on container-manager process exit/restart.

This is the ONLY value `checkAndEnforceIdleTimeout` reads. No database field is consulted.

### 7.2 Persisted activity timestamps (NOT authoritative for idle enforcement)

```
PERSISTED_ACTIVITY_TIMESTAMP (SQLite) =
  sessions.last_activity_at    [written by SessionsService.updateActivity(),
                                 called from FilesService.writeFile() path only]

PERSISTED_ACTIVITY_TIMESTAMP (PostgreSQL) =
  sessions.last_activity_at    [written by API Gateway touchLastActivity(),
                                 not involved in container-manager idle enforcement]
```

**CRITICAL DISTINCTION:** Two separate code paths exist in container-manager for file operations:

1. **`InternalSessionsController` → `SessionsService.writeFileToContainer`** (used by API Gateway proxy)
   - Calls `checkAndEnforceIdleTimeout` (reads in-memory Map)
   - Calls `updateLastActivity` (writes in-memory Map ONLY — does NOT update SQLite)
   - This is the path the E2E-04 workspace apply would use

2. **`FilesController` → `FilesService.writeFile`** (direct-filesystem path, separate route `/api/files/:id/write`)
   - Does NOT call `checkAndEnforceIdleTimeout`
   - Calls `SessionsService.updateActivity()` which writes SQLite `last_activity_at` ONLY
   - Does NOT update the in-memory `lastActivity` Map

SQLite `last_activity_at` and PostgreSQL `last_activity_at` therefore reflect activity via the
`FilesService` path, which is a DIFFERENT code path from `InternalSessionsController`. The two
values are independently maintained and may diverge.

### 7.3 Historical reconstruction challenge

Because `AUTHORITATIVE_RUNTIME_LAST_ACTIVITY` is ephemeral and E2E-04 is historical, Step 3
can only reconstruct it indirectly from:
- Container-manager PM2 log entries referencing SESSION_ID that correspond to source-proven
  activity-touching operations (see section 21 for proven log strings)
- API Gateway PM2 log entries showing the last request proxied to container-manager for this session
- The `last_activity_at` SQLite value (CONTEXTUAL ONLY — see 7.2 above)

If the historical in-memory value cannot be reconstructed with sufficient precision:

```
ACTUAL_IDLE_DURATION = UNPROVEN
DELTA_FROM_THRESHOLD = UNPROVEN
ROOT_CAUSE_PROVEN may legitimately be = NO
```

Do NOT substitute the SQLite or PostgreSQL `last_activity_at` as the authoritative value.

### 7.4 Process boundary

The `lastActivity` Map lives only in the container-manager Node.js process.
A PM2 restart of `aisandbox-container-manager` **resets all entries** to empty.
(See H12 — container-manager restart.)

---

## 8. Idle Enforcement Mechanism — `checkAndEnforceIdleTimeout`

File: `services/container-manager/src/sessions/sessions.service.ts` lines 939–999

### 8.1 Logic

```
1. Read lastActivityAt = this.lastActivity.get(sessionId)
2. If lastActivityAt === undefined:
     a. If scheduledContainerCleanups.has(sessionId) → throw GoneException (already expiring)
     b. Else → set this.lastActivity.set(sessionId, now); return  [FIRST ACCESS: no timeout]
3. Compute elapsedMs = now - lastActivityAt
4. If elapsedMs > sessionIdleTimeoutMs:
     a. Write terminated_at = datetime('now'), termination_reason = 'idle_timeout' to SQLite (idempotent: WHERE terminated_at IS NULL)
     b. Log governance event (best-effort)
     c. scheduleContainerCleanup(sessionId, 'expired')   ← setImmediate, non-blocking
     d. scheduleLifecycleNotification(sessionId, 'idle_timeout')  ← setImmediate, notifies gateway
     e. Delete lastActivity and activeExecs map entries
     f. throw GoneException (HTTP 410)
5. Else: return (not expired)
```

**No background sweeper.** This function is called only when a workspace operation arrives.
The idle timeout fires on the NEXT workspace request AFTER the threshold is exceeded.

### 8.2 Call order in workspace operations

Every workspace operation calls in this order:
1. `assertSessionUsableOrThrow` — checks SQLite `terminated_at`
2. `checkAndEnforceMaxLifetime` — absolute lifetime check
3. `checkAndEnforceIdleTimeout` — **idle timeout check (in-memory)**
4. `checkAndEnforceQuota` — quota check

### 8.3 Activity update after success

`updateLastActivity(sessionId)` sets `this.lastActivity.set(sessionId, Date.now())`.

Called AFTER successful completion of:
- `execInContainer` (line 558)
- `readFileFromContainer` (line 612)
- `writeFileToContainer` (line 657)
- `deleteFileFromContainer` (line 683)
- `searchFilesInContainer` (line 716)
- `listDirectoryInContainer` (line 758)
- `statPathInContainer` (line 809)

NOT called if the operation throws (idle timeout fires before update).

---

## 9. Activity-Touch Event Matrix

Source: inspection of `sessions.service.ts`, `git.service.ts`, `ai-execution.service.ts`,
`worker.processor.ts`, `workspace-file-navigation.logic.ts`, `workspace-shell.tsx`.

| Event | TOUCHES_SESSION_ACTIVITY | Mechanism | Source |
|-------|--------------------------|-----------|--------|
| session creation (`createSession`) | NO | Direct SQLite INSERT; no checkAndEnforce path | `sessions.service.ts:105` |
| container start (`startSessionContainer`) | NO | Docker ops only; no idle check | `sessions.service.ts:340` |
| git initialization (`initializeGit`) | **NO** | Uses `simpleGit` directly on host filesystem; does NOT call `execInContainer` | `git.service.ts:37-62` |
| git commit (`commit`) | YES | Calls `execInContainer` multiple times | `git.service.ts:74,96` |
| git revert | YES | Calls `execInContainer` | `git.service.ts` |
| workspace file list (`listDirectoryInContainer`) | YES (if succeeds) | Calls `updateLastActivity` after success | `sessions.service.ts:758` |
| workspace file read (`readFileFromContainer`) | YES (if succeeds) | Calls `updateLastActivity` after success | `sessions.service.ts:612` |
| workspace file write (`writeFileToContainer`) | YES (if succeeds) | Calls `updateLastActivity` after success | `sessions.service.ts:657` |
| workspace file delete (`deleteFileFromContainer`) | YES (if succeeds) | Calls `updateLastActivity` after success | `sessions.service.ts:683` |
| workspace file search (`searchFilesInContainer`) | YES (if succeeds) | Calls `updateLastActivity` after success | `sessions.service.ts:716` |
| workspace stat path (`statPathInContainer`) | YES (if succeeds) | Calls `updateLastActivity` after success | `sessions.service.ts:809` |
| exec in container (`execInContainer`) | YES (if succeeds) | Calls `updateLastActivity` after success | `sessions.service.ts:558` |
| preview request | **NO** | Preview proxy bypasses SessionsService entirely; no idle check | `preview.service.ts` |
| preview status/start/stop | **NO** | Calls `assertSessionUsable` only (no activity update) | |
| Build submission (frontend → gateway) | **NO** | API gateway + AI service only; no container-manager workspace op | `ai-execution.controller.ts` |
| AI execution creation | **NO** | API gateway internal; no container-manager workspace op | |
| provider request start | **NO** | AI service adapter only | `xai-ai.adapter.ts` |
| provider streaming | **NO** | AI service/gateway only | |
| provider completion (plain path) | **NO** | AI service signals gateway; no container-manager workspace op | `worker.processor.ts` (plain path) |
| provider completion (harness path — NOT E2E-04) | CONDITIONAL | If harness read_file/write_file tools called, they touch container-manager via gateway | `worker.processor.ts` harness branch |
| `finalize_accounting.build_awaiting_apply` | **NO** | Gateway-side accounting only | `ai-execution.controller.ts` |
| workspace apply (`writeFileToContainer`) | YES if succeeds; TRIGGERS EXPIRY if elapsed > threshold | checkAndEnforceIdleTimeout fires here if inactive too long | `sessions.service.ts:634-657` |
| automatic post-apply checkpoint (git commit) | YES (if apply succeeded) | Calls `execInContainer` via git commit | N/A if apply failed |
| manual checkpoint (git commit) | YES | Calls `execInContainer` | |
| session stop/delete | NO (cleanup only) | Cleans up maps; no activity update | `sessions.service.ts:247,283` |
| frontend heartbeat | **DOES NOT EXIST** | No heartbeat implemented | N/A |
| container-manager process restart | RESETS ALL | Clears entire `lastActivity` Map | N/A |

**Key for E2E-04:** The plain-path Builder execution (AGENT_HARNESS_ENABLE_TOOL_LOOP=false)
does NOT call any container-manager workspace operation between execution submission and the
workspace apply attempt. The session activity was NOT updated during the ~48-minute execution window.

---

## 10. Frontend Heartbeat Contract

**Frontend heartbeat: DOES NOT EXIST.**

Source inspection confirms:
- No `heartbeat`, `keepalive`, `ping`, or session-activity endpoint in codebase
- No `setInterval` for session keep-alive in `workspace-shell.tsx` or any workspace component
- No call to any `POST /api/sessions/:id/activity` or similar route
- `sessions.controller.ts` (container-manager) has no heartbeat route
- `session.controller.ts` (API gateway) has no heartbeat route

Frontend `setInterval` usage found (none related to session keep-alive):
- Chat execution status polling (`CHAT_EXECUTION_POLL_INTERVAL_MS`) — gateway only
- Token counter refresh (10s) — gateway only
- System readiness check (10s/30s) — gateway only
- Driver page execution status (3s) — gateway only

**None of these touch container-manager session activity.**

---

## 11. Idle Enforcement & Cleanup Contract

**No background sweeper exists.**

Idle enforcement is purely request-driven. There is no:
- NestJS `@Cron()` task
- `setInterval` background worker
- BullMQ scheduled job
- PM2 scheduled script

A session with no incoming workspace requests can remain live indefinitely in the database
regardless of how long it has been idle. The idle timeout only fires on the NEXT incoming
workspace request after the threshold is exceeded.

**`scheduleContainerCleanup` behavior (03E-A fix):**

```
setImmediate(() => {
  removeSessionContainer(sessionId)  // Docker stop + remove, best-effort
    .catch(err => console.error(...))
    .finally(() => scheduledContainerCleanups.delete(sessionId))
})
```

- Non-blocking: 410 is returned to caller immediately
- Docker stop/remove happens asynchronously after the HTTP response is sent
- Duplicate cleanup prevention: `scheduledContainerCleanups: Set<string>` guards against concurrent expiration

**`scheduleLifecycleNotification` behavior (03E-B fix):**

```
setImmediate(() => {
  apiGatewayClient.notifySessionStopped(sessionId, 'idle_timeout')
    .catch(err => console.error(...))
})
```

- Non-blocking: calls `POST /api/internal/sessions/:id/stop` with `{reason: 'idle_timeout'}` to gateway
- Gateway internal session controller receives it → calls `sessionService.terminateSession(sessionId, 'idle_timeout')` → sets PostgreSQL `terminatedAt` and `terminationReason`

**Cross-store window (implementation fact — not a proven race for E2E-04):** There is an
asynchronous propagation window between:
1. Container-manager fires idle enforcement (SQLite `terminated_at` set; notification scheduled via `setImmediate`)
2. Gateway PostgreSQL `terminatedAt` not yet set (notification is async, not inline)

During this window, a concurrent apply request at the gateway would find `terminatedAt IS NULL`
in PostgreSQL, proxy to container-manager, receive HTTP 410, and lazily reconcile PostgreSQL via
the `throwContainerManagerError` path in `container-manager-http.client.ts`. Whether this window
was a causal factor in E2E-04 is a Step 3 question, not a Step 2 assertion.

---

## 12. AI Execution / Session Interaction Contract (Plain Path — E2E-04)

**E2E-04 used plain path: `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`**

```
PLAIN_PATH_CONFIRMED=YES
```

### Plain path execution flow:

```
frontend Build submit
  → POST /api/ai/executions (API gateway)
  → enqueue job (BullMQ)
  → worker.processor processes job
  → AIExecutionService.execute(request)
  → XAIAdapter.execute(request)
  → xAI provider API call (grok-4.5)
  → response returned
  → extractFileActionsFromOutput (parse file actions)
  → execution result stored
  → gateway logs finalize_accounting.build_awaiting_apply
  → frontend polls execution status
  → frontend presents file actions to user
  → user clicks Apply
  → POST /api/sessions/:id/files/write (gateway)
  → containerManagerHttpClient.writeSessionFile (gateway → container-manager)
  → SessionsService.writeFileToContainer (container-manager)
  → checkAndEnforceIdleTimeout ← FIRST CONTAINER-MANAGER WORKSPACE CONTACT
```

No container-manager workspace operation occurs between Build submission and workspace apply.

| Contract Point | Proven Value |
|---------------|-------------|
| AI execution associated with SESSION_ID | YES — stored in usage_records, logged by gateway |
| Session state checked before provider request | YES — gateway checks `session.terminatedAt` (PostgreSQL) before proxying to AI service |
| Execution start refreshes session activity | **NO** (plain path) |
| Provider streaming keeps session alive | **NO** (plain path — no container-manager calls) |
| Completion refreshes session activity | **NO** (plain path) |
| Apply requires active session | YES — gateway checks `session.terminatedAt !== null` → 410 if terminated |
| Session termination can occur while execution is running | **YES — no guard suppresses it** |
| Any guard suppresses cleanup for active executions | **NO — none exists** |
| `activeExecs` Map tracks active container execs | YES — but not provider-level executions; only `execInContainer` calls |
| Plain-path execution interacts with `activeExecs` | **NO** — only execInContainer increments this counter |

**Harness path (NOT E2E-04, documented for completeness):**
If `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` and tools are called, `read_file` and `list_files`
go through the gateway → container-manager path and would update `lastActivity`. However
E2E-04 was plain path exclusively.

---

## 13. E2E-04 Timeline Fields (Step 3 Must Reconstruct)

All timestamps must be normalized to UTC. Staging local time = UTC+8.

| Field | E2E-04 Value | Source | Status |
|-------|-------------|--------|--------|
| `SESSION_CREATED_AT` | 11:29:46.838 local = **03:29:46.838 UTC** | `PRIVATE-BETA-E2E-04-EXECUTION.md` Phase K, L | KNOWN |
| `CONTAINER_STARTED_AT` | Shortly after session creation | Phase L ("Up ~20 minutes at capture") | APPROXIMATE |
| `FIRST_WORKSPACE_OPERATION_TIME` | UNKNOWN — first container-manager contact | Must query container-manager log in Step 3 | TO DETERMINE |
| `LAST_ACTIVITY_BEFORE_EXPIRY` (in-memory) | UNKNOWN — last `updateLastActivity` before expiry | Must derive from log evidence in Step 3 | TO DETERMINE |
| `EXECUTION_SUBMITTED_AT` | UNKNOWN | Must find in gateway AI log in Step 3 | TO DETERMINE |
| `PROVIDER_REQUEST_START` | UNKNOWN | Must find in AI service log in Step 3 | TO DETERMINE |
| `FIRST_STREAM_ACTIVITY` | UNKNOWN | May not be available as explicit log event | TO DETERMINE |
| `AI_COMPLETION_TIME` | 12:17:55.619175 local = **04:17:55.619Z UTC** | `usage_records.timestamp` / Phase T | KNOWN |
| `ACCOUNTING_FINALIZATION_TIME` | **2026-08-19T04:17:58.575Z** (UTC) | Gateway PM2 log / Phase U | KNOWN |
| `IDLE_TIMEOUT_TRIGGER_TIME` | ≈12:17:58 local = **≈04:17:58 UTC** | Inferred from terminated_at + logs | APPROXIMATE |
| `SESSION_TERMINATED_AT_SQLITE` | ≈12:17:58.819 local (matching gateway log) | Phase W-Y session row | APPROXIMATE |
| `SESSION_TERMINATED_AT_POSTGRES` | 2026-08-19 12:17:58.819 local = **04:17:58.819 UTC** | Phase W-Y session row capture | KNOWN |
| `SESSION_TERMINATION_REASON` | `idle_timeout` | Phase W-Y / container-manager log | KNOWN |
| `CONTAINER_STOP_TIME` | ≈ shortly after 04:17:58 UTC (async cleanup) | Phase W-Y Docker inspect | APPROXIMATE |
| `WORKSPACE_APPLY_ATTEMPT_TIME` | ≈ 04:17:58 UTC (coincides with stop) | Phase W-Y, gateway log | APPROXIMATE |

**Note on IDLE_TIMEOUT_TRIGGER_TIME:** The idle timeout check fires on whatever workspace request
arrived at ~12:17:58. Step 3 must identify the exact request from container-manager or gateway logs
(was it the apply request itself, a file-list refresh triggered by the frontend after execution
completed, or another workspace operation?).

---

## 14. Timestamp Normalization Rule

```
STAGING_LOCAL_TIMEZONE = UTC+8 (Asia/Singapore or equivalent)

All staging log timestamps appear without timezone suffix and are LOCAL (UTC+8).
All PostgreSQL TIMESTAMP columns stored in UTC.
All SQLite datetime('now') returns UTC.
Gateway PM2 log timestamps with 'Z' suffix are UTC.
AI usage_records.timestamp appears local (12:17:55) mapping to 04:17:55Z.

NORMALIZATION RULE:
  If timestamp has no timezone and source is staging console/PM2 log: LOCAL → subtract 8h → UTC
  If timestamp ends in 'Z' or is described as UTC: already UTC
  If timestamp is from PostgreSQL column: already UTC (stored as UTC)
  If timestamp is from SQLite datetime('now'): UTC

Step 3 MUST normalize all timestamps to UTC before comparison.
Step 3 MUST NOT compare local and UTC values directly.
```

---

## 15. Timeout Arithmetic

**Configured threshold:**

```
CONFIGURED_IDLE_TIMEOUT_MS = 1,800,000 ms (30 minutes)
```

Source: `governance.config.ts:92–95`. Assumed default unless Step 3 finds a different
runtime value in PM2 `aisandbox-container-manager` environment.

**Step 3 arithmetic (conditional on reconstruction of authoritative value):**

```
AUTHORITATIVE_RUNTIME_LAST_ACTIVITY =
  last value held in SessionsService.lastActivity[sessionId] at the time
  checkAndEnforceIdleTimeout fired — in-memory, ephemeral, now gone.

  Step 3 may reconstruct this only from evidence that source-proves a container-manager
  activity-touching operation at a specific time (see Section 7.3).
  Do NOT substitute SQLite last_activity_at or PostgreSQL last_activity_at.

IDLE_ENFORCEMENT_TIME_UTC =
  ≈ 04:17:58 UTC (from SESSION_TERMINATED_AT; the apply request triggered the check)

IF AUTHORITATIVE_RUNTIME_LAST_ACTIVITY can be reconstructed:

  ACTUAL_IDLE_DURATION_MS =
    IDLE_ENFORCEMENT_TIME_UTC − RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME

  CONFIGURED_IDLE_TIMEOUT_MS =
    effective runtime SESSION_IDLE_TIMEOUT_MS (verify in Step 3 from PM2 env)

  DELTA_FROM_THRESHOLD =
    ACTUAL_IDLE_DURATION_MS − CONFIGURED_IDLE_TIMEOUT_MS
      > 0 → idle timeout was legitimately exceeded (session was genuinely idle)
      = 0 → exact threshold (boundary)
      < 0 → premature termination (should not occur; would indicate defect)

  EXPECTED_TERMINATION_THRESHOLD =
    RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME + CONFIGURED_IDLE_TIMEOUT_MS

IF AUTHORITATIVE_RUNTIME_LAST_ACTIVITY cannot be reconstructed with precision:

  ACTUAL_IDLE_DURATION = UNPROVEN
  DELTA_FROM_THRESHOLD = UNPROVEN

  → Step 3 may still assess H1/H4/H11 through causal reasoning (source facts +
    session age vs threshold), but ROOT_CAUSE_PROVEN will likely be NO.
```

**Bounding observation from known session data:**

```
SESSION_CREATED_AT_UTC    = 03:29:46.839 UTC
SESSION_TERMINATED_AT_UTC = 04:17:58.819 UTC
TOTAL_SESSION_AGE_MS      = 2,891,980 ms ≈ 48 min 12 sec

CONFIGURED_IDLE_TIMEOUT   = 1,800,000 ms (30 min)

For idle timeout to have fired, the implementation requires that at least one
workspace operation first initialized the in-memory map (first-access path), then
no further workspace operations occurred for > CONFIGURED_IDLE_TIMEOUT_MS before
the apply request arrived.

IF the last in-memory activity touch was near session creation (≈ 03:30 UTC):
  hypothetical ACTUAL_IDLE_DURATION ≈ 47 min >> threshold
  → idle timeout would be legitimate under current implementation

IF the last activity touch was within the 30 min window before expiry (after 03:47 UTC):
  ACTUAL_IDLE_DURATION < threshold → idle timeout should NOT have fired
  → would indicate a defect

This bounding calculation provides the investigation frame.
Step 3 must supply the actual RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME
to calculate the real ACTUAL_IDLE_DURATION and DELTA_FROM_THRESHOLD.
```

**Context-only use of persisted timestamps:**

SQLite `last_activity_at` and PostgreSQL `last_activity_at` may be captured by Step 3 for
contextual cross-referencing but MUST NOT be substituted for the authoritative runtime value
in the arithmetic above. Explicitly label any use of these values as:

```
PERSISTED_ACTIVITY_TIMESTAMP (CONTEXTUAL ONLY — not authoritative for idle enforcement)
```

---

## 16. Hypothesis Matrix

For each hypothesis: evidence that would support/falsify it; what Step 3 investigation needs.

---

### H1 — Configured idle timeout was legitimately exceeded

**Description:** The session had no qualifying workspace activity (container-manager operation)
for the full 30-minute threshold. The idle timeout fired exactly as designed.

**Evidence supporting it:**
- Session was 48 min old at termination — well over the 30-min threshold
- No frontend heartbeat exists
- Plain-path AI execution makes no container-manager calls
- If first workspace op was at session open (~03:30 UTC), and no further workspace ops
  for 47+ minutes, the idle timeout would fire legitimately at 04:17:58

**Evidence falsifying it:**
- Container-manager logs show workspace operations for this session within the last 30 min
  before expiry (04:47:58 UTC range: 03:47:58–04:17:58)
- An in-flight workspace operation completed successfully within the threshold

**What Step 3 needs:**
- Container-manager PM2 log: all requests for SESSION_ID in the window 03:29–04:18 UTC
- Determine exact LAST_KNOWN_ACTIVITY_TIMESTAMP_UTC from log evidence
- Verify no container-manager restart occurred between session creation and expiry

**Source inspection alone can answer it:** PARTIALLY — confirms no heartbeat; Step 3 staging
evidence (logs) needed to determine exact last activity time.

**Staging runtime evidence required:** YES — PM2 container-manager log for session activity window.

---

### H2 — Frontend heartbeat/keepalive stopped or was never active

**Description:** A heartbeat was expected but the implementation is absent or broken.

**Evidence supporting it:**
- SOURCE INSPECTION PROVEN: No frontend heartbeat exists anywhere in the codebase
- No heartbeat endpoint in container-manager or API gateway
- No `setInterval` for session keepalive in workspace components

**Evidence falsifying it:**
- Finding a heartbeat implementation that was missed (unlikely given thorough search)

**What Step 3 needs:**
- Source inspection COMPLETE — heartbeat definitively absent
- No staging evidence needed for this hypothesis

**Source inspection alone can answer it:** YES — **NO HEARTBEAT EXISTS (PROVEN)**

**Staging runtime evidence required:** NO

---

### H3 — Heartbeat was sent but did not update the idle-timeout timestamp

**Description:** A heartbeat fires but updates the wrong store (e.g., PostgreSQL `lastActivityAt`
instead of container-manager's in-memory Map).

**Evidence supporting it:**
- SQLite `last_activity_at` and PostgreSQL `last_activity_at` exist but are NOT read by idle enforcement
- A hypothetical heartbeat touching the DB columns would have no effect on the idle timer

**Evidence falsifying it:**
- SOURCE INSPECTION PROVEN: No heartbeat implementation exists, making H3 impossible
- The only store that matters is the in-memory Map, and nothing touches it except container-manager workspace ops

**What Step 3 needs:**
- Source inspection COMPLETE — H3 is eliminated by the absence of any heartbeat

**Source inspection alone can answer it:** YES — **H3 ELIMINATED: no heartbeat to misroute**

**Staging runtime evidence required:** NO

---

### H4 — Starting a Builder execution does not touch session activity but should

**Description:** The product contract is that starting/running a Builder execution should keep
the session alive, but there is no implementation to do so.

**Evidence supporting it:**
- SOURCE INSPECTION PROVEN: Plain-path Builder execution makes ZERO container-manager calls
  from Build submit through provider completion
- `finalize_accounting.build_awaiting_apply` is a gateway-only event
- `activeExecs` Map tracks only `execInContainer` calls, not provider-level executions
- 03E stage-start (2026-08-13) already identified: "Execution submission (api-gateway side only)"
  does NOT update activity

**Evidence falsifying it:**
- Finding a code path where execution submission updates container-manager `lastActivity`
  (source inspection found none)

**What Step 3 needs:**
- Source inspection SUBSTANTIALLY COMPLETE — confirms H4
- Step 3 should confirm: was there ANY container-manager workspace operation in the
  30-minute window before expiry?

**Source inspection alone can answer it:** YES for the mechanism; staging logs needed to
confirm whether this is the actual E2E-04 causal path.

**Staging runtime evidence required:** YES — confirm last activity timestamp from logs.

---

### H5 — Streaming/provider execution does not count as session activity

**Description:** Provider streaming (SSE or chunked) keeps the HTTP connection open but
does not update container-manager's `lastActivity`.

**Evidence supporting it:**
- SOURCE INSPECTION PROVEN: Streaming is AI service → gateway → frontend; no container-manager calls
- `lastActivity` only updated by container-manager workspace operations

**Evidence falsifying it:**
- Finding streaming middleware in container-manager that updates `lastActivity` (none found)

**What Step 3 needs:**
- Source inspection COMPLETE — **H5 CONFIRMED AS MECHANISM** for plain-path execution

**Source inspection alone can answer it:** YES — **H5 CONFIRMED: streaming does not touch activity**

**Staging runtime evidence required:** NO for the mechanism.

---

### H6 — The idle sweeper ignores an active/in-flight AI execution

**Description:** A background sweeper terminates sessions without checking for active executions.

**Evidence supporting it:**
- Would explain termination during execution

**Evidence falsifying it:**
- SOURCE INSPECTION PROVEN: No background sweeper exists. Idle enforcement is purely
  request-driven. There is no periodic cleanup job or cron task.
- `activeExecs` Map exists but is not checked by the idle timeout path, only by concurrent
  exec limiting. But this is irrelevant because there is no sweeper.

**What Step 3 needs:**
- Source inspection COMPLETE — **H6 ELIMINATED: no background sweeper exists**

**Source inspection alone can answer it:** YES — **H6 ELIMINATED: no sweeper**

**Staging runtime evidence required:** NO

---

### H7 — Race condition: idle cleanup and provider completion happened nearly simultaneously

**Description:** The idle timeout fired at nearly the same moment as the AI completion,
creating an unavoidable race that made it impossible to complete the apply in time.

**Evidence supporting it:**
- Timeline shows `AI_COMPLETION_TIME` (04:17:55Z), `ACCOUNTING_FINALIZATION_TIME` (04:17:58.575Z),
  and `SESSION_TERMINATED_AT` (04:17:58.819Z) all within ~3 seconds
- The idle timeout fired essentially at the same moment as the apply attempt

**Evidence falsifying it:**
- If the LAST_KNOWN_ACTIVITY_TIMESTAMP is clearly >30 min before expiry (i.e., not a
  borderline case), it is not a race — the session was genuinely idle
- If the idle timeout could have been avoided by resetting activity on execution start/completion,
  it's H4/H11 not H7

**What Step 3 needs:**
- Determine LAST_KNOWN_ACTIVITY_TIMESTAMP: if it was close to 30 min before expiry (near-boundary),
  race condition is more plausible; if it was many minutes earlier, H7 is a description of timing
  but not a distinct causal mechanism

**Source inspection alone can answer it:** PARTIALLY

**Staging runtime evidence required:** YES — container-manager log for exact last activity.

---

### H8 — Clock/timestamp/timezone or stale timestamp comparison defect

**Description:** The idle timeout fires due to a clock skew, timezone confusion, or stale
timestamp from a process restart.

**Evidence supporting it:**
- Could explain premature timeout if timestamp comparison uses mixed timezone values

**Evidence falsifying it:**
- Source inspection: `checkAndEnforceIdleTimeout` uses `Date.now()` (Unix ms) for both
  the stored value and the current time — same timezone-independent unit. No timezone
  conversion involved.
- `elapsedMs = now - lastActivityAt` is a pure millisecond subtraction.
- No timezone conversion in the idle path.

**What Step 3 needs:**
- Source inspection SUBSTANTIALLY COMPLETE — clock defect very unlikely given implementation
- Step 3: verify `SESSION_IDLE_TIMEOUT_MS` in staging PM2 env is not misconfigured to a
  very small value (e.g., milliseconds instead of minutes)

**Source inspection alone can answer it:** LARGELY YES — H8 clock defect not plausible from
source. Misconfigured env var (wrong unit) cannot be ruled out without staging check.

**Staging runtime evidence required:** YES — verify effective `SESSION_IDLE_TIMEOUT_MS` in PM2.

---

### H9 — Session state persisted correctly but container-manager cleanup executed too early

**Description:** The session SQLite state and the container were cleaned up before the idle
timeout should have legitimately fired.

**Evidence supporting it:**
- Would require a path that calls `scheduleContainerCleanup` without going through
  `checkAndEnforceIdleTimeout`

**Evidence falsifying it:**
- SOURCE INSPECTION: The only paths that call `scheduleContainerCleanup` are
  `checkAndEnforceIdleTimeout` and `checkAndEnforceMaxLifetime` — both correctly gate on
  threshold comparison. `removeSessionContainer` (direct) can be called from `stopSession`
  and `deleteSession` but those set `status='stopped'`, not `idle_timeout`.
- Session was terminated with reason `idle_timeout`, not `manual` or other.

**What Step 3 needs:**
- Source inspection SUBSTANTIALLY COMPLETE — H9 largely eliminated by source
- Step 3: confirm no manual stop or delete was issued for this session

**Source inspection alone can answer it:** LARGELY YES

**Staging runtime evidence required:** YES — confirm no admin/manual stop issued.

---

### H10 — Frontend session lifecycle and backend session lifecycle disagree

**Description:** The frontend believed the session was active (no expiry UI shown), while the
backend had already terminated it.

**Evidence supporting it:**
- Timeline shows apply attempt and termination at the same moment — user had no warning
- No frontend heartbeat means the frontend cannot proactively detect expiry before trying apply

**Evidence falsifying it:**
- This is a consequence of H1/H4/H11 rather than an independent root cause. The frontend
  has no mechanism to know the session is idle (no heartbeat, no proactive check).

**What Step 3 needs:**
- This is a consequence description, not a distinct causal mechanism. H10 characterizes the
  user experience impact but the root cause is upstream.

**Source inspection alone can answer it:** YES for mechanism.

**Staging runtime evidence required:** NO for this hypothesis specifically.

---

### H11 — The observed idle_timeout is expected under current implementation but the product contract is wrong for long-running Builder executions

**Description:** The implementation works exactly as coded. The 30-minute idle timeout is
applied to all sessions uniformly. Long-running Builder executions (provider calls taking
10-50 minutes) naturally exceed this threshold because no mechanism exists to keep sessions
alive during provider calls.

**Evidence supporting it:**
- SOURCE INSPECTION PROVEN:
  - No heartbeat
  - Plain-path execution makes no container-manager calls
  - 03E stage-start identified this gap explicitly: "Execution submission (api-gateway side only)"
    does not update activity
  - Session age 48 min >> 30-min threshold
  - Execution duration ≈ 48 min (from session creation to provider result) >> 30-min threshold
- Prior E2E-03 (2026-08-17) session was NOT an idle_timeout case — suggesting this is
  intermittent or provider-latency dependent

**Evidence falsifying it:**
- If a mechanism to suppress/extend idle timeout during execution was already implemented
  (and Step 3 finds it)
- If the effective `SESSION_IDLE_TIMEOUT_MS` on staging is much larger than 30 min

**What Step 3 needs:**
- Confirm effective `SESSION_IDLE_TIMEOUT_MS` in staging PM2 env
- Confirm no workspace activity in the last 30 min before expiry
- Determine exact execution duration to compare against threshold

**Source inspection alone can answer it:** YES for mechanism; staging needed for confirmation.

**Staging runtime evidence required:** YES — effective config + last activity timestamp.

---

### H12 — Container-manager process restart cleared the in-memory lastActivity map, and the first post-restart workspace request re-initialized the timer, but it expired again before apply

**Description:** If the container-manager PM2 process was restarted during the E2E-04 session
lifecycle, the `lastActivity` Map would be cleared. The first workspace op after restart
would initialize the timer, but if another >30 min gap followed before the apply, the
session would expire again.

**Evidence supporting it:**
- E2E-04 Phase E (staging deployment) restarted `aisandbox-api-gateway` (id 3, restart count
  235→236→237→238) but container-manager restart is NOT mentioned in E2E-04 execution evidence

**Evidence falsifying it:**
- No container-manager PM2 restart is documented in E2E-04 evidence
- Phase G shows all services healthy including container-manager before execution
- PM2 restart count for container-manager was not captured in E2E-04 evidence

**What Step 3 needs:**
- Verify container-manager PM2 restart count and uptime during E2E-04 session window
- If no restart occurred, H12 is eliminated

**Source inspection alone can answer it:** NO

**Staging runtime evidence required:** YES — PM2 `pm2 describe aisandbox-container-manager` restart count/uptime.

---

## 17. Strongest Current Hypotheses (No Root Cause Selected)

Based on source inspection alone, the most structurally supported hypotheses are:

**H4/H11 (closely related — consistent with source facts, unconfirmed as to actual duration):**
Source inspection proves: plain-path Builder execution makes zero container-manager calls; no
frontend heartbeat exists; `checkAndEnforceIdleTimeout` is not suppressed for active executions.
IF Step 3 staging evidence confirms that no workspace operation occurred in the 30-minute window
before the idle enforcement check fired (i.e., ACTUAL_IDLE_DURATION > CONFIGURED_IDLE_TIMEOUT_MS),
THEN H1 (timeout was legitimate), H4 (execution doesn't touch activity), and H11 (product
contract is wrong for long-running executions) are all simultaneously supported. This remains
a hypothesis pending reconstruction of AUTHORITATIVE_RUNTIME_LAST_ACTIVITY.

**H7 (timing — requires arithmetic to assess):** The near-simultaneous timestamps
(`AI_COMPLETION_TIME` 04:17:55Z, `ACCOUNTING_FINALIZATION_TIME` 04:17:58.575Z,
`SESSION_TERMINATED_AT` 04:17:58.819Z) are evidence to investigate, not by themselves proof
of a race. If ACTUAL_IDLE_DURATION clearly exceeds the threshold by a wide margin (many minutes),
H7 describes an unfortunate timing coincidence but is not a distinct causal mechanism. If
ACTUAL_IDLE_DURATION is close to the threshold (within seconds), a near-boundary race scenario
must be assessed. Step 3 arithmetic determines which applies.

**H12 (container-manager restart):** Cannot be eliminated without verifying PM2 restart count
and uptime for `aisandbox-container-manager` during the E2E-04 session window.

**Step 3 must:** (a) obtain RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME from log/evidence;
(b) calculate ACTUAL_IDLE_DURATION; (c) verify effective SESSION_IDLE_TIMEOUT_MS; then confirm
or falsify H1/H4/H11 and assess H7. If AUTHORITATIVE_RUNTIME_LAST_ACTIVITY cannot be
reconstructed, outcome class G (ROOT_CAUSE_UNPROVEN) is the correct result.

---

## 18. Read-Only Staging Evidence Plan

Step 3 may use STAGING for READ-ONLY evidence only.

### 18.1 Evidence sources

| Source | Purpose | Access method |
|--------|---------|---------------|
| PostgreSQL sessions table | Session row: status, terminated_at, termination_reason, last_activity_at | `psql "$DATABASE_URL"` |
| PostgreSQL usage_records table | Execution row: timestamps, tokens, intent, metadata | `psql "$DATABASE_URL"` |
| PostgreSQL git_checkpoints table | Checkpoint records (0 expected for failed run) | `psql "$DATABASE_URL"` |
| container-manager SQLite sessions table | SQLite session row: terminated_at, last_activity_at | `python3 sqlite3` read-only |
| container-manager SQLite governance_events | Termination event log | `python3 sqlite3` read-only |
| container-manager PM2 log | Workspace request log, idle timeout event, session stop event | `pm2 logs aisandbox-container-manager --nostream --lines N` |
| API Gateway PM2 log | finalize_accounting event, internal stop notification receipt | `pm2 logs aisandbox-api-gateway --nostream --lines N` |
| PM2 container-manager env | Effective SESSION_IDLE_TIMEOUT_MS | `pm2 env <id>` |
| PM2 container-manager describe | Restart count, uptime (for H12) | `pm2 describe aisandbox-container-manager` |
| Staging git log | Source parity verification | `git -C /opt/aisandbox log --oneline -5` |

### 18.2 What is NOT available as staging evidence

- Frontend browser logs (not available server-side)
- In-memory `lastActivity` Map state (ephemeral, already cleared at session expiry)
- Provider request timestamps (xAI API side, not accessible)

---

## 19. Exact SQL Queries (READ-ONLY)

All queries must be executed with `psql "$DATABASE_URL"` where `$DATABASE_URL` is the
staging environment variable. No mutations permitted.

Column names verified against current TypeORM entities in `services/api-gateway/src/entities/`.

### 19.1 Session row (READ-ONLY)

Entity: `session.entity.ts` → table `sessions`

```sql
-- READ-ONLY
SELECT
  id,
  status,
  container_id,
  created_at AT TIME ZONE 'UTC' AS created_at_utc,
  expires_at AT TIME ZONE 'UTC' AS expires_at_utc,
  last_activity_at AT TIME ZONE 'UTC' AS last_activity_at_utc,
  terminated_at AT TIME ZONE 'UTC' AS terminated_at_utc,
  termination_reason,
  user_id,
  project_id
FROM sessions
WHERE id = '1492ed19-9417-4a93-a1fc-c5034d41d22e';
```

Expected: `terminated_at` set, `termination_reason = 'idle_timeout'`

Note: `last_activity_at` here is written by API Gateway `touchLastActivity()` — contextual only,
NOT the in-memory Map. Label as PERSISTED_ACTIVITY_TIMESTAMP (CONTEXTUAL ONLY).

### 19.2 Usage record row (READ-ONLY)

Entity: `usage-record.entity.ts` → table `usage_records`  
PK column: `execution_id` (NOT `id`)

```sql
-- READ-ONLY: execution record by execution_id
SELECT
  execution_id,
  user_id,
  session_id,
  conversation_id,
  provider,
  adapter,
  model,
  tokens_used,
  execution_duration_ms,
  execution_status,
  timestamp AT TIME ZONE 'UTC' AS timestamp_utc,
  metadata
FROM usage_records
WHERE execution_id = '12a8e444-5f4b-4966-a4ee-e040a5bfd0b5';
```

Also:

```sql
-- READ-ONLY: all usage records for this session
SELECT
  execution_id,
  execution_status,
  tokens_used,
  provider,
  model,
  timestamp AT TIME ZONE 'UTC' AS timestamp_utc,
  metadata
FROM usage_records
WHERE session_id = '1492ed19-9417-4a93-a1fc-c5034d41d22e'
ORDER BY timestamp;
```

### 19.3 Git checkpoints for session (READ-ONLY)

Entity: `git-checkpoint.entity.ts` → table `git_checkpoints`

```sql
-- READ-ONLY: expected 0 rows (no checkpoint was created since apply failed)
SELECT
  id,
  session_id,
  commit_hash,
  message_number,
  description,
  files_changed,
  created_at AT TIME ZONE 'UTC' AS created_at_utc
FROM git_checkpoints
WHERE session_id = '1492ed19-9417-4a93-a1fc-c5034d41d22e'
ORDER BY created_at;
```

### 19.4 Credit deduction records (READ-ONLY)

Entity: `credit-deduction-record.entity.ts` → table `credit_deduction_records`

```sql
-- READ-ONLY: expected 0 rows (build_awaiting_apply state; no credit confirm issued)
SELECT
  id,
  owner_id,
  source_event_type,
  execution_id,
  requested_credits,
  applied_credits,
  status,
  created_at AT TIME ZONE 'UTC' AS created_at_utc
FROM credit_deduction_records
WHERE execution_id = '12a8e444-5f4b-4966-a4ee-e040a5bfd0b5';
```

---

## 20. container-manager SQLite Queries (READ-ONLY)

```bash
# READ-ONLY: session row in container-manager SQLite
python3 -c "
import sqlite3, json
conn = sqlite3.connect('file:/opt/aisandbox/database/aisandbox.db?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
row = conn.execute('''
  SELECT id, user_id, project_id, status, created_at, expires_at,
         last_activity_at, terminated_at, termination_reason
  FROM sessions
  WHERE id = ?
''', ('1492ed19-9417-4a93-a1fc-c5034d41d22e',)).fetchone()
print(json.dumps(dict(row) if row else None, indent=2))
conn.close()
"
```

```bash
# READ-ONLY: governance_events (termination audit log)
python3 -c "
import sqlite3, json
conn = sqlite3.connect('file:/opt/aisandbox/database/aisandbox.db?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute('''
  SELECT id, session_id, user_id, termination_reason, terminated_at, source, created_at
  FROM governance_events
  WHERE session_id = ?
  ORDER BY created_at
''', ('1492ed19-9417-4a93-a1fc-c5034d41d22e',)).fetchall()
print(json.dumps([dict(r) for r in rows], indent=2))
conn.close()
"
```

---

## 21. PM2 Log Evidence (READ-ONLY)

The key evidence window is UTC 03:29:46 to 04:20:00 on 2026-08-19.
In staging local time: 11:29:46 to 12:20:00 on 2026-08-19.

### 21.0 Container-manager logging architecture (Step 3 prerequisite)

**IMPORTANT:** Container-manager has NO HTTP request/response logging middleware.
`NestFactory.create` is configured with `logger: ['log', 'error', 'warn', 'debug']` but no
`LoggingInterceptor`, `morgan`, or access-log middleware is registered (`main.ts` confirms).

**Proven container-manager log strings related to session lifecycle:**

| Event | Exact log string | Source | Condition |
|-------|-----------------|--------|-----------|
| Session start notified to gateway | `Session started: <sessionId>` | `ApiGatewayHttpClient` NestJS Logger | Always on success |
| Session stop notified to gateway (idle) | `Session stopped: <sessionId> (reason: idle_timeout)` | `ApiGatewayHttpClient` NestJS Logger | Always on success |
| Container cleanup failure | `Failed to stop container for expired session <sessionId>: <error>` | `console.error` in `scheduleContainerCleanup` | Only on Docker error |
| Notification failure | `Failed to notify api-gateway of session idle_timeout termination <sessionId>: <error>` | `console.error` in `scheduleLifecycleNotification` | Only on HTTP error |

**NOT logged by container-manager:**
- Individual workspace operations (`readFileFromContainer`, `writeFileToContainer`, `execInContainer`, etc.) — NO log statements
- `checkAndEnforceIdleTimeout` — NO log when it fires; throws GoneException silently from log perspective
- `updateLastActivity` — NO log
- `scheduleContainerCleanup` — NO log on success; only on failure
- HTTP 410 GoneException — NestJS does NOT log 4xx responses by default; no custom ExceptionFilter registered

**Consequence for Step 3:** Container-manager PM2 log alone CANNOT prove when individual workspace
operations occurred. Evidence of the last activity touch must come from API Gateway logs (which
show requests proxied to container-manager) or from the SQLite `last_activity_at` (contextual
— FilesService path only; see Section 7.2).

### 21.1 Container-manager log — proven session events

```bash
# READ-ONLY: container-manager log for E2E-04 session — search by SESSION_ID
CM_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-container-manager']")
pm2 logs "$CM_ID" --nostream --lines 10000 2>&1 | grep '1492ed19'
```

**What to look for in output:**
- `Session started: 1492ed19` — session start notification to gateway (confirms process had session in memory)
- `Session stopped: 1492ed19-9417-4a93-a1fc-c5034d41d22e (reason: idle_timeout)` — PROVEN log string confirming idle timeout
- Any error logs for cleanup/notification failures

**What will NOT appear:**
- Function names (`checkAndEnforceIdleTimeout`, `updateLastActivity`, `scheduleContainerCleanup`)
- File operation logs (`readFile`, `writeFile`, `listDirectory`, `exec`)
- HTTP request/response lines

### 21.2 API Gateway log — session and execution entries

```bash
# READ-ONLY: gateway log — all entries for E2E-04 session
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
pm2 logs "$GW_ID" --nostream --lines 10000 2>&1 | grep '1492ed19'
```

```bash
# READ-ONLY: gateway log — entries for EXECUTION_ID
pm2 logs "$GW_ID" --nostream --lines 10000 2>&1 | grep '12a8e444'
```

**Expected events (from E2E-04 EXECUTION.md Phase W-Y):**
```
Internal route access granted: POST /api/internal/sessions/1492ed19-9417-4a93-a1fc-c5034d41d22e/stop
{"event":"finalize_accounting.build_awaiting_apply","timestamp":"2026-08-19T04:17:58.575Z","executionId":"12a8e444-5f4b-4966-a4ee-e040a5bfd0b5","executionIntent":"workspace_mutation"}
```

**API Gateway log value for activity reconstruction:** The gateway may log the file-write request
(`POST /api/sessions/1492ed19.../files/write`) which was proxied to container-manager. If visible,
this gives the time of the apply attempt and any prior file operations.

### 21.3 AI service log — execution entries

```bash
# READ-ONLY: AI service log for EXECUTION_ID
AI_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-ai-service']")
pm2 logs "$AI_ID" --nostream --lines 10000 2>&1 | grep -E '12a8e444|1492ed19'
```

### 21.4 Effective idle timeout configuration in staging (READ-ONLY)

```bash
# READ-ONLY: effective SESSION_IDLE_TIMEOUT_MS in PM2 process environment
# pm2 env <id> shows the actual env vars inherited by the process — correct method
CM_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-container-manager']")
pm2 env "$CM_ID" | grep -E 'SESSION_IDLE_TIMEOUT_MS|SESSION_MAX_LIFETIME_MS'
# If SESSION_IDLE_TIMEOUT_MS absent: default 1,800,000 ms (30 min) is in effect
```

Note: `printenv SESSION_IDLE_TIMEOUT_MS` in the remote shell would only show the CURRENT shell
environment, NOT the PM2 process's effective environment. Use `pm2 env <id>` to get the process's
actual environment. `SESSION_IDLE_TIMEOUT_MS` is non-secret and safe to record.

### 21.5 Container-manager process uptime and restart count (H12)

```bash
# READ-ONLY
pm2 describe aisandbox-container-manager
```

Look for: restart count, uptime (relative to session creation 03:29:46 UTC = 11:29:46 local).
If restart count changed or uptime < session age: H12 (process restart cleared Map) must be investigated.

### 21.6 Staging source parity check (READ-ONLY)

```bash
# READ-ONLY
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox log --oneline -5
git -C /opt/aisandbox status --short
```

Expected: HEAD = `c3e39279abe3c0d6c348daa312107c8f6fc592b7` (from E2E-04 evidence).

---

## 22. Exact Step 3 Commands (PowerShell SSH Wrappers — READ-ONLY)

All staging commands must be issued via PowerShell SSH from the local machine.
All are READ-ONLY. No PM2 restarts. No env changes. No DB mutations.

```powershell
# READ-ONLY: Connectivity check
ssh aisandbox-staging "echo connected && hostname"
```

```powershell
# READ-ONLY: Verify staging source parity
ssh aisandbox-staging "git -C /opt/aisandbox rev-parse HEAD && git -C /opt/aisandbox log --oneline -5 && git -C /opt/aisandbox status --short"
```

```powershell
# READ-ONLY: Verify PM2 services healthy
ssh aisandbox-staging "pm2 list"
```

```powershell
# READ-ONLY: Effective idle timeout config in container-manager
ssh aisandbox-staging 'CM_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p[''pm_id'']) for p in json.load(sys.stdin) if p[''name'']==\"aisandbox-container-manager\"]"); pm2 env "$CM_ID" | grep -E "SESSION_IDLE_TIMEOUT_MS|SESSION_MAX_LIFETIME_MS"'
```

```powershell
# READ-ONLY: Container-manager process uptime and restart count (H12 check)
ssh aisandbox-staging "pm2 describe aisandbox-container-manager"
```

```powershell
# READ-ONLY: PostgreSQL session row
ssh aisandbox-staging 'psql "$DATABASE_URL" -c "SELECT id, status, container_id, created_at AT TIME ZONE ''UTC'' AS created_at_utc, last_activity_at AT TIME ZONE ''UTC'' AS last_activity_utc, terminated_at AT TIME ZONE ''UTC'' AS terminated_at_utc, termination_reason FROM sessions WHERE id = ''1492ed19-9417-4a93-a1fc-c5034d41d22e'';"'
```

```powershell
# READ-ONLY: PostgreSQL usage_records for execution
ssh aisandbox-staging 'psql "$DATABASE_URL" -c "SELECT id, type, tokens_used, cost_credits, status, created_at AT TIME ZONE ''UTC'' AS created_utc, metadata FROM usage_records WHERE id = ''12a8e444-5f4b-4966-a4ee-e040a5bfd0b5'';"'
```

```powershell
# READ-ONLY: PostgreSQL git_checkpoints for session (expect 0 rows)
ssh aisandbox-staging 'psql "$DATABASE_URL" -c "SELECT id, session_id, checkpoint_type, git_commit_hash, created_at FROM git_checkpoints WHERE session_id = ''1492ed19-9417-4a93-a1fc-c5034d41d22e'' ORDER BY created_at;"'
```

```powershell
# READ-ONLY: container-manager SQLite session row
ssh aisandbox-staging 'python3 -c "import sqlite3, json; conn = sqlite3.connect(\"file:/opt/aisandbox/database/aisandbox.db?mode=ro\", uri=True); conn.row_factory = sqlite3.Row; row = conn.execute(\"SELECT id, status, created_at, last_activity_at, terminated_at, termination_reason FROM sessions WHERE id = ?\", (\"1492ed19-9417-4a93-a1fc-c5034d41d22e\",)).fetchone(); print(json.dumps(dict(row) if row else None, indent=2)); conn.close()"'
```

```powershell
# READ-ONLY: container-manager SQLite governance_events
ssh aisandbox-staging 'python3 -c "import sqlite3, json; conn = sqlite3.connect(\"file:/opt/aisandbox/database/aisandbox.db?mode=ro\", uri=True); conn.row_factory = sqlite3.Row; rows = conn.execute(\"SELECT id, session_id, user_id, termination_reason, terminated_at, source, created_at FROM governance_events WHERE session_id = ? ORDER BY created_at\", (\"1492ed19-9417-4a93-a1fc-c5034d41d22e\",)).fetchall(); print(json.dumps([dict(r) for r in rows], indent=2)); conn.close()"'
```

```powershell
# READ-ONLY: Container-manager PM2 log — all entries for E2E-04 session
# NOTE: only session start/stop notifications and errors will match (no per-request logging)
# Proven log string: "Session stopped: 1492ed19-... (reason: idle_timeout)"
ssh aisandbox-staging 'CM_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p[''pm_id'']) for p in json.load(sys.stdin) if p[''name'']==\"aisandbox-container-manager\"]"); pm2 logs "$CM_ID" --nostream --lines 10000 2>&1 | grep "1492ed19"'
```

```powershell
# READ-ONLY: API Gateway PM2 log — all entries for E2E-04 session
# Gateway logs HTTP requests, so this may show file-write requests proxied to container-manager
# and the internal stop notification receipt
ssh aisandbox-staging 'GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p[''pm_id'']) for p in json.load(sys.stdin) if p[''name'']==\"aisandbox-api-gateway\"]"); pm2 logs "$GW_ID" --nostream --lines 10000 2>&1 | grep "1492ed19"'
```

```powershell
# READ-ONLY: API Gateway PM2 log — entries for execution ID
ssh aisandbox-staging 'GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p[''pm_id'']) for p in json.load(sys.stdin) if p[''name'']==\"aisandbox-api-gateway\"]"); pm2 logs "$GW_ID" --nostream --lines 10000 2>&1 | grep "12a8e444"'
```

```powershell
# READ-ONLY: AI Service PM2 log — entries for execution
ssh aisandbox-staging 'AI_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p[''pm_id'']) for p in json.load(sys.stdin) if p[''name'']==\"aisandbox-ai-service\"]"); pm2 logs "$AI_ID" --nostream --lines 10000 2>&1 | grep -E "12a8e444|1492ed19"'
```

---

## 23. Root-Cause Proof Standard

Step 3 may declare `ROOT_CAUSE_PROVEN=YES` only if ALL of the following are satisfied:

1. **Implementation contract identified:** The exact code path and semantics that produced the behavior are located in source.
2. **E2E-04 runtime state / timestamps identified:** The actual values from staging (last activity timestamp, effective timeout config, etc.) are captured.
3. **Expected behavior calculated:** Using the implementation contract + actual values, the expected termination time is computed.
4. **Actual behavior compared:** The expected termination time matches the actual `terminated_at` within reasonable tolerance.
5. **Competing major hypotheses eliminated or shown non-causal:** H2/H3/H6 are eliminated by source inspection. H8/H9/H12 must be addressed by staging evidence.
6. **Exact smallest responsible mechanism identified:** The specific missing guard, missing activity-touch, or configuration gap is named with source file and line.

If any of the above cannot be satisfied:

```
ROOT_CAUSE_PROVEN=NO
```

03K must then consolidate as root cause unproven rather than selecting a repair by inference.

---

## 24. Possible Outcome Classes

Step 3 must classify its final result as exactly one of:

**A. IMPLEMENTATION_DEFECT_PROVEN**
A specific guard, check, or activity-touch is absent that should exist per the intended design.
Example: idle sweeper should protect active Builder executions but does not; however there is
no sweeper, so this would manifest as a missing activity-reset on execution start/completion.

**B. PRODUCT_CONTRACT_DEFECT_PROVEN**
Implementation behaves exactly as coded, but the current idle policy (30-minute timeout with
no mechanism to extend during AI execution) is incompatible with legitimate long-running
Builder work. The timeout is not a bug in the narrow sense; the contract is wrong.

**C. FRONTEND_KEEPALIVE_DEFECT_PROVEN**
A heartbeat was supposed to exist but does not. This is effectively already proven by source
inspection (no heartbeat exists), but C applies if the intended design required one.

**D. TIMESTAMP / TIMEOUT_CALCULATION_DEFECT_PROVEN**
A clock skew, misconfigured timeout value, or arithmetic defect caused premature termination
not explained by genuine inactivity.

**E. RACE_CONDITION_PROVEN**
A structural race exists between two concurrent paths (e.g., concurrent write attempts and
cleanup) that cannot be eliminated by activity-touch alone.

**F. EXPECTED_TIMEOUT / TEST_PROCEDURE_CAUSE_PROVEN**
The E2E session genuinely exceeded the configured inactivity threshold under the intended
contract, and the test procedure did not adequately keep the session alive. The implementation
is correct; the test design was the cause.

**G. ROOT_CAUSE_UNPROVEN**
Evidence is insufficient to satisfy the proof standard above. 03K must consolidate as
root cause unproven.

Do NOT force an A–F classification. Use G if evidence is insufficient.

---

## 25. Repair Boundary

**Step 2 and Step 3 MUST NOT fix anything.**

If root cause is proven, Step 3 MAY recommend:

- Likely service ownership (container-manager / api-gateway / frontend)
- Likely source files and functions requiring change
- Smallest safe repair concept
- Tests needed (unit + integration, and whether a new live-provider E2E is required to validate the fix)
- Mutexes / resources likely required for the repair task (e.g., CONTAINER-MANAGER, FRONTEND, ENV)
- Whether a database migration or config change is implicated

No source change is authorized in 03K. The repair must be a separately registered OS v1 task with its own lifecycle.

---

## 26. No-Reproduction Rule

03K must first exhaust existing evidence (source inspection + read-only staging).

Do NOT:
- Reopen E2E-04
- Create another E2E project or session
- Call grok-4.5 or any provider
- Enable `GLOBAL_EXECUTION_ENABLED=true`
- Consume credits
- Reproduce with another provider call

If existing evidence proves insufficient and a controlled reproduction becomes necessary to
satisfy the proof standard, Step 3 must:
1. STOP investigation
2. Return to the control plane
3. Request new explicit scope and authorization for a controlled reproduction

---

## 27. Hard-Stop Conditions for Step 3

Step 3 must stop and return to the control plane if ANY of the following are true:

- Current task no longer owns STAGING (board changed)
- Lane/admission changed while Step 3 is in progress
- Evidence collection requires staging mutation (DB write, PM2 restart, env change, source change)
- Evidence requires creating a new session or project
- Evidence requires calling a provider
- Evidence requires DB mutation (any INSERT/UPDATE/DELETE/TRUNCATE/ALTER/DROP)
- Evidence requires source modification
- Staging source HEAD does not match expected `c3e39279abe3c0d6c348daa312107c8f6fc592b7`
  and the difference is material to the investigation (source semantics have changed)
- Accessing an evidence source would expose secrets unnecessarily (e.g., printing DATABASE_URL)
- Source and staging runtime evidence materially conflict in a way that cannot be resolved
  read-only (e.g., production behavior differs from source due to unknown deployment)
- Exact runtime field/config semantics cannot be proven read-only

If a hard stop is triggered: record the exact stop reason, preserve all evidence captured
so far, and return to the control plane for resolution.

---

## 28. Exact Step 3 Investigation Order

```
A.  Re-bootstrap OS v1 — read AGENTS.md, apply CLAUDE.md, read TASKS.md CURRENT EXECUTION
    BOARD only, read PRIVATE-BETA-BLOCKER-03K canonical body, read this stage-start document.
    Confirm: Lane 1 = PRIVATE-BETA-BLOCKER-03K ACTIVE, STAGING owned by Lane 1, Lane 2 EMPTY.

B.  Verify STAGING ownership — confirm STAGING mutex on board before any staging access.

C.  Capture local source/commit baseline (read-only):
    git -C "C:\Users\knlee\aiSandBox2026B" status --short
    git -C "C:\Users\knlee\aiSandBox2026B" rev-parse HEAD

D.  Re-confirm E2E-04 immutable evidence IDs/timestamps from:
    docs/PRIVATE-BETA-E2E-04-CHECKPOINT.md
    docs/PRIVATE-BETA-E2E-04-EXECUTION.md
    (These are read-only, do not reinterpret)

E.  Inspect authoritative idle-timeout implementation (source, read-only):
    - Read services/container-manager/src/config/governance.config.ts (parseEnvInt semantics)
    - Read services/container-manager/src/sessions/sessions.service.ts (checkAndEnforceIdleTimeout)
    Note: Step 2 has already done this; Step 3 re-confirms before staging access.

F.  Inspect session activity-touch implementation (source, read-only):
    - Confirm updateLastActivity call sites (7 methods confirmed)
    - Confirm plain-path AI execution does not touch lastActivity

G.  Inspect idle enforcement & cleanup implementation (source, read-only):
    - Confirm no background sweeper exists (Step 2 confirmed; re-verify if source changed)
    - Confirm request-driven idle enforcement: checkAndEnforceIdleTimeout fires only on incoming
      workspace requests; no periodic/background job
    - Confirm scheduleContainerCleanup / scheduleLifecycleNotification semantics

H.  Confirm frontend heartbeat absence (source, read-only):
    - Step 2 confirmed: NO heartbeat. Re-confirm at Step 3 start.

I.  Confirm AI-execution/session interaction for plain path (source, read-only):
    - Step 2 confirmed: plain path makes no container-manager calls. Re-confirm.

J.  Build initial hypothesis/evidence matrix from source (Step 2 findings carry forward).

K.  Connect to staging (read-only SSH):
    ssh aisandbox-staging "echo connected && hostname"
    (Hard stop if unreachable)

L.  Verify staging source parity:
    git -C /opt/aisandbox rev-parse HEAD
    Expected: c3e39279abe3c0d6c348daa312107c8f6fc592b7
    (Hard stop if HEAD differs materially and affects investigation)

M.  Capture effective idle-timeout runtime configuration:
    pm2 env <CM_ID> | grep SESSION_IDLE_TIMEOUT_MS
    pm2 env <CM_ID> | grep SESSION_MAX_LIFETIME_MS
    (Hard stop if value is unexpected/unreadable)

N.  Check container-manager process uptime and restart count (H12):
    pm2 describe aisandbox-container-manager
    → If restart count indicates PM2 restart during E2E-04 session: update H12 status

O.  Query PostgreSQL session row:
    SELECT id, status, created_at AT TIME ZONE 'UTC', last_activity_at AT TIME ZONE 'UTC',
           terminated_at AT TIME ZONE 'UTC', termination_reason FROM sessions WHERE id = '1492ed19...'

P.  Query PostgreSQL usage_records for execution:
    SELECT id, type, tokens_used, created_at AT TIME ZONE 'UTC', metadata FROM usage_records
    WHERE id = '12a8e444...'

Q.  Query container-manager SQLite session row and governance_events:
    See exact commands in Section 20

R.  Query git_checkpoints (expect 0 rows):
    See exact SQL in Section 19.3

S.  Capture container-manager PM2 log entries for SESSION_ID:
    pm2 logs <CM_ID> --nostream --lines 10000 | grep '1492ed19'
    → Extract all log lines with timestamps for this session
    → Identify ALL workspace operations (file list, file read, file write, exec, stat)
    → Determine LAST_WORKSPACE_OPERATION_TIME

T.  Capture gateway PM2 log entries for SESSION_ID and EXECUTION_ID:
    pm2 logs <GW_ID> --nostream --lines 10000 | grep '1492ed19'
    pm2 logs <GW_ID> --nostream --lines 10000 | grep '12a8e444'
    → Confirm finalize_accounting.build_awaiting_apply timestamp
    → Confirm internal stop notification receipt
    → Determine EXECUTION_SUBMITTED_AT from AI execution creation log

U.  Capture AI service PM2 log entries for EXECUTION_ID:
    pm2 logs <AI_ID> --nostream --lines 10000 | grep -E '12a8e444|1492ed19'
    → Determine PROVIDER_REQUEST_START if logged

V.  Reconstruct normalized UTC timeline from all evidence:
    - SESSION_CREATED_AT_UTC = 03:29:46.839 UTC (known)
    - FIRST_WORKSPACE_OPERATION_TIME_UTC = from Step S/T log evidence (earliest activity touch)
    - RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME = from Step S/T log evidence
      (last operation source-proven to call updateLastActivity before the idle enforcement check)
      → Label as UNPROVEN if log evidence is insufficient
    - PERSISTED_ACTIVITY_TIMESTAMP_SQLITE = SQLite last_activity_at (contextual only; FilesService path)
    - EXECUTION_SUBMITTED_AT_UTC = from Step T gateway log
    - AI_COMPLETION_TIME_UTC = 04:17:55.619Z (known)
    - ACCOUNTING_FINALIZATION_TIME_UTC = 04:17:58.575Z (known)
    - IDLE_ENFORCEMENT_TIME_UTC = ≈ 04:17:58Z (from SESSION_TERMINATED_AT / terminated_at)
    - SESSION_TERMINATED_AT_UTC = 04:17:58.819Z (known from PostgreSQL)

W.  Calculate actual idle duration (only if RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME is available):
    ACTUAL_IDLE_DURATION_MS = IDLE_ENFORCEMENT_TIME_UTC − RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME
    CONFIGURED_IDLE_TIMEOUT_MS = effective runtime value from PM2 env (Step M)
    DELTA_FROM_THRESHOLD = ACTUAL_IDLE_DURATION_MS − CONFIGURED_IDLE_TIMEOUT_MS
    EXPECTED_TERMINATION_THRESHOLD = RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME + CONFIGURED_IDLE_TIMEOUT_MS
    If RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME is unavailable:
      Record ACTUAL_IDLE_DURATION = UNPROVEN; DELTA_FROM_THRESHOLD = UNPROVEN

X.  Compare expected contract to actual behavior:
    - Does the timeout arithmetic confirm the session was genuinely idle for >30 min? (H1/H11)
    - Was the session genuinely inactive for the full threshold? (confirms H1)
    - Did any workspace operation occur in the 30-min window before expiry? (would falsify H1)

Y.  Test/falsify each hypothesis against the full evidence:
    - H2/H3: ELIMINATED (source)
    - H6: ELIMINATED (source)
    - H4/H5: CONFIRMED by source; confirm by log (no container-manager activity during execution)
    - H1: Confirm by arithmetic (was idle duration > threshold?)
    - H7: Assess by timeline proximity
    - H8: Assess by effective SESSION_IDLE_TIMEOUT_MS value
    - H9: Confirm no manual stop issued
    - H10: Characterize as consequence if applicable
    - H11: Confirm if H1 + H4/H5 both confirmed
    - H12: Confirm/eliminate by PM2 restart count

Z.  Decide ROOT_CAUSE_PROVEN YES/NO based on proof standard (Section 23).

AA. If YES: identify exact responsible mechanism (source file + line + function).

AB. Define smallest separate repair scope concept (for a future registered fix task):
    - Which service(s) need changes
    - Which files/functions
    - Mutex/resource requirements
    - Whether migration or config change is implicated
    - Type of tests required
    - Whether a new live-provider E2E is needed to validate the fix

AC. Decide whether a future fresh E2E is required to validate the eventual fix.
    (Expected: YES — a new controlled E2E after the fix is registered and deployed)

AD. Record all terminal investigation evidence for Step 4 consolidation.
    Create Step 3 evidence document only: docs/PRIVATE-BETA-BLOCKER-03K-INVESTIGATION.md
    Do NOT modify TASKS.md or TASKS_BACKLOG_FULL.md during Step 3.
```

---

## 29. Fix Scope Boundary

Step 2 and Step 3 must NOT implement any fix.

Possible fix directions (NOT selected, NOT authorized, listed only to scope the evidence):
- Add activity-touch at AI execution submission in container-manager (if accessible from gateway)
- Add activity-touch at execution completion callback in gateway → container-manager
- Suppress idle timeout for sessions with an active `usage_records` row in `build_awaiting_apply` status
- Extend `SESSION_IDLE_TIMEOUT_MS` (configuration-only change)
- Implement frontend heartbeat that calls a new container-manager activity endpoint
- Any combination of the above

The actual repair approach must be determined after root cause is proven and registered as a
separate OS v1 task.

---

## 30. PRIVATE-BETA-INVITE-01 Status

```
PRIVATE-BETA-INVITE-01 = UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
```

Must remain prohibited until:
1. 03K root cause is proven
2. A separately registered fix task is completed and LOCKED
3. A new fresh E2E is completed and LOCKED (PASS)
4. Builder private-beta readiness gate is updated by the control plane

---

## Step 2 Control-Plane Metadata

```
STEP2_STATUS = COMPLETE — 2026-08-20
INVESTIGATION_PLAN_FROZEN = YES
MATERIAL_AMBIGUITY_PRESENT = NO
STEP3_AUTHORIZED = YES (read-only staging investigation only)
NO_FIX_SELECTED = YES
NO_PROVIDER_REPRODUCTION = YES
GOVERNANCE_REQUIRED_FOR_BOARD_REGISTRY_UPDATE = YES
LANE_1_RETAINS_STAGING = YES
```

---

*Created 2026-08-20 — PRIVATE-BETA-BLOCKER-03K Step 2 control-plane governance write only —
no application source / test / migration / package mutation — no staging / runtime / provider /
credit / env activity — no Git mutation.*
