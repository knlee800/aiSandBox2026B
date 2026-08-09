# ADMIN-CONSOLE-01E Step 3 — Controlled Staging Execution Runbook

**Purpose:** Operator execution runbook for Keith, guided by ChatGPT one step at a time.
**Created:** 2026-08-07
**Task:** ADMIN-CONSOLE-01E — Staging Operator Validation + Parent Consolidation
**Step:** 3 of 4 — Controlled staging execution + sequential browser validation
**Status:** EXECUTION RUNBOOK — NOT a completion checkpoint

---

## How to Use This Runbook

1. Keith opens this runbook and gives it to ChatGPT.
2. ChatGPT guides Keith **one step at a time**.
3. Keith performs each action in the specified location (Lightsail SSH, staging browser, or DevTools).
4. Keith returns the output/observation to ChatGPT.
5. ChatGPT evaluates PASS/STOP before proceeding to the next step.
6. If any step hits a STOP condition, do not continue. Report the exact blocker.

**ChatGPT must not skip steps, combine steps, or proceed past a STOP condition.**

---

## PHASE 0 — Preconditions

### Verified Before Execution

| Item | Status |
|------|--------|
| ADMIN-CONSOLE-01A | COMPLETE AND LOCKED — 2026-08-07 |
| ADMIN-CONSOLE-01B | COMPLETE AND LOCKED — 2026-08-07 |
| ADMIN-CONSOLE-01C | COMPLETE AND LOCKED — 2026-08-07 |
| ADMIN-CONSOLE-01D | COMPLETE AND LOCKED — 2026-08-07 |
| ADMIN-CONSOLE-01E Step 1 | COMPLETE (Registration) |
| ADMIN-CONSOLE-01E Step 2 | COMPLETE (Stage-start) |
| ADMIN-CONSOLE-01E Step 3 | APPROVED BY KEITH |
| Deploy target commit | `60fba74e02256f0a3ed3e757350e6d7117e5ceda` |
| Deploy branch | `main` / `origin/main` |
| Staging access | Keith via AWS Lightsail browser SSH only |
| Claude/Cursor SSH | NOT available — runbook execution only |
| Pending migration | `1772900000000-AddAdminGrantAuditColumns` |
| GLOBAL_EXECUTION_ENABLED | Must remain `false` throughout |

### What This Runbook Deploys

ADMIN-CONSOLE-01A through 01D product code:

- Admin audit schema migration (granted_by_user_id, reason columns + partial index on credit_grants)
- Admin credit grant API endpoint (`POST /api/admin/users/:userId/credits`)
- Admin console frontend shell (`/{locale}/admin`, `/{locale}/admin/users/{userId}`)
- Admin credit grant UI (Add Credits panel on user detail)

### PM2 Services

| Service | Action in This Runbook |
|---------|----------------------|
| `aisandbox-api-gateway` | Rebuild + restart |
| `aisandbox-frontend` | Rebuild + restart |
| `aisandbox-ai-service` | **DO NOT RESTART** |
| `aisandbox-container-manager` | **DO NOT RESTART** |

---

## PHASE 1 — Pre-Deploy Inspection

### Step 1.1 — Git Status

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
git -C /opt/aisandbox status
```

**Expected output:** Clean working tree. No uncommitted changes.

**PASS condition:** Output shows `nothing to commit, working tree clean` (or equivalent).

**STOP condition:** If there are unexpected local modifications (modified/untracked files), STOP and report the exact output. Do not proceed until resolved.

**Evidence to return:** Full command output.

---

### Step 1.2 — Current HEAD and Recent Log

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
git -C /opt/aisandbox rev-parse HEAD && git -C /opt/aisandbox log --oneline -5 && git -C /opt/aisandbox branch
```

**Expected output:** Current HEAD commit hash, last 5 commits, and current branch (`main` or `* main`).

**PASS condition:** Output shows valid commit history on `main` branch. No detached HEAD.

**STOP condition:** If on wrong branch or detached HEAD, STOP.

**Evidence to return:** Full command output. Record the current HEAD as `PRE_DEPLOY_HEAD`.

---

### Step 1.3 — PM2 Status

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
pm2 list
```

**Expected output:** All four apps listed. At minimum `aisandbox-api-gateway` and `aisandbox-frontend` should show `online` status.

**PASS condition:** Both `aisandbox-api-gateway` and `aisandbox-frontend` are `online`.

**STOP condition:** If either is errored/stopped, investigate before proceeding.

**Evidence to return:** Full PM2 list output.

---

## PHASE 2 — Backup

### Step 2.1 — Create Timestamped Backup Directory

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING (backup directory creation only — no staging app/DB mutation)

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_ROOT="/opt/aisandbox-backups/admin-console-01e-${STAMP}"
mkdir -p "${BACKUP_ROOT}"
echo "BACKUP_ROOT=${BACKUP_ROOT}"
```

**Expected output:** `BACKUP_ROOT=/opt/aisandbox-backups/admin-console-01e-<timestamp>`

**PASS condition:** Directory created. `BACKUP_ROOT` value printed.

**STOP condition:** Permission denied or path error.

**Evidence to return:** The exact `BACKUP_ROOT` path printed.

---

### Step 2.2 — Capture Pre-Deploy State

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING (backup files only)

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_ROOT="/opt/aisandbox-backups/admin-console-01e-${STAMP}"
mkdir -p "${BACKUP_ROOT}"

git -C /opt/aisandbox rev-parse HEAD > "${BACKUP_ROOT}/predeploy-head.txt"
git -C /opt/aisandbox log --oneline -5 > "${BACKUP_ROOT}/predeploy-log.txt"
git -C /opt/aisandbox status > "${BACKUP_ROOT}/predeploy-status.txt"

sudo -u postgres psql -d aisandbox -tAc "SELECT id, timestamp, name FROM migrations ORDER BY id;" > "${BACKUP_ROOT}/migrations-before.txt"

