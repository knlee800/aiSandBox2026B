# PRIVATE-BETA-STAGING-EXECUTION-04I4 — Authenticated `/app` Locale Redirect Host Leakage

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I4
**Title:** Authenticated `/app` Locale Redirect Host Leakage
**Step:** 1 — Registration + Source Investigation
**Status:** ACTIVE — Step 1 COMPLETE (Registration + Investigation — 2026-08-04)
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04I
**Grandparent:** PRIVATE-BETA-STAGING-EXECUTION-04
**Author:** Cursor / Sonnet 4.6 (documentation and source investigation only — no source code changed — no runtime action)
**Date:** 2026-08-04

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I4 |
| Title | Authenticated `/app` Locale Redirect Host Leakage |
| Status | **ACTIVE — Step 1 COMPLETE (Registration + Investigation — 2026-08-04)** |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Root | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Registered | 2026-08-04 |
| Investigation file | This document |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4-CHECKPOINT.md` |

---

## 2. New Blocker — Path F Evidence

### Path E Result (PASS — recorded)

| Field | Value |
|---|---|
| Path E | PASS |
| Action | Login page loaded — login submitted — login success |
| Final URL | `https://staging.ainow.biz/en/app` |
| HTTPS lock | Valid |
| Localhost in URL | NO |
| Errors | NONE |
| Redirected to authenticated area | YES |

### Path F Result (BLOCKED — new blocker)

| Field | Value |
|---|---|
| Path F | **BLOCKED** |
| User opened | `https://staging.ainow.biz/app` |
| Observed redirect | `https://localhost:3002/en/app` |
| Browser URL bar | Shows `localhost:3002` |
| HTTPS lock | Invalid / unreachable |
| Localhost exposed | **YES — BLOCKER** |

**Effect:** Public staging must never expose `localhost` in any browser-visible redirect. `https://staging.ainow.biz/app` redirecting to `https://localhost:3002/en/app` is a P0 staging blocker identical in class to the earlier root redirect issue resolved by 04I2C.

---

## 3. Smoke Path Status After Path E/F

| Path | Status |
|---|---|
| Path A | PASS — `https://staging.ainow.biz` → `https://staging.ainow.biz/en` — HTTPS lock valid — no localhost |
| Path B | PASS — `https://staging.ainow.biz/en/login` loads — HTTPS lock valid — no localhost |
| Path C | PASS — `https://staging.ainow.biz/en/register` loads — HTTPS lock valid — no localhost |
| Path D | PASS — registration submitted — email verification confirmed working — 04I3/04I3A COMPLETE |
| Path E | **PASS** — login submitted — redirected to `https://staging.ainow.biz/en/app` — HTTPS lock valid — no localhost — no errors |
| Path F | **BLOCKED** — `https://staging.ainow.biz/app` redirected to `https://localhost:3002/en/app` — localhost exposed — new blocker |

---

## 4. Source Investigation

### 4.1 Files Read

| File | Purpose |
|---|---|
| `frontend/middleware.ts` | Primary redirect logic |
| `TASKS.md` | 04I history — 04I2A failure — 04I2C fix — 04I3/04I3A status |
| `TASKS_BACKLOG_FULL.md` | Status verification |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Phase context |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04I3-CHECKPOINT.md` | 04I3 context and Path D/E/F pending evidence |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04I3A-CHECKPOINT.md` | 04I3A fix context |

No env files, secret files, or runtime files were opened.

---

### 4.2 `frontend/middleware.ts` — Full Analysis

