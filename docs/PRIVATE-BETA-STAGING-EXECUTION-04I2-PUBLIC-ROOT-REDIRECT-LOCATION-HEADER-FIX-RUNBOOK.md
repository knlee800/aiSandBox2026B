# PRIVATE-BETA-STAGING-EXECUTION-04I2 — Public Root Redirect Location Header Fix Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I2
**Title:** Public Root Redirect Location Header Fix
**Step:** 2 — Fix Runbook
**Runbook date:** 2026-08-03
**Nature:** Runbook creation only — no SSH — no AWS CLI/actions — no browser opened by Cursor — no accounts created — no login/register executed — no AI execution — no billing/payment execution — no container workflow execution — no Google OAuth enablement — no DNS/TLS/Caddy changes — no reboot — no PM2/systemd commands — no `.env` opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped/restarted — no migrations — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no TASKS/TASKS_BACKLOG_FULL/roadmap changes — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I2 |
| Title | Public Root Redirect Location Header Fix |
| Step | 2 — Fix Runbook |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Grandparent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Blocked smoke task | PRIVATE-BETA-STAGING-EXECUTION-04I — Browser / User-Facing Smoke Baseline |
| Investigation task | PRIVATE-BETA-STAGING-EXECUTION-04I1 — Public Root / Locale Redirect Browser Smoke Failure Investigation |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL — blocks 04I / 04 / DEPLOYMENT-READINESS |
| Nature | REAL STAGING FIX — runbook creation only in this step |
| Risk | MEDIUM — fix involves either a runtime Caddy change (requires explicit Keith approval) or a source-code implementation slice (requires separate implementation prompt) |
| Step 1 Status | COMPLETE — Registration — 2026-08-03 |
| Step 2 Status | COMPLETE — this runbook |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I2-PUBLIC-ROOT-REDIRECT-LOCATION-HEADER-FIX-RUNBOOK.md` — this file |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I2-CHECKPOINT.md` |
| Operator | Keith |
| Execution venue (operator) | AWS Lightsail browser SSH (if Option A selected) or local development + VPS deployment (if Option B selected) — not Cursor |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Static IP | `aisandbox-staging-ip` — public IP `18.136.141.186` |
| Public staging URL | `https://staging.ainow.biz` |
| Next.js version | `^15.1.3` (source: `frontend/package.json`) |
| Frontend port | `3002` (source: `frontend/package.json` `dev` script) |
| Existing Caddyfile backup (04H) | `/etc/caddy/Caddyfile.backup-04H-20260803-133529` |

---

## 2. Purpose

04I2 corrects the public root redirect `Location` header so that `https://staging.ainow.biz` correctly redirects to `/en` or `https://staging.ainow.biz/en` rather than `https://localhost:3002/en`.

This fix is required before PRIVATE-BETA-STAGING-EXECUTION-04I browser smoke can resume at Path A.

04I2 is bounded to:

* Identifying and documenting the smallest safe fix path between Option A (Caddy) and Option B (Next.js middleware source code).
* Defining the implementation plan, rollback plan, and validation command set for the selected option.
* Defining approval gates that must be satisfied before any fix is executed.
* Not performing any SSH, source-code edit, runtime change, or live execution in this runbook step.

04I2 does **not** resume 04I browser smoke. Smoke resumes only after 04I2 validation has passed and evidence has been reviewed.

---

## 3. Failure Summary

During PRIVATE-BETA-STAGING-EXECUTION-04I Step 3 (Manual Browser Smoke), the root URL `https://staging.ainow.biz` failed to load correctly in a browser.

Investigation in 04I1 captured and classified the failure:

**Root cause:** The Next.js middleware at `frontend/middleware.ts` (lines 33–37) uses `request.nextUrl.clone()` to construct the root redirect URL. Behind the Caddy reverse proxy (which routes all non-API traffic from port 443 to `127.0.0.1:3002`), the Next.js process receives the request with host `localhost:3002` rather than `staging.ainow.biz` — because the Caddy `reverse_proxy` directive does not include explicit `header_up Host` or `X-Forwarded-Host` forwarding. The cloned URL inherits the internal upstream host, producing `Location: https://localhost:3002/en` instead of `Location: https://staging.ainow.biz/en` (or relative `/en`).

**Observed failure evidence:**
```
CURL_REDIRECT_CHAIN_FORCED_ROOT:    HTTP/2 307 — Location: https://localhost:3002/en — via: 1.1 Caddy
CURL_REDIRECT_CHAIN_FORCED_ROOT_NO_SLASH: HTTP/2 307 — Location: https://localhost:3002/en — via: 1.1 Caddy
CURL_REDIRECT_CHAIN_FOLLOW_FORCED_ROOT:  HTTP/2 307 — Location: https://localhost:3002/en — then
  curl: (35) OpenSSL/3.0.13: error:0A00010B:SSL routines::wrong version number
Browser effect: follows redirect to https://localhost:3002/en — localhost:3002 is unreachable from user's machine — connection fails
```

**04I1 verdict:** `INVESTIGATION PASS — ROOT BEHAVIOR FAILS`

**Classification:** Hypothesis D + E (interrelated) — Caddy reverse proxy not forwarding public Host header; Next.js `request.nextUrl.clone()` inherits internal upstream host, constructing wrong Location.

---

## 4. Known-Good State

Confirmed from 04I1 evidence review (Mon Aug 3 15:46:47 HKT 2026, instance ip-172-26-6-228):

