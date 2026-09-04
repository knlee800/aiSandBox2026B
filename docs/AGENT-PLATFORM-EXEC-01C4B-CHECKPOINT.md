# AGENT-PLATFORM-EXEC-01C4B — Checkpoint — COMPLETE AND LOCKED — PASS

**Task ID:** AGENT-PLATFORM-EXEC-01C4B
**Title:** Persisted agent identity in Harness audit and final metadata
**Phase:** INDEPENDENT_CONSOLIDATION (Step 3)
**Result:** PASS
**Date:** 2026-09-04
**Base SHA:** `b548453887f5e6acb81200d258212dd446c9b295`
**Implementation SHA:** `7fd1878572adfce3d26c89a4353051c695889eaf`
**Commit message:** `feat: propagate persisted agent identity through Harness audit`
**Commit count in range:** 1

---

## 1. Exact implementation range (five admitted files)

1. `services/ai-service/src/agent-harness/audit/harness-audit-events.ts`
2. `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts`
3. `services/ai-service/src/worker/worker.processor.ts`
4. `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts`
5. `services/ai-service/src/worker/worker.processor.spec.ts`

No other files changed. Range confirmed by `git diff --name-only`.

---

## 2. Findings by severity

### CRITICAL: 0
### HIGH: 0
### MEDIUM: 0

### LOW: 0

### INFORMATIONAL: 2

**I-1: `CANONICAL_AGENT_ID` test constant includes leading/trailing whitespace.**
The constant `'  persisted-agent-01C4B  '` intentionally contains surrounding spaces to prove that the implementation copies the value exactly without trimming. This is a positive testing decision, not a defect. INFORMATIONAL.

**I-2: `config_resolved` log test uses source-text inspection rather than behavioral assertion.**
The `config_resolved` structured log is emitted only on the gated Harness path (`useHarness === true`), which requires `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` — a flag that remains `false`. The test uses `fs.readFileSync` to prove the production expression `agentId: job.data.agentId ?? null` exists identically in both route and config log blocks, then behaviorally verifies the expression semantics with local object construction. Given the gated path, this is the most accurate approach without toggling flags. INFORMATIONAL.

---

## 3. Audit identity propagation proof

### Queue-to-audit trace

The canonical chain is:

1. **Queue source:** `job.data.agentId` (optional string from Gateway enqueue, established by EXEC-01C4)
2. **Worker request construction:** `buildAIExecutionRequest(job.data, ...)` → `jobData.agentId` directly assigned to `AIExecutionRequest.agentId` (line 511 worker.processor.ts)
3. **Loop entry:** `executeAgentHarnessLoop(options)` receives `request.agentId`
4. **Base event factory:** `baseEvent()` at line 228–234 of agent-harness-loop.ts:
   ```
   const baseEvent = () => ({
     timestamp: Date.now(),
     executionId,
     sessionId: request.sessionId,
     harnessVersion: 'v1',
     ...(request.agentId !== undefined ? { agentId: request.agentId } : {}),
   });
   ```
5. **Every recorded event:** All 12 event types (loop_started, model_invocation_started, model_invocation_completed, tool_dispatch_started, tool_dispatch_completed, tool_dispatch_failed, tool_result_budget_exceeded, loop_completed, loop_max_turns, loop_aborted, loop_no_dispatcher, model_invocation_failed) spread `...baseEvent()`, inheriting the same `agentId`.

### Identity source verification

- `agentId` is sourced only from `job.data.agentId` → `request.agentId`
- Prompt text is not parsed for identity (test uses `PROMPT_INJECTED_ID` in prompt and asserts it never appears as `agentId`)
- `agentRole`, `builderProfileId`, `sessionId`, and `executionId` are not reused as `agentId` (test explicitly asserts `not.toBe` for each)
- The value is copied exactly without trimming, rewriting, or generating a replacement (whitespace-padded test constant `'  persisted-agent-01C4B  '` proves exact copy)
- `executionId`, `sessionId`, and `agentId` remain separate fields (test asserts all three are distinct)
- Unbound loop executions do not receive an invented ID (dedicated unbound test asserts `undefined`)
- The audit recorder (`InMemoryHarnessAuditRecorder`) is a generic `push` store that does not strip, transform, or filter optional properties

### Representative event stream coverage

Verified through tests:

| Event type | Covered by test |
|---|---|
| `harness.loop_started` | bound tool-dispatch stream test |
| `harness.model_invocation_started` | bound tool-dispatch stream test |
| `harness.model_invocation_completed` | bound tool-dispatch stream test |
| `harness.tool_dispatch_started` | bound tool-dispatch stream test |
| `harness.tool_dispatch_completed` | bound tool-dispatch stream test |
| `harness.tool_dispatch_failed` | dedicated failure event test |
| `harness.tool_result_budget_exceeded` | dedicated budget path test |
| `harness.loop_completed` | bound tool-dispatch stream test |
| `harness.loop_max_turns` | dedicated max-iteration test |

Every event in each bound stream carries the same exact agent ID via `expectAllEventsCarryIdentity()`.

---

## 4. Execution/session/agent ID separation

- `executionId` = canonical Gateway UUID (e.g., `'exec-canonical-01C4B'`)
- `sessionId` = workspace session (e.g., `'sess-workspace-01C4B'`)
- `agentId` = persisted user-agent ID (e.g., `'  persisted-agent-01C4B  '`)
- All three are separate constants with no shared values
- Tests assert: `executionId !== sessionId`, `agentId !== sessionId`, `agentId !== executionId`

---

## 5. Sequential and concurrent isolation proof

**Sequential isolation:** Two sequential `executeAgentHarnessLoop` calls with different agent IDs (`CANONICAL_AGENT_ID` and `OTHER_AGENT_ID`) use separate recorders. First recorder events carry only `CANONICAL_AGENT_ID`; second recorder events carry only `OTHER_AGENT_ID`. Cross-contamination explicitly asserted absent.

**Concurrent isolation:** `Promise.all` runs two loops concurrently with different IDs and separate recorders. Same isolation assertions. The loop uses function-local `baseEvent()` closure over `request.agentId`, so no shared mutable state exists between concurrent invocations.

---

## 6. Structured-log proof

### `agent_harness.route_evaluated`

**Production code (line 937–944 worker.processor.ts):**
```
JSON.stringify({
  event: 'agent_harness.route_evaluated',
  executionId: job.data.executionId,
  agentId: job.data.agentId ?? null,
  harnessVersion: job.data.harnessVersion ?? null,
  ...
})
```

- Bound job: emits exact `job.data.agentId` (test parses logger spy output, asserts `.agentId === CANONICAL_AGENT_ID`)
- Unbound job: emits `null` (test asserts `.toHaveProperty('agentId', null)`)
- No prompt, agentRole, globalInstructions, or agent description content emitted (test asserts `.not.toHaveProperty('prompt')` and `.not.toHaveProperty('agentRole')`)
- Existing fields and event name remain intact
- The route log is emitted on every execution path (both gated and plain), so it always records the queue identity

### `agent_harness.config_resolved`

**Production code (line 978–987 worker.processor.ts):**
```
JSON.stringify({
  event: 'agent_harness.config_resolved',
  executionId: job.data.executionId,
  agentId: job.data.agentId ?? null,
  source: configResolutionMetadata.source,
  ...
})
```

- Uses identical expression `job.data.agentId ?? null` (source-text assertion confirms)
- Does not contain `prompt`, `agentRole`, or `globalInstructions` keys (source-text regex assertion confirms)
- This log only emits on the gated Harness path; the behavioral expression test proves bound→exact-ID and unbound→null semantics
- Data minimization: neither log includes agent name, description, prompt contents, identity block, or other sensitive persona content

### Global Harness gate and routing behavior

The addition of `agentId` to structured logs does not change any condition or control flow. The `agentId` field is added after existing fields in both log statements. No `if` condition references the new field. The global Harness gate (`enableToolLoop`) and routing (`resolveHarnessRouting`) remain unchanged.

---

## 7. Completed/failure metadata proof

### `nextMetadata` control flow

At line 1263 of worker.processor.ts:
```typescript
const nextMetadata: Record<string, unknown> = {
  ...existingMetadata,
  aiExecutionResult: { ... },
};
```

Then at line 1278:
```typescript
if (job.data.agentId !== undefined) nextMetadata.agentId = job.data.agentId;
```

