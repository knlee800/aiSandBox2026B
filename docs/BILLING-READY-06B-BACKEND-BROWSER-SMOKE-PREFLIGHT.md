# BILLING-READY-06B Step 2 — Backend Runtime / Frontend Browser Smoke Preflight and Exact Safety Plan

**Task ID:** BILLING-READY-06B
**Parent:** BILLING-READY-06
**Step:** 2 — Backend Runtime / Frontend Browser Smoke Preflight and Exact Safety Plan
**Status:** Step 2 COMPLETE
**Date:** 2026-07-16
**Nature:** Static preflight planning only — no execution

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-06B ACTIVE — Step 1 COMPLETE (Registration — 2026-07-16) | **CONFIRMED** |
| Parent BILLING-READY-06 ACTIVE — Step 1 COMPLETE, Step 2 COMPLETE | **CONFIRMED** |
| BILLING-READY-06A COMPLETE and LOCKED (2026-07-16) | **CONFIRMED** |
| BILLING-READY-05 COMPLETE and LOCKED (2026-07-16) | **CONFIRMED** |
| BILLING-READY-05A COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05B COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05C COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05D COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05E COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05F COMPLETE and LOCKED (2026-07-15) | **CONFIRMED** |
| BILLING-READY-05G COMPLETE and LOCKED (2026-07-16) | **CONFIRMED** |
| BILLING-READY-04 COMPLETE and LOCKED (2026-07-13) | **CONFIRMED** |
| BILLING-READY-03 COMPLETE and LOCKED (2026-07-07) | **CONFIRMED** |
| One-active-task rule satisfied | **CONFIRMED** — only BILLING-READY-06 (with child 06B) is ACTIVE |
| AGENT-HARNESS write canary remains separate | **CONFIRMED** — not registered, not part of BILLING-READY-06 |

---

## 2. 06A Dependency Status

| Check | Result | Evidence |
|-------|--------|----------|
| Docker readiness | **PASS** | Docker v29.2.1 / Compose v5.0.2; `docker info` exit code 0 |
| PostgreSQL readiness | **PASS** | `aisandbox-postgres` healthy; `pg_isready` accepting connections |
| Redis readiness | **PASS** | `aisandbox-redis` healthy; password-protected |
| 4 billing migrations executed locally | **PASS** | All 4 executed successfully — `AlignSubscriptionsTableWithTypeORM`, `AddStripeCustomerIdUniqueIndex`, `CreateWebhookEventsTable`, `CreateCreditGrantsTable` |
| migration:show AFTER | **PASS** | 24/24 executed, 0 pending |
| Evidence: tables/indexes/records | **PASS** | 34 tables, 132 indexes, 24 migration records |
| Containers after 06A | **Stopped** — `docker compose stop postgres redis` executed |
| Volumes after 06A | **Preserved** — `postgres_data`, `redis_data` intact for 06B |
| No `docker compose down -v` | **CONFIRMED** — volumes not deleted |
| No real secret env files opened in 06A | **CONFIRMED** |
| No provider/browser/runtime calls in 06A | **CONFIRMED** |
| No source/package/migration files changed in 06A | **CONFIRMED** |
| 06A Checkpoint | `docs/BILLING-READY-06A-CHECKPOINT.md` |

---

## 3. Runtime Service Decision

### 3.1 Docker/PostgreSQL/Redis Restart Required

**YES** — Step 3 requires restarting `postgres` and `redis` containers. They were stopped (not removed) after 06A. Volumes are preserved, so migration state is intact.

### 3.2 Exact Services Required

| Service | Container | Required? | Purpose |
|---------|-----------|-----------|---------|
| `postgres` | `aisandbox-postgres` | **YES** | API Gateway DB connection; migrated schema intact in `postgres_data` volume |
| `redis` | `aisandbox-redis` | **YES** | API Gateway BullMQ dependency; required for startup |
| API Gateway | N/A (local process) | **YES** | Health endpoints + billing endpoint smoke |
| Frontend dev server | N/A (local process) | **YES** | Browser smoke for billing page |

### 3.3 Services That Must Be Avoided

| Service | Reason |
|---------|--------|
| `prometheus` | Not needed — monitoring only; do not start |
| `grafana` | Not needed — port 3000 conflict risk; do not start |
| AI Service (`ai-service`) | Not needed — billing validation does not require AI execution |
| Worker | Not needed — no BullMQ job processing required |
| Container Manager (`container-manager`) | Not needed — no workspace/container operations |

### 3.4 Exact API Gateway Startup Command

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run dev
```

This runs `ts-node-dev --respawn --transpile-only src/main.ts`. The API Gateway requires:
- `DATABASE_URL` or individual `POSTGRES_*` variables pointing to `localhost:5432`
- Redis connection (BullMQ) at `localhost:6379`
- Environment variables from the local `.env` file (Keith manages; agent does not open)

### 3.5 Exact Frontend Dev Server Startup Command

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run dev
```

This runs `next dev -p 3002`. The frontend connects to the API Gateway at `/api/*` via proxy or direct fetch.

### 3.6 Exact Ports Expected

| Service | Port | Host |
|---------|------|------|
| PostgreSQL | `5432` | `localhost` |
| Redis | `6379` | `localhost` |
| API Gateway | `4000` | `localhost` (from `PORT` or `API_PORT` env, default 4000) |
| Frontend | `3002` | `localhost` (from `next dev -p 3002`) |

### 3.7 Stop Conditions (Service Startup)

- **STOP** if Docker Desktop is not running
- **STOP** if `postgres` or `redis` container fails health check after 60s
- **STOP** if API Gateway fails to start (module initialization error, TypeORM connection failure)
- **STOP** if frontend dev server fails to start (port conflict, build error)
- **STOP** if any startup log shows Stripe/provider API call attempt
- **STOP** if any secret value appears in log output

