# AI-CONTEXT-04A Checkpoint — Repo Docs Registry Backend Foundation

**Task ID:** AI-CONTEXT-04A
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-06

---

## What Was Delivered

Backend-only registry for project-selected repo doc paths that agents should later read/inject into prompt context.

No frontend UI, no prompt injection, and no file-content reading were included in this slice.

---

## Files Changed

### New files

- `services/api-gateway/src/migrations/1772000000000-CreateProjectRepoDocsTable.ts`
- `services/api-gateway/src/entities/project-repo-doc.entity.ts`
- `services/api-gateway/src/project-repo-docs/dto/upsert-project-repo-docs.dto.ts`
- `services/api-gateway/src/project-repo-docs/project-repo-docs.service.ts`
- `services/api-gateway/src/project-repo-docs/project-repo-docs.controller.ts`
- `services/api-gateway/src/project-repo-docs/project-repo-docs.module.ts`
- `services/api-gateway/src/project-repo-docs/project-repo-docs.service.spec.ts`
- `services/api-gateway/src/project-repo-docs/project-repo-docs.controller.spec.ts`

### Modified files

- `services/api-gateway/src/entities/index.ts` — added `ProjectRepoDoc` export
- `services/api-gateway/src/app.module.ts` — imported `ProjectRepoDocsModule`

---

## Migration

Table: `project_repo_docs`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | primary key, default `gen_random_uuid()` |
| `project_id` | UUID | FK to `projects(id)` ON DELETE CASCADE |
| `path` | TEXT | not null |
| `mode` | TEXT | not null, default `'always'` |
| `created_at` | TIMESTAMPTZ | default `now()` |
| `updated_at` | TIMESTAMPTZ | default `now()` |

Constraints:
- `UNIQUE (project_id, path)`
- `CHECK (mode IN ('always'))`
- `INDEX idx_project_repo_docs_project_id ON (project_id)`

---

## API Endpoints

### GET /api/projects/:projectId/repo-docs
Returns the registered repo doc paths for the project.

Response: `{ docs: [{ path: string; mode: 'always' }] }`

### PUT /api/projects/:projectId/repo-docs
Replaces all registered repo doc paths for the project atomically (delete + insert in transaction).

Request body: `{ docs: [{ path: string; mode?: 'always' }] }`
Response: `{ docs: [{ path: string; mode: 'always' }] }`

Both endpoints:
- Require `SessionCookieGuard`
- Enforce project ownership via `ProjectsService.getProjectByIdForUser(req.user.userId, projectId)`

---

## DTO Validation

- `docs` must be an array (max 20 items)
- Each item `path` must be a string (max 500 chars)
- Each item `mode` is optional; only `'always'` is accepted

---

## Safe-Path Validation (service layer)

Validates on every `replaceForProject` call:

- Trims path before validation
- Rejects empty or whitespace-only paths
- Rejects paths starting with `/`
- Rejects paths matching drive-letter prefix (e.g., `C:`)
- Rejects paths containing `\` (backslash)
- Rejects any path segment equal to `..`
- Enforces max length of 500 characters
- Rejects mode values other than `'always'`
- Deduplicates normalized paths (first occurrence wins)
- Returns results sorted by path ASC

---

## Tests

### `project-repo-docs.service.spec.ts`

- `listByProjectId` returns empty array when no rows
- `replaceForProject` creates new docs with mode defaulting to `always`
- `replaceForProject` replaces prior rows atomically (delete then insert)
- `replaceForProject` deduplicates duplicate paths after trimming
- `replaceForProject` rejects `../secret.md`
- `replaceForProject` rejects `/absolute.md`
- `replaceForProject` rejects `C:\secret.md`
- `replaceForProject` rejects backslash paths
- `replaceForProject` rejects empty/whitespace paths
- `replaceForProject` rejects mode values other than `always`

### `project-repo-docs.controller.spec.ts`

- `SessionCookieGuard` is applied at controller level (metadata check)
- GET enforces ownership and returns `{ docs }` response shape
- PUT enforces ownership and returns `{ docs }` response shape
- GET denies access when project ownership check throws `NotFoundException`
- DTO rejects mode values other than `always`
- DTO rejects non-array `docs` shape

---

## Validation Results

- `npm test -- project-repo-docs` — PASS (2 suites, 16 tests)
- `npm run build` — PASS
- `ReadLints` on all touched files — PASS (no linter errors)

---

## Non-goals Confirmed

- No frontend changes
- No ai-service changes
- No prompt assembly changes
- No repo doc content reading
- No repo map
- No validation contract
- No Active Context indicator changes
- No unrelated services changed

---

## Invariants Preserved

- Existing `project_ai_context`, `user_ai_instructions`, and all prior entities are unchanged.
- `ProjectsService.getProjectByIdForUser` ownership pattern is followed without modification.
- Internal service auth guards and session cookie behavior are unchanged.
- No migration timestamps conflict with existing migrations.
