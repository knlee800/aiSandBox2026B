# AGENT-HARNESS-04A Checkpoint — Validation Runner Tool

**Task ID:** AGENT-HARNESS-04A
**Title:** Validation Runner Tool
**Status:** COMPLETE and LOCKED
**Checkpoint Date:** 2026-06-22

---

## Architecture / Security Review Summary

A dedicated architecture and security review was completed before implementation. Key findings:

- `executor-service` was rejected for `run_validation` — it is publicly exposed and its allow-list is insufficient for Agent Harness use.
- The existing container-manager internal exec API (`POST /api/internal/sessions/:id/exec`) with `InternalServiceAuthGuard` was confirmed as the correct low-level execution primitive.
- The service boundary was confirmed: ai-service → API Gateway internal endpoint → container-manager internal exec → workspace container.
- Allow-list enforcement was placed in the ai-service handler (exact string match before any HTTP call), not in API Gateway.
- Output truncation (`maxValidationOutputBytes`) and timeout forwarding (`validationTimeoutMs`) were confirmed viable via existing config.
- `AgentHarnessValidationResultV1` and `allowedValidationCommands` config keys were confirmed already present, minimizing new contracts.
- One bounded implementation prompt was recommended; no prerequisite slice was required.

---

## Problem / Objective Summary

**Problem:** Agent Harness can read/list/write/delete workspace files with pre-apply checkpoint safety. The next master-plan step requires a validation runner tool so the agent can request bounded validation after making changes. Command execution inside project containers is high risk and requires strict allow-lists, timeouts, output limits, and the existing service boundary.

**Objective:** Implement the `run_validation` Agent Harness tool as a safe, allow-listed validation runner using the established service boundary. Only pre-approved commands may be forwarded. Arbitrary shell execution from ai-service is prohibited.

---

## Implementation Summary

Implemented `run_validation` as a safe, allow-listed Agent Harness tool. The implementation spans 10 files across 2 services (2 in api-gateway, 8 in ai-service). No changes were made to container-manager, executor-service, frontend, package files, or database schema.

Service boundary: `ai-service → API Gateway internal endpoint → container-manager internal exec → workspace container`.

Key behaviors:
- The model sends a `command` string.
- The handler trims and exact-matches the command against `DEFAULT_AGENT_HARNESS_CONFIG_V1.allowedValidationCommands`.
- Disallowed commands are rejected before any HTTP call with a typed `COMMAND_NOT_ALLOWED` error.
- Allowed commands are forwarded (not model-provided text) to `ApiGatewayHttpClient.runWorkspaceValidation`.
- API Gateway proxies to `ContainerManagerHttpClient.execInSession` with `['sh', '-lc', command]`, cwd `/workspace`, and `timeoutMs`.
- Output (`stdout`/`stderr`) is truncated to `maxValidationOutputBytes` before returning to the model.
- Timeout errors surface as `timedOut: true, success: false`.
- `run_validation` is registered only inside the double-gated harness branch (`harnessVersion === 'v1'` and `enableToolLoop === true`).
- `run_validation` is **not** added to `mutatingToolNames`; it does not trigger pre-apply checkpoint.
- `browser_smoke`, `start_preview`, `search_workspace` remain disabled and unregistered.

---

## Exact Implementation Files Changed

**Total: 10 files (2 api-gateway + 8 ai-service)**

**API Gateway (2 files):**
1. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\sessions\internal-workspace-files.controller.ts` — modified: added `POST :sessionId/validate` endpoint
2. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\sessions\internal-workspace-files.controller.spec.ts` — modified: added 5 focused tests for validate endpoint

**ai-service (8 files):**
3. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\clients\api-gateway-http.client.ts` — modified: added `runWorkspaceValidation()` method
4. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\clients\api-gateway-http.client.spec.ts` — modified: added 3 focused tests
5. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\agent-harness\tools\handlers\validation-tool-handlers.ts` — **created**: exports `createRunValidationHandler(deps)`
6. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\agent-harness\tools\handlers\validation-tool-handlers.spec.ts` — **created**: 18 focused tests
7. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\agent-harness\tools\tool-registry.ts` — modified: `run_validation` enabled/implemented, outputSchema expanded
8. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\agent-harness\tools\tool-registry.spec.ts` — modified: updated enabled-tools count (4→5), split disabled-tools test
9. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\worker\worker.processor.ts` — modified: imports `createRunValidationHandler`, registers `run_validation` handler
10. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\worker\worker.processor.spec.ts` — modified: 4 new/updated tests for `run_validation` registration

> **Note:** The implementation summary in the prior report listed "ai-service (7 files)" as a label error. The correct count is 8 ai-service files, 10 files total. No files were missed or added incorrectly.

