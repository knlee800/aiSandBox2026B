# LIMITED-PRIVATE-BETA-HANDOFF-CHECKLIST

**Task ID:** LIMITED-PRIVATE-BETA-HANDOFF
**Step:** 2 — Handoff / Checklist Drafting
**Status:** DRAFT — Awaiting Keith Explicit Approval
**Date:** 2026-07-21
**Nature:** Documentation/checklist drafting only — no source, test, translation, package, migration, entity, environment, Docker, or deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | LIMITED-PRIVATE-BETA-HANDOFF |
| Title | Limited Private Beta Handoff / Checklist |
| Step | 2 — Handoff / Checklist Drafting |
| Status | DRAFT — awaiting Keith explicit approval for beta invite |
| Date | 2026-07-21 |
| Predecessor | BETA-READY-MIGRATION-CLI-01 — COMPLETE and LOCKED — 2026-07-21 |
| Predecessor | BETA-READY-SMOKE (B3) — COMPLETE and LOCKED — PASS — 2026-07-21 |
| Family | BETA READINESS / PRIVATE BETA HANDOFF |
| Keith Approval Required | YES — for actual beta invite execution |

---

## 2. Purpose

This document is the limited private beta handoff and readiness checklist for the aiSandBox2026B platform.

It records:
- What is ready based on locked checkpoint evidence
- What is explicitly not ready or not claimed
- The bounded MVP scope included and excluded from limited private beta
- Local smoke evidence from B3
- Deployment/staging readiness questions to be answered before inviting users
- Environment and migration checks (without exposing secrets)
- User limit and invite criteria recommendations
- Known limitations and local test data
- Go / no-go criteria
- Recommended next tasks
- Keith manual approval checklist
- Safety boundaries

This document does not perform, authorize, or record any deployment, user invitation, public launch, implementation, or runtime execution. Actual private beta rollout requires Keith explicit approval.

---

## 3. Current Readiness Summary

**Local bounded MVP smoke: PASSED.**

The bounded RPG/Create Agent MVP path passed local full-stack smoke (BETA-READY-SMOKE / B3 — COMPLETE and LOCKED — PASS — 2026-07-21).

The TypeORM migration CLI path has been fixed (BETA-READY-MIGRATION-CLI-01 — COMPLETE and LOCKED — 2026-07-21).

**Proceeding to limited private beta preparation is supported by the completed B3 smoke.**

**Actual private beta rollout requires Keith explicit approval.**

**Public launch is not approved.**

**Production/staging deployment readiness must still be verified separately.**

---

## 4. What Is Ready

The following have been completed, validated, and locked:

| # | Item | Evidence | Date |
|---|------|----------|------|
| 1 | `/[locale]/platform` RPG command-center UI | AGENT-PLATFORM-RPG-03A — COMPLETE and LOCKED | 2026-07-20 |
| 2 | Platform auth guard — `/[locale]/platform` requires authenticated session | AGENT-PLATFORM-RPG-03B — COMPLETE and LOCKED | 2026-07-20 |
| 3 | Workspace CTA linking `/[locale]/app` → `/[locale]/platform` | AGENT-PLATFORM-RPG-03B — COMPLETE and LOCKED | 2026-07-20 |
| 4 | Create Agent backend (API): `POST /api/agents`, `GET /api/agents`, `GET /api/agents/:id` | AGENT-PLATFORM-CREATE-01A — COMPLETE and LOCKED | 2026-07-20 |
| 5 | Create Agent frontend UI: form, `useUserAgents` hook, Your Agents section, detail panel | AGENT-PLATFORM-CREATE-01B — COMPLETE and LOCKED | 2026-07-20 |
| 6 | Live local DB-backed Create Agent create / list / refresh / detail | B3 — COMPLETE and LOCKED — PASS | 2026-07-21 |
| 7 | Static system agents unchanged (Builder Agent, Chief of Staff, Product Strategy, Technology Advisor) | B3 — COMPLETE and LOCKED — PASS | 2026-07-21 |
| 8 | Multilingual support: en / zh-TW / zh-CN — platform routes, Create Agent UI | AGENT-PLATFORM-CREATE-01B + B3 | 2026-07-20 / 2026-07-21 |
| 9 | Desktop layout acceptable | B3 — PASS | 2026-07-21 |
| 10 | ~390px mobile layout acceptable | B3 — PASS | 2026-07-21 |
| 11 | `user_agents` migration (`CreateUserAgentsTable1772500000000`) applied to local DB | B3 — PASS | 2026-07-21 |
| 12 | TypeORM migration CLI path fixed (`ts-node` devDependency added) | BETA-READY-MIGRATION-CLI-01 — COMPLETE and LOCKED | 2026-07-21 |
| 13 | Deployment configuration templates (`.env.staging.example`, `.env.production.example`, `docs/DEPLOYMENT-GUIDE.md`) | BETA-READY-DEPLOYMENT-CONFIG — COMPLETE and LOCKED | 2026-07-20 |
| 14 | Agent harness write-path canary readiness | AGENT-HARNESS-WRITE-CANARY — COMPLETE and LOCKED | 2026-07-20 |
| 15 | Local health endpoints passing (`/api/health`, `/api/health/db`, `/api/health/ready`) | B3 — PASS | 2026-07-21 |
| 16 | Auth guards — unauthenticated 401 on `/api/auth/me`, `/api/agents`, `POST /api/agents` | B3 — PASS | 2026-07-21 |
| 17 | B3 final verdict | PASS | 2026-07-21 |

