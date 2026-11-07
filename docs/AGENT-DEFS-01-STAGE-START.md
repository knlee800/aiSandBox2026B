# AGENT-DEFS-01 — Stage-start

## 1. Scope and non-goals

AGENT-DEFS-01 gives the gateway one registry for system-agent definitions. The frontend dashboard, station cards, and office read the public part from a login-only route. Each definition carries a content hash that RSI-00 stage S1 can record later. Screens, team behaviour, signed scope lists, and the Knowledge page stay as they are.

Lane 1 is ACTIVE on AGENT-DEFS-01 with GATEWAY, FRONTEND, and I18N. Lane 2 is empty. Lifecycle is 4-step. This document is step 2. Evidence class is LOCAL-TESTS. No new dependency, no migration, no env change, and no Docker, PostgreSQL, Redis, or servers.

Admitted write set, narrowed to the files the implementation changes:

- New `services/api-gateway/src/system-agents/` (registry, controller, module, specs)
- `services/api-gateway/src/app.module.ts` (one module import)
- `services/api-gateway/src/orchestration/collaboration-teams.ts` and `collaboration-teams.spec.ts`
- `services/api-gateway/src/orchestration/collaboration-tool-profile.ts`
- `services/api-gateway/src/knowledge/knowledge-scopes.ts` (comment only) and `knowledge-scopes.spec.ts`
- `frontend/lib/agent-platform/` (registry rewrite, new hook and tests)
- `frontend/lib/office/office.logic.ts` and `office.logic.test.ts`
- `frontend/components/office/office-screen.tsx` and `office-screen.test.tsx`
- `frontend/components/platform/platform-dashboard.tsx` and `platform-dashboard.test.ts`
- `frontend/components/knowledge/knowledge-screen.test.tsx` only (it imports the registry constant)
- `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json`

Listed paths the implementation does not edit: `knowledge.controller.ts` and the rest of `knowledge/` outside the two files above; `collaboration.controller.ts`, `collaboration-team.ts`, `collaboration-citations.ts`, and the rest of `orchestration/`; `agent-station-card.tsx` and `agent-detail-panel.tsx`; `knowledge-screen.tsx` and `knowledge-api.ts`; `office-knowledge.ts`; the user-agent controller; ai-service. No file outside the admitted write set. Decision 3 is the only fork that would add one.

Non-goals: run provenance storage, a version table, BIZ-03, new agents, instructions for Product Strategy or Technology Advisor, changing Start Building (`/app`) or the Chief of Staff Open link (`/collaboration`), the user-agent routes, the internal collaboration role allow-list, and `HARNESS_ENTITLEMENT_PROOF_V1`.

Checklists this design leaves satisfiable: EVERY (admitted 4-step LOCAL-TESTS task, no new dependency, no runtime, gates named in section 9). UI (new copy in all three message files, existing Heroicons v2 Outline, existing test ids kept, loading and failure rendered and tested, no live browser check because the new states are static markup). BACKEND (existing `SessionCookieGuard` used and not modified, no internal route, no frozen-contract edit, no migration, gateway result compared with BIZ-01).

## 2. Current state

Two definition bodies exist. The frontend constant is what the screens render. The gateway team constant is what a collaboration run executes. They meet on the Chief of Staff, and they disagree everywhere else.

