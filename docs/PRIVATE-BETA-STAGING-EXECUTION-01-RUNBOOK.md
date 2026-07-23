# PRIVATE-BETA-STAGING-EXECUTION-01 — AWS Lightsail Server Creation Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-01
**Step:** 2 — AWS Lightsail Server Creation + Static IP + Firewall + Baseline Runbook
**Status:** ACTIVE — Step 2 (Runbook created — 2026-07-23)
**Date:** 2026-07-23
**Prerequisite:** PRIVATE-BETA-STAGING-SETUP — COMPLETE and LOCKED — 2026-07-23
**Nature:** Documentation only — no AWS action, no server/static IP/firewall/SSH action, no runtime/install/deploy action occurred during this step.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-01 |
| Title | Create AWS Lightsail Staging Server + Static IP + Baseline |
| Family | BETA READY / PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — HIGH RISK |
| Risk | HIGH — real cloud resources; real cost; real server |
| Keith Approval | "go" — 2026-07-23 |
| Registered | 2026-07-23 |
| Step 1 | COMPLETE — Registration — 2026-07-23 |
| Step 2 | ACTIVE — This runbook — 2026-07-23 |
| Step 3 | PENDING — Keith manual execution evidence review |
| Step 4 | PENDING — Governance consolidation / checkpoint |

---

## 2. Purpose

This runbook gives Keith a precise, step-by-step manual guide to:

1. Create the AWS Lightsail staging instance `aisandbox-staging`.
2. Create and attach the static IP `aisandbox-staging-ip`.
3. Configure the Lightsail firewall with exactly the correct open/closed ports.
4. Connect via AWS Lightsail browser SSH.
5. Perform the OS baseline update and timezone configuration.
6. Reboot and verify the baseline is clean.
7. Take the first Lightsail snapshot.
8. Collect safe evidence to report back.

This runbook is for Keith to execute manually in the AWS console and via Lightsail browser SSH.

**The agent does not perform any of these steps. No AWS action occurred during the creation of this document.**

---

## 3. Cost Warning

> **STOP AND READ BEFORE CLICKING CREATE.**

- Creating the AWS Lightsail instance **immediately starts real cloud cost**.
- Planned instance cost: approximately **US$40–44/month**.
- The meter starts the moment the instance is created — even if nothing is deployed yet.
- A static IP attached to a running instance is **free**. A static IP that is **detached** costs approximately **US$3.50/month**.
- Keith must **manually confirm** before clicking any AWS create or provision action.
- If Keith is not ready to incur real cost today, do not proceed.
- The agent must not and did not create any AWS resource.

---

## 4. What This Runbook Does

This runbook covers the following actions Keith will perform manually:

- AWS Lightsail region selection and instance creation
- Static IP creation and attachment
- Lightsail firewall configuration
- AWS Lightsail browser SSH connection
- OS package update (`apt update`, `apt upgrade`)
- Timezone configuration (`Asia/Hong_Kong`)
- Reboot and post-reboot verification
- Baseline verification commands
- First Lightsail snapshot creation
- Safe evidence collection and reporting

---

## 5. What This Runbook Does Not Do

The following are **explicitly out of scope** for this step. None of the following must happen during Keith's execution of this runbook:

| # | Out of Scope |
|---|-------------|
| 1 | DNS A record for staging.ainow.biz |
| 2 | Caddy or TLS/HTTPS setup |
| 3 | Node.js, npm, Docker, PM2 installation |
| 4 | PostgreSQL or Redis installation |
| 5 | Repository clone |
| 6 | `.env` file creation |
| 7 | Application deployment |
| 8 | Database migration execution |
| 9 | Beta user invitation |
| 10 | Production domain use |
| 11 | Public launch of any kind |

---

## 6. Preconditions Before Keith Starts

Keith must confirm all of the following before beginning:

