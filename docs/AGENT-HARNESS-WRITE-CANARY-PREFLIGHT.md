# AGENT-HARNESS-WRITE-CANARY — Step 2 Preflight / Stage-Start / Safety Design

**Task ID:** AGENT-HARNESS-WRITE-CANARY
**Step:** 2 — Preflight / Stage-Start / Safety Design
**Status:** COMPLETE — 2026-07-19
**Date:** 2026-07-19
**Nature:** Investigation and design only — no source/test/translation/package/migration/entity/environment/Docker files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-HARNESS-WRITE-CANARY |
| Title | Agent Harness Write Canary + Production Activation |
| Family | AGENT HARNESS / WRITE PATH / CANARY / PRODUCTION ACTIVATION |
| Risk | HIGH — 4-step loop |
| Step 1 | COMPLETE — Registration — 2026-07-19 |
| Step 2 | This document — Preflight / Stage-Start / Safety Design — 2026-07-19 |
| Step 3 | Pending — Implementation |
| Step 4 | Pending — Consolidation / Checkpoint |
| Keith Approval | "go" — 2026-07-19 |
| Blocker Addressed | BETA-READY-00 blocker B1 (CRITICAL — write path not production-activated) |

---

## 2. Files Inspected

| File | Purpose |
|------|---------|
| `TASKS.md` | Active task ledger — AGENT-HARNESS-WRITE-CANARY section |
| `TASKS_BACKLOG_FULL.md` | Master backlog — task registration |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Execution priority/sequence |
| `docs/BETA-READY-00-CHECKPOINT.md` | Beta readiness checkpoint — blocker B1 |
| `docs/BETA-READY-00-CHECKLIST.md` | Beta readiness checklist — gate G4, blocker B1 |
| `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Full E2E read-only canary — path reference |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Feature gates and config factory |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Agent loop with checkpoint/dispatch |
| `services/ai-service/src/agent-harness/tools/tool-dispatcher.ts` | Dispatcher with timeout/abort/size safety |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | Tool definitions — 8 tools defined |
| `services/ai-service/src/agent-harness/tools/tool-registry.contracts.ts` | Tool type contracts |
| `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.ts` | read_file, list_files, write_file, delete_file handlers |
| `services/ai-service/src/agent-harness/tools/handlers/validation-tool-handlers.ts` | run_validation handler |
| `services/ai-service/src/agent-harness/audit/harness-audit-events.ts` | Structured audit event types |
| `services/ai-service/src/agent-harness/audit/harness-audit-recorder.ts` | InMemoryHarnessAuditRecorder |
| `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | V1 contracts/types |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | HTTP client — writeWorkspaceFile, deleteWorkspaceFile, createWorkspaceCheckpoint |
| `services/ai-service/src/worker/worker.processor.ts` | Worker harness activation logic |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | API Gateway write/delete/checkpoint endpoints |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | API Gateway → container-manager client |
| `services/container-manager/src/docker/docker-runtime.service.ts` | validateWorkspacePath, writeFileToContainer, deleteFileFromContainer |
| `services/container-manager/src/sessions/internal-sessions.controller.ts` | Container-manager internal endpoint — write/delete |
| `services/container-manager/src/sessions/sessions.service.ts` | Session service — writeFileToContainer with termination/quota checks |

---

## 3. Current Write-Path State

### Summary: IMPLEMENTED but GATED OFF

The write path is **fully implemented** across all four services but **disabled by feature flags**:

```
AI Worker → ToolDispatcher → createWriteFileHandler → ApiGatewayHttpClient.writeWorkspaceFile()
  → API Gateway InternalWorkspaceFilesController POST /write
    → ContainerManagerHttpClient.writeSessionFile()
      → container-manager InternalSessionsController POST /:id/files
        → SessionsService.writeFileToContainer()
          → DockerRuntimeService.writeFileToContainer()
            → validateWorkspacePath() → Docker exec into /workspace/{path}
```

All endpoint implementations exist. The ai-service `createWriteFileHandler` and `createDeleteFileHandler` functions are wired in `worker.processor.ts` conditionally on `resolvedConfig.enableWriteTools`.

---

## 4. `enableToolLoop` / Feature-Gate State

