# PRIVATE-BETA-STAGING-SETUP-02 — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP-02
**Title:** Server Baseline and SSH Access Plan
**Final Status:** COMPLETE and LOCKED — 2026-07-21
**Checkpoint created:** 2026-07-21
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
| Nature | SERVER BASELINE + SSH ACCESS PLANNING — GOVERNANCE / PLANNING ONLY |
| Risk | MEDIUM — planning only; no server creation occurred |
| Predecessor | PRIVATE-BETA-STAGING-SETUP-01 — COMPLETE and LOCKED — 2026-07-21 |
| Keith approval | "go" — 2026-07-21 |
| Registered | 2026-07-21 |
| Completed | 2026-07-21 |

---

## 2. Final Status

**COMPLETE and LOCKED — 2026-07-21**

All 3 steps complete:

| Step | Status | Date |
|------|--------|------|
| Step 1 — Registration | COMPLETE | 2026-07-21 |
| Step 2 — Server Baseline and SSH Access Plan | COMPLETE | 2026-07-21 |
| Step 3 — Consolidation / Handoff to SETUP-03 | COMPLETE | 2026-07-21 |

Step 2 verdict: **PASS** — all acceptance criteria met. No blockers identified.

---

## 3. Parent Task Status

| Field | Value |
|-------|-------|
| Parent task | PRIVATE-BETA-STAGING-SETUP |
| Parent status | **ACTIVE — Steps 1–2 COMPLETE — Step 3 executing via 8 child tasks** |
| Parent Step 3 progress | SETUP-01 COMPLETE and LOCKED — SETUP-02 COMPLETE and LOCKED — SETUP-03 next |
| Parent remaining | SETUP-03 through SETUP-08 remain as child tasks |

Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE. Step 3 continues through remaining child tasks (SETUP-03 through SETUP-08).

---

## 4. Why This Child Task Existed

SETUP-02 is the second child task of PRIVATE-BETA-STAGING-SETUP Step 3 (Execution). Its purpose was to create a complete server baseline and SSH access plan before any server is created. SETUP-01 confirmed Keith's AWS Lightsail account, region, instance size, cost, and domain decisions. SETUP-02 translates those decisions into a concrete, step-by-step reference for future server creation, static IP attachment, firewall configuration, SSH access, initial OS updates, and basic security hardening. No server is created during SETUP-02. Server creation requires separate explicit Keith approval in a future execution step.

---

## 5. Server Baseline Plan Path

`docs/PRIVATE-BETA-STAGING-SETUP-02-SERVER-BASELINE-PLAN.md`

Created: 2026-07-21. Planning only. No server creation. No implementation.

---

## 6. Confirmed Staging Decisions

Carried forward from SETUP-01 (COMPLETE and LOCKED — 2026-07-21) unchanged:

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

## 7. OS / Instance / Region / Size Decision

| Field | Value |
|-------|-------|
| OS | **Ubuntu LTS** (latest available in Lightsail at time of creation — expected Ubuntu 22.04 LTS or 24.04 LTS) |
| Instance name | **`aisandbox-staging`** |
| Region | **ap-southeast-1 (Singapore)** |
| Instance size | **8 GB RAM / 2 vCPU / 160 GB SSD** |
| Monthly cost | **~$40 USD/month** |
| OS rationale | Widest community support; best package availability for Node.js 20, PostgreSQL 15, Redis 7, Docker CE, Caddy; long-term security updates |
| Selection method | "OS Only" blueprint in Lightsail — not a pre-configured app blueprint |
| Status | **Planned — not created** |

---

## 8. Static IP Decision

| Field | Value |
|-------|-------|
| Static IP required | **Yes** — needed for DNS A record (SETUP-03) |
| When to create | **After Lightsail instance exists and is running** |
| Cost | **Free** when attached to a running instance; $3.50/month if detached |
| Suggested name | `aisandbox-staging-ip` |
| Action now | **None** — plan only |
| Status | **Planned — not created** |

Rules: Do NOT detach the static IP while the instance is running. If instance is deleted, static IP must be manually released. Static IP is required before DNS A record configuration (SETUP-03).

---

## 9. Firewall / Networking Decision

### Publicly Open Ports

| # | Protocol | Port | Purpose |
|---|----------|------|---------|
| 1 | TCP | 22 | SSH access |
| 2 | TCP | 80 | HTTP (Caddy — redirect to HTTPS) |
| 3 | TCP | 443 | HTTPS (Caddy — reverse proxy to frontend/API) |

These are the ONLY ports that should be open to the internet in the Lightsail firewall.

### Publicly Closed Ports

