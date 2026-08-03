# PRIVATE-BETA-STAGING-EXECUTION-04I1 — Public Root / Locale Redirect Investigation Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I1  
**Title:** Public Root / Locale Redirect Browser Smoke Failure Investigation  
**Step:** 2 — Investigation Runbook  
**Runbook date:** 2026-08-03  
**Nature:** Runbook creation only — no SSH — no AWS CLI/actions — no browser opened by Cursor — no accounts created — no login/register executed — no AI execution — no billing/payment execution — no container workflow execution — no Google OAuth enablement — no DNS/TLS/Caddy changes — no reboot — no PM2/systemd commands — no `.env` opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped/restarted — no migrations — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no TASKS/TASKS_BACKLOG_FULL/roadmap changes — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I1 |
| Title | Public Root / Locale Redirect Browser Smoke Failure Investigation |
| Step | 2 — Investigation Runbook |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Grandparent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessor | PRIVATE-BETA-STAGING-EXECUTION-04H COMPLETE and LOCKED — 2026-08-03 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL — blocks 04I / 04 / DEPLOYMENT-READINESS |
| Nature | REAL STAGING INVESTIGATION — evidence capture and classification only |
| Risk | LOW — investigation only; no fix, no runtime change, no account/data creation |
| Step 1 Status | COMPLETE — Registration — 2026-08-03 |
| Step 2 Status | COMPLETE — this runbook |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I1-PUBLIC-ROOT-LOCALE-REDIRECT-INVESTIGATION-RUNBOOK.md` — this file |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I1-CHECKPOINT.md` |
| Operator | Keith |
| Execution venue (operator) | Browser (Keith's local machine) + AWS Lightsail browser SSH for SSH/curl evidence — not Cursor |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Static IP | `aisandbox-staging-ip` — public IP `18.136.141.186` |
| Public staging URL | `https://staging.ainow.biz` |

---

## 2. Purpose

04I1 investigates and classifies the public root redirect failure that blocked 04I browser smoke at Path A.

04I Step 3 browser smoke stopped because `https://staging.ainow.biz` root did not work as expected in a browser, even though:

- `https://staging.ainow.biz/en` worked correctly in a browser.
- `curl --resolve` forced-IP health checks returned `PUBLIC_HTTPS_ROOT_FORCED=307` (expected).

The discrepancy between curl behavior (307) and browser behavior (unexpected) requires systematic investigation before 04I can resume.

04I1 is bounded to:

- capturing the exact browser symptom safely
- capturing curl redirect-chain evidence from SSH
- checking browser-local state (cache / HSTS / service worker / cookies)
- cross-checking DNS resolver behavior
- classifying the failure into one of the documented hypotheses
- identifying whether the issue is browser-local, network/DNS, app/middleware, or Caddy/server

04I1 does **not** perform fixes, account creation, login, persistent-data operations, AI, billing, container, or OAuth flows.

---

## 3. Incident Summary

### What happened

During PRIVATE-BETA-STAGING-EXECUTION-04I Step 3 (Manual Browser Smoke), Keith attempted to navigate to `https://staging.ainow.biz` (Path A).

The expected behavior — HTTPS lock valid, root redirects to `/en`, some UI renders — did **not** occur as expected.

`https://staging.ainow.biz/en` worked correctly.

Smoke stopped at Path A. Paths B, C, D, E, F were not completed.

### Current state

| Task | Status |
|------|--------|
| PRIVATE-BETA-STAGING-EXECUTION-04H | COMPLETE and LOCKED — 2026-08-03 |
| PRIVATE-BETA-STAGING-EXECUTION-04I | ACTIVE — BLOCKED by 04I1 |
| PRIVATE-BETA-STAGING-EXECUTION-04I Step 3 | Partial — stopped at Path A |
| PRIVATE-BETA-STAGING-EXECUTION-04I1 | ACTIVE — Step 1 COMPLETE (Registration — 2026-08-03) |
| PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE (parent) |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## 4. Known-Good Evidence

From 04I Step 3 pre-smoke health check (Mon Aug 3 15:12:07 HKT 2026):

| Check | Value | Verdict |
|-------|-------|---------|
| date | Mon Aug 3 15:12:07 HKT 2026 | RECORDED |
| public table count | 26 | PASS |
| pm2-ubuntu enabled | enabled | PASS |
| pm2-ubuntu active | active | PASS |
| caddy enabled | enabled | PASS |
| caddy active | active | PASS |
| `PUBLIC_HTTPS_ROOT_FORCED` | 307 | PASS — curl forced-resolve |
| `PUBLIC_HTTPS_API_HEALTH_FORCED` | 200 | PASS |
| `PUBLIC_HTTPS_API_DB_HEALTH_FORCED` | 200 | PASS |
| `PUBLIC_HTTPS_API_READY_FORCED` | 200 | PASS |
| `LOCAL_API_HEALTH` | 200 | PASS |
| `LOCAL_API_DB_HEALTH` | 200 | PASS |
| `LOCAL_API_READY` | 200 | PASS |
| `LOCAL_CONTAINER_HEALTH` | 200 | PASS |
| `LOCAL_FRONTEND_ROOT` | 307 | PASS — locale redirect |

Browser: `https://staging.ainow.biz/en` loaded and worked correctly.

---

## 5. Known-Failing Evidence

| Evidence item | Value |
|--------------|-------|
| `https://staging.ainow.biz` root in browser | Did not work as expected |
| Path A verdict | Not PASS |
| Exact symptom | Not yet captured (this runbook defines the capture procedure) |

The exact browser symptom (blank page, cert error, redirect loop, wrong URL, error page) has not yet been captured in sufficient detail. This runbook defines how to capture it safely.

---

## 6. What 04I1 Investigates

04I1 investigates only:

- Why `https://staging.ainow.biz` root does not work as expected in a browser.
- Whether the failure is browser-local (cache / HSTS / service worker / cookies / localStorage).
- Whether the failure is a DNS/resolver discrepancy between curl forced-resolve and the real browser DNS path.
- Whether the failure is in the HTTP→HTTPS→locale redirect chain (Caddy `auto_https` HTTP 308 + Next.js middleware locale redirect HTTP 307).
- Whether the failure is in Caddy route or header behavior for the root path specifically.
- Whether the failure is in the Next.js middleware root redirect behavior at `/`.
- Whether the failure is in client-side hydration or rendering specific to `/` only (not `/en`).
- Whether the failure involves stale cookie/session/localStorage state.

---

## 7. What 04I1 Does Not Investigate

04I1 does **not**:

- Continue or resume 04I browser smoke Paths B, C, D, E, or F.
- Create accounts, log in, register, or create persistent data of any kind.
- Trigger AI execution, billing/payment, container workflow, or Google OAuth flows.
- Test production domains: `app.ainow.biz` or `ainow.biz`.
- Modify source code, migrations, `.env`, Caddy, DNS, PM2, systemd, database, or any runtime state.
- Print secrets, passwords, session cookies, JWTs, tokens, or env values.
- Perform fixes — any fix requires a separate bounded slice.

---

## 8. Preconditions

All of the following must be true before beginning 04I1 investigation:

| # | Precondition | Source |
|---|-------------|--------|
| 1 | PRIVATE-BETA-STAGING-EXECUTION-04H is COMPLETE and LOCKED | 04H Checkpoint — 2026-08-03 |
| 2 | `staging.ainow.biz` externally resolves to `18.136.141.186` | 04H evidence — confirmed via 1.1.1.1 and 8.8.8.8 |
| 3 | Caddy enabled and active on the instance | 04I Step 3 pre-smoke — verified |
| 4 | `pm2-ubuntu` enabled and active on the instance | 04I Step 3 pre-smoke — verified |
| 5 | Public health endpoints still passing | 04I Step 3 pre-smoke — all 200 or expected redirect |
| 6 | Public table count is 26 (pre-investigation baseline) | 04I Step 3 pre-smoke — verified |
| 7 | No accounts, logins, or persistent data have been created | 04I evidence — confirmed |
| 8 | Keith has access to a browser and `staging.ainow.biz` hostname | Operator precondition |
| 9 | Keith has access to AWS Lightsail browser SSH for curl/SSH evidence | Operator precondition |

If any precondition fails, **stop**. Capture a safe evidence note and raise as a separate slice.

---

## 9. Secret Safety Rules

The following are strictly prohibited at all times during 04I1:

| Prohibited action | Reason |
|------------------|--------|
| Printing `.env` values | Exposes production secrets |
| Running `env`, `printenv`, `cat .env` | Exposes all environment variables |
| Running `echo $DATABASE_URL`, `echo $REDIS_URL`, `echo $JWT_SECRET`, etc. | Exposes individual secrets |
| Pasting passwords, session cookies, JWTs, or auth tokens into Cursor chat or AI | Credentials must never enter AI context |
| Pasting reset links received by email | Contains security tokens |
| Printing Caddy TLS private key material | Certificate private key exposure |
| Printing DNS provider credentials | Provider account exposure |
| Pasting AWS access keys or SSH private keys | Credentials must remain on operator's machine |
| Copying secrets to screenshots shared beyond operator | Operational security |
| Opening `/etc/caddy/Caddyfile` directly via Cursor | Not permitted in this runbook — use 04H checkpoint evidence only |

If a secret is accidentally exposed: stop immediately, note the exposure, escalate as a separate security slice, and do not continue investigation.

**Do not run:** `env`, `printenv`, `cat .env`, `echo $DATABASE_URL`, `echo $REDIS_URL`, `cat /etc/caddy/Caddyfile`, or any secret-printing command.

---

## 10. Browser Evidence Capture Instructions

> **Browser testing is done by Keith only — not Cursor.**  
> **Do not submit any forms.**  
> **Do not create accounts or log in.**  
> **Do not enter passwords into any page.**

### URLs to test (safe list only)

```
https://staging.ainow.biz
https://staging.ainow.biz/
https://staging.ainow.biz/en
https://staging.ainow.biz/en/login
https://staging.ainow.biz/en/register
```

**Do not navigate to `app.ainow.biz`, `ainow.biz`, or any production domain.**

### For each URL, record

```
- URL entered:
- final address bar URL:
- HTTPS lock valid:
- browser visible result:
- error text, if any:
- blank page:
- 404/500:
- redirect loop:
- production domain redirect:
```

### Browser comparison steps

Perform each test in the following order and record results separately:

1. **Normal browser window** — navigate to each URL as-is.
2. **Hard refresh** — on the root URL (`https://staging.ainow.biz`), press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) to bypass browser cache.
3. **Private/incognito window** — open a new private window and navigate to `https://staging.ainow.biz`. This bypasses HSTS, service workers, and cached state.
4. **Another browser if available** — if Chrome failed, try Firefox or Edge (or vice versa). This isolates browser-specific caching and HSTS behavior.

