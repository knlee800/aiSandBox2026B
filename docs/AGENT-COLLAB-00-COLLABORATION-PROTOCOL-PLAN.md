# AGENT-COLLAB-00 — Agent Referral and Collaboration Protocol Plan

**Task ID:** AGENT-COLLAB-00
**Family:** AGENT COLLABORATION / REFERRAL PROTOCOL
**Status:** ACTIVE — planning pass
**Created:** 2026-07-06
**Nature:** PLANNING/GOVERNANCE — documentation only, no implementation
**Authority:** Follows ROADMAP-00, governed by AGENT-PLATFORM-00 master plan

---

## 1. Executive Summary

ainow.biz hosts multiple specialized AI agents that collaborate on real business work. As the agent team grows — Chief of Staff, Product Strategy, Technology Advisor, Builder Agent, and future specialists like Legal Advisor — the platform needs a structured collaboration protocol so agents can refer work to each other without every dispatch manually going through Keith.

This document defines that protocol. Collaboration is structured through:

- **Work objects** — tickets, decisions, drafts, referrals, meeting topics, agent comments, risk/opportunity tags.
- **Approval gates** — human-owner control for external-facing and high-risk actions.
- **Audit events** — every collaboration action is recorded with full traceability.
- **Source links** — recommendations are grounded in knowledge base evidence.
- **Human-owner control** — Keith remains the final authority for binding, external, or high-risk actions.

This plan comes after AGENT-KNOWLEDGE-00 because collaboration recommendations should be source-linked and knowledge-aware. Agents collaborating on a task must share a common factual base from the knowledge layer to produce coherent, aligned recommendations.

This document is planning only. No database schema, no runtime orchestration, no backend routes, no frontend UI changes, no Agent Harness changes, and no billing implementation are included in this task.

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

| Agent | Status | Collaboration Role |
|-------|--------|--------------------|
| Builder Agent | ACTIVE | Receives handoff referrals for software tasks |
| Chief of Staff Agent | COMING SOON | Primary workflow orchestrator — triages, routes, drafts, coordinates |
| Product Strategy Agent | COMING SOON | Contributes strategic analysis and market-informed recommendations |
| Technology Advisor Agent | COMING SOON | Contributes technical analysis and architecture recommendations |
| Future: Legal Advisor | FUTURE | Reviews contracts, flags legal risks, suggests modifications |
| Future: other specialists | FUTURE | Domain-specific contributions via the same protocol |

### 2.4 Registry Anchor

The agent registry (`frontend/lib/agent-platform/agent-registry.ts`) already declares `referralRules` and `approvalRules` fields on every `AgentManifest`. The typed interfaces `AgentReferralRule` and `AgentApprovalRule` define the structural contract. This plan defines the lifecycle, safety, and semantics those fields enable.

### 2.5 Knowledge Anchor

The common knowledge base architecture (AGENT-KNOWLEDGE-00) establishes source-linked knowledge: summaries, key facts, and source links. Collaboration work objects should reference these source links so that recommendations are grounded and verifiable.

### 2.6 Harness Anchor

The Agent Harness audit events (`services/ai-service/src/agent-harness/audit/harness-audit-events.ts`) establish the pattern for privacy-conscious structured event recording — recording metadata without prompt text, model output, or file content. Collaboration audit events follow the same pattern.

---

## 3. Goals

1. Define the agent referral lifecycle.
2. Define collaboration safety limits.
3. Define idempotency and duplicate referral prevention.
4. Define referral loop prevention.
5. Define shared work object concepts (ticket, decision, draft, referral, meeting topic, agent comment, risk tag, opportunity tag, source link, approval status, audit event).
6. Define approval gates and human-owner control.
7. Define agent-to-agent contribution model.
8. Define source-linked recommendation model.
9. Define relationships to Agent Registry, Common Knowledge Base, Agent Harness audit events, Billing/credits, and future integrations.
10. Define Keith's contract-negotiation collaboration scenario in full.
11. Propose conceptual data object shapes.
12. Record safety and abuse prevention requirements.
13. Propose the follow-up implementation roadmap.

---

## 4. Non-Goals

The following are explicitly out of scope for this task:

- No implementation code of any kind.
- No database schema implementation or migration.
- No runtime orchestration implementation.
- No backend routes or API endpoints.
- No email/Slack/Notion/Gmail integration implementation.
- No Legal Advisor agent implementation.
- No frontend UI changes.
- No translation file changes.
- No billing/Stripe/payment implementation.
- No knowledge ingestion implementation.
- No Agent Harness behavior changes.
- No Agent Harness activation (`AGENT_HARNESS_ENABLE_TOOL_LOOP` must remain as-is).
- No registration of AGENT-SKILLS-00, BILLING-READY-00, or AGENT-COLLAB-01.

---

## 5. Core Concepts

| Concept | Definition |
|---------|------------|
| **Agent Referral** | A structured request from one agent to another for review, handoff, consultation, or approval on a specific work object. |
| **Collaboration Session** | A bounded interaction scope encompassing all agent contributions, referrals, and decisions related to a single triggering event or work object tree. |
| **Work Object** | A structured data unit that agents create, modify, and collaborate on. The shared workspace for multi-agent coordination. |
| **Ticket** | A task or action item to be tracked and completed. |
| **Decision** | A choice requiring input from multiple agents and/or human approval before resolution. |
| **Draft** | A document, message, or content draft created by an agent for review before external action. |
| **Meeting Topic** | An item to be discussed in a future meeting, flagged by an agent. |
| **Agent Comment** | An agent's analysis, recommendation, or note attached to a work object. |
| **Risk Tag** | A risk flag attached to a work object, surfacing potential negative outcomes. |
| **Opportunity Tag** | An opportunity flag attached to a work object, surfacing potential positive outcomes. |
| **Source Link** | A structured reference linking a recommendation or fact back to its origin in the knowledge base. |
| **Approval Status** | The approval state of a work object (pending, approved, rejected, modified). |
| **Audit Event** | An immutable log entry recording a collaboration action with timestamp, agent, and action metadata. |
| **Human Owner** | Keith — the platform owner who retains final authority over external-facing and high-risk actions. |
| **Approval Gate** | A control point where human approval is required before an action may proceed. |
| **Idempotency Key** | A composite key that prevents duplicate referrals for the same work from being created. |
| **Referral Depth** | The number of levels deep a referral chain has reached (A→B→C = depth 3). |
| **Collaboration Threshold** | A configurable limit that, when reached, pauses the collaboration and requires human-owner approval to continue. |

---

## 6. Collaboration Protocol Overview

### 6.1 Design Principles

1. **No private agent chat without trace.** Agents do not privately exchange messages. All collaboration is through structured work objects with full audit trail.
2. **Work object centric.** Agents collaborate by creating, referring, and commenting on structured work objects — not by conversing.
3. **Every action audited.** Every collaboration action (create, refer, comment, approve, reject) creates an audit event.
4. **Human owner controls the perimeter.** External-facing and high-risk actions cannot proceed without human-owner approval.
5. **Asynchronous by default.** Collaboration does not require real-time response. Agents contribute when invoked.
6. **Source-linked by default.** Business-critical recommendations must cite knowledge base source links.
7. **Bounded.** Collaboration is bounded by safety limits: max depth, max agents, max referrals.
8. **Idempotent.** Duplicate referrals are detected and collapsed rather than creating redundant work.

