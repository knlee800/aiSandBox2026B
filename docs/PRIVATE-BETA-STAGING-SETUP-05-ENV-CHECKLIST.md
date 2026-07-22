# PRIVATE-BETA-STAGING-SETUP-05 — Env Variable Presence Checklist + Secret Entry Procedure

**Task ID:** PRIVATE-BETA-STAGING-SETUP-05
**Title:** Env Variable Presence Checklist + Secret Entry Procedure
**Step:** 2 — Env Variable Presence Checklist + Secret Entry Procedure
**Status:** CREATED — 2026-07-21
**Date:** 2026-07-21
**Nature:** Planning / checklist only — no `.env` files created, opened, or edited; no secret values printed, requested, or generated; no implementation; no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-05 |
| Title | Env Variable Presence Checklist + Secret Entry Procedure |
| Parent | PRIVATE-BETA-STAGING-SETUP — Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | ENV VARIABLE PRESENCE CHECKLIST + SECRET ENTRY PROCEDURE — PLANNING ONLY |
| Risk | MEDIUM — planning only; no secrets exposed; no `.env` files created or opened |
| Predecessors | PRIVATE-BETA-STAGING-SETUP-01 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP-02 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP-03 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP-04 — COMPLETE and LOCKED — 2026-07-21 |
| Keith approval | "go" — 2026-07-21 |

---

## 2. Purpose

This document records:

- The complete env variable presence checklist for the AWS Lightsail staging server.
- The safe secret-entry procedure Keith will follow to configure the staging VPS.
- File permission requirements and validation approach.
- Classification of every env variable as required, optional, disabled for staging, or unknown.

**No secret values appear in this document. No `.env` file is created. No environment file is opened or modified. No real secrets are generated.**

---

## 3. Confirmed Staging Decisions

Carried forward from SETUP-01 through SETUP-04 (all COMPLETE and LOCKED — 2026-07-21) unchanged:

| # | Decision | Confirmed Value |
|---|----------|-----------------|
| 1 | Provider | AWS Lightsail |
| 2 | Region | Singapore / ap-southeast-1 |
| 3 | Instance | 8 GB RAM / 2 vCPU / 160 GB SSD |
| 4 | Budget | ~US$40–44/month |
| 5 | Instance name | aisandbox-staging |
| 6 | Static IP planned | aisandbox-staging-ip |
| 7 | Staging domain | staging.ainow.biz |
| 8 | Future production app domain | app.ainow.biz |
| 9 | Root domain (later) | ainow.biz (marketing/landing) |
| 10 | Architecture | Single VPS staging |
| 11 | Reverse proxy / TLS | Caddy |
| 12 | Database | Self-host PostgreSQL 15 on same VPS |
| 13 | Redis | Self-host Redis 7 on same VPS |
| 14 | Process manager | PM2 |
| 15 | Repo path on VPS | /opt/aisandbox |
| 16 | AI Service / Container Manager | Deploy for parity; risky execution disabled by kill switches |
| 17 | Migration execution | Separate explicit approval only |
| 18 | Beta invite | Separate explicit approval only |

---

## 4. What SETUP-05 Covers

| # | Item |
|---|------|
| 1 | Env file placement model on VPS |
| 2 | Root/shared app config variable checklist |
| 3 | Frontend public variable checklist |
| 4 | API Gateway variable checklist |
| 5 | AI Service Worker variable checklist |
| 6 | Container Manager variable checklist |
| 7 | Database variable checklist |
| 8 | Redis variable checklist |
| 9 | Auth/session variable checklist |
| 10 | Google OAuth variable checklist |
| 11 | Billing/payment disabled-state variable checklist |
| 12 | Safety/kill-switch variable checklist |
| 13 | Domain/CORS/cookie variable checklist |
| 14 | Logging/monitoring/support variable checklist |
| 15 | Required/optional/disabled/unknown classification |
| 16 | Placeholder-only source references |
| 17 | Safe secret generation command examples |
| 18 | Safe secret-entry procedure on VPS |
| 19 | File permission plan |
| 20 | Keith manual configuration checklist |
| 21 | What must never be pasted into Cursor/chat |
| 22 | What must not happen yet |
| 23 | Validation approach without exposing values |
| 24 | Handoff to SETUP-06 |
| 25 | PASS / BLOCKED criteria |

---

## 5. What SETUP-05 Does NOT Do

| # | Not Done |
|---|---------|
| 1 | Does NOT create `.env` files |
| 2 | Does NOT open `.env`, `.env.local`, `.env.staging`, `.env.production` |
| 3 | Does NOT open credential, key, certificate, or token files |
| 4 | Does NOT print, request, or generate real secret values |
| 5 | Does NOT install runtime tools |
| 6 | Does NOT clone the repo |
| 7 | Does NOT build or start services |
| 8 | Does NOT create the AWS server or static IP |
| 9 | Does NOT change DNS, TLS, or firewall |
| 10 | Does NOT SSH anywhere |
| 11 | Does NOT deploy services |
| 12 | Does NOT use Docker, PostgreSQL, or Redis |
| 13 | Does NOT execute migrations |
| 14 | Does NOT run tests or builds |
| 15 | Does NOT call APIs or open browsers |
| 16 | Does NOT invite beta users or claim beta launch |
| 17 | Does NOT modify source, test, package, migration, entity, Docker, or deployment files |
| 18 | Does NOT modify TASKS.md, TASKS_BACKLOG_FULL.md, or AINOW-EXECUTION-ROADMAP.md |
| 19 | Does NOT use subagents |
| 20 | Does NOT make git commits or pushes |

---

## 6. Env File Placement Model

### Recommended Staging Model

| Field | Value |
|-------|-------|
| Env file path on VPS | `/opt/aisandbox/.env` |
| File owner | `ubuntu:ubuntu` |
| File permission | `chmod 600` (read/write owner only) |
| Git-tracked | **NO** — must never be committed to git |
| Opened by Cursor | **NEVER** — must never be opened or read by Cursor/AI assistant |
| Pasted into chat | **NEVER** — must never be pasted into chat or AI |
| Values entered by | **Keith only** — via safe VPS-side procedure |
| Shared `.env` for all services | **YES** — single root `.env` at `/opt/aisandbox/.env` |

### Why Single Root `.env`

The root `.env.example` defines variables consumed by all services. The `dotenv` package in each service and the PM2 ecosystem configuration can load from a shared root `.env` file. This is the simplest model for a single-VPS staging deployment.

### Alternative: Per-Service `.env` Files

