# PRIVATE-BETA-STAGING-EXECUTION-04D — PM2 Health-Only Smoke Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04D  
**Title:** PM2 Service Start + Health-Only Smoke  
**Step:** Evidence Review — PM2 Health-Only Smoke after 04E  
**Date:** 2026-07-27  
**Nature:** Evidence review / documentation only — no SSH — no AWS CLI/actions — no env files opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped — no migrations — no PostgreSQL tables created — no DNS/TLS — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no TASKS/TASKS_BACKLOG_FULL/roadmap changes — no git commit or push — no subagents

---

## 1. Task identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04D |
| Title | PM2 Service Start + Health-Only Smoke |
| Step | Evidence review — PM2 health-only smoke after 04E |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Child slice | 4 of 4 of EXECUTION-04 manual execution split |
| Cleared sibling (migration baseline) | PRIVATE-BETA-STAGING-EXECUTION-04E — COMPLETE and LOCKED — 2026-07-27 |
| Prior blocker children | 04D1 / 04D2 / 04D3 — ACTIVE pending final consolidation |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — PM2 health-only smoke evidence review |
| Risk | HIGH — reviews first successful post-04E app-process health smoke on production-like Lightsail staging |
| Registered | 2026-07-26 |
| Operator evidence date | 2026-07-27 |
| Operator | Keith |
| Execution venue (operator) | AWS Lightsail browser SSH (operator-side; not Cursor) |
| Reviewer | AI — evidence review only |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` |
| 04E checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` |
| 04E evidence review | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-MIGRATION-EXECUTION-EVIDENCE-REVIEW.md` |
| 04D3 decision | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D3-MIGRATION-BOUNDARY-DECISION-REPORT.md` — Outcome A |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## 2. Purpose

Review Keith’s safe 04D PM2 health-only smoke evidence after the 04E migration baseline completed and locked, answer the required review questions, and issue an explicit PASS/FAIL verdict for 04D PM2 health-only smoke evidence.

This Cursor step creates the evidence review report only. It does **not** SSH, use AWS, open env files, start/stop services, run migrations, modify governance/source files, or mark 04D COMPLETE and LOCKED.

---

## 3. Evidence reviewed

### Governance / runbook / prior-review artifacts read

| Artifact | Role |
|----------|------|
| `TASKS.md` | Active ledger — 04D / 04D1 / 04D2 / 04D3 / 04E status |
| `TASKS_BACKLOG_FULL.md` | Backlog authority (targeted) |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Program roadmap context (targeted) |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` | Authoritative 04D health-only smoke runbook |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D1-EVIDENCE-REVIEW.md` | SQLite runtime-path blocker context |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D2-EVIDENCE-REVIEW.md` | Stub-provider StartupGuard blocker context |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D3-MIGRATION-BOUNDARY-DECISION-REPORT.md` | Outcome A — separate migration slice required |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` | 04E COMPLETE and LOCKED prerequisite |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-MIGRATION-EXECUTION-EVIDENCE-REVIEW.md` | 04E migration evidence PASS |

### Operator evidence (Keith — 2026-07-27)

```text
04E prerequisite:
- 04E is COMPLETE and LOCKED — 2026-07-27.
- Migration baseline succeeded.
- Required tables usage_records, billing_snapshots, invoices exist.
- Migration history count after 04E: 25.
- Required table row counts after 04E: 0.
- PM2 services were stopped after 04E.

04D PM2 restart evidence:
PM2 list after service start:
- aisandbox-ai-service online, restarts 0, CPU 0%, memory about 108.4mb
- aisandbox-api-gateway online, restarts 0, CPU 0%, memory about 154.9mb
- aisandbox-container-manager online, restarts 0, CPU 0%, memory about 90.5mb
- aisandbox-frontend online, restarts 0, CPU 0%, memory about 58.2mb
- host CPU about 2.1%, RAM usage about 13.4%

Health-only smoke:
- API_HEALTH=200
- API_DB_HEALTH=200
- API_READY=200
- CONTAINER_HEALTH=200
- FRONTEND_ROOT=307

Final checks:
- git status --short showed no output before pm2 list, treated as clean unless contradicted.
- PM2 final list:
  - aisandbox-ai-service online, restarts 0, CPU 0%, memory about 108.2mb
  - aisandbox-api-gateway online, restarts 0, CPU 0%, memory about 118.2mb
  - aisandbox-container-manager online, restarts 0, CPU 0%, memory about 90.6mb
  - aisandbox-frontend online, restarts 0, CPU 0%, memory about 57.7mb
  - host CPU about 0.6%, RAM usage about 12.7%
- Final public table count: 26
```

