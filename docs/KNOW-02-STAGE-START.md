# KNOW-02 — Stage-start

## 1. Scope and non-goals

KNOW-02 adds two read-only Harness tools, `search_knowledge` and `read_knowledge`, an optional signed job field `knowledgeScopes`, and internal gateway routes the tools call. The field is part of frozen contract `HARNESS_ENTITLEMENT_PROOF_V1`. Lane 1 holds AI-SERVICE and GATEWAY; Lane 2 stays empty. Lifecycle is 4-step. Evidence class is LOCAL-TESTS. No new dependency, no migration, no frontend, no i18n, and no Docker, PostgreSQL, Redis, or servers.

Write set: `services/ai-service/src/agent-harness/tools/`, `services/ai-service/src/worker/`, `services/ai-service/src/queue/job.types.ts`, `services/ai-service/src/clients/`, `services/api-gateway/src/knowledge/`, `services/api-gateway/src/orchestration/` (the job field only), `docs/KNOW-02-STAGE-START.md`.

One file outside that set is required for the tools to be advertised. Decision 1.

Non-goals: proof wire format and version; `ai-execution.controller.ts` (Decision 3); `app.module.ts`; the internal-key guard; `public-ai.controller.ts`; entities and migrations; `collaboration.controller.ts`, `collaboration-team.ts`, citations, and the Team page; Chief of Staff, the team picker, and office desks (BIZ-01 and later); summaries (KNOW-04); charging; prompt text.

Orchestration edits are the job-field helper and the one spread in `startReferralExecution`, plus tests of that payload. The login start route, citations, and the team constant stay as they are.

## 2. Current state

