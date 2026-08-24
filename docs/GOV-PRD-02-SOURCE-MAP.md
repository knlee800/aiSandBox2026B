# GOV-PRD-02 Step 1 — Authoritative Product / Idea Source Map (FROZEN)

**Task ID:** GOV-PRD-02  
**Title:** Product Reconciliation  
**Step:** 1 — Registration + product/idea source-map freeze  
**Status:** COMPLETE — 2026-08-24  
**Nature:** GOVERNANCE / DOCUMENTATION ONLY — no `PRD.md` write in this step  
**Workstream:** GOVERNANCE (taxonomy only; zero admission weight)  
**Lifecycle:** 4-step GOVERNANCE  
**Evidence class:** GOVERNANCE  
**Source-map freeze date:** 2026-08-24  
**Tree observed at freeze:** branch `main`, HEAD `35b5ff267edf2b0c80120b59f6a0e54b5e9e9f22`, `git status --short` CLEAN before Step 1 writes

This document is the frozen Step 1 source map for GOV-PRD-02.  
It is evidence, not current product authority.  
It does not replace `PRD.md`.  
It does not update `ARCHITECTURE.md`.  
Step 2 must inventory product drift/gaps/ideas against this map. Step 3 may update `PRD.md` plus governance/checkpoint documents only.

Do not treat this file as a scheduler.  
Do not register the first genuine 2-source-lane pilot here.  
Do not register or start PRIVATE-BETA-INVITE-01.  
Do not edit `PRD.md` in Step 1.

---

## 1. Purpose

GOV-PRD-02 exists to reconcile accumulated product decisions and ideas into `PRD.md` after:

- GOV-PRD-01 (2026-08-10) last reconciled current-state WHAT
- GOV-ARCH-02 (2026-08-24) locked TECHNICAL HOW and explicitly deferred product-WHAT drift
- post-GOV-PRD-01 implemented product capability (delayed Build credit, confirm-build-apply, Create Agent persistence/UI, command-center RPG shell, LIVE-11 proven Builder path)
- PRIVATE-BETA-GO-NO-GO-01 GO (2026-08-23) froze limited Builder-first private-beta scope
- later approved plans that remain unimplemented (multi-Builder, knowledge, collaboration, specialist agents, Harness-as-default, Stripe, OAuth)

GOV-PRD-01 corrected stale standalone-sandbox identity. It did **not** absorb later implemented WHAT, and it did not re-classify approved future product that remains unimplemented.

This Step 1 freeze:

1. Confirms GOV-PRD-02 as the already-planned successor identifier
2. Records the authority hierarchy
3. Inventories product/idea sources and classifies them A–F
4. Separates CURRENT product from LIMITED-BETA SCOPE from APPROVED FUTURE product
5. Records supersession and drift without resolving it by editing `PRD.md`
6. Defers detailed TECHNICAL HOW to locked `ARCHITECTURE.md`
7. Freezes Step 2 inventory scope
8. Consolidates the ainow.biz idea/vision inventory so Keith can see what is still intended to be built

---

## 2. Authority hierarchy

Preserve the Development OS authority split. There is no global file-rank.

| Artifact | Domain | Role in GOV-PRD-02 |
|----------|--------|---------------------|
| `PRD.md` | PRODUCT WHAT | Current product authority. Last reconciled 2026-08-10 (GOV-PRD-01). Subject of Step 3 |
| `ARCHITECTURE.md` | TECHNICAL HOW | Locked by GOV-ARCH-02. Constrains current-vs-future technical reality. Do not re-litigate HOW. Do not duplicate deep HOW in PRD |
| `CLAUDE.md` | DEVELOPMENT OS / RULES | Not product WHAT. Do not mutate OS semantics in this lifecycle |
| `TASKS.md` CURRENT EXECUTION BOARD | Only current scheduler | Admits this lifecycle. Stop at LEGACY / FROZEN |
| `TASKS_BACKLOG_FULL.md` | Canonical task registry | GOV-PRD-02 body / AC / history |
| Locked checkpoints / stage-start / plans under `docs/` | Evidence | Named evidence for a specific task. Not automatically current PRD authority |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Historical / strategic reference | Sequencing evidence only. Not scheduler. Not current PRD |
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Historical / strategic vision | Long-term idea source. Not current PRD, architecture, or scheduler |
| This source map | Step 1 freeze evidence | Source classification for Step 2/3. Not WHAT authority |

Conflict-resolution for this lifecycle:

- Planning / master-plan / checkpoint documents are source evidence.
- Implemented locked product checkpoints outweigh older plans when describing CURRENT product.
- Approved plans that were never implemented remain FUTURE, even if locked.
- Speculative ideas must not be promoted into CURRENT product claims.
- GOV-PRD-02 must not turn `PRD.md` into a scheduler or a HOW document.
- GOV-PRD-02 must not erase useful long-term ideas merely because they are unimplemented. CURRENT vs FUTURE must be labelled.

Identifier confirmation:

- GOV-OS-01 Planned Successor Sequence and `docs/GOV-OS-01-STAGE-START.md` §26 record: GOV-OS-01 → fresh post-03J E2E (completed by LIVE-11 PASS) → GOV-ARCH-02 (COMPLETE AND LOCKED) → **GOV-PRD-02** → first genuine 2-source-lane pilot → pilot review → explicit Lane 3 decision.
- `docs/GOV-OS-01-CHECKPOINT.md`: `PRD.md` was not modified; GOV-PRD-02 remained unregistered.
- `docs/GOV-ARCH-02-CHECKPOINT.md` / source map / stage-start: product-WHAT explicitly deferred to unregistered GOV-PRD-02.
- PRIVATE-BETA-GO-NO-GO-01 lock preserved that sequence and did not register this task.
- Repo-wide search found **no** prior GOV-PRD-02 registration/admission. Identifier confirmed. No invented ID.

---

## 3. Exact source inventory

Paths are relative to repository root `C:\Users\knlee\aiSandBox2026B` unless noted.

### 3.1 Authority documents

| Path | Date / status | Product area |
|------|---------------|--------------|
| `PRD.md` | Last reconciled 2026-08-10 — GOV-PRD-01 COMPLETE AND LOCKED | Entire WHAT (subject) |
| `ARCHITECTURE.md` | Last reconciled 2026-08-24 — GOV-ARCH-02 COMPLETE AND LOCKED | HOW constraint only |
| `CLAUDE.md` | OS v1 standing — GOV-OS-01 COMPLETE AND LOCKED 2026-08-18 | Development OS |
| `AGENTS.md` | Thin bootstrap | Boot only |
| `TASKS.md` CURRENT EXECUTION BOARD | Current scheduler — stop at LEGACY / FROZEN | Admission |
| `TASKS_BACKLOG_FULL.md` | Canonical registry | Task bodies |

