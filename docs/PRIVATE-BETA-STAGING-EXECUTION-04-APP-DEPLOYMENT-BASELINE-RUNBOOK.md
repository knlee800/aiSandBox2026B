# PRIVATE-BETA-STAGING-EXECUTION-04 — App Deployment Baseline Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04
**Title:** Repo Clone + Private Env Preparation + App Deployment Baseline
**Step:** 2 — Repo Clone + Private Env + App Deployment Baseline Runbook
**Date created:** 2026-07-25
**Nature:** Runbook only — no server action — designed for Keith manual execution inside AWS Lightsail browser SSH.

---

## Section 1 — Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Title | Repo Clone + Private Env Preparation + App Deployment Baseline |
| Step | 2 — Runbook (this document) |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | HIGH-RISK — real server commands; credential handling; app layer first contact |
| Registered | 2026-07-25 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| OS | Ubuntu 24.04.4 LTS / noble |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |

---

## Section 2 — Purpose

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the EXECUTION-04 manual execution step. It covers the Redis 8.8.0 compatibility gate, baseline verification, repo clone, private env preparation, dependency installation, build, PM2 service startup, and health-only smoke checks.

This runbook is the authoritative reference for that manual execution session. Follow it section by section without skipping.

---

## Section 3 — What This Step Does

This step, when executed by Keith:

1. Verifies Redis 8.8.0 compatibility gate before any app service starts.
2. Verifies all three snapshots are Available.
3. Verifies the runtime, PostgreSQL, and Redis baselines remain intact.
4. Clones the repo to `/opt/aisandbox` with correct ownership.
5. Installs npm dependencies for all services.
6. Prepares the private app `.env` on the VPS only.
7. Builds all services.
8. Starts app services under PM2 with health-only startup posture.
9. Runs health-only endpoint checks.
10. Confirms no migrations, DNS, TLS, or real AI/container/billing execution.

---

## Section 4 — What This Step Does Not Do

This step does not:

- Run database migrations.
- Configure DNS or TLS.
- Configure Caddy reverse proxy or site config.
- Enable real AI execution (AI providers remain disabled).
- Enable real container execution.
- Enable billing, payment, or Stripe execution.
- Expose any internal port publicly.
- Modify source code.
- Commit or push git.
- Open or read `.env` in any AI chat.
- Paste DATABASE_URL, REDIS_URL, passwords, or provider keys into any AI chat.

---

## Section 5 — Cost / Safety Note

**No billing execution.** All AI provider kill-switches must remain `false`. All billing/payment kill-switches must remain `false`. Health-only endpoint calls are allowed. Do not call `/api/ai/execute`, container execution endpoints, or billing endpoints during this step.

**Credential safety.** Keith keeps all secrets privately on the VPS. Do not paste any secret value into ChatGPT, Cursor, or any chat tool.

**High-risk step.** If any stop condition triggers, stop immediately, report, and await a new plan before proceeding.

---

## Section 6 — Preconditions

Before starting manual execution, confirm all of the following:

| # | Precondition | Required state |
|---|-------------|----------------|
| 1 | EXECUTION-03 | COMPLETE and LOCKED — 2026-07-24 |
| 2 | EXECUTION-04 Step 1 (Registration) | COMPLETE — 2026-07-25 |
| 3 | EXECUTION-04 Step 2 (this runbook) | Read and understood by Keith |
| 4 | Snapshot `aisandbox-staging-baseline-2026-07-23` | Available |
| 5 | Snapshot `aisandbox-staging-runtime-2026-07-24` | Available |
| 6 | Snapshot `aisandbox-staging-db-redis-2026-07-24` | Available |
| 7 | Redis 8.8.0 compatibility gate | Must pass before app service start |
| 8 | DB password | Keith holds privately |
| 9 | Redis password | Keith holds privately |
| 10 | Git repo access | Keith can clone from GitHub |
| 11 | GitHub credentials / SSH key or token | Available on VPS (or Keith will configure) |
| 12 | All kill-switches will be set to `false` in `.env` | Keith confirms intent |

If any precondition is not met, stop and resolve before proceeding.

---

## Section 7 — Lightsail Browser SSH Instruction

**All server commands in this runbook must be run inside the AWS Lightsail browser SSH console.**

To open the Lightsail browser SSH console:

1. Log into AWS Console → Lightsail.
2. Select the `aisandbox-staging` instance.
3. Click **Connect using SSH** (or the terminal icon).
4. The browser SSH console opens.
5. Run all commands in that console.

**Do not run server commands in PowerShell, CMD, or local terminal.**

Default user is `ubuntu`. Commands requiring root use `sudo`.

---

## Section 8 — Mandatory Redis 8.8.0 Compatibility Gate

**THIS IS THE FIRST GATE. No app service may be started before this gate passes.**

EXECUTION-03 installed Redis 8.8.0. The target was Redis 7.x. A compatibility guardrail was formally recorded in the EXECUTION-03 checkpoint (docs/PRIVATE-BETA-STAGING-EXECUTION-03-DB-REDIS-CHECKPOINT.md, Section 14).

Before any app service starts, Keith must confirm one of the following outcomes:

### Gate Outcome A — Accepted

> Redis 8.8.0 compatibility accepted for staging baseline after static dependency/source review and safe connection behavior review. App service startup is permitted.

### Gate Outcome B — Blocked

> Redis 8.8.0 compatibility cannot be confirmed. App startup is blocked. A separate bounded Redis pin/downgrade task must be registered before proceeding.

**No app service may be started before this gate passes.**