| Fact | Citation |
|---|---|
| Contract `HARNESS_ENTITLEMENT_PROOF_V1` is FROZEN. Paths: `ai-execution.controller.ts`, `job.types.ts`, `worker.processor.ts` | `docs/control-plane/lane-saturation-state.json:4052-4061` |
| KNOW-02 is Lane 1 and lists that contract in `mutatesSharedContractIds`. Lane 2 is empty | sidecar `:9-41` |
| `AiExecutionJob` has no `knowledgeScopes`. `harnessToolProfile` is optional and required on v1 by the worker. The proof object is `version: 1` plus binding fields, `payloadDigest`, and `signature` | `services/ai-service/src/queue/job.types.ts:34-43, 74-82, 107` |
| Digest copies every job key except `harnessEntitlementProof`, then canonicalises and SHA-256s | `services/ai-service/src/worker/worker.processor.ts:233-242, 245-269` |
| The same copy-all-keys digest exists on the gateway. Claim string and `version: 1` have no payload-field list | `services/api-gateway/src/ai/ai-execution.controller.ts:79-109, 112-119, 138-164` |
| A v1 proof is checked before the profile. `harnessVersion !== 'v1'` returns without a proof check. A changed key fails `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH` | `worker.processor.ts:345-349, 386-417, 1616-1647` |
| v1 without a profile is stored as `harness_tool_profile_missing`. A profile on a non-v1 job is `harness_tool_profile_invalid`. Allowed profiles: `read`, `review`, `write`, `agent-write` | `worker.processor.ts:549-599, 1648-1660` |
| The worker registers `read_file`, `list_files`, and `search_workspace` for every harness job, then write, validation, and browser tools by profile | `worker.processor.ts:1804-1837, 1838-1931` |
| Advertisement keeps a tool only when it is implemented, enabled, has a registered handler, is in `HARNESS_ADVERTISABLE_TOOL_IDS`, and passes the runtime gate. The id list is `list_files`, `read_file`, `write_file`, `delete_file`, `run_validation`, `search_workspace`. The default gate returns false. `browser_smoke` is registered for `agent-write` and is still not advertised | `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts:15-22, 43-65, 68-92`; `worker.processor.spec.ts` test "does not let resolved builder configuration bypass the global gate or advertise browser_smoke" |
| `search_workspace` input is `{ query: string }` with `additionalProperties: false`. Description promises up to 20 matches, a preview, and `truncated` | `services/ai-service/src/agent-harness/tools/tool-registry.ts:297-327` |
| The handler rejects a missing, non-string, or blank query, then returns `{ query, results, truncated }` from the client | `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.ts:202-221` |
| Workspace search caps are 20 matches, query length 120, preview 240. The query rejects control characters. `%` is not a regex | `services/container-manager/src/docker/docker-runtime.service.ts:13-16, 1028-1045, 1102-1107, 1186-1194` |
| Progress target for `search_workspace` is `query`, sliced at 200 characters | `services/ai-service/src/agent-harness/tools/tool-progress.ts:4-13, 21-37` |
| The dispatcher turns a JSON result over `maxToolResultBytes` into `RESULT_TOO_LARGE`. The default cap is 262144 | `services/ai-service/src/agent-harness/tools/tool-dispatcher.ts:182-198`; `services/ai-service/src/agent-harness/config/agent-harness.config.ts:72` |
| Tool ids are a closed union of eight. Enabled count in the registry spec is 6 | `tool-registry.contracts.ts:7-15`; `tool-registry.spec.ts:29, 128` |
| The client posts workspace search to `/api/internal/workspace/:sessionId/search` with `X-Internal-Service-Key` | `services/ai-service/src/clients/api-gateway-http.client.ts:201-223` |
| Gateway prefix is `api`. `InternalServiceAuthGuard` is global and requires that header on `/api/internal/` | `services/api-gateway/src/main.ts:71`; `app.module.ts:98-99`; `guards/internal-service-auth.guard.ts:10-15, 52-82` |
| Internal collaboration routes rely on that global guard and do not add a second one | `orchestration/internal-collaboration.controller.ts:43-46` |
| Login knowledge routes are `/api/knowledge/...` under `SessionOrApiKeyAuthGuard`. There is no internal knowledge controller | `knowledge/knowledge.controller.ts:56-58`; `knowledge/knowledge.module.ts:9-14` |
| `KnowledgeModule` is imported by `AppModule` and by `OrchestrationModule`, and it exports `KnowledgeService` | `app.module.ts:37, 90`; `orchestration/orchestration.module.ts:24, 37`; `knowledge.module.ts:13` |
| Documents are owner, scope, title, content, soft delete. `find` / `findOne` are owner-scoped. `findActiveOwnedByIds` also drops `deletedAt` | `entities/knowledge-document.entity.ts:20-53`; `knowledge/knowledge.service.ts:32-82` |
| The server registry has nine ids. It stores `id` and `type` only. `legal-contracts` is absent. No role-to-scope map exists | `knowledge/knowledge-scopes.ts:4-34` |
| Limits already enforced on write: 200 KB, 50 active documents, 4 MB per account | `knowledge/knowledge-content.ts:9-12` |
| Content is normalised to `\n` and trimmed on write | `knowledge-content.ts:84-86` |
| Hand-off jobs are built from named fields. `fileAccess: true` spreads `collaborationHarnessJobFields`. Lead → `read` plus `harnessReadOnly: true`. Writer → `write`. Reviewer → `review`. The payload is then signed | `collaboration-tool-profile.ts:6-9, 44-73`; `orchestration.service.ts:810-850, 2486-2521` |
| The Team page starts only `COLLABORATION_TEAM` (lead, writer, reviewer) with `fileAccess: true`. The body supplies `sessionId` and `task`. Provider, model, and team are server-owned | `collaboration-team.ts:6-30`; `collaboration.controller.ts:134, 148-185, 421` |
| The internal referral reader returns named fields and does not copy a scope list | `internal-collaboration.controller.ts:149-195` |
| Caller `harnessVersion`, `harnessReadOnly`, and `harnessEntitlementProof` are ignored. The signed payload is recomputed; flipping `harnessToolProfile` changes the digest | `internal-collaboration.controller.spec.ts:1940-1964, 1898-1932` |
| Agent-mode jobs are built in `ai-execution.controller.ts` from named fields. v1 gets `harnessToolProfile` `agent-write` or `read` from `agent_write_enabled`. The browser request type has no tool profile and no scope list | `ai-execution.controller.ts:765-774, 965-1005`; `clients/ai-service-http.client.ts:43-66` |
| The public execute route enqueues a job with no `harnessVersion` | `public-api/public-api.controller.ts:162-173` |
| Citation markers are `[source: <documentId>]` or `[source: <documentId>#<heading>]`. Heading text is everything after the first `#`. `BUSINESS_ROLE_PROFILE_IDS` is empty until BIZ-01 | `orchestration/collaboration-citations.ts:1-8, 15-16, 152-169` |
| Frontend manifests name scopes for builder, chief-of-staff, product-strategy, and technology-advisor. Those manifests are not consulted when a job is signed | `frontend/lib/agent-platform/agent-registry.ts:148-155, 172-179, 196-203, 220-227` |
| KNOW-01 stored the table, the nine-id registry, and the page. Gateway suite then: 2609 passed, 7 skipped, 14 failed, all `smoke.integration` | `docs/KNOW-01-CHECKPOINT.md:19-29` |
| ACCESS-01C made `harnessToolProfile` required on v1 and showed the digest already covers every extra key. AI-service suite then: 1098 passed, 1 skipped, 0 failed. Gateway: 2735 passed, 7 skipped, 14 `smoke.integration` failures | `docs/ACCESS-01C-CHECKPOINT.md:19-21, 28-30`; `docs/ACCESS-01C-STAGE-START.md:26-36` |
| Latest suites to compare this task with: ai-service ASK-CONTRACT-01, 45 suites, 1105 passed, 1 skipped, 0 failed. Gateway HARNESS-FIXES-01A, 2748 passed, 7 skipped, 14 failed, only `smoke.integration` | `docs/ASK-CONTRACT-01-CHECKPOINT.md:26`; `docs/HARNESS-FIXES-01A-CHECKPOINT.md:30-32` |

