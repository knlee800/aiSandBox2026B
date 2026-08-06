# PRIVATE-BETA-FUNCTIONAL-READINESS-01 — Core Functional Readiness Audit

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-01
**Type:** Documentation / Source Review / Planning — NO code, runtime, environment, Git, browser, or invitation action
**Status:** COMPLETE — 2026-08-06
**Author:** Cursor / Sonnet 4.6
**Date:** 2026-08-06

---

## 1. Purpose

The previous GO WITH LIMITATIONS decision (PRIVATE-BETA-DEPLOYMENT-READINESS — 2026-08-05) confirmed staging infrastructure, authentication, platform pages, Create Agent persistence, multilingual UI, and mobile layout.

It did not prove that the core product functions work end to end.

This audit assesses core functional readiness for a private beta that would be useful to users — not just reachable.

**Governance:**
- PRIVATE-BETA-INVITE-01 remains unregistered.
- No users are invited.
- The prior GO WITH LIMITATIONS decision is superseded for invitation purposes pending functional readiness validation.
- Infrastructure readiness remains valid and is not re-litigated here.

---

## 2. Evidence Base

| Source | Date | Evidence Type |
|---|---|---|
| `docs/PRIVATE-BETA-DEPLOYMENT-READINESS-FINAL-DECISION.md` | 2026-08-05 | Staging smoke summary |
| `docs/PRIVATE-BETA-DEPLOYMENT-READINESS-CHECKPOINT.md` | 2026-08-05 | Staging verification gates |
| `docs/PRIVATE-BETA-DEPLOYMENT-READINESS-STEP-3-STAGING-SMOKE-CHECKPOINT.md` | 2026-08-05 | Manual browser smoke record |
| `docs/BETA-READY-SMOKE-CHECKPOINT.md` | 2026-07-21 | Local full-stack smoke (pre-staging) |
| `docs/AINOW-EXECUTION-ROADMAP.md` | 2026-08-06 | Task history and completion evidence |
| `TASKS.md` | 2026-08-06 | Active and locked task registry |
| Source files reviewed | 2026-08-06 | `frontend/app/[locale]/app/page.tsx`, `frontend/components/workspace/*.ts`, `services/ai-service/src/ai-execution/ai-execution.service.ts`, `services/api-gateway/src/safety/execution-safety.guard.ts`, `services/container-manager/src/sessions/sessions.service.ts` |

No runtime commands, browser sessions, SSH, Docker, or Git actions were performed. All classifications are based on documented checkpoint evidence and source review only.

---

## 3. Functional Readiness Matrix

### 3.1 Infrastructure and Authentication

| Function | Classification | Evidence |
|---|---|---|
| Staging DNS, TLS, HTTPS (staging.ainow.biz) | **STAGING PASS** | 04H-CHECKPOINT |
| PostgreSQL 26 tables, migrations applied | **STAGING PASS** | 04E / 04J-CHECKPOINT |
| Redis 8.8.0 running — BullMQ connected | **STAGING PASS** | 04A / 04D-CHECKPOINT |
| All 4 PM2 services online — reboot-proven | **STAGING PASS** | 04F / 04G-CHECKPOINT |
| `GET /api/health` → 200 | **STAGING PASS** | 04D / 04I / 04J-CHECKPOINT |
| `GET /api/health/db` → 200 | **STAGING PASS** | 04D / 04I / 04J-CHECKPOINT |
| `GET /api/health/ready` → 200 | **STAGING PASS** | 04D / 04I / 04J-CHECKPOINT |
| Container Manager health (`/api/health` → 200) | **STAGING PASS** | 04D-CHECKPOINT |
| AI Service health | **STAGING PASS** | 04D-CHECKPOINT (PM2 all four services) |
| Registration → email verification → login | **STAGING PASS** | 04I-CHECKPOINT (Paths C/D/E) |
| Kill switch — `GLOBAL_EXECUTION_ENABLED=false` | **STAGING PASS** | 04B / 04D2-CHECKPOINT |
| Billing disabled — `BILLING_CHARGES_ENABLED=false` | **STAGING PASS** | 04B-CHECKPOINT |
| 47 environment variables — secret safety CLEAN | **STAGING PASS** | 04B-CHECKPOINT |
| Rollback path — PM2/SSH/DB backup/Lightsail | **STAGING PASS** | 04F / 04G / 04J-STEP-6B-CHECKPOINT |

