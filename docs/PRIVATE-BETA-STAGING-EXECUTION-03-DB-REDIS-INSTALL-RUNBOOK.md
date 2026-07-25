# PRIVATE-BETA-STAGING-EXECUTION-03 — PostgreSQL + Redis Installation Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-03
**Title:** PostgreSQL + Redis Installation Baseline
**Step:** 2 — PostgreSQL + Redis Installation Runbook
**Date:** 2026-07-24
**Nature:** Runbook only — no server action — no source changes — no AWS action — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-03 |
| Title | PostgreSQL + Redis Installation Baseline |
| Step | 2 — PostgreSQL + Redis Installation Runbook |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — PostgreSQL and Redis installation on Lightsail instance |
| Risk | MEDIUM — server commands; credential handling; no source changes; no app deployed |
| Registered | 2026-07-24 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |

---

## 2. Purpose

This runbook gives Keith the exact manual steps to install and verify PostgreSQL 15 and Redis 7 on the `aisandbox-staging` Lightsail server. It is designed for safe human execution inside the AWS Lightsail browser SSH console.

The runbook covers installation, service verification, safe private credential creation, local-only binding confirmation, firewall verification, and post-installation snapshot. It does not cover app deployment, repo clone, DNS, TLS, migrations, or any source code action.

---

## 3. What This Step Does

- Verify baseline runtime state is intact after EXECUTION-02
- Install PostgreSQL 15 (via official PostgreSQL APT repository)
- Verify PostgreSQL service is active and healthy
- Verify PostgreSQL listens on localhost only (port 5432 not publicly reachable)
- Create application database `aisandbox` and user `aisandbox` privately and safely
- Verify app user can connect from localhost
- Verify app user is not a superuser
- Install Redis 7 (via official Redis APT repository)
- Verify Redis service is active and healthy
- Verify Redis listens on localhost only (port 6379 not publicly reachable)
- Configure Redis `bind` and `protected-mode` explicitly
- Configure Redis `requirepass` (Keith-generated, private, never disclosed)
- Verify Redis authenticated ping works
- Verify Redis rejects unauthenticated connections
- Confirm Lightsail firewall still shows only 22/80/443 open
- Confirm no repo clone, no `.env`, no app services, no migrations
- Create post-DB-Redis Lightsail snapshot

---

## 4. What This Step Does NOT Do

| # | Not Done |
|---|---------|
| 1 | Does NOT SSH from Keith's local machine (uses Lightsail browser SSH only) |
| 2 | Does NOT use AWS CLI |
| 3 | Does NOT request AWS credentials or API keys |
| 4 | Does NOT request SSH private keys |
| 5 | Does NOT configure DNS or TLS |
| 6 | Does NOT configure Caddy site |
| 7 | Does NOT clone the repository |
| 8 | Does NOT create or edit the app `.env` file |
| 9 | Does NOT deploy any app services |
| 10 | Does NOT start any PM2 app processes |
| 11 | Does NOT run database migrations |
| 12 | Does NOT run tests or builds |
| 13 | Does NOT modify source code |
| 14 | Does NOT use Docker for PostgreSQL or Redis (system packages only) |
| 15 | Does NOT expose ports 5432 or 6379 publicly |
| 16 | Does NOT paste DB password, DATABASE_URL, or REDIS_URL to chat or AI |
| 17 | Does NOT make git commits or pushes |
| 18 | Does NOT use subagents |

---

## 5. Cost / Safety Note

- Lightsail instance billing (~$40–44/month) continues from EXECUTION-01.
- A Lightsail snapshot will be created at the end of this step. Snapshots incur additional storage cost (~$0.05/GB/month — approximately $8/month for 160 GB). Keith accepts this cost for staging rollback capability.
- Do not stop or terminate the `aisandbox-staging` instance.
- Do not delete or rename the existing snapshots:
  - `aisandbox-staging-baseline-2026-07-23` — Must remain Available
  - `aisandbox-staging-runtime-2026-07-24` — Must remain Available

---

## 6. Preconditions

Before starting, verify all of the following are true:

| # | Precondition | Expected State |
|---|-------------|----------------|
| 1 | AWS Lightsail instance name | `aisandbox-staging` — Running |
| 2 | Region | ap-southeast-1 (Singapore) |
| 3 | EXECUTION-02 status | COMPLETE and LOCKED — 2026-07-24 |
| 4 | Runtime snapshot | `aisandbox-staging-runtime-2026-07-24` — Available |
| 5 | Baseline snapshot | `aisandbox-staging-baseline-2026-07-23` — Available |
| 6 | PostgreSQL | Not yet installed |
| 7 | Redis | Not yet installed |
| 8 | Lightsail firewall | 22/80/443 open; 5432/6379/3002/4000/4001/4002 closed externally |
| 9 | Repository | Not cloned |
| 10 | App `.env` | Not created |
| 11 | App services | Not started |
| 12 | Migrations | Not run |
| 13 | DNS / TLS | Not configured |

If any precondition is not met, stop and report before continuing.

---

## 7. Lightsail Browser SSH Instruction

> **IMPORTANT: All server commands in this runbook must be run inside the AWS Lightsail browser SSH console — NOT in local Windows PowerShell.**

**To open the browser SSH:**

1. Log in to AWS Console → Lightsail.
2. Click on the `aisandbox-staging` instance.
3. Click **"Connect using SSH"** (the orange button in the Connect tab).
4. The browser SSH terminal opens in your browser — run all commands there.

Do not use your local terminal, Windows PowerShell, or any local SSH client for these commands.

---

## 8. Baseline Runtime Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Run these verification commands to confirm the server is in the expected state before proceeding.

### 8a. Confirm instance identity and OS

```bash
hostname
```
Expected: `aisandbox-staging` or similar

```bash
lsb_release -a
```
Expected:
```
Distributor ID: Ubuntu
Description:    Ubuntu 24.04.4 LTS
Release:        24.04
Codename:       noble
```

**Stop and report if Ubuntu version is not 24.04.x.**

### 8b. Confirm runtime tools from EXECUTION-02

```bash
node --version
```
Expected: `v20.20.2`

```bash
npm --version
```
Expected: `10.8.2`

```bash
docker --version
```
Expected: Docker version `29.6.2` or similar

```bash
pm2 --version
```
Expected: `7.0.3`

```bash
caddy version
```
Expected: `v2.11.4` or similar

**Stop and report if any runtime tool is missing or shows an unexpected version.**

### 8c. Confirm PostgreSQL and Redis are NOT yet installed

```bash
which psql 2>/dev/null && psql --version || echo "PostgreSQL not installed — OK"
```
Expected: `PostgreSQL not installed — OK`

```bash
which redis-server 2>/dev/null && redis-server --version || echo "Redis not installed — OK"
```
Expected: `Redis not installed — OK`

**If PostgreSQL or Redis is already installed, stop and report before proceeding.**

### 8d. Confirm no app services, no repo, no .env

```bash
pm2 list
```
Expected: empty list (no app processes)

```bash
ls /opt/aisandbox 2>/dev/null && echo "REPO EXISTS — STOP" || echo "No repo — OK"
```
Expected: `No repo — OK`

```bash
ls /opt/aisandbox/.env 2>/dev/null && echo "ENV EXISTS — STOP" || echo "No .env — OK"
```
Expected: `No .env — OK`

---

## 9. Lightsail Firewall Verification Reminder

**This check is done in the AWS Lightsail console — not in the browser SSH terminal.**

Before proceeding:

1. In the AWS Lightsail console, click on `aisandbox-staging`.
2. Click the **Networking** tab.
3. Under **IPv4 Firewall**, verify only these ports are listed:
   - Port 22 — TCP — SSH
   - Port 80 — TCP — HTTP
   - Port 443 — TCP — HTTPS
4. Confirm that ports 5432, 6379, 3002, 4000, 4001, and 4002 are **NOT** listed.

**Do NOT add port 5432 or 6379 to the Lightsail firewall at any time during this runbook.**

**Stop and report if any unexpected port is open in the Lightsail firewall.**

---

## 10. PostgreSQL Version Strategy

### Why PostgreSQL 15 (not Ubuntu default)

Ubuntu 24.04 (noble) ships **PostgreSQL 16** as the default package when you run `apt install postgresql`. The aiSandBox platform targets **PostgreSQL 15** to match the local development Docker Compose configuration and existing codebase defaults (`process.env.POSTGRES_DB || 'aisandbox'`, `process.env.POSTGRES_USER || 'aisandbox'`).

