# PRIVATE-BETA-STAGING-SETUP-06 — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP-06
**Title:** Database / Redis Setup Plan
**Status:** COMPLETE and LOCKED — 2026-07-22
**Checkpoint date:** 2026-07-22
**Nature:** PLANNING / CHECKLIST / SECURITY-ADJACENT — PostgreSQL 15 and Redis 7 setup planning only

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-06 |
| Title | Database / Redis Setup Plan |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | PLANNING / CHECKLIST / SECURITY-ADJACENT — PostgreSQL 15 and Redis 7 setup planning only |
| Risk | MEDIUM — planning only; no installation, configuration, or DB/Redis commands |
| Registered | 2026-07-22 |
| Completed | 2026-07-22 |
| Keith Approval | "go" — 2026-07-22 |
| Steps | 3 — all COMPLETE |
| Step 1 | Registration — COMPLETE (2026-07-22) |
| Step 2 | Database / Redis Setup Plan — COMPLETE (2026-07-22) |
| Step 3 | Consolidation / Handoff to SETUP-07 — COMPLETE (2026-07-22) |

---

## 2. Final Status

**COMPLETE and LOCKED — 2026-07-22.**

All 3 steps COMPLETE. DB/Redis setup plan created at `docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md`. Step 2 verdict: PASS — all criteria met — no blockers. Checkpoint created. SETUP-06 is now COMPLETE and LOCKED.

No PostgreSQL installed. No Redis installed. No database created. No DB user created. No `postgresql.conf` edited. No `pg_hba.conf` edited. No `redis.conf` edited. No password generated or entered. No `.env` file created, opened, or edited. No secret values printed, requested, or generated. No implementation occurred. No source/test/package/migration/entity/environment/Docker/deployment files changed. No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred. No git commit or git push occurred. No secret-bearing environment file opened. No subagents used.

---

## 3. Parent Task Status

| Field | Value |
|-------|-------|
| Parent task ID | PRIVATE-BETA-STAGING-SETUP |
| Parent title | Staging / Production-like Deployment Target Setup |
| Parent status | ACTIVE — Steps 1–2 COMPLETE — Step 3 executing via 8 child tasks |
| SETUP-01 | COMPLETE and LOCKED — 2026-07-21 |
| SETUP-02 | COMPLETE and LOCKED — 2026-07-21 |
| SETUP-03 | COMPLETE and LOCKED — 2026-07-21 |
| SETUP-04 | COMPLETE and LOCKED — 2026-07-21 |
| SETUP-05 | COMPLETE and LOCKED — 2026-07-21 |
| SETUP-06 | COMPLETE and LOCKED — 2026-07-22 |
| SETUP-07 | PENDING registration |
| SETUP-08 | PENDING registration |
| Parent Step 4 | PENDING — Consolidation / handoff back to deployment readiness verification |

Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE. Step 3 continues through remaining child tasks (SETUP-07, SETUP-08).

---

## 4. Why This Child Task Existed

PRIVATE-BETA-STAGING-SETUP-04 documented the runtime/container deployment plan but deferred all PostgreSQL and Redis setup to a dedicated task. PRIVATE-BETA-STAGING-SETUP-05 documented env variable presence and secret-entry procedure.

Before any staging service can start, PostgreSQL 15 and Redis 7 must be fully planned: installation method, service management, localhost-only binding, database/user creation plan, password handling rules, privilege model, `pg_hba.conf` strategy, `DATABASE_URL`/`REDIS_URL` construction rules, verification approach, backup plan, and connectivity testing. This task produced that complete database/Redis setup plan, with strict safety boundaries: no installation, no configuration, no DB/Redis commands, and no secrets in any step.

---

## 5. DB/Redis Plan Path

**Plan document:** `docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md`

Created: 2026-07-22. Status: CREATED — Step 2 verdict PASS.

---

## 6. Confirmed Staging / Database / Redis Decisions

Carried forward from SETUP-01 through SETUP-05 (all COMPLETE and LOCKED) unchanged:

| # | Decision | Confirmed Value |
|---|----------|-----------------|
| 1 | Provider | AWS Lightsail |
| 2 | Region | Singapore / ap-southeast-1 |
| 3 | Instance | 8 GB RAM / 2 vCPU / 160 GB SSD |
| 4 | Instance name | aisandbox-staging |
| 5 | Static IP planned | aisandbox-staging-ip |
| 6 | Staging domain | staging.ainow.biz |
| 7 | Architecture | Single VPS staging |
| 8 | Repo path | /opt/aisandbox |
| 9 | Env file path on VPS | /opt/aisandbox/.env |
| 10 | Env file permission | chmod 600 |
| 11 | Database | PostgreSQL 15 self-hosted on same VPS |
| 12 | Redis | Redis 7 self-hosted on same VPS |
| 13 | PostgreSQL host | localhost / 127.0.0.1 only |
| 14 | PostgreSQL port | 5432 — externally closed |
| 15 | Redis host | localhost / 127.0.0.1 only |
| 16 | Redis port | 6379 — externally closed |
| 17 | Redis password | Required via `requirepass` |
| 18 | Migration execution | Separate explicit approval only |
| 19 | App deployment | Later SETUP-07 only |
| 20 | Beta invite | Separate explicit approval only |
| 21 | Database name | `aisandbox` (matches existing codebase default) |
| 22 | App database user | `aisandbox` (matches existing codebase default) |
| 23 | Process manager | PM2 (app services only; PostgreSQL/Redis via systemd) |

---

## 7. PostgreSQL 15 Installation Plan

Method: Ubuntu system package from the official PostgreSQL APT repository.

- Install `postgresql-15` and `postgresql-client-15` via `apt` from `apt.postgresql.org`.
- Fallback: Ubuntu default repository (may provide PostgreSQL 14 or 16 depending on Ubuntu LTS version; PostgreSQL 15 from official repo preferred for version consistency with local development).
- Do NOT use Docker for PostgreSQL on staging — system package is simpler for single-VPS.
- Verify `psql --version` after installation.

Codebase dependencies: `pg` npm package (v8.17.2) and TypeORM (v0.3.28) require PostgreSQL. Default database name `aisandbox` and default user `aisandbox` match `services/api-gateway/src/config/database.config.ts`.

All commands are reference only — not executed in this task.

---

## 8. PostgreSQL Service Management Plan

PostgreSQL on Ubuntu installs as a systemd service. Key commands (reference only — not executed):

- `sudo systemctl status postgresql` — check service status
- `sudo systemctl enable postgresql` — enable on boot
- `sudo systemctl start postgresql` — start service
- `sudo systemctl restart postgresql` — restart after config changes
- `sudo systemctl reload postgresql` — reload config without restart
- `pg_lsclusters` — list PostgreSQL clusters

Service management rules:
- PostgreSQL managed by systemd, NOT by PM2.
- PM2 manages application services only (API Gateway, AI Service, Container Manager, Frontend).
- systemd manages infrastructure services (PostgreSQL, Redis, Caddy).
- `sudo systemctl enable postgresql` ensures PostgreSQL starts on VPS reboot.
- PostgreSQL must be running before any application service starts (startup order from SETUP-04).

---

## 9. PostgreSQL Localhost-Only Binding Plan

Configuration file: `/etc/postgresql/15/main/postgresql.conf`

Required setting:
```
listen_addresses = 'localhost'
```

This is the Ubuntu default. Verify it has not been changed to `'*'` or `'0.0.0.0'`.

Three-layer port closure:

| # | Layer | Requirement |
|---|-------|-------------|
| 1 | PostgreSQL config | `listen_addresses = 'localhost'` in `postgresql.conf` |
| 2 | Lightsail firewall | Port 5432 NOT in allowed inbound rules |
| 3 | UFW (optional) | `sudo ufw deny 5432/tcp` if UFW is active |

PostgreSQL must never bind to `0.0.0.0` or `*`. Port 5432 must not appear in Lightsail inbound firewall rules.

---

## 10. PostgreSQL Database Creation Plan

Database name: `aisandbox` (matches `POSTGRES_DB` env var default in codebase).

Future creation commands (reference only — not executed):
```bash
sudo -u postgres psql
CREATE USER <AISANDBOX_DB_USER> WITH PASSWORD '<KEITH_GENERATED_PASSWORD>';
CREATE DATABASE <AISANDBOX_DB_NAME> OWNER <AISANDBOX_DB_USER>;
\q
```

Rules:
- Database name matches `POSTGRES_DB` env var (expected: `aisandbox`).
- Database owner is the app user (expected: `aisandbox`), NOT `postgres` superuser.
- Keith generates the password on the VPS — value never leaves the VPS.
- Password set using `CREATE USER ... WITH PASSWORD` — never via config file.

---

## 11. PostgreSQL App User Creation Plan

App user name: `aisandbox` (matches `POSTGRES_USER` env var default in codebase).

