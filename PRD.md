ainow.biz Platform — Product Requirements Document (PRD)

This document is the authoritative **PRODUCT WHAT**. It distinguishes **CURRENT** product capability, **limited private-beta** scope, and **approved FUTURE** direction. Technical implementation belongs in ARCHITECTURE.md. Task sequencing belongs in TASKS.md / TASKS_BACKLOG_FULL.md.

---

## 1. Overview

**ainow.biz** is the umbrella AI-agent product/platform. Users create, manage, and work with AI agents on durable projects. The current product shell is a command-center/dashboard experience with an RPG-inspired visual identity.

**aiSandBox / Builder Agent** is the first functional agent/module on ainow.biz. Builder lets users Ask questions or Build software through natural language, inside isolated and governed project workspaces.

Other system agents — **Chief of Staff Agent**, **Product Strategy Agent**, and **Technology Advisor Agent** — are visible in the platform registry as coming-soon placeholders. Coming soon is a UI label for a visible-but-not-functional agent. Those agents are not functional in the current product and are not part of the current private beta.

The broader ainow.biz multi-agent collaboration and general agent-platform capabilities remain **approved** planned post-beta direction. They are not current product capability.

Product identity at a glance:

- **ainow.biz** — umbrella product/platform
- **aiSandBox / Builder Agent** — first functional agent/module
- **CURRENT shell** — command-center/dashboard with RPG-inspired visual identity
- **PARTIAL / visible but not functional** — specialist coming-soon placeholders; persisted user-created agent profiles
- **NOT current user experience** — functional specialist agents; executable user-created agents; knowledge runtime; collaboration/referrals/work objects; product-visible multi-Builder; Harness as the Builder experience
- **Approved FUTURE** — those capabilities above, plus Legal Advisor Agent, deeper RPG/simulation, OAuth activation, Stripe/payment activation, and later external knowledge-source integrations

The platform prioritizes safety, determinism, reversibility, and clear failure semantics while enabling a productive AI-assisted development workflow.

---

## 2. Product Goals

### Current Goals

- Enable users to work on durable software projects with AI assistance inside isolated, governed container workspaces
- Provide AI-assisted code generation, file modification, and workspace preview within Builder Agent
- Enforce strong governance guarantees — session lifecycle controls, resource limits, credit enforcement — to prevent abuse and resource exhaustion
- Ensure predictable, deterministic lifecycle behavior for sessions, workspaces, and previews
- Support durable project continuity: projects persist across sessions, with save/restore, import/export, and checkpoint recovery
- Persist Builder conversation context on the backend so users can resume work across sessions
- Deliver a multilingual user experience supporting English, Traditional Chinese, and Simplified Chinese
- Provide a controlled usage and credit model: free-plan credit allocation, Ask/Build consumption, balance enforcement, and usage tracking
- Present the ainow.biz platform with Builder as the first functional agent and a clear registry of coming-soon placeholders

### Planned Goals

These are **approved FUTURE** product direction. They are not current capability and are not promised in the current private beta.

- Extend the credit model to support commercial payment processing and subscription management (not activated in current beta)
- Enable genuinely functional non-Builder system agents (Chief of Staff Agent, Product Strategy Agent, Technology Advisor Agent)
- Enable a functional Legal Advisor Agent as an approved future specialist (not currently in the platform registry; no delivery or timeline promise)
- Enable user-created agents to execute AI work beyond persisted profiles, with appropriate tools, knowledge, skills, and configuration
- Support general multi-agent collaboration and orchestration, including referrals, work objects, approval gates, and loop/referral limits
- Support Multi-Builder profiles, differentiated specialties, task routing, collaboration, attribution, and orchestration as a user-visible product
- Make Agent Harness the default Builder experience (autonomous / multi-turn / tool-using)
- Activate Google OAuth and Apple OAuth authentication (implementation exists; not activated in current beta)
- Deliver shared and specialist knowledge as a product runtime, including later external knowledge-source integrations

