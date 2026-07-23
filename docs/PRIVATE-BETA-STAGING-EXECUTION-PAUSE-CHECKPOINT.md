# PRIVATE-BETA-STAGING-EXECUTION — Cloud Execution Pause Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-PAUSE
**Title:** Cloud Execution Pause — Return to Local Testing
**Date:** 2026-07-23
**Decision by:** Keith
**Nature:** Governance / pause decision record only — no AWS action — no implementation — no source changes — no git commit or push — no subagents
**Status:** PAUSE RECORDED — 2026-07-23

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Pause record ID | PRIVATE-BETA-STAGING-EXECUTION-PAUSE |
| Title | Cloud Execution Pause — Return to Local Testing |
| Date | 2026-07-23 |
| Decision by | Keith |
| Nature | Governance / pause decision record only |
| Predecessor | PRIVATE-BETA-STAGING-EXECUTION-01 — COMPLETE and LOCKED — 2026-07-23 |
| Files changed | TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md, docs/PRIVATE-BETA-STAGING-EXECUTION-PAUSE-CHECKPOINT.md |
| Files not changed | All source, test, package, migration, entity, environment, Docker, deployment files unchanged |

---

## 2. Reason for Pause

Keith decided to pause further Lightsail/cloud staging execution after PRIVATE-BETA-STAGING-EXECUTION-01.

Reasons recorded:

1. The app is still far from finished. Core product gaps remain unverified locally.
2. Continuing to run the Lightsail instance during active product development wastes money at ~US$40–44/month for a server that is idle (no app deployed, no users).
3. Further staging execution (runtime install, DNS, Caddy/TLS, repo clone, env, migration) requires a more complete local app first.
4. Local-machine testing is the correct primary path until local flows are closer to private beta readiness.
5. Lightsail will only be useful later when real staging/domain/HTTPS/deployment behavior is specifically needed.
6. PRIVATE-BETA-STAGING-EXECUTION-02 must not be registered yet.

---

## 3. Current Completed Cloud State

The following accurately reflects the cloud state as of 2026-07-23.

| Field | Value |
|-------|-------|
| Instance name | `aisandbox-staging` |
| Region | Singapore / ap-southeast-1 |
| OS | Ubuntu 24.04.4 LTS (noble) |
| Instance plan | 8 GB RAM / 2 vCPU / 160 GB SSD |
| Instance status | Running (billing active) |
| Static IP name | `aisandbox-staging-ip` |
| Static IP value | Not recorded in tracked docs (Keith holds privately) |
| Static IP status | Attached to `aisandbox-staging` |
| Firewall public ports | 22, 80, 443 only |
| Internal ports | 3002, 4000, 4001, 4002, 5432, 6379 — closed externally |

### Manual Baseline Snapshot

| Field | Value |
|-------|-------|
| Snapshot name | `aisandbox-staging-baseline-2026-07-23` |
| Snapshot status | Available |
| Created | 2026-07-23 |
| Purpose | Clean rollback point before any software installation |

### Automatic Snapshots

| Field | Value |
|-------|-------|
| Automatic snapshots | Enabled |
| Frequency | Daily (AWS Lightsail automatic) |

---

## 4. What Was Already Completed (EXECUTION-01)

PRIVATE-BETA-STAGING-EXECUTION-01 — COMPLETE and LOCKED — 2026-07-23.

All 4 steps complete. Keith performed all AWS console and browser SSH actions manually.

| # | Action | Result |
|---|--------|--------|
| 1 | AWS Lightsail instance `aisandbox-staging` created | Succeeded — Running |
| 2 | Static IP `aisandbox-staging-ip` created and attached | Succeeded — Attached |
| 3 | Firewall configured — TCP 22, 80, 443 open only | Succeeded |
| 4 | Lightsail browser SSH connected as `ubuntu` | Succeeded |
| 5 | `sudo apt update` | Succeeded |
| 6 | `sudo apt upgrade -y` | Succeeded |
| 7 | Timezone set to Asia/Hong_Kong (HKT, +0800) | Succeeded — NTP synchronized |
| 8 | `sudo reboot` and reconnected | Succeeded |
| 9 | Post-reboot OS verified — Ubuntu 24.04.4 LTS / noble | Succeeded |
| 10 | Manual snapshot `aisandbox-staging-baseline-2026-07-23` created | Succeeded — Available |
| 11 | Automatic snapshots enabled | Succeeded |

---

## 5. What Was Not Completed (Remains Deferred)