| Check | Value | Verdict |
|-------|-------|---------|
| Public DNS @1.1.1.1 | 18.136.141.186 | PASS |
| Public DNS @8.8.8.8 | 18.136.141.186 | PASS |
| pm2-ubuntu enabled | enabled | PASS |
| pm2-ubuntu active | active | PASS |
| caddy enabled | enabled | PASS |
| caddy active | active | PASS |
| Public table count | 26 | PASS |
| `PUBLIC_HTTPS_ROOT_FORCED` | 307 | PASS (3xx expected) |
| `PUBLIC_HTTPS_API_HEALTH_FORCED` | 200 | PASS |
| `PUBLIC_HTTPS_API_DB_HEALTH_FORCED` | 200 | PASS |
| `PUBLIC_HTTPS_API_READY_FORCED` | 200 | PASS |
| `LOCAL_API_HEALTH` | 200 | PASS |
| `LOCAL_API_DB_HEALTH` | 200 | PASS |
| `LOCAL_API_READY` | 200 | PASS |
| `LOCAL_CONTAINER_HEALTH` | 200 | PASS |
| `LOCAL_FRONTEND_ROOT` | 307 | PASS |
| `/en` via Caddy | HTTP/2 200 | PASS |
| `/en/login` via Caddy | HTTP/2 200 | PASS |
| `/en/register` via Caddy | HTTP/2 200 | PASS |
| Root `Location` header | `https://localhost:3002/en` | **FAIL — must be corrected** |
| Caddyfile backup (from 04H) | `/etc/caddy/Caddyfile.backup-04H-20260803-133529` | RECORDED |
| No accounts/logins/persistent data | confirmed | PASS |
| No AI/billing/container/OAuth | confirmed | PASS |
| No secrets printed | confirmed | PASS |

---

## 5. Required Outcome

After 04I2 implementation and validation:

* Root `https://staging.ainow.biz` returns a 3xx redirect.
* `Location` header is `/en` or `https://staging.ainow.biz/en`.
* `Location` header is **not** `https://localhost:3002/en`.
* Browser on an external machine follows root to `/en` and lands successfully.
* `/en` returns HTTP/2 200.
* `/en/login` returns HTTP/2 200.
* `/en/register` returns HTTP/2 200.
* Public health endpoints remain 200.
* Local health endpoints remain 200.
* PM2 and Caddy remain enabled and active.
* Public table count remains 26.
* No accounts, logins, or persistent data created.
* No AI/billing/container/OAuth execution.
* No secrets printed.
* 04I2 evidence reviewed and locked before 04I resumes.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 6. Candidate Fix Options

Three options are evaluated. The decision matrix in Section 10 determines which to execute.

| Option | Label | Nature | Approval required |
|--------|-------|--------|------------------|
| A | Caddy reverse_proxy forwarded host/proto correction | Runtime / Caddy change | Explicit Keith approval before execution |
| B | Next.js middleware relative/public redirect correction | Source-code change | Separate implementation slice required |
| C | Source-grounded alternative minimal correction | Conditional — only if source evidence supports a smaller fix | Explicit Keith approval before execution |

---

## 7. Option A — Caddy Reverse Proxy Forwarded Host/Proto Correction

### Direction

In the Caddy frontend `reverse_proxy` block for `127.0.0.1:3002`, preserve and forward the public host and protocol so Next.js middleware does not generate `localhost:3002` redirects.

### Candidate Caddyfile change (documentation only — not executed in this step)

The current Caddy route (from 04H evidence) routes all non-API traffic to `127.0.0.1:3002` without explicit header forwarding. The candidate addition:

```caddyfile
reverse_proxy 127.0.0.1:3002 {
    header_up Host {http.request.host}
    header_up X-Forwarded-Host {http.request.host}
    header_up X-Forwarded-Proto {http.request.scheme}
}
```

When Caddy proxies a request for `https://staging.ainow.biz/`, with these directives:
- `Host: staging.ainow.biz` is forwarded to Next.js (overriding the default `Host: 127.0.0.1:3002` that Caddy sends to the upstream)
- `X-Forwarded-Host: staging.ainow.biz` is forwarded as an additional trust header
- `X-Forwarded-Proto: https` is forwarded so Next.js can see the correct scheme

With `Host: staging.ainow.biz` present, `request.nextUrl` in the middleware will resolve the host as `staging.ainow.biz`, and `request.nextUrl.clone()` + `url.pathname = '/en'` will produce `https://staging.ainow.biz/en` — the correct, browser-safe Location.

### Source-grounded rationale

From `frontend/middleware.ts` lines 33–37:
```typescript
if (pathname === '/') {
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}`;
  return NextResponse.redirect(url);
}
```

`request.nextUrl` in Next.js 15 reflects the `Host` header as received by the Node.js process. If `Host` is correctly `staging.ainow.biz`, the clone produces `https://staging.ainow.biz/en`. The middleware code itself needs no change under Option A.

### Option A constraints (mandatory)

This is a **runtime/Caddy change**. It requires:

> ---
> **STOP. Do not execute any Caddy/runtime/server command until Keith explicitly approves:**
>
> `go — approve 04I2 Caddy runtime redirect fix`
> ---

Additional mandatory constraints:

* Back up `/etc/caddy/Caddyfile` to a new timestamped path (separate from the existing 04H backup) before making any change.
* Run `sudo caddy validate --config /etc/caddy/Caddyfile` after editing. Do not reload if validation fails.
* If validation passes: **reload Caddy, do not restart it** — use `sudo systemctl reload caddy` (or `sudo caddy reload --config /etc/caddy/Caddyfile`).
* Preserve the API reverse proxy route (`/api/*` → `127.0.0.1:4000`) unchanged.
* Do not print secrets, certificate private keys, or env values.
* Validate the root `Location` header after reload using the curl command set in Section 18.
* If validation fails after reload: restore from the new backup immediately (see rollback plan in Section 15).

### Option A risk assessment

| Risk | Mitigation |
|------|-----------|
| Caddyfile syntax error breaks Caddy | `caddy validate` before reload; rollback path with backup |
| `header_up Host` affects API proxy route | API route uses separate `reverse_proxy 127.0.0.1:4000` block — not affected if routes are kept separate |
| Reload drops active connections briefly | `systemctl reload caddy` is graceful — minimized impact on staging |
| Wrong `{http.request.host}` placeholder syntax for Caddy v2.11.4 | `{http.request.host}` is valid in Caddy v2 — consistent with Caddy v2.11.4 confirmed in 04H |
| Caddyfile formatting warning re-appears | Non-blocking per 04H verdict — treat as acceptable |

