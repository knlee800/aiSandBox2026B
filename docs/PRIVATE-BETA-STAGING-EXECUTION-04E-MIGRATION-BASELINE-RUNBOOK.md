# PRIVATE-BETA-STAGING-EXECUTION-04E — Migration Baseline Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04E  
**Title:** Staging Database Migration Baseline  
**Step:** 2 — Migration Baseline Runbook  
**Date:** 2026-07-27  
**Nature:** Runbook for Keith manual execution inside AWS Lightsail browser SSH. Documentation/runbook creation only in Cursor. No SSH/AWS action in Cursor. No migrations run in Cursor. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## 1. Task identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04E |
| Title | Staging Database Migration Baseline |
| Step | 2 — Migration Baseline Runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessor decision | PRIVATE-BETA-STAGING-EXECUTION-04D3 — Outcome A — Separate approved migration slice |
| Blocks resume of | PRIVATE-BETA-STAGING-EXECUTION-04D PM2 health-only smoke |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL BLOCKER |
| Nature | REAL STAGING EXECUTION — migration baseline (runbook now; manual execution later) |
| Risk | HIGH — first staging schema migration on production-like Lightsail PostgreSQL; secret-bearing `DATABASE_URL`; irreversible schema changes without snapshot rollback |
| Registered | 2026-07-27 |
| Step 1 | COMPLETE (Registration — 2026-07-27) |
| Current step | Step 2 — this runbook |
| 04D status | ACTIVE / BLOCKED pending 04E |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` |
| Decision report | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D3-MIGRATION-BOUNDARY-DECISION-REPORT.md` |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |
| Required pre-migration snapshot | `aisandbox-staging-premigration-2026-07-27` |

### Authoritative state carried forward

* 04E is ACTIVE — Step 1 COMPLETE (Registration — 2026-07-27).
* 04D3 decision: Outcome A — Separate approved migration slice.
* 04D is ACTIVE / BLOCKED pending 04E.
* 04D health smoke remains paused.
* 04D1 SQLite blocker passed VPS retry far enough to reach StartupGuard.
* 04D2 stub-provider blocker passed VPS retry far enough to reach schema validation.
* Current blocker: StartupGuard required schema validation.
* Required missing tables: `usage_records`, `billing_snapshots`, `invoices`.
* Public table count was recorded as `0` before this migration slice.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 2. Purpose

Create and follow a controlled, secret-safe staging database migration baseline so the API Gateway StartupGuard required tables exist before resuming 04D PM2 health-only smoke.

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the later EXECUTION-04E manual execution step.

This Cursor step creates the runbook only. It does **not** execute migration, create tables, SSH, use AWS CLI, or touch secrets.

---

## 3. What 04E does

04E is limited to staging database migration baseline:

1. Require Keith explicit approval before migration execution.
2. Create a pre-migration Lightsail snapshot rollback point and wait until **Available**.
3. Stop all app PM2 processes before migration.
4. Verify repo / build / `.env` permission baseline without printing secrets.
5. Discover and confirm the exact migration command from package evidence.
6. Confirm target database identity safely without printing credentials.
7. Verify pre-migration schema state (expect missing required tables / empty or near-empty public schema).
8. Run the approved TypeORM migration command **once**.
9. Verify required tables exist after migration.
10. Verify migration history.
11. Distinguish schema creation from data seeding / unexpected data mutation.
12. Capture safe evidence only.
13. Keep DNS/TLS, AI/billing/container/OAuth enablement, and 04D PM2 health smoke out of this slice.
14. Leave 04E ready for evidence review; keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.

---

## 4. What 04E does not do

04E must **not**:

* Start PM2 app services (health smoke remains in 04D after 04E evidence review/consolidation).
* Configure DNS/TLS.
* Enable AI provider execution.
* Enable billing/payment execution.
* Enable container execution.
* Enable Google OAuth.
* Print `.env` contents.
* Print `DATABASE_URL`, `REDIS_URL`, passwords, keys, tokens, or provider secrets.
* Modify `.env`.
* Modify source code.
* Modify migration files.
* Create manual SQL tables outside the TypeORM migration system.
* Use `synchronize: true`.
* Enable boot-time `migrationsRun`.
* Use nonexistent `npm run migrate:up`.
* Run migrations more than once after success.
* Run `migration:revert`, `db:reset`, drop/truncate, or other destructive SQL.
* Mark 04D complete.
* Mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.
* Commit or push git.
* Install dependencies or rebuild unless a separately approved blocker requires it (not part of baseline happy path).

---

## 5. Preconditions

Before any migration command:

| # | Precondition | Expected |
|---|--------------|----------|
| 1 | Keith explicit approval for 04E migration execution | Recorded by Keith |
| 2 | This runbook reviewed and accepted | Yes |
| 3 | Pre-migration Lightsail snapshot `aisandbox-staging-premigration-2026-07-27` | Status **Available** |
| 4 | 04A / 04B / 04C | COMPLETE and LOCKED |
| 5 | 04D3 Outcome A | Separate approved migration slice |
| 6 | 04D | ACTIVE / BLOCKED pending 04E — health smoke paused |
| 7 | Repo path | `/opt/aisandbox` |
| 8 | Branch | `main` |
| 9 | VPS commit baseline | `3da1b7c` unless a deliberate later approved sync is documented |
| 10 | `/opt/aisandbox/.env` | Exists — owner/group `ubuntu ubuntu` — mode `600` — values not printed |
| 11 | API Gateway build artifacts | Present after 04C (`dist/data-source.js` and compiled migrations) |
| 12 | PostgreSQL | Online on localhost only (`127.0.0.1:5432`) — database `aisandbox` |
| 13 | Redis | Online locally (not migrated by this task) |
| 14 | App PM2 processes | Stopped before migration |
| 15 | Secrets | Not printed; not pasted into chat |
| 16 | DNS/TLS | Not configured / not attempted in 04E |
| 17 | PRIVATE-BETA-DEPLOYMENT-READINESS | Remains BLOCKED / PAUSED |

If any precondition fails, stop.

---

## 6. Lightsail browser SSH instruction

**All server commands in this runbook must be run inside the AWS Lightsail browser SSH console.**

Do **not** run these commands from local PowerShell, Cursor terminals, AWS CLI, or other remote SSH clients for this task.

To open the Lightsail browser SSH console:

1. Open AWS Lightsail in the browser.
2. Open the staging instance.
3. Click **Connect using SSH** / browser SSH.
4. The browser SSH console opens.

**Nano editor shortcuts in the Lightsail browser SSH session (if needed):**

* Save: `Ctrl+O`, then Enter
* Exit: `Ctrl+X`
* **Do NOT use `Ctrl+W`** in Lightsail browser SSH — it may close the browser tab.

Do **not** use Cursor to SSH, run AWS CLI, create snapshots via API, or execute migration.

---

## 7. Secret safety rules

| # | Rule |
|---|------|
| 1 | Do NOT paste any `.env` file contents into this chat or any AI tool |
| 2 | Do NOT run `cat /opt/aisandbox/.env` |
| 3 | Do NOT run `head`, `tail`, `less`, `more`, or `sed` against `.env` |
| 4 | Do NOT echo secret env values |
| 5 | Do NOT run `env` or `printenv` after sourcing `.env` |
| 6 | Do NOT run `echo $DATABASE_URL` or `echo $REDIS_URL` |
| 7 | Do NOT paste `DATABASE_URL`, `REDIS_URL`, passwords, keys, tokens, or provider credentials |
| 8 | Do NOT paste OAuth secrets |
| 9 | Do NOT paste `pm2 env` full dumps |
| 10 | `/opt/aisandbox/.env` may be sourced privately for migration CLI only — never print it |
| 11 | Capture only safe summary logs; redact any accidental secret before pasting evidence |
| 12 | Do not paste shell history if it may include secret values |
| 13 | If any secret appears in logs or chat, **stop immediately** and rotate exposed secrets |
| 14 | Prefer `sudo -u postgres psql ...` identity checks over any command that would reveal connection strings |

