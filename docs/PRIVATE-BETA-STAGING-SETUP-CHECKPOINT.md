# PRIVATE-BETA-STAGING-SETUP — Parent Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP
**Title:** Staging / Production-like Deployment Target Setup
**Step:** 4 — Final Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS
**Final Status:** COMPLETE and LOCKED — 2026-07-23
**Date:** 2026-07-23
**Nature:** Governance / checkpoint only — no AWS/server/static IP/DNS/TLS/firewall/SSH action occurred — no runtime/install/deploy action occurred — no PostgreSQL/Redis action occurred — no migration/backup/snapshot action occurred — no env file created/opened/edited — no secrets printed/requested/generated — no app/API/browser smoke occurred — no implementation — no source/test/package/migration/entity/environment/Docker/deployment files changed — no git commit or push — no subagents used.

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
| Step | 4 — Final Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS |
| Keith Approval | "go" — 2026-07-21 |
| Registered | 2026-07-21 |
| Completed | 2026-07-23 |
| Predecessors | PRIVATE-BETA-DEPLOYMENT-READINESS — BLOCKED / PAUSED after Step 2 |

---

## 2. Final Status

**PRIVATE-BETA-STAGING-SETUP: COMPLETE and LOCKED — 2026-07-23**

All 4 steps complete:
- Step 1 — Registration — COMPLETE (2026-07-21)
- Step 2 — Stage-start / AWS Lightsail Staging Setup Plan — COMPLETE (2026-07-21)
- Step 3 — Execution / Staging Target Setup — COMPLETE (2026-07-21 through 2026-07-23) — via 8 child tasks
- Step 4 — Final Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS — COMPLETE (2026-07-23)

---

## 3. What This Parent Task Completed

PRIVATE-BETA-STAGING-SETUP executed the full staging setup **planning chain** across 8 child tasks.

It produced:
- Complete AWS Lightsail account/region/instance decision record (SETUP-01)
- Server baseline and SSH access plan (SETUP-02)
- Domain / DNS / TLS plan for staging.ainow.biz (SETUP-03)
- Runtime / Container deployment plan (SETUP-04)
- Env variable presence checklist and safe secret-entry procedure (SETUP-05)
- Database / Redis setup plan (SETUP-06)
- App deployment / health smoke plan (SETUP-07)
- Migration readiness / verification plan (SETUP-08)
- This parent consolidation checkpoint (SETUP Step 4)

The staging setup planning chain is now complete and can serve as the implementation blueprint when Keith approves the actual staging execution task.

---

## 4. What This Parent Task Did NOT Execute

This task was **planning and governance only**. The following actions did NOT occur:

- No AWS account created or modified
- No AWS Lightsail server/instance created
- No static IP created or assigned
- No DNS A record created or changed
- No TLS certificate requested or configured
- No Caddy installed or configured
- No PM2 installed or configured
- No Node.js, npm, or Docker installed
- No repository cloned to any server
- No application built or started
- No PostgreSQL installed, configured, or started
- No Redis installed, configured, or started
- No database created
- No database user created
- No migration executed
- No pre-migration backup taken
- No Lightsail snapshot taken
- No environment file created, opened, or edited
- No secret values printed, requested, or generated
- No app health check or smoke run performed
- No browser opened for staging
- No beta invite sent
- No staging target is live

**Staging is not live. AWS server does not exist. DNS is not configured. TLS is not configured. Deployment did not occur. Migrations did not run.**

---

## 5. Child Task Completion Table