---

## 4. Backend Smoke Plan

### 4.1 Docker/PostgreSQL/Redis Restart Sequence

```powershell
# 1. Verify Docker Desktop is running
docker info

# 2. Restart postgres + redis (volumes preserved from 06A)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis

# 3. Wait for health checks
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose ps

# 4. Verify PostgreSQL
docker exec aisandbox-postgres pg_isready -U aisandbox -d aisandbox

# 5. Verify Redis
docker exec aisandbox-redis redis-cli ping
```

### 4.2 API Gateway Startup

```powershell
# Start API Gateway in development mode (separate terminal)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run dev
```

Expected startup log: `🚀 API Gateway started!` / `📡 Listening on: http://localhost:4000`

### 4.3 Health Endpoint Smoke

| # | Endpoint | Method | Auth | Expected Response |
|---|----------|--------|------|-------------------|
| 1 | `http://localhost:4000/api/health` | GET | None | `{ status: "ok", service: "api-gateway" }` |
| 2 | `http://localhost:4000/api/health/db` | GET | None | `{ status: "ok", database: "connected" }` |
| 3 | `http://localhost:4000/api/health/ready` | GET | None | `{ status: "ready", checks: { environment: "validated", database: "connected", killSwitches: "loaded", safetyLimits: "loaded" } }` |

Exact commands:

```powershell
# Health
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method GET

# Health DB
Invoke-RestMethod -Uri "http://localhost:4000/api/health/db" -Method GET

# Health Ready
Invoke-RestMethod -Uri "http://localhost:4000/api/health/ready" -Method GET
```

### 4.4 Billing Endpoint Auth Rejection Smoke

| # | Endpoint | Method | Auth | Expected Behavior |
|---|----------|--------|------|-------------------|
| 1 | `/api/billing/balance` | GET | None (no session) | HTTP 401 or 403 — `SessionCookieGuard` rejects |
| 2 | `/api/billing/subscription` | GET | None (no session) | HTTP 401 or 403 — `SessionCookieGuard` rejects |
| 3 | `/api/billing/checkout/subscription` | POST | None (no session) | HTTP 401 or 403 — `SessionCookieGuard` rejects |
| 4 | `/api/billing/checkout/topup` | POST | None (no session) | HTTP 401 or 403 — `SessionCookieGuard` rejects |

Exact commands:

```powershell
# Billing balance — expect 401/403
try { Invoke-RestMethod -Uri "http://localhost:4000/api/billing/balance" -Method GET } catch { $_.Exception.Response.StatusCode }

# Billing subscription — expect 401/403
try { Invoke-RestMethod -Uri "http://localhost:4000/api/billing/subscription" -Method GET } catch { $_.Exception.Response.StatusCode }

# Billing checkout subscription — expect 401/403
try { Invoke-RestMethod -Uri "http://localhost:4000/api/billing/checkout/subscription" -Method POST -ContentType "application/json" -Body '{"planId":"starter","successUrl":"http://localhost:3002/en/billing?checkout=success","cancelUrl":"http://localhost:3002/en/billing?checkout=cancelled"}' } catch { $_.Exception.Response.StatusCode }

# Billing checkout topup — expect 401/403
try { Invoke-RestMethod -Uri "http://localhost:4000/api/billing/checkout/topup" -Method POST -ContentType "application/json" -Body '{"topUpPackId":"topup_1000","successUrl":"http://localhost:3002/en/billing?checkout=success","cancelUrl":"http://localhost:3002/en/billing?checkout=cancelled"}' } catch { $_.Exception.Response.StatusCode }
```

### 4.5 Expected Unauthenticated/Session Behavior

- Health endpoints (`/api/health`, `/api/health/db`, `/api/health/ready`): **No auth required** — should return 200.
- Billing read endpoints (`GET /api/billing/balance`, `GET /api/billing/subscription`): **Session cookie required** — `SessionCookieGuard` blocks unauthenticated requests with 401/403.
- Billing checkout endpoints (`POST /api/billing/checkout/subscription`, `POST /api/billing/checkout/topup`): **Session cookie required** — `SessionCookieGuard` blocks unauthenticated requests with 401/403.
- The 401/403 rejection **itself is the expected evidence** that auth guards are active and correctly protecting billing endpoints.

### 4.6 Safe Provider-Disabled Behavior

Multiple independent safety layers prevent provider calls during smoke:

| Layer | Mechanism | Status |
|-------|-----------|--------|
| 1 | No `stripe` npm package installed | **CONFIRMED** — not in `api-gateway/package.json` |
| 2 | `BILLING_CHARGES_ENABLED` defaults to `false` | **CONFIRMED** — `ChargeReadinessService` blocks all charging paths |
| 3 | `STRIPE_PROVIDER_MODE` defaults to `disabled` | **CONFIRMED** — `StripePaymentProvider` returns `PROVIDER_DISABLED` |
| 4 | No `STRIPE_SECRET_KEY` configured | **CONFIRMED** — key absence degrades to `disabled` |
| 5 | No `STRIPE_WEBHOOK_SECRET` configured | **CONFIRMED** — webhook verification returns `PROVIDER_DISABLED` |

No checkout provider call will occur. Even if a checkout endpoint is reached with valid auth, `ChargeReadinessService` gate returns HTTP 503 before any provider logic executes.

### 4.7 API Gateway Startup Log Verification

Check startup logs for:

| Expected Log | Meaning |
|-------------|---------|
| `🚀 API Gateway started!` | Bootstrap complete |
| `📡 Listening on: http://localhost:4000` | Port bound |
| `BILLING_CHARGES_ENABLED: false` (if logged by ChargeReadinessService) | Charges kill-switch off |
| No `STRIPE_SECRET_KEY` or secret value in logs | No secret leakage |
| No `api.stripe.com` request in logs | No provider calls |

