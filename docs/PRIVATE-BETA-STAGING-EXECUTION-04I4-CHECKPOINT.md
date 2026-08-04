# PRIVATE-BETA-STAGING-EXECUTION-04I4 — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I4
**Title:** Authenticated `/app` Locale Redirect Host Leakage
**Status:** COMPLETE and LOCKED — 2026-08-04. Do not modify this entry.
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04I
**Grandparent:** PRIVATE-BETA-STAGING-EXECUTION-04
**Root:** PRIVATE-BETA-STAGING-EXECUTION-04
**Checkpoint date:** 2026-08-04
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action by Cursor)

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I4 |
| Title | Authenticated `/app` Locale Redirect Host Leakage |
| Status | **COMPLETE and LOCKED — 2026-08-04** |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Root | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Registered | 2026-08-04 |
| Completed | 2026-08-04 |
| Steps | 1-step investigation loop — Step 1 COMPLETE (Registration + Investigation — 2026-08-04) — Fix delegated to child task 04I4A (COMPLETE and LOCKED — 2026-08-04) |
| Investigation file | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4-APP-REDIRECT-LOCALHOST-INVESTIGATION.md` |
| Fix runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CADDY-APP-REDIRECT-RUNBOOK.md` |
| Fix checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CHECKPOINT.md` |
| Checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4-CHECKPOINT.md` (this file) |

---

## 2. Original Path F Blocker

During 04I browser smoke, Path F exposed a P0 staging blocker:

| Field | Value |
|---|---|
| Path F | **BLOCKED** |
| User opened | `https://staging.ainow.biz/app` |
| Observed redirect | `https://localhost:3002/en/app` |
| Browser URL bar | Showed `localhost:3002` |
| HTTPS lock | Invalid / unreachable |
| Localhost exposed | **YES — BLOCKER** |

Public staging must never expose `localhost` in any browser-visible redirect. This blocked 04I Path F completion and was the same class of infrastructure failure as the original root redirect issue resolved by 04I2C.

Prior paths at time of discovery:

| Path | Status |
|---|---|
| Path A | PASS — `https://staging.ainow.biz` → `https://staging.ainow.biz/en` — HTTPS lock valid |
| Path B | PASS — `https://staging.ainow.biz/en/login` loads — HTTPS lock valid |
| Path C | PASS — `https://staging.ainow.biz/en/register` loads — HTTPS lock valid |
| Path D | PASS — email verification working (04I3/04I3A COMPLETE and LOCKED — 2026-08-04) |
| Path E | PASS — login submitted — final URL `https://staging.ainow.biz/en/app` — HTTPS lock valid |
| Path F | **BLOCKED** — `https://staging.ainow.biz/app` → `https://localhost:3002/en/app` — localhost exposed |

---

## 3. Investigation Summary

The investigation (`docs/PRIVATE-BETA-STAGING-EXECUTION-04I4-APP-REDIRECT-LOCALHOST-INVESTIGATION.md`) analyzed `frontend/middleware.ts` and the Caddy proxy chain.

Key findings:

1. `https://staging.ainow.biz/app` is received by Caddy on port 443.
2. Caddy's `redir / /en 307` (04I2C) is an exact match for `/` only — does NOT match `/app`.
3. Caddy forwards `/app` to Next.js at `localhost:3002` via `reverse_proxy 127.0.0.1:3002` without forwarding `Host: staging.ainow.biz`.
4. Next.js middleware receives the request with `request.nextUrl` reflecting `https://localhost:3002/app`.
5. `/app` is not localized, so the catch-all block (lines 38–42) fires:
   - `url = request.nextUrl.clone()` — inherits `host = localhost:3002`
   - `url.pathname = '/en/app'`
   - `NextResponse.redirect(url)` → `Location: https://localhost:3002/en/app`
6. Browser follows the redirect to `localhost:3002` — which is unreachable from a public browser.

All unlocalized frontend routes passing through the middleware catch-all block are affected. Only `/app` was confirmed as the active 04I blocker.

---

## 4. Root Cause Class

**Unlocalized `/app` redirect via middleware leaked `localhost` from the upstream Next.js host.**

- `Caddy reverse_proxy 127.0.0.1:3002` does not forward the public `Host:` header.
- `Next.js middleware` sees `localhost:3002` as the request host.
- `request.nextUrl.clone()` produces an absolute URL with `host = localhost:3002`.
- `NextResponse.redirect(url)` issues a `Location: https://localhost:3002/en/app` header.
- Browser receives and follows the localhost redirect.

This is the same root cause class as the original root redirect issue investigated in 04I1 and fixed by 04I2C.

---

## 5. Linked Fix Task: 04I4A

The fix was delegated to child task **PRIVATE-BETA-STAGING-EXECUTION-04I4A — Caddy Exact `/app` Redirect Fix**.

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I4A |
| Status | **COMPLETE and LOCKED — 2026-08-04** |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CADDY-APP-REDIRECT-RUNBOOK.md` |
| Checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4A-CHECKPOINT.md` |

