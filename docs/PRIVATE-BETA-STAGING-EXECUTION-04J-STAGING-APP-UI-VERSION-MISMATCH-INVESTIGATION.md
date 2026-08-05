# PRIVATE-BETA-STAGING-EXECUTION-04J — Staging App UI Version Mismatch Investigation

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04J
**Title:** Staging App UI Version Mismatch Investigation
**Status:** ACTIVE — Step 1 COMPLETE (Registration + Investigation — 2026-08-04)
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04 (COMPLETE and LOCKED — 2026-08-04)
**Predecessor:** PRIVATE-BETA-STAGING-EXECUTION-04I (COMPLETE and LOCKED — 2026-08-04)
**Registered:** 2026-08-04
**Author:** Cursor / Sonnet 4.6 (governance + investigation only — no source code changed — no runtime action)

---

## 1. Origin

During Path F browser validation in PRIVATE-BETA-STAGING-EXECUTION-04I, Keith observed:

> "Visible page is latest expected UI: NO"

The URL loaded successfully: `https://staging.ainow.biz/en/app`.
Infrastructure passed (HTTPS lock valid, no localhost in URL, app page loaded, stayed authenticated).

The UI mismatch was classified in 04I as a **separate UX/UI or deployed-version mismatch** — not an infrastructure smoke blocker — and deferred to 04J for investigation.

---

## 2. Observation Summary

| Field | Value |
|---|---|
| Observed URL | `https://staging.ainow.biz/en/app` |
| Infrastructure result | PASS (HTTPS, auth, routing) |
| UI observation | "Visible page is latest expected UI: NO" |
| Classification | Non-blocking UX/UI or deployed-version mismatch |
| Source task | 04I Path F — 2026-08-04 |

---

## 3. Files Read for This Investigation

| File | Purpose |
|---|---|
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-CHECKPOINT.md` | Source of 04I Path F evidence and UI mismatch record |
| `TASKS.md` | Active task ledger — 04 / 04I status |
| `TASKS_BACKLOG_FULL.md` | Long-form backlog |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Deployment roadmap |
| `frontend/app/[locale]/app/page.tsx` | Route source for `/en/app` |
| `frontend/app/[locale]/platform/page.tsx` | Platform dashboard route source |
| `frontend/app/[locale]/driver/page.tsx` | Legacy driver route source |
| `frontend/components/workspace/workspace-shell.tsx` | WorkspaceShell component (primary app UI) |
| `frontend/components/platform/platform-dashboard.tsx` | Agent Platform RPG dashboard component |
| `frontend/lib/feature-flags.ts` | Feature flag definitions |
| `frontend/middleware.ts` | Locale middleware / auth redirect behavior |
| `frontend/Dockerfile` | Build-time env variable defaults |
| `services/api-gateway/src/auth/auth.controller.ts` | Post-login redirect source |
| `frontend/app/[locale]/login/page.tsx` | Login page — post-login redirect |
| `frontend/app/[locale]/login/page.test.tsx` | Login tests — confirmed `/en/app` redirect |
| `git log` output | Commit history for frontend source files |

---

## 4. Q&A: Investigation Findings

### Q1. Which source route renders `https://staging.ainow.biz/en/app`?

**`frontend/app/[locale]/app/page.tsx`**

This is a Next.js dynamic locale route: `[locale]/app/page.tsx`. With `locale = 'en'`, it renders at `/en/app`.

---

### Q2. What UI/page is currently expected by source for that route?

The route renders **`WorkspaceShell`** — the full AI code sandbox workspace UI.

The `WorkspaceShell` component is the primary product UI: Monaco editor, chat panel, AI execution, file tree, checkpoint history, preview panel, project management sidebar. It was progressively improved through the UX-IA task family (UX-IA-01 through UX-IA-39), AUTH-MODULE tasks, AI-CONTEXT tasks, PREVIEW tasks, HOME-START, APP-ROUTE-RESTORE, and AGENT-PLATFORM-RPG-03B.

---

### Q3. Is the latest expected UI actually implemented in source?

**YES** — the WorkspaceShell at HEAD `40c43af` is the latest version of the workspace component.