| # | Task ID | Title | Status | Date | Checkpoint |
|---|---------|-------|--------|------|------------|
| 1 | PRIVATE-BETA-STAGING-SETUP-01 | AWS Lightsail Account / Region / Instance Decision | COMPLETE and LOCKED | 2026-07-21 | `docs/PRIVATE-BETA-STAGING-SETUP-01-CHECKPOINT.md` |
| 2 | PRIVATE-BETA-STAGING-SETUP-02 | Server Baseline and SSH Access Plan | COMPLETE and LOCKED | 2026-07-21 | `docs/PRIVATE-BETA-STAGING-SETUP-02-CHECKPOINT.md` |
| 3 | PRIVATE-BETA-STAGING-SETUP-03 | Domain / DNS / TLS Plan for staging.ainow.biz | COMPLETE and LOCKED | 2026-07-21 | `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md` |
| 4 | PRIVATE-BETA-STAGING-SETUP-04 | Runtime / Container Deployment Plan | COMPLETE and LOCKED | 2026-07-21 | `docs/PRIVATE-BETA-STAGING-SETUP-04-CHECKPOINT.md` |
| 5 | PRIVATE-BETA-STAGING-SETUP-05 | Env Variable Presence Checklist + Secret Entry Procedure | COMPLETE and LOCKED | 2026-07-21 | `docs/PRIVATE-BETA-STAGING-SETUP-05-CHECKPOINT.md` |
| 6 | PRIVATE-BETA-STAGING-SETUP-06 | Database / Redis Setup Plan | COMPLETE and LOCKED | 2026-07-22 | `docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md` |
| 7 | PRIVATE-BETA-STAGING-SETUP-07 | App Deployment / Health Smoke Plan | COMPLETE and LOCKED | 2026-07-22 | `docs/PRIVATE-BETA-STAGING-SETUP-07-CHECKPOINT.md` |
| 8 | PRIVATE-BETA-STAGING-SETUP-08 | Migration Readiness / Verification Plan | COMPLETE and LOCKED | 2026-07-23 | `docs/PRIVATE-BETA-STAGING-SETUP-08-CHECKPOINT.md` |

---

## 6. SETUP-01 Summary — AWS Lightsail Decision

**Task:** PRIVATE-BETA-STAGING-SETUP-01 — AWS Lightsail Account / Region / Instance Decision
**Status:** COMPLETE and LOCKED — 2026-07-21
**Plan:** (decision record embedded in checkpoint — no separate plan doc)
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-01-CHECKPOINT.md`

Keith completed all 8 AWS console confirmation checks manually (all Yes). Final decisions recorded:
- Provider: AWS Lightsail
- Region: Singapore / ap-southeast-1
- Instance type: 8 GB RAM / 2 vCPU / 160 GB SSD
- Budget: ~$40–44/month
- Domain: staging.ainow.biz
- Static IP: to be created at instance launch (aisandbox-staging-ip)
- Instance name: aisandbox-staging

No server was created. No implementation occurred.

---

## 7. SETUP-02 Summary — Server Baseline / SSH Plan

**Task:** PRIVATE-BETA-STAGING-SETUP-02 — Server Baseline and SSH Access Plan
**Status:** COMPLETE and LOCKED — 2026-07-21
**Plan:** `docs/PRIVATE-BETA-STAGING-SETUP-02-SERVER-BASELINE-PLAN.md`
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-02-CHECKPOINT.md`

Server baseline and SSH access plan created. Step 2 verdict PASS. Plan covers: Ubuntu LTS baseline; initial server hardening steps; SSH key pair setup (ed25519 recommended); Lightsail firewall rules (allow 22/80/443, close 3002/4000/4001/4002/5432/6379 externally); `ubuntu` OS user; server locale/timezone configuration. No server created. No SSH connection occurred.

---

## 8. SETUP-03 Summary — Domain / DNS / TLS Plan

