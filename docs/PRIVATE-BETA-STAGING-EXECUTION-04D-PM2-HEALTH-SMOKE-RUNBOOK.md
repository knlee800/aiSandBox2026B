# PRIVATE-BETA-STAGING-EXECUTION-04D — PM2 Service Start + Health-Only Smoke Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04D  
**Title:** PM2 Service Start + Health-Only Smoke  
**Step:** 2 — PM2 Service Start + Health-Only Smoke Runbook  
**Date created:** 2026-07-27  
**Nature:** Runbook for Keith manual execution inside AWS Lightsail browser SSH. Documentation/runbook creation only in Cursor. No SSH/AWS action in Cursor. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## Section 1 — Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04D |
| Title | PM2 Service Start + Health-Only Smoke |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | HIGH-RISK — first app process start on production-like staging VPS; secret-bearing runtime env; migration/DNS/TLS/paid-execution stop conditions |
| Registered | 2026-07-26 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |
| Child slice | 4 of 4 of EXECUTION-04 manual execution split |
| Future snapshot | `aisandbox-staging-prepm2-health-2026-07-26` |

### Authoritative state carried forward

| Item | State |
|------|-------|
| PRIVATE-BETA-STAGING-EXECUTION-04A | COMPLETE and LOCKED — 2026-07-25 |
| PRIVATE-BETA-STAGING-EXECUTION-04B | COMPLETE and LOCKED — 2026-07-26 |
| PRIVATE-BETA-STAGING-EXECUTION-04C | COMPLETE and LOCKED — 2026-07-26 |
| PRIVATE-BETA-STAGING-EXECUTION-04D | ACTIVE — Step 1 COMPLETE (Registration — 2026-07-26) |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

### Staging state inherited from 04C (record)

```text
VPS repo path: /opt/aisandbox
VPS repo commit: 3da1b7c Implement staging npm lockfile policy
Root package-lock.json present on VPS
Dependencies installed successfully using root npm ci
NPM_CI_EXIT=0
Build completed successfully for:
  - API Gateway
  - AI Service
  - Container Manager
  - Frontend
Generated artifacts present:
  - services/api-gateway/dist
  - services/ai-service/dist
  - services/container-manager/dist
  - frontend/.next
/opt/aisandbox/.env exists privately
.env owner/mode: ubuntu ubuntu 600 /opt/aisandbox/.env
.env values were not printed
Google OAuth remains deferred
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL intentionally omitted
No fake Google OAuth placeholders
PM2 app list was empty after 04C
App systemd services were inactive after 04C
Database public table count was 0
No DNS/TLS configured
No billing/payment/AI/container execution enabled
No secrets disclosed
```

---

## Section 2 — Purpose

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the EXECUTION-04D manual execution step.

The sole goal of this child slice is to:

1. Create a pre-PM2 Lightsail snapshot rollback point.
2. Verify the 04C install/build baseline remains intact.
3. Start only the approved built app processes under PM2.
4. Verify PM2 process status.
5. Run **local health-only** smoke checks.
6. Capture safe evidence summaries only.

This runbook is the authoritative reference for the 04D manual execution session. Follow it section by section without skipping.

**This Cursor Step 2 creates the runbook only.** Do not execute server commands from Cursor. Do not SSH. Do not use AWS CLI from Cursor.

---

## Section 3 — What 04D Does

When executed by Keith, this slice:

1. Confirms EXECUTION-04A / 04B / 04C final state is intact.
2. Creates a pre-PM2 Lightsail snapshot as a rollback point.
3. Verifies repo path, branch, commit `3da1b7c`, and build artifacts.
4. Verifies `/opt/aisandbox/.env` exists with owner `ubuntu:ubuntu` and chmod `600` **without printing values**.
5. Verifies Google OAuth keys remain intentionally omitted (no fake placeholders).
6. Confirms PostgreSQL and Redis local readiness (status / safe connectivity only).
7. Discovers PM2 ecosystem / package start scripts before selecting commands.
8. Starts only approved app processes under PM2 with root `.env` available as runtime input.
9. Verifies PM2 process status.
10. Runs localhost health-only smoke checks for source-verified endpoints.
11. Captures safe PM2 log summaries only.
12. Confirms no migrations, no DNS/TLS, no billing/payment/AI/container execution enablement, and no secrets printed.

---

## Section 4 — What 04D Does Not Do

This slice does **not**:

- Run database migrations (`migration:run`, `migration:run:prod`, `db:migrate`, `db:reset`, TypeORM migrate)
- Create database tables intentionally
- Configure DNS A records
- Configure TLS / Caddy site routes / certificates
- Enable real AI provider calls
- Enable billing / payment execution
- Enable container / session execution
- Enable Google OAuth
- Print `.env` contents or any secret env values
- Ask Keith to paste any secret value into chat
- Install dependencies (`npm ci`, `npm install`, Bun)
- Rebuild app packages (avoid unless a later approved task requires it)
- Run root `npm run start:all`, `npm run start:all:bash`, `npm run dev`, `npm run db:migrate`, or any broad script with unclear side effects
- Perform login/register flows or create user data
- Call `/api/ai/execute`, billing endpoints, payment endpoints, or provider APIs
- Send emails
- Modify source code
- Commit or push git
- Mark PRIVATE-BETA-DEPLOYMENT-READINESS ready
- Claim full private-beta deployment complete