To install PostgreSQL 15 specifically, this runbook uses the **official PostgreSQL Global Development Group (PGDG) APT repository**, which provides PostgreSQL 15 packages for Ubuntu 24.04 (noble).

**Do NOT run `apt install postgresql` without adding the PGDG repository first** — that would install PostgreSQL 16.

### Version check after install

After install, verify:
```
psql --version
```
Expected: `psql (PostgreSQL) 15.x`

If the version is not 15.x, stop and report before proceeding.

### Ubuntu 24.04 compatibility

The PGDG repository explicitly supports Ubuntu 24.04 (noble). The `lsb_release -cs` command will return `noble`, and the PGDG APT source will resolve correctly.

---

## 11. PostgreSQL Installation

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### Step 1: Update apt package list

```bash
sudo apt update
```

Expected: output ends with no errors. Warnings about "apt-key" or "stable" are acceptable. A real error (e.g., `E:` prefix lines) should be reported before continuing.

### Step 2: Install prerequisites for PGDG repository setup

```bash
sudo apt install -y curl ca-certificates
```

### Step 3: Add the official PostgreSQL PGDG APT repository (Ubuntu 24.04 / noble)

```bash
sudo install -d /usr/share/postgresql-common/pgdg

sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc

sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'
```

Verify the list entry was created:

```bash
cat /etc/apt/sources.list.d/pgdg.list
```

Expected: a line containing `noble-pgdg main`

### Step 4: Update apt with PGDG repository

```bash
sudo apt update
```

Expected: output includes hits from `apt.postgresql.org` — no errors.

### Step 5: Install PostgreSQL 15

```bash
sudo apt install -y postgresql-15 postgresql-client-15
```

Expected: installation completes without errors. PostgreSQL service starts automatically after install.

### Step 6: Verify PostgreSQL version

```bash
psql --version
```

Expected: `psql (PostgreSQL) 15.x`

**Stop and report if the version is not 15.x.**

---

## 12. PostgreSQL Service Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### Check service status

```bash
sudo systemctl status postgresql
```

Expected:
- `Loaded: loaded`
- `Active: active (running)` (green dot)

### Confirm cluster is online

```bash
pg_lsclusters
```

Expected output (approximately):
```
Ver Cluster Port Status Owner    Data directory                Log file
15  main    5432 online postgres /var/lib/postgresql/15/main   /var/log/postgresql/postgresql-15-main.log
```

Verify: `Ver` = `15`, `Status` = `online`.

### Ensure PostgreSQL starts on reboot

```bash
sudo systemctl enable postgresql
```

**Stop and report if PostgreSQL service is not active (running) or cluster is not online.**

---

## 13. PostgreSQL Local-Only / Network Safety Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### 13a. Verify listen_addresses in postgresql.conf

```bash
sudo grep -E 'listen_addresses' /etc/postgresql/15/main/postgresql.conf
```

Expected:
```
#listen_addresses = 'localhost'
```
OR (if explicitly set):
```
listen_addresses = 'localhost'
```

If the line is commented out with the default value `localhost`, PostgreSQL listens on localhost only — this is correct and safe.

**Stop and report if `listen_addresses` is set to `'*'` or `'0.0.0.0'`.**

If it is set to `'*'` or `'0.0.0.0'`, do NOT proceed. Report immediately.

### 13b. Verify port 5432 is bound to localhost only

```bash
sudo ss -tlnp | grep 5432
```

Expected output: listening address is `127.0.0.1:5432` only.

**Stop and report if 5432 is shown bound to `0.0.0.0:5432` or any external address.**

### 13c. Confirm port 5432 is NOT in Lightsail firewall (reminder)

Return to the AWS Lightsail console → Networking tab.

Confirm port 5432 is not listed in IPv4 Firewall rules.

**Do NOT add port 5432. It must remain closed externally.**

### 13d. Check pg_hba.conf for unexpected external access

```bash
sudo grep -v '^#' /etc/postgresql/15/main/pg_hba.conf | grep -v '^$'
```

Expected: entries restricted to `local`, `127.0.0.1/32`, and `::1/128`. No entry containing `0.0.0.0/0` or `::/0`.

