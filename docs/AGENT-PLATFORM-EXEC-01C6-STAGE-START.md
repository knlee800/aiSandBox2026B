# AGENT-PLATFORM-EXEC-01C6 — Stage-Start / Evidence Contract Freeze / Bounded Child Decomposition

**Task ID:** AGENT-PLATFORM-EXEC-01C6
**Title:** Read-only Harness canary — stub then real-provider transcript
**Step:** 2 — Stage-start / contract / write-set / evidence freeze
**Status:** COMPLETE (design / freeze only — no implementation) — environment correction 2026-09-07
**Date:** 2026-09-06 (original freeze); 2026-09-07 (AWS Lightsail staging environment correction)
**Nature:** HIGH-RISK 4-step IMPLEMENTATION child — Step 2 is governance documentation only
**Development program:** CURRENT
**Product-visible Harness capability:** FUTURE / gated / disabled / unavailable to users
**Stage-start document:** `docs/AGENT-PLATFORM-EXEC-01C6-STAGE-START.md`
**Step 2 base HEAD:** `e621be7b31836a49deebb1cb059dc0d5b80e199e` (original freeze)
**Environment-correction base HEAD:** `5f4577d7502db664ce0862fba87d1154b357acf2` (branch `main`; HEAD == origin/main)
**Parent umbrella:** AGENT-PLATFORM-EXEC-01C — remains READY / NOT ADMITTED / PROVISIONAL
**Frozen predecessor contract:** `docs/AGENT-PLATFORM-EXEC-01C-STAGE-START.md` §6K / §8.6
**Locked entitlement-proof checkpoint:** `docs/AGENT-PLATFORM-EXEC-01C5B-CHECKPOINT.md`

This is analysis, architecture, decomposition, and governance documentation only. No application source, tests, scripts, environment, package, compose, runtime, Docker, PostgreSQL, Redis, staging connection, provider-live, credit mutation, browser, child registration, Git commit, or Git push.

**Environment correction (2026-09-07):** Future canary **execution** for both proposed children is AWS Lightsail staging (`aisandbox-staging` / `https://staging.ainow.biz` / `/opt/aisandbox`). Local application tests and local runtime infrastructure are **not** part of this canary plan. Local read-only inspection and existing governance validation remain allowed. Local testing is exceptional and must be absolutely necessary; this correction does not introduce any local application-test or local-runtime requirement. Ingress, provider/model, accounting, and two-child decomposition remain as frozen below.

Proposed implementation children are recorded in this document only. They are **not** registered and **not** admitted.

---

## 1. Verdict

**PASS — evidence plan FROZEN; ingress FROZEN; real-provider recommendation FROZEN; stub / real-positive / xAI-negative / accounting contracts FROZEN; two-child decomposition FROZEN; future execution environment FROZEN as AWS Lightsail staging; implementation NOT STARTED.**

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP2_ENVIRONMENT_CORRECTION=COMPLETE
EVIDENCE_CONTRACT_FREEZE=COMPLETE
CHILD_SLICE_DECOMPOSITION=COMPLETE
FUTURE_EXECUTION_ENVIRONMENT=AWS_LIGHTSAIL_STAGING
LOCAL_APPLICATION_TESTS_IN_CANARY_PLAN=NO
LOCAL_RUNTIME_INFRASTRUCTURE_IN_CANARY_PLAN=NO
CHILD_TASKS_REGISTERED=0
IMPLEMENTATION_STARTED=NO
IMPLEMENTATION_ADMITTED=NO
PARENT_01C6_ADMITTED=NO
PRODUCT_VISIBLE_HARNESS=FUTURE_GATED
HARNESS_FLAGS_CHANGED=NO
FRONTEND_HARNESS_VERSION_CHANGED=NO
SELECTED_INGRESS=GATEWAY_HTTP_EXECUTE_FOR_REAL_AND_XAI; STUB_DIRECT_QUEUE_WITH_CONTRACT_PROOF
SELECTED_REAL_PROVIDER=openai
SELECTED_REAL_MODEL=gpt-4o
KEITH_DECISION_REQUIRED_BEFORE_PROVIDER_LIVE=YES
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE_FINAL=UNOWNED
IMPLEMENTATION_MUTEXES_ACQUIRED=NONE
PROCEED_TO_CHILD_REGISTRATION=NO_UNTIL_KEITH_COMMITS_ENVIRONMENT_CORRECTION
```

Keith's 2026-09-01 CURRENT development-program authorization does **not** authorize paid/live provider execution, credit mutation, or staging mutation. This stage-start does not grant LOCAL-RUNTIME, STAGING, PROVIDER-LIVE, or CREDIT. Parent sidecar `mutexes=["LOCAL-RUNTIME"]` remains validator-required provisional metadata for `evidenceClass=LOCAL-RUNTIME`; it is **not** an acquired local-runtime lease and does **not** authorize local tests.

---

## 2. Preflight confirmation

| Check | Result |
|---|---|
| Branch | `main` |
| Original Step 2 freeze HEAD | `e621be7b31836a49deebb1cb059dc0d5b80e199e` |
| Environment-correction HEAD | `5f4577d7502db664ce0862fba87d1154b357acf2` (matches expected `5f4577d`; HEAD == origin/main at correction open) |
| Working tree at correction open | clean |
| `git diff --check` | clean (correction window) |
| EXEC-01C6 | REGISTERED / READY / NOT ADMITTED / PROVISIONAL |
| Candidate `status` | `READY` |
| `writeSetPrecision` | `PROVISIONAL` |
| `admissionUncertain` | `true` |
| Candidate mutexes | `[LOCAL-RUNTIME]` schema-required for parent `evidenceClass=LOCAL-RUNTIME`; **not acquired**; **not** a local-test lease; LOCAL-RUNTIME UNOWNED; STAGING UNOWNED |
| Lane 1 / 2 / 3 | EMPTY / EMPTY / DISABLED |
| All mutexes | UNOWNED |
| `HARNESS_ENTITLEMENT_PROOF_V1` | FROZEN |
| EXEC-01C5B and children | LOCKED |
| EXEC-01C7 | unregistered (narrative in parent stage-start §8.7 only) |
| Runtime authorization | all `false` |
| Harness flags | `false` / unchanged |
| Product-visible Harness | FUTURE / gated |
| Sidecar / validator | unchanged in this correction |
| `git fetch` / `pull` / `checkout` / `reset` / `clean` / `commit` / `push` | NOT RUN |

---

## 3. Authorities and source inspected (read-only)

### 3.1 Scheduler / OS / living authority

| File | Method |
|---|---|
| `AGENTS.md` | Read — bootstrap |
| `CLAUDE.md` | Applied — OS / admission / mutex / GOV-OS-03 |
| `TASKS.md` CURRENT EXECUTION BOARD | Read — stop at `LEGACY / FROZEN` |
| `TASKS_BACKLOG_FULL.md` EXEC-01C and EXEC-01C6 bodies | Read |
| `docs/AGENT-PLATFORM-EXEC-01C-STAGE-START.md` | Read — freeze C/D/E/F/G/H/K and §8.6 |
| `docs/AGENT-PLATFORM-EXEC-01C5B-CHECKPOINT.md` | Read |
| `docs/AGENT-PLATFORM-EXEC-01C5B-STAGE-START.md` | Targeted — child-decomposition format |
| `docs/AGENT-PLATFORM-EXEC-01C3-CHECKPOINT.md` | Targeted — native transcript unit evidence |
| `docs/AGENT-PLATFORM-EXEC-01C5-CHECKPOINT.md` | Targeted — entitlement + mock accounting |
| `docs/control-plane/lane-saturation-state.json` | Read |
| `docs/control-plane/mutex-catalog.json` | Read |
| `scripts/validate-lane-capacity.ps1` | Executed (proof under `$env:TEMP` only) |

### 3.2 Historical canary evidence

| File | Method |
|---|---|
| `docs/AGENT-HARNESS-06D-CHECKPOINT.md` / live-canary docs | Targeted — direct BullMQ + `test-harness-stub`; unsigned jobs |
| `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Targeted — stub E2E needs PostgreSQL, Redis, Gateway, worker, container-manager, Docker session |
| `services/ai-service/scripts/canary-06d-submit-job.ts` | Read |
| `services/ai-service/scripts/canary-06e-submit-job.ts` | Read |
| `services/ai-service/scripts/canary-write-b-submit-job.ts` | Targeted — write-mode flag; out of scope |
| `services/ai-service/scripts/canary-07f1-submit-job.ts` | Targeted — inventory only |
| `services/ai-service/scripts/canary-07f2-cancel-signal.ts` | Targeted — inventory only |