If services cannot load from root `.env` at runtime (e.g., PM2 CWD or `dotenv` path issues), Keith may create per-service `.env` files:

| Service | Alternative Path |
|---------|-----------------|
| API Gateway | `/opt/aisandbox/services/api-gateway/.env` |
| AI Service | `/opt/aisandbox/services/ai-service/.env` |
| Container Manager | `/opt/aisandbox/services/container-manager/.env` |
| Frontend | `/opt/aisandbox/frontend/.env.local` |

All alternative `.env` files must also be `chmod 600`, owned by `ubuntu:ubuntu`, never committed, and never opened by Cursor.

---

## 7. Root / Shared App Config Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `NODE_ENV` | App config | Required | `.env.example` | Must be `production` on staging | DO NOT DOCUMENT VALUE |
| 2 | `LAUNCH_STATE` | App config | Required | `.env.example` | Must be `INTERNAL` for private beta staging | DO NOT DOCUMENT VALUE |
| 3 | `INTERNAL_SERVICE_KEY` | Service auth (SECRET) | Required — Keith must configure | `.env.example` | Shared secret for service-to-service auth; generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 4 | `APP_BASE_URL` | App config | Required | `.env.example`, api-gateway `.env.example` | Must be `https://staging.ainow.biz` | DO NOT DOCUMENT VALUE |
| 5 | `ABORT_MODE` | Safety | Optional | api-gateway source | Defaults to `NONE`; valid: NONE, EXECUTION_BLOCKED, FULL_SHUTDOWN | DO NOT DOCUMENT VALUE |

---

## 8. Frontend Public Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `NEXT_PUBLIC_PROJECT_FIRST_UX` | Feature flag | Required | Stage-start doc, frontend source | Controls project-first UX flow | DO NOT DOCUMENT VALUE |
| 2 | `NEXT_PUBLIC_SHOW_DEV_TOOLS` | Feature flag | Required | Stage-start doc, frontend source | Must be `false` on staging | DO NOT DOCUMENT VALUE |
| 3 | `API_GATEWAY_URL` | Service URL | Required | Stage-start doc | Server-side SSR URL; `http://localhost:4000` on staging | DO NOT DOCUMENT VALUE |
| 4 | `PORT` | Frontend port | Required | Frontend package.json dev script | Must be `3002` for staging | DO NOT DOCUMENT VALUE |

Note: Frontend has no `.env.example` file. Variables are inferred from source code and prior planning docs.

---

## 9. API Gateway Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `PORT` | Service port | Required | api-gateway `.env.example` | Must be `4000` | DO NOT DOCUMENT VALUE |
| 2 | `NODE_ENV` | App config | Required | `.env.example` | `production` | DO NOT DOCUMENT VALUE |
| 3 | `JWT_SECRET` | Auth (SECRET) | Required — Keith must configure | api-gateway `.env.example` | Generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 4 | `JWT_EXPIRES_IN` | Auth config | Required | `.env.example` | `15m` recommended | DO NOT DOCUMENT VALUE |
| 5 | `JWT_REFRESH_EXPIRES_IN` | Auth config | Required | `.env.example` | `7d` recommended | DO NOT DOCUMENT VALUE |
| 6 | `SESSION_SECRET` | Session (SECRET) | Required — Keith must configure | api-gateway `.env.example`, main.ts | Generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 7 | `OAUTH_STATE_SECRET` | Auth (SECRET) | Required — Keith must configure | api-gateway `.env.example` | Generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 8 | `APP_BASE_URL` | Domain config | Required | api-gateway `.env.example` | `https://staging.ainow.biz` | DO NOT DOCUMENT VALUE |
| 9 | `GOOGLE_CLIENT_ID` | OAuth (SECRET) | Required — Keith must configure | api-gateway `.env.example` | From Google Cloud Console | DO NOT DOCUMENT VALUE |
| 10 | `GOOGLE_CLIENT_SECRET` | OAuth (SECRET) | Required — Keith must configure | api-gateway `.env.example` | From Google Cloud Console | DO NOT DOCUMENT VALUE |
| 11 | `GOOGLE_CALLBACK_URL` | OAuth config | Required | api-gateway `.env.example` | `https://staging.ainow.biz/api/auth/google/callback` | DO NOT DOCUMENT VALUE |
| 12 | `AI_PROVIDER` | AI config | Required | api-gateway `.env.example` | `stub` for staging (no paid AI calls) | DO NOT DOCUMENT VALUE |
| 13 | `ANTHROPIC_API_KEY` | AI provider (SECRET) | Conditional — only if AI_PROVIDER != stub | `.env.example` | Startup validator requires non-empty in production; use placeholder if stub | DO NOT DOCUMENT VALUE |
| 14 | `OPENAI_API_KEY` | AI provider (SECRET) | Conditional — only if AI_PROVIDER != stub | `.env.example` | Startup validator requires non-empty in production; use placeholder if stub | DO NOT DOCUMENT VALUE |
| 15 | `SESSION_TIMEOUT_MINUTES` | Session config | Required | `.env.example` | `120` recommended | DO NOT DOCUMENT VALUE |
| 16 | `MAX_CONCURRENT_SESSIONS` | Session config | Required | `.env.example` | `8` recommended | DO NOT DOCUMENT VALUE |
| 17 | `EMAIL_PROVIDER` | Email config | Required | api-gateway `.env.example` | `stub` for staging (no real emails) | DO NOT DOCUMENT VALUE |
| 18 | `RESEND_API_KEY` | Email (SECRET) | Disabled for staging | api-gateway `.env.example` | Not needed when EMAIL_PROVIDER=stub | DO NOT DOCUMENT VALUE |
| 19 | `AUTH_EMAIL_FROM` | Email config | Disabled for staging | api-gateway `.env.example` | Not needed when EMAIL_PROVIDER=stub | DO NOT DOCUMENT VALUE |
| 20 | `AUTH_EMAIL_REPLY_TO` | Email config | Disabled for staging | api-gateway `.env.example` | Not needed when EMAIL_PROVIDER=stub | DO NOT DOCUMENT VALUE |
| 21 | `LAUNCH_STATE` | App config | Required | `.env.example` | `INTERNAL` | DO NOT DOCUMENT VALUE |
| 22 | `INTERNAL_SERVICE_KEY` | Service auth (SECRET) | Required — Keith must configure | `.env.example` | Must match across all services | DO NOT DOCUMENT VALUE |

### API Gateway — Important Startup Validator Note