`OrchestrationService` must not gain a constructor dependency. Its specs construct it positionally. The scope map is a pure function imported from `knowledge-scopes.ts`. `KnowledgeModule` is already imported, and this task does not change `orchestration.module.ts`.

## 3. Contract change

**No wire-format change.** Proof `version` stays `1`. The claim string, canonicalisation, and "every key except `harnessEntitlementProof`" stay as they are. A present `knowledgeScopes` is covered because the digest hashes every remaining key (`worker.processor.ts:233-242`). A flipped list fails the existing integrity check. Golden vectors that omit the key stay valid (`worker.processor.spec.ts:2920-2932`).

| Aspect | Before | After |
|---|---|---|
| `AiExecutionJob.knowledgeScopes` | absent | optional `readonly string[]`. The gateway sets it. Absent on Agent jobs, public-API jobs, plain hand-offs, and today's Team jobs |
| Meaning when absent or `[]` on v1 | — | no knowledge tools; the job runs |
| Meaning when non-empty on v1 and profile `read` | — | both tools register, scoped to that exact list |
| Proof version | 1 | 1 |
| Worker when the field is missing | ignores unknown keys | missing is valid |
| Files under the contract id that change | — | `job.types.ts` (declaration and comment), `worker.processor.ts` (validation and registration). `ai-execution.controller.ts` stays untouched unless Decision 3 says otherwise |

Re-freeze `HARNESS_ENTITLEMENT_PROOF_V1` at LOCK. No second contract id.

### Worker validation

Run this after proof verification and after `resolveHarnessToolProfile`. A bad profile is stored first. A tampered list never reaches this function: the proof fails first.

`undefined` is the only missing value. `null` is present and invalid.

| Case | Result |
|---|---|
| Missing (`undefined`) on v1 or non-v1 | valid, scopes `[]`, tools not registered |
| `[]` on v1 | valid, tools not registered |
| `[]` or any other present value when `harnessVersion !== 'v1'` | stored `knowledge_scopes_requires_harness`: "Knowledge scopes were set without harness v1, so this step was stopped." No provider call |
| Not an array (object, string, number, boolean, `null`) | stored `knowledge_scopes_invalid`: "The knowledge scope list is not valid, so this step was stopped." |
| A non-string, blank string, duplicate, id outside the nine, or length over 9 | same `knowledge_scopes_invalid` |
| Non-empty valid list with profile `review`, `write`, `agent-write`, or `null` | stored `knowledge_scopes_profile_conflict`: "Knowledge scopes do not match the read-only profile, so this step was stopped." |
| Non-empty valid list with profile `read` | valid; register both tools |

Ids match the gateway registry exactly, case-sensitive, no trim: `company-monthly-reports`, `three-year-goals`, `strategy-docs`, `policies`, `meeting-summaries`, `codebase-context`, `contract-templates`, `market-data`, `tech-landscape` (`knowledge-scopes.ts:14-24`). The worker holds that list in a constant. A spec reads `knowledge-scopes.ts` and requires the same ids in the same order, the same way `knowledge-scopes.spec.ts:5-18, 49-63` reads the frontend registry.

Add the three codes to `knownHarnessMessages` (`worker.processor.ts:638-667`) so the stored sentence is the fixed one above. Persist with `persistStoredExecutionFailure`, then return, as the profile path does at `1648-1660`.

## 4. Gateway

### Who sets the field

Only the gateway, at enqueue, from a server-side map.

Add to `knowledge-scopes.ts`:

- `KNOWLEDGE_ROLE_SCOPES`: a `Readonly<Record<string, readonly string[]>>`, **empty**.
- `knowledgeScopesForProfile(profileId)`: return that profile's list after every id passes `findKnowledgeScope`. An unknown or duplicate id in the map throws, so a bad future edit cannot be signed.
- `knowledgeScopesJobFields(profileId)`: `{}` when the list is empty, otherwise `{ knowledgeScopes: [...] }` with the registry ids copied.

`collaboration-tool-profile.ts` re-exports the job-field helper. `startReferralExecution` spreads it in the same `fileAccess` branch as `collaborationHarnessJobFields` (`orchestration.service.ts:826-828`). `fileAccess` false means no harness and no `knowledgeScopes`. The helper result is part of the object passed to `withHarnessEntitlementProof` (`2486-2515`), so a non-empty list is signed.

The browser cannot set it.

