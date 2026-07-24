# PRIVATE-BETA-STAGING-EXECUTION-02 — Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-02
**Title:** Runtime Installation Baseline
**Step:** 4 — Consolidation / Handoff to STAGING-EXECUTION-03
**Date:** 2026-07-24
**Nature:** Consolidation / governance only — no server action — no source changes — no AWS action — no git commit or push — no subagents

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
| Completed | 2026-07-24 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |

---

## 2. Final Status

**COMPLETE and LOCKED — 2026-07-24**

All 4 steps complete. Step 3 verdict: PASS. All 22 evidence items PASS. All 10 safety/non-goal checks PASS. Runtime snapshot created and Available. No app deployed. No database installed. No DNS or TLS configured. No repo cloned. No `.env` created.

---

## 3. Purpose

PRIVATE-BETA-STAGING-EXECUTION-02 established a verified runtime tool baseline on the `aisandbox-staging` Lightsail server. The goal was to install and verify Node.js, Docker Engine, PM2, and Caddy before any application, database, or DNS/TLS configuration work.

This task resumed cloud staging execution following the Keith staging-environment parity decision (2026-07-24), which concluded that the local Windows environment was not equivalent to the future staging environment and that continuing local AI Service env debugging would optimize for the wrong environment.

---

## 4. Predecessor State

- **PRIVATE-BETA-STAGING-EXECUTION-01:** COMPLETE and LOCKED — 2026-07-23 — All 4 steps complete — Keith manual execution PASS — `aisandbox-staging` Running / ap-southeast-1 / Ubuntu 24.04.4 LTS / 8 GB / 2 vCPU / 160 GB SSD — Static IP aisandbox-staging-ip attached — Firewall 22/80/443 open; internal ports closed — Snapshot `aisandbox-staging-baseline-2026-07-23` Available — Auto-snapshots enabled — No DNS/TLS/runtime/database/app/migration/env/secret action occurred.
- **Baseline snapshot preserved:** `aisandbox-staging-baseline-2026-07-23` — Available — not modified or deleted.

---

## 5. Why the Local Path Was Paused

`LOCAL-PRIVATE-BETA-READINESS-02-FIX-AI-SERVICE-REDIS-ENV-LOCAL` exposed that the local Windows runtime was not equivalent to the future staging environment. The env loading wiring fix was applied at source level (`services/ai-service/src/main.ts`), but the AI Service then exposed a local Windows-host runtime mismatch. The root `.env` contains Docker/Linux-style keys; local Windows execution introduced mismatch around service hostnames and DB/Redis connectivity.

Keith decided (2026-07-24): continuing local AI Service env debugging risks optimizing for the wrong environment. Better path is Lightsail staging (Ubuntu 24.04.4 LTS).

- **LOCAL-PRIVATE-BETA-READINESS-02:** PAUSED / PARTIALLY COMPLETE — Container Manager PASS; AI Service local runtime unresolved.
- **LOCAL-PRIVATE-BETA-READINESS-02-FIX-AI-SERVICE-REDIS-ENV-LOCAL:** PAUSED / SUPERSEDED by staging-environment parity decision.
- **Pivot checkpoint:** `docs/LOCAL-TO-STAGING-PARITY-PIVOT-CHECKPOINT.md`

---

## 6. Runtime Installation Scope

This task covered:

| # | Tool | Scope |
|---|------|-------|
| 1 | Node.js 20 LTS | Install + verify |
| 2 | npm (bundled with Node.js 20) | Verify |
| 3 | Docker Engine | Install + verify |
| 4 | Docker Compose (plugin) | Install + verify |
| 5 | Docker hello-world | Verify Docker is working |
| 6 | ubuntu user docker group | Add + verify |
| 7 | PM2 | Install + verify |
| 8 | Caddy | Install + verify |

**Explicitly out of scope for this task:**
DNS / Caddy site config / TLS certificate / PostgreSQL / Redis / repo clone / `.env` creation / app build or start / PM2 app processes / database migration / beta invite / public launch / source code changes.

---

## 7. Manual Runbook Created

**Runbook:** `docs/PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md`