| # | Protocol | Port | Service | Reason |
|---|----------|------|---------|--------|
| 1 | TCP | 3002 | Frontend (Next.js) | Only accessible via Caddy on localhost |
| 2 | TCP | 4000 | API Gateway (NestJS) | Only accessible via Caddy on localhost |
| 3 | TCP | 4001 | AI Service Worker | Internal only — no external access |
| 4 | TCP | 4002 | Container Manager | Internal only — no external access |
| 5 | TCP | 5432 | PostgreSQL 15 | Database — localhost only — never internet-exposed |
| 6 | TCP | 6379 | Redis 7 | Cache/queue — localhost only — never internet-exposed |

Defense in depth: Lightsail firewall + application-level binding to `127.0.0.1` for PostgreSQL and Redis. Optional UFW on server provides additional OS-level layer.

Status: **Planned — not changed.** No Lightsail firewall rules were created or modified in SETUP-02.

---

## 10. SSH Access Decision

### Phase 1 — Initial Access (Recommended First Approach)

| # | Item | Value |
|---|------|-------|
| 1 | Method | **AWS Lightsail browser-based SSH** |
| 2 | How | In Lightsail console → select instance → click "Connect using SSH" |
| 3 | User | Default `ubuntu` user (standard on Lightsail Ubuntu images) |
| 4 | Root access | Via `sudo` from the `ubuntu` user |
| 5 | When | After instance creation (future execution step) |

### Phase 2 — Local SSH (Optional, Later)

Only if Keith finds browser SSH insufficient for routine administration. Key downloaded from Lightsail console; stored securely on Keith's local machine with restricted permissions. Key-based authentication only — password SSH disabled.

Status: **Planned — no SSH connection occurred in SETUP-02.**

---

## 11. Admin / Root Safety Decision

| # | Rule |
|---|------|
| 1 | Default user is `ubuntu` — standard on Lightsail Ubuntu images |
| 2 | Root access is via `sudo` — do NOT log in directly as root |
| 3 | Do NOT set a root password — keep root login disabled |
| 4 | Do NOT create additional admin users unless explicitly needed |
| 5 | All administrative commands use `sudo` prefix |
| 6 | Keith is the sole administrator for the staging server |
| 7 | Do NOT share the `ubuntu` user credentials or SSH key during private beta |
| 8 | If a second administrator is needed later, create a separate named user with sudo privileges |

Status: **Rules documented — no server access occurred in SETUP-02.**

---

## 12. Initial Server Update Plan

To be executed by Keith inside AWS Lightsail browser SSH after instance creation (future execution step only):

```bash
sudo apt update
sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Hong_Kong
timedatectl
sudo reboot
```

Post-reboot verification: reconnect via browser SSH, run `sudo apt update`, `date`, `df -h`, `free -h`, `lsb_release -a`.

Notes: Server updates should be the first action after instance creation. Reboot if kernel update is applied before proceeding with software installation. Future software installation (Node.js, Docker, PM2, Caddy, PostgreSQL, Redis) belongs to later child tasks (SETUP-04 and beyond).

Status: **Documented — not executed.** No SSH occurred.

---

## 13. Basic Security Baseline

| # | Security Measure | Status |
|---|-----------------|--------|
| 1 | Keep only required ports open (22, 80, 443) | Planned — firewall config documented |
| 2 | Use SSH key-based access only | Default on Lightsail Ubuntu — password SSH disabled by default |
| 3 | Disable password SSH login | Verify `PasswordAuthentication no` in `/etc/ssh/sshd_config` after creation |
| 4 | Keep system packages updated | Plan documented — run `apt upgrade` regularly |
| 5 | Create snapshot before major setup | Plan documented |
| 6 | Do NOT expose PostgreSQL (5432) publicly | Bind to localhost + firewall block |
| 7 | Do NOT expose Redis (6379) publicly | Bind to localhost + firewall block |
| 8 | Do NOT expose app internal ports (3002, 4000, 4001, 4002) publicly | Firewall blocks external access |
| 9 | Keep secrets only on server or private AWS dashboard | No secrets in git, chat, Cursor, or tracked docs |
| 10 | No secrets in git repository | `.env` files in `.gitignore`; secrets generated on server only |
| 11 | No secrets in Cursor/chat | Never paste API keys, passwords, or tokens into AI assistant |
| 12 | Use `chmod 600` for `.env` files on server | Restrict read access to owner only |
| 13 | Use strong generated secrets | `openssl rand -hex 32` for all application secrets |
| 14 | Use UFW as defense-in-depth | Optional — Lightsail firewall is primary; UFW adds OS-level layer |

Future hardening after initial setup: `fail2ban`, automatic security updates, log monitoring for auth failures.

Status: **Documented — not applied.** No server exists yet.

---

## 14. Required Public Ports

| # | Port | Protocol | Service | Exposure |
|---|------|----------|---------|----------|
| 1 | 22 | TCP | SSH | Public — required for server administration |
| 2 | 80 | TCP | HTTP | Public — Caddy HTTP → HTTPS redirect |
| 3 | 443 | TCP | HTTPS | Public — Caddy reverse proxy (frontend + API) |

