# AGENT-PLATFORM-CREATE-01D — Stage-Start / Source-Path and Contract Freeze

**Task ID:** AGENT-PLATFORM-CREATE-01D
**Step:** 2 — Stage-Start / Source-Path and Contract Freeze
**Status:** COMPLETE (design/planning only — no implementation)
**Date:** 2026-08-28
**Nature:** Read-only source inspection + contract freeze
**Stage-start HEAD:** `f77cc9b6502898ef8843089c6e303a3a95b1b2ec` (branch `main`, clean tree verified)
**Step 1 HEAD:** `f2a77410c2295a5b7364644f802b8c56b7489f41` (registration base; later committed as `f77cc9b`)

This is design only. No application source, tests, migrations, runtime, Docker, PostgreSQL, Redis, staging, provider, credits, or browser activity.

---

## 1. Verdict

**PASS — contracts frozen for bounded GATEWAY-only Step 3.**

- Identity representation: additive optional `agentId?: string`
- Do **not** reuse `agentRole` or `builderProfileId`
- Authorization: Gateway `UserAgentService.findOneByIdAndUserId(id, authenticatedUserId)` **before** ledger write / enqueue
- Ask-only: reject `agentId` unless `executionIntent === 'conversation'` and `harnessVersion` is absent
- Model context: compose a delimited identity block onto the existing `globalInstructions` job field (worker already injects that field into `systemPrompt`)
- AI-SERVICE source changes: **not required**
- Mutex: **GATEWAY only** — `MUTEX_SCOPE_CHANGE_REQUIRED=NO`
- Migration: **NO**
- Child slices: **NO**
- `SAFE_TWO_LANE_PAIR_POSSIBLE=YES` (not admitted here)
- `IMPLEMENTATION_AUTHORIZED=NO` until Keith commits this Step 2 state
- `PROCEED_TO_STEP_3=YES` after a clean Step 2 commit

---

## 2. Precondition record

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `f77cc9b6502898ef8843089c6e303a3a95b1b2ec` |
| Tree | CLEAN (`git status --short` empty) |
| Recent log | `f77cc9b register AGENT-PLATFORM-CREATE-01D Ask identity binding` |
| Lane 1 | AGENT-PLATFORM-CREATE-01D ACTIVE |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| GATEWAY | OWNED by AGENT-PLATFORM-CREATE-01D |
| GOVERNANCE | UNOWNED at Step 2 start; acquired transiently for this write then released |
| Step 1 / 2 / 3 / 4 | COMPLETE / PENDING→COMPLETE / PENDING / PENDING |
| IMPLEMENTATION_AUTHORIZED | NO (unchanged) |

---

## 3. Files inspected (read-only)

### Scheduler / registry

| File | Method |
|---|---|
| `TASKS.md` CURRENT EXECUTION BOARD | Read — stop at LEGACY / FROZEN |
| `TASKS_BACKLOG_FULL.md` AGENT-PLATFORM-CREATE-01D body | Read |

### Gateway Ask path

| File | Method |
|---|---|
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Read — execute method, intent normalize, session ownership, enqueue |
| `services/api-gateway/src/ai/ai.module.ts` | Read |
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Read — `AIExecutionRequest` |
| `services/api-gateway/src/queue/queue.service.ts` | Read — `enqueueExecution(jobData: any)` |
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Read — `WriteExecutionIntentDto`, metadata merge, reuse path |
| `services/api-gateway/src/entities/usage-record.entity.ts` | Read — `metadata` JSONB |
| `services/api-gateway/src/auth/authenticated-user.decorator.ts` | Read |
| `services/api-gateway/src/auth/session-or-api-key.guard.ts` | Read |
| `services/api-gateway/src/auth/api-key.config.ts` | Read — `ApiKeyIdentity.userId` |
| `services/api-gateway/src/sessions/session.service.ts` | Read — `getSessionById` |
| `services/api-gateway/src/app.module.ts` | Read — `UserAgentModule` already imported at app level |
| `services/api-gateway/src/public-api/public-ai.controller.ts` | Read — second execute path; **out of scope** |

### User-agent ownership

