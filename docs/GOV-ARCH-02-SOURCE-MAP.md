# GOV-ARCH-02 Step 1 — Authoritative Architecture Source Map (FROZEN)

**Task ID:** GOV-ARCH-02  
**Title:** Architecture Reconciliation  
**Step:** 1 — Registration + source-map freeze  
**Status:** COMPLETE — 2026-08-23  
**Nature:** GOVERNANCE / DOCUMENTATION ONLY — no ARCHITECTURE.md write in this step  
**Workstream:** GOVERNANCE (taxonomy only; not an admission weight)  
**Lifecycle:** 4-step GOVERNANCE  
**Evidence class:** GOVERNANCE  
**Source-map freeze date:** 2026-08-23  
**Tree observed at freeze:** branch `main`, HEAD `c19492037abfc49b60959981697407071f98b998`, `git status --short` CLEAN before Step 1 writes

This document is the frozen Step 1 source map for GOV-ARCH-02.  
It is evidence, not the current architecture authority.  
It does not replace `ARCHITECTURE.md`.  
It does not update `PRD.md`.  
Step 2 must inventory gaps against this map. Step 3 may update `ARCHITECTURE.md` plus governance/checkpoint documents only.

Do not treat this file as a scheduler.  
Do not register GOV-PRD-02 here.  
Do not register the first genuine 2-source-lane pilot here.  
Do not register or start PRIVATE-BETA-INVITE-01.

---

## 1. Purpose

GOV-ARCH-02 exists to reconcile accumulated technical architecture decisions into `ARCHITECTURE.md` after:

- GOV-ARCH-01 (2026-08-10) last reconciled current-state HOW
- post-03D–03J Builder accounting / checkpoint / public-route architecture (explicitly left pending by GOV-OS-01)
- later private-beta LIVE-11 PASS and PRIVATE-BETA-GO-NO-GO-01 GO (2026-08-23)

GOV-ARCH-01 corrected critical false claims (SQLite, HTTP-only, no queues, no workers). It did **not** absorb later implemented HOW, and it did not re-classify approved future architecture that remains unimplemented.

This Step 1 freeze:

1. Confirms GOV-ARCH-02 as the already-planned successor identifier
2. Records the authority hierarchy
3. Inventories architecture-relevant sources and classifies them A–F
4. Separates CURRENT / IMPLEMENTED architecture from APPROVED / PLANNED FUTURE architecture
5. Records supersession and drift without resolving it by editing `ARCHITECTURE.md`
6. Hands product-WHAT drift to GOV-PRD-02
7. Freezes Step 2 inventory scope

---

## 2. Authority hierarchy

Preserve the Development OS authority split. There is no global file-rank.

| Artifact | Domain | Role in GOV-ARCH-02 |
|----------|--------|---------------------|
| `PRD.md` | PRODUCT WHAT | Read for boundary only. Do not reconcile. Drift → GOV-PRD-02 |
| `ARCHITECTURE.md` | TECHNICAL HOW | Current architecture authority. Last reconciled 2026-08-10 (GOV-ARCH-01). Subject of Step 3 |
| `CLAUDE.md` | DEVELOPMENT OS / RULES | Not architecture HOW. Do not mutate OS semantics in this lifecycle |
| `TASKS.md` CURRENT EXECUTION BOARD | Only current scheduler | Admits this lifecycle. Stop at LEGACY / FROZEN |
| `TASKS_BACKLOG_FULL.md` | Canonical task registry | GOV-ARCH-02 body / AC / history |
| Locked checkpoints / stage-start / plans under `docs/` | Evidence | Named evidence for a specific task. Not automatically current architecture authority |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Historical / strategic reference | Not scheduler. Not current architecture authority |
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Historical / strategic vision | Not current PRD, architecture, or scheduler |
| This source map | Step 1 freeze evidence | Source classification for Step 2/3. Not HOW authority |

Conflict-resolution for this lifecycle:

- Planning / master-plan / checkpoint documents are source evidence.
- Implemented locked checkpoints outweigh older plans when describing CURRENT architecture.
- Approved plans that were never implemented remain FUTURE, even if locked.
- Speculative product ideas must not be promoted into architecture.
- GOV-ARCH-02 must not turn `ARCHITECTURE.md` into a product roadmap.

Identifier confirmation:

- GOV-OS-01 Planned Successor Sequence and `docs/GOV-OS-01-STAGE-START.md` §26 record: GOV-OS-01 → fresh post-03J E2E (now completed by LIVE-11 PASS) → **GOV-ARCH-02** → GOV-PRD-02 → first genuine 2-source-lane pilot → pilot review → explicit Lane 3 decision.
- `docs/GOV-OS-01-CHECKPOINT.md` §38: `ARCHITECTURE.md` was not modified; GOV-ARCH-02 remained unregistered; post-03D–03J technical reconciliation remained pending.
- PRIVATE-BETA-GO-NO-GO-01 lock (2026-08-23) preserved that sequence and did not register this task.
- Repo-wide search found **no** prior GOV-ARCH-02 registration/admission. Identifier confirmed. No invented ID.

---

## 3. Exact source inventory

Paths are relative to repository root `C:\Users\knlee\aiSandBox2026B` unless noted.

### 3.1 Authority documents

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `ARCHITECTURE.md` | Last reconciled 2026-08-10 — GOV-ARCH-01 COMPLETE AND LOCKED | Entire HOW |
| `PRD.md` | Last reconciled 2026-08-10 — GOV-PRD-01 COMPLETE AND LOCKED | Product WHAT (boundary only) |
| `CLAUDE.md` | OS v1 standing — GOV-OS-01 COMPLETE AND LOCKED 2026-08-18 | Development OS / rules |
| `AGENTS.md` | Thin bootstrap | Boot only |
| `TASKS.md` CURRENT EXECUTION BOARD | Current scheduler — stop at LEGACY / FROZEN | Admission |
| `TASKS_BACKLOG_FULL.md` | Canonical registry | Task bodies |

