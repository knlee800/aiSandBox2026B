# AGENT-PLATFORM-00 — Consolidation Checkpoint

**Task ID:** AGENT-PLATFORM-00
**Family:** AGENT PLATFORM / AINOW.BIZ MULTI-AGENT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-04
**Checkpoint created:** 2026-07-04

---

## 1. Task Summary

AGENT-PLATFORM-00 was a documentation and governance-only planning task. Its objective was to create the master planning document for the ainow.biz multi-agent platform, defining the product model, agent architecture, collaboration protocol, knowledge model, work objects, UX direction, billing model, and phased delivery roadmap.

No implementation code was written. No source files, test files, frontend UI files, package files, environment files, Docker files, database files, or schema files were changed. No runtime commands were executed.

A clarification pass was completed prior to consolidation, incorporating 6 clarifications directly into the master plan document.

---

## 2. Exact Files Changed

| File | Change |
|------|--------|
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Created — master plan document (planning pass + clarification pass) |
| `docs/AGENT-PLATFORM-00-CHECKPOINT.md` | Created — this checkpoint document |
| `TASKS.md` | Updated — AGENT-PLATFORM-00 marked COMPLETE and LOCKED, acceptance criteria checked, checkpoint reference added |
| `TASKS_BACKLOG_FULL.md` | Updated — AGENT-PLATFORM-00 marked COMPLETE and LOCKED, acceptance criteria checked, checkpoint reference added |

No other files were changed.

---

## 3. Scope Confirmation

This task was strictly documentation and governance:

- No implementation source code created or modified.
- No tests created or modified.
- No frontend UI files created or modified.
- No package.json, package-lock.json, or node_modules changes.
- No .env or secret files created or modified.
- No Docker files created or modified.
- No database schema files created or modified.
- No runtime commands, provider calls, database mutations, browser smoke, or Docker commands executed.
- No subagents used.
- No git commits or pushes performed.

---

## 4. Product Direction Captured

ainow.biz is the evolution of aiSandBox from a standalone AI coding sandbox into a general-purpose multi-agent work platform.

Key product decisions captured in the master plan:

- **ainow.biz** is the top-level platform name and domain direction.
- The platform provides: agent registry, dashboard shell, common knowledge base, collaboration protocol, work object system, billing/entitlement, and user identity.
- The current aiSandBox application becomes **Builder Agent** — the first fully functional agent on the platform.
- The platform is designed for solo founders, small teams, and indie operators.
- Core value proposition: "Your AI team — specialized agents that collaborate on real work."

---

## 5. First Agents Captured

The four initial agents are defined in the master plan (§3):

| Agent | Status | Description |
|-------|--------|-------------|
| **Builder Agent** | REAL — existing aiSandBox | AI coding agent. Full workspace, file ops, preview, checkpoint/revert. Powered by Agent Harness. |
| **Chief of Staff Agent** | COMING SOON — placeholder | Daily operations: email triage, to-do management, meeting prep, contract coordination. |
| **Product Strategy Agent** | COMING SOON — placeholder | Strategic planning: market analysis, roadmap drafting, OKR tracking, user research synthesis. |
| **Technology Advisor Agent** | COMING SOON — placeholder | Technology decisions: architecture review, tech stack evaluation, vendor comparison. |

Only Builder Agent has real implementation. The other three are placeholder entries — visible on the dashboard as "coming soon" but not functional.

---

## 6. Agent Registry / Manifest Model Captured

The agent registry concept and manifest model are captured in the master plan (§4, §5):

- Registry is declarative, extensible, versioned, typed, and multilingual.
- Registry operations: `list()`, `get(id)`, `listEnabled()`, `listByStatus(status)`.
- Registry is read-only at runtime; agent registration is a deployment/configuration concern.
- `AgentManifest` interface defined with all fields: `id`, `nameKey`, `roleKey`, `descriptionKey`, `route`, `avatarRef`, `spriteRef`, `status`, `enabled`, `modelProfile`, `toolPermissions`, `knowledgeScopes`, `skills`, `referralRules`, `approvalRules`, `manifestVersion`.
- `AgentModelProfile` and `AgentToolPermissions` sub-interfaces defined.
- All user-facing text fields use translation keys, not hardcoded strings.

---

## 7. Skills and Knowledge Model Captured

**Skills model** (§6):

- `AgentSkillRef` interface defined with: `id`, `nameKey`, `descriptionKey`, `category`, `promptTemplateRef`, `toolSet`, `knowledgeScopeOverrides`.
- Example skills defined for all four agents (Builder Agent, Chief of Staff, Product Strategy, Technology Advisor).

**Knowledge scopes** (§7):

