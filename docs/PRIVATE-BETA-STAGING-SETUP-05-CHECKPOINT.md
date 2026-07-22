# PRIVATE-BETA-STAGING-SETUP-05 — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP-05
**Title:** Env Variable Presence Checklist + Secret Entry Procedure
**Step:** 3 — Consolidation / Handoff to SETUP-06
**Status:** COMPLETE and LOCKED — 2026-07-21
**Date:** 2026-07-21

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
| Keith Approval | "go" — 2026-07-21 |
| Registered | 2026-07-21 |
| Completed | 2026-07-21 |

---

## 2. Final Status

**PRIVATE-BETA-STAGING-SETUP-05: COMPLETE and LOCKED — 2026-07-21**

All 3 steps complete:

1. **Registration** — COMPLETE (2026-07-21) — Keith explicit approval recorded ("go"); scope, safety boundaries, non-goals, and recommended defaults documented.
2. **Env Variable Presence Checklist + Secret Entry Procedure** — COMPLETE (2026-07-21) — `docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md` — Step 2 verdict: PASS — No env file opened/created/edited — No secrets printed/requested/generated.
3. **Consolidation / Handoff to SETUP-06** — COMPLETE (2026-07-21) — This document.

---

## 3. Parent Task Status

**PRIVATE-BETA-STAGING-SETUP** remains ACTIVE.

- Steps 1–2 COMPLETE.
- Step 3 IN PROGRESS — executing via 8 child tasks (SETUP-01 through SETUP-08).
  - SETUP-01 COMPLETE and LOCKED — 2026-07-21
  - SETUP-02 COMPLETE and LOCKED — 2026-07-21
  - SETUP-03 COMPLETE and LOCKED — 2026-07-21
  - SETUP-04 COMPLETE and LOCKED — 2026-07-21
  - SETUP-05 COMPLETE and LOCKED — 2026-07-21 (this task)
  - SETUP-06 through SETUP-08 PENDING registration.
- Step 4 (Consolidation / handoff back to deployment readiness verification) PENDING.

Parent Step 3 continues through remaining child tasks (SETUP-06 through SETUP-08).

---

## 4. Why This Child Task Existed

PRIVATE-BETA-STAGING-SETUP-04 documented the full runtime and container deployment plan but explicitly deferred all env variable and secrets procedure work to SETUP-05. Before any staging server can be started, all required env variables must be identified, classified, and a safe secret-entry procedure must be defined. SETUP-05 produced that checklist and procedure document, covering all services, with strict safety boundaries.

---

## 5. Env Checklist Path

`docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md`

Created 2026-07-21. Step 2 verdict: PASS. No env file opened, created, or edited. No secret values printed, requested, or generated.

---

## 6. Env File Placement Model

| Field | Value |
|-------|-------|
| Env file path on VPS | `/opt/aisandbox/.env` |
| File owner | `ubuntu:ubuntu` |
| File permission | `chmod 600` (`-rw-------`) |
| Git-tracked | **NO** — must never be committed to git |
| Opened by Cursor | **NEVER** |
| Pasted into chat | **NEVER** |
| Values entered by | **Keith only** — via safe VPS-side procedure |
| Shared `.env` for all services | **YES** — single root `.env` at `/opt/aisandbox/.env` |

**Alternative:** If services cannot load from root `.env` (PM2 CWD or dotenv path issues), per-service files at:
- `/opt/aisandbox/services/api-gateway/.env`
- `/opt/aisandbox/services/ai-service/.env`
- `/opt/aisandbox/services/container-manager/.env`
- `/opt/aisandbox/frontend/.env.local`

All alternative files: `chmod 600`, `ubuntu:ubuntu`, never committed, never opened by Cursor.

---

