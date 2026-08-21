# PRIVATE-BETA-E2E-AUTO-01H — Final Checkpoint

**Task ID:** PRIVATE-BETA-E2E-AUTO-01H  
**Title:** Correct `submitBuild` executionId Observation (`POST /api/ai/executions` matcher → real `POST /api/ai/execute` 202 JSON)  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-21  
**Checkpoint Date:** 2026-08-21  
**Lifecycle:** 3-step bounded task (AUTOMATION_TOOLING_INVESTIGATION + bounded AUTOMATION_TOOLING_FIX)  
**Workstream:** RELIABILITY  
**Evidence class:** LOCAL-TESTS  
**Lane:** Lane 1 (now released EMPTY)  
**Parent:** PRIVATE-BETA-E2E-AUTO-01 (COMPLETE AND LOCKED — PASS)  
**Triggering evidence:** PRIVATE-BETA-E2E-LIVE-06 (COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — WAIT_FOR_AUTO_APPLY — 2026-08-21)  
**Predecessor:** PRIVATE-BETA-E2E-AUTO-01G (COMPLETE AND LOCKED — PASS — 2026-08-21) recorded this defect as residual / unfixed and did not fix it  
**Diagnosis:** `docs/PRIVATE-BETA-E2E-AUTO-01H-DIAGNOSIS.md`

Do not treat this checkpoint as a scheduler. Do not modify AUTO-01H implementation. Do not reopen AUTO-01/01A/01B/01C/01D/01E/01F/01G. Do not rerun LIVE-06. Do not convert LIVE-06 to PASS. Do not register PRIVATE-BETA-E2E-LIVE-07 here. Do not register PRIVATE-BETA-INVITE-01.

Step 2 implementation is already on HEAD `25c25bd79c205c52838b3d151c73a0bc4a4de13f` (`fix Builder execution ID observation`). Keith owns Git. This consolidation does not commit.

---

## Final verdict

