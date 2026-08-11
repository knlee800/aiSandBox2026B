# PRIVATE-BETA-E2E-01-STAGE-START.md
## PRIVATE-BETA-E2E-01 — Fresh Keith Builder End-to-End Staging Journey
### Step 2 — Journey Plan + Stage-Start

**Task ID:** PRIVATE-BETA-E2E-01
**Step:** Step 2 — Journey Plan + Stage-Start
**Created:** 2026-08-10
**Author:** Cursor / Sonnet 4.6 (read-only planning — no runtime action occurred)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-E2E-01 |
| Title | Fresh Keith Builder End-to-End Staging Journey |
| Step | Step 2 — Journey Plan + Stage-Start (CURRENT) |
| Step 1 | Registration — COMPLETE — 2026-08-10 |
| Step 3 | Keith Full End-to-End Staging Journey + Evidence Collection — NOT STARTED |
| Step 4 | Consolidation / Checkpoint — NOT STARTED |
| Family | PRIVATE BETA / BUILDER / END-TO-END / USER JOURNEY |
| Nature | Controlled staged user journey — NOT an internal backend smoke |
| Purpose | Prove Keith can enter ainow.biz, access Builder, create a fresh project, get AI to build something useful, observe coherent workspace/preview, refresh/reopen, and find the result intact — without internal intervention |

---

## 2. Starting Runtime State

| Property | State |
|----------|-------|
| `GLOBAL_EXECUTION_ENABLED` | **`true`** — deliberately left enabled from PRIVATE-BETA-EXEC-01 |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AI_PROVIDER` | `xai` |
| `PROVIDER_XAI_ENABLED` | `true` |
| `LAUNCH_STATE` | `INTERNAL` |
| Watchdog (`aisandbox-ops-watchdog`) | Online; alert path proven (PRIVATE-BETA-OPS-01) |
| Known credit balance | `4922` after EXEC-01 smoke (verify current at Step 3 start) |
| PRIVATE-BETA-INVITE-01 | Untouched / unregistered |
| Final Builder beta GO/NO-GO | Not yet taken |

---

## 3. Evidence Reviewed

| Document | Status |
|----------|--------|
| `CLAUDE.md` | Read — working contract |
| `TASKS.md` | Read — active ledger (PRIVATE-BETA-E2E-01 ACTIVE, Step 1 COMPLETE) |
| `TASKS_BACKLOG_FULL.md` | Consulted |
| `ARCHITECTURE.md` | Read — system topology, routes, preview, execution path, data model |
| `PRD.md` | Read — product scope, Builder features, non-goals |
| `docs/PRIVATE-BETA-OPS-01-CHECKPOINT.md` | Read — watchdog architecture, probe coverage, alert evidence |
| `docs/PRIVATE-BETA-EXEC-01-CHECKPOINT.md` | Read — gate activation mechanics, smoke evidence, credit evidence, rollback path |
| `docs/PRIVATE-BETA-BLOCKER-02-CHECKPOINT.md` | Read — preview routing fix (4001→4002), staging live preview PASS evidence |
| `docs/BILLING-READY-08-CHECKPOINT.md` | Read — credit model, token/credit accounting |
| Frontend source (middleware, app page, workspace-shell, public-landing-slice, platform-dashboard) | Read — exact routes, UX flow, project creation mechanics |
| ARCHITECTURE.md §6 Preview Architecture | Read — proxy path, WebSocket scope |
| ARCHITECTURE.md §11 AI Execution Architecture | Read — single-shot path, file actions, post-exec coherence |
| ARCHITECTURE.md §13 Platform Architecture | Read — ainow.biz routes, Builder route |

---

## 4. Exact User-Entry Route

### 4.1 Root Redirect

`https://staging.ainow.biz` (root) → **HTTP 307 → `https://staging.ainow.biz/en`**

Confirmed behavior: Next.js middleware (middleware.ts) redirects `/` to `/{DEFAULT_LOCALE}` (`/en`). This was verified live in PRIVATE-BETA-BLOCKER-02 deployment evidence (staging root returned "HTTP 307 → Location `/en`").

### 4.2 Landing Page

`https://staging.ainow.biz/en` renders `PublicLandingSlice`.

On load, the page calls `GET /api/auth/me` to detect auth state:
- If **not authenticated**: primary CTA → `/en/login` (Sign in)
- If **authenticated**: primary CTA → `/en/app` (Continue to Workspace)

The landing page does **not** auto-redirect authenticated users. It surfaces the appropriate CTA based on auth state.

### 4.3 Login Route

`https://staging.ainow.biz/en/login`