These are the ONLY ports that should be open to the internet in the Lightsail firewall.

---

## 15. Closed External Ports

| # | Port | Service | Why Closed |
|---|------|---------|-----------|
| 1 | 3002 | Frontend (Next.js) | Caddy only |
| 2 | 4000 | API Gateway | Caddy only |
| 3 | 4001 | AI Service Worker | Internal only |
| 4 | 4002 | Container Manager | Internal only |
| 5 | 5432 | PostgreSQL 15 | Database — localhost binding + firewall |
| 6 | 6379 | Redis 7 | Cache — localhost binding + firewall |

---

## 16. Snapshot / Backup Points

| # | Snapshot Trigger | Purpose |
|---|-----------------|---------|
| 1 | After initial clean baseline (OS updates + timezone) | Clean rollback point — before any software install |
| 2 | After runtime baseline installed (Node.js + Docker + PM2 + Caddy) | Runtime rollback point |
| 3 | Before first app deployment | Pre-deployment rollback point |
| 4 | Before migration execution | Database safety |

Snapshots created via Lightsail console (not SSH). Database backups via `pg_dump` before migrations or risky changes. No snapshot creation in SETUP-02 (planning only).

Status: **Documented — not created.** No server exists yet.

---

## 17. Keith Manual AWS Actions

All actions are documented for future reference. None were executed in SETUP-02.

| # | Action | Prerequisite |
|---|--------|--------------|
| 1 | Log into AWS Management Console | AWS account access |
| 2 | Navigate to Lightsail | Logged in |
| 3 | Select Singapore / ap-southeast-1 | Lightsail home |
| 4 | Create Linux/Unix instance — OS Only → Ubuntu LTS | Region selected |
| 5 | Select 8 GB / 2 vCPU / 160 GB SSD bundle | Instance creation screen |
| 6 | Name instance `aisandbox-staging` | Instance creation screen |
| 7 | Click "Create instance" — **Keith explicit approval required** | Keith approval |
| 8 | Wait for instance to reach "Running" state | After creation |
| 9 | Create static IP | Instance running |
| 10 | Attach static IP to `aisandbox-staging` | Static IP created |
| 11 | Record static IP address in private notes (not tracked docs) | Static IP attached |
| 12 | Configure firewall: allow TCP 22, 80, 443 only | Instance running |
| 13 | Remove any extra default firewall rules | After reviewing defaults |
| 14 | Connect via browser SSH | Instance running |
| 15 | Run initial OS updates (`sudo apt update && sudo apt upgrade -y`) | Connected |
| 16 | Set timezone (`sudo timedatectl set-timezone Asia/Hong_Kong`) | Connected |
| 17 | Reboot if kernel updated (`sudo reboot`) | After upgrade |
| 18 | Create initial snapshot | After baseline updates |

Status: **Documented — not executed.** No AWS server/static IP/firewall/SSH action occurred.

---

## 18. What Was Not Done

| # | Action Not Done | Why |
|---|----------------|-----|
| 1 | AWS Lightsail instance creation | Planning only — requires Keith explicit approval |
| 2 | Static IP creation | Planning only — after instance only |
| 3 | Firewall rule changes | Planning only — after instance only |
| 4 | SSH to any server | Planning only — no server exists |
| 5 | Node.js / Docker / PM2 / Caddy installation | SETUP-04 or later |
| 6 | PostgreSQL / Redis installation | SETUP-06 |
| 7 | DNS A record configuration | SETUP-03 |
| 8 | TLS / HTTPS configuration | SETUP-03 |
| 9 | App deployment | SETUP-07 |
| 10 | Environment variable configuration | SETUP-05 |
| 11 | Migration execution | SETUP-08 with separate explicit approval |
| 12 | Beta user invitation | Separate explicit approval |
| 13 | Beta launch claim | Not applicable |
| 14 | Source / test / package file changes | Not in scope |
| 15 | `.env` or secret file opened | Not permitted |
| 16 | Git commit or git push | Not in scope |
| 17 | Subagents | Not permitted |

---

## 19. Safety Boundaries Preserved

All safety boundaries were preserved throughout SETUP-02:

- No AWS server created.
- No static IP created.
- No firewall rules changed.
- No SSH connection occurred.
- No implementation occurred.
- No source, test, package, migration, entity, environment, Docker, or deployment files changed.
- No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.
- No secret-bearing environment file opened.
- No `.env`, `.env.local`, `.env.staging`, `.env.production` opened.
- No credentials, keys, certificates, or token files opened.
- No git commit or git push.
- No subagents.
- SETUP-01 remains COMPLETE and LOCKED.
- PRIVATE-BETA-STAGING-SETUP parent remains ACTIVE.

---

## 20. Product Impact

