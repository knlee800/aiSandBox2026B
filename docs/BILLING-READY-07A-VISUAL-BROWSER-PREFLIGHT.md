# BILLING-READY-07A Step 2 — Visual-Smoke Readiness / Preflight

**Task ID:** BILLING-READY-07A
**Step:** 2 — Visual-Smoke Readiness / Preflight
**Parent Task:** BILLING-READY-07 — Authenticated Billing Data Smoke (ACTIVE — Outcome B — PASS WITH LIMITATIONS)
**Status:** Step 2 COMPLETE
**Date:** 2026-07-17
**Nature:** Static read-only preflight — no execution, no runtime, no browser

---

## 1. Task Identity and Status

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-07A |
| Name | Authenticated Billing Visual Browser Confirmation |
| Family | BILLING READY / AUTHENTICATED BILLING / VISUAL BROWSER CONFIRMATION / MULTILINGUAL UX / PROVIDER SAFETY |
| Parent | BILLING-READY-07 — Authenticated Billing Data Smoke (ACTIVE — Outcome B) |
| Risk | HIGH — 4-step child-slice loop |
| Step 1 Status | COMPLETE (Registration — 2026-07-17) |
| Step 2 Status | COMPLETE (this document — 2026-07-17) |
| Step 3 Status | NOT STARTED |
| Step 4 Status | NOT STARTED |
| Keith Approval | Keith approved BILLING-READY-07A registration 2026-07-17 |

---

## 2. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-07 ACTIVE — Outcome B — PASS WITH LIMITATIONS | **CONFIRMED** |
| BILLING-READY-07A is the current ACTIVE child slice | **CONFIRMED** |
| BILLING-READY-07A Step 1 COMPLETE (Registration — 2026-07-17) | **CONFIRMED** |
| Visual confirmation is the only remaining blocker to parent completion | **CONFIRMED** |
| ANOMALY-01 remains deferred and not registered | **CONFIRMED** |
| No Stripe/provider/payment/customer-portal task registered | **CONFIRMED** |
| No unrelated ACTIVE task exists | **CONFIRMED** |
| BILLING-READY-06 / 06A / 06B COMPLETE and LOCKED | **CONFIRMED** |
| BILLING-READY-05 / 05A–05G COMPLETE and LOCKED | **CONFIRMED** |
| BILLING-READY-04 COMPLETE and LOCKED | **CONFIRMED** |
| BILLING-READY-03 COMPLETE and LOCKED | **CONFIRMED** |
| AGENT-HARNESS write canary remains separate | **CONFIRMED** |
| One-active-task rule satisfied | **CONFIRMED** |

---

## 3. Files Inspected

| File | Purpose |
|------|---------|
| `TASKS.md` | Active execution ledger — BILLING-READY-07 and 07A entries (grep) |
| `TASKS_BACKLOG_FULL.md` | Authoritative backlog — BILLING-READY-07 and 07A entries (grep) |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence — 07/07A row (full read) |
| `docs/BILLING-READY-07-CONSOLIDATION-DECISION.md` | Step 4 consolidation — Outcome B decision and deferred items (full read) |
| `docs/BILLING-READY-07-AUTHENTICATED-BILLING-SMOKE-PREFLIGHT.md` | Parent Step 2 plan — auth strategy, source analysis, provider safety (full read) |
| `docs/BILLING-READY-07-AUTHENTICATED-BILLING-SMOKE-EXECUTION.md` | Parent Step 3 execution — runtime evidence and limitations (full read) |
| `docs/BILLING-READY-06B-BACKEND-BROWSER-SMOKE-PREFLIGHT.md` | 06B preflight — runtime commands, smoke checklist, safety plan (full read) |
| `docs/BILLING-READY-06B-CHECKPOINT.md` | 06B checkpoint — DI fixes, unauthenticated limitations, deferred items (full read) |

---

## 4. Remaining Visual Evidence Gaps

These are the exact items deferred from BILLING-READY-07 Step 3 that BILLING-READY-07A must close:

| # | Gap | Locale | Route |
|---|-----|--------|-------|
| 1 | Success banner visibly rendered | en | `/en/billing?checkout=success` |
| 2 | Cancelled banner visibly rendered | en | `/en/billing?checkout=cancelled` |
| 3 | Authenticated billing content visible (credit/balance card, subscription card) | en | `/en/billing` |
| 4 | Customer portal card visible, button disabled, "Coming soon" text | en | `/en/billing` |
| 5 | Success banner visibly rendered in Traditional Chinese | zh-TW | `/zh-TW/billing?checkout=success` |
| 6 | Cancelled banner visibly rendered in Traditional Chinese | zh-TW | `/zh-TW/billing?checkout=cancelled` |
| 7 | Billing copy visibly rendered in Traditional Chinese | zh-TW | `/zh-TW/billing` |
| 8 | Customer portal disabled/"Coming soon" translated | zh-TW | `/zh-TW/billing` |
| 9 | Success banner visibly rendered in Simplified Chinese | zh-CN | `/zh-CN/billing?checkout=success` |
| 10 | Cancelled banner visibly rendered in Simplified Chinese | zh-CN | `/zh-CN/billing?checkout=cancelled` |
| 11 | Billing copy visibly rendered in Simplified Chinese | zh-CN | `/zh-CN/billing` |
| 12 | Customer portal disabled/"Coming soon" translated | zh-CN | `/zh-CN/billing` |
| 13 | No hardcoded English visible in zh-TW billing pages | zh-TW | All `/zh-TW/billing*` |
| 14 | No hardcoded English visible in zh-CN billing pages | zh-CN | All `/zh-CN/billing*` |
| 15 | Desktop layout usable (en) | en | `/en/billing` |
| 16 | ~390 px mobile layout: no horizontal breakage, cards readable, controls visible | en | `/en/billing` |

---

## 5. Browser-Tool Availability

### 5.1 Environment Inspection

The current Cursor agent runtime was inspected for browser-capable tooling:

| Check | Result |
|-------|--------|
| Built-in Browser tool in Cursor agent tool list | **NOT AVAILABLE** |
| MCP server catalog (all servers) | **EMPTY — no MCP servers configured** |
| MCP pattern search: `browser\|playwright\|puppeteer\|screenshot\|viewport` | **ZERO MATCHES** |
| Playwright/Puppeteer CLI available via Shell | **NOT VERIFIED — not launched per preflight rules** |
| WebFetch tool (built-in) — can it reach localhost? | **NO — runs from an isolated server; localhost not reachable** |

### 5.2 Conclusion

**Browser tool available: NO.**

No built-in browser automation tool, no MCP browser server, no screenshot tool, no viewport control tool, and no visual page rendering tool exists in this Cursor agent environment.

---

## 6. Browser-Tool Capability Matrix

| Capability | Available | Evidence |
|------------|-----------|----------|
| Open localhost URLs visually | **NO** | No browser tool; WebFetch cannot reach localhost |
| Click and navigate | **NO** | No browser tool |
| Form entry (login/register) | **NO** | No browser tool |
| Screenshot capture | **NO** | No browser tool; no MCP screenshot server |
| Visual page inspection (rendered DOM) | **NO** | No browser tool |
| Viewport resize / device emulation | **NO** | No browser tool |
| JavaScript-rendered React content inspection | **NO** | No browser tool |
| Browser console inspection | **NO** | No browser tool |
| Network request inspection (browser-level) | **NO** | No browser tool |
| Maintain authenticated cookie session visually | **NO** | No browser tool |
| Isolated session from Keith's browser | **N/A** | No tool session exists |
| Disposable local account in browser tool | **N/A** | No tool session exists |
| Credentials hidden from logs in browser tool | **N/A** | No tool session exists |
| Screenshots without credential exposure | **N/A** | No tool session exists |

### 6.1 What the Agent CAN Do via Shell (Non-Visual)

| Capability | Method | Limitation |
|------------|--------|-----------|
| Start Docker/PostgreSQL/Redis | `docker compose up -d postgres redis` | Runtime only — not visual |
| Start API Gateway | `npm run dev` in api-gateway directory | Runtime only — not visual |
| Start frontend | `npm run dev` in frontend directory | Runtime only — not visual |
| Verify health endpoints | `Invoke-RestMethod` | HTTP status only — not visual |
| Register/login via HTTP | `Invoke-RestMethod` POST to auth endpoints | Creates session — not visual |
| Fetch billing URLs for HTTP 200 | `Invoke-RestMethod` GET to billing URLs | HTTP status only — **not visual evidence** |
| Inspect API Gateway logs | Terminal output reading | Network evidence — not visual |
| Cleanup | `docker compose stop` | Runtime only |

**Critical distinction:** HTTP 200 is NOT visual evidence. Source inspection is NOT visual evidence. The task explicitly requires direct visual confirmation of rendered React content.

---

## 7. Authentication-Session Strategy

### 7.1 Preferred Strategy: Keith Creates Session via Normal Browser Login

Since no Cursor browser tool exists, Keith will authenticate via his local browser:

1. Navigate to `http://localhost:3002/en/register`
2. Enter disposable test credentials (e.g. `smoke-07a@local.test`, password min 6 chars)
3. Submit registration form — user created with `isActive: true`, `emailVerified: false`
4. Navigate to `http://localhost:3002/en/login`
5. Enter same credentials — session cookie set
6. Redirect confirms login
7. Navigate to billing pages for visual confirmation

