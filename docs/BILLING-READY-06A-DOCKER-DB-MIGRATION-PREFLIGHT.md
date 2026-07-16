# BILLING-READY-06A Step 2 — Docker / Local DB / Migration Execution Preflight and Exact Command Plan

**Task ID:** BILLING-READY-06A
**Parent:** BILLING-READY-06
**Step:** 2 — Docker / Local DB / Migration Execution Preflight and Exact Command Plan
**Status:** Step 2 COMPLETE
**Date:** 2026-07-16
**Nature:** Static preflight planning only — no execution

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-06A ACTIVE — Step 1 COMPLETE (Registration — 2026-07-16) | **CONFIRMED** |
| Parent BILLING-READY-06 ACTIVE — Step 1 COMPLETE, Step 2 COMPLETE | **CONFIRMED** |
| BILLING-READY-06B planned only / not registered | **CONFIRMED** |
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
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-06 (with child 06A) is ACTIVE |
| AGENT-HARNESS write canary remains separate | **CONFIRMED** — not registered, not part of BILLING-READY-06 |

---

## 2. Docker Compose Decision

### 2.1 Compose File Selection

| File | Contents | Decision |
|------|----------|----------|
| `docker-compose.yml` | `postgres` (PostgreSQL 15-alpine), `redis` (Redis 7-alpine), `prometheus`, `grafana` | **USE THIS FILE** — contains the required `postgres` and `redis` service definitions |
| `docker-compose.local-testing.yml` | `api-gateway` service `NODE_ENV: development` env override only — no database service definitions | **DO NOT USE** — does not define postgres or redis |
| `docker-compose.prod.yml` | Production config | **DO NOT USE** — production compose is never approved for local validation |

**Decision: Use `docker-compose.yml` only.**

### 2.2 Exact Services Required

| Service | Container Name | Image | Port | Required? | Purpose |
|---------|---------------|-------|------|-----------|---------|
| `postgres` | `aisandbox-postgres` | `postgres:15-alpine` | `5432:5432` | **YES** | Local DB for migration execution |
| `redis` | `aisandbox-redis` | `redis:7-alpine` | `6379:6379` | **YES** | Required for API Gateway startup in future 06B (start now for symmetry and to validate readiness) |
| `prometheus` | `aisandbox-prometheus` | `prom/prometheus:latest` | `9090:9090` | **NO** | Monitoring only — not needed for migration validation |
| `grafana` | `aisandbox-grafana` | `grafana/grafana:latest` | `3000:3000` | **NO** | Dashboard only — not needed for migration validation |

### 2.3 Services That Must Be Avoided in 06A

| Service | Reason |
|---------|--------|
| `prometheus` | Not needed — do not start |
| `grafana` | Not needed — do not start; port 3000 may conflict with frontend if started later |
| API Gateway (`npm run dev`) | **Must NOT start in 06A** — deferred to 06B |
| Frontend dev server | **Must NOT start in 06A** — deferred to 06B |
| AI Service / Worker | **Must NOT start in 06A** — out of scope |
| Container Manager | **Must NOT start in 06A** — out of scope |

### 2.4 Docker Compose Health Checks (From Compose File)

| Service | Health Check | Interval | Timeout | Retries |
|---------|-------------|----------|---------|---------|
| `postgres` | `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}` | 10s | 5s | 5 |
| `redis` | `redis-cli -a ${REDIS_PASSWORD} ping` | 10s | 5s | 5 |

### 2.5 Volumes

| Volume | Driver | Purpose | Safe? |
|--------|--------|---------|-------|
| `postgres_data` | local | PostgreSQL data persistence | **YES** — local dev only |
| `redis_data` | local | Redis data persistence | **YES** — local dev only |

### 2.6 Network

- `aisandbox-network` — bridge driver — local Docker network only.

### 2.7 Stop Conditions (Docker Compose)

- **STOP** if `docker-compose.yml` is not found at repo root
- **STOP** if `postgres` or `redis` service definition is missing from compose
- **STOP** if any non-approved service (prometheus, grafana) starts accidentally — stop it immediately
- **STOP** if container ports 5432 or 6379 are already in use by another process

---

## 3. Local DB Target Safety

