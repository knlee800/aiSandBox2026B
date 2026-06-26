# AGENT-HARNESS-05B6A Checkpoint

**Task ID:** AGENT-HARNESS-05B6A
**Title:** Production Compose Startup Config Fix
**Status:** COMPLETE and LOCKED
**Checkpoint created:** 2026-06-26
**Nature:** CONFIG FIX / DOCKER COMPOSE / STARTUP ENV / HEALTH ROUTE / ENV DOCUMENTATION

---

## Dependencies and Prior Context

**AGENT-HARNESS-05B5** — COMPLETE and LOCKED (browser_smoke service-chain validation PASS).

**AGENT-HARNESS-05B6** — Registration/investigation task. Read-only review of production Docker Compose startup. Identified three startup blockers that this task (05B6A) was registered to fix. 05B6 remains ACTIVE as its parent investigation task; 05B6A is the bounded implementation slice derived from it.

---

## Problem Statement

AGENT-HARNESS-05B6 investigation identified three likely low-risk production startup blockers:

1. **api-gateway restart loop on production** — `LAUNCH_STATE` is required by `LaunchConfig.initialize()` but was not wired into `docker-compose.prod.yml`. Without it, api-gateway exits immediately on startup in production/staging. The root `.env.example` also did not document all required production keys and contained stale/incorrect provider examples.

2. **container-manager has no host port mapping in production compose** — `docker-compose.prod.yml` had no `ports` entry for the container-manager service, so operators cannot reach `localhost:4002` from the host for health checks or debugging. Container-to-container traffic was unaffected (Docker service name routing still works).

3. **container-manager startup log advertises `GET /api/health` but that route did not exist** — The startup log printed `http://localhost:4002/api/health` as the liveness URL, but container-manager had no such route. The actual working readiness endpoint was `GET /api/internal/stats`, which is guarded by `InternalServiceAuthGuard`. This mismatch meant operator health checks against the advertised URL would fail with 404.

---

## Architecture and Security Review Summary

### LAUNCH_STATE wiring (api-gateway)

`LAUNCH_STATE` is a fail-fast required startup value for api-gateway. The correct Docker Compose env wiring is:
```yaml
LAUNCH_STATE: ${LAUNCH_STATE:?LAUNCH_STATE is required for production startup (CLOSED|INTERNAL|EARLY_ACCESS|PUBLIC)}
```
Using `${VAR:?message}` (error-out form) rather than `${VAR:-default}` (silent default form) is intentional: an operator must explicitly set a valid `LAUNCH_STATE`. Silently defaulting to `INTERNAL` on a production compose would allow misconfigured deployments to proceed unnoticed. The fail-fast form causes `docker compose config` to reject the config if the variable is absent, which is the correct behavior.

### container-manager host port mapping

The loopback-only binding `127.0.0.1:4002:4002` was chosen over `0.0.0.0:4002:4002` (all interfaces). This restricts host access to the local machine only, preventing external exposure of the container-manager management port. Container-to-container service URL `http://container-manager:4002` is unchanged.

### container-manager health route

A minimal public `GET /api/health` liveness route was added to container-manager. The decision was to add a real route rather than update the startup log because:
- The advertised endpoint becomes real and testable.
- The route returns only `{ status, service, timestamp }` — no Docker connectivity state, no container counts, no workspace paths, no environment variables, no secrets.
- No guard is applied (public liveness endpoint, consistent with Docker Compose healthcheck use and operator tooling expectations).
- `/api/internal/stats` remains guarded and unchanged.

### AI_PROVIDER example correction

The root `.env.example` had `AI_PROVIDER=stub` in the production-required section. The `provider.validator` in the codebase confirms `stub` is explicitly development-only and will throw in production/staging. The example was corrected to `AI_PROVIDER=anthropic` with a note that valid production values are `openai`, `anthropic`, `groq`, `xai`, `deepseek`.

### Security posture

- No real secrets introduced in any file.
- `.env.example` files contain placeholders only.
- Production compose does not hardcode any API keys or service keys.
- `INTERNAL_SERVICE_KEY` remains a required env variable shared by internal services.
- No public auth, session, OAuth, or routing behavior changed.
- No internal service auth guard behavior changed.
- No preview/browser URL behavior changed.

---

## Exact Files Changed

All implementation changes were made during the implementation step. No source files were changed during this consolidation step.

**1. `docker-compose.prod.yml`** (repository root)
- Added `LAUNCH_STATE` fail-fast env wiring to api-gateway service environment block.
- Added loopback-only host port mapping `127.0.0.1:4002:4002` to container-manager service.
- Added Docker Compose healthcheck to container-manager service using `GET http://localhost:4002/api/health`.

