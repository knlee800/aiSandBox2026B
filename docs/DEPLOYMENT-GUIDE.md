# Deployment Guide — aiSandBox Platform (ainow.biz)

**Task:** BETA-READY-DEPLOYMENT-CONFIG Step 3
**Date:** 2026-07-20
**Status:** Limited beta deployment guide — documentation only

---

## 1. Purpose and Current Beta-Readiness State

This guide covers single-server deployment of the aiSandBox platform for **limited beta**.

### Current state

- **BETA-READY-00** COMPLETE and LOCKED — 2026-07-19. Launch decision: READY FOR LIMITED BETA WITH LIMITATIONS.
- **B1 (Agent Harness write path):** Resolved at canary-readiness level. First live E2E write canary PASS. Safe default remains disabled. Permanent activation is a deployment/configuration decision.
- **B2 (Production/staging deployment config):** This guide addresses B2.
- **B3 (Pre-beta full-stack live smoke):** Pending — separate task after B2.
- **Stripe/payment/provider:** Not activated. Provider disabled. `BILLING_CHARGES_ENABLED=false`. No Stripe SDK installed.
- **Customer portal:** "Coming soon" UI only. No backend endpoint.

### Non-goals of this deployment

- No Stripe live activation.
- No beta invitation yet.
- No public launch.
- No full beta readiness declaration.

---

## 2. Deployment Topology

### Architecture

```
Internet → Reverse Proxy (Caddy/nginx) :443 HTTPS
              ├─→ Frontend (Next.js)           :3002
              └─→ API Gateway (NestJS)         :4000

[Internal only — never exposed to internet]
              ├── AI Service Worker (NestJS)    :4001
              ├── Container Manager (NestJS)    :4002
              ├── PostgreSQL 15                 :5432
              ├── Redis 7                       :6379
              └── Docker Engine                 (socket)

[Optional monitoring — internal/operator only]
              ├── Prometheus                    :9090
              └── Grafana                       :3000
```

### Key topology rules

- Frontend rewrites `/api/*` to API Gateway via `next.config.js` (`API_GATEWAY_URL`).
- API Gateway is the sole user-facing backend. All internal services communicate through it.
- AI Service Worker connects to Redis (BullMQ queue) and PostgreSQL. It calls API Gateway `/api/internal/*` endpoints.
- Container Manager manages Docker containers and calls API Gateway `/api/internal/*` endpoints.
- All `/api/internal/*` routes are protected by `InternalServiceAuthGuard` (shared `INTERNAL_SERVICE_KEY`).
- The reverse proxy terminates TLS for `ainow.biz` and forwards to frontend/API Gateway.

### Self-hosted single Linux server

For limited beta (< 10 users), all services run on a single Linux server:

| Component | Hosting |
|-----------|---------|
| All services | Single Linux server (Ubuntu 22.04+ recommended) |
| PostgreSQL | Docker container on the same server |
| Redis | Docker container on the same server |
| Docker Engine | Host-installed (required for container-manager) |
| TLS/HTTPS | Caddy or nginx with Let's Encrypt auto-cert for `ainow.biz` |
| DNS | `ainow.biz` A record pointing to server IP |

---

## 3. Service Inventory

| # | Service | Port | Required? | Role |
|---|---------|------|-----------|------|
| 1 | Frontend (Next.js) | 3002 | YES | User-facing web application |
| 2 | API Gateway (NestJS) | 4000 | YES | Auth, sessions, billing, AI execution orchestration, WebSocket, health |
| 3 | AI Service Worker (NestJS) | 4001 | YES | BullMQ worker — AI provider calls, agent harness tool loop, file ops |
| 4 | Container Manager (NestJS) | 4002 | YES | Docker container lifecycle, file system ops, preview, git checkpoints |
| 5 | PostgreSQL 15 | 5432 | YES | Primary data store |
| 6 | Redis 7 | 6379 | YES | BullMQ job queue, execution streaming |
| 7 | Docker Engine | socket | YES | User sandbox containers (gVisor isolation) |
| 8 | Reverse Proxy / TLS | 443 | YES | HTTPS, domain routing, rate limiting edge |
| 9 | Prometheus | 9090 | RECOMMENDED | Metrics collection (configured in docker-compose.yml) |
| 10 | Grafana | 3000 | OPTIONAL | Dashboard visualization (configured in docker-compose.yml) |

