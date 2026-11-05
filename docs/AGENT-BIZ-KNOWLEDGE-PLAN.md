# GOV-BIZ-KNOWLEDGE-PLAN-01 — Knowledge base and business agents

**Status:** approved by Keith on 2026-11-05 with the two control-plane corrections in the reviewer notes. Registrations in docs/GOV-BIZ-KNOWLEDGE-PLAN-01-CHECKPOINT.md.

**Task:** GOV-BIZ-KNOWLEDGE-PLAN-01 (TASKS_BACKLOG_FULL.md lines 84677-84699). Design only; nothing here admits or schedules work. AGENT-KNOWLEDGE-01 and AGENT-COLLAB-BIZ-01 stay APPROVED_FUTURE and NOT_READY until Keith approves (backlog lines 84231, 84258). Drafted read-only by Fable 5.1; every code claim is cited for the control plane's check.

## 1. Summary and recommendation

Keith decided on 2026-11-05 that business agents stay a goal (backlog line 84237). The 2026-07 plans said knowledge must come before business collaboration (knowledge plan line 25; collaboration plan lines 36-44), and the Option A decision made a read-only Chief of Staff over a knowledge folder the first business slice (GOV-COLLAB-PLAN-01-DECISION.md line 71; backlog line 84236).

**Recommendation.** Build the smallest knowledge base the Chief of Staff needs, in the storage the platform already trusts, and read it through the Harness the coding team already uses:

- Knowledge = owner-scoped markdown/text documents in PostgreSQL, assigned to the scope IDs the agent registry already declares (`agent-registry.ts` lines 148-155, 172-179). No new service, no vectors, no summaries in the first slice.
- Agents read it with two read-only Harness tools (`search_knowledge`, `read_knowledge`) registered beside `search_workspace` for signed read-profile jobs that carry knowledge scopes.
- Business answers carry verified citations; an answer with none is shown as unsourced (collaboration plan lines 811-819).
- The Chief of Staff is a second server-owned team constant of one read-only role, started from the existing Team page, approved through the existing gate, shown in the office on the registry desk it already has (vacant today, `office.logic.ts` lines 464-467).
- No work objects until an external action exists.

Four knowledge slices and two business slices, each S-M. First knowledge slice: **KNOW-01**. First business slice: **BIZ-01**.

## 2. What exists and what does not

