# PRIVATE-BETA-STAGING-EXECUTION-04I2E — Safe Git/VPS State Synchronization Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I2E
**Title:** Safe Git/VPS State Synchronization
**Step:** 2 — Runbook
**Status:** ACTIVE — Step 1 COMPLETE (Registration — 2026-08-04) — Step 2 COMPLETE (Runbook — 2026-08-04)
**Runbook date:** 2026-08-04
**Nature:** Runbook only — no SSH — no AWS CLI/actions — no browser opened by Cursor — no accounts created — no login/register executed — no AI execution — no billing/payment execution — no container workflow execution — no Google OAuth enablement — no DNS/TLS changes — no Caddy reload/restart — no PM2/systemd commands — no `.env` opened/created/edited — no env values printed — no dependency install — no app services started/stopped/restarted — no migrations — no Docker/PostgreSQL/Redis actions — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I2E |
| Title | Safe Git/VPS State Synchronization |
| Step | 2 — Runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04I2 |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Great-grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessor | 04I2D COMPLETE and LOCKED — 2026-08-04 — local source reconciliation PASS |
| Commit | `40c43af Reconcile staging root redirect state` |
| Remote | `origin/main` now points to `40c43af` |
| Local status | Clean |

---

## 2. Confirmed Local Git State

```text
Keith committed and pushed local reconciled changes.

Commit:
40c43af Reconcile staging root redirect state

Remote:
origin/main now points to 40c43af.

Local status:
clean.

This commit includes:
- 04I2B evidence review
- 04I2C strategy/evidence/checkpoint docs
- 04I2D checkpoint
- TASKS.md / TASKS_BACKLOG_FULL.md / roadmap updates
- frontend/middleware.ts reverted away from failed 04I2A source fix
```

---

## 3. Confirmed VPS State to Preserve

```text
VPS currently:
- HEAD is older than origin/main.
- Working tree intentionally dirty:
  - M frontend/middleware.ts
  - M frontend/tsconfig.tsbuildinfo
- frontend/middleware.ts on VPS was manually rolled back to the supported request.nextUrl.clone() pattern.
- frontend/tsconfig.tsbuildinfo is build noise.
- Caddyfile contains accepted live runtime fix:
  redir / /en 307
- Root redirect browser validation already passed:
  https://staging.ainow.biz → https://staging.ainow.biz/en
  no localhost
  HTTPS lock valid
```

---

## 4. Reconciled middleware.ts State

The reconciled `frontend/middleware.ts` at commit `40c43af` (origin/main) contains the `request.nextUrl.clone()` pattern for root redirect:

```typescript
if (pathname === '/') {
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}`;
  return NextResponse.redirect(url);
}
```

The VPS dirty `frontend/middleware.ts` (intentionally rolled back from 04I2A) also uses the `request.nextUrl.clone()` pattern — same as reconciled origin/main.

**The root redirect at runtime is handled by Caddy `redir / /en 307` before the request reaches Next.js.** This Caddy fix is the accepted runtime invariant and must not be removed or overwritten during this sync. The Caddyfile is not tracked in git and is not affected by `git merge --ff-only`.

---

## 5. Accepted Invariants (Must Survive This Sync)

| Invariant | Required Value | Notes |
|-----------|----------------|-------|
| Caddyfile `redir / /en 307` | Present — do not remove | Not in git — will not be changed by merge |
| Caddyfile backup | `/etc/caddy/Caddyfile.backup-04I2C-20260803-215649` | Reference for rollback |
| 04I2A middleware pattern must NOT be deployed | `new NextResponse(null, { status: 307, headers: { Location: '/en' } })` absent | 40c43af has reverted this |
| Table count | 26 | Must remain 26 throughout |
| `pm2-ubuntu` | enabled / active | Must remain so |
| `caddy` | enabled / active | Must remain so |
| Root redirect Location | `/en` (no localhost) | Caddy layer handles this |

---

## 6. Approval Gate

⚠️ **Do not begin execution of Sections 8–17 until Keith types the exact approval phrase below.**

```text
go — approve 04I2E safe VPS sync
```

All VPS execution in Sections 8–17 requires this approval before starting.

---

## 7. Stop Conditions

Stop immediately and do not proceed if any of the following occur:

| Condition | Action |
|-----------|--------|
| `origin/main` does not contain commit `40c43af` or a newer commit that includes the reconciled middleware | **STOP — do not pull or merge** |
| `frontend/middleware.ts` md5 on VPS does not match `origin/main:frontend/middleware.ts` md5 | **STOP — do not clean dirty state — escalate** |
| VPS `git status` shows unexpected dirty files beyond `frontend/middleware.ts` and `frontend/tsconfig.tsbuildinfo` | **STOP — record unexpected files — do not proceed** |
| `sudo grep "redir / /en" /etc/caddy/Caddyfile` returns no output | **STOP — Caddy invariant lost — escalate** |
| `caddy` is inactive | **STOP — escalate** |
| `pm2-ubuntu` is inactive | **STOP — escalate** |
| Table count is not 26 | **STOP — escalate** |
| `git merge --ff-only origin/main` cannot fast-forward (e.g. diverged history) | **STOP — do not force — escalate** |
| Frontend build fails | **STOP — do not restart pm2 — record full build output** |
| `aisandbox-frontend` is `errored` or offline after pm2 restart | **STOP — record pm2 logs — see Section 17** |
| Root redirect returns `Location` containing `localhost` after sync | **STOP — see Section 17 rollback** |
| Root redirect returns non-307 (e.g. 500) after sync | **STOP — see Section 17 rollback** |
| `/en`, `/en/login`, `/en/register` return non-200 | **STOP — see Section 17 rollback** |
| API `/api/health`, `/api/health/db`, `/api/health/ready` return non-200 | **STOP — escalate** |
| Any env/secret file would need to be opened | **STOP** |
| Any production domain (non-staging) appears in commands or output | **STOP** |

---

## 8. Section 1 — Pre-Sync Safety Check

**Purpose:** Confirm VPS baseline before touching git state. Record all values as evidence.

Run in AWS Lightsail browser SSH:

```bash
date
git -C /opt/aisandbox status
git -C /opt/aisandbox log --oneline -5
```

**Expected:**
- Date prints — record it.
- `git status` shows `M frontend/middleware.ts` and `M frontend/tsconfig.tsbuildinfo` only. No other modified or untracked files relevant to the app (Caddyfile is not tracked and should not appear).
- `git log` shows HEAD at a commit older than `40c43af`.

**Stop condition:** Any unexpected dirty file in `git status` beyond `frontend/middleware.ts` and `frontend/tsconfig.tsbuildinfo` → STOP.

```bash
systemctl is-enabled pm2-ubuntu && systemctl is-active pm2-ubuntu
systemctl is-enabled caddy && systemctl is-active caddy
```

**Expected:** Both return `enabled` then `active` for each service.

**Stop condition:** Either service is inactive → STOP.

```bash
sudo grep -n "redir" /etc/caddy/Caddyfile
```

**Expected:** Output contains `redir / /en 307`.

**Stop condition:** Not present → STOP — Caddy invariant lost.

```bash
pm2 list
```

**Expected:** All four PM2 apps online: `aisandbox-api`, `aisandbox-ai`, `aisandbox-container`, `aisandbox-frontend`.

---

## 9. Section 2 — Fetch and Inspect origin/main

**Purpose:** Pull remote ref metadata only — do not merge yet.

```bash
git -C /opt/aisandbox fetch origin
git -C /opt/aisandbox log origin/main --oneline -5
```

**Expected:** `origin/main` shows `40c43af Reconcile staging root redirect state` at or near HEAD of the remote log.

**Stop condition:** `40c43af` does not appear → STOP.

```bash
git -C /opt/aisandbox diff HEAD..origin/main --name-only
```

**Expected:** Lists files changed between VPS HEAD and `origin/main` — should include `frontend/middleware.ts` plus governance/docs files committed in `40c43af`. No unexpected source files.

---

## 10. Section 3 — Verify Middleware Equality Before Cleaning Dirty State

**Purpose:** Confirm VPS dirty `frontend/middleware.ts` matches `origin/main:frontend/middleware.ts` before discarding VPS dirty state. This is the critical safety gate.

```bash
git -C /opt/aisandbox show origin/main:frontend/middleware.ts | md5sum
md5sum /opt/aisandbox/frontend/middleware.ts
```

**Expected:** Both md5 hashes are identical.

Record both hash values as evidence.

**Stop condition:** Hashes do not match → STOP — do not clean dirty state — inspect differences manually before proceeding.

If hashes match, proceed to Section 11.

---

## 11. Section 4 — Clean Tracked Dirty Files Safely

**Purpose:** Discard VPS tracked dirty state only after middleware equality is confirmed in Section 10.

Only run after Section 10 confirms middleware hashes match.

```bash
git -C /opt/aisandbox checkout -- frontend/middleware.ts
git -C /opt/aisandbox checkout -- frontend/tsconfig.tsbuildinfo
git -C /opt/aisandbox status
```

**Expected:**
- Both checkouts succeed with no error output.
- `git status` returns `nothing to commit, working tree clean`.

**Stop condition:** Any error from checkout, or unexpected dirty files remain → STOP.

---

## 12. Section 5 — Fast-Forward Sync

**Purpose:** Advance VPS HEAD to `origin/main` via fast-forward only. Do not allow merge commits or force-push.

```bash
git -C /opt/aisandbox merge --ff-only origin/main
git -C /opt/aisandbox log --oneline -5
git -C /opt/aisandbox status
```

**Expected:**
- `merge --ff-only` outputs "Fast-forward" and succeeds.
- `git log` shows `40c43af Reconcile staging root redirect state` at HEAD.
- `git status` shows `nothing to commit, working tree clean`.

**Stop condition:** `merge --ff-only` fails (e.g. "Not possible to fast-forward") → STOP — do not force-merge.

---

## 13. Section 6 — Build Frontend and Restart aisandbox-frontend Only

**Purpose:** Rebuild frontend with reconciled source. Restart only `aisandbox-frontend` — do not restart other PM2 apps.

```bash
cd /opt/aisandbox/frontend && npm run build 2>&1 | tail -40
```

**Expected:** Build completes successfully. Output includes `✓ Compiled` or equivalent Next.js build success indicators. Exit code 0. No fatal error.

**Stop condition:** Build fails → STOP — do not restart pm2 — record full build output for diagnosis.

```bash
pm2 restart aisandbox-frontend
sleep 5
pm2 list
```

**Expected:** `aisandbox-frontend` status is `online`. Restart count increments by 1. No `errored` state.

**Stop condition:** `aisandbox-frontend` is `errored` or not online → STOP — see Section 17.

---

## 14. Section 7 — Verify Caddy Exact-Root Redirect Still Present

**Purpose:** Confirm Caddy `redir / /en 307` survived the sync unchanged. The Caddyfile is not tracked in git, so `git merge --ff-only` should not have touched it. This is a verification-only step.

```bash
sudo grep -n "redir" /etc/caddy/Caddyfile
sudo systemctl is-active caddy
```

**Expected:**
- Output contains `redir / /en 307`.
- Caddy is `active`.

**Stop condition:** `redir / /en 307` not present → STOP — escalate immediately. (This should not happen as the Caddyfile is not in git, but must be confirmed before proceeding to runtime checks.)

---

## 15. Section 8 — Runtime Validation

**Purpose:** Confirm all health endpoints, root redirect, and locale routes are correct after sync and restart.

### Root redirect (most critical):

```bash
curl -si https://staging.ainow.biz/ | grep -E 'HTTP|Location'
curl -si https://staging.ainow.biz | grep -E 'HTTP|Location'
```

**Expected:** `HTTP/2 307` and `location: /en` (no localhost — no https://staging.ainow.biz prefix needed in Location).

**Stop condition:** Location contains `localhost` → STOP — see Section 17. Root returns 500 → STOP.

### Follow root redirect (confirm chain):

```bash
curl -siL https://staging.ainow.biz/ | head -10
```

**Expected:** Final response is `HTTP/2 200` from `/en`.

### Public locale routes:

```bash
curl -si https://staging.ainow.biz/en | head -3
curl -si https://staging.ainow.biz/en/login | head -3
curl -si https://staging.ainow.biz/en/register | head -3
```

**Expected:** All return `HTTP/2 200`.

**Stop condition:** Any non-200 → STOP — see Section 17.

### Public API health endpoints:

```bash
curl -si https://staging.ainow.biz/api/health | head -3
curl -si https://staging.ainow.biz/api/health/db | head -3
curl -si https://staging.ainow.biz/api/health/ready | head -3
```

**Expected:** All return `HTTP/2 200`.

### Local health endpoints:

```bash
curl -si http://127.0.0.1:4000/api/health | head -3
curl -si http://127.0.0.1:4000/api/health/db | head -3
curl -si http://127.0.0.1:4000/api/health/ready | head -3
curl -si http://127.0.0.1:4002/api/health | head -3
curl -si http://127.0.0.1:3002/ | grep -E 'HTTP|Location'
```

**Expected:** All API endpoints return 200. Local frontend root returns 307.

### Table count:

Use the established psql table count verification pattern from prior runbooks (04I2C, 04H). Do not print DATABASE_URL. Only record the count result. Expected: 26.

**Stop condition:** Count is not 26 → STOP — escalate.

### PM2 and service final state:

```bash
pm2 list
systemctl is-enabled pm2-ubuntu && systemctl is-active pm2-ubuntu
systemctl is-enabled caddy && systemctl is-active caddy
```

**Expected:** All four apps online. Both services enabled/active.

---

## 16. Section 9 — Browser Validation Instructions

**Purpose:** Keith browser-confirms root redirect still works correctly after sync and frontend restart.

Open browser and check the following paths:

| Path | Expected behavior |
|------|-------------------|
| `https://staging.ainow.biz` | Redirects to `https://staging.ainow.biz/en` — no localhost |
| `https://staging.ainow.biz/` | Redirects to `https://staging.ainow.biz/en` — no localhost |
| `https://staging.ainow.biz/en` | Loads — 200 |
| `https://staging.ainow.biz/en/login` | Loads — 200 |
| `https://staging.ainow.biz/en/register` | Loads — 200 |

