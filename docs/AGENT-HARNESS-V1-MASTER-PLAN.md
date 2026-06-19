# AGENT-HARNESS-00 — Agent Harness v1 Master Plan

**Status:** ACTIVE planning output
**Task ID:** AGENT-HARNESS-00
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Scope:** Documentation only — no implementation, no source edits, no checkpoint

---

## 1. Purpose

aiSandbox has established foundations: AI execution, file-action apply, checkpoint/revert, preview, global/project AI instructions, repo docs injection, and workspace context. But the current AI flow is single-shot prompt → text response → parsed file-actions. It cannot:

- Read or search the repository intelligently before editing
- Plan changes before applying them
- Run validation (tests, build, lint) after applying changes
- Fix issues found by validation and retry
- Show a diff preview before committing changes
- Roll back failed partial applies automatically
- Use structured tool calls or multi-turn reasoning

**Target product behavior:**

> understand repo → plan → edit safely → run tests → fix → show diff → checkpoint

Agent Harness v1 bridges the gap between the current single-shot AI execution and a professional coding agent that works iteratively inside the sandbox, using structured tools, safe file operations, validation feedback, and checkpoint-based rollback.

---

## 2. Current Architecture Baseline

### 2.1 AI Execution Flow

```
Frontend POST /api/ai/execute
  → API Gateway guard chain (auth, session, CSRF, rate limit)
  → usage_records intent row (execution_status = 'pending')
  → BullMQ job enqueued to 'ai-execution' queue
  → 202 response with executionId

ai-service WorkerProcessor claims job
  → buildExecutionPromptParts() assembles system + user prompt
  → AIExecutionService.execute() dispatches to provider adapter
  → adapter calls provider API (single-shot, non-streaming)
  → extractFileActionsFromOutput() parses file-actions from response text
  → ExecutionStreamPublisher publishes token, file_actions, completion via Redis Pub/Sub
  → usage_records ledger updated to 'completed'

Frontend consumes SSE stream + HTTP polling (every 3 seconds)
```

**Key files:**

| Component | Path |
|-----------|------|
| AI execution types (LOCKED) | `services/ai-service/src/ai-execution/types.ts` |
| Adapter interface | `services/ai-service/src/ai-execution/adapters/ai-adapter.interface.ts` |
| AIExecutionService | `services/ai-service/src/ai-execution/ai-execution.service.ts` |
| WorkerProcessor | `services/ai-service/src/worker/worker.processor.ts` |
| File-actions parser | `services/ai-service/src/ai-execution/file-actions.parser.ts` |
| SSE publisher | `services/ai-service/src/streaming/execution-stream.publisher.ts` |
| Queue job types | `services/ai-service/src/queue/job.types.ts` |
| Anthropic adapter | `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` |
| OpenAI adapter | `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts` |
| Groq adapter | `services/ai-service/src/ai-execution/adapters/groq-ai.adapter.ts` |
| xAI adapter | `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` |
| DeepSeek adapter | `services/ai-service/src/ai-execution/adapters/deepseek-ai.adapter.ts` |
| Stub adapter | `services/ai-service/src/ai-execution/adapters/stub-ai.adapter.ts` |

### 2.2 Prompt / Context Flow

**System prompt order:**
1. `FILE_ACTION_OUTPUT_CONTRACT` — fenced file-actions JSON output format
2. Global AI Instructions (if set)
3. Project AI Instructions (if set)

**User prompt order:**
1. Repo docs content (if any)
2. Project / workspace name (if set)
3. Workspace file paths listing
4. Currently open file path
5. Selected file content
6. Named file contents
7. Workspace search results (if any)
8. User request text

Prompt assembly lives in `buildExecutionPromptParts()` inside `worker.processor.ts`. Workspace context is truncation-based, not semantic/RAG.

### 2.3 File-Action / Apply Flow

AI response text is parsed by `extractFileActionsFromOutput()` using regex for fenced `` ```file-actions `` blocks containing JSON arrays. Valid actions: `create`, `write`, `update`, `delete`. Paths are normalized and validated (no absolute paths, no traversal, no null bytes).

Frontend receives file-actions via SSE `file_actions` event. Risky-batch confirmation triggers for >3 actions, any deletes, >20KB content, or config file targets. Apply-once guard prevents double writes.

`applySequentialFileActions` writes files one at a time: Frontend → API Gateway → container-manager → DockerRuntimeService Docker exec inside `/workspace`.

Post-apply coherence order: file tree refresh → editor refresh → preview refresh → checkpoint creation.

### 2.4 Workspace File Flow

Workspace file owner is container-manager / DockerRuntimeService. All file operations execute inside the container's `/workspace` directory. API Gateway proxies file CRUD requests to container-manager. No direct filesystem access from ai-service.

### 2.5 Checkpoint / Revert Flow

Checkpoints are created after successful file-action apply (post-apply coherence). Checkpoint creation calls the internal `POST /api/internal/git-checkpoints` endpoint. Revert restores workspace files, editor state, file tree, preview, and checkpoint list. No pre-apply checkpoint exists. No automatic rollback on failed/partial apply.

### 2.6 Preview Flow

Preview auto-starts on session select and after AI apply coherence. PreviewStrategyResolver handles framework detection vs static detection. Static HTML uses direct container file reads with base href injection. Dev servers are proxied to container IP/port. Two preview subsystems exist; Agent Harness must use the current preview path.

---

## 3. Existing Reusable Foundations

Agent Harness v1 should reuse these existing components rather than rebuilding them:

| Foundation | Location | Reuse Strategy |
|------------|----------|----------------|
| Provider adapters (Anthropic, OpenAI, Groq, xAI, DeepSeek, Stub) | `services/ai-service/src/ai-execution/adapters/` | Extend with tool-use support; do not replace |
| AIExecutionService orchestration | `services/ai-service/src/ai-execution/ai-execution.service.ts` | Wrap or extend; do not mutate LOCKED interface |
| File-actions parser | `services/ai-service/src/ai-execution/file-actions.parser.ts` | Keep for backward compat; add tool-based file ops alongside |
| BullMQ queue + job types | `services/ai-service/src/queue/` | Use existing queue; extend job shape via new contracts |
| Redis SSE publisher | `services/ai-service/src/streaming/execution-stream.publisher.ts` | Extend event types for tool-loop progress |
| WorkerProcessor job loop | `services/ai-service/src/worker/worker.processor.ts` | Refactor to support multi-turn; keep single-shot as fallback |
| Workspace context builder | `buildWorkspaceContextBlock()` in `worker.processor.ts` | Extract to shared module; extend with tool-based context |
| File CRUD pipeline | API Gateway → container-manager → DockerRuntimeService | Reuse for Agent Harness file writes |
| Risky-batch confirmation | Frontend file-action confirmation flow | Preserve; Agent Harness tools trigger same confirmation |
| Apply-once / coherence guards | Frontend post-apply coherence | Preserve existing behavior |
| Checkpoint APIs | Internal git-checkpoint endpoint + frontend checkpoint list | Reuse; add pre-apply checkpoint |
| Preview system | PreviewStrategyResolver + proxy + static | Reuse as-is |
| Global / Project AI Instructions | Settings → prompt injection | Reuse in Agent Harness prompt templates |
| Repo docs registry + injection | AI-CONTEXT family | Reuse in Agent Harness prompt templates |
| Guard chain | API Gateway auth + session + CSRF + rate limit | Reuse as-is |
| Session lifecycle gates | Session status enforcement | Reuse as-is |
| Observability metrics | `services/ai-service/src/observability/` | Extend for Agent Harness events |
| Quota service | `services/ai-service/src/quota/` | Reuse for Agent Harness token accounting |

---

## 4. Agent Harness v1 Target Architecture

### 4.1 Architecture Layers

```
┌──────────────────────────────────────────────────────┐
│                    Frontend                          │
│  Plan/Review UI  ·  Diff Preview  ·  Tool Progress   │
│  Checkpoint/Rollback Controls  ·  Status Display     │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────────┐
│                 API Gateway                          │
│  Guard Chain  ·  Session Gates  ·  Queue Dispatch    │
└───────────────────────┬──────────────────────────────┘
                        │  BullMQ