### 3.2 Platform Surface (Confirmed on Staging)

| Function | Classification | Evidence |
|---|---|---|
| Authenticated `/en/platform` | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Authenticated `/zh-TW/platform` | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Authenticated `/zh-CN/platform` | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Workspace → Platform CTA locale routing | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Create Agent — create / list / refresh / detail | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Static system agents display (Builder / Chief of Staff / etc.) | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Desktop layout acceptable | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| ~390px mobile layout on platform page | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| zh-TW / zh-CN — no hardcoded English on platform | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Support / feedback channel defined as email | **STAGING PASS** | STEP-3-STAGING-SMOKE-CHECKPOINT |
| Workspace page loads ("Build anything" visible) | **STAGING PASS (partial)** | 04J-STEP-6B-CHECKPOINT (page load only; no session started) |
| Billing page loads (disabled state) | **STAGING PASS** | BILLING-READY-07 / 06B-CHECKPOINT |

### 3.3 Core Product Workflow — PROJECT AND SESSION

| Function | Classification | Evidence |
|---|---|---|
| Project creation (user-initiated) | **IMPLEMENTED BUT UNVERIFIED** | Project API returns 200 on staging (04J); creation flow never smoke-tested |
| Project reopening and persistence | **IMPLEMENTED BUT UNVERIFIED** | `projects.slug` column and API confirmed; no user-initiated open/reopen tested |
| Session creation (`POST /api/sessions`) | **IMPLEMENTED BUT UNVERIFIED** | Container Manager health 200 confirmed; no session created on staging |
| Session lifecycle (start → active → terminated) | **IMPLEMENTED BUT UNVERIFIED** | Source: `sessions.service.ts` — implemented; never live-tested on staging |
| Session persistence after page refresh | **IMPLEMENTED BUT UNVERIFIED** | State management implemented in `workspace-shell.logic.ts`; not tested on staging |
| Container Manager ↔ API Gateway internal events | **IMPLEMENTED BUT UNVERIFIED** | Source implemented; no live test on staging |
| Cross-user data isolation | **TESTS ONLY** | Unit tests verify 404 on cross-user agent requests; no multi-user live test |

### 3.4 Core Product Workflow — AI EXECUTION

| Function | Classification | Evidence |
|---|---|---|
| AI prompt submission | **DISABLED BY POLICY** | `GLOBAL_EXECUTION_ENABLED=false` — `ExecutionSafetyGuard` returns 503 |
| AI execution start, progress, completion | **DISABLED BY POLICY** | Kill switch active; BullMQ worker will not process jobs |
| AI execution failure and error state | **DISABLED BY POLICY** | Kill switch fires before any provider call |
| AI provider routing (Anthropic/OpenAI/Groq/xAI/DeepSeek) | **IMPLEMENTED BUT UNVERIFIED** | Source: `ai-execution.service.ts` — adapters implemented; no live provider call on staging |
| Agent selection and routing (Builder → execution) | **DISABLED BY POLICY** | Builder Agent CTA shown; routing into live session not tested |
| Builder Agent workflow (prompt → files → preview) | **DISABLED BY POLICY** | Entire loop disabled; cannot be tested while execution is off |
| Multi-agent orchestration / referral | **DISABLED BY POLICY** | `OrchestrationService` implemented; not reachable while execution is off |
| Retry and cancellation | **DISABLED BY POLICY** | Cancel signal path proven in local canary (07F2); not reachable on staging |
| Execution kill-switch behavior (503 response) | **STAGING PASS** | LOCAL-PRIVATE-BETA-READINESS-01-FIX-EXECUTION-KILLSWITCH-LOCAL verified locally; staging env confirmed `GLOBAL_EXECUTION_ENABLED=false` |

### 3.5 Core Product Workflow — WORKSPACE FILE AND EDITOR