| Place | What it holds | Citation |
|---|---|---|
| Frontend constant | Four manifests: builder, chief-of-staff, product-strategy, technology-advisor. Fields include translation keys, status, enabled, route, avatar, sprite, model profile, tool permissions, scopes, empty skills, manifestVersion 1 | `frontend/lib/agent-platform/agent-registry.ts:4-9`, `:95-133`, `:135-234` |
| Dashboard read | `listAgents()` at render. No fetch for these four. User-created agents are a second fetch, `GET /api/agents` | `frontend/components/platform/platform-dashboard.tsx:138`; `frontend/hooks/useUserAgents.ts:103` |
| Station card | Renders name, role, description, status, enabled. Initials come from the name. It does not read avatarRef | `frontend/components/platform/agent-station-card.tsx:3-16`, `:55-61` |
| Detail actions | Builder Start Building is hardcoded `/{locale}/app`. Chief Open is hardcoded `/{locale}/collaboration` from `openPath: '/collaboration'`. Manifest `route` is not the href | `frontend/components/platform/agent-detail-panel.tsx:176-180`; `frontend/components/platform/platform-dashboard.tsx:86-118`, `:343-346` |
| Office desks | `listAgents()` builds the registry. A collaboration run whose `builderProfileId` is an active registry id other than builder goes to `registry:<id>`. Other collaboration runs go to the Team desk | `frontend/components/office/office-screen.tsx:392`; `frontend/lib/office/office.logic.ts:81-100`, `:111-123` |
| Office names | The view calls `listAgents()` again and translates `nameKey` and `roleKey` | `frontend/components/office/office-screen.tsx:126-152` |
| Office badge | After sign-in, `GET /api/knowledge/documents`. Scope ids come from `getAgentById('chief-of-staff').knowledgeScopes`. A failed read leaves the badge off | `frontend/components/office/office-screen.tsx:440-464` |
| Office runs | `GET /api/ai/executions?state=active\|recent&limit=50`. 401 is `AUTH_EXPIRED`. Any other failure is `FETCH_FAILED` | `frontend/hooks/useOfficeRuns.ts:29-40` |
| Gateway teams | `coding` is lead, writer, reviewer. `chief-of-staff` is one role. A role is name, instructions, tool profile, scope ids. The file says the model is not stored here | `services/api-gateway/src/orchestration/collaboration-teams.ts:3-4`, `:12-22`, `:55-90` |
| Coding instructions | Three string literals, lead then writer then reviewer | `collaboration-teams.ts:46-53` |
| Chief instructions and scopes | One prompt and six ids | `collaboration-teams.ts:29-44`, `:79-88` |
| Readers of the team constant | `collaborationAgentsForTeam('coding')` builds `COLLABORATION_TEAM`. `collaborationRoleKnowledgeScopes()` fills `KNOWLEDGE_ROLE_SCOPES`. `businessRoleProfileIds()` fills `BUSINESS_ROLE_PROFILE_IDS` | `collaboration-team.ts:23-24`; `collaboration-teams.ts:138-161`; `knowledge-scopes.ts:1`, `:42-43`; `collaboration-citations.ts:1`, `:18-20` |
| Tool profile | Does not read the team constant. `writer` returns `write`, `reviewer` returns `review`, every other id returns `read` | `collaboration-tool-profile.ts:46-56` |
| Start route | Optional `team`, missing means coding. Provider and model come from `resolveServerProviderModel()`. The body cannot set instructions, scopes, or tool profile. Agents passed in are `collaborationAgentsForTeam` | `collaboration.controller.ts:142-143`, `:155-202`, `:419-427` |
| Scope catalogue | Nine ids and types, comment says they were copied from the frontend manifests. `legal-contracts` is absent | `knowledge-scopes.ts:11-26` |
| Parity spec | Reads `frontend/lib/agent-platform/agent-registry.ts` and requires the same ids and types in first-seen order | `knowledge-scopes.spec.ts:12-70` |
| Signed role map | Only `chief-of-staff` maps to the six ids. `lead`, `writer`, `reviewer`, and `builder` sign nothing | `knowledge-scopes.spec.ts:80-98` |
| Knowledge page | Does not declare ids. It fetches `GET /api/knowledge/scopes` and labels `knowledge.scopes.<id>` | `frontend/components/knowledge/knowledge-screen.tsx:458-474`; `frontend/messages/en.json:1084-1093` |
| Scope route | `GET /api/knowledge/scopes`, `SessionOrApiKeyAuthGuard`, then `harnessEntitled` or 403 | `knowledge.controller.ts:56-68`, `:143-149` |
| User-created agents | `GET/POST /api/agents`, `GET/DELETE /api/agents/:id`, `SessionCookieGuard`. A different resource | `services/api-gateway/src/user-agent/user-agent.controller.ts:43-88` |
| Login guard | Cookie `aisandbox_session` only. Missing cookie is 401 before the session lookup. Bearer tokens are not read | `services/api-gateway/src/auth/session-cookie.guard.ts:23-33` |
| Session-or-key guard | Bearer first, else the session cookie. Used by Knowledge and collaboration, not by `/api/agents` | `session-or-api-key.guard.ts:34-46`; `collaboration.controller.ts:145-146` |
| Collaboration entitlement | Login is not enough. `harnessEntitled !== true` is 403 | `collaboration.controller.ts:355-361` |
| Internal role names | `AGENT_ROLES` repeats the four dashboard ids as the orchestration `agentRole` allow-list. Hand-offs from the page still send `agentRole: 'builder'` | `internal-collaboration.controller.ts:27-32`; `orchestration.contracts.ts:27-31`; `collaboration-team.ts:30-34` |
| Worker scope copy | ai-service holds the same nine ids and a spec parses the gateway `KNOWLEDGE_SCOPES` literal | `services/ai-service/src/worker/knowledge-scopes.ts:12-26`; `knowledge-scopes.spec.ts:27-38` |
| Global internal guard | `/api/system-agents` is not under a protected prefix, so the global guard bypasses it | `guards/internal-service-auth.guard.ts:10-16`, `:56-60` |
| Module list | `UserAgentModule` and `KnowledgeModule` are imported. There is no system-agent module | `app.module.ts:36-37`, `:89-90` |
| Prefix and proxy | Gateway prefix is `api`. The frontend falls back `/api/:path*` to the gateway | `main.ts:71`; `frontend/next.config.js:9-16` |
| npm test scope | The frontend script does not run `lib/office`, `lib/agent-platform`, `components/office`, `components/platform`, or `components/knowledge` | `frontend/package.json:10` |

Same values, written twice:

| Item | Frontend | Gateway |
|---|---|---|
| Chief status | `active`, `enabled: false` (`agent-registry.ts:168-170`) | No status. The role is executable (`collaboration-teams.ts:82-87`) |
| Chief scopes | Five shared plus `contract-templates` (`:173-180`) | The same six ids, without types (`:29-36`) |
| Builder scopes | Five shared plus `codebase-context` (`:148-155`) | Not a signed role. The ids exist only because the catalogue was copied from the manifests |
| Product / Technology | `coming_soon`, `enabled: false`, specialist `market-data` / `tech-landscape` (`:186-232`) | Not teams. Their specialist ids exist only on the catalogue |
| Coding roles | Absent | lead `read` and no scopes; writer `write`; reviewer `review` (`:58-76`) |
| Model | Per-manifest `AgentModelProfile` (`:95-111`) | Env selection at start, one model for every team (`collaboration.controller.ts:419-427`) |
| Tools | Permission objects. Placeholders block `*` (`:127-133`). The screens do not render them | Harness profile on the role, but the lookup is a name branch (`collaboration-tool-profile.ts:46-56`) |

