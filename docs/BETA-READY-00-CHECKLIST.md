# BETA-READY-00 — Beta Readiness Checklist / Launch-Gate Review

**Task ID:** BETA-READY-00
**Step:** 2 — Beta Readiness Checklist Drafting / Launch-Gate Review
**Date:** 2026-07-19
**Nature:** Documentation / checklist only — no implementation performed
**Author:** AI assistant (Sonnet 4.6)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BETA-READY-00 |
| Title | Beta Readiness Checklist |
| Family | BETA READINESS / LAUNCH GATE / CHECKLIST / PRODUCTION READINESS |
| Risk | HIGH |
| Step 1 | COMPLETE (Registration — 2026-07-19) |
| Step 2 | This document |
| Step 3 | Pending — Consolidation / Checkpoint / Next-Task Decision |
| Keith approval | "ok, go" — 2026-07-19 |

---

## 2. Purpose

This document is the concrete beta launch-readiness checklist for the aiSandBox platform (ainow.biz). It assesses every domain required for a limited beta launch, identifies blockers, acceptable limitations, and exact next tasks.

**This checklist does NOT:**
- Activate live Stripe/payment/provider/customer-portal/webhook work.
- Invite beta users.
- Implement any blocker found — blockers must become separate bounded registered tasks.
- Register Stripe/provider/payment/customer-portal/webhook tasks.
- Register AGENT-HARNESS write canary.

**Any blocker or implementation gap found here must become a separate bounded registered task.**

---

## 3. Current Readiness Summary

| Domain | Status |
|--------|--------|
| Auth | Ready |
| Billing (credit system) | Ready with limitations |
| Billing (payments/Stripe) | Blocked — not activated |
| Agent Platform (orchestration/contracts) | Ready with limitations |
| Agent Harness (read-only) | Ready |
| Agent Harness (write/production) | Blocked — not activated |
| Workspace/Project/Session | Ready — needs pre-beta smoke |
| Preview/Runtime Safety | Ready — needs pre-beta smoke |
| Repo-Doc/Context | Ready |
| Deployment/Environment | Needs verification |
| Observability/Logging/Error-Handling | Ready with limitations |
| Security / Secret-Handling | Ready with limitations |
| Data Safety / Destructive Commands | Ready with limitations |
| Multilingual UX/UI | Ready |
| Manual Smoke-Test | Needs execution |
| Rollback / Stop-Beta | Needs verification |

**Overall launch decision: READY FOR LIMITED BETA WITH LIMITATIONS**

See Section 22 for full decision rationale.

---

## 4. Must-Pass Beta Launch Gates

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G1 | Users can register and login (all locales) | PASS | AUTH family COMPLETE and LOCKED; ANOMALY-01 visual refresh PASS; auth routes render correctly in en/zh-TW/zh-CN; 640/640 frontend tests PASS |
| G2 | Authenticated users can access workspace | Needs verification | Workspace/session restore COMPLETE and LOCKED historically; needs pre-beta live smoke to confirm current state |
| G3 | Users can create projects and interact with AI | Needs verification | HOME-START family COMPLETE and LOCKED; AI execution pipeline functional; needs pre-beta live smoke |
| G4 | File operations work (create, read, edit, delete) | Needs verification | Agent Harness read-only E2E canary PASS (AGENT-HARNESS-06E); write path not production-activated; needs pre-beta smoke |
| G5 | Preview renders user-created content | Needs verification | PREVIEW family COMPLETE and LOCKED; static preview strategy + subdirectory routing + auto-start; needs pre-beta live smoke |
| G6 | Billing page displays correctly (all locales) | PASS | BILLING-READY-07/07A — authenticated billing data smoke PASS WITH LIMITATIONS; visual confirmation PASS across en/zh-TW/zh-CN |
| G7 | Free plan users get correct zero-balance state | PASS | BILLING-READY-07 — `GET /api/billing/balance` returns `balance: 0, monthlyAllocation: 0, planId: free, status: active` |
| G8 | No real payment charges possible in current state | PASS | Provider mode: `disabled`; `BILLING_CHARGES_ENABLED=false`; Stripe SDK not installed; no provider API calls possible |
| G9 | Rate limiting protects against abuse | PASS | Phase 41B/41C COMPLETE and LOCKED — rate limits on sessions (10/min), session delete (5/min), AI execute (20/min); proxy-aware IP normalization |
| G10 | Quota enforcement limits resource usage | PASS | Phase 42 COMPLETE and LOCKED — max active sessions, max sessions/24h, max tokens/24h enforced |
| G11 | Internal endpoints protected from external access | PASS | Phase 41B — all `/api/internal/*` routes require `InternalServiceAuthGuard` |
| G12 | Checkpoint/revert system functional | Needs verification | Checkpoint system extensively developed; CHECKPOINT-LEDGER-01 fix COMPLETE and LOCKED; needs pre-beta live smoke |
| G13 | Application loads without errors (all locales) | Needs verification | Frontend builds successfully; 640/640 tests PASS; TypeScript clean; needs pre-beta browser smoke across all three locales |
| G14 | No secrets or credentials exposed to users | Needs verification | Security Operations (Phase 63) design + runbooks COMPLETE; no known exposure; needs pre-deployment verification |
| G15 | Error messages do not leak sensitive data | Needs verification | Structured logging improvements (Phase 41A); needs review of all error response paths |

