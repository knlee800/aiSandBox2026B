# BILLING-READY-06 — Runtime / Migration / Browser Smoke Readiness and Exact Safety Plan

**Task ID:** BILLING-READY-06
**Step:** 2 — Runtime / Migration / Browser Smoke Readiness and Exact Safety Plan
**Status:** Step 2 COMPLETE
**Date:** 2026-07-16
**Nature:** Static readiness/safety planning — no execution

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-06 ACTIVE — Step 1 COMPLETE (Registration — 2026-07-16) | **CONFIRMED** |
| BILLING-READY-05 COMPLETE and LOCKED (2026-07-16) | **CONFIRMED** |
| BILLING-READY-05A COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05B COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05C COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05D COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05E COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05F COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05G COMPLETE and LOCKED (2026-07-16) | **CONFIRMED** |
| BILLING-READY-04 COMPLETE and LOCKED (2026-07-13) | **CONFIRMED** |
| BILLING-READY-03 COMPLETE and LOCKED (2026-07-07) | **CONFIRMED** |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-06 is ACTIVE |
| AGENT-HARNESS write canary remains separate | **CONFIRMED** — not registered, not part of BILLING-READY-06 |

---

## 2. Deferred Validation Inventory from BILLING-READY-05

All items below were explicitly deferred during BILLING-READY-05 (recorded in `docs/BILLING-READY-05-CHECKPOINT.md` §6 and `docs/BILLING-READY-05G-CHECKPOINT.md` §11). BILLING-READY-06 owns triage and planning of these items.

| # | Deferred Item | Source Slice | Reason Deferred | Future Requirement |
|---|---------------|-------------|------------------|-------------------|
| 1 | Real DB migration execution (4 migrations) | 05B, 05D, 05E | No Docker/PostgreSQL runtime approved in 05 scope | Keith approval + Docker Desktop + PostgreSQL container healthy |
| 2 | Docker/PostgreSQL/Redis runtime validation | 05G | No runtime validation approved in 05 scope | Keith approval before any Docker/service commands |
| 3 | API Gateway runtime startup | 05G | No runtime validation approved in 05 scope | Keith approval + Docker + PostgreSQL + Redis running |
| 4 | Frontend dev server startup | 05G | No runtime validation approved in 05 scope | Keith approval |
| 5 | Browser smoke for billing page | 05F, 05G | Not approved in 05 scope | Keith approval + step-by-step guidance |
| 6 | Stripe/provider API validation (live) | 05A | Not approved; no Stripe SDK installed | Keith approval + provider mode/env/secrets decision |
| 7 | Stripe/provider API validation (test) | 05A | Not approved | Keith approval + test-mode env/keys |
| 8 | Stripe CLI / webhook runtime testing | 05D | Not approved | Keith approval + webhook endpoint config |
| 9 | Customer portal backend endpoint | 05F | Intentionally deferred — UI shows "Coming soon" | Future billing task registration |
| 10 | Real payment validation | 05G | Not approved | Keith approval |

---

## 3. Docker / PostgreSQL / Redis Readiness Plan

### 3.1 Docker Compose File Selection

| File | Contents | Use Decision |
|------|----------|-------------|
| `docker-compose.yml` | `postgres` (PostgreSQL 15-alpine), `redis` (Redis 7-alpine), `prometheus`, `grafana` | **PRIMARY** — use `postgres` and `redis` services only |
| `docker-compose.local-testing.yml` | `api-gateway` service env override only (`NODE_ENV: development`) | **NOT NEEDED** — does not define database services |
| `docker-compose.prod.yml` | Not inspected in detail — production config | **DO NOT USE** |

### 3.2 Exact Services Needed

| Service | Container Name | Required? | Purpose |
|---------|---------------|-----------|---------|
| `postgres` | `aisandbox-postgres` | **YES** — for migration execution and API Gateway DB connection | PostgreSQL 15-alpine, port 5432 |
| `redis` | `aisandbox-redis` | **YES** — for API Gateway startup (BullMQ requires Redis) | Redis 7-alpine, port 6379 |
| `prometheus` | `aisandbox-prometheus` | **NO** — not needed for billing validation | Monitoring only |
| `grafana` | `aisandbox-grafana` | **NO** — not needed for billing validation | Monitoring only |

### 3.3 Redis Dependency Determination

**Redis IS required** for API Gateway runtime startup. The API Gateway depends on BullMQ (`bullmq` package in `api-gateway/package.json`), which requires a Redis connection. Without Redis, the API Gateway will fail to start. This was confirmed during prior AGENT-HARNESS-06D/06E canary work.

### 3.4 Local-Only DB Requirement

**YES** — only a local development PostgreSQL database is permitted. The `docker-compose.yml` uses `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from `.env` environment variables with local volume `postgres_data`. No remote or production database connection is approved.

### 3.5 Exact Safe Readiness Checks (Future Step 3)

```powershell
# 1. Verify Docker Desktop is running
docker info

# 2. Start ONLY postgres and redis (not prometheus/grafana)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis

# 3. Wait for health checks (~30s)
docker compose ps