The `configuration.validator.ts` in production mode requires:
- `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` to be non-empty even when `AI_PROVIDER=stub`.
- Keith may need to set these to a non-empty placeholder string (NOT a real key) if `AI_PROVIDER=stub` but `NODE_ENV=production`.
- Verify at runtime whether the staging validator accepts empty values for stub mode. If not, set a non-secret placeholder like `not-used-stub-mode`.

---

## 10. AI Service Worker Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `PORT` | Service port | Required | ai-service `.env.example` | Must be `4001` | DO NOT DOCUMENT VALUE |
| 2 | `AI_PROVIDER` | AI config | Required | ai-service `.env.example` | `stub` for staging | DO NOT DOCUMENT VALUE |
| 3 | `API_GATEWAY_URL` | Service URL | Required | ai-service `.env.example` | `http://localhost:4000` | DO NOT DOCUMENT VALUE |
| 4 | `INTERNAL_SERVICE_KEY` | Service auth (SECRET) | Required — Keith must configure | ai-service `.env.example` | Must match api-gateway value | DO NOT DOCUMENT VALUE |
| 5 | `REDIS_URL` | Queue (SECRET) | Required — Keith must configure | ai-service `.env.example` | `redis://:PASSWORD@localhost:6379` | DO NOT DOCUMENT VALUE |
| 6 | `DATABASE_URL` | Database (SECRET) | Required — Keith must configure | ai-service `.env.example` | `postgresql://aisandbox:PASSWORD@localhost:5432/aisandbox` | DO NOT DOCUMENT VALUE |
| 7 | `ANTHROPIC_API_KEY` | AI provider (SECRET) | Conditional | ai-service `.env.example` | Only needed if AI_PROVIDER != stub | DO NOT DOCUMENT VALUE |
| 8 | `OPENAI_API_KEY` | AI provider (SECRET) | Conditional | ai-service `.env.example` | Only needed if AI_PROVIDER != stub | DO NOT DOCUMENT VALUE |
| 9 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | Kill switch | Required | `.env.example` | Must be `false` on staging | DO NOT DOCUMENT VALUE |
| 10 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | Kill switch | Required | ai-service source | Must be `false` on staging | DO NOT DOCUMENT VALUE |
| 11 | `AGENT_HARNESS_STUB_WRITE_MODE` | Debug flag | Required | ai-service source | Must be `false` on staging | DO NOT DOCUMENT VALUE |

---

## 11. Container Manager Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `PORT` | Service port | Required | container-manager `.env.example` | Must be `4002` | DO NOT DOCUMENT VALUE |
| 2 | `API_GATEWAY_URL` | Service URL | Required | container-manager `.env.example` | `http://localhost:4000` | DO NOT DOCUMENT VALUE |
| 3 | `INTERNAL_SERVICE_KEY` | Service auth (SECRET) | Required — Keith must configure | container-manager `.env.example` | Must match api-gateway value | DO NOT DOCUMENT VALUE |
| 4 | `DOCKER_HOST` | Docker config | Required | container-manager `.env.example` | `unix:///var/run/docker.sock` | DO NOT DOCUMENT VALUE |
| 5 | `CONTAINER_CPU_LIMIT` | Resource limit | Required | container-manager `.env.example` | `0.5` | DO NOT DOCUMENT VALUE |
| 6 | `CONTAINER_MEMORY_LIMIT` | Resource limit | Required | container-manager `.env.example` | `1g` | DO NOT DOCUMENT VALUE |
| 7 | `CONTAINER_DISK_LIMIT` | Resource limit | Required | container-manager `.env.example` | `3g` | DO NOT DOCUMENT VALUE |
| 8 | `JWT_SECRET` | Auth (SECRET) | Required — Keith must configure | container-manager `.env.example` | Must match api-gateway value | DO NOT DOCUMENT VALUE |
| 9 | `ENABLE_PREVIEW_ACCESS_CONTROL` | Feature flag | Optional | container-manager `.env.example` | `false` for staging | DO NOT DOCUMENT VALUE |
| 10 | `SESSION_MAX_LIFETIME_MS` | Resource governance | Optional | container-manager `.env.example` | `86400000` (24h) default | DO NOT DOCUMENT VALUE |
| 11 | `SESSION_IDLE_TIMEOUT_MS` | Resource governance | Optional | container-manager `.env.example` | `1800000` (30min) default | DO NOT DOCUMENT VALUE |
| 12 | `CONTAINER_MEMORY_LIMIT_MB` | Resource governance | Optional | container-manager `.env.example` | `512` default | DO NOT DOCUMENT VALUE |
| 13 | `CONTAINER_PIDS_LIMIT` | Resource governance | Optional | container-manager `.env.example` | `256` default | DO NOT DOCUMENT VALUE |
| 14 | `MAX_CONCURRENT_EXECS_PER_SESSION` | Resource governance | Optional | container-manager `.env.example` | `2` default | DO NOT DOCUMENT VALUE |

---

## 12. Database Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `POSTGRES_HOST` | Database | Required | `.env.example`, api-gateway `.env.example` | `localhost` on staging (not Docker hostname) | DO NOT DOCUMENT VALUE |
| 2 | `POSTGRES_PORT` | Database | Required | `.env.example` | `5432` | DO NOT DOCUMENT VALUE |
| 3 | `POSTGRES_USER` | Database | Required | `.env.example` | `aisandbox` | DO NOT DOCUMENT VALUE |
| 4 | `POSTGRES_PASSWORD` | Database (SECRET) | Required — Keith must configure | `.env.example` | Generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 5 | `POSTGRES_DB` | Database | Required | `.env.example` | `aisandbox` | DO NOT DOCUMENT VALUE |
| 6 | `DATABASE_URL` | Database (SECRET) | Required — Keith must configure | `.env.example` | `postgresql://aisandbox:PASSWORD@localhost:5432/aisandbox` | DO NOT DOCUMENT VALUE |

### Database Connection Notes

- PostgreSQL listens on `localhost:5432` only — never exposed to the internet.
- `POSTGRES_HOST` must be `localhost` (not `postgres` Docker hostname used in local dev).
- `DATABASE_URL` must use `localhost` not `postgres`.
- Password must be strong — generated with `openssl rand -hex 32`.
- Database name `aisandbox` and user `aisandbox` match existing local dev config.

---

## 13. Redis Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `REDIS_HOST` | Redis | Required | `.env.example` | `localhost` on staging (not Docker hostname) | DO NOT DOCUMENT VALUE |
| 2 | `REDIS_PORT` | Redis | Required | `.env.example` | `6379` | DO NOT DOCUMENT VALUE |
| 3 | `REDIS_PASSWORD` | Redis (SECRET) | Required — Keith must configure | `.env.example` | Generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 4 | `REDIS_URL` | Redis (SECRET) | Required — Keith must configure | `.env.example` | `redis://:PASSWORD@localhost:6379` | DO NOT DOCUMENT VALUE |