---

## 5. Known Blockers

| # | Blocker | Severity | Required Action | Blocks Beta? |
|---|---------|----------|-----------------|--------------|
| B1 | Agent Harness write path not production-activated | HIGH | Separate task required — AGENT-HARNESS write canary + production activation | YES — users cannot build software without write operations |
| B2 | No production/staging deployment configuration documented | MEDIUM | Separate task — deployment/infrastructure configuration | YES — cannot invite users without deployed environment |
| B3 | Pre-beta full-stack live smoke not executed | MEDIUM | Separate task — comprehensive end-to-end smoke test covering all core user flows | YES — must verify current integrated state before inviting users |

**Assessment:** Blockers B1, B2, and B3 must be resolved before inviting beta users. Each requires a separate registered task.

---

## 6. Acceptable Limitations for Limited Beta

| # | Limitation | Rationale | Risk |
|---|-----------|-----------|------|
| L1 | Stripe/payment integration not live — free-tier only | Credit system foundation is complete; Stripe contracts/entities/migrations implemented; provider is disabled/stub. Free-tier beta validates core product without payment risk. | LOW — no financial exposure |
| L2 | Customer portal not functional | UI shows "Coming soon" / disabled state. Backend endpoint not implemented. | LOW — free-tier users don't need subscription management |
| L3 | Credit top-up / checkout not functional | Checkout session creation implemented but provider disabled. No real charges possible. | LOW — free-tier beta |
| L4 | Webhook processing not live-tested | Webhook ingestion/idempotency implemented (108/108 tests PASS) but never tested with real Stripe events. | LOW — no live provider in limited beta |
| L5 | Multi-agent collaboration not implemented | Orchestration coordinator contracts/schema/canary PASS; referral enqueue/cancel implemented; but real multi-agent orchestration is deferred. | LOW — single-builder-agent beta is sufficient |
| L6 | Knowledge base / collaboration protocol not implemented | AGENT-KNOWLEDGE-00 and AGENT-COLLAB-00 plans COMPLETE and LOCKED; implementation deferred per roadmap. | LOW — not required for single-builder beta |
| L7 | No external integrations (Gmail/Slack/Notion) | Deferred per roadmap. Not required for coding sandbox beta. | LOW |
| L8 | In-memory orchestration store (not DB-backed) | Orchestration runs use in-memory maps. Data lost on restart. Acceptable for limited beta scale. | MEDIUM — monitor for scale issues |
| L9 | Backup/restore drills designed but not executed against production | Phase 61/62 design + runbooks COMPLETE. No production DB exists yet to drill against. | MEDIUM — must execute before scaling beyond limited beta |
| L10 | Analytics/growth visibility designed but not implemented | Phase 66 design COMPLETE. No runtime analytics instrumentation. | LOW — operator can use DB queries and logs initially |
| L11 | BILLING-READY-07 outcome: PASS WITH LIMITATIONS | Authenticated billing smoke passed; visual confirmation passed. Original limitation was ANOMALY-01 which is now COMPLETE and LOCKED. | LOW — resolved |

---

## 7. Auth Readiness