### Forbidden discovery / print commands

Do **not** run:

```bash
cat /opt/aisandbox/.env
env
printenv
echo $DATABASE_URL
echo $REDIS_URL
```

---

## 8. Pre-migration snapshot requirement

**Create this Lightsail snapshot before any migration command.**

### Required snapshot name

```text
aisandbox-staging-premigration-2026-07-27
```

### How to create

* Snapshot is created in **AWS Lightsail UI**, not SSH.
* Open the staging instance → Snapshots → create snapshot with the exact name above.
* Wait until status is **Available**.
* Do **not** run migration if snapshot is **Pending**.
* Do **not** run migration if snapshot creation **failed**.
* Snapshot is the rollback point if migration fails or produces unexpected schema/data changes.

### Optional private DB dump (recommended if practical)

If practical and secret-safe, also create a private `pg_dump` backup on the VPS without printing credentials. Prefer role-based dump via postgres OS user, not connection-string echo. Example pattern (do not paste dump contents into chat):

```bash
mkdir -p /home/ubuntu/backups
sudo -u postgres pg_dump -d aisandbox -Fc -f /home/ubuntu/backups/aisandbox_premigration_2026-07-27.dump
ls -la /home/ubuntu/backups/aisandbox_premigration_2026-07-27.dump
```

Lightsail snapshot remains mandatory even if `pg_dump` is skipped or fails. If dump fails, record warning and continue only if snapshot is Available.

### Stop if

* Snapshot name wrong
* Snapshot not Available
* Snapshot Pending or failed

---

## 9. PM2 stop requirement

Before migration, all app PM2 processes must be stopped.

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
pm2 stop aisandbox-api-gateway aisandbox-ai-service aisandbox-container-manager aisandbox-frontend
pm2 list
```

### Notes

* It is acceptable if some processes are already stopped or were never started.
* Confirm no app process remains in `online` / restarting loop before migration.
* Do **not** run `pm2 save`.
* Do **not** run `pm2 startup`.
* Do **not** start PM2 app services during 04E.
* Do **not** resume 04D health smoke inside 04E.

### Stop if

* Any app PM2 process remains online / restarting and cannot be stopped
* Operator is tempted to start services “just to check” before migration evidence review

---

## 10. Repo and build baseline verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
cd /opt/aisandbox
pwd
git rev-parse --short HEAD
git status --short
git branch --show-current
test -f /opt/aisandbox/services/api-gateway/package.json && echo "API_GATEWAY_PKG=yes" || echo "API_GATEWAY_PKG=no"
test -f /opt/aisandbox/services/api-gateway/dist/data-source.js && echo "DIST_DATA_SOURCE=yes" || echo "DIST_DATA_SOURCE=no"
test -d /opt/aisandbox/services/api-gateway/dist/src/migrations && echo "DIST_MIGRATIONS_DIR=yes" || echo "DIST_MIGRATIONS_DIR=no"
ls /opt/aisandbox/services/api-gateway/dist/src/migrations 2>/dev/null | wc -l
stat -c "%U %G %a %n" /opt/aisandbox/.env
```

### Expected / acceptable

| Check | Expected |
|-------|----------|
| Path | `/opt/aisandbox` |
| Branch | `main` |
| Commit | `3da1b7c` unless deliberate approved successor sync is documented |
| `git status --short` | Clean, or only previously known non-secret local runtime artifacts; stop if unexpected tracked/source drift |
| `API_GATEWAY_PKG` | `yes` |
| `DIST_DATA_SOURCE` | `yes` (required for `migration:run:prod`) |
| `DIST_MIGRATIONS_DIR` | `yes` |
| Compiled migration file count | > 0 |
| `.env` stat | `ubuntu ubuntu 600 /opt/aisandbox/.env` |

### Stop if

* Repo path wrong
* Branch unexpected
* Commit unexpected without documented approval
* `git status` shows unexpected source/migration/env drift
* `.env` missing or permission not `600`
* `dist/data-source.js` missing
* Compiled migrations directory missing/empty

