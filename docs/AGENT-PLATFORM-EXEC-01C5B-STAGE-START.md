# AGENT-PLATFORM-EXEC-01C5B — Stage-Start / Cross-Service Entitlement Contract Freeze / Implementation Decomposition

**Task ID:** AGENT-PLATFORM-EXEC-01C5B
**Title:** Gateway-to-worker Harness entitlement defense in depth
**Step:** 2 — Stage-start / cross-service entitlement contract freeze / bounded implementation decomposition
**Status:** COMPLETE (design / freeze only — no implementation)
**Date:** 2026-09-05
**Nature:** HIGH-RISK 4-step IMPLEMENTATION — Step 2 is governance documentation only
**Development program:** CURRENT
**Product-visible Harness capability:** FUTURE / gated / disabled / unavailable to users
**Stage-start document:** `docs/AGENT-PLATFORM-EXEC-01C5B-STAGE-START.md`
**Step 2 base HEAD:** `c193d3e92192e41479246c19bc078821c42d298c` (branch `main`; HEAD == origin/main; working tree clean)
**Step 2A repair HEAD:** `27fbe9b2cf61892ded18d89b4d9ce7a129c9125e` (branch `main`; HEAD == origin/main; working tree clean)
**Repair scope:** Fix mutually inconsistent authorization-time / revocation / expiry claims. Add full payload-integrity binding (payloadDigest). Add deterministic canonical JSON serializer contract. Add frozen golden cross-service test vectors. Revise child write sets. No application source, tests, environment, runtime, or Git changes. Stage-start document update only.

This is architecture/security design only. No application source, tests, migrations, environment, package, compose, runtime, Docker, PostgreSQL, Redis, staging, provider-live, credit mutation, browser, Git commit, or Git push.

Child implementation tasks are **proposed in this document only**. They are **not** registered and **not** admitted.

---

## 1. Verdict