This explicit assignment **after** the spread means:
- When `job.data.agentId` exists, it explicitly sets `nextMetadata.agentId`, overriding any stale `existingMetadata.agentId`
- Unrelated existing metadata is preserved (the spread copies everything first)
- When `job.data.agentId` is `undefined` (unbound), the `if` guard prevents inventing an ID

### Shared finalization path

Both the successful completion path (line 1361–1370: `SET execution_status = 'completed'` with `JSON.stringify(nextMetadata)`) and the contract-failure path (line 1313–1321: `SET execution_status = 'failed'` with `JSON.stringify(nextMetadata)`) use the **same `nextMetadata` object**. The `nextMetadata` object is constructed once, identity fields are set once, then both paths serialize it.

### Test proof

- **Completed metadata:** bound job → `metadata.agentId === CANONICAL_AGENT_ID`, `metadata.keepMe === 'unrelated-value'`, `agentId !== sessionId`, `agentId !== executionId`
- **Stale metadata override:** existing metadata with `agentId: STALE_AGENT_ID` → after bound job, `metadata.agentId === CANONICAL_AGENT_ID`, `!== STALE_AGENT_ID`, `keepMe` preserved
- **Contract-failure metadata:** bound job with `executionIntent: 'workspace_mutation'` (triggers contract failure) → `metadata.agentId === CANONICAL_AGENT_ID`, `metadata.keepMe` preserved, `metadata.executionError` present
- **Unbound metadata:** unbound job → `metadata` does NOT have property `agentId`, `metadata.keepMe` preserved

### Other finalization paths

The catch/finally paths for uncaught exceptions and timeout/cancellation do not use `nextMetadata` — they write status without metadata serialization. These paths do not touch `agentId` either in the pre-existing code or in this change, which is correct: a thrown exception before `nextMetadata` is constructed means the identity was never part of the finalization, and the initial ledger metadata (written at enqueue by the Gateway) already contains `agentId` when present.

### Credit/accounting semantics

No credit, retry, refund, or ledger-status semantics changed. The `if (job.data.agentId !== undefined)` guard is purely metadata — it does not affect `execution_status`, `tokens_used`, deduction triggers, or the `notifyExecutionComplete` call. Existing `agentRole`, `builderProfileId`, collaboration, and referral metadata behavior remains intact (identical pattern on subsequent lines).

---

## 8. Unbound compatibility

- Unbound jobs have `job.data.agentId === undefined`
- `buildAIExecutionRequest` assigns `jobData.agentId` which is `undefined` → `request.agentId` is `undefined`
- Loop `baseEvent()` conditional spread: `request.agentId !== undefined` is false → `agentId` key omitted from event objects
- Structured logs: `job.data.agentId ?? null` → `null`
- Final metadata: `job.data.agentId !== undefined` is false → `if` guard not entered → no `agentId` invented
- Tests: unbound audit events have `agentId === undefined`; unbound metadata has no `agentId` property; unbound route log has `agentId: null`

---

## 9. Regression and non-activation proof

The commit changes **only** three production files within `services/ai-service/`:

| Category | Changed? | Evidence |
|---|---|---|
| Gateway source | NO | `git diff --name-only` shows zero Gateway files |
| Frontend requests | NO | Zero frontend files |
| Harness environment flags | NO | No `.env` or config changes; `enableToolLoop` still `false` |
| Provider adapters | NO | Zero adapter file changes |
| Native transcript behavior | NO | No adapter changes |
| Tool advertisement/permissions | NO | No tool-registry or mapper changes |
| Entitlements | NO | No auth or guard changes |
| Credit/accounting rules | NO | Metadata assignment is additive identity only |
| Approval/rollback behavior | NO | No approval or checkpoint changes |
| Specialists | NO | No specialist changes |
| Ordinary unbound Builder | NO | Unbound behavior explicitly tested and unchanged |
| xAI/Grok tool capability | NO | No xAI adapter changes |
| Migrations/runtime architecture | NO | Zero migration files |

Product-visible Harness remains FUTURE/gated. Flags remain `false`. Frontend does not send `harnessVersion`.

---

## 10. Test-quality assessment

