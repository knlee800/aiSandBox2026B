# AGENT-PLATFORM-EXEC-01C4 — Independent Consolidation / Checkpoint / Final Lock

**Task ID:** AGENT-PLATFORM-EXEC-01C4
**Title:** Persisted `agentId` on Harness jobs and Gateway combination contract
**Phase:** INDEPENDENT_CONSOLIDATION
**Result:** PASS
**Date:** 2026-09-04
**Reviewer model:** Opus
**Base SHA:** `9e7ca16213dc647d9514edd0a9e93fc853c00308`
**Implementation SHA:** `2f240fcf9ce0c55d2bf5e30e2dd3d4a45a34754c`
**Commit message:** `feat: propagate persisted agent identity to Harness jobs`
**Branch:** `main`
**Parent umbrella:** AGENT-PLATFORM-EXEC-01C — Persisted User-Agent Harness/Tool-Loop Contract and Safety Umbrella
**Stage-start:** `docs/AGENT-PLATFORM-EXEC-01C-STAGE-START.md` (§6A, §6E, §8.4, §9)
**Locked predecessors:** EXEC-01C1, EXEC-01C2, EXEC-01C3 — all COMPLETE AND LOCKED — PASS

---

## 1. Preflight Confirmation

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `2f240fcf9ce0c55d2bf5e30e2dd3d4a45a34754c` |
| `origin/main` | `2f240fcf9ce0c55d2bf5e30e2dd3d4a45a34754c` |
| Working tree | clean |
| `git diff --check` | clean (CRLF warnings only, exit 0) |
| Commits in range | exactly 1 |
| Changed files | exactly 2 |
| Lane 1 | ACTIVE with EXEC-01C4 |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| GATEWAY | OWNED by EXEC-01C4 |
| GOVERNANCE | UNOWNED |
| Candidate status | ADMITTED / EXACT / `admissionUncertain=false` |
| Candidate write set | matches Lane 1 exactly (two Gateway files) |
| Runtime authorization | all false |
| Product-visible Harness | FUTURE/gated |
| EXEC-01C4B | unregistered |
| Pre-review validator | PASS / `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` |
| `git fetch`/`pull`/`checkout`/`reset`/`clean`/`commit`/`push` | NOT RUN |

---

## 2. Committed Range

Exactly two files changed:

- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `services/api-gateway/src/ai/ai-execution.controller.spec.ts`

No implementation path outside the admitted two-file write set changed.

### Controller changes (`ai-execution.controller.ts`)

**Change 1 — JSDoc comment (lines 378–384):** Updated `resolvePersistedUserAgentForAsk` documentation to reflect that bound Harness is now permitted for `conversation` after owner-scoped load, and added EXEC-01C4 reference.

**Change 2 — Combination rejection narrowing (lines 398–407):** Changed the `agentId + harnessVersion` rejection from unconditional to `executionIntent !== 'conversation'` only. This permits the entitled conversation + agentId + harnessVersion combination while keeping mutation + harnessVersion rejected.

**Change 3 — Queue `agentId` (line 708):** Added `...(persistedUserAgent !== undefined && { agentId: persistedUserAgent.id })` to the enqueue payload, ensuring the canonical persisted agent ID reaches the queue for both Harness and non-Harness bound executions.

### Spec changes (`ai-execution.controller.spec.ts`)

**Existing test updates:**
- Updated suite doc comment (lines 1447–1448)
- Test "Ask conversation" (line 1606): added `expect(payload.agentId).toBe(OWNED_AGENT_ID)` to verify queue now carries `agentId`
- Test "Build workspace_mutation" (line 1763): changed `not.toHaveProperty('agentId')` → `expect(payload.agentId).toBe(OWNED_AGENT_ID)` reflecting queue `agentId` propagation
- Test 8 (line 1789): focused on `workspace_mutation` + `harnessVersion` (previously tested both conversation and mutation variants; conversation case moved to new suite)
- Test "collaboration fields" (line 1875): changed `not.toHaveProperty('agentId')` → `expect(payload.agentId).toBe(OWNED_AGENT_ID)`
- Test "reuse" (line 1906): added queue `agentId` assertion on idempotent reuse path