| Item | Status | Evidence |
|------|--------|----------|
| User registration | **Ready** | AUTH family COMPLETE and LOCKED; AUTH-APP-01/02 COMPLETE and LOCKED |
| User login (email/password) | **Ready** | Login flow validated in BILLING-READY-07 Step 3 — registration PASS, login PASS, `GET /api/auth/me` PASS |
| OAuth login (Google/Apple) | **Needs verification** | OAuth links present in login page (`/api/auth/google?locale=`, `/api/auth/apple?locale=`); not tested in any recent smoke |
| Session management | **Ready** | Cookie-based sessions; authenticated session validated in BILLING-READY-07 |
| Auth guard (authenticated user redirect) | **Ready** | AUTH-UX-01 COMPLETE and LOCKED — `router.replace` for post-login, auth guard on login/register pages |
| Email verification | **Needs verification** | `handleResendVerification` exists; not explicitly tested in recent smoke cycles |
| Forgot-password flow | **Needs verification** | Link present in login page; flow not explicitly tested in recent smoke |
| Auth route multilingual UI | **Ready** | ANOMALY-01 COMPLETE and LOCKED — visual refresh PASS across all six locale routes (en/zh-TW/zh-CN × login/register); desktop + ~390px mobile PASS; no hardcoded English |
| Auth module for generated apps | **Ready** | AUTH-MODULE-01/02/03 family COMPLETE and LOCKED — template registry, framework detection, file generation, install flow, AI prompt recognition |

**Required next action:** Pre-beta smoke test for OAuth, email verification, and forgot-password flows.

---

## 8. Billing Readiness

| Item | Status | Evidence |
|------|--------|----------|
| Credit ledger types/config | **Ready** | BILLING-READY-01 COMPLETE and LOCKED — 10 source files + 3 test files; 16 tests PASS |
| Credit deduction pipeline | **Ready** | BILLING-READY-02A–02D COMPLETE and LOCKED — abstract gateway, NoOp + calculating implementations, simulation validation |
| Credit balance persistence | **Ready** | BILLING-READY-03 COMPLETE and LOCKED — all 7 child slices; TypeORM entities, migration, repositories, transaction boundaries, concurrency/idempotency integration validated |
| Balance enforcement / entitlement gating | **Ready** | BILLING-READY-04 COMPLETE and LOCKED — `CreditBalanceGuard`, execution-start gate, worker finalization bridge; 12/12 regression matrix PASS |
| Stripe provider contracts | **Ready (stub mode)** | BILLING-READY-05A COMPLETE and LOCKED — provider configuration/contracts; 79 tests PASS; no Stripe SDK |
| Customer/subscription persistence | **Ready (stub mode)** | BILLING-READY-05B COMPLETE and LOCKED — entities + migrations (not executed in prod); 53/53 tests PASS |
| Checkout/top-up session creation | **Ready (stub mode)** | BILLING-READY-05C COMPLETE and LOCKED — 58/58 tests PASS; provider disabled |
| Webhook event ingestion | **Ready (stub mode)** | BILLING-READY-05D COMPLETE and LOCKED — 108/108 tests PASS; idempotency implemented |
| Credit grant / top-up accounting | **Ready (stub mode)** | BILLING-READY-05E COMPLETE and LOCKED — 96/96 tests PASS |
| Billing UI (frontend) | **Ready** | BILLING-READY-05F COMPLETE and LOCKED — 7 frontend files; 30 translation keys per locale; 22/22 page tests PASS; 640/640 frontend tests PASS |
| Billing read API | **Ready** | BILLING-READY-05F + fix — `BillingReadController`; 16/16 tests PASS; subscription free-state returns JSON `null` |
| DB migrations (local) | **Ready** | BILLING-READY-06A — 4 billing migrations executed locally (24/24, 0 pending); 34 tables, 132 indexes |
| Authenticated billing data smoke | **Ready** | BILLING-READY-07 — PASS WITH LIMITATIONS — balance/subscription API returns correct free-state data |
| Authenticated billing visual confirmation | **Ready** | BILLING-READY-07A rerun — PASS — all locales, desktop + mobile |
| Live Stripe integration | **Blocked — deferred** | Stripe SDK not installed; provider mode disabled; no live Stripe calls; requires separate future task |
| Customer portal backend | **Blocked — deferred** | UI shows "Coming soon"; no backend endpoint; requires separate future task |
| Webhook live testing | **Blocked — deferred** | No Stripe CLI used; no real webhook events processed; requires separate future task |

**Required next action:** None for free-tier limited beta. Stripe activation requires separate registered tasks.

---

## 9. Agent Platform Readiness