Record whether the behavior differs across these four modes. A difference between normal and incognito strongly indicates a browser-local state issue (Hypothesis A or F).

### What to record for the root URL specifically

For `https://staging.ainow.biz` and `https://staging.ainow.biz/`:

- Does the browser show a "Not Secure" warning or certificate error page?
- Does the browser address bar show a URL other than `https://staging.ainow.biz/en` after any redirect?
- Does the browser show "too many redirects" or a redirect loop error?
- Does the browser show a completely blank page with no content?
- Does the browser show a Caddy default error page or a Next.js error page?
- Does the browser show a 404 page?
- Does the browser show a 500 or "Service Unavailable" page?
- Does the browser briefly show content and then crash (hydration error)?
- Does the URL bar redirect to `app.ainow.biz` or `ainow.biz` (wrong domain)?

**Do not paste passwords, cookies, JWTs, session values, tokens, reset links, or screenshots containing secrets.**

---

## 11. SSH Evidence Capture Instructions

> **These commands are for manual execution in the AWS Lightsail browser SSH terminal only.**  
> **Do NOT run these commands in Cursor / PowerShell.**  
> **These commands are evidence-only. They do not modify any state.**

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

echo "DNS_PUBLIC:"
dig +short @1.1.1.1 staging.ainow.biz A || true
dig +short @8.8.8.8 staging.ainow.biz A || true