---

## 4. Hosted vs Self-Hosted Decision

### Recommendation: Self-hosted single-server for limited beta

**Rationale:**

- Limited beta targets a small number of invited users.
- Container Manager requires direct Docker socket access (`/var/run/docker.sock`).
- Cloud container orchestration (Kubernetes, ECS) adds unnecessary complexity at this scale.

**Not recommended for limited beta:**

- Kubernetes / ECS / managed container orchestration
- Managed DB / managed Redis (cost overhead at this scale)
- Multi-server / load-balanced deployment
- CDN (unnecessary until public beta)

**Scaling path (post limited beta):** Managed PostgreSQL, managed Redis, container orchestration, CDN, multi-server.

---

## 5. Environment Model

| # | Environment | Purpose | Exists Today? |
|---|-------------|---------|---------------|
| 1 | Local Development | Developer workstation; localhost services; stub provider | YES |
| 2 | Staging | Pre-production validation; test provider keys; smoke testing | NO — to be created |
| 3 | Production | Live limited beta; real users; real provider keys | NO — to be created |

Staging is required before production. Even at limited-beta scale, staging validates deployment configuration, migration execution, and smoke tests before exposing to real users.

---

## 6. Env File Handling

### Templates

| File | Purpose |
|------|---------|
| `.env.staging.example` | Staging template — key names + safe defaults, no secrets |
| `.env.production.example` | Production template — key names + safe defaults, no secrets |

### Rules

1. **Key names only in repo templates.** No real secret values in any committed file.
2. **Real values only on server.** Copy the template to `.env` on the server, then replace placeholder values.
3. **Restrict file permissions.** Server `.env` files must be `chmod 600` (owner read/write only).
4. **Keith-only provisioning.** All real API keys, OAuth credentials, email provider credentials, and database passwords are provisioned by Keith manually.
5. **Unique secrets per environment.** Staging and production must use different secret values.
6. **Never commit `.env` files.** The `.gitignore` must exclude `.env`, `.env.local`, and any real env files.

### Creating server env files

```bash
# On the server:
cp .env.production.example .env
chmod 600 .env

# Edit .env and replace all SET_ON_SERVER_ONLY / CHANGE_ME with real values
# Use the secret generation commands below
```

---

## 7. Secret-Bearing Key Checklist by Service

### Keys requiring Keith-only provisioning

| Key | Service(s) | Generation |
|-----|-----------|------------|
| `POSTGRES_PASSWORD` | Root / shared | `openssl rand -hex 32` |
| `REDIS_PASSWORD` | Root / shared | `openssl rand -hex 32` |
| `INTERNAL_SERVICE_KEY` | API Gateway, AI Service, Container Manager | `openssl rand -hex 32` |
| `JWT_SECRET` | API Gateway, Container Manager | `openssl rand -hex 64` |
| `SESSION_SECRET` | API Gateway | `openssl rand -hex 64` |
| `OAUTH_STATE_SECRET` | API Gateway | `openssl rand -hex 64` |
| `GOOGLE_CLIENT_ID` | API Gateway | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | API Gateway | Google Cloud Console |
| `APPLE_CLIENT_ID` | API Gateway | Apple Developer (optional for beta) |
| `APPLE_TEAM_ID` | API Gateway | Apple Developer (optional for beta) |
| `APPLE_KEY_ID` | API Gateway | Apple Developer (optional for beta) |
| `APPLE_PRIVATE_KEY` | API Gateway | Apple Developer (optional for beta) |
| `RESEND_API_KEY` | API Gateway | Resend dashboard |
| `ANTHROPIC_API_KEY` | API Gateway, AI Service | Anthropic console |
| `OPENAI_API_KEY` | API Gateway, AI Service | OpenAI platform |
| `GROQ_API_KEY` | AI Service | Groq console (optional) |
| `XAI_API_KEY` | AI Service | xAI console (optional) |
| `DEEPSEEK_API_KEY` | AI Service | DeepSeek platform (optional) |
| `DATABASE_URL` | AI Service | Constructed (contains password) |
| `REDIS_URL` | AI Service | Constructed (contains password) |