```
FINAL_VERDICT=COMPLETE AND LOCKED — PASS — 2026-08-21
PRODUCT_FAILURE=NO
PRODUCT_SOURCE_MODIFIED=NO
AUTOMATION_IMPLEMENTATION_MODIFIED=YES (runner-only; no product source)
LIVE_RUNS=0
SSH_CONNECTIONS=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS_MUTATED=0
GATE_MUTATION=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
PHASE_ORDER_CHANGED=NO
ROOT_CAUSE_PROVEN=YES
CORRECT_OBSERVATION_SIGNAL_PROVEN=YES
TYPESCRIPT_PASS=YES
CONTRACT_TESTS=99
CONTRACT_PASS=99
CONTRACT_FAIL=0
NEW_AUTO_01H_TESTS=11
GIT_DIFF_CHECK=PASS
DEDUCTION_IMPLEMENTATION_MODIFIED=NO
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

---

## Step 1 — Frozen root-cause proof (COMPLETE — 2026-08-21)

Diagnosis: `docs/PRIVATE-BETA-E2E-AUTO-01H-DIAGNOSIS.md`.

`submitBuild()` previously observed the **wrong** request:

```
POST /api/ai/executions
```

That collection POST does **not** exist for the real Builder execution flow. Repo search found no `@Post('executions')` collection create route. Public `/api/ai/executions*` routes are GET status, GET SSE stream, POST cancel, and POST confirm-build-apply — none of them create the execution.

The real product request is:

```
POST /api/ai/execute
```

and returns:

```
HTTP 202
{ executionId, status: "queued" }
```

The Gateway creates `executionId` with `uuidv4()`, writes execution intent, enqueues the job, and **returns that same ID** to the frontend **before** the provider call.

### LIVE-06 linkage

LIVE-06 proved:

```
runner executionId: null
DB executionId:     1a995035-6b1c-431b-acc2-8dd1e51a53da
LAST_SUCCESSFUL_PHASE=BUILD
```

The old runner:

- waited approximately `BUILD_TIMEOUT_SAFE=120000ms` for a nonexistent collection POST
- never observed the real `POST /api/ai/execute`
- swallowed `TimeoutError` in an empty `catch`
- returned `executionId` undefined
- still marked BUILD successful

This was an **AUTOMATION observation defect**. **No product defect was proven.** LIVE-06 remains COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — WAIT_FOR_AUTO_APPLY and is **not** converted to PASS.

---

## Step 2 — Implementation (COMPLETE — PASS — 2026-08-21)

Exact changed files (automation only; no production source; no package/lockfile):

```
e2e/builder-golden-path/lib/constants.ts
e2e/builder-golden-path/lib/live-adapters.ts
e2e/builder-golden-path/lib/local-fixture.ts
e2e/builder-golden-path/lib/network.ts
e2e/builder-golden-path/tests/live-adapters.spec.ts
```

Step 2 HEAD: `25c25bd79c205c52838b3d151c73a0bc4a4de13f`

### Real `/api/ai/execute` contract now observed

Correct observation now requires:

| Field | Required value |
|---|---|
| Method | `POST` |
| Pathname | `/api/ai/execute` (`isAiExecuteUrl`; `/\/api\/ai\/execute\/?$/`; does **not** match `/api/ai/executions…`) |
| Response | HTTP **202** |
| JSON `executionId` | non-empty string after trim |
| Fallback to `id` | **NONE** |

### 202 JSON `executionId` transport

Gateway returns `{ executionId, status: "queued" }` on 202. `submitBuild` now:

1. arms `page.waitForResponse` for `POST` + `isAiExecuteUrl` **immediately before** Send
2. requires status `202`
3. reads the finite JSON body through runner-owned `readBuildExecutionBody`
4. parses `executionId` only (`parseBuildExecutionId`; no `id` fallback)
5. returns that exact string as `build.executionId`

### Finite response / body bounds

```
BUILD_EXECUTION_RESPONSE_TIMEOUT_MS = 30000
BUILD_EXECUTION_BODY_TIMEOUT_MS     = 30000
```

Both are runner-owned finite bounds. The body read is separately bounded because Playwright `response.json()` itself does not inherit an action timeout.

CONTRACT injects 400ms observation bounds so tests cannot wait 30s / 120s.

### Typed fail-closed behavior

Typed error: `BuildExecutionObservationError`

Fail-closed cases:

- response not observed
- non-202 status
- response body stalls
- malformed JSON
- `executionId` missing
- `executionId` empty

The previous empty `catch` / null degradation was **removed**. BUILD no longer continues without execution identity.

`BUILD_TIMEOUT_SAFE = 120000` was removed only because repo-wide inspection proved it became unused after the matcher change.

### One-provider semantics (preserved)

```
providerGuard.authorizeCall(): once
Send click:                    once
POST /api/ai/execute:          once
Retries:                       0
Provider fallback:             none
Second Build submission:       none
```

Observation is armed immediately **BEFORE** Send. No ARM_LISTENERS phase movement was required. Frozen 14-phase order unchanged.

### Fixture correction

The faithful fixture now matches product behavior:

```
ONE  POST /api/ai/execute → 202 { executionId: "exec-real-flow", status: "queued" }
ZERO POST /api/ai/executions (collection)
```

The previous fake collection POST was removed from the faithful Builder Send path. A collection POST, if it ever arrives, is counted and 404s; it is not required and is not emitted by the corrected page script.

### TDD RED evidence (Step 2, recorded; not re-run as RED)

Faithful real-route fixture:

```
POST /api/ai/execute → 202
executionId = exec-real-flow
POST /api/ai/executions count = 0
```

Pre-fix `submitBuild` returned:

```
undefined
```

Expected:

```
exec-real-flow
```

Observed RED approximately **929ms** using injected 400ms observation bound.

This directly reproduced the LIVE-06 null-executionId defect without staging or provider activity.

### Execution ID propagation through DEDUCTION

Exact semantic chain:

```
POST /api/ai/execute 202: exec-real-flow
  → submitBuild():            exec-real-flow
  → runner build.executionId: exec-real-flow
  → verifyDeduction(executionId): exec-real-flow