---

## 8. Option B — Next.js Middleware Relative/Public Redirect Correction

### Direction

Change `frontend/middleware.ts` root locale redirect so it emits a browser-safe redirect to `/en` that does not inherit the upstream internal host from `request.nextUrl.clone()`.

### Source-grounded location

File: `frontend/middleware.ts`, lines 33–37:

```typescript
// Current — produces https://localhost:3002/en behind Caddy without host forwarding
if (pathname === '/') {
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}`;
  return NextResponse.redirect(url);
}
```

### Candidate correction approaches (documentation only — not executed in this step)

**Approach B-1 — Forwarded-host-aware absolute redirect (preferred if Caddy sends X-Forwarded-Host):**

```typescript
if (pathname === '/') {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = forwardedHost || request.headers.get('host') || '';
  const proto = forwardedProto || 'https';
  const redirectUrl = new URL(`/${DEFAULT_LOCALE}`, `${proto}://${host}`);
  return NextResponse.redirect(redirectUrl);
}
```

This reads the `X-Forwarded-Host` and `X-Forwarded-Proto` headers that Caddy may already be forwarding (Caddy sets these by default for `reverse_proxy` even without explicit `header_up`). If Caddy does forward them, the resulting URL is `https://staging.ainow.biz/en`. If it does not, it falls back to `request.headers.get('host')`.

**Approach B-2 — Relative-redirect using response rewrite (only if Next.js 15 supports relative redirect in middleware):**

Next.js 15 middleware requires `NextResponse.redirect` to receive a full `URL` object or a string that is a valid absolute URL. A purely relative redirect (`/en`) is not directly supported by `NextResponse.redirect`. Approach B-1 is therefore the implementation-safe path for Next.js 15.

**Note:** The implementation slice must confirm which approach is appropriate through source review and validation before writing code. Neither approach is implemented in this runbook step.

### Option B constraints (mandatory)

This is a **source-code change**. It requires:

> ---
> **STOP. Do not edit source code until a separate implementation prompt is issued for the selected source fix path.**
> ---

Additional mandatory constraints:

* The change must be implemented in a separate bounded implementation slice with explicit registration.
* The change must not alter unrelated i18n behavior, locale routing logic, matcher configuration, or non-root redirect paths.
* The following routes must be preserved and tested after change:
  * `/en` returns HTTP/2 200
  * `/en/login` returns HTTP/2 200
  * `/en/register` returns HTTP/2 200
  * Existing locale handling for `zh-TW`, `zh-CN` paths (redirect logic on line 39–42 of `middleware.ts`)
  * Existing API route passthrough
* The change must not add a hardcoded production domain (`app.ainow.biz`, `ainow.biz`) or any hardcoded staging hostname. Use forwarded headers or environment-driven configuration only.
* The change must remain staging-safe and production-safe.
* Validation after change: `npx tsc --noEmit` (frontend), `npm test` (frontend), `npm run build` (frontend), then redeploy/restart frontend on the staging VPS (requires a separate approved deployment step).
* The change must include or update tests that verify the redirect behavior where practical.

### Option B risk assessment

| Risk | Mitigation |
|------|-----------|
| `X-Forwarded-Host` not forwarded by Caddy (default behavior may omit it) | Approach B-1 falls back to `host` header; implementation slice must verify Caddy default forwarding behavior |
| `host` header remains `localhost:3002` in all Caddy proxy paths | If Caddy does not forward any trusted host header, Option B alone may not fully resolve the issue; combination with Option A may be needed |
| Change breaks other locale redirect paths (lines 39–42) | Scope must be limited to the root (`pathname === '/'`) block; other redirect paths must be tested |
| Next.js 15 middleware behavior differs from expectation | Implementation slice must validate with TypeScript check, tests, and build before deployment |
| Deployment/restart on staging requires PM2 or service restart | A separate approved PM2 restart step is required after source code change and redeploy; this is outside the 04I2 runbook scope and requires Keith approval |

---

## 9. Option C — Source-Grounded Alternative Minimal Correction

Option C applies only if source review during the implementation preparation phase identifies a smaller, safer fix than either Option A or Option B alone.

### Allowed conditions for Option C

Option C may be selected only if:

1. Source evidence (middleware, Caddy config, Next.js behavior) clearly demonstrates a smaller fix path that resolves the `Location: https://localhost:3002/en` failure without the full scope of Option A or B.
2. Option C does not broaden scope into unrelated routing, i18n, or infrastructure changes.
3. Option C is documented with source evidence and receives explicit Keith approval before execution.

### Example smaller-fix candidates that could qualify as Option C

* If Caddy is already forwarding `X-Forwarded-Host: staging.ainow.biz` by default (without explicit `header_up`) and the middleware simply needs to read it — a minimal one-line change in `middleware.ts` reading `x-forwarded-host` for the root case only may qualify.
* If a Next.js 15 `next.config.js` trusted proxy configuration can instruct the middleware to trust forwarded headers without any code change — this may qualify as a smaller config-only change.

### Option C constraints (mandatory)

* Option C must be justified explicitly by source evidence in the implementation preparation review.
* Option C must not broaden the fix scope beyond correcting the `Location` header for the root path.
* Option C must still require explicit Keith approval before execution, plus the same validation command set as Option A or B.
* If Option C is selected, document the justification, the specific evidence, and the exact change in the 04I2 evidence template.

---

## 10. Decision Matrix