No `.env`, secret, credential, key, certificate, or token **values** were opened or printed. Configuration **key names** were inspected from `.env.example` files and source.

### 3.3 Implementation inspected (read-only)

Gateway: `ai-execution.controller.ts` (+ spec), `provider-model.catalogue.ts`, `queue.service.ts` (`attempts: 1`), `session-or-api-key.guard.ts`, `api-key.config.ts`, `api-key-auth.guard.ts`, `credit-balance.guard.ts`, `launch.guard.ts`, `kill-switch.config.ts`, `usage-ledger.service.ts` (+ EXEC-01C5 harness accounting tests), `internal-accounting.controller.ts`, `credit-deduction.module.ts` (`PersistentCreditDeductionGateway` bound).

AI-Service: `job.types.ts`, `worker.processor.ts` (+ spec, builder-config spec), `agent-harness-loop.ts`, `agent-harness.config.ts`, `tool-registry.ts`, `adapter-tool-use.mapper.ts` (`selectAdvertisedAgentHarnessTools`), `openai-ai.adapter.ts`, `anthropic-ai.adapter.ts`, `xai-ai.adapter.ts`, `stub-ai.adapter.ts`, `test-harness-stub-ai.adapter.ts`, `ai-execution.service.ts` (`getAdapter`), `provider-model.catalogue.ts`, `api-gateway-http.client.ts`, `harness-audit-events.ts`.

Env examples: `services/api-gateway/.env.example`, `services/ai-service/.env.example`. Package scripts: `services/ai-service/package.json` (no canary npm script; do not add PACKAGE mutations). Frontend tests confirm `harnessVersion` is still omitted.

---

## 4. Current capabilities vs missing evidence

### 4.1 Already proven (do not re-implement)

| Capability | Evidence class | Source |
|---|---|---|
| OpenAI/Anthropic native transcript **unit** round-trip | LOCAL-TESTS | EXEC-01C3 LOCKED |
| Fail-closed routing when adapter lacks tool-use | LOCAL-TESTS | EXEC-01C1 / worker `resolveHarnessRouting` |
| Worker rejects missing/invalid HMAC proof before routing | LOCAL-TESTS | EXEC-01C5B2 LOCKED |
| Gateway produces HMAC proof for entitled `harnessVersion==='v1'` | LOCAL-TESTS | EXEC-01C5B1 LOCKED |
| Conversation Harness Ask-like deduction at ledger boundary (mock gateway) | LOCAL-TESTS | EXEC-01C5 LOCKED |
| Stub read-only loop + `list_files`/`read_file` via live worker | Historical LOCAL-RUNTIME | AGENT-HARNESS-06D/06E; **unsigned queue; no HMAC; no persisted `agentId`** |
| Frontend omits `harnessVersion` | LOCAL-TESTS | EXEC-01B / current frontend tests |

### 4.2 Missing evidence this canary must prove

1. Live Gateway-signed proof accepted by a live worker on a Harness job.
2. At least one **real** provider native multi-turn tool transcript (stub cannot satisfy this).
3. xAI Harness request fails closed **before** `XAIAdapter.execute` / any xAI HTTP.
4. Continuity of authenticated `userId`, `apiKeyId`, persisted `agentId`, audit events, and Gateway `executionId`.
5. Ask-like accounting: exactly one deduction keyed by `executionId` on a completed live execution; zero deduction on failed/unsupported.
6. No mutation tools advertised or executed (`write_file` / `delete_file` / `run_validation` / `browser_smoke` / `search_workspace` absent).
7. No product-visible activation; frontend still omits `harnessVersion`.
8. Process-scoped flags and temporary state restored.

### 4.3 Missing capability (do not silently expand production)

