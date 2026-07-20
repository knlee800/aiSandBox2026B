# AGENT-PLATFORM-RPG-MVP-RESET — Step 2 Discovery Document

**Task:** AGENT-PLATFORM-RPG-MVP-RESET — RPG UX/UI and Agent Creation Beta Readiness Reset
**Step:** 2 — Discovery / Current-State Audit / Prior-Plan Recall
**Status:** COMPLETE (discovery only — no implementation)
**Date:** 2026-07-20
**Author:** Discovery pass — read-only audit

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-RPG-MVP-RESET |
| Title | RPG UX/UI and Agent Creation Beta Readiness Reset |
| Family | AGENT PLATFORM / RPG UX/UI / AGENT CREATION / BETA READINESS |
| Priority | CRITICAL |
| Nature | HIGH-RISK PRODUCT/UX ROADMAP RESET — PLANNING ONLY |
| Step | 2 — Discovery / Current-State Audit / Prior-Plan Recall |
| Step 1 Status | COMPLETE (Registration — 2026-07-20) |
| Keith Approval | "go" — 2026-07-20 |

---

## 2. Discovery Purpose

This document records the current-state audit and prior-plan recall for AGENT-PLATFORM-RPG-MVP-RESET Step 2. It answers the 12 registered scope questions, assesses what is built vs. missing, and recommends the exact path forward before B3 (pre-beta full-stack smoke) is registered.

No implementation was performed. No files were modified.

---

## 3. Required Files Read

