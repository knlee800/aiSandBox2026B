# AGENT-HARNESS-05C4 — Controlled Harness Loop Activation Readiness Review — CHECKPOINT

**Task ID:** AGENT-HARNESS-05C4
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-29
**Family:** AGENT-HARNESS
**Phase:** 5C
**Nature:** ARCHITECTURE / SECURITY / FEATURE-GATE REVIEW / INVESTIGATION ONLY

---

## 1. Objective

Determine whether the Agent Harness loop is ready for a tightly controlled first activation and define the smallest safe implementation/validation slices.

This task was review-only. No loop activation was performed. No source, runtime, test, package, Docker, frontend, database, or environment files were modified.

---

## 2. Current Locked Safety State (Confirmed Unchanged)

| Gate | Value |
|------|-------|
| `enableToolLoop` | `false` |
| `enableBrowserSmoke` | `false` |
| `enablePreApplyCheckpoint` | `true` |

- A `harnessVersion: 'v1'` request selects the plain execution path.
- No harness tools are reachable at runtime.
- Public `harnessVersion` input alone is **not** authorization for harness mode.
- Both gates remain **false** and unchanged from prior locked state.

---

## 3. Files Inspected

### Original Review

| File | Purpose |
|------|---------|
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Authorization surface, session ownership enforcement |
| `services/api-gateway/src/auth/` | Auth guards and session validation |
| `services/api-gateway/src/guards/` | Guard strategy and entitlement checks |
| `services/ai-service/src/worker/worker.processor.ts` | Harness routing gate, feature-flag evaluation |
| `services/ai-service/src/agent-harness/` | Harness executor, tool dispatch, config |
| `services/ai-service/src/ai-execution/` | Execution service, adapter wiring |
| `services/ai-service/src/queue/job.types.ts` | BullMQ job schema, harnessVersion propagation |
| `services/container-manager/src/sessions/` | Session ownership, workspace path binding |
| `services/container-manager/src/executor/` | Container isolation, tool handler HTTP wiring |
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` | Harness architecture plan |
| `docs/AGENT-HARNESS-05C3-CHECKPOINT.md` | Prior locked state and runtime validation results |

### Supplemental Review

| File | Purpose |
|------|---------|
| `services/ai-service/src/agent-harness/harness-config.ts` | `DEFAULT_AGENT_HARNESS_CONFIG_V1`, compile-time gate values |
| `services/ai-service/src/agent-harness/harness-executor.ts` | Tool loop, iteration cap, abort signal handling |
| `services/ai-service/src/agent-harness/tools/` | All registered tool handlers |
| `services/ai-service/src/agent-harness/adapters/xai.adapter.ts` | xAI provider adapter, tool-use protocol support |
| `services/ai-service/src/agent-harness/adapters/anthropic.adapter.ts` | Anthropic adapter (reference for tool-call contract) |
| `services/ai-service/src/agent-harness/harness-audit.ts` | Audit event type definitions |
| `services/container-manager/src/executor/workspace-http.service.ts` | Tool handler HTTP client, timeout configuration |

---

## 4. End-to-End Harness Call Path

```
Client POST /api/ai/execute
  → api-gateway: SessionGuard validates session cookie
  → api-gateway: AiExecutionController extracts sessionId from request body (not from session token)
  → api-gateway: BullMQ enqueue with { sessionId, harnessVersion, ... }
  → BullMQ queue
  → ai-service WorkerProcessor: receives job
  → WorkerProcessor evaluates:
      useHarness = (job.data.harnessVersion === 'v1') && enableToolLoop
  → if useHarness:
      HarnessExecutor: calls xAI/Anthropic with registered tool definitions
      HarnessExecutor: parses tool_use response
      HarnessExecutor: dispatches tool handler HTTP call to container-manager
      HarnessExecutor: continues loop until stop_reason = 'end_turn' or maxIterations
  → else: plain execution path (current state with enableToolLoop: false)
