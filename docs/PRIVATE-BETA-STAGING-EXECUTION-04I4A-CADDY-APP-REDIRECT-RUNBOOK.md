# PRIVATE-BETA-STAGING-EXECUTION-04I4A — Caddy Exact `/app` Redirect Fix — Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I4A
**Title:** Caddy Exact `/app` Redirect Fix
**Step:** 1 — Registration (COMPLETE — 2026-08-04)
**Status:** ACTIVE — Step 1 COMPLETE (Registration — 2026-08-04) — Implementation APPROVAL-GATED
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04I4
**Grandparent:** PRIVATE-BETA-STAGING-EXECUTION-04I
**Root:** PRIVATE-BETA-STAGING-EXECUTION-04
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action)
**Date:** 2026-08-04

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I4A |
| Title | Caddy Exact `/app` Redirect Fix |
| Status | **ACTIVE — Step 1 COMPLETE (Registration — 2026-08-04) — Implementation APPROVAL-GATED** |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04I4 |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Root | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Registered | 2026-08-04 |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CADDY-APP-REDIRECT-RUNBOOK.md` (this file) |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CHECKPOINT.md` |
| Investigation source | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4-APP-REDIRECT-LOCALHOST-INVESTIGATION.md` |

---

## 2. Purpose and Blocker Context

### Blocker: Path F — `https://staging.ainow.biz/app` redirects to `https://localhost:3002/en/app`

When an authenticated user navigates to `https://staging.ainow.biz/app`, Caddy forwards the request to Next.js at `localhost:3002`. Next.js middleware (catch-all block, `frontend/middleware.ts` lines 38–42) calls `request.nextUrl.clone()`, which inherits the process-level host `localhost:3002`, and returns `NextResponse.redirect(url)` with `Location: https://localhost:3002/en/app`. The browser follows this to `localhost:3002`, which is unreachable from a public browser and exposes the internal service address. This is a P0 staging blocker.

### Root Cause (Same Class as 04I1/04I2C)

Caddy's `reverse_proxy 127.0.0.1:3002` does not forward `Host: staging.ainow.biz`. Next.js sees `localhost:3002` as the request host. `request.nextUrl.clone()` inherits this host. The resulting absolute redirect URL exposes `localhost:3002`.

### Why 04I2C Pattern Is the Minimum-Risk Fix

04I2C added `redir / /en 307` to the Caddyfile staging block. Caddy itself issues this redirect using its own public TLS context, so the Location header is `/en` (relative) and the browser completes to `https://staging.ainow.biz/en`. This is the only pattern confirmed to fix the localhost-leakage issue at staging. No Next.js source change was involved.

04I4A applies the same pattern for `/app`.

---

## 3. Scope Decision

### What 04I4A Does (ONLY)

Add one exact Caddy redirect to the `staging.ainow.biz` Caddyfile block:

```caddy
redir /app /en/app 307
```

This redirect is placed immediately after the existing `redir / /en 307` line. Caddy intercepts `/app` before it reaches the `reverse_proxy` rule, and issues the redirect using its public context.

### What 04I4A Does NOT Do

| Out of scope | Reason |
|---|---|
| Caddy regexp catch-all for all unlocalized routes | Deferred — affects many routes — requires separate evaluation and approval — possible future 04I4B |
| Source-level `frontend/middleware.ts` fix | Avoided — 04I2A demonstrated HTTP/2 500 at staging for source middleware changes — same `request.nextUrl.clone()` pattern |
| Fixes for `/login`, `/register` without locale prefix | Deferred — not a confirmed active blocker — 04I paths B and C tested at `/en/login` and `/en/register` (already localized) |
| Any other Caddyfile change | Not authorized in this slice |
| PM2 restart | Not required — Caddy reload only |
| Frontend build | Not required |
| Database migration | Out of scope |
| Docker / PostgreSQL / Redis | Out of scope |

### Deferred: Possible Future 04I4B

