# PRIVATE-BETA-STAGING-EXECUTION-04F1 — PM2 systemd Adoption Recovery Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04F1  
**Title:** PM2 systemd Adoption Recovery  
**Step:** 4 — PM2 systemd Adoption Recovery Evidence Review  
**Date:** 2026-07-29  
**Nature:** Evidence review / documentation only — no SSH — no AWS CLI/actions — no `pm2 save` / `pm2 startup` / `pm2 kill` / systemd / reboot executed in Cursor — no env files opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped — no migrations — no PostgreSQL tables created — no DNS/TLS — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no TASKS/TASKS_BACKLOG_FULL/roadmap changes — no git commit or push — no subagents

---

## 1. Task identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04F1 |
| Title | PM2 systemd Adoption Recovery |
| Step | 4 — PM2 systemd Adoption Recovery Evidence Review |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04F (ACTIVE / BLOCKED by 04F1) |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 (ACTIVE) |
| Predecessors | PRIVATE-BETA-STAGING-EXECUTION-04D COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04E COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04F Step 3 partial success — 2026-07-29 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL BLOCKER |
| Nature | REAL STAGING EXECUTION — recover systemd ownership of PM2 daemon after PID/protocol adoption failure |
| Risk | HIGH — recovery temporarily interrupted the four app processes (`pm2 kill`); reviewed from operator evidence only |
| Registered | 2026-07-29 |
| Step 1 | COMPLETE (Registration — 2026-07-29) |
| Step 2 | COMPLETE (Runbook — `docs/PRIVATE-BETA-STAGING-EXECUTION-04F1-PM2-SYSTEMD-ADOPTION-RECOVERY-RUNBOOK.md`) |
| Step 3 | COMPLETE (Manual recovery + evidence — Keith, AWS Lightsail browser SSH) |
| Current step | Step 4 — this evidence review |
| Operator | Keith |
| Execution venue (operator) | AWS Lightsail browser SSH (operator-side; not Cursor) |
| Reviewer | AI — evidence review only |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F1-PM2-SYSTEMD-ADOPTION-RECOVERY-RUNBOOK.md` |
| Parent 04F runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-PM2-PERSISTENCE-RUNBOOK.md` |
| 04D checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-CHECKPOINT.md` |
| 04E checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F1-CHECKPOINT.md` |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

### Authoritative state carried forward

* 04F1 is ACTIVE — Steps 1–3 COMPLETE; this is Step 4 evidence review.
* 04F is ACTIVE / BLOCKED by 04F1 until 04F1 is locked.
* 04D is COMPLETE and LOCKED — 2026-07-27.
* 04E is COMPLETE and LOCKED — 2026-07-27.
* Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 2. Purpose

Review Keith’s safe 04F1 PM2 systemd adoption recovery evidence after the controlled recovery cleared the `pm2-ubuntu.service` `Result=protocol` blocker, answer the required review questions, and issue an explicit PASS/FAIL verdict for 04F1 recovery evidence.

This Cursor step creates the evidence review report only. It does **not** SSH, use AWS, open env files, run `pm2 save` / `pm2 kill` / `pm2 startup`, run systemd commands, reboot, start/stop services, run migrations, modify governance/source files, or mark 04F1 COMPLETE and LOCKED.

---

## 3. Evidence reviewed

### Governance / runbook / prior artifacts read

| Artifact | Role |
|----------|------|
| `TASKS.md` | Active ledger — 04F / 04F1 / 04D / 04E status (targeted) |
| `TASKS_BACKLOG_FULL.md` | Backlog authority (targeted) |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Program roadmap context (targeted) |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04F1-PM2-SYSTEMD-ADOPTION-RECOVERY-RUNBOOK.md` | Authoritative 04F1 recovery runbook |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-PM2-PERSISTENCE-RUNBOOK.md` | Parent 04F persistence runbook / blocker context |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-CHECKPOINT.md` | 04D COMPLETE and LOCKED — health-only smoke baseline |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` | 04E COMPLETE and LOCKED — migration baseline |

### Operator evidence (Keith — 2026-07-29)