sudo -u postgres psql -d aisandbox -tAc "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_grants' ORDER BY ordinal_position;" > "${BACKUP_ROOT}/credit_grants-columns-before.txt"

cp /opt/aisandbox/.env "${BACKUP_ROOT}/env.backup"
chmod 600 "${BACKUP_ROOT}/env.backup"

pm2 list > "${BACKUP_ROOT}/pm2-list-before.txt"

cp -a /opt/aisandbox/services/api-gateway/dist "${BACKUP_ROOT}/api-gateway-dist"

cp -a /opt/aisandbox/frontend/.next "${BACKUP_ROOT}/frontend-next" 2>/dev/null || true

echo "BACKUP_ROOT=${BACKUP_ROOT}"
ls -la "${BACKUP_ROOT}/"
```

**IMPORTANT:** Do NOT print .env contents. The copy is for rollback only.

**Expected output:** Listing of backup directory showing all captured files/dirs.

**PASS condition:** All files/dirs present in listing: `predeploy-head.txt`, `predeploy-log.txt`, `predeploy-status.txt`, `migrations-before.txt`, `credit_grants-columns-before.txt`, `env.backup`, `pm2-list-before.txt`, `api-gateway-dist/`, `frontend-next/` (frontend-next may be absent if no prior build — acceptable).

**STOP condition:** psql connection failure or permission errors.

**Evidence to return:** The `BACKUP_ROOT` path and the `ls -la` listing.

---

## PHASE 3 — Git Source Sync

### Step 3.1 — Fetch Origin

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY (fetch only)

```bash
git -C /opt/aisandbox fetch origin
```

**Expected output:** Fetch completes (may show updates or already up to date).

**PASS condition:** No errors.

**Evidence to return:** Full output.

---

### Step 3.2 — Inspect Origin/Main

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
git -C /opt/aisandbox log origin/main --oneline -5
```

**Expected output:** Recent commits on origin/main. The target commit `60fba74e02` should be visible.

**PASS condition:** `60fba74e02` appears in the log. If there are newer commits beyond it, list them and STOP for evaluation before merge. Do not deploy unrelated unexpected commits without review.

**STOP condition:** Target commit not found, or unexpected newer commits that were not part of ADMIN-CONSOLE-01A–01D.

**Evidence to return:** Full log output.

---

### Step 3.3 — Fast-Forward Merge

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING — SOURCE TREE

```bash
git -C /opt/aisandbox merge --ff-only origin/main
```

**Expected output:** Fast-forward merge succeeds.

**PASS condition:** Merge completes with `Fast-forward` or `Already up to date`.

**STOP condition:** If `--ff-only` fails (diverged branches, conflicts), STOP immediately. Do NOT use `git reset --hard` or force merge without explicit approval.

**Evidence to return:** Full merge output.

---

### Step 3.4 — Verify HEAD

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
git -C /opt/aisandbox rev-parse HEAD
```

**Expected output:** `60fba74e02256f0a3ed3e757350e6d7117e5ceda`

**PASS condition:** HEAD matches the locked deploy target exactly.

**STOP condition:** HEAD does not match. Report the actual HEAD.

**Evidence to return:** The HEAD hash.

---

## PHASE 4 — API Gateway Build

### Step 4.1 — Build API Gateway

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING (build artifacts only)

```bash
cd /opt/aisandbox/services/api-gateway && npm run build
```

**Expected output:** TypeScript compilation succeeds without errors.

**PASS condition:** Build exits with code 0. No compilation errors.

**STOP condition:** Build failure. Report exact error output. Do not proceed to migration or restart.

**Evidence to return:** Last ~20 lines of build output showing success/failure.

---

### Step 4.2 — Verify Build Artifacts

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
test -f /opt/aisandbox/services/api-gateway/dist/data-source.js && echo "DIST_DATA_SOURCE=yes" || echo "DIST_DATA_SOURCE=no"
test -f /opt/aisandbox/services/api-gateway/dist/src/migrations/1772900000000-AddAdminGrantAuditColumns.js && echo "DIST_MIGRATION=yes" || echo "DIST_MIGRATION=no"
```

**Expected output:**
```
DIST_DATA_SOURCE=yes
DIST_MIGRATION=yes
```

**PASS condition:** Both are `yes`.

**STOP condition:** Either is `no`. Build did not produce expected artifacts.

**Evidence to return:** Both lines of output.

---

## PHASE 5 — Migration Precheck

### Step 5.1 — Verify DATABASE_URL

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
cd /opt/aisandbox/services/api-gateway && set -a && . /opt/aisandbox/.env && set +a && python3 - <<'PY'
import os
v=os.environ.get('DATABASE_URL')
print('DATABASE_URL_LOADED=yes' if v else 'DATABASE_URL_LOADED=no')
print(f'DATABASE_URL_SCHEME_OK={"yes" if v and v.startswith(("postgres://","postgresql://")) else "no"}')
PY
```

**IMPORTANT:** Do NOT print the actual DATABASE_URL value.

**Expected output:**
```
DATABASE_URL_LOADED=yes
DATABASE_URL_SCHEME_OK=yes
```

**PASS condition:** Both `yes`.

**STOP condition:** Either `no`. Environment not properly configured.

**Evidence to return:** Both lines.

---

### Step 5.2 — Migration Show (Pending Status)

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
cd /opt/aisandbox/services/api-gateway && set -a && . /opt/aisandbox/.env && set +a && npx typeorm migration:show -d dist/data-source.js
```

**Expected output:** List of migrations. `1772900000000-AddAdminGrantAuditColumns` should appear with a `[ ]` (not yet run) or `[X]` (already run) marker.

**PASS condition:** Migration appears in list. If `[ ]` (pending), proceed. If `[X]` (already applied), STOP — unexpected prior application.

