# PRIVATE-BETA-BLOCKER-03G — Stage Start / Routing Design + Provider-Free Validation Plan

**Task ID:** PRIVATE-BETA-BLOCKER-03G
**Title:** Frontend Confirm-Build-Apply Route Reachability
**Status:** Step 2 — Stage Start / Routing Design + Provider-Free Validation Plan — COMPLETE — 2026-08-15
**Family:** PRIVATE-BETA-BLOCKER-03 / BUILDER EXECUTION RELIABILITY / FRONTEND ROUTING REACHABILITY
**Workflow:** HIGH-RISK 4-STEP
**Author:** Cursor / Opus 4.6 (read-only analysis + governance — no source modification — no runtime mutation — no provider call — no balance mutation — no deployment)

---

## 1. Task / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03G |
| Title | Frontend Confirm-Build-Apply Route Reachability |
| Status | Step 2 COMPLETE — 2026-08-15 |
| Workflow | HIGH-RISK 4-STEP |
| Step 1 | Registration — COMPLETE — 2026-08-15 |
| Step 2 | Stage Start / Routing Design + Provider-Free Validation Plan — COMPLETE — 2026-08-15 |
| Step 3 | Bounded Implementation + Tests + Provider-Free Staging Deployment/Verification — PENDING / READY |
| Step 4 | Consolidation / Checkpoint — PENDING |

---

## 2. Root Cause

**Classification:** FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER

The browser-facing Next.js route at `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` exists in source and build output but is unreachable at runtime because the broad `/api/:path*` Gateway rewrite in `next.config.js` intercepts the request before the dynamic App Router route is resolved.

The request path:

```
browser → POST /api/ai/executions/:executionId/confirm-build-apply
→ Next.js receives request
→ rewrites check: source '/api/:path*' matches
→ destination: http://localhost:4000/api/ai/executions/:executionId/confirm-build-apply
→ API Gateway (Nest) receives request
→ no public route at that path → 404
```

Expected path (after fix):

```
browser → POST /api/ai/executions/:executionId/confirm-build-apply
→ Next.js receives request
→ dynamic route resolution: app/api/ai/executions/[executionId]/confirm-build-apply/route.ts
→ route.ts POST handler → proxyConfirmBuildApply()
→ session validation → 401 (unauthenticated) or authenticated flow
```

---

## 3. Exact Next.js Version

| Environment | Next.js Version | Evidence |
|-------------|-----------------|----------|
| Local (package.json) | `^15.1.3` (semver range) | `frontend/package.json` line 22 |
| Local (installed) | **15.5.12** | `node -e "console.log(require('next/package.json').version)"` → `15.5.12` |
| Staging (installed) | **15.5.12** | SSH: `head -3 /opt/aisandbox/node_modules/next/package.json` → `"version": "15.5.12"` |

**NEXT_VERSION=15.5.12**

---

## 4. Current Rewrite Behavior

### 4.1 Exact Rewrite Configuration

`frontend/next.config.js` lines 9-17:

```js
async rewrites() {
    const apiBase = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
```

### 4.2 Rewrite Mode Classification

**CURRENT_REWRITE_MODE=flat array**

The `rewrites()` function returns a flat array (not a `{ beforeFiles, afterFiles, fallback }` object).

Per Next.js 15 official documentation:

> When the `rewrites` function returns an array, rewrites are applied **after checking the filesystem** (pages and `/public` files) **and before dynamic routes**.

A flat array is equivalent to `afterFiles` rewrites (step 6 in the Next.js routing precedence chain).

### 4.3 Next.js 15 Routing Precedence Chain

Official order from [Next.js 15 docs](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/rewrites):

| Step | Phase | Description |
|------|-------|-------------|
| 1 | headers | `next.config.js` headers checked/applied |
| 2 | redirects | `next.config.js` redirects checked/applied |
| 3 | middleware | Middleware executed |
| 4 | beforeFiles | `beforeFiles` rewrites checked/applied |
| 5 | filesystem | Static files from `public/`, `_next/static`, and **non-dynamic pages** checked/served |
| 6 | afterFiles | `afterFiles` rewrites checked/applied (flat array lives here) — **"if one of these rewrites is matched we check dynamic routes/static files after each match"** |
| 7 | fallback | Fallback rewrites — **"applied before rendering the 404 page and after dynamic routes/all static assets have been checked"** |

### 4.4 Why the Confirm Route Is Intercepted