### 3.2 Prior product-reconciliation evidence

| Path | Date / status | Product area |
|------|---------------|--------------|
| `docs/GOV-PRD-01-STAGE-START.md` | 2026-08-10 COMPLETE | Prior WHAT audit |
| `docs/GOV-PRD-01-CHECKPOINT.md` | 2026-08-10 COMPLETE AND LOCKED | Prior WHAT freeze |
| `docs/GOV-ARCH-01-CHECKPOINT.md` | 2026-08-10 COMPLETE AND LOCKED | Prior HOW freeze (boundary) |
| `docs/GOV-ARCH-02-SOURCE-MAP.md` | 2026-08-23 FROZEN | Product-WHAT deferrals |
| `docs/GOV-ARCH-02-STAGE-START.md` | 2026-08-23 COMPLETE | §14 product-WHAT deferrals |
| `docs/GOV-ARCH-02-CHECKPOINT.md` | 2026-08-24 COMPLETE AND LOCKED | Hands WHAT to this task |
| `docs/GOV-OS-01-STAGE-START.md` | 2026-08-18 COMPLETE | Successor sequence |
| `docs/GOV-OS-01-CHECKPOINT.md` | 2026-08-18 COMPLETE AND LOCKED | Explicitly pending GOV-PRD-02 |

### 3.3 Current post-GO product-scope evidence

| Path | Date / status | Product area |
|------|---------------|--------------|
| `docs/PRIVATE-BETA-GO-NO-GO-01-CHECKPOINT.md` | 2026-08-23 COMPLETE AND LOCKED — GO | Beta scope / next sequence |
| `docs/PRIVATE-BETA-GO-NO-GO-01-DECISION.md` | 2026-08-23 GO | Bounded Builder-first beta |
| `docs/PRIVATE-BETA-GO-NO-GO-01-STAGE-START.md` | 2026-08-23 COMPLETE | Decision inventory |
| `docs/PRIVATE-BETA-GO-NO-GO-01-DECISION-CONTRACT.md` | 2026-08-23 | Decision criteria |
| `docs/PRIVATE-BETA-E2E-LIVE-11-CHECKPOINT.md` | 2026-08-23 COMPLETE AND LOCKED — PASS | Staging-proven Builder path |

### 3.4 Platform / multi-agent / RPG / Create Agent family

| Path | Date / status | Product area |
|------|---------------|--------------|
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | COMPLETE AND LOCKED — HISTORICAL / STRATEGIC VISION | Umbrella vision |
| `docs/AGENT-PLATFORM-00-CHECKPOINT.md` | 2026-07-04 COMPLETE AND LOCKED | Planning lock |
| `docs/AINOW-EXECUTION-ROADMAP.md` | HISTORICAL / STRATEGIC REFERENCE — NOT current scheduler | Historical sequencing |
| `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | 2026-07-04 COMPLETE AND LOCKED | Static agent registry |
| `docs/AGENT-PLATFORM-02A-CHECKPOINT.md` | 2026-07-06 COMPLETE | Platform dashboard shell |
| `docs/AGENT-PLATFORM-02B-CHECKPOINT.md` | 2026-07-06 COMPLETE | Dashboard navigation |
| `docs/AGENT-PLATFORM-03-CHECKPOINT.md` | 2026-07-06 COMPLETE AND LOCKED | Builder route integration |
| `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` | 2026-07-07 plan COMPLETE | Multi-Builder topology |
| `docs/AGENT-PLATFORM-04-CHECKPOINT.md` | 2026-07-07 COMPLETE AND LOCKED | Topology lock |
| `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` | 2026-07-09 plan COMPLETE | Multi-Builder orchestration |
| `docs/AGENT-PLATFORM-05-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | Orchestration plan lock |
| `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md` | 2026-07-09 plan COMPLETE | Coordinator plan |
| `docs/AGENT-PLATFORM-07-CHECKPOINT.md` through `docs/AGENT-PLATFORM-07F3-CHECKPOINT.md` | 2026-07-09..12 COMPLETE AND LOCKED | In-memory coordinator precursor |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` | 2026-07-20 COMPLETE (planning) | RPG MVP reset |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-DISCOVERY.md` | 2026-07-20 COMPLETE | RPG discovery |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | RPG reset lock |
| `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | Command-center UI |
| `docs/AGENT-PLATFORM-RPG-03B-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | Workspace↔platform link |
| `docs/AGENT-PLATFORM-CREATE-01A-STAGE-START.md` | 2026-07-20 COMPLETE | Create Agent persistence design |
| `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | User-agent persistence |
| `docs/AGENT-PLATFORM-CREATE-01B-STAGE-START.md` | 2026-07-20 COMPLETE | Create Agent UI design |
| `docs/AGENT-PLATFORM-CREATE-01B-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | Create Agent MVP UI |
| `frontend/lib/agent-platform/agent-registry.ts` | CURRENT implemented registry | Agent names/status |
| `frontend/messages/en.json` (`agents.*` / `platform.*`) | CURRENT UI copy | Visible product names |

### 3.5 Knowledge / collaboration / harness

| Path | Date / status | Product area |
|------|---------------|--------------|
| `docs/AGENT-KNOWLEDGE-00-KNOWLEDGE-ARCHITECTURE-PLAN.md` | 2026-07-06 plan; header still says ACTIVE; checkpoint LOCKED | Shared vs specialist knowledge |
| `docs/AGENT-KNOWLEDGE-00-CHECKPOINT.md` | 2026-07-06 COMPLETE AND LOCKED | Knowledge plan lock |
| `docs/AGENT-COLLAB-00-COLLABORATION-PROTOCOL-PLAN.md` | 2026-07-06 plan; header still says ACTIVE; checkpoint LOCKED | Referrals / work objects / gates |
| `docs/AGENT-COLLAB-00-CHECKPOINT.md` | 2026-07-06 COMPLETE AND LOCKED | Collaboration plan lock |
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` | 2026-06 planning; header still says ACTIVE | Harness v1 target product |
| `docs/AGENT-HARNESS-00-CHECKPOINT.md` | 2026-06-19 COMPLETE AND LOCKED | Harness plan lock |
| Later AGENT-HARNESS-0x checkpoints | COMPLETE AND LOCKED | Gated implementation evidence |

### 3.6 Auth / billing / credit-policy / i18n

| Path | Date / status | Product area |
|------|---------------|--------------|
| `docs/AUTH-APP-01-CHECKPOINT.md` and AUTH-APP family | COMPLETE (family) | Platform email/password + OAuth code |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION-CHECKPOINT.md` | 2026-07-26 COMPLETE AND LOCKED — Outcome B defer | Google OAuth out of beta |
| `docs/BILLING-READY-00-CHECKPOINT.md` through later BILLING-READY-08 family | COMPLETE AND LOCKED | Credits-first / Stripe deferred |
| `docs/PRIVATE-BETA-BLOCKER-03D-CHECKPOINT.md` | 2026-08-14 COMPLETE AND LOCKED | Delayed Build credit policy |
| `docs/I18N-SHELL-01-CHECKPOINT.md` through `docs/I18N-SHELL-05-CHECKPOINT.md` / `docs/I18N-PAGE-01-CHECKPOINT.md` | COMPLETE AND LOCKED | Multilingual product |
| `docs/UX-IA-00-MASTER-PLAN.md` | 2026-05-05 — stale UX/product plan | Superseded UX vision |
| AUTH-MODULE family | COMPLETE AND LOCKED | Generated-app auth isolation (HOW + generated-app product boundary) |