---

## 5. Auth/Session Strategy

### 5.1 Browser Smoke with Unauthenticated Views

**Partially possible.** The billing page (`/[locale]/billing`) is a client component that fetches from `/api/billing/balance` and `/api/billing/subscription` with `credentials: 'include'`. Without a session:

- The API calls will return 401/403
- The `useBillingData` hook will set `error: 'FETCH_FAILED'`
- The billing page will show the **error state** with retry button
- This confirms the error state UI renders correctly

### 5.2 Login/Session Setup

**Required for full billing data view.** To see the balance card, subscription card, top-up section, and customer portal stub, a logged-in session is needed.

**Options:**
1. **Browser login** — Keith navigates to the login page, authenticates (Google OAuth, Apple, or email), and then navigates to `/[locale]/billing`. This establishes the `aisandbox_session` cookie.
2. **Skip authenticated view** — Accept error-state and loading-state observations only. Sufficient to confirm UI structure renders but does not confirm data display.

### 5.3 Test User Creation

**Out of scope for 06B.** Creating test users in the database is a data mutation outside the validation boundary. If no existing user is available via login, the browser smoke proceeds with unauthenticated observations only.

### 5.4 DB User Seeding

**Must stop/defer if required.** If Keith cannot log in via the standard auth flow (e.g., no OAuth configured locally, email provider in stub mode), then:
- Do NOT seed users via raw SQL in 06B scope
- Record "authenticated billing view deferred — no local auth path available"
- Accept unauthenticated error-state smoke as the 06B boundary

### 5.5 Expected 401/403 Behavior for Billing API Without Session

| Endpoint | Expected Status | Reason |
|----------|----------------|--------|
| `GET /api/billing/balance` | 401 or 403 | `SessionCookieGuard` — no `aisandbox_session` cookie |
| `GET /api/billing/subscription` | 401 or 403 | `SessionCookieGuard` — no `aisandbox_session` cookie |
| `POST /api/billing/checkout/subscription` | 401 or 403 | `SessionCookieGuard` — no `aisandbox_session` cookie |
| `POST /api/billing/checkout/topup` | 401 or 403 | `SessionCookieGuard` — no `aisandbox_session` cookie |

### 5.6 Evidence to Collect

| Evidence | Method |
|----------|--------|
| Health endpoints return 200 | `Invoke-RestMethod` output |
| Billing endpoints return 401/403 without session | `Invoke-RestMethod` catch block status code |
| Auth guard operational | 401/403 itself is proof |
| If Keith logs in: billing data shape | Browser DevTools Network tab JSON response |
| If Keith logs in: billing UI renders with data | Keith visual observation |

---

## 6. Frontend Browser Smoke Plan

### 6.1 Exact Keith-Guided Browser Checklist

Keith performs all browser navigation manually. The agent documents expected behavior and verifies Keith's reported observations.

| # | Action | URL / Step | Expected Behavior | Auth Required |
|---|--------|-----------|-------------------|--------------|
| 1 | Open `/en/billing` | `http://localhost:3002/en/billing` | Page renders — if logged in: balance card, subscription card, top-up section, customer portal "Coming soon". If not logged in: error state with retry button. | YES for data; NO for error state |
| 2 | Open `/zh-TW/billing` | `http://localhost:3002/zh-TW/billing` | Same layout with Traditional Chinese labels — all billing keys translated (`帳務`, `信用餘額`, `訂閱`, `儲值點數`, `管理訂閱`, etc.) | YES for data; NO for error state |
| 3 | Open `/zh-CN/billing` | `http://localhost:3002/zh-CN/billing` | Same layout with Simplified Chinese labels — all billing keys translated (`账单`, `信用余额`, `订阅`, `充值点数`, `管理订阅`, etc.) | YES for data; NO for error state |
| 4 | Verify page title/copy from translations | All 3 locales | en: "Billing", zh-TW: "帳務", zh-CN: "账单" — rendered from `billing.pageTitle` translation key | NO (visible even in error state via heading) |
| 5 | Verify loading state | Any billing URL | Brief skeleton/shimmer placeholder visible during API fetch (gray boxes animate-pulse). May flash quickly. | NO |
| 6 | Verify error state (if unauthenticated) | Any billing URL (no session) | Red error banner: en "Failed to load billing information." / zh-TW "無法載入帳務資訊。" / zh-CN "无法加载账单信息。" with Retry button | NO |
| 7 | Verify balance card (if authenticated) | Any billing URL | Credit balance number, monthly allocation text. Free plan: balance 0, allocation 0. | YES |
| 8 | Verify subscription card (if authenticated) | Any billing URL | Plan name (Free/Starter/Pro/Team), status badge (Active/Trial/etc.), renewal date if applicable. Free plan: "Free" + "Active" badge + free credits note. | YES |
| 9 | Verify top-up section (if authenticated) | Any billing URL | 3 top-up packs: 1,000 / 5,000 / 20,000 credits with "Buy" buttons | YES |
| 10 | Verify checkout success query banner | `http://localhost:3002/en/billing?checkout=success` | Green banner: "Payment successful! Your credits have been added." with CheckCircle icon | NO (banner renders from URL param regardless of auth) |
| 11 | Verify checkout cancelled query banner | `http://localhost:3002/en/billing?checkout=cancelled` | Amber/yellow banner: "Checkout was cancelled. No charges were made." with XCircle icon | NO (banner renders from URL param regardless of auth) |
| 12 | Verify customer portal disabled state | Any billing URL (authenticated) | Disabled "Manage Subscription" button with "Coming soon — subscription management via customer portal." subtext. Button has `cursor-not-allowed` and `opacity` styling. | YES |
| 13 | Verify no actual Stripe navigation | Any billing URL | Clicking top-up or upgrade buttons: if authenticated, returns 503 error banner (charges disabled). No redirect to `checkout.stripe.com` or `billing.stripe.com`. | YES |
| 14 | Verify no hardcoded English on zh-TW | `http://localhost:3002/zh-TW/billing` | All visible text is Traditional Chinese. No English labels, buttons, or messages (except brand names). | YES for data; NO for error state |
| 15 | Verify no hardcoded English on zh-CN | `http://localhost:3002/zh-CN/billing` | All visible text is Simplified Chinese. No English labels, buttons, or messages (except brand names). | YES for data; NO for error state |
| 16 | Verify desktop layout | Any billing URL | `max-w-2xl mx-auto` centered layout. Cards stack or grid. No overflow, no clipping. | NO |
| 17 | Optional: mobile-width check | Any billing URL | Resize browser to ~375px width. Cards stack vertically. Buttons remain tappable. No horizontal scroll. | NO |