**Stop and report if any pg_hba.conf entry allows connections from `0.0.0.0/0` or `::/0`.**

---

## 14. Private PostgreSQL Database / User Setup

**Run inside AWS Lightsail browser SSH — not PowerShell.**

> **CRITICAL CREDENTIAL SAFETY RULES — READ BEFORE CONTINUING:**
>
> - You will generate a database password in this section.
> - **Do NOT paste the password into Cursor, ChatGPT, or any AI chat.**
> - **Do NOT paste the DATABASE_URL into any AI chat.**
> - **Do NOT paste any `.env` contents into any AI chat.**
> - The password is set interactively via psql `\password` — it is never echoed to the terminal and never stored in shell history via this method.
> - If you accidentally expose the password or DATABASE_URL, stop and generate a new password immediately.

### Step 1: Generate a strong password (private — do NOT paste to chat)

```bash
openssl rand -hex 32
```

This generates a 64-character hex password. **Note this value privately — on paper or in your local password manager. Do NOT paste it into any AI chat window.** You will type this password twice interactively in the psql step below.

### Step 2: Enter the PostgreSQL admin shell

```bash
sudo -u postgres psql
```

You should see the `postgres=#` prompt. You are now inside the PostgreSQL interactive shell.

### Step 3: Create the application database user (no password in SQL — safe method)

Inside the `postgres=#` prompt, run:

```sql
CREATE USER aisandbox;
```

Expected: `CREATE ROLE`

### Step 4: Create the application database

Inside the `postgres=#` prompt, run:

```sql
CREATE DATABASE aisandbox OWNER aisandbox;
```

Expected: `CREATE DATABASE`

### Step 5: Set the user password interactively (password never echoed or stored in history)

Inside the `postgres=#` prompt, run:

```sql
\password aisandbox
```

PostgreSQL will prompt:
```
Enter new password for user "aisandbox":
```

Type the password you generated in Step 1. It will not be echoed.

PostgreSQL will prompt again:
```
Enter it again:
```

Type the same password again. It will not be echoed.

Expected: the prompt returns to `postgres=#` with no error.

### Step 6: Verify user attributes (confirm not a superuser)

Inside the `postgres=#` prompt, run:

```sql
\du aisandbox
```

Expected: `aisandbox` listed with no attributes in the `Attributes` column (empty — regular user only, no Superuser/Create DB/Create role).

### Step 7: Verify database exists

Inside the `postgres=#` prompt, run:

```sql
\l aisandbox
```

Expected: database `aisandbox` listed with owner `aisandbox`.

### Step 8: Exit the PostgreSQL shell

```sql
\q
```

---

## 15. PostgreSQL Safe Connection Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Verify the `aisandbox` user can connect from localhost using TCP (password auth). This confirms the database/user setup is correct.

```bash
psql -U aisandbox -d aisandbox -h 127.0.0.1 -c "SELECT 1 AS result;"
```

PostgreSQL will prompt: `Password for user aisandbox:`

Type the password you set in Section 14 Step 5. It will not be echoed.

Expected output:
```
 result
--------
      1
(1 row)
```

**Stop and report if this connection fails.** Do not proceed to Redis installation until this confirms PostgreSQL is working correctly.

> **Evidence note:** The password prompt and your typed password are NOT captured in the safe evidence template. Evidence only records: connection succeeded — Yes/No.

---

## 16. Redis Version Strategy

### Why official Redis APT repository (preferred over Ubuntu default)

Ubuntu 24.04 (noble) default `apt install redis-server` installs Redis 7.0.x from Ubuntu's own package repositories. While this version may be in the Redis 7 family, using the **official Redis APT repository from packages.redis.io** ensures the latest stable Redis 7.x release and consistent version targeting with the local development Docker Compose configuration.

This also ensures future compatibility if Ubuntu's default Redis package falls behind.

### Version check after install

After install, verify:

```bash
redis-server --version
```

Expected: `Redis server v=7.x.x`

**Stop and report if the version major is not 7.** If Redis 6.x is installed, the installation used the wrong channel.

---

## 17. Redis Installation

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### Step 1: Install dependencies for Redis APT repository

```bash
sudo apt install -y lsb-release curl gpg
```

### Step 2: Add the official Redis APT repository

