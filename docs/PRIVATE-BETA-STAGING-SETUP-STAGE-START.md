# PRIVATE-BETA-STAGING-SETUP — Step 2 Stage-Start / AWS Lightsail Staging Setup Plan

**Task ID:** PRIVATE-BETA-STAGING-SETUP
**Step:** 2 — Stage-Start / AWS Lightsail Staging Setup Plan
**Status:** COMPLETE — 2026-07-21
**Date:** 2026-07-21
**Nature:** Planning only — no source, test, translation, package, migration, entity, environment, Docker, deployment, or governance files changed in this step.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP |
| Title | Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | HIGH-RISK DEPLOYMENT TARGET PLANNING + FUTURE SETUP |
| Risk | HIGH |
| Step | 2 — Stage-Start / AWS Lightsail Staging Setup Plan |
| Registered | 2026-07-21 |
| Keith Approval | "go" — 2026-07-21 |
| Predecessors | PRIVATE-BETA-DEPLOYMENT-READINESS — BLOCKED / PAUSED after Step 2 — 2026-07-21 |
| | LIMITED-PRIVATE-BETA-HANDOFF — COMPLETE and LOCKED — 2026-07-21 |
| | BETA-READY-SMOKE / B3 — COMPLETE and LOCKED — PASS — 2026-07-21 |
| | BETA-READY-MIGRATION-CLI-01 — COMPLETE and LOCKED — 2026-07-21 |
| | BETA-READY-DEPLOYMENT-CONFIG — COMPLETE and LOCKED — 2026-07-20 |
| Step 1 | COMPLETE — Registration — 2026-07-21 |
| Step 2 | This document — Stage-Start / AWS Lightsail Staging Setup Plan — 2026-07-21 |
| Step 3 | PENDING — Execution / Staging Target Setup |
| Step 4 | PENDING — Consolidation / Handoff Back to Deployment Readiness Verification |

---

## 2. Keith Hosting Decision

| Field | Value |
|-------|-------|
| Provider | **AWS Lightsail** |
| Decision date | 2026-07-21 |
| Target type | Staging / production-like VPS |
| Decision by | Keith |

Keith has selected AWS Lightsail as the hosting provider for the staging / production-like deployment target. This decision is recorded as final for this task and governs all subsequent planning in this document.

---

## 3. Current Blocker

| Field | Value |
|-------|-------|
| Blocking task | PRIVATE-BETA-DEPLOYMENT-READINESS Step 3 |
| Blocker | No staging / production-like target exists |
| Target URL | UNDECIDED |
| Backend deployment | UNKNOWN |
| Frontend deployment | UNKNOWN |
| Resolution path | This task (PRIVATE-BETA-STAGING-SETUP) creates, configures, and verifies a staging target |

PRIVATE-BETA-DEPLOYMENT-READINESS reached Step 2 and produced a staging readiness plan (`docs/PRIVATE-BETA-DEPLOYMENT-READINESS-STAGE-START.md`). Step 3 is BLOCKED because no staging target exists. This task exists to prepare that target.

---

## 4. Goal of Staging Setup

Create a low-cost, single-VPS staging environment on AWS Lightsail that is production-like enough to verify:

- Real DNS/TLS behavior at `staging.ainow.biz`
- Frontend and API Gateway routing through a reverse proxy
- PostgreSQL and Redis connectivity
- Auth/session with real cookies and HTTPS
- Health endpoints returning 200
- Migration status and `user_agents` table existence
- Create Agent create/list/refresh/detail with DB persistence
- Multilingual platform routes (en, zh-TW, zh-CN)
- Kill switch and safety limit behavior
- Rollback/restart path

This is NOT final enterprise production architecture. It is the minimum viable staging target to unblock the private beta invite process.

---

## 5. Recommended AWS Lightsail Architecture

### Single-VPS Topology

```
Internet
  │
  ▼
AWS Lightsail VPS (Singapore region)
  │
  ├─ Caddy (reverse proxy + auto-TLS)  :443 → staging.ainow.biz
  │   ├─→ Frontend (Next.js)            :3002
  │   └─→ API Gateway (NestJS)          :4000  (/api/*)
  │
  ├─ AI Service Worker (NestJS)          :4001  (internal only)
  ├─ Container Manager (NestJS)          :4002  (internal only)
  │
  ├─ PostgreSQL 15                       :5432  (localhost only)
  ├─ Redis 7                             :6379  (localhost only)
  │
  └─ Docker Engine                       (socket — for sandbox containers)
```

### Architecture Rationale

| Factor | Decision |
|--------|----------|
| Single VPS | Low cost; acceptable for < 10 beta users |
| Self-hosted PostgreSQL + Redis | Cost control; no managed service needed for staging |
| Caddy reverse proxy | Automatic Let's Encrypt TLS; minimal configuration |
| All services on one box | Simplicity; matches existing `docs/DEPLOYMENT-GUIDE.md` single-server topology |
| No container orchestration | Docker Engine directly; no Kubernetes/ECS/Fargate overhead for staging |

