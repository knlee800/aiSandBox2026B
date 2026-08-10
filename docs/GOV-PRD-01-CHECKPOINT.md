# GOV-PRD-01-CHECKPOINT.md
## GOV-PRD-01 — PRD.md Current-State Reconciliation — Consolidation Checkpoint

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| **Task ID** | GOV-PRD-01 |
| **Title** | PRD.md Current-State Reconciliation |
| **Family** | GOVERNANCE / PRODUCT REQUIREMENTS / CURRENT-STATE RECONCILIATION |
| **Workflow** | 4-step HIGH-governance-risk lifecycle |
| **Model** | Sonnet 4.6 (all steps) |
| **Registered** | 2026-08-10 |
| **Closed** | 2026-08-10 |
| **Predecessor** | GOV-ARCH-01 — COMPLETE AND LOCKED — 2026-08-10 |

---

## 2. Final Status

**COMPLETE AND LOCKED — 2026-08-10**

All four steps executed. PRD.md reconciled from stale standalone AI Sandbox specification to accurate ainow.biz / Builder-first product requirements document. No source, test, configuration, schema, migration, environment, Docker, or runtime changes occurred at any step.

---

## 3. Purpose

GOV-PRD-01 corrected materially stale product and architecture claims in `PRD.md` that had accumulated from the earlier standalone AI Sandbox era. The stale PRD presented false architecture claims (SQLite, HTTP-only, no background workers), outdated product identity (no ainow.biz framing, no Builder Agent identity, no project-first model), and missing product requirements (chat persistence, project persistence, import/export, multilingual UX, user-created agent profiles, credit/billing current state, Agent Harness gating, preview current status).

GOV-PRD-01 corrected all confirmed false or stale claims while preserving all valid original product requirements (session governance, container isolation, deterministic failure semantics, reversibility, non-goals for cleanup workers, distributed coordination, auto-resurrection, and WebSocket control APIs).

---

## 4. Step Completion Table

| Step | Description | Status | Date |
|------|-------------|--------|------|
| Step 1 | Registration — GOV-PRD-01 registered in TASKS.md and TASKS_BACKLOG_FULL.md | COMPLETE | 2026-08-10 |
| Step 2 | PRD Evidence Reconciliation / Stage-Start — full read-only PRD audit, evidence classification, edit plan | COMPLETE | 2026-08-10 |
| Step 3 | Bounded PRD.md Reconciliation — implementation of Step 2 edit plan; PRD.md only | COMPLETE | 2026-08-10 |
| Step 4 | Consolidation / Checkpoint — checkpoint created, task locked | COMPLETE | 2026-08-10 |

---

## 5. Files Changed Across Lifecycle

### Step 1 — Registration
| Action | File |
|--------|------|
| Modified | `TASKS.md` |
| Modified | `TASKS_BACKLOG_FULL.md` |

### Step 2 — Stage-Start
| Action | File |
|--------|------|
| Created | `docs/GOV-PRD-01-STAGE-START.md` |

### Step 3 — Reconciliation
| Action | File |
|--------|------|
| Modified | `PRD.md` |

### Step 4 — Consolidation
| Action | File |
|--------|------|
| Created | `docs/GOV-PRD-01-CHECKPOINT.md` (this file) |
| Modified | `TASKS.md` |
| Modified | `TASKS_BACKLOG_FULL.md` |

No source files, tests, packages, Docker files, migrations, schemas, or environment files were modified in any step.

---

## 6. Product Framing Corrected

The reconciled PRD.md now presents:

- **ainow.biz** as the umbrella AI-agent platform — not "AI Sandbox Platform"
- **Builder Agent** as the first functional agent — the aiSandBox coding module
- aiSandBox coding experience as living **within Builder**, not as a standalone product
- Non-Builder system agents (Chief of Staff, Product Strategy, Technology Advisor) correctly as coming-soon **placeholders**, not functional agents
- The broader multi-agent runtime correctly as future/planned scope

The old standalone "AI Sandbox Platform" identity and session-centric primary framing have been replaced with ainow.biz / Builder-first product identity throughout.

