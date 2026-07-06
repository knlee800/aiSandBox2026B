# AGENT-KNOWLEDGE-00 — Common Knowledge Base Architecture Plan

**Task ID:** AGENT-KNOWLEDGE-00
**Family:** AGENT KNOWLEDGE / COMMON KNOWLEDGE BASE
**Status:** ACTIVE — planning pass
**Created:** 2026-07-06
**Nature:** PLANNING/GOVERNANCE — documentation only, no implementation
**Authority:** Follows ROADMAP-00, governed by AGENT-PLATFORM-00 master plan

---

## 1. Executive Summary

ainow.biz hosts multiple specialized AI agents that collaborate on real business work. For agents to give coherent, company-aligned advice, they need shared organizational context: company direction, goals, strategy, policies, and meeting history.

This document defines the architecture for a **common knowledge base layer** that provides:

- Shared organizational context accessible to all agents via declared knowledge scopes.
- Per-agent specialist knowledge scopes for domain-specific context.
- Token-efficient consumption: agents consume summaries and key facts by default rather than raw documents.
- Source traceability: every summary and key fact links back to its origin document and section.
- Privacy and access controls: tenant isolation, scope-based access, and separate raw-content permission gates.
- A refresh and scheduling model that begins with manual upload and evolves toward scheduled integration pulls.

This plan comes before Agent Collaboration (AGENT-COLLAB-00) because shared, source-linked knowledge is a prerequisite for meaningful agent collaboration. It comes before Billing (BILLING-READY-00) because knowledge processing costs must be modeled into the credit system.

This document is planning only. No database schema, no vector search implementation, no embeddings, no external connectors, and no Agent Harness changes are included in this task.

---

## 2. Product Context

### 2.1 Platform

ainow.biz is the evolution of the aiSandBox coding sandbox into a general-purpose multi-agent work platform. Governed by `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md`.

### 2.2 Execution Position

This plan follows ROADMAP-00 (`docs/AINOW-EXECUTION-ROADMAP.md`), which establishes:

```
Knowledge (AGENT-KNOWLEDGE-00) → Collaboration (AGENT-COLLAB-00) → Billing (BILLING-READY-00)
```

Knowledge comes before Collaboration. Collaboration depends on shared, source-linked knowledge. Billing readiness comes after both knowledge and collaboration plans are complete.

### 2.3 Agents This Plan Serves

| Agent | Status | Intended Knowledge Use |
|-------|--------|------------------------|
| Builder Agent | ACTIVE | Shared company context + codebase-context specialist scope |
| Chief of Staff Agent | COMING SOON | Shared company context + contract-templates specialist scope |
| Product Strategy Agent | COMING SOON | Shared company context + market-data specialist scope |
| Technology Advisor Agent | COMING SOON | Shared company context + tech-landscape specialist scope |
| Future: Legal Advisor | FUTURE | Shared + legal-contracts specialist scope |
| Future: other agents | FUTURE | Shared + domain-specific specialist scopes |

### 2.4 Registry Anchor

The agent registry (`frontend/lib/agent-platform/agent-registry.ts`) already declares `knowledgeScopes` for all agents using the types `AgentKnowledgeScopeRef` and `AgentKnowledgeScopeType` (`'shared' | 'specialist'`). This plan defines what those scopes mean and how knowledge flows into them.

### 2.5 Harness Anchor

The Agent Harness audit events (`services/ai-service/src/agent-harness/audit/harness-audit-events.ts`) establish the pattern for privacy-conscious structured event recording. Knowledge access audit events may follow the same pattern in future tasks — recording access metadata without recording prompt text, model output, or raw document content.

---

## 3. Goals

1. Define the common knowledge base architecture concept.
2. Define shared vs specialist knowledge scope model.
3. Define the source type model.
4. Define the ingestion pipeline concept.
5. Define markdown normalization requirements.
6. Define summary and key fact extraction requirements.
7. Define the agent consumption model.
8. Define the raw/full content access model.
9. Define privacy and access controls.
10. Define tenant/organization isolation.
11. Define source traceability requirements.
12. Define retention and deletion policy requirements.
13. Define the refresh and scheduling concept.
14. Define relationships to Agent Registry, Agent Collaboration, Agent Harness, Billing, and future integrations.
15. Propose conceptual data object shapes.
16. Record safety and approval requirements.
17. Propose the follow-up implementation roadmap.

---

## 4. Non-Goals

The following are explicitly out of scope for this task:

- No implementation code of any kind.
- No database schema implementation or migration.
- No vector search implementation.
- No embeddings provider selection or implementation.
- No file storage implementation.
- No external connector implementation (Notion, Slack, Gmail, Google Drive, OneDrive).
- No runtime ingestion pipeline.
- No agent collaboration runtime.
- No billing system implementation.
- No Agent Harness behavior changes.
- No frontend UI changes.
- No translation file changes.
- No registration of AGENT-COLLAB-00.
- No registration of BILLING-READY-00.
- No activation of Agent Harness tool loop (`AGENT_HARNESS_ENABLE_TOOL_LOOP=true` must remain as-is).

---

## 5. Core Concepts

