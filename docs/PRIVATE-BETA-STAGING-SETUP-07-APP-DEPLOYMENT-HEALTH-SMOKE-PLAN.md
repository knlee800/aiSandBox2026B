# PRIVATE-BETA-STAGING-SETUP-07 — App Deployment / Health Smoke Plan

**Task ID:** PRIVATE-BETA-STAGING-SETUP-07
**Title:** App Deployment / Health Smoke Plan
**Step:** 2 — App Deployment / Health Smoke Plan
**Status:** CREATED — 2026-07-22
**Date:** 2026-07-22
**Nature:** Planning only — no deployment, no app/API/browser smoke, no PostgreSQL/Redis action, no env file created/opened/edited, no secrets printed/requested/generated, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-07 |
| Title | App Deployment / Health Smoke Plan |
| Parent | PRIVATE-BETA-STAGING-SETUP — Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | PLANNING / CHECKLIST / SECURITY-ADJACENT — app deployment and health smoke planning only |
| Risk | MEDIUM — planning only; no deployment, no runtime, no smoke execution |
| Step 1 | COMPLETE — Registration — 2026-07-22 |
| Step 2 | This document — App Deployment / Health Smoke Plan — 2026-07-22 |
| Step 3 | PENDING — Consolidation / Handoff to SETUP-08 |
| Predecessors | PRIVATE-BETA-STAGING-SETUP-06 — COMPLETE and LOCKED — 2026-07-22 (DB/Redis setup plan) |
| | PRIVATE-BETA-STAGING-SETUP-05 — COMPLETE and LOCKED — 2026-07-21 (env variable checklist) |
| | PRIVATE-BETA-STAGING-SETUP-04 — COMPLETE and LOCKED — 2026-07-21 (runtime/container deployment plan) |
| | PRIVATE-BETA-STAGING-SETUP-03 — COMPLETE and LOCKED — 2026-07-21 (domain/DNS/TLS plan) |
| | PRIVATE-BETA-STAGING-SETUP-02 — COMPLETE and LOCKED — 2026-07-21 (server baseline plan) |
| | PRIVATE-BETA-STAGING-SETUP-01 — COMPLETE and LOCKED — 2026-07-21 (AWS Lightsail instance decision) |
| Keith approval | "go" — 2026-07-22 |

---

## 2. Purpose

This document records the complete app deployment and health smoke plan for the AWS Lightsail staging server. It provides Keith with a concrete reference for:

- Verifying all pre-deployment prerequisites are met before starting deployment
- Cloning or updating the repo on the VPS
- Installing dependencies and building all services
- Creating PM2 processes for all 4 application services
- Starting services in the correct order
- Running local and internal health checks
- Running external HTTPS smoke tests via staging.ainow.biz
- Verifying locale routes (en, zh-TW, zh-CN)
- Verifying auth/session behavior
- Verifying bounded Create Agent flow
- Verifying billing disabled-state and safety/kill-switch behavior
- Inspecting logs for errors
- Rolling back safely if blockers appear
- Collecting evidence safely without exposing secrets

**No deployment, smoke, or runtime action occurs in this step.** All execution requires Keith explicit approval in a future execution step.

---

## 3. Confirmed Staging / Deployment Decisions

Carried forward from SETUP-01 through SETUP-06 (all COMPLETE and LOCKED) unchanged:

| # | Decision | Confirmed Value |
|---|----------|-----------------|
| 1 | Provider | AWS Lightsail |
| 2 | Region | Singapore / ap-southeast-1 |
| 3 | Instance | 8 GB RAM / 2 vCPU / 160 GB SSD |
| 4 | Instance name | aisandbox-staging |
| 5 | Static IP planned | aisandbox-staging-ip |
| 6 | Staging domain | https://staging.ainow.biz |
| 7 | Architecture | Single VPS staging |
| 8 | Repo path | /opt/aisandbox |
| 9 | Env file path on VPS | /opt/aisandbox/.env |
| 10 | Env file permission | chmod 600 |
| 11 | Frontend port | 3002 internal only |
| 12 | API Gateway port | 4000 internal only |
| 13 | AI Service Worker port | 4001 internal only |
| 14 | Container Manager port | 4002 internal only |
| 15 | PostgreSQL 15 | localhost:5432 only |
| 16 | Redis 7 | localhost:6379 only with requirepass |
| 17 | Public ports | 22, 80, 443 only |
| 18 | Internal service ports | Closed externally |
| 19 | PM2 | Manages app services |
| 20 | systemd | Manages PostgreSQL, Redis, and Caddy |
| 21 | Migration execution | Separate explicit Keith approval only |
| 22 | Beta invite | Separate explicit Keith approval only |
| 23 | Risky AI/container execution | Disabled by kill switches unless separately approved |
| 24 | Billing/payment/provider/webhook | Disabled unless separately approved |

---

## 4. What SETUP-07 Covers

| # | Item |
|---|------|
| 1 | Pre-deployment readiness gate |
| 2 | Required completed setup dependencies |
| 3 | AWS/server prerequisites |
| 4 | DNS/TLS prerequisites |
| 5 | Runtime prerequisites |
| 6 | Env file presence prerequisites |
| 7 | PostgreSQL/Redis prerequisites |
| 8 | Repo clone/update plan |
| 9 | Dependency install plan |
| 10 | Build plan |
| 11 | Migration boundary |
| 12 | PM2 process creation plan |
| 13 | PM2 startup/save plan |
| 14 | Service startup order |
| 15 | Local/internal health checks |
| 16 | API Gateway health checks |
| 17 | DB/Redis readiness checks through app endpoints |
| 18 | Frontend local smoke |
| 19 | Caddy external HTTPS smoke |
| 20 | staging.ainow.biz route smoke |
| 21 | Locale route smoke for en / zh-TW / zh-CN |
| 22 | Auth/session smoke plan |
| 23 | Create Agent bounded smoke plan |
| 24 | Billing disabled-state smoke plan |
| 25 | Safety/kill-switch verification plan |
| 26 | Logs inspection plan |
| 27 | Rollback/stop plan |
| 28 | Evidence collection plan |
| 29 | Keith manual action checklist |
| 30 | What must not happen yet |
| 31 | PASS / BLOCKED criteria |
| 32 | Handoff to SETUP-08 |
| 33 | Safety boundaries |

---

## 5. What SETUP-07 Does NOT Do

