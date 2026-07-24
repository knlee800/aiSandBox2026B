# LOCAL-TO-STAGING-PARITY-PIVOT-CHECKPOINT

**Task ID:** LOCAL-TO-STAGING-PARITY-PIVOT
**Title:** Local AI Service Env Debug Pause + Register PRIVATE-BETA-STAGING-EXECUTION-02
**Date:** 2026-07-24
**Decision by:** Keith
**Nature:** Governance / pivot decision record — no source changes — no AWS action — no git commit or push — no subagents
**Status:** PIVOT RECORDED — 2026-07-24

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Pivot record ID | LOCAL-TO-STAGING-PARITY-PIVOT |
| Title | Local AI Service Env Debug Pause + Register PRIVATE-BETA-STAGING-EXECUTION-02 |
| Date | 2026-07-24 |
| Decision by | Keith |
| Nature | Governance / pivot decision record only |
| Predecessor (paused) | LOCAL-PRIVATE-BETA-READINESS-02-FIX-AI-SERVICE-REDIS-ENV-LOCAL — PAUSED / SUPERSEDED |
| Predecessor (parent paused) | LOCAL-PRIVATE-BETA-READINESS-02 — PAUSED / PARTIALLY COMPLETE |
| Resumed task | PRIVATE-BETA-STAGING-EXECUTION-02 — Runtime Installation Baseline — ACTIVE |
| Files changed | TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md, docs/LOCAL-TO-STAGING-PARITY-PIVOT-CHECKPOINT.md |
| Files not changed | All source, test, package, migration, entity, environment, Docker, deployment files unchanged |

---

## 2. Keith's Decision

Keith decided to stop local AI Service env debugging because local Windows runtime settings are not equivalent to the future staging environment.

The local blocker was environmental/parity-related:

1. AI Service env loading was fixed at wiring level (`services/ai-service/src/main.ts` updated to load root `.env` as fallback).
2. AI Service then exposed a local Windows-host runtime mismatch.
3. Root `.env` contained keys suitable for a Docker/Linux-style environment (e.g., service hostnames referencing container names).
4. Local Windows execution introduced mismatch around service hostnames and DB/Redis connectivity/authentication.
5. Continuing local AI Service env debugging risks optimizing for the wrong environment.
6. The better path is to test on the future-like Lightsail staging environment.

**Therefore:**

- `LOCAL-PRIVATE-BETA-READINESS-02-FIX-AI-SERVICE-REDIS-ENV-LOCAL` = **PAUSED / SUPERSEDED** by staging-environment parity decision — 2026-07-23.
- `LOCAL-PRIVATE-BETA-READINESS-02` = **PAUSED / PARTIALLY COMPLETE** — Container Manager local health PASS; AI Service local runtime unresolved due staging parity decision — 2026-07-23.
- `PRIVATE-BETA-STAGING-EXECUTION-02` = **ACTIVE** — Step 1 COMPLETE (Registration — 2026-07-23).

---

## 3. What Was Partially Completed (LOCAL-PRIVATE-BETA-READINESS-02)

| # | Item | Result |
|---|------|--------|
| 1 | Docker/PostgreSQL/Redis health | PASS — both containers healthy |
| 2 | Container Manager local runtime | PASS — GET http://localhost:4002/api/health → 200 |
| 3 | AI Service env loading wiring | FIXED at source level — `main.ts` updated to load root `.env` as fallback |
| 4 | AI Service local runtime startup | BLOCKED — downstream Windows/Linux env mismatch exposed after REDIS_URL fix |
| 5 | AI Service port 4001 binding | NOT REACHED — service could not start due parity mismatch |

Runtime health report: `docs/LOCAL-PRIVATE-BETA-READINESS-02-RUNTIME-HEALTH-REPORT.md`
Fix report: `docs/LOCAL-PRIVATE-BETA-READINESS-02-FIX-AI-SERVICE-REDIS-ENV-LOCAL-REPORT.md`

---

## 4. Why Local AI Service Env Debugging Is Paused

The root `.env` keys are designed for a Docker/Linux-style deployment environment where:

- Redis is accessible via a container hostname.
- PostgreSQL is accessible via a container hostname or internal service name.
- Service-to-service communication uses internal Docker network names.

