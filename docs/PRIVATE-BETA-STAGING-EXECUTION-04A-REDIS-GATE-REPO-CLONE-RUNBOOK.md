# PRIVATE-BETA-STAGING-EXECUTION-04A — Redis Gate + Repo Clone Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04A
**Title:** Redis Gate + Repo Clone Baseline
**Step:** 2 — Runbook (this document)
**Parent task:** PRIVATE-BETA-STAGING-EXECUTION-04 — Repo Clone + Private Env Preparation + App Deployment Baseline
**Date created:** 2026-07-25
**Nature:** Runbook only — no server action — designed for Keith manual execution inside AWS Lightsail browser SSH.

---

## Section 1 — Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04A |
| Title | Redis Gate + Repo Clone Baseline |
| Step | 2 — Runbook (this document) |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — Redis compatibility gate + repo clone only |
| Risk | MEDIUM — git authentication; server clone command; no app deployed; no env created |
| Registered | 2026-07-25 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| OS | Ubuntu 24.04.4 LTS / noble |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |

---

## Section 2 — Purpose

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the EXECUTION-04A manual execution step.

EXECUTION-04A is the first of four bounded child slices of EXECUTION-04:

| Slice | Scope |
|-------|-------|
| **EXECUTION-04A (this slice)** | **Redis Gate + Repo Clone Baseline** |
| EXECUTION-04B | Private Env Preparation |
| EXECUTION-04C | Dependency Install + Build |
| EXECUTION-04D | PM2 Service Start + Health-Only Smoke |

This slice covers only:

1. Redis 8.8.0 compatibility gate reconfirmation (must pass before any app service starts).
2. Snapshot availability verification.
3. Runtime baseline verification.
4. PostgreSQL baseline verification.
5. Redis baseline verification.
6. Lightsail firewall verification.
7. Pre-clone `/opt/aisandbox` path check.
8. Repo clone to `/opt/aisandbox` with correct ownership.
9. Post-clone verification.
10. Confirmation that no `.env`, dependencies, build, app services, migrations, or DNS/TLS occurred.

**This runbook is the authoritative reference for the EXECUTION-04A manual execution session. Follow it section by section without skipping.**

---

## Section 3 — What This Child Slice Does

When executed by Keith, this slice:

1. Verifies the Redis 8.8.0 compatibility gate using the static assessment from EXECUTION-04 Step 2.
2. Verifies all three required snapshots are Available in the Lightsail console.
3. Verifies the runtime baseline (Node.js, npm, Docker, Docker Compose, PM2, Caddy) remains intact.
4. Verifies PostgreSQL 15.18 is active and local-only on port 5432.
5. Verifies Redis 8.8.0 is active, local-only, protected-mode enabled, and requirepass configured.
6. Verifies the Lightsail firewall shows only ports 22, 80, and 443 open.
7. Checks that `/opt/aisandbox` does not already exist (pre-clone guard).
8. Clones the repository to `/opt/aisandbox` with owner `ubuntu:ubuntu`.
9. Verifies the clone — path, ownership, branch, latest commit, and git status.
10. Confirms no `.env` was created, no dependencies installed, no build run, no app services started, no migrations run, and no DNS/TLS configured.

**The only server mutation permitted in EXECUTION-04A is the repo clone into `/opt/aisandbox`.**

---

## Section 4 — What This Child Slice Does Not Do

This slice does **not**:

- Create or write any app `.env` file.
- Install npm dependencies (`npm install` / `npm ci`).
- Run any build (`npm run build`).
- Start any app service (no `pm2 start`, no `systemctl start` for app processes).
- Create any PM2 app process.
- Run database migrations (`npm run migration:run:prod`, `typeorm migration:run`, or any variant).
- Create database tables or schema.
- Configure DNS A records for `staging.ainow.biz`.
- Add a Caddy site config or `reverse_proxy` block.
- Request or configure a TLS certificate.
- Enable real AI execution.
- Enable real container execution.
- Enable billing, payment, or Stripe execution.
- Expose any internal port publicly.
- Modify source code.
- Commit or push git.
- Open, read, or print any `.env` file, `DATABASE_URL`, `REDIS_URL`, passwords, or provider keys.
- Paste any secret value into any AI chat tool.