┌───────────────────────┴──────────────────────────────┐
│               ai-service (Agent Harness)             │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Prompt      │  │  Model       │  │  Policy /   │ │
│  │  Template    │  │  Profile     │  │  Config     │ │
│  │  Registry    │  │  Registry    │  │  Layer      │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                │                 │         │
│  ┌──────┴────────────────┴─────────────────┴──────┐ │
│  │           Agent Harness Orchestrator            │ │
│  │  (multi-turn tool loop + planning + review)     │ │
│  └──────┬────────────────┬─────────────────┬──────┘ │
│         │                │                 │         │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌─────┴──────┐ │
│  │  Model      │  │  Tool        │  │  Audit /   │ │
│  │  Adapter    │  │  Dispatcher  │  │  Log /     │ │
│  │  Layer      │  │  + Registry  │  │  Eval      │ │
│  └─────────────┘  └──────┬───────┘  └────────────┘ │
│                          │                           │
│         ┌────────────────┼────────────────┐          │
│         │                │                │          │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌────┴───────┐ │
│  │  File       │  │  Repo        │  │ Validation │ │
│  │  Tools      │  │  Context /   │  │ Runner     │ │
│  │  (R/W/D)    │  │  Search      │  │ Tool       │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────────┐
│              container-manager                       │
│  DockerRuntimeService  ·  /workspace  ·  Checkpoint  │
└──────────────────────────────────────────────────────┘
```

### 4.2 Layer Descriptions

**Versioned Agent Harness Contracts:** New parallel types for Agent Harness requests, results, tool calls, tool results. Versioned independently from LOCKED `AIExecutionRequest` / `AIExecutionResult`.

**Model Profile Registry:** Declarative profiles mapping model IDs to provider, model name, max tokens, temperature, tool-use capability flag, cost tier, and rate-limit config. Replaces hardcoded default models in adapters.

**Prompt Template Registry:** Named prompt templates for different modes (planning, building, validation/fix, review). Templates define system prompt sections, user prompt assembly order, and tool instructions. Not hardcoded inside WorkerProcessor.

**Policy / Config Layer:** Runtime configuration for safety boundaries: max tool iterations, max file read/write bytes, allowed validation commands, risky action policies, timeout limits, package install policy, env-file write policy, delete-file policy.

**Model Adapter Layer:** Extended adapters supporting optional tool definitions and tool-call response parsing, in addition to existing text-only execution. Per-request model selection actually applied at adapter instantiation.

**Tool Protocol / Contracts:** Typed tool schema definitions, tool call format, tool result format, error taxonomy, safety boundaries.

**Tool Registry:** Registration mechanism for available tools. Tools are registered declaratively, not hardcoded in the worker loop.

**Tool Dispatcher:** Routes tool calls from model responses to tool implementations. Enforces safety boundaries, audits each call, handles errors.

**Repo Context / Search Layer:** File discovery, directory listing, file content reading via tools. Start with lexical/file-based search. Semantic/embedding search is a future extension.

**Patch / Apply Engine:** Safe file operations with pre-apply checkpoint, atomic rollback on failure, eventual diff/patch editing. Preserves existing file-action/coherence/checkpoint behavior until replacement is proven.

**Validation Runner:** Executes allow-listed validation commands (test, build, lint) inside the container. Captures output, enforces timeouts, summarizes results. Feeds results back into the tool loop.

**Browser Smoke Workflow:** Investigation-first approach. Manual smoke fallback where automation is not available. Programmatic browser testing is a future extension pending feasibility investigation.

**Plan / Review UX:** Displays AI plan before execution, shows diff preview before apply, provides approval/reject controls, shows tool-loop progress. All text multilingual-first.

**Checkpoint / Rollback Strategy:** Pre-apply checkpoint before file writes. Atomic rollback on failed partial apply. Preserves existing post-apply checkpoint creation.

**Audit / Log / Eval Layer:** Structured audit events for every tool call, tool result, model invocation, file operation, and validation run. Foundation for continuous eval framework.

---

## 5. Cursor Rules / Subagent Integration Model

### 5.1 Supporting Context

Cursor rules (`.cursor/rules/`), project rules (`AGENTS.md`), skills (`.agents/skills/`, `.cursor/skills/`), hooks, and subagents provide supporting context for Agent Harness planning and implementation. They are advisory and must not override:

- `CLAUDE.md` (working contract)
- `TASKS.md` (active task ledger)
- `TASKS_BACKLOG_FULL.md` (backlog)
- Active task scope
- Existing architecture
- Tests and validation requirements

### 5.2 Subagent Use Policy

Subagents may be used for bounded review/investigation roles only:

- **Architecture-review subagent:** Review proposed architecture changes for consistency with existing boundaries.
- **Security-review subagent:** Review changes for security implications (auth, path traversal, secret exposure, injection).
- **UX/UI-governance review subagent:** Review UI changes for multilingual compliance, Heroicons v2 usage, advisory-skill alignment.
- **Testing/validation review subagent:** Review test coverage and validation completeness.

Subagents must NOT:
- Edit files
- Implement code
- Create checkpoints
- Modify TASKS.md or TASKS_BACKLOG_FULL.md
- Modify source/runtime/test/package files
- Expand scope
- Register new tasks
- Mark anything COMPLETE/LOCKED
- Bypass the active task

Any subagent output must be summarized and reconciled by the main agent before writing final deliverables.

### 5.3 Strict Lane vs Lite Lane

**Strict lane** — required for:
- Backend/stateful work
- Security-sensitive changes
- Architecture-heavy design
- Checkpoint/revert modifications
- Agent Harness core (contracts, tool protocol, model adapters, worker loop, patch/apply)
- Auth boundary changes
- Queue/event contract changes

Strict lane requires:
- Full governance compliance
- Security review where applicable
- Architecture review for boundary changes
- Explicit task registration before implementation
- Validation commands run and reported
- No hidden scope expansion

**Lite lane** — permitted only for:
- Isolated low-risk UI/docs/tooling work
- No backend state changes
- No security boundary changes
- No architecture changes

**AGENT-HARNESS-00 and all early Agent Harness core slices (01x, 02x, 03x) are strict-lane work.**

---

## 6. Changeability / No-Hardcoding Architecture

The Agent Harness v1 design must avoid hardcoded behavior. Every major concern is externalized into a registry, config, or versioned contract.

### 6.1 Adding a New Model Profile

1. Add a new entry to the model profile registry (a data file or config object).
2. Specify: provider, model name, max tokens, temperature, tool-use capability, cost tier.
3. No adapter code changes required if the provider already exists.
4. If a new provider is needed, implement a new adapter conforming to the adapter interface.

### 6.2 Registering a New Tool

1. Define the tool schema (name, description, parameters JSON Schema, result schema).
2. Implement the tool handler conforming to the tool handler interface.
3. Register the tool in the tool registry.
4. The tool dispatcher and prompt template system automatically include registered tools.
5. No changes to WorkerProcessor or prompt assembly required.

### 6.3 Changing Prompt Templates

1. Edit or add a prompt template in the prompt template registry.
2. Templates are named and versioned (e.g., `planning-v1`, `building-v2`).
3. Template changes do not require code changes in the worker loop.
4. Templates reference tool registry and model profile data, not hardcoded values.

### 6.4 Updating Policy Config

1. Edit the policy/config object (a data file or environment-driven config).
2. Changes to max iterations, allowed commands, file size limits, timeout values, etc., take effect without code changes.
3. Policy enforcement is centralized in the tool dispatcher and validation runner.

### 6.5 Adding a New Contract Version

1. Define a new versioned Agent Harness contract (e.g., `AgentHarnessRequestV2`).
2. The new contract extends or replaces the prior version.
3. Queue job shape includes a contract version field.
4. Worker detects contract version and dispatches accordingly.
5. Old contract versions remain supported until explicitly deprecated.

### 6.6 Adding a New Child Slice

1. Register the child slice in TASKS.md with objective, scope, non-goals, likely files, validation.
2. Implement within the existing layer boundaries.
3. New functionality plugs into existing registries and interfaces.
4. No broad rewrite of existing layers required.

---

## 7. Contract Strategy

### 7.1 LOCKED Types — Do Not Mutate Directly

The following types are marked LOCKED (Stage C2-A):

- `AIExecutionRequest` — `services/ai-service/src/ai-execution/types.ts`
- `AIExecutionResult` — `services/ai-service/src/ai-execution/types.ts`
- `AIProviderConfig` — `services/ai-service/src/ai-execution/types.ts`

These types define the current contract boundary. Agent Harness v1 must NOT modify them as the first step.

### 7.2 New Parallel Contracts

Define new Agent Harness v1 contracts in a new file (e.g., `services/ai-service/src/agent-harness/contracts.ts`):

- `AgentHarnessRequest` — extends execution request with tool definitions, mode (plan/build/validate/review), model profile ID, policy config reference.
- `AgentHarnessResult` — extends execution result with tool call history, plan output, validation results, applied file operations, checkpoint reference.
- `AgentToolCall` — structured tool invocation (name, arguments, call ID).
- `AgentToolResult` — structured tool response (call ID, result data, error, duration).
- `AgentHarnessEvent` — audit/progress events for SSE stream.

### 7.3 Bridge Strategy

1. Agent Harness queue jobs use the existing `ai-execution` BullMQ queue with an extended job shape (new fields alongside existing fields).
2. WorkerProcessor detects whether a job is a legacy single-shot execution or an Agent Harness multi-turn execution based on a `harnessVersion` field.
3. Legacy jobs continue through the existing single-shot path unchanged.
4. Agent Harness jobs enter the new multi-turn tool loop.
5. File-action output from the tool loop is published via the existing SSE publisher (extended with new event types).
6. File writes still go through the existing API Gateway → container-manager → DockerRuntimeService pipeline.
7. Checkpoint creation still uses the existing internal git-checkpoint endpoint.

This bridge strategy ensures backward compatibility while enabling incremental migration.

---

## 8. Model Adapter Strategy

### 8.1 Phase 1: Fix Per-Request Model Selection (AGENT-HARNESS-01A)

Current state: `AIExecutionService.getAdapter()` instantiates adapters with constructor default models. The `model` field from `AiExecutionJob` is passed in the request but the adapter ignores it — each adapter uses its own `defaultModel` (e.g., `claude-3-5-sonnet-20241022`, `gpt-4o`).

Fix: Pass `request.model` (when present) as the `options.model` parameter when constructing adapters in `getAdapter()`.

### 8.2 Phase 2: Model Profile Registry (AGENT-HARNESS-01C)

Replace hardcoded default models with a model profile registry. Each profile specifies:

```typescript
interface ModelProfile {
  id: string;                    // e.g., 'claude-sonnet-4'
  provider: ProviderType;        // 'anthropic' | 'openai' | ...
  modelName: string;             // provider-specific model string
  maxTokens: number;
  temperature: number;
  supportsToolUse: boolean;
  costTier: 'low' | 'medium' | 'high';
  rateLimitTier?: string;
}
```

Profiles are loaded from config, not hardcoded in adapter constructors.

### 8.3 Phase 3: Tool-Use Support in Adapters (AGENT-HARNESS-02A)

Extend the adapter interface with optional tool-use methods:

- Accept tool definitions alongside the execution request.
- Parse tool-call responses from provider APIs (Anthropic tool_use blocks, OpenAI function_call / tool_calls).
- Return structured `AgentToolCall[]` instead of relying on text parsing.

The existing text-only `execute()` method remains for backward compatibility.

### 8.4 Phase 4: True Provider Streaming (Future)

True streaming (token-by-token SSE from provider → Redis → frontend) is a separate concern from tool-use. It should be implemented as a later independent slice after tool-use is stable. Current architecture publishes the full response as a single token event; true streaming would publish incrementally.

---

## 9. Tool Protocol Strategy

### 9.1 Tool Schema

Each tool is defined by a schema:

```typescript
interface AgentToolSchema {
  name: string;                          // unique tool identifier
  description: string;                   // human-readable description for the model
  parameters: JSONSchema;                // JSON Schema for tool arguments
  resultSchema?: JSONSchema;             // JSON Schema for tool result
  category: 'file' | 'search' | 'validation' | 'browser' | 'system';
  requiresApproval: boolean;             // true for risky operations
  maxExecutionMs: number;                // per-invocation timeout
}
```

### 9.2 Tool Registry

Tools are registered declaratively:

```typescript
interface ToolRegistry {
  register(schema: AgentToolSchema, handler: AgentToolHandler): void;
  get(name: string): RegisteredTool | undefined;
  list(): AgentToolSchema[];
  listByCategory(category: string): AgentToolSchema[];
}
```

The registry is populated at module initialization, not hardcoded in the worker loop.

### 9.3 Tool Call Format

Model responses include structured tool calls:

```typescript
interface AgentToolCall {
  id: string;              // unique call ID (for correlation)
  name: string;            // tool name from registry
  arguments: unknown;      // parsed arguments matching tool schema
}
```

### 9.4 Tool Result Format

Tool execution produces structured results:

```typescript
interface AgentToolResult {
  callId: string;          // correlates to AgentToolCall.id
  success: boolean;
  data?: unknown;          // result payload
  error?: {
    code: string;          // from error taxonomy
    message: string;
  };
  durationMs: number;
  auditEvent: AgentAuditEvent;
}
```

### 9.5 Error Taxonomy

| Code | Meaning |
|------|---------|
| `TOOL_NOT_FOUND` | Tool name not in registry |
| `INVALID_ARGUMENTS` | Arguments fail schema validation |
| `PERMISSION_DENIED` | Operation blocked by policy |
| `PATH_TRAVERSAL` | Path escapes /workspace |
| `FILE_NOT_FOUND` | Target file does not exist |
| `FILE_TOO_LARGE` | File exceeds max read/write bytes |
| `TIMEOUT` | Tool execution exceeded maxExecutionMs |
| `COMMAND_NOT_ALLOWED` | Validation command not in allow-list |
| `MAX_ITERATIONS` | Tool loop reached max iterations |
| `CONTAINER_ERROR` | Container-manager returned error |
| `INTERNAL_ERROR` | Unexpected failure |

### 9.6 Audit Events

Every tool invocation produces an audit event:

```typescript
interface AgentAuditEvent {
  eventId: string;
  executionId: string;
  timestamp: string;
  toolName: string;
  callId: string;
  arguments: unknown;      // sanitized (no secrets)
  result: 'success' | 'error';
  errorCode?: string;
  durationMs: number;
  iterationNumber: number;
}
```

### 9.7 Safety Boundaries

- **Max iterations:** Configurable per-execution limit (default: 25). Prevents infinite tool loops.
- **Max file read bytes:** Configurable limit per read-file invocation.
- **Max file write bytes:** Configurable limit per write-file invocation.
- **Path validation:** All file paths validated against `/workspace` root. No traversal, no absolute paths, no null bytes. Reuses existing `normalizeAndValidatePath()` logic.
- **Command allow-list:** Validation runner only executes commands from an explicit allow-list.
- **Approval gates:** Risky operations (deletes, config file writes, large batch operations) require frontend approval before execution.

---

## 10. Prompt Template Strategy

### 10.1 Design Principle

Agent Harness prompts must NOT be buried inside `WorkerProcessor`. Prompt templates are stored in a prompt template registry — either as template files or as structured config objects loaded at startup.

### 10.2 Template Modes

| Mode | Purpose | When Used |
|------|---------|-----------|
| `planning` | Understand repo structure, propose a plan of changes | First turn or explicit plan request |
| `building` | Execute file operations using tools | After plan approval or direct build request |
| `validation-fix` | Analyze validation output, fix issues | After validation runner returns errors |
| `review` | Review changes, suggest improvements | Before final checkpoint |

### 10.3 Template Assembly Order

Each template defines sections assembled in order:

**System prompt sections:**
1. Agent Harness role and capabilities description
2. Available tools (from tool registry, formatted as tool definitions)
3. Output format instructions (tool call format, not legacy file-actions format)
4. Safety rules and constraints (from policy config)
5. Global AI Instructions (if set)
6. Project AI Instructions (if set)
7. Mode-specific instructions (planning / building / validation-fix / review)

**User prompt sections:**
1. Repo docs content (from repo docs registry)
2. Project / workspace name
3. Conversation history (tool calls and results from prior turns)
4. Current workspace context (from tools or initial context)
5. Validation results (if in validation-fix mode)
6. User request text

### 10.4 Model Profile Instructions

Model profiles may include provider-specific prompt adjustments (e.g., Anthropic tool-use format vs OpenAI function-calling format). The prompt template system applies these adjustments transparently based on the active model profile.

---

## 11. Policy / Config Strategy

### 11.1 Policy Config Shape

```typescript
interface AgentHarnessPolicy {
  maxToolIterations: number;           // default: 25
  maxFileReadBytes: number;            // default: 512 KB
  maxFileWriteBytes: number;           // default: 256 KB
  maxTotalWriteBytes: number;          // default: 2 MB per execution
  executionTimeoutMs: number;          // default: 120000 (2 min)
  toolTimeoutMs: number;               // default: 30000 (30 sec)
  validationTimeoutMs: number;         // default: 60000 (1 min)

