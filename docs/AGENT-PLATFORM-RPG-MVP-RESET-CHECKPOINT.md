# AGENT-PLATFORM-RPG-MVP-RESET — Consolidation Checkpoint

**Task ID:** AGENT-PLATFORM-RPG-MVP-RESET
**Step:** 4 — Consolidation / Checkpoint / Next Implementation Recommendation
**Final Status:** COMPLETE and LOCKED — 2026-07-20
**Date:** 2026-07-20
**Nature:** Governance/checkpoint only — no source, test, translation, package, migration, entity, environment, or Docker files changed in this step.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-RPG-MVP-RESET |
| Title | RPG UX/UI and Agent Creation Beta Readiness Reset |
| Family | AGENT PLATFORM / RPG UX/UI / AGENT CREATION / BETA READINESS |
| Priority | CRITICAL |
| Nature | HIGH-RISK PRODUCT/UX ROADMAP RESET — PLANNING ONLY |
| Risk | HIGH — 4-step planning loop |
| Step 1 | COMPLETE — Registration — 2026-07-20 |
| Step 2 | COMPLETE — Discovery / Current-State Audit / Prior-Plan Recall — 2026-07-20 |
| Step 3 | COMPLETE — RPG MVP + Agent Creation Beta-Readiness Plan — 2026-07-20 |
| Step 4 | This document — Consolidation / Checkpoint / Next Implementation Recommendation — 2026-07-20 |
| Keith Approval | "go" — 2026-07-20 |
| B3 Status | Remains paused — not registered |

---

## 2. Final Status

**AGENT-PLATFORM-RPG-MVP-RESET — COMPLETE and LOCKED — 2026-07-20**

- Step 1 Registration: COMPLETE — 2026-07-20
- Step 2 Discovery / Current-State Audit / Prior-Plan Recall: COMPLETE — 2026-07-20
- Step 3 RPG MVP + Agent Creation Beta-Readiness Plan: COMPLETE — 2026-07-20
- Step 4 Consolidation / Checkpoint / Next Implementation Recommendation: COMPLETE — 2026-07-20 (this document)

This task is a planning-only task. No source, test, translation, package, migration, entity, environment, or Docker files were changed across any of the four steps. No runtime, Docker, DB, browser, API, test, build, provider, payment, Stripe CLI, webhook, git commit, or git push occurred.

Do not modify this task after locking except by explicitly approved follow-up task.

---

## 3. Why This Task Existed

BETA-READY-FULL-STACK-SMOKE (B3) was the logical next task after BETA-READY-DEPLOYMENT-CONFIG (COMPLETE and LOCKED — 2026-07-20) and AGENT-HARNESS-WRITE-CANARY (COMPLETE and LOCKED — 2026-07-20). However, B3 only proves technical full-stack readiness. The bigger blocker for private beta was product readiness:

- RPG-style UX/UI was not finished (the platform dashboard was a generic business card grid)
- Agent creation capabilities did not exist
- Public testing was likely months away if the UX/product direction remained unresolved

Keith approved pausing B3 and running this planning task to decide the correct product path before committing to B3 execution. Registration was approved 2026-07-20 with "go".

---

## 4. Workflow Summary

| Step | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Registration — task registered, 4-step HIGH-risk planning loop recorded, UX/UI rules recorded, B3 paused, Keith approval recorded | COMPLETE | 2026-07-20 |
| 2 | Discovery — prior RPG plan recalled, current implementation state audited, missing pieces identified, public/private beta timeline assessed | COMPLETE | 2026-07-20 |
| 3 | RPG MVP + Agent Creation Beta-Readiness Plan — persistence path decided (Option B), full MUST/SHOULD/CAN WAIT/DO NOT DO classification, exact implementation slices identified | COMPLETE | 2026-07-20 |
| 4 | Consolidation — checkpoint document created, TASKS.md and TASKS_BACKLOG_FULL.md updated, AINOW-EXECUTION-ROADMAP.md updated, task locked | COMPLETE | 2026-07-20 |

---

## 5. Discovery Summary (Step 2)

Document created: `docs/AGENT-PLATFORM-RPG-MVP-RESET-DISCOVERY.md`

Key findings from the discovery pass:

- **Prior RPG plan**: AGENT-PLATFORM-00 defined the RPG metaphor as an office/town navigation metaphor — not a game engine. Walking character was explicitly deferred. Pixel art was the intended visual style but the card grid was accepted as the first milestone.
- **Current platform dashboard**: A static card grid at `/[locale]/platform` — clean business card layout with no distinctive RPG visual identity. Initials-based avatars. No pixel art, no spatial metaphor realized visually.
- **Agent registry**: Static read-only registry with 4 agents (Builder Agent active; Chief of Staff, Product Strategy, Technology Advisor — all coming soon). All manifest fields defined.
- **Agent creation**: Does not exist. No Create Agent form, no detail panel, no persistence path, no DB schema.
- **Workspace redesign**: UX-IA-01 through UX-IA-32+ — ALL COMPLETE and LOCKED. The workspace is production-ready and stable.
- **AGENT-PLATFORM-02 disposition**: COMPLETE and LOCKED (2026-07-06). Superseded — new tasks build on top of it without modifying locked code.
- **UX-IA disposition**: Does not need to be resumed before RPG implementation. Platform dashboard and workspace are separate routes.
- **12 scope questions**: All answered in the discovery document.

---

## 6. Plan Summary (Step 3)

Document created: `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md`

Key decisions made in the planning pass:

- **B3 remains paused**: B3 proves technical readiness, not product readiness. The correct sequence: ship usable product surface → B3 validates end-to-end → invite beta testers.
- **RPG MVP**: Thin navigational shell — no game engine, no sprite pipeline, no walking character. Express RPG identity through visual design language and agent detail panels.
- **Agent creation persistence**: Option B — DB-backed minimal persistence. Config-only (Option A) is too fake for beta. Users expect created agents to survive refresh and login.
- **Final chosen path**: Five ordered implementation slices (see Section 11).
- **AGENT-PLATFORM-02**: Superseded and locked. New tasks build on top of 02A/02B components without touching locked code.
- **UX-IA family**: Does not need to be resumed. All complete. Platform link from workspace is addressed in RPG-03B slice.

---

## 7. Current Product Conclusion

The ainow.biz platform has strong backend infrastructure:

- Full billing/credit system (BILLING-READY-00 through BILLING-READY-07) — COMPLETE and LOCKED
- Full deployment configuration (BETA-READY-DEPLOYMENT-CONFIG) — COMPLETE and LOCKED
- Agent harness with verified read+write canary (AGENT-HARNESS-WRITE-CANARY) — COMPLETE and LOCKED
- Multi-builder orchestration contracts (AGENT-PLATFORM-04 through AGENT-PLATFORM-07F) — COMPLETE and LOCKED

The platform has a weak product surface:

- The `/[locale]/platform` dashboard is a generic business card grid with no RPG visual identity
- No agent detail panel exists
- No agent creation capability exists
- Created agents cannot persist anywhere
- The platform is not discoverable enough from the workspace

**Verdict:** The backend is beta-ready. The product UX is not. The gap is purely frontend (2 UX slices) plus one minimal backend slice (agent persistence). These are bounded, achievable tasks.

---

## 8. Beta Path Decision

**B3 full-stack smoke remains paused.**

B3 proves technical readiness only — not product readiness. Running B3 with the current generic card-grid dashboard would validate infrastructure for a product surface that is not useful to beta testers.

Correct sequence:
1. Ship usable product surface (Slices 1–4)
2. B3 proves it works end-to-end
3. Invite private beta testers

B3 infrastructure requirements (H2–H9) are Keith-only deployment steps that can proceed in parallel with UX implementation.

---

## 9. Public/Private Beta Timeline Assessment

| Milestone | Estimated Timeline | Rationale |
|-----------|-------------------|-----------|
| Private beta (limited invited users) | 3–6 weeks from 2026-07-20 | Requires thin RPG MVP + minimal agent creation + B3 PASS |
| Public testing (open access) | 2–4 months minimum | Requires real deployment, Stripe live integration, broader UX polish, onboarding flow, documentation |

Key insight: Private beta is achievable in weeks with thin, focused slices. Public testing remains months away due to payment/onboarding/infrastructure requirements that are correctly deferred.

---

## 10. RPG MVP Decision

**RPG MVP is a thin navigational shell, not a game engine or full game-like world.**