On local Windows execution (direct `npm run dev`, not Docker Compose for services):

- Container hostnames resolve differently or not at all.
- Redis/PostgreSQL connectivity and authentication may fail due to mismatch between root `.env` values and local Windows runtime expectations.
- The correct fix for this environment is a Windows-local-only `.env` override — which risks creating a fragile local environment that diverges further from staging.

**Continuing local AI Service env debugging risks optimizing for the wrong environment.**

The Lightsail staging server (Ubuntu 24.04.4 LTS) is closer to the production environment. Testing on staging first avoids building and debugging a Windows-specific runtime configuration that will not be used in production.

---

## 5. Staging-Environment Parity Decision

| Field | Value |
|-------|-------|
| Decision | Stop local Windows AI Service env debugging |
| Reason | Local Windows env mismatch is not equivalent to the future staging environment |
| Better path | Test on Lightsail staging environment (Ubuntu 24.04.4 LTS) |
| Date | 2026-07-24 |
| Authority | Keith explicit decision |

---

## 6. Current Cloud State Carried Forward

PRIVATE-BETA-STAGING-EXECUTION-01 is COMPLETE and LOCKED — 2026-07-23.

| Field | Value |
|-------|-------|
| Instance name | `aisandbox-staging` |
| Region | Singapore / ap-southeast-1 |
| OS | Ubuntu 24.04.4 LTS (noble) |
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

### Automatic Snapshots

| Field | Value |
|-------|-------|
| Automatic snapshots | Enabled |

### Not Yet Completed (Deferred to Future EXECUTION Tasks)

| # | Not Completed |
|---|---------------|
| 1 | DNS A record |
| 2 | Caddy installation/configuration |
| 3 | TLS/HTTPS certificate |
| 4 | Node.js / npm / Docker / PM2 installation |
| 5 | PostgreSQL / Redis installation |
| 6 | Repository clone |
| 7 | `.env` creation |
| 8 | App build or service startup |
| 9 | Database migration |
| 10 | Beta invite |
| 11 | Staging app live |

---

## 7. PRIVATE-BETA-STAGING-EXECUTION-02 Registration

### Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-02 |
| Title | Runtime Installation Baseline |
| Status | ACTIVE — Step 1 COMPLETE (Registration — 2026-07-23) |
| Priority | CRITICAL |
| Risk | MEDIUM |
| Nature | REAL STAGING EXECUTION — runtime tool installation |
| Registered | 2026-07-23 |

### Purpose

Install and verify baseline runtime tooling on the existing Lightsail instance to prepare the server for later DB/Redis/app deployment work, without deploying the app yet.

### Scope

1. Connect to Lightsail using browser SSH.
2. Confirm Ubuntu 24.04.4 LTS baseline.
3. Confirm firewall remains 22/80/443 only.
4. Install Node.js 20 LTS.
5. Verify node/npm versions.
6. Install Docker Engine using official Docker apt repo.
7. Verify Docker version.
8. Add `ubuntu` user to docker group if needed.
9. Install PM2 globally.
10. Verify PM2 version.
11. Install Caddy using official Caddy apt repo.
12. Verify Caddy version.
13. Confirm Caddy installed but not yet configured for DNS/TLS.
14. Create no app `.env`.
15. Clone no repo.
16. Start no app services.
17. Run no migrations.
18. Create a post-runtime-install Lightsail snapshot after clean verification.
19. Record safe evidence only.

### Out of Scope

- DNS A record
- Caddy site config
- TLS certificate issuance
- PostgreSQL install
- Redis install
- repo clone
- `.env` creation
- app build/start
- PM2 app processes
- database migration
- beta invite
- public launch
- source code changes
- billing/payment enablement
- risky AI/container execution enablement

### 4-Step Workflow

| Step | Description | Status |
|------|-------------|--------|
| 1 | Registration | COMPLETE — 2026-07-23 |
| 2 | Runtime Installation Runbook | PENDING — creates `docs/PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md` |
| 3 | Keith Manual Runtime Installation Evidence Review | PENDING |
| 4 | Consolidation / Handoff to STAGING-EXECUTION-03 | PENDING |