Future creation commands (reference only — not executed):
```bash
sudo -u postgres psql
CREATE USER <AISANDBOX_DB_USER> WITH PASSWORD '<KEITH_GENERATED_PASSWORD>';
\q
```

App user rules:
- NOT the `postgres` superuser.
- No `SUPERUSER`, `CREATEDB`, or `CREATEROLE` attributes.
- Owns the application database.
- Password generated by Keith on VPS using `openssl rand -hex 32`.

---

## 12. PostgreSQL Password Handling Rules

| # | Rule |
|---|------|
| 1 | Password generated by Keith ONLY on the VPS |
| 2 | Generation command: `openssl rand -hex 32` |
| 3 | Used in `CREATE USER` SQL and in `.env` file — both on the VPS only |
| 4 | NEVER documented in any planning document |
| 5 | NEVER pasted into Cursor, chat, or any AI tool |
| 6 | NEVER committed to git |
| 7 | NEVER printed via `echo`, `cat`, or log output in AI-visible context |
| 8 | If exposed, STOP and rotate immediately |
| 9 | Each environment (staging, production) uses a unique password |
| 10 | Must not be the same as local development defaults |
| 11 | `POSTGRES_PASSWORD` env var in `/opt/aisandbox/.env` stores the password (chmod 600) |
| 12 | `DATABASE_URL` in `/opt/aisandbox/.env` contains the password as part of the connection string |
| 13 | Validation scripts must check presence of `POSTGRES_PASSWORD` without printing its value |

---

## 13. PostgreSQL Privilege Model

Principle: Least privilege for app runtime.

| Privilege | Granted? | Reason |
|-----------|----------|--------|
| Database owner | YES | TypeORM migrations require DDL access to owned database |
| CREATE on schema `public` | YES (implicit via database ownership) | Migrations create tables |
| SELECT/INSERT/UPDATE/DELETE | YES (implicit via table ownership) | Application runtime queries |
| SUPERUSER | NO | Security — prevent accidental system-wide changes |
| CREATEDB | NO | Not needed — database is created once by `postgres` superuser |
| CREATEROLE | NO | Not needed — roles are managed by `postgres` superuser |

TypeORM migrations run DDL statements (CREATE TABLE, ALTER TABLE, CREATE INDEX). Because the `aisandbox` user owns the `aisandbox` database, it has implicit DDL rights on the `public` schema. No additional `GRANT` statements should be needed.

---

## 14. `pg_hba.conf` Localhost-Only Authentication Plan

Configuration file: `/etc/postgresql/15/main/pg_hba.conf`

Required entries (conceptual — not applied):
```
# TYPE  DATABASE        USER            ADDRESS         METHOD
local   all             postgres                        peer
local   aisandbox       aisandbox                       scram-sha-256
host    aisandbox       aisandbox       127.0.0.1/32    scram-sha-256
host    aisandbox       aisandbox       ::1/128         scram-sha-256
```

Prohibited entries:
- `host all all 0.0.0.0/0 ...` — internet exposure
- `host all all ::/0 ...` — IPv6 internet exposure
- `host ... trust` — allows connection without password
- Any entry with broad CIDR range beyond `127.0.0.1/32` / `::1/128`

After editing `pg_hba.conf`, reload PostgreSQL: `sudo systemctl reload postgresql`.

---

## 15. `DATABASE_URL` Construction Rules (Without Values)

Format:
```
postgresql://<AISANDBOX_DB_USER>:<AISANDBOX_DB_PASSWORD>@localhost:5432/<AISANDBOX_DB_NAME>
```

Rules:
- Format only documented — never the actual value.
- Host is always `localhost` — NOT `postgres` (Docker hostname).
- Port is always `5432`.
- `<AISANDBOX_DB_PASSWORD>` = Keith-generated password — NEVER documented.
- Store only in `/opt/aisandbox/.env` on the VPS with `chmod 600`.
- Never print the constructed URL in logs, chat, or AI tools.
- Codebase: `services/api-gateway/src/config/database.config.ts` — Priority 1: uses `DATABASE_URL` if set; staging runs with `NODE_ENV=production`, so `DATABASE_URL` must use `localhost` explicitly.
- `services/ai-service` also reads `DATABASE_URL` directly.

---

## 16. PostgreSQL Verification Plan

Future verification checks (not executed):