### 3.1 Local-Only DATABASE_URL Pattern

The `data-source.ts` file reads `DATABASE_URL` from the process environment. It throws if `DATABASE_URL` is not set.

**Approved pattern:**

```
DATABASE_URL=postgresql://aisandbox:<password>@localhost:5432/aisandbox
```

Where `<password>` is read from `$env:POSTGRES_PASSWORD` at runtime — never hardcoded.

### 3.2 Process-Scoped Env Variable Required

**YES.** `DATABASE_URL` must be set as a process-scoped PowerShell variable using `$env:DATABASE_URL` — not persisted to any `.env` file. This ensures:

1. No production DB risk — connection string explicitly uses `localhost`
2. No secret persistence — variable exists only in the current PowerShell session
3. No `.env` file modification — forbidden by scope constraints

### 3.3 Production DB Protection

| Protection Layer | Mechanism |
|-----------------|-----------|
| Host check | `DATABASE_URL` must contain `localhost` — visually confirmed before migration command |
| Process scope | `$env:DATABASE_URL` is session-scoped — does not persist |
| Docker isolation | `aisandbox-postgres` container is local — port 5432 on `localhost` only |
| No real env opened | Agent must not open or read real `.env` files containing secrets |
| Manual verification | Keith must visually verify `DATABASE_URL` host is `localhost` before proceeding |

### 3.4 Destructive DB Command Prohibition

The following are **forbidden** in 06A Step 3:

- `DROP DATABASE`
- `TRUNCATE` on any table
- `DELETE FROM` without idempotency guard context
- `DROP TABLE` except via `migration:revert` if explicitly approved
- Any raw SQL outside of TypeORM migration commands

### 3.5 Stop Conditions (DB Target Safety)

- **STOP** if `DATABASE_URL` is not set before migration command
- **STOP** if `DATABASE_URL` host is anything other than `localhost` (e.g., a remote host, production URL, Docker-internal `postgres` hostname — `localhost` only for TypeORM CLI running outside Docker)
- **STOP** if `DATABASE_URL` is read from a real `.env` file (must be process-scoped)
- **STOP** if any migration output shows connection to a non-localhost database
- **STOP** if any command reveals a real secret value

---

## 4. Docker / PostgreSQL / Redis Readiness Commands for Future Step 3

All commands are exact PowerShell one-liners with full absolute paths. **Do not execute these commands now — Step 2 is planning only.**

### 4.1 Docker Availability Check

```powershell
docker info
```

Expected: Docker Desktop running, no errors. If this fails, Docker Desktop is not running — **STOP**.

### 4.2 Docker Version Check

```powershell
docker --version
```

Expected: Docker version 20+.

### 4.3 Start Only Postgres and Redis

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis
```

This starts ONLY `postgres` and `redis` services in detached mode. Prometheus and Grafana are not started.

### 4.4 Check Container Status

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose ps
```

Expected: `aisandbox-postgres` and `aisandbox-redis` both showing `Up` / `healthy`.

### 4.5 Check PostgreSQL Readiness

```powershell
docker exec aisandbox-postgres pg_isready -U aisandbox -d aisandbox
```

Expected: `aisandbox:5432 - accepting connections`. If this fails — **STOP**.

### 4.6 Check Redis Readiness

```powershell
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ping
```

Expected: `PONG`. If this fails — **STOP**.

**Note:** `REDIS_PASSWORD` must be set in the PowerShell session environment for this command. Read from `.env` at runtime — do not hardcode.

**Alternative if `$env:REDIS_PASSWORD` is not set:**

```powershell
docker exec aisandbox-redis redis-cli ping
```

This may return `NOAUTH Authentication required` if Redis is password-protected. If so, set `$env:REDIS_PASSWORD` and retry with the `-a` flag.

### 4.7 Confirm Local DB Target Only

```powershell
Write-Output "DATABASE_URL host check: $($env:DATABASE_URL)"
```

Keith must visually confirm the output contains `@localhost:5432/` — no other host. If the host is anything other than `localhost`, **STOP immediately**.

### 4.8 Cleanup / Stop Commands