Last meaningful source modification of workspace files:
- `workspace-shell.tsx` → `5727d63 feat(AGENT-PLATFORM-RPG-03B)`
- `app/[locale]/app/page.tsx` → `aa5f072 feat(APP-ROUTE-RESTORE)`

Both predate the private-beta staging commits (`40c43af`, `3a4aae6`), confirming the deployed source is current.

---

### Q4. If implemented, is it under a different route?

**YES — a second newer component exists at a different route.**

`/en/platform` renders **`PlatformDashboard`** — the Agent Platform RPG Office/Town dashboard.

This was implemented through the `AGENT-PLATFORM` family:
- `ee05eb3 feat(AGENT-PLATFORM): Phase 1 Static RPG Office/Town Dashboard Shell`
- `c520c66 feat(AGENT-PLATFORM): Phase 2 Dashboard Navigation and Interactions`
- `c18edd2 feat(AGENT-PLATFORM-RPG-03A): Platform Dashboard Visual Identity and Agent Detail Panel`
- `e155806 feat(AGENT-PLATFORM-CREATE-01B): Create Agent MVP UI`

The `PlatformDashboard` is NOT wired to `/en/app`. It is a separate route that users can navigate to from within the workspace sidebar (via a "Platform" link added in `5727d63 feat(AGENT-PLATFORM-RPG-03B)`).

---

### Q5. Is the latest expected UI behind a feature flag, environment variable, project/session condition, or locale condition?

**YES — partially.**

`PROJECT_FIRST_UX` is a build-time feature flag:

```ts
// frontend/lib/feature-flags.ts
export const PROJECT_FIRST_UX = process.env.NEXT_PUBLIC_PROJECT_FIRST_UX === 'true';
```

The `Dockerfile` defaults this to `false`:
```
ARG NEXT_PUBLIC_PROJECT_FIRST_UX=false
ENV NEXT_PUBLIC_PROJECT_FIRST_UX=$NEXT_PUBLIC_PROJECT_FIRST_UX
```

The staging VPS build was performed via direct `npm run build` (not Docker). There is no `frontend/.env` or `frontend/.env.local` file in the repository. `NEXT_PUBLIC_PROJECT_FIRST_UX` is not set in the VPS shell environment during build.

**Conclusion: `PROJECT_FIRST_UX` is `false` on staging.** This disables:
- Workspace route/session preservation on browser reload
- Project-first navigation (opening directly to a project view rather than the home/projects list)
- Several workspace initialization behaviors tied to the project-first experience

This means staging shows the **non-project-first workspace home view** (project card list + template gallery) instead of the **project-first workspace** (which opens directly into a selected project). This may be the UX difference Keith observed.

---

### Q6. If implemented, was it never deployed to staging because current VPS HEAD is still `40c43af`?

**No — this is NOT the primary cause.**

VPS HEAD `40c43af` does include the latest frontend source. 04I2E performed a fresh build with `git reset --hard origin/main` at `40c43af`. The subsequent commit `3a4aae6` (local HEAD) only changed governance docs — no frontend source was touched.

All frontend source changes through `e155806` (AGENT-PLATFORM-CREATE-01B) are present in the VPS build at `40c43af`.

---

### Q7. Is the "latest expected UI" the RPG/Agent Platform dashboard or another app page?

**Ambiguous — two possible interpretations:**

1. **Keith expected the Agent Platform RPG dashboard** (`/en/platform`) to be the post-login landing page, but instead sees the WorkspaceShell at `/en/app`.
2. **Keith expected the project-first workspace** (with `PROJECT_FIRST_UX=true`) but sees the non-project-first home view (with `PROJECT_FIRST_UX=false` on staging).

Both interpretations are consistent with the "not latest expected UI" observation.

---

### Q8. Is `/en/app` intentionally still legacy while another route should be the new default?

**Not by documented intent.** There is no registered task or governance entry indicating that `/en/app` should be replaced by `/en/platform` as the default authenticated landing page. The workspace shell IS the primary product route. The platform dashboard at `/en/platform` is a complementary feature accessible from within the workspace.

However, if Keith's intent for private beta is for users to land on the platform dashboard (not the workspace), this should be explicitly registered and discussed.

---

### Q9. Does middleware/auth redirect always send users to `/en/app`?

**YES.**

Two confirmed redirect paths:

1. **Login page** (`frontend/app/[locale]/login/page.tsx`, lines 81 and 107):
   ```tsx
   router.replace(`/${locale}/app`);
   ```
   Test confirms: `harness.replaceCalls, ['/en/app']` (login/page.test.tsx lines 256, 271).

2. **OAuth flow** (`services/api-gateway/src/auth/auth.controller.ts`, lines 287 and 353):
   ```ts
   response.redirect(this.buildOAuthRedirectPath(locale, '/app'));
   ```
   Allowed post-OAuth redirects: `new Set(['/app', '/login'])` (line 47).

Both paths send users to `/en/app`. There is no path that sends users to `/en/platform` after authentication.

---

### Q10. Does the frontend route reference old components while newer components exist unused?

**Partially.**

- `WorkspaceShell` at `/en/app` IS the current, updated component.
- `PlatformDashboard` at `/en/platform` is a newer/different component accessible only via a sidebar link, never via post-login redirect.
- `/en/driver` is a raw dev-era driver page (hardcoded inline styles, "Phase 37C" label) — clearly legacy/dev-only, but not wired to any user-facing redirect.
- `PROJECT_FIRST_UX=false` on staging means the workspace opens in "home" mode (project card selection) rather than the project-first experience, which might look visually less polished or "older" than the local dev experience where the flag may be enabled.

---

### Q11. Are translations missing for the latest expected UI?

**No translation gaps identified for the core workspace or platform dashboard.**

`workspace-shell.tsx`, `workspace-sidebar`, and `platform-dashboard.tsx` all import from `en.json`, `zh-TW.json`, and `zh-CN.json` at the top of the file and use locale-resolved message functions throughout. Translation coverage appears complete for the existing UI components.

No new UI-facing text was introduced in recent governance-only commits.

---

### Q12. Are there tests that define the expected authenticated landing page?

**YES.**

`frontend/app/[locale]/login/page.test.tsx` explicitly asserts the post-login redirect destination:
```ts
assert.deepEqual(harness.replaceCalls, ['/en/app']);
```

This confirms `/en/app` is the intended and tested authenticated landing destination. Any change to the landing page would require updating this test.

---

### Q13. What is the smallest safe fix path?

See Section 8 below.

---

### Q14. Should this block private beta deployment readiness?

**Assessment: NOT a hard blocker for infrastructure readiness. Decision depends on business intent.**

The infrastructure (routing, auth, email, HTTPS) is fully working. The app loads at `/en/app`. The mismatch is about which UX mode or experience is shown.

If "private beta" means inviting real users to test the AI code sandbox workspace, the current WorkspaceShell is the correct product. Enabling `PROJECT_FIRST_UX=true` on staging is the lowest-risk improvement.

If "private beta" means showcasing the Agent Platform RPG dashboard as the landing experience, that requires a source change to the login redirect — a larger, separately-scoped task.

---

## 5. Root-Cause Category Assessment

| Category | Assessment |
|---|---|
| A. Latest UI not implemented yet | **UNLIKELY.** WorkspaceShell is fully implemented and up-to-date. |
| B. Latest UI implemented but not wired to /en/app | **PARTIAL.** PlatformDashboard exists at /en/platform but is NOT wired to the auth redirect. WorkspaceShell IS correctly wired. |
| C. Latest UI implemented under a different route | **CONFIRMED.** Agent Platform RPG dashboard lives at /en/platform, not /en/app. Users never land there after login. |
| D. Latest UI behind a disabled feature flag | **CONFIRMED CONTRIBUTING CAUSE.** `PROJECT_FIRST_UX=false` on staging disables project-first navigation in the workspace. The workspace renders in "home" view mode rather than the project-first experience. |
| E. Staging VPS has not pulled/built the latest source | **NOT PRIMARY CAUSE.** 04I2E built at HEAD `40c43af`. All frontend source changes are included. Next commit (`3a4aae6`) was governance-only. |
| F. Auth redirect points to legacy route | **NO.** Auth redirect to `/en/app` is correct and tested. The WorkspaceShell IS the intended landing. |
| G. Locale route mismatch | **NO.** Final URL confirmed `https://staging.ainow.biz/en/app` — locale is correct. |
| H. Translation/loading issue causing fallback | **NO.** All three locale message files are imported and used. No translation gaps identified. |
| I. User expectation refers to Agent Platform/RPG shell not yet scoped | **POSSIBLE.** If Keith expected to land on the Platform dashboard after login, the current wiring doesn't support that. |

