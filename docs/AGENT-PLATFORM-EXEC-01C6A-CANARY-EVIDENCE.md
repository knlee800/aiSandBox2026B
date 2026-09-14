# AGENT-PLATFORM-EXEC-01C6A — Canary evidence (preparation)

**Task ID:** AGENT-PLATFORM-EXEC-01C6A
**Title:** Staging (AWS Lightsail) read-only Harness stub canary and xAI fail-closed canary
**Window:** preparation correction — 2026-09-10 (same frozen three-file write set; three independently reproduced remaining defects after five corrected previously)
**Baseline HEAD:** `4d91c5feb08f4987c0e5026f015295b625640a33`
**Lifecycle status:** PREPARATION CORRECTED / LIVE EXECUTION PENDING / NOT LANE-DONE / NOT LOCKED / MOCK PASS IS NOT ACCEPTANCE
**Admission:** bounded preparation only. Does **not** authorize staging execution, SSH, AWS, PM2 mutation, provider calls, or credit writes. Isolated tests passing does **not** accept this preparation for live execution.

Identifiers and enums only. Secrets, signatures, full proofs, API keys, HMAC values, prompt bodies, persona text, and file contents are prohibited in this document.

---

## 1. Cleanup contract amendment (Keith-approved; preserved)

Frozen original (`docs/AGENT-PLATFORM-EXEC-01C6-STAGE-START.md` §16 item 4, 2026-09-07):

> Delete only canary-owned `usage_records` / BullMQ jobs / ledger rows identified by the canary `executionId`.

**This contract is amended. It is not unchanged.**

Explicit amendment (2026-09-10):

| Item | Original | Amended |
|---|---|---|
| Canary `usage_records` | Delete canary-owned rows | **Retain** |
| Zero-token `credit_deduction_records` | Delete ledger rows identified by canary `executionId` | **Retain** the zero-token row to preserve audit and idempotency evidence |
| Baseline failed BullMQ jobs | Not distinguished | **Untouched** |
| Canary-owned failed BullMQ job | Delete with other canary-owned jobs | Remove **only after evidence capture and later execution authorization** |

Zero-token accounting acceptance criteria remain intact: optional stub finalize may still produce a 0-token `applyDeduction` ledger event; non-zero balance change on 01C6A remains FAIL unless Keith separately authorizes it. Failed / unsupported xAI-negative must not deduct.

This correction window does not reopen or reverse the amendment.

---

## 2. Prepared files (exact registered paths)

| # | Path | Role |
|---|---|---|
| 1 | `services/ai-service/scripts/canary-01c6a-stub-submit.ts` | Direct shared `ai-execution` queue with contract HMAC proof |
| 2 | `services/ai-service/scripts/canary-01c6a-xai-negative.ts` | Gateway `POST /api/ai/execute` only; never direct enqueue as a substitute |
| 3 | `docs/AGENT-PLATFORM-EXEC-01C6A-CANARY-EVIDENCE.md` | This document |

Production worker / adapter / Gateway / frontend source is **not** in the write set and was not modified.