Do **not** install dependencies or rebuild in the happy path. If build artifacts are missing, stop and register/resolve a build blocker separately — do not improvise.

---

## 11. Migration command discovery

**Run inside AWS Lightsail browser SSH — not PowerShell. Discovery only — do not migrate yet.**

```bash
cd /opt/aisandbox/services/api-gateway
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts||{}, null, 2))"
```

### Source/package-grounded discovery result (repo evidence for this runbook)

From `services/api-gateway/package.json`:

| Script | Exists? | Command |
|--------|---------|---------|
| `migrate:up` | **No** | Not present — do not use |
| `migration:run:prod` | **Yes** | `typeorm migration:run -d dist/data-source.js` |
| `migration:run` | **Yes** | `typeorm-ts-node-commonjs migration:run -d data-source.ts` |
| `migration:show` | **Yes** | `typeorm-ts-node-commonjs migration:show -d data-source.ts` |
| `migration:revert` | **Yes** | Present — **do not run** in 04E unless separately approved |

### Config evidence

| Item | Finding |
|------|---------|
| CLI data source | `services/api-gateway/data-source.ts` → compiled `dist/data-source.js` |
| Connection | `DATABASE_URL` only (required by data-source) |
| Active migrations glob | `src/migrations/*.{ts,js}` relative to data-source `__dirname` |
| Legacy folder | `services/api-gateway/migrations/` exists but is **not** wired to current CLI — do not use |
| `synchronize` | `false` in `data-source.ts` and `database.config.ts` |
| Boot-time `migrationsRun` | Not enabled in runtime TypeORM config |
| Migration history table | No custom `migrationsTableName` — TypeORM default table name is `migrations` |

### StartupGuard note

StartupGuard remediation text may still say `npm run migrate:up`. That script **does not exist**. Ignore that string. Use the package.json-grounded command below.

---

## 12. Migration command selection

### Selected command (authoritative for built VPS)

```text
npm run migration:run:prod
```

### Justification

1. VPS already completed 04C dependency install + build; `dist/data-source.js` is the intended prod CLI entry.
2. `package.json` defines `migration:run:prod` as `typeorm migration:run -d dist/data-source.js`.
3. 04D3 decision report and 04E registration prefer `migration:run:prod` on built VPS.
4. `migrate:up` is unavailable.
5. `migration:run` (ts-node / source path) is an **alternative only** if `migration:run:prod` cannot be used because compiled artifacts are missing — and that case is a stop/rebuild blocker, not the default path.
6. Do **not** use `synchronize: true`.
7. Do **not** enable boot-time `migrationsRun`.
8. Do **not** create manual SQL tables.

### Alternative (not preferred)

```text
npm run migration:run
```

Use only if package/discovery evidence on VPS proves `migration:run:prod` is unavailable **and** Keith separately approves the ts-node path after documenting why. For this runbook’s happy path, prefer stopping over silently switching.

### Forbidden commands

* `npm run migrate:up`
* `npm run migration:revert`
* any `db:reset` / drop / truncate / delete-from-all-tables improvisation
* TypeORM synchronize enablement
* boot-time auto-migrate

---

## 13. Target database verification without printing credentials

**Run inside AWS Lightsail browser SSH — not PowerShell.**

### 13A — `.env` permission and DATABASE_URL key presence only

```bash
cd /opt/aisandbox
stat -c "%U %G %a %n" /opt/aisandbox/.env
python3 - <<'PY'
from pathlib import Path
text = Path('/opt/aisandbox/.env').read_text(encoding='utf-8', errors='replace')
keys = set()
for line in text.splitlines():
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k = s.split('=', 1)[0].strip()
    keys.add(k)
print(f'DATABASE_URL_PRESENT={"yes" if "DATABASE_URL" in keys else "no"}')
print('ENV_KEY_SCAN=done')
PY
```

Expected:

* `ubuntu ubuntu 600 /opt/aisandbox/.env`
* `DATABASE_URL_PRESENT=yes`