**This is a low-cost staging/private-beta architecture, not final enterprise production.**

Future migration path: Move PostgreSQL to managed AWS database (RDS/Aurora) and Redis to managed AWS cache (ElastiCache) only after private beta proves the product direction.

---

## 6. Recommended Lightsail Region

| Field | Value |
|-------|-------|
| Recommended region | **ap-southeast-1 (Singapore)** |
| Rationale | Closest AWS region to Keith (assumed Asia-Pacific); low latency for initial testing |
| Fallback | ap-northeast-1 (Tokyo) if Singapore is unavailable in Keith's AWS account |
| Keith decision required | Confirm region availability in AWS account |

---

## 7. Recommended Lightsail Instance Size

| Field | Value |
|-------|-------|
| Recommended instance | **8 GB RAM / 2 vCPUs / 160 GB SSD** |
| Lightsail plan name | `$40/month` Linux plan (approximate pricing as of 2026) |
| Rationale | Runs PostgreSQL, Redis, 3 NestJS services, Next.js frontend, Caddy, and Docker Engine on one VPS |
| Minimum viable | 4 GB RAM may work but risks OOM under concurrent Docker sandbox containers |
| Keith decision required | Confirm instance size and monthly cost approval |

### Memory Budget Estimate (8 GB)

| Component | Estimated RAM |
|-----------|--------------|
| PostgreSQL 15 | ~512 MB |
| Redis 7 | ~128 MB |
| API Gateway (NestJS) | ~256 MB |
| AI Service Worker (NestJS) | ~256 MB |
| Container Manager (NestJS) | ~256 MB |
| Frontend (Next.js) | ~512 MB |
| Caddy | ~64 MB |
| Docker Engine + 1-2 sandbox containers | ~1–2 GB |
| OS + buffers | ~1 GB |
| **Total estimated** | **~3–5 GB** |
| **Headroom** | **~3–5 GB** |

8 GB provides adequate headroom. 4 GB would be tight if Docker sandbox containers are active.

---

## 8. Domain / Subdomain Plan

| Field | Value |
|-------|-------|
| Staging domain | **staging.ainow.biz** |
| Production domain | `ainow.biz` (NOT used for staging) |
| DNS record type | A record → Lightsail static IP |
| TLS certificate | Automatic via Caddy + Let's Encrypt |
| DNS provider | Wherever `ainow.biz` is currently registered (Keith manages) |

### Domain Rules

- DNS setup is future Step 3 work.
- TLS setup is future Step 3 work.
- No DNS/TLS changes in Step 2 (this document).
- Production root domain `ainow.biz` is NOT used for staging.
- `staging.ainow.biz` keeps staging clearly separated from future production.

### Keith Actions Required for Domain

1. Confirm `ainow.biz` domain registrar access.
2. Create A record: `staging.ainow.biz` → Lightsail static IP (future Step 3).
3. Wait for DNS propagation before TLS setup.

---

## 9. Frontend Deployment Plan

| Field | Value |
|-------|-------|
| Technology | Next.js (standalone output) |
| Port | 3002 |
| Exposure | Public via Caddy reverse proxy at `staging.ainow.biz` |
| Build command | `npm run build` in `frontend/` |
| Start command | `npm start` (or `node .next/standalone/server.js`) |
| Process manager | PM2 or systemd |
| Key env vars | `API_GATEWAY_URL=http://localhost:4000`, `NEXT_PUBLIC_PROJECT_FIRST_UX`, `NEXT_PUBLIC_SHOW_DEV_TOOLS=false` |

### Frontend Deployment Sequence (Future Step 3)

1. Clone repo on Lightsail VPS.
2. Install Node.js 20 LTS.
3. `cd frontend && npm ci && npm run build`.
4. Configure env vars (Keith — no values in this document).
5. Start with PM2/systemd.
6. Verify `http://localhost:3002` responds.

---

## 10. API Gateway Deployment Plan

| Field | Value |
|-------|-------|
| Technology | NestJS |
| Port | 4000 |
| Exposure | Public via Caddy reverse proxy at `staging.ainow.biz/api/*` |
| Build command | `npm run build` in `services/api-gateway/` |
| Start command | `node dist/main.js` |
| Process manager | PM2 or systemd |
| Health endpoints | `GET /api/health`, `GET /api/health/db`, `GET /api/health/ready` |

### API Gateway Deployment Sequence (Future Step 3)

1. `cd services/api-gateway && npm ci && npm run build`.
2. Configure env vars (Keith — no values in this document).
3. Start with PM2/systemd.
4. Verify health endpoints return 200.

---

## 11. AI Service Worker Deployment Plan

| Field | Value |
|-------|-------|
| Technology | NestJS |
| Port | 4001 |
| Exposure | Internal only — NOT exposed via reverse proxy |
| Build command | `npm run build` in `services/ai-service/` |
| Start command | `node dist/main.js` |
| Process manager | PM2 or systemd |
| Dependencies | Redis (BullMQ queue), PostgreSQL, API Gateway internal endpoints |

### Runtime Uncertainty Decision Point

