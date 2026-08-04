# PRIVATE-BETA-STAGING-EXECUTION-04I2C — Root Redirect Origin Strategy Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I2C
**Title:** Root Redirect Origin Strategy Reset — Step 2 — Strategy Review
**Status:** Step 2 COMPLETE — strategy review — 2026-08-03
**Nature:** Strategy/review only — no SSH — no AWS CLI/actions — no browser opened by Cursor — no accounts created — no login/register executed — no AI execution — no billing/payment execution — no container workflow execution — no Google OAuth enablement — no DNS/TLS changes — no Caddy reload/restart — no PM2/systemd commands — no `.env` opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped/restarted — no migrations — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I2C |
| Title | Root Redirect Origin Strategy Reset |
| Step | 2 — Strategy Review |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04I2 |
| Grandparent task | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Great-grandparent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessor | 04I2A FAILED — Option B source fix caused root HTTP/2 500 |
| Predecessor | 04I2B FAILED — Option A Caddy forwarded header fix did not fix root redirect |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL — blocks 04I / 04 / DEPLOYMENT-READINESS |
| Review date | 2026-08-03 |

---

## 2. Current Known State

```text
04I2A:
- Source middleware relative Location fix deployed.
- Root became HTTP/2 500.
- Rolled back on VPS.
- Main/local still contains failed 04I2A source commit (commit 41b8603).
- VPS middleware.ts = original (request.nextUrl.clone() version).
- Local/main middleware.ts = 04I2A version (new NextResponse with Location: /en).

04I2B:
- Caddy forwarded Host/X-Forwarded-Host/X-Forwarded-Proto tested.
- Root still redirected to https://localhost:3002/en.
- Caddy warned X-Forwarded-Host "unnecessary" and X-Forwarded-Proto "unnecessary".
- No warning for Host — meaning header_up Host was accepted.
- Despite explicit Host forwarding, Next.js still produced localhost:3002 in Location.
- Caddy rolled back.
- VPS remains dirty intentionally:
  - M frontend/middleware.ts
  - M frontend/tsconfig.tsbuildinfo

Current staging safe-known failure:
- root = 307 → https://localhost:3002/en
- /en = 200
- /en/login = 200
- /en/register = 200
- API health = 200
- pm2-ubuntu = enabled / active
- caddy = enabled / active
- public table count = 26
```

---

## 3. Required Analysis

### 3.1 Why `request.nextUrl.clone()` produces `https://localhost:3002/en`

**Root cause:** Next.js constructs `request.nextUrl` using an internal origin derived from the server's bind address, not the incoming `Host` header.

The evidence chain:

1. Next.js middleware runs in a Node.js-hosted Edge runtime simulation. The `NextRequest.nextUrl` is a `NextURL` object constructed from the incoming request URL.

2. In Node.js, `req.url` is only the path portion (e.g., `/`), not a full URL. Next.js must reconstruct the full URL by combining `req.url` with a base origin.

3. In Next.js 15 (`^15.1.3` per `frontend/package.json`), the origin used for this reconstruction appears to come from the server's internal bind configuration (`localhost:3002`), not from the HTTP `Host` header.

4. The scheme `https://` in `https://localhost:3002/en` proves that Next.js IS reading `X-Forwarded-Proto: https` from Caddy — but it combines this forwarded scheme with the internal hostname, producing the hybrid `https://localhost:3002`.

5. This internal origin construction is an architectural property of how Next.js 15 middleware resolves `request.nextUrl` behind a reverse proxy. It is not a Caddy configuration error.

**Source evidence:** `frontend/middleware.ts` lines 33–37 (VPS version):
```typescript
if (pathname === '/') {
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}`;
  return NextResponse.redirect(url);
}
```

`request.nextUrl.clone()` clones the full URL including the internal origin. Setting `url.pathname = '/en'` preserves the broken origin. The redirect produces `Location: https://localhost:3002/en`.

### 3.2 Why Caddy `header_up Host` may not have changed the observed redirect