- Login start reads `{ sessionId, task }` only (`collaboration.controller.ts:421`).
- The internal referral reader returns named fields and has no scope field (`internal-collaboration.controller.ts:165-195`).
- The enqueued object is built from named fields (`orchestration.service.ts:811-837`).
- `pendingJob` does not store the list. It is computed from the target profile when the job is signed.

### Roles after KNOW-02

| Role | Profile today | `knowledgeScopes` |
|---|---|---|
| `lead` | `read` | omitted |
| `writer` | `write` | omitted |
| `reviewer` | `review` | omitted |
| Agent mode (`read` or `agent-write`) | set in `ai-execution.controller.ts:767-774` | omitted (Decision 3) |
| Public API execution | no `harnessVersion` (`public-ai.controller.ts:162-173`) | omitted |
| `chief-of-staff`, `product-strategy`, `technology-advisor` | not targets of `COLLABORATION_TEAM` | no job |

**What this means for Keith.** After KNOW-02, uploading a document does not change Team or Agent answers. No production job carries the field, so the tools never register outside tests. KNOW-03 can still show citations if an answer contains markers; agents have no tool that reads the documents, so those markers will not come from a real read. BIZ-01 is the task that puts `chief-of-staff` on `KNOWLEDGE_ROLE_SCOPES` and starts that team. The six ids for that role are already on the frontend manifest (`agent-registry.ts:172-179`): the five `shared` scopes plus `contract-templates`. This task does not copy them onto the map.

### Internal routes

New `knowledge/internal-knowledge.controller.ts`, `@Controller('internal/knowledge')`, registered on `KnowledgeModule`. No `@UseGuards` and no `SessionOrApiKeyAuthGuard`. The global guard already covers `/api/internal/` (`internal-service-auth.guard.ts:10-15`). Do not edit the guard. Do not edit `app.module.ts`.

| Route | Body | Success |
|---|---|---|
| `POST /api/internal/knowledge/search` | `{ userId, scopes, query }` | `{ query, results, truncated }` |
| `POST /api/internal/knowledge/read` | `{ userId, scopes, documentId, heading? }` | `{ documentId, title, scopeId, heading, content, truncated }` |

`userId` and `scopes` are the job values the worker sends. The controller reads those body fields and ignores every other field. It does not read a user id from the model, a cookie, or a query string.

Checks, in order:

1. `userId` must match the UUID pattern already used for document ids (`knowledge-content.ts:43-44, 75-76`). Otherwise 400 `USER_INVALID`.
2. `scopes` must be a non-empty array of unique registry ids (`findKnowledgeScope`). Otherwise 400. Unknown id uses the existing `UNKNOWN_SCOPE` / "Unknown knowledge scope." Malformed or empty list uses new `SCOPES_INVALID` / "The knowledge scope list is not valid."
3. Search `query`: same rules as workspace search. Required non-empty string, no `[\u0000-\u001f\u007f]`, length at most 120 after trim and collapsing whitespace. 400 `QUERY_REQUIRED`, `QUERY_UNSUPPORTED`, or `QUERY_TOO_LONG`.
4. Read `documentId` must be a document UUID. Otherwise 404 with the existing `knowledgeNotFound()` body (`knowledge-content.ts:66-72`). A bad id, another owner, another scope, a soft-deleted row, and a missing heading all use that same 404. The 404 body has no `content`.

Query: `find` where `userId` and `scopeId In(scopes)`, order `updatedAt DESC`, no `withDeleted`. Then keep rows whose `deletedAt == null`, `userId` matches, and `scopeId` is in the request list, copying `findActiveOwnedByIds` (`knowledge.service.ts:74-81`). An empty scope list returns no rows and does not call `In([])`.

Search hits are computed in process from those rows (at most 50 documents, 4 MB). The query is a case-insensitive substring. `%` and `_` are literal. One hit per document, not per line. Cap 20. `truncated` is true when a 21st document matches. Order is `updatedAt DESC`, then `id`.

Hit shape: `{ documentId, title, scopeId, heading, preview }`. No `content`.

- A content match uses the first matching line. `preview` is that line, tabs turned into spaces, trimmed, cut at 240 characters with `...` when longer. `heading` is the text of the nearest preceding ATX heading, or `null`.
- A title-only match uses the title as `preview` and `heading: null`.
- ATX heading: a line `^(#{1,6})[ \t]+(.*)$` with non-empty text. The returned heading is that text, without the hashes.

Read loads one owned, in-scope, active document. With no `heading`, `content` is the whole document and `heading` is `null`. With a `heading`, trim it; if it begins with one ATX marker, strip that marker once (a later `#` stays, matching `collaboration-citations.ts:157-169`); compare case-insensitively to heading text. The section runs from that line through the line before the next heading of equal or higher rank (fewer or equal hashes). The heading line is included. The first match wins. The gateway returns the full section and `truncated: false`. The worker applies the byte cap.

`truncated` on the gateway read response stays false. The worker may set it true when it slices.

### Client

