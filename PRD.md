ainow.biz Platform — Product Requirements Document (PRD)

---

## 1. Overview

**ainow.biz** is an AI-agent platform that enables users to create, manage, and work with AI agents on durable projects. The platform presents an RPG-inspired command-center shell from which users access agents and their workspaces.

**Builder Agent** is the first functional agent on ainow.biz and the evolution of the aiSandBox coding product. Builder allows users to create and iterate on software projects through natural language interaction with AI, inside isolated and governed container workspaces.

Other system agents — Chief of Staff, Product Strategy, and Technology Advisor — are present in the platform registry as coming-soon placeholders. They are not yet functional AI agents.

The broader ainow.biz multi-agent collaboration and general agent platform capabilities remain planned post-beta direction.

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
- Provide a controlled usage and credit model: free-plan credit allocation, balance enforcement, and usage tracking per execution
- Present the ainow.biz platform with Builder as the first functional agent and a clear registry of coming-soon agents

### Planned Goals

- Extend the credit model to support commercial payment processing and subscription management (not activated in current beta)
- Enable genuinely functional non-Builder system agents (Chief of Staff, Product Strategy, Technology Advisor)
- Enable user-created agents to execute AI work beyond persisted profiles
- Support general multi-agent collaboration and orchestration runtimes

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

AI execution is the primary product feature of Builder. A user expresses what they want to build or change; Builder executes an AI request; structured file actions are produced; the platform applies those changes to the workspace; and the file tree, editor, and preview reflect the result.

#### Current Builder Core Loop

```
User describes what they want to build or change
→ Builder executes an AI request (single-shot path)
→ Structured file actions are produced (file writes, deletions)
→ Platform applies file actions to the workspace
→ File tree, editor, and preview reflect the changes
→ A git checkpoint is created for recovery
→ Project state persists durably across sessions
```

This is the staging-proven current product promise.

#### Execution Safety Gate

AI execution is governed by a deliberate global safety gate. When the gate is disabled, AI execution requests return a clear unavailable response (HTTP 503). This is an intentional controlled-activation mechanism, not a product failure.

#### Credit and Balance Enforcement

AI execution is subject to credit balance enforcement. Users must have sufficient credit balance for an execution request to proceed. Insufficient balance returns a governed error response. AI actions are subject to the same governance and lifecycle rules as other user actions — AI cannot bypass session termination or resource limits.

#### Agent Harness (Gated)

An enhanced multi-turn agent execution capability (Agent Harness) is implemented and available for controlled activation. It is not the default Builder experience in the initial beta.

- When enabled, the Harness supports a multi-turn tool loop for more complex task execution
- Specific tool capabilities (file mutation, validation, browser automation) are individually gated
- The Harness multi-turn path with real providers has not been proven in production

Harness activation is an operational decision, not a user-facing beta promise.

---

### D. Structured File Actions and Workspace Coherence

AI responses in Builder produce structured file-action instructions rather than raw unstructured text.

#### File Action Pipeline (Current)

- AI output is parsed for structured file-action instructions (create, write, delete files)
- Risky or batch actions surface a confirmation step before application
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
- Credit balances are tracked per user and enforced at execution time
- Credit is deducted per AI execution
- Balance enforcement gates AI execution: insufficient balance returns a governed error
- Usage records are maintained per execution
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
| Chief of Staff | COMING SOON — placeholder |
| Product Strategy | COMING SOON — placeholder |
| Technology Advisor | COMING SOON — placeholder |

#### User-Created Agent Profiles (Current)

Users can create persistent agent profiles on the platform:

- Create an agent record (name, role, description, status)
- View and list created agents
- View agent detail and profile

User-created agents are **persistent profiles only**. They are not yet executable runtime agents. Configuring agents with tools, knowledge, or skills, and routing them to an AI execution runtime, are planned post-beta.

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

#### Deferred

- Google OAuth authentication (configuration present but not activated in current beta)

---

### L. Admin Operations

An admin console provides operational support for the private beta:

- View and manage users
- View and manage sessions
- Grant credits to users

Admin operations are a current operational support capability. They are not a public product feature.

---

## 4. Architecture Summary

The current implementation uses a multi-service architecture with durable PostgreSQL state and asynchronous AI execution infrastructure.

**ARCHITECTURE.md is the authoritative document for all technical architecture, service topology, communication patterns, database schema, execution flows, and implementation constraints.**

At a product level:

- The platform consists of multiple cooperating services: frontend, API gateway, AI service, and container manager
- **PostgreSQL** is the sole authoritative durable database. SQLite is not used.
- Communication between services uses a **mixed transport model** — HTTP, queue-based messaging, and real-time channels. Services do not communicate via HTTP only.
- AI execution is **queue-driven and asynchronous** — not a synchronous in-process call
- Background AI execution workers are part of the implemented architecture
- The platform supports real-time preview proxying to running containers
- All services share a common authentication and session-governance model

Do not reproduce ARCHITECTURE.md detail in this document. For service ports, communication internals, queue configuration, database schema, or specific endpoints, refer to ARCHITECTURE.md.

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

- Global AI execution safety gate: governs whether AI execution requests are accepted; operates at request time
- Credit balance enforcement operates at request time before execution is enqueued
- Session/lifetime/concurrency governance enforcement is request-driven
- AI execution itself runs asynchronously via a queue-driven worker after passing governance checks

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
- Asynchronous queue-driven AI execution to avoid blocking request threads
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

- Usage records are maintained per execution
- Session lifecycle events are persisted
- Credit deductions are recorded per execution

---

## 8. Explicit Non-Goals (Current Phase)

The following are explicitly out of scope for the initial Builder private beta:

- **Background session cleanup / scheduled workers**: No cron-based or scheduled session cleanup workers. Session lifecycle governance remains request-driven. (The AI execution queue worker is a separate execution concern — not a cleanup worker.)
- **Distributed session coordination**: Single-node deployment; no distributed locks or multi-node session HA
- **Automatic session resurrection**: TERMINATED is a final state; no auto-restart of terminated sessions
- **WebSocket-based control APIs**: WebSocket is used for preview proxying only; it is not a control plane transport
- **Live commercial payment processing**: Stripe checkout, subscription management, and live payment collection are not active. Basic credit/balance enforcement is current; commercial billing activation is not.
- **Functional non-Builder system agents**: Chief of Staff, Product Strategy, and Technology Advisor are platform placeholders; they are not functional AI agents in this phase
- **Executable / configurable user-created agents**: User-created agent profiles are persistent records; routing them to an AI execution runtime, or configuring per-agent models/tools/skills, is out of scope for initial beta
- **Multi-agent collaboration runtime**: General agent-to-agent referral routing, shared orchestration, and multi-agent collaboration runtimes are post-beta
- **Shared and specialist knowledge runtime**: Vector/semantic knowledge ingestion and retrieval are planned; not current
- **Work objects (tickets, decisions, referrals)**: Planned; not current
- **RPG walking characters and pixel-map game engine**: The command-center shell has an RPG-inspired visual style; full walking characters, explorable pixel maps, and game-engine interaction are post-beta
- **Broad external integrations**: No general third-party API integration platform in current scope
- **Public agent ecosystem**: No open marketplace or externally published agent registry in current scope

---

## 9. Summary

**ainow.biz** is a multi-agent work platform. **Builder Agent** is its first functional agent — an AI-assisted coding environment that enables users to create and iterate on software projects through natural language interaction in isolated, governed container workspaces.

The current product delivers:

- A **project-first durable coding workflow** where projects, files, conversations, and checkpoints persist across sessions
- An **AI-driven workspace change pipeline**: user request → AI file-action output → workspace application → preview → git checkpoint
- **Integrated preview** of running applications within the workspace
- **Multilingual UX** in English, Traditional Chinese, and Simplified Chinese
- A **free-plan credit model** with balance enforcement governing AI execution
- A **platform command-center shell** with Builder active and other agents clearly marked coming soon
- **Persistent user-created agent profiles** (not yet executable runtime agents)
- **Admin operational support** for the private beta

