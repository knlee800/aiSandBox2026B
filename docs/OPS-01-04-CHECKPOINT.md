# OPS-01-04 CHECKPOINT

## Task Metadata

- Task ID: OPS-01-04
- Title: Fix Stop Session Returning 500 After Successful Cleanup
- Nature: BUG FIX (RUNTIME CLEANUP, API RESPONSE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/OPS-01-04-CHECKPOINT.md`

## Objective

Fix `POST /api/sessions/:id/stop` so it returns success when cleanup succeeds, instead of returning 500 after container removal and DB status update.

## Root Cause

- `api-gateway` calls container-manager stop via `ContainerManagerHttpClient.stopSession()`.
- That client used the axios default timeout (`10s`).
- On Windows, session stop can take longer because physical stop/remove runs in the stop flow (OPS-01-02).
- Result: cleanup completed and DB became `stopped`, but `api-gateway` timed out waiting on container-manager and returned `500`.

## Fix Applied

File changed:

- `services/api-gateway/src/clients/container-manager-http.client.ts`

Change:

- Added `timeout: 30000` to `stopSession()` request options.
- Kept all existing stop semantics intact.
- Scope stayed at the smallest safe boundary (API response path only).

## Validation Run

### 1) Focused controller regression safety

Command:

- `cd services/api-gateway`
- `npm test -- src/sessions/session.controller.spec.ts`

Result:

- PASS (25/25 tests)

### 2) Build/type safety

Command:

- `cd services/api-gateway`
- `npm run build`

Result:

- PASS

### 3) Live stack verification (real API flow)

Preparation:

- Rebuilt/restarted running api-gateway container so live stack uses fix:
  - `docker compose -f docker-compose.prod.yml build api-gateway`
  - `docker compose -f docker-compose.prod.yml up -d api-gateway`

Stop-path verification:

- Create fresh session via `POST /api/sessions`:
  - `STOP_VERIFY_SESSION=eca4da00-53bf-4f17-bf57-1f7bc03a1bd7`
- Before stop:
  - `STOP_VERIFY_CONTAINER_BEFORE=sandbox-session-eca4da00-53bf-4f17-bf57-1f7bc03a1bd7  Up 1 second`
- Call `POST /api/sessions/:id/stop`:
  - `STOP_VERIFY_API_STATUS=success`
  - `STOP_VERIFY_API_MESSAGE=Session stopped successfully`
- After stop:
  - `STOP_VERIFY_CONTAINER_AFTER=` (container gone)
- DB state:
  - `STOP_VERIFY_DB_STATUS=stopped`

Terminate-path intact verification:

- Create fresh session via `POST /api/sessions`:
  - `TERM_VERIFY_SESSION=29593990-8394-484a-8fb7-8fc2f17a99f3`
- Before terminate:
  - `TERM_VERIFY_CONTAINER_BEFORE=sandbox-session-29593990-8394-484a-8fb7-8fc2f17a99f3  Up 1 second`
- Call `DELETE /api/sessions/:id`:
  - `TERM_VERIFY_API_STATUS=success`
  - `TERM_VERIFY_API_MESSAGE=Session terminated successfully`
- After terminate:
  - `TERM_VERIFY_CONTAINER_AFTER=` (container gone)
- DB state:
  - `TERM_VERIFY_DB_STATUS=stopped;TERMINATED_AT=2026-04-15T03:04:46.055+00:00`

## Scope / Invariants Check

- Physical container cleanup behavior preserved.
- DB/session stopped semantics preserved.
- Terminate path remains intact.
- No cleanup redesign, no broad ops redesign, no scope expansion.