| Flag | Environment Variable | Default | Current Production State |
|------|---------------------|---------|--------------------------|
| `enableToolLoop` | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | OFF (no env var set in production .env) |
| `enableWriteTools` | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | OFF (no env var set in production .env) |
| `enableValidationTools` | `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | OFF (no env var set in production .env) |
| `enableBrowserSmoke` | N/A (config field) | `false` | OFF |
| `enableSemanticSearch` | N/A (config field) | `false` | OFF |
| `enablePreApplyCheckpoint` | N/A (config field) | `true` | ON (always enabled when harness active) |

**Gate logic in `worker.processor.ts`:**
```
const useHarness = job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop;
```

When `enableToolLoop=true` AND adapter supports tool use:
- `read_file` and `list_files` are ALWAYS registered.
- `write_file` and `delete_file` are registered ONLY if `enableWriteTools=true`.
- `run_validation` is registered ONLY if `enableValidationTools=true`.
- `browser_smoke` is registered ONLY if `enableBrowserSmoke=true`.

**Both `enableToolLoop` AND `enableWriteTools` must be `true` for write tools to be available at runtime.**

---

## 5. Tool Inventory

### 5.1 All Registered Tool Definitions (8 tools)

| # | Tool ID | Category | Risk Level | Enabled (registry) | Implementation Status | Tags |
|---|---------|----------|------------|--------------------|-----------------------|------|
| 1 | `list_files` | workspace | low | true | implemented | workspace, read-only |
| 2 | `read_file` | workspace | low | true | implemented | workspace, read-only |
| 3 | `write_file` | workspace | high | true | implemented | workspace, write, approval-required |
| 4 | `delete_file` | workspace | destructive | true | implemented | workspace, delete, approval-required |
| 5 | `run_validation` | validation | medium | true | implemented | validation, allow-list-only, read-only |
| 6 | `start_preview` | preview | medium | **false** | **planned** | planned, metadata-only, preview |
| 7 | `browser_smoke` | browser | high | **false** | implemented | browser, read-only |
| 8 | `search_workspace` | search | low | **false** | **planned** | planned, metadata-only, search |

### 5.2 Read-Only Tools (dispatcher-wired in production)

| Tool | Gate | Wired | E2E Canary Verified |
|------|------|-------|---------------------|
| `list_files` | `enableToolLoop` | Always when harness active | YES — AGENT-HARNESS-06E PASS |
| `read_file` | `enableToolLoop` | Always when harness active | YES — AGENT-HARNESS-06E PASS |

### 5.3 Write-Capable Tools (dispatcher-wired conditionally)

| Tool | Gate | Wired | E2E Canary Verified |
|------|------|-------|---------------------|
| `write_file` | `enableToolLoop` + `enableWriteTools` | Conditional | **NO — never E2E tested** |
| `delete_file` | `enableToolLoop` + `enableWriteTools` | Conditional | **NO — never E2E tested** |

### 5.4 Validation/Browser Tools (dispatcher-wired conditionally)

| Tool | Gate | Wired |
|------|------|-------|
| `run_validation` | `enableToolLoop` + `enableValidationTools` | Conditional |
| `browser_smoke` | `enableToolLoop` + `enableBrowserSmoke` | Conditional |

---

## 6. Write-Tool Availability Assessment

### `write_file`

- **Registry status:** `enabled: true`, `implementationStatus: 'implemented'`
- **Handler:** `createWriteFileHandler()` in `file-tool-handlers.ts`
- **Runtime gate:** `resolvedConfig.enableWriteTools === true`
- **Path validation:** `validateAndNormalizePath()` — rejects empty, traversal (`..`), normalizes leading `/`
- **Size validation:** Rejects `content` exceeding `maxFileWriteBytes` (131,072 bytes = 128 KB)
- **HTTP endpoint:** `POST /api/internal/workspace/:sessionId/write` → container-manager `POST /api/internal/sessions/:id/files`
- **Container execution:** `DockerRuntimeService.writeFileToContainer()` → `validateWorkspacePath()` → `docker exec` with `/workspace/{path}`

### `delete_file`

- **Registry status:** `enabled: true`, `implementationStatus: 'implemented'`
- **Handler:** `createDeleteFileHandler()` in `file-tool-handlers.ts`
- **Runtime gate:** `resolvedConfig.enableWriteTools === true`
- **Path validation:** `validateAndNormalizePath()` + additional safety: rejects root/workspace-root, directory paths (trailing `/`), glob patterns (`*`, `?`)
- **HTTP endpoint:** `DELETE /api/internal/workspace/:sessionId/delete` → container-manager `DELETE /api/internal/sessions/:id/files`
- **Container execution:** `DockerRuntimeService.deleteFileFromContainer()` → `validateWorkspacePath()` → `docker exec rm /workspace/{path}`

---

## 7. Path Sandboxing Assessment

### Multi-Layer Path Validation

| Layer | Component | Validation |
|-------|-----------|------------|
| 1 | ai-service `file-tool-handlers.ts` | `validateAndNormalizePath()` — rejects empty, `..` traversal (regex), strips leading `/` |
| 2 | ai-service `file-tool-handlers.ts` (delete) | Rejects root targets (`''`, `'.'`, `'/'`), directory paths, glob patterns |
| 3 | container-manager `docker-runtime.service.ts` | `validateWorkspacePath()` — rejects empty, `..` segments, absolute paths outside `/workspace` |
| 4 | container-manager Docker exec | All file operations scoped to `/workspace/{path}` — Docker container filesystem isolation |

### Path Traversal

- **Layer 1 (ai-service):** Regex `/(^|[\\/])\.\.($|[\\/])/` blocks `..` in any position.
- **Layer 3 (container-manager):** `pathSegments.some(segment => segment === '..')` blocks `..` segments.
- **ASSESSMENT: BLOCKED** — double-validated at two service layers.

### Absolute Host Paths

- **Layer 1 (ai-service):** Leading `/` is stripped; path becomes relative.
- **Layer 3 (container-manager):** Rejects paths starting with `/` unless `/workspace` prefix — but ai-service already normalizes to relative.
- **Layer 4 (Docker):** Path is prepended with `/workspace/` inside the container. Even if somehow bypassed, the operation runs inside a Docker container — host filesystem is not accessible.
- **ASSESSMENT: BLOCKED** — multi-layer protection + Docker container isolation.

### Write Allowlist Root

- All file operations are scoped to `/workspace/` inside the Docker container.
- There is no mechanism to write outside `/workspace/`.
- The container itself is the sandbox boundary.

---

## 8. Secrets/Env Protection Assessment

### Can the harness read/write env files?

- **No dedicated env-file blocklist exists in the path validation layer.**
- The `requireApprovalForEnvFileWrite` config flag is `true` in `AgentHarnessConfigV1`, but **no runtime enforcement of this flag exists in the current `createWriteFileHandler`**.
- However: the workspace is inside a Docker container. There are no platform `.env` files inside user workspace containers.
- Platform secrets (`.env`, `.env.local`) live on the host filesystem, not inside containers.
- The container has its own env vars (injected at container creation time), but those are not accessible via file read/write operations.

### Risk Assessment

| Concern | Status |
|---------|--------|
| Can harness read platform `.env` files? | NO — Docker container isolation; platform files are on host |
| Can harness write to platform `.env` files? | NO — Docker container isolation |
| Can harness access container env vars via file write? | NO — env vars are in process memory, not files |
| Can user `.env` files in workspace be read/written? | YES — if user creates `.env` in their project, the harness can read/write it |

**ASSESSMENT: SAFE for platform secrets.** User workspace `.env` files are the user's own project files — reading/writing them is expected behavior for a code-generation AI.

---

## 9. Audit-Event Assessment

### Audit Events Emitted During Write Path

| Event | When | Contains |
|-------|------|----------|
| `harness.loop_started` | Loop begins | maxToolIterations, maxToolResultBytes, toolTimeoutMs |
| `harness.model_invocation_started` | Before each model call | iteration |
| `harness.model_invocation_completed` | After model response | provider, model, toolCallCount, tokensUsed |
| `harness.tool_dispatch_started` | Before dispatching each tool | callId, toolName |
| `harness.tool_dispatch_completed` | After successful tool dispatch | callId, toolName, durationMs, resultBytes |
| `harness.tool_dispatch_failed` | After failed tool dispatch | callId, toolName, errorCode, errorMessage |
| `harness.tool_result_budget_exceeded` | When aggregate result budget exceeded | callId, toolName, candidateBytes |
| `harness.loop_completed` | Normal loop completion | totalToolCalls, terminationReason |

### Missing Write-Specific Audit Events

- No dedicated `harness.write_attempted` event.
- No dedicated `harness.write_succeeded` event.
- No dedicated `harness.write_rejected` event.
- No dedicated `harness.delete_attempted` event.

**However:** The existing `harness.tool_dispatch_started/completed/failed` events with `toolName: 'write_file'` or `toolName: 'delete_file'` provide equivalent tracing. Every write attempt is auditable through the generic tool dispatch events.

**ASSESSMENT: ADEQUATE for canary.** The existing generic tool-dispatch audit events cover write operations. Dedicated write-specific events can be added in a later slice if needed for production monitoring dashboards.

---

## 10. Checkpoint/Rollback Assessment

### Pre-Apply Checkpoint

- `enablePreApplyCheckpoint` is `true` by default in `AgentHarnessConfigV1`.
- The harness loop (`agent-harness-loop.ts`) creates a checkpoint **before the first mutating tool call** in a batch:
  - `mutatingToolNames: new Set(['write_file', 'delete_file'])`
  - `createCheckpointFn` calls `ApiGatewayHttpClient.createWorkspaceCheckpoint()`
  - Checkpoint route: `POST /api/internal/workspace/:sessionId/checkpoint` → container-manager `createManualCheckpoint()`
- If checkpoint creation fails, **all mutating tool calls in the batch are aborted** with `CHECKPOINT_FAILED` error messages.
- Checkpoint hash is stored in `usage_records.metadata.preApplyCheckpointHash`.

### Checkpoint Safety

| Property | Value |
|----------|-------|
| Checkpoint created before first write? | YES |
| Checkpoint failure blocks writes? | YES — entire batch aborted |
| Checkpoint hash recorded for rollback? | YES — in metadata |
| Rollback mechanism exists? | YES — git-based checkpoint revert system (CHECKPOINT-LEDGER-01) |
| Rollback tested? | YES — historical checkpoint/revert system validated |

**ASSESSMENT: SAFE.** The pre-apply checkpoint mechanism is well-designed and blocks writes if checkpointing fails.

---

## 11. Validation Command Assessment

- `run_validation` is gated behind `enableValidationTools`.
- Allow-list: `['npm test', 'npm run build', 'npx tsc --noEmit']` — hardcoded in config.
- Arbitrary shell is explicitly blocked (`allowArbitraryShell: false`).
- Timeout: 120,000ms (2 minutes).
- Output truncated to `maxValidationOutputBytes` (131,072 bytes).

**ASSESSMENT: SAFE.** Validation commands are strictly bounded. Not required for write canary but safe to enable alongside writes.

---

## 12. Preview/Build Integration Assessment

- `start_preview` is `enabled: false` and `implementationStatus: 'planned'` — not wired.
- `browser_smoke` is `enabled: false` in registry but `implementationStatus: 'implemented'` — gated behind `enableBrowserSmoke`.
- Neither tool is part of the write canary scope.

**ASSESSMENT: NOT IN SCOPE.** Preview/browser-smoke tools remain disabled and do not affect write canary safety.

---

## 13. Kill-Switch / Feature-Flag Plan

### Current Gates (already implemented)

| Gate | Variable | Required for Write | Default |
|------|----------|-------------------|---------|
| Tool loop | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | YES | `false` |
| Write tools | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | YES | `false` |

### Activation Plan

For canary:
```
AGENT_HARNESS_ENABLE_TOOL_LOOP=true
AGENT_HARNESS_ENABLE_WRITE_TOOLS=true
```

### Kill Switch

- Set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` → immediately disables write_file and delete_file registration.
- Set `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` → disables entire harness tool loop (plain execution only).
- Both flags default to `false` — the safe state is the default state.
- Flags are read at module initialization via `createAgentHarnessConfigV1(process.env)` — requires service restart to take effect.

