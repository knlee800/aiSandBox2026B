# GOV-PRD-02 Step 2 — PRD Drift / Product-Idea Inventory and Step 3 Edit Plan

**Task ID:** GOV-PRD-02  
**Title:** Product Reconciliation  
**Step:** 2 — PRD drift/gap/idea inventory + Step 3 edit plan  
**Status:** COMPLETE — 2026-08-24  
**Nature:** GOVERNANCE / DOCUMENTATION ONLY — no `PRD.md` write in this step  
**Workstream:** GOVERNANCE (taxonomy only; zero admission weight)  
**Lifecycle:** 4-step GOVERNANCE  
**Evidence class:** GOVERNANCE  
**Source-map freeze:** `docs/GOV-PRD-02-SOURCE-MAP.md` (2026-08-24)

Do not edit `PRD.md` in Step 2.  
Do not edit `ARCHITECTURE.md`.  
Do not implement product functionality.  
Do not register the 2-source-lane pilot.  
Do not register PRIVATE-BETA-INVITE-01.

Step 2 observation:

```
branch = main
HEAD   = 61a2f25e858165a3c1bbacea67656852d7899ea6
         register GOV-PRD-02 product reconciliation
git status --short = empty (CLEAN)
```

---

## 1. Purpose

Step 2 resolves all remaining product-definition conflicts identified in the Step 1 source map, inventories PRD.md drift against implemented and approved product truth, and produces an exact bounded Step 3 edit plan.

Step 2 does NOT edit PRD.md.

---

## 2. Evidence / Source Set Reviewed

### 2.1 Authority documents

- `AGENTS.md`
- `CLAUDE.md` (OS rules only)
- `TASKS.md` CURRENT EXECUTION BOARD (above LEGACY / FROZEN)
- `TASKS_BACKLOG_FULL.md` (GOV-PRD-02 body)
- `PRD.md` (subject)
- `ARCHITECTURE.md` (HOW constraint only)
- `docs/GOV-PRD-02-SOURCE-MAP.md` (frozen Step 1 map)

### 2.2 Key evidence sources inspected

- `docs/GOV-ARCH-02-CHECKPOINT.md`
- `docs/GOV-ARCH-02-STAGE-START.md`
- `docs/PRIVATE-BETA-GO-NO-GO-01-DECISION.md`
- `docs/PRIVATE-BETA-E2E-LIVE-11-CHECKPOINT.md`
- `docs/PRIVATE-BETA-BLOCKER-03D-CHECKPOINT.md`
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION-CHECKPOINT.md`
- `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md`
- `docs/AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md`
- `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md`
- `docs/AGENT-PLATFORM-CREATE-01B-CHECKPOINT.md`
- `docs/AGENT-KNOWLEDGE-00-KNOWLEDGE-ARCHITECTURE-PLAN.md`
- `docs/AGENT-COLLAB-00-COLLABORATION-PROTOCOL-PLAN.md`
- `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md`
- `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md`
- `docs/AUTH-APP-01E-CHECKPOINT.md`
- `docs/AUTH-APP-01Z-CHECKPOINT.md`
- `frontend/lib/agent-platform/agent-registry.ts`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`

---

## 3. Resolved F-Items

### F1 — Specialist Agent Display Names

**Resolution:** Canonical user-facing names include the "Agent" suffix per translation files (what users see).

| Registry ID | Canonical User-Facing Name | Translation Key | Current Status | Future Status |
|---|---|---|---|---|
| `builder` | Builder Agent | `agents.builder.name` | CURRENT — active functional agent | — |
| `chief-of-staff` | Chief of Staff Agent | `agents.chiefOfStaff.name` | CURRENT — placeholder only (coming_soon) | APPROVED_FUTURE — functional |
| `product-strategy` | Product Strategy Agent | `agents.productStrategy.name` | CURRENT — placeholder only (coming_soon) | APPROVED_FUTURE — functional |
| `technology-advisor` | Technology Advisor Agent | `agents.technologyAdvisor.name` | CURRENT — placeholder only (coming_soon) | APPROVED_FUTURE — functional |

**Source:** `frontend/messages/en.json` lines 443–462; `frontend/messages/zh-TW.json` same structure; `frontend/lib/agent-platform/agent-registry.ts` nameKey references.

**PRD.md correction needed:** PRD §1 and §I system agent table currently omit "Agent" suffix. Step 3 must add it.

### F2 — "Coming Soon" vs Private-Beta Out-of-Scope

**Resolution:** "Coming soon" is the correct user-facing UI label for placeholder agents. It indicates visible-but-not-functional. The label does NOT promise delivery within the current beta.

- `coming_soon` is a registry status value that results in placeholder display
- Users see these agents in the command-center UI with "coming soon" messaging
- GO-NO-GO classifies them as "OUT OF SCOPE — COMING SOON placeholders only"
- PRD must clarify that "coming soon" agents are approved future direction, not beta deliverables

**Step 3 action:** Keep "coming soon" as the UI label reference. Add explicit statement that coming-soon agents are not functional in the current beta and represent approved future product direction.

### F3 — Legal Advisor

**Resolution:** APPROVED_FUTURE — named as an intended future specialist agent in multiple planning sources.

**Evidence:**
- Platform-00 §3 mentions "Chief of Staff Agent, Legal Advisor (future)" as a knowledge scope consumer
- COLLAB-00 §2.3 lists "Future: Legal Advisor" explicitly
- COLLAB-00 scenario §25 demonstrates Legal Advisor in referral workflows
- COLLAB-00 §30 defers "Whether Legal Advisor becomes the first specialist future agent" to a product decision (Keith)

**Status:** APPROVED_FUTURE. Named in authoritative planning. Not currently in the agent registry. No commitment on timeline. Awaits Keith's product decision on ordering.

**Step 3 action:** ADD as a named approved future specialist agent in the PLANNED section. Do not add to the system agent table or registry.

