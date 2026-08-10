# GOV-PRD-01-STAGE-START.md
## GOV-PRD-01 — PRD.md Evidence Reconciliation / Stage-Start

**Task ID:** GOV-PRD-01
**Step:** 2 — PRD Evidence Reconciliation / Stage-Start
**Step Status:** COMPLETE (read-only audit artifact)
**Date:** 2026-08-10
**Predecessor:** GOV-ARCH-01 — COMPLETE AND LOCKED — 2026-08-10

---

## 1. Purpose

This document is the read-only audit artifact for GOV-PRD-01 Step 2.

It provides the exact evidence basis for GOV-PRD-01 Step 3 — Bounded PRD.md Reconciliation.

PRD.md was NOT modified in this step.
No source, test, schema, environment, Docker, runtime, or infrastructure action occurred.

---

## 2. Files Inspected

| # | File | Method |
|---|------|--------|
| 1 | `CLAUDE.md` | Full read |
| 2 | `TASKS.md` | Targeted grep — GOV-PRD-01 registration entry |
| 3 | `TASKS_BACKLOG_FULL.md` | Not read (too large) — GOV-PRD-01 registration confirmed via TASKS.md |
| 4 | `PRD.md` | Full read |
| 5 | `ARCHITECTURE.md` | Full read |
| 6 | `docs/GOV-ARCH-01-CHECKPOINT.md` | Full read |
| 7 | `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Full read |
| 8 | `docs/AINOW-EXECUTION-ROADMAP.md` | Partial read (first ~200 lines — task history table) |
| 9 | `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` | Full read |

---

## 3. Confirmed Baseline (Mutually Reconciled)

These are treated as ground truth for this audit unless repository evidence disproves them.

### 3.1 Product Identity

| Fact | Source |
|------|--------|
| ainow.biz is the umbrella platform | ARCHITECTURE.md §13, AGENT-PLATFORM-00 |
| aiSandBox = Builder Agent module | ARCHITECTURE.md §13, AGENT-PLATFORM-00 |
| Builder-first private beta is the agreed direction | AINOW-EXECUTION-ROADMAP.md, BETA-READY tasks |
| Genuine multi-agent ainow.biz beta is NO-GO (not current) | ARCHITECTURE.md §13, AGENT-PLATFORM-00 §16 |
| staging.ainow.biz is live and staging-proven | PRIVATE-BETA-DEPLOYMENT-READINESS COMPLETE |
| Core Builder product loop staging-proven (FR-04 PASS) | PRIVATE-BETA-FUNCTIONAL-READINESS-04 COMPLETE |

### 3.2 Database

| Fact | Source |
|------|--------|
| PostgreSQL is the sole authoritative durable database | ARCHITECTURE.md §7, GOV-ARCH-01-CHECKPOINT §7 |
| No SQLite in active codebase | GOV-ARCH-01-CHECKPOINT §7 |
| TypeORM manages schema through versioned migrations | ARCHITECTURE.md §7 |

### 3.3 Communication

| Fact | Source |
|------|--------|
| System uses mixed transport: HTTP, BullMQ/Redis, Redis Pub/Sub, WebSocket (preview only) | ARCHITECTURE.md §14, GOV-ARCH-01-CHECKPOINT §6 |
| NOT HTTP-only | ARCHITECTURE.md §1 |
| NOT queue-only | ARCHITECTURE.md §1 |

### 3.4 AI Execution

| Fact | Source |
|------|--------|
| Single-shot Builder path: POST /api/ai/execute → BullMQ → WorkerProcessor → provider → file-actions | ARCHITECTURE.md §11.1 |
| GLOBAL_EXECUTION_ENABLED=false is deliberate runtime safety kill-switch, not architectural absence | ARCHITECTURE.md §11.2 |
| Agent Harness multi-turn tool loop: IMPLEMENTED but GATED by default | ARCHITECTURE.md §12 |
| Real-provider autonomous harness loop: UNPROVEN in production | ARCHITECTURE.md §12.1 |

### 3.5 Platform Capabilities (CURRENT)

| Capability | Status |
|------------|--------|
| Auth / email verification / login | CURRENT — staging-proven |
| Platform command-center shell (`/[locale]/platform`) | CURRENT — staging-proven |
| Builder workspace (`/[locale]/app`) — project-first UX | CURRENT — staging-proven |
| Project creation/opening, project persistence | CURRENT — staging-proven |
| File tree / editor | CURRENT — staging-proven |
| AI execution (single-shot) | CURRENT — staging-proven (FR-04) |
| Structured AI file actions | CURRENT |
| Workspace file mutation, tree/editor/preview/checkpoint coherence | CURRENT |
| Preview (proxy through container-manager) | CURRENT |
| Import/export (ZIP import path) | CURRENT — staging-proven (FR-03A) |
| Chat/conversation persistence (backend) | CURRENT — PostgreSQL-backed |
| Git checkpoints / recovery | CURRENT |
| Multilingual UX (en, zh-TW, zh-CN) | CURRENT — staging-proven |
| Quota / credits (free-plan, credit balances, deduction) | CURRENT — staging-proven (BILLING-READY-08) |
| Admin operations (user view, session management, credit grants) | CURRENT |
| User-created agent persistence (DB-backed create/list/refresh/detail) | CURRENT — staging-proven (B3) |
| Stripe billing infrastructure (schemas, migrations, gateway, webhooks) | IMPLEMENTED — not live/activated |

### 3.6 NOT Current

| Capability | Status |
|------------|--------|
| Live Stripe payment flow, subscription management | NOT CURRENT — implemented but not activated |
| Non-Builder system agents (Chief of Staff, Product Strategy, Technology Advisor) | PLACEHOLDER — status: 'coming_soon' |
| User-created agents as executable runtime agents | NOT IMPLEMENTED |
| Full per-agent model / tool / skill / knowledge configuration | NOT IMPLEMENTED |
| Real Chief of Staff / Product Strategy / Technology Advisor runtime | NOT IMPLEMENTED |
| Knowledge ingestion, vector/semantic retrieval | PLANNED |
| Work objects (tickets, decisions, referrals) | PLANNED |
| Agent-to-agent collaboration runtime | SKELETON ONLY (in-memory OrchestrationService) |
| RPG walking character, pixel-map/game-engine interaction | POST-BETA |
| Runtime approval workflows (non-Builder) | PLANNED |

---

## 4. PRD.md Current Content Summary

PRD.md (current, unmodified) contains the following sections:

1. Overview
2. Product Goals
3. Core Features: A. Session Management, B. Code Execution, C. File System Operations, D. Preview & Run, E. AI Integration, F. Usage, Quotas, and Billing (Foundation)
4. Architecture Summary
5. Governance Model
6. Error & Status Semantics
7. Non-Functional Requirements
8. Explicit Non-Goals (Current Phase)
9. Summary
10. Implementation Mapping

---

## 5. Section-by-Section PRD Audit

### Section 1 — Overview

**Existing PRD claim:**
> "AI Sandbox Platform is an AI-powered coding environment that allows users to generate, run, and iterate on code through natural language interaction with AI assistants. Each user session runs inside an isolated, governed Docker container with strict lifecycle, resource, and access controls."

**Classification:** STALE — PARTIALLY SUPERSEDED

**Evidence:**
- The product is now ainow.biz with Builder Agent as the first functional module.
- "AI Sandbox Platform" is the old standalone product name. It has not been retired but it is subordinate to the ainow.biz umbrella.
- "Each user session runs inside an isolated container" is still technically true but misleading as the primary framing — the product is now project-first, not session-first. A session is the runtime container lifetime; a project is the durable user-owned work identity.
- The Builder core mission (AI-assisted code generation in a governed environment) remains correct and should be preserved.

**Current product truth:**
ainow.biz is the umbrella platform. Builder Agent (the aiSandBox module) is the first functional AI coding agent. It allows users to create and work on projects with AI assistance inside isolated Docker containers. The platform supports a durable project identity with save/restore/import/export. A session is the runtime container lifetime within a project.

**Step 3 treatment:** AMEND — update to ainow.biz/Builder framing while preserving the core coding mission.

---

### Section 2 — Product Goals

**Existing PRD claims:**
```
- Provide an isolated, reproducible coding sandbox per session
- Allow AI-assisted code generation, execution, and previewing
- Enforce strong governance guarantees to prevent abuse and resource exhaustion
- Ensure predictable lifecycle behavior for sessions and previews
- Support future billing, quotas, and multi-tenant expansion
```

**Classification:** PARTIALLY SUPERSEDED

**Evidence:**
- "Per session" framing is too narrow — projects are the user-facing durable unit; sessions are the runtime construct.
- "AI-assisted code generation, execution, and previewing" — valid, retain.
- "Governance guarantees" — valid, retain.
- "Predictable lifecycle behavior for sessions and previews" — valid but needs project context.
- "Support future billing, quotas, and multi-tenant expansion" — billing/credits are NO LONGER future only; free-plan credits, credit balances, and deduction pipeline are CURRENT. Stripe payment flow is implemented but not live-activated. The goal needs to distinguish CURRENT vs PLANNED.

Missing goals that should be added:
- Support durable project identity and workspace persistence across sessions
- Provide a multilingual user experience (en, zh-TW, zh-CN)
- Support the ainow.biz platform identity with Builder as the first functional agent

**Step 3 treatment:** AMEND — reframe from session-centric to project+platform framing; update billing goal from entirely-future to partially-current.

---

### Section 3A — Session Management

**Existing PRD claim:**
> "Users interact with the platform through sessions, each representing an isolated sandbox environment."
> Capabilities: Create session, Start/stop container, Execute commands, Read/write/inspect files

**Classification:** VALID BUT NEEDS CLARIFICATION

**Evidence:**
- Session mechanics are still real and current (CREATED→ACTIVE→TERMINATED lifecycle is preserved).
- BUT: the product is now project-first. A user creates a project; a session is spawned per project opening. The PRD treats sessions as the primary UX identity, which is stale.
- Idle timeout, max lifetime, governance limits — all valid and current.
- "Enforcement is request-driven (no background workers)" — **STALE/FALSE**. The WorkerProcessor IS a background worker. It is distinct from governance enforcement (which is request-driven), but the statement is misleading. ARCHITECTURE.md §2 correctly states "no cron, no schedulers" — that is the accurate constraint. The execution queue worker exists.

**Current product truth:**
Sessions remain the runtime isolation unit with the same lifecycle guarantees. The UX entry point is now a project (durable identity), and a session is created when the user opens a project workspace. Session governance (idle timeout, max lifetime, concurrency) remains valid. Background AI execution via BullMQ/WorkerProcessor is implemented — it is not governance enforcement, but the blanket "no background workers" claim is false.

**Step 3 treatment:** RETAIN session governance requirements; AMEND project-vs-session framing; REMOVE "enforcement is request-driven (no background workers)" — replace with accurate framing that distinguishes governance enforcement (request-driven) from AI execution (queue-driven WorkerProcessor).

---

### Section 3B — Code Execution

**Existing PRD claim:**
> "Sessions support command execution inside the container."
> Commands are executed inside the session's Docker container. Output includes exit code, stdout, and stderr.

**Classification:** VALID BUT NEEDS CLARIFICATION

**Evidence:**
- Container-level command execution (exec) is valid for the container-manager.
- BUT: the primary user-facing execution model is AI execution (POST /api/ai/execute → BullMQ → WorkerProcessor → provider), not direct command execution. Direct exec is used internally by harness tools (run_validation) and the AI service.
- The PRD currently describes direct command execution as the primary feature, while the actual product promise is AI-assisted development with file actions as output.
- HTTP 429 concurrency enforcement remains valid.

**Step 3 treatment:** RETAIN container exec governance requirements; AMEND to clarify that primary user-facing execution is AI execution (queue-driven), and container exec is infrastructure-level, not directly user-facing.

---

### Section 3C — File System Operations

**Existing PRD claim:**
> Supported: Read files, Write files, List directories, Inspect file metadata.
> All operations are sandboxed to the session workspace.

**Classification:** VALID — retain with clarification

**Evidence:**
- File operations in `/workspace` remain valid (read, write, list, inspect).
- These are used by both harness tool calls and the AI file-action pipeline.
- Current product additionally supports: structured AI file-action output (parsed from AI response and applied to workspace), post-action coherence (tree/editor/preview/checkpoint refresh), import/export (ZIP).
- The PRD is incomplete rather than wrong on this section.

**Step 3 treatment:** RETAIN existing file operation requirements; ADD brief reference to AI file-action pipeline and workspace coherence as the primary product mechanism for file changes.

---

### Section 3D — Preview & Run

**Existing PRD claim:**
> Register preview port, access via public URLs, HTTP and WebSocket traffic, optional JWT auth.
> Previews only available for active sessions. Preview on terminated sessions → 410.

**Classification:** VALID — partially needs update

**Evidence:**
- Preview proxy (Browser → API Gateway → container-manager) is staging-proven.
- Preview lifecycle requirements (active-only, 410 on terminated) remain correct.
- One unresolved staging finding: `GET /api/preview/<session-id>/status` returned HTTP 404 during FR-02 smoke (not fixed/investigated — recorded as separate unresolved finding, not a PRD error).
- WebSocket = preview only (never control plane) — correct and preserved.
- Optional JWT auth for preview — preserved in architecture.

**Current product truth:** Preview is current and staging-proven (proxy path correct). The unresolved 404 on preview status endpoint is a separate runtime investigation item, not a PRD change item.

**Step 3 treatment:** RETAIN preview requirements; ADD workspace coherence context (after AI file actions apply, user can preview result in integrated environment). Remove or soften "health check endpoint" if the 404 finding is unresolved.

---

### Section 3E — AI Integration

**Existing PRD claim:**
> "AI assistants interact with the platform via controlled APIs."
> Responsibilities: Generate and modify code, Request command execution, Inspect outputs and filesystem state.
> Constraints: AI actions are subject to the same governance and lifecycle rules as user actions.

**Classification:** STALE — PARTIALLY SUPERSEDED

**Evidence:**
- The AI integration section describes AI as a peripheral agent calling into a platform. The actual product architecture is the reverse: AI execution IS the core product loop.
- The PRD does not describe: single-shot execution path (POST /api/ai/execute → BullMQ → WorkerProcessor → provider → structured file-actions), AI file-action parsing and apply pipeline, workspace coherence post-apply, chat/conversation persistence, credit/quota tracking per execution, or the Agent Harness (GATED) multi-turn tool loop.
- "AI cannot bypass session termination or resource limits" — valid governance requirement; retain.
- No mention of: execution safety gate (GLOBAL_EXECUTION_ENABLED), provider model selection, CreditBalanceGuard gate, idempotency guard, or execution status tracking.

**Current product truth:**
The AI execution pipeline is the primary product feature. A user sends a natural language request; the AI returns structured file-action instructions; the platform applies them to the workspace and maintains coherence (file tree, editor, preview, git checkpoint). This is staging-proven. The Agent Harness multi-turn tool loop is implemented and gated (not the default experience). The GLOBAL_EXECUTION_ENABLED kill-switch is a deliberate safety gate.

**Step 3 treatment:** REPLACE the AI Integration section with a description of:
- Current single-shot AI execution path (high-level, no service port details)
- Structured file-action pipeline
- Workspace coherence post-apply
- Agent Harness as GATED capability (multi-turn, not default)
- GLOBAL_EXECUTION_ENABLED as deliberate safety gate
- AI governance: same session/lifecycle/credit enforcement applies

---

### Section 3F — Usage, Quotas, and Billing (Foundation)

**Existing PRD claim:**
> "Token usage and execution activity are observable. Governance violations may result in session termination."
> Future Extensions (Out of Scope): Monetary billing, Cross-session quotas, User-level aggregation.

**Classification:** PARTIALLY SUPERSEDED — materially incomplete

**Evidence:**
The following are NOW CURRENT (not future):
- Credit balances per user (PostgreSQL-backed, `credit_balances` table)
- Free-plan credit provisioning on registration (BILLING-READY-08 COMPLETE)
- Credit deduction per execution (BILLING-READY-02/03/04 COMPLETE)
- CreditBalanceGuard gate on AI execution (BILLING-READY-04A COMPLETE)
- Usage records per execution (`usage_records` table)
- Admin credit grants
- Billing UI (billing page, balance display — BILLING-READY-05F COMPLETE)

The following remain NOT CURRENT:
- Live Stripe payment flow (schema implemented, SDK not wired, not live-activated)
- Commercial subscription management (implemented but not activated; `BILLING_CHARGES_ENABLED=false`)
- Real payment/checkout flow with live Stripe keys

**Step 3 treatment:** SPLIT into CURRENT / NOT CURRENT. Classify credit/balance/accounting/guard infrastructure as CURRENT. Classify live Stripe payment and subscription billing as PLANNED/NOT ACTIVATED.

---

### Section 4 — Architecture Summary

**Existing PRD claim:**
```
Frontend: Web UI for interaction
API Gateway: Authentication, authorization, persistence ownership
Container Manager: Session runtime, Docker orchestration, governance enforcement
Docker Runtime: Isolated execution via containers
Database: SQLite (current), authoritative source for session state
Communication between services is HTTP-only.
```

**Classification: CRITICAL FALSE CLAIMS — require replacement**

| Sub-claim | Classification | Evidence |
|-----------|---------------|----------|
| `SQLite (current)` | **CRITICAL FALSE** | PostgreSQL is the sole authoritative database. No SQLite in codebase. GOV-ARCH-01-CHECKPOINT §7. |
| `Communication between services is HTTP-only.` | **HIGH FALSE** | System uses HTTP + BullMQ/Redis + Redis Pub/Sub + WebSocket (preview). ARCHITECTURE.md §14, GOV-ARCH-01-CHECKPOINT §6. |
| Missing: AI Service / WorkerProcessor | **HIGH OMISSION** | AI Service (port 4099) with BullMQ WorkerProcessor is a peer service. Not mentioned in PRD at all. |
| Missing: Redis | **HIGH OMISSION** | Redis used for BullMQ queue (ai-execution) and Pub/Sub (ai-execution-stream). Not mentioned. |
| Missing: BullMQ queue | **HIGH OMISSION** | All AI execution is queue-driven via BullMQ. Not mentioned. |
| Frontend URL structure (`/[locale]/app`, `/[locale]/platform`) | **OMISSION** | Not mentioned. |

Additionally, the governance rule at the top of Section 10 states:
> "If any conflict exists, this PRD takes precedence."

This clause is **DANGEROUS** because PRD.md contains false architecture claims. The clause should be corrected to state that ARCHITECTURE.md is the authoritative technical document, with PRD governing product requirements scope.

**Step 3 treatment:** REPLACE the Architecture Summary with a brief high-level reference to ARCHITECTURE.md. Do NOT duplicate architecture details. Correct the false claims without reproducing the full service topology, port numbers, queue names, or database table names. Correct the authority clause in Section 10.

---

### Section 5 — Governance Model

**Existing PRD claim:**
```
Container-level: CPU, memory, PID limits
Session-level: Max lifetime, Idle timeout, Exec concurrency
Access-level: Optional JWT-based preview access control
All enforcement is: Deterministic, Request-driven, Idempotent, Persisted when terminal
```

**Classification:** VALID — but "request-driven" needs clarification

**Evidence:**
- Session governance (max lifetime, idle timeout, concurrency) is request-driven. ✅ Valid.
- Container-level limits (CPU/memory/PID) — ✅ valid.
- Optional JWT-based preview access control — ✅ valid.
- "All enforcement is request-driven" — partially false when applied to AI execution. AI execution is queue-driven. The enforcement ORDER (auth/terminate/lifetime/idle/concurrency checks) is request-driven. But execution itself is async/queue-driven.
- Idempotent — valid.
- Persisted when terminal — valid.

**Step 3 treatment:** RETAIN governance model; ADD clarification that AI execution enforcement happens at enqueue time (request-driven) but execution runs asynchronously via queue worker. Execution safety gate (GLOBAL_EXECUTION_ENABLED) operates at request time.

---

### Section 6 — Error & Status Semantics

**Existing PRD claim:**
```
404 — Not found
410 — Session terminated
429 — Exec concurrency exceeded
Preview unavailable — 404/500/502
```

**Classification:** VALID — retain

**Evidence:**
- These semantics are preserved and current per ARCHITECTURE.md §10. ✅
- 503 should be added: `POST /api/ai/execute` returns 503 when `GLOBAL_EXECUTION_ENABLED=false`. This is a current execution-gate semantic not present in PRD.

**Step 3 treatment:** RETAIN existing table; ADD 503 for execution kill-switch.

---

### Section 7 — Non-Functional Requirements

**Existing PRD claims (selected):**

| Claim | Classification | Evidence |
|-------|---------------|----------|
| "Strong isolation via Docker, No cross-session access" | VALID | ✅ Preserved |
| "Optional authenticated preview access" | VALID | ✅ Preserved |
| "Deterministic failure modes, Persistent termination state, Safe restart behavior" | VALID | ✅ Preserved |
| **"No background workers"** (under Performance) | **CRITICAL FALSE** | WorkerProcessor (BullMQ) is a background worker. GOV-ARCH-01-CHECKPOINT §4 item 4. |
| **"Low overhead request-driven enforcement"** | VALID with caveat | Governance enforcement is request-driven; execution is queue-driven. |
| "Single-process enforcement, Not yet cluster-safe (future work)" | VALID | ✅ Still single-node. |

**Step 3 treatment:** REMOVE "No background workers" claim. RETAIN remaining valid NFRs. ADD: multilingual UX (en, zh-TW, zh-CN) as a current NFR.

---

### Section 8 — Explicit Non-Goals (Current Phase)

**Existing PRD non-goals:**
```
- Background cleanup workers
- Distributed session coordination
- Automatic session resurrection
- WebSocket-based control APIs
- Billing enforcement logic
```

**Classification:** MIXED

| Non-goal | Classification | Evidence |
|----------|---------------|----------|
| "Background cleanup workers" | VALID | No cron/scheduler/cleanup workers. AI execution queue worker is not a cleanup worker. Retain with clarification. |
| "Distributed session coordination" | VALID | Single-node, no distributed locks, no HA. ✅ |
| "Automatic session resurrection" | VALID | TERMINATED is final. ✅ |
| "WebSocket-based control APIs" | VALID | WebSocket = preview only, never control plane. ✅ |
| **"Billing enforcement logic"** | **STALE/FALSE** | CreditBalanceGuard, credit deduction, free-plan provisioning, and balance tracking ARE implemented and active. This non-goal is no longer accurate for basic enforcement. Live Stripe payment remains deferred. |

**Step 3 treatment:** RETAIN cleanup/coordination/resurrection/WebSocket non-goals; REPLACE "Billing enforcement logic" with a more precise non-goal: "Live commercial payment processing, Stripe checkout, and subscription management" (i.e., clarify that basic credit enforcement is current, while commercial payment is not).

---

### Section 9 — Summary

**Existing PRD claim:**
> "The AI Sandbox Platform provides a governed, deterministic execution environment for AI-assisted development. Session lifecycle, resource usage, and access are strictly controlled, with persistent termination semantics and clear HTTP behavior, forming a robust foundation for future expansion."

**Classification:** STALE — correct intent, stale product framing

**Evidence:**
- Core intent (governed, deterministic, AI-assisted) is valid.
- "Session lifecycle" as the summary framing is stale — project identity is now the user-facing concept.
- "Clear HTTP behavior" is incomplete — the system is not HTTP-only.
- "Robust foundation for future expansion" — substantially more has been built (billing, platform, multi-agent foundations).

**Step 3 treatment:** AMEND summary to reflect current product scope: ainow.biz umbrella, Builder Agent as first module, project-first durable identity, governed AI execution, multilingual UX, credit/quota model, platform with agent registry.

---

### Section 10 — Implementation Mapping / Governance Rule

**Existing PRD claim:**
> "If any conflict exists, this PRD takes precedence."

**Classification:** FALSE / DANGEROUS

**Evidence:**
- PRD.md currently contains false claims (SQLite, HTTP-only, no background workers). The "PRD takes precedence" authority clause means future sessions could act on those false claims.
- GOV-ARCH-01-CHECKPOINT §19 explicitly flagged PRD.md as stale and recommended GOV-PRD-01.
- ARCHITECTURE.md §1 correctly states its own authority: "All implementation must conform to this file and CLAUDE.md."
- The correct authority order is: CLAUDE.md > PRD.md (product requirements scope) > ARCHITECTURE.md (technical implementation authority). PRD governs WHAT the product does; ARCHITECTURE.md governs HOW it is implemented. These are complementary authorities, not competing ones.

**Step 3 treatment:** CORRECT the authority clause to state that ARCHITECTURE.md is the authoritative technical document; PRD defines product requirements scope; conflicts in architecture details defer to ARCHITECTURE.md.

---

## 6. Comprehensive Claim Classification Table

| # | PRD Location | Existing Claim | Classification | Step 3 Treatment |
|---|-------------|----------------|---------------|-----------------|
| 1 | §1 Overview | "AI Sandbox Platform" as product name | STALE | AMEND to ainow.biz/Builder Agent |
| 2 | §1 Overview | "Each user session runs inside an isolated container" as primary framing | PARTIALLY SUPERSEDED | AMEND — clarify project-first, session-is-runtime |
| 3 | §2 Goals | "Support future billing, quotas" (as future) | STALE | SPLIT CURRENT/PLANNED — credit accounting is current |
| 4 | §3A | "Enforcement is request-driven (no background workers)" | FALSE | REMOVE blanket statement; distinguish governance enforcement (request) from AI execution (queue) |
| 5 | §3B | Code execution as direct user-facing feature | PARTIALLY SUPERSEDED | AMEND — AI execution is primary; container exec is infrastructure |
| 6 | §3E | AI as peripheral caller into platform | STALE | REPLACE — AI execution is core product loop; describe file-action pipeline |
| 7 | §3E | No mention of execution safety gate | OMISSION | ADD — GLOBAL_EXECUTION_ENABLED as deliberate gate |
| 8 | §3E | No mention of Agent Harness | OMISSION | ADD — GATED multi-turn tool loop |
| 9 | §3F | "Monetary billing, cross-session quotas, user-level aggregation" all future | STALE | SPLIT — credit/balance/guard CURRENT; live Stripe PLANNED |
| 10 | §4 | "Database: SQLite (current)" | **CRITICAL FALSE** | REPLACE with reference to ARCHITECTURE.md — PostgreSQL |
| 11 | §4 | "Communication between services is HTTP-only." | **HIGH FALSE** | REMOVE/REPLACE — mixed transport; defer to ARCHITECTURE.md |
| 12 | §4 | Missing AI Service / WorkerProcessor | HIGH OMISSION | ADD brief reference; full detail in ARCHITECTURE.md |
| 13 | §4 | Missing Redis / BullMQ | HIGH OMISSION | ADD brief reference; full detail in ARCHITECTURE.md |
| 14 | §4 | No mention of platform routes (/platform, /app) | OMISSION | ADD in product scope; omit port details |
| 15 | §5 | "All enforcement is request-driven" blanket | FALSE (for AI execution) | AMEND — governance is request-driven; AI execution is queue-driven |
| 16 | §6 | Error semantics table | VALID | RETAIN; ADD 503 for GLOBAL_EXECUTION_ENABLED gate |
| 17 | §7 NFR | "No background workers" | **CRITICAL FALSE** | REMOVE — WorkerProcessor exists |
| 18 | §7 NFR | No multilingual requirement | OMISSION | ADD — en/zh-TW/zh-CN multilingual UX is current |
| 19 | §7 NFR | No mention of project persistence | OMISSION | ADD — durable project identity, save/restore/import/export |
| 20 | §8 Non-goals | "Billing enforcement logic" as non-goal | STALE/FALSE | REPLACE with "Live commercial payment/Stripe" |
| 21 | §9 Summary | "AI Sandbox Platform" / session-centric summary | STALE | AMEND to current product scope |
| 22 | §10 | "If any conflict exists, this PRD takes precedence." | FALSE/DANGEROUS | CORRECT — ARCHITECTURE.md is technical authority; PRD governs product scope |

---

## 7. Confirmed Current Product Identity

| Dimension | Current Product Truth |
|-----------|----------------------|
| Platform name | ainow.biz |
| Platform type | Multi-agent work platform (Builder is first functional agent) |
| Builder Agent identity | aiSandBox module — AI coding agent in isolated Docker containers |
| Primary product surface | `/[locale]/app` — Builder workspace (project-first) |
| Platform surface | `/[locale]/platform` — RPG command-center with agent registry |
| Auth | Email/password + email verification + authenticated sessions |
| Deferred auth | Google OAuth (deferred; env config present but not activated) |
| User-facing language | en, zh-TW, zh-CN (multilingual-first) |

---

## 8. Confirmed Builder Current Product Promise

```
User describes what they want
→ AI generates structured file-action instructions
→ Platform applies actions to workspace files
→ File tree, editor, and preview reflect changes
→ Git checkpoint created for recovery
→ Work persists in durable project (survives refresh, restore, import/export)
```

This is the staging-proven current product promise (FR-04 PASS — 2026-08-07).

---

## 9. CURRENT / GATED / PLANNED Capability Distinctions

### CURRENT (staging-proven or implementation-confirmed)

| Capability | Evidence |
|------------|----------|
| Auth / email verification / login / session cookies | FR-02 PASS |
| Project create / open / persistence | FR-02 PASS |
| File tree / editor | FR-03A PASS |
| ZIP import path | FR-03A PASS |
| AI execution — single-shot Builder path | FR-04 PASS |
| Structured file-action pipeline (parse → apply → coherence) | FR-04 PASS |
| Preview (proxy through container-manager) | ARCHITECTURE confirmed (status 404 is separate finding) |
| Git checkpoints / recovery mechanisms | Implementation confirmed |
| Chat / conversation persistence (backend) | PostgreSQL-backed `conversations` / `chat_messages` |
| Multilingual UX (en, zh-TW, zh-CN) | Staging-proven |
| Free-plan credit balance provisioning | BILLING-READY-08 PASS |
| Credit deduction per execution | FR-04 PASS (balance 500→0) |
| CreditBalanceGuard on AI execution | BILLING-READY-04A |
| User-created agent persistence (create/list/refresh/detail) | B3 PASS |
| Platform command-center shell | RPG-03A COMPLETE |
| Static system-agent registry (Builder + 3 placeholders) | AGENT-PLATFORM-01 |
| Admin operations (user view, session management, credit grants) | Implementation confirmed |

### GATED (implemented, disabled by default)

| Capability | Gate |
|------------|------|
| Agent Harness multi-turn tool loop | `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` |
| Harness write_file / delete_file tools | `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` |
| Harness run_validation tool | `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=true` |
| Harness browser_smoke tool | `AGENT_HARNESS_ENABLE_BROWSER_SMOKE=true` |
| AI execution globally | `GLOBAL_EXECUTION_ENABLED=true` (staging enabled per-session for smoke; default false) |

### PLANNED / NOT CURRENT

| Capability | Notes |
|------------|-------|
| Live Stripe payment / subscription management | Schema implemented; not activated; `BILLING_CHARGES_ENABLED=false` |
| Non-Builder system agent execution | Chief of Staff, Product Strategy, Technology Advisor — placeholders only |
| User-created agents as executable runtime | Persistence is current; execution routing is not |
| Per-agent model / tool / skill configuration | Not implemented |
| Knowledge ingestion / knowledge base runtime | PLANNED |
| Work objects (tickets, decisions, referrals) | PLANNED |
| Agent-to-agent collaboration runtime | In-memory skeleton only |
| RPG walking character / pixel-map interaction | POST-BETA |
| Semantic / vector search | PLANNED |
| Automatic Harness rollback | NOT IMPLEMENTED (pre-apply checkpoint exists; manual revert only) |

---

## 10. Confirmed User-Created Agent Boundary

| Dimension | Current Status |
|-----------|---------------|
| Create agent record | CURRENT — `POST /api/agents` |
| List user's agents | CURRENT — `GET /api/agents` |
| Agent detail view | CURRENT — `GET /api/agents/:id` |
| Agents visible on platform dashboard | CURRENT |
| Agents executing AI work | NOT IMPLEMENTED |
| Agents with model / tool / skill configuration | NOT IMPLEMENTED |
| Agents routing to any execution runtime | NOT IMPLEMENTED |

**The correct PRD framing:** Users can create persistent agent profiles on the platform. These agents are visible in the command-center dashboard. Configuring agents with tools, knowledge, skills, and making them execute AI work is planned post-beta.

---

## 11. Confirmed Multi-Agent Current / Planned Boundary

| Capability | Status |
|------------|--------|
| Builder Agent AI execution | CURRENT |
| OrchestrationService contracts + skeleton | CURRENT (in-memory, no persistence) |
| Orchestration referral enqueue flow + cancel (contracts) | CURRENT (in-memory only) |
| Multi-Builder topology plan | CURRENT (plan complete — AGENT-PLATFORM-04/05) |
| agentRole + builderProfileId propagation through execution path | CURRENT (AGENT-PLATFORM-06) |
| Real non-Builder agent execution | NOT IMPLEMENTED |
| Agent-to-agent referral runtime | NOT IMPLEMENTED |
| Multi-agent collaboration runtime | NOT IMPLEMENTED |
| Shared knowledge runtime | NOT IMPLEMENTED |
| Genuine multi-agent ainow.biz beta | **NO-GO at current stage** |

---

## 12. Confirmed Billing Current / Planned Boundary

| Capability | Status |
|------------|--------|
| Usage records per execution | CURRENT |
| Credit balances per user | CURRENT (PostgreSQL `credit_balances`) |
| Free-plan credit provisioning on registration | CURRENT (BILLING-READY-08) |
| Credit deduction per execution | CURRENT |
| CreditBalanceGuard on AI execution | CURRENT |
| Admin credit grants | CURRENT |
| Billing page / balance display UI | CURRENT |
| Stripe entity schemas / migrations | IMPLEMENTED (not live-activated) |
| Stripe checkout session creation (backend) | IMPLEMENTED (not live-activated) |
| Webhook ingestion / idempotency | IMPLEMENTED (not live-activated) |
| Live Stripe payment / checkout / subscription | NOT CURRENT — `BILLING_CHARGES_ENABLED=false` |
| Customer portal | NOT CURRENT — endpoint placeholder; `Coming Soon` in UI |
| Commercial billing enforcement | NOT CURRENT |

---

## 13. Confirmed Private Beta Product Boundary

| Fact | Status |
|------|--------|
| staging.ainow.biz live and verified | COMPLETE (PRIVATE-BETA-DEPLOYMENT-READINESS) |
| Core Builder product loop staging-proven | COMPLETE (FR-04 PASS — 2026-08-07) |
| Free-plan credit provisioning on staging | COMPLETE (BILLING-READY-08 PASS) |
| PRIVATE-BETA-INVITE-01 | NOT REGISTERED — untouched |
| Users invited to beta | NONE — no invitations executed |
| GLOBAL_EXECUTION_ENABLED | false (deliberate; controlled per-session smoke only) |

The PRD should describe the intended initial beta product scope (Builder-first, controlled, with non-Builder agents clearly coming soon). It should NOT imply invitations have started.

---

## 14. Exact Stale Architecture / Product Assumptions Requiring Correction

These are the exact false or stale assertions in PRD.md that Step 3 must correct:

### Critical False Architecture Claims (must remove/replace)

1. **§4**: `Database: SQLite (current)` — REPLACE with brief reference to ARCHITECTURE.md. PostgreSQL is current. No SQLite.
2. **§4**: `Communication between services is HTTP-only.` — REMOVE/REPLACE. System uses mixed transport. Defer to ARCHITECTURE.md.
3. **§3A**: `Enforcement is request-driven (no background workers)` — AMEND. Governance enforcement is request-driven. AI execution is queue-driven via WorkerProcessor. These are different concerns.
4. **§7 NFR**: `No background workers` — REMOVE. WorkerProcessor exists for AI execution.
5. **§10**: `If any conflict exists, this PRD takes precedence.` — CORRECT. ARCHITECTURE.md is the technical authority. PRD governs product scope. These are complementary, not competing.

### Stale Product Framing (must amend)

6. **§1**: Product is presented as standalone "AI Sandbox Platform" with no ainow.biz/Builder framing.
7. **§1, §2, §3A**: Sessions as primary user identity — must be reframed as project-first (project = durable identity; session = runtime lifetime).
8. **§3E**: AI as peripheral caller — must be replaced with AI execution as core product loop.
9. **§3F**: Credit/balance/enforcement billing all described as "future" — current infrastructure is substantial.
10. **§8**: "Billing enforcement logic" as a non-goal — basic enforcement is current; live payment is not.
11. **§9**: Summary is session-centric and pre-ainow.biz.

### Missing Product Requirements (must add)

12. No mention of: project persistence (durable identity, save/restore, import/export)
13. No mention of: chat/conversation persistence (now backend-persisted)
14. No mention of: git checkpoints as a product feature
15. No mention of: multilingual UX requirement (en, zh-TW, zh-CN)
16. No mention of: ainow.biz platform identity / Builder Agent framing
17. No mention of: user-created agent profiles (persistence-level current capability)
18. No mention of: structured AI file-action pipeline (parse → apply → coherence → checkpoint)
19. No mention of: Agent Harness (GATED capability)
20. No mention of: GLOBAL_EXECUTION_ENABLED as product safety gate
21. No mention of: 503 error semantic (execution kill-switch)
22. No mention of: Admin operations as product scope

---

## 15. Genuine UNKNOWN Items

These items were not clearly determinable from available evidence. Step 3 should not assert these without further evidence.

| Item | Uncertainty |
|------|-------------|
| Whether PRD.md was ever formally approved as a product document vs. drafted as an early technical spec | Unclear from content — reads more like a technical spec than a product requirements doc |
| Whether the Feature → Implementation Mapping table in §10 is still valid (references Module numbers) | Module numbering from an earlier task structure; may not align with current task IDs |
| Exact scope of Admin Console as product feature vs. operational support tool | Admin operations are implemented; PRD scope classification unclear |
| Preview status endpoint 404 finding — whether this is a product gap or a known environment config issue | FR-02 finding — not investigated; not a PRD error but a runtime finding |

---

## 16. Canonical Terminology Recommendations for Step 3

The existing PRD mixes terminology in ways that could mislead. Step 3 should use these canonical definitions:

| Term | Canonical Definition |
|------|---------------------|
| **ainow.biz** | The umbrella platform. Hosts all agents and provides common UX shell, registry, billing, and identity. |
| **Builder Agent** | The first functional AI coding agent on ainow.biz. The aiSandBox module. Routes to `/[locale]/app`. |
| **Project** | A durable user-owned work identity. Persists across sessions. Has name, files, chat, checkpoints. |
| **Session** | The runtime execution container lifetime within a project workspace. CREATED → ACTIVE → TERMINATED. |
| **Workspace** | The active files + editor + preview environment within a session. Tied to `/workspace` in container. |
| **User-created agent** | A persisted agent profile created by a user. Currently: name/role/description/status in DB. Not yet executable. |
| **System agent** | A built-in agent declared in the static registry. Builder is active; others are `coming_soon` placeholders. |
| **AI Execution** | The single-shot or (GATED) harness path: POST /api/ai/execute → queue → WorkerProcessor → provider → file-actions. |
| **File actions** | Structured instructions output by AI (write/delete file). Parsed, applied, and followed by workspace coherence. |
| **Agent Harness** | The GATED multi-turn tool loop. Implemented. Not the default Builder experience. |

These distinctions should appear as a brief glossary or be used consistently in the amended PRD.

---

## 17. Step 3 Bounded Edit Plan

This is the exact edit plan for GOV-PRD-01 Step 3.

### 17.1 Governing Principle

PRD.md must remain a product requirements document.
- Do NOT insert: service ports, queue names, migration details, database table names, PM2 config, Docker internals, full API endpoint lists, ToolDispatcher internals.
- DO reference ARCHITECTURE.md for all technical implementation detail.
- DO retain all valid product governance requirements.
- DO amend stale product framing without losing the original intent.
- DO add CURRENT/GATED/PLANNED distinctions where useful for product scope clarity.
- DO NOT blindly rewrite the entire PRD — patch the stale sections.

### 17.2 Section-by-Section Edit Plan

| Section | Action | Scope |
|---------|--------|-------|
| §1 Overview | AMEND | Update product name/framing to ainow.biz/Builder Agent. Preserve AI coding mission. |
| §2 Goals | AMEND | Add project-first, multilingual, and platform goals. Split billing goal into CURRENT/PLANNED. |
| §3A Session Management | AMEND | Retain session governance; clarify project-vs-session identity; remove/amend "no background workers" false sub-claim. |
| §3B Code Execution | AMEND | Clarify AI execution is primary user-facing path; container exec is infrastructure. |
| §3C File System Operations | AMEND | Retain; add brief mention of AI file-action pipeline and workspace coherence. |
| §3D Preview & Run | RETAIN with minor amend | Preserve requirements; add workspace coherence context. Remove health-check claim if 404 finding unresolved. |
| §3E AI Integration | REPLACE | Describe single-shot AI execution path (high-level); file-action pipeline; Agent Harness as GATED; GLOBAL_EXECUTION_ENABLED gate; workspace coherence. |
| §3F Billing | SPLIT | CURRENT: credit balances, deduction, free-plan provisioning, CreditBalanceGuard. PLANNED/NOT ACTIVATED: Stripe payment, subscriptions. |
| §3 — NEW subsection | ADD | Project persistence: durable project identity, save/restore, import/export, chat persistence, git checkpoints. |
| §3 — NEW subsection | ADD | Platform and agent registry: ainow.biz umbrella, Builder active, 3 system placeholders coming soon, user-created agent profiles (persistence current; execution planned). |
| §3 — NEW subsection | ADD | Multilingual UX: en/zh-TW/zh-CN current requirement. |
| §4 Architecture Summary | REPLACE | Replace false claims with brief high-level description + reference to ARCHITECTURE.md. No ports/queue names/table names. |
| §5 Governance Model | AMEND | Retain valid requirements; clarify request-driven governance vs. queue-driven AI execution. |
| §6 Error Semantics | AMEND | Retain table; add 503 for GLOBAL_EXECUTION_ENABLED gate. |
| §7 NFR | AMEND | Remove "No background workers." Retain other NFRs. Add multilingual and project persistence NFRs. |
| §8 Non-Goals | AMEND | Retain cleanup/coordination/resurrection/WebSocket non-goals. Replace "Billing enforcement logic" with "Live commercial payment/Stripe/subscription management." Add appropriate multi-agent/knowledge/RPG post-beta non-goals. |
| §9 Summary | AMEND | Rewrite to reflect current scope (ainow.biz, Builder-first, project-first, multilingual, credit-governed). |
| §10 Authority clause | CORRECT | Clarify ARCHITECTURE.md is technical authority; PRD governs product scope. Update Feature→Implementation mapping if module numbers are stale. |

### 17.3 Do Not Change in Step 3

- The locked task history in TASKS.md / TASKS_BACKLOG_FULL.md
- ARCHITECTURE.md
- CLAUDE.md
- Any source files, tests, packages, migrations, Docker files, schemas, environment files
- GOV-ARCH-01-CHECKPOINT.md
- AGENT-PLATFORM-00 or any other docs
- PRIVATE-BETA-INVITE-01 (untouched)
- GLOBAL_EXECUTION_ENABLED (unchanged)

### 17.4 File Changed in Step 3

The ONLY file modified in Step 3 must be:
```
C:\Users\knlee\aiSandBox2026B\PRD.md
```

No other file may be modified.

---

## 18. Safety Confirmations

- [x] PRD.md was NOT modified in this step.
- [x] ARCHITECTURE.md was NOT modified in this step.
- [x] CLAUDE.md was NOT modified in this step.
- [x] TASKS.md was NOT modified in this step (read-only grep only).
- [x] TASKS_BACKLOG_FULL.md was NOT modified in this step.
- [x] AINOW-EXECUTION-ROADMAP.md was NOT modified.
- [x] AGENT-PLATFORM-00 was NOT modified.
- [x] No source files, tests, packages, Docker files, migrations, schemas, or environment files were modified.
- [x] No Docker, PostgreSQL, Redis, migration, server, browser smoke, provider, staging, or deployment commands were run.
- [x] No secret-bearing `.env` files were opened.
- [x] No git commit or push was performed.
- [x] No subagents were used.
- [x] PRIVATE-BETA-INVITE-01 is untouched.
- [x] GLOBAL_EXECUTION_ENABLED is unchanged and undocumented as a gate (deliberate safety gate).
- [x] All COMPLETE AND LOCKED history is preserved.
- [x] This file (`docs/GOV-PRD-01-STAGE-START.md`) is the ONLY file created in Step 2.

---

## 19. Exact Next Step

**GOV-PRD-01 Step 3 — Bounded PRD.md Reconciliation**

Scope: Implement the bounded edit plan in Section 17 above.
- Modify ONLY `PRD.md`.
- Follow the section-by-section edit plan in §17.2.
- Do not modify ARCHITECTURE.md, CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, or any other file.
- Do not modify source, tests, packages, Docker files, migrations, schemas, or environment files.
- Do not run any runtime or infrastructure commands.
- Apply the canonical terminology from §16.
- Retain all valid product governance requirements.
- Do not insert architecture implementation details (ports, queue names, table names, etc.) into PRD.md — reference ARCHITECTURE.md instead.

After Step 3 is complete, proceed to:
**GOV-PRD-01 Step 4 — Consolidation / Checkpoint**
- Create `docs/GOV-PRD-01-CHECKPOINT.md`.
- Update TASKS.md and TASKS_BACKLOG_FULL.md to mark GOV-PRD-01 COMPLETE AND LOCKED.

---

*Evidence document created: 2026-08-10 — GOV-PRD-01 Step 2 Stage-Start.*
*Zero production, runtime, source, or infrastructure changes occurred in this step.*
*PRD.md was NOT modified.*
