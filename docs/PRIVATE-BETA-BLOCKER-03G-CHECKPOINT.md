# PRIVATE-BETA-BLOCKER-03G — Checkpoint

**Task ID:** PRIVATE-BETA-BLOCKER-03G
**Title:** Frontend Confirm-Build-Apply Route Reachability
**Status:** COMPLETE AND LOCKED — 2026-08-16 — PASS
**Step:** Step 4 — Consolidation / Checkpoint
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source modification — no runtime mutation — no provider call — no balance mutation — no deployment)

---

## 1. Task Identity / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03G |
| Title | Frontend Confirm-Build-Apply Route Reachability |
| Status | **COMPLETE AND LOCKED — 2026-08-16 — PASS** |
| Root-cause classification | FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER |
| Workflow | HIGH-RISK 4-STEP |
| Step 1 | Registration — COMPLETE — 2026-08-15 |
| Step 2 | Routing Design + Provider-Free Validation Plan — COMPLETE — 2026-08-15 |
| Step 3 | Bounded Implementation + Provider-Free Staging Deployment — COMPLETE — PASS — 2026-08-16 |
| Step 4 | Consolidation / Checkpoint — COMPLETE — 2026-08-16 |

---

## 2. Blocker / Root Cause

**Classification:** FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER

The browser-facing Next.js route at `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` existed in source and build output but was unreachable at runtime because the broad `/api/:path*` Gateway rewrite in `next.config.js` intercepted the request before the dynamic App Router route could be resolved.

**Broken request path (before fix):**
```
browser → POST /api/ai/executions/:executionId/confirm-build-apply
→ Next.js flat-array rewrite (afterFiles phase): /api/:path* → http://localhost:4000/api/:path*
→ API Gateway (Nest) receives request
→ no public route at that path → HTTP 404
  {"message":"Cannot POST ...","error":"Not Found","statusCode":404}
  x-powered-by: Express
```

**Root mechanism:** The `rewrites()` function returned a flat array, which Next.js 15 treats as `afterFiles` rewrites (step 6 in the routing precedence chain). The confirm-build-apply route contains a dynamic segment `[executionId]`. In Next.js 15, dynamic routes are resolved AFTER `afterFiles` rewrites. When the source pattern `/api/:path*` matched an external destination URL, Next.js proxied to Gateway immediately without checking whether a local dynamic route also matched.

Flat-array behavior was documented in `docs/PRIVATE-BETA-BLOCKER-03G-STAGE-START.md` (Step 2).

---

## 3. Step 1 — Registration

COMPLETE — 2026-08-15. PRIVATE-BETA-BLOCKER-03G registered in `TASKS.md` and `TASKS_BACKLOG_FULL.md`. Classification: FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER. HIGH-RISK 4-STEP workflow. Provider-call budget ZERO. Credit-mutation budget ZERO. Dependency: PRIVATE-BETA-BLOCKER-03F COMPLETE AND LOCKED — 2026-08-15 — FAIL/BLOCKED.

---

## 4. Step 2 — Routing Design + Provider-Free Validation Plan

COMPLETE — 2026-08-15. Full routing analysis documented in `docs/PRIVATE-BETA-BLOCKER-03G-STAGE-START.md`:

- Identified Next.js 15.5.12 routing precedence chain (headers → redirects → middleware → beforeFiles → filesystem → afterFiles → fallback).
- Proved flat-array rewrites operate at `afterFiles` (step 6), after which dynamic routes are NOT re-checked for external-URL destinations.
- Evaluated four fix options (A: explicit exclusion, B: fallback phase, C: narrower patterns, D: route relocation).
- Selected OPTION B — `fallback` rewrite phase — as correct, minimal, canonical.
- Defined provider-free validation plan: unauthenticated POST probe + Gateway regression probe + bundle secret scan.
- Defined rollback target: `ed34e3c220c04c81ec6784f43e8952a60f537825`.

---

## 5. Selected Fallback-Rewrite Fix

**SELECTED_FIX:** OPTION B — Move Gateway rewrite from flat array to `fallback` phase.

**NEXT_CONFIG_ONLY_FIX:** YES

**Before (broken):**
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