  allowedValidationCommands: string[]; // e.g., ['npm test', 'npm run build', 'npx tsc --noEmit']
  blockedFilePatterns: string[];       // e.g., ['.env', '*.pem', '*.key']
  riskyFilePatterns: string[];         // e.g., ['package.json', 'tsconfig.json', 'docker-compose.yml']

  requireApprovalForDeletes: boolean;  // default: true
  requireApprovalForConfigFiles: boolean; // default: true
  requireApprovalForLargeWrites: boolean; // default: true
  largeWriteThresholdBytes: number;    // default: 20480 (20 KB)
  maxBatchActionsBeforeApproval: number; // default: 3

  packageInstallPolicy: 'blocked' | 'approval_required' | 'allowed';
  envFileWritePolicy: 'blocked' | 'approval_required';
  deleteFilePolicy: 'approval_required' | 'allowed';

  enablePreApplyCheckpoint: boolean;   // default: true
  enableAutoRollbackOnFailure: boolean; // default: true
}
```

### 11.2 No Arbitrary Shell

The policy explicitly does NOT allow arbitrary shell command execution. Only validation commands from the `allowedValidationCommands` list may be executed. This prevents:

- Arbitrary code execution via AI
- Network access from AI-triggered commands (unless explicitly allowed)
- System-level operations outside /workspace

---

## 12. Repo Indexing / Search Strategy

### 12.1 Phase 1: Lexical / File Discovery (AGENT-HARNESS-03A)

Start with basic file operations as tools:

- `list_files` — list directory contents with optional glob/pattern filter
- `read_file` — read file content (with byte limit from policy)
- `search_files` — text/regex search across workspace files (using grep-like approach)

These tools operate through container-manager's existing file CRUD pipeline.

### 12.2 Phase 2: Chunking and Metadata (Future)

Add file chunking with metadata:

- Language detection
- Function/class boundary detection
- Import/export mapping
- File-level summaries

### 12.3 Phase 3: Semantic Search (Future)

Add embedding-based semantic search only after:

- Tool protocol contracts are stable
- File discovery tools are proven
- Chunking infrastructure exists
- A clear embedding provider strategy is defined

Avoid broad embedding/vector-store dependency in the first implementation slices.

---

## 13. Patch / Apply Strategy

### 13.1 Phase 1: Safe Contracts + Dry-Run (AGENT-HARNESS-03B)

- Define `write_file` and `delete_file` tools with proper contracts.
- Add dry-run semantics: tool can report what it would do without executing.
- Preserve existing risky-batch confirmation behavior.
- Files written through existing API Gateway → container-manager → DockerRuntimeService pipeline.

### 13.2 Phase 2: Pre-Apply Checkpoint (AGENT-HARNESS-03C)

- Create a git checkpoint BEFORE file writes begin.
- Store checkpoint reference in the Agent Harness execution context.
- If file writes fail partway, rollback to the pre-apply checkpoint.

### 13.3 Phase 3: Atomic Rollback (AGENT-HARNESS-03C)

- On failed partial apply, automatically revert to pre-apply checkpoint.
- Publish rollback event via SSE so frontend can update UI.
- Log rollback as audit event.

### 13.4 Phase 4: Diff / Patch Editing (Future)

- Add diff/patch-based editing as an alternative to full-file overwrites.
- Requires stable pre-apply checkpoint and rollback infrastructure.
- Preserve full-file write as fallback.

---

## 14. Validation Runner Strategy

### 14.1 Allow-List Commands Only

The validation runner tool (`run_validation`) executes commands from an explicit allow-list defined in policy config. Examples:

- `npm test`
- `npm run build`
- `npx tsc --noEmit`
- `npm run lint`

No arbitrary shell. Commands not on the allow-list are rejected with `COMMAND_NOT_ALLOWED` error.

### 14.2 Execution Model

1. Tool receives command name (matched against allow-list).
2. Command executes inside the container via container-manager.
3. Timeout enforced (from policy `validationTimeoutMs`).
4. stdout/stderr captured and truncated to a reasonable size.
5. Exit code captured.
6. Result summarized for model consumption.

### 14.3 Feed Results Back

Validation results are returned as a tool result. In validation-fix mode, the model receives validation output and can issue fix tool calls (read files, write fixes, re-run validation).

---

## 15. Browser Smoke Strategy

### 15.1 Investigation First (AGENT-HARNESS-05A)

Browser smoke automation requires investigation before implementation:

- Can Playwright or Puppeteer run inside a gVisor-sandboxed container?
- What are the resource requirements (memory, CPU)?
- Can screenshots be captured and returned as tool results?
- Can console output and DOM state be captured?

### 15.2 Manual Smoke Fallback

Where browser automation is not available or not yet implemented:

- Agent Harness produces a checklist of manual smoke steps.
- Keith (the user) is guided step-by-step through browser smoke.
- Smoke results are recorded manually.

### 15.3 Future Automation

If investigation confirms feasibility:

- `browser_smoke` tool that navigates to preview URL, captures screenshot, captures console output.
- Screenshot returned as base64 or file reference in tool result.
- Console errors flagged in validation-fix mode.

---

## 16. Plan / Review UI Strategy

### 16.1 Multilingual-First

All new user-facing text must update:

- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

Use existing translation hooks/patterns. No hardcoded English UX/UI copy.

### 16.2 Icon Library

Use Heroicons v2 Outline only: `@heroicons/react/24/outline`.

### 16.3 Advisory Skills

- **Impeccable** — for broad UX/UI audits, visual hierarchy, spacing, anti-slop polish.
- **Emil Kowalski** — for component polish, interaction quality, motion restraint, empty/loading/error states.

Advisory skills are advisory-only and must not override governance, scope, architecture, or tests.

### 16.4 UI Components (Future AGENT-HARNESS-06A)

| Component | Purpose |
|-----------|---------|
| Plan display | Shows AI-proposed plan before execution |
| Diff preview | Shows file changes as unified diff before apply |
| Approval controls | Accept / reject / modify plan |
| Tool progress | Real-time display of tool calls and results during execution |
| Validation output | Shows test/build/lint results |
| Checkpoint controls | Pre-apply checkpoint indicator, rollback button |
| Status indicators | Planning / building / validating / reviewing / complete / failed |

---

## 17. Continuous Eval Strategy

### 17.1 Eval Task Format

```typescript
interface AgentEvalTask {
  id: string;
  description: string;
  initialWorkspace: string;          // reference to a workspace snapshot
  userRequest: string;
  expectedOutcome: {
    filesCreated?: string[];
    filesModified?: string[];
    filesDeleted?: string[];
    validationPasses?: boolean;
    contentChecks?: ContentCheck[];   // regex or substring checks on file contents
  };
  scoringDimensions: string[];       // e.g., ['correctness', 'safety', 'efficiency']
}
```

### 17.2 Scoring Dimensions

| Dimension | What It Measures |
|-----------|-----------------|
| Correctness | Did the agent produce the expected file changes? |
| Safety | Did the agent respect safety boundaries (no traversal, no blocked files, no arbitrary shell)? |
| Efficiency | How many tool iterations did the agent use? |
| Plan quality | Did the agent produce a coherent plan before editing? |
| Validation | Did the agent run validation and fix issues? |
| Rollback | Did the agent handle failures gracefully with rollback? |

### 17.3 Regression Tracking

- Eval results stored per run with timestamp, model profile, agent harness version.
- Regression detected when a previously-passing eval task fails.
- Dashboard (future) shows pass/fail trends.

### 17.4 Future CI Integration

- Eval suite runs as a CI step on Agent Harness changes.
- Blocking regressions prevent merge.
- Non-blocking quality metrics reported for review.

---

## 18. Child Slice Roadmap

### AGENT-HARNESS-01A — Per-Request Model Selection Fix

**Objective:** Fix per-request model selection so the `model` field from `AiExecutionJob` is actually applied when constructing provider adapters.

**Scope:**
- Modify `AIExecutionService.getAdapter()` to pass `request.model` as `options.model` to adapter constructors when `request.model` is present.
- Verify the fix with unit tests.

**Non-goals:**
- No model profile registry yet.
- No tool-use changes.
- No prompt changes.
- No contract changes.

**Likely files:**
- `services/ai-service/src/ai-execution/ai-execution.service.ts`
- `services/ai-service/src/ai-execution/__tests__/ai-execution.service.spec.ts`

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Unit test confirms adapter receives the requested model.

**Browser smoke:** Not required (backend-only).

**Dependencies:** None.

**Strict/lite lane:** Strict (backend, adapter behavior change).

**Subagent/review role:** Security review recommended (model selection affects execution behavior).

**Changeability note:** This fix is a prerequisite for model profile registry. After this, model selection flows from request through to adapter.

---

### AGENT-HARNESS-01B — Agent Harness v1 Contracts + Config Shape

**Objective:** Define the core Agent Harness v1 type contracts and policy config shape as new parallel types.

**Scope:**
- Create `services/ai-service/src/agent-harness/contracts.ts` with:
  - `AgentHarnessRequest`
  - `AgentHarnessResult`
  - `AgentToolCall`
  - `AgentToolResult`
  - `AgentAuditEvent`
  - `AgentHarnessEvent`
- Create `services/ai-service/src/agent-harness/policy.ts` with:
  - `AgentHarnessPolicy` interface
  - Default policy values
- Do NOT modify existing LOCKED types.

**Non-goals:**
- No implementation of tool loop.
- No adapter changes.
- No queue changes.
- No frontend changes.

**Likely files:**
- `services/ai-service/src/agent-harness/contracts.ts` (new)
- `services/ai-service/src/agent-harness/policy.ts` (new)
- `services/ai-service/src/agent-harness/index.ts` (new)

**Validation requirements:**
- `npm run build` in ai-service passes.
- `npx tsc --noEmit` passes.
- Types are importable from other modules.

**Browser smoke:** Not required (types only).

**Dependencies:** None (can run in parallel with 01A).

**Strict/lite lane:** Strict (architecture-defining contracts).

**Subagent/review role:** Architecture review recommended (these contracts shape the entire Agent Harness).

**Changeability note:** Contracts are versioned. Future versions can be added alongside without breaking existing consumers. The bridge strategy in section 7.3 ensures backward compatibility.

---

### AGENT-HARNESS-01C — Model Profile Registry

**Objective:** Replace hardcoded default models in adapters with a declarative model profile registry.

**Scope:**
- Create `services/ai-service/src/agent-harness/model-profiles.ts` with:
  - `ModelProfile` interface
  - Default profiles for existing providers
  - `ModelProfileRegistry` class
- Update `AIExecutionService.getAdapter()` to use profiles.

**Non-goals:**
- No tool-use changes.
- No prompt changes.
- No frontend changes.

**Likely files:**
- `services/ai-service/src/agent-harness/model-profiles.ts` (new)
- `services/ai-service/src/ai-execution/ai-execution.service.ts`
- Tests for model profile registry

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Existing adapter behavior unchanged when no model profile override is specified.

**Browser smoke:** Not required (backend-only).

**Dependencies:** AGENT-HARNESS-01A (per-request model selection must work first).

**Strict/lite lane:** Strict (model selection affects execution behavior).

**Subagent/review role:** Architecture review recommended.

**Changeability note:** New models are added by adding a profile entry, not by editing adapter code. Profiles can be loaded from config files for runtime changeability.

---

### AGENT-HARNESS-01D — Tool Registry Contract

**Objective:** Define the tool schema, tool registry interface, and tool dispatcher contract.

**Scope:**
- Create `services/ai-service/src/agent-harness/tool-registry.ts` with:
  - `AgentToolSchema` interface
  - `AgentToolHandler` interface
  - `ToolRegistry` class
  - `ToolDispatcher` class (skeleton)
- Define error taxonomy constants.

**Non-goals:**
- No tool implementations yet.
- No adapter changes.
- No worker loop changes.

**Likely files:**
- `services/ai-service/src/agent-harness/tool-registry.ts` (new)
- `services/ai-service/src/agent-harness/tool-dispatcher.ts` (new)
- `services/ai-service/src/agent-harness/errors.ts` (new)
- Tests for tool registry

**Validation requirements:**
- `npm run build` in ai-service passes.
- `npx tsc --noEmit` passes.
- Unit tests for registry add/get/list operations.

**Browser smoke:** Not required (contracts only).

**Dependencies:** AGENT-HARNESS-01B (contracts must exist).

**Strict/lite lane:** Strict (core architecture contract).

**Subagent/review role:** Architecture review and security review recommended (tool dispatch is a security boundary).

**Changeability note:** New tools are registered declaratively. The registry pattern ensures no hardcoded tool list exists in the worker loop.

---

### AGENT-HARNESS-01E — Prompt Template Registry

**Objective:** Create the prompt template registry with mode-based templates.

**Scope:**
- Create `services/ai-service/src/agent-harness/prompt-templates.ts` with:
  - `PromptTemplate` interface
  - `PromptTemplateRegistry` class
  - Default templates for planning, building, validation-fix, review modes
- Extract `FILE_ACTION_OUTPUT_CONTRACT` and `buildExecutionPromptParts` logic into the template system as a legacy template.

**Non-goals:**
- No worker loop changes yet.
- No adapter changes.
- No frontend changes.

**Likely files:**
- `services/ai-service/src/agent-harness/prompt-templates.ts` (new)
- Tests for prompt template registry

**Validation requirements:**
- `npm run build` in ai-service passes.
- `npx tsc --noEmit` passes.
- Unit tests for template assembly.
- Legacy template produces identical output to existing `buildExecutionPromptParts()`.

**Browser smoke:** Not required (backend-only).

**Dependencies:** AGENT-HARNESS-01B (contracts), AGENT-HARNESS-01D (tool registry for tool definitions in prompts).

**Strict/lite lane:** Strict (prompt assembly affects AI behavior).

**Subagent/review role:** Architecture review recommended.

**Changeability note:** Templates are named, versioned, and stored in the registry. Prompt changes require editing a template, not modifying worker code. New modes are added by registering a new template.

---

### AGENT-HARNESS-02A — Adapter Tool-Use Support

**Objective:** Extend provider adapters to support tool definitions and tool-call response parsing.

**Scope:**
- Extend `AIAdapter` interface with optional `executeWithTools()` method.
- Implement tool-use for Anthropic adapter (Anthropic tool_use blocks).
- Implement tool-use for OpenAI adapter (OpenAI tool_calls / function_call).
- Other adapters return `supportsToolUse: false` until implemented.

**Non-goals:**
- No multi-turn loop yet (that's 02B).
- No true streaming.
- No changes to legacy single-shot path.

**Likely files:**
- `services/ai-service/src/ai-execution/adapters/ai-adapter.interface.ts`
- `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/stub-ai.adapter.ts`
- Tests for each modified adapter

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Unit tests confirm tool-call parsing for Anthropic and OpenAI responses.
- Legacy `execute()` behavior unchanged.

**Browser smoke:** Not required (backend-only).

**Dependencies:** AGENT-HARNESS-01A (model selection), AGENT-HARNESS-01B (contracts), AGENT-HARNESS-01D (tool schema).

**Strict/lite lane:** Strict (adapter layer, provider API integration).

**Subagent/review role:** Security review recommended (tool-call parsing is a trust boundary).

**Changeability note:** Tool-use is additive. The existing `execute()` method is preserved. New adapters or providers can implement `executeWithTools()` independently.

---

### AGENT-HARNESS-02B — Worker Multi-Turn Tool Loop

**Objective:** Implement the multi-turn tool loop in WorkerProcessor for Agent Harness executions.

**Scope:**
- Add Agent Harness orchestrator that detects `harnessVersion` in job data.
- Implement tool loop: model call → parse tool calls → dispatch tools → feed results back → repeat until done or max iterations.
- Publish progress events via SSE publisher.
- Enforce policy limits (max iterations, timeouts).
- Preserve legacy single-shot path for non-harness jobs.

**Non-goals:**
- No specific tool implementations (those are 03x, 04x).
- No frontend UI changes.
- No true streaming.

**Likely files:**
- `services/ai-service/src/agent-harness/orchestrator.ts` (new)
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/streaming/execution-stream.publisher.ts`
- Tests for orchestrator

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Unit tests confirm multi-turn loop with stub adapter and mock tools.
- Legacy single-shot path unaffected.

