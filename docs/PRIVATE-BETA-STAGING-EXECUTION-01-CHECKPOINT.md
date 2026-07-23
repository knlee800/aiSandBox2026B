# PRIVATE-BETA-STAGING-EXECUTION-01 — Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-01
**Title:** Create AWS Lightsail Staging Server + Static IP + Baseline
**Step:** 4 — Consolidation / Checkpoint / Handoff to STAGING-EXECUTION-02
**Final Status:** COMPLETE and LOCKED — 2026-07-23
**Date:** 2026-07-23
**Runbook:** `docs/PRIVATE-BETA-STAGING-EXECUTION-01-RUNBOOK.md`
**Nature:** Governance / checkpoint only — AWS instance was created manually by Keith; no AWS/server/static IP/firewall/SSH action occurred by the agent — no runtime/install/deploy action occurred — no PostgreSQL/Redis action occurred — no migration/backup occurred by agent — no env file created/opened/edited — no secrets printed/requested/generated — no app/API/browser smoke occurred — no implementation — no source/test/package/migration/entity/environment/Docker/deployment files changed — no git commit or push — no subagents used.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-01 |
| Title | Create AWS Lightsail Staging Server + Static IP + Baseline |
| Family | BETA READY / PRIVATE BETA / STAGING EXECUTION / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — HIGH RISK |
| Risk | HIGH — real AWS resource creation; real billing; real server actions |
| Keith Approval | "go" — 2026-07-23 |
| Registered | 2026-07-23 |
| Completed | 2026-07-23 |
| Predecessor | PRIVATE-BETA-STAGING-SETUP — COMPLETE and LOCKED — 2026-07-23 |

---

## 2. Final Status

**PRIVATE-BETA-STAGING-EXECUTION-01: COMPLETE and LOCKED — 2026-07-23**

All 4 steps complete:

| Step | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Registration | COMPLETE | 2026-07-23 |
| 2 | AWS Lightsail execution runbook | COMPLETE | 2026-07-23 |
| 3 | Keith manual execution evidence review | COMPLETE — PASS | 2026-07-23 |
| 4 | Consolidation / Handoff to STAGING-EXECUTION-02 | COMPLETE | 2026-07-23 |

Step 3 evidence review verdict: **PASS** — all 22 evidence items confirmed. No blockers identified.

---

## 3. What Was Executed Manually by Keith

The following actions were performed manually by Keith in the AWS Lightsail console and Lightsail browser SSH. None of these actions were performed by the agent.

| # | Action | Result |
|---|--------|--------|
| 1 | Logged in to AWS Console | Succeeded |
| 2 | Navigated to Lightsail — Singapore / ap-southeast-1 | Succeeded |
| 3 | Created instance `aisandbox-staging` — Linux/Unix / OS Only / Ubuntu 24.04 LTS / 8 GB / 2 vCPU / 160 GB SSD | Succeeded — Running |
| 4 | Created static IP `aisandbox-staging-ip` and attached to `aisandbox-staging` | Succeeded — attached |
| 5 | Configured Lightsail firewall — TCP 22, 80, 443 open; 3002, 4000, 4001, 4002, 5432, 6379 closed | Succeeded |
| 6 | Connected via Lightsail browser SSH as `ubuntu` user | Succeeded |
| 7 | Ran `sudo apt update` | Succeeded |
| 8 | Ran `sudo apt upgrade -y` | Succeeded |
| 9 | Ran `sudo timedatectl set-timezone Asia/Hong_Kong` | Succeeded |
| 10 | Ran `timedatectl` — verified Asia/Hong_Kong (HKT, +0800), NTP synchronized | Succeeded |
| 11 | Ran `sudo reboot` | Succeeded — reconnected after reboot |
| 12 | Ran `hostnamectl` — Ubuntu 24.04.4 LTS, kernel Linux 6.17.0-1010-aws, x86-64, Amazon | Succeeded |
| 13 | Ran `lsb_release -a` — Ubuntu 24.04.4 LTS / noble | Succeeded |
| 14 | Ran `timedatectl` post-reboot — Asia/Hong_Kong, synchronized yes | Succeeded |
| 15 | Ran `uptime` — server running after reboot | Succeeded |
| 16 | Ran `df -h` — root disk ~154G, very low usage | Succeeded |
| 17 | Ran `free -h` — ~7.6Gi total memory | Succeeded |
| 18 | Created manual Lightsail snapshot `aisandbox-staging-baseline-2026-07-23` | Succeeded — Available |
| 19 | Enabled automatic Lightsail snapshots | Succeeded |

