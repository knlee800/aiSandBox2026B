# AGENT-HARNESS-03B Checkpoint — Write-File and Delete-File Tools

**Task ID:** AGENT-HARNESS-03B
**Title:** Write-File and Delete-File Tools
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-22

---

## Architecture / Security Review Summary

A dedicated architecture and security review was completed before implementation began. The review confirmed:

1. **Architecture boundary safe to proceed without a pre-mutation checkpoint prerequisite.** The harness path is double-gated (`harnessVersion === 'v1'` AND `enableToolLoop === true`; default `false`). No current production jobs enter the harness path. Pre-apply checkpointing is deferred to AGENT-HARNESS-03C as planned, without blocking the write/delete tool implementation.
2. **Service boundary confirmed correct.** ai-service → API Gateway internal endpoint → container-manager → workspace. No direct ai-service → container-manager mutation call is permitted.
3. **SSE file-action events scoped to future work.** Publishing SSE events for harness-initiated writes/deletes was reviewed and deferred; the existing SSE publisher is not changed in this slice.
4. **Content size limits and delete-target restrictions confirmed sufficient safety controls** for the current slice without an approval UI, given the double gate preventing any production job from reaching the harness path.
5. **Path traversal, root/broad delete targets, write content bounds confirmed as required.** These are enforced inside the handler factories, not delegated to downstream services.
6. **No new container-manager endpoints required.** The existing `ContainerManagerHttpClient` already exposed write and delete operations; the API Gateway internal layer adds the `InternalServiceGuard`-protected proxy endpoints for ai-service use.
7. **`requiresApproval: true`** confirmed in both `write_file` and `delete_file` tool registry entries. `riskLevel: 'high'`/`'destructive'` preserved.

---

## Problem

AGENT-HARNESS-03A implemented the first real read-only Agent Harness tools (`read_file` and `list_files`) through the established architecture boundary: ai-service → API Gateway internal endpoint → container-manager → workspace. The tool registry entries for `write_file` and `delete_file` remained at `enabled: false` / `implementationStatus: 'planned'`. No mutation handlers existed. The dispatcher would return `TOOL_NOT_FOUND` for any write or delete tool call.

The next master-plan step (section 13.1) required implementing `write_file` and `delete_file` tools with correct safe contracts: path validation, traversal rejection, content size bounds, root/broad delete rejection, and routing through the same API Gateway internal boundary used for read operations.

---

## Objective

Implement mutating Agent Harness tool handlers (`write_file` and `delete_file`) through the registered architecture boundary. Add the necessary API Gateway internal write/delete endpoints. Extend the ai-service `ApiGatewayHttpClient` with write and delete methods. Wire the new handlers into the existing `ToolDispatcher` inside the double-gated harness branch. Update the tool registry to reflect implemented status for these two tools only — without implementing validation/browser/search/preview tools, without modifying the single-shot path, and without touching frontend/UI/package/database files.

---

## Implementation Summary