### 6.2 Collaboration Flow Summary

```
Triggering event (email, user request, scheduled scan, or agent detection)
  → Agent creates or updates work object(s)
  → Agent may refer work object to another agent
  → Target agent receives scoped context and contributes
  → Optional further referrals (within safety limits)
  → All agent contributions aggregated on work object
  → Approval gate evaluated
  → Human owner approves/rejects/modifies (when required)
  → Final outcome recorded as audit event
  → Downstream actions triggered (if approved)
```

---

## 7. Agent Referral Lifecycle

### 7.1 Lifecycle Steps

| Step | Action | Actor |
|------|--------|-------|
| 1 | **Trigger detected** | Source agent detects a condition matching one of its `referralRules` |
| 2 | **Referral candidate created** | Source agent prepares a referral with: target agent, referral type, priority, work object reference, scoped context summary |
| 3 | **Idempotency check** | System computes idempotency key and checks for existing referral |
| 4 | **Safety limit check** | System validates referral depth, agent count, and loop-free path |
| 5 | **Referral object created** | If checks pass, the referral work object is persisted with status `open` |
| 6 | **Audit event recorded** | `collaboration.referral_created` event logged |
| 7 | **Target agent receives context** | Target agent is invoked with: referral object, parent work object, relevant knowledge pack (scope-filtered) |
| 8 | **Target agent contributes** | Target agent adds analysis, recommendation, agent comment, risk/opportunity tags |
| 9 | **Optional further referral** | Target agent may create sub-referrals if its `referralRules` match and safety limits allow |
| 10 | **Contributions aggregated** | All agent contributions are collected on the shared work object |
| 11 | **Approval gate evaluated** | System checks whether the work object or its downstream action requires human approval |
| 12 | **Human owner notified** | If approval required, Keith receives notification with all agent inputs |
| 13 | **Human owner decides** | Keith approves, rejects, or modifies |
| 14 | **Outcome recorded** | Final outcome recorded as audit event; approval status updated |
| 15 | **Downstream action (if approved)** | Approved actions are executed (e.g., send email, accept terms) |
| 16 | **Referral closed** | Referral status updated to `completed` or `rejected` |

### 7.2 Referral Types

| Type | Semantics |
|------|-----------|
| `review` | Target agent reviews and provides analysis/recommendation but does not take ownership |
| `handoff` | Target agent takes ownership of the work object for execution |
| `consultation` | Target agent provides input without taking ownership or blocking the flow |
| `approval` | Target agent (or human owner) must approve before the source agent may proceed |

### 7.3 Referral Statuses

| Status | Meaning |
|--------|---------|
| `open` | Referral created, awaiting target agent processing |
| `in_progress` | Target agent has begun processing |
| `contributed` | Target agent has provided its contribution |
| `completed` | Referral resolved successfully |
| `rejected` | Referral rejected by target agent or human owner |
| `blocked` | Referral blocked by safety limit or loop detection |
| `expired` | Referral timed out without resolution |

---

## 8. Collaboration Safety Limits

### 8.1 Configurable Limits

| Limit | Description | Recommended Default |
|-------|-------------|---------------------|
| `maxReferralDepth` | Maximum levels deep a referral chain may go (A→B→C→D = 4) | 4 |
| `maxAgentsPerCollaboration` | Maximum distinct agents that may participate in a single collaboration session | 5 |
| `maxReferralsPerWorkObject` | Maximum referrals that may be created for a single work object | 8 |
| `maxOpenReferralsPerAgent` | Maximum concurrent open referrals a single agent may have | 10 |
| `maxAutomaticReferralsPerIncomingItem` | Maximum automatic referrals created from a single incoming trigger | 3 |

### 8.2 Threshold Behavior

When any collaboration safety limit is reached:

1. The platform **pauses** the collaboration.
2. An audit event is logged: `collaboration.safety_limit_reached`.
3. The human owner is notified with: which limit was reached, current chain state, and pending work.
4. The collaboration **cannot continue** without explicit human-owner approval.

### 8.3 Conservative-First Design

Defaults are conservative. It is safer to pause and ask the owner than to allow runaway chains. Limits may be relaxed per-tenant by the platform owner after observing real usage patterns. Limits must never be relaxed below platform-enforced minimums.

---

## 9. Idempotency and Duplicate Referral Prevention

### 9.1 Idempotency Key Composition

An idempotency key for referrals is computed from:

| Component | Purpose |
|-----------|---------|
| Source item ID | The triggering work object or external item |
| Triggering agent ID | The agent creating the referral |
| Target agent ID | The agent receiving the referral |
| Referral type | `review`, `handoff`, `consultation`, or `approval` |
| Work object ID | The parent work object the referral relates to |
| Normalized trigger reason | A normalized string representing why the referral was triggered |

### 9.2 Duplicate Handling

- If an idempotency key matches an existing **open** or **in_progress** referral, the new referral is **ignored** and a link to the existing referral is returned.
- If an idempotency key matches an existing **completed** or **rejected** referral, the system evaluates whether the context has materially changed. If unchanged, the new referral is ignored. If changed, a new referral may be created with a version increment.
- Duplicate detection is synchronous — it must complete before the referral is persisted.

### 9.3 Idempotency Record

Each idempotency check produces an `IdempotencyRecord` that logs the key, the outcome (created vs duplicate-ignored), and the timestamp. This enables audit trail and debugging.

---

## 10. Referral Loop Prevention

### 10.1 Loop Detection Rules

1. **Direct loop:** A referral from Agent A to Agent B is blocked if Agent B already has an open referral back to Agent A for the same work object.
2. **Chain loop:** A referral is blocked if the target agent already appears anywhere in the current referral chain for the same work object.
3. **Repeated referral:** A referral to the same target agent for the same work object is blocked if an existing referral (open, in_progress, or contributed) already exists — regardless of chain position.

### 10.2 Detection Mechanism

The platform maintains a **referral chain** for each collaboration session: an ordered list of `[sourceAgentId, targetAgentId, referralId]` tuples. Before creating a new referral, the system walks the chain and checks for loops.

### 10.3 Loop Response

When a loop is detected:

1. The referral is **blocked** (not created).
2. An audit event is logged: `collaboration.loop_detected`.
3. The source agent receives a structured response indicating the loop and suggesting alternative actions.
4. If the collaboration appears stuck (blocked referrals with no resolution path), the human owner is notified.

### 10.4 Depth Limit Enforcement

When `maxReferralDepth` is reached:

1. No further referrals may be created from the current chain.
2. The deepest agent must contribute its analysis without further delegation.
3. An audit event is logged: `collaboration.depth_limit_reached`.
4. The human owner is notified if the depth limit prevents meaningful resolution.

---

## 11. Shared Work Object Model