---

## 5. What Is Explicitly Not Ready / Not Claimed

The following are NOT claimed as ready and must not be asserted or assumed for this limited private beta:

| # | Item | Note |
|---|------|------|
| 1 | Public beta | Not approved. Not claimed. |
| 2 | Production deployment | Not performed. Not verified. Keith-only steps required. |
| 3 | Staging deployment | Not performed. Must be verified separately. |
| 4 | Stripe / payment / provider / webhook flows | Not activated. Not tested. Stripe remains disabled/stub-safe in runtime logs. |
| 5 | Billing production readiness beyond locked evidence | Beyond prior locked billing evidence. Not claimed. |
| 6 | AI agent execution | Not exercised in B3 smoke. Not ready for limited beta activation. |
| 7 | Tool permission configuration | Not implemented in MVP. |
| 8 | Knowledge scope configuration | Not implemented in MVP. |
| 9 | Skills configuration | Not implemented in MVP. |
| 10 | Referral / approval workflows | Not implemented in MVP. |
| 11 | Walking character / pixel map / game-engine RPG | Not implemented. Post-beta enhancement. |
| 12 | Advanced Create Agent settings | Not implemented in MVP. |
| 13 | Update / delete agent lifecycle | No `PUT`, `PATCH`, or `DELETE` agent endpoints exist. |
| 14 | Large-scale multi-user load | Only local single-user smoke performed. |
| 15 | Security audit beyond bounded smoke | No formal security audit. No penetration test. |
| 16 | Real monitoring / alerting | Not configured. Not verified. |
| 17 | Production / staging secrets or environment correctness | Keith must verify separately. No secret-bearing environment files opened. |
| 18 | Cross-user isolation in production | Only local single-user flow smoked; cross-user isolation relies on existing SessionCookieGuard pattern. |
| 19 | Full automated test coverage of live flow | Mocked API tests in CI; live DB-backed flow was Keith manual smoke only. |
| 20 | Compiled TypeORM path smoke in target environment | Must be verified in deployment target before migration execution. |

---

## 6. MVP Scope Included in Limited Private Beta

The following bounded MVP scope is supported for limited private beta:

- Authenticated access to `/[locale]/platform` (en, zh-TW, zh-CN)
- Workspace → Platform CTA navigation (all three locales)
- Static system agents display (Builder Agent, Chief of Staff, Product Strategy, Technology Advisor)
- Create Agent form: collect `name`, `role`, `description`
- Create Agent: submit to `POST /api/agents`; see success confirmation
- Your Agents section: list user-created agents (`GET /api/agents`)
- Refresh persistence: created agents appear after page reload
- User-created agent detail panel: name, role, description, status
- Multilingual UI: en / zh-TW / zh-CN across all platform surfaces
- Desktop and ~390px mobile layouts