**PASS — cross-service entitlement contract FROZEN; child-slice decomposition COMPLETE; implementation NOT STARTED.**

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
HARNESS_FLAGS_CHANGED=NO
FRONTEND_HARNESS_VERSION_CHANGED=NO
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE_FINAL=UNOWNED
IMPLEMENTATION_MUTEXES_ACQUIRED=NONE
PROCEED_TO_CHILD_REGISTRATION=NO_UNTIL_KEITH_COMMITS_STEP2
```

---

## 2. Preflight confirmation

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `c193d3e92192e41479246c19bc078821c42d298c` |
| `origin/main` | `c193d3e92192e41479246c19bc078821c42d298c` |
| Working tree | clean |
| `git diff --check` | clean |
| Lane 1 | EMPTY |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| GATEWAY | UNOWNED |
| AI-SERVICE | UNOWNED |
| ENV | UNOWNED |
| GOVERNANCE | UNOWNED |
| EXEC-01C5B status | REGISTERED / READY / NOT ADMITTED |
| Candidate `status` | `READY` |
| `writeSetPrecision` | `PROVISIONAL` |
| `admissionUncertain` | `true` |
| `mutexes` | `[]` |
| EXEC-01C5 | COMPLETE AND LOCKED |
| EXEC-01C5R1 | COMPLETE AND LOCKED |
| EXEC-01C6 | NOT REGISTERED |
| Runtime authorization | all `false` |
| Harness flags | `false` |
| Product-visible Harness | FUTURE / gated |
| Preflight validator | PASS / `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` / EXEC-01C5B `ADMISSION_UNCERTAIN` |

---

## 3. Authorities and source inspected (read-only)

### 3.1 Scheduler / OS / living authority

| File | Method |
|---|---|
| `AGENTS.md` | Read — bootstrap |
| `CLAUDE.md` | Applied — OS / admission / mutex / GOV-OS-03 |
| `TASKS.md` CURRENT EXECUTION BOARD | Read — stop at LEGACY / FROZEN |
| `TASKS_BACKLOG_FULL.md` AGENT-PLATFORM-EXEC-01C5B body | Read complete |
| `docs/control-plane/lane-saturation-state.json` | Read |
| `docs/control-plane/mutex-catalog.json` | Read |
| `scripts/validate-lane-capacity.ps1` | Executed (proof under `$env:TEMP` only) |

### 3.2 Locked predecessors

| File | Method |
|---|---|
| `docs/AGENT-PLATFORM-EXEC-01C5-CHECKPOINT.md` | Read |
| `docs/AGENT-PLATFORM-EXEC-01C5R1-CHECKPOINT.md` | Read |
| `docs/AGENT-PLATFORM-EXEC-01C-STAGE-START.md` | Read complete |

### 3.3 Gateway source (read-only)

| File | Method |
|---|---|
| `services/api-gateway/src/auth/api-key.config.ts` | Read — `ApiKeyIdentity`, static keys, `harnessEntitled` |
| `services/api-gateway/src/auth/api-key-auth.guard.ts` | Read — DB key validation, `harnessEntitled` from `ai:harness` scope |
| `services/api-gateway/src/auth/session-or-api-key.guard.ts` | Read — browser `harnessEntitled` from allow-list |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Read — DTO consumption, entitlement check, `enqueueExecution` payload composition |
| `services/api-gateway/src/queue/queue.service.ts` | Read — `enqueueExecution(jobData: any)`, `attempts: 1`, BullMQ `Queue.add` |
| `services/api-gateway/src/orchestration/orchestration.service.ts` | Read — `startReferralExecution`, dormant second producer |

### 3.4 AI-Service source (read-only)

| File | Method |
|---|---|
| `services/ai-service/src/queue/job.types.ts` | Read — `AiExecutionJob`, `harnessVersion?`, `agentId?` |
| `services/ai-service/src/worker/worker.processor.ts` | Read — `resolveHarnessRouting`, ledger claim, harness/plain path, retry loop, finalization |

### 3.5 Cross-service infrastructure

| File | Method |
|---|---|
| `services/ai-service/.env.example` | Read — `INTERNAL_SERVICE_KEY` |
| `services/api-gateway/.env.example` | Read — no `INTERNAL_SERVICE_KEY` |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | Searched — `INTERNAL_SERVICE_KEY` usage |

### 3.6 Searches performed (read-only)

| Search | Scope | Findings |
|---|---|---|
| `enqueueExecution` | `services/**` | Two production callers: `ai-execution.controller.ts` (line 688), `orchestration.service.ts` (line 672). Test mocks in specs only |
| `harnessEntitled` | `services/**` | Set at: `api-key.config.ts` (static key), `api-key-auth.guard.ts` (DB key), `session-or-api-key.guard.ts` (browser allow-list). Consumed at: `ai-execution.controller.ts` (line 497). Never on `AiExecutionJob` or in AI-Service |
| `hmac\|signature\|createHmac\|crypto.sign\|attestation` | `services/**` | Stripe webhook only. Zero existing HMAC/signing for queue entitlement |
| `packages/` or shared packages | repo root | None. No cross-service shared-package directory exists |
| `.env.example` / `.env.local` | `services/**` | Three `.env.example` files (gateway, ai-service, container-manager). No `.env.local` |
| `HMAC_SECRET\|ENTITLEMENT_SECRET` | `services/**` | Zero matches |

---

## 4. Complete producer inventory

### Producer 1: `AIExecutionController.execute` (ACTIVE, REACHABLE)

**Location:** `services/api-gateway/src/ai/ai-execution.controller.ts` lines 687–709
**Authentication:** `SessionOrApiKeyAuthGuard` → `AuthorizationGuard` → chain of further guards before `execute` method body
**Entitlement check:** Lines 489–499 — if `harnessVersion` is present and `identity.harnessEntitled !== true`, throws `ForbiddenException` before session lookup, ledger write, or enqueue
**Payload composition:** Spreads `harnessVersion` conditionally (line 703): `...(request.harnessVersion !== undefined && { harnessVersion: request.harnessVersion })`
**Entitlement proof on payload:** NONE — `harnessEntitled` is not forwarded onto the queue payload
**Backward compatibility:** Ordinary jobs without `harnessVersion` never set the field; worker path selection returns `plain`

### Producer 2: `OrchestrationService.startReferralExecution` (DORMANT, UNREACHABLE)

**Location:** `services/api-gateway/src/orchestration/orchestration.service.ts` lines 625–672
**Authentication:** None within the method. Accepts `input.harnessVersion` directly from caller input
**Entitlement check:** NONE — no `identity.harnessEntitled` check inside `startReferralExecution`
**Controller wiring:** Zero controllers wire a route to this method (repo-wide `*.controller.ts` grep confirmed)
**Reachability:** Only exercised by `orchestration.service.spec.ts` and `orchestration.canary.spec.ts` unit tests
**Payload composition:** `harnessVersion: input.harnessVersion` copied directly to `jobPayload` (line 650)
**Risk:** If a future controller wires this method without entitlement checking, it can produce `harnessVersion: 'v1'` jobs with no authenticated entitlement context

### No other producers

Repo-wide search for `enqueueExecution` confirmed only these two production call sites plus test mocks.

---

## 5. Exact current bypass / defense gap

| Threat | Current defense | Gap |
|---|---|---|
| Client body sets `harnessVersion` without entitlement | Gateway rejects: 403 if `harnessEntitled !== true` | ✅ Defended at Gateway |
| Client body sets `harnessEntitled` | Not possible: `harnessEntitled` is set by guards, not from request body | ✅ Defended |
| Internal producer bypasses controller | `startReferralExecution` accepts `harnessVersion` with no entitlement check | ⚠️ Dormant but undefended; no worker fallback |
| Manually constructed queue job | `QueueService.enqueueExecution(jobData: any)` — anyone with Redis access can add a job with `harnessVersion: 'v1'` | ❌ No defense — worker trusts `job.data.harnessVersion` unconditionally → **DEFENDED by HMAC attestation (§6.3 threat 3)** |
| Manual replay from failed queue | BullMQ `attempts: 1` + `removeOnFail: false` — failed jobs sit in Redis; manual replay possible | ❌ No defense — worker has no freshness or authenticity check → **DEFENDED by ledger claim + payload integrity (§6.3 threat 5)** |
| Legitimate delayed job (entitlement revoked) | Job legitimately enqueued, sits in queue, entitlement revoked before processing | Non-retroactive revocation: job executes (enqueue-time authorization, §6.1) — **by design, not a gap** |
| Payload substitution (same executionId) | Party with Redis access copies valid proof, modifies unsigned job fields, races legitimate job | ❌ No defense without payloadDigest → **DEFENDED by payload integrity (§6.3 threat 7)** |
| Retry within provider-retry loop | Same job data preserved across `EXECUTION_PROVIDER_RETRY_ATTEMPTS` | ✅ Same `executionId` / same `harnessVersion` — no mutation |
| Legitimate job with `harnessVersion` bypasses worker check | Worker's `resolveHarnessRouting` uses `job.data.harnessVersion === 'v1'` as sole criterion | ❌ No entitlement verification at worker |

---

## 6. Authorization model, revocation semantics, and registered threat model

### 6.1 Authorization time: enqueue-time attestation (frozen)

The HMAC proof attests that the authenticated user was entitled to Harness execution at the moment Gateway produced the proof and enqueued the job. This is **enqueue-time authorization**.

The locked EXEC-01C5 invariant states: *"Any job requesting `harnessVersion='v1'` must fail closed in the worker unless the trusted queued entitlement proof is explicitly valid."* The word "queued" binds the authorization decision to enqueue time: the proof is a record of what Gateway verified when it placed the job on the queue. "Explicitly valid" means the proof passes cryptographic verification (HMAC, binding checks, payload integrity), not that the user's entitlement is re-checked in real time.

### 6.2 Non-retroactive revocation (frozen)

If entitlement is revoked after a job has been legitimately enqueued with a valid proof, the job **remains authorized**. The proof is not retroactively invalidated.

Rationale:

1. The queue is an architectural decoupling boundary. Gateway enqueues; worker processes asynchronously. Online revalidation would couple worker execution to Gateway availability and introduce a circular dependency.
2. Legitimate queue delays (worker outages, backpressure, scaling events) must not invalidate legitimately authorized jobs.
3. BullMQ `attempts: 1` and the ledger claim (pending→running) ensure each executionId runs at most once.
4. Product-visible Harness is FUTURE/gated; entitlement revocation latency is not a current production concern.
5. The design accepts a revocation window equal to maximum queue delay. For immediate revocation, a separate mechanism (e.g., cancellation via the existing cancel flow, or a worker-checked revocation epoch) would be required; this is explicitly out of scope for version 1.

### 6.3 Registered threat model (repaired)

From the EXEC-01C5 canonical body and EXEC-01C5-CHECKPOINT, with authorization-time semantics applied:

1. **Client/body injection:** A client sends `harnessVersion` without entitlement → Gateway rejects with 403 before enqueue → never reaches worker. **Defended at Gateway.**
2. **Internal producer bypass:** `startReferralExecution` sets `harnessVersion` without authentication → referral producer strips `harnessVersion` (frozen in this contract) → worker takes plain path. **Defended by producer hardening.**
3. **Queue injection / manual construction:** Party with Redis access constructs a BullMQ job with `harnessVersion: 'v1'` → HMAC verification fails (no valid signature without the shared secret). **Defended by HMAC attestation.**
4. **Legitimate delayed job:** A legitimately enqueued job sits in the queue while entitlement is revoked → proof remains cryptographically valid → job executes. **This is by design under enqueue-time authorization; non-retroactive revocation; not a threat.**
5. **Manual replay from failed queue:** `removeOnFail: false` preserves failed job payloads → manual replay attempts executionId whose ledger status is already `failed` → ledger claim (pending→running) fails → replay blocked. If the original job never ran (still pending), replay with modified payload fails payload-integrity check (payloadDigest mismatch). Exact-copy replay races the legitimate job for the single ledger claim; at most one wins; payload is the Gateway-authored payload because payloadDigest covers the entire job. **Defended by ledger claim + payload integrity.**
6. **Cross-execution proof transplant:** Proof from execution A placed on job with executionId B → `proof.executionId !== job.data.executionId` → binding mismatch → rejected. **Defended by executionId binding.**
7. **Payload substitution (same executionId):** Party with Redis access copies a valid proof from a pending job, modifies unsigned fields (prompt, model, instructions, context, etc.), races the legitimate job → `payloadDigest` mismatch → proof verification fails → rejected. **Defended by payload integrity (payloadDigest).**
8. **Missing / false / malformed entitlement proof:** Must fail closed before provider execution, harness loop, tools, checkpoints. **Defended by structural validation + HMAC verification.**

### 6.4 Authorization-class distinctions (frozen)

| Class | Mechanism | Provider |
|---|---|---|
| Authorization at enqueue time | Gateway verifies identity, entitlement, session, all request parameters | Gateway guards + entitlement check |
| Authorization at worker processing time | Not performed; proof substitutes for online revalidation | Deliberate design, not a gap |
| Execution idempotency | Ledger claim (pending→running); each executionId runs at most once | PostgreSQL atomic UPDATE...WHERE...RETURNING |
| Queue-message authenticity | HMAC proves proof was produced by a party with the shared secret | HMAC-SHA256 |
| Queue-message integrity | payloadDigest proves the entire job payload is Gateway-authored | SHA-256 canonical digest |
| Replay prevention | Ledger claim blocks re-execution; payloadDigest blocks modification | Ledger + payload integrity |
| Entitlement revocation | Non-retroactive for legitimately enqueued jobs | By design; immediate revocation out of scope for v1 |

---

## 7. Architectural approach comparison

### Approach A: Plain boolean `harnessEntitled: boolean` on `AiExecutionJob`

Gateway sets `harnessEntitled: true` on the queue payload when `identity.harnessEntitled === true` and `harnessVersion === 'v1'`. Worker checks `job.data.harnessEntitled === true` before entering the harness path.

| Criterion | Assessment |
|---|---|
| Client/body injection | ✅ Prevented — Gateway derives from authenticated identity, not request body |
| Internal producer bypass | ⚠️ Partially defended — `startReferralExecution` could set `harnessEntitled: true` without authentication. Worker accepts it. But this would require code change in an already-dormant method |
| Queue injection | ❌ **NOT defended** — anyone with Redis access sets `harnessEntitled: true` in the job payload. A boolean has zero cryptographic binding. The registered threat model explicitly names "manually injected" queue jobs |
| Stale/delayed replay | ❌ Same risk — replayed job carries `harnessEntitled: true` |
| Testability | ✅ Trivial to test |
| Operational complexity | ✅ Minimal — no secrets, no rotation |
| Backward compatibility | ✅ Absent field → `undefined` → treated as not entitled |
| Secret management | ✅ None needed |
| Coupling | Low |

**Verdict:** A plain boolean is defense against the *controller bypass* threat and the *internal producer* threat, but it is **not defense against arbitrary queue injection or replay**. The registered threat model explicitly includes "manually constructed or directly injected queue jobs" (threat 3 above). A plain boolean may be chosen **only if** the threat model explicitly treats the queue as a trusted boundary.

**Assessment against registered threat model:** The EXEC-01C5 canonical body states the worker must fail closed for "stale/injected/replayed `harnessVersion='v1'`" jobs. A boolean provides zero protection: anyone who can write a Redis key (or replay a BullMQ job from the failed queue) can set `harnessEntitled: true`. This does **not** reconcile with the registered "manually injected" invariant.

### Approach B: HMAC-signed entitlement attestation

Gateway computes `HMAC-SHA256(secret, canonicalized_claims)` over a bound claim set (executionId, userId, apiKeyId, harnessVersion, issuedAt) and places the signature + claims in a structured `harnessEntitlementProof` field on the queue payload. Worker verifies the signature before entering the harness path.

| Criterion | Assessment |
|---|---|
| Client/body injection | ✅ Prevented — only Gateway possesses the signing secret |
| Internal producer bypass | ✅ Prevented — `startReferralExecution` cannot produce a valid signature without the secret (and the secret is not exposed to that code path today) |
| Queue injection | ✅ **Defended** — manually constructed job cannot forge a valid HMAC without the shared secret |
| Stale/delayed replay | ✅ **Defended** — signature is bound to `executionId`, so replaying for a different execution fails verification. Same-execution replay hits the existing ledger claim idempotency boundary before re-entering the harness loop |
| Testability | ✅ Good — synthetic test secret, deterministic claims |
| Operational complexity | Medium — requires a shared secret in both services; rotation strategy needed eventually |
| Backward compatibility | ✅ Absent proof → treated as not entitled; ordinary jobs unaffected |
| Secret management | Requires `HARNESS_ENTITLEMENT_HMAC_SECRET` in both Gateway and AI-Service `.env.example` |
| Coupling | Medium — both services must agree on canonicalization, algorithm, and field schema |

**Verdict:** HMAC attestation with payload-integrity digest satisfies all eight registered threats (§6.3). It adds one shared secret and a straightforward signing/verification pair. Node.js `crypto.createHmac` and `crypto.createHash` are zero-dependency. The payloadDigest (SHA-256 of the canonical job payload) prevents payload substitution by a party with Redis access; the original design signed only identity fields, leaving prompt, model, instructions, context, and session modifiable.

### Approach C: Worker-side online revalidation

Worker calls an API Gateway endpoint (e.g., `GET /api/internal/entitlement/:executionId`) to verify the entitlement in real time before entering the harness path.

| Criterion | Assessment |
|---|---|
| Client/body injection | ✅ Prevented |
| Internal producer bypass | ✅ Prevented |
| Queue injection | ✅ Prevented |
| Stale/delayed replay | ✅ Prevented — can check current entitlement state |
| Testability | ⚠️ Harder — requires mocking an additional HTTP endpoint |
| Operational complexity | ❌ **High** — adds a synchronous HTTP call on the critical execution path. Network failure between services would block or fail all harness executions. Gateway must expose a new internal endpoint. Worker already claims the ledger record first; adding a network call between claim and execution adds latency and a new failure mode |
| Backward compatibility | ✅ Good |
| Secret management | Uses existing `INTERNAL_SERVICE_KEY` |
| Coupling | ❌ **High** — tight runtime coupling between worker and Gateway for every harness execution |

**Verdict:** Online revalidation is the strongest freshness guarantee but introduces unacceptable runtime coupling and a new failure mode. The existing architecture uses the queue as a decoupling boundary (Gateway enqueues, worker processes asynchronously). Adding a synchronous callback violates that contract and creates a circular dependency (worker calls Gateway, Gateway called worker via queue).

### Chosen architecture: Approach B — HMAC-signed entitlement attestation

Rationale:
1. Satisfies all six registered threats including queue injection and replay
2. Does not introduce runtime coupling between services
3. Uses Node.js built-in `crypto.createHmac` — zero new dependencies
4. The existing `INTERNAL_SERVICE_KEY` pattern (both services share a secret) establishes precedent for cross-service shared secrets in this platform
5. A plain boolean (Approach A) cannot satisfy the registered "manually injected" invariant without declaring the queue a trusted boundary, which contradicts the explicit defense-in-depth requirement this task exists to fulfill

---

## 8. Frozen entitlement proof schema and serialization

### 8.1 Field name and envelope

**Queue field:** `harnessEntitlementProof` on `AiExecutionJob`

**TypeScript shape (frozen):**

```typescript
interface HarnessEntitlementProof {
  /** Schema version for forward compatibility */
  readonly version: 1;
  /** Canonical execution identity */
  readonly executionId: string;
  /** Authenticated user identity */
  readonly userId: string;
  /** Authenticated API key identity */
  readonly apiKeyId: string;
  /** Harness version gate */
  readonly harnessVersion: 'v1';
  /** ISO-8601 UTC timestamp when proof was issued */
  readonly issuedAt: string;
  /** SHA-256 hex digest of the canonical job payload (excluding proof) */
  readonly payloadDigest: string;
  /** HMAC-SHA256 hex signature over canonical claim string */
  readonly signature: string;
}
```

**On `AiExecutionJob`:** `harnessEntitlementProof?: HarnessEntitlementProof`

**Required vs optional:** Required when `harnessVersion === 'v1'` is present on an entitled job. Optional (absent) on ordinary non-Harness jobs.

### 8.2 Algorithm

**HMAC-SHA256** using Node.js `crypto.createHmac('sha256', secret)`.

Zero external dependencies. Both Gateway and AI-Service already depend on Node.js `crypto` (Gateway uses it for `randomUUID`, AI-Service uses it for various purposes).

### 8.3 Signed claims, payload integrity, and canonicalization

#### 8.3.1 Payload digest (frozen)

The proof includes a `payloadDigest` field: the SHA-256 hex digest of the **canonical JSON serialization** of the entire job payload, **excluding** the `harnessEntitlementProof` field.

**Purpose:** Prevent payload substitution. A valid proof is non-transferable: any modification to any field of the job payload (prompt, model, instructions, context, session, provider, agent identity, or any other field) invalidates the digest and therefore the HMAC signature.

**Computation (Gateway, at signing time) — uses the frozen normalization pipeline from §8.3.2:**

1. Construct the complete job payload object (all fields except `harnessEntitlementProof`)
2. Run the frozen normalization pipeline (§8.3.2) → `canonicalJson` string + `payloadDigest` hex
3. If the pipeline fails (serialization throws or returns `undefined`), fail closed — do not enqueue

**Verification (Worker, at processing time) — uses the identical frozen normalization pipeline:**

1. Extract `harnessEntitlementProof` from `job.data`
2. Construct a shallow copy of `job.data` without `harnessEntitlementProof`
3. Run the frozen normalization pipeline (§8.3.2) → recomputed `payloadDigest`
4. If `recomputedDigest !== proof.payloadDigest` → `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH`

Both signer and verifier must use the identical pipeline from §8.3.2.

#### 8.3.2 Deterministic normalization pipeline (frozen)

Both Gateway (signer) and AI-Service (verifier) must use this identical pipeline. It must produce byte-identical output from the same logical object.

**Pipeline steps (frozen for HarnessEntitlementProof version 1):**

1. **Remove proof:** delete the `harnessEntitlementProof` property from the payload object (Gateway: not yet added; Worker: shallow-copy without it).
2. **Serialize once with native `JSON.stringify`:** `const jsonStr = JSON.stringify(payload)`. This applies standard ECMAScript JSON serialization semantics:
   - `undefined`, function, and symbol values in object properties are **omitted** (the key-value pair is dropped)
   - `undefined`, function, and symbol values in arrays become `null`
   - Non-finite numbers (`Infinity`, `-Infinity`, `NaN`) become `null`
   - `null` remains `null`
   - Cyclic objects and `BigInt` values cause `JSON.stringify` to throw — this fails closed
3. **Fail closed** if `JSON.stringify` throws or returns `undefined` (the input was a bare `undefined`, function, or symbol).
4. **Parse back with `JSON.parse`:** `const parsed = JSON.parse(jsonStr)`. This produces the same JSON-compatible representation that BullMQ transports (BullMQ serializes job data with `JSON.stringify` at enqueue and deserializes with `JSON.parse` at dequeue — so the worker's `job.data` has already been through this round-trip).
5. **Recursively sort every object's keys** using ECMAScript default string `.sort()` ordering (comparison by UTF-16 code units; for the ASCII keys present on `AiExecutionJob` fields this is deterministic and equivalent to byte-order sorting). Array element order is preserved. The sort is applied recursively to all nested objects and array elements:

```typescript
function sortKeysRecursive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysRecursive);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeysRecursive(obj[key]);
  }
  return sorted;
}
```

6. **Serialize the sorted result:** `const canonicalJson = JSON.stringify(sortKeysRecursive(parsed))` — no spacing, no replacer.
7. **Compute SHA-256:** lowercase hex digest of the canonical JSON's UTF-8 bytes → `payloadDigest`.

**Complete pipeline function (frozen):**

```typescript
import { createHash } from 'crypto';