| # | Not Done |
|---|---------|
| 1 | Does NOT deploy services |
| 2 | Does NOT clone the repo |
| 3 | Does NOT install dependencies |
| 4 | Does NOT build services |
| 5 | Does NOT create PM2 processes |
| 6 | Does NOT configure Caddy |
| 7 | Does NOT create AWS server or static IP |
| 8 | Does NOT change DNS, TLS, or firewall |
| 9 | Does NOT SSH anywhere |
| 10 | Does NOT create or open `.env` files |
| 11 | Does NOT print, request, or generate secret values |
| 12 | Does NOT install PostgreSQL or Redis |
| 13 | Does NOT run DB or Redis commands |
| 14 | Does NOT use Docker, PostgreSQL, or Redis |
| 15 | Does NOT call APIs |
| 16 | Does NOT open a browser |
| 17 | Does NOT run tests or builds |
| 18 | Does NOT invite users |
| 19 | Does NOT claim beta launch |
| 20 | Does NOT execute migrations |
| 21 | Does NOT modify source, test, package, migration, entity, environment, Docker, or deployment files |
| 22 | Does NOT modify TASKS.md, TASKS_BACKLOG_FULL.md, or AINOW-EXECUTION-ROADMAP.md |
| 23 | Does NOT use subagents |
| 24 | Does NOT make git commits or pushes |

---

## 6. Pre-Deployment Readiness Gate

The following gate must PASS before any future deployment execution can begin. Each item must be verified and recorded as PASS or BLOCKED.

### 6A. Infrastructure Gate

| # | Check | Verification | Expected |
|---|-------|-------------|----------|
| G1 | AWS Lightsail instance `aisandbox-staging` exists | Lightsail console | Instance running |
| G2 | Static IP `aisandbox-staging-ip` exists and is attached | Lightsail console → Networking | IP attached to instance |
| G3 | DNS for staging.ainow.biz resolves to static IP | `nslookup staging.ainow.biz` from external machine | Returns static IP |
| G4 | Lightsail firewall allows only ports 22, 80, 443 | Lightsail console → Networking → Firewall | Only 3 ports listed |
| G5 | SSH access works | `ssh ubuntu@<static-ip>` or Lightsail browser SSH | Shell prompt |

### 6B. Runtime Gate

| # | Check | Verification | Expected |
|---|-------|-------------|----------|
| G6 | Node.js 20 LTS installed | `node --version` | v20.x.x |
| G7 | npm installed | `npm --version` | 10.x.x |
| G8 | Docker Engine installed | `docker --version` | Docker version 27.x.x or similar |
| G9 | Docker socket accessible | `docker ps` (as ubuntu user) | No error |
| G10 | PM2 installed | `pm2 --version` | 5.x.x |
| G11 | Caddy installed | `caddy version` | v2.x.x |
| G12 | Git installed | `git --version` | git version 2.x.x |

### 6C. Data Layer Gate

| # | Check | Verification | Expected |
|---|-------|-------------|----------|
| G13 | PostgreSQL 15 installed and running | `sudo systemctl status postgresql` | Active (running) |
| G14 | PostgreSQL listening on localhost only | `sudo ss -tlnp \| grep 5432` | 127.0.0.1:5432 only |
| G15 | PostgreSQL database `aisandbox` exists | `sudo -u postgres psql -c "\l" \| grep aisandbox` | Listed |
| G16 | PostgreSQL app user `aisandbox` can connect | `pg_isready -U aisandbox -d aisandbox -h 127.0.0.1` | Exit code 0 |
| G17 | Redis 7 installed and running | `sudo systemctl status redis-server` | Active (running) |
| G18 | Redis listening on localhost only | `sudo ss -tlnp \| grep 6379` | 127.0.0.1:6379 only |
| G19 | Redis rejects unauthenticated access | `redis-cli ping` (no password) | NOAUTH error |
| G20 | Redis accepts authenticated access | `redis-cli -a '<password>' ping` | PONG |

### 6D. Environment Gate

| # | Check | Verification | Expected |
|---|-------|-------------|----------|
| G21 | /opt/aisandbox directory exists | `ls -la /opt/aisandbox` | Directory exists, owned by ubuntu |
| G22 | /opt/aisandbox/.env exists | `ls -la /opt/aisandbox/.env` | File exists |
| G23 | .env has correct permissions | `stat -c '%a %U:%G' /opt/aisandbox/.env` | 600 ubuntu:ubuntu |
| G24 | Required env variable names present | Run `validate-env-presence.sh` (from SETUP-05) | PASS — all variables present |

### 6E. Safety Gate

| # | Check | Verification | Expected |
|---|-------|-------------|----------|
| G25 | Migration execution approval status explicit | Keith confirms: approved or not yet | Explicit answer |
| G26 | Billing/payment remains disabled | `BILLING_CHARGES_ENABLED` present in .env (name only) | PRESENT |
| G27 | Kill switches remain disabled | `GLOBAL_EXECUTION_ENABLED` present in .env (name only) | PRESENT |

### Gate Verdict

- All G1–G27 must show PASS before deployment execution begins.
- Any BLOCKED item must be resolved before proceeding.
- Gate results must be recorded as evidence (PASS/BLOCKED per item, no secret values).

---

## 7. Required Completed Setup Dependencies

| # | Dependency | Status | Document |
|---|-----------|--------|----------|
| 1 | SETUP-01 — AWS Lightsail instance decision | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-01-CHECKPOINT.md` |
| 2 | SETUP-02 — Server baseline and SSH access plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-02-CHECKPOINT.md` |
| 3 | SETUP-03 — Domain / DNS / TLS plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md` |
| 4 | SETUP-04 — Runtime / container deployment plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-04-CHECKPOINT.md` |
| 5 | SETUP-05 — Env variable presence checklist | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-05-CHECKPOINT.md` |
| 6 | SETUP-06 — Database / Redis setup plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md` |

All 6 predecessor child tasks are COMPLETE and LOCKED. Their plans provide the foundation for this deployment plan.

---

## 8. AWS / Server Prerequisites

| # | Prerequisite | Source Plan | Status at SETUP-07 |
|---|-------------|------------|-------------------|
| 1 | Lightsail instance created | SETUP-01 | Not yet created — future execution |
| 2 | Static IP attached | SETUP-01 | Not yet created — future execution |
| 3 | Firewall configured (22, 80, 443 only) | SETUP-02 | Not yet configured — future execution |
| 4 | SSH access verified | SETUP-02 | Not yet verified — future execution |
| 5 | Ubuntu LTS baseline updated | SETUP-02 | Not yet done — future execution |
| 6 | Timezone set to Asia/Hong_Kong | SETUP-02 | Not yet done — future execution |

---

## 9. DNS / TLS Prerequisites

| # | Prerequisite | Source Plan |
|---|-------------|------------|
| 1 | DNS A record: staging.ainow.biz → static IP | SETUP-03 |
| 2 | DNS propagation confirmed | SETUP-03 |
| 3 | Caddy installed | SETUP-04 |
| 4 | Caddyfile NOT created yet — created only after local services are healthy | This plan (Section 19) |

Caddy/TLS setup is sequenced AFTER local service health is confirmed.

---

## 10. Runtime Prerequisites

| # | Prerequisite | Source Plan |
|---|-------------|------------|
| 1 | Node.js 20 LTS installed | SETUP-04 |
| 2 | npm available (bundled with Node.js 20) | SETUP-04 |
| 3 | Docker Engine installed | SETUP-04 |
| 4 | ubuntu user in docker group | SETUP-04 |
| 5 | PM2 installed globally | SETUP-04 |
| 6 | Caddy installed | SETUP-04 |
| 7 | Git installed | SETUP-04 |