Preparation SHA-256 hashes (UTF-8 file bytes; scripts filled after write; this file's hash is recorded in the independent-review report after this fill):

| File | SHA-256 |
|---|---|
| `services/ai-service/scripts/canary-01c6a-stub-submit.ts` | see §12 |
| `services/ai-service/scripts/canary-01c6a-xai-negative.ts` | see §12 |
| `docs/AGENT-PLATFORM-EXEC-01C6A-CANARY-EVIDENCE.md` | recorded in the independent-review report after this fill (avoid circular self-hash) |

---

## 2.1 Independent-review defects corrected in this window

The previous preparation copies were incomplete. They are **not** described as unchanged.

| Review finding | Correction |
|---|---|
| No concrete live Redis/database/HTTP/ledger adapters; both entry points always throw | Concrete adapters implemented behind `AISB_01C6A_LIVE_SUBMIT` **and** `AISB_01C6A_STAGING_EXECUTION_AUTHORIZED`. Isolated tests inject mocked clients. **Not invoked against staging.** |
| Failed stub returns `proofAccepted=true` | `proofAccepted` is `accepted` / `rejected` / `unknown`, derived from execution-correlated evidence (entitlement fail codes, routing fail reason, completed ledger). Missing evidence stays `unknown`. |
| Generic `fail_closed` with missing observations accepted as `EXPECTED_XAI_REJECTION` | Expected pass requires exact `adapter_lacks_tool_use` **and** supporting observations (ledger `failed`, loop not entered, no notify-complete, no `applyDeduction`). Generic `fail_closed` is `UNEXPECTED_ROUTING_RESULT`. Incomplete evidence is `INCOMPLETE_OBSERVATIONS`. |
| Unresolved HTTP/observer promises bypass the polling deadline | Every connect / insert / enqueue / HTTP / poll / shutdown call is raced against a bounded timeout. A hung promise cannot block the deadline. |
| Raw transport errors can disclose the Bearer token | All log and `stderr` paths sanitize untrusted errors. Credentials, authorization headers, proofs, passworded URLs, and payload bodies are not printed. |
| Submission ambiguity coverage checks mode flags, not lost acknowledgments | Flag conflict remains fail-closed. Lost insert / enqueue / POST acknowledgments are explicit `*_ACK_UNKNOWN` outcomes, automatic retry is forbidden, and a read-only reconcile path exists (`AISB_01C6A_RECONCILE`). `LIVE_SUBMIT` + `RECONCILE` is `SUBMISSION_AMBIGUITY`. |

### 2.2 Second independent review (five findings; this correction)

The 17 stub / 18 xAI self-tests of the previous copies all passed and still missed these defects. They are **not** described as unchanged.

| Review finding | Correction |
|---|---|
| `createXaiLiveAdapters()` supplied `observeJob` / `observeLogs` only by injecting a preassembled expected rejection. The real entry point could not collect `adapter_lacks_tool_use`. | Live/reconcile adapters now require `DATABASE_URL`, `REDIS_URL`, and `AISB_01C6A_WORKER_LOG_PATH` **before POST**. Job observation is read-only `Queue.getJobs` matched on `job.data.executionId` (never `add`). Logs are JSON lines parsed for `agent_harness.route_evaluated`, `agent_harness.entitlement_verification_failed`, and `harness.loop_started`. Loop-not-started is observed only after correlated lines for that `executionId`; it is **not** inferred from `failedReason` alone. Missing or contradictory evidence cannot pass. `providerTrafficProof` remains `NOT_ESTABLISHED`. |
| POST/INSERT/enqueue that may have been sent, then `ECONNRESET` / timeout / unreadable response, classified as `did_not_occur`. Request-ID-only xAI reconcile returned `{}` without querying. | After a write is dispatched, timeout / reset / lost response is `*_ACK_UNKNOWN` unless non-submission is demonstrable. No automatic retry. xAI reconcile queries `usage_records` by designated `user_id` **and** `request_id` (804f8983 unique index). Stub reconcile looks up the job by recorded `executionId` via `getJobs` when no job id was returned. Unresolved ambiguity is preserved. HTTP 202 without `executionId` is `POST_ACK_UNKNOWN`. |
| `assessZeroTokenAccounting({ deductionPresent: true })` returned `pass` without tokens, deduction identity, or balances. | Complete finite execution-correlated evidence is required: `tokensUsed === 0`, exactly one matching deduction row (`source_event_id` or `execution_id` equals the canary id), `appliedCredits === 0`, equal finite balances. Conflicting rows → `conflicting`. Null / malformed / mismatched / incomplete → `incomplete`. Stub `completed` requires `accountingEvidence=pass` and `proofAccepted=accepted`. xAI-negative still expects **no** deduction. Retained usage/deduction rows follow the approved cleanup amendment. CREDIT sensitivity is unchanged. |
| Observation loop computed remaining time once per iteration and reused it; `Promise.race` did not cancel the loser. A 20 ms budget mock returned expected rejection after 45 ms. | Remaining time is recalculated before every awaited operation and before accepting terminal success. `boundCall` aborts via `AbortSignal` on timeout so mocked clients can tear down. Timed-out writes stay acknowledgment-unknown. Sequential-delay and hanging-client cleanup tests cover this. |
| Both entry points printed failed/incomplete results with exit 0. | CLI exit: `0` intended evidence collected (does **not** imply independent network proof); `1` failure/unexpected; `2` refusal; `3` incomplete observations; `4` acknowledgment unknown; `5` timeout. Entry points including shutdown are tested, not only classifiers. |

### 2.3 Third independent review (three findings; this correction)

The 29 stub / 33 xAI self-tests of the previous copies all passed and still missed these defects. They are **not** described as unchanged.

| Review finding | Correction |
|---|---|
| xAI evidence can contradict itself and still pass: entitlement rejection, loop start, or conflicting routing evidence did not prevent `EXPECTED_XAI_REJECTION`; an unrelated correlated JSON log (e.g. `execution_completed` with matching `executionId`) caused `parseWorkerLogLines()` to infer `loopStarted=false` and `entitlementVerificationFailed=false`; `routeEvaluatedFailClosed` remained unknown yet the result passed. | `parseWorkerLogLines()` now infers absence only from the specific `agent_harness.route_evaluated` event, not from arbitrary correlated logs. Supports Nest `Logger.log()` envelope (prefix + ANSI codes) via `tryParseJsonFromLine()` — verified from worker.processor.ts source (source-based inference, not direct observation). `classifyXaiEvidence()` now checks entitlement rejection, conflicting route (`routeEvaluatedFailClosed='false'`), loop-start contradiction, and requires observed `routeEvaluatedFailClosed='true'` (not unknown) for `EXPECTED_XAI_REJECTION`. `assembleXaiEvidence()` passes `entitlementVerificationFailed` and `routeEvaluatedFailClosed` from log observations. Result classification, proof acceptance, and CLI exit code now agree. |
| Timeout wrappers do not terminate underlying clients: `boundCall` / `abortable` rejects the wrapper but the underlying `pg.end()`, `redis.quit()`, `queue.close()` continue indefinitely; shutdown returned without error with zero forced disconnects. | Both adapters' `shutdown()` now: (1) attempts bounded graceful teardown via `boundCall`; (2) on graceful timeout, force-disconnects using `redis.disconnect()`; (3) logs cleanup failures through the adapter's `log()` function with `event: 'shutdown_cleanup_incomplete'` including failure list and `forcedDisconnect` flag; (4) does not silently swallow failure. CLI `finally` block now catches and reports shutdown errors via `sanitizeUntrustedError` instead of `.catch(() => undefined)`. Shutdown timeout is configurable via `AISB_01C6A_SHUTDOWN_TIMEOUT_MS` (default 5000ms) for test control. Regression tests use mocked clients that hang on `close()`/`quit()`/`end()` and verify `redis.disconnect()` is called and cleanup failure is reported. |
| Missing BullMQ job ID becomes a valid-looking string: `String(undefined)` produces `"undefined"` which passes the caller's truthiness check. | `createStubLiveAdapters().addJob` now validates the raw `result.id` from `queue.add()` before conversion: `null`, `undefined`, empty string, `"undefined"`, and `"null"` all produce `ENQUEUE_ACK_UNKNOWN` with `ack_unknown` class and preserved `executionId`. The caller's existing truthiness check is a secondary guard. Regression tests exercise through `createStubLiveAdapters()` with mocked Queue responses returning `undefined` and `null` ids. |

### 2.4 Fourth independent review (two blockers; this correction)

The 32 stub / 40 xAI self-tests of the previous copies all passed and still missed these defects. They are **not** described as unchanged.

| Review finding | Correction |
|---|---|
| Contradictory routing evidence is silently overwritten: two `agent_harness.route_evaluated` events for the same `executionId` with different `selectedPath` values (e.g. `harness` then `fail_closed`) produce `routeEvaluatedFailClosed='true'` because the second event overwrites the first. Order `fail_closed→harness` rejected, but `harness→fail_closed` accepted as EXPECTED. | `parseWorkerLogLines()` now tracks `routeEvidenceConflicting`: once a `route_evaluated` event sets a definite value (`'true'` or `'false'`), any later event with a different value sets the conflict flag permanently. `LogObservation`, `XaiClassifiedEvidence`, and `assembleXaiEvidence()` carry the flag. `classifyXaiEvidence()` checks `routeEvidenceConflicting` before all other checks and returns `UNEXPECTED_ROUTING_RESULT`. Repeated identical `fail_closed` events do not falsely conflict. Events for other `executionId` values do not contaminate. Regressions test both event orders through the parser, through `classifyXaiEvidence()`, and through the concrete adapter path. |
| Incomplete cleanup does not prevent CLI success: both CLIs determine the return value inside `try`/`catch` and call `shutdown()` in `finally`. The `finally` block logs cleanup failures but cannot change the already-determined return value. A successful canary with a hanging `pg.end()` exits 0. | Both CLIs restructured: early returns for `isolated-mock` and `refuse` modes (no adapters created). For live mode, primary outcome is collected without returning. Cleanup runs after the `try`/`catch`, consumes the `ShutdownResult` (new type with `complete`, `pendingClients`, `forcedClients`), and only then determines the final exit code. New exit code `EXIT_CLEANUP_INCOMPLETE = 6`. Successful canary + incomplete cleanup → exit 6 with `CLEANUP_INCOMPLETE: <client names>` on stderr. Failed/ambiguous canary + incomplete cleanup → preserves primary exit code but still reports cleanup failure. Shutdown returns per-client status: `settled` set tracks which clients confirmed closure; `pg` has no force-kill API on `PgLike` — a hanging `pg.end()` remains pending and produces `CLEANUP_INCOMPLETE`. `redis.disconnect()` is forced on graceful timeout. **Limitation:** `pg.end()` has no force-disconnect API through the `PgLike` interface; a hanging PostgreSQL connection prevents bounded process termination. The CLI reports `CLEANUP_INCOMPLETE: pg` and exits non-zero, but the Node.js process may not exit until the underlying TCP socket times out. |

**Confirmed closed findings from §2.1 through §2.4:**

1. ✅ Concrete live adapters implemented (§2.1)
2. ✅ Entitlement/routing/loop-start contradiction detection (§2.1, §2.3, §2.4)
3. ✅ Nest Logger envelope parsing (§2.3)
4. ✅ Job ID validation (§2.3)
5. ✅ Contradictory route overwrite (§2.4)
6. ✅ CLI exit reflects cleanup outcome (§2.4)
7. ✅ Per-client shutdown tracking with `ShutdownResult` (§2.4)

---

## 3. Prepared script behavior

### 3.1 Common gates

- Default invocation **refuses** live submit (`AISB_01C6A_LIVE_SUBMIT` unset) and exits 2.
- `AISB_01C6A_ISOLATED_MOCK=1` runs isolated self-tests with network, queue, PM2, and database replaced.
- More than one of isolated / live / reconcile → `SUBMISSION_AMBIGUITY`.
- Live adapters require `AISB_01C6A_STAGING_EXECUTION_AUTHORIZED`. Without it, live mode throws `LIVE_SUBMIT_BLOCKED_IN_PREPARATION` and does not connect.
- Scripts do **not** create API keys, grant `is_internal`, alter PM2, provision credits, create fixtures, load repository `.env`, or rewrite localhost Docker URLs.
- Revoked key `60937d22-090a-4011-9e21-e7d3dac9ced9` is excluded as `AISB_01C6A_API_KEY_ID`.
- Required fixture IDs must be UUIDs before any submit. Live targets (Redis / Postgres / Gateway URL) are validated **before** connect.
- Safe identifiers are recorded **before** insert / POST (`executionId` for stub; `Idempotency-Key` UUID for xAI). Lost acknowledgments do **not** generate another canary.

### 3.2 Stub (`canary-01c6a-stub-submit.ts`)

- Ingress: `STUB_DIRECT_QUEUE_WITH_CONTRACT_PROOF`.
- Queue name `ai-execution`, job name `execute-ai`.
- Job options: `attempts: 1`, `removeOnComplete: true`, `removeOnFail: false` (preserves failed-job identity).
- HMAC proof uses the frozen `HARNESS_ENTITLEMENT_PROOF_V1` algorithm matching Gateway `createHarnessEntitlementProof` / worker verify at 804f8983.
- `usage_records` INSERT matches the deployed schema (`execution_id`, `api_key_id`, `user_id`, `session_id`, `conversation_id`, `provider`, `adapter`, `model`, `execution_status='pending'`, `metadata` JSONB). **Not deleted** (amendment).
- Completed BullMQ jobs may be auto-removed (`removeOnComplete: true`). Completion is then taken from retained `usage_records` (and optional zero-token `credit_deduction_records` where present).
- `proofAccepted` is not assumed true on failure. Failed HMAC (`HARNESS_ENTITLEMENT_PROOF_*` in `failedReason`) → `rejected`. Missing correlated evidence → `unknown`.
- Zero-token accounting requires **complete** evidence: finite `tokensUsed === 0`, exactly one deduction row whose `sourceEventId` or `executionId` matches the canary execution, finite `appliedCredits === 0`, and `balanceBefore === balanceAfter`. `deductionPresent: true` without rows is `incomplete`, not `pass`. Multiple usage or deduction rows are `conflicting`. Stub outcome `completed` requires `accountingEvidence=pass` and `proofAccepted=accepted`. Absence of a deduction row remains `not_present` (failed HMAC path). Non-zero is `fail_nonzero`. Rows are **retained** (amendment).
- Insert/enqueue timeout, `ECONNRESET` after dispatch, or a missing returned job id → `INSERT_ACK_UNKNOWN` / `ENQUEUE_ACK_UNKNOWN`. Reconcile is read-only by recorded `executionId` (`getJobs` when job id is absent). No replacement submit.

### 3.3 xAI-negative (`canary-01c6a-xai-negative.ts`)

- Ingress: Gateway `POST /api/ai/execute`. Direct enqueue is forbidden.
- Body: `provider=xai`, `model=grok-4.5`, `harnessVersion=v1`, `executionIntent=conversation`, persisted `agentId`.
- Auth: `Authorization: Bearer` from `AISB_01C6A_API_KEY_TOKEN` (never logged). `Idempotency-Key` is recorded before POST.
- `EXPECTED_XAI_REJECTION` requires **all** of: `failReason=adapter_lacks_tool_use` from the correlated BullMQ `failedReason` (not generic `fail_closed`); ledger `execution_status=failed`; log-observed loop not entered; notify-complete false; `applyDeduction` false (no credit row, or observed absent). Missing job/log evidence is `INCOMPLETE_OBSERVATIONS`. `adapter_lacks_tool_use` plus `harness.loop_started=true` is `UNEXPECTED_ROUTING_RESULT`.
- `providerTrafficProof` is always `NOT_ESTABLISHED`. An expected routing error is **not** independently observed zero provider traffic.
- Observation config (`DATABASE_URL`, `REDIS_URL`, `AISB_01C6A_WORKER_LOG_PATH`) is validated **before POST**. Submission remains Gateway `POST /api/ai/execute` only.
- Hung POST, `ECONNRESET` after POST dispatch, unreadable 202 body, or 202 without `executionId` → `POST_ACK_UNKNOWN` (not proof of non-submission; do not POST again). Hung observer after HTTP 202 → `TIMEOUT` with POST ack class `ack`.
- Read-only reconcile uses recorded Idempotency-Key / `request_id` **and** designated `userId` (`SELECT ... FROM usage_records WHERE user_id = $1 AND request_id = $2`). Zero rows keep ambiguity. More than one row is incomplete/conflicting. Does not generate a replacement submission.

### 3.4 Concrete adapters (gated; not used against staging)

Stub live adapter: `pg` Client + BullMQ `Queue('ai-execution')` + ioredis. Validates redis(s) / postgres(ql) hostnames before connect. Observation: `usage_records` + all matching `credit_deduction_records` (identity and multiplicity checked) + `queue.getJob` / read-only `getJobs` by `executionId` (missing job after complete is a valid `removeOnComplete` outcome).

xAI live adapter: `fetch` to Gateway execute + `pg` ledger (by `execution_id` and by `(user_id, request_id)`) + read-only BullMQ `getJobs` (never `add`) + worker log file / injected `logSource.readLines()`. Log harvest is **not** implemented as SSH/PM2 access. Isolated adapter tests mock `http` / `pg` / `queue` / `logSource` and do **not** inject a preassembled expected rejection.

This window did **not** construct real clients against staging URLs.

### 3.6 CLI exit status

Exit success does **not** imply independent network proof, PM2 restore, or live PASS.

| Code | Meaning |
|---|---|
| 0 | Intended evidence collected: stub `completed` with `accountingEvidence=pass` and `proofAccepted=accepted`, or xAI `EXPECTED_XAI_REJECTION`. **Not** packet-capture proof. |
| 1 | Failure / unexpected routing / blocked / uncaught |
| 2 | Refusal (not submitted) |
| 3 | Incomplete observations |
| 4 | Acknowledgment unknown |
| 5 | Timeout (including observation deadline after an acknowledged write) |

`AISB_01C6A_ISOLATED_MOCK=1` that finishes its self-tests also exits 0; that is mock-suite success, not live evidence.

### 3.5 Scope assumptions the scripts validate vs cannot validate

Validated before submit: UUID format; revoked-key exclusion; non-empty HMAC secret (stub); Gateway base URL scheme without userinfo (xAI); live/mock/reconcile exclusivity; registered job options (stub); Redis/Postgres URL shape when live/reconcile; xAI live/reconcile observation config (`DATABASE_URL`, `REDIS_URL`, `AISB_01C6A_WORKER_LOG_PATH`) before POST.

**Not** validated by these scripts (later live preflight / operator confirmation; **unresolved**): `ai:execute` + `ai:harness` scopes, `harnessEntitled`, `isInternal`, LaunchGuard/`LAUNCH_STATE`, CreditBalanceGuard balance, workspace `README.md` presence, HMAC secret actually loaded in the running PM2 worker, dummy vs real `XAI_API_KEY` on the worker, `PROVIDER_XAI_ENABLED`, HEAD parity, **PM2 process-env apply/restore**, **packet-capture / independent network observation**. Isolated mock success does **not** solve those prerequisites.

---

## 4. Proposed environment restoration matrix

Process-scoped overrides apply **only** to staging processes that a later authorized window actually changes. Preparation does not apply any of these values.

Per-variable baseline capture must record one of: **SET** (value present), **EMPTY** (variable exists and is empty string), **ABSENT** (unset). Restore is individual. Do not treat ABSENT as EMPTY. Do not treat EMPTY as SET.

| Variable | Canary apply (later live only) | Restore if SET | Restore if EMPTY | Restore if ABSENT | Notes |
|---|---|---|---|---|---|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | exact prior value | empty | unset | Do not persist to `/opt/aisandbox/.env` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | exact prior value | empty | unset | No empty-string HMAC-style exception |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | exact prior value | empty | unset | No empty-string exception |
| `AGENT_HARNESS_STUB_WRITE_MODE` | absent / not `true` | exact prior value | empty | unset | No empty-string exception |
| `HARNESS_ENTITLEMENT_HMAC_SECRET` | process-scoped non-empty secret on Gateway **and** worker | exact prior value | empty | unset | **Proposed exception:** restoring EMPTY as empty-string is only a proposed exception pending demonstrated equivalence with ABSENT at verification time **and** later live authorization. **Do not apply that exception automatically.** Do not print the secret. |
| `EXECUTION_PROVIDER_RETRY_ATTEMPTS` | `1` | exact prior value | empty | unset | **No** HMAC empty-string exception |
| `EXECUTION_TIMEOUT_MS` | stub/xAI default `20000` acceptable | exact prior value | empty | unset | **No** HMAC empty-string exception |
| Dummy `XAI_API_KEY` (xAI-negative) | non-secret placeholder sufficient to construct `XAIAdapter` | exact prior value | empty | unset | **No** HMAC empty-string exception; not a real credential |
| `OPENAI_API_KEY` | not applied by 01C6A | n/a | n/a | n/a | 01C6B only; listed so restore tooling does not invent a 01C6A apply |
| `PROVIDER_XAI_ENABLED` | must not be `false` for negative path | exact prior value | empty | unset | **No** HMAC empty-string exception |
| `GLOBAL_EXECUTION_ENABLED` | not in 01C6A apply set unless later ENV procedure requires it | exact prior value | empty | unset | LIVE-11 analog restore remains `false` only if this window changed it |
| Harness product flags / frontend `harnessVersion` | forbidden | n/a | n/a | n/a | Unchanged |

HMAC empty-string restoration exception **must not** be applied automatically to retry, timeout, provider, or Harness flags.

**PM2 restoration remains unresolved.** Isolated mocks do not apply, capture, or restore PM2 env. Mock PASS is not restore proof.

### 4.1 Secure baseline capture

1. Capture **names and presence class** (SET / EMPTY / ABSENT) without printing secret **values**.
2. For SET secrets, store the baseline in an operator-controlled secret buffer that is not copied into `docs/`, chat, or git. Record only a non-reversible presence token (for example SHA-256 of the value) for later equality checks.
3. Verification without secret disclosure: compare captured presence token / length class after restore; confirm ABSENT remains absent via `printenv` name-only tests; do not `echo` values.
4. Failed restoration: **do not destroy recovery information** (presence tokens, SET/EMPTY/ABSENT map, PM2 dump taken before apply) until restore is verified. If restore fails, stop and return to Keith with the recovery map intact.

Preparation did **not** capture a live baseline. Live capture fields are NOT RUN.

---

## 5. Proposed packet capture — what it can and cannot establish

Packet capture is a **proposed** later live aid. Tool availability is a later **read-only** staging preflight item. **Installation is not authorized.** This window ran no capture.

Isolated mock success does **not** establish destination coverage, DNS, IPv6, proxy, or capture-loss behavior.

| Claim | Capture can establish | Capture cannot establish |
|---|---|---|
| Destination coverage | Packets observed toward the configured capture filter (host/port as specified at capture time) | Traffic to destinations not in the filter, including other xAI/CDN hosts |
| DNS changes | Names resolved **during the capture window** if DNS is included | Resolutions before/after the window; DoH/DoT if not captured; later TTL changes |
| IPv6 | IPv6 flows on the captured interface/family | IPv6 on another interface, or IPv4-only capture missing AAAA paths |
| Proxies | Traffic to an observed proxy hop | Origin `api.x.ai` beyond a TLS-terminating proxy; CONNECT targets if not decoded |
| Capture loss | Nothing reliable | Dropped packets, ring-buffer overwrite, wrong interface, permission gaps, container netns mismatch |
| Expected routing error | Process-level `adapter_lacks_tool_use` | **Independently observed zero provider traffic** |

**Do not equate an expected routing error with independently observed zero provider traffic.** Script field `providerTrafficProof=NOT_ESTABLISHED` until a later authorized capture (or equivalent independent observation) is reviewed.

---

## 6. Live evidence fields — all NOT RUN

Do not fabricate IDs, timestamps, captures, balances, or PASS results.

| Field | Status |
|---|---|
| STAGING SSH / AWS | NOT RUN |
| PM2 env apply / restore | NOT RUN (unresolved prerequisite) |
| Dummy `XAI_API_KEY` apply / restore | NOT RUN |
| HMAC secret apply / restore | NOT RUN |
| Harness flag apply / restore | NOT RUN |
| Retry / timeout / provider flag apply / restore | NOT RUN |
| Baseline capture (SET/EMPTY/ABSENT) | NOT RUN |
| Restore verification | NOT RUN |
| Stub live submit | NOT RUN |
| xAI-negative Gateway POST | NOT RUN |
| Real Redis / Postgres / HTTP adapters against staging | NOT RUN |
| executionId (stub) | NOT RUN |
| executionId (xAI) | NOT RUN |
| jobId | NOT RUN |
| usage_records row id | NOT RUN |
| credit_deduction_records row id | NOT RUN |
| tokensUsed | NOT RUN |
| balanceBefore / balanceAfter | NOT RUN |
| route_evaluated / failReason | NOT RUN |
| packet capture | NOT RUN |
| tcpdump/tshark/dumpcap availability | NOT RUN (preflight later; install unauthorized) |
| provider HTTP to `api.x.ai` | NOT RUN |
| Disposable workspace / README.md | NOT RUN |
| Privilege grant | NOT RUN |
| Key creation | NOT RUN |
| Credit provision | NOT RUN |
| Isolated worker / dedicated queue | NOT RUN (does not exist; not added) |
| Frontend harnessVersion | NOT RUN (unchanged / omitted) |

---

## 7. Isolated mock / typecheck (this window)

Ran locally with network, queue, PM2, and database operations replaced. Did **not** invoke either canary entry point against staging. Did **not** rerun previously accepted application suites. Did **not** rebuild deployed artifacts.

Results are recorded in §12 after execution.

Exercised by construction:

- missing fixtures
- submission-mode flag ambiguity **and** live+reconcile conflict (lost-ack must not submit)
- stalled insert / enqueue / HTTP / observer (deadline honored)
- lost insert / enqueue / POST acknowledgments (no automatic retry; read-only reconcile)
- failed HMAC verification (`proofAccepted=rejected`)
- failed stub without correlated proof evidence (`unknown` / incomplete)
- completed BullMQ job disappearance with retained ledger + zero-token check
- generic `fail_closed` / incomplete observations (not `EXPECTED_XAI_REJECTION`)
- unexpected routing result
- secrets embedded in transport errors (Bearer, URL passwords)
- concrete adapter boundaries with mocked `pg` / Queue / HTTP / log-source clients (**not** a preassembled expected rejection)
- live-adapter gate without `STAGING_EXECUTION_AUTHORIZED`
- revoked-key exclusion
- direct-enqueue forbidden on xAI
- usage_records retention / failed-job non-removal on stub
- xAI observation config required before POST; empty `getJobs` incomplete; contradictory `loop_started` unexpected
- committed-then-disconnected INSERT / enqueue / POST; reconcile without returned execution/job id
- complete accounting evidence (null/malformed/conflicting/mismatched rows cannot pass)
- sequential remaining-time deadlines; hanging-client AbortSignal cleanup
- CLI entry points including shutdown: exit 0/2/3/4/5
- unrelated correlated log does not infer routing evidence (`unrelated-log-event`)
- entitlement rejection contradicts expected success (`entitlement-contradiction`)
- non-fail-closed route contradicts `adapter_lacks_tool_use` (`conflicting-route-evidence`)
- missing routing evidence stays incomplete (`missing-log-evidence`)
- loop-start with fail-closed route is unexpected (`loop-start-contradiction`)
- Nest Logger.log() envelope with prefix and ANSI codes parsed (`nest-formatted-log-lines`)
- shutdown timeout forces redis disconnect; cleanup failure reported (`shutdown-timeout-forced-disconnect`)
- missing/null BullMQ job ID produces `ENQUEUE_ACK_UNKNOWN` via concrete adapter (`missing-job-id-validation`, `null-job-id-validation`)

These mocks do **not** prove PM2 restoration, HMAC presence on the running worker, or independent network observation. Mock PASS is not preparation acceptance.

---

## 8. Permissions still required for live execution

Preparation admission does not grant these. Exact remaining Keith authorizations:

1. **STAGING** — AWS Lightsail `aisandbox-staging` use of existing PostgreSQL, Redis, Gateway, worker, CM/Docker as needed; read-only preflight; later process-scoped env on the processes actually changed. Scripts additionally require `AISB_01C6A_STAGING_EXECUTION_AUTHORIZED` in-process.
2. **CREDIT** — if optional 0-token stub finalize remains in AC (declared; not authorized). Non-zero balance change remains FAIL unless separately authorized.
3. **ENV** — only if the live procedure mutates staging process env / execution gates (`pm2 restart --update-env` analog). Not declared on the candidate today. Stop and return to control plane before adding ENV.
4. Shared-worker Harness flag window and **PM2 restore procedure** (module-load `DEFAULT_AGENT_HARNESS_CONFIG_V1`). Unresolved.
5. Confirmed entitled DB key (not `60937d22-090a-4011-9e21-e7d3dac9ced9`), `is_internal` grant if still required, matching session, persisted `agentId`, disposable workspace containing `README.md`.
6. Dummy non-secret `XAI_API_KEY` on the worker sufficient to construct `XAIAdapter`; `PROVIDER_XAI_ENABLED` not `false`.
7. Packet-capture tool **availability** preflight (read-only). Installation not authorized unless Keith separately authorizes it. Network observation remains unresolved.
8. HMAC empty-string restore exception — only after demonstrated equivalence and later live authorization; not automatic.
9. Removal of a canary-owned failed BullMQ job — only after evidence capture **and** later execution authorization.
10. **PROVIDER-LIVE remains forbidden** on this child. Real OpenAI remains EXEC-01C6B.

Unauthorized in every 01C6A window unless explicitly added later: LOCAL-RUNTIME as canary venue; Docker compose down -v; stopping standing PM2/systemd services; key creation; privilege grant by the canary scripts; credit balance top-up; frontend `harnessVersion`; mutation tools.

---

## 9. Invitation / Lane 3 / product-visible Harness

PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.
Lane 3 remains DISABLED.
Product-visible Harness remains FUTURE / gated / disabled / unavailable.

---

## 10. Activity ledger (preparation correction window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, key creation=0, privilege grant=0, canary submission=0, packet capture=0, local application test suites rerun=0, deployed artifact rebuild=0, Git commit/push=0, Lane 3=0, ENV mutex=0, STAGING mutex=0, CREDIT mutex=0, PROVIDER-LIVE=0.

Governance writes: this evidence document only (cleanup amendment preserved; board/registry not rewritten in this correction). Implementation writes: the two canary scripts only.

---

## 12. Preparation verification (filled after local isolated run)

Isolated mock PASS is **not** live PASS, not preparation acceptance, not PM2 restore proof, and not independently observed zero provider traffic.

| Check | Result |
|---|---|
| Isolated stub self-test | PASS — 34 cases: submission-ambiguity-flags, submission-ambiguity-lost-ack-no-retry-mode, missing-fixtures, revoked-key-excluded, live-refuse, stalled-observation-timeout, lost-insert-acknowledgment, lost-enqueue-acknowledgment, failed-hmac-verification, failed-stub-proof-unknown, completed-job-disappearance-ledger, happy-path-retain-and-redact, secrets-embedded-in-errors, local-hmac-verify-reject, concrete-adapter-mocked-clients, live-adapter-gate, readonly-reconciliation-path, complete-accounting-evidence, completed-requires-complete-accounting, insert-committed-then-disconnected, enqueue-committed-then-disconnected, reconcile-without-returned-job-id, sequential-delay-deadline, hanging-client-cleanup, shutdown-timeout-forced-disconnect, missing-job-id-validation, null-job-id-validation, cli-success-exit, cli-refuse-exit, cli-incomplete-exit, cli-ack-unknown-exit, cli-timeout-exit, cli-cleanup-incomplete-exit, cli-failure-plus-cleanup-failure |
| Isolated xAI self-test | PASS — 44 cases: submission-ambiguity-flags, submission-ambiguity-lost-ack-no-retry-mode, missing-fixtures, revoked-key-excluded, live-refuse, expected-xai-rejection, generic-fail-closed-not-expected, incomplete-observations, failed-hmac-verification, transport-failure, pre-post-transport-failure, unexpected-routing-result, timeout, stalled-http-lost-acknowledgment, stalled-observer-timeout, direct-enqueue-forbidden, secrets-embedded-in-errors, post-committed-then-disconnected, post-202-missing-execution-id, sequential-delay-deadline, hanging-client-cleanup, concrete-adapter-mocked-clients, observation-config-before-post, empty-queue-incomplete, contradictory-loop-started, unrelated-log-event, entitlement-contradiction, conflicting-route-evidence, missing-log-evidence, loop-start-contradiction, nest-formatted-log-lines, contradictory-route-order, contradictory-route-concrete, shutdown-timeout-forced-disconnect, live-adapter-gate, reconcile-by-user-and-request-id, reconcile-unresolved-without-execution-id, cli-success-exit, cli-refuse-exit, cli-incomplete-exit, cli-ack-unknown-exit, cli-timeout-exit, cli-cleanup-incomplete-exit, cli-failure-plus-cleanup-failure |
| Default entry (no live flag) | Exit 2 — `STUB_CANARY_NOT_SUBMITTED` / `XAI_CANARY_NOT_SUBMITTED` |
| Typecheck of the two scripts | PASS — `npx tsc --noEmit` with ai-service Node types |
| Whitespace check | PASS (no tabs or trailing whitespace) |
| Stub script SHA-256 | `740f52e2a387d44b51ecd6392895e2c01d8a31fbbdfa7f5548d7806fcf041966` |
| xAI script SHA-256 | `459ad1eac4529749591489b986b01fb0d2f631cab99f93a04fbf00254dc4c22c` |
| This evidence file SHA-256 | see independent-review report after this fill |
| Live staging adapters | NOT RUN |
| PM2 restoration | NOT RUN / unresolved |
| Network observation / packet capture | NOT RUN / unresolved |

### 12.1 New tests added in this correction (§2.4)

| Test name | Script | Blocker | What it verifies |
|---|---|---|---|
| `contradictory-route-order` | xAI | 1 | Both event orders (`harness→fail_closed` and `fail_closed→harness`) through `parseWorkerLogLines()` set `routeEvidenceConflicting=true`; repeated identical `fail_closed` does not conflict; cross-execution events do not contaminate; `classifyXaiEvidence()` returns `UNEXPECTED_ROUTING_RESULT` for conflicting evidence |
| `contradictory-route-concrete` | xAI | 1 | Conflicting route logs through the full concrete adapter path (`createXaiLiveAdapters` → `runXaiNegativeCanary`) produce `UNEXPECTED_ROUTING_RESULT` |
| `cli-cleanup-incomplete-exit` | stub, xAI | 2 | Successful canary + `shutdown()` returning `{ complete: false, pendingClients: ['pg'] }` → exit 6 (`EXIT_CLEANUP_INCOMPLETE`); `CLEANUP_INCOMPLETE` and client name appear on stderr |
| `cli-failure-plus-cleanup-failure` | stub, xAI | 2 | Failed canary (exit 4 ack-unknown) + incomplete cleanup → preserves primary exit 4; `CLEANUP_INCOMPLETE` still reported on stderr |

### 12.2 Updated existing tests in this correction (§2.4)

| Test name | Script | Change |
|---|---|---|
| `shutdown-timeout-forced-disconnect` | stub, xAI | Now verifies `ShutdownResult`: `complete=false`, `pendingClients` includes `pg` and `queue`, `forcedClients` includes `redis` |
| `cli-success-exit` | stub, xAI | Shutdown mock now returns and forwards `ShutdownResult` |
| `cli-incomplete-exit`, `cli-ack-unknown-exit`, `cli-timeout-exit` | stub, xAI | Shutdown mocks return `{ complete: true }` |

### 12.3 Exit code matrix

| Exit code | Meaning | Cleanup status |
|---|---|---|
| 0 | Intended evidence collected | Complete |
| 1 | Failure / unexpected | Any |
| 2 | Refusal (no live flag) | N/A (no adapters) |
| 3 | Incomplete observations | Any |
| 4 | Acknowledgment unknown | Any |
| 5 | Timeout | Any |
| 6 | Cleanup incomplete | Primary was success but cleanup pending |

### 12.4 Known limitation — PostgreSQL bounded process termination

`pg.end()` sends a termination message over the TCP socket. The `PgLike` interface exposes no force-disconnect API. If `pg.end()` does not resolve within the shutdown timeout, Redis is force-disconnected via `redis.disconnect()`, but PostgreSQL remains pending. The CLI reports `CLEANUP_INCOMPLETE: pg` and exits 6 (non-zero), but the Node.js process may not terminate until the underlying TCP socket times out or the OS closes it. This is a documented limitation of the `pg` Client's public API, not an implementation oversight.

**Remaining blockers for live execution (unchanged by this correction):** PM2 process-env apply/restore procedure; packet-capture / independent network observation; `STAGING_EXECUTION_AUTHORIZED=NO`; no SSH/AWS/staging session in this window. Do not treat mock PASS as authorization to submit.