---

## 4. What Was Not Executed

The following actions were explicitly NOT performed in this task by Keith or the agent.

| # | Not Executed |
|---|-------------|
| 1 | DNS A record for staging.ainow.biz |
| 2 | Caddy installation or configuration |
| 3 | TLS/HTTPS certificate request |
| 4 | Node.js, npm, Docker, PM2 installation |
| 5 | PostgreSQL or Redis installation |
| 6 | Repository clone to `/opt/aisandbox` |
| 7 | `.env` file creation |
| 8 | Application build or start |
| 9 | Database migration execution |
| 10 | Pre-migration backup (`pg_dump`) |
| 11 | Beta user invitation |
| 12 | Production domain use |
| 13 | Public launch |
| 14 | Any AWS action by the agent |
| 15 | Any SSH action by the agent |
| 16 | Any secret values printed, requested, or generated |

---

## 5. Evidence Summary

Keith reported the following evidence after manual execution. All 22 items confirmed. No blockers.

| # | Evidence Item | Value |
|---|--------------|-------|
| 1 | AWS region | Singapore / ap-southeast-1 |
| 2 | Instance name | aisandbox-staging |
| 3 | Instance status | Running |
| 4 | Instance plan | 8 GB RAM / 2 vCPU / 160 GB SSD |
| 5 | OS | Ubuntu 24.04.4 LTS |
| 6 | Static IP attached | Yes |
| 7 | Firewall open ports shown | 22, 80, 443 |
| 8 | Internal ports 3002/4000/4001/4002/5432/6379 not open | Confirmed |
| 9 | Browser SSH succeeded | Yes |
| 10 | sudo apt update result | Succeeded |
| 11 | sudo apt upgrade -y result | Succeeded |
| 12 | timezone result | Asia/Hong_Kong (HKT, +0800), synchronized yes |
| 13 | reboot completed | Yes |
| 14 | Ubuntu version | Ubuntu 24.04.4 LTS / noble |
| 15 | snapshot name | aisandbox-staging-baseline-2026-07-23 |
| 16 | snapshot status | Available |
| 17 | warnings/errors | None |
| 18 | DNS change occurred | No |
| 19 | runtime/database/app install occurred | No |
| 20 | secrets included | No |
| 21 | Ubuntu version selected | 24.04 LTS |
| 22 | Automatic snapshots enabled | Yes |

---

## 6. AWS Region / Instance / Plan

| Field | Value |
|-------|-------|
| Provider | AWS Lightsail |
| Region | Singapore / ap-southeast-1 |
| Instance name | `aisandbox-staging` |
| Instance plan | 8 GB RAM / 2 vCPU / 160 GB SSD |
| Instance status | Running |
| Estimated cost | ~US$40–44/month |
| OS | Ubuntu 24.04.4 LTS (noble) |
| Kernel | Linux 6.17.0-1010-aws |
| Architecture | x86-64 |
| Virtualization | Amazon (AWS) |

---

## 7. Static IP Attached Status

| Field | Value |
|-------|-------|
| Static IP name | `aisandbox-staging-ip` |
| Attached to | `aisandbox-staging` |
| Status | Attached |
| IP value | Not recorded in tracked docs (Keith holds privately) |
| Cost | Free while attached to running instance |

---

## 8. Firewall Verification

| Protocol | Port | Status | Service |
|----------|------|--------|---------|
| TCP | 22 | **Open** | SSH |
| TCP | 80 | **Open** | HTTP (Caddy — future) |
| TCP | 443 | **Open** | HTTPS (Caddy — future) |
| TCP | 3002 | Closed externally | Frontend (Next.js) |
| TCP | 4000 | Closed externally | API Gateway |
| TCP | 4001 | Closed externally | AI Service Worker |
| TCP | 4002 | Closed externally | Container Manager |
| TCP | 5432 | Closed externally | PostgreSQL |
| TCP | 6379 | Closed externally | Redis |