```text
Pre-recovery:
- pm2 ping returned pong.
- PM2_DUMP_PRESENT=yes.
- dump path existed: /home/ubuntu/.pm2/dump.pm2.
- all four app processes were online and restarts 0 before recovery:
  - aisandbox-api-gateway=ok count=1 status=online restarts=0
  - aisandbox-ai-service=ok count=1 status=online restarts=0
  - aisandbox-container-manager=ok count=1 status=online restarts=0
  - aisandbox-frontend=ok count=1 status=online restarts=0
- pm2-ubuntu was failed before recovery:
  - ActiveState=failed
  - SubState=failed
  - Result=protocol
  - MainPID=0
  - Type=forking
  - PIDFile=/home/ubuntu/.pm2/pm2.pid

Recovery:
- Keith approved runtime-impacting recovery.
- pm2 save succeeded:
  - PM2_RESAVE_EXIT=0
  - dump saved in /home/ubuntu/.pm2/dump.pm2
- sudo systemctl reset-failed pm2-ubuntu ran.
- pm2 kill stopped all PM2-managed apps and PM2 daemon temporarily.
- sudo systemctl start pm2-ubuntu ran.
- systemd resurrected PM2 from saved dump.

Post-recovery systemd:
- systemctl is-enabled pm2-ubuntu = enabled
- systemctl is-active pm2-ubuntu = active
- Type=forking
- Restart=on-failure
- PIDFile=/home/ubuntu/.pm2/pm2.pid
- MainPID=87688
- Result=success
- User=ubuntu
- ActiveState=active
- SubState=running
- status showed: Started pm2-ubuntu.service - PM2 process manager.
- CGroup showed PM2 daemon and app child processes.

Post-recovery PM2:
- pm2 ping returned pong.
- PM2_DUMP_PRESENT=yes.
- all four app processes online:
  - aisandbox-api-gateway=ok count=1 status=online restarts=0
  - aisandbox-ai-service=ok count=1 status=online restarts=0
  - aisandbox-container-manager=ok count=1 status=online restarts=0
  - aisandbox-frontend=ok count=1 status=online restarts=0

Health:
- API_HEALTH=200
- API_DB_HEALTH=200
- API_READY=200
- CONTAINER_HEALTH=200
- FRONTEND_ROOT=307

Final safe state:
- git status --short showed no output, treated as clean unless contradicted.
- public table count: 26
- systemctl is-enabled pm2-ubuntu: enabled
- systemctl is-active pm2-ubuntu: active
- no reboot occurred.
- no `.env` values or secrets were printed.
- no DNS/TLS action occurred.
- no AI execution occurred.
- no billing/payment execution occurred.
- no container workflow occurred beyond Container Manager health check.
- no Google OAuth enablement occurred.
```

### Original blocker context carried forward

```text
04F1 existed because pm2-ubuntu.service was enabled but failed to become active with Result=protocol while PM2 apps and PM2 dump remained healthy. Earlier logs showed systemd/PID adoption failure and repeated protocol failure. The controlled recovery cleared that blocker.
```

Earlier failure evidence (from 04F Step 3 / 04F1 runbook) showed `pm2-ubuntu.service` failed with `Result=protocol` while PM2 restored apps from dump and then systemd refused PID adoption / PIDFile handling (`New main PID does not belong to service` / `PID file is not owned by root` / `Can't open PID file /home/ubuntu/.pm2/pm2.pid after start`).

**Evidence type:** User-provided safe evidence — treated as authoritative for this review. No secrets, passwords, connection strings, private keys, or `.env` values were present in the supplied evidence.

**Not used as evidence:** `.env` files, env values, AWS CLI output generated by Cursor, credentials, secret-bearing files, live database queries from Cursor, PM2/runtime/systemd actions from Cursor.

**Contradiction check:** No contradiction found between Keith’s recovery evidence and the 04F1 runbook expected final state. Verdict remains eligible for PASS.

---

## 4. Pre-recovery state

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `pm2 ping` | `pong` | `pong` | PASS |
| `PM2_DUMP_PRESENT` | `yes` | `yes` before any daemon stop | PASS |
| Dump path | `/home/ubuntu/.pm2/dump.pm2` existed | Present | PASS |
| `aisandbox-api-gateway` | `ok` count=1 status=online restarts=0 | Prefer online | PASS |
| `aisandbox-ai-service` | `ok` count=1 status=online restarts=0 | Prefer online | PASS |
| `aisandbox-container-manager` | `ok` count=1 status=online restarts=0 | Prefer online | PASS |
| `aisandbox-frontend` | `ok` count=1 status=online restarts=0 | Prefer online | PASS |
| `pm2-ubuntu` ActiveState | `failed` | Failed / protocol blocker present | PASS (blocker confirmed) |
| `pm2-ubuntu` SubState | `failed` | Failed | PASS (blocker confirmed) |
| `pm2-ubuntu` Result | `protocol` | `Result=protocol` | PASS (blocker confirmed) |
| MainPID | `0` | Consistent with failed unit | PASS (recorded) |
| Type | `forking` | forking | PASS (recorded) |
| PIDFile | `/home/ubuntu/.pm2/pm2.pid` | Expected path | PASS (recorded) |