| # | Check | Command | Expected Result |
|---|-------|---------|-----------------|
| 1 | Service active | `sudo systemctl status postgresql` | Active (running) |
| 2 | Localhost port listening | `sudo ss -tlnp \| grep 5432` | Listening on `127.0.0.1:5432` |
| 3 | External port closed | `sudo ss -tlnp \| grep 5432` | NOT on `0.0.0.0:5432` |
| 4 | Lightsail firewall check | Lightsail console → Networking tab | Port 5432 NOT listed |
| 5 | Database exists | `sudo -u postgres psql -c "\l" \| grep aisandbox` | `aisandbox` listed |
| 6 | App user can connect | `psql -U aisandbox -d aisandbox -h 127.0.0.1 -c "SELECT 1;"` | Returns `1` |
| 7 | App user not superuser | `SELECT usesuperuser FROM pg_user WHERE usename='aisandbox';` | Returns `f` |
| 8 | pg_isready | `pg_isready -U aisandbox -d aisandbox -h 127.0.0.1` | Exit code 0 |
| 9 | listen_addresses | `sudo grep -E '^listen_addresses' /etc/postgresql/15/main/postgresql.conf` | `localhost` |
| 10 | pg_hba.conf entries | `sudo grep aisandbox /etc/postgresql/15/main/pg_hba.conf` | Entries with `127.0.0.1/32` and `scram-sha-256` |

Verification must NOT print `DATABASE_URL`, `POSTGRES_PASSWORD`, or any secret.

---

## 17. PostgreSQL Backup Plan

Pre-migration backup:
```bash
mkdir -p /home/ubuntu/backups
pg_dump -U aisandbox -h 127.0.0.1 -d aisandbox > /home/ubuntu/backups/aisandbox_$(date +%Y%m%d_%H%M%S).sql
```

In addition: Lightsail instance snapshot before migration execution.

Rules:
- `pg_dump` before every migration execution.
- Lightsail snapshot before migration execution.
- Migration execution requires separate explicit Keith approval.
- No backup created in this planning step.
- Backup files stored in `/home/ubuntu/backups/` with timestamped filenames.
- Keep at least 7 daily backups.

---

## 18. Redis 7 Installation Plan

Method: Ubuntu system package from the official Redis APT repository.

- Option A (preferred): Official Redis repository — install `redis-server` from `packages.redis.io`.
- Option B: Ubuntu default repository (may provide Redis 6 on older Ubuntu LTS).
- Do NOT use Docker for Redis on staging — system package is simpler for single-VPS.
- Verify `redis-server --version` after installation (expected: Redis 7.x).

Codebase dependencies: `ioredis` (v5.9.3), `bullmq` (v5.70.1), execution streaming via Redis pub/sub.

All commands are reference only — not executed in this task.

---

## 19. Redis Service Management Plan

Redis on Ubuntu installs as systemd service named `redis-server`. Key commands (reference only — not executed):

- `sudo systemctl status redis-server` — check status
- `sudo systemctl enable redis-server` — enable on boot
- `sudo systemctl start redis-server` — start service
- `sudo systemctl restart redis-server` — restart after config changes

Rules:
- Redis managed by systemd, NOT by PM2.
- `sudo systemctl enable redis-server` ensures Redis starts on VPS reboot.
- Redis must be running before any application service starts.
- After any `redis.conf` change, restart the Redis service.

---

## 20. Redis Localhost-Only Binding Plan

Configuration file: `/etc/redis/redis.conf`

Required settings:
```
bind 127.0.0.1 ::1
protected-mode yes
```

Three-layer port closure:

| # | Layer | Requirement |
|---|-------|-------------|
| 1 | Redis config | `bind 127.0.0.1 ::1` in `redis.conf` |
| 2 | Lightsail firewall | Port 6379 NOT in allowed inbound rules |
| 3 | UFW (optional) | `sudo ufw deny 6379/tcp` if UFW is active |

Redis must never bind to `0.0.0.0` or `*`. `protected-mode` must be `yes`. Port 6379 must not appear in Lightsail inbound firewall rules.

---

## 21. Redis `requirepass` Plan

In `/etc/redis/redis.conf`:
```
requirepass <KEITH_GENERATED_PASSWORD>
```

Rules:
- `requirepass` must be set — unauthenticated access must be rejected.
- Password generated by Keith ONLY on the VPS using `openssl rand -hex 32`.
- Password entered directly into `redis.conf` on the VPS by Keith.
- Password NEVER documented in any planning document.
- Password NEVER pasted into Cursor, chat, or any AI tool.
- After setting `requirepass`, restart Redis: `sudo systemctl restart redis-server`.
- Same password used in `REDIS_PASSWORD` and `REDIS_URL` env vars.

---

## 22. `REDIS_URL` Construction Rules (Without Values)