For the first staging beta, decide whether AI Service Worker should be enabled immediately or kept disabled behind kill switches.

**Default recommendation:** Deploy the AI Service Worker for startup parity (API Gateway requires BullMQ/Redis connection and expects the worker queue to exist). Keep risky execution features disabled using existing kill switches:

| Kill Switch | Recommended Staging Value |
|-------------|--------------------------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — disables AI execution dispatch |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` — disables tool loop |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` — disables write tools |

This allows AI Service Worker to start and connect to BullMQ without processing real AI execution jobs.

**Keith decision required:** Confirm whether to start AI Service Worker with kill switches disabled (safe default) or skip deploying it entirely (may cause API Gateway BullMQ errors).

---

## 12. Container Manager Deployment Plan

| Field | Value |
|-------|-------|
| Technology | NestJS |
| Port | 4002 |
| Exposure | Internal only — NOT exposed via reverse proxy |
| Build command | `npm run build` in `services/container-manager/` |
| Start command | `node dist/main.js` |
| Process manager | PM2 or systemd |
| Dependencies | Docker Engine socket, API Gateway internal endpoints |

### Runtime Uncertainty Decision Point

Container Manager requires Docker Engine and manages sandbox containers. For the first staging beta (MVP scope: Create Agent persistence only), sandbox container execution is NOT part of the MVP flow.

**Default recommendation:** Deploy Container Manager for startup parity. Docker Engine should be installed on the Lightsail VPS. Container Manager will start but will only be invoked if/when AI execution dispatches container lifecycle operations (which are disabled by default via kill switches).

**Keith decision required:** Confirm whether to deploy Container Manager or defer until AI execution is enabled.

---

## 13. PostgreSQL Plan

| Field | Value |
|-------|-------|
| Version | PostgreSQL 15 |
| Hosting | Self-hosted on the Lightsail VPS |
| Installation | System package (`apt install postgresql-15`) or Docker container |
| Port | 5432 (localhost only — NOT exposed to internet) |
| Database name | `aisandbox` (matches existing config) |
| User | `aisandbox` (matches existing config) |
| Backup | `pg_dump` cron job to local file or S3 |

### PostgreSQL Setup Sequence (Future Step 3)

1. Install PostgreSQL 15 on Lightsail VPS.
2. Create database `aisandbox` and user `aisandbox`.
3. Keith sets strong password (no value in this document).
4. Configure `pg_hba.conf` for localhost-only access.
5. Verify `pg_isready` succeeds.
6. Keith configures `DATABASE_URL` and `POSTGRES_*` env vars.

### Future Migration Path

Move to managed AWS database (RDS PostgreSQL or Aurora) only after private beta proves the product direction. Self-hosted PostgreSQL on the VPS is acceptable for < 10 beta users.

---

## 14. Redis Plan

| Field | Value |
|-------|-------|
| Version | Redis 7 |
| Hosting | Self-hosted on the Lightsail VPS |
| Installation | System package (`apt install redis-server`) or Docker container |
| Port | 6379 (localhost only — NOT exposed to internet) |
| Authentication | Password-protected (`requirepass` in redis.conf) |

### Redis Setup Sequence (Future Step 3)

1. Install Redis 7 on Lightsail VPS.
2. Configure `requirepass` with strong password (Keith sets — no value here).
3. Bind to `127.0.0.1` only.
4. Verify `redis-cli ping` returns `PONG`.
5. Keith configures `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` env vars.

### Future Migration Path

Move to managed AWS ElastiCache only after private beta proves the product direction. Self-hosted Redis on the VPS is acceptable for < 10 beta users.

---

## 15. Reverse Proxy / TLS Plan

| Field | Value |
|-------|-------|
| Recommended proxy | **Caddy** |
| Rationale | Automatic HTTPS via Let's Encrypt; minimal config; proven for single-server setups |
| Alternative | nginx + certbot (more manual but equally viable) |
| Port | 443 (HTTPS) + 80 (HTTP → HTTPS redirect) |
| Domain | `staging.ainow.biz` |

### Caddy Configuration Sketch (Reference Only — Not Executed)

```
staging.ainow.biz {
    handle /api/* {
        reverse_proxy localhost:4000
    }
    handle {
        reverse_proxy localhost:3002
    }
}
```

### TLS Behavior

- Caddy automatically obtains and renews Let's Encrypt certificates.
- DNS A record for `staging.ainow.biz` must resolve to the Lightsail static IP before Caddy can obtain a certificate.
- HTTP → HTTPS redirect is automatic with Caddy.

### Keith Actions Required

1. Confirm Caddy vs nginx preference (Caddy recommended for simplicity).
2. Domain A record must be configured before TLS setup.
3. Lightsail firewall must allow inbound ports 80 and 443.

---

## 16. Environment Variable Groups (Without Values)

No secret values are included. Status column indicates expected state.

### 16A. Root / Shared App Config

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `NODE_ENV` | YES | `production` |
| 2 | `LAUNCH_STATE` | YES | `INTERNAL` |
| 3 | `INTERNAL_SERVICE_KEY` | YES (SECRET) | Keith must configure |