**Pre-recovery state conclusion:**

* PM2 dump was present before recovery.
* All four app processes were present and online before recovery.
* The pre-recovery blocker was confirmed as `pm2-ubuntu` `Result=protocol` (`ActiveState=failed`, `SubState=failed`).

**Review questions 1–3:**

1. Was the PM2 dump present before recovery? **Yes** — `PM2_DUMP_PRESENT=yes`; path `/home/ubuntu/.pm2/dump.pm2`.  
2. Were all four app processes present before recovery? **Yes** — all four `=ok` with `count=1` `status=online` `restarts=0`.  
3. Was the pre-recovery blocker confirmed as pm2-ubuntu `Result=protocol`? **Yes** — `Result=protocol`, `ActiveState=failed`, `SubState=failed`.

---

## 5. Recovery approval

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| Runtime-impacting recovery approval | Keith approved runtime-impacting recovery | Explicit Keith approval required before `pm2 kill` path | PASS |

**Recovery approval conclusion:** Keith explicitly approved runtime-impacting recovery before the controlled recovery path.

**Review question 4 — Was runtime-impacting recovery explicitly approved by Keith?**  
**Yes.**

---

## 6. Recovery command/result

| Step | Evidence | Expected | Verdict |
|------|----------|----------|---------|
| `pm2 save` / re-save | `PM2_RESAVE_EXIT=0`; dump saved in `/home/ubuntu/.pm2/dump.pm2` | Exit `0`; dump refreshed | PASS |
| `sudo systemctl reset-failed pm2-ubuntu` | Ran | Allowed after approval | PASS |
| `pm2 kill` | Stopped all PM2-managed apps and PM2 daemon temporarily | Temporary stop expected | PASS |
| `sudo systemctl start pm2-ubuntu` | Ran; systemd resurrected PM2 from saved dump | systemd owns PM2 and resurrects | PASS |

**Recovery command/result conclusion:**

* `PM2_RESAVE_EXIT=0`.
* `pm2 kill` temporarily stopped PM2-managed apps as expected.
* systemd start of `pm2-ubuntu` proceeded and resurrected PM2 from the saved dump.

**Review questions 5–6:**

5. Did `pm2 save` / re-save succeed? **Yes** — `PM2_RESAVE_EXIT=0`.  
6. Did `pm2 kill` temporarily stop PM2-managed apps as expected? **Yes.**

---

## 7. systemd verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `systemctl is-enabled pm2-ubuntu` | `enabled` | `enabled` | PASS |
| `systemctl is-active pm2-ubuntu` | `active` | `active` | PASS |
| Type | `forking` | forking | PASS (recorded) |
| Restart | `on-failure` | Recorded | PASS (recorded) |
| PIDFile | `/home/ubuntu/.pm2/pm2.pid` | Expected path | PASS (recorded) |
| MainPID | `87688` | Non-zero after successful start | PASS |
| Result | `success` | Not `protocol`; success | PASS |
| User | `ubuntu` | ubuntu | PASS (recorded) |
| ActiveState | `active` | `active` | PASS |
| SubState | `running` | `running` | PASS |
| Status summary | `Started pm2-ubuntu.service - PM2 process manager.` | Service started | PASS |
| CGroup | PM2 daemon and app child processes shown | systemd ownership of daemon + children | PASS |

**systemd verification conclusion:**

* `pm2-ubuntu` is now enabled.
* `pm2-ubuntu` is now active.
* systemd result is now `success` (prior `Result=protocol` cleared).
* systemd successfully started `pm2-ubuntu` after recovery.

**Review questions 7–9:**

7. Did systemd start `pm2-ubuntu` successfully after recovery? **Yes** — `active` / `Result=success` / MainPID=`87688`.  
8. Is `pm2-ubuntu` now enabled? **Yes.**  
9. Is `pm2-ubuntu` now active? **Yes.**