**Browser smoke:** Not required (backend-only).

**Dependencies:** AGENT-HARNESS-01B (contracts), AGENT-HARNESS-01D (tool registry), AGENT-HARNESS-01E (prompt templates), AGENT-HARNESS-02A (adapter tool-use).

**Strict/lite lane:** Strict (major architectural change — multi-turn loop in worker).

**Subagent/review role:** Architecture review and security review recommended. This is the highest-risk implementation slice.

**Changeability note:** The orchestrator uses tool registry, prompt templates, model profiles, and policy config — all externalized. New behavior is added by registering tools and templates, not by editing the orchestrator loop.

---

### AGENT-HARNESS-03A — Read-File and List-Files Tools

**Objective:** Implement the first concrete tools: `read_file` and `list_files`.

**Scope:**
- Implement `read_file` tool handler: reads file content from container workspace via container-manager API.
- Implement `list_files` tool handler: lists directory contents with optional glob filter.
- Register both tools in tool registry.
- Enforce policy limits (max read bytes, path validation).

**Non-goals:**
- No write/delete tools yet.
- No search tools yet.
- No frontend changes.

**Likely files:**
- `services/ai-service/src/agent-harness/tools/read-file.tool.ts` (new)
- `services/ai-service/src/agent-harness/tools/list-files.tool.ts` (new)
- Tests for each tool

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Unit tests confirm file reading with mock container-manager responses.
- Path traversal attempts rejected.
- File size limit enforced.

