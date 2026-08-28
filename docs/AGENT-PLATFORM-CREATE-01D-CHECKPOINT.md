# AGENT-PLATFORM-CREATE-01D — Final Checkpoint

**Task ID:** AGENT-PLATFORM-CREATE-01D
**Title:** Bind Persisted User-Agent Identity into Existing Single-Shot Ask
**Step:** 4 — Independent Verification / Checkpoint / Final Lock
**Date:** 2026-08-28
**Verdict:** COMPLETE AND LOCKED — PASS
**Checkpoint HEAD (Step 3 implementation):** `9ad98006593117caf05d7885e77ee095c0a9cd60`

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | AGENT-PLATFORM-CREATE-01D |
| Family | AGENT PLATFORM / CREATE (successor after 01A/01B/01C COMPLETE AND LOCKED) |
| Lane | Lane 1 |
| Lifecycle | 4-step |
| Evidence class | LOCAL-TESTS |

---

## 2. Step lifecycle record

| Step | Status | HEAD | Date |
|---|---|---|---|
| Step 1 — Registration | COMPLETE | `f2a77410c2295a5b7364644f802b8c56b7489f41` | 2026-08-28 |
| Step 2 — Stage-start / contract freeze | COMPLETE | `f77cc9b6502898ef8843089c6e303a3a95b1b2ec` | 2026-08-28 |
| Step 3 — Implementation + validation | COMPLETE | `9ad98006593117caf05d7885e77ee095c0a9cd60` (base was `38c7f1d0a5f50d3b4df9fa5dd911a759a1a0853d`) | 2026-08-28 |
| Step 4 — Independent verification / checkpoint / lock | COMPLETE | (this document; no production source changes) | 2026-08-28 |

Step 2 stage-start document: `docs/AGENT-PLATFORM-CREATE-01D-STAGE-START.md`

---

## 3. Step 4 base preconditions (verified)

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `9ad98006593117caf05d7885e77ee095c0a9cd60` |
| Tree | CLEAN (`git status --short` empty) |
| Recent log | `9ad9800 bind persisted user-agent Ask identity on Gateway execute` |
| AGENT-PLATFORM-CREATE-01D | ACTIVE — Step 3 COMPLETE — Step 4 PENDING ✅ |
| Lane 1 | ACTIVE with AGENT-PLATFORM-CREATE-01D ✅ |
| Lane 2 | EMPTY ✅ |
| Lane 3 | DISABLED ✅ |
| GATEWAY | OWNED by AGENT-PLATFORM-CREATE-01D ✅ |
| GOVERNANCE | UNOWNED at Step 4 start ✅ |

---

## 4. Step 3 write-set verification

Committed Step 3 files (`git show --name-only HEAD`):

| File | Role |
|---|---|
| `services/api-gateway/src/clients/ai-service-http.client.ts` | MUST-WRITE — additive optional `agentId?: string` on `AIExecutionRequest` |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | MUST-WRITE — Ask-only validation, owner lookup, identity-block composition, metadata agentId, fail-closed |
| `services/api-gateway/src/ai/ai.module.ts` | MUST-WRITE — `imports: [UserAgentModule]` |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | MUST-WRITE — new AGENT-PLATFORM-CREATE-01D describe block (61 tests total) |
| `TASKS.md` | Governance mirror (Step 3 end-state) |
| `TASKS_BACKLOG_FULL.md` | Governance mirror (Step 3 end-state) |

**WRITE_SET_EXPANSION = NO**

MAY-WRITE files written: **0** (no unexpected fixture repairs needed)

Confirmed zero changes to:
- AI-SERVICE (`services/ai-service/**`) — count: 0
- frontend (`frontend/**`) — count: 0
- i18n (message files) — count: 0
- user-agent service/entity (read-only, reused) — count: 0
- queue service — count: 0
- usage-ledger source — count: 0
- auth source — count: 0
- sessions — count: 0
- migrations — count: 0
- package/dependency files — count: 0
- env / compose / PRD / ARCHITECTURE — count: 0

---

## 5. agentId request-contract verification

- `ai-service-http.client.ts` `AIExecutionRequest` adds `agentId?: string` at end of interface ✅
- Field has its own JSDoc comment distinguishing it from `agentRole` (harness/system role) and `builderProfileId` (Builder catalog id) ✅
- `POST /api/v1/ai/execute` (`PublicAIController`) is NOT modified ✅
- Persisted user-agent identity is NOT loaded into `agentRole` or `builderProfileId` ✅