```typescript
// frontend/middleware.ts (current source — HEAD 40c43af)
const SUPPORTED_LOCALES = ['en', 'zh-TW', 'zh-CN'] as const;
const DEFAULT_LOCALE = 'en';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Skip API, _next, favicon, file extensions
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    hasFileExtension(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Already-localized paths pass through
  if (hasLocalePrefix(pathname)) {      // /en/*, /zh-TW/*, /zh-CN/*
    return NextResponse.next();
  }

  // 3. Root redirect: / → /en
  if (pathname === '/') {
    const url = request.nextUrl.clone();    // ← CLONES WITH localhost:3002 HOST
    url.pathname = `/${DEFAULT_LOCALE}`;
    return NextResponse.redirect(url);      // ← /en but host is localhost:3002
  }

  // 4. CATCH-ALL: any unlocalized path → /en/{pathname}
  const url = request.nextUrl.clone();      // ← CLONES WITH localhost:3002 HOST
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  return NextResponse.redirect(url);        // ← /en/app but host is localhost:3002
}
```

### 4.3 Code Path for `/app`

When `https://staging.ainow.biz/app` is requested:

1. **Caddy receives** `/app` on port 443 for `staging.ainow.biz`.
2. **Caddy checks rules in order:**
   - `redir / /en 307` — exact match for `/` — does NOT match `/app`
   - `/api/*` → `reverse_proxy 127.0.0.1:4000` — does NOT match `/app`
   - All other → `reverse_proxy 127.0.0.1:3002` — **matches** → forward to Next.js
3. **Caddy forwards `/app` to Next.js** at `localhost:3002` without forwarding `Host: staging.ainow.biz` or `X-Forwarded-Host: staging.ainow.biz`.
4. **Next.js receives** the request. `request.nextUrl` reflects the URL as seen by the Node.js process: `https://localhost:3002/app`.
5. **`middleware()` executes:**
   - `/app` does not start with `/api`, `/_next`, is not `/favicon.ico`, has no file extension → not skipped
   - `hasLocalePrefix('/app')` → `false` (not `/en`, `/zh-TW`, `/zh-CN`)
   - `pathname !== '/'`
   - Falls into **catch-all block (lines 38–42)**
   - `url = request.nextUrl.clone()` → `host = localhost:3002`, `pathname = /app`
   - `url.pathname = '/en/app'`
   - `url.search = ''`
   - Returns `NextResponse.redirect(url)` → **Location: `https://localhost:3002/en/app`**
6. **Browser follows redirect** to `https://localhost:3002/en/app` — sees `localhost:3002` in URL bar.

---

### 4.4 Why `localhost:3002` Appears

The root cause is identical to the original root redirect issue investigated in 04I1:

- Caddy's `reverse_proxy 127.0.0.1:3002` forwards requests to Next.js without sending `Host: staging.ainow.biz`.
- Next.js middleware `request.nextUrl` reflects the process-level request URL — host is `localhost:3002`.
- `request.nextUrl.clone()` produces an absolute URL with `host = localhost:3002`.
- `NextResponse.redirect(url)` uses this absolute URL as the Location header.
- Browser receives `Location: https://localhost:3002/en/app` and follows it.

The Caddy `redir / /en 307` rule (added in 04I2C) intercepts `/` **before** Next.js sees it, so Caddy itself issues the redirect using the correct public context. No `request.nextUrl.clone()` is ever called for `/` in deployed production because Caddy handles it first.

For `/app` (and all other unlocalized paths), no equivalent Caddy-level intercept exists, so the request reaches Next.js middleware where the host-leakage occurs.

---

### 4.5 Affected Route Scope

**The localhost leakage affects ALL unlocalized frontend routes** that pass through the catch-all block (lines 38–42) of `middleware.ts`:

| Route | Caddy Rule Covers? | Next.js Middleware Handles? | Localhost Exposed? |
|---|---|---|---|
| `/` | **YES** — `redir / /en 307` (04I2C) | No — intercepted at Caddy | **NO — FIXED** |
| `/app` | NO | YES — catch-all block | **YES — BLOCKER** |
| `/login` | NO | YES — catch-all block | YES (if accessed without `/en/`) |
| `/register` | NO | YES — catch-all block | YES (if accessed without `/en/`) |
| `/en/*` | NO | NO — locale-prefix pass-through | NO — not redirected |
| `/api/*` | YES — API proxy | No — skipped by middleware | NO |
| `/_next/*` | Proxied to Next.js | Skipped by middleware | NO |