| Capability | State | Where |
|---|---|---|
| Knowledge scope IDs and `shared`/`specialist` types on every system agent | Exists (static, frontend only) | `frontend/lib/agent-platform/agent-registry.ts` lines 31-36, 88, 148-155, 172-179, 196-203, 220-227 |
| Chief of Staff manifest, `coming_soon`, `blockedTools: ['*']` | Exists as placeholder | `agent-registry.ts` lines 162-184, 127-133; `en.json` lines 497-501 |
| Knowledge credit categories and plan entitlements (placeholders, unused) | Exists | `credit-rates.config.ts` lines 32-43; `plan-definitions.config.ts` lines 28-32, 55-59; `user-entitlement.ts` lines 28-32 |
| Fixed lead/writer/reviewer team; instructions server-owned; team not taken from the body | Exists | `collaboration-team.ts` lines 14-30; `collaboration.controller.ts` lines 110, 159-160 |
| Approval gate, approve/reject login routes, `harnessEntitled` gate, owned session with a project required | Exists | `collaboration.controller.ts` lines 104-111, 129-136, 227, 251, 282 |
| Signed read/review/write tool profile; non-writer/reviewer targets get `read` + `harnessReadOnly` | Exists | `collaboration-tool-profile.ts` lines 44-73; `job.types.ts` lines 72, 78 |
| Worker registers tools per signed profile; read-only jobs get read_file, list_files, search_workspace only | Exists | `worker.processor.ts` lines 1795-1920 |
| Harness tool registry (8 tool IDs, typed) and gateway internal workspace routes the tools call | Exists | `tool-registry.ts` lines 20-328; `tool-registry.contracts.ts` lines 7-15; `api-gateway-http.client.ts` lines 142, 179, 212 |
| Agent brief lists own and other agents' instructions; hand-off tag parsed from the answer; agent names lowercase/digits/hyphen ≤40 | Exists (pattern to reuse for citations) | `handoff-request.ts` lines 37-50, 112-143, 155-209 |
| Referral result is plain text (`summary`, `outputFiles`) | Exists; no sources field | `orchestration.contracts.ts` lines 194-204 |
| Persisted user agents (name, role, description, status, soft delete; owner-scoped CRUD) | Exists | `user-agent.entity.ts` lines 17-53; `user-agent.controller.ts` lines 43-89 |
| File upload path (multipart `archive`) on the gateway | Exists (project import) | `session.controller.ts` lines 433-448 |
| Workspace snapshots as per-user JSON files under `snapshot-store/` | Exists | `snapshot-persistence.service.ts` lines 50-54, 215-231; ARCHITECTURE.md line 541 |
| PostgreSQL is the authoritative store for business state; TypeORM migrations | Exists | ARCHITECTURE.md lines 519-523 |
| Office desks: one per registry agent (vacant if coming soon), per user agent, one Team desk | Exists | `office.logic.ts` lines 35, 462-507 |
| Knowledge storage, upload, scope registry on the server, knowledge tools, summaries, citations, source links | **Does not exist** | ARCHITECTURE.md lines 987, 1033; PRD.md lines 478-479, 606-608 |
| Functional Chief of Staff, Product Strategy, Technology Advisor, Legal Advisor | **Does not exist** | PRD.md lines 282-288, 600-603; ARCHITECTURE.md line 982 |
| Work objects, source links, referral/approval rules in use | **Does not exist** (`referralRules`/`approvalRules` empty) | `agent-registry.ts` lines 157-158, 181-182; decision doc section 3 |
| Organization/tenant model | **Does not exist** (assumption: only `users`; ARCHITECTURE.md persistence table lines 531-548 lists no org table) | — |

## 3. Knowledge base design

**Stored.** One table `knowledge_documents`: id, user_id, scope_id, title, content (text, normalized markdown), content_hash, byte_size, created_at, updated_at, deleted_at (soft delete like `user_agents`). Markdown and plain text only in the first slice (knowledge plan lines 222-229, "Initial"). Summaries are a later column/table (section 6, KNOW-04). No key facts, chunks or embeddings now.

**Scopes.** A server-side static scope registry (`services/api-gateway/src/knowledge/knowledge-scopes.ts`) with the ten IDs already in the frontend manifests and, per scope, type and the agent IDs allowed to read it (knowledge plan lines 186-206, 573-575). "Shared" scopes are readable by every business role; a specialist scope by its named agent only. Project scope: not in the first slices — knowledge is company context, not project context (decision 2 in section 7). Every document has exactly one scope (knowledge plan line 210).

**Where.** PostgreSQL via a TypeORM migration. Reasons: it is the declared store for business data (ARCHITECTURE.md line 519); owner scoping, soft delete and listing are query-level, unlike the unindexed JSON `snapshot-store/`; documents are text and small (limits below); and a project workspace folder would tie knowledge to a running session and one project. No new service.

**Upload and refresh.** Login routes `POST/GET/DELETE /api/knowledge/documents` under `SessionOrApiKeyAuthGuard`, gated by `harnessEntitled` like the Team page (`collaboration.controller.ts` line 282) while only Keith uses it. Upload by paste or `.md`/`.txt` file (multipart as in `session.controller.ts` line 433). Refresh = re-upload with the same title in the same scope: same hash → no-op, else content replaced, id kept, `updated_at` set (knowledge plan lines 208-212 phase 1 manual). No scheduled refresh.