The catalogue order is the manifest first-seen order: the five shared ids, `codebase-context`, `contract-templates`, `market-data`, `tech-landscape` (`knowledge-scopes.ts:16-26`).

Latest gates to compare with, both Node v22.14.0:

| Suite | Result | Source |
|---|---|---|
| api-gateway `npm test -- --runInBand` | 201 suites passed, 2 skipped, 1 failed; 2780 passed, 7 skipped, 14 failed, all in `smoke.integration.spec.ts`. Jest can stay open on Redis retries | `docs/BIZ-01-CHECKPOINT.md:31` |
| frontend `npm test` | 876 passed, 0 failed. That script skips the office, registry, and dashboard tests | `docs/PROVIDER-LIMIT-MSG-01-CHECKPOINT.md:33`; `docs/BIZ-02-CHECKPOINT.md:31` |
| Those four files by name | 105 passed, 19 suites, 0 failed | `docs/BIZ-02-CHECKPOINT.md:32` |

A new failure outside `smoke.integration.spec.ts` is a regression. Do not start a database to clear that suite.

## 3. Server registry

New pure module `services/api-gateway/src/system-agents/system-agent-registry.ts`. It imports nothing from orchestration or knowledge, so those packages can import it.

One definition type:

| Field | Meaning |
|---|---|
| `id` | Stable id |
| `nameKey`, `roleKey`, `descriptionKey` | Translation keys, or null for a team-only role |
| `status` | `active`, `coming_soon`, `disabled`, or null for a team-only role |
| `enabled` | Builder-style workspace flag. Chief stays false |
| `knowledgeScopes` | Ordered `{ id, type }` with type `shared` or `specialist` |
| `instructions` | Server prompt. Empty string when the agent has none |
| `toolProfile` | `read`, `review`, `write`, or null when the id is not a harness role |
| `modelChoice` | The literal `server` on every row |
| `teamRole` | `{ teamId, roleName }` or null |
| `version` | The hash from section 4 |

Array order:

| Order | id | Public | status | enabled | toolProfile | teamRole | Scopes |
|---|---|---|---|---|---|---|---|
| 1 | `builder` | yes | `active` | true | null | null | five shared, then `codebase-context` specialist |
| 2 | `lead` | no | null | false | `read` | coding / lead | none |
| 3 | `writer` | no | null | false | `write` | coding / writer | none |
| 4 | `reviewer` | no | null | false | `review` | coding / reviewer | none |
| 5 | `chief-of-staff` | yes | `active` | false | `read` | chief-of-staff / chief-of-staff | five shared, then `contract-templates` specialist |
| 6 | `product-strategy` | yes | `coming_soon` | false | null | null | five shared, then `market-data` specialist |
| 7 | `technology-advisor` | yes | `coming_soon` | false | null | null | five shared, then `tech-landscape` specialist |

The five shared ids, in this order on every row that has them: `company-monthly-reports`, `three-year-goals`, `strategy-docs`, `policies`, `meeting-summaries`. Types stay `shared` for those five and `specialist` for the four specialist ids. That is the current manifest (`agent-registry.ts:148-228`).

Public name keys stay the current ones: `agents.builder.*`, `agents.chiefOfStaff.*`, `agents.productStrategy.*`, `agents.technologyAdvisor.*` (`agent-registry.ts:138-140`, `:163-165`, `:187-189`, `:211-213`). Team-only rows have null keys, so they cannot appear on the dashboard.

Instructions move verbatim.

| id | Instructions |
|---|---|
| `lead` | `Read the project with your tools and decide what is needed. When the code looks wrong or a change is needed, ask writer to apply a fix. You cannot change files.` |
| `writer` | `Read the files you need. Apply the fix with write_file. You may run npm test, npm run build, or npx tsc --noEmit. Do not delete files. Then ask reviewer.` |
| `reviewer` | `Read the real files. Run npm test, npm run build, or npx tsc --noEmit when that checks the change. Name each real bug with an input that shows it. If you find a real bug, send the work back to writer with a specific list of what to fix. Otherwise give the verdict and finish. You cannot change files.` |
| `chief-of-staff` | The current `CHIEF_OF_STAFF_INSTRUCTIONS` template (`collaboration-teams.ts:38-44`), same characters |
| builder, product-strategy, technology-advisor | `''` |

`collaboration-teams.ts` stops owning those bodies. It builds `COLLABORATION_TEAMS` by filtering `teamRole.teamId`, keeping array order. Coding stays lead, writer, reviewer. Chief of Staff stays one role. `collaborationAgentsForTeam`, `readCollaborationStartTeam`, `collaborationTeamForTarget`, `collaborationRoleKnowledgeScopes`, and `businessRoleProfileIds` keep their current behaviour and their current exports. `CHIEF_OF_STAFF_INSTRUCTIONS` and `CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS` are re-exported from the registry so `collaboration-teams.spec.ts` still imports them. The scope-id export is `knowledgeScopes.map((scope) => scope.id)` of the chief row, which is the same six strings (`collaboration-teams.ts:29-36`).

