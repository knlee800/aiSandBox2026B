# REL-01-01B CHECKPOINT — Fix Plans Foundation Migration Defect

## Task Metadata

- Task ID: REL-01-01B
- Title: Fix Plans Foundation Migration Defect
- Nature: BUG FIX (RELEASE READINESS, MIGRATION BLOCKER)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-01B-CHECKPOINT.md`

## Objective Completed

Fixed the concrete migration defect in `1771589000000-AddPlansFoundation.ts` where `plan_type` was referenced before being created, causing PostgreSQL error `42703`.

## Root Cause

- Migration `up()` updated `users.plan_type` and `users.plan_status`.
- Only `plan_status` was added in the migration.
- `plan_type` existed in the entity but had no migration step before use.

## Exact File Changed

- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\migrations\1771589000000-AddPlansFoundation.ts`
  - Added in `up()` before the failing `UPDATE`:
    - `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_type" character varying(50) NOT NULL DEFAULT 'free'`
  - Added in `down()`:
    - `ALTER TABLE "users" DROP COLUMN IF EXISTS "plan_type"`

## Exact Commands / DB Checks Run

1. `docker ps --format "table {{.Names}}\t{{.Status}}"`
2. `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "DROP DATABASE IF EXISTS rel0101b_validation;"`
3. `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "CREATE DATABASE rel0101b_validation;"`
4. `npm run build` (working dir: `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)
5. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101b_validation"; npx typeorm migration:run -d dist/data-source.js`
6. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('plan_type','plan_status') ORDER BY column_name;"`
7. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT code, name, max_active_sessions, max_sessions_24h, max_tokens_24h, is_active FROM plans ORDER BY code;"`
8. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='plans' AND indexname='idx_plans_code_unique';"`
9. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='project_id';"`
10. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='fk_sessions_project_id';"`
11. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='sessions' AND indexname='idx_sessions_project_id';"`
12. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101b_validation"; npx typeorm migration:revert -d dist/data-source.js` (revert `1771592000000`)
13. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101b_validation"; npx typeorm migration:revert -d dist/data-source.js` (revert `1771589000000`)
14. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('plan_type','plan_status') ORDER BY column_name;"`
15. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='plans';"`
16. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101b_validation -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='plans' AND indexname='idx_plans_code_unique';"`

## Validation Outcome

- Migration chain runs successfully on clean real PostgreSQL database.
- Target migration `1771589000000` now executes successfully.
- After up:
  - `users.plan_type` exists, `NOT NULL`, default `'free'`
  - `users.plan_status` exists, `NOT NULL`, default `'active'`
  - `plans` table exists with `free` and `pro` rows seeded
  - `idx_plans_code_unique` exists
  - Other migration behavior preserved (`sessions.project_id` still nullable, FK `ON DELETE SET NULL`, index present)
- After down of target migration:
  - `users.plan_type` removed
  - `users.plan_status` removed
  - `plans` table removed
  - `idx_plans_code_unique` removed

## Scope Adherence

- No entity logic changes.
- No unrelated migration files changed.
- No product feature work.
- Fix remained strictly within REL-01-01B.