### F4 — Apple OAuth

**Resolution:** DEFERRED (code exists, not activated) — same status as Google OAuth for the current beta.

**Evidence:**
- AUTH-APP-01E COMPLETE AND LOCKED (2026-05-07): Apple OAuth passport-apple strategy, routes, and account-linking implemented
- Private-beta staging execution 04B env preparation: "Apple OAuth not enabled for initial private beta"
- Private-beta staging setup: Apple variables marked "optional for beta"
- GO-NO-GO 2026-08-23 mentions Google OAuth OUT OF SCOPE but does not separately call out Apple (implicitly same treatment)

| Provider | Code Status | Activation Status | Beta Status |
|---|---|---|---|
| Google OAuth | Implemented (AUTH-APP-01D) | NOT ACTIVATED | OUT OF SCOPE |
| Apple OAuth | Implemented (AUTH-APP-01E) | NOT ACTIVATED | OUT OF SCOPE |

**Step 3 action:** UPDATE §K to list Apple OAuth alongside Google OAuth as deferred/not-activated. Both have code present but are not active.

### F5 — Named Connectors / Integrations

**Resolution:** Named connectors are APPROVED_FUTURE conceptual source types within the knowledge architecture plan. They are NOT committed named product features.

**Evidence:**
- KNOWLEDGE-00 §8 lists as "Future connector": Notion, Slack, Gmail, Google Drive, OneDrive, Calendar/meeting transcripts
- KNOWLEDGE-00 §23.4 explicitly: "All connector implementation is deferred. This plan establishes that connectors are a future source type that the pipeline must be designed to accommodate, not a current implementation target."
- PRD current §8 non-goals: "Broad external integrations" — correct

**Step 3 action:** KEEP current PRD non-goals language. Optionally note in PLANNED section that the knowledge architecture envisions future external connectors (Notion, Slack, Gmail, Google Drive, OneDrive) as planned knowledge source types, without committing to specific named products.

### F6 — Create Agent Product Limitation Depth

**Resolution:** CURRENT capability is strictly profile persistence and display.

| Capability | Status |
|---|---|
| Create agent profile (name, role, description, status) | CURRENT |
| List created agents | CURRENT |
| View agent detail/profile | CURRENT |
| Delete agent | NOT IMPLEMENTED (accepted beta limitation) |
| Execute agent (route to AI runtime) | FUTURE |
| Configure per-agent tools | FUTURE |
| Configure per-agent knowledge scopes | FUTURE |
| Configure per-agent skills | FUTURE |
| Agent collaboration/referral for user-created agents | FUTURE |

**Source:** CREATE-01A/01B checkpoints; GO-NO-GO accepted limitation T7 (no delete endpoint); ARCHITECTURE.md §13.2 (persistence-only).

**Step 3 action:** KEEP current PRD §I language ("persistent profiles only... not yet executable runtime agents"). It is already correct. Optionally tighten to mention no delete endpoint as an accepted beta limitation.

### F7 — Ask / Build Glossary

**Resolution:** Ask and Build ARE canonical current user-facing product concepts visible in the UI.

**Evidence:**
- `frontend/messages/en.json`: `"intentAsk": "Ask"`, `"intentBuild": "Build"`
- Tooltips: "Ask questions without changing files" / "Create or edit workspace files"
- Users explicitly choose between Ask and Build in the chat interface
- Technical mapping: Ask = `executionIntent: 'conversation'`; Build = `executionIntent: 'workspace_mutation'`

**Product-level definitions:**
- **Ask** — A request that generates an AI response without modifying workspace files. Credits consumed when the AI response completes.
- **Build** — A request that generates AI-driven file changes to the workspace. Credits consumed only after changes are successfully applied and confirmed.

**Step 3 action:** ADD Ask and Build to the terminology reference (§11). UPDATE credit model description (§H) to use these terms. Do NOT expose internal `workspace_mutation` or `executionIntent` in PRD.

### F8 — Credit UX Wording

**Resolution:** Replace stale "credit deducted per AI execution" with intent-aware behavior.

**Current product truth (source: 03D + LIVE-11 + ARCHITECTURE.md §11.3):**

| Mode | When credits are consumed |
|---|---|
| Ask | When the AI response completes successfully |
| Build | Only after workspace file changes are successfully applied and confirmed by the user |
| Build — failed/partial apply | No credits consumed (no qualifying confirmation) |
| Build — zero actions (contract failure) | No credits consumed (execution marked failed) |

**Accepted limitation:** If a browser tab closes after full apply but before confirmation reaches the server, no credit is consumed (intentional under-charge — accepted private-beta policy).

**Step 3 action:** UPDATE §H "Current Credit Model" bullet "Credit is deducted per AI execution" → describe the Ask/Build distinction. Keep product-level; do not describe `sourceEventId`, `triggerDeductionForExecution()`, or other API mechanics.

### F9 — Support Expectation

**Resolution:** PRD should state that a defined direct support/feedback channel is an operational requirement before beta invitations are sent, without choosing the channel.

**Evidence:**
- GO-NO-GO §3: SUPPORT_GO_BLOCKING=NO, SUPPORT_INVITE_BLOCKING=YES
- GO-NO-GO §5: "Current support channel: NOT YET DEFINED"
- GO-NO-GO requires "the support channel to be defined before invitation execution"

**Step 3 action:** ADD a bounded statement in the limited-private-beta scope section: "A defined direct support/feedback channel will be established before beta invitations are sent." Do not choose email/Slack/Notion. Do not productize the support mechanism.

### F10 — Brand / Punctuation

**Resolution:** Canonical user-facing naming:

| Name | Form | Usage |
|---|---|---|
| ainow.biz | lowercase domain/platform name | Platform identity, URLs |
| aiSandBox | camelCase | Historical coding product name; Builder Agent's module name |
| Builder Agent | Title case with "Agent" | Primary functional agent |
| Chief of Staff Agent | Title case with "Agent" | Future specialist |
| Product Strategy Agent | Title case with "Agent" | Future specialist |
| Technology Advisor Agent | Title case with "Agent" | Future specialist |
| Create Agent | Verb phrase (imperative) | The feature/action of creating an agent profile |

**Step 3 action:** Ensure PRD uses these canonical forms consistently. Do not mass-rename implementation identifiers.

---

## 4. CURRENT Product Inventory

| # | Capability | User Value | Current Availability | Private-Beta Availability | Source | PRD Current Accuracy |
|---|---|---|---|---|---|---|
| 1 | ainow.biz umbrella platform identity | Single home for AI agent team | YES | YES | PRD; Platform-00; ARCH §13.1 | CORRECT — minor wording could split CURRENT vs FUTURE more clearly |
| 2 | Builder Agent as functional AI coding agent | Build software via natural language | YES | YES | LIVE-11; GO-NO-GO; PRD | CORRECT |
| 3 | Ask/Build execution modes | Ask questions or build workspace changes | YES | YES | 03D; en.json; ARCHITECTURE §11.3 | INCOMPLETE — Ask/Build distinction not in PRD |
| 4 | Builder single-shot execution path | Predictable one-request file-action loop | YES | YES | LIVE-11; GO-NO-GO; ARCH CURRENT | CORRECT |
| 5 | Confirm-build-apply user confirmation | User confirms before Build credits are consumed | YES | YES | 03D-B; 03J; LIVE-11 | MISSING — not described as product WHAT |
| 6 | Durable projects (create, open, persist, import/export) | Work survives sessions | YES | YES | GOV-PRD-01; PRD §3.A | CORRECT |
| 7 | File tree, editor, structured file-action apply | See and modify code | YES | YES | AI-03; LIVE-11; PRD §3.D | CORRECT |
| 8 | Workspace preview | See running app | YES | YES | PREVIEW-STRATEGY-01A; LIVE-11 | CORRECT |
| 9 | Git checkpoints and revert | Recover from changes | YES | YES | 03I; PRD §3.A | CORRECT |
| 10 | Chat / conversation persistence | Resume context across sessions | YES | YES | AI-04; PRD §3.G | CORRECT |
| 11 | Command-center / dashboard shell | Platform home with RPG identity | YES | YES | RPG-03A/03B | CORRECT — already described |
| 12 | Static system-agent registry (Builder + 3 coming-soon) | See the team | YES | YES | PLATFORM-01; agent-registry.ts | CORRECT — display names need update |
| 13 | User-created agent profiles (create/list/view) | Extensible feel | YES | YES | CREATE-01A/01B | CORRECT |
| 14 | Email/password auth + email verification | Sign in | YES | YES | AUTH-APP; GO-NO-GO | CORRECT |
| 15 | Credit ledger + free-plan provisioning + balance display | Governed usage | YES | YES | BILLING-READY; LIVE-11 | CORRECT |
| 16 | Ask credit deduction at completion | Credits for Ask work | YES | YES | 03D; ARCHITECTURE §11.3 | STALE — PRD says "per execution" |
| 17 | Build credit deduction after qualifying apply confirmation | Credits only for landed Build work | YES | YES | 03D; 03J; LIVE-11 | MISSING |
| 18 | Multilingual UX (en / zh-TW / zh-CN) | Local-language experience | YES | YES | I18N family; PRD §3.J | CORRECT |
| 19 | Admin operations (users/sessions/credits) | Operational support | YES | YES | PRD §3.L | CORRECT |
| 20 | Agent Harness (gated; not default) | Advanced multi-turn execution available when enabled | YES (gated) | NO (disabled) | Harness family; GO-NO-GO | CORRECT — already GATED |
| 21 | Platform vs generated-app auth isolation | Generated apps don't inherit platform auth | YES | YES | AUTH-MODULE; ARCHITECTURE | THIN in PRD (acceptable) |

---

## 5. Current Private-Beta Product Scope

**Frozen by:** PRIVATE-BETA-GO-NO-GO-01 DECISION (2026-08-23)

| Property | Value | In PRD? |
|---|---|---|
| Scope | Builder-first | Partially (§9) |
| Initial users | 1–3 trusted users known personally to Keith | NO |
| Authentication | Email/password only | YES |
| Execution | Builder single-shot path | YES |
| Agent Harness | OUT OF SCOPE — disabled | YES (GATED) but not labelled beta-out |
| Multi-agent runtime | OUT OF SCOPE | YES (PLANNED) |
| Non-Builder functional agents | OUT OF SCOPE — placeholders only | YES |
| Google OAuth | OUT OF SCOPE — not activated | YES (Deferred) |
| Apple OAuth | OUT OF SCOPE — not activated | NO |
| Stripe charging | OUT OF SCOPE | YES (PLANNED) |
| Public launch | OUT OF SCOPE | Implied only |
| Broader user rollout | OUT OF SCOPE | NO |
| Invitations | PARKED / UNREGISTERED | NO |
| Support channel | Required before invite; NOT YET DEFINED | NO |
| BUILDER_PRIVATE_BETA_READINESS | GO | NO |
| LIVE_STAGING_VALIDATED | YES | NO |

**Accepted beta limitations:**
- Preview may require manual refresh
- No delete-agent endpoint
- Cross-user isolation not live-tested with simultaneous users
- No production-grade monitoring dashboard as user product
- Best-effort support; no SLA

**Step 3 must ADD:** A dedicated limited-private-beta scope section that separates rollout constraints from the CURRENT capability inventory.

---

## 6. Approved FUTURE Product Inventory