**Primary root cause:** **D + C combined**

The workspace at `/en/app` is built with `PROJECT_FIRST_UX=false` (build-time env not set on staging), so it displays the non-project-first home view. Additionally, the Agent Platform RPG dashboard at `/en/platform` is never reached via the default post-login redirect, so if Keith expected that experience, the wiring does not provide it.

---

## 6. Staging Deployment State Assessment

| Check | Finding |
|---|---|
| VPS HEAD | `40c43af Reconcile staging root redirect state` |
| Local HEAD | `3a4aae6 Complete private beta staging execution 04` |
| Local vs VPS diff | 1 commit ahead — governance docs only (TASKS.md, docs/*.md) — NO frontend source changes |
| Frontend source state on VPS | **CURRENT** — all UX-IA, AUTH-MODULE, AGENT-PLATFORM, AI-CONTEXT, PREVIEW changes present |
| `NEXT_PUBLIC_PROJECT_FIRST_UX` on staging | **NOT SET** — evaluates to `false` at build time |
| WorkspaceShell version on staging | Latest — no source changes post-04I2E build |
| PlatformDashboard availability | Exists at `/en/platform` — not the default landing page |

---

## 7. Auth Redirect Assessment

| Source | Code | Result |
|---|---|---|
| `frontend/app/[locale]/login/page.tsx` lines 81, 107 | `router.replace(\`/${locale}/app\`)` | `/en/app` |
| `services/api-gateway/src/auth/auth.controller.ts` lines 287, 353 | `response.redirect(buildOAuthRedirectPath(locale, '/app'))` | `/en/app` (via Caddy `redir /app /en/app 307`) |

Auth redirect contributes to the issue only if the intent was to send users to `/en/platform` instead. As wired, both login and OAuth send users to the WorkspaceShell. This is consistent with the existing product architecture.

---

## 8. Smallest Safe Fix Options

### Option 1 — Enable `PROJECT_FIRST_UX` on staging (Low-Medium risk)

Set `NEXT_PUBLIC_PROJECT_FIRST_UX=true` in the VPS build environment and rebuild:

```bash
# On VPS (Keith executes manually — not via Cursor)
export NEXT_PUBLIC_PROJECT_FIRST_UX=true
cd /opt/aisandbox/frontend
npm run build
pm2 restart aisandbox-frontend
unset NEXT_PUBLIC_PROJECT_FIRST_UX
```

**Risk:** Low. This is a build-time flag already guarded by extensive tests. Enables project-first navigation in the workspace (route/session preservation, direct project-open on reload).
**Effort:** Low — VPS SSH + build + pm2 restart.
**Scope:** Staging env only. No source change.
**Blocked by:** Requires VPS SSH access (Keith). No subagent needed.
**Multilingual impact:** None — all translation keys already in place.

---

### Option 2 — Wire `/en/platform` as post-login destination (Medium-High risk)

Update `frontend/app/[locale]/login/page.tsx` and `services/api-gateway/src/auth/auth.controller.ts` to redirect to `/platform` instead of `/app` after login/OAuth.

**Risk:** Medium-High. Requires source change, typecheck, test update, new build, and VPS deploy. Breaks the existing login redirect test assertion. Changes fundamental product UX. Should be registered as a separate task.
**Effort:** Medium — source edit, test update, build, deploy.
**Scope:** Source code change — requires new registered task before implementation.
**Multilingual impact:** None to translations; Caddy redirect `redir /platform /en/platform 307` would need to be added (same pattern as `/app`).

---

### Option 3 — Redirect `/en/app` to `/en/platform` via middleware or Caddy (Medium risk)

Add Caddy `redir /en/app /en/platform 307` or add a Next.js middleware rule to redirect `/*/app` to `/*/platform`.

**Risk:** Medium. Breaks authenticated session continuity — workspace state stored in localStorage/sessionStorage for `/en/app` would not apply at `/en/platform`. Also breaks all existing tests that assert `/en/app` as the landing URL. Not recommended without explicit task registration.

---

### Option 4 — Defer as non-blocking (Lowest risk)

Document the mismatch, accept it is not a private beta infrastructure blocker, and proceed with deployment readiness. Address UI experience before user invites.

**Risk:** None to infrastructure. Small risk of confusing beta users if workspace experience is degraded vs expectation.

---

## 9. Multilingual Implications

No immediate translation gaps exist for any of the current routes or components. Any future fix that:
- Adds new visible UI text (new route, new view, new state) **must** add/update keys in `en.json`, `zh-TW.json`, `zh-CN.json`
- Changes button labels, empty states, or page headings **must** use the existing locale message pattern
- Does NOT add hardcoded English-only copy

The `/en/platform` PlatformDashboard already imports all three locale files and uses locale-resolved messages throughout. WorkspaceShell similarly covers all three locales.

---

## 10. Recommendation

**Whether this blocks private beta:** RECOMMENDED NON-BLOCKING for infrastructure readiness. The app infrastructure is working. Private beta deployment readiness can proceed.

**Recommended fix option:** **Option 1 (enable `PROJECT_FIRST_UX=true` on staging)** as the first investigation step.

Rationale:
- It is the lowest-risk, lowest-effort intervention
- It may resolve the "not latest expected UI" observation if the project-first experience is what Keith expected
- It requires no source code changes, no test updates, no governance re-registration
- It is reversible (rebuild with flag `false` to revert)

**If Option 1 does not resolve Keith's expectation**, then:
- Keith should specify exactly what UI he expected vs what he saw
- If the Platform RPG dashboard is intended as the default landing page for private beta, register a new task under 04J for source-level auth redirect change (Option 2)

**Private beta deployment readiness:** Can proceed after 04J Step 1 decision. Recommend Keith approves one of:
1. Fix with Option 1 (enable `PROJECT_FIRST_UX`) before inviting users
2. Defer and accept workspace as-is for private beta

---

## 11. Acceptance Criteria — Step 1 (Registration + Investigation)

- [x] 04J registered in TASKS.md — ACTIVE — Step 1 COMPLETE
- [x] 04J registered in TASKS_BACKLOG_FULL.md — matching content
- [x] Investigation document created: `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-STAGING-APP-UI-VERSION-MISMATCH-INVESTIGATION.md`
- [x] `/en/app` rendering source identified: `frontend/app/[locale]/app/page.tsx` → `WorkspaceShell`
- [x] Expected latest UI source/status assessed: WorkspaceShell IS current; PlatformDashboard at /en/platform
- [x] Route wiring assessed: Auth redirect → `/en/app` confirmed by source and tests
- [x] Feature flag/env/locale condition assessed: `PROJECT_FIRST_UX=false` on staging
- [x] Deployment/staging HEAD possibility assessed: `40c43af` is current; `3a4aae6` is governance-only delta
- [x] Auth redirect destination assessed: login and OAuth both redirect to `/en/app`
- [x] Multilingual implications assessed: no gaps; all three locales covered
- [x] Smallest safe fix options documented (Options 1–4)
- [x] Recommendation documented: Option 1 (enable PROJECT_FIRST_UX); non-blocking for infra readiness
- [x] No source code changed
- [x] No env files opened/changed
- [x] No env values printed or recorded
- [x] No runtime/server action occurred
- [x] No Docker/PostgreSQL/Redis action occurred
- [x] No email/account/login action occurred
- [x] No git commit or push (this file will be committed as part of governance)

---

## 12. Final Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04J | **ACTIVE — Step 1 COMPLETE (Registration + Investigation — 2026-08-04)** |
| PRIVATE-BETA-STAGING-EXECUTION-04I | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED — pending 04J decision |

---

## 13. Next Recommended Action

**04J implementation decision:**

- **Option A:** Proceed with Option 1 fix (enable `PROJECT_FIRST_UX=true` on staging, rebuild, validate) — register as 04J Step 2 implementation
- **Option B:** Keith confirms the workspace IS the expected experience and "not latest expected UI" is accepted as non-material — close 04J as non-blocking and resume PRIVATE-BETA-DEPLOYMENT-READINESS
- **Option C:** Keith clarifies that the Platform RPG dashboard should be the default landing page — register a new source-level task for auth redirect change

Stop here. Await Keith decision before implementation.