`KNOWLEDGE_ROLE_SCOPES` stays `collaborationRoleKnowledgeScopes()` (`knowledge-scopes.ts:42-43`). That function copies a role only when its scope list is non-empty (`collaboration-teams.ts:138-147`). After the move, the only such role is still `chief-of-staff`. Builder, Product Strategy, and Technology Advisor keep their scopes on the definition for the screen and the catalogue, and they still sign nothing. `knowledgeScopesForProfile('builder')` stays `[]`.

`BUSINESS_ROLE_PROFILE_IDS` stays the spread of `businessRoleProfileIds()` (`collaboration-citations.ts:18-20`), which skips the coding team (`collaboration-teams.ts:151-161`). The only id remains `chief-of-staff`.

`collaborationHarnessToolProfile` reads the registry:

- A definition with a non-null `toolProfile` returns that profile.
- Any other id, including `user` (`collaboration-team.ts:16`) and an unknown id, returns `read`.

That matches today's branch (`collaboration-tool-profile.ts:46-56`): writer `write`, reviewer `review`, lead and chief-of-staff `read`. `collaboration.controller.ts` is not edited. It still resolves one provider and model for every team (`:173`, `:419-427`) and still passes `collaborationAgentsForTeam` (`:201`).

`modelChoice` is the sentinel `server` because no per-agent model exists. The frontend `AgentModelProfile` and `AgentToolPermissions` are not copied. Nothing in the dashboard, station card, or office reads them. The start route remains the server selection.

`route`, `avatarRef`, `spriteRef`, skills, referral rules, approval rules, and `manifestVersion` are not copied. The card draws initials (`agent-station-card.tsx:55-61`). Start Building and Chief Open are hardcoded paths (`agent-detail-panel.tsx:178`, `platform-dashboard.tsx:118`). Those hrefs stay. The registry test that reads `builder.route` is replaced by the source assertion that already checks `/{locale}/app` (`platform-dashboard.test.ts:617-622`).

`AGENT_ROLES` (`internal-collaboration.controller.ts:27-32`) stays. It validates `agentRole` on the internal API. It is not the dashboard list, and the page still sends `builder` (`collaboration-team.ts:30-34`).

## 4. Version hash

Each definition has one hash. Nothing is stored. S1 will call `systemAgentVersion(id)` on the server later.

Covered fields, in this key order:

| Key | Value |
|---|---|
| `id` | The definition id |
| `instructions` | The prompt, or `''` |
| `toolProfile` | `read`, `review`, `write`, or JSON null |
| `scopes` | The scope array. Each item is `{ "id", "type" }` in that key order, declaration order preserved |
| `modelChoice` | `"server"` |
| `teamRole` | JSON null, or `{ "teamId", "roleName" }` in that key order |

Name keys, status, enabled, and the public route are not hashed. A status-only edit does not change the version. Architecture 13.5 versions capabilities: instructions, tool profile, scopes, and model. Status is not one of those.

Algorithm:

1. Build that object. Every key is present. Null stays null. Do not omit empty lists.
2. `JSON.stringify` with no extra whitespace. Key order is the insertion order above. Do not sort keys. Do not sort scopes.
3. SHA-256 of the UTF-8 bytes, lowercase hex. Use `crypto.createHash('sha256')`, the same primitive as `hashKnowledgeContent` (`knowledge-content.ts:98-99`), on this payload only.
4. Do not call the harness canonicaliser in `ai-execution.controller.ts`. That file is outside the write set and belongs to the frozen proof.

The hash is on the server definition and on each object of the public route, as `version`. The public field does not reveal instructions. S1 reads the function, not the route. No table, no column, no log line.

A registry spec pins each of the seven hex strings. Changing a covered field without updating the pin fails the test. That pin is the record S1 will rely on.

## 5. Read-only route

`GET /api/system-agents`.

`@Controller('system-agents')` does not collide with `@Controller('agents')` (`user-agent.controller.ts:43-61`). `GET /api/agents/:id` matches only under `/api/agents/`. This route has no `:id`, no POST, no PATCH, and no DELETE.

Guard: the existing `SessionCookieGuard` (`session-cookie.guard.ts:23-44`). Decision 2. A missing or invalid session is 401. A Bearer token with no session cookie is 401, because this guard does not read `Authorization`. The handler does not check `harnessEntitled`. Knowledge and collaboration do (`knowledge.controller.ts:147-149`, `collaboration.controller.ts:355-361`). The command center renders these stations today with no entitlement check (`platform-dashboard.tsx:138`). Requiring entitlement would hide stations from a logged-in user who can see them now.

`SystemAgentsModule` imports `AuthModule` and declares the controller, the same shape as `user-agent.module.ts:8-13` without TypeORM. `app.module.ts` imports it next to `KnowledgeModule` (`app.module.ts:89-90`). The global internal guard bypasses this path (`internal-service-auth.guard.ts:56-60`). Do not edit that guard.

Response: `{ agents: PublicSystemAgent[] }`. Order is the public rows in section 3: builder, chief-of-staff, product-strategy, technology-advisor.

| Public field | Notes |
|---|---|
| `id`, `nameKey`, `roleKey`, `descriptionKey` | Required strings |
| `status` | `active`, `coming_soon`, or `disabled` |
| `enabled` | Boolean |
| `knowledgeScopes` | `{ id, type }[]`, type `shared` or `specialist` |
| `version` | 64 lowercase hex characters |

Absent from the body: `instructions`, `toolProfile`, `modelChoice`, `teamRole`, `modelProfile`, `toolPermissions`, and the team-only ids `lead`, `writer`, `reviewer`.

