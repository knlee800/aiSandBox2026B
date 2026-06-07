# AI-CONTEXT-04C Checkpoint — Inject Repo Docs into Prompt Assembly

**Task ID:** AI-CONTEXT-04C
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-07

---

## What Was Delivered

Server-side injection of registered project Repo Docs into AI execution prompts.

During AI execution, the API Gateway now resolves the active session's project, loads its registered Repo Docs (from the existing `project_repo_docs` table), reads each doc's content from the session's workspace container using the existing safe file-read path (`ContainerManagerHttpClient.readSessionFile`), and injects a bounded Repo Docs block into the user-side prompt before the normal workspace context.

Extends AI-CONTEXT-04A (Repo Docs Registry Backend) and AI-CONTEXT-04B/04B1 (Repo Docs UI). No frontend changes, no database schema changes, no container-manager changes, no new HTTP endpoints.

---

## Files Changed

### API Gateway

- `services/api-gateway/src/ai/ai.module.ts` — imported `ProjectRepoDocsModule`; added `ContainerManagerHttpClient` to providers
- `services/api-gateway/src/ai/ai-execution.controller.ts` — injected `ProjectRepoDocsService` and `ContainerManagerHttpClient` (both `@Optional()`); added `resolveRepoDocContents(sessionId, userId)` private method; added `enrichedWorkspaceContext` assembly in `execute()`; added debug log for repo doc context presence
- `services/api-gateway/src/clients/ai-service-http.client.ts` — added `WorkspaceRepoDocContent` interface; added `repoDocContents?: WorkspaceRepoDocContent[]` field to `WorkspaceContext`
- `services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts` — added 5 new test cases covering repo doc resolution, unreadable doc skip, null projectId omission, user mismatch omission, empty registry omission

### AI Service

- `services/ai-service/src/queue/job.types.ts` — added `WorkspaceRepoDocContent` interface; added `repoDocContents?: WorkspaceRepoDocContent[]` field to `WorkspaceContext`
- `services/ai-service/src/worker/worker.processor.ts` — added `normalizedRepoDocContents` processing in `buildWorkspaceContextBlock`; added Repo Docs block (before workspace context sections) in user prompt; added `repoDocContents.length === 0` to the empty-context guard
- `services/ai-service/src/worker/worker.processor.spec.ts` — added 5 new test cases: Repo Docs block rendered before workspace context, block omitted when absent/empty, only-repoDocContents non-empty context, truncation suffix passthrough, system prompt isolation

---

## Implementation Detail

### API Gateway: `resolveRepoDocContents(sessionId, userId)`

Located in `AIExecutionController`. Called after `resolveProjectInstructions` during `execute()`.

Behavior:
1. Returns `undefined` if `projectRepoDocsService` or `containerManagerHttpClient` is not injected (safety guard for optional DI).
2. Returns `undefined` if `sessionId` is missing or blank.
3. Calls `SessionService.getSessionById(sessionId)`.
4. Returns `undefined` if session not found (caught, debug-logged).
5. Returns `undefined` if `session.userId !== userId` (warn-logged — cross-user guard).
6. Returns `undefined` if `session.projectId` is null or empty.
7. Calls `ProjectRepoDocsService.listByProjectId(session.projectId)`.
8. Returns `undefined` if registry is empty or call fails (warn-logged).
9. Caps to 10 docs maximum.
10. For each doc: calls `ContainerManagerHttpClient.readSessionFile(sessionId, path)`, trims content, skips empty, truncates at 8000 chars with suffix `[...truncated at 8000 characters]`. Read failures are warn-logged and the doc is skipped.
11. Returns `undefined` if no readable docs remain.

The `execute()` method builds `enrichedWorkspaceContext` by spreading `request.workspaceContext` and adding `repoDocContents` only when at least one doc was readable. If no readable docs exist, `request.workspaceContext` is passed unchanged.

### AI Service: Repo Docs prompt block

`buildWorkspaceContextBlock` in `worker.processor.ts`:
- Processes `workspaceContext.repoDocContents` alongside existing fields.
- Added `normalizedRepoDocContents.length === 0` to the early-return empty-context guard.
- Renders a Repo Docs section **before** all other workspace sections:

```
Repo Docs:

Repo doc content: <path>
<content>

Repo doc content: <path>
<content>
```

### Prompt placement (unchanged system/user split)

