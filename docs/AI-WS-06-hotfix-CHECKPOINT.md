# AI-WS-06-hotfix CHECKPOINT — Route Workspace Search Through Container Exec

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AI-WS-06-hotfix |
| Family | AI-WS (AI Workspace Capability) |
| Status | COMPLETE and LOCKED |
| Nature | CONTAINER-MANAGER ROUTING HOTFIX — route AI workspace content search through Docker exec inside the active sandbox container, matching the read/write/list/delete architecture; update API gateway HTTP client to target the internal sessions search route |
| Date completed | 2026-05-04 |
| Source | Inspection session (May 2026) — AI-WS-06 workspace search can run and query is extracted correctly, but returns no matches even when named-file read can see the content and the keyword exists; root cause is the same host/container filesystem mismatch that affected delete before AI-WS-03-hotfix5: `FilesService.searchFiles()` uses `fs.readdir()` + `fs.readFile()` against the host `workspacePath`, while files live in the active container `/workspace/` view; on Windows/Docker Desktop/WSL2 this produces empty results |
| Depends on | AI-WS-06 (COMPLETE and LOCKED); AI-WS-03-hotfix5 (COMPLETE and LOCKED) |

---

## Objective

Route AI workspace content search through the same active-container execution path as read/write/list/delete so search operates against the active container `/workspace` filesystem view, eliminating the host-filesystem mismatch that caused `(no matches found)` even when the keyword existed in container files.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `services/container-manager/src/docker/docker-runtime.service.ts` | Added `searchFilesInContainer(sessionId, query)` — validates query, runs a fixed `find` + `grep -Fni -e "$QUERY"` pipeline via Docker exec with `QUERY` as an env var, parses results, applies caps and exclusions in TypeScript |
| `services/container-manager/src/sessions/sessions.service.ts` | Added `searchFilesInContainer(sessionId, query)` — applies same governance checks as read/write/delete (termination → lifetime → idle → quota), delegates to docker runtime, updates last activity |
| `services/container-manager/src/sessions/internal-sessions.controller.ts` | Added `POST :id/files/search` route guarded by `InternalServiceAuthGuard`, reads `@Body('query')`, validates presence, delegates to `sessionsService.searchFilesInContainer` |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Changed `searchSessionFiles()` target URL from `/api/files/${sessionId}/search` to `/api/internal/sessions/${sessionId}/files/search`, matching read/write/list/delete architecture |
| `services/container-manager/src/docker/docker-runtime.service.spec.ts` | Restructured existing delete tests into a `describe` block; added 4 focused tests for `searchFilesInContainer`: grep output parsed to results, no-match returns empty, empty query rejected, too-long query rejected |
| `services/container-manager/src/sessions/internal-sessions.controller.spec.ts` | Renamed describe block; added 2 focused tests for `POST :id/files/search`: delegates with id and query, missing query → BadRequestException |
| `services/api-gateway/src/clients/container-manager-http.client.spec.ts` | Updated existing `searchSessionFiles` test to assert new URL `/api/internal/sessions/session-123/files/search` |

### Not Changed

| File | Reason |
|---|---|
| `services/container-manager/src/files/files.controller.ts` | Existing FilesController search route left in place; no longer called by API gateway client |
| `services/container-manager/src/files/files.service.ts` | Existing host-fs search logic left in place; no longer in the AI search path |
| All frontend files | Out of scope — backend-only slice |
| All ai-service files | Out of scope |
| API gateway user-facing search route (`session.controller.ts`) | Out of scope — public route unchanged |
| File-action parser/schema | Out of scope |
| Delete behavior | Out of scope |
| Schema/migration | Out of scope |
| Broad file API architecture | Out of scope |
| Semantic/vector search | Out of scope |
| Unrelated code | Out of scope |

---

## Implementation Summary

### Full Search Path After Hotfix

```
Frontend searchWorkspaceFiles(...)
  → POST /api/sessions/{id}/files/search         (api-gateway session.controller — unchanged)
  → ContainerManagerHttpClient.searchSessionFiles()
  → POST /api/internal/sessions/${sessionId}/files/search   ← CHANGED (was /api/files/{id}/search)
  → InternalSessionsController.searchFiles()                ← NEW
  → SessionsService.searchFilesInContainer()                ← NEW
  → DockerRuntimeService.searchFilesInContainer()           ← NEW
  → Docker exec ['sh', '-c', '<fixed-script>'] env QUERY=…
  → /workspace inside active sandbox container
```

This now matches the same architecture used by read, write, list, and delete.

### `DockerRuntimeService.searchFilesInContainer`

- Validates query first: required string, no control chars, trimmed non-empty, ≤120 chars.
- Constructs a fixed shell script that:
  - Runs `find /workspace` with `! -name` exclusions for all unsafe file patterns and `-prune` for excluded directories.
  - Iterates files up to the `WORKSPACE_SEARCH_MAX_FILES_SCANNED = 200` cap; emits `__AI_WS_SEARCH_TRUNCATED__` sentinel if capped.
  - Passes each file to `grep -Fni -e "$QUERY" "$file"` where `QUERY` is an env var — not shell-interpolated.
  - Fixed-string mode (`-F`) prevents the query from being treated as a regex.