### 3.7 Sources inspected and not treated as current product authority

Not inventoried as current WHAT: E2E runner/automation adapter checkpoints (AUTO-01 family), LIVE FAIL/BLOCKED historical records except where they prove a product fact (Builder golden path, delayed deduction, Preview `index.html`), staging Caddy/PM2 runbooks, ops watchdog HOW.

---

## 4. Source classifications

Classification legend (product WHAT, not architecture HOW):

- **A** CURRENT PRODUCT AUTHORITY
- **B** IMPLEMENTED PRODUCT CAPABILITY NOT YET FULLY REFLECTED IN `PRD.md`
- **C** APPROVED FUTURE PRODUCT DIRECTION
- **D** TECHNICAL-HOW ONLY — belongs in `ARCHITECTURE.md`; do not duplicate deeply in PRD
- **E** SUPERSEDED / HISTORICAL PRODUCT DIRECTION
- **F** CONFLICTING / UNKNOWN — requires Step 2 resolution

| Source | Date/status | Product area | Class | Implemented? | In PRD.md? | Step 2 must reconcile? | Superseded by |
|--------|-------------|--------------|-------|--------------|------------|------------------------|---------------|
| `PRD.md` | 2026-08-10 | WHAT authority | **A** (subject) | N/A (document) | Self | Yes — subject | — |
| `ARCHITECTURE.md` | 2026-08-24 | HOW constraint | **D** | N/A | Boundary only | No as HOW; yes if PRD still copies stale HOW | GOV-ARCH-02 lock |
| `docs/GOV-PRD-01-CHECKPOINT.md` | 2026-08-10 LOCKED | Prior WHAT freeze | **A** (baseline) + residual gaps | Yes as of 2026-08-10 | Yes as of 2026-08-10 | Yes — baseline vs later B | This task |
| `docs/GOV-ARCH-02-*` | 2026-08-24 LOCKED | WHAT deferrals | **A** (mandate) + **D** | N/A | Explicitly not updated | Yes — defines pending WHAT | — |
| `docs/PRIVATE-BETA-GO-NO-GO-01-*` | 2026-08-23 GO | Beta scope | **A** (beta constraint) | N/A | Partial (Builder-first; missing 1–3 users / invite parked / support) | Yes | — |
| LIVE-11 PASS | 2026-08-23 LOCKED | Proven Builder loop | **B** | Yes | Partial (single-shot yes; delayed credit / confirm-apply missing) | Yes | — |
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Historical vision | Umbrella / multi-agent | **E** + **C** | Partial via later slices | Partial (umbrella + placeholders; missing later concrete plans) | Yes — prevent promoting unimplemented vision as CURRENT | RPG reset + GO-NO-GO Builder-first staging |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Historical sequencing | Roadmap | **E** (scheduler) / limited **C** | N/A | Must not copy sequencing | Yes — keep product ideas, drop scheduler claims | GOV-OS-01 board |
| `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | 2026-07-04 LOCKED | Agent registry | **B** | Yes — static TS registry | Partial (static registry yes; names drift) | Yes — canonical agent names | — |
| `docs/AGENT-PLATFORM-02A/02B/03` | 2026-07-06 LOCKED | Dashboard / Builder route | **B** | Yes | Partial (command-center shell) | Limited | RPG-03A/03B visual identity |
| `docs/AGENT-PLATFORM-04-*` | 2026-07-07 LOCKED plan | Multi-Builder | **C** | Partial identity plumbing only | No as CURRENT; missing as labelled FUTURE | Yes | — |
| `docs/AGENT-PLATFORM-05-*` | 2026-07-09 LOCKED plan | Multi-Builder collab | **C** | No operational runtime | No | Yes as FUTURE | — |
| `docs/AGENT-PLATFORM-07-*` | 2026-07-09..12 | Coordinator | **D** (precursor HOW) + **C** (durable runtime) | In-memory, not product-reachable | PRD must not claim live orchestration | Yes — CURRENT precursor vs FUTURE product | — |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-*` + RPG-03A/03B | 2026-07-20 LOCKED | RPG identity | **B** + **C** | Command-center shell yes; walking sim no | Partial (“RPG-inspired command-center”; walking as post-beta) | Yes — freeze CURRENT shell vs FUTURE sim | Original Platform-00 / UX-IA-00 walking town |
| `docs/AGENT-PLATFORM-CREATE-01A/01B` | 2026-07-20 LOCKED | Create Agent | **B** | Persistence + MVP UI; not executable | Partial (profiles CURRENT; executable FUTURE) | Yes — APIs/UI vs non-execution | — |
| `docs/AGENT-KNOWLEDGE-00-*` | 2026-07-06 LOCKED plan | Knowledge | **C** | No runtime | Listed PLANNED | Confirm still FUTURE | — |
| `docs/AGENT-COLLAB-00-*` | 2026-07-06 LOCKED plan | Collaboration | **C** | No work-object runtime | Listed PLANNED | Confirm still FUTURE | — |
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` | 2026-06 plan | Harness | **C** + **E** (stale “current baseline”) | Gated implementation exists | GATED yes; not beta promise | Yes — do not treat master plan as current product | GO-NO-GO Harness OUT OF SCOPE |
| AUTH-APP family | 2026-05+ | Platform auth | **B** | Email/password CURRENT; OAuth code exists | Email/password CURRENT; OAuth deferred | Limited | 04B Outcome B defer |
| Google OAuth 04B decision | 2026-07-26 LOCKED | Auth | **C** (deferred) | Not activated | Deferred — keep | Confirm still deferred | AUTH-APP-01D “Google OAuth delivered” as activation claim |
| BILLING-READY family | LOCKED | Credits | **B** | Ledger CURRENT; Stripe not charging | Partial (credits CURRENT; Stripe planned; **when** credits spend is stale) | **Yes — major gap** | Immediate-at-completion claim |
| `docs/PRIVATE-BETA-BLOCKER-03D-CHECKPOINT.md` | 2026-08-14 LOCKED | Credit WHEN | **B** | Yes — delayed Build deduction | **No** (PRD still “per execution”) | **Yes — major gap** | GOV-PRD-01 “deduction per execution” |
| `docs/UX-IA-00-MASTER-PLAN.md` | 2026-05-05 | UX vision | **E** + limited **C** | Superseded by later UX/RPG | No | No — do not revive as CURRENT | RPG-MVP-RESET |
| AUTH-MODULE family | LOCKED | Generated-app auth | **D** + limited **C** | Isolation CURRENT as HOW | Thin / missing as generated-app product | Limited — keep platform vs generated-app split | — |
| I18N family | LOCKED | Multilingual | **A** / **B** | en / zh-TW / zh-CN CURRENT | CURRENT — keep | Confirm no extra locales claimed | — |

---

## 5. CURRENT product inventory

CURRENT = source-supported capability that a user can actually use, or a visible non-executable product surface that is explicitly not a functional agent.

Do not mix LIMITED-BETA constraints into this list.

| # | Capability | Evidence | PRD.md today |
|---|------------|----------|--------------|
| 1 | ainow.biz umbrella platform identity | PRD; ARCHITECTURE §13.1; Platform-00 (vision) | Present as umbrella |
| 2 | Builder Agent as first functional AI coding agent | LIVE-11 PASS; GO-NO-GO; PRD | Present |
| 3 | Builder single-shot Ask/Build loop in isolated container workspace | LIVE-11; ARCHITECTURE CURRENT | Present as single-shot |
| 4 | Durable projects (create, open, persist, import/export) | GOV-PRD-01; PR-0x family | Present |
| 5 | File tree, editor, structured file-action apply, preview | AI-03 family; PREVIEW-STRATEGY-01A; LIVE-11 | Present |
| 6 | Git checkpoints and revert | 03I; PRD | Present |
| 7 | Chat / conversation persistence | AI-04; PRD | Present |
| 8 | Command-center / dashboard shell at `/[locale]/platform` | RPG-03A/03B; PLATFORM-02 | Present as RPG-inspired command-center |
| 9 | Static system-agent registry: Builder active; three coming-soon placeholders | `agent-registry.ts`; PLATFORM-01 | Present; **names drift** |
| 10 | User-created agent profiles (create / list / detail); not executable | CREATE-01A/01B; ARCHITECTURE §13.2 | Present as profiles-only |
| 11 | Email/password registration, verification, session cookies, CSRF | AUTH-APP; GO-NO-GO | Present |
| 12 | Internal credit ledger, free-plan provisioning, balance display, admin grants | BILLING-READY; LIVE-11 | Present |
| 13 | Ask credit deduction at Ask completion; Build credit deduction only after qualifying apply confirmation | 03D; LIVE-11; ARCHITECTURE | **Missing / stale** — PRD still “per execution” |
| 14 | Public confirm-build-apply as the user-facing Build-apply confirmation | 03J; LIVE-11 | **Missing as product WHAT** |
| 15 | Multilingual UX en / zh-TW / zh-CN | I18N family; PRD | Present |
| 16 | Admin operations (users / sessions / credits) — operational, not public product | PRD | Present |
| 17 | Agent Harness exists as implemented gated capability, not default | Harness family; ARCHITECTURE; GO-NO-GO | Present as GATED |
| 18 | Platform vs generated-app auth isolation | AUTH-MODULE / AUTH-APP; ARCHITECTURE | Thin |

Hard CURRENT constraints (must survive Step 3):

- Builder-first private beta is governance-ready (GO)
- Current execution is Builder single-shot
- Harness exists technically but is not private-beta default
- Non-Builder system agents are not executable
- User-created agents persist but are not executable
- Multi-agent product runtime is not operational
- Knowledge / collaboration product runtimes are not operational
- Stripe charging is not active
- Google OAuth is not active
- Platform RPG experience is a command-center/dashboard shell, not a walking-character simulation

---

## 6. Current limited private-beta scope

This is a **rollout constraint**, not a capability inventory.

Source: `docs/PRIVATE-BETA-GO-NO-GO-01-DECISION.md` frozen 2026-08-23.

| Property | Frozen value | In PRD.md? | Step 2 treatment |
|----------|--------------|------------|------------------|
| Scope | Builder-first | Partial | ADD / UPDATE as CURRENT LIMITED-BETA |
| Initial users | 1–3 trusted users known personally to Keith | No | ADD as beta-scope, not as long-term product |
| Authentication | Email/password within existing approved beta | Yes | KEEP |
| Execution | Existing approved Builder single-shot | Yes | KEEP |
| Harness | OUT OF SCOPE — disabled | GATED in PRD; not labelled beta-out | RELABEL_FUTURE / beta-out |
| Multi-agent | OUT OF SCOPE — not implemented | PLANNED | KEEP FUTURE; label beta-out |
| Non-Builder functional agents | OUT OF SCOPE — COMING SOON placeholders only | COMING SOON | KEEP placeholders; do not imply beta delivery |
| Google OAuth | OUT OF SCOPE — not activated | Deferred | KEEP deferred |
| Stripe charging | OUT OF SCOPE — `BILLING_CHARGES_ENABLED=false` | Planned / not active | KEEP deferred |
| Public launch | OUT OF SCOPE | Implied | ADD explicit non-goal for this beta |
| Broader user rollout | OUT OF SCOPE | Missing | ADD |
| Invitations | PARKED / UNREGISTERED / UNAUTHORIZED | Missing | KEEP parked; do not productize invite execution |
| Support channel | NOT YET DEFINED; GO-blocking NO; INVITE-blocking YES | Missing | ADD as beta operational expectation, not as CURRENT product feature |
| LIVE_STAGING_VALIDATED | YES | N/A (ops) | Do not copy into PRD as a user promise |
| BUILDER_PRIVATE_BETA_READINESS | GO | Missing as explicit beta-ready statement | ADD bounded “governance-ready Builder private beta” without claiming public launch |

Accepted beta limitations that are product-visible (from GO-NO-GO, not defects to “fix” in PRD as CURRENT bugs unless Step 2 decides otherwise):

- Preview may require manual refresh
- Login visual polish is not a modern redesign promise
- No delete-agent endpoint
- Cross-user isolation not live-tested with simultaneous users
- No production-grade monitoring dashboard as a user product
- Best-effort support only; no SLA

---

## 7. Approved / planned FUTURE product inventory

FUTURE = source-supported intended product, not CURRENT.

| # | Future product | Source | Dependencies if source-defined | In PRD.md? | Step 2 treatment |
|---|----------------|--------|--------------------------------|------------|------------------|
| 1 | Functional Chief of Staff / specialist operations agent | Platform-00; registry placeholder; PRD Planned | Knowledge + collab recommended | Yes as PLANNED | KEEP FUTURE |
| 2 | Functional Product Strategy agent | Platform-00; registry; PRD | Knowledge + collab | Yes as PLANNED | KEEP FUTURE |
| 3 | Functional Technology Advisor agent | Platform-00; registry; PRD | Knowledge + collab | Yes as PLANNED | KEEP FUTURE |
| 4 | User-created agents as executable runtimes | CREATE-01; Platform-00; PRD | Execution routing, tools, knowledge, skills | Yes as PLANNED | KEEP FUTURE |
| 5 | Per-agent model / tool / skill / knowledge configuration | Platform-00; CREATE deferrals | Agent runtime | Yes as PLANNED | KEEP FUTURE |
| 6 | Multi-Builder profiles (model/profile differentiation) | PLATFORM-04 | Identity model; harness adapter | **No as labelled FUTURE** | ADD FUTURE |
| 7 | Multi-Builder shared-project collaboration | PLATFORM-05 | Write-safety; conflict model | **No** | ADD FUTURE |
| 8 | Durable orchestration / coordinator as product-reachable runtime | PLATFORM-07 plan | Persistence; HTTP/product surface | PRD “multi-agent runtime” only | UPDATE FUTURE — distinguish precursor vs product |
| 9 | Shared organizational knowledge | KNOWLEDGE-00 | Ingestion; scopes; privacy | Yes as PLANNED | KEEP FUTURE |
| 10 | Specialist / private knowledge | KNOWLEDGE-00 | Shared layer first | Yes as PLANNED | KEEP FUTURE |
| 11 | Knowledge ingestion / refresh (manual → scheduled connectors) | KNOWLEDGE-00 | Storage; embeddings later | Yes as PLANNED | KEEP / UPDATE FUTURE |
| 12 | Agent collaboration / referrals | COLLAB-00 | Knowledge recommended | Yes as PLANNED | KEEP FUTURE |
| 13 | Work objects (tickets, decisions, drafts, referrals) | COLLAB-00; Platform-00 | Collab protocol | Yes as PLANNED | KEEP FUTURE |
| 14 | Approval gates / human-owner control | COLLAB-00 | Work objects | Thin | ADD / UPDATE FUTURE |
| 15 | Loop prevention / referral limits | COLLAB-00; PLATFORM-05/07 | Coordinator | Missing as product WHAT | ADD FUTURE |
| 16 | Harness as default Builder experience | HARNESS-V1; ARCHITECTURE FUTURE | Proven real-provider loop | GATED, not default-future labelled clearly | RELABEL_FUTURE |
| 17 | Stripe live charging / subscriptions | BILLING-READY; Platform-00 §15.4; GO-NO-GO | Credits model first | Yes as PLANNED | KEEP FUTURE |
| 18 | Google OAuth activation | 04B Outcome B; GO-NO-GO | Credentials / product decision | Deferred | KEEP FUTURE / deferred |
| 19 | Deeper RPG walking-character / town simulation | Platform-00; UX-IA-00; superseded as MVP | Game engine — explicitly not beta | PRD post-beta non-goal | KEEP FUTURE; do not restore as CURRENT |
| 20 | Future specialist: Legal Advisor | Platform-00; COLLAB-00 | Collab + knowledge | **No** | ADD FUTURE or DEFER — Step 2 must not invent; source exists |
| 21 | Future integrations (Notion, Slack, Gmail, Drive, etc.) | KNOWLEDGE-00 non-goals-now / later connectors | Knowledge runtime | PRD “broad external integrations” non-goal now | KEEP FUTURE labelled |
| 22 | Public agent ecosystem / marketplace | Platform-00 deferred; PRD non-goal | Multi-agent runtime | Yes as non-goal now | KEEP FUTURE / non-current |
| 23 | Generated-app auth as user-facing generated-app product | AUTH-MODULE | Isolation already HOW | Thin | Limited ADD FUTURE if Step 2 finds product promise |
| 24 | Additional locales beyond en / zh-TW / zh-CN | PRD explicit non-current | I18N | PRD says additional locales out of scope | KEEP out of current; do not add unless later source |

---

## 8. Complete idea / vision inventory

For every significant idea still visible in the source set.

Legend for GOV-PRD-02 action: ADD / UPDATE / RELABEL_FUTURE / REMOVE / DEFER / KEEP.

| IDEA | SOURCE | CURRENT STATUS | TARGET USER VALUE | DEPENDENCIES | In PRD.md? | GOV-PRD-02 SHOULD |
|------|--------|----------------|-------------------|--------------|------------|-------------------|
| ainow.biz umbrella multi-agent work platform | Platform-00; PRD | PARTIAL | One place for AI specialist team | Builder first | YES | UPDATE — CURRENT shell + FUTURE agents |
| Builder Agent / aiSandBox coding module | Platform-00; PRD; LIVE-11 | IMPLEMENTED | Build software by chatting in isolated workspace | — | YES | KEEP |
| Builder single-shot current experience | PRD; GO-NO-GO; ARCHITECTURE | IMPLEMENTED | Predictable one-request file-action loop | — | YES | KEEP |
| Builder Harness multi-turn tool loop | HARNESS-V1; PRD GATED | PARTIAL (gated, not default) | Understand → plan → edit → test → fix | Flag off for beta | YES as GATED | RELABEL_FUTURE default; KEEP gated CURRENT |
| Command-center / RPG-identified dashboard | RPG-MVP-RESET; RPG-03A/03B | IMPLEMENTED (shell only) | Distinct platform home, not a generic card grid | — | YES partial | UPDATE — CURRENT shell vs FUTURE sim |
| Original walking-character / town simulation | Platform-00; UX-IA-00 | SUPERSEDED as MVP; long-term idea remains | Immersive office/town | Game engine | YES as post-beta non-goal | RELABEL_FUTURE; do not REMOVE |
| Static agent registry | PLATFORM-01 | IMPLEMENTED | See the team and who is active | — | YES | UPDATE names |
| Chief of Staff / operations specialist | Platform-00; registry `chief-of-staff` | APPROVED_FUTURE (placeholder UI) | Daily ops, triage, coordination | Knowledge + collab | YES as PLANNED | KEEP FUTURE; resolve display name |
| Product Strategy specialist | Platform-00; registry `product-strategy` | APPROVED_FUTURE | Roadmaps, market, strategy | Knowledge + collab | YES as PLANNED | KEEP FUTURE; resolve display name |
| Technology Advisor specialist | Platform-00; registry `technology-advisor` | APPROVED_FUTURE | Architecture / stack advice | Knowledge + collab | YES as PLANNED | KEEP FUTURE; resolve display name |
| Legal Advisor (future specialist) | Platform-00; COLLAB-00 | APPROVED_FUTURE / later | Contract review | Collab + knowledge | NO | ADD FUTURE or DEFER explicitly |
| Create Agent persistence + MVP UI | CREATE-01A/01B | IMPLEMENTED (non-executable) | Platform feels extensible | — | YES | UPDATE — persistence CURRENT; execution FUTURE |
| Executable user-created agents | CREATE + Platform-00 | APPROVED_FUTURE | User’s own agents do work | Runtime routing | YES as PLANNED | KEEP FUTURE |
| Multi-Builder topology / multiple Builder profiles | PLATFORM-04 | APPROVED_FUTURE (identity plumbing PARTIAL) | Different Builder specializations | 04 identity; harness profiles | NO as FUTURE | ADD FUTURE |
| Model/profile differentiation between Builders | PLATFORM-04 | APPROVED_FUTURE | Different models/tools per Builder | Topology | NO | ADD FUTURE |
| Multi-Builder orchestration on shared project | PLATFORM-05 | APPROVED_FUTURE | Several Builders collaborate safely | Write deferral; conflict model | NO | ADD FUTURE |
| Product-reachable orchestration/coordinator | PLATFORM-07 | PARTIAL precursor (in-memory, not product-reachable) | Routed referrals without Keith dispatching every hop | Durable runtime | Implied only | UPDATE — precursor ≠ product |
| Shared knowledge | KNOWLEDGE-00 | APPROVED_FUTURE | Agents share company context | Ingestion | YES as PLANNED | KEEP FUTURE |
| Specialist/private knowledge | KNOWLEDGE-00 | APPROVED_FUTURE | Domain-private context | Shared layer | YES as PLANNED | KEEP FUTURE |
| Knowledge ingestion / refresh | KNOWLEDGE-00 | APPROVED_FUTURE | Keep context current | Connectors later | YES as PLANNED | KEEP / UPDATE FUTURE |
| Agent collaboration | COLLAB-00 | APPROVED_FUTURE | Agents refer work | Knowledge recommended | YES as PLANNED | KEEP FUTURE |
| Referrals | COLLAB-00; PLATFORM-05/07 | APPROVED_FUTURE | Handoffs with audit | Coordinator | YES as PLANNED | KEEP / UPDATE FUTURE |
| Work objects / tickets / decisions | COLLAB-00; Platform-00 | APPROVED_FUTURE | Durable work, not chat-only | Collab protocol | YES as PLANNED | KEEP FUTURE |
| Approval gates | COLLAB-00 | APPROVED_FUTURE | Human remains final authority | Work objects | Thin | ADD / UPDATE FUTURE |
| Loop prevention / referral limits | COLLAB-00; 05/07 | APPROVED_FUTURE | No infinite agent loops | Coordinator | NO | ADD FUTURE |
| Credits-first usage | BILLING-READY; PRD | IMPLEMENTED | Governed usage without charging money yet | — | YES | KEEP; UPDATE when credits spend |
| Delayed Build credit until qualifying apply | 03D; LIVE-11 | IMPLEMENTED | Don’t charge Build that didn’t land | Confirm-apply | NO | ADD / UPDATE CURRENT |
| Ask vs Build product meaning | 03D; GOV-ARCH-02 deferral | IMPLEMENTED HOW; WHAT stale | Users understand when they spend | — | NO as distinct WHAT | ADD CURRENT |
| Stripe / commercial payment | BILLING-READY; Platform-00 | DEFERRED | Paid plans later | Credits model | YES as PLANNED | KEEP FUTURE |
| Email/password auth | AUTH-APP; GO-NO-GO | IMPLEMENTED | Sign in for beta | — | YES | KEEP |
| Google OAuth login | AUTH-APP-01D code; 04B defer; GO-NO-GO | DEFERRED (code exists, not activated) | Easier login later | Product activation | YES deferred | KEEP FUTURE / deferred |
| Multilingual en / zh-TW / zh-CN | I18N; PRD | IMPLEMENTED | Local-language UX | — | YES | KEEP |
| Private-beta 1–3 trusted users | GO-NO-GO | APPROVED_FUTURE rollout constraint (not yet invited) | Safe first users | Invite task parked | NO | ADD as LIMITED-BETA, not long-term vision |
| Support/feedback channel | GO-NO-GO | DEFERRED / UNKNOWN channel | Users can get help | Required before invite | NO | ADD beta expectation; channel DEFER |
| Future integrations (Notion/Slack/Gmail/Drive) | KNOWLEDGE-00 | APPROVED_FUTURE | Knowledge from existing tools | Knowledge runtime | YES as broad non-goal now | RELABEL_FUTURE named only if Step 2 keeps them |
| Public agent ecosystem | Platform-00 deferred; PRD | APPROVED_FUTURE / far | Third-party agents | Multi-agent runtime | YES as non-goal now | KEEP non-current |
| Generated-app isolated auth | AUTH-MODULE | PARTIAL (templates/isolation) | Apps users build don’t inherit platform auth | — | Thin | DEFER / limited ADD |

Ideas **already implemented:** Builder single-shot; projects/files/preview/checkpoints/chat; command-center shell; registry placeholders; Create Agent profiles; email/password; credit ledger; delayed Build credit (not in PRD); multilingual; admin ops; Harness gated (not default).

Ideas **partially implemented:** Create Agent (persist, not run); Harness (exists, gated); coordinator (in-memory precursor); multi-Builder identity plumbing; OAuth routes (fail-closed); Stripe schemas (not charging); RPG identity (shell, not simulation).

Ideas **still approved FUTURE:** specialist agents; executable user agents; knowledge; collaboration/referrals/work objects/approvals/loop limits; multi-Builder runtime; Harness-as-default; Stripe; OAuth activation; named integrations; Legal Advisor; deeper RPG sim; public ecosystem.

Ideas **superseded as CURRENT (keep as labelled FUTURE where useful):** original walking-town as the beta product; “ainow.biz is a general multi-agent work platform now”; Harness as imminent default; immediate Build charge at provider completion; Google OAuth as required beta login; Stripe as current charging; UX-IA-00 as current IA.

Ideas **deferred / uncertain:** Legal Advisor timing; named connector set vs “broad integrations”; generated-app auth as a PRD feature; support channel choice; additional locales; Apple OAuth (AUTH-APP-01E code vs current beta email/password — Step 2 confirm whether still intended).

---

## 9. Product supersession table

Do **not** edit PRD in Step 1. Recommended Step 2 treatment only.

| # | Older product statement | Newer source | Current product truth | Future intended truth | Step 2 treatment |
|---|-------------------------|--------------|-----------------------|-----------------------|------------------|
| 1 | Original RPG walking-character / town simulation is the platform identity (Platform-00 / UX-IA-00) | RPG-MVP-RESET + RPG-03A/03B | Command-center RPG-identified shell; no game engine | Deeper RPG sim may remain long-term | CURRENT = shell. FUTURE = sim. Do not restore walking town as CURRENT |
| 2 | Broad multi-agent platform is current (Platform-00 tone) | GO-NO-GO 2026-08-23; PRD current goals | Builder-first; others placeholders | Specialist + collab + knowledge | CURRENT = Builder-first. FUTURE = Platform-00 staged |
| 3 | Original agent-platform vision is enough | CREATE-01, PLATFORM-04/05/07, KNOWLEDGE-00, COLLAB-00 | Concrete later plans exist; most unimplemented | Create / multi-Builder / knowledge / collab | Absorb later plans as labelled FUTURE; do not flatten to Platform-00 prose |
| 4 | Harness is the Builder experience | HARNESS gated; GO-NO-GO OUT OF SCOPE | Single-shot is beta path | Harness-as-default later | RELABEL |
| 5 | Users are charged at AI execution completion | 03D + LIVE-11 | Ask at completion; Build after qualifying apply | Same, plus Stripe later | UPDATE CURRENT WHAT |
| 6 | Stripe / live billing is near-term current | BILLING-READY deferral; GO-NO-GO | Credits-first; Stripe off | Stripe activation later | KEEP FUTURE |
| 7 | Google OAuth is part of current auth | 04B Outcome B; GO-NO-GO | Email/password only | OAuth activation later | KEEP deferred |
| 8 | Roadmap “next task” language is product | GOV-OS-01 | Board is scheduler | Ideas may remain | Do not copy roadmap order into PRD |
| 9 | GOV-PRD-01 “PostgreSQL is the sole durable DB; SQLite is not used” as product claim | GOV-ARCH-02 HOW | Product should not claim storage engines | — | REMOVE HOW from PRD; defer to ARCHITECTURE |
| 10 | AUTH-APP-01 “Google OAuth delivered” as product-available login | 04B defer | Not activated | Optional later | Do not list as CURRENT login method |
| 11 | Coming-soon agents imply beta delivery | GO-NO-GO OUT OF SCOPE | Placeholders only | Functional later | RELABEL_FUTURE vs coming-soon copy |
| 12 | Create Agent migration unexecuted (CREATE-01A caveat) | Later staging evidence / ARCHITECTURE | Persistence/API CURRENT; execution FUTURE | Executable later | UPDATE CURRENT persistence without claiming execution |

---

## 10. Major PRD.md drift areas

Against current `PRD.md` (GOV-PRD-01, 2026-08-10). Do not edit yet.

| Drift area | PRD.md today | Evidence now | Likely Step 3 direction |
|------------|--------------|--------------|------------------------|
| ainow.biz umbrella definition | Present; mixed CURRENT/FUTURE | GO-NO-GO Builder-first | Split CURRENT vs FUTURE hierarchy |
| Builder role | Strong CURRENT | Confirmed | KEEP; add single-shot vs Harness |
| Platform/dashboard identity | RPG-inspired command-center | RPG-03 shell | UPDATE CURRENT = command-center, not simulation |
| User-created agent product | Profiles CURRENT; executable FUTURE | CREATE-01 confirmed | KEEP split; tighten |
| Multi-agent promises | Planned post-beta | Still not operational | KEEP FUTURE; remove any CURRENT implication |
| Specialist agents | Coming-soon table | Placeholders; name drift | UPDATE names; RELABEL_FUTURE vs beta-out |
| Knowledge | PLANNED | Plan only | KEEP FUTURE |
| Collaboration | PLANNED | Plan only | KEEP FUTURE |
| Referrals / work objects / approvals / loop limits | Work objects PLANNED; gates/limits thin | COLLAB-00 / 05 / 07 | ADD FUTURE detail without making CURRENT |
| Multi-Builder | Missing as named FUTURE | PLATFORM-04/05 | ADD FUTURE |
| Harness positioning | GATED | Beta-out | RELABEL: CURRENT gated ≠ beta promise ≠ abandoned |
| Credits / billing WHEN | “Credit deducted per AI execution” | 03D delayed Build | UPDATE CURRENT WHAT |
| Confirm-build-apply | Missing | 03J / LIVE-11 | ADD CURRENT user-facing confirmation |
| Auth / OAuth | Email CURRENT; Google deferred | Confirmed | KEEP |
| RPG direction | Command-center CURRENT; walking post-beta | Confirmed | KEEP / tighten |
| Beta vs future | “initial Builder private beta” | 1–3 users, invite parked, support undefined | ADD LIMITED-BETA layer |
| Coming-soon labels | Used for specialists | Beta will not deliver them | RELABEL so coming-soon ≠ this beta |
| Roadmap / launch wording | Some planned-goals mix | Board is scheduler | Strip scheduler language |
| Stale HOW in PRD §4 | “PostgreSQL sole DB; SQLite not used”; mixed-transport essay | GOV-ARCH-02 | MOVE HOW to ARCHITECTURE; keep product-level outcomes only |
| Document hierarchy names | TASKS.md / TASKS_BACKLOG_FULL.md / CLAUDE.md | GOV-OS-01 | UPDATE names to current OS artifacts |
| Agent display names | Chief of Staff / Product Strategy / Technology Advisor | i18n: Chief of Staff Agent / Product Strategy Agent / Technology Advisor Agent | F — resolve canonical names |

---

## 11. Technical-HOW deferrals to ARCHITECTURE.md

PRD may state product behavior/outcome. Deep HOW stays in `ARCHITECTURE.md` (GOV-ARCH-02 locked).

Do not copy into PRD:

- Exact ports (Gateway 4000, AI 4001, container-manager, frontend)
- Caddy / PM2 / compose topology
- BullMQ / Redis / SSE internals
- Database schema / table names / `source_event_id` idempotency implementation
- API route internals (`POST /api/ai/execute`, confirm-build-apply path details)
- Git `safe.directory` / container Git HOW
- Idle-timeout mechanism (request-driven Map vs cron)
- Credit idempotency implementation
- In-memory coordinator module path / no-HTTP precursor details beyond “not product-reachable”
- Watchdog probe set / PM2 process names
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` as a product sentence (product: Harness is off by default)

