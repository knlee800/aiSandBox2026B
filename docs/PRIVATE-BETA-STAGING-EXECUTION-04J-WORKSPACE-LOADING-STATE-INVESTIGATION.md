# PRIVATE-BETA-STAGING-EXECUTION-04J — Amended Investigation: WorkspaceShell Stuck on Loading State

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04J
**Title:** Staging App UI Version Mismatch Investigation — Step 2 Amended Investigation
**Status:** ACTIVE — Step 2 COMPLETE (Amended Loading-State Investigation — 2026-08-04)
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04 (COMPLETE and LOCKED — 2026-08-04)
**Predecessor:** PRIVATE-BETA-STAGING-EXECUTION-04I (COMPLETE and LOCKED — 2026-08-04)
**Previous step:** 04J Step 1 — Registration + Investigation (COMPLETE — 2026-08-04)
**Registered:** 2026-08-04
**Author:** Cursor / Opus 4.6 (investigation/documentation only — no source code changed — no runtime action)

---

## 1. New Evidence

Keith clarified the expected UI and current staging behavior:

| Field | Value |
|---|---|
| Expected UI | Authenticated WorkspaceShell home view showing `Build anything` |
| Expected URL | `https://staging.ainow.biz/en/app` |
| Observed UI | `Loading workspace...` |
| Observed URL | `https://staging.ainow.biz/en/app` |

This amends the 04J Step 1 investigation which was ambiguous about whether Keith expected:
- The non-project-first workspace (original interpretation A)
- The project-first `Build anything` home view (original interpretation B)
- The Agent Platform RPG dashboard at `/en/platform` (original interpretation C)

**Keith has now clarified: the expected UI is the `Build anything` home view** within the WorkspaceShell at `/en/app`.

---

## 2. Files Read for This Investigation

