# PRIVATE-BETA-STAGING-SETUP-02 — Server Baseline and SSH Access Plan

**Task ID:** PRIVATE-BETA-STAGING-SETUP-02
**Step:** 2 — Server Baseline and SSH Access Plan
**Status:** CREATED — 2026-07-21
**Date:** 2026-07-21
**Nature:** Planning only — no server creation, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-02 |
| Title | Server Baseline and SSH Access Plan |
| Parent | PRIVATE-BETA-STAGING-SETUP — Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | SERVER BASELINE + SSH ACCESS PLANNING — NO IMPLEMENTATION |
| Risk | MEDIUM — planning only during this step; no server creation |
| Step 1 | COMPLETE — Registration — 2026-07-21 |
| Step 2 | This document — Server Baseline and SSH Access Plan — 2026-07-21 |
| Step 3 | PENDING — Consolidation / handoff to SETUP-03 |
| Predecessors | PRIVATE-BETA-STAGING-SETUP-01 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP Steps 1–2 COMPLETE — Step 3 executing via 8 child tasks |
| | Keith manual confirmations: AWS Yes; Lightsail Yes; Singapore Yes; 8 GB Yes; cost Yes; static IP later Yes; staging.ainow.biz Yes; proceed Yes |
| Keith approval | "go" — 2026-07-21 |

---

## 2. Purpose

This document records the server baseline and SSH access plan for the AWS Lightsail staging server. It provides Keith with a concrete, step-by-step reference for:

- Creating the Lightsail instance (future execution only)
- Attaching a static IP (future execution only)
- Configuring firewall rules (future execution only)
- Establishing SSH access (future execution only)
- Performing initial server updates (future execution only)
- Establishing a basic security baseline (future execution only)

**No server is created in this step.** All execution requires Keith explicit approval in a future child task or execution step.

---

## 3. Confirmed Staging Decisions

These decisions were confirmed during PRIVATE-BETA-STAGING-SETUP-01 (COMPLETE and LOCKED — 2026-07-21) and carry forward unchanged.