### 16B. Frontend Public Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `API_GATEWAY_URL` | YES | `http://localhost:4000` |
| 2 | `NEXT_PUBLIC_PROJECT_FIRST_UX` | YES | Keith must configure |
| 3 | `NEXT_PUBLIC_SHOW_DEV_TOOLS` | YES | `false` |

### 16C. API Gateway Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `PORT` | YES | `4000` |
| 2 | `JWT_SECRET` | YES (SECRET) | Keith must configure |
| 3 | `JWT_EXPIRES_IN` | YES | `15m` |
| 4 | `JWT_REFRESH_EXPIRES_IN` | YES | `7d` |
| 5 | `SESSION_SECRET` | YES (SECRET) | Keith must configure |
| 6 | `OAUTH_STATE_SECRET` | YES (SECRET) | Keith must configure |
| 7 | `APP_BASE_URL` | YES | `https://staging.ainow.biz` |
| 8 | `GOOGLE_CLIENT_ID` | YES (SECRET) | Keith must configure |
| 9 | `GOOGLE_CLIENT_SECRET` | YES (SECRET) | Keith must configure |
| 10 | `GOOGLE_CALLBACK_URL` | YES | `https://staging.ainow.biz/api/auth/google/callback` |
| 11 | `AI_PROVIDER` | YES | `stub` for staging (no paid calls) |
| 12 | `ANTHROPIC_API_KEY` | CONDITIONAL (SECRET) | Keith must configure if AI_PROVIDER != stub |
| 13 | `OPENAI_API_KEY` | CONDITIONAL (SECRET) | Keith must configure if AI_PROVIDER != stub |
| 14 | `SESSION_TIMEOUT_MINUTES` | YES | `120` |
| 15 | `MAX_CONCURRENT_SESSIONS` | YES | `8` |
| 16 | `EMAIL_PROVIDER` | YES | `stub` for staging |

### 16D. AI Service Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `API_GATEWAY_URL` | YES | `http://localhost:4000` |
| 2 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | YES | `false` (disabled for staging) |
| 3 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | YES | `false` (disabled for staging) |
| 4 | `AGENT_HARNESS_STUB_WRITE_MODE` | YES | `false` |

### 16E. Container Manager Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `DOCKER_HOST` | YES | `unix:///var/run/docker.sock` |
| 2 | `CONTAINER_CPU_LIMIT` | YES | `0.5` |
| 3 | `CONTAINER_MEMORY_LIMIT` | YES | `1g` |

### 16F. Database Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `POSTGRES_HOST` | YES | `localhost` |
| 2 | `POSTGRES_PORT` | YES | `5432` |
| 3 | `POSTGRES_USER` | YES | `aisandbox` |
| 4 | `POSTGRES_PASSWORD` | YES (SECRET) | Keith must configure |
| 5 | `POSTGRES_DB` | YES | `aisandbox` |
| 6 | `DATABASE_URL` | YES (SECRET) | Keith must configure |

### 16G. Redis Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `REDIS_HOST` | YES | `localhost` |
| 2 | `REDIS_PORT` | YES | `6379` |
| 3 | `REDIS_PASSWORD` | YES (SECRET) | Keith must configure |
| 4 | `REDIS_URL` | YES (SECRET) | Keith must configure |

### 16H. Auth / Session Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `JWT_SECRET` | YES (SECRET) | Keith must configure (also in 16C) |
| 2 | `SESSION_SECRET` | YES (SECRET) | Keith must configure (also in 16C) |
| 3 | `OAUTH_STATE_SECRET` | YES (SECRET) | Keith must configure (also in 16C) |
| 4 | `GOOGLE_CLIENT_ID` | YES (SECRET) | Keith must configure (also in 16C) |
| 5 | `GOOGLE_CLIENT_SECRET` | YES (SECRET) | Keith must configure (also in 16C) |

### 16I. Billing / Payment Disabled-State Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `BILLING_CHARGES_ENABLED` | YES | MUST be `false` |
| 2 | `STRIPE_PROVIDER_MODE` | YES | MUST be `disabled` |

### 16J. Safety / Kill-Switch Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `GLOBAL_EXECUTION_ENABLED` | YES | `false` (disabled for staging) |
| 2 | `PROVIDER_OPENAI_ENABLED` | YES | `false` |
| 3 | `PROVIDER_ANTHROPIC_ENABLED` | YES | `false` |
| 4 | `BILLING_SNAPSHOT_ENABLED` | YES | `false` |
| 5 | `PAYMENT_EXECUTION_ENABLED` | YES | `false` |
| 6 | `MAX_TOKENS_PER_EXECUTION` | YES | placeholder-only in example file |
| 7 | `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | YES | placeholder-only in example file |
| 8 | `MAX_DAILY_SPEND_SOFT_USD` | YES | placeholder-only in example file |
| 9 | `MAX_DAILY_SPEND_HARD_USD` | YES | placeholder-only in example file |

### 16K. Domain / CORS / Cookie Variables

| # | Variable | Required | Status |
|---|----------|----------|--------|
| 1 | `APP_BASE_URL` | YES | `https://staging.ainow.biz` |
| 2 | `GOOGLE_CALLBACK_URL` | YES | `https://staging.ainow.biz/api/auth/google/callback` |

