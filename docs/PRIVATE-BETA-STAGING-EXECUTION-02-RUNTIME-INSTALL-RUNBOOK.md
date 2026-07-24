# PRIVATE-BETA-STAGING-EXECUTION-02 — Runtime Installation Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-02
**Title:** Runtime Installation Baseline
**Step:** 2 — Runtime Installation Runbook
**Date:** 2026-07-24
**Nature:** Runbook only — no server action by agent — no source changes — no AWS action — no git commit or push — no subagents
**Runbook for:** Keith — to be followed manually inside AWS Lightsail browser SSH

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-02 |
| Title | Runtime Installation Baseline |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — runtime installation on Lightsail instance |
| Risk | MEDIUM — server commands; no source changes; no app deployed |
| Registered | 2026-07-23 |
| Resumed / Activated | 2026-07-24 — Keith staging-environment parity decision |
| Step 1 | Registration — COMPLETE — 2026-07-23 |
| Step 2 | This runbook — PENDING Keith manual execution |
| Step 3 | Keith Manual Evidence Review — PENDING |
| Step 4 | Consolidation / Handoff to STAGING-EXECUTION-03 — PENDING |
| Predecessor | PRIVATE-BETA-STAGING-EXECUTION-01 — COMPLETE and LOCKED — 2026-07-23 |
| Reference plans | docs/PRIVATE-BETA-STAGING-SETUP-04-RUNTIME-CONTAINER-DEPLOYMENT-PLAN.md |

---

## 2. Purpose

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH session to install the baseline runtime tools on `aisandbox-staging`.

After Keith follows this runbook, the server will have:
- Node.js 20 LTS and npm
- Docker Engine
- PM2
- Caddy

No application will be deployed. No database will be installed. No DNS or TLS will be configured. No repo will be cloned. No `.env` will be created.

---

## 3. What This Step Does

| # | Action |
|---|--------|
| 1 | Verify OS baseline (Ubuntu 24.04.x) |
| 2 | Verify firewall still shows only ports 22, 80, 443 open |
| 3 | Install Node.js 20 LTS |
| 4 | Verify node and npm versions |
| 5 | Install Docker Engine using the official Docker apt repository |
| 6 | Verify Docker version and Docker hello-world |
| 7 | Add `ubuntu` user to `docker` group if required |
| 8 | Reconnect/relogin if Docker group membership requires it |
| 9 | Install PM2 globally |
| 10 | Verify PM2 version |
| 11 | Install Caddy using the official Caddy apt repository |
| 12 | Verify Caddy version |
| 13 | Confirm Caddy is installed but not configured for DNS/TLS |
| 14 | Confirm no app deployment occurred |
| 15 | Create post-runtime-install Lightsail snapshot manually |
| 16 | Collect and paste safe evidence back |

---

## 4. What This Step Does Not Do

| # | Not Done |
|---|---------|
| 1 | Does NOT configure DNS A record |
| 2 | Does NOT create or edit a Caddyfile |
| 3 | Does NOT issue a TLS certificate |
| 4 | Does NOT install PostgreSQL |
| 5 | Does NOT install Redis |
| 6 | Does NOT clone the repository |
| 7 | Does NOT create a `.env` file |
| 8 | Does NOT build or start any app services |
| 9 | Does NOT start any PM2 app processes |
| 10 | Does NOT run database migrations |
| 11 | Does NOT invite beta users |
| 12 | Does NOT launch the staging app publicly |
| 13 | Does NOT change source code |
| 14 | Does NOT enable billing or payment |
| 15 | Does NOT enable AI execution or container sandbox execution |

---

## 5. Cost / Safety Note

- The `aisandbox-staging` Lightsail instance is running and billing at approximately US$40–44/month.
- This runbook installs system tools only. No app is deployed. No users can access the server from a browser.
- The server has automatic snapshots enabled (daily). A manual snapshot will be created at the end of this runbook as an additional rollback point.
- All commands in this runbook run on the server (Ubuntu Linux), not on your local Windows machine.
- Do not paste any secrets, private keys, `.env` contents, database URLs, or credentials into the Lightsail browser SSH terminal in a way that could be captured in screenshots or logs.

---

## 6. Preconditions

Before starting, verify all of the following are true. Stop and report if any are false.