```powershell
# Stop containers (preserves volumes/data):
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis

# Full cleanup (DESTRUCTIVE — removes volumes and all local data):
# Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose down -v
```

The destructive `down -v` command is commented out intentionally. Do not run unless Keith explicitly approves volume deletion.

---

## 5. Migration Command Plan for Future Step 3

### 5.1 Migration Inventory

| # | Migration File | Timestamp | Source | Nature |
|---|---------------|-----------|--------|--------|
| 1 | `1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | 1772200000000 | 05B | Schema alignment — columns, constraints, indexes on existing `subscriptions` table |
| 2 | `1772200100000-AddStripeCustomerIdUniqueIndex.ts` | 1772200100000 | 05B | Index — unique partial on `users.stripe_customer_id` |
| 3 | `1772300000000-CreateWebhookEventsTable.ts` | 1772300000000 | 05D | New table — `webhook_events` |
| 4 | `1772400000000-CreateCreditGrantsTable.ts` | 1772400000000 | 05E | New table — `credit_grants` |

### 5.2 Init Schema Dependency

The `database/init/001_schema.sql` creates the baseline `subscriptions` and `users` tables. It also creates `users.stripe_customer_id` column. The Docker PostgreSQL container mounts `./database` as `/schema:ro`, and these init scripts execute when the DB is first created (via Docker Compose volume initialization).

**Key facts:**

- `users` table exists from `001_schema.sql` line 35 — includes `stripe_customer_id` (line 43)
- `subscriptions` table exists from `001_schema.sql` line 231 — but with old constraints
- Migration 1 uses `CREATE TABLE IF NOT EXISTS` — safe if `subscriptions` already exists
- Migration 2 creates a partial unique index on `users.stripe_customer_id` — column already exists

**Baseline migration table (`005_typeorm_migrations_baseline.sql`):** Seeds the `migrations` table with 8 pre-existing migration names. The 4 new billing migrations (timestamps 1772200000000–1772400000000) are **NOT** in this baseline — they will appear as pending.

### 5.3 Exact Working Directory

```
C:\Users\knlee\aiSandBox2026B\services\api-gateway
```

The `data-source.ts` file is at `services/api-gateway/data-source.ts`. TypeORM CLI must run from this directory.

### 5.4 Migration Command Source

The `api-gateway/package.json` defines these scripts:

| Script | Command | Purpose |
|--------|---------|---------|
| `migration:show` | `typeorm-ts-node-commonjs migration:show -d data-source.ts` | List migrations and their execution status (read-only) |
| `migration:run` | `typeorm-ts-node-commonjs migration:run -d data-source.ts` | Execute all pending migrations |
| `migration:revert` | `typeorm-ts-node-commonjs migration:revert -d data-source.ts` | Revert last executed migration |

### 5.5 Exact Process-Scoped DATABASE_URL Command Syntax

```powershell
$env:DATABASE_URL = "postgresql://aisandbox:$($env:POSTGRES_PASSWORD)@localhost:5432/aisandbox"
```

**Prerequisites:**
- `$env:POSTGRES_PASSWORD` must be set in the PowerShell session first (read from known dev password — do not hardcode in commands visible to agent)
- Host MUST be `localhost` — not `postgres` (Docker-internal hostname) — because TypeORM CLI runs outside Docker

### 5.6 Exact Migration Command Sequence

```powershell
# Step M1: Set DATABASE_URL (process-scoped)
$env:DATABASE_URL = "postgresql://aisandbox:$($env:POSTGRES_PASSWORD)@localhost:5432/aisandbox"

# Step M2: Show pending migrations (READ-ONLY — does not execute)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:show -d data-source.ts

# Step M3: Execute all pending migrations
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:run -d data-source.ts

