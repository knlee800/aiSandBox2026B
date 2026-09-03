# AGENT-PLATFORM-EXEC-01C2 — Independent Consolidation Checkpoint

**Task:** AGENT-PLATFORM-EXEC-01C2 — Provider capability and fail-closed tool advertisement
**Date:** 2026-09-03
**Lifecycle:** 3-STEP
**Step:** 3 — Independent Consolidation / Checkpoint / Final Lock
**Verdict:** COMPLETE AND LOCKED — PASS

---

## 1. Final verdict

AGENT-PLATFORM-EXEC-01C2 COMPLETE AND LOCKED — PASS

Provider capability and fail-closed tool advertisement are complete and locked. The worker now advertises only `list_files` and `read_file` through a positive-whitelist filter that requires each tool to be implemented, enabled, have a registered handler, and appear in the first-slice permit list. An empty advertised set fails closed before provider execution. Unsupported adapters retain EXEC-01C1 fail-closed behavior. Caller-supplied tools cannot replace or add unauthorized tools. Ordinary non-Harness execution is unchanged. The global Harness flag remains false and authoritative.

Lane 1 and AI-SERVICE ownership are released. The post-epoch IMPLEMENTATION candidate is retained with `status=LOCKED`.

---

## 2. Frozen scope

### Base and implementation commits

| Field | Value |
|---|---|
| Branch | `main` |
| Base SHA | `923d167803ec150b4d125eb2846b9f1403779696` |
| Implementation SHA (HEAD) | `582a836b0713392f913ed82f43b25d48583d6400` |
| `origin/main` | `582a836b0713392f913ed82f43b25d48583d6400` |
| Working tree at consolidation open | Clean |
| `git diff --check` | Clean |

### Exact five implementation files

| # | Path | Type |
|---|---|---|
| 1 | `services/ai-service/src/worker/worker.processor.ts` | Production |
| 2 | `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts` | Production |
| 3 | `services/ai-service/src/worker/worker.processor.spec.ts` | Test |
| 4 | `services/ai-service/src/ai-execution/adapters/__tests__/adapter-tool-use.mapper.spec.ts` | Test |
| 5 | `services/ai-service/src/agent-harness/tools/__tests__/tool-registration-gates.spec.ts` | Test |

