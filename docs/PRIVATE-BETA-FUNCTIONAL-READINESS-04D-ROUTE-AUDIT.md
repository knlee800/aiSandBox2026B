# PRIVATE-BETA-FUNCTIONAL-READINESS-04D — Build Workspace Route and Legacy `/app` Audit

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-04D  
**Parent:** PRIVATE-BETA-FUNCTIONAL-READINESS-04  
**Type:** Source-only route and UX audit (no implementation, no runtime, no browser)  
**Status:** ACTIVE — 2026-08-06 — Step 1 source audit COMPLETE  
**Date:** 2026-08-06  
**Authority:** Source review only. Staging/browser not accessed in this task.

---

## 1. Executive verdict

**Outcome A — `/[locale]/app` is canonical.**

The intended **Build anything** workspace already lives at `frontend/app/[locale]/app/page.tsx` → `WorkspaceShell`. No alternate canonical Build route exists. No source route move or redirect-to-other-build-route is required for FR-04 Step 3c.

**FR-04 Step 3c can resume without source changes** on the existing browser route once Keith re-approves runtime smoke, using project view on `/[locale]/app`.

---

## 2. What `/[locale]/app` currently is

| Item | Finding |
|---|---|
| Route file | `frontend/app/[locale]/app/page.tsx` (`AppPage`, client component) |
| Shell | Renders `WorkspaceShell` after auth probe (`GET /api/auth/me`) |
| Unauthenticated | Client redirect to `/${locale}/login` |
| Project-first ON (`NEXT_PUBLIC_PROJECT_FIRST_UX === 'true'`) | Sidebar IA with in-page views: `home` / `projects` / `templates` / `project`. Default cold mount view: `home` with headline key `workspace.buildAnything` (“Build anything”) |
| Project-first OFF | Alternate **legacy session-scoped** shell: header “AI Sandbox Workspace” / “Session-scoped workspace”, session list sidebar, no Build-anything home IA |
| Staging/prod build intent | `docker-compose.prod.yml` sets `NEXT_PUBLIC_PROJECT_FIRST_UX: "true"` (build-time flag) |

**Classification of `/app`:** Required current product workspace host — **not** an obsolete duplicate route. It is the sole authenticated Build workspace page. The “legacy” surface Keith may have observed is the **same route** under `PROJECT_FIRST_UX=false`, or a **different** product surface (`/platform`, `/driver`), not a second Build route.

---

## 3. Exact canonical Build anything route

**Canonical user-facing Build anything workspace:**

```text
/{locale}/app
```

Examples:

- `https://staging.ainow.biz/en/app`
- `https://staging.ainow.biz/zh-TW/app`
- `https://staging.ainow.biz/zh-CN/app`

**Smoke-critical sub-state (same URL, client view):**

```text
workspaceView === 'project'   → data-testid="workspace-project-view"
```

Home view (`workspaceView === 'home'`) is the Build-anything entry (prompt → create project). Provider/model selector, AI chat, file tree, editor, and history controls live in **project view**, not on the home card alone.

---

## 4. Why `/[locale]/app` remains reachable / why navigation can feel split

### 4.1 `/app` is intentionally the destination

Normal authenticated navigation **targets** `/app`:

| Source | Behavior |
|---|---|
| Login / register success | `router.replace(\`/${locale}/app\`)` |
| Landing primary CTA (ready) | `/${locale}/app` |
| Billing back link | `/${locale}/app` |
| Platform Builder Agent CTA | `/${localePrefix}/app` |
| Agent registry `builder.route` | `'/app'` |
| `/[locale]/projects` | server `redirect(\`/${locale}/app\`)` |
| `/[locale]/gallery` | server `redirect(\`/${locale}/app\`)` |
| `/[locale]/account` | server `redirect(\`/${locale}/app\`)` |
| `/[locale]/keys` | server `redirect(\`/${locale}/app\`)` |

Middleware (`frontend/middleware.ts`) only locale-prefixes paths (e.g. `/app` → `/en/app`). It does **not** divert `/app` away from the workspace.

### 4.2 Navigation that leaves `/app` (not a second Build workspace)

| Control | Destination | Role |
|---|---|---|
| Workspace home “Command Center” CTA | `/${locale}/platform` | Agent platform dashboard |
| Workspace sidebar Command Center link | `/${locale}/platform` | Same |
| Platform “Back to Workspace” / Builder open | `/${locale}/app` | Returns to Build workspace |

`/[locale]/platform` is the **Agent Command Center** (`PlatformDashboard`). It is **not** the Build anything workspace. Links from workspace → platform explain “navigation redirects elsewhere” without making `/platform` canonical for build.

### 4.3 Non-canonical / legacy adjacent surfaces

| Route | Role vs Build anything |
|---|---|
| `/[locale]/driver` | Phase 37C API-key AI Driver page — obsolete/debug adjacent execution UI; **not** the product Build workspace |
| `/[locale]/app` with `PROJECT_FIRST_UX=false` | Same URL, legacy session shell (“AI Sandbox Workspace”) |

---

## 5. Current Build anything capability inventory (source)

Under project-first **project view** on `/[locale]/app`:

| Capability | Present? | Notes |
|---|---|---|
| Provider / model selector | Yes | `workspace-chat-model-selector` in AI panel |
| AI chat | Yes | Project AI panel / chat orchestration |
| Project / session creation | Yes | Home prompt create; projects list open/create; session association via project-first open helpers |
| File tree | Yes | Workspace file navigation surfaces |
| Editor | Yes | File open/save in project content panel |
| History / snapshot controls | Yes | History drawer / project snapshots / checkpoints (project-first gated behaviors) |