## 7. Root / Shared Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `NODE_ENV` | Required (`production` on staging) |
| 2 | `LAUNCH_STATE` | Required (`INTERNAL` for private beta) |
| 3 | `INTERNAL_SERVICE_KEY` | Required — Keith must configure |
| 4 | `APP_BASE_URL` | Required (`https://staging.ainow.biz`) |
| 5 | `ABORT_MODE` | Optional (defaults `NONE`) |

---

## 8. Frontend Public Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `NEXT_PUBLIC_PROJECT_FIRST_UX` | Required |
| 2 | `NEXT_PUBLIC_SHOW_DEV_TOOLS` | Required (`false` on staging) |
| 3 | `API_GATEWAY_URL` | Required (`http://localhost:4000` on staging) |
| 4 | `PORT` | Required (`3002` for staging) |

Note: Frontend has no `.env.example` file. Variables inferred from source code and prior planning docs.

---

## 9. API Gateway Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `PORT` | Required (`4000`) |
| 2 | `NODE_ENV` | Required (`production`) |
| 3 | `JWT_SECRET` | Required — Keith must configure |
| 4 | `JWT_EXPIRES_IN` | Required (`15m`) |
| 5 | `JWT_REFRESH_EXPIRES_IN` | Required (`7d`) |
| 6 | `SESSION_SECRET` | Required — Keith must configure |
| 7 | `OAUTH_STATE_SECRET` | Required — Keith must configure |
| 8 | `APP_BASE_URL` | Required (`https://staging.ainow.biz`) |
| 9 | `GOOGLE_CLIENT_ID` | Required — Keith must configure |
| 10 | `GOOGLE_CLIENT_SECRET` | Required — Keith must configure |
| 11 | `GOOGLE_CALLBACK_URL` | Required (`https://staging.ainow.biz/api/auth/google/callback`) |
| 12 | `AI_PROVIDER` | Required (`stub` for staging) |
| 13 | `ANTHROPIC_API_KEY` | Conditional — startup validator may require non-empty even with stub |
| 14 | `OPENAI_API_KEY` | Conditional — startup validator may require non-empty even with stub |
| 15 | `SESSION_TIMEOUT_MINUTES` | Required (`120`) |
| 16 | `MAX_CONCURRENT_SESSIONS` | Required (`8`) |
| 17 | `EMAIL_PROVIDER` | Required (`stub` for staging) |
| 18 | `RESEND_API_KEY` | Disabled for staging (EMAIL_PROVIDER=stub) |
| 19 | `AUTH_EMAIL_FROM` | Disabled for staging |
| 20 | `AUTH_EMAIL_REPLY_TO` | Disabled for staging |
| 21 | `LAUNCH_STATE` | Required (`INTERNAL`) |
| 22 | `INTERNAL_SERVICE_KEY` | Required — Keith must configure |

---

## 10. AI Service Worker Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `PORT` | Required (`4001`) |
| 2 | `AI_PROVIDER` | Required (`stub` for staging) |
| 3 | `API_GATEWAY_URL` | Required (`http://localhost:4000`) |
| 4 | `INTERNAL_SERVICE_KEY` | Required — Keith must configure |
| 5 | `REDIS_URL` | Required — Keith must configure |
| 6 | `DATABASE_URL` | Required — Keith must configure |
| 7 | `ANTHROPIC_API_KEY` | Conditional |
| 8 | `OPENAI_API_KEY` | Conditional |
| 9 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | Required (`false` on staging) |
| 10 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | Required (`false` on staging) |
| 11 | `AGENT_HARNESS_STUB_WRITE_MODE` | Required (`false` on staging) |

---

