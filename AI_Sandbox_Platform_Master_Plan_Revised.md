# Project AI Sandbox Platform Master Plan (Revised)

**Status:** Revised working master plan  
**Purpose:** Product-first planning document for turning AI Sandbox Platform into a spec backlog, phased roadmap, and task/todo system.  
**Source Basis:** Revised from the previously supplied complete platform plan and aligned to the current direction of the product.  
**Audience:** Founder, product planning, Claude/Cursor implementation workflow.

---

## 1. How to Use This Document

This document is **not** a completion ledger. It is the **master product and architecture plan** that Claude should turn into:

1. **specs**  
2. **roadmap / phases / stages**  
3. **todos / tasks**

### Rules for Claude when using this document
- Treat this document as the **source of product direction and scope boundaries**.
- Treat `TASKS.md`, `TASKS_BACKLOG_FULL.md`, and phase checkpoint docs as the **source of execution/completion status**.
- Do **not** assume something is finished just because it appears in this plan.
- Do **not** expand beyond this plan unless explicitly requested.
- When in doubt, prefer:
  - core product value,
  - safety,
  - reversibility,
  - clarity,
  - bounded implementation slices.

---

## 2. Product Definition

## 2.1 Product Name
**AI Sandbox Platform**

## 2.2 Product Goal
A cloud-based AI coding workspace where a user can ask an AI to build, edit, debug, and evolve real application code inside an isolated workspace, while the user can review files, preview outputs, inspect history, and revert changes safely.

## 2.3 Core Product Promise
The platform is **not primarily a terminal runner**.  
The primary promise is:

1. User asks the AI to do work.
2. AI changes the workspace.
3. User sees code/files/preview/history.
4. User can continue, inspect, or revert.

That AI-to-workspace loop is the center of the product.

## 2.4 Primary Users
### Initial target
- Internal users
- Founder/operator
- Small closed beta group
- Non-power-users who want AI to do coding work for them

### Not the primary target
- Users who mainly want a manual shell/terminal product
- Users who need a generic cloud IDE without AI-first workflow

---

## 3. Product Principles (Non-Negotiable)

1. **AI-first workspace**
   - The core workflow is AI performing work in the workspace, not the user manually typing shell commands.

2. **Safe reversibility**
   - Important AI actions should remain inspectable and recoverable through checkpoint/history mechanisms.

3. **Workspace truth**
   - Editor, preview, checkpoints, chat, and workspace state should describe the same underlying session/workspace reality.

4. **Session isolation**
   - Each active workspace session is isolated and governed with clear lifecycle rules.

5. **Production-first implementation**
   - Avoid temporary hacks that undermine later reliability.
   - Fix correctness issues instead of layering confusing UX over broken backend behavior.

6. **Preserve working behavior**
   - Already-working session, workspace, checkpoint, history, preview, auth, and quota behavior should be preserved unless a task explicitly improves them.

7. **Bounded slices**
   - Implementation should progress in small, testable slices with clear acceptance criteria.

---

## 4. What the Product Is — and Is Not

## 4.1 Primary product loop (must be first-class)
The first-class workspace loop is:

- user prompt
- AI execution
- code/file changes
- visible response / thread
- editor visibility
- preview visibility
- checkpoint/history/revert

This loop must remain the main product direction.

## 4.2 Supporting tools (allowed, but secondary)
These can exist, but are **not** the primary value proposition:
- raw command execution / terminal
- low-level shell debugging surfaces
- advanced power-user tooling

### Important guidance
If raw exec exists, it should be treated as:
- supporting tool,
- advanced tool,
- debugging tool,
- or internal/operator tool,

and **must not displace** the AI-first workflow as the main product experience.

## 4.3 Explicitly not the current primary focus
These may exist later, but should not pull the roadmap away from the core AI workspace loop:

- public sharing ecosystem
- large collaboration suite
- deep branching/merge UI
- mobile companion apps
- Mac/iOS build agent ecosystem
- multi-AI collaboration
- conversational orchestration layer
- broad API platform / developer ecosystem
- advanced billing sophistication beyond what is needed for safe operation

---

## 5. Scope Model

## 5.1 Core V1 / V1.5 scope
The following are core product areas:

### A. Authenticated workspace access
- user auth
- route protection
- correct logged-in / logged-out behavior