---

## 3. Core Features

### A. Project Persistence and Workspace Continuity

A **project** is the durable user-owned work identity on ainow.biz. Projects persist across runtime sessions and provide continuity for all user work.

#### Project Capabilities (Current)

- Create and open projects
- Persistent project identity: files, conversation history, and checkpoints survive session end
- Import projects from ZIP archives
- Export project state
- Git-based checkpoints for recovery and reversal of workspace changes

#### Session Relationship

A **session** is the runtime container lifetime associated with opening a project workspace. It is not the primary user-facing product identity.

- Sessions are created when a user opens a project workspace
- Sessions are governed by idle timeout, max lifetime, and concurrency limits
- Session termination does not destroy the project; the project and its files persist

#### Workspace

The active coding environment within a running session — containing the file tree, editor, and preview for that session.

---

### B. Session Lifecycle Management

Users work through project-driven sessions, each representing an isolated container environment.

#### Session Governance Guarantees

Each session has:

- Idle timeout (activity-based)
- Maximum lifetime (absolute, from creation time)
- Concurrency limits on workspace operations

Governance limits are configuration-driven and enforced by the system.

When a session exceeds limits:

- The session is terminated persistently
- The container is stopped and removed (best-effort)
- All subsequent requests return HTTP 410 Gone
- Project files and checkpoints are preserved

#### Termination Semantics

- Termination state is stored durably in the database
- Termination survives process restarts
- Terminated sessions are irreversible and non-recoverable as runtime environments
- The underlying project is unaffected by session termination

---

### C. AI Execution (Builder Agent)

AI execution is the primary product feature of Builder. Users choose **Ask** or **Build**.

- **Ask** — AI responds without changing workspace files.
- **Build** — AI proposes and applies workspace file changes.

The current private-beta Builder experience is **single-shot**: the user sends one Ask or Build request; Builder completes that request; the turn is done.

#### Current Builder Core Loop

**Ask**

```
User asks a question
→ Builder returns an AI response
→ Workspace files are unchanged
→ Conversation persists
```

**Build**

```
User describes what they want to build or change
→ Builder executes a single-shot AI request
→ Structured file actions are produced (file writes, deletions)
→ Risky or batch actions may require user approval before application
→ Platform applies file actions to the workspace
→ Platform confirms a qualifying successful apply
→ Build credits may be consumed
→ File tree, editor, and preview reflect the changes
→ A git checkpoint is created for recovery
→ Project state persists durably across sessions
```

This is the staging-proven current product promise.

#### Build Apply Confirmation

Build apply confirmation happens only after a qualifying successful workspace apply. The platform confirms and records that the qualifying Build changes were successfully applied. Build credits are consumed only after that confirmation.

This is not a user-facing/manual confirmation, and it is not required as a user action on every Build. It is distinct from user approval before applying risky or batch file actions.

#### Execution Safety Gate

AI execution is governed by a deliberate global safety gate. When the gate is disabled, AI execution requests return a clear unavailable response. This is an intentional controlled-activation mechanism, not a product failure.

#### Credit and Balance Enforcement

AI execution is subject to credit balance enforcement. Users must have sufficient credit balance for an execution request to proceed. Insufficient balance returns a governed error response. AI actions are subject to the same governance and lifecycle rules as other user actions — AI cannot bypass session termination or resource limits.

Credits are consumed according to Ask/Build product rules:

- **Ask:** credits are consumed when the AI response completes
- **Build:** credits are consumed only after the platform confirms a qualifying successful workspace apply
- **Failed or partial workspace apply:** no Build credits are consumed

#### Agent Harness (Gated; not current beta)

An enhanced multi-turn / tool-using Builder capability (Agent Harness) is implemented for controlled activation. It is **not** currently user-accessible in the private beta, **not** the default Builder experience, and **not** part of the current beta promise.