**WHY_CONFIRM_ROUTE_IS_REWRITTEN:**

The `confirm-build-apply` route file is at:

```
frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts
```

This route contains a **dynamic segment** `[executionId]`. In Next.js 15 routing precedence, dynamic routes are resolved AFTER `afterFiles` rewrites (step 6).

The flat-array rewrite `/api/:path*` → `http://localhost:4000/api/:path*` operates at step 6. When the source pattern matches, the destination is an **external URL** (proxied to Gateway). External URL rewrites are proxied directly — Next.js does not check whether the path also matches a dynamic filesystem route.

Therefore:

1. Step 5: `/api/ai/executions/xxx/confirm-build-apply` is NOT a non-dynamic page → no match
2. Step 6: Source `/api/:path*` matches → destination `http://localhost:4000/api/...` is external → **proxied to Gateway immediately**
3. The dynamic route at `app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` is **never checked** because the external rewrite captured first

### 4.5 Middleware Is Not the Cause

The middleware explicitly passes through `/api` paths:

```ts
if (pathname.startsWith('/api')) {
    return NextResponse.next();
}
```

The middleware matcher also excludes `/api`:

```ts
matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
```

---

## 5. Current Staging Runtime Reproduction

### 5.1 Confirm Route Probe

**Request:**

```
POST http://localhost:3002/api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply
(no authentication, no body)
```

**Response:**

```
HTTP/1.1 404 Not Found
x-powered-by: Express
```

```json
{"message":"Cannot POST /api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply","error":"Not Found","statusCode":404}
```

**Fingerprint:** `x-powered-by: Express` + NestJS error format `{"message":..., "error":..., "statusCode":...}` confirms the response is from **API Gateway (Nest)**, NOT from Next.js.

**Expected Next.js response (after fix):** HTTP 401 with `{"error":"unauthenticated"}` — Next.js App Router response format (no `x-powered-by: Express`, no NestJS error shape).

### 5.2 Gateway-Proxied Baseline

**Request:**

```
GET http://localhost:3002/api/auth/me
(no authentication)
```

**Response:**

```
HTTP/1.1 401 Unauthorized
x-powered-by: Express
set-cookie: aisandbox_csrf=...
content-type: application/json; charset=utf-8
```

```json
{"message":"Authentication required","error":"Unauthorized","statusCode":401}
```

**Fingerprint:** `x-powered-by: Express` + NestJS error format confirms Gateway proxy is working correctly.

This becomes the regression baseline — after Step 3 fix, this response MUST remain identical.

### 5.3 Summary

| Probe | Through | Response From | Status | Expected After Fix |
|-------|---------|---------------|--------|-------------------|
| POST confirm-build-apply | frontend:3002 | API Gateway (Nest) | **404** — BROKEN | Next.js 401 `{"error":"unauthenticated"}` |
| GET /api/auth/me | frontend:3002 | API Gateway (Nest) | **401** — CORRECT | Same 401 (regression check) |

---

## 6. Existing Frontend API Route Map

### 6.1 All Local Next.js API Routes

Filesystem scan of `frontend/app/api/**/route.ts`:

| Route File | HTTP Method | Dynamic Segment |
|-----------|-------------|-----------------|
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | POST | `[executionId]` |

**This is the ONLY local Next.js API route under `app/api/`.**

### 6.2 Answers to Routing Questions

| Question | Answer |
|----------|--------|
| Is confirm-build-apply the only local `/api` route affected? | **YES** — it is the only local API route |
| Are other local Next routes currently unreachable for the same reason? | **NO** — no other local API routes exist |
| Are any existing exceptions already implemented? | **NO** — no exceptions in current config |
| Does changing rewrite behavior risk altering other application routes? | **NO** — only this route exists; `fallback` preserves Gateway proxy for all non-local routes |

---

## 7. Evaluated Fix Options

### OPTION A — Explicit Exclusion from Gateway Rewrite

**Mechanism:** Add an identity rewrite for the confirm route before the broad rewrite, or use `has`/`missing` conditions to exclude it.

Example:

```js
return [
  {
    source: '/api/ai/executions/:executionId/confirm-build-apply',
    destination: '/api/ai/executions/:executionId/confirm-build-apply',
  },
  {
    source: '/api/:path*',
    destination: `${apiBase}/api/:path*`,
  },
];
```