Work objects are the structured data units that agents create, modify, and collaborate on. They form the shared workspace for multi-agent coordination.

### 11.1 Work Object Types

| Type | Purpose |
|------|---------|
| **Ticket** | A task or action item to be tracked |
| **Decision** | A choice requiring multi-agent input and/or human approval |
| **Draft** | A document or message draft created for review |
| **Referral** | A structured request from one agent to another |
| **Meeting Topic** | An item flagged for future meeting discussion |
| **Agent Comment** | An agent's analysis, recommendation, or note on a work object |
| **Risk Tag** | A risk flag attached to a work object |
| **Opportunity Tag** | An opportunity flag attached to a work object |
| **Source Link** | A reference to a knowledge base source or external origin |
| **Approval Status** | The approval state of a work object |
| **Audit Event** | An immutable log entry recording a collaboration action |

### 11.2 Work Object Relationships

Work objects form a directed graph:

- A **Ticket** may have child Tickets, Referrals, Drafts, and Agent Comments.
- A **Decision** may have child Referrals, Agent Comments, Risk Tags, and Opportunity Tags.
- A **Referral** links a source work object to a target agent and may produce Agent Comments.
- A **Draft** may have Agent Comments and Source Links.
- All work objects may carry Source Links and an Approval Status.
- All work object mutations produce Audit Events.

---

## 12. Ticket Concept

A Ticket represents a trackable task or action item within the collaboration system.

### 12.1 Ticket Properties

| Property | Description |
|----------|-------------|
| ID | Unique ticket identifier |
| Title | Descriptive title |
| Description | Task description and context |
| Created by | Agent ID that created the ticket |
| Assigned to | Agent ID or human owner |
| Status | `open`, `in_progress`, `blocked`, `completed`, `cancelled` |
| Priority | `low`, `normal`, `high`, `urgent` |
| Due date | Optional deadline |
| Parent work object | Reference to parent ticket, decision, or collaboration session |
| Tags | Risk tags, opportunity tags |
| Source links | Knowledge base references informing the ticket |
| Agent comments | Agent contributions and analysis |

### 12.2 Ticket Lifecycle

1. Agent creates ticket (status: `open`).
2. Ticket may be referred to another agent (creates a Referral work object).
3. Assigned agent or human owner works on the ticket.
4. Status transitions: `open` → `in_progress` → `completed` or `cancelled`.
5. All transitions produce audit events.

---

## 13. Decision Concept

A Decision represents a choice point requiring multi-agent input and human-owner approval for high-stakes outcomes.

### 13.1 Decision Properties

| Property | Description |
|----------|-------------|
| ID | Unique decision identifier |
| Title | Decision question or topic |
| Context | Background information and constraints |
| Options | Enumerated options under consideration |
| Created by | Agent ID that surfaced the decision |
| Agent inputs | Array of agent comments with analysis per option |
| Recommendation | The recommended option (if agents converge) |
| Source links | Knowledge base references supporting the decision |
| Risk tags | Identified risks per option |
| Opportunity tags | Identified opportunities per option |
| Approval status | Human-owner approval state |
| Outcome | Final decision and rationale |

### 13.2 Decision Lifecycle

1. Agent detects a decision point and creates a Decision work object.
2. Agent may refer the decision to other agents for analysis.
3. Contributing agents add agent comments with analysis, risk/opportunity tags, and source-linked evidence.
4. If agents converge on a recommendation, it is surfaced.
5. Decision routes to human owner for final approval.
6. Human owner approves, rejects, or modifies.
7. Outcome recorded with audit event.

---

## 14. Draft Concept

A Draft represents content created by an agent that requires review before external action (sending, publishing, committing).

### 14.1 Draft Properties

| Property | Description |
|----------|-------------|
| ID | Unique draft identifier |
| Title | Draft purpose/subject |
| Content | The draft text, structured content, or document |
| Draft type | `email_reply`, `document`, `contract_response`, `announcement`, `report` |
| Created by | Agent ID |
| Target | Intended recipient or destination |
| Status | `draft`, `under_review`, `approved`, `rejected`, `sent` |
| Agent comments | Review comments from other agents |
| Source links | Knowledge references used to inform the draft |
| Approval status | Required approval state before the draft may be sent/published |

### 14.2 Draft Lifecycle

1. Agent creates draft (status: `draft`).
2. Draft may be referred to other agents for review.
3. Reviewing agents add comments and suggestions.
4. Draft marked `under_review` when submitted for human-owner approval.
5. Human owner approves, rejects, or modifies.
6. If approved, the platform may execute the downstream action (send email, publish).
7. Status updated to `sent` after successful execution.

---

## 15. Referral Concept

A Referral is itself a work object that represents a structured request from one agent to another.

### 15.1 Referral Properties

| Property | Description |
|----------|-------------|
| ID | Unique referral identifier |
| Source agent | Agent creating the referral |
| Target agent | Agent receiving the referral |
| Referral type | `review`, `handoff`, `consultation`, `approval` |
| Priority | `normal`, `urgent` |
| Parent work object | The work object this referral relates to |
| Context summary | Scoped context for the target agent |
| Status | See section 7.3 |
| Idempotency key | Computed key for duplicate detection |
| Chain depth | Current depth in the referral chain |
| Source links | Knowledge references relevant to the referral |
| Contributions | Agent comments added by the target agent |

### 15.2 Referral Creation Rules

- A referral may only be created if the source agent's `referralRules` contain a matching rule.
- A referral's `autoCreate` flag determines whether it requires pre-creation approval.
- If `requiresOwnerApproval` is true on the referral rule, the referral is created in a `pending_approval` state and waits for human-owner authorization.
- Referrals with `autoCreate: true` and `requiresOwnerApproval: false` are created immediately when the trigger condition matches.

---

## 16. Meeting Topic Concept

A Meeting Topic is a work object representing an item that should be discussed in a future meeting or synchronous review with the human owner.

### 16.1 Meeting Topic Properties

| Property | Description |
|----------|-------------|
| ID | Unique topic identifier |
| Title | Topic summary |
| Context | Background and relevant details |
| Suggested by | Agent ID that flagged the topic |
| Priority | `informational`, `discussion_needed`, `decision_required` |
| Related work objects | Links to relevant tickets, decisions, or drafts |
| Source links | Knowledge references |
| Status | `proposed`, `scheduled`, `discussed`, `resolved` |
| Meeting date | When the topic was or will be discussed |
| Outcome | Summary of discussion outcome (filled after meeting) |

---

## 17. Agent Comment Concept

An Agent Comment is the primary mechanism for agents to contribute analysis, recommendations, and observations to work objects.

### 17.1 Agent Comment Properties

| Property | Description |
|----------|-------------|
| ID | Unique comment identifier |
| Author agent | Agent ID that created the comment |
| Target work object | The work object this comment is attached to |
| Comment type | `analysis`, `recommendation`, `question`, `observation`, `risk_flag`, `opportunity_flag` |
| Content | The comment text and structured data |
| Source links | Knowledge base references supporting the comment |
| Confidence level | `high`, `medium`, `low` — how confident the agent is in its assessment |
| Created at | Timestamp |