Added internal API Gateway endpoints for workspace file writing and deletion. Added corresponding client methods in the ai-service `ApiGatewayHttpClient`. Implemented file tool handler factories (`createWriteFileHandler`, `createDeleteFileHandler`) with path validation, traversal rejection, content size bounding, and root/broad/directory/glob delete rejection. Registered `write_file` and `delete_file` handlers on `ToolDispatcher` inside the existing double-gated harness branch only. Updated tool registry `implementationStatus` and `enabled` flags for these two tools. All other tools (`run_validation`, `browser_smoke`, `start_preview`, `search_workspace`) remain disabled and unimplemented.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | Updated — added `POST /api/internal/workspace/:sessionId/write` and `DELETE /api/internal/workspace/:sessionId/delete` endpoints; guarded with `InternalServiceGuard`; delegates to existing `ContainerManagerHttpClient` write/delete methods |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.spec.ts` | Updated — grew from 6 to 15 tests; added 9 new tests for write and delete endpoints |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | Updated — added `writeWorkspaceFile(sessionId, path, content)` and `deleteWorkspaceFile(sessionId, path)` methods |
| `services/ai-service/src/clients/api-gateway-http.client.spec.ts` | Updated — grew from 5 to 9 tests; added 4 new tests for the two new client methods |
| `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.ts` | Updated — added `createWriteFileHandler` and `createDeleteFileHandler` factories; all security validations inline |
| `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.spec.ts` | Updated — grew from 21 to 38 tests; added 17 new tests for write and delete handler factories |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | Updated — `write_file` and `delete_file` entries changed to `enabled: true`, `implementationStatus: 'implemented'`, `tags` updated |
| `services/ai-service/src/agent-harness/tools/tool-registry.spec.ts` | Updated — grew from 12 to 13 tests; added confirmation that `write_file` and `delete_file` are now enabled/implemented |
| `services/ai-service/src/worker/worker.processor.ts` | Updated — registers `write_file` and `delete_file` handlers on `ToolDispatcher` inside the double-gated harness branch alongside `read_file` and `list_files` |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Updated — grew from 32 to 32 tests (existing tests cover the expanded handler registration; write/delete registration confirmed by existing harness-branch registration tests) |

**Total files changed: 10** (5 source files, 5 test files). No frontend, no package, no database, no Docker files changed.

---

## Tests Added / Updated

### `internal-workspace-files.controller.spec.ts` — 15 total tests (grew from 6)

| # | Test |
|---|------|
| 1–6 | All 6 prior AGENT-HARNESS-03A tests preserved and passing |
| 7 | Returns 200 on successful write |
| 8 | Returns 400 when path is missing from write request |
| 9 | Returns 400 when content is missing from write request |
| 10 | Returns 404 when container-manager reports file-not-found during write |
| 11 | Returns 500 on unexpected container-manager write error |
| 12 | Returns 200 on successful delete |
| 13 | Returns 400 when path is missing from delete request |
| 14 | Returns 404 when container-manager reports file-not-found during delete |
| 15 | Returns 500 on unexpected container-manager delete error |

### `api-gateway-http.client.spec.ts` — 9 total tests (grew from 5)

| # | Test |
|---|------|
| 1–5 | All 5 prior AGENT-HARNESS-03A tests preserved and passing |
| 6 | `writeWorkspaceFile` calls correct API Gateway internal write endpoint |
| 7 | `writeWorkspaceFile` returns success on 200 response |
| 8 | `deleteWorkspaceFile` calls correct API Gateway internal delete endpoint |
| 9 | `deleteWorkspaceFile` returns success on 200 response |

### `file-tool-handlers.spec.ts` — 38 total tests (grew from 21)

| # | Test |
|---|------|
| 1–21 | All 21 prior AGENT-HARNESS-03A tests preserved and passing |
| 22–30 | `createWriteFileHandler` — valid write, traversal rejection (multiple patterns), missing path, content not a string, content exceeds `maxFileWriteBytes`, null byte in path, absolute path, upstream error safe response, session-scoping |
| 31–38 | `createDeleteFileHandler` — valid delete, traversal rejection, root target rejected, workspace-root target rejected, glob-like path rejected, directory-looking path rejected, null byte in path, upstream error safe response |

### `tool-registry.spec.ts` — 13 total tests (grew from 12)

| # | Test |
|---|------|
| 1–12 | All 12 prior AGENT-HARNESS-03A tests preserved and passing |
| 13 | `write_file` is enabled and `implementationStatus` is `'implemented'`; `delete_file` is enabled and `implementationStatus` is `'implemented'` |

### `worker.processor.spec.ts` — 32 total tests (unchanged count; registration coverage updated)

| # | Test |
|---|------|
| 1–32 | All 32 prior AGENT-HARNESS-03A tests preserved and passing; harness-branch tests now confirm registration of `read_file`, `list_files`, `write_file`, and `delete_file` |

### `tool-dispatcher.spec.ts` + `agent-harness-loop.spec.ts` — 28 total tests (unchanged)

All 28 prior dispatcher and loop tests preserved and passing.

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --no-cache src/sessions/internal-workspace-files.controller.spec.ts` | **PASS — 15 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/clients/api-gateway-http.client.spec.ts` | **PASS — 9 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/handlers/file-tool-handlers.spec.ts` | **PASS — 38 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/tool-registry.spec.ts` | **PASS — 13 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/worker/worker.processor.spec.ts` | **PASS — 32 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/tool-dispatcher.spec.ts src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | **PASS — 28 tests** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS — tsc clean** |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build` | **PASS — tsc clean** |
| ReadLints on all 10 touched source/test files | **PASS — no linter errors** |

**Total focused validation: 135 tests across 8 spec files, both service builds clean.**

---

## API Gateway Internal Write Endpoint Behavior

### `POST /api/internal/workspace/:sessionId/write`

- Protected by `InternalServiceGuard` (requires `X-Internal-Service-Key` header).
- Accepts `sessionId` (path param), `path` (body field, required), and `content` (body field, required string).
- Validates that `path` and `content` are present; returns 400 if missing.
- Delegates to the existing `ContainerManagerHttpClient` write method for the session workspace.
- Returns 200 with `{ ok: true, path, bytesWritten }` on success.
- Returns 404 when container-manager reports file-not-found / directory-not-found.
- Returns 500 on unexpected container-manager errors.
- Not exposed to the frontend or external users.

### `DELETE /api/internal/workspace/:sessionId/delete`

- Protected by `InternalServiceGuard` (same pattern).
- Accepts `sessionId` (path param) and `path` (body or query, required).
- Validates that `path` is present; returns 400 if missing.
- Delegates to the existing `ContainerManagerHttpClient` delete method for the session workspace.
- Returns 200 with `{ ok: true, path }` on success.
- Returns 404 when container-manager reports file-not-found.
- Returns 500 on unexpected container-manager errors.
- Not exposed to the frontend or external users.

Both endpoints are added to the existing `InternalWorkspaceFilesController` registered in `session.module.ts`, using the same internal-service authentication pattern as the read/list endpoints from AGENT-HARNESS-03A.

---

## ai-service ApiGatewayHttpClient Write / Delete Behavior

### `writeWorkspaceFile(sessionId: string, path: string, content: string): Promise<{ ok: boolean; path: string; bytesWritten: number }>`

- Calls `POST /api/internal/workspace/:sessionId/write` on the API Gateway internal service.
- Sends `X-Internal-Service-Key` header using the existing internal service key pattern.
- Sends `{ path, content }` as JSON body.
- Returns `{ ok, path, bytesWritten }` on success.
- Throws a typed error on non-200 responses.
- No direct filesystem or container-manager access — all calls go through API Gateway.

### `deleteWorkspaceFile(sessionId: string, path: string): Promise<{ ok: boolean; path: string }>`

- Calls `DELETE /api/internal/workspace/:sessionId/delete` on the API Gateway internal service.
- Sends `X-Internal-Service-Key` header using the existing pattern.
- Sends `{ path }` as JSON body.
- Returns `{ ok, path }` on success.
- Throws a typed error on non-200 responses.
- No direct filesystem or container-manager access.

---

## `write_file` Handler Behavior

`createWriteFileHandler(client: ApiGatewayHttpClient, sessionId: string, maxFileWriteBytes: number)` returns a `ToolHandler`:

- Validates the `path` argument is present and is a string.
- Validates the `content` argument is present and is a string.
- Calls shared `validateAndNormalizePath(path)`:
  - Rejects `..` traversal sequences.
  - Rejects absolute paths (paths starting with `/` or containing drive letters).
  - Rejects null bytes.
  - Normalizes separators.
- Enforces `maxFileWriteBytes`: if `Buffer.byteLength(content, 'utf8')` exceeds the limit, returns `success: false` with error code `FILE_TOO_LARGE` and a safe message.
- Calls `client.writeWorkspaceFile(sessionId, normalizedPath, content)`.
- Returns `success: true` with `{ ok: true, path: normalizedPath, bytesWritten }` on success.
- Errors are typed and safe for model feedback — no internal stack traces exposed.

---

## `delete_file` Handler Behavior

`createDeleteFileHandler(client: ApiGatewayHttpClient, sessionId: string)` returns a `ToolHandler`:

- Validates the `path` argument is present and is a string.
- Calls shared `validateAndNormalizePath(path)`:
  - Same traversal, absolute path, and null byte checks as all other file handlers.
- Applies additional delete-specific safety guards:
  - **Rejects root targets:** path resolves to `.`, `/`, empty string, or `workspace` root.
  - **Rejects glob-like paths:** paths containing `*`, `?`, `[`, `]`, or `{` characters.
  - **Rejects directory-looking paths:** paths ending with `/` or `\`.
- Calls `client.deleteWorkspaceFile(sessionId, normalizedPath)`.
- Returns `success: true` with `{ ok: true, path: normalizedPath }` on success.
- Returns `success: false` with error code `FILE_NOT_FOUND` if the file does not exist.
- Errors are typed and safe for model feedback.

---

## ToolDispatcher Registration Behavior (WorkerProcessor)

`WorkerProcessor` now registers all four file handlers on the constructed `ToolDispatcher` inside the double-gated harness branch:

```
if (job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop === true) {
  const dispatcher = new ToolDispatcher();
  dispatcher.registerHandler('read_file',   createReadFileHandler(this.apiGatewayHttpClient, sessionId, maxFileReadBytes));
  dispatcher.registerHandler('list_files',  createListFilesHandler(this.apiGatewayHttpClient, sessionId));
  dispatcher.registerHandler('write_file',  createWriteFileHandler(this.apiGatewayHttpClient, sessionId, maxFileWriteBytes));
  dispatcher.registerHandler('delete_file', createDeleteFileHandler(this.apiGatewayHttpClient, sessionId));
  // pass dispatcher to executeAgentHarnessLoop
}
```

- Exactly four handlers registered: `read_file`, `list_files`, `write_file`, `delete_file`.
- `run_validation`, `browser_smoke`, `start_preview`, and `search_workspace` are NOT registered and will return `TOOL_NOT_FOUND` if called.
- `enableToolLoop` remains `false` by default — no current production jobs enter the harness path.
- The `harnessVersion === 'v1'` gate remains effective.
- The single-shot path (`this.aiExecutionService.execute()`) remains completely unchanged.

---

## Tool Registry Changes

Only `write_file` and `delete_file` were changed:

| Tool | Previous (03A state) | After (03B) |
|------|----------------------|-------------|
| `read_file` | `enabled: true`, `implementationStatus: 'implemented'` | **unchanged** |
| `list_files` | `enabled: true`, `implementationStatus: 'implemented'` | **unchanged** |
| `write_file` | `enabled: false`, `implementationStatus: 'planned'` | `enabled: true`, `implementationStatus: 'implemented'`, `tags: ['workspace', 'write', 'approval-required']`, `requiresApproval: true`, `riskLevel: 'high'` |
| `delete_file` | `enabled: false`, `implementationStatus: 'planned'` | `enabled: true`, `implementationStatus: 'implemented'`, `tags: ['workspace', 'delete', 'approval-required']`, `requiresApproval: true`, `riskLevel: 'destructive'` |
| `run_validation` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |
| `browser_smoke` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |
| `search_workspace` | `enabled: false`, `implementationStatus: 'planned'` | **unchanged** |

---

## Architecture Boundary Confirmation

ai-service accesses workspace files exclusively through the API Gateway internal boundary:

```
ai-service WorkerProcessor
  → ToolDispatcher.dispatch('write_file' | 'delete_file', toolCall)
    → createWriteFileHandler / createDeleteFileHandler
      → ApiGatewayHttpClient.writeWorkspaceFile / .deleteWorkspaceFile
        → API Gateway: POST /api/internal/workspace/:sessionId/write
                     | DELETE /api/internal/workspace/:sessionId/delete
          → ContainerManagerHttpClient.writeSessionFile / .deleteSessionFile
            → container-manager → DockerRuntimeService → /workspace
```

No ai-service → container-manager direct mutation call exists. No ai-service direct filesystem access exists.

---

## Security Invariants Confirmed

- **No direct filesystem access from ai-service.** All file writes and deletes go through API Gateway → container-manager.
- **No direct ai-service → container-manager mutation calls.** The API Gateway internal endpoint is the only mutation boundary.
- **No `run_validation` implementation.** Handler not created, not registered.
- **No `browser_smoke` implementation.** Handler not created, not registered.
- **No `start_preview` implementation.** Handler not created, not registered.
- **No `search_workspace` implementation.** Handler not created, not registered.
- **No shell execution.** No shell commands added anywhere.
- **No frontend/UI changes.** No frontend files touched.
- **No package/dependency changes.** No new npm packages introduced.
- **No database schema changes.**
- **No checkpoint/revert flow changes.** Existing checkpoint behavior untouched in this slice.
- **No SSE event changes.** Existing SSE publisher untouched.
- **Existing single-shot path preserved.** `aiExecutionService.execute()` path unchanged.
- **`enableToolLoop` default `false` remains effective.** No current jobs enter the harness path.
- **`harnessVersion === 'v1'` gate remains effective.** Both gates must be true.
- **Path traversal rejected.** `..`, absolute paths, and null bytes all rejected in `validateAndNormalizePath` (shared with read/list handlers).
- **Write content bounded.** `createWriteFileHandler` enforces `maxFileWriteBytes` using `Buffer.byteLength`.
- **Root/broad/directory/glob delete targets rejected.** `createDeleteFileHandler` rejects `.`, empty, `workspace` root, glob characters, and directory-trailing-slash paths.
- **`requiresApproval: true` preserved.** Both `write_file` and `delete_file` tool registry entries retain `requiresApproval: true`.
- **`riskLevel: 'high'` / `'destructive'` preserved.** Registry risk levels unchanged.
- **Existing `read_file` and `list_files` behavior preserved.** No changes to their handler factories or client methods.
- **Pre-apply checkpointing deferred to AGENT-HARNESS-03C.** Not bypassed — explicitly deferred per architecture/security review findings and master-plan section 13.2.

---

## Invariant: No Checkpoint Before Consolidation

No checkpoint was created before this consolidation step. Implementation was completed and validated first. This document is the first and only checkpoint for AGENT-HARNESS-03B, created in the consolidation step per governance rules.

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
| AGENT-HARNESS-03A | COMPLETE and LOCKED |
| **AGENT-HARNESS-03B** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

**AGENT-HARNESS-03C registration — Pre-Apply Checkpoint / Mutation Rollback Safety**

Per the master plan (section 13.2 and 13.3) and the AGENT-HARNESS-03C roadmap entry:

- Before the first file write in a tool loop, create a git checkpoint via the internal checkpoint API.
- Store checkpoint reference in execution context.
- If any file write fails partway, automatically revert to the pre-apply checkpoint.
- Publish rollback events via SSE.
- Log rollback as audit event.

AGENT-HARNESS-03C is explicitly defined in the master plan (section 13.2–13.3) and the child slice roadmap.

Per CLAUDE.md governance: **register AGENT-HARNESS-03C first in a separate step, then implement.**

Do NOT implement AGENT-HARNESS-03C here.

---

## Document Metadata

- **Created:** 2026-06-22
- **Task:** AGENT-HARNESS-03B
- **Status:** COMPLETE and LOCKED
- **Author:** AI-assisted consolidation pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AGENT-HARNESS-V1-MASTER-PLAN.md