### B. Session lifecycle
- create/select/stop/remove
- active vs expired vs terminated behavior
- correct session counting and quota handling
- correct session isolation

### C. Workspace state
- file tree
- file read/write
- editor load/save
- preview
- checkpoint creation
- checkpoint history
- diff/snapshot/revert workflows

### D. AI workspace loop
- chat input
- AI response
- message thread
- workspace-side effects
- response persistence
- session-scoped chat state
- clear error handling
- quota/rate-limit clarity

### E. Safety and accounting
- token usage tracking
- quota enforcement
- launch/abort controls
- auth/API-key correctness
- session/resource boundaries

## 5.2 Out of scope for the current core roadmap, but may be added later
These are **intentional future/optional areas**, not immediate core roadmap requirements:

- multi-AI collaboration and AI-to-AI discussion
- conversational orchestrator / Cantonese UX layer
- iOS/mac build agent system
- Android emulator investment
- broad public API ecosystem
- public sharing marketplace/community features
- deep collaborative editing/multi-user live presence
- advanced enterprise billing/reporting beyond current commercial needs

## 5.3 Out of scope but must be preserved
Even when not actively expanding them, the following existing working capabilities must not be broken:

- session lifecycle and sidebar actions
- checkpoint creation/history/diff/snapshot
- editor file loading/saving
- preview routing/status
- chat prompt/response/thread behavior
- per-session chat persistence
- auth gating for workspace access
- quota enforcement and visibility
- API-key based AI execution flow
- route bootstrapping and workspace loading behavior

---

## 6. Architecture to Preserve

The following architecture direction remains valid and should be preserved unless a future explicit architecture change is approved.

## 6.1 Service architecture
- **Frontend:** Next.js
- **API Gateway:** NestJS
- **AI Service:** model execution / queue worker integration
- **Container Manager:** isolated session workspace runtime
- **PostgreSQL:** persistent state and ledgers
- **Redis / queue:** asynchronous execution and operational flows

## 6.2 Isolation model
- isolated workspace session runtime
- container-per-session or equivalent isolated session model
- enforce lifecycle, resource, and auth ownership boundaries

## 6.3 Git/checkpoint model
- workspace changes can map to checkpoints / commit-like history
- history, diff, revert, and snapshot are product primitives
- preserve reversibility and inspectability

## 6.4 Event/queue model
- AI execution may be asynchronous
- status retrieval / streaming / queue-aware UX is part of the platform
- do not collapse asynchronous design into brittle synchronous shortcuts

## 6.5 Product-safe state model
- frontend should not invent contradictory session/file/chat state
- session/workspace/chat/checkpoint state should remain aligned to backend truth

---

## 7. Canonical Spec Families

Claude should use the revised master plan to derive **spec breakdowns** under the following families.

## 7.1 Platform Foundations
### PF-01 Auth and Access Control
- login/logout/session auth
- protected routes
- workspace auth gate
- JWT / API key boundary correctness

### PF-02 Session Lifecycle
- create/select/stop/remove
- status model
- expiration / termination handling
- quota-consistent active-session counting

### PF-03 Sandbox Runtime
- isolated workspace runtime
- session ownership
- command/file operations safety
- preview runtime linkage

### PF-04 Workspace File System
- list/read/write files
- workspace/editor synchronization
- correct file-tree refresh behavior

## 7.2 AI Workspace Loop
### AI-01 AI Execution Pipeline
- prompt submission
- API-key auth path
- queued/streamed execution handling
- status retrieval

### AI-02 Chat Panel UX
- prompt box
- response surface
- message thread
- error rendering
- per-session persistence
- session switching behavior

### AI-03 AI-to-Workspace Actions
- AI modifies files/code
- workspace reflects changes
- checkpoints/history remain aligned
- preview/editor update rules

### AI-04 Response / Stream Handling
- final response persistence
- no duplicate rendering
- status and response consistency
- graceful quota/provider error display

## 7.3 History, Recovery, and Auditability
### HR-01 Checkpoints
- auto/manual save points
- checkpoint metadata
- checkpoint visibility in UI

### HR-02 History / Control
- timeline/history list
- selection
- compare/diff/snapshot
- revert and recovery UX

### HR-03 Reversibility
- user can inspect what changed
- user can return to prior working state
- revert must remain understandable and safe

