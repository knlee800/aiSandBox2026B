# PRIVATE-BETA-STAGING-EXECUTION-04I1 — Public Root / Locale Redirect Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I1  
**Title:** Public Root / Locale Redirect Browser Smoke Failure Investigation  
**Step:** 4 — Evidence Review  
**Review date:** 2026-08-03  
**Nature:** Evidence review only — no SSH — no AWS CLI/actions — no browser opened by Cursor — no accounts created — no login/register executed — no AI execution — no billing/payment execution — no container workflow execution — no Google OAuth enablement — no DNS/TLS/Caddy changes — no reboot — no PM2/systemd commands — no `.env` opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped/restarted — no migrations — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no TASKS/TASKS_BACKLOG_FULL/roadmap changes — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I1 |
| Title | Public Root / Locale Redirect Browser Smoke Failure Investigation |
| Step | 4 — Evidence Review |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Grandparent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessor | PRIVATE-BETA-STAGING-EXECUTION-04H — COMPLETE and LOCKED — 2026-08-03 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL — blocks 04I / 04 / DEPLOYMENT-READINESS |
| Nature | Evidence review only — no fix, no runtime change, no account/data creation |
| Risk | LOW — evidence review only |
| Operator | Keith |
| Execution venue (operator) | AWS Lightsail browser SSH (prior step — not Cursor) |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Static IP | `aisandbox-staging-ip` — public IP `18.136.141.186` |
| Public staging URL | `https://staging.ainow.biz` |

---

## 2. Purpose

This document reviews Keith's safe manual investigation evidence from PRIVATE-BETA-STAGING-EXECUTION-04I1 Step 3 and issues a verdict on whether the evidence is sufficient to classify the root redirect failure and determine a bounded path to recovery.

This step performs evidence review and source-grounded interpretation only. It does not SSH, use AWS CLI, open a browser, edit DNS, configure Caddy, reload services, run PM2/systemd commands, open `.env`, print secrets, start/stop/restart app services, modify source or migration files, or change governance documents.

---

## 3. Evidence Reviewed

