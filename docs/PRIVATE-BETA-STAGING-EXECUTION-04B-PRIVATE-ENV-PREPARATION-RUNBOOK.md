# PRIVATE-BETA-STAGING-EXECUTION-04B — Private Env Preparation Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04B
**Title:** Private Env Preparation
**Step:** 2 — Private Env Preparation Runbook
**Date created:** 2026-07-26
**Nature:** Runbook only — no server action — designed for Keith manual execution inside AWS Lightsail browser SSH. Amended 2026-07-26 for Outcome B (Google OAuth deferred) by PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION. No source files changed. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## Section 1 — Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04B |
| Title | Private Env Preparation |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | HIGH-RISK — credential handling; first `.env` file on staging VPS |
| Registered | 2026-07-26 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |

---

## Section 2 — Purpose

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the EXECUTION-04B manual execution step.

The sole goal of this child slice is to create `/opt/aisandbox/.env` **privately** on the VPS — with correct ownership, correct permissions, the correct set of required key names, and safe kill-switch/provider-safety posture — without:
- installing dependencies
- building the app
- starting app services
- running migrations
- configuring DNS or TLS
- disclosing any secret value to this chat

This runbook is the authoritative reference for the 04B manual execution session. Follow it section by section without skipping.

---

## Section 3 — What This Child Slice Does

When executed by Keith, this slice:

1. Confirms EXECUTION-04A is complete and the repo exists at the expected path and state.
2. Recommends creating a pre-env snapshot as a rollback point before touching `.env`.
3. Identifies the required env key names from static source/config/docs review.
4. Provides a key-name-only env checklist.
5. Instructs Keith to create `/opt/aisandbox/.env` **privately** on the VPS.
6. Sets file owner to `ubuntu:ubuntu` and permissions to `chmod 600`.
7. Validates key presence (key names only — no values).
8. Confirms kill-switch and provider-safety posture by key presence / Yes-No only.
9. Confirms no dependency install, no build, no app services, no migrations, no DNS/TLS.
10. Collects safe Yes/No evidence only.

---

## Section 4 — What This Child Slice Does NOT Do

This slice does **not**:

- Install npm dependencies (`npm install`, `npm ci`)
- Run any build command (`npm run build`, `tsc`, `next build`)
- Start any app service (PM2 app processes, systemd app services)
- Run any database migration
- Configure DNS A records or Caddy site config
- Request TLS certificates
- Enable real AI execution
- Enable real container execution
- Enable billing or payment execution
- Print `.env` contents
- Print `DATABASE_URL`, `REDIS_URL`, DB passwords, Redis passwords, provider keys, tokens, or JWT/session secrets
- Ask Keith to paste any secret value into chat
- Modify source code
- Commit or push git

---

## Section 5 — Preconditions

Before starting manual execution, confirm all of the following:

| # | Precondition | Required state |
|---|-------------|----------------|
| 1 | EXECUTION-04A | COMPLETE and LOCKED — 2026-07-25 — Evidence verdict PASS |
| 2 | EXECUTION-04B Step 1 (Registration) | COMPLETE — 2026-07-26 |
| 3 | Repo exists at `/opt/aisandbox` | Yes |
| 4 | Repo owner | `ubuntu:ubuntu` |
| 5 | Repo branch | `main` |
| 6 | Repo latest commit | `c55a278 Register staging execution 04A repo clone baseline` |
| 7 | Repo git status | clean / empty |
| 8 | No `.env` exists yet | Confirmed absent in 04A |
| 9 | No `node_modules` | Confirmed absent in 04A |
| 10 | No `dist/` or `.next/` | Confirmed absent in 04A |
| 11 | PM2 processes | Empty — no app processes |
| 12 | PostgreSQL | Active — local-only — `aisandbox` database exists — table count 0 |
| 13 | Redis | Active — local-only — `protected-mode yes` — `requirepass` configured |
| 14 | All 4 snapshots | Available |
| 15 | DB password | Keith holds privately |
| 16 | Redis password | Keith holds privately |
| 17 | JWT/session secrets | Keith will generate privately on VPS |
| 18 | Google OAuth credentials | Deferred / omitted intentionally for private beta staging (Outcome B) — do not use fake placeholders |
| 19 | All kill-switches will be set to `false` | Keith confirms intent |

If any precondition is not met, stop and resolve before proceeding.

---

## Section 6 — Lightsail Browser SSH Instruction

**All server commands in this runbook must be run inside the AWS Lightsail browser SSH console.**

**Do NOT run server commands in PowerShell, CMD, or local terminal.**

To open the Lightsail browser SSH console:

1. Log into AWS Console → Lightsail.
2. Select the `aisandbox-staging` instance.
3. Click **Connect using SSH** (or the terminal icon).
4. The browser SSH console opens.
5. Run all commands in that console.

Default user is `ubuntu`. Commands requiring root use `sudo`.

**Nano editor shortcuts in the Lightsail browser SSH session:**
- `Ctrl+O` then `Enter` — save (write out)
- `Ctrl+X` — exit
- **Do NOT use `Ctrl+W`** in Lightsail browser SSH — it may close the browser tab.

---

## Section 7 — Secret Safety Rules

These rules are **absolute** and must be followed at all times during this child slice.