# 4. Verify PostgreSQL responding
docker exec aisandbox-postgres pg_isready -U aisandbox -d aisandbox

# 5. Verify Redis responding
docker exec aisandbox-redis redis-cli ping
```

**Note on command 5:** The Redis container uses `--requirepass ${REDIS_PASSWORD}`, so the ping command may need `-a <password>`. The password should be read from the environment at runtime, not hardcoded here. If the passwordless ping fails, use: `docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ping`.

### 3.6 Stop Conditions

- **STOP** if Docker Desktop is not running or `docker info` fails
- **STOP** if PostgreSQL container fails health check after 60s
- **STOP** if Redis container fails health check after 60s
- **STOP** if `pg_isready` returns failure
- **STOP** if unexpected error messages appear in container logs
- **STOP** immediately if any command attempts to connect to a remote/production database

### 3.7 Cleanup Expectations

```powershell
# After validation is complete:
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis

# If full cleanup desired (removes volumes — DESTRUCTIVE to local data):
# Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose down -v
```

### 3.8 Safety Constraints

- No destructive DB commands (`DROP DATABASE`, `TRUNCATE` on production tables, bulk `DELETE FROM`)
- No production DB connection
- No remote DB connection
- No `docker-compose.prod.yml` usage
- Volumes: `postgres_data` (local) — OK for development; `redis_data` (local) — OK for development
- Do not expose ports beyond default 5432/6379 on localhost

---

## 4. Migration Validation Plan

### 4.1 Migration Inventory

| # | Migration File | Source Slice | Nature | Idempotent? | Down Migration? |
|---|---------------|-------------|--------|-------------|-----------------|
| 1 | `1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | 05B | Schema alignment — adds columns, updates constraints, adds indexes to existing `subscriptions` table | **YES** — `IF NOT EXISTS` / `IF EXISTS` guards | **YES** — full reverse |
| 2 | `1772200100000-AddStripeCustomerIdUniqueIndex.ts` | 05B | Index only — unique partial index on `users.stripe_customer_id` | **YES** — `IF NOT EXISTS` | **YES** — `DROP INDEX IF EXISTS` |
| 3 | `1772300000000-CreateWebhookEventsTable.ts` | 05D | New table — `webhook_events` with idempotency constraint and indexes | **YES** — `IF NOT EXISTS` / `IF EXISTS` guards | **YES** — `DROP TABLE IF EXISTS` |
| 4 | `1772400000000-CreateCreditGrantsTable.ts` | 05E | New table — `credit_grants` with idempotency constraint, CHECK constraints, and indexes | **YES** — `IF NOT EXISTS` / `IF EXISTS` guards | **YES** — full reverse |

### 4.2 Migration Quality Assessment

All 4 migrations have been inspected. Findings:

- All use `IF NOT EXISTS` / `IF EXISTS` idempotency guards — safe for repeated execution
- All have complete `down()` migrations with proper reverse operations
- No data mutation — schema-only (table creation, column additions, index/constraint updates)
- No destructive operations on existing data
- No dependency on external services or env variables (TypeORM CLI requires `DATABASE_URL` only)
- Migration 1 depends on `subscriptions` table existing (created by `database/init/001_schema.sql` or by the migration itself via `CREATE TABLE IF NOT EXISTS`)
- Migration 2 depends on `users` table existing (created by init schema)
- Migrations 3 and 4 are standalone new tables
- Migration-shape tests already validated SQL structure: 05B (20 tests), 05D (12 tests), 05E (17 tests) — total 49 migration-shape tests PASS

### 4.3 Decision: Inspect-Only vs Real Local DB Execution

**Decision: Real local DB execution is approved for planning — but execution requires Keith explicit approval in Step 3.**

Rationale:
1. Migration files have been thoroughly inspected and are schema-only with idempotency guards
2. Migration-shape tests validated SQL structure in 05G
3. Real execution against a local PostgreSQL container is the next logical validation step
4. The local DB is disposable — `docker compose down -v` removes all data
5. No production DB risk — all commands target `localhost:5432` only

### 4.4 Whether Migration Execution Should Be a Separate Child Slice

**Decision: Migration execution should be part of Step 3, not a separate child slice.**

Rationale:
1. All 4 migrations are schema-only with idempotency guards — low risk
2. Migration execution is a prerequisite for API Gateway runtime startup (TypeORM entities depend on these tables)
3. Splitting into a separate child slice adds governance overhead without proportional safety benefit
4. Stop conditions are clear — if any migration fails, stop immediately

### 4.5 Exact Safe DB Target

- Host: `localhost` (Docker container `aisandbox-postgres`)
- Port: `5432`
- User: `aisandbox` (from `.env` — non-secret development user)
- Database: `aisandbox` (from `.env` — local development database)
- Connection: `DATABASE_URL=postgresql://aisandbox:<password>@localhost:5432/aisandbox`

The data-source config (`services/api-gateway/data-source.ts`) reads `DATABASE_URL` environment variable. It throws if `DATABASE_URL` is not set.

### 4.6 Exact Command Sequence (If Approved Later)