---

## 11. Env File Presence Prerequisites

| # | Prerequisite | Source Plan |
|---|-------------|------------|
| 1 | /opt/aisandbox/.env exists | SETUP-05 |
| 2 | chmod 600, owned by ubuntu:ubuntu | SETUP-05 |
| 3 | All required variable names present | SETUP-05 (validate-env-presence.sh) |
| 4 | Keith has entered all secret values on VPS | SETUP-05 |
| 5 | Values never exposed to Cursor/chat/AI | SETUP-05 |

---

## 12. PostgreSQL / Redis Prerequisites

| # | Prerequisite | Source Plan |
|---|-------------|------------|
| 1 | PostgreSQL 15 installed and running (systemd) | SETUP-06 |
| 2 | PostgreSQL listening on localhost only | SETUP-06 |
| 3 | Database `aisandbox` created | SETUP-06 |
| 4 | App user `aisandbox` created with password | SETUP-06 |
| 5 | pg_hba.conf configured for localhost-only app access | SETUP-06 |
| 6 | pg_isready returns exit code 0 | SETUP-06 |
| 7 | Redis 7 installed and running (systemd) | SETUP-06 |
| 8 | Redis bound to 127.0.0.1 only | SETUP-06 |
| 9 | Redis requirepass set | SETUP-06 |
| 10 | Redis protected-mode yes | SETUP-06 |
| 11 | Authenticated redis-cli ping returns PONG | SETUP-06 |

---

## 13. Repo Clone / Update Plan

### First-Time Clone

| # | Step | Command | Notes |
|---|------|---------|-------|
| 1 | Create directory | `sudo mkdir -p /opt/aisandbox && sudo chown ubuntu:ubuntu /opt/aisandbox` | If not already done |
| 2 | Clone repo | Keith decides: GitHub HTTPS, GitHub SSH, or manual scp/rsync | Clone source decision is Keith-only |
| 3 | Verify clone | `ls /opt/aisandbox/package.json` | File exists |

### Future Update

| # | Step | Command | Notes |
|---|------|---------|-------|
| 1 | Pull latest | `cd /opt/aisandbox && git pull` | Only if repo was cloned via git |
| 2 | Verify updated | `git log -1 --oneline` | Shows latest commit |

### Rules

- Clone source (GitHub HTTPS, SSH, or manual transfer) is Keith's decision.
- /opt/aisandbox must be owned by ubuntu:ubuntu.
- `.env` must NOT appear in git tracked files — verify with `git status`.
- No repo clone occurs in this planning step.

---

## 14. Dependency Install Plan

### Recommended Approach — Workspace Root Install

```bash
cd /opt/aisandbox
npm install
```

This installs dependencies for all workspaces (frontend + all services) in one pass.

### Fallback — Per-Service Install

If workspace root install fails (e.g., missing package-lock.json):

```bash
cd /opt/aisandbox/frontend && npm install
cd /opt/aisandbox/services/api-gateway && npm install
cd /opt/aisandbox/services/ai-service && npm install
cd /opt/aisandbox/services/container-manager && npm install
```

### Package Manager Notes

- Use `npm` on staging (not `bun` — `bun` is local dev only).
- Use `npm ci` if `package-lock.json` exists for deterministic installs.
- Use `npm install` to generate `package-lock.json` if it doesn't exist.
- Do NOT enable Corepack on staging.

### Native Dependencies

- `better-sqlite3` and `bcrypt` require native compilation — Node.js 20 and build tools must be available.
- If `npm install` fails on native modules, install build prerequisites: `sudo apt install -y build-essential python3`.

---

## 15. Build Plan

### Build Order

| # | Service | Directory | Build Command | Build Script | Output |
|---|---------|-----------|---------------|-------------|--------|
| 1 | API Gateway | `services/api-gateway/` | `npm run build` | `tsc` | `dist/` |
| 2 | AI Service Worker | `services/ai-service/` | `npm run build` | `tsc` | `dist/` |
| 3 | Container Manager | `services/container-manager/` | `npm run build` | `tsc` | `dist/` |
| 4 | Frontend | `frontend/` | `npm run build` | `next build` | `.next/` |

### Build Commands (Future — Not Executed Now)

```bash
cd /opt/aisandbox/services/api-gateway && npm run build
cd /opt/aisandbox/services/ai-service && npm run build
cd /opt/aisandbox/services/container-manager && npm run build
cd /opt/aisandbox/frontend && npm run build
```

### Build Verification

```bash
ls /opt/aisandbox/services/api-gateway/dist/main.js
ls /opt/aisandbox/services/ai-service/dist/main.js
ls /opt/aisandbox/services/container-manager/dist/main.js
ls /opt/aisandbox/frontend/.next/
```

Each file/directory must exist after a successful build.

### Build Notes

- Frontend build (`next build`) may take longer due to Next.js optimization.
- Backend builds (`tsc`) are typically fast.
- All builds must complete without error before starting services.
- If a build fails, stop and investigate — do NOT start services with stale outputs.

---

## 16. Migration Boundary

| # | Rule |
|---|------|
| 1 | SETUP-07 plan must NOT execute migrations |
| 2 | Future migration execution requires separate explicit Keith approval |
| 3 | If app startup requires schema (e.g., API Gateway TypeORM synchronize is off), this must be recorded as BLOCKED until migration approval is granted |
| 4 | A pre-migration `pg_dump` backup must be created before migrations |
| 5 | A Lightsail instance snapshot must be created before migrations |
| 6 | SETUP-08 handles Migration Readiness / Verification Plan |
| 7 | `npm run migration:show` (non-destructive status check) may be run in SETUP-08 with Keith approval |
| 8 | `npm run migration:run:prod` (destructive) requires separate explicit Keith approval |
| 9 | If API Gateway fails to start because the database schema is missing, record this as a BLOCKED condition and stop |

### Migration Status at SETUP-07

- Migration execution: NOT APPROVED.
- If migration is required before health smoke can pass, SETUP-07 deployment is BLOCKED until SETUP-08 migration readiness is resolved and Keith explicitly approves migration execution.

---

## 17. PM2 Process Creation Plan

### Individual PM2 Start Commands (Preferred)

```bash
# API Gateway
pm2 start dist/main.js --name api-gateway --cwd /opt/aisandbox/services/api-gateway

# AI Service Worker
pm2 start dist/main.js --name ai-service --cwd /opt/aisandbox/services/ai-service

# Container Manager
pm2 start dist/main.js --name container-manager --cwd /opt/aisandbox/services/container-manager

# Frontend
PORT=3002 pm2 start npm --name frontend --cwd /opt/aisandbox/frontend -- start
```

### Alternative: PM2 Ecosystem File

If individual commands have issues, create an `ecosystem.config.js` at `/opt/aisandbox/ecosystem.config.js` (conceptual — documented in SETUP-04 Section 23).

