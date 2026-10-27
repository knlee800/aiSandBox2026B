# SESSION-STALE-01 — Stage-start (Step 2)

**Task:** SESSION-STALE-01 — Do not reuse a session whose container is gone
**Date:** 2026-10-27. **Design approved by Keith:** option 2, end the session the first time it is used and retry the open once in a fresh session.
**Source:** defect D1 of the CLEAN-BASELINE-DEPLOY-01 C1 repeat (check 9); registration commits 3a72f5532f0abec5da46487614ee9b190216def6 and 9332bc1.

## Problem, as found in the source

- The container manager keeps its own SQLite record of each session and enforces limits only when a request arrives (no background worker). A terminated session, or one past its idle or lifetime limit, gets HTTP 410 with `(reason: <reason>)` in the message.
- The gateway already reconciles every 410: `ContainerManagerHttpClient.throwContainerManagerError` calls `reconcileSessionTerminationFromGone`, which takes the reason from the message and calls `SessionService.terminateSession` (status STOPPED, `terminatedAt`, `terminationReason`), then returns the 410 to the caller.
- A container that is missing or has exited (for example after a host reboot) never reaches that path. `DockerRuntimeService` throws a plain Error (`Container for session <id> is not running`, or not found), the container manager answers 500 and the gateway passes it on. Both stores keep the session active until it expires.
- The frontend reuses any session of a project that is neither terminated nor expired (`isUsableSession` in `workspace-shell.logic.ts`, used by `openProjectInFreshSession`), so every open of that project fails with Internal server error until the session expires (C1 repeat evidence c1r7-reopen-diag).

## Design (frozen)

1. **Container manager, `SessionsService`.** In each of the seven session operations (`execInContainer`, `readFileFromContainer`, `writeFileToContainer`, `deleteFileFromContainer`, `searchFilesInContainer`, `listDirectoryInContainer`, `statPathInContainer`), when the `DockerRuntimeService` call fails, check the session container state once. If the container is missing or not running and the session is not terminated: set `terminated_at` and `termination_reason = container_lost` (the same guarded UPDATE as the idle and lifetime paths), log the governance termination event, schedule the same container cleanup as those paths, clear the in-memory tracking, and throw `GoneException` with the message `Session <id> has been terminated (reason: container_lost)`. If the container is running, rethrow the original error unchanged. The success path makes no extra Docker call.
2. **Container manager, `DockerRuntimeService`.** Add `getSessionContainerState(sessionId)` returning `running`, `stopped` or `missing`, using the existing `sandbox-session-<id>` name lookup. A missing container is `missing`, not an error; a Docker daemon error still throws (and then the original operation error propagates, with no termination).
3. **Gateway.** No change. Its existing 410 reconciliation ends the Postgres session with `termination_reason = container_lost` and returns 410. No gateway notification is sent from the container manager, because the internal stop body accepts only `idle_timeout` and `max_lifetime` and stays unchanged.
4. **Frontend, `workspace-projects.logic.ts`.** The error thrown by `openWorkspaceProject` carries the HTTP status (the message is unchanged).
5. **Frontend, `open-project-in-fresh-session.ts`.** When the open into a reused session fails with status 410, create one fresh session and open the project into it once. Any other failure, or a 410 for a freshly created session, propagates as now. No new visible text.

## Contracts

No shared contract changes: no endpoint, DTO, internal route or response shape changes. `container_lost` is a new `termination_reason` value in both stores (free text in both), carried by the existing 410 semantics.

## Scope (frozen)

**Write scope, exactly:**

- `services/container-manager/src/sessions/sessions.service.ts`
- `services/container-manager/src/sessions/sessions.service.spec.ts`
- `services/container-manager/src/docker/docker-runtime.service.ts`
- `services/container-manager/src/docker/docker-runtime.service.spec.ts`
- `frontend/lib/open-project-in-fresh-session.ts`
- `frontend/lib/open-project-in-fresh-session.test.ts`
- `frontend/components/workspace/workspace-projects.logic.ts`
- `frontend/components/workspace/workspace-projects.logic.test.ts`

**Mutexes:** CONTAINER-MANAGER, FRONTEND. Not GATEWAY, I18N, MIGRATION, PACKAGE, COMPOSE, ENV, LOCAL-RUNTIME, STAGING, PROVIDER-LIVE or CREDIT.

**Gates:** in `services/container-manager`, `npm test` and `npm run build` (baseline 9 suites, 156 tests); in `frontend`, `npx tsc --noEmit`, `npm test` (baseline 781 tests) and `npm run build`, run one after another (not the typecheck during the build), with `frontend/tsconfig.tsbuildinfo` restored if the build changes it.

**Required tests:** a missing container and a stopped container each give 410 with `container_lost`, the SQLite termination, the governance event and the scheduled cleanup; a running container with a failing operation rethrows the original error; a session already terminated keeps its existing 410; the success path does not call `getSessionContainerState`; `getSessionContainerState` returns `running`, `stopped` and `missing`; `openWorkspaceProject` errors carry the status; a 410 on a reused session opens once in a fresh session; a 410 on a fresh session and a non-410 failure propagate with no retry.

**Not in scope:** the gateway, the internal endpoints and the stop body, a sweep at startup, restarting stopped containers, preview paths, the associate-only open path, any visible text or message file, session quota counting beyond ending a dead session on its first use, and the leftover debug fetch in `startSessionContainer`.

## Acceptance criteria, as revised with this design

The registered criterion that session quota counts are not inflated by dead sessions becomes: a dead session is ended the first time it is used; a dead session nobody touches still counts until it expires. The other registered criteria stand.

## Risks recorded

- A Docker daemon error during the state check leaves the session as it is and returns the original error; nothing is ended on uncertain information.
- Preview status polling of a dead session still fails until the session is ended by a session operation or expires; out of scope.
- An ended session is not revived even if its container is started again by hand, as ARCHITECTURE.md section 4 requires (no resurrection).

## Lifecycle

| Step | Record |
|---|---|
| 1. Registration | 3a72f5532f0abec5da46487614ee9b190216def6 and 9332bc1 (provisional scope) |
| 2. Stage-start | this document; ARCHITECTURE.md section 4 note; scope frozen and admitted to Lane 1 in Part 2 |
| 3. Implementation | Cursor CLI through cursor-delegate, in the frozen scope |
| 4. Consolidation and LOCK | checkpoint by the control plane; then CLEAN-BASELINE-DEPLOY-01 re-admission to redeploy and repeat checks 4 and 9 |