```bash
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg

sudo chmod 644 /usr/share/keyrings/redis-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
```

Verify the list entry was created:

```bash
cat /etc/apt/sources.list.d/redis.list
```

Expected: a line containing `packages.redis.io/deb` and `noble main`

### Step 3: Update apt with Redis repository

```bash
sudo apt update
```

Expected: output includes hits from `packages.redis.io` — no errors.

### Step 4: Install Redis

```bash
sudo apt install -y redis-server
```

Expected: installation completes without errors. Redis service may or may not start automatically — the next section covers verification.

### Step 5: Verify Redis version

```bash
redis-server --version
```

Expected: `Redis server v=7.x.x`

**Stop and report if the version is not 7.x.**

---

## 18. Redis Service Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### Check service status

```bash
sudo systemctl status redis-server
```

Expected:
- `Loaded: loaded`
- `Active: active (running)` (green dot)

If Redis is not running, start it:

```bash
sudo systemctl start redis-server
```

Then check status again.

### Ensure Redis starts on reboot

```bash
sudo systemctl enable redis-server
```

**Stop and report if the Redis service cannot be started.**

---

## 19. Redis Local-Only / Network Safety Verification and Configuration

**Run inside AWS Lightsail browser SSH — not PowerShell.**

> **CRITICAL:** This section requires editing Redis configuration. Follow the steps in order. Keith must generate a Redis password privately — it must never be pasted to any AI chat.

### Step 1: Check default Redis bind address

```bash
sudo grep -E '^bind' /etc/redis/redis.conf
```

Expected: `bind 127.0.0.1 -::1` or `bind 127.0.0.1 ::1`

If the output shows `bind 0.0.0.0` or is absent, Redis may be publicly exposed. Proceed to Step 2 to configure it.

### Step 2: Generate a strong Redis password (private — do NOT paste to chat)

```bash
openssl rand -hex 32
```

**Note this value privately — on paper or in your local password manager. Do NOT paste it into any AI chat window.** You will enter this password in the redis.conf file in Step 3.

### Step 3: Edit redis.conf to configure bind, protected-mode, and requirepass

```bash
sudo nano /etc/redis/redis.conf
```

Inside nano, make the following changes:

**Confirm or set bind address (find the `bind` line):**
Ensure it reads:
```
bind 127.0.0.1 -::1
```
If the line has `bind 0.0.0.0` or is commented out, change it to `bind 127.0.0.1 -::1`.

**Confirm protected-mode is yes (find the `protected-mode` line):**
Ensure it reads:
```
protected-mode yes
```

**Set requirepass (find the `requirepass` line — it may be commented as `# requirepass foobared`):**
Uncomment it and set it to the password you generated in Step 2:
```
requirepass <your-generated-password>
```
(Replace `<your-generated-password>` with the actual value. Do NOT paste this line into chat.)

Save and close nano:
- Press `Ctrl+X`
- Press `Y` to confirm save
- Press `Enter` to confirm filename

### Step 4: Restart Redis to apply configuration

```bash
sudo systemctl restart redis-server
```

### Step 5: Verify Redis service is still running after restart

```bash
sudo systemctl status redis-server
```

Expected: `Active: active (running)`

**Stop and report if Redis fails to start after config change.** If it fails, check the error:
```bash
sudo journalctl -u redis-server -n 30 --no-pager
```

### Step 6: Verify Redis is bound to localhost only

```bash
sudo ss -tlnp | grep 6379
```

Expected: listening address is `127.0.0.1:6379` only (not `0.0.0.0:6379`).

**Stop and report if 6379 is bound to `0.0.0.0` or any external address.**

### Step 7: Verify unauthenticated connection is rejected

```bash
redis-cli ping
```

Expected:
```
(error) NOAUTH Authentication required.
```

**Stop and report if this returns `PONG` (it means requirepass is not set — authentication bypass).**

This output is safe to paste as evidence.

### Step 8: Verify authenticated connection works

Use the interactive redis-cli method (avoids password appearing in safe evidence):

```bash
redis-cli
```

At the `127.0.0.1:6379>` prompt, type:
```
AUTH <your-redis-password>
```
(Use the actual password. Do NOT paste this command or its output to chat.)

Expected: `OK`

Then type:
```
PING
```

Expected: `PONG`

