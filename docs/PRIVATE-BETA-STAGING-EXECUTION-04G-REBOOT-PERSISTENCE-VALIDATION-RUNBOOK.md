# PRIVATE-BETA-STAGING-EXECUTION-04G — Reboot Persistence Validation Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04G  
**Title:** Reboot Persistence Validation  
**Step:** 2 — Reboot Persistence Validation Runbook  
**Date:** 2026-07-29  
**Nature:** Runbook for Keith manual execution inside AWS Lightsail browser SSH. Documentation/runbook creation only in Cursor. No SSH/AWS action in Cursor. No reboot / `pm2 save` / `pm2 startup` / `pm2 kill` / systemd executed in Cursor. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## 1. Task identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04G |
| Title | Reboot Persistence Validation |
| Step | 2 — Reboot Persistence Validation Runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessors | PRIVATE-BETA-STAGING-EXECUTION-04F COMPLETE and LOCKED — 2026-07-29; PRIVATE-BETA-STAGING-EXECUTION-04F1 COMPLETE and LOCKED — 2026-07-29; PRIVATE-BETA-STAGING-EXECUTION-04D COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04E COMPLETE and LOCKED — 2026-07-27 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — reboot persistence validation (runbook now; manual reboot + post-reboot verification later) |
| Risk | HIGH — controlled instance reboot interrupts staging runtime and browser SSH; incorrect recovery after failure can widen scope |
| Registered | 2026-07-29 |
| Step 1 | COMPLETE (Registration — 2026-07-29) |
| Current step | Step 2 — this runbook |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Operator | Keith |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |
| Future evidence review | Later 04G evidence review step (not this document) |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04G-CHECKPOINT.md` (does not exist yet) |
| 04F checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-CHECKPOINT.md` |
| 04F evidence review | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-PM2-PERSISTENCE-EVIDENCE-REVIEW.md` — verdict PASS |
| 04F1 checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F1-CHECKPOINT.md` |
| 04D checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-CHECKPOINT.md` |
| 04E checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

### Authoritative state carried forward

* PRIVATE-BETA-STAGING-EXECUTION-04G is ACTIVE — Step 1 COMPLETE (Registration — 2026-07-29).
* PRIVATE-BETA-STAGING-EXECUTION-04F is COMPLETE and LOCKED — 2026-07-29.
* PRIVATE-BETA-STAGING-EXECUTION-04F1 is COMPLETE and LOCKED — 2026-07-29.
* Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.
* PM2 persistence is systemd-active but not reboot-proven.
* No reboot validation has been performed yet.
* `docs/PRIVATE-BETA-STAGING-EXECUTION-04G-CHECKPOINT.md` does not exist yet.

### Evidence carried forward from 04F / 04F1

```text
04F PM2 persistence evidence:
- PM2_SAVE_EXIT=0.
- PM2 dump present at /home/ubuntu/.pm2/dump.pm2.
- PM2 startup/systemd unit installed for user ubuntu.
- 04F1 cleared initial pm2-ubuntu Result=protocol blocker.
- pm2-ubuntu enabled and active.
- systemd Result=success.
- PM2 ping=pong.
- all four apps online/ok:
  - aisandbox-api-gateway
  - aisandbox-ai-service
  - aisandbox-container-manager
  - aisandbox-frontend
- health-only smoke passed:
  - API_HEALTH=200
  - API_DB_HEALTH=200
  - API_READY=200
  - CONTAINER_HEALTH=200
  - FRONTEND_ROOT=307 accepted as locale redirect
