# PRIVATE-BETA-STAGING-SETUP-07 — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP-07
**Title:** App Deployment / Health Smoke Plan
**Step:** 3 — Consolidation / Handoff to SETUP-08
**Final Status:** COMPLETE and LOCKED — 2026-07-22
**Date:** 2026-07-22
**Nature:** Governance / checkpoint only — no deployment, no app/API/browser smoke, no PostgreSQL/Redis action, no env file created/opened/edited, no secrets printed/requested/generated, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

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
| Keith Approval | "go" — 2026-07-22 |
| Registered | 2026-07-22 |
| Completed | 2026-07-22 |
| Step 1 | COMPLETE — Registration — 2026-07-22 |
| Step 2 | COMPLETE — App Deployment / Health Smoke Plan — 2026-07-22 — Verdict: PASS |
| Step 3 | COMPLETE — Consolidation / Handoff to SETUP-08 — 2026-07-22 |

---

## 2. Final Status

**PRIVATE-BETA-STAGING-SETUP-07: COMPLETE and LOCKED — 2026-07-22**

All 3 steps complete. App deployment / health smoke plan created with Step 2 verdict PASS. All pre-deployment gate checks documented (27 items, G1–G27). Service startup order documented. Health endpoints source-verified. All smoke plans documented. Migration boundary documented. Evidence collection rules documented. Checkpoint created. Governance files updated. SETUP-08 not registered.

---

## 3. Parent Task Status

**PRIVATE-BETA-STAGING-SETUP:** ACTIVE — Steps 1–2 COMPLETE — Step 3 executing via 8 child tasks — SETUP-01 COMPLETE and LOCKED (2026-07-21) — SETUP-02 COMPLETE and LOCKED (2026-07-21) — SETUP-03 COMPLETE and LOCKED (2026-07-21) — SETUP-04 COMPLETE and LOCKED (2026-07-21) — SETUP-05 COMPLETE and LOCKED (2026-07-21) — SETUP-06 COMPLETE and LOCKED (2026-07-22) — SETUP-07 COMPLETE and LOCKED (2026-07-22) — SETUP-08 PENDING registration.

Parent Step 3 continues via SETUP-08 (pending registration with Keith explicit approval).
Parent Step 4 (Consolidation / handoff back to deployment readiness verification) remains PENDING.

---

## 4. Why This Child Task Existed

SETUP-01 through SETUP-06 documented: AWS instance decisions, server baseline, domain/DNS/TLS, runtime/container deployment, env variable presence, and database/Redis setup plans. Before any service can be declared running on staging.ainow.biz, the app itself must be deployed, built, started, and health-smoked. SETUP-07 was created to produce the complete app deployment and health smoke plan: repo clone/update, dependency install, build, PM2 startup, service startup order, local/internal health checks, API Gateway health, DB/Redis readiness through app endpoints, frontend local smoke, Caddy external HTTPS smoke, staging.ainow.biz route smoke, locale route smoke, auth/session smoke, create agent bounded smoke, billing disabled-state smoke, safety/kill-switch verification, logs inspection, rollback/stop plan, evidence collection, and pass/blocked criteria.

---

## 5. App Deployment / Health Smoke Plan Path

**Plan document:** `docs/PRIVATE-BETA-STAGING-SETUP-07-APP-DEPLOYMENT-HEALTH-SMOKE-PLAN.md`

Created in Step 2. Contains 38 sections covering all deployment and health smoke requirements for future execution.

**Step 2 verdict: PASS — all criteria met — no blockers identified.**

Known execution-time risk: If migration is required for the `user_agents` table and has not been approved, Create Agent bounded smoke will be BLOCKED at execution time. This is an EXPECTED condition, not a planning blocker. SETUP-08 addresses migration readiness.

---

## 6. Confirmed Staging / Deployment Decisions

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

## 7. Pre-Deployment Readiness Gate