---

## 17. Secret Handling Procedure

| # | Rule |
|---|------|
| 1 | No secret values appear in this document or any planning document. |
| 2 | Keith generates all secrets on the Lightsail VPS directly. |
| 3 | Secrets are stored in a `.env` file on the server with `chmod 600`. |
| 4 | The `.env` file is NOT tracked in git. |
| 5 | Secret generation uses `openssl rand -hex 32` or equivalent. |
| 6 | Google OAuth credentials are created in Google Cloud Console by Keith. |
| 7 | AI provider API keys are obtained from provider dashboards by Keith. |
| 8 | Cursor/AI assistants must never open, read, or print `.env`, `.env.local`, `.env.staging`, `.env.production`, or any credential/key/certificate/token file. |
| 9 | If a secret may have been exposed, stop and rotate immediately. |

### Secret Generation Commands (Key Names Only)

```bash
# Keith runs these on the Lightsail VPS — values stay on the server
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → SESSION_SECRET
openssl rand -hex 32  # → OAUTH_STATE_SECRET
openssl rand -hex 32  # → INTERNAL_SERVICE_KEY
openssl rand -hex 32  # → POSTGRES_PASSWORD
openssl rand -hex 32  # → REDIS_PASSWORD
```

---

## 18. Migration Setup Approach

**Plan only. Do not execute migrations.**

### Recommended Future Approach (Step 3 / Child Tasks)

| # | Action | Who | When |
|---|--------|-----|------|
| 1 | Create Lightsail server and install runtime baseline | Keith + Cursor | Step 3 / SETUP-01/02 |
| 2 | Install and configure PostgreSQL 15 | Keith + Cursor | Step 3 / SETUP-06 |
| 3 | Keith configures `DATABASE_URL` without exposing value | Keith only | Step 3 / SETUP-05 |
| 4 | Deploy and build API Gateway | Keith + Cursor | Step 3 / SETUP-04/07 |
| 5 | Run `migration:show` only — non-destructive status check | Keith | Step 3 / SETUP-08 |
| 6 | Execute migration only in a separate explicitly approved migration task if needed | Keith | Separate task |
| 7 | Verify `user_agents` table exists | Keith via SQL | Step 3 / SETUP-08 |
| 8 | Do NOT proceed to beta invite if migration status is unknown | — | Stop condition |

### Migration Safety Rules

- Never run migration against staging/production without a database backup.
- `migration:show` is non-destructive and safe to run.
- `migration:run` requires Keith explicit approval.
- Never run `docker compose down -v` — this destroys database volumes.
- The `user_agents` migration is additive (CREATE TABLE only); it does not modify existing tables.
- Database backup must exist before any migration execution.

---

## 19. Runtime Startup Approach

### Startup Order (Matches `docs/DEPLOYMENT-GUIDE.md`)

| # | Service | Wait For |
|---|---------|----------|
| 1 | PostgreSQL | `pg_isready` PASS |
| 2 | Redis | `redis-cli ping` → PONG |
| 3 | API Gateway | `GET /api/health/ready` → 200 |
| 4 | Container Manager | `GET /health` → 200 (port 4002) |
| 5 | AI Service Worker | Process start (BullMQ connection) |
| 6 | Frontend (Next.js) | HTTP 200 on `http://localhost:3002` |
| 7 | Caddy (reverse proxy) | HTTPS 200 on `https://staging.ainow.biz` |

### Process Management

Recommended: **PM2** for all Node.js services.

```bash
# Example PM2 ecosystem (reference only — not executed)
pm2 start dist/main.js --name api-gateway --cwd /path/to/services/api-gateway
pm2 start dist/main.js --name ai-service --cwd /path/to/services/ai-service
pm2 start dist/main.js --name container-manager --cwd /path/to/services/container-manager
pm2 start npm --name frontend --cwd /path/to/frontend -- start
pm2 save
pm2 startup
```

Alternative: systemd unit files for each service.

### Shutdown Order (Reverse of Startup)

1. Caddy → 2. Frontend → 3. AI Service Worker (drain queue) → 4. Container Manager (stop containers gracefully) → 5. API Gateway → 6. Redis → 7. PostgreSQL

---

## 20. Health Check Approach

| # | Service | Endpoint | Expected Response | Method |
|---|---------|----------|-------------------|--------|
| 1 | API Gateway | `GET /api/health` | `{ status: "ok" }` | HTTP from VPS or external |
| 2 | API Gateway | `GET /api/health/db` | `{ status: "ok", database: "connected" }` | HTTP from VPS or external |
| 3 | API Gateway | `GET /api/health/ready` | `{ ready: true, environment: "validated" }` | HTTP from VPS or external |
| 4 | Container Manager | `GET /health` (port 4002) | `{ status: "ok" }` | HTTP from VPS only (internal) |
| 5 | PostgreSQL | `pg_isready` | exit code 0 | CLI on VPS |
| 6 | Redis | `redis-cli ping` | `PONG` | CLI on VPS |
| 7 | Frontend | `GET http://localhost:3002` | HTTP 200 | HTTP from VPS |
| 8 | Caddy | `GET https://staging.ainow.biz` | HTTP 200 + valid TLS | External browser |