---

## 7. Builder Current Promise

PRD.md now records the current Builder product loop at product level:

```
User describes what they want to build or change
→ Builder executes an AI request (single-shot path)
→ Structured file actions are produced (file writes, deletions)
→ Platform applies file actions to the workspace
→ File tree, editor, and preview reflect the changes
→ A git checkpoint is created for recovery
→ Project state persists durably across sessions
```

This is the staging-proven current product promise (FR-04 PASS — 2026-08-07). Low-level implementation detail (ports, queue names, table names, specific endpoints) is not reproduced in PRD.md — it is deferred to ARCHITECTURE.md.

---

## 8. Project / Session / Workspace Model

PRD.md now clearly distinguishes:

| Concept | Definition |
|---------|-----------|
| **Project** | A durable user-owned work identity. Persists across runtime sessions. Contains files, conversation history, and checkpoints. |
| **Session** | The runtime container execution environment for an open project. Lifecycle: CREATED → ACTIVE → TERMINATED. Not the primary user-facing product identity. |
| **Workspace** | The active files, editor, and preview environment within a running session. Sandboxed to the container workspace directory. |

Session termination does not destroy the project. Project files and checkpoints are preserved. The product is project-first, not session-first.

---

## 9. CURRENT Capabilities

PRD.md §10 now records the following as CURRENT (staging-proven or implementation-confirmed):

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

---

## 10. GATED Capabilities

PRD.md §10 now records the following as GATED (implemented; not the default):

| Capability | Gate |
|------------|------|
| AI execution globally | Deliberate safety gate must be enabled |
| Agent Harness multi-turn tool loop | Harness tool-loop gate must be enabled |
| Harness file mutation tools | Harness write-tools gate must be enabled |
| Harness validation tools | Harness validation-tools gate must be enabled |
| Harness browser automation tool | Harness browser-smoke gate must be enabled |

**GATED means implemented and operational under appropriate conditions — not absent or broken.**

`GLOBAL_EXECUTION_ENABLED` is the deliberate safety kill-switch for AI execution globally. It is not a product defect. Its current default state is intentional and unchanged by this task.

---

## 11. PLANNED / NOT CURRENT Capabilities

PRD.md §10 now records the following as PLANNED / NOT CURRENT:

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

No future functionality was promoted to CURRENT in this task.

---

## 12. User-Created Agent Boundary

| Dimension | Current Status |
|-----------|---------------|
| Create agent record | CURRENT — `POST /api/agents` |
| List user's agents | CURRENT — `GET /api/agents` |
| Agent detail view | CURRENT — `GET /api/agents/:id` |
| Agents visible on platform dashboard | CURRENT |
| Agents executing AI work | NOT IMPLEMENTED |
| Agents with model / tool / skill configuration | NOT IMPLEMENTED |
| Agents routing to any execution runtime | NOT IMPLEMENTED |

PRD.md now correctly states: users can create persistent agent profiles on the platform. These agents are visible in the command-center dashboard. Configuring agents with tools, knowledge, skills, and making them execute AI work is planned post-beta.

---

## 13. Multi-Agent Boundary

| Capability | Status |
|------------|--------|
| Builder Agent AI execution | CURRENT |
| OrchestrationService skeleton | CURRENT (in-memory; no persistence) |
| agentRole + builderProfileId propagation | CURRENT |
| Real non-Builder agent execution | NOT IMPLEMENTED |
| Agent-to-agent referral runtime | NOT IMPLEMENTED |
| Multi-agent collaboration runtime | NOT IMPLEMENTED |
| Genuine multi-agent ainow.biz beta | NO-GO at current stage |

PRD.md now correctly presents the broader multi-agent capability as planned post-beta direction.

---

## 14. Billing Boundary

