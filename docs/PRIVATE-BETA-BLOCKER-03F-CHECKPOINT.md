# PRIVATE-BETA-BLOCKER-03F — Checkpoint

**Task ID:** PRIVATE-BETA-BLOCKER-03F
**Title:** Staging Deployment Parity for 03D Accounting Confirmation Path
**Status:** COMPLETE AND LOCKED — 2026-08-15
**Outcome:** FAIL / BLOCKED — FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER
**Step:** Step 4 — Consolidation / Runtime Reachability Decision
**Author:** Cursor / Opus 4.6 (documentation/governance + READ-ONLY routing verification — no source modification — no runtime mutation — no provider call — no balance mutation — no deployment)

---

## 1. Task / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03F |
| Title | Staging Deployment Parity for 03D Accounting Confirmation Path |
| Status | **COMPLETE AND LOCKED — 2026-08-15** |
| Outcome | **FAIL / BLOCKED** |
| Root-cause classification | **FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER** |
| Workflow | HIGH-RISK 4-STEP |
| Step 1 | Registration — COMPLETE — 2026-08-14 |
| Step 2 | Stage Start / Deployment-Parity Plan — COMPLETE — 2026-08-14 |
| Step 3 | Controlled Provider-Free Staging Deployment + Verification — COMPLETE — DEPLOYMENT EXECUTED / RUNTIME REACHABILITY BLOCKED — 2026-08-15 |
| Step 4 | Consolidation / Runtime Reachability Decision — COMPLETE — 2026-08-15 |

---

## 2. Blocker Objective

Restore staging deployment parity so that the committed 03D accounting confirmation architecture is demonstrably deployed AND active in staging. PRIVATE-BETA-E2E-02 failed because staging did not contain the 03D-A/03D-B accounting confirmation path. 03F was specifically tasked with deploying that committed code and proving parity provider-free.

The registered PASS definition required the architecture to be "demonstrably deployed **and active** in staging."

---

## 3. E2E-02 Origin

PRIVATE-BETA-E2E-02 (COMPLETE AND LOCKED — 2026-08-14 — FAIL / BLOCKED) performed one authorized xAI/grok-4.5 execution on staging. The execution succeeded, workspace apply succeeded, browser usability passed, but the staging deployment exercised the pre-03D immediate deduction path rather than the committed 03D deferred Build deduction architecture. 15/18 PASS criteria met, 3/18 FAIL. All 3 failures traced to a single root cause: staging deployment did not contain the 03D accounting confirmation changes (commit `fd5e62d`).

---

## 4. Step 1 — Registration

COMPLETE — 2026-08-14. PRIVATE-BETA-BLOCKER-03F registered in TASKS.md and TASKS_BACKLOG_FULL.md. Classification: STAGING DEPLOYMENT PARITY BLOCKER. HIGH-RISK 4-STEP workflow. Provider-call budget ZERO. Credit-mutation budget ZERO. Keith approval recorded.

---

## 5. Step 2 — Deployment-Parity Plan

COMPLETE — 2026-08-14. Stage Start document created: `docs/PRIVATE-BETA-BLOCKER-03F-STAGE-START.md`. SSH inspection established:

- Staging revision: `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883` (worktree DIRTY)
- Local HEAD: `ed34e3c220c04c81ec6784f43e8952a60f537825`
- 03D commit `fd5e62d` is ancestor of HEAD
- ALL 13 03D parity checks ABSENT on staging
- Deployment mechanism: git pull → npm run build → pm2 restart
- Selected deployment: Option B — deploy current HEAD (`ed34e3c`)
- Rollback target: `f73da07` + git stash pre-deployment snapshot
- Gateway + Frontend rebuild/restart required; AI Service and Container Manager unaffected
- No npm install, no migration, no schema change, no Docker rebuild, no new env vars required
- Safety gates verified: `GLOBAL_EXECUTION_ENABLED=false`, `BILLING_CHARGES_ENABLED=false`, keys present and matching

---

## 6. Step 3 — Pre-Deployment Block / Push Prerequisite