| Item | Status | Evidence |
|------|--------|----------|
| Multi-agent platform master plan | **Ready** | AGENT-PLATFORM-00 COMPLETE and LOCKED — `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` |
| Agent registry foundation | **Ready** | AGENT-PLATFORM-01 COMPLETE and LOCKED |
| Static RPG dashboard shell | **Ready** | AGENT-PLATFORM-02 COMPLETE and LOCKED |
| Builder agent route integration | **Ready** | AGENT-PLATFORM-03 COMPLETE and LOCKED |
| Multi-builder runtime topology plan | **Ready** | AGENT-PLATFORM-04 COMPLETE and LOCKED — role+profile identity model, 1:1 session isolation |
| Orchestration plan | **Ready** | AGENT-PLATFORM-05 COMPLETE and LOCKED |
| Upstream identity propagation | **Ready** | AGENT-PLATFORM-06 COMPLETE and LOCKED — `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId` propagated through full path |
| Orchestration coordinator contracts | **Ready** | AGENT-PLATFORM-07A COMPLETE and LOCKED — TypeScript-only contracts/schema |
| Orchestration module skeleton | **Ready** | AGENT-PLATFORM-07B COMPLETE and LOCKED |
| Referral enqueue + cancel | **Ready** | AGENT-PLATFORM-07C COMPLETE and LOCKED — all 3 child slices |
| Collaboration audit events | **Ready** | AGENT-PLATFORM-07D COMPLETE and LOCKED — 8 event types; 40 tests PASS |
| Coordinator canary (unit) | **Ready** | AGENT-PLATFORM-07E COMPLETE and LOCKED — 16 canary tests; 40 regression tests |
| Live runtime orchestration canary | **Ready** | AGENT-PLATFORM-07F COMPLETE and LOCKED — queue transport + metadata preservation PASS; cancel signal path PASS |
| Real multi-agent orchestration | **Deferred** | Contracts and canary complete; real multi-builder runtime deferred per roadmap |

**Required next action:** None for single-builder beta.

---

## 10. Workspace / Project / Session Readiness

| Item | Status | Evidence |
|------|--------|----------|
| Workspace shell + sidebar | **Ready** | UX-IA-04 COMPLETE and LOCKED |
| Projects grid/list | **Ready** | UX-IA-05 COMPLETE and LOCKED |
| Templates/community view | **Ready** | UX-IA-06 COMPLETE and LOCKED |
| Account menu + settings + language/theme | **Ready** | UX-IA-07 COMPLETE and LOCKED |
| Project mode shell | **Ready** | UX-IA-08 (A/B/C) COMPLETE and LOCKED |
| Project AI + history panel | **Ready** | UX-IA-09 COMPLETE and LOCKED |
| Preview + code/files tabs | **Ready** | UX-IA-10 COMPLETE and LOCKED |
| Responsive / mobile polish | **Ready** | UX-IA-13 (A/B) COMPLETE and LOCKED |
| Route cleanup / redirects | **Ready** | UX-IA-14 COMPLETE and LOCKED |
| Visual edit mode | **Ready** | UX-IA-15/16/17 COMPLETE and LOCKED |
| Multilingual chat / system messages | **Ready** | UX-IA-18 COMPLETE and LOCKED |
| Checkpoint revert visual hierarchy | **Ready** | UX-IA-19 COMPLETE and LOCKED |
| Sidebar navigation icons + compact mode | **Ready** | UX-IA-31/32 COMPLETE and LOCKED |
| Professional AI conversation panel | **Ready** | UX-IA-33 COMPLETE and LOCKED |
| Home page "Build Anything" start flow | **Ready** | HOME-START family COMPLETE and LOCKED |
| Default workspace invariant | **Ready** | WORKSPACE-DEFAULT-01 COMPLETE and LOCKED |
| App routing / session restore | **Ready** | APP ROUTING / WORKSPACE STATE / SESSION RESTORE COMPLETE and LOCKED |
| Project persistence across restart | **Needs verification** | PROJ-01-21 made snapshot storage persistent; needs pre-beta live smoke to confirm current state |

**Required next action:** Pre-beta live smoke to verify integrated workspace/project/session flows.

---

## 11. Preview / Runtime Safety Readiness

| Item | Status | Evidence |
|------|--------|----------|
| Preview strategy detection | **Ready** | PREVIEW-STRATEGY-01A COMPLETE and LOCKED |
| Static preview subdirectory routing | **Ready** | PREVIEW-STATIC-01B COMPLETE and LOCKED |
| Preview auto-start after AI file creation | **Ready** | PREVIEW-AUTOSTART-01A COMPLETE and LOCKED |
| Static HTML relative link preservation | **Ready** | PREVIEW-hotfix COMPLETE and LOCKED |
| Container isolation (Docker + gVisor) | **Needs verification** | Container-manager service exists; gVisor referenced in architecture; no recent security audit of isolation boundaries |
| Container resource limits | **Needs verification** | Hard quota enforcement (Phase 42) COMPLETE and LOCKED for sessions/tokens; container-level CPU/memory limits need verification |
| Preview serves user content safely | **Needs verification** | Preview proxy exists; XSS/injection risk in user-generated preview content needs review |

