# TASK-CLEANUP-74C-2-001 Checkpoint — Debug Fetch Instrumentation Artifact Removal

**Status:** COMPLETE and LOCKED
**Task ID:** TASK-CLEANUP-74C-2-001
**Family:** CLEANUP
**Completed:** 2026-05-24
**Checkpoint doc:** `docs/TASK-CLEANUP-74C-2-001-CHECKPOINT.md`
**Depends on:** Phase 74 COMPLETE and LOCKED; Gap-74C-2-001 triage complete

---

## Objective

Remove 3 hardcoded fire-and-forget `fetch('http://127.0.0.1:7870/ingest/...')` debug instrumentation calls from `execInSession` in `session.controller.ts`, along with their associated `#region agent log` / `#endregion` comment blocks. Add a regression test confirming the user-facing exec route makes no external fetch calls.

---

## Root Cause / Risk Summary

Phase 74 left 3 live debug instrumentation calls inside `execInSession` — the user-facing `POST /api/sessions/:id/exec` handler. These calls serialized user command data (sessionId, userId, command text, stdout/stderr lengths, error details) to a hardcoded localhost port (`127.0.0.1:7870`) on every exec request. If any process happened to be listening on that port, user data would be transmitted. The instrumentation was non-conditional, non-flagged, and not part of any approved telemetry design.

**Risk categorization:** Low implementation risk to remove; Medium production hygiene risk to leave in place.

---

## Exact Files Changed

### Production source files

- `services/api-gateway/src/sessions/session.controller.ts` — removed all 3 `fetch('http://127.0.0.1:7870/ingest/...')` fire-and-forget call blocks and their enclosing `#region agent log` / `#endregion` comment blocks from `execInSession`; all other execution logic preserved exactly

### Test files

- `services/api-gateway/src/sessions/session.controller.spec.ts` — added one test `"does not make external fetch calls"` inside the existing PHASE-77A exec `describe` block

---

## Removal Summary

Three instrumentation blocks were removed from `execInSession`:

1. **Pre-exec log block** — `#region agent log` block that called `fetch('http://127.0.0.1:7870/ingest/exec-start', ...)` with `{ sessionId, userId, command }` before forwarding to container manager.
2. **Post-exec log block** — `#region agent log` block that called `fetch('http://127.0.0.1:7870/ingest/exec-result', ...)` with `{ sessionId, stdout length, stderr length, exitCode }` on success.
3. **Error log block** — `#region agent log` block that called `fetch('http://127.0.0.1:7870/ingest/exec-error', ...)` with `{ sessionId, error message }` inside the catch handler.

All three were fire-and-forget (no `await`, no error handling on the fetch itself). Their removal has zero effect on exec request/response behavior, error propagation, or controller return shape.

**Preserved exactly:**
- Ownership check
- Terminated-session guard
- Command validation
- `containerManagerClient.execInSession` call
- Return shape
- Error rethrow behavior

---

## Regression Test Summary

**File:** `services/api-gateway/src/sessions/session.controller.spec.ts`

**Test:** `"does not make external fetch calls"` (inside existing PHASE-77A exec `describe` block)

**Approach:**
- Spies on `global.fetch`
- Mocks active session (`session-1`, owner `user-1`)
- Mocks successful `containerManagerClient.execInSession`
- Calls `controller.execInSession('session-1', 'echo hello', { user: { userId: 'user-1' } })`
- Asserts `global.fetch` was not called
- Restores spy

---

## Validation Results

All validation run from `C:\Users\knlee\aiSandBox2026B\services\api-gateway`.

| Check | Result |
|---|---|
| `npx jest session.controller --no-coverage` | PASS — 34 tests, 1 suite, 0 failed |
| `npm run build` | PASS — tsc completed successfully |
| ReadLints on touched files | PASS — no linter errors |

---

## Non-Goals Confirmed

The following were explicitly out of scope and were not touched:

- No replacement telemetry or structured logging introduced
- No telemetry redesign
- No environment flag added
- No new dependencies added
- No endpoint changes (`POST /api/sessions/:id/exec` route preserved as-is)
- No DTO or schema changes
- No frontend changes
- No TASK-75A work
- No Phase 74 reopening
- No other files modified beyond the two primary files

---

## Invariants Preserved

- `execInSession` execution flow is identical before and after — only the fire-and-forget fetch side-effects were removed
- All existing exec route tests continue to pass (34 tests, 0 failed)
- No locked tasks were modified
- No production source files were modified during this consolidation step
- Internal service key behavior, guards, auth flows, and session lifecycle semantics are unchanged

---

## Next Recommended Task

Gap-74C-2-001 is now fully remediated. The CLEANUP family may be considered current. Any follow-on structured observability or telemetry work (replacing the removed debug instrumentation with a proper approved telemetry pattern) should be registered as a new task under an appropriate family before implementation begins.