`ApiGatewayHttpClient` gains `searchKnowledge` and `readKnowledge`. Each `POST`s the body above to `/api/internal/knowledge/search` or `/read` with `X-Internal-Service-Key` and the abort signal, the same shape as `searchWorkspace` (`api-gateway-http.client.ts:201-223`). Failures throw. The handlers catch and throw a fixed sentence ("Knowledge document not found." or "Knowledge search failed.") so a gateway body is not passed through as tool text.

## 5. Worker and tools

### Which profiles get the tools

**`read` only, and only when the signed list is non-empty.** `review`, `write`, and `agent-write` do not get them. A non-empty list on those profiles is the stored conflict in section 3. Lead is `read` (`collaboration-tool-profile.ts:44-53`) and still gets nothing, because the map is empty.

Register beside `search_workspace` (`worker.processor.ts:1827-1837`), closed over `job.data.userId`, the validated scope list, and `resolvedConfig.maxToolResultBytes`. The handler reads `query`, `documentId`, and `heading` from the tool args. It does not read `userId` or `scopes` from the args.

### Definitions

Add both ids to `AgentHarnessToolIdV1` (`tool-registry.contracts.ts:7-15`). Keep category `search`. `allowedScopes: ['session']` (existing union, `tool-registry.contracts.ts:37-41`). `enabled: true`, `implementationStatus: 'implemented'`, `requiresApproval: false`, `riskLevel: 'low'`, `additionalProperties: false`. Timeout and byte metadata match `search_workspace`. No `outputSchema`. Registry spec counts become 10 definitions and 8 enabled.

`search_knowledge` input: required `query` string only. Description: plain-text case-insensitive search of the owner's documents in the signed scopes; up to 20 hits with document id, title, scope, heading, and a preview; `truncated` when more documents match.

`read_knowledge` input: required `documentId` string, optional `heading` string. Description: read one owned document, or the section under one heading. The result can be truncated to the tool byte cap.

Handlers reject a blank `query` or blank `documentId` before HTTP, as `createSearchWorkspaceHandler` does (`file-tool-handlers.ts:206-208`).

Returned search object: `{ query, results, truncated }` with the hit fields from section 4. Returned read object: `{ documentId, title, scopeId, heading, content, truncated }`.

### Byte cap

Search stays inside the cap by the 20-hit and 240-character preview limits. Read: the handler builds the JSON object and, while its UTF-8 length exceeds `maxToolResultBytes`, slices `content` on a UTF-8 boundary and sets `truncated: true`. A 200 KB document plus a small envelope can pass 262144 (`agent-harness.config.ts:72`, `knowledge-content.ts:9`), so the slice is required for a normal document. The dispatcher cap (`tool-dispatcher.ts:182-198`) stays as the backstop. The handler receives the cap from the worker; the gateway does not know it.

### Progress

`tool-progress.ts` `TARGET_FIELDS`: `search_knowledge` → `query`, `read_knowledge` → `documentId`. The existing 200-character slice applies.

### Advertisement

`selectAdvertisedAgentHarnessTools` will drop the new ids until they are added to `HARNESS_ADVERTISABLE_TOOL_IDS` and `passesFirstSliceRuntimeGate` returns true for them, the same branch as `search_workspace` (`adapter-tool-use.mapper.ts:52-54, 89-91`). That file and its spec are Decision 1. The worker does not append tools the selector rejected. `browser_smoke` stays off the list.

`tool-registration-gates.spec.ts` expects an advertised list that omits `search_workspace` because that test never registers it. It stays green if knowledge handlers are registered only on scoped read jobs.

Jobs with no knowledge handlers keep today's advertised names. A `read` job with a non-empty list advertises today's read tools plus `search_knowledge` and `read_knowledge`, in that order, and does not advertise `write_file`.

## 6. Deployment and compatibility

No migration, no env flag, no queue drain. `INTERNAL_SERVICE_KEY` is already required (`api-gateway-http.client.ts:27-31`, guard `:63-68`). This task does not deploy. The sidecar tester window is irrelevant to LOCAL-TESTS.

The field is omitted for every job this code can sign, so old and new payloads for current roles match.

| State | Behaviour |
|---|---|
| Old gateway, old worker | Today's jobs |
| Old gateway, new worker | Field absent. Missing is valid. Proofs verify. No knowledge tools |
| New gateway, old worker | Field omitted, so the signed bytes match today. An old worker's digest still covers a key it does not know, if a later release signs one |
| New gateway, new worker | Field omitted. Tools exist and do not register |
| Jobs already queued | Signed without the field. The new worker accepts them |
| Rollback of either or both services | Queued jobs still omit the field. The old worker accepts them |
| New worker, old gateway, and a non-empty list | Not produced by this release. The missing route would fail the tool call; the run would continue |