**STOP condition:** Migration not found in list, or already applied unexpectedly.

**Evidence to return:** Full migration show output.

---

### Step 5.3 — Schema Precheck (Credit Grants Table)

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='credit_grants') THEN 'credit_grants=yes' ELSE 'credit_grants=no' END;"
```

**Expected output:** `credit_grants=yes`

**PASS condition:** Table exists.

**STOP condition:** Table does not exist.

**Evidence to return:** Output line.

---

### Step 5.4 — Schema Precheck (New Columns Absent)

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_grants' AND column_name IN ('granted_by_user_id','reason') ORDER BY 1;"
```

**Expected output:** Empty (no rows returned) — columns do not exist yet.

**PASS condition:** No output (columns absent). This is the clean pre-state.

**STOP condition:** If either `granted_by_user_id` or `reason` appears, STOP — unexpected partial prior application. Report exact output.

**Evidence to return:** Output (should be empty).

---

### Step 5.5 — Schema Precheck (New Index Absent)

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='credit_grants' AND indexname='idx_credit_grants_granted_by';"
```

**Expected output:** Empty (no rows) — index does not exist yet.

**PASS condition:** No output (index absent).

**STOP condition:** If index appears, STOP — unexpected prior partial state.

**Evidence to return:** Output (should be empty).

---

### Step 5.6 — Schema Precheck (Migration History Absent)

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT name FROM migrations WHERE name LIKE '%AddAdminGrantAuditColumns%' OR timestamp=1772900000000;"
```

**Expected output:** Empty (no rows) — migration has not been recorded.

**PASS condition:** No output (not in history).

**STOP condition:** If migration name appears, STOP — already applied.

**Evidence to return:** Output (should be empty).

---

### Step 5.7 — Precheck Summary

**Where:** ChatGPT evaluation (no action by Keith)

ChatGPT must verify all of the following before authorizing Phase 6:

- [ ] `credit_grants` table exists
- [ ] `granted_by_user_id` column is ABSENT
- [ ] `reason` column is ABSENT
- [ ] `idx_credit_grants_granted_by` index is ABSENT
- [ ] Migration not in history
- [ ] Migration shows as pending in `migration:show`

If all pass, proceed to Phase 6. If any fail, STOP.

---

## PHASE 6 — Database Migration

### Step 6.1 — Run Migration

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING — DATABASE SCHEMA
**Rollback significance:** HIGH — additive schema change. See Rollback Matrix.

```bash
cd /opt/aisandbox/services/api-gateway && set -a && . /opt/aisandbox/.env && set +a && npm run migration:run:prod
```

**Expected output:** Migration runs successfully. Should show migration name and confirmation.

**PASS condition:** Exit code 0. Output indicates migration applied (typically shows `query: ALTER TABLE ...` and `Migration ... has been executed successfully`).

**STOP condition:** Any error during migration. STOP immediately. Do NOT retry. Do NOT run `migration:revert`. Report exact error output.

**Evidence to return:** Full migration output.

**Do NOT combine this step with API restart or any other action.**

---

## PHASE 7 — Migration Verification

### Step 7.1 — Verify Migration Show (Applied)

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
cd /opt/aisandbox/services/api-gateway && set -a && . /opt/aisandbox/.env && set +a && npx typeorm migration:show -d dist/data-source.js
```

**Expected output:** `1772900000000-AddAdminGrantAuditColumns` now shows `[X]` (applied).

**PASS condition:** Migration marked as applied.

**STOP condition:** Still pending or missing.

**Evidence to return:** Full output.

---

### Step 7.2 — Verify New Columns

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_grants' AND column_name IN ('granted_by_user_id','reason') ORDER BY 1;"
```

**Expected output:**
```
granted_by_user_id|uuid|YES
reason|text|YES
```

**PASS condition:** Both columns present with correct types and nullable=YES.

**STOP condition:** Either column missing or wrong type/nullability.

**Evidence to return:** Full output.

---

### Step 7.3 — Verify Partial Index

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='credit_grants' AND indexname='idx_credit_grants_granted_by';"
```

**Expected output:** Index exists with a definition containing `WHERE (granted_by_user_id IS NOT NULL)` (or equivalent).

**PASS condition:** Index present with correct partial predicate.

**STOP condition:** Index missing or wrong predicate.

**Evidence to return:** Full output including the `indexdef`.

---

### Step 7.4 — Verify Migration History (Exactly Once)

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT id, timestamp, name FROM migrations WHERE timestamp=1772900000000 OR name LIKE '%AddAdminGrantAuditColumns%';"
```

**Expected output:** Exactly one row containing the migration.

**PASS condition:** Exactly one row. Migration recorded once.

**STOP condition:** Zero rows (not recorded) or more than one row (duplicate).

**Evidence to return:** Full output.

**Do NOT run the migration again regardless of this result.**

---

## PHASE 8 — API Gateway Restart + Health

### Step 8.1 — Restart API Gateway

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING — RUNTIME
**Rollback significance:** HIGH — if API fails to boot, admin console and existing platform features may be affected.

```bash
pm2 restart aisandbox-api-gateway --update-env
```

**Note:** `--update-env` is required per prior staging lesson (04I3A) to ensure PM2 picks up current environment.

**Expected output:** PM2 confirms restart.

**PASS condition:** No immediate error from PM2.

**Evidence to return:** PM2 restart output.

---

### Step 8.2 — Wait and Check PM2 Status

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sleep 5 && pm2 list
```

**Expected output:** `aisandbox-api-gateway` shows `online` status with low restart count.

**PASS condition:** `aisandbox-api-gateway` is `online`. Restart count should be 0 or 1 (just restarted).

**STOP condition:** Status shows `errored` or `stopped`, or restart count is rapidly incrementing (crash loop).

**Evidence to return:** Full PM2 list.

---

### Step 8.3 — API Health Check

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
curl -si http://127.0.0.1:4000/api/health | head -5
```

