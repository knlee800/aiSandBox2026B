# ADV-05-01 CHECKPOINT — Public Sharing and Community Layer

## Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | ADV-05-01 |
| **Title** | Public Sharing and Community Layer |
| **Nature** | IMPLEMENTATION (ADVANCED PRODUCT, PUBLIC SHARING FOUNDATION) |
| **Status** | COMPLETE and LOCKED |
| **Checkpoint file** | `docs/ADV-05-01-CHECKPOINT.md` |
| **Spec** | `docs/specs/ADV-05-01-public-sharing-community.md` |
| **Dependencies** | ADV-04-01 (Complete and Locked) |

---

## Objective Completed

Implemented the first bounded public-sharing slice so a user can publish a controlled public view of selected project/workspace output, without expanding into a full social/community platform. Users can toggle project visibility (private/public), browse a public project listing, view read-only public project detail, and fork a public project into an independent private copy.

---

## Exact Files Changed

**Backend (modified):**
- `services/api-gateway/src/entities/project.entity.ts` — added `visibility: ProjectVisibility` field, default `'private'`
- `services/api-gateway/src/projects/projects.controller.ts` — added `PATCH :id/visibility` endpoint
- `services/api-gateway/src/projects/projects.service.ts` — added `updateProjectVisibility`, `listPublicProjects`, `getPublicProjectById`, `forkPublicProject` methods; `createProject` now sets `visibility: 'private'` explicitly
- `services/api-gateway/src/projects/projects.module.ts` — registered `PublicProjectsController`

**Backend (new files):**
- `services/api-gateway/src/migrations/1771592000000-AddProjectVisibility.ts` — migration file
- `services/api-gateway/src/projects/dto/update-project-visibility.dto.ts` — DTO for visibility update endpoint
- `services/api-gateway/src/projects/public-projects.controller.ts` — unauthenticated `GET /projects/public`, `GET /projects/public/:id`; JWT-guarded `POST /projects/public/:id/fork`

**Backend (tests updated):**
- `services/api-gateway/src/projects/projects.controller.spec.ts` — updated for visibility endpoint
- `services/api-gateway/src/projects/projects.service.spec.ts` — added visibility/public/fork coverage
- `services/api-gateway/src/projects/public-projects.controller.spec.ts` — new focused spec for public controller

**Frontend (modified):**
- `frontend/components/workspace/workspace-projects.logic.ts` — added `WorkspacePublicProjectSummary`, `WorkspacePublicProjectDetail`, `updateWorkspaceProjectVisibility`, `loadPublicWorkspaceProjects`, `loadPublicWorkspaceProjectDetail`, `forkPublicWorkspaceProject`
- `frontend/components/workspace/workspace-projects.logic.test.ts` — added test cases for new sharing functions
- `frontend/components/workspace/workspace-shell.tsx` — added visibility toggle, public browse panel, read-only detail display, and fork button to `HistoryProjectPanel`
- `frontend/components/workspace/workspace-shell.test.tsx` — updated for sharing UI assertions
- `frontend/app/[locale]/app/page.tsx` — wired visibility state, public project list/view/fork state and handlers

**Frontend (new files):**
- `frontend/app/[locale]/share/page.tsx` — minimal public browse page
- `frontend/app/[locale]/share/[projectId]/page.tsx` — minimal read-only public project detail page with fork button

---

## Tests Run and Results

| Command | Result |
|---------|--------|
| `npm test -- src/projects/projects.service.spec.ts src/projects/projects.controller.spec.ts src/projects/public-projects.controller.spec.ts` | **PASS** (3 suites, 17 tests) |
| `npm run build` | **PASS** |
| `npm test -- workspace-projects.logic.test.ts workspace-shell.test.tsx` | **PASS** (21 suites, 156 tests) |
| `npx tsc --noEmit` | **PASS** |
| `ReadLints` on all touched backend/frontend files | No linter errors |

---

## Migration

**Migration was required.**

- **File:** `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\migrations\1771592000000-AddProjectVisibility.ts`
- **What it adds:** Adds a `visibility` column (`character varying(16) NOT NULL DEFAULT 'private'`) to the `projects` table, and a supporting `idx_projects_visibility` index. Defaults all existing projects to `'private'`, preserving the private-by-default invariant.

---

## Scope Adherence

Scope stayed fully within ADV-05-01. No social feed, comments, likes, follows, moderation platform, marketplace, or billing/quota changes were introduced.

---

## Preserved Behaviors

- **Project ownership and private-by-default visibility semantics preserved.** All existing projects default to `visibility = 'private'`. The existing `getProjectByIdForUser` ownership enforcement is unchanged. All owned-project mutation endpoints (rename, associate, open) preserve their ownership checks.
- **Session isolation preserved; forks create independent projects with no shared mutable session state.** `forkPublicProject` creates a brand-new project entity for the requesting user. No session or snapshot state is shared between original and fork.
- **JWT auth and ownership enforcement on all non-public endpoints preserved.** The public list/detail endpoints are unauthenticated. The fork endpoint uses `JwtAuthGuard`. All existing JWT-guarded controllers (sessions, AI execution, snapshots, checkpoints) are untouched.
- **Existing project identity (PR-03-01) preserved.** `createProject`, `renameProject`, `associateSessionWithProject`, `openProjectIntoSession`, and existing controller routes are unmodified in behavior.
- **Project save/restore (PR-01-01) preserved.** `SnapshotPersistenceService` and all snapshot/archive endpoints are untouched.
- **Workspace/chat/AI execution/orchestration/build behavior preserved.** No changes to chat, AI execution, orchestration, build target, or exec surfaces.
- **CO-01/02/03 quota/plan/admin surfaces preserved.** No changes to quota, plan, or admin controllers.
- **ADV-01–04 behavior preserved.** Multi-AI, orchestration, build, and public API surfaces are untouched.
- **Request-driven behavior preserved.** No background workers, polling loops, or timers introduced.
- **No background workers introduced.**

---

## Delivered Capability

- **Project visibility field** (`private` / `public`) added to the `Project` entity; `private` is the default for new and existing projects.
- **Privacy toggle** added on the existing project surface in the workspace shell — owner can toggle visibility and submit via `PATCH /api/projects/:id/visibility`.
- **Bounded public project list** exposed at `GET /api/projects/public` (unauthenticated) — returns id, name, visibility, timestamps only; no owner identity leaked.
- **Read-only public project detail** at `GET /api/projects/public/:id` — includes `readOnly: true` in the response contract.
- **Public browse page** at `[locale]/share` — minimal listing of public projects with links to detail pages.
- **Read-only public project view** at `[locale]/share/[projectId]` — read-only detail page with fork button.
- **Fork flow** at `POST /api/projects/public/:id/fork` (JWT required) — creates a new independent private project for the authenticated user; no shared state with the original.
- **No social/community expansion** introduced — no comments, likes, follows, moderation, ranking, or marketplace.

---

## Next Follow-up Boundary

ADV-05-01 delivers bounded read-only public sharing and independent fork. A natural follow-up, if required, would be project search/discovery (e.g., keyword search across public projects) — currently out of scope per the ADV-05-01 spec.