### Historical blocker context carried forward

```text
04D1 SQLite runtime path blocker passed: API Gateway progressed past the prior SQLite database path failure.
04D2 provider blocker passed: StartupGuard accepted stub provider in private-beta health-only mode when GLOBAL_EXECUTION_ENABLED=false.
04D3 decided separate migration slice was required.
04E completed the migration baseline and cleared required-table blocker.
```

**Evidence type:** User-provided safe evidence — treated as authoritative for this review. No secrets, passwords, connection strings, private keys, or `.env` values were present in the supplied evidence.

**Not used as evidence:** `.env` files, env values, AWS CLI output generated by Cursor, credentials, secret-bearing files, live database queries from Cursor, PM2/runtime actions from Cursor.

---

## 4. Prerequisite status

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| 04E COMPLETE and LOCKED | Yes — 2026-07-27 (checkpoint + operator evidence) | Required before 04D resume | PASS |
| Migration baseline succeeded | Yes | Required | PASS |
| Required tables present | `usage_records`, `billing_snapshots`, `invoices` | Present after 04E | PASS |
| Migration history count after 04E | `25` | Matches 04E locked evidence | PASS |
| Required table row counts after 04E | `0` | Clean staging baseline | PASS |
| PM2 stopped after 04E | Yes — services were stopped | Controlled restart precondition | PASS |

**Prerequisite status conclusion:** 04E was complete and locked before 04D resumed. Migration-schema blocker was cleared. Controlled PM2 restart was appropriate.

---

## 5. PM2 startup verification

| Process | Evidence after start | Expected | Verdict |
|---------|----------------------|----------|---------|
| `aisandbox-api-gateway` | online | online | PASS |
| `aisandbox-ai-service` | online | online | PASS |
| `aisandbox-container-manager` | online | online | PASS |
| `aisandbox-frontend` | online | online | PASS |

**PM2 startup verification conclusion:** PM2 started all four scoped services:

* `aisandbox-api-gateway`
* `aisandbox-ai-service`
* `aisandbox-container-manager`
* `aisandbox-frontend`

**Review question 1 — Did PM2 start all four scoped services?**  
**Yes.**

---

## 6. Restart/stability verification

| Process | Restarts | CPU | Verdict |
|---------|----------|-----|---------|
| `aisandbox-ai-service` | 0 | 0% | PASS |
| `aisandbox-api-gateway` | 0 | 0% | PASS |
| `aisandbox-container-manager` | 0 | 0% | PASS |
| `aisandbox-frontend` | 0 | 0% | PASS |

Host after start: CPU about `2.1%`, RAM about `13.4%` — no host thrash signal.

**Restart/stability verification conclusion:** All four services were online with restart count `0`. API Gateway CPU was not stuck at 100% (contrast with prior 04D1/04D2 restart-loop evidence).

**Review question 2 — Did all four services remain online with restart count 0?**  
**Yes.**

---

## 7. API Gateway health verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `API_HEALTH` | `200` | `200` | PASS |
| Restart loop / SQLite blocker recurrence | Not indicated; restarts `0`, CPU `0%` | Must not recur | PASS |
| Stub-provider StartupGuard blocker recurrence | Not indicated; process online + health `200` | Must not recur | PASS |
| Required-table StartupGuard blocker recurrence | Not indicated; process online + ready `200` | Must not recur after 04E | PASS |

**API Gateway health verification conclusion:** API health returned `200`. Historical SQLite, stub-provider, and required-table blockers did not recur in supplied evidence.

**Review questions 3–6:**

3. Did API Gateway avoid the old SQLite restart-loop blocker? **Yes.**  
4. Did API Gateway avoid the old stub-provider StartupGuard blocker? **Yes.**  
5. Did API Gateway avoid the required-table StartupGuard blocker after 04E? **Yes.**  
6. Did API health return 200? **Yes** — `API_HEALTH=200`.

---

## 8. API DB health verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `API_DB_HEALTH` | `200` | `200` | PASS |

**API DB health verification conclusion:** API DB health returned `200`.