PRD **may** say: users spend credits when an Ask completes and when a qualifying Build apply is confirmed; Harness is not the default beta experience; Preview shows the running workspace; checkpoints can revert files.

---

## 12. Roadmap vs PRD boundary

`docs/AINOW-EXECUTION-ROADMAP.md` and task registries may define sequencing.

| Roadmap content | Belongs in |
|-----------------|------------|
| Long-term product ideas (knowledge, collab, multi-Builder, specialists, Stripe) | PRD as labelled FUTURE WHAT |
| “Current Next Task”, one-ACTIVE-task, family order, canary sequence | TASKS.md / TASKS_BACKLOG_FULL.md only — historical after GOV-OS-01 |
| GOV-OS-01 → E2E → GOV-ARCH-02 → GOV-PRD-02 → pilot → Lane 3 | Scheduler / this governance sequence — **not** PRD |
| Private-beta invite execution | PARKED task — not PRD CURRENT; maybe FUTURE operational note |
| Historical completed BILLING-READY / HARNESS slice order | Historical sequencing — do not copy |

PRD.md must not become the scheduler.

---

## 13. Unresolved product conflicts for Step 2

| ID | Conflict | Why unresolved in Step 1 | Step 2 need |
|----|----------|--------------------------|-------------|
| F1 | Canonical specialist-agent **display names** (PRD vs i18n vs Platform-00 vs registry ids) | Multiple locked sources disagree on wording | Pick one canonical set; map ids |
| F2 | Whether “coming soon” remains the user-visible label vs “planned / not in this beta” | Product copy vs GO-NO-GO beta-out | Decide user-facing label |
| F3 | Legal Advisor: approved future vs omit until later plan | Named in Platform-00/COLLAB-00; absent from PRD | ADD FUTURE or explicit DEFER |
| F4 | Apple OAuth: AUTH-APP-01E delivered code vs current beta email/password only | Not mentioned in GO-NO-GO (Google called out) | Confirm FUTURE vs abandoned |
| F5 | Named knowledge connectors vs PRD “broad integrations” non-goal | KNOWLEDGE-00 lists connectors as later | Named FUTURE vs generic FUTURE |
| F6 | How much Create Agent MVP to describe (fields, no delete, no execution) | CREATE-01B vs GO-NO-GO T7 no delete | CURRENT limitations vs FUTURE |
| F7 | Ask vs Build user language (Ask/Build vs conversation/workspace_mutation) | HOW names vs product copy | Product glossary |
| F8 | Whether delayed Build credit is described as “spend” vs “deduct after apply” | Billing UX copy deferred by GOV-ARCH-02 | Exact user-facing WHEN |
| F9 | Support/feedback: product expectation vs operational invite blocker | Channel not defined | PRD may require a support expectation without choosing Slack/email |
| F10 | Umbrella brand spelling/punctuation across PRD / ARCHITECTURE / Platform-00 / roadmap banners | Visual variants in historical docs | Confirm `ainow.biz` as PRD canonical unless Keith directs otherwise |

