# PRIVATE-BETA-STAGING-EXECUTION-04 — Parent Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04
**Title:** Repo Clone + Private Env Preparation + App Deployment Baseline
**Status:** COMPLETE and LOCKED — 2026-08-04. Do not modify this entry.
**Parent:** (root execution family — no parent)
**Checkpoint date:** 2026-08-04
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action by Cursor)

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Title | Repo Clone + Private Env Preparation + App Deployment Baseline |
| Status | **COMPLETE and LOCKED — 2026-08-04** |
| Parent | (root staging execution family) |
| Predecessor | PRIVATE-BETA-STAGING-EXECUTION-03 — COMPLETE and LOCKED — 2026-07-24 |
| Registered | 2026-07-25 |
| Completed | 2026-08-04 |
| Checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04-CHECKPOINT.md` (this file) |
| Child checkpoints | 04A–04I each have individual checkpoint documents |

---

## 2. Parent Task Purpose

PRIVATE-BETA-STAGING-EXECUTION-04 was the execution task responsible for taking the staging server (provisioned by 01/02/03) from a bare runtime baseline to a fully deployed, DNS/TLS-live, user-accessible application on `staging.ainow.biz`.

This encompassed:
- Repository cloning to `/opt/aisandbox`
- Private environment file creation (`/opt/aisandbox/.env`)
- Dependency installation and build
- Database migration baseline
- PM2 service start and health-only smoke
- PM2 persistence and boot persistence
- Public routing / DNS / TLS configuration (Caddy)
- Browser / user-facing smoke baseline (all user-facing paths)

The task was deliberately split into bounded child slices (04A through 04I) to maintain control, reversibility, and audit traceability at each step.

---

## 3. Final Verdict

**PRIVATE-BETA-STAGING-EXECUTION-04: COMPLETE and LOCKED — 2026-08-04.**

All nine child slices (04A through 04I) are COMPLETE and LOCKED. All six browser infrastructure smoke paths (A/B/C/D/E/F) passed. The staging environment at `staging.ainow.biz` is deployed, DNS/TLS-live, and user-accessible. Email verification is working. Authenticated login and post-login app access are confirmed.

---

## 4. Completed Child Task Summary — 04A through 04H

| Child | Title | Status | Completed |
|---|---|---|---|
| 04A | Redis Gate + Repo Clone Baseline | COMPLETE and LOCKED | 2026-07-25 |
| 04B | Private Env Preparation | COMPLETE and LOCKED | 2026-07-26 |
| 04B-GOOGLE-OAUTH-DECISION | Staging Google OAuth Requirement Decision | COMPLETE and LOCKED | 2026-07-26 |
| 04C | Dependency Install + Build | COMPLETE and LOCKED | 2026-07-26 |
| 04C-PACKAGE-MANAGER-DECISION | Package Manager / Lockfile Decision | COMPLETE and LOCKED | 2026-07-26 |
| 04C-PACKAGE-MANAGER-POLICY | Package Manager Policy Registration + Decision | COMPLETE and LOCKED | 2026-07-27 |
| 04C-NPM-LOCKFILE-TRACKING | Track/Refresh Root package-lock.json | COMPLETE | 2026-07-26 |
| 04D | PM2 Service Start + Health-Only Smoke | COMPLETE and LOCKED | 2026-07-27 |
| 04D1 | API Gateway SQLite Runtime Path Fix | COMPLETE and LOCKED | 2026-07-27 |
| 04D2 | StartupGuard Private-Beta Stub Provider Policy | COMPLETE and LOCKED | 2026-07-27 |
| 04D3 | StartupGuard Required Schema / Migration Boundary Decision | COMPLETE and LOCKED | 2026-07-27 |
| 04E | Staging Database Migration Baseline | COMPLETE and LOCKED | 2026-07-27 |
| 04F | PM2 Persistence / Boot Persistence | COMPLETE and LOCKED | 2026-07-29 |
| 04F1 | PM2 Startup Systemd Protocol Blocker Fix | COMPLETE and LOCKED | 2026-07-29 |
| 04G | Reboot Persistence Validation | COMPLETE and LOCKED | 2026-07-29 |
| 04H | Public Routing / DNS / TLS Baseline | COMPLETE and LOCKED | 2026-08-03 |

### Key outcomes from 04A–04H

- Repo cloned to `/opt/aisandbox` — owner `ubuntu:ubuntu` — branch `main`
- `/opt/aisandbox/.env` created privately — `chmod 600` — 47 required non-Google keys — Google OAuth deferred (Outcome B)
- Package manager: `npm` — `npm ci` PASS — all four builds PASS
- Staging DB migration baseline complete — 26 tables — `migrations count 25`
- PM2 all four services online — `restarts 0` — `API_HEALTH/API_DB_HEALTH/API_READY/CONTAINER_HEALTH=200`
- PM2 persistence: `pm2-ubuntu` enabled and active — systemd `Result=success` — reboot-proven (04G)
- Public routing: `staging.ainow.biz` → `18.136.141.186` — Caddy configured, enabled, active, valid — public HTTPS health-only smoke PASS

---

## 5. 04I Browser Smoke Summary

**Task:** PRIVATE-BETA-STAGING-EXECUTION-04I — Browser / User-Facing Smoke Baseline
**Status:** COMPLETE and LOCKED — 2026-08-04
**Checkpoint:** `docs/PRIVATE-BETA-STAGING-EXECUTION-04I-CHECKPOINT.md`

| Path | Description | Result |
|---|---|---|
| A | `https://staging.ainow.biz` → redirect to `/en` | **PASS** |
| B | `https://staging.ainow.biz/en/login` loads | **PASS** |
| C | `https://staging.ainow.biz/en/register` loads | **PASS** |
| D | Registration + email verification working end-to-end | **PASS** |
| E | Authenticated login — final URL `https://staging.ainow.biz/en/app` | **PASS** |
| F | `https://staging.ainow.biz/app` → final URL `https://staging.ainow.biz/en/app` | **PASS** |