### 17.2 Comment Rules

- Agents may comment on any work object they have been referred to or that exists within their collaboration scope.
- Comments are append-only — agents do not edit or delete other agents' comments.
- Comments on Decision work objects should indicate which option the agent supports and why.
- Business-critical comments must include source links (see section 26).

---

## 18. Risk and Opportunity Tags

### 18.1 Risk Tag

| Property | Description |
|----------|-------------|
| ID | Unique tag identifier |
| Label | Short risk description |
| Severity | `low`, `medium`, `high`, `critical` |
| Description | Detailed risk explanation |
| Tagged by | Agent ID |
| Target work object | The work object this risk is attached to |
| Source links | Evidence from knowledge base |
| Mitigation suggestion | Optional mitigation approach |

### 18.2 Opportunity Tag

| Property | Description |
|----------|-------------|
| ID | Unique tag identifier |
| Label | Short opportunity description |
| Impact | `low`, `medium`, `high` |
| Description | Detailed opportunity explanation |
| Tagged by | Agent ID |
| Target work object | The work object this opportunity is attached to |
| Source links | Evidence from knowledge base |
| Action suggestion | Optional suggested action to capitalize |

---

## 19. Source Link Model

Source Links ground collaboration in verifiable evidence. They reference the common knowledge base (AGENT-KNOWLEDGE-00) or external origins.

### 19.1 Source Link Properties

| Property | Description |
|----------|-------------|
| ID | Unique link identifier |
| Document ID | Knowledge base document identifier |
| Document title | Human-readable source document title |
| Scope ID | Knowledge scope the source belongs to |
| Section reference | Heading, page number, or section within the source |
| Source type | `knowledge_summary`, `knowledge_fact`, `external_email`, `external_document`, `url` |
| Upload date | When the source was ingested |
| Tenant ID | Owning tenant |

### 19.2 Source Link Usage Rules

- Source links may be attached to any work object, agent comment, risk tag, or opportunity tag.
- Agents must attach source links when making business-critical recommendations.
- Source links to knowledge base items inherit the access control of their source scope — an agent may only reference sources from its declared knowledge scopes.
- Source links to external items (emails, documents) reference the triggering item directly.

---

## 20. Approval Status Model

### 20.1 Approval Statuses

| Status | Meaning |
|--------|---------|
| `not_required` | No approval needed for this work object |
| `pending_agent` | Awaiting approval from a specific agent |
| `pending_owner` | Awaiting human-owner approval |
| `approved` | Approved by required party |
| `rejected` | Rejected by required party |
| `modified` | Approved with modifications by the human owner |
| `expired` | Approval timed out (action blocked by default) |

### 20.2 Approval Status Transitions

```
not_required (for internal-only work objects)

pending_agent → approved / rejected
pending_owner → approved / rejected / modified / expired
```

### 20.3 Timeout Behavior

- For high-risk actions (external email, contract, payment, destructive, binding commitment, public content): timeout defaults to `block`. The action is not taken.
- For low-risk internal actions (stale referral closure, internal ticket auto-close): timeout may default to `allow` only if explicitly configured.
- Platform enforces `block` for high-risk categories regardless of manifest configuration.

---

## 21. Audit Event Model

### 21.1 Design Principles

Collaboration audit events follow the same privacy-conscious pattern established by the Agent Harness audit events (`harness-audit-events.ts`):

- Events record metadata, not content.
- No prompt text, model output, draft content, or agent comment content is stored in audit events.
- Events record: who, what, when, which work object, which referral, and outcome — not the actual text or recommendations.

### 21.2 Collaboration Audit Event Types

| Event Type | Trigger |
|------------|---------|
| `collaboration.session_started` | A new collaboration session begins |
| `collaboration.work_object_created` | A work object is created |
| `collaboration.work_object_updated` | A work object status changes |
| `collaboration.referral_created` | A referral is created |
| `collaboration.referral_contributed` | A target agent contributes to a referral |
| `collaboration.referral_completed` | A referral is resolved |
| `collaboration.referral_blocked` | A referral is blocked by safety limit or loop |
| `collaboration.comment_added` | An agent comment is added to a work object |
| `collaboration.approval_requested` | Approval is requested from human owner or agent |
| `collaboration.approval_granted` | Approval is granted |
| `collaboration.approval_rejected` | Approval is rejected |
| `collaboration.approval_modified` | Approval granted with modifications |
| `collaboration.approval_expired` | Approval timed out |
| `collaboration.safety_limit_reached` | A safety limit was hit |
| `collaboration.loop_detected` | A referral loop was detected and blocked |
| `collaboration.depth_limit_reached` | Referral depth limit was reached |
| `collaboration.session_completed` | Collaboration session resolved |
| `collaboration.duplicate_referral_ignored` | Idempotency check caught a duplicate |

### 21.3 Audit Event Base Shape

```
CollaborationAuditEvent {
  eventType: string
  timestamp: number
  collaborationSessionId: string
  workObjectId: string
  workObjectType: string
  agentId: string
  tenantId: string
  referralId: string | null
  metadata: Record<string, string | number | boolean>
}
```

Metadata carries action-specific context (e.g., target agent ID for referrals, safety limit name for limit events) without embedding content.

---

## 22. Agent-to-Agent Contribution Model

### 22.1 How Agents Contribute

Agents contribute to collaboration through structured mechanisms only:

| Mechanism | Description |
|-----------|-------------|
| **Create work object** | Agent creates a ticket, decision, draft, meeting topic, or referral |
| **Add agent comment** | Agent attaches analysis/recommendation to an existing work object |
| **Add risk/opportunity tag** | Agent flags a risk or opportunity on a work object |
| **Attach source link** | Agent grounds a contribution in knowledge base evidence |
| **Create referral** | Agent refers work to another agent |
| **Update status** | Agent updates the status of a work object it owns |

### 22.2 Contribution Rules

- Agents may only contribute to work objects within their collaboration scope (i.e., they were referred to the work or they created it).
- Agents cannot modify another agent's comments — they can only add new comments.
- Agents cannot delete work objects — only human owner can.
- Agents cannot override approval gates — they can only request approval.
- Each contribution produces an audit event.

### 22.3 Contribution Ordering

When multiple agents contribute to the same work object:

- Contributions are ordered by timestamp.
- Later contributions may reference earlier contributions by ID.
- No contribution is privileged over another — the human owner weighs all inputs.
- If agents disagree, the disagreement is surfaced as competing agent comments on the Decision work object.

---

## 23. Human-Owner Control Model

### 23.1 Core Principle

Keith (the human owner) retains final authority over all external-facing and high-risk actions. Agents prepare, analyze, and recommend — they do not act autonomously on the platform's external perimeter.

### 23.2 Owner Control Points

| Control Point | Description |
|---------------|-------------|
| **Approval gate** | Human owner must approve before any high-risk action executes |
| **Safety limit escalation** | Human owner is notified when any safety limit is reached |
| **Work object deletion** | Only human owner may delete work objects |
| **Override** | Human owner may override any agent recommendation |
| **Modification** | Human owner may modify drafts, decisions, and referrals before approval |
| **Pause/resume** | Human owner may pause or resume any collaboration session |
| **Agent enable/disable** | Human owner controls which agents are active via the registry |