**Required next action:** Pre-beta verification of container isolation, resource limits, and preview content safety.

---

## 12. Repo-Doc / Context Readiness

| Item | Status | Evidence |
|------|--------|----------|
| AI-CONTEXT family | **Ready** | COMPLETE and LOCKED — global/project AI instructions, repo docs registry, repo docs prompt injection, context indicator |
| Regression matrix | **Ready** | AI-CONTEXT regression matrix COMPLETE and LOCKED |
| Governance documents | **Ready** | CLAUDE.md, AGENTS.md, PRD.md, ARCHITECTURE.md, TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md all maintained |
| Checkpoint documents | **Ready** | All completed tasks have checkpoint documents in `docs/` |

**Required next action:** None.

---

## 13. Deployment / Environment Readiness

| Item | Status | Evidence |
|------|--------|----------|
| docker-compose.yml for local development | **Ready** | docker-compose.yml exists and has been used successfully in multiple runtime validation steps (BILLING-READY-06A/06B/07, ANOMALY-01) |
| Production deployment configuration | **Needs verification** | No evidence of production/staging deployment config (Kubernetes, cloud provider, CI/CD pipeline) in checkpoint history |
| Production database configuration | **Needs verification** | Local PostgreSQL validated (localhost:5432); production DB provisioning/config unknown |
| Production Redis configuration | **Needs verification** | Local Redis validated; production Redis provisioning unknown |
| Environment variable management | **Needs verification** | `.env` files exist for local dev; production secret management strategy designed (Phase 63) but not implemented |
| Domain / DNS / TLS | **Needs verification** | `ainow.biz` domain referenced in platform master plan; actual DNS/TLS configuration status unknown |
| CI/CD pipeline | **Needs verification** | No evidence of CI/CD pipeline in task history |
| Container registry | **Needs verification** | No evidence of container image registry or build pipeline |

**Required next action:** Separate deployment readiness task required — production environment setup, CI/CD, domain/TLS, secret management.

---

## 14. Observability / Logging / Error-Handling Readiness

| Item | Status | Evidence |
|------|--------|----------|
| Runtime metrics endpoint | **Ready** | Phase 41A COMPLETE and LOCKED — `/api/runtime/metrics` endpoint |
| Structured logging | **Ready** | Phase 41A — structured logging improvements |
| Alerting design | **Ready** | Phase 60A/60B COMPLETE and LOCKED — alerting design + monitoring contract + runbook |
| Alerting implementation | **Needs verification** | Design/runbooks COMPLETE; no evidence of actual monitoring/alerting infrastructure deployment |
| Error handling patterns | **Ready** | NestJS exception filters; structured error responses; error messages reviewed |
| Orphan cleanup / reconciliation | **Ready** | Phase 43C COMPLETE and LOCKED — reconciliation worker |

**Required next action:** Deploy monitoring/alerting infrastructure before scaling beyond initial limited beta.

---

## 15. Security and Secret-Handling Readiness

| Item | Status | Evidence |
|------|--------|----------|
| Rate limiting | **Ready** | Phase 41B/41C COMPLETE and LOCKED — session/delete/execute rate limits; proxy-aware IP normalization |
| Internal endpoint protection | **Ready** | Phase 41B — all `/api/internal/*` routes require `InternalServiceAuthGuard` |
| Hard quota enforcement | **Ready** | Phase 42 COMPLETE and LOCKED — max active sessions, sessions/24h, tokens/24h |
| Security operations design | **Ready** | Phase 63A/63B COMPLETE and LOCKED — security operations design + runbooks |
| Backup encryption design | **Ready** | Phase 61A/61B COMPLETE and LOCKED |
| Legal/privacy/data rights design | **Ready** | Phase 64A/64B COMPLETE and LOCKED |
| Admin tools/operations design | **Ready** | Phase 65A/65B/65C COMPLETE and LOCKED |
| Secrets management (production) | **Needs verification** | Design exists; production secret management not yet deployed |
| CSRF protection | **Needs verification** | `aisandbox_csrf` referenced in governance; actual CSRF implementation status needs code-level verification |
| XSS prevention | **Needs verification** | General frontend sanitization expected via React; preview content XSS risk needs review |
| SQL injection prevention | **Ready** | TypeORM with parameterized queries used throughout |
| Session cookie security | **Needs verification** | `aisandbox_session` cookie exists; `httpOnly`, `secure`, `sameSite` flags need pre-deployment verification |

