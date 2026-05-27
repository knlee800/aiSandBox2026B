# WORKSPACE-DEFAULT-01 Checkpoint — Restore Default Workspace Invariant

**Task ID:** WORKSPACE-DEFAULT-01
**Family:** WORKSPACE — Default Workspace Invariant
**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-27
**Depends on:** UX-IA-23 (COMPLETE and LOCKED — `docs/UX-IA-23-CHECKPOINT.md`)

---

## Root Cause

Newer users can have zero workspaces. The WS-01 migration backfilled only pre-existing users; current user-creation paths (`AuthService.register`, `findOrCreateGoogleUser`, `findOrCreateAppleUser`) do not create a default workspace row. When `ProjectsService.createProject` is called without an explicit `workspaceId`, the prior code threw `NotFoundException("Default workspace for user ... not found.")`, blocking project creation entirely.

---

## Files Changed

Production source (implementation only — not touched during consolidation):

- `services/api-gateway/src/workspaces/workspaces.service.ts`
- `services/api-gateway/src/projects/projects.service.ts`

Tests:

- `services/api-gateway/src/workspaces/workspaces.service.spec.ts`
- `services/api-gateway/src/projects/projects.service.spec.ts`

---

## Backend Invariant Fix Summary

- Added `WorkspacesService.ensureDefaultWorkspaceForUser(userId)`:
  - Returns the existing default workspace if one is present (`isDefault: true`).
  - Creates a new default `Personal` workspace when none exists, using `generateUniqueSlug` for slug uniqueness, `isDefault: true`.
- Updated `WorkspacesService.listWorkspaces(userId)` to call `ensureDefaultWorkspaceForUser` before returning the list — self-heals zero-workspace users on any list call.
- Updated `ProjectsService.createProject(userId, name, workspaceId?)`: when `workspaceId` is omitted, resolves/creates the default workspace via `ensureDefaultWorkspaceForUser` instead of throwing `NotFoundException`.
- Explicit `workspaceId` ownership validation is unchanged.
- All existing API response shapes preserved.

---

## Tests Updated

`workspaces.service.spec.ts`:
- listWorkspaces creates default Personal workspace when none exists
- listWorkspaces does not create duplicate default when one already exists

`projects.service.spec.ts`:
- omitted workspaceId path uses ensureDefaultWorkspaceForUser
- createProject auto-recovers default workspace when missing
- explicit workspaceId validation behavior remains intact
- obsolete default-missing NotFound expectation removed

---

## Validation Results

| Check | Result |
|---|---|
| `npm run build` (api-gateway) | PASS |
| Focused specs (2 suites, 26 tests) | PASS |
| ReadLints (touched files) | PASS — 0 new errors |
| Full `npm test` (api-gateway) | PARTIAL — touched specs PASS; pre-existing unrelated failures: REDIS_URL not set, integration test timeouts in env-dependent suites not part of this task |

Full-suite caveat: the pre-existing failures (REDIS_URL env var missing, integration timeout failures) are unrelated to the touched files and were present before this task.

---

## Acceptance Checks

- [x] `ensureDefaultWorkspaceForUser` returns existing default without side effects when one exists
- [x] `ensureDefaultWorkspaceForUser` creates default Personal workspace when none exists
- [x] `listWorkspaces` triggers self-heal for zero-workspace users
- [x] `createProject` without `workspaceId` resolves default instead of throwing `NotFoundException`
- [x] Explicit `workspaceId` ownership validation unchanged
- [x] All existing workspace/project service tests still pass
- [x] `npm run build` passes for `api-gateway`
- [x] No frontend files changed
- [x] `docs/WORKSPACE-DEFAULT-01-CHECKPOINT.md` created

---

## Non-Goals Confirmed

- No frontend changes
- No UI copy changes
- No locale key additions
- No route, model, or entity rename
- No schema migration
- No broad workspace/project redesign

---

## Next Live-Test Step

With Docker and PostgreSQL running, log in as a user confirmed to have zero workspace rows (e.g., `4329e051-ce13-46b5-83ef-357faf749d90`) and verify:

1. `GET /api/workspaces` returns a `Personal` workspace (auto-created on first list call).
2. `POST /api/projects` without `workspaceId` body succeeds and the project is created under the auto-created default workspace.
3. Re-listing workspaces does not create a duplicate Personal workspace.
