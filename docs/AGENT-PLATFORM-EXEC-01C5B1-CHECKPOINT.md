# AGENT-PLATFORM-EXEC-01C5B1 — Checkpoint

**Task ID:** AGENT-PLATFORM-EXEC-01C5B1
**Title:** Gateway Harness entitlement proof production and producer hardening
**Phase:** INDEPENDENT_SECURITY_RECONSOLIDATION
**Result:** PASS
**Date:** 2026-09-06
**Reviewer:** Independent (Opus 4.6)
**Nature:** 3-step IMPLEMENTATION — Step 3 independent security reconsolidation after repairs

---

## 1. Implementation range

**Base SHA:** `99085ef15f1e8d43d44fac16a6b38b02313fc60a`
**Implementation SHA:** `036cc36c2134d4d53fb41da2e67e4ee657a39a28`

### Exactly three commits:

1. `f33c058e3f384def2710ae64aa5e936d06607d8d` — `feat: sign Gateway Harness entitlement proofs`
2. `4f4dbba0910e96340d600c03bbbf9997d1fabe11` — `fix: preserve prototype-sensitive entitlement payload keys`
3. `036cc36c2134d4d53fb41da2e67e4ee657a39a28` — `fix: validate Harness signing secret before side effects`

### Exactly six files changed:

1. `services/api-gateway/src/ai/ai-execution.controller.ts`
2. `services/api-gateway/src/ai/ai-execution.controller.spec.ts`
3. `services/api-gateway/src/orchestration/orchestration.service.ts`
4. `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts`
5. `services/api-gateway/.env.example`
6. `services/ai-service/.env.example`

---

## 2. Security findings

### HIGH-001 — Prototype pollution via inherited `__proto__` setter in `sortKeysRecursive` (CLOSED)

**Severity:** HIGH
**Commit:** `4f4dbba0910e96340d600c03bbbf9997d1fabe11`
**Fix:** Changed `sortKeysRecursive` accumulator from `{}` to `Object.create(null)` at every object level.

**Independent closure proof (31/31 assertions passed):**

- Own `__proto__` with object value survives canonicalization
- Own `__proto__` with primitive value survives canonicalization
- `constructor` key survives canonicalization
- `prototype` key survives canonicalization
- Nested `__proto__` survives canonicalization at every level
- Changing only `__proto__` value changes the digest
- No inherited `__proto__` setter is invoked
- Every sorted result's prototype is `null`
- `Object.prototype` is not polluted
- Golden vector output remains byte-identical

### MEDIUM-001 — Signing secret read after side effects (CLOSED)

**Severity:** MEDIUM
**Commit:** `036cc36c2134d4d53fb41da2e67e4ee657a39a28`
**Fix:** Secret is captured once immediately after version + entitlement validation (line 602-610), before any execution side effect.

**Independent closure proof (source trace confirmed):**

Execution order in `AIExecutionController.execute`:
1. harnessVersion validation → 400 (line 589-592)
2. Entitlement check → 403 (line 596-598)
3. Secret read + validate → 500 if missing/empty/whitespace (line 602-610)
4. Only then: session lookup, agent lookup, context resolution, ledger, intent log, payload, signing, enqueue

For missing, empty, and whitespace-only secrets:
- HTTP 500 with safe generic message ✅
- `findByRequestId = 0` ✅
- `writeExecutionIntent = 0` ✅
- `reuseExecutionIntent = 0` ✅
- Intent-written logging = 0 ✅
- Session lookup = 0 ✅
- Persisted-agent lookup = 0 ✅
- Workspace/project context lookup = 0 ✅
- Enqueue = 0 ✅
- Secret and configuration-key values not disclosed ✅

Additional MEDIUM-001 proofs:
- Invalid harnessVersion → 400 before secret inspection ✅
- Unentitled → 403 even when secret is absent ✅
- Non-Harness jobs do not require or read the secret ✅
- Valid Harness proof uses the captured secret without re-reading ✅
- Valid idempotent reuse binds to reused canonical execution ID ✅
- Secret read count per Harness request = 1 ✅

### No other CRITICAL, HIGH, or MEDIUM findings.

---

## 3. Proof-construction failure paths

| Failure path | Reachable from HTTP/BullMQ? | Orphan risk |
|---|---|---|
| Cyclic payload → `JSON.stringify` throws | NO — Express JSON body parser eliminates | None |
| BigInt in payload | NO — JSON body parser, string UUIDs/timestamps | None |
| `JSON.stringify` returns `undefined` | NO — payload is always object literal | None |
| Crypto error | NO — deterministic algorithm, string input | None |

**Reachable proof-failure orphan paths: 0.**

The `catch` at line 838 is defensive. If it were ever triggered (artificial inputs only), the ledger would have a `pending` record with no enqueue. This matches the existing timeout/failed retry idempotency pattern and is not a new vulnerability.

---

## 4. Original contract verification