**Expected output:** HTTP 200 response.

**PASS condition:** First line shows `HTTP/1.1 200 OK` (or equivalent 200 status).

**STOP condition:** Non-200 status (especially 500, 502, 503). If health fails:
- Check PM2 logs: `pm2 logs aisandbox-api-gateway --lines 30`
- **Do NOT automatically revert the migration.** The additive schema change (new nullable columns + index) is backward-compatible.
- **Do NOT restart other services.**
- Report the exact error. A possible recovery is to restore the prior `api-gateway-dist` from backup:
  ```bash
  rm -rf /opt/aisandbox/services/api-gateway/dist
  cp -a <BACKUP_ROOT>/api-gateway-dist /opt/aisandbox/services/api-gateway/dist
  pm2 restart aisandbox-api-gateway --update-env
  ```
  This requires separate approval.

**Evidence to return:** Full curl output (first 5 lines).

---

## PHASE 9 — Frontend Build

### Step 9.1 — Build Frontend

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING (build artifacts only)

```bash
cd /opt/aisandbox/frontend && npm run build
```

**Expected output:** Next.js build completes successfully.

**PASS condition:** Build exits with code 0 and shows `Compiled successfully` or equivalent.

**STOP condition:** Build failure. Report exact error. Do NOT restart frontend with broken build.

**Evidence to return:** Last ~20 lines of build output.

---

## PHASE 10 — Frontend Restart + Health

### Step 10.1 — Restart Frontend

**Where:** Lightsail browser SSH
**Mutates staging:** MUTATING — RUNTIME

```bash
pm2 restart aisandbox-frontend
```

**Expected output:** PM2 confirms restart.

**Evidence to return:** PM2 restart output.

---

### Step 10.2 — Wait and Check PM2 + Frontend Health

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sleep 5 && pm2 list
```

**Expected output:** Both `aisandbox-api-gateway` and `aisandbox-frontend` show `online`.

**PASS condition:** Both online.

**STOP condition:** Either errored/stopped.

**Evidence to return:** Full PM2 list.

---

### Step 10.3 — Frontend HTTP Check

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
curl -si https://staging.ainow.biz/en/app 2>&1 | head -5
```

**Expected output:** HTTP 200 or an expected auth redirect (e.g., 307 to login). Not 5xx.

**PASS condition:** Non-5xx response.

**STOP condition:** HTTP 500/502/503. Check PM2 logs: `pm2 logs aisandbox-frontend --lines 30`. Report error.

**Evidence to return:** First 5 lines of curl output.

---

## PHASE 11 — Safety Verification

### Step 11.1 — Verify GLOBAL_EXECUTION_ENABLED=false

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
python3 - <<'PY'
from pathlib import Path
value='MISSING'
for line in Path('/opt/aisandbox/.env').read_text(encoding='utf-8', errors='replace').splitlines():
    s=line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k,v=s.split('=',1)
    if k.strip()=='GLOBAL_EXECUTION_ENABLED':
        value=v.strip().strip('"').strip("'")
print(f'GLOBAL_EXECUTION_ENABLED_ENV={value}')
PY
```

**IMPORTANT:** This script reads ONLY `GLOBAL_EXECUTION_ENABLED`. It does NOT print other env values.

**Expected output:** `GLOBAL_EXECUTION_ENABLED_ENV=false`

**PASS condition:** Value is `false`.

**STOP condition:** Value is anything other than `false` (including `true`, `MISSING`, or empty). STOP and report. Do NOT change it.

**Evidence to return:** The output line.

---

### Step 11.2 — Confirm Untouched Services

**Where:** ChatGPT evaluation

ChatGPT must confirm from the PM2 list evidence that:

- [ ] `aisandbox-ai-service` was NOT restarted (uptime should be much longer than api-gateway/frontend)
- [ ] `aisandbox-container-manager` was NOT restarted (same check)
- [ ] No provider call (xAI/OpenAI/Stripe) was made during this runbook

---

## PHASE 12 — Admin Account Proof

### Step 12.1 — Verify Active Admin Exists

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT id, role FROM users WHERE role='admin' AND is_active=true;"
```

**Expected output:** At least one row with a UUID and `admin` role.

**PASS condition:** At least one active admin exists. Record the admin UUID(s).

**STOP condition:** No active admin exists. STOP browser validation. Do NOT promote anyone without separate explicit approval.

**Evidence to return:** The UUID(s) and role(s) returned. Do not expose other PII (email, name).

---

## PHASE 13 — Test User Pre-State

### Step 13.1 — Record Test User Credit Balance

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

Preferred test user: `7f772841-7844-401b-a3da-e928b0c7b79c`

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT owner_id, balance, monthly_allocation, rollover_balance, plan_id, status FROM credit_balances WHERE owner_type='user' AND owner_id='7f772841-7844-401b-a3da-e928b0c7b79c';"
```

**Expected output:** One row with the test user's current credit balance state.

**PASS condition:** Row returned with values for all fields.

**STOP condition:** No row returned. If the preferred test user has no credit balance, try:
```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT cb.owner_id, u.email, cb.balance, cb.monthly_allocation, cb.rollover_balance, cb.plan_id, cb.status FROM credit_balances cb JOIN users u ON u.id = cb.owner_id WHERE cb.owner_type='user' AND u.role != 'admin' AND u.is_active=true LIMIT 5;"
```
Choose an appropriate test user and record their UUID.

**Evidence to return:** Record these exact values — they are the pre-grant baseline:
- `balance` = ___
- `monthly_allocation` = ___
- `rollover_balance` = ___
- `plan_id` = ___
- `status` = ___

**Do NOT mutate anything yet.**

---

## PHASE 14 — Browser Admin Login

### Step 14.1 — Admin Login

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY (session creation only)

**Action:** Navigate to `https://staging.ainow.biz/en/login` and log in using the known admin account credentials.

