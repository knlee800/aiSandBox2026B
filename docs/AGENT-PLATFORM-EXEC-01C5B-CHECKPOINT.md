# AGENT-PLATFORM-EXEC-01C5B — Checkpoint

**Task ID:** AGENT-PLATFORM-EXEC-01C5B
**Title:** Gateway-to-worker Harness entitlement defense in depth
**Phase:** STEP_4_FINAL_CROSS_SERVICE_SECURITY_VERIFICATION
**Result:** PASS
**Date:** 2026-09-06
**Reviewer:** Independent (Opus 4.6)
**Nature:** 4-step HIGH-RISK IMPLEMENTATION umbrella — Step 4 final cross-service security verification and lock

---

## 1. Implementation range

### Gateway producer child (EXEC-01C5B1)

**Base SHA:** `99085ef15f1e8d43d44fac16a6b38b02313fc60a`
**Final implementation SHA:** `036cc36c2134d4d53fb41da2e67e4ee657a39a28`
**Lock SHA:** `01652b87838157664ecffa161060a6608632dbed`

Exactly three commits, exactly six files:

1. `services/api-gateway/src/ai/ai-execution.controller.ts`
2. `services/api-gateway/src/ai/ai-execution.controller.spec.ts`
3. `services/api-gateway/src/orchestration/orchestration.service.ts`
4. `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts`
5. `services/api-gateway/.env.example`
6. `services/ai-service/.env.example`

### AI-Service verifier child (EXEC-01C5B2)

**Base SHA:** `4422a9330aed04e7fcf4275625fd725978d30eea`
**Implementation SHA:** `cecbea5ced70ac1e0aff5ed00b0bfa8890a74ca3`
**Lock SHA:** `842a6fcfd8a3b99105d3096e7e1ec972d912efe6`

Exactly one commit, exactly four files:

1. `services/ai-service/src/queue/job.types.ts`
2. `services/ai-service/src/worker/worker.processor.ts`
3. `services/ai-service/src/worker/worker.processor.spec.ts`
4. `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts`

### Combined write set: 10 files across 2 services + 2 `.env.example` files

---

## 2. Security findings

**No CRITICAL, HIGH, or MEDIUM findings.**

Both child checkpoints (EXEC-01C5B1, EXEC-01C5B2) independently verified and closed:

- **HIGH-001** (EXEC-01C5B1): Prototype pollution via inherited `__proto__` setter in `sortKeysRecursive` — CLOSED (commit `4f4dbba`; `Object.create(null)` at every level)
- **MEDIUM-001** (EXEC-01C5B1): Signing secret read after side effects — CLOSED (commit `036cc36`; secret captured before any execution side effect)

No new findings in this cross-service verification step.

---

## 3. Cross-service schema and canonicalization compatibility

| Check | Gateway | AI-Service | Match |
|---|---|---|---|
| Proof interface fields | 8 fields: version, executionId, userId, apiKeyId, harnessVersion, issuedAt, payloadDigest, signature | Identical 8 fields | ✅ |
| `version` literal | `1` (numeric) | `1` (numeric) | ✅ |
| `harnessVersion` literal | `'v1'` | `'v1'` | ✅ |
| `sortKeysRecursive` accumulator | `Object.create(null)` | `Object.create(null)` | ✅ |
| Key ordering | `Object.keys(obj).sort()` | `Object.keys(obj).sort()` | ✅ |
| Array handling | `value.map(sortKeysRecursive)` | `value.map(sortKeysRecursive)` | ✅ |
| JSON round-trip | `JSON.stringify` → `JSON.parse` → sort → `JSON.stringify` | Identical pipeline | ✅ |
| Hash algorithm | `createHash('sha256').update(canonicalJson, 'utf8').digest('hex')` | Identical | ✅ |
| HMAC algorithm | `createHmac('sha256', secret).update(claim, 'utf8').digest('hex')` | `nodeCrypto.createHmac('sha256', secret).update(claim, 'utf8').digest('hex')` | ✅ |
| Claim string format | `v=1\|executionId=...\|userId=...\|apiKeyId=...\|harnessVersion=v1\|issuedAt=...\|payloadDigest=...` | Identical | ✅ |
| Secret env var name | `HARNESS_ENTITLEMENT_HMAC_SECRET` | `HARNESS_ENTITLEMENT_HMAC_SECRET` | ✅ |
| Secret trimming | `.trim()`, empty → undefined | `.trim()`, empty → undefined | ✅ |
| Payload exclusion | All fields except `harnessEntitlementProof` | `copyJobPayloadWithoutProof` excludes only `harnessEntitlementProof` | ✅ |