Format:
```
redis://:<REDIS_PASSWORD>@localhost:6379
```

Rules:
- Format only documented — never the actual value.
- Host is always `localhost` — NOT `redis` (Docker hostname).
- Port is always `6379`.
- `<REDIS_PASSWORD>` = Keith-generated password — NEVER documented.
- No username needed for Redis (empty string before `:`).
- Store only in `/opt/aisandbox/.env` on the VPS with `chmod 600`.
- Never print the constructed URL in logs, chat, or AI tools.
- Codebase: `services/api-gateway/src/queue/queue.service.ts` reads `REDIS_URL`; `services/ai-service` reads `REDIS_URL` for BullMQ worker and execution streaming.

---

## 23. Redis Verification Plan

Future verification checks (not executed):

| # | Check | Command | Expected Result |
|---|-------|---------|-----------------|
| 1 | Service active | `sudo systemctl status redis-server` | Active (running) |
| 2 | Localhost port listening | `sudo ss -tlnp \| grep 6379` | Listening on `127.0.0.1:6379` |
| 3 | External port closed | `sudo ss -tlnp \| grep 6379` | NOT on `0.0.0.0:6379` |
| 4 | Lightsail firewall check | Lightsail console → Networking tab | Port 6379 NOT listed |
| 5 | Authentication required | `redis-cli ping` (no password) | `NOAUTH Authentication required.` |
| 6 | Authenticated ping works | `redis-cli -a '<password>' ping` | `PONG` |
| 7 | Protected mode enabled | `redis-cli -a '<password>' CONFIG GET protected-mode` | `yes` |
| 8 | Bind address check | `redis-cli -a '<password>' CONFIG GET bind` | `127.0.0.1 ::1` |

Verification must NOT print `REDIS_URL` or `REDIS_PASSWORD` in any context visible to AI.

---

## 24. App Connectivity Testing Handoff

After PostgreSQL and Redis are installed and configured:

Basic connectivity checks (DB/Redis only, before app deployment):
- `psql -U aisandbox -d aisandbox -h 127.0.0.1 -c "SELECT 1;"` — PostgreSQL accepts app user connection
- `redis-cli -a '<password>' ping` — Redis accepts authenticated connection
- `redis-cli ping` — Redis rejects unauthenticated connection (NOAUTH error)

After SETUP-07 (app deployment — NOT SETUP-06 scope):
- API Gateway health endpoint: `curl http://localhost:4000/api/health`
- API Gateway DB health: `curl http://localhost:4000/api/health/db`
- API Gateway readiness: `curl http://localhost:4000/api/health/ready`
- BullMQ queue connectivity: AI Service Worker starts without Redis connection errors

App-level connectivity testing belongs to SETUP-07. No browser/API smoke, no app health endpoints, no BullMQ testing in SETUP-06.

---

## 25. Firewall / Internal Port Safety

Lightsail firewall — allowed inbound ports:

| Port | Protocol | Status | Purpose |
|------|----------|--------|---------|
| 22 | TCP | OPEN | SSH access |
| 80 | TCP | OPEN | HTTP → HTTPS redirect (Caddy) |
| 443 | TCP | OPEN | HTTPS (Caddy reverse proxy) |
| 5432 | TCP | CLOSED | PostgreSQL — must NOT be exposed |
| 6379 | TCP | CLOSED | Redis — must NOT be exposed |
| 3002 | TCP | CLOSED | Frontend — internal only |
| 4000 | TCP | CLOSED | API Gateway — internal only |
| 4001 | TCP | CLOSED | AI Service — internal only |
| 4002 | TCP | CLOSED | Container Manager — internal only |

Rules:
- Only ports 22, 80, 443 open in Lightsail firewall.
- PostgreSQL (5432) never exposed — localhost binding + firewall closed.
- Redis (6379) never exposed — localhost binding + firewall closed + `protected-mode`.
- Application service ports (3002, 4000, 4001, 4002) are internal only.
- Never add 5432 or 6379 to Lightsail inbound rules.

---

## 26. Environment Dependency Notes from SETUP-05

### Database Variables

| # | Variable | Required Status | Value Rule |
|---|----------|----------------|------------|
| 1 | `DATABASE_URL` | Required — Keith must configure | Format: `postgresql://aisandbox:<PASSWORD>@localhost:5432/aisandbox` — value is Keith-only |
| 2 | `POSTGRES_HOST` | Required | `localhost` (NOT `postgres` Docker hostname) |
| 3 | `POSTGRES_PORT` | Required | `5432` |
| 4 | `POSTGRES_DB` | Required | `aisandbox` |
| 5 | `POSTGRES_USER` | Required | `aisandbox` |
| 6 | `POSTGRES_PASSWORD` | Required — Keith must configure | Generated with `openssl rand -hex 32` — value is Keith-only |