| Criterion | Option A (Caddy) | Option B (Middleware) | Option C (Alternative) |
|-----------|-----------------|----------------------|----------------------|
| Source evidence | `reverse_proxy 127.0.0.1:3002` in Caddyfile has no `header_up Host` — confirmed in 04H evidence review | `middleware.ts` lines 33–37 use `request.nextUrl.clone()` — confirmed in source read | Conditional — requires additional evidence |
| Code change required | No source code change to middleware.ts | Yes — middleware.ts root redirect block | Conditional |
| Runtime change required | Yes — Caddyfile edit + validate + reload | No Caddy change in this option | Conditional |
| Keith approval gate | Required before execution | Required (as separate implementation slice) | Required before execution |
| Deployment/restart required | Caddy reload only — no app restart | Frontend rebuild + PM2 frontend restart (separate approved step) | Depends |
| Risk to existing routes | Low — API route separate; header_up scoped to frontend proxy block | Low — only root path block changed | Depends |
| Risk to Caddy stability | Low — validate before reload; backup + rollback path | None (no Caddy change) | Depends |
| Rollback path | Restore backup; caddy validate; reload | Git revert; redeploy | Depends |
| Solves problem if Caddy not forwarding Host | **Yes** — forces Host forwarding | Partially — depends on whether X-Forwarded-Host is available | Depends |
| Solves problem if middleware needs hardening | Partially — middleware still uses clone() but now gets correct Host | **Yes** — middleware no longer relies on clone() inheriting internal host | Depends |
| Can both be applied together? | Yes — combination is safe if proven necessary | Yes — combination is safe if proven necessary | — |
| Preferred by default guidance | Second preference (prefer source fix if clone() is clearly the root) | **First preference** (source evidence shows clone() is producing wrong Location) | Third preference |

---

## 11. Recommended First Fix Path

Based on source-grounded evidence from 04I1 and direct reading of `frontend/middleware.ts`:

**Recommended first path: Option B — Next.js middleware relative/public redirect correction.**

**Rationale:**

1. The source evidence is unambiguous: `frontend/middleware.ts` lines 33–37 use `request.nextUrl.clone()` to construct the root redirect. The `Location: https://localhost:3002/en` value is the direct output of `request.nextUrl.clone()` inheriting the internal upstream host. The fix is precisely scoped to this code path.

2. A middleware fix is more portable and future-proof: even if Caddy is later reconfigured (e.g., for a different upstream, load balancer, or cloud-native setup), a middleware that reads `X-Forwarded-Host` and `X-Forwarded-Proto` correctly will produce the right redirect regardless of the Caddy host-forwarding behavior.

3. The middleware fix does not modify runtime configuration and avoids the need for an explicit Caddy approval gate for the core fix itself (though the subsequent PM2/deployment restart step still requires Keith approval as a separate bounded action).

4. Option A (Caddy) remains valid as a second path or as a complementary hardening step if the implementation slice determines that Caddy is not forwarding any trusted host header to Next.js at all, making Option B alone insufficient.

**Default decision rule:**

```
1. If middleware.ts is clearly producing an absolute upstream-local Location from request.nextUrl.clone() → prefer Option B.
2. If source review in the implementation slice shows Next.js cannot read any trusted forwarded host header from Caddy → add Option A as a prerequisite or combination.
3. Do not modify both Caddy and middleware source without clear evidence that one alone is insufficient.
```

**Do not implement either option in this runbook step. The implementation step requires a separate prompt.**

---

## 12. Preconditions Before Implementation

All preconditions below must be confirmed true before any fix (Option A or B) is executed:

| # | Precondition | Source |
|---|-------------|--------|
| 1 | PRIVATE-BETA-STAGING-EXECUTION-04H is COMPLETE and LOCKED | 04H Checkpoint — 2026-08-03 |
| 2 | PRIVATE-BETA-STAGING-EXECUTION-04I1 evidence review has issued verdict `INVESTIGATION PASS — ROOT BEHAVIOR FAILS` | 04I1 Evidence Review — 2026-08-03 |
| 3 | PRIVATE-BETA-STAGING-EXECUTION-04I2 Step 1 (Registration) is COMPLETE | TASKS.md — 2026-08-03 |
| 4 | `staging.ainow.biz` DNS resolves to `18.136.141.186` via 1.1.1.1 and 8.8.8.8 | 04I1 evidence |
| 5 | Caddy is enabled and active on the staging instance | 04I1 evidence |
| 6 | PM2 and all four app services are enabled and active | 04I1 evidence |
| 7 | Public health endpoints are passing (API health/db/ready = 200) | 04I1 evidence |
| 8 | Public table count is 26 | 04I1 evidence |
| 9 | No accounts, logins, or persistent data have been created | 04I1 evidence |
| 10 | Caddyfile backup from 04H exists at `/etc/caddy/Caddyfile.backup-04H-20260803-133529` | 04H evidence review |
| 11 | Keith has explicitly selected Option A or Option B (or a justified Option C) | Required before implementation begins |
| 12 | For Option A: Keith has issued explicit approval token `go — approve 04I2 Caddy runtime redirect fix` | Required before any Caddy change |
| 13 | For Option B: a separate implementation slice has been registered in `TASKS.md` and `TASKS_BACKLOG_FULL.md` | Required before any source code edit |

If any precondition fails, stop and raise as a separate bounded slice.

---

## 13. Approval Gates Before Implementation

### Gate 1 — Caddy runtime fix approval (Option A only)

> ---
> **STOP. Do not execute any Caddy/runtime/server command until Keith explicitly approves:**
>
> `go — approve 04I2 Caddy runtime redirect fix`
> ---

This gate applies to any SSH command that touches `/etc/caddy/Caddyfile`, `caddy validate`, `systemctl reload caddy`, or any other Caddy runtime action.

### Gate 2 — Source code implementation (Option B only)

> ---
> **STOP. Do not edit source code until a separate implementation prompt is issued for the selected source fix path.**
> ---

This gate applies to any edit of `frontend/middleware.ts` or any other source file. A separate implementation slice must be registered in `TASKS.md` and `TASKS_BACKLOG_FULL.md` before any code change is made.

### Gate 3 — Resume 04I browser smoke

