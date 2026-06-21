# AGENT-HARNESS-03A Checkpoint — Read-File and List-Files Tools

**Task ID:** AGENT-HARNESS-03A
**Title:** Read-File and List-Files Tools
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-21

---

## Problem

Agent Harness had adapter tool-use support (02A), a double-gated Worker multi-turn loop (02B), and a ToolDispatcher foundation with loop result-feeding wiring (02C). All tool registrations remained at `enabled: false` / `implementationStatus: 'contract-only'`. No real tool handlers existed. The dispatcher, when wired, would return `TOOL_NOT_FOUND` for every tool call.

The next step was to implement the first concrete read-only tools: `read_file` and `list_files`. A pre-implementation review confirmed that ai-service must not access the container filesystem directly. The established architecture boundary requires: **ai-service → API Gateway internal endpoint → container-manager → workspace**. No direct ai-service → container-manager calls are permitted for file operations.

---

## Objective

Implement the first real read-only Agent Harness tool handlers (`read_file` and `list_files`), add the necessary API Gateway internal endpoint layer, extend the ai-service `ApiGatewayHttpClient`, wire the handlers into the existing `ToolDispatcher` inside the double-gated harness branch, and update the tool registry to reflect implemented status — all without implementing write/delete tools, modifying the single-shot path, or touching frontend/UI/package/database files.

---

## Implementation Summary