---

## Section 5 — Preconditions

Before starting manual execution, confirm all of the following:

| # | Precondition | Required state |
|---|-------------|----------------|
| 1 | EXECUTION-03 | COMPLETE and LOCKED — 2026-07-24 |
| 2 | EXECUTION-04 Step 1 (Registration) | COMPLETE — 2026-07-25 |
| 3 | EXECUTION-04 Step 2 (full runbook) | COMPLETE — 2026-07-25 |
| 4 | EXECUTION-04A Step 1 (Registration) | COMPLETE — 2026-07-25 |
| 5 | EXECUTION-04A Step 2 (this runbook) | Read and understood by Keith |
| 6 | Snapshot `aisandbox-staging-baseline-2026-07-23` | Expected: Available |
| 7 | Snapshot `aisandbox-staging-runtime-2026-07-24` | Expected: Available |
| 8 | Snapshot `aisandbox-staging-db-redis-2026-07-24` | Expected: Available |
| 9 | Redis 8.8.0 compatibility gate | Must be reconfirmed before repo clone |
| 10 | DB password | Keith holds privately — not disclosed to AI |
| 11 | Redis password | Keith holds privately — not disclosed to AI |
| 12 | Git repo access method decided | Keith has a private plan for HTTPS or SSH clone |
| 13 | GitHub token or SSH key | Available on VPS, or Keith will configure privately in session |

If any precondition is not met, stop and resolve before proceeding.

---

## Section 6 — Lightsail Browser SSH Instruction

**All server commands in this runbook must be run inside the AWS Lightsail browser SSH console — not PowerShell, not CMD, not any local terminal.**

To open the Lightsail browser SSH console:

1. Log into AWS Console → Lightsail.
2. Select the `aisandbox-staging` instance.
3. Click **Connect using SSH** (or the terminal icon).
4. The browser SSH console opens.
5. Run all commands in that console only.

Default user is `ubuntu`. Commands requiring root use `sudo`.

---

## Section 7 — Redis 8.8.0 Compatibility Gate

**THIS IS THE FIRST GATE. The repo clone in Section 15 must not proceed if this gate cannot be accepted.**

### Background

EXECUTION-03 installed Redis 8.8.0 from the official Redis APT repository. The target was Redis 7.x. A compatibility guardrail was formally recorded in the EXECUTION-03 checkpoint (`docs/PRIVATE-BETA-STAGING-EXECUTION-03-DB-REDIS-CHECKPOINT.md`, Section 14):

> Before app deployment or app service startup, the next relevant task must verify application compatibility with Redis 8.8.0 — or explicitly decide to pin/downgrade Redis to 7.x before the app uses Redis.

EXECUTION-04 Step 2 performed a static compatibility review of all application source files and dependency manifests. That review produced the following findings:

### Static Assessment (From EXECUTION-04 Step 2 — 2026-07-25)

**Redis client libraries in use:**

| Service | Library | Version (package.json) |
|---------|---------|------------------------|
| `services/ai-service` | `ioredis` | `^5.3.2` |
| `services/ai-service` | `bullmq` | `^5.70.1` |
| `services/api-gateway` | `ioredis` | `^5.9.3` |
| `services/api-gateway` | `bullmq` | `^5.70.1` |
| `services/container-manager` | (none) | No Redis dependency |
| `frontend` | (none) | No Redis dependency |

**Key findings:**

- ioredis v5 (both services) connects via `REDIS_URL` using RESP2 protocol by default. ioredis v5 is known compatible with Redis 7.x and 8.x.
- BullMQ v5.x requires Redis 7.0+ (uses `LMPOP` and other Redis 7 commands). Redis 8.8.0 is fully backward compatible with all Redis 7 commands, including `LMPOP`.
- No legacy `bull` package (v3.x) found — only `bullmq` v5.
- Commands used: standard PUBLISH / SUBSCRIBE / UNSUBSCRIBE (unchanged since Redis 2.x), BullMQ queue operations (LPUSH, ZADD, LMPOP, etc.).
- No Redis Streams, no ACL commands, no cluster mode, no Redis modules detected.
- No deprecated or removed commands detected.
- RESP3 protocol not detected — ioredis v5 uses RESP2 by default.
- `maxRetriesPerRequest: null` is a valid ioredis v5 option required by BullMQ; works with Redis 8.