None of these block Step 2 from starting. None require runtime evidence.

---

## 14. Step 2 scope

Step 2 is read-only inventory against this frozen map. It must not edit `PRD.md`.

In scope:

1. Walk every §4 classification and §8 idea against current `PRD.md` sections
2. Walk every §9 supersession row and assign CURRENT vs LIMITED-BETA vs FUTURE vs SUPERSEDED
3. Produce a section-by-section gap list against `PRD.md`
4. Cover all 32 required product areas (see §5–§8)
5. Resolve F-items from source where possible; record remaining F as explicit Step 3 decisions
6. Produce a bounded Step 3 `PRD.md` edit plan (patch in place; CURRENT / LIMITED-BETA / FUTURE separated)
7. Keep TECHNICAL HOW deferred to `ARCHITECTURE.md`
8. Keep invitations parked

Out of scope for Step 2:

- Editing `PRD.md` or `ARCHITECTURE.md`
- Implementation
- Registering the 2-source-lane pilot
- Registering PRIVATE-BETA-INVITE-01
- Choosing the support channel
- Inviting users

---

## 15. Invitation parked state

```
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED=NO
```

GOV-PRD-02 does not authorize invitations. Fresh Keith invitation authorization remains required after a future registered invite lifecycle.

---

## 16. Successor sequence

