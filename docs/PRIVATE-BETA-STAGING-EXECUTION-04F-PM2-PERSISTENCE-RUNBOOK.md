# PRIVATE-BETA-STAGING-EXECUTION-04F — PM2 Persistence / Boot Persistence Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04F  
**Title:** PM2 Persistence / Boot Persistence  
**Step:** 2 — PM2 Persistence Runbook  
**Date:** 2026-07-27  
**Nature:** Runbook for Keith manual execution inside AWS Lightsail browser SSH. Documentation/runbook creation only in Cursor. No SSH/AWS action in Cursor. No `pm2 save` / `pm2 startup` / systemd / reboot executed in Cursor. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## 1. Task identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04F |
| Title | PM2 Persistence / Boot Persistence |
| Step | 2 — PM2 Persistence Runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessors | PRIVATE-BETA-STAGING-EXECUTION-04D COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04E COMPLETE and LOCKED — 2026-07-27 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — PM2 process-list persistence and boot-persistence (runbook now; manual execution later) |
| Risk | HIGH — persists production-like staging process list and may register systemd/PM2 startup; incorrect save can resurrect broken processes after reboot |
| Registered | 2026-07-27 |
| Step 1 | COMPLETE (Registration — 2026-07-27) |
| Current step | Step 2 — this runbook |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Operator | Keith |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-CHECKPOINT.md` |
| 04D checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-CHECKPOINT.md` |
| 04E checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

### Authoritative state carried forward

* 04F is ACTIVE — Step 1 COMPLETE (Registration — 2026-07-27).
* 04D is COMPLETE and LOCKED — 2026-07-27.
* 04E is COMPLETE and LOCKED — 2026-07-27.
* Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.
* PM2 runtime is online after 04D health-only smoke PASS, but not yet persisted with `pm2 save` / `pm2 startup`.

### Safe 04D evidence carried forward

```text
PM2 health-only smoke passed:
- aisandbox-api-gateway online, restarts 0
- aisandbox-ai-service online, restarts 0
- aisandbox-container-manager online, restarts 0
- aisandbox-frontend online, restarts 0
- API_HEALTH=200
- API_DB_HEALTH=200
- API_READY=200
- CONTAINER_HEALTH=200
- FRONTEND_ROOT=307 accepted as locale redirect
- final public table count 26
- no secrets printed
- no DNS/TLS
- no AI execution
- no billing/payment execution
- no container workflow beyond Container Manager health endpoint
- no Google OAuth enablement
```

### Safe 04E evidence carried forward

```text
Staging database migration baseline completed:
- snapshot aisandbox-staging-premigration-2026-07-27 was Available before migration
- npm run migration:run:prod completed with MIGRATION_RUN_PROD_EXIT=0
- required tables exist: usage_records, billing_snapshots, invoices
- migration history count 25
- required row counts 0
```

---

## 2. Purpose

Persist the currently validated PM2 runtime process list and prepare/verify boot persistence safely, after 04D proved all four app services can run and pass localhost health-only smoke, and after 04E established the staging migration baseline.

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the later EXECUTION-04F manual execution step.

This Cursor step creates the runbook only. It does **not** execute `pm2 save`, `pm2 startup`, systemd changes, reboot, SSH, AWS CLI, or secret inspection.

---

## 3. What 04F does

04F is limited to PM2 persistence / boot persistence:

1. Require Keith explicit approval before any PM2 persistence command.
2. Verify current PM2 process list and stability for the four validated app names.
3. Verify safe baseline (`git status --short`, public table count) without printing secrets.
4. Run `pm2 save` only after confirming all four processes are online and stable.
5. Generate/inspect `pm2 startup` instruction safely (discovery first).
6. Execute only the exact PM2-provided `sudo env PATH=... pm2 startup ...` command if Keith explicitly approves it.
7. Verify systemd enablement/activity for the PM2 user service.
8. Verify PM2 dump / saved process presence and current `pm2 list`.
9. Capture safe evidence only.
10. Keep DNS/TLS, AI/billing/container/OAuth enablement, migrations, `.env` edits, and reboot out of the default slice.
11. Leave 04F ready for evidence review; keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.