## 7.4 Project Persistence
### PR-01 Project Save/Restore
- persist workspace beyond session lifetime
- restore into new session
- preserve necessary state

### PR-02 Import / Export
- download project
- upload/import project
- optional git-preserving workflows

### PR-03 Project Identity
- saved projects
- slugs/permalinks (if pursued later)
- stable project-level access distinct from session-level runtime

## 7.5 Commercial / Operations
### CO-01 Quotas and Usage
- usage tracking
- quota enforcement
- user-visible quota messaging
- backend/frontend consistency

### CO-02 Billing and Plans
- subscription model
- invoice/ledger correctness
- overage tracking where applicable

### CO-03 Admin and Observability
- health/readiness
- startup guards
- operational dashboards
- logs/metrics/alerts
- admin overrides and diagnostics

### CO-04 API / Key Management
- user API keys
- internal service keys
- correct auth surfaces for execution endpoints

## 7.6 Optional / Future Spec Families
These are **not core unfinished blockers** unless explicitly promoted:
- ADV-01 Multi-AI Collaboration
- ADV-02 Conversational Orchestration Layer
- ADV-03 Mobile / Mac / iOS build support
- ADV-04 Public API platform and ecosystem
- ADV-05 Public sharing/community layer

---

## 8. Phased Implementation Roadmap

This section is the canonical roadmap structure Claude should use when creating a phased implementation plan.

## Phase 0 — Governance, Safety, and Architectural Baseline
### Goal
Ensure the project has the rules, documents, and core service boundaries needed to implement safely.

### Includes
- planning files
- governance docs
- phase/task/checkpoint workflow
- environment/config guardrails
- startup/readiness checks
- base auth/usage/accounting model

### Must preserve
- production-first operational behavior
- service boundaries
- token/accounting integrity

### Out of scope
- broad feature polish
- advanced UX work

---

## Phase 1 — Secure Workspace Foundation
### Goal
A user can securely enter the product, create a valid session, and access a working isolated workspace.

### Includes
- auth
- route protection
- session create/select/stop/remove
- session lifecycle correctness
- workspace bootstrap correctness
- basic file/editor/preview surfaces
- quota-consistent session handling

### Success criteria
- authenticated users reach working workspace
- logged-out users are gated correctly
- sessions behave consistently across backend/frontend
- expired/terminated sessions do not behave like active sessions

### Out of scope
- advanced AI chat UX
- long-term project save/restore
- advanced collaboration

### Must preserve
- session isolation
- route safety
- correct auth gating

---

## Phase 2 — AI-Driven Workspace Core
### Goal
The user can ask the AI to do work in the workspace and see the results clearly.

### Includes
- prompt input
- AI execution wiring
- response streaming/status
- message thread
- response persistence
- session-scoped chat persistence
- error clarity
- AI auth/API-key correctness
- AI-to-workspace workflow visibility

### Success criteria
- user can send prompts successfully
- assistant replies are visible and stable
- per-session chat behavior is coherent
- chat survives refresh appropriately
- chat does not leak across sessions
- AI-first workflow is clearly usable

### Out of scope
- broad chat redesign
- long-term/global conversation system
- multi-AI discussion
- orchestrator/Cantonese features

### Must preserve
- session/history/editor/preview behavior
- quota enforcement
- auth correctness

---

## Phase 3 — History, Checkpoints, and Recovery
### Goal
The workspace is reversible, inspectable, and trustworthy.

### Includes
- save points
- checkpoint creation correctness
- history visibility
- diff/snapshot/revert
- checkpoint metadata/details
- recovery from broken states

### Success criteria
- user can create checkpoint after meaningful workspace change
- history surfaces correct saved state
- diff/snapshot/revert work from real workspace/git truth
- user can understand and recover changes

### Out of scope
- advanced branching ecosystem
- complex merge tooling
- public tutorial/export system

### Must preserve
- AI chat flow
- editor/preview/session behavior

---

## Phase 4 — Project Persistence and Continuity
### Goal
User work should outlive temporary session lifetime in a product-meaningful way.

### Includes
- save project
- restore project into new session
- import/export
- optional git-preserving import/export
- stable project identity

### Success criteria
- session expiry does not imply work loss
- user can continue work later from saved project state
- imported projects can re-enter AI workflow safely

### Out of scope
- public marketplace/community
- deep collaborative sharing
- complex version-control features beyond product needs