Created in Step 2. Covers:
- Baseline server verification
- Node.js 20 LTS installation (NodeSource repository)
- Docker Engine installation (official Docker apt repository)
- Docker verification (hello-world)
- Docker group setup and reconnect
- PM2 installation (npm global)
- Caddy installation (official Caddy apt repository)
- Caddy verification
- DNS/TLS non-goal confirmation
- App deployment non-goal confirmation
- Post-runtime-install snapshot steps
- Safe evidence template for Keith
- Stop conditions (20 items)

Keith followed this runbook manually inside AWS Lightsail browser SSH.

---

## 8. Keith Evidence Reviewed

**Evidence review:** `docs/PRIVATE-BETA-STAGING-EXECUTION-02-EVIDENCE-REVIEW.md`

Keith ran the Step 2 runbook manually and provided safe evidence outputs. Step 3 reviewed all 22 evidence items.

**Evidence items reviewed:** 22 items — all PASS.
**Safety/non-goal checks:** 10 items — all PASS.
**Docker Compose version note:** v5.3.1 installed (runbook example said v2.x.x) — PASS — see Section 10.
**Verdict:** PASS.

---

## 9. Runtime Tool Versions

| Tool | Installed Version | Runbook Requirement | Result |
|------|-------------------|---------------------|--------|
| Ubuntu | 24.04.4 LTS (noble) | 24.04.x LTS | PASS |
| Node.js | v20.20.2 | v20.x.x | PASS |
| npm | 10.8.2 | 10.x.x | PASS |
| Docker Engine | 29.6.2 | Any recent stable | PASS |
| Docker Compose | v5.3.1 | v2.x.x (example) | PASS — see note |
| Docker hello-world | Hello from Docker! | Hello from Docker! | PASS |
| ubuntu docker group | Present in groups | docker in groups | PASS |
| PM2 | 7.0.3 | 5.x.x or any recent stable | PASS |
| Caddy | v2.11.4 | v2.x.x | PASS |

PM2 process list: **empty** — no app processes running. Correct.
Caddy service: **loaded / enabled / active (running)** — correct post-install state.

---

## 10. Docker Compose Version Note

The Step 2 runbook listed the expected Docker Compose version as `v2.x.x` as an example expectation (contemporary stable at time of writing).

Keith's evidence showed:

```
Docker Compose version v5.3.1
```

**Assessment:** Docker Compose v5.3.1 is a newer release than the v2.x.x example in the runbook. It was installed via the same official Docker apt channel (`docker-compose-plugin`) specified by the runbook. Docker Compose v5.x is a more recent stable release from the official Docker distribution. The tool is installed, available, and functional.

**This does not block the task. Docker Compose version result: PASS.**

Future staging execution tasks that use Docker Compose will use v5.3.1 on this server.

---

## 11. Caddy State

| Item | State |
|------|-------|
| Caddy version | v2.11.4 |
| Caddy service | loaded / enabled / active (running) |
| Caddyfile | Default placeholder — no `staging.ainow.biz` entry |
| TLS certificate | None issued |
| DNS A record | Not configured |

Caddy is installed and its systemd service is running. No site has been configured. DNS and TLS configuration belong to a future staging execution task.

---

## 12. PM2 State

| Item | State |
|------|-------|
| PM2 version | 7.0.3 |
| PM2 process list | Empty — no app processes |
| Any services started | No |

PM2 is installed globally. No application has been deployed. No PM2 app processes are running. This is the correct state — app deployment belongs to a future staging execution task.

---

## 13. Safety / Non-Goal Verification

All 10 safety/non-goal checks passed:

| # | Safety Check | Result |
|---|-------------|--------|
| 1 | No repo cloned (`/opt/aisandbox` does not exist) | PASS |
| 2 | No `.env` file created | PASS |
| 3 | No app services started | PASS |
| 4 | No PostgreSQL installed | PASS |
| 5 | No Redis installed | PASS |
| 6 | No `staging.ainow.biz` entry in Caddyfile | PASS |
| 7 | No TLS certificate issued | PASS |
| 8 | No DNS A record configured | PASS |
| 9 | No warnings or unexpected outputs | PASS |
| 10 | PM2 list is empty (no app processes) | PASS |

---

## 14. Snapshot Verification

| Snapshot | Status | Created By |
|----------|--------|-----------|
| `aisandbox-staging-baseline-2026-07-23` | Available | PRIVATE-BETA-STAGING-EXECUTION-01 |
| `aisandbox-staging-runtime-2026-07-24` | Available | PRIVATE-BETA-STAGING-EXECUTION-02 Step 2 |