| File | Purpose |
|---|---|
| `TASKS.md` | Active task ledger — 04J status |
| `TASKS_BACKLOG_FULL.md` | Long-form backlog |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Deployment roadmap |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-STAGING-APP-UI-VERSION-MISMATCH-INVESTIGATION.md` | Step 1 investigation |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04-CHECKPOINT.md` | Parent 04 checkpoint |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-CHECKPOINT.md` | 04I browser smoke checkpoint |
| `frontend/app/[locale]/app/page.tsx` | App route — loading state gate and auth initialization |
| `frontend/app/[locale]/page.tsx` | Public landing page — `PublicLandingSlice` |
| `frontend/components/workspace/workspace-shell.tsx` | WorkspaceShell — `Build anything` home view |
| `frontend/components/workspace/workspace-sidebar.tsx` | `getWorkspaceScaffoldMessages` — locale message resolution |
| `frontend/components/workspace/workspace-shell.test.tsx` | Test for `Build anything` rendering |
| `frontend/components/public/public-landing-slice.tsx` | Public landing `hero` text |
| `frontend/next.config.js` | API rewrite proxy configuration |
| `frontend/Dockerfile` | Build-time env defaults |
| `frontend/messages/en.json` | English locale messages |
| `frontend/messages/zh-TW.json` | Traditional Chinese locale messages |
| `frontend/messages/zh-CN.json` | Simplified Chinese locale messages |
| `frontend/lib/feature-flags.ts` | Feature flag definitions |
| `services/api-gateway/src/main.ts` | API Gateway listen port |
| `services/api-gateway/src/auth/auth.controller.ts` | Auth routes (GET /me) |
| `services/api-gateway/src/auth/auth.service.ts` | Session validation logic |
| `services/api-gateway/src/auth/session-cookie.guard.ts` | Session cookie guard |
| `docker-compose.yml` | Docker service definitions |
| `docker-compose.prod.yml` | Production Docker composition |
| `docs/BETA-READY-DEPLOYMENT-CONFIG-STAGE-START.md` | Deployment config reference |
| `docs/PRIVATE-BETA-STAGING-SETUP-05-ENV-CHECKLIST.md` | Env checklist |

---

## 3. Investigation Q&A

### Q1. Where exactly is the authenticated `Build anything` UI rendered in WorkspaceShell?

**Source:** `frontend/components/workspace/workspace-shell.tsx`

- Line 2165: `const homeWorkspaceContent = (` — JSX block defining the home view
- Line 2166: `data-testid="workspace-home-view"` — test identifier
- Line 2173: `{scaffoldMessages.buildAnything}` — renders the "Build anything" heading
- Line 783: `const scaffoldMessages = getWorkspaceScaffoldMessages(locale)` — locale resolution
- Locale source: `workspace-sidebar.tsx` line 105: `buildAnything: read('workspace.buildAnything')`
- Translation keys confirmed in all three locales:
  - `en.json` line 124: `"buildAnything": "Build anything"`
  - `zh-TW.json` line 124: `"buildAnything": "打造任何內容"`
  - `zh-CN.json` line 124: `"buildAnything": "构建任何内容"`

**Critical rendering condition:**

The `homeWorkspaceContent` block is rendered at line 2509–2511:
```
{!shouldShowFocusedCreateWorkspacePanel && resolvedWorkspaceView === 'home'
  ? homeWorkspaceContent
  : null}
```

BUT this code is inside the `projectFirstUxEnabled === true` rendering branch (after line 2416). The `!projectFirstUxEnabled` branch (lines 2286–2416) renders a completely different layout that does NOT include `homeWorkspaceContent`.

**Conclusion:** `Build anything` is ONLY rendered when `projectFirstUxEnabled === true` AND `workspaceView === 'home'`.

---

### Q2. What state conditions must be false/true before WorkspaceShell leaves "Loading workspace..."?

The `Loading workspace...` text is NOT in WorkspaceShell. It is in the parent route component:

**Source:** `frontend/app/[locale]/app/page.tsx` lines 5819–5825:
```tsx
if (authLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-600">Loading workspace...</p>
    </div>
  );
}
```

**Required state:** `authLoading === false` to proceed past this gate and render `WorkspaceShell`.

`authLoading` is initialized as `true` at line 893:
```tsx
const [authLoading, setAuthLoading] = useState(true);
```

---

### Q3. Which loading flags control the "Loading workspace..." state?

**Single flag: `authLoading`**

- `useState(true)` at line 893 — starts as `true` on mount
- `setAuthLoading(false)` at line 1223 — ONLY set to `false` after successful `/api/auth/me` response with valid user ID
- `setAuthLoading(true)` at line 1113 — reset to `true` by `handleWorkspaceUnauthorizedAccess()` (called when subsequent API calls return 401)

No other loading flags control the "Loading workspace..." gate. `isLoadingSessions`, `isLoadingDashboard`, etc., are separate — they affect WorkspaceShell internals AFTER the auth gate.

---

### Q4. Which API calls/hooks must succeed before the home view is shown?

**Critical path to clear `authLoading` gate:**

1. `fetch('/api/auth/me')` — line 1212
   - Must return `response.ok === true`
   - Response body must contain `{ id: <non-empty string> }`
   - On success: `setAuthLoading(false)` at line 1223

**API call routing on staging:**

Browser fetch → `https://staging.ainow.biz/api/auth/me` → Caddy → Next.js (port 3002) → Next.js rewrites (`next.config.js` line 10–16) → `API_GATEWAY_URL/api/auth/me` → API Gateway (port 4000)

Next.js rewrite configuration:
```js
const apiBase = process.env.API_GATEWAY_URL || 'http://localhost:4000';
return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
```

API Gateway endpoint:
```ts
@UseGuards(SessionCookieGuard)
@Get('me')
async getProfile(@Request() req) {
  return this.authService.getUserById(req.user.userId);
}
```

`SessionCookieGuard` checks `req.cookies?.aisandbox_session` → `authService.validateSessionToken(rawToken)` → database lookup (`authSessionRepository.findOne`).

**Post-auth API calls (fire AFTER `authLoading` clears — do NOT gate the loading state):**

2. `loadSessions()` — `GET /api/sessions?includeTerminated=true` (line 1759)
3. `loadDashboardSlice()` — `GET /api/users/me`, `GET /api/users/me/usage`, `GET /api/users/me/quotas` (lines 3707–3715)
4. If `PROJECT_FIRST_UX`: `loadWorkspacesForUser()` — workspace API calls (line 1876)
5. If `PROJECT_FIRST_UX`: `loadPublicWorkspaceProjectsList()` — public project list (line 1228)

---

### Q5. Which failure paths keep the UI stuck in loading instead of showing an error or fallback?

**ONLY ONE scenario keeps the UI stuck on "Loading workspace...":**