| # | Rule |
|---|------|
| 1 | Do NOT paste any `.env` file contents into this chat or any AI tool |
| 2 | Do NOT paste `DATABASE_URL` (including the password) |
| 3 | Do NOT paste `REDIS_URL` (including the password) |
| 4 | Do NOT paste `DB password`, `Redis password`, `JWT_SECRET`, `SESSION_SECRET`, `OAUTH_STATE_SECRET`, `INTERNAL_SERVICE_KEY` |
| 5 | Do NOT paste `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` |
| 6 | Do NOT paste `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or any AI provider key |
| 7 | Do NOT paste SSH private key content |
| 8 | Do NOT paste AWS credentials |
| 9 | Do NOT run `cat /opt/aisandbox/.env` at any time |
| 10 | Do NOT run `echo $SOME_SECRET_VAR` in a context visible to chat |
| 11 | Keith is the only person who creates secrets and enters them on the VPS |
| 12 | Values are typed or generated directly on the VPS — never copied from chat |
| 13 | If a secret may have been accidentally disclosed, STOP immediately and rotate it |
| 14 | Terminal history may contain generated secrets — Keith may run `history -c` after secret generation if concerned |
| 15 | Evidence from 04B must contain only Yes/No confirmations and PRESENT/MISSING key-name output — never values |

---

## Section 8 — Pre-Env Snapshot Recommendation

**Before creating `/opt/aisandbox/.env`, Keith should create a new Lightsail snapshot as a rollback point.**

This snapshot captures the clean post-clone state before any credentials are introduced to the VPS filesystem.

### Recommended Snapshot Name

```
aisandbox-staging-postclone-preenv-2026-07-26
```

(Adjust date to actual execution date.)

### Why This Snapshot Matters

- Allows rollback to a clean post-clone / pre-env state if `.env` is created incorrectly.
- Maintains the chain of rollback points: baseline → runtime → db-redis → preclone → **postclone-preenv**.

### Snapshot Instructions

Run inside **AWS Lightsail browser SSH — not PowerShell**:

The snapshot is created from the AWS Lightsail console (not via CLI or SSH). Keith opens the Lightsail instance page → Snapshots tab → Create snapshot. Name it `aisandbox-staging-postclone-preenv-2026-07-26`. Wait for status to become **Available** before proceeding to Section 9.

If the snapshot cannot be created or does not reach **Available** status, stop and report. Do not proceed to `.env` creation without this rollback point.

---

## Section 9 — Repo State Verification

Before creating `.env`, confirm the repo remains at the exact 04A-verified baseline.

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
# 9A — Confirm repo path exists
ls -ld /opt/aisandbox

# 9B — Confirm owner
stat -c "%U %G" /opt/aisandbox

# 9C — Confirm branch and commit
cd /opt/aisandbox
git log --oneline -1
git branch --show-current
git status --short
```

### Expected Outputs

| Check | Expected |
|-------|----------|
| `/opt/aisandbox` exists | Directory present |
| Owner | `ubuntu ubuntu` |
| `git log --oneline -1` | `c55a278 Register staging execution 04A repo clone baseline` |
| `git branch --show-current` | `main` |
| `git status --short` | (empty output — clean working tree) |

If any check fails, stop and report. Do not proceed to `.env` creation.

### Confirm No .env Exists Yet

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
# Confirm no .env exists yet
ls /opt/aisandbox/.env 2>/dev/null && echo ".env EXISTS — stop and investigate" || echo "No .env — OK to proceed"
```

Expected: `No .env — OK to proceed`

If `.env` already exists unexpectedly, stop and report. Do not overwrite without understanding why it exists.

---

## Section 10 — Required Env Key Discovery Summary

This section records the result of a static review of non-secret source/config/docs files performed on 2026-07-26.

**No secret values were reviewed or printed. No env files were opened. Only source code, config modules, and the previously created SETUP-05 env checklist were reviewed.**

### Sources reviewed

| Source | Type |
|--------|------|
| `docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md` | Prior authoritative env checklist (2026-07-21) — key names only |
| `services/api-gateway/src/safety/kill-switch.config.ts` | Kill-switch env key names |
| `services/api-gateway/src/safety/global-safety-limits.config.ts` | Safety limit env key names |
| `services/ai-service/src/claude/claude.service.ts` | Claude provider env key names |
| `services/ai-service/src/worker/worker.processor.ts` | Worker execution env key names |
| `services/ai-service/src/internal/queue.controller.ts` | Worker concurrency env key name |
| `services/ai-service/src/main.ts` | Service port and AI provider env key names |

### Discovery method

Searched for patterns: `process.env.`, `NEXT_PUBLIC_`, `DATABASE_URL`, `REDIS_URL`, `JWT`, `SESSION`, `COOKIE`, `SECRET`, `INTERNAL`, `CORS`, `ORIGIN`, `PORT`, `BILLING`, `PAYMENT`, `PROVIDER`, `AGENT_HARNESS`, `EXECUTION`, `CONTAINER`, `GLOBAL_EXECUTION_ENABLED`.

### Key findings

1. All env keys previously documented in `docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md` are confirmed applicable.
2. New keys found in source scan (not explicitly in SETUP-05): `CLAUSE_API_KEY`, `CLAUDE_API_BASE_URL`, `EXECUTION_WORKER_CONCURRENCY`, `EXECUTION_TIMEOUT_MS`, `EXECUTION_STUCK_SCAN_INTERVAL_MS`, `EXECUTION_PROVIDER_RETRY_ATTEMPTS`, `EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS`, `INVOICE_GENERATION_ENABLED`, and per-provider rate limit keys.
3. Kill-switch config source truth: `GLOBAL_EXECUTION_ENABLED`, `PROVIDER_OPENAI_ENABLED`, `PROVIDER_ANTHROPIC_ENABLED`, `PROVIDER_GROQ_ENABLED`, `PROVIDER_XAI_ENABLED`, `PROVIDER_DEEPSEEK_ENABLED`, `BILLING_SNAPSHOT_ENABLED`, `INVOICE_GENERATION_ENABLED`, `PAYMENT_EXECUTION_ENABLED` — all confirmed in source.
4. `PROVIDER_GOOGLE_ENABLED`, `PROVIDER_OPENROUTER_ENABLED`, `AGENT_HARNESS_ENABLED`, `AGENT_HARNESS_TOOL_LOOP_ENABLED`, `BILLING_CHECKOUT_ENABLED` — **not found** in current source/config. Not required. Noted for awareness only.
5. No Google AI provider or OpenRouter provider detected in kill-switch config.

---

## Section 11 — Required Env Key Checklist — Names Only

**No values appear in this section. "Value" column contains staging posture guidance only — never real values.**

### 11A — Runtime / App Config

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `NODE_ENV` | Yes | All | Runtime | `production` | Required by NestJS/Next.js |
| `LAUNCH_STATE` | Yes | API Gateway | App mode | `INTERNAL` | Private beta staging mode |
| `APP_BASE_URL` | Yes | API Gateway | Domain/CORS | `https://staging.ainow.biz` | Controls CORS allowed origins and auth base URL; DNS/TLS not yet configured — set to expected final value |
| `ABORT_MODE` | Optional | API Gateway | Safety | `NONE` (default) | Defaults to `NONE`; valid: `NONE`, `EXECUTION_BLOCKED`, `FULL_SHUTDOWN` |