> ---
> **STOP. Do not resume 04I browser smoke until 04I2 validation shows root redirects to `/en` or `https://staging.ainow.biz/en` and 04I2 is evidence-reviewed.**
> ---

04I browser smoke Paths A, B, C, D, E, F remain blocked until 04I2 passes validation and evidence review is complete.

---

## 14. Option A Implementation Plan (if selected)

> **This plan must not be executed until Gate 1 approval has been received.**

### Option A — Step-by-step implementation plan (for Keith to execute in AWS Lightsail browser SSH)

**Step A-1: Pre-fix baseline check**

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
```

Confirm: pm2-ubuntu enabled/active, caddy enabled/active, table count 26, git status clean. If any check fails, stop.

**Step A-2: Record current root Location header (pre-fix)**

```bash
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,40p'
```

Record the `location:` value. Should be `https://localhost:3002/en`. Confirm this matches the known failure before proceeding.

**Step A-3: Create timestamped Caddyfile backup**

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-04I2-$(date +%Y%m%d-%H%M%S)
ls -la /etc/caddy/Caddyfile.backup-04I2-*
```

Confirm backup file exists and has a non-zero size before continuing.

**Step A-4: Edit Caddyfile to add host forwarding to frontend reverse_proxy block**

Edit `/etc/caddy/Caddyfile` to change the frontend `reverse_proxy` directive from:

```caddyfile
reverse_proxy 127.0.0.1:3002
```

to:

```caddyfile
reverse_proxy 127.0.0.1:3002 {
    header_up Host {http.request.host}
    header_up X-Forwarded-Host {http.request.host}
    header_up X-Forwarded-Proto {http.request.scheme}
}
```

Use a safe text editor (e.g., `sudo nano /etc/caddy/Caddyfile`). Do not change the API proxy route (`reverse_proxy 127.0.0.1:4000`). Do not change TLS configuration, `auto_https`, or any other Caddyfile block.

**Step A-5: Validate Caddyfile before reload**

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Expected output: `Valid configuration` (plus an optional non-blocking formatting warning as seen in 04H).

**If validation fails:** Stop immediately. Do not reload. Restore backup (Step A-6 rollback). Capture the validation error output. Return evidence to Cursor as plain text.

**If validation passes:** Proceed to Step A-6.

**Step A-6: Reload Caddy (graceful — not restart)**

```bash
sudo systemctl reload caddy
sleep 3
systemctl is-active caddy
```

Confirm Caddy is still active after reload.

**Step A-7: Validate root Location header after reload**

```bash
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,40p'
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz | sed -n '1,40p'
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -L -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,120p'
```

**If `location:` is now `/en` or `https://staging.ainow.biz/en`:** Proceed to full validation command set (Section 18).

**If `location:` is still `https://localhost:3002/en`:** Stop. Caddy host forwarding alone may not have corrected the Next.js URL construction. Do not reload again. Restore backup (Option A rollback). Consider whether Option B or combination is needed.

---

## 15. Option A Rollback Plan

If Option A implementation fails at any step, or if post-fix validation shows root Location is still wrong, or if Caddy becomes inactive:

**Step R-1: Restore Caddyfile from 04I2 backup**

```bash
sudo cp /etc/caddy/Caddyfile.backup-04I2-<TIMESTAMP> /etc/caddy/Caddyfile
```

Replace `<TIMESTAMP>` with the exact timestamp from Step A-3.

**Step R-2: Validate restored Caddyfile**

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Expected: `Valid configuration`. If validation fails, escalate — do not reload.

**Step R-3: Reload Caddy with restored config**

```bash
sudo systemctl reload caddy
sleep 3
systemctl is-active caddy
```

**Step R-4: Confirm rollback success**

```bash
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,40p'
```

Confirm `location: https://localhost:3002/en` is back (original state). This is still a failure state for Path A, but confirms rollback restored the prior stable configuration.

**Step R-5: Confirm API and health still work**

```bash
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "API=%{http_code}\n" https://staging.ainow.biz/api/health
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "EN=%{http_code}\n" https://staging.ainow.biz/en
```

Expected: `API=200`, `EN=200`. If either fails, escalate.

**Step R-6: Capture safe evidence and return to Cursor**

Return rollback evidence (date, Caddy status, root Location, health check results) as plain text in Cursor chat. No secrets.

**Step R-7: If 04H rollback is needed (last resort)**

If the 04I2 backup is unavailable or corrupted, the 04H backup can be restored as a last resort:

```bash
sudo cp /etc/caddy/Caddyfile.backup-04H-20260803-133529 /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

This restores the state from the start of 04H. Only use this if the 04I2 backup is unavailable.

---

## 16. Option B Implementation Plan (if selected)

> **This plan must not be executed until a separate implementation prompt is issued.**

### Option B — Implementation scope

**File to change:** `frontend/middleware.ts`
**Lines to change:** 33–37 (root path redirect block)
**Pattern to fix:** Replace `request.nextUrl.clone()` for the root redirect with a URL construction that reads forwarded host/proto headers rather than inheriting the internal upstream host.

### Option B — Implementation slice requirements

The implementation slice must:

1. Read `frontend/middleware.ts` in full before making any change.
2. Confirm current behavior of `request.nextUrl.clone()` in Next.js 15 behind Caddy.
3. Determine whether Caddy's default `reverse_proxy` behavior forwards `X-Forwarded-Host` and `X-Forwarded-Proto` without explicit `header_up` directives.
4. Select the appropriate approach (B-1 or a justified alternative) based on source evidence.
5. Make the minimal change to the root redirect block only.
6. Preserve lines 30–32 (`hasLocalePrefix` return), lines 39–42 (non-root non-locale redirect), and lines 44–47 (matcher config) unchanged.
7. Preserve the `DEFAULT_LOCALE` constant and `SUPPORTED_LOCALES` array unchanged.
8. Validate: `npx tsc --noEmit` in `frontend/`.
9. Validate: `npm test` in `frontend/` (confirm no existing tests break).
10. Validate: `npm run build` in `frontend/` (confirm build succeeds).
11. Restore `frontend/tsconfig.tsbuildinfo` if build updates it unintentionally (per project rules).
12. After local validation, deploy the updated frontend build to the staging VPS (separate bounded deployment step — requires Keith approval).
13. After deployment, restart the frontend PM2 process (separate bounded PM2 restart step — requires Keith approval).
14. After restart, run the validation command set in Section 18.

### Option B — What must not change

* `middleware.ts` matcher configuration (lines 44–47)
* `SUPPORTED_LOCALES` or `DEFAULT_LOCALE` constants
* Non-root locale redirect logic (lines 39–42)
* API/static/favicon passthrough logic (lines 20–31)
* `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` (no UX text changes in this fix)
* Any other source files outside `frontend/middleware.ts`
* Any migration files
* Any `.env` or environment configuration files
* `TASKS.md`, `TASKS_BACKLOG_FULL.md`, or roadmap documents (until consolidation step)

### Option B — Post-deployment staging restart

After the source change is built and deployed to the staging VPS:

```bash
# Run in AWS Lightsail browser SSH — not Cursor
# Keith must approve this step explicitly before execution
pm2 restart aisandbox-frontend
pm2 status
```

Wait for the frontend process to show status `online` before running validation.

---

## 17. Option B Rollback Plan

If Option B implementation fails validation, or if post-deployment testing shows regression:

**Step R-1: Revert source code change**

In the local development environment:

```bash
git revert HEAD --no-edit
# or
git checkout frontend/middleware.ts
```

**Step R-2: Rebuild and redeploy**

After reverting:
```bash
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
```

Deploy reverted build to staging VPS and restart frontend PM2 process (requires Keith approval as a separate bounded action).

**Step R-3: Confirm rollback**

Run the validation command set (Section 18). Root should return `location: https://localhost:3002/en` (original failure state, but Caddy still active and `/en` still serves 200 — known working state restored).

**Step R-4: Return evidence to Cursor**

Return rollback evidence as plain text. No secrets.

---

## 18. Validation Command Set

> **These commands are for manual execution in the AWS Lightsail browser SSH terminal only — not PowerShell — not Cursor.**
> **Run these after the selected fix (Option A or B) is implemented.**
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

echo "ROOT_REDIRECT_HEADERS_FORCED_SLASH:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,40p'

echo "ROOT_REDIRECT_HEADERS_FORCED_NO_SLASH:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -D - -o /dev/null https://staging.ainow.biz | sed -n '1,40p'

echo "ROOT_REDIRECT_FOLLOW_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -L -D - -o /dev/null https://staging.ainow.biz/ | sed -n '1,120p'

echo "DIRECT_ROUTES_FORCED:"
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "EN=%{http_code}\n" https://staging.ainow.biz/en
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "LOGIN=%{http_code}\n" https://staging.ainow.biz/en/login
curl --resolve staging.ainow.biz:443:18.136.141.186 -sS -o /dev/null -w "REGISTER=%{http_code}\n" https://staging.ainow.biz/en/register

echo "PUBLIC_HEALTH_FORCED:"
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

### Expected output after fix

**ROOT_REDIRECT_HEADERS_FORCED_SLASH:**
- HTTP 3xx acceptable.
- `location:` must be `/en` OR `https://staging.ainow.biz/en`.
- `location:` must **NOT** be `https://localhost:3002/en`.

**ROOT_REDIRECT_HEADERS_FORCED_NO_SLASH:**
- HTTP 3xx acceptable.
- `location:` must be `/en` OR `https://staging.ainow.biz/en`.
- `location:` must **NOT** be `https://localhost:3002/en`.

**ROOT_REDIRECT_FOLLOW_FORCED:**
- Must not produce `curl: (35) OpenSSL: wrong version number`.
- Must not attempt to connect to `localhost:3002`.
- Must reach `/en` successfully (HTTP/2 200) or another source-grounded safe final state.

**DIRECT_ROUTES_FORCED:**
- `EN=200`
- `LOGIN=200`
- `REGISTER=200`

**PUBLIC_HEALTH_FORCED:**
- `PUBLIC_HTTPS_API_HEALTH_FORCED=200`
- `PUBLIC_HTTPS_API_DB_HEALTH_FORCED=200`
- `PUBLIC_HTTPS_API_READY_FORCED=200`

**LOCAL_HEALTH:**
- `LOCAL_API_HEALTH=200`
- `LOCAL_API_DB_HEALTH=200`
- `LOCAL_API_READY=200`
- `LOCAL_CONTAINER_HEALTH=200`
- `LOCAL_FRONTEND_ROOT=2xx/3xx acceptable`

---

## 19. Browser Validation Steps

> **Browser testing is performed by Keith only — not Cursor.**
> **Do not submit any forms. Do not create accounts. Do not log in.**

After the selected fix is implemented and SSH validation (Section 18) passes:

Test the following URLs in a browser (use a private/incognito window to avoid cached redirect state):

```
https://staging.ainow.biz
https://staging.ainow.biz/
https://staging.ainow.biz/en
https://staging.ainow.biz/en/login
https://staging.ainow.biz/en/register
```

### For each URL, record

```
- URL entered:
- final address bar URL:
- HTTPS lock valid:
- browser visible result:
- error text, if any:
- localhost redirect avoided: (yes / no)
```

### What Keith should observe after a successful fix

* `https://staging.ainow.biz` → browser follows redirect → lands on `https://staging.ainow.biz/en`.
* Browser must **not** navigate to `https://localhost:3002/en`.
* HTTPS lock is valid on the final URL.
* `/en` page loads and renders some UI (does not need to be fully authenticated — public landing page).
* `/en/login` renders the login form.
* `/en/register` renders the register form.
* No account creation.
* No login.
* No AI/billing/container/OAuth execution.

---

## 20. Pass Criteria