function sortKeysRecursive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysRecursive);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeysRecursive(obj[key]);
  }
  return sorted;
}

function computePayloadDigest(
  payloadWithoutProof: Record<string, unknown>,
): { canonicalJson: string; payloadDigest: string } {
  const jsonStr = JSON.stringify(payloadWithoutProof);
  if (jsonStr === undefined) {
    throw new Error('Payload serialization failed: JSON.stringify returned undefined');
  }
  const parsed = JSON.parse(jsonStr);
  const canonicalJson = JSON.stringify(sortKeysRecursive(parsed));
  const payloadDigest = createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  return { canonicalJson, payloadDigest };
}
```

**Key ordering rule:** `Object.keys(obj).sort()` uses the ECMAScript default string `.sort()`, which compares strings by UTF-16 code unit values. All `AiExecutionJob` field names are ASCII identifiers, so this ordering is deterministic and unambiguous. Both services run on Node.js / V8, which implements the same ECMAScript sort specification.

**Why JSON.stringify → JSON.parse round-trip:** The round-trip normalizes the payload to the exact JSON-compatible representation that BullMQ transports between Gateway and Worker. It eliminates `undefined` properties, converts non-finite numbers, and ensures both signer and verifier operate on the same JSON-round-tripped value space. Without this step, the signer (Gateway, before enqueue) could see `undefined` properties that the verifier (Worker, after BullMQ's JSON round-trip) never sees, producing different digests.

**Why not RFC 8785 (JCS):** JCS specifies additional number serialization rules (IEEE 754 double → shortest decimal). All `AiExecutionJob` values are strings, small integers, or nested objects/arrays of strings. The pipeline above produces the same output as JCS for this data. A full JCS implementation is unnecessary overhead for version 1.

**Why not raw delimiter concatenation:** The job payload contains arbitrary user content (prompts, instructions, file paths) that could contain any delimiter. Canonical JSON handles all value types safely.

#### 8.3.3 Canonical claim string (frozen)

**Format (frozen — this exact format, this exact field order, pipe-delimited):**

```
v=1|executionId={executionId}|userId={userId}|apiKeyId={apiKeyId}|harnessVersion=v1|issuedAt={issuedAt}|payloadDigest={payloadDigest}
```

**Canonicalization rules:**
- UTF-8 encoding
- Fields joined with pipe `|` delimiter
- Field order is fixed: `v`, `executionId`, `userId`, `apiKeyId`, `harnessVersion`, `issuedAt`, `payloadDigest`
- No trailing delimiter
- Values are the raw string values, not JSON-encoded
- `issuedAt` is ISO-8601 UTC (e.g., `2026-09-05T12:00:00.000Z`)
- `payloadDigest` is the lowercase hex SHA-256 digest from §8.3.1
- All claim string values (`executionId`, `userId`, `apiKeyId`, `issuedAt`, `payloadDigest`) are UUID strings, ISO-8601 timestamps, or hex digests — none can contain pipe characters. If a future version introduces values that might contain `|`, the encoding must be revised.

**Signature representation:** Lowercase hex string of the HMAC-SHA256 digest.

**Safety of pipe-delimited format:** Each value in the claim string is either a fixed literal (`v1`), a UUID (`executionId`, `userId`, `apiKeyId`), an ISO-8601 timestamp (`issuedAt`), or a hex string (`payloadDigest`). None of these can contain `|`. The format is unambiguous for version 1.

### 8.4 Verification comparison

Worker recomputes `HMAC-SHA256(secret, canonicalized_claims_from_proof_fields)` and compares using `crypto.timingSafeEqual` (constant-time comparison to prevent timing attacks).

If the recomputed signature does not match `proof.signature`, the proof is invalid.

### 8.5 Proof versioning

`version: 1` is the only supported version. Worker rejects any proof with `version !== 1`.

Future version changes require a new contract freeze.

### 8.6 Issued-at / expiry / authorization-time rules

**issuedAt:** Set by Gateway at proof creation time (after authentication, entitlement check, and `executionId` generation — immediately before enqueue).

**Expiry:** NONE in version 1. The proof does not expire. This is a consequence of the enqueue-time authorization model (§6.1):

1. The proof records that Gateway verified entitlement at enqueue time. It does not promise ongoing entitlement.
2. BullMQ jobs may be delayed or sit in the queue during backpressure or worker outages.
3. The `executionId` binding prevents cross-execution replay.
4. The `payloadDigest` prevents payload substitution.
5. The ledger claim (pending→running) prevents duplicate execution.
6. Adding an expiry would create an arbitrary boundary: any TTL short enough for meaningful revocation latency would risk invalidating legitimate jobs during worker outages. Option B (bounded-age attestation) was evaluated and rejected because no repository evidence supports a specific TTL, and a TTL limits revocation latency but does not provide immediate revocation.

**Revocation semantic:** Non-retroactive (§6.2). A legitimately enqueued job remains authorized regardless of later entitlement revocation. This is consistent with the locked EXEC-01C5 invariant's "trusted queued entitlement proof" language. The proof is bound to a specific `executionId` and a specific payload; it cannot be reused, modified, or transplanted.

**Clock-skew policy:** N/A — no expiry, so no clock-skew concern. Both services run in the same deployment, but even without that guarantee the lack of expiry makes clock sync irrelevant.

### 8.7 Delayed-job behavior

A legitimately enqueued job with a valid proof remains authorized regardless of queue delay (enqueue-time authorization, §6.1). The proof is bound to `executionId` and to the complete job payload (via `payloadDigest`), not to a time window. The ledger claim (pending→running) provides the execution-idempotency boundary — a job whose ledger record has already transitioned (e.g., to `failed`, `cancelled`, `running`, or `completed`) will fail the ledger claim and not reach the harness path.

If entitlement is revoked while the job is queued, the job still executes (non-retroactive revocation, §6.2). This is by design. The revocation window equals the maximum queue delay. For immediate revocation needs in a future version, the existing cancellation flow (`cancel_requested` pre-check) or a worker-checked revocation epoch could be added without changing the proof schema.

### 8.8 Retry behavior

Provider-retry loop (within the same job execution): The same `job.data` is reused. The proof is unchanged and remains valid because the `executionId` has not changed. Proof verification occurs once before the retry loop, not on each retry attempt.

BullMQ-level retry: `attempts: 1` means BullMQ does not retry. A failed job sits in the failed queue. Manual replay of a failed job would carry the original proof; verification would succeed (same claims) but the ledger claim (pending→running) would fail because the status is already `failed`.

### 8.9 Replay and substitution behavior

**Same-execution exact replay:** A job replayed with the same `executionId` and identical payload finds the ledger status is `running`/`completed`/`failed`/`cancelled` (not `pending`) and is rejected by the worker's claim logic (lines 735–790). The proof verification alone would pass (same claims, same payload), but the ledger provides the idempotency boundary.

**Same-execution payload substitution:** A party with Redis access copies a valid proof from a pending job, modifies payload fields (prompt, model, instructions, context, etc.), and attempts to race the legitimate job. The `payloadDigest` in the proof was computed from the original payload → the modified payload produces a different canonical JSON → different SHA-256 digest → `proof.payloadDigest` does not match → `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH`. The HMAC signature also fails because the claim string includes `payloadDigest`. **This is the primary defense against the queue-tamper threat identified in the Step 2A repair.**

**Same-execution exact-copy race:** Two identical copies of the same job (same proof, same payload) race the ledger claim. At most one wins the atomic `UPDATE...WHERE execution_status='pending' RETURNING` query. The winning copy has the unmodified Gateway-authored payload. The losing copy fails the claim. This is idempotent, not a security issue.

**Cross-execution replay:** Transplanting a proof from execution A to execution B fails because `proof.executionId !== job.data.executionId` — the worker's verification step rejects the mismatched binding.

**Cross-user replay:** Transplanting a proof from user A to user B fails because `proof.userId !== job.data.userId` — rejected at verification.

### 8.10 Key identifier / rotation

**Environment variable:** `HARNESS_ENTITLEMENT_HMAC_SECRET`

Must be configured identically in both Gateway and AI-Service environments. Value must be a cryptographically random string of at least 32 bytes (64 hex characters recommended).

**Key rotation in first slice:** NOT required. The first slice uses a single static key. Key rotation (key ID, multiple active keys, graceful migration) is a future enhancement that can be added without changing the proof schema (the `version` field provides the hook).

**Missing key behavior:**
- Gateway: If `HARNESS_ENTITLEMENT_HMAC_SECRET` is not configured, Gateway must NOT produce proofs and must NOT spread `harnessVersion` onto the queue payload (fail-closed at enqueue).
- AI-Service: If `HARNESS_ENTITLEMENT_HMAC_SECRET` is not configured, worker must reject any job with `harnessVersion === 'v1'` (fail-closed before harness path).

### 8.11 Malformed value handling

| Condition | Behavior |
|---|---|
| `harnessVersion === 'v1'` and `harnessEntitlementProof` is `undefined` | Fail closed — worker error `HARNESS_ENTITLEMENT_PROOF_MISSING` |
| `harnessEntitlementProof` present but not a plain object | Fail closed — `HARNESS_ENTITLEMENT_PROOF_MALFORMED` |
| `proof.version !== 1` | Fail closed — `HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION` |
| `proof.signature` missing or not a string | Fail closed — `HARNESS_ENTITLEMENT_PROOF_MALFORMED` |
| `proof.executionId !== job.data.executionId` | Fail closed — `HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH` |
| `proof.userId !== job.data.userId` | Fail closed — `HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH` |
| `proof.apiKeyId !== job.data.apiKeyId` | Fail closed — `HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH` |
| `proof.harnessVersion !== 'v1'` | Fail closed — `HARNESS_ENTITLEMENT_PROOF_MALFORMED` |
| `proof.issuedAt` missing or not a valid ISO-8601 string | Fail closed — `HARNESS_ENTITLEMENT_PROOF_MALFORMED` |
| `proof.payloadDigest` missing or not a 64-char hex string | Fail closed — `HARNESS_ENTITLEMENT_PROOF_MALFORMED` |
| Recomputed payload digest does not match `proof.payloadDigest` | Fail closed — `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH` |
| Signature verification fails (timingSafeEqual) | Fail closed — `HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE` |
| HMAC secret not configured (worker) | Fail closed — `HARNESS_ENTITLEMENT_SECRET_NOT_CONFIGURED` |
| `harnessVersion !== 'v1'` and no proof present | OK — ordinary job, no proof required |

---

## 9. Gateway derivation and producer rules

### 9.1 `AIExecutionController.execute` — primary producer

**Proof must be produced ONLY after:**
1. `SessionOrApiKeyAuthGuard` has authenticated the identity
2. `harnessVersion === 'v1'` has been validated (line 490–493)
3. `identity.harnessEntitled === true` has been confirmed (line 497–499)
4. `executionId` has been generated (either new `uuidv4()` or reused from timeout/failed idempotent retry)

**Proof must be derived ONLY from:**
- `executionId` — the canonical execution identity generated by the controller
- `identity.userId` — from the authenticated identity (not from `request.body.userId`)
- `identity.apiKeyId` — from the authenticated identity
- `harnessVersion` — the validated literal `'v1'`
- Current timestamp (`new Date().toISOString()`)
- `payloadDigest` — SHA-256 of the canonical JSON serialization (§8.3.2) of the complete job payload object, computed AFTER the payload is fully constructed but BEFORE the proof is added
- `HARNESS_ENTITLEMENT_HMAC_SECRET` — environment secret

**Payload digest computation order (frozen):**
1. Construct the complete job payload object (all fields: executionId, userId, apiKeyId, sessionId, conversationId, provider, adapter, prompt, workspaceContext, model, globalInstructions, projectInstructions, requestId, submittedAt, executionIntent, harnessVersion, agentId, agentRole, builderProfileId, and all other conditional spreads — everything EXCEPT `harnessEntitlementProof`)
2. Run `computePayloadDigest(payload)` from the frozen normalization pipeline (§8.3.2) — fail closed if serialization throws or returns `undefined`
3. Result: `{ canonicalJson, payloadDigest }` — `payloadDigest` is the lowercase SHA-256 hex
4. Construct proof object including `payloadDigest`
5. Compute HMAC signature over canonical claim string (which includes `payloadDigest`)
6. Add `harnessEntitlementProof` to the payload
7. Enqueue

**Client metadata must NOT override:**
- `harnessEntitlementProof` must NEVER be accepted from the request body
- Even if `request.harnessEntitlementProof` were sent by a client, it must be ignored

**Ordinary jobs must NOT receive accidental entitlement:**
- Proof is produced ONLY inside the `if (request.harnessVersion !== undefined)` branch
- The conditional spread `...(request.harnessVersion !== undefined && { harnessVersion: request.harnessVersion })` already exists (line 703)
- Proof spread must be co-located: `...(harnessEntitlementProof !== undefined && { harnessEntitlementProof })`

**Missing secret behavior:**
- If `HARNESS_ENTITLEMENT_HMAC_SECRET` is not configured at Gateway startup, the controller must NOT produce proofs
- For this first slice: if a `harnessVersion === 'v1'` request arrives and the secret is not configured, fail with 500 `InternalServerError` (not 403 — the identity IS entitled, but the system cannot produce the proof)
- This preserves existing behavior: the feature is gated by Harness flags which are `false`; in production, no `harnessVersion` request reaches the controller

### 9.2 `OrchestrationService.startReferralExecution` — dormant producer

**Decision: Reject / strip `harnessVersion` in the first slice.**

Rationale:
1. `startReferralExecution` has no controller route — it is unreachable in production
2. It has no authenticated identity context from which to derive an entitlement proof
3. Accepting `harnessVersion` without a proof would create a bypass path for future wiring
4. Manufacturing an entitlement proof from `input.userId`/`input.apiKeyId` without an actual authentication context would violate the entitlement authority principle

**Implementation rule:**
- `startReferralExecution` must explicitly strip `harnessVersion` from the job payload
- Alternative: leave `harnessVersion` on the payload but do NOT produce a `harnessEntitlementProof` — the worker will reject the job because the proof is missing while `harnessVersion === 'v1'`
- **Frozen choice:** Explicitly strip `harnessVersion` from the referral job payload. This is safer because it prevents the job from even appearing to request the harness path, and it documents the intentional exclusion
- When a future task wires a controller to `startReferralExecution`, that task must bring its own authenticated entitlement context and proof production

### 9.3 No additional producers

No other production call to `enqueueExecution` exists. Test mocks are not production producers.

---

## 10. Queue, retry, delayed-job and replay contract

### 10.1 BullMQ JSON serialization

BullMQ serializes job data as JSON via `JSON.stringify`. The proof object survives JSON round-trip because all fields are strings and a number (`version: 1`). No `Buffer`, `Date`, or non-JSON-serializable types.

Verification: `JSON.parse(JSON.stringify(proof))` produces an identical object. Hex string signature survives round-trip. ISO-8601 timestamp string survives round-trip.

### 10.2 Preservation across retries and delayed jobs

- `attempts: 1` means BullMQ does not retry — the in-worker provider-retry loop reuses the same `job.data` object
- The proof is part of `job.data` and is preserved unchanged across all provider-retry attempts
- Delayed jobs (BullMQ `delay` option) are not used by the current `enqueueExecution`, but if added, the proof would survive because it's part of the serialized job data

### 10.3 Ledger / idempotency interaction

**Proof validation occurs BEFORE ledger claim.**

The worker's job handler currently:
1. Claims the ledger record (pending→running) — lines 735–790
2. Evaluates harness routing — lines 920–950
3. Enters harness or plain path

With the entitlement proof, the ordering becomes:
1. Claims the ledger record (pending→running) — unchanged
2. If `harnessVersion === 'v1'`: verify `harnessEntitlementProof` — NEW
   2a. Structural validation (proof exists, version 1, all fields present)
   2b. Binding checks (executionId, userId, apiKeyId match job.data)
   2c. Payload integrity check (recompute SHA-256 of canonical payload-without-proof, compare with proof.payloadDigest)
   2d. HMAC signature verification (timingSafeEqual)
3. Evaluates harness routing — unchanged
4. Enters harness or plain path — unchanged

**Rationale for proof validation AFTER ledger claim but BEFORE routing:**
- The ledger claim (pending→running) is the idempotency boundary. If a job is replayed, the claim fails first — the proof never needs to be checked
- If the claim succeeds (legitimate first processing), the proof is checked before any harness-path side effects
- This ordering prevents a failed proof check from leaving the ledger in `pending` state forever (the claim transitions it to `running`, and the subsequent proof failure transitions it to `failed`)

**What prevents claim/signature/payload substitution:**
- The proof is bound to `executionId` — substituting a different `executionId` fails claim (wrong ledger record) or fails proof binding check
- The proof is bound to `userId` — substituting a different user's proof fails the binding check
- The proof is bound to `apiKeyId` — substituting a different API key's proof fails the binding check
- The proof is bound to the complete payload via `payloadDigest` — modifying any field (prompt, model, instructions, context, session, provider, agent identity, collaboration/referral fields, or any future field) produces a different digest → binding check fails

---

## 11. Worker guard placement and side-effect ordering

### 11.1 Exact guard location

The entitlement proof verification must occur in the worker job handler AFTER:
- Ledger claim (pending→running) — so the ledger correctly records the attempt
- `cancel_requested` pre-check — so cancelled jobs exit early without proof verification

And BEFORE:
- `resolveHarnessRouting` evaluation
- Adapter resolution
- Harness config resolution
- Dispatcher construction
- Tool handler registration
- Tool advertisement
- `executeAgentHarnessLoop` call
- Provider execution
- Audit events (unless a specifically frozen safe failure audit is required — see below)
- Checkpoint creation
- Any file operation

### 11.2 Frozen ordering

```
1. ledger claim (pending → running)               [EXISTING - unchanged]
2. cancel_requested pre-check                      [EXISTING - unchanged]
3. IF harnessVersion === 'v1':                     [NEW]
   3a. structural validation of proof              [NEW]
   3b. binding checks (executionId, userId,        [NEW]
       apiKeyId match job.data)
   3c. payload integrity (recompute SHA-256        [NEW]
       of canonical payload-without-proof,
       compare with proof.payloadDigest)
   3d. HMAC signature verification                 [NEW]
       (crypto.timingSafeEqual)
   3e. IF any check fails:                         [NEW]
       - throw HarnessEntitlementError             [NEW]
       (caught by outer catch → status='failed',   [EXISTING catch behavior]
        non-retryable, no provider/loop/tools)