Keith confirmed firewall UI shows only ports 22, 80, 443 open. Internal ports are not listed in Lightsail firewall rules.

---

## 9. Browser SSH Verification

| Field | Value |
|-------|-------|
| SSH method | AWS Lightsail browser SSH |
| SSH user | `ubuntu` |
| Root access | Via `sudo` only |
| Connection result | Succeeded |
| Local SSH configured | Not in this task |

---

## 10. OS Baseline Update Verification

| Command | Result |
|---------|--------|
| `sudo apt update` | Succeeded |
| `sudo apt upgrade -y` | Succeeded |
| Kernel update applied | Yes — triggered reboot |

---

## 11. Timezone Verification

| Field | Value |
|-------|-------|
| Command | `sudo timedatectl set-timezone Asia/Hong_Kong` |
| Verified with | `timedatectl` |
| Timezone | Asia/Hong_Kong (HKT, +0800) |
| NTP synchronized | Yes |
| NTP active | Yes |

---

## 12. Reboot Verification

| Field | Value |
|-------|-------|
| Reboot reason | Kernel update during `apt upgrade -y` |
| Reboot command | `sudo reboot` |
| Reconnected via browser SSH | Yes |
| System uptime after reboot | Short (confirmed via `uptime`) |
| Post-reboot `hostnamectl` | Ubuntu 24.04.4 LTS — kernel Linux 6.17.0-1010-aws |
| Post-reboot `timedatectl` | Asia/Hong_Kong — synchronized yes |

---

## 13. Disk / Memory Baseline

| Metric | Value |
|--------|-------|
| Root disk total | ~154 GB usable |
| Root disk usage | Very low (fresh baseline) |
| Total RAM | ~7.6 GiB |
| Disk command | `df -h` |
| Memory command | `free -h` |

---

## 14. Manual Snapshot Verification

| Field | Value |
|-------|-------|
| Snapshot name | `aisandbox-staging-baseline-2026-07-23` |
| Snapshot status | Available |
| Created via | Lightsail console — Snapshots tab |
| Created when | After OS baseline update, timezone set, reboot verified |
| Purpose | Clean rollback point before any software installation |

---

## 15. Automatic Snapshot Status

| Field | Value |
|-------|-------|
| Automatic snapshots | Enabled |
| Enabled by | Keith manually in Lightsail console |
| Purpose | Daily automated backup of instance disk state |

---

## 16. Safety Boundaries Preserved

All safety boundaries from PRIVATE-BETA-STAGING-EXECUTION-01 were preserved throughout all 4 steps:

- No AWS action taken by the agent at any point.
- No server, static IP, firewall, or SSH action by the agent.
- No runtime tool installed by the agent or Keith in this task.
- No repository cloned.
- No application built or started.
- No PostgreSQL or Redis installed.
- No database or database user created.
- No migration executed.
- No pre-migration backup taken by agent.
- No environment file created, opened, or edited.
- No secret value printed, requested, generated, or pasted.
- No application health check or smoke run.
- No browser opened against staging URL.
- No beta invite sent.
- No subagents used.
- No git commit or push made.
- No source, test, package, migration, entity, environment, Docker, or deployment files changed.

---

## 17. Non-Goals Preserved

The following actions remain explicitly deferred to future tasks. None occurred in PRIVATE-BETA-STAGING-EXECUTION-01:

| # | Non-Goal | Future Task |
|---|----------|------------|
| 1 | DNS A record for staging.ainow.biz | STAGING-EXECUTION-02 (DNS/TLS) or later |
| 2 | Caddy installation and configuration | Future execution task |
| 3 | TLS/HTTPS certificate | Future execution task |
| 4 | Node.js, npm, Docker, PM2 installation | Future execution task |
| 5 | PostgreSQL 15 installation | Future execution task |
| 6 | Redis 7 installation | Future execution task |
| 7 | Repository clone to /opt/aisandbox | Future execution task |
| 8 | `.env` file creation and population | Future execution task |
| 9 | Application build and service startup | Future execution task |
| 10 | Database migration execution | Requires separate explicit Keith approval |
| 11 | Beta user invitation | Requires separate explicit Keith approval |
| 12 | Public launch | Not applicable — no app deployed |

