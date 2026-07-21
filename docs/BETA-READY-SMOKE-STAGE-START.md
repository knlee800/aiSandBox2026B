# BETA-READY-SMOKE / B3 — Stage-Start / Runtime + Migration + Smoke Plan

**Task ID:** BETA-READY-SMOKE (B3)
**Step:** 2 — Stage-Start / Runtime + Migration + Smoke Plan
**Status:** COMPLETE — 2026-07-21
**Date:** 2026-07-21
**Nature:** Planning only — no source, test, translation, package, migration, entity, environment, Docker, or governance files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BETA-READY-SMOKE (B3) |
| Title | Pre-Beta Full-Stack Live Smoke |
| Family | BETA READINESS / FULL-STACK SMOKE / LIVE VALIDATION |
| Risk | HIGH — 4-step full-stack smoke loop |
| Step 1 | COMPLETE — Registration — 2026-07-21 |
| Step 2 | COMPLETE — Stage-Start / Runtime + Migration + Smoke Plan — 2026-07-21 (this document) |
| Step 3 | Pending — Execution |
| Step 4 | Pending — Consolidation / Checkpoint |
| Keith Approval | "go" — 2026-07-21 |
| Prerequisite Slices | RPG-03A, RPG-03B, CREATE-01A, CREATE-01B — all COMPLETE and LOCKED — 2026-07-20 |
| BETA-READY-DEPLOYMENT-CONFIG | COMPLETE and LOCKED — 2026-07-20 |
| AGENT-HARNESS-WRITE-CANARY | COMPLETE and LOCKED — 2026-07-20 |

---

## 2. Stage-Start Purpose

This document answers all 37 stage-start questions and provides the exact Step 3 plan for executing B3.

B3 is smoke-only. No feature or source changes. No deployment. Local development environment only.

---

## 3. Files Inspected

### Governance / Checkpoint Documents

1. `TASKS.md`
2. `TASKS_BACKLOG_FULL.md`
3. `docs/AINOW-EXECUTION-ROADMAP.md`
4. `docs/AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md`
5. `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md`
6. `docs/AGENT-PLATFORM-RPG-03B-CHECKPOINT.md`
7. `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md`
8. `docs/AGENT-PLATFORM-CREATE-01B-CHECKPOINT.md`
9. `docs/BETA-READY-DEPLOYMENT-CONFIG-CHECKPOINT.md`
10. `docs/AGENT-HARNESS-WRITE-CANARY-CHECKPOINT.md`

### Runtime / Config Files (Read-Only Inspection)

11. `package.json` (root)
12. `frontend/package.json`
13. `services/api-gateway/package.json`
14. `services/api-gateway/src/migrations/` (26 migration files listed)
15. `services/api-gateway/data-source.ts` (TypeORM CLI data source — `DATABASE_URL` only)
16. `services/api-gateway/src/config/database.config.ts` (runtime database config)
17. `services/api-gateway/src/app.module.ts`
18. `services/api-gateway/src/main.ts` (port, global prefix)
19. `services/api-gateway/src/health/health.controller.ts`
20. `services/api-gateway/src/health/health.module.ts`
21. `docker-compose.yml`
22. `docker-compose.local-testing.yml` (exists, not read in detail — presence noted)
23. `docker-compose.prod.yml` (exists, not read in detail — presence noted)
24. `.env.example`
25. `services/api-gateway/src/migrations/1772500000000-CreateUserAgentsTable.ts`

### Files Not Found / Not Present

- `services/api-gateway/src/data-source.ts` — does not exist (data source is at `services/api-gateway/data-source.ts`)
- `services/api-gateway/src/database.config.ts` — does not exist (config is at `services/api-gateway/src/config/database.config.ts`)
- `services/api-gateway/src/app.controller.ts` — does not exist (controllers are in modules)
- `.env.staging.example` — does not exist at repo root (was expected from BETA-READY-DEPLOYMENT-CONFIG; may be in a different location or not committed)
- `.env.production.example` — does not exist at repo root (same note)
- `.env.local.example` — does not exist

### Files NOT Opened (Secret Safety)

No `.env`, `.env.local`, `.env.staging`, `.env.production`, secret, credential, key, certificate, or token files were opened.

---

## 4. Current Completed-Slice Baseline

All four prerequisite slices from AGENT-PLATFORM-RPG-MVP-RESET are COMPLETE and LOCKED:

| # | Slice | Status | Date |
|---|-------|--------|------|
| 1 | AGENT-PLATFORM-RPG-03A — Platform Dashboard Visual Identity + Agent Detail Panel | COMPLETE and LOCKED | 2026-07-20 |
| 2 | AGENT-PLATFORM-RPG-03B — Platform Link from Workspace + Auth Guard Review | COMPLETE and LOCKED | 2026-07-20 |
| 3 | AGENT-PLATFORM-CREATE-01A — Create Agent Backend Minimal Persistence | COMPLETE and LOCKED | 2026-07-20 |
| 4 | AGENT-PLATFORM-CREATE-01B — Create Agent MVP UI | COMPLETE and LOCKED | 2026-07-20 |

Additional prerequisites:

