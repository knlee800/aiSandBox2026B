# AGENT-PLATFORM-00 — ainow.biz Multi-Agent Platform Master Plan

**Status:** ACTIVE planning output
**Task ID:** AGENT-PLATFORM-00
**Family:** AGENT PLATFORM / AINOW.BIZ MULTI-AGENT
**Scope:** Documentation only — no implementation, no source edits, no checkpoint

---

## 1. Executive Summary

ainow.biz is the evolution of aiSandBox from a standalone AI coding sandbox into a general-purpose multi-agent work platform.

The current aiSandBox application — with its AI execution, workspace containers, file-action pipeline, checkpoint/revert system, and the in-progress Agent Harness — becomes the first real agent module: **Builder Agent**.

ainow.biz will host multiple specialized agents that collaborate on real business work: software development, strategic planning, daily operations, contract review, and more. Users interact with agents through an RPG-inspired office/town dashboard. Each agent has its own skills, knowledge scopes, tools, and model configuration. Agents can refer work to each other, create shared tickets and decisions, and route approvals to the human owner.

This document defines the product model, agent architecture, collaboration protocol, knowledge model, work objects, UX direction, billing model, and phased delivery roadmap. It does not implement any of these — it provides the authoritative planning foundation for all follow-up implementation tasks.

---

## 2. Product Model

### 2.1 Platform Identity

| Concern | Value |
|---------|-------|
| Platform name/domain direction | ainow.biz |
| Platform type | General-purpose multi-agent work platform |
| First agent module | Builder Agent (current aiSandBox) |
| Target user | Solo founders, small teams, indie operators |
| Core value proposition | Your AI team — specialized agents that collaborate on real work |

### 2.2 ainow.biz as the Main Platform

ainow.biz is the top-level product. It provides:

- **Agent registry** — manages available agents, their manifests, lifecycle, and routing.
- **Dashboard shell** — the RPG office/town visual environment where users discover and interact with agents.
- **Common knowledge base** — shared organizational context available to all agents.
- **Collaboration protocol** — referrals, shared tickets, decisions, and approval gates between agents.
- **Work object system** — tickets, drafts, decisions, referrals, meeting topics, and audit trail.
- **Billing and entitlement** — plan-based credits, usage tracking, and commercial readiness.
- **User identity and settings** — authentication, preferences, language, and organization context.

### 2.3 aiSandBox as Builder Agent

The current aiSandBox application becomes Builder Agent — the first fully functional agent on the ainow.biz platform.

| Concern | Current (aiSandBox) | Future (Builder Agent on ainow.biz) |
|---------|---------------------|--------------------------------------|
| Identity | Standalone app | Agent module with manifest entry in agent registry |
| Workspace | Docker container with /workspace | Same — Docker container with /workspace |
| AI execution | Single-shot prompt → file-actions | Agent Harness multi-turn tool loop (when activated) |
| File operations | File-action parse → apply → checkpoint | Same, plus tool-based file ops via Agent Harness |
| Preview | Static + dev server proxy | Same |
| Checkpoint/revert | Git-based checkpoint system | Same |
| Billing | Usage records (tokens, executions) | Unified credit model via ainow.biz billing |
| Routing | Direct `/app` route | Agent-specific route within ainow.biz dashboard |

### 2.4 FlowCanvas / Workspace Naming Implications

The current workspace concept (session → container → /workspace) remains the execution environment for Builder Agent. The term "FlowCanvas" (used in some earlier planning) may be repurposed or retired as the platform evolves. For now, the existing workspace/session model is preserved as-is within Builder Agent. The platform-level dashboard is a separate UX layer above individual agent workspaces.

---

## 3. First Visible Agents and Status

| Agent | Status | Description |
|-------|--------|-------------|
| **Builder Agent** | REAL — existing aiSandBox | AI coding agent. Builds software inside isolated Docker containers. Full workspace, file ops, preview, checkpoint/revert. Powered by Agent Harness. |
| **Chief of Staff Agent** | COMING SOON — placeholder | Daily operations assistant. Email triage, to-do management, meeting prep, contract coordination, scheduling. |
| **Product Strategy Agent** | COMING SOON — placeholder | Strategic planning assistant. Market analysis, competitive research, product roadmap drafting, OKR tracking. |
| **Technology Advisor Agent** | COMING SOON — placeholder | Technology decisions assistant. Architecture review, tech stack evaluation, vendor comparison, technical debt assessment. |

Only Builder Agent has real implementation. The other three are placeholder entries in the agent registry — visible on the dashboard as "coming soon" but not functional.

---

## 4. Agent Registry Concept

The agent registry is a typed, declarative data structure that defines all available agents on the platform. It is the single source of truth for agent discovery, routing, permissions, and lifecycle.

### 4.1 Registry Properties

