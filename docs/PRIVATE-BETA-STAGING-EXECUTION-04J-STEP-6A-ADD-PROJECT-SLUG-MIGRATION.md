# PRIVATE-BETA-STAGING-EXECUTION-04J — Step 6A: AddProjectSlug Migration Creation Only

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04J
**Step:** 6A — AddProjectSlug Migration Creation Only
**Status:** COMPLETE — 2026-08-05
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04J (ACTIVE — Step 6B PENDING)
**Predecessor step:** Step 5 — Project API 500 Runtime DB Diagnosis (COMPLETE — 2026-08-05)
**Registered:** 2026-08-05
**Author:** Cursor / Opus 4.6 (migration creation + local compile validation — no DB writes — no runtime action)

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04J |
| Step | 6A — AddProjectSlug Migration Creation Only |
| Status | COMPLETE — 2026-08-05 |
| Nature | Source migration creation + local TypeScript compile validation — no DB writes — no migration execution — no runtime action |
| Step 6A approved by | Keith — approval phrase: `go — approve 04J Step 6A AddProjectSlug migration creation only` |

---

## 2. Migration File Created

**File:** `services/api-gateway/src/migrations/1772600000000-AddProjectSlug.ts`
**Class:** `AddProjectSlug1772600000000`
**Timestamp:** `1772600000000` (next after existing highest `1772500000000-CreateUserAgentsTable`)

---

## 3. SQL Strategy

### `up` — 5-step safe sequence (nullable add → backfill → deduplicate → NOT NULL → index)

**Step 1 — Add nullable column:**
```sql
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "slug" character varying;
```
Column is nullable. No default value. No empty-string default.

**Step 2 — Backfill slug from name:**
```sql
UPDATE "projects"
SET "slug" = CASE
  WHEN TRIM(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')) = ''
  THEN "id"::text
  ELSE TRIM(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'))
END
WHERE "slug" IS NULL
```
- Lowercases `name`
- Replaces non-alphanumeric groups with hyphens
- Trims leading/trailing hyphens
- Falls back to project UUID if result is empty (e.g., name with only special characters)
- Only updates rows where `slug IS NULL` (safe for re-runs)

**Step 3 — Deduplicate collisions:**
```sql
WITH dupes AS (
  SELECT "id", "slug",
    ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "created_at", "id") AS rn
  FROM "projects"
)
UPDATE "projects" p
SET "slug" = d."slug" || '-' || d.rn
FROM dupes d
WHERE p."id" = d."id" AND d.rn > 1
```
- Uses window function to number duplicates
- First project (by `created_at`) keeps the base slug
- Subsequent duplicates get `-2`, `-3`, etc. appended
- Deterministic ordering by `created_at` then `id`

**Step 4 — Set NOT NULL:**
```sql
ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL
```
Safe because all rows now have non-empty slugs from Steps 2–3.

**Step 5 — Create index:**
```sql
CREATE INDEX IF NOT EXISTS "idx_projects_slug" ON "projects" ("slug")
```
Matches the `@Index('idx_projects_slug')` decorator in `project.entity.ts`.

### `down` — Drop index and column

```sql
DROP INDEX IF EXISTS "idx_projects_slug";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "slug";
```

---

## 4. Validation Result

**Command:** `npm run build` (→ `tsc`) in `services/api-gateway`
**Exit code:** 0
**Result:** PASS — TypeScript compilation clean, no errors.

No migration execution occurred. No DB connection. No Docker/PostgreSQL/Redis.

---

## 5. Files Read