In practice:
- Path B (`/en/login`) and Path C (`/en/register`) were both tested at their localized URLs — they PASSed because they already had `/en/` prefix.
- If a user navigates directly to `https://staging.ainow.biz/login` or `https://staging.ainow.biz/register` (without `/en/`), they would also receive `https://localhost:3002/en/login` in the browser.
- The `/app` route is the primary known unlocalized access pattern because the post-login redirect targets `/app` which is then followed by browser navigation.

---

### 4.6 Why 04I2C Fixed `/` But Not `/app`

04I2C added a Caddy-level exact-match redirect:

```caddy
redir / /en 307
```

This is a Caddy directive that fires before the `reverse_proxy` rule. Caddy itself issues the 307 redirect using its own public TLS context — so the Location header is `/en` (relative) and the browser completes the redirect to `https://staging.ainow.biz/en`.

04I2C did not add any rule for `/app`, `/login`, `/register`, or other unlocalized paths. The fix was intentionally scoped to `/` only.

---

### 4.7 Why 04I2A Failure Matters

04I2A attempted a source-level middleware fix (Option B):
- Changed the root redirect in `middleware.ts` from `request.nextUrl.clone()` to a relative Location (e.g., `/en`).
- Local TypeScript passed. Local lint passed.
- At staging runtime: **root returned HTTP/2 500**.
- Both `/` and `/` (no-slash) returned 500.
- `/en`, `/en/login`, `/en/register` remained 200 (they use the `hasLocalePrefix` pass-through path, not the redirect).
- Rollback was required. 04I2A was marked FAILED.

**Implications for 04I4:**

1. A source-level change to the middleware redirect logic is **demonstrably risky** at staging runtime. The catch-all block (lines 38–42) uses the same `request.nextUrl.clone()` pattern as the root redirect that caused the 500.

2. The exact reason for the 500 was not fully diagnosed. Possible causes:
   - Next.js 15.x does not accept relative strings in `NextResponse.redirect()` (requires a `URL` object or absolute string).
   - The relative URL (`/en`) was valid at the middleware API level but produced an invalid response at the underlying HTTP layer for the specific version deployed.
   - The HTTPS/Caddy TLS termination context created a mismatch when a relative redirect was returned from middleware.

3. The source fix approach for the catch-all block carries the same 500 risk, even though the root `/` case and the catch-all case are slightly different code paths.

4. 04I2B (Caddy forwarded header correction) also FAILED — forwarding `X-Forwarded-Host` and `X-Forwarded-Proto` did not change the behavior; Location still contained `localhost:3002/en`.

5. The only confirmed working fix pattern is the **Caddy-level redirect intercept** used in 04I2C (`redir / /en 307`).

---

## 5. Fix Options

### Option 1 — Caddy Exact-Path Redirects for Known Unlocalized Routes (SAFEST)

Add specific Caddy redirects for each known unlocalized frontend route, modeled exactly on the 04I2C fix:

```caddy
redir /app /en/app 307
redir /login /en/login 307
redir /register /en/register 307
```

**How:** Add these lines to the Caddyfile `staging.ainow.biz` block, before the `reverse_proxy` catch-all.

**Risks:**
- LOW — identical approach to the confirmed-working 04I2C fix.
- Caddy syntax validated by prior success.
- Requires Caddy reload (`sudo systemctl reload caddy` or `caddy reload`).
- Keith must approve Caddy edit before any runtime action.

**Limitations:**
- Does not scale: any future frontend route added (e.g., `/dashboard`, `/settings`, `/admin`) accessed without locale prefix would exhibit the same issue and require another Caddy rule addition.
- Does not fix the underlying middleware host-leakage — it bypasses it for known paths.

**Coverage:** Fixes `/app`, `/login`, `/register` localhost redirect immediately.

---

### Option 2 — Caddy Path Regexp Redirect for All Unlocalized Paths (COMPREHENSIVE)