- **Declarative:** Agents are defined as data (manifest entries), not hardcoded in application logic.
- **Extensible:** Adding a new agent requires adding a manifest entry, not modifying core platform code.
- **Versioned:** Manifest schema is versioned to support future field additions without breaking existing agents.
- **Typed:** All manifest fields have defined TypeScript types.
- **Multilingual:** All user-facing text fields (name, role, description) use translation keys, not hardcoded strings.

### 4.2 Registry Operations

| Operation | Description |
|-----------|-------------|
| `list()` | Return all registered agent manifests |
| `get(id)` | Return a specific agent manifest by ID |
| `listEnabled()` | Return only agents with `enabled: true` |
| `listByStatus(status)` | Return agents filtered by status (active, coming_soon, disabled) |

The registry is read-only at runtime. Agent registration is a deployment/configuration concern, not a runtime mutation.

---

## 5. Agent Manifest Fields

Each agent is defined by a manifest with the following fields:

```typescript
interface AgentManifest {
  id: string;
  nameKey: string;
  roleKey: string;
  descriptionKey: string;
  route: string;
  avatarRef: string;
  spriteRef?: string;
  status: 'active' | 'coming_soon' | 'disabled';
  enabled: boolean;
  modelProfile: AgentModelProfile;
  toolPermissions: AgentToolPermissions;
  knowledgeScopes: string[];
  skills: AgentSkillRef[];
  referralRules: AgentReferralRule[];
  approvalRules: AgentApprovalRule[];
  manifestVersion: number;
}
```

### 5.1 Field Descriptions

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `string` | Unique agent identifier (e.g., `builder`, `chief-of-staff`) |
| `nameKey` | `string` | Translation key for agent display name (e.g., `agents.builder.name`) |
| `roleKey` | `string` | Translation key for agent role title (e.g., `agents.builder.role`) |
| `descriptionKey` | `string` | Translation key for agent description (e.g., `agents.builder.description`) |
| `route` | `string` | Platform route path (e.g., `/agents/builder`) |
| `avatarRef` | `string` | Reference to agent avatar/portrait asset |
| `spriteRef` | `string?` | Optional reference to RPG sprite sheet for dashboard animation |
| `status` | `enum` | Agent lifecycle status: `active`, `coming_soon`, `disabled` |
| `enabled` | `boolean` | Whether the agent is accessible to users |
| `modelProfile` | `AgentModelProfile` | Default model configuration for this agent |
| `toolPermissions` | `AgentToolPermissions` | Which tools this agent may use |
| `knowledgeScopes` | `string[]` | Knowledge scope IDs this agent can access |
| `skills` | `AgentSkillRef[]` | Skill definitions available to this agent |
| `referralRules` | `AgentReferralRule[]` | Rules for when this agent refers work to other agents |
| `approvalRules` | `AgentApprovalRule[]` | Rules for when this agent requires human approval |
| `manifestVersion` | `number` | Schema version for forward compatibility |

### 5.2 AgentModelProfile

```typescript
interface AgentModelProfile {
  defaultModelId: string;
  fallbackModelId?: string;
  maxTokensPerTurn: number;
  maxTurnsPerSession: number;
  temperature: number;
  costTier: 'low' | 'medium' | 'high';
}
```

### 5.3 AgentToolPermissions

```typescript
interface AgentToolPermissions {
  allowedTools: string[];
  blockedTools: string[];
  requireApprovalTools: string[];
  maxToolCallsPerTurn: number;
  maxToolCallsPerSession: number;
}
```

---

## 6. Per-Agent Skills Model

Each agent has a set of skills that define its specialized capabilities. Skills are more granular than the agent itself — they represent specific competencies the agent can apply.

### 6.1 Skill Reference

```typescript
interface AgentSkillRef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  category: 'core' | 'specialist' | 'integration';
  promptTemplateRef?: string;
  toolSet?: string[];
  knowledgeScopeOverrides?: string[];
}
```

### 6.2 Example Skills by Agent

**Builder Agent:**
- `code-generation` — Generate application code from user requirements
- `code-review` — Review and suggest improvements to existing code
- `test-writing` — Write tests for application code
- `debugging` — Diagnose and fix issues using validation runner
- `file-management` — Create, read, update, delete workspace files
- `project-setup` — Initialize project structures and configurations

**Chief of Staff Agent (future):**
- `email-triage` — Classify and prioritize incoming emails
- `meeting-prep` — Prepare agendas and background materials for meetings
- `todo-management` — Create, prioritize, and track daily tasks
- `contract-coordination` — Route contracts through review and approval
- `scheduling` — Propose meeting times and manage calendar conflicts

**Product Strategy Agent (future):**
- `market-analysis` — Research market trends and competitive landscape
- `roadmap-drafting` — Draft and iterate product roadmaps
- `okr-tracking` — Track objectives and key results progress
- `user-research-synthesis` — Synthesize user feedback and research findings

**Technology Advisor Agent (future):**
- `architecture-review` — Review system architecture decisions
- `tech-stack-evaluation` — Compare technology options with trade-off analysis
- `vendor-comparison` — Evaluate vendor offerings against requirements
- `tech-debt-assessment` — Identify and prioritize technical debt