- Email/password login form
- Credential: Keith's registered beta user email + password
- On success: session cookie set; user navigated back to referrer or default
- No Google OAuth in current beta (PLANNED / not activated)

### 4.4 Builder Workspace Route

`https://staging.ainow.biz/en/app`

This is the Builder workspace (WorkspaceShell). Initial view: `'home'` showing the project list and project creation controls.

### 4.5 Platform Dashboard Route (optional context)

`https://staging.ainow.biz/en/platform`

Accessible from the workspace. Contains a "Back to Workspace" link (→ `/en/app`) and an agent registry card for Builder with a "Start Building" link (also → `/en/app`). Not required as a step in the E2E journey — direct navigation to `/en/app` is preferred.

### 4.6 Locale Behavior

- Default locale: `en`
- Supported: `en`, `zh-TW`, `zh-CN`
- Case-normalization: `ZH-TW` → `zh-TW` etc.
- Unsupported first segment → prepended with `/en/`

Keith should use the default English path. No locale switching required.

---

## 5. Authentication Assumptions

| Assumption | Detail |
|------------|--------|
| Keith has a registered staging account | Email/password registered on staging.ainow.biz |
| Keith knows his credentials | Required if not already logged in |
| An existing authenticated browser session may persist | If Keith's cookie is still valid from EXEC-01, re-login may not be needed |
| Re-login is a non-blocker | Standard email/password flow; classified as PASS if functional |
| Auth UI may be visually legacy | Functionally required; visual polish is a LIMITATION, not a blocker |
| Email verification | Already completed during original registration |
| Google OAuth | Not activated — do not attempt |

**Starting assumption for Step 3:** Keith should check `https://staging.ainow.biz/en` first. If the page shows a "Continue to Workspace" primary CTA, the session is still active and he can proceed directly to `/en/app`. If it shows "Sign in", proceed through `/en/login` using known credentials.

---

## 6. Fresh-Project Creation Path

### Why Fresh

The EXEC-01 smoke produced `beta-activation-smoke-2026-08-10.txt` in an existing smoke project. The E2E journey must use a fresh project to avoid contamination from prior smoke work. Keith must NOT open or continue any prior smoke project.

### Exact UI Procedure

1. Navigate to `https://staging.ainow.biz/en/app`
2. The Builder workspace home view opens, showing the project list panel
3. Locate and click the **"New Project"** button (data-testid: `workspace-projects-new-project-button`)
4. A row expands with a text input (placeholder: `New project name`) and a **"Create Project"** button
5. Type the exact project name (see §7 below) into the input
6. Click **"Create Project"** (button is disabled until input is non-empty)
7. System automatically:
   - Creates a new project record in PostgreSQL
   - Opens the project in a fresh session (new Docker container)
   - Transitions workspace view to `'project'`
8. The file tree will initially be **empty** (fresh workspace)
9. The chat panel will be ready for input

### Notes

- A project name is **required** — the Create Project button is disabled when the input is empty
- Session and workspace container are created automatically on project open — no manual session creation needed
- If project creation fails: check for error message in the workspace UI and ensure the network/service is healthy

---

## 7. Recommended Project Name

```
Private Beta E2E 2026-08-10
```

This name is:
- Unique (date-stamped — will not conflict with prior smoke projects)
- Descriptive (clearly identifiable in the project list)
- Compatible with current UI (plain text; no special characters)
- Suitable for use as a safe project identity through the journey

Do **not** create this project during Step 2. Create it only at the start of Step 3.

---

## 8. Exact Single Builder Prompt

Keith must paste this exact prompt into the chat input after the project is open and the session is active:

---

**EXACT PROMPT — copy and paste verbatim:**

```
Create a single file named index.html with everything self-contained (HTML, CSS, and JavaScript all in one file).

The page should be a "Private Beta Launch Checklist" with:
- A heading at the top: "Private Beta Launch Checklist"
- 3 pre-loaded checklist items: "Deploy to staging", "Run end-to-end test", "Confirm billing guard active"
- Clicking any item toggles a strikethrough completed style on that item
- A text input and "Add Item" button that appends a new item to the list
- Minimal clean styling with a visible background color and readable fonts — all inside a <style> block in the HTML

Constraints:
- Output ONLY index.html — do not create any other files
- No backend, no server, no database, no external APIs
- No npm packages, no external CSS frameworks, no external JavaScript libraries
- All CSS in a <style> block, all JavaScript in a <script> block — no external files
- Keep the file under 100 lines total
```

---

**Rationale for this prompt:**

