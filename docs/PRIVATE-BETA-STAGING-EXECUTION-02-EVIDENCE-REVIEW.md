# PRIVATE-BETA-STAGING-EXECUTION-02 — Step 3 Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-02
**Title:** Runtime Installation Baseline — Step 3: Keith Manual Runtime Installation Evidence Review
**Date:** 2026-07-24
**Nature:** Evidence review only — no server action — no source changes — no AWS action — no git commit or push — no subagents
**Reviewer:** Agent (Step 3)
**Evidence provider:** Keith (manual Lightsail browser SSH execution)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-02 |
| Title | Runtime Installation Baseline |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Step | 3 — Keith Manual Runtime Installation Evidence Review |
| Step 1 | Registration — COMPLETE — 2026-07-23 |
| Step 2 | Runtime Installation Runbook — COMPLETE — 2026-07-24 |
| Step 3 | This evidence review — 2026-07-24 |
| Step 4 | Consolidation / Handoff to STAGING-EXECUTION-03 — PENDING |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Runbook | docs/PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md |
| Pivot checkpoint | docs/LOCAL-TO-STAGING-PARITY-PIVOT-CHECKPOINT.md |

---

## 2. Purpose

This report reviews Keith's safe evidence from manual execution of the Step 2 runbook on `aisandbox-staging`. It determines whether PRIVATE-BETA-STAGING-EXECUTION-02 Step 3 is PASS or BLOCKED, and whether the task is ready to proceed to Step 4 (Consolidation / Handoff to STAGING-EXECUTION-03).

No server action is performed in this step. No source code is changed. No AWS action occurs. No governance files are updated (governance updates belong to Step 4).

---

## 3. Evidence Source

| Field | Value |
|-------|-------|
| Evidence provided by | Keith — manual Lightsail browser SSH execution |
| Evidence date | 2026-07-24 |
| Evidence method | Keith ran the Step 2 runbook manually and pasted safe outputs |
| Runbook followed | docs/PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md |
| Evidence format | Safe evidence template (Section 22 of runbook) |
| Secrets in evidence | None — evidence contains no IP values, keys, tokens, env contents, passwords, or credentials |

---

## 4. Evidence Summary Table

| # | Evidence Item | Keith's Value | Runbook Expectation | Result |
|---|---------------|---------------|---------------------|--------|
| 1 | Ubuntu version | Ubuntu 24.04.4 LTS (noble) | 24.04.x LTS | PASS |
| 2 | Node.js version | v20.20.2 | v20.x.x | PASS |
| 3 | npm version | 10.8.2 | 10.x.x | PASS |
| 4 | Docker version | Docker version 29.6.2, build dfc4efb | Any recent stable | PASS |
| 5 | Docker Compose version | v5.3.1 | v2.x.x (example) | PASS — see Section 6 |
| 6 | Docker hello-world | Hello from Docker! | Hello from Docker! | PASS |
| 7 | docker group active | ubuntu adm cdrom sudo dip lxd docker / docker group present: Yes | docker in groups | PASS |
| 8 | PM2 version | 7.0.3 | 5.x.x or any recent stable | PASS |
| 9 | PM2 process list | Empty process list | Empty | PASS |
| 10 | Caddy version | v2.11.4 | v2.x.x | PASS |
| 11 | Caddy service status | loaded / enabled / active (running) / Main PID present | active (running) or active (exited) | PASS |
| 12 | No repo cloned | Yes | /opt/aisandbox does not exist | PASS |
| 13 | No .env file | Yes | No .env file on server | PASS |
| 14 | No app services started | Yes | No app services started | PASS |
| 15 | No PostgreSQL installed | Yes | postgresql not installed | PASS |
| 16 | No Redis installed | Yes | redis not installed | PASS |
| 17 | No staging.ainow.biz in Caddyfile | Yes | No staging.ainow.biz entry | PASS |
| 18 | No TLS certificate issued | Yes | No certificate issued | PASS |
| 19 | Snapshot name | aisandbox-staging-runtime-2026-07-24 | aisandbox-staging-runtime-2026-07-24 | PASS |
| 20 | Snapshot status | Available | Available | PASS |
| 21 | No DNS A record | Yes | No DNS A record configured | PASS |
| 22 | Warnings or unexpected outputs | None | None | PASS |