The `/api/auth/me` fetch never resolves (promise hangs indefinitely).

All defined failure paths redirect to login:
- `!meResponse.ok` → `router.push(`/${locale}/login`)` (line 1214)
- `typeof me.id !== 'string' || !me.id.trim()` → `router.push(`/${locale}/login`)` (lines 1218–1220)
- `catch` block → `router.push(`/${locale}/login`)` (line 1231)

There is NO `finally` block, NO timeout, and NO error fallback that clears `authLoading` without also redirecting. If the fetch promise never settles, the component remains in the `authLoading === true` state indefinitely.

**Secondary stuck scenario (transient):**

If auth succeeds but a subsequent API call (e.g., `loadSessions`) returns 401, `handleWorkspaceUnauthorizedAccess()` is called (line 1112). This resets `authLoading = true` AND calls `router.push(`/${locale}/login`)`. The user would briefly see "Loading workspace..." again before being redirected. This is transient, not permanent.

---

### Q6. Does `PROJECT_FIRST_UX` affect the loading state or only the post-load view?

**`PROJECT_FIRST_UX` does NOT affect the `authLoading` gate.**

`PROJECT_FIRST_UX` (build-time constant from `frontend/lib/feature-flags.ts`) affects:
1. Cold-mount session/project/workspace storage restoration (lines 1163–1200) — runs BEFORE auth check but only reads from `sessionStorage`
2. `loadWorkspacesForUser()` and `loadPublicWorkspaceProjectsList()` calls — fired AFTER auth succeeds (lines 1226–1229)
3. WorkspaceShell rendering: when `false`, line 2286 returns the non-project-first layout (no `Build anything`)
4. Various session persistence, project-first navigation, and autosave behaviors

**`PROJECT_FIRST_UX` has ZERO impact on whether `Loading workspace...` is shown or cleared.**

---

### Q7. Does `NEXT_PUBLIC_PROJECT_FIRST_UX=true` plausibly fix the stuck loading state?

**NO.**

Setting `NEXT_PUBLIC_PROJECT_FIRST_UX=true` would:
- ✅ Enable the `Build anything` home view in WorkspaceShell (when auth succeeds)
- ❌ NOT fix the `authLoading` gate
- ❌ NOT fix a hanging `/api/auth/me` fetch
- ❌ NOT add a timeout or fallback for the auth check

**If the loading state is stuck because `/api/auth/me` never resolves, `PROJECT_FIRST_UX` is irrelevant.**

---

### Q8. Are AI/container/session/project APIs required before the home view appears?

**NO.**

The ONLY API required before the home view is `/api/auth/me`. All other APIs (sessions, dashboard, workspaces, projects) fire AFTER `authLoading` clears and do NOT gate the main loading screen.

If `/api/auth/me` succeeds, `WorkspaceShell` renders regardless of whether subsequent APIs succeed or fail. Subsequent failures set error states within WorkspaceShell panels, not the outer loading gate.

---

### Q9. Are kill switches or disabled services likely to keep WorkspaceShell stuck?

**UNLIKELY for the `authLoading` gate.**

Kill switches in the platform:
- `GLOBAL_EXECUTION_ENABLED` — controls `/api/ai/execute` — NOT involved in auth
- AI Service kill switch — controls AI execution — NOT involved in auth
- Container Manager kill switch — controls containers — NOT involved in auth

None of these affect `/api/auth/me` or `SessionCookieGuard`.

**However:** If the API Gateway itself is down (not responding), the `/api/auth/me` fetch would hang — this IS a service availability issue, not a kill switch issue.

---

### Q10. Does `/en/app` render WorkspaceShell directly, or is there an auth/session wrapper first?

**There is an auth gate BEFORE WorkspaceShell.**

`frontend/app/[locale]/app/page.tsx` defines a `'use client'` component (`AppPage`) that:
1. Mounts with `authLoading = true`
2. Shows "Loading workspace..." while `authLoading === true`
3. Fetches `/api/auth/me` in a `useEffect`
4. On success: clears `authLoading`, renders `<WorkspaceShell ... />`
5. On failure: redirects to login

The file is approximately 5919 lines. `WorkspaceShell` is rendered starting at line 5828. All initialization, state management, and API orchestration lives in this single `AppPage` component — `WorkspaceShell` receives props and is a pure presentation/interaction component.

