# AGENT-HARNESS-05B6C — Checkpoint

**Task ID:** AGENT-HARNESS-05B6C
**Title:** Production Compose Browser Smoke Runtime Validation
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-26
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Nature:** RUNTIME VALIDATION / PRODUCTION COMPOSE / BROWSER_SMOKE

---

## Summary

Full end-to-end browser_smoke validation against the live production compose stack passed on 2026-06-26.
All 17 validation steps completed successfully. Production compose remained healthy throughout.
Test session and container were created and cleaned up. No source files were modified.

---

## Original Partial Failure Context

AGENT-HARNESS-05B6C initially attempted to validate browser_smoke against the production compose stack.
The first attempt partially succeeded (health checks, session start, container creation, NODE_PATH) but
failed at the file-write step:

```
POST http://localhost:4002/api/internal/sessions/05b6c-smoke-test/files
→ HTTP 404: {"message":"Session 05b6c-smoke-test not found","error":"Not Found","statusCode":404}
```

Root cause: `startSessionContainer()` created the Docker container but did not insert a SQLite session
row when `userId` was omitted. Downstream `assertSessionUsableOrThrow()` failed to find the row.

This failure was resolved by AGENT-HARNESS-05B6D (commit 3477b27).
05B6C was paused and resumed after 05B6D was committed and the production container-manager was rebuilt.

---

## Dependency on AGENT-HARNESS-05B6D Fix

- **05B6D fix:** `startSessionContainer()` now always ensures a SQLite session row exists before
  proceeding, using an `internal-session-<sessionId>` owner when `userId` is omitted.
- **Commit:** 3477b27 (committed 2026-06-26)
- **Confirmation:** `aisandbox-container-manager` container started at 07:20:49 UTC on 2026-06-26,
  after the 05B6D fix was committed. No rebuild was required during 05B6C retry — the image was
  already current.
- **Running container-manager confirmed to include 05B6D fix** based on start timestamp and git state.

---

## Runtime Validation Steps and Results

| # | Step | Result |
|---|------|--------|
| 1 | `docker ps` — 7 healthy aisandbox-* containers | PASS |
| 2 | GET http://localhost:4000/api/health | HTTP 200 |
| 3 | GET http://localhost:4002/api/health | HTTP 200 |
| 4 | INTERNAL_SERVICE_KEY read from .env (masked) | OK |
| 5 | GET http://localhost:4002/api/internal/stats via Node.js | HTTP 200 — `{"dockerConnectivity":true,"runningContainerCount":8}` |
| 6 | No prior sandbox-session-05b6c-smoke-test container existed | Confirmed |
| 7 | Running container-manager image/start time/git state confirmed 05B6D fix present | Confirmed |
| 8 | POST http://localhost:4002/api/internal/sessions/05b6c-smoke-test/start | HTTP 200 — `{"message":"Session container started successfully"}` |
| 9 | docker inspect confirmed sandbox-session-05b6c-smoke-test running aisandbox-workspace-browser:local | Confirmed |
| 10 | docker exec printenv NODE_PATH | `/opt/browser-smoke/node_modules` |
| 11 | POST http://localhost:4002/api/internal/sessions/05b6c-smoke-test/files | HTTP 204 |
| 12 | POST http://localhost:4002/api/internal/sessions/05b6c-smoke-test/exec | HTTP 200 — `{"exitCode":0,"stdout":"Preview server running on port 3000\n","stderr":""}` |
| 13 | In-container HTTP check to http://localhost:3000 | HTTP 200 — `<html><head><title>05B6C Smoke</title></head><body><h1>Hello from 05B6C</h1></body></html>` |
| 14 | POST http://localhost:4002/api/internal/sessions/05b6c-smoke-test/previews | HTTP 200 — `{"sessionId":"05b6c-smoke-test","port":3000,"registered":true}` |
| 15 | POST http://localhost:4000/api/internal/workspace/05b6c-smoke-test/browser-smoke | HTTP 200 — see full response below |
| 16 | Cleanup: session stopped and removed | Complete — no production services touched |
| 17 | Final production compose status | All 7 production services remained running and healthy |

---

## Full browser_smoke Response (Step 15)

```json
{
  "success": true,
  "url": "http://172.17.0.2:3000/",
  "pageTitle": "05B6C Smoke",
  "consoleErrors": [],
  "consoleWarnings": [],
  "networkErrors": [],
  "visibleTextSnippet": "Hello from 05B6C",
  "durationMs": 1722,
  "truncated": false
}
```

---

## PASS Criteria

| Criterion | Expected | Actual | Result |
|-----------|----------|--------|--------|
| success | true | true | PASS |
| pageTitle | "05B6C Smoke" | "05B6C Smoke" | PASS |
| visibleTextSnippet contains | "Hello from 05B6C" | "Hello from 05B6C" | PASS |
| consoleErrors | empty | [] | PASS |
| networkErrors | empty | [] | PASS |
| durationMs | > 0 | 1722 | PASS |
| truncated | false | false | PASS |

**Final verdict: PASS**

---

## Cleanup Actions

- `sandbox-session-05b6c-smoke-test` container stopped and removed.
- No Docker images removed.
- No volumes removed.
- No production services touched.

---

## Final Production Compose Health

All 7 production `aisandbox-*` containers remained running and healthy after validation and cleanup.

---

## Confirmations / Non-Goals

- No source/runtime/test/package/Docker/frontend/database files were changed during 05B6C or this consolidation.
- `.env` was not modified.
- No fixes were applied during the 05B6C retry (fix was already committed in 05B6D).
- ai-service provider/model execution was not run.
- Production compose was not restarted.
- browser_smoke was not rerun during consolidation.
- No git commit/push during consolidation.

---

## Non-Blocking Observation — Windows PowerShell HTTP Client 403

During validation, Windows PowerShell HTTP clients (`Invoke-RestMethod`, `Invoke-WebRequest`) returned
HTTP 403 for internal endpoints requiring the `X-Internal-Service-Key` header, while the same requests
made via Node.js returned HTTP 200 with identical headers and key.

This is a non-blocking observation. The likely cause is a difference in how PowerShell HTTP clients
serialize or transmit custom headers on Windows. All functional validation was completed via Node.js.

**Recommended action:** Register a follow-up task to document or investigate the Windows PowerShell
HTTP client header behavior for internal service endpoints. Treat as low-priority informational work.

---

## Locked Invariants

- AGENT-HARNESS-05B6C is COMPLETE and LOCKED as of 2026-06-26.
- browser_smoke end-to-end validation through production compose is confirmed passing.
- The 05B6D fix (commit 3477b27) is confirmed present in the running production container-manager.
- Production compose stack health was preserved throughout.
- No source or configuration files were modified during this task.
- These results must not be altered except for explicitly approved documentation correction.

---

## Next Recommended Task

After Keith review:
- Register the next Agent Harness follow-up task (e.g., ai-service provider/model execution validation
  against the production compose stack, or Windows PowerShell HTTP client 403 investigation).
- Do not proceed to the next task without explicit review and registration.

---

**Reference:** TASKS.md → AGENT-HARNESS-05B6C | TASKS_BACKLOG_FULL.md → AGENT-HARNESS-05B6C