### Redis Connection Notes

- Redis listens on `127.0.0.1:6379` only — never exposed to the internet.
- `REDIS_HOST` must be `localhost` (not `redis` Docker hostname used in local dev).
- `REDIS_URL` must use `localhost` not `redis`.
- Password required — `requirepass` set in `redis.conf` on VPS.

---

## 14. Auth / Session Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `JWT_SECRET` | Auth (SECRET) | Required — Keith must configure | api-gateway `.env.example`, container-manager `.env.example` | Must be same across API Gateway and Container Manager; generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 2 | `SESSION_SECRET` | Session (SECRET) | Required — Keith must configure | api-gateway `.env.example`, api-gateway `main.ts` | Used by cookie-session middleware; generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 3 | `OAUTH_STATE_SECRET` | OAuth (SECRET) | Required — Keith must configure | api-gateway `.env.example` | Anti-CSRF for OAuth flow; generate with `openssl rand -hex 32` | DO NOT DOCUMENT VALUE |
| 4 | `SESSION_TIMEOUT_MINUTES` | Session config | Required | `.env.example` | `120` recommended | DO NOT DOCUMENT VALUE |
| 5 | `MAX_CONCURRENT_SESSIONS` | Session config | Required | `.env.example` | `8` recommended | DO NOT DOCUMENT VALUE |

---

## 15. Google OAuth Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `GOOGLE_CLIENT_ID` | OAuth (SECRET) | Required — Keith must configure | api-gateway `.env.example` | Created by Keith in Google Cloud Console | DO NOT DOCUMENT VALUE |
| 2 | `GOOGLE_CLIENT_SECRET` | OAuth (SECRET) | Required — Keith must configure | api-gateway `.env.example` | Created by Keith in Google Cloud Console | DO NOT DOCUMENT VALUE |
| 3 | `GOOGLE_CALLBACK_URL` | OAuth config | Required | api-gateway `.env.example` | `https://staging.ainow.biz/api/auth/google/callback` | DO NOT DOCUMENT VALUE |

### Google OAuth Configuration Notes

- Keith must create a Google Cloud project or use an existing one.
- In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.
- Application type: Web application.
- Authorized redirect URI: `https://staging.ainow.biz/api/auth/google/callback`.
- Do NOT add `http://localhost:*` redirect URIs to the staging/production OAuth client.
- Keep staging and development OAuth clients separate.

### Apple OAuth Variables (Deferred)

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `APPLE_CLIENT_ID` | OAuth | Disabled for staging | api-gateway `.env.example` | Not required for initial private beta | DO NOT DOCUMENT VALUE |
| 2 | `APPLE_TEAM_ID` | OAuth | Disabled for staging | api-gateway `.env.example` | Not required for initial private beta | DO NOT DOCUMENT VALUE |
| 3 | `APPLE_KEY_ID` | OAuth | Disabled for staging | api-gateway `.env.example` | Not required for initial private beta | DO NOT DOCUMENT VALUE |
| 4 | `APPLE_PRIVATE_KEY` | OAuth (SECRET) | Disabled for staging | api-gateway `.env.example` | Not required for initial private beta | DO NOT DOCUMENT VALUE |
| 5 | `APPLE_CALLBACK_URL` | OAuth | Disabled for staging | api-gateway `.env.example` | Not required for initial private beta | DO NOT DOCUMENT VALUE |

Apple OAuth is not required for the initial private beta. Omit these variables from the staging `.env` file unless Keith explicitly decides to enable Apple sign-in.

---

## 16. Billing / Payment Disabled-State Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `BILLING_CHARGES_ENABLED` | Kill switch | Required | `.env.example` | **MUST be `false`** — billing is disabled for staging | DO NOT DOCUMENT VALUE |

### Billing Safety Notes

- `BILLING_CHARGES_ENABLED=false` is the critical financial kill switch.
- When `false`: NO payment execution possible, NO Stripe charges, ChargeReadinessService gate blocks all charging paths.
- No Stripe API keys, webhook secrets, or payment provider variables are needed for staging.
- No Stripe-related variables should be configured until billing is explicitly approved for production.

---

## 17. Safety / Kill-Switch Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `GLOBAL_EXECUTION_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** — disables all AI execution dispatch | DO NOT DOCUMENT VALUE |
| 2 | `PROVIDER_OPENAI_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** for staging | DO NOT DOCUMENT VALUE |
| 3 | `PROVIDER_ANTHROPIC_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** for staging | DO NOT DOCUMENT VALUE |
| 4 | `PROVIDER_GROQ_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** for staging | DO NOT DOCUMENT VALUE |
| 5 | `PROVIDER_XAI_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** for staging | DO NOT DOCUMENT VALUE |
| 6 | `PROVIDER_DEEPSEEK_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** for staging | DO NOT DOCUMENT VALUE |
| 7 | `BILLING_SNAPSHOT_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** for staging | DO NOT DOCUMENT VALUE |
| 8 | `PAYMENT_EXECUTION_ENABLED` | Kill switch | Required | api-gateway `kill-switch.config.ts` | **Must be `false`** for staging | DO NOT DOCUMENT VALUE |
| 9 | `MAX_TOKENS_PER_EXECUTION` | Safety limit | Required | api-gateway `global-safety-limits.config.ts` | `100000` default; conservative for staging | DO NOT DOCUMENT VALUE |
| 10 | `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | Safety limit | Required | api-gateway `global-safety-limits.config.ts` | `10000` default; keep default for staging | DO NOT DOCUMENT VALUE |
| 11 | `MAX_DAILY_SPEND_SOFT_USD` | Safety limit | Required | api-gateway `global-safety-limits.config.ts` | Must be < `MAX_DAILY_SPEND_HARD_USD`; default `10000` | DO NOT DOCUMENT VALUE |
| 12 | `MAX_DAILY_SPEND_HARD_USD` | Safety limit | Required | api-gateway `global-safety-limits.config.ts` | Must be > `MAX_DAILY_SPEND_SOFT_USD`; default `20000` | DO NOT DOCUMENT VALUE |
| 13 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | Kill switch | Required | `.env.example`, ai-service source | **Must be `false`** — disables tool loop entirely | DO NOT DOCUMENT VALUE |
| 14 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | Kill switch | Required | ai-service source | **Must be `false`** — disables write tools | DO NOT DOCUMENT VALUE |
| 15 | `AGENT_HARNESS_STUB_WRITE_MODE` | Debug flag | Required | ai-service source | **Must be `false`** on staging | DO NOT DOCUMENT VALUE |
| 16 | `BILLING_CHARGES_ENABLED` | Kill switch | Required | `.env.example` | **Must be `false`** (also in Section 16) | DO NOT DOCUMENT VALUE |

### Kill-Switch Staging Defaults Summary

All AI execution, tool loop, write tools, billing, and payment paths are **disabled by default** on staging. This ensures the staging environment cannot accidentally:
- Execute paid AI provider calls.
- Write to sandbox workspaces via agent tools.
- Process billing or payment operations.
- Dispatch execution to any AI provider.

---

## 18. Domain / CORS / Cookie Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `APP_BASE_URL` | Domain | Required | api-gateway `.env.example` | `https://staging.ainow.biz` — controls CORS allowed origins and auth base URL | DO NOT DOCUMENT VALUE |
| 2 | `GOOGLE_CALLBACK_URL` | OAuth/Domain | Required | api-gateway `.env.example` | `https://staging.ainow.biz/api/auth/google/callback` | DO NOT DOCUMENT VALUE |