Confirm:
- No localhost URL appears at any point in the browser address bar.
- HTTPS lock is valid.
- No account created / no login / no AI/billing/container/OAuth execution.

**Stop condition:** Root does not redirect to `/en`, or localhost appears → STOP — see Section 17.

---

## 17. Section 10 — Rollback / Stop Instructions

### If frontend build fails (Section 13):

- Do NOT restart `aisandbox-frontend`.
- Record full build error output.
- At this point VPS HEAD is at `40c43af` (fast-forward completed) but the new build artifact is absent.
- The prior `aisandbox-frontend` PM2 process is still running with the previous build artifact — it should still be serving.
- Verify `aisandbox-frontend` is still online: `pm2 list`
- Do not attempt to rebuild without diagnosis.
- Escalate to next step.

### If aisandbox-frontend fails to restart (Section 13):

```bash
pm2 logs aisandbox-frontend --lines 50
pm2 list
```

- Record full output.
- Do not attempt additional `pm2 restart` without diagnosis.
- Escalate.

### If root redirect stops working after sync (Sections 15/16):

First confirm Caddy redirect is still present:

```bash
sudo grep -n "redir" /etc/caddy/Caddyfile
sudo systemctl is-active caddy
```

Check if Next.js is returning the localhost redirect directly (from the local frontend):