echo "CURL_REDIRECT_CHAIN_FORCED_ROOT:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,40p'

echo "CURL_REDIRECT_CHAIN_FORCED_ROOT_NO_SLASH:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz | sed -n '1,40p'

echo "CURL_REDIRECT_CHAIN_FOLLOW_FORCED_ROOT:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -L -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,120p'

echo "CURL_EN_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/en | sed -n '1,80p'

echo "CURL_LOGIN_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/en/login | sed -n '1,80p'

echo "CURL_REGISTER_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/en/register | sed -n '1,80p'

echo "PUBLIC_HEALTH_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_ROOT_FORCED=%{http_code}\n" https://staging.ainow.biz/
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_DB_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/db
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_READY_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/ready

echo "LOCAL_HEALTH:"
curl -sS -o /dev/null -w "LOCAL_API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "LOCAL_API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "LOCAL_API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "LOCAL_CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "LOCAL_FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

### Expected evidence interpretation

| Evidence item | Expected | Notes |
|--------------|----------|-------|
| DNS `@1.1.1.1` | `18.136.141.186` | Must match static IP from 04H |
| DNS `@8.8.8.8` | `18.136.141.186` | Must match static IP from 04H |
| Root redirect (with slash) | First response line: `HTTP/2 307` or `HTTP/1.1 307` | Next.js middleware locale redirect |
| `Location` header on root | `/en` or `https://staging.ainow.biz/en` | Redirect target from `frontend/middleware.ts` |
| Root redirect (no slash) | 307 or 308 | Caddy HTTPS redirect or middleware |
| Follow redirects on root | Final response 200 after chain | Chain: 308 (Caddy HTTP→HTTPS) → 307 (middleware `/`→`/en`) → 200 |
| `/en` response | 200 | App renders |
| `/en/login` response | 200 | Login page renders |
| `/en/register` response | 200 | Register page renders |
| `PUBLIC_HTTPS_ROOT_FORCED` | 307 | Same as 04I pre-smoke |
| `PUBLIC_HTTPS_API_HEALTH_FORCED` | 200 | Must remain passing |
| `PUBLIC_HTTPS_API_DB_HEALTH_FORCED` | 200 | Must remain passing |
| `PUBLIC_HTTPS_API_READY_FORCED` | 200 | Must remain passing |
| `LOCAL_API_HEALTH` | 200 | Must remain passing |
| `LOCAL_API_DB_HEALTH` | 200 | Must remain passing |
| `LOCAL_API_READY` | 200 | Must remain passing |
| `LOCAL_CONTAINER_HEALTH` | 200 | Must remain passing |
| `LOCAL_FRONTEND_ROOT` | 307 | Local frontend locale redirect |
| git status | no output | Must remain clean |
| public table count | 26 | Must remain unchanged |
| pm2-ubuntu | enabled / active | Must remain healthy |
| caddy | enabled / active | Must remain healthy |

If public health fails or `LOCAL_FRONTEND_ROOT` changes significantly, **stop** and raise a separate bounded slice. Do not proceed with browser investigation until health is restored.

---

## 12. Hypothesis A — Browser Cache / Stale Redirect / HSTS / Service Worker

**Summary:** The browser has cached a prior bad redirect, a stale HSTS policy, or a service worker intercept that breaks the root URL specifically.

### Why plausible

- Browsers cache 301/308 redirects permanently. If `https://staging.ainow.biz` previously redirected to a wrong URL (e.g., an old staging hostname, a now-removed route, or a port-specific URL) during any prior 04H smoke, the browser may have cached that redirect.
- Caddy `auto_https` emits a 308 for HTTP → HTTPS. If the browser previously resolved this to a bad target and cached it, the cache may persist across normal navigations.
- HSTS preload lists or `Strict-Transport-Security` headers with `max-age` may cause the browser to enforce HTTPS in a way that conflicts with a stale cached state.
- A Next.js service worker (if registered) could intercept the root request and return a stale cached response.

### Evidence needed

- Does the behavior change in a private/incognito window? (bypasses browser cache, HSTS, and service workers)
- Does a hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) change behavior?
- Does another browser show a different result?
- From browser DevTools (Network tab): does the root response show `(from disk cache)` or `(from service worker)`?
- Is a service worker registered for `staging.ainow.biz` in browser DevTools > Application > Service Workers?

### PASS condition

Incognito window and/or another browser correctly loads `https://staging.ainow.biz` → redirects to `/en` without issue.

### FAIL condition

Incognito window fails in the same way as the normal window. Browser cache is ruled out as the primary cause.

### BLOCKED condition

Keith cannot reproduce the failure in any browser mode. The failure may have been transient.

### Next action if confirmed

Hypothesis A confirmed: Clear browser cache and HSTS cache for `staging.ainow.biz` in browser settings. Unregister any service workers in DevTools. No server-side fix required. Proceed to 04I Path A after clearing browser state. Record as browser-local cache issue.

---

## 13. Hypothesis B — Public DNS / Browser Resolver Discrepancy

**Summary:** The browser resolves `staging.ainow.biz` to a different IP or receives a different DNS response than the `curl --resolve` forced-IP check, causing it to hit the wrong server or receive a wrong response.

### Why plausible