---

## 6. Input validation verification

Implementation in `resolvePersistedUserAgentForAsk` private method:

| Case | Behavior | Before lookup? |
|---|---|---|
| `agentId === undefined` | Return `undefined`; skip entire block | N/A |
| Non-string `agentId` | HTTP 400 `agentId must be a non-empty string when provided` | Yes — no lookup |
| Empty string `agentId` | HTTP 400 (same message, trim check) | Yes — no lookup |
| Whitespace-only `agentId` | HTTP 400 (trim → 0 len) | Yes — no lookup |
| `agentId` + `executionIntent !== 'conversation'` | HTTP 400 `agentId is only supported when executionIntent is 'conversation'` | Yes — no lookup |
| `agentId` + default omitted intent (workspace_mutation) | HTTP 400 (same) | Yes — no lookup |
| `agentId` + `harnessVersion` present | HTTP 400 `agentId is not supported when harnessVersion is provided` | Yes — no lookup |

All 400 rejections occur **before** any owner lookup, ledger write, or enqueue ✅

---

## 7. Authentication / ownership verification

| Check | Evidence |
|---|---|
| User identity source | `@AuthenticatedUser()` → `identity.userId` (line 519 of controller) |
| Untrusted `request.userId` not used | Controller discards request.userId for authorization; uses `identity.userId` |
| Owner-scoped lookup | `this.userAgentService.findOneByIdAndUserId(agentId, identity.userId)` |
| Lookup position (before ledger/enqueue) | Owner lookup at controller line 517 (via `resolvePersistedUserAgentForAsk`); ledger write starts at line 583 |
| Lookup position (after session ownership) | Session ownership check at lines 509–514; `resolvePersistedUserAgentForAsk` at line 517 |

Critical invariant satisfied: No unauthorized persisted agent identity can reach the execution queue ✅

---

## 8. Failure privacy verification

All three cases (nonexistent, cross-user, soft-deleted) → `findOneByIdAndUserId` returns `null` → `throw new NotFoundException()` → HTTP 404, Nest default `"Not Found"`.

| Case | HTTP | Existence leaked? | Enqueue? | Ledger write? |
|---|---|---|---|---|
| Nonexistent agent | 404 Not Found | No | No | No |
| Another user's agent | 404 Not Found | No (not 403) | No | No |
| Soft-deleted agent | 404 Not Found | No | No | No |

Cross-user does NOT disclose existence via HTTP 403 ✅

---

## 9. Soft-delete verification

- `findOneByIdAndUserId` uses `userAgentRepository.findOne({ where: { id, userId } })` with **no** `withDeleted` — confirmed in stage-start §6
- TypeORM `@DeleteDateColumn` default filtering automatically excludes soft-deleted rows
- No modification to `user-agent` service, entity, or module source in Step 3 ✅

---

## 10. Optional DI fail-closed verification

Constructor parameter order (lines 105–120):
1. `usageLedgerService` (required)
2. `globalSafetyLimitService` (required)
3. `queueService` (required)
4. `executionResultService` (required)
5. `executionStreamService` (required)
6. `userAiInstructionsService` (required)
7. `projectAiContextService` (required)
8. `sessionService` (required)
9. `@Optional() projectRepoDocsService?`
10. `@Optional() containerManagerHttpClient?`
11. `@Optional() userAgentService?` ← **last** `@Optional()` parameter ✅

Production wiring: `AIModule` imports `UserAgentModule` which exports `UserAgentService` ✅

| Scenario | Behavior |
|---|---|
| `agentId` absent + service unavailable | Existing Builder execution works unchanged |
| `agentId` present + service unavailable | `throw new InternalServerErrorException` — server failure, no enqueue |

No circular dependency workaround or duplicate provider introduced ✅

---

## 11. Ask-only boundary verification

| Scenario | Behavior |
|---|---|
| `executionIntent === 'conversation'` + no `harnessVersion` | Agent identity authorized |
| `executionIntent === 'workspace_mutation'` + `agentId` | HTTP 400 — rejected |
| `executionIntent` omitted (default `workspace_mutation`) + `agentId` | HTTP 400 — rejected |
| `harnessVersion` present + `agentId` | HTTP 400 — rejected before lookup |

