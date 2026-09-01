# AGENT-PLATFORM-EXEC-01C — Stage-Start / Cross-Service Contract Freeze / Bounded Child-Slice Decomposition

**Task ID:** AGENT-PLATFORM-EXEC-01C
**Title:** Persisted User-Agent Harness/Tool-Loop Contract and Safety Umbrella
**Step:** 2 — Stage-start / cross-service contract freeze / bounded child-slice decomposition
**Status:** COMPLETE (design / freeze only — no implementation)
**Date:** 2026-09-01
**Nature:** HIGH-RISK 4-step IMPLEMENTATION umbrella — Step 2 is governance documentation only
**Development program:** CURRENT
**Product-visible Harness capability:** FUTURE / gated / disabled / unavailable to users
**Stage-start document:** `docs/AGENT-PLATFORM-EXEC-01C-STAGE-START.md`
**Step 2 base HEAD:** `0aa3a7f496396d0a0f1583efa40999c32442f2a9` (branch `main`; HEAD == origin/main)
**Working tree at Step 2 open:** intentionally dirty from Step 1 (`TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json` only)

This is design only. No application source, tests, migrations, environment, package, compose, runtime, Docker, PostgreSQL, Redis, staging, provider-live, credit mutation, browser, Git commit, or Git push.

Child implementation tasks are **proposed in this document only**. They are **not** registered and **not** admitted.

---

## 1. Verdict

**PASS — cross-service contract FROZEN; child-slice decomposition COMPLETE; implementation NOT STARTED.**

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
CONTRACT_FREEZE=COMPLETE
CHILD_SLICE_DECOMPOSITION=COMPLETE
CHILD_TASKS_REGISTERED=0
IMPLEMENTATION_STARTED=NO
IMPLEMENTATION_ADMITTED=NO
UMBRELLA_ADMITTED=NO
PRODUCT_VISIBLE_HARNESS=FUTURE_GATED
AGENT_ID_PLUS_HARNESS_VERSION=STILL_REJECTED
HARNESS_FLAGS_CHANGED=NO
FRONTEND_HARNESS_VERSION_CHANGED=NO
SPECIALIST_HARNESS_CHANGED=NO
UNBOUND_BUILDER_HARNESS_CHANGED=NO
MUTATION_TOOLS_ENABLED=NO
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE_FINAL=UNOWNED
IMPLEMENTATION_MUTEXES_ACQUIRED=NONE
PROCEED_TO_CHILD_REGISTRATION=NO_UNTIL_KEITH_COMMITS_STEP2
```

| Flag | Value |
|---|---|
| First permissible product target | Read-only conversation Harness for an ownership-validated persisted user agent |
| First slice Ask-only | YES — `executionIntent` must be `conversation` |
| Mutation tools in first product-visible slice | FORBIDDEN |
| `search_workspace` | MUST NOT be advertised (schema-only, `enabled: false`, no dispatcher handler) |
| Silent Harness → single-shot downgrade | FORBIDDEN |
| Stub-provider canary as real-provider proof | FORBIDDEN |
| Prompt injection as runtime/audit identity | INSUFFICIENT |
| Config label / prompt as approval enforcement | INSUFFICIENT |
| Checkpoint creation as automatic rollback | NOT EQUIVALENT |
| Umbrella write set | remains `PROVISIONAL` / `admissionUncertain=true` |
| Child tasks | proposed IDs only; not canonical registrations |

Keith explicitly authorized this Step 2. This document does not reconsider the selected frontier and does not request further product-priority authorization.

---

## 2. Precondition record

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `0aa3a7f496396d0a0f1583efa40999c32442f2a9` |
| `origin/main` | `0aa3a7f496396d0a0f1583efa40999c32442f2a9` |
| Tree at Step 2 open | Dirty — exactly the three Step 1 files |
| `git diff --check` | clean |
| Step 1 registration | Present — canonical heading, `AISB_MACHINE_REG_V1`, sidecar candidate `READY` / `FORCING` / `PROVISIONAL` / `admissionUncertain=true` |
| Child candidate already exists | NO |
| EXEC-01C admitted | NO |
| Lane 1 | EMPTY |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| Governance at open | UNOWNED |
| Implementation mutexes | UNOWNED |
| `saturationSuspended` | `false` |
| Runtime authorization | all `false` |
| Preflight validator | PASS / `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` / EXEC-01C `ADMISSION_UNCERTAIN` |
| Other CURRENT REQUIRED conflict | NONE material — GOV-AUTH-03 COMPLETE AND LOCKED; PRIVATE-BETA-INVITE-01 remains PARKED |
| `git fetch` / `pull` / `checkout` / `reset` / `clean` / `commit` / `push` | NOT RUN |

Step 1 dirty files confirmed (and no others):

- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/control-plane/lane-saturation-state.json`

---

## 3. Authority and files inspected (read-only)

### 3.1 Scheduler / OS / living authority

| File | Method |
|---|---|
| `AGENTS.md` | Read — bootstrap |
| `CLAUDE.md` | Applied — OS / admission / mutex / GOV-OS-03 |
| `TASKS.md` CURRENT EXECUTION BOARD | Read — stop at LEGACY / FROZEN |
| `TASKS_BACKLOG_FULL.md` AGENT-PLATFORM-EXEC-01C body | Read |
| `docs/control-plane/lane-saturation-state.json` | Read |
| `docs/control-plane/mutex-catalog.json` | Read |
| `scripts/validate-lane-capacity.ps1` | Executed (proof outside repo) |
| `PRD.md` | Targeted — Builder, persisted user agents, Harness, tools, activation |
| `ARCHITECTURE.md` | Targeted — §§11–13 Harness, credits, checkpoints, identity, CURRENT vs FUTURE |

### 3.2 Locked predecessors and Harness evidence