```powershell
# 1. Ensure Docker postgres is running and healthy (from §3.5)
docker exec aisandbox-postgres pg_isready -U aisandbox -d aisandbox

# 2. Set DATABASE_URL for migration CLI (process-scoped, not persisted)
$env:DATABASE_URL = "postgresql://aisandbox:$($env:POSTGRES_PASSWORD)@localhost:5432/aisandbox"

# 3. Show pending migrations (read-only — does not execute)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:show -d data-source.ts

# 4. Run migrations (executes all pending — idempotent)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:run -d data-source.ts

# 5. Verify migration state (should show all as executed)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:show -d data-source.ts
```

**Note:** `POSTGRES_PASSWORD` must be set in the environment before step 2. Read it from `.env` at runtime — do not hardcode. The `data-source.ts` uses `DATABASE_URL` as the single source of truth with `localhost` host (not `postgres` Docker-network hostname).

### 4.7 Rollback / Down Migration Policy

- If a migration fails partway, **STOP immediately**
- Do not retry without diagnosis
- Rollback command (if needed): `npx typeorm-ts-node-commonjs migration:revert -d data-source.ts`
- All 4 migrations have `down()` methods with full reverse operations
- Down migrations are also idempotent (`IF EXISTS` guards)
- Do not run revert unless Keith explicitly approves
- Nuclear cleanup option: `docker compose down -v` destroys all data (local dev only)

### 4.8 Evidence to Capture

- `migration:show` output before execution (list of pending migrations)
- `migration:run` output (each migration execution status)
- `migration:show` output after execution (all migrations marked as executed)
- Any error messages captured verbatim

### 4.9 Stop Conditions

- **STOP** if `DATABASE_URL` is not set or points to a non-localhost host
- **STOP** if `pg_isready` fails (PostgreSQL not running)
- **STOP** if any migration produces an error (do not retry without diagnosis)
- **STOP** if migration output shows data mutation (unexpected — all are schema-only)
- **STOP** if migration connects to anything other than `localhost:5432`

---

## 5. Backend Runtime Smoke Plan

### 5.1 Whether API Gateway Startup Is Needed

**YES** — API Gateway startup is needed to validate:
1. Migrations were applied correctly (TypeORM entity-to-table alignment)
2. Billing endpoints respond with expected shapes
3. Health endpoint confirms service readiness
4. No startup errors from new module wiring (05A–05F modules)

### 5.2 Exact Command (If Approved Later)

```powershell
# Start API Gateway in development mode
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run dev
```

This uses `ts-node-dev --respawn --transpile-only src/main.ts` (from `package.json` scripts).

### 5.3 Exact Port / Health Endpoint

| Endpoint | Method | Expected |
|----------|--------|----------|
| `http://localhost:4000/api/health` | GET | `{ status: "ok", service: "api-gateway" }` |
| `http://localhost:4000/api/health/db` | GET | `{ status: "ok", database: "connected" }` |
| `http://localhost:4000/api/health/ready` | GET | `{ status: "ready", checks: { environment: "validated", database: "connected", ... } }` |

Port is `4000` (from `PORT` or `API_PORT` env variable, defaulting to 4000 in `main.ts`).

### 5.4 Exact Billing Endpoints to Smoke

| # | Endpoint | Method | Auth Required | Expected Behavior (No Auth) | Expected Behavior (With Auth) |
|---|----------|--------|---------------|----------------------------|-------------------------------|
| 1 | `/api/billing/balance` | GET | Session cookie | HTTP 401/403 — unauthenticated | `{ balance, monthlyAllocation, planId, ... }` — free plan defaults |
| 2 | `/api/billing/subscription` | GET | Session cookie | HTTP 401/403 — unauthenticated | `null` or subscription object |
| 3 | `/api/billing/checkout/subscription` | POST | Session cookie | HTTP 401/403 — unauthenticated | HTTP 503 — `BILLING_CHARGES_ENABLED=false` blocks |
| 4 | `/api/billing/checkout/topup` | POST | Session cookie | HTTP 401/403 — unauthenticated | HTTP 503 — `BILLING_CHARGES_ENABLED=false` blocks |

### 5.5 How to Avoid Provider Calls

Multiple safety layers prevent provider calls during smoke:

1. **No `stripe` npm package installed** — no Stripe SDK available to call
2. **`BILLING_CHARGES_ENABLED` defaults to `false`** — `ChargeReadinessService` blocks all charging paths
3. **`STRIPE_PROVIDER_MODE` defaults to `disabled`** — `StripePaymentProvider` returns `PROVIDER_DISABLED` for all operations
4. **No `STRIPE_SECRET_KEY` configured** — even if mode were `test`/`live`, key absence degrades to `disabled`
5. **No `STRIPE_WEBHOOK_SECRET` configured** — webhook signature verification returns `PROVIDER_DISABLED`

No additional configuration needed to prevent provider calls. The system is safe by default.

### 5.6 Whether Auth/Session Setup Blocks Runtime Smoke

**Partially.** The billing read endpoints (`GET /api/billing/balance`, `GET /api/billing/subscription`) require `SessionCookieGuard` — a browser session cookie. Options:

- **Without auth:** Health endpoints (`/api/health`, `/api/health/db`, `/api/health/ready`) can be tested without auth. Billing endpoints will return 401/403, which itself confirms the auth guard is working.
- **With auth (browser):** If browser smoke is approved (§6), logging in via the billing page will establish a session cookie, allowing billing endpoint access.
- **With curl + cookie:** Possible but requires manual cookie setup — complex and fragile.

**Recommendation:** Test health endpoints without auth. Test billing endpoint auth rejection without auth. Full billing endpoint data validation deferred to browser smoke (§6).

### 5.7 Stop Conditions

- **STOP** if API Gateway fails to start (module initialization error)
- **STOP** if health endpoint returns non-200
- **STOP** if `health/db` returns `disconnected` (PostgreSQL not running/connected)
- **STOP** if unexpected errors appear in startup logs
- **STOP** if any log shows Stripe/provider API call attempt
- **STOP** if any log shows `STRIPE_SECRET_KEY` value or any secret

---

## 6. Frontend Browser Smoke Plan

### 6.1 Exact Future Guided Scenarios

| # | Scenario | URL | Expected Behavior | Auth Needed? |
|---|----------|-----|-------------------|-------------|
| 1 | `/en/billing` page load | `http://localhost:3002/en/billing` | Billing page renders with balance card, subscription card, top-up section, customer portal "Coming soon" | YES (session) |
| 2 | `/zh-TW/billing` page load | `http://localhost:3002/zh-TW/billing` | Same layout with Traditional Chinese labels — all 30 billing keys translated | YES (session) |
| 3 | `/zh-CN/billing` page load | `http://localhost:3002/zh-CN/billing` | Same layout with Simplified Chinese labels — all 30 billing keys translated | YES (session) |
| 4 | Loading state | Any billing URL | Skeleton/shimmer placeholders visible during API fetch | YES |
| 5 | Error state (API unreachable) | Any billing URL (API down) | Error banner with retry button; "Failed to load billing information." message | YES |
| 6 | Empty/free state | Any billing URL (free plan user) | Free plan informational display — balance 0, no error styling, upgrade prompt | YES |
| 7 | Checkout success query banner | `http://localhost:3002/en/billing?checkout=success` | Green success banner displayed | YES |
| 8 | Checkout cancelled query banner | `http://localhost:3002/en/billing?checkout=cancelled` | Amber cancelled banner displayed | YES |
| 9 | Top-up buttons behavior (charges disabled) | Any billing URL | Top-up buttons present; clicking returns 503 error from API (charges disabled) — error banner shown | YES |
| 10 | Subscription buttons behavior (charges disabled) | Any billing URL | Upgrade button present; clicking returns 503 error from API (charges disabled) — error banner shown | YES |
| 11 | Customer portal "Coming soon" | Any billing URL | Disabled "Manage Subscription" button with "Coming soon" subtext | YES |

### 6.2 Prerequisites for Browser Smoke

- Keith must **explicitly approve** browser smoke execution
- Docker + PostgreSQL + Redis must be running and healthy (§3)
- Migrations must have been executed successfully (§4)
- API Gateway must be running at `http://localhost:4000` (§5)
- Frontend dev server must be running: `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run dev` → `http://localhost:3002`
- User must be logged in (browser session cookie required for billing endpoints)
- Keith will be guided step-by-step through each scenario

### 6.3 No Real Checkout/Provider Call

- No actual checkout session will be created
- No Stripe redirect will occur
- No real payment processing
- `BILLING_CHARGES_ENABLED=false` blocks checkout at service layer
- `STRIPE_PROVIDER_MODE` defaults to `disabled`
- Top-up/subscription checkout buttons will return HTTP 503 from `ChargeReadinessService` gate

### 6.4 Approval Requirement

**Browser smoke requires Keith explicit approval and step-by-step guidance.** The agent must not autonomously open browsers or navigate to pages. Keith performs the browser navigation; the agent documents expected behavior and verifies Keith's reported observations.

---

## 7. Provider / Payment / Customer Portal Safety Plan

| # | Constraint | Status | Enforcement Mechanism |
|---|-----------|--------|----------------------|
| 1 | No live Stripe calls | **CONFIRMED — not approved** | No `stripe` npm package installed; no SDK import possible |
| 2 | No test Stripe calls | **CONFIRMED — not approved unless Keith explicitly approves later** | No `STRIPE_SECRET_KEY`; no `stripe` package; `STRIPE_PROVIDER_MODE` defaults to `disabled` |
| 3 | No Stripe CLI usage | **CONFIRMED — not approved unless Keith explicitly approves later** | Stripe CLI not installed; no webhook forwarding configured |
| 4 | No customer portal API calls | **CONFIRMED — no backend portal endpoint exists** | `createBillingPortalSession()` exists on provider but no controller exposes it; UI shows "Coming soon" |
| 5 | No real payment validation | **CONFIRMED — not approved** | Multiple layers: no SDK, no keys, charges disabled, provider disabled |
| 6 | No package/env/secret changes | **CONFIRMED — not approved** | Step 3 must not modify `package.json`, `.env`, or any secret-bearing file |
| 7 | Provider mode must remain `disabled`/`stub` | **CONFIRMED** | `STRIPE_PROVIDER_MODE` defaults to `disabled`; no env file sets it otherwise; no `.env` changes approved |
| 8 | No Stripe SDK install | **CONFIRMED — not approved** | `stripe` not in any `package.json`; no `npm install stripe` approved |