The following actions were explicitly NOT performed in EXECUTION-01 and remain deferred.

| # | Not Completed / Deferred |
|---|--------------------------|
| 1 | DNS A record for staging.ainow.biz |
| 2 | Caddy installation or configuration |
| 3 | TLS/HTTPS certificate request |
| 4 | Node.js, npm, Docker, PM2 installation |
| 5 | PostgreSQL 15 installation |
| 6 | Redis 7 installation |
| 7 | Repository clone to `/opt/aisandbox` |
| 8 | `.env` file creation and population |
| 9 | Application build or service startup |
| 10 | Database migration execution |
| 11 | Pre-migration PostgreSQL backup |
| 12 | Beta user invitation |
| 13 | Production domain use |
| 14 | Any staging app serving traffic |

---

## 6. Deferred Cloud Tasks

| Task | Status | Notes |
|------|--------|-------|
| PRIVATE-BETA-STAGING-EXECUTION-02 — Runtime Installation Baseline | DEFERRED / NOT REGISTERED | Waiting until Keith decides cloud staging should resume |
| PRIVATE-BETA-STAGING-EXECUTION-03+ (DNS, Caddy, TLS, etc.) | NOT REGISTERED | Sequence deferred after EXECUTION-02 |

**Rule:** Do not register PRIVATE-BETA-STAGING-EXECUTION-02 until Keith gives explicit approval to resume cloud staging execution.

---

## 7. Local Testing Decision

Keith decided local-machine testing resumes as the primary path.

**Local testing rationale:**
- The app has unverified local product gaps.
- Login, register, Create Agent, billing disabled-state, and harness kill-switch state should be locally verified before returning to cloud.
- Local testing costs nothing and can proceed immediately.
- Cloud deployment only becomes relevant when local flows are close to private beta ready.

**Local testing path:**

`LOCAL-PRIVATE-BETA-READINESS-01 — Local Machine Rebaseline + Private Beta Gap Review`

This task covers:
- Return focus to local testing.
- Verify local app status (DB, Redis, services).
- Identify unfinished product gaps.
- Test login/register locally.
- Test Create Agent locally.
- Verify billing disabled state locally.
- Verify agent harness risky execution remains disabled locally.
- Verify local migrations / DB / Redis path as needed.
- Produce a concise next-fix list before returning to cloud deployment.

**Registration status:** NOT YET REGISTERED — pending Keith explicit approval.

---

## 8. What Can Be Tested Locally

The following can be tested on local machine without the Lightsail instance:

| # | Local Testable Item |
|---|---------------------|
| 1 | Login / register flow (Google OAuth or local auth) |
| 2 | Create Agent (POST /api/agents, GET /api/agents) |
| 3 | Agent list and detail view |
| 4 | Billing disabled state — credit balance / subscription UI |
| 5 | Agent harness risky execution remains disabled (kill switch) |
| 6 | Workspace session creation and editor |
| 7 | Checkpoint / revert flows |
| 8 | File tree and editor state |
| 9 | Locale switching (en / zh-TW / zh-CN) |
| 10 | Migration status — local `user_agents` table exists (B3 PASS verified 2026-07-21) |

---

## 9. What Still Needs Cloud Later

The following require real cloud/Lightsail staging and cannot be verified locally:

| # | Requires Cloud |
|---|----------------|
| 1 | HTTPS/TLS verification via staging.ainow.biz |
| 2 | Caddy reverse proxy behavior |
| 3 | Domain/cookie behavior on real HTTPS domain |
| 4 | Real migration run against PostgreSQL on staging server |
| 5 | PM2 service startup and restart behavior |
| 6 | Staging health smoke (H1–H9) at staging.ainow.biz |
| 7 | External HTTPS browser smoke at staging domain |
| 8 | Real beta user access over HTTPS |

---

## 10. PRIVATE-BETA-DEPLOYMENT-READINESS Status

**Status: BLOCKED / PAUSED**

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-DEPLOYMENT-READINESS |
| Steps 1–2 | COMPLETE — 2026-07-21 |
| Step 3 | BLOCKED |
| Blocker | No real staging app deployed and verified |
| Unblocked by | Real app deployment and verification at staging.ainow.biz |
| Current cloud state | Lightsail baseline server only — no runtime, no app, no DNS, no TLS |
| Pause reason | Cloud staging execution paused after EXECUTION-01 (Keith decision 2026-07-23) |