---

## 8. PM2 verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `pm2 ping` | `pong` | `pong` | PASS |
| `PM2_DUMP_PRESENT` | `yes` | `yes` after recovery | PASS |
| `aisandbox-api-gateway` | `ok` count=1 status=online restarts=0 | online / ok | PASS |
| `aisandbox-ai-service` | `ok` count=1 status=online restarts=0 | online / ok | PASS |
| `aisandbox-container-manager` | `ok` count=1 status=online restarts=0 | online / ok | PASS |
| `aisandbox-frontend` | `ok` count=1 status=online restarts=0 | online / ok | PASS |

**PM2 verification conclusion:**

* PM2 responds with `pong`.
* PM2 dump remains present.
* All four apps are online:
  * `aisandbox-api-gateway`
  * `aisandbox-ai-service`
  * `aisandbox-container-manager`
  * `aisandbox-frontend`
* All four app process checks returned `ok`.

**Review questions 10–12:**

10. Did PM2 respond after recovery? **Yes** — `pong`.  
11. Does PM2 dump remain present after recovery? **Yes** — `PM2_DUMP_PRESENT=yes`.  
12. Did all four app processes return online? **Yes** — all four `=ok` / `status=online`.

---

## 9. Health verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `API_HEALTH` | `200` | `200` | PASS |
| `API_DB_HEALTH` | `200` | `200` | PASS |
| `API_READY` | `200` | `200` | PASS |
| `CONTAINER_HEALTH` | `200` | `200` | PASS |
| `FRONTEND_ROOT` | `307` | `2xx` or `3xx` (307 locale redirect acceptable) | PASS |

**Health verification conclusion:**

* Health-only smoke passed:
  * `API_HEALTH=200`
  * `API_DB_HEALTH=200`
  * `API_READY=200`
  * `CONTAINER_HEALTH=200`
  * `FRONTEND_ROOT=307`
* Treat `FRONTEND_ROOT=307` as acceptable locale redirect (consistent with 04D locked evidence).

**Review questions 13–14:**

13. Did health-only smoke pass after recovery? **Yes.**  
14. Is `FRONTEND_ROOT=307` acceptable as locale redirect? **Yes.**

---

## 10. Final safe state

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `git status --short` | No output; treated as clean unless contradicted | Empty / clean | PASS |
| Public table count | `26` | Present (previously `26`) | PASS |
| `pm2-ubuntu` enabled | `enabled` | `enabled` | PASS |
| `pm2-ubuntu` active | `active` | `active` | PASS |
| Reboot | No reboot occurred | No reboot in default 04F1 | PASS |

**Final safe-state conclusion:**

* Final public table count is `26`.
* `git status` showed no output, treated as clean unless contradicted.
* No reboot occurred.
* `pm2-ubuntu` remains enabled and active in the final safe state.

**Review questions 15–17:**

15. Was final public table count recorded? **Yes** — `26`.  
16. Was git status clean based on no output? **Yes** — treated as clean unless contradicted.  
17. Was there any reboot? **No.**

---

## 11. Secret-safety verification

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `.env` values / secrets printed | No `.env` values or secrets were printed | Must not print secrets | PASS |
| Secret-bearing content in evidence | None present in supplied evidence | Safe status-only evidence | PASS |

**Secret-safety conclusion:** No `.env` values or secrets were printed. Evidence contains only safe status lines, exit codes, and non-secret summaries.

**Review question 23 — Were any `.env` values or secrets printed?**  
**No.**

---

## 12. Non-goal verification

| Non-goal | Evidence | Verdict |
|----------|----------|---------|
| DNS/TLS action | No DNS/TLS action occurred | PASS — not performed |
| AI execution | No AI execution occurred | PASS — not performed |
| Billing/payment execution | No billing/payment execution occurred | PASS — not performed |
| Container workflow beyond health check | No container workflow beyond Container Manager health check | PASS — not performed |
| Google OAuth enablement | No Google OAuth enablement occurred | PASS — not performed |
| Reboot | No reboot occurred | PASS — not performed |

**Non-goal conclusion:** No DNS/TLS, AI execution, billing/payment execution, container workflow beyond health check, or Google OAuth enablement occurred.

**Review questions 18–22:**