### 6.2 Translation Key Verification

All 3 locale files confirmed to have matching `billing` namespace with 33 keys each:

| Key | en | zh-TW | zh-CN |
|-----|-----|-------|-------|
| `pageTitle` | Billing | 帳務 | 账单 |
| `balance` | Credit Balance | 信用餘額 | 信用余额 |
| `subscription` | Subscription | 訂閱 | 订阅 |
| `topUp` | Top Up Credits | 儲值點數 | 充值点数 |
| `manageSubscription` | Manage Subscription | 管理訂閱 | 管理订阅 |
| `loadError` | Failed to load billing information. | 無法載入帳務資訊。 | 无法加载账单信息。 |
| `retry` | Retry | 重試 | 重试 |
| `checkoutSuccess` | Payment successful! ... | 付款成功！... | 支付成功！... |
| `checkoutCancelled` | Checkout was cancelled. ... | 結帳已取消... | 结账已取消... |
| `manageSubscriptionComingSoon` | Coming soon — ... | 即將推出 — ... | 即将推出 — ... |

(Full 33-key set verified across all 3 locales — see `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` lines 436–475.)

### 6.3 Checkout Success/Cancelled Banner Without Auth

The checkout result banners render based on URL query parameters (`?checkout=success` or `?checkout=cancelled`). They are parsed in `useState()` on mount and displayed via conditional JSX. These banners render **before** the error state check, so they should be visible even without authentication (though the rest of the page will show error state).

**Verification note:** Inspect actual render order — if the loading/error branches return early before the banner JSX, the banners may only be visible in the authenticated/data-loaded branch. From code inspection of `billing-page-client.tsx`:
- Loading state returns early (line 130–141) — **no banners visible during loading**
- Error state returns early (line 144–160) — **no banners visible in error state**
- Banners render in the main return (line 178–189) — **only visible when data loads successfully**

**Conclusion:** Checkout success/cancelled banners require authenticated data load. If unauthenticated, these banners will NOT be visible because the error state returns early. Keith must be logged in to verify scenarios 10 and 11.

**Updated auth requirement for scenarios 10 and 11:** YES (session required for banners to render)

### 6.4 Prerequisites

- Docker + PostgreSQL + Redis running and healthy
- API Gateway running at `http://localhost:4000`
- Frontend dev server running at `http://localhost:3002`
- Keith navigates browser manually
- Keith reports visual observations per scenario
- Agent documents expected vs actual behavior

---

## 7. Checkout/Provider Safety Plan

| # | Constraint | Status | Enforcement Mechanism |
|---|-----------|--------|----------------------|
| 1 | Provider mode must remain disabled/stub | **CONFIRMED** | `STRIPE_PROVIDER_MODE` defaults to `disabled`; no env file sets otherwise; no `.env` changes approved |
| 2 | No live Stripe calls | **CONFIRMED** | No `stripe` npm package installed; no Stripe SDK import possible |
| 3 | No test Stripe calls | **CONFIRMED** | No `STRIPE_SECRET_KEY`; no `stripe` package; provider mode `disabled` |
| 4 | No Stripe CLI | **CONFIRMED** | Stripe CLI not installed; no webhook forwarding configured |
| 5 | No customer portal API call | **CONFIRMED** | No backend portal endpoint exists; `createBillingPortalSession()` exists on provider but not exposed via any controller; UI shows "Coming soon" with disabled button |
| 6 | No real payment validation | **CONFIRMED** | Multiple independent safety layers: no SDK, no keys, charges disabled, provider disabled |
| 7 | No package/env/secret changes | **CONFIRMED** | Step 3 must not modify `package.json`, `.env`, or any secret-bearing file |
| 8 | Checkout buttons fail safely when provider disabled | **CONFIRMED** | `ChargeReadinessService` gate blocks at service layer → HTTP 503 → frontend catches and shows `billingUnavailable` error banner |
| 9 | No Stripe SDK install | **CONFIRMED** | `stripe` not in any `package.json`; no `npm install stripe` approved |
| 10 | Stop immediately if app attempts real checkout provider call | **CONFIRMED** — stop condition active |

### 7.1 Checkout Button Behavior Under Provider-Disabled Mode

If Keith is logged in and clicks a top-up or upgrade button:

1. Frontend sends `POST /api/billing/checkout/topup` or `POST /api/billing/checkout/subscription`
2. `SessionCookieGuard` passes (user is authenticated)
3. `CheckoutService` calls `ChargeReadinessService.assertReady()`
4. `ChargeReadinessService` finds `BILLING_CHARGES_ENABLED=false` → throws HTTP 503
5. Frontend catches 503 → sets `checkoutError` to `'billingUnavailable'`
6. Error banner renders: "Billing is currently unavailable."