| Concept | Definition |
|---------|------------|
| **Knowledge Source** | An origin object representing a real-world document or data stream (a PDF, a markdown file, a meeting note, a future Notion page). It tracks the source type, tenant/org owner, upload metadata, and refresh policy. |
| **Knowledge Document** | A stored unit of knowledge derived from a Knowledge Source. Represents one logical document or document section. |
| **Normalized Markdown Document** | The canonical form of a Knowledge Document after extraction and normalization. All document types are converted to a consistent markdown representation. |
| **Knowledge Summary** | A concise, agent-readable summary of a Normalized Markdown Document or a set of documents within a scope. Summaries reduce token cost for agents by providing compressed, actionable context. |
| **Key Fact** | A structured, discrete piece of information extracted from a document (e.g., "Q1 revenue: $450K", "Three-year goal: 10,000 paying customers by 2028", "Policy: all external integrations require owner approval"). Key facts are individually citable. |
| **Knowledge Scope** | A named grouping of Knowledge Documents that can be assigned to one or more agents via their manifest. Scopes are the unit of access control and manifest-level permission. |
| **Shared Scope** | A Knowledge Scope accessible to multiple agents. Contains company-wide context: reports, goals, strategy, policies, meeting summaries. |
| **Specialist Scope** | A Knowledge Scope restricted to one agent or a small set of agents. Contains domain-specific context: codebase history, contract templates, market research, architecture notes. |
| **Knowledge Pack** | The bundle of summaries, key facts, and source references assembled for a specific agent based on its declared knowledge scopes. The Knowledge Pack is what the agent actually receives at task start. |
| **Source Link** | A structured reference linking a Summary or Key Fact back to its source: document ID, document title, section heading or page number, and source type. Agents must surface Source Links in business-critical recommendations. |
| **Refresh Job** | A scheduled or on-demand task that re-ingests a Knowledge Source, re-normalizes it, and updates Summaries and Key Facts. |
| **Access Policy** | A rule set controlling which agents or users may access a Knowledge Scope, whether raw/full content access is permitted, and under what conditions. |
| **Retention Policy** | A rule set defining how long Knowledge Documents, Summaries, and Key Facts are retained, when they may be deleted, and who may trigger deletion. |

---

## 6. Common Knowledge Base Architecture

### 6.1 Conceptual Flow

```
User/Org → Source Upload or Connection
          ↓
     Source Intake (format detection, metadata capture)
          ↓
     Extraction (parse PDF, text, HTML, markdown)
          ↓
     Markdown Normalization
          ↓
     Chunking / Sectioning
          ↓
     Summary Extraction (per-document, per-scope)
          ↓
     Key Fact Extraction (structured facts)
          ↓
     Source Link Capture (traceability)
          ↓
     Scope Assignment (shared or specialist)
          ↓
     Storage (normalized doc, summary, key facts, source link)
          ↓
     Refresh Scheduling (manual initially; scheduled later)
          ↓
     Agent Manifest Lookup (which scopes does this agent have?)
          ↓
     Knowledge Pack Assembly (summaries + key facts + source links)
          ↓
     Agent Context Injection (token-efficient, scope-filtered)
          ↓
     (On permitted request) Raw/Full Content Access
```

### 6.2 Key Architecture Principles

1. **Summaries/key facts first.** Agents receive compressed representations by default. Raw/full document content is a separate, gated operation.
2. **Scope-filtered.** Agents only receive knowledge from scopes listed in their manifest. No scope leakage.
3. **Tenant-isolated.** Knowledge is always owned by a tenant/organization. Cross-tenant access is not permitted.
4. **Source-traceable.** Every summary and key fact references its source document and section.
5. **Refresh-safe.** Documents are versioned through refresh cycles. Historical states can be referenced by checkpoint.
6. **Privacy-defensive.** Sensitive sources require explicit classification and tighter policies.
7. **Human-in-the-loop for sensitive actions.** Deletions, external connector authorization, and sensitive-scope access require user approval.

---

## 7. Shared vs Specialist Knowledge Scopes

### 7.1 Shared Scopes

Shared scopes are accessible to all or most agents. They carry company-wide context.

| Scope ID | Contents | Primary use |
|----------|----------|-------------|
| `company-monthly-reports` | Monthly business reports, KPIs, revenue summaries | Company health context for all agents |
| `three-year-goals` | Long-term goals, OKRs, strategic targets | Goal alignment for all agents |
| `strategy-docs` | Strategic plans, roadmaps, market positioning | Strategic context for all agents |
| `policies` | Internal policies, approval gates, compliance rules | Behavioral constraints for all agents |
| `meeting-summaries` | Recaps of key meetings, decisions, action items | Recent context and decisions for all agents |

Shared scopes are already declared in all four current agent manifests (builder, chief-of-staff, product-strategy, technology-advisor) in `agent-registry.ts`.

### 7.2 Specialist Scopes

Specialist scopes are restricted to the agent(s) whose manifest declares them. They carry domain-specific context.

| Scope ID | Agent | Contents |
|----------|-------|----------|
| `codebase-context` | Builder Agent | Codebase history, architecture decisions, build/deploy context |
| `contract-templates` | Chief of Staff Agent | Contract templates, legal boilerplate, approval workflows |
| `market-data` | Product Strategy Agent | Market research, competitor landscape, user feedback aggregates |
| `tech-landscape` | Technology Advisor Agent | Technology evaluations, vendor comparisons, architecture proposals |
| `legal-contracts` | Future: Legal Advisor | Contract review history, regulatory notes, compliance findings |

### 7.3 Scope Assignment Rules

