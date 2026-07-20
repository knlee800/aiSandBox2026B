# BETA-READY-DEPLOYMENT-CONFIG — Stage-Start / Deployment Topology / Secrets and Flag Plan

**Task ID:** BETA-READY-DEPLOYMENT-CONFIG
**Step:** 2 — Stage-Start / Deployment Topology / Secrets and Flag Plan
**Status:** COMPLETE — 2026-07-20
**Date:** 2026-07-20
**Nature:** Planning only — no implementation, no source/test/translation/package/migration/entity/environment/Docker files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BETA-READY-DEPLOYMENT-CONFIG |
| Title | Production Deployment Configuration |
| Family | BETA READINESS / DEPLOYMENT / INFRASTRUCTURE / PRODUCTION CONFIGURATION |
| Risk | HIGH — 4-step loop |
| Step 1 | COMPLETE — Registration — 2026-07-20 |
| Step 2 | This document — Stage-Start / Deployment Topology / Secrets and Flag Plan — 2026-07-20 |
| Step 3 | Pending — Implementation |
| Step 4 | Pending — Consolidation / Checkpoint |
| Keith Approval | "go" — 2026-07-20 |
| Blocker Addressed | BETA-READY-00 blocker B2 — production/staging deployment configuration |
| Prerequisite Resolved | BETA-READY-00 blocker B1 — resolved at canary-readiness level by AGENT-HARNESS-WRITE-CANARY (COMPLETE and LOCKED — 2026-07-20) |
| Remaining Blocker | B3 — pre-beta full-stack live smoke — separate task after this one |

---

## 2. Current Beta-Readiness State

- **BETA-READY-00** COMPLETE and LOCKED — 2026-07-19. Launch decision: READY FOR LIMITED BETA WITH LIMITATIONS.
- **B1 (Agent Harness write path):** Resolved at canary-readiness level. First live E2E write canary PASS. Safe default remains disabled. Permanent activation is a deployment/configuration decision under this task.
- **B2 (Production/staging deployment config):** This task. Not yet resolved.
- **B3 (Pre-beta full-stack live smoke):** Pending — separate task after B2.
- **Stripe/payment/provider:** Not activated. Provider disabled. `BILLING_CHARGES_ENABLED=false`. No Stripe SDK installed.
- **Customer portal:** "Coming soon" UI only. No backend endpoint.
- **All 50+ prior tasks:** COMPLETE and LOCKED with checkpoint evidence.

---

## 3. Stage-Start Purpose

This document answers all 20 stage-start questions, recommends a deployment topology, and defines the exact scope for Step 3 implementation. No code is written, no files are modified, no services are started.

---

## 4. Files Inspected

| # | File | Nature |
|---|------|--------|
| 1 | `TASKS.md` | Active task ledger (partial — header + BETA-READY-DEPLOYMENT-CONFIG entry) |
| 2 | `TASKS_BACKLOG_FULL.md` | Backlog (partial — BETA-READY-DEPLOYMENT-CONFIG entry) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution roadmap |
| 4 | `docs/BETA-READY-00-CHECKPOINT.md` | Beta readiness checkpoint |
| 5 | `docs/BETA-READY-00-CHECKLIST.md` | Beta readiness checklist (24 sections) |
| 6 | `docs/AGENT-HARNESS-WRITE-CANARY-CHECKPOINT.md` | Write canary parent checkpoint |
| 7 | `docker-compose.yml` | Docker Compose — postgres, redis, prometheus, grafana |
| 8 | `package.json` | Root workspace config |
| 9 | `services/api-gateway/package.json` | API Gateway dependencies |
| 10 | `services/ai-service/package.json` | AI Service dependencies |
| 11 | `services/container-manager/package.json` | Container Manager dependencies |
| 12 | `frontend/package.json` | Frontend dependencies |
| 13 | `.env.example` | Root env template (key names only) |
| 14 | `services/api-gateway/.env.example` | API Gateway env template (key names only) |
| 15 | `services/ai-service/.env.example` | AI Service env template (key names only) |
| 16 | `services/container-manager/.env.example` | Container Manager env template (key names only) |
| 17 | `services/api-gateway/src/health/health.controller.ts` | API Gateway health endpoints |
| 18 | `services/container-manager/src/health/health.controller.ts` | Container Manager health endpoint |
| 19 | `services/api-gateway/src/safety/kill-switch.config.ts` | Kill switch configuration |
| 20 | `services/api-gateway/src/safety/global-safety-limits.config.ts` | Global safety limits |
| 21 | `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Agent Harness feature gates |
| 22 | `services/api-gateway/src/launch/launch.config.ts` | Launch state configuration |
| 23 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Stripe provider (env key references only) |
| 24 | `frontend/next.config.js` | Frontend API proxy config |
| 25 | `frontend/lib/feature-flags.ts` | Frontend feature flags |
| 26 | `services/ai-service/src/main.ts` | AI Service port binding |
| 27 | `services/api-gateway/src/main.ts` | API Gateway port binding |
| 28 | `services/container-manager/src/main.ts` | Container Manager port binding |

No real `.env`, `.env.local`, secret, credential, key, certificate, or token files were opened.

---

## 5. Recommended Limited-Beta Deployment Topology

### Architecture

```
Internet → Reverse Proxy (nginx/Caddy/cloud LB) → Frontend (Next.js :3002)
                                                  → API Gateway (NestJS :4000)
           [Internal only, not exposed]           → AI Service Worker (:4001)
           [Internal only, not exposed]           → Container Manager (:4002)
           [Internal only, not exposed]           → PostgreSQL (:5432)
           [Internal only, not exposed]           → Redis (:6379)
           [Internal only, not exposed]           → Docker Engine (socket)
           [Optional monitoring, internal only]   → Prometheus (:9090)
           [Optional monitoring, internal only]   → Grafana (:3000)