- The current beta promise is single-shot Builder (Ask and Build)
- Making Harness the default Builder experience is approved FUTURE direction
- Harness activation is an operational decision, not a user-facing beta promise

---

### D. Structured File Actions and Workspace Coherence

AI responses in Builder produce structured file-action instructions rather than raw unstructured text.

#### File Action Pipeline (Current)

- AI output is parsed for structured file-action instructions (create, write, delete files)
- Risky or batch actions may require user approval before application; this is a safety step and is not required for every Build
- Actions are applied sequentially to the workspace
- After actions apply, the file tree, editor state, and preview are refreshed to reflect the changes
- A git checkpoint is created at appropriate points to enable recovery and reversal

---

### E. File System Operations

Users and AI can interact with the project workspace files.

#### Supported Operations

- Read files
- Write files
- List directories
- Inspect file metadata

#### Constraints

- All operations are sandboxed to the session workspace
- Operations are subject to the same lifecycle and termination enforcement as other workspace operations
- File changes initiated by AI go through the structured file-action pipeline

---

### F. Preview

Builder sessions may expose application previews via HTTP and WebSocket proxying through the platform.

#### Preview Capabilities (Current)

- Access previews via the integrated preview panel
- Support HTTP and WebSocket traffic (e.g., HMR, dev servers)
- Preview is available for active sessions
- Preview reflects the current state of workspace files after AI file-action application

#### Access Control

- Preview access control is optional and configuration-driven
- When enabled: requires JWT authentication and enforces session ownership

#### Lifecycle Guarantees

- Previews are only available for active sessions
- Preview access on terminated sessions returns HTTP 410 Gone

---

### G. Chat Persistence

Builder conversation context — messages and AI responses — is persisted on the backend. Users can return to an active project and resume conversation context from prior sessions. Chat is not transient or local-only.

---

### H. Usage, Credits, and Billing

#### Current Credit Model

- Free-plan credit allocation is provisioned on user registration
- Credit balances are tracked per user, visible in the product, and enforced before AI execution proceeds
- **Ask:** credits are consumed when the AI response completes
- **Build:** credits are consumed only after the platform confirms a qualifying successful workspace apply
- **Failed or partial workspace apply:** no Build credits are consumed
- Balance enforcement gates AI execution: insufficient balance returns a governed error
- Usage records are maintained per Ask/Build request
- Admin credit grants are supported for operational purposes
- A billing page and balance display are available in the UI

#### Commercial Payment (Not Current — Planned)

Live commercial payment processing, Stripe checkout, and subscription management are not active in the current beta. The underlying infrastructure is implemented but not activated. Activation is a future decision tied to commercial launch planning.

---

### I. Platform Shell and Agent Registry

#### ainow.biz Platform Shell (Current)

- The ainow.biz command-center shell provides the primary user entry point after authentication
- Presents an RPG-inspired interface with an agent registry
- Builder Agent is accessible from the command center and routes to the project workspace
- System agent placeholders are visible as coming-soon entries

#### System Agents

| Agent | Status |
|-------|--------|
| Builder Agent | CURRENT — functional AI coding agent |
| Chief of Staff Agent | COMING SOON — visible placeholder; not functional in current product or current private beta |
| Product Strategy Agent | COMING SOON — visible placeholder; not functional in current product or current private beta |
| Technology Advisor Agent | COMING SOON — visible placeholder; not functional in current product or current private beta |

Coming soon does not mean these agents ship in the current private beta. Functional specialist-agent execution is approved FUTURE direction. **Legal Advisor Agent** is an approved future specialist; it is not in the current registry and has no delivery or timeline promise.

#### User-Created Agent Profiles (Current)

Users can create persistent agent profiles on the platform (**Create Agent**):

- Create an agent profile (name, role, description, status)
- Persist the profile
- List and view created agents / profile detail