---

## 7. MVP Scope Excluded from Limited Private Beta

The following are explicitly out of scope for this limited private beta:

- Public registration / open signups
- AI agent execution / dispatching agents to perform tasks
- Stripe / payment / billing flows beyond locked evidence
- Provider webhook configuration
- Tool permission management
- Knowledge scope management
- Skills configuration
- Referral or approval workflows
- Update or delete agent operations
- Walking character / pixel office / game-engine RPG enhancements
- Advanced Create Agent settings (model profile, capabilities, etc.)
- Avatar / image upload for agents
- Production monitoring, alerting, or observability dashboards
- Multi-tenant cross-user load testing

---

## 8. Local Smoke Evidence Summary

Evidence source: `docs/BETA-READY-SMOKE-CHECKPOINT.md`, `docs/BETA-READY-SMOKE-EXECUTION.md`

**Date:** 2026-07-21
**Final verdict: PASS**

| Phase | Item | Result |
|-------|------|--------|
| Infrastructure | PostgreSQL (`aisandbox-postgres`) | Up, healthy, port 5432 |
| Infrastructure | Redis (`aisandbox-redis`) | Up, healthy, port 6379 |
| Migration | `CreateUserAgentsTable1772500000000` (Keith compiled TypeORM path) | SUCCESS |
| Migration | `user_agents` table verified via SQL | SUCCESS |
| API Gateway | Startup on `http://localhost:4000` | SUCCESS |
| Frontend | Startup on `http://localhost:3002` (Next.js 15.5.12) | SUCCESS |
| Health | `/api/health` | 200 OK |
| Health | `/api/health/db` | 200 OK — database connected |
| Health | `/api/health/ready` | 200 OK — environment validated |
| Guard | `GET /api/auth/me` (no cookie) | 401 — PASS |
| Guard | `GET /api/agents` (no cookie) | 401 — PASS |
| Guard | `POST /api/agents` (no cookie) | 401 — PASS |
| Browser | `/en/platform` authenticated access | PASS (Keith) |
| Browser | `/zh-TW/platform` authenticated access | PASS (Keith) |
| Browser | `/zh-CN/platform` authenticated access | PASS (Keith) |
| Browser | `/en/app` → `/en/platform` CTA | PASS (Keith) |
| Browser | `/zh-TW/app` → `/zh-TW/platform` CTA | PASS (Keith) |
| Browser | `/zh-CN/app` → `/zh-CN/platform` CTA | PASS (Keith) |
| Create Agent | Live create | PASS (Keith) |
| Create Agent | Success message | PASS (Keith) |
| Create Agent | Appears in "Your Agents" | PASS (Keith) |
| Create Agent | Refresh persistence | PASS (Keith) |
| Create Agent | Detail panel | PASS (Keith) |
| Static agents | Builder Agent — active, Start Building CTA | PASS (Keith) |
| Static agents | Chief of Staff, Product Strategy, Technology Advisor — coming soon | PASS (Keith) |
| Responsive | Desktop layout | PASS (Keith) |
| Responsive | ~390px mobile layout | PASS (Keith) |
| i18n | zh-TW / zh-CN — no obvious hardcoded English | PASS (Keith) |

**Local smoke environment:** local development only — `localhost` — not staging, not production.

---

## 9. Deployment / Staging Readiness Questions

The following must be answered before inviting users. Keith must verify each independently. No answers are assumed by this document.

