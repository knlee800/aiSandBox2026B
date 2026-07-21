# PRIVATE-BETA-DEPLOYMENT-READINESS — Step 2 Stage-Start / Staging Readiness Plan

**Task ID:** PRIVATE-BETA-DEPLOYMENT-READINESS
**Step:** 2 — Stage-Start / Target Environment + Readiness Plan
**Status:** COMPLETE — 2026-07-21
**Date:** 2026-07-21
**Nature:** Planning/readiness-plan only — no source, test, translation, package, migration, entity, environment, Docker, deployment, or governance files changed in this step.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-DEPLOYMENT-READINESS |
| Title | Private Beta Deployment / Staging Readiness Check |
| Family | BETA READY / PRIVATE BETA / DEPLOYMENT READINESS / STAGING GATE |
| Priority | CRITICAL |
| Nature | HIGH-RISK DEPLOYMENT READINESS PLANNING + TARGET ENVIRONMENT VERIFICATION |
| Risk | HIGH |
| Step | 2 — Stage-Start / Target Environment + Readiness Plan |
| Registered | 2026-07-21 |
| Keith Approval | "go" — 2026-07-21 |
| Keith Target Decision | B) Staging / production-like target — recommended and selected |
| Predecessors | LIMITED-PRIVATE-BETA-HANDOFF — COMPLETE and LOCKED — 2026-07-21 |
| | BETA-READY-SMOKE / B3 — COMPLETE and LOCKED — PASS — 2026-07-21 |
| | BETA-READY-MIGRATION-CLI-01 — COMPLETE and LOCKED — 2026-07-21 |
| | BETA-READY-DEPLOYMENT-CONFIG — COMPLETE and LOCKED — 2026-07-20 |
| Step 1 | COMPLETE — Registration — 2026-07-21 |
| Step 2 | This document — Stage-Start / Staging Readiness Plan — 2026-07-21 |
| Step 3 | PENDING — Execution / Target Deployment or Staging Readiness Verification |
| Step 4 | PENDING — Consolidation / Go-No-Go Handoff Before Invite |

---

## 2. Selected Target Type

| Field | Value |
|-------|-------|
| Target type | Staging / production-like test target |
| Keith decision | B) Staging / production-like target — recommended and selected |
| Decision date | 2026-07-21 |

**Meaning:** A deployment target that is close enough to production to verify real environment configuration, database, Redis, auth/session behavior, health endpoints, frontend/backend routing, and Create Agent persistence before inviting private beta users.

**Target deployment existence:** UNKNOWN

The available documentation does not identify an existing staging target. No deployed staging URL has been recorded in any checkpoint or governance document. Step 3 must begin by verifying whether a staging/production-like target exists.

If no staging target exists in Step 3, Step 3 must stop and recommend a separate deployment setup task.

---

## 3. Why Staging / Production-Like Target Was Selected

| # | Reason |
|---|--------|
| 1 | Local B3 smoke only proves the local development path; production/staging behavior (TLS, real DNS, inter-service Docker networking, production environment variables) has not been verified |
| 2 | The LIMITED-PRIVATE-BETA-HANDOFF checklist explicitly requires target environment verification before inviting users |
| 3 | Auth/session behavior (cookies, CSRF, secure flags) may differ between localhost and a deployed target behind a reverse proxy |
| 4 | Database and Redis are separate managed/containerized services in staging/production — connectivity, credentials, and migration state must be verified independently |
| 5 | Cross-origin and HTTPS behavior cannot be confirmed locally |
| 6 | Deployment topology (reverse proxy, TLS termination, service startup order) is documented but unverified |
| 7 | BETA-READY-DEPLOYMENT-CONFIG created `.env.staging.example`, `.env.production.example`, and `docs/DEPLOYMENT-GUIDE.md` — these remain template-only until applied to a real target |
| 8 | Keith explicitly selected option B (staging/production-like target) on 2026-07-21 |

---

## 4. Current Known Local Readiness

The following have been verified locally and are COMPLETE and LOCKED:

| # | Item | Evidence | Date |
|---|------|----------|------|
| 1 | `/[locale]/platform` RPG command-center UI | AGENT-PLATFORM-RPG-03A | 2026-07-20 |
| 2 | Platform auth guard | AGENT-PLATFORM-RPG-03B | 2026-07-20 |
| 3 | Workspace CTA → platform | AGENT-PLATFORM-RPG-03B | 2026-07-20 |
| 4 | Create Agent backend API | AGENT-PLATFORM-CREATE-01A | 2026-07-20 |
| 5 | Create Agent MVP UI | AGENT-PLATFORM-CREATE-01B | 2026-07-20 |
| 6 | Local full-stack smoke PASS | BETA-READY-SMOKE / B3 | 2026-07-21 |
| 7 | Local health endpoints passing | B3 | 2026-07-21 |
| 8 | Local auth guards working (401 unauthenticated) | B3 | 2026-07-21 |
| 9 | Local DB-backed Create Agent create/list/refresh/detail | B3 | 2026-07-21 |
| 10 | Multilingual en/zh-TW/zh-CN platform | B3 | 2026-07-21 |
| 11 | Desktop and ~390px responsive | B3 | 2026-07-21 |
| 12 | Static system agents preserved | B3 | 2026-07-21 |
| 13 | TypeORM migration CLI fixed | BETA-READY-MIGRATION-CLI-01 | 2026-07-21 |
| 14 | Deployment config templates created | BETA-READY-DEPLOYMENT-CONFIG | 2026-07-20 |
| 15 | Agent harness write-path canary PASS | AGENT-HARNESS-WRITE-CANARY | 2026-07-20 |
| 16 | `user_agents` migration applied to local DB | B3 | 2026-07-21 |

---

## 5. What Remains Unknown

| # | Item | Status |
|---|------|--------|
| 1 | Whether a staging/production-like target exists | UNKNOWN |
| 2 | Target URL / domain | UNKNOWN |
| 3 | Target hosting provider / location | UNKNOWN |
| 4 | Whether backend is deployed to target | UNKNOWN |
| 5 | Whether frontend is deployed to target | UNKNOWN |
| 6 | Whether target PostgreSQL exists | UNKNOWN |
| 7 | Whether target Redis exists | UNKNOWN |
| 8 | Whether environment variables are configured in target | UNKNOWN |
| 9 | Target migration status | UNKNOWN |
| 10 | Whether `user_agents` table exists in target | UNKNOWN |
| 11 | Whether TLS/HTTPS is configured | UNKNOWN |
| 12 | Whether reverse proxy is configured | UNKNOWN |
| 13 | Whether health endpoints return 200 in target | UNKNOWN |
| 14 | Whether auth/session works in target | UNKNOWN |
| 15 | Whether `/platform` routes work in target | UNKNOWN |
| 16 | Whether Create Agent works in target | UNKNOWN |
| 17 | Rollback / restart path for target | UNKNOWN |
| 18 | Support / feedback channel for beta users | UNKNOWN |
| 19 | Who can access the beta target | UNKNOWN |

---

## 6. Target Environment Assumptions

| # | Assumption | Source |
|---|-----------|--------|
| 1 | Single Linux server self-hosted for limited beta | BETA-READY-DEPLOYMENT-CONFIG stage-start |
| 2 | TLS via Caddy or nginx with Let's Encrypt on `ainow.biz` | BETA-READY-DEPLOYMENT-CONFIG stage-start |
| 3 | Frontend (:3002) and API Gateway (:4000) exposed via reverse proxy on HTTPS/443 | BETA-READY-DEPLOYMENT-CONFIG topology |
| 4 | PostgreSQL 15 and Redis 7 running as internal services | BETA-READY-DEPLOYMENT-CONFIG topology |
| 5 | AI Service Worker (:4001) and Container Manager (:4002) internal only | BETA-READY-DEPLOYMENT-CONFIG topology |
| 6 | Docker Engine available for sandbox containers | BETA-READY-DEPLOYMENT-CONFIG topology |
| 7 | `NODE_ENV=production` | `.env.staging.example` / `.env.production.example` |
| 8 | `LAUNCH_STATE=INTERNAL` | `.env.staging.example` / `.env.production.example` |
| 9 | `BILLING_CHARGES_ENABLED=false` | `.env.staging.example` / `.env.production.example` |
| 10 | `STRIPE_PROVIDER_MODE=disabled` | `.env.staging.example` / `.env.production.example` |