Evidence:
- AGENT-PLATFORM-00 master plan explicitly defined RPG as a "navigation/spatial metaphor, not a game engine"
- Walking character was explicitly deferred in the original plan
- The card grid implementation was accepted as COMPLETE in AGENT-PLATFORM-02
- The product value for beta is: distinctive identity + agent detail panel + agent creation — not gameplay

Decisions:
- Walking character: waits until after private beta
- Pixel-art map/environment: waits until after private beta
- Game engine dependency: DO NOT DO before beta
- RPG identity is expressed through: visual design language (command-center feel), agent detail panels, status messaging, visual hierarchy

---

## 11. Agent Creation Persistence Decision

**Option B — DB-Backed Minimal Persistence — SELECTED**

Option A (config-only) was rejected because:
- Config-only creation is too fake for beta. Created agents disappear after refresh/login.
- Would require re-implementation to DB later — wasted effort.

Option B is correct because:
- The API Gateway already uses TypeORM with 30+ entities — one more is a well-understood pattern
- The risk is bounded: minimal fields, no complex relations, no tool/knowledge/skill config
- Users expect created agents to persist across sessions and devices

Minimal DB schema (planning reference):
```
user_agents
├── id (uuid, PK)
├── userId (uuid, FK → users.id)
├── name (varchar 100, NOT NULL)
├── role (varchar 200, NOT NULL)
├── description (text, NOT NULL)
├── status ('active' | 'coming_soon' | 'disabled', DEFAULT 'coming_soon')
├── initials (varchar 4)
├── createdAt (timestamp)
├── updatedAt (timestamp)
└── deletedAt (timestamp, nullable — soft delete)
```

Fields deferred from MVP: toolPermissions, knowledgeScopes, skills, referralRules, approvalRules, spriteRef, modelProfile.

---

## 12. MUST Before Private Beta

| # | Item | Slice |
|---|------|-------|
| 1 | Platform dashboard visual refresh — distinctive command-center identity | RPG-03A |
| 2 | RPG command-center visual identity (design language, not game engine) | RPG-03A |
| 3 | Agent detail panel (click-through from card to see capabilities + CTA) | RPG-03A |
| 4 | Builder Agent "Start Building" CTA in detail panel | RPG-03A |
| 5 | Coming-soon placeholder agents with improved messaging in detail panel | RPG-03A |
| 6 | Create agent form (name, role, description, status) | CREATE-01B |
| 7 | Created agents visible on dashboard | CREATE-01B |
| 8 | DB-backed agent persistence (minimal fields) | CREATE-01A |
| 9 | Dynamic registry lookup layer (merge static + user-created agents) | CREATE-01A + CREATE-01B |
| 10 | Agent avatar/initials for created agents | CREATE-01B |
| 11 | Agent status display for created agents | CREATE-01B |
| 12 | Multilingual copy for all new UI text | All slices |
| 13 | Heroicons v2 Outline icons for all new icons | All slices |
| 14 | Local full-stack smoke OR staging/production B3 smoke | BETA-READY-*-SMOKE |

---

## 13. SHOULD Before Private Beta

| # | Item | Rationale |
|---|------|-----------|
| 1 | Platform link from workspace home view | Makes platform discoverable |
| 2 | Auth guard review on `/[locale]/platform` | Verify route is properly protected |
| 3 | User ownership / tenant scoping for created agents | Only see your own agents |
| 4 | Mobile responsive layout for platform dashboard | Beta testers may use phones |
| 5 | Animation/motion polish (subtle, restrained — not gameplay) | Better perceived quality |

---

## 14. CAN Wait Until After Private Beta

| # | Item | Rationale |
|---|------|-----------|
| 1 | Walking character | Explicitly deferred since AGENT-PLATFORM-00 |
| 2 | Pixel-art map/environment | Visual upgrade, not functional requirement |
| 3 | Sprite sheet production | Requires art assets and time |
| 4 | Tool permission config in agent creation | Complex — MVP has no tool config |
| 5 | Knowledge scope config in agent creation | Requires knowledge infrastructure |
| 6 | Skills config in agent creation | Requires skill infrastructure |
| 7 | Referral rules config in agent creation | Requires collaboration infrastructure |
| 8 | Approval rules config in agent creation | Requires approval infrastructure |
| 9 | Agent-to-agent collaboration UI | Backend orchestration exists; UI can wait |
| 10 | Agent edit/update/delete flows | Can iterate after create works |
| 11 | Staging/production B3 smoke (if local smoke is done first) | Can validate locally first |