Header: `Cache-Control: private, no-store`. Billing already sets `no-store` on an authenticated read (`billing-read.controller.ts:59`). `private` keeps a shared cache from storing a login route. The body is the same for every user; `no-store` is so a deploy is visible on the next load. No ETag and no storage.

Wire tests, in `system-agents.controller.spec.ts`, with `setGlobalPrefix('api')` as the user-agent spec does (`user-agent.controller.spec.ts:379-393`):

- Guard metadata is `SessionCookieGuard`.
- No cookie: 401, and `validateSessionToken` is not called (`session-cookie.guard.ts:27-28`).
- `Authorization: Bearer …` and no cookie: 401.
- Overridden guard, 200: the four ids in order; each `version` matches `systemAgentVersion`; `Cache-Control` is `private, no-store`.
- `JSON.stringify(response.body)` does not contain `instructions`, `toolProfile`, `modelChoice`, `teamRole`, `modelProfile`, `toolPermissions`, `You are the owner's Chief of Staff`, `ask writer`, `write_file`, or `search_knowledge`.
- POST `/api/system-agents` is 404.
- The existing user-agent spec is not edited and still passes, which is the proof that `/api/agents` is unchanged.

## 6. Frontend loading

`frontend/lib/agent-platform/agent-registry.ts` keeps types, `parseSystemAgents`, and the Builder fallback. It no longer exports `AGENT_MANIFESTS` or the model and tool constants. `listAgents()` as a source of the four definitions goes away. Pure helpers take an array the caller already has.

`parseSystemAgents` accepts `{ agents: [...] }` when every item has the public fields and a 64-hex `version`. Unknown keys are ignored, so a later public field does not break this client. It does not hardcode the four ids. A well-formed extra agent is kept. Empty, malformed, or a bad status is null.

The only runtime duplicate is the fallback, one public Builder row: id `builder`, keys `agents.builder.name`, `agents.builder.role`, `agents.builder.description`, status `active`, enabled true, `knowledgeScopes: []`, `version: 'fallback'`. No scopes, no instructions, no tool profile. `version: 'fallback'` cannot be mistaken for a hash.

New `frontend/lib/agent-platform/use-system-agents.ts` (`use client`):

| Result | Hook |
|---|---|
| `GET /api/system-agents` with `credentials: 'include'`, same as `useUserAgents.ts:103` | 200 and a non-empty parse: those agents, error null |
| 401 | `AUTH_EXPIRED`, agents stay empty, fallback is not installed |
| Network error, other status, parse null, or an empty list | `FETCH_FAILED`, agents are the Builder fallback |

GET needs no CSRF header (`knowledge-api.ts:55-59` adds it only for other methods). The rewrite is the existing `/api/:path*` fallback (`next.config.js:14-15`).

401 handling matches the pages that already redirect: `router.replace('/' + locale + '/login')` (`platform-dashboard.tsx:253-257`, `office-screen.tsx:472-474`). The server sentence is not shown.

Dashboard (`platform-dashboard.tsx`):

| State | What the station area shows |
|---|---|
| Loading | The existing user-agent loading box treatment (`:515-518`), new `data-testid="platform-system-agents-loading"`, copy `platform.systemAgentsLoading`. Station counts wait until the fetch settles, so they do not flash 0 |
| 401 | No error box. The existing redirect runs |
| Failure | The existing user-agent error treatment (`:521-534`), including `ExclamationTriangleIcon`, which is already imported (`:10`). `data-testid="platform-system-agents-error"` and `platform-system-agents-retry`. The Builder card is shown under the error. Counts are 1 active and 0 reserve |
| Success | Today's four cards. Counts are 2 active and 2 reserve. No new success sentence |

`staticAgentProfileContent` stays. Chief still opens `/collaboration`. Builder still opens `/app`. Card test ids `agent-station-card-<id>` stay. Detail test ids stay.

Office:

- `OfficeScreenView` takes the public agents as a prop and stops calling `listAgents()` (`office-screen.tsx:126`).
- The container's loading flag (`:504`) also waits for this fetch. The full-screen copy stays `office.loading`. No second loading sentence.
- Failure adds a third alert beside the run and user-agent alerts (`:323-360`), `data-testid="office-system-agents-error"` and `office-system-agents-retry`, reusing `office.retry`. Desks then come from the Builder fallback, so the Chief desk is absent and a chief collaboration run falls through to the Team desk (`office.logic.ts:111-123`). The alert says so.
- Success uses the server list. The badge still reads the chief row's scope ids. If that row is missing, the badge stays off, which is the current failed-read behaviour (`office-screen.tsx:447-464`).
- `attributeDeskId`'s default `listAgents()` (`office.logic.ts:116`) becomes a required argument. `buildOfficeDesks` already passes one (`:471`). Tests pass a fixture of the four id/status pairs.

Copy. The retry buttons reuse `platform.agentCreate.retry` and `office.retry`. New keys:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `platform.systemAgentsLoading` | Loading stations… | 正在載入席位… | 正在加载席位… |
| `platform.systemAgentsLoadError` | Stations could not be loaded. Only Builder is shown. | 無法載入席位，目前只顯示 Builder。 | 无法加载席位，目前只显示 Builder。 |
| `office.systemAgentsLoadError` | Stations could not be loaded. Only the Builder desk is shown. | 無法載入席位，目前只顯示 Builder 的座位。 | 无法加载席位，目前只显示 Builder 的座位。 |