Do not claim staging is live. Do not claim PRIVATE-BETA-DEPLOYMENT-READINESS Step 3 can proceed.

PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED until:
- Runtime installed on staging server
- App built, deployed, and running via PM2
- DNS A record pointing to Lightsail static IP
- Caddy configured and TLS certificate issued
- All pre-deployment gates G1–G27 passed
- Migrations executed and post-migration verification passed
- Health smoke H1–H9 passed at staging.ainow.biz
- Keith explicit approval to proceed

---

## 11. Recommended Next Local Task

**LOCAL-PRIVATE-BETA-READINESS-01 — Local Machine Rebaseline + Private Beta Gap Review**

**Purpose:** Return focus to local testing, identify unfinished product gaps, and produce a concise next-fix list before returning to cloud deployment.

**Covers:**
- Verify local DB, Redis, and service startup
- Test login/register locally
- Test Create Agent locally
- Verify billing disabled state locally
- Verify agent harness risky execution remains disabled locally
- Identify and list any broken local flows
- Produce gap list for next fix tasks

**Registration status:** NOT YET REGISTERED — pending Keith explicit approval.

**Do not register this task without Keith explicit approval.**

---

## 12. Safety Boundaries

All safety boundaries were preserved throughout this pause record:

- No AWS action occurred.
- No instance stop, deletion, or modification occurred.
- No DNS change occurred.
- No TLS/Caddy action occurred.
- No runtime install occurred.
- No PostgreSQL/Redis action occurred.
- No deployment occurred.
- No migration occurred.
- No env file opened, created, or edited.
- No secret values printed, requested, or generated.
- No source, test, package, migration, entity, environment, Docker, or deployment files changed.
- No git commit or push.
- No subagents used.

---

## 13. Cost-Control Note

The `aisandbox-staging` Lightsail instance continues to run and incur cost (~US$40–44/month) while paused. Keith is aware.

Options if cost becomes a concern:
- **Stop the instance** (reduces compute cost; static IP remains billed at a small rate when not attached to a running instance — but this is a Keith decision, NOT an agent action).
- **Leave running** (simpler; automatic snapshots continue; no setup required to resume).
- **Delete and recreate** (eliminates cost; requires re-running EXECUTION-01 scope when staging is needed again; `aisandbox-staging-baseline-2026-07-23` snapshot can be used to restore).

The agent must not take any of these cost-control actions. This note is advisory only.

---

## 14. Locked/Deferred Instruction

| Item | Instruction |
|------|-------------|
| PRIVATE-BETA-STAGING-EXECUTION-01 | COMPLETE and LOCKED — do not modify |
| PRIVATE-BETA-STAGING-EXECUTION-02 | DEFERRED / NOT REGISTERED — do not register without Keith explicit approval |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED — do not advance Step 3 |
| Cloud staging execution | PAUSED after EXECUTION-01 — Keith decision 2026-07-23 |
| Local testing | ACTIVE recommended path |
| LOCAL-PRIVATE-BETA-READINESS-01 | NOT YET REGISTERED — pending Keith explicit approval |

---

## 15. Exact Next Action

**Await Keith explicit approval before proceeding.**

Recommended next action:

> Keith approves registration of `LOCAL-PRIVATE-BETA-READINESS-01 — Local Machine Rebaseline + Private Beta Gap Review`.

Until Keith explicitly approves:
- PRIVATE-BETA-STAGING-EXECUTION-01 is COMPLETE and LOCKED.
- PRIVATE-BETA-STAGING-EXECUTION-02 is DEFERRED / NOT REGISTERED.
- PRIVATE-BETA-DEPLOYMENT-READINESS is BLOCKED / PAUSED.
- Cloud staging execution is PAUSED.
- No AWS action should be taken.
- LOCAL-PRIVATE-BETA-READINESS-01 is not yet registered.

---

**Checkpoint created:** 2026-07-23
**Pause decision recorded:** Keith — 2026-07-23
**Cloud execution paused after:** PRIVATE-BETA-STAGING-EXECUTION-01 — COMPLETE and LOCKED
**No AWS action occurred.**
**No instance stop/delete/modify occurred.**
**No DNS/TLS/Caddy action occurred.**
**No runtime/install/deploy action occurred.**
**No PostgreSQL/Redis action occurred.**
**No migration/backup/snapshot action occurred.**
**No env file created/opened/edited.**
**No secret values printed/requested/generated.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No git commit or git push occurred.**
**No subagents used.**