- `curl --resolve` checks in 04I pre-smoke forced the IP to `18.136.141.186` — these passed. But the browser uses the system DNS resolver (or browser DNS-over-HTTPS), which may return a different IP if propagation is incomplete, if a CDN is involved, or if the DNS record changed.
- The browser may resolve via a local router or ISP DNS that has a stale cached record from before the 04H DNS A record was set.
- `dig @1.1.1.1` and `dig @8.8.8.8` confirmed `18.136.141.186` in 04H, but the browser's resolver (e.g., Google DoH or Cloudflare DoH or OS resolver) may still have a stale or incorrect entry.

### Evidence needed

- SSH evidence: `dig +short @1.1.1.1 staging.ainow.biz A` and `dig +short @8.8.8.8 staging.ainow.biz A` — do these still return `18.136.141.186`?
- Browser DevTools (Network tab): does the root request resolve to `18.136.141.186`? (IP visible in Request Headers or Connection info)
- Does the failure occur from a different network (e.g., mobile data vs. home Wi-Fi)?
- From SSH: `curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/` — does this still return 307?

### PASS condition

DNS resolves correctly to `18.136.141.186` via `1.1.1.1`, `8.8.8.8`, and the browser. Hypothesis B is ruled out.

### FAIL condition

DNS resolves to a different IP in the browser path, or `dig` returns no result or an unexpected IP from the SSH server.

### BLOCKED condition

Browser DNS resolution cannot be confirmed without DevTools access. Keith may need to check DevTools Network tab Connection info for the exact IP used.

### Next action if confirmed

Hypothesis B confirmed: DNS propagation or resolver staleness issue. Check DNS record via DNS provider panel (no changes — read only). If the record is correct but resolver is stale, wait for TTL expiry or flush OS DNS cache. No source or Caddy change required. Record as DNS/resolver issue.

---

## 14. Hypothesis C — HTTP to HTTPS to Locale Redirect Chain Issue

**Summary:** The redirect chain from HTTP → HTTPS (Caddy `auto_https` 308) → locale redirect (`/` → `/en`, Next.js middleware 307) produces a broken or looping chain in a browser that curl handles differently.

### Why plausible

From 04H evidence:
- `PUBLIC_HTTP_ROOT_FORCED=308` — Caddy emits a permanent 308 redirect from HTTP to HTTPS.
- `PUBLIC_HTTPS_ROOT_FORCED=307` — Next.js middleware emits a 307 temporary redirect from `/` to `/en`.

In a browser that navigates directly to `https://staging.ainow.biz`, the Caddy 308 is not involved (already HTTPS). The middleware 307 should redirect to `/en`. However:

- If Caddy emits a `Location: http://staging.ainow.biz/en` (HTTP, not HTTPS) in the redirect, the browser will loop back to HTTPS redirect.
- If the `Location` header is relative (`/en`) it should be fine. If it is absolute with the wrong scheme or hostname, it may loop.
- If the Next.js middleware emits a redirect to a full URL with the wrong scheme or port, the browser may follow it incorrectly.
- Some browser implementations treat a 307 or 308 with a `Set-Cookie` in ways that differ from curl.

### Evidence needed

- SSH curl: `curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/` — what is the `Location:` header value? Is it `/en`, `https://staging.ainow.biz/en`, or something unexpected?
- SSH curl with follow: `curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -L -D - -o /dev/null https://staging.ainow.biz/` — how many hops? Does it terminate cleanly?
- Browser DevTools Network tab: how many redirect hops appear for the root request?

### PASS condition

`Location:` header is `/en` or `https://staging.ainow.biz/en`. curl follow chain terminates cleanly in 2–3 hops. Hypothesis C ruled out.

### FAIL condition

`Location:` header is unexpected (wrong scheme, wrong hostname, wrong path, empty). curl follow produces more than 3 hops or fails to terminate.

### BLOCKED condition

SSH/curl evidence is unavailable or inconclusive.

### Next action if confirmed

Hypothesis C confirmed: redirect chain issue in Caddy or Next.js middleware redirect target. Stop. Do not modify Caddy or source code in this investigation slice. Register a separate bounded fix slice: either Caddy header correction (requires Keith approval) or Next.js middleware fix (requires implementation slice). Record as redirect chain issue.

---

## 15. Hypothesis D — Caddy Route or Header Behavior Issue

**Summary:** Caddy is routing the root path (`/`) to the frontend in a way that differs from the expected behavior, or Caddy is emitting unexpected headers for the root path specifically.

### Why plausible

From 04H checkpoint, the Caddyfile routes:
- `/api/*` → `reverse_proxy 127.0.0.1:4000`
- all other → `reverse_proxy 127.0.0.1:3002`

Caddy's `auto_https` is enabled. The Caddyfile had a formatting warning (non-blocking) noted in 04H.

Possible issues:
- Caddy may be adding an `X-Forwarded-Proto` or `X-Forwarded-Host` header that the Next.js app treats incorrectly, causing the middleware to construct a wrong redirect URL.
- Caddy may be performing path normalization (trailing-slash canonicalization) that changes how the root path is presented to the Next.js app.
- Caddy may be emitting a `Content-Security-Policy` or `X-Frame-Options` header that causes the browser to block the redirect.
- An unexpected Caddy default-handler response for the root path could occur if Caddy's route matching for `all other` does not match `/` correctly.

### Evidence needed

- SSH curl: full headers from `curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/` — examine ALL response headers, not just status code.
- Caddy route evidence from 04H checkpoint docs only (no live Caddyfile inspection in this runbook step).
- Does `curl` to `/en` return 200 with normal headers while `/` returns unexpected headers?

### PASS condition

Caddy headers are normal. No unexpected `Location`, `Content-Security-Policy`, or error-triggering headers on the root response. Route matching appears correct. Hypothesis D not confirmed.

### FAIL condition

Caddy emits unexpected headers on the root path that are not present on `/en`. Route mismatch or unexpected handler fires for `/`.

### BLOCKED condition

Full curl response headers are unavailable. Caddyfile evidence from 04H is insufficient to diagnose.