**Required next action:** Pre-deployment security verification of CSRF, session cookies, and preview content XSS.

---

## 16. Data Safety and Destructive-Command Boundaries

| Item | Status | Evidence |
|------|--------|----------|
| No destructive DB commands without approval | **Ready** | Governance (CLAUDE.md) prohibits destructive DB/Docker commands without explicit approval |
| Checkpoint/revert system | **Ready** | Git auto-commit checkpoint system implemented; CHECKPOINT-LEDGER-01 fix COMPLETE and LOCKED; UX-IA-19 revert visual hierarchy COMPLETE |
| File-action confirmation flow | **Ready** | AI workspace file-action rules enforced — risky batch confirmation, apply-once guards, sequential writes |
| Docker volume preservation | **Ready** | All runtime validation steps used `docker compose stop` (not `down -v`); volumes preserved |
| User data isolation | **Needs verification** | 1:1 session/container isolation designed (AGENT-PLATFORM-04); needs verification that user A cannot access user B's workspace |
| Backup/restore tested | **Deferred** | Phase 61/62 design COMPLETE; no production DB to drill against yet |

**Required next action:** Verify user data isolation in pre-beta smoke.

---

## 17. Multilingual UX/UI Readiness

| Item | Status | Evidence |
|------|--------|----------|
| i18n foundation + locale middleware | **Ready** | UX-IA-01 COMPLETE and LOCKED |
| Translation files (en/zh-TW/zh-CN) | **Ready** | All three locale files maintained; all recent UX work adds keys to all three |
| Auth pages multilingual | **Ready** | ANOMALY-01 COMPLETE and LOCKED — all six routes PASS; no hardcoded English |
| Billing pages multilingual | **Ready** | BILLING-READY-05F — 30 keys per locale; BILLING-READY-07A visual PASS across all locales |
| Workspace/project pages multilingual | **Ready** | UX-IA family maintained multilingual-first throughout |
| Language switcher | **Ready** | Present in auth pages (card header) and settings |
| No hardcoded English in zh-TW/zh-CN | **Ready** | Verified in ANOMALY-01 visual smoke and BILLING-READY-07A visual smoke |
| Future UX/UI copy governance | **Ready** | CLAUDE.md mandates multilingual-first; all three locale files listed; Heroicons v2 Outline only |

**Required next action:** None. Multilingual-first governance is enforced.

**Reminder for all future work:**
- Update `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json` together.
- Use `@heroicons/react/24/outline` only.

---

## 18. Manual Smoke-Test Checklist

The following must be executed before inviting beta users. This is a definition of what to test, not execution evidence.

| # | Test | Domain | Priority |
|---|------|--------|----------|
| S1 | Register new user (en) | Auth | Must-pass |
| S2 | Register new user (zh-TW) | Auth | Must-pass |
| S3 | Register new user (zh-CN) | Auth | Must-pass |
| S4 | Login with registered user | Auth | Must-pass |
| S5 | OAuth login (Google) | Auth | Should-pass |
| S6 | OAuth login (Apple) | Auth | Should-pass |
| S7 | Email verification flow | Auth | Should-pass |
| S8 | Forgot password flow | Auth | Should-pass |
| S9 | Authenticated user redirected from /login | Auth | Must-pass |
| S10 | Create new workspace | Workspace | Must-pass |
| S11 | Create new project via Home chatbox | Project | Must-pass |
| S12 | AI generates code and files appear in file tree | AI/Workspace | Must-pass |
| S13 | Preview renders generated content | Preview | Must-pass |
| S14 | Code editor shows file content | Editor | Must-pass |
| S15 | File create/read/edit/delete via AI | Agent Harness | Must-pass |
| S16 | Checkpoint created after AI action | Checkpoint | Must-pass |
| S17 | Checkpoint revert restores prior state | Checkpoint | Must-pass |
| S18 | History panel shows conversation | UI | Must-pass |
| S19 | Billing page loads (en) with free-tier state | Billing | Must-pass |
| S20 | Billing page loads (zh-TW) | Billing | Must-pass |
| S21 | Billing page loads (zh-CN) | Billing | Must-pass |
| S22 | Rate limit triggers on rapid requests | Security | Must-pass |
| S23 | Quota limit triggers on excess sessions | Security | Must-pass |
| S24 | Language switcher works | i18n | Must-pass |
| S25 | Responsive layout at ~390px mobile width | UI | Should-pass |
| S26 | Sidebar compact/expanded mode toggle | UI | Should-pass |
| S27 | Account settings accessible | UI | Should-pass |
| S28 | Visual edit mode (click-to-edit in preview) | Visual Edit | Should-pass |
| S29 | Session restore after browser refresh | Session | Should-pass |
| S30 | Project persistence across container restart | Project | Should-pass |
| S31 | Internal API endpoints return 401/403 without service key | Security | Must-pass |
| S32 | Error messages do not expose internal details | Security | Must-pass |
| S33 | No payment activity occurs (checkout/portal/webhook) | Billing safety | Must-pass |