---

## 4. Independent golden-vector result

Using only Node.js built-in `crypto` (no imports from either service):

| Step | Expected | Computed | Match |
|---|---|---|---|
| Canonical JSON | `{"adapter":"anthropic","apiKeyId":"apikey-golden-01",...}` | Byte-identical | ✅ |
| Payload digest | `8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a` | Match | ✅ |
| Claim string | `v=1\|executionId=exec-golden-01\|userId=user-golden-01\|...` | Match | ✅ |
| HMAC signature | `d247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5` | Match | ✅ |
| Positive verification | PASS | PASS | ✅ |
| Prompt tamper | PAYLOAD_INTEGRITY_MISMATCH | PAYLOAD_INTEGRITY_MISMATCH | ✅ |
| Added field | PAYLOAD_INTEGRITY_MISMATCH | PAYLOAD_INTEGRITY_MISMATCH | ✅ |
| ExecutionId transplant | BINDING_MISMATCH | BINDING_MISMATCH | ✅ |
| UserId transplant | BINDING_MISMATCH | BINDING_MISMATCH | ✅ |
| ApiKeyId transplant | BINDING_MISMATCH | BINDING_MISMATCH | ✅ |
| Provider/session/model tamper | PAYLOAD_INTEGRITY_MISMATCH | PAYLOAD_INTEGRITY_MISMATCH | ✅ |
| Wrong secret | INVALID_SIGNATURE | INVALID_SIGNATURE | ✅ |
| Malformed signature | INVALID_SIGNATURE | INVALID_SIGNATURE | ✅ |
| Own `__proto__` | PAYLOAD_INTEGRITY_MISMATCH | PAYLOAD_INTEGRITY_MISMATCH | ✅ |
| Nested `__proto__` | PAYLOAD_INTEGRITY_MISMATCH | PAYLOAD_INTEGRITY_MISMATCH | ✅ |

---

## 5. Identity, payload, and signature binding

| Binding | Mechanism | Verified |
|---|---|---|
| `executionId` | Claim string field + digest coverage | ✅ |
| `userId` | Claim string field + derived from `identity.userId` only | ✅ |
| `apiKeyId` | Claim string field + derived from `identity.apiKeyId` only | ✅ |
| `harnessVersion` | Claim string field + literal `'v1'` | ✅ |
| `issuedAt` | Claim string field + set at enqueue time | ✅ |
| Complete payload | `payloadDigest` SHA-256 of canonical JSON of all fields except proof | ✅ |
| HMAC signature | Covers claim string which includes `payloadDigest` | ✅ |
| Client-supplied proof | Ignored — Gateway constructs proof independently | ✅ |
| Request body userId | Not used — `identity.userId` from authenticated context | ✅ |

---

## 6. Gateway side-effect ordering

```
1. harnessVersion validation → 400 (line 589-592)
2. Entitlement check → 403 (line 596-598)
3. Secret read + validate → 500 if missing/empty/whitespace (line 602-610)
4. Session lookup, agent lookup, context, ledger, payload construction
5. Payload digest computation over complete payload without proof
6. HMAC signing → proof object
7. Enqueue { ...payload, ...proof }
```

Missing/empty/whitespace secret: 500 before session lookup, agent lookup, ledger write, or enqueue. ✅

---

## 7. Referral-producer hardening

`startReferralExecution` at `orchestration.service.ts` lines 637-660:

- `harnessVersion` is NOT in the explicitly constructed `jobPayload` ✅
- No `harnessEntitlementProof` manufactured ✅
- No signing imports or secret access ✅
- Tests confirm: referral with `harnessVersion` in input → stripped from enqueued payload ✅
- Tests confirm: referral without `harnessVersion` → unchanged behavior ✅
- Tests confirm: no proof manufactured ✅

---

## 8. Worker-guard placement

Verification at `worker.processor.ts` line 1156-1187:

```
1. Ledger claim (pending→running)       [EXISTING - unchanged]
2. cancel_requested pre-check           [EXISTING - unchanged]
3. IF harnessVersion === 'v1':          [NEW - line 1156]
   3a. verifyHarnessEntitlementProof    [NEW - line 1158]
   3b. Structured log on failure        [NEW - lines 1162-1180]
   3c. Throw on failure → outer catch   [NEW - line 1181]
4. resolveHarnessRouting                [EXISTING - line ~1197]
5. All downstream: routing, adapter, dispatcher, tools, provider, harness loop, audit, checkpoints
```

