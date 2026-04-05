# REL-01-03 CHECKPOINT - Environment and Config Audit (Final Resume)

## Task Metadata

- Task ID: REL-01-03
- Title: Environment and Config Audit
- Nature: VALIDATION (RELEASE READINESS, ENVIRONMENT / CONFIG CONSISTENCY)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-03-CHECKPOINT.md`

## Objective

Validate and consolidate environment/config assumptions required by the completed product wave so release-readiness can proceed from a consistent Docker, env-var, and startup baseline.

## Resume Context

- REL-01-03A fixed the first concrete template blockers.
- REL-01-03B fixed the remaining production provider-key template blocker.
- REL-01-03 resumed for bounded final audit validation only.

## Exact Files Checked

- `C:\Users\knlee\aiSandBox2026B\docker-compose.yml`
- `C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml`
- `C:\Users\knlee\aiSandBox2026B\.env`
- `C:\Users\knlee\aiSandBox2026B\.env.example`
- `C:\Users\knlee\aiSandBox2026B\.env.prod`
- `C:\Users\knlee\aiSandBox2026B\.env.prod.example`
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env.example`
- `C:\Users\knlee\aiSandBox2026B\services\ai-service\.env.example`
- `C:\Users\knlee\aiSandBox2026B\services\container-manager\.env.example`
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\startup\provider.validator.ts`
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\startup\configuration.validator.ts`
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\launch\launch.config.ts`
- `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\main.ts`
- `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\queue\queue.service.ts`
- `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\worker\worker.module.ts`

## Exact Commands / Checks Run

1. `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps`
2. `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
3. `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" config --services`
4. Runtime env inspection:
   - `docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' aisandbox-api-gateway`
   - `docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' aisandbox2026b-ai-service-1`
   - `docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' aisandbox-container-manager`
   - `docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' aisandbox-frontend`
5. REL-01-03A bounded defect recheck (template keys):
   - verified `.env.prod.example`: non-stub `AI_PROVIDER` and required `LAUNCH_STATE`
   - verified `services\ai-service\.env.example`: `REDIS_URL` and `DATABASE_URL`
6. REL-01-03B bounded defect recheck (provider-template coherence):
   - verified `AI_PROVIDER=anthropic` and active `ANTHROPIC_API_KEY=` entry in `.env.prod.example`
7. Runtime release-relevant key presence script across:
   - `aisandbox-api-gateway`, `aisandbox2026b-ai-service-1`, `aisandbox-container-manager`, `aisandbox-frontend`
8. Compose-to-template key comparison (active key declarations in `.env.example` and `.env.prod.example`):
   - checked unresolved `${VAR}` expectations against template key declarations

## Required Env / Config Assumptions by Service (Release-Relevant)

### api-gateway

- Startup required: `NODE_ENV`, `PORT`, `DATABASE_URL`, `LAUNCH_STATE`
- Provider validation: `AI_PROVIDER` must be valid and non-`stub` in production; selected provider key must exist
- Integration required: `INTERNAL_SERVICE_KEY`, `CONTAINER_MANAGER_URL`, `REDIS_URL`
- Guardrail required: explicit `BILLING_CHARGES_ENABLED`

### ai-service

- Integration required: `API_GATEWAY_URL`, `INTERNAL_SERVICE_KEY`, `CONTAINER_MANAGER_URL`
- Queue/worker required: `REDIS_URL` and `DATABASE_URL`
- Provider execution path: `AI_PROVIDER` plus selected provider key

### container-manager

- Required integration/runtime: `API_GATEWAY_URL`, `INTERNAL_SERVICE_KEY`, `PORT`, `DOCKER_HOST`
- Governance/resource runtime settings: `SESSION_MAX_LIFETIME_MS`, `SESSION_IDLE_TIMEOUT_MS`, `CONTAINER_CPU_LIMIT`, `CONTAINER_MEMORY_LIMIT_MB`, `CONTAINER_PIDS_LIMIT`, `MAX_CONCURRENT_EXECS_PER_SESSION`
- Optional preview auth gate: `ENABLE_PREVIEW_ACCESS_CONTROL`, `JWT_SECRET` (required only when enabled)

### frontend

- Build/runtime routing assumption: `API_GATEWAY_URL`

## Findings

### Previously Blocking Defects

- `.env.prod.example` with `AI_PROVIDER=stub`: **RESOLVED** (REL-01-03A)
- `.env.prod.example` missing `LAUNCH_STATE`: **RESOLVED** (REL-01-03A)
- `services/ai-service/.env.example` missing `REDIS_URL` and `DATABASE_URL`: **RESOLVED** (REL-01-03A)
- `.env.prod.example` missing active selected-provider key line for `AI_PROVIDER=anthropic`: **RESOLVED** (REL-01-03B)

### Remaining Mismatches / Gaps

1. Active-key-only compose/template comparison still reports non-selected provider vars (`GROQ_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`) as not actively declared in templates.
   - Classification: **non-blocking / harmless for current release path**.
   - Reason: selected provider path is coherent and validated (`AI_PROVIDER=anthropic` with active `ANTHROPIC_API_KEY=`), and runtime stack is healthy.

2. `docker-compose.prod.yml` still relies on broad `env_file: ./.env` pass-through shape.
   - Classification: **non-blocking / harmless for this bounded task**.
   - Reason: current stack behavior is healthy and release-relevant checks passed.

## Compose and Runtime Alignment Result

- Running stack alignment: **PASS**
- Template/startup coherence for release-relevant selected provider path: **PASS**
- Blocking config defects in REL-01-03 scope: **NONE**

## Release-Readiness Recommendation

- **Safe to proceed to REL-01-04.**
