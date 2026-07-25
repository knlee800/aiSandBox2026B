# PRIVATE-BETA-STAGING-EXECUTION-03 — DB/Redis Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-03
**Title:** PostgreSQL + Redis Installation Baseline
**Step:** 4 — Consolidation / Handoff to STAGING-EXECUTION-04
**Date:** 2026-07-24
**Nature:** Consolidation/governance only — no server action — no source changes — no AWS action — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-03 |
| Title | PostgreSQL + Redis Installation Baseline |
| Step | 4 — Consolidation / Handoff to STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — PostgreSQL and Redis installation on Lightsail instance |
| Risk | MEDIUM — server commands; credential handling; no source changes; no app deployed |
| Registered | 2026-07-24 |
| Completed | 2026-07-24 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |

---

## 2. Final Status

**COMPLETE and LOCKED — 2026-07-24 — All 4 steps COMPLETE.**

Evidence verdict: **PASS WITH VERSION DEVIATION.**

- Step 1: Registration — COMPLETE (2026-07-24)
- Step 2: PostgreSQL + Redis Installation Runbook — COMPLETE (2026-07-24) — `docs/PRIVATE-BETA-STAGING-EXECUTION-03-DB-REDIS-INSTALL-RUNBOOK.md`
- Step 3: Keith Manual DB/Redis Installation Evidence Review — COMPLETE (2026-07-24) — `docs/PRIVATE-BETA-STAGING-EXECUTION-03-EVIDENCE-REVIEW.md`
- Step 4: Consolidation / Handoff to STAGING-EXECUTION-04 — COMPLETE (2026-07-24) — this document

---

## 3. Purpose

This checkpoint consolidates PRIVATE-BETA-STAGING-EXECUTION-03 as COMPLETE and LOCKED. It records that PostgreSQL and Redis were installed and verified on the `aisandbox-staging` Lightsail server, with one explicit version deviation (Redis 8.8.0 vs Redis 7.x target). The task prepared the database/cache baseline only. No app deployment, repo clone, env creation, migrations, DNS, or TLS occurred.

---

## 4. Predecessor State

- **PRIVATE-BETA-STAGING-EXECUTION-02:** COMPLETE and LOCKED — 2026-07-24 — All 4 steps COMPLETE — Runtime installation baseline PASS.
- **Runtime snapshot at start of EXECUTION-03:** `aisandbox-staging-runtime-2026-07-24` — Available.
- **Predecessor runtime:** Ubuntu 24.04.4 LTS / noble — Node.js v20.20.2 — npm 10.8.2 — Docker Engine 29.6.2 — Docker Compose v5.3.1 — PM2 7.0.3 — Caddy v2.11.4 (service active, no site config) — PM2 (no processes).
- **At start of EXECUTION-03:** PostgreSQL not installed — Redis not installed — Repo not cloned — .env not created — App not deployed — No migrations — No DNS — No TLS.

---

## 5. Runtime Baseline Carried Forward

The following runtime baseline from EXECUTION-02 remains intact and was confirmed by evidence:

| Component | Version | Status |
|-----------|---------|--------|
| Ubuntu | 24.04.4 LTS / noble | Confirmed |
| Node.js | v20.20.2 | Confirmed |
| npm | 10.8.2 | Confirmed |
| Docker Engine | 29.6.2 | Confirmed |
| PM2 | 7.0.3 | Confirmed |
| Caddy | v2.11.4 | Confirmed |

---

## 6. DB/Redis Installation Scope

This task installed and verified:

1. PostgreSQL 15.18 from the official PGDG APT repository (noble channel).
2. Redis 8.8.0 from the official Redis APT repository (version deviation — see Section 14).
3. PostgreSQL service verified — cluster 15/main online — port 5432 bound to 127.0.0.1 only.
4. Redis service verified — active/running — port 6379 bound to 127.0.0.1 and ::1 only.
5. `aisandbox` database created — `aisandbox` user created — DB password set privately by Keith.
6. Redis `requirepass` configured — password set privately by Keith.
7. Lightsail firewall confirmed: 22/80/443 only — 5432 and 6379 remain closed externally.
8. Snapshot `aisandbox-staging-db-redis-2026-07-24` created — Available.