Then type:
```
exit
```

> **Evidence note:** Do NOT paste the `AUTH <password>` command or its output to the evidence template. Evidence only records: authenticated ping — PONG received — Yes/No.

### Step 9: Verify bind address via Redis config query

```bash
redis-cli -a "$(sudo grep '^requirepass' /etc/redis/redis.conf | awk '{print $2}')" CONFIG GET bind 2>/dev/null
```

> **Note:** This command extracts the requirepass value from redis.conf to query CONFIG GET bind. The password is used on the command line temporarily — it may appear in terminal history. Keith may optionally clear history afterward with `history -c` if concerned. **Do NOT paste this command or its output to chat.**

Alternatively, check directly:

```bash
sudo grep '^bind' /etc/redis/redis.conf
```

Expected: `bind 127.0.0.1 -::1` or `bind 127.0.0.1 ::1`

### Step 10: Confirm port 6379 is NOT in Lightsail firewall (reminder)

Return to the AWS Lightsail console → Networking tab.

Confirm port 6379 is not listed in IPv4 Firewall rules.

**Do NOT add port 6379. It must remain closed externally.**

---

## 20. Confirm No Repo Clone

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
ls /opt/aisandbox 2>/dev/null && echo "REPO EXISTS — STOP AND REPORT" || echo "No repo cloned — OK"
```

Expected: `No repo cloned — OK`

**Stop and report if the repo exists at `/opt/aisandbox`.**

---

## 21. Confirm No `.env`

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
ls /opt/aisandbox/.env 2>/dev/null && echo ".ENV EXISTS — STOP AND REPORT" || echo "No .env — OK"
```

Expected: `No .env — OK`

**Stop and report if `.env` exists.**

> Important: Do NOT open, read, or display the contents of any `.env` file if one unexpectedly exists. Report the unexpected state only.

---

## 22. Confirm No App Services

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
pm2 list
```

Expected: empty list — no application processes.

```bash
sudo systemctl list-units --type=service --state=active | grep -E 'aisandbox|api-gateway|ai-service|container-manager|nextjs|frontend' || echo "No app services — OK"
```

Expected: `No app services — OK`

**Stop and report if any app services (api-gateway, ai-service, container-manager, nextjs/frontend) are running.**

Note: `postgresql`, `redis-server`, and `caddy` systemd services are expected to be running at this point — these are infrastructure services, not app services.

---

## 23. Confirm No Migrations

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Verify there are no migration artifacts in the database. Since the repo has not been cloned and no app has been deployed, migrations cannot have run. Confirm with:

```bash
sudo -u postgres psql -d aisandbox -c "\dt" 2>/dev/null
```

Expected: `Did not find any relations.` (empty database — no tables)

This is the correct state. Migrations belong to a future EXECUTION task and require explicit Keith approval before running.

---

## 24. Post-DB-Redis Snapshot Steps

**This action is performed in the AWS Lightsail console — not in the browser SSH terminal.**

After all PostgreSQL and Redis verification steps pass, create a manual Lightsail snapshot to preserve this clean DB/Redis baseline state.

### Create the snapshot

1. In the AWS Lightsail console, click on `aisandbox-staging`.
2. Click the **Snapshots** tab (or use the three-dot menu → Create snapshot).
3. For the snapshot name, use:

```
aisandbox-staging-db-redis-2026-07-24
```

4. Click **Create snapshot**.
5. Wait for the snapshot status to change to **Available** (may take several minutes).
6. Verify the snapshot is listed as **Available** before reporting evidence.

### Do NOT delete or rename:

- `aisandbox-staging-baseline-2026-07-23` — keep Available
- `aisandbox-staging-runtime-2026-07-24` — keep Available

---

## 25. Safe Evidence Template for Keith

After completing all sections of this runbook, paste ONLY the following safe outputs back to the AI chat for Step 3 evidence review.

**Do NOT include in evidence:**
- Any password value
- DATABASE_URL (with or without password)
- REDIS_URL (with or without password)
- `.env` file contents
- Any connection string containing a password
- Any secret key, token, or API key
- The instance public IP address (not required)
- Any `AUTH <password>` command or output

---

**Paste the following as your evidence report:**

```
PRIVATE-BETA-STAGING-EXECUTION-03 — Step 2 Evidence