- public table count 26.
- git status clean based on no output.
- no reboot validation performed.
- no secrets printed.
- no DNS/TLS.
- no AI execution.
- no billing/payment execution.
- no container workflow beyond health check.
- no Google OAuth enablement.
```

---

## 2. Purpose

Validate that PM2/systemd boot persistence survives an actual instance reboot and restores the four validated app processes plus health-only smoke on the Lightsail staging VPS.

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the later EXECUTION-04G manual validation step.

This Cursor step creates the runbook only. It does **not** reboot, SSH, use AWS CLI, run `pm2 save` / `pm2 startup` / `pm2 kill`, run systemd commands, open `.env`, print secrets, or start/stop services.

---

## 3. What 04G validates

04G validates reboot persistence only:

1. Pre-reboot systemd/PM2/health/safe-state baseline remains healthy.
2. Keith explicitly approves the controlled reboot.
3. The instance reboots and becomes reachable again through Lightsail browser SSH.
4. After reboot, `pm2-ubuntu` is enabled and active with systemd `Result=success`.
5. After reboot, PM2 dump remains present and PM2 responds with `pong`.
6. After reboot, exactly one of each validated app is online:

   * `aisandbox-api-gateway`
   * `aisandbox-ai-service`
   * `aisandbox-container-manager`
   * `aisandbox-frontend`
7. After reboot, health-only smoke passes on localhost.
8. Public table count remains `26` and git status remains clean unless contradicted.
9. No secrets printed; no DNS/TLS / AI / billing / container-workflow / Google OAuth enablement.
10. Safe evidence is captured for later 04G evidence review.

---

## 4. What 04G does not validate

04G must **not** claim or perform:

* DNS/TLS configuration or public routing validation.
* Caddy public routing.
* Migrations or database table creation.
* `.env` create/edit/print.
* AI execution enablement or AI provider calls.
* Billing/payment execution enablement or checkout.
* Container workflows beyond Container Manager health check.
* Google OAuth enablement.
* Browser/user-facing smoke (login/register/workspace flows).
* PM2 recovery (`pm2 save`, `pm2 startup`, `pm2 kill`, `pm2 delete`, `pm2 unstartup`) unless a separate approved recovery slice exists after failure.
* Manual systemd unit file edits.
* Manual PM2 dump file edits.
* Marking PRIVATE-BETA-DEPLOYMENT-READINESS ready.
* Completing parent PRIVATE-BETA-STAGING-EXECUTION-04.
* Git commit or push.

---

## 5. Preconditions

Before any reboot command:

| Precondition | Required state |
|--------------|----------------|
| 04F | COMPLETE and LOCKED — 2026-07-29 |
| 04F1 | COMPLETE and LOCKED — 2026-07-29 |
| 04D | COMPLETE and LOCKED — 2026-07-27 |
| 04E | COMPLETE and LOCKED — 2026-07-27 |
| 04G Step 1 | COMPLETE (Registration — 2026-07-29) |
| This runbook | Created and reviewed |
| Pre-reboot verification | All Section 9 checks PASS |
| Keith approval | Explicit approval required before `sudo reboot` |
| Access method | AWS Lightsail browser SSH only (not Cursor SSH; not PowerShell unless Keith separately chooses local SSH) |
| PM2 dump | Present at `/home/ubuntu/.pm2/dump.pm2` |
| `pm2-ubuntu` | Enabled and active; systemd Result success |
| Four apps | Online/ok before reboot |
| Health-only smoke | Passes before reboot |
| Public table count | `26` |
| Secrets | No `.env` printing; no secret-bearing commands |
| Parent 04 | Remains ACTIVE |
| Deployment readiness | Remains BLOCKED / PAUSED |

Do not proceed if any precondition is unmet.

---

## 6. Lightsail browser SSH instruction

**All 04G manual execution commands run inside AWS Lightsail browser SSH — not PowerShell, not Cursor terminal, not local Windows shell — unless Keith separately chooses local SSH.**

1. Open AWS Lightsail console for instance `aisandbox-staging` (Singapore / ap-southeast-1).
2. Use the Lightsail **browser SSH** session as user `ubuntu`.
3. Work from `/opt/aisandbox` for baseline and final safe-state checks.
4. Do **not** open or print `/opt/aisandbox/.env`.
5. Do **not** paste secrets into chat, tickets, or evidence.
6. Capture only safe status lines into the evidence template in Section 23.
7. Expect the browser SSH session to disconnect when reboot runs; reconnect after the instance is reachable again.

This Cursor Step 2 does **not** open SSH.

---

## 7. Secret safety rules

Hard rules for all 04G operator actions:

* Do **not** open or print `.env`.
* Do **not** run `env`, `printenv`, `cat .env`, `cat /opt/aisandbox/.env`, `echo $DATABASE_URL`, `echo $REDIS_URL`, or any command that prints secret values.
* Do **not** open, create, or edit `.env`, `.env.local`, `.env.staging`, `.env.production`, credentials, keys, certificates, token files, cookies, session dumps, database dumps, AWS keys, or SSH private keys.
* Do **not** paste secret values into evidence.
* Prefer status-only outputs (`pm2 list`, `systemctl is-enabled`, HTTP status codes, table counts).
* If any command unexpectedly prints secret-bearing content, stop immediately, redact, and do not paste the secret values.

---

## 8. Runtime-impact warning

**Reboot is runtime-impacting.**

* Reboot interrupts the instance and the Lightsail browser SSH connection.
* All four app processes will stop during reboot and must resurrect via systemd/PM2 boot persistence.
* Reboot is the **only** intended runtime-impacting action in 04G.
* No PM2 recovery commands should be run unless post-reboot validation fails and a separate recovery path is approved.
* Do **not** run `pm2 save`.
* Do **not** run `pm2 startup`.
* Do **not** run `pm2 kill`.
* Do **not** run `pm2 delete`.
* Do **not** run `pm2 unstartup`.
* Do **not** manually edit systemd unit files.
* Do **not** manually edit PM2 dump files.
* Do **not** start/stop/restart app services as part of validation (verify only).

---

## 9. Pre-reboot verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**  
**Do not reboot until all pre-reboot checks pass and Keith approval is recorded.**

### Pre-reboot baseline commands

```bash
date
uptime
whoami
hostname
cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
SYSTEMD_PAGER=cat systemctl show pm2-ubuntu -p Type -p ActiveState -p SubState -p Result -p Restart -p MainPID -p PIDFile -p User
test -f /home/ubuntu/.pm2/dump.pm2 && echo "PM2_DUMP_PRESENT=yes" || echo "PM2_DUMP_PRESENT=no"
pm2 ping
pm2 list
```

### Pre-reboot four-process check

```bash
pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const p=JSON.parse(s); for (const name of ['aisandbox-api-gateway','aisandbox-ai-service','aisandbox-container-manager','aisandbox-frontend']) { const rows=p.filter(x=>x.name===name); const r=rows[0]; console.log(name + '=' + (rows.length===1 && r.pm2_env.status==='online' ? 'ok' : 'CHECK') + ' count=' + rows.length + ' status=' + (r?.pm2_env?.status||'missing') + ' restarts=' + (r?.pm2_env?.restart_time ?? 'missing')); } })"
```

### Pre-reboot health checks

```bash
curl -sS -o /dev/null -w "API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