| # | Task | Status | Date |
|---|------|--------|------|
| 5 | BETA-READY-DEPLOYMENT-CONFIG | COMPLETE and LOCKED | 2026-07-20 |
| 6 | AGENT-HARNESS-WRITE-CANARY | COMPLETE and LOCKED | 2026-07-20 |
| 7 | BETA-READY-00 | COMPLETE and LOCKED | 2026-07-19 |
| 8 | BILLING-READY-06A (Docker/DB/Migration) | COMPLETE and LOCKED | 2026-07-16 |
| 9 | BILLING-READY-06B (Backend Runtime + Browser Smoke) | COMPLETE and LOCKED | 2026-07-17 |
| 10 | BILLING-READY-07 (Authenticated Billing Data Smoke) | COMPLETE and LOCKED | 2026-07-17 |

Key deferred items that B3 must verify:

- `user_agents` migration — created in CREATE-01A but NOT executed
- Authenticated platform access at `/[locale]/platform` — deferred by RPG-03B
- Live DB-backed Create Agent create/list flow — deferred by CREATE-01B
- Cross-locale UI checks — partially deferred

---

## 5. Runtime / Service Map

| # | Service | Port | Role | Required for B3 |
|---|---------|------|------|-----------------|
| 1 | PostgreSQL | 5432 | Primary data store | YES |
| 2 | Redis | 6379 | BullMQ queue, execution streaming | YES (API Gateway requires Redis for BullMQ/queue module) |
| 3 | API Gateway (NestJS) | 4000 | Auth, session, billing, agents API, health | YES |
| 4 | Frontend (Next.js) | 3002 | User-facing web application | YES |
| 5 | Container Manager | 4002 | Docker container lifecycle | NO — not required for platform dashboard, agent creation, or billing smoke |
| 6 | AI Service Worker | 4001 | BullMQ worker, AI agent harness | NO — not required for agent CRUD or platform UI smoke |
| 7 | Docker Engine | — | User sandbox containers | NO — not running user sandboxes during this smoke |
| 8 | Prometheus | 9090 | Monitoring | NO |
| 9 | Grafana | 3000 | Dashboards | NO |

---

## 6. Port Map

| Port | Service | Exposed To |
|------|---------|-----------|
| 5432 | PostgreSQL (`aisandbox-postgres`) | localhost only |
| 6379 | Redis (`aisandbox-redis`) | localhost only |
| 4000 | API Gateway | localhost only (global prefix: `/api`) |
| 3002 | Frontend (Next.js) | localhost only |

---

## 7. Docker / PostgreSQL / Redis Requirement

| Infrastructure | Required | Reason |
|----------------|----------|--------|
| Docker Desktop | YES | Runs PostgreSQL and Redis containers via `docker-compose.yml` |
| PostgreSQL container (`aisandbox-postgres`) | YES | Primary data store; migration target; API Gateway requires DB connection |
| Redis container (`aisandbox-redis`) | YES | API Gateway startup requires Redis for BullMQ queue module; without Redis, API Gateway may fail to start or hang on queue connection |

**Why Redis is required:** The API Gateway imports `AIModule`, which depends on `QueueService`/BullMQ, which requires a Redis connection. Even though we are not executing AI jobs during this smoke, the module wiring requires Redis at startup time.

**Evidence from prior smokes:** BILLING-READY-06A started both PostgreSQL and Redis. BILLING-READY-06B confirmed API Gateway started successfully with both running. AGENT-HARNESS-WRITE-CANARY-B also used both.

---

## 8. Migration Readiness Plan

### Current Migration State

26 migration files exist in `services/api-gateway/src/migrations/`.

Last known executed state (from BILLING-READY-06A — 2026-07-16): 24 migrations executed, 0 pending.

Since BILLING-READY-06A, one new migration was added:

| # | Migration | Task | Executed |
|---|-----------|------|----------|
| 25 | `1772500000000-CreateUserAgentsTable.ts` | AGENT-PLATFORM-CREATE-01A | NO |

**Expected migration:show output:** 25 executed + 1 pending (the `user_agents` migration).

**Note:** The 26th file in the migrations directory is `README.md` — not a migration class.

### Migration Command Pattern

The TypeORM CLI data source (`services/api-gateway/data-source.ts`) requires `DATABASE_URL` environment variable. It does NOT read `POSTGRES_*` individual variables.

Migration commands must be run from `services/api-gateway/` directory with `DATABASE_URL` set.

---

## 9. Non-Destructive Migration Command Plan

### Check migration status (non-destructive, read-only)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
$env:DATABASE_URL = "postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/aisandbox"
npx typeorm-ts-node-commonjs migration:show -d data-source.ts
```

**Expected output:** All previously executed migrations marked with `[X]`, and `CreateUserAgentsTable1772500000000` marked with `[ ]` (pending).

### Execute pending migrations (non-destructive, additive only)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
$env:DATABASE_URL = "postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/aisandbox"
npx typeorm-ts-node-commonjs migration:run -d data-source.ts
```

**Expected output:** `CreateUserAgentsTable1772500000000` executed successfully.

### How the migration command avoids printing secrets

The `DATABASE_URL` is set via PowerShell `$env:DATABASE_URL` — a process-scoped environment variable. The local development password (`aisandbox_dev_password_change_in_production`) is the `.env.example` default — not a real secret. It is already visible in `.env.example` in the repository.