Step 3 began by verifying push prerequisite. Local commits were pushed to GitHub remote (`git push origin main`). Remote HEAD confirmed at `ed34e3c`. SSH pre-deployment safety verified: `GLOBAL_EXECUTION_ENABLED=false`, `BILLING_CHARGES_ENABLED=false`, all PM2 processes online, staging at expected `f73da07`.

---

## 7. Final Deployed SHA

| Field | Value |
|-------|-------|
| Deployed SHA | `ed34e3c220c04c81ec6784f43e8952a60f537825` |
| Deployed oneline | `checkpoint: prepare E2E-02 controlled run` |
| origin/main | Same SHA |
| Staging worktree | **CLEAN** after deployment |
| 03D commit | `fd5e62d` — confirmed ancestor of deployed HEAD |

---

## 8. Dirty-Tree Classification

Pre-deployment staging worktree was DIRTY (22 modified files, 2 untracked). The dirty modifications corresponded to already-running non-03D production changes from commits `8a603ee` and `0b47bab`. Pre-deployment snapshot was captured via `git stash push -m "pre-03F-deployment-snapshot"` before source update. After `git reset --hard origin/main`, worktree became CLEAN.

---

## 9. Rollback Snapshot

| Field | Value |
|-------|-------|
| Stash reference | `stash@{0}` |
| Stash SHA | `0372cc1f47f82e1db060ed2dd756a938fe324803` |
| Stash label | `pre-03F-deployment-snapshot` |
| Rollback base revision | `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883` |
| Status | **RETAINED — do NOT drop** |

---

## 10. Source Transition

| Field | Before | After |
|-------|--------|-------|
| Staging HEAD | `f73da07` | `ed34e3c` |
| Staging worktree | DIRTY (22M, 2U) | CLEAN |
| 03D patterns on staging | ALL ABSENT | ALL PRESENT in source/build |
| Commits advanced | — | 8 commits (5 governance/docs, 2 already-running production, 1 required 03D) |

---

## 11. Gateway Build / Deployment Result

| Check | Result |
|-------|--------|
| Source `build_awaiting_apply` (usage-ledger.service.ts) | 3 matches — PRESENT |
| Source `triggerBuildApplyDeduction` (usage-ledger.service.ts) | 2 matches — PRESENT |
| Source `confirm-build-apply` (internal-accounting.controller.ts) | 3 matches — PRESENT |
| Source `confirm-build-apply.dto.ts` | File exists — PRESENT |
| `rm -rf dist/ && npm run build` | Exit 0 — **PASS** |
| Compiled `build_awaiting_apply` (dist) | >= 1 match — PRESENT |
| Compiled `triggerBuildApplyDeduction` (dist) | >= 1 match — PRESENT |
| Compiled `confirm-build-apply` (dist) | >= 1 match — PRESENT |
| PM2 restart | Online — **PASS** |
| Health check (`curl http://localhost:4000/api/health`) | HTTP 200 — **PASS** |
| Unauthenticated probe to internal confirm route | HTTP 403 (InternalServiceAuthGuard) — **PASS** |

**GATEWAY DEPLOYMENT PARITY: PASS**

---

## 12. Frontend Build / Deployment Result

| Check | Result |
|-------|--------|
| Source `build-apply-confirm-proxy.server.ts` | File exists — PRESENT |
| Source `confirm-build-apply/route.ts` | File exists — PRESENT |
| Source `confirmBuildApplyIfQualifying` (page.tsx) | 2 matches — PRESENT |
| `rm -rf .next/ && npm run build` | Exit 0 — **PASS** |
| Build manifest includes `/api/ai/executions/[executionId]/confirm-build-apply` | PRESENT in build output |
| Server build `confirm-build-apply` (`.next/server/`) | >= 1 match — PRESENT |
| Server build `proxyConfirmBuildApply` (`.next/server/`) | >= 1 match — PRESENT |
| `INTERNAL_SERVICE_KEY` in `.next/static/` client bundle | **0 matches — PASS (not exposed)** |
| PM2 restart | Online — **PASS** |
| Health check (`curl http://localhost:3002`) | HTTP 307 — **PASS** |
| `API_GATEWAY_URL` | `http://localhost:4000` — **PASS** |
| Internal keys present and matching | **PASS** |