| File | Method |
|---|---|
| `docs/AGENT-PLATFORM-EXEC-01A-CHECKPOINT.md` | Read |
| `docs/AGENT-PLATFORM-EXEC-01B-CHECKPOINT.md` | Read |
| `docs/GOV-AUTH-03-CHECKPOINT.md` | Read |
| `docs/GOV-OS-03-STAGE-START.md` | Targeted — stage-start freeze precedent; child registration not required |
| `docs/GOV-OS-03-CHECKPOINT.md` | Targeted |
| `docs/GOV-OS-03R1-CHECKPOINT.md` | Read — completeness; registering children would require sidecar candidates |
| `docs/AGENT-PLATFORM-CREATE-01A-STAGE-START.md` | Targeted — 4-step stage-start path/format |
| `docs/AGENT-PLATFORM-CREATE-01D-STAGE-START.md` | Targeted — Ask identity freeze precedent |
| `docs/AGENT-PLATFORM-CREATE-01E-STAGE-START.md` | Targeted — frontend freeze precedent |
| `docs/AGENT-HARNESS-06C-CHECKPOINT.md` | Targeted — stub `supportsToolUse=false` silent fallthrough |
| `docs/AGENT-HARNESS-06D-CHECKPOINT.md` | Targeted — `test-harness-stub` |
| `docs/AGENT-HARNESS-06D1-CHECKPOINT.md` | Targeted |
| `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Targeted — read-only E2E, stub provider |
| `docs/AGENT-HARNESS-WRITE-CANARY-B-CHECKPOINT.md` | Targeted — write E2E, stub provider, no delete canary |
| `docs/AGENT-HARNESS-07-CHECKPOINT.md` | Targeted — per-builder config; approval floors are config not runtime tokens |
| `ARCHITECTURE.md` §12.1 | Real-provider autonomous loop UNPROVEN; `search_workspace` NOT IMPLEMENTED; automatic rollback NOT IMPLEMENTED |

### 3.3 Gateway execute path

| File | Method |
|---|---|
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Read — DTO consumption, `agentId`+`harnessVersion` rejection, entitlement, `executionId`, enqueue |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Targeted — harness wiring, entitlement, `agentId`+`harnessVersion` HTTP 400 |
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Read — `AIExecutionRequest` includes `harnessVersion?` and `agentId?` |
| `services/api-gateway/src/queue/queue.service.ts` | Read — `enqueueExecution(jobData: any)`; `attempts: 1` |
| `services/api-gateway/src/auth/session-or-api-key.guard.ts` | Read — browser session identity omits `harnessEntitled` |
| `services/api-gateway/src/auth/api-key.config.ts` | Read — `harnessEntitled`; static `ai:harness` test key |
| `services/api-gateway/src/auth/api-key-auth.guard.ts` | Targeted — DB keys set `harnessEntitled` from `ai:harness` scope |
| `services/api-gateway/src/billing/credit-balance.guard.ts` | Read — pre-check only; no reservation |

### 3.4 AI Service worker / Harness / adapters / tools

| File | Method |
|---|---|
| `services/ai-service/src/queue/job.types.ts` | Read — **no `agentId` field** |
| `services/ai-service/src/ai-execution/types.ts` | Read — **no `executionId`, no `agentId`, no `harnessVersion`** |
| `services/ai-service/src/worker/worker.processor.ts` | Read — `useHarness`, silent adapter fallthrough, handler registration, finalize |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Read — loop, transcript options, audit `executionId: request.sessionId` |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Read — flags, `maxToolIterations: 3` |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | Read — including `search_workspace` |
| `services/ai-service/src/agent-harness/tools/tool-dispatcher.ts` | Read |
| `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.ts` | Read — write/delete execute immediately; no approval token |
| `services/ai-service/src/agent-harness/audit/harness-audit-events.ts` | Read |
| `services/ai-service/src/ai-execution/adapters/ai-adapter.interface.ts` | Read |
| `services/ai-service/src/ai-execution/adapters/adapter-tool-use.contracts.ts` | Read |
| `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts` | Read — maps tools **if provided**; does not filter fail-closed |
| `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts` | Read — `executeWithTools` ignores `toolResults` |
| `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` | Read — same |
| `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | Read — **no `supportsToolUse`, no `executeWithTools`** |
| `services/ai-service/src/ai-execution/adapters/groq-ai.adapter.ts` | Targeted — no tool-use |
| `services/ai-service/src/ai-execution/adapters/deepseek-ai.adapter.ts` | Targeted — no tool-use |
| `services/ai-service/src/ai-execution/adapters/stub-ai.adapter.ts` | Read — `supportsToolUse=false`; inert `executeWithTools` |
| `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` | Read — deterministic stub; ignores `toolResults` |
| `services/ai-service/src/agent-harness/model-profiles/model-profile.registry.ts` | Read — `supportsTools: false` on all listed profiles (schema-only vs adapter reality) |

### 3.5 Frontend

| File | Method |
|---|---|
| `frontend/components/workspace/workspace-execution-intent.logic.ts` | Read — helper returns `{ agentId }` only; never `harnessVersion` |
| `frontend/components/workspace/workspace-execution-intent.logic.test.ts` | Targeted — helper never includes `harnessVersion` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Targeted — execute sites omit `harnessVersion` |
| `frontend/components/platform/platform-dashboard.test.ts` | Targeted — panel source has no `harnessVersion` |
| `frontend/app/[locale]/app/page.tsx` | Targeted — spreads helper at both execute sites |

No `.env`, secret, credential, key, certificate, or token files were opened. No implementation file was edited.

---

## 4. Evidence classification legend

Use these labels in the findings and freeze. Do not treat a stronger label as implied by a weaker one.

| Class | Meaning |
|---|---|
| CURRENT implemented | Executable on the ordinary Builder Ask/Build path with flags at defaults |
| IMPLEMENTED BUT GATED | Code exists; requires `harnessVersion==='v1'` **and** `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` (and additional flags for mutation tools) |
| SCHEMA / REGISTRY ONLY | Typed metadata exists; not a runtime capability |
| STUB-ONLY EVIDENCE | Proven only with `test-harness-stub` / process-scoped flags; not a real provider |
| MISSING | Not implemented, or implemented in a way that does not satisfy the freeze |
| FROZEN BY STEP 2 | Normative decision for later children |
| ASSIGNED TO CHILD | Repository evidence cannot finish the decision; a named child must resolve it |
| ACTIVATION GATE | Must remain closed until a separately authorized activation |

---

## 5. Exact current execution-path findings

### 5.1 Gateway execute DTO, identity, rejection, `executionId`

`POST /api/ai/execute` (`AIExecutionController.execute`):

1. Validates `sessionId` UUID.
2. If `harnessVersion` is present, it must be the string `'v1'` else HTTP 400 `"harnessVersion must be 'v1' when provided"`.
3. If `harnessVersion` is present and `identity.harnessEntitled !== true`, HTTP 403 `"Forbidden"` **before** session lookup / ledger / enqueue.
4. Normalizes `executionIntent` (`undefined` → `workspace_mutation`).
5. Resolves provider/model.
6. Enforces session ownership (`getSessionById`; mismatch → 404).
7. `resolvePersistedUserAgentForAsk`: absent `agentId` skips; empty/non-string → 400; **`agentId` + any `harnessVersion` → HTTP 400 `"agentId is not supported when harnessVersion is provided"`**; else `findOneByIdAndUserId` (missing/cross-user/soft-deleted → 404).
8. Composes identity **only** as a prompt block onto `globalInstructions` (`Name` / `Role` / `Description`).
9. Creates canonical `executionId` with `uuidv4()`, except timeout/failed idempotent reuse of the existing row.
10. Writes `usage_records` metadata including `agentId` when a persisted agent was resolved. **Does not put `agentId` on the queue job.**
11. Enqueues `{ executionId, userId, sessionId, conversationId, provider, adapter, prompt, workspaceContext, model, globalInstructions, projectInstructions, requestId, submittedAt, executionIntent, optional harnessVersion, agentRole, builderProfileId, collaborationRunId, referralTraceId }`.
12. Returns HTTP 202 `{ executionId, status: 'queued' }`.

**Classification:** CURRENT implemented for Ask/Build `agentId`. Combination with `harnessVersion`: CURRENT fail-closed rejection. Harness entitlement: IMPLEMENTED BUT GATED on API-key `ai:harness` / `harnessEntitled`; **MISSING for browser sessions**.

### 5.2 Browser vs API-key entitlement

Browser session identity (`SessionOrApiKeyAuthGuard`) is:

```text
{ userId, apiKeyId: 'browser-session', scopes: ['ai:execute'], isInternal: true }
```

It does **not** set `harnessEntitled`. Existing controller tests prove `isInternal` and `ai:execute` are **not** substitutes. Therefore a bound-agent workspace user cannot currently pass the Gateway harness entitlement check even if the frontend later sent `harnessVersion`.

API-key path: `harnessEntitled` from `scopes.includes('ai:harness')` (DB keys) or the static `test-harness-api-key`.

Worker does **not** re-check entitlement.

**Classification:** IMPLEMENTED BUT GATED (API key); MISSING (browser product path); MISSING (worker).

### 5.3 Queue job and worker consumption

`AiExecutionJob` has `harnessVersion?`, builder/orchestration identity fields, and **no `agentId`**. Worker `buildAIExecutionRequest` copies `provider`, `sessionId`, `conversationId`, `userId`, `model` only. Persisted-agent identity reaches the model **only** via `globalInstructions` → `systemPrompt`.

