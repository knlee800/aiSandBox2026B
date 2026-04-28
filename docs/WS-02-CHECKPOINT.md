# WS-02 CHECKPOINT — Workspace CRUD API Foundation

## Task Metadata

| Field | Value |
|---|---|
| Task ID | WS-02 |
| Family | WS (Workspace Rollout) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND / API — workspace CRUD endpoints |
| Date completed | 2026-04-28 |
| Source | WS v1 rollout — second slice; follows WS-01 schema foundation |

---

## Objective

Add the minimal authenticated backend API for v1 personal workspaces: create, list, read, rename, and delete (non-default only). Strictly user-scoped and additive. Backend/API only.

---

## Files Changed

### Created

| File | Description |
|---|---|
| `services/api-gateway/src/workspaces/workspaces.module.ts` | NestJS module — registers `Workspace` + `Project` repos, controller, service |
| `services/api-gateway/src/workspaces/workspaces.service.ts` | Owner-scoped CRUD service with per-user slug uniqueness and safe deletion policy |
| `services/api-gateway/src/workspaces/workspaces.controller.ts` | Five REST endpoints behind `JwtAuthGuard` |
| `services/api-gateway/src/workspaces/dto/create-workspace.dto.ts` | `CreateWorkspaceDto` — `name` (string, not-empty, max 120) |
| `services/api-gateway/src/workspaces/dto/update-workspace.dto.ts` | `UpdateWorkspaceDto` — optional `name` field for PATCH |
| `services/api-gateway/src/workspaces/workspaces.service.spec.ts` | Service unit tests: CRUD, deletion policy, ownership, missing-default guard |
| `services/api-gateway/src/workspaces/workspaces.controller.spec.ts` | Controller unit tests: guard metadata, delegation to service |

### Updated

| File | Change |
|---|---|
| `services/api-gateway/src/app.module.ts` | Added `WorkspacesModule` import and registration |

No entity, migration, or schema file changed in WS-02.

---

## Implementation Summary

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/workspaces` | Create workspace for current user |
| `GET` | `/api/workspaces` | List current user's workspaces |
| `GET` | `/api/workspaces/:id` | Read one current-user workspace |
| `PATCH` | `/api/workspaces/:id` | Rename/update current-user workspace |
| `DELETE` | `/api/workspaces/:id` | Delete non-default current-user workspace |

### `WorkspacesService` behavior

- All read/update/delete operations are owner-scoped: `findOne({ where: { id, userId } })` on every operation
- Slug uniqueness is **per-user**, not global — `generateUniqueSlug` queries `WHERE userId = ... AND slug = ...`
- `updateWorkspace` regenerates slug on rename, skipping the current workspace id to allow same-slug round-trips
- `createWorkspace` always sets `isDefault: false`; default workspace is created only by the WS-01 backfill migration
- `deleteWorkspace` enforces two safety rules:
  1. Rejects deletion of the default workspace (`BadRequestException`)
  2. Before deleting, looks up the user's default workspace; if missing, fails clearly (`NotFoundException`) rather than silently nulling project associations
  3. Reassigns all projects in the deleted workspace to the user's default workspace (`UPDATE projects SET workspace_id = defaultId WHERE workspace_id = deletedId`) before removing the workspace row

### `WorkspacesController`

- `@Controller('workspaces')`, `@UseGuards(JwtAuthGuard)` at class level
- Extracts `userId` from `req.user.userId` on every handler
- UUID regex route guard on `:id` for GET and DELETE (`[0-9a-fA-F-]{36}`)

### Module wiring

- `WorkspacesModule` imports `TypeOrmModule.forFeature([Workspace, Project])` — no additional module dependencies
- Registered in `AppModule` alongside `ProjectsModule`

---

## What Was Not Implemented

- No frontend/UI
- No project list filtering by workspace
- No project creation with workspace choice
- No move-project-between-workspaces
- No members / roles / billing / shared integrations
- No nested workspaces
- No session-to-workspace relationship
- No entity, migration, or schema changes
- No broader workspace awareness in project/session flows

---

## Validation

| Check | Result |
|---|---|
| `npm run build` (from `services/api-gateway`) | Passed — clean TypeScript compile |
| `npx jest "src/workspaces/workspaces.service.spec.ts" --runInBand` | Passed — 7/7 tests green |
| `npx jest "src/workspaces/workspaces.controller.spec.ts" --runInBand` | Passed — 2/2 tests green |
| `ReadLints` on all touched WS-02 files | No linter errors |
| Broader integration/e2e route tests | Not run in this step |

---

## Preserved Invariants

- Workspace remains personal-only in v1; no shared/team semantics
- Ownership is strictly user-scoped across all five endpoints
- WS-01 backfill/default-workspace assumptions remain intact
- Existing project/session/history semantics unchanged beyond the minimal deletion-safety policy (project reassignment on workspace delete)
- Future expansion to members/roles/billing remains possible without redesign
- Scope stayed backend-only throughout this slice