| # | Future Product | Status | Source | In PRD? |
|---|---|---|---|---|
| 1 | Functional Chief of Staff Agent | APPROVED_FUTURE | Platform-00; registry; COLLAB-00 | YES (PLANNED) |
| 2 | Functional Product Strategy Agent | APPROVED_FUTURE | Platform-00; registry; COLLAB-00 | YES (PLANNED) |
| 3 | Functional Technology Advisor Agent | APPROVED_FUTURE | Platform-00; registry; COLLAB-00 | YES (PLANNED) |
| 4 | Legal Advisor Agent | APPROVED_FUTURE | Platform-00; COLLAB-00 | NO |
| 5 | User-created agents as executable runtimes | APPROVED_FUTURE | CREATE-01; Platform-00 | YES (PLANNED) |
| 6 | Per-agent model/tool/skill/knowledge config | APPROVED_FUTURE | Platform-00; CREATE deferrals | YES (PLANNED) |
| 7 | Multi-Builder profiles (model/profile differentiation) | APPROVED_FUTURE | PLATFORM-04 | NO |
| 8 | Multi-Builder shared-project collaboration | APPROVED_FUTURE | PLATFORM-05 | NO |
| 9 | Durable orchestration / coordinator as product-reachable runtime | APPROVED_FUTURE | PLATFORM-07 plan | Implied only |
| 10 | Shared organizational knowledge | APPROVED_FUTURE | KNOWLEDGE-00 | YES (PLANNED) |
| 11 | Specialist / private knowledge | APPROVED_FUTURE | KNOWLEDGE-00 | YES (PLANNED) |
| 12 | Knowledge ingestion / refresh (manual → scheduled connectors) | APPROVED_FUTURE | KNOWLEDGE-00 | YES (PLANNED) |
| 13 | Agent collaboration / referrals | APPROVED_FUTURE | COLLAB-00 | YES (PLANNED) |
| 14 | Work objects (tickets, decisions, drafts, referrals) | APPROVED_FUTURE | COLLAB-00; Platform-00 | YES (PLANNED) |
| 15 | Approval gates / human-owner control | APPROVED_FUTURE | COLLAB-00 | THIN |
| 16 | Loop prevention / referral limits | APPROVED_FUTURE | COLLAB-00; PLATFORM-05/07 | NO |
| 17 | Harness as default Builder experience | APPROVED_FUTURE | HARNESS-V1; ARCHITECTURE | GATED only |
| 18 | Stripe live charging / subscriptions | APPROVED_FUTURE | BILLING-READY; Platform-00 | YES (PLANNED) |
| 19 | Google OAuth activation | APPROVED_FUTURE (deferred) | 04B Outcome B | YES (Deferred) |
| 20 | Apple OAuth activation | APPROVED_FUTURE (deferred) | AUTH-APP-01E; staging docs | NO |
| 21 | Deeper RPG walking-character / town simulation | APPROVED_FUTURE (long-term) | Platform-00; superseded as MVP | YES (non-goal now) |
| 22 | Future integrations (Notion, Slack, Gmail, Drive, OneDrive) | APPROVED_FUTURE (connectors) | KNOWLEDGE-00 §23 | YES (non-goal now) |
| 23 | Public agent ecosystem / marketplace | APPROVED_FUTURE (far) | Platform-00 | YES (non-goal now) |
| 24 | Generated-app auth as product surface | DEFERRED | AUTH-MODULE | THIN |
| 25 | Additional locales beyond en/zh-TW/zh-CN | UNCOMMITTED | PRD non-goal | YES (non-goal) |

---

## 7. Complete Idea / Vision Inventory

See Step 1 source map §8 for the full 40-row inventory. All ideas verified against current PRD and source evidence. No new ideas discovered beyond those cataloged in Step 1. All Step 1 classifications confirmed.

Key changes from Step 1 to Step 2:
- F-items resolved (§3 above)
- Ask/Build confirmed as canonical user-facing concepts
- Apple OAuth confirmed same deferred status as Google
- Legal Advisor confirmed APPROVED_FUTURE
- Named connectors confirmed as future knowledge source types, not committed products

---

## 8. ainow.biz Product Hierarchy

```
ainow.biz
  ├─ Builder Agent / aiSandBox ............ CURRENT (single-shot); Harness GATED; Harness-default FUTURE
  │   ├─ Ask mode ......................... CURRENT
  │   ├─ Build mode ....................... CURRENT
  │   ├─ Projects / workspace ............. CURRENT
  │   ├─ File tree / editor ............... CURRENT
  │   ├─ Preview .......................... CURRENT
  │   ├─ Checkpoints / revert ............. CURRENT
  │   ├─ Chat persistence ................. CURRENT
  │   └─ Confirm-build-apply .............. CURRENT
  ├─ specialist system agents .............. PARTIAL (placeholders visible); executable FUTURE
  │   ├─ Chief of Staff Agent ............. COMING_SOON placeholder; FUTURE functional
  │   ├─ Product Strategy Agent ........... COMING_SOON placeholder; FUTURE functional
  │   ├─ Technology Advisor Agent ......... COMING_SOON placeholder; FUTURE functional
  │   └─ Legal Advisor Agent .............. FUTURE (not in registry)
  ├─ user-created agents ................... PARTIAL (persist/list/view); executable FUTURE
  ├─ shared knowledge ...................... FUTURE
  ├─ specialist knowledge .................. FUTURE
  ├─ collaboration / referrals / work objects FUTURE (in-memory coordinator = HOW precursor only)
  ├─ orchestration / multi-Builder ......... FUTURE (identity plumbing PARTIAL)
  ├─ credits / billing .................... CURRENT (credits-first); Stripe FUTURE
  ├─ auth ................................. CURRENT (email/password); OAuth FUTURE
  ├─ multilingual UX ...................... CURRENT (en, zh-TW, zh-CN)
  └─ platform command-center / dashboard ... CURRENT (shell); deeper RPG FUTURE
```

---

## 9. RPG Product Direction