A follow-up hardening task — `PRIVATE-BETA-STAGING-EXECUTION-04I4B — General Unlocalized Route Redirect Hardening` — is recommended but NOT registered yet. It would add a Caddy regexp catch-all to cover all future unlocalized routes. It is deferred because:

1. Keith prefers one fix at a time.
2. Path F blocker is specifically `/app`.
3. A regexp catch-all may affect many routes and requires its own review.
4. The exact-root redirect pattern from 04I2C is already proven safe.

---

## 4. Required Approval Phrase

Because implementation edits live Caddy configuration and reloads the Caddy service on the public staging VPS, Keith must provide explicit written approval before any implementation action.

**Required approval phrase:**

```
go — approve 04I4A Caddy app redirect fix
```

**No implementation action may proceed without this exact phrase.**

---

## 5. Pre-Checks (Before Any Change)

Run the following checks via AWS Lightsail browser SSH before touching the Caddyfile.

### 5.1 Date / Git State

```bash
date
cd /opt/aisandbox
git log --oneline -1
git status
```

Expected:
- Date near 2026-08-04
- git HEAD: `40c43af Reconcile staging root redirect state`
- git status: clean (no modified files)

### 5.2 Service State

```bash
systemctl is-active pm2-ubuntu
systemctl is-active caddy
pm2 list
```

Expected:
- `pm2-ubuntu`: `active`
- `caddy`: `active`
- All four PM2 apps: `online`

### 5.3 Existing Caddy Redirect Presence

```bash
grep -n "redir" /etc/caddy/Caddyfile
```

Expected output must include:
```
redir / /en 307
```

The existing `redir / /en 307` line from 04I2C must be present. If it is missing, **STOP** — do not proceed — the VPS Caddyfile state is unexpected.

### 5.4 `/en/app` Reachability (Browser Only — Not Server curl)

Confirm that while logged in to `https://staging.ainow.biz`, navigating to `https://staging.ainow.biz/en/app` loads successfully without errors. This confirms the localized app route works before the redirect is added. This check must be done from a browser, not from the VPS terminal.

---

## 6. Caddyfile Backup