Do **not** print the value.

### 13B — Safe local PostgreSQL identity checks

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT current_database();"
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

Expected:

* `current_database()` → `aisandbox`
* Public table count before first successful migration baseline → historically `0`; if non-zero, stop and investigate before migrating

### 13C — Load DATABASE_URL privately for CLI without printing

TypeORM CLI reads `process.env.DATABASE_URL` from `data-source` / `dist/data-source.js`.

```bash
cd /opt/aisandbox/services/api-gateway
set -a
. /opt/aisandbox/.env
set +a
python3 - <<'PY'
import os
v = os.environ.get('DATABASE_URL')
print('DATABASE_URL_LOADED=yes' if v else 'DATABASE_URL_LOADED=no')
if v:
    # presence/shape only — no password/host/user dump
    print(f'DATABASE_URL_SCHEME_OK={"yes" if v.startswith(("postgres://", "postgresql://")) else "no"}')
    print(f'DATABASE_URL_LEN={len(v)}')
PY
```

Expected:

* `DATABASE_URL_LOADED=yes`
* `DATABASE_URL_SCHEME_OK=yes`
* Length reported only; **no raw URL printed**

### Stop if

* `.env` missing or not mode `600`
* `DATABASE_URL` key missing
* Target DB is not `aisandbox`
* Any command would print secrets
* Migration command would use wrong DB or unclear DB
* Operator cannot confirm DB identity safely

---

## 14. Pre-migration schema state verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='usage_records') THEN 'usage_records=yes' ELSE 'usage_records=no' END;"
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='billing_snapshots') THEN 'billing_snapshots=yes' ELSE 'billing_snapshots=no' END;"
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN 'invoices=yes' ELSE 'invoices=no' END;"
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='migrations') THEN 'migrations_table=yes' ELSE 'migrations_table=no' END;"
```

### Expected before first baseline migration

| Check | Expected |
|-------|----------|
| Public table list | Empty (or only unexpected leftovers — stop if leftovers found) |
| `usage_records` | `no` |
| `billing_snapshots` | `no` |
| `invoices` | `no` |
| TypeORM `migrations` table | `no` on clean DB |

### Required-table mapping (why these three matter)

| Required table | Entity | Creating migration |
|----------------|--------|--------------------|
| `usage_records` | `UsageRecord` (`src/entities/usage-record.entity.ts`) | `1738843200000-CreateUsageRecordsTable.ts` |
| `billing_snapshots` | `BillingSnapshot` (`src/entities/billing-snapshot.entity.ts`) | `1738843300000-CreateBillingSnapshotsTable.ts` |
| `invoices` | `Invoice` (`src/entities/invoice.entity.ts`) | `1738900000000-CreateInvoicesTable.ts` |

Follow-on migrations in the active chain also alter `usage_records` and create broader app schema. Full CLI migrate is required; do **not** create only these three tables manually.

### Stop if

* Required tables already exist unexpectedly without migration history explanation
* Partial/manual schema already present
* Pre-migration state is unclear

---

## 15. Migration execution command

**Keith explicit approval + Available snapshot + PM2 stopped + preflight PASS required.**

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Run migration **only once**.

```bash
cd /opt/aisandbox/services/api-gateway
set -a
. /opt/aisandbox/.env
set +a
npm run migration:run:prod
echo "MIGRATION_RUN_PROD_EXIT=$?"
```

### Execution boundaries

* Run migration only once.
* Do not rerun after success.
* If migration fails, stop and capture safe final error lines only.
* Do not manually fix the database.
* Do not run SQL manually to create/alter/drop tables.
* Do not use destructive commands.
* Do not run `migration:revert`.
* Do not enable `synchronize:true`.
* Do not enable boot-time migrations.
* Do not start PM2 during/after migration inside 04E.
* Do not configure DNS/TLS.
* Do not enable AI/billing/container/OAuth execution.

### Safe output capture

Preserve:

* Command name selected (`migration:run:prod`)
* Exit code
* Migration names / “Migration ... has been executed” style lines
* Final error lines only if failed (redact secrets if any appear)

Do **not** preserve connection strings, passwords, or `.env` dumps.

### Stop if

* Exit code non-zero
* Command unclear / wrong script selected
* Output indicates wrong database
* Output appears to print secrets
* Operator is about to rerun after failure without new approval / snapshot reassessment

---

## 16. Post-migration table verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='usage_records') THEN 'usage_records=yes' ELSE 'usage_records=no' END;"
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='billing_snapshots') THEN 'billing_snapshots=yes' ELSE 'billing_snapshots=no' END;"
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN 'invoices=yes' ELSE 'invoices=no' END;"
```