---

## 18. Remaining Blockers Before Live Staging

The staging server exists and is at clean OS baseline. However, the following remain required before staging is useful for PRIVATE-BETA-DEPLOYMENT-READINESS Step 3:

| # | Remaining Action | Requires |
|---|-----------------|---------|
| 1 | DNS A record: `staging` host → `aisandbox-staging-ip` | Keith approval + static IP value |
| 2 | Caddy installation and configuration | After DNS propagation verified |
| 3 | TLS certificate (automatic via Caddy/Let's Encrypt) | After Caddy started with DNS resolved |
| 4 | Node.js 20 LTS installation | Future execution task |
| 5 | Docker Engine installation | Future execution task |
| 6 | PM2 installation | Future execution task |
| 7 | Repository clone to `/opt/aisandbox` | After runtime ready |
| 8 | `/opt/aisandbox/.env` created with all required variables | Keith only; chmod 600 |
| 9 | Pre-deployment readiness gates G1–G27 checked | Before any service starts |
| 10 | Services built and started via PM2 | After all gates pass |
| 11 | Pre-migration PostgreSQL backup | Mandatory before any migration |
| 12 | Lightsail snapshot before migration | Mandatory before any migration |
| 13 | Keith explicit migration approval (7 conditions) | Before migration run |
| 14 | `npm run migration:run:prod` executed and verified | After migration approval |
| 15 | Post-migration verification (20 checks) passed | After migration run |
| 16 | Health smoke (H1–H9) passed | After services started |
| 17 | Caddy HTTPS smoke passed at staging.ainow.biz | After TLS issued |
| 18 | Keith explicit approval to proceed with PRIVATE-BETA-DEPLOYMENT-READINESS Step 3 | After all above complete |

**PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED** until real app deployment and verification evidence exists.

---

## 19. Product Impact

PRIVATE-BETA-STAGING-EXECUTION-01 produces the first real cloud infrastructure artifact for the aiSandBox staging environment.

**What now exists:**
- A real AWS Lightsail VPS (`aisandbox-staging`) running in Singapore / ap-southeast-1.
- Ubuntu 24.04.4 LTS, fully updated, with Asia/Hong_Kong timezone.
- A static IP (`aisandbox-staging-ip`) attached and ready for future DNS A record.
- A firewall with only ports 22, 80, 443 open publicly.
- A clean OS baseline snapshot (`aisandbox-staging-baseline-2026-07-23`) for rollback.
- Automatic daily snapshots enabled.
- Monthly cost: ~US$40–44/month now running.

**What does not yet exist:**
- No DNS pointing to the server.
- No HTTPS/TLS certificate.
- No runtime (Node.js, Docker, PM2, Caddy).
- No PostgreSQL or Redis.
- No application code or `.env`.
- No database tables.
- No staging app serving any traffic.
- No beta users with access.

No application code was changed. No local development environment was affected. No production system was affected.

---

## 20. Handoff to Next Execution Task

**Recommended next task: PRIVATE-BETA-STAGING-EXECUTION-02**

Two primary path options for Keith to decide:

**Option A (Recommended — unblock DNS/TLS first):**
Register `PRIVATE-BETA-STAGING-EXECUTION-02 — DNS A Record + Caddy/TLS Setup`. This task would:
1. Create DNS A record: `staging` host → `aisandbox-staging-ip` at DNS provider for ainow.biz.
2. Wait for DNS propagation.
3. Install Caddy on the VPS.
4. Create `/etc/caddy/Caddyfile` with reverse proxy configuration.
5. Verify TLS certificate issued and staging.ainow.biz resolves over HTTPS.
6. Verify HTTP → HTTPS redirect works.

**Option B:**
Register `PRIVATE-BETA-STAGING-EXECUTION-02 — Runtime Installation` (Node.js, Docker, PM2). DNS/TLS can follow in EXECUTION-03 after runtime is ready.

Keith must explicitly approve registration of EXECUTION-02 before it begins.

---

## 21. Acceptance Criteria Disposition

| Criterion | Status |
|-----------|--------|
| Runbook created | ✓ PASS — `docs/PRIVATE-BETA-STAGING-EXECUTION-01-RUNBOOK.md` |
| Keith manual execution evidence reviewed | ✓ PASS — Step 3 verdict PASS |
| AWS Lightsail instance exists | ✓ PASS — aisandbox-staging Running |
| Instance is Running | ✓ PASS |
| Region is Singapore / ap-southeast-1 | ✓ PASS |
| Instance name is aisandbox-staging | ✓ PASS |
| Instance plan is 8 GB / 2 vCPU / 160 GB SSD | ✓ PASS |
| Ubuntu 24.04.4 LTS verified | ✓ PASS |
| Static IP attached | ✓ PASS — aisandbox-staging-ip attached |
| Static IP value not recorded in tracked docs | ✓ PASS — held privately by Keith |
| Firewall public ports 22, 80, 443 only | ✓ PASS |
| Internal ports 3002/4000/4001/4002/5432/6379 closed externally | ✓ PASS |
| Browser SSH succeeded | ✓ PASS |
| sudo apt update succeeded | ✓ PASS |
| sudo apt upgrade -y succeeded | ✓ PASS |
| Timezone is Asia/Hong_Kong | ✓ PASS |
| Reboot completed | ✓ PASS |
| Manual baseline snapshot exists and is Available | ✓ PASS — aisandbox-staging-baseline-2026-07-23 |
| Automatic snapshots enabled | ✓ PASS |
| No DNS/TLS/runtime/database/app/migration/env/secret work occurred | ✓ CONFIRMED |
| Checkpoint created | ✓ PASS — this document |
| TASKS.md updated | ✓ PASS — PRIVATE-BETA-STAGING-EXECUTION-01 COMPLETE and LOCKED |
| TASKS_BACKLOG_FULL.md updated | ✓ PASS — mirrored |
| Roadmap updated | ✓ PASS — AINOW-EXECUTION-ROADMAP.md updated |
| No source/test/package/migration/entity/environment/Docker/deployment files changed | ✓ CONFIRMED |
| No git commit or push occurred | ✓ CONFIRMED |
| No subagents used | ✓ CONFIRMED |

---

## 22. Locked-State Instruction

**PRIVATE-BETA-STAGING-EXECUTION-01 is COMPLETE and LOCKED as of 2026-07-23.**

Do not modify this checkpoint or the runbook document except by explicitly approved follow-up task.

Do not claim staging is live. Do not claim private beta is launched.

PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED until a real verified staging app exists at staging.ainow.biz.

Do not register PRIVATE-BETA-STAGING-EXECUTION-02 without Keith explicit approval.

---

## 23. Exact Next Action

**Await Keith explicit approval before proceeding.**

Recommended next action:

> Register `PRIVATE-BETA-STAGING-EXECUTION-02` — covering DNS A Record + Caddy/TLS setup or runtime installation (Node.js/Docker/PM2), per Keith's decision on sequencing.

Until Keith explicitly approves and EXECUTION-02 is registered:
- PRIVATE-BETA-STAGING-EXECUTION-01 is COMPLETE and LOCKED
- PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED
- The staging server exists at baseline, but serves no traffic
- No deployment has occurred
- No private beta has launched

---

**Checkpoint created:** 2026-07-23
**Final status:** PRIVATE-BETA-STAGING-EXECUTION-01 COMPLETE and LOCKED — 2026-07-23
**AWS instance created manually by Keith.**
**No AWS action by agent.**
**No static IP action by agent.**
**No firewall change by agent.**
**No SSH by agent.**
**No runtime/install/deploy action occurred.**
**No PostgreSQL/Redis action occurred.**
**No migration/backup/snapshot action by agent.**
**No env file created/opened/edited.**
**No secret values printed/requested/generated.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No git commit or git push occurred.**
**No subagents used.**