`useHarness = job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop`.

Default `enableToolLoop` is `false`. With flags false, `harnessVersion: 'v1'` (if it ever reached the worker without `agentId`) **falls through to the plain single-shot path**. That is CURRENT gated behavior and is also a **silent downgrade** of a requested Harness execution.

When `useHarness` is true:

- If `adapter.supportsToolUse && adapter.executeWithTools`, the worker builds a dispatcher and calls `executeAgentHarnessLoop`.
- **Else it calls `this.aiExecutionService.execute(executionRequest)`** — silent single-shot. Locked 06C/06D evidence records this for `stub`.

`xai`, `groq`, and `deepseek` adapters have no `supportsToolUse` / `executeWithTools`. xAI is the proven private-beta Builder provider (LIVE-11) and would currently silent-downgrade a requested Harness job.

**Classification:** IMPLEMENTED BUT GATED loop entry; MISSING fail-closed unsupported-provider behavior; MISSING job-level `agentId`.

### 5.4 Harness loop, tools, advertisement, transcripts

Loop (`executeAgentHarnessLoop`):

- Hard ceiling `maxToolIterations` (default **3**).
- Termination: `completed` (no tool_calls), `no_dispatcher`, `max_iterations`, `aborted`.
- On tool_calls, passes **only** `{ toolResults: priorToolResults }` into `executeFn`. **Never passes `tools`.**
- Worker `executeFn` is `(req, opts) => adapter.executeWithTools!(req, opts)` with **no advertised-tool list**.
- Therefore OpenAI/Anthropic `executeWithTools` currently send **no tools** unless a caller supplies `options.tools` (the worker does not).
- OpenAI and Anthropic **ignore `options.toolResults`**. Each iteration rebuilds `system + single user message` from `request.prompt`. Assistant `tool_calls` / `tool_use` blocks are parsed but **not replayed**. Tool-result messages are **not** appended. callId correlation is parsed inbound and returned from the dispatcher, then dropped by the next provider request.
- Stub `TestToolCapableStubAdapter` sequences calls by internal `callIndex` and ignores `toolResults`. That is STUB-ONLY EVIDENCE of loop/dispatcher/file HTTP, not provider-native transcript handling.
- Malformed OpenAI tool arguments: `tryParseToolArgumentsToObject` returns `{}` on JSON failure (does not fail the call as malformed).
- Unknown tool names: dispatcher `TOOL_NOT_FOUND`; loop continues.
- Provider errors: thrown from `executeFn`; loop records `harness.model_invocation_failed` then **rethrows**; worker retry loop may retry the **entire** loop (up to `EXECUTION_PROVIDER_RETRY_ATTEMPTS`, default 3) including mutating tools if those flags were on.
- Max-loop result output is a canned string; `model: ''`; still goes through ledger complete + finalize-accounting if status is completed.
- Audit `baseEvent().executionId` is **`request.sessionId`**, not the Gateway `executionId`. Tests currently expect `sessionId: 'sess-1'` and do not assert a distinct execution id. This is MISSING canonical `executionId` semantics.

Dispatcher handlers actually registered by the worker when flags allow:

| Tool | Registry `enabled` | `implementationStatus` | Handler registered when | Approval at runtime |
|---|---|---|---|---|
| `list_files` | true | implemented | always on harness path | no (`requiresApproval: false`) |
| `read_file` | true | implemented | always on harness path | no |
| `write_file` | true | implemented | `enableWriteTools` | **no executable approval** despite `requiresApproval: true` |
| `delete_file` | true | implemented | `enableWriteTools` | **no executable approval** |
| `run_validation` | true | implemented | `enableValidationTools` | `requiresApproval: false` in registry; command allow-list only |
| `browser_smoke` | **false** | implemented | `enableBrowserSmoke` (config default **hardcoded false**; `createAgentHarnessConfigV1` does **not** read `AGENT_HARNESS_ENABLE_BROWSER_SMOKE`) | no |
| `start_preview` | false | planned | never | n/a |
| `search_workspace` | **false** | **planned** | **never** | n/a |

`listEnabledAgentHarnessToolDefinitions()` would include `write_file` / `delete_file` / `run_validation` because registry `enabled: true` even when env flags are false. Advertisement must **not** use that helper alone.

Mapper `mapAgentHarnessToolDefinitionsToAdapterToolDeclarations` copies `enabled` / `implementationStatus` but **does not drop** disabled, planned, or handler-less tools.

Write/delete handlers call Gateway/CM workspace HTTP (`writeWorkspaceFile` / `deleteWorkspaceFile`) **directly**. They do **not** use the frontend Build file-action apply pipeline.

Pre-apply checkpoint: if `enablePreApplyCheckpoint` (default true) and a `write_file`/`delete_file` appears in the tool-call batch, worker asks Gateway `createWorkspaceCheckpoint(sessionId, 'Pre-apply checkpoint (Agent Harness)')`. Hash may be stored in usage metadata `preApplyCheckpointHash`. Checkpoint failure converts **that batch** into tool-error payloads and continues the loop. **No automatic revert.**

**Classification:** loop + read handlers IMPLEMENTED BUT GATED; write/delete handlers IMPLEMENTED BUT GATED and STUB-ONLY EVIDENCE; advertisement fail-closed MISSING; provider-native transcript MISSING for all real providers; `search_workspace` SCHEMA ONLY; approval MISSING as executable behavior.

### 5.5 Credits and accounting

`CreditBalanceGuard`: read-only `balance > 0` (admins bypass). **No reservation, no lock, no Harness-specific check.**

Worker `notifyExecutionComplete(executionId)` → Gateway finalize-accounting:

- persisted `conversation` → deduct now (`sourceEventId = executionId`)
- `workspace_mutation` → skip (`build_awaiting_apply`) until qualifying confirm-build-apply
- failed / cancelled / non-completed → no deduct

Harness does not currently persist a distinct accounting intent. If a Harness job used `executionIntent: 'conversation'`, a **completed** loop (including max-iterations canned completion) would currently deduct like Ask: **one deduction per `executionId`**, using cumulative `tokensUsed` from the loop. Tool calls have no extra ledger events. Unsupported-provider silent downgrade would also complete and deduct as ordinary single-shot.

Failed-provider throws typically mark the job failed → no deduct. Cancellation/timeout follow existing worker SQL. Duplicate Ask finalize is idempotent on `executionId`.

This is **not** proven safe for multi-turn Harness, partial loops, or mutation tools that bypass confirm-build-apply.

**Classification:** Ask/Build accounting CURRENT; Harness accounting UNPROVEN / MISSING as a defined unit; no reservation.

### 5.6 Frontend

`buildPersistedUserAgentAskRequestFields` returns `{ agentId }` or `{}`. Tests lock: helper output never includes `harnessVersion`; shell/page execute sites omit `harnessVersion`; platform panel has no `harnessVersion`. Bound Ask and Build both send `agentId` (EXEC-01B). Unbind clears id. Specialists are not this path. Ordinary unbound Builder is unchanged.

**Classification:** CURRENT implemented; frontend Harness activation MISSING (correctly).

### 5.7 Canaries

| Evidence | Provider | Proves |
|---|---|---|
| Unit tests (loop, dispatcher, adapters, gates) | none / mocked | deterministic code |
| AGENT-HARNESS-06C | stub (`supportsToolUse=false`) | route evaluation only; loop **not** entered |
| AGENT-HARNESS-06D / 06E | `test-harness-stub` | live worker loop + `list_files`/`read_file` HTTP; zero paid tokens |
| WRITE-CANARY-B | `test-harness-stub` write mode | gated `write_file` + pre-apply checkpoint; **not** real provider; no delete canary |
| Real OpenAI/Anthropic/xAI native transcript | **UNPROVEN** | ARCHITECTURE §12.1 |