Step 2 creates a precise manual runbook for Keith to follow in Lightsail browser SSH.

Step 3 reviews Keith's safe evidence after he performs the manual server commands.

Step 4 locks this task and hands off to the next bounded staging task.

### Runbook to Create (Step 2)

Future Step 2 will create:

`C:\Users\knlee\aiSandBox2026B\docs\PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md`

The runbook will cover:
1. Task identity
2. Cost/safety note
3. Preconditions
4. SSH method: Lightsail browser SSH only
5. Baseline verification
6. Node.js 20 LTS install steps
7. npm verification
8. Docker Engine official install steps
9. Docker post-install verification
10. Docker group note/relogin/reconnect if required
11. PM2 install steps
12. PM2 verification
13. Caddy official install steps
14. Caddy verification
15. Confirm no DNS/TLS config yet
16. Confirm no app deploy yet
17. Optional reboot if required
18. Post-runtime snapshot steps
19. Safe evidence template
20. Stop conditions
21. Exact next action

Commands inside Lightsail browser SSH are Linux shell commands and will be clearly labeled:

> Run inside AWS Lightsail browser SSH — not PowerShell.

---

## 8. Safety Boundaries

All safety boundaries were preserved throughout this pivot record:

- This registration step performs no server action.
- Runtime installation will require Keith manual action in a future step.
- No AWS credentials requested.
- No SSH private keys requested.
- No AWS CLI used.
- No local Windows commands used for server installation.
- No DNS configured.
- No TLS configured.
- No PostgreSQL/Redis installed.
- No repo cloned.
- No `.env` created or edited.
- No app services started.
- No migrations run.
- No source code changed.
- No env values opened or printed.
- No local runtime/test/build action occurred.
- No server/SSH/AWS/DNS/TLS action occurred.
- No Docker/PostgreSQL/Redis action occurred.
- No git commit or push.
- No subagents.

---

## 9. Task Status Summary

| Task | Status |
|------|--------|
| LOCAL-PRIVATE-BETA-READINESS-02-FIX-AI-SERVICE-REDIS-ENV-LOCAL | PAUSED / SUPERSEDED by staging-environment parity decision — 2026-07-23 |
| LOCAL-PRIVATE-BETA-READINESS-02 | PAUSED / PARTIALLY COMPLETE — Container Manager PASS; AI Service unresolved — 2026-07-23 |
| LOCAL-PRIVATE-BETA-READINESS-01-FIX-EXECUTION-KILLSWITCH-LOCAL | COMPLETE and LOCKED — 2026-07-23 |
| LOCAL-PRIVATE-BETA-READINESS-01 | COMPLETE and LOCKED — 2026-07-23 |
| PRIVATE-BETA-STAGING-EXECUTION-01 | COMPLETE and LOCKED — 2026-07-23 |
| PRIVATE-BETA-STAGING-EXECUTION-02 | ACTIVE — Step 1 COMPLETE (Registration — 2026-07-23) |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED — resumes after staging app deployed and verified |
| Cloud staging execution | RESUMED — Keith parity decision 2026-07-24 |

---

## 10. Next Recommended Action

**PRIVATE-BETA-STAGING-EXECUTION-02 Step 2 — Runtime Installation Runbook**

Creates `docs/PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md`.

This is a precise manual runbook for Keith to follow in Lightsail browser SSH.
No AWS action is performed in this step — Step 2 is a runbook creation step only.
Keith performs the actual server commands in Step 3.

---

**Checkpoint created:** 2026-07-24
**Pivot decision recorded:** Keith — 2026-07-24
**Local AI Service env debugging paused after:** LOCAL-PRIVATE-BETA-READINESS-02-FIX-AI-SERVICE-REDIS-ENV-LOCAL Step 2 BLOCKED
**Cloud staging execution resumed.**
**No source code changed.**
**No env files created/opened/edited.**
**No env values opened/printed.**
**No local runtime/test/build action occurred.**
**No server/SSH/AWS/DNS/TLS action occurred.**
**No Docker/PostgreSQL/Redis action occurred.**
**No git commit or git push occurred.**
**No subagents used.**