### 11B — Service Ports

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `PORT` (API Gateway) | Yes | API Gateway | Service port | `4000` | |
| `PORT` (AI Service) | Yes | AI Service | Service port | `4001` | |
| `PORT` (Container Manager) | Yes | Container Manager | Service port | `4002` | |
| `PORT` (Frontend) | Yes | Frontend | Service port | `3002` | Set in frontend package.json or via PM2 |

### 11C — Database

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `POSTGRES_HOST` | Yes | API Gateway | DB connection | `localhost` | Not `postgres` (Docker hostname) |
| `POSTGRES_PORT` | Yes | API Gateway | DB connection | `5432` | |
| `POSTGRES_USER` | Yes | API Gateway | DB connection | `aisandbox` | Matches EXECUTION-03 baseline |
| `POSTGRES_PASSWORD` | Yes — SECRET | API Gateway | DB credential | Keith private decision | Generate with `openssl rand -hex 32` on VPS — same password set in EXECUTION-03 |
| `POSTGRES_DB` | Yes | API Gateway | DB connection | `aisandbox` | Matches EXECUTION-03 baseline |
| `DATABASE_URL` | Yes — SECRET | API Gateway, AI Service | DB connection string | Keith private decision | Must be `postgresql://aisandbox:PASSWORD@localhost:5432/aisandbox` — use the same password as configured in EXECUTION-03 |

### 11D — Redis

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `REDIS_HOST` | Yes | API Gateway | Redis connection | `localhost` | Not `redis` (Docker hostname) |
| `REDIS_PORT` | Yes | API Gateway | Redis connection | `6379` | |
| `REDIS_PASSWORD` | Yes — SECRET | API Gateway | Redis credential | Keith private decision | Same password configured in Redis `requirepass` during EXECUTION-03 |
| `REDIS_URL` | Yes — SECRET | API Gateway, AI Service | Redis connection string | Keith private decision | Must be `redis://:PASSWORD@localhost:6379` — use the same password as configured in EXECUTION-03 |

### 11E — Auth / Session

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `JWT_SECRET` | Yes — SECRET | API Gateway, Container Manager | JWT signing | Keith private decision | Generate with `openssl rand -hex 32` — must be **same** in API Gateway and Container Manager |
| `JWT_EXPIRES_IN` | Yes | API Gateway | JWT config | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | Yes | API Gateway | JWT config | `7d` | |
| `SESSION_SECRET` | Yes — SECRET | API Gateway | Session signing | Keith private decision | Generate with `openssl rand -hex 32` |
| `OAUTH_STATE_SECRET` | Yes — SECRET | API Gateway | OAuth anti-CSRF | Keith private decision | Generate with `openssl rand -hex 32` |
| `SESSION_TIMEOUT_MINUTES` | Yes | API Gateway | Session config | `120` | |
| `MAX_CONCURRENT_SESSIONS` | Yes | API Gateway | Session config | `8` | |

### 11F — Google OAuth

**Decision source:** `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION-REPORT.md`

**Outcome B — Google OAuth can be deferred.** Email/password login is sufficient for current staging validation. Omit Google OAuth keys from `/opt/aisandbox/.env`. Do not use fake placeholder values. Configure real Google OAuth later in a dedicated task before public launch or before Google login validation.

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `GOOGLE_CLIENT_ID` | Deferred / Conditional | API Gateway | Google OAuth | Omit from `/opt/aisandbox/.env` | Google OAuth deferred for private beta staging — email/password login is sufficient — do not use fake placeholder values — configure real Google OAuth later in a dedicated task before public launch or before Google login validation |
| `GOOGLE_CLIENT_SECRET` | Deferred / Conditional | API Gateway | Google OAuth | Omit from `/opt/aisandbox/.env` | Same as above — omission is safer than placeholders |
| `GOOGLE_CALLBACK_URL` | Deferred / Conditional | API Gateway | Google OAuth | Omit from `/opt/aisandbox/.env` | Not needed while Google strategy is disabled — do not use fake placeholder values |

### 11G — Internal Service Auth

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `INTERNAL_SERVICE_KEY` | Yes — SECRET | All services | Service-to-service auth | Keith private decision | Generate with `openssl rand -hex 32` — must be **same** in API Gateway, AI Service, and Container Manager |

### 11H — AI Provider Config

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `AI_PROVIDER` | Yes | API Gateway, AI Service | AI provider selection | `stub` | No real AI calls on staging |
| `ANTHROPIC_API_KEY` | Conditional — verify | API Gateway, AI Service | AI provider credential | `not-used-stub-mode` (placeholder) or omit | Production validator may require non-empty even with `AI_PROVIDER=stub`; use a non-secret placeholder string if required at startup |
| `OPENAI_API_KEY` | Conditional — verify | API Gateway, AI Service | AI provider credential | `not-used-stub-mode` (placeholder) or omit | Same as above — verify at runtime in 04D |
| `CLAUDE_API_KEY` | Disabled for staging | AI Service | Claude AI credential | Omit or placeholder | Only needed if `AI_PROVIDER=claude`; not used with `stub` |
| `CLAUDE_API_BASE_URL` | Disabled for staging | AI Service | Claude API endpoint | Omit | Optional override; not needed with `stub` |

### 11I — Frontend Public URLs

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | Yes | Frontend | Feature flag | `false` | Must be `false` on staging |
| `NEXT_PUBLIC_PROJECT_FIRST_UX` | Yes | Frontend | Feature flag | Keith decision | Controls project-first UX flow |
| `API_GATEWAY_URL` | Yes | Frontend (SSR), AI Service, Container Manager | Service URL | `http://localhost:4000` | Server-side SSR internal URL; stays on VPS |