### Secret generation commands (Keith executes on server)

```bash
# Generate each secret — run once per environment
openssl rand -hex 64   # JWT_SECRET
openssl rand -hex 64   # SESSION_SECRET
openssl rand -hex 64   # OAUTH_STATE_SECRET
openssl rand -hex 32   # INTERNAL_SERVICE_KEY
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # REDIS_PASSWORD
```

---

## 8. Public Frontend Key Checklist

These keys are safe for browser exposure (via `NEXT_PUBLIC_` prefix or non-secret values):

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_PROJECT_FIRST_UX` | `false` | Feature flag — not active |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | `false` | MUST be false in production |
| `API_GATEWAY_URL` | `http://api-gateway:4000` | Server-side only (Next.js rewrites) |

---

## 9. Safe Feature-Flag Plan

| Flag | Staging | Production | Notes |
|------|---------|------------|-------|
| `NODE_ENV` | `production` | `production` | Standard |
| `LAUNCH_STATE` | `INTERNAL` | `INTERNAL` | Limited beta access |
| `AI_PROVIDER` | `stub` | `anthropic` | Real provider for prod; stub for staging |
| `EMAIL_PROVIDER` | `stub` | `resend` | Real email for prod; stub for staging |
| `BILLING_CHARGES_ENABLED` | `false` | `false` | MUST remain false for beta |
| `STRIPE_PROVIDER_MODE` | `disabled` | `disabled` | MUST remain disabled for beta |
| `ABORT_MODE` | `NONE` | `NONE` | No abort mode |
| `ENABLE_PREVIEW_ACCESS_CONTROL` | `false` | Evaluate `true` | Consider for user isolation |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | `false` | `false` | MUST be false |
| `AGENT_HARNESS_STUB_WRITE_MODE` | `false` | `false` | MUST remain false — test only |

---

## 10. Write-Tool Beta Activation Decision

### Decision: ENABLED for limited beta

| Flag | Staging | Production |
|------|---------|------------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | `true` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `true` | `true` |

### Rationale

- The tool loop is the core of the AI agent experience.
- Write operations are essential for the "build software with AI" product promise.
- Live E2E write canary PASS (AGENT-HARNESS-WRITE-CANARY — 2026-07-20).
- Read-only canaries PASS (AGENT-HARNESS-06C/06D/06E).

### Safety boundaries protecting write tools

- All file operations sandboxed within user's container workspace.
- Approval gates default `true`: `requireApprovalForDelete`, `requireApprovalForPackageInstall`, `requireApprovalForEnvFileWrite`, `requireApprovalForLargeWrite`.
- `allowArbitraryShell` defaults `false`.
- Pre-apply checkpoint (`enablePreApplyCheckpoint: true`) creates git checkpoint before writes.
- Audit events enabled (`auditEventsEnabled: true`).

### Kill switch to disable write tools

