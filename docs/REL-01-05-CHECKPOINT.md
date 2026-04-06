# REL-01-05 CHECKPOINT - Operational Runbook Update

## Task Metadata

- Task ID: REL-01-05
- Title: Operational Runbook Update
- Nature: DOCUMENTATION (RELEASE READINESS, OPERATIONAL RUNBOOK)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-05-CHECKPOINT.md`

---

# AI Sandbox Platform — Operational Runbook

## 1. Purpose and Scope

This runbook consolidates the validated operational assumptions from REL-01-01, REL-01-02, and REL-01-03 into concise startup, migration, health-check, and recovery procedures.

- **Intended users:** operators bringing up the local/prod-style stack, running migrations, or recovering from known failure modes.
- **Scope:** current validated stack only. Does not cover deployment automation, release packaging, or speculative ops changes.

---

## 2. Prerequisites

### Docker / Desktop

- Docker Desktop must be running and daemon-responsive before any compose or container commands.
- Verify: `docker ps` responds without hanging.
- If unresponsive: see [Recovery — Docker daemon unavailable](#docker-daemon-unavailable).

### Required Files

Before startup, ensure the following files exist and are populated:

| File | Purpose |
|------|---------|
| `C:\Users\knlee\aiSandBox2026B\.env` | Runtime environment for all services (loaded by compose) |
| `C:\Users\knlee\aiSandBox2026B\.env.prod` | Production-style runtime env (used with `docker-compose.prod.yml`) |

Template references (do **not** use directly — copy and fill in real values):

- `.env.example` — dev baseline template
- `.env.prod.example` — production baseline template
- `services/api-gateway/.env.example` — api-gateway dev template
- `services/ai-service/.env.example` — ai-service dev template
- `services/container-manager/.env.example` — container-manager dev template

### Operator Config Assumptions

- `AI_PROVIDER` must be a real provider (`anthropic`, `openai`, `groq`, `xai`, or `deepseek`) — **not** `stub` — in production.
- The selected provider's API key must be set (for example, `ANTHROPIC_API_KEY` when `AI_PROVIDER=anthropic`).
- `LAUNCH_STATE` must be set explicitly (`CLOSED`, `INTERNAL`, `EARLY_ACCESS`, or `PUBLIC`).
- `BILLING_CHARGES_ENABLED` must be set explicitly (`true` or `false`).
- `INTERNAL_SERVICE_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` must all be set to strong non-default values in production.

---

## 3. Startup Order

### Production-Style Stack (`docker-compose.prod.yml`)

Bring up in dependency order:

```powershell
# 1. Infrastructure (postgres + redis must be healthy before app services)
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d postgres redis

# 2. Verify infrastructure health before proceeding
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps
# Confirm postgres and redis show (healthy)

# 3. Bring up application services
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d api-gateway ai-service container-manager frontend

# 4. Verify application service health
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 5. Optional: observability stack
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d prometheus grafana
```

### Confirming Services Are Healthy

```powershell
# api-gateway health check
Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing | Select-Object -ExpandProperty StatusCode
# Expected: 200

# DB health check
Invoke-WebRequest -Uri "http://localhost:4000/api/health/db" -UseBasicParsing | Select-Object -ExpandProperty StatusCode
# Expected: 200

# Readiness check
Invoke-WebRequest -Uri "http://localhost:4000/api/health/ready" -UseBasicParsing | Select-Object -ExpandProperty StatusCode
# Expected: 200
```

---

## 4. Migration / Validation Order

### Run Migrations

Migrations are run automatically on `api-gateway` startup via TypeORM.

**Preferred: containerized migration run (validated during REL-02-01)**

The host cannot directly reach the PostgreSQL container via `localhost:5432`. Use the
compose-based run path instead:

```powershell
# Run all pending migrations via api-gateway container (uses internal compose network)
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" run --rm `
  -e DATABASE_URL="postgresql://aisandbox:<password>@postgres:5432/<db>" `
  api-gateway npm run migration:run:prod
```