---

## 6. Frozen cross-service contract

These decisions are binding on later children. They do not activate product-visible Harness. They do not change flags, frontend, or the existing Gateway rejection in this window.

### A. Initial read-only Harness boundary

**FROZEN**

| Topic | Frozen decision |
|---|---|
| First permissible product target | Read-only conversation Harness for one ownership-validated persisted user agent |
| Intent | **Ask-only.** `executionIntent` must be `'conversation'`. `workspace_mutation` + `harnessVersion` remains rejected |
| Who | Authenticated user who owns the persisted agent **and** owns the session |
| Session / project | Existing required `sessionId` UUID; session must belong to the caller; execution uses that session’s existing project/workspace. No new session type. No dedicated agent runtime |
| Conversation id | Existing required `conversationId` plumbing; no new conversation store |
| Loop limit | `maxToolIterations = 3` (current default). Later change requires a named child, not silent raise |
| Turn / tool-result budgets | Current `maxToolResultBytes`, `maxFileReadBytes`, `toolTimeoutMs` remain the v1 ceilings until a named child changes them |
| Allowed tools (first product-visible slice) | `list_files`, `read_file` only, and only when the advertisement rule in B is satisfied |
| Forbidden in first slice | `write_file`, `delete_file`, `run_validation`, `browser_smoke`, `start_preview`, `search_workspace`, any shell, any other registry tool |
| Termination | Success: model `finishReason` is not `tool_calls` (or empty toolCalls) → return assistant output; job `completed`. Max iterations: fail closed as a **failed** Harness execution, not a successful canned “completed” Ask (this **changes** current loop behavior that returns a completed canned string). Abort/cancel/timeout: existing worker cancelled/timeout statuses. Dispatcher must exist on the Harness path; `no_dispatcher` is not a product-success outcome |
| Failure | Fail the job. Do not return ordinary single-shot Builder output. Do not apply file actions from a Harness conversation |
| Result shape | Existing GET/SSE execution result: `executionId`, status, output, tokens, model/provider, no mutation fileActions for this slice. Harness metadata required: `terminationReason`, `iterationsUsed`, `toolCallsReceived`, canonical `executionId`, `agentId` |
| Flags remain false | `AGENT_HARNESS_ENABLE_TOOL_LOOP` and mutation flags stay **false** until separately authorized activation. A requested `harnessVersion` while the loop flag is false is **fail-closed**, not silent plain execution (this **changes** current worker routing). Frontend still must not send `harnessVersion` until L |
| Specialists / unbound Builder | Out of scope. No specialist Harness. No ordinary unbound Builder Harness product path |

### B. Tool advertisement

**FROZEN — fail-closed.**

A tool may be advertised to a provider **only if all** are true in the same execution:

1. Present in `AGENT_HARNESS_TOOL_DEFINITIONS_V1`
2. `implementationStatus === 'implemented'`
3. Registry `enabled === true` **and** the matching runtime gate is on for this execution (`enableWriteTools` / `enableValidationTools` / `enableBrowserSmoke` / read-only tools need only the loop path)
4. A real dispatcher handler is registered for that exact name
5. Permitted by entitlement and agent/tool policy for this execution (first slice: read-only tools only; no mutation entitlement)
6. Selected provider adapter implements native tool protocol (`supportsToolUse === true` **and** `executeWithTools` consumes both `tools` and `toolResults`)
7. Covered by required tests for advertisement inclusion/exclusion

Otherwise the tool must not appear in `options.tools`.

The worker must pass the advertised list on **every** model invocation, including turn 0.

**`search_workspace`:** MUST NOT be advertised. It is schema-only (`implementationStatus: 'planned'`, `enabled: false`, no handler). Semantic search remains disabled (`enableSemanticSearch: false`). A later child may implement it; this freeze does not.

`listEnabledAgentHarnessToolDefinitions()` is **not** a sufficient advertisement source.

If the resulting advertised set is empty on a requested Harness execution, fail closed (do not call the provider with a tool-less “Harness” that is actually single-shot).

### C. Provider-native transcripts

**FROZEN**

Required native transcript for a supporting provider:

1. Persist the assistant message that contains tool-call output (OpenAI `tool_calls` / Anthropic `tool_use` blocks), including **call ids**
2. After dispatch, append tool-result messages correlated by those call ids (`role: tool` + `tool_call_id` on OpenAI-compatible; Anthropic `tool_result` content blocks referencing `tool_use_id`)
3. Send the full accumulated native transcript on the next `executeWithTools` request, not a rebuilt single user prompt
4. Multiple tool calls in one model turn must all be executed (subject to budgets) and all results returned in one follow-up
5. Malformed tool calls (unparseable arguments, missing id): do not execute a guessed empty `{}` mutation; return a typed tool error on that call id; continue the loop only for read-only first slice
6. Unknown tool names: `TOOL_NOT_FOUND` result on that call id; do not invent a handler
7. Provider HTTP/SDK errors: fail the execution (retry only for existing retryable classes **without** duplicating executed tools; first slice is read-only so retry is allowed only if no non-idempotent side effect occurred)
8. Max-loop: fail closed as failed Harness; do not present canned success as a normal Ask completion

**Current gaps (do not treat as implemented):**

| Path | Inbound parse of tool calls | Advertise tools from worker | Append assistant tool-call + tool results | Multi-call | Real-provider canary |
|---|---|---|---|---|---|
| OpenAI-compatible (`openai-ai.adapter.ts`) | YES (unit) | NO (worker never passes `tools`) | **NO** (`toolResults` ignored) | parse YES / round-trip NO | UNPROVEN |
| Anthropic | YES (unit) | NO | **NO** | parse YES / round-trip NO | UNPROVEN |
| xAI/Grok | **NO `executeWithTools`** | NO | **NO** | NO | UNPROVEN (and must fail closed) |
| groq / deepseek | NO | NO | NO | NO | fail closed if Harness requested |
| `stub` | inert completed / empty toolCalls | n/a | NO | n/a | not a Harness proof |
| `test-harness-stub` | synthetic sequence | ignored | **NO** (counter, not transcript) | synthetic | STUB-ONLY |

### D. Unsupported-provider behavior

**FROZEN — fail closed. No silent downgrade.**

If the selected provider adapter cannot correctly advertise tools **and** consume tool results natively, a requested Harness execution (`harnessVersion === 'v1'`) MUST fail.

Includes **xAI/Grok** explicitly (current Builder default/live path). Also groq, deepseek, `stub`.

Do **not** advertise tools to an adapter that cannot process them.

**API/job failure boundary (partially FROZEN; exact public error class ASSIGNED TO CHILD `AGENT-PLATFORM-EXEC-01C1` / error-contract sub-AC):**

- Gateway may continue to return 202 after enqueue for providers that are **declared** capable; worker then fails the job (`execution_status=failed`) if the adapter is actually incapable.
- Prefer **pre-enqueue Gateway 400** when the selected provider is known-incapable (xAI/groq/deepseek/stub) **once** Gateway is allowed to accept `agentId`+`harnessVersion` at all. Until that child lands, the combination remains 400 for a different reason (today’s rejection).
- User-safe class: do not leak stack traces; do not claim the model “answered” via single-shot. Exact code/message/i18n key is **ASSIGNED TO CHILD** because no current public DTO defines `HARNESS_UNSUPPORTED_PROVIDER`.

### E. Persisted-agent identity propagation

**FROZEN**

`agentId` is ownership-scoped persisted `user_agents.id`. It is not `agentRole`, `builderProfileId`, or a new auth principal.

