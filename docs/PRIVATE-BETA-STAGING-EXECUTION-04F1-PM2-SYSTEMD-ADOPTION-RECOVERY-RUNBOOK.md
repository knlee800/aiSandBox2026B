# PRIVATE-BETA-STAGING-EXECUTION-04F1 — PM2 systemd Adoption Recovery Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04F1  
**Title:** PM2 systemd Adoption Recovery  
**Step:** 2 — PM2 systemd Adoption Recovery Runbook  
**Date:** 2026-07-29  
**Nature:** Runbook for Keith manual execution inside AWS Lightsail browser SSH. Documentation/runbook creation only in Cursor. No SSH/AWS action in Cursor. No `pm2 save` / `pm2 kill` / `pm2 startup` / systemd / reboot executed in Cursor. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## 1. Task identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04F1 |
| Title | PM2 systemd Adoption Recovery |
| Step | 2 — PM2 systemd Adoption Recovery Runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04F (ACTIVE / BLOCKED by 04F1) |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 (ACTIVE) |
| Predecessors | PRIVATE-BETA-STAGING-EXECUTION-04D COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04E COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04F Step 3 partial success — 2026-07-29 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL BLOCKER |
| Nature | REAL STAGING EXECUTION — recover systemd ownership of PM2 daemon after PID/protocol adoption failure (runbook now; manual execution later) |
| Risk | HIGH — recovery may temporarily interrupt the four app processes (`pm2 kill` stops the PM2 daemon and managed apps) |
| Registered | 2026-07-29 |
| Step 1 | COMPLETE (Registration — 2026-07-29) |
| Current step | Step 2 — this runbook |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Operator | Keith |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |
| Parent 04F runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-PM2-PERSISTENCE-RUNBOOK.md` |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F1-CHECKPOINT.md` |
| 04D checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-CHECKPOINT.md` |
| 04E checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

### Authoritative state carried forward

* 04F1 is ACTIVE — Step 1 COMPLETE (Registration — 2026-07-29).
* 04F is ACTIVE / BLOCKED by 04F1.
* 04D is COMPLETE and LOCKED — 2026-07-27.
* 04E is COMPLETE and LOCKED — 2026-07-27.
* Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

### Failure evidence carried forward (04F Step 3 partial success)

```text
04F Step 3 partial success:
- All four PM2 app processes became healthy after API Gateway restart:
  - aisandbox-api-gateway=ok count=1 status=online restarts=0
  - aisandbox-ai-service=ok count=1 status=online restarts=0
  - aisandbox-container-manager=ok count=1 status=online restarts=0
  - aisandbox-frontend=ok count=1 status=online restarts=0
- API Gateway health checks passed:
  - API_HEALTH=200
  - API_DB_HEALTH=200
  - API_READY=200
- Public table count remained 26.
- `pm2 save` succeeded:
  - PM2_SAVE_EXIT=0
  - dump saved at /home/ubuntu/.pm2/dump.pm2
- `pm2 startup systemd -u ubuntu --hp /home/ubuntu` generated:
  - sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
- Keith executed the exact PM2-provided startup command.
- `systemctl is-enabled pm2-ubuntu` returned enabled.
- `systemctl is-active pm2-ubuntu` returned inactive / activating / failed during attempts.
- `systemctl status` showed Result=protocol.
- journal showed:
  - New main PID does not belong to service, and PID file is not owned by root. Refusing.
  - Can't open PID file /home/ubuntu/.pm2/pm2.pid after start.
  - Start request repeated too quickly.
- PM2 itself remained healthy:
  - pm2 ping returned pong.
  - PM2_DUMP_PRESENT=yes.
  - dump path: /home/ubuntu/.pm2/dump.pm2.
  - all four app processes stayed online.