### PM2 Process Configuration

| # | Setting | Value |
|---|---------|-------|
| 1 | Instances per service | 1 |
| 2 | Auto-restart | Enabled (PM2 default) |
| 3 | Max restarts | 10 (prevent infinite loops) |
| 4 | Restart delay | 5000ms |
| 5 | Env vars | Loaded from /opt/aisandbox/.env — not embedded in PM2 config |

### PM2 Environment Loading Note

PM2 loads environment variables from the shell environment at start time. To ensure `.env` values are available, either:

- Source the .env before starting: `. /opt/aisandbox/.env && pm2 start ...`
- Use PM2 ecosystem file with `env_file` or `dotenv` loading
- Or rely on the service's own `dotenv` package loading from the project root

The exact loading mechanism must be verified during execution. If services cannot find env vars, adjust the PM2 start approach.

---

## 18. PM2 Startup / Save Plan

After all 4 services are started and confirmed online:

```bash
# Save current PM2 process list for restoration after reboot
pm2 save

# Generate systemd startup script so PM2 restarts on VPS reboot
pm2 startup
# Follow the printed sudo command to complete setup
```

### PM2 Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

---

## 19. Service Startup Order

| # | Service | Wait For | Verification Command | Expected |
|---|---------|----------|---------------------|----------|
| 1 | PostgreSQL | systemd active | `pg_isready -U aisandbox -d aisandbox -h 127.0.0.1` | Exit code 0 |
| 2 | Redis | systemd active | `redis-cli -a '<password>' ping` | PONG |
| 3 | API Gateway | PostgreSQL + Redis running | `curl -s http://localhost:4000/api/health` | `{ "status": "ok" }` |
| 4 | Container Manager | API Gateway healthy | `curl -s http://localhost:4002/api/health` | `{ "status": "ok" }` |
| 5 | AI Service Worker | PostgreSQL + Redis + API Gateway | `pm2 status ai-service` | online |
| 6 | Frontend | API Gateway healthy | `curl -s http://localhost:3002` | HTTP 200 |
| 7 | Caddy | All local services healthy | `curl -s https://staging.ainow.biz` (external) | HTTP 200 + valid TLS |

### Startup Order Rationale

- PostgreSQL and Redis must be running before any application service starts.
- API Gateway must be healthy before Container Manager and AI Service Worker (they call API Gateway internal endpoints).
- Container Manager and AI Service Worker are independent of each other.
- Frontend must be running before Caddy proxies to it.
- Caddy must be started LAST — only after all local services respond correctly.

### Source-Verified Health Endpoint Paths

**Important correction from source code verification:**

| Service | Controller Decorator | Global Prefix | Actual Path | Port |
|---------|---------------------|---------------|-------------|------|
| API Gateway | `@Controller('health')` | `setGlobalPrefix('api')` | `/api/health`, `/api/health/db`, `/api/health/ready` | 4000 |
| Container Manager | `@Controller('health')` | `setGlobalPrefix('api')` | `/api/health` | 4002 |
| AI Service Worker | No HealthController found | `setGlobalPrefix('api')` | No dedicated health endpoint | 4001 |

**Note:** Some earlier planning documents (stage-start, DEPLOYMENT-GUIDE.md) referenced Container Manager health at `GET /health` (port 4002). Source code verification shows the actual path is `GET /api/health` (port 4002) because `setGlobalPrefix('api')` is set in `main.ts`. This plan uses the source-verified paths.

**AI Service Worker:** Has no dedicated health controller or health endpoint in the codebase. Health is inferred from PM2 process status (`pm2 status ai-service` shows `online`) and absence of Redis/BullMQ connection errors in logs.

---

## 20. Local / Internal Health Checks

### Health Check Sequence (Future — After Full Deployment)

| # | Check | Command | Expected | Type |
|---|-------|---------|----------|------|
| H1 | PostgreSQL running | `pg_isready -U aisandbox -d aisandbox -h 127.0.0.1` | Exit code 0 | CLI |
| H2 | Redis running (authenticated) | `redis-cli -a '<password>' ping` | PONG | CLI |
| H3 | PM2 all services online | `pm2 status` | All 4 show `online` | CLI |
| H4 | API Gateway basic | `curl -s http://localhost:4000/api/health` | `{ "status": "ok", "service": "api-gateway" }` | HTTP |
| H5 | API Gateway DB | `curl -s http://localhost:4000/api/health/db` | `{ "status": "ok", "database": "connected" }` | HTTP |
| H6 | API Gateway ready | `curl -s http://localhost:4000/api/health/ready` | `{ "status": "ready", "checks": { ... } }` | HTTP |
| H7 | Container Manager | `curl -s http://localhost:4002/api/health` | `{ "status": "ok", "service": "container-manager" }` | HTTP |
| H8 | AI Service Worker | `pm2 status ai-service` | `online` + no error logs | CLI/PM2 |
| H9 | Frontend local | `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002` | `200` | HTTP |

All checks H1–H9 run on the VPS (internal). No external access required.

---

## 21. API Gateway Health Checks

### Endpoints (Source-Verified)

| # | Endpoint | Path | Method | Expected Response |
|---|----------|------|--------|-------------------|
| 1 | Basic health | `GET /api/health` | HTTP | `{ "status": "ok", "service": "api-gateway", "version": "0.1.0" }` |
| 2 | DB health | `GET /api/health/db` | HTTP | `{ "status": "ok", "database": "connected" }` |
| 3 | Readiness | `GET /api/health/ready` | HTTP | `{ "status": "ready", "checks": { "environment": "validated", "database": "connected", "killSwitches": "loaded", "safetyLimits": "loaded" } }` |

### Readiness Check Details

The `/api/health/ready` endpoint verifies:
1. Environment variables validated (via `EnvironmentValidator`)
2. Database connected (executes `SELECT 1`)
3. Kill switches loaded (via `KillSwitchConfig`)
4. Safety limits loaded (via `GlobalSafetyLimits`)

If any check fails, returns HTTP 503 with `{ "status": "not_ready", "error": "..." }`.

### Failure Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| PostgreSQL not running | `/api/health/db` → 503; `/api/health/ready` → 503 |
| Missing env vars | API Gateway may fail to start entirely |
| Kill switches not loaded | `/api/health/ready` → 503 |
| Redis not running | API Gateway may fail to start (BullMQ connection required) |

---

## 22. DB / Redis Readiness Checks Through App Endpoints

| # | Check | Method | Expected | What It Proves |
|---|-------|--------|----------|----------------|
| 1 | DB connectivity via API Gateway | `curl http://localhost:4000/api/health/db` | `"database": "connected"` | API Gateway can reach PostgreSQL via TypeORM |
| 2 | BullMQ/Redis via AI Service Worker | `pm2 status ai-service` + `pm2 logs ai-service --lines 20` | `online` + no Redis connection errors | AI Service Worker connected to Redis via BullMQ |
| 3 | Redis queue via API Gateway | API Gateway starts without Redis connection error | PM2 shows `online` | API Gateway BullMQ queue connected to Redis |