| File | Purpose |
|---|---|
| `TASKS.md` | Active task ledger — 04J step status |
| `TASKS_BACKLOG_FULL.md` | Long-form backlog — 04J section |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Deployment roadmap — 04J and deployment readiness entries |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-PROJECT-API-500-RUNTIME-DB-DIAGNOSIS.md` | Step 5 diagnosis — confirms migration gap root cause |
| `services/api-gateway/src/entities/project.entity.ts` | Entity definition — confirms slug column requirements |
| `services/api-gateway/src/migrations/` (all 26 existing files) | Migration naming convention and existing patterns |
| `services/api-gateway/src/migrations/1772500000000-CreateUserAgentsTable.ts` | Latest migration — style reference |
| `services/api-gateway/src/migrations/1771592000000-AddProjectVisibility.ts` | Similar ALTER TABLE pattern reference |
| `services/api-gateway/package.json` | Build script verification |
| `services/api-gateway/data-source.ts` | Migration glob pattern — confirms auto-discovery |

## 6. Files Changed/Created

| File | Action |
|---|---|
| `services/api-gateway/src/migrations/1772600000000-AddProjectSlug.ts` | CREATED — new migration |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-STEP-6A-ADD-PROJECT-SLUG-MIGRATION.md` | CREATED — this document |
| `TASKS.md` | UPDATED — Step 6A COMPLETE, Step 6B PENDING |
| `TASKS_BACKLOG_FULL.md` | UPDATED — Step 6A COMPLETE |
| `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATED — Step 6A COMPLETE |

---

## 7. Safety Confirmations

- ✅ No DB writes occurred
- ✅ No migration execution occurred (`migration:run` / `migration:run:prod` / `migration:revert` NOT run)
- ✅ No Docker/PostgreSQL/Redis used
- ✅ No SSH/AWS CLI/runtime action
- ✅ No env files opened or changed
- ✅ No secrets printed or recorded
- ✅ No git commit or push
- ✅ No subagents used
- ✅ No services started or restarted

---

## 8. Current Status Summary

| Task / Check | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04J Step 6A | **COMPLETE — 2026-08-05** |
| Migration file created | **YES — `1772600000000-AddProjectSlug.ts`** |
| Migration uses nullable-add/backfill/set-not-null/index | **YES** |
| Existing projects get non-empty slugs | **YES (backfill + UUID fallback + dedup)** |
| Down migration drops index and column | **YES** |
| Local compile validation | **PASS — tsc exit 0** |
| DB writes / migration execution | **NO** |
| PRIVATE-BETA-STAGING-EXECUTION-04J | **ACTIVE — Step 6A COMPLETE — Step 6B PENDING** |
| PRIVATE-BETA-DEPLOYMENT-READINESS | **BLOCKED / PAUSED — pending Step 6B staging migration run** |

---

## 9. Task Workflow (Updated)

1. **Registration + Investigation** — COMPLETE (2026-08-04)
2. **Amended Investigation** — COMPLETE (2026-08-04)
3. **Browser Evidence Correction + Option A Runbook** — COMPLETE (2026-08-04)
4. **Option A Execution + Evidence Review** — COMPLETE (2026-08-05)
5. **Project API 500 Runtime Diagnosis** — COMPLETE (2026-08-05)
6. **AddProjectSlug Migration** — split into 6A/6B:
   - **6A — Migration Creation Only** — **COMPLETE (2026-08-05)** — this document
   - **6B — Approval-gated staging migration run + project API/browser smoke** — PENDING (requires separate Keith approval)
7. **Consolidation/Checkpoint** — PENDING

---

## 10. Next Recommended Action

**04J Step 6B — Approval-gated staging migration run + project API/browser smoke.**

Scope:
1. Commit and push `1772600000000-AddProjectSlug.ts` to main
2. Pull on staging VPS
3. Rebuild api-gateway on staging: `npm run build`
4. Take Lightsail snapshot before migration
5. Run migration: `npm run migration:run:prod`
6. Restart API Gateway: `pm2 restart aisandbox-api-gateway --update-env`
7. SSH validation: `GET /api/projects/public` and `GET /api/projects?workspaceId=` return 200
8. Browser smoke: confirm workspace page is usable — projects load — no 500 errors

Suggested approval phrase for Step 6B:
```
go — approve 04J Step 6B staging migration run + project API browser smoke
```

Stop here. Await Keith's explicit approval for Step 6B before any migration execution or staging action.