| Property | Value |
|----------|-------|
| Output | Single `index.html` — minimal file-action surface, easy to verify |
| No dependencies | No `npm install`, no build step, no external packages |
| Visually obvious | Heading and item list immediately visible in preview |
| Interactive | Toggle + Add-item tests one UI interaction in preview |
| Token cost | Low — small HTML file, short instructions |
| Determinism | Output is highly constrained — model cannot diverge far |
| Preview compatibility | Static HTML served by workspace container — proven in BLOCKER-02 smoke |
| Not a security feature | No auth, no backend, no external calls |

---

## 9. Expected Generated Result

### Expected File-Action Output

| Expected | Detail |
|----------|--------|
| Files created | Exactly **1**: `index.html` |
| Files modified | 0 (empty workspace, no pre-existing files) |
| Files deleted | 0 |
| Unexpected extra files | NONE expected (prompt explicitly constrains this) |

### Expected `index.html` Content

A self-contained HTML document (~50–100 lines) containing:
- `<style>` block with basic CSS (background color, font, strikethrough style for completed items)
- `<body>` with: `<h1>` heading, `<ul>` with 3 `<li>` items, a `<input>` text field, and an `<button>` "Add Item"
- `<script>` block with: click-toggle handler, add-item handler

Keith does **not** need to read or understand the source code. He needs only to confirm the preview visual and one interaction.

---

## 10. Expected Workspace / File-Tree Result

After AI execution completes:

| Check | Expected |
|-------|----------|
| File tree refreshes | `index.html` appears in the file tree |
| No unexpected extra files | File tree contains only `index.html` (empty-workspace project) |
| File is selectable | Clicking `index.html` in the tree opens it in the editor |
| Editor shows content | File content renders in the code editor (not blank) |
| No obviously unrelated files | No `package.json`, `node_modules/`, `server.js`, or similar unless workspace template already includes them |

---

## 11. Editor Checks

After AI execution and file-tree refresh:

| Check | Action | Expected |
|-------|--------|----------|
| Open file | Click `index.html` in file tree | File opens in editor panel |
| Content visible | Observe editor | HTML content is present and non-empty |
| Heading present | Scan content (no expertise required) | `Private Beta Launch Checklist` text visible somewhere in the source |
| No stale state | Editor does not show "Loading..." or previous session content | Editor shows actual generated content |

Keith does **not** need to audit the code for correctness. The editor check is a coherence check, not a code review.

---

## 12. Chat / Result Checks

After AI execution completes:

| Check | Expected |
|-------|----------|
| Execution completes | Chat shows a completion message or the file-action result is surfaced |
| No persistent spinner | AI execution does not stay in "running" state indefinitely |
| Result understandable | Keith can understand from the chat that AI did something (e.g., file was created) |
| No contradiction | Chat does not claim success while file tree is empty |
| No error message | No visible error, 503, or "execution not available" message |

**Acceptable:** The AI response text in chat may be minimal (e.g., just confirmation that `index.html` was created). The smoke in BILLING-READY-08 showed "No assistant response text returned — Acceptable — file-action-only smoke." A brief confirmation or even an empty assistant text with a file action applied is PASS.

---

## 13. Preview Checks

### 13.1 How Preview Is Opened

The Builder workspace has a **Preview panel** (tab or button) within the project view.

Preview URL pattern (internal proxy):
```
https://staging.ainow.biz/api/preview/{sessionId}/proxy?refresh={timestamp}
```

The API Gateway routes preview requests to container-manager (port 4002). This was fixed in PRIVATE-BETA-BLOCKER-02 (commit `f73da07`). Preview routing is staging-proven.

### 13.2 Preview Behavior After AI File Actions

- After file actions are applied, the frontend calls `refreshPreviewForSession(sessionId, true)`
- Preview URL is rebuilt with a new `refresh` timestamp to bust any cache
- The preview panel should render the updated workspace content
- If auto-refresh does not trigger: Keith may manually click a "Refresh Preview" button in the UI — this is **acceptable and not a blocker**

### 13.3 Expected Preview Visual

Keith should open the preview panel and verify:

| Visual Check | Expected |
|--------------|----------|
| Heading visible | `Private Beta Launch Checklist` heading appears in the preview iframe |
| Items visible | At least 2–3 checklist items are visible in the list |
| Page renders at all | No blank white screen, no 404, no "Preview unavailable" error |

### 13.4 Expected Preview Interaction

Keith should perform exactly **two** interactions in the preview:

| Interaction | Action | Expected |
|-------------|--------|----------|
| Toggle item | Click one checklist item | That item gets a strikethrough / completed visual style |
| Add item | Type a short word in the text input, click "Add Item" | New item appears in the list |

These two interactions are the acceptance points.

**Known acceptable limitation:** The preview renders in a proxied iframe. Some interaction behaviors may have a slight lag. This is expected and not a blocker.