**Rationale:**
- `fallback` phase (step 7) runs AFTER dynamic routes are resolved — the confirm-build-apply App Router route (with dynamic `[executionId]`) is now matched first.
- Routes without a local Next.js handler fall through to the fallback — all existing API routes continue to proxy to Gateway.
- This is the official Next.js canonical pattern for proxy fallback ("Incremental adoption of Next.js" example in docs).
- Two lines changed in a single config file. Zero production route or proxy code changes.
- No Gateway source changes required.

---

## 6. Files Changed

### Production
| File | Change |
|------|--------|
| `frontend/next.config.js` | Changed `return [...]` to `return { fallback: [...] }` |

### Test (new)
| File | Change |
|------|--------|
| `frontend/lib/next-config-rewrites.test.ts` | New — config shape validation: rewrites() returns `{ fallback: [...] }` not flat array |

### Not Changed
| File | Why |
|------|-----|
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | Route code correct — only config routing was broken |
| `frontend/lib/build-apply-confirm-proxy.server.ts` | Proxy code correct — unchanged |
| `frontend/app/[locale]/app/page.tsx` | Frontend caller correct — unchanged |
| `frontend/components/workspace/workspace-ai-file-actions.logic.ts` | Qualification logic correct — unchanged |
| `services/api-gateway/src/**` | No Gateway changes required |
| `frontend/middleware.ts` | Middleware already passes `/api` through correctly |
| `frontend/messages/*.json` | No user-facing text changes |

---

## 7. Automated Tests

| Test File | Tests | Result |
|-----------|-------|--------|
| `frontend/lib/next-config-rewrites.test.ts` | 3/3 | PASS |
| `frontend/lib/build-apply-confirm-proxy.server.test.ts` | 11/11 | PASS |
| `frontend/components/workspace/workspace-ai-file-actions.logic.test.ts` | 35/35 | PASS |

**next-config-rewrites.test.ts tests:**
1. `rewrites() returns a fallback object, not a flat array` — PASS
2. `fallback contains the existing /api/:path* Gateway proxy rule` — PASS
3. `Gateway destination uses API_GATEWAY_URL when set` — PASS

---

## 8. Local Typecheck / Build

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | PASS |
| Production build | `npm run build` | PASS |
| Next.js version | — | 15.5.12 |
| Build contains confirm route | `/api/ai/executions/[executionId]/confirm-build-apply` | PRESENT |

---

## 9. Implementation Commit SHA

**Committed SHA:** `5829c4241d0f1abc0a41476bf2fe3996dd9da993`

**Production source change:** `frontend/next.config.js` only.

**Test addition:** `frontend/lib/next-config-rewrites.test.ts`.

---

## 10. Staging Pre-Deploy SHA

**Pre-deployment staging SHA:** `ed34e3c220c04c81ec6784f43e8952a60f537825`

Staging worktree: CLEAN at pre-deploy SHA.

---

## 11. Staging Deployed SHA

**Deployed SHA:** `5829c4241d0f1abc0a41476bf2fe3996dd9da993`

Post-deployment:
- `HEAD` matches exact target.
- Worktree: CLEAN.
- Only production source difference from pre-deploy SHA: `frontend/next.config.js`.

---

## 12. Deployment Scope

| Service | Action |
|---------|--------|
| aisandbox-frontend | Git reset to SHA, clean `.next/` rebuild, PM2 restart |
| aisandbox-api-gateway | NOT rebuilt, NOT restarted — PID unchanged |
| aisandbox-ai-service | NOT touched |
| aisandbox-container-manager | NOT touched |
| aisandbox-ops-watchdog | NOT touched |

No npm install required (no dependency changes). No migration required (no schema changes). No new env vars (existing vars unchanged).

---

## 13. Frontend Build / Restart

- Clean `rm -rf .next/` + `npm run build` executed on staging.
- Build PASS.
- `confirm-build-apply` route present in build output.
- `INTERNAL_SERVICE_KEY` name: **0 matches** in `.next/static/`.
- Secret value: **0 matches** in `.next/static/`.
- `pm2 restart aisandbox-frontend` executed.
- Frontend PM2 status: **online**.

---

## 14. Confirm-Route Baseline Before Fix (03F Evidence)