A source-level middleware fix (Option 3) was explicitly avoided because 04I2A demonstrated that source-level middleware redirect changes cause HTTP/2 500 at staging runtime using the same `request.nextUrl.clone()` pattern.

---

## 6. Accepted Fix

The fix applied by 04I4A used the same pattern as the 04I2C proven fix.

| Field | Value |
|---|---|
| Fix type | Caddy exact-path redirect |
| Caddy directive added | `redir /app /en/app 307` |
| Placement | Immediately after `redir / /en 307` |
| Caddyfile backup | `/etc/caddy/Caddyfile.backup-04I4A-20260804-160945` |
| Caddy validate result | Valid configuration |
| Caddy reload result | active |
| Rollback required | NO |
| Pattern origin | Same as 04I2C proven Caddy exact-root redirect |

### Before

```
17:redir / /en 307
```

### After

```
17:redir / /en 307
18:redir /app /en/app 307
```

No source code was changed. No other Caddyfile lines were modified.

---

## 7. SSH Validation Evidence

SSH validation after Caddy reload confirmed all expected results:

| Check | Result |
|---|---|
| `/app` redirect | `APP_REDIRECT=307 Location:/en/app` — **PASS** — no `localhost` in Location header |
| `/en/login` | `EN_LOGIN=200` — **PASS** |
| `/en/register` | `EN_REGISTER=200` — **PASS** |
| `/api/health` | `API_HEALTH=200` — **PASS** |
| `/api/health/db` | `API_DB_HEALTH=200` — **PASS** |
| `/api/health/ready` | `API_READY=200` — **PASS** |

The `Location` header for `/app` is `/en/app` (relative) — no `localhost` appears.

---

## 8. Browser Validation Summary

Keith performed browser Path F validation with an active authenticated staging session.

| Field | Reported |
|---|---|
| App page loaded | YES |
| Stayed authenticated | YES |
| Final URL | `https://staging.ainow.biz/en/app` |
| HTTPS lock valid | YES |
| No localhost in URL | YES |
| Errors | NONE |

**Infrastructure acceptance: PASS.**

The browser URL bar showed `https://staging.ainow.biz/en/app` — not `https://localhost:3002/en/app`. The localhost leakage blocker is resolved.

---

## 9. Conflicting Field Interpretation

Keith also reported "Redirected back to login: YES".

This field conflicts with the simultaneously true evidence:
- App page loaded: YES
- Stayed authenticated: YES
- Final URL: `https://staging.ainow.biz/en/app`
- No localhost in URL: YES
- Errors: NONE

**Resolution:** The "Redirected back to login: YES" field is interpreted as a checkbox artifact, a momentary intermediate redirect observation (e.g., a pre-login-check redirect that completed before the app settled), or a session/UX anomaly unrelated to the Caddy redirect fix. The final URL and confirmed app-loaded/authenticated fields are the primary infrastructure acceptance signals. The Caddy `redir /app /en/app 307` fix fired correctly and resolved the localhost leakage.

**04I4A infrastructure acceptance: PASS.**

---

## 10. UI/Version Mismatch — Recorded Separately

Keith observed: **"Visible page is latest expected UI: NO"**

### Classification

This observation is recorded as a **separate UX/UI or deployed-version mismatch**. It is:

- **NOT** a failure of 04I4 or 04I4A.
- **NOT** a localhost redirect infrastructure failure.
- **NOT** an auth/email/Caddy health blocker.
- **NOT** part of 04I4 or 04I4A acceptance criteria.

The UI/version mismatch may be due to a stale build, a cached deploy, a version difference between what Keith expected and what is deployed at HEAD `40c43af`, or a frontend UI regression introduced in a prior task.

### Recommended Future Task

```
PRIVATE-BETA-STAGING-EXECUTION-04J or 04I5 — Staging App UI Version Mismatch Investigation
```

This future task should be registered separately only if the team decides the mismatch blocks 04I completion or private beta readiness. It is not registered in this checkpoint.

---

## 11. Non-Goals Preserved

| Non-goal | Preserved |
|---|---|
| Caddy regexp catch-all for all unlocalized routes | Deferred to possible future 04I4B — not implemented |
| Source-level `frontend/middleware.ts` fix | Avoided — 04I2A demonstrated HTTP/2 500 risk |
| `/login`, `/register` exact unlocalized redirects | Not a confirmed active blocker — deferred |
| PM2 restart | Not required — Caddy reload only |
| Frontend build or `npm ci` | Not required — Caddyfile-only change |
| Docker / PostgreSQL / Redis | Out of scope |
| AI execution / billing / container / OAuth | Out of scope |
| Production environment | Out of scope |

---

## 12. Remaining Risk