---

## Exact Tests Added / Updated

### API Gateway — `internal-workspace-files.controller.spec.ts` (5 new tests)
1. Delegates to `ContainerManagerHttpClient.execInSession` with `['sh', '-lc', command]`, cwd `/workspace`, and `timeoutMs`
2. Rejects missing command with `BadRequestException`
3. Rejects empty command with `BadRequestException`
4. Propagates exec result from container-manager client
5. Defaults `timeoutMs` to 120,000ms when not provided

### ai-service — `api-gateway-http.client.spec.ts` (3 new tests)
6. Calls correct validate endpoint with `X-Internal-Service-Key` and `{ command, timeoutMs }`
7. Returns `exitCode`, `stdout`, `stderr` from response
8. Propagates upstream errors

### ai-service — `validation-tool-handlers.spec.ts` (18 new tests)
9. `npm test` returns structured result
10. `npm run build` returns structured result
11. `npx tsc --noEmit` returns structured result
12. `rm -rf /` rejected with `COMMAND_NOT_ALLOWED`
13. `npm install` rejected with `COMMAND_NOT_ALLOWED`
14. `curl` command rejected with `COMMAND_NOT_ALLOWED`
15. Disallowed command does not reach HTTP client
16. Empty command rejected
17. Whitespace-only command rejected
18. Missing command rejected
19. Non-string command rejected
20. Command with extra whitespace matches after trim
21. `stdout` truncation sets `truncated: true`
22. `stderr` truncation sets `truncated: true`
23. Output within limits not truncated (`truncated: false`)
24. Timeout error returns `timedOut: true, success: false`
25. Non-timeout error propagated
26. Forwarded command is the matched allow-list string, not arbitrary model text

### ai-service — `tool-registry.spec.ts` (updated)
27. `run_validation` is enabled and implemented (new test)
28. `browser/preview/search tools` remain disabled (updated from prior test that also checked `run_validation`)
29. Enabled tools count corrected: 4 → 5

### ai-service — `worker.processor.spec.ts` (4 new/updated tests)
30. `run_validation` registered in double-gated harness branch
31. `browser_smoke`, `start_preview`, `search_workspace` not registered (updated)
32. `run_validation` not in `mutatingToolNames`
33. `createRunValidationHandler` imported from `validation-tool-handlers`

---

## Exact Validation Commands and Results

**Correct total: 189 tests across 8 suites (24 + 15 + 18 + 14 + 43 + 75 = 189)**

| Command | Suite / Result | Tests |
|---|---|---|
| `npx jest --no-cache internal-workspace-files.controller.spec.ts` (api-gateway) | PASS | 24 |
| `npx jest --no-cache api-gateway-http.client.spec.ts` (ai-service) | PASS | 15 |
| `npx jest --no-cache validation-tool-handlers.spec.ts` (ai-service) | PASS | 18 |
| `npx jest --no-cache tool-registry.spec.ts` (ai-service) | PASS | 14 |
| `npx jest --no-cache worker.processor.spec.ts` (ai-service) | PASS | 43 |
| `npx jest --no-cache file-tool-handlers.spec.ts tool-dispatcher.spec.ts agent-harness-loop.spec.ts` (regression) | PASS | 75 |
| `npm run build` (api-gateway) | PASS | — |
| `npm run build` (ai-service) | PASS | — |
| ReadLints on all touched source files | PASS (no errors) | — |

**Total tests passed: 189**

---

## API Gateway Validation Endpoint Behavior

`POST /api/internal/workspace/:sessionId/validate`
- Protected by existing `InternalServiceAuthGuard` (`X-Internal-Service-Key`)
- Accepts `{ command: string, timeoutMs?: number }`
- Rejects missing or empty `command` with HTTP 400 `BadRequestException`
- Defaults `timeoutMs` to 120,000ms when not provided or invalid
- Delegates to `ContainerManagerHttpClient.execInSession(sessionId, ['sh', '-lc', command], '/workspace', undefined, effectiveTimeout)`
- Returns `{ exitCode: number, stdout: string, stderr: string }`
- No command allow-list in API Gateway; enforcement is in ai-service before the HTTP call

---

## ai-service Validation Client Behavior

`ApiGatewayHttpClient.runWorkspaceValidation(sessionId, command, timeoutMs)`
- Calls `POST /api/internal/workspace/:sessionId/validate`
- Sends `X-Internal-Service-Key` header using existing internal auth pattern
- Sends body `{ command, timeoutMs }`
- Returns `{ exitCode, stdout, stderr }`
- Propagates upstream errors consistently with existing client methods