### Emergency Disable Procedure

1. Set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` in the ai-service environment.
2. Restart ai-service worker.
3. All new executions will use read-only harness (or plain mode if tool loop also disabled).
4. In-flight executions will complete but cannot dispatch new write_file/delete_file calls (dispatcher won't have the handler registered for new dispatches — but already-dispatched calls within the same execution may complete).

**IMPROVEMENT NEEDED (may defer):** A runtime-checkable kill switch that aborts write dispatch mid-execution without requiring restart. This is acceptable to defer for limited beta scale.

---

## 14. Minimal Canary Operation

### Design: Smallest Safe Canary

**Objective:** Verify the full E2E write path works correctly inside a disposable test workspace/project sandbox.

**Steps:**

1. Start infrastructure: Docker, PostgreSQL, Redis, container-manager, API Gateway, AI Service Worker.
2. Set process-scoped env on AI Worker only:
   - `AGENT_HARNESS_ENABLE_TOOL_LOOP=true`
   - `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true`
3. Create a test session via `POST /api/sessions` (uses a real Docker container).
4. Verify read path: `list_files` and `read_file` return actual data (regression check).
5. Submit a harness-routed job that triggers `write_file`:
   - Use `TestToolCapableStubAdapter` with a deterministic write sequence.
   - Write a harmless file: `canary-write-test.md` with content `# Write Canary\nTimestamp: <iso>`