### Expected pre-reboot state

```text
git status --short: no output
public table count: 26
pm2-ubuntu: enabled
pm2-ubuntu: active
systemd Result: success
PM2_DUMP_PRESENT=yes
pm2 ping: pong
all four apps: ok / online
API_HEALTH=200
API_DB_HEALTH=200
API_READY=200
CONTAINER_HEALTH=200
FRONTEND_ROOT=307 or other 2xx/3xx
```

If any expected pre-reboot state fails, **STOP**. Do not reboot. Capture safe evidence and escalate.

---

## 10. Keith approval gate

After pre-reboot verification PASSes, **STOP** and obtain explicit Keith approval before reboot.

```text
STOP. Do not reboot until Keith explicitly approves:

go — approve 04G reboot persistence validation
```

* Do not treat silence, prior 04F/04F1 approval, or this runbook alone as reboot approval.
* Reboot is allowed only after Keith records the explicit approval token above (or equivalent explicit approval of 04G reboot persistence validation).
* If approval is not given, leave the instance running and do not reboot.

---

## 11. Controlled reboot command

**Only for later manual execution after Keith approval.**  
**Not executed by Cursor in this Step 2.**

After:

1. Pre-reboot verification PASSes, and
2. Keith explicitly approves with `go — approve 04G reboot persistence validation`,