**Alternative: local TypeORM CLI (only when PostgreSQL is reachable on localhost)**

Requires PostgreSQL to be port-forwarded or running directly on the host:

```powershell
# 1. Build api-gateway (required before using dist/data-source.js)
cd "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npm run build

# 2. Show pending migrations (validate state)
$env:DATABASE_URL="postgresql://aisandbox:<password>@localhost:5432/<db>"
npx typeorm migration:show -d dist/data-source.js

# 3. Run all pending migrations
npx typeorm migration:run -d dist/data-source.js

# 4. Revert most recent migration (if needed)
npx typeorm migration:revert -d dist/data-source.js
```

### Validated Migration Sequence (REL-01-01)

The following three migrations have been validated (up and down) against real PostgreSQL:

| Timestamp | Migration | Key Schema Output |
|-----------|-----------|-------------------|
| `1771587000000` | `AddProjectsAndSessionProjectId` | `projects` table; `sessions.project_id` (nullable FK, `ON DELETE SET NULL`); `idx_sessions_project_id` |
| `1771589000000` | `AddPlansFoundation` | `plans` table with `free`/`pro` seed rows; `users.plan_type` + `users.plan_status`; `idx_plans_code_unique` |
| `1771592000000` | `AddProjectVisibility` | `projects.visibility` (`NOT NULL`, default `'private'`) |

### Post-Migration Schema Sanity Checks

```powershell
# Confirm target tables exist
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('projects','plans') ORDER BY table_name;"

# Confirm plans seed data
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT code, name, is_active FROM plans ORDER BY code;"

# Confirm sessions.project_id FK
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='fk_sessions_project_id';"
```

---

## 5. Key Health and Smoke Checks

### Health Endpoints

```powershell
$base = "http://localhost:4000"
$headers = @{}  # add Authorization: Bearer <token> for authenticated endpoints

# Health
Invoke-WebRequest -Uri "$base/api/health" -UseBasicParsing | Select-Object StatusCode           # 200
Invoke-WebRequest -Uri "$base/api/health/db" -UseBasicParsing | Select-Object StatusCode         # 200
Invoke-WebRequest -Uri "$base/api/health/ready" -UseBasicParsing | Select-Object StatusCode      # 200
```

### Auth / Session Gate

```powershell
# Unauthenticated session list should return 401
Invoke-WebRequest -Uri "$base/api/sessions" -UseBasicParsing | Select-Object StatusCode          # 401

# Auth flow
$register = Invoke-WebRequest -Uri "$base/api/auth/register" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com","password":"testpass123"}' -UseBasicParsing
$login    = Invoke-WebRequest -Uri "$base/api/auth/login"    -Method POST -ContentType "application/json" -Body '{"email":"test@example.com","password":"testpass123"}' -UseBasicParsing
$token    = ($login.Content | ConvertFrom-Json).access_token   # field is access_token (not accessToken)
```

### Core Workspace Smoke

```powershell
$authHeader = @{ Authorization = "Bearer $token" }

# Session
$sess = Invoke-WebRequest -Uri "$base/api/sessions" -Method POST -Headers $authHeader -ContentType "application/json" -Body '{}' -UseBasicParsing
$sessionId = ($sess.Content | ConvertFrom-Json).id

# File write / read
Invoke-WebRequest -Uri "$base/api/sessions/$sessionId/files/write" -Method POST -Headers $authHeader -ContentType "application/json" -Body '{"path":"smoke.txt","content":"ok"}' -UseBasicParsing | Select-Object StatusCode  # 200
Invoke-WebRequest -Uri "$base/api/sessions/$sessionId/files/read"  -Method POST -Headers $authHeader -ContentType "application/json" -Body '{"path":"smoke.txt"}' -UseBasicParsing | Select-Object StatusCode                   # 200

# Checkpoint and snapshot
Invoke-WebRequest -Uri "$base/api/sessions/$sessionId/checkpoints" -Method POST -Headers $authHeader -ContentType "application/json" -Body '{"message":"smoke"}' -UseBasicParsing | Select-Object StatusCode  # 201
Invoke-WebRequest -Uri "$base/api/sessions/$sessionId/snapshot"    -Method POST -Headers $authHeader -ContentType "application/json" -Body '{}' -UseBasicParsing | Select-Object StatusCode                 # 201
```

