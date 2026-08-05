# PRIVATE-BETA-STAGING-EXECUTION-04J — Step 6B Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04J
**Step:** 6B — Staging Migration Run + Project API/Browser Smoke
**Status:** COMPLETE — 2026-08-05
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04J (COMPLETE and LOCKED — 2026-08-05)
**Predecessor step:** Step 6A — AddProjectSlug Migration Creation Only (COMPLETE — 2026-08-05)
**Date:** 2026-08-05
**Author:** Cursor / Sonnet 4.6 (documentation/consolidation only — no source code changed — no commands run)

---

## 1. Approval

Step 6B was approved by Keith with the following phrase:

> go — approve 04J Step 6B staging migration run + project API browser smoke

---

## 2. VPS Pull and Build Evidence

| Check | Result |
|---|---|
| VPS pull target | `origin/main` |
| VPS commit after pull | `53369dc` |
| Migration file present on VPS | `services/api-gateway/src/migrations/1772600000000-AddProjectSlug.ts` — YES |
| API Gateway build | `BUILD_EXIT=0` — PASS |

---

## 3. DB Backup (Pre-Migration)

| Field | Value |
|---|---|
| Backup path | `/opt/aisandbox/db-backups/aisandbox-pre-04J6B-20260805-100928.dump` |
| Backup exit code | `BACKUP_EXIT=0` |
| Backup size | 88K |

### Pre-Migration `projects` Table Schema (7 columns)

Before migration, the `projects` table had exactly 7 columns:

```
id, name, user_id, created_at, updated_at, visibility, workspace_id
```

`slug` was **absent** — confirming the migration gap diagnosed in Step 5.

---

## 4. Migration Execution

### 4.1 Failed First Attempt

- **Command:** `npm run migration:run:prod`
- **Result:** `MIGRATION_EXIT=1`
- **Reason:** `DATABASE_URL` was not present in the shell environment at the time of execution.
- **DB writes:** NONE — no database changes occurred during this failed attempt.
- This attempt is recorded as a no-write failure.

### 4.2 Successful Retry

- The retry loaded `/opt/aisandbox/.env` silently to inject the required environment variables.
- **Migration executed:** `AddProjectSlug1772600000000`
- **Result:** `MIGRATION_EXIT=0` — PASS

### 4.3 SQL Sequence Executed (Successful Retry)

The migration ran the following SQL steps in order:

1. `ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug character varying` — nullable column added
2. Backfill: `UPDATE projects SET slug = CASE WHEN ... END WHERE slug IS NULL` — slug derived from name with UUID fallback for empty results
3. Deduplicate: collision suffix applied (`-2`, `-3`, …) using window function ordered by `created_at`, `id`
4. `ALTER TABLE projects ALTER COLUMN slug SET NOT NULL` — column locked non-nullable after backfill
5. `CREATE INDEX IF NOT EXISTS idx_projects_slug` — index created
6. Migration record inserted into `migrations` table
7. `COMMIT`

---

## 5. Post-Migration Validation

### 5.1 Schema Validation

| Check | Result |
|---|---|
| `projects.slug` column exists | YES |
| `data_type` | `character varying` |
| `is_nullable` | `NO` |

### 5.2 Migrations Table

| Field | Value |
|---|---|
| timestamp | `1772600000000` |
| name | `AddProjectSlug1772600000000` |

### 5.3 API Health Checks

| Check | Status |
|---|---|
| `API_HEALTH` | **200** |
| `API_DB_HEALTH` | **200** |
| `API_READY` | **200** |
| `PROJECTS_PUBLIC` | **200** |

All project API endpoints returned 200 — the `column Project.slug does not exist` error is resolved.

---

## 6. Browser Smoke

| Check | Result |
|---|---|
| Page loaded | **YES** |
| Shows "Build anything" | **YES** |
| Can type in prompt box | **YES** |
| Internal server error gone | **YES** |
| Network red 500 requests | **NO** |
| `/api/projects/public` status | **304** |
| `/api/projects?workspaceId=<redacted>` status | **304** |
| Final URL | `https://staging.ainow.biz/en/app` |
| HTTPS lock valid | **YES** |
| No localhost in URL | **YES** |
| Errors | **NONE** |

**Note:** The `workspaceId` query parameter value is redacted. No workspaceId value is recorded in this document.

**Browser smoke result: PASS**

---

## 7. Non-Blocking Follow-Up (Env Format Warning)

During the env-loaded migration retry, shell output showed:

> `AUTH_EMAIL_FROM` line in `/opt/aisandbox/.env` has unquoted display-name syntax and causes a shell source warning.

**Status:** Non-blocking. No fix applied in this task. The env file was not opened, read, or printed.

**Recorded as:** Future safe env-format cleanup follow-up — separate task if needed.

---

## 8. Acceptance Criteria — Step 6B

- [x] Keith provides approval phrase: `go — approve 04J Step 6B staging migration run + project API browser smoke`
- [x] VPS pulled origin/main to commit 53369dc
- [x] Migration file present on VPS: `1772600000000-AddProjectSlug.ts`
- [x] API Gateway build passed: `BUILD_EXIT=0`
- [x] DB backup taken before migration: `/opt/aisandbox/db-backups/aisandbox-pre-04J6B-20260805-100928.dump` — `BACKUP_EXIT=0` — 88K
- [x] Pre-migration projects table schema recorded: 7 columns — `slug` absent
- [x] Failed first migration attempt recorded as no-write: `MIGRATION_EXIT=1` — `DATABASE_URL` missing
- [x] Successful migration retry recorded: env loaded — `MIGRATION_EXIT=0`
- [x] SQL sequence recorded: nullable add → backfill → deduplicate → NOT NULL → index → commit
- [x] Post-migration schema validation: `slug` exists — `character varying` — NOT NULL
- [x] migrations table entry confirmed: `1772600000000` / `AddProjectSlug1772600000000`
- [x] API health checks: `API_HEALTH=200` / `API_DB_HEALTH=200` / `API_READY=200` / `PROJECTS_PUBLIC=200`
- [x] Browser smoke PASS: "Build anything" visible — no 500 — workspace usable
- [x] `workspaceId` redacted — value not recorded
- [x] Env format warning recorded as non-blocking follow-up only
- [x] No source code changed
- [x] No commands run by Cursor
- [x] No env files opened or changed
- [x] No secrets recorded
- [x] No git commit or push by Cursor
- [x] No subagents used

---

## 9. Safety Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or read
- ✅ No env values printed or recorded
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action by Cursor
- ✅ No git commit or push by Cursor
- ✅ No subagents used
- ✅ `workspaceId` value redacted — not recorded