| # | Question |
|---|----------|
| 1 | What is the target deployment environment for limited private beta? (VPS, cloud VM, managed container service, etc.) |
| 2 | Has the server / VM been provisioned with required resources (CPU, RAM, storage)? |
| 3 | Is a reverse proxy (nginx, Caddy, or cloud LB) configured and accessible at the public domain or IP? |
| 4 | Is PostgreSQL running and accessible in the target environment? |
| 5 | Is Redis running and accessible in the target environment? |
| 6 | Have all required environment variables been configured in the target environment (without exposing secrets here)? See `docs/DEPLOYMENT-GUIDE.md` and `.env.staging.example` / `.env.production.example` for template. |
| 7 | Has `npm run migration:run` (or compiled `migration:run:prod`) been run against the target DB? |
| 8 | Has the `user_agents` table been verified to exist in the target DB? |
| 9 | Is TLS/HTTPS configured at the reverse proxy level? |
| 10 | Have `docker compose up` or equivalent service startup commands been run and verified in the target environment? |
| 11 | Have health endpoints (`/api/health`, `/api/health/db`, `/api/health/ready`) been verified against the target deployment? |
| 12 | Does login / auth work end-to-end in the target environment (session cookie set, `GET /api/auth/me` returns user)? |
| 13 | Has `/[locale]/platform` been verified accessible and auth-guarded in the target environment? |
| 14 | Has Create Agent create / list been verified end-to-end in the target environment? |
| 15 | Is a rollback / restart path known? (e.g., `docker compose restart`, SSH access, service restart commands) |
| 16 | Is a support / feedback channel defined for beta users? |

---

## 10. Environment Checks Without Exposing Secrets

**Critical rule:** Do not open, paste, or read `.env`, `.env.local`, `.env.staging`, `.env.production`, or any credential, key, certificate, or token file into this document or any AI chat session.

Keith must verify the following environment configuration independently:

| # | Environment Variable Group | Check |
|---|---------------------------|-------|
| 1 | `DATABASE_URL` | Set to target PostgreSQL connection string; not example/placeholder value |
| 2 | `REDIS_URL` | Set to target Redis connection string |
| 3 | `SESSION_SECRET` | Set to a strong unique secret; not default or placeholder |
| 4 | `CSRF_SECRET` | Set if applicable; not default or placeholder |
| 5 | `INTERNAL_SERVICE_KEY` | Set for internal service-to-service auth; not default |
| 6 | `NEXTAUTH_URL` / `NEXT_PUBLIC_API_URL` | Set to correct public domain(s) |
| 7 | `STRIPE_*` | Either set to live keys (if Stripe activated) or confirmed disabled/stub-safe |
| 8 | `AI_PROVIDER_*` / `OPENAI_API_KEY` | Either set to live keys (if AI enabled) or confirmed disabled/stub-safe |
| 9 | `NODE_ENV` | Set to `production` or `staging` as appropriate |
| 10 | `WRITE_TOOL_ENABLED` | Confirm value matches intended beta behavior |
| 11 | Kill switches / safety limits | Confirm loaded correctly (visible in `/api/health/ready` response) |

Template reference: `docs/DEPLOYMENT-GUIDE.md`, `.env.staging.example`, `.env.production.example`.

Do not commit any real secrets to source control.

---

## 11. Migration Status and Required Migration Checks

**Local status:** `CreateUserAgentsTable1772500000000` was applied to the local development database by Keith during B3 (2026-07-21) via the compiled TypeORM path (`npx typeorm migration:run -d dist/data-source.js`). The `user_agents` table exists in the local development database.

**Target environment status:** UNKNOWN — must be verified by Keith before inviting users.

### Required migration checks before user invite

| # | Check | Command (run in target environment, not in Cursor chat) |
|---|-------|---------------------------------------------------------|
| 1 | Verify API Gateway build is current | `npm run build` in `services/api-gateway` |
| 2 | Check pending migrations | `npm run migration:show` in `services/api-gateway` (requires Docker/PostgreSQL running) |
| 3 | Apply pending migrations if any | `npm run migration:run` or `npm run migration:run:prod` in `services/api-gateway` |
| 4 | Verify `user_agents` table exists | `SELECT table_name FROM information_schema.tables WHERE table_name = 'user_agents';` |
| 5 | Verify no migration is pending | Confirm `migration:show` output shows no pending migrations after apply |

**Migration safety rules:**
- Never run migration against production without a database backup
- Migrations are reversible via `npm run migration:revert`
- Never run `docker compose down -v` — this destroys database volumes
- The `user_agents` migration is additive (CREATE TABLE only); it does not modify existing tables

---

## 12. Private Beta User Limits

**Recommendation: 1–3 trusted users maximum for the first beta cohort.**