**All 22 evidence items: PASS.**

---

## 5. Runtime Tool Verification

### 5.1 Ubuntu OS

| Field | Value |
|-------|-------|
| Distributor ID | Ubuntu |
| Description | Ubuntu 24.04.4 LTS |
| Release | 24.04 |
| Codename | noble |
| Runbook requirement | 24.04.x LTS |
| Result | **PASS** |

Matches the exact OS baseline established by PRIVATE-BETA-STAGING-EXECUTION-01 (Ubuntu 24.04.4 LTS).

### 5.2 Node.js

| Field | Value |
|-------|-------|
| Installed version | v20.20.2 |
| Runbook requirement | v20.x.x |
| Result | **PASS** |

Node.js 20.20.2 is within the Node.js 20 LTS line. This is the required version for the aiSandBox staging environment.

### 5.3 npm

| Field | Value |
|-------|-------|
| Installed version | 10.8.2 |
| Runbook requirement | 10.x.x (bundled with Node.js 20) |
| Result | **PASS** |

npm 10.8.2 is the npm version bundled with Node.js 20.20.2. No corepack or snap was used.

### 5.4 Docker Engine

| Field | Value |
|-------|-------|
| Installed version | Docker version 29.6.2, build dfc4efb |
| Runbook requirement | Any recent stable Docker version |
| hello-world result | Hello from Docker! |
| Result | **PASS** |

Docker Engine 29.6.2 is a recent stable release. The hello-world test succeeded, confirming Docker Engine is installed and functioning.

### 5.5 PM2

| Field | Value |
|-------|-------|
| Installed version | 7.0.3 |
| Runbook requirement | 5.x.x or any recent stable |
| Process list | Empty — no app processes |
| Result | **PASS** |

PM2 7.0.3 is a recent stable version (newer than the 5.x.x reference in the runbook). No app processes are running, which is correct — no application has been deployed.

### 5.6 Caddy

| Field | Value |
|-------|-------|
| Installed version | v2.11.4 |
| Runbook requirement | v2.x.x |
| Service status | loaded and enabled / active (running) / Main PID present |
| Result | **PASS** |

Caddy v2.11.4 is within the Caddy v2 stable line. The systemd service is loaded, enabled, and running, which matches the expected post-install state (Caddy installs as a systemd service that starts automatically).

---

## 6. Docker Compose Version Note

The Step 2 runbook (Section 12) listed the expected Docker Compose version as `v2.x.x` as an example expectation.

Keith's evidence shows:

```
Docker Compose version v5.3.1
```

**Assessment:**

Docker Compose v5.3.1 is a newer release than the v2.x.x example in the runbook. The runbook was written with v2.x.x as the contemporary stable expectation. Docker Compose v5.x is a more recent stable release from the same official Docker plugin distribution channel used by the runbook's install steps (`docker-compose-plugin` via official Docker apt repository).

Docker Compose is available, functional, and installed via the correct official channel.

**This does not block the task.**

The installed Docker Compose version (v5.3.1) is newer than the runbook's example expectation and does not indicate a deviation from the installation method or a compatibility problem. Future staging execution tasks that use Docker Compose will use v5.3.1 on this server.

**Docker Compose version result: PASS.**

---

## 7. Safety / Non-Goal Verification

These items verify that no work outside the Step 2 scope occurred during Keith's manual installation.