### Expected

| Check | Expected |
|-------|----------|
| `usage_records` | `yes` |
| `billing_snapshots` | `yes` |
| `invoices` | `yes` |
| Full public table list | Many application tables (full migration chain), not only the three StartupGuard tables |

### Stop if

* Any required table still missing after migration exit 0 claim
* Table list empty after claimed success
* Unexpected destructive absence of critical tables

---

## 17. Migration history verification

TypeORM default migration table name (no custom `migrationsTableName` in data-source): **`migrations`**.

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='migrations') THEN 'migrations_table=yes' ELSE 'migrations_table=no' END;"
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM migrations;"
sudo -u postgres psql -d aisandbox -tAc "SELECT id, timestamp, name FROM migrations ORDER BY id;"
```

### Expected

* `migrations_table=yes`
* Count > 0 and matches applied migration chain volume (dozens of records on clean full baseline)
* Names include at least:
  * `CreateUsageRecordsTable1738843200000` (or equivalent recorded name)
  * `CreateBillingSnapshotsTable1738843300000`
  * `CreateInvoicesTable1738900000000`

If the `migrations` table name differs unexpectedly, stop and capture evidence — do not invent a second migration run.

Optional compiled show command is **not** required for 04E if SQL history verification succeeds. If used, ensure `DATABASE_URL` is loaded privately and secrets are not printed:

```bash
cd /opt/aisandbox/services/api-gateway
set -a
. /opt/aisandbox/.env
set +a
# Optional; ts-node path — skip if unavailable or risky
npm run migration:show
```

Prefer the SQL history checks above for evidence.

---

## 18. Data-seeding / data-change verification

Distinguish **schema creation** from **data seeding**.

### Required StartupGuard tables — row counts

If tables exist, run:

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT 'usage_records=' || COUNT(*) FROM usage_records;"
sudo -u postgres psql -d aisandbox -tAc "SELECT 'billing_snapshots=' || COUNT(*) FROM billing_snapshots;"
sudo -u postgres psql -d aisandbox -tAc "SELECT 'invoices=' || COUNT(*) FROM invoices;"
```

### Expected for required tables

| Table | Expected rows on clean staging baseline |
|-------|------------------------------------------|
| `usage_records` | `0` |
| `billing_snapshots` | `0` |
| `invoices` | `0` |

Creating migrations for these three tables are schema-only (no seed inserts).

### Known expected reference-data seed elsewhere in the chain

From source review (`1771589000000-AddPlansFoundation.ts`):

* Upserts plan rows `free` and `pro` into `plans`.
* May update existing users’ plan columns; no-op if no users.