# Step M4: Verify migration state (should show all as executed)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:show -d data-source.ts
```

### 5.7 Migration Direction Decision

| Option | Decision | Reason |
|--------|----------|--------|
| Up only | **APPROVED** | Run `migration:run` — applies all 4 pending migrations forward |
| Down (revert) | **DEFERRED** — not included in Step 3 unless Keith explicitly approves | Down migrations are too risky for a validation step; the goal is to confirm forward migration success |
| Up + Down + Up | **NOT APPROVED** | Unnecessary risk; forward execution with idempotency guards is sufficient validation |

**Rationale for deferring down migrations:**
1. Forward migration success is the primary validation goal
2. All 4 migrations have `down()` methods with `IF EXISTS` guards — they are structurally sound (verified in 05G shape tests)
3. Running `revert` adds risk of partial state if interrupted
4. If forward migration fails, diagnosis should occur before revert
5. Nuclear cleanup via `docker compose down -v` is available as last resort

### 5.8 Migration Table / Status Command

```powershell
# TypeORM migration status (after migration:run):
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs migration:show -d data-source.ts
```

This shows all known migrations with `[X]` (executed) or `[ ]` (pending) markers. After successful `migration:run`, all 4 billing migrations should show `[X]`.

### 5.9 Stop Conditions (Migration)

- **STOP** if `DATABASE_URL` is not set or does not contain `localhost`
- **STOP** if `migration:show` fails to connect (PostgreSQL not running)
- **STOP** if `migration:show` shows unexpected migration state (e.g., some billing migrations already executed when they shouldn't be)
- **STOP** if `migration:run` produces any error (do not retry without diagnosis)
- **STOP** if `migration:run` output shows data mutation beyond schema DDL (all 4 should be schema-only)
- **STOP** if migration connects to anything other than `localhost:5432`
- **STOP** if `npx typeorm-ts-node-commonjs` command is not found (missing dev dependency)

---

## 6. Migration Evidence Plan

### 6.1 Evidence to Capture

| # | Evidence | Method | Purpose |
|---|----------|--------|---------|
| 1 | `migration:show` before execution | Step M2 output | Confirm 4 billing migrations are pending `[ ]` |
| 2 | `migration:run` output | Step M3 output | Confirm each migration executes without error |
| 3 | `migration:run` exit code | PowerShell `$LASTEXITCODE` | Must be 0 |
| 4 | `migration:show` after execution | Step M4 output | Confirm all 4 billing migrations show `[X]` |
| 5 | Error messages (if any) | Step M3 stderr/stdout | Capture verbatim for diagnosis |

### 6.2 Table Existence Checks

After migration, the following should be verifiable from `migration:show` status and migration output:

| Table/Object | Created By | Expected State After Migration |
|-------------|-----------|-------------------------------|
| `subscriptions` table | `001_schema.sql` init + Migration 1 alignment | Exists with updated constraints/columns/indexes |
| `users.stripe_customer_id` unique partial index | Migration 2 | `idx_users_stripe_customer_id` exists |
| `webhook_events` table | Migration 3 | Exists with 4 indexes + status CHECK constraint |
| `credit_grants` table | Migration 4 | Exists with 6 indexes + 5 CHECK constraints |

### 6.3 Optional Direct DB Verification (If Needed)

If `migration:show` confirmation is insufficient, these read-only psql commands can verify table existence:

```powershell
# List tables (read-only):
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "\dt"

# Check specific table columns (read-only):
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "\d subscriptions"
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "\d webhook_events"
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "\d credit_grants"

# Check indexes (read-only):
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "\di"

# Check migration table contents (read-only):
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT * FROM migrations ORDER BY timestamp"
```

These are read-only `\d` and `SELECT` commands — no data mutation.

### 6.4 Constraints on Evidence Collection

- No data mutation beyond schema migration DDL
- No `INSERT`, `UPDATE`, `DELETE` on application data tables
- No production DB
- No real secret values in evidence output

---

## 7. Rollback / Cleanup Policy

### 7.1 Down Migration Decision

| Option | Decision | Reason |
|--------|----------|--------|
| Run `migration:revert` in Step 3 | **DEFERRED** — not included unless Keith explicitly approves | Forward migration success is the validation goal; revert adds unnecessary risk |
| Run `migration:revert` in future task | **PERMITTED** — if needed for debugging or schema changes | All 4 down migrations have `IF EXISTS` guards |

### 7.2 Container Cleanup

| Action | Command | Decision |
|--------|---------|----------|
| Stop containers only (preserves data) | `docker compose stop postgres redis` | **RECOMMENDED** after validation — preserves migration state for future 06B |
| Remove containers (preserves volumes) | `docker compose down` | **ACCEPTABLE** if Keith prefers |
| Remove containers AND volumes (DESTRUCTIVE) | `docker compose down -v` | **NOT RECOMMENDED** unless Keith explicitly requests — destroys all local DB data including migration state |

### 7.3 Safest Cleanup Command for Step 3

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis
```

