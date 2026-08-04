# PRIVATE-BETA-STAGING-EXECUTION-04I — Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I
**Title:** Browser / User-Facing Smoke Baseline
**Status:** COMPLETE and LOCKED — 2026-08-04. Do not modify this entry.
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04
**Grandparent:** PRIVATE-BETA-STAGING-EXECUTION-04 (root)
**Checkpoint date:** 2026-08-04
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action by Cursor)

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Title | Browser / User-Facing Smoke Baseline |
| Status | **COMPLETE and LOCKED — 2026-08-04** |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Root | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Registered | 2026-08-03 |
| Completed | 2026-08-04 |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-BROWSER-USER-FACING-SMOKE-RUNBOOK.md` |
| Checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-CHECKPOINT.md` (this file) |

---

## 2. Purpose

04I was registered to perform a browser-level, user-facing smoke baseline of the staging environment after public routing, DNS, and TLS were confirmed working in 04H.

The purpose was to validate that real browser flows work end-to-end on `staging.ainow.biz`:
- Public routing: root, login, register
- Registration + email verification
- Authenticated login
- Post-login `/app` access

04I was not an infrastructure installation task. It was a validation task confirming that real user journeys work on the deployed staging environment.

---

## 3. Final Verdict

**ALL SIX INFRASTRUCTURE SMOKE PATHS PASS.**

| Path | Final Result |
|---|---|
| Path A — Root/public routing smoke | **PASS** |
| Path B — Login page smoke | **PASS** |
| Path C — Register page smoke | **PASS** |
| Path D — Registration/email verification smoke | **PASS** |
| Path E — Authenticated login smoke | **PASS** |
| Path F — Direct `/app` authenticated smoke | **PASS** |

04I is COMPLETE and LOCKED. The infrastructure-level staging browser smoke baseline is confirmed. A separate UI/version mismatch was observed and is recorded below as a non-blocking separate issue.

---

## 4. Path A Evidence — Root/Public Routing Smoke

**Result: PASS**

| Field | Value |
|---|---|
| URL tested | `https://staging.ainow.biz` |
| Expected behavior | Redirect to `/en` |
| Observed behavior | Redirected to `https://staging.ainow.biz/en` |
| No localhost in URL | YES |
| HTTPS lock valid | YES |
| Errors | NONE |

**Blocker encountered and resolved:** Path A originally failed because `https://staging.ainow.biz` issued a redirect with `Location: https://localhost:3002/en` due to Caddy not forwarding the `Host` header to Next.js. This was investigated in 04I1 and fixed by 04I2C (Caddy exact-root redirect `redir / /en 307`). Git/VPS state was reconciled via 04I2D and 04I2E before browser re-validation.

**Fix:** `redir / /en 307` added to Caddyfile by 04I2C.

---

## 5. Path B Evidence — Login Page Smoke

**Result: PASS**

| Field | Value |
|---|---|
| URL tested | `https://staging.ainow.biz/en/login` |
| Page loaded | YES |
| HTTPS lock valid | YES |
| No localhost in URL | YES |
| Errors | NONE |

---

## 6. Path C Evidence — Register Page Smoke

**Result: PASS**

| Field | Value |
|---|---|
| URL tested | `https://staging.ainow.biz/en/register` |
| Page loaded | YES |
| HTTPS lock valid | YES |
| No localhost in URL | YES |
| Errors | NONE |

---

## 7. Path D Evidence — Registration/Email Verification Smoke

**Result: PASS** (after 04I3A)

| Field | Value |
|---|---|
| Registration submitted | YES |
| Email verification flow | WORKS |
| Verification email delivery | CONFIRMED working |
| Browser verification flow | CONFIRMED working |
| Keith's report | "all works fine" |
| Errors | NONE |

**Blocker encountered and resolved:** Path D originally blocked because the staging API Gateway was configured with `EMAIL_PROVIDER=stub` in `/opt/aisandbox/.env`. `StubEmailProvider` is a guaranteed no-op — all outgoing emails are silently discarded. Registration returned HTTP 201 with the email-verification-required UI, but the verification email never arrived.

**Investigation:** 04I3 identified `EMAIL_PROVIDER=stub` as root cause via source analysis and safe runtime env grep.

**Fix:** 04I3A updated `/opt/aisandbox/.env` on VPS: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` set (masked), `AUTH_EMAIL_FROM` set (masked), `APP_BASE_URL=https://staging.ainow.biz`. API Gateway restarted with `pm2 restart aisandbox-api-gateway --update-env`.

**Runtime env validated (after fix):**
- `RUNTIME_EMAIL_PROVIDER=resend` ✅
- `RUNTIME_RESEND_API_KEY=SET_REDACTED` ✅
- `RUNTIME_AUTH_EMAIL_FROM=SET_REDACTED` ✅
- `RUNTIME_APP_BASE_URL=https://staging.ainow.biz` ✅