| # | Precondition | Expected |
|---|-------------|---------|
| 1 | AWS Lightsail instance name | `aisandbox-staging` |
| 2 | Region | Singapore / ap-southeast-1 |
| 3 | Instance status | Running |
| 4 | OS | Ubuntu 24.04.x LTS |
| 5 | Static IP | Attached to instance (you hold the IP value privately) |
| 6 | Lightsail firewall public ports | 22, 80, 443 only |
| 7 | Internal ports 3002/4000/4001/4002/5432/6379 | Closed externally (not listed in Lightsail firewall rules) |
| 8 | Manual baseline snapshot | `aisandbox-staging-baseline-2026-07-23` — status: Available |
| 9 | Automatic snapshots | Enabled |
| 10 | No runtime installed | Node.js / Docker / PM2 / Caddy not yet installed |
| 11 | No repo cloned | `/opt/aisandbox` does not exist |
| 12 | No `.env` created | No `.env` file on the server |
| 13 | No app running | No app services started |
| 14 | No PostgreSQL / Redis | Not installed |
| 15 | No DNS / TLS configured | No DNS A record or Caddy config |

**Stop if any precondition is not met. Report the deviation before proceeding.**

---

## 7. How to Open Lightsail Browser SSH

> **All server commands in this runbook must be run inside AWS Lightsail browser SSH — not PowerShell.**

Steps to open the Lightsail browser SSH session:

1. Log in to your AWS Console at https://console.aws.amazon.com
2. Navigate to Lightsail.
3. Ensure the region is Singapore / ap-southeast-1.
4. Click on the `aisandbox-staging` instance.
5. Click the orange **Connect using SSH** button (or the terminal icon).
6. A browser SSH terminal window opens. You are connected as the `ubuntu` user.
7. Verify the prompt shows something like `ubuntu@ip-<private-ip>:~$`.

You do not need your SSH private key for Lightsail browser SSH. Do not use local PowerShell for server commands.

---

## 8. Baseline Server Verification

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

Run each command below and verify the expected result. Stop and report if anything is unexpected.

**Check OS version:**

```bash
lsb_release -a
```

Expected: `Ubuntu 24.04.x LTS` / `noble`. Stop if the version is not `24.04.x`.

**Check hostname and OS details:**

```bash
hostnamectl
```

Expected: Operating System shows `Ubuntu 24.04.x LTS`, kernel shows `aws`.

**Check timezone:**

```bash
timedatectl
```

Expected: Timezone `Asia/Hong_Kong`, NTP synchronized `yes`.

**Check disk space:**

```bash
df -h
```

Expected: Root partition shows ~154 GB total, low usage (fresh server).

**Check memory:**

```bash
free -h
```

Expected: ~7.6 GiB total RAM.

**Check uptime:**

```bash
uptime
```

Expected: Server is running (any uptime value is fine).

**Check that Node.js is NOT yet installed:**

```bash
node --version 2>/dev/null || echo "node not installed"
```

Expected: `node not installed`. If Node.js is already installed, stop and report.

**Check that Docker is NOT yet installed:**

```bash
docker --version 2>/dev/null || echo "docker not installed"
```

Expected: `docker not installed`. If Docker is already installed, stop and report.

**Check that PM2 is NOT yet installed:**

```bash
pm2 --version 2>/dev/null || echo "pm2 not installed"
```

Expected: `pm2 not installed`. If PM2 is already installed, stop and report.

**Check that Caddy is NOT yet installed:**

```bash
caddy version 2>/dev/null || echo "caddy not installed"
```

Expected: `caddy not installed`. If Caddy is already installed, stop and report.

---

## 9. Node.js 20 LTS Installation

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

Install Node.js 20 LTS using the official NodeSource binary distribution.

**Step 9.1 — Update apt package lists:**

```bash
sudo apt update
```

Expected: Completes without errors. Some "Hit" and "Get" lines are normal.

**Step 9.2 — Add NodeSource repository for Node.js 20:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

Expected: Output ends with a message indicating the NodeSource repository was added successfully.

Stop if this command asks for secrets, credentials, or appears to deploy anything. Stop if the command fails with a non-network error.

**Step 9.3 — Install Node.js:**

```bash
sudo apt install -y nodejs
```

Expected: Installs `nodejs` package. Completes without errors.

---

## 10. Node.js / npm Verification

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Verify Node.js version:**

```bash
node --version
```

Expected: `v20.x.x` (any patch version of Node.js 20 is acceptable).

Stop if the version is not `v20.x.x`.

**Verify npm version:**

```bash
npm --version
```

Expected: `10.x.x` (npm bundled with Node.js 20). Any `10.x.x` value is acceptable.