| # | File |
|---|------|
| 1 | `TASKS.md` |
| 2 | `TASKS_BACKLOG_FULL.md` |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` |
| 4 | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-BROWSER-USER-FACING-SMOKE-RUNBOOK.md` |
| 5 | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I1-PUBLIC-ROOT-LOCALE-REDIRECT-INVESTIGATION-RUNBOOK.md` |
| 6 | `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-CHECKPOINT.md` |
| 7 | `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-PUBLIC-ROUTING-DNS-TLS-EVIDENCE-REVIEW.md` |
| 8 | `frontend/middleware.ts` |
| 9 | `frontend/app/[locale]/page.tsx` |
| 10 | `frontend/app/[locale]/login/page.tsx` |
| 11 | `frontend/app/[locale]/register/page.tsx` |
| 12 | Keith's 04I1 manual investigation evidence (supplied text) |

---

## 4. Known-Good State

The following state was confirmed from Keith's investigation evidence at **Mon Aug 3 15:46:47 HKT 2026** on instance `ip-172-26-6-228` (`ubuntu`), uptime 4 days 22:30.

### 4.1 Instance Identity

| Check | Value | Verdict |
|-------|-------|---------|
| date | Mon Aug 3 15:46:47 HKT 2026 | RECORDED |
| uptime | up 4 days, 22:30 | RECORDED |
| whoami | ubuntu | RECORDED |
| hostname | ip-172-26-6-228 | RECORDED |
| repo path | /opt/aisandbox | RECORDED |

### 4.2 Services

| Check | Value | Verdict |
|-------|-------|---------|
| pm2-ubuntu enabled | enabled | **PASS** |
| pm2-ubuntu active | active | **PASS** |
| caddy enabled | enabled | **PASS** |
| caddy active | active | **PASS** |

### 4.3 Database Safe State

| Check | Value | Verdict |
|-------|-------|---------|
| Public table count | 26 | **PASS** — unchanged from 04H and 04I Step 3 baseline |

### 4.4 Public DNS

| Check | Value | Verdict |
|-------|-------|---------|
| dig @1.1.1.1 staging.ainow.biz A | 18.136.141.186 | **PASS** — matches static IP from 04H |
| dig @8.8.8.8 staging.ainow.biz A | 18.136.141.186 | **PASS** — matches static IP from 04H |

### 4.5 Public Health Endpoints

| Check | Value | Verdict |
|-------|-------|---------|
| PUBLIC_HTTPS_ROOT_FORCED | 307 | **PASS** — expected locale redirect (3xx acceptable) |
| PUBLIC_HTTPS_API_HEALTH_FORCED | 200 | **PASS** |
| PUBLIC_HTTPS_API_DB_HEALTH_FORCED | 200 | **PASS** |
| PUBLIC_HTTPS_API_READY_FORCED | 200 | **PASS** |

### 4.6 Local Health Endpoints

| Check | Value | Verdict |
|-------|-------|---------|
| LOCAL_API_HEALTH | 200 | **PASS** |
| LOCAL_API_DB_HEALTH | 200 | **PASS** |
| LOCAL_API_READY | 200 | **PASS** |
| LOCAL_CONTAINER_HEALTH | 200 | **PASS** |
| LOCAL_FRONTEND_ROOT | 307 | **PASS** — locale redirect from Next.js directly on port 3002 |

### 4.7 Direct Locale Routes (Known-Good)

| Check | Value | Verdict |
|-------|-------|---------|
| CURL_EN_FORCED (`/en`) | HTTP/2 200, content-type: text/html; charset=utf-8, via: 1.1 Caddy, x-powered-by: Next.js | **PASS** |
| CURL_LOGIN_FORCED (`/en/login`) | HTTP/2 200, content-type: text/html; charset=utf-8, via: 1.1 Caddy, x-powered-by: Next.js | **PASS** |
| CURL_REGISTER_FORCED (`/en/register`) | HTTP/2 200, content-type: text/html; charset=utf-8, via: 1.1 Caddy, x-powered-by: Next.js | **PASS** |

**Known-good state summary:** DNS resolves correctly. PM2 and Caddy are enabled and active. All public and local health endpoints pass. Direct locale routes `/en`, `/en/login`, and `/en/register` all return HTTP/2 200 through Caddy. The app is running. Public table count is 26 (clean pre-investigation baseline).

---

## 5. Root Failure Evidence

### 5.1 Root Redirect Chain

| Check | Value |
|-------|-------|
| CURL_REDIRECT_CHAIN_FORCED_ROOT | HTTP/2 307 — `location: https://localhost:3002/en` — `via: 1.1 Caddy` |
| CURL_REDIRECT_CHAIN_FORCED_ROOT_NO_SLASH | HTTP/2 307 — `location: https://localhost:3002/en` — `via: 1.1 Caddy` |
| CURL_REDIRECT_CHAIN_FOLLOW_FORCED_ROOT | HTTP/2 307 — `location: https://localhost:3002/en` — `via: 1.1 Caddy` — then curl failed: `curl: (35) OpenSSL/3.0.13: error:0A00010B:SSL routines::wrong version number` |

### 5.2 Critical Finding

**Root returns HTTP/2 307 but the `Location` header is `https://localhost:3002/en`.**

- Expected (browser-safe): `Location: https://staging.ainow.biz/en` or relative `Location: /en`
- Actual: `Location: https://localhost:3002/en`

This `Location` value is not publicly reachable. `localhost:3002` is the internal address of the Next.js frontend process on the staging server. It is not accessible from a browser on an external machine.

### 5.3 Curl Follow Failure Explanation

The `curl: (35) OpenSSL: wrong version number` error when following the redirect occurs because:
- curl follows the `Location: https://localhost:3002/en` redirect
- curl attempts an HTTPS connection to `localhost:3002` from within the server
- Port 3002 is a plain HTTP Next.js listener — not TLS
- An HTTPS client connecting to a plain HTTP port receives non-TLS bytes, triggering an SSL handshake error

This confirms the `Location` target is the raw Next.js process at its internal HTTP port — not the Caddy-fronted HTTPS endpoint.

### 5.4 Browser Observation