- Every Knowledge Document is assigned to exactly one scope at ingestion time.
- Agents may only receive knowledge from scopes listed in their manifest.
- Scope assignments are set by the platform owner/admin, not by agents.
- Agents may not self-assign or override scope access.
- Manifest-declared scopes with no documents yet are valid (empty scope, zero context injected).

---

## 8. Source Type Model

The following source types are supported or planned:

| Source Type | Phase | Notes |
|-------------|-------|-------|
| Markdown (`.md`) | Initial | Direct upload, minimal transformation |
| Plain text (`.txt`) | Initial | Normalize to markdown |
| PDF | Near-term | Extract text, convert to normalized markdown; preserve section headers where detectable |
| HTML | Near-term | Extract text and structure; strip navigation/boilerplate |
| Uploaded documents (DOCX, etc.) | Future | Text extraction via document parser |
| Meeting notes (paste/upload) | Initial | Accept as text or markdown |
| Notion | Future connector | Requires OAuth and Notion API; explicit user authorization |
| Slack | Future connector | Requires OAuth and Slack API; explicit user authorization; channel-specific scope |
| Gmail | Future connector | Requires OAuth and Gmail API; explicit user authorization; sensitive — requires stricter policy |
| Google Drive | Future connector | Requires OAuth and Google Drive API; explicit user authorization |
| OneDrive | Future connector | Requires OAuth and Microsoft Graph API; explicit user authorization |
| Calendar / meeting transcripts | Future connector | Requires OAuth to calendar provider or transcript service |

All source types eventually produce a Normalized Markdown Document. Source type metadata is preserved in the Knowledge Source record for traceability.

---

## 9. Ingestion Pipeline

The ingestion pipeline transforms a raw source into stored, queryable knowledge. Each stage is a discrete step.

### 9.1 Pipeline Stages

| Stage | Description |
|-------|-------------|
| **1. Source Intake** | Accept the upload or connector payload. Record source type, origin URL or upload reference, tenant/org owner, scope assignment, and timestamp. |
| **2. Format Detection** | Detect source format (markdown, PDF, HTML, text) if not declared by uploader. Reject unsupported formats to the review queue. |
| **3. Extraction** | Extract raw text and structural hints (headings, lists, tables) from the source format. For PDF: text extraction preserving page numbers. For HTML: strip boilerplate, preserve content structure. For markdown/text: pass through. |
| **4. Markdown Normalization** | Convert extracted content to a canonical Normalized Markdown Document. Preserve headings, lists, tables. Attach source metadata block (source ID, title, upload date, scope, source type). |
| **5. Chunking / Sectioning** | Split the Normalized Markdown Document into logical chunks (by heading level or paragraph count). Each chunk is independently summarizable and citable. |
| **6. Summary Extraction** | Generate a concise summary of the document and per-scope summary where applicable. Summaries are LLM-generated from normalized content. Summaries must reference source document ID for traceability. |
| **7. Key Fact Extraction** | Extract discrete, structured key facts from the document. Key facts must include: fact text, source document ID, source section or page reference, extraction timestamp. |
| **8. Scope Assignment** | Assign the Knowledge Document to its declared scope. Validate that the scope is a registered scope for the owning tenant. |
| **9. Source Traceability Capture** | Record Source Links for each summary and key fact: source document ID, section/heading, page reference where available, document title, source type, upload date. |
| **10. Storage** | Store: Knowledge Source record, Normalized Markdown Document, Knowledge Summary, Key Facts, Source Links. Raw original file is optionally retained per retention policy. |
| **11. Refresh Scheduling** | Record the refresh policy for this source (manual or scheduled). Queue the first refresh window if scheduled. |
| **12. Error Handling / Review Queue** | Failed extractions, unsupported formats, oversized documents, or low-confidence summaries go to a review queue for human inspection before activation. |

### 9.2 Ingestion Safety

- Documents are not made available to agents until ingestion is fully complete and marked as active.
- Failed ingestions go to the review queue — they are never silently ignored.
- Summaries and key facts generated by LLM are marked as AI-generated and subject to human review for sensitive scopes.
- No automatic external action (webhook, email, write-back) occurs during ingestion without explicit user approval.

---

## 10. Markdown Normalization

### 10.1 Goals of Normalization

The normalization step ensures that regardless of source format, all Knowledge Documents have a consistent, agent-readable structure.

### 10.2 Normalization Rules

- Preserve all heading levels (H1–H4). Do not flatten headings.
- Preserve lists (ordered and unordered).
- Preserve tables where detectable (markdown table format preferred).
- Preserve numbered references and citations where present.
- Strip decorative formatting, headers/footers, page numbers as body text.
- Add a metadata block at the top of every Normalized Markdown Document:
  ```markdown
  <!-- knowledge-source
  id: <source-id>
  title: <document-title>
  scope: <scope-id>
  source-type: <pdf | markdown | text | html | ...>
  upload-date: <ISO 8601>
  tenant: <tenant-id>
  -->
  ```
- Store the normalized document separately from the raw source file. Do not overwrite the raw source.
- Do not mix normalized content from different scopes or different tenants into a single document.

### 10.3 Normalization Quality

- Long documents (> N pages or > M characters — exact limits deferred to AGENT-KNOWLEDGE-02) should be chunked into sections before normalization.
- Each chunk retains the source document ID and section heading so Source Links remain accurate after chunking.
- Normalization quality for PDF and HTML sources should be validated against a human-readable spot-check before the source is marked as active.