```

`verifyDeduction` implementation itself was **NOT** changed. AUTO-01H Step 1 proved the existing DEDUCTION verification is sufficient once given the correct `executionId`.

### Prior fixes — unchanged / regressions passing

- AUTO-01D: unchanged / regressions passing — do not reopen
- AUTO-01E: unchanged / regressions passing — do not reopen
- AUTO-01F: unchanged / regressions passing — do not reopen
- AUTO-01G: unchanged / regressions passing — do not reopen

Do not reopen any historical task.

---

## Step 3 — Fresh verification (COMPLETE — 2026-08-21)

Do **not** lock AUTO-01H only from the Step 2 report. All three verifications were run fresh in this Step 3 against HEAD `25c25bd79c205c52838b3d151c73a0bc4a4de13f` on a **CLEAN** tree (`git status --short` empty) before governance writes.

### TypeScript

```
npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json
EXIT=0
RESULT=PASS
```

### CONTRACT

```
npm run e2e:builder:contract
Running 99 tests using 10 workers
99 passed (9.2s)
0 failed
RESULT=PASS
```

Required proven behavior includes:

- real `/api/ai/execute` route returns exact `executionId`
- collection POST count = 0
- execute POST count = 1
- Send count = 1
- ProviderGuard `usedCount` = 1
- missing execute response fails bounded
- wrong status fails
- malformed JSON fails
- missing `executionId` fails
- empty `executionId` fails
- stalled body fails using runner-owned timeout
- no 120-second successful-flow dead wait
- no SSE body read
- no DB fallback
- no retry

AUTO-01D/E/F/G regressions remain in the same 99-test suite and passed.

### git diff --check

```
git diff --check
EXIT=0
RESULT=PASS
```

### Activity log (Step 3)

```
LIVE_RUNS=0
REAL_SSH=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS=0
GATE_MUTATION=0
PRODUCT_MUTATION=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
PLAYWRIGHT_LIVE=NO
```

---

## Builder readiness

```
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

AUTO-01H remains **CONTRACT-only**. The automated runner still has not completed the mandatory full golden path against staging.

---

## Next recommended lifecycle

AUTO-01G fixed the known AUTO_APPLY observation blocker.  
AUTO-01H fixes the known BUILD executionId blocker.

Step 3 found **no new safety-critical blocker**.

Therefore the proper next gate is a **fresh provider-bearing automated LIVE Builder E2E**.

**Likely identifier:** `PRIVATE-BETA-E2E-LIVE-07` (verify unused at future registration).

Repo search at this lock found **zero** `### PRIVATE-BETA-E2E-LIVE-07` registry entries. Occurrences of the string are rejected-alternative prose in AUTO-01G/AUTO-01H registration only. Historical prose does not count as registration.

**Do NOT register LIVE-07 here.**

Known residual items (recorded, NOT fixed, NOT registered here, NOT safety-critical for this lock):

- unrelated `page.goto()` timeout
- provider/model `selectOption` fallback hardening
- `trace` remains `off`

Do **not** start another tooling lifecycle for those before LIVE unless later evidence proves one is safety-critical.

Do not rerun or rewrite LIVE-06. Do not reopen AUTO-01/01A/01B/01C/01D/01E/01F/01G. Do not register PRIVATE-BETA-INVITE-01.

---

## Lane and resource state

```
Lane 1: EMPTY (released at lock)
Lane 2: EMPTY
Lane 3: DISABLED
GOVERNANCE: UNOWNED (acquired for this Step 3 checkpoint/board/registry write, then released)
STAGING: UNOWNED
PROVIDER-LIVE: UNOWNED
CREDIT: UNOWNED
ENV: UNOWNED
PACKAGE: UNOWNED
LOCAL-RUNTIME: UNOWNED
FRONTEND: UNOWNED
GATEWAY: UNOWNED
AI-SERVICE: UNOWNED
CONTAINER-MANAGER: UNOWNED
All HOTFILE leases: UNOWNED (AUTO-01H Step 2 leases released:
  e2e/builder-golden-path/lib/constants.ts
  e2e/builder-golden-path/lib/live-adapters.ts
  e2e/builder-golden-path/lib/local-fixture.ts
  e2e/builder-golden-path/lib/network.ts
  e2e/builder-golden-path/tests/live-adapters.spec.ts)
```

---

*Checkpoint created 2026-08-21 — PRIVATE-BETA-E2E-AUTO-01H Step 3 — GOVERNANCE / CONSOLIDATION ONLY — no staging, Playwright LIVE, provider, credits, gate mutation, runner fix, product source, package, or Git mutation — TypeScript PASS — 99 CONTRACT tests PASS — git diff --check PASS — COMPLETE AND LOCKED — PASS — BUILDER EXECUTION ID NOW OBSERVED FROM BOUNDED POST /API/AI/EXECUTE 202 JSON AND PROPAGATED TO DEDUCTION*