Gateway `provider-model.catalogue.ts` supports `stub | anthropic | openai | groq | xai | deepseek` only. It does **not** accept `test-harness-stub`. AI-Service `getAdapter('test-harness-stub')` exists and is the only `supportsToolUse=true` stub.

Gateway `stub` maps to `StubAIAdapter` (`supportsToolUse=false`) and would fail closed. That is a **negative** proof, not stub wiring.

**Frozen decision:** do **not** add `test-harness-stub` to the Gateway catalogue in EXEC-01C6. That would be a production Gateway change and a new entitlement/routing surface. Stub positive proof uses the historical worker-queue path plus a **contract-shaped HMAC proof**. Gateway HTTP production of the proof is required of the real-provider canary and the xAI negative canary.

No other production worker / adapter / Gateway / frontend / package / migration / Docker / environment-file change is required for the frozen canaries. If later execution discovers a blocking missing capability, stop and return to the control plane; do not expand silently.

---

## 5. Architecture and ingress freeze

### 5.1 Entitled identity (existing only)

Do **not** reopen `AGENT_HARNESS_BROWSER_SESSION_USER_IDS`. Do **not** mint a new entitlement mechanism.

Frozen test-only identity for Gateway HTTP canaries:

- Existing static key identity in `api-key.config.ts`: scopes `ai:execute` + `ai:harness`, `harnessEntitled: true`, `isInternal: true`.
- Alternative already implemented: DB API key with `ai:harness` scope.
- Browser-session allow-list remains the product path and is **not** the canary entitlement mechanism.

The literal key string must never appear in evidence, checkpoints, logs collected for this task, or board prose. Refer to it as `STATIC_HARNESS_ENTITLED_API_KEY`.

Gateway HTTP also requires, using that same authenticated `userId` (no new auth principal):

- `LAUNCH_STATE` that admits `isInternal` keys (staging live value unverified in this window; do not assume local `INTERNAL`).
- A real session whose `userId` matches the identity (CreditBalanceGuard / session ownership).
- A persisted `user_agents` row owned by that user (`agentId` + `executionIntent: 'conversation'` + `harnessVersion: 'v1'`).
- Process-scoped `HARNESS_ENTITLEMENT_HMAC_SECRET` on **both** Gateway and worker (never committed; never printed).
- CreditBalanceGuard: provisioned balance `> 0` **or** admin bypass. Provisioning a balance is CREDIT-sensitive and is authorized only with the child that uses Gateway HTTP.

### 5.2 Selected ingress by canary

| Canary | Ingress | Proves |
|---|---|---|
| Stub wiring | `STUB_DIRECT_QUEUE_WITH_CONTRACT_PROOF` — on AWS Lightsail staging, insert `usage_records` + BullMQ `ai-execution` job with `harnessVersion: 'v1'` and a proof built with the frozen `HARNESS_ENTITLEMENT_PROOF_V1` algorithm (same claim/canonical JSON/HMAC as Gateway `createHarnessEntitlementProof`). Provider `test-harness-stub`. Direct BullMQ ingress is distinct from execution location. | Worker verification, Harness routing, stub tool loop, audit/`executionId`/`agentId`, optional 0-token finalize-accounting. **Does not** prove Gateway HTTP signing or catalogue routing. **Does not** prove isolated-worker semantics. |
| Real native-transcript positive | `GATEWAY_HTTP_POST_/api/ai/execute` — authenticated entitled identity, `executionIntent: 'conversation'`, persisted `agentId`, `harnessVersion: 'v1'`, provider `openai`, model `gpt-4o`. | Entitlement, Gateway HMAC production, BullMQ serialization, worker verify, Harness routing, real native transcript, audit/final metadata, accounting. |
| xAI negative | Same Gateway HTTP execute ingress with provider `xai`, model `grok-4.5` (Gateway catalogue default). | Entitlement + valid proof + worker `fail_closed` before xAI execute. Zero provider-live HTTP. |

Manually constructing an **unsigned** queue job is forbidden as positive proof. Historical 06D/06E scripts are inventory only and must not be edited or reused as EXEC-01C6 evidence.

### 5.3 Process-scoped flags (all canaries)

Set only on the **staging** AI-Service worker process (and Gateway where HMAC signing is required); restore on every exit path; never write repository `.env` files; never persist flags into `/opt/aisandbox/.env` unless a later authorized child explicitly freezes that ENV write.

| Variable | Canary value | Restore |
|---|---|---|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | unset / previous |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | unset / previous |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | unset / previous |
| `AGENT_HARNESS_STUB_WRITE_MODE` | absent / not `true` | unset |
| `HARNESS_ENTITLEMENT_HMAC_SECRET` | process-scoped non-empty secret on Gateway **and** worker | unset / previous |
| `EXECUTION_PROVIDER_RETRY_ATTEMPTS` | `1` | unset / previous |
| `EXECUTION_TIMEOUT_MS` | stub/xAI: default `20000` is acceptable; real-provider: `120000` | unset / previous |

Default `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` remains `false`. Frontend is not started for these canaries.

**Flag-scoping rule (inspected code, not live-verified):** `DEFAULT_AGENT_HARNESS_CONFIG_V1` is created at **module load** from `process.env` (`services/ai-service/src/agent-harness/config/agent-harness.config.ts`). The worker reads `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` per job; it does **not** re-parse env per job. HMAC secret is read from `process.env` at verification time (`readValidatedHarnessEntitlementHmacSecret`). Setting flags in a submit-script process does **not** affect the already-running PM2 `aisandbox-ai-service` worker. Process-scoped flags on staging therefore require a later-authorized change of the **worker process env** (typically PM2 restart / `--update-env`) and matching Gateway HMAC env for Gateway-ingress canaries. Do not assume a local Node process or a one-shot script env automatically affects existing staging workers.

### 5.4 AWS Lightsail staging topology (later execution only; not this window)

Future execution environment for **both** proposed children: AWS Lightsail instance `aisandbox-staging` (Singapore / ap-southeast-1), app root `/opt/aisandbox`, public URL `https://staging.ainow.biz`. Operator venue for server commands is Lightsail browser SSH, matching existing staging runbooks. This Step 2 correction does **not** connect to AWS, SSH, deploy, or mutate staging.

