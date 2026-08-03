# PRIVATE-BETA-STAGING-EXECUTION-04I — Browser / User-Facing Smoke Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I  
**Title:** Browser / User-Facing Smoke Baseline  
**Step:** 2 — Browser / User-Facing Smoke Runbook  
**Runbook date:** 2026-08-03  
**Nature:** Runbook creation only — no SSH — no AWS CLI/actions — no browser opened by Cursor — no accounts created — no login/register executed — no AI execution — no billing/payment execution — no container workflow execution — no Google OAuth enablement — no DNS/TLS/Caddy changes — no reboot — no PM2/systemd commands — no `.env` opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped/restarted — no migrations — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no TASKS/TASKS_BACKLOG_FULL/roadmap changes — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Title | Browser / User-Facing Smoke Baseline |
| Step | 2 — Browser / User-Facing Smoke Runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessor | PRIVATE-BETA-STAGING-EXECUTION-04H COMPLETE and LOCKED — 2026-08-03 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — browser / user-facing smoke runbook only |
| Risk | MEDIUM — public browser smoke; persistent-data paths gated behind explicit approval |
| Step 1 Status | COMPLETE — Registration — 2026-08-03 |
| Step 2 Status | COMPLETE — this runbook |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-BROWSER-USER-FACING-SMOKE-RUNBOOK.md` — this file |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-CHECKPOINT.md` |
| Operator | Keith |
| Execution venue (operator) | Browser (Keith's local machine) + optional AWS Lightsail browser SSH for health pre-checks — not Cursor |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Static IP | `aisandbox-staging-ip` — public IP `18.136.141.186` |
| Public staging URL | `https://staging.ainow.biz` |

---

## 2. Purpose

04I safely validates that the public staging deployment at `https://staging.ainow.biz` is browser-accessible and user-facing pages render correctly after public routing / DNS / TLS was established in 04H.

04I is bounded to:

* pre-smoke public HTTPS and local health verification
* browser-visible staging usability checks (root redirect, login page render, register page render)
* gated optional authenticated smoke (requires explicit Keith approval before any account creation or persistent data)
* gated Create Agent UI availability check (up to safe non-execution boundary only)
* explicit non-goal verification (no AI / billing / container / OAuth execution)
* final safe-state verification and evidence capture

04I does **not** include recovery, fixes, or enabling any deferred capabilities.

---

## 3. What 04I Validates

* The public root `https://staging.ainow.biz` loads over HTTPS with a valid certificate.
* The root locale redirect (`/` → `/en`) works correctly in a browser.
* The login page at `https://staging.ainow.biz/en/login` renders correctly.
* The register page at `https://staging.ainow.biz/en/register` renders correctly.
* If approved: registration or login through public HTTPS succeeds or reaches a clearly documented source-grounded expected blocker.
* If approved: the authenticated workspace/dashboard area renders.
* If approved and applicable: the Create Agent UI entry point is visible (without triggering execution).
* Pre-smoke public HTTPS health endpoints are reachable and returning expected status codes.
* Pre-smoke local health endpoints are healthy.
* PM2 and Caddy services remain in their expected state throughout.
* No unexpected database state changes occur before approved persistent-data smoke.

---

## 4. What 04I Does Not Validate

* AI execution, provider calls, or LLM/agent job submission.
* Billing, payment, checkout, subscription, or invoice flows.
* Container workflow execution beyond the Container Manager health endpoint.
* Google OAuth authentication flow.
* End-to-end AI agent job completion.
* Performance, load testing, or concurrency.
* Email delivery flows (email verification may be encountered as a blocker; record it — do not bypass it).
* Production domains (`app.ainow.biz`, `ainow.biz`).
* Full private-beta deployment readiness — 04I is a browser smoke step only.

---

## 5. Preconditions

All of the following must be true before beginning manual browser smoke:

| # | Precondition | Source |
|---|-------------|--------|
| 1 | PRIVATE-BETA-STAGING-EXECUTION-04H is COMPLETE and LOCKED | 04H Checkpoint — 2026-08-03 |
| 2 | `staging.ainow.biz` externally resolves to `18.136.141.186` | 04H evidence — DNS: 1.1.1.1 and 8.8.8.8 confirmed |
| 3 | Caddy enabled and active on the instance | 04H final local health — verified |
| 4 | `pm2-ubuntu` enabled and active on the instance | 04H final local health — verified |
| 5 | All four PM2 apps online with zero restarts | 04H final local health — verified |
| 6 | Public HTTPS health-only smoke passed in 04H | 04H evidence: `PUBLIC_HTTPS_API_HEALTH_FORCED=200`, etc. |
| 7 | Public table count is 26 (pre-smoke baseline) | 04H final local health — verified |
| 8 | No source/migration/env changes since 04H | 04H checkpoint confirms git status clean |
| 9 | Keith has access to a browser and the `staging.ainow.biz` hostname | Operator precondition |
| 10 | Keith has not yet created any test accounts, workspaces, or agent data | Must be confirmed before starting |

If any precondition fails, **stop** and do not proceed to browser smoke. Capture a safe evidence note and raise as a separate slice.

---

## 6. Browser Instruction

**Use public HTTPS only:**

```
https://staging.ainow.biz
```

**Do not test production domains:**
- `app.ainow.biz` — production, not staging
- `ainow.biz` — root production domain, not staging

**Keith approval is required before creating any account, user, workspace, or agent data.**

The following are explicitly prohibited during 04I browser smoke:

- Do not print or paste passwords, reset links, session cookies, JWTs, API keys, provider keys, or `.env` values.
- Do not run `env`, `printenv`, `cat .env`, `echo $DATABASE_URL`, `echo $REDIS_URL`, or any secret-printing command.
- Do not trigger AI execution.
- Do not trigger billing/payment execution.
- Do not trigger checkout/subscription/invoice flows.
- Do not trigger container workflow execution beyond what renders passively.
- Do not enable Google OAuth.
- Do not modify source code.
- Do not modify migrations.
- Do not modify `.env`.
- Do not configure DNS/TLS/Caddy.
- Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.
- If smoke fails, stop and capture safe evidence only.
- Any recovery or code fix must be a separate bounded slice.

---

## 7. Optional Lightsail Browser SSH Health Checks

> **These commands are for later manual execution only — in the AWS Lightsail browser SSH terminal.**
> **Do NOT run these commands in Cursor / PowerShell.**
> **These are pre-smoke health verifications. Run them BEFORE opening a browser for Path A–F.**

```bash
date
uptime
whoami
hostname

cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
systemctl is-enabled caddy
systemctl is-active caddy

curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_ROOT_FORCED=%{http_code}\n" https://staging.ainow.biz/
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_DB_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/db
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_READY_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/ready

curl -sS -o /dev/null -w "LOCAL_API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "LOCAL_API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "LOCAL_API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "LOCAL_CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "LOCAL_FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

---

## 8. Secret Safety Rules

The following are strictly prohibited at all times during 04I:

| Prohibited action | Reason |
|------------------|--------|
| Printing `.env` values | Exposes production secrets |
| Running `env`, `printenv`, `cat .env` | Exposes all environment variables |
| Running `echo $DATABASE_URL`, `echo $REDIS_URL`, `echo $JWT_SECRET`, etc. | Exposes individual secrets |
| Pasting passwords into Cursor chat or any AI interface | Secrets must never enter AI context |
| Pasting session cookies, JWTs, or auth tokens | Credentials must not be transmitted unsafely |
| Pasting reset links received by email | Contains security tokens |
| Printing Caddy TLS private key material | Certificate private key |
| Printing DNS provider credentials | Provider account exposure |
| Pasting AWS access keys or SSH private keys | Credentials must remain on operator's machine |
| Copying secrets to screenshots shared beyond operator | Operational security |

If a secret is accidentally exposed: stop immediately, note the exposure, escalate as a separate security slice, and do not continue with smoke.

---

## 9. Persistent-Data Warning

> **04I browser smoke paths A, B, and C (root, login render, register render) do not create any data.**
>
> **Paths D, E, and F may create persistent data if account creation is approved.**
>
> **STOP before Path D and wait for the explicit approval gate in Section 15.**
>
> Creating a test account before approval is a stop condition.
>
> If persistent data is created, record the public table count before and after.

---

## 10. Pre-Smoke Public Health Verification

Before opening a browser for any smoke path, verify that public HTTPS health endpoints are responding correctly.

Run the following from the AWS Lightsail browser SSH terminal (see Section 7 for full command set). These are the health-specific checks:

```bash
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_ROOT_FORCED=%{http_code}\n" https://staging.ainow.biz/
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_DB_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/db
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_READY_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/ready
```

**Expected results:**

| Check | Expected | Acceptable | Notes |
|-------|----------|------------|-------|
| `PUBLIC_HTTPS_ROOT_FORCED` | 307 | 2xx or 3xx | Locale redirect from frontend middleware |
| `PUBLIC_HTTPS_API_HEALTH_FORCED` | 200 | 200 | API Gateway health endpoint |
| `PUBLIC_HTTPS_API_DB_HEALTH_FORCED` | 200 | 200 | API Gateway DB health endpoint |
| `PUBLIC_HTTPS_API_READY_FORCED` | 200 | 200 | API Gateway readiness endpoint |

If any of the above returns an unexpected value, **stop** and do not proceed to browser smoke. Record in safe evidence and raise as a separate slice.

---

## 11. Pre-Smoke Local Health Verification

Before browser smoke, verify local health endpoints are responding. Run from the AWS Lightsail browser SSH terminal:

```bash
curl -sS -o /dev/null -w "LOCAL_API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "LOCAL_API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "LOCAL_API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "LOCAL_CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "LOCAL_FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

**Expected results:**

| Check | Expected | Acceptable | Notes |
|-------|----------|------------|-------|
| `LOCAL_API_HEALTH` | 200 | 200 | API Gateway direct local |
| `LOCAL_API_DB_HEALTH` | 200 | 200 | API Gateway DB health direct local |
| `LOCAL_API_READY` | 200 | 200 | API Gateway readiness direct local |
| `LOCAL_CONTAINER_HEALTH` | 200 | 200 | Container Manager health direct local |
| `LOCAL_FRONTEND_ROOT` | 307 | 2xx or 3xx | Frontend locale redirect |

Also verify:

```bash
systemctl is-enabled pm2-ubuntu   # expected: enabled
systemctl is-active pm2-ubuntu    # expected: active
systemctl is-enabled caddy        # expected: enabled
systemctl is-active caddy         # expected: active

cd /opt/aisandbox
git status --short                 # expected: no output (clean)
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# expected: 26
```

If any local health check fails, Caddy is inactive, PM2 is inactive, or git status is not clean, **stop** and do not proceed to browser smoke.

---

## 12. Browser Smoke Path A — Public Root / Locale Redirect

**Objective:** Verify that `https://staging.ainow.biz` loads over HTTPS with a valid certificate and performs the expected root-to-locale redirect.

**Source grounding:** Frontend middleware (`frontend/middleware.ts`) redirects `/` to `/en` (HTTP 307). This is the expected behavior and is consistent with all prior health-only smoke evidence where `FRONTEND_ROOT=307`.

### Steps

1. Open a browser on your local machine.
2. Navigate to:
   ```
   https://staging.ainow.biz
   ```
3. Observe the browser address bar and page content.

### Expected

| Check | Expected | Notes |
|-------|----------|-------|
| HTTPS lock / certificate | Valid — no browser warning | Certificate issued by Let's Encrypt via Caddy automatic HTTPS |
| No certificate error page | Confirmed | Any certificate warning is a stop condition |
| URL after redirect | `https://staging.ainow.biz/en` or `https://staging.ainow.biz/en/` | Middleware redirects `/` → `/en` |
| Page content | Some UI renders — not a blank white page | Does not need to be logged in or complete |
| No server error page | No 500, no "Service Unavailable", no Caddy default error | |
| No infinite redirect loop | Browser reaches a stable page | Redirect loop is a stop condition |
| No hardcoded production URL | Address bar shows `staging.ainow.biz` throughout | |

### Stop conditions for Path A

- Browser shows a certificate warning or "Not Secure".
- Browser shows a blank page with no content after redirect.
- Browser shows a 500 or server error page.
- Infinite redirect loop (browser shows "too many redirects").
- URL changes to `app.ainow.biz` or `ainow.biz` (wrong domain).

---

## 13. Browser Smoke Path B — Login Page Render

**Objective:** Verify that the login page renders correctly over HTTPS.

**Source grounding:** Frontend app has a `[locale]/login/page.tsx` route. The middleware redirects `/login` → `/en/login`. The direct source-grounded login route is:
```
https://staging.ainow.biz/en/login
```

### Steps

1. Navigate directly to:
   ```
   https://staging.ainow.biz/en/login
   ```
   Alternatively, from the root page after Path A completes, find and click the visible login action.

2. Observe the page render.

### Expected

| Check | Expected | Notes |
|-------|----------|-------|
| Page loads | Login form or login UI renders | |
| HTTPS lock / certificate | Valid throughout — no new certificate warning | |
| No 404 | Page exists and renders | 404 is a stop condition |
| No 500 | No server error | 500 is a stop condition |
| No obvious hydration crash | No visible React error overlays | |
| No missing critical CSS/layout | Page has legible structure | Completely unstyled broken layout is a stop condition |
| No hardcoded wrong production domain | Links/buttons point to `staging.ainow.biz` or relative paths | |
| Login form fields visible | Email/username and password inputs are present | |

### Stop conditions for Path B

- 404 Not Found.
- 500 or server error.
- Visible React hydration crash overlay.
- Missing critical CSS/layout that makes the page unusable.
- Certificate warning.
- URL redirected to a production domain.

### Note

Do not submit the login form in Path B. Path B validates **render only**. Login submission is gated in Path D after explicit approval.

---

## 14. Browser Smoke Path C — Register Page Render

**Objective:** Verify that the registration page renders correctly over HTTPS.

**Source grounding:** Frontend app has a `[locale]/register/page.tsx` route. The middleware redirects `/register` → `/en/register`. The direct source-grounded register route is:
```
https://staging.ainow.biz/en/register
```

### Steps

1. Navigate directly to:
   ```
   https://staging.ainow.biz/en/register
   ```
   Alternatively, from the login page, find and click the visible register/sign-up action.

2. Observe the page render.

### Expected

| Check | Expected | Notes |
|-------|----------|-------|
| Page loads | Register form or registration UI renders | |
| HTTPS lock / certificate | Valid throughout — no new certificate warning | |
| No 404 | Page exists and renders | 404 is a stop condition |
| No 500 | No server error | 500 is a stop condition |
| No obvious hydration crash | No visible React error overlays | |
| No missing critical CSS/layout | Page has legible structure | |
| No hardcoded wrong production domain | Links/buttons point to `staging.ainow.biz` or relative paths | |
| Registration form fields visible | Name/email/password inputs are present | |

### Stop conditions for Path C

- 404 Not Found.
- 500 or server error.
- Visible React hydration crash overlay.
- Missing critical CSS/layout that makes the page unusable.
- Certificate warning.
- URL redirected to a production domain.

### Note

Do not submit the registration form in Path C. Path C validates **render only**. Registration submission is gated in Path D after explicit approval.

---

## 15. Approval Gate — Account Creation / Persistent Data

> ---
> **STOP.**
>
> **Do not create a test account, user, workspace, or agent data until Keith explicitly approves:**
>
> ```
> go — approve 04I account/authenticated browser smoke
> ```
>
> **Do not proceed to Path D, E, or F until this approval is given.**
>
> **Paths A, B, and C are complete at this point. If no approval is given, proceed directly to Section 20 (Final Safe-State Verification) and mark 04I as partial browser smoke only.**
>
> ---

If approval is not given, record in the safe evidence template:
- `account/authenticated smoke approved: NO — not yet approved`
- Continue to Section 20.

---

## 16. Browser Smoke Path D — Registration/Login Smoke (Only If Approved)

> **REQUIRES explicit approval: `go — approve 04I account/authenticated browser smoke`**
>
> **Do not begin this path without approval.**

**Objective:** Verify that registration or login through public HTTPS succeeds or reaches a clearly documented expected blocker.

### Steps

1. Use a clearly marked staging test email address:
   - Use a dedicated staging test address that is not a real personal or production account.
   - Example format: `staging-test-<date>@<your-test-domain>` — Keith must define this; do not use real personal email.

2. Navigate to the register page:
   ```
   https://staging.ainow.biz/en/register
   ```

3. Complete the registration form:
   - Enter the staging test email.
   - Enter a staging test password.
   - **Do not paste the password into Cursor chat or any AI interface.**
   - **Do not paste the password into any shared screenshot or log.**

4. Submit the registration form.

5. Observe the result.

### Expected outcomes

| Outcome | Action |
|---------|--------|
| Registration succeeds — redirected to authenticated area | Continue to Path E |
| Email verification required | Record as a decision/blocker in evidence — do not bypass — stop here |
| 500 or unexpected server error on submit | Stop condition — capture safe evidence |
| Any Google OAuth required to proceed | Stop condition — Google OAuth is deferred in 04B |

**Do not use Google OAuth.** If the only available registration path requires Google OAuth, this is a stop condition. Record the blocker and stop.

If registration succeeds and no email verification is required, continue to Path E.

---

## 17. Browser Smoke Path E — Authenticated Workspace/Dashboard Render (Only If Approved)

> **REQUIRES explicit approval (same gate as Path D).**
>
> **REQUIRES Path D to have succeeded (login/registration reached authenticated area).**

**Objective:** Verify that the authenticated landing area, workspace, dashboard, or project shell renders after login.

**Source grounding:** Frontend app has `[locale]/page.tsx` (home/index when logged in) and `[locale]/projects/page.tsx`. Expected authenticated landing area is the logged-in state of `https://staging.ainow.biz/en` or `https://staging.ainow.biz/en/projects`, depending on the app routing after login.

### Expected

| Check | Expected | Notes |
|-------|----------|-------|
| Authenticated area renders | No blank page | |
| No 404 | Expected route is valid | |
| No 500 | No server error | |
| No obvious hydration crash | No React error overlay | |
| Workspace/project/session shell visible | If it is part of current private beta scope | |
| No AI execution | Do not click any button that submits AI jobs | |
| No billing/payment flow | Do not navigate to billing/checkout | |
| No container workflow | Do not submit any container job | |

### Note

Do not trigger AI execution, billing/payment, or container workflow in Path E. Navigating passively through the authenticated dashboard to verify render is the only permitted action.

---

## 18. Browser Smoke Path F — Create Agent UI Availability Without Execution

> **REQUIRES explicit approval (same gate as Path D and E).**
>
> **REQUIRES authenticated state from Path E.**

**Objective:** Verify that the Create Agent entry point or UI is visible as part of current private beta scope, without triggering any execution.

**Source grounding:** Frontend app has `[locale]/app/page.tsx` and `[locale]/projects/page.tsx`. Create Agent UI entry point may be in the projects or app area.

### Steps

1. From the authenticated area, locate the Create Agent entry point, project creation button, or equivalent visible UI element.
2. You may open the Create Agent UI or modal.
3. **Do not submit any action that would trigger AI execution, provider calls, tool execution, container jobs, billing, or OAuth.**
4. Observe whether the UI is visible and renders.

### Expected

| Check | Expected | Notes |
|-------|----------|-------|
| Create Agent UI entry point visible | Yes, if it is part of current private beta scope | If absent, record as source-grounded if UI scope not yet deployed |
| UI renders without errors | No 500, no crash | |
| No execution triggered | No AI job submitted | |
| No billing triggered | No checkout initiated | |
| No container job triggered | No job submission | |
| Safe boundary observed | UI opened to inspection only | |

### If creating a harmless test record is needed to verify the UI

Stop. Require a separate explicit approval before creating any agent data. Do not proceed past the observation boundary.

---

## 19. Explicit AI/Billing/Container/OAuth Non-Execution Checks

Before completing smoke and capturing evidence, confirm each of the following did not occur:

| Non-goal | Required state | Record in evidence |
|----------|---------------|-------------------|
| AI execution triggered | Did not occur | `no AI execution: YES` |
| LLM/provider API call made | Did not occur | (implicit from no AI execution) |
| Billing/payment execution triggered | Did not occur | `no billing/payment execution: YES` |
| Checkout/subscription/invoice flow opened | Did not occur | |
| Container workflow execution triggered | Did not occur | `no container workflow execution: YES` |
| Google OAuth flow used | Did not occur | `no Google OAuth: YES` |
| Source code modified | Did not occur | `no source/migration/env changes: YES` |
| Migration files modified | Did not occur | |
| `.env` opened/created/edited | Did not occur | |
| Passwords/session/JWTs printed or pasted | Did not occur | `no secrets printed: YES` |
| Production domain tested | Did not occur | `no production domain tested: YES` |

If any of the above did occur, stop immediately and record it in the safe evidence template. This is a stop condition. Do not claim smoke as passed.

---

## 20. Final Safe-State Verification

After browser smoke (Paths A–C at minimum; D–F if approved), run the following from the AWS Lightsail browser SSH terminal to confirm the system remains in a safe state:

```bash
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
systemctl is-enabled caddy
systemctl is-active caddy

sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# expected: 26 before any persistent-data smoke; record actual count

cd /opt/aisandbox
git status --short
# expected: no output
```

**Expected post-smoke state:**

| Check | Expected |
|-------|----------|
| `pm2-ubuntu` enabled | enabled |
| `pm2-ubuntu` active | active |
| `caddy` enabled | enabled |
| `caddy` active | active |
| `git status --short` | no output |
| Public table count | 26 before approved persistent-data smoke; if persistent data approved, record actual count |

If Caddy or PM2 became inactive during smoke, this is a stop condition for a recovery slice. Do not restart them in the context of 04I — that requires a separate bounded recovery slice.

---

## 21. Pass Criteria

04I manual browser smoke should be marked **PASS** only if ALL of the following are true:

**Required (pre-smoke health):**
- [ ] Pre-smoke public HTTPS health checks returned expected status codes.
- [ ] Pre-smoke local health checks returned expected status codes.
- [ ] PM2 and Caddy were active before smoke.
- [ ] Public table count was 26 before smoke.
- [ ] Git status was clean before smoke.

**Required (browser smoke):**
- [ ] Public browser root loaded over HTTPS with no certificate warning.
- [ ] Root locale redirect behaved correctly (`/` → `/en`).
- [ ] Login page rendered at `https://staging.ainow.biz/en/login` — no 404/500/crash.
- [ ] Register page rendered at `https://staging.ainow.biz/en/register` — no 404/500/crash.

**Required (if authenticated smoke was approved):**
- [ ] Registration/login path succeeded OR a clearly documented source-grounded expected blocker was reached and recorded.
- [ ] Authenticated workspace/dashboard rendered — no 404/500/crash.

**Required (if Create Agent check was performed):**
- [ ] Create Agent UI is visible, OR absence is source-grounded and recorded.
- [ ] No execution was triggered.

**Required (non-goals):**
- [ ] No AI execution occurred.
- [ ] No billing/payment execution occurred.
- [ ] No container workflow execution occurred.
- [ ] No Google OAuth enablement/use occurred.
- [ ] No secrets were printed.
- [ ] No source/migration/env changes occurred.
- [ ] No production domain was tested.
- [ ] Public table count recorded before and after (if persistent data was approved).

If any required item is not met, 04I browser smoke does **not** pass. Mark as FAIL with specific stop conditions recorded in safe evidence.

---

## 22. Stop Conditions

Immediately stop browser smoke and capture safe evidence if any of the following occur:

**Certificate / HTTPS:**
- Browser shows a certificate warning, "Not Secure", or certificate error for `staging.ainow.biz`.
- HTTPS lock is absent or shows a broken/invalid certificate chain.

**Page load failures:**
- Public HTTPS root (`https://staging.ainow.biz`) fails to load — connection refused, DNS failure, or timeout.
- Infinite redirect loop — browser shows "too many redirects" error.
- Login page returns 404 or 500.
- Register page returns 404 or 500.
- Blank app shell — page loads but no content renders at all.
- Visible hydration crash overlay (React error boundary or Next.js crash page).
- Missing critical CSS/layout that blocks any interaction or readability.

**Health failures:**
- Any public HTTPS health endpoint returns an unexpected status code before smoke.
- Any local health endpoint returns an unexpected status code before smoke.
- Caddy is inactive.
- PM2 is inactive.
- Public table count unexpectedly changes before approved persistent-data smoke.

**Approval and data gates:**
- Account creation would be required but Keith has not given approval.
- Password, session cookie, or JWT/token would need to be pasted into an AI interface or shared channel.
- Google OAuth is the only available login/registration path.

**Execution gates:**
- Any AI execution would be triggered.
- Any billing/payment flow would be triggered.
- Any container workflow would be triggered.
- Any LLM/provider API call would be made.

**Domain / scope gates:**
- URL changes to `app.ainow.biz` or `ainow.biz` (wrong domain — production).
- Any recovery or code fix appears necessary to proceed.

**Source/env gates:**
- Source code, migration files, or `.env` changes appear necessary to proceed.
- Any secret was accidentally printed or pasted.

When a stop condition is triggered:
1. Stop immediately.
2. Do not make any changes to code, env, Caddy, DNS, PM2, systemd, database, or migrations.
3. Capture safe evidence using the template in Section 24.
4. Note the exact stop condition in the evidence.
5. Raise a separate bounded recovery or investigation slice.

---

## 23. Recovery Boundary

04I does **not** include recovery, debugging, or fixes.

If browser smoke fails:

- Stop at the first stop condition.
- Do not modify code, env, Caddy, DNS, PM2, systemd, database, or migrations.
- Do not attempt a workaround or in-place fix.
- Capture safe evidence only using the template in Section 24.
- Record the exact stop condition, the URL at failure, and the observed symptom.
- Do not mark 04I as PASS.

A failed 04I smoke should trigger:
- A separate bounded recovery or investigation child slice.
- Registration of the recovery slice in TASKS.md and TASKS_BACKLOG_FULL.md before implementation begins.

Recovery and fixes are separate governed slices. 04I stops cleanly on failure.

---

## 24. Safe Evidence Template

Copy this template and fill it in after performing browser smoke (Paths A–C minimum; D–F if approved):

```text
04I Browser / User-Facing Smoke Evidence

Pre-smoke public/local health:
- date:
- public table count before smoke:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- caddy enabled:
- caddy active:
- PUBLIC_HTTPS_ROOT_FORCED:
- PUBLIC_HTTPS_API_HEALTH_FORCED:
- PUBLIC_HTTPS_API_DB_HEALTH_FORCED:
- PUBLIC_HTTPS_API_READY_FORCED:
- LOCAL_API_HEALTH:
- LOCAL_API_DB_HEALTH:
- LOCAL_API_READY:
- LOCAL_CONTAINER_HEALTH:
- LOCAL_FRONTEND_ROOT:

Browser smoke:
- URL used: https://staging.ainow.biz
- HTTPS lock / certificate:
- root / locale redirect:
- login page render:
- register page render:
- account/authenticated smoke approved:
- test account created:
- login/register result:
- authenticated workspace/dashboard render:
- Create Agent UI visible:
- Create Agent execution avoided:

Post-smoke safe state:
- public table count after smoke:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- caddy enabled:
- caddy active:

Safety/non-goals:
- no password/session/JWT/token printed:
- no .env values or secrets printed:
- no AI execution:
- no billing/payment execution:
- no container workflow execution:
- no Google OAuth:
- no source/migration/env changes:
- no production domain tested:

Warnings/errors:
- none / details:
```

---

## 25. Expected Final State

After manual browser smoke is completed by Keith:

| State | Expected |
|-------|----------|
| Public HTTPS browser root | Loads — valid HTTPS certificate — locale redirect works |
| Login page | Renders at `https://staging.ainow.biz/en/login` |
| Register page | Renders at `https://staging.ainow.biz/en/register` |
| Authenticated workspace/dashboard | Rendered only if approval was given — otherwise deferred |
| Create Agent UI | Verified to safe non-execution boundary only if approval was given |
| AI execution | Did not occur |
| Billing/payment execution | Did not occur |
| Container workflow execution | Did not occur |
| Google OAuth | Not enabled or used |
| Secrets | Not printed |
| Source/migration/env changes | Did not occur |
| Production domain | Not tested |
| 04I evidence | Ready for evidence review |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 | Remains ACTIVE until 04I consolidation |
| PRIVATE-BETA-DEPLOYMENT-READINESS | Remains BLOCKED / PAUSED |

---

## 26. Exact Next Action

After Keith completes manual browser smoke and captures safe evidence:

```text
Return safe evidence to Cursor chat as plain text (no secrets, passwords, session cookies, JWTs, .env values).
The next step is Step 3 — Manual Browser Smoke Execution (operator-side, Keith only).
After evidence is captured, the next Cursor step is Step 4 — Evidence Review (PRIVATE-BETA-STAGING-EXECUTION-04I).
After evidence review verdict, the next Cursor step is Step 5 — Consolidation / Checkpoint (PRIVATE-BETA-STAGING-EXECUTION-04I).
```

**Keep parent PRIVATE-BETA-STAGING-EXECUTION-04 ACTIVE.**  
**Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.**  
**Do not enable AI / billing / container / OAuth execution.**  
**Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready from 04I alone.**  
**Do not cut over production domain (`app.ainow.biz` / `ainow.biz`).**

---

**End of runbook.**

**Runbook created:** 2026-08-03  
**Step 2 status:** Browser / User-Facing Smoke Runbook COMPLETE.  
**No SSH or AWS CLI/actions performed by Cursor.**  
**No browser opened by Cursor.**  
**No accounts created.**  
**No env values printed.**  
**No subagents used.**  
**No source or migration files changed.**  
**No git commit or push.**