### Next action if confirmed

Hypothesis D confirmed: Caddy header or route issue. Stop. Do not modify Caddy in this investigation slice. Register a separate Caddy fix slice requiring explicit Keith approval before any Caddy changes. Record as Caddy route/header issue.

---

## 16. Hypothesis E — Next.js Middleware Root Redirect Behavior Issue

**Summary:** The Next.js middleware at `frontend/middleware.ts` correctly redirects `/` → `/en` in curl/server-side checks but behaves differently when a real browser client navigates to `/`, possibly due to client context, request headers, or middleware execution environment.

### Why plausible

Source-grounded context from `frontend/middleware.ts`:

```typescript
// frontend/middleware.ts (lines 33–37)
if (pathname === '/') {
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}`;
  return NextResponse.redirect(url);
}
```

`DEFAULT_LOCALE = 'en'` (line 5).

The middleware uses `request.nextUrl.clone()` and sets `url.pathname = '/en'`, then returns `NextResponse.redirect(url)`.

Possible issues:
- `request.nextUrl.clone()` preserves the full URL including scheme and hostname. If Next.js is receiving a request with the wrong scheme (`http` instead of `https`) from behind Caddy reverse proxy, the clone may produce `http://staging.ainow.biz/en`, which causes the browser to hit the HTTP port and get another 308 from Caddy, potentially looping.
- The `matcher` config (`/((?!api|_next/static|_next/image|favicon.ico).*)`) should match `/`. If Next.js is not running middleware for the root for any reason, no redirect occurs and the root page component is served directly.
- The `[locale]/page.tsx` component (`PublicLandingSlice`) would render at `/` without a locale if middleware skips it, causing a potential rendering or routing issue.

### Evidence needed

- SSH curl with full headers: what is the exact `Location:` value on the 307 response for `https://staging.ainow.biz/`? Is it `https://staging.ainow.biz/en` or `http://staging.ainow.biz/en`?
- SSH curl follow: does the chain resolve correctly?
- Source: `frontend/middleware.ts` — review whether `NextResponse.redirect(url)` uses the correct scheme from behind Caddy reverse proxy. (Read-only — no edits in this runbook.)

### PASS condition

`Location:` header on root 307 is `https://staging.ainow.biz/en` (correct scheme). Middleware is operating correctly. Hypothesis E ruled out by curl evidence.

### FAIL condition

`Location:` header on root 307 is `http://staging.ainow.biz/en` (wrong scheme — likely a reverse proxy scheme forwarding issue). This would cause the browser to follow the redirect to HTTP, triggering another 308 from Caddy, creating a redirect chain visible in the browser as "too many redirects" or an unexpected intermediate URL.

### BLOCKED condition

SSH/curl evidence is inconclusive or unavailable. `Location:` header value is ambiguous.

### Next action if confirmed

Hypothesis E confirmed: `NextResponse.redirect(url)` is constructing a redirect to `http://` instead of `https://` because Caddy is not forwarding the `X-Forwarded-Proto: https` header to the Next.js app (or the app is not reading it). This is a known Next.js behind reverse-proxy issue. Stop. Do not modify source code in this investigation slice. Register a separate bounded implementation slice: either add `X-Forwarded-Proto` forwarding in Caddy (Caddy fix slice, requires Keith approval) or update `middleware.ts` to force HTTPS in the redirect URL (implementation slice). Record as middleware scheme-forwarding issue.

---

## 17. Hypothesis F — Cookie / Session / localStorage State Issue

**Summary:** A stale or conflicting cookie, session token, or localStorage entry on the browser for `staging.ainow.biz` causes the root page to redirect or render incorrectly.

### Why plausible

From `frontend/app/[locale]/login/page.tsx` (lines 70–90), the login page probes `/api/auth/me` on mount and redirects to `/${locale}/app` if the user is already authenticated. If a stale auth cookie exists from a prior test or a prior session, navigating to `/` → `/en` (the `[locale]/page.tsx` home page) may immediately trigger an authenticated redirect to `/en/app`, which might not yet be fully functional on staging, causing an unexpected blank or error state.

Similarly, a corrupt or stale CSRF token, session cookie, or localStorage key from a prior browser test of a related domain (`app.ainow.biz`) could affect the staging subdomain behavior if cookies are set with `.ainow.biz` domain scope.

### Evidence needed

- Does the behavior differ in a private/incognito window? (bypasses all cookies and localStorage)
- In normal browser: are there any existing cookies for `staging.ainow.biz` or `.ainow.biz` in DevTools > Application > Cookies?
- After clearing cookies for `staging.ainow.biz` in browser settings, does the root load correctly?
- After clearing localStorage for `staging.ainow.biz`, does the root load correctly?

### PASS condition

Incognito window loads `https://staging.ainow.biz` correctly. Cookie/session state is identified as the issue. No server-side fix required.

### FAIL condition

Incognito window fails in the same way. Cookie/session state is ruled out.

### BLOCKED condition

Cannot determine whether cookies from a prior session exist without browser DevTools inspection by Keith.

### Next action if confirmed

Hypothesis F confirmed: Clear cookies and localStorage for `staging.ainow.biz` in browser DevTools. No server-side fix required. Proceed to 04I Path A after clearing browser state. Record as browser cookie/session state issue.

---

## 18. Hypothesis G — Client-Side Hydration / Render Issue at `/` Only

**Summary:** The server-side redirect from `/` → `/en` succeeds, but on `/en`, the `[locale]/page.tsx` page component (`PublicLandingSlice`) encounters a hydration mismatch or client-side rendering failure that is visible only at the `staging.ainow.biz` domain (e.g., because the app is loading assets from an unexpected base URL, a CDN, or a wrong environment variable).

### Why plausible