Before any edit:

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-04I4A-$(date +%Y%m%d-%H%M%S)
ls -la /etc/caddy/Caddyfile.backup-04I4A-*
```

Record the exact backup filename in the evidence review checkpoint.

---

## 7. Caddyfile Edit

### 7.1 Current State (Expected)

The `staging.ainow.biz` block in `/etc/caddy/Caddyfile` currently contains:

```caddy
redir / /en 307
```

near the top of the block, above the `reverse_proxy` rules.

### 7.2 Target State (After Edit)

Add `redir /app /en/app 307` on the line immediately after `redir / /en 307`:

```caddy
redir / /en 307
redir /app /en/app 307
```

### 7.3 Edit Command

Using `sudo nano` or `sudo vi`:

```bash
sudo nano /etc/caddy/Caddyfile
```

Locate the line:
```
redir / /en 307
```

Add a new line immediately after it:
```
redir /app /en/app 307
```

Save and exit.

**Important:** Do not modify any other Caddyfile line. Do not change the `/api/*` proxy, the `reverse_proxy` fallback, TLS settings, or any other directive.

---

## 8. Caddy Validation

Before reloading, validate the Caddyfile:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Expected output: `Valid configuration`

If validation fails:
- **STOP — do not reload Caddy.**
- Review the Caddyfile for syntax errors.
- Restore from backup (Section 10) if the Caddyfile cannot be repaired.

---

## 9. Caddy Reload

Reload Caddy only (do not restart — reload applies new config without dropping connections):

```bash
sudo systemctl reload caddy
```

Confirm Caddy remains active:

```bash
systemctl is-active caddy
```

Expected: `active`

---

## 10. SSH Validation

After Caddy reload, confirm with `curl --head` from the VPS SSH session:

### 10.1 `/app` Returns 307 → `/en/app`

```bash
curl -k --head https://staging.ainow.biz/app
```

Expected:
- `HTTP/2 307` (or `HTTP/1.1 307`)
- `location: /en/app` (relative, no `localhost`)

**Critical:** The `location` header must NOT contain `localhost`. It must be `/en/app` (relative).

### 10.2 Other Routes Unaffected

```bash
curl -k --head https://staging.ainow.biz/en/login
curl -k --head https://staging.ainow.biz/en/register
curl -k https://staging.ainow.biz/api/health
curl -k https://staging.ainow.biz/api/health/db
curl -k https://staging.ainow.biz/api/health/ready
```

Expected:
- `/en/login`: 200
- `/en/register`: 200
- `/api/health`: 200
- `/api/health/db`: 200
- `/api/health/ready`: 200

If any of these fail, **STOP — initiate rollback (Section 11).**

---

## 11. Browser Validation

After SSH validation passes, perform browser validation:

### 11.1 Path F Fix Confirmation

1. Open browser with an active authenticated staging session (logged in to `https://staging.ainow.biz`).
2. Navigate to: `https://staging.ainow.biz/app`
3. Expected outcomes:
   - Final URL in browser address bar: `https://staging.ainow.biz/en/app`
   - No `localhost` in URL bar
   - HTTPS lock icon valid (no certificate error)
   - App page loads without being redirected back to login
   - No browser error page

### 11.2 Regression Confirmation

Confirm that prior PASS paths remain PASS:

| Path | Expected |
|---|---|
| `https://staging.ainow.biz` | → `https://staging.ainow.biz/en` — no localhost |
| `https://staging.ainow.biz/en/login` | Loads — HTTPS lock valid — no errors |
| `https://staging.ainow.biz/en/register` | Loads — HTTPS lock valid — no errors |

---

## 12. Rollback Plan

Rollback is required if any of the following occur:
- Caddy validation fails after editing the Caddyfile.
- Caddy reload fails or Caddy goes inactive after reload.
- Any health endpoint returns non-200 after reload.
- `https://staging.ainow.biz/app` still shows `localhost` after reload.
- Browser validation fails.
- Any prior-PASS path fails after the change.

### Rollback Command

```bash
sudo cp /etc/caddy/Caddyfile.backup-04I4A-<TIMESTAMP> /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

After rollback, re-validate health:

```bash
curl -k https://staging.ainow.biz/api/health
curl -k https://staging.ainow.biz/api/health/db
curl -k https://staging.ainow.biz/api/health/ready
systemctl is-active caddy
```

Expected: all 200, caddy active.

If rollback restores the prior state, record the rollback in the evidence checkpoint and halt. Do not retry without explicit re-registration and re-approval.

---

## 13. Evidence to Collect for Checkpoint

For `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CHECKPOINT.md`, record:

1. Date/time of execution.
2. VPS git HEAD and git status at time of execution.
3. Exact backup filename created.
4. Caddy validate output.
5. Caddy reload result (`systemctl is-active caddy`).
6. SSH validation output: `/app` location header value.
7. SSH validation output: `/en/login`, `/en/register` HTTP status codes.
8. SSH validation output: API health/db/ready HTTP status codes.
9. Browser validation outcome: final URL for `https://staging.ainow.biz/app`.
10. Browser HTTPS lock status.
11. Whether app page loaded without errors.
12. Whether login redirect occurred (must NOT occur for authenticated user).
13. Whether rollback was required (YES / NO). If YES, rollback outcome.
14. PM2 app states after reload.

---

## 14. Workflow Steps

**2-step loop (tiny implementation):**

| Step | Description | Status |
|---|---|---|
| 1 | Registration | **COMPLETE — 2026-08-04** |
| 2 | Implementation + Consolidation/Checkpoint | **PENDING — APPROVAL-GATED** |

Step 2 requires Keith's written approval phrase:
```
go — approve 04I4A Caddy app redirect fix
```

---

## 15. Non-Goals

| Non-goal | Reason |
|---|---|
| Broader regexp catch-all redirect | Deferred to possible 04I4B |
| Source-level `frontend/middleware.ts` fix | High risk — 04I2A demonstrated HTTP/2 500 |
| `/login` or `/register` exact redirects | Not a confirmed active blocker — deferred |
| PM2 restart | Not needed — Caddy reload only |
| Frontend build or npm ci | Not needed — Caddyfile-only change |
| Docker / PostgreSQL / Redis | Out of scope |
| Database migration | Out of scope |
| AI execution / billing / OAuth | Out of scope |
| Google OAuth enablement | Out of scope |
| Production environment | Out of scope |

---

## 16. Acceptance Criteria

### Registration (Step 1 — COMPLETE 2026-08-04)

- [x] 04I4A registered with ACTIVE status in TASKS.md
- [x] 04I4A registered with ACTIVE status in TASKS_BACKLOG_FULL.md
- [x] Runbook created: `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CADDY-APP-REDIRECT-RUNBOOK.md`
- [x] Exact Caddy redirect scope documented: `redir /app /en/app 307` only
- [x] Broader regexp redirect explicitly deferred (possible future 04I4B)
- [x] Source-level middleware fix explicitly avoided (04I2A risk documented)
- [x] Pre-checks documented
- [x] Backup plan documented
- [x] Caddy validate/reload plan documented
- [x] SSH validation documented
- [x] Browser validation documented
- [x] Rollback plan documented
- [x] Approval phrase documented: `go — approve 04I4A Caddy app redirect fix`
- [x] TASKS.md updated: 04I4A ACTIVE — Step 1 COMPLETE
- [x] TASKS_BACKLOG_FULL.md updated
- [x] AINOW-EXECUTION-ROADMAP.md updated
- [x] No source code changed
- [x] No runtime/server action occurred
- [x] No env files opened or changed
- [x] No Docker/PostgreSQL/Redis action
- [x] No email/account/login/AI/billing/container/OAuth action
- [x] No git commit or push

### Implementation + Consolidation (Step 2 — PENDING)

- [ ] Keith approval phrase received: `go — approve 04I4A Caddy app redirect fix`
- [ ] Pre-checks passed
- [ ] Caddyfile backup created
- [ ] `redir /app /en/app 307` added after `redir / /en 307`
- [ ] `caddy validate` returns `Valid configuration`
- [ ] `sudo systemctl reload caddy` succeeds — caddy active
- [ ] SSH: `https://staging.ainow.biz/app` returns 307 `location: /en/app` (no localhost)
- [ ] SSH: `/en/login`, `/en/register` still 200
- [ ] SSH: `/api/health`, `/api/health/db`, `/api/health/ready` still 200
- [ ] Browser: `https://staging.ainow.biz/app` → final URL `https://staging.ainow.biz/en/app` — no localhost — HTTPS lock valid — app loads
- [ ] No rollback required
- [ ] Checkpoint created: `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CHECKPOINT.md`
- [ ] TASKS.md updated: 04I4A COMPLETE and LOCKED
- [ ] TASKS_BACKLOG_FULL.md updated
- [ ] AINOW-EXECUTION-ROADMAP.md updated
- [ ] 04I resumes Path F smoke after 04I4A COMPLETE

---

## 17. Current Task / Phase Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04I4A | **ACTIVE — Step 1 COMPLETE (Registration — 2026-08-04) — Implementation APPROVAL-GATED** |
| PRIVATE-BETA-STAGING-EXECUTION-04I4 | ACTIVE — BLOCKED pending 04I4A implementation |
| PRIVATE-BETA-STAGING-EXECUTION-04I3 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I3A | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I | ACTIVE — BLOCKED by 04I4A |
| PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## 18. Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or changed
- ✅ No env values read, printed, or recorded
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No email/account/login/AI/billing/container/OAuth action
- ✅ No git commit or push
- ✅ No subagents used