| File | Method |
|---|---|
| `services/api-gateway/src/entities/user-agent.entity.ts` | Read — UUID PK, `userId`, `name`, `role`, `description`, `deletedAt` |
| `services/api-gateway/src/user-agent/user-agent.service.ts` | Read — `findOneByIdAndUserId` |
| `services/api-gateway/src/user-agent/user-agent.controller.ts` | Read — 404 ownership convention |
| `services/api-gateway/src/user-agent/user-agent.module.ts` | Read — already `exports: [UserAgentService]` |
| `services/api-gateway/src/user-agent/dto/create-agent.dto.ts` | Read |
| `services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts` | Read — soft-delete default filtering |
| `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts` | Read — missing / cross-user → 404 Not Found, never 403 |

### Existing identity plumbing (do not overload)

| File | Method |
|---|---|
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Read — AGENT-PLATFORM-06 + BUILDER-INTENT-01 suites |
| `services/ai-service/src/queue/job.types.ts` | Read — `AiExecutionJob` |
| `services/ai-service/src/worker/worker.processor.ts` | Read — `buildExecutionPromptParts`, identity metadata copy, harness route |
| `services/ai-service/src/ai-execution/types.ts` | Read — worker-facing `AIExecutionRequest` (already diverged from Gateway HTTP body) |
| `services/ai-service/src/agent-harness/builder-profiles/builder-profile.contracts.ts` | Read |
| `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts` | Read |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Grep — `enableToolLoop` default false |

### Frontend (minimal confirmation only)

| File | Method |
|---|---|
| `frontend/components/workspace/workspace-execution-intent.logic.ts` | Grep — Ask = `conversation`, Build = `workspace_mutation` |

No `.env`, secret, credential, or token files were opened.

---

## 4. Exact current Ask execution source path

Authenticated browser/API request:

1. `POST /api/ai/execute`
2. Guards (order on handler): `SessionOrApiKeyAuthGuard` → `AuthorizationGuard` → `ExecutionSafetyGuard` → `LaunchGuard` → `AbortGuard` → `IdempotencyGuard` → `CreditBalanceGuard` → `QuotaGuard` → `TokenQuotaGuard` → `RateLimitGuard`
3. Scope: `@RequireScope('ai:execute')`
4. `AIExecutionController.execute(@Body() request: AIExecutionRequest, @AuthenticatedUser() identity: ApiKeyIdentity)`
5. Validate `sessionId` UUID; optional `harnessVersion === 'v1'`; harness entitlement if harness present
6. `normalizeExecutionIntent` — default is **`workspace_mutation`** (Build), not Ask
7. Resolve provider/model
8. Session ownership: `sessionService.getSessionById` then `session.userId !== identity.userId` → `NotFoundException` (404, identical message for missing and mismatch)
9. Load `globalInstructions` / `projectInstructions` / repo docs
10. `usageLedgerService.writeExecutionIntent` (or reuse on timeout/failed retry)
11. `queueService.enqueueExecution` → BullMQ queue `ai-execution`, job name `execute-ai`
12. Return `202 { executionId, status: 'queued' }`
13. AI-service `WorkerProcessor` claims job, `buildExecutionPromptParts(...)`, `buildAIExecutionRequest` with `systemPrompt` + user prompt, provider adapters execute

The Gateway HTTP `AIExecutionRequest` in `ai-service-http.client.ts` is the **public execute body**. The live execution path is **async enqueue**, not `AIServiceHttpClient.execute()`. The worker builds a **different** `AIExecutionRequest` (`services/ai-service/src/ai-execution/types.ts`) that already includes `systemPrompt`.

`POST /api/v1/ai/execute` (`PublicAIController`) is a separate public-API path. **Out of scope** for this slice. Do not bind persisted user-agent identity there.

---

## 5. Authenticated userId source

`identity.userId` from `@AuthenticatedUser()`.

`SessionOrApiKeyAuthGuard` attaches `request.apiKeyIdentity`:

- Bearer API key → `ApiKeyAuthGuard` verified identity
- Session cookie `aisandbox_session` → `authService.validateSessionToken` → `{ userId: user.id, apiKeyId: 'browser-session', scopes: ['ai:execute'], isInternal: true }`