---

## 7. Knowledge Scopes: Shared vs Private/Specialist

### 7.1 Knowledge Scope Model

```typescript
interface KnowledgeScope {
  id: string;
  nameKey: string;
  type: 'shared' | 'specialist';
  accessibleBy: string[];
  sources: KnowledgeSource[];
  refreshPolicy: 'manual' | 'daily' | 'weekly';
}
```

### 7.2 Shared Knowledge Scopes

Shared scopes are accessible to all (or most) agents. They provide common organizational context.

| Scope ID | Description | Accessible By |
|----------|-------------|---------------|
| `company-monthly-reports` | Monthly business performance reports | All agents |
| `three-year-goals` | Long-term strategic goals and milestones | All agents |
| `strategy-docs` | Strategic planning documents | All agents |
| `policies` | Company policies, procedures, guidelines | All agents |
| `meeting-summaries` | Summaries of past meetings and decisions | All agents |

### 7.3 Specialist Knowledge Scopes

Specialist scopes are accessible only to specific agents.

| Scope ID | Description | Accessible By |
|----------|-------------|---------------|
| `codebase-context` | Repository structure, patterns, architecture | Builder Agent |
| `contract-templates` | Standard contract templates and terms | Chief of Staff Agent, Legal Advisor (future) |
| `market-data` | Market research data and competitor intel | Product Strategy Agent |
| `tech-landscape` | Technology trend data and vendor evaluations | Technology Advisor Agent |

### 7.4 Knowledge Scope Access Rules

- An agent can only access knowledge scopes listed in its `knowledgeScopes` manifest field.
- Shared scopes are included by default for all enabled agents unless explicitly excluded.
- Specialist scopes are opt-in per agent manifest.
- Knowledge scope access is enforced at the platform layer, not inside individual agents.

### 7.5 Knowledge Privacy and Access Controls

Knowledge sources may contain sensitive company data (financial reports, contracts, strategy documents, personnel policies). The following privacy and access control principles apply:

- **Tenant/organization isolation:** Knowledge data must be isolated per tenant/organization. No agent or user may access knowledge belonging to a different tenant.
- **Manifest-scoped access:** Agents can only access knowledge scopes assigned in their manifest `knowledgeScopes` field. The platform enforces this at the access layer, not inside individual agents.
- **Granular access levels:** Raw/full content access should be controlled separately from summary/key-fact access. A future knowledge architecture task (AGENT-KNOWLEDGE-00) must define whether some agents receive only summaries while others may access full source content.
- **Source traceability:** Every knowledge item must retain a reference to its original source (`sourceRef`). When an agent uses knowledge in its output, the source should be traceable for audit and verification purposes.
- **Retention and deletion:** Knowledge items must support configurable retention periods and explicit deletion by the owner. Retention/deletion policy details must be addressed in the future knowledge architecture task (AGENT-KNOWLEDGE-00).
- **No cross-scope leakage:** An agent operating on a work object must not embed or quote specialist knowledge from a scope that the receiving agent or human reviewer does not have access to. Enforcement details are deferred to AGENT-KNOWLEDGE-00.

---

## 8. Common Knowledge Base Layer

### 8.1 Purpose

The common knowledge base is the platform-level service that ingests, normalizes, stores, and serves organizational knowledge to agents. It is the foundation for context-aware agent behavior.

### 8.2 Knowledge Source Types

| Source Type | Examples | Processing |
|-------------|----------|------------|
| Company monthly reports | PDF/markdown reports uploaded by user | Markdown normalization, summary extraction, key facts extraction |
| Three-year goals | Strategy documents | Structured extraction of goals, milestones, metrics |
| Strategy docs | Planning documents, competitive analyses | Summary extraction, key facts |
| Policies | HR policies, security policies, operational procedures | Structured section extraction |
| Meeting summaries | Meeting notes, decision logs | Key decisions extraction, action items extraction |

### 8.3 Processing Pipeline

```
Source document
  → Format detection (PDF, markdown, text, HTML)
  → Markdown normalization
  → Summary extraction (concise summary per document)
  → Key facts extraction (structured facts for agent consumption)
  → Storage (indexed by scope, source, date)
  → Availability to agents via knowledge scope access
```

### 8.4 Refresh Policy

- **Initial:** Manual upload by user.
- **Later:** Weekly automated refresh for connected sources (email digests, shared drive sync).
- **Processing:** Incremental — only new/changed documents are re-processed on refresh.

### 8.5 Storage Model

Knowledge items are stored as structured objects:

```typescript
interface KnowledgeItem {
  id: string;
  scopeId: string;
  sourceType: string;
  sourceRef: string;
  title: string;
  summary: string;
  keyFacts: string[];
  fullContent: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}
```

---

## 9. Agent-to-Agent Collaboration Model

### 9.1 Design Principles