### Domain / CORS / Cookie Rules for Staging

| # | Rule |
|---|------|
| 1 | `APP_BASE_URL` must be `https://staging.ainow.biz` (not localhost) |
| 2 | CORS allowed origin is `https://staging.ainow.biz` |
| 3 | No `localhost` origins in staging CORS |
| 4 | No wildcard CORS (`*`) with credentials |
| 5 | Cookie `Domain` attribute: omit entirely OR set to `staging.ainow.biz` exactly |
| 6 | Cookie `Domain` must NOT be `.ainow.biz` (would leak cookies to other subdomains) |
| 7 | Cookie `Secure` flag: `true` (HTTPS only via Caddy) |
| 8 | Cookie `HttpOnly` flag: `true` for session cookies |
| 9 | Cookie `SameSite`: `Lax` or `Strict` |
| 10 | `app.ainow.biz` is future production only — referenced here for awareness, not configured |
| 11 | `ainow.biz` root is future marketing/landing only — not configured |
| 12 | SSR internal API calls may use `http://localhost:4000` (stays on VPS) |

---

## 19. Logging / Monitoring / Support Variables

| # | Variable | Category | Required Status | Source | Notes | Value |
|---|----------|----------|-----------------|--------|-------|-------|
| 1 | `LOG_LEVEL` | Logging | Optional | Inferred — standard NestJS pattern | If present, use `info` or `warn` for staging; no code reference found requiring it | DO NOT DOCUMENT VALUE |

### Logging Notes

- PM2 manages log output for all Node.js services (`~/.pm2/logs/`).
- PM2 log rotation via `pm2-logrotate` plugin (max 50 MB, 7 retained files).
- System services (PostgreSQL, Redis, Caddy) log via `journalctl`.
- No external log aggregation service required for initial private beta.
- Future: consider UptimeRobot or similar free uptime ping.

---

## 20. Required / Optional / Disabled / Unknown Classification

### Required (Must be set for staging to function)

| Variable | Service |
|----------|---------|
| `NODE_ENV` | All |
| `LAUNCH_STATE` | API Gateway |
| `INTERNAL_SERVICE_KEY` | All services |
| `APP_BASE_URL` | API Gateway |
| `PORT` (per service) | All services |
| `JWT_SECRET` | API Gateway, Container Manager |
| `SESSION_SECRET` | API Gateway |
| `OAUTH_STATE_SECRET` | API Gateway |
| `GOOGLE_CLIENT_ID` | API Gateway |
| `GOOGLE_CLIENT_SECRET` | API Gateway |
| `GOOGLE_CALLBACK_URL` | API Gateway |
| `AI_PROVIDER` | API Gateway, AI Service |
| `JWT_EXPIRES_IN` | API Gateway |
| `JWT_REFRESH_EXPIRES_IN` | API Gateway |
| `SESSION_TIMEOUT_MINUTES` | API Gateway |
| `MAX_CONCURRENT_SESSIONS` | API Gateway |
| `EMAIL_PROVIDER` | API Gateway |
| `POSTGRES_HOST` | API Gateway |
| `POSTGRES_PORT` | API Gateway |
| `POSTGRES_USER` | API Gateway |
| `POSTGRES_PASSWORD` | API Gateway |
| `POSTGRES_DB` | API Gateway |
| `DATABASE_URL` | API Gateway, AI Service |
| `REDIS_HOST` | API Gateway |
| `REDIS_PORT` | API Gateway |
| `REDIS_PASSWORD` | API Gateway |
| `REDIS_URL` | API Gateway, AI Service |
| `API_GATEWAY_URL` | AI Service, Container Manager, Frontend (SSR) |
| `DOCKER_HOST` | Container Manager |
| `CONTAINER_CPU_LIMIT` | Container Manager |
| `CONTAINER_MEMORY_LIMIT` | Container Manager |
| `CONTAINER_DISK_LIMIT` | Container Manager |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | Frontend |
| `NEXT_PUBLIC_PROJECT_FIRST_UX` | Frontend |

### Required — Kill Switches (Must be explicitly set to `false`)

| Variable | Service |
|----------|---------|
| `GLOBAL_EXECUTION_ENABLED` | API Gateway |
| `PROVIDER_OPENAI_ENABLED` | API Gateway |
| `PROVIDER_ANTHROPIC_ENABLED` | API Gateway |
| `PROVIDER_GROQ_ENABLED` | API Gateway |
| `PROVIDER_XAI_ENABLED` | API Gateway |
| `PROVIDER_DEEPSEEK_ENABLED` | API Gateway |
| `BILLING_SNAPSHOT_ENABLED` | API Gateway |
| `PAYMENT_EXECUTION_ENABLED` | API Gateway |
| `BILLING_CHARGES_ENABLED` | API Gateway |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | AI Service |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | AI Service |
| `AGENT_HARNESS_STUB_WRITE_MODE` | AI Service |

### Required — Safety Limits (Set to defaults)