Preserve (do not register beyond this task):

```
GOV-PRD-02
→ first genuine 2-source-lane pilot
→ pilot review
→ explicit future Lane 3 decision
```

The first genuine 2-source-lane pilot remains **NOT REGISTERED**.  
Lane 3 remains **DISABLED**. No implicit enablement.

---

## 17. ainow.biz product hierarchy (evidence-only freeze)

Do not invent new product areas. Status is CURRENT / PARTIAL / FUTURE / SUPERSEDED.

```
ainow.biz
  ├─ Builder Agent / aiSandBox ..................... CURRENT (single-shot); Harness PARTIAL/gated; Harness-default FUTURE
  ├─ specialist system agents ...................... PARTIAL (placeholders); executable FUTURE
  ├─ user-created agents ........................... PARTIAL (persist/UI); executable FUTURE
  ├─ shared knowledge .............................. FUTURE
  ├─ specialist knowledge .......................... FUTURE
  ├─ collaboration / referrals / work objects ...... FUTURE (in-memory coordinator = HOW precursor only)
  ├─ orchestration / multi-Builder ................. FUTURE (identity plumbing PARTIAL)
  └─ platform command-center / dashboard ........... CURRENT (shell); walking-town SUPERSEDED as MVP, FUTURE as deeper RPG
```