**How agents read it.** Two read-only Harness tools, registered in `worker.processor.ts` beside `search_workspace` (line 1795) only when the signed job carries a non-empty `knowledgeScopes` list: `search_knowledge` (plain-text, case-insensitive, up to 20 hits with document id, title, scope, heading and a preview, truncated flag — the `search_workspace` contract, `tool-registry.ts` lines 298-327) and `read_knowledge` (one document or one heading section, capped by `maxToolResultBytes`). They call new internal routes `/api/internal/knowledge/search` and `/read` through `ApiGatewayHttpClient`, which check the job's user id and scope list. The gateway sets `knowledgeScopes` on the pending job from the role's registry entry; the browser cannot set it (same rule as the tool profile, `collaboration-tool-profile.ts` lines 6-9). Prompt-pack injection is not used in the first slices: the tool loop, byte caps and audit pattern already exist, and summaries do not. Assumption: adding one optional signed field to `job.types.ts` is the only shared-contract change; it must be frozen before KNOW-02 and BIZ-01 run in parallel.

**Citations in answers.** The role's instructions require `[source: <documentId>#<heading>]` after each claim drawn from a document and the sentence "No source" for claims without one. After the answer, the gateway parses the markers (pattern of `parseHandoffRequest`, `handoff-request.ts` lines 155-209), keeps only markers whose document exists in the run owner's allowed scopes, and stores `sources: {documentId, title, scopeId, heading}[]` and `unsourced: boolean` on `ReferralResult`. Invalid markers are dropped and counted. The Team page shows the list and an "Unsourced" label when a business role's answer has no valid source (collaboration plan lines 817-819, 833-840).

**Permissions.** Owner = `user_id` of the signed-in user; the collaboration run owner must equal the document owner. Agents never write, delete or self-assign scopes (knowledge plan lines 212-213). Internal routes keep the internal-key guard and do not accept a user id from the model: the worker passes the job's user id.

**Limits (assumption, tune at stage-start).** 200 KB per document, 50 documents and 4 MB per account, 20 search hits, section reads capped at `maxToolResultBytes`. Uploads consume no credits in the first slice; summaries later consume `knowledge_summarization` (section 7, decision 5).

## 4. Business agents design

**First agent: a read-only Chief of Staff.** One role, name `chief-of-staff` (valid per `handoff-request.ts` lines 37-50), in a second server-owned constant `CHIEF_OF_STAFF_TEAM` next to `COLLABORATION_TEAM`. Instructions (server-owned, ≤4000 chars, `handoff-request.ts` line 7): answer the owner's question from the knowledge documents, cite every document-based claim, mark the rest "No source", give no contract, financial or legal advice without a source, never propose sending anything. Scopes: the five shared scopes plus `contract-templates` (`agent-registry.ts` lines 172-179). No work objects, no hand-offs (team of one), no external actions.

**Reuse.** The start route gets a `team` field restricted to `coding | chief-of-staff`; instructions, model and provider stay server-owned (`collaboration.controller.ts` line 110 still true: the body names a constant, it does not supply instructions). The run still needs an owned usable session with a project (lines 129-136); accept that for now (decision 6). The hand-off is created exactly as today (lines 147-161) with `fileAccess: true`, so the role gets the `read` profile and `harnessReadOnly` (`collaboration-tool-profile.ts` lines 62-68) plus the knowledge tools from KNOW-02. Approval, reject, listing, owner checks, spend and credit checks, sweep and expiry are untouched. The Team page adds a team picker and shows sources; one approval flow (RPG-OFFICE-01-PLAN.md line 26).

**What a business answer must cite.** Any statement about strategy, goals, finance, policy, contracts or legal risk must carry a verified source marker; otherwise the result is `unsourced: true` and the page says so (collaboration plan lines 833-840; knowledge plan lines 874-878). The run is not refused; the owner is warned.

**Later agents.** Product Strategy needs `market-data` documents; Technology Advisor needs `tech-landscape` plus the existing project read tools (its scopes: `agent-registry.ts` lines 196-203, 220-227). Both join an `advisors` team constant (Chief of Staff, Product Strategy, Technology Advisor; 3 ≤ the 4-agent limit, decision doc section 2) where the Chief of Staff may hand off questions with the existing tag and gate. Legal Advisor needs a registry entry, i18n keys, a `legal-contracts` scope and a PRD change (PRD.md line 288: not in the registry).