**Not a blocker:** If preview requires a manual refresh click after AI execution — manual refresh is acceptable.

**Blocker:** Preview is fundamentally unavailable (sustained 404, 502, or blank with error) and cannot render `index.html` at all.

---

## 14. Interactive Preview Checks

| Check | Action | Pass Condition |
|-------|--------|----------------|
| Preview loads | Open preview panel | Page renders — heading and items visible |
| Item toggle | Click "Deploy to staging" item | Item shows strikethrough or visual completion state |
| Item add | Type "Final check" in input, click "Add Item" | "Final check" appears as a new item in the list |
| No crash | After interactions | Page does not go blank or show JS error |

---

## 15. Refresh-Persistence Procedure

### Browser Refresh

1. While on the Builder project view (`/en/app`), press **F5** or browser Refresh
2. The workspace page reloads
3. Keith observes:

| Check | Expected |
|-------|----------|
| Project is still identifiable | Same project name appears (or workspace returns to home and the project is visible in the list) |
| File `index.html` still present | Open the file tree — `index.html` is still listed |
| File content intact | Click `index.html` — editor still shows the generated content |
| Preview recoverable | Open preview panel — preview re-renders (may require one manual refresh click) |
| Chat/session context | Chat history may or may not be fully restored (acceptable limitation — backend persistence is present but session may be fresh) |

**Note:** Refresh may create a new session on top of the existing project. This is expected product behavior — projects persist durably; sessions are runtime containers. As long as the project and files are found, this is PASS.

---

## 16. Project-Reopen Procedure

### Reopen From Outside Builder

1. From the Builder workspace, navigate away:
   - Click browser Back, OR
   - Navigate to `https://staging.ainow.biz/en/platform` or `https://staging.ainow.biz/en`, OR
   - Close the tab and open a fresh one to `https://staging.ainow.biz/en/app`

2. Return to Builder: navigate to `https://staging.ainow.biz/en/app`

3. The workspace home view shows the project list

4. Locate **"Private Beta E2E 2026-08-10"** in the project list

5. Click it to open/resume the project

6. System opens the project in a fresh session (new container)

7. Keith verifies:

| Check | Expected |
|-------|----------|
| Project appears in list | "Private Beta E2E 2026-08-10" is visible in the project list |
| Project opens | Clicking it transitions workspace to project view |
| `index.html` present | File appears in the file tree |
| Content correct | Click `index.html` — editor shows the same generated content |
| Preview recoverable | Open preview — `index.html` renders (may require one refresh click) |
| No data loss | Content matches what was generated — no blank or corrupted file |

**Authoritative behavior:** Projects persist in PostgreSQL (`projects` table). Files persist in workspace snapshots (host filesystem `snapshot-store/`). Session termination does not destroy project data. Project reopen creates a new session and restores from the last snapshot.

---

## 17. Authentication / Session Continuity Checks

| Check | Pass Condition | Classification |
|-------|----------------|----------------|
| Visiting `/en/app` does not unexpectedly redirect to login mid-journey | No surprise logout during normal use | PASS |
| If login is required at journey start, login works | Email/password authentication succeeds | PASS |
| Session cookie persists across normal page navigations | Can navigate between `/en`, `/en/platform`, `/en/app` without repeated login | PASS |
| Auth UI functional (even if visually dated) | Login form submits, credentials accepted, session established | PASS (visual dating is LIMITATION only) |
| No expiry during journey | Journey is bounded (~30 min max); session idle timeout should not expire within this window | PASS |

**Explicit classification:** If the login page appears visually legacy, classify as PASS WITH LIMITATION (not a blocker). If login fails entirely, classify as FAIL / BLOCKER.

---

## 18. Credits / Accounting Checks

### Pre-Journey

| Check | Action |
|-------|--------|
| Record starting balance | If the billing/credits display is visible in the Builder UI, note the current balance before submitting the prompt |
| Expected starting balance | ~4922 (from EXEC-01, but verify current — may have changed) |

### Post-Journey

| Check | Expected |
|-------|----------|
| Credits deducted | Balance visibly decreases after AI execution completes |
| Deduction amount | Consistent with token usage (a simple ~100-line HTML file; estimated 300–1500 tokens; deduction may range 300–1500 credits) |
| No Stripe charge | `BILLING_CHARGES_ENABLED=false` — no real-money charge; internal credit accounting only |
| Execution accepted | AI execution was not rejected with "Insufficient credit balance" |
| No 503 | AI execution was not rejected with execution-disabled error |

### Cursor Evidence Responsibilities (Post-Journey)