## 11. Container Manager Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `PORT` | Required (`4002`) |
| 2 | `API_GATEWAY_URL` | Required (`http://localhost:4000`) |
| 3 | `INTERNAL_SERVICE_KEY` | Required — Keith must configure |
| 4 | `DOCKER_HOST` | Required (`unix:///var/run/docker.sock`) |
| 5 | `CONTAINER_CPU_LIMIT` | Required (`0.5`) |
| 6 | `CONTAINER_MEMORY_LIMIT` | Required (`1g`) |
| 7 | `CONTAINER_DISK_LIMIT` | Required (`3g`) |
| 8 | `JWT_SECRET` | Required — Keith must configure |
| 9 | `ENABLE_PREVIEW_ACCESS_CONTROL` | Optional (`false` for staging) |
| 10 | `SESSION_MAX_LIFETIME_MS` | Optional (`86400000`) |
| 11 | `SESSION_IDLE_TIMEOUT_MS` | Optional (`1800000`) |
| 12 | `CONTAINER_MEMORY_LIMIT_MB` | Optional (`512`) |
| 13 | `CONTAINER_PIDS_LIMIT` | Optional (`256`) |
| 14 | `MAX_CONCURRENT_EXECS_PER_SESSION` | Optional (`2`) |

---

## 12. Database Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `POSTGRES_HOST` | Required (`localhost` on staging) |
| 2 | `POSTGRES_PORT` | Required (`5432`) |
| 3 | `POSTGRES_USER` | Required (`aisandbox`) |
| 4 | `POSTGRES_PASSWORD` | Required — Keith must configure |
| 5 | `POSTGRES_DB` | Required (`aisandbox`) |
| 6 | `DATABASE_URL` | Required — Keith must configure |

PostgreSQL listens on `localhost:5432` only — never exposed to internet. `POSTGRES_HOST` must be `localhost` (not Docker hostname). `DATABASE_URL` must use `localhost`.

---

## 13. Redis Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `REDIS_HOST` | Required (`localhost` on staging) |
| 2 | `REDIS_PORT` | Required (`6379`) |
| 3 | `REDIS_PASSWORD` | Required — Keith must configure |
| 4 | `REDIS_URL` | Required — Keith must configure |

Redis listens on `127.0.0.1:6379` only — never exposed to internet. `requirepass` set in `redis.conf` on VPS.

---

## 14. Auth / Session Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `JWT_SECRET` | Required — same across API Gateway and Container Manager |
| 2 | `SESSION_SECRET` | Required — Keith must configure |
| 3 | `OAUTH_STATE_SECRET` | Required — Keith must configure |
| 4 | `SESSION_TIMEOUT_MINUTES` | Required (`120`) |
| 5 | `MAX_CONCURRENT_SESSIONS` | Required (`8`) |

---

## 15. Google OAuth Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `GOOGLE_CLIENT_ID` | Required — Keith must configure |
| 2 | `GOOGLE_CLIENT_SECRET` | Required — Keith must configure |
| 3 | `GOOGLE_CALLBACK_URL` | Required (`https://staging.ainow.biz/api/auth/google/callback`) |

Keith must create Google Cloud OAuth 2.0 client. Application type: Web application. Authorized redirect URI: `https://staging.ainow.biz/api/auth/google/callback`. Keep staging and development OAuth clients separate.

**Apple OAuth variables** (APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CALLBACK_URL): Disabled for staging — not required for initial private beta.

---

## 16. Billing / Payment Disabled-State Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `BILLING_CHARGES_ENABLED` | Required — **MUST be `false`** |

`BILLING_CHARGES_ENABLED=false` is the critical financial kill switch. When `false`: NO payment execution possible, NO Stripe charges. No Stripe API keys or webhook secrets needed for staging.

---