Add a single Caddy regexp matcher that catches all unlocalized paths and redirects them to `/en/{path}`:

```caddy
@unlocalized path_regexp nolocale ^/(?!(api|_next|en|zh-TW|zh-CN)(/|$))
redir @unlocalized /en{path} 307
```

**How:** Add this matcher+redirect block before the API and frontend `reverse_proxy` rules.

**Risks:**
- MEDIUM — Caddy regexp matchers are standard but the regex must be carefully constructed.
- Must be placed above the `reverse_proxy` rules but below the explicit `redir / /en 307` to avoid double-processing root.
- If the regex is misconfigured, it could inadvertently redirect API or Next.js system routes.
- Caddy `{path}` placeholder behavior must be verified for this Caddy version (v2.11.4).
- Requires careful review and Keith approval before any runtime action.

**Limitations:**
- More complex Caddy config than Option 1.
- Harder to reason about edge cases in regex without live validation.

**Benefits:**
- Fixes ALL current and future unlocalized paths at once.
- No need to enumerate routes.
- Still a Caddy-only fix — does not touch Next.js source.

---

### Option 3 — Source-Level Middleware Redirect Fix (HIGHEST RISK)

Change `frontend/middleware.ts` catch-all block to use a host-safe redirect. Example approaches:

**3a — Read `x-forwarded-host` header:**
```ts
const forwardedHost = request.headers.get('x-forwarded-host');
const proto = request.headers.get('x-forwarded-proto') ?? 'https';
if (forwardedHost) {
  const url = new URL(`${proto}://${forwardedHost}/${DEFAULT_LOCALE}${pathname}`);
  url.search = search;
  return NextResponse.redirect(url);
}
// fallback: relative redirect
return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}`, request.url));
```

**3b — Use `NEXT_PUBLIC_APP_URL` env var:**
```ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (appUrl) {
  return NextResponse.redirect(`${appUrl}/${DEFAULT_LOCALE}${pathname}${search}`);
}
```

**Risks:**
- **HIGH** — 04I2A demonstrated that source-level middleware redirect changes can cause HTTP/2 500 at staging.
- Requires Caddy to forward `X-Forwarded-Host` (04I2B showed this alone did not fix the issue).
- Requires: local build → git push → VPS git pull → npm ci → npm run build → pm2 restart.
- Any staging runtime failure requires immediate rollback.
- Root is already handled by Caddy's `redir / /en 307` — so the change would only apply to the catch-all block; the risk of 500 may be lower than 04I2A (which changed the root path), but this is unconfirmed.

**Benefits:**
- Fixes all routes at the source level.
- Does not require enumerating Caddy rules.
- More correct long-term architecture.

---

### Option 4 — Hybrid: Option 1 Immediate + Option 2 or 3 Planned

1. Apply Option 1 (exact Caddy redirects for `/app`) immediately as the minimal blocking fix.
2. Register a follow-up task to evaluate Option 2 (Caddy regexp) or Option 3 (middleware) as a complete solution.

**Benefits:** Unblocks Path F smoke immediately with minimal risk. Defers the architectural decision about general redirect handling.

---

## 6. Risk Summary

| Option | Risk | Confirms Working Pattern? | Fixes All Routes? | Runtime Action? |
|---|---|---|---|---|
| 1 — Caddy exact redirects | LOW | YES (same as 04I2C) | NO (known routes only) | YES — Caddy reload required |
| 2 — Caddy regexp redirect | MEDIUM | Untested pattern | YES | YES — Caddy reload required |
| 3 — Source middleware fix | HIGH | 04I2A shows risk | YES | YES — VPS build + pm2 restart |
| 4 — Hybrid (Option 1 now) | LOW (immediate) | YES (same as 04I2C) | Partial now, full later | YES — Caddy reload required |

---

## 7. Recommendation

**Recommended fix: Option 4 — Hybrid.**

Immediate step: Apply **Option 1** (`redir /app /en/app 307` in Caddy). This is the minimum-risk approach, modeled exactly on the 04I2C fix that is proven to work. It unblocks Path F immediately.