### 23.3 Owner Notification Model

When owner attention is required:

1. In-app notification (primary channel).
2. Optional external notification (Slack, email — future integration).
3. Notification includes: what happened, which work objects are involved, what action is needed.
4. Owner can respond in-app or via future integration channels.

### 23.4 Owner Response Options

For any approval request, the owner may:

- **Approve** — action proceeds as proposed.
- **Reject** — action is cancelled; agents are notified.
- **Modify** — owner edits the proposed action (e.g., modifies a draft reply) and then approves.
- **Defer** — owner explicitly defers the decision to a later time.
- **Escalate** — owner requests more information from agents before deciding.

---

## 24. Approval Gates

### 24.1 Actions Requiring Human-Owner Approval

| Action Category | Examples | Approval Required |
|-----------------|----------|-------------------|
| External emails | Sending any email to an external party | Always |
| Contract actions | Accepting, modifying, or rejecting contract terms | Always |
| Payments | Initiating any payment or financial commitment | Always |
| Public-facing content | Publishing blog posts, social media, press releases | Always |
| Destructive actions | Deleting data, revoking access, terminating agreements | Always |
| Binding commitments | Making any binding promise to an external party | Always |
| Sensitive data access | Accessing restricted knowledge scopes for external use | Always |

### 24.2 Actions That Do NOT Require Approval

| Action | Description |
|--------|-------------|
| Creating internal tickets | Agent creates a to-do or task for internal tracking |
| Creating internal drafts | Agent drafts a reply or document for review |
| Creating referrals | Agent refers work to another agent |
| Adding agent comments | Agent adds analysis or recommendation |
| Adding risk/opportunity tags | Agent flags a risk or opportunity |
| Updating internal work object status | Agent marks a ticket as complete internally |
| Creating meeting topics | Agent flags an item for future discussion |

### 24.3 Approval Gate Enforcement

- Approval gates are enforced by the platform layer, not by individual agents.
- An agent cannot bypass an approval gate by referring work to another agent.
- An agent-to-agent referral chain cannot escalate privileges — the downstream agent inherits the same approval requirements as the upstream work object.
- Approval gate configuration is defined in each agent's `approvalRules` manifest field.
- The platform enforces `defaultOnTimeout: 'block'` for all high-risk action categories regardless of manifest values.

### 24.4 Approval Timeout

- Default timeout: configurable per rule (via `approvalTimeoutHours` in `AgentApprovalRule`).
- Timeout behavior for high-risk actions: always `block`.
- Timeout behavior for low-risk internal actions: may be `allow` if explicitly configured.
- When timeout expires with `block`: the action is not taken, the work object is marked `expired`, and the human owner is notified that the approval window closed.

---

## 25. Keith Contract-Negotiation Scenario

This section documents the full collaboration flow for Keith's agency contract negotiation scenario — the primary design target for the collaboration protocol.

### 25.1 Trigger

Keith receives an agency contract negotiation email from a business partner. The email includes a contract attachment with proposed terms.

### 25.2 Full Workflow

| Step | Agent | Action | Work Objects Created | Approval Required |
|------|-------|--------|---------------------|-------------------|
| 1 | Chief of Staff | Receives and triages the email. Detects contract negotiation trigger. | — | No |
| 2 | Chief of Staff | Analyzes the email and contract attachment. Extracts key terms, deadlines, and parties. | — | No |
| 3 | Chief of Staff | Creates a reply draft acknowledging receipt and requesting clarification on key terms. | Draft: "Reply to [Partner] — acknowledgment + clarification request" | No (creation is internal) |
| 4 | Chief of Staff | Creates a daily to-do ticket for Keith to review. | Ticket: "Review contract reply draft — [Partner]" | No |
| 5 | Chief of Staff | Creates a decision ticket for the contract terms. | Decision: "Accept/modify/reject [Partner] agency terms" | No |
| 6 | Chief of Staff | Creates a legal review referral for future Legal Advisor agent. | Referral: "Legal review — [Partner] agency contract" (type: `review`) | No |
| 7 | Chief of Staff | Optionally refers to Product Strategy if strategic fit is relevant. | Referral: "Strategic fit review — [Partner] partnership" (type: `consultation`) | No |
| 8 | Chief of Staff | Optionally refers to Technology Advisor if technical scope is relevant. | Referral: "Technical scope review — [Partner] contract" (type: `consultation`) | No |
| 9 | Chief of Staff | Prepares in-app notification for Keith with summary. | — (notification, not a work object) | No |
| 10 | Legal Advisor (future) | Reviews contract terms. Flags legal risks. Suggests modifications. Adds source-linked analysis. | Agent Comment on Decision + Risk Tags | No |
| 11 | Product Strategy (if referred) | Reviews strategic fit. Adds analysis on partnership value. | Agent Comment on Decision + Opportunity Tags | No |
| 12 | Technology Advisor (if referred) | Reviews technical scope. Adds analysis on feasibility. | Agent Comment on Decision | No |
| 13 | Platform | Collects all agent inputs on the Decision ticket. Routes to Keith. | Approval Status: `pending_owner` | — |
| 14 | Keith | Reviews all agent inputs: Legal analysis, strategy analysis, technical analysis, risk/opportunity tags, draft reply. | — | — |
| 15 | Keith | Approves the reply draft (with or without modifications). Decides on contract terms. | Approval Status: `approved` or `modified` | Yes (this IS the approval) |
| 16 | Chief of Staff | Sends the approved reply email. | Audit Event: "External email sent" | Approval already granted in step 15 |
| 17 | Platform | Records final outcome. Updates all work objects. Closes referrals. | Audit Events: completion events | — |

### 25.3 Key Protocol Properties Demonstrated

- **Multi-agent collaboration:** 3-5 agents contribute to a single decision.
- **Referral chain:** Chief of Staff → Legal Advisor, Chief of Staff → Product Strategy, Chief of Staff → Technology Advisor. Depth = 2 (within limits).
- **Approval gate:** The external email (step 16) cannot be sent without Keith's approval (step 15).
- **Source-linked analysis:** Legal Advisor and Product Strategy cite knowledge base sources (contract templates, strategy docs).
- **Human-owner control:** Keith sees all agent inputs and makes the final call.
- **Audit trail:** Every step produces audit events.
- **Bounded:** The collaboration involves a known set of agents with clear responsibilities.

### 25.4 Scenario-Specific Safety Notes

- If Legal Advisor is not yet active (`coming_soon`), the referral is recorded but not executed. The platform notifies Keith that legal review is unavailable and the decision proceeds without it.
- If any agent's contribution contradicts another, both views are presented to Keith without suppression.
- No external reply is sent until Keith explicitly approves.

---

## 26. Source-Linked Recommendation Model

### 26.1 Principle

Business-critical recommendations made by agents must cite relevant source links from the common knowledge base. This ensures recommendations are grounded in verifiable evidence rather than unsupported inference.