| Variable | Service |
|----------|---------|
| `MAX_TOKENS_PER_EXECUTION` | API Gateway |
| `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | API Gateway |
| `MAX_DAILY_SPEND_SOFT_USD` | API Gateway |
| `MAX_DAILY_SPEND_HARD_USD` | API Gateway |

### Optional (Defaults exist; set only if overriding)

| Variable | Service | Default |
|----------|---------|---------|
| `ABORT_MODE` | API Gateway | `NONE` |
| `LOG_LEVEL` | All | Service default |
| `ENABLE_PREVIEW_ACCESS_CONTROL` | Container Manager | `false` |
| `SESSION_MAX_LIFETIME_MS` | Container Manager | `86400000` |
| `SESSION_IDLE_TIMEOUT_MS` | Container Manager | `1800000` |
| `CONTAINER_MEMORY_LIMIT_MB` | Container Manager | `512` |
| `CONTAINER_PIDS_LIMIT` | Container Manager | `256` |
| `MAX_CONCURRENT_EXECS_PER_SESSION` | Container Manager | `2` |

### Disabled for Staging (Omit or set placeholder)

| Variable | Reason |
|----------|--------|
| `APPLE_CLIENT_ID` | Apple OAuth not enabled for initial beta |
| `APPLE_TEAM_ID` | Apple OAuth not enabled for initial beta |
| `APPLE_KEY_ID` | Apple OAuth not enabled for initial beta |
| `APPLE_PRIVATE_KEY` | Apple OAuth not enabled for initial beta |
| `APPLE_CALLBACK_URL` | Apple OAuth not enabled for initial beta |
| `RESEND_API_KEY` | EMAIL_PROVIDER=stub; no real emails |
| `AUTH_EMAIL_FROM` | EMAIL_PROVIDER=stub; no real emails |
| `AUTH_EMAIL_REPLY_TO` | EMAIL_PROVIDER=stub; no real emails |
| `GROQ_API_KEY` | AI_PROVIDER=stub; provider disabled |
| `XAI_API_KEY` | AI_PROVIDER=stub; provider disabled |
| `DEEPSEEK_API_KEY` | AI_PROVIDER=stub; provider disabled |

### Conditional / Verify Later

| Variable | Condition |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Production validator may require non-empty even with stub; verify at runtime |
| `OPENAI_API_KEY` | Production validator may require non-empty even with stub; verify at runtime |

---

## 21. Placeholder-Only Source References

| # | Source File | Type | Contains Only Placeholders |
|---|------------|------|---------------------------|
| 1 | `.env.example` (root) | Root env template | YES — dev placeholder values only |
| 2 | `services/api-gateway/.env.example` | API Gateway template | YES — dev placeholder values only |
| 3 | `services/ai-service/.env.example` | AI Service template | YES — dev placeholder values only |
| 4 | `services/container-manager/.env.example` | Container Manager template | YES — dev placeholder values only |
| 5 | No `frontend/.env.example` exists | — | N/A |
| 6 | No `.env.staging.example` exists | — | N/A |

All `.env.example` files contain development placeholders only. None contain real production/staging secrets.

---

## 22. Safe Secret Generation Commands

**These commands are for future VPS-side execution by Keith only. Do NOT run these in Cursor, local dev, or chat.**

```bash
# Keith runs these on the Lightsail VPS — values stay on the server only

# JWT_SECRET — 32 bytes hex
openssl rand -hex 32

# SESSION_SECRET — 32 bytes hex
openssl rand -hex 32

# OAUTH_STATE_SECRET — 32 bytes hex
openssl rand -hex 32

# INTERNAL_SERVICE_KEY — 32 bytes hex (must be same in all services)
openssl rand -hex 32

# POSTGRES_PASSWORD — 32 bytes hex
openssl rand -hex 32

# REDIS_PASSWORD — 32 bytes hex
openssl rand -hex 32
```

### Secret Generation Rules

| # | Rule |
|---|------|
| 1 | Generate each secret independently — do NOT reuse secrets across different variables |
| 2 | `INTERNAL_SERVICE_KEY` must be the SAME value in all services (api-gateway, ai-service, container-manager) |
| 3 | `JWT_SECRET` must be the SAME value in api-gateway and container-manager |
| 4 | All other secrets must be unique to each variable |
| 5 | Generated values stay on the VPS — never copied to local machine, Cursor, or chat |
| 6 | If regeneration is needed, update all services and restart |

---

## 23. Safe Secret-Entry Procedure on VPS

**This procedure is for future execution by Keith only. Do NOT execute in this step.**

### Procedure

| Step | Action | Command / Note |
|------|--------|----------------|
| 1 | Keith SSHs into the VPS | Lightsail browser SSH or local SSH key |
| 2 | Navigate to repo root | `cd /opt/aisandbox` |
| 3 | Create `.env` file | `nano /opt/aisandbox/.env` (or `vim`) |
| 4 | Enter all variables with real values | Keith types values directly; uses `openssl rand -hex 32` for secrets in a separate terminal |
| 5 | Save and close the editor | Ctrl+O, Enter, Ctrl+X (nano) or `:wq` (vim) |
| 6 | Set file permissions | `chmod 600 /opt/aisandbox/.env` |
| 7 | Verify ownership | `ls -la /opt/aisandbox/.env` — must show `ubuntu ubuntu` and `-rw-------` |
| 8 | Verify file is NOT in git | `cd /opt/aisandbox && git status` — `.env` must NOT appear in tracked files |
| 9 | Cursor/chat never receives values | Keith does NOT paste env values into any AI tool |
| 10 | Validate variable presence only | Run presence-check script (Section 28) — prints only variable names, never values |

### Critical Safety Rules for Secret Entry

| # | Rule |
|---|------|
| 1 | Keith is the ONLY person who enters secrets on the VPS |
| 2 | Values are typed directly on the VPS — never pasted from chat/Cursor |
| 3 | Terminal history may contain generated secrets — Keith should `history -c` after if concerned |
| 4 | The `.env` file must NEVER be `cat`-ed, `echo`-ed, or printed in a context that could be captured by chat/AI |
| 5 | If Keith suspects a secret may have been exposed, STOP and rotate immediately |
| 6 | Each staging/production environment uses unique secrets — never reuse local dev values |

---

## 24. File Permission Plan

| File | Path on VPS | Owner | Permissions | Notes |
|------|-------------|-------|-------------|-------|
| Root `.env` | `/opt/aisandbox/.env` | `ubuntu:ubuntu` | `chmod 600` (`-rw-------`) | Only owner can read/write |
| Per-service `.env` (if used) | `/opt/aisandbox/services/<service>/.env` | `ubuntu:ubuntu` | `chmod 600` | Only owner can read/write |
| Frontend `.env.local` (if used) | `/opt/aisandbox/frontend/.env.local` | `ubuntu:ubuntu` | `chmod 600` | Only owner can read/write |

### Permission Verification Commands (Future Only — Not Executed Now)

```bash
# Keith runs on VPS to verify permissions
ls -la /opt/aisandbox/.env
# Expected output: -rw------- 1 ubuntu ubuntu <size> <date> .env