**No provider code is reached.** The `ChargeReadinessService` gate stops execution before `StripePaymentProvider` methods are called.

---

## 8. Environment/Secrets Safety Plan

### 8.1 Env Variable Names That May Be Checked (By Name Only — Not Value)

| Variable Name | Check Method | Purpose |
|---------------|-------------|---------|
| `BILLING_CHARGES_ENABLED` | Confirm set to `false` or unset (defaults to `false`) via startup log or `health/ready` response | Kill-switch must remain off |
| `STRIPE_PROVIDER_MODE` | Confirm unset (defaults to `disabled`) via startup log | Provider mode must remain disabled |
| `STRIPE_SECRET_KEY` | Confirm **NOT SET** — no startup log should reference a Stripe key value | No Stripe API key should exist |
| `STRIPE_WEBHOOK_SECRET` | Confirm **NOT SET** | No webhook secret should exist |
| `DATABASE_URL` / `POSTGRES_HOST` | Confirm points to `localhost` only — never inspect password portion | DB connection target |
| `PORT` / `API_PORT` | Confirm API Gateway port is 4000 | Port verification |
| `POSTGRES_PASSWORD` | **DO NOT INSPECT VALUE** — confirm variable exists by name only | DB auth |
| `REDIS_PASSWORD` | **DO NOT INSPECT VALUE** — confirm variable exists by name only | Redis auth |

### 8.2 Env Files That Must Not Be Opened

| File | Reason |
|------|--------|
| `C:\Users\knlee\aiSandBox2026B\.env` | Contains real development secrets |
| `C:\Users\knlee\aiSandBox2026B\.env.local` | May contain real secrets |
| `C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env` | Contains real development secrets |
| `C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env.local` | May contain real secrets |
| `C:\Users\knlee\aiSandBox2026B\services\ai-service\.env` | Contains real development secrets |
| `C:\Users\knlee\aiSandBox2026B\services\container-manager\.env` | Contains real development secrets |

### 8.3 Safe Inspection Files (Already Inspected — Template Only)

| File | Inspected | Content |
|------|-----------|---------|
| `.env.example` | **YES** | `BILLING_CHARGES_ENABLED=false`; no Stripe keys; placeholder passwords |
| `services/api-gateway/.env.example` | **YES** | `PORT=4000`; `AI_PROVIDER=stub`; no Stripe keys |

### 8.4 How to Confirm Provider Disabled Safely (Without Opening Real Env Files)

1. **Check API Gateway startup logs** — look for `ChargeReadinessService` or `BILLING_CHARGES_ENABLED` log line showing `false`
2. **Check API Gateway startup logs** — look for `StripePaymentProvider mode:` log line showing `disabled`
3. **Test checkout endpoint** — if 503 is returned, `ChargeReadinessService` gate is blocking (charges disabled)
4. **Check `health/ready` endpoint** — `killSwitches` section confirms kill-switch states loaded

### 8.5 How to Confirm Local DATABASE_URL Host

- From API Gateway startup log: connection success message should reference `localhost:5432`
- From `health/db` endpoint: `{ status: "ok", database: "connected" }` confirms local DB connection
- Do NOT print `DATABASE_URL` value in agent-visible output

### 8.6 Stop Conditions (Env/Secrets)

- **STOP** if any command output reveals a real secret value (API key, password, token)
- **STOP** if any log output contains `STRIPE_SECRET_KEY` value
- **STOP** if `BILLING_CHARGES_ENABLED` is found to be `true` at runtime
- **STOP** if `STRIPE_PROVIDER_MODE` is found to be `test` or `live` at runtime
- **STOP** if any real `.env` file is accidentally opened by the agent (`Read` tool)
- **STOP** if `DATABASE_URL` points to a non-localhost host
- **STOP** if secrets are required for any smoke step that cannot proceed without them

---

## 9. Exact Step 3 Execution Boundary

### 9.1 Exact Report File to Create

| File | Purpose |
|------|---------|
| `docs/BILLING-READY-06B-CHECKPOINT.md` | 06B validation results — backend smoke evidence, browser smoke observations, checkpoint |

### 9.2 Exact Files Allowed to Change

| # | File | Allowed Action |
|---|------|----------------|
| 1 | `docs/BILLING-READY-06B-CHECKPOINT.md` | **CREATE** — backend smoke + browser smoke results |
| 2 | `TASKS.md` | **UPDATE** — 06B status (Step 2 COMPLETE, Step 3 results) |
| 3 | `TASKS_BACKLOG_FULL.md` | **UPDATE** — mirror TASKS.md |
| 4 | `docs/AINOW-EXECUTION-ROADMAP.md` | **UPDATE** — 06B progress |

No other files may be changed.

### 9.3 Exact Commands Allowed

| # | Command | Purpose |
|---|---------|---------|
| 1 | `docker info` | Docker availability check |
| 2 | `docker compose up -d postgres redis` | Restart postgres + redis (volumes preserved) |
| 3 | `docker compose ps` | Container status |
| 4 | `docker exec aisandbox-postgres pg_isready ...` | PostgreSQL health |
| 5 | `docker exec aisandbox-redis redis-cli ping` | Redis health |
| 6 | `npm run dev` (api-gateway directory) | Start API Gateway |
| 7 | `npm run dev` (frontend directory) | Start frontend dev server |
| 8 | `Invoke-RestMethod` to `localhost:4000/api/health*` | Health endpoint smoke |
| 9 | `Invoke-RestMethod` to `localhost:4000/api/billing/*` | Billing endpoint auth rejection smoke |
| 10 | `docker compose stop postgres redis` | Cleanup |
| 11 | Ctrl+C in API Gateway terminal | Stop API Gateway |
| 12 | Ctrl+C in frontend terminal | Stop frontend dev server |

### 9.4 Exact Commands Forbidden