### 7.2 Credential Safety

- Keith manages test credentials locally
- No credentials printed in chat, commands, or reports
- No cookies, tokens, or session IDs printed
- Email verification is not required for login (confirmed in BILLING-READY-07 preflight source analysis)
- Stub email provider means no external dependency

### 7.3 Alternative: Reuse Existing Session

If Keith has an existing local browser session from the BILLING-READY-07 Step 3 runtime (user `smoke-test-07@local.test` or similar), login directly without re-registration.

### 7.4 Registration/Login URLs

| Action | URL |
|--------|-----|
| Register | `http://localhost:3002/en/register` |
| Login | `http://localhost:3002/en/login` |
| Post-login redirect | `http://localhost:3002/en/app` |

---

## 8. Cursor vs Keith Responsibility Decision

### Decision: Option C — Keith Performs Manual Visual Smoke

**Justification:** No capable Cursor browser tool is available in this environment. Cursor cannot:
- Open localhost URLs visually
- Render React content
- Take screenshots
- Resize viewport
- Inspect visually rendered text

### 8.1 Cursor Responsibilities (Runtime Infrastructure Only)

| # | Responsibility | Tool |
|---|---------------|------|
| 1 | Start Docker/PostgreSQL/Redis | Shell |
| 2 | Wait for container health | Shell |
| 3 | Start API Gateway | Shell |
| 4 | Verify health endpoints (200) | Shell |
| 5 | Confirm provider-disabled and BILLING_CHARGES_ENABLED=false from startup logs | Shell terminal inspection |
| 6 | Start frontend dev server | Shell |
| 7 | Confirm frontend ready on port 3002 | Shell |
| 8 | Stop frontend after smoke | Shell |
| 9 | Stop API Gateway after smoke | Shell |
| 10 | Stop Docker containers (preserve volumes) | Shell |
| 11 | Confirm cleanup (ports closed) | Shell |

### 8.2 Keith Responsibilities (All Visual Confirmation)

| # | Responsibility |
|---|---------------|
| 1 | Register/login in browser (establish authenticated session) |
| 2 | Navigate to all 9 billing URLs |
| 3 | Visually confirm English billing content (balance card, subscription card, portal card) |
| 4 | Visually confirm success/cancelled banners in all 3 locales |
| 5 | Visually confirm zh-TW billing copy is rendered in Traditional Chinese |
| 6 | Visually confirm zh-CN billing copy is rendered in Simplified Chinese |
| 7 | Visually confirm customer portal button is disabled with "Coming soon" text |
| 8 | Visually confirm customer portal disabled/Coming soon is translated in zh-TW and zh-CN |
| 9 | Visually confirm no obvious hardcoded English on zh-TW and zh-CN pages |
| 10 | Visually confirm desktop layout usability |
| 11 | Set viewport to ~390 px and confirm mobile layout (no horizontal breakage, cards readable) |
| 12 | Inspect browser DevTools Network tab for network evidence |
| 13 | Report observations verbally/textually to Cursor agent |
| 14 | NOT click any upgrade, top-up, or Manage Subscription button |

---

## 9. Selected Execution Option

**Option C — Keith Performs Manual Visual Smoke**

Cursor handles runtime infrastructure (Docker, services, health verification, cleanup).
Keith handles all visual browser confirmation.

---

## 10. Exact Runtime Prerequisites

| # | Prerequisite | How to Verify |
|---|-------------|---------------|
| 1 | Docker Desktop running | `docker info --format "{{.ServerVersion}}"` returns version |
| 2 | PostgreSQL container (`aisandbox-postgres`) healthy | `docker compose ps` shows healthy |
| 3 | Redis container (`aisandbox-redis`) healthy | `docker compose ps` shows healthy |
| 4 | Preserved volumes from BILLING-READY-06A (24/24 migrations) | Volumes exist — do not recreate |
| 5 | API Gateway on `http://localhost:4000` | Health endpoints return 200 |
| 6 | Startup log shows `Provider mode resolved: disabled` | Terminal output |
| 7 | Startup log shows `BILLING_CHARGES_ENABLED=false` | Terminal output |
| 8 | Frontend on `http://localhost:3002` | Next.js ready message in terminal |
| 9 | Ports 3002 and 4000 are free before startup | No conflicts |

---

## 11. Exact Future PowerShell Commands

**These commands are for future Step 3 execution only. Do NOT run now.**

### Phase A — Docker Readiness

```powershell
docker info --format "{{.ServerVersion}}"
```

Expected: version string (e.g. `29.2.1`). If fails → STOP.

### Phase B — Start PostgreSQL and Redis

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis
```

### Phase C — Confirm Container Health

```powershell
Start-Sleep -Seconds 15; Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose ps
```

Expected: both `aisandbox-postgres` and `aisandbox-redis` healthy. If either unhealthy → STOP.

### Phase D — Start API Gateway

In a dedicated terminal:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run dev
```