---

## 11. Summary and Key Fact Extraction

### 11.1 Default Consumption Mode

Agents should use summaries and key facts by default. Raw document content is not injected into the agent context unless a specific task requires it and the agent has raw-content permission for that scope.

This constraint is primarily a token-cost and context-quality control. A 50-page strategy document injected raw would consume enormous context budget. The same document as a 500-word summary with 20 key facts is vastly more efficient and often more useful.

### 11.2 Summary Requirements

- Summaries are concise: target 200–600 words per document summary (exact limits deferred to AGENT-KNOWLEDGE-03).
- Summaries are scoped to the document's declared scope — no cross-scope content.
- Summaries must include a Source Link block at the end citing the source document ID and title.
- Scope-level rollup summaries may be generated to give agents a single combined summary of all documents in a scope.
- Summaries are AI-generated from the Normalized Markdown Document. They are not the source of truth.
- Sensitive-scope summaries (e.g., legal, HR) require human review before being made available to agents.

### 11.3 Key Fact Requirements

- Key facts are structured: `{ fact: string, category: string, sourceDocumentId: string, sourceSectionRef: string, extractedAt: timestamp }`.
- Key fact categories: goal, metric, decision, policy, action-item, risk, deadline, contact.
- Key facts from meeting summaries should include: decision reached, action items, and responsible parties where recorded.
- Each key fact is individually citable — agents must surface the source reference when they use a key fact in a recommendation.
- Key facts must not mix content from different scopes or tenants.
- Duplicate key facts (same fact extracted from multiple documents) should be deduplicated at scope level with multi-source references preserved.

### 11.4 Action Items and Decisions from Meeting Summaries

Meeting summary documents receive additional extraction attention:
- Extract all explicitly stated decisions.
- Extract all action items (task + assignee + deadline if present).
- Mark each extracted action item or decision with the meeting date and source document reference.

### 11.5 Generated Content is Not Source of Truth

AI-generated summaries and key facts must always link to their source. If an agent or user needs to validate a fact, they must be able to retrieve the source document. Generated content without source links is not permitted.

---

## 12. Agent Consumption Model

### 12.1 What an Agent Receives

When a task begins, the agent receives a **Knowledge Pack** assembled from its declared knowledge scopes. A Knowledge Pack contains:

| Component | Contents |
|-----------|----------|
| Shared company direction summary | A rollup summary covering the agent's declared shared scopes (company-monthly-reports, three-year-goals, strategy-docs, policies, meeting-summaries) |
| Agent-specific scope summaries | Individual summaries for the agent's declared specialist scope(s) |
| Relevant key facts | Key facts from all accessible scopes, optionally filtered by relevance to the current task |
| Source references | Source Links for all summaries and key facts included in the pack |

### 12.2 What an Agent Does Not Receive by Default

- Raw document content (full text of original source files).
- Documents from scopes not declared in the agent's manifest.
- Documents from other tenants.
- Sensitive-scope content without explicit per-task authorization.

### 12.3 Token Efficiency

The Knowledge Pack must fit within the agent's declared `maxTokensPerTurn` budget alongside the user's prompt and system context. Knowledge Pack assembly should respect a knowledge budget (e.g., at most 30–40% of the token budget, with the remainder reserved for the actual task). Exact budget allocation is deferred to AGENT-KNOWLEDGE-03.

### 12.4 Knowledge Pack Versioning

Each Knowledge Pack is assembled from a snapshot of the knowledge base at a specific point in time. The snapshot timestamp and source document versions should be recorded so that the context used for a given agent response can be reconstructed for audit.

---

## 13. Raw / Full Content Access Model

### 13.1 When Raw Access Is Permitted

Raw/full document content may be accessed by an agent only when:

1. The agent's manifest declares permission for raw content access on the relevant scope.
2. The specific task explicitly requires raw content (e.g., contract review, code audit of a specific codebase document).
3. The user or platform owner has authorized the access for the session or task.

### 13.2 Raw Access Controls

- Raw content access permission is separate from summary/key fact access permission.
- An agent may have summary access to a scope without having raw access.
- Raw access for sensitive scopes (legal, HR, financial) requires stricter authorization.
- Raw access events must be audited (access timestamp, agent ID, scope ID, document ID, session ID). Audit records must not include the raw content itself.

### 13.3 Raw Access Rate and Size Limits

- Raw document access should be rate-limited per agent per session.
- Oversized documents may be chunked and served in sections rather than as a single raw payload.
- Exact size and rate limits are deferred to AGENT-KNOWLEDGE-04.

---

## 14. Privacy and Access Control Model

### 14.1 Principles

1. Tenant isolation is absolute. No knowledge from tenant A may ever appear in a knowledge pack for tenant B.
2. Scope isolation: an agent may only access scopes listed in its manifest.
3. Summary/key fact access and raw content access are separate permission layers.
4. Sensitive source classifications exist and require stricter policy.
5. All access is auditable.
6. Users may delete their knowledge documents at any time within their retention policy.

### 14.2 Access Control Layers