- Collaboration is structured, not ad-hoc. Agents follow defined referral and approval rules.
- More than two agents can participate in a collaboration workflow.
- Typical collaboration involves 4-5 agents for complex business decisions.
- All collaboration produces an audit trail.
- The human owner (Keith) is always the final authority for external-facing actions.

### 9.2 Collaboration Mechanisms

| Mechanism | Description |
|-----------|-------------|
| **Automatic referral** | Agent A creates a referral to Agent B based on referral rules in Agent A's manifest. |
| **Shared tickets** | Multiple agents contribute to the same ticket (comments, analysis, recommendations). |
| **Shared decisions** | A decision object collects input from multiple agents before routing to human approval. |
| **Approval gates** | Certain actions require approval from specific agents or the human owner before proceeding. |
| **Agent comments** | An agent can comment on work objects created by other agents. |
| **Audit trail** | Every collaboration action is logged as an audit event. |

### 9.3 Referral Rules

```typescript
interface AgentReferralRule {
  id: string;
  triggerCondition: string;
  targetAgentId: string;
  referralType: 'review' | 'handoff' | 'consultation' | 'approval';
  priority: 'normal' | 'urgent';
  autoCreate: boolean;
  requiresOwnerApproval: boolean;
}
```

**Example referral rules for Chief of Staff Agent:**

| Trigger | Target Agent | Type | Auto-create |
|---------|-------------|------|-------------|
| Email contains contract/legal terms | Legal Advisor (future) | `review` | Yes |
| Email mentions technical architecture | Technology Advisor | `consultation` | Yes |
| Task involves building software | Builder Agent | `handoff` | Yes |
| Decision involves strategic direction | Product Strategy Agent | `consultation` | Yes |

### 9.4 Approval Rules

```typescript
interface AgentApprovalRule {
  id: string;
  actionType: string;
  requiresHumanApproval: boolean;
  requiresAgentApproval: string[];
  approvalTimeoutHours: number;
  defaultOnTimeout: 'block' | 'allow';
}
```

**Approval timeout safety rules:**

- The default timeout behavior is `block`. No action is taken if the approval timeout expires without a decision.
- For external-facing, destructive, financial, contract, public-facing, legal, permission-changing, or binding commitment actions, `defaultOnTimeout` must always be `block`. This is not configurable per rule — the platform enforces it for these action categories regardless of the manifest value.
- `allow` may only be used for low-risk internal actions where failing to act within the timeout window has no external consequence (e.g., auto-closing a stale internal review referral).
- Any attempt to set `defaultOnTimeout: 'allow'` on a high-risk action category must be rejected at manifest validation time.

### 9.5 Multi-Agent Collaboration Flow

```
Agent A detects trigger condition
  → Agent A creates referral work object
  → Platform routes referral to Agent B
  → Agent B processes referral and adds analysis/recommendation
  → (Optional) Agent B creates sub-referral to Agent C
  → Agent C adds input
  → All agent inputs collected on shared decision object
  → Decision routed to human owner for final approval
  → Human approves/rejects/modifies
  → Decision outcome recorded as audit event
  → Downstream actions triggered (if approved)
```

### 9.6 Collaboration Safety Limits

Agent-to-agent collaboration must be bounded to prevent runaway referral chains, circular loops, and unbounded resource consumption.

| Safety Limit | Description |
|-------------|-------------|
| **Maximum referral depth** | A configurable limit on how many levels deep a referral chain can go (e.g., Agent A → B → C → D). When the limit is reached, the platform pauses the chain and notifies the owner. |
| **Maximum agents per collaboration** | A configurable limit on how many distinct agents may participate in a single collaboration workflow. Exceeding this limit requires owner approval to continue. |
| **Duplicate referral detection** | Each referral carries an idempotency key derived from the source work object, target agent, and referral type. The platform rejects duplicate referrals with the same idempotency key to prevent redundant work. |
| **Referral loop prevention** | The platform tracks the referral chain path. If a referral would route back to an agent already in the chain for the same work object, the referral is blocked and the owner is notified. |
| **Threshold pause and owner approval** | When any collaboration safety limit is reached — depth, agent count, or loop detection — the platform pauses the collaboration, logs an audit event, and requires explicit owner approval before continuing. |

These limits are conceptual and will be defined as concrete configuration values in a future collaboration architecture task (AGENT-COLLAB-00). The implementation must not rely on unbounded recursion or unchecked agent-to-agent routing.

---

## 10. Example Workflow: Contract Negotiation

This example illustrates multi-agent collaboration on a real business scenario.

### 10.1 Trigger

Keith receives an agency contract negotiation email from a business partner.

### 10.2 Workflow Steps