Required chain for a Harness execution (all must carry the **same** owner-validated id, or the job fails):

1. Authenticated Gateway request (`agentId` string)
2. Ownership validation `findOneByIdAndUserId` **before** ledger/enqueue (existing)
3. Composed identity instructions (existing prompt block) — **necessary but not sufficient**
4. Queue payload **must include `agentId`** (MISSING today — frozen as required)
5. Worker input / `AiExecutionJob.agentId`
6. Harness execution context and `AIExecutionRequest` (or equivalent explicit field — not only `systemPrompt`)
7. Tool/audit events (`agentId` on audit base; today MISSING)
8. Final job metadata and GET response metadata (`agentId` already written at intent; must be preserved and not overwritten; worker finalization must not drop it)

Fail closed if `agentId` is missing, mismatched, or not owner-validated when Harness is requested for a persisted agent.

Prompt injection alone is **not** runtime identity and **not** audit identity.

### F. `executionId` semantics

**FROZEN**

| Topic | Frozen decision |
|---|---|
| Canonical creator | **API Gateway** on execute (`uuidv4()`, or reuse of the same row on timeout/failed idempotent retry) |
| Lifetime | One `executionId` spans the whole Harness loop: all model turns, tool calls, audits, SSE, ledger, finalize-accounting |
| Correlation | Queue `job.data.executionId` = ledger `execution_id` = SSE channel = `sourceEventId` for credits = audit `executionId` |
| Also correlate | `userId`, `sessionId`, `conversationId`, persisted `agentId` |
| Audit | Must use Gateway `executionId`. **Forbidden** to set audit `executionId` from `sessionId` |
| Regeneration | Audit/tool events must not mint a new id per turn |
| Retry | Provider retries stay under the same `executionId`. A new execute request without idempotent reuse gets a new id |
| Uniqueness | Existing ledger uniqueness; fail closed on collision |
| Final metadata | Must include canonical `executionId` (already the record key) plus Harness fields in §A |

Passing `executionId` into `buildAIExecutionRequest` / loop `baseEvent` is required work (MISSING today).

### G. Entitlements

**FROZEN**

| Topic | Frozen decision |
|---|---|
| Who may request persisted-agent Harness | Authenticated **owner** of the agent, on an owned session, Ask-only, after backend gates in this freeze exist. Not specialists. Not unbound Builder. Not anonymous |
| Gateway check | Required whenever `harnessVersion` is present (`harnessEntitled === true` today). Product-visible browser users **cannot** pass this until a child sets an explicit browser-session entitlement |
| Worker check | Required as fail-closed defense in depth (MISSING today). Stale/missing entitlement → fail job, no loop, no tools |
| Missing / stale | Fail closed (403 at Gateway if detectable before enqueue; failed job if only detectable later) |
| Read-only vs mutation | Separate entitlements. Read-only first slice does **not** grant write/delete/validation/browser tools. Mutation flags remaining false is not a substitute for a mutation entitlement check later |
| `isInternal` | Not an entitlement |

**ASSIGNED TO CHILD `AGENT-PLATFORM-EXEC-01C5`:** how browser-session `harnessEntitled` is granted (user flag, plan, allow-list, or other) without using `isInternal`. Step 2 does not invent a new billing plan.

### H. Credits and accounting

**FROZEN for the first read-only slice; remaining edges ASSIGNED TO CHILD `AGENT-PLATFORM-EXEC-01C5`.**

Do **not** assume current single-shot Build (`workspace_mutation` + confirm-build-apply) accounting applies. First slice is Ask-only.

| Topic | Frozen for read-only conversation Harness | Assigned to 01C5 if needed |
|---|---|---|
| Reservation | None in v1 (same as current Ask: `CreditBalanceGuard` pre-check only) | Whether Harness needs a true reservation |
| Charge unit | **One completed Harness execution = one deduction keyed by `executionId`** (Ask-like), using **cumulative** `tokensUsed` across loop turns | Token-to-credit formula if it must differ from Ask |
| Tool-call extra charges | **None** in the read-only slice | — |
| Failed provider / unsupported provider / flags-false reject | **No deduction** (non-completed) | Exact failed-status mapping |
| Partial loop then failed | No deduction if status is not `completed` | If max-iterations is failed (A), no charge |
| Cancellation / timeout | No deduction (existing) | — |
| Retry / idempotency | `sourceEventId = executionId` remains the idempotency key | Interaction with in-worker provider retries |
| Final accounting owner | Gateway `triggerDeductionForExecution` after worker notify, unchanged owner | — |

No credit mutation or provider-live experiment in Step 2.

### I. Approval enforcement before mutation

**FROZEN — activation requirement for any mutation tool. Not in the first product-visible slice.**

No persisted-agent mutation tool (`write_file`, `delete_file`, `run_validation`, `browser_smoke` if it can cause side effects, `start_preview`) may become available until **executable** runtime approval exists for that tool class.

Registry `requiresApproval`, prompt text, builder-profile “approval floors”, and audit event type `tool-approved` **do not count**.

Current write/delete handlers execute immediately when registered. That is **not** approval.

Later mutation children must freeze, with tests:

- approval identity (owning user)
- approval scope (tool + path/command + executionId)
- expiry or one-use
- audit evidence of grant **before** handler I/O
- fail closed if missing/expired/mismatched

`run_validation` is treated as mutation-class for this freeze even though the registry tags it `read-only` (it runs commands). `browser_smoke` is treated as mutation-class until a later child proves it cannot cause side effects.

### J. Rollback and recovery

**FROZEN — activation requirement for mutation tools. Not in the first product-visible slice.**

| Topic | Frozen truth |
|---|---|
| Existing checkpoint guarantee | Manual create/list/diff/revert of workspace files via session checkpoint APIs. **Automatic rollback is NOT IMPLEMENTED** (ARCHITECTURE §11.5 / §12.2) |
| How Harness mutates today | Direct Gateway/CM file HTTP from tool handlers, **not** the frontend Build apply path |
| Pre-mutation checkpoint | Gated path can create a checkpoint before first `write_file`/`delete_file`; hash may be stored as `preApplyCheckpointHash` |
| Correlation with `executionId` | **MISSING** beyond a generic description string; frozen as required before mutation activation |
| Partial tool-loop failure | No automatic revert; checkpoint creation failure currently skips mutating that batch and continues |
| Automatic rollback | MUST exist before mutation activation, or mutation remains disabled. Creating a checkpoint is not rollback |
| Manual recovery | Existing revert remains required as a backup; not sufficient alone for activation |
| First read-only slice | No workspace mutation; no new rollback requirement to ship read-only (still must not register mutation handlers) |

### K. Provider canaries

**FROZEN — minimum later evidence. None run in Step 2.**

| Class | Required before | Notes |
|---|---|---|
| Deterministic unit tests | each implementation child LOCK | include negative advertisement, unsupported provider, executionId ≠ sessionId, agentId on job |
| Stub-provider canaries | useful for dispatcher/HTTP wiring | **not** sufficient for activation |
| Local integration | before real-provider canary | flags still process-scoped; no product frontend |
| Real provider-native transcript canaries | before product-visible activation | OpenAI **and/or** Anthropic, whichever is selected for first activation; must show tool-call → tool-result → follow-up |
| Unsupported-provider negative canaries | before activation | **xAI/Grok required**; also stub |
| Credit/accounting canaries | before activation | one `executionId` one charge; fail → no charge |
| Identity/audit correlation | before activation | `executionId` + `agentId` on audit and final metadata |
| Mutation approval + rollback canaries | only before mutation activation | after read-only proven |
| Staging | **not** required to freeze or to start children; **not** claimed by EXEC-01A/01B | ASSIGNED if a later activation task demands it |