| Layer | Description |
|-------|-------------|
| Tenant isolation | Every knowledge object is tenant-scoped. No cross-tenant access at any layer. |
| Scope declaration | Agent manifests declare knowledge scopes. Only declared scopes are accessible. |
| Summary vs raw permission | Summary/key fact access is granted when scope is declared. Raw content access requires additional explicit permission. |
| Sensitive classification | Sources may be classified as sensitive (legal, HR, financial). Sensitive sources require human review before agent access and may require additional user authorization per task. |
| Session authorization | Some raw-content or sensitive-scope accesses may require per-session user authorization. |
| Audit | All knowledge access events are logged with agent ID, scope ID, access type, and timestamp. Raw document content is never included in audit logs. |

### 14.3 Scope Leakage Prevention

- Scope assignment is set at ingestion time and cannot be changed by agents.
- Knowledge Pack assembly filters strictly by declared scopes.
- Summary generation does not cross scope boundaries — a summary for scope A does not include content from scope B even if documents are physically adjacent.
- Raw content retrieval validates scope ownership before serving content.

---

## 15. Tenant / Organization Isolation

### 15.1 Isolation Model

The platform supports multiple tenants (organizations). Each tenant has its own knowledge namespace.

| Property | Requirement |
|----------|-------------|
| Storage isolation | All knowledge objects store `tenantId` and queries always filter by `tenantId`. |
| Scope isolation | Scope IDs are tenant-namespaced internally even if they share the same logical name. |
| Ingestion isolation | No cross-tenant content mixing during normalization, summarization, or key-fact extraction. |
| Agent isolation | Agents operate within a tenant context. An agent run for tenant A cannot access knowledge belonging to tenant B. |
| Audit isolation | Audit logs for tenant A are not accessible to tenant B. |

### 15.2 Multi-User Organizations

Within a single tenant/organization, multiple users may upload knowledge sources. The system must:

- Track which user uploaded each source.
- Allow org admins to manage (view, delete, reassign) all knowledge sources within the org.
- Allow individual users to manage sources they uploaded, subject to org policy.
- Prevent regular users from accessing other users' private sources unless the source is assigned to a shared scope.

---

## 16. Source Traceability

### 16.1 Traceability Requirements

Every summary and key fact must carry a Source Link that enables users and agents to:

1. Identify which source document produced the summary or key fact.
2. Identify which section, heading, or page of the source document the fact came from.
3. Retrieve the original normalized document (or the raw source, subject to retention policy).

### 16.2 Source Link Structure (Conceptual)

```
SourceLink {
  documentId: string          // ID of the KnowledgeDocument
  documentTitle: string       // Human-readable title of the document
  scopeId: string             // Scope the document belongs to
  sectionRef: string | null   // Heading, section title, or page number
  sourceType: string          // pdf | markdown | text | html | notion | ...
  uploadDate: string          // ISO 8601
  tenantId: string
}
```

### 16.3 Agent Use of Source Links

- Agents must surface source links when they make business-critical recommendations (e.g., financial decisions, strategic pivots, policy interpretations).
- Agents should surface source links when users ask "where did you get that?" or similar.
- Future UI: a source lineage inspector that lets users click through from an agent recommendation to the underlying source document.

### 16.4 Non-Traceability Risk

AI-generated content without source traceability is a trust and auditability risk. Summaries and key facts without Source Links must not be provided to agents or users.

---

## 17. Retention and Deletion Policy

### 17.1 Retention Requirements

| Object | Default Retention |
|--------|------------------|
| Raw source file | Optional. May be retained or discarded after normalization per user/org policy. |
| Normalized Markdown Document | Retained for the life of the knowledge scope unless explicitly deleted. |
| Knowledge Summary | Retained alongside the Normalized Document. Regenerated on refresh. |
| Key Facts | Retained alongside the Normalized Document. Regenerated on refresh. |
| Source Links | Retained for the life of their parent Summary/Key Fact. |
| Audit logs | Retained per platform audit retention policy (deferred to BILLING-READY-00 / security review). |

### 17.2 Deletion Requirements

- Users may request deletion of any knowledge source they own.
- Org admins may delete any source within their org.
- Deletion of a Knowledge Source must cascade to: Normalized Documents, Summaries, Key Facts, and Source Links derived from it.
- Deletion must not be reversible after confirmation unless a backup/checkpoint exists.
- Deletion requests must be user-confirmed (no auto-delete without explicit action).
- Agents may not trigger deletion of knowledge sources.
- Post-deletion, the tenant's active agents should receive a Knowledge Pack that reflects the removal.

### 17.3 Deferred

- Exact retention period limits.
- Automated expiry policies.
- Legal hold / compliance hold requirements.
- GDPR / data subject access request handling.

---

## 18. Refresh and Scheduling Concept

### 18.1 Phases

**Initial phase (manual only):**
- Users manually upload or re-upload documents.
- No automatic external pulls.
- Refresh is triggered by the user selecting "re-process" on a source.

**Near-term phase (scheduled internal):**
- Org admins may configure a weekly refresh schedule for uploaded sources.
- Refresh re-runs normalization, summarization, and key-fact extraction on the existing source files.
- Changed documents produce new summaries and key facts. Unchanged documents are skipped (incremental processing).

**Future phase (integration-driven):**
- Authorized integration connectors (Notion, Slack, Gmail, Drive) push or pull new source content on a configured schedule.
- Refresh events from integrations are treated identically to manual uploads in the pipeline — they produce normalized documents, summaries, and key facts.
- Failed integration refreshes go to the review queue. Users are notified. No automatic retry without user acknowledgment.

