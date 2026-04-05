# REL-01-02B CHECKPOINT — Fix Project Creation Slug Defect

## Task Metadata

- Task ID: `REL-01-02B`
- Family: `REL-01 — Release Readiness`
- Nature: `BUG FIX (RELEASE READINESS, LIVE-SMOKE BLOCKER)`
- Status: `COMPLETE and LOCKED`
- Related blocker: `docs/REL-01-02-CHECKPOINT.md`

## Objective Completed

Fix the concrete live-stack defect where authenticated `POST /api/projects` failed with `500` because `projects.slug` is `NOT NULL` on the live database but project creation code did not supply `slug`.

## Root Cause

- Live schema had `projects.slug` present, `NOT NULL`, no default, and unique constraint.
- `Project` entity had no `slug` column mapped.
- `ProjectsService.createProject` and `ProjectsService.forkPublicProject` created rows without a slug value.
- Result: insert failed with `null value in column "slug" of relation "projects" violates not-null constraint`.

## Files Changed

- `services/api-gateway/src/entities/project.entity.ts`
- `services/api-gateway/src/projects/projects.service.ts`
- `services/api-gateway/src/projects/projects.service.spec.ts`

## Exact Commands / Checks Run

1. Confirmed live stack and containers:
   - `docker context ls; docker ps --format "table {{.Names}}\t{{.Status}}"`
2. Confirmed live schema assumptions for `projects.slug`:
   - `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name IN ('id','name','slug','user_id','visibility','created_at','updated_at') ORDER BY ordinal_position;"`
   - `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='projects' AND indexname ILIKE '%slug%';"`
   - `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='projects'::regclass AND pg_get_constraintdef(oid) ILIKE '%slug%';"`
3. Built and validated targeted backend tests:
   - `npm run build` (in `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)
   - `npm test -- src/projects/projects.service.spec.ts` (in `C:\Users\knlee\aiSandBox2026B\services\api-gateway`)
4. Rebuilt and restarted live api-gateway container:
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" build api-gateway`
   - `docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d --no-deps api-gateway`
5. Re-ran live authenticated project-creation smoke path and DB verification:
   - Health/auth/create/list flow via PowerShell against `http://localhost:4000/api`:
     - `GET /api/health` -> `200`
     - `POST /api/auth/register`
     - `POST /api/auth/login`
     - `POST /api/projects` -> `201`
     - `GET /api/projects` includes created project with slug
   - Direct DB check for created row:
     - `docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT id, name, slug, visibility FROM projects WHERE id = '<created-id>';"`

## Results

- Live repro blocker resolved:
  - Before: `POST /api/projects` returned `500`.
  - After fix: `POST /api/projects` returned `201`.
- Slug persistence verified in both API response/list output and direct PostgreSQL row inspection.
- Targeted unit tests passed (`projects.service.spec.ts`: 10/10).
- No linter errors on touched files (`ReadLints`).

## Scope and Preservation Check

- Preserved existing project identity semantics (`id`, `name`, `userId`, `visibility`, `createdAt`, `updatedAt`).
- Preserved existing service surface (`createProject`, `renameProject`, `updateProjectVisibility`, `forkPublicProject`, others).
- No entity relation changes.
- No unrelated service behavior or schema behavior changed.
- No migration was required for this fix because live schema already contained the required `slug` column/constraints.

## Release-Readiness Conclusion

`REL-01-02B` blocker is fixed and validated on the live stack. Authenticated project creation now succeeds with valid non-null slug persistence. Task is ready as `COMPLETE and LOCKED`.