- Keith must be included as the primary tester and is required to approve the invite.
- Start with Keith only for the first review cycle if any uncertainty remains.
- Expand to 2–3 trusted users only after Keith completes a review cycle with no blocking issues.
- Do not expand the cohort until at least one full review cycle passes cleanly.
- Do not open public signups or share the invite link broadly.

**Rationale:**
- Local bounded MVP smoke passed, but deployment/staging, production environment, and cross-user isolation have not been verified in the target environment.
- No delete-agent endpoint exists. Test/noise agents created during beta persist in the database.
- No formal monitoring or alerting is configured.
- AI agent execution is not activated in this MVP.
- A small cohort minimizes blast radius if unexpected issues appear.

---

## 13. Invite Criteria

Users considered for the first private beta cohort must meet ALL of the following:

- Trusted, known personally to Keith
- Willing to provide direct feedback through the defined feedback channel
- Aware that this is a limited MVP preview (Create Agent persistence only; AI execution not yet active)
- Aware that the platform may be restarted, reset, or modified during the beta period
- Not expecting Stripe, payment, AI execution, advanced agent config, or any feature not in the MVP scope listed in Section 6

**Invite channel:** Keith's discretion only. No automated invite flow. No public invite link.

**Prerequisites before sending invite:**
- Go/No-Go checklist (Section 18) is fully checked GO
- Keith has explicitly approved the invite
- Support/feedback channel is defined and active

---

## 14. Known Limitations

| # | Limitation | Impact |
|---|------------|--------|
| 1 | No delete-agent endpoint | Test agents created during beta persist in DB; no self-service cleanup |
| 2 | TypeORM `typeorm-ts-node-commonjs` path was broken — now fixed (BETA-READY-MIGRATION-CLI-01) | Future migration commands should work via `npm run migration:run`; compiled fallback (`migration:run:prod`) still available |
| 3 | Test agent "Beta Smoke Test Agent" remains in local development DB | Local DB only; clearly named; acceptable retention |
| 4 | Test agent ID from B3 smoke was not recorded | Agent identified by name only |
| 5 | AI agent execution not activated | Users can create agents but cannot dispatch them to perform tasks |
| 6 | Update/delete agent lifecycle not implemented | No `PUT`, `PATCH`, `DELETE` agent endpoints |
| 7 | No formal security audit | Standard session/guard patterns in place but no penetration testing |
| 8 | No real-time monitoring or alerting | Manual inspection required if issues arise |
| 9 | 10 pre-existing API Gateway integration test failures | Require Docker/PostgreSQL runtime; pre-existing, not caused by MVP work; targeted tests all pass |
| 10 | Cross-user isolation not live-smoked with multiple users | Code-level isolation via `SessionCookieGuard` + user-scoped DB queries; not live-tested with two simultaneous users |
| 11 | Full suite `npm test` (api-gateway) exits code 1 due to pre-existing integration failures | Not a regression; targeted tests pass |
| 12 | Production/staging environment not yet verified | Must be Keith-verified before user invite |

---

## 15. Known Local Test Data

| Field | Value |
|-------|-------|
| Agent name | Beta Smoke Test Agent |
| Agent role | (Beta smoke validator — created during B3 local smoke) |
| Agent description | Created during B3 local full-stack smoke to verify DB-backed Create Agent persistence. |
| Agent ID | Not visible / not provided during smoke |
| DB environment | Local development database (`aisandbox-postgres` container, localhost:5432) |
| Retention | Remains in local development DB — no delete endpoint exists |
| Concern level | Low — local DB only; clearly named; not in staging or production |

---

## 16. Monitoring / Rollback Expectations

**Current monitoring state:** Not formally configured. Health endpoints exist and are verified passing locally.

**Rollback / restart path (must be verified by Keith before beta invite):**

| # | Scenario | Expected Action |
|---|----------|-----------------|
| 1 | API Gateway crash / unresponsive | SSH to server; `docker compose restart api-gateway` or equivalent |
| 2 | Frontend crash / unresponsive | SSH to server; `docker compose restart frontend` or equivalent |
| 3 | Database issue | SSH to server; check `docker compose ps`; check PostgreSQL logs |
| 4 | Bad deployment / regression | SSH to server; `git checkout` or restore previous image; restart services |
| 5 | Full rollback | Keith-only; restore from last known-good deployment |

