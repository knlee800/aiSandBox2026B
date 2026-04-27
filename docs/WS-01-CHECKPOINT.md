# WS-01 CHECKPOINT — Workspace Schema, Entity, And Backfill Foundation

## Task Metadata

| Field | Value |
|---|---|
| Task ID | WS-01 |
| Family | WS (Workspace Rollout) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND / SCHEMA / MIGRATION — workspace data model foundation |
| Date completed | 2026-04-27 |
| Source | Workspace v1 planning session (Apr 2026) |

---

## Objective

Add the Workspace entity/table and nullable `Project.workspaceId` foundation, then perform safe idempotent backfill so each user has one default Personal workspace and all existing projects are assigned to that workspace. Backend/schema only.

---

## Files Changed

### Created

| File | Description |
|---|---|
| `services/api-gateway/src/entities/workspace.entity.ts` | New TypeORM `Workspace` entity |
| `services/api-gateway/src/migrations/1771593000000-AddWorkspacesAndProjectWorkspaceId.ts` | Single migration: table + column + indexes + FK constraints + idempotent backfill |

### Updated

| File | Change |
|---|---|
| `services/api-gateway/src/entities/index.ts` | Added `export { Workspace }` |
| `services/api-gateway/src/entities/project.entity.ts` | Added nullable `workspaceId` column + `workspace` relation (`ManyToOne` to `Workspace`) |
| `services/api-gateway/src/entities/user.entity.ts` | Added `workspaces` relation (`OneToMany` to `Workspace`) |

No task files were edited during the implementation step. No module, service, or controller was added.

---

## Implementation Summary

### Workspace Entity (`workspace.entity.ts`)

New TypeORM entity for v1 personal workspaces with fields:

- `id` — uuid PK
- `userId` — uuid FK to `users`, not null
- `name` — varchar(120)
- `slug` — varchar(120)
- `isDefault` — boolean, default false
- `createdAt` — timestamp
- `updatedAt` — timestamp

Entity-level composite indexes:
- `@Index('uq_workspaces_user_id_slug', ['userId', 'slug'], { unique: true })`
- `@Index('idx_workspaces_user_id_is_default', ['userId', 'isDefault'])`
- `@Index('idx_workspaces_user_id')` on `userId` field

Relations wired:
- `@ManyToOne` to `User` (`onDelete: 'CASCADE'`)
- `@OneToMany` to `Project`

### Project Entity (`project.entity.ts`)

Added to existing entity:
- `@ManyToOne(() => Workspace, ..., { nullable: true, onDelete: 'SET NULL' })` — workspace relation
- `@JoinColumn({ name: 'workspace_id' })` — workspace FK join
- `workspaceId: string | null` — nullable column (`workspace_id`)
- `@Index('idx_projects_workspace_id')` on `workspaceId`

Existing project/session/history behavior was left unchanged. No project create/list logic was made workspace-aware.

### User Entity (`user.entity.ts`)

Added minimal symmetric relation only:
- `@OneToMany(() => Workspace, (workspace) => workspace.user)` — `workspaces: Workspace[]`

### Entity Index (`index.ts`)

Added one line:
- `export { Workspace } from './workspace.entity';`

### Migration (`1771593000000-AddWorkspacesAndProjectWorkspaceId.ts`)

Single migration covering all WS-01 schema changes in `up()`:

1. `CREATE TABLE IF NOT EXISTS "workspaces"` with all v1 fields
2. Guarded FK: `workspaces.user_id -> users.id` (`ON DELETE CASCADE`) via `DO $$ IF NOT EXISTS (pg_constraint) $$`
3. `CREATE UNIQUE INDEX IF NOT EXISTS "uq_workspaces_user_id_slug"` on `(user_id, slug)`
4. `CREATE INDEX IF NOT EXISTS "idx_workspaces_user_id"` on `user_id`
5. `CREATE INDEX IF NOT EXISTS "idx_workspaces_user_id_is_default"` on `(user_id, is_default)`
6. `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workspace_id" uuid`
7. `CREATE INDEX IF NOT EXISTS "idx_projects_workspace_id"` on `workspace_id`
8. Guarded FK: `projects.workspace_id -> workspaces.id` (`ON DELETE SET NULL`) via `DO $$ IF NOT EXISTS (pg_constraint) $$`
9. Idempotent default-workspace backfill: `INSERT INTO "workspaces" ... SELECT ... FROM "users" WHERE NOT EXISTS (... is_default = true) ON CONFLICT ("user_id", "slug") DO UPDATE SET is_default = true`
10. Project assignment backfill: `UPDATE "projects" SET workspace_id = w.id FROM "workspaces" WHERE p.user_id = w.user_id AND p.workspace_id IS NULL AND w.is_default = true`

`down()` reverses safely in the correct order: drop FK on projects → drop column → drop indexes → drop `workspaces` table.

---

## Idempotency / Backfill Note

The backfill is rerun-safe by design:
- Default workspace creation uses `INSERT ... ON CONFLICT ("user_id", "slug") DO UPDATE` — will not create duplicate `personal` workspaces per user
- Project assignment uses `WHERE workspace_id IS NULL` — will not reassign already-assigned project rows

Migration SQL was compile-validated (TypeScript build passed). It was not executed against a live database during this step; database execution is deferred to the next environment migration run. `npm run migration:show` could not be run because `ts-node` is unavailable in the current local environment.

---

## What Was Not Implemented

- No workspace CRUD API (list / create / rename / delete endpoints)
- No project list filtering by workspace
- No frontend workspace selector or UX
- No move-project-between-workspaces
- No members / roles / billing / shared integrations
- No nested workspaces
- No session-to-workspace relationship
- No NOT NULL enforcement on `workspace_id` (deferred to a later slice)
- No NestJS module, service, or controller
- No PROJ-03 / D1 / C3 / C2d-unload or other unrelated work
- No frontend behavior changes

---

## Validation

| Check | Result |
|---|---|
| `npm run build` (from `services/api-gateway`) | Passed — clean TypeScript compile |
| `npx jest "src/projects/projects.service.spec.ts" --runInBand` | Passed — 12/12 tests green |
| `ReadLints` on all 5 touched files | No linter errors |
| `npm run migration:show` | Could not run — `ts-node` unavailable in this environment |

---

## Preserved Invariants

- Workspace is personal-only in v1; no shared/team semantics
- Sessions remain attached to projects, not workspaces
- `workspace_id` remains nullable in this slice — NOT NULL enforcement is deferred
- No existing project/session/history semantics changed
- Future expansion to members/roles/billing remains possible without redesign
- No PROJ-03 / Phase D/E work mixed in
- No frontend behavior changes