### Baseline Verification
- Ubuntu version: [paste: lsb_release -a output]
- Node.js version: [paste: node --version]
- npm version: [paste: npm --version]
- Docker version: [paste: docker --version]
- PM2 version: [paste: pm2 --version]
- Caddy version: [paste: caddy version]

### PostgreSQL
- PostgreSQL version: [paste: psql --version output]
- pg_lsclusters output: [paste: pg_lsclusters output]
- PostgreSQL service status summary: [paste: sudo systemctl status postgresql — first 5 lines only]
- listen_addresses check: [paste: grep listen_addresses output from postgresql.conf]
- Port 5432 ss check: [paste: sudo ss -tlnp | grep 5432 output]
- pg_hba.conf non-comment entries: [paste: grep non-comment output from pg_hba.conf — verify no 0.0.0.0/0]
- \du aisandbox output: [paste: user attributes — confirm no Superuser/Create DB/Create role]
- \l aisandbox output: [paste: database listing — confirm aisandbox exists with owner aisandbox]
- App user localhost connection test: Connected — Yes / No (do NOT paste password or connection string)

### DB Credentials (safe reporting only — no values)
- database created (aisandbox): Yes / No
- database user created (aisandbox): Yes / No
- DB password set privately via \password: Yes / No
- DB password disclosed to AI or pasted into chat: Yes / No  ← must be No

### Redis
- Redis version: [paste: redis-server --version output]
- Redis service status summary: [paste: sudo systemctl status redis-server — first 5 lines only]
- Port 6379 ss check: [paste: sudo ss -tlnp | grep 6379 output]
- redis.conf bind line: [paste: grep ^bind /etc/redis/redis.conf output]
- redis.conf protected-mode line: [paste: grep ^protected-mode /etc/redis/redis.conf output]
- redis.conf requirepass line: [paste: "requirepass [REDACTED]" — confirm it is set, do NOT paste the actual password]
- Unauthenticated ping result: [paste: redis-cli ping output — expected: NOAUTH error]
- Authenticated ping result: PONG received — Yes / No (do NOT paste AUTH command or password)

### Redis Credentials (safe reporting only — no values)
- Redis requirepass configured: Yes / No
- Redis password set privately: Yes / No
- Redis password disclosed to AI or pasted into chat: Yes / No  ← must be No

### Firewall
- Lightsail firewall check (22/80/443 only, 5432/6379 closed): Yes / No
- Port 5432 NOT in Lightsail inbound rules: Yes / No
- Port 6379 NOT in Lightsail inbound rules: Yes / No

### Non-Goal Confirmations
- No repo cloned at /opt/aisandbox: Yes / No
- No .env created: Yes / No
- No app services started: Yes / No
- No migrations run (database is empty — no tables): Yes / No
- No DNS configured: Yes / No
- No TLS configured: Yes / No

### Snapshot
- Snapshot name: [paste name]
- Snapshot status: Available / Pending / Failed