**Stop condition:** If the `DATABASE_URL` points to any non-localhost host, STOP and confirm with Keith before executing.

### Verify `user_agents` table exists after migration

```powershell
docker exec -it aisandbox-postgres psql -U aisandbox -d aisandbox -c "\dt user_agents"
```

**Expected output:** A table listing showing `user_agents` in the `public` schema.

Alternative verification without exposing connection details:

```powershell
docker exec -it aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'user_agents';"
```

**Expected output:** One row: `user_agents`.

---

## 10. Health Check Plan

### Non-destructive health checks (after API Gateway starts)

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | API Gateway alive | `Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing` | 200 — `{ status: 'ok', service: 'api-gateway' }` |
| 2 | API Gateway DB | `Invoke-WebRequest -Uri "http://localhost:4000/api/health/db" -UseBasicParsing` | 200 — `{ status: 'ok', database: 'connected' }` |
| 3 | API Gateway ready | `Invoke-WebRequest -Uri "http://localhost:4000/api/health/ready" -UseBasicParsing` | 200 — `{ status: 'ready', checks: { environment: 'validated', database: 'connected', killSwitches: 'loaded', safetyLimits: 'loaded' } }` |

---

## 11. Frontend / Backend Startup Plan

### Infrastructure start

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"
docker compose up -d postgres redis
```

Wait for health checks:

```powershell
docker exec -it aisandbox-postgres pg_isready -U aisandbox -d aisandbox
docker exec -it aisandbox-redis redis-cli ping
```

### API Gateway start

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npm run dev
```

Wait for console output confirming `Listening on: http://localhost:4000`.

### Frontend start

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"
npm run dev
```

Wait for Next.js dev server ready message on port 3002.

---

## 12. Auth / Session Verification Plan

### Login / Auth setup required

Keith must have a registered user account in the local database. If no account exists, Keith must register via `http://localhost:3002/en/register`.

The auth flow uses:
- `POST /api/auth/register` — creates user + sends verification email (stub provider in local dev)
- `POST /api/auth/login` — returns session cookie (`aisandbox_session`)
- `GET /api/auth/me` — validates session and returns user identity

### Auth check

| # | Check | Owner | Method |
|---|-------|-------|--------|
| 1 | Login at `http://localhost:3002/en/login` | Keith (browser) | Manual |
| 2 | Verify session cookie set (`aisandbox_session`) | Keith (browser DevTools) | Manual |
| 3 | `GET /api/auth/me` returns valid user | Cursor (optional safe check) | `Invoke-WebRequest -Uri "http://localhost:4000/api/auth/me" -UseBasicParsing` — will return 401 without cookie, confirming guard is active |

**Which service owns `/api/auth/me`:** API Gateway (`:4000`), under global prefix `/api`, route `/auth/me`.

---

## 13. Browser / Manual Smoke Checklist for Keith

Keith performs all browser checks manually after infrastructure, API Gateway, and frontend are running and Keith is logged in.

### Platform Access (Authenticated)

| # | Check | URL | Expected | Locale |
|---|-------|-----|----------|--------|
| 1 | Authenticated `/en/platform` access | `http://localhost:3002/en/platform` | RPG command-center dashboard renders; no auth redirect | en |
| 2 | Authenticated `/zh-TW/platform` access | `http://localhost:3002/zh-TW/platform` | Same dashboard, Traditional Chinese copy | zh-TW |
| 3 | Authenticated `/zh-CN/platform` access | `http://localhost:3002/zh-CN/platform` | Same dashboard, Simplified Chinese copy | zh-CN |

### Workspace CTA Routing

| # | Check | URL | Expected |
|---|-------|-----|----------|
| 4 | Workspace home shows platform CTA | `http://localhost:3002/en/app` | "Command Center" CTA visible; links to `/en/platform` |
| 5 | CTA locale-correct on zh-TW | `http://localhost:3002/zh-TW/app` | CTA links to `/zh-TW/platform` |
| 6 | CTA locale-correct on zh-CN | `http://localhost:3002/zh-CN/app` | CTA links to `/zh-CN/platform` |

### Create Agent DB-Backed Smoke

| # | Check | URL / Action | Expected |
|---|-------|-------------|----------|
| 7 | "Your Agents" section visible | `/en/platform` | Section visible below static agent grid; may be empty initially |
| 8 | Click "Create Agent" CTA | `/en/platform` | Inline form appears in detail panel area |
| 9 | Fill form (name, role, description) | `/en/platform` | Form fields accept input |
| 10 | Submit form | `/en/platform` | Success banner appears; form auto-closes; new agent appears in "Your Agents" |
| 11 | Verify created agent persists after refresh | Refresh `/en/platform` | Created agent still visible (DB-backed persistence verified) |
| 12 | Verify created agent detail panel | Click created agent card | Detail panel shows name, role, description, status badge |

### Static System Agents Preservation

| # | Check | URL | Expected |
|---|-------|-----|----------|
| 13 | Builder Agent present | `/en/platform` | Builder Agent card visible with active status |
| 14 | Builder Agent detail panel | Click Builder Agent | Detail panel shows "Start Building" CTA |
| 15 | Builder CTA routes to workspace | Click "Start Building" | Navigates to `/en/app` |
| 16 | Coming-soon agents present | `/en/platform` | Chief of Staff, Product Strategy, Technology Advisor visible with coming-soon status |
| 17 | Coming-soon agent detail | Click any coming-soon agent | Detail panel shows coming-soon messaging, no functional CTA |