### Quota / Config

```powershell
Invoke-WebRequest -Uri "$base/api/users/me/usage"  -Headers $authHeader -UseBasicParsing | Select-Object StatusCode  # 200
Invoke-WebRequest -Uri "$base/api/users/me/quotas" -Headers $authHeader -UseBasicParsing | Select-Object StatusCode  # 200
```

### Public API Smoke

```powershell
# Create API key — scopes array is required; response field is apiKey (not key)
$keyResp  = Invoke-WebRequest -Uri "$base/api/keys" -Method POST -Headers $authHeader -ContentType "application/json" -Body '{"name":"smoke","scopes":["ai:execute"]}' -UseBasicParsing
$apiKey   = ($keyResp.Content | ConvertFrom-Json).apiKey

# Retrieve conversationId (required by execute endpoint)
$conv        = Invoke-WebRequest -Uri "$base/api/sessions/$sessionId/conversation" -Method GET -Headers $authHeader -UseBasicParsing
$conversationId = ($conv.Content | ConvertFrom-Json).id

# Submit execution — auth uses Authorization: Bearer <apiKey> (not X-API-Key header)
# conversationId is required alongside sessionId and prompt
$execBody = '{"sessionId":"' + $sessionId + '","conversationId":"' + $conversationId + '","prompt":"ping"}'
$execResp = Invoke-WebRequest -Uri "$base/api/v1/ai/execute" -Method POST -Headers @{ Authorization = "Bearer $apiKey" } -ContentType "application/json" -Body $execBody -UseBasicParsing
$execId   = ($execResp.Content | ConvertFrom-Json).executionId

# Poll status (expect 200 with coherent status) — same Bearer auth
Invoke-WebRequest -Uri "$base/api/v1/ai/executions/$execId" -Headers @{ Authorization = "Bearer $apiKey" } -UseBasicParsing | Select-Object StatusCode  # 200
```

---

## 6. Recovery Steps for Known Blockers

### Docker Daemon Unavailable (REL-01-01A)

**Symptom:** `docker ps` hangs or returns a daemon connection error; `sc query com.docker.service` shows `STOPPED`.

**Recovery:**
```powershell
# 1. Force-close stale Docker processes
cmd /c "taskkill /IM ""Docker Desktop.exe"" /F & taskkill /IM ""com.docker.backend.exe"" /F & taskkill /IM ""docker.exe"" /F"

# 2. Relaunch Docker Desktop
& "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 3. Wait ~30s for backend to become responsive, then verify
docker ps --format "table {{.Names}}\t{{.Status}}"

# 4. Bring up postgres
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.yml" up -d postgres
docker inspect --format "{{json .State.Health}}" aisandbox-postgres
```

---

### Migration Defect: AddPlansFoundation (`users.plan_type` missing) (REL-01-01B)

**Symptom:** Migration `1771589000000` fails with PostgreSQL error `42703` (`column "plan_type" does not exist`).

**Cause:** Original migration updated `users.plan_type` before adding the column.

**Status:** Fixed in `services/api-gateway/src/migrations/1771589000000-AddPlansFoundation.ts` — column is now added with `ADD COLUMN IF NOT EXISTS` before `UPDATE`.

**Verification:**
```powershell
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_name='users' AND column_name IN ('plan_type','plan_status') ORDER BY column_name;"
```

---

### Startup Migration Defect: AddProjectsAndSessionProjectId (`updated_at` missing) (REL-01-02A)

**Symptom:** `api-gateway` fails to start; migration `1771587000000` errors with `42703` (`column "updated_at" does not exist`) when `projects` table pre-existed without `updated_at`.

