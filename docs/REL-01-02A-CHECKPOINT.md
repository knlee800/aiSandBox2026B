# REL-01-02A CHECKPOINT - Fix Projects Migration Startup Defect

## Task Metadata

- Task ID: REL-01-02A
- Title: Fix Projects Migration Startup Defect
- Nature: BUG FIX (RELEASE READINESS, LIVE-STACK BLOCKER)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-02A-CHECKPOINT.md`

## Objective

Fix the migration defect blocking live-stack startup so `api-gateway` can boot and REL-01-02 integration smoke validation can resume.

## Root Cause

`1771587000000-AddProjectsAndSessionProjectId.ts` created `idx_projects_updated_at` unconditionally after `CREATE TABLE IF NOT EXISTS "projects"`.

In environments where `projects` already existed without `updated_at`, table creation was skipped and index creation failed with PostgreSQL `42703` (`column "updated_at" does not exist`).

## File Changed

- `services/api-gateway/src/migrations/1771587000000-AddProjectsAndSessionProjectId.ts`
  - Added defensive step in `up()`:
    - `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()`
  - No other migration files changed.

## Exact Commands / Checks Run

1. `docker ps --format "table {{.Names}}\t{{.Status}}"`
2. `npm run build` (in `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)
3. `docker exec aisandbox-postgres psql -U aisandbox -d postgres -c "DROP DATABASE IF EXISTS rel0102a_clean;"`
4. `docker exec aisandbox-postgres psql -U aisandbox -d postgres -c "CREATE DATABASE rel0102a_clean;"`
5. `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" build api-gateway`
6. `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" run --rm -e DATABASE_URL=postgresql://aisandbox:***@postgres:5432/rel0102a_clean api-gateway npm run migration:run:prod`
7. Schema checks on `rel0102a_clean`:
   - `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='projects' AND column_name='updated_at';`
   - `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='projects' AND indexname='idx_projects_updated_at';`
   - `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='sessions' AND column_name='project_id';`
   - `SELECT indexname FROM pg_indexes WHERE tablename='sessions' AND indexname='idx_sessions_project_id';`
   - `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='fk_sessions_project_id';`
8. Down-path validation (revert latest 3 migrations):
   - `1..3 | ForEach-Object { docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" run --rm -e DATABASE_URL=postgresql://aisandbox:***@postgres:5432/rel0102a_clean api-gateway npx typeorm migration:revert -d dist/data-source.js }`
9. Down-path cleanup checks on `rel0102a_clean`:
   - `SELECT to_regclass('public.projects') AS projects_table;`
   - `SELECT column_name FROM information_schema.columns WHERE table_name='sessions' AND column_name='project_id';`
   - `SELECT conname FROM pg_constraint WHERE conname='fk_sessions_project_id';`
   - `SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_projects_updated_at','idx_sessions_project_id');`
10. Pre-existing/live-stack-cause simulation:
    - `DROP DATABASE IF EXISTS rel0102a_preexisting; CREATE DATABASE rel0102a_preexisting;`
    - `CREATE TABLE IF NOT EXISTS projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name character varying(120) NOT NULL, user_id uuid NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT now());`
    - `docker compose ... run --rm -e DATABASE_URL=postgresql://aisandbox:***@postgres:5432/rel0102a_preexisting api-gateway npm run migration:run:prod`
    - Checks:
      - `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='projects' AND column_name='updated_at';`
      - `SELECT indexname FROM pg_indexes WHERE tablename='projects' AND indexname='idx_projects_updated_at';`
11. Live stack startup verification:
    - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d --no-deps api-gateway`
    - `docker ps --format "table {{.Names}}\t{{.Status}}"`
    - `docker logs --tail 40 aisandbox-api-gateway`
    - `Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 10 | Select-Object -ExpandProperty StatusCode`

## Results

- Clean DB migration up: PASS
- Clean DB schema assertions (`projects.updated_at`, `idx_projects_updated_at`, `sessions.project_id` FK/index): PASS
- Down/revert for target migration path: PASS (projects table/FK/index artifacts removed as expected)
- Pre-existing table simulation (without `updated_at`): PASS (`updated_at` added and index created)
- Live stack startup: PASS (`aisandbox-api-gateway` healthy, `/api/health` returned `200`)

## Scope Compliance

- Kept to REL-01-02A migration-only defect fix.
- No entity logic changes.
- No product behavior changes.
- No unrelated migration edits or schema cleanup.

## Conclusion

The startup migration defect is fixed and validated for both clean and pre-existing/live-stack paths. REL-01-02A is complete and REL-01-02 smoke validation can resume.