### Mobile / Responsive Smoke (~390px)

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 18 | Platform dashboard at ~390px | Browser DevTools → responsive mode → 390px width | No horizontal overflow; cards stack vertically; detail panel below |
| 19 | Create Agent form at ~390px | Open form at 390px width | Form fields full-width; submit/cancel visible |
| 20 | Agent detail panel at ~390px | Select agent at 390px width | Detail panel renders below station grid |

### No-Hardcoded-English Check

| # | Check | URL | Expected |
|---|-------|-----|----------|
| 21 | `/zh-TW/platform` — no English UI text | `http://localhost:3002/zh-TW/platform` | All visible UI copy in Traditional Chinese; no untranslated English strings |
| 22 | `/zh-CN/platform` — no English UI text | `http://localhost:3002/zh-CN/platform` | All visible UI copy in Simplified Chinese; no untranslated English strings |
| 23 | Create Agent form on zh-TW | Open form on `/zh-TW/platform` | Form labels, placeholders, buttons, validation messages in Traditional Chinese |
| 24 | Create Agent form on zh-CN | Open form on `/zh-CN/platform` | Form labels, placeholders, buttons, validation messages in Simplified Chinese |

---

## 14. Safe API Check Plan

Cursor may run the following safe, non-destructive API checks **only after Step 3 begins and only if the API Gateway is already running**:

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | Health alive | `Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing` | 200 |
| 2 | Health DB | `Invoke-WebRequest -Uri "http://localhost:4000/api/health/db" -UseBasicParsing` | 200 |
| 3 | Health ready | `Invoke-WebRequest -Uri "http://localhost:4000/api/health/ready" -UseBasicParsing` | 200 |
| 4 | Auth guard active | `Invoke-WebRequest -Uri "http://localhost:4000/api/auth/me" -UseBasicParsing` | 401 (no cookie — confirms guard is active) |
| 5 | Agents guard active | `Invoke-WebRequest -Uri "http://localhost:4000/api/agents" -UseBasicParsing` | 401 (no cookie — confirms SessionCookieGuard) |
| 6 | Billing guard active | `Invoke-WebRequest -Uri "http://localhost:4000/api/billing/balance" -UseBasicParsing` | 401 (no cookie — confirms guard) |

Cursor MUST NOT:
- Send authenticated requests (no session cookie available to Cursor)
- Create, modify, or delete data via API
- Call internal service endpoints
- Call AI execution endpoints

---

## 15. Test Data Plan

### Test agent to be created during smoke

| Field | Value |
|-------|-------|
| Name | Beta Smoke Test Agent |
| Role | Validates end-to-end agent creation for pre-beta smoke |
| Description | This agent was created during BETA-READY-SMOKE B3 Step 3 to verify DB-backed agent persistence works correctly in a full-stack local environment. |

### Test agent naming convention

Use the prefix "Beta Smoke Test" so the agent is clearly identifiable as test data.

---

## 16. Cleanup / Data-Retention Note

**No delete endpoint exists.** `DELETE /api/agents/:id` was explicitly excluded from CREATE-01A's scope (non-goal #2 in CREATE-01A checkpoint).

The test agent created during this smoke will remain in the local database.

**Acceptable because:**
- This is a local development database only
- The test agent is clearly named ("Beta Smoke Test Agent")
- Soft-delete infrastructure exists on the entity (`deletedAt` column) but no endpoint exposes it
- If a cleanup task is created later, the agent can be identified by name
- If Keith resets the local database, the test agent is removed with the volume

**Record for future reference:** The test agent name and ID should be recorded in the Step 3 execution report.

---

## 17. Cross-Locale UI Plan

| # | Locale | Routes to Check | Check Type |
|---|--------|----------------|------------|
| 1 | `en` | `/en/platform`, `/en/app` | Baseline English — Keith browser |
| 2 | `zh-TW` | `/zh-TW/platform`, `/zh-TW/app` | Traditional Chinese — Keith browser |
| 3 | `zh-CN` | `/zh-CN/platform`, `/zh-CN/app` | Simplified Chinese — Keith browser |

For each locale:
- Platform dashboard renders correctly
- Agent station cards display correctly
- Detail panel text is locale-correct
- Create Agent form labels/placeholders/buttons are locale-correct
- "Your Agents" section heading is locale-correct
- Workspace CTA text is locale-correct
- No untranslated English strings visible on zh-TW/zh-CN routes

---

## 18. Create Agent DB-Backed Smoke Plan

Detailed sequence:

1. Keith navigates to `/en/platform` (authenticated)
2. Observe "Your Agents" section — should be empty (no user agents exist yet)
3. Click "Create Agent" CTA
4. Form appears in detail panel area
5. Fill form: name = "Beta Smoke Test Agent", role = "Validates end-to-end agent creation for pre-beta smoke", description = (per test data plan above)
6. Click submit
7. Observe success banner
8. Observe form closes automatically
9. Observe new agent appears in "Your Agents" section
10. Refresh the page (F5)
11. Verify agent persists after refresh — DB-backed persistence confirmed
12. Click the created agent card
13. Verify detail panel shows correct name, role, description, status badge
14. Record the agent's ID from browser network tab or response if visible