### Redis Variables

| # | Variable | Required Status | Value Rule |
|---|----------|----------------|------------|
| 7 | `REDIS_URL` | Required — Keith must configure | Format: `redis://:<PASSWORD>@localhost:6379` — value is Keith-only |
| 8 | `REDIS_HOST` | Required | `localhost` (NOT `redis` Docker hostname) |
| 9 | `REDIS_PORT` | Required | `6379` |
| 10 | `REDIS_PASSWORD` | Required — Keith must configure | Generated with `openssl rand -hex 32` — value is Keith-only |

Cross-reference with SETUP-05 env checklist (`docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md` Sections 12 and 13): classifications match — no conflicts.

All secret values (DATABASE_URL, POSTGRES_PASSWORD, REDIS_URL, REDIS_PASSWORD) are Keith-only. Values stored in `/opt/aisandbox/.env` with `chmod 600`.

---

## 27. Keith Manual Action Checklist

Keith must perform these actions on the VPS during future execution steps. Do NOT execute in this planning step.

### PostgreSQL Actions

| # | Action | Prerequisite | Notes |
|---|--------|-------------|-------|
| 1 | Install PostgreSQL 15 via official APT repository | SSH access to VPS | Section 6 of DB/Redis plan |
| 2 | Verify `psql --version` shows PostgreSQL 15 | PostgreSQL installed | Version check |
| 3 | Verify `listen_addresses = 'localhost'` in `postgresql.conf` | PostgreSQL installed | Binding safety |
| 4 | Generate `POSTGRES_PASSWORD` on VPS | VPS exists | `openssl rand -hex 32` — value stays on VPS |
| 5 | Create app user `aisandbox` with generated password | PostgreSQL running | Section 10 of plan |
| 6 | Create database `aisandbox` owned by app user | App user created | Section 9 of plan |
| 7 | Configure `pg_hba.conf` for localhost-only app access | PostgreSQL installed | Section 13 of plan |
| 8 | Reload PostgreSQL after `pg_hba.conf` change | `pg_hba.conf` edited | `sudo systemctl reload postgresql` |
| 9 | Verify app user can connect from localhost | User + database created | Section 15 check 6 of plan |
| 10 | Verify app user is NOT a superuser | User created | Section 15 check 7 of plan |
| 11 | Verify port 5432 NOT externally reachable | PostgreSQL running | Section 15 checks 2–4 of plan |
| 12 | Set `DATABASE_URL` in `/opt/aisandbox/.env` | Password generated, user created | Section 14 format |
| 13 | Set `POSTGRES_PASSWORD` in `/opt/aisandbox/.env` | Password generated | Same value as CREATE USER |

### Redis Actions

| # | Action | Prerequisite | Notes |
|---|--------|-------------|-------|
| 14 | Install Redis 7 via official APT repository | SSH access to VPS | Section 17 of plan |
| 15 | Verify `redis-server --version` shows Redis 7 | Redis installed | Version check |
| 16 | Set `bind 127.0.0.1 ::1` in `redis.conf` | Redis installed | Section 19 of plan |
| 17 | Set `protected-mode yes` in `redis.conf` | Redis installed | Section 19 of plan |
| 18 | Generate `REDIS_PASSWORD` on VPS | VPS exists | `openssl rand -hex 32` — value stays on VPS |
| 19 | Set `requirepass` in `redis.conf` with generated password | Redis installed | Section 20 of plan |
| 20 | Restart Redis after config changes | `redis.conf` edited | `sudo systemctl restart redis-server` |
| 21 | Verify authenticated ping works | `requirepass` set | Section 22 check 6 of plan |
| 22 | Verify unauthenticated access rejected | `requirepass` set | Section 22 check 5 of plan |
| 23 | Verify port 6379 NOT externally reachable | Redis running | Section 22 checks 2–4 of plan |
| 24 | Set `REDIS_URL` in `/opt/aisandbox/.env` | Password generated | Section 21 format |
| 25 | Set `REDIS_PASSWORD` in `/opt/aisandbox/.env` | Password generated | Same value as `requirepass` |
| 26 | Set `REDIS_HOST=localhost` in `/opt/aisandbox/.env` | Redis running | Known value |
| 27 | Set `REDIS_PORT=6379` in `/opt/aisandbox/.env` | Redis running | Known value |

