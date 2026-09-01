# AGENT-PLATFORM-EXEC-01C1 — Step 3 Independent Reconsolidation + Checkpoint + Final Lock

**Task:** AGENT-PLATFORM-EXEC-01C1 — Foundational types and fail-closed Harness routing
**Date:** 2026-09-01
**Lifecycle:** 3-STEP
**Step:** 3 — Independent Reconsolidation / Checkpoint / Final Lock
**Verdict:** COMPLETE AND LOCKED — PASS
**Reconsolidation:** Independent re-verification after the first consolidation FAILED. All verification gates pass independently.

---

## 1. Final verdict

AGENT-PLATFORM-EXEC-01C1 COMPLETE AND LOCKED — PASS

Foundational types and fail-closed Harness routing are complete and locked. A requested Harness execution now fails closed when the loop flag is false or the adapter cannot run tools, replacing the prior silent single-shot downgrade. Canonical `executionId` is threaded into the Harness loop and all audit events. Job and request types carry optional `agentId` for later persisted-agent identity propagation. Ordinary jobs without `agentId` or `harnessVersion` are unaffected. The Gateway `agentId`+`harnessVersion` combination rejection is unchanged. Product-visible Harness remains FUTURE/gated. No flags, frontend, credit, entitlement, provider-adapter, mutation, migration, or activation behavior changed.

The first consolidation attempt FAILED on one critical identity gate (audit `executionId` was `sessionId`) and two obsolete routing assertions in the builder-config spec. Repair 1 added a canonical `executionId` entry guard to the Harness loop. Repair 2 updated two builder-config test assertions to prove the new `resolveHarnessRouting` pattern. Both repairs verified independently.

This checkpoint was independently re-verified. All seven implementation diffs were re-inspected, all tests re-run, build and lint re-checked, and the validator re-executed.

Lane 1 and AI-SERVICE ownership are released. The post-epoch IMPLEMENTATION candidate is retained with `status=LOCKED`.

---

## 2. Git evidence

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD at Step 3 open | `0aa3a7f496396d0a0f1583efa40999c32442f2a9` |
| `origin/main` at Step 3 open | `0aa3a7f496396d0a0f1583efa40999c32442f2a9` |
| Working tree at Step 3 open | Dirty — exactly 7 implementation files + 3 governance files (TASKS.md, TASKS_BACKLOG_FULL.md, docs/control-plane/lane-saturation-state.json) from prior control-plane activity |
| `git diff --check` | Clean (CRLF warnings only) |
| Implementation paths changed | Exactly 7: matches candidate and Lane 1 write set |
| Parent dependency EXEC-01A | COMPLETE AND LOCKED — PASS — 2026-08-31 |
| Parent dependency EXEC-01B | COMPLETE AND LOCKED — PASS — 2026-08-31 |
| Parent dependency GOV-AUTH-03 | COMPLETE AND LOCKED — PASS — 2026-08-31 |
| Parent umbrella EXEC-01C | REGISTERED / READY / NOT ADMITTED (Step 2 COMPLETE) |

Keith owns Git. This Step 3 worker did not commit, push, reset, checkout, fetch, pull, or create branches.

---

## 3. Step 3 opening preconditions (verified)

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD == origin/main | YES |
| Task not complete or locked | Confirmed — Step 2 IN PROGRESS |
| No checkpoint | Confirmed |
| EXEC-01C2 unregistered | Confirmed |
| Lane 1 | ACTIVE AGENT-PLATFORM-EXEC-01C1 |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| AI-SERVICE | OWNED by EXEC-01C1 |
| GOVERNANCE | UNOWNED |
| Candidate `status` | ADMITTED |
| `writeSetPrecision` | EXACT |
| `admissionUncertain` | false |
| `saturationSuspended` | false |
| Runtime authorization | all false |
| Candidate write set | 7 exact paths matching occupancy |

---

## 4. Seven-file final write set

| # | Path | Type |
|---|---|---|
| 1 | `services/ai-service/src/queue/job.types.ts` | Production |
| 2 | `services/ai-service/src/ai-execution/types.ts` | Production |
| 3 | `services/ai-service/src/worker/worker.processor.ts` | Production |
| 4 | `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Production |
| 5 | `services/ai-service/src/worker/worker.processor.spec.ts` | Test |
| 6 | `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | Test |
| 7 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | Test |

No other files were modified by this implementation. The seventh path was added via a test-only write-set expansion (Repair 2) without broadening product behavior.

---

## 5. Original implementation contract review