- [ ] You are logged in to the correct AWS account (the one confirmed in PRIVATE-BETA-STAGING-SETUP-01).
- [ ] You are ready to incur real cloud cost (~US$40–44/month starting now).
- [ ] You have reviewed the cost warning in Section 3 above.
- [ ] You have private notes ready to record the static IP address (do not put it in tracked docs unless necessary).
- [ ] You have a browser open and ready to access the AWS Lightsail console.
- [ ] You understand that the Lightsail browser SSH is what you will use — no local SSH setup required for this step.
- [ ] You understand that DNS, TLS, runtime, and deployment are NOT part of this step.

If any of the above are not confirmed, do not proceed. Report the blocker instead.

---

## 7. AWS Lightsail Region Selection

1. Open the AWS Console: [https://console.aws.amazon.com/](https://console.aws.amazon.com/)
2. In the search bar or services menu, navigate to **Lightsail**.
   - Direct URL: [https://lightsail.aws.amazon.com/](https://lightsail.aws.amazon.com/)
3. In the Lightsail console, locate the **region selector** (typically in the top-right area or on the home screen).
4. Select: **Asia Pacific (Singapore) — ap-southeast-1**

> **Stop condition:** If Singapore / ap-southeast-1 is not available or not selectable, stop and report. Do not use a different region without explicit approval.

---

## 8. Instance Creation Steps

> **All steps in this section are manual AWS console actions performed by Keith.**

1. In the Lightsail console with Singapore selected, click **"Create instance"**.
2. On the instance creation screen:
   - **Select a platform:** Choose **Linux/Unix**
   - **Select a blueprint:** Choose **OS Only**
   - **Select OS:** Choose **Ubuntu** — select the **latest Ubuntu LTS** available (expected: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS)
3. **Select an instance plan:** Scroll to find the plan with:
   - **8 GB RAM**
   - **2 vCPU**
   - **160 GB SSD**
   - Approximately **$40/month**

   > **Stop condition:** If the 8 GB / 160 GB SSD plan is not visible, stop and report. Do not select a different plan without explicit approval.

   > **Stop condition:** If the estimated cost shown differs significantly from ~$40/month, stop and report before clicking Create.

4. **Identify your instance:** In the instance name field, type exactly:
   ```
   aisandbox-staging
   ```
5. Do not add any launch scripts, key pair changes, or tags unless you need them for your workflow. The defaults are fine.
6. **Review the configuration:**
   - Region: Asia Pacific (Singapore) — ap-southeast-1
   - Platform: Linux/Unix
   - Blueprint: Ubuntu LTS (OS Only)
   - Plan: 8 GB / 2 vCPU / 160 GB SSD / ~$40/month
   - Instance name: `aisandbox-staging`
7. **Keith must confirm before clicking Create.** Re-read the cost warning. When ready:
   - Click **"Create instance"**
8. Wait on the Lightsail instances screen until the instance status shows **"Running"**.
   - This typically takes 1–3 minutes.

> **Stop condition:** If instance creation fails or the instance does not reach "Running" status within 5 minutes, stop and report the error message shown.

---

## 9. Static IP Creation and Attachment Steps

> **Wait until `aisandbox-staging` shows status "Running" before proceeding.**

1. In the Lightsail console, click the **"Networking"** tab in the top navigation, or find the **"Static IPs"** section.
2. Click **"Create static IP"**.
3. On the static IP creation screen:
   - **Region:** Confirm it is **Asia Pacific (Singapore) — ap-southeast-1**
   - **Attach to instance:** Select **`aisandbox-staging`**
   - **Static IP name:** Type exactly:
     ```
     aisandbox-staging-ip
     ```
4. Click **"Create"** to create and attach the static IP.
5. The static IP will be assigned and automatically attached to `aisandbox-staging`.
6. **Record the assigned static IP address privately** in Keith's personal notes.
   - Do not paste the IP address into this tracked document unless it is necessary for debugging.
   - Do not paste the IP address into Cursor chat or any AI assistant.
7. Confirm in the Lightsail console that the static IP shows as **attached to `aisandbox-staging`**.

> **Stop condition:** If the static IP cannot be created or cannot attach to the instance, stop and report.

> **Important:** Do NOT detach the static IP from the instance while it is running. A detached static IP costs money and breaks DNS (when DNS is configured in a later step).

> **Do NOT create a DNS A record yet.** DNS configuration belongs to a later task.

---

## 10. Firewall Rules

> **Lightsail instances come with some default firewall rules. You must verify and correct the firewall after instance creation.**

### 10a. Accessing the Firewall

1. In the Lightsail console, click on the instance **`aisandbox-staging`**.
2. Click the **"Networking"** tab on the instance detail page.
3. Find the **"IPv4 Firewall"** section.

### 10b. Required Open Ports (Public)

The firewall must have **exactly and only** these rules for public internet access:

| Protocol | Port | Purpose |
|----------|------|---------|
| TCP | 22 | SSH access (Lightsail browser SSH and future local SSH) |
| TCP | 80 | HTTP (Caddy — redirect to HTTPS; also needed for Let's Encrypt TLS challenge in a later step) |
| TCP | 443 | HTTPS (Caddy — reverse proxy to frontend/API — configured in a later step) |

### 10c. Ports That Must Remain Closed (Not in Firewall)

The following ports must **NOT** be added to the Lightsail public firewall at any time:

| Protocol | Port | Service | Reason |
|----------|------|---------|--------|
| TCP | 3002 | Frontend (Next.js) | Internal only — accessed via Caddy |
| TCP | 4000 | API Gateway (NestJS) | Internal only — accessed via Caddy |
| TCP | 4001 | AI Service Worker | Internal only — no external access |
| TCP | 4002 | Container Manager | Internal only — no external access |
| TCP | 5432 | PostgreSQL 15 | Database — must never be internet-exposed |
| TCP | 6379 | Redis 7 | Cache — must never be internet-exposed |

**These ports must never be added to the Lightsail firewall.** They are intentionally internal-only.

### 10d. Firewall Verification Steps

1. In the IPv4 Firewall section, review all existing rules.
2. Lightsail may add default rules (e.g., HTTP or SSH may already be present). Remove any rules that are not TCP 22, TCP 80, or TCP 443.
3. If TCP 80 or TCP 443 are not present, click **"+ Add rule"** and add them.
4. Confirm the final firewall state matches exactly:
   - TCP 22: open
   - TCP 80: open
   - TCP 443: open
   - All other ports: not listed (closed)
5. If Lightsail shows an IPv6 Firewall section, apply the same three rules there as well.

> **Stop condition:** If the firewall UI shows unexpected pre-open ports that cannot be removed, stop and report before proceeding.

---

## 11. Browser SSH Steps

> **All commands in Sections 12–15 must be run inside the AWS Lightsail browser SSH terminal.**
> **Do NOT run these commands in PowerShell or any local terminal.**
> **Label all commands clearly as: Run inside AWS Lightsail browser SSH.**

### Connecting via Browser SSH

1. In the Lightsail console, click on instance **`aisandbox-staging`**.
2. On the instance detail page, click **"Connect using SSH"** (or the terminal icon).
3. A browser-based SSH terminal will open. This connects you as the `ubuntu` user.
4. You will see a prompt like:
   ```
   ubuntu@ip-xxx-xxx-xxx-xxx:~$
   ```
5. You are now connected as the `ubuntu` user. Use `sudo` for administrative commands. Do not log in as root.

> **Stop condition:** If the Lightsail browser SSH fails to connect or shows an error after the instance is Running, stop and report.

---

## 12. OS Baseline Update Commands

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

Run the following commands one at a time. Wait for each to complete before running the next.

**Step 1 — Update package lists:**
```bash
sudo apt update
```

Expected: The command runs without errors and shows a list of package sources and a summary line like `N packages can be upgraded.`

> **Stop condition:** If `sudo apt update` fails with a network error or repository error, stop and report the error output.

**Step 2 — Upgrade all packages:**
```bash
sudo apt upgrade -y
```

Expected: Packages are upgraded. This may take several minutes depending on the number of updates. When complete, you will see a summary.

> **Stop condition:** If `sudo apt upgrade -y` fails or stalls without progress for more than 10 minutes, stop and report.

---

## 13. Timezone Command

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Step 3 — Set timezone:**
```bash
sudo timedatectl set-timezone Asia/Hong_Kong
```

Expected: The command runs silently with no output (this is normal).

**Step 4 — Verify timezone:**
```bash
timedatectl
```

Expected output will show:
- `Time zone: Asia/Hong_Kong (HKT, +0800)` or similar
- `System clock synchronized: yes` (may take a moment after first boot)

> **Stop condition:** If the timezone command fails or `timedatectl` shows a different timezone, stop and report.

---

## 14. Reboot and Reconnect Steps

> **Run inside AWS Lightsail browser SSH — not PowerShell.**

**Step 5 — Reboot (if kernel update was applied):**

After `sudo apt upgrade -y`, check if a kernel update was installed. If you see any message mentioning a kernel update or if the system suggests a reboot, run:

```bash
sudo reboot
```

After running `sudo reboot`:
- The browser SSH window will disconnect. This is expected.
- Wait approximately 1–2 minutes for the instance to reboot.
- Do NOT close the browser window; Lightsail may reconnect automatically, or click "Connect using SSH" again.
- Confirm the instance shows "Running" status in the Lightsail console before reconnecting.

**Reconnect via Lightsail browser SSH after reboot.**

---

## 15. Baseline Verification Commands

> **Run inside AWS Lightsail browser SSH after reconnecting — not PowerShell.**

Run all of the following verification commands. Record the output for the evidence report in Step 3.

**Verify system identity:**
```bash
hostnamectl
```

Expected: Shows OS name, kernel version, and architecture.

**Verify OS version:**
```bash
lsb_release -a
```

Expected: Shows Ubuntu version (e.g., Ubuntu 22.04 LTS or Ubuntu 24.04 LTS), codename, and description.

**Verify timezone:**
```bash
timedatectl
```

Expected: Shows `Time zone: Asia/Hong_Kong (HKT, +0800)`.

**Verify uptime (confirms successful reboot):**
```bash
uptime
```

Expected: Shows a short uptime (a few minutes if recently rebooted), current time in HKT.

**Optional — verify disk space:**
```bash
df -h
```

Expected: Shows disk layout including the 160 GB SSD. Should have most space available.

**Optional — verify memory:**
```bash
free -h
```

Expected: Shows approximately 8 GB total RAM.

**Optional — verify no unexpected open services:**
```bash
sudo apt update
```

Run a second time to confirm the system is still clean and up-to-date. Should return `0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.` (or similar confirming no outstanding updates).

---

## 16. Snapshot Creation Steps

> **Snapshots are created via the Lightsail console — not via SSH commands.**

A snapshot at this stage captures the clean OS baseline: fully updated Ubuntu, timezone set, rebooted. This is the rollback point before any software is installed.

1. In the Lightsail console, click on instance **`aisandbox-staging`**.
2. Click the **"Snapshots"** tab on the instance detail page.
3. Click **"Create snapshot"** (or **"+ Create snapshot"**).
4. For the snapshot name, use:
   ```
   aisandbox-staging-baseline-2026-07-23
   ```
   Or substitute the actual date if different from 2026-07-23. Use the format `aisandbox-staging-baseline-YYYY-MM-DD`.
5. Confirm and click to create the snapshot.
6. Wait until the snapshot status shows **"Available"**. This may take several minutes.
7. Record the exact snapshot name privately.
8. Report the snapshot name and status in the evidence report (name and status only — no secret values).

> **Stop condition:** If snapshot creation fails or does not reach "Available" status within 15 minutes, stop and report.

---

## 17. Safe Evidence Checklist

When Keith has completed all steps above, collect the following evidence to report in Step 3.

**Required evidence (safe to report):**

- AWS region used
- Instance name
- Instance status (Running)
- Instance plan (8 GB / 2 vCPU / 160 GB SSD)
- OS and version (`lsb_release -a` output)
- Static IP name and attached status (name and status only — not the IP value unless Keith decides to include it)
- Firewall open ports as shown in Lightsail console (22, 80, 443)
- Confirmation that ports 3002, 4000, 4001, 4002, 5432, 6379 are NOT open in the firewall
- Browser SSH succeeded (yes/no)
- `sudo apt update` result (success/failure summary)
- `sudo apt upgrade -y` result (success/failure summary)
- Timezone output from `timedatectl` (text only)
- Reboot completed (yes/no)
- Ubuntu version string
- Snapshot name
- Snapshot status (Available/creating/failed)
- Any warnings or errors encountered
- Confirmation that no DNS change occurred
- Confirmation that no runtime, database, or app was installed
- Confirmation that no secrets were included in the report

**Do NOT include in the evidence report:**

- The static IP address value (record privately, not in tracked docs — unless Keith explicitly decides to include it)
- Any SSH private key or key file path
- Any AWS access key or secret key
- Any password or token
- Any `.env` file contents

---

## 18. Stop Conditions

If any of the following occur, Keith must **stop and report immediately** before taking any further action:

| # | Stop Condition |
|---|---------------|
| 1 | Singapore / ap-southeast-1 region is not available or selectable |
| 2 | Ubuntu LTS is not available in Lightsail OS Only blueprints |
| 3 | 8 GB / 2 vCPU / 160 GB SSD plan is not visible |
| 4 | Estimated cost shown by AWS differs significantly from ~$40/month |
| 5 | Instance creation fails with an error |
| 6 | Instance does not reach "Running" status within 5 minutes |
| 7 | Static IP cannot be created |
| 8 | Static IP cannot attach to `aisandbox-staging` |
| 9 | Firewall UI shows unexpected pre-open ports that cannot be removed |
| 10 | Lightsail browser SSH fails to connect after instance is Running |
| 11 | `sudo apt update` fails with a network or repository error |
| 12 | `sudo apt upgrade -y` fails or stalls for more than 10 minutes |
| 13 | Timezone command fails or sets incorrectly |
| 14 | After reboot, browser SSH cannot reconnect and instance appears unresponsive |
| 15 | Snapshot creation fails |
| 16 | Snapshot does not reach "Available" status |
| 17 | AWS prompts for unexpected actions, charges, confirmations, or agreements not covered in this runbook |

Do not attempt to work around stop conditions independently. Report the exact error and await guidance.

---

## 19. What Must Not Happen Yet

The following actions must NOT occur during execution of this runbook. They belong to later tasks:

| # | Must Not Happen Yet |
|---|---------------------|
| 1 | DNS A record for `staging.ainow.biz` — belongs to a later task |
| 2 | Caddy installation or configuration — belongs to a later task |
| 3 | TLS/HTTPS certificate — belongs to a later task |
| 4 | Node.js, npm, Docker, PM2 installation — belongs to a later task |
| 5 | PostgreSQL or Redis installation — belongs to a later task |
| 6 | Repository clone (`/opt/aisandbox`) — belongs to a later task |
| 7 | `.env` file creation — belongs to a later task |
| 8 | Application build or start — belongs to a later task |
| 9 | Database migration execution — requires separate explicit approval |
| 10 | Beta user invitation — requires separate explicit approval |
| 11 | Use of `staging.ainow.biz` or any production domain — no DNS yet |
| 12 | Public launch or beta launch announcement |

---

## 20. Handoff to Evidence Review

After Keith completes this runbook, the next step is:

**PRIVATE-BETA-STAGING-EXECUTION-01 Step 3 — Keith Manual Execution Evidence Review**

Keith should:
1. Complete all steps in this runbook (Sections 7–16).
2. Collect safe evidence per Section 17.
3. Fill in the evidence report template below (Section 21).
4. Paste the completed evidence report into the next chat session.

The agent will review the evidence, verify PASS/BLOCKED criteria, and proceed to Step 4 (Governance consolidation / checkpoint) if all criteria pass.

---

## 21. Evidence Report Template

When Keith has completed the runbook, copy and fill in this template. Paste it in the next chat:

```
PRIVATE-BETA-STAGING-EXECUTION-01 Step 3 Evidence

1. AWS region:
2. Instance name:
3. Instance status:
4. Instance plan:
5. OS:
6. Static IP attached:
7. Firewall open ports shown:
8. Confirm internal ports 3002/4000/4001/4002/5432/6379 are NOT open:
9. Browser SSH succeeded:
10. sudo apt update result:
11. sudo apt upgrade -y result:
12. timezone result:
13. reboot completed:
14. Ubuntu version:
15. snapshot name:
16. snapshot status:
17. Any warnings/errors:
18. Confirmation no DNS change occurred:
19. Confirmation no runtime/database/app install occurred:
20. Confirmation no secrets included:
```

---

## 22. PASS Criteria for Step 2 (This Runbook)

Step 2 is considered PASS if this runbook includes all of the following:

- [x] Cost warning present and clear
- [x] Manual AWS console steps for instance creation
- [x] Singapore / ap-southeast-1 region specified
- [x] Ubuntu LTS specified
- [x] Instance name `aisandbox-staging` and size 8 GB / 2 vCPU / 160 GB SSD
- [x] Static IP creation and attachment steps (name: `aisandbox-staging-ip`)
- [x] Firewall open ports (22, 80, 443) and explicitly closed internal ports documented
- [x] Lightsail browser SSH steps present
- [x] OS update commands (`apt update`, `apt upgrade -y`) present
- [x] Timezone command (`timedatectl set-timezone Asia/Hong_Kong`) present
- [x] Reboot and reconnect steps present
- [x] Post-reboot baseline verification commands present
- [x] Snapshot creation steps present
- [x] Safe evidence checklist present
- [x] Stop conditions listed
- [x] Non-goals (what must not happen yet) listed
- [x] Handoff to Step 3 present
- [x] Evidence report template present
- [x] No AWS action performed by agent

---

## 23. BLOCKED Criteria for Step 2

Step 2 is BLOCKED if any of the following are true in the runbook:

- [ ] AWS instance choices are unclear
- [ ] Cost is not stated or warnings are absent
- [ ] Region or instance defaults are missing
- [ ] Firewall rules are ambiguous
- [ ] Lightsail browser SSH steps are missing
- [ ] OS update commands are unsafe, missing, or unlabeled
- [ ] Snapshot step is missing
- [ ] Evidence would require exposing secrets
- [ ] Runbook requires AWS CLI, AWS credentials in the document, or browser automation

**Step 2 verdict: PASS — all criteria met.**

---

## 24. Exact Next Action

**Keith performs the runbook manually (Sections 7–16), then pastes the completed evidence report (Section 21) in the next chat session to trigger Step 3.**

Until Keith pastes the evidence:
- PRIVATE-BETA-STAGING-EXECUTION-01 Step 3 cannot begin
- No AWS server exists
- No staging target is live
- PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED

---

**Runbook created:** 2026-07-23
**Step 2 status:** Runbook created — awaiting Keith manual execution.
**No AWS action occurred.**
**No server created.**
**No static IP created.**
**No firewall changed.**
**No SSH occurred.**
**No runtime/install/deploy action occurred.**
**No PostgreSQL/Redis action occurred.**
**No migration/backup/snapshot action occurred.**
**No env file created/opened/edited.**
**No secret values printed/requested/generated.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No git commit or git push occurred.**
**No subagents used.**