4. resolve harness routing                         [EXISTING - unchanged]
5. evaluate routing decision                       [EXISTING - unchanged]
6. IF harness path:
   6a. resolve builder config                      [EXISTING - unchanged]
   6b. adapter resolution and capability check     [EXISTING - unchanged]
   6c. dispatcher construction                     [EXISTING - unchanged]
   6d. handler registration                        [EXISTING - unchanged]
   6e. tool advertisement                          [EXISTING - unchanged]
   6f. audit recorder creation                     [EXISTING - unchanged]
   6g. executeAgentHarnessLoop                     [EXISTING - unchanged]
7. finalize ledger + notify gateway                [EXISTING - unchanged]
```

### 11.3 Audit on entitlement failure

**Decision:** A structured log event is emitted on proof failure (part of the standard execution completion log). A dedicated audit event type is NOT required in the first slice. The failure is recorded in the ledger metadata via the existing `catch` block behavior:
- Status transitions to `failed`
- Error code is preserved in execution metadata (standard error path)
- The `logExecutionCompletion` call records the failure with `execution_status: 'failed'`

### 11.4 Backward compatibility

Ordinary jobs without `harnessVersion === 'v1'`:
- Do NOT carry `harnessEntitlementProof`
- Skip step 3 entirely (the `IF harnessVersion === 'v1'` guard prevents checking)
- Proceed through existing routing → `resolveHarnessRouting` returns `{ selectedPath: 'plain' }`
- Entire existing plain execution path is unchanged

---

## 12. Error, retry, logging, audit and final-metadata contract

### 12.1 Worker error class

**New error class (frozen):**

```typescript
class HarnessEntitlementError extends Error {
  readonly code: string;
  readonly isRetryable = false;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HarnessEntitlementError';
    this.code = code;
  }
}
```

### 12.2 Error codes

| Code | Meaning |
|---|---|
| `HARNESS_ENTITLEMENT_PROOF_MISSING` | `harnessVersion === 'v1'` but no `harnessEntitlementProof` on job |
| `HARNESS_ENTITLEMENT_PROOF_MALFORMED` | Proof exists but fails structural validation |
| `HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION` | `proof.version` is not `1` |
| `HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH` | One or more bound claims do not match `job.data` |
| `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH` | Recomputed payload digest does not match `proof.payloadDigest` |
| `HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE` | HMAC verification failed |
| `HARNESS_ENTITLEMENT_SECRET_NOT_CONFIGURED` | `HARNESS_ENTITLEMENT_HMAC_SECRET` not set in worker environment |

### 12.3 Retry classification

**All `HarnessEntitlementError` codes are deterministic and NON-RETRYABLE.**

The existing `isRetryableError` classifier (lines 47–51) checks for timeout/connection/429/503/overloaded patterns. None of the entitlement error messages match those patterns, so they will not be retried by the in-worker retry loop.

Additionally, `HarnessEntitlementError.isRetryable = false` provides an explicit signal if a future retry classifier checks for it.

### 12.4 Safe structured log fields

On entitlement failure, the following structured log is emitted:

```json
{
  "event": "agent_harness.entitlement_verification_failed",
  "executionId": "...",
  "userId": "...",
  "apiKeyId": "...",
  "harnessVersion": "v1",
  "errorCode": "HARNESS_ENTITLEMENT_PROOF_...",
  "proofVersion": 1,
  "proofPresent": true
}
```

**Prohibited from logging:**
- `proof.signature` (the HMAC value)
- `HARNESS_ENTITLEMENT_HMAC_SECRET` (the signing key)
- Full proof token / serialized proof object
- Prompt content or persona content
- User's session token or API key value

### 12.5 Failure metadata

The existing worker `catch` block (lines 1403–1480) handles the failure:
- Sets `execution_status = 'failed'` in the ledger
- Emits `logExecutionCompletion` with `execution_status: 'failed'`
- Publishes completion event to SSE

The error code is available via `error.code` and will appear in the structured completion log. No additional metadata record is required in the first slice.

---

## 13. Ordinary-job / API-key / browser compatibility

### 13.1 Ordinary jobs (no harnessVersion)

**Completely unchanged.** The proof field is optional on `AiExecutionJob`. When `harnessVersion` is absent (the common case for all current production traffic), the worker never evaluates the proof. The entire entitlement verification block is gated by `harnessVersion === 'v1'`.

### 13.2 API-key entitled Harness jobs

**Supported.** API-key identity with `scopes: ['ai:execute', 'ai:harness']` → `harnessEntitled: true` → Gateway produces proof → worker verifies proof → harness path proceeds (subject to Harness flags being true, which they are NOT currently).

### 13.3 Browser-session entitled Harness jobs

**Supported.** Browser session with `isBrowserSessionHarnessEntitled(user.id) === true` → `harnessEntitled: true` → Gateway produces proof → worker verifies proof → harness path proceeds (subject to Harness flags being true, which they are NOT currently).

### 13.4 `test-harness-api-key` compatibility

**Supported.** Static key `test-harness-api-key` has `harnessEntitled: true` → Gateway produces proof → worker verifies → test harness path available (subject to flags).

---

## 14. Shared-contract and environment decisions

### 14.1 Shared contract

**No new shared package is required.**

The repository has no cross-service shared-package directory. The existing pattern for cross-service contracts is:
- `AiExecutionJob` type is defined in `services/ai-service/src/queue/job.types.ts` (AI-Service owns it)
- Gateway constructs a plain object matching that shape (untyped `any` in `queue.service.ts`)
- No compile-time contract enforcement across services

For the entitlement proof:
- **AI-Service** owns the `HarnessEntitlementProof` interface (in `job.types.ts` alongside `AiExecutionJob`)
- **AI-Service** owns the verification function
- **Gateway** owns the signing function — it produces the proof object matching the shape
- The canonical claim string format is frozen in this stage-start document
- The canonical JSON serializer (§8.3.2) is frozen in this stage-start document and must be implemented identically in both services
- Both services import `crypto` from Node.js standard library

**Cross-service drift prevention (canonical serializer):**

The repository has no cross-service shared-package directory. The root `package.json` `workspaces` covers `services/*` and `frontend` but no `packages/*`. A shared package could be added by extending the workspaces array, but this would require PACKAGE mutex, a new directory structure, build configuration, and workspace linking — infrastructure that does not currently exist.

**Decision: duplicate with frozen implementation and golden vectors, not a shared package.**

Rationale:
1. The canonical serializer is ~15 lines (§8.3.2), the HMAC sign/verify is ~10 lines each — total shared logic is ~35 lines
2. The code is security-critical but small and frozen; both services implement the exact TypeScript from §8.3.2
3. Golden test vectors (§15.5) provide deterministic cross-service consistency verification at test time
4. The gateway test suite proves that its signing produces the frozen golden signature
5. The AI-Service test suite proves that its verification accepts the frozen golden proof and rejects every tampered variant
6. A shared package can be extracted as a follow-up if the platform adds more cross-service shared modules; for this first cross-service proof, golden vectors are sufficient

If future evidence shows that the duplicated serializer has drifted (e.g., a test fails after a change in one service but not the other), a shared package must be extracted. The proof schema's `version` field provides a hook for migration.

**Shared-contract catalog ID:** A new catalog ID `HARNESS_ENTITLEMENT_PROOF_V1` should be registered to track this cross-service contract boundary. The catalog ID is recorded here for future child registration but is not minted in the machine catalog in this window.

### 14.2 Environment configuration

**New environment variable (required in both services):**

| Variable | Service | Purpose |
|---|---|---|
| `HARNESS_ENTITLEMENT_HMAC_SECRET` | Gateway | Signing proof |
| `HARNESS_ENTITLEMENT_HMAC_SECRET` | AI-Service | Verifying proof |

**`.env.example` updates required:** YES — both `services/api-gateway/.env.example` and `services/ai-service/.env.example` must add a placeholder.

**Example entry:**
```
# Harness entitlement proof signing/verification secret (AGENT-PLATFORM-EXEC-01C5B)
# Must match between api-gateway and ai-service
# Generate with: openssl rand -hex 32
# HARNESS_ENTITLEMENT_HMAC_SECRET=
```

**Missing configuration behavior:**
- Gateway: Cannot produce proofs → entitled `harnessVersion` requests fail with 500 → safe because Harness flags are false and no `harnessVersion` request reaches production
- AI-Service: Cannot verify proofs → all `harnessVersion === 'v1'` jobs fail closed → safe

**Local test configuration:** Tests use a synthetic secret (e.g., `'test-hmac-secret-do-not-use-in-production'`). Never commit a real secret.

**ENV mutex:** YES — the `.env.example` file changes require ENV mutex ownership during implementation.

**PACKAGE mutex:** NO — no new `npm` dependencies needed. `crypto` is Node.js built-in.

### 14.3 Key rotation

**NOT required in the first slice.** The proof schema includes `version: 1` which provides a future hook for:
- Adding a `keyId` field
- Supporting multiple active keys during rotation
- Migrating to a new algorithm

Key rotation can be added as a separate follow-up without changing the core proof schema.

---

## 15. Test requirements (frozen)

All tests use fixture/mock/local patterns only. No live provider, Redis, database, Docker, browser, or staging activity.

### 15.1 Gateway proof production tests (controller spec)

| Test | Assertion |
|---|---|
| Entitled API-key + `harnessVersion=v1` → proof present on enqueued payload | `enqueueExecution` called with `harnessEntitlementProof` containing valid structure and correct bound claims |
| Entitled browser-session + `harnessVersion=v1` → proof present | Same as above for browser identity path |
| Unentitled identity + `harnessVersion=v1` → 403 before enqueue | No `enqueueExecution` call; no proof produced |
| Ordinary job (no `harnessVersion`) → no proof on payload | `enqueueExecution` called without `harnessEntitlementProof` |
| Client body includes `harnessEntitlementProof` → ignored | Gateway-produced proof overwrites any client-supplied value |
| Proof `executionId` matches the canonical `executionId` | `proof.executionId === enqueued.executionId` |
| Proof `userId` matches authenticated `identity.userId` | Not from `request.body.userId` |
| Proof `apiKeyId` matches authenticated `identity.apiKeyId` | |
| Proof `harnessVersion` is `'v1'` | |
| Proof `issuedAt` is a valid ISO-8601 string | |
| Proof `version` is `1` | |
| Proof `payloadDigest` is a 64-char lowercase hex string | |
| Proof `payloadDigest` matches SHA-256 of canonical JSON of enqueued payload (minus proof) | |
| Proof `signature` is a non-empty hex string | |
| Golden vector: golden inputs → golden signature (from §15.5.1) | Hardcoded expected values; not computed from sign function |
| Missing `HARNESS_ENTITLEMENT_HMAC_SECRET` → 500 for entitled request | Not 403 — identity IS entitled but system cannot sign |
| Idempotent reuse (timeout/failed) preserves proof bound to reused `executionId` | |

### 15.2 Referral producer hardening tests (orchestration spec)

| Test | Assertion |
|---|---|
| `startReferralExecution` with `harnessVersion` → stripped from enqueued payload | `enqueueExecution` called without `harnessVersion` on the job |
| `startReferralExecution` without `harnessVersion` → unchanged behavior | Existing test behavior preserved |

### 15.3 Worker verification tests (worker spec)

| Test | Assertion |
|---|---|
| Valid proof + `harnessVersion=v1` → passes verification, proceeds to routing | Harness routing evaluated |
| Missing proof + `harnessVersion=v1` → `HARNESS_ENTITLEMENT_PROOF_MISSING` → failed, non-retryable | Status `failed`; no routing/provider/loop/tools |
| `proof.version !== 1` → `UNSUPPORTED_VERSION` → failed | |
| `proof.executionId !== job.data.executionId` → `BINDING_MISMATCH` → failed | |
| `proof.userId !== job.data.userId` → `BINDING_MISMATCH` → failed | |
| `proof.apiKeyId !== job.data.apiKeyId` → `BINDING_MISMATCH` → failed | |
| Tampered signature → `INVALID_SIGNATURE` → failed | Flip one character in `proof.signature` |
| Tampered prompt → `PAYLOAD_INTEGRITY_MISMATCH` → failed | Change `job.data.prompt`; proof unchanged; payloadDigest mismatch |
| Added model field → `PAYLOAD_INTEGRITY_MISMATCH` → failed | Add `job.data.model = 'gpt-4o'`; proof unchanged; payloadDigest mismatch |
| Tampered sessionId → `PAYLOAD_INTEGRITY_MISMATCH` → failed | Change `job.data.sessionId`; proof unchanged; payloadDigest mismatch |
| Missing HMAC secret (worker env) → `SECRET_NOT_CONFIGURED` → failed | |
| `false` as proof → `MALFORMED` → failed | |
| Empty object as proof → `MALFORMED` → failed | |
| Ordinary job (no `harnessVersion`) → no proof verification, plain path unchanged | |
| Valid proof but Harness flags false → passes proof, fails at routing (`tool_loop_disabled`) | Proves proof and routing are independent checks |
| Proof failure is non-retryable (not caught by `isRetryableError`) | |
| Proof `signature` is NOT logged | Assert structured log does not contain the hex signature |
| Serialization round-trip (JSON.stringify/parse of proof) → verification still passes | |

### 15.4 Cross-boundary contract tests

| Test | Assertion |
|---|---|
| Gateway-signed proof → AI-Service verification → PASS | Using same synthetic secret and golden vector inputs |
| Gateway-signed proof with wrong secret at AI-Service → FAIL | Different synthetic secret |
| Canonical claim string format matches between signing and verification | Deterministic claim string |
| Golden vector positive: frozen input → frozen signature | Gateway sign produces exactly the golden signature; AI-Service verify accepts it |
| Golden vector tampered executionId: proof from golden but job.data.executionId changed | AI-Service verify rejects with BINDING_MISMATCH |
| Golden vector tampered prompt: proof from golden but job prompt changed | AI-Service verify rejects with PAYLOAD_INTEGRITY_MISMATCH |
| Golden vector tampered model: proof from golden but model field added | AI-Service verify rejects with PAYLOAD_INTEGRITY_MISMATCH |
| Golden vector wrong secret: golden inputs signed with wrong secret | AI-Service verify rejects with INVALID_SIGNATURE |

### 15.5 Frozen golden cross-service test vectors

These vectors are computed from the frozen canonical serializer (§8.3.2) and HMAC algorithm. Both Gateway and AI-Service tests must use these exact values as hardcoded fixtures. Tests must NOT compute expected values from the same implementation function being tested — they must compare against these pre-computed constants.

#### 15.5.1 Golden vector — positive (PASS)

**Synthetic secret:** `test-hmac-secret-do-not-use-in-production-01c5b`

**Job payload input (without proof) — this is the object passed to the §8.3.2 pipeline:**
```json
{
  "executionId": "exec-golden-01",
  "userId": "user-golden-01",
  "apiKeyId": "apikey-golden-01",
  "sessionId": "session-golden-01",
  "conversationId": "conv-golden-01",
  "provider": "anthropic",
  "adapter": "anthropic",
  "prompt": "Hello, world.",
  "submittedAt": "2026-09-05T12:00:00.000Z",
  "harnessVersion": "v1"
}
```

**Pipeline step 2 — `JSON.stringify(payload)` (insertion-order, before sort):**
```
{"executionId":"exec-golden-01","userId":"user-golden-01","apiKeyId":"apikey-golden-01","sessionId":"session-golden-01","conversationId":"conv-golden-01","provider":"anthropic","adapter":"anthropic","prompt":"Hello, world.","submittedAt":"2026-09-05T12:00:00.000Z","harnessVersion":"v1"}
```

**Pipeline step 4 — `JSON.parse` then step 5–6 — recursive key sort + `JSON.stringify` = canonical JSON:**
```
{"adapter":"anthropic","apiKeyId":"apikey-golden-01","conversationId":"conv-golden-01","executionId":"exec-golden-01","harnessVersion":"v1","prompt":"Hello, world.","provider":"anthropic","sessionId":"session-golden-01","submittedAt":"2026-09-05T12:00:00.000Z","userId":"user-golden-01"}
```

**Pipeline step 7 — payloadDigest (SHA-256 hex of canonical JSON UTF-8 bytes):**
```
8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a
```

**issuedAt:** `2026-09-05T12:00:00.000Z`

**Canonical claim string (§8.3.3):**
```
v=1|executionId=exec-golden-01|userId=user-golden-01|apiKeyId=apikey-golden-01|harnessVersion=v1|issuedAt=2026-09-05T12:00:00.000Z|payloadDigest=8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a
```

**signature (HMAC-SHA256 hex of claim string UTF-8 bytes with synthetic secret):**
```
d247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5
```

**Complete proof object:**
```json
{
  "version": 1,
  "executionId": "exec-golden-01",
  "userId": "user-golden-01",
  "apiKeyId": "apikey-golden-01",
  "harnessVersion": "v1",
  "issuedAt": "2026-09-05T12:00:00.000Z",
  "payloadDigest": "8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a",
  "signature": "d247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5"
}
```

**Expected result:** PASS — proof is structurally valid, bindings match, payload digest matches, HMAC signature matches.

**Reproduction instructions for child implementations:** Construct the payload object from the JSON above. Call `computePayloadDigest(payload)` from §8.3.2. Assert `payloadDigest === '8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a'` and `canonicalJson` matches the canonical JSON string above byte-for-byte. Construct the claim string from §8.3.3. Compute `HMAC-SHA256` with the synthetic secret. Assert `signature === 'd247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5'`.

#### 15.5.2 Tampered-field vectors (all FAIL)

All vectors use the same synthetic secret and golden proof from §15.5.1 unless stated otherwise.

| Vector | Modification | Expected error code |
|---|---|---|
| Tampered executionId | `job.data.executionId` changed to `exec-tampered-01`; proof unchanged | `HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH` |
| Tampered userId | `job.data.userId` changed to `user-tampered-01`; proof unchanged | `HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH` |
| Tampered apiKeyId | `job.data.apiKeyId` changed to `apikey-tampered-01`; proof unchanged | `HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH` |
| Tampered prompt | `job.data.prompt` changed to `Malicious prompt`; proof unchanged (payloadDigest `8b58...` no longer matches recomputed `2b2e0569f7cfb4a8424940eae6a38a37c47b408c5768bdc0e3a25732c124c057`) | `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH` |
| Tampered model (added) | `job.data.model` set to `gpt-4o`; proof unchanged (payloadDigest no longer matches recomputed `d66dc55743a8e50e76046c725016e292b7c9eaa0e4a163ba04bfcd979a9f2f58`) | `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH` |
| Tampered sessionId | `job.data.sessionId` changed to `session-tampered-01`; proof unchanged | `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH` |
| Tampered provider | `job.data.provider` changed to `openai`; proof unchanged | `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH` |
| Wrong secret | Golden inputs signed with secret `wrong-secret` → signature `5d0c4ee5d963d1c38f1351053f601a8ca8e730a82ac9a9352052af5b1bd8baaf` | `HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE` |
| Malformed signature | `proof.signature` set to `0000000000000000000000000000000000000000000000000000000000000000` | `HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE` |
| Missing proof | `harnessVersion === 'v1'` but `harnessEntitlementProof` is `undefined` | `HARNESS_ENTITLEMENT_PROOF_MISSING` |
| Wrong version | `proof.version` set to `2` | `HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION` |
| Empty object proof | `harnessEntitlementProof` set to `{}` | `HARNESS_ENTITLEMENT_PROOF_MALFORMED` |
| Boolean proof | `harnessEntitlementProof` set to `true` | `HARNESS_ENTITLEMENT_PROOF_MALFORMED` |

#### 15.5.3 Cross-service contract test pattern

The cross-service contract test in the AI-Service test suite must:
1. Use the golden vector job payload (§15.5.1) as `job.data`
2. Use the golden vector proof object as `job.data.harnessEntitlementProof`
3. Use the golden synthetic secret as `HARNESS_ENTITLEMENT_HMAC_SECRET`
4. Run the AI-Service verification function
5. Assert PASS

This test does NOT import Gateway code, does NOT call Gateway's sign function, and does NOT recompute expected values from the verification function. It uses only pre-computed golden constants from this document. This proves that the AI-Service verification function accepts a Gateway-produced proof without both services needing to share implementation code.

---

## 16. Proposed child decomposition

### 16.1 Why three children, not two

The implementation crosses two services (Gateway and AI-Service) and requires a shared environment secret. The three-child decomposition is:

1. **Gateway proof production and producer hardening** — GATEWAY + ENV mutexes
2. **AI-Service proof verification and worker enforcement** — AI-SERVICE mutex
3. These could theoretically be two children, but both need the ENV mutex for `.env.example` changes

However, on closer inspection:
- The Gateway child needs ENV for `services/api-gateway/.env.example`
- The AI-Service child needs ENV for `services/ai-service/.env.example`
- ENV is a single mutex — both cannot hold it concurrently

**Resolution:** The Gateway child handles BOTH `.env.example` files (it is the first in dependency order and must create the secret convention). The AI-Service child then reads the convention already established.

**Alternative:** A separate tiny ENV-only child. This is unnecessary overhead — the `.env.example` change is a single comment+placeholder line in each file, trivially bundled with the Gateway child.

**Final decomposition: TWO children.**

### 16.2 Child 1: AGENT-PLATFORM-EXEC-01C5B1 — Gateway proof production and producer hardening

| Field | Value |
|---|---|
| **Task ID** | `AGENT-PLATFORM-EXEC-01C5B1` |
| **Title** | Gateway Harness entitlement proof production and producer hardening |
| **Purpose** | Implement frozen canonical JSON serializer (§8.3.2), HMAC-signed entitlement proof production with payload digest (§8.3.1) in the controller; strip `harnessVersion` from referral producer; add `HARNESS_ENTITLEMENT_HMAC_SECRET` to both `.env.example` files; golden vector positive test (§15.5.1); tests for all Gateway-side proof, binding, payload digest, referral strip, and missing-secret behaviors |
| **Dependency order** | **1** — must be completed and LOCKED before EXEC-01C5B2 can be admitted |
| **Depends on** | AGENT-PLATFORM-EXEC-01C5 (LOCKED), AGENT-PLATFORM-EXEC-01C5R1 (LOCKED), EXEC-01C5B Step 2 (this document) |
| **Mutexes** | **GATEWAY**, **ENV** |
| **Exact ordered write paths** | 1. `services/api-gateway/src/ai/ai-execution.controller.ts` — canonical serializer, payload digest computation, proof production in `execute` method 2. `services/api-gateway/src/ai/ai-execution.controller.spec.ts` — proof production tests, golden vector positive test, payload digest tests 3. `services/api-gateway/src/orchestration/orchestration.service.ts` — strip `harnessVersion` from referral payload 4. `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts` — referral strip tests 5. `services/api-gateway/.env.example` — add `HARNESS_ENTITLEMENT_HMAC_SECRET` placeholder 6. `services/ai-service/.env.example` — add `HARNESS_ENTITLEMENT_HMAC_SECRET` placeholder |
| **Shared contract IDs** | `HARNESS_ENTITLEMENT_PROOF_V1` (producer side) |
| **Evidence class** | LOCAL-TESTS |
| **Admission certainty** | Uncertain until registered with EXACT write sets |
| **Acceptance criteria** | See §15.1, §15.2, and §15.5 tests frozen above; referral `harnessVersion` stripped; `.env.example` updated; proof structure matches frozen schema including `payloadDigest`; canonical serializer matches frozen implementation (§8.3.2); golden vector positive test passes with hardcoded expected signature; no proof from client body; missing secret → 500 |
| **Explicit exclusions** | No AI-Service source changes; no worker changes; no frontend; no runtime; no provider-live; no Docker/Postgres/Redis; no Harness flag changes; no product activation; no migrations; no PACKAGE changes |
| **Rollback boundary** | Revert Gateway proof production; restore original `orchestration.service.ts` referral payload; remove `.env.example` entries. Worker remains unchanged (still trusts `harnessVersion` only — less safe but existing behavior) |

### 16.3 Child 2: AGENT-PLATFORM-EXEC-01C5B2 — AI-Service proof verification and worker enforcement

| Field | Value |
|---|---|
| **Task ID** | `AGENT-PLATFORM-EXEC-01C5B2` |
| **Title** | AI-Service Harness entitlement proof verification and worker enforcement |
| **Purpose** | Add `HarnessEntitlementProof` type (including `payloadDigest` field) to `job.types.ts`; implement frozen canonical JSON serializer (§8.3.2, identical to Gateway copy); implement HMAC verification with payload-integrity check (payloadDigest); add entitlement guard in worker before routing (structural → binding → payload integrity → HMAC); add `HarnessEntitlementError` class; golden vector cross-service contract test (§15.5.3); tests for all worker-side verification, binding mismatch, payload integrity mismatch, tamper detection, missing secret, ordinary-job bypass, non-retryable classification, and cross-boundary contract |
| **Dependency order** | **2** — depends on EXEC-01C5B1 (Gateway must produce proofs before worker can verify them; `.env.example` convention established) |
| **Depends on** | AGENT-PLATFORM-EXEC-01C5B1 (must be LOCKED), EXEC-01C5B Step 2 (this document) |
| **Mutexes** | **AI-SERVICE** |
| **Exact ordered write paths** | 1. `services/ai-service/src/queue/job.types.ts` — add `HarnessEntitlementProof` interface (including `payloadDigest: string`) and optional field on `AiExecutionJob` 2. `services/ai-service/src/worker/worker.processor.ts` — add frozen canonical JSON serializer (§8.3.2, identical implementation), payload digest computation, HMAC verification function, `HarnessEntitlementError` class, entitlement guard in job handler (structural → binding → payload integrity → HMAC) 3. `services/ai-service/src/worker/worker.processor.spec.ts` — verification tests, binding tests, payload integrity mismatch tests (tampered prompt, added model, tampered sessionId, tampered provider), tamper tests, missing secret tests, ordinary-job tests, non-retryable tests, no-log-signature tests, golden vector cross-service contract test (§15.5.3), golden vector tampered-field tests (§15.5.2) 4. `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` — ensure existing builder-config tests pass unchanged (backward compatibility) |
| **Shared contract IDs** | `HARNESS_ENTITLEMENT_PROOF_V1` (consumer side) |
| **Evidence class** | LOCAL-TESTS |
| **Admission certainty** | Uncertain until registered with EXACT write sets and EXEC-01C5B1 is LOCKED |
| **Acceptance criteria** | See §15.3, §15.4, and §15.5 tests frozen above; proof verification before routing/provider/loop/tools/checkpoint; all error codes implemented including `PAYLOAD_INTEGRITY_MISMATCH`; payload integrity covers all job fields; canonical serializer matches frozen implementation (§8.3.2); golden vector cross-service contract test passes with hardcoded constants (§15.5.3); non-retryable; no secret/signature in logs; ordinary jobs unchanged |
| **Explicit exclusions** | No Gateway source changes; no frontend; no runtime; no provider-live; no Docker/Postgres/Redis; no Harness flag changes; no product activation; no migrations; no ENV changes (convention already established by EXEC-01C5B1); no PACKAGE changes |
| **Rollback boundary** | Revert AI-Service verification; worker returns to existing behavior (trusts `harnessVersion` only). Gateway proof production remains but is harmless (extra field on job, ignored by worker) |

### 16.4 Verification: proposed IDs are unused

Repo-wide search for `EXEC-01C5B1` and `EXEC-01C5B2`:

| Search | Result |
|---|---|
| `AGENT-PLATFORM-EXEC-01C5B1` canonical heading | NONE |
| `AGENT-PLATFORM-EXEC-01C5B1` machine stanza | NONE |
| `AGENT-PLATFORM-EXEC-01C5B1` sidecar candidate | NONE |
| `AGENT-PLATFORM-EXEC-01C5B1` board registration | NONE |
| `AGENT-PLATFORM-EXEC-01C5B2` canonical heading | NONE |
| `AGENT-PLATFORM-EXEC-01C5B2` machine stanza | NONE |
| `AGENT-PLATFORM-EXEC-01C5B2` sidecar candidate | NONE |
| `AGENT-PLATFORM-EXEC-01C5B2` board registration | NONE |

Both IDs are unused. They follow the existing naming convention (`EXEC-01C5B` parent with numeric suffix).

### 16.5 First child to register

**AGENT-PLATFORM-EXEC-01C5B1** (Gateway proof production) must be registered first. EXEC-01C5B2 depends on it.

---

## 17. Child registration decision (this window)

**CHILD_TASKS_REGISTERED=0**

Children are proposed in this document only. They are not registered in `TASKS_BACKLOG_FULL.md`, not given machine stanzas, not given sidecar candidates, and not admitted to any lane.

Parent candidate remains:
- `status=READY`
- `writeSetPrecision=PROVISIONAL`
- `admissionUncertain=true`
- `mutexes=[]`
- `writePaths=[]`
- not admitted

---

## 18. Lifecycle / control-plane end state

| Item | End state |
|---|---|
| EXEC-01C5B Step 1 | COMPLETE |
| EXEC-01C5B Step 2 | COMPLETE |
| Cross-service entitlement contract | FROZEN (this document) |
| Child-slice decomposition | COMPLETE |
| Implementation | NOT STARTED |
| Parent candidate | NOT ADMITTED |
| Child tasks | NOT REGISTERED |
| Product-visible Harness | FUTURE / GATED |
| Harness flags | UNCHANGED / FALSE |
| Frontend `harnessVersion` | NOT SENT |
| Lane 1 / 2 / 3 | EMPTY / EMPTY / DISABLED |
| Governance | UNOWNED after this write |
| Implementation mutexes | UNOWNED |
| Runtime authorization | unchanged false |

---

## 19. Confirmation of zero implementation and activation activity

- No application source changed
- No test file changed
- No Harness flag changes
- No Gateway rejection change
- No frontend `harnessVersion`
- No specialist / unbound Builder Harness
- No mutation tools enabled
- No `.env` file changed (only `.env.example` changes proposed for children)
- No PACKAGE changes
- No migrations
- Runtime/Docker/database/staging/browser/provider-live/credit = 0
- Git commit/push = NO
- No child task registered
- No sidecar candidate added
- No machine stanza added
- No lane occupied
- No implementation mutex acquired
- EXEC-01C6 remains NOT REGISTERED

---

## 20. Keith decision required

**NONE for this repair.** The authorization-time semantic (enqueue-time, non-retroactive revocation) is consistent with the locked EXEC-01C5 invariant's "trusted queued entitlement proof" language (§6.1). It does not require a new product or security decision because:

1. The locked invariant says "queued entitlement proof is explicitly valid" — "queued" binds authorization to enqueue time; "explicitly valid" means cryptographic verification passes
2. Product-visible Harness remains FUTURE/gated — no user-facing revocation behavior exists to change
3. The original stage-start's inconsistent claims (no expiry + must fail after revocation + ledger provides freshness) were introduced in this document, not in a locked predecessor
4. The repair corrects the inconsistency without changing any locked task's semantics
5. It does not alter the Harness activation gate, user-visible behavior, billing, or the G7 allow-list decision
6. The payloadDigest addition strengthens the security contract beyond the original design

**If a future requirement arises for immediate entitlement revocation**, a worker-checked revocation epoch or online revalidation can be added without changing the proof schema (the `version` field provides a migration hook). This is explicitly out of scope for version 1.

The children can proceed to registration when Keith commits Step 2A.

---

*Stage-start created: 2026-09-05 — AGENT-PLATFORM-EXEC-01C5B Step 2 — cross-service entitlement contract freeze and implementation decomposition — no source/runtime/provider modification.*