Agent mode stays `read` or `agent-write` with no knowledge tools. Collaboration `read` / `review` / `write` behaviour is unchanged while the map is empty.

When BIZ-01 later fills the map, jobs already queued were signed without the field and will not grow tools. BIZ-01 owns that deploy note.

## 7. Tests per acceptance criterion

Compare ai-service with ASK-CONTRACT-01: 45 suites, 1105 passed, 1 skipped, 0 failed. Compare api-gateway with HARNESS-FIXES-01A: 2748 passed, 7 skipped, 14 failed, only `smoke.integration`. Those 14 are the known runtime-only failures (KNOW-01 recorded the same class at 2609 passed; ACCESS-01C at 2735). A new failure outside that suite is a regression. Run on Node v22.14.0. A `better-sqlite3` failure on another Node is environmental. Do not start a database to clear `smoke.integration`. No frontend build, so `frontend/tsconfig.tsbuildinfo` is untouched.

| AC | Tests | Spec file |
|---|---|---|
| Tools are read-only and register only for a non-empty signed list | Definitions: enabled, implemented, `requiresApproval` false, `additionalProperties` false, no write fields. `read` + `['policies']` advertises and registers both tools and not `write_file`. Missing and `[]` keep today's read set. `review`, `write`, and `agent-write` with a non-empty list store `knowledge_scopes_profile_conflict` and do not call the provider | `tool-registry.spec.ts`; `worker/worker.processor.spec.ts` (new describe, reuse `withHarnessProof` at `:6054`) |
| Caps | Search returns 20 hits and `truncated: true` on a 21st document. Preview length 240. Read with a tiny `maxToolResultBytes` returns sliced `content` and `truncated: true`. A handler result that still exceeds the dispatcher cap is `RESULT_TOO_LARGE` | `knowledge/knowledge-search.spec.ts` (pure functions); `agent-harness/tools/handlers/knowledge-tool-handlers.spec.ts` |
| Shape and progress | Blank query and blank `documentId` throw before HTTP. Handler sends `deps.userId` and `deps.scopes` and ignores `args.userId`. Progress target is `query` or `documentId` | handler spec; `tool-progress.spec.ts`; `api-gateway-http.client.spec.ts` |
| Invalid scopes and non-v1 | Not an array, `null`, unknown id, duplicate, length 10 → `knowledge_scopes_invalid`. Present on a job with no `harnessVersion`, including `[]` → `knowledge_scopes_requires_harness`. No provider call | `worker.processor.spec.ts` |
| Proof covers the field | Sign `knowledgeScopes: ['policies']`. Replacing it with `['market-data']` changes `payloadDigest`. The worker stores `PAYLOAD_INTEGRITY_MISMATCH` when the signed job is flipped. Golden canonical JSON is not edited | gateway: `internal-collaboration.controller.spec.ts` beside `:1912`; worker: the new describe. Existing complete-payload test at `worker.processor.spec.ts:2920` stays |
| Gateway is the only setter | `KNOWLEDGE_ROLE_SCOPES` is `{}`. `knowledgeScopesForProfile` is `[]` for `lead`, `writer`, `reviewer`, `chief-of-staff`, and `builder`. Every map value is a registry id. `fileAccess` jobs for lead, writer, and reviewer have no `knowledgeScopes` property. A caller body field `knowledgeScopes` is absent from `pendingJob` and from the signed payload. `fileAccess` false also omits it. `knowledgeScopesJobFields` of a list `['policies']` returns that list; an unknown id throws | `knowledge/knowledge-scopes.spec.ts`; `orchestration/internal-collaboration.controller.spec.ts` (extend the ignore-caller case at `:1940`) |
| Internal guard, owner, scope, soft delete | No key → 401. Wrong key → 401. Key and no session cookie → 200. Search returns only the caller's active rows in the requested scopes. Other owner, other scope, and `deletedAt` set are absent. Hits have no `content`. Unknown scope → 400. Empty scopes → 400. Read of another owner, another scope, a deleted row, a bad id, or a missing heading → the same 404 and no `content`. A heading match returns that section | `knowledge/internal-knowledge.controller.spec.ts`, with `APP_GUARD` `InternalServiceAuthGuard` and `setGlobalPrefix('api')`, following `internal-accounting.controller.spec.ts` |
| Worker allow-list matches the server registry | Extracted ids equal the worker constant, in order | `worker/knowledge-scopes.spec.ts` (or the worker processor spec) |
| Collaboration profiles stay put | Existing `expectSignedToolProfile` cases still pass, plus `not.toHaveProperty('knowledgeScopes')` | `internal-collaboration.controller.spec.ts:1898` |
| Builds | `npm test` and `npm run build` in `services/ai-service` and `services/api-gateway` | — |

`tool-registration-gates.spec.ts` is expected to pass without an edit.

## 8. Risks