**New EXEC-01C4 test suite (11 tests):**
1. Entitled owner conversation + agentId + harnessVersion v1 → accepted and queues canonical agentId
2. Whitespace agentId → trimmed for lookup, queue uses canonical persisted ID (deliberately distinguishable `CANONICAL_PERSISTED_AGENT_ID`)
3. Unentitled → 403 before lookup/ledger/enqueue
4. Missing/cross-user/soft-deleted → 404, no ledger/enqueue, body `userId` injection rejected
5. `workspace_mutation` + agentId + harnessVersion → 400 before side effects
6. Omitted intent (defaults to mutation) + agentId + harnessVersion → 400
7. Bound conversation without Harness → accepted, canonical agentId in queue only
8. Bound Build without Harness → accepted, canonical agentId in queue only
9. Ordinary request without agentId → no `agentId` property in queue
10. Unbound entitled Harness without agentId → unchanged behavior
11. Idempotent reuse → canonical agentId in metadata and queue

---

## 3. Findings by Severity

### Critical: 0

### High: 0

### Medium: 0

### Low: 1

**L1 — Error message slight ambiguity for mutation Harness rejection.** The error message `"agentId is not supported when harnessVersion is provided"` is now only triggered for mutation + harnessVersion combinations. The message could be more precise (e.g., `"agentId + harnessVersion is not supported for workspace_mutation"`), but this is a cosmetic observation. The existing message was the pre-existing contract, the test explicitly asserts it, and changing it would be out of scope. No behavioral impact. No security impact.

### Informational: 2

**I1 — AI-Service audit/final-metadata gap remains.** As designed by the frozen boundedness decision, EXEC-01C4 does not propagate `agentId` to Harness audit events or worker final metadata. This requires the later EXEC-01C4B proposal (not registered).

**I2 — Queue `agentId` now flows on non-Harness bound executions too.** The enqueue spread `...(persistedUserAgent !== undefined && { agentId: persistedUserAgent.id })` applies to all bound executions (conversation and Build), not only Harness. This is correct behavior: it enriches the queue payload with canonical persisted agent identity for any bound request. Worker `buildAIExecutionRequest` currently does not consume this field from the job for non-Harness paths, so there is no unintended activation. Tests 7 and 8 verify this explicitly.

---

## 4. Accepted Bound Conversation Proof

| Invariant | Evidence |
|---|---|
| Request accepted and queued | Test 1: `result.status === 'queued'`, `result` has `executionId` |
| Harness entitlement checked before agent resolution | Controller line 497 (entitlement) before line 518 (`resolvePersistedUserAgentForAsk`); Test 3: `findOneByIdAndUserId` not called after 403 |
| Session ownership enforced | Controller line 510; ownership enforced before agent lookup at line 518 |
| `findOneByIdAndUserId` uses authenticated user ID | Controller line 520: `identity.userId`; Test 4: body `userId: 'attacker-user-id'` verified ignored |
| Missing/cross-user/soft-deleted agent → 404 | Controller line 420; Test 4: three sub-assertions |
| Identity prompt composition intact | Controller lines 424–438 unchanged; Test 1: `globalInstructions` contains `FROZEN_IDENTITY_BLOCK` |
| Ledger metadata contains `persistedUserAgent.id` | Controller line 613/634/660; Test 1: `intentDto.metadata?.agentId === OWNED_AGENT_ID` |
| Queue payload contains `persistedUserAgent.id` | Controller line 708; Test 1: `payload.agentId === OWNED_AGENT_ID` |
| Queue payload contains `harnessVersion: 'v1'` | Controller line 703; Test 1: `payload.harnessVersion === 'v1'` |
| Raw request ID not trusted after resolution | Controller line 708 uses `persistedUserAgent.id`, not `request.agentId`; Test 2: distinguishable IDs prove canonical use |
| Response is HTTP 202 queued | Controller lines 712–715; Test 1: `{ executionId, status: 'queued' }` |

---

## 5. Mutation / Default-Intent Fail-Closed Proof

| Invariant | Evidence |
|---|---|
| `workspace_mutation` + agentId + harnessVersion → 400 | Controller lines 401–407: `executionIntent !== 'conversation'`; Test 5 |
| Omitted intent defaults to mutation → 400 | Controller line 501: `undefined → workspace_mutation`; Test 6 |
| No owner lookup after rejection | Tests 5, 6: `findOneByIdAndUserId` not called |
| No ledger or enqueue after rejection | Tests 5, 6: `expectNoLedgerOrEnqueue()` |
| No persisted-agent Harness mutation reaches queue | Combination of Controller lines 401–407 + Tests 5, 6 + absence of any other mutation path |
| Unbound Harness behavior unchanged | Test 10: unbound entitled Harness without agentId succeeds normally with no agentId in queue |

---

## 6. Entitlement and Ownership Ordering Proof

Effective execution order in `AIExecutionController.execute`:

