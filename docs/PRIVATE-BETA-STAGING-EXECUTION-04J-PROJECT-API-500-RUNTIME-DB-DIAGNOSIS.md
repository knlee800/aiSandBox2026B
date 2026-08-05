# PRIVATE-BETA-STAGING-EXECUTION-04J — Project API 500 Runtime DB Diagnosis

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04J
**Step:** 5 — Project API 500 Runtime DB Diagnosis
**Status:** COMPLETE — 2026-08-05
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04J (ACTIVE — Step 6 PENDING)
**Parent-parent:** PRIVATE-BETA-STAGING-EXECUTION-04 (COMPLETE and LOCKED — 2026-08-04)
**Predecessor step:** Step 4 — Option A Execution + Evidence Review (COMPLETE — 2026-08-05)
**Registered:** 2026-08-05
**Author:** Cursor / Sonnet 4.6 (read-only source analysis — no source changes — no DB writes — no runtime action)

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04J |
| Step | 5 — Project API 500 Runtime DB Diagnosis |
| Status | COMPLETE — 2026-08-05 |
| Nature | Read-only source + migration analysis — no source changes — no DB writes — no migration execution — no runtime action |
| Step 5 approved by | Keith — approval phrase: "go — approve 04J Step 5 project API 500 runtime diagnosis" |

---

## 2. Runtime Error (Confirmed by Keith)

```text
Project API 500 root cause:
column Project.slug does not exist

Affected endpoints:
GET /api/projects/public
GET /api/projects?workspaceId=<redacted>

Stack traces point to:
services/api-gateway/src/projects/projects.service.ts
- listPublicProjects()
- listProjects()
- generateUniqueSlug()
- createProject()
```

This confirms: the staging PostgreSQL database is missing the `slug` column on the `projects` table. TypeORM constructs SQL queries that SELECT or WHERE on `slug` based on the entity definition, causing every project query to throw `column Project.slug does not exist`.

---

## 3. Files Read