| Risk | Handling |
|---|---|
| Tools register and the model never sees them | The allow-list drops unknown ids (`adapter-tool-use.mapper.ts:89-91`). Decision 1 adds the two ids. The worker does not bypass the selector |
| An empty map makes the feature look finished | Section 4 states that Keith's uploads do not change runs until BIZ-01. Tests assert the field is omitted for lead, writer, and reviewer |
| The non-empty enqueue path has no production role | `knowledgeScopesJobFields` is unit-tested with an explicit list. The real map test asserts `{}`. Signing is tested on a hand-built payload |
| Two copies of the nine ids drift | Parity spec reads `knowledge-scopes.ts`. The gateway checks `findKnowledgeScope` again on the internal route |
| Scope list signed by a compromised or buggy gateway | Worker rejects unknown ids before any tool call. The internal route rejects them again |
| Model passes `userId` or `scopes` in the tool args | Schema forbids extra properties. Handlers ignore them and send the closed-over job values. Proof binding ties `userId` to the signature (`worker.processor.ts:386-392`) |
| Search or a missed heading reveals another owner's document | One 404 body for missing, other owner, other scope, deleted, and unknown heading. Search hits omit `content` |
| Document text instructs the model | Reachable only after BIZ-01 puts a non-empty list on a job. Role instructions that treat document text as data belong to BIZ-01. The hand-off approval gate is unchanged |
| A 200 KB read exceeds `maxToolResultBytes` | The handler slices and sets `truncated`. The dispatcher remains the backstop |
| Setext headings (`Title` plus a line of `=`) are not sections | ATX headings only. Citation markers already use the heading text after `#` |
| `In([])` generates invalid SQL | Empty scopes return before the query, on both the route and the service |
| Fixture edits hide a collaboration regression | Profile cases keep their tool expectations. The only addition is `not.toHaveProperty('knowledgeScopes')` |
| Golden digest edited by accident | Section 3 forbids adding the key to the golden payload |

## 9. Decisions for Keith

1. **Expand the write set so the tools can be advertised — recommend yes.** Add `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts` and `services/ai-service/src/ai-execution/adapters/__tests__/adapter-tool-use.mapper.spec.ts`. Add `search_knowledge` and `read_knowledge` to `HARNESS_ADVERTISABLE_TOOL_IDS` and to the gate branch that returns true for `search_workspace`. Without those edits the handlers register and `selectAdvertisedAgentHarnessTools` drops them, which is why `browser_smoke` never reaches the model. The worker must not append the tools after the selector. If this is declined, stop: the tools cannot be offered to the model inside the current write set.

2. **Give the tools only to profile `read` — recommend yes.** A non-empty list on `review`, `write`, or `agent-write` is stored as `knowledge_scopes_profile_conflict` and the provider is not called. The plan's business roles are read-only, and Chief of Staff is specified as the `read` profile. Missing or empty lists stay valid on every profile and register nothing.

3. **Leave Agent-mode jobs without `knowledgeScopes` — recommend yes.** `ai-execution.controller.ts` stays out of the write set. Agent runs remain `read` or `agent-write` with workspace tools only. If this is declined, this task also edits `services/api-gateway/src/ai/ai-execution.controller.ts` and `ai-execution.controller.spec.ts`, and it needs a stated rule for which scopes an Agent job receives. That file is one of the three contract paths. The recommendation is to leave it for a later task only if you later want the coding agent to search documents.

No other file needs a scope change. `app.module.ts` already imports `KnowledgeModule`. The new controller is added to `knowledge.module.ts`. The guard already matches `/api/internal/`. `orchestration.module.ts` already imports `KnowledgeModule`, and the job field is a pure function, so the service constructor stays as it is.

## 10. Follow-ups

| Follow-up | Disposition |
|---|---|
| BIZ-01 writes `chief-of-staff` into `KNOWLEDGE_ROLE_SCOPES` (the five shared scopes plus `contract-templates`) and is the first production job that carries `knowledgeScopes`. Jobs already queued at that deploy stay without the field | Superseded by BIZ-01, already registered, NOT_READY, depends on KNOW-02 and KNOW-03 |
| `search_knowledge` later returns the stored summary | Superseded by KNOW-04 |
| Agent mode sends `knowledgeScopes` from `ai-execution.controller.ts` | Dropped unless Decision 3 is declined. Coding runs are not knowledge readers. Re-propose if the coding agent should search documents |
| Register the two tools for `review`, `write`, or `agent-write` | Dropped with Decision 2. Re-propose with a role that needs a mutating profile and knowledge together |
| SQL or an index for search | Dropped. The account cap is 50 documents and 4 MB (`knowledge-content.ts:9-11`); the service scans those rows in process |

`FOLLOWUPS: 0 registered / 2 superseded / 3 dropped / 0 undisposed`

---

**Files read**