### 11J — Container Manager Config

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `DOCKER_HOST` | Yes | Container Manager | Docker socket | `unix:///var/run/docker.sock` | |
| `CONTAINER_CPU_LIMIT` | Yes | Container Manager | Resource limit | `0.5` | |
| `CONTAINER_MEMORY_LIMIT` | Yes | Container Manager | Resource limit | `1g` | |
| `CONTAINER_DISK_LIMIT` | Yes | Container Manager | Resource limit | `3g` | |
| `ENABLE_PREVIEW_ACCESS_CONTROL` | Optional | Container Manager | Feature flag | `false` | Defaults to false |
| `SESSION_MAX_LIFETIME_MS` | Optional | Container Manager | Resource governance | `86400000` (24h) | Default acceptable |
| `SESSION_IDLE_TIMEOUT_MS` | Optional | Container Manager | Resource governance | `1800000` (30min) | Default acceptable |
| `CONTAINER_MEMORY_LIMIT_MB` | Optional | Container Manager | Resource governance | `512` | Default acceptable |
| `CONTAINER_PIDS_LIMIT` | Optional | Container Manager | Resource governance | `256` | Default acceptable |
| `MAX_CONCURRENT_EXECS_PER_SESSION` | Optional | Container Manager | Resource governance | `2` | Default acceptable |

### 11K — Email Config

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `EMAIL_PROVIDER` | Yes | API Gateway | Email mode | `stub` | No real emails on staging |
| `RESEND_API_KEY` | Disabled | API Gateway | Email credential | Omit | Not needed when `EMAIL_PROVIDER=stub` |
| `AUTH_EMAIL_FROM` | Disabled | API Gateway | Email config | Omit | Not needed when `EMAIL_PROVIDER=stub` |
| `AUTH_EMAIL_REPLY_TO` | Disabled | API Gateway | Email config | Omit | Not needed when `EMAIL_PROVIDER=stub` |

### 11L — Kill Switches (Required — Set to `false`)

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `GLOBAL_EXECUTION_ENABLED` | Yes | API Gateway | AI execution kill switch | `false` | **Fail-safe** — must be `false` — disables all AI execution dispatch |
| `PROVIDER_OPENAI_ENABLED` | Yes | API Gateway | Provider kill switch | `false` | Must be `false` — no real OpenAI calls |
| `PROVIDER_ANTHROPIC_ENABLED` | Yes | API Gateway | Provider kill switch | `false` | Must be `false` — no real Anthropic calls |
| `PROVIDER_GROQ_ENABLED` | Yes | API Gateway | Provider kill switch | `false` | Must be `false` — no real Groq calls |
| `PROVIDER_XAI_ENABLED` | Yes | API Gateway | Provider kill switch | `false` | Must be `false` — no real xAI calls |
| `PROVIDER_DEEPSEEK_ENABLED` | Yes | API Gateway | Provider kill switch | `false` | Must be `false` — no real DeepSeek calls |
| `BILLING_SNAPSHOT_ENABLED` | Yes | API Gateway | Billing kill switch | `false` | Must be `false` — no billing snapshot creation |
| `INVOICE_GENERATION_ENABLED` | Yes | API Gateway | Billing kill switch | `false` | Must be `false` — no invoice generation |
| `PAYMENT_EXECUTION_ENABLED` | Yes | API Gateway | Payment kill switch | `false` | Must be `false` — no payment execution |
| `BILLING_CHARGES_ENABLED` | Yes | API Gateway | Billing kill switch | `false` | **Critical financial kill switch** — must be `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | Yes | AI Service | Agent tool kill switch | `false` | Must be `false` — disables tool loop entirely |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | Yes | AI Service | Agent write kill switch | `false` | Must be `false` — disables write tools |
| `AGENT_HARNESS_STUB_WRITE_MODE` | Yes | AI Service | Agent debug flag | `false` | Must be `false` on staging |

### 11M — Safety Limits (Required — Set to defaults or conservative values)

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `MAX_TOKENS_PER_EXECUTION` | Yes | API Gateway | Safety limit | `100000` (default) | Conservative for staging |
| `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | Yes | API Gateway | Safety limit | `10000` (default) | Default acceptable |
| `MAX_DAILY_SPEND_SOFT_USD` | Yes | API Gateway | Safety limit | `10000` (default) | Must be < `MAX_DAILY_SPEND_HARD_USD` |
| `MAX_DAILY_SPEND_HARD_USD` | Yes | API Gateway | Safety limit | `20000` (default) | Must be > `MAX_DAILY_SPEND_SOFT_USD` |

### 11N — Optional Execution Tuning (AI Service)

| Key name | Required for staging? | Service/scope | Purpose category | Suggested safe staging posture | Notes |
|----------|----------------------|---------------|-----------------|-------------------------------|-------|
| `EXECUTION_WORKER_CONCURRENCY` | Optional | AI Service | Worker tuning | Omit (default: `os.cpus().length`) | Optional — defaults to CPU count |
| `EXECUTION_TIMEOUT_MS` | Optional | AI Service | Worker tuning | Omit (default: `20000`) | Optional — 20s default |
| `EXECUTION_STUCK_SCAN_INTERVAL_MS` | Optional | AI Service | Worker tuning | Omit (default: `30000`) | Optional — 30s default |
| `EXECUTION_PROVIDER_RETRY_ATTEMPTS` | Optional | AI Service | Worker tuning | Omit (default: `3`) | Optional |
| `EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS` | Optional | AI Service | Worker tuning | Omit (default: `250`) | Optional |

### 11O — Disabled / Omit for Staging

| Key name | Required for staging? | Reason |
|----------|-----------------------|--------|
| `APPLE_CLIENT_ID` | No | Apple OAuth not enabled for initial private beta |
| `APPLE_TEAM_ID` | No | Apple OAuth not enabled |
| `APPLE_KEY_ID` | No | Apple OAuth not enabled |
| `APPLE_PRIVATE_KEY` | No | Apple OAuth not enabled |
| `APPLE_CALLBACK_URL` | No | Apple OAuth not enabled |
| `GROQ_API_KEY` | No | `AI_PROVIDER=stub` — provider disabled |
| `XAI_API_KEY` | No | `AI_PROVIDER=stub` — provider disabled |
| `DEEPSEEK_API_KEY` | No | `AI_PROVIDER=stub` — provider disabled |
| `LOG_LEVEL` | Optional | Inferred from NestJS patterns — omit to use service defaults |

### 11P — Not Found in Source (Noted for Awareness Only)

The following key names were specified in the task brief as potential kill-switch candidates but were **not found** in current source or config. Do not configure these. Record here for awareness.