- No reboot occurred.
- No DNS/TLS, AI execution, billing/payment execution, container workflow, or Google OAuth enablement occurred.
- No `.env` values or secrets were printed.
```

---

## 2. Purpose

Recover PM2 boot persistence safely after `pm2 save` succeeded and `pm2-ubuntu` was enabled, but `pm2-ubuntu.service` failed to become active due to a systemd/PM2 daemon adoption / PID protocol failure (`Result=protocol`).

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the later EXECUTION-04F1 manual recovery step.

This Cursor step creates the runbook only. It does **not** execute `pm2 save`, `pm2 kill`, `pm2 startup`, systemd changes, reboot, SSH, AWS CLI, or secret inspection.

**Runtime-impact warning (explicit):** Recovery may temporarily interrupt the four app processes because `pm2 kill` stops the PM2 daemon and managed apps. Keith approval is required before this runtime-impacting recovery.

---

## 3. What 04F1 does

04F1 is limited to PM2 systemd adoption recovery:

1. Require Keith explicit approval before any runtime-impacting recovery (`pm2 kill` / systemd restart path).
2. Verify current PM2 daemon health, dump presence, and the four validated app processes before any stop.
3. Verify current systemd failure state for `pm2-ubuntu` (enabled but failed / protocol).
4. Apply a controlled recovery: refresh dump (`pm2 save`), `systemctl reset-failed`, stop unmanaged PM2 daemon (`pm2 kill`), then `systemctl start pm2-ubuntu`.
5. Verify `pm2-ubuntu` is enabled and active after recovery.
6. Verify PM2 responds and all four app processes return online.
7. Verify localhost health-only smoke still passes.
8. Capture safe evidence only.
9. Keep DNS/TLS, AI/billing/container/OAuth enablement, migrations, `.env` edits, and reboot out of the default slice.
10. Leave 04F1 ready for evidence review; keep 04F blocked until 04F1 evidence review/consolidation; keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.

---

## 4. What 04F1 does not do

04F1 must **not**:

* Configure DNS/TLS.
* Configure Caddy public routing.
* Run migrations.
* Create database tables.
* Modify `.env`.
* Print `.env` or secret values.
* Enable AI execution.
* Enable billing/payment execution.
* Enable container execution workflows beyond health check.
* Enable Google OAuth.
* Run browser/user-facing smoke.
* Run payment/billing checkout.
* Run AI provider calls.
* Run container jobs.
* Modify source code.
* Modify migration files.
* Run `pm2 delete`.
* Run `pm2 unstartup`.
* Manually edit `/etc/systemd/system/pm2-ubuntu.service`.
* Manually edit `/home/ubuntu/.pm2/dump.pm2`.
* Run random internet commands.
* Reboot as part of default recovery.
* Mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.
* Unblock 04F persistence completion without evidence review.
* Commit or push git.

---

## 5. Preconditions

Before any recovery command:

| Precondition | Required state |
|--------------|----------------|
| 04F1 Step 1 | COMPLETE (Registration — 2026-07-29) |
| This runbook | Created and reviewed |
| 04F | ACTIVE / BLOCKED by 04F1 — Step 3 partial success recorded |
| 04D | COMPLETE and LOCKED — 2026-07-27 |
| 04E | COMPLETE and LOCKED — 2026-07-27 |
| Keith approval | Explicit approval required before runtime-impacting recovery (`pm2 kill` path) |
| Access method | AWS Lightsail browser SSH only (not Cursor SSH) |
| PM2 dump | Must be present before any daemon stop (`/home/ubuntu/.pm2/dump.pm2`) |
| PM2 apps | Prefer all four validated apps online before recovery |
| Secrets | No `.env` printing; no secret-bearing commands |
| Parent 04 | Remains ACTIVE |
| Deployment readiness | Remains BLOCKED / PAUSED |

Do not proceed if any precondition is unmet.

---

## 6. Lightsail browser SSH instruction

**All 04F1 manual execution commands run inside AWS Lightsail browser SSH — not PowerShell, not Cursor terminal, not local Windows shell.**

1. Open AWS Lightsail console for instance `aisandbox-staging` (Singapore / ap-southeast-1).
2. Use the Lightsail **browser SSH** session as user `ubuntu`.
3. Work from `/opt/aisandbox` for baseline checks.
4. Do **not** open or print `/opt/aisandbox/.env`.
5. Do **not** paste secrets into chat, tickets, or evidence.
6. Capture only safe status lines into the evidence template in Section 23.

This Cursor Step 2 does **not** open SSH.

---

## 7. Secret safety rules

Hard rules for all 04F1 operator actions:

* Do **not** run `env`, `printenv`, `cat .env`, `cat /opt/aisandbox/.env`, `echo $DATABASE_URL`, `echo $REDIS_URL`, or any command that prints secret values.
* Do **not** open, create, or edit `.env`, `.env.local`, `.env.staging`, `.env.production`, credentials, keys, certificates, token files, cookies, session dumps, database dumps, AWS keys, or SSH private keys.
* Do **not** paste secret values into evidence.
* Prefer status-only outputs (`pm2 list`, `systemctl is-enabled`, `systemctl is-active`, table counts, exit codes, safe status/journal summaries).
* Do **not** dump `/home/ubuntu/.pm2/dump.pm2` contents into chat.
* If any command unexpectedly prints secret-bearing content, stop immediately, redact, and do not paste the secret values.

---

## 8. Current PM2 and dump verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**  
**Do not begin recovery until dump presence is confirmed.**  
**Stop immediately if dump is missing.**

### Target process names

* `aisandbox-api-gateway`
* `aisandbox-ai-service`
* `aisandbox-container-manager`
* `aisandbox-frontend`

### Pre-recovery verification block

```bash
pm2 ping
pm2 list
test -f /home/ubuntu/.pm2/dump.pm2 && echo "PM2_DUMP_PRESENT=yes" || echo "PM2_DUMP_PRESENT=no"
ls -l /home/ubuntu/.pm2/dump.pm2 2>/dev/null || true
SYSTEMD_PAGER=cat systemctl show pm2-ubuntu -p Type -p ActiveState -p SubState -p Result -p Restart -p MainPID -p PIDFile -p ExecStart -p ExecStop -p FragmentPath -p User
SYSTEMD_PAGER=cat systemctl status pm2-ubuntu.service --no-pager -l | head -80
```

### Four-process check (pre-recovery)

```bash
pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const p=JSON.parse(s); for (const name of ['aisandbox-api-gateway','aisandbox-ai-service','aisandbox-container-manager','aisandbox-frontend']) { const rows=p.filter(x=>x.name===name); const r=rows[0]; console.log(name + '=' + (rows.length===1 && r.pm2_env.status==='online' && r.pm2_env.restart_time===0 ? 'ok' : 'CHECK') + ' count=' + rows.length + ' status=' + (r?.pm2_env?.status||'missing') + ' restarts=' + (r?.pm2_env?.restart_time ?? 'missing')); } })"
```

### Expected pre-recovery

| Check | Expected |
|-------|----------|
| `pm2 ping` | `pong` |
| `PM2_DUMP_PRESENT` | `yes` |
| Dump path | `/home/ubuntu/.pm2/dump.pm2` present, non-zero size |
| Four-process check | Prefer each `=ok` with `count=1` `status=online` |
| `pm2 list` | No missing/duplicated validated app names |

### Stop if

* `PM2_DUMP_PRESENT=no`.
* Dump path missing.
* PM2 app list missing or duplicated before recovery.
* `pm2 ping` fails.
* Any Section 12 stop condition appears.

---

## 9. systemd failure verification

Confirm the previously observed failure state is still present (or record the current state accurately).

From Section 8 outputs, record:

* `systemctl is-enabled pm2-ubuntu` (expected: `enabled`)
* `systemctl is-active pm2-ubuntu` (previously: `inactive` / `activating` / `failed`)
* `Result` / `SubState` from `systemctl show` / `status` (previously: `Result=protocol`)
* Safe journal/status snippets only — no secrets

Previously observed journal symptoms (carry forward; confirm if still present):

* `New main PID does not belong to service, and PID file is not owned by root. Refusing.`
* `Can't open PID file /home/ubuntu/.pm2/pm2.pid after start.`
* `Start request repeated too quickly.`