27-item gate (G1–G27) documented in the plan (Section 6). All items must show PASS before any future deployment execution begins.

| Gate | Area | Items |
|------|------|-------|
| 6A Infrastructure Gate | AWS instance, static IP, DNS, firewall, SSH | G1–G5 |
| 6B Runtime Gate | Node.js 20, npm, Docker, PM2, Caddy, Git | G6–G12 |
| 6C Data Layer Gate | PostgreSQL 15, Redis 7, db/user exists, pg_isready | G13–G20 |
| 6D Environment Gate | /opt/aisandbox exists, .env present, chmod 600, env presence validated | G21–G24 |
| 6E Safety Gate | Migration approval status explicit, billing disabled, kill switches present | G25–G27 |

Gate verdict: All G1–G27 must show PASS before deployment execution begins. Gate results must be recorded as evidence (PASS/BLOCKED per item, no secret values).

---

## 8. Required Setup Dependencies

All 6 predecessor child tasks confirmed COMPLETE and LOCKED at time of SETUP-07 completion:

| # | Dependency | Status | Document |
|---|-----------|--------|----------|
| 1 | SETUP-01 — AWS Lightsail instance decision | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-01-CHECKPOINT.md` |
| 2 | SETUP-02 — Server baseline and SSH access plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-02-CHECKPOINT.md` |
| 3 | SETUP-03 — Domain / DNS / TLS plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md` |
| 4 | SETUP-04 — Runtime / container deployment plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-04-CHECKPOINT.md` |
| 5 | SETUP-05 — Env variable presence checklist | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-05-CHECKPOINT.md` |
| 6 | SETUP-06 — Database / Redis setup plan | COMPLETE and LOCKED | `docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md` |

---

## 9. AWS / Server Prerequisites

| # | Prerequisite | Source Plan | Status at SETUP-07 |
|---|-------------|------------|-------------------|
| 1 | Lightsail instance created | SETUP-01 | Not yet created — future execution |
| 2 | Static IP attached | SETUP-01 | Not yet created — future execution |
| 3 | Firewall configured (22, 80, 443 only) | SETUP-02 | Not yet configured — future execution |
| 4 | SSH access verified | SETUP-02 | Not yet verified — future execution |
| 5 | Ubuntu LTS baseline updated | SETUP-02 | Not yet done — future execution |
| 6 | Timezone set to Asia/Hong_Kong | SETUP-02 | Not yet done — future execution |

---

## 10. DNS / TLS Prerequisites

| # | Prerequisite | Source Plan |
|---|-------------|------------|
| 1 | DNS A record: staging.ainow.biz → static IP | SETUP-03 |
| 2 | DNS propagation confirmed | SETUP-03 |
| 3 | Caddy installed | SETUP-04 |
| 4 | Caddyfile NOT created yet — created only after local services are healthy | Plan Section 19 |

---

## 11. Runtime Prerequisites

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

## 12. Env File Presence Prerequisites

| # | Prerequisite | Source Plan |
|---|-------------|------------|
| 1 | /opt/aisandbox/.env exists | SETUP-05 |
| 2 | chmod 600, owned by ubuntu:ubuntu | SETUP-05 |
| 3 | All required variable names present | SETUP-05 (validate-env-presence.sh) |
| 4 | Keith has entered all secret values on VPS | SETUP-05 |
| 5 | Values never exposed to Cursor/chat/AI | SETUP-05 |

---

## 13. PostgreSQL / Redis Prerequisites

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

## 14. Repo Clone / Update Plan

Documented in Plan Section 13. Summary:

- First-time clone: Keith decides source (GitHub HTTPS, SSH, or manual scp/rsync).
- /opt/aisandbox must be owned by ubuntu:ubuntu.
- `.env` must NOT appear in git tracked files — verify with `git status`.
- Future update via `git pull` (if cloned via git).
- No repo clone occurred in this planning step.

---

## 15. Dependency Install Plan

Documented in Plan Section 14. Summary:

- Recommended: `cd /opt/aisandbox && npm install` (workspace root install covers all services).
- Fallback: per-service `npm install` if workspace root install fails.
- Use `npm` on staging (not `bun` — bun is local dev only).
- Use `npm ci` if `package-lock.json` exists.
- Native dependencies (`better-sqlite3`, `bcrypt`) require Node.js 20 and build tools.

---

## 16. Build Plan

Documented in Plan Section 15. Build order:

| # | Service | Directory | Build Command | Output |
|---|---------|-----------|---------------|--------|
| 1 | API Gateway | `services/api-gateway/` | `npm run build` | `dist/` |
| 2 | AI Service Worker | `services/ai-service/` | `npm run build` | `dist/` |
| 3 | Container Manager | `services/container-manager/` | `npm run build` | `dist/` |
| 4 | Frontend | `frontend/` | `npm run build` | `.next/` |

All builds must complete without error before starting services.

---

## 17. Migration Boundary

Documented in Plan Section 16.

| # | Rule |
|---|------|
| 1 | SETUP-07 plan does NOT execute migrations |
| 2 | Future migration execution requires separate explicit Keith approval |
| 3 | If app startup requires schema, record as BLOCKED until migration approval is granted |
| 4 | A pre-migration `pg_dump` backup must be created before migrations |
| 5 | A Lightsail instance snapshot must be created before migrations |
| 6 | SETUP-08 handles Migration Readiness / Verification Plan |
| 7 | `npm run migration:show` (non-destructive) may be run in SETUP-08 with Keith approval |
| 8 | `npm run migration:run:prod` (destructive) requires separate explicit Keith approval |
| 9 | If API Gateway fails to start due to missing schema, record as BLOCKED and stop |

**Migration execution at time of SETUP-07: NOT APPROVED.**

---

## 18. PM2 Process Creation / Startup Plan

Documented in Plan Sections 17–18. Individual PM2 start commands recorded (preferred approach). Alternative PM2 ecosystem file approach also documented. PM2 configuration: 1 instance per service, auto-restart enabled, max 10 restarts, 5000ms restart delay, env vars loaded from /opt/aisandbox/.env.

PM2 startup/save plan: `pm2 save` after all services online; `pm2 startup` for systemd integration; PM2 log rotation via pm2-logrotate (50MB max, 7-day retain).

---

## 19. Service Startup Order

Documented in Plan Section 19. Source-verified startup order:

| # | Service | Wait For | Verification |
|---|---------|----------|-------------|
| 1 | PostgreSQL | systemd active | `pg_isready -U aisandbox -d aisandbox -h 127.0.0.1` |
| 2 | Redis | systemd active | `redis-cli -a '<password>' ping` → PONG |
| 3 | API Gateway | PostgreSQL + Redis running | `curl http://localhost:4000/api/health` |
| 4 | Container Manager | API Gateway healthy | `curl http://localhost:4002/api/health` |
| 5 | AI Service Worker | PostgreSQL + Redis + API Gateway | `pm2 status ai-service` → online |
| 6 | Frontend | API Gateway healthy | `curl http://localhost:3002` → 200 |
| 7 | Caddy | All local services healthy | `curl https://staging.ainow.biz` → 200 + valid TLS |