---

## Section 5 — Preconditions from 04A/04B/04C

Before starting manual execution, confirm all of the following:

| # | Precondition | Required state |
|---|-------------|----------------|
| 1 | EXECUTION-04A | COMPLETE and LOCKED — 2026-07-25 — Evidence verdict PASS |
| 2 | EXECUTION-04B | COMPLETE and LOCKED — 2026-07-26 — Evidence review verdict PASS |
| 3 | Google OAuth decision | COMPLETE and LOCKED — 2026-07-26 — Outcome B — deferred |
| 4 | EXECUTION-04C | COMPLETE and LOCKED — 2026-07-26 — Evidence review verdict PASS |
| 5 | EXECUTION-04D Step 1 (Registration) | COMPLETE — 2026-07-26 |
| 6 | Parent EXECUTION-04 | ACTIVE |
| 7 | PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |
| 8 | VPS repo path | `/opt/aisandbox` |
| 9 | VPS commit | `3da1b7c` |
| 10 | Root `package-lock.json` | Present |
| 11 | Root `npm ci` | PASS (`NPM_CI_EXIT=0`) |
| 12 | Builds | API Gateway / AI Service / Container Manager / Frontend PASS |
| 13 | Artifacts | `dist` for three Nest services + `frontend/.next` present |
| 14 | `/opt/aisandbox/.env` | Exists — `ubuntu ubuntu 600` — values not printed |
| 15 | Google OAuth keys | Intentionally omitted — no fake placeholders |
| 16 | Kill switches (04B baseline) | All listed kill switches false |
| 17 | PM2 after 04C | Empty app list |
| 18 | App systemd services after 04C | Inactive |
| 19 | Database public table count | `0` |
| 20 | Migrations | Not run |
| 21 | DNS/TLS | Not configured |
| 22 | Billing/payment/AI/container execution | Not enabled |
| 23 | Secrets | Not disclosed |
| 24 | Runtime baseline | Ubuntu 24.04.4 LTS — Node.js v20.20.2 — npm 10.8.2 — Docker Engine 29.6.2 — Docker Compose v5.3.1 — PM2 7.0.3 — Caddy v2.11.4 |
| 25 | Prior snapshots | Through `aisandbox-staging-preinstall-build-postlockfile-2026-07-26` Available |

If any precondition is not met, stop and resolve before proceeding.

---

## Section 6 — Lightsail Browser SSH Instruction

**All server commands in this runbook must be run inside the AWS Lightsail browser SSH console.**

**Do NOT run server commands in PowerShell, CMD, or local terminal.**

**Do NOT use AWS CLI from this Cursor session.**

To open the Lightsail browser SSH console:

1. Log into AWS Console → Lightsail.
2. Select the `aisandbox-staging` instance.
3. Click **Connect using SSH** (or the terminal icon).
4. The browser SSH console opens.
5. Run all commands in that console.

Default user is `ubuntu`. Commands requiring root use `sudo`.

**Nano editor shortcuts in the Lightsail browser SSH session (if needed):**

- `Ctrl+O` then `Enter` — save (write out)
- `Ctrl+X` — exit
- **Do NOT use `Ctrl+W`** in Lightsail browser SSH — it may close the browser tab.

---

## Section 7 — Secret Safety Rules

These rules are **absolute** and must be followed at all times during this child slice.

| # | Rule |
|---|------|
| 1 | Do NOT paste any `.env` file contents into this chat or any AI tool |
| 2 | Do NOT run `cat /opt/aisandbox/.env` |
| 3 | Do NOT echo secret env values |
| 4 | Do NOT run `env` or `printenv` after sourcing `.env` |
| 5 | Do NOT paste `DATABASE_URL` or `REDIS_URL` |
| 6 | Do NOT paste DB / Redis passwords |
| 7 | Do NOT paste JWT / session / internal keys (`JWT_SECRET`, `SESSION_SECRET`, `OAUTH_STATE_SECRET`, `INTERNAL_SERVICE_KEY`, etc.) |
| 8 | Do NOT paste provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) |
| 9 | Do NOT paste OAuth secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.) |
| 10 | Do NOT paste SSH private keys or AWS credentials |
| 11 | `/opt/aisandbox/.env` may be used by app processes only as runtime input — never print it |
| 12 | Capture only safe summary logs; redact any accidental secret before pasting evidence |
| 13 | Do not paste shell history if it may include secret values |
| 14 | Review PM2 logs locally before pasting; prefer short redacted summaries |
| 15 | If any secret appears in logs or chat, **stop immediately** and rotate exposed secrets |

---

## Section 8 — Pre-PM2-Start Snapshot Recommendation

**Create this Lightsail snapshot before starting any PM2 app process.**

### Recommended snapshot name

```text
aisandbox-staging-prepm2-health-2026-07-26
```

### Critical rules