Name, role, and description stay in `agents.*` in the three message files (`en.json:507-528` and the same keys in zh-TW and zh-CN). The client translates `nameKey`. There is no hardcoded English in the new UI. Product name Builder stays Builder, as in `zh-TW.json:533`.

Empty station list: not a state. An empty payload is the failure row above. The office's existing empty copy (`office.emptyTitle`) is unchanged and still means no user agents and no runs.

Tests that imported `listAgents()` for render data use a fixture of the public shape. The gateway spec is the authority for the four ids. `knowledge-screen.test.tsx:236-247` stops walking the manifest and checks the nine `knowledge.scopes.*` keys by id. The Knowledge page component is not edited.

## 7. Knowledge scope list

The Knowledge page gets its ids from `GET /api/knowledge/scopes` (`knowledge-screen.tsx:458-474`). Labels are `knowledge.scopes.<id>` (`en.json:1084-1093`). The page has loading, error, and forbidden copy already (`knowledge-screen.tsx:100`, `:176`, `:197`). It does not keep a second id list.

The duplicate is the gateway catalogue versus the manifest scopes, locked by a spec that parses the frontend file (`knowledge-scopes.spec.ts:12-70`). Deleting the manifest breaks that spec.

Recommendation: fold the check now, leave the page, leave the literal.

- `KNOWLEDGE_SCOPES` stays the array literal at `knowledge-scopes.ts:16-26`, same ids, same types, same order, still ending so the first `];` closes it.
- The comment at `knowledge-scopes.ts:11-15` changes. It no longer says the list is copied from `agent-registry.ts`.
- `knowledge-scopes.spec.ts` stops reading the frontend file. It asserts that the unique first-seen scopes of the registry, in array order, equal `KNOWLEDGE_SCOPES`.
- `GET /api/knowledge/scopes` and `knowledge.controller.ts` stay. The existing spec still compares the HTTP body to `KNOWLEDGE_SCOPES` (`knowledge.controller.spec.ts:191-195`).
- Class-validator `@IsIn(KNOWLEDGE_SCOPE_ID_VALUES)` stays (`dto/knowledge-document.dto.ts`).

Why the literal stays: `services/ai-service/src/worker/knowledge-scopes.spec.ts:27-38` extracts ids with `/id:\s*'([^']+)'/` from that array. Deriving the array in code makes that spec fail, and ai-service is not in this write set. Decision 3.

Cost of this choice: one catalogue literal remains, pinned by a test to the registry. The frontend file parse goes away. The Knowledge page does not change.

Cost of retargeting the page onto `GET /api/system-agents`: the page would union scopes from agents, drop the type catalogue route, and still need labels. No screen change needs that. It is not in this task.

Cost of deleting the literal and editing the worker spec: an AI-SERVICE scope change this lane does not hold.

First-seen order from section 3 is the current nine, because team-only rows have no scopes and the public rows introduce ids in the current catalogue order.

## 8. Deployment and compatibility

This task does not deploy. No migration, no env flag, no queue change, no new job field. The frozen proof is untouched. In-flight work is unchanged because the start route still sends `collaborationAgentsForTeam` (`collaboration.controller.ts:201`) and those strings are the ones in section 3.

| State | What the user gets |
|---|---|
| Old frontend, new gateway | The old bundle still has the four manifests. It never calls the new route. Teams and scopes match section 3. Screens match today |
| New frontend, old gateway | `GET /api/system-agents` is 404. The hook takes the failure path. Dashboard and office show Builder only, plus the error and retry. Team and Knowledge pages do not call this route |
| New frontend, new gateway | Four stations, same statuses |
| Rollback of the frontend only | Old bundle against the new route. Same as the first row |
| Rollback of the gateway only | Same as the second row. Collaboration runs keep today's instructions |
| Rollback of both | The previous release |

Deploy the gateway before the frontend when this is released, so the 404 window is a rollback case and not the normal rollout. The tester window does not apply to this LOCAL-TESTS task.

## 9. Tests per acceptance criterion

Run api-gateway `npm test -- --runInBand` and `npm run build`. Compare with BIZ-01: 2780 passed, 7 skipped, 14 failed, only `smoke.integration.spec.ts`. A hung Jest after that summary is the known Redis retry, not a new failure.

Run frontend `npx tsc --noEmit`, `npm test`, and `npm run build`. Compare `npm test` with 876 passed, 0 failed. Restore `frontend/tsconfig.tsbuildinfo` after the build. Do not run ai-service.

`npm test` does not see the office, registry, dashboard, or knowledge tests (`frontend/package.json:10`). Run these by name, and require 0 failed:

- `frontend/lib/agent-platform/agent-registry.test.ts`
- `frontend/lib/agent-platform/use-system-agents.test.ts`
- `frontend/lib/office/office.logic.test.ts`
- `frontend/components/office/office-screen.test.tsx`
- `frontend/components/platform/platform-dashboard.test.ts`
- `frontend/components/knowledge/knowledge-screen.test.tsx`

BIZ-02's 105/19 count will rise because of the new hook file. The bar is 0 failed, not that count.