## 17. Safety / Kill-Switch Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `GLOBAL_EXECUTION_ENABLED` | Required — **Must be `false`** |
| 2 | `PROVIDER_OPENAI_ENABLED` | Required — **Must be `false`** |
| 3 | `PROVIDER_ANTHROPIC_ENABLED` | Required — **Must be `false`** |
| 4 | `PROVIDER_GROQ_ENABLED` | Required — **Must be `false`** |
| 5 | `PROVIDER_XAI_ENABLED` | Required — **Must be `false`** |
| 6 | `PROVIDER_DEEPSEEK_ENABLED` | Required — **Must be `false`** |
| 7 | `BILLING_SNAPSHOT_ENABLED` | Required — **Must be `false`** |
| 8 | `PAYMENT_EXECUTION_ENABLED` | Required — **Must be `false`** |
| 9 | `MAX_TOKENS_PER_EXECUTION` | Required (`100000` default) |
| 10 | `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | Required (`10000` default) |
| 11 | `MAX_DAILY_SPEND_SOFT_USD` | Required (default `10000`) |
| 12 | `MAX_DAILY_SPEND_HARD_USD` | Required (default `20000`) |
| 13 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | Required — **Must be `false`** |
| 14 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | Required — **Must be `false`** |
| 15 | `AGENT_HARNESS_STUB_WRITE_MODE` | Required — **Must be `false`** |
| 16 | `BILLING_CHARGES_ENABLED` | Required — **Must be `false`** |

All AI execution, tool loop, write tools, billing, and payment paths are **disabled by default** on staging.

---

## 18. Domain / CORS / Cookie Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `APP_BASE_URL` | Required (`https://staging.ainow.biz`) |
| 2 | `GOOGLE_CALLBACK_URL` | Required (`https://staging.ainow.biz/api/auth/google/callback`) |

CORS rules: `APP_BASE_URL` must be `https://staging.ainow.biz`. No localhost origins. No wildcard CORS with credentials. Cookie `Secure`: true (HTTPS via Caddy). Cookie `HttpOnly`: true. Cookie `SameSite`: Lax or Strict.

---

## 19. Logging / Monitoring / Support Variables

| # | Variable | Required Status |
|---|----------|----------------|
| 1 | `LOG_LEVEL` | Optional (`info` or `warn` for staging) |

PM2 manages log output (`~/.pm2/logs/`). PM2 log rotation via `pm2-logrotate`. System services log via `journalctl`. No external log aggregation required for initial private beta.

---

## 20. Classification Summary

**Required (must be set):** NODE_ENV, LAUNCH_STATE, INTERNAL_SERVICE_KEY, APP_BASE_URL, PORT (per service), JWT_SECRET, SESSION_SECRET, OAUTH_STATE_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, AI_PROVIDER, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, SESSION_TIMEOUT_MINUTES, MAX_CONCURRENT_SESSIONS, EMAIL_PROVIDER, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_URL, API_GATEWAY_URL, DOCKER_HOST, CONTAINER_CPU_LIMIT, CONTAINER_MEMORY_LIMIT, CONTAINER_DISK_LIMIT, NEXT_PUBLIC_SHOW_DEV_TOOLS, NEXT_PUBLIC_PROJECT_FIRST_UX

**Required — Kill Switches (must be `false`):** GLOBAL_EXECUTION_ENABLED, PROVIDER_OPENAI_ENABLED, PROVIDER_ANTHROPIC_ENABLED, PROVIDER_GROQ_ENABLED, PROVIDER_XAI_ENABLED, PROVIDER_DEEPSEEK_ENABLED, BILLING_SNAPSHOT_ENABLED, PAYMENT_EXECUTION_ENABLED, BILLING_CHARGES_ENABLED, AGENT_HARNESS_ENABLE_TOOL_LOOP, AGENT_HARNESS_ENABLE_WRITE_TOOLS, AGENT_HARNESS_STUB_WRITE_MODE

**Required — Safety Limits:** MAX_TOKENS_PER_EXECUTION, MAX_EXECUTIONS_PER_MINUTE_GLOBAL, MAX_DAILY_SPEND_SOFT_USD, MAX_DAILY_SPEND_HARD_USD

**Optional (defaults exist):** ABORT_MODE, LOG_LEVEL, ENABLE_PREVIEW_ACCESS_CONTROL, SESSION_MAX_LIFETIME_MS, SESSION_IDLE_TIMEOUT_MS, CONTAINER_MEMORY_LIMIT_MB, CONTAINER_PIDS_LIMIT, MAX_CONCURRENT_EXECS_PER_SESSION