- Snapshot is created in the **AWS Lightsail UI**, not by SSH.
- Wait until snapshot status is **Available**.
- Do **not** proceed if snapshot creation fails.
- Do **not** proceed if snapshot remains **Pending**.

### Snapshot instructions (Lightsail UI)

1. Open AWS Console → Lightsail → instance `aisandbox-staging`.
2. Open the **Snapshots** tab.
3. Create snapshot named exactly:

```text
aisandbox-staging-prepm2-health-2026-07-26
```

4. Wait until status shows **Available**.
5. Only then continue to Section 9.

### Why this snapshot matters

This is the rollback point immediately before first app process start. If PM2 startup, env loading, or health smoke leaves the host in a bad state, restore from this snapshot.

---

## Section 9 — Repo/Build/Artifact Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
cd /opt/aisandbox
pwd
ls -ld /opt/aisandbox
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
git status --short
test -f /opt/aisandbox/package-lock.json && echo "ROOT_PACKAGE_LOCK=yes" || echo "ROOT_PACKAGE_LOCK=no"
test -d /opt/aisandbox/node_modules && echo "ROOT_NODE_MODULES=yes" || echo "ROOT_NODE_MODULES=no"
test -d /opt/aisandbox/services/api-gateway/dist && echo "API_GATEWAY_DIST=yes" || echo "API_GATEWAY_DIST=no"
test -f /opt/aisandbox/services/api-gateway/dist/main.js && echo "API_GATEWAY_MAIN=yes" || echo "API_GATEWAY_MAIN=no"
test -d /opt/aisandbox/services/ai-service/dist && echo "AI_SERVICE_DIST=yes" || echo "AI_SERVICE_DIST=no"
test -f /opt/aisandbox/services/ai-service/dist/main.js && echo "AI_SERVICE_MAIN=yes" || echo "AI_SERVICE_MAIN=no"
test -d /opt/aisandbox/services/container-manager/dist && echo "CONTAINER_MANAGER_DIST=yes" || echo "CONTAINER_MANAGER_DIST=no"
test -f /opt/aisandbox/services/container-manager/dist/main.js && echo "CONTAINER_MANAGER_MAIN=yes" || echo "CONTAINER_MANAGER_MAIN=no"
test -d /opt/aisandbox/frontend/.next && echo "FRONTEND_NEXT=yes" || echo "FRONTEND_NEXT=no"
pm2 --version
pm2 list
```

### Expected results

| Check | Expected |
|-------|----------|
| Path | `/opt/aisandbox` |
| Branch | `main` |
| Commit | `3da1b7c` (or documented successor only if deliberately synced later — otherwise stop and report) |
| `ROOT_PACKAGE_LOCK` | `yes` |
| `ROOT_NODE_MODULES` | `yes` |
| Dist / main.js markers | all `yes` |
| `FRONTEND_NEXT` | `yes` |
| PM2 version | `7.0.3` (or previously recorded staging baseline) |
| `pm2 list` before start | Empty / no aisandbox app processes |

### Stop if

- Repo/artifact baseline unexpected
- Commit is not the expected 04C baseline and was not intentionally synced
- Any required `dist/main.js` or `frontend/.next` missing
- Unexpected source modifications already present
- PM2 already has unexpected app processes from an unauthorized prior start

---

## Section 10 — `.env` Existence and Permission Verification (No Values)

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
test -f /opt/aisandbox/.env && echo "ENV_EXISTS=yes" || echo "ENV_EXISTS=no"
stat -c '%U %G %a %n' /opt/aisandbox/.env
```

### Expected results

| Check | Expected |
|-------|----------|
| Exists | `ENV_EXISTS=yes` |
| Stat line | `ubuntu ubuntu 600 /opt/aisandbox/.env` |

### Absolute prohibitions

- Do **not** run `cat /opt/aisandbox/.env`
- Do **not** run `head`, `tail`, `less`, `more`, or `sed` against `.env`
- Do **not** print any key values

### Stop if

- `.env` missing
- Permission is not `600`
- Owner/group is not `ubuntu ubuntu`

---

## Section 11 — Google OAuth Deferred Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Presence-only check. Do not print values.

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('/opt/aisandbox/.env').read_text(encoding='utf-8', errors='replace')
keys = set()
for line in text.splitlines():
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k = s.split('=', 1)[0].strip()
    keys.add(k)
for name in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'):
    print(f'{name}_PRESENT={"yes" if name in keys else "no"}')
bad_markers = ('changeme', 'placeholder', 'your-client', 'xxx', 'TODO', 'replace-me')
for line in text.splitlines():
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k, v = s.split('=', 1)
    k = k.strip()
    if k in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'):
        low = v.strip().strip('"').strip("'").lower()
        if any(m.lower() in low for m in bad_markers) or low in ('', 'null', 'none', 'false'):
            print(f'GOOGLE_FAKE_OR_EMPTY_PLACEHOLDER={k}')