This stops the containers but preserves volumes. Migration state is retained for 06B (API Gateway startup will need the migrated schema).

### 7.4 Stop Condition (Cleanup)

- **STOP** if cleanup would delete data that 06B depends on (i.e., do not run `down -v` unless Keith explicitly approves)
- **STOP** if cleanup command fails — diagnose before retrying

---

## 8. Provider / Payment Safety During 06A

| # | Constraint | Status | Enforcement |
|---|-----------|--------|-------------|
| 1 | 06A must NOT start API Gateway | **CONFIRMED** | API Gateway startup is 06B scope only |
| 2 | No provider calls possible or allowed | **CONFIRMED** | No API Gateway running = no HTTP endpoints = no provider calls |
| 3 | No Stripe live/test calls | **CONFIRMED** | No `stripe` npm package installed; no Stripe SDK import possible |
| 4 | No Stripe CLI usage | **CONFIRMED** | Stripe CLI not installed; no webhook forwarding |
| 5 | No customer portal calls | **CONFIRMED** | No backend portal endpoint exists; no API Gateway running |
| 6 | No env/secrets/package changes | **CONFIRMED** | All env variables are process-scoped `$env:` only; no `.env` file modifications |
| 7 | No Stripe SDK install | **CONFIRMED** | `stripe` not in any `package.json`; no `npm install stripe` approved |
| 8 | `BILLING_CHARGES_ENABLED` remains `false` | **CONFIRMED** | Default is `false`; no env file sets it to `true`; not relevant in 06A (no API Gateway) |
| 9 | `STRIPE_PROVIDER_MODE` remains `disabled` | **CONFIRMED** | Default is `disabled`; not relevant in 06A (no API Gateway) |

---

## 9. Exact Step 3 Execution Boundary

### 9.1 Exact Report File to Create in Step 3

| File | Purpose |
|------|---------|
| `docs/BILLING-READY-06A-CHECKPOINT.md` | 06A validation results, migration evidence, Docker status, checkpoint |

### 9.2 Exact Files Allowed to Change in Step 3

| # | File | Allowed Action |
|---|------|----------------|
| 1 | `docs/BILLING-READY-06A-CHECKPOINT.md` | **CREATE** — migration results and checkpoint |
| 2 | `TASKS.md` | **UPDATE** — 06A status (Step 2 COMPLETE, Step 3 results) |
| 3 | `TASKS_BACKLOG_FULL.md` | **UPDATE** — mirror TASKS.md |
| 4 | `docs/AINOW-EXECUTION-ROADMAP.md` | **UPDATE** — 06A progress |

No other files may be changed.

### 9.3 Exact Commands Allowed in Step 3

| # | Command | Purpose |
|---|---------|---------|
| 1 | `docker info` | Docker availability check |
| 2 | `docker --version` | Docker version check |
| 3 | `docker compose up -d postgres redis` | Start postgres + redis only |
| 4 | `docker compose ps` | Container status |
| 5 | `docker exec aisandbox-postgres pg_isready ...` | PostgreSQL health |
| 6 | `docker exec aisandbox-redis redis-cli ...` | Redis health |
| 7 | `$env:DATABASE_URL = ...` | Process-scoped env set |
| 8 | `npx typeorm-ts-node-commonjs migration:show -d data-source.ts` | Migration status (read-only) |
| 9 | `npx typeorm-ts-node-commonjs migration:run -d data-source.ts` | Execute pending migrations |
| 10 | `docker exec aisandbox-postgres psql ... \dt` / `\d` / `SELECT` | Read-only DB verification (optional) |
| 11 | `docker compose stop postgres redis` | Cleanup |
| 12 | `Write-Output ...` for `DATABASE_URL` host verification | Safety check |

### 9.4 Exact Commands Forbidden in Step 3