The static review in Section 9 informs this gate decision. Keith reads Section 9, reviews the evidence, and makes the gate decision explicitly before continuing to Section 11.

---

## Section 9 — Static Redis Compatibility Review (From Repo Files)

This review was performed against local repository source files on 2026-07-25. No services were run. No Redis connection was made. This is a static analysis only.

### 9A — Redis Client Libraries Found

| Service | Library | Version (package.json) |
|---------|---------|------------------------|
| `services/ai-service` | `ioredis` | `^5.3.2` |
| `services/ai-service` | `bullmq` | `^5.70.1` |
| `services/api-gateway` | `ioredis` | `^5.9.3` |
| `services/api-gateway` | `bullmq` | `^5.70.1` |
| `services/container-manager` | (none) | No Redis dependency |
| `frontend` | (none) | No Redis dependency |

### 9B — ioredis Usage

**ioredis is used.** Both `ai-service` and `api-gateway` import `ioredis` directly.

All connections are constructed via `new Redis(redisUrl, { maxRetriesPerRequest: null })` where `REDIS_URL` is loaded from the environment. The `maxRetriesPerRequest: null` option is required by BullMQ and is a valid ioredis v5 option.

### 9C — BullMQ Usage

**BullMQ is used.** Both `ai-service` and `api-gateway` use `bullmq`.

- `api-gateway/src/queue/queue.service.ts`: Instantiates a BullMQ `Queue` named `ai-execution`. Adds jobs with `attempts: 1, removeOnComplete: true, removeOnFail: false`.
- `ai-service/src/queue/queue.service.ts`: Instantiates BullMQ `Queue`. Creates named queues.
- `ai-service/src/worker/worker.processor.ts`: Instantiates BullMQ `Worker`, `QueueEvents`.
- `ai-service/src/observability/queue-metrics-updater.ts`: Uses BullMQ `Queue.getJobCounts()` for metrics.

BullMQ v5.x requires Redis 7.0+ (for `LMPOP` and other Redis 7 commands). Redis 8.8.0 fully supports all Redis 7 commands including `LMPOP`. **No blocking incompatibility identified.**

### 9D — Bull (Legacy) Usage

**Bull (legacy) is NOT used.** Only `bullmq` (v5) is present. No `bull` package found.

### 9E — Services Using Redis

| Service | Redis use |
|---------|-----------|
| `api-gateway` | Queue producer (BullMQ) + pub/sub subscriber (ioredis) |
| `ai-service` | Queue consumer/worker (BullMQ) + pub/sub publisher (ioredis) |
| `container-manager` | No Redis usage |
| `frontend` | No Redis usage |

### 9F — Redis Commands Used

| Command / Operation | Where |
|--------------------|-------|
| `new Redis(url)` — connect + AUTH via URL | All Redis-using services |
| `publish(channel, payload)` | `ai-service` execution-stream.publisher, `api-gateway` execution-stream.service |
| `subscribe(channel)` | `api-gateway` execution-stream.service |
| `unsubscribe(channel)` | `api-gateway` execution-stream.service |
| `quit()` | All Redis-using services (on module destroy) |
| BullMQ queue operations | Abstracted via BullMQ (LPUSH, ZADD, LMPOP, etc.) |
| BullMQ `getJobCounts('waiting','active','completed','failed')` | `ai-service` queue-metrics-updater |

All commands are standard Redis commands available in Redis 4.x through 8.x.

### 9G — Redis-Version-Gated Feature Usage

| Feature | Present? | Notes |
|---------|---------|-------|
| RESP3 protocol (Redis 6+) | Not detected | ioredis v5 uses RESP2 by default |
| LMPOP (Redis 7.0+) | Used internally by BullMQ v5 | Redis 8.8.0 fully supports LMPOP |
| Redis Streams / XADD | Not detected in source | Not used |
| ACL commands | Not detected | Not used |
| Redis modules | Not detected | Not used |
| Cluster mode | Not detected | Single-node standalone mode |
| Deprecated removed commands | None detected | No use of HMSET (removed in 4.0), GEORADIUSBYMEMBER (deprecated in 6.2), etc. |

### 9H — Compatibility Assessment

| Dimension | Finding | Assessment |
|-----------|---------|-----------|
| ioredis v5.3.2 / v5.9.3 with Redis 8.8.0 | ioredis v5 is known compatible with Redis 7.x and 8.x via RESP2 | LIKELY COMPATIBLE |
| BullMQ v5.70.1 with Redis 8.8.0 | BullMQ v5 requires Redis 7.0+; Redis 8.x is fully backward compatible with Redis 7 commands | LIKELY COMPATIBLE |
| pub/sub commands | PUBLISH / SUBSCRIBE / UNSUBSCRIBE unchanged since Redis 2.x | LIKELY COMPATIBLE |
| Basic queue operations | Standard Redis data structure commands | LIKELY COMPATIBLE |
| maxRetriesPerRequest: null | Valid ioredis v5 option; works with Redis 8 | LIKELY COMPATIBLE |

**Overall static assessment: LIKELY COMPATIBLE**

No Redis-version-gated, deprecated, or removed features are detected in the source or dependency manifests. ioredis v5 and BullMQ v5 are both compatible with Redis 8.x.

### 9I — Guardrail

App startup is allowed only if the compatibility assessment is **LIKELY COMPATIBLE** or explicitly accepted for staging.

If any source/static review finds Redis-version-gated usage that may not work on Redis 8.8.0: stop before app startup and register a Redis 7.x pin/downgrade task.