SETUP-02 produces a complete, auditable server baseline and SSH access plan. This plan:

- Gives Keith a concrete, step-by-step reference for creating the Lightsail instance when ready.
- Documents all firewall, SSH, OS, and security decisions before any server action occurs.
- Reduces setup risk by pre-validating decisions against the SETUP-01 confirmed choices.
- Creates a clear handoff to SETUP-03 (Domain / DNS / TLS Plan for staging.ainow.biz).
- Maintains governance traceability: all staging decisions are recorded in tracked docs before any AWS action.

No application code was changed. No runtime was affected. No production system was affected.

---

## 21. Dependency / Handoff to SETUP-03

| Field | Value |
|-------|-------|
| Next child task | **PRIVATE-BETA-STAGING-SETUP-03** |
| Title | **Domain / DNS / TLS Plan for staging.ainow.biz** |
| Scope | Plan DNS A record creation, Caddy installation and configuration, TLS certificate acquisition, HTTP → HTTPS redirect, reverse proxy routing |
| Prerequisites | SETUP-02 PASS (this checkpoint confirms) |
| Registration | Keith must explicitly approve SETUP-03 registration |

SETUP-03 expected scope:
1. Plan DNS A record: `staging.ainow.biz` → Lightsail static IP.
2. Plan Caddy installation and configuration.
3. Plan TLS certificate acquisition (automatic via Let's Encrypt).
4. Plan HTTP → HTTPS redirect.
5. Plan reverse proxy routing (frontend on `/`, API on `/api/*`).
6. Identify Keith manual actions for DNS registrar.
7. No DNS changes in SETUP-03 planning step.

**SETUP-03 is NOT registered in this step.**

---

## 22. Acceptance Criteria Disposition

**Step 1 — Registration**

- [x] PRIVATE-BETA-STAGING-SETUP-02 added to TASKS_BACKLOG_FULL.md.
- [x] PRIVATE-BETA-STAGING-SETUP-02 activated in TASKS.md.
- [x] PRIVATE-BETA-STAGING-SETUP-01 remains COMPLETE and LOCKED.
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE.
- [x] Scope limited to server baseline and SSH access planning.
- [x] 3-step child workflow recorded.
- [x] AWS Lightsail staging defaults carried forward.
- [x] Recommended server baseline defaults recorded.
- [x] No server creation claimed.
- [x] No implementation during registration.
- [x] No source/test/package/migration/entity/environment/Docker/deployment files changed.
- [x] No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred.
- [x] No secret-bearing environment file opened.
- [x] No subagents used.

**Step 2 — Server Baseline and SSH Access Plan**

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
- [x] Step 2 verdict: PASS — all criteria met. No blockers identified.

**Step 3 — Consolidation / Handoff to SETUP-03**

- [x] TASKS.md updated — SETUP-02 COMPLETE and LOCKED.
- [x] TASKS_BACKLOG_FULL.md updated — mirrored.
- [x] AINOW-EXECUTION-ROADMAP.md updated.
- [x] Checkpoint document created: `docs/PRIVATE-BETA-STAGING-SETUP-02-CHECKPOINT.md`.
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE.
- [x] SETUP-03 not registered in this step.
- [x] No AWS server/static IP/firewall/SSH action occurred.
- [x] No implementation. No source/test/package/migration/entity/environment/Docker/deployment files changed.
- [x] No secrets opened. No subagents.

---

## 23. Locked-State Instruction

**PRIVATE-BETA-STAGING-SETUP-02 is COMPLETE and LOCKED as of 2026-07-21.**

This checkpoint and the server baseline plan (`docs/PRIVATE-BETA-STAGING-SETUP-02-SERVER-BASELINE-PLAN.md`) must not be modified. The status, evidence, and safety boundary records in this document must not be edited except for explicitly approved documentation correction.

SETUP-01 remains COMPLETE and LOCKED — must not be modified.

Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE — do not alter its ACTIVE status in this step.

---

## 24. Exact Next Action

**Register PRIVATE-BETA-STAGING-SETUP-03 — Domain / DNS / TLS Plan for staging.ainow.biz.**

Keith must explicitly say "go" or equivalent before SETUP-03 is registered. SETUP-03 registration belongs to a new step in a new window.

SETUP-03 will plan: DNS A record (`staging.ainow.biz` → Lightsail static IP); Caddy installation and configuration; TLS certificate acquisition; HTTP → HTTPS redirect; reverse proxy routing; Keith manual actions for DNS registrar. No DNS changes or server creation occur in SETUP-03 planning step.

No server creation, no static IP, no firewall changes, no SSH, no deployment, no implementation, no migration execution, no user invitations, no secrets, no subagents.

---

**Checkpoint created:** 2026-07-21
**PRIVATE-BETA-STAGING-SETUP-02 status:** COMPLETE and LOCKED — 2026-07-21
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