18. Was there any DNS/TLS action? **No.**  
19. Was there any AI execution? **No.**  
20. Was there any billing/payment execution? **No.**  
21. Was there any container workflow beyond health check? **No.**  
22. Was there any Google OAuth enablement? **No.**

---

## 13. Verdict

```text
PASS
```

**Review question 24 — Is 04F1 recovery evidence sufficient for PASS?**  
**Yes.**

---

## 14. Rationale

04F1 recovery evidence is PASS because:

1. Pre-recovery dump was present and all four validated apps were online.
2. Pre-recovery blocker was confirmed as `pm2-ubuntu` failed with `Result=protocol`.
3. Keith explicitly approved runtime-impacting recovery.
4. Controlled recovery matched the runbook path: `pm2 save` (`PM2_RESAVE_EXIT=0`) → `systemctl reset-failed` → `pm2 kill` → `systemctl start pm2-ubuntu`.
5. Post-recovery, `pm2-ubuntu` is `enabled` and `active` with `Result=success` (prior protocol failure cleared).
6. PM2 responds (`pong`), dump remains present, and all four apps returned `ok` / online.
7. Health-only smoke passed, including acceptable `FRONTEND_ROOT=307` locale redirect.
8. Final safe state recorded table count `26`, clean git status (no output), and no reboot.
9. Secret-safety and non-goal boundaries were respected.
10. No contradiction was found in the supplied evidence relative to the 04F1 runbook expected final state.

The original 04F1 blocker — systemd enabled but failed to become active with `Result=protocol` while PM2 apps/dump remained healthy — is cleared by this recovery evidence.

---

## 15. Residual risks

* Reboot validation has not been performed.
* PM2/systemd boot persistence is active but not yet reboot-proven.
* Public DNS/TLS are still not configured.
* Browser/user-facing smoke is not covered here.
* AI execution, billing/payment execution, container execution workflows, and Google OAuth remain intentionally disabled/deferred.
* 04F still needs final evidence review/consolidation after 04F1 is locked.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains blocked.

---

## 16. What remains blocked

**Review question 25 — What remains blocked?**

* PRIVATE-BETA-STAGING-EXECUTION-04F remains ACTIVE / BLOCKED by 04F1 until 04F1 is consolidated and locked.
* Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE (full app deployment / public staging path not complete).
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.
* Reboot-proven PM2/systemd boot persistence is not yet validated.
* Public DNS/TLS, browser/user-facing smoke, AI execution, billing/payment execution, container execution workflows, and Google OAuth remain out of scope / deferred.

04F1 recovery evidence itself is PASS; remaining blocks are downstream governance and non-goals, not a contradiction of this recovery.

---

## 17. Exact next recommended action

**Review question 26 — What is the exact next recommended action?**

```text
PRIVATE-BETA-STAGING-EXECUTION-04F1 Consolidation / Checkpoint — lock 04F1 after this PASS evidence review
```

After 04F1 is COMPLETE and LOCKED, resume parent 04F for final PM2 persistence evidence review / consolidation (still without default reboot unless separately approved). Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.

---

## Required conclusions checklist

* PM2 dump was present before recovery.
* The pre-recovery blocker was `pm2-ubuntu.service` failed with `Result=protocol`.
* Keith explicitly approved runtime-impacting recovery.
* `PM2_RESAVE_EXIT=0`.
* `pm2 kill` temporarily stopped PM2-managed apps as expected.
* `pm2-ubuntu` is now enabled.
* `pm2-ubuntu` is now active.
* systemd result is now `success`.
* PM2 responds with `pong`.
* PM2 dump remains present.
* All four apps are online:
  * `aisandbox-api-gateway`
  * `aisandbox-ai-service`
  * `aisandbox-container-manager`
  * `aisandbox-frontend`
* All four app process checks returned `ok`.
* Health-only smoke passed:
  * `API_HEALTH=200`
  * `API_DB_HEALTH=200`
  * `API_READY=200`
  * `CONTAINER_HEALTH=200`
  * `FRONTEND_ROOT=307`
* Treat `FRONTEND_ROOT=307` as acceptable locale redirect.
* Final public table count is `26`.
* git status showed no output, treated as clean unless contradicted.
* No reboot occurred.
* No `.env` values or secrets were printed.
* No DNS/TLS, AI execution, billing/payment execution, container workflow beyond health check, or Google OAuth enablement occurred.
* 04F1 recovery evidence is PASS.

---

**End of evidence review.**