Caddy must be started LAST — only after all local services respond correctly.

---

## 20. Local / Internal Health Checks

Documented in Plan Section 20. Health check sequence (H1–H9):

| # | Check | Expected |
|---|-------|----------|
| H1 | PostgreSQL running | pg_isready exit code 0 |
| H2 | Redis running (authenticated) | PONG |
| H3 | PM2 all services online | All 4 show `online` |
| H4 | API Gateway basic health | `{ "status": "ok", "service": "api-gateway" }` |
| H5 | API Gateway DB health | `{ "status": "ok", "database": "connected" }` |
| H6 | API Gateway readiness | `{ "status": "ready", "checks": { ... } }` |
| H7 | Container Manager health | `{ "status": "ok", "service": "container-manager" }` |
| H8 | AI Service Worker | PM2 `online` + no error logs |
| H9 | Frontend local | HTTP 200 |

---

## 21. API Gateway Health Checks

Documented in Plan Section 21. Source-verified endpoints:

| # | Endpoint | Path | Expected Response |
|---|----------|------|-------------------|
| 1 | Basic health | `GET /api/health` | `{ "status": "ok", "service": "api-gateway", "version": "0.1.0" }` |
| 2 | DB health | `GET /api/health/db` | `{ "status": "ok", "database": "connected" }` |
| 3 | Readiness | `GET /api/health/ready` | `{ "status": "ready", "checks": { "environment": "validated", "database": "connected", "killSwitches": "loaded", "safetyLimits": "loaded" } }` |