| Step | Controller line | Check |
|---|---|---|
| 1 | 485 | session UUID validation |
| 2 | 490–493 | harnessVersion validation |
| 3 | 497–499 | Harness entitlement (`identity.harnessEntitled`) |
| 4 | 501 | executionIntent normalization (`undefined → workspace_mutation`) |
| 5 | 503–508 | provider/model resolution |
| 6 | 510–515 | session ownership (`getSessionById`, userId check) |
| 7 | 518–522 | persisted-agent resolution (`resolvePersistedUserAgentForAsk`) |
| 8 | 580+ | ledger write |
| 9 | 687+ | enqueue |

| Invariant | Evidence |
|---|---|
| Unentitled → 403 before lookup | Test 3: `ForbiddenException` thrown, `findOneByIdAndUserId` not called |
| Body `userId` cannot replace authenticated identity | Test 4: explicit `userId: 'attacker-user-id'` in body, verified `findOneByIdAndUserId` called with `OWNER_USER_ID` only |
| Invalid/empty/non-string agentId → 400 | Controller lines 394–397 unchanged; existing test 9 |
| Missing `UserAgentService` → 500 | Controller lines 409–412 unchanged; existing tests 11a/11b |
| Rejected requests: no ledger/enqueue | Tests 3, 4, 5, 6: explicit side-effect assertions |

---

## 7. Canonical Queue Identity Proof

| Invariant | Evidence |
|---|---|
| Queue identity from `persistedUserAgent.id` | Controller line 708: `persistedUserAgent.id` |
| Not from raw/trimmed request | Test 2: request sends `OWNED_AGENT_ID`, DB returns `CANONICAL_PERSISTED_AGENT_ID` (`bbbbbbbb-...`), queue gets `CANONICAL_PERSISTED_AGENT_ID` |
| Distinguishable test values | Test 2: `OWNED_AGENT_ID !== CANONICAL_PERSISTED_AGENT_ID` + explicit `not.toBe` assertion on whitespace variant |
| Bound Ask/Build without Harness enqueue canonical ID | Tests 7, 8: `payload.agentId === OWNED_AGENT_ID` |
| Ordinary without agent: no agentId property | Test 9: `payload.not.toHaveProperty('agentId')` |
| Idempotent reuse preserves canonical identity | Test 11: `reuseDto.metadata?.agentId === OWNED_AGENT_ID`, `payload.agentId === OWNED_AGENT_ID` |
| Existing fields not repurposed | Tests 1, 7, 8: payload checks `agentRole`, `builderProfileId` remain independent |

---

## 8. Regression and Non-Activation Proof

| Boundary | Changed? | Evidence |
|---|---|---|
| Harness flags | NO | No env/flag changes in diff |
| Frontend requests | NO | No frontend files changed |
| Browser-session entitlement | NO | No auth guard changes |
| Provider-capability routing | NO | No AI-Service changes |
| AI-Service source | NO | No AI-Service files in diff |
| Harness audit events | NO | Reserved for EXEC-01C4B |
| Worker final metadata | NO | Reserved for EXEC-01C4B |
| Credits/accounting | NO | No billing changes |
| Mutation tools | NO | No tool changes |
| Specialists | NO | No specialist changes |
| Ordinary unbound Builder | NO | Test 10 proves unchanged behavior |
| Migrations | NO | No migration files |
| Runtime architecture | NO | No Docker/compose/env changes |

---

## 9. Test Quality Assessment

| Regression | Would tests detect? | How? |
|---|---|---|
| Conversation combination still 400 | YES | EXEC-01C4 Test 1 fails (expects success) |
| Bypassing entitlement | YES | EXEC-01C4 Test 3 (expects 403) |
| Lookup before entitlement | YES | EXEC-01C4 Test 3 (`findOneByIdAndUserId` not called) |
| Body userId injection | YES | EXEC-01C4 Test 4 (checks authenticated userId used) |
| Cross-user/deleted agent | YES | EXEC-01C4 Test 4 (expects 404) |
| Queueing raw agentId | YES | EXEC-01C4 Test 2 (distinguishable IDs) |
| Omitting agentId from queue | YES | EXEC-01C4 Tests 1, 7, 8 (assert agentId present) |
| Mutation/default-mutation Harness | YES | EXEC-01C4 Tests 5, 6 (expect 400) |
| Ledger/enqueue after rejection | YES | EXEC-01C4 Tests 3, 4, 5, 6 (side-effect checks) |
| agentId on ordinary unbound | YES | EXEC-01C4 Test 9 (`not.toHaveProperty`) |
| Breaking non-Harness Ask/Build | YES | EXEC-01C4 Tests 7, 8 |
| Breaking idempotent reuse | YES | EXEC-01C4 Test 11 |
| Removing identity composition | YES | EXEC-01C4 Test 1 (globalInstructions contains identity block) |
| Changing unbound Harness | YES | EXEC-01C4 Test 10 |