| Layer | Status | Description |
|---|---|---|
| Command-center dashboard shell | CURRENT | RPG-inspired visual design language, agent cards, status messaging, command-deck layout |
| Walking-town / character simulation | SUPERSEDED as MVP | Originally Platform-00 / UX-IA-00 envisioned this; RPG-MVP-RESET explicitly deferred it |
| Deeper RPG elements (post-beta) | APPROVED_FUTURE (long-term) | Walking character, pixel-art map, game engine dependency — all explicitly deferred to post-beta |

**PRD treatment:** CURRENT = command-center shell with RPG-inspired visual identity. FUTURE = deeper RPG simulation. Do not imply the walking town is promised for any near-term release.

---

## 10. Builder / Harness Positioning

| Aspect | Status | User Experience |
|---|---|---|
| Builder single-shot | CURRENT | User sends Ask or Build; AI responds; file actions applied; done |
| Builder Harness (multi-turn tool loop) | GATED (implemented; not default) | When enabled, Builder can iterate across multiple tool calls |
| Harness as default | APPROVED_FUTURE | Planned to become the standard Builder experience after proven real-provider success |
| Private-beta experience | SINGLE-SHOT ONLY | Harness disabled for initial beta (GO-NO-GO OUT OF SCOPE) |

**PRD treatment:** Describe Builder's current experience as single-shot. Describe Harness as an implemented gated capability available for controlled activation, not as a beta promise. Label Harness-as-default as approved future direction.

---

## 11. Create Agent Positioning

| Capability | Status |
|---|---|
| Create agent profile (name, role, description, status) | CURRENT |
| List / view created agents | CURRENT |
| Delete agent | NOT IMPLEMENTED (accepted limitation) |
| Execute created agent via AI runtime | FUTURE |
| Configure tools / knowledge / skills per agent | FUTURE |
| Route work to/from created agents | FUTURE |

**PRD treatment:** Current = persistent profiles. Future = executable agents. Keep this distinction clear. Do not describe user-created agents as "AI workers" unless explicitly labelled future.

---

## 12. Knowledge Product (from KNOWLEDGE-00)

**Product WHAT only — no ingestion/storage/embedding HOW:**

| Concept | User Value | Status |
|---|---|---|
| Shared/company knowledge | All agents share organizational context | APPROVED_FUTURE |
| Specialist/private knowledge | Domain-specific context (e.g., codebase for Builder) | APPROVED_FUTURE |
| Manual uploads (markdown, PDF, text, HTML) | User provides documents | APPROVED_FUTURE (initial) |
| Monthly/long-range goals as knowledge | Strategic context informs agents | APPROVED_FUTURE |
| Policies as knowledge | Compliance/guidelines inform agents | APPROVED_FUTURE |
| Meeting summaries as knowledge | Daily context | APPROVED_FUTURE |
| Refresh / update behavior | Knowledge stays current | APPROVED_FUTURE |
| External connectors (Notion, Slack, Gmail, Drive, OneDrive) | Pull context from existing tools | APPROVED_FUTURE (far) |
| Source traceability | Know where recommendations came from | APPROVED_FUTURE |
| Privacy / access scoping | Not all agents see all data | APPROVED_FUTURE |

**PRD treatment:** Keep PLANNED language. Expand slightly to describe user value. Do not copy ingestion pipeline, embeddings, or schema details.

---

## 13. Collaboration Product (from COLLAB-00)

**Product WHAT only — no coordinator implementation HOW:**

| Concept | User Value | Status |
|---|---|---|
| Agent referral (one agent hands work to another) | Specialists collaborate without manual dispatch | APPROVED_FUTURE |
| Work handoff with audit trail | Visible chain of who did what | APPROVED_FUTURE |
| Tickets (durable work items) | Work persists beyond a single chat | APPROVED_FUTURE |
| Decisions (multi-agent input → owner approval) | AI team proposes; human decides | APPROVED_FUTURE |
| Comments / agent analysis on work objects | Rich context for decisions | APPROVED_FUTURE |
| Approval gates (human remains final authority) | Safety — user controls outcomes | APPROVED_FUTURE |
| Referral limits / loop prevention | No infinite agent loops | APPROVED_FUTURE |
| User visibility/control over collaboration | Owner sees all agent activity | APPROVED_FUTURE |

**PRD treatment:** Keep PLANNED language. Add approval gates and loop prevention as named future capabilities.

---

## 14. Multi-Builder Product (from PLATFORM-04/05/07)

| Concept | User Value | Status |
|---|---|---|
| Multiple Builder profiles with different models/specialties | Right Builder for each task | APPROVED_FUTURE |
| Task routing between Builders | Automatic task assignment | APPROVED_FUTURE |
| Multi-Builder collaboration on shared project | Several Builders work together | APPROVED_FUTURE |
| Attribution / job visibility | Know which Builder did what | APPROVED_FUTURE |
| Identity plumbing (builderProfileId accepted in API) | Partial technical readiness | PARTIAL (plumbing only; not user-visible) |

**PRD treatment:** ADD as named FUTURE capability. Do not describe partial plumbing as a user feature. Do not claim current multi-Builder experience.

---

## 15. Auth Product

| Provider | Status | PRD Today | Step 3 Action |
|---|---|---|---|
| Email/password | CURRENT | CORRECT | KEEP |
| Email verification | CURRENT | CORRECT | KEEP |
| Google OAuth | DEFERRED (code exists; not activated) | Correctly listed as deferred | KEEP |
| Apple OAuth | DEFERRED (code exists; not activated) | NOT MENTIONED | ADD alongside Google |
| Generated-app auth templates | HOW / tooling (not PRD product) | Thin | DEFER — keep as ARCHITECTURE.md concern |

---

## 16. Billing / Credits Product