---

## 8. Environment / Secrets Safety Plan

### 8.1 Env Variables to Check by Name Only (Not Value)

| Variable Name | Check Method | Purpose |
|---------------|-------------|---------|
| `BILLING_CHARGES_ENABLED` | Confirm set to `false` or unset (defaults to `false`) | Kill-switch must remain off |
| `STRIPE_PROVIDER_MODE` | Confirm unset (defaults to `disabled`) | Provider mode must remain disabled |
| `STRIPE_SECRET_KEY` | Confirm **NOT SET** in `.env` | No Stripe API key should exist |
| `STRIPE_WEBHOOK_SECRET` | Confirm **NOT SET** in `.env` | No webhook secret should exist |
| `DATABASE_URL` | Confirm points to `localhost` only — never inspect the password portion | Migration CLI connection |
| `POSTGRES_HOST` | Confirm is `localhost` or `postgres` (Docker network) | DB connection target |
| `POSTGRES_PASSWORD` | **DO NOT INSPECT VALUE** — confirm variable exists by name only | DB auth |
| `REDIS_PASSWORD` | **DO NOT INSPECT VALUE** — confirm variable exists by name only | Redis auth |

### 8.2 Env Files That Must Not Be Opened

| File | Reason |
|------|--------|
| `C:\Users\knlee\aiSandBox2026B\.env` | Contains real development secrets |
| `C:\Users\knlee\aiSandBox2026B\.env.local` | May contain real secrets |
| `C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env` | Contains real development secrets |
| `C:\Users\knlee\aiSandBox2026B\services\ai-service\.env` | Contains real development secrets |
| `C:\Users\knlee\aiSandBox2026B\services\container-manager\.env` | Contains real development secrets |

### 8.3 Safe Inspection Files

| File | Safe? | Reason |
|------|-------|--------|
| `C:\Users\knlee\aiSandBox2026B\.env.example` | **YES** | Template with placeholder values only |
| `C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env.example` | **YES** | Template with placeholder values only |
| `C:\Users\knlee\aiSandBox2026B\services\ai-service\.env.example` | **YES** | Template with placeholder values only |
| `C:\Users\knlee\aiSandBox2026B\services\container-manager\.env.example` | **YES** | Template with placeholder values only |

### 8.4 How to Confirm Provider Disabled/Stub Safely

Without opening real `.env` files:
1. Check `.env.example` files — neither contains `STRIPE_PROVIDER_MODE`, `STRIPE_SECRET_KEY`, or `STRIPE_WEBHOOK_SECRET`
2. Grep source code for default values — `StripePaymentProvider` defaults to `disabled` when env variable is absent
3. Check API Gateway startup logs for `StripePaymentProvider mode:` log line — should show `disabled`
4. Check `ChargeReadinessService` startup log — should show `BILLING_CHARGES_ENABLED: false`

### 8.5 Stop Conditions

- **STOP** if any command output reveals a real secret value (API key, password, token)
- **STOP** if any log output contains `STRIPE_SECRET_KEY` value
- **STOP** if `BILLING_CHARGES_ENABLED` is found to be `true` in runtime
- **STOP** if `STRIPE_PROVIDER_MODE` is found to be `test` or `live` in runtime
- **STOP** if any env file is accidentally opened (agent must not `Read` real `.env` files)

---

## 9. Split Decision

**Decision: B — Split into BILLING-READY-06A (Docker/DB/Migration validation) and BILLING-READY-06B (Backend + Browser Smoke)**

Rationale:

| Option | Description | Assessment |
|--------|-------------|------------|
| A | Step 3 executes one bounded local validation plan | **TOO BROAD** — Docker startup + migration + API Gateway + frontend + browser smoke in one step is too many failure domains |
| **B** | **Split into 06A (Docker/DB/migration) and 06B (backend runtime + browser smoke)** | **RECOMMENDED** — clear dependency chain; 06A must pass before 06B; each has clear stop conditions |
| C | Split into 06A/06B/06C/06D (4 child slices) | **OVERLY GRANULAR** — governance overhead without proportional safety benefit |
| D | Step 3 static-only, runtime remains deferred | **INSUFFICIENT** — static validation was already exhausted in 05G; no new static validation value |
| E | Pause | **NOT WARRANTED** — no blockers; clear path forward |

### Recommended Child Slice Structure

| Child Slice | Scope | Prerequisites |
|------------|-------|---------------|
| **BILLING-READY-06A** | Docker/PostgreSQL/Redis startup + migration execution + migration verification | Keith approval + Docker Desktop running |
| **BILLING-READY-06B** | API Gateway runtime startup + health check + billing endpoint smoke + frontend browser smoke | 06A COMPLETE and LOCKED + Keith approval for browser smoke |

### Why Split at This Boundary