| # | Safety Check | Keith's Evidence | Result |
|---|-------------|-----------------|--------|
| 1 | No repo cloned | `/opt/aisandbox does not exist: Yes` | PASS |
| 2 | No .env file created | `No .env file on server: Yes` | PASS |
| 3 | No app services started | `No app services started: Yes` | PASS |
| 4 | No PostgreSQL installed | `No PostgreSQL installed: Yes` | PASS |
| 5 | No Redis installed | `No Redis installed: Yes` | PASS |
| 6 | No staging.ainow.biz in Caddyfile | `No staging.ainow.biz entry in Caddyfile: Yes` | PASS |
| 7 | No TLS certificate issued | `No TLS certificate issued: Yes` | PASS |
| 8 | No DNS A record configured | `No DNS A record configured: Yes` | PASS |
| 9 | No warnings or unexpected outputs | `None` | PASS |
| 10 | PM2 list is empty (no app processes) | `Empty process list. No app processes running.` | PASS |

**All 10 safety / non-goal checks: PASS.**

No work outside the Step 2 runbook scope occurred. The server remains in a clean runtime-tools-only state with no application, database, DNS, or TLS configuration.

---

## 8. Snapshot Verification

| Field | Value |
|-------|-------|
| Snapshot name | `aisandbox-staging-runtime-2026-07-24` |
| Snapshot status | Available |
| Runbook expected name | `aisandbox-staging-runtime-2026-07-24` |
| Runbook expected status | Available |
| Result | **PASS** |

The post-runtime-install snapshot was created with the exact name specified in the runbook (Section 21) and is in Available status. This snapshot provides a clean rollback point before database installation and application deployment work in future execution tasks.

The prior baseline snapshot (`aisandbox-staging-baseline-2026-07-23`, created during PRIVATE-BETA-STAGING-EXECUTION-01) remains unchanged and is not mentioned in the current evidence — this is expected, as Keith was not asked to report on it again.

**Snapshot state after Step 2:**

| Snapshot | Status | Created By |
|----------|--------|-----------|
| `aisandbox-staging-baseline-2026-07-23` | Available (from EXECUTION-01) | PRIVATE-BETA-STAGING-EXECUTION-01 |
| `aisandbox-staging-runtime-2026-07-24` | Available | PRIVATE-BETA-STAGING-EXECUTION-02 Step 2 |

---

## 9. DNS / TLS Verification

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | No staging.ainow.biz entry in Caddyfile | Yes | PASS |
| 2 | No TLS certificate issued | Yes | PASS |
| 3 | No DNS A record configured | Yes | PASS |

DNS configuration, Caddyfile site configuration, and TLS certificate issuance are explicitly out of scope for PRIVATE-BETA-STAGING-EXECUTION-02. These belong to a future staging execution task (STAGING-EXECUTION-03 or equivalent). Keith's evidence confirms none of these were performed.

---

## 10. PASS / BLOCKED Verdict

### Verdict: **PASS**

All 22 evidence items meet the PASS criteria defined in the Step 3 task instructions:

- All required runtime tools are installed and verified (Node.js 20 LTS, Docker Engine, Docker Compose, PM2, Caddy).
- Docker hello-world succeeded.
- PM2 is installed and has no app processes.
- Caddy is installed and active as a systemd service.
- No app deployment occurred.
- No repo was cloned.
- No `.env` was created.
- PostgreSQL and Redis were not installed.
- No DNS or TLS was configured.
- Runtime snapshot (`aisandbox-staging-runtime-2026-07-24`) is Available.
- No warnings were reported.

No BLOCKED criteria were triggered.

---

## 11. Remaining Gaps

The following items are intentionally deferred to future staging execution tasks. They are not gaps or defects — they are explicitly out of scope for PRIVATE-BETA-STAGING-EXECUTION-02.