All six infrastructure smoke paths PASS. Keith reported no errors, HTTPS lock valid on all paths, no localhost in any URL.

---

## 6. 04I Recovery Task Summary

Three blocker chains arose during 04I and were resolved through bounded recovery tasks:

### Root Redirect (Path A) — 04I1 / 04I2 / 04I2C / 04I2D / 04I2E

| Task | Status | Outcome |
|---|---|---|
| 04I1 | COMPLETE and LOCKED — 2026-08-04 | Investigation: root redirect issued `Location: https://localhost:3002/en` due to Caddy/Next.js reverse-proxy mismatch |
| 04I2 | COMPLETE and LOCKED — 2026-08-04 | Bounded fix/recovery slice parent |
| 04I2A | **FAILED** — 2026-08-03 | Option B source fix (`frontend/middleware.ts`) — caused HTTP/2 500 at staging — rolled back |
| 04I2B | **FAILED** — 2026-08-03 | Option A Caddy forwarded header fix — Location still `https://localhost:3002/en` — rolled back |
| 04I2C | COMPLETE and LOCKED — 2026-08-03 | Caddy exact-root redirect `redir / /en 307` — Path A PASS |
| 04I2D | COMPLETE and LOCKED — 2026-08-04 | Local source reconciliation — `frontend/middleware.ts` restored to `request.nextUrl.clone()` pattern — TypeScript PASS |
| 04I2E | COMPLETE and LOCKED — 2026-08-04 | VPS git sync — `git reset --hard origin/main` — HEAD `40c43af` — Caddy redirect preserved |

### Email Delivery (Path D) — 04I3 / 04I3A

| Task | Status | Outcome |
|---|---|---|
| 04I3 | COMPLETE and LOCKED — 2026-08-04 | Investigation: `EMAIL_PROVIDER=stub` in `.env` — `StubEmailProvider` discards all emails |
| 04I3A | COMPLETE and LOCKED — 2026-08-04 | Fix: `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `AUTH_EMAIL_FROM` + `APP_BASE_URL=https://staging.ainow.biz` set via masked entry — `pm2 restart --update-env` |

### `/app` Redirect (Path F) — 04I4 / 04I4A

| Task | Status | Outcome |
|---|---|---|
| 04I4 | COMPLETE and LOCKED — 2026-08-04 | Investigation: `/app` redirect issued `Location: https://localhost:3002/en/app` — same Caddy/Next.js class as Path A |
| 04I4A | COMPLETE and LOCKED — 2026-08-04 | Fix: Caddy `redir /app /en/app 307` — Path F PASS |

---

## 7. Accepted Runtime Changes

The following runtime changes were applied on VPS during 04I and remain permanently active:

| Change | Applied by | Effect |
|---|---|---|
| `redir / /en 307` in Caddyfile | 04I2C | Prevents localhost from appearing in root redirect |
| `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `AUTH_EMAIL_FROM` + `APP_BASE_URL=https://staging.ainow.biz` | 04I3A | Enables staging Resend email verification |
| `redir /app /en/app 307` in Caddyfile | 04I4A | Prevents localhost from appearing in `/app` redirect |

Active Caddyfile state:
```
redir / /en 307
redir /app /en/app 307
```