| Key name | Status | Notes |
|----------|--------|-------|
| `PROVIDER_GOOGLE_ENABLED` | Not found in source | No Google AI provider in kill-switch config |
| `PROVIDER_OPENROUTER_ENABLED` | Not found in source | No OpenRouter provider detected |
| `AGENT_HARNESS_ENABLED` | Not found in source | Use `AGENT_HARNESS_ENABLE_TOOL_LOOP` and `AGENT_HARNESS_ENABLE_WRITE_TOOLS` instead |
| `AGENT_HARNESS_TOOL_LOOP_ENABLED` | Not found in source | Use `AGENT_HARNESS_ENABLE_TOOL_LOOP` (the actual source key name) |
| `BILLING_CHECKOUT_ENABLED` | Not found in source | Use `BILLING_CHARGES_ENABLED` and `BILLING_SNAPSHOT_ENABLED` instead |

---

## Section 12 — Private `.env` Creation Instruction

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Keith must create the `.env` file privately on the VPS. Do not paste the `.env` contents into this chat or any AI tool.

### Step 1 — Navigate to repo root

```bash
cd /opt/aisandbox
```

### Step 2 — Generate required secrets on VPS (before editing `.env`)

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Run each of the following commands to generate secrets. These values stay on the VPS only — never paste them into chat:

```bash
# Generate JWT_SECRET (used by API Gateway and Container Manager — must be same)
openssl rand -hex 32

# Generate SESSION_SECRET (used by API Gateway)
openssl rand -hex 32

# Generate OAUTH_STATE_SECRET (used by API Gateway)
openssl rand -hex 32

# Generate INTERNAL_SERVICE_KEY (used by API Gateway, AI Service, Container Manager — must be same)
openssl rand -hex 32
```

Note: `POSTGRES_PASSWORD` and `REDIS_PASSWORD` were already set during EXECUTION-03. Use those same values in `DATABASE_URL` and `REDIS_URL`.

### Step 3 — Create the `.env` file with restricted permissions (empty)

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
install -m 600 /dev/null /opt/aisandbox/.env
sudo chown ubuntu:ubuntu /opt/aisandbox/.env
```

### Step 4 — Open and edit `.env` with nano

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
nano /opt/aisandbox/.env
```

Keith types all required key-value pairs directly in the nano editor. Refer to the key checklist in Section 11 for all required key names and their safe staging posture.

**Minimum required structure (key names only — Keith supplies all values privately):**

```
# Runtime
NODE_ENV=
LAUNCH_STATE=

# Ports
PORT=

# App URL
APP_BASE_URL=

# Database
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=

# Redis
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
REDIS_URL=

# Auth/Session
JWT_SECRET=
JWT_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=
SESSION_SECRET=
OAUTH_STATE_SECRET=
SESSION_TIMEOUT_MINUTES=
MAX_CONCURRENT_SESSIONS=

# Internal Service Auth
INTERNAL_SERVICE_KEY=

# Google OAuth — deferred for private beta staging
# Omit GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL for now.
# Do not use fake placeholder values.

# AI Provider (stub mode)
AI_PROVIDER=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Email (stub mode)
EMAIL_PROVIDER=

# Service URLs
API_GATEWAY_URL=

# Container Manager
DOCKER_HOST=
CONTAINER_CPU_LIMIT=
CONTAINER_MEMORY_LIMIT=
CONTAINER_DISK_LIMIT=

# Frontend
NEXT_PUBLIC_SHOW_DEV_TOOLS=
NEXT_PUBLIC_PROJECT_FIRST_UX=

# Kill Switches (all must be false)
GLOBAL_EXECUTION_ENABLED=
PROVIDER_OPENAI_ENABLED=
PROVIDER_ANTHROPIC_ENABLED=
PROVIDER_GROQ_ENABLED=
PROVIDER_XAI_ENABLED=
PROVIDER_DEEPSEEK_ENABLED=
BILLING_SNAPSHOT_ENABLED=
INVOICE_GENERATION_ENABLED=
PAYMENT_EXECUTION_ENABLED=
BILLING_CHARGES_ENABLED=
AGENT_HARNESS_ENABLE_TOOL_LOOP=
AGENT_HARNESS_ENABLE_WRITE_TOOLS=
AGENT_HARNESS_STUB_WRITE_MODE=

# Safety Limits
MAX_TOKENS_PER_EXECUTION=
MAX_EXECUTIONS_PER_MINUTE_GLOBAL=
MAX_DAILY_SPEND_SOFT_USD=
MAX_DAILY_SPEND_HARD_USD=
```

### Step 5 — Save and exit nano

Inside nano:
1. Press `Ctrl+O` — saves the file (nano asks to confirm filename)
2. Press `Enter` — confirms
3. Press `Ctrl+X` — exits nano

**Do NOT use `Ctrl+W` — it may close the browser tab in Lightsail browser SSH.**

---

## Section 13 — File Owner and Permission Instruction

**Run inside AWS Lightsail browser SSH — not PowerShell.**

After creating and saving `/opt/aisandbox/.env`:

```bash
# Set restrictive permissions (owner read/write only)
chmod 600 /opt/aisandbox/.env

# Set owner
sudo chown ubuntu:ubuntu /opt/aisandbox/.env
```

### Verify permissions and ownership

```bash
ls -l /opt/aisandbox/.env
stat -c "%U %G %a %n" /opt/aisandbox/.env
```

### Expected output

`ls -l` expected:
```
-rw------- 1 ubuntu ubuntu <size> <date> /opt/aisandbox/.env
```

`stat` expected:
```
ubuntu ubuntu 600 /opt/aisandbox/.env
```

If permissions are not `600` or owner is not `ubuntu ubuntu`, run the `chmod` and `chown` commands again and re-verify. If they cannot be corrected, stop and report.

---

## Section 14 — Safe Key-Presence Validation Without Printing Values

**Run inside AWS Lightsail browser SSH — not PowerShell.**

This script checks which key names are PRESENT or MISSING in `.env`. It **never prints values**.