Do **not** manually edit the unit file to “fix” this during verification.

---

## 10. Diagnosis

### Working diagnosis (to be confirmed by next manual evidence)

```text
PM2 is already running as an unmanaged user daemon. systemd runs `pm2 resurrect`, sees or causes PM2 to use an existing daemon/PID outside the service cgroup, and refuses to adopt it under Type=forking/PIDFile rules. The dump is present and app processes are healthy, so the safest recovery path is to preserve the dump, stop the unmanaged PM2 daemon in a controlled way, reset the failed systemd unit, then let systemd start PM2 from the saved dump.
```

This is the **working diagnosis**, not an absolute claim. Next manual evidence must confirm or revise it.

### Why this diagnosis fits current evidence

* `pm2 save` succeeded and dump remains present.
* `pm2 ping` returns `pong` while `pm2-ubuntu` is not `active` → unmanaged PM2 daemon is likely already running outside systemd ownership.
* systemd reports `Result=protocol` and refuses PID adoption / PID file ownership.
* Apps stayed online during the failed systemd start attempts → unmanaged daemon continued serving processes.
* Therefore: preserve dump → controlled stop of unmanaged daemon → reset-failed → let systemd start and resurrect.

---

## 11. Recovery strategy

Likely controlled recovery path after prechecks PASS and Keith explicitly approves runtime interruption:

1. Confirm dump present and four apps healthy (Section 8).
2. Confirm systemd failure evidence (Section 9).
3. Obtain Keith explicit approval for runtime-impacting recovery.
4. Refresh dump with `pm2 save` (preserve already-valid process list).
5. `sudo systemctl reset-failed pm2-ubuntu`.
6. `pm2 kill` — stops unmanaged PM2 daemon and managed apps temporarily.
7. Wait briefly (`sleep 5`).
8. `sudo systemctl start pm2-ubuntu` — systemd should own PM2 and resurrect from dump.
9. Wait for resurrect (`sleep 20`).
10. Verify systemd active/enabled (Section 14).
11. Verify PM2 + four apps online (Section 15).
12. Verify health endpoints (Section 16).
13. Capture safe evidence (Section 23).
14. Do **not** reboot as part of default recovery.

### Important command boundaries

* Recovery may temporarily interrupt the four app processes because `pm2 kill` stops the PM2 daemon and managed apps.
* Keith approval is required before this runtime-impacting recovery.
* Do not reboot as part of the default recovery.
* Do not run `pm2 delete`.
* Do not run `pm2 unstartup`.
* Do not manually edit `/etc/systemd/system/pm2-ubuntu.service`.
* Do not manually edit `/home/ubuntu/.pm2/dump.pm2`.
* Do not run random internet commands.
* Do not print `.env` or secrets.
* Confirm dump exists before any daemon stop.
* Stop immediately if dump is missing.
* Stop immediately if any post-recovery app does not return online.
* Stop immediately if `pm2-ubuntu` remains failed after the controlled recovery.

---

## 12. Recovery stop conditions

Stop immediately and do **not** continue recovery / reboot if any of the following occur:

* PM2 dump missing.
* PM2 app list missing or duplicated before recovery.
* `pm2 save` fails.
* `pm2 kill` output indicates unexpected failure.
* `systemctl start pm2-ubuntu` fails.
* `pm2-ubuntu` remains failed or inactive after recovery.
* PM2 daemon does not respond after recovery.
* Any of the four app processes does not return online.
* API health does not return 200.
* API DB health does not return 200.
* API ready does not return 200.
* Container health does not return 200.
* Frontend root does not return 2xx/3xx.
* Any command would print `.env` or secrets.
* DNS/TLS attempted.
* AI execution attempted.
* Billing/payment execution attempted.
* Container workflow attempted beyond health check.
* Google OAuth attempted.
* Reboot attempted without separate approval.