User-created agents are **persistent profiles only**. They are not executable agents. An authenticated, ownership-scoped backend soft-delete capability exists, but a user-facing Delete control is not currently available (accepted private-beta limitation). Autonomous execution, tool execution, knowledge assignment, skills/runtime behavior, and agent collaboration are not current.

**Approved FUTURE:** user-created agents become executable agents with appropriate tools, knowledge, skills, and configuration.

---

### J. Multilingual UX

The platform delivers a multilingual user experience as a core current requirement.

#### Supported Locales (Current)

- English (`en`)
- Traditional Chinese (`zh-TW`)
- Simplified Chinese (`zh-CN`)

All user-facing UI text — including empty states, loading/error/success messages, buttons, labels, chat status, and system feedback — must be delivered in all supported locales. Additional locales are not in current scope.

---

### K. Authentication and Identity

#### Current Authentication (Beta)

- Email/password registration and login
- Email verification on registration
- Authenticated session cookies with CSRF protection

#### Deferred (not currently available)

- Google OAuth authentication (not activated in current beta)
- Apple OAuth authentication (not activated in current beta)

Code existence does not mean product activation. Neither OAuth option is currently available.

---

### L. Admin Operations

An admin console provides operational support for the private beta:

- View and manage users
- View and manage sessions
- Grant credits to users

Admin operations are a current operational support capability. They are not a public product feature.

---

## 4. Architecture Summary

**ARCHITECTURE.md is authoritative for TECHNICAL HOW** — service topology, communication, data stores, execution internals, and operational constraints.

At a product level:

- The platform consists of multiple cooperating services that together deliver the web app, Builder workspaces, AI Ask/Build, Preview, credits, and project persistence
- Builder work runs in isolated project workspaces
- Ask and Build requests are fulfilled asynchronously
- Preview shows the running workspace
- Project files, conversation, credits, and checkpoints persist independently of a single session

Do not reproduce ARCHITECTURE.md detail in this document.

---

## 5. Governance Model

The platform enforces governance at multiple layers:

#### Container-level

- CPU, memory, and PID limits enforced by the container runtime

#### Session-level

- Maximum session lifetime (absolute, from creation)
- Idle timeout (activity-based)
- Concurrent operation limits

#### Access-level

- Optional JWT-based preview access control

#### Execution-level

- Global AI execution safety gate: governs whether AI execution requests are accepted
- Credit balance enforcement operates before execution proceeds
- Session/lifetime/concurrency governance is enforced as users work
- AI execution itself runs asynchronously after passing governance checks

#### Enforcement Properties

- **Deterministic**: governance decisions follow fixed configuration-driven rules
- **Request-driven** (governance checks): session lifecycle and concurrency enforcement operate on incoming requests
- **Idempotent**: repeated requests in a terminal state return the same result
- **Persisted when terminal**: terminal states survive process restarts

---

## 6. Error and Status Semantics

| Scenario | HTTP Status |
|----------|-------------|
| Resource not found | 404 Not Found |
| Session terminated | 410 Gone |
| Idle timeout exceeded | 410 Gone |
| Max lifetime exceeded | 410 Gone |
| Concurrent operation limit exceeded | 429 Too Many Requests |
| Preview unavailable | 404 / 500 / 502 (as applicable) |
| AI execution disabled (safety gate) | 503 Service Unavailable |
| Insufficient credit balance | Governed error response |

The 503 on execution-disabled is an intentional product state, not a failure condition. It surfaces clearly to users as an unavailability message.

---

## 7. Non-Functional Requirements

#### Security

- Strong isolation via Docker container runtime; no cross-session access
- Optional authenticated preview access
- Credit-enforced AI execution at request boundary
- No hardcoded secrets; environment-driven configuration
- Authentication and authorization enforced at API boundaries

#### Reliability

- Deterministic failure modes
- Persistent termination state (survives process restart)
- Safe process restart behavior
- Durable project state independent of session lifetime

#### Performance

- Low-overhead, request-driven governance enforcement for session lifecycle
- Asynchronous AI execution so the product is not blocked waiting for a model response
- Single-process enforcement (not yet cluster-safe — future work)