Wait for:
- `API Gateway started!`
- `Listening on: http://localhost:4000`
- `Redis connected`
- `DB connected`
- `Provider mode resolved: disabled`
- `BILLING_CHARGES_ENABLED=false (charging disabled, safe mode)`
- `Payment provider "stripe" initialized (config valid: false, stub mode)`

If any missing or startup fails → STOP.

### Phase E — Verify API Gateway Health

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method GET
Invoke-RestMethod -Uri "http://localhost:4000/api/health/db" -Method GET
Invoke-RestMethod -Uri "http://localhost:4000/api/health/ready" -Method GET
```

Expected: all 200 OK. If any fails → STOP.

### Phase F — Start Frontend

In a dedicated terminal:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run dev
```

Wait for: `ready on http://localhost:3002` (or similar Next.js ready message). If not confirmed → STOP.

### Phase G — Keith Visual Browser Smoke

Keith performs all visual checks per Section 12 route sequence and Sections 13–20 checklists.

### Phase H — Cleanup

```powershell
# Stop frontend: Ctrl+C in frontend terminal
# Stop API Gateway: Ctrl+C in API Gateway terminal

# Stop Docker containers (preserve volumes)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis

# Confirm stopped
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose ps
```

Expected: both containers `Exited`. Volumes preserved.

### Phase I — Port Verification

```powershell
Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue | Select-Object -Property TcpTestSucceeded
Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue | Select-Object -Property TcpTestSucceeded
```

Expected: both `TcpTestSucceeded: False` (ports closed).

---

## 12. Exact Route Sequence

Keith navigates in this order:

| # | URL | Purpose |
|---|-----|---------|
| 1 | `http://localhost:3002/en/register` | Create test account (if needed) |
| 2 | `http://localhost:3002/en/login` | Authenticate |
| 3 | `http://localhost:3002/en/billing` | English billing — main visual check |
| 4 | `http://localhost:3002/en/billing?checkout=success` | English success banner |
| 5 | `http://localhost:3002/en/billing?checkout=cancelled` | English cancelled banner |
| 6 | `http://localhost:3002/zh-TW/billing` | Traditional Chinese billing |
| 7 | `http://localhost:3002/zh-TW/billing?checkout=success` | zh-TW success banner |
| 8 | `http://localhost:3002/zh-TW/billing?checkout=cancelled` | zh-TW cancelled banner |
| 9 | `http://localhost:3002/zh-CN/billing` | Simplified Chinese billing |
| 10 | `http://localhost:3002/zh-CN/billing?checkout=success` | zh-CN success banner |
| 11 | `http://localhost:3002/zh-CN/billing?checkout=cancelled` | zh-CN cancelled banner |

---

## 13. English Visual Checklist

Route: `http://localhost:3002/en/billing`

| # | Check | Expected |
|---|-------|----------|
| 1 | Authenticated billing content visible | YES — no error state, no 401 rejection |
| 2 | Unauthenticated error state ABSENT | YES — should NOT see "Failed to load billing information" |
| 3 | Credit/balance card visible | YES — shows `0` credits, `0 credits/month` (free user) |
| 4 | Subscription/free-plan card visible | YES — shows "Free" plan label, "Active" badge |
| 5 | Free credits note visible | YES — "Free plan includes 500 credits per month." |
| 6 | Customer portal card visible | YES — card with heading "Manage Subscription" |
| 7 | Customer portal button visibly disabled | YES — grayed-out button with `cursor-not-allowed` |
| 8 | "Coming soon" text visible | YES — "Coming soon — subscription management via customer portal." |
| 9 | Desktop layout usable | YES — centered layout, no overflow, no clipping |
| 10 | Loading skeleton ABSENT (after data loads) | YES — cards display data, not skeleton |

---

## 14. Traditional Chinese Visual Checklist

Route: `http://localhost:3002/zh-TW/billing`

| # | Check | Expected |
|---|-------|----------|
| 1 | Billing content visibly rendered in Traditional Chinese | YES |
| 2 | Page title | "帳務" |
| 3 | Balance card heading | "信用餘額" |
| 4 | Subscription card heading | "訂閱" |
| 5 | Free plan label | "免費" |
| 6 | Active status badge | "有效" |
| 7 | Free credits note | "免費方案每月包含 500 點數。" |
| 8 | Upgrade section heading | "升級方案" |
| 9 | Customer portal heading | "管理訂閱" |
| 10 | Customer portal coming-soon text | "即將推出 — 透過客戶入口管理訂閱。" |
| 11 | Customer portal button text (disabled) | "管理訂閱" |

