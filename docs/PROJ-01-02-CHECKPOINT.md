# PROJ-01-02 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-02
- Title: Fix Public Projects Route Collision
- Nature: BUG FIX (PROJECT/PUBLIC FLOW, ROUTING)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-02-CHECKPOINT.md`

## Objective

Fix the backend/public-projects route collision so `GET /api/projects/public` resolves to the intended public-projects list endpoint instead of being intercepted by the authenticated project-id route.

## Root Cause Confirmed

- `ProjectsController` has a guarded `@Get(':id')` route under `@Controller('projects')`.
- `PublicProjectsController` has the intended unguarded `@Get()` route under `@Controller('projects/public')`.
- The generic `:id` matcher accepted `public`, so `/api/projects/public` was routed to the guarded project-id path first.

## Fix Implemented (Smallest Safe Boundary)

- Updated `ProjectsController` project-id route from:
  - `@Get(':id')`
- To:
  - `@Get(':id([0-9a-fA-F-]{36})')`

This constrains the guarded project-id route to UUID-shaped ids and prevents `/public` from matching the guarded id route.

## Files Changed

- `services/api-gateway/src/projects/projects.controller.ts`
- `services/api-gateway/src/projects/projects-routing.integration.spec.ts` (new)

## Validation Run

Command:

- `npm test -- src/projects/projects.controller.spec.ts src/projects/public-projects.controller.spec.ts src/projects/projects-routing.integration.spec.ts`

Result:

- PASS
- 3 suites passed
- 10 tests passed

## Validation Coverage

- `GET /projects/public` resolves to public list endpoint without auth interception (unauthenticated and authenticated calls both return success in integration test).
- Existing authenticated `GET /projects/:id` behavior remains intact.
- Existing unauthenticated `GET /projects/public/:id` behavior remains intact.

## Scope and Invariants Preserved

- No public sharing redesign
- No project-system redesign
- No feature expansion
- No scope expansion