Safe optional check:

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='plans') THEN 'plans=yes' ELSE 'plans=no' END;"
sudo -u postgres psql -d aisandbox -tAc "SELECT 'plans=' || COUNT(*) FROM plans;"
sudo -u postgres psql -d aisandbox -tAc "SELECT code FROM plans ORDER BY code;"
```

Expected if `plans` exists:

* `plans=2` (or at least `free` and `pro` present)
* Codes include `free`, `pro`

Also known no-op-on-empty behaviors:

* Workspace backfill with no users → no-op
* `usage_records` null-cleanup deletes during harden migration → no-op on empty table

### Stop if

* Required tables have unexpected non-zero business rows
* Large unexpected data mutation / import appears
* Evidence suggests payment/AI execution data was written by migration (not expected)

---

## 19. No DNS/TLS confirmation

Confirm during evidence capture:

* No DNS records created/changed for 04E
* No TLS certificates requested/installed
* No Caddy site enablement for public hostname in 04E

04E is database migration baseline only.

---

## 20. No AI/billing/container/OAuth enablement confirmation

Confirm during evidence capture:

* No AI provider execution enabled
* No billing/payment charges enabled
* No container execution enabled
* No Google OAuth enablement
* Kill switches / execution gates remain as previously prepared private-beta posture
* Migration schema/reference-data only does **not** authorize paid or live provider traffic

Do **not** print env values to “prove” kill-switch state. Record process confirmation only.

---

## 21. No secret printing confirmation

Confirm during evidence capture:

* No `.env` contents printed
* No `DATABASE_URL` / `REDIS_URL` printed
* No passwords, keys, tokens, or provider credentials pasted into chat
* Accidental secret exposure → stop + rotate

---

## 22. Stop conditions

Stop immediately if any of the following occur:

1. Pre-migration snapshot not Available.
2. Snapshot Pending or failed.
3. PM2 app services not stopped.
4. Repo status unexpected (wrong branch/commit, unexpected dirty tracked files).
5. `.env` missing or permission not `600`.
6. Migration command unclear.
7. `migration:run:prod` missing when expected.
8. `dist/data-source.js` or compiled migrations missing.
9. Target database cannot be safely confirmed.
10. Any command would print secrets.
11. Migration command would use wrong DB or unclear DB.
12. Migration command would run destructive/down/reset/drop/truncate operations.
13. Migration command would enable `synchronize:true`.
14. Migration command would enable boot-time migrations.
15. Operator about to use nonexistent `migrate:up`.
16. Migration fails (non-zero exit).
17. Required tables still missing after migration.
18. Unexpected data seeding or data mutation.
19. DNS/TLS attempted.
20. PM2 services started during 04E.
21. AI/billing/container/OAuth execution enabled.
22. Secret disclosed.
23. Git status unexpected / unauthorized commit/push pressure.
24. Manual SQL table creation attempted.
25. Desire to rerun migration after success or after unresolved failure without new approval.

On stop: preserve safe outputs, do not improvise fixes, keep deployment readiness blocked, escalate via evidence review.

---

## 23. Rollback / restore guidance

* Do **not** attempt ad hoc SQL rollback.
* Do **not** run `migration:revert` unless separately approved in a later registered task.
* Do **not** drop tables manually to “retry clean.”
* If migration causes severe failure or unexpected schema/data changes, **stop** and use Lightsail snapshot restore path as rollback:
  * Snapshot name: `aisandbox-staging-premigration-2026-07-27`
* Optional `pg_dump` file may assist investigation but snapshot restore is the primary host/DB rollback path for severe failure.
* Preserve all safe outputs for evidence.
* Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.
* Do not resume 04D until 04E evidence review/consolidation passes after a successful baseline (or after an approved remediation path).

---

## 24. Expected final state

After future manual execution, expected final state:

* Pre-migration snapshot `aisandbox-staging-premigration-2026-07-27` Available.
* PM2 app services stopped during migration.
* Migration command `npm run migration:run:prod` ran once.
* Migration exit code `0`.
* Required tables exist:
  * `usage_records`
  * `billing_snapshots`
  * `invoices`
* Migration history table `migrations` reflects applied migrations.
* Required tables row counts are `0`.
* `plans` reference seed (`free`, `pro`) is acceptable if present.
* No unexpected business-data seeding.
* No DNS/TLS configured.
* No PM2 health smoke resumed inside 04E.
* No AI/billing/container/OAuth execution enabled.
* No secrets disclosed.
* 04E ready for evidence review.
* 04D remains blocked until 04E is reviewed/consolidated, then 04D can resume PM2 health-only smoke.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 25. Safe evidence template

Keith can paste the following after manual execution. Fill with safe values only.

```text
PRIVATE-BETA-STAGING-EXECUTION-04E — Manual Migration Evidence