| Criterion | Assessment |
|-----------|-----------|
| Framework correctness | UNCERTAIN — identity rewrite with dynamic segment at afterFiles phase may not reliably resolve to the dynamic App Router route |
| Effect on existing Gateway API proxy | None — broad rewrite unchanged |
| Effect on local Next routes | Only this route excluded |
| Security impact | None |
| Testability | Requires runtime verification |
| Rollback simplicity | Simple — remove the exclusion entry |
| Scope/Risk | LOW scope, MEDIUM risk — the identity rewrite behavior with dynamic segments and external destination ordering is not well-documented |

**Verdict:** Fragile. Does not generalize to future local API routes. Uncertain framework behavior.

### OPTION B — Structured Next.js Rewrite Phases: `fallback`

**Mechanism:** Change the `rewrites()` return from a flat array to a structured object, placing the Gateway proxy in the `fallback` phase.

```js
async rewrites() {
    const apiBase = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${apiBase}/api/:path*`,
        },
      ],
    };
  },
```

Per Next.js 15 docs, `fallback` rewrites are checked **"after dynamic routes/all static assets have been checked"** — step 7 in the routing chain.

The official docs include an **exact canonical example** of this pattern for proxy fallback:

> **Incremental adoption of Next.js:**
> You can also have Next.js fall back to proxying to an existing website after checking all Next.js routes.
>
> ```js
> return { fallback: [{ source: '/:path*', destination: `https://custom-routes-proxying-endpoint.vercel.app/:path*` }] }
> ```

| Criterion | Assessment |
|-----------|-----------|
| Framework correctness | **YES** — official documented pattern for proxy fallback; canonical Next.js recommendation |
| Effect on existing Gateway API proxy | **PRESERVED** — all routes without a local Next.js handler continue to reach Gateway |
| Effect on local Next routes | **FIXED** — dynamic App Router routes are resolved BEFORE the fallback |
| Security impact | **NONE** — no new endpoint, no auth change, no key exposure |
| Testability | **HIGH** — deterministic unit test of config shape + staging HTTP probes |
| Rollback simplicity | **SIMPLE** — change `return { fallback: [...] }` back to `return [...]` |
| Scope/Risk | **MINIMAL** — 2 lines changed in `next.config.js`; zero production route/proxy code changes |

**Verdict:** Correct, minimal, canonical, and generalizable.

### OPTION C — Narrower Gateway Rewrite Patterns

**Mechanism:** Replace `/api/:path*` with explicit patterns like `/api/auth/:path*`, `/api/sessions/:path*`, etc.

| Criterion | Assessment |
|-----------|-----------|
| Framework correctness | Correct if all patterns are enumerated |
| Effect on existing Gateway API proxy | FRAGILE — any new Gateway endpoint requires a config update |
| Effect on local Next routes | Fixed for excluded routes |
| Testability | Requires comprehensive enumeration verification |
| Rollback simplicity | Moderate — multiple patterns to revert |
| Scope/Risk | HIGH — broad pattern enumeration, easy to miss routes |

**Verdict:** Fragile, high maintenance burden, does not scale.

### OPTION D — Route-Path Relocation

**Mechanism:** Move the confirm-build-apply route to a non-`/api` prefix to avoid the rewrite entirely.

| Criterion | Assessment |
|-----------|-----------|
| Framework correctness | Correct |
| Effect on existing Gateway API proxy | None |
| Effect on local Next routes | Requires changing the public URL |
| Testability | Requires updating all 03D-B tests and implementation references |
| Rollback simplicity | Complex — URL change affects frontend + existing tests |
| Scope/Risk | HIGH — changes registered public API; requires updating proxy code, route code, frontend caller, and test assertions |

**Verdict:** Unnecessary disruption. Only evaluated as last resort.

---

## 8. Selected Fix and Rationale

**SELECTED_FIX:** OPTION B — Move Gateway rewrite from flat array to `fallback` phase

### 8.1 Exact Change

**File:** `frontend/next.config.js`

**Before (current):**

```js
async rewrites() {
    const apiBase = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
```

**After (fix):**

```js
async rewrites() {
    const apiBase = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${apiBase}/api/:path*`,
        },
      ],
    };
  },
```

### 8.2 Rationale

1. The `fallback` phase runs AFTER dynamic routes are resolved — the confirm-build-apply App Router route (with dynamic `[executionId]`) is matched first.
2. Routes without a local Next.js handler fall through to the Gateway proxy — all existing API routes continue to work.
3. This is the **official Next.js canonical pattern** for proxy fallback ("Incremental adoption of Next.js" example in docs).
4. **Two lines changed** in a single config file. Zero production route or proxy code changes.
5. No Gateway source changes required.
6. No new public privileged endpoint.
7. `INTERNAL_SERVICE_KEY` remains server-only (no change to proxy or route code).
8. Easy deterministic test — config shape unit test + staging HTTP probes.
9. Easy rollback — revert `{ fallback: [...] }` back to `[...]`.
10. No broad routing redesign — same rewrite rule, different phase.

---

## 9. Expected Source Files

### 9.1 Production

| File | Change Type | Description |
|------|------------|-------------|
| `frontend/next.config.js` | MODIFY | Change `return [...]` to `return { fallback: [...] }` |

**No other production source files modified.**

### 9.2 Test (if added)

| File | Change Type | Description |
|------|------------|-------------|
| `frontend/lib/next-config-rewrites.test.ts` | NEW (optional) | Config shape validation: verify rewrites() returns `{ fallback: [...] }` not flat array |

### 9.3 Files NOT Changed

| File | Why |
|------|-----|
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | Route code is correct — only config routing is broken |
| `frontend/lib/build-apply-confirm-proxy.server.ts` | Proxy code is correct |
| `frontend/app/[locale]/app/page.tsx` | Frontend caller is correct |
| `frontend/components/workspace/workspace-ai-file-actions.logic.ts` | Qualification logic is correct |
| `services/api-gateway/src/**` | No Gateway changes |
| `frontend/middleware.ts` | Middleware already passes `/api` through correctly |
| `frontend/messages/*.json` | No user-facing text changes |

**EXPECTED_FILES_TO_CHANGE:** `frontend/next.config.js` (production); optionally `frontend/lib/next-config-rewrites.test.ts` (test)

---

## 10. NEXT_CONFIG_ONLY_FIX

**NEXT_CONFIG_ONLY_FIX=YES**

The fix requires modifying ONLY `frontend/next.config.js`. The existing route handler (`route.ts`) and server proxy (`build-apply-confirm-proxy.server.ts`) are correct — they were never reached due to the rewrite interception. Changing the rewrite phase from `afterFiles` (flat array) to `fallback` (structured object) makes the dynamic route reachable without modifying any production route or proxy code.

---

## 11. Security Impact

| Security Concern | Assessment |
|-----------------|------------|
| New public endpoint | **NO** — same existing Next.js route |
| Auth/session change | **NO** — session cookie validation unchanged |
| `INTERNAL_SERVICE_KEY` exposure risk | **NO** — key remains server-env-only; no code change to proxy |
| Browser bundle exposure | **NO** — no code change to client-side code |
| Gateway guard change | **NO** — Gateway source untouched |
| Ownership validation change | **NO** — proxy code unchanged |
| CSRF behavior change | **NO** — config change only |

**The fix is purely a routing-phase configuration change with zero security surface expansion.**

---

## 12. Gateway Routing Preservation

### 12.1 Requirement

All existing API routes that the broad `/api/:path*` rewrite currently proxies to the Gateway must continue to reach the Gateway after the fix.

### 12.2 Design

With `fallback` phase:
- Any request matching `/api/:path*` that does NOT match a local Next.js filesystem or dynamic route → falls through to the fallback → proxied to Gateway (same as current behavior)
- Any request matching `/api/:path*` that DOES match a local Next.js route → handled by Next.js (new behavior for confirm-build-apply only)

Since confirm-build-apply is the **only** local Next.js API route, **all other `/api/*` requests continue to reach the Gateway identically.**

### 12.3 Specific Routes Preserved

| Route Example | Current Behavior | After Fix |
|--------------|-----------------|-----------|
| `/api/auth/me` | Gateway 401 | **Same** — no local route, fallback proxy |
| `/api/sessions/:id/...` | Gateway | **Same** — no local route, fallback proxy |
| `/api/ai/executions/:id` | Gateway | **Same** — no local route at this exact path, fallback proxy |
| `/api/ai/executions/:id/confirm-build-apply` | Gateway 404 (**broken**) | **Next.js route** (**fixed**) |
| `/api/health` | Gateway 200 | **Same** — no local route, fallback proxy |
| `/api/internal/...` | Gateway | **Same** — no local route, fallback proxy |

---

## 13. Test Plan

### Test 1 — Configuration Shape (unit test)

**Purpose:** Verify `next.config.js` rewrites() returns a structured `{ fallback: [...] }` object, not a flat array.

**Method:** Import next.config.js, call rewrites(), assert return value has `fallback` property with the expected source/destination.

**Coverage:** Proves the rewrite is in the fallback phase, not afterFiles.

### Test 2 — Gateway Proxy Preservation (staging HTTP probe)

**Purpose:** Prove `/api/auth/me` through frontend still reaches Gateway.

**Method:** `curl -s -w '\nHTTP_STATUS:%{http_code}' http://localhost:3002/api/auth/me`

**Expected:** HTTP 401 with NestJS error format: `{"message":"Authentication required","error":"Unauthorized","statusCode":401}` and `x-powered-by: Express`.

### Test 3 — Route Behavior: Unauthenticated 401 (staging HTTP probe + existing unit tests)

**Purpose:** Prove unauthenticated confirm request returns Next.js 401 `{"error":"unauthenticated"}`.

**Method:**

Staging probe:
```
POST http://localhost:3002/api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply
(no session cookie)
```

Expected: HTTP 401 with `{"error":"unauthenticated"}` and **NO** `x-powered-by: Express` header (confirming it's from Next.js, not Gateway).

Existing unit tests: `frontend/lib/build-apply-confirm-proxy.server.test.ts` — test "unauthenticated requests are rejected without calling confirm-build-apply" → asserts status 401.

### Test 4 — Ownership/Session Behavior (existing unit tests)

**Purpose:** Prove ownership validation remains intact.

**Method:** Existing `build-apply-confirm-proxy.server.test.ts` tests cover:
- Authenticated owner + valid payload → 200 with triggered
- Different-user execution → 404 without calling internal endpoint
- Arbitrary executionId cannot bypass ownership → 404
- Internal key added server-side, never returned

All existing tests must remain PASS.

### Test 5 — Secret Boundary (build-time + existing tests)

**Purpose:** Prove `INTERNAL_SERVICE_KEY` value does not appear in browser/static bundle.

**Method:**
- Staging: `grep -r 'INTERNAL_SERVICE_KEY' /opt/aisandbox/frontend/.next/static/` → expected 0 matches
- Existing unit test: "server helper reads INTERNAL_SERVICE_KEY from env and never NEXT_PUBLIC" — asserts source files do not contain `NEXT_PUBLIC_INTERNAL_SERVICE_KEY` and do use `process.env.INTERNAL_SERVICE_KEY`

### Test Dependencies

**No new test dependencies required.** The config shape test can use Node.js built-in `assert` and `test` modules, same as existing test infrastructure.

---

## 14. Local Step 3 Implementation Plan

### Phase A — Implement Selected Frontend Routing Fix

1. Modify `frontend/next.config.js`: change `return [...]` to `return { fallback: [...] }`
2. Optionally add `frontend/lib/next-config-rewrites.test.ts` for config shape validation

### Phase B — Targeted Tests

1. Run existing proxy tests: `tsx --test lib/build-apply-confirm-proxy.server.test.ts`
2. Run new config test if added
3. Run existing file-action tests

### Phase C — Frontend Typecheck/Build

1. `npx tsc --noEmit` — must PASS
2. `npm run build` — must PASS
3. Build output must include `confirm-build-apply` route
4. `INTERNAL_SERVICE_KEY` must have 0 matches in `.next/static/`

### Phase D — Local Diff/Scope Verification

1. `git diff --stat` — only expected files changed
2. `git diff --unified=3 -- frontend/next.config.js` — exactly the expected 2-line change
3. No Gateway source changes
4. No unrelated source changes

### Phase E — STOP for Keith Git Checkpoint/Push

**Keith performs git commit/push manually.** Cursor must never push.

Implementation must STOP here if the commit is not yet on origin.

### Phase F — Staging Pre-Deploy Safety/Revision Checks

1. Verify staging at expected pre-deployment SHA
2. Verify `GLOBAL_EXECUTION_ENABLED=false`
3. Verify `BILLING_CHARGES_ENABLED=false`
4. Verify PM2 processes online

### Phase G — Deploy Exact Implementation SHA

1. SSH to staging
2. `git fetch origin && git reset --hard <implementation-sha>`
3. Verify HEAD matches

### Phase H — Clean Frontend Build

1. `cd /opt/aisandbox/frontend && rm -rf .next/ && npm run build`
2. Verify build PASS
3. Verify confirm route in build output
4. Verify `INTERNAL_SERVICE_KEY` absent from `.next/static/`

### Phase I — Restart Only aisandbox-frontend

1. `pm2 restart aisandbox-frontend`
2. Wait for stabilization
3. Verify online

**No Gateway restart.** No AI Service restart. No Container Manager restart.

### Phase J — Provider-Free Confirm-Route Runtime Proof

1. Unauthenticated POST through frontend: `/api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply`
2. Expected: HTTP 401 `{"error":"unauthenticated"}` from Next.js (NOT Nest 404)
3. Response must NOT contain `x-powered-by: Express`

### Phase K — Gateway Proxy Regression Proof

1. `curl http://localhost:3002/api/auth/me`
2. Expected: HTTP 401 `{"message":"Authentication required",...}` with `x-powered-by: Express`
3. Must match pre-fix baseline exactly

### Phase L — Security/Static-Bundle Proof

1. `grep -r 'INTERNAL_SERVICE_KEY' /opt/aisandbox/frontend/.next/static/` → 0 matches
2. Internal keys present and matching in env

### Phase M — Final Safety/Health Verification

1. `GLOBAL_EXECUTION_ENABLED=false`
2. `BILLING_CHARGES_ENABLED=false`
3. All PM2 processes online
4. Frontend health: HTTP 307
5. Gateway health: HTTP 200

### Recommended Step 3 Model

**Grok 4.6 High** — the fix is well-defined, bounded, and frontend-only. No XHigh needed.

---

## 15. Git / Manual Checkpoint Boundary

| Field | Value |
|-------|-------|
| Local HEAD (current) | `365985937025dd26c35bfdbb754b0be378bc0b58` |
| Local uncommitted changes | `M TASKS.md`, `M TASKS_BACKLOG_FULL.md` (Step 1 registration edits) |
| Staging SHA (current) | `ed34e3c220c04c81ec6784f43e8952a60f537825` |
| Staging worktree | CLEAN |

**Rule:** Keith handles git commit/push manually. Cursor must never push.

Step 3 must include a **STOP point** after local implementation/tests (Phase D) but **BEFORE staging deployment** (Phase F). At that point, Keith performs the git commit/push as separately instructed.

Step 3 deployment (Phase G) must use an exact immutable commit SHA that has been pushed to origin. Do not deploy uncommitted local source.

---

## 16. Staging Deployment Target Mechanics

| Field | Value |
|-------|-------|
| Pre-deployment staging SHA | `ed34e3c220c04c81ec6784f43e8952a60f537825` |
| Deployment mechanism | `git fetch origin && git reset --hard <implementation-sha>` |
| Services requiring rebuild | **Frontend ONLY** |
| Services requiring restart | **Frontend ONLY** (`pm2 restart aisandbox-frontend`) |
| Services NOT touched | API Gateway, AI Service, Container Manager, Ops Watchdog |
| npm install required | **NO** — no dependency changes |
| Migration required | **NO** — no schema changes |
| New env vars required | **NO** — existing vars unchanged |

---

## 17. Rollback Target and Commands

**ROLLBACK_TARGET=ed34e3c220c04c81ec6784f43e8952a60f537825**

**ROLLBACK_SCOPE:** Frontend-only runtime — the 03G fix modifies only `frontend/next.config.js`. However, `git reset --hard` affects the whole repository worktree. This is acceptable because:
- Only the frontend needs rebuild/restart
- Gateway source is unchanged in the 03G commit
- Gateway does NOT need rebuild or restart during rollback

### Rollback Sequence

```bash
# 1. Safety check
grep 'GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# MUST be: false
grep 'BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# MUST be: false

# 2. Restore source to pre-03G baseline
cd /opt/aisandbox
git fetch origin
git reset --hard ed34e3c220c04c81ec6784f43e8952a60f537825

# 3. Clean rebuild frontend
cd /opt/aisandbox/frontend
rm -rf .next/
npm run build

# 4. Restart only frontend
pm2 restart aisandbox-frontend

# 5. Verify frontend health
sleep 10
curl -s -o /dev/null -w '%{http_code}' http://localhost:3002
# Expected: 307

# 6. Verify Gateway unchanged/healthy
curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/health
# Expected: 200

# 7. Verify PM2
pm2 list
# All processes: online

# 8. Verify safety flags
grep 'GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# false
grep 'BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# false
```

**Do NOT use or modify the retained pre-03F stash:** `stash@{0}` / `0372cc1f47f82e1db060ed2dd756a938fe324803`

---

## 18. Provider-Free Staging Validation Commands

### 18.1 Core 401 Proof

```bash
curl -s -w '\nHTTP_STATUS:%{http_code}' \
  -X POST http://localhost:3002/api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply \
  -H 'Content-Type: application/json' \
  -d '{"applyStatus":"applied","totalActions":1,"successCount":1}'
```

**Expected after fix:**

```
{"error":"unauthenticated"}
HTTP_STATUS:401
```

**Must NOT return:** Nest 404 or `x-powered-by: Express`.

To verify response is NOT from Gateway, check headers:

```bash
curl -sI -X POST http://localhost:3002/api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply \
  -H 'Content-Type: application/json' \
  -d '{"applyStatus":"applied","totalActions":1,"successCount":1}'
```

Expected headers: **NO** `x-powered-by: Express`. Should show Next.js response headers.

### 18.2 Gateway Regression Proof

```bash
curl -s -w '\nHTTP_STATUS:%{http_code}' http://localhost:3002/api/auth/me
```

**Expected (unchanged):**

```
{"message":"Authentication required","error":"Unauthorized","statusCode":401}
HTTP_STATUS:401
```

Verify headers include `x-powered-by: Express` (confirming Gateway proxy is working).

### 18.3 Static Bundle Secret Check

```bash
grep -r 'INTERNAL_SERVICE_KEY' /opt/aisandbox/frontend/.next/static/ 2>/dev/null | wc -l
```

**Expected:** `0`

### 18.4 Build Proof

```bash
cd /opt/aisandbox/frontend
npm run build 2>&1 | grep -i 'confirm-build-apply'
echo "EXIT_CODE=$?"
```

**Expected:** Route listed in build output. Exit code 0.

---

## 19. Safety Gates

| Gate | Required Value | Verification |
|------|---------------|--------------|
| `GLOBAL_EXECUTION_ENABLED` | `false` | `grep 'GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env` |
| `BILLING_CHARGES_ENABLED` | `false` | `grep 'BILLING_CHARGES_ENABLED' /opt/aisandbox/.env` |
| Provider calls | 0 | No provider endpoint called |
| Intentional credit mutations | 0 | No deduction/grant/refund triggered |
| Stripe/payment activation | 0 | No Stripe calls |

---

## 20. Provider/Credit Zero Budgets

| Budget | Value |
|--------|-------|
| `provider_call_budget` | **0** |
| `intentional_credit_mutation_budget` | **0** |
| Real balance mutation | **0** |
| Stripe sessions | **0** |

---

## 21. Stop Conditions

Step 3 must STOP if:

- [ ] Chosen fix changes Gateway source
- [ ] Fix requires broad API routing redesign
- [ ] Normal Gateway API routing cannot be preserved
- [ ] Implementation requires new dependency unexpectedly
- [ ] Frontend build fails
- [ ] Routing tests fail
- [ ] Existing proxy tests fail
- [ ] Staging target revision cannot be pinned
- [ ] Origin does not contain eventual implementation commit
- [ ] `GLOBAL_EXECUTION_ENABLED` != false
- [ ] `BILLING_CHARGES_ENABLED` != false
- [ ] Deployed route still returns Nest 404
- [ ] `/api/auth/me` Gateway regression changes unexpectedly
- [ ] Internal key appears in browser/static bundle
- [ ] Any provider call would be required
- [ ] Any intentional credit mutation would be required
- [ ] Frontend PM2 unhealthy after restart
- [ ] Gateway PM2 unhealthy (should be unchanged)
- [ ] Typecheck fails

---

## 22. Step 3 Phase Sequence

| Phase | Description | Prerequisite |
|-------|-------------|-------------|
| A | Implement selected frontend routing fix locally | Step 2 COMPLETE |
| B | Targeted tests | Phase A |
| C | Frontend typecheck/build | Phase B PASS |
| D | Local diff/scope verification | Phase C PASS |
| E | **STOP** for Keith git checkpoint/push | Phase D PASS |
| F | Staging pre-deploy safety/revision checks | Phase E (commit on origin) |
| G | Deploy exact implementation SHA | Phase F PASS |
| H | Clean frontend build | Phase G PASS |
| I | Restart only aisandbox-frontend | Phase H PASS |
| J | Provider-free confirm-route runtime proof | Phase I (frontend online) |
| K | Gateway proxy regression proof | Phase J PASS |
| L | Security/static-bundle proof | Phase K PASS |
| M | Final safety/health verification | Phase L PASS |

---

## 23. PASS / FAIL Criteria

03G Step 3 may PASS only if:

| # | Criterion |
|---|-----------|
| 1 | Selected bounded routing fix implemented |
| 2 | No Gateway source modification |
| 3 | Relevant tests PASS |
| 4 | Frontend build PASS |
| 5 | Exact committed implementation deployed to staging |
| 6 | Confirm endpoint reaches Next.js route |
| 7 | Unauthenticated confirm returns Next-side 401 `{"error":"unauthenticated"}` |
| 8 | No Nest/Gateway 404 for confirm path |
| 9 | Ordinary Gateway API proxy still works (`/api/auth/me` → 401 from Gateway) |
| 10 | Session/proxy architecture preserved |
| 11 | Ownership validation preserved (existing tests PASS) |
| 12 | Internal Gateway endpoint remains protected |
| 13 | `INTERNAL_SERVICE_KEY` remains server-only |
| 14 | Browser bundle contains no secret value |
| 15 | Frontend PM2 healthy |
| 16 | API Gateway healthy/unchanged |
| 17 | `GLOBAL_EXECUTION_ENABLED=false` |
| 18 | `BILLING_CHARGES_ENABLED=false` |
| 19 | Provider calls = 0 |
| 20 | Intentional credit mutations = 0 |
| 21 | No Stripe/payment activation |
| 22 | Rollback remains available |

**This still does NOT prove real provider-backed accounting.** Full successful accounting proof belongs to future PRIVATE-BETA-E2E-03.

---

## 24. Gateway Source Changes Required

**NO**

The fix is entirely in `frontend/next.config.js`. Zero API Gateway source changes.

---

## 25. Exact Step 3 Handoff

### Prerequisites for Step 3

- [x] Step 2 COMPLETE — routing design and validation plan established
- [x] Selected fix: OPTION B — `fallback` rewrite phase
- [x] `NEXT_CONFIG_ONLY_FIX=YES`
- [x] Expected files identified: `frontend/next.config.js` (production)
- [x] Test plan defined
- [x] Rollback target defined: `ed34e3c`
- [x] Provider-free staging validation commands defined
- [x] Stop conditions defined
- [x] Phase sequence defined
- [x] PASS/FAIL criteria defined
- [ ] Keith approval for Step 3 implementation

### Recommended Step 3 Model

**Grok 4.6 High** — the fix is well-defined, bounded, and frontend-only.

### Recommended Step 3 Window

New window per CLAUDE.md new-window rules.

### Key Reference Files for Step 3

| File | Purpose |
|------|---------|
| `docs/PRIVATE-BETA-BLOCKER-03G-STAGE-START.md` | This document — full plan |
| `frontend/next.config.js` | The ONE production file to modify |
| `frontend/lib/build-apply-confirm-proxy.server.test.ts` | Existing proxy tests (must remain PASS) |
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | Existing route (not modified) |
| `docs/PRIVATE-BETA-BLOCKER-03F-CHECKPOINT.md` | Prior checkpoint with runtime evidence |

---

## Safety Confirmation

| Safety item | Value |
|-------------|-------|
| Provider calls during Step 2 | **0** |
| GLOBAL_EXECUTION_ENABLED changes during Step 2 | **0** |
| Credit mutations during Step 2 | **0** |
| Staging configuration changes during Step 2 | **0** |
| Source changes during Step 2 | **0** |
| Test changes during Step 2 | **0** |
| Deployments during Step 2 | **0** |
| DB mutations during Step 2 | **0** |
| PM2 restart/reload during Step 2 | **0** |
| Stripe/payment changes during Step 2 | **0** |
| Git commit/push during Step 2 | **0** |
| Frontend source/config edits during Step 2 | **0** |
| GLOBAL_EXECUTION_ENABLED final | **false** |
| BILLING_CHARGES_ENABLED final | **false** |

---

*Stage Start created: 2026-08-15 — PRIVATE-BETA-BLOCKER-03G Step 2 — read-only analysis + governance only — no source/runtime/provider/balance/deployment mutation.*