---

## 4. What 04F does not do

04F must **not**:

* Configure DNS/TLS.
* Configure Caddy public routing.
* Run migrations.
* Create database tables.
* Modify `.env`.
* Print `.env` or secret values.
* Enable AI execution.
* Enable billing/payment execution.
* Enable container execution workflows beyond the already-running Container Manager service.
* Enable Google OAuth.
* Run browser/user-facing smoke.
* Run payment/billing checkout.
* Run AI provider calls.
* Run container jobs.
* Modify source code.
* Modify migration files.
* Modify PM2 ecosystem config unless a future approved runbook explicitly scopes it.
* Start/stop/restart app services as part of persistence (verify only; do not use persistence as a restart slice).
* Run `pm2 delete`, `pm2 kill`, or destructive PM2 cleanup during persistence unless a stop condition requires aborting and a later task approves recovery.
* Run reboot validation unless separately and explicitly approved.
* Mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.
* Commit or push git.

---

## 5. Preconditions

Before any persistence command:

| Precondition | Required state |
|--------------|----------------|
| 04D | COMPLETE and LOCKED — 2026-07-27 |
| 04E | COMPLETE and LOCKED — 2026-07-27 |
| 04F Step 1 | COMPLETE (Registration — 2026-07-27) |
| This runbook | Created and reviewed |
| Keith approval | Explicit approval required before `pm2 save` / `pm2 startup` execution |
| Access method | AWS Lightsail browser SSH only (not Cursor SSH) |
| PM2 runtime | Four validated app processes expected online and stable |
| Secrets | No `.env` printing; no secret-bearing commands |
| Parent 04 | Remains ACTIVE |
| Deployment readiness | Remains BLOCKED / PAUSED |

Do not proceed if any precondition is unmet.

---

## 6. Lightsail browser SSH instruction

**All 04F manual execution commands run inside AWS Lightsail browser SSH — not PowerShell, not Cursor terminal, not local Windows shell.**

1. Open AWS Lightsail console for instance `aisandbox-staging` (Singapore / ap-southeast-1).
2. Use the Lightsail **browser SSH** session as user `ubuntu`.
3. Work from `/opt/aisandbox` for baseline checks.
4. Do **not** open or print `/opt/aisandbox/.env`.
5. Do **not** paste secrets into chat, tickets, or evidence.
6. Capture only safe status lines into the evidence template in Section 21.

This Cursor Step 2 does **not** open SSH.

---

## 7. Secret safety rules

Hard rules for all 04F operator actions:

* Do **not** run `env`, `printenv`, `cat .env`, `cat /opt/aisandbox/.env`, `echo $DATABASE_URL`, `echo $REDIS_URL`, or any command that prints secret values.
* Do **not** open, create, or edit `.env`, `.env.local`, `.env.staging`, `.env.production`, credentials, keys, certificates, token files, cookies, session dumps, database dumps, AWS keys, or SSH private keys.
* Do **not** paste secret values into evidence.
* `PATH` in a PM2-generated `sudo env PATH=...` startup command is **not** a secret; it may be recorded as a command string.
* Prefer status-only outputs (`pm2 list`, `systemctl is-enabled`, table counts, exit codes).
* If any command unexpectedly prints secret-bearing content, stop immediately, redact, and do not paste the secret values.

---

## 8. Current PM2 process verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**  
**Keith explicit approval required before later `pm2 save` / `pm2 startup`.**  
Verification itself is inspection-only and must pass before persistence.

### Persist only these four process names

* `aisandbox-api-gateway`
* `aisandbox-ai-service`
* `aisandbox-container-manager`
* `aisandbox-frontend`

### First manual execution block — PM2 verification

```bash
pm2 list
pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const p=JSON.parse(s); for (const name of ['aisandbox-api-gateway','aisandbox-ai-service','aisandbox-container-manager','aisandbox-frontend']) { const rows=p.filter(x=>x.name===name); const r=rows[0]; console.log(name + '=' + (rows.length===1 && r.pm2_env.status==='online' && r.pm2_env.restart_time===0 ? 'ok' : 'CHECK') + ' count=' + rows.length + ' status=' + (r?.pm2_env?.status||'missing') + ' restarts=' + (r?.pm2_env?.restart_time ?? 'missing')); } })"
```