- `frontend/app/[locale]/page.tsx` renders `<PublicLandingSlice locale={locale} />`. If this component has a hydration mismatch (server-rendered HTML differs from client-rendered HTML), Next.js will emit a hydration error, which may appear as a blank page or a React error overlay.
- If the app's client-side bundle loads from a wrong `NEXT_PUBLIC_*` base URL (e.g., pointing to `localhost` or a production URL instead of `staging.ainow.biz`), assets may fail to load.
- The issue occurs at `/` (root) but not at `/en/login` or `/en/register`. This could indicate the `PublicLandingSlice` component renders correctly on the server but has a browser-only issue (a dynamic import, a window-dependent feature, or a useEffect that fails silently).

### Evidence needed

- Does the browser show a React error overlay or a Next.js crash page when navigating from `/` to `/en`?
- Does navigating directly to `https://staging.ainow.biz/en` (already known to work) also show the same issue as arriving at `/en` via the `/` redirect?
- In browser DevTools Console: are there any JavaScript errors or hydration mismatch warnings?
- Does `https://staging.ainow.biz/en/login` load correctly without any console errors?

### PASS condition

Direct navigation to `/en` works correctly. Redirected navigation from `/` to `/en` also works correctly. No console errors. Hypothesis G ruled out.

### FAIL condition

Arriving at `/en` via the `/` redirect produces a different result than navigating directly to `/en`. Or `/en` shows console hydration errors. Or `PublicLandingSlice` renders on the server but crashes on the client.

### BLOCKED condition

Browser DevTools console output is unavailable or insufficient.

### Next action if confirmed

Hypothesis G confirmed: client-side hydration or asset loading issue at `[locale]/page.tsx`. Stop. Do not modify source code in this investigation slice. Register a separate bounded implementation slice to investigate the `PublicLandingSlice` component for hydration issues. Record as client-side render issue.

---

## 19. Source-Grounded Files to Review

The following files should be reviewed read-only during investigation. Do not edit any of these files.

### Frontend source files

| File | What to look for |
|------|-----------------|
| `frontend/middleware.ts` | Redirect logic for `/` → `/en`. Specifically: does `request.nextUrl.clone()` preserve the scheme correctly when behind Caddy reverse proxy? Does the `matcher` cover `/`? |
| `frontend/app/[locale]/page.tsx` | What does `PublicLandingSlice` render? Does it have any browser-only behavior that could fail on initial load? |
| `frontend/app/[locale]/login/page.tsx` | Session probe (`/api/auth/me`) on mount — could a stale session cause unexpected redirect? |
| `frontend/app/[locale]/register/page.tsx` | Similar session probe patterns? |

### Source-grounded Caddy route evidence (docs only — no live Caddyfile access in this runbook step)