```bash
curl -si http://127.0.0.1:3002/ | grep -E 'HTTP|Location'
```

If the local frontend returns `https://localhost:3002/en` but Caddy `redir / /en 307` is still present, the issue is that the Caddy redirect is not intercepting first — escalate.

If Caddy `redir / /en 307` is missing (should not happen — not in git):

```bash
# Do not restore Caddy without explicit approval
# Record full Caddyfile content: sudo cat /etc/caddy/Caddyfile
# Escalate immediately
```

### General escalation:

- Do NOT run `git reset --hard` without explicit approval.
- Do NOT restart additional services beyond `aisandbox-frontend` without explicit approval.
- Record all command output before escalating.
- The Caddyfile backup reference if needed: `/etc/caddy/Caddyfile.backup-04I2C-20260803-215649`

---

## 18. Evidence to Produce After Execution

After successful execution, Keith records:

| Check | Value to Record |
|-------|----------------|
| Date at start | [record] |
| VPS pre-sync git status | M frontend/middleware.ts / M frontend/tsconfig.tsbuildinfo — nothing else |
| VPS HEAD before fast-forward | [record commit hash] |
| origin/main HEAD | `40c43af` confirmed |
| middleware md5 — origin/main | [record hash] |
| middleware md5 — VPS dirty | [record hash — must match] |
| Post-clean git status | nothing to commit, working tree clean |
| Post-sync HEAD | `40c43af` |
| Build result | PASS — exit code 0 |
| `aisandbox-frontend` pm2 status | online |
| Caddy `redir / /en 307` present | yes |
| Caddy status | enabled / active |
| root slash `Location` | `/en` |
| root no-slash `Location` | `/en` |
| `/en` | 200 |
| `/en/login` | 200 |
| `/en/register` | 200 |
| Public API health | 200 |
| Public API db | 200 |
| Public API ready | 200 |
| Local API health | 200 |
| Local API db | 200 |
| Local API ready | 200 |
| Local container health | 200 |
| Local frontend root | 307 |
| Table count | 26 |
| pm2-ubuntu | enabled / active |
| Browser root redirect | `https://staging.ainow.biz` → `https://staging.ainow.biz/en` — PASS |
| Browser HTTPS lock | valid |
| No localhost in browser | confirmed |