---

## 15. Simplified Chinese Visual Checklist

Route: `http://localhost:3002/zh-CN/billing`

| # | Check | Expected |
|---|-------|----------|
| 1 | Billing content visibly rendered in Simplified Chinese | YES |
| 2 | Page title | "账单" |
| 3 | Balance card heading | "信用余额" |
| 4 | Subscription card heading | "订阅" |
| 5 | Free plan label | "免费" |
| 6 | Active status badge | "有效" |
| 7 | Free credits note | "免费方案每月包含 500 点数。" |
| 8 | Upgrade section heading | "升级方案" |
| 9 | Customer portal heading | "管理订阅" |
| 10 | Customer portal coming-soon text | "即将推出 — 通过客户门户管理订阅。" |
| 11 | Customer portal button text (disabled) | "管理订阅" |

---

## 16. Success/Cancelled Banner Checklist

### Success Banner

| Locale | URL | Expected Banner Text | Color |
|--------|-----|---------------------|-------|
| en | `/en/billing?checkout=success` | "Payment successful! Your credits have been added." | Green |
| zh-TW | `/zh-TW/billing?checkout=success` | "付款成功！點數已加入您的帳戶。" | Green |
| zh-CN | `/zh-CN/billing?checkout=success` | "支付成功！点数已添加到您的账户。" | Green |

### Cancelled Banner

| Locale | URL | Expected Banner Text | Color |
|--------|-----|---------------------|-------|
| en | `/en/billing?checkout=cancelled` | "Checkout was cancelled. No charges were made." | Yellow/Amber |
| zh-TW | `/zh-TW/billing?checkout=cancelled` | "結帳已取消，未產生任何費用。" | Yellow/Amber |
| zh-CN | `/zh-CN/billing?checkout=cancelled` | "结账已取消，未产生任何费用。" | Yellow/Amber |

### Banner Verification Notes

- Banners render ONLY when billing data loads successfully (they are in the main return branch, not the loading/error branch)
- Authentication is required for banners to be visible
- Query parameter must be exactly `?checkout=cancelled` (double-l spelling)
- Banner is pure client-side state — no network request triggered by the query parameter
- Both banner and billing data cards should be visible simultaneously

---

## 17. Customer Portal Disabled-State Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Customer portal card rendered | YES — separate card below billing data |
| 2 | Heading present | en: "Manage Subscription" / zh-TW: "管理訂閱" / zh-CN: "管理订阅" |
| 3 | "Coming soon" subtext present | en: "Coming soon — subscription management via customer portal." / zh-TW: "即將推出 — 透過客戶入口管理訂閱。" / zh-CN: "即将推出 — 通过客户门户管理订阅。" |
| 4 | Button appears disabled (grayed out, cursor-not-allowed styling) | YES |
| 5 | Button is NOT clickable | YES — `disabled` attribute hardcoded |
| 6 | No `onClick` handler | CONFIRMED in source — no handler exists |
| 7 | No API call possible via portal button | CONFIRMED — no backend portal endpoint exists |

---

## 18. Hardcoded-English Visual Checklist

| # | Check | Locale | Expected |
|---|-------|--------|----------|
| 1 | No English labels/headings on zh-TW billing page | zh-TW | All headings, labels, buttons in Traditional Chinese |
| 2 | No English labels/headings on zh-CN billing page | zh-CN | All headings, labels, buttons in Simplified Chinese |
| 3 | No English error/success messages on zh-TW pages | zh-TW | Banners in Traditional Chinese |
| 4 | No English error/success messages on zh-CN pages | zh-CN | Banners in Simplified Chinese |
| 5 | Technical/brand names acceptable | Both | "Stripe", "Pro", technical terms are acceptable exceptions |
| 6 | Loading indicator `'...'` acceptable | Both | Not substantive user text |

### Source-Verified (Step 2 Parent Preflight)

All 31 billing translation keys present in all 3 locales. No hardcoded English user-facing copy identified in source. Visual confirmation now required to verify runtime rendering matches source expectations.

---

## 19. Desktop Visual Checklist

Route: `http://localhost:3002/en/billing` (at normal desktop width)

| # | Check | Expected |
|---|-------|----------|
| 1 | Page renders in centered layout | YES — `max-w-2xl mx-auto` |
| 2 | Balance and subscription cards in grid | YES — `grid-cols-1 sm:grid-cols-2` (side-by-side at desktop) |
| 3 | No horizontal overflow | YES |
| 4 | No content clipping | YES |
| 5 | Upgrade section buttons readable | YES |
| 6 | Top-up section visible | YES |
| 7 | Customer portal card visible | YES |
| 8 | All cards have proper spacing | YES — `gap-4`, `mb-6` patterns |

---

## 20. 390 px Mobile Checklist