No provider-live, runtime, staging, or browser work in Step 2.

### L. Frontend activation

**FROZEN as the final dependent slice among the read-only children.**

- Frontend must **not** send `harnessVersion` until all required backend/runtime gates for the authorized read-only capability pass **and** a separately authorized activation allows it.
- Preserve current frontend behavior: bound Ask+Build `agentId`, no `harnessVersion`, tests that omit it remain required until activation inverts them deliberately.
- No specialists. No ordinary unbound Builder Harness. No mutation tools.
- Explicit rollback/disable: stop sending `harnessVersion`; keep Gateway rejection or worker flag false as independent kills; restore tests that omit `harnessVersion`.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` remains **false** until separately authorized activation. Frontend activation child must not flip env flags.

---

## 7. Unresolved gaps / blockers

These are frozen as **child work**, not as “already implemented.”

| ID | Gap | Blocks | Keith needed now? |
|---|---|---|---|
| G1 | Worker silent single-shot when adapter has no tool-use | D, A flags-false | NO — freeze is fail closed |
| G2 | Worker never passes `tools` into `executeWithTools` | B, C | NO |
| G3 | OpenAI/Anthropic ignore `toolResults` / no native transcript | C | NO |
| G4 | xAI/Grok has no `executeWithTools` | D | NO — fail closed |
| G5 | `agentId` not on queue/worker/audit | E | NO |
| G6 | Audit `executionId` is `sessionId` | F | NO |
| G7 | Browser session has no `harnessEntitled` | G, L | **YES at child 01C5 registration** — grant mechanism |
| G8 | Exact user-safe Harness error code/message | D | NO — child 01C1 defines; i18n at 01C7 |
| G9 | Harness accounting beyond “one Ask-like charge per executionId” | H | NO unless 01C5 finds a PRD conflict |
| G10 | No executable mutation approval | I | NO — mutation after read-only |
| G11 | No automatic rollback | J | NO — mutation after read-only |
| G12 | Real-provider transcript UNPROVEN | K | NO — canary child; provider-live needs later authorization |
| G13 | `queue.service.ts` pre-existing TS2322 | out of scope | NO — do not repair in this program unless a child is explicitly expanded |
| G14 | Model-profile `supportsTools: false` vs adapter `supportsToolUse=true` | B | NO — advertisement must use adapter capability, not the stale profile flag, until a child reconciles profiles |

**No Step 2 blocker requires Keith to stop this freeze.** The only deferred Keith choice is **G7** (browser-session entitlement grant) at 01C5 registration, not in this window.

---

## 8. Bounded child-slice table

Proposed stable identifiers follow the EXEC family + numeric suffix used by locked Harness children (`AGENT-HARNESS-05C1`, `AGENT-PLATFORM-07C1`). Repo search found **no** existing `AGENT-PLATFORM-EXEC-01C1`…`01C9` headings.

**None of these are registered. None are admitted. Write paths are prospective, evidence-backed, and remain unfrozen as machine EXACT write sets until a later registration window.**

GOVERNANCE is **not** listed on any implementation child.

### 8.1 AGENT-PLATFORM-EXEC-01C1 — Foundational types and fail-closed Harness routing

| Field | Value |
|---|---|
| Title | Foundational types and fail-closed Harness routing |
| Purpose | Make a requested Harness execution fail closed when the loop flag is false or the adapter cannot run tools; thread canonical `executionId` into the loop/audit; add job/request fields needed later (`agentId`, `executionId`) without enabling flags or lifting the Gateway combination rejection |
| Depends on | EXEC-01C Step 2 freeze (this document). EXEC-01A/01B/GOV-AUTH-03 LOCKED |
| Order | **1** |
| In scope | `job.types.ts` optional `agentId`; `AIExecutionRequest` `executionId` (and `agentId` if required for audit); worker: no silent `aiExecutionService.execute` fallthrough when `harnessVersion==='v1'`; loop `baseEvent.executionId` from Gateway id not `sessionId`; tests for flags-false fail-closed and unsupported adapter fail-closed; define internal error codes for G8 |
| Out of scope | Gateway `agentId`+`harnessVersion` allow; frontend; env flag true; tool advertisement list; native transcripts; credits; mutation; provider-live |
| Mutexes | **AI-SERVICE** |
| Prospective writes | `services/ai-service/src/queue/job.types.ts`; `services/ai-service/src/ai-execution/types.ts`; `services/ai-service/src/worker/worker.processor.ts`; `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts`; corresponding `*.spec.ts` |
| Shared contracts | `AiExecutionJob`, `AIExecutionRequest`, Harness audit `executionId` meaning |
| Migration | NO |
| Runtime / provider-live / staging / browser / credit | NO / NO / NO / NO / NO |
| Evidence | LOCAL-TESTS |
| Activation effect | NONE (flags false; Gateway still rejects combo) |
| Rollback | revert AI-SERVICE files; restore silent fallthrough only by reverting this child |
| Separate registration/admission window | **YES** |

### 8.2 AGENT-PLATFORM-EXEC-01C2 — Provider capability and tool advertisement

| Field | Value |
|---|---|
| Title | Provider capability and fail-closed tool advertisement |
| Purpose | Advertise only tools that pass rule B; pass `tools` on every `executeWithTools`; empty advertised set or incapable adapter fails closed; freeze `search_workspace` unpublished |
| Depends on | **01C1** |
| Order | **2** |
| In scope | Worker advertised-tool builder; mapper/filter; tests that disabled/planned/handler-less/`search_workspace`/mutation tools are absent when flags false; xAI/groq/deepseek/stub fail closed when Harness requested |
| Out of scope | Native transcript assembly; Gateway combo allow; frontend; enabling write flags; implementing `search_workspace` |
| Mutexes | **AI-SERVICE** |
| Prospective writes | `services/ai-service/src/worker/worker.processor.ts`; `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts`; `services/ai-service/src/agent-harness/tools/tool-registry.ts` only if a filter helper is required (prefer not to flip `search_workspace` enabled); specs under `adapters/__tests__` and `tools/__tests__` |
| Shared contracts | `AIAdapterToolUseRequestOptions.tools`; advertisement rule B |
| Migration | NO |
| Runtime / provider-live / staging / browser / credit | NO / NO / NO / NO / NO |
| Evidence | LOCAL-TESTS |
| Activation effect | NONE |
| Rollback | revert advertisement; tools remain unadvertised |
| Separate registration/admission window | **YES** |

### 8.3 AGENT-PLATFORM-EXEC-01C3 — Provider-native tool transcripts

| Field | Value |
|---|---|
| Title | OpenAI and Anthropic native tool-call/tool-result transcripts |
| Purpose | Implement freeze C for OpenAI-compatible and Anthropic adapters; keep xAI fail closed |
| Depends on | **01C2** |
| Order | **3** |
| In scope | `openai-ai.adapter.ts` and `anthropic-ai.adapter.ts` `executeWithTools`: persist assistant tool calls, append tool results by call id, send accumulated transcript; malformed/unknown-tool behavior; unit tests with recorded message arrays. Optionally share helpers for future OpenAI-compatible providers **without** enabling xAI |
| Out of scope | Implementing xAI/Grok tool protocol; stub as proof; Gateway; frontend; mutation tools; paid provider calls |
| Mutexes | **AI-SERVICE** |
| Prospective writes | `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts`; `anthropic-ai.adapter.ts`; `adapter-tool-use.contracts.ts` if transcript state must be typed; `adapter-tool-use.mapper.ts` if needed; matching specs |
| Shared contracts | `AIAdapterToolUseRequestOptions.toolResults`; provider message transcript |
| Migration | NO |
| Runtime / provider-live / staging / browser / credit | NO / NO / NO / NO / NO |
| Evidence | LOCAL-TESTS (fixture HTTP; no live keys) |
| Activation effect | NONE |
| Rollback | adapters return to current ignore-`toolResults` behavior |
| Separate registration/admission window | **YES** |

Why this is after 01C2: advertising tools without a transcript still cannot complete a real loop; implementing transcript without advertisement still never sends tools. Evidence requires both; they stay separate so adapter vs worker routing stays reviewable.

### 8.4 AGENT-PLATFORM-EXEC-01C4 — Persisted identity and canonical audit correlation

| Field | Value |
|---|---|
| Title | Persisted `agentId` on Harness jobs and audit/final metadata |
| Purpose | Lift **only** the Gateway `agentId`+`harnessVersion` rejection for **conversation** + owner-validated agent + entitled identity; put `agentId` on the queue; require worker/audit/final metadata to carry it; keep mutation intent rejected; keep flags false |
| Depends on | **01C1** (job field + fail-closed routing). Should follow **01C2** so an entitled conversation Harness request cannot silent-downgrade or advertise illegal tools. May proceed in parallel with **01C3** only after 01C2 if pairwise mutexes allow (both need AI-SERVICE if worker also asserts `agentId`; this child is **GATEWAY-primary**) |
| Order | **4** (after 01C1; after 01C2 recommended) |
| In scope | `ai-execution.controller.ts` + spec: allow `agentId`+`harnessVersion` **only** for `conversation`; still 400 for `workspace_mutation`+`harnessVersion`; enqueue `agentId`; tests that combination no longer 400 in the conversation case **for entitled identities**; still 403 without entitlement; still 404 cross-user |
| Out of scope | Setting browser `harnessEntitled`; frontend `harnessVersion`; env flags; mutation; specialists; unbound Builder; `queue.service.ts` TS2322 repair |
| Mutexes | **GATEWAY** |
| Prospective writes | `services/api-gateway/src/ai/ai-execution.controller.ts`; `services/api-gateway/src/ai/ai-execution.controller.spec.ts` |
| Shared contracts | Execute DTO combination rule; `AiExecutionJob.agentId` |
| Migration | NO |
| Runtime / provider-live / staging / browser / credit | NO / NO / NO / NO / NO |
| Evidence | LOCAL-TESTS |
| Activation effect | NONE for users (frontend still omits `harnessVersion`; browser still 403) |
| Rollback | restore combination HTTP 400 |
| Separate registration/admission window | **YES** |

If worker-side `agentId` assertions are still open after 01C1, a **tiny 01C4b** AI-SERVICE follow-up may be registered later rather than combining GATEWAY+AI-SERVICE in one admission.

### 8.5 AGENT-PLATFORM-EXEC-01C5 — Entitlement and accounting semantics

| Field | Value |
|---|---|
| Title | Browser-session Harness entitlement and read-only accounting |
| Purpose | Make product-path identities able to pass a real `harnessEntitled` check without treating `isInternal` as entitlement; lock Ask-like one-charge-per-`executionId` for completed conversation Harness; no charge on fail/unsupported |
| Depends on | **01C4** (combination allow exists to test); **01C1** (failed jobs do not complete) |
| Order | **5** |
| In scope | Session identity `harnessEntitled` grant mechanism (Keith decision at **this child’s registration**); worker defense-in-depth if still missing; usage-ledger tests that conversation Harness completed → one deduction, failed → none; do not change Build apply accounting |
| Out of scope | Stripe; new credit tables unless evidence forces a migration (expected **NO**); mutation accounting; provider-live charges |
| Mutexes | **GATEWAY** (auth + usage-ledger). If worker entitlement check remains, a separate AI-SERVICE child must be split rather than dual-mutex this slice |
| Prospective writes | `services/api-gateway/src/auth/session-or-api-key.guard.ts`; `session-or-api-key.guard.spec.ts`; `ai-execution.controller.spec.ts`; `usage-ledger` tests; controller only if entitlement error mapping changes |
| Shared contracts | `ApiKeyIdentity.harnessEntitled`; `sourceEventId=executionId` |
| Migration | Expected NO; if a user-flag column is chosen at registration, **MIGRATION** mutex is added then — not assumed now |
| Runtime / provider-live / staging / browser / credit | NO / NO / NO / NO / **tests only, no live mutation** |
| Evidence | LOCAL-TESTS |
| Activation effect | NONE until frontend+flags |
| Rollback | remove browser entitlement; 403 remains |
| Separate registration/admission window | **YES** (Keith G7) |

### 8.6 AGENT-PLATFORM-EXEC-01C6 — Read-only provider canary

| Field | Value |
|---|---|
| Title | Read-only Harness canary (stub then real-provider transcript) |
| Purpose | Prove K for read-only: stub wiring **and** at least one real native-transcript canary; xAI negative canary; identity/audit/`executionId`; Ask-like accounting on a non-prod path |
| Depends on | **01C3**, **01C4**, **01C5** |
| Order | **6** |
| In scope | Canary scripts/docs under `services/ai-service/scripts` / `docs/`; process-scoped flags; disposable workspace; **no** frontend `harnessVersion`; **no** product flag default change |
| Out of scope | Product activation; mutation canaries; staging unless later expanded; flipping repo `.env` examples |
| Mutexes | **AI-SERVICE** for scripts if they change; **LOCAL-RUNTIME** and **PROVIDER-LIVE** / **CREDIT** only if that registration explicitly authorizes them (expected for the real-provider half) |
| Prospective writes | canary scripts; canary docs; possibly worker test harness only |
| Shared contracts | none new |
| Migration | NO |
| Runtime / provider-live / staging / browser / credit | **YES local** for stub; **YES provider-live** only if Keith authorizes that registration; staging NO by default; browser NO; credit only if provider-live authorized |
| Evidence | LOCAL-RUNTIME then PROVIDER-LIVE (split inside the child AC; do not treat stub as the live AC) |
| Activation effect | NONE |
| Rollback | disable process-scoped flags; discard canary artifacts |
| Separate registration/admission window | **YES** |

### 8.7 AGENT-PLATFORM-EXEC-01C7 — Frontend bound-agent activation

| Field | Value |
|---|---|
| Title | Frontend bound-agent read-only Harness request (last dependent read-only slice) |
| Purpose | Send `harnessVersion: 'v1'` **only** for bound persisted-agent **conversation** after backend gates exist; keep Build on current non-Harness path; i18n for errors; keep disable-by-omission rollback |
| Depends on | **01C6** PASS (or an explicit Keith waiver recorded at registration). **01C4**+**01C5** required |
| Order | **7** |
| In scope | `workspace-execution-intent.logic.ts` + tests: conversation + bound id may add `harnessVersion` **only behind an explicit frontend gate that remains false until activation**; shell/page execute sites; i18n keys; invert “never includes harnessVersion” tests **only** for the gated true path; keep false-path tests that omit it |
| Out of scope | specialists; unbound Builder Harness; mutation UX; flipping `AGENT_HARNESS_ENABLE_TOOL_LOOP` in env examples; `page.tsx` redesign |
| Mutexes | **FRONTEND**, **I18N** |
| Prospective writes | `frontend/components/workspace/workspace-execution-intent.logic.ts`; `.logic.test.ts`; `workspace-shell.tsx`; `workspace-shell.test.tsx`; `frontend/messages/en.json`; `zh-TW.json`; `zh-CN.json`. `page.tsx` only if execute spread must change (today it already spreads the helper — prefer helper-only) |
| Shared contracts | execute JSON `harnessVersion` |
| Migration | NO |
| Runtime / provider-live / staging / browser / credit | NO / NO / NO / browser only if AC later requires Keith-guided smoke (default NO in this freeze) / NO |
| Evidence | LOCAL-TESTS |
| Activation effect | **Still none** until env loop flag is separately authorized. Shipping frontend code that **can** send `harnessVersion` while the helper gate is false is allowed; default must remain “do not send” |
| Rollback | helper omits `harnessVersion`; restore tests |
| Separate registration/admission window | **YES** |

### 8.8 AGENT-PLATFORM-EXEC-01C8 — Mutation approval enforcement

| Field | Value |
|---|---|
| Title | Executable approval before persisted-agent mutation tools |
| Purpose | Freeze I in code: no write/delete/validation/browser handler I/O without a one-use/expiring owner approval bound to `executionId` |
| Depends on | **01C6** read-only path proven. Must **not** start before 01C7 unless Keith explicitly sequences mutation before frontend (not recommended) |
| Order | **8** — after read-only proven |
| In scope | Dispatcher/handler approval intercept; audit `tool-approved`; tests that registry flags alone are insufficient |
| Out of scope | Enabling write flags in default env; frontend approval UX may be a further child; automatic rollback (01C9) |
| Mutexes | **AI-SERVICE** (and GATEWAY only if approval is stored/validated there — decide at 01C8 registration from then-current code) |
| Prospective writes | `tool-dispatcher.ts`; file/validation/browser handlers; new approval module under `services/ai-service/src/agent-harness/`; specs |
| Shared contracts | approval token/scope |
| Migration | possible if approvals persist — **not assumed**; fail closed in-memory is allowed for a first slice |
| Runtime / provider-live / staging / browser / credit | NO unless registration says otherwise |
| Evidence | LOCAL-TESTS first |
| Activation effect | NONE until flags + 01C9 |
| Rollback | handlers refuse without approval (safer default) |
| Separate registration/admission window | **YES** |

### 8.9 AGENT-PLATFORM-EXEC-01C9 — Mutation rollback and recovery

| Field | Value |
|---|---|
| Title | Automatic rollback/recovery for Harness mutation |
| Purpose | Correlate pre-mutation checkpoint with `executionId`; define automatic rollback vs manual revert; fail closed if checkpoint missing |
| Depends on | **01C8** |
| Order | **9** |
| In scope | Checkpoint correlation; rollback on partial failure; tests that checkpoint ≠ rollback; audit/final-result reporting |
| Out of scope | Replacing the existing user-facing revert UI; read-only slice; enabling mutation flags |
| Mutexes | **AI-SERVICE**; **GATEWAY** and/or **CONTAINER-MANAGER** only if checkpoint APIs must change (decide at registration) |
| Prospective writes | worker checkpoint wiring; Gateway checkpoint API if correlation fields are required; specs |
| Shared contracts | checkpoint ↔ `executionId` |
| Migration | possible for ledger correlation — not assumed |
| Runtime | likely LOCAL-RUNTIME at canary; not in Step 2 |
| Evidence | LOCAL-TESTS then mutation canary |
| Activation effect | NONE until explicit mutation activation |
| Rollback | keep mutation flags false |
| Separate registration/admission window | **YES** |

---

## 9. Dependency and activation ordering

```
01C1 types + fail-closed routing
  → 01C2 advertisement + incapable-provider fail-closed
    → 01C3 OpenAI/Anthropic transcripts
    → 01C4 Gateway identity combo allow + job agentId
      → 01C5 entitlement + accounting
        → 01C6 read-only canaries (stub, then real; xAI negative)
          → 01C7 frontend helper gate (still default off)
            → separately authorized env/product activation (NOT a child in this table)
              → 01C8 mutation approval
                → 01C9 rollback