run this single controlled reboot command inside AWS Lightsail browser SSH:

```bash
sudo reboot
```

Notes:

* Expect the Lightsail browser SSH session to disconnect immediately or shortly after the command.
* Do not chain recovery commands after reboot in the same disconnected session.
* Do not run any other runtime-impacting command in 04G besides this approved reboot.

---

## 12. Reconnect instruction

* The Lightsail browser SSH session will disconnect during reboot.
* Wait until the instance is reachable again in the AWS Lightsail console.
* Reconnect using **AWS Lightsail browser SSH** after the instance is reachable again.
* Do **not** use PowerShell for these SSH commands unless Keith separately chooses local SSH.
* Do **not** run recovery commands before post-reboot verification.
* Do **not** run `pm2 save`, `pm2 startup`, `pm2 kill`, `pm2 delete`, `pm2 unstartup`, or manual process starts on reconnect.
* Proceed directly to Section 13 post-reboot systemd verification after reconnect.

If reconnect fails, **STOP**. Capture safe evidence of reconnect failure only. Do not attempt destructive recovery.

---

## 13. Post-reboot systemd verification

**Run inside AWS Lightsail browser SSH after reconnect — not PowerShell.**

```bash
date
uptime
whoami
hostname
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
SYSTEMD_PAGER=cat systemctl show pm2-ubuntu -p Type -p ActiveState -p SubState -p Result -p Restart -p MainPID -p PIDFile -p User
SYSTEMD_PAGER=cat systemctl status pm2-ubuntu.service --no-pager -l | head -80
test -f /home/ubuntu/.pm2/dump.pm2 && echo "PM2_DUMP_PRESENT=yes" || echo "PM2_DUMP_PRESENT=no"
pm2 ping
pm2 list
```

Expected:

* `pm2-ubuntu`: enabled
* `pm2-ubuntu`: active
* systemd Result: success
* `PM2_DUMP_PRESENT=yes`
* `pm2 ping`: pong

If systemd/PM2 dump/ping expectations fail, **STOP**. Do not recover in this slice. Capture safe evidence and escalate to a separate recovery slice.

---

## 14. Post-reboot PM2 verification

**Run inside AWS Lightsail browser SSH after reconnect — not PowerShell.**

### Post-reboot four-process check

```bash
pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const p=JSON.parse(s); for (const name of ['aisandbox-api-gateway','aisandbox-ai-service','aisandbox-container-manager','aisandbox-frontend']) { const rows=p.filter(x=>x.name===name); const r=rows[0]; console.log(name + '=' + (rows.length===1 && r.pm2_env.status==='online' ? 'ok' : 'CHECK') + ' count=' + rows.length + ' status=' + (r?.pm2_env?.status||'missing') + ' restarts=' + (r?.pm2_env?.restart_time ?? 'missing')); } })"
```

Required post-reboot process state:

* Exactly one of each app
* Status `online`
* Four-process check returns `ok` for:

  * `aisandbox-api-gateway`
  * `aisandbox-ai-service`
  * `aisandbox-container-manager`
  * `aisandbox-frontend`

If any app is missing, duplicated, or not online, **STOP**. Do not recover in this slice.

---

## 15. Post-reboot health verification

**Run inside AWS Lightsail browser SSH after reconnect — not PowerShell.**  
Health-only smoke only. Localhost only.