### Warnings or unexpected outputs
[paste any unexpected output, error messages, or deviations from expected values — do NOT include passwords or connection strings]
```

---

## 26. Stop Conditions

Stop immediately and report to AI without continuing if ANY of the following conditions are met:

| # | Stop Condition |
|---|---------------|
| 1 | Ubuntu version is not 24.04.x |
| 2 | Instance hostname or identity does not match `aisandbox-staging` |
| 3 | Runtime snapshot `aisandbox-staging-runtime-2026-07-24` is not Available |
| 4 | `apt update` fails with real errors (E: prefix lines — not just warnings) |
| 5 | PostgreSQL installation fails or produces errors |
| 6 | PostgreSQL version after install is not 15.x |
| 7 | PostgreSQL service is not active (running) after install |
| 8 | `listen_addresses` is set to `'*'` or `'0.0.0.0'` in postgresql.conf |
| 9 | Port 5432 is bound to `0.0.0.0:5432` (externally reachable) |
| 10 | pg_hba.conf contains `0.0.0.0/0` or `::/0` host entries |
| 11 | App user `aisandbox` connection test from localhost fails unexpectedly |
| 12 | App user has Superuser, Create DB, or Create role attributes |
| 13 | Redis installation fails or produces errors |
| 14 | Redis version after install is not 7.x |
| 15 | Redis service is not active (running) after configuration |
| 16 | Port 6379 is bound to `0.0.0.0:6379` (externally reachable) |
| 17 | `redis-cli ping` (unauthenticated) returns `PONG` instead of `NOAUTH` error |
| 18 | Authenticated Redis ping fails after setting requirepass |
| 19 | Lightsail firewall shows ports other than 22/80/443 open |
| 20 | Any unexpected app services (PM2 processes, API Gateway, AI Service) are running |
| 21 | Repository exists at `/opt/aisandbox` unexpectedly |
| 22 | `.env` file exists unexpectedly |
| 23 | Database contains tables (migrations have somehow run) |
| 24 | Any command asks for AWS credentials, SSH private keys, tokens, or API keys |
| 25 | Any command appears to clone the repo |
| 26 | Any command appears to create or edit the app `.env` |
| 27 | Any command appears to configure DNS or TLS |
| 28 | Any command appears to deploy app services |
| 29 | Any command appears to run migrations |
| 30 | You accidentally paste a password, DATABASE_URL, or REDIS_URL into chat — stop and report immediately |

---

## 27. Expected Final State

After this runbook completes successfully, the `aisandbox-staging` server should be in the following state:

| Item | Expected State |
|------|---------------|
| Instance | `aisandbox-staging` — Running — ap-southeast-1 |
| OS | Ubuntu 24.04.4 LTS / noble |
| Node.js | v20.20.2 — installed |
| npm | 10.8.2 — installed |
| Docker Engine | 29.6.2 — installed |
| Docker Compose | v5.3.1 — installed |
| PM2 | 7.0.3 — no app processes |
| Caddy | v2.11.4 — service active, no site config |
| PostgreSQL | 15.x — installed, service active (running), enabled on boot |
| PostgreSQL binding | 127.0.0.1:5432 only |
| PostgreSQL database | `aisandbox` — created — owned by `aisandbox` user |
| PostgreSQL user | `aisandbox` — created — regular user (no SUPERUSER/CREATEDB/CREATEROLE) |
| PostgreSQL password | Set privately by Keith via `\password` — not disclosed |
| Redis | 7.x — installed, service active (running), enabled on boot |
| Redis binding | 127.0.0.1:6379 only |
| Redis requirepass | Set privately by Keith via redis.conf — not disclosed |
| Redis protected-mode | yes |
| Lightsail firewall | 22/80/443 open; 5432/6379/3002/4000/4001/4002 closed externally |
| Repository | Not cloned — `/opt/aisandbox` does not exist |
| App `.env` | Not created |
| App services | Not started |
| Migrations | Not run — database is empty |
| DNS | Not configured |
| TLS | Not configured |
| Snapshots | `aisandbox-staging-baseline-2026-07-23` — Available |
| | `aisandbox-staging-runtime-2026-07-24` — Available |
| | `aisandbox-staging-db-redis-2026-07-24` — Available |

---

## 28. Exact Next Action After Keith Runs the Runbook

After Keith has:
1. Completed all sections of this runbook inside the Lightsail browser SSH console
2. Filled in the safe evidence template (Section 25)
3. Confirmed no stop conditions were triggered (Section 26)
4. Created and confirmed the snapshot `aisandbox-staging-db-redis-2026-07-24` is Available

Keith should paste the safe evidence template back to the AI chat.

The AI will then execute:

**PRIVATE-BETA-STAGING-EXECUTION-03 Step 3 — PostgreSQL + Redis Installation Evidence Review**

This review step will:
- Verify all evidence items against expected values
- Confirm no credential or secret was disclosed
- Record the final PASS or BLOCKED verdict
- Document any deviations

**Do NOT run any app deployment steps, DNS configuration, TLS configuration, repo clone, `.env` creation, or migration execution until Step 3 (Evidence Review) and Step 4 (Consolidation) are complete.**

---

**Runbook created:** 2026-07-24
**Task:** PRIVATE-BETA-STAGING-EXECUTION-03 — Step 2
**Nature:** Runbook only — no server action performed — no source files changed — no env files opened/created/edited — no env values printed — no AWS/SSH/DNS/TLS action occurred — no Docker/PostgreSQL/Redis action occurred locally — no git commit or push — no subagents used.