| Capability | Status |
|------------|--------|
| Usage records per execution | CURRENT |
| Credit balances per user | CURRENT |
| Free-plan credit provisioning on registration | CURRENT (BILLING-READY-08) |
| Credit deduction per execution | CURRENT |
| CreditBalanceGuard on AI execution | CURRENT |
| Admin credit grants | CURRENT |
| Billing page / balance display UI | CURRENT |
| Stripe entity schemas / migrations | IMPLEMENTED (not live-activated) |
| Live Stripe payment / checkout / subscription | NOT CURRENT (`BILLING_CHARGES_ENABLED=false`) |
| Commercial subscription management | NOT CURRENT |

The old PRD incorrectly listed "Billing enforcement logic" as a non-goal. PRD.md now correctly records basic credit enforcement as CURRENT, and live commercial payment processing as PLANNED/NOT ACTIVATED.

---

## 15. Harness Boundary

PRD.md now correctly treats:

- Enhanced multi-turn agent capability (Agent Harness) as **implemented infrastructure** — GATED capability
- Default activation as deliberately off — not the initial beta Builder experience
- Staging-proven single-shot Builder path as the initial beta execution path

The Harness multi-turn path with real providers has not been proven in production. PRD.md does not claim production-proven real-provider autonomous Harness tool-loop execution.

Harness activation is recorded as an operational decision, not a user-facing beta promise.

---

## 16. Architecture References Corrected

The following false or stale architecture claims were removed from PRD.md:

| Former Claim | Correction |
|-------------|-----------|
| `Database: SQLite (current)` | PostgreSQL is the sole authoritative durable database. SQLite is not used. |
| `Communication between services is HTTP-only.` | Services use a mixed transport model — HTTP, queue-based messaging, and real-time channels. |
| `No background workers` (NFR) | AI execution queue worker (WorkerProcessor) is a background worker. The false "no background workers" NFR claim was removed. |
| `Enforcement is request-driven (no background workers)` (§3A) | Session governance enforcement is request-driven. AI execution runs asynchronously via queue worker after passing governance checks. |

PRD.md now defers all technical architecture detail to `ARCHITECTURE.md`. No service ports, queue names, database table names, or internal endpoints appear in PRD.md.

---

## 17. Authority Model Corrected

The dangerous authority clause `"If any conflict exists, this PRD takes precedence."` has been replaced.

PRD.md §12 now records the reconciled document authority:

| Document | Authority Domain |
|----------|-----------------|
| **PRD.md** | Current product requirements, product scope, feature intent, CURRENT/GATED/PLANNED distinctions |
| **ARCHITECTURE.md** | Technical architecture, service topology, communication patterns, database design, execution flows, implementation constraints. Technical implementation conflicts defer to ARCHITECTURE.md. |
| **TASKS.md / TASKS_BACKLOG_FULL.md / locked checkpoints** | Execution history, completion evidence, task governance |
| **CLAUDE.md** | Active working contract — takes precedence over convenience, assumptions, or shortcuts |

These authorities are complementary, not competing. PRD governs **what** the product does. ARCHITECTURE.md governs **how** it is implemented.

---

## 18. Original Valid Requirements Preserved

The following original PRD requirements were retained unchanged through reconciliation:

- Container-level resource limits (CPU, memory, PID)
- Session governance: max lifetime, idle timeout, concurrency limits
- Termination semantics: terminal, persisted, irreversible as runtime environment
- HTTP 410 Gone on terminated sessions
- HTTP 429 on concurrency exceeded
- Optional JWT-based preview access control
- Deterministic, idempotent enforcement
- Strong container isolation — no cross-session access
- Session governance is request-driven
- No background session cleanup workers / no scheduled cleanup cron
- No distributed session coordination
- No automatic session resurrection
- No WebSocket-based control APIs (WebSocket = preview only)
- AI cannot bypass session termination or resource limits
- No hardcoded secrets; environment-driven configuration
- Authentication and authorization enforced at API boundaries

---

## 19. Preview Current Status

**Preview is CURRENT and staging-proven.**

PRIVATE-BETA-BLOCKER-02 (COMPLETE AND LOCKED — 2026-08-09) resolved the historical preview routing defect (wrong-service Nest 404 caused by incorrect API Gateway fallback port). The fix was deployed to staging and validated:

- API Gateway `PreviewController` fallback corrected: `localhost:4001` → `localhost:4002`
- Live authenticated preview rendered actual content on staging
- Preview Refresh PASS
- Old wrong-service Nest 404 did not occur
- No localhost URL leak

PRD.md §10 lists "Workspace preview (proxy through container runtime)" under CURRENT. Preview is not recorded as unresolved. The old FR-02 preview 404 finding is closed and must not be recorded as a current limitation.

---

## 20. Residual Uncertainties

| Item | Nature |
|------|--------|
| Preview status endpoint `/api/preview/<session-id>/status` — FR-02 unresolved 404 | The specific status sub-endpoint finding from FR-02 was noted in GOV-PRD-01-STAGE-START as a separate runtime investigation item. PRIVATE-BETA-BLOCKER-02 resolved the proxy routing defect. The status sub-endpoint behavior is a separate operational item if it arises; it does not affect preview being CURRENT. |
| Stripe billing infrastructure activation path | Schemas and migrations are implemented; live activation is a future commercial launch decision. |
| Full API Gateway test suite 96 pre-existing failures | Verified unrelated to this governance task and to the preview fix (PRIVATE-BETA-BLOCKER-02 evidence). Not re-opened here. |
| Agent Harness real-provider production proof | Harness is implemented and gated; production multi-turn real-provider proof remains outstanding as a future operational decision. |
| Google OAuth activation | Config present; not activated; deferred by product decision. |

---

## 21. Explicit Out-of-Scope Items

The following were explicitly excluded from GOV-PRD-01:

- ARCHITECTURE.md changes
- CLAUDE.md changes
- AINOW-EXECUTION-ROADMAP.md changes
- AGENT-PLATFORM-00 amendments
- Agent Harness implementation work
- Monitoring work
- Private beta activation
- PRIVATE-BETA-INVITE-01 (untouched)
- Any source, test, configuration, schema, migration, environment, or Docker changes
- Runtime or infrastructure commands
- Subagents
- Git commit or push

---

## 22. Validation Performed

| Check | Result |
|-------|--------|
| Step 1 acceptance criteria | PASS — GOV-PRD-01 registered in both TASKS.md and TASKS_BACKLOG_FULL.md |
| Step 2 acceptance criteria | PASS — GOV-PRD-01-STAGE-START.md created; PRD.md not modified; full evidence classification complete |
| Step 3 acceptance criteria | PASS — PRD.md amended per Step 2 edit plan; no other files modified |
| ainow.biz umbrella framing present | PASS — §1, §2, §9, §11 |
| Builder identified as first functional agent | PASS — §1, §9, §11 |
| Project-first durable model represented | PASS — §3A |
| Session runtime model correct | PASS — §3B |
| Workspace definition correct | PASS — §3A, §11 |
| Builder core promise documented | PASS — §3C |
| Preview CURRENT and staging-proven | PASS — §3F, §10 |
| Project persistence represented | PASS — §3A, §7, §10 |
| Chat persistence represented | PASS — §3G |
| Import/export represented | PASS — §3A, §10 |
| Multilingual requirement represented | PASS — §3J, §7, §10 |
| User-created-agent persistence/execution boundary clear | PASS — §3I |
| Multi-agent current/planned boundary clear | PASS — §3I, §8, §9, §10 |
| Credit/accounting vs payment distinction clear | PASS — §3H |
| Harness current/gated distinction clear | PASS — §3C, §10 |
| GLOBAL_EXECUTION_ENABLED as safety gate | PASS — §3C |
| SQLite current claim removed | PASS — §4 explicitly states "SQLite is not used" |
| HTTP-only claim removed | PASS — §4 explicitly states "mixed transport model" |
| No-background-workers claim removed | PASS — removed from §7 NFR |
| Technical architecture deferred to ARCHITECTURE.md | PASS — §4 |
| Authority clause corrected | PASS — §12 |
| Valid original requirements retained | PASS — session governance, isolation, termination semantics all preserved |
| No future functionality promoted to CURRENT | PASS — PLANNED table accurate |
| No unresolved preview 404 recorded | PASS — preview listed as CURRENT |
| PRIVATE-BETA-INVITE-01 untouched | PASS |
| GLOBAL_EXECUTION_ENABLED unchanged | PASS |
| No runtime/infrastructure action | PASS |
| No subagents | PASS |
| No git commit/push | PASS |