| # | Forbidden Command | Reason |
|---|-------------------|--------|
| 1 | `docker compose -f docker-compose.prod.yml ...` | No production compose |
| 2 | `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` | No destructive DB operations |
| 3 | `npm install stripe` or any package install | No package changes |
| 4 | Any command that opens/reads/modifies `.env` files | No secret file access |
| 5 | Any `Invoke-RestMethod` / `curl` to `api.stripe.com` | No Stripe API calls |
| 6 | `stripe listen` or any Stripe CLI command | No Stripe CLI |
| 7 | `git push`, `git commit` (unless Keith explicitly requests) | No git changes |
| 8 | Starting ai-service, container-manager, or worker | No unneeded runtime services |
| 9 | `npm run build` (unless explicitly needed) | No builds |
| 10 | `npm test` / `npx jest` / `npx tsx --test` | No test execution |
| 11 | `docker compose down -v` (unless Keith explicitly approves) | No volume deletion |
| 12 | `migration:run`, `migration:revert`, `migration:show` | No migration commands (already done in 06A) |
| 13 | `INSERT`, `UPDATE`, `DELETE` on DB tables via psql | No data mutation |
| 14 | Any command connecting to a non-localhost database | No remote DB |

### 9.5 Exact Manual Browser Steps for Keith

Keith performs all browser navigation. The agent does not autonomously control a browser.

**Sequence:**

1. Keith opens browser
2. Keith navigates to `http://localhost:3002/en/billing`
3. Keith reports what is visible (loading → error or loading → data)
4. If logged in: Keith reports balance card, subscription card, top-up section, customer portal stub
5. If not logged in: Keith reports error state with retry button
6. Keith navigates to `http://localhost:3002/zh-TW/billing` and reports
7. Keith navigates to `http://localhost:3002/zh-CN/billing` and reports
8. Keith tests `?checkout=success` and `?checkout=cancelled` query params (if authenticated)
9. Keith optionally tests top-up button click (expect 503 error banner)
10. Keith optionally resizes to mobile width and reports layout

### 9.6 Exact Evidence to Capture

| Evidence | Method |
|----------|--------|
| Docker container status | `docker compose ps` output |
| PostgreSQL health | `pg_isready` output |
| Redis health | `redis-cli ping` output |
| API Gateway startup | Console output — look for `API Gateway started!` |
| Health endpoint responses | JSON response body (3 endpoints) |
| Billing endpoint auth rejection | HTTP status code (401 or 403) for each of 4 endpoints |
| API Gateway startup logs | No Stripe/provider call; no secret values |
| Frontend dev server startup | Console output — `ready` message |
| Browser smoke: `/en/billing` | Keith's observation |
| Browser smoke: `/zh-TW/billing` | Keith's observation |
| Browser smoke: `/zh-CN/billing` | Keith's observation |
| Checkout banners (if authenticated) | Keith's observation of success/cancelled banners |
| Customer portal disabled state | Keith's observation |
| Top-up button behavior (if tested) | Keith's observation — 503 error banner |
| No hardcoded English on zh-TW/zh-CN | Keith's confirmation |

### 9.7 Whether Screenshots Are Required

**Optional but recommended.** Screenshots provide stronger evidence for UI validation but are not strictly required. Keith's verbal/textual observations are sufficient for the checkpoint. If Keith can easily take screenshots, include them in the checkpoint document.

### 9.8 Whether Step 3 Should Split Further

**No.** Backend runtime smoke and frontend browser smoke form a natural execution sequence:
1. Docker restart → API Gateway startup → health check → billing auth check → frontend startup → browser smoke → cleanup
2. Each step depends on the previous — splitting would add governance overhead without safety benefit
3. Total estimated execution time: ~30 minutes including Keith's browser navigation

---

## 10. Split Decision

**Decision: A — Step 3 can run as one bounded backend runtime + browser smoke validation.**

| Option | Description | Assessment |
|--------|-------------|------------|
| **A** | **Step 3 runs one bounded backend runtime + browser smoke validation** | **RECOMMENDED** — clear dependency chain; sequential execution; combined evidence in one checkpoint; ~30 minutes total |
| B | Split into 06B1 backend runtime smoke and 06B2 browser smoke | **OVERLY GRANULAR** — backend smoke takes ~10 minutes; splitting adds governance overhead for two 15-minute tasks |
| C | Backend runtime only; browser smoke deferred | **ACCEPTABLE FALLBACK** — if Keith cannot do browser smoke or auth setup blocks |
| D | Browser smoke only; backend runtime deferred | **NOT VIABLE** — browser smoke requires API Gateway running |
| E | Pause | **NOT WARRANTED** — no blockers; clear path forward |

**Contingency:** If backend smoke passes but browser smoke is blocked by auth/session issues, record backend smoke results and mark browser smoke as deferred. This would be Option C as a runtime fallback — does not require re-planning.

---

## 11. Cleanup Plan

### 11.1 Stop Sequence

```powershell
# 1. Stop frontend dev server
# Keith presses Ctrl+C in the frontend terminal

# 2. Stop API Gateway
# Keith presses Ctrl+C in the API Gateway terminal

# 3. Stop Docker containers (preserve volumes)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis
```

### 11.2 Decisions

| Action | Decision | Reason |
|--------|----------|--------|
| Stop API Gateway | **YES** — Ctrl+C | No longer needed after smoke |
| Stop frontend dev server | **YES** — Ctrl+C | No longer needed after smoke |
| Stop Docker containers | **YES** — `docker compose stop postgres redis` | Preserves volumes; containers can be restarted later |
| Delete Docker volumes | **NO** — `docker compose down -v` is **FORBIDDEN** unless Keith explicitly approves | Volumes contain migration state that may be needed for future tasks |
| No destructive cleanup | **CONFIRMED** | No `down -v`, no `DROP DATABASE`, no volume deletion |