### Post-Setup Verification Sequence

1. SSH to Lightsail VPS.
2. Verify PostgreSQL: `pg_isready`.
3. Verify Redis: `redis-cli ping`.
4. Verify API Gateway: `curl http://localhost:4000/api/health`.
5. Verify API Gateway DB: `curl http://localhost:4000/api/health/db`.
6. Verify API Gateway ready: `curl http://localhost:4000/api/health/ready`.
7. Verify Frontend: `curl http://localhost:3002`.
8. Verify external HTTPS: `curl https://staging.ainow.biz` from external machine.

---

## 21. Rollback / Restart Approach

| # | Scenario | Action |
|---|----------|--------|
| 1 | Single service crash | `pm2 restart <service-name>` |
| 2 | Full stack restart | `pm2 restart all` |
| 3 | Database issue | Check PostgreSQL logs; `systemctl restart postgresql` |
| 4 | Redis issue | Check Redis logs; `systemctl restart redis-server` |
| 5 | Bad deployment | `git checkout <last-known-good>` → rebuild → restart |
| 6 | TLS certificate issue | `caddy reload` or verify DNS A record |
| 7 | Emergency shutdown | `pm2 stop all` → `systemctl stop caddy` |
| 8 | Kill AI execution | Set `GLOBAL_EXECUTION_ENABLED=false` → `pm2 restart api-gateway` |
| 9 | Kill write tools | Set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` → `pm2 restart ai-service` |
| 10 | Kill platform access | Set `LAUNCH_STATE=CLOSED` → `pm2 restart api-gateway` |

### Database Backup Before Risky Operations

```bash
# Keith runs on VPS before migration or risky change
pg_dump -U aisandbox -d aisandbox > /home/ubuntu/backups/aisandbox_$(date +%Y%m%d_%H%M%S).sql
```

### Lightsail Snapshot

AWS Lightsail supports instance snapshots. Keith can take a snapshot before major changes for full-VPS rollback.

---

## 22. Monitoring / Logging / Support Approach

### Required for Beta Launch (Minimum)

| # | Item | Method |
|---|------|--------|
| M1 | Process auto-restart | PM2 with `pm2 startup` + `pm2 save` |
| M2 | Service logs | `pm2 logs <service>` or `journalctl` |
| M3 | Health endpoint monitoring | Cron job or external uptime service pinging `https://staging.ainow.biz/api/health` |
| M4 | Disk space monitoring | `df -h` check or cron alert at 80% |
| M5 | PostgreSQL health | Periodic `pg_isready` check |

### Recommended (Shortly After Beta Start)

| # | Item | Method |
|---|------|--------|
| M6 | Structured log aggregation | PM2 log files + log rotation |
| M7 | External uptime ping | Free uptime monitoring service (e.g., UptimeRobot) |
| M8 | Error alerting | PM2 error log monitoring or lightweight webhook |
| M9 | Prometheus + Grafana | Already configured in `docker-compose.yml` — optional for VPS |

### Support / Feedback Channel

Keith must define before inviting beta users:

- Primary feedback channel (e.g., private Slack, email, Notion form)
- Keith as primary point of contact
- Expectation-setting message for beta users (MVP scope, limitations, AI not active)
- SLA / response time expectation (even if informal: "best effort during beta")

---

## 23. Cost / Complexity Notes

### Monthly Cost Estimate

