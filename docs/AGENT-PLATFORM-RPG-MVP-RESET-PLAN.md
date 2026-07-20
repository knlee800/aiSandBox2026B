# AGENT-PLATFORM-RPG-MVP-RESET — Step 3: RPG MVP + Agent Creation Beta-Readiness Plan

**Task:** AGENT-PLATFORM-RPG-MVP-RESET — RPG UX/UI and Agent Creation Beta Readiness Reset
**Step:** 3 — RPG MVP + Agent Creation Beta-Readiness Plan
**Status:** COMPLETE (planning only — no implementation)
**Date:** 2026-07-20
**Author:** Planning pass — read-only analysis and plan creation

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-RPG-MVP-RESET |
| Title | RPG UX/UI and Agent Creation Beta Readiness Reset |
| Family | AGENT PLATFORM / RPG UX/UI / AGENT CREATION / BETA READINESS |
| Priority | CRITICAL |
| Nature | HIGH-RISK PRODUCT/UX ROADMAP RESET — PLANNING ONLY |
| Step | 3 — RPG MVP + Agent Creation Beta-Readiness Plan |
| Step 1 Status | COMPLETE (Registration — 2026-07-20) |
| Step 2 Status | COMPLETE (Discovery — 2026-07-20) |
| Keith Approval | "go" — 2026-07-20 |

---

## 2. Plan Purpose

This document produces the definitive execution plan for reaching private beta with a real, usable product surface. It decides:

- Whether B3 stays paused
- How to get from the current card-grid dashboard to an RPG-identified command-center platform
- Whether agent creation uses config-only or DB-backed persistence
- The exact implementation slices, their order, and which to register next
- Classification of every candidate item as MUST / SHOULD / CAN WAIT / DO NOT DO before private beta

This is the authoritative plan document. Step 4 will update governance files to reflect these decisions.

---

## 3. Files Inspected