### 3.2 Prior architecture-reconciliation evidence

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `docs/GOV-ARCH-01-STAGE-START.md` | 2026-08-10 COMPLETE | Prior HOW audit |
| `docs/GOV-ARCH-01-CHECKPOINT.md` | 2026-08-10 COMPLETE AND LOCKED | Prior HOW freeze |
| `docs/GOV-PRD-01-STAGE-START.md` | 2026-08-10 COMPLETE | Prior WHAT audit (defer) |
| `docs/GOV-PRD-01-CHECKPOINT.md` | 2026-08-10 COMPLETE AND LOCKED | Prior WHAT freeze (defer) |
| `docs/GOV-OS-01-STAGE-START.md` | 2026-08-18 COMPLETE | Successor sequence / OS freeze |
| `docs/GOV-OS-01-CHECKPOINT.md` | 2026-08-18 COMPLETE AND LOCKED | Explicitly pending GOV-ARCH-02 |

### 3.3 Current post-GO evidence (context only)

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `docs/PRIVATE-BETA-GO-NO-GO-01-CHECKPOINT.md` | 2026-08-23 COMPLETE AND LOCKED — GO | Beta scope / next sequence |
| `docs/PRIVATE-BETA-GO-NO-GO-01-DECISION.md` | 2026-08-23 GO | Bounded Builder-first beta |
| `docs/PRIVATE-BETA-E2E-LIVE-11-CHECKPOINT.md` | 2026-08-23 COMPLETE AND LOCKED — PASS | Staging-proven Builder path |

### 3.4 Platform / multi-agent family

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | COMPLETE AND LOCKED — HISTORICAL / STRATEGIC VISION | Vision / long-term platform |
| `docs/AGENT-PLATFORM-00-CHECKPOINT.md` | COMPLETE AND LOCKED | Planning lock |
| `docs/AINOW-EXECUTION-ROADMAP.md` | HISTORICAL / STRATEGIC REFERENCE — NOT current scheduler | Historical sequencing |
| `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | 2026-07-04 COMPLETE AND LOCKED | Static agent registry |
| `docs/AGENT-PLATFORM-02A-CHECKPOINT.md` | 2026-07-06 COMPLETE | Platform dashboard shell |
| `docs/AGENT-PLATFORM-02B-CHECKPOINT.md` | 2026-07-06 COMPLETE | Dashboard navigation |
| `docs/AGENT-PLATFORM-03-CHECKPOINT.md` | 2026-07-06 COMPLETE AND LOCKED | Builder route integration review |
| `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` | 2026-07-07 plan COMPLETE | Multi-Builder topology |
| `docs/AGENT-PLATFORM-04-CHECKPOINT.md` | 2026-07-07 COMPLETE AND LOCKED | Topology lock |
| `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` | 2026-07-09 plan COMPLETE | Multi-Builder orchestration |
| `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md` | 2026-07-09 COMPLETE | Orchestration readiness |
| `docs/AGENT-PLATFORM-05-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | Orchestration plan lock |
| `docs/AGENT-PLATFORM-06-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | Upstream identity propagation (implemented) |
| `docs/AGENT-PLATFORM-06-SOURCE-PATH-REVIEW.md` | 2026-07-09 | Identity path evidence |
| `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md` | 2026-07-09 plan COMPLETE | Coordinator plan |
| `docs/AGENT-PLATFORM-07-SOURCE-PATH-REVIEW.md` | 2026-07-09 | Coordinator source-path |
| `docs/AGENT-PLATFORM-07-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | Coordinator plan lock |
| `docs/AGENT-PLATFORM-07A-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | Coordinator contracts |
| `docs/AGENT-PLATFORM-07B-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | Orchestration module skeleton |
| `docs/AGENT-PLATFORM-07C-CHECKPOINT.md` | 2026-07-10 COMPLETE AND LOCKED | Referral enqueue + cancel redesign |
| `docs/AGENT-PLATFORM-07C1-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | In-memory orchestration core |
| `docs/AGENT-PLATFORM-07C2-CHECKPOINT.md` | 2026-07-09 COMPLETE AND LOCKED | Referral enqueue + job extension |
| `docs/AGENT-PLATFORM-07C3-CHECKPOINT.md` | 2026-07-10 COMPLETE AND LOCKED | 07C validation close |
| `docs/AGENT-PLATFORM-07D-CHECKPOINT.md` | COMPLETE AND LOCKED | Audit-event readiness |
| `docs/AGENT-PLATFORM-07E-CHECKPOINT.md` | COMPLETE AND LOCKED | Canary execution |
| `docs/AGENT-PLATFORM-07F-CHECKPOINT.md` | COMPLETE AND LOCKED | Live runtime canary parent |
| `docs/AGENT-PLATFORM-07F1-CHECKPOINT.md` | 2026-07-10 COMPLETE AND LOCKED | Queue metadata canary |
| `docs/AGENT-PLATFORM-07F2-CHECKPOINT.md` | 2026-07-10 COMPLETE AND LOCKED | Cancel-signal canary |
| `docs/AGENT-PLATFORM-07F3-CHECKPOINT.md` | 2026-07-12 COMPLETE AND LOCKED | 07F parent close |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` | 2026-07-20 COMPLETE (planning) | RPG MVP reset |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-DISCOVERY.md` | 2026-07-20 COMPLETE | RPG discovery |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | RPG reset lock |
| `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | RPG command-center UI |
| `docs/AGENT-PLATFORM-RPG-03B-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | Workspace↔platform link / auth-guard review |
| `docs/AGENT-PLATFORM-CREATE-01A-STAGE-START.md` | 2026-07-20 COMPLETE | Create Agent persistence design |
| `docs/AGENT-PLATFORM-CREATE-01A-IMPLEMENTATION.md` | 2026-07-20 COMPLETE | Create Agent backend implementation |
| `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | UserAgent persistence |
| `docs/AGENT-PLATFORM-CREATE-01B-STAGE-START.md` | 2026-07-20 COMPLETE | Create Agent UI design |
| `docs/AGENT-PLATFORM-CREATE-01B-IMPLEMENTATION.md` | 2026-07-20 COMPLETE | Create Agent UI implementation |
| `docs/AGENT-PLATFORM-CREATE-01B-CHECKPOINT.md` | 2026-07-20 COMPLETE AND LOCKED | Create Agent MVP UI |