Route: `http://localhost:3002/en/billing` at ~390 px viewport width (use DevTools responsive mode)

| # | Check | Expected |
|---|-------|----------|
| 1 | No horizontal breakage (no horizontal scroll) | YES |
| 2 | Cards stack vertically (single column) | YES — `grid-cols-1` applies below `sm` breakpoint |
| 3 | Balance card readable | YES |
| 4 | Subscription card readable | YES |
| 5 | Text does not overlap | YES |
| 6 | Buttons remain visible and tappable | YES |
| 7 | Customer portal disabled state visible | YES |
| 8 | Customer portal disabled state understandable | YES — text and button still readable |
| 9 | No payment control activated by viewport change | YES — disabled button remains disabled |
| 10 | Upgrade/top-up buttons visible but NOT clicked | YES — Keith must NOT click them |

---

## 21. Network-Evidence Method

### Selected Method: Browser DevTools Network Panel (Keith Manual)

Since no Cursor browser-tool network inspection is available, Keith will use browser DevTools.

### Procedure

1. Before loading any billing page, Keith opens DevTools (F12) → Network tab
2. Click "Clear" to reset network log
3. Check "Preserve log" to retain across navigations
4. Navigate to `http://localhost:3002/en/billing`
5. Observe network requests

### Expected Requests (ALLOWED)

| Request | Method | Expected |
|---------|--------|----------|
| `/api/billing/balance` | GET | 200 — local DB read |
| `/api/billing/subscription` | GET | 200 — local DB read (or null) |
| Static assets (JS, CSS, fonts, images) | GET | 200 — expected |
| Next.js HMR/websocket | Various | Expected in dev mode |

### Prohibited Requests (Must Be ABSENT)

| Pattern | Reason |
|---------|--------|
| `*.stripe.com` | No Stripe API calls |
| `api.stripe.com` | No Stripe API calls |
| `js.stripe.com` | No Stripe JS loaded |
| `checkout.stripe.com` | No Stripe checkout navigation |
| `POST /api/billing/checkout/*` | No checkout session creation |
| `POST /api/billing/portal` | No customer portal session |
| Any `webhook` URL | No webhook calls |
| Any external payment domain | No external payment navigation |

### Banner Navigation Network Check

When navigating to `?checkout=success` or `?checkout=cancelled`:
- Only the normal GET requests (balance, subscription) should appear
- NO additional POST or external request triggered by the URL parameter
- Banner is pure client-side state (confirmed in source)

### Supplementary: API Gateway Log Inspection

After Keith completes browser smoke, Cursor can inspect the API Gateway terminal output to confirm:
- Only billing read-path queries logged
- No Stripe/provider/checkout/topup/portal requests in logs
- No external HTTP calls logged

---

## 22. Screenshot/Evidence Plan

### Screenshot Capability

Since no Cursor browser tool exists:
- **Cursor cannot take screenshots**
- Keith may optionally take screenshots via Windows Snipping Tool or Print Screen
- Screenshots are recommended but not strictly required — Keith's textual observations are sufficient

### Evidence Recording

| Method | Who | Notes |
|--------|-----|-------|
| Keith's verbal/textual observations | Keith → Cursor agent | Primary evidence method |
| Optional screenshots (Windows Snipping Tool) | Keith | Stronger evidence if easy to capture |
| API Gateway terminal logs | Cursor agent | Network/provider evidence |
| Frontend terminal logs | Cursor agent | Route serving evidence |

### Screenshot Safety

If Keith takes screenshots:
- Must NOT capture credentials, passwords, or session cookies
- DevTools Application tab (Cookies section) must NOT be visible
- No request headers containing session values visible
- URL bar showing the billing page URL is acceptable and recommended

---

## 23. Provider/Payment Safety Constraints

| # | Constraint | Enforcement |
|---|-----------|-------------|
| 1 | Keith must NOT click any "Upgrade to {Plan}" button | Stop condition |
| 2 | Keith must NOT click any "Buy {N} Credits" button | Stop condition |
| 3 | Keith must NOT click the "Manage Subscription" button | Button is disabled; no handler exists |
| 4 | No `POST /api/billing/checkout/*` permitted | Stop condition — check network tab |
| 5 | No `POST /api/billing/portal` permitted | Endpoint does not exist |
| 6 | No Stripe CLI | Not installed; not used |
| 7 | No webhook testing | Out of scope |
| 8 | Provider mode must remain `disabled` | Verified from startup log |
| 9 | `BILLING_CHARGES_ENABLED` must be `false` | Verified from startup log |
| 10 | No DOM manipulation to enable disabled elements | Prohibited |
| 11 | No checkout URL navigation | Provider returns PROVIDER_DISABLED; no URL generated |
| 12 | No `window.location.href` to Stripe | Blocked by ChargeReadinessService (503 before URL) |