---

## 7. Manual Runbook Created

- **Runbook:** `docs/PRIVATE-BETA-STAGING-EXECUTION-03-DB-REDIS-INSTALL-RUNBOOK.md`
- **Step:** 2 — PostgreSQL + Redis Installation Runbook — COMPLETE (2026-07-24)
- **Nature:** Runbook only — no server action — designed for Keith manual execution inside AWS Lightsail browser SSH.

---

## 8. Keith Evidence Reviewed

- **Evidence review report:** `docs/PRIVATE-BETA-STAGING-EXECUTION-03-EVIDENCE-REVIEW.md`
- **Step:** 3 — Keith Manual DB/Redis Installation Evidence Review — COMPLETE (2026-07-24)
- **Evidence type:** User-provided safe evidence from Keith — treated as authoritative.
- **Secret disclosure check:** CLEAN — No password values, connection strings, keys, tokens, or secret-bearing file contents present in evidence.

---

## 9. PostgreSQL Version and Service State

| Check | Result | Verdict |
|-------|--------|---------|
| PostgreSQL version installed | 15.18 | PASS |
| Source | Official PGDG APT repository (noble channel) | PASS |
| pg_lsclusters | Ver 15 / Cluster main / Port 5432 / Status online | PASS |
| postgresql.service | active (exited) — accepted as wrapper/meta service | PASS |
| postgresql@15-main.service | active (running) / Main PID present | PASS |

---

## 10. PostgreSQL Network/Firewall Safety

| Check | Result | Verdict |
|-------|--------|---------|
| listen_addresses | Commented default (localhost) | PASS |
| Port 5432 binding | ss shows 127.0.0.1:5432 only | PASS |
| pg_hba.conf entries | local / 127.0.0.1/32 / ::1/128 only | PASS |
| 0.0.0.0/0 or ::/0 entries | None | PASS |
| Port 5432 in Lightsail firewall | Not present | PASS |

---

## 11. PostgreSQL Database/User Setup

| Check | Result | Verdict |
|-------|--------|---------|
| Database `aisandbox` created | Yes | PASS |
| User `aisandbox` created | Yes | PASS |
| User Superuser attribute | No | PASS |
| User CreateDB attribute | No | PASS |
| User CreateRole attribute | No | PASS |
| App user localhost connection test | PASS | PASS |

---

## 12. PostgreSQL Credential Safety

| Check | Result | Verdict |
|-------|--------|---------|
| DB password set | Yes — via `\password` inside psql | PASS |
| DB password disclosed to AI | No | PASS |
| DATABASE_URL disclosed | No | PASS |
| DB password stored privately by Keith | Yes | PASS |

---

## 13. Redis Version and Service State

| Check | Result | Verdict |
|-------|--------|---------|
| Redis version installed | 8.8.0 | DEVIATION (see Section 14) |
| Source | Official Redis APT repository | PASS |
| redis-server.service | active (running) | PASS |
| Status line | Ready to accept connections | PASS |

---

## 14. Redis Version Deviation

**Target version:** Redis 7.x (per runbook and PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md).

**Installed version:** Redis 8.8.0 from the official Redis APT repository.

**Deviation reason:** The official Redis APT repository installed Redis 8.8.0 rather than the 7.x target. No pinning to Redis 7.x was performed.

**Verdict:** PASS WITH VERSION DEVIATION — not BLOCKED.

**Justification:** Redis 8.8.0 is active, local-only, protected-mode enabled, requirepass configured, unauthenticated ping blocked, authenticated ping passed. No app has been deployed. No migrations have been run. The deviation does not block EXECUTION-03 because no app service has yet used Redis.

**Required guardrail before app deployment:**

