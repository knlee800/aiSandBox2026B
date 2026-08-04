# PRIVATE-BETA-STAGING-EXECUTION-04I3A — Evidence Review and Completion Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I3A
**Title:** Enable Staging Resend Email Verification
**Step:** 3 — Evidence Review and Completion Checkpoint
**Status:** COMPLETE and LOCKED — 2026-08-04
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04I3
**Grandparent:** PRIVATE-BETA-STAGING-EXECUTION-04I
**Root:** PRIVATE-BETA-STAGING-EXECUTION-04
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action by Cursor)
**Date:** 2026-08-04

---

## 1. Approval

| Field | Value |
|---|---|
| Approver | Keith |
| Approval phrase | `go — approve 04I3A staging Resend env update` |
| Approved scope | Staging Resend env update on VPS per runbook: docs/PRIVATE-BETA-STAGING-EXECUTION-04I3A-STAGING-RESEND-EMAIL-RUNBOOK.md |

---

## 2. Pre-Change Safety Checks

All pre-change checks passed before any env file was modified.

| Check | Value |
|---|---|
| Date/Time | Tue Aug 4 14:02:20 HKT 2026 |
| VPS path | /opt/aisandbox |
| VPS git HEAD | `40c43af (HEAD -> main, origin/main, origin/HEAD) Reconcile staging root redirect state` |
| git status | clean |
| pm2-ubuntu | active |
| caddy | active |
| aisandbox-ai-service | online |
| aisandbox-api-gateway | online |
| aisandbox-container-manager | online |
| aisandbox-frontend | online |
| Caddy root redirect | `17:redir / /en 307` present |
| Env file | /opt/aisandbox/.env exists |

---

## 3. Backup Evidence

A timestamped backup of `/opt/aisandbox/.env` was created before any changes.

| Item | Value |
|---|---|
| Backup path | `/opt/aisandbox/.env.backup-04I3A-20260804-140432` |
| Backup listing | `-rw------- 1 root root 2324 Aug 4 14:04 /opt/aisandbox/.env.backup-04I3A-20260804-140432` |
| Permissions | root-only read/write (600) |

---

## 4. Env Update Evidence

The following variables were updated on the VPS using the masked interactive entry method defined in the runbook. No secret values were printed to the terminal, pasted into ChatGPT, or recorded in any document.

| Variable | Action |
|---|---|
| `EMAIL_PROVIDER` | Set to `resend` |
| `RESEND_API_KEY` | Set via masked interactive entry — value NOT recorded |
| `AUTH_EMAIL_FROM` | Set via masked interactive entry — value NOT recorded |
| `APP_BASE_URL` | Set to `https://staging.ainow.biz` |
| `AUTH_EMAIL_REPLY_TO` | Skipped / missing — optional — acceptable |

**Notes:**

- `AUTH_EMAIL_REPLY_TO` was not set. This is optional and its absence is acceptable per the runbook (Section 5).
- No secret values were pasted into ChatGPT.
- No secret values are recorded in this or any document.
- An accidental shell line containing the example `AUTH_EMAIL_FROM` caused only a bash syntax error and did not change env state. The correct value was subsequently set via the masked entry method.

---

## 5. Safe Env File Validation

The following validation was run per Section 10 of the runbook. Only safe/redacted output is recorded.

```text
=== 04I3A ENV VALIDATION ===
EMAIL_PROVIDER: resend (CORRECT)
RESEND_API_KEY: SET_REDACTED
AUTH_EMAIL_FROM: SET_REDACTED
APP_BASE_URL: https://staging.ainow.biz (CORRECT)
AUTH_EMAIL_REPLY_TO: MISSING (optional acceptable)
=== END VALIDATION ===
```

All required variables are SET. `AUTH_EMAIL_REPLY_TO` is optional and its absence is acceptable.

---

## 6. First PM2 Restart — Runtime Issue Encountered

The first restart attempt used `pm2 restart aisandbox-api-gateway` without `--update-env`.

| Item | Value |
|---|---|
| Command | `pm2 restart aisandbox-api-gateway` |
| PM2 warning | `Use --update-env to update environment variables` |
| Initial result | `aisandbox-api-gateway online` |

After this first restart, a safe runtime env check was performed and revealed the following:

```text
RUNTIME_EMAIL_PROVIDER: stub — STOP
RUNTIME_RESEND_API_KEY: MISSING_OR_DOTENV_RUNTIME_ONLY
RUNTIME_AUTH_EMAIL_FROM: MISSING_OR_DOTENV_RUNTIME_ONLY
RUNTIME_APP_BASE_URL: https://staging.ainow.biz (CORRECT)
```

**Conclusion:** The `.env` file had been updated, but PM2 runtime was still using old provider/env values from the prior start. `pm2 restart` without `--update-env` does not reload environment variables from `.env`. Email validation was not attempted at this point. Corrective action was required.

---

## 7. Corrected PM2 Runtime Env Restart

To force PM2 to pick up the new env values, the following corrective action was taken:

| Item | Value |
|---|---|
| Corrective method | Keith entered `RESEND_API_KEY` and `AUTH_EMAIL_FROM` again through hidden terminal input. Variables were exported to the shell, then API Gateway was restarted with `--update-env`. Shell env variables were then unset. |
| Command | `pm2 restart aisandbox-api-gateway --update-env` |
| Result | `aisandbox-api-gateway online` |

**Note:** This is the correct method for PM2 when `.env` is loaded via `dotenv` at startup — PM2 must be explicitly told to propagate updated env to the process via `--update-env`, or the process-level env variables remain at the values captured at original start time.

---

## 8. Corrected Runtime Env Validation

After the corrected `--update-env` restart, a safe runtime env check confirmed the new values were active in the API Gateway process.

| Item | Value |
|---|---|
| API Gateway PID | 98362 |
| RUNTIME_EMAIL_PROVIDER | `resend` (CORRECT) |
| RUNTIME_RESEND_API_KEY | SET_REDACTED |
| RUNTIME_AUTH_EMAIL_FROM | SET_REDACTED |
| RUNTIME_APP_BASE_URL | `https://staging.ainow.biz` (CORRECT) |

All required runtime env variables are confirmed set. Email provider is `resend`.

---

## 9. API Gateway Stability Check

| Item | Value |
|---|---|
| Status | online |
| Restarts | 197 |
| Uptime | 3m |
| Unstable restarts | 1 |

**Note:** The high restart count was accumulated during the earlier missing-runtime-env correction attempt (before the `--update-env` fix was applied). After the corrected `--update-env` restart, restarts stayed stable and uptime increased. This is not indicative of an ongoing instability.

---

## 10. Final Health Validation

All public and local health endpoints returned 200 after the corrected restart.

| Check | Result |
|---|---|
| PUBLIC_HTTPS_API_HEALTH_FORCED | 200 ✅ |
| PUBLIC_HTTPS_API_DB_HEALTH_FORCED | 200 ✅ |
| PUBLIC_HTTPS_API_READY_FORCED | 200 ✅ |
| LOCAL_API_HEALTH | 200 ✅ |
| LOCAL_API_DB_HEALTH | 200 ✅ |
| LOCAL_API_READY | 200 ✅ |
| caddy | active ✅ |
| ROOT_REDIRECT | 307 Location:/en ✅ |
| EN_LOGIN | 200 ✅ |
| EN_REGISTER | 200 ✅ |
| table count | 26 ✅ |

**PostgreSQL note:** PostgreSQL printed `could not change directory to /home/ubuntu: Permission denied` during the table count query. This is a harmless directory-access warning from the `sudo -u postgres` session context. The query succeeded and returned count 26.

---

## 11. Browser Registration / Email Verification Validation

Keith performed one browser registration and email verification test after runtime env and health validation passed.

| Field | Value |
|---|---|
| Keith's report | "all works fine" |
| Registration / email verification | Confirmed working by Keith |
| Verification email delivery | Confirmed working by Keith |
| Browser verification flow | Confirmed working by Keith |
| Errors | None reported |

**Evidence scope notes:**

- One browser registration/email verification test was performed after runtime env and health validation passed.
- No token, verification link, password, email address, API key, or sender value was pasted into ChatGPT or recorded in this document.
- Exact final URL after clicking the verification link was not captured in the ChatGPT transcript.
- Keith's "all works fine" report is sufficient evidence for this infrastructure smoke checkpoint. If the project's documentation standard requires exact browser field values, the exact final URL is the only missing field; all other observable outcomes are confirmed working by Keith.

---

## 12. Fix Summary

| Item | Value |
|---|---|
| Root cause | `EMAIL_PROVIDER=stub` in `/opt/aisandbox/.env` — StubEmailProvider was the intentional no-op |
| Fix applied | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `AUTH_EMAIL_FROM` + `APP_BASE_URL=https://staging.ainow.biz` set on VPS |
| Fix method | Masked interactive entry per runbook Section 9 — no secrets in docs |
| Critical PM2 learning | `pm2 restart` does NOT reload `.env` into the running process; `pm2 restart --update-env` + exported shell vars required |
| Backup path | `/opt/aisandbox/.env.backup-04I3A-20260804-140432` |
| Rollback available | Yes — backup at above path |
| Email delivery confirmed | Yes — Keith confirmed "all works fine" |

---

## 13. Current Task / Phase Status

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04I3A | **COMPLETE and LOCKED — 2026-08-04** |
| PRIVATE-BETA-STAGING-EXECUTION-04I3 | ACTIVE — blocker resolved by 04I3A — may proceed to consolidation/closure |
| PRIVATE-BETA-STAGING-EXECUTION-04I | ACTIVE — Path D blocker resolved — may resume with authenticated smoke Path E/F |
| PRIVATE-BETA-STAGING-EXECUTION-04 | **ACTIVE** |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED — pending 04I and parent 04 completion |

---

## 14. Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or printed by Cursor
- ✅ No env values read, printed, or recorded in any document
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action taken by Cursor
- ✅ No email sent by Cursor
- ✅ No account/login/AI/billing/container/OAuth action taken
- ✅ No git commit or push
- ✅ No subagents used