Caddyfile backups on VPS:
- `/etc/caddy/Caddyfile.backup-04I2C-20260803-215649` — before `redir / /en 307`
- `/etc/caddy/Caddyfile.backup-04I4A-20260804-160945` — before `redir /app /en/app 307`

VPS git HEAD: `40c43af` (origin/main — Reconcile staging root redirect state) — git status clean.

---

## 8. Secret-Safety Outcome

**CLEAN.** No secrets were exposed or recorded at any point during 04 or any of its child tasks.

- `RESEND_API_KEY` and `AUTH_EMAIL_FROM` were entered by Keith via masked interactive entry (`read -s`) on the VPS terminal.
- All runtime validation outputs used `SET_REDACTED` format only.
- The only env values recorded in documentation are non-secret: `EMAIL_PROVIDER=resend`, `APP_BASE_URL=https://staging.ainow.biz`.
- No `.env*` files were opened or read by Cursor at any point across all child tasks.
- DB and Redis passwords were set privately by Keith and never disclosed.
- Google OAuth was deferred (Outcome B) — no OAuth credentials created or used.

---

## 9. Routing Lessons

### Caddy Exact-Path Redirects Are the Safe Staging Approach

The `frontend/middleware.ts` catch-all uses `request.nextUrl.clone()` which resolves `localhost:3002` (Next.js internal bind address) rather than the public `staging.ainow.biz` hostname. This causes any unlocalized path to issue a `Location: https://localhost:3002/...` header when Next.js is behind a reverse proxy without `X-Forwarded-*` header propagation.

**Proven fix:** Caddy exact-path redirects placed before the `reverse_proxy` fallback intercept the unlocalized path and issue a correct relative redirect without involving Next.js middleware.

### 04I2A Source Fix Demonstrated HTTP/2 500 Risk

Attempting to fix the root redirect at source level (`frontend/middleware.ts` changed to relative `Location: /en`) caused an HTTP/2 500 error at staging runtime — even though local TypeScript passed cleanly. The source-level path was not pursued further. The Caddy exact-redirect pattern remains the accepted safe approach.

### Known Unresolved: General Unlocalized Route Hardening

Only `/` and `/app` are covered by Caddy exact-path redirects. Other unlocalized paths (e.g., `/login`, `/register`) still exhibit localhost leakage if accessed directly. A future comprehensive Caddy regexp or source-level fix is recommended but was not part of 04 scope.

---

## 10. Email-Delivery Lesson

**Root cause of email non-delivery:** `/opt/aisandbox/.env` was configured with `EMAIL_PROVIDER=stub` — the `StubEmailProvider` is a guaranteed no-op that silently discards all outgoing emails. This was the correct safe default for early staging bring-up but was not changed before Path D browser smoke.

**Resolution:** 04I3A updated `.env` to `EMAIL_PROVIDER=resend` and set the required Resend API keys privately.

---

## 11. PM2 Runtime-Env Lesson

**Critical finding from 04I3A:**

`pm2 restart <app>` **without** `--update-env` does **NOT** reload environment variables from `.env` into the running process. The runtime process retains the env values captured at original start time.

During 04I3A, the first restart (`pm2 restart aisandbox-api-gateway`) left the runtime `EMAIL_PROVIDER` as `stub` even after `.env` had been updated to `resend`.

**Correct method for staging env updates:**
1. Update `/opt/aisandbox/.env`.
2. Export the updated variables to the current shell session.
3. Run `pm2 restart <app> --update-env`.
4. Unset exported shell variables after restart.
5. Perform a safe runtime env check to confirm the new values are live.

This lesson applies to all future staging env updates that require PM2 env propagation.

---

## 12. Known Separate UI/Version Mismatch

During Path F browser validation, Keith observed:

> "Visible page is latest expected UI: NO"

### Classification

This is recorded as a **separate UX/UI or deployed-version mismatch**. It is:

- **NOT** a failure of 04I, 04I4A, or any infrastructure acceptance path.
- **NOT** a localhost redirect infrastructure failure.
- **NOT** an auth/email/Caddy health blocker.
- **NOT** part of parent 04 acceptance criteria.
- **NOT** a reason to keep parent 04 open.

The mismatch may be due to a stale frontend build at HEAD `40c43af`, a cached deployment, a version difference between Keith's expectation and what is deployed, or a frontend UI regression introduced in a prior task.

### Recommended Future Task

```
PRIVATE-BETA-STAGING-EXECUTION-04J — Staging App UI Version Mismatch Investigation
```

This future task should investigate what UI version is deployed, what Keith expected, whether a new build or redeployment is required, and whether the mismatch blocks private beta readiness.