Other system agents (Chief of Staff, Product Strategy, Technology Advisor) are platform placeholders. The broader ainow.biz multi-agent collaboration, general agent platform capabilities, and commercial payment lifecycle remain planned post-beta direction.

The initial private beta is Builder-first: a small trusted cohort, Builder as the functional tested agent, governed by free-plan credits, with multi-agent runtime outside beta scope.

---

## 10. Product Status Reference

### CURRENT (staging-proven or implementation-confirmed)

| Capability |
|------------|
| Email/password authentication and email verification |
| ainow.biz platform command-center shell |
| Builder Agent — AI-assisted coding in isolated containers |
| Durable projects (create, open, persist, import/export) |
| File tree and code editor |
| AI single-shot execution path |
| Structured AI file-action pipeline (parse → apply → coherence) |
| Workspace preview (proxy through container runtime) |
| Git checkpoints and recovery |
| Chat and conversation persistence (backend) |
| Multilingual UX (en, zh-TW, zh-CN) |
| Free-plan credit balance provisioning and enforcement |
| Credit deduction per execution |
| Usage records per execution |
| Admin operations (user / session / credit management) |
| Persistent user-created agent profiles (create / list / detail) |
| Static system-agent registry (Builder active; 3 coming-soon placeholders) |

### GATED (implemented; not the default)

| Capability | Condition |
|------------|-----------|
| AI execution globally | Deliberate safety gate must be enabled |
| Agent Harness multi-turn tool loop | Harness tool-loop gate must be enabled |
| Harness file mutation tools | Harness write-tools gate must be enabled |
| Harness validation tools | Harness validation-tools gate must be enabled |
| Harness browser automation tool | Harness browser-smoke gate must be enabled |

GATED capabilities are implemented and operational under the appropriate conditions. They are not absent or broken.

### PLANNED / NOT CURRENT

| Capability |
|------------|
| Functional Chief of Staff agent |
| Functional Product Strategy agent |
| Functional Technology Advisor agent |
| User-created agents as executable runtime agents |
| Per-agent model / tool / skill / knowledge configuration |
| Shared and specialist knowledge runtime |
| Knowledge ingestion and vector/semantic retrieval |
| Work objects (tickets, decisions, referrals) |
| Agent-to-agent referral and collaboration runtime |
| Runtime approval workflows (non-Builder) |
| Live Stripe payment / subscription management |
| RPG walking characters and pixel-map game engine |
| Broad external integrations |
| Public agent ecosystem |

---

## 11. Terminology Reference

| Term | Definition |
|------|------------|
| **ainow.biz** | The umbrella AI-agent platform. Hosts all agents; provides UX shell, registry, billing, and identity. |
| **Builder Agent** | The first functional AI coding agent on ainow.biz. The aiSandBox module. |
| **Project** | A durable user-owned work identity. Persists across sessions. Contains files, conversation, and checkpoints. |
| **Session** | The runtime container execution environment for an open project. Lifecycle: CREATED → ACTIVE → TERMINATED. |
| **Workspace** | The active files, editor, and preview environment within a running session. Sandboxed to the container workspace directory. |
| **User-created agent** | A persisted agent profile created by a user. Currently: name, role, description, and status stored in the platform. Not yet executable. |
| **System agent** | A built-in agent in the platform registry. Builder is active; other system agents are coming-soon placeholders. |
| **AI Execution** | The single-shot (current) or Harness (gated) path: user request → queue → AI worker → provider → structured file actions applied to workspace. |
| **File actions** | Structured instructions output by AI (write/delete files). Parsed, applied, and followed by workspace coherence update. |
| **Agent Harness** | The gated multi-turn tool loop for enhanced AI execution. Implemented; not the default Builder experience. |

---

## 12. Authority and Document Hierarchy

**PRD.md** is authoritative for current product requirements, product scope, feature intent, and product-level distinctions between current, gated, and planned capabilities.

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