| File | Purpose |
|---|---|
| `TASKS.md` | Active task ledger — 04J step status and blocker |
| `TASKS_BACKLOG_FULL.md` | Long-form backlog — 04J section |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Deployment roadmap — 04J and deployment readiness entries |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-PROJECT-API-500-EVIDENCE-REVIEW.md` | Step 4 evidence review — project API 500 classification and Step 5 scope |
| `services/api-gateway/src/projects/projects.service.ts` | Service layer — identifies methods that query the `projects` table |
| `services/api-gateway/src/projects/projects.controller.ts` | Controller layer — identifies failing endpoint handlers |
| `services/api-gateway/src/projects/public-projects.controller.ts` | Public controller — identifies `GET /api/projects/public` handler |
| `services/api-gateway/src/entities/project.entity.ts` | Project entity — confirms `slug` column definition |
| `services/api-gateway/src/migrations/` (all 25 migration files) | Full migration audit — searched all files for `slug` in the `projects` table context |

---

## 4. Entity Audit: `project.entity.ts`

File: `services/api-gateway/src/entities/project.entity.ts`

The `Project` entity defines the following columns mapped to the `projects` DB table:

| TypeORM Field | DB Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid | PRIMARY KEY |
| `userId` | `user_id` | uuid | FK → users.id |
| `workspaceId` | `workspace_id` | uuid (nullable) | FK → workspaces.id |
| `name` | `name` | varchar(120) | NOT NULL |
| **`slug`** | **`slug`** | **varchar** | **NOT NULL — @Index('idx_projects_slug')** |
| `visibility` | `visibility` | varchar(16) | NOT NULL DEFAULT 'private' |
| `createdAt` | `created_at` | TIMESTAMP | NOT NULL DEFAULT now() |
| `updatedAt` | `updated_at` | TIMESTAMP | NOT NULL DEFAULT now() |

The `slug` field is defined at `project.entity.ts` lines 51–54:

```typescript
@Index('idx_projects_slug')
@Column({ type: 'varchar' })
slug: string;
```

- **NOT nullable** (no `nullable: true` option).
- **No default value** in the entity definition.
- TypeORM will include `slug` in all SELECT, INSERT, UPDATE, and WHERE queries against the `projects` table.

---

## 5. Migration Audit: All 25 Migrations

All migrations were searched for `slug` references in the context of the `projects` table.

### 5.1 Migration File List

| Timestamp | Migration | Relevant to `projects.slug`? |
|---|---|---|
| 1738843200000 | CreateUsageRecordsTable | NO |
| 1738843300000 | CreateBillingSnapshotsTable | NO |
| 1738900000000 | CreateInvoicesTable | NO |
| 1740355200000 | AddRequestIdToUsageRecords | NO |
| 1740355300000 | AddExecutionStatusToUsageRecords | NO |
| 1769160618009 | InitSchema20260123 | NO |
| 1771494478022 | AddSessionTermination | NO |
| 1771495000000 | AddExecutionStatusCancelStates | NO |
| 1771495100000 | AddChatMessagesAndAlignConversations | NO |
| 1771496000000 | CreateGitCheckpointsTable | NO |
| **1771587000000** | **AddProjectsAndSessionProjectId** | **CRITICAL — creates `projects` table — NO `slug` column** |
| 1771589000000 | AddPlansFoundation | NO |
| **1771592000000** | **AddProjectVisibility** | **Adds `visibility` to `projects` — NO `slug` column** |
| **1771593000000** | **AddWorkspacesAndProjectWorkspaceId** | **Adds `workspace_id` to `projects`, creates `workspaces` — `slug` appears ONLY in `workspaces`, NOT in `projects`** |
| 1771700000000 | AddAuthSchemaFoundation | NO |
| 1771701000000 | AddEmailVerificationColumns | NO |
| 1771800000000 | CreateUserAiInstructionsTable | NO |
| 1771900000000 | CreateProjectAiContextTable | NO |
| 1772000000000 | CreateProjectRepoDocsTable | NO |
| 1772100000000 | CreateCreditBalanceAndDeductionTables | NO |
| 1772200000000 | AlignSubscriptionsTableWithTypeORM | NO |
| 1772200100000 | AddStripeCustomerIdUniqueIndex | NO |
| 1772300000000 | CreateWebhookEventsTable | NO |
| 1772400000000 | CreateCreditGrantsTable | NO |
| 1772500000000 | CreateUserAgentsTable | NO |

**Result: Zero migrations add `slug` to the `projects` table.**

### 5.2 `AddProjectsAndSessionProjectId` — Initial `projects` Schema

Migration `1771587000000-AddProjectsAndSessionProjectId.ts` creates the `projects` table with these columns only:

```sql
CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" character varying(120) NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_projects_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
)
```

No `slug` column. The table was created without it.

### 5.3 `AddWorkspacesAndProjectWorkspaceId` — `slug` in Wrong Table

Migration `1771593000000-AddWorkspacesAndProjectWorkspaceId.ts` does add a `slug` column — but only to the **`workspaces`** table:

```sql
CREATE TABLE IF NOT EXISTS "workspaces" (
  ...
  "slug" character varying(120) NOT NULL,
  ...
)
```

It adds `workspace_id` to `projects` but does **not** add `slug` to `projects`.

### 5.4 Conclusion

**No migration in source adds `slug` to the `projects` table.**

The `slug` column was added to the `project.entity.ts` TypeORM entity at some point after the initial `projects` table creation migration, but the corresponding `ALTER TABLE projects ADD COLUMN slug ...` migration was never written.

---

## 6. Service Impact Analysis

The following `ProjectsService` methods all touch the `projects` table in ways that include the `slug` column via TypeORM:

| Method | How `slug` is involved | Result on staging |
|---|---|---|
| `listPublicProjects()` | `projectRepository.find({ where: { visibility: 'public' } })` — TypeORM SELECT includes `slug` | **500 — column Project.slug does not exist** |
| `listProjects()` | `projectRepository.find({ where: { userId, ... } })` — TypeORM SELECT includes `slug` | **500 — column Project.slug does not exist** |
| `generateUniqueSlug()` | `projectRepository.findOne({ where: { slug: candidate } })` — direct WHERE on `slug` | **500 — column Project.slug does not exist** |
| `createProject()` | calls `generateUniqueSlug()` first, then `projectRepository.save(project)` with `slug` | **500 — column Project.slug does not exist** |

Every public-facing project endpoint is affected. TypeORM does not perform lazy schema resolution — it trusts the entity definition and always emits the full column list.

---

## 7. Root Cause Classification

**Classification: Migration Gap**

| Dimension | Finding |
|---|---|
| Error type | PostgreSQL `column Project.slug does not exist` |
| Source of truth | `project.entity.ts` defines `slug` as a required non-nullable column |
| DB state on staging | `slug` column absent from `projects` table |
| Migration gap | No migration in source adds `slug` to `projects` — confirmed by full audit of all 25 migrations |
| Root trigger | `NEXT_PUBLIC_PROJECT_FIRST_UX=true` activated project-first UX — newly activated UI now calls project endpoints that were not exercised before Option A — exposing the pre-existing migration gap |
| Entity/code error? | NO — entity and service code are correct |
| Config/env error? | NO — env vars are not involved |
| Kill switch? | NO — kill switches return 503, not 500 |
| Auth/session error? | NO — error is pure DB column absence |

**The project API endpoints have always been broken on staging. The migration gap predates Option A. Option A merely activated the UI path that calls these endpoints for the first time on staging.**

---

## 8. Staging DB Commands (Requested from Keith — Not Yet Run)

The following safe read-only commands should be run by Keith to confirm the DB state independently. These produce no writes and no migrations.

### 8.1 Confirm `projects` table exists and list columns

```bash
sudo -u postgres psql -d aisandbox -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%project%' ORDER BY table_name;"
```

Expected result: `projects` table listed.

```bash
sudo -u postgres psql -d aisandbox -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name ILIKE '%project%' ORDER BY table_name, ordinal_position;"
```

Expected result: `projects` columns will include `id`, `name`, `user_id`, `workspace_id`, `visibility`, `created_at`, `updated_at` — but **`slug` will be absent**.

### 8.2 Confirm applied migrations

```bash
sudo -u postgres psql -d aisandbox -c "SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 20;"
```

Expected result: `1771587000000-AddProjectsAndSessionProjectId`, `1771592000000-AddProjectVisibility`, `1771593000000-AddWorkspacesAndProjectWorkspaceId` listed — no migration name containing `slug` for the `projects` table will appear.

**These commands are provided for Keith's independent confirmation. Source analysis already confirms the root cause with certainty.**

---

## 9. Fix Options Analysis

### Option A — Create New Migration `AddProjectSlug` (Recommended)

Create a new TypeORM migration that:
1. `ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug character varying NOT NULL DEFAULT ''`
2. Backfills `slug` values from `name` for any existing rows: `UPDATE projects SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g')) WHERE slug = ''`
3. `CREATE INDEX IF NOT EXISTS "idx_projects_slug" ON "projects" ("slug")`