print('GOOGLE_OAUTH_DEFERRED_CHECK=done')
PY
```

### Expected results

| Check | Expected |
|-------|----------|
| `GOOGLE_CLIENT_ID_PRESENT` | `no` |
| `GOOGLE_CLIENT_SECRET_PRESENT` | `no` |
| `GOOGLE_CALLBACK_URL_PRESENT` | `no` |
| Fake / empty placeholders | None reported |
| Intended staging auth path | Email/password (unchanged from 04B) |

### Stop if

- Any Google OAuth key is present unexpectedly with fake placeholders
- Evidence indicates Google OAuth was re-enabled unsafely

---

## Section 12 — PostgreSQL and Redis Local Readiness Checks

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Do not print Redis URL or password.

```bash
systemctl is-active postgresql
systemctl is-active redis-server || systemctl is-active redis
sudo -u postgres psql -d aisandbox -tAc "SELECT 1;"
pg_isready -h 127.0.0.1 -p 5432 -d aisandbox || true
```

### Expected / acceptable

| Check | Expected |
|-------|----------|
| PostgreSQL systemd | `active` |
| Redis systemd | `active` (`redis-server` or `redis`) |
| `SELECT 1` | `1` |
| Redis auth ping using password | **Not required** for 04D if systemd is active — prefer status-only to avoid password exposure |

### Redis note

Because Redis `requirepass` is configured and must not be printed, prefer local service status only unless a safe authenticated ping method exists that does not expose the password in shell history or evidence.

Do **not** paste Redis URL, password, or `redis-cli -a ...` command lines containing secrets.

### Stop if

- PostgreSQL inactive when required for app startup
- Redis inactive when required for app startup
- Any readiness command prints secrets

---

## Section 13 — PM2 Startup Command Discovery

**Run inside AWS Lightsail browser SSH — not PowerShell. Discovery only — do not start services yet.**

### 13A — Discover ecosystem / PM2 files and package scripts

```bash
cd /opt/aisandbox
find /opt/aisandbox -maxdepth 3 \( -iname "*ecosystem*" -o -iname "*pm2*" \) -print
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts||{}, null, 2))"
for pkg in frontend services/api-gateway services/ai-service services/container-manager; do
  echo "==== $pkg ===="
  node -e "const p=require('./$pkg/package.json'); console.log(JSON.stringify({name:p.name, main:p.main||null, scripts:p.scripts||{}}, null, 2))"
done
pm2 --version
pm2 start --help 2>&1 | sed -n '1,120p' || true
```

### 13B — Source/package evidence already verified in repo (record)

Repo inspection for this runbook found:

| Item | Finding |
|------|---------|
| Checked-in PM2 ecosystem file | **None found** under repo root / common paths |
| Root scripts | `start:all`, `start:all:bash`, `dev`, `db:migrate`, etc. — **unsafe / out of scope for 04D** |
| `services/api-gateway` | `"main": "dist/main.js"`, `"start": "node dist/main.js"` — also has `migration:*` scripts (**do not run**) |
| `services/ai-service` | `"main": "dist/main.js"`, `"start": "node dist/main.js"` |
| `services/container-manager` | `"main": "dist/main.js"`, `"start": "node dist/main.js"` |
| `frontend` | `"start": "next start"` — `"dev": "next dev -p 3002"` (dev only; do not use) |
| `start:prod` scripts | **Not present** in inspected package.json files |

### 13C — Decision logic (mandatory)

1. Prefer an existing checked-in PM2 ecosystem file **only if present on VPS and clearly safe** (no migrations, no install/build, no DNS/TLS, no secret printing).
2. If no ecosystem file exists (expected), use **explicit PM2 commands** based on built outputs and package scripts.
3. Do **not** invent PM2 commands without source/package evidence.
4. Do **not** run package scripts that trigger migrations, dev servers, dependency installs, builds, Docker, DNS/TLS, or provider calls.
5. Do **not** run `npm run start:all`, `npm run start:all:bash`, `npm run dev`, `npm run db:migrate`, `npm run migration:*`, or any broad script.
6. If start command is unclear after discovery, **STOP and report** before starting services.

### Stop if

- Discovery shows an unexpected ecosystem/start path that would install/build/migrate/configure DNS/TLS
- Start command remains unclear
- Only available start path is a broad unsafe script

---

## Section 14 — PM2 Service Definition / Command Selection

### Minimal approved app processes for health-only smoke

Subject to Section 13 discovery confirming artifacts still present:

| Process name | Package | Built entry / start evidence | Default local port (source) |
|--------------|---------|------------------------------|-----------------------------|
| `api-gateway` | `@aisandbox/api-gateway` | `dist/main.js` / `"start": "node dist/main.js"` | `process.env.PORT \|\| process.env.API_PORT \|\| 4000` |
| `ai-service` | `@aisandbox/ai-service` | `dist/main.js` / `"start": "node dist/main.js"` | `process.env.PORT \|\| 4001` |
| `container-manager` | `@aisandbox/container-manager` | `dist/main.js` / `"start": "node dist/main.js"` | `process.env.PORT \|\| 4002` |
| `frontend` | `@aisandbox/frontend` | `"start": "next start"` with `frontend/.next` present | Next.js uses `PORT`; staging target historically `3002` |

### Critical PORT note

A single shared `/opt/aisandbox/.env` can contain only one `PORT` value. Nest services and frontend all read `PORT`. Therefore 04D **must** override `PORT` per PM2 process at start time so processes do not collide on one port.

### Selected guidance when discovery matches repo evidence (no ecosystem file)

Prefer direct Node entrypoints for Nest services (avoids accidental npm script side effects):

```bash
# Discovery-gated authorized pattern — only after Section 13 confirms no safe ecosystem file
# and package scripts/artifacts match the evidence above.
```

Authorized explicit pattern:

1. Load `/opt/aisandbox/.env` into the shell session without printing values (Section 15).
2. Start Nest services with absolute `dist/main.js` paths, per-process `PORT=...`, and `--cwd` set to each service directory.
3. Start frontend with `pm2 start npm --name frontend --cwd /opt/aisandbox/frontend -- start` and `PORT=3002`.
4. Do **not** use root `start:all` / `dev` / migration scripts.

If VPS discovery finds a checked-in safe ecosystem file that differs from this guidance, stop and report before improvising.

If discovery shows package scripts no longer match the evidence above, stop and report.

---

## Section 15 — Safe PM2 Service Start

**Run inside AWS Lightsail browser SSH — not PowerShell. Only after Sections 8–14 PASS.**

### 15A — Environment loading (no printing)

Preferred safe approach for this slice (no checked-in ecosystem file found in repo):

```bash
cd /opt/aisandbox
set -a
. /opt/aisandbox/.env
set +a
```

**Warnings if this approach is used:**

- Do **not** run `env`
- Do **not** run `printenv`
- Do **not** echo secrets
- Do **not** paste shell history if it includes secret values
- Keep using the same shell session for subsequent `pm2 start` commands so inherited env is available

Optional discovery: if `pm2 start --help` clearly documents a supported `--env-file` flag on the installed PM2 7.x, Keith may use `--env-file /opt/aisandbox/.env` **instead of** shell sourcing. Do not invent unsupported flags. Do not print the file.

AI Service source loads dotenv from `cwd/.env` then `../../.env` when cwd is the service directory. API Gateway / Container Manager use `dotenv/config` relative to process cwd. Shared root `.env` loading via shell/`--env-file` remains the safer explicit approach for all processes.

### 15B — Start approved processes (explicit commands)

Run only after env is loaded in the same shell:

```bash
# API Gateway
PORT=4000 pm2 start /opt/aisandbox/services/api-gateway/dist/main.js \
  --name api-gateway \
  --cwd /opt/aisandbox/services/api-gateway