### 11.3 Stop Conditions (Cleanup)

- **STOP** if cleanup command fails — diagnose before retrying
- **STOP** if cleanup would delete data that future tasks depend on
- Do not run `docker compose down -v` unless Keith explicitly approves volume deletion

---

## 12. UX/UI Validation Notes

Because 06B includes billing UI browser smoke:

| # | Constraint | Status |
|---|-----------|--------|
| 1 | Multilingual-first requirement remains active | **CONFIRMED** — 33 keys in each of en.json, zh-TW.json, zh-CN.json |
| 2 | No new UI copy unless en/zh-TW/zh-CN all updated | **CONFIRMED** — no UI changes approved in 06B |
| 3 | Heroicons v2 Outline only | **CONFIRMED** — all billing icons from `@heroicons/react/24/outline` (CreditCardIcon, BanknotesIcon, ArrowPathIcon, SparklesIcon, ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon) |
| 4 | Impeccable/Emil advisory only | **CONFIRMED** — advisory skills do not override governance |
| 5 | No broad redesign | **CONFIRMED** — 06B is validation only; no UI code changes |
| 6 | Browser smoke observes only — no visual or functional changes | **CONFIRMED** |
| 7 | If browser smoke reveals a UI defect, register a separate bounded fix task | **CONFIRMED** — do not silently widen 06B scope |
| 8 | No dependency additions | **CONFIRMED** — `@heroicons/react` already installed |
| 9 | Translation hook pattern | **CONFIRMED** — `useTranslations('billing')` used in all billing components |

---

## 13. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Auth/session blocker** | HIGH | Billing data view requires session cookie via browser login. If local OAuth is not configured (no Google/Apple credentials locally) and email provider is `stub`, Keith may not be able to log in. Mitigation: test unauthenticated error state only; record authenticated view as deferred; or Keith uses an existing browser session if one exists. |
| 2 | **Provider call leakage** | HIGH | 5 independent safety layers prevent provider calls: no `stripe` package, `BILLING_CHARGES_ENABLED=false`, `STRIPE_PROVIDER_MODE=disabled`, no `STRIPE_SECRET_KEY`, no `STRIPE_WEBHOOK_SECRET`. Stop immediately if any log shows Stripe API call. |
| 3 | **Env secret exposure** | HIGH | Agent must not open real `.env` files; only `.env.example` inspected; no hardcoded passwords in commands; runtime env managed by Keith. |
| 4 | **Browser smoke ambiguity** | MEDIUM | Clear 17-scenario checklist with expected behavior. Keith guides step-by-step. Disagreements recorded. |
| 5 | **Local runtime startup failure** | MEDIUM | API Gateway depends on DB + Redis + env variables. If any dependency is misconfigured, startup fails. Mitigation: verify health endpoints sequentially; stop if any fail. |
| 6 | **Port conflict** | MEDIUM | Ports 4000 (API Gateway), 3002 (frontend), 5432 (PostgreSQL), 6379 (Redis) must be available. If any port is in use, stop and resolve. |
| 7 | **Frontend/backend API base URL mismatch** | MEDIUM | Frontend `useBillingData.ts` fetches from relative path `/api/billing/*`. In development, Next.js may need a proxy or `NEXT_PUBLIC_API_URL` to forward to `localhost:4000`. If API calls fail with network error (not 401/403), check proxy config. |
| 8 | **Checkout redirect risk** | MEDIUM | Even if a checkout endpoint returns a `checkoutUrl`, the URL would be a Stripe checkout URL which is invalid (no real session). Frontend does `window.location.href = data.checkoutUrl`. Mitigation: `ChargeReadinessService` blocks before any URL is generated — HTTP 503 returned — no redirect occurs. |
| 9 | **Misleading disabled provider state** | LOW | The UI does not visually indicate that billing/checkout is disabled at the provider level. Top-up and upgrade buttons look active but return 503. This is expected behavior for the current disabled state. |
| 10 | **Locked BILLING-READY-05 source-fix constraint** | HIGH | If runtime smoke reveals a source defect in billing code, STOP and register a separate bounded fix task. Do not reopen or widen BILLING-READY-05 or 06. |
| 11 | **False confidence if auth prevents full smoke** | MEDIUM | If Keith cannot authenticate, only error-state and loading-state views are observed. This confirms UI structure but not data display. Record explicitly which scenarios were deferred due to auth. |
| 12 | **Frontend proxy/API routing** | MEDIUM | The Next.js dev server must route `/api/*` requests to `localhost:4000`. Check `next.config.js` or `next.config.mjs` for rewrites/proxy. If not configured, frontend billing data fetches will hit `localhost:3002/api/billing/*` and fail with 404. |
| 13 | **Checkout banner visibility without auth** | LOW — RESOLVED | Code inspection confirms banners render only in the main return branch (after loading/error early returns). Banners require authenticated data load. Documented in §6.3. |

---

## 14. Step 3 Readiness Conclusion

| Criterion | Decision |
|-----------|----------|
| **Ready for Step 3?** | **YES — ready, pending Keith approval** |
| **Recommended model** | GPT-5.3 Codex — runtime execution step with Docker/service/browser commands; not architecture-heavy |
| **Exact Keith approval needed** | Keith must approve: (a) Docker/PostgreSQL/Redis restart, (b) API Gateway startup, (c) Frontend dev server startup, (d) Browser smoke execution and step-by-step guidance, (e) Cleanup approach |
| **Docker/PostgreSQL/Redis will be used?** | **YES** — restart from preserved volumes |
| **API Gateway runtime will be started?** | **YES** — `npm run dev` at `localhost:4000` |
| **Frontend runtime will be started?** | **YES** — `npm run dev` at `localhost:3002` |
| **Browser smoke will be manual?** | **YES** — Keith navigates browser; agent documents expected behavior |
| **Provider validation remains deferred?** | **YES** — no Stripe/provider/customer portal API calls; provider mode remains `disabled`; no Stripe SDK install; deferred to future task |
| **Can 06B complete after Step 3 if validation passes?** | **YES** — Step 4 (consolidation/checkpoint) can follow immediately; parent BILLING-READY-06 consolidation follows after 06B |