Controller already discards untrusted `request.userId` and uses `identity.userId` for ledger, queue, session ownership, and instruction lookup.

**Frozen:** owner-scoped user-agent lookup MUST use `identity.userId`, never `request.userId`.

---

## 6. User-agent owner-scoped retrieval path

Existing method, reuse only:

```ts
UserAgentService.findOneByIdAndUserId(id: string, userId: string): Promise<UserAgent | null>
```

Implementation: `userAgentRepository.findOne({ where: { id, userId } })` with **no** `withDeleted`. TypeORM `@DeleteDateColumn` therefore excludes soft-deleted rows by default.

Controller convention on `GET /api/agents/:id` and `DELETE /api/agents/:id`:

- missing → `NotFoundException()` → HTTP **404** `"Not Found"`
- another user's row → same query returns `null` → same **404** (never 403)
- already soft-deleted → same **404**

**Frozen:** execute-path authorization uses this same method and the same 404 / `"Not Found"` semantics. Do not add a second repository query. Do not return 403 for cross-user. Do not distinguish missing vs cross-user vs soft-deleted in the HTTP body.

`UserAgent.status` (`active` / `draft` / `disabled`) is **not** an extra execute gate in this slice. Soft-delete (`deleted_at`) is the rejection mechanism already required.

---

## 7. agentId vs agentRole vs builderProfileId — decision

**Frozen representation: additive optional `agentId?: string` on the Gateway execute request.**

| Field | What it actually is (source) | Equivalent to persisted `user_agents.id`? |
|---|---|---|
| `agentId` (new, this slice) | UUID primary key of a `user_agents` row owned by the authenticated user | **Yes — this is the identity** |
| `agentRole` | Optional AGENT-PLATFORM-06 / harness / orchestration **system role** (`builder`, `chief-of-staff`, `reviewer`, …). Worker uses it for harness config resolution. Non-builder values fall back to global harness default. | **No.** `UserAgent.role` is a free-text user-authored label (`varchar(200)`), not this enum. |
| `builderProfileId` | Optional catalog id of a **Builder harness profile** (`builder-default`, etc.) in `BUILDER_PROFILES_V1`. Unknown ids fall back to global default. | **No.** Persisted user-created agents are not Builder profile catalog entries. |
| credit-deduction `agentId` | Nullable billing column on `credit_deduction_records` | **No.** Different domain. Do not write it. |
| `collaborationRunId` / `referralTraceId` | Collaboration / referral trace placeholders | **No.** Out of scope. |

Do not overload `builderProfileId` merely because it already propagates. Do not put a user-agent UUID into `builderProfileId` (harness would treat it as an unknown profile). Do not put user-authored `UserAgent.role` into `agentRole` (harness would treat non-`builder` as a non-builder runtime role).

---

## 8. Rationale for the identity representation

1. `user_agents.id` is a stable UUID PK. Auditability and “which exact persisted agent was used” require that id, not a role string or Builder catalog id.
2. Ownership is `(id, userId)` plus default soft-delete filtering. Neither `agentRole` nor `builderProfileId` encodes owner.
3. Existing AGENT-PLATFORM-06 fields are already reserved for harness/orchestration. Overloading them would create a silent semantic collision and could change harness resolution.
4. Additive optional `agentId` is backward compatible: absent → current Builder path unchanged.

---

## 9. Exact authorization boundary

Location: `AIExecutionController.execute`, **after** session UUID / harnessVersion / harness entitlement / executionIntent normalize / provider-model / session ownership, **before** any `writeExecutionIntent` / `reuseExecutionIntent` / `enqueueExecution`.

When `agentId` is present (after trim):

1. Ask-only + harness-absent checks (see §10). Fail → **do not** lookup, **do not** write ledger, **do not** enqueue.
2. If `UserAgentService` is not injected: fail closed (500). Production wiring: `AIModule` imports `UserAgentModule`.
3. `const agent = await this.userAgentService.findOneByIdAndUserId(agentId, identity.userId)`
4. If `agent` is null: `throw new NotFoundException()` — HTTP 404, Nest default `"Not Found"`. No enqueue. No ledger write.
5. If found: use `agent.id`, `agent.name`, `agent.role`, `agent.description` only.