**Overall static assessment: LIKELY COMPATIBLE**

No Redis-version-gated, deprecated, or removed features detected in source or dependency manifests.

### Gate Decision

Keith must make an explicit gate decision before proceeding to Section 8:

**Gate Outcome A — Accepted:**

> Static assessment is LIKELY COMPATIBLE. Redis 8.8.0 runtime behavior (local-only, protected-mode, requirepass, auth working) will be verified in Section 11 (Redis Baseline Verification). If the runtime verification also passes, the gate is accepted for EXECUTION-04A.

Gate Outcome A allows the repo clone to proceed in Section 15. No app service starts in EXECUTION-04A even after the gate is accepted — that is EXECUTION-04D scope.

**Gate Outcome B — Blocked:**

> Redis 8.8.0 compatibility cannot be confirmed. The repo clone is blocked. A separate bounded Redis 7.x pin/downgrade task must be registered before proceeding with EXECUTION-04A.

**Gate is confirmed accepted only if:**

1. Static assessment: LIKELY COMPATIBLE (recorded above).
2. Redis service remains active/running (verified in Section 11).
3. Redis is local-only (127.0.0.1 / ::1 only — no 0.0.0.0 binding).
4. `protected-mode yes` confirmed in redis.conf.
5. `requirepass` configured in redis.conf (value not printed).
6. Unauthenticated ping blocked (confirmed from EXECUTION-03 evidence — do not re-test by pasting password).
7. No app service starts in EXECUTION-04A.

If any of items 2–6 fail, stop and choose Gate Outcome B.

**No app startup happens in EXECUTION-04A regardless of gate outcome.**

---

## Section 8 — Snapshot Verification

**Verify inside the AWS Lightsail console UI (not via command line — snapshot listing is a console operation).**

Log into AWS Console → Lightsail → Snapshots tab and verify all three snapshots:

| Snapshot | Expected status |
|----------|----------------|
| `aisandbox-staging-baseline-2026-07-23` | Available |
| `aisandbox-staging-runtime-2026-07-24` | Available |
| `aisandbox-staging-db-redis-2026-07-24` | Available |

If any snapshot is not Available, stop and report before proceeding.

**Before starting the EXECUTION-04A manual session, Keith should also create a new pre-clone snapshot via the Lightsail console:**