Home view alone: Build-anything prompt + Command Center link — **not** the full editor/chat smoke surface.

---

## 6. Supported browser route and navigation flow (FR-04 Step 3c)

Exact supported flow (matches FR-03A runbook host):

1. Authenticate → land on `/{locale}/app` (or navigate there).
2. Confirm project-first shell (Build anything home / sidebar IA — **not** “Session-scoped workspace” header).
3. Open or resume the disposable staging project → `workspaceView === 'project'`.
4. Expand AI panel if collapsed; use model selector (`xai` / `grok-4.5` default post-FR-04B).
5. Submit approved bounded prompt; verify file tree/editor for `smoke-test.txt`.

**Existing projects:** Open **in place** on the same `/[locale]/app` URL via client `workspaceView` + project/session hydration (`openProjectInFreshSession` / resume handlers). There is **no** separate `/projects/:id` build route. Projects should continue to open into `/[locale]/app` project view — not into `/platform`.

---

## 7. Outcome decision (A / B / C)

### Chosen: **Outcome A — `/app` is canonical**

| Option | Decision |
|---|---|
| A — `/app` canonical | **SELECTED** — restore/use current workspace **at** `/[locale]/app` (already implemented) |
| B — another route canonical + redirect `/app` | Rejected — no other Build host |
| C — incomplete architecture needing new route task | Rejected — architecture is complete for a single Build host; confusion is view/flag/platform adjacency |

**Should `/[locale]/app`:**

- become canonical? **Already is.**
- redirect to another build route? **No.**
- be removed? **No — required.**

**Smallest safe fix:** **None in source for routing.** Proceed with FR-04 Step 3c on `/en/app` project view. If Keith observed the legacy session shell, the bounded follow-up is **ops/build confirmation** that the staging frontend artifact was built with `NEXT_PUBLIC_PROJECT_FIRST_UX=true` (not a route refactor). Optional later hygiene (not required for FR-04): deprecate or guard `/[locale]/driver` — separate task, not registered here.

---

## 8. Tests covering these route decisions

| Area | Coverage |
|---|---|
| Login → `/en/app` | `frontend/app/[locale]/login/page.test.tsx` (`replaceCalls` includes `/en/app`) |
| Landing → `/en/app` | `frontend/components/public/public-landing-slice.test.tsx` |
| Builder route `/app` | `frontend/components/platform/platform-dashboard.test.ts` (`builder.route === '/app'`) |
| Build anything home + platform CTA | `frontend/components/workspace/workspace-shell.test.tsx` (Build anything text; `href="/en/platform"` / zh-TW) |
| Project-first sessionStorage / view seeding | Source assertions in `workspace-shell.test.tsx` against `app/page.tsx` patterns |
| Deprecated route redirects | Implemented as thin server redirects in `projects` / `gallery` / `account` / `keys` pages (UX-IA-14); no separate redirect unit suite required for this audit |

---

## 9. Risk of changing the route

Changing the canonical Build URL (move or redirect `/app` away) would risk:

- Login/register post-auth landing
- Locale middleware and Caddy `/app` → `/en/app` assumptions
- Platform Builder Agent deep link
- Project open/resume + sessionStorage hydration (`TAB_SELECTED_*` keys scoped to this page)
- FR-02 / FR-03A / FR-04 runbooks and smoke muscle memory

**Recommendation:** Do **not** change the route. Preserve project/session architecture on `/[locale]/app`.

---

## 10. FR-04 Step 3c resume posture (governance)

Recorded for this child (operator-reported; this audit did not access staging):

| Item | Status |
|---|---|
| FR-04 Step 3c | **BLOCKED** (stopped before inference; route confusion under audit) |
| xAI configuration | Remains present per operator report |
| Global execution | Remains disabled (`GLOBAL_EXECUTION_ENABLED=false`) |
| Provider selection | Operator report: `AI_PROVIDER=xai`, `PROVIDER_XAI_ENABLED=true` — **no inference request occurred** |
| Users invited | **None** — PRIVATE-BETA-INVITE-01 not registered |
| New runtime enablement | **Not authorized** by this audit |
| Source / env / Git / browser actions in FR-04D | **None** |

**Resume without source changes:** **Yes** — use `https://staging.ainow.biz/en/app`, open disposable project to project view, then continue Step 3c only after separate Keith approval and kill-switch/runtime gates.

---

## 11. Exact bounded next action

1. Treat FR-04D Outcome A as locked for route strategy: canonical Build = `/[locale]/app`.
2. Keep FR-04 Step 3c **BLOCKED** until Keith re-approves.
3. When resuming: no route source change; navigate to `/en/app` → project view → xAI model selector → approved prompt.
4. If UI still shows “Session-scoped workspace” instead of Build anything IA, verify staging frontend build flag `NEXT_PUBLIC_PROJECT_FIRST_UX=true` (ops only; separate approval if rebuild needed).
5. Do not invite users. Do not enable execution from this audit task.

---

## 12. Files in scope for FR-04D (governance only)

- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04D-ROUTE-AUDIT.md` (this file)
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/AINOW-EXECUTION-ROADMAP.md`
- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md`

**Confirmation:** No source, tests, translations, middleware, environment, packages, migrations, entities, staging, browser, provider API, database, or Git actions were performed in FR-04D.