**04I2B proved this conclusively.** When `header_up Host {http.request.host}`, `header_up X-Forwarded-Host {http.request.host}`, and `header_up X-Forwarded-Proto {http.request.scheme}` were all explicitly added to the Caddy `reverse_proxy 127.0.0.1:3002` block:

- Caddy warned that `X-Forwarded-Host` and `X-Forwarded-Proto` were "unnecessary" — meaning **Caddy was already forwarding these headers by default**.
- Caddy accepted the explicit `Host` `header_up` without warning — meaning either it was already forwarding Host (and doesn't warn about it) or the directive was newly effective.
- **Despite all three headers being explicitly forwarded, the Location remained `https://localhost:3002/en`.**

This proves that **Next.js middleware does not use the incoming `Host` header or `X-Forwarded-Host` header to construct `request.nextUrl`**. The internal origin construction is independent of these headers. Sending the correct Host header to Next.js does not fix the problem because Next.js doesn't use it for `nextUrl` origin resolution.

The 04I2B failure is the most important evidence in this investigation: it definitively rules out any Caddy header-forwarding fix to the existing middleware code.

### 3.3 Why `new NextResponse(null, { status: 307, headers: { Location: '/en' } })` caused HTTP/2 500

The 04I2A approach bypassed `NextResponse.redirect()` and manually constructed a raw response:

```typescript
return new NextResponse(null, {
  status: 307,
  headers: { Location: `/${DEFAULT_LOCALE}` },
});
```

**Why this caused 500:**

1. **Next.js middleware expects specific response patterns.** The middleware pipeline recognizes responses from `NextResponse.redirect()`, `NextResponse.next()`, and `NextResponse.rewrite()` via internal metadata. A manually constructed `new NextResponse(null, ...)` with a redirect status bypasses this internal routing.

2. **`NextResponse.redirect()` requires an absolute URL.** The Next.js `NextResponse.redirect(url)` method validates that `url` is a full absolute URL. You cannot pass `/en` directly — it would throw a `TypeError: Invalid URL` error. This is why the 04I2A approach used `new NextResponse()` manually instead.

3. **Middleware adapter processing.** When Next.js's middleware adapter receives the response, it processes it according to the response type. A manually constructed 307 response may confuse the HTTP/2 adapter because it lacks the internal metadata that `NextResponse.redirect()` attaches. The adapter may attempt internal processing that fails, producing the HTTP/2 500.

4. **The `null` body** is valid for redirect responses per HTTP spec, but Next.js's internal adapter may not handle `null` correctly in the middleware → HTTP/2 response serialization path.

5. **Evidence confirmation:** Only the root path returned 500. `/en`, `/en/login`, `/en/register` continued returning 200. These paths use `NextResponse.next()` (standard middleware return), confirming that the 500 was caused specifically by the non-standard `new NextResponse(null, ...)` redirect pattern.

### 3.4 Which strategy has the smallest blast radius

**Strategy 1 — Caddy `redir / /en 307`** has the smallest blast radius:

- Affects only the exact root path `/`.
- Does not touch any source code.
- Does not require a build or PM2 restart.
- Does not modify any Next.js behavior.
- Only requires a Caddyfile edit + validate + graceful reload.
- Does not worsen main-vs-VPS git divergence.

### 3.5 Which strategy is easiest to rollback

**Strategy 1 — Caddy `redir / /en 307`** is easiest to rollback:

- Create a timestamped Caddyfile backup before the change.
- If the fix fails: restore the backup file, `caddy validate`, `systemctl reload caddy`.
- Caddy is back to the safe known failure state within seconds.
- No build, deploy, or PM2 restart needed for rollback.
- Multiple Caddyfile backups exist: 04H (`Caddyfile.backup-04H-20260803-133529`) and 04I2B (`Caddyfile.backup-04I2B-20260803-205858`).

### 3.6 Which strategy avoids source/VPS git divergence getting worse

**Strategy 1 — Caddy `redir / /en 307`** does not touch source code at all:

- No git changes on VPS.
- No git changes on local/main.
- VPS dirty state (M `frontend/middleware.ts`, M `frontend/tsconfig.tsbuildinfo`) remains unchanged.
- Local/main 04I2A commit remains unchanged (addressed in later cleanup).
- No new commits, no new divergence.

### 3.7 Which strategy is best for staging now

**Strategy 1 — Caddy `redir / /en 307`** is best for staging now:

- Unblocks 04I Path A immediately.
- No multi-step build/deploy/restart pipeline.
- Caddy `redir` is a well-established Caddy v2 feature.
- The redirect is issued by Caddy before the request reaches Next.js, completely bypassing the `request.nextUrl` origin issue.
- Caddy knows its own public hostname (`staging.ainow.biz`) and will produce a correct `Location` header.

### 3.8 What later cleanup is needed for local/main vs VPS divergence

After the Caddy fix succeeds and 04I Path A passes:

1. **Revert 04I2A commit on local/main.** The commit 41b8603 changed `frontend/middleware.ts` to use `new NextResponse(null, { status: 307, headers: { Location: '/en' } })`. This must be reverted to restore the original `request.nextUrl.clone()` approach. The Caddy `redir` makes this code path unreachable for the root, so restoring it is safe.

2. **Sync VPS with clean main.** After the revert is committed on main, the VPS can `git pull` (or `git checkout main -- frontend/middleware.ts`) to sync. The VPS dirty state for `frontend/middleware.ts` should then resolve.

3. **Address `frontend/tsconfig.tsbuildinfo` dirty state.** This is a build artifact. On VPS, a rebuild or a `git checkout` of this file should resolve it.

4. **Consider non-root, non-locale redirect.** The middleware code at lines 42–45 (VPS version) also uses `request.nextUrl.clone()` for non-root paths like `/some-page` → `/en/some-page`. This has the same `localhost:3002` issue. However, these paths are not critical user entry points for staging (users navigate to `/en/*` directly). A separate task can address this if needed.

5. **Long-term middleware hardening.** Consider adding a `next.config.js` redirect rule or a Caddy `redir` pattern for non-root locale fallback. Or consider using `request.headers.get('host')` in middleware once the exact Next.js 15 behavior is confirmed. This is a separate future task.

---

## 4. Strategy Candidates

### Strategy 1: Caddy-Level Exact Root Redirect

**Approach:** Add `redir / /en 307` to the Caddyfile, positioned between the API `handle` block and the default frontend `handle` block.

**Candidate Caddyfile:**

```caddyfile
staging.ainow.biz {
    encode gzip zstd

    handle /api/* {
        reverse_proxy 127.0.0.1:4000
    }

    redir / /en 307

    handle {
        reverse_proxy 127.0.0.1:3002
    }
}
```

**How it works:**

1. Caddy v2 sorts directives by its built-in directive order. `redir` comes BEFORE `handle` in Caddy's default ordering. This means `redir / /en 307` is evaluated before any `handle` block.

2. Caddy's path matcher `/` (without a wildcard) matches ONLY the exact path `/`. It does NOT match `/en`, `/en/login`, `/en/register`, `/api/*`, or any other path.

3. When a request for `https://staging.ainow.biz/` arrives:
   - `redir / /en 307` matches — Caddy issues `HTTP/2 307` with `Location: /en`.
   - The request never reaches Next.js.
   - The browser resolves `/en` against `https://staging.ainow.biz/`, landing on `https://staging.ainow.biz/en`.

4. When a request for `/en`, `/en/login`, `/en/register`, or `/api/health` arrives:
   - `redir / /en 307` does NOT match — the path is not `/`.
   - The request falls through to the appropriate `handle` block.
   - Behavior is unchanged from current working state.

**Caddy directive ordering verification:**

Caddy v2's default directive order (relevant excerpt):

```
...
redir          ← evaluated HERE (before handle)
...
handle         ← evaluated HERE (after redir)
handle_path
...
reverse_proxy
...
```

Because `redir` has higher priority than `handle`, the exact-root redirect fires before any handle block for the `/` path. All other paths bypass the `redir` and enter the `handle` blocks normally.

**Route safety matrix:**

| Request path | `redir / /en 307` match? | `handle /api/*` match? | `handle` (default) match? | Result |
|---|---|---|---|---|
| `/` | YES → 307 to `/en` | — | — | **Root redirect fixed** |
| `/en` | NO | NO | YES → proxy 3002 | **200 — unchanged** |
| `/en/login` | NO | NO | YES → proxy 3002 | **200 — unchanged** |
| `/en/register` | NO | NO | YES → proxy 3002 | **200 — unchanged** |
| `/api/health` | NO | YES → proxy 4000 | — | **200 — unchanged** |
| `/api/health/db` | NO | YES → proxy 4000 | — | **200 — unchanged** |
| `/api/health/ready` | NO | YES → proxy 4000 | — | **200 — unchanged** |
| `/_next/static/...` | NO | NO | YES → proxy 3002 | **Unchanged** |
| `/favicon.ico` | NO | NO | YES → proxy 3002 | **Unchanged** |
| `/some-page` | NO | NO | YES → proxy 3002 | **Unchanged (still has locale redirect issue via middleware, but non-critical)** |

**Location header analysis:**

Caddy `redir / /en 307` with a relative target (`/en`) produces:

```http
HTTP/2 307
Location: /en
```

The `Location: /en` is a relative URI reference, valid per RFC 7231 Section 7.1.2. Browsers resolve it against the current request URL:
- Request: `https://staging.ainow.biz/` → Location `/en` → `https://staging.ainow.biz/en` ✓
- No `localhost` in the response at any point.

**Verdict:** RECOMMENDED — smallest blast radius, easiest rollback, no source change, no git divergence.

---

### Strategy 2: Source-Level Explicit Public/Staging Origin Redirect

**Approach:** Modify `frontend/middleware.ts` to use `request.headers.get('host')` or `request.headers.get('x-forwarded-host')` instead of `request.nextUrl.clone()`.

**Candidate code (Approach B-1 from 04I2 runbook):**

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

**Why this is deferred:**

1. **04I2B proved that header forwarding does not fix `request.nextUrl`.** We confirmed that Caddy IS forwarding the correct Host and X-Forwarded-* headers. But `request.nextUrl` still resolves to `localhost:3002`. While `request.headers.get('host')` may return the correct value (it reads the raw HTTP header, not the parsed `nextUrl`), this is unverified.

2. **Risk of another 500.** The 04I2A failure showed that non-standard middleware response patterns can cause HTTP/2 500. While Approach B-1 uses `NextResponse.redirect()` (standard pattern), the URL construction is untested at staging runtime.

3. **Multi-step deployment.** Requires: source edit → TypeScript check → tests → build → deploy to VPS → PM2 restart → validation. Each step is a potential failure point.

4. **Worsens main-vs-VPS divergence.** A new commit on main creates a new divergence with VPS unless the VPS is also updated — which requires a separate deployment approval.

5. **Doesn't address the fundamental issue.** Even if `request.headers.get('host')` works for the root path, the non-root locale redirect at lines 42–45 still uses `request.nextUrl.clone()` and would still produce `localhost:3002` URLs for non-locale paths.

**Verdict:** DEFERRED — too much blast radius and deployment complexity. Use Caddy `redir` first. If a source fix is later needed for non-root paths, register as a separate task.

---

### Strategy 3: Next.js Middleware Canonical Relative Redirect via `NextResponse.redirect(new URL('/en', request.url))`

**Approach:** Use `request.url` as the base for URL construction instead of `request.nextUrl.clone()`.

```typescript
if (pathname === '/') {
  return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, request.url));
}
```

**Why this would still inherit `localhost:3002`:**

In Next.js middleware, `request.url` is the string form of the full request URL. It is constructed from the same internal origin as `request.nextUrl`. Both produce `https://localhost:3002/`.

Therefore `new URL('/en', request.url)` resolves to `https://localhost:3002/en` — the same broken result.

**Evidence:** `request.nextUrl` is defined as `new NextURL(request.url, ...)`. They share the same origin. If `request.nextUrl.host` is `localhost:3002`, then `request.url` also contains `localhost:3002`.

**Additionally:** `NextResponse.redirect()` requires an absolute URL. It would serialize the URL as `https://localhost:3002/en`, producing the same wrong Location header.

**Verdict:** REJECTED — does not solve the problem. Same broken origin as `request.nextUrl.clone()`.

---

### Strategy 4: Do Nothing / Keep `/en` Only

**Approach:** Accept that `https://staging.ainow.biz` does not work and require users to navigate directly to `https://staging.ainow.biz/en`.

**Why this does not satisfy 04I Path A:**

04I Path A requires:
> `https://staging.ainow.biz` → browser follows redirect → lands on `https://staging.ainow.biz/en`

The root URL is the primary public entry point. Users and testers will type `staging.ainow.biz` in their browser. If the root doesn't work, the staging deployment is not functionally ready.

04I cannot pass without Path A. 04 cannot pass without 04I. DEPLOYMENT-READINESS cannot advance without 04.

**Verdict:** REJECTED — does not satisfy acceptance criteria.

---

## 5. Strategy Comparison Summary

| Criterion | Strategy 1: Caddy `redir` | Strategy 2: Source fix | Strategy 3: `request.url` | Strategy 4: Do nothing |
|---|---|---|---|---|
| Solves root redirect | **YES** | Possibly | NO | NO |
| Blast radius | **Smallest** — 1 file (Caddyfile) | Medium — source + build + deploy + restart | N/A — doesn't work | N/A |
| Source code change | **None** | Yes | Yes | None |
| Build/deploy needed | **No** | Yes | Yes | No |
| PM2 restart needed | **No** | Yes | Yes | No |
| Git divergence impact | **None** | Worsens | Worsens | None |
| Rollback speed | **Seconds** — restore backup + reload | Minutes — revert + rebuild + redeploy + restart | N/A | N/A |
| Risk of 500 | **None** — Caddy `redir` is well-tested | Medium — 04I2A pattern risk | N/A | N/A |
| Satisfies 04I Path A | **YES** | Possibly | NO | NO |
| Depends on unverified behavior | **No** | Yes — `request.headers.get('host')` untested at staging | Yes — same broken origin | N/A |

---

## 6. Recommended Strategy

### **Strategy 1: Caddy Exact-Root Redirect — `redir / /en 307`**

**This is the recommended next fix.**

### Rationale

1. **It bypasses the root cause entirely.** The `request.nextUrl` origin issue in Next.js 15 is an architectural property of how middleware constructs URLs behind a reverse proxy. Rather than fighting this behavior with source code workarounds, the Caddy `redir` intercepts the root request before it reaches Next.js. The problem code path is never executed.

2. **Both previous fix attempts failed.** 04I2A (source fix) caused HTTP/2 500. 04I2B (Caddy header forwarding) had no effect. Strategy 1 takes a fundamentally different approach: it does not try to make the existing middleware code produce the right URL — it replaces the middleware's role for the root path entirely.

3. **Caddy `redir` is a first-class, well-tested Caddy v2 feature.** The `redir` directive with an exact path matcher and a relative target is one of the simplest Caddy operations. It does not depend on upstream behavior, header forwarding, or application internals.

4. **Caddy knows its own public hostname.** Caddy serves `staging.ainow.biz` with automatic HTTPS. When it issues a redirect, the `Location` header is correct by construction — it uses a relative URI `/en` that the browser resolves against the public origin.

5. **No source code change.** No build. No deploy. No PM2 restart. No git divergence. The fix is a single-line Caddyfile addition validated before reload.

6. **Immediate rollback.** If anything goes wrong, restore the timestamped Caddyfile backup and reload Caddy. Staging is back to the safe known failure state in seconds.

### Implementation Plan

**Prerequisites:** Keith explicit approval required before Caddy change.

1. Create timestamped Caddyfile backup.
2. Add `redir / /en 307` to the Caddyfile between the API handle block and the default handle block.
3. Run `sudo caddy validate --config /etc/caddy/Caddyfile`. Stop if validation fails.
4. Run `sudo systemctl reload caddy`. Confirm Caddy remains active.
5. Run validation command set from 04I2 runbook Section 18.
6. Confirm root `Location` is `/en` or `https://staging.ainow.biz/en` — NOT `https://localhost:3002/en`.
7. Browser validation by Keith (incognito window recommended).

### Rollback Plan

1. Restore Caddyfile from backup: `sudo cp /etc/caddy/Caddyfile.backup-04I2C-<TIMESTAMP> /etc/caddy/Caddyfile`
2. Validate: `sudo caddy validate --config /etc/caddy/Caddyfile`
3. Reload: `sudo systemctl reload caddy`
4. Confirm Caddy active and root returns old known failure (`Location: https://localhost:3002/en`).

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Caddyfile syntax error | LOW | `caddy validate` before reload; backup exists |
| `redir /` matches more than exact root | LOW | Caddy path matcher without wildcard is exact-match; route safety matrix verified above |
| API routes affected | NONE | `redir /` does not match `/api/*`; API handle block has higher path specificity |
| Caddy becomes inactive after reload | LOW | `systemctl reload caddy` is graceful; if Caddy fails, `systemctl status caddy` shows error; restore from backup |
| Non-blocking Caddyfile formatting warning | EXPECTED | Seen in 04H and 04I2B; non-blocking; acceptable |

---

## 7. Why Other Options Are Rejected or Deferred

### Strategy 2 — Deferred

- Not rejected — may be needed later for non-root locale redirects.
- Deferred because it has more blast radius, requires multi-step deployment, and worsens git divergence.
- The critical unknown (`request.headers.get('host')` return value at staging runtime) has not been verified.
- Register as a separate future task if non-root paths need fixing after root is resolved.

### Strategy 3 — Rejected

- Does not solve the problem. `request.url` shares the same broken `localhost:3002` origin as `request.nextUrl`.
- Would produce the exact same `Location: https://localhost:3002/en`.

### Strategy 4 — Rejected

- Does not satisfy 04I Path A.
- Blocks all downstream staging validation.

---

## 8. Main-vs-VPS Divergence Handling

### Current State

| Location | `frontend/middleware.ts` content | Git state |
|----------|--------------------------------|-----------|
| Local/main | 04I2A version: `new NextResponse(null, { status: 307, headers: { Location: '/en' } })` — commit 41b8603 | Clean (committed) |
| VPS | Original version: `request.nextUrl.clone()` — rolled back from 04I2A | Dirty: M `frontend/middleware.ts`, M `frontend/tsconfig.tsbuildinfo` |

### After Caddy Fix (Strategy 1)

| Location | `frontend/middleware.ts` content | Git state |
|----------|--------------------------------|-----------|
| Local/main | **UNCHANGED** — still 04I2A version (must be cleaned up) | Same |
| VPS | **UNCHANGED** — still original version | Same dirty state |
| VPS Caddy | NEW — has `redir / /en 307` directive | Caddyfile is not in git |

### Required Cleanup Sequence (after Caddy fix succeeds)

1. **Revert 04I2A commit on local/main.** Run `git revert 41b8603` or `git revert HEAD` (if 41b8603 is HEAD) to restore `frontend/middleware.ts` to the original `request.nextUrl.clone()` version. This makes main match what VPS is running.

2. **Sync VPS with clean main.** After the revert commit, on VPS: `git pull` or `git checkout main -- frontend/middleware.ts frontend/tsconfig.tsbuildinfo`. This should resolve the dirty state.

3. **Rebuild frontend on VPS if needed.** After sync, rebuild and restart frontend if the source files changed. The Caddy `redir` ensures the root redirect works regardless of what the middleware does for `/`.

4. **Register non-root locale redirect cleanup.** The non-root locale redirect (lines 42–45) still uses `request.nextUrl.clone()` and would produce `localhost:3002` URLs for paths like `/some-page`. This is a separate non-critical task — staging users access `/en/*` directly.

This cleanup should be a separate bounded task after 04I2C is consolidated.

---

## 9. Proposed Next Action

### Immediate Next Step

Register **04I2C Step 3 — Caddy Exact-Root Redirect Implementation** as the implementation step.

**Scope:**
- Keith executes on VPS via AWS Lightsail browser SSH.
- Single Caddyfile edit: add `redir / /en 307`.
- `caddy validate` before reload.
- `systemctl reload caddy` after validation.
- Validation command set from 04I2 runbook Section 18.
- Browser validation by Keith.
- Evidence capture and return.

**Approval required:** Keith must approve before any Caddy change.

### After Implementation Succeeds

1. 04I2C Step 4 — Evidence review and consolidation.
2. 04I2 consolidation/checkpoint.
3. 04I1 consolidation/checkpoint.
4. Resume 04I browser smoke from Path A.
5. Separate cleanup task: revert 04I2A commit on main, sync VPS, address non-root locale redirect if needed.

---

## 10. Acceptance Criteria Verification

- [x] 04I2C strategy review file created (`docs/PRIVATE-BETA-STAGING-EXECUTION-04I2C-ROOT-REDIRECT-STRATEGY-REVIEW.md`).
- [x] 04I2A failure considered (Section 3.3, Section 4 Strategy 2 rationale).
- [x] 04I2B failure considered (Section 3.2, Section 4 Strategy 1 rationale).
- [x] Main-vs-VPS divergence considered (Section 8).
- [x] At least three fix strategies compared (four strategies in Section 4).
- [x] Recommended next strategy selected (Section 6 — Strategy 1: Caddy `redir / /en 307`).
- [x] Risks and rollback approach documented (Section 6).
- [x] No source code changed.
- [x] No runtime/server action occurred.
- [x] No env files opened/changed.
- [x] No Docker/PostgreSQL/Redis action occurred.
- [x] No git commit or push.

---

## 11. Safety / Non-Goal Verification

| Non-goal | Occurred? | Verdict |
|----------|-----------|---------|
| Source code changed | No | PASS |
| Runtime/server action | No | PASS |
| Env files opened/changed | No | PASS |
| Env values printed | No | PASS |
| SSH performed by Cursor | No | PASS |
| AWS CLI used by Cursor | No | PASS |
| Caddy edited/reloaded/restarted | No | PASS |
| PM2/systemd commands run | No | PASS |
| Docker/PostgreSQL/Redis actions | No | PASS |
| Tests/builds run | No | PASS |
| Accounts created | No | PASS |
| Login performed | No | PASS |
| AI execution triggered | No | PASS |
| Billing/payment execution triggered | No | PASS |
| Container workflow execution triggered | No | PASS |
| Google OAuth enabled or used | No | PASS |
| Secrets printed or pasted | No | PASS |
| git commit or push | No | PASS |
| Subagents used | No | PASS |

**Safety verification: ALL NON-GOALS RESPECTED.**

---

**End of strategy review.**

**Review created:** 2026-08-03
**Step 2 status:** Strategy Review COMPLETE.
**Recommended strategy:** Caddy `redir / /en 307` (Strategy 1).
**No SSH or AWS CLI/actions performed by Cursor.**
**No browser opened by Cursor.**
**No accounts created.**
**No env values printed.**
**No subagents used.**
**No source or migration files changed.**
**No git commit or push.**