**Expected result:** Successful login. Redirected to the platform/app page.

**PASS condition:** Authenticated session established. No login errors.

**STOP condition:** Cannot log in. Auth system broken.

**Evidence to return:** Confirm login succeeded and what page you landed on.

---

## PHASE 15 — /en/admin Basic Smoke

### Step 15.1 — Navigate to Admin Console

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Navigate to `https://staging.ainow.biz/en/admin`

**Expected result:** Admin console loads. Users list is visible. No raw translation keys (e.g., `admin.users.title` should render as actual text, not the key name). No JavaScript errors in console.

**PASS condition:** Page loads with user list visible. Translated labels. No errors.

**STOP condition:** Page does not load, shows error, redirects unexpectedly, or shows raw translation keys.

**Evidence to return:** Describe what you see: page title, users list appearance, any errors.

---

## PHASE 16 — Search + Quota Filter

### Step 16.1 — Search for Test User

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Use the search field on `/en/admin` to search for the test user (by email or partial match). Also try the quota status filter (e.g., switch between ALL / OK / WARN / EXCEEDED).

**Expected result:** Search narrows results. Quota filter changes visible results. Test user appears in results.

**PASS condition:** Search works. Filter changes list. Test user found.

**STOP condition:** Search does not work, or test user cannot be found.

**Evidence to return:** Confirm search/filter behavior and that the test user was found.

---

## PHASE 17 — User Detail

### Step 17.1 — Open Test User Detail

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Click on the test user in the users list to open their detail page (`/en/admin/users/<userId>`).

**Expected result:** User detail page loads showing:
- User identity (email)
- Plan information
- Quota information
- Current credit balance (should match the pre-state values from Step 13.1)
- Sessions section
- **Add Credits** button/control

**PASS condition:** All sections visible. Credit balance matches pre-state. Add Credits control visible.

**STOP condition:** Page fails to load, credit balance missing, or Add Credits not visible.

**Evidence to return:** Describe sections visible. Report the credit balance shown. Confirm Add Credits control is present.

---

## PHASE 18 — Credit Grant Form and Confirmation

### Step 18.1 — Open Add Credits Form

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY (no POST yet)

**Action:**
1. Click **Add Credits**
2. Enter amount: `1000`
3. Enter reason: `Private beta operator validation grant`
4. Click the confirmation/review button (NOT the final confirm yet)

**Expected result:** Inline confirmation appears showing:
- Target user (email)
- Amount: 1000
- Reason: `Private beta operator validation grant`
- Current balance (matches pre-state)
- Projected balance (current + 1000)

**PASS condition:** All confirmation fields present and correct. Projected balance = current balance + 1000.

**STOP condition:** Confirmation does not appear, or values are wrong.

**Evidence to return:** Describe the confirmation screen. Report the exact values shown for current balance and projected balance.

**DO NOT click the final Confirm button yet. Proceed to Step 19 first.**

---

## PHASE 19 — DevTools Idempotency Capture Preparation

### Step 19.1 — Open DevTools Network Tab

**Where:** Staging browser DevTools
**Mutates staging:** READ-ONLY

**Action:**
1. Press `F12` to open DevTools
2. Click the **Network** tab
3. Optionally check **Preserve log** (to keep requests after navigation)
4. In the filter box, type `credits` to filter for the grant request

**PASS condition:** Network tab is open and filtered.

**Evidence to return:** Confirm DevTools Network tab is open and filtered.

---

## PHASE 20 — Execute Credit Grant

### Step 20.1 — Confirm the Grant

**Where:** Staging browser (desktop)
**Mutates staging:** MUTATING — CREDIT BALANCE
**Rollback significance:** HIGH — real credit mutation. Irreversible without compensating DB action.

**Action:** Click the final **Confirm** button to execute the credit grant.

**Expected result:** Grant succeeds. UI shows:
- Status: granted (or success indication)
- Amount: 1000
- Balance before: (matches pre-state)
- Balance after: (pre-state balance + 1000)

**PASS condition:**
- UI shows success/granted status
- `balanceAfter = balanceBefore + 1000`

**STOP condition:**
- Grant fails with unexpected error
- Balance values don't add up correctly
- HTTP error visible in DevTools

**Evidence to return:**
1. What the UI shows (status, balanceBefore, balanceAfter)
2. In DevTools Network tab, click on the `credits` POST request
3. Report the **HTTP status code** (should be 200)
4. Click on the **Request** tab/section (labeled "Payload" in Chrome)
5. Find and copy the `idempotencyKey` value from the request body
6. Report the `idempotencyKey` value

**IMPORTANT:** Do NOT expose session cookies. Only copy the `idempotencyKey` from the request payload.

---

## PHASE 21 — DB Audit Verification

### Step 21.1 — Verify Credit Grant Audit Row

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

Replace `<TARGET_USER_UUID>` with the test user's UUID and `<IDEMPOTENCY_KEY>` with the key from Step 20.1:

```bash
sudo -u postgres psql -d aisandbox -c "
SELECT id, grant_type, source_type, provider, granted_by_user_id, reason,
       amount, balance_before, balance_after, source_event_id, status
FROM credit_grants
WHERE owner_id = '<TARGET_USER_UUID>'
  AND grant_type = 'admin'
  AND source_event_id = '<IDEMPOTENCY_KEY>'
ORDER BY created_at DESC
LIMIT 1;
"
```

**Expected output:** One row with:
- `grant_type` = `admin`
- `source_type` = `admin`
- `provider` = `admin`
- `granted_by_user_id` = the admin user's UUID (from Step 12.1)
- `reason` = `Private beta operator validation grant`
- `amount` = `1000`
- `balance_before` = pre-state balance (from Step 13.1)
- `balance_after` = pre-state balance + 1000
- `source_event_id` = the idempotency key (from Step 20.1)
- `status` = `granted`