---

## 8. Path E Evidence — Authenticated Login Smoke

**Result: PASS**

| Field | Value |
|---|---|
| Login page loaded | YES |
| Login submitted | YES |
| Login success | YES |
| Redirected to authenticated area | YES |
| Final URL | `https://staging.ainow.biz/en/app` |
| HTTPS lock valid | YES |
| No localhost in URL | YES |
| Errors | NONE |

---

## 9. Path F Evidence — Direct `/app` Authenticated Smoke

**Result: PASS** (after 04I4A)

| Field | Value |
|---|---|
| URL tested | `https://staging.ainow.biz/app` |
| App page loaded | YES |
| Stayed authenticated | YES |
| Final URL | `https://staging.ainow.biz/en/app` |
| HTTPS lock valid | YES |
| No localhost in URL | YES |
| Errors | NONE |

**Blocker encountered and resolved:** Path F originally blocked because `https://staging.ainow.biz/app` redirected to `https://localhost:3002/en/app`. The same root cause class as Path A: Caddy's `reverse_proxy 127.0.0.1:3002` does not forward `Host: staging.ainow.biz` to Next.js. The Next.js middleware catch-all block fired on the unlocalized `/app` path, cloned the `request.nextUrl` (which reflects `localhost:3002`), and issued a `Location: https://localhost:3002/en/app` header. Browser followed this redirect to an unreachable localhost address.

**Investigation:** 04I4 identified root cause via source analysis of `frontend/middleware.ts` lines 38–42.

**Fix:** 04I4A added `redir /app /en/app 307` to Caddyfile, placed immediately after `redir / /en 307`.

**SSH validation after fix:**
- `APP_REDIRECT=307 Location:/en/app` — no localhost ✅
- `EN_LOGIN=200` ✅
- `EN_REGISTER=200` ✅
- `API_HEALTH=200` ✅
- `API_DB_HEALTH=200` ✅
- `API_READY=200` ✅

**Note on conflicting field:** Keith also reported "Redirected back to login: YES." This field was interpreted as a checkbox artifact or a momentary intermediate redirect observation, because the simultaneously-true evidence (final URL `https://staging.ainow.biz/en/app`, app page loaded: YES, stayed authenticated: YES, no localhost, no errors) is authoritative for infrastructure acceptance. Path F infrastructure acceptance: PASS.

---

## 10. Linked Recovery Tasks

### 04I2 / 04I2C / 04I2E — Root Redirect Recovery

| Task | Status | Purpose |
|---|---|---|
| 04I1 | COMPLETE and LOCKED — 2026-08-04 | Investigation — identified localhost Location header from Caddy/Next.js reverse-proxy |
| 04I2 | COMPLETE and LOCKED — 2026-08-04 | Bounded fix/recovery slice parent |
| 04I2A | FAILED — 2026-08-03 | Option B source fix — caused HTTP/2 500 at staging — rolled back |
| 04I2B | FAILED — 2026-08-03 | Option A Caddy forwarded header — Location still localhost — rolled back |
| 04I2C | COMPLETE and LOCKED — 2026-08-03 | Caddy `redir / /en 307` — proven fix — Path A PASS |
| 04I2D | COMPLETE and LOCKED — 2026-08-04 | Local source reconciliation — middleware.ts restored — TypeScript PASS |
| 04I2E | COMPLETE and LOCKED — 2026-08-04 | VPS git sync — `git reset --hard origin/main` — HEAD `40c43af` — Caddy redirect preserved |

### 04I3 / 04I3A — Email Delivery Recovery

| Task | Status | Purpose |
|---|---|---|
| 04I3 | COMPLETE and LOCKED — 2026-08-04 | Investigation — root cause `EMAIL_PROVIDER=stub` |
| 04I3A | COMPLETE and LOCKED — 2026-08-04 | Fix — Resend enabled on staging — `pm2 restart --update-env` |

### 04I4 / 04I4A — `/app` Redirect Recovery

| Task | Status | Purpose |
|---|---|---|
| 04I4 | COMPLETE and LOCKED — 2026-08-04 | Investigation — root cause localhost leakage in `/app` redirect |
| 04I4A | COMPLETE and LOCKED — 2026-08-04 | Fix — Caddy `redir /app /en/app 307` |

---

## 11. Accepted Runtime Changes

The following runtime changes were applied on VPS during 04I recovery tasks and remain active:

| Change | Applied by | Value |
|---|---|---|
| Caddy `redir / /en 307` | 04I2C | Exact-root Caddy redirect — prevents localhost from appearing in root redirect |
| Staging Resend email enabled | 04I3A | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `AUTH_EMAIL_FROM` + `APP_BASE_URL=https://staging.ainow.biz` — values not recorded |
| Caddy `redir /app /en/app 307` | 04I4A | Exact-path Caddy redirect — prevents localhost from appearing in `/app` redirect |

Active Caddyfile state:
```
redir / /en 307
redir /app /en/app 307
```

Caddyfile backups:
- `/etc/caddy/Caddyfile.backup-04I2C-20260803-215649` — before 04I2C
- `/etc/caddy/Caddyfile.backup-04I4A-20260804-160945` — before 04I4A

VPS git state: HEAD `40c43af` (origin/main) — Reconcile staging root redirect state — git status clean.

---

## 12. Secret-Safety Outcome

- No secret values were printed to terminal, pasted into ChatGPT, or recorded in any document at any point in 04I or its child tasks.
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM` were entered by Keith via masked interactive entry (`read -s`) on the VPS terminal.
- All validation outputs used `SET_REDACTED` format only.
- The only env values recorded in documentation are `EMAIL_PROVIDER=resend` and `APP_BASE_URL=https://staging.ainow.biz` — neither is a secret.
- An accidental shell syntax error during 04I3A did not expose any secret value; it produced only a bash error.
- No `.env*` files were opened or read by Cursor at any point.

**Secret-safety outcome: CLEAN.**

---

## 13. Browser Smoke Outcome

**All six infrastructure smoke paths PASS.**

| Path | Status | Key evidence |
|---|---|---|
| A | PASS | `https://staging.ainow.biz` → `https://staging.ainow.biz/en` — no localhost — HTTPS lock valid |
| B | PASS | `https://staging.ainow.biz/en/login` loads — HTTPS lock valid — no errors |
| C | PASS | `https://staging.ainow.biz/en/register` loads — HTTPS lock valid — no errors |
| D | PASS | Registration + email verification confirmed working — Keith: "all works fine" |
| E | PASS | Login success — final URL `https://staging.ainow.biz/en/app` — HTTPS lock valid — no localhost |
| F | PASS | `https://staging.ainow.biz/app` → final URL `https://staging.ainow.biz/en/app` — no localhost — HTTPS lock valid — app loaded — stayed authenticated |

---

## 14. Known Separate UI/Version Mismatch

During Path F browser validation, Keith observed:

> "Visible page is latest expected UI: NO"

### Classification

This is recorded as a **separate UX/UI or deployed-version mismatch**. It is:

- **NOT** a failure of 04I, 04I4, or 04I4A.
- **NOT** a localhost redirect infrastructure failure.
- **NOT** an auth/email/Caddy health blocker.
- **NOT** part of 04I infrastructure smoke acceptance criteria.
- **NOT** a reason to keep 04I open.

The UI/version mismatch may be due to:
- A stale frontend build at HEAD `40c43af`
- A cached deployment
- A version difference between Keith's expectation and what is deployed
- A frontend UI regression introduced in a prior task

### Recommended Future Task

```
PRIVATE-BETA-STAGING-EXECUTION-04J — Staging App UI Version Mismatch Investigation
```

This future task should investigate what UI version is deployed, what Keith expected, whether a new build or redeployment is required, and whether the mismatch blocks private beta readiness.

**This task is NOT registered in this checkpoint.** It should be registered separately after parent 04 consolidation/closure if the team decides the mismatch blocks private beta readiness, or deferred as a lower-priority follow-up.

---

## 15. Non-Goals Preserved

| Non-goal | Preserved |
|---|---|
| Caddy regexp catch-all for all unlocalized routes | Deferred |
| Source-level `frontend/middleware.ts` host-leak fix | Avoided — 04I2A demonstrated HTTP/2 500 risk at staging |
| `/login`, `/register` unlocalized Caddy redirects | Not a confirmed active 04I blocker — deferred |
| AI execution enablement | Kill switch remains active — unchanged |
| Billing / payment flows | Not enabled |
| Container execution | Not enabled |
| Google OAuth | Deferred — not enabled |
| Production environment | Not touched |
| Source code changes | None |
| Database migrations | None |
| Git commit or push | None |

---

## 16. Remaining Risk

1. **General unlocalized route hardening:** All unlocalized frontend routes other than `/` and `/app` (e.g., `/login`, `/register` without `/en/` prefix) still exhibit localhost leakage if accessed directly. Only `/` and `/app` are covered by Caddy redirects. A future comprehensive Caddy regexp or source-level fix is recommended.

2. **UI/version mismatch:** The visible staging app page is not the latest expected UI version. This is not a localhost redirect issue and is deferred to a future task.