From Keith:
- `https://staging.ainow.biz/` → browser follows `Location: https://localhost:3002/en` → connection fails (user's machine has no service on localhost:3002)
- `http://staging.ainow.biz/` → same chain → same failure
- `https://staging.ainow.biz/en` → works correctly in browser

---

## 6. Browser Impact

The root `https://staging.ainow.biz` is functionally broken for any browser on a machine that is not the staging server itself, because:

1. Browser navigates to `https://staging.ainow.biz`
2. Caddy proxies the request to Next.js on `127.0.0.1:3002`
3. Next.js middleware intercepts the `/` path and issues a 307 redirect
4. The `Location` header constructed by Next.js is `https://localhost:3002/en`
5. Browser follows the redirect to `https://localhost:3002/en`
6. User's machine has no service at `localhost:3002` — connection fails or produces a browser error
7. 04I Path A does not pass

`https://staging.ainow.biz/en` bypasses this redirect entirely — Next.js serves it directly — so it works correctly.

---

## 7. Hypothesis Classification

### 7.1 Best-Fit Hypothesis: Caddy / Next.js Reverse-Proxy Forwarded-Host/Proto Mismatch (Hypothesis D + E, interrelated)

**Evidence-based classification:** The `Location: https://localhost:3002/en` value is the direct output of `request.nextUrl.clone()` in `frontend/middleware.ts` lines 33–37:

```typescript
if (pathname === '/') {
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}`;
  return NextResponse.redirect(url);
}
```

`request.nextUrl.clone()` clones the full URL object including scheme and host. In a correctly configured reverse-proxy setup, `request.nextUrl` for a request to `https://staging.ainow.biz/` should yield a URL with `hostname = staging.ainow.biz` and `protocol = https:`. The cloned URL with `pathname = /en` would then produce `https://staging.ainow.biz/en` — the correct Location.

Instead, the evidence shows `request.nextUrl` is resolving to `localhost:3002`. This means one of the following is true at the time of the request:

- **Hypothesis D (likely primary):** Caddy's `reverse_proxy 127.0.0.1:3002` directive is not forwarding the original `Host: staging.ainow.biz` header from the client request to the Next.js upstream. The Next.js process therefore sees `Host: localhost:3002` (or `Host: 127.0.0.1:3002`) and constructs `request.nextUrl` with that host. Combined with an `X-Forwarded-Proto: https` header being forwarded by Caddy (which would explain the `https://` scheme), the clone produces `https://localhost:3002/en`.

- **Hypothesis E (contributing):** `request.nextUrl.clone()` inherits the scheme and host from the incoming request URL as seen by Next.js. If Next.js does not receive `X-Forwarded-Host` (or does not trust it), it cannot override the host to `staging.ainow.biz`. Even if `X-Forwarded-Host: staging.ainow.biz` were forwarded, Next.js middleware would need to be configured to use it.

**Ruling:** This is a reverse-proxy host header forwarding issue. Caddy is not forwarding the public-facing Host correctly to the Next.js upstream, or Next.js is not reading the forwarded host from Caddy headers. The `Location` header is being constructed from the internal `localhost:3002` address rather than the public-facing `staging.ainow.biz` hostname.

**Two potential minimal fix paths (to be determined in 04I2):**
1. **Caddy fix:** Add `header_up Host {http.request.host}` (or equivalent) to the Caddy `reverse_proxy` directive to ensure the original public Host is forwarded to Next.js. Requires explicit Keith approval before any Caddy change.
2. **Next.js middleware fix:** Change `frontend/middleware.ts` to construct the redirect URL using a relative path or explicitly reading from `X-Forwarded-Host` / `X-Forwarded-Proto` headers, rather than relying on `request.nextUrl.clone()` inheriting the host from the internal upstream address. Requires a separate implementation slice.
3. **Combination:** Both approaches may need to be applied together for correct behavior.

The exact smallest safe fix must be determined in 04I2.

---

## 8. Ruled-Out Causes