#### Isolation and Ownership

- Each session is isolated to its project workspace
- No cross-project or cross-session access
- Users own their projects; ownership is enforced at the API level

#### Multilingual Behavior

- All user-facing text must be available in English, Traditional Chinese, and Simplified Chinese
- Locale selection is applied consistently across the platform experience

#### Project Continuity

- Project identity and files persist across session boundaries
- Import/export enables project portability
- Git checkpoints enable recovery and reversal of workspace changes

#### Auditability

- Usage records are maintained per Ask/Build request
- Session lifecycle events are persisted
- Credit deductions are recorded according to Ask/Build product rules

---

## 8. Explicit Non-Goals (Current Phase)

The following are explicitly out of scope for the initial Builder private beta. Many of these remain **approved FUTURE** product direction; their exclusion is from the current beta, not from the long-term product vision.

- **Background session cleanup / scheduled workers**: No cron-based or scheduled session cleanup workers. Session lifecycle governance remains request-driven.
- **Distributed session coordination**: Single-node deployment; no distributed locks or multi-node session HA
- **Automatic session resurrection**: TERMINATED is a final state; no auto-restart of terminated sessions
- **WebSocket-based control APIs**: Preview may use realtime traffic; it is not a general control-plane transport
- **Live commercial payment processing**: Stripe checkout, subscription management, and live payment collection are not active. Credits-first balance enforcement is current; commercial billing activation is approved FUTURE.
- **Functional non-Builder system agents**: Chief of Staff Agent, Product Strategy Agent, and Technology Advisor Agent are platform placeholders; they are not functional AI agents in this phase. Legal Advisor Agent is approved FUTURE and is not currently in the registry.
- **Executable / configurable user-created agents**: User-created agent profiles are persistent records; routing them to an AI execution runtime, or configuring per-agent models/tools/skills, is out of scope for initial beta
- **Multi-agent collaboration runtime**: Agent referrals, work handoff, tickets, decisions, comments, approval gates, and loop/referral limits are approved FUTURE; not current
- **Shared and specialist knowledge runtime**: Shared/company knowledge, specialist/private knowledge, uploads, policies, goals, meeting information, refresh/update behavior, and traceability/permissions are approved FUTURE; not current
- **Product-visible multi-Builder**: Multiple Builder agents/profiles, differentiated specialties, task routing, collaboration, attribution, and orchestration are approved FUTURE; not current
- **Agent Harness as the Builder experience**: The current beta promise is single-shot Builder. Harness-as-default is approved FUTURE.
- **RPG walking-town / moving-character simulation**: The command-center shell has an RPG-inspired visual identity. Walking-town simulation is superseded as MVP and is not the current or next committed product. Deeper RPG/simulation remains long-term approved FUTURE.
- **Broad external integrations**: No general third-party integration platform in current scope. Future external knowledge-source integrations are conceptual FUTURE, not named committed products.
- **Public agent ecosystem**: No open marketplace or externally published agent registry in current scope
- **Google OAuth / Apple OAuth**: Not currently available
- **Public launch / broader user rollout**: Out of scope for this limited private beta

---

## 9. Summary

**ainow.biz** is an AI-agent platform with an approved vision of multi-agent collaboration. **Builder Agent** is its first functional agent — an AI-assisted coding environment that lets users Ask questions or Build software through natural language, in isolated and governed project workspaces.

The current product delivers:

- A **project-first durable coding workflow** where projects, files, conversations, and checkpoints persist across sessions
- **Ask** (AI response, no file changes) and **Build** (AI-driven workspace file changes; credits after the platform confirms a qualifying successful apply)
- **Integrated preview** of running applications within the workspace
- **Multilingual UX** in English, Traditional Chinese, and Simplified Chinese
- A **credits-first model**: Ask credits at response completion; Build credits only after the platform confirms a qualifying successful workspace apply
- A **platform command-center shell** with Builder active and other agents clearly marked coming soon
- **Persistent user-created agent profiles** (not executable runtime agents)
- **Admin operational support** for the private beta