```bash
python3 - <<'PY'
from pathlib import Path

env_path = Path("/opt/aisandbox/.env")

required_keys = [
    "NODE_ENV",
    "LAUNCH_STATE",
    "APP_BASE_URL",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "DATABASE_URL",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_PASSWORD",
    "REDIS_URL",
    "JWT_SECRET",
    "JWT_EXPIRES_IN",
    "JWT_REFRESH_EXPIRES_IN",
    "SESSION_SECRET",
    "OAUTH_STATE_SECRET",
    "SESSION_TIMEOUT_MINUTES",
    "MAX_CONCURRENT_SESSIONS",
    "INTERNAL_SERVICE_KEY",
    "AI_PROVIDER",
    "EMAIL_PROVIDER",
    "API_GATEWAY_URL",
    "DOCKER_HOST",
    "CONTAINER_CPU_LIMIT",
    "CONTAINER_MEMORY_LIMIT",
    "CONTAINER_DISK_LIMIT",
    "NEXT_PUBLIC_SHOW_DEV_TOOLS",
    "NEXT_PUBLIC_PROJECT_FIRST_UX",
    "GLOBAL_EXECUTION_ENABLED",
    "PROVIDER_OPENAI_ENABLED",
    "PROVIDER_ANTHROPIC_ENABLED",
    "PROVIDER_GROQ_ENABLED",
    "PROVIDER_XAI_ENABLED",
    "PROVIDER_DEEPSEEK_ENABLED",
    "BILLING_SNAPSHOT_ENABLED",
    "INVOICE_GENERATION_ENABLED",
    "PAYMENT_EXECUTION_ENABLED",
    "BILLING_CHARGES_ENABLED",
    "AGENT_HARNESS_ENABLE_TOOL_LOOP",
    "AGENT_HARNESS_ENABLE_WRITE_TOOLS",
    "AGENT_HARNESS_STUB_WRITE_MODE",
    "MAX_TOKENS_PER_EXECUTION",
    "MAX_EXECUTIONS_PER_MINUTE_GLOBAL",
    "MAX_DAILY_SPEND_SOFT_USD",
    "MAX_DAILY_SPEND_HARD_USD",
]

optional_keys = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "PORT",
    "ABORT_MODE",
    "ENABLE_PREVIEW_ACCESS_CONTROL",
    "SESSION_MAX_LIFETIME_MS",
    "SESSION_IDLE_TIMEOUT_MS",
    "CONTAINER_MEMORY_LIMIT_MB",
    "CONTAINER_PIDS_LIMIT",
    "MAX_CONCURRENT_EXECS_PER_SESSION",
    "EXECUTION_WORKER_CONCURRENCY",
    "EXECUTION_TIMEOUT_MS",
    "EXECUTION_STUCK_SCAN_INTERVAL_MS",
    "EXECUTION_PROVIDER_RETRY_ATTEMPTS",
    "EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS",
    "LOG_LEVEL",
]

deferred_keys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
]

if not env_path.exists():
    raise SystemExit("FAIL: /opt/aisandbox/.env is missing")

keys = {}
for line in env_path.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key = line.split("=", 1)[0].strip()
    keys[key] = True

print("=== REQUIRED key presence (names only — no values) ===")
missing_count = 0
for key in required_keys:
    status = "PRESENT" if key in keys else "MISSING"
    if status == "MISSING":
        missing_count += 1
    print(f"{key}: {status}")

print("")
print("=== OPTIONAL key presence (names only — no values) ===")
for key in optional_keys:
    status = "PRESENT" if key in keys else "not set (optional)"
    print(f"{key}: {status}")

print("")
print("=== DEFERRED key presence (names only — no values) ===")
for key in deferred_keys:
    if key in keys:
        print(f"{key}: PRESENT (unexpected for private beta staging — stop if fake placeholder values were used)")
    else:
        print(f"{key}: omitted intentionally for private beta staging")

print("")
if missing_count == 0:
    print(f"PASS: All {len(required_keys)} required keys present.")
else:
    print(f"FAIL: {missing_count} required key(s) MISSING — review and fix before proceeding.")
PY
```


### Validation Rules

| # | Rule |
|---|------|
| 1 | Script prints only `PRESENT` or `MISSING` followed by the **key name** |
| 2 | Script **never** prints key values |
| 3 | Script uses only line prefix matching — no value capture |
| 4 | Output is safe to paste into evidence report (key names only, no values) |
| 5 | If any required key is MISSING, fix before proceeding to evidence collection |

---

## Section 15 — Kill-Switch / Provider-Safety Posture

The following kill-switch keys must be set to `false` (or disabled equivalent) in `/opt/aisandbox/.env` before any app service is started in EXECUTION-04D.

**This section is a checklist for Keith to verify. Keith confirms posture by Yes/No only.**

### AI Execution Kill Switches — All must be `false`

| Key name | Required posture | Source location |
|----------|-----------------|-----------------|
| `GLOBAL_EXECUTION_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `PROVIDER_OPENAI_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `PROVIDER_ANTHROPIC_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `PROVIDER_GROQ_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `PROVIDER_XAI_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `PROVIDER_DEEPSEEK_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |

### Agent Harness Kill Switches — All must be `false`

| Key name | Required posture | Source location |
|----------|-----------------|-----------------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | `ai-service/src` (worker, env config) |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | `ai-service/src` (worker, env config) |
| `AGENT_HARNESS_STUB_WRITE_MODE` | `false` | `ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` |

### Billing / Payment Kill Switches — All must be `false`