### 3.5 Knowledge / collaboration / harness

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `docs/AGENT-KNOWLEDGE-00-KNOWLEDGE-ARCHITECTURE-PLAN.md` | 2026-07-06 plan; header still says ACTIVE; checkpoint LOCKED | Shared vs specialist knowledge |
| `docs/AGENT-KNOWLEDGE-00-CHECKPOINT.md` | 2026-07-06 COMPLETE AND LOCKED | Knowledge plan lock |
| `docs/AGENT-COLLAB-00-COLLABORATION-PROTOCOL-PLAN.md` | 2026-07-06 plan; header still says ACTIVE; checkpoint LOCKED | Referral / work objects / gates |
| `docs/AGENT-COLLAB-00-CHECKPOINT.md` | 2026-07-06 COMPLETE AND LOCKED | Collaboration plan lock |
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` | 2026-06 planning; header still says ACTIVE | Harness v1 target architecture |
| `docs/AGENT-HARNESS-00-CHECKPOINT.md` | 2026-06-19 COMPLETE AND LOCKED | Harness plan lock |
| `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | COMPLETE AND LOCKED | Read-only file canary (Worker→GW→CM→Docker) |
| `docs/AGENT-HARNESS-07-CHECKPOINT.md` | 2026-07-07 COMPLETE AND LOCKED | Per-builder harness config adapter |
| `docs/AGENT-HARNESS-WRITE-CANARY-B-CHECKPOINT.md` | COMPLETE AND LOCKED | Gated write-tool canary (stub provider) |

### 3.6 Builder execution / file-action / checkpoint / preview (material HOW)

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `docs/AI-03-01A-CHECKPOINT.md` | COMPLETE AND LOCKED | Backend file-action output |
| `docs/AI-03-01B-CHECKPOINT.md` | COMPLETE AND LOCKED | Frontend file-action apply |
| `docs/AI-03-01C-CHECKPOINT.md` | COMPLETE AND LOCKED | Chat file-action surfacing |
| `docs/AI-03-02-CHECKPOINT.md` | COMPLETE AND LOCKED | Post-action workspace coherence |
| `docs/AI-04-01-CHECKPOINT.md` | COMPLETE AND LOCKED | Chat persistence |
| `docs/PR-01-01-CHECKPOINT.md` | COMPLETE AND LOCKED | Project save/restore |
| `docs/PR-02-01-CHECKPOINT.md` | COMPLETE AND LOCKED | Project import/export |
| `docs/PR-03-01-CHECKPOINT.md` | COMPLETE AND LOCKED | Persistent Project identity |
| `docs/PREVIEW-STRATEGY-01A-CHECKPOINT.md` | 2026-06-09 COMPLETE AND LOCKED | PreviewStrategyResolver / subdirectory `index.html` |
| `docs/PRIVATE-BETA-BLOCKER-02-CHECKPOINT.md` | COMPLETE AND LOCKED | Preview proxy target → CM:4002 |
| `docs/PRIVATE-BETA-BLOCKER-03D-CHECKPOINT.md` | 2026-08-14 COMPLETE AND LOCKED | Delayed Build credit deduction |
| `docs/PRIVATE-BETA-BLOCKER-03D-A-CHECKPOINT.md` | 2026-08-14 COMPLETE AND LOCKED | Intent gate + internal confirm-build-apply |
| `docs/PRIVATE-BETA-BLOCKER-03D-B-CHECKPOINT.md` | 2026-08-14 COMPLETE AND LOCKED | Frontend confirm-build-apply path |
| `docs/PRIVATE-BETA-BLOCKER-03H-CHECKPOINT.md` | 2026-08-16 COMPLETE AND LOCKED | Authoritative balance display |
| `docs/PRIVATE-BETA-BLOCKER-03I-CHECKPOINT.md` | 2026-08-17 COMPLETE AND LOCKED | Git checkpoint / `safe.directory` |
| `docs/PRIVATE-BETA-BLOCKER-03J-CHECKPOINT.md` | 2026-08-18 COMPLETE AND LOCKED | Public Gateway confirm-build-apply |
| `docs/PRIVATE-BETA-BLOCKER-03L-CHECKPOINT.md` | 2026-08-22 COMPLETE AND LOCKED | Frozen Preview entrypoint `index.html` (runner fixture; product HOW already PREVIEW-STRATEGY-01A) |