| # | Forbidden Command | Reason |
|---|-------------------|--------|
| 1 | `docker compose -f docker-compose.prod.yml ...` | No production compose |
| 2 | `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` (raw SQL) | No destructive DB operations |
| 3 | `npm install stripe` or any package install | No package changes |
| 4 | Any command that opens/reads/modifies `.env` files | No secret file access |
| 5 | Any `Invoke-RestMethod` / `curl` to `api.stripe.com` | No Stripe API calls |
| 6 | `stripe listen` or any Stripe CLI command | No Stripe CLI |
| 7 | `git push`, `git commit` (unless Keith explicitly requests) | No git changes |
| 8 | `npm run dev` in api-gateway | No API Gateway startup |
| 9 | `npm run dev` in frontend | No frontend startup |
| 10 | Starting ai-service, container-manager, or worker processes | No runtime services |
| 11 | `npm run build` (unless explicitly needed for migration CLI) | No builds |
| 12 | `npm test` / `npx jest` | No test execution |
| 13 | `docker compose down -v` (unless Keith explicitly approves) | No volume deletion |
| 14 | `migration:revert` (unless Keith explicitly approves) | No down migrations |

### 9.5 Whether Keith Must Be at Keyboard

**YES.** Keith must:

1. Ensure Docker Desktop is running before Step 3 begins
2. Provide `POSTGRES_PASSWORD` and `REDIS_PASSWORD` values at runtime (Keith sets `$env:POSTGRES_PASSWORD` and `$env:REDIS_PASSWORD` in PowerShell)
3. Visually verify `DATABASE_URL` contains `localhost` before migration execution
4. Approve migration execution after reviewing `migration:show` output
5. Decide cleanup approach (stop vs. down vs. down -v)

### 9.6 Whether ChatGPT/Agent Should Guide Keith Step-by-Step

**YES — recommended.** The Step 3 agent should present each command to Keith and wait for confirmation before proceeding, especially for:

- Docker startup (§4.3)
- DATABASE_URL construction (§5.5)
- Migration execution (§5.6 Step M3)
- Cleanup decision (§7.3)

Keith should be guided through commands one at a time. The agent should not batch-execute Docker startup + migration in a single autonomous sequence.

### 9.7 Whether Step 3 May Proceed in One Window or Should Split

**One window is acceptable** if:
- The context remains small (Docker commands + migration output + evidence capture)
- No source defects are found requiring implementation

**Split into a new window** if:
- Migration fails and diagnosis is complex
- Source defects are discovered requiring a separate fix task
- The window context becomes too large

---

## 10. Stop Conditions (Comprehensive)