**Request:**
```
POST http://localhost:3002/api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply
(no authentication, no body)
```

**Response (before fix):**
```
HTTP/1.1 404 Not Found
x-powered-by: Express
{"message":"Cannot POST /api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply","error":"Not Found","statusCode":404}
```

Fingerprint confirmed response from API Gateway (Nest), NOT Next.js — `x-powered-by: Express` + NestJS error shape.

---

## 15. Confirm-Route Runtime Proof After Fix

**Request:**
```
POST http://localhost:3002/api/ai/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply
(no authentication, no body)
```

**Response (after fix):**
```
HTTP 401
{"error":"unauthenticated"}
```

**HTTP fingerprint:**
- `x-powered-by: Express` header: **ABSENT**
- Nest `statusCode` field: **ABSENT**
- Nest `"Cannot POST"` message: **ABSENT**

Response is from Next.js server route (`route.ts` POST handler → session validation → 401).

**FRONTEND_CONFIRM_ROUTE_REACHABILITY=PASS**

---

## 16. Gateway Proxy Regression

**Request:**
```
GET http://localhost:3002/api/auth/me
(no authentication)
```

**Response:**
```
HTTP 401
x-powered-by: Express
{"message":"Authentication required","error":"Unauthorized","statusCode":401}
```

Fingerprint: `x-powered-by: Express` + NestJS error shape confirms API Gateway (Nest) received and responded.

**GATEWAY_API_FALLBACK_REGRESSION=PASS**

Ordinary API routes without local Next.js handlers continue to proxy to Gateway identically to pre-fix behavior.

---

## 17. Session / Proxy Architecture

The authenticated runtime chain is preserved and unchanged:
```
browser
→ same-origin Next.js confirm-build-apply route (POST handler)
→ proxyConfirmBuildApply()
→ server-side session cookie validation → GET /api/auth/me
→ authenticated execution lookup / ownership validation
→ server-only INTERNAL_SERVICE_KEY attached server-side
→ Gateway internal endpoint POST /api/internal/...
→ triggerBuildApplyDeduction()
```

The browser does NOT call the internal Gateway route directly. Architecture preserved.

---

## 18. Ownership Protection

Ownership validation preserved — existing proxy tests confirm:
- Authenticated owner + valid payload → 200 triggered
- Different-user execution → 404 (ownership rejected, no internal call)
- Arbitrary executionId cannot bypass ownership → 404
- Internal key added server-side only, never returned to browser

All 11 `build-apply-confirm-proxy.server.test.ts` tests PASS.

---

## 19. Internal Gateway Guard

`InternalServiceAuthGuard` remains unchanged on the API Gateway internal endpoint. The 03G fix made zero changes to Gateway source. The internal route remains protected — only requests with a valid `INTERNAL_SERVICE_KEY` header can reach it. No public exposure of the internal accounting endpoint.

---

## 20. INTERNAL_SERVICE_KEY Security

| Check | Result |
|-------|--------|
| `INTERNAL_SERVICE_KEY` name in `.next/static/` | 0 matches |
| `INTERNAL_SERVICE_KEY` secret value in `.next/static/` | 0 matches |
| Key present in staging env | YES |
| Frontend key matches Gateway key | YES (MATCH=YES) |
| Key read server-side only (`process.env.INTERNAL_SERVICE_KEY`) | CONFIRMED |
| `NEXT_PUBLIC_INTERNAL_SERVICE_KEY` usage | NONE |

Key remains server-only. Browser/static bundle contains no secret value.

---

## 21. API_GATEWAY_URL

| Field | Value |
|-------|-------|
| `API_GATEWAY_URL` (staging env) | `http://localhost:4000` |
| Fallback default in config | `http://localhost:4000` |
| Status | CORRECT — unchanged |

---

## 22. Safety Flags

| Flag | Value |
|------|-------|
| `GLOBAL_EXECUTION_ENABLED` | **false** — verified in staging `.env` |
| `BILLING_CHARGES_ENABLED` | **false** — verified in staging `.env` |

Both flags maintained at `false` throughout all steps of 03G.

---

## 23. Provider / Credit Zero Budgets

