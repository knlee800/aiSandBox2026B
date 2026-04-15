# OPS-01-03 CHECKPOINT

## Task Metadata

- Task ID: OPS-01-03
- Title: Verify Session Container Cleanup After Stop Terminate Fix
- Nature: BUG INVESTIGATION (RUNTIME CLEANUP, POST-FIX VERIFICATION)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/OPS-01-03-CHECKPOINT.md`

## Objective

Determine whether remaining `sandbox-session-*` containers are pre-fix leftovers/historical residue or whether new sessions are still accumulating after OPS-01-02.

## Exact Commands / Actions / Checks Run

1) Read required context:
- `CLAUDE.md`
- `TASKS.md` (OPS-01 section)
- `TASKS_BACKLOG_FULL.md` (OPS-01 section)
- `docs/OPS-01-01-CHECKPOINT.md`
- `docs/OPS-01-02-CHECKPOINT.md`

2) Confirm normal stop/terminate API flow wiring:
- inspected `services/api-gateway/src/sessions/session.controller.ts`
  - `POST /api/sessions/:id/stop`
  - `DELETE /api/sessions/:id`

3) Baseline Docker state:
- command block captured:
  - `docker ps -a --filter "name=sandbox-session-" --format "{{.ID}}" | Measure-Object`
  - `docker ps --filter "name=sandbox-session-" --format "{{.ID}}" | Measure-Object`
  - `docker ps -a --filter "name=sandbox-session-" --format "{{.Names}}\t{{.CreatedAt}}\t{{.Status}}" | Select-Object -First 10`
- observed:
  - `BEFORE_TOTAL=15`
  - `BEFORE_RUNNING=15`

4) Fresh post-fix stop and terminate verification (real API path):
- create fresh session A via `POST /api/sessions`
- verify container exists
- stop via `POST /api/sessions/:id/stop`
- verify container presence after stop
- create fresh session B via `POST /api/sessions`
- verify container exists
- terminate via `DELETE /api/sessions/:id`
- verify container presence after terminate
- observed:
  - stop case:
    - `STOP_CASE_SESSION=7a7c2d25-aef8-49ac-af28-3b91b825cfda`
    - `STOP_CASE_CONTAINER_BEFORE=sandbox-session-7a7c2d25-aef8-49ac-af28-3b91b825cfda (Up 1 second)`
    - API response: `500` (empty body in PowerShell capture)
    - `STOP_CASE_CONTAINER_AFTER=` (container no longer present)
  - terminate case:
    - `TERM_CASE_SESSION=130379c6-7fd9-48c5-a9da-2994e3637626`
    - `TERM_CASE_CONTAINER_BEFORE=sandbox-session-130379c6-7fd9-48c5-a9da-2994e3637626 (Up 1 second)`
    - API response: success (`Session terminated successfully`)
    - `TERM_CASE_CONTAINER_AFTER=` (container no longer present)
  - aggregate counts after both cycles:
    - `POST_CHECK_TOTAL=15`
    - `POST_CHECK_RUNNING=15`

5) DB verification for fresh sessions:
- `select id,status,terminated_at,termination_reason from sessions where id in (...)`
- observed:
  - `7a7c2d25-aef8-49ac-af28-3b91b825cfda` -> `status=stopped`
  - `130379c6-7fd9-48c5-a9da-2994e3637626` -> `status=stopped`, `terminated_at` set, `termination_reason=manual`

6) Running-container-to-DB mapping:
- mapped all currently running `sandbox-session-*` IDs to DB statuses
- observed:
  - `active | 15`
  - no `stopped`/`terminated` sessions currently retaining running containers

## Evidence Summary

- Fresh post-fix session containers are physically removed for both tested paths (stop and terminate).
- Global `sandbox-session-*` counts remained unchanged after create+cleanup cycles, indicating no net new accumulation.
- Remaining running containers map to `active` sessions only in current state.

## Exact Issue / Expected Behavior Identified

1) **Primary OPS-01-03 question (leakage)**
- Result: **no ongoing post-fix container accumulation was reproduced**.
- Classification: remaining containers are consistent with already-active sessions/historical residue, not newly leaking stop/terminate flows from this verification run.

2) **Secondary observed behavior (non-blocking for OPS-01-03 objective)**
- `POST /api/sessions/:id/stop` returned `500` during fresh test while still resulting in physical container removal and `status=stopped` in DB.
- This suggests an API response-path issue may still exist, but it did not produce container leakage in this run.

## Conclusion

OPS-01-03 objective is satisfied: verified distinction is clear for current runtime evidence.
- Remaining accumulation appears historical/current-active-session residue.
- New post-fix stop/terminate cycles did not add leaked containers.