**Task:** PRIVATE-BETA-STAGING-SETUP-03 — Domain / DNS / TLS Plan for staging.ainow.biz
**Status:** COMPLETE and LOCKED — 2026-07-21
**Plan:** `docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md`
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md`

Domain and DNS/TLS plan created. Step 2 verdict PASS. Staging domain confirmed: `staging.ainow.biz`. Future production app domain: `app.ainow.biz`. Future root/marketing domain: `ainow.biz`. DNS A record plan: Host `staging` → Lightsail static IP (`aisandbox-staging-ip`). Caddy automatic Let's Encrypt TLS plan documented. HTTP→HTTPS redirect plan documented. Caddy route plan: `staging.ainow.biz` → `localhost:3002` (frontend); `staging.ainow.biz/api/*` → `localhost:4000` (API Gateway). Public ports 80/443 only. Internal ports 3002/4000/4001/4002/5432/6379 closed externally. Cookie/session/CORS implications documented. No DNS change occurred. No TLS certificate requested. No Caddy installed or configured.

---

## 9. SETUP-04 Summary — Runtime / Container Deployment Plan

**Task:** PRIVATE-BETA-STAGING-SETUP-04 — Runtime / Container Deployment Plan
**Status:** COMPLETE and LOCKED — 2026-07-21
**Plan:** `docs/PRIVATE-BETA-STAGING-SETUP-04-RUNTIME-CONTAINER-DEPLOYMENT-PLAN.md`
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-04-CHECKPOINT.md`

Runtime and container deployment plan created. Step 2 verdict PASS. Plan covers: Ubuntu LTS baseline; Node.js 20 LTS via NodeSource; npm (bun not used on staging); Docker Engine via official repo (ubuntu docker group; no public socket); PM2 global install; Caddy via official Caddy repo; repo path `/opt/aisandbox`; service port inventory (Frontend 3002 / API Gateway 4000 / AI Service 4001 / Container Manager 4002 / PostgreSQL 5432 / Redis 6379 / Caddy 80+443); service build plan (next build / tsc); startup order (PostgreSQL → Redis → API Gateway → Container Manager → AI Service → Frontend → Caddy); PM2 ecosystem concept; health check plan; rollback/restart plan; kill switches documented. No installation occurred. No deployment occurred. No repo clone occurred.

---

## 10. SETUP-05 Summary — Env Variable Checklist / Secret Entry Procedure

**Task:** PRIVATE-BETA-STAGING-SETUP-05 — Env Variable Presence Checklist + Secret Entry Procedure
**Status:** COMPLETE and LOCKED — 2026-07-21
**Plan:** `docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md`
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-05-CHECKPOINT.md`

Env variable presence checklist and safe secret-entry procedure created. Step 2 verdict PASS. `/opt/aisandbox/.env` placement model recorded (`chmod 600`, `ubuntu:ubuntu`, never git-tracked, never opened by Cursor). All service variable groups covered: root/shared, frontend, API Gateway, AI Service, Container Manager, database, Redis, auth-session, Google OAuth, billing-disabled, kill-switches, domain/CORS/cookie, logging. Classification complete (required/optional/disabled/conditional). Safe secret-entry procedure documented (Keith only — VPS-side — never paste into Cursor/chat). Presence-only validation script documented. Never-paste rules documented. No real env file created, opened, or edited. No secret values printed, requested, or generated.

---

## 11. SETUP-06 Summary — Database / Redis Setup Plan

**Task:** PRIVATE-BETA-STAGING-SETUP-06 — Database / Redis Setup Plan
**Status:** COMPLETE and LOCKED — 2026-07-22
**Plan:** `docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md`
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md`

Database and Redis setup plan created. Step 2 verdict PASS. Plan covers: PostgreSQL 15 localhost-only installation plan; PostgreSQL service management; database `aisandbox` / user `aisandbox` creation plan; least-privilege privilege model (no SUPERUSER/CREATEDB/CREATEROLE); `pg_hba.conf` localhost-only authentication; `DATABASE_URL` construction rules (without values); PostgreSQL backup plan (`pg_dump` + Lightsail snapshot before migration); Redis 7 localhost-only installation plan; Redis `requirepass` plan (Keith-only password, never documented); `REDIS_URL` construction rules (without values); firewall/internal port safety (three-layer defense: PostgreSQL bind, pg_hba.conf, Lightsail firewall); Keith manual action checklist (32 items). No PostgreSQL or Redis installed, configured, started, or commanded. No database or user created. No password generated. No real env file opened. No secrets printed.

---

## 12. SETUP-07 Summary — App Deployment / Health Smoke Plan

**Task:** PRIVATE-BETA-STAGING-SETUP-07 — App Deployment / Health Smoke Plan
**Status:** COMPLETE and LOCKED — 2026-07-22
**Plan:** `docs/PRIVATE-BETA-STAGING-SETUP-07-APP-DEPLOYMENT-HEALTH-SMOKE-PLAN.md`
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-07-CHECKPOINT.md`

App deployment and health smoke plan created. Step 2 verdict PASS. Plan covers: 27 pre-deployment readiness gate checks (G1–G27: infrastructure, runtime, data layer, environment, safety gates); service startup order (PostgreSQL → Redis → API Gateway → Container Manager → AI Service Worker → Frontend → Caddy); health endpoints source-verified (API Gateway: `/api/health`, `/api/health/db`, `/api/health/ready`; Container Manager: `/api/health` port 4002; AI Service Worker: PM2 status only — no dedicated health endpoint); PM2 process creation/startup plan; dependency install plan; build plan; migration boundary (execution requires separate explicit Keith approval); local/internal health checks (H1–H9); Caddy external HTTPS smoke; locale route smoke (en/zh-TW/zh-CN); auth/session smoke; Create Agent bounded smoke (CRUD only — AI execution disabled); billing disabled-state smoke; safety/kill-switch verification (14 kill switches, env presence only); rollback/stop plan; evidence collection rules (safe vs prohibited); Keith manual action checklist (34 items). No deployment, repo clone, dependency install, build, PM2 process, Caddy config, app/API/browser smoke, PostgreSQL/Redis action, migration execution, env file access, or secrets occurred.

---

## 13. SETUP-08 Summary — Migration Readiness / Verification Plan

**Task:** PRIVATE-BETA-STAGING-SETUP-08 — Migration Readiness / Verification Plan
**Status:** COMPLETE and LOCKED — 2026-07-23
**Plan:** `docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md`
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-SETUP-08-CHECKPOINT.md`

Migration readiness and verification plan created. Step 2 verdict PASS. Key findings: 25 migration files inventoried in `services/api-gateway/src/migrations/`; migration command `npm run migration:run:prod` confirmed in `package.json`; `migration:revert:prod` NOT FOUND — manual revert path documented (`npx typeorm migration:revert -d dist/data-source.js`); `migration:show:prod` NOT FOUND — manual show command documented; TypeORM `data-source.ts` analyzed: uses `DATABASE_URL` exclusively; `synchronize: false` confirmed; 26 entity files mapped to migrations (all core app flows covered); known gap: `api_keys` entity has no dedicated migration (low MVP impact); staging database assumed empty — all 25 migrations will run first-time. Mandatory gates documented: pre-migration PostgreSQL `pg_dump` backup; Lightsail snapshot; Keith explicit migration approval (7 conditions). Dry-run `migration:show` option documented. Post-migration verification plan (20 checks). Schema/table readiness documented for all core flows. Failure scenarios and stop conditions documented. No migration executed. No DB connection occurred. No backup/snapshot created. No env file opened. No secrets printed.

---

## 14. Final Staging Architecture Decisions

| Decision | Value |
|----------|-------|
| Provider | AWS Lightsail |
| Region | Singapore / ap-southeast-1 |
| Instance size | 8 GB RAM / 2 vCPU / 160 GB SSD |
| Instance name | aisandbox-staging |
| Static IP name | aisandbox-staging-ip |
| Architecture | Single VPS staging |
| Repo path on VPS | /opt/aisandbox |
| Env file path on VPS | /opt/aisandbox/.env |
| Env file permission | chmod 600 (ubuntu:ubuntu, never git-tracked) |

---

## 15. Final Domain Decisions

| Decision | Value |
|----------|-------|
| Staging URL | https://staging.ainow.biz |
| Future production app URL | https://app.ainow.biz |
| Future root/marketing domain | ainow.biz |
| DNS A record | Host `staging` → aisandbox-staging-ip |
| Reverse proxy / TLS | Caddy (automatic Let's Encrypt) |
| HTTP→HTTPS redirect | Yes (Caddy enforced) |

---

## 16. Final Runtime Decisions

| Service | Port | Note |
|---------|------|------|
| Frontend (Next.js) | 3002 (internal) | Caddy proxies to external |
| API Gateway (NestJS) | 4000 (internal) | Caddy proxies /api/* |
| AI Service Worker | 4001 (internal) | Kill switches enabled |
| Container Manager | 4002 (internal) | Kill switches enabled |
| Caddy | 80 / 443 (public) | HTTP→HTTPS redirect |
| SSH | 22 (public) | Key-based only |

| Tool | Version | Note |
|------|---------|------|
| Node.js | 20 LTS | Via NodeSource |
| npm | bundled with Node.js | bun not used on staging |
| Docker Engine | latest stable | Official repo; ubuntu docker group |
| PM2 | global | Process manager |
| Caddy | latest stable | Official Caddy repo |

---

## 17. Final Database / Redis Decisions

| Decision | Value |
|----------|-------|
| PostgreSQL version | 15 |
| PostgreSQL bind | localhost:5432 only |
| PostgreSQL database | aisandbox |
| PostgreSQL app user | aisandbox |
| PostgreSQL privilege model | Least privilege (no SUPERUSER/CREATEDB/CREATEROLE) |
| PostgreSQL pg_hba.conf | localhost-only authentication |
| PostgreSQL password handling | Keith-only; never documented; openssl rand -hex 32 |
| Pre-migration backup | pg_dump backup required before any migration |
| Redis version | 7 |
| Redis bind | localhost:6379 only |
| Redis auth | requirepass (Keith-only password; never documented) |
| External port exposure | Ports 5432 and 6379 closed externally (Lightsail firewall) |

---

## 18. Final Env / Secret Handling Decisions

| Decision | Value |
|----------|-------|
| Env file path | /opt/aisandbox/.env |
| Env file permission | chmod 600 (ubuntu:ubuntu) |
| Git tracking | Never tracked in git |
| Cursor/chat access | Never opened in Cursor or pasted into chat |
| Secret generation | Keith-only; VPS-side only; openssl rand -hex 32 |
| Presence validation | Presence-only script (never echo values) |
| Service variable groups | root/shared, frontend, API Gateway, AI Service, Container Manager, database, Redis, auth-session, Google OAuth, billing-disabled, kill-switches, domain/CORS/cookie, logging |
| Kill switches | Risky AI/container execution: disabled; billing/payment: disabled |

---

## 19. Final Deployment / Health Smoke Decisions

| Decision | Value |
|----------|-------|
| Service startup order | PostgreSQL → Redis → API Gateway → Container Manager → AI Service → Frontend → Caddy |
| Pre-deployment gates | G1–G27 must pass before any service starts |
| Health endpoints (API Gateway) | /api/health, /api/health/db, /api/health/ready |
| Health endpoint (Container Manager) | /api/health port 4002 |
| Health endpoint (AI Service Worker) | PM2 status only (no dedicated endpoint) |
| Rollback plan | PM2 stop + Lightsail snapshot restore |
| Create Agent smoke scope | CRUD path only — AI execution disabled by kill switches |
| Billing smoke | Disabled-state verification only |
| Evidence rules | Safe: health check names, PASS/FAIL; Forbidden: DATABASE_URL with password, .env contents, tokens |

---

## 20. Final Migration Readiness Decisions

| Decision | Value |
|----------|-------|
| Migration count | 25 migration files in services/api-gateway/src/migrations/ |
| Migration run command | npm run migration:run:prod |
| Migration revert command | npx typeorm migration:revert -d dist/data-source.js (manual) |
| Migration show command | npx typeorm migration:show -d dist/data-source.js (manual) |
| TypeORM data-source | DATABASE_URL only; synchronize: false |
| Entity coverage | 26 entities mapped; all core flows covered |
| Known gap | api_keys entity has no dedicated migration (low MVP impact) |
| Database state at first run | Empty; all 25 migrations run first-time |
| Pre-migration backup gate | pg_dump backup required (MANDATORY before running) |
| Pre-migration snapshot gate | Lightsail snapshot required (MANDATORY before running) |
| Migration approval gate | Keith explicit verbal/written "approved" required (7 conditions) |
| Dry-run option | migration:show (read-only; safe to run) |

---

## 21. Safety Boundaries Preserved

All safety boundaries from all 8 child tasks were preserved throughout this parent task:
- No AWS/server/static IP/DNS/TLS/firewall/SSH action was taken at any point
- No runtime tool was installed, configured, or started
- No repository was cloned to any server
- No application was built or started
- No PostgreSQL or Redis was installed, configured, started, or commanded
- No database or database user was created
- No migration was executed
- No pre-migration backup was taken
- No Lightsail snapshot was taken
- No environment file was created, opened, or edited
- No secret value was printed, requested, generated, or pasted
- No application health check or smoke was run
- No browser was opened for staging
- No beta invite was sent
- No subagents were used
- No git commit or push was made

---

## 22. Explicit Non-Executed Actions

The following actions are explicitly recorded as **not executed** during this entire parent task:

1. AWS Lightsail server/instance: NOT CREATED
2. Static IP: NOT CREATED
3. DNS A record for staging.ainow.biz: NOT CONFIGURED
4. TLS certificate: NOT REQUESTED
5. Caddy: NOT INSTALLED, NOT CONFIGURED
6. PM2: NOT INSTALLED
7. Node.js / npm / Docker: NOT INSTALLED
8. Repository: NOT CLONED to any server
9. Application: NOT BUILT on any server
10. Application: NOT STARTED on any server
11. PostgreSQL: NOT INSTALLED, NOT CONFIGURED, NOT STARTED
12. Redis: NOT INSTALLED, NOT CONFIGURED, NOT STARTED
13. Database: NOT CREATED
14. Database user: NOT CREATED
15. Migration: NOT EXECUTED
16. Pre-migration backup: NOT TAKEN
17. Lightsail snapshot: NOT TAKEN
18. Environment file: NOT CREATED, NOT OPENED, NOT EDITED
19. Secret values: NOT PRINTED, NOT REQUESTED, NOT GENERATED
20. Health checks: NOT RUN against staging
21. Browser smoke: NOT PERFORMED against staging
22. Beta invite: NOT SENT
23. Git commit: NOT MADE
24. Git push: NOT MADE
25. Subagents: NOT USED

---

## 23. Readiness State After Planning

After all 8 child tasks complete, the state is:

- **Staging setup planning chain: COMPLETE**
- **Staging target: NOT EXISTS** — No AWS server has been created
- **DNS: NOT CONFIGURED** — No A record for staging.ainow.biz exists
- **TLS: NOT CONFIGURED** — No certificate has been requested
- **Runtime: NOT INSTALLED** — No Node.js, Docker, PM2, or Caddy on any staging server
- **Database: NOT INSTALLED** — No PostgreSQL or Redis on any staging server
- **Environment: NOT CONFIGURED** — No `.env` file has been created
- **Deployment: NOT EXECUTED** — No code has been deployed
- **Migrations: NOT RUN** — No database tables exist on staging
- **Health smoke: NOT RUN** — No staging app has been verified alive
- **Private beta invite: NOT SENT**

---

## 24. Remaining Blockers Before Live Staging

Before a real staging environment exists and can be used for PRIVATE-BETA-DEPLOYMENT-READINESS verification, all of the following must occur (each requiring Keith explicit approval):

1. AWS Lightsail instance `aisandbox-staging` created (8 GB / 2 vCPU / 160 GB SSD / ap-southeast-1)
2. Static IP `aisandbox-staging-ip` created and attached
3. Lightsail firewall configured (22/80/443 open; 3002/4000/4001/4002/5432/6379 closed)
4. DNS A record: `staging` host → `aisandbox-staging-ip` (at domain registrar/DNS provider)
5. Server OS configured (Ubuntu LTS; locale/timezone; SSH key setup)
6. Runtime installed (Node.js 20 LTS, npm, Docker Engine, PM2, Caddy)
7. Repository cloned to `/opt/aisandbox`
8. PostgreSQL 15 installed and configured (localhost only; aisandbox db/user; least privilege)
9. Redis 7 installed and configured (localhost only; requirepass)
10. `/opt/aisandbox/.env` created with all required variables (Keith only; chmod 600)
11. Pre-deployment readiness gates G1–G27 checked
12. Services built and started via PM2 (startup order followed)
13. Pre-migration PostgreSQL backup taken
14. Lightsail snapshot taken
15. Keith explicit migration approval granted (7 conditions met)
16. `npm run migration:run:prod` executed and verified
17. Post-migration verification (20 checks) passed
18. Health smoke (H1–H9) passed
19. Caddy HTTPS smoke passed for staging.ainow.biz
20. Keith explicit approval to proceed with PRIVATE-BETA-DEPLOYMENT-READINESS Step 3

---

## 25. Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS

**PRIVATE-BETA-DEPLOYMENT-READINESS** (Task ID: PRIVATE-BETA-DEPLOYMENT-READINESS) remains **BLOCKED / PAUSED** after Step 2 (Stage-start / staging readiness plan — 2026-07-21).

The completion of PRIVATE-BETA-STAGING-SETUP **does not** unblock PRIVATE-BETA-DEPLOYMENT-READINESS for Step 3 execution. The planning chain is complete, but there is no real verified staging target yet.

PRIVATE-BETA-DEPLOYMENT-READINESS Step 3 (Execution / target deployment or staging readiness verification) requires:
1. A real staging server exists and is reachable at https://staging.ainow.biz, OR
2. An alternative target environment with explicit Keith approval for Step 3 use.

Neither condition is met as of 2026-07-23. PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED.

Do **not** mark PRIVATE-BETA-DEPLOYMENT-READINESS COMPLETE. Do **not** claim staging readiness is executed. Do **not** claim private beta is launched.

---

## 26. Recommended Next Task

The next practical path is one of the following (Keith decision required):

**Option A (Recommended):** Register a new bounded execution task to actually create and configure the AWS Lightsail staging server. This task would:
- Cover AWS instance creation + static IP
- SSH/server baseline hardening
- Runtime installation (Node.js, Docker, PM2, Caddy)
- Repository clone and build
- PostgreSQL and Redis installation and configuration
- Environment variable population (Keith manual VPS-side step)
- Pre-deployment gates check
- Application startup and health smoke
- Migration execution (with backup/snapshot gates + Keith approval)
- Post-migration verification and evidence collection

**Option B:** Resume PRIVATE-BETA-DEPLOYMENT-READINESS Step 3 only after a real staging target exists and Keith confirms it is ready for verification.

**Do not register a new task without Keith explicit approval.**

---

## 27. Acceptance Criteria Disposition

| Criterion | Status |
|-----------|--------|
| All 8 child tasks COMPLETE and LOCKED | ✓ PASS |
| Parent checkpoint created | ✓ PASS — this document |
| TASKS.md updated | ✓ PASS — PRIVATE-BETA-STAGING-SETUP marked COMPLETE and LOCKED |
| TASKS_BACKLOG_FULL.md updated | ✓ PASS — PRIVATE-BETA-STAGING-SETUP marked COMPLETE and LOCKED |
| AINOW roadmap updated | ✓ PASS — PRIVATE-BETA-STAGING-SETUP COMPLETE and LOCKED recorded |
| Staging setup decisions consolidated | ✓ PASS — sections 14–20 above |
| Execution/non-execution boundary recorded | ✓ PASS — sections 4 and 22 above |
| PRIVATE-BETA-DEPLOYMENT-READINESS handoff state recorded | ✓ PASS — section 25 above |
| No AWS/server/DNS/TLS/runtime/deployment/migration action occurred | ✓ CONFIRMED |
| No env/secret action occurred | ✓ CONFIRMED |
| No source/test/package/migration/entity/environment/Docker/deployment files changed | ✓ CONFIRMED |
| No git commit or push occurred | ✓ CONFIRMED |
| No subagents used | ✓ CONFIRMED |

---

## 28. Locked-State Instruction

**PRIVATE-BETA-STAGING-SETUP is COMPLETE and LOCKED as of 2026-07-23.**

Do not modify this checkpoint or any child task checkpoint except by explicitly approved follow-up task.

Do not re-open any child task (SETUP-01 through SETUP-08) without Keith explicit approval.

Do not claim staging is live. Do not claim private beta is launched.

Do not register a new staging execution task without Keith explicit approval.

---

## 29. Exact Next Action

**Await Keith explicit approval before proceeding.**

Recommended action after this consolidation:

> Register a new bounded execution task for actual AWS Lightsail staging server creation, configuration, and deployment — following the plans produced by SETUP-01 through SETUP-08 as the implementation blueprint.

Until Keith explicitly approves and that task is registered and executed:
- PRIVATE-BETA-STAGING-SETUP remains COMPLETE and LOCKED
- PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED
- No staging target exists
- No deployment has occurred
- No private beta has launched