---

## 15. DO NOT DO Before Beta

| # | Item | Rationale |
|---|------|-----------|
| 1 | Game engine dependency (Phaser, PixiJS, Three.js, Canvas) | Not an RPG game; navigation metaphor only |
| 2 | Full sprite sheet production pipeline | Art production is months of work |
| 3 | Walking character movement system | Explicitly deferred; post-beta UX milestone |
| 4 | Real-time agent activity display | Requires backend event streaming; future |
| 5 | Agent-to-agent collaboration runtime UI | Backend foundation exists; UI is premature |
| 6 | Multi-room/zone navigation system | Game-like feature; not needed for beta |
| 7 | Complex animation system | Not needed for card-based UI |
| 8 | Agent avatar image upload | Initials-based is sufficient for MVP |

---

## 16. Thin RPG MVP Scope

The thin RPG MVP transforms the current generic card grid into a distinctive command-center experience without building a game.

**Visual Identity (Slice RPG-03A)**:
- Header: Enhanced with stronger branding — command-center terminology, darker/more purposeful visual treatment
- Card layout: Builder Agent card visually elevated vs. coming-soon cards muted/secondary
- Agent detail panel: Side drawer or modal triggered by clicking any agent card
  - Shows: name, role, full description, capabilities from manifest, status
  - Builder Agent: prominent "Start Building" CTA → navigates to `/[locale]/app`
  - Coming-soon agents: expanded context about what the agent will do
- Visual hierarchy: Clear distinction between active/callable and placeholder agents
- Iconography: Heroicons v2 Outline only

**What makes it "RPG-like" without a game engine**:
- Command-center naming and visual language
- Agent cards as "stations" with status indicators
- Detail panel as "agent profile" with capability list
- Dashboard header evoking a team command room, not a generic business SaaS
- Restrained color and type treatment that feels purposeful and branded

**What it explicitly is NOT**:
- Not a spatial map
- Not animated sprites
- Not a walking character
- Not a game loop
- Not a canvas/WebGL rendering surface
- Not a game engine dependency

---

## 17. Minimal Agent Creation MVP Scope

**Backend Persistence (Slice CREATE-01A)**:
- New TypeORM entity: `UserAgent` — minimal fields
- New migration: `CreateUserAgentsTable`
- New repository: `UserAgentRepository`
- New NestJS module: `UserAgentModule`
- New controller: `POST /api/agents`, `GET /api/agents`, `GET /api/agents/:id`
- Input validation via class-validator DTOs
- User ownership enforced (userId from auth context)
- Soft delete support
- Unit tests
- No tool permissions, knowledge, skills, referral, approval config

**Frontend UI (Slice CREATE-01B)**:
- "Create Agent" button on platform dashboard
- Create Agent form: name, role, description, status
- Initials auto-computed from name (reuses existing pattern)
- API integration: `POST /api/agents`, `GET /api/agents`
- Created agents rendered on dashboard using existing `AgentStationCard`
- Dynamic merge: static registry agents + user-created agents displayed together
- Loading, error, empty states
- All text multilingual via `agentCreate.*` namespace in all 3 locales
- Heroicons v2 Outline only
- Tests for form, API integration, display

---

## 18. AGENT-PLATFORM-02 Disposition

**AGENT-PLATFORM-02 is COMPLETE and LOCKED (2026-07-06). It is superseded, not modified.**

The 02A/02B implementation (card grid, navigation, coming-soon interactions, tests) is correct and functional. All 11 tests pass. It will NOT be modified or reopened.

New work builds ON TOP of the existing `PlatformDashboard` and `AgentStationCard` components — adding visual identity and an agent detail panel as new features/components rather than changing locked code.

If a bug is found in the 02A/02B implementation, it would require a separately approved fix task.

---

## 19. UX-IA Disposition

**The UX-IA family is substantially complete and does NOT need to be resumed before RPG implementation.**

- UX-IA-01 through UX-IA-32: ALL COMPLETE and LOCKED
- UX-PV-01, UX-PV-02A, UX-PV-02B: ALL COMPLETE and LOCKED
- The workspace redesign (`/[locale]/app`) is stable and production-ready

The platform dashboard (`/[locale]/platform`) is a separate route. Work on it does not require resuming any UX-IA tasks.