The post-runtime-install snapshot (`aisandbox-staging-runtime-2026-07-24`) was created with the exact name specified in the runbook and is Available. This snapshot provides a clean rollback point before database installation and application deployment.

The prior baseline snapshot (`aisandbox-staging-baseline-2026-07-23`) remains unchanged.

---

## 15. Server Final State

After PRIVATE-BETA-STAGING-EXECUTION-02 is complete and locked, the `aisandbox-staging` server is in the following state:

| Item | State |
|------|-------|
| Instance | `aisandbox-staging` — Running — ap-southeast-1 |
| OS | Ubuntu 24.04.4 LTS / noble |
| Timezone | Asia/Hong_Kong (HKT, +0800) |
| Firewall | 22, 80, 443 open; 3002/4000/4001/4002/5432/6379 closed externally |
| Node.js | v20.20.2 — installed |
| npm | 10.8.2 — installed |
| Docker Engine | 29.6.2 — installed and running |
| Docker Compose | v5.3.1 — installed |
| ubuntu docker group | Confirmed |
| PM2 | 7.0.3 — installed globally, no processes |
| Caddy | v2.11.4 — installed, systemd service active, no site config |
| Repository | Not cloned — `/opt/aisandbox` does not exist |
| `.env` | Not created |
| PostgreSQL | Not installed |
| Redis | Not installed |
| DNS | Not configured |
| TLS | Not configured |
| App services | Not started |
| Migrations | Not run |
| Snapshots | `aisandbox-staging-baseline-2026-07-23` Available; `aisandbox-staging-runtime-2026-07-24` Available |

---

## 16. Deferred Items

The following items are intentionally deferred to future staging execution tasks. They are not gaps — they are explicitly out of scope for PRIVATE-BETA-STAGING-EXECUTION-02.