6. Verify the file exists: `read_file` on `canary-write-test.md` → content matches.
7. (Optional) Submit a second job that overwrites the file with updated content → verify update.
8. Verify checkpoint was created: `preApplyCheckpointHash` in execution metadata is non-null.
9. Verify audit events: `tool_dispatch_started` and `tool_dispatch_completed` for `write_file`.
10. Clean up: Stop session, stop infrastructure.

**NOT included in canary:**
- `delete_file` — defer unless explicitly safe (assessed below).
- `run_validation` — separate concern; not required for write canary.
- `browser_smoke` — disabled; not in scope.
- Real AI provider calls — use stub adapter (zero tokens, zero cost).

### Delete Assessment

`delete_file` handler has strong safety:
- Rejects root/workspace-root targets.
- Rejects directory paths.
- Rejects glob patterns.
- Uses `validateWorkspacePath()` at container-manager layer.
- Scoped to `/workspace/` inside Docker container.

**Decision:** Include `delete_file` in canary scope IF time permits and write canary passes first. Delete is lower priority because the primary beta use case is file creation/editing, not deletion.

---

## 15. Required Tests (Before Runtime Canary)

### Unit Tests Required

| # | Test | Target | Purpose |
|---|------|--------|---------|
| T1 | `createWriteFileHandler` with valid path and content | `file-tool-handlers.ts` | Verify handler calls client.writeWorkspaceFile correctly |
| T2 | `createWriteFileHandler` with content exceeding maxFileWriteBytes | `file-tool-handlers.ts` | Verify rejection before HTTP call |
| T3 | `createWriteFileHandler` with path traversal | `file-tool-handlers.ts` | Verify rejection |
| T4 | `createWriteFileHandler` with empty path | `file-tool-handlers.ts` | Verify rejection |
| T5 | `createDeleteFileHandler` with valid path | `file-tool-handlers.ts` | Verify handler calls client.deleteWorkspaceFile correctly |
| T6 | `createDeleteFileHandler` with root target | `file-tool-handlers.ts` | Verify rejection |
| T7 | `createDeleteFileHandler` with directory path | `file-tool-handlers.ts` | Verify rejection |
| T8 | `createDeleteFileHandler` with glob pattern | `file-tool-handlers.ts` | Verify rejection |
| T9 | Worker harness loop with `enableWriteTools=true` registers write_file | `worker.processor` | Verify conditional registration |
| T10 | Worker harness loop with `enableWriteTools=false` does NOT register write_file | `worker.processor` | Verify gate |
| T11 | Pre-apply checkpoint triggers before first write_file dispatch | `agent-harness-loop` | Verify checkpoint sequence |
| T12 | Write_file dispatch blocked when checkpoint fails | `agent-harness-loop` | Verify safety |