3. **Source middleware unchanged:** `frontend/middleware.ts` catch-all still uses `request.nextUrl.clone()` and would still leak `localhost` for any unlocalized path not covered by a Caddy redirect. The source-level risk (HTTP/2 500 from 04I2A) has not been resolved or revisited.

4. **PM2 restart count:** After the `--update-env` correction during 04I3A, the API Gateway accumulated 197 restarts. This was a historical artifact of the correction attempt. After the corrected restart, the API Gateway stabilized and all health endpoints returned 200.

---

## 17. What Remains for Parent 04

Parent `PRIVATE-BETA-STAGING-EXECUTION-04` remains ACTIVE. 04I completion does not automatically close 04.

Remaining work for 04:
- 04 parent consolidation/closure checkpoint
- Full app deployment review (still not complete at the 04I level)
- Any registered follow-up tasks (e.g., UI/version mismatch investigation)

After 04 consolidation/closure, `PRIVATE-BETA-DEPLOYMENT-READINESS` may be re-evaluated.

---

## 18. Final Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04I | **COMPLETE and LOCKED — 2026-08-04. Do not modify this entry.** |
| PRIVATE-BETA-STAGING-EXECUTION-04I1 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I2 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I2A | FAILED — 2026-08-03 |
| PRIVATE-BETA-STAGING-EXECUTION-04I2B | FAILED — 2026-08-03 |
| PRIVATE-BETA-STAGING-EXECUTION-04I2C | COMPLETE and LOCKED — 2026-08-03 |
| PRIVATE-BETA-STAGING-EXECUTION-04I2D | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I2E | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I3 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I3A | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I4 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04I4A | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04 | **ACTIVE** |
| PRIVATE-BETA-DEPLOYMENT-READINESS | **BLOCKED / PAUSED** — pending 04 parent consolidation/closure |

---

## 19. Next Recommended Action

**PRIVATE-BETA-STAGING-EXECUTION-04 parent consolidation/closure.**

All six infrastructure smoke paths have passed. 04I is COMPLETE and LOCKED. The next step is to consolidate and close the parent task 04 (`Repo Clone + Private Env Preparation + App Deployment Baseline`), then resume `PRIVATE-BETA-DEPLOYMENT-READINESS`.

If the UI/version mismatch must be resolved before private beta, register `PRIVATE-BETA-STAGING-EXECUTION-04J` separately before or during the parent 04 consolidation.

---

## 20. Acceptance Criteria — Final State

- [x] 04I checkpoint created: `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-CHECKPOINT.md`
- [x] Path A PASS recorded
- [x] Path B PASS recorded
- [x] Path C PASS recorded
- [x] Path D PASS recorded
- [x] Path E PASS recorded
- [x] Path F PASS recorded
- [x] Linked recovery tasks recorded (04I1, 04I2/A/B/C/D/E, 04I3/3A, 04I4/4A)
- [x] Accepted runtime fixes recorded (Caddy root redirect, Resend email, Caddy `/app` redirect)
- [x] PM2 `--update-env` lesson recorded
- [x] Secret-safety outcome recorded: CLEAN
- [x] UI/version mismatch recorded separately — not part of 04I acceptance
- [x] 04I marked COMPLETE and LOCKED — 2026-08-04
- [x] Parent 04 remains ACTIVE
- [x] PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED
- [x] No source code changed
- [x] No `.env*` files opened or changed
- [x] No env values printed or recorded
- [x] No runtime/server action occurred
- [x] No Docker/PostgreSQL/Redis action occurred
- [x] No email/account/login action occurred
- [x] No git commit or push

---

## 21. PM2 Runtime-Env Lesson Learned

**Critical finding from 04I3A:**

`pm2 restart <app>` **without** `--update-env` does **NOT** reload environment variables from `.env` into the running process. The runtime process retains the env values captured at the time it was originally started.

During 04I3A, the first restart (`pm2 restart aisandbox-api-gateway`) left the runtime `EMAIL_PROVIDER` as `stub` even after the `.env` file had been updated to `resend`.

**Correct method for staging env updates requiring PM2 env propagation:**
1. Update `/opt/aisandbox/.env`.
2. Export the updated variables to the current shell session.
3. Run `pm2 restart <app> --update-env`.
4. Unset exported shell variables after restart.
5. Perform a safe runtime env check to confirm the new values are live.

This lesson applies to all future staging env updates that require PM2 process restart.

---

## 22. Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or changed by Cursor
- ✅ No env values read, printed, or recorded (other than non-secret values `EMAIL_PROVIDER=resend` and `APP_BASE_URL=https://staging.ainow.biz`)
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No email/account/login/AI/billing/container/OAuth action
- ✅ No git commit or push
- ✅ No subagents used