| # | Deferred Item | Belongs To |
|---|--------------|-----------|
| 1 | DNS A record for staging.ainow.biz | Future STAGING-EXECUTION task |
| 2 | Caddyfile site configuration for staging.ainow.biz | Future STAGING-EXECUTION task |
| 3 | TLS certificate issuance (Let's Encrypt via Caddy) | Future STAGING-EXECUTION task |
| 4 | PostgreSQL installation and configuration | Future STAGING-EXECUTION task |
| 5 | Redis installation and configuration | Future STAGING-EXECUTION task |
| 6 | Repository clone to /opt/aisandbox | Future STAGING-EXECUTION task |
| 7 | .env file creation and secret entry | Future STAGING-EXECUTION task |
| 8 | Application build and PM2 service startup | Future STAGING-EXECUTION task |
| 9 | Database migration execution | Future STAGING-EXECUTION task |
| 10 | Staging app live smoke and health verification | Future STAGING-EXECUTION task |
| 11 | Beta invite and public launch | Future task — not in staging execution scope |

None of these gaps affect the PASS verdict for PRIVATE-BETA-STAGING-EXECUTION-02 Step 3.

---

## 12. Exact Next Recommended Action

**PRIVATE-BETA-STAGING-EXECUTION-02 Step 4 — Consolidation / Handoff to STAGING-EXECUTION-03**

Step 4 is the final step of PRIVATE-BETA-STAGING-EXECUTION-02. It will:

1. Update `TASKS.md` — mark PRIVATE-BETA-STAGING-EXECUTION-02 as COMPLETE and LOCKED.
2. Update `TASKS_BACKLOG_FULL.md` — mirror the status change.
3. Update `docs/AINOW-EXECUTION-ROADMAP.md` — record task completion.
4. Create the consolidation checkpoint: `docs/PRIVATE-BETA-STAGING-EXECUTION-02-CHECKPOINT.md`.
5. Record the final server state after runtime installation.
6. Hand off formally to PRIVATE-BETA-STAGING-EXECUTION-03 (next staging execution task).

Step 4 is a consolidation-only step — no server action, no source changes, no AWS action.

---

## 13. Safety Confirmations

| # | Safety Item | Status |
|---|------------|--------|
| 1 | No server action performed by agent in this step | CONFIRMED |
| 2 | No SSH action | CONFIRMED |
| 3 | No AWS CLI action | CONFIRMED |
| 4 | No DNS action | CONFIRMED |
| 5 | No TLS action | CONFIRMED |
| 6 | No Docker action performed locally | CONFIRMED |
| 7 | No PostgreSQL action | CONFIRMED |
| 8 | No Redis action | CONFIRMED |
| 9 | No repo cloned | CONFIRMED |
| 10 | No .env file opened, created, or edited | CONFIRMED |
| 11 | No env values printed | CONFIRMED |
| 12 | No source files changed | CONFIRMED |
| 13 | No test files changed | CONFIRMED |
| 14 | No package files changed | CONFIRMED |
| 15 | No migration files changed | CONFIRMED |
| 16 | No Docker/deployment/Caddy/PM2 config files changed | CONFIRMED |
| 17 | No governance files changed (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | CONFIRMED — governance updates belong to Step 4 |
| 18 | No git commit or push | CONFIRMED |
| 19 | No subagents used | CONFIRMED |
| 20 | Only file created | `docs/PRIVATE-BETA-STAGING-EXECUTION-02-EVIDENCE-REVIEW.md` |

---

**Evidence review created:** 2026-07-24
**Task:** PRIVATE-BETA-STAGING-EXECUTION-02 — Step 3
**Verdict:** PASS
**Next action:** PRIVATE-BETA-STAGING-EXECUTION-02 Step 4 — Consolidation / Handoff to STAGING-EXECUTION-03
**No source code changed.**
**No env files created/opened/edited.**
**No env values opened/printed.**
**No server/SSH/AWS/DNS/TLS action occurred.**
**No Docker/PostgreSQL/Redis action occurred locally.**
**No git commit or push occurred.**
**No subagents used.**