| Function | Classification | Evidence |
|---|---|---|
| Workspace file tree load and display | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-file-navigation.logic.ts`; never tested on staging |
| File tree refresh after AI action | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-post-exec.logic.ts`; never tested on staging |
| Editor content load (read file) | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-file-navigation.logic.ts`; read canary PASS locally (06E) |
| Editor content save (write file) | **IMPLEMENTED BUT UNVERIFIED** | Source: `file-tool-handlers.ts`; write canary PASS locally (WRITE-CANARY-B) |
| File deletion | **IMPLEMENTED BUT UNVERIFIED** | Source implemented; never tested on staging |
| File search | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-file-navigation.logic.ts`; not tested on staging |
| Risky batch file action confirmation flow | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-ai-file-actions.logic.ts`; not tested on staging |
| AI file action apply and coherence | **DISABLED BY POLICY** | Requires execution to trigger |
| Mobile usability of workspace UI | **IMPLEMENTED BUT UNVERIFIED** | Platform mobile PASS; workspace mobile not tested |

### 3.6 Core Product Workflow — PREVIEW AND BUILD

| Function | Classification | Evidence |
|---|---|---|
| Preview proxy (iframe preview of running app) | **IMPLEMENTED BUT UNVERIFIED** | Source: `preview-proxy.service.ts`, `workspace-preview.logic.ts`; never tested on staging |
| Preview refresh after AI action | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-post-exec.logic.ts`; not tested on staging |
| Preview status (running / stopped detection) | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-preview.logic.ts`; not tested on staging |
| Build target awareness | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-build-targets.logic.ts`; not tested on staging |

### 3.7 Core Product Workflow — GIT CHECKPOINTS