Persisted agent identity can execute **only** `conversation`; cannot execute `workspace_mutation` / Build ✅
Harness is not activated for agent Ask executions ✅

---

## 12. Model identity context verification

Frozen identity block format (exact match to stage-start §12):
```
Active agent identity:
Name: {agent.name}
Role: {agent.role}
Description: {agent.description}
```

Injection mechanism (stage-start §13):
- Composed onto existing `globalInstructions` AFTER `normalizeGlobalInstructions` returns
- `existingGlobalInstructions` present → `{identityBlock}\n\n{existingGlobalInstructions}`
- `existingGlobalInstructions` absent → `{identityBlock}` only
- Passed as `globalInstructions` on `enqueueExecution` — reaches worker's `systemPrompt` via existing path
- Existing user/global instructions are **preserved**, not replaced ✅
- Project instructions remain unchanged ✅
- No AI-SERVICE modification required ✅
- No new BullMQ identity field created (`agentId` not on the queue payload; only on usage_records.metadata) ✅

---

## 13. Trace metadata verification

| Path | `agentId` in metadata? |
|---|---|
| New intent write (`writeExecutionIntent`, no requestId) | `...(persistedUserAgent !== undefined && { agentId: persistedUserAgent.id })` ✅ |
| New intent write (`writeExecutionIntent`, with requestId) | `...(persistedUserAgent !== undefined && { agentId: persistedUserAgent.id })` ✅ |
| Reuse intent (`reuseExecutionIntent`) | `...(persistedUserAgent !== undefined && { agentId: persistedUserAgent.id })` ✅ |

The persisted `agent.id` (UUID) is recorded as `usage_records.metadata.agentId` ✅

No DB column added ✅
No migration ✅
No billing-domain `agentId` semantics changed ✅
No credit deduction identity behavior changed ✅

---

## 14. Backward compatibility verification

| Scenario | Verified behavior |
|---|---|
| Builder Ask without `agentId` | Unchanged — `resolvePersistedUserAgentForAsk` returns `undefined`; `queuedGlobalInstructions = globalInstructions` |
| Builder Build without `agentId` | Unchanged — no lookup, no agent block |
| provider/model handling | Unchanged at `resolveProviderAndModel` |
| global/project instructions without `agentId` | Unchanged |
| `executionIntent` defaulting | Unchanged — `DEFAULT_EXECUTION_INTENT = 'workspace_mutation'` |
| `agentRole` | Unchanged — forwarded to queue and ledger |
| `builderProfileId` | Unchanged — forwarded to queue and ledger |
| `collaborationRunId` | Unchanged — forwarded to queue and ledger |
| `referralTraceId` | Unchanged — forwarded to queue and ledger |
| accounting / credit behavior | Unchanged |
| Harness gating | Unchanged — entitlement check at lines 489–498 unmodified |

---

## 15. Strict non-scope verification

The following were confirmed absent from the committed implementation:

Run Agent UI / frontend agent execution UI / Delete UI / specialist execution / Chief of Staff / Product Strategy / Technology Advisor / Legal Advisor / knowledge / tools / skills / collaboration / referrals / work objects / Multi-Builder / Harness activation or default / `search_workspace` / automatic rollback / OAuth / Stripe / invitations / RPG / Lane 3 / migration / dependency/package changes

All confirmed: **zero implementation of any non-scope item** ✅

---

## 16. Test coverage verification (all 17 required cases)

New `describe('AIExecutionController — persisted user-agent Ask identity (AGENT-PLATFORM-CREATE-01D)')`:

| # | Required case | Test |
|---|---|---|
| 1 | owner Ask succeeds | test 1 ✅ |
| 2 | identity block propagated | test 1 — `payload.globalInstructions` exact match ✅ |
| 3 | metadata agentId propagated | test 1 — `intentDto.metadata?.agentId` ✅ |
| 4 | missing agent = 404 | test 2 ✅ |
| 5 | cross-user = 404 | test 3 — authenticated userId used, not request.userId ✅ |
| 6 | soft-deleted = 404 | test 4 ✅ |
| 7 | no-id Ask unchanged | test 5 ✅ |
| 8 | no-id Build unchanged | test 6 ✅ |
| 9 | id + Build = 400 | test 7 ✅ |
| 10 | id + Harness = 400 | test 8 ✅ |
| 11 | empty id = 400 | test 9 ✅ |
| 12 | whitespace id = 400 | test 9 ✅ |
| 13 | non-string id = 400 | test 9 ✅ |
| 14 | optional service missing + id = fail closed (500) | test 11a ✅ |
| 15 | optional service missing + no id = Builder path intact | test 11b ✅ |
| 16 | existing accounting behavior | test 10 (AGENT-PLATFORM-06 fields unchanged) ✅ |
| 17 | existing identity fields unaffected | test 10 (agentRole/builderProfileId not overwritten) ✅ |