### Assessment of Existing Tests

Many of these tests may already exist in:
- `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.spec.ts`
- `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts`
- `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts`

**Step 3 must verify which tests already exist and add any missing ones.**

---

## 16. Required Runtime Smoke (After Implementation)

### Minimum Runtime Canary Steps

| # | Step | Pass Criteria |
|---|------|---------------|
| R1 | Docker/PostgreSQL/Redis healthy | Containers running, health checks pass |
| R2 | container-manager started | Port 4002 listening |
| R3 | API Gateway started | Port 4000 listening; `/api/health` 200 |
| R4 | AI Service Worker started with flags | `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` + `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` |
| R5 | Test session created | `POST /api/sessions` returns sessionId; Docker container running |
| R6 | `list_files` works (regression) | Returns actual file list from container workspace |
| R7 | `read_file` works (regression) | Returns actual file content from container workspace |
| R8 | `write_file` creates file | Write `canary-write-test.md`; subsequent `read_file` returns written content |
| R9 | Pre-apply checkpoint created | `preApplyCheckpointHash` non-null in execution metadata |
| R10 | Audit events present | Logger output contains `tool_dispatch_started`/`completed` for `write_file` |
| R11 | (Optional) `write_file` overwrites file | Second write to same path succeeds; content updated |
| R12 | (Optional) `delete_file` removes file | Delete `canary-write-test.md`; subsequent `read_file` fails |
| R13 | Cleanup | Session stopped; containers stopped; no lingering test data |