| # | Check | Result |
|---|---|---|
| 1 | `AiExecutionJob.agentId` is backward compatible (optional) | PASS |
| 2 | Canonical queue `executionId` remains required | PASS |
| 3 | `buildAIExecutionRequest` forwards `executionId` and optional `agentId` | PASS |
| 4 | No `sessionId` fallback exists | PASS |
| 5 | Ordinary jobs without `agentId` remain valid | PASS |
| 6 | Fail-closed routing replaces silent Harness-to-single-shot downgrade | PASS |
| 7 | Harness not requested still uses existing plain path | PASS |
| 8 | Disabled global gate fails before provider execution | PASS |
| 9 | Unsupported adapters fail before provider execution | PASS |
| 10 | Supported adapters retain bounded Harness path | PASS |
| 11 | Fail-closed routing errors are not retryable transient errors | PASS |
| 12 | Default Harness loop flag remains false | PASS |
| 13 | Gateway combination rejection remains unchanged | PASS |
| 14 | No frontend/provider-adapter/credit/entitlement/mutation/rollback/activation change | PASS |

---

## 6. Consolidation history

### 6.1 First consolidation FAIL

The first independent consolidation identified:

1. **CRITICAL: Audit `executionId` was `request.sessionId`** — The Harness loop `baseEvent().executionId` was set from `request.sessionId`, not the canonical Gateway `executionId`. This violated the frozen contract (stage-start §F) that audit events must use the Gateway-created execution ID and must not use `sessionId` as audit `executionId`.

2. **HIGH: Two builder-config assertions were obsolete** — The tests in `worker.processor.builder-config.spec.ts` still asserted the old inline routing pattern (`job.data.harnessVersion === 'v1' &&` / `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop`) instead of the new `resolveHarnessRouting` function call.

### 6.2 Repair 1 — Canonical executionId entry guard — PASS

**Root cause:** `AIExecutionRequest.executionId` did not exist before this task. The loop's `baseEvent.executionId` was initialized from `request.sessionId` as a placeholder, violating the frozen contract.

**Fix:** Added `requireCanonicalExecutionId()` as the first operation in `executeAgentHarnessLoop`. This function:

- Rejects `undefined`, empty string, and whitespace-only values with `HarnessInvalidExecutionIdError`
- Returns the original string without trimming or transformation
- Throws **before** `harness.loop_started` is recorded, before `executeFn` is called, before dispatcher/checkpoint

The validated `executionId` is used in `baseEvent()` for all subsequent audit events.

**Verification:** Independent inspection confirmed:

- undefined/empty/whitespace rejected before any side effect
- `executeFn`, dispatcher, checkpoint callback all `not.toHaveBeenCalled()`
- `recorder.getEvents()` is empty on rejection
- Valid IDs preserved verbatim (no trim)
- `baseEvent()` uses validated `executionId` constant, not `request.sessionId`
- All events carry both `executionId` and `sessionId` as separate fields
- Tests explicitly assert `executionId !== sessionId`

### 6.3 Repair 2 — Builder-config routing assertions — PASS

**Root cause:** The `resolveHarnessRouting` refactor changed the worker's routing pattern from inline conditions to a function call. Two assertions in the builder-config spec searched for the old inline pattern, which no longer existed.

**Fix:** Test-only update to `worker.processor.builder-config.spec.ts`. The two assertions now:

1. Find the `resolveHarnessRouting({...})` call block in the worker source
2. Verify `harnessVersion: job.data.harnessVersion` is passed
3. Verify `enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` is passed as the master gate
4. Verify `useHarness = routing.selectedPath === 'harness'` follows the routing call
5. Verify `if (useHarness) {` branch follows the `useHarness` derivation
6. Verify `resolvedConfig` does not appear in the routing call block
7. Verify `resolveBuilderHarnessConfig(` occurs after the Harness branch

**Verification:** Independent inspection confirmed no production code was changed during Repair 2. No unrelated tests were weakened or deleted. The `route_evaluated log` test is unchanged.

---

## 7. Canonical executionId safety proof

| Property | Evidence |
|---|---|
| Guard placement | First operation in `executeAgentHarnessLoop`, before loop counter, event recording, or any I/O |
| Rejection: undefined | `typeof executionId !== 'string'` → `HarnessInvalidExecutionIdError` |
| Rejection: empty | `executionId === ''` → `HarnessInvalidExecutionIdError` |
| Rejection: whitespace-only | `executionId.trim() === ''` → `HarnessInvalidExecutionIdError` |
| No side effects on rejection | `executeFn`, dispatcher, checkpoint, recorder all untouched (tested) |
| No fallback or substitution | `requireCanonicalExecutionId` throws, does not generate a replacement |
| No trimming of valid IDs | Returns original string verbatim |
| Audit binding | `baseEvent()` uses validated `const executionId` for all events |
| Session ID separation | `baseEvent()` carries `sessionId: request.sessionId` as a distinct field |
| Test coverage | 3 rejection tests (undefined, empty, whitespace) + 4 audit identity tests (started, completed, dispatch, full-loop) |