The workspace-to-platform link gap is addressed in Slice RPG-03B without reopening the UX-IA family.

---

## 20. Recommended Implementation Sequence

In priority order — the smallest set of bounded slices that transforms the platform into a usable, distinctive, agent-creation-capable product surface suitable for private beta:

| # | Task ID | Nature | Risk | Backend Required |
|---|---------|--------|------|-----------------|
| 1 | AGENT-PLATFORM-RPG-03A | Platform Dashboard Visual Identity + Agent Detail Panel | Medium | NO |
| 2 | AGENT-PLATFORM-RPG-03B | Platform Link from Workspace + Auth Guard Review | Low | NO |
| 3 | AGENT-PLATFORM-CREATE-01A | Create Agent Backend Minimal Persistence | Medium | YES — this IS the backend slice |
| 4 | AGENT-PLATFORM-CREATE-01B | Create Agent MVP UI | Medium | Uses API from 01A |
| 5 | BETA-READY-SMOKE | Local or staging full-stack smoke | High | Requires Keith infra (H2–H9) + Keith approval |

**Registration of AGENT-PLATFORM-RPG-03A requires Keith explicit approval as the next distinct task.**

---

## 21. B3 Timing Recommendation

**B3 should not be registered until after Slices 1–4 are complete.**

| Condition | Status |
|-----------|--------|
| RPG visual identity shipped | Pending — Slice 1 |
| Agent detail panel shipped | Pending — Slice 1 |
| Platform link from workspace | Pending — Slice 2 |
| Agent creation backend | Pending — Slice 3 |
| Agent creation UI | Pending — Slice 4 |
| Keith infra (H2–H9) | Pending — Keith-only steps |
| Keith explicit B3 approval | Pending |

Estimated B3 readiness: 3–5 weeks from 2026-07-20, assuming each slice takes 2–4 days of focused implementation and no major blockers.

Sequence:
1. Slices 1–4 complete → product surface is beta-worthy
2. Local smoke validates integration
3. Keith completes H2–H9 → staging provisioned
4. Keith approves B3 registration → B3 executes on staging
5. B3 PASS → invite private beta testers

---

## 22. Risks and Unknowns

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agent creation requires dynamic registry merge — current registry is static `const` | MEDIUM | CREATE-01B implements merge layer: dashboard combines static registry agents + API-returned user agents |
| Auth guard on `/[locale]/platform` may not be enforced | MEDIUM | RPG-03B explicitly reviews this; fix if unguarded |
| Agent detail panel design may need iteration after first implementation | LOW | First pass delivers functional panel; visual polish can follow in a micro-slice if needed |
| DB migration for `user_agents` must not conflict with existing 24 migrations | LOW | TypeORM migration ordering is timestamp-based; no conflict expected |
| Keith infra steps (H2–H9) may take longer than code work | MEDIUM | Cannot control; product work proceeds in parallel |
| User-created agents may need a route field or default behavior when clicked | LOW | MVP: clicking a user-created agent opens detail panel only; no route navigation for custom agents in MVP |
| Translation quality for zh-TW/zh-CN may need human review | LOW | Acceptable for private beta; can refine based on feedback |

---

## 23. Acceptance Criteria Disposition

### Step 1 — Registration