After Step 3 is complete, Cursor will gather runtime evidence via SSH to confirm:

- Exact `usage_records` entry for the E2E execution ID
- Exact credit deduction record (`applied_credits`, `balance_before`, `balance_after`)
- `harnessVersion: null`, `selectedPath: "plain"` (confirms single-shot path, Harness not activated)
- `BILLING_CHARGES_ENABLED=false` (no real charge occurred)

Keith does **not** need to inspect any database tables or logs.

---

## 19. Operational Pre-Flight Checks

Keith (or Cursor via SSH) must verify these before Keith begins the browser journey:

```bash
# Connect
ssh aisandbox-staging

# Check PM2 status
pm2 list
```

| Process | Required Status |
|---------|-----------------|
| `aisandbox-api-gateway` | **online** |
| `aisandbox-ai-service` | **online** |
| `aisandbox-container-manager` | **online** |
| `aisandbox-frontend` | **online** |
| `aisandbox-ops-watchdog` | **online** |

```bash
# Check gate
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: true

# Check API Gateway readiness
curl -s http://127.0.0.1:4000/api/health/ready
# Expected: HTTP 200

# Check AI Service
curl -s http://127.0.0.1:4001/metrics
# Expected: HTTP 200

# Check container-manager
curl -s http://127.0.0.1:4002/api/health
# Expected: HTTP 200

# Check frontend reachable
curl -sI https://staging.ainow.biz
# Expected: 2xx or 3xx

# Check watchdog probe healthy (watchdog logs)
pm2 logs aisandbox-ops-watchdog --nostream --lines 20
# Expected: recent probe lines showing PASS / healthy — no ALERT lines
```

**If any PM2 process is offline or not-online:** Do not begin the journey. Investigate and restore health first.

**If `GLOBAL_EXECUTION_ENABLED` is not `true`:** Do not begin the journey. The gate must be active.

**If pre-flight passes:** Keith may begin the browser journey.

---

## 20. Operational Post-Flight Checks

After Keith completes the E2E browser journey, Cursor will perform post-flight via SSH:

```bash
# PM2 status — all five must remain online
pm2 list

# API Gateway readiness
curl -s http://127.0.0.1:4000/api/health/ready

# AI Service
curl -s http://127.0.0.1:4001/metrics

# Container-manager
curl -s http://127.0.0.1:4002/api/health

# Frontend
curl -sI https://staging.ainow.biz

# Watchdog — verify no outage alert fired during journey
pm2 logs aisandbox-ops-watchdog --nostream --lines 50
# Expected: no ALERT lines during journey window

# Harness flags still disabled
pm2 env <ai-service-id> | grep AGENT_HARNESS
# Expected: all false

# Billing flag still disabled
pm2 env <api-gateway-id> | grep BILLING_CHARGES_ENABLED
# Expected: false

# Execution ID evidence (after Keith reports it)
# Query usage_records and credit_deduction_records for execution ID
```

---

## 21. Watchdog Expectations

### During Healthy Journey

Expected: **no outage alert email** arrives at `alerts@ainow.biz` during the Step 3 window.

The watchdog runs at 60-second intervals and will fire only if a probe fails 2 consecutive times (3 for frontend). A healthy E2E journey should produce zero alerts.

### If Keith Receives an Outage Alert

**Stop the journey immediately.**

An outage alert during the journey is a potential blocking operational event. Do not continue browser testing until:
1. Keith SSHes to staging and checks `pm2 list`
2. The unhealthy service is identified
3. Health is restored or the alert is investigated and classified as a false positive

Do not resume the journey until all five PM2 probes are confirmed healthy.

### Watchdog Failure Domain

The watchdog is independent of all application services. If the watchdog itself crashes (PM2 restart loop), that does not block the E2E journey — but should be noted as an operational limitation.

---

## 22. Keith Browser / Manual Checklist

Complete these in order during Step 3. Classify each:
- **PASS** — works as expected
- **PASS WITH LIMITATION** — works functionally; known or minor cosmetic issue
- **FAIL / BLOCKER** — prevents the journey or a critical product behavior
- **NOT APPLICABLE** — not relevant to this journey