1. Set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` in AI Service Worker `.env`
2. Restart AI Service Worker process
3. Read-only operations continue; write operations blocked immediately.

### Kill switch to disable all tool operations

1. Set `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` in AI Service Worker `.env`
2. Restart AI Service Worker process
3. All tool dispatch disabled; AI returns text-only responses.

### Fastest kill (no restart needed)

Stop the AI Service Worker process entirely. New jobs queue in Redis but are not processed. Resume by restarting the worker.

---

## 11. Provider / Payment / Stripe / Customer-Portal / Webhook

### Decision: ALL REMAIN DISABLED FOR BETA

| Item | Status | Setting |
|------|--------|---------|
| Stripe SDK | NOT INSTALLED | N/A |
| `STRIPE_PROVIDER_MODE` | `disabled` | MUST remain `disabled` |
| `BILLING_CHARGES_ENABLED` | `false` | MUST remain `false` |
| `STRIPE_SECRET_KEY` | Not set | Do NOT set |
| `STRIPE_WEBHOOK_SECRET` | Not set | Do NOT set |
| Customer portal backend | Not implemented | No endpoint exists |
| Webhook live testing | Not activated | Code tested (108/108 PASS) but no real events |

Free-tier only for limited beta. No payment charges possible.

---

## 12. Ports and Exposure

### Public-facing (via reverse proxy only)

| Service | Port | Exposure |
|---------|------|----------|
| Frontend (Next.js) | 3002 | Public via reverse proxy on port 443 (HTTPS) |
| API Gateway `/api/*` | 4000 | Public via reverse proxy on port 443 (HTTPS) |

### Internal-only (never exposed to internet)

| Service | Port | Exposure |
|---------|------|----------|
| AI Service Worker | 4001 | Internal network only |
| Container Manager | 4002 | Internal network only |
| PostgreSQL | 5432 | Internal network only |
| Redis | 6379 | Internal network only |
| Docker Engine | socket | Host-only |
| Prometheus | 9090 | Internal/operator only |
| Grafana | 3000 | Internal/operator only |

### Firewall rules

Only ports 80 and 443 should be open to the internet. All other ports must be firewalled to internal access only.

---

## 13. Health and Readiness Checks

### API Gateway (`:4000`)

| Endpoint | Path | Purpose | Expected Response |
|----------|------|---------|-------------------|
| Health | `GET /health` | Basic liveness | `{ status: 'ok', service: 'api-gateway' }` |
| DB Health | `GET /health/db` | Database connectivity | `{ status: 'ok', database: 'connected' }` |
| Readiness | `GET /health/ready` | Full readiness check | `{ status: 'ready', checks: { environment: 'validated', database: 'connected', killSwitches: 'loaded', safetyLimits: 'loaded' } }` |

### Container Manager (`:4002`)

| Endpoint | Path | Purpose | Expected Response |
|----------|------|---------|-------------------|
| Health | `GET /health` | Basic liveness | `{ status: 'ok', service: 'container-manager' }` |

### AI Service Worker (`:4001`)

- No dedicated health endpoint beyond NestJS default.
- Worker health inferred from BullMQ job processing activity.
- Use process manager health checks (PM2/systemd).

### PostgreSQL

- Docker healthcheck: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`
- Already configured in `docker-compose.yml`.

### Redis

- Docker healthcheck: `redis-cli -a $REDIS_PASSWORD ping`
- Already configured in `docker-compose.yml`.

### Reverse proxy

- Pass-through: proxy `GET /health` to API Gateway and verify `200 OK`.

---

## 14. Startup Order

Start services in this exact order. Wait for each service's health check before starting the next.

| # | Service | Depends On | Start Command | Health Check |
|---|---------|-----------|---------------|--------------|
| 1 | PostgreSQL | — | `docker compose up -d postgres` | `pg_isready` healthcheck PASS |
| 2 | Redis | — | `docker compose up -d redis` | `redis-cli ping` healthcheck PASS |
| 3 | API Gateway | PostgreSQL, Redis | `node dist/main.js` (or PM2/systemd) | `GET /health/ready` returns 200 |
| 4 | Container Manager | API Gateway | `node dist/main.js` (or PM2/systemd) | `GET /health` returns 200 |
| 5 | AI Service Worker | PostgreSQL, Redis, API Gateway | `node dist/main.js` (or PM2/systemd) | Process start confirmed |
| 6 | Frontend (Next.js) | API Gateway | `next start -p 3002` (or PM2/systemd) | HTTP 200 on `/` |
| 7 | Reverse Proxy | Frontend, API Gateway | `systemctl start caddy` (or nginx) | TLS cert valid; port 443 listening |
| 8 | Prometheus (optional) | API Gateway | `docker compose up -d prometheus` | Port 9090 reachable |
| 9 | Grafana (optional) | Prometheus | `docker compose up -d grafana` | Port 3000 reachable |

---

## 15. Shutdown Order

Shutdown in reverse of startup. Graceful shutdown preserves data and drains queues.

| # | Service | Action | Notes |
|---|---------|--------|-------|
| 1 | Reverse Proxy | `systemctl stop caddy` | Stops external traffic immediately |
| 2 | Frontend | Stop process (PM2/systemd) | No new page loads |
| 3 | AI Service Worker | Stop process (PM2/systemd) | Drain: let running jobs finish or timeout |
| 4 | Container Manager | Stop process (PM2/systemd) | Stop user containers gracefully |
| 5 | API Gateway | Stop process (PM2/systemd) | Close connections |
| 6 | Redis | `docker compose stop redis` | RDB snapshot auto-saved |
| 7 | PostgreSQL | `docker compose stop postgres` | Clean shutdown |

**IMPORTANT:** Use `docker compose stop` (not `docker compose down -v`). Volumes must be preserved.

---

## 16. Rollback and Kill Switches

### Immediate kill switches (no deployment needed)

| # | Action | Effect | How |
|---|--------|--------|-----|
| K1 | Stop AI Service Worker | No new AI executions; jobs queue in Redis | `systemctl stop aisandbox-worker` or `pm2 stop worker` |
| K2 | `GLOBAL_EXECUTION_ENABLED=false` + restart API Gateway | All AI execution returns 503 | Env change + restart |
| K3 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` + restart AI Worker | Write tools disabled; read-only continues | Env change + restart |
| K4 | `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` + restart AI Worker | Tool loop disabled entirely | Env change + restart |
| K5 | `LAUNCH_STATE=CLOSED` + restart API Gateway | Platform access denied to all users | Env change + restart |
| K6 | Stop reverse proxy | No external traffic reaches any service | `systemctl stop caddy` |

### Rollback scenarios

| Scenario | Action |
|----------|--------|
| Bad deployment | Revert to previous code version via git; rebuild; restart services |
| Database migration failure | `npm run migration:revert` in api-gateway; restart API Gateway |
| Security breach | K5 + K6 immediately; investigate; rotate all secrets; redeploy |
| Provider cost runaway | K1 or K2 immediately; investigate usage records |
| Data corruption | Stop all services; restore PostgreSQL from backup; restart |

### Data backup (minimum for beta)

- **PostgreSQL:** `pg_dump` scheduled nightly via cron or manual
- **Redis:** RDB snapshot (default Redis persistence)
- **Git repositories:** Stored in Docker volumes; backup the volume directory
- **Backup retention:** Keep at least 7 daily backups

```bash
# Example nightly PostgreSQL backup (add to cron)
pg_dump -h localhost -U aisandbox -d aisandbox | gzip > /backups/aisandbox-$(date +%Y%m%d).sql.gz
```

---

## 17. Monitoring and Logging Minimums

### Required for beta launch

| # | Item | Implementation |
|---|------|----------------|
| M1 | Service process monitoring | PM2 or systemd with auto-restart on crash |
| M2 | Disk space monitoring | Cron alert if disk usage exceeds 80% |
| M3 | PostgreSQL connection monitoring | Periodic `GET /health/db` check |
| M4 | Application error logging | NestJS structured logging to stdout/stderr; capture via journald or PM2 logs |
| M5 | API Gateway readiness | Periodic `GET /health/ready` check |

### Recommended (follow shortly after beta start)

| # | Item | Implementation |
|---|------|----------------|
| M6 | Prometheus metrics collection | Already configured in `docker-compose.yml` |
| M7 | Grafana dashboards | Already configured in `docker-compose.yml` |
| M8 | prom-client metrics (AI Service) | Already a dependency in `ai-service` |
| M9 | API Gateway runtime metrics | `GET /api/runtime/metrics` endpoint exists |

### Deferred (post limited-beta)

| # | Item |
|---|------|
| M10 | External uptime monitoring (Uptime Robot, Pingdom) |
| M11 | PagerDuty / Slack alerting integration |
| M12 | Log aggregation (ELK, CloudWatch Logs) |
| M13 | APM (Application Performance Monitoring) |

---

## 18. Validation Plan (V1–V8) — Document Review Only

These validations are performed by document/template review. No runtime commands.

| # | Validation | Method |
|---|-----------|--------|
| V1 | Config templates syntactically valid and sectioned | Review `.env.*.example` files |
| V2 | All required key names present in templates | Cross-reference with Stage-Start Section 9 |
| V3 | No real-looking secrets in templates | Manual scan of all template values |
| V4 | Ports match the Stage-Start plan | Cross-reference with service `main.ts` files |
| V5 | Health endpoints match repo evidence | Cross-reference with health controller source |
| V6 | Kill switches documented | Cross-reference with `kill-switch.config.ts` |
| V7 | Startup/shutdown order documented | Cross-reference with service dependencies |
| V8 | B3 handoff requirements documented | Cross-reference with Stage-Start Section 21 |

---

## 19. Keith / Manual-Only Steps (K1–K13)

These steps require Keith's manual action. They cannot be automated or delegated to AI.

| # | Step | Reason |
|---|------|--------|
| K1 | Provision server (VPS/dedicated Linux) | Infrastructure cost decision |
| K2 | Configure DNS A record for `ainow.biz` | Domain registrar access |
| K3 | Generate and store all secret values on server | Secret ownership |
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

## 20. B3 Handoff Requirements (H1–H10)

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

## 21. Explicit Non-Goals

This deployment guide and the current limited beta do NOT include:

1. **No Stripe live activation.** Provider disabled; `BILLING_CHARGES_ENABLED=false`; no Stripe SDK installed.
2. **No beta invitation yet.** Deployment configuration only; users are not invited until B3 passes.
3. **No public launch.** `LAUNCH_STATE=INTERNAL` limits access to invited users.
4. **No full beta readiness declaration.** B2 (this guide) and B3 (pre-beta smoke) must both pass first.
5. **No paid-tier offering.** Free-tier only for limited beta.
6. **No multi-agent collaboration.** Deferred per roadmap.
7. **No external integrations (Gmail/Slack/Notion).** Deferred per roadmap.
8. **No CI/CD pipeline.** Manual deployment for limited beta.
9. **No container registry.** Build from source on server.
10. **No Kubernetes/ECS.** Single-server deployment.

---

## 22. Safety Confirmations

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | No real secret values in this document | CONFIRMED |
| 2 | No real secret values in `.env.staging.example` | CONFIRMED |
| 3 | No real secret values in `.env.production.example` | CONFIRMED |
| 4 | `BILLING_CHARGES_ENABLED=false` for beta | CONFIRMED |
| 5 | `STRIPE_PROVIDER_MODE=disabled` for beta | CONFIRMED |
| 6 | `AGENT_HARNESS_STUB_WRITE_MODE=false` in production | CONFIRMED |
| 7 | Write tools protected by sandboxing, approval gates, checkpointing, audit events, and kill switch | CONFIRMED |
| 8 | Kill switch documented: set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` + restart worker | CONFIRMED |
| 9 | Startup order documented | CONFIRMED |
| 10 | Shutdown order documented | CONFIRMED |
| 11 | Rollback procedure documented | CONFIRMED |
| 12 | B3 handoff requirements documented | CONFIRMED |
| 13 | Keith-only manual steps documented | CONFIRMED |
| 14 | Health/readiness endpoints documented | CONFIRMED |
| 15 | Monitoring minimums documented | CONFIRMED |