- [x] AGENT-PLATFORM-RPG-MVP-RESET added to TASKS_BACKLOG_FULL.md.
- [x] AGENT-PLATFORM-RPG-MVP-RESET activated in TASKS.md.
- [x] BETA-READY-DEPLOYMENT-CONFIG remains COMPLETE and LOCKED.
- [x] AGENT-HARNESS-WRITE-CANARY remains COMPLETE and LOCKED.
- [x] B3 remains unregistered / pending.
- [x] Scope limited to RPG UX/UI + agent creation readiness planning.
- [x] 4-step HIGH-risk planning workflow recorded.
- [x] Multilingual-first UX/UI rule recorded.
- [x] Heroicons v2 Outline rule recorded.
- [x] Impeccable and Emil Kowalski advisory skills recorded.
- [x] No implementation during registration.
- [x] No source/test/translation/package/migration/entity/environment/Docker files changed.
- [x] No runtime, Docker, DB, browser, API, test, build, provider, payment, Stripe CLI, webhook, git commit, or git push occurred.
- [x] No secret-bearing environment file opened.
- [x] No subagents used.
- [x] AINOW-EXECUTION-ROADMAP.md updated (entry #25 added).

### Step 2 — Discovery

- [x] UX-IA-00, UX-IA-01, UX-IA-02 checkpoints reviewed.
- [x] AGENT-PLATFORM-00, AGENT-PLATFORM-01, AGENT-PLATFORM-02 checkpoints reviewed.
- [x] Current RPG UX/UI implementation state assessed.
- [x] Current agent creation implementation state assessed.
- [x] Missing pieces identified.
- [x] Prior planned but unimplemented features identified.
- [x] Public testing timeline assessed.
- [x] Discovery summary prepared — `docs/AGENT-PLATFORM-RPG-MVP-RESET-DISCOVERY.md` created.

### Step 3 — RPG MVP + Agent Creation Beta-Readiness Plan

- [x] Candidate MVP direction evaluated (items 1–12 from registration scope).
- [x] Required-before-private-beta items identified.
- [x] Can-wait-until-after-private-beta items identified.
- [x] AGENT-PLATFORM-02 resume/revise/supersede decision recorded — superseded.
- [x] UX-IA task resume decision recorded — no resume needed.
- [x] Exact next implementation slices identified (5 slices).
- [x] B3 timing recommendation recorded — after Slices 1–4.
- [x] Beta-readiness plan prepared — `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` created.

### Step 4 — Consolidation / Checkpoint / Next Implementation Task Recommendation

- [x] Checkpoint document created — `docs/AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md` (this document).
- [x] TASKS.md updated — Steps 2/3/4 marked complete, task marked COMPLETE and LOCKED.
- [x] TASKS_BACKLOG_FULL.md updated — mirrored.
- [x] AINOW-EXECUTION-ROADMAP.md updated — entry #25 updated, Section 4 updated.
- [x] Next implementation task identified and recommended — AGENT-PLATFORM-RPG-03A.
- [x] No source/test/translation/package/migration/entity/environment/Docker files changed.
- [x] No secrets opened.
- [x] No subagents used.
- [x] No git commit or push.

---

## 24. Locked-State Instruction

**AGENT-PLATFORM-RPG-MVP-RESET is COMPLETE and LOCKED — 2026-07-20.**

Do not modify any step, acceptance criterion, or decision recorded in this task after locking.

If a correction is needed, register a new explicitly approved follow-up task and reference this checkpoint.

Registration of AGENT-PLATFORM-RPG-03A is the next action and requires Keith explicit approval as a distinct registration step.

---

## 25. Safety Confirmations

- [x] No source files were modified during any step of this task.
- [x] No test files were modified.
- [x] No translation files were modified (only governance/docs files).
- [x] No package files were modified.
- [x] No migration/entity/schema files were modified.
- [x] No environment files were opened.
- [x] No Docker commands were run.
- [x] No database was queried or mutated.
- [x] No runtime was started.
- [x] No browser was opened.
- [x] No API calls were made.
- [x] No build or test commands were run.
- [x] No git commit or push was performed.
- [x] No new task (AGENT-PLATFORM-RPG-03A, B3, or otherwise) was registered.
- [x] No subagents were used.
- [x] No secret-bearing environment file was opened.
- [x] All locked tasks remain locked and unmodified.
- [x] AGENT-PLATFORM-02 (and 02A, 02B) remain COMPLETE and LOCKED.
- [x] BETA-READY-DEPLOYMENT-CONFIG remains COMPLETE and LOCKED.
- [x] AGENT-HARNESS-WRITE-CANARY remains COMPLETE and LOCKED.
- [x] Only four files were changed in this Step 4 consolidation: TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md, and this checkpoint document.

---

## 26. Exact Next Action

**Register AGENT-PLATFORM-RPG-03A — Platform Dashboard Visual Identity + Agent Detail Panel.**

This is the first implementation slice. Registration must:
- Be explicitly approved by Keith
- Reference this checkpoint as the planning authority
- Scope from `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` Section 22, Slice 1
- Use a 3-step implementation loop (medium risk)
- Enforce multilingual-first and Heroicons v2 Outline constraints
- Specify no backend requirement
- Reference advisory UX/UI skills (Impeccable + Emil Kowalski for component polish guidance)

B3 registration remains blocked until Slices 1–4 of the chosen path are complete and Keith explicitly approves B3 registration.