On any stop condition: capture safe outputs only (status / journal / pm2), leave PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED, and request recovery guidance before continuing.

---

## 13. Controlled recovery command plan

**Run inside AWS Lightsail browser SSH — not PowerShell.**  
**Only after Sections 8–9 PASS and Keith explicitly approves runtime interruption.**

### Explanations

* `pm2 save` is repeated only to refresh the already-valid dump before stopping the unmanaged daemon.
* `pm2 kill` is runtime-impacting; it stops PM2 and managed apps temporarily.
* `systemctl start pm2-ubuntu` should let systemd own the PM2 daemon and resurrect from dump.
* If `systemctl is-active pm2-ubuntu` is not `active`, stop and capture safe status/journal output.
* Do not continue to reboot validation.

### Command plan

```bash
pm2 save
echo "PM2_RESAVE_EXIT=$?"

sudo systemctl reset-failed pm2-ubuntu
pm2 kill
sleep 5

sudo systemctl start pm2-ubuntu
sleep 20

systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
SYSTEMD_PAGER=cat systemctl status pm2-ubuntu.service --no-pager -l | head -80
```

### Expected during recovery

| Check | Expected |
|-------|----------|
| `PM2_RESAVE_EXIT` | `0` |
| `systemctl is-enabled pm2-ubuntu` | `enabled` |
| `systemctl is-active pm2-ubuntu` | `active` |
| Status summary | No `Result=protocol` failure; service active |

### Stop if

* `PM2_RESAVE_EXIT` is not `0`.
* `pm2 kill` indicates unexpected failure.
* `systemctl start pm2-ubuntu` fails.
* `systemctl is-active pm2-ubuntu` is not `active`.
* Any Section 12 stop condition appears.

If not `active`: **stop**, capture safe `systemctl status` / journal snippets, and do **not** proceed to reboot validation.

---

## 14. Post-recovery systemd verification

After the controlled recovery command plan:

```bash
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
SYSTEMD_PAGER=cat systemctl show pm2-ubuntu -p Type -p ActiveState -p SubState -p Result -p Restart -p MainPID -p PIDFile -p ExecStart -p ExecStop -p FragmentPath -p User
SYSTEMD_PAGER=cat systemctl status pm2-ubuntu.service --no-pager -l | head -80
```

### Expected

```text
enabled
active
```

### Stop if

* Not `enabled`.
* Not `active`.
* Unit remains `failed` / `Result=protocol`.
* Status indicates repeated start failures.

Do **not** manually edit the unit file. Do **not** run `pm2 unstartup`.

---

## 15. Post-recovery PM2 process verification

```bash
pm2 ping
pm2 list
test -f /home/ubuntu/.pm2/dump.pm2 && echo "PM2_DUMP_PRESENT=yes" || echo "PM2_DUMP_PRESENT=no"
pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const p=JSON.parse(s); for (const name of ['aisandbox-api-gateway','aisandbox-ai-service','aisandbox-container-manager','aisandbox-frontend']) { const rows=p.filter(x=>x.name===name); const r=rows[0]; console.log(name + '=' + (rows.length===1 && r.pm2_env.status==='online' ? 'ok' : 'CHECK') + ' count=' + rows.length + ' status=' + (r?.pm2_env?.status||'missing') + ' restarts=' + (r?.pm2_env?.restart_time ?? 'missing')); } })"
```

### Judgment note

After controlled recovery, restart count may not remain `0` because PM2 resurrect may create fresh process metadata. Record restarts but judge PASS primarily on:

* one instance of each app being online (`count=1`, `status=online`)
* health endpoints passing (Section 16)

### Expected

| Check | Expected |
|-------|----------|
| `pm2 ping` | `pong` |
| `PM2_DUMP_PRESENT` | `yes` |
| Four-process check | Each name `=ok` with `count=1` `status=online` |
| Restart counts | Recorded; non-zero may be acceptable after resurrect |

### Stop if