| Criterion | Proof |
|---|---|
| One registry; teams, `KNOWLEDGE_ROLE_SCOPES`, and tool profiles read it; values unchanged | `system-agent-registry.spec.ts` pins the seven rows, the seven instruction strings, and the seven version hexes. `collaboration-teams.spec.ts` keeps today's expects: coding profiles `read/write/review`, empty coding scopes, chief instructions and six scopes, `businessRoleProfileIds()` equals `['chief-of-staff']`, and `collaborationHarnessToolProfile(role.name)` equals `role.toolProfile`. Add `user` and an unknown id still return `read`. `knowledge-scopes.spec.ts` keeps the chief map and the empty map for lead, writer, reviewer, and builder, and compares the catalogue to the registry instead of the frontend file |
| Public route has no private fields; login required; `/api/agents` unchanged | `system-agents.controller.spec.ts` as in section 5. User-agent spec file untouched and still green |
| Dashboard, cards, and office load the route; loading and failure copy; same agents and statuses | `use-system-agents.test.ts`: 200 parses, 401 does not fall back, 404 and `{}` and `[]` fall back to Builder only. Dashboard render tests for `platform-system-agents-loading`, `platform-system-agents-error`, and the four station ids on a fixture, including chief `active` / not enabled and the two `coming_soon` rows. Office view tests for `office-system-agents-error` and for `registry:chief-of-staff` when the fixture is the four agents. Existing `office-loading`, `office-runs-retry`, `office-agents-retry`, `agent-detail-open` stay |
| The frontend constant is gone | `agent-registry.test.ts` imports no manifest array. It checks the parser, the fallback keys, and that a payload containing `instructions` still parses to an object without that field. Translation-key test walks the fixture keys against en, zh-TW, and zh-CN |
| Knowledge catalogue unchanged | `knowledge.controller.spec.ts` body expect stays. Worker spec is not run here; the literal shape keeps it valid |
| New copy | The three new keys exist in all three message files, zh-TW and zh-CN differ from en, and a test reads them |

UI checklist item 5 is n/a until DESIGN-DOC-01 locks. The implementation brief still names `.agents/skills/impeccable` and `.agents/skills/emil-design-eng`. The worker reads them before editing the two screens. The new blocks copy the existing loading and error boxes (`platform-dashboard.tsx:515-534`, `office-screen.tsx:326-344`). No new icon. No new motion.

## 10. Risks, decisions for Keith and follow-ups

| Risk | Handling |
|---|---|
| A signed scope map that walked every definition would start signing builder, Product Strategy, and Technology Advisor | `KNOWLEDGE_ROLE_SCOPES` stays `collaborationRoleKnowledgeScopes()`, which skips empty lists. The spec still expects only chief-of-staff |
| Tool-profile lookup changes a role that is not in the registry | Misses return `read`, which is today's else branch. `user` is covered by a test |
| Frontend rejects a fifth public agent | The parser does not pin the four ids. The gateway spec does |
| Failure mode hides the Chief desk and moves that run onto the Team desk | The error sentence says only Builder is shown. Decision 1 |
| Status is outside the hash | Intentional. A capability edit changes instructions, tool profile, scopes, model sentinel, or team role, and the pinned hex moves |
| `KNOWLEDGE_SCOPES` stays a second list | The spec fails if it drifts from the registry. The literal stays so the worker parser keeps matching. Decision 3 |
| In-flight collaboration jobs | The start path and the instruction strings are unchanged, so a job built before or after this change carries the same prompt |

### Decisions for Keith

1. **Use the Builder-only fallback when the fetch fails. Recommend yes.** A 404, a network error, a bad body, or an empty list shows the error copy and the Builder station only. The four-agent public stub would be a second copy of the registry, which is what this task removes. Deploy the gateway first so a normal release does not hit the 404. Rollback of the gateway alone does hit it, and the Chief, Product Strategy, and Technology Advisor stations stay hidden until retry succeeds.

2. **Guard the route with `SessionCookieGuard` only. Recommend yes.** Any logged-in session can read the public fields. Do not also require `harnessEntitled`. That flag gates Knowledge and collaboration today; it does not gate the command-center stations. An API key without a session cookie is 401.

3. **Keep the `KNOWLEDGE_SCOPES` literal and do not edit ai-service. Recommend yes.** The Knowledge page stays on `GET /api/knowledge/scopes`. The new spec proves the literal equals the registry. Editing `services/ai-service/src/worker/knowledge-scopes.spec.ts` and deriving the array would need the AI-SERVICE mutex, which this lane does not hold.

### Follow-ups

| Follow-up | Disposition |
|---|---|
| Record definition id, version, and the model actually used on each run | Superseded by RSI-00 stage S1, already held on that umbrella |
| ARCHITECTURE.md 13.1 and 13.5 still call the registry a frontend constant | Superseded by GOV-ARCH-SYNC-01. The control plane adds one Holds line when it records this document |
| `npm test` still skips these frontend directories | Superseded by FE-TEST-COVERAGE-01, already recorded by BIZ-02 |
| Copy the unused model profiles and tool-permission objects onto the server | Dropped. The start route does not read them, and the screens do not render them |
| Point the Knowledge page at `GET /api/system-agents` | Dropped. The page already loads `GET /api/knowledge/scopes` |
| Store versions in a table | Dropped. This task does not store them |
| Give a role a model other than the server selection | Dropped until a later task has a role that needs one. `modelChoice` stays `server`, so that edit changes the hash |
| Change the ai-service scope parser | Dropped with Decision 3 |
| Show lead, writer, and reviewer as stations | Dropped. They are team roles. The public list stays the four current stations |