These assumptions are derived from locked deployment configuration templates. Whether the actual target matches them is UNKNOWN.

---

## 7. Required Target Services

| # | Service | Port | Exposure | Required for Beta |
|---|---------|------|----------|-------------------|
| 1 | Frontend (Next.js) | 3002 | Public via reverse proxy | YES |
| 2 | API Gateway (NestJS) | 4000 | Public via reverse proxy | YES |
| 3 | PostgreSQL 15 | 5432 | Internal only | YES |
| 4 | Redis 7 | 6379 | Internal only | YES |
| 5 | AI Service Worker (NestJS) | 4001 | Internal only | YES (BullMQ queue startup) |
| 6 | Container Manager (NestJS) | 4002 | Internal only | YES (container lifecycle) |
| 7 | Docker Engine | socket | Internal only | YES (sandbox containers) |
| 8 | Reverse Proxy (Caddy/nginx) | 443 | Public | YES (TLS termination) |

---

## 8. Environment Variable Presence Checklist (Without Values)

Step 3 must verify presence of these environment variable names in the target hosting dashboard or server configuration. No values should be printed, pasted, or exposed.

### 8A. Root / Shared

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `NODE_ENV` | YES | present / missing / unknown |
| 2 | `LAUNCH_STATE` | YES | present / missing / unknown |
| 3 | `POSTGRES_HOST` | YES | present / missing / unknown |
| 4 | `POSTGRES_PORT` | YES | present / missing / unknown |
| 5 | `POSTGRES_USER` | YES | present / missing / unknown |
| 6 | `POSTGRES_PASSWORD` | YES (SECRET) | configured / not configured / unknown |
| 7 | `POSTGRES_DB` | YES | present / missing / unknown |
| 8 | `DATABASE_URL` | YES (SECRET) | configured / not configured / unknown |
| 9 | `REDIS_HOST` | YES | present / missing / unknown |
| 10 | `REDIS_PORT` | YES | present / missing / unknown |
| 11 | `REDIS_PASSWORD` | YES (SECRET) | configured / not configured / unknown |
| 12 | `REDIS_URL` | YES (SECRET) | configured / not configured / unknown |
| 13 | `INTERNAL_SERVICE_KEY` | YES (SECRET) | configured / not configured / unknown |

### 8B. API Gateway

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `PORT` (4000) | YES | present / missing / unknown |
| 2 | `JWT_SECRET` | YES (SECRET) | configured / not configured / unknown |
| 3 | `JWT_EXPIRES_IN` | YES | present / missing / unknown |
| 4 | `JWT_REFRESH_EXPIRES_IN` | YES | present / missing / unknown |
| 5 | `SESSION_SECRET` | YES (SECRET) | configured / not configured / unknown |
| 6 | `OAUTH_STATE_SECRET` | YES (SECRET) | configured / not configured / unknown |
| 7 | `APP_BASE_URL` | YES | present / missing / unknown |
| 8 | `GOOGLE_CLIENT_ID` | YES (SECRET) | configured / not configured / unknown |
| 9 | `GOOGLE_CLIENT_SECRET` | YES (SECRET) | configured / not configured / unknown |
| 10 | `GOOGLE_CALLBACK_URL` | YES | present / missing / unknown |
| 11 | `AI_PROVIDER` | YES | present / missing / unknown |
| 12 | `ANTHROPIC_API_KEY` | YES (SECRET) | configured / not configured / unknown |
| 13 | `OPENAI_API_KEY` | YES (SECRET) | configured / not configured / unknown |
| 14 | `SESSION_TIMEOUT_MINUTES` | YES | present / missing / unknown |
| 15 | `MAX_CONCURRENT_SESSIONS` | YES | present / missing / unknown |
| 16 | `EMAIL_PROVIDER` | YES | present / missing / unknown |

### 8C. Kill Switches

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `GLOBAL_EXECUTION_ENABLED` | YES | present / missing / unknown |
| 2 | `PROVIDER_OPENAI_ENABLED` | YES | present / missing / unknown |
| 3 | `PROVIDER_ANTHROPIC_ENABLED` | YES | present / missing / unknown |
| 4 | `BILLING_SNAPSHOT_ENABLED` | YES | present / missing / unknown |
| 5 | `PAYMENT_EXECUTION_ENABLED` | YES | present / missing / unknown |