---

## 17. Safety Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Write escapes container sandbox | LOW | Docker isolation + `/workspace` scoping + path validation at 2 layers |
| 2 | Path traversal bypasses validation | LOW | Regex + segment-based validation at 2 layers; E2E canary will explicitly test |
| 3 | Large file write exhausts container disk | LOW | `maxFileWriteBytes=131072` (128KB) hard cap in handler |
| 4 | Checkpoint fails silently, write proceeds | LOW | Harness loop explicitly aborts batch on checkpoint failure |
| 5 | `delete_file` removes critical workspace file | MEDIUM | Root/directory/glob rejection; approval-required flag; defer delete from canary if needed |
| 6 | Env file written inside user workspace | LOW | Expected behavior for code-gen; platform env is on host, not in container |
| 7 | No runtime kill switch (requires restart) | MEDIUM | Acceptable for limited beta scale; improvement deferred |
| 8 | `requireApprovalForEnvFileWrite` flag not enforced at handler level | LOW | Platform envs protected by Docker isolation; user workspace .env is intentional |

---

## 18. Stop Conditions for Step 3

**Do NOT proceed with Step 3 implementation if:**

1. Any existing write-path unit tests are currently failing.
2. The `file-tool-handlers.spec.ts` does not already cover the basic write handler path.
3. The `agent-harness-loop.spec.ts` does not already cover the checkpoint-before-write path.
4. Any TypeScript errors exist in the ai-service or api-gateway after reading current state.
5. The `TestToolCapableStubAdapter` from AGENT-HARNESS-06D1 is broken or missing.
6. Docker Desktop cannot start containers.
7. Keith revokes approval.

---

## 19. Proposed Step 3 Implementation Scope

### Must Implement

1. **Extend `TestToolCapableStubAdapter`** (or create a write-specific test stub) to emit a deterministic `write_file` tool call in its response sequence.
2. **Canary submission script** (`canary-write-submit-job.ts` or equivalent) — based on 06D/06E canary scripts — that:
   - Creates a test session.
   - Enqueues a job with `harnessVersion: 'v1'` and process-scoped write flags.
   - Polls for completion.
   - Reads back the written file.
   - Reports PASS/FAIL.
3. **Verify existing unit test coverage** for write handler path validation (T1–T12 above). Add any missing tests.
4. **Execute runtime canary** (R1–R13 above) with local Docker/PostgreSQL/Redis + all 3 backend services.
5. **Document canary result** with execution evidence.

### Must Test

| # | What | How |
|---|------|-----|
| 1 | Write handler path validation | Unit tests (existing + any gaps) |
| 2 | Write handler size rejection | Unit test |
| 3 | Delete handler safety rejection | Unit tests (existing + any gaps) |
| 4 | Worker conditional registration | Unit/integration test |
| 5 | Checkpoint-before-write sequence | Unit test (harness loop) |
| 6 | Full E2E write_file | Live runtime canary (Docker + all services) |
| 7 | Full E2E read-back verification | Live runtime canary |
| 8 | Audit event emission | Log inspection during runtime canary |