### Safety Layers (from BILLING-READY-07 Preflight)

1. No `stripe` npm package installed
2. `BILLING_CHARGES_ENABLED` defaults to `false`
3. `STRIPE_PROVIDER_MODE` defaults to `disabled`
4. No `STRIPE_SECRET_KEY` configured
5. No `STRIPE_WEBHOOK_SECRET` configured
6. `ChargeReadinessService` blocks all charging paths with HTTP 503
7. Customer portal button is hardcoded `disabled` with no click handler

---

## 24. Stop Conditions

Step 3 execution must STOP immediately if:

| # | Condition |
|---|-----------|
| 1 | Governance becomes inconsistent (another task ACTIVE, locked task modified) |
| 2 | Docker Desktop unavailable |
| 3 | `aisandbox-postgres` or `aisandbox-redis` unhealthy after 60s |
| 4 | API Gateway startup fails or logs an error state |
| 5 | Startup logs do NOT confirm `Provider mode resolved: disabled` |
| 6 | Startup logs do NOT confirm `BILLING_CHARGES_ENABLED=false` |
| 7 | A remote/production DATABASE_URL is detected in startup logs |
| 8 | Any health endpoint returns non-200 |
| 9 | Frontend dev server fails to start |
| 10 | Local authentication cannot be established safely (registration or login fails) |
| 11 | A secret would need to be revealed to diagnose an issue |
| 12 | Provider mode is not disabled/stub at runtime |
| 13 | Network log shows a request to `*.stripe.com` or other external payment domain |
| 14 | Network log shows `POST /api/billing/checkout/*` |
| 15 | Customer portal button appears ENABLED and clickable (should be impossible) |
| 16 | Any checkout, upgrade, or top-up button is accidentally clicked |
| 17 | Page load triggers a payment/provider write request |
| 18 | Browser automation cannot visually inspect rendered React content (N/A for Option C) |
| 19 | Screenshots expose credentials or session values |
| 20 | Source changes become necessary to proceed |
| 21 | A destructive action is proposed |
| 22 | Another task becomes ACTIVE |
| 23 | A migration error or pending migration warning appears |

---

## 25. Cleanup Plan

### After Successful Smoke

1. Keith logs out via browser UI (optional — revokes session)
2. Keith closes billing browser tabs
3. Cursor stops frontend: Ctrl+C in frontend terminal
4. Cursor stops API Gateway: Ctrl+C in API Gateway terminal
5. Cursor stops containers:
   ```powershell
   Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop postgres redis
   ```
6. Cursor confirms stopped:
   ```powershell
   Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose ps
   ```