| Cause | Verdict | Reason |
|-------|---------|--------|
| DNS failure | **RULED OUT** | dig @1.1.1.1 and @8.8.8.8 both return 18.136.141.186 — matches static IP |
| TLS / certificate failure | **RULED OUT** | HTTP/2 200 returned for `/en`, `/en/login`, `/en/register` through Caddy — TLS is valid and functioning |
| General frontend/app outage | **RULED OUT** | `/en` returns HTTP/2 200 with Next.js headers — app is serving pages correctly |
| Missing `/en` route | **RULED OUT** | CURL_EN_FORCED = HTTP/2 200 |
| Missing `/en/login` route | **RULED OUT** | CURL_LOGIN_FORCED = HTTP/2 200 |
| Missing `/en/register` route | **RULED OUT** | CURL_REGISTER_FORCED = HTTP/2 200 |
| Caddy inactive | **RULED OUT** | caddy active: active — confirmed in evidence |
| PM2 / app process inactive | **RULED OUT** | pm2-ubuntu active: active — all services healthy |
| Browser cache / HSTS / service worker (Hypothesis A) | **INSUFFICIENT EVIDENCE TO CONFIRM — but low probability as primary cause** | Keith did not report incognito test results. However, the `Location: https://localhost:3002/en` header is present in server-side curl evidence — not just in a browser. A browser-local cache issue cannot produce a wrong `Location` header in an HTTP response captured by curl. Hypothesis A is not the primary cause; the server is generating the wrong Location header. |
| Browser cookie / session state (Hypothesis F) | **RULED OUT AS PRIMARY CAUSE** | Same reasoning: the wrong `Location` header is visible in curl evidence at the server level, not produced by a browser-local state |
| Client-side hydration issue (Hypothesis G) | **RULED OUT AS PRIMARY CAUSE** | The failure is at the redirect response level — the 307 Location header is wrong before any client-side rendering occurs |
| Redirect loop / infinite redirects | **RULED OUT** | No loop detected — 307 fires once with a specific Location; the failure is in the Location target, not a loop |
| Wrong public domain / production domain redirect | **RULED OUT** | Location is `localhost:3002`, not a production domain |

---

## 9. Source-Grounded Middleware / Route Context

### 9.1 `frontend/middleware.ts` — Root Redirect Logic

The middleware at `frontend/middleware.ts` contains this exact logic for the root path (lines 33–37):

```typescript
if (pathname === '/') {
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}`;
  return NextResponse.redirect(url);
}
```

`DEFAULT_LOCALE = 'en'` (line 5).

**Matcher configuration** (lines 45–47):

```typescript
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

The matcher correctly matches `/` — there is no matcher exclusion that would skip the root path.

**Source-grounded conclusion:** The middleware logic for the root redirect is correct in intent. The issue is not in the conditional logic or the matcher. The issue is that `request.nextUrl.clone()` inherits the host and scheme from the request as received by the Next.js process — which, behind Caddy without correct host header forwarding, resolves to `localhost:3002`. The resulting redirect URL is `https://localhost:3002/en` rather than the expected `https://staging.ainow.biz/en`.

### 9.2 `frontend/app/[locale]/page.tsx`

The `[locale]/page.tsx` page renders `<PublicLandingSlice locale={locale} />`. This is a server component with no client-side hydration logic at the route level. If the redirect to `/en` were correct (landing at `https://staging.ainow.biz/en`), this page would serve and render. Evidence confirms `/en` returns HTTP/2 200 with Next.js headers — so the page itself is not the failure point.

### 9.3 `frontend/app/[locale]/login/page.tsx`

The login page has a `useSafeEffect` that probes `/api/auth/me` on mount and redirects to `/${locale}/app` if an active session is found. No stale session exists (no accounts have been created). This page is not a factor in the root failure.

### 9.4 `frontend/app/[locale]/register/page.tsx`

The register page has the same `useSafeEffect` pattern probing `/api/auth/me`. No stale session exists. This page is not a factor in the root failure.

### 9.5 Caddy Route Context (from 04H Checkpoint)

From the 04H checkpoint, the Caddyfile routes:
- `/api/*` → `reverse_proxy 127.0.0.1:4000`
- All other paths → `reverse_proxy 127.0.0.1:3002`