No assertions identified that pass without proving the intended invariant. Test 2's distinguishable-ID pattern is particularly strong for proving canonical identity propagation.

---

## 10. Verification Results

### Targeted Controller Spec

```
PASS src/ai/ai-execution.controller.spec.ts (19.254 s)
Tests: 72 passed, 72 total
```

All 11 EXEC-01C4 tests + all 61 existing tests pass.

### Coupled Gateway AI Execution Suites

All 72 tests in the execution controller spec pass, covering:
- Session UUID validation (05B9)
- harnessVersion wiring (05C2)
- Session ownership (05C5)
- Upstream identity propagation (06)
- Harness entitlement gate (05C7)
- Provider/model catalogue (FR-04B)
- executionIntent propagation (BUILDER-INTENT-01)
- Persisted user-agent identity (CREATE-01D / EXEC-01A)
- EXEC-01C4 bound Harness combination and queue agentId

### Full Gateway Jest Suite

```
Test Suites: 1 failed, 1 skipped, 167 passed, 168 of 169 total
Tests:       13 failed, 6 skipped, 2139 passed, 2158 total
```

The 1 failing suite is `smoke.integration.spec.ts` which requires running NestJS/Docker/Postgres/Redis runtime infrastructure. All 13 failures are within that environmental integration suite. No code-level test failures.

`ts-jest` diagnostics disabled via temporary config (written to `$env:TEMP`) to isolate the pre-existing `queue.service.ts` TS2322 compiler blocker — confirmed unmodified and outside the committed range.

### API Gateway TypeScript Build

```
npx tsc --noEmit: exit 1
1 error: queue.service.ts(24,7) TS2322
```

Pre-existing `queue.service.ts` TS2322 ioredis/bullmq type mismatch. This file is:
- Outside the committed range
- Unchanged by EXEC-01C4
- The identical BullMQ/ioredis type mismatch already recorded by EXEC-01A, EXEC-01B, EXEC-01C1, EXEC-01C2, EXEC-01C3 checkpoints
- Neither admitted file produces a TypeScript error

### API Gateway Lint

```
13 ESLint errors across both files
```

All 13 lint errors are pre-existing:
- `ai-execution.controller.ts` line 478: `req` unused (pre-existing)
- `ai-execution.controller.spec.ts` lines 11, 60, 396, 403, 415, 422, 552, 1049, 1056, 1430, 1519, 1842: `no-unused-vars` and `no-explicit-any` (all pre-existing, all outside diff hunks)

No new lint violations introduced by the implementation.

### git diff --check

Clean (exit 0). CRLF warnings only.

---

## 11. Activity Ledger

| Activity | Count |
|---|---|
| Runtime/Docker | 0 |
| PostgreSQL | 0 |
| Redis | 0 |
| Staging | 0 |
| Browser | 0 |
| Provider-live calls | 0 |
| Credit mutations | 0 |
| Migrations | 0 |
| Frontend changes | 0 |
| AI-Service changes | 0 |
| Git commit | 0 |
| Git push | 0 |

---

## 12. Final State

| Item | State |
|---|---|
| EXEC-01C4 | COMPLETE AND LOCKED — PASS |
| Lane 1 | EMPTY (released) |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| GATEWAY | UNOWNED (released) |
| GOVERNANCE | UNOWNED |
| Candidate status | LOCKED |
| Umbrella EXEC-01C | READY / NOT ADMITTED / PROVISIONAL |
| Product-visible Harness | FUTURE/gated |
| Harness flags | unchanged / false |
| EXEC-01C4B | NOT REGISTERED |
| Later children 01C5..01C9 | NOT REGISTERED |
| AI-Service audit/final metadata gap | RESERVED for EXEC-01C4B |
| Runtime authorization | all false |

---

## 13. Pre-existing Classification

| Issue | Classification | Evidence |
|---|---|---|
| `queue.service.ts` TS2322 | Pre-existing, non-blocking | Outside committed range, unchanged, identical BullMQ/ioredis mismatch recorded by all prior EXEC-01C* checkpoints |
| 13 ESLint errors | Pre-existing, non-blocking | All at lines outside diff hunks; no new violations introduced |
| `smoke.integration.spec.ts` failures | Pre-existing, environmental | Requires runtime infrastructure not available in this consolidation |

---

*Checkpoint created: 2026-09-04 — AGENT-PLATFORM-EXEC-01C4 Step 3 — independent consolidation / checkpoint / final lock — no implementation source modification — no runtime/provider/staging/browser/credit/migration activity.*