| # | Deferred Item | Belongs To |
|---|--------------|-----------|
| 1 | PostgreSQL installation and configuration | PRIVATE-BETA-STAGING-EXECUTION-03 |
| 2 | Redis installation and configuration | PRIVATE-BETA-STAGING-EXECUTION-03 |
| 3 | PostgreSQL service verification | PRIVATE-BETA-STAGING-EXECUTION-03 |
| 4 | Redis service verification | PRIVATE-BETA-STAGING-EXECUTION-03 |
| 5 | Private DB credentials creation | PRIVATE-BETA-STAGING-EXECUTION-03 |
| 6 | Post-DB-Redis snapshot | PRIVATE-BETA-STAGING-EXECUTION-03 |
| 7 | DNS A record for `staging.ainow.biz` | Future STAGING-EXECUTION task |
| 8 | Caddyfile site configuration | Future STAGING-EXECUTION task |
| 9 | TLS certificate issuance (Let's Encrypt via Caddy) | Future STAGING-EXECUTION task |
| 10 | Repository clone to `/opt/aisandbox` | Future STAGING-EXECUTION task |
| 11 | `.env` file creation and secret entry | Future STAGING-EXECUTION task |
| 12 | Application build and PM2 service startup | Future STAGING-EXECUTION task |
| 13 | Database migration execution | Future STAGING-EXECUTION task |
| 14 | Staging app live smoke and health verification | Future STAGING-EXECUTION task |
| 15 | Beta invite and public launch | Future task |

---

## 17. Files Changed

| File | Change |
|------|--------|
| `docs/PRIVATE-BETA-STAGING-EXECUTION-02-CHECKPOINT.md` | CREATED — this file |
| `TASKS.md` | MODIFIED — EXECUTION-02 marked COMPLETE and LOCKED; status fields updated; workflow steps completed; acceptance criteria checked; checkpoint reference added; next task noted |
| `TASKS_BACKLOG_FULL.md` | MODIFIED — mirrors TASKS.md update for EXECUTION-02 |
| `docs/AINOW-EXECUTION-ROADMAP.md` | MODIFIED — EXECUTION-02 marked COMPLETE and LOCKED; runtime versions recorded; snapshot recorded; next task updated |

---

## 18. Files Read

| File | Purpose |
|------|---------|
| `TASKS.md` | Required reading — task state and governance |
| `TASKS_BACKLOG_FULL.md` | Required reading — backlog state and governance |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Required reading — roadmap state |
| `docs/LOCAL-TO-STAGING-PARITY-PIVOT-CHECKPOINT.md` | Required reading — pivot context |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md` | Required reading — Step 2 runbook |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-02-EVIDENCE-REVIEW.md` | Required reading — Step 3 evidence verdict |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-01-CHECKPOINT.md` | Required reading — predecessor state |
| `docs/PRIVATE-BETA-STAGING-SETUP-CHECKPOINT.md` | Required reading — prior staging setup context |

---

## 19. Validation Performed

| Validation | Result |
|-----------|--------|
| Step 3 evidence verdict confirmed PASS | CONFIRMED |
| All 22 evidence items PASS confirmed | CONFIRMED |
| All 10 safety/non-goal checks PASS confirmed | CONFIRMED |
| Docker Compose version note recorded | CONFIRMED |
| Snapshot `aisandbox-staging-runtime-2026-07-24` Available confirmed | CONFIRMED |
| PRIVATE-BETA-STAGING-EXECUTION-01 still COMPLETE and LOCKED | CONFIRMED |
| LOCAL-PRIVATE-BETA-READINESS-02 still PAUSED / PARTIALLY COMPLETE | CONFIRMED |
| LOCAL FIX task still PAUSED / SUPERSEDED | CONFIRMED |
| PRIVATE-BETA-DEPLOYMENT-READINESS still BLOCKED / PAUSED | CONFIRMED |
| No source code changed | CONFIRMED |
| No env files opened/created/edited | CONFIRMED |
| No env values opened/printed | CONFIRMED |
| No server/SSH/AWS/DNS/TLS action in this step | CONFIRMED |
| No Docker/PostgreSQL/Redis action locally in this step | CONFIRMED |
| No git commit or push | CONFIRMED |
| No subagents used | CONFIRMED |

---

## 20. PASS / BLOCKED Verdict

### Verdict: PASS

All acceptance criteria for PRIVATE-BETA-STAGING-EXECUTION-02 are satisfied:

- [x] Step 1: Registration COMPLETE — 2026-07-23
- [x] Step 2: Runtime Installation Runbook created — 2026-07-24 — `docs/PRIVATE-BETA-STAGING-EXECUTION-02-RUNTIME-INSTALL-RUNBOOK.md`
- [x] Step 3: Keith evidence reviewed and recorded — 2026-07-24 — `docs/PRIVATE-BETA-STAGING-EXECUTION-02-EVIDENCE-REVIEW.md`
- [x] Step 4: Consolidation checkpoint created — 2026-07-24 — this document
- [x] Ubuntu 24.04.4 LTS verified
- [x] Node.js v20.20.2 verified
- [x] npm 10.8.2 verified
- [x] Docker Engine 29.6.2 verified
- [x] Docker Compose v5.3.1 verified
- [x] Docker hello-world verified
- [x] ubuntu user docker group verified
- [x] PM2 7.0.3 verified
- [x] PM2 app process list empty
- [x] Caddy v2.11.4 verified
- [x] Caddy service active
- [x] No repo cloned
- [x] No `.env` created
- [x] No app services started
- [x] PostgreSQL not installed
- [x] Redis not installed
- [x] No DNS A record configured
- [x] No TLS certificate issued
- [x] Runtime snapshot `aisandbox-staging-runtime-2026-07-24` Available
- [x] PRIVATE-BETA-STAGING-EXECUTION-02 marked COMPLETE and LOCKED
- [x] Checkpoint created
- [x] TASKS.md updated
- [x] TASKS_BACKLOG_FULL.md updated
- [x] Roadmap updated
- [x] PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED
- [x] Next recommended task is STAGING-EXECUTION-03
- [x] No source code changed
- [x] No env files opened/created/edited
- [x] No env values opened/printed
- [x] No server/SSH/AWS/DNS/TLS action occurred in this consolidation step
- [x] No Docker/PostgreSQL/Redis action occurred locally in this consolidation step
- [x] No git commit or push occurred
- [x] No subagents used

---

## 21. Remaining Risks

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | PostgreSQL installation may require careful credential management | Credentials must never be pasted into ChatGPT/Cursor output — to be addressed in EXECUTION-03 |
| 2 | Redis installation with password (`requirepass`) must be done before app deployment | Credentials must never be pasted into output — to be addressed in EXECUTION-03 |
| 3 | App `.env` file will contain secrets | Must never be printed — handled by STAGING-SETUP-05 procedure |
| 4 | DNS A record not yet configured | No external access to staging until DNS configured — intentional |
| 5 | App not deployed — no staging smoke possible yet | Intentional — deployment follows DB/Redis installation |
| 6 | Lightsail instance billing (~$40–44/month) continues | Accepted — staging target is needed for progression |

---

## 22. Follow-Up Task Recommendation

**Next recommended task:** PRIVATE-BETA-STAGING-EXECUTION-03 — PostgreSQL + Redis Installation Baseline

STAGING-EXECUTION-03 should be **registered first** before any server action. Registration is Step 1 of the 4-step staging execution workflow.

---

## 23. Guardrails for STAGING-EXECUTION-03

PRIVATE-BETA-STAGING-EXECUTION-03 — PostgreSQL + Redis Installation Baseline should follow these guardrails:

**Expected scope:**
- Install PostgreSQL on `aisandbox-staging` (Lightsail).
- Install Redis on `aisandbox-staging` (Lightsail).
- Verify PostgreSQL service status.
- Verify Redis service status.
- Create private DB credentials manually and safely.
- Create post-DB-Redis snapshot after successful verification.

**Hard boundaries:**
- Do NOT paste credentials into ChatGPT/Cursor output.
- Do NOT clone repo.
- Do NOT create app `.env`.
- Do NOT deploy app.
- Do NOT run migrations yet unless explicitly registered and approved.
- Do NOT configure DNS/TLS yet.
- Do NOT start app services.

**Process discipline:**
- Register STAGING-EXECUTION-03 first (Step 1) before any server action.
- Follow the same 4-step execution workflow as EXECUTION-01 and EXECUTION-02.
- Create a runbook (Step 2) before Keith performs any server work.
- Keith executes manually inside Lightsail browser SSH only.
- Collect and review safe evidence (Step 3) before consolidation.
- Create post-DB-Redis snapshot as part of this task.

---

## 24. No-Go Confirmations

| # | No-Go Item | Confirmed |
|---|-----------|-----------|
| 1 | No SSH action performed by agent in this consolidation step | CONFIRMED |
| 2 | No AWS CLI action | CONFIRMED |
| 3 | No DNS action | CONFIRMED |
| 4 | No TLS action | CONFIRMED |
| 5 | No Docker action performed locally | CONFIRMED |
| 6 | No PostgreSQL action | CONFIRMED |
| 7 | No Redis action | CONFIRMED |
| 8 | No repo cloned | CONFIRMED |
| 9 | No `.env` file opened, created, or edited | CONFIRMED |
| 10 | No env values opened/printed | CONFIRMED |
| 11 | No source files changed | CONFIRMED |
| 12 | No test files changed | CONFIRMED |
| 13 | No package files changed | CONFIRMED |
| 14 | No migration files changed | CONFIRMED |
| 15 | No Docker/deployment/Caddy/PM2 config files changed | CONFIRMED |
| 16 | No git commit or push | CONFIRMED |
| 17 | No subagents used | CONFIRMED |

---

## 25. Final Lock Statement

**PRIVATE-BETA-STAGING-EXECUTION-02 — Runtime Installation Baseline is COMPLETE and LOCKED — 2026-07-24.**

All 4 steps complete. Step 3 verdict PASS. All 22 evidence items PASS. All 10 safety/non-goal checks PASS. Runtime tools installed and verified on `aisandbox-staging`. Snapshot `aisandbox-staging-runtime-2026-07-24` Available. No application deployed. No database installed. No DNS or TLS configured. No repo cloned. No `.env` created.

This checkpoint is locked. No further changes to PRIVATE-BETA-STAGING-EXECUTION-02 task scope, acceptance criteria, or step statuses are permitted unless explicitly approved.

**Next task:** PRIVATE-BETA-STAGING-EXECUTION-03 — PostgreSQL + Redis Installation Baseline — must be registered before any server action.

---

**Checkpoint created:** 2026-07-24
**Task:** PRIVATE-BETA-STAGING-EXECUTION-02 — Step 4
**Verdict:** PASS — COMPLETE and LOCKED
**No source code changed.**
**No env files created/opened/edited.**
**No env values opened/printed.**
**No server/SSH/AWS/DNS/TLS action occurred.**
**No Docker/PostgreSQL/Redis action occurred locally.**
**No git commit or push occurred.**
**No subagents used.**