`FOLLOWUPS: 0 registered / 3 superseded / 6 dropped / 0 undisposed`

---

**Files read**

- `TASKS.md` current board (Lane 1 AGENT-DEFS-01)
- `TASKS_BACKLOG_FULL.md` (RSI-00, AGENT-DEFS-01)
- `ARCHITECTURE.md` sections 13.1, 13.2, 13.4, 13.5
- `docs/KNOW-02-STAGE-START.md`
- `docs/BIZ-01-CHECKPOINT.md`, `docs/BIZ-02-CHECKPOINT.md`, `docs/PROVIDER-LIMIT-MSG-01-CHECKPOINT.md`
- `frontend/lib/agent-platform/agent-registry.ts`, `agent-registry.test.ts`
- `frontend/lib/office/office.logic.ts`, `office.logic.test.ts` (attribution and badge sections)
- `frontend/components/office/office-screen.tsx`, `office-screen.test.tsx` (header and copy fixture)
- `frontend/components/platform/platform-dashboard.tsx`, `platform-dashboard.test.ts` (cited tests), `agent-station-card.tsx`, `agent-detail-panel.tsx`
- `frontend/components/knowledge/knowledge-screen.tsx`, `knowledge-screen.test.tsx` (scope-label test), `knowledge-api.ts`
- `frontend/hooks/useUserAgents.ts`, `useOfficeRuns.ts`
- `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` (agents, platform, office, knowledge keys cited)
- `frontend/package.json`, `frontend/next.config.js`
- `services/api-gateway/src/orchestration/collaboration-teams.ts`, `collaboration-teams.spec.ts`, `collaboration-team.ts`, `collaboration-citations.ts`, `collaboration-tool-profile.ts`, `collaboration.controller.ts`, `orchestration.contracts.ts`, `orchestration.module.ts`, `internal-collaboration.controller.ts`
- `services/api-gateway/src/knowledge/knowledge-scopes.ts`, `knowledge-scopes.spec.ts`, `knowledge.controller.ts`, `knowledge.controller.spec.ts` (scopes cases), `knowledge.module.ts`, `knowledge-content.ts` (hash), `dto/knowledge-document.dto.ts` (import only)
- `services/api-gateway/src/user-agent/user-agent.controller.ts`, `user-agent.module.ts`, `__tests__/user-agent.controller.spec.ts` (guard setup)
- `services/api-gateway/src/auth/session-cookie.guard.ts`, `session-or-api-key.guard.ts`
- `services/api-gateway/src/app.module.ts`, `main.ts`, `guards/internal-service-auth.guard.ts`
- `services/api-gateway/src/billing/billing-read.controller.ts` (cache header)
- `services/ai-service/src/worker/knowledge-scopes.ts`, `knowledge-scopes.spec.ts`

## Control-plane review and Keith's decisions

Draft by Cursor CLI read-only, requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 0511f56a-1cd5-4b8d-85f4-ab391c86cf08. Reviewed by the control plane on 2026-11-07 against the code: collaboration-tool-profile.ts (writer write, reviewer review, everything else read), the gateway spec that parses frontend/lib/agent-platform/agent-registry.ts, the ai-service spec that parses the gateway KNOWLEDGE_SCOPES literal, and the three frontend readers of listAgents and getAgentById (office-screen.tsx, office.logic.ts, platform-dashboard.tsx) are as the draft states. This section is binding and overrides the sections above where they differ.

Correction: section 9 says UI checklist item 5 is n/a until DESIGN-DOC-01 locks. DESIGN-DOC-01 is COMPLETE AND LOCKED (2026-11-06), so DESIGN.md applies. The new loading and error boxes copy the existing user-agent and office alert treatments, which follow DESIGN.md; the checkpoint reports item 5 as met.

Keith's decisions (2026-11-07), all three as recommended:

1. Builder-only fallback when the list cannot be loaded: error copy with Retry and the Builder station only; no built-in copy of the four stations. Deploy the gateway before the frontend.
2. GET /api/system-agents uses SessionCookieGuard only; no harnessEntitled check.
3. The KNOWLEDGE_SCOPES literal stays; a gateway spec ties it to the registry; ai-service is not edited.

Write set after this stage-start (narrowed from the admission): services/api-gateway/src/system-agents/ (new), services/api-gateway/src/app.module.ts (one module import), services/api-gateway/src/orchestration/collaboration-teams.ts and collaboration-teams.spec.ts, services/api-gateway/src/orchestration/collaboration-tool-profile.ts, services/api-gateway/src/knowledge/knowledge-scopes.ts (comment only) and knowledge-scopes.spec.ts, frontend/lib/agent-platform/, frontend/lib/office/office.logic.ts and office.logic.test.ts, frontend/components/office/office-screen.tsx and office-screen.test.tsx, frontend/components/platform/platform-dashboard.tsx and platform-dashboard.test.ts, frontend/components/knowledge/knowledge-screen.test.tsx, frontend/messages/en.json, zh-TW.json, zh-CN.json, docs/AGENT-DEFS-01-CHECKPOINT.md.

Follow-ups: the three superseded items stay with RSI-00 stage S1, GOV-ARCH-SYNC-01 and FE-TEST-COVERAGE-01; the six dropped items are recorded in the backlog's Dropped follow-ups list (Keith accepted the draft on 2026-11-07).

FOLLOWUPS: 0 registered / 3 superseded / 6 dropped / 0 undisposed