> Before app deployment or app service startup, the next relevant task must verify application compatibility with Redis 8.8.0 — especially `ioredis` client usage, BullMQ queue usage, and any Redis-version-gated features — or explicitly decide to pin/downgrade Redis to 7.x before the app uses Redis. This check must occur before `PRIVATE-BETA-STAGING-EXECUTION-04` starts any app service.

---

## 15. Redis Network/Firewall Safety

| Check | Result | Verdict |
|-------|--------|---------|
| Port 6379 binding | 127.0.0.1 and ::1 only | PASS |
| bind directive | `bind 127.0.0.1 -::1` confirmed | PASS |
| protected-mode | yes | PASS |
| Port 6379 in Lightsail firewall | Not present | PASS |

---

## 16. Redis Credential Safety

| Check | Result | Verdict |
|-------|--------|---------|
| requirepass configured | Yes — redacted | PASS |
| Unauthenticated ping | Returns `NOAUTH Authentication required` | PASS |
| Authenticated ping | Returns `PONG` | PASS |
| Redis password disclosed to AI | No | PASS |
| REDIS_URL disclosed | No | PASS |
| Redis password stored privately by Keith | Yes | PASS |

---

## 17. Non-Goal Verification

The following were confirmed NOT done in this task:

| Non-goal | Confirmed |
|----------|-----------|
| Repo cloned | Not cloned |
| App `.env` created | Not created |
| App services started | Not started |
| Migrations run | Not run |
| DNS configured | Not configured |
| TLS configured | Not configured |

---

## 18. Snapshot Verification

| Snapshot | Status |
|----------|--------|
| `aisandbox-staging-db-redis-2026-07-24` | Available |

Snapshot created after PostgreSQL and Redis installation and verification passed.

---

## 19. Secret Disclosure Review

**CLEAN.**

No password values, connection strings, DATABASE_URL values, REDIS_URL values, API keys, tokens, SSH private keys, or secret-bearing file contents were present in any evidence, governance document, or checkpoint created during this task.

---

## 20. Files Changed

| File | Change |
|------|--------|
| `docs/PRIVATE-BETA-STAGING-EXECUTION-03-DB-REDIS-INSTALL-RUNBOOK.md` | Created (Step 2) |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-03-EVIDENCE-REVIEW.md` | Created (Step 3) |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-03-DB-REDIS-CHECKPOINT.md` | Created (this document — Step 4) |
| `TASKS.md` | Updated — EXECUTION-03 COMPLETE and LOCKED |
| `TASKS_BACKLOG_FULL.md` | Updated — EXECUTION-03 COMPLETE and LOCKED |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Updated — EXECUTION-03 COMPLETE and LOCKED |

No source code files changed. No env files opened/created/edited. No package, migration, Docker, deployment, Caddy, or PM2 files changed.

---

## 21. Files Read