Local application tests, local Docker Desktop, local PostgreSQL/Redis, and local Gateway/worker/CM processes are **not** in this canary plan. Local read-only repository inspection and existing governance validation (`git diff --check`, lane-capacity validator to `$env:TEMP`) remain allowed.

Inspected staging arrangement (runbooks/checkpoints; live state unverified in this window):

| Shared staging service | Evidence in repo | Stub | xAI negative | Real positive |
|---|---|---|---|---|
| PostgreSQL (systemd on VPS) | EXECUTION-03 / LIVE deduction path | YES (existing) | YES (existing) | YES (existing) |
| Redis / BullMQ queue `ai-execution` | EXECUTION-03; worker binds `ai-execution` | YES (existing) | YES (existing) | YES (existing) |
| PM2 `aisandbox-ai-service` (single worker) | 04D/04F; consumes shared `ai-execution` | YES (existing) | YES (existing) | YES (existing) |
| PM2 `aisandbox-api-gateway` | 04D/04F; LIVE-11 `POST /api/ai/execute` | YES if tools or notify/accounting; HMAC signer not used for stub enqueue | YES (ingress) | YES (ingress) |
| PM2 `aisandbox-container-manager` + Docker Engine | 04A Docker 29.6.2; 04F CM online | YES for successful `list_files`/`read_file` (06E lesson: Gateway down → `HANDLER_ERROR`) | NO (loop must not start) | YES |
| Frontend / browser | not required for these canaries | NO | NO | NO |
| Local Docker / local app runtime | excluded from this plan | NO | NO | NO |

Do **not** start, stop, delete, or replace these shared PM2/systemd services as canary-owned processes. Historical 06D/06E local-docker topology and `canary-06d-submit-job.ts` localhost URL rewrites are inventory only and must not be reused as EXEC-01C6 evidence.

### 5.5 Staging feasibility (repository evidence vs unverified)

| Question | Supported by inspected evidence | Still unverified (later live) |
|---|---|---|
| Staging host, PM2 four-app set, PostgreSQL, Redis, Docker Engine exist | YES — EXECUTION-03/04/04D/04F/04A checkpoints | Current process health, HEAD parity, and env values |
| Gateway HTTP execute works on staging for Builder golden-path | YES — LIVE-11 `POST /api/ai/execute` 202 on staging | Harness `harnessVersion: 'v1'` + HMAC proof + entitled identity on staging |
| Direct BullMQ stub can target staging Redis/Postgres from the VPS | YES in principle — worker already consumes `ai-execution`; 06D pattern inserts `usage_records` + queue job. Ingress remains direct-queue, **not** Gateway proof. Historical 06D localhost rewrite is **unsafe** on Lightsail and must not be copied. | Safe VPS connection strings without secret disclosure; HMAC-signed payload accepted by the **running** worker; no collision with in-flight staging jobs |
| Worker isolation / queue consumption | Inspected: **one** PM2 `aisandbox-ai-service` consumes the **shared** `ai-execution` queue. No dedicated canary queue or canary worker exists. Direct-queue jobs are visible to the same worker as Gateway jobs. | Whether a later child can apply harness flags without affecting unrelated staging jobs; whether a separate worker can be started without a production capability change |
| Process-scoped flags vs existing workers | Inspected: module-load freeze of `DEFAULT_AGENT_HARNESS_CONFIG_V1`; submit-script env does not affect PM2 worker | Current staging `AGENT_HARNESS_ENABLE_TOOL_LOOP` / HMAC secret presence (04D expected harness flags `false`; HMAC presence not evidenced here). Do not open `.env` or print secrets. |
| Temporary data and cleanup | LIVE-11 pattern: restore `GLOBAL_EXECUTION_ENABLED=false`, stop **canary-created** session/container, do not `pm2 delete` / `pm2 kill` standing apps. 06D cleaned its own `usage_records` row. | Exact canary-owned row/job/session IDs; HMAC/flag restore without leaving shared worker in a mutated state |
| File-backed workspace for `list_files`/`read_file` | Staging CM + Docker exist. Stub default reads `README.md`. | A disposable staging session that already contains `README.md` without mutating unrelated projects. FR-03 recorded **no** safe known file-backed disposable staging project. If live execution finds none, that is a **missing capability** — do not expand production templates in these children. |
| xAI negative with zero outbound provider HTTP | Worker fail-closed when adapter lacks `supportsToolUse` is unit-proven (EXEC-01C1/01C3). Gateway catalogue has `xai`/`grok-4.5`. Constructor requires non-empty `XAI_API_KEY` before routing inspects `supportsToolUse`. | Staging `PROVIDER_XAI_ENABLED` / dummy vs real key / whether enqueue is possible without emitting HTTP to `api.x.ai` |
| Authorized real OpenAI canary | Catalogues freeze `openai`/`gpt-4o`. LIVE-11 used **xAI**, not OpenAI, for Builder. | Staging OpenAI key/kill-switch; shared-worker flag window; credit-path behavior on staging |

If later live verification shows that isolated worker/queue semantics are required and do not exist, **stop and return to the control plane**. Do not add a production canary worker, canary queue, or Gateway `test-harness-stub` catalogue entry in these children.

Cleanup must restore **only canary-owned changes**. Forbidden: stopping pre-existing PM2/systemd services; `docker compose down -v`; dropping unrelated PostgreSQL/Redis data; claiming cleanup of Keith's standing staging environment as canary success.

Do **not** start any staging mutation in this Step 2 window.

---

## 6. Stub-canary contract (FROZEN)

**Owner child:** AGENT-PLATFORM-EXEC-01C6A (proposed).

**Intent:** read-only wiring. Prompt must forbid write/delete/rename/package/env/browser/validation.

**Provider / model:** `test-harness-stub` / `test-harness-stub`.

**Tools:** worker registers only `read_file` and `list_files` when write/validation/browser flags are false. Advertisement filter must yield exactly those two names. Stub adapter default mode calls `list_files({ path: '.' })` then `read_file({ path: 'README.md' })` then completes. `AGENT_HARNESS_STUB_WRITE_MODE` must not be `true`.

**Proof:** job **must** include `harnessEntitlementProof` produced with the frozen algorithm and the process-scoped HMAC secret. Unsigned jobs FAIL the stub canary.

**PASS assertions:**