| Key name | Required posture | Source location |
|----------|-----------------|-----------------|
| `BILLING_CHARGES_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `BILLING_SNAPSHOT_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `INVOICE_GENERATION_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |
| `PAYMENT_EXECUTION_ENABLED` | `false` | `api-gateway/src/safety/kill-switch.config.ts` |

### Not-Found Kill Switches (Not Required)

| Key name | Status |
|----------|--------|
| `PROVIDER_GOOGLE_ENABLED` | Not found in source — do not configure |
| `PROVIDER_OPENROUTER_ENABLED` | Not found in source — do not configure |
| `AGENT_HARNESS_ENABLED` | Not found in source — use `AGENT_HARNESS_ENABLE_TOOL_LOOP` |
| `AGENT_HARNESS_TOOL_LOOP_ENABLED` | Not found in source — use `AGENT_HARNESS_ENABLE_TOOL_LOOP` |
| `BILLING_CHECKOUT_ENABLED` | Not found in source — use `BILLING_CHARGES_ENABLED` |

### Safe Provider Key Posture

| AI provider key | Required posture for staging |
|-----------------|------------------------------|
| `ANTHROPIC_API_KEY` | Omit or non-secret placeholder (`not-used-stub-mode`) — no real key |
| `OPENAI_API_KEY` | Omit or non-secret placeholder (`not-used-stub-mode`) — no real key |
| `GROQ_API_KEY` | Omit — not configured for staging |
| `XAI_API_KEY` | Omit — not configured for staging |
| `DEEPSEEK_API_KEY` | Omit — not configured for staging |
| `CLAUDE_API_KEY` | Omit — not needed with `AI_PROVIDER=stub` |
| `RESEND_API_KEY` | Omit — not needed with `EMAIL_PROVIDER=stub` |

**Kill-switch safety summary:** With all execution, provider, agent harness, and billing kill switches set to `false` in `.env`, the staging server cannot accidentally execute paid AI provider calls, write to sandbox workspaces via agent tools, create billing snapshots, generate invoices, or execute payment operations — even after app services start in EXECUTION-04D.

---

## Section 16 — Confirm No Dependency Install

**Run inside AWS Lightsail browser SSH — not PowerShell.**

After `.env` creation, confirm no dependencies were inadvertently installed:

```bash
# Check for node_modules in key locations
ls /opt/aisandbox/node_modules 2>/dev/null && echo "WARNING: root node_modules exists" || echo "No root node_modules — OK"
ls /opt/aisandbox/services/api-gateway/node_modules 2>/dev/null && echo "WARNING: api-gateway node_modules exists" || echo "No api-gateway node_modules — OK"
ls /opt/aisandbox/services/ai-service/node_modules 2>/dev/null && echo "WARNING: ai-service node_modules exists" || echo "No ai-service node_modules — OK"
ls /opt/aisandbox/services/container-manager/node_modules 2>/dev/null && echo "WARNING: container-manager node_modules exists" || echo "No container-manager node_modules — OK"
ls /opt/aisandbox/frontend/node_modules 2>/dev/null && echo "WARNING: frontend node_modules exists" || echo "No frontend node_modules — OK"
```

All five checks must output `No ... node_modules — OK`. If any `node_modules` directory appears, stop and report.

---

## Section 17 — Confirm No Build

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
# Check for build artifacts
ls /opt/aisandbox/services/api-gateway/dist 2>/dev/null && echo "WARNING: api-gateway dist exists" || echo "No api-gateway dist — OK"
ls /opt/aisandbox/services/ai-service/dist 2>/dev/null && echo "WARNING: ai-service dist exists" || echo "No ai-service dist — OK"
ls /opt/aisandbox/services/container-manager/dist 2>/dev/null && echo "WARNING: container-manager dist exists" || echo "No container-manager dist — OK"
ls /opt/aisandbox/frontend/.next 2>/dev/null && echo "WARNING: frontend .next exists" || echo "No frontend .next — OK"
```

All four checks must output `No ... — OK`. If any build artifact appears, stop and report.

---

## Section 18 — Confirm No App Services

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
# PM2 process list — must be empty (no app processes)
pm2 list

# Check for any app systemd services
systemctl is-active aisandbox 2>/dev/null || echo "No aisandbox systemd service — OK"
systemctl is-active api-gateway 2>/dev/null || echo "No api-gateway systemd service — OK"
```

Expected: `pm2 list` shows no processes. No app systemd services active.

---

## Section 19 — Confirm No Migrations

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
# Check database table count — must remain 0
psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

Expected: `count = 0` (no tables in public schema).

Do not run any migration commands. Do not run `typeorm migration:run`, `prisma migrate deploy`, or any schema modification command. Migrations belong to a separate explicitly registered task.

---

## Section 20 — Confirm No DNS/TLS

DNS and TLS are non-goals for this child slice and all EXECUTION-04 child slices.

| Non-goal check | Expected state |
|----------------|----------------|
| No DNS A record for `staging.ainow.biz` | Not configured |
| No Caddy site config for `staging.ainow.biz` | Not configured |
| No TLS certificate requested | Not requested |
| No Lightsail firewall modification | Unchanged (22/80/443 only) |

Keith confirms these non-goals by answering Yes in the evidence template (Section 21).

---

## Section 21 — Safe Evidence Template

After completing all sections, Keith pastes only the following safe evidence into this chat.

**Do NOT paste `.env` contents, DATABASE_URL, REDIS_URL, DB password, Redis password, provider keys, tokens, private keys, OAuth secrets, JWT secrets, session secrets, INTERNAL_SERVICE_KEY, static IP, or any credential.**

---

```
PRIVATE-BETA-STAGING-EXECUTION-04B — Evidence Report

Date:
Instance: aisandbox-staging

Pre-env snapshot created: [Yes/No]
Pre-env snapshot name: [paste name only]
Pre-env snapshot status: [Available/Pending/Other]

Repo path /opt/aisandbox exists: [Yes/No]
Repo owner ubuntu:ubuntu unchanged from 04A: [Yes/No]
Repo branch main unchanged from 04A: [Yes/No]
Repo commit c55a278 unchanged from 04A: [Yes/No]
Git status clean before .env creation: [Yes/No]
No .env existed before creation: [Yes/No]

/opt/aisandbox/.env created privately: [Yes/No]
.env owner ubuntu:ubuntu: [Yes/No]
.env chmod 600: [Yes/No]
.env stat output (paste stat line only — key names, permissions, owner — no values):
[paste output of: stat -c "%U %G %a %n" /opt/aisandbox/.env]

Required key presence check (paste PRESENT/MISSING lines only — no values):
[paste output of python3 presence check script from Section 14]

DATABASE_URL configured privately (key present, value not disclosed): [Yes/No]
REDIS_URL configured privately (key present, value not disclosed): [Yes/No]
JWT_SECRET configured privately (key present, value not disclosed): [Yes/No]
SESSION_SECRET configured privately (key present, value not disclosed): [Yes/No]
OAUTH_STATE_SECRET configured privately (key present, value not disclosed): [Yes/No]
INTERNAL_SERVICE_KEY configured privately (key present, value not disclosed): [Yes/No]
Google OAuth deferred for private beta staging: [Yes/No]
GOOGLE_CLIENT_ID omitted intentionally: [Yes/No]
GOOGLE_CLIENT_SECRET omitted intentionally: [Yes/No]
GOOGLE_CALLBACK_URL omitted intentionally: [Yes/No]
No fake Google OAuth placeholder values used: [Yes/No]
Email/password login remains intended staging auth path: [Yes/No]