| Step | Agent | Action | Work Objects Created |
|------|-------|--------|---------------------|
| 1 | Chief of Staff | Receives and triages the email. Identifies it as a contract negotiation. | Ticket: "Agency contract negotiation — [Partner Name]" |
| 2 | Chief of Staff | Drafts a preliminary reply acknowledging receipt and requesting clarification on key terms. | Draft: "Reply to [Partner] — acknowledgment + clarification request" |
| 3 | Chief of Staff | Creates a daily to-do item for Keith to review the draft reply. | Ticket: "Review contract reply draft — [Partner]" (daily to-do) |
| 4 | Chief of Staff | Creates a decision ticket for the contract terms. | Decision: "Accept/modify/reject [Partner] agency terms" |
| 5 | Chief of Staff | Refers the contract to Legal Advisor (future) for legal review. | Referral: "Legal review — [Partner] agency contract" |
| 6 | Chief of Staff | Sends notification via Slack/app to Keith. | — (notification, not a work object) |
| 7 | Legal Advisor (future) | Reviews contract terms, flags risks, suggests modifications. | Agent comment on Decision ticket + Risk tags |
| 8 | Product Strategy | Reviews strategic fit of the partnership. | Agent comment on Decision ticket + Opportunity tags |
| 9 | Platform | Collects all agent inputs on the Decision ticket. Routes to Keith. | Approval status: "pending_owner" |
| 10 | Keith | Reviews all agent inputs. Approves the reply draft (with modifications). Approves or modifies the contract decision. | Approval status: "approved" / Audit event logged |
| 11 | Chief of Staff | Sends the approved reply email. Records the outcome. | Audit event: "Contract reply sent" |

### 10.3 Approval Gate

The reply email (step 11) is an external-facing action. It cannot be sent without Keith's explicit approval (step 10). The Chief of Staff Agent creates the draft but does not send it autonomously.

---

## 11. Work Object Concepts

Work objects are the structured data units that agents create, modify, and collaborate on. They form the shared workspace for multi-agent coordination.

### 11.1 Work Object Types

| Type | Purpose | Example |
|------|---------|---------|
| **Ticket** | A task or action item to be tracked | "Review contract reply draft" |
| **Decision** | A choice requiring input from multiple agents and/or human approval | "Accept/modify/reject agency terms" |
| **Draft** | A document or message draft created by an agent for review | "Reply email to partner" |
| **Referral** | A request from one agent to another for review, handoff, or consultation | "Legal review of contract" |
| **Meeting Topic** | An item to be discussed in a future meeting | "Discuss partnership terms with [Partner]" |
| **Agent Comment** | An agent's analysis, recommendation, or note on a work object | "Legal risk: clause 4.2 limits liability to..." |
| **Risk Tag** | A risk flag attached to a work object | "Risk: unlimited liability clause" |
| **Opportunity Tag** | An opportunity flag attached to a work object | "Opportunity: preferred vendor pricing" |
| **Source Link** | A reference to an external source (email, document, URL) | "Original email from [Partner]" |
| **Approval Status** | The approval state of a work object | "pending_owner", "approved", "rejected" |
| **Audit Event** | An immutable log entry recording an action | "Draft approved by Keith at 2026-07-04T09:30:00Z" |

### 11.2 Work Object Base Shape

```typescript
interface WorkObject {
  id: string;
  type: WorkObjectType;
  titleKey?: string;
  title: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  agentComments: AgentComment[];
  tags: WorkObjectTag[];
  sourceLinks: SourceLink[];
  approvalStatus?: ApprovalStatus;
  auditEvents: AuditEvent[];
  relatedObjects: string[];
}
```

**Work object multilingual behavior:**

- **Fixed UI labels, statuses, type names, and action text** use translation keys (e.g., `titleKey`). These are system-defined strings that appear in the UI chrome and must be multilingual-first via `en.json`, `zh-TW.json`, `zh-CN.json`.
- **User-generated and agent-generated content** — such as ticket titles, draft text, agent comments, recommendations, and risk/opportunity descriptions — is stored as plain content in `title`, `agentComments`, etc. This content is produced by users or agents in natural language and is not translated through the i18n key system.
- **System-generated templates** — such as default ticket titles for common workflows (e.g., "Review contract reply draft — [Partner]") — should use localized templates where practical, so the generated text respects the user's language preference.
- **Future UX/UI implementation** remains multilingual-first. Any UI that renders work objects must update `en.json`, `zh-TW.json`, and `zh-CN.json` together for all fixed UI chrome surrounding the content.

---

## 12. Approval and Safety Model

### 12.1 Core Principle

Agents may create internal work objects autonomously. External-facing actions always require human approval.

### 12.2 Approval Categories

| Category | Approval Required? | Examples |
|----------|-------------------|----------|
| **Internal drafts** | No — auto-created | Draft reply, draft analysis, internal note |
| **Internal tickets** | No — auto-created | Daily to-do, review task, meeting topic |
| **Internal referrals** | No — auto-created | Referral to another agent for review |
| **Agent comments** | No — auto-created | Analysis, recommendation, risk/opportunity tag |
| **External emails** | YES — Keith approval required | Sending any email to an external party |
| **Contract acceptance** | YES — Keith approval required | Accepting, modifying, or rejecting contract terms |
| **Payments** | YES — Keith approval required | Initiating any payment or financial commitment |
| **External commitments** | YES — Keith approval required | Making any binding commitment to an external party |
| **Destructive actions** | YES — Keith approval required | Deleting data, revoking access, terminating agreements |
| **Public-facing content** | YES — Keith approval required | Publishing blog posts, social media, press releases |