| Budget | Value |
|--------|-------|
| Provider calls during 03G | **0** |
| Intentional credit mutations during 03G | **0** |
| Stripe/payment activation | **none** |
| Real balance mutation | **0** |

No provider endpoint was called at any step of 03G. No deduction, grant, or refund was triggered.

---

## 24. Payment Safety

- No Stripe sessions created or activated during 03G.
- `BILLING_CHARGES_ENABLED=false` maintained throughout.
- No payment-related code or configuration was modified.

---

## 25. PM2 / Service Health

All required PM2 services: **online** at time of staging verification.

| Service | Status |
|---------|--------|
| aisandbox-frontend | online |
| aisandbox-api-gateway | online |
| aisandbox-ai-service | online |
| aisandbox-container-manager | online |

Gateway health check: **HTTP 200**.
Frontend health check: **HTTP 307** (expected redirect behavior).

---

## 26. Rollback Result

**Rollback required:** NO

**Rollback target remains available:** `ed34e3c220c04c81ec6784f43e8952a60f537825`

The pre-deploy staging SHA was retained and is reachable on origin. The rollback sequence documented in `docs/PRIVATE-BETA-BLOCKER-03G-STAGE-START.md` (Section 17) remains valid and executable if needed. 03G was not rolled back.

---

## 27. Retained Pre-03F Stash

**Stash hash:** `0372cc1f47f82e1db060ed2dd756a938fe324803` (`stash@{0}`)

Status: **UNTOUCHED** — not dropped, not applied, not popped, not repurposed.

This stash must remain retained. It is not part of 03G scope.

---

## 28. SSH / VPN Operational Note

During Step 3, staging SSH temporarily failed from Keith's Windows machine.

**Root cause:** VPN routing path — not a Lightsail/Ubuntu SSH configuration issue.

| VPN State | SSH Behavior |
|-----------|-------------|
| VPN ON | TCP connection established but closed during/before key exchange |
| VPN OFF | Key exchange, public-key authentication, and Ubuntu shell all succeeded |

No Lightsail/Ubuntu SSH configuration change was required or made.

**Operational note for future staging work:** Keith should keep VPN OFF for staging SSH unless split tunneling is configured for the Lightsail IP range. This is a network/VPN routing issue, not a platform blocker.

---

## 29. Acceptance Criteria Assessment

All 25 registered 03G acceptance criteria are satisfied:

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Exact rewrite/root cause documented | PASS |
| 2 | Current Next.js runtime behavior documented | PASS |
| 3 | Smallest safe routing fix selected | PASS |
| 4 | Existing Gateway API proxy behavior preserved | PASS |
| 5 | Confirmation route resolves to Next.js server route | PASS |
| 6 | Unauthenticated confirm request returns Next-side 401 | PASS |
| 7 | Confirm request no longer produces Gateway/Nest 404 | PASS |
| 8 | Authenticated server proxy architecture preserved | PASS |
| 9 | Execution ownership validation preserved | PASS |
| 10 | Internal Gateway endpoint remains guarded by `InternalServiceAuthGuard` | PASS |
| 11 | `INTERNAL_SERVICE_KEY` remains server-only | PASS |
| 12 | Browser static bundle contains no secret value | PASS |
| 13 | `API_GATEWAY_URL` remains correct | PASS |
| 14 | Frontend build succeeds | PASS |
| 15 | Relevant routing/proxy tests pass | PASS |
| 16 | Frontend PM2 online after staging deployment | PASS |
| 17 | Provider-free staging route probe passes (Next.js 401 confirmed) | PASS |
| 18 | Normal safe Gateway-proxied API regression passes | PASS |
| 19 | `GLOBAL_EXECUTION_ENABLED` remains false | PASS |
| 20 | `BILLING_CHARGES_ENABLED` remains false | PASS |
| 21 | Provider calls = 0 | PASS |
| 22 | Intentional credit mutations = 0 | PASS |
| 23 | No Stripe/payment activation | PASS |
| 24 | No broad API routing redesign | PASS |
| 25 | No unrelated source changes | PASS |
| 26 | Rollback path documented before deployment | PASS |
| 27 | Rollback remains available after deployment | PASS |
| 28 | Stage Start document created | PASS — `docs/PRIVATE-BETA-BLOCKER-03G-STAGE-START.md` |
| 29 | Final checkpoint created | PASS — `docs/PRIVATE-BETA-BLOCKER-03G-CHECKPOINT.md` |
| 30 | Private-beta remains NO-GO pending separate balance blocker + fresh E2E | PASS |