**Review question 7 — Did API DB health return 200?**  
**Yes** — `API_DB_HEALTH=200`.

---

## 9. API ready verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `API_READY` | `200` | `200` after 04E schema baseline | PASS |

**API ready verification conclusion:** API ready returned `200`.

**Review question 8 — Did API ready return 200?**  
**Yes** — `API_READY=200`.

---

## 10. Container Manager health verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `CONTAINER_HEALTH` | `200` | `200` | PASS |

**Container Manager health verification conclusion:** Container Manager health returned `200`.

**Review question 9 — Did Container Manager health return 200?**  
**Yes** — `CONTAINER_HEALTH=200`.

---

## 11. Frontend root verification

| Check | Evidence | Expected / acceptable | Verdict |
|-------|----------|------------------------|---------|
| `FRONTEND_ROOT` | `307` | Acceptable 2xx/3xx; locale redirect allowed | PASS |

**Frontend root verification conclusion:** Frontend root returned `307`. Treat `307` as acceptable because frontend root can redirect to a locale route.

**Review questions 10–11:**

10. Did frontend root return an acceptable 2xx/3xx status? **Yes** — `FRONTEND_ROOT=307`.  
11. Is `FRONTEND_ROOT=307` acceptable as a locale redirect? **Yes.**

---

## 12. Final PM2 verification

| Process | Final state | Restarts | CPU | Verdict |
|---------|-------------|----------|-----|---------|
| `aisandbox-ai-service` | online | 0 | 0% | PASS |
| `aisandbox-api-gateway` | online | 0 | 0% | PASS |
| `aisandbox-container-manager` | online | 0 | 0% | PASS |
| `aisandbox-frontend` | online | 0 | 0% | PASS |

Host final: CPU about `0.6%`, RAM about `12.7%`.

**Final PM2 verification conclusion:** Final PM2 state remained stable — all four online, restart count `0`, no CPU thrash.

**Review question 12 — Did final PM2 state remain stable?**  
**Yes.**

---

## 13. Database final state

| Check | Evidence | Interpretation | Verdict |
|-------|----------|----------------|---------|
| Final public table count | `26` | Matches post-04E full schema baseline (26 public tables recorded in 04E checkpoint) | PASS |
| Migrations during 04D resume | No evidence | 04D must not migrate; count stable vs 04E baseline | PASS |
| Migration history after 04E | `25` (prerequisite) | Unchanged implication for 04D smoke | PASS |

**Database final-state verification conclusion:** Final public table count was recorded as `26`. No evidence of migrations during 04D resume.

**Review questions 13 / 15:**

13. Was final DB table count recorded? **Yes** — `26`.  
15. Was there any evidence of migrations during 04D? **No.**

---

## 14. Git state

| Check | Evidence | Verdict |
|-------|----------|---------|
| `git status --short` | No output shown; treated as clean unless contradicted | PASS |

**Git state conclusion:** `git status --short` showed no output in supplied evidence, so treat as clean unless contradicted.

**Review question 14 — Was git status clean based on no output?**  
**Yes** — treated as clean unless contradicted.

---

## 15. Secret-safety verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `.env` contents printed | No | Must not print | PASS |
| `DATABASE_URL` / `REDIS_URL` printed | No | Must not print | PASS |
| Passwords / keys / tokens / provider secrets printed | No | Must not print | PASS |
| Safe summary evidence only | Yes — PM2 names/status/restarts/CPU/memory, HTTP statuses, table count | Safe evidence only | PASS |

**Secret-safety verification conclusion:** No `.env` values or secrets were printed in the supplied evidence.

**Review question 21 — Was any secret or `.env` value printed?**  
**No.**

---

## 16. Non-goal verification

| Non-goal | Evidence of occurrence? | Verdict |
|----------|-------------------------|---------|
| Migrations during 04D | No | PASS — none |
| DNS/TLS configuration | No | PASS — none |
| AI execution | No | PASS — none |
| Billing/payment execution | No | PASS — none |
| Container execution beyond starting Container Manager + health endpoint | No | PASS — none |
| Google OAuth enablement | No | PASS — none |

**Non-goal verification conclusion:** No migrations were run during 04D resume evidence. No DNS/TLS, AI execution, billing/payment execution, container execution, or Google OAuth enablement occurred in supplied evidence.