1. Worker log `agent_harness.entitlement_verification_failed` is absent.
2. `agent_harness.route_evaluated` `selectedPath: 'harness'` with the same `executionId` and `agentId`.
3. Audit/loop: `harness.loop_started` → at least one `list_files` dispatch completed (not mutation) → `harness.loop_completed` `terminationReason: 'completed'`.
4. Ledger `execution_status=completed`. Same `executionId` as job/Gateway-shaped proof.
5. Persisted `agentId` on job, route log, and final metadata.
6. Advertised/executed tool names ⊆ `{list_files, read_file}`.
7. If accounting is exercised: exactly one `finalize_accounting.deduction_triggered` with `sourceEventId=executionId` and `tokensUsed=0`. Treat as **ledger-event evidence**. Non-zero balance change is a FAIL unless Keith separately authorized it (not expected for stub).
8. Flags restored; no repo `.env` dirty; no leftover temp workspace except redacted evidence doc.

**FAIL / abort:** any mutation tool; write-mode stub; unsigned job; provider HTTP; product flag default change; frontend `harnessVersion`; secret/signature/proof/prompt/persona in saved evidence.

---

## 7. Real-provider selection

### 7.1 Comparison (repository evidence only)

| Provider | `executeWithTools` | Catalogue model | Tests | Cost / ops |
|---|---|---|---|---|
| OpenAI | YES — native messages + tools + transcript (EXEC-01C3) | **Frozen allowed model `gpt-4o` only** on Gateway and AI-Service | Broad adapter + mapper specs | Not low-cost; no extra `ANTHROPIC_MODEL` env |
| Anthropic | YES — native `tool_use` / `tool_result` (EXEC-01C3) | `ANTHROPIC_MODEL` **required**; no frozen cheap ID | Broad adapter specs | Could be cheaper **if** Keith names a current cheap model; historical `claude-3-5-sonnet-20241022` is stale and must not be guessed |
| xAI | NO `supportsToolUse` / `executeWithTools` | `grok-4.5` | Fail-closed unit tests | Negative canary only |
| groq / deepseek / `stub` | NO | n/a | Fail-closed | Negative-class only |
| `test-harness-stub` | Synthetic; ignores transcript | Not a Gateway provider | Stub-only | Cannot satisfy real-provider AC |

### 7.2 Recommendation

**Recommended provider:** `openai`
**Recommended model:** `gpt-4o`

Rationale: only native-transcript-capable provider whose model ID is frozen in **both** catalogues without adding dependencies or editing production allow-lists; EXEC-01C3 already proved `executeWithTools` transcript construction; Chat Completions tool-calls are sufficient for a deterministic read-only `list_files` prompt.

**Cost caveat (explicit):** `gpt-4o` is not a low-cost model. Repository evidence cannot safely substitute `gpt-4o-mini` (not in `OPENAI_ALLOWED_MODELS`) or an Anthropic Haiku ID without a production catalogue/env decision. Keith may, at the later authorization step, **replace** this recommendation with Anthropic plus an explicitly named current cheap model. Until that replacement is written into the authorizing task, EXEC-01C6B uses `openai` / `gpt-4o`.

Do **not** call the provider in this window.

### 7.3 Live bounds (authorization envelope; not granted now)

| Bound | Frozen value |
|---|---|
| Maximum provider HTTP calls | **3** (`maxToolIterations`); expected **2** (tool-call turn + continuation). Abort before a 4th. |
| Retry count | **0** additional retries: process-scoped `EXECUTION_PROVIDER_RETRY_ATTEMPTS=1`. Queue `attempts: 1`. |
| Timeout | Process-scoped `EXECUTION_TIMEOUT_MS=120000` (default 20s is insufficient for two live turns). |
| Maximum expected provider cost | Conservative abort ceiling **USD 2.00** for the whole 01C6B canary. Keith may lower this at authorization. Do not treat this as a calculated price. |
| Maximum credit deduction exposure | **One** Ask-like deduction for **one** `executionId`; abort if a second `sourceEventId` appears. Exact credit formula is existing Ask translation of cumulative `tokensUsed`. Keith must authorize CREDIT before 01C6B runs. |
| Success evidence | See §8. |
| Failure / abort | See §8 FAIL list; also: HTTP 4th call, timeout, mutation tool, retries, secret leakage, catalogue/model change, frontend activation. |

`KEITH_DECISION_REQUIRED_BEFORE_PROVIDER_LIVE=YES`

---

## 8. Real-provider positive-canary contract (FROZEN)

**Owner child:** AGENT-PLATFORM-EXEC-01C6B (proposed).
**Ingress:** `GATEWAY_HTTP_POST_/api/ai/execute`.
**Provider / model:** `openai` / `gpt-4o` unless Keith replaces per §7.2.
**Prompt:** read-only; instruct a single `list_files` (or equivalent list) of the controlled workspace; forbid write/delete/browser/validation/package/env.

**PASS assertions:**

1. HTTP 202 `{ executionId, status: 'queued' }` from Gateway. That `executionId` is the canonical ID for all later assertions.
2. Enqueued job includes `harnessVersion: 'v1'`, `agentId`, `userId`, `apiKeyId`, `executionIntent: 'conversation'`, `harnessEntitlementProof` (presence only in operational logs — **do not persist signature/proof**).
3. Worker verifies proof (no `entitlement_verification_failed`).
4. `route_evaluated` `selectedPath: 'harness'`.
5. Native transcript: first OpenAI request includes advertised `list_files`/`read_file` tools; assistant tool-call persisted; tool-result continuation sent on the next `executeWithTools`; final assistant `finishReason` completed (not canned max-loop success).
6. Tool names executed ⊆ `{list_files, read_file}`. Workspace files unchanged (no write/delete).
7. Audit ordered on the same `executionId`: route → loop_started → model_invocation (tool_calls) → tool_dispatch → model_invocation (completed) → loop_completed.
8. Ledger `completed`; `notifyExecutionComplete` → `triggerDeductionForExecution` → exactly one `applyDeduction` with `sourceEventId=executionId` and `unitCount=cumulative tokensUsed`. Duplicate finalize remains idempotent at `sourceEventId`.
9. Final metadata preserves `executionId`, `agentId`, `userId`, `apiKeyId`, `harnessVersion`.
10. Flags restored; secrets absent from evidence; frontend untouched.