Date:
Operator: Keith
Execution venue: AWS Lightsail browser SSH only

1) Snapshot
- Name: aisandbox-staging-premigration-2026-07-27
- Status: Available / Pending / Failed
- Optional pg_dump created: yes/no
- Optional pg_dump path (no contents): 

2) PM2 stop
- Commands run: pm2 stop ... ; pm2 list
- aisandbox-api-gateway: stopped/already stopped/missing
- aisandbox-ai-service: stopped/already stopped/missing
- aisandbox-container-manager: stopped/already stopped/missing
- aisandbox-frontend: stopped/already stopped/missing
- pm2 save run?: no
- pm2 startup run?: no

3) Repo / build baseline
- pwd:
- branch:
- commit:
- git status --short summary:
- API_GATEWAY_PKG:
- DIST_DATA_SOURCE:
- DIST_MIGRATIONS_DIR:
- compiled migration file count:
- .env stat only:

4) Migration command discovery
- migrate:up present?: no/yes
- migration:run:prod present?: yes/no
- migration:run present?: yes/no
- Selected command:
- Selection justification:

5) Target DB verification (no secrets)
- DATABASE_URL_PRESENT:
- DATABASE_URL_LOADED:
- DATABASE_URL_SCHEME_OK:
- current_database():
- pre-migration public table count:
- pre-migration required tables:
  - usage_records=
  - billing_snapshots=
  - invoices=

6) Migration execution
- Command executed once?: yes/no
- MIGRATION_RUN_PROD_EXIT=
- Safe final output summary (names/status only):

7) Post-migration verification
- usage_records=
- billing_snapshots=
- invoices=
- Full public table list (safe):

8) Migration history
- migrations_table=
- migrations count=
- key migration names present?: yes/no
- notes:

9) Data-seeding checks
- usage_records count=
- billing_snapshots count=
- invoices count=
- plans present?=
- plans count/codes=
- Unexpected data mutation?: yes/no
- notes:

10) Boundary confirmations
- No DNS/TLS: yes/no
- No PM2 app startup during 04E: yes/no
- No AI execution enablement: yes/no
- No billing/payment enablement: yes/no
- No container execution enablement: yes/no
- No Google OAuth enablement: yes/no
- No secrets printed: yes/no
- No .env values pasted: yes/no
- No DATABASE_URL printed: yes/no

11) Warnings / unexpected output
- 

12) Stop conditions hit?
- none / list:

13) Proposed next step
- 04E evidence review
- Keep 04D blocked until 04E reviewed/consolidated
- Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED
```

### Evidence prohibitions

No `.env` values. No `DATABASE_URL`. No passwords, keys, tokens, provider credentials. No full secret-bearing log dumps.

---

## 26. Exact next action

After this runbook is created:

1. Keith reviews this runbook.
2. Keith confirms explicit approval for migration execution.
3. Keith creates the pre-migration Lightsail snapshot named exactly:

```text
aisandbox-staging-premigration-2026-07-27
```

4. Keith waits until snapshot status is **Available**.
5. Keith manually executes 04E in AWS Lightsail browser SSH using this runbook.
6. Keith pastes the safe evidence template into the next evidence-review step.

**Do not proceed to manual execution inside Cursor.**

After successful evidence review and consolidation, 04D may resume PM2 health-only smoke. Until then:

* 04D remains ACTIVE / BLOCKED pending 04E
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED

---

## Runbook validation checklist (Step 2)

- [x] Runbook file path: `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-MIGRATION-BASELINE-RUNBOOK.md`
- [x] Sections 1–26 present
- [x] Migration command source/package-grounded (`migration:run:prod`; no `migrate:up`)
- [x] Snapshot requirement present
- [x] PM2 stop requirement present
- [x] Secret safety rules present
- [x] Target DB verification avoids printing credentials
- [x] Migration is one-shot only
- [x] Post-migration required-table verification present
- [x] Stop conditions present
- [x] Rollback guidance present
- [x] Safe evidence template present

---

**End of runbook.**