---

## 19. Static System Agents Preservation Check

Verify that static system agents are unchanged after Create Agent operations:

| # | Agent | Expected Status | Expected Behavior |
|---|-------|----------------|-------------------|
| 1 | Builder Agent | Active | Detail panel shows "Start Building" CTA → `/en/app` |
| 2 | Chief of Staff | Coming Soon | Detail panel shows coming-soon messaging |
| 3 | Product Strategy | Coming Soon | Detail panel shows coming-soon messaging |
| 4 | Technology Advisor | Coming Soon | Detail panel shows coming-soon messaging |

`agent-registry.ts` was NOT modified by any of the four prerequisite slices. Static agents remain frontend-only constants.

---

## 20. Mobile / Responsive Smoke Plan

| # | Check | Width | Route | Expected |
|---|-------|-------|-------|----------|
| 1 | Platform dashboard | ~390px | `/en/platform` | Cards stack vertically; no horizontal overflow |
| 2 | Agent detail panel | ~390px | `/en/platform` (agent selected) | Panel renders below grid; readable |
| 3 | Create Agent form | ~390px | `/en/platform` (form open) | Form inputs full-width; buttons visible |
| 4 | "Your Agents" section | ~390px | `/en/platform` | User agent cards stack vertically |
| 5 | Workspace CTA | ~390px | `/en/app` | CTA visible and tappable |

Method: Chrome DevTools → Toggle Device Toolbar → set width to 390px.

---

## 21. No-Hardcoded-English Check

| # | Route | Method | Expected |
|---|-------|--------|----------|
| 1 | `/zh-TW/platform` | Visual scan of all visible text | All Traditional Chinese — no English words in UI copy (icon labels, button text, headings, form labels, status badges, empty state, detail panel) |
| 2 | `/zh-CN/platform` | Visual scan of all visible text | All Simplified Chinese — no English words in UI copy |
| 3 | `/zh-TW/platform` Create Agent form | Open form, scan labels/placeholders | All Traditional Chinese |
| 4 | `/zh-CN/platform` Create Agent form | Open form, scan labels/placeholders | All Simplified Chinese |

**Exception:** Brand names (e.g., "ainow", "AI") may appear in English. These are not translation failures.

---

## 22. PASS / PASS WITH LIMITATION / FAIL Criteria

### PASS

All of the following must be true:

- [ ] Docker infrastructure starts (PostgreSQL + Redis healthy)
- [ ] `user_agents` migration executes successfully
- [ ] `user_agents` table exists in database
- [ ] API Gateway starts and all 3 health endpoints return 200
- [ ] Frontend starts on port 3002
- [ ] Keith can register/login
- [ ] `GET /api/auth/me` returns valid user in authenticated session
- [ ] Authenticated `/en/platform` renders RPG command-center dashboard
- [ ] Authenticated `/zh-TW/platform` renders correctly localized
- [ ] Authenticated `/zh-CN/platform` renders correctly localized
- [ ] Workspace CTA routes to correct locale platform path
- [ ] Create Agent form works end-to-end (submit + agent appears)
- [ ] Created agent persists after page refresh
- [ ] Static system agents (4) unchanged
- [ ] Builder Agent CTA routes to workspace
- [ ] No horizontal overflow at ~390px mobile width
- [ ] No hardcoded English on zh-TW/zh-CN platform routes

### PASS WITH LIMITATION

PASS criteria are met except for clearly documented non-blocking limitations. Examples:

- A zh-TW or zh-CN translation has a minor wording issue but is not English
- Mobile width has a minor visual imperfection but no functional breakage
- A non-critical browser console warning appears

### FAIL

Any of the following:

- Docker infrastructure fails to start
- Migration fails
- API Gateway fails to start or health checks fail
- Frontend fails to start
- Login/registration fails
- Authenticated platform access fails (redirects to login incorrectly)
- Create Agent form submit fails (API error, data not persisted)
- Created agent does not persist after refresh
- Static system agents are missing or changed
- Hardcoded English visible on zh-TW/zh-CN platform routes (excluding brand names)
- Horizontal overflow at ~390px breaks layout

---

## 23. Stop Conditions

STOP immediately if:

1. `DATABASE_URL` points to a non-localhost host
2. Migration command targets staging or production database
3. `docker compose down -v` is about to be executed (requires Keith explicit approval)
4. Any secret-bearing `.env` file would need to be opened or printed
5. Service startup requires missing secrets that cannot be resolved from `.env.example` defaults
6. Service startup requires broad code changes
7. Environment appears to point to non-local DB
8. Any destructive DB command is about to be executed
9. Step 3 would require deployment
10. Step 3 would require source/test/translation/package/migration/entity changes
11. Redis requirement is unclear after first startup attempt

---

## 24. Evidence Collection Requirements

Step 3 must collect and record:

| # | Evidence | Format |
|---|----------|--------|
| 1 | Docker container status | `docker ps` output |
| 2 | PostgreSQL health | `pg_isready` output |
| 3 | Redis health | `redis-cli ping` output |
| 4 | Migration status before | `migration:show` output |
| 5 | Migration execution | `migration:run` output |
| 6 | Migration status after | `migration:show` output or `\dt user_agents` |
| 7 | API Gateway health | `/api/health` response |
| 8 | API Gateway DB health | `/api/health/db` response |
| 9 | API Gateway readiness | `/api/health/ready` response |
| 10 | Auth guard active | `/api/auth/me` 401 response |
| 11 | Agents guard active | `/api/agents` 401 response |
| 12 | Keith browser screenshots or confirmation | Platform access, locale checks, mobile, Create Agent |
| 13 | Test agent name and ID | From Create Agent operation |
| 14 | Final PASS / PASS WITH LIMITATION / FAIL verdict | With explanation |
| 15 | Blockers and next action | If any |

---

## 25. Step 3 Exact Command Plan

All commands use PowerShell. All paths are absolute. No destructive commands. No `docker compose down -v`. No commands that print secrets.

### Phase 1 — Pre-Flight

```powershell
# 1.1 Working tree check — verify no uncommitted critical changes
git -C "C:\Users\knlee\aiSandBox2026B" status

# 1.2 Confirm no destructive commands will be used
# (This is a manual confirmation — Step 3 must NOT use docker compose down -v, DROP, TRUNCATE, or DELETE without Keith approval)
```

### Phase 2 — Infrastructure

```powershell
# 2.1 Start PostgreSQL and Redis containers
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"
docker compose up -d postgres redis

# 2.2 Wait for PostgreSQL health (retry if needed)
docker exec -it aisandbox-postgres pg_isready -U aisandbox -d aisandbox

# 2.3 Wait for Redis health
docker exec -it aisandbox-redis redis-cli ping

# 2.4 Verify containers running
docker ps --filter "name=aisandbox"
```

**Keith confirmation required:** Confirm that the local `.env` file (if any) points to `localhost:5432` only. If no `.env` file exists, the `docker-compose.yml` uses `${POSTGRES_USER}` / `${POSTGRES_PASSWORD}` / `${POSTGRES_DB}` from the environment or defaults.

### Phase 3 — Migration

```powershell
# 3.1 Check migration status (read-only)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
$env:DATABASE_URL = "postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/aisandbox"
npx typeorm-ts-node-commonjs migration:show -d data-source.ts

# 3.2 Execute pending migrations (additive only — CREATE TABLE)
npx typeorm-ts-node-commonjs migration:run -d data-source.ts

# 3.3 Verify user_agents table exists
docker exec -it aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'user_agents';"
```

**Stop condition:** If `migration:show` reveals unexpected pending migrations beyond `CreateUserAgentsTable1772500000000`, STOP and assess.

### Phase 4 — API Gateway

```powershell
# 4.1 Start API Gateway in dev mode (new terminal)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npm run dev
```

Wait for console output: `Listening on: http://localhost:4000`.

**Note:** API Gateway reads its `.env` or environment for `DATABASE_URL` / `POSTGRES_*` variables. The `database.config.ts` auto-overrides `POSTGRES_HOST=postgres` to `localhost` in non-production mode. If `DATABASE_URL` is set, it takes priority.

### Phase 5 — Frontend

```powershell
# 5.1 Start frontend in dev mode (new terminal)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"
npm run dev
```

Wait for Next.js ready message on port 3002.

### Phase 6 — Health Checks (Cursor)

```powershell
# 6.1 API Gateway alive
Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing

# 6.2 API Gateway DB
Invoke-WebRequest -Uri "http://localhost:4000/api/health/db" -UseBasicParsing

# 6.3 API Gateway readiness
Invoke-WebRequest -Uri "http://localhost:4000/api/health/ready" -UseBasicParsing
```

### Phase 7 — Optional Safe API Checks (Cursor)

```powershell
# 7.1 Auth guard check (expect 401)
Invoke-WebRequest -Uri "http://localhost:4000/api/auth/me" -UseBasicParsing

# 7.2 Agents guard check (expect 401)
Invoke-WebRequest -Uri "http://localhost:4000/api/agents" -UseBasicParsing

# 7.3 Billing guard check (expect 401)
Invoke-WebRequest -Uri "http://localhost:4000/api/billing/balance" -UseBasicParsing
```

**Note:** 401 responses are expected and correct — they confirm the guards are active.

### Phase 8 — Keith Manual Browser Checks

Keith performs all browser checks from Section 13 manually:

1. Login at `http://localhost:3002/en/login`
2. Platform access (en, zh-TW, zh-CN)
3. Workspace CTA routing
4. Create Agent form + submit
5. Verify agent persists after refresh
6. Static system agents preservation
7. Mobile ~390px checks
8. No-hardcoded-English checks on zh-TW/zh-CN

### Phase 9 — Cleanup (after smoke)

```powershell
# 9.1 Stop frontend (Ctrl+C in frontend terminal)
# 9.2 Stop API Gateway (Ctrl+C in API Gateway terminal)

# 9.3 Stop Docker containers (preserve volumes)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"
docker compose stop postgres redis

# 9.4 Verify ports released
docker ps --filter "name=aisandbox"
```