| Doc | What to look for |
|-----|-----------------|
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-CHECKPOINT.md` | Sections 9 (Caddy/TLS approval), 10 (public HTTPS health-only smoke). Route: `/api/*` → `127.0.0.1:4000`; all other → `127.0.0.1:3002`. `auto_https` enabled. Caddyfile formatting warning noted. |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-PUBLIC-ROUTING-DNS-TLS-EVIDENCE-REVIEW.md` | Caddy validation verdict PASS. `auto_https` behavior: HTTP 308 → HTTPS. Frontend root returns 307 via forced-resolve curl. |

> **Do not inspect `/etc/caddy/Caddyfile` live in this runbook step.** Use 04H checkpoint evidence only. Live Caddyfile inspection requires a separate approved step.

---

## 20. Safe Manual Investigation Command Set

These commands are safe, evidence-only, and do not modify any state. Run from the AWS Lightsail browser SSH terminal only.

```bash
# Identity and baseline
date
uptime
whoami
hostname
cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Service state
systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
systemctl is-enabled caddy
systemctl is-active caddy

# DNS (public resolvers — evidence only)
echo "DNS_PUBLIC:"
dig +short @1.1.1.1 staging.ainow.biz A || true
dig +short @8.8.8.8 staging.ainow.biz A || true

# Full redirect chain — root with slash
echo "CURL_REDIRECT_CHAIN_FORCED_ROOT:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,40p'

# Full redirect chain — root without slash
echo "CURL_REDIRECT_CHAIN_FORCED_ROOT_NO_SLASH:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz | sed -n '1,40p'

# Follow all redirects from root
echo "CURL_REDIRECT_CHAIN_FOLLOW_FORCED_ROOT:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -L -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,120p'

# /en, /en/login, /en/register
echo "CURL_EN_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/en | sed -n '1,80p'

echo "CURL_LOGIN_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/en/login | sed -n '1,80p'

echo "CURL_REGISTER_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/en/register | sed -n '1,80p'

# Public health check (status codes only)
echo "PUBLIC_HEALTH_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_ROOT_FORCED=%{http_code}\n" https://staging.ainow.biz/
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_DB_HEALTH_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/db
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "PUBLIC_HTTPS_API_READY_FORCED=%{http_code}\n" https://staging.ainow.biz/api/health/ready

# Local health check
echo "LOCAL_HEALTH:"
curl -sS -o /dev/null -w "LOCAL_API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "LOCAL_API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "LOCAL_API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "LOCAL_CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "LOCAL_FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

---

## 21. Browser-Only Checks

> **These checks are performed by Keith only — not Cursor.**

The following browser-only checks cannot be replicated by SSH/curl and are critical to classifying the failure:

| Check | How to perform | What to record |
|-------|---------------|----------------|
| Does incognito window work? | Open private/incognito window, navigate to `https://staging.ainow.biz` | Yes / No / Partial |
| Does hard refresh work? | `Ctrl+Shift+R` on the failing page | Yes / No |
| Does a second browser work? | Try Firefox if Chrome fails (or vice versa) | Yes / No |
| Are there existing cookies? | DevTools > Application > Cookies > `staging.ainow.biz` | None / List domain/name only — do not paste values |
| Is a service worker registered? | DevTools > Application > Service Workers > `staging.ainow.biz` | Yes / No |
| What are the console errors? | DevTools > Console > any errors after navigating to `https://staging.ainow.biz` | Error message text only — no secrets |
| What are the Network tab redirects? | DevTools > Network > navigate to root — how many redirect hops? What is the final URL? | Hop count, final URL, status codes |
| What is the `Location:` header in the browser? | DevTools > Network > first root request > Response Headers > `Location:` | Value of Location header |
| Is the HTTPS lock valid on the final URL? | Browser address bar lock icon | Yes / No / Certificate error |

**Do not paste cookie values, token values, or session IDs. Record only domain/name of cookies, not values.**

---

## 22. Pass / Fail / Blocked Criteria

### 04I1 Investigation PASS if ALL of the following are true:

- [ ] Exact browser symptom is captured safely (what the browser shows for `https://staging.ainow.biz`).
- [ ] Curl redirect chain for root (`/`) is captured with `Location:` header visible.
- [ ] `/en`, `/en/login`, and `/en/register` curl behavior is captured.
- [ ] Public health endpoints remain passing (`PUBLIC_HTTPS_ROOT_FORCED=307`, API endpoints 200).
- [ ] Local health endpoints remain passing.
- [ ] Root issue is classified into one of:
  - browser-local cache / HSTS / service worker issue (Hypothesis A)
  - DNS / resolver issue (Hypothesis B)
  - redirect chain / `Location:` header issue (Hypothesis C)
  - Caddy route / header issue (Hypothesis D)
  - Next.js middleware scheme / URL construction issue (Hypothesis E)
  - browser cookie / session / localStorage issue (Hypothesis F)
  - client-side hydration / render issue (Hypothesis G)
  - unknown — but evidence is sufficient to scope a dedicated fix slice
- [ ] No secrets printed.
- [ ] No accounts created, no login performed, no persistent data created.
- [ ] No source / migration / env / runtime / server changes performed.
- [ ] No AI / billing / container / OAuth actions occurred.
- [ ] No production domain tested.

### 04I1 Investigation FAIL if ANY of the following are true:

- [ ] Required evidence cannot be captured safely.
- [ ] Secrets are printed or pasted.
- [ ] Unapproved runtime, source, or server changes occur.
- [ ] AI / billing / container / OAuth / account / login actions occur.
- [ ] Public health endpoints fail during investigation (separate stop condition — raise a recovery slice).

### 04I1 Investigation BLOCKED if:

- [ ] Browser evidence remains too vague to classify.
- [ ] Keith cannot reproduce the failure in any browser mode.
- [ ] Server/curl evidence contradicts browser evidence and no safe classification is possible without further approved steps.
- [ ] Any required investigation step would require secret exposure or unapproved change.

---

## 23. Stop Conditions

Immediately stop investigation and capture safe evidence if any of the following occur:

**Secret / security:**
- Any secret would need to be printed, shared, or pasted.
- Any password, session cookie, JWT, token, or reset link would need to be shared.
- Any `.env` file, Caddy private key, AWS key, or SSH private key would need to be opened.

**Account / data:**
- Any account creation, login, or persistent data creation would be required to proceed.

**Execution gates:**
- Any AI execution, billing/payment flow, container workflow, or Google OAuth flow appears.

**Domain scope:**
- Production domain (`app.ainow.biz`, `ainow.biz`) appears in the investigation path.

**Health degradation:**
- Public health endpoints fail unexpectedly (`PUBLIC_HTTPS_API_HEALTH_FORCED` ≠ 200).
- Local health endpoints fail unexpectedly.
- PM2 or Caddy becomes inactive.
- Public table count changes unexpectedly (must remain 26).
- Git status becomes non-clean.

**Fix scope:**
- Any source code, migration, `.env`, Caddy, DNS, PM2, systemd, or database change appears necessary. Stop. Do not make changes. Register a fix slice.
- Investigation scope appears to require more than evidence capture and classification.

**Browser information exposure:**
- Browser result includes private information, tokens, session data, or API keys visible on screen.

When a stop condition is triggered:

1. Stop immediately.
2. Do not make any changes to code, env, Caddy, DNS, PM2, systemd, database, or migrations.
3. Capture safe evidence using the template in Section 26.
4. Note the exact stop condition in the evidence.
5. Return evidence to Cursor chat as plain text (no secrets).
6. Raise a separate bounded recovery or fix slice.

---

## 24. Approval Gates Before Any Fix

> ---
> **STOP. Do not change Caddy, DNS, PM2, systemd, database, or runtime state unless Keith explicitly approves a bounded runtime recovery command set.**
> ---

> ---
> **STOP. Do not edit source code unless a separate implementation fix slice is registered and approved.**
> ---

> ---
> **STOP. Do not resume 04I browser smoke until 04I1 is evidence-reviewed and either locked as no-fix-needed or followed by a completed recovery/fix slice.**
> ---

Any change that appears necessary as a result of 04I1 investigation requires:

1. A separate bounded fix or recovery slice registered in `TASKS.md` and `TASKS_BACKLOG_FULL.md`.
2. Explicit Keith approval before any Caddy configuration, DNS, PM2, systemd, or database change.
3. A separate implementation slice registration before any source code change.
4. 04I1 investigation must be marked complete with evidence before any fix slice begins.

---

## 25. Recovery Boundary

04I1 does **not** include fixes, workarounds, or recovery actions.

If investigation evidence points to a fixable issue:

- Stop at the classification.
- Do not modify code, env, Caddy, DNS, PM2, systemd, database, or migrations.
- Capture safe evidence and classification in the template.
- Return evidence to Cursor chat as plain text.

A classified issue from 04I1 should trigger one of:

| Issue class | Recovery path |
|-------------|--------------|
| Browser-local cache / HSTS / service worker (Hypothesis A) | Browser-only fix by Keith (clear cache, HSTS, unregister SW) — no server change required |
| Browser cookie / session / localStorage (Hypothesis F) | Browser-only fix by Keith (clear cookies/localStorage) — no server change required |
| DNS / resolver issue (Hypothesis B) | DNS record verification via provider panel (read-only first); if TTL stale, wait for propagation; if record wrong, bounded DNS fix slice |
| Redirect chain / Location header issue (Hypothesis C or E) | Separate bounded fix slice: either Caddy reverse-proxy header forwarding fix (requires Keith approval) or Next.js middleware fix (implementation slice) |
| Caddy route / header issue (Hypothesis D) | Separate bounded Caddy fix slice — requires explicit Keith approval |
| Hydration / render issue (Hypothesis G) | Separate bounded implementation slice for `PublicLandingSlice` investigation and fix |
| Unknown — insufficient evidence | Separate bounded follow-up investigation slice |

04I1 stops cleanly on classification. Fixes are separate governed slices.

---

## 26. Safe Evidence Template

Copy this template and fill it in after completing 04I1 investigation. Return to Cursor chat as plain text — no secrets, passwords, session cookies, JWTs, or `.env` values.

```text
04I1 Public Root / Locale Redirect Investigation Evidence

Current task state:
- 04I status:
- 04I1 status:
- parent 04 status:
- deployment readiness status:

Known-good from 04I Step 3:
- date: Mon Aug 3 15:12:07 HKT 2026
- public table count: 26
- pm2-ubuntu enabled: enabled
- pm2-ubuntu active: active
- caddy enabled: enabled
- caddy active: active
- PUBLIC_HTTPS_ROOT_FORCED: 307
- PUBLIC_HTTPS_API_HEALTH_FORCED: 200
- PUBLIC_HTTPS_API_DB_HEALTH_FORCED: 200
- PUBLIC_HTTPS_API_READY_FORCED: 200
- LOCAL_API_HEALTH: 200
- LOCAL_API_DB_HEALTH: 200
- LOCAL_API_READY: 200
- LOCAL_CONTAINER_HEALTH: 200
- LOCAL_FRONTEND_ROOT: 307

Browser root symptom:
- normal browser URL entered:
- normal browser final URL:
- normal browser HTTPS lock/cert:
- normal browser visible result:
- normal browser error text:
- hard refresh result:
- private/incognito result:
- second browser result:
- /en result:
- /en/login result:
- /en/register result:

SSH/curl evidence:
- DNS @1.1.1.1:
- DNS @8.8.8.8:
- forced root no slash redirect headers:
- forced root slash redirect headers:
- forced root follow redirect headers:
- forced /en headers:
- forced /en/login headers:
- forced /en/register headers:
- public health:
- local health:
- git status:
- public table count after investigation:

Classification:
- likely category:
- supporting evidence:
- contradicted hypotheses:
- needs fix:
- recommended next slice:

Safety/non-goals:
- no secrets printed:
- no accounts created:
- no login performed:
- no persistent data created:
- no AI execution:
- no billing/payment execution:
- no container workflow:
- no Google OAuth:
- no production domain tested:
- no source/migration/env changes:
- no runtime/server changes:
```

---

## 27. Expected Final State

After Keith completes manual investigation and returns evidence:

| State | Expected |
|-------|----------|
| Exact browser symptom for `https://staging.ainow.biz` | Known |
| Curl redirect chain and `Location:` header for root | Captured |
| Browser vs. curl discrepancy | Classified or marked unknown with sufficient evidence |
| Hypothesis classification | One of A–G identified, or "unknown — needs further slice" |
| Fixes performed | None |
| Accounts created | None |
| Login performed | None |
| Persistent data created | None |
| AI execution | Did not occur |
| Billing/payment execution | Did not occur |
| Container workflow | Did not occur |
| Google OAuth | Did not occur |
| Secrets | Not printed |
| Source/migration/env changes | Did not occur |
| Runtime/server changes | Did not occur |
| Public health | Passing — unchanged from 04I pre-smoke |
| Public table count | 26 — unchanged |
| PM2 and Caddy | Enabled and active |
| Git status | Clean |
| 04I | Remains BLOCKED until 04I1 is reviewed and resolved |
| 04I1 | ACTIVE — evidence returned for Step 3 (Evidence Review) |
| Parent 04 | ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## 28. Exact Next Action

After Keith completes investigation and captures safe evidence:

```text
Return safe evidence to Cursor chat as plain text (no secrets, passwords, session cookies, JWTs, .env values).

The next step is Step 3 — Evidence Review (PRIVATE-BETA-STAGING-EXECUTION-04I1).

After evidence review and classification verdict:
- If no server/source fix is needed (browser-local issue): 04I1 is resolved; proceed to resume 04I browser smoke from Path A.
- If a server/Caddy fix is needed: register a separate bounded Caddy fix slice (requires explicit Keith approval before execution).
- If a source fix is needed: register a separate bounded implementation slice before execution.
- If classification is unknown: register a follow-up investigation slice before resuming 04I.

After 04I1 is resolved, resume 04I from Path A (root browser smoke) and continue to Paths B, C.
After 04I Paths A, B, C pass, an explicit approval gate is required before Paths D, E, F.
After 04I is complete, consolidate as 04I Checkpoint.
Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.
PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.
```

**Keep parent PRIVATE-BETA-STAGING-EXECUTION-04 ACTIVE.**  
**Keep PRIVATE-BETA-STAGING-EXECUTION-04I ACTIVE — BLOCKED by 04I1.**  
**Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.**  
**Do not enable AI / billing / container / OAuth execution.**  
**Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.**  
**Do not cut over production domain (`app.ainow.biz` / `ainow.biz`).**

---

**End of runbook.**

**Runbook created:** 2026-08-03  
**Step 2 status:** Investigation Runbook COMPLETE.  
**No SSH or AWS CLI/actions performed by Cursor.**  
**No browser opened by Cursor.**  
**No accounts created.**  
**No env values printed.**  
**No subagents used.**  
**No source or migration files changed.**  
**No git commit or push.**