The hierarchy is supported by Platform-00 + later concrete plans + GO-NO-GO + GOV-ARCH-02. Refine wording in Step 2; do not add branches.

---

## 18. Three-layer freeze (mandatory for reconciled PRD)

| Layer | Meaning | Example |
|-------|---------|---------|
| **A. CURRENT IMPLEMENTED PRODUCT** | Users can do this now | Builder single-shot; credits ledger; command-center shell |
| **B. CURRENT LIMITED PRIVATE-BETA SCOPE** | Who / how we roll CURRENT out | Builder-only; 1–3 trusted users; email/password; Harness off; invite parked |
| **C. LONG-TERM APPROVED PRODUCT VISION** | We still intend to build this | Specialists; knowledge; collab; multi-Builder; Stripe; OAuth; Harness-default |

PRD.md must not mix “we have this” with “we intend to build this”.

---

## 19. Activity ledger (Step 1)

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

Allowed Step 1 writes only: `TASKS.md` CURRENT EXECUTION BOARD; `TASKS_BACKLOG_FULL.md` GOV-PRD-02 registration; this file.

---

*Frozen 2026-08-24 — GOV-PRD-02 Step 1 — product reconciliation registered — authoritative product/idea source map frozen — CURRENT / LIMITED-BETA / APPROVED-FUTURE separated — technical HOW deferred to ARCHITECTURE.md — PRIVATE-BETA-INVITE-01 remains PARKED.*