Added internal API Gateway endpoints for workspace file reading and directory listing. Added corresponding client methods in the ai-service `ApiGatewayHttpClient`. Implemented file tool handler factories (`createReadFileHandler`, `createListFilesHandler`) with path validation, traversal rejection, content truncation, and bounded listing. Registered `read_file` and `list_files` handlers on `ToolDispatcher` inside the existing double-gated harness branch only. Updated tool registry `implementationStatus` and `enabled` flags for these two tools. All other tools remain disabled and unimplemented.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | New — internal workspace file controller; `GET /api/internal/workspace/:sessionId/read` and `GET /api/internal/workspace/:sessionId/list`; delegates to `ContainerManagerHttpClient.readSessionFile` and `.listSessionDirectory`; guards with `InternalServiceGuard` |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.spec.ts` | New — 6 focused tests for both endpoints |
| `services/api-gateway/src/sessions/session.module.ts` | Updated — registered `InternalWorkspaceFilesController` |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | Updated — added `readWorkspaceFile(sessionId, path)` and `listWorkspaceDirectory(sessionId, path)` methods |
| `services/ai-service/src/clients/api-gateway-http.client.spec.ts` | Updated — added 5 focused tests for the two new client methods |
| `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.ts` | New — `createReadFileHandler` and `createListFilesHandler` factories; shared `validateAndNormalizePath` utility; path traversal rejection; content truncation at `maxFileReadBytes`; bounded listing |
| `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.spec.ts` | New — 21 focused tests covering both handler factories |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | Updated — `read_file` and `list_files` entries changed to `enabled: true`, `implementationStatus: 'implemented'`, `tags: ['workspace', 'read-only']` |
| `services/ai-service/src/agent-harness/tools/tool-registry.spec.ts` | Updated — grew to 12 total tests; added tests confirming `read_file` and `list_files` enabled/implemented, all others disabled |
| `services/ai-service/src/worker/worker.processor.ts` | Updated — registers `read_file` and `list_files` handlers on `ToolDispatcher` inside the double-gated harness branch only |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Updated — grew to 32 total tests; new tests confirm handler registration, gate preservation, and single-shot path preservation |
| `services/ai-service/src/worker/worker.module.ts` | Updated — registered `ApiGatewayHttpClient` as a provider in WorkerModule |

---

## Tests Added / Updated

### `internal-workspace-files.controller.spec.ts` — 6 tests (new file)

| # | Test |
|---|------|
| 1 | Returns 200 with file content for valid read request |
| 2 | Returns 404 when container-manager returns file-not-found |
| 3 | Rejects requests missing internal service key |
| 4 | Returns 200 with directory listing for valid list request |
| 5 | Returns 404 when container-manager returns directory-not-found |
| 6 | Passes sessionId and path correctly to container-manager client |

### `api-gateway-http.client.spec.ts` — 5 new tests (added to existing spec)

| # | Test |
|---|------|
| 1 | `readWorkspaceFile` calls correct API Gateway internal endpoint |
| 2 | `readWorkspaceFile` returns file content string on success |
| 3 | `readWorkspaceFile` throws on non-200 response |
| 4 | `listWorkspaceDirectory` calls correct API Gateway internal endpoint |
| 5 | `listWorkspaceDirectory` returns file listing array on success |

### `file-tool-handlers.spec.ts` — 21 tests (new file)

| # | Test |
|---|------|
| 1–10 | `createReadFileHandler` — valid path, traversal rejection (multiple patterns), missing file, truncation at maxFileReadBytes, session-scoping, null byte rejection, absolute path rejection |
| 11–21 | `createListFilesHandler` — valid path, traversal rejection, default root path, missing directory, bounded listing, session-scoping, empty directory |

### `tool-registry.spec.ts` — 12 total tests (updated)

| # | Test |
|---|------|
| 1–5 | Prior registry tests preserved |
| 6 | `read_file` is enabled and implementationStatus is 'implemented' |
| 7 | `list_files` is enabled and implementationStatus is 'implemented' |
| 8 | `write_file` is disabled and implementationStatus is not 'implemented' |
| 9 | `delete_file` is disabled and implementationStatus is not 'implemented' |
| 10 | `run_validation` is disabled |
| 11 | `browser_smoke` is disabled |
| 12 | `search_workspace` is disabled |

### `worker.processor.spec.ts` — 32 total tests (updated from 30)

| # | Test |
|---|------|
| 1–30 | All 30 prior AGENT-HARNESS-02C/earlier tests preserved and passing |
| 31 | WorkerProcessor registers `read_file` and `list_files` handlers inside v1/enableToolLoop=true branch |
| 32 | WorkerProcessor does not register write/delete handlers |

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --no-cache src/sessions/internal-workspace-files.controller.spec.ts` | **PASS — 6 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/clients/api-gateway-http.client.spec.ts` | **PASS — 5 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/handlers/file-tool-handlers.spec.ts` | **PASS — 21 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/tool-registry.spec.ts` | **PASS — 12 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/worker/worker.processor.spec.ts` | **PASS — 32 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/tool-dispatcher.spec.ts src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | **PASS — 28 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS — tsc clean** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build` | **PASS — tsc clean** |
| ReadLints on all touched source files | **PASS — no linter errors** |

**Total focused validation: 104 tests across 7 spec files, both service builds clean.**

---

## API Gateway Internal Endpoint Behavior

Two new endpoints added to `InternalWorkspaceFilesController`:

### `GET /api/internal/workspace/:sessionId/read?path=...`

- Protected by `InternalServiceGuard` (requires `X-Internal-Service-Key` header).
- Accepts `sessionId` (path param) and `path` (query param, required).
- Delegates to `ContainerManagerHttpClient.readSessionFile(sessionId, path)`.
- Returns file content as a string on success.
- Returns 404 when container-manager reports file-not-found.
- Returns 500 on unexpected container-manager errors.
- No authentication to frontend session required — this is a service-to-service internal boundary.

### `GET /api/internal/workspace/:sessionId/list?path=...`

- Protected by `InternalServiceGuard` (same pattern).
- Accepts `sessionId` (path param) and `path` (query param, defaults to workspace root if absent).
- Delegates to `ContainerManagerHttpClient.listSessionDirectory(sessionId, path)`.
- Returns a structured file listing array on success.
- Returns 404 when container-manager reports directory-not-found.
- Returns 500 on unexpected container-manager errors.

Both endpoints are registered in `session.module.ts` and use the existing internal-service authentication pattern. They are not exposed to the frontend or external users.

---

## ai-service ApiGatewayHttpClient Behavior

Two new methods added to `ApiGatewayHttpClient`:

### `readWorkspaceFile(sessionId: string, path: string): Promise<string>`

- Calls `GET /api/internal/workspace/:sessionId/read?path=...` on the API Gateway internal service.
- Sends `X-Internal-Service-Key` header using the existing internal service key pattern.
- Returns file content string on success.
- Throws a typed error on non-200 responses.
- No direct filesystem or container-manager access — all calls go through API Gateway.

### `listWorkspaceDirectory(sessionId: string, path: string): Promise<string[]>`

- Calls `GET /api/internal/workspace/:sessionId/list?path=...` on the API Gateway internal service.
- Sends `X-Internal-Service-Key` header using the existing pattern.
- Returns a string array of file/directory names on success (directories have trailing `/`).
- Throws a typed error on non-200 responses.
- No direct filesystem or container-manager access.

---

## `read_file` Handler Behavior

`createReadFileHandler(client: ApiGatewayHttpClient, sessionId: string, maxFileReadBytes: number)` returns a `ToolHandler`:

- Validates the `path` argument is present and is a string.
- Calls shared `validateAndNormalizePath(path)`:
  - Rejects `..` traversal sequences.
  - Rejects absolute paths (paths starting with `/` or containing drive letters).
  - Rejects null bytes.
  - Normalizes separators.
- Calls `client.readWorkspaceFile(sessionId, normalizedPath)`.
- If the file does not exist: returns `success: false` with error code `FILE_NOT_FOUND` and a safe message.
- If content length exceeds `maxFileReadBytes`: truncates content and sets `truncated: true` in the result data.
- Returns `success: true` with `{ content, truncated, path }` on success.
- Errors are typed and safe for model feedback — no internal stack traces exposed.

---

## `list_files` Handler Behavior

`createListFilesHandler(client: ApiGatewayHttpClient, sessionId: string)` returns a `ToolHandler`:

- Accepts optional `path` argument; defaults to workspace root (`'.'`) if absent or empty.
- Calls shared `validateAndNormalizePath(path)` (same validation as `read_file`).
- Calls `client.listWorkspaceDirectory(sessionId, normalizedPath)`.
- If the directory does not exist: returns `success: false` with error code `DIRECTORY_NOT_FOUND` and a safe message.
- Returns `success: true` with `{ files: string[], path }` on success.
  - Directory entries are suffixed with `/` to distinguish from files.
- Errors are typed and safe for model feedback.

---

## ToolDispatcher Registration Behavior (WorkerProcessor)

`WorkerProcessor` registers `read_file` and `list_files` handlers on the constructed `ToolDispatcher` inside the double-gated harness branch only:

```
if (job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop === true) {
  const dispatcher = new ToolDispatcher();
  dispatcher.registerHandler('read_file', createReadFileHandler(this.apiGatewayHttpClient, sessionId, maxFileReadBytes));
  dispatcher.registerHandler('list_files', createListFilesHandler(this.apiGatewayHttpClient, sessionId));
  // pass dispatcher to executeAgentHarnessLoop
}
```

- Only `read_file` and `list_files` are registered. No write, delete, validation, browser, or search handlers are registered.
- `write_file` and `delete_file` are NOT registered and will return `TOOL_NOT_FOUND` if called.
- `enableToolLoop` remains `false` by default — no current jobs enter the harness path.
- The `harnessVersion === 'v1'` gate remains effective.
- The single-shot path (`this.aiExecutionService.execute()`) remains completely unchanged.

---

## Tool Registry Changes

Only `read_file` and `list_files` were changed:

| Tool | Previous | After |
|------|----------|-------|
| `read_file` | `enabled: false`, `implementationStatus: 'contract-only'` | `enabled: true`, `implementationStatus: 'implemented'`, `tags: ['workspace', 'read-only']` |
| `list_files` | `enabled: false`, `implementationStatus: 'contract-only'` | `enabled: true`, `implementationStatus: 'implemented'`, `tags: ['workspace', 'read-only']` |
| `write_file` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |
| `delete_file` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |
| `run_validation` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |
| `browser_smoke` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |
| `search_workspace` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |

---

## Architecture Boundary Confirmation

ai-service accesses workspace files exclusively through the API Gateway internal boundary:

```
ai-service WorkerProcessor
  → ToolDispatcher.dispatch('read_file' | 'list_files', toolCall)
    → createReadFileHandler / createListFilesHandler
      → ApiGatewayHttpClient.readWorkspaceFile / .listWorkspaceDirectory
        → API Gateway: GET /api/internal/workspace/:sessionId/read|list
          → ContainerManagerHttpClient.readSessionFile / .listSessionDirectory
            → container-manager → DockerRuntimeService → /workspace