**FRONTEND SOURCE/BUILD PARITY: PASS**

---

## 13. Gateway Parity Result

**GATEWAY 03D PARITY: PASS**

All 8 previously-absent 03D Gateway features confirmed present in deployed source, compiled dist, and runtime (guard-protected probe returns 403).

---

## 14. Frontend Source/Build Parity Result

**FRONTEND_SOURCE_BUILD_PARITY: PASS**

All 5 previously-absent 03D frontend features confirmed present in deployed source and Next.js build output. `INTERNAL_SERVICE_KEY` confirmed absent from client bundle. Build manifest includes the confirm route. Server-side proxy compiled and present.

---

## 15. Runtime Same-Origin Confirmation-Path Test

**FRONTEND_RUNTIME_CONFIRM_PATH: FAIL**

Step 3 performed a provider-free same-origin request to the frontend at `:3002`:

```
POST http://localhost:3002/api/ai/executions/<executionId>/confirm-build-apply
```

**Expected behavior (if Next.js App Router route handled the request):**

```
Next.js route.ts → proxyConfirmBuildApply() → readSessionTokenFromCookieHeader(null) → null
→ return { status: 401, body: { error: 'unauthenticated' } }
```

Expected HTTP response: **401** with `{ "error": "unauthenticated" }`

**Observed behavior:**

The request was rewritten by `next.config.js` to:

```
http://localhost:4000/api/ai/executions/<executionId>/confirm-build-apply
```

The API Gateway (Nest) received the request but has no public route at that path (the internal route is at `/api/internal/executions/:executionId/confirm-build-apply`).

Observed HTTP response: **404** from Nest/API Gateway (not from Next.js)

This proves the broad `/api/:path*` rewrite in `next.config.js` intercepted the request before the Next.js App Router filesystem route could handle it.

---

## 16. Rewrite / Route Reachability Finding

### 16.1 Exact Rewrite Rule

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

The rewrite source `/api/:path*` is a broad wildcard that matches ALL paths beginning with `/api/`.

### 16.2 Pattern Match

The target confirm route pathname `/api/ai/executions/:executionId/confirm-build-apply` matches the rewrite source `/api/:path*`. There is no exception, `beforeFiles`/`afterFiles` separation, or route-specific exclusion configured.

### 16.3 Expected Next.js Route

The App Router route file at `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` exports a `POST` handler. This should map to filesystem route `/api/ai/executions/[executionId]/confirm-build-apply`.

### 16.4 Route Precedence / Source Configuration

The `rewrites()` function returns a **flat array** (not a `{ beforeFiles, afterFiles, fallback }` object). In Next.js, a flat array from `rewrites()` is treated as `afterFiles` rewrites — meaning filesystem routes should theoretically be resolved first.

However, Step 3 runtime evidence conclusively shows the rewrite **did** take precedence over the App Router route. The request reached the API Gateway instead of the Next.js route handler.

No explicit exception for the confirm route exists in the current configuration.

### 16.5 Middleware Evaluation

The Next.js middleware (`frontend/middleware.ts`) explicitly passes through `/api` paths:

```ts
if (pathname.startsWith('/api')) {
    return NextResponse.next();
}
```

The middleware matcher also excludes `/api`:

```ts
matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
```

The middleware is NOT the cause of the routing failure.

### 16.6 Summary

| Question | Answer |
|----------|--------|
| Does the rewrite match the confirm route? | **YES** — `/api/:path*` matches `/api/ai/executions/:id/confirm-build-apply` |
| Is there an exception for this route? | **NO** |
| Step 3 observed behavior | Gateway 404 (not Next.js 401) |
| Expected Next route unauthenticated behavior | 401 `{ error: 'unauthenticated' }` |
| Source fix exists in deployed SHA? | **NO** |