Kill-switch/provider-safety posture set safely (all false/disabled): [Yes/No]
GLOBAL_EXECUTION_ENABLED set to false: [Yes/No]
PROVIDER_OPENAI_ENABLED set to false: [Yes/No]
PROVIDER_ANTHROPIC_ENABLED set to false: [Yes/No]
PROVIDER_GROQ_ENABLED set to false: [Yes/No]
PROVIDER_XAI_ENABLED set to false: [Yes/No]
PROVIDER_DEEPSEEK_ENABLED set to false: [Yes/No]
BILLING_CHARGES_ENABLED set to false: [Yes/No]
BILLING_SNAPSHOT_ENABLED set to false: [Yes/No]
INVOICE_GENERATION_ENABLED set to false: [Yes/No]
PAYMENT_EXECUTION_ENABLED set to false: [Yes/No]
AGENT_HARNESS_ENABLE_TOOL_LOOP set to false: [Yes/No]
AGENT_HARNESS_ENABLE_WRITE_TOOLS set to false: [Yes/No]
AGENT_HARNESS_STUB_WRITE_MODE set to false: [Yes/No]

No dependency install (no node_modules): [Yes/No]
No build (no dist or .next): [Yes/No]
No app services started (pm2 list empty): [Yes/No]
No migrations run, database table count = 0: [Yes/No]
No DNS/TLS configured: [Yes/No]
No secrets disclosed: [Yes/No]

Warnings or unexpected outputs:
[Paste any unexpected output here, or write "None"]

Stop conditions triggered:
[List any stop conditions triggered, or write "None"]
```

---

## Section 22 — Stop Conditions

Stop immediately and report if any of the following occur:

| # | Stop condition |
|---|---------------|
| 1 | `/opt/aisandbox` is missing or not accessible |
| 2 | Repo owner is not `ubuntu:ubuntu` |
| 3 | Repo is not on branch `main` |
| 4 | Repo latest commit is not `c55a278` |
| 5 | Git status is not clean before `.env` creation |
| 6 | An unexpected `.env` file already exists before Section 12 |
| 7 | Required env key names cannot be identified enough to complete the checklist |
| 8 | Keith does not have a required secret value (DB password, Redis password, JWT/session/OAuth-state/internal-service secrets, or any actually required secret) — missing Google OAuth credentials is NOT a stop condition (Google OAuth is deferred) |
| 9 | Any command would print `.env` file contents |
| 10 | Any command would print `DATABASE_URL` or `REDIS_URL` with values |
| 11 | Any command would print a password, token, key, or secret |
| 12 | `.env` would need to be pasted into AI chat at any point |
| 13 | `.env` permissions cannot be set to `600` |
| 14 | `.env` ownership cannot be set to `ubuntu:ubuntu` |
| 15 | Key presence check reports any REQUIRED key as MISSING after creation |
| 16 | Any kill switch cannot be confirmed as `false` |
| 17 | `npm install`, `npm ci`, or any dependency install command begins |
| 18 | Any build command begins (`npm run build`, `tsc`, `next build`) |
| 19 | Any PM2 `start` command for an app process is run |
| 20 | Any migration command appears (`typeorm migration:run`, `prisma migrate deploy`, etc.) |
| 21 | Database table count is not 0 after `.env` creation |
| 22 | Any DNS configuration command appears |
| 23 | Any TLS or Caddy certificate command appears |
| 24 | Any billing, payment, AI execution, or container execution enablement occurs |
| 25 | Any secret is accidentally disclosed or pasted into chat |
| 26 | Pre-env snapshot does not reach Available status before `.env` creation begins |
| 27 | `node_modules` directory appears in any service directory |
| 28 | `dist/` or `.next/` build artifact appears |
| 29 | Fake Google OAuth placeholder values are used for `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_CALLBACK_URL` |
| 30 | Google OAuth keys are accidentally added with fake placeholder values |

---

## Section 23 — Expected Final State After 04B Execution

When this child slice completes correctly, the staging server state will be:

| Item | State |
|------|-------|
| Repo path | `/opt/aisandbox` — unchanged — owner `ubuntu:ubuntu` |
| Branch | `main` |
| Latest commit | `c55a278` |
| Git status | Clean / empty |
| `/opt/aisandbox/.env` | Exists — owner `ubuntu:ubuntu` — permissions `600` |
| `.env` key names | All required keys present (PRESENT in validation) |
| Google OAuth | Deferred — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` omitted intentionally — no fake placeholders used |
| Staging auth path | Email/password login remains the intended staging auth path |
| Kill switches | All set to `false` / disabled |
| Provider keys | None (omitted or non-secret placeholder only) |
| Billing keys | None (omitted) |
| Dependencies | No `node_modules` anywhere |
| Build artifacts | No `dist/` or `.next/` anywhere |
| App services | PM2 empty — no app processes |
| Database | PostgreSQL active — local-only — table count = 0 — no migrations |
| Redis | Active — local-only — `requirepass` configured |
| DNS/TLS | Not configured |
| Snapshots | 5 snapshots Available (4 from 04A + 1 new pre-env) |
| Secrets disclosed | None |
| Source code | Unchanged |
| Governance files | Unchanged |

EXECUTION-04B manual execution is complete. The staging server is ready to proceed to EXECUTION-04C (Dependency Install + Build).

---

## Section 24 — Exact Next Action

After Keith completes manual execution per this runbook and submits the evidence report:

**Step 3:** Keith submits safe evidence from the 04B manual execution session using the template in Section 21.

**Step 4** (after evidence review): EXECUTION-04B consolidation/checkpoint — governance updates — EXECUTION-04B marked COMPLETE and LOCKED.

**Next child slice after 04B:** PRIVATE-BETA-STAGING-EXECUTION-04C — Dependency Install + Build (PENDING registration — requires Keith explicit approval).

Do NOT install dependencies. Do NOT build. Do NOT start app services. Do NOT run migrations. Do NOT configure DNS/TLS. Stop after submitting evidence.

---

**Runbook created:** 2026-07-26
**Task:** PRIVATE-BETA-STAGING-EXECUTION-04B — Step 2
**Nature:** Runbook only — no server action performed — no source files changed — no governance files changed — no env files opened/created/edited by Cursor — no env values opened/printed — no AWS/SSH/DNS/TLS action occurred — no Docker/PostgreSQL/Redis action occurred locally — no git commit or push — no subagents used.