04I2 fix should be recorded as **PASS** only if ALL of the following are true:

* [ ] Root `Location` header is no longer `https://localhost:3002/en`.
* [ ] Root `Location` header is `/en` or `https://staging.ainow.biz/en`.
* [ ] `ROOT_REDIRECT_FOLLOW_FORCED` does not produce an SSL error from `localhost:3002`.
* [ ] Browser root (`https://staging.ainow.biz`) opens successfully and lands on `/en`.
* [ ] Browser URL bar shows `https://staging.ainow.biz/en` after redirect (not `localhost`).
* [ ] HTTPS lock is valid on the final URL.
* [ ] `EN=200` — `/en` returns HTTP/2 200 via Caddy.
* [ ] `LOGIN=200` — `/en/login` returns HTTP/2 200 via Caddy.
* [ ] `REGISTER=200` — `/en/register` returns HTTP/2 200 via Caddy.
* [ ] `PUBLIC_HTTPS_API_HEALTH_FORCED=200`
* [ ] `PUBLIC_HTTPS_API_DB_HEALTH_FORCED=200`
* [ ] `PUBLIC_HTTPS_API_READY_FORCED=200`
* [ ] `LOCAL_API_HEALTH=200`
* [ ] `LOCAL_API_DB_HEALTH=200`
* [ ] `LOCAL_API_READY=200`
* [ ] `LOCAL_CONTAINER_HEALTH=200`
* [ ] `LOCAL_FRONTEND_ROOT=2xx/3xx`
* [ ] PM2 (`pm2-ubuntu`) remains enabled and active.
* [ ] Caddy remains enabled and active.
* [ ] Public table count remains 26.
* [ ] No account/login/persistent data created.
* [ ] No AI/billing/container/OAuth actions occurred.
* [ ] No secrets printed.
* [ ] No source/migration/env changes outside the explicitly selected and approved fix scope.
* [ ] PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 21. Fail / Blocked Criteria

04I2 fix should be recorded as **FAIL** if ANY of the following are true:

* Root `Location` header remains `https://localhost:3002/en` after the fix.
* Root `Location` header points to an unexpected hostname (other than `staging.ainow.biz` or relative `/en`).
* Root redirects to a production domain (`app.ainow.biz`, `ainow.biz`).
* `ROOT_REDIRECT_FOLLOW_FORCED` still produces SSL error on `localhost:3002`.
* Browser root still navigates to `https://localhost:3002/en`.
* `EN`, `LOGIN`, or `REGISTER` no longer return 200.
* Any public health endpoint returns non-200.
* Any local health endpoint returns non-200.
* Caddy becomes inactive after fix.
* PM2 or any app process becomes inactive after fix.
* Public table count changes unexpectedly.

04I2 fix should be recorded as **BLOCKED** if ANY of the following are true:

* The fix cannot be executed without printing secrets, credentials, or env values.
* Account creation, login, or persistent data would be required to validate.
* AI/billing/container/OAuth execution would be triggered by the fix or validation.
* The selected fix scope appears to require modifying both Caddy and source code without explicit prior evidence and approval for the combination.
* Validation command set cannot be run safely.

---

## 22. Stop Conditions

Immediately stop implementation and capture safe evidence if any of the following occur:

**Security / secret exposure:**
* Any secret, password, JWT, token, API key, or `.env` value would need to be printed, shared, or pasted.
* Any Caddy TLS private key, SSH private key, or AWS access key would need to be accessed.

**Account / data creation:**
* Any account creation, login, registration, or persistent data creation would be required.

**Execution gates:**
* AI execution, billing/payment flow, container workflow, or Google OAuth flow appears or is triggered.

**Domain scope:**
* Production domain (`app.ainow.biz`, `ainow.biz`) appears in the fix or validation path.

**Health degradation:**
* Public health endpoints fail unexpectedly during implementation.
* Local health endpoints fail unexpectedly.
* PM2 or Caddy becomes inactive.
* Public table count changes from 26.
* Git status becomes non-clean (unexpected uncommitted changes).

**Scope escalation:**
* Implementation reveals that both Caddy and source code must be changed, but only one was approved.
* Fix scope appears to require changes beyond what was registered and approved.
* Fix would modify unrelated i18n behavior, locale routing, API routes, or middleware matcher.

**Fix regression:**
* `/en`, `/en/login`, or `/en/register` no longer return 200 after the fix.
* Caddy API route (`/api/*`) stops returning 200 after a Caddy change.

**When a stop condition is triggered:**

1. Stop immediately.
2. Do not make any further changes to Caddyfile, source code, PM2, systemd, database, or migrations.
3. Capture safe evidence using the template in Section 24.
4. Return evidence to Cursor chat as plain text (no secrets).
5. Restore from backup if a partial Caddy change was made (Option A rollback).
6. Raise any new follow-up issue as a separate bounded slice.

---

## 23. Recovery Boundary

**This runbook step (Step 2) does not implement the fix.**

The following boundaries apply throughout 04I2:

* **A Caddy runtime fix (Option A)** requires explicit Keith approval via the gate token `go — approve 04I2 Caddy runtime redirect fix` before any SSH command touches the Caddyfile. It must back up the Caddyfile, validate before reload, and have a rollback path.

* **A source code fix (Option B)** requires a separate implementation prompt issued to a separate implementation session. The implementation slice must be registered in `TASKS.md` and `TASKS_BACKLOG_FULL.md` before code is written. After the fix is validated locally, a separate bounded deployment step is required to push to staging and restart the frontend PM2 process (Keith approval required for PM2 restart).

* **If the selected fix fails:** Stop. Capture safe evidence. Restore from backup (Option A) or revert source (Option B). Do not broaden into unrelated routing, i18n, or app changes. Do not attempt a second fix option without registering a new slice.

* **Do not resume 04I browser smoke** until 04I2 has passed SSH validation and browser validation, evidence has been captured, and 04I2 evidence review has been completed and consolidated.