### Expected

* Each of the four lines ends with `=ok`.
* `count=1` for each name.
* `status=online` for each name.
* `restarts=0` for each name (or at least not increasing during this slice).

### Stop if

* Any line says `CHECK`.
* Any process has duplicate count (`count` ≠ 1).
* Any process is missing or offline.
* API Gateway CPU is stuck high (for example sustained near 100% in `pm2 list` / monit view).
* Restart count increases during verification.

### Safe baseline commands

After PM2 verification passes, record baseline without printing env values:

```bash
cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

### Expected baseline

| Check | Expected |
|-------|----------|
| `git status --short` | Empty / clean (no unexpected dirty output) |
| Public table count | Present and accessible (04D recorded `26`; stop if missing/inaccessible) |

Do **not** print env values during baseline checks.

---

## 9. PM2 persistence stop conditions

Stop immediately and do **not** run `pm2 save` / `pm2 startup` / reboot if any of the following occur:

* Any PM2 app process missing.
* Any PM2 app process offline.
* Any PM2 app process duplicated.
* Any restart count increasing.
* API Gateway CPU stuck high.
* `git status --short` unexpected.
* Public table count missing or database inaccessible.
* Any command would print `.env` or secrets.
* `pm2 save` fails.
* `pm2 startup` output unclear.
* PM2-generated sudo command differs from expected user/service path (`ubuntu`, `/home/ubuntu`).
* systemd service not enabled.
* systemd service not active.
* PM2 dump missing after save.
* DNS/TLS attempted.
* AI execution attempted.
* Billing/payment execution attempted.
* Container workflow attempted beyond already-running Container Manager service.
* Google OAuth attempted.
* Reboot attempted without separate approval.
* Desire to run `pm2 delete`, `pm2 kill`, or destructive cleanup without a later approved recovery task.

On any stop condition: capture safe outputs only, leave PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED, and request recovery guidance before continuing.

---

## 10. `pm2 save` execution plan

### Boundaries

* Do **not** run `pm2 save` unless all four validated processes are online and stable.
* Do **not** run `pm2 save` if any process is offline, restarting, missing, duplicated, or CPU-stuck.
* Persist only the four validated process names listed in Section 8.
* Do **not** persist broken/restarting processes.
* Keith explicit approval required before running `pm2 save`.

### Command (only after successful PM2 verification)

```bash
pm2 save
echo "PM2_SAVE_EXIT=$?"
```

### Expected

```text
PM2_SAVE_EXIT=0
```

### Stop if

* `PM2_SAVE_EXIT` is not `0`.
* Save output indicates failure or incomplete dump write.
* Any stop condition from Section 9 appears during or after save.

---

## 11. `pm2 startup` discovery plan

### Boundaries

* Do **not** run `pm2 startup` blindly.
* First generate/inspect the PM2 startup instruction.
* Read the PM2 output carefully.
* Do **not** invent a systemd unit by hand.
* Do **not** alter the PM2-provided command.
* Execute only the exact PM2-provided `sudo env PATH=... pm2 startup ...` command if Keith explicitly approves it.
* Do **not** paste secrets; the `PATH` value is not a secret.

### Safe discovery command

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### Operator handling of discovery output

1. Read the full PM2 output.
2. PM2 may print a command similar to:

   ```text
   sudo env PATH=... pm2 startup systemd -u ubuntu --hp /home/ubuntu
   ```

3. Confirm the printed command targets user `ubuntu` and home `/home/ubuntu`.
4. Do **not** alter the command.
5. If the printed command is unclear, missing, or targets a different user/home path: **stop** and capture safe output.
6. Only after Keith explicit approval, proceed to Section 12.

---

## 12. PM2-provided startup command handling

### Boundaries

* Execute **only** the exact PM2-provided `sudo env PATH=... pm2 startup ...` command.
* Do **not** rewrite PATH, user, home path, or init system.
* Do **not** run random internet “PM2 startup” snippets.
* Do **not** edit systemd unit files manually.
* Keith explicit approval required before executing the sudo command.

### Handling steps

1. Copy the exact PM2-provided sudo command from discovery output.
2. Confirm it still matches expected user `ubuntu` and home `/home/ubuntu`.
3. Execute that exact command once.
4. Record whether it was executed exactly (yes/no) and the safe result summary.
5. Proceed immediately to Section 13 systemd verification.

### Stop if

* Command was altered.
* Command differs from expected user/service path.
* Execution fails or output is unclear.
* Any Section 9 stop condition appears.

---

## 13. systemd verification

After executing the PM2-provided startup command, verify systemd state.

```bash
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
systemctl status pm2-ubuntu --no-pager -l | head -80
```

### Expected

```text
enabled
active
```

### Notes

* Expected service name for this staging plan is `pm2-ubuntu`.
* If the service name differs, **stop** and capture safe output (`systemctl list-units '*pm2*' --all` is acceptable only if it does not print secrets).
* Do **not** manually edit unit files to force the expected name.
* Do **not** enable/disable unrelated services.

### Stop if

* Not `enabled`.
* Not `active`.
* Service name differs unexpectedly.
* Status output indicates failed unit load or failed start.

---

## 14. PM2 resurrect / saved process verification

Confirm dump presence and current process list after save + startup registration.

```bash
pm2 list
test -f /home/ubuntu/.pm2/dump.pm2 && echo "PM2_DUMP_PRESENT=yes" || echo "PM2_DUMP_PRESENT=no"
ls -l /home/ubuntu/.pm2/dump.pm2 2>/dev/null || true
```

### Expected

| Check | Expected |
|-------|----------|
| `pm2 list` | All four validated app processes still online; no duplicates; no unexpected missing names |
| `PM2_DUMP_PRESENT` | `yes` |
| `ls -l .../dump.pm2` | File present with a non-zero size (record size/mtime safely; do not dump file contents into chat if uncertain) |

### Stop if

* `PM2_DUMP_PRESENT=no`.
* Dump path missing.
* Any of the four processes missing/offline/duplicated after persistence.
* Restart counts increasing.

Do **not** run reboot as part of this verification.

---

## 15. Optional reboot validation boundary

**Reboot validation is not automatic in Step 3.**

* Reboot validation requires separate explicit Keith approval because it interrupts the instance.
* If approved later, use a separate bounded step.
* Do **not** include reboot commands as part of the default 04F execution.
* Do **not** run `sudo reboot`, `shutdown -r`, or equivalent unless a later approved step explicitly authorizes it.
* Default 04F success does **not** require proving resurrect-after-reboot in this slice; it requires save + startup/systemd verification + dump presence while the current runtime remains online.

---

## 16. No DNS/TLS confirmation

Confirm and record:

* No DNS records changed.
* No TLS certificates requested or installed for this slice.
* No Caddy public site/routing configuration for this slice.
* Health/persistence work remains local process / systemd / PM2 only.

If DNS/TLS was attempted: stop and treat as a stop condition.

---

## 17. No AI/billing/container/OAuth enablement confirmation

Confirm and record:

* No AI execution / provider calls.
* No billing/payment execution or checkout.
* No container workflow beyond the already-running Container Manager service (no new container jobs).
* No Google OAuth enablement.
* Kill switches and deferred OAuth posture remain unchanged; do not edit `.env` to “confirm” them.

If any enablement was attempted: stop and treat as a stop condition.

---

## 18. No secret printing confirmation

Confirm and record:

* No `.env` opened/printed.
* No `env` / `printenv` / secret echo commands used.
* No passwords, tokens, keys, or connection strings pasted into evidence.
* Evidence contains only safe status lines, exit codes, and non-secret command strings (including PM2-provided PATH startup command if needed).

If secrets were printed: stop, redact, and do not paste secret values.

---

## 19. Rollback / undo guidance

Safe rollback / undo guidance for 04F:

* Do **not** delete PM2 processes unless separately approved.
* Do **not** run `pm2 delete`, `pm2 kill`, or destructive cleanup during persistence unless a stop condition requires aborting and a later task approves recovery.
* If `pm2 save` persisted the wrong list, stop and request recovery guidance.
* If systemd setup fails, capture safe output and stop.
* Do **not** run random internet commands.
* Do **not** edit systemd files manually.
* Do **not** run destructive cleanup commands.
* Do **not** reboot to “undo” unless a separately approved recovery step says so.
* Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.
* Prefer pause + evidence capture over improvisation.

---

## 20. Expected final state

Expected final state after later manual execution (Step 3+), assuming PASS:

* All four validated PM2 app processes remain online:
  * `aisandbox-api-gateway`
  * `aisandbox-ai-service`
  * `aisandbox-container-manager`
  * `aisandbox-frontend`
* `pm2 save` succeeded (`PM2_SAVE_EXIT=0`).
* PM2 dump exists (`PM2_DUMP_PRESENT=yes`).
* PM2 startup/systemd is enabled and active for user `ubuntu` (expected unit `pm2-ubuntu`).
* No reboot was performed unless separately approved.
* No DNS/TLS configured.
* No AI/billing/container/OAuth execution enabled.
* No secrets disclosed.
* 04F ready for evidence review.
* Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

This Cursor Step 2 only creates the runbook; the final state above is the target of later manual execution, not a claim that persistence already succeeded.

---

## 21. Safe evidence template

Keith can paste the following after manual execution (safe fields only):

```text
04F PM2 Persistence Execution Evidence