```bash
curl -sS -o /dev/null -w "API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

Expected:

* `API_HEALTH=200`
* `API_DB_HEALTH=200`
* `API_READY=200`
* `CONTAINER_HEALTH=200`
* `FRONTEND_ROOT=307` or other `2xx`/`3xx` (`307` accepted as locale redirect)

If any required health check fails, **STOP**. Do not recover in this slice.

---

## 16. Final safe-state verification

**Run inside AWS Lightsail browser SSH after reconnect — not PowerShell.**

```bash
cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
```

Expected:

* `git status --short`: no output (clean unless contradicted)
* public table count: `26`
* `pm2-ubuntu`: enabled
* `pm2-ubuntu`: active

Record all results in the Section 23 evidence template.

---

## 17. Pass criteria

04G manual validation should **PASS** only if **all** of the following are true:

* Pre-reboot checks pass.
* Keith explicitly approves reboot.
* Instance reboots and becomes reachable again.
* `pm2-ubuntu` is enabled after reboot.
* `pm2-ubuntu` is active after reboot.
* systemd Result is success after reboot.
* PM2 responds with pong after reboot.
* PM2 dump remains present after reboot.
* Exactly one of each app is online:

  * `aisandbox-api-gateway`
  * `aisandbox-ai-service`
  * `aisandbox-container-manager`
  * `aisandbox-frontend`
* Health-only smoke passes after reboot:

  * `API_HEALTH=200`
  * `API_DB_HEALTH=200`
  * `API_READY=200`
  * `CONTAINER_HEALTH=200`
  * `FRONTEND_ROOT` is `2xx`/`3xx`, with `307` acceptable as locale redirect.
* Public table count remains `26`.
* Git status remains clean unless contradicted.
* No `.env` values or secrets are printed.
* No DNS/TLS, AI execution, billing/payment execution, container workflow beyond health check, or Google OAuth enablement occurs.

If any pass criterion fails, verdict is **FAIL** / stop — not a silent recovery attempt.

---

## 18. Stop conditions

Stop immediately (do not reboot, or do not recover after reboot) if any of the following occur:

* Pre-reboot `pm2-ubuntu` is not enabled.
* Pre-reboot `pm2-ubuntu` is not active.
* Pre-reboot PM2 dump missing.
* Pre-reboot PM2 ping fails.
* Pre-reboot any app is missing, duplicated, or not online.
* Pre-reboot health check fails.
* Public table count is not `26`.
* Keith has not explicitly approved reboot.
* SSH/browser reconnect fails after reboot.
* Post-reboot `pm2-ubuntu` is not enabled.
* Post-reboot `pm2-ubuntu` is not active.
* Post-reboot systemd Result is not success.
* Post-reboot PM2 dump missing.
* Post-reboot PM2 ping fails.
* Post-reboot any app is missing, duplicated, or not online.
* Post-reboot any required health check fails.
* Public table count changes unexpectedly.
* Any command would print `.env` or secrets.
* DNS/TLS attempted.
* AI execution attempted.
* Billing/payment execution attempted.
* Container workflow attempted beyond health check.
* Google OAuth attempted.
* PM2 recovery commands are needed.
* systemd/PM2 files appear to require editing.
* Any destructive command is suggested.

On any stop condition: capture safe evidence only, then escalate. Do not widen scope inside 04G.

---

## 19. Recovery boundary

* 04G does **not** include recovery if post-reboot validation fails.
* If post-reboot validation fails, stop and capture safe evidence only.
* Do **not** run `pm2 save`, `pm2 startup`, `pm2 kill`, `pm2 delete`, `pm2 unstartup`, or manual process starts without separate approval.
* Do **not** edit systemd unit files.
* Do **not** edit PM2 dump files.
* A failed post-reboot validation should trigger a separate bounded recovery slice.
* Do not convert a failed 04G validation into an ad-hoc repair session.

---

## 20. No DNS/TLS confirmation

04G must confirm:

* No DNS configuration.
* No TLS certificate issuance or renewal.
* No Caddy public routing changes.
* No public hostname cutover.
* Health checks remain localhost-only (`127.0.0.1`).

Record in evidence: `no DNS/TLS: yes`.

---

## 21. No AI/billing/container/OAuth confirmation

04G must confirm:

* No AI execution enablement.
* No AI provider calls.
* No billing/payment execution enablement.
* No payment checkout.
* No container workflow beyond Container Manager health check.
* No Google OAuth enablement.

Record in evidence:

* `no AI execution: yes`
* `no billing/payment execution: yes`
* `no container workflow beyond health: yes`
* `no Google OAuth: yes`

---

## 22. No secret printing confirmation

04G must confirm:

* No `.env` opened/created/edited.
* No `.env` values printed.
* No `env` / `printenv` / `cat .env` / `echo $DATABASE_URL` / `echo $REDIS_URL` or equivalent secret-printing commands.
* Evidence contains only safe status lines, HTTP codes, counts, and non-secret summaries.

Record in evidence: `no .env values or secrets printed: yes`.

---

## 23. Safe evidence template

Capture only safe operator evidence. Do not paste secrets.

```text
04G Reboot Persistence Validation Evidence