**Browser smoke:** Not required (backend tool implementation).

**Dependencies:** AGENT-HARNESS-01D (tool registry), AGENT-HARNESS-02B (tool loop to dispatch tools).

**Strict/lite lane:** Strict (file access, security boundary).

**Subagent/review role:** Security review recommended (path validation, file size limits).

**Changeability note:** Each tool is a self-contained handler registered in the tool registry. Adding a new file-related tool (e.g., `search_files`) follows the same pattern.

---

### AGENT-HARNESS-03B — Write-File and Delete-File Tools

**Objective:** Implement `write_file` and `delete_file` tools.

**Scope:**
- Implement `write_file` tool handler: writes file content to container workspace via existing file CRUD pipeline.
- Implement `delete_file` tool handler: deletes file from container workspace.
- Enforce policy limits (max write bytes, blocked file patterns, risky file approval).
- Integrate with existing risky-batch confirmation flow.
- Publish file-action events via SSE for frontend coherence.

**Non-goals:**
- No diff/patch editing yet.
- No pre-apply checkpoint yet (that's 03C).

**Likely files:**
- `services/ai-service/src/agent-harness/tools/write-file.tool.ts` (new)
- `services/ai-service/src/agent-harness/tools/delete-file.tool.ts` (new)
- Tests for each tool

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Blocked file patterns rejected.
- Write size limit enforced.
- Path traversal attempts rejected.

**Browser smoke:** Recommended (verify file writes appear in file tree and editor).

**Dependencies:** AGENT-HARNESS-03A (read tools proven first), AGENT-HARNESS-01D (tool registry).

**Strict/lite lane:** Strict (file mutation, security boundary).

**Subagent/review role:** Security review required (file writes are the highest-risk tool operation).

**Changeability note:** Write/delete policy is driven by `AgentHarnessPolicy` config, not hardcoded in the tool handler.

---

### AGENT-HARNESS-03C — Pre-Apply Checkpoint and Atomic Rollback

**Objective:** Add pre-apply checkpoint creation before file writes and automatic rollback on failed partial apply.

**Scope:**
- Before the first file write in a tool loop, create a git checkpoint via the internal checkpoint API.
- Store checkpoint reference in execution context.
- If any file write fails, automatically revert to the pre-apply checkpoint.
- Publish rollback events via SSE.
- Log rollback as audit event.

**Non-goals:**
- No diff/patch editing.
- No UI changes for rollback controls (that's in 06A).

**Likely files:**
- `services/ai-service/src/agent-harness/orchestrator.ts`
- `services/ai-service/src/agent-harness/tools/write-file.tool.ts`
- `services/ai-service/src/agent-harness/tools/delete-file.tool.ts`
- `services/ai-service/src/clients/api-gateway-http.client.ts`
- Tests for checkpoint/rollback behavior

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Unit test confirms checkpoint created before first write.
- Unit test confirms rollback on partial failure.

**Browser smoke:** Recommended (verify rollback restores files in UI).

**Dependencies:** AGENT-HARNESS-03B (write/delete tools), existing checkpoint API.

**Strict/lite lane:** Strict (checkpoint/revert, data integrity).

**Subagent/review role:** Architecture review and security review recommended.

**Changeability note:** Checkpoint behavior is controlled by `enablePreApplyCheckpoint` and `enableAutoRollbackOnFailure` in policy config.

---

### AGENT-HARNESS-04A — Validation Runner Tool

**Objective:** Implement the `run_validation` tool that executes allow-listed commands inside the container.

**Scope:**
- Implement `run_validation` tool handler.
- Match command against policy allow-list.
- Execute via container-manager.
- Capture stdout/stderr with truncation.
- Enforce timeout from policy.
- Return structured result (exit code, output summary, pass/fail).

**Non-goals:**
- No arbitrary shell execution.
- No automatic fix loop (the model handles that via the existing tool loop).
- No frontend UI for validation output (that's in 06A).

**Likely files:**
- `services/ai-service/src/agent-harness/tools/run-validation.tool.ts` (new)
- Tests for validation runner

**Validation requirements:**
- `npm test` in ai-service passes.
- `npm run build` in ai-service passes.
- Non-allowed commands rejected with `COMMAND_NOT_ALLOWED`.
- Timeout enforced.
- Output truncated at configured limit.

**Browser smoke:** Not required (backend tool).

**Dependencies:** AGENT-HARNESS-01D (tool registry), AGENT-HARNESS-02B (tool loop), container-manager exec capability.

**Strict/lite lane:** Strict (command execution, security boundary).

**Subagent/review role:** Security review required (command execution is a critical security boundary).

**Changeability note:** Allowed commands are defined in policy config, not hardcoded. Adding a new allowed command requires only a config change.

---

### AGENT-HARNESS-05A — Browser Smoke Tool Investigation

**Objective:** Investigate feasibility of programmatic browser testing inside sandboxed containers.

**Scope:**
- Investigate Playwright / Puppeteer compatibility with Docker + gVisor.
- Assess resource requirements (memory, CPU, disk).
- Prototype screenshot capture if feasible.
- Document findings and recommend approach.

**Non-goals:**
- No production implementation.
- No UI changes.
- No tool registration (pending investigation outcome).

**Likely files:**
- `docs/AGENT-HARNESS-05A-INVESTIGATION.md` (new)
- Prototype scripts (temporary, not production)

**Validation requirements:**
- Investigation report produced.
- Feasibility assessed with evidence.
- Resource requirements documented.

**Browser smoke:** The investigation IS the browser smoke feasibility assessment.

**Dependencies:** None (can run in parallel with other slices).

**Strict/lite lane:** Strict (container security, resource implications).

**Subagent/review role:** Architecture review recommended (container resource implications).

**Changeability note:** Investigation produces a recommendation. If feasible, a follow-up implementation slice is registered. If not feasible, manual smoke fallback is documented.

---

### AGENT-HARNESS-06A — Plan / Review UI

**Objective:** Build the frontend UI for plan display, diff preview, tool progress, and checkpoint/rollback controls.

**Scope:**
- Plan display component showing AI-proposed changes before execution.
- Diff preview component showing file changes as unified diff.
- Approval / reject controls.
- Tool progress display showing real-time tool calls and results.
- Validation output display.
- Checkpoint indicator and rollback button.
- Status indicators (planning / building / validating / reviewing / complete / failed).
- All text multilingual-first (en.json, zh-TW.json, zh-CN.json).

**Non-goals:**
- No backend changes.
- No new API endpoints (uses existing SSE + polling).
- No broad UI redesign outside Agent Harness components.

**Likely files:**
- `frontend/src/components/agent-harness/` (new directory)
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

**Validation requirements:**
- `npm test` in frontend passes.
- `npm run build` in frontend passes.
- `npx tsc --noEmit` in frontend passes.
- No hardcoded English UI copy.
- All three locale files updated.
- Translation hooks used for all visible text.

**Browser smoke:** Required (visual verification of plan display, diff preview, status indicators).

**Dependencies:** AGENT-HARNESS-02B (SSE events for tool progress), AGENT-HARNESS-03B (file-action events), AGENT-HARNESS-04A (validation results).

**Strict/lite lane:** Lite for isolated UI components; strict for SSE integration.

**Subagent/review role:** UX/UI-governance review recommended. Use Impeccable for broad audit, Emil Kowalski for component polish.

**Changeability note:** UI components consume SSE events and display data. New event types or tool types are handled by extending the event parser, not by rewriting UI components.

---

### AGENT-HARNESS-07A — Eval Framework Scaffold

**Objective:** Create the scaffold for the continuous eval framework.

**Scope:**
- Define eval task format (TypeScript interface).
- Create eval runner that executes eval tasks against Agent Harness.
- Implement basic scoring (correctness, safety, efficiency).
- Create a small set of seed eval tasks.
- Store results in structured format.

**Non-goals:**
- No CI integration yet.
- No dashboard.
- No regression blocking.

**Likely files:**
- `services/ai-service/src/agent-harness/eval/` (new directory)
- `services/ai-service/src/agent-harness/eval/eval-runner.ts` (new)
- `services/ai-service/src/agent-harness/eval/eval-types.ts` (new)
- `services/ai-service/src/agent-harness/eval/tasks/` (new, seed tasks)

**Validation requirements:**
- `npm run build` in ai-service passes.
- Eval runner can execute a seed task and produce a score.

**Browser smoke:** Not required (internal tooling).

**Dependencies:** AGENT-HARNESS-02B (tool loop), AGENT-HARNESS-03A/03B (file tools), AGENT-HARNESS-04A (validation tool).

**Strict/lite lane:** Lite (internal tooling, no production behavior change).

**Subagent/review role:** Architecture review recommended for eval task format.

**Changeability note:** Eval tasks are data files. New eval tasks are added without code changes. Scoring dimensions can be extended by adding new scorer implementations.

---

## 19. Non-Goals for Agent Harness v1

- **No broad rewrite.** Incremental extension of existing architecture.
- **No new service boundary** unless explicitly approved. Agent Harness lives inside ai-service.
- **No unbounded autonomous shell.** Only allow-listed validation commands.
- **No UI redesign** outside registered UI slices.
- **No direct bypass** of file-action/checkpoint/coherence behavior.
- **No hidden auth/security changes.**
- **No giant hardcoded prompt.** Prompts live in the template registry.
- **No hardcoded model behavior** spread across adapters. Models come from profiles.
- **No hardcoded tool list** inside WorkerProcessor. Tools come from the registry.
- **No subagent-based scope expansion.** Subagents are review/investigation only.
- **No subagent implementation** unless explicitly registered and authorized in TASKS.md.
- **No direct mutation of LOCKED types** (`AIExecutionRequest`, `AIExecutionResult`, `AIProviderConfig`) as the first step.
- **No horizontal scaling or clustering.** Single-node focus per ARCHITECTURE.md.
- **No event bus or cron.** Per ARCHITECTURE.md explicit non-goals.

---

## 20. Risks and Mitigations

### 20.1 Architecture Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **ARCHITECTURE.md drift:** says SQLite + HTTP-only, while current code uses PostgreSQL + BullMQ/Redis | New contributors may be confused by stale architecture docs | Document as a known risk. Recommend a future architecture-reconciliation slice. Do NOT fix in Agent Harness slices. |
| **Two preview subsystems:** static HTML + dev server proxy | Agent Harness could accidentally wire into wrong preview path | Document current preview path. Agent Harness uses PreviewStrategyResolver. |
| **Legacy AI/message paths:** old execution paths may still exist | Agent Harness could accidentally connect to legacy paths | Agent Harness uses new `harnessVersion` job field to distinguish paths. |
| **LOCKED types need migration:** `AIExecutionRequest` and `AIExecutionResult` are LOCKED | Cannot extend them for Agent Harness without architectural approval | Use new parallel contracts (section 7). Bridge strategy maintains backward compat. |
| **Tool protocol too large for one slice:** multi-turn tool loop + tool definitions + tool parsing | Trying to implement everything at once creates excessive risk | Split into registry (01D), adapter support (02A), loop (02B), and individual tools (03x, 04x). |
| **True provider streaming separate from tool protocol:** streaming and tool-use are different concerns | Mixing them creates coupling risk | Treat streaming as a separate future slice. |
| **Multi-turn tool loop is a major architectural change:** fundamentally changes worker behavior | Bugs could affect existing single-shot execution | Bridge strategy: legacy jobs use existing path, only `harnessVersion` jobs enter new loop. |

### 20.2 Security Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **No server-side max write payload size** | Malicious or buggy AI could write extremely large files | Add `maxFileWriteBytes` and `maxTotalWriteBytes` in policy config. Enforce in write-file tool. |
| **Tool paths could bypass path traversal protections** | AI-provided paths could escape /workspace | Reuse existing `normalizeAndValidatePath()`. Enforce in every file tool. |
| **Command/tool execution must be allow-listed** | Arbitrary commands could compromise container or host | Validation runner uses explicit allow-list. No arbitrary shell by default. |
| **Internal auth boundary needs review** | Agent Harness tools call container-manager APIs | Use existing internal service key authentication. Security review for new tool endpoints. |

### 20.3 Subagent-Specific Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Accidental scope expansion** | Subagent recommends work outside the active task | Main agent reconciles all subagent output. Subagents cannot edit files or register tasks. |
| **Conflicting recommendations** | Multiple subagents produce contradictory advice | Main agent reconciles conflicts using governance precedence (CLAUDE.md > TASKS.md > subagent). |
| **Hidden implementation** | Subagent attempts to implement code instead of reviewing | Subagent policy: review/investigation only. No file edits, no source changes. |
| **Rules conflicts** | Cursor rules or skills override project governance | Governance precedence: CLAUDE.md > TASKS.md > TASKS_BACKLOG_FULL.md > Cursor rules/skills. |
| **Context drift** | Subagent operates on stale or incomplete context | Main agent provides focused context to subagents. Subagent output validated against current state. |

### 20.4 UX/UI Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Hardcoded English text** | Violates multilingual-first governance | All UI slices must update en.json, zh-TW.json, zh-CN.json. UX/UI governance review catches violations. |
| **Non-Heroicons icons** | Inconsistent icon library | Use `@heroicons/react/24/outline` only. UX/UI governance review verifies. |

---

## 21. Recommended Next Step

After this master plan is accepted:

**Register AGENT-HARNESS-01A — Per-Request Model Selection Fix** as the next active task.

This is the smallest, safest, most bounded first implementation slice. It fixes a concrete bug (per-request model selection not applied), has no contract dependencies, and unblocks the model profile registry (01C).

Do NOT implement AGENT-HARNESS-01A inside AGENT-HARNESS-00. The master plan task (00) is planning output only.

---

## Document Metadata

- **Created:** 2026-06-19
- **Task:** AGENT-HARNESS-00
- **Status:** ACTIVE planning output
- **Author:** AI-assisted planning pass
- **Source:** Investigation summary from AGENT-HARNESS-00 registration + codebase exploration
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md