**FAIL:** stub provider counted as real; unsigned/direct-queue job counted as Gateway proof; mutation tool; xAI used as positive; retries; 4th provider call; deduction on failure; second deduction; prompt/persona/secret/signature in evidence; leftover **canary-owned** runtime processes or unrestored staging flags/gates. Do not fail the canary for leaving pre-existing Lightsail services running.

---

## 9. xAI negative-canary contract (FROZEN)

**Owner child:** AGENT-PLATFORM-EXEC-01C6A (proposed). Prefer **zero provider-live activity**.

**Ingress:** Gateway HTTP execute with entitled identity, `conversation` + `agentId` + `harnessVersion: 'v1'`, provider `xai`, model `grok-4.5`.

**Adapter construction:** `getAdapter('xai')` requires a non-empty `XAI_API_KEY` **before** routing inspects `supportsToolUse`. Freeze a **process-scoped dummy non-secret placeholder** sufficient only to construct `XAIAdapter`. Constructor must not HTTP. If missing key causes a different failure than `HarnessRoutingError` / `adapter_lacks_tool_use`, that is FAIL (wrong failure). Do not use a real xAI credential.

**PASS assertions:**

1. Gateway accepts and enqueues (202) with a valid HMAC proof (kill switch `PROVIDER_XAI_ENABLED` must not be `false` for this negative path).
2. Worker verifies proof, then `resolveHarnessRouting` `fail_closed` / `adapter_lacks_tool_use` (xAI has no `supportsToolUse`).
3. `HarnessRoutingError` thrown; ledger `execution_status=failed`.
4. `XAIAdapter.execute` / `executeWithTools` call count = 0. No HTTP to `api.x.ai`.
5. Harness loop not entered (no `harness.loop_started`; no tool dispatch).
6. `notifyExecutionComplete` not called; `triggerDeductionForExecution` either not invoked or returns `status_failed` with **zero** `applyDeduction`.
7. Provider-live call count = 0.
8. Evidence contains no secret, signature, proof, prompt, or persona.

This canary runs on AWS Lightsail staging Gateway/worker/Redis/Postgres. It is **not** PROVIDER-LIVE. Zero outbound xAI HTTP remains required. Dummy `XAI_API_KEY` must not be a real credential and must not be committed.

---

## 10. Accounting and credit contract (FROZEN)

Existing flow (unchanged production code):

```
worker completed (not failed/timeout/cancel)
  → ApiGatewayHttpClient.notifyExecutionComplete(executionId)
    → Gateway internal finalizeAccounting
      → UsageLedgerService.triggerDeductionForExecution(executionId)
        → skip unless executionStatus==='completed'
        → skip workspace_mutation (build-awaiting-apply)
        → emitDeductionAttempt
          → PersistentCreditDeductionGateway.applyDeduction
            sourceEventId = executionId
            ownerId = userId
            lineItems[0].unitCount = tokensUsed (cumulative)
            creditsRequested advisory 0; calculation service translates tokens
```

Failed / unsupported / disabled-gate / max-iteration / cancelled / timeout: `triggered: false`, no deduction (EXEC-01C5 tests).

Idempotency: `sourceEventId=executionId`. Duplicate finalize may **call** `applyDeduction` twice; persistent gateway must not double-charge.

| Evidence class | Owner | What counts |
|---|---|---|
| Mock/unit | already LOCKED in EXEC-01C5 | Not sufficient for 01C6 live AC |
| Stub live ledger event | 01C6A | One finalize for completed stub; `tokensUsed=0`; non-zero balance change is unexpected |
| Real non-production credit mutation | 01C6B only | One deduction for completed openai canary; zero for xAI negative |

Any real credit mutation requires later explicit Keith CREDIT authorization. This stage-start does not grant it.

**Usage/ledger vs credit-balance (preserved, not redefined):** ledger `execution_status` / `tokensUsed` / `sourceEventId` writes are usage-ledger evidence. Credit-balance mutation is a non-zero change to the entitled identity's credit balance via `applyDeduction`. The optional 01C6A 0-token finalize path may still invoke `PersistentCreditDeductionGateway` (CREDIT mutex / evidence-sensitive credit validation) without a non-zero balance change. Non-zero balance change on 01C6A remains FAIL unless Keith separately authorizes it. This environment correction does not add, remove, or redefine that optional accounting evidence.

**Recorded conflict (not resolved here):** 01C6A still lists CREDIT because optional stub finalize can hit `applyDeduction`, while `CREDIT_MUTATION_AUTHORIZED=NO` and 01C6A AC forbids non-zero balance change. Those statements can coexist only if 0-token `applyDeduction` is treated as credit-path validation rather than balance mutation. Whether staging `applyDeduction` with `tokensUsed=0` writes credit rows or changes balance is **unverified**. Do not silently drop CREDIT from 01C6A or convert the optional stub finalize into required balance mutation.

---

## 11. Identity, audit, and metadata evidence

Collect **identifiers and enums only**:

- `userId`, `apiKeyId` (IDs, not secrets)
- persisted `agentId`
- Gateway `executionId` (must equal audit `executionId`; **forbidden** to equal `sessionId`)
- Proof acceptance: boolean / errorCode absence (never signature, never full proof, never HMAC secret)
- `selectedPath`, `failReason`
- Provider / model names
- Tool names + callIds (not arguments/results bodies)
- Completion/failure status
- Ledger `execution_status`, `tokensUsed`, deduction `sourceEventId`, `triggered` boolean

**Prohibit in evidence files, logs copied into docs, and checkpoints:** HMAC secret, signature, full proof JSON, provider credentials, API keys, allow-list UUIDs, prompt text, persona/globalInstructions/projectInstructions, file contents, unnecessary personal data.

Audit events already omit prompt/output/arguments/full tool results (`harness-audit-events.ts` privacy comment). Preserve that.

---

## 12. Secrets and evidence-minimization rules

- No provider key, HMAC secret, API key, UUID allow-list value, or other secret may be committed or printed.
- `.env.example` already documents `HARNESS_ENTITLEMENT_HMAC_SECRET=` as a commented placeholder — **do not edit** it in these children.
- Do not modify repository `.env` files.
- Redact worker logs before saving under `docs/`.
- Dummy `XAI_API_KEY` for the negative canary must not be a real credential and must not be committed.