1. **06A is infrastructure-only** — Docker containers + schema changes. If migrations fail, there is no point attempting backend/browser smoke.
2. **06B depends on 06A** — API Gateway startup requires migrated schema; browser smoke requires running API Gateway.
3. **06A can succeed without 06B** — migrations might pass but Keith might not want browser smoke yet.
4. **Each child slice has clear stop conditions** — 06A stops if any migration fails; 06B stops if API Gateway won't start.

---

## 10. Exact Step 3 Boundary

### 10.1 Exact Files Allowed to Change (Step 3 — applies to both 06A and 06B if split approved)

| # | File | Allowed Action |
|---|------|----------------|
| 1 | `docs/BILLING-READY-06-RUNTIME-MIGRATION-BROWSER-SMOKE-READINESS.md` | Already created — this file (Step 2) |
| 2 | `docs/BILLING-READY-06A-CHECKPOINT.md` | CREATE — 06A validation results and checkpoint (if split approved) |
| 3 | `docs/BILLING-READY-06B-CHECKPOINT.md` | CREATE — 06B validation results and checkpoint (if split approved) |
| 4 | `docs/BILLING-READY-06-CHECKPOINT.md` | CREATE — parent 06 close checkpoint |
| 5 | `TASKS.md` | UPDATE — 06 child slices registered, status updates |
| 6 | `TASKS_BACKLOG_FULL.md` | UPDATE — mirror TASKS.md |
| 7 | `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATE — 06 progress |

### 10.2 Exact Report Files to Create

| Step | Report File |
|------|------------|
| 06A Step 3 | `docs/BILLING-READY-06A-CHECKPOINT.md` — migration execution results, Docker status, evidence |
| 06B Step 3 | `docs/BILLING-READY-06B-CHECKPOINT.md` — runtime smoke results, browser smoke observations |
| Parent close | `docs/BILLING-READY-06-CHECKPOINT.md` — parent consolidation |

### 10.3 Exact Commands to Run Later (Full Absolute Windows Paths)

#### 06A Commands (Docker/DB/Migration)

```powershell
# 1. Docker Desktop check
docker info

# 2. Start postgres + redis
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis

# 3. Wait for containers
docker compose ps

# 4. PostgreSQL health
docker exec aisandbox-postgres pg_isready -U aisandbox -d aisandbox

# 5. Redis health
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ping

# 6. Set DATABASE_URL (process-scoped)
$env:DATABASE_URL = "postgresql://aisandbox:$($env:POSTGRES_PASSWORD)@localhost:5432/aisandbox"

# 7. Show pending migrations
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:show -d data-source.ts

# 8. Execute migrations
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:run -d data-source.ts

# 9. Verify migrations executed
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:show -d data-source.ts
```

#### 06B Commands (Backend + Browser Smoke)

```powershell
# 1. Start API Gateway (dev mode)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run dev

# 2. Health check (separate terminal)
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method GET
Invoke-RestMethod -Uri "http://localhost:4000/api/health/db" -Method GET
Invoke-RestMethod -Uri "http://localhost:4000/api/health/ready" -Method GET

# 3. Billing endpoint auth rejection (no session — confirms guard active)
try { Invoke-RestMethod -Uri "http://localhost:4000/api/billing/balance" -Method GET } catch { $_.Exception.Response.StatusCode }
try { Invoke-RestMethod -Uri "http://localhost:4000/api/billing/subscription" -Method GET } catch { $_.Exception.Response.StatusCode }

# 4. Start frontend dev server (if browser smoke approved)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run dev

# 5. Browser smoke — Keith navigates manually (if approved)
# http://localhost:3002/en/billing
# http://localhost:3002/zh-TW/billing
# http://localhost:3002/zh-CN/billing