```

### Public-facing endpoints

| Endpoint | Port | Exposure |
|----------|------|----------|
| Frontend (Next.js) | 3002 | Public via reverse proxy on port 443 (HTTPS) |
| API Gateway `/api/*` | 4000 | Public via reverse proxy on port 443 (HTTPS) — proxied by frontend rewrites or reverse proxy |

### Internal-only endpoints

| Service | Port | Exposure |
|---------|------|----------|
| AI Service Worker | 4001 | Internal network only — never exposed to internet |
| Container Manager | 4002 | Internal network only — never exposed to internet |
| PostgreSQL | 5432 | Internal network only — never exposed to internet |
| Redis | 6379 | Internal network only — never exposed to internet |
| Docker Engine | socket | Host-only — never exposed to internet |
| Prometheus | 9090 | Internal/operator only |
| Grafana | 3000 | Internal/operator only |

### Topology notes

- Frontend rewrites `/api/*` to API Gateway via `next.config.js` (`API_GATEWAY_URL`).
- API Gateway is the sole user-facing backend. All internal services communicate through it.
- AI Service Worker connects to Redis (BullMQ queue) and PostgreSQL. It calls API Gateway `/api/internal/*` endpoints.
- Container Manager manages Docker containers, calls API Gateway `/api/internal/*` endpoints.
- All `/api/internal/*` routes are protected by `InternalServiceAuthGuard` (shared `INTERNAL_SERVICE_KEY`).

---

## 6. Service Inventory — Required for Limited Beta

| # | Service | Required? | Role |
|---|---------|-----------|------|
| 1 | Frontend (Next.js) | YES | User-facing web application |
| 2 | API Gateway (NestJS) | YES | Authentication, session management, billing, AI execution orchestration, WebSocket, health |
| 3 | AI Service Worker (NestJS) | YES | BullMQ worker — AI provider calls, agent harness tool loop, file operations |
| 4 | Container Manager (NestJS) | YES | Docker container lifecycle, file system operations, preview serving, git checkpoints |
| 5 | PostgreSQL 15 | YES | Primary data store — users, sessions, projects, billing, usage records, migrations |
| 6 | Redis 7 | YES | BullMQ job queue, execution streaming |
| 7 | Docker Engine | YES | User sandbox containers (gVisor isolation) |
| 8 | Reverse Proxy / TLS termination | YES | HTTPS, domain routing, rate limiting edge |
| 9 | Prometheus | RECOMMENDED | Metrics collection (already configured in docker-compose.yml) |
| 10 | Grafana | OPTIONAL | Dashboard visualization (already configured in docker-compose.yml) |

---

## 7. Hosted vs Local/Self-Hosted Decision

### Recommendation: Self-hosted single-server deployment for limited beta

**Rationale:**

- Limited beta targets a small number of invited users (Keith + select testers).
- The platform requires Docker Engine on the host for sandbox container management.
- Container Manager needs direct access to Docker socket (`/var/run/docker.sock`).
- Cloud container orchestration (Kubernetes, ECS) adds complexity without benefit at limited-beta scale.
- A single Linux server (VPS/dedicated) with Docker, PostgreSQL, Redis can serve limited beta.

**Recommended hosting:**

| Component | Hosting |
|-----------|---------|
| All services | Single Linux server (Ubuntu 22.04+ or similar) |
| PostgreSQL | On the same server (Docker container or host-installed) |
| Redis | On the same server (Docker container) |
| Docker Engine | On the host (required for container-manager) |
| TLS/HTTPS | Caddy or nginx with Let's Encrypt auto-cert on `ainow.biz` |
| DNS | `ainow.biz` A record pointing to server IP |

**Not recommended for limited beta:**

- Kubernetes / ECS / managed container orchestration (overkill for < 10 users)
- Managed DB / managed Redis (cost overhead; single-server is sufficient for limited beta)
- Multi-server / load-balanced deployment (unnecessary at this scale)
- CDN (unnecessary until public beta)

**Scaling path (post limited beta):** Managed PostgreSQL, managed Redis, container orchestration, CDN, multi-server.

---

## 8. Environment List

| # | Environment | Purpose | Exists Today? |
|---|-------------|---------|---------------|
| 1 | Local Development | Developer workstation; `localhost` services; stub provider | YES — current state |
| 2 | Staging | Pre-production validation; test provider keys; limited data; smoke testing | NO — to be created |
| 3 | Production | Live limited-beta; real users; real (or test-mode) provider keys; production data | NO — to be created |

**Recommendation:** Staging is required before production. Even at limited-beta scale, staging provides a safe environment to validate deployment configuration, migration execution, and smoke tests before exposing to real users.

For limited beta, staging and production MAY share the same server with separate databases if budget is constrained, but separate environments are preferred.

---

## 9. Env Key Checklist by Service (Key Names Only)

### 9A. Root / Shared Keys

| Key Name | Required For | Secret? | Beta Default |
|----------|-------------|---------|--------------|
| `NODE_ENV` | All services | No | `production` |
| `LAUNCH_STATE` | API Gateway startup | No | `INTERNAL` (limited beta) |
| `POSTGRES_HOST` | API Gateway, AI Service | No | Docker network hostname |
| `POSTGRES_PORT` | API Gateway, AI Service | No | `5432` |
| `POSTGRES_USER` | API Gateway, AI Service, Docker Compose | YES | unique per environment |
| `POSTGRES_PASSWORD` | API Gateway, AI Service, Docker Compose | YES | unique per environment |
| `POSTGRES_DB` | API Gateway, AI Service, Docker Compose | No | `aisandbox` |
| `DATABASE_URL` | AI Service Worker | YES (contains password) | constructed from above |
| `REDIS_HOST` | Docker Compose | No | Docker network hostname |
| `REDIS_PORT` | Docker Compose | No | `6379` |
| `REDIS_PASSWORD` | Docker Compose, AI Service | YES | unique per environment |
| `REDIS_URL` | AI Service Worker | YES (contains password) | constructed from above |
| `INTERNAL_SERVICE_KEY` | API Gateway, AI Service, Container Manager | YES | `openssl rand -hex 32` per environment |

### 9B. API Gateway Keys

| Key Name | Required For | Secret? | Beta Default |
|----------|-------------|---------|--------------|
| `PORT` | API Gateway listen port | No | `4000` |
| `JWT_SECRET` | Auth session signing | YES | `openssl rand -hex 64` per environment |
| `JWT_EXPIRES_IN` | Token lifetime | No | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | No | `7d` |
| `SESSION_SECRET` | Cookie session | YES | `openssl rand -hex 64` per environment |
| `OAUTH_STATE_SECRET` | OAuth state CSRF | YES | `openssl rand -hex 64` per environment |
| `APP_BASE_URL` | Auth callbacks, email links | No | `https://ainow.biz` |
| `GOOGLE_CLIENT_ID` | Google OAuth | YES | Keith-provisioned |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | YES | Keith-provisioned |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback | No | `https://ainow.biz/api/auth/google/callback` |
| `APPLE_CLIENT_ID` | Apple OAuth | YES | Keith-provisioned (optional for beta) |
| `APPLE_TEAM_ID` | Apple OAuth | YES | Keith-provisioned (optional for beta) |
| `APPLE_KEY_ID` | Apple OAuth | YES | Keith-provisioned (optional for beta) |
| `APPLE_PRIVATE_KEY` | Apple OAuth | YES | Keith-provisioned (optional for beta) |
| `APPLE_CALLBACK_URL` | Apple OAuth callback | No | `https://ainow.biz/api/auth/apple/callback` |
| `EMAIL_PROVIDER` | Auth email sending | No | `resend` (production) / `stub` (staging) |
| `RESEND_API_KEY` | Resend email API | YES | Keith-provisioned |
| `AUTH_EMAIL_FROM` | Sender address | No | Verified domain sender |
| `AUTH_EMAIL_REPLY_TO` | Reply-to address | No | Support address |
| `AI_PROVIDER` | Provider selection | No | `anthropic` (production) / `stub` (staging) |
| `ANTHROPIC_API_KEY` | Anthropic API | YES | Keith-provisioned |
| `OPENAI_API_KEY` | OpenAI API (required by config validator) | YES | Keith-provisioned |
| `SESSION_TIMEOUT_MINUTES` | Session max lifetime | No | `120` |
| `MAX_CONCURRENT_SESSIONS` | Session limit | No | `8` |
| `BILLING_CHARGES_ENABLED` | Billing kill-switch | No | `false` — MUST remain false for beta |
| `STRIPE_PROVIDER_MODE` | Stripe mode | No | `disabled` — MUST remain disabled for beta |
| `ABORT_MODE` | Abort mode | No | `NONE` |

### 9C. API Gateway Kill Switches

| Key Name | Secret? | Beta Default |
|----------|---------|--------------|
| `GLOBAL_EXECUTION_ENABLED` | No | `true` (default) |
| `PROVIDER_OPENAI_ENABLED` | No | `true` (default) |
| `PROVIDER_ANTHROPIC_ENABLED` | No | `true` (default) |
| `PROVIDER_GROQ_ENABLED` | No | `true` (default) |
| `PROVIDER_XAI_ENABLED` | No | `true` (default) |
| `PROVIDER_DEEPSEEK_ENABLED` | No | `true` (default) |
| `BILLING_SNAPSHOT_ENABLED` | No | `true` (default) |
| `INVOICE_GENERATION_ENABLED` | No | `true` (default) |
| `PAYMENT_EXECUTION_ENABLED` | No | `true` (default — but `BILLING_CHARGES_ENABLED=false` prevents any charging) |

### 9D. API Gateway Safety Limits

| Key Name | Secret? | Beta Default |
|----------|---------|--------------|
| `MAX_TOKENS_PER_EXECUTION` | No | `100000` |
| `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | No | `10000` (reduce for beta: `1000`) |
| `MAX_DAILY_SPEND_SOFT_USD` | No | `10000` (reduce for beta: `100`) |
| `MAX_DAILY_SPEND_HARD_USD` | No | `20000` (reduce for beta: `200`) |
| `MAX_REQUESTS_PER_MINUTE_ANTHROPIC` | No | `3000` (reduce for beta: `300`) |
| `MAX_REQUESTS_PER_MINUTE_OPENAI` | No | `5000` (reduce for beta: `500`) |

### 9E. AI Service Keys

| Key Name | Required For | Secret? | Beta Default |
|----------|-------------|---------|--------------|
| `PORT` | AI Service listen port | No | `4001` |
| `AI_PROVIDER` | Provider adapter selection | No | `anthropic` (production) / `stub` (staging) |
| `ANTHROPIC_API_KEY` | Anthropic API | YES | Keith-provisioned |
| `OPENAI_API_KEY` | OpenAI API | YES | Keith-provisioned |
| `GROQ_API_KEY` | Groq API | YES | Keith-provisioned (optional) |
| `XAI_API_KEY` | xAI API | YES | Keith-provisioned (optional) |
| `DEEPSEEK_API_KEY` | DeepSeek API | YES | Keith-provisioned (optional) |
| `API_GATEWAY_URL` | Internal API calls | No | `http://api-gateway:4000` (Docker) or `http://localhost:4000` (host) |
| `INTERNAL_SERVICE_KEY` | Internal auth | YES | Must match API Gateway value |
| `REDIS_URL` | BullMQ queue | YES (contains password) | constructed |
| `DATABASE_URL` | TypeORM | YES (contains password) | constructed |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | Harness tool loop gate | No | See Section 12 |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | Harness write tools gate | No | See Section 12 |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | Harness validation tools gate | No | `false` (default) |
| `AGENT_HARNESS_STUB_WRITE_MODE` | Test stub write mode | No | `false` — MUST remain false in production |

### 9F. Container Manager Keys

| Key Name | Required For | Secret? | Beta Default |
|----------|-------------|---------|--------------|
| `PORT` | Container Manager listen port | No | `4002` |
| `API_GATEWAY_URL` | Internal API calls | No | `http://api-gateway:4000` or `http://localhost:4000` |
| `INTERNAL_SERVICE_KEY` | Internal auth | YES | Must match API Gateway value |
| `DOCKER_HOST` | Docker Engine access | No | `unix:///var/run/docker.sock` |
| `CONTAINER_CPU_LIMIT` | Container CPU cap | No | `0.5` |
| `CONTAINER_MEMORY_LIMIT` | Container memory cap | No | `1g` |
| `CONTAINER_DISK_LIMIT` | Container disk cap | No | `3g` |
| `CONTAINER_MEMORY_LIMIT_MB` | Governance memory cap | No | `512` |
| `CONTAINER_PIDS_LIMIT` | Container PIDs cap | No | `256` |
| `MAX_CONCURRENT_EXECS_PER_SESSION` | Exec concurrency cap | No | `2` |
| `ENABLE_PREVIEW_ACCESS_CONTROL` | Preview JWT auth | No | `false` (evaluate `true` for beta) |
| `JWT_SECRET` | Preview JWT verification | YES | Must match API Gateway value |
| `SESSION_MAX_LIFETIME_MS` | Session lifetime | No | `86400000` (24h) |
| `SESSION_IDLE_TIMEOUT_MS` | Session idle timeout | No | `1800000` (30m) |

### 9G. Frontend Keys

| Key Name | Required For | Secret? | Beta Default |
|----------|-------------|---------|--------------|
| `API_GATEWAY_URL` | Next.js rewrite proxy target | No | `http://api-gateway:4000` or `http://localhost:4000` |
| `NEXT_PUBLIC_PROJECT_FIRST_UX` | Feature flag | No | `false` |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | Dev tools visibility | No | `false` — MUST be false in production |

---

## 10. Secret-Handling Plan

### Principles

1. **No secrets in repo.** No secret values in source code, `.env.example` files, documentation, or checkpoint files.
2. **No secrets in Docker images.** Secrets injected via environment variables at runtime.
3. **Unique secrets per environment.** Staging and production use different secret values.
4. **Keith-only secret provisioning.** All real API keys, OAuth credentials, and email provider credentials are provisioned by Keith manually.

### Secret storage recommendation for limited beta

| Option | Description | Recommended? |
|--------|-------------|-------------|
| `.env` file on server | Simple; file-based; `chmod 600`; not in repo | YES — for limited beta |
| Cloud secret manager (AWS Secrets Manager, etc.) | Production-grade; rotation; audit trail | DEFERRED — post-beta scaling |
| Docker secrets | Docker Swarm only; adds orchestration complexity | NO — not using Swarm |

### Secret generation commands (key names only — Keith executes)

```bash
# Generate JWT_SECRET
openssl rand -hex 64

# Generate SESSION_SECRET
openssl rand -hex 64

# Generate OAUTH_STATE_SECRET
openssl rand -hex 64

# Generate INTERNAL_SERVICE_KEY
openssl rand -hex 32

# Generate POSTGRES_PASSWORD
openssl rand -hex 32

# Generate REDIS_PASSWORD
openssl rand -hex 32
```

### Secret rotation plan

- Rotation not required before limited beta.
- Document rotation procedure in deployment guide for post-beta.
- `INTERNAL_SERVICE_KEY` rotation requires coordinated restart of API Gateway + AI Service + Container Manager.
- `JWT_SECRET` rotation invalidates all active sessions (requires coordinated restart + user re-login).

---

## 11. Safe Feature-Flag Plan

### Non-secret flags safe for `.env` and deployment templates

| Flag | Safe Default | Beta Value | Notes |
|------|-------------|------------|-------|
| `NODE_ENV` | `development` | `production` | Standard Node.js env |
| `LAUNCH_STATE` | (none — required) | `INTERNAL` | Limits access to internal/invited users |
| `AI_PROVIDER` | `stub` | `anthropic` | Real provider for beta; `stub` for staging |
| `EMAIL_PROVIDER` | `stub` | `resend` | Real email for production; `stub` for staging |
| `BILLING_CHARGES_ENABLED` | `false` | `false` | MUST remain false — no charging for beta |
| `STRIPE_PROVIDER_MODE` | `disabled` | `disabled` | MUST remain disabled — no Stripe for beta |
| `ABORT_MODE` | `NONE` | `NONE` | No abort mode active |
| `ENABLE_PREVIEW_ACCESS_CONTROL` | `false` | Evaluate `true` | Consider enabling for user isolation |
| `NEXT_PUBLIC_PROJECT_FIRST_UX` | `false` | `false` | Not active |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | unset | `false` | MUST be false in production |
| `AGENT_HARNESS_STUB_WRITE_MODE` | `false` | `false` | MUST remain false — canary/test only |

---

## 12. Write-Tool Beta Activation Decision

### Question 10: Recommended safe state for write-tool flags

| Flag | Safe Default | Staging | Production |
|------|-------------|---------|------------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | `true` | `true` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | `true` | `true` |

### Question 11: Should `AGENT_HARNESS_ENABLE_TOOL_LOOP` be enabled for beta?

**YES** — with the following rationale:

- The tool loop is the core of the AI agent experience. Without it, the agent cannot iterate on file operations.
- AGENT-HARNESS-06C/06D/06E read-only canaries all PASS.
- AGENT-HARNESS-WRITE-CANARY live E2E write canary PASS (2026-07-20).
- The flag is a strict boolean parsed by `parseStrictBooleanEnv` — invalid values cause startup failure (fail-fast).
- The flag is environment-scoped — restart required to change.

### Question 12: Should `AGENT_HARNESS_ENABLE_WRITE_TOOLS` be enabled for beta?

**YES** — with the following rationale:

- Write operations are essential for the "build software with AI" product promise.
- Live E2E write canary PASS — `write_file` + `read_file` + checkpoint verified.
- Safety boundaries: `requireApprovalForDelete`, `requireApprovalForPackageInstall`, `requireApprovalForEnvFileWrite`, `requireApprovalForLargeWrite` all default `true`.
- `allowArbitraryShell` defaults `false`.
- All file operations are sandboxed within the user's container workspace.
- Pre-apply checkpoint (`enablePreApplyCheckpoint: true`) creates a git checkpoint before write operations.
- Audit events enabled (`auditEventsEnabled: true`).

### Question 13: Kill switch to disable write tools quickly

**Primary kill switch:** Set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` in AI Service Worker environment and restart the worker process.

**Secondary kill switch:** Set `GLOBAL_EXECUTION_ENABLED=false` on API Gateway to block all AI execution (more drastic — stops read-only operations too).

**Fastest kill switch (no restart):** If the AI Service Worker process is managed by a process manager (PM2/systemd), stop the worker process entirely. New jobs queue in Redis but are not processed. Resume by restarting.

---

## 13. Provider / Payment / Stripe / Customer-Portal / Webhook Decision

### Decision: ALL REMAIN DISABLED FOR BETA

| Item | Beta Status | Env Setting |
|------|-------------|-------------|
| Stripe SDK | NOT INSTALLED — no `stripe` package in any `package.json` | N/A |
| `STRIPE_PROVIDER_MODE` | `disabled` | MUST remain `disabled` |
| `BILLING_CHARGES_ENABLED` | `false` | MUST remain `false` |
| `STRIPE_SECRET_KEY` | Not set | Do NOT set |
| `STRIPE_WEBHOOK_SECRET` | Not set | Do NOT set |
| Customer portal backend | Not implemented | No endpoint exists |
| Webhook live testing | Not activated | Code tested (108/108 PASS) but no real events |
| Real payment charges | Impossible | Provider disabled + charges disabled + no Stripe SDK |

No Stripe/payment/provider/customer-portal/webhook activation for limited beta. Free-tier only.

---

## 14. Health / Readiness Endpoint Plan

### API Gateway (`:4000`)

| Endpoint | Path | Purpose | Expected Response |
|----------|------|---------|-------------------|
| Health | `GET /health` | Basic liveness | `{ status: 'ok', service: 'api-gateway' }` |
| DB Health | `GET /health/db` | Database connectivity | `{ status: 'ok', database: 'connected' }` |
| Readiness | `GET /health/ready` | Full readiness (env + DB + kill switches + safety limits) | `{ status: 'ready', checks: { environment: 'validated', database: 'connected', killSwitches: 'loaded', safetyLimits: 'loaded' } }` |

### Container Manager (`:4002`)

| Endpoint | Path | Purpose | Expected Response |
|----------|------|---------|-------------------|
| Health | `GET /health` | Basic liveness | `{ status: 'ok', service: 'container-manager' }` |

### AI Service Worker (`:4001`)

- No dedicated health endpoint observed in main.ts beyond NestJS default.
- Worker health is inferred from BullMQ job processing activity.
- **Recommendation for Step 3:** Consider adding a basic `GET /health` endpoint to AI Service if not already present, or rely on process manager health checks.

### PostgreSQL

- Health via Docker healthcheck: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` (already in docker-compose.yml).

### Redis

- Health via Docker healthcheck: `redis-cli -a $REDIS_PASSWORD ping` (already in docker-compose.yml).

### Reverse Proxy

- Health endpoint pass-through: proxy `GET /health` to API Gateway and verify `200 OK`.

---

## 15. Startup Order

| # | Service | Depends On | Start Command |
|---|---------|-----------|---------------|
| 1 | PostgreSQL | — | Docker container; wait for healthcheck PASS |
| 2 | Redis | — | Docker container; wait for healthcheck PASS |
| 3 | API Gateway | PostgreSQL, Redis | `node dist/main.js` — wait for `GET /health/ready` 200 |
| 4 | Container Manager | API Gateway | `node dist/main.js` — wait for `GET /health` 200 |
| 5 | AI Service Worker | PostgreSQL, Redis, API Gateway | `node dist/main.js` — wait for process start |
| 6 | Frontend (Next.js) | API Gateway | `next start` — wait for HTTP 200 on `/` |
| 7 | Reverse Proxy | Frontend, API Gateway | Caddy/nginx — wait for TLS cert and port 443 |
| 8 | Prometheus (optional) | API Gateway | Docker container |
| 9 | Grafana (optional) | Prometheus | Docker container |

**Shutdown order:** Reverse of startup. Stop reverse proxy first, then frontend, then AI Service Worker (drain queue), then Container Manager (stop containers gracefully), then API Gateway, then Redis, then PostgreSQL.

---

## 16. Rollback / Kill-Switch Plan

### Immediate kill switches (no deployment needed)

| # | Action | Effect | How |
|---|--------|--------|-----|
| K1 | Stop AI Service Worker process | No new AI executions processed; jobs queue in Redis | `systemctl stop aisandbox-worker` or `pm2 stop worker` |
| K2 | Set `GLOBAL_EXECUTION_ENABLED=false` + restart API Gateway | All AI execution requests return 503 | Env change + restart |
| K3 | Set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` + restart AI Worker | Write tools disabled; read-only operations continue | Env change + restart |
| K4 | Set `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` + restart AI Worker | Tool loop disabled entirely | Env change + restart |
| K5 | Set `LAUNCH_STATE=CLOSED` + restart API Gateway | Platform access denied to all users | Env change + restart |
| K6 | Stop reverse proxy | No external traffic reaches any service | `systemctl stop caddy` |

### Rollback plan

| Scenario | Action |
|----------|--------|
| Bad deployment | Revert to previous code version via git; restart services |
| Database migration failure | Run `migration:revert`; restart API Gateway |
| Security breach | K5 + K6 immediately; investigate; rotate secrets; redeploy |
| Provider cost runaway | K1 or K2 immediately; investigate usage records |
| Data corruption | Stop all services; restore PostgreSQL from backup; restart |

### Data backup (minimum for beta)

- PostgreSQL: `pg_dump` scheduled nightly (cron job or manual)
- Redis: RDB snapshot (default Redis persistence)
- Git repositories: already in Docker volumes; backup volume directory
- **Step 3 should create a simple backup script or document the commands.**

---

## 17. Monitoring / Logging Minimums

### Required for beta launch

| # | Item | Implementation |
|---|------|----------------|
| M1 | Service process monitoring | Process manager (PM2/systemd) with auto-restart on crash |
| M2 | Disk space monitoring | Basic cron alert if disk usage exceeds 80% |
| M3 | PostgreSQL connection monitoring | `GET /health/db` periodic check |
| M4 | Application error logging | NestJS structured logging to stdout/stderr; capture via journald or PM2 logs |
| M5 | API Gateway readiness | `GET /health/ready` periodic check |

### Recommended (can follow shortly after beta start)

| # | Item | Implementation |
|---|------|----------------|
| M6 | Prometheus metrics collection | Already configured in docker-compose.yml |
| M7 | Grafana dashboards | Already configured in docker-compose.yml |
| M8 | prom-client metrics (AI Service) | Already a dependency in ai-service |
| M9 | API Gateway runtime metrics | `GET /api/runtime/metrics` endpoint exists |

### Deferred (post limited-beta)

| # | Item |
|---|------|
| M10 | External uptime monitoring (Uptime Robot, Pingdom) |
| M11 | PagerDuty / Slack alerting integration |
| M12 | Log aggregation (ELK, CloudWatch Logs) |
| M13 | APM (Application Performance Monitoring) |

---

## 18. Deployment Documentation / Template Plan

### Config templates to create in Step 3

| # | File | Purpose |
|---|------|---------|
| T1 | `.env.staging.example` | Staging environment template — key names + safe defaults, no real secret values |
| T2 | `.env.production.example` | Production environment template — key names + safe defaults, no real secret values |
| T3 | `docs/DEPLOYMENT-GUIDE.md` | Step-by-step deployment guide for single-server limited beta |

### Deployment guide contents (Step 3)

1. Server prerequisites (OS, Docker, Node.js, DNS)
2. Repository clone and build
3. Environment file creation (from templates)
4. Database setup and migration
5. Service startup (startup order per Section 15)
6. TLS/HTTPS configuration
7. Health verification
8. Backup configuration
9. Process management (PM2/systemd)
10. Kill switch reference
11. Monitoring setup
12. Troubleshooting

### What the deployment guide must NOT contain

- Real secret values
- Real API keys
- Real OAuth credentials
- Real database passwords
- IP addresses of any real server

---

## 19. Validation Plan

### Validation that can be done without exposing secrets (Step 3)

| # | Validation | Method |
|---|-----------|--------|
| V1 | Config templates are syntactically valid | Review `.env.*.example` files — key names only |
| V2 | All required keys are listed in templates | Cross-reference with Section 9 checklist |
| V3 | Deployment guide is complete and internally consistent | Document review |
| V4 | Templates do not contain real secret values | Automated/manual scan |
| V5 | Templates reference correct service ports | Cross-reference with service `main.ts` files |
| V6 | Kill switch / safety limit keys are documented | Cross-reference with source |
| V7 | Startup order documented and matches service dependencies | Cross-reference with Section 15 |
| V8 | Rollback procedure documented | Cross-reference with Section 16 |

### Validation that requires Keith / manual secret setup

| # | Validation | Who | When |
|---|-----------|-----|------|
| V9 | Provision real API keys (Anthropic, OpenAI) | Keith | Before staging deployment |
| V10 | Provision Google OAuth credentials | Keith | Before staging deployment |
| V11 | Provision Resend API key and verified sender domain | Keith | Before staging deployment |
| V12 | Provision server and DNS for `ainow.biz` | Keith | Before staging deployment |
| V13 | Generate and set all secret keys per environment | Keith | Before staging deployment |
| V14 | Execute migrations on staging database | Keith | During staging deployment |
| V15 | Run `GET /health/ready` on staging API Gateway | Keith | After staging deployment |
| V16 | Run full pre-beta smoke test (B3) | Keith + AI assistant | After staging deployment — separate task |

---

## 20. Manual Keith-Only Steps

| # | Step | Reason |
|---|------|--------|
| K1 | Provision server (VPS/dedicated Linux) | Infrastructure cost decision |
| K2 | Configure DNS A record for `ainow.biz` | Domain registrar access |
| K3 | Generate and store all secret values | Secret ownership |
| K4 | Provision Google OAuth client ID/secret | Google Cloud Console access |
| K5 | Provision Apple OAuth credentials (optional) | Apple Developer account access |
| K6 | Provision Resend API key and verify sender domain | Resend dashboard access |
| K7 | Provision AI provider API keys (Anthropic, OpenAI, optionally others) | Provider account access |
| K8 | Create `.env` files on server from templates + real secrets | Secret values |
| K9 | Execute database migrations on staging | First-time data safety |
| K10 | Verify TLS certificate is valid | Domain ownership verification |
| K11 | Set `LAUNCH_STATE=INTERNAL` and validate | Access control decision |
| K12 | Enable `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` and `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` in production env | Write path activation decision |
| K13 | Invite initial beta users | User selection decision |

---

## 21. B3 Handoff Requirements

Before B3 (pre-beta full-stack live smoke — separate task) can execute:

| # | Requirement | Owner |
|---|-------------|-------|
| H1 | BETA-READY-DEPLOYMENT-CONFIG Step 3 COMPLETE (config templates + deployment guide) | This task |
| H2 | Staging server provisioned and accessible | Keith |
| H3 | DNS configured for staging domain (or IP-based access) | Keith |
| H4 | All secrets provisioned on staging | Keith |
| H5 | Migrations executed on staging database | Keith |
| H6 | All services started and health checks PASS on staging | Keith |
| H7 | TLS/HTTPS working | Keith |
| H8 | `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` on staging worker | Keith |
| H9 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` on staging worker | Keith |
| H10 | B3 task registered with Keith explicit approval | Keith + AI assistant |

---

## 22. Stop Conditions

Stop Step 3 implementation immediately if:

| # | Condition |
|---|-----------|
| S1 | Real secret values would need to be written to a repo-tracked file |
| S2 | A source code change is needed beyond config templates and deployment docs |
| S3 | A migration or schema change is needed |
| S4 | Docker, PostgreSQL, Redis, or any service needs to be started |
| S5 | A test or build needs to run |
| S6 | Stripe/payment/provider/customer-portal/webhook activation is needed |
| S7 | The scope exceeds config templates + deployment guide creation |

---

## 23. Split Decision for Step 3

### Question 20: Is Step 3 safe as one implementation step, or should it split into smaller child slices?

**Decision: Step 3 is safe as ONE implementation step.**

**Rationale:**

- Step 3 creates only documentation and config template files.
- No source code changes.
- No runtime, no services started, no migrations.
- The deliverables are:
  1. `.env.staging.example` — template file with key names and safe placeholder values
  2. `.env.production.example` — template file with key names and safe placeholder values
  3. `docs/DEPLOYMENT-GUIDE.md` — deployment documentation
- All three are independent documentation artifacts with no service dependencies.
- Total scope is bounded and low-risk for a documentation-only step.

**If Step 3 encounters any stop condition (Section 22), split at that point.**

---

## 24. Exact Step 3 Scope Proposal

### Files to create (Step 3)

| # | File | Contents |
|---|------|----------|
| 1 | `.env.staging.example` | All keys from Section 9 with staging-appropriate safe defaults; placeholder values for secrets; comments explaining each key |
| 2 | `.env.production.example` | All keys from Section 9 with production-appropriate safe defaults; placeholder values for secrets; comments explaining each key |
| 3 | `docs/DEPLOYMENT-GUIDE.md` | Single-server limited-beta deployment guide per Section 18; key names only; no real secrets |

### Files NOT to create or modify

- No source files
- No test files
- No translation files
- No `package.json` files
- No `docker-compose.yml` changes
- No migration files
- No entity/schema files
- No real `.env` files
- No governance file updates (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) — deferred to Step 4

### Validation in Step 3

- V1–V8 (document review, key name cross-reference, no-secret scan) — all without starting services.

---

## 25. Safety Confirmations

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | No source/test/translation/package/migration/entity/environment/Docker files changed | CONFIRMED |
| 2 | No runtime, Docker, DB, browser, API, test, build, provider, payment, Stripe CLI, webhook, git commit, or git push occurred | CONFIRMED |
| 3 | No secret-bearing environment file opened | CONFIRMED |
| 4 | No subagents were used | CONFIRMED |
| 5 | No real secret values appear in this document | CONFIRMED |
| 6 | No Stripe/payment/provider/customer-portal/webhook activation recommended | CONFIRMED |
| 7 | `BILLING_CHARGES_ENABLED` remains `false` for beta | CONFIRMED |
| 8 | `STRIPE_PROVIDER_MODE` remains `disabled` for beta | CONFIRMED |
| 9 | `AGENT_HARNESS_STUB_WRITE_MODE` remains `false` in production | CONFIRMED |
| 10 | All prior locked tasks remain COMPLETE and LOCKED | CONFIRMED |
| 11 | Full beta readiness not claimed | CONFIRMED |
| 12 | B3 pre-beta full-stack live smoke remains pending | CONFIRMED |

---

## 26. Exact Next Action

**Step 3 — Implementation**

Create the three documentation/template files defined in Section 24:

1. `.env.staging.example`
2. `.env.production.example`
3. `docs/DEPLOYMENT-GUIDE.md`

Then validate (V1–V8) by document review only — no services started, no secrets, no runtime.

Step 3 should use a 3-step loop (normal bounded feature):
1. Registration/activation — already ACTIVE
2. Implementation — create the three files + validate
3. Consolidation/checkpoint — update TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md, create checkpoint

Step 3 should NOT register B3 or any other task. B3 registration requires Keith explicit approval after this task completes.