**Disabled for staging (omit or placeholder):** APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CALLBACK_URL, RESEND_API_KEY, AUTH_EMAIL_FROM, AUTH_EMAIL_REPLY_TO, GROQ_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY

**Conditional / Verify Later:** ANTHROPIC_API_KEY, OPENAI_API_KEY (startup validator may require non-empty even with stub)

---

## 21. Safe Secret Generation Examples

**These commands are for future VPS-side execution by Keith only. Do NOT run in Cursor, local dev, or chat.**

```bash
# Keith runs these on the Lightsail VPS — values stay on the server only
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 32   # OAUTH_STATE_SECRET
openssl rand -hex 32   # INTERNAL_SERVICE_KEY (same value in all services)
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # REDIS_PASSWORD
```

Rules:
- Generate each secret independently — do NOT reuse across variables.
- `INTERNAL_SERVICE_KEY` must be the SAME value in all services.
- `JWT_SECRET` must be the SAME value in api-gateway and container-manager.
- All other secrets must be unique.
- Generated values stay on the VPS — never copied to Cursor or chat.

---

## 22. Safe Secret-Entry Procedure

**For future execution by Keith only. Not executed in this step.**

| Step | Action |
|------|--------|
| 1 | SSH into VPS (Lightsail browser SSH or local SSH key) |
| 2 | `cd /opt/aisandbox` |
| 3 | `nano /opt/aisandbox/.env` (or vim) |
| 4 | Enter all variables with real values; use `openssl rand -hex 32` in a separate terminal for secrets |
| 5 | Save and close: Ctrl+O, Enter, Ctrl+X (nano) or `:wq` (vim) |
| 6 | `chmod 600 /opt/aisandbox/.env` |
| 7 | Verify: `ls -la /opt/aisandbox/.env` — must show `ubuntu ubuntu` and `-rw-------` |
| 8 | Verify not in git: `cd /opt/aisandbox && git status` — `.env` must NOT appear |
| 9 | Cursor/chat never receives values |
| 10 | Run presence-check validation (prints names only, never values) |

Critical rules:
- Keith is the ONLY person who enters secrets on the VPS.
- Values are typed directly on the VPS — never pasted from chat/Cursor.
- Terminal history may contain generated secrets — Keith should `history -c` after if concerned.
- The `.env` file must NEVER be `cat`-ed or printed in any context that could be captured by AI.
- Each staging/production environment uses unique secrets — never reuse local dev values.

---

## 23. File Permission Plan

| File | Path on VPS | Owner | Permissions |
|------|-------------|-------|-------------|
| Root `.env` | `/opt/aisandbox/.env` | `ubuntu:ubuntu` | `chmod 600` |
| Per-service `.env` (if used) | `/opt/aisandbox/services/<service>/.env` | `ubuntu:ubuntu` | `chmod 600` |
| Frontend `.env.local` (if used) | `/opt/aisandbox/frontend/.env.local` | `ubuntu:ubuntu` | `chmod 600` |

Verification commands (future VPS-side only):

```bash
ls -la /opt/aisandbox/.env
# Expected: -rw------- 1 ubuntu ubuntu <size> <date> .env

stat -c '%a %U:%G' /opt/aisandbox/.env
# Expected: 600 ubuntu:ubuntu
```

---

## 24. Keith Manual Configuration Checklist

| # | Action | Depends On | SETUP Task |
|---|--------|-----------|-----------|
| 1 | Generate `JWT_SECRET` on VPS | VPS exists + SSH works | SETUP-05 execution |
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

## 25. Never-Paste Rules

Never paste into Cursor or chat:

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

**If a secret may have been exposed to Cursor/chat, STOP and rotate immediately.**