### 3.7 Auth / billing / staging topology (only where they materially affect system architecture)

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `docs/AUTH-MODULE-01-CHECKPOINT.md` through `docs/AUTH-MODULE-03-CHECKPOINT.md` | COMPLETE AND LOCKED | Platform auth module |
| `docs/AUTH-APP-01-CHECKPOINT.md` / AUTH-APP family | COMPLETE AND LOCKED | Generated-app auth isolation |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION-CHECKPOINT.md` | 2026-07-26 COMPLETE AND LOCKED — Outcome B defer | Google OAuth out of beta architecture |
| `docs/BILLING-READY-00-CHECKPOINT.md` through `docs/BILLING-READY-08-CHECKPOINT.md` | COMPLETE AND LOCKED | Credit ledger / deduction / provisioning |
| `docs/BILLING-READY-01A-BILLING-IMPLEMENTATION-ARCHITECTURE-REVIEW.md` | 2026-07-06 COMPLETE (findings superseded by later billing slices) | Historical billing architecture review |
| `docs/PRODUCTION-DEPLOYMENT-ARCHITECTURE.md` | Design-only; some invariants superseded | Production topology design |
| `docs/EXTERNAL-MONITORING-CONTRACT.md` | 2026-03-09 TASK-60B | External poll monitoring |
| `docker-compose.yml` | Current local compose | Postgres / Redis / Prometheus / Grafana only |
| Staging Caddy/PM2 evidence in PRIVATE-BETA-STAGING-EXECUTION-04H / 04I2B / 03J | COMPLETE AND LOCKED | Public `/api/*` → Gateway :4000 |

### 3.8 Product / UX sources inspected only for WHAT/HOW boundary

| Path | Date / status | Subsystem |
|------|---------------|-----------|
| `docs/UX-IA-00-MASTER-PLAN.md` | 2026-05-05 — stale product/UX plan | Product UX vision |
| `PRD.md` Planned Goals / coming-soon agents | 2026-08-10 | Product WHAT |

Not inventoried as architecture sources: E2E runner/automation adapter checkpoints (AUTO-01 family), LIVE FAIL/BLOCKED historical records except where they proved a product HOW fact (Preview `index.html`, confirm-build-apply, delayed deduction).

---

## 4. Source classifications

Classification legend:

- **A** CURRENT ARCHITECTURE AUTHORITY
- **B** IMPLEMENTED ARCHITECTURAL DECISION NOT YET FULLY REFLECTED IN `ARCHITECTURE.md`
- **C** APPROVED FUTURE ARCHITECTURE
- **D** PRODUCT-VISION ONLY — belongs mainly in PRD / GOV-PRD-02
- **E** SUPERSEDED / HISTORICAL
- **F** UNKNOWN / CONFLICTING — needs Step 2 resolution

| Source | Date/status | Subsystem | Class | Implemented? | In ARCHITECTURE.md? | Step 2 must reconcile? |
|--------|-------------|-----------|-------|--------------|---------------------|------------------------|
| `ARCHITECTURE.md` | 2026-08-10 | HOW authority | **A** | N/A (document) | Self | Yes — subject |
| `PRD.md` | 2026-08-10 | WHAT | **D** (boundary) | Product spec | N/A | No — defer GOV-PRD-02 |
| `docs/GOV-ARCH-01-CHECKPOINT.md` | 2026-08-10 LOCKED | Prior HOW freeze | **A** (baseline) + residual gaps | Yes as of 2026-08-10 | Yes as of 2026-08-10 | Yes — baseline vs later B |
| `docs/GOV-OS-01-CHECKPOINT.md` §38 | 2026-08-18 LOCKED | Pending GOV-ARCH-02 | **A** (mandate) | N/A | Explicitly not updated | Yes — defines pending scope |
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Historical vision | Multi-agent vision | **E** + **D** | Partially via later slices | Only high-level CURRENT/PLANNED table | Yes — prevent promotion of unimplemented vision |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Historical reference | Sequencing | **E** | N/A | No (correct) | No as scheduler; yes if a HOW claim is cited |
| `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | 2026-07-04 LOCKED | Agent registry | **B** (detail) | Yes — static TS registry | Partial (§13.2) | Yes — registry vs backend identity |
| `docs/AGENT-PLATFORM-02A/02B/03` | 2026-07-06 LOCKED | Platform shell / routes | **B** (UX-architecture) | Yes | Partial (§13.1 dashboard) | Limited — routes/shell only |
| `docs/AGENT-PLATFORM-04-*` | 2026-07-07 LOCKED plan | Multi-Builder topology | **C** (plan) / **B** (identity model partially implemented) | Partial (role+profile types + adapter; not multi-Builder runtime) | Partial (per-builder harness config CURRENT; multi-Builder runtime not claimed) | Yes — current vs future split |
| `docs/AGENT-PLATFORM-05-*` | 2026-07-09 LOCKED plan | Orchestration | **C** | No operational multi-Builder runtime | Skeleton only | Yes |
| `docs/AGENT-PLATFORM-06-CHECKPOINT.md` | 2026-07-09 LOCKED | Identity propagation | **B** | Yes — optional identity fields on execute/job/usage metadata | Not described | Yes |
| `docs/AGENT-PLATFORM-07-*` plan | 2026-07-09 LOCKED | Coordinator plan | **C** | Plan only | No | Yes as FUTURE |
| `docs/AGENT-PLATFORM-07A..07F3` | 2026-07-09..12 LOCKED | Coordinator implementation | **B** | Yes — in-memory coordinator, contracts, cancel redesign, canaries; **not** user-facing multi-agent | Partial (“skeleton, in-memory; no persistence”) | Yes — how much is CURRENT vs unused |
| `docs/AGENT-KNOWLEDGE-00-*` | 2026-07-06 LOCKED plan | Knowledge | **C** | No runtime | PLANNED only | Confirm still unimplemented |
| `docs/AGENT-COLLAB-00-*` | 2026-07-06 LOCKED plan | Collaboration | **C** | No work-object runtime; 07C in-memory referrals only | PLANNED / skeleton | Yes — plan vs 07C skeleton |
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` | 2026-06 plan | Harness target | **C** + **E** (stale “current baseline” sections) | Partially via later harness slices | §12 CURRENT/GATED/NOT IMPLEMENTED | Yes — do not treat master plan as current |
| Harness 06E / 07 / write-canary | LOCKED | Harness HOW | **B** (mostly already in §12) | Yes, gated; stub-provider canaries | Mostly yes | Confirm post-2026-08-10 drift only |
| `docs/AGENT-PLATFORM-RPG-MVP-RESET-*` | 2026-07-20 LOCKED | RPG product reset | **D** + limited **B** | RPG-03A/03B implemented command-center shell | Partial (“static foundation”) | Product to GOV-PRD-02; technical shell to Step 2 |
| `docs/UX-IA-00-MASTER-PLAN.md` | 2026-05-05 | UX vision | **E** + **D** | Superseded by later UX/RPG work | No | No — do not revive as HOW |
| CREATE-01A/01B | 2026-07-20 LOCKED | Create Agent | **B** | Persistence + MVP UI; original migration-not-executed caveat | Partial (`user_agents`; “persistence only; not executable”) | Yes — APIs, migration status, non-execution |
| 03D / 03D-A / 03D-B | 2026-08-14 LOCKED | Credit deduction | **B** | Yes — delayed Build deduction | **No** (still immediate finalize-accounting in §11) | **Yes — major gap** |
| 03J | 2026-08-18 LOCKED | Public confirm-build-apply | **B** | Yes — public Gateway route | **No** | **Yes — major gap** |
| 03H | 2026-08-16 LOCKED | Balance source of truth | **B** (display HOW) | Yes | Not described | Limited |
| 03I | 2026-08-17 LOCKED | Git checkpoint | **B** | Yes — `safe.directory` / checkpoint create | Checkpoint ledger mentioned; Git HOW thin | Yes |
| PREVIEW-STRATEGY-01A | 2026-06-09 LOCKED | Preview detection | **B** | Yes — subdirectory `index.html` | Preview proxy only; strategy missing | Yes |
| AUTH-MODULE / AUTH-APP | LOCKED | Auth boundary | **B** | Yes — platform session cookies vs generated-app isolation | Thin (cookie/CSRF mentioned) | Yes — boundary only |
| Google OAuth 04B decision | 2026-07-26 LOCKED | Auth | **C** (deferred) / **D** | Not activated | Not described | Note as out of current beta HOW |
| BILLING-READY-00..08 | LOCKED | Credits | **B** | Yes — persistent ledger, `sourceEventId`, free-plan provisioning; Stripe not charging | Partial (tables + finalize-accounting) | Yes — delayed Build path + `BILLING_CHARGES_ENABLED` |
| `PRODUCTION-DEPLOYMENT-ARCHITECTURE.md` | Design-only | Deploy | **C** + **E** + **F** | Design; HTTP-only claim superseded; AI port 4001 vs 4099 | Logical topology only | Yes — conflicts |
| `EXTERNAL-MONITORING-CONTRACT.md` | 2026-03-09 | Monitoring | **B** + **E** + **F** | Health/metrics endpoints exist; “no workers/event bus” claim superseded | Not described | Yes |
| `docker-compose.yml` | Current | Local infra | **B** | Postgres/Redis/Prometheus/Grafana; **no** app services | Partial (ports 5432/6379; no compose split) | Yes |
| Staging Caddy/PM2 evidence | LOCKED | Staging topology | **B** | Yes — Caddy `/api/*` → Gateway; PM2 app processes | Not described | Yes |
| PRIVATE-BETA-GO-NO-GO-01 | 2026-08-23 GO | Beta scope | **D** (product scope) + constraint on HOW claims | N/A | Must not claim Harness/multi-agent as operational beta | Record as constraint |
| Invitation / support channel | PARKED | Commercial | **D** | Not started | Must not appear as architecture | Exclude |

---

## 5. Implemented / CURRENT architecture inventory

This inventory is **CURRENT / IMPLEMENTED**. It must not be mixed with §6.

Do not claim unimplemented multi-agent capabilities are operational.

### 5.1 Already reflected in `ARCHITECTURE.md` (GOV-ARCH-01 baseline — still valid unless Step 2 disproves)

- Repository layout: no `aiSandBox/` subdirectory; `frontend/`, `services/api-gateway/`, `services/ai-service/`, `services/container-manager/`
- Mixed transport: HTTP + BullMQ/Redis + Redis Pub/Sub + WebSocket (preview only)
- PostgreSQL sole durable DB; Redis for queue + execution-stream Pub/Sub
- Session lifecycle CREATED → ACTIVE → TERMINATED; TERMINATED final; 404/410/429/502
- Preview = passive proxy Browser → API Gateway → container-manager :4002
- Single-shot Builder path: `POST /api/ai/execute` → guards → usage_records → BullMQ → Worker → provider → file-actions events → SSE
- Safety gates: `GLOBAL_EXECUTION_ENABLED` default false; Harness tool-loop/write/validation/browser default false
- Agent Harness implemented but gated; `search_workspace` schema-only; no automatic rollback; real-provider autonomous loop UNPROVEN
- ainow.biz umbrella + Builder module; static system-agent registry; non-Builder agents coming-soon placeholders
- User-created agents persisted, **not** executable runtimes
- Orchestration described as in-memory skeleton, no persistence
- Internal APIs: session start/stop/error, git-checkpoints, finalize-accounting
- Docker isolation; gVisor PLANNED
- No clustering / HA / Kubernetes / Kafka / cron / session resurrection

### 5.2 Implemented and staging-proven, but missing or stale in `ARCHITECTURE.md`

| Area | Current implemented truth | Primary evidence | ARCHITECTURE.md today |
|------|---------------------------|------------------|------------------------|
| Build credit deduction | Delayed until qualifying workspace apply confirmation; Ask/`conversation` still immediate | 03D / 03D-A / 03D-B; LIVE-11 DEDUCTION PASS | §11 still shows Worker → finalize-accounting as the Build charge point |
| confirm-build-apply | Public authenticated Gateway `POST /api/ai/executions/:executionId/confirm-build-apply`; internal route retained; Next.js proxy temporarily retained | 03J Architecture B | Not listed in public or internal APIs |
| Intent split | `conversation` vs `workspace_mutation` gates deduction | 03D policy matrix | Not described |
| Git checkpoints | Container Git + Gateway ledger; `safe.directory` ownership fix for uid-1000 bind-mount `/workspace` | 03I | Ledger mentioned; Git HOW missing |
| Preview strategy | `PreviewStrategyResolver`; static HTML via workspace/subdirectory `index.html` | PREVIEW-STRATEGY-01A; 03L/LIVE-11 | Proxy path only |
| Agent identity on execution | Optional `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` on execute → job → usage metadata | AGENT-PLATFORM-06 | Not described |
| Per-builder harness adapter | `resolveBuilderHarnessConfig()` + `builder-default` static profile | AGENT-HARNESS-07 | Mentioned; identity wiring missing |
| Orchestration coordinator | NestJS `orchestration/` module; in-memory stores; referral lifecycle; loop prevention; cancel redesign beyond obliterate-all | 07A–07C | “skeleton” underspecified |
| Create Agent | `UserAgent` + `POST/GET /api/agents`; MVP UI; not an execution runtime | CREATE-01A/01B | Table only; APIs missing |
| Platform routes | `/[locale]/platform` command-center shell; `/[locale]/app` Builder; sidebar Command Center link | RPG-03A/03B, PLATFORM-02/03 | High-level only |
| Auth boundary | Platform session cookie `aisandbox_session` + CSRF; generated apps isolated; Google OAuth not activated | AUTH-MODULE family; 04B Outcome B; GO/NO-GO | Cookie/CSRF mentioned; isolation/OAuth missing |
| Credits vs Stripe | Persistent credit ledger + `sourceEventId` idempotency; `BILLING_CHARGES_ENABLED=false`; Stripe charging out of beta | BILLING-READY-08; LIVE-11; GO/NO-GO | Tables exist; charging gate missing |
| Provider routing | Adapter registry; current proven Builder path xAI / grok-4.5; attribution on usage_records | ARCHITECTURE §3; LIVE-11 | Adapters listed; routing/attribution thin |
| Staging topology | Caddy TLS; `/api/*` → Gateway :4000; Next.js separate; PM2 app processes; Postgres/Redis on host/compose | 03J; STAGING-04H/04I2B | Logical topology only |
| Local compose vs apps | `docker-compose.yml` runs Postgres, Redis, Prometheus, Grafana only — not Gateway/AI/CM/frontend | `docker-compose.yml` | Implies services without compose split |
| Monitoring | Gateway health/ready/metrics; Prometheus/Grafana in compose; external poll contract | `EXTERNAL-MONITORING-CONTRACT.md`; compose | Not described |
| File-action / AUTO_APPLY | Parse → risky-batch confirm → sequential apply → checkpoint → refresh; non-risky one-file AUTO_APPLY | AI-03 family; E2E-05 / LIVE-11 | Frontend apply mentioned; pipeline thin |
| Beta operational constraint | Limited Builder-first private beta; Harness out of scope/disabled; multi-agent out of scope | GO/NO-GO §9 | Harness GATED (correct); must not be described as beta-on |

### 5.3 Explicitly NOT current / NOT operational

- Multi-Builder concurrent runtime
- Non-Builder functional agents
- User-created agents as executable agents
- Knowledge ingestion / vector / semantic retrieval
- Work-object runtime (tickets/decisions) as a product system
- Human-facing collaboration/referral product
- Harness as the default Builder experience
- Automatic Harness rollback
- `search_workspace` handler
- Stripe charging
- Google OAuth login
- gVisor isolation
- Invitations / support channel

---

## 6. Approved / PLANNED FUTURE architecture inventory

This inventory is **APPROVED / PLANNED**. It must not be described as current.

| Future capability | Authoritative plan / evidence | Status | Notes for ARCHITECTURE.md |
|-------------------|-------------------------------|--------|---------------------------|
| Role + profile multi-Builder topology | AGENT-PLATFORM-04 | Approved plan; identity types/adapter exist; runtime not operational | FUTURE; distinguish from CURRENT single-Builder path |
| Multi-Builder orchestration / shared-project collaboration | AGENT-PLATFORM-05 | Approved plan; write deferral still in force for shared writes | FUTURE |
| Durable orchestration coordinator / persisted referrals | AGENT-PLATFORM-07 plan | In-memory implementation exists; persistence/product runtime FUTURE | CURRENT skeleton vs FUTURE persistence must be split |
| Shared vs specialist knowledge base | AGENT-KNOWLEDGE-00 | Plan only | PLANNED (already) |
| Collaboration protocol / work objects / approval gates / loop prevention as product runtime | AGENT-COLLAB-00 | Plan only; 07C in-memory safety limits are a precursor | PLANNED |
| Harness default / real-provider autonomous loop | AGENT-HARNESS-V1 + §12 UNPROVEN | Implemented gated; not beta; not production-proven with real providers | Keep GATED / UNPROVEN |
| `search_workspace` handler; semantic search; automatic rollback | ARCHITECTURE §12 + harness plan | NOT IMPLEMENTED | Keep NOT IMPLEMENTED |
| gVisor | ARCHITECTURE §9 | PLANNED | Keep PLANNED |
| Stripe / commercial charging | PRD Planned Goals; BILLING-READY later slices not activated | FUTURE product+HOW | Do not activate in this lifecycle |
| Google OAuth | 04B Outcome B defer; GO/NO-GO out of scope | Deferred | FUTURE / out of current beta |
| Functional Chief of Staff / Product Strategy / Technology Advisor | Platform-00 / PRD Planned Goals | Placeholder only | FUTURE product; architecture may record PLACEHOLDER |
| Production HA / clustering / Kubernetes | Explicit non-goals | Not approved | Remain non-goals unless a later governance task changes them |
| Lane 3 / parallel-dev expansion | GOV-OS-01 sequence | Explicit future decision after pilot | OS, not product architecture |

---

## 7. Supersession / conflict list

Do **not** resolve by editing files in Step 1. Recommended Step 2 authority is recorded only.

| # | Older source | Newer source | Current implemented truth | Recommended Step 2 architecture authority |
|---|--------------|--------------|---------------------------|-------------------------------------------|
| 1 | Original RPG walking-character / town simulation (Platform-00 / UX-IA-00) | AGENT-PLATFORM-RPG-MVP-RESET + RPG-03A/03B | Command-center RPG-identified shell; no game engine / walking character | CURRENT = RPG-03 shell. FUTURE product RPG depth → GOV-PRD-02. Do not restore original RPG simulation as HOW |
| 2 | Platform-00 “ainow.biz is a general multi-agent work platform now” | GO/NO-GO 2026-08-23; PRD current goals | Builder-first; other agents coming-soon placeholders; multi-agent out of beta | CURRENT = Builder-first platform shell. FUTURE = Platform-00/COLLAB/KNOWLEDGE plans, clearly labeled |
| 3 | AGENT-HARNESS-V1 target “understand → plan → edit → test → fix → checkpoint” as imminent default | ARCHITECTURE §12; GO/NO-GO Harness OUT OF SCOPE | Harness implemented, gated off; beta path is single-shot | CURRENT = single-shot. Harness = GATED implemented, not operational beta |
| 4 | Pre-03D: deduct at AI completion via finalize-accounting | 03D Architecture A + 03J public confirm | Build charges only after qualifying apply confirm; Ask immediate | CURRENT = delayed Build deduction. Update §11/§8 |
| 5 | 03D-B Next.js confirm proxy as the public path | 03J Architecture B public Gateway route | Caddy `/api/*` → Gateway; public Gateway route exists; Next.js proxy temporarily retained | CURRENT = Gateway public route. Step 2 must confirm whether Next.js proxy is still required |
| 6 | ARCHITECTURE §11 Worker finalize-accounting as the charge point | 03D intent gate | Worker still finalizes usage; Build credit trigger is confirm-build-apply | Split usage finalization vs credit trigger |
| 7 | `PRODUCTION-DEPLOYMENT-ARCHITECTURE.md` “HTTP-only communication” | GOV-ARCH-01 mixed transport | Mixed HTTP/BullMQ/Pub/Sub/WS | ARCHITECTURE.md mixed transport wins. Production doc is superseded on that claim |
| 8 | Production doc AI Service port 4001 | ARCHITECTURE.md port 4099 | Unknown without source/compose/PM2 inspection | **F** — Step 2 must read actual listen port |
| 9 | EXTERNAL-MONITORING “No background workers, no cron, no event bus” | GOV-ARCH-01 | BullMQ worker + Redis Pub/Sub exist; no cron | Monitoring endpoints may still be CURRENT; the constraint sentence is superseded |
| 10 | BILLING-READY-01A “no credit ledger exists” | BILLING-READY-03..08 | Persistent ledger exists | 01A findings historical |
| 11 | AGENT-KNOWLEDGE-00 / AGENT-COLLAB-00 file headers “ACTIVE — planning pass” | Their checkpoints COMPLETE AND LOCKED 2026-07-06 | Plans locked; runtimes not built | Treat checkpoints as status; plans as FUTURE HOW |
| 12 | AGENT-HARNESS-V1-MASTER-PLAN.md header “ACTIVE planning output” | AGENT-HARNESS-00 checkpoint LOCKED; later harness slices LOCKED | Plan historical; implementation progressed | Master plan = approved target + stale baseline. Do not treat as current |
| 13 | AINOW-EXECUTION-ROADMAP “product architecture governed by Platform-00” | GOV-OS-01 demotion; PRD/ARCHITECTURE domain split | PRD=WHAT, ARCHITECTURE=HOW | Roadmap body sentence is superseded |
| 14 | ARCHITECTURE §13 “OrchestrationService skeleton” | 07C in-memory coordinator with safety limits | Code exists; not a user-facing multi-agent product; not persisted | Step 2 must describe CURRENT in-memory coordinator vs FUTURE durable orchestration without claiming multi-agent is live |
| 15 | LIVE-08 frozen artifact `e2e-auto.html` | PREVIEW-STRATEGY-01A + 03L `index.html` | Static preview requires `index.html` | Product HOW = `index.html`. LIVE-08 remains historical FAIL |
| 16 | Idle timeout “in-memory” (ARCHITECTURE §5) vs any later watchdog | Unknown later session-governance changes | Unverified | **F** — Step 2 inspect session idle enforcement |
| 17 | CREATE-01A “migration not executed” | Later staging migrations (STAGING-04E and successors) | User-created agents exist in product; live migration status needs confirm | **F** — Step 2 confirm `user_agents` migration applied |
| 18 | PRD/ARCHITECTURE 2026-08-10 vs post-03D accounting product meaning | 03D + GO/NO-GO | Users are charged for qualifying Build apply, not mere provider completion | HOW → GOV-ARCH-02. WHAT (when the user is charged) → GOV-PRD-02 |

---

## 8. Known `ARCHITECTURE.md` drift areas

Major gap areas for Step 2 (documentation drift, not implementation work):

1. **Credit / Build accounting path** — delayed deduction, intent split, confirm-build-apply, idempotency (`sourceEventId`), `BILLING_CHARGES_ENABLED`
2. **Public vs internal API surface** — confirm-build-apply public Gateway route; Create Agent `/api/agents`; health/ready/metrics
3. **Staging / Caddy / PM2 / compose split** — public routing; app processes not in compose; logical vs deployment topology
4. **Preview strategy** — subdirectory `index.html`; PreviewStrategyResolver; not only proxy
5. **Git checkpoint / revert HOW** — container Git, ledger, `safe.directory`, revert restore surfaces
6. **File-action / AUTO_APPLY / coherence pipeline** — more than “frontend applies actions”
7. **Agent identity propagation** — AGENT-PLATFORM-06 fields vs CURRENT single-Builder
8. **Orchestration coordinator CURRENT vs FUTURE** — 07A–07C in-memory facts vs durable/multi-agent runtime
9. **Create Agent persistence/API** vs non-executable runtime
10. **Auth boundary** — platform cookies/CSRF vs generated-app isolation; OAuth deferred
11. **Provider routing / model attribution**
12. **Monitoring / watchdog / health** — Prometheus/Grafana/external poll; idle-timeout mechanism
13. **CURRENT vs PLANNED labels** after GO/NO-GO (Harness disabled for beta; multi-agent not operational)
14. **Port / listen-address conflicts** (AI Service 4099 vs 4001)
15. **Ask vs Build execution intents** as architecture, not product copy

GOV-ARCH-01 residual uncertainties still open:

- container-manager PostgreSQL access (document currently says none)
- AI Service HTTP surface beyond health
- exact staging host specs (should stay out of ARCHITECTURE.md logical HOW)

---

## 9. Items explicitly deferred to GOV-PRD-02

Do **not** fix these in GOV-ARCH-02. Record only.

- Any product-WHAT restatement of Ask vs Build, when credits are “spent” in user language, or billing UX copy
- RPG identity / command-center product promise vs original RPG simulation vision
- Coming-soon agent product promises and when they become real agents
- Multi-agent collaboration as a user-facing product capability
- Knowledge base as a user-facing product
- Harness as a user-facing beta promise (operational gating stays HOW)
- Invitation cohort, support channel, Google OAuth product activation, Stripe product activation
- Public launch / broader rollout language
- Planned Goals in `PRD.md` that are not architecture-approved HOW
- GO/NO-GO accepted limitations that are product-scope, not system topology
- UX-IA-00 remaining product IA

GOV-PRD-02 remains **unregistered**.

---

## 10. Step 2 architecture-gap inventory scope

Step 2 is read-only evidence inventory. It must not edit `ARCHITECTURE.md`.

In scope:

1. Walk every §5.2 implemented-not-reflected item against current source (not only checkpoints)
2. Walk every §7 conflict and assign CURRENT vs FUTURE vs SUPERSEDED
3. Produce a section-by-section gap list against `ARCHITECTURE.md` TOC §§1–16
4. Cover these subsystems where evidence exists:
   - ainow.biz platform structure
   - Builder Agent architecture
   - agent registry / agent identity
   - Create Agent persistence/model
   - multi-Builder topology
   - orchestration/coordinator layer
   - shared vs specialist knowledge
   - collaboration/referral/work-object architecture
   - approval gates / loop prevention
   - Builder Harness architecture
   - execution modes (single-shot vs Harness)
   - project/session/container lifecycle
   - file-action/checkpoint/revert
   - provider routing/model attribution
   - credit deduction
   - auth boundary
   - staging/runtime service topology
   - gateway / AI service / container-manager
   - Redis/Postgres relationships
   - monitoring/watchdog
   - RPG/dashboard shell only where technically architectural
   - future integrations only if architecture-approved
5. Resolve **F** items by source inspection: AI listen port; idle timeout mechanism; `user_agents` migration applied; whether Next.js confirm proxy is still in the live path; how much 07C coordinator is reachable vs dormant
6. Produce the Step 3 edit plan: what CURRENT text to add/correct; what FUTURE text to add as clearly labeled PLANNED; what must not be claimed
7. Hand remaining WHAT drift to GOV-PRD-02 in the Step 2 artifact

Out of Step 2: implementation, refactor, runtime, PRD edits, invitation, successor registration.

---

## 11. Explicit exclusions

GOV-ARCH-02 (entire lifecycle) does **not**:

- implement product features
- refactor application source
- mutate runtime, Docker, PostgreSQL, Redis, staging, PM2, Caddy
- run migrations
- change dependencies
- call providers
- mutate credits
- invite users or define a support channel
- register GOV-PRD-02
- register the 2-source-lane pilot
- register or start PRIVATE-BETA-INVITE-01
- mutate Development OS semantics in `CLAUDE.md` / `AGENTS.md` except as forbidden (this lifecycle does not edit them)
- rewrite Platform-00 or roadmap bodies
- promote speculative product ideas into `ARCHITECTURE.md`

Step 1 additionally does **not** edit `ARCHITECTURE.md` or `PRD.md`.

Step 3 may modify only:

- `ARCHITECTURE.md`
- governance/checkpoint documents for this lifecycle

---

## 12. Invitation remains parked

```
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED=NO
FRESH_KEITH_INVITATION_AUTHORIZATION=STILL REQUIRED
```

This task is not invitation work.

---

## 13. Frozen lifecycle / admission metadata

| Field | Value |
|-------|-------|
| Task ID | GOV-ARCH-02 |
| Workstream | GOVERNANCE (label only) |
| Lifecycle | 4-step GOVERNANCE |
| Start condition | READY — PRIVATE-BETA-GO-NO-GO-01 COMPLETE AND LOCKED — GO — 2026-08-23; GOV-OS-01 successor sequence; lanes empty; no OS-mutation conflict |
| Depends on | GOV-OS-01 LOCKED; fresh post-03J E2E completed by LIVE-11 PASS; PRIVATE-BETA-GO-NO-GO-01 LOCKED GO |
| Primary write scope | Step 1: board + this registry entry + this source map. Step 3: `ARCHITECTURE.md` + governance/checkpoint docs only |
| Mutexes / resources | GOVERNANCE. All runtime resources UNOWNED |
| Hot-file leases | none |
| Shared contracts | Authority split frozen. ARCHITECTURE.md remains HOW. PRD.md remains WHAT |
| Evidence class | GOVERNANCE |
| Revert isolation | Documentation-only; reverting this lifecycle must not invalidate LIVE-11 / GO-NO-GO evidence |

Successor sequence (NOT registered beyond this task):

```
GOV-ARCH-02
→ GOV-PRD-02
→ first genuine 2-source-lane pilot
→ pilot review
→ explicit future Lane 3 decision
```

---

## 14. Step 1 activity ledger

```
LIVE = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gates = 0
runtime = 0
product = 0
frontend = 0
backend/services = 0
dependencies = 0
ARCHITECTURE.md edits = 0
PRD.md edits = 0
Git mutations = 0
```

---

*Frozen 2026-08-23 — GOV-ARCH-02 Step 1 — architecture reconciliation registered — authoritative source map frozen — CURRENT vs FUTURE separated — product-WHAT drift deferred to GOV-PRD-02 — PRIVATE-BETA-INVITE-01 remains PARKED.*