---

### Q11. Are there tests covering the loading-to-home transition?

**PARTIAL COVERAGE.**

**Tests that exist:**
- `workspace-shell.test.tsx` line 2117–2126: Tests that with `projectFirstUxEnabled: true` and `workspaceView: 'home'`, the output contains `workspace-home-view`, `>Build anything<`, and `workspace-home-input`. This confirms the WorkspaceShell rendering AFTER auth.
- `login/page.test.tsx`: Tests post-login redirect to `/en/app`.

**Tests that do NOT exist:**
- No test file `frontend/app/[locale]/app/page.test.tsx` exists
- No integration test covering the `authLoading` → `setAuthLoading(false)` → `WorkspaceShell` transition
- No test for the "Loading workspace..." fallback or timeout behavior
- No test for `/api/auth/me` failure → redirect to login flow from `AppPage`
- No test for the fetch-hang scenario

---

### Q12. Are loading/error/empty states implemented correctly for staging-private-beta conditions?

**PARTIALLY.**

**Issues identified:**

1. **No timeout on auth check:** If `/api/auth/me` never resolves, the page stays stuck on "Loading workspace..." forever. There is no `AbortController`, no timeout, and no retry mechanism.

2. **Hardcoded English loading text:** Line 5822 — `Loading workspace...` is hardcoded English, violating the multilingual-first rule. Should use a locale key from `en.json`/`zh-TW.json`/`zh-CN.json`.

3. **No error fallback for auth gate:** If the fetch hangs, no user-visible error or retry option is presented. The user sees a plain centered "Loading workspace..." text indefinitely.

4. **WorkspaceShell non-project-first fallback:** When `PROJECT_FIRST_UX=false`, the non-project-first layout (lines 2286–2416) contains several hardcoded English strings: "AI Sandbox Workspace", "Session-scoped workspace", "API Keys", "Log out", "Stop", "Stopping...", "Remove", "Workspace", "Sessions:".

---

### Q13. What is the smallest safe fix path?

See Section 7 below.

---

### Q14. Should the next step be runtime diagnosis, source fix, env/build config fix, or deferral?

**Runtime safe browser/network diagnosis FIRST.** See Section 7.

---

## 4. Source Mapping

```
/en/app route
  → frontend/app/[locale]/app/page.tsx (AppPage component)
    → workspaceView = useState('home') [line 958]
    → authLoading = useState(true) [line 893]
    → useEffect [line 1158, depends on locale, router]
      → Reads sessionStorage (PROJECT_FIRST_UX cold-mount seeds) [lines 1163-1200]
      → async IIFE [line 1210]
        → fetch('/api/auth/me') [line 1212]
          → Next.js rewrites → API_GATEWAY_URL/api/auth/me [next.config.js]
          → SessionCookieGuard → validateSessionToken → DB lookup
        → SUCCESS PATH:
          → setUserId(me.id) [line 1222]
          → setAuthLoading(false) [line 1223] ← CLEARS LOADING GATE
          → loadSessions() [line 1224] (async, non-blocking)
          → loadDashboardSlice() [line 1225] (async, non-blocking)
          → if PROJECT_FIRST_UX: loadWorkspacesForUser() [line 1227]
          → if PROJECT_FIRST_UX: loadPublicWorkspaceProjectsList() [line 1228]
          → WorkspaceShell renders with workspaceView='home' [line 5828]
            → if projectFirstUxEnabled:
              → homeWorkspaceContent [line 2509-2510]
                → "Build anything" [line 2173] ← TARGET UI
            → if !projectFirstUxEnabled:
              → non-project-first layout [line 2286-2416]
                → "AI Sandbox Workspace" header
                → session sidebar
                → NO "Build anything"
        → FAILURE PATH (non-ok):
          → router.push('/${locale}/login') [line 1214]
        → FAILURE PATH (invalid user ID):
          → router.push('/${locale}/login') [line 1219-1220]
        → FAILURE PATH (exception):
          → router.push('/${locale}/login') [line 1231]
        → STUCK PATH (fetch hangs):
          → authLoading remains true forever
          → "Loading workspace..." shown indefinitely [line 5822]
          → NO timeout, NO abort, NO retry, NO error UI
```

---

## 5. Reassessment of Previous 04J Step 1 Conclusion