### 12.3 Approval Flow

```
Agent creates work object requiring approval
  → Work object marked as "pending_owner"
  → Notification sent to Keith (in-app + optional Slack/email)
  → Keith reviews agent inputs and recommendations
  → Keith approves / rejects / modifies
  → Approval status updated
  → Audit event logged
  → (If approved) Agent executes the approved action
  → Execution audit event logged
```

### 12.4 Safety Boundaries

- No agent may send external communications without explicit human approval.
- No agent may make financial commitments without explicit human approval.
- No agent may delete or modify data irreversibly without explicit human approval.
- Approval gates cannot be bypassed by agent-to-agent referral.
- All approval decisions are logged in the audit trail.
- Approval timeout defaults to "block" (no action taken if timeout expires without approval).

---

## 13. Static RPG Office/Town Dashboard — First Milestone

### 13.1 Concept

The first UX milestone is a static RPG office/town dashboard shell. This is the visual environment where users see their available agents, navigate to agent workspaces, and get a sense of the platform's personality.

### 13.2 Visual Style

- **RPG office/town hybrid** — inspired by pixel-agent / pixel character UI aesthetics.
- **Serious product adaptation** — the RPG visual style serves as personality and navigation metaphor, not as a game. The dashboard must feel professional and functional, not toy-like.
- **Pixel art style** — agent avatars and environment art use a cohesive pixel art style.
- **Clean layout** — the RPG visual elements sit within a clean, modern dashboard layout with proper spacing, typography, and responsive behavior.

### 13.3 First Milestone Scope (Static Shell)

| Element | Description |
|---------|-------------|
| Dashboard layout | Full-page RPG office/town scene with clean surrounding UI |
| Agent positions | Each agent has a fixed position in the office/town scene |
| Agent avatars | Static pixel art avatars for each agent |
| Agent status badges | "Active" for Builder Agent, "Coming Soon" for others |
| Agent click/tap | Clicking an active agent navigates to that agent's workspace |
| Coming soon overlay | Clicking a coming-soon agent shows a "coming soon" message |
| Responsive behavior | Layout adapts to desktop, tablet, and mobile without overlap/clipping |

### 13.4 Not in First Milestone

- No walking character — the character walking around the office/town is a later UX milestone.
- No animation — agent avatars are static in the first milestone.
- No real-time agent activity indicators — agents do not show live status in the first milestone.
- No environment interaction — the office/town scene is non-interactive beyond agent click targets.

### 13.5 Later UX Direction

After the static dashboard shell, the next UX milestone introduces:

- **Controllable character** — the user controls a character that walks around the office/town.
- **Agent interaction** — walking up to an agent and pressing interact opens that agent's workspace.
- **Environment details** — desks, computers, whiteboards, coffee machines, plants — all rendered in pixel art.
- **Agent idle animations** — agents have subtle idle animations at their desks/stations.
- **Activity indicators** — agents show visual cues when they have pending work or notifications.

---

## 14. UX/UI Rules for Future Implementation

### 14.1 Multilingual-First

All ainow.biz UX/UI work follows the existing aiSandBox multilingual-first rule:

- All user-facing UI text must use translation keys.
- Translation files must be updated in the same slice:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use the existing translation hook/pattern.
- No hardcoded English user-facing copy unless explicitly approved as temporary developer/debug-only text.

### 14.2 Icon Library

Normal UI icons must use **Heroicons v2 Outline** (`@heroicons/react/24/outline`) only, unless Keith explicitly approves otherwise.

RPG/pixel art elements (agent avatars, environment art, sprites) are separate from the icon library rule — they use custom pixel art assets.

### 14.3 Advisory Skills

The project's UX/UI advisory skills apply as advisory guidance for future UX/UI work:

- **Impeccable** — broad UI/UX audit, visual hierarchy, spacing, anti-slop polish.
- **Emil Kowalski design engineering** — component polish, interaction quality, motion restraint, empty/loading/error states.

Advisory skills are advisory-only and must not override governance, scope, architecture, or tests.

### 14.4 Responsive Layout

All dashboard and agent workspace layouts must be responsive:

- Desktop, tablet, and mobile breakpoints.
- No overlap or clipping at any breakpoint.
- Touch-friendly tap targets on mobile.
- RPG scene scales or reflows appropriately.

### 14.5 Accessibility

- Keyboard navigation for agent selection and workspace access.
- Screen reader labels for agent avatars and status badges.
- Sufficient color contrast for text and interactive elements.
- Reduced motion option for users who prefer minimal animation.

---

## 15. Billing and Commercial Model

### 15.1 Plan Structure