**Keith must confirm** that a rollback/restart path is known and accessible before inviting users.

**Monitoring recommendation (post-beta):**
- Add structured logging aggregation (e.g., log to file + tail; or external service)
- Add uptime monitoring (simple HTTP health ping)
- Add error alerting on 5xx rates

---

## 17. Support / Feedback Collection Plan

**Must be defined by Keith before inviting users.** This document does not define the channel — it records what must be in place.

| # | Item | Required Before Invite |
|---|------|----------------------|
| 1 | Primary feedback channel | YES — define the channel (e.g., private Slack, email, Notion form, etc.) |
| 2 | Keith as primary point of contact | YES |
| 3 | Mechanism to receive bug reports | YES |
| 4 | Expectation-setting message for beta users | YES — inform users of MVP scope and limitations |
| 5 | SLA / response time expectation set | YES — even if informal ("best effort during beta") |

---

## 18. Go / No-Go Criteria

### GO

Proceed to user invite only if ALL of the following are true:

- [ ] Deployment target is chosen and provisioned
- [ ] Environment variables are configured by Keith in the target environment (without exposing secrets here)
- [ ] Migration status is verified: `user_agents` table exists in the target DB
- [ ] Login works end-to-end in the target environment (session cookie set, user returned from `/api/auth/me`)
- [ ] `/[locale]/platform` works and is auth-guarded in the target environment
- [ ] Create Agent create / list / refresh works in the target environment
- [ ] zh-TW / zh-CN smoke is acceptable in the target environment (no obvious hardcoded English)
- [ ] Rollback / restart path is known and accessible by Keith
- [ ] Support / feedback channel is defined and active
- [ ] Keith has explicitly reviewed this checklist and approved the invite
- [ ] Health endpoints (`/api/health`, `/api/health/db`, `/api/health/ready`) return 200 in the target environment
- [ ] TLS / HTTPS is confirmed at the reverse proxy level (or an alternative secure delivery path is explicitly accepted by Keith)

### NO-GO

Do NOT invite users if ANY of the following are true:

- [ ] Migration status in the target environment is uncertain or unverified
- [ ] Auth / session is broken in the target environment
- [ ] Create Agent fails in the target environment
- [ ] Deployment target is uncertain or not provisioned
- [ ] Secrets / environment variables are uncertain or may contain placeholder values
- [ ] A serious i18n / layout blocker is visible in the target environment
- [ ] Data loss risk exists (e.g., database migration would drop data, or backup does not exist)
- [ ] No rollback / restart path is known
- [ ] Keith has not explicitly reviewed this checklist and approved the invite
- [ ] Support / feedback channel is not defined

---

## 19. Recommended Next Tasks Before Inviting Users

These tasks are recommended but not registered by this document. Registration requires Keith explicit approval per governance rules.

| # | Recommended Task | Priority | Reason |
|---|-----------------|----------|--------|
| 1 | Private beta deployment / staging readiness check | CRITICAL | Verify target environment, environment variables, health, migration, auth, platform, and Create Agent flow end-to-end in the deployment target before any invite |
| 2 | Target-environment migration verification | CRITICAL | `user_agents` must exist in the target DB; `migration:show` must confirm no pending migrations; B3 migration was local-only |
| 3 | Limited invite checklist execution | HIGH | Execute this Go/No-Go checklist against the target environment; record results; Keith approves invite only if all GO |
| 4 | Optional: local test-data cleanup task | LOW | Register a tiny task to add a soft-delete or cleanup endpoint if local test agent retention becomes a concern |
| 5 | Optional: production monitoring / logging readiness task | MEDIUM | Add structured logging, uptime monitoring, and basic error alerting before broader beta expansion |
| 6 | Later: RPG enhancement — walking character / pixel office | LOW | Post-beta UX enhancement for the game-engine RPG surface (walking character, pixel map); explicitly not in this MVP |