| # | Requirement | Covered | Test |
|---|---|---|---|
| 1 | Missing agent ID on bound audit events | YES | `expectAllEventsCarryIdentity` on all bound tests |
| 2 | Agent ID confused with execution ID or session ID | YES | `expect(agentId).not.toBe(executionId)`, `not.toBe(sessionId)` |
| 3 | One event in bound multi-event stream dropping identity | YES | `expectAllEventsCarryIdentity` iterates all events |
| 4 | Prompt-injected identity being trusted | YES | `PROMPT_INJECTED_ID` in prompt, asserted not on any event |
| 5 | Unbound identity invention | YES | dedicated unbound test asserts `undefined` |
| 6 | Sequential identity leakage | YES | dedicated sequential test with two IDs |
| 7 | Concurrent identity leakage | YES | dedicated concurrent test with `Promise.all` |
| 8 | Route log missing exact bound ID | YES | worker spec asserts `routeEvents[0].agentId === CANONICAL_AGENT_ID` |
| 9 | Unbound route log not using `null` | YES | worker spec asserts `.toHaveProperty('agentId', null)` |
| 10 | Config log missing queue-backed ID expression | YES | source-text + behavioral expression test |
| 11 | Completed final metadata dropping identity | YES | worker spec asserts `metadata.agentId === CANONICAL_AGENT_ID` |
| 12 | Failure final metadata dropping identity | YES | contract-failure test asserts `metadata.agentId === CANONICAL_AGENT_ID` |
| 13 | Stale metadata overriding queue identity | YES | dedicated test with `STALE_AGENT_ID` in existing metadata |
| 14 | Unrelated metadata being lost | YES | all metadata tests verify `keepMe === 'unrelated-value'` |
| 15 | Unbound completion inventing identity | YES | unbound metadata test asserts `.not.toHaveProperty('agentId')` |

No tests merely repeat production expressions without demonstrating a meaningful invariant. The source-text test for `config_resolved` is justified by the gated path constraint (see I-2 above).

---

## 11. Fresh verification results

| Check | Result |
|---|---|
| Targeted specs (loop + worker) | 183 passed, 0 failed |
| Coupled specs (audit-recorder + builder-config + mutation-validation) | 76 passed, 0 failed |
| Full AI-Service Jest suite | 38 suites passed, 848 passed, 1 skipped, 0 failed |
| AI-Service TypeScript build (`tsc`) | PASS (exit code 0, no errors) |
| AI-Service lint | PREEXISTING_UNAVAILABLE (no ESLint configuration in committed tree) |
| `git diff --check` | PASS (no trailing whitespace) |
| `git status --short` | clean (no dirty files) |
| Pre-review lane-capacity validator | PASS / `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` |

---

## 12. Product-visible Harness state

- Harness flags: unchanged / `false` (`AGENT_HARNESS_ENABLE_TOOL_LOOP=false`)
- Frontend: does not send `harnessVersion`
- Browser sessions: cannot pass `harnessEntitled`
- Gateway combination: `agentId` + `harnessVersion` accepted only for entitled `conversation` (EXEC-01C4); product users cannot reach this
- Product-visible Harness: FUTURE / gated / disabled / unavailable to users

---

## 13. Runtime activity

| Category | Count |
|---|---|
| Runtime activity | 0 |
| Docker activity | 0 |
| Database activity | 0 |
| Staging activity | 0 |
| Browser activity | 0 |
| Provider-live calls | 0 |
| Credit mutations | 0 |
| Migrations | 0 |
| Git commit | NO |
| Git push | NO |

---

## 14. EXEC-01C5 registration

EXEC-01C5 remains unregistered. No later children (01C5..01C9) registered.

---

## 15. Control-plane end state

| Item | State |
|---|---|
| AGENT-PLATFORM-EXEC-01C4B | COMPLETE AND LOCKED — PASS |
| Candidate status | LOCKED |
| `lockedTaskIds` | AGENT-PLATFORM-EXEC-01C4B added |
| Lane 1 | EMPTY |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| AI-SERVICE | UNOWNED |
| GOVERNANCE | UNOWNED |
| EXEC-01C umbrella | READY / NOT ADMITTED / PROVISIONAL / `admissionUncertain=true` |
| EXEC-01C4B child # in umbrella | 5th completed-and-locked child |
| Runtime authorization | all false |
| PRIVATE-BETA-INVITE-01 | PROHIBITED |

---

*Checkpoint created: 2026-09-04 — AGENT-PLATFORM-EXEC-01C4B Step 3 — independent consolidation / checkpoint / final lock — PASS*