### 16.7 Root-Cause Classification

**FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER**

This is NOT a deployment-parity problem. The deployed SHA (`ed34e3c`) IS the intended committed source. The route exists in source, in the build manifest, and in the server build output.

The remaining problem is runtime routing behavior of that committed implementation: the broad `/api/:path*` Gateway rewrite in `next.config.js` prevents the Next.js App Router confirm route from being reached by same-origin browser requests.

---

## 17. Strict Acceptance Assessment

### 17.1 Deployment-Presence Criteria

All deployment-presence acceptance criteria from registration are **SATISFIED**:

- [x] Exact staging deployed revision/source state established — `f73da07` → `ed34e3c`
- [x] Exact local intended revision/source state established — HEAD `ed34e3c`
- [x] Local 03D-A/03D-B implementation confirmed committed — commit `fd5e62d`
- [x] Exact local-vs-staging source delta established — 8 commits
- [x] Unrelated source deployment risk evaluated — already-running changes formalized
- [x] Existing approved deployment mechanism identified — git pull → build → pm2 restart
- [x] Rollback target identified before deployment — `f73da07` + stash
- [x] Exact Step 2 deployment runbook created — `docs/PRIVATE-BETA-BLOCKER-03F-STAGE-START.md`
- [x] GLOBAL_EXECUTION_ENABLED verified false pre-deploy
- [x] BILLING_CHARGES_ENABLED verified false pre-deploy
- [x] Provider-call budget zero
- [x] Credit-mutation budget zero
- [x] Intended 03D accounting files deployed — source present at deployed SHA
- [x] build_awaiting_apply logic present in deployed Gateway — compiled dist confirmed
- [x] confirm-build-apply internal Gateway route deployed — compiled dist + guard-protected probe 403
- [x] frontend confirm-build-apply route deployed — **SOURCE/BUILD PRESENT** (runtime unreachable — see §16)
- [x] frontend server proxy deployed — source/build present
- [x] execution ownership protection present — source deployed
- [x] INTERNAL_SERVICE_KEY remains server-only — 0 matches in .next/static
- [x] frontend/Gateway internal keys present and matching
- [x] API_GATEWAY_URL verified — http://localhost:4000
- [x] Required builds complete successfully — Gateway PASS, Frontend PASS
- [x] Required PM2 processes return healthy — Gateway 200, Frontend 307, all online
- [x] GLOBAL_EXECUTION_ENABLED remains false post-deploy
- [x] BILLING_CHARGES_ENABLED remains false post-deploy
- [x] No provider execution occurs
- [x] No intentional credit mutation occurs
- [x] No Stripe/payment activation occurs
- [x] No unrelated production source changes introduced — formalized already-running state
- [x] Provider-free parity evidence documented
- [x] Rollback path documented and still valid — stash retained
- [x] Step 4 checkpoint produced — `docs/PRIVATE-BETA-BLOCKER-03F-CHECKPOINT.md`

### 17.2 PASS Definition Evaluation

The registration PASS definition states:

> 03F PASS means: the already-completed 03D accounting-confirmation architecture is **demonstrably deployed and active** in staging.

**"Demonstrably deployed":** SATISFIED. All 03D source files are present in the deployed SHA. Gateway and frontend builds succeed. Build manifests and compiled outputs contain the required patterns.

**"Active in staging":** NOT SATISFIED. The frontend confirm-build-apply route exists in source and build but is not reachable at runtime through the normal browser product path because `next.config.js` rewrites `/api/:path*` to the API Gateway before the App Router route can handle the request. The browser-to-accounting chain:

```
browser → Next.js confirm route → proxy → auth/ownership → INTERNAL_SERVICE_KEY → Gateway internal route
```

cannot operate as designed because the first link (browser → Next.js confirm route) is broken by the rewrite.

### 17.3 Determination

**FRONTEND_SOURCE_BUILD_PARITY = PASS**
**FRONTEND_RUNTIME_CONFIRM_PATH = FAIL**
**03F OVERALL = FAIL / BLOCKED**

---