---

## 20. Keith Manual Approval Checklist

Before inviting any user to the limited private beta, Keith must personally verify and check each item:

### Environment / Deployment

- [ ] Deployment target chosen and provisioned
- [ ] Reverse proxy / TLS configured
- [ ] PostgreSQL running and accessible
- [ ] Redis running and accessible
- [ ] API Gateway running (`docker compose up api-gateway` or equivalent)
- [ ] Frontend running (`docker compose up frontend` or equivalent)
- [ ] All required environment variables set (no placeholder values)
- [ ] `NODE_ENV` set to `production` or `staging` as appropriate

### Migration

- [ ] API Gateway build is current (`npm run build` in `services/api-gateway`)
- [ ] `migration:show` shows no unexpected pending migrations
- [ ] `migration:run` or `migration:run:prod` executed successfully in target environment
- [ ] `user_agents` table verified to exist in target DB
- [ ] Database backup exists before migration execution

### Functional Smoke (Target Environment)

- [ ] Health endpoints return 200 (`/api/health`, `/api/health/db`, `/api/health/ready`)
- [ ] Unauthenticated `GET /api/agents` returns 401
- [ ] Login works; session cookie set
- [ ] `/en/platform` accessible and auth-guarded
- [ ] `/zh-TW/platform` accessible and auth-guarded
- [ ] `/zh-CN/platform` accessible and auth-guarded
- [ ] Workspace → platform CTA navigation works
- [ ] Create Agent form: submit, see success, agent appears in Your Agents
- [ ] Refresh persistence: created agent survives page reload
- [ ] Static system agents display correctly
- [ ] Desktop layout acceptable
- [ ] Mobile layout acceptable
- [ ] No obvious hardcoded English on zh-TW / zh-CN routes

### Invite Readiness

- [ ] Rollback / restart path is known and accessible
- [ ] Support / feedback channel is defined and communicated to beta users
- [ ] Beta user expectation-setting message prepared (MVP scope, limitations, AI not active)
- [ ] Keith explicitly approves invite

---

## 21. Safety Boundaries

This document records the following safety boundaries that apply to the entire LIMITED-PRIVATE-BETA-HANDOFF task:

| # | Safety Boundary |
|---|----------------|
| 1 | No secrets in this document or any related document |
| 2 | No deployment performed from this task |
| 3 | No user invitations sent from this task |
| 4 | No migration execution from this task |
| 5 | No environment file editing from this task |
| 6 | No public launch claimed |
| 7 | No git commit or git push |
| 8 | No subagents used |
| 9 | No source, test, package, migration, entity, environment, Docker, or deployment files changed |
| 10 | No runtime, Docker, DB, browser, API, test, build, or migration execution |
| 11 | No `.env`, `.env.local`, `.env.staging`, `.env.production`, credential, key, certificate, or token files opened |

---

## 22. Exact Next Action

**Keith decision required.**

1. Review this checklist document.
2. Proceed to the recommended next task: **Private Beta Deployment / Staging Readiness Check** — verify the target environment, environment variables, migration, health, auth, platform, and Create Agent flow end-to-end.
3. After deployment/staging readiness is confirmed: execute the Keith Manual Approval Checklist (Section 20).
4. Only after all GO criteria are confirmed and Keith explicitly approves: proceed with limited beta invite (1–3 trusted users maximum, Keith first).

**No beta invite may occur without Keith explicit approval. Public launch is not approved.**

---

**Document created:** 2026-07-21
**Predecessor evidence:** `docs/BETA-READY-SMOKE-CHECKPOINT.md`, `docs/BETA-READY-SMOKE-EXECUTION.md`, `docs/BETA-READY-MIGRATION-CLI-01-CHECKPOINT.md`, `docs/AGENT-PLATFORM-CREATE-01B-CHECKPOINT.md`, `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md`, `docs/AGENT-PLATFORM-RPG-03B-CHECKPOINT.md`, `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md`, `docs/BETA-READY-DEPLOYMENT-CONFIG-CHECKPOINT.md`
**Governance status:** DRAFT — awaiting Keith explicit approval for beta invite execution