---

## 8. Fail-closed routing proof

| Scenario | Old behavior | New behavior | Test |
|---|---|---|---|
| `harnessVersion: undefined` | Plain path | Plain path (unchanged) | `resolveHarnessRouting` unit + route observability |
| `harnessVersion: 'v1'`, `enableToolLoop: false` | **Silent plain fallback** | **`fail_closed` / `tool_loop_disabled` → `HarnessRoutingError`** | Unit + integration (worker fails job, `execute` not called) |
| `harnessVersion: 'v1'`, `enableToolLoop: true`, adapter lacks `supportsToolUse` | **Silent plain fallback** | **`fail_closed` / `adapter_lacks_tool_use` → `HarnessRoutingError`** | Unit |
| `harnessVersion: 'v1'`, `enableToolLoop: true`, adapter lacks `executeWithTools` | **Silent plain fallback** | **`fail_closed` / `adapter_lacks_execute_with_tools` → `HarnessRoutingError`** | Unit |
| `harnessVersion: 'v1'`, all gates pass | Harness path | Harness path (unchanged) | Unit |

The `HarnessRoutingError` is a named error with structured `code` and `reason`, not a generic Error. The worker outer catch handles it as a fatal failure (`execution_status: 'failed'`).

---

## 9. Audit separation proof

| Property | Evidence |
|---|---|
| `executionId` source | `requireCanonicalExecutionId(request.executionId)` — Gateway-created UUID |
| `sessionId` source | `request.sessionId` — workspace session |
| Never equal in Harness tests | `expect(event.executionId).not.toBe(event.sessionId)` across all event types |
| All events carry both | `baseEvent()` returns `{ ..., executionId, sessionId: request.sessionId, ... }` |
| No sessionId-as-executionId code | Verified: the old `executionId: request.sessionId` pattern is removed |

---

## 10. Verification results

### 10.1 Three relevant suites (fresh run — independent reconsolidation)

```
Test Suites: 3 passed, 3 total
Tests:       209 passed, 209 total
Time:        10.136 s
```

PASS

### 10.2 Full AI Service suite (fresh run — independent reconsolidation)

```
Test Suites: 38 passed, 38 total
Tests:       1 skipped, 799 passed, 800 total
Time:        24.293 s
```

PASS — zero failures. 799 passed, 1 skipped (pre-existing).

### 10.3 TypeScript build (fresh run — independent reconsolidation)

```
npm run build → tsc → exit 0
```

PASS

### 10.4 ESLint (fresh check — independent reconsolidation)

```
ESLint couldn't find a configuration file.
```

Confirmed: `git ls-tree -r --name-only HEAD | Select-String` found only `services/api-gateway/.eslintrc.js`. No AI Service ESLint configuration exists. This is **PREEXISTING_UNAVAILABLE** — independently reconfirmed. Non-blocking.

---

## 11. FUTURE/gated capability boundaries

These remain unchanged after EXEC-01C1:

| Boundary | Status |
|---|---|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | false (default unchanged) |
| Frontend `harnessVersion` | Not sent |
| Gateway `agentId`+`harnessVersion` combination | HTTP 400 rejected |
| Browser session `harnessEntitled` | Not set |
| Tool advertisement to providers | Not implemented |
| Provider-native transcripts | Not implemented |
| Mutation tool approval | Not implemented |
| Automatic rollback | Not implemented |
| Specialist/unbound Builder Harness | Out of scope |

Product-visible Harness capability = FUTURE / gated.

---

## 12. Zero runtime/provider/activation activity

- Runtime/Docker/database/staging/browser/provider-live/credit/migrations = 0
- Harness flags changed = NO
- Gateway combination rejection changed = NO
- Frontend changed = NO
- Git commit/push = NO
- EXEC-01C2 registered = NO

---

## 13. Validator result (independent reconsolidation)

Final validator executed after lock and lane release. Proof written outside the repository to `$env:TEMP\AGENT-PLATFORM-EXEC-01C1-RECONSOLIDATION.json`.

Post-lock `git diff --name-only` confirms exactly: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json`, the seven implementation files, and this checkpoint document.

Post-lock `git diff --check`: clean (CRLF warnings only).

---

*Checkpoint created: 2026-09-01 — AGENT-PLATFORM-EXEC-01C1 Step 3 — independent reconsolidation and final lock — no runtime/provider/activation modification.*