### Previous Option A: Set `NEXT_PUBLIC_PROJECT_FIRST_UX=true` on VPS, rebuild, restart

**Reassessment: Possibly helpful but insufficient.**

| Aspect | Assessment |
|---|---|
| Fixes "Build anything" not showing when auth succeeds? | ✅ YES — enables project-first branch with `homeWorkspaceContent` |
| Fixes "Loading workspace..." stuck state? | ❌ NO — has zero effect on `authLoading` gate or `/api/auth/me` fetch |
| Addresses the root cause Keith now reports? | ❌ PARTIAL — Keith sees "Loading workspace...", which is upstream of the view branch |
| Still recommended? | YES, but ONLY after confirming `/api/auth/me` is healthy — it is a necessary but not sufficient fix |

**Previous 04J Step 1 assumed** the auth check was passing and the issue was purely about which workspace layout was rendered. The new evidence ("Loading workspace..." stuck) indicates the problem is UPSTREAM — the auth check itself may not be completing.

---

## 6. Root-Cause Category Assessment

| Category | Assessment | Likelihood |
|---|---|---|
| **A. Initialization API call fails** | If `/api/auth/me` returns non-ok, user is redirected to login — NOT stuck on loading. If a subsequent call (sessions, dashboard) returns 401, `handleWorkspaceUnauthorizedAccess` fires → redirects to login. Neither keeps user permanently stuck. | LOW for permanent stuck state |
| **B. API call never resolves / promise hang** | If `/api/auth/me` fetch never settles, the `authLoading` gate never clears. There is no timeout, no AbortController, no retry. This is the ONLY code path that results in a permanent "Loading workspace..." state. | **HIGH — most likely cause of permanent loading state** |
| **C. Error path does not clear loading state** | All error paths in the auth IIFE either redirect to login (clearing the page) or throw (caught by catch block which also redirects). No error path leaves `authLoading === true` without also navigating away. | LOW |
| **D. Empty data but broken empty-state transition** | The `authLoading` gate is purely about auth status, not data. Empty sessions/projects/workspaces are handled by WorkspaceShell AFTER auth clears. | NOT APPLICABLE to loading gate |
| **E. Auth/session state not available to frontend** | If the `aisandbox_session` cookie is missing, expired, or not forwarded by the Next.js rewrite proxy, the API Gateway returns 401, and the frontend redirects to login. User would see the login page, not "Loading workspace...". | MEDIUM — could explain redirect-to-login, but NOT permanent loading |
| **F. Required service disabled by kill switch** | No kill switch affects `/api/auth/me` or `SessionCookieGuard`. Auth is always enabled. | NOT APPLICABLE |
| **G. PROJECT_FIRST_UX=false** | Does NOT affect the `authLoading` gate at all. Only affects which WorkspaceShell layout renders AFTER auth succeeds. | NOT APPLICABLE to loading state; APPLICABLE to "Build anything" not showing |
| **H. NEXT_PUBLIC_PROJECT_FIRST_UX missing at build time** | Same as G — only affects post-auth rendering. `Build anything` is in the project-first branch (lines 2286+ vs 2416+). | NOT APPLICABLE to loading state; **CONFIRMED cause of missing "Build anything"** |
| **I. Browser cache/session causes stale perception** | Possible. If Keith's session expired, a fresh visit shows "Loading workspace..." briefly before redirect to login. An aggressive browser cache might not reflect the latest JS bundle. | LOW-MEDIUM |
| **J. User expected RPG dashboard; now clarified as WorkspaceShell** | RESOLVED. Keith confirms expected UI is "Build anything" at `/en/app`. | RESOLVED |

**Primary root-cause assessment:**

There are TWO distinct issues:

1. **"Loading workspace..." stuck** — Most likely **Category B** (API call hang). The fetch to `/api/auth/me` never resolves, leaving `authLoading === true` indefinitely. Sub-causes:
   - API Gateway not running or unresponsive
   - Next.js rewrite proxy unable to reach `API_GATEWAY_URL` (port mismatch, connectivity)
   - Database connection hang in `validateSessionToken` → `findOne`
   - PM2 process crash/restart loop since last 04I validation
   - Requires runtime diagnosis to confirm.

2. **"Build anything" not rendered** — Confirmed **Category H**. `PROJECT_FIRST_UX=false` on staging means the non-project-first layout renders (line 2286), which does NOT include `homeWorkspaceContent` (with "Build anything"). This is a build-time env issue.