### Must preserve
- current checkpoint/history model
- session isolation
- AI-to-workspace loop

---

## Phase 5 — Commercial Readiness and Operations
### Goal
The product can operate safely with real users, quotas, and billing.

### Includes
- plans and quota enforcement
- usage and billing visibility
- admin tooling
- observability
- customer-safe operational controls
- API key management
- payment/subscription systems if actively required

### Success criteria
- quotas and billing are internally consistent
- admins can diagnose/support users
- operational visibility is good enough for public/beta service
- user-facing limits are understandable

### Out of scope
- enterprise-heavy customization
- broad partner ecosystem
- advanced analytics beyond operating needs

### Must preserve
- product correctness
- security
- reversibility
- AI workspace loop

---

## Phase 6 — Optional Advanced Expansion
### Goal
Extend the platform only after the core product loop is stable and commercially sound.

### Candidate areas
- multi-AI collaboration
- conversational orchestrator
- public API ecosystem
- mobile companion apps
- Mac/iOS build support
- richer collaboration and sharing features

### Rule
Nothing in this phase should displace unfinished core work in Phases 1–5 unless explicitly reprioritized.

---

## 9. Roadmap Prioritization Rules

When Claude turns this plan into stages/todos, use these priority rules:

### Highest priority
1. broken core product loop
2. auth/security correctness
3. workspace/session correctness
4. AI-to-workspace functionality
5. checkpoint/history/recovery correctness

### Medium priority
6. project persistence
7. operational/admin readiness
8. billing/quota UX alignment

### Lowest priority unless explicitly promoted
9. advanced polish
10. optional advanced ecosystems
11. infrastructure expansion beyond current need
12. power-user-only tooling

### Explicit product alignment rule
If a feature is:
- technically useful,
- but not part of the main AI-first workflow,
- and not in the master plan as a primary user need,

then it must be treated as **secondary** or **optional**, not roadmap-driving.

---

## 10. What Must Be Preserved While Moving Forward

The following should be treated as preserved working baseline unless a future task explicitly changes them:

- authenticated workspace access for logged-in users
- route auth gate for logged-out users
- session lifecycle and selection stability
- stop/remove behavior
- editor file loading/saving
- preview status routing
- save point / history / diff / snapshot behavior
- chat submit / thread / refresh persistence / session isolation
- quota/rate-limit behavior and clarity
- checkpoint/history integrity
- API-key based AI execution authentication
- workspace bootstrap stability

---

## 11. Known Product Direction Correction

To avoid future drift:

### The product is not primarily:
- a terminal app
- a shell runner
- a power-user ops console
- a generic cloud IDE with AI as a side feature

### The product is primarily:
- an AI-assisted coding workspace
- where the AI acts on real files/code
- and the user can inspect, preview, persist, and revert that work

This principle should guide future spec and roadmap decisions.

---

## 12. Deliverables Claude Should Produce from This Master Plan

Claude should be able to take this revised master plan and produce:

## 12.1 Spec breakdown
For unfinished work, create a spec backlog grouped by the spec families in Section 7.

Each spec should contain:
- purpose
- scope
- non-goals
- dependencies
- acceptance criteria
- preservation rules
- implementation notes (if needed)

## 12.2 Phased implementation roadmap
Use the phases in Section 8, and break each phase into:
- stage goals
- recommended sequencing
- dependency ordering
- completion criteria

## 12.3 Todo/task system
Convert unfinished roadmap items into:
- concrete tasks
- bounded slices
- checkpoints
- explicit preserve/do-not-break notes

---

## 13. Success Criteria for This Revised Plan

This revised master plan is successful if it helps Claude do all of the following:

- distinguish **core** vs **optional**
- distinguish **unfinished** vs **already implemented**
- produce specs without scope drift
- produce roadmap stages in the right order
- preserve working behavior while closing product gaps
- keep the project centered on the AI-first workspace loop

---

## 14. Immediate Next Usage

The next Claude planning step after this document should be:

1. compare this revised master plan against current completed work
2. identify what is finished, partially finished, or unfinished
3. convert unfinished areas into:
   - spec breakdown
   - phased implementation roadmap
   - bounded todo/task plan

That follow-up should explicitly preserve currently working Phase 83/84 functionality unless the revised master plan says otherwise.