---

## 13. Decomposition decision

**Option A (one child):** one slice does stub evidence then, after a later authorization, provider-live evidence.

**Option B (two children):** preferred.

| | 01C6A | 01C6B |
|---|---|---|
| Authorization | STAGING (+ CREDIT if stub finalize is in AC). No PROVIDER-LIVE. No LOCAL-RUNTIME. | STAGING + PROVIDER-LIVE + CREDIT. Explicit Keith live envelope. No LOCAL-RUNTIME. |
| Mutexes | AI-SERVICE, STAGING, CREDIT. ENV only if the later live procedure mutates staging process env / execution gates (LIVE-11 analog); freeze at registration, not acquired now. | AI-SERVICE, STAGING, PROVIDER-LIVE, CREDIT. ENV same rule as 01C6A. |
| Runtime | Existing Lightsail PostgreSQL, Redis, PM2 worker, Gateway, CM/Docker for stub tools | Same plus real OpenAI |
| Rollback | Restore canary-owned flags/gates/rows/jobs/sessions; do not stop standing staging services | Same; cannot un-spend provider tokens; credit row is the authorized one-deduction |

Children have different authorization, mutex, runtime, and rollback boundaries. Splitting is required. Both execute on AWS Lightsail staging. Direct-queue stub ingress remains distinct from Gateway ingress and from execution location.

Do **not** register children in this window.

---

## 14. Proposed children (not registered)

Repo search: no canonical heading, machine stanza, sidecar candidate, or board occupancy for `AGENT-PLATFORM-EXEC-01C6A` or `AGENT-PLATFORM-EXEC-01C6B`.

### 14.1 AGENT-PLATFORM-EXEC-01C6A — Staging stub wiring and xAI-negative canary

| Field | Value |
|---|---|
| Title | Staging (AWS Lightsail) read-only Harness stub canary and xAI fail-closed canary |
| Lifecycle | 3-STEP IMPLEMENTATION |
| Depends on (human) | EXEC-01C6 Step 2 (this document, including 2026-09-07 environment correction); locked EXEC-01C3/01C4/01C5/01C5B |
| Depends on (machine, at later registration) | `["AGENT-PLATFORM-EXEC-01C3","AGENT-PLATFORM-EXEC-01C4","AGENT-PLATFORM-EXEC-01C5","AGENT-PLATFORM-EXEC-01C5B"]` |
| Mutexes | AI-SERVICE, STAGING, CREDIT. ENV only if later live procedure mutates staging process env / execution gates. **Not** LOCAL-RUNTIME. |
| Hot-files | none |
| Shared contracts | consumer `HARNESS_ENTITLEMENT_PROOF_V1` (do not mutate) |
| Evidence class | STAGING-RUNTIME (proposed; children unregistered — sidecar not edited in this window) |
| runtimeNeeds | STAGING, CREDIT (schema: `STAGING-RUNTIME` requires `STAGING` in `runtimeNeeds`; each `runtimeNeeds` id must also appear in `mutexes`) |
| Ordered write set | 1. `services/ai-service/scripts/canary-01c6a-stub-submit.ts` 2. `services/ai-service/scripts/canary-01c6a-xai-negative.ts` 3. `docs/AGENT-PLATFORM-EXEC-01C6A-CANARY-EVIDENCE.md` |
| Out of scope | production worker/adapter/Gateway/frontend; `.env` / `.env.example`; PACKAGE; existing `canary-06*` scripts; local application tests; local Docker/Postgres/Redis/dev servers; provider-live; EXEC-01C7 |
| First to register | YES — before 01C6B |

CREDIT on 01C6A exists because completed stub notify hits `PersistentCreditDeductionGateway`. Expected exposure is a 0-token deduction attempt. Keith must still authorize CREDIT before 01C6A runs if that path remains in AC; alternatively registration may drop stub accounting from 01C6A and leave all accounting to 01C6B (then omit CREDIT from 01C6A). This environment correction does **not** add, remove, or redefine that optional accounting evidence.

### 14.2 AGENT-PLATFORM-EXEC-01C6B — Authorized real-provider transcript and accounting canary

| Field | Value |
|---|---|
| Title | Authorized OpenAI native-transcript Harness canary and Ask-like accounting |
| Lifecycle | 3-STEP IMPLEMENTATION |
| Depends on (human) | EXEC-01C6A COMPLETE AND LOCKED; this Step 2 including environment correction; Keith PROVIDER-LIVE + CREDIT + STAGING authorization |
| Depends on (machine, at later registration) | `["AGENT-PLATFORM-EXEC-01C6A"]` plus locked ancestors as required by then-current sidecar rules |
| Mutexes | AI-SERVICE, STAGING, PROVIDER-LIVE, CREDIT. ENV same rule as 01C6A. **Not** LOCAL-RUNTIME. |
| Evidence class | PROVIDER-LIVE |
| runtimeNeeds | PROVIDER-LIVE, STAGING, CREDIT (schema: `PROVIDER-LIVE` evidence requires `PROVIDER-LIVE` in `runtimeNeeds`; staging execution additionally requires `STAGING` in `runtimeNeeds` and therefore in `mutexes`) |
| Ordered write set | 1. `services/ai-service/scripts/canary-01c6b-openai-positive.ts` 2. `docs/AGENT-PLATFORM-EXEC-01C6B-CANARY-EVIDENCE.md` |
| Out of scope | production adapters/worker/Gateway; catalogue expansion; Anthropic unless Keith replaces §7.2; frontend; mutation; local application tests; local runtime infrastructure; EXEC-01C7 |

Parent EXEC-01C6 remains `writePaths=[]` / `writeSetPrecision=PROVISIONAL` / `admissionUncertain=true` / sidecar `mutexes=["LOCAL-RUNTIME"]` / `evidenceClass=LOCAL-RUNTIME` / `runtimeNeeds=[]`. That parent `LOCAL-RUNTIME` mutex is **validator-required provisional metadata** (`evidenceClass=LOCAL-RUNTIME` requires `LOCAL-RUNTIME` in `mutexes`; it does **not** require `LOCAL-RUNTIME` in `runtimeNeeds`). It is **not** acquired and does **not** authorize local tests. Reclassifying the parent candidate to `STAGING-RUNTIME` would require a sidecar edit (`STAGING` in `runtimeNeeds` and `mutexes`) which this correction does **not** perform. Implementation writes belong to the children.