**PASS condition:** All fields match expected values.

**STOP condition:**
- `granted_by_user_id` does not match the authenticated admin UUID → **wrong actor audit**
- `reason` does not match → **wrong reason audit**
- `amount` ≠ 1000 → **wrong amount**
- `balance_after` ≠ `balance_before` + 1000 → **balance corruption**
- `grant_type` / `source_type` / `provider` not all `admin` → **wrong grant classification**
- More than one row → **duplicate grant** (critical)

**Evidence to return:** Full query result.

---

## PHASE 22 — Credit Balance Post-State

### Step 22.1 — Verify Credit Balance After Grant

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

Replace `<TARGET_USER_UUID>`:

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT balance, monthly_allocation, rollover_balance, plan_id, status FROM credit_balances WHERE owner_type='user' AND owner_id='<TARGET_USER_UUID>';"
```

**Expected output:** Row showing updated balance.

**PASS condition:**
- `balance` = pre-state balance + 1000 (matches `balance_after` from audit row)
- `monthly_allocation` = unchanged from pre-state
- `rollover_balance` = unchanged from pre-state
- `plan_id` = unchanged from pre-state
- `status` = unchanged from pre-state

**STOP condition:** Balance does not match expected. Or any other field changed unexpectedly.

**Evidence to return:** Full output. Compare against Step 13.1 pre-state.

---

## PHASE 23 — Idempotency Duplicate Replay

### Step 23.1 — Replay Same Idempotency Key

**Where:** Staging browser DevTools Console
**Mutates staging:** MUTATING REQUEST — but expected NO balance mutation (duplicate detection)

Replace `<TARGET_USER_UUID>` and `<SAME_IDEMPOTENCY_KEY>` with actual values:

```javascript
fetch('/api/admin/users/<TARGET_USER_UUID>/credits', {
  method: 'POST',
  credentials: 'include',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({
    amount: 1000,
    reason: 'Private beta operator validation grant',
    idempotencyKey: '<SAME_IDEMPOTENCY_KEY>'
  })
}).then(async r => ({status: r.status, body: await r.json()})).then(console.log)
```

**Action:** Paste this into the browser DevTools Console (while still logged in as admin) and press Enter.

**Expected output in console:**
```
{status: 200, body: {…}}
```
Where `body.status` = `"duplicate"`

**PASS condition:**
- HTTP status = 200
- `body.status` = `"duplicate"`

**STOP condition:**
- HTTP status ≠ 200
- `body.status` = `"granted"` → **CRITICAL: double credit!** STOP immediately.
- Any other unexpected status

**Evidence to return:** The full console output (`status` and `body`).

---

## PHASE 24 — Post-Duplicate Verification

### Step 24.1 — Verify Balance Unchanged After Duplicate

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT balance FROM credit_balances WHERE owner_type='user' AND owner_id='<TARGET_USER_UUID>';"
```

**Expected output:** Same balance as after the first grant (pre-state + 1000). NOT pre-state + 2000.

**PASS condition:** Balance = pre-state + 1000 (unchanged from Step 22.1).

**STOP condition:** Balance = pre-state + 2000 or any other unexpected value → **double credit**.

**Evidence to return:** The balance value.

---

### Step 24.2 — Verify No Second Grant Row

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT count(*) FROM credit_grants WHERE owner_id='<TARGET_USER_UUID>' AND grant_type='admin' AND source_event_id='<SAME_IDEMPOTENCY_KEY>';"
```

**Expected output:** `1` — exactly one grant row for this idempotency key.

**PASS condition:** Count = 1.

**STOP condition:** Count > 1 → duplicate grant row created.

**Evidence to return:** The count.

---

## PHASE 25 — Sessions

### Step 25.1 — View Sessions on User Detail

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** On the test user's detail page, look at the Sessions section.

**Expected result:** Sessions list is visible. May show active sessions or be empty.

**PASS condition:** Sessions section renders without error.

**Evidence to return:** Describe the sessions section. How many sessions are shown?

---

### Step 25.2 — Identify Expendable Test Session

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Identify a safe session to terminate. Rules:
- **NEVER terminate Keith's admin session** (the session you are currently using)
- Prefer a session belonging to the test user (non-admin)
- If the test user has no active sessions, you can create one by:
  1. Open a second browser or incognito window
  2. Log in as the test user
  3. This creates a disposable session
  4. Return to the admin browser and refresh the sessions list

**PASS condition:** An expendable non-admin test session is identified.

**Evidence to return:** Describe which session was identified (or if a new one was created). Include the session ID if visible.

If no expendable session can be identified or created, document this as a limitation and proceed to Phase 27.

---

## PHASE 26 — Safe Session Termination

### Step 26.1 — Terminate Expendable Session

**Where:** Staging browser (desktop)
**Mutates staging:** MUTATING — SESSION
**Rollback significance:** LOW — session termination is routine; no compensating action needed.

**Action:** Click the terminate button for the identified expendable session. Confirm when prompted.

**Expected result:** Session marked as terminated. UI updates to reflect terminated status.

**PASS condition:** Session terminated. UI shows updated status. No errors.

**STOP condition:** Termination fails with error.

**Evidence to return:** Confirm the session was terminated and the UI updated.

---

## PHASE 27 — zh-TW Locale

### Step 27.1 — Admin Console in Traditional Chinese

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Navigate to `https://staging.ainow.biz/zh-TW/admin`

**Expected result:** Admin console loads in Traditional Chinese. Check:
- Page title / headings are in Chinese
- User list labels are translated
- No raw translation keys visible (e.g., no `admin.users.title`)
- No obvious English leakage in labels that should be Chinese

**PASS condition:** Labels translated. No raw keys. No obvious English in Chinese UI areas.

**Evidence to return:** Describe what you see. Note any untranslated text.

---

### Step 27.2 — User Detail in zh-TW

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Click on any user to open detail page in zh-TW. Check credit balance section and Add Credits labels.