### 18.2 Refresh Safety

- Refresh does not delete or overwrite existing summaries/key facts until the new versions are fully processed and validated.
- During refresh processing, the prior version of summaries and key facts remains active for agent consumption.
- After refresh completes successfully, the new version becomes active and the prior version is archived per retention policy.
- Failed refreshes do not corrupt the prior active version.

### 18.3 Incremental Processing

- Refresh compares source fingerprints (hash or modification timestamp) to detect unchanged sources.
- Unchanged sources are not re-processed unless the user explicitly triggers a full re-ingest.
- Only new or changed sources consume ingestion compute/credits.

---

## 19. Relationship to Agent Registry

### 19.1 Manifest-Driven Access

The agent registry (`frontend/lib/agent-platform/agent-registry.ts`) is the authoritative source for which knowledge scopes each agent may access. The `knowledgeScopes` field on each `AgentManifest` declares:

- `id`: the scope identifier (e.g., `'company-monthly-reports'`, `'codebase-context'`).
- `type`: `'shared'` or `'specialist'`.

No agent may access a scope not declared in its manifest, regardless of what the knowledge base contains.

### 19.2 Placeholder Agents

Placeholder agents (`coming_soon`, `disabled`) may declare intended knowledge scopes in their manifests. This is forward-compatible — scopes can be populated with documents before the agent is activated. When activated, the agent immediately has access to the pre-populated scope.

### 19.3 Scope Registry

Future task AGENT-KNOWLEDGE-01 will define a **Knowledge Domain Types and Static Scope Registry** — a canonical list of known scope IDs, their types, and which agents are authorized to use each scope. This prevents scope ID drift as new agents are added.

### 19.4 Registry Dependency

The knowledge base layer depends on the agent registry for:
- Knowing which scopes to assemble into a Knowledge Pack for a given agent.
- Validating that a requested scope is a declared scope for the requesting agent.
- Knowing which agents need to be notified when a shared scope is refreshed.

---

## 20. Relationship to Agent Collaboration

### 20.1 Knowledge as Collaboration Foundation

Agent collaboration (AGENT-COLLAB-00) requires that agents share a common understanding of company context. Without the knowledge base layer, agents cannot ground their referrals and recommendations in a shared source of truth.

Specifically:
- When Agent A refers a work object to Agent B, Agent B must be able to read the same strategy documents and policies that Agent A used.
- Shared knowledge scopes are the mechanism that makes this possible without passing raw documents through the referral message itself.

### 20.2 Work Objects and Source Links

When agents create work objects (tickets, decisions, referrals, meeting topics) and their recommendations are informed by knowledge base content, those work objects should reference the Source Links used. This enables:
- Reviewability: users can verify what knowledge grounded a recommendation.
- Auditability: the system can trace decisions back to source documents.
- Collaboration coherence: collaborating agents work from the same source truth, not diverging local interpretations.

### 20.3 Ordering

The knowledge architecture plan (this document) must be complete before AGENT-COLLAB-00 begins, because the collaboration protocol depends on scope-linked knowledge semantics being defined.

---

## 21. Relationship to Agent Harness

### 21.1 Current Harness State

The Agent Harness (`services/ai-service/src/agent-harness/`) handles multi-turn tool loop execution for Builder Agent. The harness audit events (`harness-audit-events.ts`) record execution metadata without including prompt text, model output, file content, or tool arguments — a privacy-defensive pattern this knowledge plan also adopts.

### 21.2 Future Harness Integration

In future tasks (not this one), the Agent Harness could:
- Inject a Knowledge Pack into the model context at the start of each harness execution.
- Record a `harness.knowledge_pack_loaded` audit event (analogous to `harness.loop_started`) that records which scopes were included, how many summaries and facts were injected, and the token count consumed — without including the actual content.
- Provide a tool (e.g., `knowledge.getRawDocument`) that agents may call when they have raw-content permission and a specific task need.

### 21.3 Harness Non-Goals for This Task

- No harness code changes in AGENT-KNOWLEDGE-00.
- No harness activation (`AGENT_HARNESS_ENABLE_TOOL_LOOP` must not be changed).
- No new harness event types created in this task.

---

## 22. Relationship to Billing / Credits

### 22.1 Knowledge Processing Costs

Knowledge base operations consume compute and model tokens:

| Operation | Cost Category |
|-----------|--------------|
| Source ingestion and normalization | Compute (file processing) |
| Summary extraction (LLM call) | Model tokens |
| Key fact extraction (LLM call) | Model tokens |
| Scope-level rollup summary generation | Model tokens |
| Knowledge Pack assembly | Compute (database query + assembly) |
| Raw content retrieval | Compute + storage egress |
| Refresh job execution | Compute + model tokens |

### 22.2 Billing Implications

- Summary extraction and key fact extraction consume model tokens that must be attributed to the tenant's credit balance.
- Refresh jobs consume credits proportional to the number of changed sources.
- Raw/full content access may be priced differently (higher) than summary/key fact access.
- Knowledge Pack assembly (reading summaries/key facts) should be low-cost — a database read, not an LLM call.

### 22.3 Billing Deferred

Exact billing rates, plan tiers, and credit deduction logic are deferred to BILLING-READY-00. The knowledge architecture must be designed so that all knowledge processing operations are attributable to a tenant and measurable in token/compute units — but the billing implementation is a separate task.