### General Actions

| # | Action | Prerequisite | Notes |
|---|--------|-------------|-------|
| 28 | Enable PostgreSQL on boot | PostgreSQL installed | `sudo systemctl enable postgresql` |
| 29 | Enable Redis on boot | Redis installed | `sudo systemctl enable redis-server` |
| 30 | Create backup directory | SSH access | `mkdir -p /home/ubuntu/backups` |
| 31 | Create pre-migration `pg_dump` backup | Database exists, before any migration | Section 16 of plan |
| 32 | Create Lightsail snapshot | All DB/Redis setup complete | AWS console — before migration execution |

---

## 28. What Was Not Done

| # | Not Done |
|---|---------|
| 1 | PostgreSQL NOT installed |
| 2 | Redis NOT installed |
| 3 | Database NOT created |
| 4 | DB user NOT created |
| 5 | `postgresql.conf` NOT edited |
| 6 | `pg_hba.conf` NOT edited |
| 7 | `redis.conf` NOT edited |
| 8 | Passwords NOT generated or entered |
| 9 | `.env` file NOT created, opened, or edited |
| 10 | Secret values NOT printed, requested, or generated |
| 11 | Docker NOT used |
| 12 | DB commands NOT run |
| 13 | Redis commands NOT run |
| 14 | SSH NOT performed |
| 15 | AWS server/static IP NOT created |
| 16 | DNS/TLS/firewall NOT changed |
| 17 | Services NOT deployed |
| 18 | Implementation NOT done |
| 19 | Migrations NOT executed |
| 20 | Tests/builds NOT run |
| 21 | APIs NOT called |
| 22 | Users NOT invited |
| 23 | Source/test/package/migration/entity/environment/Docker/deployment files NOT changed |
| 24 | git commit/push NOT done |
| 25 | Subagents NOT used |
| 26 | SETUP-07 NOT registered |

---

## 29. Safety Boundaries Preserved

| # | Safety Boundary | Status |
|---|----------------|--------|
| 1 | No PostgreSQL installed | PRESERVED |
| 2 | No Redis installed | PRESERVED |
| 3 | No database created | PRESERVED |
| 4 | No DB user created | PRESERVED |
| 5 | No `postgresql.conf` edited | PRESERVED |
| 6 | No `pg_hba.conf` edited | PRESERVED |
| 7 | No `redis.conf` edited | PRESERVED |
| 8 | No password generated or entered | PRESERVED |
| 9 | No `.env` file created, opened, or edited | PRESERVED |
| 10 | No real `.env`, `.env.local`, `.env.staging`, `.env.production` opened | PRESERVED |
| 11 | No credential, key, certificate, or token file opened | PRESERVED |
| 12 | No secret values printed, requested, or generated | PRESERVED |
| 13 | No Docker/PostgreSQL/Redis used | PRESERVED |
| 14 | No DB commands run | PRESERVED |
| 15 | No Redis commands run | PRESERVED |
| 16 | No SSH to any server | PRESERVED |
| 17 | No AWS server/static IP created | PRESERVED |
| 18 | No DNS/TLS/firewall changed | PRESERVED |
| 19 | No deployment | PRESERVED |
| 20 | No implementation | PRESERVED |
| 21 | No source code changes | PRESERVED |
| 22 | No test file changes | PRESERVED |
| 23 | No package file changes | PRESERVED |
| 24 | No migration, entity, or schema file changes | PRESERVED |
| 25 | No environment file changes | PRESERVED |
| 26 | No Docker file changes | PRESERVED |
| 27 | No deployment file changes | PRESERVED |
| 28 | No migration execution | PRESERVED |
| 29 | No tests or builds run | PRESERVED |
| 30 | No APIs called | PRESERVED |
| 31 | No browser opened | PRESERVED |
| 32 | No beta users invited | PRESERVED |
| 33 | No subagents used | PRESERVED |
| 34 | No git commit or push | PRESERVED |

---

## 30. Product Impact

This task produced the complete PostgreSQL 15 and Redis 7 setup plan for the staging VPS. No runtime state was changed. The plan provides Keith with a concrete reference for:
- Installing and managing PostgreSQL 15 as a systemd service with localhost-only binding.
- Creating the `aisandbox` database and app user with least-privilege access.
- Configuring `pg_hba.conf` for localhost-only authentication.
- Installing and managing Redis 7 as a systemd service with localhost-only binding.
- Setting Redis `requirepass` for password-protected access.
- Constructing `DATABASE_URL` and `REDIS_URL` safely without documenting secret values.
- Verifying installation, connectivity, and security before app deployment.
- Creating pre-migration backups via `pg_dump` and Lightsail snapshots.
- Understanding firewall and internal port safety requirements.

