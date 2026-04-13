# OPS-01-01 CHECKPOINT

## Task Metadata

- Task ID: OPS-01-01
- Title: Diagnose Accumulated Docker Session Containers
- Nature: BUG INVESTIGATION (RUNTIME CLEANUP, SESSION CONTAINERS)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/OPS-01-01-CHECKPOINT.md`

## Objective

Determine why many session-related Docker containers are accumulating, and identify whether they are expected stopped remnants, active leaked runtimes, or a cleanup/removal bug.

## Exact Commands / Actions / Checks Run

1. Read required governance/task/checkpoint context:
   - `CLAUDE.md`
   - `TASKS.md` (OPS-01 section)
   - `TASKS_BACKLOG_FULL.md` (OPS-01-01 entry)
   - `docs/REL-01-FINAL-CHECKPOINT.md`
   - `docs/PROJECT-FINAL-CLOSURE-CHECKPOINT.md`
2. Inspect Docker container runtime state:
   - `docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}"`
   - `docker ps --filter "name=sandbox-session-" --format "{{.Names}}" | Measure-Object | Select-Object -ExpandProperty Count`
   - `docker ps -a --filter "name=sandbox-session-" --format "{{.Names}}\t{{.Status}}"`
   - `(docker ps --filter "name=sandbox-session-" --format "{{.ID}}" | Measure-Object).Count`
   - `(docker ps -a --filter "name=sandbox-session-" --format "{{.ID}}" | Measure-Object).Count`
   - `(docker ps -a --filter "name=sandbox-session-" --filter "status=exited" --format "{{.ID}}" | Measure-Object).Count`
3. Inspect DB session state and map to running containers:
   - `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "select count(*) as total, count(*) filter (where terminated_at is null) as active, count(*) filter (where terminated_at is not null) as terminated from sessions;"`
   - `docker exec aisandbox-postgres printenv | Select-String "^POSTGRES_"`
   - PowerShell + SQL mapping for running container session ids:
     - `select status, count(*) ... where id in (<running-session-ids>) group by status`
     - `select id, status, terminated_at, termination_reason ... where id in (<running-session-ids>) and status <> 'active'`
4. Trace cleanup and lifecycle code paths:
   - `services/container-manager/src/docker/docker-runtime.service.ts`
   - `services/container-manager/src/sessions/sessions.service.ts`
   - `services/container-manager/src/sessions/sessions.controller.ts`
   - `services/container-manager/src/sessions/internal-sessions.controller.ts`
   - `services/container-manager/src/config/governance.config.ts`
   - `services/api-gateway/src/clients/container-manager-http.client.ts`
   - `services/api-gateway/src/sessions/session.controller.ts`
   - `services/api-gateway/src/sessions/session.controller.spec.ts`
   - `services/api-gateway/src/repositories/session.repository.ts`
   - `services/api-gateway/src/sessions/internal-session.controller.ts`

## Runtime Evidence (Current State)

- Session containers matching `sandbox-session-`:
  - Total: `26`
  - Running: `26`
  - Exited: `0`
- Age profile includes multi-day containers (`Up 2 days`, `Up 3 days`).
- DB evidence from `sessions` table:
  - Total sessions: `154`
  - `terminated_at IS NULL`: `130`
  - `terminated_at IS NOT NULL`: `24`
- Mapping running container names to DB sessions:
  - `status=active`: `21`
  - `status=stopped`: `5`
  - The 5 stopped sessions with still-running containers had `terminated_at` null.

## Naming / Session Mapping

- Container naming convention in code is explicit and deterministic:
  - `sandbox-session-${sessionId}` in `DockerRuntimeService.createContainer()`.
- Runtime names match UUID session ids and map cleanly to DB `sessions.id`.

## Intended Cleanup Behavior Found in Code

- Actual container stop+remove implementation exists:
  - `SessionsService.removeSessionContainer()`:
    1. resolve by naming convention
    2. stop if running
    3. remove container
- Cleanup is invoked in these container-manager flows:
  - `SessionsService.deleteSession()` (physical delete route in container-manager)
  - `checkAndEnforceIdleTimeout()` (request-driven enforcement)
  - `checkAndEnforceMaxLifetime()` (request-driven enforcement)

## Exact Remaining Issue Identified

The accumulation is **not** benign stopped remnants; it is an active runtime cleanup gap in the normal API flow:

1. API Gateway user stop path calls container-manager `POST /api/sessions/:id/stop`.
2. Container-manager `SessionsController.stop()` delegates to `SessionsService.stopSession()`.
3. `SessionsService.stopSession()` updates DB status and tracking only; it does **not** stop/remove Docker containers.
4. API Gateway delete/terminate path intentionally does not call physical delete (`containerManagerHttpClient.deleteSession`), and tests explicitly assert this behavior.
5. Therefore, sessions can become `stopped`/terminated in API state while Docker containers remain running and accumulate.

Additional behavior note:
- Idle/max-lifetime cleanup in container-manager is request-driven, not background-driven, so no periodic orphan sweep is present.
- That mechanism does not correct the manual stop/terminate path gap above.

## Conclusion

- Classification: **running containers are leaking/left running due to cleanup step being skipped in current stop/terminate wiring**.
- Issue is narrowed to one bounded follow-up fix task:
  - make stop/terminate path trigger actual container stop (and, if policy requires, remove) while preserving current session-record semantics.