# AI Service
PORT=4001 pm2 start /opt/aisandbox/services/ai-service/dist/main.js \
  --name ai-service \
  --cwd /opt/aisandbox/services/ai-service

# Container Manager
PORT=4002 pm2 start /opt/aisandbox/services/container-manager/dist/main.js \
  --name container-manager \
  --cwd /opt/aisandbox/services/container-manager

# Frontend (Next.js production start — package script: "start": "next start")
PORT=3002 pm2 start npm \
  --name frontend \
  --cwd /opt/aisandbox/frontend \
  -- start
```

### 15C — Forbidden start commands

Do **not** run:

- `npm run start:all`
- `npm run start:all:bash`
- `npm run dev`
- `npm run db:migrate` / `npm run db:reset`
- `npm run migration:run` / `migration:run:prod` / `migration:revert` / `migration:show` / `migration:create`
- `next dev`
- Docker compose up/down for app deploy in this slice
- Any Caddy/DNS/TLS configuration command

### 15D — If a service fails because DB tables are missing

Stop. Record:

- service startup blocked by migrations not run
- no migrations performed
- do **not** run migrations to fix startup
- evidence verdict should be **PASS WITH BLOCKER** or **BLOCKED**, depending on severity

### Stop if

- Pre-PM2 snapshot not Available
- PM2 command unclear
- Start command would install/build/migrate/configure DNS/TLS
- Start command would run broad unsafe scripts
- Any process prints secrets during start
- Any process starts migrations or creates tables
- Crash / restart loop begins and does not stabilize

---

## Section 16 — PM2 Status Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
pm2 list
pm2 describe api-gateway
pm2 describe ai-service
pm2 describe container-manager
pm2 describe frontend
```

### Expected

| Process | Expected status |
|---------|-----------------|
| `api-gateway` | `online` and stable (or clearly reported blocked) |
| `ai-service` | `online` and stable (or clearly reported blocked) |
| `container-manager` | `online` and stable (or clearly reported blocked) |
| `frontend` | `online` and stable (or clearly reported blocked) |

### Optional after stable online (not DNS/TLS)

Only if all intended processes are stable and no stop condition fired:

```bash
pm2 save
```

`pm2 startup` may be deferred if uncertain; if run, follow only the printed local systemd registration instruction. Do **not** configure Caddy/DNS/TLS.

### Stop if

- Process status `errored` / `stopped` without clear documented blocker
- Restart loop / unstable flapping
- Secrets appear in `pm2 describe` output (do not paste those values)

---

## Section 17 — Local Health-Only Smoke Checks

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### Boundaries