**Cause:** Index `idx_projects_updated_at` was created unconditionally after `CREATE TABLE IF NOT EXISTS`. If table pre-existed without `updated_at`, the column was absent.

**Status:** Fixed — `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "updated_at"` added before index creation.

**Recovery:** Rebuild and restart api-gateway:
```powershell
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d --build api-gateway
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

### Project Creation Failure (`slug` null constraint) (REL-01-02B)

**Symptom:** `POST /api/projects` returns `500`; log shows `null value in column "slug" violates not-null constraint`.

**Cause:** `Project` entity had no `slug` column mapped; `ProjectsService` did not generate a slug on create.

**Status:** Fixed — `slug` column added to entity; `ProjectsService.createProject` generates a slug automatically.

**Verification:**
```powershell
Invoke-WebRequest -Uri "http://localhost:4000/api/projects" -Method POST -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{"name":"test"}' -UseBasicParsing | Select-Object StatusCode  # 201
```

---

### Snapshot Failure After Checkpoint (absolute path outside /workspace) (REL-01-02C)

**Symptom:** `POST /api/sessions/:id/snapshot` returns `400` (`Absolute paths outside /workspace not allowed`) after a checkpoint has been created in the same session.

**Cause:** `SnapshotPersistenceService` built recursive paths with a leading `/` (for example `/.git`), which container-manager correctly rejected.

**Status:** Fixed — recursive traversal now uses workspace-relative paths (for example `.git`, not `/.git`).

**Verification:**
```powershell
# Snapshot must succeed both before and after checkpoint in same session
Invoke-WebRequest -Uri "http://localhost:4000/api/sessions/$sessionId/checkpoints" -Method POST -Headers $authHeader -ContentType "application/json" -Body '{"message":"snap-test"}' -UseBasicParsing | Select-Object StatusCode  # 201
Invoke-WebRequest -Uri "http://localhost:4000/api/sessions/$sessionId/snapshot"    -Method POST -Headers $authHeader -ContentType "application/json" -Body '{}' -UseBasicParsing | Select-Object StatusCode                        # 201
```

---

### Public API Execution Status Returns 404 (REL-01-02D)

**Symptom:** `POST /api/v1/ai/execute` succeeds (202), but `GET /api/v1/ai/executions/:executionId` returns `404`.

**Cause:** `ExecutionResultService.getExecution()` did not `SELECT user_id`; ownership check in `PublicAIController` compared `undefined === userId`, always failing.

**Status:** Fixed — `user_id` added to `SELECT` in `ExecutionResultService.getExecution()`.

**Verification:**
```powershell
$execId = ($execResp.Content | ConvertFrom-Json).executionId
Invoke-WebRequest -Uri "http://localhost:4000/api/v1/ai/executions/$execId" -Headers @{ "X-API-Key" = $apiKey } -UseBasicParsing | Select-Object StatusCode  # 200
```

---

### Environment Template Config Defects (REL-01-03A / REL-01-03B)

**Symptom (REL-01-03A):** Using `.env.prod.example` as-is resulted in `AI_PROVIDER=stub` (disallowed in production), missing `LAUNCH_STATE` (startup failure), and missing `REDIS_URL`/`DATABASE_URL` in ai-service template.

**Symptom (REL-01-03B):** `.env.prod.example` set `AI_PROVIDER=anthropic` but `ANTHROPIC_API_KEY` was commented out, causing production startup validation failure.

**Status:** All fixed in `.env.prod.example` and `services/ai-service/.env.example`.

**Verification:**
```powershell
$prod = "C:\Users\knlee\aiSandBox2026B\.env.prod.example"
Select-String -Path $prod -Pattern '^AI_PROVIDER=','^LAUNCH_STATE=','^ANTHROPIC_API_KEY='
# Must show non-stub AI_PROVIDER, LAUNCH_STATE, and active ANTHROPIC_API_KEY lines
```

---

## 7. Required Env / Config Assumptions by Service

### api-gateway (port 4000)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | `production` in prod |
| `PORT` | Yes | `4000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LAUNCH_STATE` | Yes | `CLOSED`, `INTERNAL`, `EARLY_ACCESS`, or `PUBLIC` |
| `AI_PROVIDER` | Yes (prod) | Non-`stub` in production |
| `<PROVIDER>_API_KEY` | Yes (prod) | Key matching selected `AI_PROVIDER` |
| `INTERNAL_SERVICE_KEY` | Yes | Shared secret with ai-service and container-manager |
| `CONTAINER_MANAGER_URL` | Yes | `http://container-manager:4002` in compose |
| `REDIS_URL` | Yes | Redis connection string |
| `BILLING_CHARGES_ENABLED` | Yes | `true` or `false` explicitly |
| `JWT_SECRET` | Yes | Long random hex string |