Other system agents (Chief of Staff Agent, Product Strategy Agent, Technology Advisor Agent) are platform placeholders. The broader ainow.biz multi-agent collaboration, general agent-platform capabilities, and commercial payment lifecycle remain **approved** planned post-beta direction.

Limited private-beta rollout constraints are defined in §10. They are separate from the CURRENT capability inventory.

---

## 10. Limited Private-Beta Scope

The current rollout is a **limited Builder-first private beta**. This section states rollout scope. It is not a substitute for the CURRENT capability inventory.

**In scope**

- Builder Agent as the only functional agent
- A small trusted cohort (1–3 users)
- Email/password authentication
- Single-shot Builder experience (Ask and Build)
- Isolated project/workspace, chat, file editing, Preview, checkpoint/revert, persistent projects, credit balance/use, and multilingual UI
- Coming-soon specialist placeholders that are visible, not functional
- User-created agent profiles that can be created, persisted, listed, and viewed (not executed)

**Out of scope for this beta**

- Agent Harness as a user-accessible or default experience
- Functional specialist agents
- Executable user-created agents
- Multi-agent runtime, referrals, work objects, or orchestration
- Product-visible multi-Builder experience
- Shared or specialist knowledge runtime
- Google OAuth and Apple OAuth
- Stripe / live payment charging
- Public launch or broader user rollout

**Support**

A defined direct support/feedback channel will be established before beta invitations are sent. This document does not choose that channel.

Coming-soon labels do not mean those agents ship in this beta. Invitation operations are outside this product document.

---

## 11. Product Status Reference

### CURRENT (staging-proven or implementation-confirmed)

| Capability |
|------------|
| Email/password authentication and email verification |
| ainow.biz platform command-center shell |
| Builder Agent — AI-assisted coding in isolated workspaces |
| Ask mode — AI response without workspace file changes |
| Build mode — AI-driven workspace file changes |
| Platform confirmation of a qualifying successful Build apply before Build credit consumption |
| Durable projects (create, open, persist, import/export) |
| File tree and code editor |
| AI single-shot execution path |
| Structured AI file-action pipeline |
| Workspace preview |
| Git checkpoints and recovery |
| Chat and conversation persistence |
| Multilingual UX (en, zh-TW, zh-CN) |
| Free-plan credit balance provisioning and enforcement |
| Ask credits consumed when the AI response completes |
| Build credits consumed only after the platform confirms a qualifying successful workspace apply |
| Failed or partial workspace apply consumes no Build credits |
| Usage records per Ask/Build request |
| Admin operations (user / session / credit management) |
| Persistent user-created agent profiles (create / list / view) |
| Static system-agent registry (Builder active; 3 coming-soon placeholders) |

### GATED (implemented; not currently offered in private beta)

| Capability | Condition |
|------------|-----------|
| AI execution globally | Deliberate safety gate must be enabled |
| Agent Harness multi-turn tool loop | Implemented for controlled activation; not currently user-accessible in private beta |
| Harness file, validation, and browser tools | Same as Harness: not currently user-accessible in private beta |

GATED means implemented for controlled activation. It does **not** mean currently available to private-beta users. Harness is not part of the current beta promise.

### PLANNED / APPROVED FUTURE / NOT CURRENT