| # | Category | Action / Observation | Classification |
|---|----------|---------------------|----------------|
| 1 | Entry / login | Navigate to `https://staging.ainow.biz`; observe redirect to `/en`; login if needed | — |
| 2 | ainow.biz dashboard / landing | Landing page renders; primary CTA visible | — |
| 3 | Builder access | Navigate to `/en/app`; workspace loads; home view visible | — |
| 4 | New-project creation | Click "New Project"; enter name; click "Create Project"; project opens | — |
| 5 | Prompt submission | Paste exact prompt into chat input; click Send / submit | — |
| 6 | AI execution | Execution starts; not rejected with 503 or credit error; completes without persistent spinner | — |
| 7 | Chat / result clarity | Completion or result surfaced in chat; understandable; no contradiction with workspace | — |
| 8 | File tree | `index.html` appears; tree refreshed; no obviously wrong extra files | — |
| 9 | Editor | Click `index.html`; editor shows content; heading text visible somewhere in source | — |
| 10 | Preview rendering | Open preview panel; page renders; heading "Private Beta Launch Checklist" visible | — |
| 11 | Preview interaction — toggle | Click checklist item; strikethrough / completed style appears | — |
| 12 | Preview interaction — add | Type "Final check"; click "Add Item"; item appears in list | — |
| 13 | Refresh persistence | Press F5; project and file remain; preview recoverable | — |
| 14 | Project reopen | Navigate away; return to `/en/app`; project visible in list; open it; `index.html` present; preview recoverable | — |
| 15 | Auth / session continuity | No unexpected mid-journey logout; login works if needed | — |
| 16 | Credits / accounting | Balance visible before/after; deduction occurred; no Stripe charge | — |
| 17 | Error-free experience | No unexplained error modals, crash pages, or unrecoverable states observed | — |
| 18 | Overall trusted-beta usability | As a trusted beta user, Keith judges: would this be usable by a small trusted cohort for initial exploration? | — |

**Keith must record his classification and a brief note for each item.** These become Step 3 evidence.

---

## 23. Cursor Runtime Evidence Responsibilities

After the browser journey (Step 3), Cursor will gather the following runtime evidence via SSH. Keith does not need to gather these.

| Evidence | How Gathered |
|----------|-------------|
| PM2 process status post-journey | `pm2 list` |
| API Gateway readiness | `curl http://127.0.0.1:4000/api/health/ready` |
| AI Service metrics | `curl http://127.0.0.1:4001/metrics` |
| Container-manager health | `curl http://127.0.0.1:4002/api/health` |
| Frontend reachability | `curl -sI https://staging.ainow.biz` |
| Watchdog log — no alert during journey | `pm2 logs aisandbox-ops-watchdog --nostream --lines 50` |
| Execution record | `usage_records` entry for execution ID reported by Keith (provider, path, tokens, status) |
| Credit deduction record | `credit_deduction_records` entry (applied_credits, balance_before, balance_after) |
| Harness flags still false | `pm2 env <ai-service-id> | grep AGENT_HARNESS` |
| Billing flag still false | `pm2 env <api-gateway-id> | grep BILLING_CHARGES_ENABLED` |
| Gate still true | `pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED` |

Cursor will record all evidence in the Step 3 evidence section before Step 4 consolidation begins.

---

## 24. PASS / Limitation / Blocker Rubric

### BLOCKERS — Stop Journey, Escalate

Any of these conditions requires stopping the journey and not declaring Step 3 PASS:

| Condition | Severity |
|-----------|----------|
| Cannot login to `staging.ainow.biz` | BLOCKER |
| Cannot access Builder (`/en/app` crashes or redirects permanently) | BLOCKER |
| Cannot create a new project (creation consistently fails) | BLOCKER |
| Prompt submission rejected with 503 (execution disabled) | BLOCKER |
| Prompt submission rejected with insufficient credit balance | BLOCKER |
| AI execution never completes (persistent spinner; no result after reasonable wait ~5 minutes) | BLOCKER |
| Generated file does not appear in file tree after execution completes | BLOCKER |
| Preview is fundamentally unavailable (sustained 404/502/blank with error) | BLOCKER |
| Project data disappears after browser refresh | BLOCKER |
| Project cannot be found or reopened after navigation | BLOCKER |
| Unexpected Harness activation (harnessVersion not null, selectedPath not "plain") | BLOCKER |
| Service crash or outage alert fires during journey | BLOCKER (pause — investigate) |
| Unexpected Stripe charge triggered | BLOCKER |

### NON-BLOCKING LIMITATIONS — Record, Continue

| Condition | Classification |
|-----------|----------------|
| Login page is visually legacy / dated styling | PASS WITH LIMITATION |
| Minor spacing, alignment, or visual inconsistency | PASS WITH LIMITATION |
| Preview requires manual refresh click after AI execution | PASS WITH LIMITATION |
| Chat response text is minimal or empty (file action still applied) | PASS WITH LIMITATION |
| Slight lag in preview interactions due to iframe proxy | PASS WITH LIMITATION |
| Some UI copy is slightly awkward or informal | PASS WITH LIMITATION |
| File tree takes 1–2 seconds to refresh after execution | PASS WITH LIMITATION |
| Session is re-created fresh on reopen rather than resumed exactly | PASS WITH LIMITATION (expected product behavior) |
| Project reopen creates a new container (expected — sessions are runtime containers) | PASS WITH LIMITATION |