# Verify no other users can read
stat -c '%a %U:%G' /opt/aisandbox/.env
# Expected output: 600 ubuntu:ubuntu
```

---

## 25. Keith Manual Configuration Checklist

Keith must perform these actions on the VPS during future execution steps:

| # | Action | Depends On | SETUP Task |
|---|--------|-----------|-----------|
| 1 | Generate `JWT_SECRET` on VPS | VPS exists and SSH access works | SETUP-05 execution |
| 2 | Generate `SESSION_SECRET` on VPS | VPS exists | SETUP-05 execution |
| 3 | Generate `OAUTH_STATE_SECRET` on VPS | VPS exists | SETUP-05 execution |
| 4 | Generate `INTERNAL_SERVICE_KEY` on VPS | VPS exists | SETUP-05 execution |
| 5 | Generate `POSTGRES_PASSWORD` on VPS | VPS exists | SETUP-06 |
| 6 | Generate `REDIS_PASSWORD` on VPS | VPS exists | SETUP-06 |
| 7 | Create Google OAuth credentials in Google Cloud Console | Google Cloud access | SETUP-05 execution |
| 8 | Set authorized redirect URI to `https://staging.ainow.biz/api/auth/google/callback` | Google Cloud Console | SETUP-05 execution |
| 9 | Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud Console to VPS `.env` | OAuth credentials created | SETUP-05 execution |
| 10 | Create `/opt/aisandbox/.env` file on VPS | VPS + repo cloned | SETUP-05 execution |
| 11 | Enter all variable values into `.env` | All secrets generated, OAuth created | SETUP-05 execution |
| 12 | Set `chmod 600 /opt/aisandbox/.env` | `.env` created | SETUP-05 execution |
| 13 | Verify file permissions and ownership | After chmod | SETUP-05 execution |
| 14 | Run presence-check validation | After all values entered | SETUP-05 execution |
| 15 | Decide `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` handling for stub mode | Startup validator behavior | SETUP-05 execution |

---

## 26. What Must Never Be Pasted Into Cursor / Chat

| # | Never Paste |
|---|-------------|
| 1 | Real `JWT_SECRET` value |
| 2 | Real `SESSION_SECRET` value |
| 3 | Real `OAUTH_STATE_SECRET` value |
| 4 | Real `INTERNAL_SERVICE_KEY` value |
| 5 | Real `POSTGRES_PASSWORD` value |
| 6 | Real `REDIS_PASSWORD` value |
| 7 | Real `GOOGLE_CLIENT_ID` value |
| 8 | Real `GOOGLE_CLIENT_SECRET` value |
| 9 | Real `ANTHROPIC_API_KEY` value |
| 10 | Real `OPENAI_API_KEY` value |
| 11 | Real `RESEND_API_KEY` value |
| 12 | Real `DATABASE_URL` with password |
| 13 | Real `REDIS_URL` with password |
| 14 | Any `.env` file contents from the VPS |
| 15 | Any API key, token, certificate, or private key |
| 16 | SSH private key content |
| 17 | AWS account credentials |
| 18 | Google Cloud service account keys |
| 19 | Any secret rotated after potential exposure |
| 20 | Output of `openssl rand` commands with real generated values |

**If a secret may have been exposed to Cursor/chat, STOP and rotate the secret immediately.**

---

## 27. What Must Not Happen Yet

| # | Must Not Happen |
|---|-----------------|
| 1 | `.env` file creation on VPS (requires VPS to exist — SETUP-01/02 execution) |
| 2 | Secret generation on VPS (requires SSH access — SETUP-02 execution) |
| 3 | Google OAuth credential creation (requires domain and app deployment — SETUP-03/07) |
| 4 | PostgreSQL password configuration (requires PostgreSQL installed — SETUP-06) |
| 5 | Redis password configuration (requires Redis installed — SETUP-06) |
| 6 | Service startup with real env values (requires SETUP-07) |
| 7 | Migration execution (requires separate explicit approval) |
| 8 | Beta user invitation (requires separate explicit approval) |
| 9 | Enabling any kill switch to `true` (requires explicit approval per switch) |
| 10 | Setting `BILLING_CHARGES_ENABLED=true` (requires full billing readiness) |
| 11 | Setting `AI_PROVIDER` to a real provider (requires API key + explicit approval) |
| 12 | Any DNS, TLS, or domain changes (covered by SETUP-03) |
| 13 | Any deployment (covered by SETUP-07) |

---

## 28. Validation Approach Without Exposing Values

### Presence-Only Validation Script (Future — Not Executed Now)

Keith can use this script on the VPS to verify all required variables are present without printing values:

```bash
#!/usr/bin/env bash
# validate-env-presence.sh — checks variable names exist, never prints values
# Keith runs this on VPS after creating .env

set -euo pipefail

ENV_FILE="/opt/aisandbox/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: $ENV_FILE does not exist"
  exit 1
fi

REQUIRED_VARS=(
  NODE_ENV
  LAUNCH_STATE
  INTERNAL_SERVICE_KEY
  APP_BASE_URL
  PORT
  JWT_SECRET
  JWT_EXPIRES_IN
  JWT_REFRESH_EXPIRES_IN
  SESSION_SECRET
  OAUTH_STATE_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_CALLBACK_URL
  AI_PROVIDER
  SESSION_TIMEOUT_MINUTES
  MAX_CONCURRENT_SESSIONS
  EMAIL_PROVIDER
  POSTGRES_HOST
  POSTGRES_PORT
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  DATABASE_URL
  REDIS_HOST
  REDIS_PORT
  REDIS_PASSWORD
  REDIS_URL
  API_GATEWAY_URL
  DOCKER_HOST
  CONTAINER_CPU_LIMIT
  CONTAINER_MEMORY_LIMIT
  CONTAINER_DISK_LIMIT
  GLOBAL_EXECUTION_ENABLED
  PROVIDER_OPENAI_ENABLED
  PROVIDER_ANTHROPIC_ENABLED
  PROVIDER_GROQ_ENABLED
  PROVIDER_XAI_ENABLED
  PROVIDER_DEEPSEEK_ENABLED
  BILLING_SNAPSHOT_ENABLED
  PAYMENT_EXECUTION_ENABLED
  BILLING_CHARGES_ENABLED
  MAX_TOKENS_PER_EXECUTION
  MAX_EXECUTIONS_PER_MINUTE_GLOBAL
  MAX_DAILY_SPEND_SOFT_USD
  MAX_DAILY_SPEND_HARD_USD
  AGENT_HARNESS_ENABLE_TOOL_LOOP
  AGENT_HARNESS_ENABLE_WRITE_TOOLS
  AGENT_HARNESS_STUB_WRITE_MODE
  NEXT_PUBLIC_SHOW_DEV_TOOLS
  NEXT_PUBLIC_PROJECT_FIRST_UX
)

MISSING=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${VAR}=" "$ENV_FILE"; then
    echo "MISSING: $VAR"
    MISSING=$((MISSING + 1))
  else
    echo "PRESENT: $VAR"
  fi
done

echo ""
if [ "$MISSING" -eq 0 ]; then
  echo "PASS: All $((${#REQUIRED_VARS[@]})) required variables present."
else
  echo "FAIL: $MISSING required variable(s) missing."
  exit 1
fi
```