### 8D. Safety Limits

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `MAX_TOKENS_PER_EXECUTION` | YES | present / missing / unknown |
| 2 | `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | YES | present / missing / unknown |
| 3 | `MAX_DAILY_SPEND_SOFT_USD` | YES | present / missing / unknown |
| 4 | `MAX_DAILY_SPEND_HARD_USD` | YES | present / missing / unknown |

### 8E. AI Service Worker

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `API_GATEWAY_URL` | YES | present / missing / unknown |
| 2 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | YES | present / missing / unknown |
| 3 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | YES | present / missing / unknown |
| 4 | `AGENT_HARNESS_STUB_WRITE_MODE` | YES (must be `false`) | present / missing / unknown |

### 8F. Container Manager

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `DOCKER_HOST` | YES | present / missing / unknown |
| 2 | `CONTAINER_CPU_LIMIT` | YES | present / missing / unknown |
| 3 | `CONTAINER_MEMORY_LIMIT` | YES | present / missing / unknown |

### 8G. Frontend

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `API_GATEWAY_URL` | YES | present / missing / unknown |
| 2 | `NEXT_PUBLIC_PROJECT_FIRST_UX` | YES | present / missing / unknown |
| 3 | `NEXT_PUBLIC_SHOW_DEV_TOOLS` | YES (must be `false`) | present / missing / unknown |

### 8H. Billing / Payment (All Disabled)

| # | Variable Name | Required | Check |
|---|--------------|----------|-------|
| 1 | `BILLING_CHARGES_ENABLED` | YES (must be `false`) | present / missing / unknown |
| 2 | `STRIPE_PROVIDER_MODE` | YES (must be `disabled`) | present / missing / unknown |

---

## 9. Database Readiness Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | Target PostgreSQL exists and is reachable | Connection accepted | Keith confirms via hosting dashboard or `pg_isready` |
| 2 | Target database name exists | Database created | Keith confirms via dashboard or SQL |
| 3 | Target database user exists with appropriate permissions | User with read/write | Keith confirms via dashboard |
| 4 | API Gateway can connect to target PostgreSQL | Health endpoint returns DB connected | `GET /api/health/db` returns 200 |
| 5 | Database backup exists or can be taken before migration | Backup available | Keith confirms |

---

## 10. Migration Readiness Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | API Gateway is built (`npm run build`) in target | `dist/` exists and is current | Keith confirms |
| 2 | Migration table exists or can be created | TypeORM `migrations` table | `migration:show` or SQL check |
| 3 | `migration:show` reports migration status | List of applied/pending migrations | Non-destructive read-only command |
| 4 | `user_agents` table exists in target DB | Table present | `SELECT table_name FROM information_schema.tables WHERE table_name = 'user_agents';` |
| 5 | No pending migration uncertainty | All expected migrations applied | `migration:show` shows no unexpected pending |
| 6 | If migrations are pending: Keith approval required before execution | Keith explicit "go" | Step 3 stops and recommends separate migration task |

**Migration safety rules:**
- Do NOT execute migrations in Step 2 (this document) or Step 3 without Keith explicit approval.
- Step 3 checks migration status non-destructively first.
- If `user_agents` table is missing and migration must be executed, Step 3 stops and recommends a separate migration execution task requiring Keith explicit approval.
- Never run `docker compose down -v` — this destroys database volumes.
- Database backup must exist before any migration execution.

---

## 11. Redis Readiness Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | Target Redis exists and is reachable | Connection accepted | Keith confirms via dashboard or `redis-cli ping` |
| 2 | Redis password is configured | AUTH configured | Keith confirms variable presence (no value exposed) |
| 3 | API Gateway can connect to Redis | BullMQ queue startup succeeds | API Gateway startup logs or health |
| 4 | Redis is accessible from AI Service Worker | Worker queue connection succeeds | AI Service startup logs |

---

## 12. Backend / API Health Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | API Gateway starts without error | Nest application started | Service logs / startup confirmation |
| 2 | `GET /api/health` returns 200 | `{ status: "ok" }` | HTTP request to target URL |
| 3 | `GET /api/health/db` returns 200 | `{ status: "ok", database: "connected" }` | HTTP request to target URL |
| 4 | `GET /api/health/ready` returns 200 | `{ ready: true, environment: "validated" }` | HTTP request to target URL |
| 5 | No startup crash loops | Service remains running after startup | Keith confirms stable uptime |

---

## 13. Frontend Route Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | Frontend starts without error | Next.js Ready | Service logs or target URL loads |
| 2 | Root URL (`/`) loads | Homepage or redirect | Browser check |
| 3 | `/en/platform` loads (authenticated) | Platform dashboard renders | Keith browser check |
| 4 | `/zh-TW/platform` loads (authenticated) | Platform dashboard in Traditional Chinese | Keith browser check |
| 5 | `/zh-CN/platform` loads (authenticated) | Platform dashboard in Simplified Chinese | Keith browser check |
| 6 | `/en/login` loads | Login page renders | Browser check |
| 7 | `/en/app` loads (authenticated) | Workspace with platform CTA | Keith browser check |

---

## 14. Auth / Session Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | `GET /api/auth/me` without cookie returns 401 | Unauthenticated guard | HTTP request |
| 2 | Login flow completes (Google OAuth or configured provider) | Session cookie set | Keith browser login |
| 3 | `GET /api/auth/me` with valid cookie returns user | Authenticated session | After login |
| 4 | Session cookie has Secure flag (HTTPS) | Cookie attributes correct | Browser DevTools |
| 5 | Session persists across page reloads | User remains authenticated | Keith browser check |
| 6 | `/[locale]/platform` redirects to login when unauthenticated | Auth guard works | Browser check without login |

---

## 15. RPG Platform Route Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | `/en/platform` renders RPG command-center dashboard | Agent cards visible | Keith browser |
| 2 | `/zh-TW/platform` renders in Traditional Chinese | No hardcoded English in main UI | Keith browser |
| 3 | `/zh-CN/platform` renders in Simplified Chinese | No hardcoded English in main UI | Keith browser |
| 4 | Static system agents display correctly | Builder Agent, Chief of Staff, Product Strategy, Technology Advisor | Keith browser |
| 5 | Builder Agent shows "Start Building" CTA | CTA links to `/${locale}/app` | Keith browser |
| 6 | Coming-soon agents show appropriate state | No 404 or broken links | Keith browser |

---

## 16. Workspace CTA Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | `/en/app` contains Platform CTA | BuildingOffice2Icon / link visible | Keith browser |
| 2 | Platform CTA routes to `/en/platform` | Navigation works | Keith browser |
| 3 | `/zh-TW/app` CTA routes to `/zh-TW/platform` | Locale-aware navigation | Keith browser |
| 4 | `/zh-CN/app` CTA routes to `/zh-CN/platform` | Locale-aware navigation | Keith browser |

---

## 17. Create Agent Target Smoke Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | `GET /api/agents` without cookie returns 401 | Guarded endpoint | HTTP request |
| 2 | `POST /api/agents` without cookie returns 401 | Guarded endpoint | HTTP request |
| 3 | Create Agent form renders on platform | Form visible when authenticated | Keith browser |
| 4 | Submit Create Agent form | Agent created, success message | Keith browser |
| 5 | Created agent appears in "Your Agents" section | List updates | Keith browser |
| 6 | Page refresh preserves created agent | DB persistence works | Keith browser |
| 7 | Agent detail panel shows name/role/description | Detail renders | Keith browser |
| 8 | `GET /api/agents` with valid session returns agent list | JSON response with user's agents | After authentication |

---

## 18. Multilingual Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | `/zh-TW/platform` — no obvious hardcoded English in main UI text | Traditional Chinese labels | Keith browser |
| 2 | `/zh-CN/platform` — no obvious hardcoded English in main UI text | Simplified Chinese labels | Keith browser |
| 3 | `/zh-TW/login` — no obvious hardcoded English | Login page in Traditional Chinese | Keith browser |
| 4 | `/zh-CN/login` — no obvious hardcoded English | Login page in Simplified Chinese | Keith browser |
| 5 | Create Agent form labels in zh-TW/zh-CN | Translated form text | Keith browser |
| 6 | Agent detail panel in zh-TW/zh-CN | Translated panel labels | Keith browser |

---

## 19. Desktop / Mobile Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | Desktop layout (~1280px+) is acceptable | No visual breakage, proper spacing | Keith browser |
| 2 | ~390px mobile layout is acceptable | No horizontal overflow, readable text | Keith browser DevTools |
| 3 | Create Agent form is usable on mobile | Form inputs accessible | Keith browser DevTools |
| 4 | Agent cards are readable on mobile | Cards stack/wrap properly | Keith browser DevTools |
| 5 | Navigation is accessible on mobile | Menu/links are tap-friendly | Keith browser DevTools |

---

## 20. Static System Agents Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | Builder Agent visible with active status | Green indicator / active badge | Keith browser |
| 2 | Builder Agent "Start Building" CTA works | Routes to workspace | Keith browser |
| 3 | Chief of Staff visible with coming-soon state | Appropriate visual indicator | Keith browser |
| 4 | Product Strategy visible with coming-soon state | Appropriate visual indicator | Keith browser |
| 5 | Technology Advisor visible with coming-soon state | Appropriate visual indicator | Keith browser |
| 6 | Static agents are not affected by Create Agent operations | Remain unchanged after creating user agent | Keith browser |

---

## 21. Rollback / Restart Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | SSH or remote access to target server exists | Keith can connect | Keith confirms |
| 2 | Service restart command is known | e.g., `docker compose restart <service>` | Keith confirms |
| 3 | Full stack restart command is known | e.g., `docker compose restart` | Keith confirms |
| 4 | Database backup path is known | Backup exists or can be created | Keith confirms |
| 5 | Previous deployment can be restored | Git checkout or image restore path | Keith confirms |
| 6 | Kill switch mechanism works | Setting env vars and restarting disables features | Keith confirms |

---

## 22. Monitoring / Logging / Support Checklist

| # | Check | Expected Result | Step 3 Method |
|---|-------|-----------------|---------------|
| 1 | Service logs are accessible | Keith can view API Gateway / frontend logs | Keith confirms (e.g., `docker compose logs`) |
| 2 | Health endpoint can be pinged externally | Uptime check possible | HTTP request to target health URL |
| 3 | Error logs are distinguishable from normal output | Structured logging or log levels | Keith confirms |
| 4 | Support / feedback channel is defined | Channel exists and beta users know it | Keith defines before invite |
| 5 | Keith is primary point of contact for beta issues | Confirmed | Keith confirms |

---

## 23. Stop Conditions

Step 3 must STOP immediately if any of the following are true:

| # | Stop Condition |
|---|----------------|
| 1 | No staging/production-like target exists |
| 2 | Target URL is unknown and Keith cannot provide it |
| 3 | Target credentials/secrets are required but unavailable |
| 4 | Checking requires exposing or printing secret values |
| 5 | Checking requires editing `.env` files |
| 6 | Checking requires destructive database commands |
| 7 | Checking requires migration execution (without Keith explicit approval) |
| 8 | Checking requires deployment setup that does not yet exist |
| 9 | Checking requires source code changes |
| 10 | Checking requires package changes |
| 11 | Checking reveals data-loss risk |
| 12 | Keith has not approved the next risk-bearing action |
| 13 | Any safety boundary from Section 27 would be violated |

When stopped, Step 3 must record what was found, what is missing, and recommend the appropriate separate task (e.g., deployment setup task, migration execution task) requiring Keith explicit approval.

---

## 24. PASS / PASS WITH LIMITATION / FAIL Criteria

### PASS

All of the following must be true:

- [ ] Staging / production-like target exists
- [ ] Target frontend is reachable via HTTPS
- [ ] Target backend (API Gateway) is reachable
- [ ] `GET /api/health` returns 200
- [ ] `GET /api/health/db` returns 200 — database connected
- [ ] `GET /api/health/ready` returns 200 — environment validated
- [ ] Target environment variable presence verified without secrets exposed
- [ ] Target PostgreSQL is reachable and healthy
- [ ] Target Redis is reachable and healthy
- [ ] Target migration status verified — no uncertainty
- [ ] `user_agents` table exists in target DB
- [ ] Auth/session flow works in target (login, session cookie, `/api/auth/me` returns user)
- [ ] `/en/platform` works and is auth-guarded
- [ ] `/zh-TW/platform` works and is auth-guarded
- [ ] `/zh-CN/platform` works and is auth-guarded
- [ ] Create Agent create/list/refresh/detail works in target
- [ ] Static system agents display correctly
- [ ] Desktop layout is acceptable
- [ ] ~390px mobile layout is acceptable
- [ ] No obvious hardcoded English on zh-TW/zh-CN routes
- [ ] Rollback/restart path known and accessible by Keith
- [ ] Support/feedback channel defined

### PASS WITH LIMITATION

All of the following must be true:

- [ ] Core target checks pass (health, DB, Redis, auth, platform routes, Create Agent)
- [ ] At least one non-blocking limitation remains
- [ ] The limitation is documented with clear description
- [ ] Keith can still decide whether to proceed with 1-user beta (Keith only) despite the limitation
- [ ] No data-loss risk
- [ ] No security concern

Examples of acceptable limitations:
- Minor visual imperfection on one locale
- One optional service not yet configured (e.g., email provider in stub mode)
- Monitoring not yet fully configured
- Apple OAuth not yet configured (Google works)

### FAIL

Any of the following triggers FAIL:

- [ ] Target does not exist
- [ ] Target URL unknown
- [ ] Health endpoints fail (any of `/api/health`, `/api/health/db`, `/api/health/ready`)
- [ ] Auth/session is broken in target
- [ ] Database is unreachable
- [ ] Redis required but unavailable
- [ ] Migration status unknown or unsafe
- [ ] `user_agents` table missing
- [ ] Create Agent fails in target
- [ ] `/en/platform` or `/zh-TW/platform` or `/zh-CN/platform` fails to load
- [ ] Secrets/environment variables uncertain or contain placeholder values
- [ ] Rollback path unknown
- [ ] Serious zh/mobile blocker (completely broken, not minor imperfection)
- [ ] Any data-loss risk
- [ ] Keith approval not obtained for required risk-bearing action

---

## 25. Step 3 Execution Plan

### Phase 0 — Target Existence Verification

| # | Action | Who |
|---|--------|-----|
| 1 | Keith confirms whether a staging/production-like target exists | Keith |
| 2 | Keith provides target URL (without exposing secrets) | Keith |
| 3 | Keith confirms hosting provider/location | Keith |
| 4 | If NO target exists → STOP → recommend separate deployment setup task | — |

### Phase 1 — Target Reachability

| # | Action | Who |
|---|--------|-----|
| 1 | Verify target URL loads (frontend) | Keith or automated check |
| 2 | Verify API Gateway is reachable at target | Keith or automated check |
| 3 | Verify HTTPS/TLS is configured | Keith confirms |

### Phase 2 — Health Endpoints

| # | Action | Who |
|---|--------|-----|
| 1 | `GET {target}/api/health` → expect 200 | Automated or Keith |
| 2 | `GET {target}/api/health/db` → expect 200 | Automated or Keith |
| 3 | `GET {target}/api/health/ready` → expect 200 | Automated or Keith |

### Phase 3 — Environment Variable Presence

| # | Action | Who |
|---|--------|-----|
| 1 | Keith confirms all Section 8 variable names are configured in hosting dashboard | Keith |
| 2 | No values printed or exposed | — |
| 3 | Record presence/missing/unknown per variable group | Keith |

### Phase 4 — Database and Migration

| # | Action | Who |
|---|--------|-----|
| 1 | Confirm PostgreSQL is running and reachable in target | Keith |
| 2 | Confirm Redis is running and reachable in target | Keith |
| 3 | Check migration status (`migration:show` or SQL query) — non-destructive | Keith |
| 4 | Verify `user_agents` table exists | Keith via SQL |
| 5 | If migration is pending or uncertain → STOP → recommend separate migration execution task | — |

### Phase 5 — Auth / Session

| # | Action | Who |
|---|--------|-----|
| 1 | `GET {target}/api/auth/me` without cookie → expect 401 | Keith or automated |
| 2 | Login via Google OAuth (or configured provider) | Keith browser |
| 3 | Verify session cookie is set with Secure flag | Keith browser DevTools |
| 4 | `GET {target}/api/auth/me` with cookie → expect user | Keith browser |

### Phase 6 — Platform Routes + Create Agent

| # | Action | Who |
|---|--------|-----|
| 1 | Navigate to `/en/platform` → authenticated access | Keith browser |
| 2 | Navigate to `/zh-TW/platform` → authenticated access | Keith browser |
| 3 | Navigate to `/zh-CN/platform` → authenticated access | Keith browser |
| 4 | Verify workspace CTA routing | Keith browser |
| 5 | Create Agent: submit form, verify success, verify list, verify refresh, verify detail | Keith browser |
| 6 | Verify static system agents display correctly | Keith browser |

### Phase 7 — Responsive + Multilingual + Visual

| # | Action | Who |
|---|--------|-----|
| 1 | Desktop layout check | Keith browser |
| 2 | ~390px mobile layout check (DevTools) | Keith browser |
| 3 | zh-TW/zh-CN hardcoded-English check | Keith browser |

### Phase 8 — Rollback / Support

| # | Action | Who |
|---|--------|-----|
| 1 | Confirm rollback/restart path | Keith |
| 2 | Confirm support/feedback channel | Keith |
| 3 | Confirm who can access the beta target | Keith |

### Phase 9 — Verdict

| # | Action | Who |
|---|--------|-----|
| 1 | Record all check results | Keith / Cursor |
| 2 | Apply PASS / PASS WITH LIMITATION / FAIL criteria | — |
| 3 | Record verdict and proceed to Step 4 consolidation | — |

---

## 26. Keith Manual Actions Required

Keith must provide or confirm the following (without revealing secret values):

| # | Action | When |
|---|--------|------|
| 1 | Confirm target URL / deployment location | Phase 0 |
| 2 | Confirm hosting provider / location | Phase 0 |
| 3 | Confirm whether backend and frontend are already deployed | Phase 0 |
| 4 | Confirm whether target PostgreSQL exists and is reachable | Phase 4 |
| 5 | Confirm whether target Redis exists and is reachable | Phase 4 |
| 6 | Confirm all env variable names from Section 8 are configured in hosting dashboard (no values exposed) | Phase 3 |
| 7 | Confirm who can access the beta target | Phase 8 |
| 8 | Confirm support / feedback channel | Phase 8 |
| 9 | Approve any future migration execution separately (if needed) | Phase 4 (stop condition) |
| 10 | Approve any future user invite separately | After Step 4 |

---

## 27. Safety Boundaries

| # | Safety Boundary |
|---|----------------|
| 1 | No implementation during this step or Step 3 |
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
| 18 | Future checks must verify env variable presence without exposing values |
| 19 | Future migration checks must be non-destructive |
| 20 | Step 3 must stop if any safety boundary would be violated |

---

## 28. Exact Next Action

**Step 3 Execution begins when Keith provides Phase 0 answers.**

Step 3 cannot proceed until Keith confirms:
1. Whether a staging/production-like target exists.
2. The target URL (without exposing secrets in this document).
3. Whether backend and frontend are already deployed to the target.

If no target exists, Step 3 must stop immediately and recommend a separate deployment setup task requiring Keith explicit approval.

If a target exists, Step 3 proceeds through Phases 1–9 as described in Section 25, stopping at any stop condition from Section 23.

**No implementation. No deployment. No migration execution. No user invitations. No secrets. No subagents.**

---

**Document created:** 2026-07-21
**Step 2 status:** COMPLETE
**Predecessor evidence:** `docs/LIMITED-PRIVATE-BETA-HANDOFF-CHECKLIST.md`, `docs/LIMITED-PRIVATE-BETA-HANDOFF-CHECKPOINT.md`, `docs/BETA-READY-SMOKE-CHECKPOINT.md`, `docs/BETA-READY-SMOKE-EXECUTION.md`, `docs/BETA-READY-MIGRATION-CLI-01-CHECKPOINT.md`, `docs/BETA-READY-DEPLOYMENT-CONFIG-CHECKPOINT.md`, `.env.staging.example`, `.env.example`
**No secret-bearing environment files opened.**
**No subagents used.**