## 18. Corrected Step 3 Verdict

The Step 3 self-verdict of PASS is **CORRECTED** during Step 4 consolidation.

Step 3 successfully executed all deployment phases (A through H). Source/build parity was restored. All PM2 services came online. All safety gates remained correct. Provider calls remained at zero.

However, Step 3 also discovered that same-origin requests to the frontend confirm route are diverted by the `/api/:path*` rewrite to the API Gateway, producing a Nest 404 instead of the expected Next.js 401. This means the 03D browser confirmation architecture is not operationally active.

**Corrected Step 3 verdict:**

COMPLETE — DEPLOYMENT EXECUTED / RUNTIME REACHABILITY BLOCKED — 2026-08-15

---

## 19. Final 03F Outcome

**PRIVATE-BETA-BLOCKER-03F: COMPLETE AND LOCKED — 2026-08-15 — FAIL / BLOCKED**

**Reason:** Deployment/source parity was restored. The committed 03D accounting confirmation code is now present in the staging deployment at the intended SHA. All builds pass, all services are healthy, all safety gates correct. However, runtime same-origin routing bypasses the new Next.js confirm-build-apply route due to the broad `/api/:path*` Gateway rewrite in `next.config.js`. The 03D browser confirmation architecture is therefore still not operational end-to-end.

The remaining blocker is classified as: **FRONTEND CONFIRM ROUTE REACHABILITY / API REWRITE PRECEDENCE BLOCKER** — NOT a deployment-parity problem.

---

## 20. Safety Flags

| Flag | Value |
|------|-------|
| GLOBAL_EXECUTION_ENABLED | **false** — maintained throughout 03F |
| BILLING_CHARGES_ENABLED | **false** — maintained throughout 03F |

---

## 21. Provider-Call Count

| Counter | Value |
|---------|-------|
| Provider calls during 03F | **0** |
| Provider calls total (03F lifetime) | **0** |

---

## 22. Intentional Credit Mutation Count

| Counter | Value |
|---------|-------|
| Intentional credit mutations during 03F | **0** |
| Credit grants | **0** |
| Credit refunds | **0** |
| Deduction attempts | **0** |

---

## 23. External Payment Safety

| Check | Result |
|-------|--------|
| Stripe checkout sessions | **0** |
| Stripe portal calls | **0** |
| Stripe webhook triggers | **0** |
| Subscription creation | **0** |
| External payment charges | **0** |
| BILLING_CHARGES_ENABLED | **false** throughout |

**No external payment activity occurred.**

---

## 24. Retained Rollback Snapshot

| Field | Value |
|-------|-------|
| Stash reference | `stash@{0}` |
| Stash SHA | `0372cc1f47f82e1db060ed2dd756a938fe324803` |
| ROLLBACK_REQUIRED | **NO** |
| Stash status | **RETAINED — do NOT drop** |

Rollback is not required because:
- The deployed SHA is the intended committed source
- The deployment is healthy
- Rolling back would reintroduce the pre-03D accounting deployment gap
- The remaining blocker is a routing/config issue, not a deployment regression

The stash is retained for emergency recovery if needed.

---

## 25. Unresolved 03G Blocker

**PRIVATE-BETA-BLOCKER-03G — Frontend Confirm-Build-Apply Route Reachability**

**Status:** NOT YET REGISTERED

**Objective (bounded):**

- Determine the correct Next.js routing/rewrite design for the confirmation endpoint
- Ensure `/api/ai/executions/:executionId/confirm-build-apply` is handled by the Next.js App Router server route rather than the broad Gateway rewrite
- Preserve all other existing `/api/:path*` Gateway routing behavior
- Preserve session/auth/ownership checks
- Preserve INTERNAL_SERVICE_KEY server-only handling
- No provider calls
- No credit mutations
- GLOBAL_EXECUTION_ENABLED=false
- BILLING_CHARGES_ENABLED=false
- Provider-free staging validation
- Minimal reversible frontend/config fix
- No broad routing redesign

**Nature:** Frontend routing/config work, not accounting implementation.