`auto_https` is enabled (Caddy automatic HTTP→HTTPS with Let's Encrypt). No `header_up Host` or `X-Forwarded-Host` preservation was recorded in the 04H evidence. The Caddyfile had a non-blocking formatting warning noted in 04H.

**Source-grounded conclusion:** The Caddy `reverse_proxy 127.0.0.1:3002` directive in its current form (as evidenced in 04H) does not appear to explicitly forward the original public `Host` header to Next.js. This is consistent with Next.js seeing `localhost:3002` as the request host and constructing the redirect accordingly.

---

## 10. Required-Question Answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Was the exact root browser symptom captured? | **YES** — browser follows `https://staging.ainow.biz` → `Location: https://localhost:3002/en` → connection fails on user's machine |
| 2 | Does public DNS resolve correctly? | **YES** — 18.136.141.186 via 1.1.1.1 and 8.8.8.8 |
| 3 | Are PM2 and Caddy enabled/active? | **YES** — both enabled and active |
| 4 | Did public health endpoints pass? | **YES** — all 200 (API health, DB health, ready); root 307 is expected/accepted |
| 5 | Did local health endpoints pass? | **YES** — all 200 (API, DB, ready, container); frontend root 307 expected |
| 6 | Did `/en` return 200? | **YES** — HTTP/2 200 via Caddy |
| 7 | Did `/en/login` return 200? | **YES** — HTTP/2 200 via Caddy |
| 8 | Did `/en/register` return 200? | **YES** — HTTP/2 200 via Caddy |
| 9 | What does root `/` return? | HTTP/2 307 |
| 10 | What Location header does root return? | `https://localhost:3002/en` |
| 11 | Is the root Location header browser-safe? | **NO** — `localhost:3002` is the staging server's internal address, not publicly reachable |
| 12 | Does the Location header explain the browser failure? | **YES** — browser follows the redirect to `localhost:3002` which is not accessible on the user's machine |
| 13 | Is this likely a DNS issue? | **NO** — ruled out |
| 14 | Is this likely a TLS issue? | **NO** — ruled out |
| 15 | Is this likely a general frontend outage? | **NO** — ruled out; `/en`, `/en/login`, `/en/register` all return 200 |
| 16 | Is this likely a missing `/en` route issue? | **NO** — ruled out |
| 17 | Is this likely a missing login/register route issue? | **NO** — ruled out |
| 18 | Which hypothesis category best fits the evidence? | Hypothesis D + E (interrelated): Caddy reverse-proxy not forwarding public Host header to Next.js, causing `request.nextUrl.clone()` in `middleware.ts` to construct redirect URL from internal `localhost:3002` address |
| 19 | Did any account/login/persistent-data action occur? | **NO** |
| 20 | Did any AI/billing/container/OAuth action occur? | **NO** |
| 21 | Were any secrets printed? | **NO** |
| 22 | Did any source/migration/env/runtime change occur? | **NO** |
| 23 | Is the evidence sufficient to move to a bounded fix/recovery slice? | **YES** — the failure is clearly classified with a specific Location value and source-grounded root cause hypothesis |
| 24 | Should 04I remain blocked? | **YES** — until 04I2 corrects the redirect and revalidation passes |
| 25 | What is the exact next recommended action? | Register PRIVATE-BETA-STAGING-EXECUTION-04I2 — bounded fix/recovery slice for root redirect Location header |

---

## 11. Safety / Non-Goal Verification

| Non-goal | Occurred? | Verdict |
|----------|-----------|---------|
| Accounts created | No | **PASS** |
| Login performed | No | **PASS** |
| Workspace data created | No | **PASS** |
| Agent data created | No | **PASS** |
| AI execution triggered | No | **PASS** |
| Billing/payment execution triggered | No | **PASS** |
| Container workflow execution triggered | No | **PASS** |
| Google OAuth enabled or used | No | **PASS** |
| Secrets printed or pasted | No | **PASS** |
| Source/migration/env changes | No | **PASS** |
| PM2/systemd commands run by Cursor | No | **PASS** |
| Caddy reloaded or configured by Cursor | No | **PASS** |
| DNS records modified | No | **PASS** |
| Production domain tested | No | **PASS** |
| Public table count changed | No — remains 26 | **PASS** |
| Git status changed | No — repo at /opt/aisandbox, no changes | **PASS** |
| Runtime/server changes by Cursor | No | **PASS** |
| Docker/PostgreSQL/Redis actions by Cursor | No | **PASS** |
| git commit or push by Cursor | No | **PASS** |
| Subagents used | No | **PASS** |

**Safety verification: ALL NON-GOALS RESPECTED.**

---

## 12. Verdict

```
INVESTIGATION PASS — ROOT BEHAVIOR FAILS
```

**04I1 successfully captured sufficient evidence to classify the root redirect failure.**

**The public root behavior at `https://staging.ainow.biz` still fails 04I Path A.**

**Specific finding:** The root HTTP/2 307 redirect returns `Location: https://localhost:3002/en` — not the browser-safe `Location: https://staging.ainow.biz/en` or relative `Location: /en`. Any browser on a machine other than the staging server follows this redirect to an unreachable address and experiences a connection failure.

**04I remains blocked until a bounded fix/recovery slice corrects the redirect Location header and revalidation passes.**

---

## 13. Rationale

1. **Investigation evidence is sufficient.** The exact `Location` header value (`https://localhost:3002/en`) was captured in server-side curl evidence — not merely as a browser-level observation. This makes the root cause unambiguous and classifiable.

2. **The failure is structural, not transient.** Both curl with slash and without slash return the same wrong Location. The `follow` curl also fails consistently. This is not a flapping or intermittent issue.

3. **The source is traced.** `frontend/middleware.ts` lines 33–37 use `request.nextUrl.clone()` for the root redirect. `request.nextUrl` in Next.js reflects the URL as seen by the server, including the `Host` header. Behind Caddy at `127.0.0.1:3002` without explicit host header forwarding, `request.nextUrl.host` resolves to `localhost:3002`. The cloned URL inherits this, producing the wrong Location.

4. **Hypothesis A, B, F, G are ruled out as primary causes.** The wrong Location header appears in curl evidence at the server level — it is not a browser-side artifact, cache issue, DNS issue, or client-side rendering issue.

5. **The fix boundary is clear.** Either Caddy must forward the original `Host: staging.ainow.biz` header to the Next.js upstream, or `middleware.ts` must be changed to construct a safe redirect URL that does not rely on `request.nextUrl.clone()` inheriting the internal proxy host. A relative redirect (`/en`) in the middleware would also resolve the browser impact. The exact smallest safe fix must be determined in 04I2.

6. **Known-good paths confirm partial system health.** `/en`, `/en/login`, `/en/register` all return 200 through Caddy. DNS, TLS, PM2, Caddy, health endpoints, and the database are all passing. The scope of the failure is precisely the root redirect Location header.

---

## 14. Residual Risks

| Residual risk | Notes |
|---------------|-------|
| Exact root cause not yet fixed | 04I1 is investigation only — no fix has been applied |
| 04I Path A remains failed | Root `https://staging.ainow.biz` still redirects to `https://localhost:3002/en` |
| 04I remains blocked by 04I1 / next fix slice | Paths B, C, D, E, F have not been executed |
| Smallest safe fix still to be determined | Must evaluate: (a) Caddy header forwarding fix, (b) middleware relative redirect, or (c) combination |
| Caddy runtime fix requires explicit Keith approval | Any change to `/etc/caddy/Caddyfile` requires a separate approved Caddy fix slice — Keith must approve before execution |
| Source-code fix requires a separate implementation slice | Changing `middleware.ts` requires a registered implementation slice and validation (tests, build, deployment) |
| Browser user-facing smoke Paths B/C/D/E/F remain incomplete | Cannot proceed under 04I until Path A passes after the fix |
| PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED | Must not advance from 04I1 alone |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE | Full staging deployment baseline not complete |
| No accounts, workspaces, or agents have been created | Authenticated smoke (Paths D/E/F) remain gated behind explicit approval — separate concern |
| Public table count is 26 | Must remain 26 until authenticated smoke is explicitly approved |
| The fix must be revalidated after application | A forced-IP curl check and browser Path A smoke must pass before 04I can resume |

---

## 15. What Remains Blocked

- **04I Path A** — Public root / locale redirect in browser — BLOCKED until 04I2 fix applied and revalidated
- **04I Paths B, C** — Login/register page render smoke — BLOCKED pending Path A passing
- **04I Paths D, E, F** — Authenticated smoke — gated behind explicit approval AND Path A/B/C passing
- **04I consolidation/checkpoint** — BLOCKED until 04I Paths A/B/C pass at minimum
- **PRIVATE-BETA-STAGING-EXECUTION-04** — ACTIVE — remains open
- **PRIVATE-BETA-DEPLOYMENT-READINESS** — BLOCKED / PAUSED — must not advance

---

## 16. Exact Next Recommended Action

Register a bounded fix/recovery slice:

```
PRIVATE-BETA-STAGING-EXECUTION-04I2 — Public Root Redirect Location Header Fix
```

**Purpose:**

```
Correct the public root redirect so https://staging.ainow.biz redirects to /en or https://staging.ainow.biz/en, not https://localhost:3002/en.
```

The fix slice must:

1. Determine the smallest safe fix among:
   - **Option A — Caddy fix:** Add explicit host header forwarding to the Caddy `reverse_proxy 127.0.0.1:3002` directive so that Next.js receives `Host: staging.ainow.biz` and constructs the correct redirect URL. This requires explicit Keith approval before any Caddy change and a separate Caddy fix slice.
   - **Option B — Next.js middleware fix:** Change `frontend/middleware.ts` to use a relative redirect (`/en`) instead of an absolute cloned URL, or to reconstruct the absolute URL from trusted forwarded headers (`X-Forwarded-Host`, `X-Forwarded-Proto`). This requires a registered implementation slice, validation (TypeScript check, tests, build), and re-deployment to staging.
   - **Option C — Combination:** Apply both Caddy host forwarding and a more defensive middleware redirect construction to ensure correctness under all proxy configurations.

2. Register 04I2 in `TASKS.md` and `TASKS_BACKLOG_FULL.md` before implementation begins.

3. After the fix is applied: revalidate with a forced-IP curl check that the `Location` header on the root 307 is `https://staging.ainow.biz/en` (or relative `/en`), and then re-execute 04I Path A in a browser.

4. Only after Path A passes: resume 04I from Path B and continue to Path C.

5. Explicit Keith approval is required before any Caddy change.

6. A separate implementation slice is required before any source code change.

**Do not implement the fix in this evidence review step.**

---

## 17. Validation Checklist

- [x] Evidence review file exists: `docs/PRIVATE-BETA-STAGING-EXECUTION-04I1-PUBLIC-ROOT-LOCALE-REDIRECT-EVIDENCE-REVIEW.md`
- [x] Verdict is explicit: `INVESTIGATION PASS — ROOT BEHAVIOR FAILS`
- [x] Root Location `https://localhost:3002/en` is recorded (Sections 5, 10, 12)
- [x] `/en` HTTP/2 200 is recorded (Sections 4.7, 10)
- [x] `/en/login` HTTP/2 200 is recorded (Sections 4.7, 10)
- [x] `/en/register` HTTP/2 200 is recorded (Sections 4.7, 10)
- [x] DNS PASS is recorded (Section 4.4)
- [x] PM2/Caddy active state is recorded (Section 4.2)
- [x] Public and local health PASS is recorded (Sections 4.5, 4.6)
- [x] Browser impact is recorded (Section 6)
- [x] Hypothesis classification is recorded (Section 7)
- [x] Ruled-out causes are recorded (Section 8)
- [x] Source-grounded middleware/route context is recorded (Section 9)
- [x] Safety/non-goal verification is recorded (Section 11)
- [x] Next recommended action is 04I2 fix/recovery registration (Section 16)
- [x] No TASKS/TASKS_BACKLOG_FULL/roadmap changes
- [x] No source files changed
- [x] No migration files changed
- [x] No env files opened/created/edited
- [x] No env values printed
- [x] No runtime/server action by Cursor
- [x] No Docker/PostgreSQL/Redis action by Cursor
- [x] No git commit or push
- [x] No subagents used

---

**End of evidence review.**

**Review created:** 2026-08-03  
**Step 4 status:** Evidence Review COMPLETE.  
**Verdict: INVESTIGATION PASS — ROOT BEHAVIOR FAILS.**  
**No SSH or AWS CLI/actions performed by Cursor.**  
**No browser opened by Cursor.**  
**No accounts created.**  
**No env values printed.**  
**No subagents used.**  
**No source or migration files changed.**  
**No git commit or push.**