Invariant: a client-supplied persisted agent identity MUST NOT reach BullMQ / provider execution before Gateway confirms `agent.id = requested id` AND `agent.userId = identity.userId` AND the row is not soft-deleted.

---

## 10. Missing / cross-user / soft-delete failure semantics

| Case | Service result | HTTP | Enqueue | Ledger write |
|---|---|---|---|---|
| Nonexistent `agentId` | `null` | 404 `Not Found` | no | no |
| Another user's agent | `null` (query is id+userId) | 404 `Not Found` | no | no |
| Soft-deleted agent | `null` (no `withDeleted`) | 404 `Not Found` | no | no |
| Empty / whitespace `agentId` | not looked up | 400 Bad Request | no | no |
| Non-string `agentId` | not looked up | 400 Bad Request | no | no |

Match `UserAgentController.getOne` / `deleteByIdAndUserId`: **never 403** for ownership miss.

Do not add extra UUID-format 400. Invalid UUID that is still a non-empty string follows the GET convention (lookup → 404).

---

## 11. Ask-only enforcement decision

**Reject. Do not ignore. Do not silently execute user-created-agent Build.**

Source facts:

- Gateway default `executionIntent` is `'workspace_mutation'` (Build)
- Ask is explicit `'conversation'` (frontend `workspace-execution-intent.logic.ts`)
- Worker conversation path suppresses file actions; workspace_mutation requires file-action contract
- Harness is a separate job field (`harnessVersion: 'v1'`) plus env `enableToolLoop` (default false)

**Frozen Step 3 rule:**

`agentId` is accepted only when **all** are true:

1. `agentId` is a non-empty string after trim
2. normalized `executionIntent === 'conversation'`
3. `request.harnessVersion` is absent

Otherwise, if `agentId` is present:

- `executionIntent !== 'conversation'` (including omitted default `workspace_mutation`) → `BadRequestException` **400**: `agentId is only supported when executionIntent is 'conversation'`
- `harnessVersion` present → `BadRequestException` **400**: `agentId is not supported when harnessVersion is provided`

These 400s occur **before** owner lookup, ledger write, and enqueue.

Builder Ask (`conversation`, no `agentId`) and Builder Build (`workspace_mutation` or default, no `agentId`) remain unchanged.

Do not send `agentId` on the job as a way to “let the worker ignore Build.” Gateway rejects.

---

## 12. Minimum identity context

From `UserAgent`, after authorization:

| Field | Model-facing system-prompt block | usage_records.metadata |
|---|---|---|
| `id` | no | yes (`agentId`) |
| `name` | yes | no extra copy required |
| `role` | yes | no extra copy required |
| `description` | yes | no extra copy required |

Do **not** bind: knowledge, tools, skills, model config, collaboration, specialist behavior, initials, status, timestamps.

Frozen model-facing block (exact text for Step 3 tests):

```text
Active agent identity:
Name: {name}
Role: {role}
Description: {description}
```

---

## 13. Exact model-context injection point

Worker `buildExecutionPromptParts` currently builds `systemPrompt` as:

1. `FILE_ACTION_OUTPUT_CONTRACT`
2. optional `Global AI Instructions:\n{globalInstructions}`
3. optional `Project AI Instructions:\n{projectInstructions}`

User message is workspace context + `User request:\n{prompt}`.

**Frozen injection (GATEWAY only):** after owner load, prefix the identity block onto the existing `globalInstructions` string that is already queued:

- If user global instructions exist: `{identityBlock}\n\n{existingGlobalInstructions}`
- If not: `{identityBlock}` only
- Then pass that composed string as `globalInstructions` on `enqueueExecution`
- Existing `debug` log “Global AI instructions present/absent” may show present when only identity is composed; acceptable for this slice

This reaches provider `systemPrompt` without an AI-SERVICE change.