Pre-reboot:
- date:
- uptime:
- git status --short:
- public table count:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- systemd Result:
- PM2_DUMP_PRESENT:
- pm2 ping:
- pm2 list summary:
- four-process check:
- API_HEALTH:
- API_DB_HEALTH:
- API_READY:
- CONTAINER_HEALTH:
- FRONTEND_ROOT:

Approval:
- Keith approved reboot:

Reboot:
- reboot command executed:
- SSH disconnected as expected:
- reconnected successfully:

Post-reboot:
- date:
- uptime:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- systemd Result:
- PM2_DUMP_PRESENT:
- pm2 ping:
- pm2 list summary:
- four-process check:
- API_HEALTH:
- API_DB_HEALTH:
- API_READY:
- CONTAINER_HEALTH:
- FRONTEND_ROOT:
- git status --short:
- public table count:

Non-goals / safety:
- no .env values or secrets printed:
- no DNS/TLS:
- no AI execution:
- no billing/payment execution:
- no container workflow beyond health:
- no Google OAuth:
- no source/migration/env changes:
- no PM2/systemd recovery commands:

Warnings/errors:
- none / details:
```

---

## 24. Expected final state

Expected final state after later manual validation:

* Reboot completed.
* Instance reachable again through Lightsail browser SSH.
* `pm2-ubuntu` enabled and active after reboot.
* systemd Result success after reboot.
* PM2 dump remains present.
* PM2 responds with pong.
* All four app processes online/ok after reboot.
* Health-only smoke passes after reboot.
* Public table count remains `26`.
* Git status remains clean unless contradicted.
* No secrets printed.
* No DNS/TLS configured.
* No AI/billing/container/OAuth execution enabled.
* 04G ready for evidence review.
* Parent 04 remains ACTIVE until 04G consolidation.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

Expected post-reboot state summary:

```text
pm2-ubuntu: enabled
pm2-ubuntu: active
systemd Result: success
PM2_DUMP_PRESENT=yes
pm2 ping: pong
all four apps: ok / online
API_HEALTH=200
API_DB_HEALTH=200
API_READY=200
CONTAINER_HEALTH=200
FRONTEND_ROOT=307 or other 2xx/3xx
public table count: 26
git status --short: no output
```

---

## 25. Exact next action

After this runbook exists:

```text
PRIVATE-BETA-STAGING-EXECUTION-04G Step 3 — Manual Reboot Persistence Validation + Evidence
```

Operator path for Step 3:

1. Open AWS Lightsail browser SSH on `aisandbox-staging`.
2. Run Section 9 pre-reboot verification.
3. STOP for Keith approval: `go — approve 04G reboot persistence validation`.
4. After approval only, run `sudo reboot`.
5. Reconnect via Lightsail browser SSH.
6. Run Sections 13–16 post-reboot verification.
7. Capture Section 23 safe evidence.
8. Return evidence for 04G evidence review.

Keep parent PRIVATE-BETA-STAGING-EXECUTION-04 **ACTIVE**.  
Keep PRIVATE-BETA-DEPLOYMENT-READINESS **BLOCKED / PAUSED**.  
Do not configure DNS/TLS.  
Do not enable AI / billing / container / OAuth execution.  
Do not reboot in this Cursor Step 2.  
Do not run PM2 recovery commands during 04G validation.

---

**End of runbook.**
