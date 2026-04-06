# REL-02-01 CHECKPOINT - Deployment Rehearsal and Packaging

## Task Metadata

- Task ID: REL-02-01
- Title: Deployment Rehearsal and Packaging
- Nature: VALIDATION (RELEASE READINESS, DEPLOYMENT REHEARSAL)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-02-01-CHECKPOINT.md`

## Objective

Run one bounded deployment rehearsal from the validated runbook so the stack can be brought up, migrated, checked, and shut down in a reproducible prod-style flow.

## Authority Used

- `C:\Users\knlee\aiSandBox2026B\docs\REL-01-05-CHECKPOINT.md`

## Exact Commands / Actions / Checks Run

1. Prerequisite and startup order checks:
   - `docker ps --format "table {{.Names}}\t{{.Status}}"`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d postgres redis`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d api-gateway ai-service container-manager frontend`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps`
   - `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
2. Health/readiness checks:
   - `Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 20`
   - `Invoke-WebRequest -Uri "http://localhost:4000/api/health/db" -UseBasicParsing -TimeoutSec 20`
   - `Invoke-WebRequest -Uri "http://localhost:4000/api/health/ready" -UseBasicParsing -TimeoutSec 20`
3. Migration run/repro checks:
   - `npm run build` (working dir `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)
   - `npx typeorm migration:show -d dist/data-source.js` (initially without `DATABASE_URL`; failed)
   - `npx typeorm migration:run -d dist/data-source.js` (initially without `DATABASE_URL`; failed)
   - `DATABASE_URL=postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/aisandbox; npx typeorm migration:show -d dist/data-source.js` (failed: host connection refused)
   - `DATABASE_URL=postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/aisandbox; npx typeorm migration:run -d dist/data-source.js` (failed: host connection refused)
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" run --rm -e DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@postgres:5432/aisandbox" api-gateway npm run migration:run:prod` (PASS: no pending migrations)
4. Bounded smoke checks (runbook-aligned categories):
   - Unauthenticated gate check: `GET /api/sessions` -> `401`
   - Auth flow: `POST /api/auth/register`, `POST /api/auth/login`
   - Session/project/chat basics: `POST /api/sessions`, `POST /api/projects`, `POST /api/sessions/:id/messages`, `GET /api/sessions/:id/conversation`, `GET /api/conversations/:id/messages`
   - Usage/quota checks: `GET /api/users/me/usage`, `GET /api/users/me/quotas`
   - Public API flow: `POST /api/keys`, `POST /api/v1/ai/execute`, bounded polling `GET /api/v1/ai/executions/:executionId`
   - `GET /api/v1/docs` -> `200`
5. Shutdown/restart coherence:
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" down`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d postgres redis`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d api-gateway ai-service container-manager frontend`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps`
   - Poll health until ready:
     - `Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing`
     - `Invoke-WebRequest -Uri "http://localhost:4000/api/health/ready" -UseBasicParsing`
     - `Invoke-WebRequest -Uri "http://localhost:4000/api/v1/docs" -UseBasicParsing`
   - Final status capture:
     - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps`

## Startup Order Used

1. Docker daemon verification (`docker ps`)
2. Infrastructure up first (`postgres`, `redis`)
3. Application services up second (`api-gateway`, `ai-service`, `container-manager`, `frontend`)
4. Health/readiness checks (`/api/health`, `/api/health/db`, `/api/health/ready`)

## Migration Order Used

1. Validate migration tooling (`npm run build`, TypeORM CLI)
2. Execute production-style migration run using `docker compose ... run api-gateway npm run migration:run:prod`
3. Result: `No migrations are pending`

## Health Checks Performed

- `GET /api/health` -> `200`
- `GET /api/health/db` -> `200`
- `GET /api/health/ready` -> `200`
- Post-restart: `GET /api/health` -> `200`, `GET /api/health/ready` -> `200`

## Smoke Checks Performed

- Auth gate: unauthenticated session list returns `401`
- Auth/session/project/chat: PASS (`201/200` responses as expected)
- Usage/quota: PASS (`200`)
- Public API docs: PASS (`200`)
- Public execute/status path: PASS (`POST /api/v1/ai/execute` -> `202`; status lookup -> `200`)

## Shutdown / Restart Outcome

- `docker compose ... down` completed cleanly.
- Full restart sequence completed.
- Health/readiness restored (`/api/health` and `/api/health/ready` both `200`).
- Final compose state healthy/coherent (postgres and redis healthy; api-gateway healthy).

## Concrete Runbook Mismatches Found

1. **Local TypeORM CLI prerequisites are underspecified for prod-style compose path.**
   - Runbook examples use local `npx typeorm` with placeholder `DATABASE_URL`.
   - In this environment, localhost `5432` was not reachable from host for PostgreSQL.
   - Containerized migration run (`docker compose ... run api-gateway npm run migration:run:prod`) was required and worked.
2. **Auth token response shape differs from runbook example.**
   - Actual login response token field is `access_token` (not `accessToken`).
3. **API key creation payload/response differs from runbook example.**
   - `POST /api/keys` required `scopes` array.
   - Response returned `apiKey` (not `key`).
4. **Public API auth header differs from runbook example.**
   - `Authorization: Bearer <apiKey>` worked.
   - `X-API-Key` returned `401`.
5. **Public execute payload requires conversation ID in this environment.**
   - `POST /api/v1/ai/execute` required `conversationId` alongside `sessionId` and prompt.

## Reproducibility Verdict

- **PASS (with documented runbook mismatches).**
- Bounded deployment rehearsal objectives were met.
- The stack can be brought up, migrated, smoke-checked, shut down, and restarted coherently in a reproducible prod-style flow when using the validated command sequence above.