Preconditions:
- 04D COMPLETE and LOCKED:
- 04E COMPLETE and LOCKED:
- Current PM2 all four online/stable:
- git status --short output:
- public table count:

pm2 save:
- PM2_SAVE_EXIT:
- output summary:

pm2 startup:
- discovery command used:
- PM2-provided sudo command executed exactly:
- startup exit/result:

systemd:
- systemctl is-enabled pm2-ubuntu:
- systemctl is-active pm2-ubuntu:
- safe status summary:

saved process verification:
- PM2_DUMP_PRESENT:
- pm2 list summary:
- duplicate/missing process check:

Non-goals:
- no DNS/TLS:
- no AI execution:
- no billing/payment execution:
- no container workflow:
- no Google OAuth:
- no reboot:
- no secrets printed:

Warnings/errors:
- none / details:
```

---

## 22. Exact next action

```text
PRIVATE-BETA-STAGING-EXECUTION-04F Step 3 — Manual PM2 Persistence Execution + Evidence
```

Operator path after this runbook:

1. Review this runbook.
2. Obtain Keith explicit approval before any `pm2 save` / `pm2 startup` command.
3. Open AWS Lightsail browser SSH for `aisandbox-staging`.
4. Run Section 8 PM2 verification + baseline checks.
5. If all four are `ok` and stable, run Section 10 `pm2 save`.
6. Run Section 11 discovery; execute only the exact PM2-provided sudo command after approval (Section 12).
7. Verify systemd (Section 13) and dump/list (Section 14).
8. Fill Section 21 evidence template with safe outputs only.
9. Proceed to evidence review / consolidation in later 04F steps.
10. Do **not** reboot unless a separate approved step authorizes it.
11. Keep parent 04 ACTIVE.
12. Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.

---

## Command boundary summary (quick reference)

| Action | Allowed in default 04F manual execution? |
|--------|------------------------------------------|
| `pm2 list` / safe jlist verification | Yes — required first |
| Baseline `git status --short` + public table count | Yes |
| `pm2 save` after all four online/stable + Keith approval | Yes |
| `pm2 startup systemd -u ubuntu --hp /home/ubuntu` discovery | Yes |
| Exact PM2-provided `sudo env PATH=... pm2 startup ...` after approval | Yes |
| systemd `is-enabled` / `is-active` / safe status | Yes |
| Dump presence check | Yes |
| Reboot | No — separate explicit approval required |
| DNS/TLS / Caddy public routing | No |
| Migrations / `.env` edits / secret printing | No |
| AI / billing / container jobs / Google OAuth | No |
| `pm2 delete` / `pm2 kill` / destructive cleanup | No — unless later approved recovery |

---

**End of runbook.**