### 26.2 Source-Linked Recommendation Rules

| Rule | Description |
|------|-------------|
| If recommendation uses a knowledge summary | Source link to the summary's origin document must be attached |
| If recommendation uses a key fact | Source link to the key fact's origin document and section must be attached |
| If recommendation is based on external input (email, document) | Source link to the external item must be attached |
| If no source is available | Recommendation must be marked as `unsupported` or `inference` |
| Business-critical recommendations without sources | Must be flagged as low-confidence |

### 26.3 Source Lineage Preservation

When a recommendation passes through multiple agents (e.g., Chief of Staff cites a fact from Legal Advisor's analysis, which itself came from a contract template in the knowledge base), the full source lineage must be preserved:

```
Recommendation → Agent Comment → Source Link → Knowledge Fact → Knowledge Document → Original Source
```

Each link in the chain is traceable. The human owner can navigate from the recommendation back to the original evidence.

### 26.4 Unsupported Recommendations

- Recommendations without source links are permitted for low-stakes observations and suggestions.
- Recommendations without source links are NOT permitted for:
  - Financial decisions
  - Contract advice
  - Strategic pivots
  - Policy interpretations
  - Legal risk assessments
- Unsupported business-critical recommendations must be explicitly marked with a confidence indicator and the human owner must be warned.

---

## 27. Relationship to Agent Registry

### 27.1 Manifest-Driven Collaboration

The agent registry (`frontend/lib/agent-platform/agent-registry.ts`) is the authoritative source for each agent's collaboration capabilities. Two manifest fields are directly relevant:

- **`referralRules`** (`AgentReferralRule[]`): Defines when and how this agent may refer work to other agents.
- **`approvalRules`** (`AgentApprovalRule[]`): Defines when this agent's actions require human or agent approval.

### 27.2 Registry as Collaboration Boundary

- Only agents with `enabled: true` and `status: 'active'` may participate in live collaboration.
- `coming_soon` agents may be referenced as future placeholders in referral rules but cannot execute or receive referrals until activated.
- Adding a new agent to the collaboration system requires adding a manifest entry — not modifying core platform code.
- Referral rules may only target agents that exist in the registry.

### 27.3 Referral Rule Types in Registry

From `agent-registry.ts`, `AgentReferralRule` defines:

```typescript
interface AgentReferralRule {
  id: string;
  triggerCondition: string;
  targetAgentId: AgentId;
  referralType: AgentReferralType;  // 'review' | 'handoff' | 'consultation' | 'approval'
  priority: AgentReferralPriority;  // 'normal' | 'urgent'
  autoCreate: boolean;
  requiresOwnerApproval: boolean;
}
```

### 27.4 Approval Rule Types in Registry

From `agent-registry.ts`, `AgentApprovalRule` defines:

```typescript
interface AgentApprovalRule {
  id: string;
  actionType: string;
  requiresHumanApproval: boolean;
  requiresAgentApproval: readonly AgentId[];
  approvalTimeoutHours: number;
  defaultOnTimeout: AgentApprovalDefaultOnTimeout;  // 'block' | 'allow'
}
```

### 27.5 Current Registry State

Currently all agent manifests have empty `referralRules: []` and `approvalRules: []`. These will be populated in future implementation slices (AGENT-COLLAB-01 and beyond) once the protocol is defined and static contracts are created.

---

## 28. Relationship to Common Knowledge Base

### 28.1 Knowledge as Collaboration Foundation

Agent collaboration (this protocol) requires that agents share a common understanding of company context. Without the knowledge base layer, agents cannot ground their referrals and recommendations in a shared source of truth.

### 28.2 How Collaboration Consumes Knowledge

- When an agent receives a referral, it receives a **Knowledge Pack** assembled from its declared scopes (summaries, key facts, source links).
- Agent comments and recommendations should cite **Source Links** that reference knowledge base documents.
- Decision work objects aggregate source-linked evidence from multiple agents.

### 28.3 Knowledge Scope and Collaboration Scope

- Knowledge scopes control what each agent may see.
- Collaboration does not expand an agent's knowledge access — an agent referred to a work object still only sees knowledge from its own declared scopes.
- Collaboration must not leak specialist/private knowledge to unauthorized agents. If Agent A cites a fact from its specialist scope in a work object, Agent B (which lacks that scope) sees the recommendation but cannot access the underlying source.

### 28.4 Source Link Integrity

- Work objects should store source links as first-class properties.
- Source links in collaboration reference the same `KnowledgeSourceLink` structure defined in AGENT-KNOWLEDGE-00.
- The collaboration protocol reuses (not duplicates) the knowledge base source traceability model.

---

## 29. Relationship to Agent Harness Audit Events

### 29.1 Two Audit Layers

The platform has two related but separate audit event layers:

| Layer | Scope | Events |
|-------|-------|--------|
| **Harness audit events** | Single-agent execution lifecycle | `harness.loop_started`, `harness.model_invocation_completed`, `harness.tool_dispatch_completed`, etc. |
| **Collaboration audit events** | Multi-agent work object lifecycle | `collaboration.referral_created`, `collaboration.approval_granted`, `collaboration.session_completed`, etc. |

### 29.2 Shared Principles

Both layers share the same privacy-conscious design:

- Events record metadata, not content.
- No prompt text, model output, or document content in events.
- Events carry identifiers (execution ID, session ID, work object ID, referral ID) for correlation.
- Events are append-only and immutable.

### 29.3 Correlation

Future implementation can correlate the two layers via shared identifiers:

- `sessionId` — links harness execution to the user session.
- `executionId` — links a specific agent execution to its collaboration contributions.
- `workObjectId` — links collaboration work objects to the harness executions that produced them.
- `referralId` — links referrals to the harness executions triggered by them.

### 29.4 Harness Non-Goals for This Task

- No harness code changes.
- No new harness event types.
- No harness activation.
- The collaboration audit event layer is defined conceptually here but will be implemented separately.

---

## 30. Relationship to Billing / Credits

### 30.1 Collaboration Cost Drivers

Multi-agent collaboration consumes more model/tool usage than single-agent execution:

| Cost Driver | Description |
|-------------|-------------|
| Multiple agent invocations | Each referred agent consumes model tokens |
| Knowledge Pack assembly | Each agent receives a scope-filtered knowledge pack |
| Work object persistence | Storage for tickets, decisions, drafts, comments |
| Audit event storage | Immutable event logs |
| Notification delivery | In-app and future external notifications |
| Scheduled collaboration scans | Future: periodic agent scans that trigger referrals |

### 30.2 Billable Collaboration Events

The following collaboration activities should be billable events in the future credit model:

- Agent invocation triggered by a referral.
- Knowledge Pack assembly for a referred agent.
- Work object creation (if the number exceeds plan limits).
- Scheduled scan execution.
- External notification delivery (future).

### 30.3 Billing Deferred

- Exact billing rates for collaboration are deferred to BILLING-READY-00.
- The collaboration protocol must be designed so that all collaboration actions are attributable to a tenant and measurable in token/compute/storage units.
- Collaboration must not enable unbounded cost accumulation — safety limits (section 8) bound the maximum cost of a single collaboration session.

---

## 31. Relationship to Future Integrations

### 31.1 Integrations as Collaboration Triggers

Future external connectors (Slack, Gmail, Notion, Calendar) are sources of collaboration triggers:

| Integration | Trigger Type | Example |
|-------------|--------------|---------|
| Gmail | Incoming email detection | Contract negotiation email triggers Chief of Staff |
| Slack | Channel message or DM | Urgent request triggers ticket creation |
| Notion | Page update or database change | Strategy document update triggers knowledge refresh and agent review |
| Calendar | Meeting creation or change | Upcoming meeting triggers meeting prep workflow |

### 31.2 Integrations as Collaboration Actions

Future connectors may also be action destinations requiring approval:

| Integration | Action Type | Approval Required |
|-------------|-------------|-------------------|
| Gmail | Send email | Always |
| Slack | Post message to external channel | Always |
| Notion | Update shared page | Depends on sensitivity |
| Calendar | Create/modify meeting | Low-risk if internal |

### 31.3 Integration Safety

- All external connector actions require approval gates.
- Incoming events may trigger collaboration, but the trigger itself does not bypass approval.
- Integration connector authorization is controlled by the human owner (see AGENT-KNOWLEDGE-00 section 23).
- Integration runtime is deferred — this plan establishes that connectors interact with the collaboration protocol through the same trigger → referral → approval → action flow.

### 31.4 No Integration Implementation in This Task

All integration implementation is deferred. This plan establishes that integrations are future collaboration participants that the protocol must accommodate, not current implementation targets.

---

## 32. Data Object Concepts

These are conceptual shapes only. They do not define a final database schema, ORM model, or API contract.

### 32.1 CollaborationSession

```
CollaborationSession {
  id: string
  tenantId: string
  triggerType: string              // 'email' | 'user_request' | 'scheduled_scan' | 'agent_detection'
  triggerRef: string               // reference to the triggering item
  status: enum                     // 'active' | 'paused' | 'completed' | 'cancelled'
  rootWorkObjectId: string
  participatingAgentIds: string[]
  referralChain: ReferralChainEntry[]
  currentDepth: number
  createdAt: timestamp
  completedAt: timestamp | null
  auditEvents: string[]            // audit event IDs
}
```

### 32.2 WorkObject

```
WorkObject {
  id: string
  tenantId: string
  type: enum                       // 'ticket' | 'decision' | 'draft' | 'referral' | 'meeting_topic'
  title: string
  description: string
  createdBy: string                // agent ID or 'owner'
  status: string
  priority: string
  parentWorkObjectId: string | null
  collaborationSessionId: string
  agentComments: string[]          // comment IDs
  riskTags: string[]               // risk tag IDs
  opportunityTags: string[]        // opportunity tag IDs
  sourceLinks: string[]            // source link IDs
  approvalStatus: ApprovalStatus | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 32.3 Ticket

```
Ticket extends WorkObject {
  type: 'ticket'
  assignedTo: string | null        // agent ID or 'owner'
  dueDate: timestamp | null
  ticketStatus: enum               // 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
}
```

### 32.4 Decision

```
Decision extends WorkObject {
  type: 'decision'
  options: DecisionOption[]
  recommendation: string | null    // recommended option ID
  outcome: string | null           // final decision text
  outcomeOptionId: string | null   // which option was chosen
}

DecisionOption {
  id: string
  label: string
  description: string
  agentSupport: string[]           // agent IDs that support this option
}
```

### 32.5 Draft

```
Draft extends WorkObject {
  type: 'draft'
  draftType: enum                  // 'email_reply' | 'document' | 'contract_response' | 'announcement' | 'report'
  content: string
  target: string                   // intended recipient or destination
  draftStatus: enum                // 'draft' | 'under_review' | 'approved' | 'rejected' | 'sent'
}
```

### 32.6 Referral

```
Referral extends WorkObject {
  type: 'referral'
  sourceAgentId: string
  targetAgentId: string
  referralType: enum               // 'review' | 'handoff' | 'consultation' | 'approval'
  referralStatus: enum             // 'open' | 'in_progress' | 'contributed' | 'completed' | 'rejected' | 'blocked' | 'expired'
  idempotencyKey: string
  chainDepth: number
  contextSummary: string
  contributions: string[]          // agent comment IDs from target agent
}
```

### 32.7 AgentComment

```
AgentComment {
  id: string
  tenantId: string
  authorAgentId: string
  targetWorkObjectId: string
  commentType: enum                // 'analysis' | 'recommendation' | 'question' | 'observation' | 'risk_flag' | 'opportunity_flag'
  content: string
  sourceLinks: string[]            // source link IDs
  confidenceLevel: enum            // 'high' | 'medium' | 'low'
  createdAt: timestamp
}
```

### 32.8 RiskTag

```
RiskTag {
  id: string
  tenantId: string
  label: string
  severity: enum                   // 'low' | 'medium' | 'high' | 'critical'
  description: string
  taggedBy: string                 // agent ID
  targetWorkObjectId: string
  sourceLinks: string[]
  mitigationSuggestion: string | null
  createdAt: timestamp
}
```

### 32.9 OpportunityTag

```
OpportunityTag {
  id: string
  tenantId: string
  label: string
  impact: enum                     // 'low' | 'medium' | 'high'
  description: string
  taggedBy: string                 // agent ID
  targetWorkObjectId: string
  sourceLinks: string[]
  actionSuggestion: string | null
  createdAt: timestamp
}
```

### 32.10 SourceLink

```
SourceLink {
  id: string
  tenantId: string
  documentId: string | null        // knowledge base document ID
  documentTitle: string
  scopeId: string | null           // knowledge scope
  sectionRef: string | null        // heading, page, or section
  sourceType: enum                 // 'knowledge_summary' | 'knowledge_fact' | 'external_email' | 'external_document' | 'url'
  externalRef: string | null       // URL or external item reference
  uploadDate: string | null
}
```

### 32.11 ApprovalStatus

```
ApprovalStatus {
  id: string
  tenantId: string
  workObjectId: string
  status: enum                     // 'not_required' | 'pending_agent' | 'pending_owner' | 'approved' | 'rejected' | 'modified' | 'expired'
  requiredApproverType: enum       // 'human_owner' | 'agent'
  requiredApproverId: string | null
  requestedAt: timestamp
  resolvedAt: timestamp | null
  resolvedBy: string | null
  modificationNotes: string | null
  timeoutHours: number
  defaultOnTimeout: enum           // 'block' | 'allow'
}
```

### 32.12 CollaborationAuditEvent

```
CollaborationAuditEvent {
  id: string
  eventType: string                // e.g., 'collaboration.referral_created'
  timestamp: number
  tenantId: string
  collaborationSessionId: string
  workObjectId: string | null
  workObjectType: string | null
  agentId: string | null
  referralId: string | null
  metadata: Record<string, string | number | boolean>
}
```

### 32.13 ApprovalGate

```
ApprovalGate {
  id: string
  tenantId: string
  actionCategory: string           // 'external_email' | 'contract' | 'payment' | 'public_content' | 'destructive' | 'binding_commitment'
  requiresHumanApproval: boolean   // always true for high-risk categories
  timeoutHours: number
  defaultOnTimeout: enum           // always 'block' for high-risk
  description: string
}
```

### 32.14 ReferralRule

```
ReferralRule {
  id: string
  tenantId: string
  agentId: string                  // agent that owns this rule
  triggerCondition: string         // condition expression
  targetAgentId: string
  referralType: enum               // 'review' | 'handoff' | 'consultation' | 'approval'
  priority: enum                   // 'normal' | 'urgent'
  autoCreate: boolean
  requiresOwnerApproval: boolean
  enabled: boolean
}
```

### 32.15 IdempotencyRecord

```
IdempotencyRecord {
  id: string
  tenantId: string
  idempotencyKey: string           // computed composite key
  sourceItemId: string
  triggeringAgentId: string
  targetAgentId: string
  referralType: string
  workObjectId: string
  normalizedTriggerReason: string
  outcome: enum                    // 'created' | 'duplicate_ignored' | 'version_incremented'
  existingReferralId: string | null
  createdAt: timestamp
}
```

---

## 33. Safety and Abuse Prevention

### 33.1 External Perimeter Control

- Human-owner approval is required for all external-facing actions.
- No agent may send emails, post messages, publish content, make payments, or commit to agreements without explicit approval.
- Approval gates cannot be bypassed by any referral chain or agent interaction.

### 33.2 Rate Limits for Automatic Referrals

- `maxAutomaticReferralsPerIncomingItem` prevents a single trigger from spawning excessive referrals.
- `maxOpenReferralsPerAgent` prevents a single agent from being overwhelmed.
- Rate limits are configurable per tenant but have platform-enforced minimums.

### 33.3 No Infinite Loops

- Referral loop detection (section 10) prevents A→B→A cycles.
- Depth limits prevent unbounded chain growth.
- Safety limit escalation ensures the human owner is always notified when limits are reached.

### 33.4 No Hidden Agent Actions

- Every collaboration action produces an audit event.
- Agents cannot create work objects, referrals, or comments without corresponding audit events.
- There is no "off-the-record" channel between agents.

### 33.5 No Source-Free High-Confidence Business-Critical Advice

- Business-critical recommendations must cite source links (section 26).
- Unsupported recommendations must be flagged as low-confidence.
- The human owner is warned when business-critical advice lacks knowledge base evidence.

### 33.6 No Cross-Tenant / Cross-Scope Leakage

- Collaboration is tenant-scoped. Work objects from tenant A are not visible to tenant B.
- Knowledge scope boundaries are preserved during collaboration. An agent cannot access another agent's specialist scope via a referral.
- Source links respect scope access control — agents can only cite sources from their own declared scopes.

### 33.7 No External Send/Publish/Payment Without Approval

This is repeated for emphasis: the collaboration protocol's most critical safety property is that no external action is ever taken without explicit human-owner approval. This invariant must be preserved at every layer of implementation.

---

## 34. Proposed Follow-Up Roadmap

These tasks are proposed, not registered. Registration requires explicit approval.

| Task ID | Name | Description |
|---------|------|-------------|
| AGENT-COLLAB-01 | Collaboration Domain Types and Static Protocol Contracts | Define TypeScript interfaces for collaboration work objects, referral lifecycle, and audit events. Static types only, no runtime. |
| AGENT-COLLAB-02 | Work Object and Referral Schema Architecture | Design database schema for work objects, referrals, and collaboration sessions. Schema planning, not migration. |
| AGENT-COLLAB-03 | Approval Gate Architecture | Design the approval gate enforcement layer: which actions require approval, timeout handling, notification routing. |
| AGENT-COLLAB-04 | Chief of Staff Scenario Prototype Plan | Design the Chief of Staff agent's contract-negotiation workflow as a concrete implementation plan. |
| AGENT-KNOWLEDGE-01 | Knowledge Domain Types and Static Scope Registry | Define TypeScript interfaces for knowledge scopes, documents, and source links. Static registry of scope IDs. |
| BILLING-READY-00 | Billing, Plan, Credit, and Entitlement Audit | Audit existing usage tracking. Define credit model for collaboration, knowledge, and agent invocations. |
| Next Agent Harness slice | TBD | Decide after collaboration plan — may involve knowledge pack injection or collaboration-triggered execution. |

---

## 35. Acceptance Criteria

These map to the Planning Acceptance Criteria in TASKS.md (AGENT-COLLAB-00):

- [x] Planning document created: `docs/AGENT-COLLAB-00-COLLABORATION-PROTOCOL-PLAN.md`.
- [x] Agent referral lifecycle defined (section 7).
- [x] Collaboration safety limits defined (section 8).
- [x] Shared work object concepts defined (sections 11–18).
- [x] Approval gates defined (section 24).
- [x] Idempotency and loop prevention model defined (sections 9–10).
- [x] Agent-to-agent contribution model defined (section 22).
- [x] Human-owner control model defined (section 23).
- [x] Source-linked recommendation model defined (section 26).
- [x] Relationship to Agent Registry defined (section 27).
- [x] Relationship to Common Knowledge Base defined (section 28).
- [x] Relationship to Agent Harness audit events defined (section 29).
- [x] Relationship to Billing/credits defined (section 30).
- [x] Relationship to future integrations defined (section 31).
- [x] Future implementation roadmap proposed (section 34).
- [x] Explicit non-goals confirmed (section 4).

---

## 36. Open Questions / Deferred Decisions

| Question | Deferred To |
|----------|-------------|
| Final database schema for collaboration objects | AGENT-COLLAB-02 |
| Whether collaboration state lives in existing sessions or new work-object tables | AGENT-COLLAB-02 |
| Exact default values for safety limits (maxReferralDepth, etc.) | AGENT-COLLAB-01 or AGENT-COLLAB-02 |
| Whether Legal Advisor becomes the first specialist future agent | Product decision (Keith) |
| Whether Slack notification is in-app first or external Slack first | Integration planning task |
| How approval UI should be designed | Future UX/UI task |
| How billing units should price multi-agent collaboration | BILLING-READY-00 |
| Which collaboration slice should be first implementation | Keith decision after this plan review |
| How referral trigger conditions are expressed (regex, keyword, LLM classification) | AGENT-COLLAB-01 |
| Whether `coming_soon` agents should record deferred referrals or silently skip | AGENT-COLLAB-01 |
| How to handle the case where all contributing agents disagree | AGENT-COLLAB-03 |
| Whether collaboration sessions persist across user login sessions | AGENT-COLLAB-02 |
| How to surface collaboration activity in the RPG dashboard UI | Future UX/UI task |
| Maximum content size for drafts and agent comments | AGENT-COLLAB-01 |
| GDPR/privacy implications of storing multi-agent collaboration history | Future compliance/security review |

---

*Document created: 2026-07-06*
*Task: AGENT-COLLAB-00*
*Status: Planning complete — ready for Keith review and consolidation/checkpoint*