```

No ai-service → container-manager direct call exists. No ai-service direct filesystem access exists.

---

## Security Invariants Confirmed

- **No direct filesystem access from ai-service.** All file reads go through API Gateway → container-manager.
- **No direct ai-service → container-manager file calls.** The API Gateway internal endpoint is the only boundary.
- **No `write_file` implementation.** Handler not created, not registered.
- **No `delete_file` implementation.** Handler not created, not registered.
- **No validation runner.** `run_validation` not implemented or registered.
- **No browser automation.** `browser_smoke` not implemented or registered.
- **No shell execution.** No shell commands added anywhere.
- **No frontend/UI changes.** No frontend files touched.
- **No package/dependency changes.** No new npm packages introduced.
- **No database schema changes.**
- **No checkpoint/revert flow changes.** Existing checkpoint behavior untouched.
- **No SSE event changes.** Existing SSE publisher untouched.
- **Existing single-shot path preserved.** `aiExecutionService.execute()` path unchanged.
- **`enableToolLoop` default `false` remains effective.** No current jobs enter the harness path.
- **`harnessVersion === 'v1'` gate remains effective.** Both gates must be true.
- **Path traversal rejected.** `..`, absolute paths, and null bytes all rejected in `validateAndNormalizePath`.
- **Read output bounded.** Content truncated at `maxFileReadBytes` with `truncated: true` flag.
- **All other tools remain disabled/unregistered.** Registry flags and handler registration confirm this.

---

## Invariant: No Checkpoint Before Consolidation

No checkpoint was created before this consolidation step. Implementation was completed and validated first. This document is the first and only checkpoint for AGENT-HARNESS-03A, created in the consolidation step per governance rules.

---

## Dependency Chain

| Predecessor | Status |
|-------------|--------|
| AGENT-HARNESS-00 | COMPLETE and LOCKED |
| AGENT-HARNESS-01A | COMPLETE and LOCKED |
| AGENT-HARNESS-01B | COMPLETE and LOCKED |
| AGENT-HARNESS-01C | COMPLETE and LOCKED |
| AGENT-HARNESS-01D | COMPLETE and LOCKED |
| AGENT-HARNESS-01E | COMPLETE and LOCKED |
| AGENT-HARNESS-02A | COMPLETE and LOCKED |
| AGENT-HARNESS-02B | COMPLETE and LOCKED |
| AGENT-HARNESS-02C | COMPLETE and LOCKED |
| **AGENT-HARNESS-03A** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

**AGENT-HARNESS-03B — Write-File and Delete-File Tools**

Per the master plan (section 13.1) and the AGENT-HARNESS-03B roadmap entry:

- Define `write_file` and `delete_file` tool contracts.
- Implement handlers using the existing file CRUD pipeline (API Gateway → container-manager → DockerRuntimeService).
- Enforce policy limits: max write bytes, blocked file patterns, risky file approval.
- Integrate with existing risky-batch confirmation flow.
- Publish file-action events via SSE for frontend coherence.

Before implementing AGENT-HARNESS-03B:

1. **Register** AGENT-HARNESS-03B in TASKS.md and TASKS_BACKLOG_FULL.md first.
2. Confirm the write tool security review scope.
3. Confirm pre-apply checkpoint and approval flow integration points.

Per CLAUDE.md governance: **register first in a separate step, then implement.**

---

## Document Metadata

- **Created:** 2026-06-21
- **Task:** AGENT-HARNESS-03A
- **Status:** COMPLETE and LOCKED
- **Author:** AI-assisted consolidation pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AGENT-HARNESS-V1-MASTER-PLAN.md