**Work objects.** Only when an agent output must outlive a run and be acted on by Keith — a reply draft to send, a decision to record. That is the contract scenario (collaboration plan lines 765-786), which also needs an email trigger and an external send, both FUTURE (PRD.md line 483). Register nothing now; the remainder stays in AGENT-COLLAB-BIZ-01's Holds with the readiness condition in section 9.

## 5. In the office

The office already builds a desk per registry agent and marks coming-soon agents vacant (`office.logic.ts` lines 462-467). BIZ-02 sets the Chief of Staff manifest to `active` (requires the PRD change in section 7), attributes collaboration runs whose `builderProfileId` is `chief-of-staff` to `registry:chief-of-staff` instead of the Team desk, and adds a knowledge badge (document count for the role's scopes from `GET /api/knowledge/documents`) to that desk and its panel. Clicking "Open" goes to the Team page or the run's page; the office gains no approve, reject or upload action (plan line 26; OFFICE-05 row, lines 155-158). Later roles get their own registry desks the same way; OFFICE-03 figure variants apply unchanged.

## 6. Slices in order

| Slice | Content | Size | Depends on | Write scope (repository paths) | Mutexes | Evidence |
|---|---|---|---|---|---|---|
| **KNOW-01** Knowledge store and page (first knowledge slice) | Migration and entity `knowledge_documents`; server scope registry; login routes list/upload/replace/delete with limits; page `frontend/app/[locale]/knowledge/` and `frontend/components/knowledge/`; link from the platform header; en/zh-TW/zh-CN | M | none | services/api-gateway/src/knowledge/, services/api-gateway/src/entities/, services/api-gateway/src/migrations/, services/api-gateway/src/app.module.ts, frontend/app/ (knowledge route directory), frontend/components/knowledge/, frontend/components/platform/ (one link), frontend/messages/ | GATEWAY, MIGRATION, FRONTEND, I18N | LOCAL-TESTS |
| **KNOW-02** Knowledge tools in Harness | Tool definitions `search_knowledge`, `read_knowledge`; handlers; worker registration for read-profile jobs with `knowledgeScopes`; internal routes; optional signed `knowledgeScopes` job field; gateway sets it from the scope registry | M | KNOW-01 LOCKED; freeze `job.types.ts` field | services/ai-service/src/agent-harness/tools/, services/ai-service/src/worker/worker.processor.ts, services/ai-service/src/queue/job.types.ts, services/ai-service/src/clients/api-gateway-http.client.ts, services/api-gateway/src/knowledge/ (internal controller), services/api-gateway/src/orchestration/ (job field only) | AI-SERVICE, GATEWAY | LOCAL-TESTS |
| **KNOW-03** Citations | Marker grammar, verification, `sources` and `unsourced` on the result, Team page display, i18n | S-M | KNOW-01 LOCKED | services/api-gateway/src/orchestration/, frontend/components/collaboration/, frontend/messages/ | GATEWAY, FRONTEND, I18N | LOCAL-TESTS |
| **BIZ-01** Chief of Staff team (first business-agent slice) | `CHIEF_OF_STAFF_TEAM`; `team` field on the start route; `knowledgeScopes` on the job; Team page team picker; i18n | M | KNOW-02, KNOW-03 LOCKED | services/api-gateway/src/orchestration/, frontend/components/collaboration/, frontend/messages/ | GATEWAY, FRONTEND, I18N | LOCAL-TESTS |
| **BIZ-LIVE-01** Live check | Deploy; Keith uploads 3 documents and asks the Chief of Staff; citations verified; one unsourced answer labelled; flags off after | S | BIZ-01 LOCKED | records only; host state | STAGING, PROVIDER-LIVE, CREDIT, ENV | PROVIDER-LIVE |
| **BIZ-02** Office desk and badge | Chief of Staff manifest active; run attribution to its desk; knowledge badge; i18n; PRD edit by the control plane | S-M | BIZ-LIVE-01; OFFICE-05 preferred first | frontend/lib/agent-platform/agent-registry.ts, frontend/lib/office/, frontend/components/office/, frontend/messages/ | FRONTEND, I18N | LOCAL-TESTS |
| **KNOW-04** Summaries | One model call per upload or replace; summary stored and shown; `search_knowledge` returns it; charged `knowledge_summarization` | M | KNOW-01 LOCKED; Keith on charging | services/api-gateway/src/knowledge/, services/api-gateway/src/billing/ (deduction call), frontend/components/knowledge/, frontend/messages/ | GATEWAY, CREDIT, FRONTEND, I18N | PROVIDER-LIVE |
| **BIZ-03** Advisors team | Product Strategy and Technology Advisor roles; `advisors` team; registry active; PRD edit | M | BIZ-02 LOCKED; documents in `market-data`, `tech-landscape` | as BIZ-01 plus agent-registry.ts | GATEWAY, FRONTEND, I18N | LOCAL-TESTS then live |

Sizes are estimates from write scope, not stage-start designs (assumption). KNOW-02 and KNOW-03 are pairwise safe (AI-SERVICE/GATEWAY-internal-route vs GATEWAY/FRONTEND) only if KNOW-02's gateway part is reduced to the internal controller and KNOW-03 does not touch `job.types.ts`; otherwise run them serially.

## 7. Decisions for Keith (recommendation first)

1. **Where documents live.** PostgreSQL text (recommended); or per-user files under `snapshot-store/`; or a folder in each project workspace. ARCHITECTURE change: add `knowledge_documents` to the persistence table (lines 531-548) and move "Knowledge base runtime" (line 987) to CURRENT (GATED) when proven.
2. **Per account or per project.** Per account (recommended): company knowledge is not project knowledge, and a run already binds to a project for file tools. Per project later only if a Technology Advisor needs project-specific notes.
3. **First agent.** Chief of Staff (recommended; already decided in Option A). Alternative: Technology Advisor first, because it also uses the existing file tools.
4. **Tools or prompt pack.** Harness tools (recommended); prompt pack when summaries exist (KNOW-04) if tool runs prove costly.
5. **Charging.** No charge for storage or upload; charge summaries at `knowledge_summarization` when KNOW-04 lands; plan entitlements (`maxKnowledgeItemsPerMonth`, free = 0) enforced only in ACCESS-READY-01. Assumption: Keith's account is on the free plan definition, so enforcing entitlements now would block him.
6. **Project requirement for business runs.** Accept (recommended) that a Chief of Staff run starts from an open project session; a project-less run is a larger orchestration change, registered only if the requirement proves awkward live.
7. **Team selection.** A `team` enum on the existing start route (recommended) rather than a second route.
8. **PRD changes (proposed only, by the control plane at BIZ-02):** PRD.md system-agents table line 284 and section 11 lines 600, 606-607 — Chief of Staff and knowledge uploads move from APPROVED FUTURE to GATED once BIZ-LIVE-01 passes; section 8 lines 477-479 amended accordingly. Business agents stay off the private-beta promise.

## 8. Risks

- **Invented citations.** The model may cite documents that do not exist; verification drops them and the page shows "Unsourced". Residual risk: a real document cited for a claim it does not support; mitigated by headings in markers and the owner reading the source.
- **Prompt injection from uploaded text.** Documents are owner-supplied and read-only tools cannot act; the approval gate still precedes every hand-off. Instructions tell the model to treat document text as data.
- **Token cost.** Agents re-read files at ~19k tokens per small file (decision doc line 59); knowledge reads add to that. Mitigation: 20-hit search, section reads, summaries later.
- **Scope ID drift.** Frontend manifests and the server registry both list scope IDs; a unit test should compare them (assumption: no shared package exists between frontend and gateway).
- **Status creep.** Making the Chief of Staff manifest `active` without the PRD edit would contradict PRD.md lines 13 and 284.
- **Shared contract.** The `knowledgeScopes` job field touches `job.types.ts`, which both the gateway and the worker read; freeze before parallel lanes.
- **Single-user evidence.** All live proof is Keith's own account; multi-owner isolation is unit-tested only until ACCESS-READY-01.

## 9. Follow-up dispositions

| Follow-up | Disposition |
|---|---|
| KNOW-01 store and page | Register as child of AGENT-KNOWLEDGE-01, READY when Keith approves this plan; Keith names saturationClass |
| KNOW-02 knowledge tools | Register, NOT_READY; ready when KNOW-01 is LOCKED and `job.types.ts` field frozen |
| KNOW-03 citations | Register, NOT_READY; ready when KNOW-01 is LOCKED |
| KNOW-04 summaries | Register, NOT_READY; ready when Keith decides charging (decision 5) and KNOW-01 is LOCKED |
| BIZ-01 Chief of Staff team | Register as child of AGENT-COLLAB-BIZ-01, NOT_READY; ready when KNOW-02 and KNOW-03 are LOCKED |
| BIZ-LIVE-01 live check | Register, NOT_READY; ready when BIZ-01 is LOCKED and a staging window is open |
| BIZ-02 office desk, badge, PRD edit | Register, NOT_READY; ready when BIZ-LIVE-01 passes; OFFICE-05 preferred first |
| BIZ-03 advisors team | Register, NOT_READY; ready when BIZ-02 is LOCKED and Keith has uploaded documents to both specialist scopes |
| Legal Advisor role, scope and registry entry | Superseded by AGENT-COLLAB-BIZ-01 remainder; ready only after BIZ-03 and a PRD change Keith approves |
| Work objects, contract scenario, approval categories | Superseded by AGENT-COLLAB-BIZ-01 remainder; ready when Keith approves a first external action (send email) |
| Project-less business runs | Register, NOT_READY; ready only if BIZ-LIVE-01 finds the project requirement awkward (Keith decides) |
| Scope-ID parity test between frontend and gateway | Superseded by KNOW-01 acceptance criterion |
| Plan-entitlement enforcement for knowledge items | Superseded by ACCESS-READY-01 item 1 (charging and per-user limits) |
| Prompt-pack injection, key facts, chunking, vectors, connectors, scheduled refresh, sensitive-scope review (knowledge plan sections 11-13, 18, 23, 25) | Drop for now — not needed by a read-only Chief of Staff; the locked plan keeps them as reference; re-propose with evidence |
| Knowledge per project | Drop — decision 2; re-propose if a Technology Advisor needs it |

FOLLOWUPS proposed: 9 register / 4 superseded / 2 drop / 0 undisposed.

---

## Reviewer notes (control plane, 2026-11-05)

Drafted by Fable 5.1 (claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High") through Cursor in read-only mode. Checked against the code and found correct: the ten scope IDs and the Chief of Staff placeholder (coming_soon, blockedTools ['*']) in agent-registry.ts; vacant desks for coming-soon agents in office.logic.ts; team, provider and model not taken from the request body, the owned-project-session requirement and the harnessEntitled check in collaboration.controller.ts; the read profile with harnessReadOnly in collaboration-tool-profile.ts; the worker registering search_workspace for read jobs; the unused knowledge credit categories and maxKnowledgeItemsPerMonth 0 on the free plan; the multipart archive upload on the session import route; PostgreSQL as the business store and "Knowledge base runtime" FUTURE / PLANNED in ARCHITECTURE.md; the 4,000-character instruction and 40-character name limits in handoff-request.ts.

**Correction 1 — the frozen contract.** services/ai-service/src/queue/job.types.ts is one of the three paths of the frozen shared contract HARNESS_ENTITLEMENT_PROOF_V1 (sidecar sharedContracts). A signed knowledgeScopes field changes that contract. KNOW-02 must follow the shared-contract change protocol: declare HARNESS_ENTITLEMENT_PROOF_V1 in mutatesSharedContractIds, run with no other lane depending on the contract, and re-freeze after. So KNOW-02 runs alone, not beside KNOW-03 or BIZ-01.

**Correction 2 — a stale ARCHITECTURE row.** ARCHITECTURE.md near line 985 still lists "Durable orchestration / persisted referrals / shared-project writes" as FUTURE, but COLLAB-INTERNAL-01 and later tasks built persisted collaboration runs and hand-offs. Proposed disposition: register a small governance documentation correction (ARCHITECTURE sync for the built collaboration and office), ready when Keith chooses it.

The control plane agrees with the recommendation and the slice order, with KNOW-02 serial as above.

---

**Files read**

- TASKS_BACKLOG_FULL.md: GOV-BIZ-KNOWLEDGE-PLAN-01, AGENT-COLLAB-BIZ-01, AGENT-KNOWLEDGE-01, RPG-OFFICE-01, ACCESS-READY-01, COLLAB-AUDIT-01, COLLAB-EDIT-01, COLLAB-CANCEL-01 bodies
- docs/AGENT-KNOWLEDGE-00-KNOWLEDGE-ARCHITECTURE-PLAN.md sections 1-2, 5, 7-8, 12-13, 16, 19-22, 25-28; docs/AGENT-KNOWLEDGE-00-CHECKPOINT.md
- docs/AGENT-COLLAB-00-COLLABORATION-PROTOCOL-PLAN.md sections 2, 11, 19, 25-26, 28, 33.5; docs/GOV-COLLAB-PLAN-01-DECISION.md; docs/RPG-OFFICE-01-PLAN.md sections 1, 1a, 7, 8
- PRD.md sections 1, 2, 3.I, 8, 11; ARCHITECTURE.md Authority Notice, CURRENT vs PLANNED, sections 7, 12, 13
- services/api-gateway/src/orchestration/: collaboration-team.ts, collaboration-tool-profile.ts, collaboration.controller.ts (lines 100-190, 276-305), orchestration.contracts.ts (lines 150-204), handoff-request.ts (lines 1-209), orchestration.service.ts (lines 2440-2520, greps)
- services/api-gateway/src/: credit-ledger/index.ts, credit-ledger/config/credit-rates.config.ts, credit-ledger/config/plan-definitions.config.ts (lines 1-65), credit-ledger/types/user-entitlement.ts, entities/user-agent.entity.ts, user-agent/user-agent.controller.ts, snapshots/snapshot-persistence.service.ts; greps for knowledge, user agent, upload, harnessEntitled, snapshot
- services/ai-service/src/: agent-harness/tools/tool-registry.ts, tool-registry.contracts.ts, worker/worker.processor.ts (lines 1795-1925), greps on job.types.ts, api-gateway-http.client.ts, file-tool-handlers.ts
- frontend/lib/agent-platform/agent-registry.ts (lines 25-240); frontend/lib/office/office.logic.ts (lines 455-520); frontend/components/office/office-screen.tsx (grep); frontend/messages/en.json (lines 490-512)

**Assumptions**

- No organization or tenant table exists; "tenant" in the 2026-07 plan maps to the user account today. Based on the ARCHITECTURE persistence table and the `user_agents` entity; I did not list every entity.
- The optional `knowledgeScopes` field on `job.types.ts` is the only shared-contract change needed; I did not read the gateway-side job signing beyond `collaboration-tool-profile.ts` and `orchestration.service.ts` lines 2440-2470.
- Size limits (200 KB, 50 documents, 4 MB, 20 hits) and slice sizes are estimates, not measured.
- Keith's account falls under the `free` plan definition, whose knowledge entitlement is zero; I did not read the entitlement resolution code.
- No shared TypeScript package exists between frontend and gateway for the scope IDs; a parity test is proposed instead.
- `DEFAULT_MAX_AGENTS_PER_COLLABORATION` is 4, taken from the decision document (section 2), not re-read in `orchestration.contracts.ts`.
- KNOW-02 and KNOW-03 pairwise safety depends on the final write sets at admission; the validator decides, not this plan.