---

## 26. Validation Approach Without Exposing Values

Presence-only validation script for future VPS-side use by Keith:

```bash
#!/usr/bin/env bash
# validate-env-presence.sh — checks variable names exist, never prints values

set -euo pipefail
ENV_FILE="/opt/aisandbox/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: $ENV_FILE does not exist"
  exit 1
fi

REQUIRED_VARS=(
  NODE_ENV LAUNCH_STATE INTERNAL_SERVICE_KEY APP_BASE_URL PORT
  JWT_SECRET JWT_EXPIRES_IN JWT_REFRESH_EXPIRES_IN
  SESSION_SECRET OAUTH_STATE_SECRET
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_CALLBACK_URL
  AI_PROVIDER SESSION_TIMEOUT_MINUTES MAX_CONCURRENT_SESSIONS EMAIL_PROVIDER
  POSTGRES_HOST POSTGRES_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL
  REDIS_HOST REDIS_PORT REDIS_PASSWORD REDIS_URL
  API_GATEWAY_URL DOCKER_HOST CONTAINER_CPU_LIMIT CONTAINER_MEMORY_LIMIT CONTAINER_DISK_LIMIT
  GLOBAL_EXECUTION_ENABLED PROVIDER_OPENAI_ENABLED PROVIDER_ANTHROPIC_ENABLED
  PROVIDER_GROQ_ENABLED PROVIDER_XAI_ENABLED PROVIDER_DEEPSEEK_ENABLED
  BILLING_SNAPSHOT_ENABLED PAYMENT_EXECUTION_ENABLED BILLING_CHARGES_ENABLED
  MAX_TOKENS_PER_EXECUTION MAX_EXECUTIONS_PER_MINUTE_GLOBAL
  MAX_DAILY_SPEND_SOFT_USD MAX_DAILY_SPEND_HARD_USD
  AGENT_HARNESS_ENABLE_TOOL_LOOP AGENT_HARNESS_ENABLE_WRITE_TOOLS AGENT_HARNESS_STUB_WRITE_MODE
  NEXT_PUBLIC_SHOW_DEV_TOOLS NEXT_PUBLIC_PROJECT_FIRST_UX
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
  echo "PASS: All required variables present."
else
  echo "FAIL: $MISSING required variable(s) missing."
  exit 1
fi
```

Rules:
- Script prints only `PRESENT:` or `MISSING:` followed by the variable NAME.
- Script NEVER prints variable VALUES.
- Script output is safe to paste into chat (only names, no values).

---

## 27. What Was Not Done

| # | Not Done |
|---|---------|
| 1 | No `.env` file created |
| 2 | No `.env` file opened (only `.env.example` placeholder files read) |
| 3 | No `.env.local`, `.env.staging`, `.env.production` opened |
| 4 | No credential, key, certificate, or token file opened |
| 5 | No secret values printed, requested, or generated |
| 6 | No implementation |
| 7 | No source code changes |
| 8 | No test file changes |
| 9 | No package file changes |
| 10 | No migration, entity, or schema file changes |
| 11 | No environment file changes |
| 12 | No Docker file changes |
| 13 | No deployment file changes |
| 14 | No runtime tools installed |
| 15 | No repo cloned |
| 16 | No services built or started |
| 17 | No AWS server/static IP created |
| 18 | No DNS/TLS/firewall changed |
| 19 | No SSH occurred |
| 20 | No deployment |
| 21 | No Docker/PostgreSQL/Redis used |
| 22 | No migrations executed |
| 23 | No tests or builds run |
| 24 | No APIs called |
| 25 | No browser opened |
| 26 | No beta users invited |
| 27 | No subagents used |
| 28 | No git commit or push |
| 29 | SETUP-06 not registered |

---

## 28. Safety Boundaries Preserved

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
| 27 | No subagents used | YES |
| 28 | No git commit or push | YES |

---