---

## 31. Dependency / Handoff to SETUP-07

| Field | Value |
|-------|-------|
| Next child task | PRIVATE-BETA-STAGING-SETUP-07 |
| Title | App Deployment / Health Smoke Plan |
| Expected scope | Plan app deployment sequence, PM2 start procedure, health endpoint verification, external HTTPS smoke |
| Prerequisites | SETUP-06 COMPLETE and LOCKED (confirmed here) |
| Registration | Keith must explicitly approve SETUP-07 registration |

App connectivity checks (API Gateway health, DB health, BullMQ queue connectivity) are handed off to SETUP-07. They require application services to be deployed, which is SETUP-07 scope.

SETUP-07 is NOT registered in this step.

---

## 32. Acceptance Criteria Disposition

### Registration (Step 1 — COMPLETE 2026-07-22)
- [x] PRIVATE-BETA-STAGING-SETUP-06 added to TASKS_BACKLOG_FULL.md
- [x] PRIVATE-BETA-STAGING-SETUP-06 activated in TASKS.md
- [x] SETUP-01 through SETUP-05 remain COMPLETE and LOCKED
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE
- [x] 3-step child workflow recorded
- [x] No PostgreSQL/Redis action occurred
- [x] No DB/Redis command occurred
- [x] No real env file opened or edited
- [x] No secret values printed/requested/generated
- [x] No implementation during registration
- [x] No source/test/package/migration/entity/environment/Docker/deployment files changed
- [x] No subagents used

### Database / Redis Setup Plan (Step 2 — COMPLETE 2026-07-22)
- [x] All 24 scope items covered (see `docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md`)
- [x] No PostgreSQL/Redis installation occurred
- [x] No DB/Redis commands run
- [x] No real env file created, opened, or edited
- [x] No secret values printed, requested, or committed
- [x] Step 2 verdict: PASS — all criteria met — no blockers identified
- [x] Keith explicit approval recorded before starting Step 2 ("go" — 2026-07-22)

### Consolidation / Handoff to SETUP-07 (Step 3 — COMPLETE 2026-07-22)
- [x] Plan document created: `docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md`
- [x] Checkpoint document created: `docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md`
- [x] PRIVATE-BETA-STAGING-SETUP-06 marked COMPLETE and LOCKED
- [x] AINOW-EXECUTION-ROADMAP.md updated
- [x] SETUP-07 not registered in this step

---

## 33. Locked-State Instruction

PRIVATE-BETA-STAGING-SETUP-06 is COMPLETE and LOCKED as of 2026-07-22.

- The DB/Redis plan (`docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md`) must not be modified.
- This checkpoint (`docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md`) must not be modified.
- SETUP-06 task entries in TASKS.md and TASKS_BACKLOG_FULL.md are locked.
- Any documentation correction to locked tasks requires explicit approval.
- No implementation, installation, configuration, or execution of any kind was or may be attributed to SETUP-06.
- PostgreSQL and Redis installation/configuration remain pending — they belong to a future Keith-executed step, NOT to this planning task.

---

## 34. Exact Next Action

**Register PRIVATE-BETA-STAGING-SETUP-07 — App Deployment / Health Smoke Plan.**

Keith must explicitly approve SETUP-07 registration before it can begin.

SETUP-07 scope (expected): Plan app deployment sequence, PM2 start procedure, health endpoint verification, external HTTPS smoke via staging.ainow.biz.

No PostgreSQL installation. No Redis installation. No database creation. No user creation. No config editing. No password generation. No secret entry. No implementation. No deployment. No runtime. No SSH. No Docker. No migration. No subagents. No git commit or push.

---

**Checkpoint created:** 2026-07-22
**PRIVATE-BETA-STAGING-SETUP-06 status:** COMPLETE and LOCKED — 2026-07-22
**All 3 steps COMPLETE.**
**Plan document:** `docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md`
**Checkpoint document:** `docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md`
**No PostgreSQL installed. No Redis installed. No database created. No DB user created. No config edited. No password generated. No `.env` opened/created/edited. No secret values printed/requested/generated. No implementation. No source/test/package/migration/entity/environment/Docker/deployment files changed. No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred. No git commit or push. No secret-bearing environment file opened. No subagents used.**