---

## run_validation Handler Behavior

`createRunValidationHandler(deps)` — exported from `validation-tool-handlers.ts`

**Dependencies:** `client: ApiGatewayHttpClient`, `sessionId`, `allowedValidationCommands`, `validationTimeoutMs`, `maxValidationOutputBytes`

**Execution flow:**
1. Extracts `args.command` as string; rejects if not a non-empty string
2. Trims the command
3. Exact-matches trimmed command against `allowedValidationCommands`; throws `COMMAND_NOT_ALLOWED` if not found (no HTTP call)
4. Forwards the matched allow-list command string (not model-provided text) to `client.runWorkspaceValidation`
5. Measures `durationMs`
6. Truncates `stdout` and `stderr` to `maxValidationOutputBytes`
7. Returns `AgentHarnessValidationResultV1`-shaped output: `{ command, success, exitCode, stdout, stderr, timedOut, truncated, durationMs }`
8. On timeout errors: returns `timedOut: true, success: false, exitCode: 1` with safe stderr; does not rethrow
9. On other upstream errors: rethrows for upstream handling

---

## ToolDispatcher Registration Behavior

`run_validation` is registered in the `ToolDispatcher` inside the double-gated harness branch only:
- Gate 1: `harnessVersion === 'v1'`
- Gate 2: `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop === true`

Registration is alongside existing file tools (read_file, list_files, write_file, delete_file). `browser_smoke`, `start_preview`, and `search_workspace` are not registered.

---

## Tool Registry Changes

Changes to `run_validation` entry only:

| Field | Before | After |
|---|---|---|
| `enabled` | `false` | `true` |
| `implementationStatus` | `'contract-only'` | `'implemented'` |
| `tags` | `['planned', 'metadata-only', 'validation', 'allow-list-only']` | `['validation', 'allow-list-only', 'read-only']` |
| `outputSchema.properties` | `success`, `exitCode` | `command`, `success`, `exitCode`, `stdout`, `stderr`, `timedOut`, `truncated`, `durationMs` |
| `riskLevel` | `'medium'` | `'medium'` (unchanged) |
| `requiresApproval` | `false` | `false` (unchanged) |

`browser_smoke`, `start_preview`, `search_workspace` remain `enabled: false`, `implementationStatus` not `'implemented'`.

---

## Security Invariants Confirmed

- **Exact allow-list enforcement:** Only `'npm test'`, `'npm run build'`, `'npx tsc --noEmit'` are accepted. Trimming applied before match.
- **Arbitrary/disallowed commands rejected before HTTP call:** Handler throws `COMMAND_NOT_ALLOWED` before calling `runWorkspaceValidation`. Verified by test.
- **No arbitrary shell from ai-service:** Model text is never interpolated into shell. Only the matched config string is forwarded.
- **No direct ai-service → container-manager calls:** All validation flows through `ApiGatewayHttpClient` → API Gateway → `ContainerManagerHttpClient`.
- **No executor-service involvement:** executor-service files untouched.
- **No container-manager source changes:** container-manager files untouched; existing internal exec API reused.
- **No frontend/UI changes.**
- **No package/dependency changes.**
- **No database schema changes.**
- **`run_validation` does not trigger pre-apply checkpoint:** Not in `mutatingToolNames: new Set(['write_file', 'delete_file'])`. Verified by test.
- **Existing read/list/write/delete file tools preserved:** Regression suite (75 tests) passes.
- **Existing checkpoint behavior preserved:** Regression suite passes; `agent-harness-loop.spec.ts` passes.
- **Existing single-shot path preserved:** Not modified.
- **`enableToolLoop` default `false` remains effective:** `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop === false` confirmed by test.
- **`harnessVersion === 'v1'` gate remains effective:** Only path to `ToolDispatcher` instantiation and all handler registrations.

---

## Governance Confirmations

- **TASKS.md:** Not changed during implementation; updated only during this consolidation.
- **TASKS_BACKLOG_FULL.md:** Not changed during implementation; updated only during this consolidation.
- **Checkpoint document:** Not created before this consolidation step; created only now.
- **No source/runtime/test/package files changed during consolidation.**

---

## Next Recommended Task

Per `AGENT-HARNESS-V1-MASTER-PLAN.md`, the task immediately following AGENT-HARNESS-04A is:

**AGENT-HARNESS-05A — Browser Smoke Tool Investigation**

Objective: Investigate feasibility of programmatic browser testing (Playwright / Puppeteer) inside Docker + gVisor containers. Assessment and investigation only — no production implementation or tool registration in this slice.

> This task has not been registered. Registration is the next step. Do not implement without registration.