Note: Do NOT use `snap` to install Node.js. Do NOT enable corepack. Use only the npm bundled with Node.js 20.

---

## 11. Docker Engine Installation

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

Install Docker Engine using the official Docker apt repository. Follow every step in order.

**Step 11.1 — Remove any older Docker packages (safe to ignore errors if none exist):**

```bash
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
```

Expected: Either removes packages or reports nothing to remove. Both are acceptable.

**Step 11.2 — Install prerequisites:**

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
```

Expected: Packages installed or already up-to-date. Completes without errors.

**Step 11.3 — Add Docker GPG key:**

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

Expected: Completes silently or with minor output. No errors.

**Step 11.4 — Add Docker repository:**

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Expected: Completes silently. No errors.

**Step 11.5 — Update apt and install Docker Engine:**

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Expected: Docker packages downloaded and installed. This may take 1–2 minutes. Completes without errors.

Stop if this step asks for secrets, credentials, private keys, or appears to deploy or clone an application.

---

## 12. Docker Verification

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Verify Docker version:**

```bash
docker --version
```

Expected: `Docker version 27.x.x` or similar (any recent stable version is acceptable).

**Run Docker hello-world to confirm Docker is working:**

```bash
sudo docker run hello-world
```

Expected: Output includes `Hello from Docker!` and a brief explanation. This confirms Docker Engine is installed and functioning.

Note: The `hello-world` container is pulled from Docker Hub (internet access required). This is not a user app container — it is a safe diagnostic image that exits immediately.

**Verify Docker Compose is available:**

```bash
docker compose version
```

Expected: `Docker Compose version v2.x.x`.

---

## 13. Docker Group Setup and Reconnect Note

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

By default, running Docker commands requires `sudo`. To allow the `ubuntu` user to run Docker commands without `sudo`, add the user to the `docker` group.

**Step 13.1 — Add ubuntu user to docker group:**

```bash
sudo usermod -aG docker ubuntu
```

Expected: Completes silently. No output is normal.

**Step 13.2 — Apply the group change:**

The group membership change does not take effect in your current terminal session. You must reconnect.

1. Close the current Lightsail browser SSH window.
2. Reopen the Lightsail browser SSH connection (click Connect using SSH again on the `aisandbox-staging` instance page).
3. Verify the group membership is active:

```bash
groups
```

Expected: Output includes `docker` in the group list (e.g., `ubuntu adm dialout cdrom ... docker ...`).

**Step 13.3 — Verify Docker works without sudo after reconnect:**

```bash
docker run hello-world
```

Expected: `Hello from Docker!` output. This confirms the `ubuntu` user can run Docker without `sudo`.

> **Security note:** The `docker` group grants access equivalent to root on the host via the Docker socket (`/var/run/docker.sock`). This is the expected and safe configuration for the staging server. Do NOT expose the Docker socket publicly.

---

## 14. PM2 Installation

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

Install PM2 globally using npm. PM2 is the process manager that will later run all app services.

**Step 14.1 — Install PM2 globally:**

```bash
sudo npm install -g pm2
```

Expected: PM2 package downloaded and installed globally. Output includes `added 1 package` or similar. Completes without errors.

Stop if this step asks for secrets, credentials, or appears to deploy an application or clone a repository.

---

## 15. PM2 Verification

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Verify PM2 version:**

```bash
pm2 --version
```

Expected: `5.x.x` or similar (any recent PM2 stable version is acceptable).

**Verify PM2 list shows no processes running:**

```bash
pm2 list
```

Expected: Empty process list (no app processes are running yet). This is correct — no app has been deployed.

---

## 16. Caddy Installation

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

Install Caddy using the official Caddy apt repository.

**Step 16.1 — Install prerequisites:**

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
```

Expected: Packages installed or already up-to-date. Completes without errors.

**Step 16.2 — Add Caddy GPG key:**

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
```

Expected: Completes silently. No errors.

**Step 16.3 — Add Caddy repository:**

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
```

Expected: Prints the Caddy repository line. Completes without errors.

**Step 16.4 — Update apt and install Caddy:**

```bash
sudo apt update
sudo apt install caddy
```

Expected: Caddy package downloaded and installed. Completes without errors.

---

## 17. Caddy Verification

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Verify Caddy version:**

```bash
caddy version
```

Expected: `v2.x.x` (any recent Caddy v2 stable version is acceptable).

**Verify Caddy service status:**

```bash
sudo systemctl status caddy
```