### May Defer

- `delete_file` E2E runtime canary (include only if write canary passes and time permits).
- `run_validation` activation (separate feature gate; not required for write canary).
- `browser_smoke` activation (disabled; not in scope).
- Dedicated write-specific audit event types (generic events adequate for canary).
- Runtime kill switch without restart (acceptable limitation for limited beta scale).
- `requireApprovalForEnvFileWrite` enforcement at handler level (platform .env protected by Docker isolation).
- Production `.env` file updates (belong to a separate deployment task, not write canary).

### Must Not Include

- Modifications to platform auth, session, CSRF, or guard logic.
- Modifications to billing, credit, subscription, or Stripe code.
- Modifications to frontend code or translations.
- Modifications to Docker/Compose configuration.
- Modifications to database migrations or entities.
- Real AI provider calls (use stub adapter only).
- Production deployment or env changes (canary is local-only).
- New dependencies or packages.
- Broad refactors of harness loop or dispatcher.
- Provider/payment/customer-portal/webhook work.

---

## 20. Split Decision

### Decision: SPLIT into 2 child slices

**Rationale:** The required implementation crosses multiple concerns:

1. **Test stub extension + unit test verification** — purely code/test work, no runtime.
2. **Live E2E runtime canary** — requires Docker/PostgreSQL/Redis/all-3-services running.

These are distinct operational contexts. The first can be validated with `npm test` only. The second requires a full infrastructure stack.

### Proposed Child Tasks

| ID | Title | Nature | Risk |
|----|-------|--------|------|
| AGENT-HARNESS-WRITE-CANARY-A | Write Stub + Unit Test Coverage Verification | Implementation + test | MEDIUM — 3-step loop |
| AGENT-HARNESS-WRITE-CANARY-B | Live E2E Write Canary Execution | Runtime canary | HIGH — 4-step loop |

### Child Slice Boundaries

**AGENT-HARNESS-WRITE-CANARY-A:**
- Extend or create write-capable test stub adapter.
- Verify all unit tests T1–T12 exist or add missing ones.
- Run `npm test` — all pass.
- Run `npx tsc --noEmit` — clean.
- No Docker. No PostgreSQL. No Redis. No runtime services.
- Deliverable: Test suite passes; write path unit-tested; stub ready for runtime canary.

**AGENT-HARNESS-WRITE-CANARY-B:**
- Start Docker + PostgreSQL + Redis + container-manager + API Gateway + AI Worker (with write flags).
- Create test session.
- Execute E2E write canary (R1–R13).
- Document canary result with execution evidence.
- Decide: PASS → write path production-ready. FAIL → identify and fix.
- Clean up infrastructure.
- Deliverable: E2E canary PASS/FAIL with evidence; production activation decision.

---

## 21. Non-Goals Confirmed

The following are explicitly NOT part of AGENT-HARNESS-WRITE-CANARY:

- [ ] No Stripe/payment/provider/customer-portal/webhook work.
- [ ] No production deployment (that's T2 in BETA-READY-00 checklist).
- [ ] No pre-beta full-stack smoke test (that's T3).
- [ ] No frontend changes.
- [ ] No translation changes.
- [ ] No billing/credit changes.
- [ ] No auth/session/guard changes.
- [ ] No new database migrations.
- [ ] No real AI provider calls.
- [ ] No multi-agent collaboration work.
- [ ] No external integrations.

---

## 22. Safety Confirmations

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | Write path is sandboxed to Docker container `/workspace/` | CONFIRMED |
| 2 | Path traversal blocked at 2 layers (ai-service + container-manager) | CONFIRMED |
| 3 | Absolute host paths blocked | CONFIRMED |
| 4 | Platform secrets/env protected by Docker isolation | CONFIRMED |
| 5 | Pre-apply checkpoint blocks writes if checkpoint fails | CONFIRMED |
| 6 | Feature flags default to `false` (safe state) | CONFIRMED |
| 7 | Kill switch exists (set flag to false + restart) | CONFIRMED |
| 8 | Audit events emitted for all tool dispatches | CONFIRMED |
| 9 | File write size capped at 128KB | CONFIRMED |
| 10 | Delete rejects root/directory/glob targets | CONFIRMED |
| 11 | No source/test/translation/package/migration/entity/environment/Docker files changed in Step 2 | CONFIRMED |
| 12 | No runtime, Docker, DB, browser, API, test, build, provider, payment, Stripe CLI, webhook, git commit, or git push occurred in Step 2 | CONFIRMED |
| 13 | No secret-bearing environment file opened in Step 2 | CONFIRMED |
| 14 | No write/delete canary performed in Step 2 | CONFIRMED |
| 15 | No subagents used in Step 2 | CONFIRMED |

---

## 23. Exact Next Action

**Step 3 — Implementation — split into 2 child slices:**

1. **First:** AGENT-HARNESS-WRITE-CANARY-A — Write Stub + Unit Test Coverage Verification
   - Extend test stub for write_file tool call.
   - Verify/add unit tests for write handler, delete handler, conditional registration, checkpoint-before-write.
   - Validate: `npm test` PASS, `npx tsc --noEmit` clean.
   - No Docker/runtime required.

2. **Then:** AGENT-HARNESS-WRITE-CANARY-B — Live E2E Write Canary Execution
   - Requires Docker Desktop running.
   - Full infrastructure stack.
   - E2E write canary execution with evidence.
   - Production activation decision.

**Keith approval required before proceeding to Step 3 child slice implementation.**

---

## Safety Design Summary

### Write Allowlist Root
`/workspace/` inside Docker container (all file operations scoped here).

### Path Normalization Rules
- Leading `/` stripped to make path relative.
- Path prepended with `/workspace/` at container-manager layer.

### Path Traversal Rejection
- Regex `/(^|[\\/])\.\.($|[\\/])/` at ai-service layer.
- Segment-based `segment === '..'` check at container-manager layer.

### Absolute Path Rejection
- ai-service strips leading `/`.
- container-manager rejects absolute paths not starting with `/workspace`.
- Docker container isolation prevents host filesystem access regardless.

### Env/Secret File Rejection
- Platform secrets on host — inaccessible from container.
- User workspace `.env` files are intentionally accessible (user's own project files).

### Max File Size
- `maxFileWriteBytes: 131,072` (128 KB) — enforced at ai-service handler before HTTP call.

### Allowed File Extensions
- None enforced — all file types allowed (required for code generation use case).

### Overwrite Policy
- Allowed — `write_file` creates or overwrites. This is the expected code-gen behavior.

### Delete Policy
- Gated behind same `enableWriteTools` flag.
- Rejects root, workspace-root, directories, glob patterns.
- Single-file delete only.
- `requireApprovalForDelete: true` in config (enforcement TBD for future approval UX).

### Audit-Event Requirement
- `harness.tool_dispatch_started` and `harness.tool_dispatch_completed/failed` emitted for every write/delete attempt.
- Events logged via `InMemoryHarnessAuditRecorder` → structured JSON logger output.

### Timeout Requirement
- `toolTimeoutMs: 30,000` (30 seconds) per tool call — enforced by ToolDispatcher.

### Result-Size Cap
- `maxToolResultBytes: 262,144` (256 KB) aggregate budget — enforced by harness loop.

### Rollback/Checkpoint Requirement
- `enablePreApplyCheckpoint: true` — checkpoint created before first mutating call in batch.
- Checkpoint failure aborts entire batch.
- Checkpoint hash recorded in execution metadata for rollback reference.

### Kill Switch / Feature Flag
- `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` → disables write/delete registration.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` → disables entire harness tool loop.
- Both default to `false`.

### Emergency Disable Procedure
1. Set `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` in ai-service environment.
2. Restart ai-service worker process.
3. New executions will not have write_file/delete_file available.
4. In-flight executions complete with whatever tools were already dispatched.

### Failure Handling
- Handler errors wrapped into typed `HANDLER_ERROR` results — never crash the loop.
- Checkpoint failures produce `CHECKPOINT_FAILED` error results for all mutating tools in batch.
- Timeout produces `TOOL_TIMEOUT` error result.
- AbortSignal produces `ABORTED` error result.
- All failures are auditable via structured events.