7. Cursor confirms ports closed:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue | Select-Object TcpTestSucceeded
   Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue | Select-Object TcpTestSucceeded
   ```

### Volumes

- `postgres_data` and `redis_data` are PRESERVED
- Never use `docker compose down -v`
- Test user remains in local DB (acceptable for local-only development)

### If Smoke Is Aborted

Same cleanup applies: stop services, stop containers (preserve volumes).

---

## 26. ANOMALY-01 Boundary

**ANOMALY-01 — Auth Route UX/UI Regression**

- **Status:** Deferred. Not registered. Not investigated.
- **Finding:** Active localized login/registration routes render legacy auth UI instead of intended newer multilingual auth UI.
- **Impact on BILLING-READY-07A:** Non-blocking. Functional authentication works correctly. Keith can register and login via the legacy UI to establish an authenticated session.
- **Action during BILLING-READY-07A Step 3:** Use the functioning legacy login only as needed. Record if visible. Do not investigate. Do not fix. Do not redesign auth pages. Do not change routing.
- **Registration status:** Not registered during BILLING-READY-07A. Recommended as separate task after BILLING-READY-07A consolidation and BILLING-READY-07 parent completion decision.

---

## 27. Source-Defect Handling

BILLING-READY-07A is observation-only.

If a billing UI defect is discovered during Step 3:

1. Record exact locale
2. Record exact route
3. Record viewport width
4. Record expected result
5. Record visible actual result
6. Keith may capture a screenshot (if safe — no credentials visible)
7. Do NOT fix the defect
8. Determine whether it blocks BILLING-READY-07 completion
9. Recommend one separate bounded fix task
10. Handle one defect at a time

### Defect Severity and Blocking Decision

| Severity | Example | Blocks BILLING-READY-07? |
|----------|---------|--------------------------|
| Critical | Page does not render at all; blank screen; JavaScript crash | YES — must fix before closing |
| High | Major billing data not visible; cards completely missing | YES — investigate in separate task |
| Medium | Minor translation issue; one key showing English on zh-TW/zh-CN | NO — record and recommend fix task |
| Low | Minor spacing/alignment issue at mobile width | NO — record for future polish |

---

## 28. GO / CONDITIONAL GO / NO-GO Decision

### Decision: CONDITIONAL GO

**Step 3 (visual browser smoke execution) is approved to proceed**, subject to the following conditions.

### Conditions

| # | Condition |
|---|-----------|
| 1 | Keith must be available at keyboard for all browser steps |
| 2 | Keith must NOT click any Upgrade Plan button (Starter, Pro, Team) |
| 3 | Keith must NOT click any Buy Credits / Top Up button |
| 4 | Keith must NOT click the Manage Subscription button (disabled — should not be clickable) |
| 5 | API Gateway startup must confirm `Provider mode resolved: disabled` and `BILLING_CHARGES_ENABLED=false` |
| 6 | Network log must show no requests to `*.stripe.com` or external payment domains |
| 7 | All Stop Conditions in Section 24 must be respected |
| 8 | Docker Desktop must be running before execution begins |
| 9 | Keith must not paste credentials or session values into chat |

### GO Rationale

- Authentication is straightforward (email/password, no external services, no email verification for login)
- All 24/24 migrations already executed in BILLING-READY-06A (volumes preserved)
- Billing read endpoints are provably DB-only — no provider calls
- Customer portal is permanently disabled in source (hardcoded `disabled`, no handler)
- Query banners are pure client-side state — no API calls triggered
- All translation keys present in all 3 locales — no missing keys
- Provider is disabled, charges kill-switch is false
- Safe zero defaults for new users
- BILLING-READY-07 Step 3 already confirmed runtime stability (Docker, API Gateway, frontend, auth, billing reads all PASS)

### CONDITIONAL Element

The only non-trivial human dependency is Keith's availability and discipline to NOT click enabled checkout/upgrade/topup buttons. Backend safety layers (ChargeReadinessService → 503) would prevent actual harm, but clicking is outside approved scope.

---

## 29. Exact Next Recommended Action

1. Keith approves this preflight document and confirms CONDITIONAL GO for Step 3
2. Proceed to **BILLING-READY-07A Step 3 — Authenticated Billing Visual Browser Smoke Execution**
3. Cursor starts runtime infrastructure per Section 11 commands
4. Keith performs visual browser smoke per Section 12 route sequence
5. Keith reports observations per Sections 13–20 checklists
6. Keith inspects Network tab per Section 21
7. Cursor inspects API Gateway logs for provider/payment safety evidence
8. Cursor performs cleanup per Section 25
9. After successful smoke, proceed to **BILLING-READY-07A Step 4 — Consolidation / Checkpoint and Parent Completion Decision**

---

## 30. Safety Confirmations

| # | Constraint | Status |
|---|-----------|--------|
| 1 | No source code modified | **CONFIRMED** |
| 2 | No test files modified | **CONFIRMED** |
| 3 | No translation files modified | **CONFIRMED** |
| 4 | No package files modified | **CONFIRMED** |
| 5 | No migrations modified or run | **CONFIRMED** |
| 6 | No environment files opened or printed | **CONFIRMED** |
| 7 | No Docker configuration changed | **CONFIRMED** |
| 8 | No Docker commands run | **CONFIRMED** |
| 9 | No PostgreSQL/Redis commands run | **CONFIRMED** |
| 10 | No database queries executed | **CONFIRMED** |
| 11 | No service startup performed | **CONFIRMED** |
| 12 | No browser automation launched | **CONFIRMED** |
| 13 | No browser smoke executed | **CONFIRMED** |
| 14 | No billing API calls made | **CONFIRMED** |
| 15 | No checkout/topup/portal calls | **CONFIRMED** |
| 16 | No provider calls | **CONFIRMED** |
| 17 | No Stripe CLI | **CONFIRMED** |
| 18 | No webhook tests | **CONFIRMED** |
| 19 | No secret-bearing environment file opened | **CONFIRMED** |
| 20 | No passwords, cookies, tokens, secrets printed | **CONFIRMED** |
| 21 | No TASKS.md edits | **CONFIRMED** |
| 22 | No TASKS_BACKLOG_FULL.md edits | **CONFIRMED** |
| 23 | No AINOW-EXECUTION-ROADMAP.md edits | **CONFIRMED** |
| 24 | No git commit or push | **CONFIRMED** |
| 25 | No subagents used | **CONFIRMED** |
| 26 | Only approved file created: this preflight document | **CONFIRMED** |

---

**BILLING-READY-07A Step 2 Status: COMPLETE**
**Decision: CONDITIONAL GO — Option C (Keith Manual Visual Smoke)**
**Next: BILLING-READY-07A Step 3 — Authenticated Billing Visual Browser Smoke Execution (awaiting Keith approval)**