* PM2 daemon does not respond.
* Dump missing after recovery.
* Any of the four apps missing, offline, or duplicated.
* Any Section 12 stop condition appears.

---

## 16. Post-recovery health verification

**Localhost health-only smoke. No public DNS/TLS. No AI/billing/container/OAuth enablement.**

```bash
curl -sS -o /dev/null -w "API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

### Expected

| Check | Expected |
|-------|----------|
| `API_HEALTH` | `200` |
| `API_DB_HEALTH` | `200` |
| `API_READY` | `200` |
| `CONTAINER_HEALTH` | `200` |
| `FRONTEND_ROOT` | `2xx` or `3xx` (307 locale redirect remains acceptable) |

### Final safe state commands

```bash
cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
```

### Expected final safe state lines

| Check | Expected |
|-------|----------|
| `git status --short` | Empty / clean (no unexpected dirty output) |
| Public table count | Present (previously `26`) |
| `pm2-ubuntu` enabled | `enabled` |
| `pm2-ubuntu` active | `active` |

### Stop if

* Any API health check is not `200`.
* Container health is not `200`.
* Frontend root is not `2xx`/`3xx`.
* Any Section 12 stop condition appears.

---

## 17. Optional reboot validation boundary

**Reboot validation is not part of 04F1 default recovery.**

* Reboot validation requires separate explicit Keith approval.
* Do not include reboot commands in default execution.
* Do not run `sudo reboot`, `shutdown -r`, or equivalent in this slice.
* If reboot validation is needed later, it should be a separate step after 04F1 recovery evidence review.
* Default 04F1 success requires systemd-active PM2 ownership + dump present + four apps online + health-only smoke, without proving resurrect-after-reboot in this slice.

---

## 18. No DNS/TLS confirmation

Confirm and record:

* No DNS records changed.
* No TLS certificates requested or installed for this slice.
* No Caddy public site/routing configuration for this slice.
* Recovery work remains local process / systemd / PM2 only.

If DNS/TLS was attempted: stop and treat as a stop condition.

---

## 19. No AI/billing/container/OAuth enablement confirmation

Confirm and record:

* No AI execution / provider calls.
* No billing/payment execution or checkout.
* No container workflow beyond health check (no new container jobs).
* No Google OAuth enablement.
* Kill switches and deferred OAuth posture remain unchanged; do not edit `.env` to “confirm” them.

If any enablement was attempted: stop and treat as a stop condition.

---

## 20. No secret printing confirmation

Confirm and record:

* No `.env` opened/printed.
* No `env` / `printenv` / secret echo commands used.
* No passwords, tokens, keys, or connection strings pasted into evidence.
* Dump file contents were not pasted into chat.
* Evidence contains only safe status lines, exit codes, and non-secret summaries.

If secrets were printed: stop, redact, and do not paste secret values.

---

## 21. Rollback / undo guidance

Safe rollback / undo guidance for 04F1:

* Do not manually edit systemd files.
* Do not use `pm2 unstartup` unless a later recovery task explicitly approves it.
* If recovery fails but PM2 dump remains, stop and capture safe status/journal/pm2 output.
* If apps are down after failed recovery, use only the previously validated PM2 start commands from 04D/04F with safe env loading, and only if explicitly approved in the moment.
  * Safe env loading pattern (no printing): `cd /opt/aisandbox`; `set -a`; `. /opt/aisandbox/.env`; `set +a` — then previously validated `pm2 start` commands for the four apps.
  * Do **not** invent new start commands.
  * Do **not** run `env` / `printenv` after sourcing.
* Do not run destructive cleanup.
* Do not run `pm2 delete`.
* Do not manually edit `/home/ubuntu/.pm2/dump.pm2`.
* Do not reboot to “undo” unless a separately approved recovery step says so.
* Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.
* Prefer pause + evidence capture over improvisation.

---

## 22. Expected final state

Expected final state after later manual recovery:

* PM2 dump remains present.
* `pm2-ubuntu` is enabled.
* `pm2-ubuntu` is active.
* PM2 responds to `pm2 ping`.
* All four app processes are online:
  * `aisandbox-api-gateway`
  * `aisandbox-ai-service`
  * `aisandbox-container-manager`
  * `aisandbox-frontend`
* Health-only smoke still passes:
  * `API_HEALTH=200`
  * `API_DB_HEALTH=200`
  * `API_READY=200`
  * `CONTAINER_HEALTH=200`
  * `FRONTEND_ROOT` is 2xx/3xx
* No reboot occurred.
* No DNS/TLS configured.
* No AI/billing/container/OAuth execution enabled.
* No secrets disclosed.
* 04F1 ready for evidence review.
* 04F remains blocked until 04F1 evidence review/consolidation.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

This Cursor Step 2 only creates the runbook; the final state above is the target of later manual recovery, not a claim that recovery already succeeded.

---

## 23. Safe evidence template

Keith can paste the following after manual recovery (safe fields only):

```text
04F1 PM2 systemd Adoption Recovery Evidence