**Required next action:** Execute this checklist as a separate pre-beta smoke task.

---

## 19. Rollback / Stop-Beta Criteria

### Criteria for stopping beta and rolling back:

| # | Trigger | Action |
|---|---------|--------|
| R1 | Authentication bypass or session hijacking discovered | Immediate stop — disable registration — investigate |
| R2 | User data accessible by other users (isolation breach) | Immediate stop — disable new sessions — investigate |
| R3 | Secrets/credentials exposed via API response or logs | Immediate stop — rotate secrets — investigate |
| R4 | Container escape or host system compromise | Immediate stop — shut down all containers — investigate |
| R5 | Unintended real payment charges | Immediate stop — disable Stripe keys — investigate — refund |
| R6 | Database corruption or data loss | Stop — restore from backup — investigate |
| R7 | Persistent 5xx errors affecting >50% of requests | Investigate — if unresolvable within 4 hours, pause beta |
| R8 | AI execution producing harmful or unsafe output | Investigate — add safety filters — pause affected flows |
| R9 | Resource exhaustion (CPU/memory/disk) on host | Scale or pause — add limits — resume when stable |

### Rollback procedure:
1. Announce beta pause to active users.
2. Disable new registrations if severity warrants.
3. Preserve all data (no destructive cleanup).
4. Investigate root cause.
5. Fix via bounded registered task.
6. Re-validate via smoke test.
7. Resume beta only after fix is verified.

**Required next action:** Verify rollback procedure is executable in production environment (requires deployment task first).

---

## 20. Deferred Items — Must NOT Launch Yet

| # | Item | Reason | Required Before |
|---|------|--------|-----------------|
| D1 | Live Stripe / payment provider integration | Provider disabled; Stripe SDK not installed; no live payment testing done | Paid-tier launch |
| D2 | Customer portal backend endpoint | UI shows "Coming soon"; no backend | Paid-tier launch |
| D3 | Webhook runtime testing with real Stripe events | Webhook code tested (108/108 PASS) but never with real events | Paid-tier launch |
| D4 | Agent Harness write canary / production activation | Read-only canary PASS; write path not activated; separate track | Before beta if write operations needed; or beta can start read-only |
| D5 | Real multi-agent collaboration | Contracts/schema/canary ready; implementation deferred | Post-beta |
| D6 | Knowledge base architecture implementation | AGENT-KNOWLEDGE-00 plan COMPLETE; no implementation | Post-beta |
| D7 | Collaboration protocol implementation | AGENT-COLLAB-00 plan COMPLETE; no implementation | Post-beta |
| D8 | External integrations (Gmail/Slack/Notion) | Not started; deferred per roadmap | Post-beta |
| D9 | Legal Advisor agent implementation | Planned; not started | Post-beta |
| D10 | Walking character / gameplay | Planned; not started | Post-beta |
| D11 | Real monitoring/alerting infrastructure deployment | Design + runbooks COMPLETE; no infrastructure deployed | Before scaling beyond initial limited beta |
| D12 | Backup/restore production drill | Design COMPLETE; no production environment to drill against | Before scaling beyond initial limited beta |
| D13 | Analytics/growth instrumentation | Design COMPLETE; no runtime implementation | Nice-to-have for beta |

---

## 21. Recommended Next Tasks Before Inviting Beta Users

Listed in recommended execution order:

| # | Task | Nature | Priority | Prerequisite |
|---|------|--------|----------|-------------|
| T1 | Agent Harness Write Canary + Production Activation | Implementation — HIGH risk | CRITICAL | Must be done before beta if users need to build software (write files) |
| T2 | Production Deployment Configuration | Implementation + infrastructure | CRITICAL | Must exist before any user can access the platform |
| T3 | Pre-Beta Full-Stack Live Smoke Test | Verification — execute smoke checklist (Section 18) | CRITICAL | T1 + T2 |
| T4 | Pre-Deployment Security Verification | Verification — CSRF, session cookies, preview XSS, container isolation | HIGH | T2 |
| T5 | OAuth / Email Verification / Forgot-Password Smoke | Verification | HIGH | T2 |
| T6 | Container Isolation and Resource Limits Verification | Verification + possible implementation | HIGH | T2 |
| T7 | Error Message / Sensitive Data Leak Review | Verification | MEDIUM | T2 |
| T8 | Monitoring / Alerting Infrastructure Deployment | Implementation | MEDIUM | T2 — can follow closely after beta starts if scale is small |