```

---

## 5. Authorization Findings

**Finding:** Session ownership is not enforced on `POST /api/ai/execute`.

- `SessionGuard` confirms the caller holds a valid session cookie.
- `AiExecutionController` extracts `sessionId` from the request body.
- There is no cross-check confirming that the authenticated session owns the requested `sessionId`.
- Any authenticated user can submit an arbitrary `sessionId` value.
- This allows cross-session harness dispatch if harness mode were activated.

**Severity:** BLOCKER — must be resolved before any harness activation.

**Required fix:** Validate that `req.session.sessionId` (or equivalent authenticated binding) matches the submitted `sessionId` before enqueueing. Return 403 if mismatched.

---

## 6. Feature-Gate Findings

**Finding:** `enableToolLoop` is a compile-time constant in `harness-config.ts`.

- `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop = false` is a TypeScript literal.
- Changing it requires a source code edit, image rebuild, and container recreation.
- There is no environment variable path to toggle the gate without rebuilding.
- `docker compose restart` does NOT apply changed environment variables; container recreation is required.

**Severity:** HIGH — activation is not controllable at deployment time without a code change; rollback is slow.

**Required fix (05C6):** Back `enableToolLoop` and `enableBrowserSmoke` with environment variables, read at service startup, with safe `false` defaults.

---

## 7. Tool Exposure Table

The following tools are registered in `DEFAULT_AGENT_HARNESS_CONFIG_V1` when `enableToolLoop` is `true`. All are currently unreachable because `enableToolLoop` is `false`.

| Tool | Class | `requiresApproval` | Checkpoint Triggered | Status |
|------|-------|--------------------|----------------------|--------|
| `read_file` | Read-only | No | No | Registered |
| `list_files` | Read-only | No | No | Registered |
| `write_file` | Mutating | No | Yes (`enablePreApplyCheckpoint`) | Registered |
| `delete_file` | Mutating | Yes | Yes | Registered |
| `run_command` | Mutating | Yes | Yes | Registered |
| `install_package` | Mutating | Yes | Yes | Registered |
| `write_env_file` | Mutating | Yes | Yes | Registered |
| `browser_smoke` | Browser | — | — | **DISABLED** (`enableBrowserSmoke: false`) |

- Arbitrary shell execution is not a registered tool.
- `browser_smoke` is separately gated and remains disabled.
- Planned or unimplemented tools cannot be dispatched; dispatch is bounded by the registered tool definitions array.

---

## 8. Approval-Enforcement Findings

**Finding:** `requiresApproval` is descriptive metadata only; there is no harness runtime enforcement.

- The `requiresApproval: true` field is set on tool definitions in `harness-config.ts`.
- `HarnessExecutor` does not check `requiresApproval` before dispatching a tool call.
- There is no pause-and-confirm flow, user acknowledgment gate, or platform authorization check triggered by this flag.
- The flag is currently advisory model-side metadata with no runtime effect.

**Severity:** BLOCKER — mutating tools (`delete_file`, `run_command`, `install_package`, `write_env_file`) have no approval gate before execution if harness mode were activated.

**Required fix (05C9 / 05C13):** Implement a runtime approval workflow that pauses harness execution, requests user confirmation, and proceeds only on explicit approval before dispatching `requiresApproval: true` tools.

---

## 9. Checkpoint Protection Findings

**Finding:** Pre-apply checkpoint is implemented for mutating tools via `enablePreApplyCheckpoint: true`.

- `HarnessExecutor` calls container-manager to create a Git checkpoint before executing mutating tool handlers.
- `enablePreApplyCheckpoint` is `true` and is **not** a compile-time blocker for activation (it is already correctly set).
- Checkpoint failure behavior: if checkpoint creation fails, the harness executor throws and the job fails. No mutation proceeds without a checkpoint.
- Read-only tools (`read_file`, `list_files`) do not trigger a checkpoint (correct).

**Finding:** The checkpoint protection implementation is acceptable for read-only tool activation (no checkpoint needed) and is a prerequisite dependency for mutating tool activation.

---

## 10. Session and Workspace Ownership Findings

**Finding:** Session ownership is not validated at the execute endpoint (see Section 5 — BLOCKER).

**Finding:** Workspace path validation is implemented in container-manager tool handlers.

- Tool handlers resolve workspace paths relative to the session workspace root.
- Path traversal protection is in place in container-manager.
- Cross-session access is not possible via path traversal.
- However, because `sessionId` in the job is not validated against the authenticated user's session, a crafted request can target another user's session workspace if harness mode were active.

**Container isolation:** Each session workspace is isolated at the container filesystem level. Isolation is not bypassed by the tool dispatch path.

**Required fix (05C5):** Session ownership enforcement at `POST /api/ai/execute`.

---

## 11. Adapter Compatibility Table (Corrected)

| Adapter | Plain Execution | Tool Definitions | Tool-Call Parsing | executeWithTools |
|---------|----------------|-----------------|-------------------|-----------------|
| `XAIAdapter` | Supported | Not implemented | Not implemented | **Not implemented** |
| `AnthropicAdapter` | Supported | Implemented | Implemented | Implemented |
| `OpenAIAdapter` | Supported | Partially | Partially | Partial |

**Finding:** `XAIAdapter` does not implement `executeWithTools` or tool-call response parsing. Calling the harness with xAI as the provider would result in a runtime error or silent failure at tool-use parsing.

**Severity:** BLOCKER — xAI is the designated first live validation provider. Harness activation cannot proceed until `XAIAdapter` implements the tool-use protocol.

**Required fix (05C10):** Implement `executeWithTools`, tool definition serialization, and tool-call response normalization in `XAIAdapter`.

---

## 12. Timeout and Cancellation Analysis (Corrected)

**Finding:** `AbortSignal` is not propagated through tool handler HTTP requests.

- `HarnessExecutor` receives a `signal` (from the BullMQ worker watchdog).
- The signal is passed into the tool loop but is **not** forwarded to the individual workspace HTTP calls made by tool handlers.
- `toolTimeoutMs` is defined in config but is unused in the tool handler HTTP client (`workspace-http.service.ts`).
- In-flight tool handler HTTP requests do not receive the abort signal.
- If the worker watchdog fires or the job is cancelled, in-flight HTTP requests to container-manager can outlive the worker process termination.

**Severity:** BLOCKER — active harness jobs cannot be safely stopped; HTTP requests can outlive the worker watchdog.

**Required fix (05C8):** Propagate `AbortSignal` through tool handler HTTP calls; enforce `toolTimeoutMs` as the per-call axios timeout.

**Additional finding:** Workspace HTTP methods (`workspace-http.service.ts`) have no client-side axios timeout configured. This applies to all tool handler HTTP calls regardless of AbortSignal propagation.

**Severity:** HIGH.

---

## 13. Audit and Observability Findings

**Finding:** `auditEventsEnabled` is defined in config but has no runtime implementation.

- `DEFAULT_AGENT_HARNESS_CONFIG_V1.auditEventsEnabled` is `true`.
- No harness lifecycle, tool request, tool execution, approval, or failure events are persisted to a durable store.
- The audit type definitions in `harness-audit.ts` are contract-only types; they are not wired to any event emitter, database writer, or structured log pipeline.
- Multi-iteration token accounting records only the final model call. Intermediate iteration token usage is not accumulated or reported.

**Severity:** HIGH — there is no per-tool structured audit trail for any harness execution.

**Required fix (05C9):** Implement structured harness audit event emission for at minimum: loop start, tool dispatch, tool result, approval request, and loop end events.

---

## 14. Harness Identity / Entitlement Findings

**Finding:** There is no harness-specific identity entitlement.

- Any authenticated `ai:execute` caller can submit `harnessVersion: 'v1'`.
- There is no role check, plan entitlement, feature flag per-user, or admin-only gate for harness access.
- If `enableToolLoop` were `true`, every authenticated user would have harness access.

**Severity:** HIGH — harness mode must be gated by an explicit identity entitlement, not just by the compile-time flag.

**Required fix (05C7):** Implement a harness identity entitlement check (environment-backed allow-list, role flag, or admin guard) validated before harness routing.

---

## 15. Strategy A–E Comparison

| Strategy | Description | Verdict |
|----------|-------------|---------|
| **A. Read-only canary** | Enable harness with only `read_file` / `list_files`; mutating tools disabled | Preferred — but blocked by prerequisites |
| **B. Internal/admin-only full tool set** | Full registered tool set for admin identity only | Premature; missing approval enforcement |
| **C. Environment-gated, dedicated test user** | Env flag + specific userId allow-list | Reasonable future state after 05C7 |
| **D. Global activation via public harnessVersion** | Any authenticated user | **Rejected** — cross-session risk, missing approval enforcement, xAI adapter not ready |
| **E. Keep disabled** | Resolve all prerequisites first | **Selected** |

**Recommendation:** Strategy E — keep harness disabled. Resolve prerequisites in the registered sequence (05C5–05C10) before any activation attempt. First activation must be Strategy A (read-only canary) after all blockers are resolved.

---

## 16. Blocking Issues — Ordered by Severity

### Critical Blockers (must be resolved before any activation)

1. **Session ownership not enforced** — `POST /api/ai/execute` does not validate that the authenticated session matches the submitted `sessionId`. Cross-session harness dispatch is possible. → **05C5**
2. **`requiresApproval` is metadata-only** — No runtime approval gate exists; mutating tools dispatch without user confirmation. → **05C9 / 05C13**
3. **`XAIAdapter` does not implement tool calls** — `executeWithTools` is absent; xAI harness execution fails silently or throws. → **05C10**
4. **`AbortSignal` not propagated to tool HTTP requests** — In-flight HTTP calls outlive the worker watchdog; `toolTimeoutMs` is unused. → **05C8**

### High-Severity Findings (must be resolved before production activation)

5. **`enableToolLoop` is a compile-time constant** — No environment-backed gate; rollback requires image rebuild. → **05C6**
6. **No harness-specific identity entitlement** — All authenticated users would reach harness mode if the gate were opened. → **05C7**
7. **No per-tool structured audit trail** — `auditEventsEnabled` is config-only with no runtime implementation. → **05C9**
8. **Multi-iteration token accounting records only the final model call** — Intermediate iteration usage is not accumulated. → **05C9**
9. **Workspace HTTP methods have no client-side axios timeout** — Tool handler HTTP calls can hang indefinitely. → **05C8**

---

## 17. Prerequisite Task Sequence

| Slice | Task ID | Description |
|-------|---------|-------------|
| 1 | **05C5** | Session Ownership Enforcement |
| 2 | **05C6** | Environment-Backed Feature Gate |
| 3 | **05C7** | Harness Identity Entitlement |
| 4 | **05C8** | Execution-Bound Hardening (AbortSignal + toolTimeoutMs) |
| 5 | **05C9** | Structured Harness Audit Events |
| 6 | **05C10** | xAI Adapter Tool-Use Implementation |
| 7 | **05C11** | Read-Only Tool Allow-List Activation |
| 8 | **05C12** | Live Read-Only xAI Canary |
| 9 | **05C13** | Runtime Approval Workflow |
| 10 | **05C14** | Mutating Tool Activation |
| 11 | **05C15** | browser_smoke Activation |
| 12 | **05C16** | Production Canary and Rollback Validation |

Although some slices are technically independent, register and execute them one task at a time under the established project workflow.

---

## 18. Corrected Rollback Procedure

### Current State (enableToolLoop: false / compile-time constant)

Rollback = revert source change → rebuild image → recreate container.

### Future State (after 05C6 environment-backed gate)

To disable: set `ENABLE_TOOL_LOOP=false` (or equivalent env var) and recreate the ai-service container.

**Correct recreation command:**
```
docker compose up -d --no-deps --force-recreate ai-service
```

**`docker compose restart` does NOT apply changed environment configuration** — it only restarts the existing container with its original environment. Container recreation is required.

### Active Job Behavior During Rollback

- Active (in-flight) harness jobs cannot be assumed to stop on container recreation alone.
- In-flight tool handler HTTP requests do not receive `AbortSignal`.
- Active jobs will run to completion or timeout within the old container before process termination.
- Safe rollback requires waiting for in-flight jobs to drain, or accepting that in-progress tool handler HTTP calls may complete against container-manager after the worker process has been replaced.
- This risk is mitigated by **05C8** (AbortSignal propagation).

### Evidence of Successful Rollback

- `docker compose ps` shows ai-service as a newly created container (creation timestamp updated).
- Worker logs show `selectedPath: 'plain'` for all new job routing events.
- No `agent_harness.tool_dispatched` events appear in logs after rollback.

---

## 19. Final Activation Decision

**Verdict: NOT READY**

The harness loop must remain disabled. The four critical blockers and five high-severity findings documented in Section 16 must be resolved before any controlled activation.

**Accepted activation path:**
1. Resolve 05C5 through 05C10 in sequence.
2. First activation (05C11–05C12): read-only canary with only `read_file` and `list_files`.
3. Mutating tools (05C13–05C14): separate, explicitly approved phase after read-only canary passes.
4. `browser_smoke` (05C15): separate, explicitly approved phase.
5. Production canary and rollback validation (05C16): final phase.

---

## 20. No-Change and No-Runtime Confirmations

- No source files were modified during this review task.
- No runtime commands were executed (no tests, builds, Docker, APIs, queues, providers, or browser_smoke).
- `.env` files were not read or modified.
- `enableToolLoop` remains `false`.
- `enableBrowserSmoke` remains `false`.
- No tool handlers are reachable.

---

## 21. Next Task

**Register AGENT-HARNESS-05C5 — Session Ownership Enforcement**, registration only.

Do not begin implementation of 05C5 or any other prerequisite slice until the registration step is complete and explicitly approved.

---

> LOCKED — AGENT-HARNESS-05C4 is COMPLETE and LOCKED. Do not modify this entry.