---

## 23. Relationship to Future Integrations

### 23.1 Connector Model

Future external connectors (Notion, Slack, Gmail, Google Drive, OneDrive, calendar/transcript services) are treated as specialized source types. They produce Knowledge Sources that flow through the same ingestion pipeline as uploaded documents.

### 23.2 Authorization Requirements

Every external connector must:
- Require explicit OAuth authorization from the org owner.
- Be revocable at any time by the org owner without losing existing normalized documents.
- Scope its access to only the data the user explicitly authorizes (e.g., specific Notion databases, specific Slack channels, not the entire workspace).

### 23.3 Privacy Requirements for Connectors

- Gmail and Slack connectors handle potentially sensitive personal communications. These sources require a stricter privacy classification and must default to a higher access control tier.
- Connector authorization must not grant agents access to connector data beyond what is assigned to a declared knowledge scope.
- No connector writes back to the external system without explicit user approval per action.

### 23.4 No Connector Implementation in This Task

All connector implementation is deferred. This plan establishes that connectors are a future source type that the pipeline must be designed to accommodate, not a current implementation target.

---

## 24. Data Object Concepts

These are conceptual shapes only. They do not define a final database schema, ORM model, or API contract.

### 24.1 KnowledgeSource

```
KnowledgeSource {
  id: string
  tenantId: string
  uploadedBy: string               // user who created the source
  title: string
  sourceType: enum                 // markdown | text | pdf | html | notion | slack | gmail | ...
  scopeId: string
  status: enum                     // pending | processing | active | error | archived
  refreshPolicy: KnowledgeRefreshPolicy
  createdAt: timestamp
  updatedAt: timestamp
  sensitivityClassification: enum  // standard | sensitive | restricted
}
```

### 24.2 KnowledgeDocument