Additional test: reuse path stores `agentId` in metadata ✅

All existing describes (AGENT-PLATFORM-06, BUILDER-INTENT-01, 05B9, 05C2, 05C5, 05C7, provider/model) retained as regression ✅

---

## 17. Independent test execution results

### Test 1 — Targeted controller spec

```
npx jest --runInBand src/ai/ai-execution.controller.spec.ts
```

**PASS** — 1 suite / 61 tests

### Test 2 — User-agent regression

```
npx jest --runInBand --testPathPatterns=user-agent
```

**PASS** — 2 suites / 46 tests

### Test 3 — Broad non-live Gateway suite

```
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

**PASS** — 167 passed / 1 skipped suites; 2128 passed / 6 skipped tests  
Exactly matches Step 3 evidence ✅

### Test 4 — Gateway build

```
npm run build
```

**PASS** — TypeScript exit 0, no errors ✅

---

## 18. Security escape tests

### CROSS_USER_AGENT_EXECUTION_BLOCKED

**Scenario:** User A (authenticated) sends `POST /api/ai/execute` with `executionIntent = conversation` and `agentId = User B's agent UUID`.

**Forced path:**
1. `@AuthenticatedUser()` → `identity.userId = User A's UUID`
2. Session ownership: User A owns their session — passes
3. `resolvePersistedUserAgentForAsk(request, UserAId, 'conversation')`
4. `agentId` is non-empty string → valid format
5. `executionIntent === 'conversation'`, `harnessVersion` absent
6. `findOneByIdAndUserId(UserBAgentUUID, UserAId)` — query is `WHERE id = UserBUUID AND userId = UserAId`
7. Returns `null` (User B's agent is not owned by User A)
8. `throw new NotFoundException()` — HTTP 404 "Not Found"
9. No ledger write, no enqueue, no provider call

**CROSS_USER_AGENT_EXECUTION_BLOCKED = YES** ✅

### USER_AGENT_BUILD_ESCAPE_BLOCKED

**Scenario:** `agentId` supplied, `executionIntent` omitted.

**Forced path:**
1. `normalizeExecutionIntent(undefined)` → `'workspace_mutation'` (default)
2. `resolvePersistedUserAgentForAsk(request, userId, 'workspace_mutation')`
3. `executionIntent !== 'conversation'` → true
4. `throw new BadRequestException("agentId is only supported when executionIntent is 'conversation'")`
5. No owner lookup, no ledger write, no enqueue

**USER_AGENT_BUILD_ESCAPE_BLOCKED = YES** ✅

### USER_AGENT_HARNESS_ESCAPE_BLOCKED

**Scenario:** `agentId` supplied, `executionIntent = conversation`, `harnessVersion = v1`.

**Forced path:**
1. `harnessVersion = 'v1'` passes allow-list check
2. User is `harnessEntitled: true` — passes entitlement check
3. `executionIntent = 'conversation'`
4. Session ownership passes
5. `resolvePersistedUserAgentForAsk(request, userId, 'conversation')`
6. `agentId` is non-empty string → valid format
7. `executionIntent === 'conversation'` — passes
8. `request.harnessVersion !== undefined` — true
9. `throw new BadRequestException('agentId is not supported when harnessVersion is provided')`
10. No owner lookup, no ledger write, no enqueue

**USER_AGENT_HARNESS_ESCAPE_BLOCKED = YES** ✅

---

## 19. Migration count

**Migration files added: 0**

No new DB columns. `usage_records.metadata` (existing JSONB) used for `agentId` trace. `user_agents.id` already exists. ✅

---

## 20. AI-SERVICE change count

**AI-SERVICE source files changed: 0**

Identity reaches the model because Gateway already sends `globalInstructions` and the worker already concatenates that field into `systemPrompt`. No changes needed to:
- `services/ai-service/src/queue/job.types.ts`
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/ai-execution/types.ts`
- harness / builder-profile files

✅

---

## 21. Frontend / i18n change count

**Frontend source files changed: 0**
**i18n message file keys changed: 0**

This slice adds no UI. No `frontend/**` changes. ✅

---

## 22. Invitation invariant

`PRIVATE-BETA-INVITE-01` remains **PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED**.

`INVITATION_EXECUTION_PERMITTED = NO` — unchanged ✅

---

## 23. Lane 3 invariant

Lane 3 remains **DISABLED**.

`GOV-PARALLEL-01 LANE3_DECISION = KEEP_DISABLED_UNTIL_FUTURE_MATERIAL_NEED` — unchanged ✅

---

## 24. Step 4 activity ledger

LIVE=0, SSH=0, staging=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, product implementation=0, frontend implementation=0, backend implementation=0, production source changes=0, AI-SERVICE=0, frontend/i18n=0, migrations=0, dependencies=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, Git mutations=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, UI=0.

Step 4 writes: this checkpoint document, `TASKS.md` board final lock fields, `TASKS_BACKLOG_FULL.md` registry final lock body.

---

## 25. Final git checks

```
git diff --check     → (empty, no whitespace errors)
git diff --name-only → (empty before Step 4 writes)
git status --short   → (empty tree before Step 4 writes)
```

Step 4 expected dirt only:
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/AGENT-PLATFORM-CREATE-01D-CHECKPOINT.md` (this file)

---

## 26. Final verdict

**AGENT-PLATFORM-CREATE-01D COMPLETE AND LOCKED — PASS — 2026-08-28**

All verifications passed:

| Verification | Result |
|---|---|
| Precondition (branch=main, tree=clean) | PASS |
| Step 3 write-set (4 MUST-WRITE + 2 governance = 6 files, no expansion) | PASS |
| agentId request-contract (optional, distinct from agentRole/builderProfileId) | PASS |
| Input validation (absent/empty/whitespace/non-string/Build/Harness) | PASS |
| Authentication/ownership (identity.userId, not request.userId) | PASS |
| Auth position (after session ownership, before ledger/enqueue) | PASS |
| Failure privacy (all cases → 404 Not Found, never 403) | PASS |
| Soft-delete filtering (no withDeleted, TypeORM default) | PASS |
| Optional DI fail-closed (last @Optional param, fail-closed when id present) | PASS |
| Ask-only boundary (workspace_mutation/Build/Harness all rejected) | PASS |
| Model identity context (frozen block, onto globalInstructions, no AI-SERVICE change) | PASS |
| Trace metadata (agentId in usage_records.metadata, new and reuse paths) | PASS |
| Backward compatibility (all 11 dimensions) | PASS |
| Strict non-scope (all 30+ non-scope items: zero implementation) | PASS |
| CROSS_USER_AGENT_EXECUTION_BLOCKED | YES |
| USER_AGENT_BUILD_ESCAPE_BLOCKED | YES |
| USER_AGENT_HARNESS_ESCAPE_BLOCKED | YES |
| Targeted controller spec (61/61) | PASS |
| User-agent regression (2 suites / 46 tests) | PASS |
| Broad non-live gateway (167 suites / 2128 tests) | PASS |
| Gateway build (npm run build) | PASS |
| Migration count | 0 |
| AI-SERVICE change count | 0 |
| Frontend/i18n change count | 0 |
| Invitation invariant | UNCHANGED |
| Lane 3 invariant | DISABLED / UNCHANGED |

---

AGENT-PLATFORM-CREATE-01D COMPLETE AND LOCKED — PASS — 2026-08-28 — OWNERSHIP-SCOPED PERSISTED USER-AGENT IDENTITY CAN NOW DRIVE THE EXISTING SINGLE-SHOT ASK PATH WITHOUT CROSS-USER ACCESS, BUILD ESCAPE, HARNESS ESCAPE, AI-SERVICE CHANGES, MIGRATIONS, FRONTEND CHANGES, OR ANY EXPANSION INTO KNOWLEDGE, SKILLS, TOOLS, COLLABORATION, MULTI-BUILDER, SPECIALISTS, OR INVITATIONS