**Expected result:** All labels translated.

**PASS condition:** Translated labels. No raw keys.

**Evidence to return:** Confirm labels are translated. Note any issues.

---

## PHASE 28 — zh-CN Locale

### Step 28.1 — Admin Console in Simplified Chinese

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Navigate to `https://staging.ainow.biz/zh-CN/admin`

**Expected result:** Same checks as zh-TW but for Simplified Chinese.

**PASS condition:** Labels translated. No raw keys. No English leakage.

**Evidence to return:** Describe what you see. Note any untranslated text.

---

### Step 28.2 — User Detail in zh-CN

**Where:** Staging browser (desktop)
**Mutates staging:** READ-ONLY

**Action:** Click on any user to open detail page in zh-CN. Check credit balance and Add Credits labels.

**PASS condition:** Translated labels. No raw keys.

**Evidence to return:** Confirm labels translated. Note any issues.

---

## PHASE 29 — 390px Responsive Smoke

### Step 29.1 — Mobile Viewport Check

**Where:** Staging browser (desktop with DevTools device simulation)
**Mutates staging:** READ-ONLY

**Action:**
1. Press `F12` to open DevTools
2. Click the device toolbar icon (toggle device emulation) or press `Ctrl+Shift+M`
3. Set width to approximately `390px`
4. Navigate to `https://staging.ainow.biz/en/admin`

Check at ~390px:
- Users list (cards stack properly)
- Click into a user detail
- Credit balance section readable
- Add Credits button visible
- Open Add Credits form — fields usable
- Confirmation view readable
- Sessions section readable
- Terminate action accessible

**Expected result:** No critical horizontal overflow. Content is usable at narrow width. Buttons remain accessible.

**PASS condition:** All areas functional at ~390px. No critical overflow blocking content.

**STOP condition:** Critical UI breakage making admin console unusable on mobile.

**Evidence to return:** Describe mobile behavior. Note any overflow or layout issues.

---

## PHASE 30 — Non-Admin Security

### Step 30.1 — Non-Admin Browser Redirect

**Where:** Staging browser (second browser/incognito — logged in as a non-admin user)
**Mutates staging:** READ-ONLY

**Action:**
1. Open a different browser or incognito window
2. Log in as a **non-admin** user (e.g., the test user)
3. Navigate to `https://staging.ainow.biz/en/admin`

**Expected result:** Redirected to `https://staging.ainow.biz/en/platform` (or similar non-admin page). Admin console does NOT render.

**PASS condition:** Non-admin cannot see admin console. Redirected away.

**STOP condition:** Non-admin can see admin console content → **SECURITY BYPASS**.

**Evidence to return:** Where you were redirected to.

---

### Step 30.2 — Non-Admin API 403

**Where:** Staging browser DevTools Console (while logged in as non-admin)
**Mutates staging:** READ-ONLY

**Action:** In the non-admin browser's DevTools Console, run:

```javascript
fetch('/api/admin/users', {credentials: 'include'}).then(r => console.log('STATUS:', r.status))
```

**Expected output:** `STATUS: 403`

**PASS condition:** HTTP 403 Forbidden.

**STOP condition:** HTTP 200 or any status suggesting admin access was granted → **SECURITY BYPASS**.

**Evidence to return:** The status code.

---

## PHASE 31 — Unauthenticated Security

### Step 31.1 — Unauthenticated Browser Redirect

**Where:** Staging browser (private/incognito — NOT logged in)
**Mutates staging:** READ-ONLY

**Action:**
1. Open a fresh incognito/private window (no cookies)
2. Navigate to `https://staging.ainow.biz/en/admin`

**Expected result:** Redirected to login page (`/en/login`).

**PASS condition:** Redirected to login. No admin content visible.

**STOP condition:** Admin content visible without authentication.

**Evidence to return:** Where you were redirected to.

---

### Step 31.2 — Unauthenticated API 401

**Where:** Staging browser DevTools Console (in incognito — no session)
**Mutates staging:** READ-ONLY

**Action:** In the incognito DevTools Console, run:

```javascript
fetch('/api/admin/users').then(r => console.log('STATUS:', r.status))
```

**Expected output:** `STATUS: 401`

**PASS condition:** HTTP 401 Unauthorized.

**STOP condition:** HTTP 200 or 403 without authentication → unexpected behavior.

**Evidence to return:** The status code.

---

## PHASE 32 — Final Health and Safety

### Step 32.1 — Final PM2 and Health Check

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
pm2 list && echo "---" && curl -si http://127.0.0.1:4000/api/health | head -3
```

**Expected output:** All apps online. API health 200.

**PASS condition:** `aisandbox-api-gateway` and `aisandbox-frontend` online. Health returns 200.

**Evidence to return:** Full output.

---

### Step 32.2 — Final GLOBAL_EXECUTION_ENABLED Check

**Where:** Lightsail browser SSH
**Mutates staging:** READ-ONLY

```bash
python3 - <<'PY'
from pathlib import Path
value='MISSING'
for line in Path('/opt/aisandbox/.env').read_text(encoding='utf-8', errors='replace').splitlines():
    s=line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k,v=s.split('=',1)
    if k.strip()=='GLOBAL_EXECUTION_ENABLED':
        value=v.strip().strip('"').strip("'")