### Validation Rules

| # | Rule |
|---|------|
| 1 | Script prints only `PRESENT:` or `MISSING:` followed by the variable NAME |
| 2 | Script NEVER prints variable VALUES |
| 3 | Script NEVER uses `echo $VAR_VALUE` or `grep -o` with value capture |
| 4 | Script checks only whether the line `VARNAME=` exists in the file |
| 5 | Script output is safe to paste into chat (only names, no values) |
| 6 | If any required variable is MISSING, the script exits with code 1 |

### File Permission Validation (Future Only)

```bash
# Verify .env file permissions — safe to paste output into chat
stat -c '%a %U:%G %n' /opt/aisandbox/.env
# Expected: 600 ubuntu:ubuntu /opt/aisandbox/.env
```

---

## 29. Handoff to SETUP-06

| Field | Value |
|-------|-------|
| Next child task | PRIVATE-BETA-STAGING-SETUP-06 |
| Title | Database / Redis Setup Plan |
| Expected scope | Plan PostgreSQL 15 installation, database/user creation, `pg_hba.conf` configuration, Redis 7 installation, `requirepass` configuration, localhost binding verification, connectivity testing |
| Prerequisites | SETUP-05 COMPLETE (this checklist confirms env variable requirements for DB/Redis) |
| Registration | Keith must explicitly approve SETUP-06 registration |

**SETUP-06 is NOT registered in this step.**

---

## 30. PASS / BLOCKED Criteria

### PASS Criteria

Step 2 PASSES if this checklist clearly records:

- [x] Env file placement model (`/opt/aisandbox/.env`, `chmod 600`, `ubuntu:ubuntu`)
- [x] All variable groups (root, frontend, API Gateway, AI Service, Container Manager, database, Redis, auth/session, Google OAuth, billing, kill switches, domain/CORS/cookie, logging)
- [x] Required / optional / disabled / unknown classifications
- [x] No values documented (every value column says "DO NOT DOCUMENT VALUE")
- [x] Safe secret generation examples (commands only — not executed)
- [x] Safe secret-entry procedure (documented for Keith's future use)
- [x] File permission plan (`chmod 600`, ownership verification)
- [x] Keith manual configuration checklist
- [x] What must never be pasted into Cursor/chat
- [x] Validation approach without exposing values (presence-check script)
- [x] Handoff to SETUP-06
- [x] No env file opened, created, or edited

### BLOCKED Criteria

Step 2 would be BLOCKED if:

| # | Block Condition | Status |
|---|----------------|--------|
| 1 | Required env templates missing and variable set cannot be derived | NOT BLOCKED — all 4 `.env.example` files exist and were read |
| 2 | Real env files would need to be opened | NOT BLOCKED — only `.env.example` (placeholder) files read |
| 3 | Secret values are needed | NOT BLOCKED — no values documented |
| 4 | Package/docs disagree preventing safe checklist | NOT BLOCKED — consistent across sources |
| 5 | Required auth/domain variables cannot be identified | NOT BLOCKED — all identified |
| 6 | Safety/kill-switch variables cannot be identified | NOT BLOCKED — all identified from source |
| 7 | Validation would expose values | NOT BLOCKED — presence-only validation designed |

**Verdict: PASS — No blockers identified.**

---

## 31. Safety Boundaries

| # | Safety Boundary | Preserved |
|---|----------------|-----------|
| 1 | No `.env` file created | YES |
| 2 | No `.env` file opened (only `.env.example` read) | YES |
| 3 | No `.env.local`, `.env.staging`, `.env.production` opened | YES |
| 4 | No credential, key, certificate, or token file opened | YES |
| 5 | No secret values printed, requested, or generated | YES |
| 6 | No implementation | YES |
| 7 | No source code changes | YES |
| 8 | No test file changes | YES |
| 9 | No package file changes | YES |
| 10 | No migration, entity, or schema file changes | YES |
| 11 | No environment file changes | YES |
| 12 | No Docker file changes | YES |
| 13 | No deployment file changes | YES |
| 14 | No runtime tools installed | YES |
| 15 | No repo cloned | YES |
| 16 | No services built or started | YES |
| 17 | No AWS server/static IP created | YES |
| 18 | No DNS/TLS/firewall changed | YES |
| 19 | No SSH occurred | YES |
| 20 | No deployment | YES |
| 21 | No Docker/PostgreSQL/Redis used | YES |
| 22 | No migrations executed | YES |
| 23 | No tests or builds run | YES |
| 24 | No APIs called | YES |
| 25 | No browser opened | YES |
| 26 | No beta users invited | YES |
| 27 | No beta launch claimed | YES |
| 28 | No subagents used | YES |
| 29 | No git commit or push | YES |
| 30 | No TASKS.md / TASKS_BACKLOG_FULL.md / AINOW-EXECUTION-ROADMAP.md modified | YES |

---

## 32. Exact Next Action

**Keith reviews this checklist and confirms completeness.**

After Keith approval, the next steps are:

1. Step 3 — Consolidation / checkpoint for SETUP-05 (update governance files).
2. Register PRIVATE-BETA-STAGING-SETUP-06 — Database / Redis Setup Plan.

SETUP-06 registration requires Keith explicit approval.

No implementation. No deployment. No runtime. No SSH. No Docker. No PostgreSQL. No Redis. No migration. No secrets. No subagents.

---

**Document created:** 2026-07-21
**Step 2 status:** CREATED
**Step 2 verdict:** PASS — all criteria met — no blockers identified.
**No env file created, opened, or edited.**
**No secret values printed, requested, or generated.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.**
**No git commit or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