**2. `.env.example`** (repository root)
- Added `LAUNCH_STATE=INTERNAL` with valid values documented (`CLOSED`, `INTERNAL`, `EARLY_ACCESS`, `PUBLIC`).
- Added note that `LIMITED_AVAILABILITY` is not a valid value.
- Corrected `AI_PROVIDER` example from `AI_PROVIDER=stub` to `AI_PROVIDER=anthropic`.
- Added valid production provider values: `openai`, `anthropic`, `groq`, `xai`, `deepseek`.
- Documented that `stub` is local-development-only and not allowed in production.
- Replaced stale `CLAUDE_API_KEY` example with `ANTHROPIC_API_KEY`.
- Added provider key placeholders: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`.
- Documented current production startup behavior: both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` must be non-empty at startup even if only one provider is selected (design smell, see out-of-scope items).
- Fixed `REDIS_URL` to use `redis` service name rather than `localhost`.
- Added/kept placeholders for: `INTERNAL_SERVICE_KEY`, `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `JWT_SECRET`, `APP_BASE_URL`.

**3. `services/api-gateway/.env.example`**
- Replaced invalid `LAUNCH_STATE=LIMITED_AVAILABILITY` with `LAUNCH_STATE=INTERNAL`.
- Added valid values comment: `CLOSED`, `INTERNAL`, `EARLY_ACCESS`, `PUBLIC`.
- Added note that `LIMITED_AVAILABILITY` is not a valid value.

**4. `services/container-manager/src/health/health.controller.ts`** (new file)
- Created `HealthController` with a single public `GET /` route registered at path `health` (resolves to `/api/health` via global prefix).
- Response shape: `{ status: 'ok', service: 'container-manager', timestamp: '<ISO timestamp>' }`.
- No guard applied. No Docker connectivity, container counts, workspace paths, env, config, or secrets exposed.

**5. `services/container-manager/src/app.module.ts`**
- Added `import { HealthController } from './health/health.controller';`.
- Added `HealthController` to the `controllers` array of `AppModule`.

**Governance files changed during consolidation only:**
- `docs/AGENT-HARNESS-05B6A-CHECKPOINT.md` (this file — created)
- `TASKS.md` (AGENT-HARNESS-05B6A entry updated to COMPLETE and LOCKED)
- `TASKS_BACKLOG_FULL.md` (AGENT-HARNESS-05B6A entry mirrored)

---

## Implementation Summary

### docker-compose.prod.yml changes

**api-gateway environment block addition:**
```yaml
LAUNCH_STATE: ${LAUNCH_STATE:?LAUNCH_STATE is required for production startup (CLOSED|INTERNAL|EARLY_ACCESS|PUBLIC)}
```

**container-manager ports addition:**
```yaml
ports:
  - "127.0.0.1:4002:4002"
```

**container-manager healthcheck addition:**
```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:4002/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

### container-manager health route

`services/container-manager/src/health/health.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'container-manager',
      timestamp: new Date().toISOString(),
    };
  }
}
```

Registered in `AppModule` controllers array. No guard. No sensitive data returned.

### AI_PROVIDER correction

Before (removed from root `.env.example`):
```
AI_PROVIDER=stub
```

After (in root `.env.example`):
```
AI_PROVIDER=anthropic
```

`stub` was removed from the production-required section and documented as development-only. This correction was made after initial implementation, before consolidation. `docker compose -f docker-compose.prod.yml config --quiet` was re-validated after the correction.

---

## Security Impact

- No real secrets committed.
- All `.env.example` values are placeholders.
- `LAUNCH_STATE` fail-fast wiring prevents silent misconfiguration on production.
- Loopback-only binding (`127.0.0.1`) prevents external exposure of container-manager host port.
- Health route returns only liveness status with no sensitive system information.
- `/api/internal/stats` remains guarded by `InternalServiceAuthGuard` — unchanged.
- No public auth, session, OAuth, CSRF, or internal guard behavior changed.
- No `X-Internal-Service-Key` behavior changed.
- No preview proxy or browser URL behavior changed.

---

## Validation Commands and Results

**1. docker compose config syntax validation (initial):**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"
docker compose -f docker-compose.prod.yml config --quiet
```
Result: **exit 0** — config valid.

**2. container-manager TypeScript check:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"
npx tsc --noEmit
```
Result: **exit 0** — no TypeScript errors.