---

## 7. Smallest Safe Next Step

### Recommended: Two-phase approach

#### Phase 1 — Runtime safe browser/network diagnosis (ZERO risk)

Keith performs these browser-only checks (no SSH, no server changes):

1. Open `https://staging.ainow.biz/en/app` in browser
2. Open DevTools → Network tab
3. Look for `/api/auth/me` request:
   - **If status 401:** Session expired. Log in again at `/en/login`. After login, check if WorkspaceShell loads (even without "Build anything").
   - **If status 200:** Auth is working. `authLoading` should clear. If it doesn't, check the response body — does it contain `{ id: "..." }`?
   - **If pending/hanging (no response):** The API Gateway is unreachable. → Phase 1b: SSH and check PM2 status and API Gateway health.
   - **If network error / ERR_CONNECTION_REFUSED:** The Next.js rewrite proxy can't reach the API Gateway. → Phase 1b.

4. If auth succeeds and WorkspaceShell renders:
   - If "Build anything" is visible: unexpected — the PROJECT_FIRST_UX flag may have been set. Investigation complete.
   - If "AI Sandbox Workspace" header is visible: confirmed non-project-first layout → proceed to Phase 2.

#### Phase 2 — Enable PROJECT_FIRST_UX + rebuild (LOW risk)

If Phase 1 confirms auth works but `Build anything` is not visible:

```bash
# On VPS (Keith executes manually — not via Cursor)
export NEXT_PUBLIC_PROJECT_FIRST_UX=true
cd /opt/aisandbox/frontend
npm run build
pm2 restart aisandbox-frontend --update-env
unset NEXT_PUBLIC_PROJECT_FIRST_UX
```

**Risk:** Low. Build-time flag. Reversible. No source change.

---

## 8. Additional Findings

### 8.1. Hardcoded English loading text (multilingual-first violation)

`frontend/app/[locale]/app/page.tsx` line 5822:
```tsx
<p className="text-sm text-gray-600">Loading workspace...</p>
```

This is hardcoded English. The multilingual-first rule requires this to use a locale key. Recommended future fix:
- Add `workspace.loading` key to `en.json` / `zh-TW.json` / `zh-CN.json`
- Replace hardcoded string with `{scaffoldMessages.loading}` or equivalent

### 8.2. No auth timeout / error fallback

The auth check has no timeout or user-visible error recovery. If `/api/auth/me` hangs, the user is permanently stuck. Recommended future fix:
- Add `AbortController` with 10–15 second timeout
- On timeout: show error UI with retry button and link to login page

### 8.3. Non-project-first layout has hardcoded English

The non-project-first WorkspaceShell branch (lines 2286–2416) contains hardcoded English strings:
- "AI Sandbox Workspace" (line 2291)
- "Session-scoped workspace" (line 2292)
- "API Keys" (line 2303)
- "Log out" (line 2313)
- "Stopping..." / "Stop" (line 2389)
- "Remove" (line 2397)
- "Workspace" (line 2411)
- "Sessions:" (line 2412)

These violate the multilingual-first rule but are lower priority since the project-first layout is the intended private-beta experience.

### 8.4. `Build anything` exists in TWO locations

1. **Public landing page** (`frontend/app/[locale]/page.tsx` → `PublicLandingSlice`): `{strings.hero}` resolves to `landing.hero` = "Build anything" in `en.json` line 89. Visible at `https://staging.ainow.biz/en` (unauthenticated).

2. **Authenticated workspace home** (`workspace-shell.tsx` line 2173): `{scaffoldMessages.buildAnything}` resolves to `workspace.buildAnything` = "Build anything" in `en.json` line 124. Visible at `https://staging.ainow.biz/en/app` (authenticated, `PROJECT_FIRST_UX=true`).

---

## 9. Staging Deployment State Assessment (Updated)