**Review questions 15–20:**

15. Migrations during 04D? **No.**  
16. DNS/TLS configuration? **No.**  
17. AI execution? **No.**  
18. Billing/payment execution? **No.**  
19. Container execution beyond CM start + health? **No.**  
20. Google OAuth enablement? **No.**

---

## 17. Historical blocker clearance

| Historical blocker | Status in this evidence | Verdict |
|--------------------|-------------------------|---------|
| 04D1 SQLite runtime path | Passed — API Gateway online, restarts `0`, not in 100% CPU restart loop | CLEARED in smoke evidence |
| 04D2 stub-provider StartupGuard | Passed — API Gateway online; health/db/ready all `200` under health-only stub policy | CLEARED in smoke evidence |
| 04D3 / required-table StartupGuard | Cleared by 04E COMPLETE and LOCKED; confirmed by `API_READY=200` after resume | CLEARED |
| 04E migration baseline | COMPLETE and LOCKED — 2026-07-27 before 04D resume | CLEARED / LOCKED |

**Historical blocker clearance conclusion:**

* 04D1 SQLite runtime path blocker passed.
* 04D2 provider blocker passed.
* 04D3 decided separate migration slice was required.
* 04E completed the migration baseline and cleared the required-table blocker.
* Post-04E 04D health-only smoke evidence shows those blockers did not recur.

Note: 04D1 / 04D2 / 04D3 remain **ACTIVE pending final consolidation** as governance items even though their operational blockers are cleared in smoke evidence.

---

## 18. Verdict

```text
PASS
```

**Review question 22 — Is 04D PM2 health-only smoke evidence sufficient for PASS?**  
**Yes.**

No contradiction was found between Keith’s supplied evidence and the 04D runbook expectations for post-04E health-only smoke success.

---

## 19. Rationale

1. 04E was complete and locked before 04D resumed.
2. PM2 started all four scoped services: `aisandbox-api-gateway`, `aisandbox-ai-service`, `aisandbox-container-manager`, `aisandbox-frontend`.
3. All four services were online.
4. Restart count was `0` for all four services.
5. API Gateway CPU was not stuck at 100%.
6. API health checks: `API_HEALTH=200`, `API_DB_HEALTH=200`, `API_READY=200`.
7. Container health: `CONTAINER_HEALTH=200`.
8. Frontend: `FRONTEND_ROOT=307` — treat as acceptable locale redirect.
9. Final public table count: `26`.
10. `git status --short` showed no output in supplied evidence, so treat as clean unless contradicted.
11. No `.env` values or secrets were printed in supplied evidence.
12. No migrations were run during 04D resume evidence.
13. No DNS/TLS, AI execution, billing/payment execution, container execution, or Google OAuth enablement occurred in supplied evidence.
14. Therefore **04D PM2 health-only smoke evidence is PASS**.

---

## 20. Residual risks

| Residual risk | Notes |
|---------------|-------|
| PM2 runtime not yet persisted | Runtime is running but not yet persisted with `pm2 save` or systemd startup; that should remain a later explicitly scoped step |
| Public DNS/TLS still not configured | Health smoke used local process health only; public hostname/TLS remain deferred |
| Browser/user-facing smoke not covered | This health-only smoke does not prove login/register/workspace/browser flows |
| AI / billing / container / OAuth remain deferred | Intentionally disabled/deferred; not validated beyond health-only boundaries |
| 04D1 / 04D2 / 04D3 need final consolidation | Operational blockers cleared; governance consolidation still pending |
| PRIVATE-BETA-DEPLOYMENT-READINESS remains blocked | Deployment readiness must not advance from this PASS alone |
| Operator evidence is summary-level | Full curl command lines / PM2 describe dumps were not pasted; status codes + PM2 online/restarts-0 are accepted as sufficient for PASS |
| Table-count nuance vs original 04D runbook text | Original runbook expected table count `0` before 04E; post-04E count `26` is expected and consistent with locked 04E baseline |

---

## 21. What remains blocked

**Review question 23 — What remains blocked?**