### Automatic PASS

| Condition |
|-----------|
| All 12 browser checklist items PASS or PASS WITH LIMITATION |
| No BLOCKER encountered |
| `index.html` created, opens, readable |
| Preview renders heading + items |
| One interaction works (toggle or add) |
| Project and file persist after browser refresh |
| Project reopen finds file |
| Credit deducted; no Stripe charge |
| No outage alert fired |

---

## 25. Rollback Triggers and Procedure

### Immediate Rollback Triggers

Restore `GLOBAL_EXECUTION_ENABLED=false` immediately if **any** of the following occur:

| Trigger | Action |
|---------|--------|
| Critical service failure / crash during journey | Stop journey, rollback |
| Watchdog outage alert fires for any component | Stop journey, investigate first, rollback if cause unclear |
| Severe provider/execution safety anomaly | Rollback |
| Unexpected Harness routing activated (harness path used instead of plain) | Rollback |
| Serious accounting failure (unexpected Stripe charge path activated) | Rollback |
| Workspace corruption / data loss on repeated attempts | Rollback |
| Repeated consistent execution failure suggesting unsafe activation state | Rollback |

Minor UX issues, single failed attempt, or preview refresh inconvenience do **not** require rollback.

### Exact Rollback Procedure

```bash
ssh aisandbox-staging

# R1: Restore gate
sed -i 's/^GLOBAL_EXECUTION_ENABLED=true$/GLOBAL_EXECUTION_ENABLED=false/' /opt/aisandbox/.env

# R2: Verify
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# R3: Restart API Gateway with updated env
pm2 restart aisandbox-api-gateway --update-env

# R4: Verify PM2 env
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: false

# R5: Verify readiness
curl -s http://127.0.0.1:4000/api/health/ready
# Expected: HTTP 200
```

This exact rollback path was **proven operational** during EXEC-01 Step 3 (temporary policy rollback + reactivation). No DB rollback is needed. Credit deductions from the E2E journey are accounting evidence and are not reversed (`BILLING_CHARGES_ENABLED=false` — no real money moved).

---

## 26. Recommended Post-E2E Execution-Gate State

### If Step 3 is PASS (all criteria met)

**Recommendation: leave `GLOBAL_EXECUTION_ENABLED=true` unchanged.**

Rationale:
- The immediately following task is the final GO/NO-GO decision (not yet registered)
- Toggling the gate back to `false` and then toggling it again for the GO/NO-GO decision introduces unnecessary PM2 churn and re-verification overhead
- `LAUNCH_STATE=INTERNAL` — no user invitations have been issued; no public user traffic
- Watchdog is active and monitoring; any anomaly will fire an alert
- This matches EXEC-01 Option A (leave enabled between related P1 tasks)

**Do not activate `GLOBAL_EXECUTION_ENABLED=false` after a PASS unless a safety concern arises.**

### If Step 3 is FAIL / BLOCKER

Execute the rollback procedure in §25 immediately. Gate must return to `false` before any further investigation or planning.

---

## 27. Step 3 Acceptance Criteria

Step 3 is **PASS** when ALL of the following are met:

| # | Criterion |
|---|-----------|
| 1 | Pre-flight: all 5 PM2 processes online; gate = `true`; API Gateway, AI Service, container-manager, frontend, Redis all healthy |
| 2 | Keith successfully accesses `https://staging.ainow.biz/en/app` (login if needed; functional) |
| 3 | Keith creates fresh project named "Private Beta E2E 2026-08-10" without error |
| 4 | Keith submits the exact prompt; execution is accepted (not 503, not credit error) |
| 5 | AI execution completes (status shows completion; result surfaced in chat) |
| 6 | `index.html` appears in the file tree |
| 7 | Keith can open `index.html` in the editor and see non-empty content |
| 8 | Preview renders the page — heading "Private Beta Launch Checklist" visible |
| 9 | At least ONE interactive preview behavior works (toggle OR add-item) |
| 10 | After browser refresh: project identifiable, `index.html` still present, preview recoverable |
| 11 | After navigate-away + return: project appears in list, `index.html` still present |
| 12 | Credit balance decreases after execution; no Stripe charge occurs |
| 13 | No watchdog outage alert fires during the journey window |
| 14 | Post-flight: all 5 PM2 processes still online; no crash loop; Harness flags still false; billing flag still false |
| 15 | Cursor collects runtime evidence (execution record, credit deduction, health evidence) |