| Capability |
|------------|
| Functional Chief of Staff Agent |
| Functional Product Strategy Agent |
| Functional Technology Advisor Agent |
| Functional Legal Advisor Agent (not currently in registry; no timeline promise) |
| User-created agents as executable runtime agents |
| Per-agent model / tool / skill / knowledge configuration |
| Shared/company and specialist/private knowledge |
| Knowledge uploads, policies, goals, meeting information, refresh/update, and traceability/permissions |
| Future external knowledge-source integrations (conceptual; not named committed products) |
| Work objects (tickets, decisions, referrals, comments) |
| Agent-to-agent referral, handoff, and collaboration |
| Approval gates and referral loop prevention |
| Multi-Builder profiles, specialties, routing, collaboration, attribution, and orchestration |
| Agent Harness as the default Builder experience |
| Google OAuth activation |
| Apple OAuth activation |
| Live Stripe payment / subscription management |
| Deeper RPG / simulation (not current; not the next committed product) |
| Public agent ecosystem |

---

## 12. Terminology Reference

| Term | Definition |
|------|------------|
| **ainow.biz** | The umbrella AI-agent platform. Hosts all agents; provides UX shell, registry, billing, and identity. |
| **aiSandBox** | The coding-product module that became Builder Agent. |
| **Builder Agent** | The first functional AI coding agent on ainow.biz. |
| **Ask** | A user request that generates an AI response without changing workspace files. Credits are consumed when the AI response completes. |
| **Build** | A user request that produces AI-driven workspace file changes. Credits are consumed only after the platform confirms a qualifying successful workspace apply. A failed or partial workspace apply does not consume Build credits. |
| **Build apply confirmation** | Platform confirmation, after a qualifying successful workspace apply, that the qualifying Build changes were successfully applied. Build credits may be consumed only after this confirmation. It is not a user-facing/manual confirmation, and it is distinct from user approval before risky or batch file actions. |
| **Risky-action approval** | User safety approval that may be required before applying risky or batch file actions. It is not required for every Build, and it is not Build apply confirmation. |
| **Project** | A durable user-owned work identity. Persists across sessions. Contains files, conversation, and checkpoints. |
| **Session** | The runtime workspace lifetime for an open project. |
| **Workspace** | The active files, editor, and preview environment within a running session. |
| **Create Agent** | The current ability to create, persist, list, and view a user-created agent profile. Not execution. |
| **User-created agent** | A persisted agent profile created by a user. Currently name, role, description, and status. Not executable. |
| **System agent** | A built-in agent in the platform registry. Builder is active; other system agents are coming-soon placeholders. |
| **Coming soon** | A UI label for a visible-but-not-functional agent. It is not a private-beta delivery promise. |
| **File actions** | Structured AI instructions to create, write, or delete workspace files. |
| **Agent Harness** | An implemented gated multi-turn / tool-using Builder capability. Not currently user-accessible in private beta. Not the default Builder experience. Making it the default is approved FUTURE. |
| **Legal Advisor Agent** | An approved FUTURE specialist agent. Not currently in the registry. No delivery or timeline promise. |

---

## 13. Authority and Document Hierarchy

**PRD.md** is authoritative for product requirements, product scope, feature intent, and product-level distinctions between CURRENT capability, limited private-beta scope, gated implementation, and approved FUTURE / planned capabilities.

**ARCHITECTURE.md** is authoritative for current technical architecture, service topology, communication patterns, database design, execution flows, and implementation constraints. Where this PRD and ARCHITECTURE.md appear to conflict on a technical implementation detail, ARCHITECTURE.md governs.

**TASKS.md**, **TASKS_BACKLOG_FULL.md**, and locked checkpoint documents in `/docs/` are authoritative for execution history, completion evidence, and task governance.

**CLAUDE.md** is the working contract governing all project work and takes precedence over convenience, assumptions, or shortcuts.

These authorities are complementary, not competing. PRD governs *what* the product does. ARCHITECTURE.md governs *how* it is implemented. Both must be consistent. Neither can override the other within its own domain.

All implementation work must trace back to this PRD and conform to ARCHITECTURE.md and CLAUDE.md.

No feature may be implemented unless it:

1. Is defined in this PRD
2. Is architecturally permitted by ARCHITECTURE.md
3. Is listed in TASKS_BACKLOG_FULL.md
4. Is activated in TASKS.md
5. Produces a checkpoint