**03G does NOT prove real provider-backed accounting.** Full successful accounting proof belongs to future PRIVATE-BETA-E2E-03. 03G proves route reachability and preserves the required security/routing architecture provider-free.

---

## 30. Final 03G Verdict

**PRIVATE-BETA-BLOCKER-03G: PASS**

The browser-facing `confirm-build-apply` endpoint is demonstrably handled by the intended Next.js server route on staging (verified by unauthenticated POST → HTTP 401 `{"error":"unauthenticated"}` with no `x-powered-by: Express`), while normal Gateway API proxying and all 03D security boundaries remain intact.

**COMPLETE AND LOCKED — 2026-08-16**

---

## 31. Private-Beta Readiness

**Private beta status: NO-GO / BLOCKED**

03G closure does NOT clear the remaining launch-critical blockers. Private-beta invitation (PRIVATE-BETA-INVITE-01) remains untouched, unregistered, and prohibited.

---

## 32. Unresolved Credit-Display Blocker

**Status:** UNRESOLVED — LAUNCH-CRITICAL — separate task required

**Observed discrepancy (E2E-02 evidence):**
- Browser-visible credit balance: **3278**
- Authoritative DB balance (`credit_balances.balance`): **30577**

This discrepancy was observed during PRIVATE-BETA-E2E-02 and remains unresolved. Root cause is unknown (possible: unit/scaling mismatch, stale state, wrong endpoint, wrong field, cache, accounting representation).

**Next required task:** PRIVATE-BETA-BLOCKER-03H — Credit Balance Display / Authoritative Balance Reconciliation — NOT YET REGISTERED

Do not investigate, implement, or speculate on root cause until 03H is formally registered.

---

## 33. Manual Checkpoint HTTP500 Anomaly

**Status:** RECORDED SEPARATE ANOMALY — not investigated — not resolved in 03G

A manual checkpoint HTTP 500 anomaly was recorded separately. Triage scope is out of 03G. Do not combine with 03H unless future evidence proves shared root cause.

---

## 34. Future E2E-03 Requirement

**PRIVATE-BETA-E2E-03:** NOT REGISTERED — NOT AUTHORIZED

Fresh provider-backed E2E must NOT be registered or executed until:
1. PRIVATE-BETA-BLOCKER-03G COMPLETE AND LOCKED — **now satisfied**
2. PRIVATE-BETA-BLOCKER-03H credit balance discrepancy resolved and locked — **PENDING**

Both conditions must be met before E2E-03 can be considered.

---

## 35. Fresh Keith Authorization Requirement

E2E-02 one-call provider authorization is **CONSUMED**. Any future provider-backed execution requires **fresh explicit Keith authorization** before registration or execution. No authorization is currently in effect.

---

## 36. PRIVATE-BETA-INVITE-01 Prohibition

**PRIVATE-BETA-INVITE-01:** untouched / unregistered / **PROHIBITED**

Private beta users must NOT be invited until all launch-critical blockers are resolved and a successful provider-backed E2E has been completed. This prohibition remains in force.

---

## 37. Exact Next Task

**PRIVATE-BETA-BLOCKER-03H — Credit Balance Display / Authoritative Balance Reconciliation**

**Status:** NOT YET REGISTERED

**Objective (future):** Determine what the UI value 3278 represents, what authoritative credit source the frontend reads, why it differs from `credit_balances.balance=30577`, whether units/scaling/stale state/wrong endpoint/wrong field/cache/accounting representation is involved, which value users should see, and implement the smallest safe correction. Provider-free validation preferred where possible.

03H must be a SEPARATE bounded task. Do not mix with 03G, manual checkpoint HTTP500, or fresh provider E2E.

---

*Checkpoint created: 2026-08-16 — PRIVATE-BETA-BLOCKER-03G Step 4 — documentation/governance only — no source/runtime/provider/balance/deployment mutation.*
