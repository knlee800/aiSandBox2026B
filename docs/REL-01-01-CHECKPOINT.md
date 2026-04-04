# REL-01-01 CHECKPOINT — Migration Validation

## Task Metadata

- Task ID: REL-01-01
- Title: Migration Validation
- Nature: VALIDATION (RELEASE READINESS, DATABASE SAFETY)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-01-CHECKPOINT.md`

## Objective Completed

Validated migrations `1771587000000`, `1771589000000`, and `1771592000000` against a real PostgreSQL instance in Docker, including up-path execution, direct schema inspection, and targeted down-path verification.

## Prerequisite Context

- REL-01-01A restored Docker/PostgreSQL validation availability.
- REL-01-01B fixed the concrete defect in `1771589000000-AddPlansFoundation.ts` (`plan_type` missing before `UPDATE`).
- This checkpoint records the final resumed validation after those two prerequisites completed.

## Environment Used

- Host: Windows 11 (PowerShell)
- Repo root: `C:\Users\knlee\aiSandBox2026B`
- PostgreSQL service: `aisandbox-postgres` (Docker)
- Clean validation DB: `rel0101_final_validation`

## Exact Commands / DB Checks Run

1. `docker ps --format "table {{.Names}}\t{{.Status}}"`
2. `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "DROP DATABASE IF EXISTS rel0101_final_validation;"`
3. `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "CREATE DATABASE rel0101_final_validation;"`
4. `npm run build` (working dir: `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)
5. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101_final_validation"; npx typeorm migration:show -d dist/data-source.js`
6. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101_final_validation"; npx typeorm migration:run -d dist/data-source.js`
7. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT id, timestamp, name FROM migrations WHERE timestamp IN (1771587000000,1771589000000,1771592000000) ORDER BY id;"`
8. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('projects','plans') ORDER BY table_name;"`
9. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='visibility';"`
10. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('plan_type','plan_status') ORDER BY column_name;"`
11. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT code, name, max_active_sessions, max_sessions_24h, max_tokens_24h, is_active FROM plans ORDER BY code;"`
12. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='plans' AND indexname='idx_plans_code_unique';"`
13. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='project_id';"`
14. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='fk_sessions_project_id';"`
15. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='sessions' AND indexname='idx_sessions_project_id';"`
16. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101_final_validation"; npx typeorm migration:revert -d dist/data-source.js` (revert `1771592000000`)
17. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101_final_validation"; npx typeorm migration:revert -d dist/data-source.js` (revert `1771589000000`)
18. `$env:DATABASE_URL="postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/rel0101_final_validation"; npx typeorm migration:revert -d dist/data-source.js` (revert `1771587000000`)
19. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('projects','plans') ORDER BY table_name;"`
20. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('plan_type','plan_status') ORDER BY column_name;"`
21. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='project_id';"`
22. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT conname FROM pg_constraint WHERE conname='fk_sessions_project_id';"`
23. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_sessions_project_id','idx_plans_code_unique','idx_projects_visibility') ORDER BY indexname;"`
24. `docker exec aisandbox-postgres psql -U aisandbox -d rel0101_final_validation -c "SELECT timestamp, name FROM migrations WHERE timestamp IN (1771587000000,1771589000000,1771592000000) ORDER BY timestamp;"`

## Up Path Outcome (PASS)

- Target migrations executed in order:
  - `1771587000000` → `1771589000000` → `1771592000000`
- `projects` table exists.
- `plans` table exists; seed rows `free` and `pro` present.
- `idx_plans_code_unique` exists.
- `projects.visibility` exists, `NOT NULL`, default `'private'`.
- `users.plan_type` exists, `NOT NULL`, default `'free'`.
- `users.plan_status` exists, `NOT NULL`, default `'active'`.
- `sessions.project_id` is nullable.
- FK `fk_sessions_project_id` exists with `ON DELETE SET NULL`.
- `idx_sessions_project_id` exists.

## Down/Revert Path Outcome (PASS)

- Reverted `1771592000000`, `1771589000000`, `1771587000000` successfully.
- After reverts:
  - `projects` and `plans` tables absent.
  - `users.plan_type` and `users.plan_status` absent.
  - `sessions.project_id` absent.
  - `fk_sessions_project_id` absent.
  - `idx_projects_visibility`, `idx_plans_code_unique`, `idx_sessions_project_id` absent.
  - No migration rows remain for the three target timestamps.

## Remaining Issues

- No remaining migration issues found in REL-01-01 final validation scope.

## Release-Readiness Safety Statement

- Migration sequence for the three target migrations is now safe for release-readiness baseline use.
- REL-01-01 validation is complete.