**Known limitation (accepted, not a Step 3 defect):** the worker still labels the composed string `Global AI Instructions:`. A dedicated worker block would be cleaner and is **explicitly out of scope** (would require AI-SERVICE mutex). Documented for a later slice; do not expand this write set.

Do **not** prepend identity onto the user `prompt` (wrong role). Do **not** stuff identity into `workspaceContext` (worker would ignore unknown keys). Do **not** put identity only in metadata (would not affect the model).

---

## 14. AI-SERVICE changes required?

**NO.**

Identity reaches the model because Gateway already sends `globalInstructions` and the worker already concatenates that field into `systemPrompt`. Extra BullMQ JSON keys would be ignored by the worker unless `worker.processor.ts` / `job.types.ts` changed.

Do not modify:

- `services/ai-service/src/queue/job.types.ts`
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/ai-execution/types.ts`
- harness / builder-profile files

---

## 15. Final mutex set

| Mutex | Step 3 |
|---|---|
| GATEWAY | OWNED by AGENT-PLATFORM-CREATE-01D (already admitted) |
| AI-SERVICE | UNOWNED / not required |
| FRONTEND | UNOWNED / not required |
| I18N | UNOWNED / not required |
| MIGRATION | UNOWNED / not required |
| GOVERNANCE | held only for this Step 2 write, then released UNOWNED |
| HOTFILE | none (all writes sit under GATEWAY) |
| CREDIT / PROVIDER-LIVE / STAGING / LOCAL-RUNTIME / ENV / PACKAGE / COMPOSE | UNOWNED / unauthorized |

**MUTEX_SCOPE_CHANGE_REQUIRED = NO**

---

## 16. Queue / job / usage metadata propagation contract

Only three purposes: authorization, model identity/context, traceability.

| Surface | `agentId` absent | `agentId` present and authorized Ask |
|---|---|---|
| HTTP execute body | unchanged | optional `agentId: string` |
| Owner lookup | skipped | `findOneByIdAndUserId` |
| `globalInstructions` job field | existing user/global instructions only | identity block prefixed (see §13) |
| usage_records.metadata | unchanged | add `agentId: <persisted uuid>` via existing metadata object at intent write **and** reuse path |
| BullMQ extra identity keys (`agentRole` / `builderProfileId` / collab / referral) | unchanged | unchanged — do **not** set them from the user-agent |
| New job field `agentId` | not added | **not required** (traceability lives in usage_records metadata; worker already spread-preserves existing metadata at finalization) |
| WriteExecutionIntentDto first-class fields | unchanged | **do not add** `agentId` to the DTO; put it in `metadata` |
| credit_deduction_records.agentId | untouched | untouched |
| Public API execute | untouched | untouched (field may exist on the shared type but this controller must not bind it) |

Worker finalization already does `nextMetadata = { ...existingMetadata, aiExecutionResult }`. Intent-write `agentId` therefore survives completion without an AI-SERVICE copy line.

---

## 17. Backward-compatibility rule

`agentId` absent (undefined / omitted):

- Do not call `UserAgentService`
- Do not alter `globalInstructions` composition beyond today’s user/project instruction path
- Do not add `agentId` to metadata
- Existing Builder Ask (`executionIntent: 'conversation'`) exactly unchanged
- Existing Builder Build (`workspace_mutation` or default) exactly unchanged
- Existing AGENT-PLATFORM-06 `agentRole` / `builderProfileId` / collab / referral forwarding exactly unchanged
- Credit / quota / idempotency / harness entitlement gates exactly unchanged
- Harness remains off unless the client already sent entitled `harnessVersion: 'v1'` on a **non-agentId** request (existing path)

---

## 18. Migration required?

**NO.**

- `user_agents.id` already exists (UUID PK, migration `1772500000000-CreateUserAgentsTable`)
- `usage_records.metadata` is already JSONB (`nullable: true`)
- AGENT-PLATFORM-06 already stores optional identity in that JSONB with no column add

If Step 3 is tempted to add a usage_records column or credit_deduction `agentId` write: **STOP**. That is out of contract.

---

## 19. Exact write set

### MUST WRITE (Step 3)

| File | Why |
|---|---|
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Add optional `agentId?: string` to Gateway `AIExecutionRequest` |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Ask-only validation, owner lookup, identity-block composition, metadata `agentId`, fail-closed if service missing |
| `services/api-gateway/src/ai/ai.module.ts` | `imports: [UserAgentModule]` so production DI has `UserAgentService` |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | New describe block for the frozen tests |

Constructor injection freeze: add **last** constructor parameter:

```ts
@Optional()
private readonly userAgentService?: UserAgentService,
```

Must be last. Inserting before existing `@Optional()` deps would silently shift positional `new AIExecutionController(...)` arguments in other specs. Optional last keeps those call sites compiling.

When `agentId` is present and `userAgentService` is undefined: fail closed (500). Do not skip authorization.

### MAY WRITE IF REQUIRED

| File | Only if |
|---|---|
| `services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts` | Unit spec cannot express a needed enqueue-not-called assertion |
| Other `AIExecutionController` TestingModule specs | Nest unexpectedly fails to compile without a `UserAgentService` provider despite `@Optional()` (expected: not required) |
| `services/api-gateway/src/clients/ai-service-http.client.spec.ts` | Typecheck/tests fail solely due to the new optional field (expected: not required) |

### READ ONLY

- `services/api-gateway/src/user-agent/user-agent.service.ts`
- `services/api-gateway/src/user-agent/user-agent.controller.ts`
- `services/api-gateway/src/user-agent/user-agent.module.ts`
- `services/api-gateway/src/user-agent/dto/create-agent.dto.ts`
- `services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts`
- `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts`
- `services/api-gateway/src/entities/user-agent.entity.ts`
- `services/api-gateway/src/queue/queue.service.ts`
- `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`
- `services/api-gateway/src/entities/usage-record.entity.ts`
- `services/api-gateway/src/auth/**` (guards, decorator, identity)
- `services/api-gateway/src/sessions/session.service.ts`
- `services/api-gateway/src/app.module.ts` (`UserAgentModule` already imported at app root; AIModule import is the DI fix)
- `services/api-gateway/src/public-api/public-ai.controller.ts`
- All `services/ai-service/**`
- All `frontend/**`
- All migrations
- PRD.md / ARCHITECTURE.md / CLAUDE.md / AGENTS.md

### OUT OF SCOPE

Frontend execution UI; Run Agent; Delete UI; I18N; specialist agents; knowledge; tools; skills; collaboration; referrals; work objects; Multi-Builder; Harness activation; OAuth; Stripe; invitations; RPG; Lane 3; orchestration refactor; `search_workspace`; automatic rollback; migration; dependency / package / compose / env changes; public-API execute binding; credit-deduction `agentId`; builder-profile catalog.

---

## 20. Exact tests to add / modify

**Primary:** new `describe('AIExecutionController — persisted user-agent Ask identity (AGENT-PLATFORM-CREATE-01D)', ...)` in `ai-execution.controller.spec.ts`.

Provide a mocked `UserAgentService` in **that** describe’s TestingModule. Other existing describes may omit it (`@Optional()`).

Required cases:

1. **Owner + valid user-agent + Ask** (`executionIntent: 'conversation'`, real agent returned) → 202 queued; `findOneByIdAndUserId` called with `(agentId, identity.userId)`; enqueue `globalInstructions` contains the frozen identity block (`Name:` / `Role:` / `Description:`); `writeExecutionIntent` metadata includes `agentId`; existing `agentRole`/`builderProfileId` job keys still absent unless the request also sent them.
2. **Nonexistent** (`findOneByIdAndUserId` → `null`) → `NotFoundException` / `"Not Found"`; `enqueueExecution` not called; `writeExecutionIntent` not called.
3. **Another user’s agent** (service returns `null` when queried with the authenticated userId) → same 404; no enqueue; no ledger write; lookup called with authenticated userId, not request.userId.
4. **Soft-deleted** (service returns `null`, matching TypeORM default filter) → same 404; no enqueue; no ledger write.
5. **No `agentId` + Ask** (`executionIntent: 'conversation'`) → enqueue succeeds; `findOneByIdAndUserId` not called; `globalInstructions` unchanged vs today’s null-instructions path; metadata has no `agentId`.
6. **No `agentId` + Build** (`workspace_mutation` or omitted default) → enqueue succeeds as today; no user-agent lookup.
7. **`agentId` + Build** (`workspace_mutation` or omitted default) → 400 with frozen Ask-only message; no lookup required (or lookup not used to authorize Build); **no enqueue**; **no ledger write**.
8. **Ask credit/accounting unchanged** — success path still calls `writeExecutionIntent` once then `enqueueExecution` once; no new credit/deduction calls; existing CreditBalanceGuard remains on the handler (do not edit guard metadata tests unless they break).
9. **Harness not activated** — authorized Ask+`agentId` enqueue payload has no `harnessVersion`; `agentId` + `harnessVersion: 'v1'` → 400 frozen harness message; no enqueue.
10. **No provider-live** — all hermetic mocks; no HTTP to providers.

Also retain existing AGENT-PLATFORM-06 and BUILDER-INTENT-01 describes as regression (do not rewrite them).

Do not require new user-agent.service.spec cases: soft-delete filtering without `withDeleted` is already proven.

---

## 21. Exact validation commands (Step 3)

Hermetic / non-live. No Docker, PostgreSQL, Redis, staging, or provider.

Targeted:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand src/ai/ai-execution.controller.spec.ts
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand --testPathPattern=user-agent
```

Broad non-live Gateway Jest (GATEWAY-TEST-FIXTURE-01/02 pattern; only `smoke.integration.spec.ts` excluded):

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

Gateway build/typecheck:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

Evidence class: **LOCAL-TESTS**.

---

## 22. Child slices?

**NO.** The frozen write set is four MUST-WRITE files plus optional test-fixture repairs. Source inspection does not require splitting.

---

## 23. SAFE_TWO_LANE_PAIR_POSSIBLE

**YES** — not registered, not admitted in this step.

A later independent frontend-only Delete UI could use FRONTEND + I18N:

- Mutex overlap with this slice: none (GATEWAY vs FRONTEND+I18N)
- File overlap with frozen write set: none
- Shared architectural dependency: Delete UI would call the already-LOCKED CREATE-01C `DELETE /api/agents/:id`; it does not depend on Ask identity binding
- Create Agent surface coupling: this slice does not write frontend Create Agent files

Do not manufacture or admit Lane 2 here.

---

## 24. CURRENT / FUTURE boundary (preserved)

CURRENT:

- `user_agents` persistence/API, ownership, soft delete
- Builder single-shot Ask/Build
- Optional `agentRole` / `builderProfileId` plumbing (frontend does not send them)
- Harness gated/off

This slice adds only: Gateway-authorized optional persisted `agentId` on **Ask**, identity context in system prompt via existing `globalInstructions`, metadata trace id.

NOT CURRENT / not claimed:

- executable user-created-agent product
- specialist execution, knowledge runtime, collaboration, tools/skills
- Multi-Builder
- frontend Run Agent / execution UI
- Harness on
- PRD “user-created agents are executable” promotion (remains APPROVED FUTURE until a later consolidation)

---

## 25. Step 3 implementation notes (non-source)

Suggested controller order after session ownership:

1. Normalize/validate `agentId` (absent → skip entire block)
2. Ask-only + no-harness 400s
3. Fail-closed if service missing
4. `findOneByIdAndUserId` → 404 or agent
5. Compose identity block onto `globalInstructions` **after** `normalizeGlobalInstructions(...)` returns
6. Include `agentId: agent.id` in intent metadata (new and reuse branches)
7. Enqueue composed `globalInstructions`

Do not set `request.agentRole = agent.role`. Do not set `request.builderProfileId = agent.id`.

---

## 26. Step 2 activity ledger

LIVE=0, SSH=0, staging=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, product implementation=0, frontend implementation=0, backend implementation=0, source changes=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, Git mutations=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, UI=0.

Governance writes only: this document, `TASKS.md` board fields, `TASKS_BACKLOG_FULL.md` registry body.