- `KnowledgeScope` interface defined.
- Shared scopes (all agents): `company-monthly-reports`, `three-year-goals`, `strategy-docs`, `policies`, `meeting-summaries`.
- Specialist scopes (per-agent): `codebase-context` (Builder), `contract-templates` (Chief of Staff), `market-data` (Product Strategy), `tech-landscape` (Technology Advisor).
- Access rules: agents can only access scopes listed in their manifest; shared scopes included by default; specialist scopes are opt-in.

**Knowledge privacy and access controls** (§7.5) — clarification applied:

- Tenant/organization isolation: knowledge data is isolated per tenant/organization.
- Manifest-scoped access: platform enforces access at the access layer, not inside agents.
- Granular access levels: raw/full content access controlled separately from summary/key-fact access. Details deferred to AGENT-KNOWLEDGE-00.
- Source traceability: every knowledge item retains a `sourceRef` for audit and verification.
- Retention and deletion: configurable retention periods and explicit deletion by owner. Policy details deferred to AGENT-KNOWLEDGE-00.
- No cross-scope leakage: agents must not embed or quote specialist knowledge from scopes the receiving party cannot access. Enforcement details deferred to AGENT-KNOWLEDGE-00.

**Common knowledge base** (§8):

- `KnowledgeItem` interface defined with: `id`, `scopeId`, `sourceType`, `sourceRef`, `title`, `summary`, `keyFacts`, `fullContent`, `createdAt`, `updatedAt`, `expiresAt`.
- Processing pipeline defined: format detection → markdown normalization → summary extraction → key facts extraction → storage → availability.

---

## 8. Multi-Agent Collaboration Model Captured

The collaboration model is captured in the master plan (§9, §10):

- Collaboration is structured, not ad-hoc. Agents follow defined referral and approval rules.
- **More than two agents can participate** in a collaboration workflow.
- Typical complex business decision may involve **4–5 agents**.
- All collaboration produces an audit trail.
- The human owner (Keith) is always the final authority for external-facing actions.
- Collaboration mechanisms: automatic referral, shared tickets, shared decisions, approval gates, agent comments, audit trail.
- `AgentReferralRule` interface defined with: `id`, `triggerCondition`, `targetAgentId`, `referralType`, `priority`, `autoCreate`, `requiresOwnerApproval`.
- Multi-agent collaboration flow documented end-to-end (§9.5).
- Example workflow: contract negotiation (§10) with 11 steps across multiple agents.

**Collaboration safety clarifications applied** (§9.6):

| Safety Limit | Description |
|-------------|-------------|
| Maximum referral depth | Configurable limit on referral chain depth. Limit reached → platform pauses chain, notifies owner. |
| Maximum agents per collaboration | Configurable limit on distinct agents per workflow. Exceeding limit requires owner approval. |
| Duplicate referral detection | Idempotency key (source work object + target agent + referral type). Platform rejects duplicate referrals. |
| Referral loop prevention | Platform tracks referral chain path. Referral back to an agent already in the chain → blocked, owner notified. |
| Threshold pause and owner approval | Any safety limit reached → platform pauses collaboration, logs audit event, requires explicit owner approval. |

Concrete configuration values deferred to AGENT-COLLAB-00.

---

## 9. Approval and Safety Model Captured

The approval and safety model is captured in the master plan (§9.4, §12):

- Agents may create internal work objects autonomously.
- External-facing actions always require **Keith approval**.

**Actions requiring Keith approval:**

- External emails (sending to any external party)
- Contract acceptance (accepting, modifying, or rejecting contract terms)
- Payments (initiating any payment or financial commitment)
- External commitments (binding commitments to external parties)
- Destructive actions (deleting data, revoking access, terminating agreements)
- Public-facing content (blog posts, social media, press releases)

**Approval timeout safety clarification applied** (§9.4):

- Default timeout behavior is `block`. No action is taken if approval timeout expires without a decision.
- For external-facing, destructive, financial, contract, public-facing, legal, permission-changing, or binding commitment actions: `defaultOnTimeout` must always be `block`. This is platform-enforced, not configurable per rule.
- `allow` may only be used for low-risk internal actions with no external consequence (e.g., auto-closing a stale internal review referral).
- Any attempt to set `defaultOnTimeout: 'allow'` on a high-risk action category must be rejected at manifest validation time.

**Safety boundaries:**

- No agent may send external communications without explicit human approval.
- No agent may make financial commitments without explicit human approval.
- Approval gates cannot be bypassed by agent-to-agent referral.
- All approval decisions are logged in the audit trail.

---

## 10. UX/UI Direction Captured

**RPG dashboard concept** (§13):