## 29. Product Impact

SETUP-05 unblocks SETUP-06 (Database / Redis Setup Plan). The env variable checklist establishes:
- The complete variable inventory for all services on staging.
- A verified classification (required/optional/disabled/unknown) for every variable.
- A safe procedure Keith can follow to configure secrets without exposing them to AI tooling.
- A validation approach that confirms presence without exposing values.
- The foundational input for database and Redis password requirements documented in SETUP-06.

SETUP-05 does not itself start, configure, or verify any runtime. That is the responsibility of SETUP-06 through SETUP-08.

---

## 30. Dependency / Handoff to SETUP-06

| Field | Value |
|-------|-------|
| Next child task | PRIVATE-BETA-STAGING-SETUP-06 |
| Title | Database / Redis Setup Plan |
| Expected scope | Plan PostgreSQL 15 installation, database/user creation, `pg_hba.conf` configuration, Redis 7 installation, `requirepass` configuration, localhost binding verification, connectivity testing |
| Prerequisites | SETUP-05 COMPLETE (this checkpoint confirms env variable requirements for DB/Redis) |
| Registration | Keith must explicitly approve SETUP-06 registration |

**SETUP-06 is NOT registered in this step.**

---

## 31. Acceptance Criteria Disposition

###### Registration (Step 1 — COMPLETE 2026-07-21)
- [x] PRIVATE-BETA-STAGING-SETUP-05 added to TASKS_BACKLOG_FULL.md
- [x] PRIVATE-BETA-STAGING-SETUP-05 activated in TASKS.md
- [x] PRIVATE-BETA-STAGING-SETUP-01–04 remain COMPLETE and LOCKED
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE
- [x] Scope limited to env variable presence checklist and safe secret-entry planning
- [x] 3-step child workflow recorded
- [x] No real env file opened or edited
- [x] No secret values printed/requested
- [x] No implementation during registration
- [x] No subagents used

###### Env Variable Presence Checklist + Secret Entry Procedure (Step 2 — COMPLETE 2026-07-21)
- [x] All 22 scope items covered
- [x] No real env file created, opened, or edited
- [x] No secret values printed, requested, or committed
- [x] Step 2 verdict: PASS
- [x] Keith explicit approval recorded before starting Step 2

###### Consolidation / Handoff to SETUP-06 (Step 3 — COMPLETE 2026-07-21)
- [x] Checklist/procedure document created: `docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md`
- [x] PRIVATE-BETA-STAGING-SETUP-05 marked COMPLETE and LOCKED
- [x] AINOW-EXECUTION-ROADMAP.md updated
- [x] SETUP-06 not registered in this step

---

## 32. Locked-State Instruction

PRIVATE-BETA-STAGING-SETUP-05 is COMPLETE and LOCKED as of 2026-07-21.

Do not modify this checkpoint document. Do not re-open the env checklist or env procedure. Do not open real `.env` files. Do not expose, generate, or request real secret values. The planning work captured here is complete and immutable.

---

## 33. Exact Next Action

**Register PRIVATE-BETA-STAGING-SETUP-06 — Database / Redis Setup Plan.**

SETUP-06 registration requires Keith explicit approval.

SETUP-06 scope: PostgreSQL 15 installation plan, database/user creation, `pg_hba.conf` configuration, Redis 7 installation plan, `requirepass` configuration, localhost binding verification, connectivity testing — planning only, no runtime execution.

No implementation. No deployment. No runtime. No SSH. No Docker. No PostgreSQL. No Redis. No migration. No secrets. No subagents.

---

**Document created:** 2026-07-21
**Step 3 status:** COMPLETE
**PRIVATE-BETA-STAGING-SETUP-05 final status:** COMPLETE and LOCKED — 2026-07-21
**No env file created, opened, or edited.**
**No secret values printed, requested, or generated.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.**
**No git commit or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
**SETUP-06 not registered.**