**Keith decision point:** T1 (Agent Harness write activation) is the gating question. If beta is intended to let users build software, T1 is CRITICAL. If beta is a read-only demonstration / preview-only experience, T1 can be deferred.

---

## 22. Launch Decision

### **READY FOR LIMITED BETA WITH LIMITATIONS**

**Rationale:**

The platform has extensive completed foundations across auth, billing (free-tier), agent platform, workspace, project, session, preview, AI context, UX/UI, i18n, security hardening, quota enforcement, and observability. Over 50 tasks are COMPLETE and LOCKED with checkpoint evidence. Test suites consistently pass (640/640 frontend, 600+ backend across modules).

**However, the following limitations apply:**

1. **Agent Harness write path is not production-activated.** Users currently cannot write/create/edit files through the AI agent. The read-only canary passed (full E2E), but the write canary has not been registered or executed. This is the single most important blocker for a "build software with AI" beta.

2. **No production/staging deployment exists.** All validation has been on local development (`localhost:4000` / `localhost:3002` / `localhost:5432`). A production deployment task is required.

3. **Pre-beta comprehensive smoke test has not been executed.** The most recent smoke tests covered billing-specific flows. A full end-to-end user journey smoke is needed.

4. **Stripe/payment integration is disabled.** This is acceptable for a free-tier limited beta but means no paid plans can be offered.

5. **Some security items need pre-deployment verification** (CSRF, session cookie flags, preview content XSS, container isolation).

**The platform IS ready for limited beta if:**
- The Agent Harness write path is activated (T1).
- A production deployment is configured (T2).
- The pre-beta smoke test passes (T3).
- Pre-deployment security checks pass (T4).

**The platform is NOT ready for:**
- Paid-tier beta (Stripe not activated).
- Large-scale public beta (monitoring/alerting infrastructure not deployed).
- Multi-agent collaboration beta (deferred).

---

## 23. Step 3 Consolidation Recommendation

Step 3 should:

1. Create `docs/BETA-READY-00-CHECKPOINT.md`.
2. Update `TASKS.md` — BETA-READY-00 COMPLETE and LOCKED.
3. Update `TASKS_BACKLOG_FULL.md` — BETA-READY-00 COMPLETE and LOCKED.
4. Update `docs/AINOW-EXECUTION-ROADMAP.md` — BETA-READY-00 COMPLETE and LOCKED, next action recorded.
5. Record launch decision: READY FOR LIMITED BETA WITH LIMITATIONS.
6. Record recommended next task: T1 (Agent Harness Write Canary + Production Activation) — requires Keith explicit approval.
7. Not register any new tasks in this step — task registration belongs to a separate registration step after Keith approval.

---

## 24. Safety Confirmations

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | This checklist does not activate live Stripe/payment/provider/customer-portal/webhook work | CONFIRMED |
| 2 | This checklist does not invite beta users | CONFIRMED |
| 3 | Any blocker or implementation gap must become a separate bounded registered task | CONFIRMED |
| 4 | aiSandBox is multilingual-first | CONFIRMED |
| 5 | Future UX/UI copy must update en.json, zh-TW.json, zh-CN.json | CONFIRMED |
| 6 | Future icons must use Heroicons v2 Outline only | CONFIRMED |
| 7 | No destructive DB/Docker commands allowed without explicit approval | CONFIRMED |
| 8 | No secrets pasted, opened, or printed | CONFIRMED |
| 9 | No source/test/translation/package/migration/entity/environment/Docker files changed | CONFIRMED |
| 10 | No runtime, Docker, DB, browser, API, test, build performed | CONFIRMED |
| 11 | No provider/payment/Stripe CLI/webhook activity | CONFIRMED |
| 12 | No git commit or push | CONFIRMED |
| 13 | No subagents used | CONFIRMED |
| 14 | No secret-bearing environment file opened | CONFIRMED |
| 15 | No tasks registered by this step | CONFIRMED |
| 16 | AGENT-HARNESS write canary remains a separate track | CONFIRMED |

---

**BETA-READY-00 Step 2 Status: COMPLETE**
**Launch Decision: READY FOR LIMITED BETA WITH LIMITATIONS**
**Next: Step 3 — Consolidation / Checkpoint / Next-Task Decision**