**System message:**
1. `FILE_ACTION_OUTPUT_CONTRACT`
2. Global AI Instructions (if present)
3. Project AI Instructions (if present)

**User message:**
1. Repo Docs block (if present) — **new**
2. Workspace context (project name, workspace name, file tree, selected file, named files, search results)
3. User request

### Bounds enforced

| Limit | Value |
|---|---|
| Max docs per execution | 10 |
| Max chars per doc | 8000 |
| Truncation marker | `[...truncated at 8000 characters]` |

---

## Operational Note — Smoke Test Procedure

An initial smoke attempt failed silently. Investigation identified two operational requirements that must be satisfied for Repo Docs to be injected:

1. **Restart services after build.** Both `api-gateway` and `ai-service` use `node dist/main.js` as their start script. After any TypeScript source change, run `npm run build` and restart the service process before smoke testing. Auto-reload (`npm run dev`) also works.

2. **Link session to project before chatting.** `resolveRepoDocContents` derives `projectId` from `session.projectId` in the database. This field is set only when the user explicitly opens a project via the "Open Project" action (which calls `POST /api/projects/:projectId/sessions/:sessionId`). Simply selecting a project in the UI does not link the session. If `session.projectId` is null, repo docs will be silently omitted.

**Correct smoke procedure:**
1. Restart api-gateway and ai-service after build.
2. In the browser, select an active session and a project.
3. Click **"Open Project"** to link `session.projectId` in the database.
4. Register a Repo Doc path that **exists inside the container's `/workspace`** directory (not a host-system file path).
5. Ask: "What repo docs have you read?"
6. Verify the agent references content from the registered file.

---

## Validation Results

| Check | Command | Result |
|---|---|---|
| API Gateway focused tests | `npm test -- ai-execution.workspace-context.spec.ts` | PASS — 13/13 |
| AI Service focused tests | `npm test -- worker.processor.spec.ts` | PASS — 16/16 |
| API Gateway build | `npm run build` | PASS |
| AI Service build | `npm run build` | PASS |
| ReadLints (all touched files) | ReadLints tool | PASS — no linter errors |
| Live browser smoke | Register `WorkspaceA/CLAUDE.md`; ask "What repo docs have you read?" | PASS — agent responded: "I've read the content of `WorkspaceA/CLAUDE.md` (the governance/contract document), which was provided directly in this context." |

---

## Non-goals Confirmed

- No frontend changes
- No UX/UI changes
- No database schema changes
- No repo docs selector UI changes
- No repo map
- No validation contract
- No broad file tree/file manager redesign
- No container-manager changes
- No new HTTP endpoints
- No local disk reads from api-gateway
- No unrelated AI execution refactor
- Global and Project Instructions behavior unchanged
- `namedFileContents` behavior unchanged
- System/user prompt split unchanged

---

## Invariants Preserved

- `FILE_ACTION_OUTPUT_CONTRACT` remains first in system message
- Global AI Instructions remain in system message only
- Project AI Instructions remain in system message only
- `namedFileContents` blocks in user message are unchanged
- `selectedFileContent` / `selectedFilePath` in user message are unchanged
- All existing workspace context sections render in original order after the Repo Docs block
- Cross-user session guard: session.userId mismatch blocks repo doc loading
- No AI execution request fails solely because a repo doc cannot be read
- No AI execution request fails solely because the project has no registered docs
- Internal service auth guards and session cookie behavior unchanged

---

## Rollback

To revert AI-CONTEXT-04C:

1. Revert in `api-gateway/src/ai/ai.module.ts`: remove `ProjectRepoDocsModule` import and `ContainerManagerHttpClient` provider.
2. Revert in `api-gateway/src/ai/ai-execution.controller.ts`: remove `resolveRepoDocContents`, remove `enrichedWorkspaceContext`, restore `workspaceContext: request.workspaceContext` in `enqueueExecution`.
3. Revert in `api-gateway/src/clients/ai-service-http.client.ts`: remove `WorkspaceRepoDocContent` interface and `repoDocContents` field from `WorkspaceContext`.
4. Revert in `ai-service/src/queue/job.types.ts`: remove `WorkspaceRepoDocContent` interface and `repoDocContents` field.
5. Revert in `ai-service/src/worker/worker.processor.ts`: remove `normalizedRepoDocContents` processing and the Repo Docs sections block.
6. Rebuild and restart both services.

Repo Docs registration (AI-CONTEXT-04A/04B/04B1) is unaffected and remains functional after rollback.