**3. container-manager full test suite:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"
npm test
```
Result: **exit 0 — 8 suites, 90 tests passed.**

**4. docker compose config syntax validation (after AI_PROVIDER correction):**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"
docker compose -f docker-compose.prod.yml config --quiet
```
Result: **exit 0** — config valid after correction.

**api-gateway tests:** Not run. Only `services/api-gateway/.env.example` changed for api-gateway — no api-gateway runtime code was modified. `.env.example` is not a compiled artifact and does not affect api-gateway test execution.

---

## AI_PROVIDER Correction Note

After initial implementation, a correction was applied before this consolidation. The root `.env.example` originally contained `AI_PROVIDER=stub` in the production-required section. Review of `provider.validator` confirmed `stub` is explicitly a development-only value and will throw in production. The example was updated to `AI_PROVIDER=anthropic`. The previous `AI_PROVIDER=stub` entry was removed from the production section entirely. `docker compose config` was re-validated after the correction and passed with exit 0.

---

## Confirmations and Non-Goals

- No `docker compose up/down/start/stop` commands run.
- No container start/stop/remove commands run.
- No real secrets added to any file.
- No frontend files changed.
- No package dependencies changed (`package.json`, `package-lock.json` unchanged).
- No userId / SQLite FK behavior changed.
- No workspace volume / Docker-in-Docker strategy changed.
- No browser_smoke behavior changed.
- No preview proxy behavior changed.
- No internal service auth behavior changed (guards, keys, routes).
- No public auth/session/OAuth behavior changed.
- No debug telemetry changed.
- No ai-service runtime validation run.
- No git commit/push performed.
- No actual `docker compose up` runtime validation performed.

---

## Remaining Out-of-Scope Items

The following issues were identified but deliberately excluded from this task's scope:

1. **userId / SQLite FK behavior** — Not addressed. Requires a separate task and investigation.

2. **Workspace volume / Docker-in-Docker host-path strategy** — Not addressed. The production DinD volume mount strategy requires a separate architecture decision and task.

3. **Debug telemetry cleanup** — Not addressed. Any telemetry-related cleanup is a separate task.

4. **Provider validator design smell: both ANTHROPIC_API_KEY and OPENAI_API_KEY must be non-empty at startup even if only one provider is selected** — Documented in `.env.example` but not fixed. The provider validator currently requires both keys to be non-empty at startup regardless of which provider is selected. This is a design smell in the validator logic. Fixing it requires a separate task targeting the provider validator.

5. **Actual docker compose up runtime validation** — Not run. Runtime validation of the production compose requires operator approval from Keith, a real root `.env` file with all secrets/placeholders filled appropriately, and Docker Desktop running. This validation is explicitly deferred pending that approval.

---

## Locked Invariants

The following invariants are established and must not be changed without explicit task authorization:

- `LAUNCH_STATE` is a fail-fast required env variable for api-gateway in production. The `${VAR:?message}` form must be preserved.
- container-manager host port mapping is loopback-only (`127.0.0.1:4002:4002`). Do not change to `0.0.0.0` without explicit security review and approval.
- container-manager `/api/health` returns only `{ status, service, timestamp }`. Do not add Docker state, container counts, workspace paths, env vars, or secrets to this route.
- `/api/internal/stats` remains guarded by `InternalServiceAuthGuard`. Do not make it public.
- Container-to-container service URL remains `http://container-manager:4002`. Do not change to `localhost` in inter-service config.
- `.env.example` files must contain placeholders only. No real secrets.
- `AI_PROVIDER=stub` must not appear in production documentation or production env examples.

---

## Next Recommended Step

**Runtime docker compose validation** requires Keith approval and a real root `.env` file with all production secrets/placeholders filled appropriately.

Recommended sequence for runtime validation (pending Keith approval):

1. Keith reviews and approves a runtime validation plan.
2. Operator creates a root `.env` file at `C:\Users\knlee\aiSandBox2026B\.env` with valid values for all required keys documented in `.env.example`.
3. Run: `docker compose -f docker-compose.prod.yml up --build` (or relevant subset of services).
4. Verify api-gateway starts without restart loop.
5. Verify container-manager `/api/health` responds `200 OK` from host on `localhost:4002`.
6. Verify container-to-container service resolution is intact.
7. Document results in a follow-up checkpoint.

Do not begin runtime validation without explicit Keith approval and a confirmed `.env` file.

---

**Lock notice:** AGENT-HARNESS-05B6A is COMPLETE and LOCKED. Do not modify this checkpoint. Do not reopen or re-implement without explicit approval.