Expected: Shows `active (running)` or `active (exited)`. Caddy installs as a systemd service. It may show as active but idle — this is normal. No Caddyfile has been configured yet.

**Verify Caddy has no site config:**

```bash
cat /etc/caddy/Caddyfile
```

Expected: The default Caddyfile (showing a placeholder or example site). There must be no `staging.ainow.biz` entry. If you see `staging.ainow.biz` in this file, stop and report.

---

## 18. Confirm No DNS / TLS Configuration

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Confirm no custom Caddyfile configured:**

```bash
cat /etc/caddy/Caddyfile
```

Expected: Default placeholder content only. No `staging.ainow.biz` entry.

**Confirm Caddy has no active HTTPS certificate for the staging domain:**

```bash
sudo ls /var/lib/caddy/.local/share/caddy/certificates/ 2>/dev/null || echo "no certificates directory"
```

Expected: Either `no certificates directory` or an empty directory. No certificate for `staging.ainow.biz` should exist.

No DNS A record has been created. No TLS certificate has been issued. This is correct — DNS and TLS configuration belongs to a future execution task.

---

## 19. Confirm No App Deployment

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Confirm no repo cloned:**

```bash
ls /opt/aisandbox 2>/dev/null || echo "directory does not exist"
```

Expected: `directory does not exist`. If `/opt/aisandbox` exists, stop and report.

**Confirm no PM2 app processes running:**

```bash
pm2 list
```

Expected: Empty process list.

**Confirm no `.env` file:**

```bash
ls /opt/aisandbox/.env 2>/dev/null || echo "no .env file"
```

Expected: `no .env file`.

**Confirm PostgreSQL is not installed:**

```bash
psql --version 2>/dev/null || echo "postgresql not installed"
```

Expected: `postgresql not installed`.

**Confirm Redis is not installed:**

```bash
redis-server --version 2>/dev/null || echo "redis not installed"
```

Expected: `redis not installed`.

---

## 20. Optional Reboot Guidance

A reboot is not required after this runtime installation. All installed tools (Node.js, Docker, PM2, Caddy) are available immediately without a reboot.

However, you may reboot if:
- Any service shows an unexpected state after installation.
- The system suggests a reboot is required.
- You want to verify that Docker and Caddy start automatically on boot.

**If you choose to reboot:**

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
sudo reboot
```

After rebooting, reconnect via Lightsail browser SSH and verify:

```bash
node --version
docker --version
pm2 --version
caddy version
sudo systemctl status caddy
```

All should show their installed versions. Caddy should show as active.

---

## 21. Post-Runtime-Install Snapshot Steps

After all runtime tools are installed and verified, create a manual Lightsail snapshot to record the clean post-runtime-install state. This snapshot provides a rollback point before database installation and app deployment.

**Steps (in AWS Lightsail console — not browser SSH):**

1. Go to your AWS Lightsail console: https://lightsail.aws.amazon.com
2. Click on the `aisandbox-staging` instance.
3. Click the **Snapshots** tab.
4. Click **Create snapshot** (manual snapshot).
5. Enter the snapshot name exactly:

   ```
   aisandbox-staging-runtime-2026-07-24
   ```

   (Use today's date if different from 2026-07-24, e.g., `aisandbox-staging-runtime-2026-07-25`.)

6. Click **Create**.
7. Wait for the snapshot status to become **Available** (this may take a few minutes).
8. Note the snapshot name and status for the evidence report.

**Important:** Do not delete or modify the existing `aisandbox-staging-baseline-2026-07-23` snapshot.

---

## 22. Safe Evidence Template for Keith

After completing all steps, paste only the safe outputs listed below. **Do not paste:** IP values, secrets, private keys, tokens, `.env` contents, database URLs, passwords, or credentials.

Copy the template below and fill in the safe values:

```
=== PRIVATE-BETA-STAGING-EXECUTION-02 — Safe Evidence Report ===

Date: [e.g., 2026-07-24]

--- Ubuntu Version ---
[Paste output of: lsb_release -a]

--- Node.js Version ---
[Paste output of: node --version]

--- npm Version ---
[Paste output of: npm --version]

--- Docker Version ---
[Paste output of: docker --version]

--- Docker hello-world summary ---
[Paste only: "Hello from Docker!" line or confirm it appeared]

--- Docker groups active (no sudo needed) ---
[Paste output of: groups | grep docker (just confirm docker is in the output)]

--- PM2 Version ---
[Paste output of: pm2 --version]

--- PM2 Process List ---
[Paste output of: pm2 list — should be empty]