**This task is NOT registered in this checkpoint.** It should be registered separately if the team decides the mismatch blocks private beta readiness, or deferred as a lower-priority follow-up after PRIVATE-BETA-DEPLOYMENT-READINESS resumes.

---

## 13. Non-Goals Preserved Throughout 04

| Non-goal | Preserved |
|---|---|
| Google OAuth enablement | Deferred — not enabled |
| AI execution enablement | Kill switch remains active — unchanged |
| Billing / payment flows | Not enabled |
| Container execution | Not enabled |
| Caddy regexp catch-all for all unlocalized routes | Deferred |
| Source-level `frontend/middleware.ts` host-leak fix | Avoided — 04I2A demonstrated HTTP/2 500 risk |
| Production environment | Not touched |
| Any runtime action by Cursor | None |
| Secrets opened/read by Cursor | None |
| Git commit or push by Cursor | None |

---

## 14. Remaining Risks

1. **General unlocalized route hardening:** Only `/` and `/app` have Caddy exact-path redirects. Other unlocalized paths still exhibit localhost leakage.

2. **UI/version mismatch:** The visible staging app page is not the latest expected UI version. Separate investigation required (04J).

3. **Source middleware unchanged:** `frontend/middleware.ts` catch-all still uses `request.nextUrl.clone()` and would leak `localhost` for any unlocalized path not covered by a Caddy redirect.

4. **Redis version deviation:** Redis 8.8.0 was installed vs. target 7.x. Compatibility guardrail was recorded in 04A (Outcome A — LIKELY COMPATIBLE). No runtime incompatibility was observed. This remains a recorded deviation.

5. **PM2 restart count artifact:** After the `--update-env` correction during 04I3A, the API Gateway accumulated 197 historical restarts before stabilization. Not a current risk, but recorded.

---

## 15. Final Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04 | **COMPLETE and LOCKED — 2026-08-04. Do not modify this entry.** |
| PRIVATE-BETA-STAGING-EXECUTION-04A | COMPLETE and LOCKED — 2026-07-25 |
| PRIVATE-BETA-STAGING-EXECUTION-04B | COMPLETE and LOCKED — 2026-07-26 |
| PRIVATE-BETA-STAGING-EXECUTION-04C | COMPLETE and LOCKED — 2026-07-26 |
| PRIVATE-BETA-STAGING-EXECUTION-04D | COMPLETE and LOCKED — 2026-07-27 |
| PRIVATE-BETA-STAGING-EXECUTION-04D1 | COMPLETE and LOCKED — 2026-07-27 |
| PRIVATE-BETA-STAGING-EXECUTION-04D2 | COMPLETE and LOCKED — 2026-07-27 |
| PRIVATE-BETA-STAGING-EXECUTION-04D3 | COMPLETE and LOCKED — 2026-07-27 |
| PRIVATE-BETA-STAGING-EXECUTION-04E | COMPLETE and LOCKED — 2026-07-27 |
| PRIVATE-BETA-STAGING-EXECUTION-04F | COMPLETE and LOCKED — 2026-07-29 |
| PRIVATE-BETA-STAGING-EXECUTION-04F1 | COMPLETE and LOCKED — 2026-07-29 |
| PRIVATE-BETA-STAGING-EXECUTION-04G | COMPLETE and LOCKED — 2026-07-29 |
| PRIVATE-BETA-STAGING-EXECUTION-04H | COMPLETE and LOCKED — 2026-08-03 |
| PRIVATE-BETA-STAGING-EXECUTION-04I | COMPLETE and LOCKED — 2026-08-04 |
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
| PRIVATE-BETA-DEPLOYMENT-READINESS | **No longer blocked by 04 — resumes next** |

---

## 16. Next Recommended Action

**Resume PRIVATE-BETA-DEPLOYMENT-READINESS.**

Parent 04 is COMPLETE and LOCKED. All six browser infrastructure smoke paths passed. The staging environment is live and accessible. PRIVATE-BETA-DEPLOYMENT-READINESS is no longer blocked by parent 04.

Optional follow-up before or during deployment readiness:
- Register `PRIVATE-BETA-STAGING-EXECUTION-04J — Staging App UI Version Mismatch Investigation` if the team decides the visible UI/version mismatch must be resolved before private beta invites.

If the team decides the UI/version mismatch is a lower-priority cosmetic issue, it can be deferred and `PRIVATE-BETA-DEPLOYMENT-READINESS` can resume immediately.

---

## 17. Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or changed by Cursor
- ✅ No env values read, printed, or recorded (other than non-secret: `EMAIL_PROVIDER=resend`, `APP_BASE_URL=https://staging.ainow.biz`)
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No email/account/login/AI/billing/container/OAuth action
- ✅ No git commit or push
- ✅ No subagents used