| # | Domain | Stop Condition | Action |
|---|--------|----------------|--------|
| 1 | Docker | Docker Desktop not running (`docker info` fails) | **STOP** — Keith must start Docker Desktop |
| 2 | Docker | Missing `postgres` or `redis` service in compose file | **STOP** — compose file is corrupt or missing |
| 3 | Postgres | `pg_isready` fails after 60s | **STOP** — container failed to start or DB not ready |
| 4 | Redis | Redis ping fails (NOAUTH or connection refused) | **STOP** — check `REDIS_PASSWORD` or container status |
| 5 | DB target | `DATABASE_URL` not set or not `localhost` | **STOP** — production DB risk |
| 6 | Migration | `typeorm-ts-node-commonjs` command not found | **STOP** — missing dev dependency (should not happen — it's in `node_modules`) |
| 7 | Migration | `migration:run` produces any error | **STOP** — do not retry without diagnosis |
| 8 | Migration | Unexpected data mutation in migration output | **STOP** — all migrations should be schema-only DDL |
| 9 | Migration | `migration:show` shows unexpected state (e.g., billing migrations already executed) | **STOP** — investigate baseline state |
| 10 | Source | Source file change required to fix migration | **STOP** — register separate fix task |
| 11 | Package | Package install required | **STOP** — not approved in 06A |
| 12 | Env/secret | Real `.env` file opened or secret value revealed | **STOP** — security incident |
| 13 | Provider | Any Stripe/provider API call detected | **STOP** — should be impossible (no API Gateway) |
| 14 | Runtime | Runtime service startup needed for migration | **STOP** — migration CLI does not require runtime services |
| 15 | Port conflict | Port 5432 or 6379 already in use | **STOP** — resolve port conflict before Docker startup |

---

## 11. 06B Dependency

| Criterion | Status |
|-----------|--------|
| 06B must NOT be registered until 06A completes | **CONFIRMED** — 06B remains "planned only / not registered" |
| 06B depends on 06A migration/local DB evidence | **CONFIRMED** — API Gateway startup requires migrated schema |
| Browser smoke stays out of 06A | **CONFIRMED** — browser smoke is 06B scope |
| API Gateway startup stays out of 06A | **CONFIRMED** — runtime startup is 06B scope |
| Frontend dev server stays out of 06A | **CONFIRMED** — deferred to 06B |
| Health endpoint smoke stays out of 06A | **CONFIRMED** — requires API Gateway (06B) |

---

## 12. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Production DB accident** | CRITICAL | `DATABASE_URL` must contain `localhost`; process-scoped only; Keith visual verification required; agent must not open real `.env` files; Docker container is local-only |
| 2 | **Destructive migration** | HIGH | All 4 migrations inspected — schema-only DDL, no data mutation, idempotency guards (`IF NOT EXISTS` / `IF EXISTS`); 49 migration-shape tests passed in 05G; `migration:revert` available; nuclear cleanup `docker compose down -v` |
| 3 | **Local volume contamination** | MEDIUM | If prior local dev data exists in `postgres_data` volume, migrations may encounter pre-existing schema. Idempotency guards should handle this. If not, `docker compose down -v` and re-create is the fallback. |
| 4 | **Migration table mismatch** | MEDIUM | `005_typeorm_migrations_baseline.sql` seeds 8 baseline migration records. The 4 billing migrations are NOT baselined — they should appear as pending. If baseline table is missing or corrupt, TypeORM creates it automatically on first `migration:run`. |
| 5 | **TypeORM config mismatch** | MEDIUM | `data-source.ts` uses `DATABASE_URL` as single source of truth. Migration files are in `src/migrations/*.{ts,js}`. Entity glob is `src/**/*.entity{.ts,js}`. If path resolution fails, `migration:show` will reveal the issue before `migration:run`. |
| 6 | **Missing Docker service** | LOW | `docker-compose.yml` confirmed to contain both `postgres` and `redis` service definitions with health checks |
| 7 | **Redis readiness ambiguity** | LOW | Redis requires password (`--requirepass ${REDIS_PASSWORD}`). If `$env:REDIS_PASSWORD` is not set, passwordless ping fails. Mitigation: Keith sets `$env:REDIS_PASSWORD` before Redis health check. |
| 8 | **Env secret exposure** | HIGH | Agent must not open real `.env` files; only `.env.example` files inspected; no hardcoded passwords in commands; `$env:POSTGRES_PASSWORD` used at runtime by Keith |
| 9 | **False confidence from local-only validation** | MEDIUM | Local migration success proves schema DDL executes correctly. It does not prove production compatibility (different PostgreSQL version, different baseline state, different volume). Acknowledged as inherent limitation of local-only validation. |
| 10 | **Source defect found during migration** | HIGH | If migration execution reveals a code/schema defect, **STOP** and register a separate bounded fix task. Do not widen 06A into implementation. |
| 11 | **Init schema not applied** | MEDIUM | If Docker volume is fresh and `001_schema.sql` hasn't run (Docker Compose mounts `./database` as `/schema:ro` but requires manual psql execution OR the Postgres image entrypoint to run init scripts). Migration 1 has `CREATE TABLE IF NOT EXISTS` for `subscriptions` which handles this. Migration 2 requires `users` table — if `users` doesn't exist, migration will fail. Mitigation: `001_schema.sql` should run via Docker entrypoint or manual `db:migrate` script. |
| 12 | **`gen_random_uuid()` vs `uuid_generate_v4()`** | LOW | Init schema uses `uuid_generate_v4()` (requires `uuid-ossp` extension). Migrations use `gen_random_uuid()` (built-in in PostgreSQL 13+). Both work in PostgreSQL 15-alpine. No conflict. |

---

## 13. Step 3 Readiness Conclusion

| Criterion | Decision |
|-----------|----------|
| **Ready for Step 3?** | **YES — ready, pending Keith approval** |
| **Recommended Step 3 model** | GPT-5.3 Codex — runtime execution step with Docker/migration commands; not architecture-heavy |
| **Exact approval needed from Keith** | Keith must approve: (a) Docker Desktop startup, (b) `$env:POSTGRES_PASSWORD` / `$env:REDIS_PASSWORD` set by Keith, (c) migration execution after reviewing `migration:show`, (d) cleanup approach |
| **Docker/PostgreSQL/Redis will be used?** | **YES** — `docker compose up -d postgres redis` |
| **Real local migrations will be executed?** | **YES** — `migration:run` against local PostgreSQL |
| **Down migrations included?** | **NO — deferred** unless Keith explicitly approves |
| **Can 06A complete after Step 3 if validation passes?** | **YES** — Step 4 (consolidation/checkpoint) can follow immediately in the same or new window |
| **Whether Step 3 can proceed in one window** | **YES** — unless migration fails or source defect found |

---

## 14. Safety Confirmations for This Step (Step 2)

| Constraint | Status |
|-----------|--------|
| No subagents used | **CONFIRMED** |
| No tests run | **CONFIRMED** |
| No builds run | **CONFIRMED** |
| No Docker/PostgreSQL/Redis commands run | **CONFIRMED** |
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
| Only file created: this preflight document | **CONFIRMED** |

---

## 15. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-06A-DOCKER-DB-MIGRATION-PREFLIGHT.md` | **CREATED** — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — BILLING-READY-06A registration status, active task confirmation |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation (tail section) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, BILLING-READY-06A current active |
| 4 | `docs/BILLING-READY-06-RUNTIME-MIGRATION-BROWSER-SMOKE-READINESS.md` | Parent 06 readiness — source of truth for Docker/migration/smoke plan |
| 5 | `docs/BILLING-READY-05-CHECKPOINT.md` | Parent 05 close — deferred items, locked status |
| 6 | `docs/BILLING-READY-05G-CHECKPOINT.md` | 05G close — migration deferred status, validation results |
| 7 | `docs/BILLING-READY-05G-VALIDATION-REPORT.md` | 05G validation — static regression matrix results |
| 8 | `docker-compose.yml` | Docker compose — postgres, redis, prometheus, grafana services, ports, volumes, health checks |
| 9 | `docker-compose.local-testing.yml` | Local testing compose — api-gateway env override only, no DB services |
| 10 | `package.json` | Root package — workspace config, db scripts |
| 11 | `services/api-gateway/package.json` | API Gateway dependencies — BullMQ (Redis), TypeORM, migration scripts; no `stripe` package |
| 12 | `services/api-gateway/data-source.ts` | TypeORM CLI data source — `DATABASE_URL` single source of truth, throws if not set |
| 13 | `services/api-gateway/src/main.ts` | API Gateway bootstrap — port 4000, rawBody:true, global prefix |
| 14 | `services/api-gateway/src/migrations/1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | Migration 1 — schema alignment, IF NOT EXISTS guards, full down() |
| 15 | `services/api-gateway/src/migrations/1772200100000-AddStripeCustomerIdUniqueIndex.ts` | Migration 2 — partial unique index, IF NOT EXISTS guard |
| 16 | `services/api-gateway/src/migrations/1772300000000-CreateWebhookEventsTable.ts` | Migration 3 — new table, IF NOT EXISTS guards, full down() |
| 17 | `services/api-gateway/src/migrations/1772400000000-CreateCreditGrantsTable.ts` | Migration 4 — new table, IF NOT EXISTS guards, CHECK constraints, full down() |
| 18 | `.env.example` | Template — placeholder values, `BILLING_CHARGES_ENABLED=false`, no Stripe keys |
| 19 | `services/api-gateway/.env.example` | Template — placeholder values, no Stripe keys |
| 20 | `database/init/001_schema.sql` | Init schema — `users` table (line 35, `stripe_customer_id` line 43), `subscriptions` table (line 231) |
| 21 | `database/init/005_typeorm_migrations_baseline.sql` | Baseline — 8 pre-existing migrations seeded; 4 billing migrations NOT in baseline |