- Use `localhost` only.
- Do **not** use public DNS.
- Do **not** configure DNS/TLS.
- Do **not** perform login/register flows.
- Do **not** trigger AI execution.
- Do **not** trigger container/session execution.
- Do **not** trigger billing/payment actions.
- Do **not** send emails.
- Prefer health/readiness endpoints only.
- Record **HTTP status codes** preferentially; do not paste response bodies that may contain config/env details.

### Source-grounded endpoint findings

| Service | Source finding | Approved smoke |
|---------|----------------|----------------|
| API Gateway | `HealthController` `@Controller('health')` + `setGlobalPrefix('api')` → `/api/health`, `/api/health/db`, `/api/health/ready` | Yes — localhost status-code checks |
| API Gateway `/api/health/live` | **Not found in source** | Do **not** require; do not invent |
| Container Manager | `HealthController` `@Controller('health')` + `setGlobalPrefix('api')` → `/api/health` | Yes |
| AI Service | **No `HealthController` found**; `main.ts` logs `/api/health` but no matching controller; optional read-only `GET /api/conversations` exists and returns a tiny ok payload | Prefer PM2 `online` as primary; optional conversations GET status only if needed |
| Frontend | Next.js listens on `PORT` (use `3002` override) | `GET http://localhost:3002` status only |

### 17A — API Gateway

```bash
curl -s -o /dev/null -w 'api_gateway_health=%{http_code}\n' http://localhost:4000/api/health
curl -s -o /dev/null -w 'api_gateway_health_db=%{http_code}\n' http://localhost:4000/api/health/db
curl -s -o /dev/null -w 'api_gateway_health_ready=%{http_code}\n' http://localhost:4000/api/health/ready
```

Notes:

- `/api/health` should be the safest basic liveness-style check.
- `/api/health/db` runs `SELECT 1` and may return non-200 if DB is unreachable.
- `/api/health/ready` may return non-200 if env/DB/kill-switch readiness fails. Because tables are expected to remain `0`, treat non-200 readiness as a possible **migration/schema blocker**, not a reason to migrate.
- Do **not** paste full `/api/health/ready` JSON bodies into chat (may include environment/check details). Status code + short redacted summary only.

### 17B — Container Manager

```bash
curl -s -o /dev/null -w 'container_manager_health=%{http_code}\n' http://localhost:4002/api/health
```

### 17C — AI Service (discovery-gated / process-primary)

```bash
pm2 jlist | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const a=JSON.parse(d||'[]');const p=a.find(x=>x.name==='ai-service'); console.log(p?('ai_service_status='+p.pm2_env.status):'ai_service_status=missing');});"
# Optional secondary only if process is online and you need an HTTP probe:
curl -s -o /dev/null -w 'ai_service_conversations=%{http_code}\n' http://localhost:4001/api/conversations || true
```

Do **not** treat missing `GET /api/health` on AI Service as a reason to invent endpoints or enable providers.

### 17D — Frontend

```bash
curl -s -o /dev/null -w 'frontend_root=%{http_code}\n' http://localhost:3002
```

### 17E — Explicitly forbidden smoke actions

Do **not** call:

- `POST /api/ai/execute`
- billing / payment / checkout / topup / portal endpoints
- container create/start/stop/exec endpoints
- auth register/login flows
- email-sending endpoints
- provider APIs
- any public/non-localhost URL

### Acceptance nuance for 04D

Because migrations are intentionally not run and public table count must remain `0`, it is acceptable for some readiness/DB checks to fail with a clearly recorded **migrations-not-run blocker**, provided:

1. No migrations were run to “fix” it.
2. No secrets were printed.
3. No billing/payment/AI/container execution was enabled.
4. Process status and basic health outcomes are recorded honestly.

### Stop if

- Health smoke would create data or call providers
- Smoke requires public DNS/TLS
- Service fails to start and root cause is unclear
- Any endpoint call appears to trigger execution/billing/provider paths

---