- Parses grep output line by line: splits on first two colons to get `path`, `line`, `preview`.
- Strips `/workspace/` prefix from paths.
- Applies TypeScript-side caps (`WORKSPACE_SEARCH_MAX_MATCHES = 20`, `WORKSPACE_SEARCH_MAX_PREVIEW_CHARS = 240`, `WORKSPACE_SEARCH_MAX_TOTAL_RESPONSE_CHARS = 8000`) and secondary path exclusion filter.
- Non-zero exit code with empty stdout → returns `{ query, results: [], truncated: false }` rather than throwing.

### `SessionsService.searchFilesInContainer`

Same governance check order as `readFileFromContainer` / `writeFileToContainer` / `deleteFileFromContainer`:
1. `assertSessionUsableOrThrow` (termination)
2. `checkAndEnforceMaxLifetime`
3. `checkAndEnforceIdleTimeout`
4. `checkAndEnforceQuota`
5. Delegate to `dockerRuntimeService.searchFilesInContainer`
6. `updateLastActivity`

### `InternalSessionsController POST :id/files/search`

Accepts `@Body('query')`, validates presence, returns 200 with `WorkspaceSearchResults`. Same `InternalServiceAuthGuard` as all other internal routes.

### `ContainerManagerHttpClient.searchSessionFiles`

Changed from:
```
POST /api/files/${sessionId}/search
```
to:
```
POST /api/internal/sessions/${sessionId}/files/search
```
Body and headers unchanged: `{ query }` body, `X-Internal-Service-Key` header.

---

## Safety / Bounded Behavior

| Invariant | How Enforced |
|---|---|
| No arbitrary shell execution from model/user | Command is a fixed script; no user/model input interpolated |
| Query not shell-interpolated | `QUERY` passed as exec env var; script references `$QUERY` inside env context only |
| Fixed-string grep | `grep -Fni` — query never treated as regex |
| Scoped to `/workspace` | `find` starts at `/workspace`; path stripping confirms relative paths |
| Max files scanned | Counter in shell script; emits truncated sentinel at 200 |
| Max results / preview / total chars | TypeScript-side caps applied after parsing |
| Excluded dirs | `find` `-prune` for `.git`, `node_modules`, `dist`, `build`, `.next`, `coverage`, `vendor`, `generated`, `.turbo`, `.cache` |
| Excluded files | `find` `! -name` for all env/secret/lock/binary/asset patterns; TypeScript secondary filter on parsed paths |
| Invalid/empty/too-long query | `normalizeWorkspaceSearchQuery()` throws `BadRequestException` before exec |

---

## Tests Added / Updated

| File | Tests |
|---|---|
| `docker-runtime.service.spec.ts` | 4 new tests: grep output parsed to structured results + truncated flag; non-zero exit + empty stdout → empty results; empty query → BadRequestException before exec; 121-char query → BadRequestException before exec |
| `internal-sessions.controller.spec.ts` | 2 new tests: route delegates with session id and query; missing query → BadRequestException |
| `container-manager-http.client.spec.ts` | 1 updated test: asserts new internal sessions URL |

Pre-existing delete tests preserved and still passing (restructured into a `describe` block).

---

## Validation

Docker/PostgreSQL were not required for compile/unit validations.

From `C:\Users\knlee\aiSandBox2026B\services\container-manager`:

| Check | Result |
|---|---|
| `npm run build` | Passed — clean TypeScript build |
| `npx jest "src/docker/docker-runtime.service.spec.ts" "src/sessions/internal-sessions.controller.spec.ts" --runInBand` | Passed — 11/11 tests |

From `C:\Users\knlee\aiSandBox2026B\services\api-gateway`:

| Check | Result |
|---|---|
| `npm run build` | Passed — clean TypeScript build |
| `npx jest "src/clients/container-manager-http.client.spec.ts" --runInBand` | Passed — 2/2 tests |

`ReadLints` on all touched files: no linter errors.

---

## Scope Confirmation

| Area | Changed? |
|---|---|
| Backend routing (container-manager + API gateway client) | Yes |
| Frontend | No |
| AI service prompt/context | No |
| File-action parser | No |
| Delete behavior | No |
| Schema/migration | No |
| Public API routes | No |
| Broad file API architecture | No |
| Semantic/vector search | No |
| Unrelated code | No |

---

## Preserved Invariants

- Workspace path validation unchanged; `validateWorkspacePath` still blocks traversal and absolute paths for all other file operations.
- Governance checks (termination, lifetime, idle, quota) are applied identically to read/write/delete.
- `FilesController` search route and `FilesService.searchFiles()` remain in place but are no longer in the AI search path.
- Frontend `searchWorkspaceFiles(...)` call and public API gateway route (`POST /api/sessions/:id/files/search`) are completely unchanged.
- AI service prompt/context, `workspaceContext.searchResults` format, and worker prompt formatting are completely unchanged.
- All AI-WS-06 safety caps and exclusions are preserved.
- Existing read/write/list/delete behavior is completely unchanged.