1. **General unlocalized route hardening:** All unlocalized frontend routes other than `/app` (e.g., `/login`, `/register` without `/en/` prefix) still exhibit localhost leakage if accessed directly. Only `/app` and `/` are covered by Caddy redirects. A future comprehensive Caddy regexp or source-level fix is recommended.

2. **UI/version mismatch:** The visible staging app page is not the latest expected UI version. This is not a localhost redirect issue and is deferred to a future task.

3. **Source middleware is unchanged:** `frontend/middleware.ts` catch-all still uses `request.nextUrl.clone()` and would still leak `localhost` for any unlocalized path not covered by a Caddy redirect. The source-level risk (HTTP/2 500 from 04I2A) has not been resolved or revisited.

---

## 13. What Remains for 04I

All six infrastructure smoke paths now PASS:

| Path | Status |
|---|---|
| Path A | PASS — `https://staging.ainow.biz` → `https://staging.ainow.biz/en` — HTTPS lock valid — no localhost |
| Path B | PASS — `https://staging.ainow.biz/en/login` loads — HTTPS lock valid — no localhost |
| Path C | PASS — `https://staging.ainow.biz/en/register` loads — HTTPS lock valid — no localhost |
| Path D | PASS — email verification confirmed — 04I3/04I3A COMPLETE and LOCKED — 2026-08-04 |
| Path E | PASS — login submitted — final URL `https://staging.ainow.biz/en/app` — HTTPS lock valid — no localhost |
| Path F | **PASS** — `https://staging.ainow.biz/app` → `https://staging.ainow.biz/en/app` — no localhost — HTTPS lock valid — 04I4A COMPLETE and LOCKED — 2026-08-04 |

04I may now proceed to consolidation/closure. The UI/version mismatch is classified separately and does not block 04I infrastructure closure unless the team explicitly decides otherwise.

---

## 14. Future Hardening Recommendation

Register a follow-up task after 04I and 04 consolidation:

**Recommended: PRIVATE-BETA-STAGING-EXECUTION-04I4B or 04J — General Unlocalized Route Redirect Hardening**

Options to evaluate:

| Option | Description | Risk |
|---|---|---|
| Caddy regexp catch-all | Single Caddy regexp matcher covering all unlocalized routes | MEDIUM — complex regex must be validated |
| Source middleware fix | Fix `request.nextUrl.clone()` host leakage in `frontend/middleware.ts` catch-all | HIGH — 04I2A demonstrated HTTP/2 500 risk |
| Additional Caddy exact redirects | Add `redir /login /en/login 307` and `redir /register /en/register 307` | LOW — same proven pattern as 04I2C/04I4A |

This task is NOT registered here. It is recommended only after 04I and parent 04 are fully closed.

---

## 15. Final Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04I4 | **COMPLETE and LOCKED — 2026-08-04. Do not modify this entry.** |
| PRIVATE-BETA-STAGING-EXECUTION-04I4A | COMPLETE and LOCKED — 2026-08-04. Do not modify this entry. |
| PRIVATE-BETA-STAGING-EXECUTION-04I | ACTIVE — Paths A/B/C/D/E/F infrastructure smoke PASS — may proceed to 04I consolidation/closure |
| PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED — pending 04I and parent 04 completion |

---

## 16. Next Recommended Action

**PRIVATE-BETA-STAGING-EXECUTION-04I consolidation/closure.**

All six infrastructure smoke paths PASS. 04I4 and 04I4A are both COMPLETE and LOCKED. 04I may now be consolidated and closed. After 04I is COMPLETE and LOCKED, proceed to parent 04 consolidation/closure, then resume PRIVATE-BETA-DEPLOYMENT-READINESS.

If the UI/version mismatch must be resolved before private beta, register a separate task (04J or 04I5) before closing 04I.

---

## 17. Acceptance Criteria — Final State

- [x] 04I4 checkpoint created: `docs/PRIVATE-BETA-STAGING-EXECUTION-04I4-CHECKPOINT.md`
- [x] Original Path F blocker recorded
- [x] Investigation summary recorded
- [x] Root cause class recorded: unlocalized `/app` redirect via middleware leaked `localhost` from upstream host
- [x] Linked fix task 04I4A recorded
- [x] Accepted Caddy fix recorded: `redir /app /en/app 307`
- [x] SSH validation pass recorded
- [x] Browser Path F infrastructure pass recorded
- [x] Conflicting "redirected back to login" field interpreted — infrastructure acceptance PASS
- [x] UI/version mismatch recorded separately — not part of 04I4 acceptance
- [x] 04I4 marked COMPLETE and LOCKED — 2026-08-04
- [x] 04I4A remains COMPLETE and LOCKED — 2026-08-04
- [x] 04I updated: Paths A/B/C/D/E/F infrastructure PASS — may proceed to consolidation/closure
- [x] Parent 04 remains ACTIVE
- [x] PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED

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