| Plan | Target User | Monthly Price Direction |
|------|-------------|----------------------|
| **Free** | Exploration, evaluation | $0 — limited credits |
| **Starter** | Solo founder, light usage | Low — moderate credits |
| **Pro** | Active solo or small team | Medium — generous credits |
| **Team** | Collaborative team usage | Higher — shared team credits, multi-seat |

### 15.2 Credit Model

Monthly credits are the universal billing currency. Credits are consumed by:

| Consumption Type | Description |
|-----------------|-------------|
| **Tokens** | LLM input/output tokens consumed by agent model calls |
| **Tool calls** | Agent tool invocations (file reads, writes, validation runs, etc.) |
| **Agent runs** | Per-session agent execution runs |
| **Scheduled jobs** | Future: automated recurring agent tasks |
| **Workspace/runtime usage** | Container runtime hours |
| **Premium integrations** | Future: Gmail, Slack, Notion, calendar connectors |

### 15.3 Credit Accounting

- Each plan includes a monthly credit allocation.
- Credits roll over or expire based on plan terms (TBD).
- Usage records track credit consumption per agent, per session, per action type.
- Overage behavior: hard stop (Free), soft warning + overage billing (paid plans), or TBD.

### 15.4 Stripe / Payment Integration

- **Not now.** Stripe integration and real payment processing are deferred.
- **Now:** Define the plan/credit/entitlement data model and audit the existing usage tracking.
- **Later:** Integrate Stripe for subscription management, payment processing, and webhook handling.

### 15.5 Entitlement Model

```typescript
interface PlanEntitlement {
  planId: string;
  monthlyCredits: number;
  maxAgents: number;
  maxConcurrentSessions: number;
  maxWorkspaceStorageMB: number;
  knowledgeBaseSizeLimitMB: number;
  allowedAgentIds: string[];
  premiumIntegrations: string[];
  supportTier: 'community' | 'email' | 'priority';
}
```

---

## 16. What Should NOT Be Implemented Yet

The following are explicitly deferred. They are part of the platform vision but must not be implemented in current or near-term tasks:

| Deferred Item | Reason |
|---------------|--------|
| Full/interactive dashboard UI | The static RPG office/town dashboard shell (AGENT-PLATFORM-02) is an early follow-up after AGENT-PLATFORM-01. Full interactive dashboard features — walking character, real-time agent activity, animated RPG interactions, environment interaction — are deferred to later UX milestones. |
| Walking character | Later UX milestone after static dashboard shell is shipped and validated |
| Real multi-agent runtime orchestration | Requires agent registry, collaboration protocol, and work object system |
| Gmail / Slack / Notion integrations | Premium integrations deferred until core agent platform is stable |
| Legal Advisor Agent implementation | Placeholder agent; implementation deferred |
| Stripe / payment processing | Deferred until plan/credit/entitlement model is audited |
| Database schema changes for agents/knowledge | Requires architecture review and schema design task |
| Production runtime changes | No production deployment changes in planning tasks |
| Agent-to-agent real-time messaging | Collaboration is async via work objects, not real-time chat between agents |
| Embedding / vector search for knowledge base | Deferred to AGENT-KNOWLEDGE implementation phase |

---

## 17. Relationship to Agent Harness

### 17.1 Agent Harness as Execution Foundation

The existing Agent Harness (AGENT-HARNESS-00 through AGENT-HARNESS-05C8) is the execution foundation for Builder Agent. The following capabilities have been implemented through the Agent Harness roadmap:

- Multi-turn tool loop orchestration
- Typed tool protocol with registry and dispatcher
- Safe file operations with path validation and policy enforcement
- Validation runner with command allow-list
- Pre-apply checkpoint and atomic rollback
- Per-tool timeout and AbortSignal propagation
- Cumulative token accounting
- Aggregate tool-result byte limits

**Runtime activation gate:** These capabilities are implemented and unit-tested, but runtime activation remains gated. `enableToolLoop` remains `false` in all environments unless explicitly enabled in a future validated activation task. Platform-level work (agent registry, dashboard, collaboration protocol) must not assume the harness tool loop is active until the gate is intentionally enabled and runtime-validated in a dedicated task. The existing single-shot AI execution path continues to operate as the active production path until the harness gate is opened.

### 17.2 Platform Layer vs Harness Layer

| Concern | Platform Layer (ainow.biz) | Harness Layer (Agent Harness) |
|---------|---------------------------|------------------------------|
| Agent registry | Manages agents, manifests, routing | N/A — harness is per-agent execution |
| Agent permissions | Enforces tool/knowledge/approval permissions per agent | Enforces tool-level safety boundaries |
| Agent collaboration | Referrals, shared tickets, decisions, approval gates | N/A — harness is single-agent execution |
| Knowledge scopes | Manages shared/specialist knowledge access | Provides workspace context (file content, repo structure) |
| Billing / credits | Tracks credit consumption per agent/session | Reports token usage for credit accounting |
| Model routing | Agent manifest specifies default model profile | Harness uses model profile for execution |
| Tool execution | Platform defines which tools each agent may use | Harness dispatcher executes tools safely |
| Workspace management | Platform assigns container/session per agent workspace | Harness operates within assigned workspace |