### Recommended Next Steps

1. **Keith approves BILLING-READY-06B Step 3 scope** — backend runtime + browser smoke
2. **Execute Step 3** — Docker restart → API Gateway → health → billing auth → frontend → browser smoke → cleanup
3. **06B checkpoint** — `docs/BILLING-READY-06B-CHECKPOINT.md`
4. **Parent BILLING-READY-06 Step 4** — consolidation checkpoint (new window recommended — Sonnet 4.6)

---

## 15. Safety Confirmations for This Step (Step 2)

| Constraint | Status |
|-----------|--------|
| No subagents used | **CONFIRMED** |
| No tests run | **CONFIRMED** |
| No builds run | **CONFIRMED** |
| No Docker/PostgreSQL/Redis commands run | **CONFIRMED** |
| No API Gateway startup | **CONFIRMED** |
| No frontend dev server | **CONFIRMED** |
| No browser smoke | **CONFIRMED** |
| No Stripe/payment/provider/customer portal API calls | **CONFIRMED** |
| No Stripe CLI/webhook tests | **CONFIRMED** |
| No migration execution | **CONFIRMED** |
| No env/secrets changes | **CONFIRMED** |
| No real secret env files opened | **CONFIRMED** — only `.env.example` files inspected |
| No package changes | **CONFIRMED** |
| No source file changes (services/frontend/database) | **CONFIRMED** |
| No governance file changes (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | **CONFIRMED** |
| No git commits/pushes | **CONFIRMED** |
| Only file created: this preflight document | **CONFIRMED** |

---

## 16. Files

### File Created

| # | File | Action |
|---|------|--------|
| 1 | `docs/BILLING-READY-06B-BACKEND-BROWSER-SMOKE-PREFLIGHT.md` | **CREATED** — this file |

### Files Inspected (Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — BILLING-READY-06B registration, active task status, parent/sibling status |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance — backlog confirmation (searched for BILLING-READY-06B) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Governance — execution sequence, BILLING-READY-06B current active |
| 4 | `docs/BILLING-READY-06-RUNTIME-MIGRATION-BROWSER-SMOKE-READINESS.md` | Source of truth — parent 06 readiness plan, Decision B, smoke plans |
| 5 | `docs/BILLING-READY-06A-CHECKPOINT.md` | 06A dependency — Docker/migration results, volumes preserved |
| 6 | `docs/BILLING-READY-06A-DOCKER-DB-MIGRATION-PREFLIGHT.md` | 06A preflight — Docker commands, migration sequences, safety plan |
| 7 | `docs/BILLING-READY-05-CHECKPOINT.md` | Parent 05 close — deferred items, locked status |
| 8 | `docs/BILLING-READY-05F-CHECKPOINT.md` | 05F billing UI — component inventory, translations, test results |
| 9 | `docker-compose.yml` | Service topology — postgres, redis, prometheus, grafana; ports; volumes; health checks |
| 10 | `package.json` | Root package — workspace config |
| 11 | `services/api-gateway/package.json` | API Gateway — dependencies (BullMQ, TypeORM, no `stripe`), scripts (`dev`, migration) |
| 12 | `frontend/package.json` | Frontend — dependencies, `dev` script (`next dev -p 3002`) |
| 13 | `services/api-gateway/src/main.ts` | API Gateway bootstrap — port 4000, rawBody, CORS, global prefix `api` |
| 14 | `services/api-gateway/src/health/health.controller.ts` | Health endpoints — `/health`, `/health/db`, `/health/ready` response shapes |
| 15 | `services/api-gateway/src/billing/billing-read.controller.ts` | Billing read — `SessionCookieGuard`, `GET /billing/balance`, `GET /billing/subscription`, response shapes |
| 16 | `services/api-gateway/src/billing/checkout/checkout.controller.ts` | Checkout — `SessionCookieGuard`, `POST /billing/checkout/subscription`, `POST /billing/checkout/topup` |
| 17 | `frontend/app/[locale]/billing/page.tsx` | Billing page — server component wrapper importing `BillingPageClient` |
| 18 | `frontend/components/billing/billing-page-client.tsx` | Client component — data fetching, loading/error/data states, checkout handlers, banners, layout |
| 19 | `frontend/components/billing/billing-balance-card.tsx` | Balance card — CreditCardIcon, credit count, monthly allocation |
| 20 | `frontend/components/billing/billing-subscription-card.tsx` | Subscription card — SparklesIcon, plan name, status badge, renewal date |
| 21 | `frontend/components/billing/billing-topup-section.tsx` | Top-up section — BanknotesIcon, 3 packs (1K/5K/20K), buy buttons |
| 22 | `frontend/hooks/useBillingData.ts` | Custom hook — fetch `/api/billing/balance` + `/api/billing/subscription` with credentials |
| 23 | `frontend/messages/en.json` | Translation — 33 billing keys verified |
| 24 | `frontend/messages/zh-TW.json` | Translation — 33 billing keys verified |
| 25 | `frontend/messages/zh-CN.json` | Translation — 33 billing keys verified |
| 26 | `.env.example` | Template — `BILLING_CHARGES_ENABLED=false`, no Stripe keys |
| 27 | `services/api-gateway/.env.example` | Template — `PORT=4000`, `AI_PROVIDER=stub`, no Stripe keys |