| File | Purpose |
|------|---------|
| `TASKS.md` | Active task and governance state |
| `TASKS_BACKLOG_FULL.md` | Long-form backlog and task definitions |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Execution roadmap |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-03-DB-REDIS-INSTALL-RUNBOOK.md` | Step 2 runbook |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-03-EVIDENCE-REVIEW.md` | Step 3 evidence review |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-02-CHECKPOINT.md` | Predecessor checkpoint |
| `docs/PRIVATE-BETA-STAGING-SETUP-06-DB-REDIS-PLAN.md` | DB/Redis plan reference |

---

## 22. Validation Performed

| Validation | Result |
|------------|--------|
| Evidence review against runbook expectations | PASS WITH VERSION DEVIATION |
| PostgreSQL installation and service verification | PASS |
| Redis installation and service verification | PASS WITH VERSION DEVIATION |
| Network/firewall safety review | PASS |
| Credential safety review | PASS |
| Non-goal verification | PASS |
| Secret disclosure review | CLEAN |
| Snapshot verification | Available |
| Governance file updates | TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md |

---

## 23. PASS/BLOCKED Verdict

**PASS WITH VERSION DEVIATION.**

PRIVATE-BETA-STAGING-EXECUTION-03 is COMPLETE and LOCKED.

- PostgreSQL: PASS — version 15.18, service online, localhost-only, credentials safe.
- Redis: PASS WITH VERSION DEVIATION — version 8.8.0 (target was 7.x), service active, localhost-only, requirepass configured, unauthenticated ping blocked, authenticated ping passed.
- Firewall: PASS — 22/80/443 only; 5432 and 6379 closed externally.
- Credentials: PASS — no values disclosed.
- Snapshot: Available.
- Non-goals: Confirmed.

---

## 24. Remaining Risks

| Risk | Severity | Owner |
|------|----------|-------|
| Redis 8.8.0 compatibility with `ioredis`, BullMQ, and app Redis usage unknown | Medium | Must verify before app service startup in EXECUTION-04 |
| App `.env` not yet created — app cannot start until env is prepared | Expected | EXECUTION-04 scope |
| Repo not yet cloned | Expected | EXECUTION-04 scope |
| Migrations not yet run | Expected | Future registered task |
| DNS/TLS not configured | Expected | Future registered task |

---

## 25. Follow-Up Task Recommendation

**Next recommended task:** PRIVATE-BETA-STAGING-EXECUTION-04 — Repo Clone + Private Env Preparation + App Deployment Baseline.

Status: **NEXT RECOMMENDED / NOT YET REGISTERED.**

EXECUTION-04 must be registered before any server action is taken.

---

## 26. Guardrails for STAGING-EXECUTION-04

The following guardrails must be applied when registering and executing EXECUTION-04:

1. **Redis compatibility verification required first.** Before any app service starts: verify Redis 8.8.0 compatibility with app Redis client (`ioredis`) and queue usage (BullMQ), or explicitly decide to pin/downgrade Redis to 7.x before the app uses Redis.

2. **Repo clone path.** Clone repo to `/opt/aisandbox` (or confirm path is still correct at time of registration).

3. **App `.env` created privately on VPS only.** Keith must create and hold DB and Redis passwords privately. Do not paste `DATABASE_URL` or `REDIS_URL` into ChatGPT/Cursor output.

4. **App dependency installation.** Run `npm install` or equivalent after clone.

5. **App build.** Run build if included in registered scope.

6. **App service startup only after explicit registered scope.** Do not start services outside registered scope.

7. **DNS/TLS excluded** unless explicitly included in a future registered task.

8. **Migrations excluded** unless explicitly included and approved in a future registered task.

9. **Kill-switch posture.** Keep billing/payment/AI/container execution kill-switch posture safe until explicitly validated.

10. **Register EXECUTION-04 first.** Keith must explicitly approve registration of EXECUTION-04 before any server action occurs.

---

## 27. No-Go Confirmations

| Confirmation | Result |
|--------------|--------|
| No source code changed | Confirmed |
| No env files opened/created/edited | Confirmed |
| No env values opened/printed | Confirmed |
| No server/SSH/AWS/DNS/TLS action in consolidation step | Confirmed |
| No Docker/PostgreSQL/Redis action locally in consolidation step | Confirmed |
| No git commit or push | Confirmed |
| No subagents used | Confirmed |

---

## 28. Final Lock Statement

PRIVATE-BETA-STAGING-EXECUTION-03 — PostgreSQL + Redis Installation Baseline — is hereby **COMPLETE and LOCKED — 2026-07-24**.

All 4 steps are complete. Evidence verdict is PASS WITH VERSION DEVIATION. Redis 8.8.0 version deviation is formally recorded. Redis compatibility guardrail is required before app service startup. PostgreSQL 15.18 and Redis 8.8.0 are installed, verified, and secured on `aisandbox-staging`. Snapshot `aisandbox-staging-db-redis-2026-07-24` is Available. PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED. Next recommended task is PRIVATE-BETA-STAGING-EXECUTION-04 — not yet registered.

This checkpoint must not be modified except for explicitly approved documentation correction.