Guard is AFTER ledger claim + cancellation pre-check, BEFORE all downstream operations. ✅

---

## 9. Failure finalization and non-retryability

| Check | Result |
|---|---|
| `HarnessEntitlementError.name` = `'HarnessEntitlementError'` | ✅ |
| `HarnessEntitlementError.isRetryable` = `false` | ✅ |
| Error message is safe (no secret/signature/prompt) | ✅ |
| Invalid proof reaches existing failure finalizer | ✅ |
| Ends with ledger state `failed` | ✅ |
| No provider call | ✅ |
| No Harness loop call | ✅ |
| No Harness audit event | ✅ |
| No checkpoint | ✅ |
| No tool dispatch | ✅ |
| `isRetryableError` does not match entitlement codes | ✅ |
| BullMQ `attempts: 1` prevents job-level retry | ✅ |

---

## 10. Ordinary-job compatibility

| Check | Result |
|---|---|
| Ordinary jobs work without proof | ✅ (`harnessVersion !== 'v1'` → skip) |
| Ordinary jobs work without HMAC secret | ✅ (secret not read for non-v1 jobs) |
| Existing single-shot execution unchanged | ✅ |
| Builder configuration unchanged | ✅ (37 builder-config tests pass) |
| Worker identity/final-metadata propagation unchanged | ✅ |
| Existing unsupported-provider/disabled-gate behavior intact | ✅ |

---

## 11. Non-activation boundary

| Check | Result |
|---|---|
| No Harness flag change | ✅ |
| No frontend change | ✅ |
| No provider-adapter change | ✅ |
| No credit/accounting change | ✅ |
| No migration | ✅ |
| No dependency change | ✅ |
| No Docker/PostgreSQL/Redis/staging/browser activity | ✅ |
| No provider-live calls | ✅ |
| Product-visible Harness remains FUTURE/gated | ✅ |
| Runtime authorization flags remain false | ✅ |

---

## 12. Test results

### AI-Service full Jest suite

| Metric | Value |
|---|---|
| Test suites | 38 passed, 0 failed |
| Tests | 903 passed, 1 skipped, 0 failed |
| New failures | 0 |

### AI-Service TypeScript build

`npm run build` → `tsc` → **PASS** → zero errors.

### Gateway controller tests (diagnostics-suppressed for pre-existing TS2322)

| Metric | Value |
|---|---|
| Test suites | 1 passed, 0 failed |
| Tests | 118 passed, 0 failed |
| New failures | 0 |

### Gateway orchestration tests (diagnostics-suppressed)

| Metric | Value |
|---|---|
| Test suites | 1 passed, 0 failed |
| Tests | 43 passed, 0 failed |
| New failures | 0 |

### Pre-existing Gateway issues (unchanged)

- `queue.service.ts` TS2322: ioredis/bullmq type mismatch — pre-existing, not introduced by this work
- Diagnostics suppression used only in `$env:TEMP\jest-gw-nodiag.config.js`

### `git diff --check`

Clean.

### Lane-capacity validator

**PASS** — `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` — working tree clean — proof written only to `$env:TEMP`.

---

## 13. End state

| Item | End state |
|---|---|
| EXEC-01C5B | COMPLETE AND LOCKED — PASS |
| EXEC-01C5B1 | COMPLETE AND LOCKED — PASS |
| EXEC-01C5B2 | COMPLETE AND LOCKED — PASS |
| Parent candidate status | LOCKED |
| Lane 1 | EMPTY |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| GATEWAY | UNOWNED |
| AI-SERVICE | UNOWNED |
| ENV | UNOWNED |
| GOVERNANCE | UNOWNED |
| `HARNESS_ENTITLEMENT_PROOF_V1` | FROZEN |
| EXEC-01C umbrella | Governed by existing lifecycle; not independently completed |
| EXEC-01C6 | NOT REGISTERED |
| Runtime authorization | all false |
| Product-visible Harness | FUTURE / gated |
| Harness flags | false |
| Git commit | NO |
| Git push | NO |

---

## 14. Dirty paths (expected)

1. `C:\Users\knlee\aiSandBox2026B\TASKS.md`
2. `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md`
3. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\lane-saturation-state.json`
4. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-EXEC-01C5B-CHECKPOINT.md`

---

*Checkpoint created: 2026-09-06 — AGENT-PLATFORM-EXEC-01C5B — final cross-service security verification — PASS.*