- Name suggestion: `aisandbox-staging-preclone-2026-07-25` (use today's date)
- This snapshot captures the server state immediately before the repo clone.
- Wait for it to reach **Available** status before proceeding to Section 9.

Record the pre-clone snapshot name in the evidence template (Section 23).

---

## Section 9 — Runtime Baseline Verification

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

If any component is missing or shows an unexpected version, stop and report before proceeding.

---

## Section 10 — PostgreSQL Baseline Verification

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

**Do not connect to the database. Do not run psql. Do not view or print any database user password.**

If PostgreSQL is not active or port 5432 is externally bound (anything other than 127.0.0.1), stop and report.

---

## Section 11 — Redis Baseline Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
redis-server --version
sudo systemctl status redis-server
ss -tlnp | grep 6379
```

Verify the redis.conf settings (read-only — do not print the password value):

```bash
sudo grep -E "^bind|^protected-mode|^requirepass" /etc/redis/redis.conf
```

Expected results:

| Check | Expected |
|-------|----------|
| Redis version | Redis server v=8.8.0 |
| redis-server.service | active (running) |
| Port 6379 binding | 127.0.0.1:6379 and [::1]:6379 only |
| bind directive | `bind 127.0.0.1 -::1` |
| protected-mode | `protected-mode yes` |
| requirepass | `requirepass [some value — do not print or record the value]` |

**Do not print the Redis password. Do not run an authenticated ping that would embed the password in the command line. Do not include `AUTH <password>` in any command you paste into chat.**

If Redis is not active, or if port 6379 is bound to 0.0.0.0 or any external address, stop and report.

---

## Section 12 — Firewall Verification

**Verify inside the AWS Lightsail console UI (not via command line).**

In the Lightsail console, navigate to the `aisandbox-staging` instance → Networking tab → Firewall rules.

Expected firewall rules (IPv4 and IPv6):

| Port | Protocol | Expected |
|------|----------|----------|
| 22 | TCP | Open — SSH admin access only |
| 80 | TCP | Open — HTTP (for future Caddy HTTP→HTTPS redirect) |
| 443 | TCP | Open — HTTPS (for future TLS/Caddy) |
| 5432 | — | Closed — PostgreSQL must not be exposed |
| 6379 | — | Closed — Redis must not be exposed |
| All others | — | Closed |

If any unexpected port is open (anything other than 22, 80, 443), stop and report before proceeding.

**Do not modify the firewall in this step.** Firewall changes are not part of EXECUTION-04A scope.

---

## Section 13 — Pre-Clone Path Check

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Before cloning, verify that `/opt/aisandbox` does not already exist:

```bash
ls /opt/aisandbox 2>/dev/null && echo "REPO EXISTS — STOP" || echo "No repo — OK to proceed"
```

Also check the parent `/opt` directory:

```bash
ls -la /opt/
```

**If the output is `REPO EXISTS — STOP`:** Do not proceed with the clone. Report to the AI chat that `/opt/aisandbox` already exists and await a plan before proceeding.

**If the output is `No repo — OK to proceed`:** Continue to Section 14.

---

## Section 14 — Repo Clone Path and Ownership

The application repository will be cloned to `/opt/aisandbox`.

| Parameter | Value |
|-----------|-------|
| Clone path | `/opt/aisandbox` |
| Owner | `ubuntu:ubuntu` |
| Permissions | Directory: `755` (default) |
| Git-tracked `.env` | NEVER — `.env` must never be committed to git |

---

## Section 15 — Repo Clone Instructions

**Run inside AWS Lightsail browser SSH — not PowerShell.**

**This is the only server mutation permitted in EXECUTION-04A.**

### 15A — Prepare the parent directory and ownership

```bash
sudo mkdir -p /opt
sudo chown ubuntu:ubuntu /opt
ls -la /opt/
```

Expected: `/opt` exists and is owned by `ubuntu:ubuntu` (or root — either is acceptable since the clone directory will be set to `ubuntu:ubuntu`).

### 15B — Configure git identity (if not already configured on the server)

```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Keith"
```

Replace with Keith's actual name and email. This is required for git operations on the server.

### 15C — Choose your private Git authentication method

Keith must choose one of the following authentication approaches. **Do not paste a GitHub token or SSH private key into any AI chat tool.**

**Option 1 — HTTPS clone (enter credentials privately inside Lightsail browser SSH if prompted):**

```bash
git clone <PRIVATE_REPO_URL> /opt/aisandbox
```

Replace `<PRIVATE_REPO_URL>` with the actual HTTPS URL of the private repository. If GitHub prompts for credentials, enter them privately inside the Lightsail browser SSH session. Do not paste tokens into chat.

**Option 2 — SSH clone (only if Keith has already configured an SSH key on the server privately):**

```bash
git clone <PRIVATE_REPO_SSH_URL> /opt/aisandbox
```

Replace `<PRIVATE_REPO_SSH_URL>` with the actual SSH URL (e.g. `git@github.com:<org>/<repo>.git`). This option requires a valid SSH key pair already set up on the VPS.

**If authentication is not ready on the server:**

Stop. Do not paste GitHub tokens or SSH private keys into any AI chat tool. Configure git authentication privately on the server first (e.g. using `gh auth login` inside the browser SSH session, or by adding an SSH key), then return to this step.

### 15D — Set ownership after clone

```bash
sudo chown -R ubuntu:ubuntu /opt/aisandbox
```

---

## Section 16 — Post-Clone Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

After the clone completes, verify the following:

### 16A — Directory and ownership

```bash
ls -ld /opt/aisandbox
```

Expected: `drwxr-xr-x ... ubuntu ubuntu ... /opt/aisandbox`

### 16B — Branch, log, and status

```bash
cd /opt/aisandbox
git branch --show-current
git log --oneline -1
git status --short
```

Expected:

| Check | Expected |
|-------|----------|
| Branch | `main` (or the correct staging branch) |
| `git log --oneline -1` | One commit line — hash and subject visible (safe to record in evidence) |
| `git status --short` | Empty output (no uncommitted changes) |

### 16C — Check out the correct branch (if needed)

If the expected staging branch is not `main`, check it out:

```bash
git checkout <branch-name>
```

If `main` is the correct branch, no action needed.

### 16D — Confirm expected repo structure

```bash
ls /opt/aisandbox/
ls /opt/aisandbox/services/
ls /opt/aisandbox/frontend/
```

Expected: repo directories `services/`, `frontend/`, and other root files visible.

Stop conditions for this section:

- `ls -ld /opt/aisandbox` does not show `ubuntu ubuntu` as owner.
- `git branch --show-current` shows unexpected or empty branch.
- `git log --oneline -1` shows no commits or unexpected history.
- `git status --short` shows unexpected uncommitted changes.
- Repo structure is missing expected directories.

---

## Section 17 — Confirm No `.env`

**Run inside AWS Lightsail browser SSH — not PowerShell.**

After the clone, confirm that no `.env` file was created or exists in the repo:

```bash
ls /opt/aisandbox/.env 2>/dev/null && echo ".ENV EXISTS — STOP" || echo "No .env — OK"
```

Expected: `No .env — OK`

Also check per-service directories:

```bash
ls /opt/aisandbox/services/api-gateway/.env 2>/dev/null && echo "API-GW .ENV EXISTS — STOP" || echo "No api-gateway .env — OK"
ls /opt/aisandbox/services/ai-service/.env 2>/dev/null && echo "AI-SVC .ENV EXISTS — STOP" || echo "No ai-service .env — OK"
ls /opt/aisandbox/services/container-manager/.env 2>/dev/null && echo "CM .ENV EXISTS — STOP" || echo "No container-manager .env — OK"
ls /opt/aisandbox/frontend/.env.local 2>/dev/null && echo "FRONTEND .ENV EXISTS — STOP" || echo "No frontend .env.local — OK"
```

Expected: All outputs say `No ... — OK`.

If any `.env` file is found unexpectedly, stop and report before proceeding.

**Do not open, read, print, or cat any `.env` file.**

---

## Section 18 — Confirm No Dependencies Installed

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Confirm that `node_modules` directories do not exist (no dependency install has occurred):

```bash
ls /opt/aisandbox/node_modules 2>/dev/null && echo "ROOT NODE_MODULES EXISTS — NOTE" || echo "No root node_modules — OK"
ls /opt/aisandbox/services/api-gateway/node_modules 2>/dev/null && echo "API-GW NODE_MODULES EXISTS — STOP" || echo "No api-gateway node_modules — OK"
ls /opt/aisandbox/services/ai-service/node_modules 2>/dev/null && echo "AI-SVC NODE_MODULES EXISTS — STOP" || echo "No ai-service node_modules — OK"
ls /opt/aisandbox/services/container-manager/node_modules 2>/dev/null && echo "CM NODE_MODULES EXISTS — STOP" || echo "No container-manager node_modules — OK"
ls /opt/aisandbox/frontend/node_modules 2>/dev/null && echo "FRONTEND NODE_MODULES EXISTS — STOP" || echo "No frontend node_modules — OK"
```

Expected: All outputs say `No ... — OK`.

If a repo was freshly cloned and has no `node_modules`, this is expected and correct. Dependency installation belongs to EXECUTION-04C.

**Do not run `npm install` or `npm ci` in this step.**

---

## Section 19 — Confirm No Build

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Confirm that no build artifacts (`dist/` directories or `.next/`) exist:

```bash
ls /opt/aisandbox/services/api-gateway/dist 2>/dev/null && echo "API-GW DIST EXISTS — NOTE" || echo "No api-gateway dist — OK"
ls /opt/aisandbox/services/ai-service/dist 2>/dev/null && echo "AI-SVC DIST EXISTS — NOTE" || echo "No ai-service dist — OK"
ls /opt/aisandbox/services/container-manager/dist 2>/dev/null && echo "CM DIST EXISTS — NOTE" || echo "No container-manager dist — OK"
ls /opt/aisandbox/frontend/.next 2>/dev/null && echo "FRONTEND .NEXT EXISTS — NOTE" || echo "No frontend .next — OK"
```

Expected: All outputs say `No ... — OK` (freshly cloned repo has no build artifacts).

Build belongs to EXECUTION-04C. Do not run any build commands in this step.

---

## Section 20 — Confirm No App Services

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Confirm no app PM2 processes or systemd app services are running:

```bash
pm2 list
```

Expected: PM2 list shows no app processes (`api-gateway`, `ai-service`, `container-manager`, `frontend`). If PM2 list is empty or shows only system-level entries, that is correct.

```bash
sudo systemctl list-units --type=service --state=active | grep -E 'aisandbox|api-gateway|ai-service|container-manager|nextjs|frontend' || echo "No app services active — OK"
```

Expected: `No app services active — OK`

App service startup belongs to EXECUTION-04D. Do not start any PM2 processes in this step.

---

## Section 21 — Confirm No Migrations

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Confirm that no database tables exist (database schema is still the empty EXECUTION-03 baseline):

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

Expected: `0`

If the count is not `0`, stop and report before proceeding. This would indicate an unexpected migration or table creation occurred.

**Do not run any migration command. Do not run `npm run migration:run:prod`, `typeorm migration:run`, or any migration variant in this step.**

Migration belongs to a separate future explicitly registered task with its own pre-migration snapshot and Keith approval gate.

---

## Section 22 — Confirm No DNS/TLS

DNS and TLS are **not part of EXECUTION-04A**. Confirm all of the following:

- No DNS A record for `staging.ainow.biz` was configured in this step.
- No Caddy site config for `staging.ainow.biz` was created.
- No TLS certificate was requested or configured.
- No Caddy `reverse_proxy` block was added.
- The Lightsail firewall was not modified in this step.

If any command resembling a DNS or TLS configuration appeared, this is a stop condition. DNS/TLS belong to a later explicitly registered task.

---

## Section 23 — Safe Evidence Template

After completing EXECUTION-04A manual execution, Keith pastes only the following safe evidence into the AI chat.

**Do not include: secrets, passwords, connection strings, `.env` contents, DATABASE_URL, REDIS_URL, provider keys, tokens, private keys, IP values, or credentials of any kind.**

---

### Evidence — PRIVATE-BETA-STAGING-EXECUTION-04A

**Date:** _______________

**Instance:** aisandbox-staging

---

**Redis Compatibility Gate:**

- Static assessment from EXECUTION-04 Step 2: LIKELY COMPATIBLE
- Gate decision: [ ] Outcome A — Accepted / [ ] Outcome B — Blocked
- Proceeding with: [ ] Redis 8.8.0 accepted for staging / [ ] Redis downgrade task registered

---

**Snapshot verification:**

- `aisandbox-staging-baseline-2026-07-23`: [ ] Available / [ ] Missing
- `aisandbox-staging-runtime-2026-07-24`: [ ] Available / [ ] Missing
- `aisandbox-staging-db-redis-2026-07-24`: [ ] Available / [ ] Missing
- Pre-clone snapshot created: [ ] Yes / [ ] No — Name: _______________
- Pre-clone snapshot status: [ ] Available / [ ] Pending / [ ] Not created

---

**Runtime baseline:**

Paste output of (safe — no secrets):

```
node --version && npm --version && docker --version && pm2 --version && caddy version
```

(Paste output here)

---

**PostgreSQL baseline:**

- `postgresql@15-main.service` active (running): [ ] Yes / [ ] No
- Port 5432 on 127.0.0.1 only: [ ] Yes / [ ] No

---

**Redis baseline:**

- Redis version: [ ] 8.8.0 confirmed / [ ] Other: _______________
- `redis-server.service` active (running): [ ] Yes / [ ] No
- Port 6379 on 127.0.0.1/::1 only: [ ] Yes / [ ] No
- `protected-mode yes` confirmed in redis.conf: [ ] Yes / [ ] No
- `requirepass` configured (value not recorded): [ ] Yes / [ ] No
- Unauthenticated ping blocked (from EXECUTION-03 evidence): [ ] Confirmed

---

**Lightsail firewall:**

- Ports open: [ ] 22 / [ ] 80 / [ ] 443 only — no unexpected ports
- Port 5432 closed externally: [ ] Confirmed
- Port 6379 closed externally: [ ] Confirmed
- Unexpected ports: [ ] None / [ ] Yes — describe: _______________

---

**Pre-clone path check:**

- `/opt/aisandbox` did not exist before clone: [ ] Confirmed
- Pre-clone check output: _______________

---

**Repo clone:**

- Repo cloned: [ ] Yes / [ ] No
- Repo path: `/opt/aisandbox` — [ ] Confirmed
- Owner after `chown`: `ubuntu:ubuntu` — [ ] Confirmed
- Branch (`git branch --show-current`): _______________
- Latest commit (`git log --oneline -1`): _______________
- `git status --short` output: _______________

---

**Post-clone confirmations:**

- No `.env` at `/opt/aisandbox/.env`: [ ] Confirmed
- No per-service `.env` files: [ ] Confirmed
- No `node_modules` (no dependencies installed): [ ] Confirmed
- No `dist/` or `.next/` (no build run): [ ] Confirmed
- `pm2 list` shows no app processes: [ ] Confirmed
- No app systemd services active: [ ] Confirmed
- Database table count = 0 (no migrations): [ ] Confirmed
- No DNS configured: [ ] Confirmed
- No TLS configured: [ ] Confirmed

---

**Secrets safety:**

- No secrets disclosed to AI chat: [ ] Yes — clean
- No `.env` contents pasted: [ ] Confirmed
- No `DATABASE_URL` pasted: [ ] Confirmed
- No `REDIS_URL` pasted: [ ] Confirmed
- No password pasted: [ ] Confirmed
- No provider key pasted: [ ] Confirmed

---

**Warnings / unexpected outputs:**

(List any warnings, deviations, or unexpected outputs that are safe to report — no secret values)

---

**Stop conditions triggered:**

- [ ] None
- [ ] Yes — describe: _______________

---

## Section 24 — Stop Conditions

Keith must stop immediately and report to the AI chat if any of the following occur:

| # | Stop condition |
|---|---------------|
| 1 | Redis 8.8.0 compatibility gate cannot be accepted (Gate Outcome B) |
| 2 | Any snapshot is missing or not Available in the Lightsail console |
| 3 | Runtime baseline is not intact (wrong Node.js version, missing tool, or version mismatch) |
| 4 | PostgreSQL is not active/running or port 5432 is not localhost-only |
| 5 | Redis is not active/running, or port 6379 is not localhost-only, or `protected-mode yes` is missing, or `requirepass` is not configured |
| 6 | Lightsail firewall shows any port open other than 22, 80, and 443 |
| 7 | `/opt/aisandbox` already exists before the clone — report state before overwriting |
| 8 | Repo clone fails for any reason (authentication error, network error, repo not found, path error) |
| 9 | Repo clone lands at a path other than `/opt/aisandbox` |
| 10 | Authentication for the clone requires pasting a GitHub token or SSH private key into AI chat — stop and configure auth privately first |
| 11 | `git branch --show-current` shows unexpected or empty branch after clone |
| 12 | `git log --oneline -1` shows no commits or unexpected history |
| 13 | `git status --short` shows unexpected uncommitted changes after clone |
| 14 | A `.env` file is discovered at any path under `/opt/aisandbox` |
| 15 | `node_modules` directories exist after clone (dependency install happened unexpectedly) |
| 16 | `dist/` or `.next/` directories exist after clone (build happened unexpectedly) |
| 17 | `pm2 list` shows any app service process started |
| 18 | Database table count is not `0` (migration may have occurred) |
| 19 | Any DNS configuration command appears |
| 20 | Any TLS certificate request appears |
| 21 | Any command resembling `npm install`, `npm ci`, `npm run build`, `npm run migration`, or `pm2 start` appears outside the scope of this runbook |
| 22 | Any secret value (password, token, key, connection string) is accidentally disclosed in terminal output or pasted into chat |
| 23 | Any output in the Lightsail browser SSH session shows secret values in clear text — stop, do not paste into chat |

When a stop condition triggers: stop all further commands, report the stop condition number and description to the AI chat, and await a revised plan before proceeding.

---

## Section 25 — Expected Final State

After EXECUTION-04A completes successfully:

| State | Expected |
|-------|----------|
| Redis compatibility gate | Outcome A — Accepted |
| Snapshots | All 3 prior snapshots Available — pre-clone snapshot Available |
| Runtime baseline | Node.js v20.20.2 / npm 10.8.2 / Docker 29.6.2 / Docker Compose v5.3.1 / PM2 7.0.3 / Caddy v2.11.4 — intact |
| PostgreSQL | postgresql@15-main.service active — port 5432 on 127.0.0.1 only |
| Redis | redis-server.service active — port 6379 on 127.0.0.1/::1 only — protected-mode yes — requirepass configured |
| Firewall | 22/80/443 only — 5432/6379 closed externally |
| Repo | Cloned to `/opt/aisandbox` — owned `ubuntu:ubuntu` — correct branch — latest commit verified |
| `.env` | Not created — no `.env` exists at any path under `/opt/aisandbox` |
| Dependencies | Not installed — no `node_modules` directories |
| Build | Not run — no `dist/` or `.next/` directories |
| App services | Not started — PM2 shows no app processes |
| Migrations | Not run — database table count = 0 |
| DNS | Not configured |
| TLS | Not configured |
| Secrets | No values disclosed |
| Source code | Not modified |
| Git | No commit or push |

---

## Section 26 — Exact Next Action

After Keith completes EXECUTION-04A manual execution and provides the safe evidence (Section 23):

1. Keith pastes only the safe evidence template (Section 23) into the AI chat.
2. The AI reviews the evidence and produces an evidence review document: `docs/PRIVATE-BETA-STAGING-EXECUTION-04A-EVIDENCE-REVIEW.md`.
3. If the evidence review passes, the AI updates governance files and creates the consolidation checkpoint: `docs/PRIVATE-BETA-STAGING-EXECUTION-04A-CHECKPOINT.md`.
4. EXECUTION-04A is marked COMPLETE and LOCKED in TASKS.md, TASKS_BACKLOG_FULL.md, and AINOW-EXECUTION-ROADMAP.md.
5. Next child slice after EXECUTION-04A is locked: **EXECUTION-04B — Private Env Preparation** (`.env` creation only — no dependency install, no build, no service start).

---

## Appendix — Files Changed by This Step (Step 2 Only)

| File | Change |
|------|--------|
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04A-REDIS-GATE-REPO-CLONE-RUNBOOK.md` | Created — this document |

No other files changed. No TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md, source files, env files, test files, package files, Docker files, migration files, deployment files, or Caddy/PM2 files were modified.

---

**Runbook created:** 2026-07-25
**Task:** PRIVATE-BETA-STAGING-EXECUTION-04A — Step 2
**Nature:** Runbook only — no server action performed — no source files changed — no governance files changed — no env files opened/created/edited — no env values opened/printed — no AWS/SSH/DNS/TLS action occurred — no Docker/PostgreSQL/Redis action occurred locally — no git commit or push — no subagents used.