---

## 19. Next Steps After Runbook Execution

After Keith runs Sections 8–17 and records evidence from Section 18:

1. **Success:** Produce 04I2E consolidation checkpoint (Step 3/4) to COMPLETE and LOCK 04I2E.
2. **Success:** 04I2 and 04I parent tasks can resume — proceed with 04I browser smoke Paths B/C/D/E/F.
3. **Failure with rollback:** Record failure evidence, escalate, register new bounded recovery task.

---

## 20. Non-Goal Verification (Runbook Step Only)

| Non-goal | Occurred in this runbook step? | Verdict |
|----------|-------------------------------|---------|
| Source code changed | No | PASS |
| Runtime/server action | No | PASS |
| Env files opened/changed | No | PASS |
| Env values printed | No | PASS |
| SSH performed by Cursor | No | PASS |
| AWS CLI used by Cursor | No | PASS |
| Caddy edited/reloaded/restarted by Cursor | No | PASS |
| PM2/systemd commands run by Cursor | No | PASS |
| Docker/PostgreSQL/Redis actions | No | PASS |
| Tests/builds run by Cursor | No | PASS |
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

**Runbook created:** 2026-08-04
**04I2E Step 2 status:** COMPLETE — Runbook prepared and approval gate set
**Commit 40c43af recorded:** yes — Keith committed and pushed reconciled staging root redirect state
**VPS dirty state recorded:** M frontend/middleware.ts / M frontend/tsconfig.tsbuildinfo — intentional — pre-04I2A rollback pattern
**Caddy exact-root redirect preservation:** redir / /en 307 — not in git — will survive fast-forward merge — verified in Section 14
**Approval gate:** go — approve 04I2E safe VPS sync
**No SSH or AWS CLI/actions performed by Cursor.**
**No browser opened by Cursor.**
**No accounts created.**
**No env values printed.**
**No subagents used.**
**No source or migration files changed.**
**No git commit or push.**