| # | File | Method |
|---|------|--------|
| 1 | `TASKS.md` | Read — relevant sections extracted (file too large for single read) |
| 2 | `TASKS_BACKLOG_FULL.md` | Read — relevant sections extracted (file too large for single read) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Read — full |
| 4 | `docs/AGENT-PLATFORM-RPG-MVP-RESET-DISCOVERY.md` | Read — full |
| 5 | `docs/AGENT-PLATFORM-00-CHECKPOINT.md` | Read — full |
| 6 | `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | Read — full |
| 7 | `docs/AGENT-PLATFORM-02A-CHECKPOINT.md` | Read — full |
| 8 | `docs/AGENT-PLATFORM-02B-CHECKPOINT.md` | Read — full |
| 9 | `docs/UX-IA-00-MASTER-PLAN.md` | Read — full |
| 10 | `docs/UX-IA-01-CHECKPOINT.md` | Read — full |
| 11 | `docs/UX-IA-02-CHECKPOINT.md` | Read — full |
| 12 | `docs/BETA-READY-DEPLOYMENT-CONFIG-CHECKPOINT.md` | Read — full |
| 13 | `frontend/lib/agent-platform/agent-registry.ts` | Read — full |
| 14 | `frontend/components/platform/agent-station-card.tsx` | Read — full |
| 15 | `frontend/components/platform/platform-dashboard.tsx` | Read — full |
| 16 | `frontend/app/[locale]/platform/page.tsx` | Read — full |
| 17 | `frontend/messages/en.json` | Read — agents + platform namespaces confirmed |
| 18 | `services/api-gateway/package.json` | Read — full (TypeORM, NestJS, pg confirmed) |
| 19 | `services/api-gateway/src/entities/` | Glob — 30 entity files confirmed |

---

## 4. Current Product Conclusion

The ainow.biz platform has strong backend infrastructure:
- Full billing/credit system (BILLING-READY-00 through BILLING-READY-07 COMPLETE)
- Full deployment configuration (BETA-READY-DEPLOYMENT-CONFIG COMPLETE)
- Agent harness with verified read+write canary (AGENT-HARNESS-WRITE-CANARY COMPLETE)
- Multi-builder orchestration contracts (AGENT-PLATFORM-04 through AGENT-PLATFORM-07F COMPLETE)

The platform has weak product surface:
- The `/[locale]/platform` dashboard is a generic business card grid with no RPG identity
- No agent detail panel exists
- No agent creation capability exists
- Created agents cannot persist anywhere
- The platform is not discoverable enough from the workspace

**Verdict:** The backend is beta-ready. The product UX is not. The gap is purely frontend + one minimal backend slice (agent persistence).

---

## 5. Beta Path Decision

**B3 full-stack smoke remains paused.**

Rationale:
- B3 proves technical readiness, not product readiness
- Running B3 with the current generic card-grid dashboard would validate infrastructure for a product surface that is not useful to beta testers
- The correct sequence: ship usable product surface → B3 proves it works end-to-end → invite beta testers
- B3 infrastructure requirements (H2–H9) are Keith-only deployment steps that can proceed in parallel with UX implementation

---

## 6. Public/Private Beta Timeline Assessment

| Milestone | Estimated Timeline | Rationale |
|-----------|-------------------|-----------|
| **Private beta** (limited invited users) | 3–6 weeks from 2026-07-20 | Requires thin RPG MVP + minimal agent creation + B3 PASS |
| **Public testing** (open access) | 2–4 months minimum | Requires real deployment, Stripe live integration, broader UX polish, onboarding flow, documentation |

**Key insight:** Private beta is achievable in weeks with thin, focused slices. Public testing remains months away due to payment/onboarding/infrastructure requirements that are correctly deferred.

---

## 7. RPG MVP Decision

**RPG MVP should be a thin navigational shell, not a game engine or full game-like world.**

Evidence supporting this decision:
- AGENT-PLATFORM-00 master plan explicitly defined RPG as a "navigation/spatial metaphor, not a game engine"
- Walking character was explicitly deferred in the original plan
- Pixel art environment/map was defined as the first milestone's visual goal but the card grid implementation was accepted as COMPLETE in AGENT-PLATFORM-02
- The product value for beta is: distinctive identity + agent detail panel + agent creation — not gameplay
- A thin visual identity refresh is achievable in 1 implementation slice; a game-like world would require weeks of sprite/animation/engine work

**Decision:**
- Walking character: **waits until after private beta**
- Pixel-art map/environment: **waits until after private beta** — unless a static low-cost visual treatment (e.g., a subtle background pattern or header illustration) is trivial enough to include in Slice 1 without scope expansion
- Game engine dependency: **DO NOT DO before beta**
- RPG identity is expressed through: visual design language (command-center feel), agent detail panels, status messaging, visual hierarchy — not through animation or spatial gameplay

---

## 8. Agent Creation Persistence Decision

### Option A vs Option B Comparison

| Criterion | Option A: Config-Only | Option B: DB-Backed Minimal Persistence |
|-----------|----------------------|----------------------------------------|
| **Persistence after refresh** | NO — lost on page refresh unless localStorage hack is used | YES — proper server-side persistence |
| **Persistence after login/logout** | NO | YES |
| **Multi-device access** | NO | YES |
| **Backend change required** | None | New entity + migration + API endpoints |
| **Implementation effort** | 1 frontend slice | 1 backend slice + 1 frontend slice |
| **Beta user perception** | "Fake" — created agents disappear | "Real" — created agents remain visible |
| **Technical correctness** | Workaround — localStorage is fragile | Proper — user-owned DB records |
| **Risk** | LOW | MEDIUM — new entity/migration/API surface |
| **Dynamic registry merge** | Frontend-only merge | API returns combined list (static + user-created) |
| **Future migration needed** | YES — must eventually move to DB anyway | NO — already in DB |

### Final Decision: Option B — DB-Backed Minimal Persistence

**Rationale:**
1. Config-only creation is too fake for beta. Users expect created agents to remain visible after refresh/login.
2. The API Gateway already uses TypeORM with 30+ entities. Adding one more (`UserAgent`) is a well-understood pattern.
3. The risk is bounded: minimal fields only, no complex relations, no tool/knowledge/skill config.
4. Choosing Option A would require re-implementation to DB later — wasted effort.
5. The backend slice is small: one entity, one repository, one controller with 3 endpoints, one migration, one module.

### Minimal DB Schema (planning reference only — not implemented here)

```
user_agents
├── id (uuid, PK)
├── userId (uuid, FK → users.id)
├── name (varchar 100, NOT NULL)
├── role (varchar 200, NOT NULL)
├── description (text, NOT NULL)
├── status ('active' | 'coming_soon' | 'disabled', DEFAULT 'coming_soon')
├── initials (varchar 4, computed or stored)
├── createdAt (timestamp)
├── updatedAt (timestamp)
└── deletedAt (timestamp, nullable — soft delete)
```

### Fields Deferred (not in MVP)

- `toolPermissions` — complex JSON, not needed for beta
- `knowledgeScopes` — requires knowledge infrastructure
- `skills` — requires skill infrastructure
- `referralRules` — requires collaboration infrastructure
- `approvalRules` — requires approval infrastructure
- `spriteRef` / image upload — not needed for initials-based avatar
- `modelProfile` — use a default, not user-configurable for MVP

---

## 9. Final Chosen Path

```
1. AGENT-PLATFORM-RPG-03A — Platform Dashboard Visual Identity + Agent Detail Panel
2. AGENT-PLATFORM-RPG-03B — Platform Link from Workspace + Auth Guard Review
3. AGENT-PLATFORM-CREATE-01A — Create Agent Backend Minimal Persistence
4. AGENT-PLATFORM-CREATE-01B — Create Agent MVP UI
5. BETA-READY-LOCAL-SMOKE (if staging not ready) or BETA-READY-FULL-STACK-SMOKE (B3)
```

This is the smallest set of bounded slices that transforms the platform from a generic dashboard into a usable, distinctive, agent-creation-capable product surface suitable for private beta.

---

## 10. MUST Before Private Beta

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

## 11. SHOULD Before Private Beta

| # | Item | Rationale |
|---|------|-----------|
| 1 | Platform link from workspace home view | Makes platform discoverable |
| 2 | Auth guard review on `/[locale]/platform` | Verify route is properly protected |
| 3 | User ownership / tenant scoping for created agents | Only see your own agents |
| 4 | Mobile responsive layout for platform dashboard | Beta testers may use phones |
| 5 | Animation/motion polish (subtle, restrained — not gameplay) | Better perceived quality |

---

## 12. CAN Wait Until After Private Beta

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

## 13. DO NOT DO Before Beta

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

## 14. Thin RPG MVP Scope

The thin RPG MVP transforms the current generic card grid into a distinctive command-center experience without building a game:

### Visual Identity Changes (Slice RPG-03A)
- **Header**: Enhanced with stronger branding — command-center terminology, potentially a subtle gradient or dark treatment to distinguish from generic dashboards
- **Card layout**: Visually differentiated — Builder Agent card elevated/prominent vs. coming-soon cards muted/secondary
- **Agent detail panel**: Side drawer or modal triggered by clicking any agent card
  - Shows: name, role, full description, capabilities summary, status
  - Builder Agent: prominent "Start Building" CTA → navigates to `/[locale]/app`
  - Coming-soon agents: expanded context about what the agent will do, "coming soon" messaging
- **Visual hierarchy**: Clear distinction between active/callable agents and placeholder agents
- **Iconography**: Heroicons v2 Outline only — `CommandLineIcon`, `SparklesIcon`, `UserGroupIcon`, `CpuChipIcon`, etc. for agent categories

### What makes it "RPG-like" without a game engine
- Command-center naming and visual language
- Agent cards as "stations" with status indicators
- Detail panel as "agent profile" with capability list
- Dashboard header evoking a team command room, not a business SaaS
- Restrained color and type treatment that feels purposeful and branded

### What it explicitly is NOT
- Not a spatial map
- Not animated sprites
- Not a walking character
- Not a game loop
- Not a canvas/WebGL rendering surface
- Not a game engine dependency

---

## 15. Minimal Agent Creation MVP Scope

### Backend Persistence (Slice CREATE-01A)
- New TypeORM entity: `UserAgent` — minimal fields (id, userId, name, role, description, status, initials, createdAt, updatedAt, deletedAt)
- New migration: `CreateUserAgentsTable`
- New repository: `UserAgentRepository`
- New NestJS module: `UserAgentModule`
- New controller endpoints:
  - `POST /api/agents` — create agent (auth-protected, user-scoped)
  - `GET /api/agents` — list user's agents (auth-protected, user-scoped)
  - `GET /api/agents/:id` — get single user agent (auth-protected, user-scoped)
- Input validation via class-validator DTOs
- User ownership enforced: users can only see/create/access their own agents
- No tool permissions, knowledge scopes, skills, referral rules, or approval rules in MVP

### Frontend UI (Slice CREATE-01B)
- "Create Agent" button on platform dashboard
- Create Agent form (modal or panel):
  - Name (text input — required, max 100 chars)
  - Role (text input — required, max 200 chars)
  - Description (textarea — required, max 500 chars)
  - Status (select — `coming_soon` default, options: active / coming_soon / disabled)
- Initials computed automatically from name (reuses existing pattern in `AgentStationCard`)
- Created agents appear on platform dashboard using existing `AgentStationCard` component
- Dynamic merge: dashboard shows static registry agents + user-created agents
- All form text multilingual via `agentCreate.*` namespace in all 3 locale files
- Loading, error, and empty states for agent creation
- Heroicons v2 Outline only

### What agent creation explicitly does NOT include for MVP
- Model profile selection (use a default)
- Tool permission configuration
- Knowledge scope assignment
- Skills assignment
- Referral/approval rules
- Agent image/sprite upload
- Agent edit/update UI (deferred to next slice)
- Agent delete UI (deferred to next slice — soft delete exists in schema)
- Agent collaboration configuration

---

## 16. UX/UI Implementation Principles

These apply to all implementation slices:

1. **Multilingual-first**: All user-facing text must use translation hooks. New keys must be added to `en.json`, `zh-TW.json`, `zh-CN.json` simultaneously. No hardcoded English.
2. **Heroicons v2 Outline only**: Import from `@heroicons/react/24/outline`. No Lucide, Font Awesome, Material Icons, or emoji.
3. **Advisory skills only**: Impeccable (broad audit/polish) and Emil Kowalski (component polish/motion restraint) are advisory. They must not override scope, governance, architecture, or tests.
4. **Existing patterns**: Reuse existing `AgentStationCard`, `PlatformDashboard`, `resolveNestedMessage` patterns. Do not introduce new state management libraries.
5. **Design tokens**: Use the design token system from UX-IA-02 (brand colors, surfaces, borders). Extend if needed but do not override.
6. **Responsive**: Dashboard must work on mobile (375px min). Side drawer/modal should be responsive.
7. **Accessibility**: Maintain keyboard navigation, ARIA attributes, focus management in new interactive elements.
8. **Test coverage**: All new components must have focused tests. Translation key resolution tests must cover all 3 locales.

---

## 17. Data/Backend Implementation Principles

These apply to the CREATE-01A backend slice:

1. **TypeORM entity pattern**: Follow existing entity patterns in `services/api-gateway/src/entities/` — use `@Entity`, `@PrimaryGeneratedColumn('uuid')`, `@Column`, `@CreateDateColumn`, `@UpdateDateColumn`, `@DeleteDateColumn`.
2. **NestJS module pattern**: Follow existing module patterns — module, controller, service/repository, DTOs with class-validator.
3. **Auth protection**: All agent endpoints must require authenticated user. Use existing auth guards.
4. **User scoping**: All queries must filter by `userId`. Users must never access other users' agents.
5. **Soft delete**: Use `@DeleteDateColumn` for soft delete. No hard delete in MVP.
6. **Migration safety**: Migration must be reversible. Include both `up()` and `down()` methods.
7. **No Prisma**: The API Gateway uses TypeORM, not Prisma. No Prisma schema or client.
8. **Input validation**: Use class-validator decorators (`@IsString`, `@MaxLength`, `@IsIn`, etc.).
9. **No complex relations**: `UserAgent` has only a `userId` FK. No joins to other agent tables in MVP.

---

## 18. Multilingual / i18n Requirements

All new UI text in any slice must:

1. Add keys to `frontend/messages/en.json`
2. Add translated keys to `frontend/messages/zh-TW.json`
3. Add translated keys to `frontend/messages/zh-CN.json`
4. Use the existing translation resolution pattern (direct import + `resolveNestedMessage` in platform components, or `useTranslations` hook in workspace components)

Expected new namespaces/keys:
- `platform.agentDetail.*` — agent detail panel copy
- `platform.startBuilding` — Builder Agent CTA
- `platform.capabilities` — capabilities section label
- `agentCreate.*` — create agent form labels, placeholders, validation messages, success/error states

---

## 19. Heroicons Requirement

All new icons must use:
```typescript
import { IconName } from '@heroicons/react/24/outline';
```

No other icon libraries are permitted:
- No Lucide
- No Font Awesome
- No Material Icons
- No emoji as icons
- No solid/mini/micro Heroicon variants unless explicitly approved

---

## 20. AGENT-PLATFORM-02 Disposition

**AGENT-PLATFORM-02 is COMPLETE and LOCKED (2026-07-06). It is superseded, not modified.**

- The 02A/02B implementation (card grid, navigation, coming-soon interactions) is correct and functional
- All tests pass (11/11)
- It will NOT be modified or reopened
- New work builds ON TOP of the existing components, not by changing locked code
- If a bug is found in the 02A/02B implementation, it would require a separate explicitly approved fix task

**AGENT-PLATFORM-RPG-03A supersedes the need for further AGENT-PLATFORM-02 iterations.** It builds on 02A/02B by adding visual identity + detail panel as new features/components.

---

## 21. UX-IA Disposition

**The UX-IA family does NOT need to be resumed before RPG implementation.**

- UX-IA-01 through UX-IA-32: ALL COMPLETE and LOCKED
- UX-PV-01, UX-PV-02A, UX-PV-02B: ALL COMPLETE and LOCKED
- The workspace redesign (`/[locale]/app`) is stable and production-ready
- The platform dashboard (`/[locale]/platform`) is a separate route from the workspace

The only UX-IA-adjacent gap is the workspace-to-platform link, which is addressed in Slice RPG-03B without reopening the UX-IA family.

---

## 22. Recommended Implementation Slices

### Slice 1: AGENT-PLATFORM-RPG-03A — Platform Dashboard Visual Identity + Agent Detail Panel

| Field | Value |
|-------|-------|
| Nature | Frontend UI — bounded, medium risk |
| Loop | 3-step (implement, verify, consolidate) |
| Model | Sonnet 4.6 or GPT-5.3 Codex |
| Dependencies | AGENT-PLATFORM-02 COMPLETE (satisfied) |
| Backend required | NO |

**Scope:**
- Visual refresh of `PlatformDashboard` — stronger command-center branding in header, better visual hierarchy
- Builder Agent card visually elevated vs. coming-soon cards
- New `AgentDetailPanel` component (side drawer or modal)
  - Triggered by clicking any agent card
  - Shows: name, role, full description, capabilities from manifest, status
  - Builder Agent: "Start Building" CTA → `/[locale]/app`
  - Coming-soon agents: expanded context + "coming soon" messaging
- Extend `platform.*` i18n namespace for detail panel copy (all 3 locales)
- Heroicons v2 Outline only
- Tests for new component + regression on existing 11 tests
- No backend changes

**Files likely changed:**
- `frontend/components/platform/platform-dashboard.tsx` — visual refresh + detail panel trigger
- `frontend/components/platform/agent-station-card.tsx` — card click now opens detail panel instead of (or in addition to) inline message
- New: `frontend/components/platform/agent-detail-panel.tsx`
- `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` — new platform keys
- `frontend/components/platform/platform-dashboard.test.ts` — new tests

---

### Slice 2: AGENT-PLATFORM-RPG-03B — Platform Link from Workspace + Auth Guard Review

| Field | Value |
|-------|-------|
| Nature | Frontend UI — tiny, very low risk |
| Loop | 2-step (implement, consolidate) |
| Model | Sonnet 4.6 |
| Dependencies | RPG-03A COMPLETE |
| Backend required | NO |

**Scope:**
- Verify the existing "Command Center" link in `WorkspaceSidebar` is prominent and discoverable
- Optionally add a "Command Center" / "AI Team" card or link to workspace Home view
- Review `/[locale]/platform` auth protection — confirm middleware/layout behavior guards the route
- Add any needed i18n keys
- No broad nav redesign
- No backend changes

**Files likely changed:**
- `frontend/components/workspace/workspace-sidebar.tsx` — verify/enhance existing link visibility
- Possibly `frontend/components/workspace/workspace-shell.tsx` — add Home view link
- `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` — if new keys needed

---

### Slice 3: AGENT-PLATFORM-CREATE-01A — Create Agent Backend Minimal Persistence

| Field | Value |
|-------|-------|
| Nature | Backend — medium risk |
| Loop | 3-step (implement, verify, consolidate) |
| Model | GPT-5.3 Codex High |
| Dependencies | None (can proceed independently of frontend slices) |
| Frontend required | NO |

**Scope:**
- New TypeORM entity: `UserAgent`
- New migration: `CreateUserAgentsTable`
- New repository: `UserAgentRepository`
- New NestJS module: `UserAgentModule` registered in `AppModule`
- New controller: `UserAgentController`
  - `POST /api/agents` — create (auth-protected, user-scoped)
  - `GET /api/agents` — list user's agents (auth-protected, user-scoped)
  - `GET /api/agents/:id` — get single (auth-protected, user-scoped)
- DTOs with class-validator: `CreateAgentDto`, `AgentResponseDto`
- Minimal fields: name, role, description, status, initials
- User ownership enforced (userId from auth context)
- Soft delete support
- Unit tests for controller + repository
- No tool permissions, knowledge, skills, referral, approval config

**Files likely created:**
- `services/api-gateway/src/entities/user-agent.entity.ts`
- `services/api-gateway/src/user-agent/user-agent.module.ts`
- `services/api-gateway/src/user-agent/user-agent.controller.ts`
- `services/api-gateway/src/user-agent/user-agent.repository.ts`
- `services/api-gateway/src/user-agent/dto/create-agent.dto.ts`
- `services/api-gateway/src/user-agent/dto/agent-response.dto.ts`
- `services/api-gateway/src/migrations/[timestamp]-CreateUserAgentsTable.ts`
- `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts`

---

### Slice 4: AGENT-PLATFORM-CREATE-01B — Create Agent MVP UI

| Field | Value |
|-------|-------|
| Nature | Frontend UI — medium risk |
| Loop | 3-step (implement, verify, consolidate) |
| Model | GPT-5.3 Codex |
| Dependencies | CREATE-01A COMPLETE (backend API must exist) |
| Backend required | Uses API from CREATE-01A |

**Scope:**
- "Create Agent" button on platform dashboard
- Create Agent form (modal or panel): name, role, description, status
- Initials auto-computed from name
- API integration: `POST /api/agents`, `GET /api/agents`
- Created agents rendered on dashboard using `AgentStationCard`
- Dynamic merge: static registry agents + user-created agents displayed together
- Loading/error/empty states
- All text multilingual via `agentCreate.*` namespace (all 3 locales)
- Heroicons v2 Outline only
- Tests for form, API integration, display

**Files likely created/changed:**
- New: `frontend/components/platform/create-agent-panel.tsx` (or `create-agent-modal.tsx`)
- `frontend/components/platform/platform-dashboard.tsx` — add Create button + fetch user agents + merge display
- `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` — `agentCreate.*` namespace
- New: `frontend/components/platform/create-agent-panel.test.ts`

---

### Slice 5: BETA-READY-LOCAL-SMOKE or BETA-READY-FULL-STACK-SMOKE

| Field | Value |
|-------|-------|
| Nature | Smoke test — high risk |
| Loop | 4-step (registration, stage-start, execution, consolidation) |
| Model | GPT-5.3 Codex High |
| Dependencies | Slices 1–4 COMPLETE; Keith infra steps (H2–H9) for staging |

**Scope:**
- **If staging is not ready:** Local full-stack smoke (Docker + local DB + all services + frontend browser smoke) validates the integrated RPG MVP + agent creation flow end-to-end
- **If staging is ready:** B3 staging/production smoke validates on real infrastructure
- Validates: platform dashboard loads, detail panel works, agent creation persists and displays, Builder Agent CTA works, multilingual routes work

**Decision:** Run local smoke first. B3 staging/production smoke only after Keith completes server/DNS/secrets/TLS setup (H2–H9 from deployment config).

---

## 23. Recommended Next Task After Step 4

**Register: AGENT-PLATFORM-RPG-03A — Platform Dashboard Visual Identity + Agent Detail Panel**

This is the first implementation slice. It should be registered immediately after Step 4 (governance update) is complete.

Registration should include:
- Scope from Section 22, Slice 1 above
- 3-step loop (implement, verify, consolidate)
- Medium risk classification
- Multilingual-first and Heroicons v2 Outline constraints
- No backend requirement
- Advisory UX/UI skill reference (Impeccable + Emil Kowalski for component polish guidance)

---

## 24. B3 Timing Recommendation

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

**Estimated B3 readiness:** 3–5 weeks from 2026-07-20, assuming:
- Each slice takes 2–4 days of focused implementation
- No major blockers or architectural discoveries
- Keith completes H2–H9 in parallel

**Sequence:**
1. Slices 1–4 complete → product surface is beta-worthy
2. Local smoke validates integration → confidence before staging
3. Keith completes H2–H9 → staging is provisioned
4. Keith approves B3 registration → B3 executes on staging
5. B3 PASS → invite private beta testers

---

## 25. Risks and Unknowns

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agent creation requires dynamic registry merge — current registry is static `const` | MEDIUM | CREATE-01B will implement a merge layer: `listAgents()` returns static agents; API returns user agents; dashboard combines both |
| Auth guard on `/[locale]/platform` may not be enforced | MEDIUM | RPG-03B explicitly reviews this; fix if unguarded |
| Agent detail panel design may need iteration after first implementation | LOW | First pass delivers functional panel; visual polish can follow in a micro-slice if needed |
| DB migration for `user_agents` must not conflict with existing 24 migrations | LOW | TypeORM migration ordering is timestamp-based; no conflict expected |
| Keith infra steps (H2–H9) may take longer than code work | MEDIUM | Cannot control; product work proceeds in parallel |
| User-created agents may need a "route" field or default behavior when clicked | LOW | MVP: clicking a user-created agent opens detail panel only; no route navigation for custom agents in MVP |
| Translation quality for zh-TW/zh-CN may need human review | LOW | Acceptable for private beta; can refine based on feedback |

---

## 26. Stop Conditions for Future Implementation

Stop and escalate if:
- Any slice requires more than 10 files changed
- Any slice requires changes to locked tasks or locked implementations
- Agent creation requires modifications to the existing billing/credit system
- Auth guard review reveals a security issue requiring auth architecture changes
- Migration conflicts with existing schema
- Implementation conflicts with CLAUDE.md governance rules

---

## 27. Safety Confirmations

- [x] No source files were modified during this planning pass.
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
- [x] TASKS.md was not modified.
- [x] TASKS_BACKLOG_FULL.md was not modified.
- [x] AINOW-EXECUTION-ROADMAP.md was not modified.
- [x] All locked tasks remain locked and unmodified.
- [x] Only one file was created: this plan document.

---

## 28. Exact Next Action

**Proceed to Step 4 — Governance Update.**

Step 4 should:
1. Update TASKS.md — record Step 3 COMPLETE, update next action
2. Update TASKS_BACKLOG_FULL.md — mirror status
3. Optionally update AINOW-EXECUTION-ROADMAP.md — record AGENT-PLATFORM-RPG-MVP-RESET progress
4. Do NOT register new implementation tasks (registration of AGENT-PLATFORM-RPG-03A happens as its own registration step after Step 4)
5. Do NOT implement anything
6. Do NOT modify source files

After Step 4, the next action is: Register AGENT-PLATFORM-RPG-03A as a new implementation task with Keith approval.