- First UX milestone: **static RPG office/town dashboard shell**.
- Static dashboard is the first UI milestone **after the agent registry** (AGENT-PLATFORM-01 → AGENT-PLATFORM-02).
- Visual style: RPG office/town hybrid, pixel art style, clean modern surrounding layout.
- First milestone elements: dashboard layout, agent positions, static pixel art avatars, status badges, agent click/tap navigation, coming-soon overlay, responsive behavior.

**Dashboard timing clarification applied:**

- The static RPG office/town dashboard shell (AGENT-PLATFORM-02) is an early follow-up after the agent registry (AGENT-PLATFORM-01).
- Full interactive dashboard features are deferred: walking character, real-time agent activity, animated RPG interactions, environment interaction.

**Interactive walking character clarification:**

- **Walking character is deferred.** The character walking around the office/town is a later UX milestone, not in the first static dashboard shell.

**Multilingual-first UX/UI rules captured** (§14.1):

- All user-facing UI text must use translation keys.
- No hardcoded English user-facing copy unless explicitly approved as temporary developer/debug-only text.
- Translation files must all be updated together in the same implementation slice: `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`.
- Use the existing translation hook/pattern.

**Work object multilingual behavior clarification applied** (§11):

- Fixed UI labels, statuses, type names, and action text use translation keys (multilingual-first via i18n system).
- User-generated and agent-generated content (ticket titles, draft text, agent comments) is stored as plain content in natural language — not translated through the i18n key system.
- System-generated templates should use localized templates where practical.
- Any future UI rendering work objects must update all three translation files for all fixed UI chrome.

**Icon library** (§14.2):

- Normal UI icons: **Heroicons v2 Outline** (`@heroicons/react/24/outline`) only, unless explicitly approved otherwise.
- RPG/pixel art elements use custom pixel art assets (separate from icon library rule).

**Advisory skills** (§14.3):

- Impeccable and Emil Kowalski design engineering skills are **advisory-only**.
- Advisory skills must not override governance, scope, architecture, or tests.

---

## 11. Billing and Commercial Direction Captured

The billing and commercial model is captured in the master plan (§15):

**Plan structure:**

| Plan | Target User | Direction |
|------|-------------|-----------|
| Free | Exploration, evaluation | $0 — limited credits |
| Starter | Solo founder, light usage | Low price — moderate credits |
| Pro | Active solo or small team | Medium price — generous credits |
| Team | Collaborative team usage | Higher price — shared team credits, multi-seat |

**Credit model:** Monthly credits consumed by tokens, tool calls, agent runs, scheduled jobs (future), workspace/runtime usage, and premium integrations (future).

**Stripe / payment integration:**

- **Real Stripe integration and payment processing are deferred.**
- Current direction: define the plan/credit/entitlement data model and audit existing usage tracking.
- `PlanEntitlement` interface defined with all fields.

---

## 12. Relationship to Agent Harness Captured

The relationship between the ainow.biz platform layer and the Agent Harness execution layer is captured in the master plan (§17).

**Agent Harness runtime-gated wording clarification applied** (§17.1):

- The existing Agent Harness (AGENT-HARNESS-00 through AGENT-HARNESS-05C8) is the **execution foundation for Builder Agent**.
- The harness capabilities (multi-turn tool loop, tool protocol, dispatcher, validation runner, pre-apply checkpoint, rollback, token accounting, byte limits) are implemented and unit-tested.
- **Runtime activation remains gated.** `enableToolLoop` remains `false` in all environments unless explicitly enabled in a future validated activation task.
- **Platform-level work (agent registry, dashboard, collaboration protocol) must not assume the harness tool loop is active** until the gate is intentionally enabled and runtime-validated in a dedicated task.
- The existing single-shot AI execution path continues to operate as the active production path until the harness gate is opened.

---

## 13. Clarifications Applied

Six clarifications were incorporated into the master plan document during the clarification pass:

| # | Clarification | Section(s) Applied |
|---|--------------|-------------------|
| 1 | Dashboard timing — static RPG dashboard is first milestone after agent registry; full interactive features deferred | §13.3 (First Milestone Scope), §13.4 (Not in First Milestone), §16 (Deferred Items) |
| 2 | Collaboration safety limits — max referral depth, max agents per collaboration, duplicate referral/idempotency, loop prevention, threshold pause/owner approval | §9.6 (Collaboration Safety Limits) |
| 3 | Approval timeout safety — default is `block`; platform-enforced for high-risk categories; `allow` restricted to low-risk internal actions only; manifest validation rejects unsafe values | §9.4 (Approval Rules) |
| 4 | Work object multilingual behavior — UI chrome uses i18n keys; user/agent-generated content is plain natural language; system templates use localized templates where practical | §11 (Work Object Base Shape note) |
| 5 | Knowledge privacy and access controls — tenant isolation, manifest-scoped access, granular access levels, source traceability, retention/deletion policy deferred to AGENT-KNOWLEDGE-00, no cross-scope leakage | §7.5 (Knowledge Privacy and Access Controls) |
| 6 | Agent Harness runtime-gated wording — harness is execution foundation for Builder Agent; enableToolLoop remains false; platform work must not assume harness tool loop is active | §17.1 (Agent Harness as Execution Foundation) |