Three additional files in the committed range are control-plane/registration only: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json`.

No implementation outside the admitted five-path write set.

---

## 3. Advertisement eligibility proof

### Exact advertised set: `list_files` and `read_file`

`selectAdvertisedAgentHarnessTools` in `adapter-tool-use.mapper.ts` evaluates `isAgentHarnessToolEligibleForAdvertisement` for each tool definition. A tool is eligible only if ALL conditions are true:

1. `implementationStatus === 'implemented'`
2. `enabled === true`
3. Handler name or ID is in the `registeredHandlerNames` set (built from actual dispatcher registration)
4. `isPermittedByFirstReadOnlyHarnessSlice(definition.id)` — the ID must appear in `FIRST_READ_ONLY_HARNESS_ADVERTISED_TOOL_IDS` = `['list_files', 'read_file']` (frozen, `Object.freeze`)
5. `passesFirstSliceRuntimeGate(definition, input)` — `list_files`/`read_file` return true unconditionally; others require their specific runtime flag AND must already pass condition 4

`list_files`: implemented ✓, enabled=true ✓, handler always registered ✓, in permit list ✓, runtime gate true ✓ → **ELIGIBLE**
`read_file`: implemented ✓, enabled=true ✓, handler always registered ✓, in permit list ✓, runtime gate true ✓ → **ELIGIBLE**

### Canonical names, descriptions, and input schemas preserved

Tests verify `advertised[0] === getAgentHarnessToolDefinition('list_files')` and `advertised[1] === getAgentHarnessToolDefinition('read_file')` (reference equality). Descriptions and input schemas are the canonical registry objects, not copies or independent inventions. `mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(advertised)` maps correctly with `inputSchema: definition.inputSchema.schema`.

No duplicate or divergent schema source was created.

---

## 4. Mandatory exclusion proof

### Per-tool exclusion analysis

| Tool | implemented | enabled | Handler registered | In permit list | Runtime gate | Result |
|---|---|---|---|---|---|---|
| `search_workspace` | planned ✗ | false ✗ | never ✗ | NO ✗ | default:false ✗ | **EXCLUDED** (4 independent layers) |
| `write_file` | implemented ✓ | true ✓ | conditional ✓ | NO ✗ | — | **EXCLUDED** (permit list) |
| `delete_file` | implemented ✓ | true ✓ | conditional ✓ | NO ✗ | — | **EXCLUDED** (permit list) |
| `run_validation` | implemented ✓ | true ✓ | conditional ✓ | NO ✗ | — | **EXCLUDED** (permit list) |
| `browser_smoke` | implemented ✓ | false ✗ | conditional | NO ✗ | — | **EXCLUDED** (enabled + permit list) |
| `start_preview` | planned ✗ | false ✗ | never ✗ | NO ✗ | — | **EXCLUDED** (4 layers) |
| Unknown future tools | — | — | — | NO ✗ | default:false ✗ | **EXCLUDED** (permit list + runtime gate default) |

Tests explicitly verify `search_workspace` exclusion even when forced to `enabled: true`, `implementationStatus: 'implemented'`, with a handler registered. The permit list is a positive whitelist — `isPermittedByFirstReadOnlyHarnessSlice` checks inclusion in the frozen array. Unknown tools fail closed at both the permit list check AND `passesFirstSliceRuntimeGate` (default case returns false).

Builder configuration cannot bypass either the read-only permit list or the global Harness gate. The test "does not let resolved builder configuration advertise mutation tools or bypass the global gate" verifies:
- `resolveHarnessRouting` uses `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` (global), NOT `resolvedConfig.enableToolLoop`
- With all handlers registered and all flags true, only `list_files` and `read_file` are advertised

---

## 5. Handler-registration integrity proof

The worker builds `registeredHandlerNames: string[]` sequentially:

```
dispatcher.registerHandler('read_file', createReadFileHandler(...));
registeredHandlerNames.push('read_file');
dispatcher.registerHandler('list_files', createListFilesHandler(...));
registeredHandlerNames.push('list_files');
// conditional: write_file, delete_file (if enableWriteTools)
// conditional: run_validation (if enableValidationTools)
// conditional: browser_smoke (if enableBrowserSmoke)
```

Each push occurs immediately after the corresponding `registerHandler` call. If a handler factory throws, the push never executes. The same string literal is used for both `registerHandler` and `push`, ensuring exact name correspondence.

`selectAdvertisedAgentHarnessTools` receives `registeredHandlerNames` and converts it to a `Set<string>`. The eligibility check uses `registeredHandlerNames.has(definition.name)` or `registeredHandlerNames.has(definition.id)`. Names and IDs in the registry are identical for all current tools.

Failed, missing, or skipped registrations cannot enter the advertised set because:
- The name is pushed only after successful registration
- If a conditional block is not entered (flag false), the name is never pushed
- `selectAdvertisedAgentHarnessTools` further filters by its own permit list

No stale or independently invented list is trusted.

---

## 6. Provider-boundary and empty-set proof

### Filtered definitions on every `executeWithTools` call

```typescript
executeFn: (req, opts) => adapter.executeWithTools!(req, mergeAdvertisedToolsIntoExecuteOptions(opts, advertisedTools))
```

`mergeAdvertisedToolsIntoExecuteOptions` returns `{ ...options, tools: advertisedTools }`. The spread preserves `options.toolResults` from subsequent turns. The `tools` property unconditionally overwrites any value from the spread, preventing caller-supplied tools from replacing or adding unauthorized tools.

Tests verify:
- Turn 0 options have `tools === advertised`
- Turn 1 options have `tools === advertised` AND `toolResults.length === 1`
- The old pattern `adapter.executeWithTools!(req, opts)` (without merge) is absent

### Empty advertised set

`requireNonEmptyAdvertisedHarnessTools(tools)` throws `HarnessEmptyAdvertisedToolSetError` when `tools.length === 0`. This is called BEFORE `executeAgentHarnessLoop`. The error is not classified as transient/retryable — it is a deterministic fatal failure.

Test: `expect(() => requireNonEmptyAdvertisedHarnessTools([])).toThrow(HarnessEmptyAdvertisedToolSetError)` and `expect(executeWithTools).not.toHaveBeenCalled()`.

### Unsupported adapters

The EXEC-01C1 fail-closed check at lines 993-999 is preserved:
```typescript
if (!adapter.supportsToolUse || !adapter.executeWithTools) {
    throw new HarnessRoutingError(...);
}
```

This fires BEFORE the advertisement logic, ensuring unsupported adapters (xAI, groq, deepseek, stub) never reach the tool selection code. No Harness-to-single-shot downgrade exists.

### Non-Harness path unchanged

The `else` branch after `if (useHarness)` still calls `this.aiExecutionService.execute(executionRequest)`. No imports, functions, or logic from the advertisement system appear in the plain execution path. Tests verify the plain path source does not contain `mergeAdvertisedToolsIntoExecuteOptions`.

### Global Harness flag

`DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` defaults to `false`. The routing uses this global value, not `resolvedConfig.enableToolLoop`. Test explicitly verifies the routing call block contains `enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` and does NOT contain `resolvedConfig.enableToolLoop`.

---

## 7. Scope boundary confirmation

No change to:

| Scope boundary | Changed? |
|---|---|
| Provider transcript handling | NO |
| Gateway `agentId + harnessVersion` rejection | NO |
| Frontend requests | NO |
| Accounting or entitlements | NO |
| Approval or rollback | NO |
| Flags or activation | NO |
| Specialists or unbound Builder | NO |
| Mutation, validation, or browser availability | NO |
| `tool-registry.ts` data | NO (registry untouched) |
| `agent-harness-loop.ts` | NO (loop untouched) |
| Adapter implementation files | NO (adapters untouched) |
| Gateway source files | NO |
| Frontend source files | NO |
| Environment files | NO |
| Migrations | NO |
| Package/compose | NO |

---

## 8. Test-quality assessment

### Detection coverage (all 10 requirements)

| # | Detection target | Test evidence | Assessment |
|---|---|---|---|
| 1 | Third advertised tool | `expect(advertisedNames(advertised)).toEqual(['list_files', 'read_file'])` — exact array equality | DETECTED |
| 2 | Enabled mutation tool advertised | "excludes disabled, planned, handlerless, search, mutation, validation, and browser tools" — explicit exclusion assertions | DETECTED |
| 3 | `search_workspace` advertised | "never advertises search_workspace even when a handler is claimed" — forced-enabled scenario | DETECTED |
| 4 | Tool without registered handler advertised | "excludes a first-slice tool when it is disabled, planned, or missing a handler" — handler-absent test | DETECTED |
| 5 | Canonical schema dropped | `expect(advertised[0]).toBe(listFiles)` reference equality + description/inputSchema checks | DETECTED |
| 6 | Worker fails to provide tools to `executeWithTools` | Source inspection: `mergeAdvertisedToolsIntoExecuteOptions(opts, advertisedTools)` wired; old pattern absent | DETECTED |
| 7 | Subsequent-turn `toolResults` lost | `expect(executeWithTools.mock.calls[1][1].toolResults).toHaveLength(1)` | DETECTED |
| 8 | Caller-supplied tools bypass filtering | `mergeAdvertisedToolsIntoExecuteOptions` unconditionally sets `tools: advertisedTools`; both turns verified | DETECTED |
| 9 | Empty advertised set reaches provider | `requireNonEmptyAdvertisedHarnessTools([])` throws; `executeWithTools.not.toHaveBeenCalled()` | DETECTED |
| 10 | Unsupported Harness becomes single-shot | `resolveHarnessRouting` returns `fail_closed`; source analysis confirms `HarnessRoutingError` and `throw` | DETECTED |

### Source inspection tests

Some tests read `worker.processor.ts` source to verify structural wiring. These are complemented by behavioral tests (mock executeWithTools verification, routing function unit tests). The combination provides robust coverage. No tests only verify layout without proving behavior.

---

## 9. Fresh verification results

### Targeted suites

| Suite | Tests | Result |
|---|---|---|
| `worker.processor.spec.ts` | 106 passed | PASS |
| `adapter-tool-use.mapper.spec.ts` | 10 passed | PASS |
| `tool-registration-gates.spec.ts` | 17 passed | PASS |
| `worker.processor.builder-config.spec.ts` | 55 passed | PASS |

### Full AI Service suite

```
Test Suites: 38 passed, 38 total
Tests:       1 skipped, 812 passed, 813 total
Time:        16.792 s
```

PASS — zero failures. 812 passed, 1 skipped (pre-existing).

### TypeScript build

```
npm run build → tsc → exit 0
```

PASS

### ESLint

AI Service has no ESLint configuration in the committed tree. Independently confirmed: `git ls-tree` and filesystem glob both return zero `.eslint*` files under `services/ai-service/`. PREEXISTING_UNAVAILABLE — non-blocking.

### git diff --check

Clean (exit 0, empty output).

### Saturation validator (preflight)

```json
{"result":"PASS","exitCode":0,"idleCode":"NO_PAIRWISE_ADMISSIBLE_CANDIDATE"}
```

Occupancy hash: `sha256:6e6b3f8ea2b328c217e5333faef6614b1fea12c368b285bb033355d50363f3c1`

---

## 10. FUTURE/gated boundaries

These remain unchanged after EXEC-01C2:

| Boundary | Status |
|---|---|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | false (default unchanged) |
| Frontend `harnessVersion` | Not sent |
| Gateway `agentId`+`harnessVersion` combination | HTTP 400 rejected |
| Browser session `harnessEntitled` | Not set |
| Provider-native transcripts | Not implemented (01C3) |
| Persisted identity on job | Not propagated (01C4) |
| Mutation tool approval | Not implemented (01C8) |
| Automatic rollback | Not implemented (01C9) |
| Specialist/unbound Builder Harness | Out of scope |

Product-visible Harness capability = FUTURE / gated.

---

## 11. Zero runtime/provider/activation activity

- Runtime/Docker/database/staging/browser/provider-live/credit/migrations = 0
- Harness flags changed = NO
- Gateway combination rejection changed = NO
- Frontend changed = NO
- Git commit/push = NO (Keith owns Git)
- EXEC-01C3 registered = NO

---

## 12. Review findings

### CRITICAL: 0
### HIGH: 0
### MEDIUM: 0

### LOW: 1

**LOW-1: Source-inspection tests complement but do not fully replace behavioral integration tests.**
Some tests verify wiring by reading the worker source file and searching for patterns (e.g., confirming `mergeAdvertisedToolsIntoExecuteOptions` appears in the executeFn). These are valid structural proofs but do not execute the actual NestJS worker with a mock adapter through the full code path. This is acceptable for the current scope because:
- Behavioral tests (mock executeWithTools, routing unit tests) exercise the core logic
- The worker's integration tests in the full suite exercise the broader execution path
- The structural tests verify the wiring is correct and the old patterns are absent

No action required. Non-blocking.

---

## 13. Validator result (final)

Proof written to `$env:TEMP\EXEC-01C2-CONSOLIDATION-PREFLIGHT.json`.

Post-lock `git diff --check`: clean.

---

*Checkpoint created: 2026-09-03 — AGENT-PLATFORM-EXEC-01C2 Step 3 — independent consolidation and final lock — no runtime/provider/activation modification.*