**Do NOT use `docker compose down -v`.** Volumes are preserved.

---

## 26. Step 3 File Plan

### Files Step 3 should create

| # | File | Purpose |
|---|------|---------|
| 1 | `docs/BETA-READY-SMOKE-EXECUTION.md` | Step 3 execution report with all evidence |

### Files Step 3 should NOT create or modify

- Source files
- Test files
- Translation files
- Backend files
- Frontend files
- Migrations / entities / schema
- Package files
- Environment files
- Docker files
- `TASKS.md` (governance update belongs to Step 4)
- `TASKS_BACKLOG_FULL.md` (governance update belongs to Step 4)
- `docs/AINOW-EXECUTION-ROADMAP.md` (governance update belongs to Step 4)

---

## 27. Split Decision

**Step 3 should NOT be split into smaller child steps.**

Rationale:
- B3 smoke is a single bounded execution sequence
- All phases are sequential and interdependent (infrastructure → migration → backend → frontend → checks)
- The total scope is a single execution session
- Prior similar smokes (BILLING-READY-06A, 06B, 07) were not split
- The smoke produces a single pass/fail verdict

If a blocker is found during Step 3 that requires code changes, the smoke should be recorded as FAIL or PASS WITH LIMITATION, and the code fix should be a separate explicitly approved task (not a child slice of Step 3).

---

## 28. Risks and Stop Conditions

| # | Risk | Severity | Mitigation | Stop Condition |
|---|------|----------|------------|----------------|
| 1 | PostgreSQL container fails to start | MEDIUM | Verify Docker Desktop running; check port 5432 not in use | STOP if DB cannot be reached |
| 2 | Redis container fails to start | MEDIUM | Verify Docker Desktop running; check port 6379 not in use | STOP if Redis cannot be reached |
| 3 | Migration fails | HIGH | Verify local DB target; check migration file syntax | STOP if migration errors; do not retry without assessment |
| 4 | API Gateway fails to start | HIGH | Check console for DI errors, missing env vars | STOP if startup fails; record error; assess if code fix needed |
| 5 | API Gateway DI blocker (similar to BILLING-READY-06B) | HIGH | Prior DI fixes already applied in 06B | If new DI blocker, STOP and register separate fix task |
| 6 | Frontend fails to start | MEDIUM | Check for port conflicts on 3002 | STOP if frontend cannot serve pages |
| 7 | Login/auth fails | HIGH | Check session cookie behavior; verify user exists | STOP if auth is fundamentally broken |
| 8 | Create Agent API returns error | HIGH | Check DB connection, migration applied, user_agents table exists | Record error; may be FAIL |
| 9 | Hardcoded English on zh routes | MEDIUM | Visual scan; compare against translation keys | Record as defect if found; PASS WITH LIMITATION or FAIL |
| 10 | Test agent data remains in DB | LOW | No delete endpoint; agent remains; record name/ID | Acceptable — local DB only |
| 11 | Port conflict with prior services | MEDIUM | Ensure prior dev servers stopped | STOP if ports 4000, 3002, 5432, 6379 occupied |
| 12 | Local DB has stale/incompatible schema | LOW | `migration:show` will reveal discrepancies | STOP if unexpected schema state |

---

## 29. Safety Confirmations

- [x] No destructive DB commands in the Step 3 plan.
- [x] No `docker compose down -v` in the Step 3 plan.
- [x] No production/staging migration targets in the Step 3 plan.
- [x] No deployment in the Step 3 plan.
- [x] No secret-bearing environment files opened or printed.
- [x] No `.env` files edited in the Step 3 plan.
- [x] No git commit or push in the Step 3 plan.
- [x] No subagents used.
- [x] Stop conditions clearly documented for non-local DB targets.
- [x] Stop conditions clearly documented for staging/production migration targets.
- [x] Stop conditions clearly documented for missing secrets.
- [x] Stop conditions clearly documented for broad code changes requirement.
- [x] Local development environment only — `DATABASE_URL` points to `localhost:5432`.
- [x] Migration password is the `.env.example` default — not a real production secret.
- [x] Test-created agent data retention is acceptable in local DB.

---

## 30. Stage-Start Questions Answered

### Q1: Which services must run for B3?

PostgreSQL, Redis, API Gateway, Frontend. See Section 5.

### Q2: Which ports should be used?

5432 (PostgreSQL), 6379 (Redis), 4000 (API Gateway), 3002 (Frontend). See Section 6.

### Q3: Which service owns `/api/auth/me`?

API Gateway (`:4000`), under global prefix `/api`, route `/auth/me`. AuthModule.

### Q4: Which service owns `/api/agents`?

API Gateway (`:4000`), under global prefix `/api`, route `/agents`. UserAgentModule (CREATE-01A).

### Q5: Which frontend URL should Keith open?

`http://localhost:3002/en/platform` (and `/zh-TW/platform`, `/zh-CN/platform` for locale checks).

### Q6: Which backend health endpoints should be checked?

`GET /api/health`, `GET /api/health/db`, `GET /api/health/ready`. See Section 10.

### Q7: Is Redis required for this smoke?

YES. API Gateway startup requires Redis for BullMQ queue module. See Section 7.

### Q8: Is container-manager required for this smoke?