Pre-recovery:
- PM2_DUMP_PRESENT:
- pm2 ping:
- pm2 list summary:
- four-process check:
- pm2-ubuntu enabled:
- pm2-ubuntu active state:
- systemd Result/SubState:
- failure evidence summary:

Approval:
- Keith approved runtime-impacting recovery:

Recovery:
- PM2_RESAVE_EXIT:
- reset-failed result:
- pm2 kill result:
- systemctl start pm2-ubuntu result:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- safe status summary:

Post-recovery PM2:
- pm2 ping:
- pm2 list summary:
- four-process check:
- PM2_DUMP_PRESENT:

Health:
- API_HEALTH:
- API_DB_HEALTH:
- API_READY:
- CONTAINER_HEALTH:
- FRONTEND_ROOT:

Final safe state:
- git status --short:
- public table count:
- no reboot:
- no DNS/TLS:
- no AI execution:
- no billing/payment execution:
- no container workflow beyond health:
- no Google OAuth:
- no .env/secrets printed:

Warnings/errors:
- none / details:
```

---

## 24. Exact next action

```text
PRIVATE-BETA-STAGING-EXECUTION-04F1 Step 3 — Manual PM2 systemd Adoption Recovery + Evidence
```

Operator path after this runbook:

1. Review this runbook.
2. Obtain Keith explicit approval before runtime-impacting recovery (`pm2 kill` path).
3. Open AWS Lightsail browser SSH for `aisandbox-staging`.
4. Run Section 8 PM2/dump verification + Section 9 systemd failure verification.
5. If dump present and prechecks PASS, and Keith approved, run Section 13 controlled recovery.
6. Verify systemd (Section 14), PM2 processes (Section 15), and health (Section 16).
7. Fill Section 23 evidence template with safe outputs only.
8. Proceed to evidence review / consolidation in later 04F1 steps.
9. Do **not** reboot unless a separate approved step authorizes it.
10. Keep 04F blocked until 04F1 evidence review/consolidation.
11. Keep parent 04 ACTIVE.
12. Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.

---

## Command boundary summary (quick reference)

| Action | Allowed in default 04F1 manual recovery? |
|--------|------------------------------------------|
| Pre-recovery `pm2 ping` / `pm2 list` / dump check / systemd status | Yes — required first |
| Four-process jlist check | Yes |
| `pm2 save` refresh after Keith approval | Yes |
| `systemctl reset-failed pm2-ubuntu` | Yes |
| `pm2 kill` after Keith approval | Yes — runtime-impacting |
| `systemctl start pm2-ubuntu` | Yes |
| Post-recovery systemd / PM2 / health verification | Yes |
| Reboot | No — separate explicit approval required |
| DNS/TLS / Caddy public routing | No |
| Migrations / `.env` edits / secret printing | No |
| AI / billing / container jobs / Google OAuth | No |
| `pm2 delete` / `pm2 unstartup` / manual unit or dump edits | No |
| Random internet recovery snippets | No |

---

**End of runbook.**