### Verifying Redis Connectivity Through App Behavior

The API Gateway's `QueueService` creates a BullMQ queue using `REDIS_URL`. If Redis is unreachable or the password is wrong, the API Gateway will fail to start or show connection errors in logs.

The AI Service Worker connects to Redis via BullMQ as a worker processor. If the Redis connection fails, the AI Service Worker process will show errors in `pm2 logs ai-service`.

Evidence collection for Redis connectivity:
- `pm2 status` — all services show `online` (not `errored` or `stopped`)
- `pm2 logs api-gateway --lines 30` — no `ECONNREFUSED` or `NOAUTH` errors related to Redis
- `pm2 logs ai-service --lines 30` — no `ECONNREFUSED` or `NOAUTH` errors related to Redis

---

## 23. Frontend Local Smoke

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | Frontend responds on port 3002 | `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002` | `200` |
| 2 | Frontend returns HTML | `curl -s http://localhost:3002 \| head -5` | HTML content (e.g., `<!DOCTYPE html>` or Next.js root) |
| 3 | Frontend `/en` route | `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/en` | `200` |
| 4 | Frontend `/zh-TW` route | `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/zh-TW` | `200` |
| 5 | Frontend `/zh-CN` route | `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/zh-CN` | `200` |
| 6 | Root redirects to default locale | `curl -s -o /dev/null -w '%{http_code}' -L http://localhost:3002/` | `200` (after redirect to `/en`) |

### Frontend Route Structure (Source-Verified)

The frontend uses Next.js App Router with `[locale]` dynamic segment. Middleware in `middleware.ts` handles locale detection and redirection.

Supported locales: `en`, `zh-TW`, `zh-CN` (from `middleware.ts`).
Default locale: `en`.

Key routes under each locale:
- `/[locale]/` — home page
- `/[locale]/login` — login page
- `/[locale]/register` — registration page
- `/[locale]/platform` — main platform
- `/[locale]/app` — app page
- `/[locale]/projects` — projects list
- `/[locale]/billing` — billing page
- `/[locale]/account` — account settings
- `/[locale]/gallery` — gallery
- `/[locale]/keys` — API keys

---

## 24. Caddy External HTTPS Smoke

### Prerequisites Before Caddy Start

- All local services (API Gateway, AI Service, Container Manager, Frontend) are healthy.
- DNS A record for staging.ainow.biz resolves to the static IP.
- Caddy is installed.
- Caddyfile is created at `/etc/caddy/Caddyfile`.
- No other service is binding ports 80 or 443.

### Caddyfile (Conceptual — From SETUP-03)

```
staging.ainow.biz {
    reverse_proxy /api/* localhost:4000
    reverse_proxy localhost:3002
}
```

### Caddy Start

```bash
sudo systemctl start caddy
sudo systemctl enable caddy
```

### External HTTPS Checks (From External Machine or Browser)

| # | Check | Command / Method | Expected |
|---|-------|-----------------|----------|
| E1 | HTTPS frontend loads | `curl -s -o /dev/null -w '%{http_code}' https://staging.ainow.biz` | `200` |
| E2 | TLS certificate valid | Browser lock icon or `curl -v https://staging.ainow.biz 2>&1 \| grep 'SSL certificate verify ok'` | Valid Let's Encrypt cert |
| E3 | HTTP redirects to HTTPS | `curl -s -o /dev/null -w '%{http_code}' -L http://staging.ainow.biz` | `301` then `200` |
| E4 | API health through HTTPS | `curl -s https://staging.ainow.biz/api/health` | `{ "status": "ok" }` |
| E5 | API DB health through HTTPS | `curl -s https://staging.ainow.biz/api/health/db` | `{ "status": "ok", "database": "connected" }` |

---

## 25. staging.ainow.biz Route Smoke

| # | Route | Expected HTTP Code | Notes |
|---|-------|-------------------|-------|
| 1 | `https://staging.ainow.biz/` | 200 (possibly via redirect to `/en`) | Root route |
| 2 | `https://staging.ainow.biz/en` | 200 | English home |
| 3 | `https://staging.ainow.biz/en/login` | 200 | Login page |
| 4 | `https://staging.ainow.biz/en/platform` | 200 or redirect to login | Platform (may require auth) |
| 5 | `https://staging.ainow.biz/api/health` | 200 | API health |
| 6 | `https://staging.ainow.biz/api/health/ready` | 200 | API readiness |

---

## 26. Locale Route Smoke for en / zh-TW / zh-CN

| # | Locale | Route | Expected |
|---|--------|-------|----------|
| 1 | en | `https://staging.ainow.biz/en` | 200 — English UI |
| 2 | en | `https://staging.ainow.biz/en/login` | 200 — English login |
| 3 | zh-TW | `https://staging.ainow.biz/zh-TW` | 200 — Traditional Chinese UI |
| 4 | zh-TW | `https://staging.ainow.biz/zh-TW/login` | 200 — Traditional Chinese login |
| 5 | zh-CN | `https://staging.ainow.biz/zh-CN` | 200 — Simplified Chinese UI |
| 6 | zh-CN | `https://staging.ainow.biz/zh-CN/login` | 200 — Simplified Chinese login |

### Verification Method

- Use `curl -s -o /dev/null -w '%{http_code}'` for status code.
- For visual verification: open in browser and confirm UI text is in the correct language.
- Do NOT paste full HTML response into evidence — use status code only.

---

## 27. Auth / Session Smoke Plan

| # | Check | Method | Expected | Notes |
|---|-------|--------|----------|-------|
| 1 | Login page loads | `curl -s -o /dev/null -w '%{http_code}' https://staging.ainow.biz/en/login` | 200 | Page renders |
| 2 | Google OAuth redirect | Click "Sign in with Google" in browser | Redirects to Google OAuth consent screen | Requires Keith to have configured Google OAuth credentials for staging.ainow.biz |
| 3 | OAuth callback URL correct | After Google consent, browser redirects back to `https://staging.ainow.biz/api/auth/google/callback` | Session created, redirect to platform | Requires valid Google OAuth setup |
| 4 | Session cookie set | Browser dev tools → Application → Cookies | Session cookie present with `Secure`, `HttpOnly`, `SameSite` attributes | Do NOT print cookie value |
| 5 | Authenticated route access | Navigate to `/en/platform` after login | 200 — platform loads | Requires successful auth |
| 6 | Unauthenticated route redirect | Open `/en/platform` in incognito (no session) | Redirect to login page | Access control works |

### Auth Smoke Rules

- Do NOT print or paste cookie values, session IDs, or tokens.
- Do NOT print or paste OAuth callback query parameters.
- Report only: "login page loads" / "OAuth redirect works" / "session created" / "platform accessible after login".
- If Google OAuth is not yet configured by Keith, record auth smoke as BLOCKED — not FAILED.

---

## 28. Create Agent Bounded Smoke Plan