**Container Manager correction:** Source code verification shows actual path is `GET /api/health` (port 4002) — not `/health` — because `setGlobalPrefix('api')` is set in `main.ts`. Plan Section 19 uses source-verified paths.

**AI Service Worker:** No dedicated health endpoint in codebase. Health inferred from PM2 process status and absence of Redis/BullMQ connection errors in logs.

---

## 22. DB / Redis Readiness Checks

Documented in Plan Section 22. DB connectivity verified via `/api/health/db`. Redis/BullMQ connectivity verified via PM2 status + absence of `ECONNREFUSED`/`NOAUTH` errors in `pm2 logs api-gateway` and `pm2 logs ai-service`.

---

## 23. Frontend Local Smoke

Documented in Plan Section 23. Six checks:
1. Frontend responds on port 3002 (HTTP 200)
2. Frontend returns HTML
3. `/en` route → 200
4. `/zh-TW` route → 200
5. `/zh-CN` route → 200
6. Root redirects to default locale (`/en`)

Supported locales confirmed from `middleware.ts`: `en`, `zh-TW`, `zh-CN`. Default locale: `en`.

---

## 24. Caddy External HTTPS Smoke

Documented in Plan Section 24. Five external checks (E1–E5):
1. HTTPS frontend loads → HTTP 200
2. TLS certificate valid (Let's Encrypt)
3. HTTP redirects to HTTPS (301 then 200)
4. API health through HTTPS → `{ "status": "ok" }`
5. API DB health through HTTPS → `{ "status": "ok", "database": "connected" }`

Prerequisites: All local services healthy, DNS resolved, Caddyfile created, no other service binding 80/443.

---

## 25. staging.ainow.biz Route Smoke

Documented in Plan Section 25. Six routes:
1. `https://staging.ainow.biz/` → 200
2. `https://staging.ainow.biz/en` → 200
3. `https://staging.ainow.biz/en/login` → 200
4. `https://staging.ainow.biz/en/platform` → 200 or redirect to login
5. `https://staging.ainow.biz/api/health` → 200
6. `https://staging.ainow.biz/api/health/ready` → 200

---

## 26. Locale Route Smoke

Documented in Plan Section 26. Six locale checks:
1. en `/en` → 200 — English UI
2. en `/en/login` → 200 — English login
3. zh-TW `/zh-TW` → 200 — Traditional Chinese UI
4. zh-TW `/zh-TW/login` → 200 — Traditional Chinese login
5. zh-CN `/zh-CN` → 200 — Simplified Chinese UI
6. zh-CN `/zh-CN/login` → 200 — Simplified Chinese login

---

## 27. Auth / Session Smoke

Documented in Plan Section 27. Six checks (login page loads, Google OAuth redirect, OAuth callback correct, session cookie set, authenticated route access, unauthenticated route redirect). Auth smoke rules: never print cookie/token values, never print OAuth callback params. If Google OAuth not yet configured, record as BLOCKED — not FAILED.

---

## 28. Create Agent Bounded Smoke

Documented in Plan Section 28. Five checks (Create Agent page loads, submit creates agent, agent list shows agent, agent detail loads, no AI execution triggered). Bounded scope: CRUD persistence path only. Kill switches prevent AI execution. If `user_agents` table does not exist due to unapproved migration, record as BLOCKED — defer to SETUP-08.

---

## 29. Billing Disabled-State Smoke

Documented in Plan Section 29. Four checks (billing page loads, no payment form, kill switch value via readiness, no Stripe SDK present). Safety confirmation: `BILLING_CHARGES_ENABLED=false`, `PAYMENT_EXECUTION_ENABLED=false`, `BILLING_SNAPSHOT_ENABLED=false`, no Stripe SDK installed, no Stripe API keys configured.

---

## 30. Safety / Kill-Switch Verification

Documented in Plan Section 30. 14 kill switch variables documented (G1–G14). Verification via env presence check (variable name only) and `/api/health/ready` response. Kill switch values must never be printed. If any kill switch is missing or incorrectly set, record as BLOCKED.

Key kill switches: `GLOBAL_EXECUTION_ENABLED`, `AI_PROVIDER`, `BILLING_CHARGES_ENABLED`, `PAYMENT_EXECUTION_ENABLED`, `BILLING_SNAPSHOT_ENABLED`, `AGENT_HARNESS_ENABLE_TOOL_LOOP`, `AGENT_HARNESS_ENABLE_WRITE_TOOLS`, `LAUNCH_STATE`, and all provider enable switches.

---

## 31. Logs Inspection Plan

Documented in Plan Section 31. Eight log sources: all PM2 logs, API Gateway errors, AI Service errors, Container Manager errors, Frontend errors, PostgreSQL logs, Redis logs, Caddy logs. Log inspection rules: look for ERROR/ECONNREFUSED/NOAUTH/FATAL/WARN/TIMEOUT/ENOMEM; never paste full logs; remove lines containing secrets; record sanitized excerpts only.

---

## 32. Rollback / Stop Plan

Documented in Plan Section 32. Ordered stop (reverse of startup): Caddy → Frontend → AI Service Worker → Container Manager → API Gateway. Emergency stop: `pm2 stop all && sudo systemctl stop caddy`. Bad deployment rollback: stop all → revert to last-known-good commit → rebuild → restart → verify health. Lightsail snapshot restore available as last resort (destructive — Keith decision only). Rollback safety rules: no `docker compose down -v`, no database/Redis data deletion, keep PostgreSQL/Redis running during app rollback.

---

## 33. Evidence Collection Rules

Documented in Plan Section 33. Safe evidence: command names, PASS/FAIL verdict per check, HTTP status codes, PM2 process names and status, endpoint names, sanitized log excerpts, service version from health response, kill switch counts from readiness. Prohibited evidence: secret values, cookie values, token values, full connection strings, .env file content, authorization headers, OAuth callback query params, full `pm2 env` output, `redis-cli -a` with actual password visible.

---

## 34. Keith Manual Action Checklist

Documented in Plan Section 34. 34 items organized as:
- Pre-deployment actions (3 items): verify gate, decide clone source, clone/transfer repo
- Deployment actions (7 items): npm install, build all 4 services, verify outputs, create snapshot
- PM2 service start actions (10 items): start and verify all 4 services, pm2 save, pm2 startup
- Caddy actions (3 items): create Caddyfile, start Caddy, enable Caddy on boot
- Post-deployment verification actions (11 items): local health checks, API health checks, external HTTPS smoke, locale smoke, auth smoke, Create Agent smoke, billing smoke, kill-switch verification, logs inspection, evidence collection, final snapshot

---

## 35. What Was Not Done

| # | Not Done |
|---|---------|
| 1 | No deployment |
| 2 | No repo clone |
| 3 | No dependency install/build/start |
| 4 | No PM2 process created |
| 5 | No Caddy configuration |
| 6 | No AWS server/static IP created |
| 7 | No DNS/TLS/firewall changed |
| 8 | No SSH to any server |
| 9 | No app/API/browser smoke executed |
| 10 | No PostgreSQL/Redis action |
| 11 | No DB/Redis commands run |
| 12 | No migration execution |
| 13 | No `.env` file created, opened, or edited |
| 14 | No real `.env`, `.env.local`, `.env.staging`, `.env.production` opened |
| 15 | No credential, key, certificate, or token file opened |
| 16 | No secret values printed, requested, or generated |
| 17 | No Docker used |
| 18 | No implementation |
| 19 | No source code changes |
| 20 | No test file changes |
| 21 | No package file changes |
| 22 | No migration, entity, or schema file changes |
| 23 | No environment file changes |
| 24 | No Docker file changes |
| 25 | No deployment file changes |
| 26 | No tests or builds run |
| 27 | No APIs called |
| 28 | No browser opened |
| 29 | No beta users invited |
| 30 | No subagents used |
| 31 | No git commit or push |
| 32 | No SETUP-08 registered |

---

## 36. Safety Boundaries Preserved

All safety boundaries confirmed preserved:

- No deployment — YES
- No repo clone — YES
- No dependency install/build/start — YES
- No PM2 process created — YES
- No Caddy configuration — YES
- No AWS server/static IP created — YES
- No DNS/TLS/firewall changed — YES
- No SSH to any server — YES
- No app/API/browser smoke executed — YES
- No PostgreSQL/Redis action — YES
- No DB/Redis commands run — YES
- No migration execution — YES
- No `.env` file created, opened, or edited — YES
- No real `.env`, `.env.local`, `.env.staging`, `.env.production` opened — YES
- No credential, key, certificate, or token file opened — YES
- No secret values printed, requested, or generated — YES
- No Docker used — YES
- No implementation — YES
- No source/test/package/migration/entity/environment/Docker/deployment files changed — YES
- No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred — YES
- No secret-bearing environment file opened — YES
- No subagents used — YES

---

## 37. Product Impact

SETUP-07 COMPLETE and LOCKED means:

- The full app deployment and health smoke plan is documented and available to Keith for future execution.
- The pre-deployment readiness gate (27 checks) provides a concrete go/no-go checklist before any deployment starts.
- The health endpoint paths are source-verified and corrected (Container Manager: `/api/health` not `/health`; AI Service Worker: no dedicated health endpoint).
- The service startup order (PostgreSQL → Redis → API Gateway → Container Manager → AI Service Worker → Frontend → Caddy) is documented with verification commands.
- The migration boundary is clearly documented: SETUP-07 does not execute migrations; migration execution requires separate explicit Keith approval; SETUP-08 handles migration readiness.
- All smoke plans (external HTTPS, locale, auth/session, Create Agent bounded, billing disabled-state, safety/kill-switch) are documented.
- Evidence collection rules prevent secret exposure during smoke.
- SETUP-01 through SETUP-07 (7 of 8 child tasks) are now COMPLETE and LOCKED.
- SETUP-08 remains the only pending child task under PRIVATE-BETA-STAGING-SETUP Step 3.

---

## 38. Dependency / Handoff to SETUP-08

| Field | Value |
|-------|-------|
| Next child task | PRIVATE-BETA-STAGING-SETUP-08 |
| Title | Migration Readiness / Verification Plan |
| Expected scope | Plan non-destructive `migration:show` check, verify `user_agents` table existence, plan pre-migration backup, plan migration execution approval process |
| Prerequisites | SETUP-07 COMPLETE and LOCKED (confirmed) |
| Registration | Keith must explicitly approve SETUP-08 registration |
| Status | NOT YET REGISTERED — pending Keith approval |

**SETUP-08 was not registered in this step.**

---

## 39. Acceptance Criteria Disposition

### Step 1 — Registration
- [x] PRIVATE-BETA-STAGING-SETUP-07 registered in TASKS.md and TASKS_BACKLOG_FULL.md
- [x] Keith explicit approval recorded ("go" — 2026-07-22)
- [x] 3-step child workflow registered
- [x] 32-item Step 2 scope documented
- [x] Recommended defaults recorded
- [x] Safety boundaries recorded
- [x] No deployment/smoke/runtime/PostgreSQL/Redis/env/secrets/implementation during registration
- [x] No subagents

### Step 2 — App Deployment / Health Smoke Plan
- [x] All 32 scope items covered (plan covers 38 sections, including all 32 scope items)
- [x] Pre-deployment readiness gate documented (27 checks, G1–G27)
- [x] Migration boundary documented (no execution without separate Keith approval)
- [x] PM2 startup and service startup order documented
- [x] All local/internal and external health smoke steps documented
- [x] Locale route smoke (en / zh-TW / zh-CN) documented
- [x] Auth/session smoke plan documented
- [x] Create Agent bounded smoke plan documented
- [x] Billing disabled-state smoke documented
- [x] Safety/kill-switch verification documented
- [x] Evidence collection plan documented
- [x] Rollback/stop plan documented
- [x] PASS/BLOCKED criteria documented
- [x] No deployment occurred
- [x] No app/API/browser smoke occurred
- [x] No real env file created, opened, or edited
- [x] No secret values printed, requested, or committed
- [x] Step 2 verdict: PASS — all criteria met — no blockers identified
- [x] Keith explicit approval recorded before starting Step 2

### Step 3 — Consolidation / Handoff to SETUP-08
- [x] Plan document created: `docs/PRIVATE-BETA-STAGING-SETUP-07-APP-DEPLOYMENT-HEALTH-SMOKE-PLAN.md`
- [x] Checkpoint document created: `docs/PRIVATE-BETA-STAGING-SETUP-07-CHECKPOINT.md`
- [x] PRIVATE-BETA-STAGING-SETUP-07 marked COMPLETE and LOCKED
- [x] AINOW-EXECUTION-ROADMAP.md updated
- [x] SETUP-08 not registered in this step

---

## 40. Locked-State Instruction

**PRIVATE-BETA-STAGING-SETUP-07 is COMPLETE and LOCKED as of 2026-07-22.**

This task must not be edited except for explicitly approved documentation correction.

The app deployment / health smoke plan at `docs/PRIVATE-BETA-STAGING-SETUP-07-APP-DEPLOYMENT-HEALTH-SMOKE-PLAN.md` must not be modified.

The following tasks remain COMPLETE and LOCKED and must not be modified:
- PRIVATE-BETA-STAGING-SETUP-01 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-02 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-03 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-04 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-05 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-06 (2026-07-22)
- PRIVATE-BETA-STAGING-SETUP-07 (2026-07-22)

---

## 41. Exact Next Action

**Next recommended action: Register PRIVATE-BETA-STAGING-SETUP-08 — Migration Readiness / Verification Plan.**

SETUP-08 registration requires Keith explicit approval.

After SETUP-08 is COMPLETE and LOCKED, PRIVATE-BETA-STAGING-SETUP Step 3 will be fully complete (all 8 child tasks done), enabling parent Step 4 (Consolidation / handoff back to PRIVATE-BETA-DEPLOYMENT-READINESS).

No deployment. No repo clone. No dependency install/build/start. No PM2 process created. No Caddy config. No app/API/browser smoke. No PostgreSQL/Redis action. No env file created/opened/edited. No secrets printed/requested/generated. No implementation. No subagents.

---

**Checkpoint created:** 2026-07-22
**Task status:** COMPLETE and LOCKED — 2026-07-22
**Parent task status:** PRIVATE-BETA-STAGING-SETUP — ACTIVE — Step 3 continues via SETUP-08
