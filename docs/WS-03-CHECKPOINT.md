# WS-03 CHECKPOINT — Project Create/List Workspace-Awareness Foundation

## Task Metadata

| Field | Value |
|---|---|
| Task ID | WS-03 |
| Family | WS (Workspace Rollout) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND / API — project create/list workspace-awareness |
| Date completed | 2026-04-28 |
| Source | WS v1 rollout — third slice; follows WS-02 CRUD API foundation |

---

## Objective

Make backend project create/list/read flows workspace-aware by allowing project creation into a chosen workspace, defaulting to the user's default workspace when omitted, supporting optional workspace filtering on project list, and surfacing `workspaceId` in project responses — while keeping all ownership checks user-scoped and stopping before any frontend workspace selector/UI.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `services/api-gateway/src/projects/dto/create-project.dto.ts` | Added optional `workspaceId?: string` (`@IsOptional()`, `@IsUUID()`) |
| `services/api-gateway/src/projects/projects.controller.ts` | Forwards `workspaceId` on create; adds optional `@Query('workspaceId')` on list |
| `services/api-gateway/src/projects/projects.service.ts` | `createProject` gains workspace resolution/validation; `listProjects` gains optional workspace filter; injects `WorkspacesService` |
| `services/api-gateway/src/projects/projects.module.ts` | Imports `WorkspacesModule` |
| `services/api-gateway/src/projects/projects.service.spec.ts` | Added workspace-aware cases; updated existing fixture to include `WorkspacesService` mock |
| `services/api-gateway/src/projects/projects.controller.spec.ts` | Updated existing create/list test to cover forwarding of `workspaceId` |

No entity, migration, or schema file changed in WS-03.

---

## Implementation Summary

### `CreateProjectDto`

Added optional field:
- `@IsOptional() @IsUUID() workspaceId?: string`

Existing `name` field and validation unchanged.

### `ProjectsController`

- `createProject`: passes `body.workspaceId` as third argument to service
- `listProjects`: adds `@Query('workspaceId') workspaceId?: string`; passes it through to service

### `ProjectsService.createProject(userId, name, workspaceId?)`

New behavior when called:

1. Resolves workspace:
   - if `workspaceId` is provided → calls `workspacesService.getWorkspaceByIdForUser(userId, workspaceId)` to validate ownership (throws `NotFoundException` on cross-user or missing)
   - if omitted → calls `workspacesService.listWorkspaces(userId)` and picks the entry where `isDefault === true`
   - if neither path produces a workspace id → throws `NotFoundException` clearly rather than silently writing `null`
2. Writes `workspaceId: resolvedWorkspaceId` onto the created project entity

`forkPublicProject` was left unchanged — forks continue to land with `workspaceId: null` (no workspace-aware semantics introduced in this slice).

### `ProjectsService.listProjects(userId, workspaceId?)`

Updated to:
```
where: { userId, ...(workspaceId ? { workspaceId } : {}) }
```
User scoping is preserved regardless of whether a workspace filter is applied.

### `ProjectsModule`

Added `WorkspacesModule` to `imports` array so `WorkspacesService` is available via NestJS DI.

### `GET /api/projects/:id`

No code change. `workspaceId` is already a column on the `Project` entity from WS-01 and serializes automatically in the existing response.

---

## What Was Not Implemented

- No frontend/UI
- No move-project-between-workspaces
- No workspace switcher/filter UI
- No members / roles / billing / shared integrations
- No entity, migration, or schema changes
- No new endpoints — all changes are additive to existing project routes
- No later workspace slices

---

## Validation

| Check | Result |
|---|---|
| `npm run build` (from `services/api-gateway`) | Passed — clean TypeScript compile |
| `npx jest "src/projects/projects.service.spec.ts" --runInBand` | Passed — 15/15 tests green |
| `npx jest "src/projects/projects.controller.spec.ts" --runInBand` | Passed — 3/3 tests green |
| `ReadLints` on all touched WS-03 files | No linter errors |
| Broader integration/e2e route tests | Not run in this step |

---

## Preserved Invariants

- Workspace remains personal-only in v1; no shared/team semantics
- Ownership is strictly user-scoped on all changed paths
- WS-01 default-workspace assumptions remain intact — default fallback relies on `isDefault: true` presence
- Existing project/session/history semantics unchanged
- No frontend behavior introduced
- Scope stayed backend-only throughout this slice