### 17.3 Integration Points

1. **Agent manifest → Harness config:** Platform translates agent manifest fields (modelProfile, toolPermissions, knowledgeScopes) into Agent Harness execution config.
2. **Harness results → Platform billing:** Harness reports cumulative token usage; platform converts to credit consumption.
3. **Harness audit events → Platform audit trail:** Harness audit events feed into the platform-level audit trail.
4. **Platform approval gates → Harness tool approval:** Platform-level approval rules (e.g., "require owner approval for external email") map to harness-level tool approval gates.

---

## 18. Proposed Follow-Up Roadmap

The following tasks are proposed as the next steps. They are NOT registered — they are listed here as a recommended sequence for future registration.

### 18.1 Platform Foundation Phase

| Task ID | Name | Description | Dependencies |
|---------|------|-------------|-------------|
| AGENT-PLATFORM-01 | Agent Registry Foundation | Define agent manifest TypeScript types, create static registry with Builder Agent + 3 placeholder entries, add registry service | AGENT-PLATFORM-00 |
| AGENT-PLATFORM-02 | Static RPG Office/Town Dashboard Shell | Build the first-milestone static dashboard UI with agent positions, avatars, status badges, and click-to-navigate | AGENT-PLATFORM-01 |
| AGENT-PLATFORM-03 | Register aiSandBox as Builder Agent | Wire existing aiSandBox workspace/session into Builder Agent manifest entry, route from dashboard to builder workspace | AGENT-PLATFORM-01 |

### 18.2 Collaboration and Knowledge Phase

| Task ID | Name | Description | Dependencies |
|---------|------|-------------|-------------|
| AGENT-COLLAB-00 | Agent Referral and Collaboration Protocol Plan | Detailed architecture plan for referral rules, shared tickets, decisions, approval gates, audit trail | AGENT-PLATFORM-00 |
| AGENT-KNOWLEDGE-00 | Common Knowledge Base Architecture Plan | Detailed architecture plan for knowledge scopes, ingestion pipeline, storage model, access control | AGENT-PLATFORM-00 |
| AGENT-SKILLS-00 | Per-Agent Skills and Knowledge Scope Plan | Detailed plan for skill model, skill-to-prompt mapping, knowledge scope configuration | AGENT-PLATFORM-00 |

### 18.3 Commercial Readiness Phase

| Task ID | Name | Description | Dependencies |
|---------|------|-------------|-------------|
| BILLING-READY-00 | Billing, Plan, Credit, and Entitlement Audit | Audit existing usage tracking, define plan/credit/entitlement data model, identify gaps for Stripe integration | AGENT-PLATFORM-00 |

### 18.4 Ongoing Agent Harness Work

The Agent Harness family continues independently:

| Task ID | Name | Status |
|---------|------|--------|
| AGENT-HARNESS-05C9 | Structured Harness Audit Events | Next recommended (not registered) |

Agent Harness tasks and Agent Platform tasks can progress in parallel — they are separate families with documented integration points (section 17).

---

## 19. Acceptance Criteria for AGENT-PLATFORM-00

- [ ] AGENT-PLATFORM-00 registered in TASKS.md with ACTIVE status.
- [ ] AGENT-PLATFORM-00 mirrored in TASKS_BACKLOG_FULL.md with matching content.
- [ ] `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` created with:
  - [ ] Executive summary
  - [ ] Product model (ainow.biz + aiSandBox as Builder Agent)
  - [ ] First visible agents and status
  - [ ] Agent registry concept
  - [ ] Agent manifest fields (all specified fields)
  - [ ] Per-agent skills model
  - [ ] Knowledge scopes (shared vs specialist)
  - [ ] Common knowledge base layer
  - [ ] Agent-to-agent collaboration model
  - [ ] Example workflow (contract negotiation)
  - [ ] Work object concepts (all 11 types)
  - [ ] Approval and safety model
  - [ ] Static RPG office/town dashboard first milestone
  - [ ] UX/UI rules for future implementation
  - [ ] Billing and commercial model
  - [ ] What should NOT be implemented yet
  - [ ] Relationship to Agent Harness
  - [ ] Proposed follow-up roadmap
  - [ ] Acceptance criteria
- [ ] No implementation source files changed.
- [ ] No frontend UI files changed.
- [ ] No package/env/Docker/schema/database files changed.
- [ ] No runtime/provider/database/browser/Docker commands executed.
- [ ] No subagents used.
- [ ] No git commits or pushes.

---

## Document Metadata

- **Created:** 2026-07-04
- **Task:** AGENT-PLATFORM-00
- **Status:** ACTIVE planning output
- **Author:** AI-assisted planning pass
- **Source:** Product direction confirmed by Keith; existing Agent Harness foundations (AGENT-HARNESS-00 through AGENT-HARNESS-05C8)
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md