--- Caddy Version ---
[Paste output of: caddy version]

--- Caddy Status ---
[Paste output of: sudo systemctl status caddy | head -5]

--- Snapshot Name ---
[e.g., aisandbox-staging-runtime-2026-07-24]

--- Snapshot Status ---
[e.g., Available]

--- Confirmations (answer Yes / No for each) ---
No repo cloned (/opt/aisandbox does not exist): [Yes / No]
No .env file on server: [Yes / No]
No app services started (pm2 list is empty): [Yes / No]
No PostgreSQL installed: [Yes / No]
No Redis installed: [Yes / No]
No DNS A record configured: [Yes / No]
No TLS certificate issued: [Yes / No]
No staging.ainow.biz entry in Caddyfile: [Yes / No]

--- Any warnings or unexpected outputs --- 
[Describe any issues, or write "None"]
```

---

## 23. Stop Conditions

Stop immediately and report before continuing if any of the following occur:

| # | Stop Condition |
|---|---------------|
| 1 | `lsb_release -a` shows Ubuntu version is not `24.04.x` |
| 2 | Instance name in Lightsail console is not `aisandbox-staging` |
| 3 | Baseline snapshot `aisandbox-staging-baseline-2026-07-23` is not Available |
| 4 | `sudo apt update` or `sudo apt upgrade` fails with an error (not a warning) |
| 5 | Node.js installation fails or installs a version other than `v20.x.x` |
| 6 | Docker installation fails or shows an unexpected error |
| 7 | Any Docker installation step asks for secrets, credentials, private keys, or appears to deploy an application |
| 8 | PM2 installation fails |
| 9 | Caddy installation fails |
| 10 | Any command asks you to enter a password, token, API key, or credential |
| 11 | Any command appears to clone a repository |
| 12 | Any command appears to create or edit a `.env` file |
| 13 | Any command appears to configure DNS or a TLS certificate |
| 14 | Any command appears to install PostgreSQL or Redis |
| 15 | Any command appears to run database migrations |
| 16 | Any command appears to deploy an application or start app services |
| 17 | Lightsail firewall shows ports other than 22, 80, 443 open |
| 18 | `/opt/aisandbox` already exists (repo was previously cloned) |
| 19 | `pm2 list` shows app processes already running |
| 20 | A staging app appears to be live at any URL |

---

## 24. Expected Final State After Runbook

After Keith successfully runs this runbook, the server state should be:

| Item | Expected State |
|------|---------------|
| Ubuntu | 24.04.x LTS — unchanged |
| Timezone | Asia/Hong_Kong — unchanged |
| Firewall | 22, 80, 443 open only — unchanged |
| Node.js | v20.x.x — newly installed |
| npm | 10.x.x — newly installed (bundled with Node.js) |
| Docker Engine | Installed and running |
| Docker group | `ubuntu` user in `docker` group |
| PM2 | Installed globally, no processes running |
| Caddy | Installed, systemd service active, no site config |
| Repository | Not cloned — `/opt/aisandbox` does not exist |
| `.env` | Not created |
| PostgreSQL | Not installed |
| Redis | Not installed |
| DNS | Not configured |
| TLS | Not configured |
| App services | Not started |
| Migrations | Not run |
| Snapshot | `aisandbox-staging-runtime-2026-07-24` — Available |
| Baseline snapshot | `aisandbox-staging-baseline-2026-07-23` — unchanged |

---

## 25. Exact Next Action After Keith Runs the Runbook

After Keith completes the runbook and pastes the safe evidence:

1. The agent (Step 3) will review the evidence report.
2. If all confirmations are `Yes` and all versions match expected values, Step 3 will record a PASS verdict.
3. Step 4 (Consolidation) will then update `TASKS.md` and `TASKS_BACKLOG_FULL.md`, create the consolidation checkpoint, and hand off to `PRIVATE-BETA-STAGING-EXECUTION-03`.

**Keith must paste the safe evidence template (Section 22) before Step 3 can begin.**

Do not proceed to Step 3 without Keith's evidence report.

---

**Runbook created:** 2026-07-24
**Task:** PRIVATE-BETA-STAGING-EXECUTION-02 — Step 2
**Nature:** Runbook only — no server action by agent.
**No source code changed.**
**No env files created/opened/edited.**
**No env values printed or requested.**
**No server/SSH/AWS/DNS/TLS action occurred.**
**No Docker/PostgreSQL/Redis action occurred locally.**
**No git commit or push occurred.**
**No subagents used.**