print(f'GLOBAL_EXECUTION_ENABLED_ENV={value}')
PY
```

**Expected output:** `GLOBAL_EXECUTION_ENABLED_ENV=false`

**PASS condition:** Value is `false`.

**Evidence to return:** The output line.

---

## PHASE 33 — Evidence Summary

### Step 33.1 — ChatGPT Compiles Final Evidence

**Where:** ChatGPT evaluation (no Keith action)

ChatGPT must compile a final evidence summary with each item marked PASS / FAIL / SKIPPED / LIMITATION:

| # | Item | Result |
|---|------|--------|
| 1 | Pre-deploy staging HEAD | |
| 2 | Post-deploy staging HEAD | |
| 3 | Backup path | |
| 4 | API Gateway build | |
| 5 | Migration pre-state (clean) | |
| 6 | Migration run result | |
| 7 | Migration post-state (columns + index + history) | |
| 8 | API Gateway health (200) | |
| 9 | Frontend build + health | |
| 10 | GLOBAL_EXECUTION_ENABLED = false | |
| 11 | Admin account exists | |
| 12 | Test user pre-balance state | |
| 13 | /en/admin loads | |
| 14 | Search + quota filter | |
| 15 | User detail + credit balance | |
| 16 | Grant result (status=granted, correct balances) | |
| 17 | Idempotency key captured | |
| 18 | DB audit row (all fields correct) | |
| 19 | Duplicate replay (status=duplicate) | |
| 20 | Balance after duplicate (unchanged) | |
| 21 | Sessions visible | |
| 22 | Session termination | |
| 23 | zh-TW translated | |
| 24 | zh-CN translated | |
| 25 | ~390px responsive | |
| 26 | Non-admin redirect + API 403 | |
| 27 | Unauthenticated redirect + API 401 | |
| 28 | Final health + safety | |
| 29 | Limitations (list any) | |
| 30 | Rollback-worthy defects (list any) | |
| 31 | Step 3 verdict: PASS / PASS WITH LIMITATIONS / FAIL | |
| 32 | Ready for Step 4 consolidation? | |

Keith saves this summary and provides it to Claude/Sonnet for ADMIN-CONSOLE-01E Step 4 consolidation in a new window.

---

## ROLLBACK MATRIX

### Failure: Migration Error (Phase 6)

**STOP condition:** `npm run migration:run:prod` returns non-zero or shows error.

**Smallest safe response:**
1. Check error output to determine if migration partially applied
2. Query schema to see if columns/index were added
3. **Do NOT run `migration:revert` without separate Keith approval**
4. **Do NOT run `DROP COLUMN` or `DROP INDEX` manually**
5. The additive migration (`IF NOT EXISTS`) may be safely re-attempted if the error was transient (e.g., connection timeout)
6. Report exact error to Keith/Claude for analysis

**Schema remains?** Possibly partially (IF NOT EXISTS protects against re-run). Check with Phase 7 verification queries.

**Separate approval required?** YES — for any manual schema correction or `migration:revert`.

---

### Failure: API Gateway Health Fails (Phase 8)

**STOP condition:** `curl http://127.0.0.1:4000/api/health` returns non-200 or connection refused.

**Smallest safe response:**
1. Check PM2 logs: `pm2 logs aisandbox-api-gateway --lines 50`
2. The additive migration columns are backward-compatible — do NOT revert schema
3. If the issue is the new build:
   - Restore prior dist from backup: `cp -a <BACKUP_ROOT>/api-gateway-dist /opt/aisandbox/services/api-gateway/dist && pm2 restart aisandbox-api-gateway --update-env`
   - This requires separate approval
4. Do NOT restart AI service or container manager

**Schema remains?** YES — new columns/index are safe to keep (nullable, no behavior change for existing code paths).

**Separate approval required?** YES — for dist rollback.

---

### Failure: Frontend Build/Boot Fails (Phase 9–10)

**STOP condition:** `npm run build` fails, or frontend shows errored in PM2.

**Smallest safe response:**
1. Check build error output
2. If build failed, frontend was not restarted — prior build still active
3. If restart failed:
   - Restore prior .next from backup: `cp -a <BACKUP_ROOT>/frontend-next /opt/aisandbox/frontend/.next && pm2 restart aisandbox-frontend`
   - This requires separate approval
4. API Gateway should remain healthy regardless

**Separate approval required?** YES — for .next rollback.

---

### Failure: Admin Auth Bypass (Phase 30–31)

**STOP condition:** Non-admin sees admin content, or API returns 200 instead of 403/401.

**Response:** CRITICAL SECURITY ISSUE.
1. STOP all validation immediately
2. Do NOT proceed with any remaining browser steps
3. Report exact behavior (what was accessible, by whom)
4. Potential response: restore prior builds from backup to remove admin routes
5. This requires immediate Keith/Claude triage

**Separate approval required?** YES — mandatory.

---

### Failure: Double Credit (Phase 23–24)

**STOP condition:** Duplicate replay returns `status: 'granted'` instead of `duplicate`, or balance = pre-state + 2000.

**Response:** CRITICAL FINANCIAL INTEGRITY ISSUE.
1. STOP all validation immediately
2. Record exact balance, grant count, and both grant rows
3. Do NOT attempt compensating balance adjustments
4. Do NOT delete grant rows
5. Report to Keith/Claude for triage

**Separate approval required?** YES — mandatory.

---

### Failure: Wrong Audit Actor/Reason (Phase 21)

**STOP condition:** `granted_by_user_id` does not match admin, or `reason` does not match input.

**Response:**
1. STOP grant-related validation
2. Record exact values from DB
3. The grant amount/balance may be correct even if audit metadata is wrong
4. Do NOT attempt to UPDATE the grant row
5. Report to Keith/Claude for analysis

**Separate approval required?** YES — for any DB correction.

---

### Failure: Balance Corruption (Phase 22)

**STOP condition:** `balance` does not equal pre-state + 1000, or other fields (`monthly_allocation`, `rollover_balance`, `plan_id`, `status`) changed.

**Response:**
1. STOP all remaining validation
2. Record exact current values vs expected
3. Do NOT attempt compensating adjustments
4. Report to Keith/Claude

**Separate approval required?** YES — mandatory.

---

## END OF RUNBOOK

This runbook covers ADMIN-CONSOLE-01E Step 3 staging execution and browser validation. Step 4 consolidation occurs in a separate window with Claude/Sonnet after this runbook completes.