| # | Decision | Confirmed Value |
|---|----------|-----------------|
| 1 | Provider | **AWS Lightsail** |
| 2 | Region | **Singapore / ap-southeast-1** |
| 3 | Instance | **8 GB RAM / 2 vCPU / 160 GB SSD** |
| 4 | Budget | **~US$40–44/month** |
| 5 | Domain | **staging.ainow.biz** |
| 6 | Architecture | **Single VPS staging** |
| 7 | Reverse proxy / TLS | **Caddy** (automatic Let's Encrypt) |
| 8 | Database | **Self-host PostgreSQL 15 on same VPS** |
| 9 | Redis | **Self-host Redis 7 on same VPS** |
| 10 | Process manager | **PM2** |
| 11 | AI Service / Container Manager | **Deploy for parity; risky execution disabled by kill switches** |
| 12 | Migration execution | **Separate explicit approval only** |
| 13 | Beta invite | **Separate explicit approval only** |

---

## 4. What SETUP-02 Covers

| # | Item |
|---|------|
| 1 | Recommended OS image |
| 2 | Instance name |
| 3 | Region and size confirmation |
| 4 | Static IP plan |
| 5 | Firewall / networking plan |
| 6 | SSH access plan |
| 7 | Admin user / root access safety |
| 8 | Initial server update plan |
| 9 | Basic security baseline |
| 10 | Required public ports |
| 11 | Ports that must remain closed externally |
| 12 | Snapshot / backup point |
| 13 | Keith manual AWS actions checklist |
| 14 | PASS / BLOCKED criteria |
| 15 | Handoff to SETUP-03 |

---

## 5. What SETUP-02 Does NOT Do

| # | Not Done |
|---|---------|
| 1 | Does NOT create the AWS Lightsail instance |
| 2 | Does NOT create a static IP |
| 3 | Does NOT change any firewall rules |
| 4 | Does NOT SSH to any server |
| 5 | Does NOT deploy any software |
| 6 | Does NOT install Node.js, Docker, PM2, Caddy, PostgreSQL, or Redis |
| 7 | Does NOT configure DNS or TLS |
| 8 | Does NOT run migrations |
| 9 | Does NOT start any runtime |
| 10 | Does NOT modify source, test, package, migration, entity, or environment files |
| 11 | Does NOT open secret-bearing files |
| 12 | Does NOT invite beta users |
| 13 | Does NOT claim beta launch |
| 14 | Does NOT execute builds or tests |
| 15 | Does NOT call APIs or open browsers |
| 16 | Does NOT make git commits or pushes |

---

## 6. AWS Lightsail Instance Creation Checklist

**This is a future checklist only. Do not execute these steps until Keith explicitly approves execution in a future task.**

| # | Action | Notes |
|---|--------|-------|
| 1 | Log into AWS Management Console | https://console.aws.amazon.com/ |
| 2 | Navigate to Lightsail | https://lightsail.aws.amazon.com/ |
| 3 | Select region: **Singapore / ap-southeast-1** | Use the region selector (top-right or instance creation screen) |
| 4 | Click "Create instance" | Begin instance creation workflow |
| 5 | Select platform: **Linux/Unix** | First selection on the creation screen |
| 6 | Select blueprint: **OS Only → Ubuntu** | Choose the latest Ubuntu LTS image |
| 7 | Select instance plan: **8 GB RAM / 2 vCPU / 160 GB SSD** (~$40/month) | Scroll to the appropriate plan/bundle |
| 8 | Set instance name: **`aisandbox-staging`** | Type the name in the instance name field |
| 9 | **Wait for Keith explicit approval before clicking Create** | Do NOT click the final "Create instance" button without Keith approval |
| 10 | After instance is running: create a static IP | Networking tab → Create static IP → attach to `aisandbox-staging` |
| 11 | Record public IP | Record the static IP in Keith's private notes — not in tracked docs if sensitive or changeable |

---

## 7. Recommended OS Image

| Field | Value |
|-------|-------|
| OS | **Ubuntu LTS** (latest available in Lightsail at time of creation) |
| Expected version | Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (whichever Lightsail offers as default) |
| Rationale | Widest community support; best package availability for Node.js 20, PostgreSQL 15, Redis 7, Docker CE, Caddy; long-term security updates |
| Alternative | Debian (viable but less common in tutorials/docs) |

Keith should select the "OS Only" option (not a pre-configured app blueprint) to maintain full control over installed software.

---

## 8. Instance Name

| Field | Value |
|-------|-------|
| Instance name | **`aisandbox-staging`** |
| Rationale | Clear, descriptive, matches project and environment |
| Naming convention | `<project>-<environment>` |

This name appears in the Lightsail console, CLI commands, and snapshot names. Keep it consistent across all references.

---

## 9. Region and Size Confirmation

| Field | Value |
|-------|-------|
| Region | **ap-southeast-1 (Singapore)** |
| Instance size | **8 GB RAM / 2 vCPU / 160 GB SSD** |
| Monthly cost | **~$40 USD/month** |
| Keith confirmation | **Yes** — confirmed in SETUP-01 (2026-07-21) |
| Availability | **Confirmed** — Keith verified in AWS console during SETUP-01 |

No changes from SETUP-01 decisions. Carried forward as-is.

---

## 10. Static IP Plan

| Field | Value |
|-------|-------|
| Static IP required | **Yes** — needed for DNS A record |
| When to create | **After Lightsail instance exists and is running** |
| Cost | **Free** when attached to a running instance; $3.50/month if detached |
| Naming | `aisandbox-staging-ip` (suggested) |
| Action now | **None** — plan only |

### Static IP Creation Steps (Future)

1. In Lightsail console: go to **Networking** tab.
2. Click **Create static IP**.
3. Select region: **ap-southeast-1 (Singapore)**.
4. Attach to instance: **aisandbox-staging**.
5. Name the static IP: `aisandbox-staging-ip`.
6. Record the assigned IP address in Keith's private notes.

### Static IP Rules

- Do NOT detach the static IP while the instance is running (causes downtime).
- If the instance is deleted, the static IP must be manually released to avoid charges.
- The static IP is required before DNS A record configuration (SETUP-03).

---

## 11. Firewall / Networking Plan

### Publicly Open Ports

| # | Protocol | Port | Purpose |
|---|----------|------|---------|
| 1 | TCP | 22 | SSH access |
| 2 | TCP | 80 | HTTP (Caddy — redirect to HTTPS) |
| 3 | TCP | 443 | HTTPS (Caddy — reverse proxy to frontend/API) |

### Publicly Closed Ports (Must NOT Be Internet-Exposed)

| # | Protocol | Port | Service | Reason |
|---|----------|------|---------|--------|
| 1 | TCP | 3002 | Frontend (Next.js) direct | Only accessible via Caddy reverse proxy |
| 2 | TCP | 4000 | API Gateway direct | Only accessible via Caddy reverse proxy |
| 3 | TCP | 4001 | AI Service Worker | Internal only — no public access |
| 4 | TCP | 4002 | Container Manager | Internal only — no public access |
| 5 | TCP | 5432 | PostgreSQL | Database must bind to localhost only |
| 6 | TCP | 6379 | Redis | Cache/queue must bind to localhost only |

### Firewall Rationale

- Caddy reverse proxy handles all public HTTP/HTTPS traffic and routes to internal services.
- Internal services (ports 3002, 4000, 4001, 4002) should bind to `127.0.0.1` or `0.0.0.0` with Lightsail firewall blocking external access.
- PostgreSQL and Redis must bind to `127.0.0.1` only in their configuration AND be blocked by Lightsail firewall.
- Defense in depth: both application-level binding AND firewall rules prevent accidental exposure.

### Lightsail Firewall Configuration Steps (Future)

1. In Lightsail console: select instance `aisandbox-staging`.
2. Go to **Networking** tab.
3. Under **IPv4 Firewall**, ensure ONLY these rules exist:
   - SSH (TCP 22) — from Any
   - HTTP (TCP 80) — from Any
   - HTTPS (TCP 443) — from Any
4. Remove any other default rules (some Lightsail images add extra rules).
5. Under **IPv6 Firewall**, apply the same 3 rules.
6. Verify no rules exist for ports 3002, 4000, 4001, 4002, 5432, or 6379.

---

## 12. SSH Access Plan

### Phase 1 — Initial Access (Recommended First Approach)

| # | Item | Value |
|---|------|-------|
| 1 | Method | **AWS Lightsail browser-based SSH** |
| 2 | How | In Lightsail console → select instance → click "Connect using SSH" button |
| 3 | User | Default `ubuntu` user (standard on Lightsail Ubuntu images) |
| 4 | Root access | Via `sudo` from the `ubuntu` user |
| 5 | When | After instance creation (future execution step) |

### Phase 2 — Local SSH (Optional, Later)

| # | Item | Value |
|---|------|-------|
| 1 | When | Only if Keith finds browser SSH insufficient for routine administration |
| 2 | Key source | Download default SSH key from Lightsail console (Account → SSH keys) OR generate a new key pair in Lightsail |
| 3 | Key storage | Store on Keith's local machine in a secure location with restricted permissions |
| 4 | Key permissions | Read-only for Keith's user only |
| 5 | Configuration | Add entry to `~/.ssh/config` (or Windows equivalent) |

### Placeholder Local SSH Command (Future — No Real IP or Key Path)

```powershell
# PowerShell — example only — do NOT run until instance exists and local SSH is configured
ssh -i "C:\Users\knlee\.ssh\aisandbox-staging-key.pem" ubuntu@<STATIC-IP-HERE>
```

Replace `<STATIC-IP-HERE>` with the actual Lightsail static IP when it exists. Replace the key path with the actual downloaded key location.

### SSH Safety Rules

| # | Rule |
|---|------|
| 1 | Use AWS Lightsail browser SSH as the primary access method first |
| 2 | Do NOT paste secrets, API keys, passwords, or tokens into Cursor/chat |
| 3 | Do NOT share private key material in any tracked document or chat |
| 4 | If local SSH is configured later, use full Windows paths for the key file |
| 5 | Do NOT configure local SSH in this planning step |
| 6 | Store SSH keys securely — not in the git repository |
| 7 | If a key may have been compromised, rotate immediately via Lightsail console |
| 8 | Use key-based authentication only — disable password SSH |

---

## 13. Admin User / Root Access Safety

| # | Rule |
|---|------|
| 1 | Default user is `ubuntu` (standard on Lightsail Ubuntu images) |
| 2 | Root access is via `sudo` — do NOT log in directly as root |
| 3 | Do NOT set a root password — keep root login disabled |
| 4 | Do NOT create additional admin users unless explicitly needed |
| 5 | All administrative commands use `sudo` prefix |
| 6 | Keith is the sole administrator for the staging server |
| 7 | Do NOT share the `ubuntu` user credentials or SSH key with anyone else during private beta |
| 8 | If a second administrator is needed later, create a separate named user with sudo privileges |

---

## 14. Initial Server Update Plan

**These commands are for future execution inside the Lightsail browser SSH terminal only. Do NOT run them in this planning step.**

### Server-Side Commands (Run Inside Lightsail Browser SSH — Future)

```bash
# Update package lists and upgrade all packages
sudo apt update
sudo apt upgrade -y

# Set timezone to Asia/Hong_Kong (Keith's timezone)
sudo timedatectl set-timezone Asia/Hong_Kong

# Verify timezone
timedatectl

# Reboot if kernel update was applied
sudo reboot
```

### Post-Reboot Verification (Future)

```bash
# Reconnect via Lightsail browser SSH after reboot
# Verify system is up-to-date
sudo apt update
apt list --upgradable

# Verify timezone
date

# Check disk space
df -h

# Check memory
free -h

# Check OS version
lsb_release -a
```

### Notes

- Server updates should be the first action after instance creation.
- If a kernel update is applied, reboot before proceeding with software installation.
- These commands are standard Ubuntu system administration — low risk.
- Future software installation (Node.js, Docker, PM2, Caddy, PostgreSQL, Redis) belongs to later child tasks (SETUP-04 and beyond).

---

## 15. Basic Security Baseline

| # | Security Measure | Status |
|---|-----------------|--------|
| 1 | Keep only required ports open (22, 80, 443) | Planned — firewall config in Section 11 |
| 2 | Use SSH key-based access only | Default on Lightsail Ubuntu — password SSH disabled by default |
| 3 | Disable password SSH login | Verify `PasswordAuthentication no` in `/etc/ssh/sshd_config` after creation |
| 4 | Keep system packages updated | Plan in Section 14 — run `apt upgrade` regularly |
| 5 | Create snapshot before major setup | Plan in Section 18 |
| 6 | Do NOT expose PostgreSQL (5432) publicly | Bind to localhost + firewall block |
| 7 | Do NOT expose Redis (6379) publicly | Bind to localhost + firewall block |
| 8 | Do NOT expose app internal ports (3002, 4000, 4001, 4002) publicly | Firewall blocks external access |
| 9 | Keep secrets only on server or private AWS dashboard | No secrets in git, chat, Cursor, or tracked docs |
| 10 | No secrets in git repository | `.env` files in `.gitignore`; secrets generated on server only |
| 11 | No secrets in Cursor/chat | Never paste API keys, passwords, or tokens into AI assistant |
| 12 | Use `chmod 600` for `.env` files on server | Restrict read access to owner only |
| 13 | Use strong generated secrets | `openssl rand -hex 32` for all application secrets |
| 14 | Use UFW (Uncomplicated Firewall) as defense-in-depth | Optional — Lightsail firewall is primary; UFW adds OS-level layer |

### Future Security Hardening (After Initial Setup)

| # | Measure | Priority | When |
|---|---------|----------|------|
| 1 | Install `fail2ban` for SSH brute-force protection | MEDIUM | After initial baseline |
| 2 | Configure automatic security updates (`unattended-upgrades`) | MEDIUM | After initial baseline |
| 3 | Set up log monitoring for auth failures | LOW | After services are running |
| 4 | Consider restricting SSH to Keith's IP only | LOW | Only if static IP is available for Keith's location |

---

## 16. Required Public Ports

| # | Port | Protocol | Service | Exposure |
|---|------|----------|---------|----------|
| 1 | 22 | TCP | SSH | Public — required for server administration |
| 2 | 80 | TCP | HTTP | Public — Caddy HTTP → HTTPS redirect |
| 3 | 443 | TCP | HTTPS | Public — Caddy reverse proxy (frontend + API) |

These are the ONLY ports that should be open to the internet in the Lightsail firewall.

---

## 17. Ports That Must Remain Closed Externally

| # | Port | Protocol | Service | Reason |
|---|------|----------|---------|--------|
| 1 | 3002 | TCP | Frontend (Next.js) | Accessed only via Caddy on localhost |
| 2 | 4000 | TCP | API Gateway (NestJS) | Accessed only via Caddy on localhost |
| 3 | 4001 | TCP | AI Service Worker (NestJS) | Internal only — no external access needed |
| 4 | 4002 | TCP | Container Manager (NestJS) | Internal only — no external access needed |
| 5 | 5432 | TCP | PostgreSQL 15 | Database — localhost only — never internet-exposed |
| 6 | 6379 | TCP | Redis 7 | Cache/queue — localhost only — never internet-exposed |

### Defense-in-Depth

- **Lightsail firewall** blocks external access to these ports.
- **Application configuration** binds PostgreSQL and Redis to `127.0.0.1` only.
- **Optional UFW** on the server provides an additional OS-level firewall layer.

---

## 18. Snapshot / Backup Point

### Recommended Snapshot Schedule (Future)

| # | Snapshot Trigger | When | Purpose |
|---|-----------------|------|---------|
| 1 | After initial clean baseline | After OS updates + timezone set (before any software install) | Clean rollback point |
| 2 | After runtime baseline installed | After Node.js + Docker + PM2 + Caddy installed | Runtime rollback point |
| 3 | Before first app deployment | Before cloning repo and building services | Pre-deployment rollback point |
| 4 | Before migration execution | Before any `migration:run` command | Database safety |

### Snapshot Commands (Future — Lightsail Console)

Snapshots are created via the Lightsail console or AWS CLI — not via SSH on the server.

**Lightsail Console:**
1. Select instance `aisandbox-staging`.
2. Go to **Snapshots** tab.
3. Click **Create snapshot**.
4. Name the snapshot (e.g., `aisandbox-staging-baseline-YYYYMMDD`).

### Database Backup (Future — Separate from Lightsail Snapshots)

```bash
# Keith runs on VPS before migration or risky change — future only
pg_dump -U aisandbox -d aisandbox > /home/ubuntu/backups/aisandbox_$(date +%Y%m%d_%H%M%S).sql
```

### Snapshot Rules

- No snapshot creation in SETUP-02 (planning only).
- Snapshots cost ~$0.05/GB/month — negligible for a 160 GB disk.
- Always create a snapshot before major configuration changes.
- Always create a `pg_dump` before migration execution.
- Snapshots enable full-VPS rollback if a setup step fails.

---

## 19. Keith Manual AWS Actions

These actions must be performed by Keith manually in the AWS Lightsail console. They are documented here for reference — **do not execute in this planning step.**

| # | Action | Console Location | Prerequisite |
|---|--------|-----------------|--------------|
| 1 | Log into AWS Management Console | https://console.aws.amazon.com/ | AWS account access |
| 2 | Navigate to Lightsail | https://lightsail.aws.amazon.com/ | Logged in |
| 3 | Select Singapore / ap-southeast-1 | Region selector | Lightsail home |
| 4 | Create Linux/Unix instance | Create instance → OS Only → Ubuntu LTS | Region selected |
| 5 | Select 8 GB / 2 vCPU / 160 GB SSD bundle | Instance plan selection | Instance creation screen |
| 6 | Name instance `aisandbox-staging` | Instance name field | Instance creation screen |
| 7 | Click "Create instance" | Final create button | **Keith explicit approval required** |
| 8 | Wait for instance to reach "Running" state | Instance list | After creation |
| 9 | Create static IP | Networking → Create static IP | Instance running |
| 10 | Attach static IP to `aisandbox-staging` | Static IP → Attach | Static IP created |
| 11 | Record static IP address | Private notes (not tracked docs) | Static IP attached |
| 12 | Configure firewall: allow TCP 22, 80, 443 only | Networking → IPv4/IPv6 Firewall | Instance running |
| 13 | Remove any extra default firewall rules | Networking → IPv4/IPv6 Firewall | After reviewing defaults |
| 14 | Connect via browser SSH | Instance → Connect using SSH | Instance running |
| 15 | Run initial OS updates (`sudo apt update && sudo apt upgrade -y`) | Inside browser SSH | Connected |
| 16 | Set timezone (`sudo timedatectl set-timezone Asia/Hong_Kong`) | Inside browser SSH | Connected |
| 17 | Reboot if kernel updated (`sudo reboot`) | Inside browser SSH | After upgrade |
| 18 | Create initial snapshot | Snapshots tab → Create snapshot | After baseline updates |

---

## 20. What Must NOT Happen Yet

| # | Prohibited Action | Belongs To |
|---|-------------------|-----------|
| 1 | Create Lightsail instance | Future execution step (requires Keith approval) |
| 2 | Create or attach static IP | After instance exists |
| 3 | Configure firewall rules | After instance exists |
| 4 | SSH to any server | After instance exists |
| 5 | Install Node.js, Docker, PM2, or Caddy | SETUP-04 or later |
| 6 | Install PostgreSQL or Redis | SETUP-06 |
| 7 | Configure DNS A record | SETUP-03 |
| 8 | Configure TLS/HTTPS | SETUP-03 |
| 9 | Clone repository on server | SETUP-04 or later |
| 10 | Deploy any service | SETUP-07 |
| 11 | Configure environment variables | SETUP-05 |
| 12 | Run migrations | SETUP-08 with separate explicit approval |
| 13 | Invite beta users | Separate explicit approval |
| 14 | Claim beta launch | Not applicable — no launch has occurred |
| 15 | Open/edit `.env` files | Never in planning steps |
| 16 | Modify source/test/package files | Not in this planning step |

---

## 21. PASS / BLOCKED Criteria

### PASS — Step 2 passes if ALL of the following are recorded:

- [x] AWS Lightsail selected as provider.
- [x] Singapore / ap-southeast-1 selected as region.
- [x] 8 GB RAM / 2 vCPU / 160 GB SSD selected as instance size.
- [x] Ubuntu LTS selected as OS image.
- [x] Instance name `aisandbox-staging` selected.
- [x] Static IP plan documented (create after instance exists).
- [x] Firewall plan documented (TCP 22, 80, 443 open; all others closed).
- [x] SSH access plan documented (browser SSH first; local SSH optional later).
- [x] Basic security baseline documented.
- [x] Snapshot / backup point documented.
- [x] Keith manual AWS actions checklist documented.
- [x] No server created in this step.

### BLOCKED — Step 2 is BLOCKED if ANY of the following are true:

- [ ] Region is unresolved or unavailable.
- [ ] Instance size is unresolved or unavailable.
- [ ] OS image is unresolved.
- [ ] Firewall plan is unsafe (exposes database/Redis/internal ports publicly).
- [ ] SSH access plan is unclear or requires secret exposure.
- [ ] Server creation is required in this step.
- [ ] Secret handling is unsafe (secrets in tracked docs or chat).
- [ ] Cost is unresolved or not approved.

**Step 2 verdict: PASS — all criteria met. No blockers identified.**

---

## 22. Handoff to SETUP-03

| Field | Value |
|-------|-------|
| Next child task | **PRIVATE-BETA-STAGING-SETUP-03** |
| Title | **Domain / DNS / TLS Plan for staging.ainow.biz** |
| Scope | Plan DNS A record creation, Caddy configuration, TLS certificate acquisition |
| Prerequisites | SETUP-02 PASS (this document) |
| Registration | Keith must explicitly approve SETUP-03 registration |

### SETUP-03 Expected Scope

1. Plan DNS A record: `staging.ainow.biz` → Lightsail static IP.
2. Plan Caddy installation and configuration.
3. Plan TLS certificate acquisition (automatic via Let's Encrypt).
4. Plan HTTP → HTTPS redirect.
5. Plan reverse proxy routing (frontend on `/`, API on `/api/*`).
6. Identify Keith manual actions for DNS registrar.
7. No DNS changes in SETUP-03 planning step.

**SETUP-03 is NOT registered in this step.** Registration belongs to Step 3 (Consolidation) or a future explicit registration step.

---

## 23. Safety Boundaries

| # | Safety Boundary |
|---|----------------|
| 1 | No implementation during this step |
| 2 | No source code changes |
| 3 | No test file changes |
| 4 | No package file changes |
| 5 | No migration execution |
| 6 | No environment file editing or opening |
| 7 | No Docker/runtime startup |
| 8 | No user invitations |
| 9 | No public beta launch claims |
| 10 | No secrets opened, printed, or exposed |
| 11 | No `.env`, `.env.local`, `.env.staging`, `.env.production` opened |
| 12 | No credential, key, certificate, or token files opened |
| 13 | No destructive database commands |
| 14 | No `docker compose down -v` |
| 15 | No deployment setup or configuration changes |
| 16 | No git commit or git push |
| 17 | No subagents |
| 18 | No governance file changes (TASKS.md, TASKS_BACKLOG_FULL.md, roadmap) |
| 19 | No AWS Lightsail server creation |
| 20 | No static IP creation |
| 21 | No firewall changes |
| 22 | No SSH connections |
| 23 | No DNS or TLS configuration |
| 24 | No API calls |
| 25 | No browser automation |

---

## 24. Exact Next Action

**Step 2 is COMPLETE. Proceed to Step 3 — Consolidation / Handoff to SETUP-03.**

Step 3 will:

1. Update TASKS.md — mark SETUP-02 Step 2 COMPLETE.
2. Update TASKS_BACKLOG_FULL.md — mirror status.
3. Update AINOW-EXECUTION-ROADMAP.md — mirror status.
4. Create checkpoint document: `docs/PRIVATE-BETA-STAGING-SETUP-02-CHECKPOINT.md`.
5. Hand off to SETUP-03 registration (Keith explicit approval required).

**Keith must explicitly say "go" or equivalent before Step 3 (Consolidation) begins.**

No server creation. No implementation. No deployment. No migration execution. No user invitations. No secrets. No subagents.

---

**Document created:** 2026-07-21
**Step 2 status:** Server Baseline and SSH Access Plan CREATED.
**No server created.**
**No static IP created.**
**No firewall changed.**
**No SSH occurred.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.**
**No git commit or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