* **Do not advance PRIVATE-BETA-DEPLOYMENT-READINESS** from 04I2 alone. Deployment readiness remains BLOCKED / PAUSED.

---

## 24. Safe Evidence Template

Copy this template after implementing and validating the selected fix. Return to Cursor chat as plain text — no secrets, passwords, session cookies, JWTs, or `.env` values.

```text
04I2 Public Root Redirect Location Header Fix Evidence

Selected fix path:
- Option selected:
- Reason:
- Approval received:
- Files changed, if any:
- Runtime files changed, if any:
- Backup path, if runtime/Caddy fix:
- Rollback path:

Pre-fix known failure:
- root Location before fix:
- expected Location:

Post-fix SSH validation:
- date:
- public table count:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- caddy enabled:
- caddy active:
- DNS @1.1.1.1:
- DNS @8.8.8.8:
- root slash status:
- root slash Location:
- root no-slash status:
- root no-slash Location:
- root follow result:
- EN:
- LOGIN:
- REGISTER:
- PUBLIC_HTTPS_API_HEALTH_FORCED:
- PUBLIC_HTTPS_API_DB_HEALTH_FORCED:
- PUBLIC_HTTPS_API_READY_FORCED:
- LOCAL_API_HEALTH:
- LOCAL_API_DB_HEALTH:
- LOCAL_API_READY:
- LOCAL_CONTAINER_HEALTH:
- LOCAL_FRONTEND_ROOT:

Browser validation:
- https://staging.ainow.biz result:
- https://staging.ainow.biz/ result:
- final URL:
- HTTPS lock valid:
- localhost redirect avoided:
- /en works:
- /en/login works:
- /en/register works:

Safety/non-goals:
- no account created:
- no login performed:
- no persistent data created:
- no AI execution:
- no billing/payment execution:
- no container workflow:
- no Google OAuth:
- no secrets printed:
- no production domain tested:
- no unrelated source/migration/env changes:
- deployment readiness still blocked:

Warnings/errors:
- none / details:
```

---

## 25. Expected Final State

Expected final state after 04I2 implementation and validation are complete:

| State | Expected |
|-------|----------|
| Root `Location` header | `/en` or `https://staging.ainow.biz/en` — NOT `https://localhost:3002/en` |
| Browser root navigation | Redirects to `/en` without localhost error |
| `/en` | Returns HTTP/2 200 |
| `/en/login` | Returns HTTP/2 200 |
| `/en/register` | Returns HTTP/2 200 |
| Public API health/db/ready | 200 |
| Local health (API/db/ready/container) | 200 |
| `LOCAL_FRONTEND_ROOT` | 2xx/3xx acceptable |
| PM2 (`pm2-ubuntu`) | enabled / active |
| Caddy | enabled / active |
| Public table count | 26 — unchanged |
| Accounts / logins / persistent data | None created |
| AI / billing / container / OAuth | None triggered |
| Secrets | Not printed |
| Source code changes (if Option B) | `frontend/middleware.ts` root redirect block updated — no other files changed |
| Caddy changes (if Option A) | `reverse_proxy 127.0.0.1:3002` block updated with `header_up` directives — API route unchanged |
| 04I2 status | Validated — ready for evidence review and consolidation |
| 04I status | Unblocked for Path A resume after 04I2 evidence review |
| 04I (after resuming) | Paths A, B, C can proceed; D, E, F gated behind explicit approval |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## 26. Exact Next Action

**Step 2 (this runbook) is complete.**

The next action depends on Keith's option selection:

### If Option A (Caddy) is selected:

1. Issue explicit approval token: `go — approve 04I2 Caddy runtime redirect fix`
2. Execute Option A implementation plan (Section 14) in AWS Lightsail browser SSH.
3. Run validation command set (Section 18) after reload.
4. Run browser validation (Section 19) after SSH validation passes.
5. Capture safe evidence using the template in Section 24.
6. Return evidence to Cursor chat as plain text.
7. Step 3 (Evidence Review) will be PRIVATE-BETA-STAGING-EXECUTION-04I2.
8. After 04I2 evidence review is complete and consolidated → 04I browser smoke can resume from Path A.

### If Option B (Next.js middleware) is selected:

1. Issue a separate implementation prompt to register and execute the `frontend/middleware.ts` source fix.
2. Register the implementation slice in `TASKS.md` and `TASKS_BACKLOG_FULL.md` before writing code.
3. Implement, validate locally (TypeScript, tests, build), deploy to staging, restart frontend PM2 (Keith approval for PM2 restart).
4. Run validation command set (Section 18) after deployment.
5. Run browser validation (Section 19) after SSH validation passes.
6. Capture safe evidence using the template in Section 24.
7. Return evidence to Cursor chat as plain text.
8. Step 3 (Evidence Review) will be PRIVATE-BETA-STAGING-EXECUTION-04I2.
9. After 04I2 evidence review is complete and consolidated → 04I browser smoke can resume from Path A.

### If Option C (alternative minimal correction) is selected:

1. Document the source evidence justification and specific fix scope.
2. Issue explicit Keith approval before execution.
3. Follow the same evidence capture, validation, and review flow as Option A or B.

**Keep PRIVATE-BETA-STAGING-EXECUTION-04I ACTIVE — BLOCKED by 04I2.**
**Keep parent PRIVATE-BETA-STAGING-EXECUTION-04 ACTIVE.**
**Keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED.**
**Do not enable AI / billing / container / OAuth execution.**
**Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.**
**Do not cut over production domain (`app.ainow.biz` / `ainow.biz`).**

---

**End of runbook.**

**Runbook created:** 2026-08-03
**Step 2 status:** Fix Runbook COMPLETE.
**No SSH or AWS CLI/actions performed by Cursor.**
**No browser opened by Cursor.**
**No accounts created.**
**No env values printed.**
**No subagents used.**
**No source or migration files changed.**
**No git commit or push.**