```
KnowledgeDocument {
  id: string
  sourceId: string                 // parent KnowledgeSource
  tenantId: string
  scopeId: string
  title: string
  version: number
  status: enum                     // active | archived | processing
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 24.3 NormalizedKnowledgeDocument

```
NormalizedKnowledgeDocument {
  id: string
  documentId: string               // parent KnowledgeDocument
  tenantId: string
  normalizedMarkdown: string       // the actual normalized content
  chunkCount: number
  wordCount: number
  createdAt: timestamp
}
```

### 24.4 KnowledgeSummary

```
KnowledgeSummary {
  id: string
  documentId: string
  tenantId: string
  scopeId: string
  summaryText: string
  sourceLink: KnowledgeSourceLink
  tokenCount: number
  generationModel: string
  createdAt: timestamp
}
```

### 24.5 KnowledgeFact

```
KnowledgeFact {
  id: string
  documentId: string
  tenantId: string
  scopeId: string
  factText: string
  category: enum                   // goal | metric | decision | policy | action-item | risk | deadline | contact
  sourceLink: KnowledgeSourceLink
  extractedAt: timestamp
  generationModel: string
}
```

### 24.6 KnowledgeScope

```
KnowledgeScope {
  id: string                       // e.g. 'company-monthly-reports'
  tenantId: string
  type: enum                       // shared | specialist
  displayName: string
  authorizedAgentIds: string[]     // derived from agent manifests
  documentCount: number
  lastRefreshedAt: timestamp | null
  status: enum                     // active | empty | archived
}
```

### 24.7 KnowledgeAccessPolicy

```
KnowledgeAccessPolicy {
  id: string
  tenantId: string
  scopeId: string
  allowsSummaryAccess: boolean
  allowsRawAccess: boolean
  requiresUserApprovalForRaw: boolean
  sensitivityLevel: enum           // standard | sensitive | restricted
  authorizedAgentIds: string[]
}
```

### 24.8 KnowledgeRefreshPolicy

```
KnowledgeRefreshPolicy {
  id: string
  sourceId: string
  tenantId: string
  mode: enum                       // manual | scheduled_weekly | integration_driven
  scheduleExpression: string | null // e.g. cron expression
  lastRunAt: timestamp | null
  nextRunAt: timestamp | null
  status: enum                     // idle | queued | running | failed | disabled
}
```

### 24.9 KnowledgeSourceLink

```
KnowledgeSourceLink {
  documentId: string
  documentTitle: string
  scopeId: string
  sectionRef: string | null        // heading or page number
  sourceType: string
  uploadDate: string
  tenantId: string
}
```

### 24.10 KnowledgeProcessingJob

```
KnowledgeProcessingJob {
  id: string
  tenantId: string
  sourceId: string
  jobType: enum                    // initial_ingest | refresh | re_summarize
  status: enum                     // queued | running | completed | failed | review_required
  startedAt: timestamp | null
  completedAt: timestamp | null
  errorMessage: string | null
  creditsConsumed: number | null
}
```

---

## 25. Safety and Approval Considerations

### 25.1 External Connector Authorization

- No external connector may be activated without explicit OAuth authorization from the org owner.
- Authorization must be per-connector and per-scope. Authorizing Notion access does not grant Slack access.
- Revocation of connector authorization must immediately suspend new data pulls. Existing normalized documents are retained per retention policy.

### 25.2 Sensitive Source Scopes

- Sources classified as `sensitive` or `restricted` require:
  - Human review of generated summaries before agent access is enabled.
  - Separate access policy validation before raw content retrieval.
  - Audit logging of all access events.
- Examples: legal contracts, HR policies, financial records.

### 25.3 Deletion Approval

- Knowledge source deletion requires explicit user confirmation.
- Agents may not trigger deletion.
- Deletion events are logged with user ID, timestamp, and source metadata (not content).
- Post-deletion, Knowledge Packs are rebuilt to exclude the deleted content.

### 25.4 Summary Reviewability

- For sensitive scopes, AI-generated summaries and key facts must be presented to the org admin for review before being made available to agents.
- Org admins may edit, reject, or approve summaries.
- Summaries may not be provided to agents in an unreviewed state for sensitive scopes.

### 25.5 Business-Critical Recommendations

- Agents must cite Source Links when making recommendations on topics covered by the knowledge base (strategy, finance, policy, goals).
- "The company's stated three-year goal is 10,000 paying customers by 2028" must include a citation to the source document.
- Uncited business-critical recommendations are a trust risk and should be flagged as low-confidence.

---

## 26. Proposed Follow-Up Roadmap

These tasks are proposed, not registered. Registration requires explicit approval.

| Task ID | Name | Description |
|---------|------|-------------|
| AGENT-KNOWLEDGE-01 | Knowledge Domain Types and Static Scope Registry | Define a canonical static registry of all known knowledge scope IDs, their types, authorized agents, and descriptions. Analogous to the agent registry. No database required. |
| AGENT-KNOWLEDGE-02 | Manual Markdown Knowledge Upload Plan / Implementation | Design and implement the manual upload flow: user uploads a markdown/text document, it is normalized, summarized, and assigned to a scope. Minimal viable ingestion. |
| AGENT-KNOWLEDGE-03 | Summary and Key Fact Extraction Architecture | Design the LLM-based summary and key fact extraction pipeline: prompts, chunking strategy, token budgets, source link attachment. |
| AGENT-KNOWLEDGE-04 | Source Traceability and Access Policy | Implement source link storage, access policy enforcement, and raw-content access gates. Introduce sensitive scope classification. |
| AGENT-COLLAB-00 | Agent Referral and Collaboration Protocol Plan | Define how agents refer work to each other, create shared tickets, and route approvals. Depends on knowledge architecture being defined. |
| BILLING-READY-00 | Billing, Plan, Credit, and Entitlement Audit | Define billing model, credit deduction for knowledge processing, plan tiers. Depends on knowledge and collaboration plans being complete. |

---

## 27. Acceptance Criteria

These map to the Planning Acceptance Criteria in TASKS.md (AGENT-KNOWLEDGE-00):

- [x] Planning document created: `docs/AGENT-KNOWLEDGE-00-KNOWLEDGE-ARCHITECTURE-PLAN.md`.
- [x] Common knowledge base architecture defined (section 6).
- [x] Shared vs specialist knowledge scopes defined (section 7).
- [x] Source type model defined (section 8).
- [x] Markdown normalization concept defined (section 10).
- [x] Summary/key fact extraction concept defined (section 11).
- [x] Agent consumption model defined (section 12).
- [x] Raw/full content access model defined (section 13).
- [x] Tenant/organization isolation model defined (section 15).
- [x] Source traceability model defined (section 16).
- [x] Retention/deletion policy requirements defined (section 17).
- [x] Refresh/scheduling concept defined (section 18).
- [x] Relationship to Agent Registry defined (section 19).
- [x] Relationship to Agent Collaboration defined (section 20).
- [x] Relationship to Agent Harness defined (section 21).
- [x] Relationship to Billing/credits defined (section 22).
- [x] Future implementation roadmap proposed (section 26).
- [x] Explicit non-goals confirmed (section 4).

---

## 28. Open Questions / Deferred Decisions

| Question | Deferred To |
|----------|-------------|
| Database schema for knowledge objects | AGENT-KNOWLEDGE-02 or dedicated schema task |
| Vector search vs keyword search vs hybrid | AGENT-KNOWLEDGE-03 |
| Embedding provider and model selection | AGENT-KNOWLEDGE-03 |
| File storage provider (S3, Azure Blob, GCS) | AGENT-KNOWLEDGE-02 |
| Maximum document size limits (pages, characters) | AGENT-KNOWLEDGE-02 |
| Exact summary token budget per document and per scope | AGENT-KNOWLEDGE-03 |
| Summary refresh cadence for scheduled mode | AGENT-KNOWLEDGE-01 / 02 |
| Human review workflow UI for sensitive scope summaries | AGENT-KNOWLEDGE-04 |
| Exact billing rates for ingestion, summarization, and refresh | BILLING-READY-00 |
| Integration connector priority (Notion vs Slack vs Gmail vs Drive) | Future connector planning task |
| Exact knowledge token budget allocated within agent context window | AGENT-KNOWLEDGE-03 |
| Scope-level rollup summary generation strategy (one LLM call vs sequential) | AGENT-KNOWLEDGE-03 |
| Deduplication strategy for key facts across multiple source documents | AGENT-KNOWLEDGE-03 |
| Legal hold / compliance hold requirements for knowledge documents | Future compliance review |
| Multi-language source document support (non-English knowledge sources) | Future i18n planning |

---

*Document created: 2026-07-06*
*Task: AGENT-KNOWLEDGE-00*
*Status: Planning complete — ready for Keith review and consolidation/checkpoint*