```

**01C3 and 01C4** both depend on 01C2/01C1. They use different primary mutexes (AI-SERVICE vs GATEWAY) and **may** be a later SAFE_TWO_LANE_PAIR **only after** each is registered with EXACT write sets and pairwise validation. This Step 2 does **not** admit that pair.

**Activation (must remain closed):**

1. Implementation children land with flags false and frontend default omitting `harnessVersion`
2. 01C6 real-provider + negative xAI + accounting + identity evidence PASS
3. Separate authorization to set `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` in a named environment
4. 01C7 gate enabled to send `harnessVersion` for bound conversation only
5. Mutation flags stay false until 01C8+01C9+mutation canaries

Umbrella EXEC-01C stays **NOT ADMITTED**. Implementation happens only through separately registered children.

---

## 10. Child registration decision (this window)

**CHILD_TASKS_REGISTERED=0**

Machine reason:

- GOV-OS-03 / GOV-OS-03R1 require a sidecar IMPLEMENTATION candidate **only for canonically registered** post-epoch tasks.
- Proposing IDs in a stage-start document is **not** registration.
- EXEC-01C Step 1 body told Step 2 to decompose **without creating child IDs in that registration window**; this Step 2 instruction says register children only if the OS **mechanically** requires it.
- Registering FORCING READY children with exact write sets while both lanes are EMPTY would make `S` nonempty and **invalidate idle** (fail-closed saturation). This Step 2 must keep both lanes EMPTY and must not admit implementation.
- Therefore children stay document-only. Sidecar is **not** given child candidates.

Umbrella candidate remains `status=READY`, `writeSetPrecision=PROVISIONAL`, `admissionUncertain=true`, `mutexes=[]`, `writePaths=[]`.

---

## 11. Lifecycle / control-plane end state

| Item | End state |
|---|---|
| EXEC-01C Step 1 | COMPLETE |
| EXEC-01C Step 2 | COMPLETE |
| Cross-service contract | FROZEN (this document) |
| Child-slice decomposition | COMPLETE |
| Implementation | NOT STARTED |
| Umbrella | NOT ADMITTED |
| Child tasks | NOT ADMITTED / NOT REGISTERED |
| Product-visible Harness | FUTURE / GATED |
| Existing `agentId`+`harnessVersion` rejection | UNCHANGED in this window |
| Harness flags | UNCHANGED / FALSE |
| Frontend `harnessVersion` | NOT SENT |
| Lane 1 / 2 / 3 | EMPTY / EMPTY / DISABLED |
| Governance | UNOWNED after this write |
| Implementation mutexes | UNOWNED |
| Runtime authorization | unchanged false |

---

## 12. Step 2 write set (governance only)

Created:

- `docs/AGENT-PLATFORM-EXEC-01C-STAGE-START.md` (this file)

Updated (lifecycle/status only):

- `TASKS.md` CURRENT EXECUTION BOARD fields
- `TASKS_BACKLOG_FULL.md` AGENT-PLATFORM-EXEC-01C body (Step 2 AC + status)

Not updated (no machine Step-2 candidate field required):

- `docs/control-plane/lane-saturation-state.json` (remains Step 1 candidate; still PROVISIONAL / `admissionUncertain=true`)

Not modified: application, services, frontend, tests, migrations, env, package, compose, validator, mutex catalog, PRD.md, ARCHITECTURE.md, CLAUDE.md, AGENTS.md.

---

## 13. Confirmation of zero implementation and activation activity

- No Harness flag changes
- No Gateway rejection change
- No frontend `harnessVersion`
- No specialist / unbound Builder Harness
- No mutation tools enabled
- Runtime/Docker/database/staging/browser/provider-live/credit/migrations = 0
- Git commit/push = NO

---

*Stage Start created: 2026-09-01 — AGENT-PLATFORM-EXEC-01C Step 2 — contract freeze and child decomposition — no source/runtime/provider modification.*