Then run this migration on staging under a separate approval gate.

**Pros:**
- Tracked in source and version-controlled
- Safe for any existing project rows on staging
- Idempotent (`IF NOT EXISTS`, `WHERE slug = ''`)
- Follows established migration pattern in this codebase
- No entity or service changes required

**Cons:**
- Requires a new commit and staging migration run (separate approval step)

### Option B — Manual SQL Patch on Staging Only

Directly run the SQL on staging without a migration file:

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug character varying NOT NULL DEFAULT '';
UPDATE projects SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g')) WHERE slug = '';
CREATE INDEX IF NOT EXISTS "idx_projects_slug" ON "projects" ("slug");
```

**Pros:** Faster — no new commit required.

**Cons:**
- Not tracked in migrations table — schema divergence between staging DB and source
- Will need a proper migration before production anyway
- Not recommended given governance rules

### Option C — Source Fallback (Make `slug` nullable)

Change `project.entity.ts` to make `slug` optional/nullable, and update the service to handle null slugs gracefully.

**Not recommended:** Changes entity semantics, creates additional entity drift, defers the proper fix.

### Option D — Do Nothing Until `slug` Migration Is Fully Designed

Wait for a complete design before any action.

**Not recommended:** Staging is blocked. Option A is already well-understood and safe.

---

## 10. Recommended Smallest Safe Next Step

**Recommendation: Option A — Create migration `AddProjectSlug` under a separate approval gate.**

Specific scope for Step 6 (to be registered as a new approval-gated child task):

1. Create `services/api-gateway/src/migrations/<timestamp>-AddProjectSlug.ts`
2. Up: `ADD COLUMN IF NOT EXISTS slug character varying NOT NULL DEFAULT ''` + backfill from name + index
3. Down: `DROP INDEX IF EXISTS idx_projects_slug` + `DROP COLUMN IF EXISTS slug`
4. Validate migration locally: `npm run migration:run` (local only — no staging yet)
5. Run on staging: `npm run migration:run:prod` (requires separate Keith approval)
6. Validate: re-check `GET /api/projects/public` and `GET /api/projects?workspaceId=` return 200
7. Confirm page usability in browser

**This step must NOT be started without a separate explicit Keith approval phrase.**

---

## 11. Safety Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or read
- ✅ No env values printed or recorded
- ✅ No runtime/server action taken
- ✅ No SSH/AWS CLI/PM2/systemd action
- ✅ No DB writes
- ✅ No migrations executed
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No git commit or push
- ✅ No subagents used

---

## 12. Current Status Summary

| Task / Check | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04J Step 5 | **COMPLETE — 2026-08-05** |
| Root cause identified | **YES — migration gap: `slug` column absent from staging `projects` table** |
| Source migration for `slug` exists | **NO — no migration creates `slug` on `projects` in source** |
| Staging DB confirmation (from Keith) | **PENDING — commands provided in Section 8** |
| DB writes / migrations executed | **NO** |
| PRIVATE-BETA-STAGING-EXECUTION-04J | **ACTIVE — Step 6 PENDING (AddProjectSlug migration — requires separate approval)** |
| PRIVATE-BETA-DEPLOYMENT-READINESS | **BLOCKED / PAUSED — pending `Project.slug` migration creation + staging run** |

---

## 13. Task Workflow (Updated)

1. **Registration + Investigation** — COMPLETE (2026-08-04)
2. **Amended Loading-State Investigation** — COMPLETE (2026-08-04)
3. **Browser Evidence Correction + Option A Runbook** — COMPLETE (2026-08-04)
4. **Option A Execution + Evidence Review** — COMPLETE (2026-08-05)
5. **Project API 500 Runtime DB Diagnosis** — **COMPLETE (2026-08-05)** — this document
6. **`AddProjectSlug` Migration Creation + Staging Run** — PENDING — requires separate Keith approval
7. **Consolidation/Checkpoint** — PENDING

---

## 14. Next Recommended Action

Register and approve **04J Step 6**: `AddProjectSlug` Migration Creation + Staging Run.

Suggested approval phrase for Step 6:
```
go — approve 04J Step 6 AddProjectSlug migration creation and staging run
```

Scope:
- Create `<timestamp>-AddProjectSlug.ts` migration (add column, backfill from name, add index)
- Run locally to validate (no staging yet)
- Run on staging under Keith approval
- Re-validate project API endpoints return 200
- Browser smoke: confirm workspace page becomes usable

Stop here. Await Keith's explicit approval for Step 6 before any migration creation or execution.