| Function | Classification | Evidence |
|---|---|---|
| Checkpoint creation (manual) | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-checkpoint-create.logic.ts`; WRITE-CANARY-B showed checkpoint SHA locally; not tested on staging |
| Checkpoint list display | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-shell.logic.ts`; not tested on staging |
| Checkpoint diff view | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-checkpoint-diff.logic.ts`; not tested on staging |
| Checkpoint revert | **IMPLEMENTED BUT UNVERIFIED** | Source: `workspace-checkpoint-revert.logic.ts`; not tested on staging |
| Auto-checkpoint after AI execution | **DISABLED BY POLICY** | Triggered by execution completion; execution disabled |

### 3.8 Other Features

| Function | Classification | Evidence |
|---|---|---|
| Repo Docs behavior | **LOCAL PASS ONLY** | Passed in LOCAL-PRIVATE-BETA-READINESS-01 local rebaseline; not tested on staging |
| Create Agent usefulness beyond persistence | **NOT REQUIRED FOR INITIAL PRIVATE BETA** | Agents exist in DB; no agent can execute while kill switch is active |
| Update / delete agent | **PLACEHOLDER / NOT IMPLEMENTED** | No PUT/PATCH/DELETE agent endpoints exist |
| Google OAuth | **DISABLED BY POLICY** | Deferred — email/password login only |
| Billing and payments | **DISABLED BY POLICY** | `BILLING_CHARGES_ENABLED=false` — `STRIPE_PROVIDER_MODE=disabled` |
| Walking character / pixel office / RPG game engine | **PLACEHOLDER / NOT IMPLEMENTED** | Post-beta scope |
| Tool permissions, knowledge scope, skills | **PLACEHOLDER / NOT IMPLEMENTED** | Not implemented in MVP |
| Real-time monitoring / alerting | **NOT REQUIRED FOR INITIAL PRIVATE BETA** | Manual health endpoint monitoring acceptable |
| Formal security audit | **NOT REQUIRED FOR INITIAL PRIVATE BETA** | Standard guards in place; no penetration test |
| Public registration / open signups | **DISABLED BY POLICY** | Invite-only mode |
| Multilingual during functional workflows (AI execution) | **NOT REQUIRED FOR INITIAL PRIVATE BETA** | Platform/auth multilingual confirmed; workspace-session multilingual not critical while execution is disabled |

---

## 4. What Has Already Been Tested

### 4.1 Proven on Staging (2026-08-05 and earlier)

- Infrastructure: DNS, TLS, all health endpoints, DB schema (26 tables), Redis, all 4 PM2 services
- Authentication loop: registration → email verification → login (Keith manual confirmation)
- Platform UI: `/[locale]/platform` authenticated access in all three locales
- Platform CTA routing from workspace → platform (locale-aware)
- Create Agent: DB-backed create, list, refresh, detail persistence (one test agent record in staging DB)
- Static agent display unchanged
- Desktop and ~390px mobile layout on platform page
- Multilingual — no hardcoded English on zh-TW/zh-CN platform routes
- Kill switches confirmed set correctly: execution disabled, billing disabled
- Rollback path documented and proven via PM2/SSH/DB backup/Lightsail snapshots
- Workspace page reachable and showing project-first UI ("Build anything" visible)

### 4.2 Proven Locally Only (Not on Staging)

- Local full-stack smoke: platform routes, Create Agent, workspace CTA (BETA-READY-SMOKE — 2026-07-21)
- Agent Harness write canary: `write_file` + `read_file` + checkpoint SHA (WRITE-CANARY-B — 2026-07-20)
- Full E2E canary: `list_files` SUCCESS, `read_file` SUCCESS (AGENT-HARNESS-06E — 2026-07-09)
- Billing authenticated data (free state): balance, subscription endpoints (BILLING-READY-07 — 2026-07-17)
- Repo Docs behavior (LOCAL-PRIVATE-BETA-READINESS-01 — 2026-07-23)
- Kill switch behavior: 503 response on authenticated `POST /api/ai/execute` (LOCAL-PRIVATE-BETA-READINESS-01-FIX — 2026-07-23)
- Auth guard behavior: 401 on unauthenticated execution requests

---

## 5. What Has NOT Been Tested on Staging

The following functions have never been tested on staging under any conditions:

1. **Project creation, naming, and persistence** — Project API 200 confirmed; user-initiated creation flow not smoke-tested
2. **Session creation and container lifecycle** — Container Manager health 200; no session ever started on staging
3. **Workspace shell after session is active** — Workspace page loads; session-active state never reached
4. **File tree load, display, and refresh** — Source implemented; never reached on staging
5. **Editor content load and save** — Source implemented; never reached on staging
6. **Preview proxy and preview refresh** — Not tested anywhere on staging
7. **Git checkpoint creation, list, diff, and revert** — Not tested on staging (local canary only)
8. **AI prompt submission** — Disabled; cannot be tested while kill switch is on
9. **AI execution end-to-end** — Disabled; no execution has ever occurred on staging
10. **File creation/modification by AI** — Disabled
11. **Post-execution workspace refresh (file tree + editor + preview + checkpoint list)** — Disabled
12. **Agent routing from platform (Builder Agent "Start Building" → active session)** — Not tested on staging
13. **Error states, retry, cancellation in workspace** — Not tested on staging
14. **Cross-user isolation under real multi-user conditions** — Tests only
15. **Mobile usability of workspace/session UI** — Platform page mobile tested; workspace mobile not tested
16. **Multilingual behavior during actual workspace session** — Not applicable while execution disabled
17. **Page refresh state persistence in workspace session** — Not tested on staging

---

## 6. Minimum Functional Journeys Required Before Inviting Users

Before any user invitation is authorized, these minimum functional journeys must be proven on staging (in sequence):

### Journey 0 — Pre-condition: Enable AI Execution
AI execution must be enabled on staging (`GLOBAL_EXECUTION_ENABLED=true`) with at least one real AI provider key configured before Journeys 1–5 can be proven. This requires a separate Keith approval and a new task.

### Journey 1 — Project Open / Session Start
User logs in → navigates to `/en/app` → creates or opens a project → workspace shell loads with active session → file tree visible → no errors in console.

**Minimum proof:** One authenticated project open with session confirmed active (container running, file tree visible).

### Journey 2 — AI Prompt Submission and Execution
User types a prompt → submits → AI execution starts → progress is visible in chat → AI execution completes → response visible → no error state.

**Minimum proof:** One successful AI execution on staging with a real provider (not stub).

### Journey 3 — AI File Creation and Workspace Refresh
After Journey 2 AI execution: one or more files created or modified by AI → file tree refreshes → editor opens the new/modified file → content is correct.

**Minimum proof:** One file created by AI, visible in file tree, openable in editor, content matches expected output.

### Journey 4 — Git Checkpoint
After Journey 3: a git checkpoint is created (auto or manual) → checkpoint appears in checkpoint list → checkpoint SHA is non-empty.

**Minimum proof:** One checkpoint entry visible in the checkpoint list after AI execution.

### Journey 5 — Page Refresh Persistence
After Journey 4: user refreshes the page → workspace reconnects → previous session state is visible → chat history is present → file tree is present.

**Minimum proof:** Session persists and workspace reconnects without error after browser refresh.

These five journeys define the **minimum viable private beta functional loop**. No user invitation is appropriate before all five are confirmed on staging.

---

## 7. Decision — What the Current Product Supports

### Current State (2026-08-06)

| Mode | Supported? | Reason |
|---|---|---|
| **Landing-page/UI preview only** | YES | Workspace page, platform page, auth all work |
| **Read-only product demonstration** | YES — with significant limitations | User can log in, see platform, create an agent record, see workspace shell, but cannot use the core product |
| **Functional private beta** | **NO** | AI execution is disabled; core product loop unproven on staging |
| **Functional private beta with specific disabled features** | **NOT YET** | Would require Journeys 1–5 proven on staging after enabling execution |

### In Plain Language

The platform today is **reachable and authentic** — users can log in, navigate, and create agents — but it is **not functional** as a software-building AI sandbox. A user who logs in and clicks "Start Building" will enter a workspace where they cannot submit an AI request. The core product value (AI builds files → workspace updates) is entirely disabled.

Inviting users in this state would produce a poor and misleading experience. The prior GO WITH LIMITATIONS decision was valid for infrastructure assessment only. For functional purposes, the product is not yet ready for private beta.

---

## 8. Exact Next Bounded Staging Validation Task

**Task: PRIVATE-BETA-FUNCTIONAL-READINESS-02 — Staging Workspace and Session Creation Smoke**

**Scope (bounded — does NOT require enabling AI execution):**
- User logs in on staging → navigates from platform to workspace (`/en/app`)
- Opens or creates a project → workspace shell displays with session in progress
- File tree visible and non-empty
- Editor opens at least one file
- No console errors or HTTP 5xx visible
- Page refresh: session reconnects

**Why this task is first:** It proves the workspace journey short of AI execution — the smallest provable subset of the core loop. If session creation fails on staging, that must be resolved before execution is enabled.

**Subsequent task (separate approval):** PRIVATE-BETA-FUNCTIONAL-READINESS-03 — Enable AI execution on staging and prove Journeys 2–5 (prompt submission → file creation → workspace refresh → checkpoint → page refresh persistence).

**These are two sequential tasks, not one.** Do not combine them.

---

## 9. Recommended Model and Workflow

| Step | Task | Recommended Model |
|---|---|---|
| Registration (this audit complete) | PRIVATE-BETA-FUNCTIONAL-READINESS-01 | Sonnet 4.6 |
| PRIVATE-BETA-FUNCTIONAL-READINESS-02 runbook + smoke | Step 1: Registration (Sonnet 4.6); Step 2: Runbook (Sonnet 4.6); Step 3: Keith manual browser smoke; Step 4: Consolidation (Sonnet 4.6) |
| PRIVATE-BETA-FUNCTIONAL-READINESS-03 | HIGH risk — enabling execution — Sonnet 4.6 for governance; GPT-5.3 Codex High for source review if blockers found |

Keith must perform all browser smoke steps. Cursor performs only source review, runbook creation, and governance documentation.

---

## 10. Governance Updates Summary

| Item | Status |
|---|---|
| PRIVATE-BETA-INVITE-01 | NOT REGISTERED — no invitation authorized |
| Prior GO WITH LIMITATIONS decision | SUPERSEDED FOR INVITATION PURPOSES — valid for infrastructure only |
| Infrastructure readiness | REMAINS VALID |
| Functional readiness | UNPROVEN — core product loop never tested on staging |
| Next task selected | PRIVATE-BETA-FUNCTIONAL-READINESS-02 — requires separate Keith approval |
| AI execution enable | NOT APPROVED — requires separate task and explicit approval |

---

## 11. Safety Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or changed
- ✅ No env values printed or recorded
- ✅ No runtime or server action taken
- ✅ No SSH / AWS CLI / PM2 / systemd / Caddy action
- ✅ No Docker / PostgreSQL / Redis action
- ✅ No terminal commands run
- ✅ No git commit or push
- ✅ No subagents used
- ✅ No locked checkpoint modified
- ✅ No users invited
- ✅ No staging or production deployment changed
- ✅ No migrations run
- ✅ No billing or payment action
- ✅ No AI execution enabled
- ✅ No browser automation performed

---

**Document created:** 2026-08-06
**Task status:** COMPLETE
**Verdict:** Current product supports read-only demonstration only — NOT functional private beta
**Next action:** Register PRIVATE-BETA-FUNCTIONAL-READINESS-02 — requires Keith explicit approval