### ai-service (port 4001)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | |
| `PORT` | Yes | `4001` |
| `DATABASE_URL` | Yes | Required by worker module |
| `REDIS_URL` | Yes | Required by queue service |
| `API_GATEWAY_URL` | Yes | `http://api-gateway:4000` in compose |
| `INTERNAL_SERVICE_KEY` | Yes | Must match api-gateway value |
| `CONTAINER_MANAGER_URL` | Yes | |
| `AI_PROVIDER` | Yes | Must match api-gateway setting |
| `<PROVIDER>_API_KEY` | Yes (exec path) | Key for selected provider |

### container-manager (port 4002)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | |
| `PORT` | Yes | `4002` |
| `API_GATEWAY_URL` | Yes | `http://api-gateway:4000` in compose |
| `INTERNAL_SERVICE_KEY` | Yes | Must match api-gateway value |
| `DOCKER_HOST` | Yes | `unix:///var/run/docker.sock` (via volume mount in compose) |
| `SESSION_MAX_LIFETIME_MS` | Recommended | Default `86400000` (24h) |
| `SESSION_IDLE_TIMEOUT_MS` | Recommended | Default `1800000` (30m) |
| `CONTAINER_MEMORY_LIMIT_MB` | Recommended | Default `512` |
| `CONTAINER_PIDS_LIMIT` | Recommended | Default `256` |
| `MAX_CONCURRENT_EXECS_PER_SESSION` | Recommended | Default `2` |
| `JWT_SECRET` | Conditional | Required only when `ENABLE_PREVIEW_ACCESS_CONTROL=true` |

### frontend (port 3000)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | |
| `API_GATEWAY_URL` | Yes | Set as build arg in compose: `http://api-gateway:4000` |

---

## 8. Current Validated Outcome

| Gate | Status | Reference |
|------|--------|-----------|
| Docker/PostgreSQL environment recovery | COMPLETE and LOCKED | REL-01-01A |
| Migration defect fix (AddPlansFoundation) | COMPLETE and LOCKED | REL-01-01B |
| Migration validation (three target migrations, up + down) | COMPLETE and LOCKED | REL-01-01 |
| Startup migration defect fix (AddProjectsAndSessionProjectId) | COMPLETE and LOCKED | REL-01-02A |
| Project creation slug defect fix | COMPLETE and LOCKED | REL-01-02B |
| Snapshot-after-checkpoint path defect fix | COMPLETE and LOCKED | REL-01-02C |
| Public API execution status lookup defect fix | COMPLETE and LOCKED | REL-01-02D |
| Integration smoke sweep (all regression-gate surfaces) | COMPLETE and LOCKED | REL-01-02 |
| Env template defect fixes (stub provider, LAUNCH_STATE, ai-service keys) | COMPLETE and LOCKED | REL-01-03A |
| Env template provider-key coherence fix | COMPLETE and LOCKED | REL-01-03B |
| Environment and config audit | COMPLETE and LOCKED | REL-01-03 |

**Release-Readiness Baseline:** The stack is validated and safe to proceed to the next release-readiness phase.
