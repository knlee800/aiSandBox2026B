# AI-CONTEXT-02A CHECKPOINT — Project AI Instructions Backend Foundation

**Status:** COMPLETE and LOCKED
**Task ID:** AI-CONTEXT-02A
**Family:** AI-CONTEXT (Project AI Instructions)
**Priority:** High
**Nature:** BACKEND / DATABASE / AI CONTEXT FOUNDATION
**Risk:** Medium
**Depends on:** AI-CONTEXT-01A through AI-CONTEXT-01E (COMPLETE and LOCKED)
**Date:** 2026-06-05

---

## Problem

Global AI Instructions are end-to-end complete, but there was no way to define project-specific AI instructions. Agents could not receive per-project rules, architecture notes, conventions, or "do/don't" guidance.

---

## Objective

Create backend infrastructure for project-scoped AI instructions. These instructions will later be editable in the frontend and injected into prompt assembly together with Global AI Instructions.

---

## Files Changed

- `services/api-gateway/src/migrations/1771900000000-CreateProjectAiContextTable.ts` (NEW)
- `services/api-gateway/src/entities/project-ai-context.entity.ts` (NEW)
- `services/api-gateway/src/entities/index.ts`
- `services/api-gateway/src/project-ai-context/dto/upsert-project-ai-context.dto.ts` (NEW)
- `services/api-gateway/src/project-ai-context/project-ai-context.service.ts` (NEW)
- `services/api-gateway/src/project-ai-context/project-ai-context.controller.ts` (NEW)
- `services/api-gateway/src/project-ai-context/project-ai-context.module.ts` (NEW)
- `services/api-gateway/src/project-ai-context/project-ai-context.service.spec.ts` (NEW)
- `services/api-gateway/src/project-ai-context/project-ai-context.controller.spec.ts` (NEW)
- `services/api-gateway/src/app.module.ts`

No frontend, ai-service, prompt assembly, repo docs registry, repo map, validation contract, or unrelated governance files were changed during implementation.

---

## Implementation Details

### Migration

`1771900000000-CreateProjectAiContextTable.ts` creates the `project_ai_context` table:

```sql
CREATE TABLE IF NOT EXISTS "project_ai_context" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE,
  "project_instructions" text NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

Index: `idx_project_ai_context_project_id` on `project_id`.

### Entity

`ProjectAiContext` TypeORM entity with:
- `id` (uuid PK)
- `projectId` (uuid, unique, FK → `projects.id` ON DELETE CASCADE)
- `projectInstructions` (text nullable)
- `createdAt`, `updatedAt`
- `ManyToOne` relation to `Project`

Exported from `entities/index.ts`.

### DTO

`UpsertProjectAiContextDto`:
- `projectInstructions?: string | null`
- `@IsOptional() @IsString() @MaxLength(4000)`

### Service

`ProjectAiContextService`:
- `getByProjectId(projectId: string): Promise<string | null>` — returns `projectInstructions` or `null`
- `upsert(projectId: string, projectInstructions: string | null): Promise<string | null>` — create-or-update pattern, consistent with `UserAiInstructionsService`

Blank/whitespace normalization not implemented — consistent with existing `user-ai-instructions` service behavior.

### Controller

`ProjectAiContextController` at `projects/:projectId/ai-context`:
- `GET /api/projects/:projectId/ai-context` → `{ projectInstructions: string | null }`
- `PUT /api/projects/:projectId/ai-context` → `{ projectInstructions: string | null }`
- Protected with `@UseGuards(SessionCookieGuard)` at controller level
- Ownership enforced by calling `ProjectsService.getProjectByIdForUser(req.user.userId, projectId)` before each operation — throws `NotFoundException` (404) for non-owners, consistent with the existing project-access convention across the codebase

### Module

`ProjectAiContextModule` imports `TypeOrmModule.forFeature([ProjectAiContext])`, `AuthModule`, `ProjectsModule`. Imported in `AppModule` alongside `UserAiInstructionsModule`.

---

## Acceptance Criteria

- [x] Migration creates `project_ai_context` table with correct schema
- [x] GET returns current project instructions or null
- [x] PUT upserts project instructions for the project
- [x] Max 4000 chars validation works
- [x] Auth/session guard protects both endpoints
- [x] Project ownership/access is enforced
- [x] Targeted tests pass
- [x] api-gateway build passes
- [x] No frontend files changed
- [x] No prompt assembly changed
- [x] No unrelated files changed

---

## Validation Results

| Check | Result |
|---|---|
| `npm test -- project-ai-context` | PASS — 2 suites, 8 tests |
| `npm run build` | PASS |
| ReadLints on touched files | PASS — no lint errors |

### Tests

`project-ai-context.service.spec.ts` (3 tests):
- `getByProjectId` returns null when no record exists
- `upsert` creates a new row when no record exists
- `upsert` updates existing row when record already exists

`project-ai-context.controller.spec.ts` (5 tests):
- applies `SessionCookieGuard` at controller level
- GET enforces ownership and maps response shape to `{ projectInstructions }`
- PUT enforces ownership and maps response shape to `{ projectInstructions }`
- denies access for non-owner by surfacing project ownership check failure
- DTO rejects `projectInstructions` over 4000 chars

---

## Non-goals Confirmed

- No frontend UI
- No prompt injection
- No repo docs registry
- No repo map
- No validation contract
- No ai-service changes
- No Global AI Instructions changes
- No unrelated services changed