| File | Status |
|------|--------|
| `TASKS.md` | Read — relevant sections grep-extracted (file too large to read in full) |
| `TASKS_BACKLOG_FULL.md` | Read — relevant sections grep-extracted (file too large to read in full) |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Read — §1–§10 including full strategic sequence through #25 |
| `docs/AGENT-PLATFORM-00-CHECKPOINT.md` | Read — full |
| `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | Read — full |
| `docs/UX-IA-00-MASTER-PLAN.md` | Read — full |
| `docs/UX-IA-01-CHECKPOINT.md` | Read — full |
| `docs/UX-IA-02-CHECKPOINT.md` | Read — full |
| `docs/BETA-READY-DEPLOYMENT-CONFIG-CHECKPOINT.md` | Read — §1–§4 confirmed |
| `frontend/lib/agent-platform/agent-registry.ts` | Read — full |
| `frontend/components/platform/agent-station-card.tsx` | Read — full |
| `frontend/components/platform/platform-dashboard.tsx` | Read — full |
| `frontend/app/[locale]/platform/page.tsx` | Read — full |
| `frontend/messages/en.json` | Read — agents and platform namespaces confirmed |

---

## 4. Optional Docs Found / Missing

| Document | Status |
|----------|--------|
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | **FOUND** — exists |
| `docs/AGENT-PLATFORM-02-CHECKPOINT.md` | **NOT FOUND** (split into 02A + 02B) |
| `docs/AGENT-PLATFORM-02A-CHECKPOINT.md` | **FOUND** — read in full |
| `docs/AGENT-PLATFORM-02B-CHECKPOINT.md` | **FOUND** — read in full |
| `docs/UX-IA-03-CHECKPOINT.md` | **FOUND** — exists (UX-IA-03 COMPLETE and LOCKED) |
| Any `RPG*` docs | **NOT FOUND** — none exist |
| Any `AGENT*DASHBOARD*` docs | **NOT FOUND** — none exist |
| Any `UX-IA-03*` docs | Found `UX-IA-03-CHECKPOINT.md` only |

**UX-IA family status (from TASKS.md grep):** UX-IA-04 through UX-IA-32 are ALL COMPLETE and LOCKED. UX-PV-01, UX-PV-02A, and UX-PV-02B are COMPLETE and LOCKED. The UX-IA family has substantially completed the full workspace redesign roadmap originally specified in UX-IA-00.

---

## 5. Prior RPG UX/UI Plan Recalled

### From AGENT-PLATFORM-00 (2026-07-04):

**RPG dashboard concept** (§13 of AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md):

- **First UX milestone**: static RPG office/town dashboard shell (AGENT-PLATFORM-02)
- **Visual style**: RPG office/town hybrid, pixel art style, clean modern surrounding layout
- **First milestone elements**:
  - Dashboard layout
  - Agent positions on dashboard map
  - Static pixel art avatars
  - Status badges
  - Agent click/tap navigation
  - Coming-soon overlay for placeholder agents
  - Responsive behavior
- **Explicitly deferred** for later phases:
  - Walking character (user character moving through office/town)
  - Real-time agent activity
  - Animated RPG interactions
  - Environment interaction
  - Full interactive map/gameplay

**Key clarification in AGENT-PLATFORM-00:**
> "Walking character is deferred. The character walking around the office/town is a later UX milestone, not in the first static dashboard shell."

### What "RPG" meant in the plan:

The RPG metaphor was defined as an **office/town navigation metaphor**, not a game engine. The visual intent was: users see their AI team arranged in a space, click on agents to interact with them, and the spatial layout evokes a workplace the user inhabits. The plan explicitly chose NOT to build a game engine (Phaser, PixiJS, Canvas, Three.js).

### From UX-IA-00 (2026-05-05):

The UX-IA family designed the workspace redesign independently of the RPG platform dashboard. The workspace (`/[locale]/app`) and the platform dashboard (`/[locale]/platform`) are separate routes.

---

## 6. Prior Agent Creation Plan Recalled

### From AGENT-PLATFORM-00 master plan:

**Agent creation target capabilities** (from registered scope in TASKS.md):
- name
- role
- description
- avatar/sprite
- model profile
- tool permissions
- knowledge scopes
- skills
- referral rules
- approval rules
- enabled/disabled status

**All agent manifest fields are already defined** in `agent-registry.ts`:
- `id`, `nameKey`, `roleKey`, `descriptionKey`, `route`, `avatarRef`, `spriteRef`
- `status`, `enabled`
- `modelProfile` (AgentModelProfile)
- `toolPermissions` (AgentToolPermissions)
- `knowledgeScopes[]`, `skills[]`, `referralRules[]`, `approvalRules[]`
- `manifestVersion`

**Registry model**: declared as static, read-only at runtime. Agent registration was intended as a deployment/configuration concern.

**No persistence model** for user-created agents was planned in AGENT-PLATFORM-00 or AGENT-PLATFORM-01.

---

## 7. Current Implemented State

### Agent Registry (AGENT-PLATFORM-01 — COMPLETE and LOCKED 2026-07-04):

| Item | Status |
|------|--------|
| `frontend/lib/agent-platform/agent-registry.ts` | Exists — full TypeScript implementation |
| 4 agent manifests | Exists — builder (active), chief-of-staff (coming_soon), product-strategy (coming_soon), technology-advisor (coming_soon) |
| `listAgents()`, `getAgentById()`, `listEnabledAgents()`, `listAgentsByStatus()` | Implemented |
| i18n keys: `agents.builder.*`, `agents.chiefOfStaff.*`, etc. | In all 3 locale files |
| Tests | 9/9 PASS |

### Platform Dashboard (AGENT-PLATFORM-02A + 02B — COMPLETE and LOCKED 2026-07-06):

| Item | Status |
|------|--------|
| Route: `/[locale]/platform` | Exists — `frontend/app/[locale]/platform/page.tsx` |
| `PlatformDashboard` component | Exists — `frontend/components/platform/platform-dashboard.tsx` |
| `AgentStationCard` component | Exists — `frontend/components/platform/agent-station-card.tsx` |
| Builder Agent card → navigates to `/[locale]/app` | Implemented |
| Coming-soon agents → inline message on click | Implemented |
| Back to Workspace link in header | Implemented |
| "Command Center" sidebar nav link in WorkspaceSidebar | Implemented |
| i18n keys: `platform.title`, `platform.subtitle`, etc. (7 keys) | In all 3 locale files |
| Tests | 11/11 PASS |

### What the current platform dashboard actually looks like:

- **Visual style**: Clean business card grid — white cards, gray borders, indigo accents
- **Agent avatar**: Initials-based (e.g., "BA" for Builder Agent) — NO pixel art, NO sprite images
- **Header**: "Command Center" / "Your AI agent team at a glance" — NO RPG visual elements
- **Layout**: Responsive card grid — 1 column → 2 columns → 4 columns
- **Navigation**: `BuildingOffice2Icon` (Heroicons) in sidebar + Back to Workspace link
- **RPG metaphor**: Present ONLY as a naming/navigation metaphor — no visual RPG elements implemented

### Workspace Redesign (UX-IA family — UX-IA-04 through UX-IA-32+ — COMPLETE and LOCKED):

| Area | Status |
|------|--------|
| Workspace sidebar + view state | COMPLETE — UX-IA-04 |
| Home view chatbox / prompt-to-project | COMPLETE — UX-IA-04B |
| Projects grid/list + recent projects | COMPLETE — UX-IA-05 |
| Templates/community view | COMPLETE — UX-IA-06 |
| Account menu + language/theme | COMPLETE — UX-IA-07 |
| Project mode shell + tab system | COMPLETE — UX-IA-08 |
| AI chat + history panel in project mode | COMPLETE — UX-IA-09 |
| Preview + Code & Files tabs | COMPLETE — UX-IA-10 |
| Future tab placeholders | COMPLETE — UX-IA-11 |
| Upgrade/dashboard polish | COMPLETE — UX-IA-12 |
| Responsive/mobile | COMPLETE — UX-IA-13 |
| Route cleanup/redirects | COMPLETE — UX-IA-14 |
| Visual edit mode (UX-IA-15–17) | COMPLETE |
| Post-redesign UX fixes (UX-IA-18–32) | COMPLETE |
| Preview resilience (UX-PV-01/02A/02B) | COMPLETE |

**The workspace redesign is substantially complete and stable.**

### No Agent Creation UI exists:

| Item | Status |
|------|--------|
| Create Agent form | **DOES NOT EXIST** |
| Agent profile/detail panel | **DOES NOT EXIST** |
| Agent management page | **DOES NOT EXIST** |
| User-configurable agent persistence | **DOES NOT EXIST** |
| Any DB schema for user-created agents | **DOES NOT EXIST** |

---

## 8. Current Missing Pieces

### RPG UX/UI Missing:

| Missing Item | Priority |
|--------------|----------|
| Visual RPG identity (not just card grid) — distinctive platform look | HIGH |
| Agent profile/detail panel (click through from card) | HIGH |
| Agent ability/capability display in detail panel | MEDIUM |
| Pixel art sprites or avatars | LOW — can defer |
| Walking character | LOW — explicitly deferred |
| Office/map spatial layout | LOW — can defer |
| Animated agent states | LOW — can defer |
| RPG "room" or zone per agent | LOW — can defer |

### Agent Creation Missing:

| Missing Item | Priority |
|--------------|----------|
| Create Agent form (name, role, description, status) | HIGH |
| Agent avatar/initials display for created agents | MEDIUM |
| Persistence path for created agents | HIGH |
| Model profile selection | LOW — can defer |
| Tool permission config in creation UI | LOW — can defer |
| Knowledge scope assignment in creation UI | LOW — can defer |
| Skills assignment | LOW — can defer |
| Referral/approval rules | LOW — can defer |
| Agent edit/update UI | MEDIUM |
| Agent delete/disable UI | MEDIUM |

### Platform Integration Missing:

| Missing Item | Priority |
|--------------|----------|
| Platform dashboard linked from workspace home view | MEDIUM |
| Platform dashboard as the default landing for authenticated users (optional) | LOW |
| Builder Agent detail panel with "Start Building" CTA | HIGH |
| Platform route protection (auth guard) | MEDIUM |

---

## 9. Current UX/UI Blockers Before Private Beta

| Blocker | Classification |
|---------|---------------|
| The current "Command Center" card grid does not communicate RPG/multi-agent identity strongly enough for a beta-ready product surface | MUST before private beta |
| No agent profile detail panel — clicking Builder Agent just navigates to workspace with no context | MUST before private beta |
| No agent creation UI — placeholder agents have no creation path | MUST before private beta |
| Platform dashboard not linked from authenticated home view | SHOULD before private beta |

---

## 10. Current Agent Creation Blockers Before Private Beta

| Blocker | Classification |
|---------|---------------|
| No Create Agent form exists | MUST before private beta |
| No persistence path for custom agents (no DB schema, no API endpoint) | MUST before private beta |
| No agent detail panel | MUST before private beta |
| No agent enable/disable flow | SHOULD before private beta |

---

## 11. Private Beta Minimum Requirements

These items are the bare minimum for private beta to make sense as a product experience:

| Requirement | Rationale |
|-------------|-----------|
| **RPG platform shell with visual identity** | Without this, `/[locale]/platform` is just a generic dashboard |
| **Agent profile/detail panel** | Users must be able to understand what each agent does |
| **Builder Agent callable from platform** | Must be obvious that Builder Agent does real work |
| **Placeholder agents clearly labeled "coming soon" with intent messaging** | Already implemented — but needs better copy/context |
| **Create Agent MVP** | Defines the platform as extensible; even a thin form is required |
| **Created agents visible on platform dashboard** | Closes the loop — create → appear → status |
| **Auth-protected platform route** | Already implied by auth family but should be verified |
| **All UI text multilingual** | Already enforced by CLAUDE.md rule |

---

## 12. Post-Beta Deferrable Items

| Item | Notes |
|------|-------|
| Walking character | Explicitly deferred in AGENT-PLATFORM-00 |
| Pixel art environment/map | CAN wait — card grid is acceptable for beta |
| Complex animation | CAN wait |
| Multiple agent rooms/zones | CAN wait |
| Tool permission config in Create Agent | CAN wait — basic fields are sufficient for beta |
| Knowledge scope assignment in Create Agent | CAN wait |
| Skills / referral / approval rules in Create Agent | CAN wait |
| Agent-to-agent collaboration runtime | CAN wait — AGENT-PLATFORM-07F is backend foundation; no UI needed yet |
| Knowledge ingestion | CAN wait |
| Real multi-agent orchestration through UI | CAN wait |
| Agent edit/update history | CAN wait |
| Agent analytics | CAN wait |

---

## 13. Public Testing Timeline Assessment

**Private beta (limited users, invited only):** Potentially 3–6 weeks away if the following thin MVP is shipped:
- Platform dashboard visual refresh (1–2 slices)
- Agent detail panel (1 slice)
- Create Agent MVP (1–2 slices)
- B3 full-stack smoke (1 task — requires Keith approval)

**Public testing (open to all):** Likely 6–12 weeks away minimum:
- Requires B3 to pass
- Requires real deployment (B2 resolved at docs-only level — real deployment not yet performed)
- Requires Stripe live integration (deferred)
- Requires production infra (DNS, TLS, secrets)
- Requires authenticated user onboarding polish
- Platform UX must be substantially more complete

**Verdict:** Public testing is realistically months away. Private beta could be weeks away if the RPG MVP and agent creation MVP are thin and focused. The key unlock is: ship a small but real product surface, then invite limited beta testers.

---

## 14. Smallest Usable RPG MVP

This is the thinnest set of changes that makes the platform dashboard feel like an intentional RPG-style agent command center rather than a generic business dashboard.

### Must include:
1. **Platform dashboard visual refresh** — give the "Command Center" a more distinctive visual identity. Options:
   - Richer header with platform branding and tagline
   - Agent card visual differentiation (Builder Agent visually elevated vs. coming-soon agents)
   - Clearer "talk to this agent" affordance on Builder Agent card
   - Better coming-soon messaging on placeholder agents

2. **Agent detail panel** — when user clicks a coming-soon or active agent card:
   - Side panel or modal showing: agent name, role, description, capabilities, status
   - For Builder Agent: "Start Building" CTA that navigates to `/[locale]/app`
   - For coming-soon agents: expanded "coming soon" context with what the agent will do

3. **Multilingual-first** — all new text via i18n keys (platform.* namespace extension)

4. **Heroicons v2 Outline only** — no other icon libraries

### Can omit for MVP:
- Pixel art avatars
- Walking character
- Spatial map
- Animated states
- Room/zone layout

**Estimated effort:** 2 implementation slices (AGENT-PLATFORM-RPG-MVP-03A + 03B or equivalent)

---

## 15. Smallest Usable Agent Creation MVP

This is the thinnest Create Agent flow that makes the platform feel like an extensible platform (not just 4 hardcoded agents).

### Must include:
1. **"Create Agent" button** on platform dashboard
2. **Create Agent form** with fields:
   - Name (text input — required)
   - Role (text input — required)
   - Description (textarea — required)
   - Status: enabled / coming_soon / disabled (select — default: coming_soon)
3. **Avatar**: initials-based (already implemented in `AgentStationCard`) — no image upload needed for MVP
4. **Persistence path**: Two safe options:
   - **Option A (simplest)**: Config-only — created agents stored in a user config file or local JSON — NO DB schema needed for MVP, NO backend change
   - **Option B (preferred)**: API-backed — `POST /api/agents` with a minimal `user_agents` table — requires new DB migration and API endpoint — higher risk, proper persistence
   - **Recommendation**: Evaluate during Step 3. Option A unblocks MVP with minimal risk. Option B is correct long-term. If DB persistence is chosen, it must be a registered backend task.
5. **Created agents appear on platform dashboard** using existing `AgentStationCard` component
6. **All form text i18n** — `agentCreate.*` namespace in all 3 locale files

### Can omit for MVP:
- Model profile selection UI (use a default)
- Tool permission configuration
- Knowledge scope assignment
- Skills assignment
- Referral/approval rules
- Agent image/sprite upload
- Agent edit/update UI (deferred to next slice)
- Agent delete (deferred to next slice)

**Estimated effort:** 2–3 implementation slices depending on persistence path choice

---

## 16. AGENT-PLATFORM-02 Disposition

**AGENT-PLATFORM-02 is COMPLETE and LOCKED (2026-07-06).** It must not be modified.

The implementation delivered (AGENT-PLATFORM-02A + 02B) is:
- Correct and functional
- All tests passing
- Multilingual
- Properly integrated with the workspace sidebar

The gap is that it implemented the RPG metaphor as a card grid only — no visual RPG identity was added. This was correct for the initial milestone (static dashboard shell). A new task must build on top of it.

**Disposition: Superseded by a new task (AGENT-PLATFORM-RPG-03 or equivalent)**

The new task should:
- Build on top of the existing `PlatformDashboard` and `AgentStationCard` components
- NOT modify the locked 02A/02B implementation unless a bug fix is needed
- Add a visual identity layer and agent detail panel as new components/features
- Be registered as a new bounded implementation task after Step 4 of AGENT-PLATFORM-RPG-MVP-RESET

---

## 17. UX-IA Disposition

**The UX-IA family is substantially complete and does NOT need to be resumed first.**

Current UX-IA status:
- UX-IA-01 through UX-IA-32: ALL COMPLETE and LOCKED
- UX-PV-01, UX-PV-02A, UX-PV-02B: ALL COMPLETE and LOCKED
- The workspace redesign (`/[locale]/app`) is stable and production-ready

The platform dashboard (`/[locale]/platform`) is a separate route. Work on it does not depend on resuming UX-IA.

**One UX-IA gap exists:** The platform dashboard at `/[locale]/platform` is not yet linked from the authenticated workspace home view (`/[locale]/app`). This could be addressed either:
- As a small addition inside the next RPG MVP implementation task
- As a separate micro-slice (UX-IA-33 or equivalent) after the RPG MVP task

**Disposition: UX-IA does NOT need to be resumed. Proceed directly to AGENT-PLATFORM-RPG-MVP implementation.**

---

## 18. Recommended Next Implementation Slices

In priority order, recommended as a thin sequential path to private beta:

### Slice 1: AGENT-PLATFORM-RPG-03A — Platform Dashboard Visual Identity + Agent Detail Panel
**Nature:** Frontend UI — bounded, low-medium risk
**Scope:**
- Visual refresh of `PlatformDashboard` header and card layout — give it a distinctive "Command Center" brand feel
- Add agent detail panel (side drawer or modal) triggered when clicking any agent card
- Detail panel shows: name, role, description, capabilities list (from manifest), status, CTA
- Builder Agent detail panel: "Start Building" CTA → `/[locale]/app`
- Coming-soon detail panel: expanded context + "coming soon" message
- Extend `platform.*` i18n namespace for detail panel copy
- Heroicons v2 Outline only
- Files: `PlatformDashboard`, `AgentStationCard` (or new `AgentDetailPanel`), `platform-dashboard.test.ts`
- Update all 3 locale files

### Slice 2: AGENT-PLATFORM-RPG-03B — Platform Dashboard Link from Workspace + Auth Guard Review
**Nature:** Frontend UI — tiny, very low risk
**Scope:**
- Add "Command Center" or "AI Team" link/card to workspace Home view
- Verify `/[locale]/platform` is auth-protected (confirm middleware behavior)
- Add any needed i18n keys
- Files: `workspace-shell.tsx` or `workspace-sidebar.tsx`, translation files

### Slice 3: AGENT-PLATFORM-CREATE-01A — Create Agent Backend Persistence + API (if Option B)
**Nature:** Backend — medium risk — requires Keith approval for persistence path decision
**Scope (Option B only):**
- New DB migration: `user_agents` table
- New entity: `UserAgent`
- New API endpoint: `POST /api/agents`, `GET /api/agents`, `DELETE /api/agents/:id`
- Auth-protected
- Returns created agent in registry-compatible shape
**OR (Option A — config-only):**
- Skip this slice — proceed directly to the frontend form

### Slice 4: AGENT-PLATFORM-CREATE-01B — Create Agent MVP UI
**Nature:** Frontend UI — medium risk
**Scope:**
- "Create Agent" button on platform dashboard
- Create Agent form: name, role, description, status selector
- Initials-based avatar computed from name
- Created agents appear on platform dashboard via `AgentStationCard`
- All text i18n via `agentCreate.*` namespace
- Files: new `CreateAgentPanel` or `CreateAgentModal`, `PlatformDashboard`, translation files, tests

### Slice 5: B3 — Pre-Beta Full-Stack Live Smoke
**Nature:** Smoke test — high risk — requires Keith explicit approval
**Depends on:** Slices 1–4 complete, deployment config filled with real secrets by Keith, production/staging infra ready
**Timing:** After RPG MVP and agent creation MVP are complete

---

## 19. B3 Timing Recommendation

**B3 should not be registered until after Slices 1–4 above are complete.**

Rationale:
- B3 proves technical full-stack readiness — it does not prove product readiness
- Without a usable RPG MVP and agent creation MVP, running B3 would validate infrastructure for a product surface that isn't ready
- The correct order: product surface ready → B3 proves it all works together end-to-end

**Estimated B3 readiness:** 3–5 weeks from today (2026-07-20), assuming Slices 1–4 are scoped thinly and executed without blockers.

**B3 pre-registration requirements remain:**
- Keith explicit "go" approval
- Actual deployment infra (server, DNS, secrets, TLS) set up by Keith using `docs/DEPLOYMENT-GUIDE.md`
- All prerequisite tasks H2–H9 completed

---

## 20. Risks and Unknowns

| Risk | Assessment | Mitigation |
|------|------------|------------|
| Agent creation persistence path is ambiguous | HIGH — Option A (config) vs. Option B (DB) is a key decision | Decide in Step 3; document in Step 4 before registering implementation |
| Platform dashboard feels too "generic business" — may not attract RPG-excited users | MEDIUM | Visual identity refresh in Slice 1 addresses this; pixel art is not required |
| Workspace Home view and Platform dashboard are two separate entry points — users may not find the platform | MEDIUM | Slice 2 adds the link |
| Auth guard on `/[locale]/platform` may not be enforced | MEDIUM | Review in Slice 2; fix if not guarded |
| Created agents need to merge into the registry at runtime — the current registry is static const | HIGH for Option B | Option B requires a dynamic registry lookup layer; Option A avoids this entirely |
| UX-IA-32+ workspace redesign changes may affect `workspace-sidebar.tsx` behavior when adding platform link | LOW | The sidebar already has a Command Center link — may only need to verify it's visible in the right contexts |
| B3 has no deployment infra yet (real server, DNS, secrets) | HIGH | This is Keith's responsibility using `docs/DEPLOYMENT-GUIDE.md`; cannot be unblocked by code alone |
| Walking character expectation — users or stakeholders may expect a "real RPG" | MEDIUM | The plan explicitly deferred walking character; Step 3 plan should re-confirm this decision |

---

## 21. Safety Confirmations

- [x] No source files were modified during this discovery pass.
- [x] No test files were modified.
- [x] No translation files were modified.
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
- [x] No new task (B3 or otherwise) was registered.
- [x] No subagents were used.
- [x] No secret-bearing environment file was opened.
- [x] TASKS.md was read but not modified.
- [x] TASKS_BACKLOG_FULL.md was read but not modified.
- [x] AINOW-EXECUTION-ROADMAP.md was read but not modified.
- [x] All locked tasks remain locked and unmodified.
- [x] Only one file was created: this discovery document.

---

## 22. Answer to the 12 Registered Scope Questions

### Q1. What RPG UX/UI was already planned?

AGENT-PLATFORM-00 planned a static RPG office/town dashboard shell as the first UI milestone. Visual elements planned: agent positions on a dashboard map, static pixel art avatars, status badges, click/tap navigation, coming-soon overlay for placeholder agents, responsive layout. The walking character was explicitly deferred. The RPG metaphor was defined as a **navigation/spatial metaphor**, not a game engine.

### Q2. What has already been implemented?

A static platform dashboard at `/[locale]/platform` with:
- Card grid of 4 agents using `AgentStationCard` components
- Initials-based avatars (no pixel art)
- Status badges (Active / Coming Soon / Offline)
- Builder Agent card navigates to `/[locale]/app`
- Coming-soon agents toggle inline message on click
- Back to Workspace link in header
- Command Center sidebar nav link in `WorkspaceSidebar`
- Multilingual i18n for all visible text (7 platform keys + 12 agent keys across all 3 locales)
- 11 tests passing

The workspace redesign (UX-IA-04 through UX-IA-32+) is also fully complete — the workspace `/[locale]/app` is a mature product surface.

### Q3. What is missing?

- Visual RPG identity: the current dashboard is a standard business card grid — no RPG aesthetic, no pixel art, no spatial metaphor realized visually
- Agent profile/detail panel (click through to see full agent capabilities)
- Agent creation UI (no Create Agent form exists)
- Persistence path for user-created agents
- Platform link from workspace home view
- Auth guard verification for `/[locale]/platform`

### Q4. What is required before private beta?

**MUST:**
- Platform dashboard visual refresh (distinctive identity, not generic cards)
- Agent detail panel for all 4 agents
- Builder Agent clear "Start Building" CTA in detail panel
- Create Agent form MVP (name, role, description, status)
- Created agents visible on dashboard
- Persistence path for created agents (Option A config or Option B DB)

**SHOULD:**
- Platform route linked from workspace home
- Auth guard confirmed

### Q5. What can wait until after private beta?

- Walking character
- Pixel art sprites and map environment
- Complex animations
- Multiple RPG "rooms" or zones
- Tool permissions / knowledge scopes / skills in Create Agent form
- Agent edit/update/delete flows (thin MVP first)
- Agent-to-agent collaboration UI
- Knowledge ingestion UI

### Q6. Is public testing realistically months away?

**Yes — public testing is realistically months away** (likely 2–4 months minimum). Private beta (limited invited users) is potentially 3–6 weeks away if the RPG MVP and agent creation MVP are executed as thin slices. Public testing requires real deployment, Stripe live integration, production infra, and a more polished product surface.

### Q7. What is the smallest usable RPG MVP?

1. Platform dashboard visual refresh — distinctive "Command Center" identity, not generic cards
2. Agent detail panel — click-through from any agent card to see full capabilities + CTA
3. Builder Agent clearly callable from platform
4. Placeholder agents clearly labeled "coming soon" with intent messaging
5. All text multilingual, Heroicons v2 Outline only

**No pixel art, no walking character, no game engine required.**

### Q8. What is the smallest usable agent creation MVP?

1. "Create Agent" button on platform dashboard
2. Create Agent form: name, role, description, status (required only)
3. Initials-based avatar (reuse existing pattern)
4. Persistence: config-only (Option A) or DB-backed (Option B) — decide in Step 3
5. Created agents appear on dashboard using existing `AgentStationCard`
6. All text multilingual

### Q9. Should AGENT-PLATFORM-02 be resumed, revised, or superseded?

**Superseded.** AGENT-PLATFORM-02 is COMPLETE and LOCKED. A new task (AGENT-PLATFORM-RPG-03 or equivalent) should be registered to build on top of the 02A/02B foundation. No modification of locked tasks.

### Q10. Should UX-IA tasks be resumed first?

**No.** The UX-IA family is substantially complete (UX-IA-01 through UX-IA-32+, UX-PV-01/02A/02B — all COMPLETE and LOCKED). The workspace is production-ready. The next work is in the AGENT-PLATFORM family. UX-IA does not need to be resumed first.

### Q11. What exact implementation slices should come next?

In order:
1. AGENT-PLATFORM-RPG-03A — Platform Dashboard Visual Identity + Agent Detail Panel
2. AGENT-PLATFORM-RPG-03B — Platform Dashboard Link from Workspace + Auth Guard Review
3. AGENT-PLATFORM-CREATE-01A — Create Agent Backend (if Option B) OR skip (if Option A)
4. AGENT-PLATFORM-CREATE-01B — Create Agent MVP UI
5. B3 — Pre-Beta Full-Stack Live Smoke (requires Keith approval; after Slices 1–4 complete)

### Q12. When should B3 full-stack smoke happen?

**After Slices 1–4 above are complete.** B3 proves technical end-to-end readiness. Running it before the RPG MVP and agent creation MVP are done would validate infrastructure for an incomplete product surface. Estimated B3 readiness: 3–5 weeks from 2026-07-20, assuming thin slice execution.

---

## 23. Exact Step 3 Recommendation

Step 3 should produce a **Beta-Readiness Plan** that:

1. **Confirms the thin RPG MVP scope** (Slices 1–2 above) — no pixel art, no walking character, focused on visual identity + agent detail panel
2. **Decides the agent creation persistence path** (Option A config-only vs. Option B DB-backed) — this is the most important architectural decision before implementation
3. **Identifies the exact registered tasks** to create after Step 4 (AGENT-PLATFORM-RPG-03A, AGENT-PLATFORM-RPG-03B, AGENT-PLATFORM-CREATE-01A/01B)
4. **Records the B3 timing decision** — B3 after Slices 1–4
5. **Classifies every remaining candidate item** as MUST / SHOULD / CAN WAIT / DO NOT DO before beta
6. **Confirms the multilingual-first rule, Heroicons v2 Outline rule, and advisory-only skill rule** apply to all new slices

---

## 24. Final Status

**AGENT-PLATFORM-RPG-MVP-RESET Step 2 — Discovery COMPLETE.**

- All 12 questions answered.
- Prior RPG UX/UI plan recalled.
- Prior agent creation plan recalled.
- Current implemented state documented.
- Missing pieces identified.
- Private beta requirements classified.
- Deferrable items identified.
- Public testing timeline assessed.
- Smallest usable RPG MVP defined.
- Smallest usable agent creation MVP defined.
- AGENT-PLATFORM-02 disposition: Superseded — new task to be registered.
- UX-IA disposition: No resume needed — substantially complete.
- Next implementation slices recommended.
- B3 timing recommendation recorded.
- Risks and unknowns documented.
- Safety confirmations: all pass.
- No source/test/translation/package/migration/entity/environment/Docker/governance files changed.
- No runtime/Docker/DB/browser/API/test/build/provider/payment/Stripe CLI/webhook/git commit/git push occurred.
- No secret-bearing environment file opened.
- No subagents used.

**Next recommended action:** Proceed to Step 3 — RPG MVP + Agent Creation Beta-Readiness Plan (new window, governance/planning only).