---

## 14. Explicit Non-Goals

The following were explicitly excluded from AGENT-PLATFORM-00:

- No implementation code of any kind.
- No activation of Agent Harness tool loop.
- No registration of follow-up tasks (proposed roadmap only — not registered).
- No AGENT-HARNESS-05C9 registration.
- No database schema changes.
- No frontend UI changes.
- No Docker or runtime changes.
- No interactive walking character implementation.
- No real Stripe/payment integration.
- No real multi-agent runtime orchestration.
- No Gmail/Slack/Notion integrations.

---

## 15. Validation Evidence

| Criterion | Evidence |
|-----------|----------|
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` created | File exists at full path. All 19 required sections confirmed by inspection. |
| `docs/AGENT-PLATFORM-00-CHECKPOINT.md` created | This file. |
| TASKS.md updated | AGENT-PLATFORM-00 marked COMPLETE and LOCKED. Acceptance criteria checked. Checkpoint ref added. |
| TASKS_BACKLOG_FULL.md updated | Same mirrored updates applied. |
| No source/test/frontend/package/env/Docker/schema/database files changed | Confirmed by inspection — only governance/docs files touched. |
| No runtime/provider/database/browser/Docker commands executed | Confirmed — only read and write file operations performed. |
| No subagents used | Confirmed — all work performed in current session without Task tool. |
| AGENT-PLATFORM-01 not registered | Confirmed — recorded as "next recommended" only, not registered. |
| AGENT-HARNESS-05C9 not registered | Confirmed — not touched in this task. |

---

## 16. Runtime / Provider / Database / Browser / Docker Confirmation

No runtime, provider, database, browser, or Docker commands were executed in this task.

- No Docker commands run.
- No database queries or mutations executed.
- No browser smoke tests run.
- No external API or provider calls made.
- No Stripe/payment endpoints called.
- No container commands issued.
- No environment variable changes applied.

---

## 17. No Implementation Code Confirmation

No implementation code was written or modified in this task.

- No TypeScript/JavaScript source files created or modified.
- No React/Next.js component files created or modified.
- No NestJS service or controller files created or modified.
- No test files created or modified.
- No migration or schema files created or modified.
- No configuration files (package.json, tsconfig.json, .env, docker-compose.yml) created or modified.

All TypeScript interface definitions in the master plan document are **planning artifacts** (documentation only), not implementation source code.

---

## 18. Remaining Risks

| Risk | Assessment | Mitigation |
|------|------------|------------|
| Knowledge privacy details remain partially deferred | AGENT-KNOWLEDGE-00 must define full access control enforcement, embedding/vector search access, and retention/deletion policy | Deferred explicitly to AGENT-KNOWLEDGE-00 per master plan §7.5 and §16 |
| Collaboration safety limit values not yet defined | Concrete configuration values (e.g., max referral depth = N) are not yet set | Deferred to AGENT-COLLAB-00 per master plan §9.6 |
| Agent Harness runtime gate still closed | enableToolLoop remains false; Builder Agent runs single-shot path until a future validated activation task | No action needed until that activation task is explicitly registered and approved |
| AGENT-PLATFORM-01 not yet registered | The agent registry implementation has not started | Next recommended task is AGENT-PLATFORM-01; Keith decides when to register and start |
| Master plan is a planning artifact only | None of the defined interfaces, registry, manifest fields, or UX direction are implemented yet | All implementation begins with AGENT-PLATFORM-01 and subsequent tasks |

---

## 19. Next Recommended Task

**AGENT-PLATFORM-01 — Agent Registry Foundation**

Description: Define agent manifest TypeScript types, create static registry with Builder Agent + 3 placeholder entries (Chief of Staff, Product Strategy, Technology Advisor), add registry service layer.

Dependency: AGENT-PLATFORM-00 (this task — COMPLETE and LOCKED).

**Status: Not registered. Keith decides when to register and begin.**

Do not register AGENT-PLATFORM-01 in this checkpoint step. Do not register AGENT-HARNESS-05C9 in this checkpoint step.

---

## 20. Final Status

**AGENT-PLATFORM-00: COMPLETE and LOCKED — 2026-07-04**

All acceptance criteria satisfied. Master plan created. Clarifications applied. Checkpoint created. Governance files updated.

No implementation code written. No runtime commands executed. No subagents used. No commits made.
