# PROJ-01-01 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-01
- Title: Diagnose Saved Project Open Flow And Public Projects Unauthorized Error
- Nature: BUG INVESTIGATION (PROJECT/PUBLIC FLOW, CORE PRODUCT USABILITY)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-01-CHECKPOINT.md`

## Objective

Determine why saved projects do not open correctly and why Public Projects fails with unauthorized, and isolate the exact failing stage(s) in the end-to-end project/public flow.

## Exact Commands / Actions / Checks Run

1. Read required governance/task/checkpoint context:
   - `CLAUDE.md`
   - `TASKS.md` (PROJ-01 section)
   - `TASKS_BACKLOG_FULL.md` (PROJ-01-01 entry)
   - `docs/PR-03-01-CHECKPOINT.md`
   - `docs/ADV-05-01-CHECKPOINT.md`
   - `docs/REL-01-02-CHECKPOINT.md`
   - `docs/UX-01-FINAL-CHECKPOINT.md`
2. Traced frontend project/public request paths:
   - `frontend/components/workspace/workspace-projects.logic.ts`
   - `frontend/app/[locale]/app/page.tsx`
   - `frontend/app/[locale]/share/page.tsx`
   - `frontend/app/[locale]/share/[projectId]/page.tsx`
3. Traced backend endpoint/guard paths:
   - `services/api-gateway/src/projects/projects.controller.ts`
   - `services/api-gateway/src/projects/public-projects.controller.ts`
   - `services/api-gateway/src/projects/projects.service.ts`
   - `services/api-gateway/src/projects/projects.module.ts`
4. Runtime checks (PowerShell against `http://localhost:4000`):
   - `GET /api/health`
   - `GET /api/projects/public` (unauthenticated)
   - register/login, then `GET /api/projects/public` (authenticated)
   - create session/project/snapshot/write file
   - `POST /api/projects/:id/open` without snapshot
   - `POST /api/projects/:id/open` with snapshot
   - `POST /api/sessions/:id/files/read`
   - `GET /api/sessions/:id`
   - create public project and verify `GET /api/projects/public/:id` unauthenticated

## Exact Request Chains

### A) Saved project open flow

1. Frontend trigger:
   - `handleOpenWorkspaceProject()` in `frontend/app/[locale]/app/page.tsx`
2. Frontend request:
   - `openWorkspaceProject()` in `frontend/components/workspace/workspace-projects.logic.ts`
   - `POST /api/projects/:projectId/open`
   - headers: `Authorization: Bearer <access_token>`
   - payload: `{ sessionId, snapshotId? }`
3. Backend endpoint:
   - `ProjectsController.openProjectIntoSession()` (`projects.controller.ts`)
   - guarded by `JwtAuthGuard` (controller-level)
4. Backend service behavior:
   - `ProjectsService.openProjectIntoSession()`
   - always associates `session.projectId`
   - only restores workspace content when `snapshotId` is provided
5. Resulting runtime state:
   - open without snapshot: association occurs, content unchanged
   - open with snapshot: snapshot restore occurs, content changes to snapshot state

### B) Public projects load flow

1. Frontend trigger:
   - `loadPublicWorkspaceProjectsList()` in `frontend/app/[locale]/app/page.tsx`
   - also `/share` page via `loadPublicWorkspaceProjects()`
2. Frontend request:
   - `GET /api/projects/public`
   - no auth header (intended public list)
3. Backend intended public endpoint:
   - `PublicProjectsController.listPublicProjects()` in `public-projects.controller.ts`
   - no guard for list/detail
4. Conflicting guarded endpoint:
   - `ProjectsController` is controller-level guarded with `JwtAuthGuard`
   - contains `@Get(':id')`
   - `projects.module.ts` registers controllers in this order:
     - `ProjectsController`
     - `PublicProjectsController`
5. Runtime behavior:
   - `GET /api/projects/public` unauthenticated => `401 Unauthorized`
   - `GET /api/projects/public` authenticated => `500 Internal server error`
   - `GET /api/projects/public/:id` unauthenticated can work (public detail path), indicating the specific break is the list route collision on `/public`.

## Smallest Evidence Set

- Public list unauth result:
  - `PUBLIC_LIST_UNAUTH_HTTP=401`
  - `PUBLIC_LIST_UNAUTH_BODY={"message":"Unauthorized","statusCode":401}`
- Public list auth result:
  - `PUBLIC_LIST_AUTH_HTTP=500`
  - `PUBLIC_LIST_AUTH_BODY={"statusCode":500,"message":"Internal server error"}`
- Public detail unauth result:
  - `PUBLIC_DETAIL_UNAUTH_VISIBILITY=public`
- Project open behavior results:
  - `OPEN_NO_SNAPSHOT_RESTORED=` (null)
  - `READ_AFTER_OPEN_NO_SNAPSHOT=B-after-snapshot`
  - `OPEN_WITH_SNAPSHOT_RESTORED=<snapshotId>`
  - `READ_AFTER_OPEN_WITH_SNAPSHOT=A-before-snapshot`
  - `SESSION_PROJECT_ID_AFTER_OPEN=<projectId>`

## Exact Failing Stage(s) Identified

1. **Public Projects unauthorized/failure:**
   - Failing stage is backend route resolution for `GET /api/projects/public`.
   - The guarded param route `GET /api/projects/:id` in `ProjectsController` intercepts `/public` before `PublicProjectsController.listPublicProjects()` is reached.
   - This causes unauthenticated `401` and authenticated `500` instead of returning the public list.

2. **Saved project open “not usable” behavior:**
   - Backend open path is functioning as currently implemented.
   - `openProjectIntoSession` associates session to project, but does **not** restore content unless `snapshotId` is explicitly supplied.
   - There is no project-linked snapshot source-of-truth in this flow; open behavior depends on optional snapshot input, which can make project open appear to do nothing (association only) or restore unrelated snapshot state.

## Relationship Between Symptoms

- Symptoms are **separate**:
  - Public Projects unauthorized is a concrete backend route/guard collision bug.
  - Saved project open issue is a project-open state restoration behavior gap (association vs restoration input), not the same failure as public unauthorized.

## Conclusion

Diagnosis is complete and bounded. The failures are narrowed for small follow-up fixes:
- one bounded fix for public projects list route/guard collision
- one bounded fix for deterministic project-open restoration behavior/source-of-truth