| # | Check | Method | Expected | Notes |
|---|-------|--------|----------|-------|
| 1 | Create Agent page loads | Navigate to agent creation flow after login | Page renders with form/UI | Bounded to UI rendering only |
| 2 | Create Agent submit | Fill name, submit | Agent record created in database | Verifies DB write via API Gateway |
| 3 | Agent list shows created agent | Navigate to agents/projects list | Created agent appears | Verifies DB read via API Gateway |
| 4 | Agent detail loads | Click on created agent | Detail page renders | Verifies DB read |
| 5 | No AI execution triggered | Create agent without starting AI session | No BullMQ job dispatched | Kill switches prevent execution |

### Bounded Scope

- Create Agent smoke tests ONLY the CRUD persistence path (create, list, detail).
- AI execution is disabled by kill switches (`GLOBAL_EXECUTION_ENABLED=false`).
- Agent harness tool loop is disabled (`AGENT_HARNESS_ENABLE_TOOL_LOOP=false`).
- Write tools are disabled (`AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`).
- No real AI provider calls occur (`AI_PROVIDER=stub`).
- No sandbox container is started.

### If Create Agent Flow Requires Migration

If the `user_agents` table does not exist because migration has not been executed, the Create Agent smoke will fail with a database error. In that case:
- Record as BLOCKED — migration required.
- Stop Create Agent smoke.
- Defer to SETUP-08 migration readiness.

---

## 29. Billing Disabled-State Smoke Plan

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | Billing page loads | Navigate to `/en/billing` after login | Page renders ("Coming soon" or disabled state) |
| 2 | No payment form | Inspect billing page | No Stripe elements, no payment input |
| 3 | Kill switch value via readiness | `curl -s http://localhost:4000/api/health/ready` | `killSwitches` shows count; `BILLING_CHARGES_ENABLED` is false |
| 4 | No Stripe SDK present | Check package.json (already verified) | No `@stripe/stripe-js` or `stripe` in dependencies |

### Billing Safety Confirmation

- `BILLING_CHARGES_ENABLED=false` — no payment execution possible.
- `PAYMENT_EXECUTION_ENABLED=false` — payment path blocked.
- `BILLING_SNAPSHOT_ENABLED=false` — billing snapshots disabled.
- No Stripe SDK installed in any service.
- No Stripe API keys configured.
- Billing page should show disabled/coming-soon state.

---

## 30. Safety / Kill-Switch Verification Plan

| # | Kill Switch | Expected Value | Verification Method |
|---|------------|----------------|-------------------|
| 1 | `GLOBAL_EXECUTION_ENABLED` | `false` | `/api/health/ready` response `killSwitches` section |
| 2 | `PROVIDER_OPENAI_ENABLED` | `false` | Env presence check (name only) |
| 3 | `PROVIDER_ANTHROPIC_ENABLED` | `false` | Env presence check (name only) |
| 4 | `PROVIDER_GROQ_ENABLED` | `false` | Env presence check (name only) |
| 5 | `PROVIDER_XAI_ENABLED` | `false` | Env presence check (name only) |
| 6 | `PROVIDER_DEEPSEEK_ENABLED` | `false` | Env presence check (name only) |
| 7 | `BILLING_SNAPSHOT_ENABLED` | `false` | Env presence check (name only) |
| 8 | `PAYMENT_EXECUTION_ENABLED` | `false` | Env presence check (name only) |
| 9 | `BILLING_CHARGES_ENABLED` | `false` | Env presence check (name only) |
| 10 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | Env presence check (name only) |
| 11 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | Env presence check (name only) |
| 12 | `AGENT_HARNESS_STUB_WRITE_MODE` | `false` | Env presence check (name only) |
| 13 | `AI_PROVIDER` | `stub` | Env presence check (name only) |
| 14 | `LAUNCH_STATE` | `INTERNAL` | Env presence check (name only) |

### Kill-Switch Verification Rules

- Verify presence of variable names only — never print values.
- Use `validate-env-presence.sh` from SETUP-05 for name presence checks.
- Use `/api/health/ready` response to confirm kill switches and safety limits are loaded.
- Do NOT modify kill switch values during smoke.
- If any kill switch is missing or incorrectly set, record as BLOCKED.

---

## 31. Logs Inspection Plan

### After Service Startup

| # | Log Source | Command | What to Look For |
|---|-----------|---------|-----------------|
| 1 | All PM2 logs | `pm2 logs --lines 50` | Startup errors, connection failures |
| 2 | API Gateway errors | `pm2 logs api-gateway --err --lines 30` | DB connection errors, Redis errors, missing env vars |
| 3 | AI Service errors | `pm2 logs ai-service --err --lines 30` | BullMQ connection errors, Redis errors |
| 4 | Container Manager errors | `pm2 logs container-manager --err --lines 30` | Docker socket errors |
| 5 | Frontend errors | `pm2 logs frontend --err --lines 30` | Build/SSR errors, API rewrite failures |
| 6 | PostgreSQL logs | `sudo journalctl -u postgresql --lines 30` | Authentication failures, connection issues |
| 7 | Redis logs | `sudo journalctl -u redis-server --lines 30` | Auth failures, bind errors |
| 8 | Caddy logs | `sudo journalctl -u caddy --lines 30` | TLS errors, proxy failures, DNS issues |

### Log Inspection Rules

- Look for: `ERROR`, `ECONNREFUSED`, `NOAUTH`, `FATAL`, `WARN`, `TIMEOUT`, `ENOMEM`.
- Do NOT paste full logs into evidence — only sanitized excerpts.
- Remove any lines containing secrets, passwords, connection strings, tokens, or cookies.
- Record: service name, error type, first 1-2 lines of error message (sanitized).

---

## 32. Rollback / Stop Plan

### Ordered Stop (Reverse of Startup)

| # | Service | Command | Notes |
|---|---------|---------|-------|
| 1 | Caddy | `sudo systemctl stop caddy` | Stops external traffic immediately |
| 2 | Frontend | `pm2 stop frontend` | No new page loads |
| 3 | AI Service Worker | `pm2 stop ai-service` | Let running jobs finish or timeout |
| 4 | Container Manager | `pm2 stop container-manager` | Stop gracefully |
| 5 | API Gateway | `pm2 stop api-gateway` | Close connections |

PostgreSQL and Redis remain running unless explicitly stopping them is required.

### Emergency Stop

```bash
pm2 stop all
sudo systemctl stop caddy
```

### Bad Deployment Rollback

| # | Step | Command |
|---|------|---------|
| 1 | Stop all app services | `pm2 stop all` |
| 2 | Revert to previous good code | `cd /opt/aisandbox && git checkout <last-known-good-commit>` |
| 3 | Rebuild all services | `npm run build` in each service directory |
| 4 | Restart all services | `pm2 restart all` |
| 5 | Verify health | Run health check sequence (Section 20) |

### PM2 Process Deletion (Only If Needed)

```bash
pm2 delete <name>
# or
pm2 delete all
```

Use only if PM2 process list is corrupted or needs complete reset.