| Item | Estimated Monthly Cost |
|------|----------------------|
| Lightsail 8 GB instance | ~$40 USD |
| Lightsail static IP (free when attached) | $0 |
| DNS (existing domain) | $0 (already owned) |
| TLS (Let's Encrypt via Caddy) | $0 |
| PostgreSQL (self-hosted) | $0 (included in VPS) |
| Redis (self-hosted) | $0 (included in VPS) |
| Data transfer (first 3 TB free on most Lightsail plans) | $0 for beta |
| **Total estimated** | **~$40 USD/month** |

### Complexity Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| Server provisioning | LOW | Lightsail console — click to create |
| SSH access | LOW | Lightsail browser SSH or SSH key |
| Software installation | MEDIUM | Node.js, PostgreSQL, Redis, Docker, Caddy, PM2 |
| Environment configuration | MEDIUM | ~30+ env vars; secrets must be generated |
| DNS configuration | LOW | Single A record |
| TLS configuration | LOW | Automatic with Caddy |
| Migration execution | MEDIUM | Non-destructive check first; Keith approval for execution |
| App deployment | MEDIUM | Clone, build, configure, start 4 services |
| Overall | MEDIUM | Straightforward but many steps; recommend child-task split |

---

## 24. Keith Decisions Required

| # | Decision | Options | Default Recommendation |
|---|----------|---------|----------------------|
| 1 | Confirm AWS account / region availability | ap-southeast-1 (Singapore) preferred | Singapore |
| 2 | Confirm Lightsail instance size | 8 GB ($40/mo) vs 4 GB ($20/mo) | 8 GB |
| 3 | Confirm monthly cost approval | ~$40/mo | Approve |
| 4 | Confirm staging domain | `staging.ainow.biz` | Approve |
| 5 | Confirm reverse proxy choice | Caddy (recommended) vs nginx | Caddy |
| 6 | Confirm AI Service Worker deployment | Deploy with kill switches disabled (recommended) vs skip | Deploy with kill switches |
| 7 | Confirm Container Manager deployment | Deploy (recommended) vs skip | Deploy |
| 8 | Confirm PostgreSQL installation method | System package (recommended) vs Docker container | System package |
| 9 | Confirm Redis installation method | System package (recommended) vs Docker container | System package |
| 10 | Confirm process manager | PM2 (recommended) vs systemd | PM2 |
| 11 | Confirm `AI_PROVIDER` for staging | `stub` (no paid calls — recommended) vs `anthropic`/`openai` | `stub` |
| 12 | Confirm support/feedback channel before invite | Keith defines | Keith defines |

---

## 25. Keith Manual Configuration Required

| # | Action | Category | When |
|---|--------|----------|------|
| 1 | Create AWS Lightsail account / confirm existing | Account | Step 3 / SETUP-01 |
| 2 | Create Lightsail instance in chosen region | Infrastructure | Step 3 / SETUP-01 |
| 3 | Attach static IP to Lightsail instance | Infrastructure | Step 3 / SETUP-01 |
| 4 | Configure Lightsail firewall (ports 22, 80, 443) | Infrastructure | Step 3 / SETUP-02 |
| 5 | Set up SSH access (key pair) | Infrastructure | Step 3 / SETUP-02 |
| 6 | Create DNS A record: `staging.ainow.biz` → static IP | Domain | Step 3 / SETUP-03 |
| 7 | Generate all secrets (`openssl rand -hex 32`) | Secrets | Step 3 / SETUP-05 |
| 8 | Create `.env` file on server from templates + real secrets | Secrets | Step 3 / SETUP-05 |
| 9 | Create Google OAuth credentials for `staging.ainow.biz` | Auth | Step 3 / SETUP-05 |
| 10 | Set `GOOGLE_CALLBACK_URL` to `https://staging.ainow.biz/api/auth/google/callback` | Auth | Step 3 / SETUP-05 |
| 11 | Run `migration:show` (non-destructive) | Database | Step 3 / SETUP-08 |
| 12 | Approve migration execution if needed | Database | Separate task |
| 13 | Verify `user_agents` table exists | Database | Step 3 / SETUP-08 |
| 14 | Take initial Lightsail snapshot as baseline | Backup | After SETUP-07 |
| 15 | Define support/feedback channel | Support | Before invite |

---

## 26. Recommended Setup Path

### Phased Approach

The recommended approach is to set up the staging environment incrementally, verifying each layer before proceeding:

```
Phase A: Infrastructure
  → Lightsail instance + static IP + firewall + SSH

Phase B: Runtime Baseline
  → Node.js 20 + Docker Engine + PM2 + Caddy

Phase C: Data Layer
  → PostgreSQL 15 + Redis 7 + verify connectivity

Phase D: Domain + TLS
  → DNS A record + Caddy HTTPS + verify TLS

Phase E: Application Deployment
  → Clone repo + build + env vars + start services

Phase F: Verification
  → Health checks + migration status + auth + platform routes

Phase G: Handoff
  → Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS Step 3
```

Each phase can be a separate child task if needed.

---

## 27. Step 3 Execution Plan

Step 3 should NOT try to do everything at once. The recommended approach is to split into bounded child tasks.

### Recommended Child-Task Split

| # | Task ID | Title | Scope | Risk |
|---|---------|-------|-------|------|
| 1 | PRIVATE-BETA-STAGING-SETUP-01 | AWS Lightsail Account / Region / Instance Decision | Confirm AWS account, create instance, attach static IP, configure firewall | LOW |
| 2 | PRIVATE-BETA-STAGING-SETUP-02 | Server Baseline and SSH Access | Install Node.js 20, Docker Engine, PM2, Caddy; verify SSH; OS updates | LOW-MEDIUM |
| 3 | PRIVATE-BETA-STAGING-SETUP-03 | Domain / DNS / TLS for staging.ainow.biz | Create A record, configure Caddy, verify HTTPS | LOW |
| 4 | PRIVATE-BETA-STAGING-SETUP-04 | Runtime / Container Deployment | Clone repo, build 4 services + frontend, configure PM2 | MEDIUM |
| 5 | PRIVATE-BETA-STAGING-SETUP-05 | Env Variable Presence Checklist + Secret-Entry Procedure | Keith generates and enters all secrets; verify presence without values | MEDIUM |
| 6 | PRIVATE-BETA-STAGING-SETUP-06 | Database / Redis Setup | Install PostgreSQL + Redis, configure, verify connectivity | MEDIUM |
| 7 | PRIVATE-BETA-STAGING-SETUP-07 | App Deployment and Health Smoke | Start all services, verify health endpoints, external HTTPS | MEDIUM-HIGH |
| 8 | PRIVATE-BETA-STAGING-SETUP-08 | Migration Readiness / Verification Handoff | Non-destructive `migration:show`, verify `user_agents` table, handoff to deployment readiness | MEDIUM |

### Smallest Safe First Child Task

If the plan concludes that setup is simple enough, the smallest safe first child task is:

**PRIVATE-BETA-STAGING-SETUP-01 — AWS Lightsail Account / Region / Instance Decision**

This is the smallest meaningful step because everything else depends on having a running Lightsail instance with a static IP and open firewall ports.

### Step 3 Dependencies

```
SETUP-01 (instance) → SETUP-02 (baseline) → SETUP-06 (DB/Redis)
                     → SETUP-03 (DNS/TLS)                      → SETUP-04 (build/deploy)
                                                                 → SETUP-05 (env/secrets)
                                                                 → SETUP-07 (health smoke)
                                                                 → SETUP-08 (migration)
```

---

## 28. Child-Task Split Recommendation

**Recommended: Split Step 3 into 8 child tasks (SETUP-01 through SETUP-08).**

Rationale:

1. Each child task is bounded and can be validated independently.
2. Keith manual actions are isolated to specific child tasks.
3. If any child task fails, the failure is contained.
4. Each child task can be done in a separate Cursor window (per CLAUDE.md new-window rules).
5. The dependency chain is clear and linear.

**Alternative: If Keith prefers, SETUP-01 through SETUP-03 could be combined as a single "infrastructure" child task (instance + baseline + DNS), and SETUP-04 through SETUP-07 as a single "deployment" child task (build + secrets + services + health). This reduces to 4 child tasks total.**

Keith decision required: 8-task split (recommended) vs 4-task split vs monolithic Step 3.

---

## 29. Safety Boundaries

| # | Safety Boundary |
|---|----------------|
| 1 | No implementation during this step |
| 2 | No source code changes |
| 3 | No test file changes |
| 4 | No package file changes |
| 5 | No migration execution without Keith explicit approval |
| 6 | No environment file editing |
| 7 | No Docker/runtime startup from this planning step |
| 8 | No user invitations |
| 9 | No public beta launch claims |
| 10 | No secrets opened, printed, or exposed |
| 11 | No `.env`, `.env.local`, `.env.staging`, `.env.production` opened |
| 12 | No credential, key, certificate, or token files opened |
| 13 | No destructive database commands |
| 14 | No `docker compose down -v` |
| 15 | No deployment setup or configuration changes |
| 16 | No git commit or git push |
| 17 | No subagents |
| 18 | No governance file changes (TASKS.md, TASKS_BACKLOG_FULL.md, roadmap) |

### Future Setup Must Stop If

| # | Stop Condition |
|---|----------------|
| 1 | AWS account / region is unavailable |
| 2 | Lightsail instance type is unavailable |
| 3 | Domain choice unresolved |
| 4 | Secrets would need to be exposed |
| 5 | `.env` would need to be opened by Cursor |
| 6 | Destructive DB command is needed |
| 7 | Migration execution is needed without explicit approval |
| 8 | Production data may be affected |
| 9 | Docker volume deletion is requested |
| 10 | Source changes are needed |
| 11 | Package changes are needed |
| 12 | Rollback path is unknown |
| 13 | Cost is not approved by Keith |

---

## 30. Exact Next Action

**Keith decisions required before Step 3 can begin.**

Keith must confirm:

1. AWS account availability and region (ap-southeast-1 Singapore recommended).
2. Lightsail instance size (8 GB / $40 month recommended).
3. Monthly cost approval (~$40/month).
4. Staging domain: `staging.ainow.biz`.
5. Reverse proxy choice: Caddy (recommended).
6. Child-task split preference: 8 tasks (recommended) vs fewer.

After Keith confirms decisions, register PRIVATE-BETA-STAGING-SETUP-01 (AWS Lightsail Account / Region / Instance Decision) as the first child task of Step 3.

**No implementation. No deployment. No migration execution. No user invitations. No secrets. No subagents. No governance file changes.**

---

**Document created:** 2026-07-21
**Step 2 status:** COMPLETE
**Keith AWS Lightsail decision:** Recorded
**Predecessor evidence:** `docs/PRIVATE-BETA-DEPLOYMENT-READINESS-STAGE-START.md`, `docs/LIMITED-PRIVATE-BETA-HANDOFF-CHECKLIST.md`, `docs/BETA-READY-SMOKE-CHECKPOINT.md`, `docs/BETA-READY-DEPLOYMENT-CONFIG-CHECKPOINT.md`, `docs/DEPLOYMENT-GUIDE.md`
**No secret-bearing environment files opened.**
**No subagents used.**