# 6. Cleanup
# Stop API Gateway (Ctrl+C in terminal)
# Stop frontend (Ctrl+C in terminal)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis
```

### 10.4 Exact Commands Forbidden

- `docker compose -f docker-compose.prod.yml ...` — no production compose
- `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` on any table
- `npm install stripe` or any package installation
- Any command that opens/reads/modifies `.env` files (agent must not)
- Any `curl`/`Invoke-RestMethod` to Stripe API (`api.stripe.com`)
- `stripe listen` or any Stripe CLI command
- `git push`, `git commit` unless Keith explicitly requests
- `npm run build` in frontend unless explicitly needed
- Starting `ai-service`, `container-manager`, or worker processes
- Any command connecting to a non-localhost database

### 10.5 Exact Stop Conditions

| Domain | Stop Condition |
|--------|----------------|
| Docker | Docker Desktop not running; container fails health check; unexpected error |
| Migration | Any migration error; unexpected data mutation; non-localhost DB target |
| API Gateway | Fails to start; module initialization error; health endpoint non-200 |
| Browser smoke | Frontend dev server fails to start; API Gateway not running; Keith not available |
| Secrets | Any secret value appears in output; real `.env` file opened by agent |
| Provider | Any Stripe/provider API call detected in logs; `BILLING_CHARGES_ENABLED=true` |

### 10.6 Exact Evidence to Collect

| Evidence | Method |
|----------|--------|
| Docker container status | `docker compose ps` output |
| PostgreSQL health | `pg_isready` output |
| Redis health | `redis-cli ping` output |
| Migration show (before) | `migration:show` output |
| Migration run | `migration:run` output |
| Migration show (after) | `migration:show` output |
| API Gateway startup | Console output (look for `API Gateway started!`) |
| Health endpoint response | JSON response body |
| Health DB endpoint response | JSON response body |
| Billing endpoint auth rejection | HTTP status code (401 or 403) |
| Browser smoke observations | Keith's reported observations per scenario |

### 10.7 Whether Keith Must Manually Help with Browser Smoke

**YES.** Keith must:
1. Explicitly approve browser smoke execution
2. Navigate browser to each URL
3. Report visual observations (loading states, card rendering, translations, button states)
4. Confirm or deny expected behavior for each scenario

The agent cannot autonomously control a browser.

---

## 11. UX/UI Validation Notes

Because browser smoke (§6) touches billing UI created in 05F:

| # | Constraint | Status |
|---|-----------|--------|
| 1 | Multilingual-first requirement remains active | **CONFIRMED** — 30 keys in each of en.json, zh-TW.json, zh-CN.json |
| 2 | No new UI copy unless en/zh-TW/zh-CN all updated | **CONFIRMED** — no UI changes approved in 06 |
| 3 | Heroicons v2 Outline only | **CONFIRMED** — all billing icons from `@heroicons/react/24/outline` (verified in 05F checkpoint) |
| 4 | Impeccable/Emil advisory only | **CONFIRMED** — advisory skills do not override governance |
| 5 | No broad redesign | **CONFIRMED** — 06 is validation only; no UI code changes |
| 6 | Browser smoke observes only — no visual or functional changes | **CONFIRMED** |
| 7 | If browser smoke reveals a UI defect, register a separate bounded fix task | **CONFIRMED** — do not silently widen 06 scope |

---

## 12. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Production DB accident** | CRITICAL | All commands target `localhost:5432` only; `DATABASE_URL` must contain `localhost`; agent must not open real `.env` files; stop immediately if non-localhost connection detected |
| 2 | **Destructive migration** | HIGH | All 4 migrations inspected — schema-only, no data mutation, idempotent guards; rollback available via `migration:revert`; nuclear option `docker compose down -v` |
| 3 | **Provider call leakage** | HIGH | No `stripe` package installed; no SDK import; `BILLING_CHARGES_ENABLED=false`; `STRIPE_PROVIDER_MODE` defaults to `disabled`; no `STRIPE_SECRET_KEY` configured; multiple independent safety layers |
| 4 | **Env secret exposure** | HIGH | Real `.env` files must not be opened by agent; env variables checked by name not value; no hardcoded passwords in commands; `$env:POSTGRES_PASSWORD` used at runtime |
| 5 | **Auth/session setup blocker** | MEDIUM | Billing read endpoints require session cookie; health endpoints don't; full billing data validation deferred to browser smoke where Keith logs in manually |
| 6 | **Browser smoke ambiguity** | MEDIUM | Clear scenario list with expected behavior; Keith guides step-by-step; agent documents observations; disagreements recorded |
| 7 | **Docker instability** | MEDIUM | Docker Desktop must be running; containers use health checks; stop if health checks fail within 60s |
| 8 | **Redis dependency ambiguity** | LOW — RESOLVED | Redis IS required — BullMQ dependency in API Gateway confirms; must start redis alongside postgres |
| 9 | **False confidence if runtime deferred** | MEDIUM | Static validation exhausted in 05G; runtime validation is the next necessary step; Decision B split ensures incremental confidence |
| 10 | **Parent 05 already locked — source fixes must be separate tasks** | HIGH | If migration execution or runtime smoke reveals a source defect, STOP and register a separate bounded fix task; do not silently widen BILLING-READY-06 into implementation |
| 11 | **Init schema dependency** | MEDIUM | Migration 1 (AlignSubscriptions) depends on `subscriptions` table from `database/init/001_schema.sql`; if init schema hasn't run, `CREATE TABLE IF NOT EXISTS` in migration handles it; migration 2 depends on `users` table from init schema — must exist |
| 12 | **TypeORM migration table** | LOW | TypeORM creates `migrations` table automatically on first `migration:run`; no manual setup needed |

---

## 13. Step 3 Readiness Conclusion

| Criterion | Decision |
|-----------|----------|
| **Ready for Step 3?** | **YES — ready, pending Keith approval** |
| **Recommended model** | Sonnet 4.6 for registration/governance steps; GPT-5.3 Codex for runtime execution steps |
| **Keith approval needed before Step 3?** | **YES** — Keith must approve: (a) Decision B split into 06A/06B, (b) Docker/PostgreSQL/Redis startup, (c) migration execution, (d) API Gateway startup, (e) browser smoke separately |
| **Should Step 3 be split?** | **YES — Decision B: 06A (Docker/DB/Migration) + 06B (Backend + Browser Smoke)** |
| **Docker/PostgreSQL/Redis required?** | **YES** — PostgreSQL for migrations and API Gateway DB; Redis for API Gateway BullMQ |
| **Browser smoke required?** | **RECOMMENDED but separately approved** — deferred to 06B with explicit Keith approval and step-by-step guidance |
| **Provider validation remains deferred?** | **YES** — no Stripe/provider/customer portal API calls approved; provider mode remains `disabled`; no Stripe SDK install; deferred to a future task |

### Recommended Next Steps

1. **Keith approves Decision B split** — BILLING-READY-06A + 06B
2. **Keith approves BILLING-READY-06A scope** — Docker/PostgreSQL/Redis startup + migration execution
3. **Register 06A in TASKS.md** — new window recommended (Sonnet 4.6)
4. **Execute 06A** — Docker startup, migration show, migration run, migration verify
5. **06A checkpoint** — record migration results
6. **Keith approves BILLING-READY-06B scope** — API Gateway startup + health smoke + browser smoke
7. **Execute 06B** — API Gateway startup, health endpoints, billing endpoint auth check, browser smoke with Keith
8. **06B checkpoint** — record smoke results
9. **Parent 06 close** — consolidation checkpoint

---

## 14. Safety Confirmations for This Step (Step 2)

| Constraint | Status |
|-----------|--------|
| No subagents used | **CONFIRMED** |
| No tests run | **CONFIRMED** |
| No builds run | **CONFIRMED** |
| No Docker/PostgreSQL/Redis commands | **CONFIRMED** |
| No API Gateway startup | **CONFIRMED** |
| No frontend dev server | **CONFIRMED** |
| No browser smoke | **CONFIRMED** |
| No Stripe/payment/provider/customer portal API calls | **CONFIRMED** |
| No Stripe CLI/webhook tests | **CONFIRMED** |
| No migration execution | **CONFIRMED** |
| No env/secrets changes | **CONFIRMED** |
| No real secret env files opened | **CONFIRMED** — only `.env.example` files inspected |
| No package changes | **CONFIRMED** |
| No source file changes (services/frontend/database) | **CONFIRMED** |
| No governance file changes (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | **CONFIRMED** |
| No git commits/pushes | **CONFIRMED** |
| Only file created: this readiness document | **CONFIRMED** |

---

## 15. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-06-RUNTIME-MIGRATION-BROWSER-SMOKE-READINESS.md` | CREATED — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — BILLING-READY-06 registration confirmation, active task status |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation (tail section inspected) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, BILLING-READY-06 current active |
| 4 | `docs/BILLING-READY-05-CHECKPOINT.md` | Parent 05 close — deferred items inventory |
| 5 | `docs/BILLING-READY-05G-CHECKPOINT.md` | 05G completion — deferred items, migration status |
| 6 | `docs/BILLING-READY-05G-VALIDATION-REPORT.md` | 05G validation results — static regression matrix |
| 7 | `docs/BILLING-READY-05G-REGRESSION-RUNTIME-VALIDATION-READINESS.md` | 05G readiness plan — precedent for this document |
| 8 | `docs/BILLING-READY-05F-CHECKPOINT.md` | 05F billing UI — frontend component inventory, translation keys |
| 9 | `docs/BILLING-READY-05E-CHECKPOINT.md` | 05E credit grant — migration details, module wiring |
| 10 | `docs/BILLING-READY-05D-CHECKPOINT.md` | 05D webhook — migration details, raw-body change, endpoint behavior |
| 11 | `docker-compose.yml` | Service topology — postgres, redis, prometheus, grafana |
| 12 | `docker-compose.local-testing.yml` | Local testing compose — api-gateway env override only |
| 13 | `package.json` | Root package — workspace config, db scripts |
| 14 | `services/api-gateway/package.json` | Dependencies — BullMQ confirms Redis requirement; no `stripe` package |
| 15 | `frontend/package.json` | Dependencies — Next.js, dev server port 3002 |
| 16 | `services/api-gateway/data-source.ts` | TypeORM CLI data source — `DATABASE_URL` single source of truth |
| 17 | `services/api-gateway/src/main.ts` | API Gateway bootstrap — port, rawBody, global prefix |
| 18 | `services/api-gateway/src/health/health.controller.ts` | Health endpoints — `/health`, `/health/db`, `/health/ready` |
| 19 | `services/api-gateway/src/migrations/1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | Migration inspection — schema-only, idempotent |
| 20 | `services/api-gateway/src/migrations/1772200100000-AddStripeCustomerIdUniqueIndex.ts` | Migration inspection — index-only, idempotent |
| 21 | `services/api-gateway/src/migrations/1772300000000-CreateWebhookEventsTable.ts` | Migration inspection — new table, idempotent |
| 22 | `services/api-gateway/src/migrations/1772400000000-CreateCreditGrantsTable.ts` | Migration inspection — new table, idempotent |
| 23 | `frontend/app/[locale]/billing/page.tsx` | Billing page — server component wrapper |
| 24 | `frontend/messages/en.json` | Translation key verification — `billing` namespace present |
| 25 | `.env.example` | Template inspection — no Stripe env variables present |
| 26 | `services/api-gateway/.env.example` | Template inspection — no Stripe env variables present |