### Lightsail Snapshot Restore

- Available as deliberate manual recovery option via AWS console.
- Restores entire VPS to a previous snapshot state.
- Use only as last resort — destructive to any changes made after snapshot.

### Rollback Safety Rules

| # | Rule |
|---|------|
| 1 | Do NOT run `docker compose down -v` — destroys volumes |
| 2 | Do NOT delete database or Redis data |
| 3 | Keep PostgreSQL and Redis running during app rollback |
| 4 | Inspect logs before restarting after failure |
| 5 | Lightsail snapshot restore is a manual Keith decision only |

---

## 33. Evidence Collection Plan

### Safe Evidence Items

| # | Evidence | Collection Method | Safe to Paste |
|---|----------|------------------|---------------|
| 1 | Command names | Copy command text | YES |
| 2 | PASS/FAIL result per check | Record verdict | YES |
| 3 | HTTP status codes | `curl -w '%{http_code}'` | YES |
| 4 | PM2 process names and status | `pm2 status` (table output) | YES — contains no env |
| 5 | Endpoint names (paths) | Record path only | YES |
| 6 | Sanitized log excerpts | Remove secrets, show error type | YES — after sanitization |
| 7 | Service version from health response | Parse `"version"` field | YES |
| 8 | Kill switch counts from readiness | Parse `killSwitches.total` and `killSwitches.enabled` | YES |

### Prohibited Evidence Items

| # | Never Include | Why |
|---|--------------|-----|
| 1 | Secret values | Security |
| 2 | Cookie values | Session security |
| 3 | Token values | Auth security |
| 4 | Full connection strings | Contain passwords |
| 5 | `.env` file content | Contains all secrets |
| 6 | Authorization headers | Contain tokens |
| 7 | OAuth callback query params | Contain auth codes |
| 8 | Full `pm2 env` output | Contains env vars with values |
| 9 | `redis-cli -a` with actual password visible | Password exposure |

### Evidence Template

```
## Deployment / Health Smoke Evidence — SETUP-07

Date: YYYY-MM-DD
Executed by: Keith

### Pre-Deployment Gate
G1 Instance exists: PASS / BLOCKED
G2 Static IP attached: PASS / BLOCKED
...

### Service Health
H1 PostgreSQL: PASS / BLOCKED
H2 Redis: PASS / BLOCKED
H3 PM2 all online: PASS / BLOCKED
H4 API Gateway /api/health: PASS / BLOCKED — HTTP <code>
H5 API Gateway /api/health/db: PASS / BLOCKED — HTTP <code>
...

### External HTTPS Smoke
E1 Frontend HTTPS: PASS / BLOCKED — HTTP <code>
...

### Overall Verdict: PASS / BLOCKED
Blockers (if any): <description>
```

---

## 34. Keith Manual Action Checklist

Keith must perform these actions on the VPS during future execution steps. Do NOT execute in this planning step.

### Pre-Deployment Actions

| # | Action | Prerequisite |
|---|--------|-------------|
| 1 | Verify pre-deployment gate (Section 6) passes | All SETUP-01–06 execution complete |
| 2 | Decide clone source (GitHub HTTPS/SSH or manual transfer) | SSH access to VPS |
| 3 | Clone or transfer repo to /opt/aisandbox | VPS exists, SSH works |

### Deployment Actions

| # | Action | Prerequisite |
|---|--------|-------------|
| 4 | Install dependencies: `cd /opt/aisandbox && npm install` | Repo cloned |
| 5 | Build API Gateway: `cd services/api-gateway && npm run build` | Dependencies installed |
| 6 | Build AI Service: `cd services/ai-service && npm run build` | Dependencies installed |
| 7 | Build Container Manager: `cd services/container-manager && npm run build` | Dependencies installed |
| 8 | Build Frontend: `cd frontend && npm run build` | Dependencies installed |
| 9 | Verify all build outputs exist | Builds complete |
| 10 | Create Lightsail snapshot before starting services | Builds verified |

### PM2 Service Start Actions

| # | Action | Prerequisite |
|---|--------|-------------|
| 11 | Start API Gateway via PM2 | PostgreSQL + Redis running, builds verified |
| 12 | Verify API Gateway health: `curl http://localhost:4000/api/health` | API Gateway started |
| 13 | Start Container Manager via PM2 | API Gateway healthy |
| 14 | Verify Container Manager health: `curl http://localhost:4002/api/health` | Container Manager started |
| 15 | Start AI Service Worker via PM2 | PostgreSQL + Redis + API Gateway running |
| 16 | Verify AI Service Worker online: `pm2 status ai-service` | AI Service started |
| 17 | Start Frontend via PM2 | API Gateway healthy |
| 18 | Verify Frontend: `curl http://localhost:3002` | Frontend started |
| 19 | Run `pm2 save` | All 4 services online |
| 20 | Run `pm2 startup` and follow printed command | PM2 save complete |

### Caddy Actions

| # | Action | Prerequisite |
|---|--------|-------------|
| 21 | Create Caddyfile at `/etc/caddy/Caddyfile` | All local services healthy |
| 22 | Start Caddy: `sudo systemctl start caddy` | Caddyfile created, DNS resolved |
| 23 | Enable Caddy on boot: `sudo systemctl enable caddy` | Caddy started |

### Post-Deployment Verification Actions

| # | Action | Prerequisite |
|---|--------|-------------|
| 24 | Run local health check sequence (Section 20) | All services started |
| 25 | Run API Gateway health checks (Section 21) | API Gateway running |
| 26 | Run external HTTPS smoke (Section 24) | Caddy running + TLS active |
| 27 | Run locale route smoke (Section 26) | External HTTPS working |
| 28 | Run auth/session smoke (Section 27) if Google OAuth configured | HTTPS + OAuth configured |
| 29 | Run Create Agent bounded smoke (Section 28) if auth works + migration applied | Auth working + schema ready |
| 30 | Run billing disabled-state smoke (Section 29) | Services running |
| 31 | Run safety/kill-switch verification (Section 30) | Services running |
| 32 | Inspect logs (Section 31) | All smoke complete |
| 33 | Collect evidence (Section 33) | All checks complete |
| 34 | Create Lightsail snapshot after successful deployment | All smoke PASS |

---

## 35. What Must Not Happen Yet

| # | Must Not Happen | Belongs To |
|---|-----------------|-----------|
| 1 | Migration execution | SETUP-08 with Keith explicit approval |
| 2 | Beta user invitation | Separate explicit Keith approval |
| 3 | Enabling kill switches to `true` | Separate explicit Keith approval per switch |
| 4 | Setting `BILLING_CHARGES_ENABLED=true` | Full billing readiness (not in scope) |
| 5 | Setting `AI_PROVIDER` to a real provider | API key + explicit approval |
| 6 | Public beta launch claims | Not applicable |
| 7 | Production domain (app.ainow.biz) configuration | Not in staging scope |
| 8 | Running `docker compose down -v` | NEVER without explicit Keith approval |
| 9 | Deleting database or Redis data | NEVER during deployment |
| 10 | Modifying source/test/package/migration files | Not in SETUP-07 scope |