---

## 26. Separate Balance Discrepancy

**STATUS: UNRESOLVED — SEPARATE BOUNDED TASK REQUIRED**

| Measure | Value |
|---------|-------|
| Browser-visible credit display | 3278 |
| Authoritative DB balance | 30577 |
| Difference | 27299 |

This remains a launch-critical unresolved blocker. Do NOT combine with 03G. Do NOT investigate in this checkpoint. Requires separate bounded task.

---

## 27. Separate Checkpoint HTTP 500 Anomaly

**STATUS: RECORDED ANOMALY — SEPARATE TRIAGE REQUIRED**

Manual checkpoint creation returned HTTP 500 during E2E-02. Requires separate bounded triage to determine launch-criticality. Not in 03F or 03G scope.

---

## 28. Private-Beta Readiness

**Current Builder private-beta readiness: NO-GO / BLOCKED**

PRIVATE-BETA-INVITE-01 remains:
- **Untouched**
- **Unregistered**
- **Prohibited**

Invitations are prohibited until:
1. 03G route reachability resolved
2. Credit display discrepancy resolved
3. Fresh provider-backed E2E validates the full deferred-deduction path
4. Fresh Keith authorization obtained for the next provider call

---

## 29. Future E2E Requirement

**PRIVATE-BETA-E2E-03** — Fresh provider-backed end-to-end validation

Required AFTER:
1. 03G route reachability resolved
2. Credit display discrepancy resolved

E2E-03 must prove the complete browser-to-accounting path with a real provider call on staging. It is NOT an E2E-02 retry — it is a fresh validation.

Do NOT register PRIVATE-BETA-E2E-03 now.

---

## 30. Fresh Keith Authorization Requirement

E2E-02 provider-call authorization was fully consumed (1/1 calls used). The authorization is CONSUMED — budget exhausted.

Any future provider call (including E2E-03) requires fresh explicit Keith authorization. Previous authorization does NOT carry forward.

---

## 31. PRIVATE-BETA-INVITE-01 Prohibition

PRIVATE-BETA-INVITE-01 remains:
- **Untouched**
- **Unregistered**
- **Prohibited**

No invitation activity is authorized until all blockers are resolved and a fresh E2E PASSES.

---

## 32. Exact Next Task

**Recommended:** PRIVATE-BETA-BLOCKER-03G — Frontend Confirm-Build-Apply Route Reachability

**NOT YET REGISTERED.** Registration must occur in a separate task window.

**Bounded scope:**
- Fix routing precedence so the Next.js confirm route handles `/api/ai/executions/:executionId/confirm-build-apply` instead of the broad `/api/:path*` Gateway rewrite
- Preserve all other `/api/:path*` Gateway routing
- Preserve session/auth/ownership/INTERNAL_SERVICE_KEY security
- No provider calls, no credit mutations, no Stripe/payment changes
- GLOBAL_EXECUTION_ENABLED=false, BILLING_CHARGES_ENABLED=false
- Minimal reversible config/routing fix
- Provider-free staging validation
- No broad routing redesign

---

## Safety Confirmation

| Safety item | Value |
|-------------|-------|
| Provider calls during Step 4 | **0** |
| GLOBAL_EXECUTION_ENABLED changes during Step 4 | **0** |
| Credit mutations during Step 4 | **0** |
| Staging configuration changes during Step 4 | **0** |
| Source changes during Step 4 | **0** |
| Test changes during Step 4 | **0** |
| Deployments during Step 4 | **0** |
| DB mutations during Step 4 | **0** |
| PM2 restarts during Step 4 | **0** |
| Stripe/payment changes during Step 4 | **0** |
| Git commit/push during Step 4 | **0** |
| GLOBAL_EXECUTION_ENABLED final | **false** |
| BILLING_CHARGES_ENABLED final | **false** |

---

*Checkpoint created: 2026-08-15 — PRIVATE-BETA-BLOCKER-03F Step 4 — documentation/governance + READ-ONLY routing verification only — no source/runtime/provider/balance/deployment mutation.*