No focused production test files are required in these write sets. Existing unit tests already cover routing, HMAC, and mock accounting. New tests may be added later only if a child discovers a missing assertion that cannot be proven by the canary scripts; that would be an explicit write-set expansion at registration, not a silent production change. Do not introduce local application tests as a substitute for Lightsail execution.

---

## 15. Later Keith authorization decision (exact bounded terms)

This stage-start grants **no** runtime permission.

Before **any** provider-live call or non-zero credit mutation, Keith must authorize a later registration/admission (expected: EXEC-01C6B) that states all of:

```
KEITH_DECISION_REQUIRED_BEFORE_PROVIDER_LIVE=YES
PROVIDER=openai
MODEL=gpt-4o
MAX_PROVIDER_HTTP_CALLS=3
RETRY_COUNT=0
EXECUTION_TIMEOUT_MS=120000
MAX_EXPECTED_PROVIDER_COST_USD=2.00
MAX_CREDIT_DEDUCTIONS=1
MAX_CREDIT_SOURCE_EVENT_IDS=1
INGRESS=GATEWAY_HTTP_POST_/api/ai/execute
EXECUTION_INTENT=conversation
MUTATION_TOOLS=FORBIDDEN
FRONTEND_HARNESS_VERSION=FORBIDDEN
HARNESS_FLAG_DEFAULTS=UNCHANGED
```

Optional Keith replacement: Anthropic + an explicitly named current cheap model, same bounds otherwise.

Before 01C6A STAGING execution: authorize AWS Lightsail staging (`aisandbox-staging`) use of existing PostgreSQL/Redis/Gateway/worker/CM as needed, dummy xAI key rule, shared-worker flag window, canary-owned cleanup only, and CREDIT-or-not for 0-token stub finalize. Do **not** authorize local Docker/Postgres/Redis/dev servers as the canary venue.

Before 01C6A Gateway HTTP xAI negative: authorize STAGING (not PROVIDER-LIVE; not LOCAL-RUNTIME).

---

## 16. Rollback and cleanup (every exit path)

1. Restore process-scoped Harness flags, HMAC secret, `EXECUTION_TIMEOUT_MS`, `EXECUTION_PROVIDER_RETRY_ATTEMPTS`, dummy `XAI_API_KEY`, `OPENAI_API_KEY` process overrides **on the staging processes that were changed**.
2. Restore execution/runtime gates to pre-canary values (LIVE-11 analog: `GLOBAL_EXECUTION_ENABLED=false` after confirmed-safe restore). Do not leave harness flags enabled on the shared worker.
3. Remove temporary workspaces/files/sessions/containers **created for the canary**. Preserve only redacted evidence intended for the child evidence doc / later checkpoint.
4. Delete only canary-owned `usage_records` / BullMQ jobs / ledger rows identified by the canary `executionId`. Do not truncate tables. Do not erase unrelated staging records.
5. Do not retain provider responses containing sensitive content.
6. Do not modify repository `.env` files. Do not persist canary flags into `/opt/aisandbox/.env` unless a later child explicitly authorizes that ENV write and restores it.
7. Do **not** stop, delete, or kill pre-existing PM2/systemd services (`aisandbox-api-gateway`, `aisandbox-ai-service`, `aisandbox-container-manager`, `aisandbox-frontend`, PostgreSQL, Redis, Caddy, `pm2-ubuntu`). Do not `docker compose down -v`. If those services were already running before the child, leaving them running is required, not a cleanup failure.
8. Do not alter credit balances outside the explicitly authorized bounded canary.
9. Confirm working-tree expectation: only the child's frozen write set dirty; `git diff --check` clean; no SATURATION_PROOF retention.

Historical 06D/06E scripts remain untouched.

---

## 17. Authorization boundary (this window)

```
KEITH_DECISION_REQUIRED_BEFORE_PROVIDER_LIVE=YES
LOCAL-RUNTIME=UNAUTHORIZED
STAGING=UNAUTHORIZED
PROVIDER-LIVE=UNAUTHORIZED
CREDIT=UNAUTHORIZED
STAGE_START_DOES_NOT_GRANT_PERMISSION=YES
```

---

## 18. Child registration decision (this window)

**CHILD_TASKS_REGISTERED=0** (no 01C6A, 01C6B, or EXEC-01C7).

Parent candidate remains:

- `status=READY`
- `writeSetPrecision=PROVISIONAL`
- `admissionUncertain=true`
- `mutexes=["LOCAL-RUNTIME"]` (parent schema-required declaration for `evidenceClass=LOCAL-RUNTIME` only; not acquired; not a local-test lease)
- `writePaths=[]`
- not admitted
- proposed children remain unregistered; their future mutexes include STAGING, not LOCAL-RUNTIME

---

## 19. Lifecycle / control-plane end state

| Item | End state |
|---|---|
| EXEC-01C6 Step 1 | COMPLETE |
| EXEC-01C6 Step 2 | COMPLETE — this document (environment corrected 2026-09-07; future execution = AWS Lightsail staging) |
| EXEC-01C6 Step 3 / 4 | NOT AUTHORIZED |
| Implementation | NOT STARTED |
| Lanes | EMPTY / EMPTY / DISABLED |
| Governance | UNOWNED after this write |
| Runtime authorization | unchanged false |
| Harness flags | unchanged false |
| Product-visible Harness | FUTURE / gated |
| EXEC-01C7 | unregistered |
| Sidecar | unchanged |

---

## 20. Confirmation of zero implementation and activation activity

- No application source, tests, scripts, environment, sidecar, validator, or mutex-catalog changes in this window
- No Harness flag changes
- No frontend `harnessVersion`
- No specialist / unbound Builder Harness
- No mutation tools enabled
- Runtime/Docker/database/staging-connection/browser/provider-live/credit = 0
- Local application tests / local runtime infrastructure introduced = 0
- Git commit/push = NO
- No child task registered
- No lane occupied
- No implementation mutex acquired