Step 3 is **FAIL / BLOCKED** if any blocker criterion from §24 is triggered.

---

## 28. Explicit Exclusions

The following are **explicitly out of scope** for the E2E journey and must not be evaluated as blockers:

- Harness multi-turn execution (not activated; not beta scope)
- Non-Builder system agents (Chief of Staff, Product Strategy, Technology Advisor) — COMING SOON placeholders
- User-created agent execution — profile persistence only; not executable
- Multi-agent collaboration — PLANNED; not current
- Google OAuth login — PLANNED; not activated
- Live Stripe payments — `BILLING_CHARGES_ENABLED=false`; not current
- RPG walking characters / pixel-map game engine — PLANNED; not current
- Semantic / vector search — PLANNED; not current
- Admin console flows — not part of beta user journey
- Import/export flows — not part of this E2E journey
- Manual git checkpoint creation — not tested (checkpoint created automatically by system; not surfaced as explicit user action here)
| PRIVATE-BETA-INVITE-01 — **untouched / unregistered** throughout this task

---

## 29. Final Step 3 Readiness Verdict

### Evidence Assessment

| Factor | Status |
|--------|--------|
| `GLOBAL_EXECUTION_ENABLED=true` | Confirmed (EXEC-01 deliberate final state) |
| xAI provider staging-proven | Execution ID `24acd697-b55c-40d0-b2d5-32faf9b85709` — PASS |
| Preview routing fixed | BLOCKER-02 fix commit `f73da07` deployed — live preview PASS |
| Landing page regression fixed | BLOCKER-01 fix commit `651f723` deployed — all locales PASS |
| Watchdog operational | OPS-01 — email delivery proven — 5 probes healthy |
| Credit balance sufficient | ~4922 (ample margin for one small execution) |
| Harness disabled | Confirmed from EXEC-01 evidence |
| Stripe disabled | `BILLING_CHARGES_ENABLED=false` confirmed |
| Single-shot plain path proven | EXEC-01 smoke PASS; BILLING-READY-08 smoke PASS |
| No code/config fix required for this journey | Confirmed — read-only analysis |

### Is More Than One Provider Execution Required?

**No.** One real AI execution is sufficient to verify:
- AI response received
- Structured file actions parsed and applied
- File tree coherent
- Editor shows content
- Preview renders and interacts
- Persistence via refresh
- Project reopen
- Credit accounting

A second provider call is **explicitly prohibited** unless Keith encounters a genuine blocking failure on the first attempt that requires re-execution to diagnose.

### Prerequisites / Conditions

| Precondition | Status |
|--------------|--------|
| Staging pre-flight healthy (all 5 PM2 processes) | Must be verified at Step 3 start via SSH |
| Credit balance > 0 | Expected ~4922; verify at Step 3 start |
| Keith login credentials known | Keith's responsibility |
| Keith has time for ~30-minute bounded session | Keith's responsibility |

### Verdict

**READY FOR KEITH E2E**

No code fix, configuration change, migration, or runtime action is required before Keith can safely begin Step 3. All systemic blockers (BLOCKER-01, BLOCKER-02, EXEC-01) are resolved. The gate is active. The path is staging-proven. The journey plan is defined.

---

## 30. Exact Next Step

**PRIVATE-BETA-E2E-01 Step 3 — Keith Full End-to-End Staging Journey + Evidence Collection**

Step 3 procedure:
1. Cursor performs operational pre-flight via SSH (§19)
2. Keith begins browser journey following §22 checklist
3. Keith records classification for each of the 18 checklist items
4. Cursor collects runtime evidence via SSH (§23)
5. Both Keith browser evidence and Cursor runtime evidence are combined
6. Step 3 classified as PASS, FAIL, or PASS WITH LIMITATIONS per §27 acceptance criteria
7. If PASS: proceed to Step 4 (Consolidation / Checkpoint)
8. If FAIL: apply rollback per §25 and diagnose before retrying

---

## Step Completion Record

| Step | Description | Status | Date |
|------|-------------|--------|------|
| Step 1 | Registration | COMPLETE | 2026-08-10 |
| Step 2 | Journey Plan + Stage-Start | **COMPLETE** | 2026-08-10 |
| Step 3 | Keith Full E2E Staging Journey + Evidence Collection | NOT STARTED | — |
| Step 4 | Consolidation / Checkpoint | NOT STARTED | — |

---

*Stage-start created: 2026-08-10 — PRIVATE-BETA-E2E-01 Step 2 — READ-ONLY planning only — no provider execution, no runtime mutation, no SSH action, no staging deploy, no env change, no PM2 action, no DB/Redis action occurred during this step.*