NO. B3 does not exercise user sandbox containers, file operations, or preview. See Section 5.

### Q9: Is ai-service required for this smoke?

NO. B3 does not exercise AI execution, agent harness, or tool loop. See Section 5.

### Q10: Is agent execution required for this smoke?

NO. B3 verifies platform dashboard, agent CRUD, locale UI, and auth. No AI execution.

### Q11: Which Docker containers must be running?

`aisandbox-postgres` and `aisandbox-redis` only. See Section 7.

### Q12: What is the exact safe command to start required infrastructure?

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis
```

### Q13: What is the exact safe command to check migration status?

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
$env:DATABASE_URL = "postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/aisandbox"
npx typeorm-ts-node-commonjs migration:show -d data-source.ts
```

### Q14: What is the exact safe command to execute only pending migrations?

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
$env:DATABASE_URL = "postgresql://aisandbox:aisandbox_dev_password_change_in_production@localhost:5432/aisandbox"
npx typeorm-ts-node-commonjs migration:run -d data-source.ts
```

### Q15: How can the migration command be run without printing secrets?

The `DATABASE_URL` is set via `$env:DATABASE_URL` — a PowerShell process-scoped variable. The local dev password is the `.env.example` default, not a real secret.

### Q16: How can we verify the `user_agents` table exists after migration without exposing secrets?

```powershell
docker exec -it aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'user_agents';"
```

Uses Docker exec into the container — no external connection string needed.

### Q17: What non-destructive health checks should run?

`GET /api/health` (200), `GET /api/health/db` (200), `GET /api/health/ready` (200). See Section 10.

### Q18: What login/auth setup is required?

Keith must have a registered user account. If none exists, register via `http://localhost:3002/en/register`. Login via `http://localhost:3002/en/login`. See Section 12.

### Q19: What browser checks must Keith perform?

24 checks across platform access, workspace CTA, Create Agent, static agents, mobile ~390px, and locale verification. See Section 13.

### Q20: What API checks can Cursor safely perform, if any?

6 non-destructive checks: 3 health endpoints (expect 200) + 3 guard checks (expect 401). See Section 14.

### Q21: What test agent data should be created?

Name: "Beta Smoke Test Agent". See Section 15.

### Q22: Since no delete endpoint exists, how should test-created data be handled?

Test agent remains in local DB. Acceptable because local-only, clearly named, soft-delete column exists at entity level. Record name and ID for future reference. See Section 16.

### Q23: How should we avoid production/staging pollution?

All commands target `localhost:5432`. Stop condition if `DATABASE_URL` points to non-localhost. No deployment. No `.env` editing. See Section 23 stop conditions.

### Q24: How should `/en/platform`, `/zh-TW/platform`, and `/zh-CN/platform` be checked?

Keith browser manual check — authenticated access, visual scan for correct locale text, no hardcoded English. See Section 13 items 1–3 and Section 21.

### Q25: How should workspace CTA routing be checked?

Keith browser manual check — visit `/en/app`, `/zh-TW/app`, `/zh-CN/app` and verify CTA links to correct locale platform path. See Section 13 items 4–6.

### Q26: How should Create Agent real DB-backed create/list be checked?

Keith browser manual check — fill form, submit, observe success, refresh page, verify persistence. See Section 18.

### Q27: How should static system agents preservation be checked?

Keith browser manual check — verify 4 static agents present with correct status/behavior. See Section 19.

### Q28: How should 390px mobile visual smoke be checked?

Keith browser DevTools → responsive mode → 390px width. Check dashboard, detail panel, Create Agent form, user agents section. See Section 20.

### Q29: How should no-hardcoded-English on zh routes be checked?

Keith visual scan of `/zh-TW/platform` and `/zh-CN/platform` — all UI copy must be in the correct Chinese variant. Create Agent form must also be fully translated. See Section 21.

### Q30: What counts as PASS?

All criteria in Section 22 "PASS" checklist met. See Section 22.

### Q31: What counts as PASS WITH LIMITATION?

PASS criteria met except for clearly documented non-blocking limitations. See Section 22.

### Q32: What counts as FAIL?

Any item in Section 22 "FAIL" list. See Section 22.

### Q33: What are the stop conditions?

11 stop conditions documented. See Section 23.

### Q34: What evidence should Step 3 collect?

15 evidence items. See Section 24.

### Q35: What exact files should Step 3 create or modify, if any?

Create: `docs/BETA-READY-SMOKE-EXECUTION.md`. Modify: none. See Section 26.

### Q36: What exact commands should Step 3 run?

9 phases of commands. See Section 25.

### Q37: Should Step 3 be split into smaller child steps?

NO. See Section 27.

---

## 31. Exact Next Action

**BETA-READY-SMOKE Step 3 — Execution.**

Keith must:
1. Ensure Docker Desktop is running
2. Ensure ports 4000, 3002, 5432, 6379 are free
3. Confirm readiness to start the smoke

Step 3 follows the exact command plan in Section 25 and the Keith manual browser checklist in Section 13.

Step 3 creates only `docs/BETA-READY-SMOKE-EXECUTION.md`.

Step 3 does not modify source/test/translation/package/migration/entity/environment/Docker/governance files.

Governance updates (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) belong to Step 4 — Consolidation.