## Section 18 — Safe Log Capture

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
pm2 list
pm2 logs api-gateway --lines 50 --nostream
pm2 logs ai-service --lines 50 --nostream
pm2 logs container-manager --lines 50 --nostream
pm2 logs frontend --lines 50 --nostream
```

### Rules

- Review logs before pasting.
- Prefer short redacted summaries over full dumps.
- Redact secrets.
- Do **not** paste `.env`, `DATABASE_URL`, `REDIS_URL`, tokens, passwords, keys, or provider credentials.
- If secrets appear, stop and rotate.

Record only:

- process online/errored/stopped
- whether startup completed
- whether DB/Redis connection errors appeared (**yes/no**, no connection strings)
- whether migration language appeared (**yes/no**)
- whether provider/billing/execution enablement language appeared (**yes/no**)

---

## Section 19 — Confirm No Migrations

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

### Expected

```text
0
```

### Rules

- 04D must **not** run migrations.
- Database public table count is expected to remain `0`.
- TypeORM production config uses `synchronize: false` — do not change that.
- Do not run `migration:run`, `migration:run:prod`, `db:migrate`, or equivalent.

### If services cannot start because tables are missing

Stop and record:

- service startup blocked by migrations not run
- no migrations performed
- 04D evidence verdict should be **PASS WITH BLOCKER** or **BLOCKED**, depending on severity

### Stop if

- Table count changes from `0`
- Any migration command was run
- Logs show schema sync/create that changes table count

---

## Section 20 — Confirm No DNS/TLS

DNS/TLS remains an explicit non-goal for 04D.

Confirm by intent and evidence:

| Check | Expected |
|-------|----------|
| DNS A record changes | Not performed |
| Caddy site / TLS cert issuance | Not performed |
| Public hostname smoke | Not performed |
| Health checks used localhost only | Yes |

### Stop if

- DNS/TLS is attempted during this slice

---

## Section 21 — Confirm No Billing/Payment/AI/Container Execution Enablement

Verify by **Yes/No only**. Do not print env values.

Inherit 04B evidence baseline: kill switches were set false; Google OAuth deferred; no real provider calls enabled.

Safe presence/false check (prints key name + `false`/`true`/`missing` only — not other secrets):

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('/opt/aisandbox/.env').read_text(encoding='utf-8', errors='replace')
wanted = [
  'GLOBAL_EXECUTION_ENABLED',
  'PROVIDER_OPENAI_ENABLED',
  'PROVIDER_ANTHROPIC_ENABLED',
  'PROVIDER_GROQ_ENABLED',
  'PROVIDER_XAI_ENABLED',
  'PROVIDER_DEEPSEEK_ENABLED',
  'BILLING_SNAPSHOT_ENABLED',
  'INVOICE_GENERATION_ENABLED',
  'PAYMENT_EXECUTION_ENABLED',
  'BILLING_CHARGES_ENABLED',
  'AGENT_HARNESS_ENABLE_TOOL_LOOP',
  'AGENT_HARNESS_ENABLE_WRITE_TOOLS',
  'AGENT_HARNESS_STUB_WRITE_MODE',
]
vals = {}
for line in text.splitlines():
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k, v = s.split('=', 1)
    vals[k.strip()] = v.strip().strip('"').strip("'").lower()
for k in wanted:
    if k not in vals:
        print(f'{k}=missing')
    else:
        print(f'{k}={"false" if vals[k]=="false" else ("true" if vals[k]=="true" else "nonboolean")}')
print('KILL_SWITCH_CHECK=done')
PY
```

### Expected

| Check | Expected |
|-------|----------|
| All listed kill switches | `false` |
| Google OAuth | Remains deferred |
| Real provider calls enabled | No |
| Billing/payment execution enabled | No |
| AI/container execution enabled | No |

### Stop if

- Any listed kill switch is `true`, `missing`, or `nonboolean`
- Runtime logs suggest execution/billing/provider paths are enabled
- Any real provider call appears to occur

---

## Section 22 — Confirm No Secrets Printed

Confirm:

| Check | Expected |
|-------|----------|
| `.env` contents printed | No |
| `DATABASE_URL` / `REDIS_URL` printed | No |
| Passwords / keys / tokens printed | No |
| PM2 logs pasted with secrets | No |
| Shell `env` / `printenv` after sourcing | Not run |
| Secret safety preserved | Yes |

### Stop if

- Any secret disclosed

---

## Section 23 — Stop Conditions

Stop immediately and report safe evidence if any of the following occur:

| # | Stop condition |
|---|----------------|
| 1 | Pre-PM2 snapshot not Available |
| 2 | Snapshot creation fails or remains Pending |
| 3 | Repo/artifact baseline unexpected |
| 4 | `.env` missing or permission not `600` |
| 5 | Google OAuth keys present unexpectedly with fake placeholders |
| 6 | PostgreSQL or Redis inactive if required for startup |
| 7 | PM2 command unclear after discovery |
| 8 | PM2 start command would install/build/migrate/configure DNS/TLS |
| 9 | PM2 start command would run broad `dev` / `start:all` / migration script with unclear side effects |
| 10 | Any process prints secrets |
| 11 | Any process starts migrations or creates tables |
| 12 | Database public table count changes from `0` |
| 13 | Any billing/payment/AI/container execution becomes enabled |
| 14 | Health smoke would create data or call providers |
| 15 | Service fails to start for unclear reasons |
| 16 | PM2 process crash/restart loop |
| 17 | DNS/TLS attempted |
| 18 | Source files modified unexpectedly |
| 19 | Secret disclosed |

Do not invent workarounds. Capture safe evidence and stop.

If startup is blocked specifically because migrations were not run, do **not** migrate. Record as blocker.

---

## Section 24 — Expected Final State

After successful future 04D manual execution:

| Item | Expected state |
|------|----------------|
| Pre-PM2 snapshot | `aisandbox-staging-prepm2-health-2026-07-26` Available |
| PM2 app services | Started only for approved app processes (`api-gateway`, `ai-service`, `container-manager`, `frontend`) |
| PM2 process status | online/stable, or clearly reported if blocked |
| Health-only local smoke | Completed for approved/source-grounded checks |
| `.env` | Remains private and unprinted — `ubuntu ubuntu 600` |
| Google OAuth | Remains omitted intentionally — no fake placeholders |
| Migrations | Not run |
| Database public table count | Remains `0` |
| DNS/TLS | Not configured |
| Billing/payment/AI/container execution | Not enabled |
| Secrets | Not disclosed |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 | Remains ACTIVE until 04D consolidation |
| PRIVATE-BETA-DEPLOYMENT-READINESS | Remains BLOCKED / PAUSED |