**Static review finding: LIKELY COMPATIBLE. No blocking issues detected.**

---

## Section 10 — Decision: Continue or Stop Before App Startup

Keith reads Sections 8 and 9 and makes an explicit gate decision.

**If Gate Outcome A (accepted):**

> Proceed to Section 11 (Snapshot Verification).

**If Gate Outcome B (blocked):**

> Stop. Do not clone repo. Do not install dependencies. Do not create `.env`. Do not start any app service.
> Register a new bounded task: Redis 7.x pin/downgrade on staging.
> Do not continue this runbook until Redis compatibility is resolved.

---

## Section 11 — Snapshot Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Verify all three snapshots in the Lightsail console UI (not via command line, since snapshot listing is a console operation).

Expected state:

| Snapshot | Expected status |
|----------|----------------|
| `aisandbox-staging-baseline-2026-07-23` | Available |
| `aisandbox-staging-runtime-2026-07-24` | Available |
| `aisandbox-staging-db-redis-2026-07-24` | Available |

If any snapshot is not Available, stop and report before proceeding.

Before starting the manual session, Keith should also create a new pre-app-deployment snapshot via the Lightsail console:

- Name: `aisandbox-staging-preapp-2026-07-25` (use today's date)
- This snapshot captures the server state immediately before repo clone and app setup.
- Wait for it to reach **Available** status before starting Section 12.

---

## Section 12 — Runtime Baseline Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Confirm the runtime baseline from EXECUTION-02 and EXECUTION-03 remains intact.

```bash
uname -a
lsb_release -a
node --version
npm --version
docker --version
docker compose version
pm2 --version
caddy version
```

Expected results:

| Component | Expected |
|-----------|----------|
| OS | Ubuntu 24.04.4 LTS / noble |
| Node.js | v20.20.2 |
| npm | 10.8.2 |
| Docker Engine | 29.6.2 |
| Docker Compose | v5.3.1 |
| PM2 | 7.0.3 |
| Caddy | v2.11.4 |

If any component is missing or shows an unexpected version, stop and report.

---

## Section 13 — PostgreSQL Baseline Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
pg_lsclusters
sudo systemctl status postgresql@15-main
ss -tlnp | grep 5432
```

Expected results:

| Check | Expected |
|-------|----------|
| Cluster version | 15 / main / port 5432 / online |
| postgresql@15-main.service | active (running) |
| Port 5432 binding | 127.0.0.1:5432 only |

Do not connect to the database. Do not run psql. Do not view or print any database user password.

If PostgreSQL is not active or port 5432 is externally bound, stop and report.

---

## Section 14 — Redis Baseline Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
redis-server --version
sudo systemctl status redis-server
ss -tlnp | grep 6379
```

Verify the redis.conf settings (read-only, no value printing):

```bash
sudo grep -E "^bind|^protected-mode|^requirepass" /etc/redis/redis.conf
```

Expected results:

| Check | Expected |
|-------|----------|
| Redis version | 8.8.0 |
| redis-server.service | active (running) |
| Port 6379 binding | 127.0.0.1:6379 and [::1]:6379 only |
| bind directive | `bind 127.0.0.1 -::1` |
| protected-mode | `protected-mode yes` |
| requirepass | `requirepass [some value — do not print or record the value]` |

Do not print the Redis password. Do not run an authenticated ping that would reveal the password in terminal history. Do not include `AUTH <password>` in any command you paste into chat.

If Redis is not active, or if port 6379 is bound to 0.0.0.0, stop and report.

---

## Section 15 — Repo Clone Path and Ownership

The application repository will be cloned to `/opt/aisandbox`.

| Parameter | Value |
|-----------|-------|
| Clone path | `/opt/aisandbox` |
| Owner | `ubuntu:ubuntu` |
| Permissions | Directory: `755` (default) |
| Git-tracked `.env` | NEVER — `.env` must never be committed |

If `/opt/aisandbox` already exists from a previous attempt, verify its state before proceeding. Do not overwrite without checking.

---

## Section 16 — Repo Clone Instructions

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### 16A — Prepare directory

```bash
sudo mkdir -p /opt/aisandbox
sudo chown ubuntu:ubuntu /opt/aisandbox
ls -la /opt/
```

### 16B — Configure git identity (if not already configured)

```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Keith"
```

Replace with Keith's actual name and email.

### 16C — Clone the repository

Replace `<your-github-repo-url>` with the actual repo URL (HTTPS or SSH).

**HTTPS clone (requires token or password):**

```bash
git clone https://github.com/<org>/<repo>.git /opt/aisandbox
```

**SSH clone (requires SSH key configured on VPS):**

```bash
git clone git@github.com:<org>/<repo>.git /opt/aisandbox
```

Use whichever authentication method is available on the VPS. Keith should have configured a GitHub personal access token or SSH key before this step.

### 16D — Verify clone

```bash
ls -la /opt/aisandbox
git -C /opt/aisandbox log --oneline -5
git -C /opt/aisandbox branch -a
```

Expected: repo directory exists, git log shows recent commits, branch is main or equivalent.

### 16E — Check out the correct branch

If the staging deployment branch differs from main, check it out:

```bash
git -C /opt/aisandbox checkout <branch-name>
```

If main is the correct branch, no checkout needed.

Stop conditions for this section:
- Clone fails (authentication error, network error, repo not found).
- Clone path differs unexpectedly.
- git log shows no commits or unexpected state.

---

## Section 17 — Dependency Installation Strategy

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Install npm dependencies for each service and the frontend. Use `npm ci` (clean install from lockfile) for production-like installs. If `package-lock.json` is present, `npm ci` is preferred. Fall back to `npm install` if `npm ci` fails due to lockfile state.

### Install order

```bash
# Root (if root package.json exists)
cd /opt/aisandbox
npm ci

# API Gateway
cd /opt/aisandbox/services/api-gateway
npm ci

# AI Service
cd /opt/aisandbox/services/ai-service
npm ci

# Container Manager
cd /opt/aisandbox/services/container-manager
npm ci

# Frontend
cd /opt/aisandbox/frontend
npm ci
```

After each `npm ci`, verify it completes without error. If a service fails, stop and report before continuing.

**Do not run builds yet.** Dependency installation only.

Stop conditions for this section:
- Any `npm ci` or `npm install` fails.
- Missing lockfile causes install to fail.
- Node.js version incompatibility is reported.

---

## Section 18 — Private App `.env` Preparation

**This section must be performed by Keith privately on the VPS only. Do not paste any value into AI chat.**

### 18A — Strategy

The app `.env` is created and held privately by Keith on the VPS. It is never committed to git, never opened in Cursor, and never pasted into any AI chat.

Primary `.env` location: `/opt/aisandbox/.env`

If services cannot load from root `.env` due to PM2 working directory or dotenv path issues, per-service `.env` files may be used instead:

- `/opt/aisandbox/services/api-gateway/.env`
- `/opt/aisandbox/services/ai-service/.env`
- `/opt/aisandbox/services/container-manager/.env`
- `/opt/aisandbox/frontend/.env.local`

All `.env` files: `chmod 600`, owned `ubuntu:ubuntu`, never committed.

### 18B — Create the `.env` file

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
nano /opt/aisandbox/.env
```

Or use `vim` if preferred. Keith fills in all required values (see Section 19). Save and exit.

```bash
chmod 600 /opt/aisandbox/.env
ls -la /opt/aisandbox/.env
```

Expected: `-rw------- 1 ubuntu ubuntu ... /opt/aisandbox/.env`

**Do not `cat` the file. Do not `echo` the file contents. Do not print any value.**

---

## Section 19 — Required App Env Key Checklist (Names Only — No Values)

Keith privately sets all values. This checklist provides key names only. Do not include values.

### 19A — Global / Shared Keys

| Key | Notes |
|-----|-------|
| `NODE_ENV` | Set to `production` |
| `LAUNCH_STATE` | Set to `INTERNAL` for private beta |
| `INTERNAL_SERVICE_KEY` | Keith must configure — shared across all services |
| `APP_BASE_URL` | `https://staging.ainow.biz` |
| `ABORT_MODE` | Optional (default: `NONE`) |

### 19B — Database Keys

| Key | Notes |
|-----|-------|
| `DATABASE_URL` | Keith must configure privately — includes host/user/password/db |
| `POSTGRES_HOST` | `localhost` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_USER` | `aisandbox` |
| `POSTGRES_PASSWORD` | Keith holds privately |
| `POSTGRES_DB` | `aisandbox` |

### 19C — Redis Keys

| Key | Notes |
|-----|-------|
| `REDIS_URL` | Keith must configure privately — includes host/port/password |
| `REDIS_HOST` | `localhost` |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | Keith holds privately |

### 19D — Auth / Session Keys

| Key | Notes |
|-----|-------|
| `JWT_SECRET` | Keith must configure — strong random value |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `SESSION_SECRET` | Keith must configure — strong random value |
| `OAUTH_STATE_SECRET` | Keith must configure — strong random value |
| `SESSION_TIMEOUT_MINUTES` | `120` |
| `MAX_CONCURRENT_SESSIONS` | `8` |

### 19E — Google OAuth Keys

| Key | Notes |
|-----|-------|
| `GOOGLE_CLIENT_ID` | Keith must configure |
| `GOOGLE_CLIENT_SECRET` | Keith must configure |
| `GOOGLE_CALLBACK_URL` | `https://staging.ainow.biz/api/auth/google/callback` |

Apple OAuth keys (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CALLBACK_URL`) are **disabled for staging** — omit or leave as empty placeholder.

### 19F — AI Provider Keys (Conditional)

| Key | Notes |
|-----|-------|
| `AI_PROVIDER` | `stub` for staging baseline |
| `ANTHROPIC_API_KEY` | Conditional — startup validator may require non-empty even with stub. If so, Keith sets a placeholder. Do not enable real execution. |
| `OPENAI_API_KEY` | Same as above — conditional placeholder only |

### 19G — Kill-Switch Keys (All Must Be `false`)

| Key | Required value |
|-----|---------------|
| `GLOBAL_EXECUTION_ENABLED` | `false` |
| `PROVIDER_OPENAI_ENABLED` | `false` |
| `PROVIDER_ANTHROPIC_ENABLED` | `false` |
| `PROVIDER_GROQ_ENABLED` | `false` |
| `PROVIDER_XAI_ENABLED` | `false` |
| `PROVIDER_DEEPSEEK_ENABLED` | `false` |
| `BILLING_SNAPSHOT_ENABLED` | `false` |
| `PAYMENT_EXECUTION_ENABLED` | `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` |
| `AGENT_HARNESS_STUB_WRITE_MODE` | `false` |

**All kill-switch keys must be explicitly set to `false`. Do not omit them — fail-safe defaults require explicit opt-in.**

### 19H — Safety Limits

| Key | Notes |
|-----|-------|
| `MAX_TOKENS_PER_EXECUTION` | `100000` (default) |
| `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | `10000` (default) |
| `MAX_DAILY_SPEND_SOFT_USD` | `10000` (default) |
| `MAX_DAILY_SPEND_HARD_USD` | `20000` (default) |

### 19I — Email Provider (Disabled for Staging)

| Key | Notes |
|-----|-------|
| `EMAIL_PROVIDER` | `stub` |
| `RESEND_API_KEY` | Disabled for staging — omit |
| `AUTH_EMAIL_FROM` | Disabled for staging — omit |
| `AUTH_EMAIL_REPLY_TO` | Disabled for staging — omit |

### 19J — Service Ports

| Key | Value |
|-----|-------|
| `PORT` (frontend) | `3002` |
| `PORT` (api-gateway) | `4000` |
| `PORT` (ai-service) | `4001` |
| `PORT` (container-manager) | `4002` |

### 19K — Service URLs

| Key | Value |
|-----|-------|
| `API_GATEWAY_URL` | `http://localhost:4000` |

### 19L — Container Manager Keys

| Key | Notes |
|-----|-------|
| `DOCKER_HOST` | `unix:///var/run/docker.sock` |
| `CONTAINER_CPU_LIMIT` | `0.5` |
| `CONTAINER_MEMORY_LIMIT` | `1g` |
| `CONTAINER_DISK_LIMIT` | `3g` |

### 19M — Frontend Public Keys

| Key | Notes |
|-----|-------|
| `NEXT_PUBLIC_PROJECT_FIRST_UX` | Required — Keith sets appropriate value |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | `false` on staging |

### 19N — Logging / Monitoring

| Key | Notes |
|-----|-------|
| `LOG_LEVEL` | Optional — `info` or `warn` for staging |

### 19O — Verification After Creating `.env`

After saving, verify file exists and has correct permissions. Do not print contents.

```bash
ls -la /opt/aisandbox/.env
```

**Do not paste `.env` contents back. Evidence only says: configured privately: Yes/No.**

---

## Section 20 — Secret Handling Rules

These rules are mandatory during this execution step and must not be violated.

| Rule | Instruction |
|------|-------------|
| DB password | Keith holds privately — never paste into chat |
| Redis password | Keith holds privately — never paste into chat |
| DATABASE_URL | Keith configures privately on VPS — never paste into chat |
| REDIS_URL | Keith configures privately on VPS — never paste into chat |
| JWT_SECRET | Keith generates and holds privately |
| SESSION_SECRET | Keith generates and holds privately |
| OAUTH_STATE_SECRET | Keith generates and holds privately |
| INTERNAL_SERVICE_KEY | Keith generates and holds privately |
| GOOGLE_CLIENT_SECRET | Keith holds privately |
| AI provider API keys | Disabled for staging baseline — if placeholder needed, Keith sets privately |
| `.env` file contents | Never opened, never cat'd, never printed in chat |
| Terminal history | Do not run commands that embed passwords in shell arguments |
| Evidence | Evidence reports only Yes/No — no values |

### Secret generation (VPS-side only)

If Keith needs to generate random secret values for JWT_SECRET, SESSION_SECRET, or OAUTH_STATE_SECRET, run this on the VPS only. Do not paste the output into chat:

```bash
# Run on VPS — do not paste output into chat
openssl rand -base64 64
```

Run separately for each secret. Copy each value directly into the `.env` file.

---

## Section 21 — Kill-Switch and Provider-Safety Posture

The following kill-switch posture must be maintained throughout this execution step and after service startup.

| Kill-switch | Required value | Enforcement |
|-------------|----------------|-------------|
| `GLOBAL_EXECUTION_ENABLED` | `false` | No AI execution regardless of provider state |
| `PROVIDER_OPENAI_ENABLED` | `false` | No OpenAI API calls |
| `PROVIDER_ANTHROPIC_ENABLED` | `false` | No Anthropic API calls |
| `PROVIDER_GROQ_ENABLED` | `false` | No Groq API calls |
| `PROVIDER_XAI_ENABLED` | `false` | No xAI API calls |
| `PROVIDER_DEEPSEEK_ENABLED` | `false` | No DeepSeek API calls |
| `BILLING_CHARGES_ENABLED` | `false` | No Stripe charges |
| `BILLING_SNAPSHOT_ENABLED` | `false` | No billing snapshots |
| `PAYMENT_EXECUTION_ENABLED` | `false` | No payment execution |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | No agent tool loop |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | No file write tools |
| `AGENT_HARNESS_STUB_WRITE_MODE` | `false` | No stub write mode |

Do not call:
- `/api/ai/execute`
- Container execution or session execution endpoints
- Billing checkout, top-up, customer-portal, or webhook endpoints

Only health endpoints (`/api/health`, `/api/health/ready`, `/api/health/live`) are permitted during this step.

---

## Section 22 — Build Strategy

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Build each service after dependencies are installed and `.env` is prepared.

```bash
# Build API Gateway
cd /opt/aisandbox/services/api-gateway
npm run build

# Build AI Service
cd /opt/aisandbox/services/ai-service
npm run build

# Build Container Manager
cd /opt/aisandbox/services/container-manager
npm run build

# Build Frontend
cd /opt/aisandbox/frontend
npm run build
```

Verify each build completes without TypeScript errors or missing module errors.

The frontend build (`npm run build`) will compile Next.js into `.next/`. This may take 1–3 minutes.

Stop conditions for this section:
- Any build fails with TypeScript errors.
- Any build fails due to missing env variable (verify `.env` is accessible).
- Any build fails due to missing dependencies.
- Any build fails for an unexpected reason.

If a build fails, stop and report the error before continuing.

---

## Section 23 — PM2 Service Strategy

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Start services under PM2. Use PM2 ecosystem config or individual `pm2 start` commands.

### 23A — Start services

```bash
# API Gateway
pm2 start /opt/aisandbox/services/api-gateway/dist/main.js \
  --name api-gateway \
  --cwd /opt/aisandbox/services/api-gateway \
  --env-file /opt/aisandbox/.env

# AI Service
pm2 start /opt/aisandbox/services/ai-service/dist/main.js \
  --name ai-service \
  --cwd /opt/aisandbox/services/ai-service \
  --env-file /opt/aisandbox/.env

# Container Manager
pm2 start /opt/aisandbox/services/container-manager/dist/main.js \
  --name container-manager \
  --cwd /opt/aisandbox/services/container-manager \
  --env-file /opt/aisandbox/.env

# Frontend (Next.js)
pm2 start npm \
  --name frontend \
  --cwd /opt/aisandbox/frontend \
  -- start
```

Note on `--env-file`: If the PM2 version installed (7.0.3) does not support `--env-file`, omit the flag and instead load the `.env` with a PM2 ecosystem file or by sourcing the env before starting. Verify the PM2 docs for the exact flag support in v7.0.3.

**Alternative if `--env-file` is not supported:** Use a PM2 ecosystem file at `/opt/aisandbox/ecosystem.config.js` that references the env file, or use `dotenv -e /opt/aisandbox/.env -- pm2 start ...`. Keith should use the pattern that correctly loads the env for each service.

### 23B — Verify PM2 list

```bash
pm2 list
```

Expected: All four services appear with status `online`. If any service shows `errored` or `stopped`, stop and review PM2 logs (Section 23C) before proceeding.

### 23C — Review PM2 logs if needed

```bash
pm2 logs api-gateway --lines 50
pm2 logs ai-service --lines 50
pm2 logs container-manager --lines 50
pm2 logs frontend --lines 50
```

Look for startup errors, missing env variables, or connection failures. Do not paste logs that contain secret values.

### 23D — Save PM2 process list for auto-restart

```bash
pm2 save
pm2 startup
```

Follow the `pm2 startup` instruction if it provides a `sudo` command to register PM2 on boot.

Stop conditions for this section:
- Any PM2 service fails to start or shows `errored` status.
- Logs show `REDIS_URL environment variable is not set`.
- Logs show `DATABASE_URL environment variable is not set`.
- Logs show Redis connection refused or authentication failure.
- Logs show PostgreSQL connection refused or authentication failure.
- Logs show any unexpected critical startup error.
- Any secret value appears in PM2 logs (stop, do not paste logs into chat).

---

## Section 24 — Health-Only Startup Checks

**Run inside AWS Lightsail browser SSH — not PowerShell.**

After all PM2 services are running, check health endpoints only. Do not call execution, billing, or AI provider endpoints.

### 24A — API Gateway health

```bash
curl -s http://localhost:4000/api/health
curl -s http://localhost:4000/api/health/ready
curl -s http://localhost:4000/api/health/live
```

Expected: HTTP 200 responses. Note the response bodies — they may indicate service status.

### 24B — AI Service health (if health endpoint exists)

```bash
curl -s http://localhost:4001/api/health
```

Expected: HTTP 200 if the health endpoint exists.

### 24C — Container Manager health

```bash
curl -s http://localhost:4002/api/health
```

Expected: HTTP 200.

### 24D — Frontend health

```bash
curl -s http://localhost:3002
```

Expected: HTTP 200 and HTML response body.

### 24E — Record results

Record which health endpoints return 200 and which (if any) return errors. Note: during the private beta staging baseline step, it is acceptable if some services return a non-200 health status due to missing DNS/TLS configuration or pending database migration. The key success criteria for this step are:

1. Services start without crashing.
2. Redis and PostgreSQL connection errors do not prevent startup.
3. Kill-switch posture is confirmed safe.
4. No real AI/container/billing execution occurred.

Stop conditions for this section:
- A service that should start fails to respond to its health endpoint at all.
- Health endpoint returns an error that indicates a critical misconfiguration.
- Any health endpoint call triggers billing, AI, or container execution.

---

## Section 25 — Confirmation: No Migrations

Migrations are **NOT part of this task**. Confirm:

- No `npm run migration:run:prod` command was executed.
- No `typeorm migration:run` command was executed.
- No migration files were run.
- The `aisandbox` database schema has no app tables (it is still the empty baseline from EXECUTION-03).

If any command resembling a migration is encountered, this is a stop condition. Stop immediately and report before proceeding.

Database migration is a separate future registered task. It requires an explicit pre-migration snapshot, a backup plan, and Keith approval.

---

## Section 26 — Confirmation: No DNS/TLS

DNS and TLS are **NOT part of this task**. Confirm:

- No DNS A record for `staging.ainow.biz` was configured.
- No Caddy site config for `staging.ainow.biz` was created.
- No TLS certificate was requested or configured.
- No Caddy `reverse_proxy` block was added.
- The Lightsail firewall was not modified.

DNS/TLS belong to a later explicitly registered task. Do not configure them in this step.

---

## Section 27 — Confirmation: No Real AI/Container/Billing Execution

Confirm none of the following occurred:

| Forbidden action | Confirmed not done |
|-----------------|-------------------|
| Called `/api/ai/execute` | Not done |
| Called container session creation endpoint | Not done |
| Called container execution endpoint | Not done |
| Called billing checkout endpoint | Not done |
| Called Stripe top-up or customer-portal endpoint | Not done |
| Called billing webhook endpoint | Not done |
| Enabled `GLOBAL_EXECUTION_ENABLED=true` | Not done |
| Enabled any `PROVIDER_*_ENABLED=true` | Not done |
| Enabled `BILLING_CHARGES_ENABLED=true` | Not done |
| Enabled `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` | Not done |
| Any real API provider call occurred | Not done |
| Any Stripe charge occurred | Not done |

---

## Section 28 — Safe Evidence Template for Keith

After completing the manual execution, Keith pastes only the following safe evidence. Do not include secrets, passwords, connection strings, `.env` contents, or provider keys.

---

### Evidence — PRIVATE-BETA-STAGING-EXECUTION-04

**Date:** _______________

**Instance:** aisandbox-staging

---

**Redis Compatibility Gate:**

- Gate decision: [ ] Outcome A — Accepted / [ ] Outcome B — Blocked
- Static review finding: _______________
- Proceeding with: [ ] Redis 8.8.0 as-is / [ ] Redis downgrade task registered

---

**Redis libraries and versions found (from static review):**

- ioredis (ai-service): ^5.3.2
- ioredis (api-gateway): ^5.9.3
- bullmq (ai-service): ^5.70.1
- bullmq (api-gateway): ^5.70.1
- container-manager: no Redis dependency

---

**Snapshot verification:**

- aisandbox-staging-baseline-2026-07-23: [ ] Available / [ ] Missing
- aisandbox-staging-runtime-2026-07-24: [ ] Available / [ ] Missing
- aisandbox-staging-db-redis-2026-07-24: [ ] Available / [ ] Missing
- Pre-app snapshot created: [ ] Yes / [ ] No — Name: _______________

---

**Runtime baseline:**

Paste output of:
```
node --version && npm --version && docker --version && pm2 --version && caddy version
```

(Paste here — this output is safe)

---

**PostgreSQL baseline:**

- postgresql@15-main.service active (running): [ ] Yes / [ ] No
- Port 5432 on 127.0.0.1 only: [ ] Yes / [ ] No

---

**Redis baseline:**

- Redis version: [ ] 8.8.0 confirmed / [ ] Other: _______________
- redis-server.service active (running): [ ] Yes / [ ] No
- Port 6379 on 127.0.0.1/::1 only: [ ] Yes / [ ] No

---

**Repo clone:**

- Repo cloned: [ ] Yes / [ ] No
- Repo path: /opt/aisandbox — [ ] Confirmed
- Owner: ubuntu:ubuntu — [ ] Confirmed
- Branch: _______________
- Latest commit (first line of `git log --oneline -1`): _______________

---

**Dependency installation:**

- Root npm ci: [ ] Success / [ ] Failed / [ ] Skipped
- api-gateway npm ci: [ ] Success / [ ] Failed
- ai-service npm ci: [ ] Success / [ ] Failed
- container-manager npm ci: [ ] Success / [ ] Failed
- frontend npm ci: [ ] Success / [ ] Failed

---

**Private `.env` preparation:**

- `.env` created privately on VPS: [ ] Yes / [ ] No
- `DATABASE_URL` configured privately: [ ] Yes / [ ] No
- `REDIS_URL` configured privately: [ ] Yes / [ ] No
- `JWT_SECRET` configured privately: [ ] Yes / [ ] No
- `SESSION_SECRET` configured privately: [ ] Yes / [ ] No
- `OAUTH_STATE_SECRET` configured privately: [ ] Yes / [ ] No
- `INTERNAL_SERVICE_KEY` configured privately: [ ] Yes / [ ] No
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` configured privately: [ ] Yes / [ ] No
- All kill-switch keys set to `false`: [ ] Yes / [ ] No
- `BILLING_CHARGES_ENABLED=false`: [ ] Confirmed
- `GLOBAL_EXECUTION_ENABLED=false`: [ ] Confirmed
- **Secrets disclosed to AI chat: No**

---

**Build results:**

- api-gateway build: [ ] Success / [ ] Failed
- ai-service build: [ ] Success / [ ] Failed
- container-manager build: [ ] Success / [ ] Failed
- frontend build: [ ] Success / [ ] Failed

---

**PM2 service status:**

Paste output of `pm2 list` (safe — no secrets in this output):

(Paste pm2 list here)

---

**Health endpoint checks:**

- `GET http://localhost:4000/api/health` → HTTP _____ ([ ] 200 / [ ] Other)
- `GET http://localhost:4000/api/health/ready` → HTTP _____ ([ ] 200 / [ ] Other)
- `GET http://localhost:4000/api/health/live` → HTTP _____ ([ ] 200 / [ ] Other)
- `GET http://localhost:4001/api/health` → HTTP _____ ([ ] 200 / [ ] Other / [ ] Endpoint not found)
- `GET http://localhost:4002/api/health` → HTTP _____ ([ ] 200 / [ ] Other)
- `GET http://localhost:3002` → HTTP _____ ([ ] 200 / [ ] Other)

---

**Non-goal confirmations:**

- No migrations run: [ ] Confirmed
- No DNS configured: [ ] Confirmed
- No TLS configured: [ ] Confirmed
- No real AI execution: [ ] Confirmed
- No real container execution: [ ] Confirmed
- No billing/payment execution: [ ] Confirmed
- Kill-switch posture safe: [ ] Confirmed

---

**Warnings / unexpected outputs:**

(List any warnings, deviations, or unexpected outputs that are safe to report)

---

**Stop conditions triggered:**

- [ ] None
- [ ] Yes — describe: _______________

---

## Section 29 — Stop Conditions

Keith must stop and report immediately if any of the following occur:

| # | Stop condition |
|---|---------------|
| 1 | Redis 8.8.0 compatibility cannot be accepted safely |
| 2 | Static review finds Redis-version-gated usage that may not work on Redis 8.8.0 |
| 3 | Any snapshot is missing or not Available |
| 4 | Runtime baseline is not intact (wrong Node.js version, missing tool) |
| 5 | PostgreSQL is not active or port 5432 is not localhost-only |
| 6 | Redis is not active, or port 6379 is not localhost-only, or protected-mode is disabled, or requirepass is not configured |
| 7 | Lightsail firewall shows unexpected ports open (anything other than 22, 80, 443) |
| 8 | Repo clone fails for any reason |
| 9 | Repo clone path is not `/opt/aisandbox` |
| 10 | Any `npm ci` or `npm install` fails |
| 11 | Any build (`npm run build`) fails |
| 12 | `.env` preparation requires a value Keith does not have |
| 13 | `.env` contents would need to be printed or pasted into chat |
| 14 | Any command asks for AWS credentials, SSH private keys, tokens, or provider secrets unexpectedly |
| 15 | Any command appears to run migrations |
| 16 | Any command appears to configure DNS or TLS |
| 17 | Any command appears to enable billing or payment execution |
| 18 | Any command appears to enable real AI execution |
| 19 | Any command appears to enable real container execution |
| 20 | Any PM2 service fails to start or shows `errored` status |
| 21 | Health endpoint fails to respond after service startup |
| 22 | Any secret value is accidentally disclosed in terminal or chat |
| 23 | PM2 logs show a secret value (do not paste those logs into chat) |
| 24 | Redis connection fails in service logs despite valid REDIS_URL |
| 25 | PostgreSQL connection fails in service logs despite valid DATABASE_URL |

---

## Section 30 — Expected Final State

After this step completes successfully:

| State | Expected |
|-------|----------|
| Repo | Cloned to `/opt/aisandbox` — owned by `ubuntu:ubuntu` — correct branch |
| Dependencies | Installed for all services |
| `.env` | Created privately at `/opt/aisandbox/.env` — chmod 600 — never pasted |
| Builds | Completed for all services |
| PM2 | Four services online: `api-gateway`, `ai-service`, `container-manager`, `frontend` |
| Health endpoints | api-gateway health responding — other services responding or documented |
| Migrations | Not run — database schema is still the empty EXECUTION-03 baseline |
| DNS | Not configured |
| TLS | Not configured |
| Caddy | No site config added |
| Kill-switches | All `false` — confirmed |
| AI execution | Not enabled |
| Billing/payment | Not enabled |
| Snapshots | All three prior snapshots Available — pre-app snapshot Available |
| Secrets | No values disclosed |

---

## Section 31 — Exact Next Action After Keith Runs the Runbook

After Keith completes manual execution and provides the safe evidence:

1. Keith pastes only the safe evidence template (Section 28) into the chat.
2. The AI reviews the evidence and produces an evidence review document:
   `docs/PRIVATE-BETA-STAGING-EXECUTION-04-EVIDENCE-REVIEW.md`
3. If the evidence review passes, the AI updates governance files and creates the consolidation checkpoint:
   `docs/PRIVATE-BETA-STAGING-EXECUTION-04-CHECKPOINT.md`
4. EXECUTION-04 is marked COMPLETE and LOCKED in TASKS.md, TASKS_BACKLOG_FULL.md, and AINOW-EXECUTION-ROADMAP.md.
5. Next recommended task: A future DNS/TLS configuration task and a separate database migration task, once EXECUTION-04 is locked.

---

## Child Slice Recommendation

**This runbook recommends splitting EXECUTION-04 into child slices before manual execution.**

The combined scope — Redis compatibility gate + repo clone + env preparation + dependency install + build + PM2 service start + health smoke — is large for a single manual execution session and carries multiple independent failure modes.

**Recommended child slice registration:**

| Slice | Scope |
|-------|-------|
| `EXECUTION-04A` | Redis Compatibility Gate + Snapshot Verification + Runtime/DB/Redis Baseline Verification + Repo Clone Only |
| `EXECUTION-04B` | Private Env Preparation Only (`.env` creation and key population) |
| `EXECUTION-04C` | Dependency Installation + Build Only |
| `EXECUTION-04D` | PM2 Service Start + Health-Only Smoke |

**If Keith prefers to attempt the full scope in one session:** This runbook covers all sections sequentially. Follow each section carefully and stop at the first stop condition. Create a snapshot before each major phase.

**Keith decides whether to register child slices or attempt the full runbook in one session. This decision should be made before starting manual execution.**

---

## Appendix — Files Changed by This Step (Step 2 Only)

| File | Change |
|------|--------|
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04-APP-DEPLOYMENT-BASELINE-RUNBOOK.md` | Created — this document |

No other files changed. No TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md, source files, env files, test files, package files, Docker files, migration files, or deployment files were modified.

---

**Runbook created:** 2026-07-25
**Task:** PRIVATE-BETA-STAGING-EXECUTION-04 — Step 2
**Nature:** Runbook only — no server action performed — no source files changed — no governance files changed — no env files opened/created/edited — no env values opened/printed — no AWS/SSH/DNS/TLS action occurred — no Docker/PostgreSQL/Redis action occurred locally — no git commit or push — no subagents used.