| Aspect | Status | PRD Today | Step 3 Action |
|---|---|---|---|
| Free-plan credit allocation on registration | CURRENT | CORRECT | KEEP |
| Credit balance tracking and display | CURRENT | CORRECT | KEEP |
| Ask: credits consumed at AI response completion | CURRENT | STALE ("per execution") | UPDATE |
| Build: credits consumed after qualifying apply confirmation | CURRENT | MISSING | ADD |
| Failed/partial Build: no credit consumed | CURRENT | MISSING | ADD |
| Balance enforcement gates execution | CURRENT | CORRECT | KEEP |
| Usage records per execution | CURRENT | CORRECT | KEEP |
| Admin credit grants | CURRENT | CORRECT | KEEP |
| Stripe / commercial payment | APPROVED_FUTURE (not active) | CORRECT (PLANNED) | KEEP |

---

## 17. Multilingual Product

| Language | Status | PRD Today |
|---|---|---|
| English (en) | CURRENT | CORRECT |
| Traditional Chinese (zh-TW) | CURRENT | CORRECT |
| Simplified Chinese (zh-CN) | CURRENT | CORRECT |
| Additional locales | NOT IN SCOPE | CORRECT (non-goal) |

No change needed. PRD is accurate.

---

## 18. Complete PRD Drift Table

| # | PRD Section / Statement | Current Wording Summary | Problem | Current Product Truth | Approved Future Truth | Source | Step 3 Action | Risk |
|---|---|---|---|---|---|---|---|---|
| 1 | §1 Overview agent names | "Chief of Staff, Product Strategy, and Technology Advisor" | Missing "Agent" suffix | Names include "Agent" suffix per translations | Same | en.json; registry | UPDATE — add "Agent" suffix | LOW |
| 2 | §H "Credit deducted per AI execution" | Single deduction model | STALE — does not reflect Ask/Build distinction | Ask: at completion. Build: after qualifying apply confirmation only | Same + Stripe | 03D; LIVE-11; ARCH §11.3 | UPDATE — rewrite credit deduction bullets | HIGH |
| 3 | §H missing confirm-build-apply | No mention | MISSING — product behavior exists but PRD silent | User confirms Build apply; credits charged only on qualifying confirmation | Same | 03D-B; 03J | ADD — describe confirm-build-apply as product WHAT | HIGH |
| 4 | §C missing Ask/Build modes | "AI execution" described generically | INCOMPLETE — user-facing modes not named | Ask (no file changes) and Build (file changes) are explicit user choices | Same | en.json; 03D | ADD — mention Ask/Build as user-facing modes | MEDIUM |
| 5 | §11 Terminology missing Ask/Build | No entries | INCOMPLETE | Ask and Build are canonical UI terms | Same | en.json | ADD — terminology entries | MEDIUM |
| 6 | §I Agent table missing "Agent" suffix | "Chief of Staff" / "Product Strategy" / "Technology Advisor" | Inconsistent with translations | User sees "Chief of Staff Agent" etc. | Same | en.json | UPDATE — add suffix | LOW |
| 7 | §K missing Apple OAuth | Only Google mentioned | INCOMPLETE | Apple OAuth code exists, deferred like Google | Both may activate post-beta | AUTH-APP-01E; staging docs | ADD — Apple alongside Google | LOW |
| 8 | §4 stale HOW ("PostgreSQL sole... SQLite not used"; mixed-transport essay) | Technical detail in PRD | WRONG for PRD domain — belongs in ARCHITECTURE | Product doesn't need to claim storage engines | Same | GOV-ARCH-02 | REMOVE deep HOW; keep product-level service summary | MEDIUM |
| 9 | No limited-private-beta scope section | Beta mentioned in §9 summary only | INCOMPLETE | GO-NO-GO froze Builder-first 1–3 user scope | Broader rollout later | GO-NO-GO | ADD — dedicated beta scope section | MEDIUM |
| 10 | §8 Non-goals missing explicit beta-out labels | Describes what's not current | CURRENT_BUT_NEEDS_CLARIFICATION | Some items are approved future; some are truly out of scope | Post-beta delivery for most | Source map §7 | UPDATE — clarify which non-goals are approved future vs truly excluded | LOW |
| 11 | §10 PLANNED table missing Multi-Builder | Not mentioned | INCOMPLETE | Identity plumbing partial; runtime FUTURE | Multi-Builder profiles/collab/routing | PLATFORM-04/05 | ADD — Multi-Builder as PLANNED | MEDIUM |
| 12 | §10 PLANNED table missing approval gates | "Runtime approval workflows (non-Builder)" only | INCOMPLETE | COLLAB-00 defines broader approval model | Approval gates + loop prevention | COLLAB-00 | UPDATE — expand | LOW |
| 13 | §10 PLANNED table missing Legal Advisor | Not mentioned | INCOMPLETE | APPROVED_FUTURE per COLLAB-00 / Platform-00 | Named future specialist | COLLAB-00; Platform-00 | ADD | LOW |
| 14 | §12 Document hierarchy names | "TASKS.md, TASKS_BACKLOG_FULL.md, CLAUDE.md" | CURRENT_BUT_NEEDS_CLARIFICATION | Names correct; roles could be clearer | Same | GOV-OS-01 | KEEP — no substantive change needed | LOW |
| 15 | §9 Summary "multi-agent work platform" opening | Implies multi-agent is current | FUTURE_NOT_LABELLED | Currently Builder-first only | Multi-agent post-beta | GO-NO-GO | UPDATE — qualify as vision with Builder current | LOW |
| 16 | §2 Planned goals missing Harness-as-default | Harness mentioned only in §C GATED | INCOMPLETE | Harness gated now; default future | Harness as standard Builder experience | HARNESS-V1 | ADD — as planned goal | LOW |
| 17 | §10 PLANNED missing Apple OAuth | Not listed | INCOMPLETE | Code exists; deferred | Activation post-beta | AUTH-APP-01E | ADD | LOW |
| 18 | Missing support/feedback beta expectation | Not mentioned | INCOMPLETE | GO-NO-GO requires support channel before invite | Defined channel | GO-NO-GO | ADD — in beta scope section | LOW |