Possible honest outcomes:

- **PASS** — processes online/stable; approved health checks recorded; no migrations/DNS/TLS/secrets/enablement issues
- **PASS WITH BLOCKER** — bounded progress made, but startup/readiness blocked by migrations-not-run or similar expected gap
- **BLOCKED** — stop condition fired or unsafe/unclear state

---

## Section 25 — Safe Evidence Template

Paste this template after manual execution. Fill only safe values. Redact secrets.

```text
PRIVATE-BETA-STAGING-EXECUTION-04D — Evidence Report
Date:
Instance: aisandbox-staging
Runbook: docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md

1) Snapshot
- Created: Yes/No
- Name: aisandbox-staging-prepm2-health-2026-07-26
- Status: Available / Pending / Failed / Not created
- Created in Lightsail UI (not SSH): Yes/No

2) Repo / build / artifact baseline
- Path /opt/aisandbox: Yes/No
- Branch:
- Commit:
- ROOT_PACKAGE_LOCK: yes/no
- ROOT_NODE_MODULES: yes/no
- API_GATEWAY_DIST/MAIN: yes/no
- AI_SERVICE_DIST/MAIN: yes/no
- CONTAINER_MANAGER_DIST/MAIN: yes/no
- FRONTEND_NEXT: yes/no
- Unexpected source modifications: No/Yes (summary only)

3) .env permission (stat line only — no values)
- ENV_EXISTS:
- Stat line:

4) Google OAuth deferred
- GOOGLE_CLIENT_ID present: no/yes
- GOOGLE_CLIENT_SECRET present: no/yes
- GOOGLE_CALLBACK_URL present: no/yes
- Fake placeholders found: No/Yes
- Email/password remains intended auth path: Yes/No

5) PostgreSQL / Redis readiness (safe summary)
- postgresql is-active:
- redis is-active:
- SELECT 1 result:
- Redis password/URL printed: No/Yes

6) PM2 command discovery
- Ecosystem/pm2 files found (paths only):
- Root scripts reviewed: Yes/No
- Package scripts reviewed: Yes/No
- Decision: explicit PM2 commands / ecosystem file / STOP unclear
- Forbidden broad scripts avoided: Yes/No

7) PM2 commands used (no secrets)
- Env loading method used: shell source .env / pm2 --env-file / other (describe without secrets)
- Commands used (names/paths/ports only):
- PORT overrides used: 4000 / 4001 / 4002 / 3002 / other

8) PM2 process status summary
- api-gateway:
- ai-service:
- container-manager:
- frontend:
- Restart loop observed: No/Yes

9) Health endpoint checks (HTTP status only)
- GET http://localhost:4000/api/health =>
- GET http://localhost:4000/api/health/db =>
- GET http://localhost:4000/api/health/ready =>
- GET http://localhost:4002/api/health =>
- AI Service primary check (pm2 online / optional conversations status):
- GET http://localhost:3002 =>
- Any public DNS used: No/Yes

10) Logs safe summary only
- api-gateway summary:
- ai-service summary:
- container-manager summary:
- frontend summary:
- Secrets seen in logs: No/Yes (if Yes: stopped and rotating)

11) No migrations
- Migration commands run: No/Yes
- Public table count:
- Startup blocked by missing tables: No/Yes

12) No DNS/TLS
- DNS/TLS non-goal preserved: Yes/No

13) No billing/payment/AI/container enablement
- Kill-switch check done: Yes/No
- All listed kill switches false: Yes/No
- Google OAuth remains deferred: Yes/No
- Real provider calls enabled: No/Yes
- Billing/payment enabled: No/Yes
- AI/container execution enabled: No/Yes

14) Secret safety
- No secrets printed/pasted: Yes/No

15) Warnings / unexpected outputs
-

16) Stop conditions triggered
- None / list:

17) Suggested evidence verdict
- PASS / PASS WITH BLOCKER / BLOCKED

18) Ready for evidence review
- Yes/No
```

### Do not capture

- Full noisy logs if avoidable
- Any `.env` contents
- `DATABASE_URL` / `REDIS_URL` / passwords / keys / tokens
- Full `/api/health/ready` response bodies

Ask for **summaries and HTTP statuses only**, with secrets redacted.

---

## Section 26 — Exact Next Action

After this runbook is created:

1. **Keith manually executes 04D** using this runbook inside AWS Lightsail browser SSH.
2. Keith submits safe evidence using Section 25.
3. Later Step 3 performs evidence review.
4. Later Step 4 consolidates/checkpoints 04D if evidence passes.

**Do not proceed to manual execution inside Cursor.**

**Do not update TASKS.md / TASKS_BACKLOG_FULL.md / AINOW-EXECUTION-ROADMAP.md in this Step 2.** Governance updates belong to a later consolidation step.

Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.  
PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.