- `TASKS_BACKLOG_FULL.md` (KNOW-01, KNOW-02, KNOW-03, BIZ-01 bodies)
- `docs/AGENT-BIZ-KNOWLEDGE-PLAN.md` sections 3, 6, 7 and Correction 1
- `docs/ACCESS-01C-STAGE-START.md`; `docs/ACCESS-01C-CHECKPOINT.md`; `docs/KNOW-01-CHECKPOINT.md`
- `docs/ASK-CONTRACT-01-CHECKPOINT.md` and `docs/HARNESS-FIXES-01A-CHECKPOINT.md` (latest suite counts)
- `docs/control-plane/lane-saturation-state.json` (occupancy, sharedContracts)
- `services/ai-service/src/queue/job.types.ts`
- `services/ai-service/src/worker/worker.processor.ts` (digest, proof, profile, registration, known messages); `worker.processor.spec.ts` (golden digest, `withHarnessProof`, advertisement)
- `services/ai-service/src/agent-harness/tools/tool-registry.ts`, `tool-registry.contracts.ts`, `tool-registry.spec.ts`, `tool-progress.ts`, `tool-dispatcher.ts`, `handlers/file-tool-handlers.ts`, `__tests__/tool-registration-gates.spec.ts`
- `services/ai-service/src/agent-harness/config/agent-harness.config.ts`
- `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts` and its spec (allow-list)
- `services/ai-service/src/clients/api-gateway-http.client.ts` and spec
- `services/api-gateway/src/ai/ai-execution.controller.ts`; `clients/ai-service-http.client.ts`; `public-api/public-ai.controller.ts`
- `services/api-gateway/src/knowledge/` (scopes, service, controller, module, content, entity)
- `services/api-gateway/src/entities/knowledge-document.entity.ts`
- `services/api-gateway/src/orchestration/collaboration-tool-profile.ts`, `collaboration-team.ts`, `orchestration.service.ts`, `orchestration.module.ts`, `internal-collaboration.controller.ts` and spec, `collaboration.controller.ts`, `collaboration-citations.ts`
- `services/api-gateway/src/app.module.ts`, `main.ts`, `guards/internal-service-auth.guard.ts`
- `services/container-manager/src/docker/docker-runtime.service.ts` (search caps)
- `frontend/lib/agent-platform/agent-registry.ts` (manifest scope lists)

## Control-plane review and Keith's decisions (binding; these override the sections above where they differ)

Drafted by Cursor grok-4.7-xhigh (resolved "Grok 4.7 256K Extra High") in read-only mode; no files touched. The control plane checked the draft against the code: `HARNESS_ADVERTISABLE_TOOL_IDS` and `passesFirstSliceRuntimeGate` drop any tool id not on the list (`adapter-tool-use.mapper.ts` lines 15-22 and the gate's `search_workspace` case); `InternalServiceAuthGuard` protects every `/api/internal/` path (`internal-service-auth.guard.ts` lines 10-15); `KnowledgeModule` is already imported by `AppModule` (line 90) and `OrchestrationModule` (line 37); the nine registry ids are `knowledge-scopes.ts` lines 14-24; hand-off harness fields are spread in the `fileAccess` branch of `orchestration.service.ts` (line 826). No correction was needed.

**Keith's decisions, 2026-11-06:**

1. The write set adds `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts` and `services/ai-service/src/ai-execution/adapters/__tests__/adapter-tool-use.mapper.spec.ts`, only to add `search_knowledge` and `read_knowledge` to `HARNESS_ADVERTISABLE_TOOL_IDS` and to the gate case that returns true for `search_workspace`. The backlog body and the sidecar write set record this scope change in the same record as this document.
2. The knowledge tools register only for the signed profile `read` with a non-empty `knowledgeScopes` list. A non-empty list on `review`, `write` or `agent-write` is stored as `knowledge_scopes_profile_conflict` before any provider call.
3. Agent-mode jobs get no `knowledgeScopes`; `services/api-gateway/src/ai/ai-execution.controller.ts` is not edited.

**Follow-up dispositions (section 10 confirmed):** BIZ-01 and KNOW-04 supersede the first two rows. Keith dropped the other three on 2026-11-06; they are listed in the backlog's Dropped follow-ups list.

`FOLLOWUPS: 0 registered / 2 superseded / 3 dropped / 0 undisposed`

**Implementation notes.** `worker.processor.ts` and `job.types.ts` are contract paths: change only what sections 3 and 5 name. Do not edit the golden canonical payload test (`worker.processor.spec.ts` about line 2920). Existing collaboration profile cases keep their tool expectations; the only addition there is `not.toHaveProperty('knowledgeScopes')`. Gates are compared with ai-service ASK-CONTRACT-01 (1105 passed, 1 skipped, 0 failed) and api-gateway HARNESS-FIXES-01A (2748 passed, 7 skipped, 14 known `smoke.integration` failures).