**All acceptance criteria: PASS**

---

## 23. Safety Confirmations

- [x] PRD.md was NOT modified during Step 4 (consolidation only)
- [x] ARCHITECTURE.md was NOT modified in any step
- [x] CLAUDE.md was NOT modified in any step
- [x] AINOW-EXECUTION-ROADMAP.md was NOT modified
- [x] AGENT-PLATFORM-00 was NOT modified
- [x] No source files, tests, packages, Docker files, migrations, schemas, or environment files were modified in any step
- [x] No Docker, PostgreSQL, Redis, migration, server, browser smoke, provider, staging, or deployment commands were run
- [x] No secret-bearing `.env` files were opened
- [x] No git commit or push was performed
- [x] No subagents were used
- [x] PRIVATE-BETA-INVITE-01 is untouched
- [x] GLOBAL_EXECUTION_ENABLED is unchanged (deliberate safety gate — default false)
- [x] All COMPLETE AND LOCKED predecessors (GOV-ARCH-01, PRIVATE-BETA-BLOCKER-02, and all earlier locked tasks) remain unchanged
- [x] No unrelated task entries were changed in TASKS.md or TASKS_BACKLOG_FULL.md

---

## 24. Governance Impact

GOV-PRD-01 closes the paired governance work initiated by GOV-ARCH-01. Both GOV-ARCH-01 (architecture reconciliation) and GOV-PRD-01 (product requirements reconciliation) are now COMPLETE AND LOCKED.

The governance baseline is now:

| Document | State |
|----------|-------|
| `ARCHITECTURE.md` | Reconciled and authoritative (GOV-ARCH-01 COMPLETE AND LOCKED — 2026-08-10) |
| `PRD.md` | Reconciled and authoritative (GOV-PRD-01 COMPLETE AND LOCKED — 2026-08-10) |
| `TASKS.md` | Active execution ledger |
| `TASKS_BACKLOG_FULL.md` | Authoritative long-form backlog |
| `CLAUDE.md` | Active working contract |

Future Cursor/Claude sessions can now safely reference PRD.md and ARCHITECTURE.md as accurate documents without risk of acting on false architecture claims or stale product assumptions.

---

## 25. Recommended Next Action

**Next decision point: determine whether additional governance cleanup is required before minimal operational-readiness work for Builder-first beta.**

The following were noted as possible follow-ups during GOV-ARCH-01 and GOV-PRD-01 reconciliation, but are NOT registered by this task:

- AINOW-EXECUTION-ROADMAP.md cleanup (optional; not blocking)
- Monitoring/observability work (separate scope)
- Beta activation sequence (PRIVATE-BETA-INVITE-01 is UNBLOCKED for registration — requires explicit Keith approval before registration or execution)
- AGENT-PLATFORM-00 amendments (separate scope)

This decision should be made against the Builder-first-beta readiness sequence by Keith after reviewing the closed GOV-ARCH-01 and GOV-PRD-01 baseline.

Do NOT automatically register any new governance task from this consolidation.

---

## 26. Locked-State Instruction

**GOV-PRD-01 is COMPLETE AND LOCKED — 2026-08-10.**

Locked tasks must not be edited except for explicitly approved documentation correction.

The reconciled `PRD.md` must not be re-opened without a new registered governance or product task. Future product requirement changes must go through TASKS.md registration and governance discipline.

The checkpoint document `docs/GOV-PRD-01-CHECKPOINT.md` (this file) is a locked evidence artifact and must not be modified.

---

*Checkpoint created: 2026-08-10 — GOV-PRD-01 Step 4 Consolidation.*
*Zero production, runtime, source, or infrastructure changes occurred in any step of GOV-PRD-01.*