| Contract item | Status |
|---|---|
| Frozen normalization pipeline (§8.3.2) | ✅ `sortKeysRecursive` with `Object.create(null)`, `JSON.stringify`→`JSON.parse` round-trip, recursive sort, SHA-256 |
| Complete payload digest excluding only the proof | ✅ All 20+ fields covered; proof added after digest |
| No queue field added/changed after digest except proof | ✅ Single `{ ...payload, ...(proof && { harnessEntitlementProof }) }` |
| Frozen claim field order | ✅ `v=1|executionId|userId|apiKeyId|harnessVersion|issuedAt|payloadDigest` |
| Golden canonical JSON, digest, claim, HMAC | ✅ Independently recomputed with Node built-in `crypto` |
| Authenticated userId and apiKeyId binding | ✅ From `identity.*`, not request body |
| Canonical execution-ID binding | ✅ Controller-generated or reused UUID |
| Client-supplied proof ignored | ✅ Gateway-produced proof overwrites any client value |
| Request object not mutated | ✅ Spread creates new object |
| Secret/signature/proof/canonical payload not logged | ✅ Test asserts none in any logger call |
| Ordinary jobs omit proof | ✅ No `harnessVersion` or proof on payload |
| Referral jobs omit harnessVersion | ✅ Property not included in `jobPayload` construction |
| Referral producer never manufactures a proof | ✅ No signing imports, no proof field |
| Both .env.example files have commented placeholder | ✅ `# HARNESS_ENTITLEMENT_HMAC_SECRET=` |
| No real secret committed | ✅ Both commented out with empty value |
| No Harness activation/frontend/provider/worker/credit/migration change | ✅ Only 6 admitted files |

---

## 5. Golden vector independent recomputation

Using only Node.js `crypto.createHash` and `crypto.createHmac` (no Gateway helper imports):

- Canonical JSON: byte-identical to `{"adapter":"anthropic","apiKeyId":"apikey-golden-01",...}` ✅
- Payload digest: `8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a` ✅
- Claim string: `v=1|executionId=exec-golden-01|userId=user-golden-01|apiKeyId=apikey-golden-01|harnessVersion=v1|issuedAt=2026-09-05T12:00:00.000Z|payloadDigest=8b58d2...` ✅
- HMAC-SHA256 signature: `d247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5` ✅

---

## 6. Test results

### Targeted tests

| Suite | Result | Tests |
|---|---|---|
| Prototype-sensitive tests (HIGH-001) | PASS | 8/8 |
| MEDIUM-001 ordering tests | PASS | 7/7 (missing, empty, whitespace, idempotent, invalid version, unentitled+missing) |
| Golden vector tests | PASS | 4/4 (canonical JSON, digest, claim, HMAC) |
| `ai-execution.controller.spec.ts` | PASS | 118/118 |
| `orchestration.service.spec.ts` | PASS | 43/43 |

### Full Gateway Jest suite (diagnostics-disabled config)

| Metric | Value |
|---|---|
| Test suites | 164 passed, 4 failed (pre-existing), 1 skipped |
| Tests | 2192 passed, 13 failed (pre-existing), 6 skipped |
| Pre-existing failures | `api-key.controller.spec.ts` (DB required), `credit-grant.entity.spec.ts` (DB required), `smoke.integration.spec.ts` (app not running), `chat-message.controller.spec.ts` (worker crash) |
| New failures | 0 |

### TypeScript compilation

```
src/queue/queue.service.ts(24,7): error TS2322 (pre-existing ioredis/bullmq type mismatch)
```

No new TypeScript errors. The TS2322 is the known pre-existing `queue.service.ts` type incompatibility.

### ESLint

13 errors on admitted files — all pre-existing (verified by running at committed HEAD with no local changes). Zero new ESLint errors.

### `git diff --check`

Clean.

### Lane-capacity validator

PASS — `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` — working tree clean — proof written only to `$env:TEMP`.

---

## 7. End state

| Item | End state |
|---|---|
| EXEC-01C5B1 | COMPLETE AND LOCKED — PASS |
| Candidate status | LOCKED |
| Lane 1 | EMPTY |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| GATEWAY | UNOWNED |
| ENV | UNOWNED |
| AI-SERVICE | UNOWNED |
| GOVERNANCE | UNOWNED |
| `HARNESS_ENTITLEMENT_PROOF_V1` | FROZEN |
| Parent EXEC-01C5B | READY / NOT ADMITTED / PROVISIONAL / `admissionUncertain=true` |
| EXEC-01C5B2 | NOT REGISTERED |
| EXEC-01C6 | NOT REGISTERED |
| Runtime authorization | all false |
| Product-visible Harness | FUTURE / gated |
| Harness flags | false |
| Git commit | NO |
| Git push | NO |

---

## 8. Dirty paths (expected)

1. `C:\Users\knlee\aiSandBox2026B\TASKS.md`
2. `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md`
3. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\lane-saturation-state.json`
4. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-EXEC-01C5B1-CHECKPOINT.md`

---

*Checkpoint created: 2026-09-06 — AGENT-PLATFORM-EXEC-01C5B1 — independent security reconsolidation — PASS.*
