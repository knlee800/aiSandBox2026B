# AGENT-HARNESS-05B6D — Checkpoint

**Task ID:** AGENT-HARNESS-05B6D
**Title:** Internal Session Start DB Row Fix
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-26

---

## 1. Dependency / Context from 05B6C Blocker

AGENT-HARNESS-05B6C performed browser_smoke validation against the running production compose stack. All health checks and the internal session-start HTTP 200 passed. However, after the container was created, the next step (file write to the session workspace) returned HTTP 404 with `Session 05b6c-smoke-test not found`. AGENT-HARNESS-05B6C is still ACTIVE; it is blocked at this step pending the fix produced by this task.

AGENT-HARNESS-05B6D was registered as a focused child fix to unblock 05B6C without altering its browser_smoke scope.

---

## 2. Problem Statement and Exact 05B6C Failure

AGENT-HARNESS-05B6C attempted:

```
POST http://localhost:4002/api/internal/sessions/05b6c-smoke-test/files
```

Response:

```json
{
  "message": "Session 05b6c-smoke-test not found",
  "error": "Not Found",
  "statusCode": 404
}
```

All prior steps had passed:
- Production compose stack healthy.
- `api-gateway /api/health` HTTP 200.
- `container-manager /api/health` HTTP 200.
- `container-manager /api/internal/stats` HTTP 200 with `dockerConnectivity: true`.
- Browser-capable session start returned HTTP 200.
- Docker container `sandbox-session-05b6c-smoke-test` was created and running.
- Container image was `aisandbox-workspace-browser:local`.
- `NODE_PATH` included `/opt/browser-smoke/node_modules`.

The failure occurred because no local SQLite session row was created during the internal start.

---

## 3. Root Cause Confirmation

File:
`services/container-manager/src/sessions/sessions.service.ts`

`startSessionContainer()` created the Docker container unconditionally, but only inserted a SQLite session row inside an `if (userId)` branch. In AGENT-HARNESS-05B6C, `userId` was intentionally omitted to avoid the earlier validation-user / FK issue introduced by sending a synthetic `userId` to api-gateway.

Because no SQLite session row was inserted, all downstream methods that call `assertSessionUsableOrThrow()` — including file write, exec, and preview registration — queried SQLite, found no row for the session ID, and returned HTTP 404.

This confirmed the root cause hypothesis registered in AGENT-HARNESS-05B6D at registration time.

---

## 4. Exact Files Changed

Implementation files changed:

1. `services/container-manager/src/sessions/sessions.service.ts`
2. `services/container-manager/src/sessions/sessions.service.spec.ts`

No other files were changed:
- No controller changes.
- No guard changes.
- No preview changes.
- No api-gateway changes.
- No compose / Dockerfile / frontend / .env changes.
- No database schema changes.

---

## 5. Implementation Summary

`startSessionContainer()` was updated to always check for local session-row existence before proceeding. If the row is missing, it inserts one using the following priority:

1. If `userId` is present — insert with the provided `userId` (preserves existing user-session behavior).
2. If `userId` is omitted — attempt insert with `null` for `user_id`.
3. If the schema rejects `null` with a `NOT NULL` constraint — fallback to a local internal owner ID of the form `internal-session-<sessionId>`.

Two helpers were added:

- `isSessionsUserIdNotNullError(error)` — detects the SQLite `NOT NULL` constraint violation on `user_id`.
- `buildInternalSessionOwnerId(sessionId)` — constructs the deterministic internal owner string `internal-session-<sessionId>`.

The session-row insert now always runs before the Docker container is started or before control is returned to the caller. This guarantees that by the time `assertSessionUsableOrThrow()` is called by any downstream file/exec/preview API, the session row already exists in SQLite.

No changes were made to:
- `assertSessionUsableOrThrow()` — it remains strict and unweakened.
- `notifySessionStarted()` — remains session-ID-based; no synthetic `userId` is sent cross-service.
- `InternalServiceAuthGuard` — unchanged.
- Public session creation path — unchanged.
- `browserCapable` image selection logic — unchanged.

---

## 6. Why This Fix Is Safer Than Weakening `assertSessionUsableOrThrow()`

`assertSessionUsableOrThrow()` is the downstream invariant that protects file/exec/preview APIs from operating on unknown or stale containers. Weakening it (e.g., creating an implicit "session" from any running Docker container, or skipping the DB check) would:

- Allow arbitrary Docker containers not registered by the platform to be treated as valid sessions.
- Mask future creation failures where the session row is not inserted for legitimate reasons.
- Undermine the contract that every valid session has a lifecycle record in SQLite.

By instead fixing the creation path (`startSessionContainer()`), the invariant is preserved: a session row must exist and only exists when the platform explicitly created it. The guard remains the correct enforcement mechanism for all downstream APIs.

---

## 7. How the Prior `userId` / FK Issue Is Avoided

In an earlier iteration, a synthetic `userId` (e.g., a validation-user UUID) was sent in the `notifySessionStarted()` call to api-gateway. This triggered a FK constraint failure in the api-gateway database because the synthetic user did not exist.

AGENT-HARNESS-05B6D avoids reintroducing this by:

- Not sending any `userId` to api-gateway for internal-start sessions.
- `notifySessionStarted()` continues to use only the `sessionId` — no user context is forwarded.
- The local SQLite session row uses either `null` or a local string identifier (`internal-session-<sessionId>`) that is entirely within the container-manager's own database and is never sent cross-service.
- The api-gateway's users table is never referenced or violated.

---

## 8. Test Summary

Tests added or updated in `services/container-manager/src/sessions/sessions.service.spec.ts`:

| Test | Result |
|---|---|
| Internal start without `userId` creates local session row | PASS |
| NOT NULL `user_id` schema fallback path (`internal-session-<id>`) | PASS |
| Existing `userId` insert behavior preserved | PASS |
| Existing-row no-duplicate-insert behavior preserved | PASS |
| Downstream file-read guard path proceeds after internal start without `userId` | PASS |
| Existing browser-capable option tests remain passing | PASS |

Total: 8 suites / 95 tests — all passed.

---

## 9. Validation Commands and Results

### TypeScript

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"
npx tsc --noEmit
```

**Result:** PASS — exit code 0

### Tests

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"
npm test
```

**Result:** PASS — exit code 0 — 8 suites, 95 tests passed

---

## 10. Confirmations / No-Goals

The following were confirmed NOT performed during AGENT-HARNESS-05B6D:

- No `.env` changes.
- No `docker-compose.yml` changes.
- No Dockerfile changes.
- No frontend changes.
- No api-gateway changes.
- No package dependency changes.
- No Docker compose/container lifecycle commands were run.
- `browser_smoke` was not rerun.
- ai-service provider/model execution validation was not run.
- No production sessions were created.
- No git commit/push.

---

## 11. Remaining Out-of-Scope Items

The following items remain open and deferred. They are not part of AGENT-HARNESS-05B6D.

1. **05B6C `browser_smoke` retry not yet run** — AGENT-HARNESS-05B6C is ACTIVE; its `browser_smoke` validation against production compose must be retried now that the DB row fix is in place.
2. **ai-service provider/model execution not run** — No live AI model calls were validated in this task.
3. **Workspace volume / Docker-in-Docker host-path strategy not fixed** — The sandbox container workspace volume mount strategy was not addressed.
4. **Debug telemetry cleanup not fixed** — Excess diagnostic logging identified in earlier tasks was not cleaned up.
5. **Provider validator design smell not fixed** — The AI-service provider validation pattern identified as a design smell was not refactored.

---

## 12. Locked Invariants

The following invariants must be preserved by all subsequent tasks:

- `assertSessionUsableOrThrow()` remains strict — it must not be weakened to accept unknown containers.
- Every valid container-manager session must have a corresponding local SQLite session row created at start time.
- `notifySessionStarted()` must not send a synthetic or fake `userId` to api-gateway.
- `InternalServiceAuthGuard` behavior must remain unchanged.
- Public session creation behavior must remain unchanged.
- `browserCapable` image selection logic must remain unchanged.
- The `internal-session-<sessionId>` owner string must never be sent to api-gateway.

---

## 13. Next Recommended Step

Resume AGENT-HARNESS-05B6C runtime `browser_smoke` validation.

With the DB row fix now in place, the `POST /api/internal/sessions/<id>/files` step that previously returned HTTP 404 should now succeed. The production compose stack must be running and healthy before retrying. No compose or Docker changes are required for the retry.