---

## 36. PASS / BLOCKED Criteria

### PASS — Step 2 passes if ALL of the following are recorded in this plan:

- [x] Pre-deployment readiness gate (Section 6)
- [x] Dependency requirements from SETUP-01 through SETUP-06 (Sections 7–12)
- [x] Repo clone/update plan (Section 13)
- [x] Dependency install plan (Section 14)
- [x] Build plan (Section 15)
- [x] Migration boundary (Section 16)
- [x] PM2 process creation plan (Section 17)
- [x] PM2 startup/save plan (Section 18)
- [x] Service startup order (Section 19)
- [x] Local/internal health checks (Section 20)
- [x] API Gateway health checks (Section 21)
- [x] DB/Redis readiness checks through app endpoints (Section 22)
- [x] Frontend local smoke (Section 23)
- [x] Caddy external HTTPS smoke (Section 24)
- [x] staging.ainow.biz route smoke (Section 25)
- [x] Locale route smoke for en / zh-TW / zh-CN (Section 26)
- [x] Auth/session smoke plan (Section 27)
- [x] Create Agent bounded smoke plan (Section 28)
- [x] Billing disabled-state smoke plan (Section 29)
- [x] Safety/kill-switch verification plan (Section 30)
- [x] Logs inspection plan (Section 31)
- [x] Rollback/stop plan (Section 32)
- [x] Evidence collection rules (Section 33)
- [x] Keith manual action checklist (Section 34)
- [x] Handoff to SETUP-08 (Section 37)
- [x] No deployment/smoke/runtime action occurred

### BLOCKED — Step 2 would be BLOCKED if ANY of the following were true:

| # | Block Condition | Status |
|---|----------------|--------|
| 1 | Health endpoints cannot be identified enough to plan safely | NOT BLOCKED — all endpoints verified from source code |
| 2 | Startup order is unsafe or unclear | NOT BLOCKED — startup order documented with rationale |
| 3 | Package scripts are unclear enough to block deployment planning | NOT BLOCKED — all `build` and `start` scripts verified from package.json |
| 4 | Migration execution appears required before any health smoke and has not been separately approved | NOT BLOCKED as planning — recorded as potential BLOCKED condition during execution |
| 5 | Env presence cannot be validated without exposing values | NOT BLOCKED — presence-only validation script from SETUP-05 |
| 6 | Smoke evidence would expose secrets/cookies/tokens | NOT BLOCKED — evidence rules exclude secrets |
| 7 | Rollback plan is destructive or missing | NOT BLOCKED — non-destructive rollback documented |
| 8 | Safety/kill-switch verification cannot be planned | NOT BLOCKED — verification via env presence and readiness endpoint |
| 9 | Billing disabled-state cannot be verified safely | NOT BLOCKED — verified via package.json (no Stripe) and env presence |

**Step 2 Verdict: PASS — all criteria met — no blockers identified.**

**Known execution-time risk:** If migration is required for the `user_agents` table and has not been approved, the Create Agent bounded smoke (Section 28) will be BLOCKED at execution time. This is an EXPECTED condition, not a planning blocker. SETUP-08 addresses migration readiness.

---

## 37. Handoff to SETUP-08

| Field | Value |
|-------|-------|
| Next child task | PRIVATE-BETA-STAGING-SETUP-08 |
| Title | Migration Readiness / Verification Plan |
| Expected scope | Plan non-destructive `migration:show` check, verify `user_agents` table existence, plan pre-migration backup, plan migration execution approval process |
| Prerequisites | SETUP-07 COMPLETE and LOCKED (this plan confirms deployment and health smoke requirements) |
| Registration | Keith must explicitly approve SETUP-08 registration |

**SETUP-08 is NOT registered in this step.**

---

## 38. Safety Boundaries

| # | Safety Boundary | Preserved |
|---|----------------|-----------|
| 1 | No deployment | YES |
| 2 | No repo clone | YES |
| 3 | No dependency install/build/start | YES |
| 4 | No PM2 process created | YES |
| 5 | No Caddy configuration | YES |
| 6 | No AWS server/static IP created | YES |
| 7 | No DNS/TLS/firewall changed | YES |
| 8 | No SSH to any server | YES |
| 9 | No app/API/browser smoke executed | YES |
| 10 | No PostgreSQL/Redis action | YES |
| 11 | No DB/Redis commands run | YES |
| 12 | No migration execution | YES |
| 13 | No `.env` file created, opened, or edited | YES |
| 14 | No real `.env`, `.env.local`, `.env.staging`, `.env.production` opened | YES |
| 15 | No credential, key, certificate, or token file opened | YES |
| 16 | No secret values printed, requested, or generated | YES |
| 17 | No Docker used | YES |
| 18 | No implementation | YES |
| 19 | No source code changes | YES |
| 20 | No test file changes | YES |
| 21 | No package file changes | YES |
| 22 | No migration, entity, or schema file changes | YES |
| 23 | No environment file changes | YES |
| 24 | No Docker file changes | YES |
| 25 | No deployment file changes | YES |
| 26 | No tests or builds run | YES |
| 27 | No APIs called | YES |
| 28 | No browser opened | YES |
| 29 | No beta users invited | YES |
| 30 | No subagents used | YES |
| 31 | No git commit or push | YES |
| 32 | No TASKS.md / TASKS_BACKLOG_FULL.md / AINOW-EXECUTION-ROADMAP.md modified | YES |

---

## 39. Exact Next Action

**Keith reviews this plan and confirms completeness.**

After Keith approval, the next steps are:

1. Step 3 — Consolidation / checkpoint for SETUP-07 (update governance files).
2. Register PRIVATE-BETA-STAGING-SETUP-08 — Migration Readiness / Verification Plan.

SETUP-08 registration requires Keith explicit approval.

No deployment. No repo clone. No dependency install/build/start. No PM2 process created. No Caddy config. No app/API/browser smoke. No PostgreSQL/Redis action. No env file created/opened/edited. No secrets printed/requested/generated. No implementation. No subagents.

---

**Document created:** 2026-07-22
**Step 2 status:** CREATED
**Step 2 verdict:** PASS — all criteria met — no blockers identified.
**Health endpoints verified from source code.**
**Container Manager health endpoint corrected to `/api/health` (port 4002) based on source verification.**
**AI Service Worker confirmed: no dedicated health endpoint — health inferred from PM2 status.**
**Frontend locale routes verified: en, zh-TW, zh-CN.**
**No deployment occurred.**
**No repo clone occurred.**
**No dependency install/build/start occurred.**
**No PM2 process created.**
**No Caddy config occurred.**
**No app/API/browser smoke occurred.**
**No PostgreSQL/Redis action occurred.**
**No DB/Redis command occurred.**
**No migration execution occurred.**
**No `.env` file created, opened, or edited.**
**No secret values printed, requested, or generated.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