* Marking **04D COMPLETE and LOCKED** until consolidation/checkpoint completes.
* Final consolidation of **04D1 / 04D2 / 04D3**.
* Parent **PRIVATE-BETA-STAGING-EXECUTION-04** completion.
* Public **DNS/TLS** configuration.
* Browser/user-facing smoke beyond health-only checks.
* **AI execution** enablement.
* **Billing/payment** execution enablement.
* **Container execution** workflows beyond Container Manager process start + health endpoint.
* **Google OAuth** enablement.
* Advancing **PRIVATE-BETA-DEPLOYMENT-READINESS** (remains **BLOCKED / PAUSED**).
* Persisting PM2 with `pm2 save` / systemd startup (later explicitly scoped step).

---

## 22. Exact next recommended action

**Review question 24 — What is the exact next recommended action?**

```text
PRIVATE-BETA-STAGING-EXECUTION-04D Step 4 — Consolidation / Checkpoint
```

Create/update the 04D checkpoint and mirror governance status so 04D can be locked after this PASS evidence review. Also plan final consolidation of 04D1 / 04D2 / 04D3 as staged recovery governance items. Keep `PRIVATE-BETA-DEPLOYMENT-READINESS` **BLOCKED / PAUSED**. Do not configure DNS/TLS. Do not enable AI/billing/container/OAuth execution.

---

## Required review questions — answer summary

| # | Question | Answer |
|---|----------|--------|
| 1 | Did PM2 start all four scoped services? | **Yes** |
| 2 | Did all four services remain online with restart count 0? | **Yes** |
| 3 | Did API Gateway avoid the old SQLite restart-loop blocker? | **Yes** |
| 4 | Did API Gateway avoid the old stub-provider StartupGuard blocker? | **Yes** |
| 5 | Did API Gateway avoid the required-table StartupGuard blocker after 04E? | **Yes** |
| 6 | Did API health return 200? | **Yes** — `API_HEALTH=200` |
| 7 | Did API DB health return 200? | **Yes** — `API_DB_HEALTH=200` |
| 8 | Did API ready return 200? | **Yes** — `API_READY=200` |
| 9 | Did Container Manager health return 200? | **Yes** — `CONTAINER_HEALTH=200` |
| 10 | Did frontend root return an acceptable 2xx/3xx status? | **Yes** — `307` |
| 11 | Is `FRONTEND_ROOT=307` acceptable as a locale redirect? | **Yes** |
| 12 | Did final PM2 state remain stable? | **Yes** |
| 13 | Was final DB table count recorded? | **Yes** — `26` |
| 14 | Was git status clean based on no output? | **Yes** — treated as clean unless contradicted |
| 15 | Was there any evidence of migrations during 04D? | **No** |
| 16 | Was there any evidence of DNS/TLS configuration? | **No** |
| 17 | Was there any evidence of AI execution? | **No** |
| 18 | Was there any evidence of billing/payment execution? | **No** |
| 19 | Was there any evidence of container execution beyond CM start + health? | **No** |
| 20 | Was there any evidence of Google OAuth enablement? | **No** |
| 21 | Was any secret or `.env` value printed? | **No** |
| 22 | Is 04D PM2 health-only smoke evidence sufficient for PASS? | **Yes** — verdict **PASS** |
| 23 | What remains blocked? | 04D lock pending consolidation; 04D1/04D2/04D3 consolidation; DNS/TLS; browser smoke; AI/billing/container/OAuth; deployment readiness; PM2 persistence |
| 24 | Exact next recommended action? | **04D Step 4 — Consolidation / Checkpoint** |

---

## Validation checklist for this review step

| Check | Result |
|-------|--------|
| Evidence review file exists | Yes — this file |
| Verdict explicit | **PASS** |
| All health statuses recorded | Yes — API 200 / DB 200 / ready 200 / container 200 / frontend 307 |
| PM2 all-online / restarts-0 recorded | Yes |
| `FRONTEND_ROOT=307` interpreted correctly | Yes — acceptable locale redirect |
| Secret-safety conclusion recorded | Yes |
| Non-goal conclusion recorded | Yes |
| Historical blocker clearance recorded | Yes |
| TASKS / TASKS_BACKLOG_FULL / roadmap changed | No |
| Source files changed | No |
| Migration files changed | No |
| Env files opened/created/edited | No |
| Env values printed | No |
| Migrations run by Cursor | No |
| PostgreSQL tables created by Cursor | No |
| Runtime/server action by Cursor | No |
| Docker/PostgreSQL/Redis action by Cursor | No |
| Git commit or push | No |
| Subagents used | No |

---

**End of evidence review.**