Concurrent evaluation: Register **Option 2** (Caddy regexp) as the comprehensive solution in the same implementation task. If Caddy regexp matcher syntax is verified safe for Caddy v2.11.4, apply it alongside Option 1 to cover all current and future unlocalized paths.

Do NOT attempt Option 3 (source-level middleware fix) unless:
- Options 1 and 2 are both considered unacceptable, AND
- A local test environment can verify the specific Next.js behavior at staging runtime, AND
- Keith explicitly approves the risk of another possible staging HTTP 500.

---

## 8. Recommended Next Implementation Task

**Register: PRIVATE-BETA-STAGING-EXECUTION-04I4A — Caddy Unlocalized-Path Redirect Fix**

Scope:
1. Caddy-only fix (no source code changes).
2. Add `redir /app /en/app 307` to the `staging.ainow.biz` Caddyfile block (minimum).
3. Evaluate and optionally add Caddy regexp rule for all unlocalized paths.
4. Require Keith approval before any Caddy edit.
5. Run health validation after Caddy reload.
6. Run Path F browser smoke (`https://staging.ainow.biz/app` → `https://staging.ainow.biz/en/app`).
7. Confirm no localhost in redirect.

Acceptance criteria for fix task:
- `https://staging.ainow.biz/app` redirects to `https://staging.ainow.biz/en/app` (not `localhost:3002/en/app`).
- HTTPS lock valid.
- No localhost visible in browser URL bar.
- All prior passing checks (Path A/B/C/D/E) remain PASS.
- API health/db/ready remain 200.
- No source code changed.

---

## 9. Boundary Conditions and Safety

This document is investigation-only. The following did not occur:

- ✅ No source code changed
- ✅ No `.env*` files opened or changed
- ✅ No runtime/server action taken
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No email sent
- ✅ No account/login/AI/billing/container/OAuth action
- ✅ No git commit or push
- ✅ No subagents used

---

## 10. Prior Task History Relevant to 04I4

| Task | Outcome | Relevance to 04I4 |
|---|---|---|
| 04I1 | Root redirect investigation — INVESTIGATION PASS — ROOT BEHAVIOR FAILS | Same root cause: `request.nextUrl.clone()` leaks `localhost:3002` as host |
| 04I2A | Option B source middleware fix — FAILED — HTTP 500 at staging | Demonstrates source fix risk for middleware redirect changes |
| 04I2B | Option A Caddy forwarded header fix — FAILED — Location still localhost | Caddy header forwarding alone does not fix the issue |
| 04I2C | Caddy exact-root redirect `redir / /en 307` — **PASS** | Proven fix pattern for exact-path Caddy redirect |
| 04I2D | Local source reconciliation — PASS — middleware.ts restored | Current middleware.ts is clean at HEAD 40c43af |
| 04I2E | VPS sync — PASS — Caddy `redir / /en 307` preserved | VPS is at HEAD 40c43af — Caddy root redirect active |
| 04I3/04I3A | Email verification fix — COMPLETE and LOCKED | Not directly related — different blocker resolved |

---

## 11. Current Task and Phase Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04I4 | **ACTIVE — Step 1 COMPLETE (Registration + Investigation — 2026-08-04)** |
| PRIVATE-BETA-STAGING-EXECUTION-04I3 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I3A | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I | ACTIVE — BLOCKED by 04I4 — Path F localhost redirect blocker |
| PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED — pending 04I and parent 04 completion |

---

## 12. Next Recommended Action

Implement PRIVATE-BETA-STAGING-EXECUTION-04I4A — Caddy Unlocalized-Path Redirect Fix.

Use the 3-step loop:
1. Registration — record scope, approval requirement, safety guardrails.
2. Implementation — Keith approval → Caddy edit → Caddy reload → SSH validation.
3. Consolidation/checkpoint — evidence review → mark COMPLETE and LOCKED → resume 04I Path F.