---

## 19. Supersession Table

| # | Older Product Statement | Newer Source | Current Truth | Treatment |
|---|---|---|---|---|
| 1 | Walking-character / town simulation is platform identity | RPG-MVP-RESET; RPG-03A/03B | Command-center shell with RPG visual identity | UPDATE_CURRENT — shell is current; sim is FUTURE |
| 2 | Broad multi-agent platform is current | GO-NO-GO 2026-08-23 | Builder-first; others placeholders | UPDATE_CURRENT — qualify multi-agent as vision |
| 3 | Harness is the Builder experience | GO-NO-GO OUT OF SCOPE | Single-shot is beta path; Harness gated | RELABEL_FUTURE — Harness-default is future |
| 4 | Credits charged at AI execution completion | 03D + LIVE-11 | Ask at completion; Build after qualifying apply | UPDATE_CURRENT — new credit model |
| 5 | Stripe/live billing near-term | BILLING-READY deferral; GO-NO-GO | Credits-first; Stripe off | KEEP FUTURE |
| 6 | Google OAuth part of current auth | 04B Outcome B | Email/password only | KEEP (already correct in PRD) |
| 7 | PRD §4 "PostgreSQL sole DB; SQLite not used" as product claim | GOV-ARCH-02 HOW | Product should not claim storage engines | REMOVE HOW from PRD |
| 8 | Coming-soon agents imply beta delivery | GO-NO-GO OUT OF SCOPE | Placeholders only; not functional in beta | UPDATE — add explicit beta-out statement |
| 9 | UX-IA-00 as current product vision | RPG-MVP-RESET | Command-center shell supersedes old IA | RELABEL_HISTORICAL — already superseded |
| 10 | AUTH-APP-01D "Google OAuth delivered" as current login | 04B Outcome B defer | Not activated | KEEP (PRD already says deferred) |

---

## 20. Technical-HOW Deferrals to ARCHITECTURE.md

PRD must NOT include:

- Exact ports (Gateway 4000, AI 4001, container-manager)
- Caddy / PM2 / compose topology
- BullMQ / Redis / SSE internals
- Database schema / table names / `source_event_id` idempotency implementation
- API route internals (`POST /api/ai/execute`, confirm-build-apply path details)
- Git `safe.directory` / container Git internals
- Idle-timeout mechanism implementation (request-driven Map)
- Credit idempotency implementation (`PersistentCreditDeductionGateway`)
- In-memory coordinator module path / no-HTTP precursor details
- Watchdog probe set / PM2 process names
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` as product wording
- `executionIntent` / `workspace_mutation` as user-facing terms
- `triggerDeductionForExecution()` / `triggerBuildApplyDeduction()` function names

PRD MAY state product outcomes:
- Users spend credits when an Ask completes and when a qualifying Build apply is confirmed
- Harness is not the default beta experience
- Preview shows the running workspace
- Checkpoints can revert files
- Ask mode does not change files; Build mode produces file changes

---

## 21. Roadmap vs PRD Boundary

| Content Type | Belongs In |
|---|---|
| Long-term product ideas (knowledge, collab, multi-Builder, specialists, Stripe, Legal Advisor) | PRD as labelled FUTURE / PLANNED |
| "Current Next Task" / one-ACTIVE-task / family order / canary sequence | TASKS.md / TASKS_BACKLOG_FULL.md only |
| GOV-OS-01 → GOV-ARCH-02 → GOV-PRD-02 → pilot → Lane 3 | Governance sequence — NOT PRD |
| Private-beta invite execution task | PARKED — not PRD product |
| Historical completed slice order | Historical — do not copy |
| Milestone completion dates | TASKS evidence — not PRD |

PRD must not become a scheduler or task list.

---

## 22. Exact Step 3 Edit Plan

### Strategy: A — Minimal Patches with One Structural Addition

Prefer minimal in-place patches. Add one new section (§X: Limited Private-Beta Scope). The final PRD will clearly distinguish:

1. Product identity / vision (§1, §2, §9)
2. CURRENT product (§3, §10 CURRENT table, §11)
3. CURRENT limited-private-beta scope (new §X)
4. APPROVED FUTURE product (§2 Planned Goals, §10 PLANNED table)
5. Explicit non-current scope (§8)

### Edit Plan

| # | Section | Current Problem | Replacement Product Truth | Source(s) | Action | State | Risk |
|---|---|---|---|---|---|---|---|
| 1 | §1 para 3 | Agent names without "Agent" suffix | "Chief of Staff Agent, Product Strategy Agent, and Technology Advisor Agent" | en.json | UPDATE | CURRENT | LOW |
| 2 | §1 para 4 | "broader ainow.biz multi-agent..." accurate but could be stronger on FUTURE label | Add "approved" before "planned post-beta direction" | GO-NO-GO | UPDATE | FUTURE | LOW |
| 3 | §2 Planned Goals | Missing Harness-as-default, Multi-Builder, Apple OAuth | Add bullets for Harness-as-default-experience, Multi-Builder profiles/collaboration, Apple OAuth activation | HARNESS-V1; PLATFORM-04/05; AUTH-APP-01E | ADD | FUTURE | LOW |
| 4 | §3.C "Credit and Balance Enforcement" | "Credit is deducted per AI execution" | Rewrite: Ask mode credits consumed on AI response completion; Build mode credits consumed only after qualifying workspace apply confirmation; no charge for failed/partial Build | 03D; LIVE-11; ARCH §11.3 | UPDATE | CURRENT | HIGH |
| 5 | §3.C after "Current Builder Core Loop" | Missing Ask/Build mode description | Add paragraph: Builder offers two execution modes — Ask and Build. Ask generates responses without changing workspace files. Build produces AI-driven file changes applied to the workspace. | en.json; 03D | ADD | CURRENT | MEDIUM |
| 6 | §3.C after file-action | Missing confirm-build-apply | Add: "For Build requests, a user-facing confirmation step verifies that workspace changes were successfully applied before credits are consumed." | 03D-B; 03J; LIVE-11 | ADD | CURRENT | MEDIUM |
| 7 | §3.H "Current Credit Model" bullets | "Credit is deducted per AI execution" | Replace with: "Ask requests: credits consumed when AI response completes" / "Build requests: credits consumed only after workspace changes are successfully applied and confirmed" / "Failed or partial Build: no credits consumed" | 03D; ARCH §11.3 | UPDATE | CURRENT | HIGH |
| 8 | §3.I System Agent table | Names without "Agent" suffix | Add "Agent" suffix to all four entries | en.json | UPDATE | CURRENT | LOW |
| 9 | §3.K Deferred | Only Google OAuth mentioned | Add: "Apple OAuth authentication (configuration present but not activated in current beta)" | AUTH-APP-01E; staging docs | ADD | DEFERRED | LOW |
| 10 | §4 Architecture Summary | Contains "PostgreSQL is the sole authoritative durable database. SQLite is not used." and "mixed transport model" essay | Remove storage-engine claim and transport essay. Keep: "The platform consists of multiple cooperating services... For all technical architecture detail, refer to ARCHITECTURE.md." | GOV-ARCH-02 | UPDATE | CURRENT | MEDIUM |
| 11 | §8 Non-Goals intro | "explicitly out of scope for the initial Builder private beta" | Keep header. Optionally add: "Many of these represent approved future product direction; their exclusion is from the current beta, not from the long-term product vision." | Source map §7 | UPDATE | CURRENT | LOW |
| 12 | §9 Summary para 1 | "ainow.biz is a multi-agent work platform" | "ainow.biz is an AI-agent platform with a vision of multi-agent collaboration. Builder Agent is its first functional agent..." | GO-NO-GO; Platform-00 | UPDATE | CURRENT/FUTURE | LOW |
| 13 | §10 PLANNED table | Missing Multi-Builder, Legal Advisor, Apple OAuth, Harness-as-default, approval gates/loop prevention | Add: "Multi-Builder profiles and collaboration" / "Functional Legal Advisor Agent" / "Apple OAuth activation" / "Agent Harness as default Builder experience" / "Approval gates and referral loop prevention" | PLATFORM-04/05; COLLAB-00; Platform-00; AUTH-APP-01E; HARNESS-V1 | ADD | FUTURE | LOW |
| 14 | §11 Terminology | Missing Ask, Build, confirm-build-apply | Add: Ask = user request that generates AI response without changing files / Build = user request that produces AI-driven file changes / Confirm-build-apply = user confirmation that workspace changes landed successfully; triggers Build credit consumption | en.json; 03D | ADD | CURRENT | LOW |
| 15 | NEW §X (after §9 or as §10 renumbered) | No dedicated beta-scope section | Add "Limited Private-Beta Scope" section: Builder-first; 1–3 trusted users; email/password; single-shot; Harness disabled; no functional specialist agents; no executable user-created agents; no multi-agent runtime; no OAuth; no Stripe; no public launch; invitations parked; support channel required before invitations | GO-NO-GO | ADD | BETA_SCOPE | MEDIUM |
| 16 | NEW §X beta support expectation | Missing | "A defined direct support/feedback channel will be established before beta invitations are sent." | GO-NO-GO | ADD | BETA_SCOPE | LOW |

### Section renumbering

If new §X is inserted, subsequent sections shift. Prefer inserting after §9 Summary (making old §10–§12 become §11–§13). Or insert as new sub-section within §9.

### Edits NOT made

- No total rewrite
- No scheduler language
- No invitation execution steps
- No HOW detail from ARCHITECTURE.md
- No implementation identifiers (executionIntent, workspace_mutation, triggerDeductionForExecution)
- No new product features invented
- No change to ARCHITECTURE.md
- No change to implementation code

---

## 23. Exclusions

The following are explicitly OUT OF SCOPE for GOV-PRD-02:

- Implementation of any product feature
- Editing ARCHITECTURE.md
- Choosing the support channel
- Registering PRIVATE-BETA-INVITE-01
- Registering the 2-source-lane pilot
- Enabling Lane 3
- Inviting users
- Starting runtime / staging / provider
- Mutating credits or gates
- Changing any env/config
- Development OS mutation

---

## 24. Invitation Parked State

```
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED=NO
```

GOV-PRD-02 does not authorize invitations. Fresh Keith invitation authorization remains required after a future registered invite lifecycle.

---

## 25. Successor Sequence

Preserve (do not register beyond this task):

```
GOV-PRD-02
→ first genuine 2-source-lane pilot
→ pilot review
→ explicit future Lane 3 decision
```

---

## 26. Activity Ledger (Step 2)

```
LIVE = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gates = 0
runtime = 0
product implementation = 0
frontend = 0
backend/services = 0
dependencies = 0
PRD.md edits = 0
ARCHITECTURE.md edits = 0
Git mutations = 0
```

Allowed Step 2 writes: `docs/GOV-PRD-02-STAGE-START.md` (this file); `TASKS.md` CURRENT EXECUTION BOARD; `TASKS_BACKLOG_FULL.md` GOV-PRD-02 Step 2 evidence.

---

*Frozen 2026-08-24 — GOV-PRD-02 Step 2 — PRD drift/gap/idea inventory complete — all F-items resolved — CURRENT / LIMITED-BETA / APPROVED-FUTURE product inventoried — bounded Step 3 PRD.md edit plan ready — technical HOW deferred to ARCHITECTURE.md — PRIVATE-BETA-INVITE-01 remains PARKED.*