| Check | Finding |
|---|---|
| VPS HEAD | `40c43af Reconcile staging root redirect state` |
| Local HEAD | `3a4aae6 Complete private beta staging execution 04` |
| Frontend source on VPS | Current — latest WorkspaceShell, `Build anything`, all i18n keys present |
| `NEXT_PUBLIC_PROJECT_FIRST_UX` on staging | NOT SET — evaluates to `false` at build time |
| `API_GATEWAY_URL` on staging | NOT VERIFIED — default `http://localhost:4000` if unset |
| API Gateway listen port | Default 4000 (`process.env.PORT \|\| process.env.API_PORT \|\| 4000`) |
| API Gateway health (last verified 04I) | `API_HEALTH=200`, `API_DB_HEALTH=200`, `API_READY=200` |
| Time since last verification | 04I completed 2026-08-04 — current 2026-08-04 — same day |
| "Loading workspace..." source | `page.tsx` line 5822 — `authLoading === true` gate |
| "Build anything" source | `workspace-shell.tsx` line 2173 — project-first branch only |

---

## 10. Recommendation

### Whether this blocks private beta

**YES — this blocks user invites (NOT infrastructure readiness).**

If users are invited to `https://staging.ainow.biz/en/app` and see "Loading workspace..." stuck, the product is unusable. This must be resolved before invites.

Infrastructure readiness (04 COMPLETE and LOCKED) is NOT affected. PRIVATE-BETA-DEPLOYMENT-READINESS can proceed with its remaining checklist items concurrently — but user invites should not occur until the workspace loads.

### Recommended fix order

1. **Phase 1: Runtime browser diagnosis** — Keith checks DevTools network tab for `/api/auth/me` status. ZERO risk. 5 minutes.
2. **If auth issue found:** Diagnose API Gateway health via SSH. Fix as needed (PM2 restart, env check).
3. **If auth works but "Build anything" missing:** Phase 2 — enable `NEXT_PUBLIC_PROJECT_FIRST_UX=true`, rebuild, restart frontend.
4. **Optional future hardening:** Add auth timeout, i18n for loading text, remove hardcoded English from non-project-first layout.

### Classification of previous Option A

**Possibly helpful but insufficient.** Option A (enable `NEXT_PUBLIC_PROJECT_FIRST_UX=true`) fixes the "Build anything" visibility issue but does NOT address the "Loading workspace..." stuck state. Option A should be paused until runtime diagnosis confirms the auth check is healthy.

---

## 11. Acceptance Criteria — Step 2 (Amended Investigation)

- [x] Amended 04J loading-state investigation doc created
- [x] `Build anything` authenticated WorkspaceShell source identified: `workspace-shell.tsx` line 2173, project-first branch only
- [x] `Loading workspace...` source identified: `page.tsx` line 5822, `authLoading === true` gate
- [x] Loading state control flow mapped (Section 4)
- [x] Initialization API calls/hooks identified: `/api/auth/me` at `page.tsx` line 1212
- [x] Failure/stuck paths identified: fetch-hang is only path to permanent loading (Section 5 Q5)
- [x] `PROJECT_FIRST_UX` relevance reassessed: no effect on loading gate; required for `Build anything`
- [x] Option A reassessed: possibly helpful but insufficient (Section 5 Q7, Section 10)
- [x] Smallest safe next step recommended: runtime browser diagnosis FIRST (Section 7)
- [x] TASKS.md updated
- [x] TASKS_BACKLOG_FULL.md updated
- [x] Roadmap updated
- [x] No source code changed
- [x] No env files opened/changed
- [x] No env values printed or recorded
- [x] No runtime/server action occurred
- [x] No Docker/PostgreSQL/Redis action occurred
- [x] No email/account/login action occurred
- [x] No git commit or push

---

## 12. Final Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04J | **ACTIVE — Step 2 COMPLETE (Amended Loading-State Investigation — 2026-08-04)** |
| PRIVATE-BETA-STAGING-EXECUTION-04I | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED — pending 04J runtime diagnosis + resolution |

---

## 13. Next Recommended Action

**04J Step 3: Runtime safe browser diagnosis**

Keith performs browser DevTools network check at `https://staging.ainow.biz/en/app`:
- If `/api/auth/me` returns 401 → re-login → check if WorkspaceShell renders
- If `/api/auth/me` hangs → SSH and check API Gateway health
- If `/api/auth/me` returns 200 but "Build anything" not visible → proceed to Phase 2 (enable `PROJECT_FIRST_UX`)

Stop here. Await Keith's runtime diagnosis before any fix action.

---

## 14. Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or changed by Cursor
- ✅ No env values read, printed, or recorded
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No email/account/login/AI/billing/container/OAuth action
- ✅ No git commit or push
- ✅ No subagents used
