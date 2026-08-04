# PRIVATE-BETA-STAGING-EXECUTION-04I3 — Runtime Email Diagnosis Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I3  
**Title:** Email Verification Delivery Blocker  
**Step:** 3 — Approval-Gated Runtime Email Diagnosis Evidence Review  
**Status:** STEP 3 COMPLETE — Root cause confirmed  
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04I  
**Date:** 2026-08-04  
**Venue:** AWS Lightsail browser SSH  
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action by Cursor)

---

## 1. Approval

| Field | Value |
|---|---|
| Approver | Keith |
| Approval statement | go — approve 04I3 runtime email diagnosis |
| Approved action | Safe read-only runtime diagnosis: env file existence + EMAIL_PROVIDER value only |

---

## 2. Execution Context

| Field | Value |
|---|---|
| Venue | AWS Lightsail browser SSH |
| VPS path | /opt/aisandbox |
| Date/Time | Tue Aug 4 13:33:04 HKT 2026 |

---

## 3. Safe State at Time of Diagnosis

### Git State

| Item | Value |
|---|---|
| VPS git HEAD | `40c43af Reconcile staging root redirect state` |
| git status | clean |

### Service State

| Service | Status |
|---|---|
| pm2-ubuntu | active |
| caddy | active |

### PM2 App State

| App | Status |
|---|---|
| aisandbox-ai-service | online |
| aisandbox-api-gateway | online |
| aisandbox-container-manager | online |
| aisandbox-frontend | online |

---

## 4. Runtime Evidence Recorded

### Env File Existence

| File | Status |
|---|---|
| `/opt/aisandbox/.env` | EXISTS |
| `/opt/aisandbox/services/api-gateway/.env` | MISSING |
| `/opt/aisandbox/services/api-gateway/.env.production` | MISSING |

### EMAIL_PROVIDER Safe Check Result

| File | EMAIL_PROVIDER Value |
|---|---|
| `/opt/aisandbox/.env` | `stub` |
| `/opt/aisandbox/services/api-gateway/.env` | MISSING (file not present) |
| `/opt/aisandbox/services/api-gateway/.env.production` | MISSING (file not present) |

**Note:** Only the `EMAIL_PROVIDER` key and its value (`stub`) were observed. No other secret values were printed. No other env variables were read or logged.

---

## 5. Root Cause Confirmed

| Question | Answer |
|---|---|
| What is the email provider in staging? | `stub` (via `EMAIL_PROVIDER=stub` in `/opt/aisandbox/.env`) |
| Which class handles email? | `StubEmailProvider` — intentional no-op |
| Does stub send email? | No — `sendEmail()` is a guaranteed no-op; returns `void` immediately |
| Did registration succeed? | Yes — `POST /api/auth/register` returned 2xx (Path D browser smoke) |
| Was a verification token created? | Yes — token IS generated and stored in DB before `sendVerificationEmail()` |
| Was email sent? | No — stub silently discards all outgoing email |
| Is there a startup validation failure? | No — email config is not validated at startup; system starts normally |
| Does the user see an error? | No — registration returns 200 with success message; email never arrives |

**Root cause:** `EMAIL_PROVIDER=stub` in `/opt/aisandbox/.env`. `StubEmailProvider` is the intentional no-op mode designed for local/test environments. Staging was never configured to send real email via Resend. All verification emails have been silently discarded.

---

## 6. Candidate Assessment (Post-Diagnosis)

| Candidate | Confidence | Assessment |
|---|---|---|
| Candidate 1 — `EMAIL_PROVIDER=stub` | **CONFIRMED** | `EMAIL_PROVIDER=stub` confirmed in `/opt/aisandbox/.env`. This is the definitive root cause. |
| Candidate 2 — `APP_BASE_URL` misconfigured | Ruled out as primary cause | `EMAIL_PROVIDER=stub` means email never reaches send path. `APP_BASE_URL` correctness is secondary and will be verified when `EMAIL_PROVIDER=resend` is configured in 04I3A. |
| Candidate 3 — Resend delivery failure | Ruled out | Email was never sent via Resend; stub intercepted at provider level. |
| Candidate 4 — Missing `RESEND_API_KEY`/`AUTH_EMAIL_FROM` | Ruled out | If `EMAIL_PROVIDER=resend` and keys were missing, API Gateway would fail to start entirely — it has not. |

---

## 7. Fix Required

The fix is defined in **PRIVATE-BETA-STAGING-EXECUTION-04I3A — Enable Staging Resend Email Verification** (registered 2026-08-04).

Required changes on VPS (approval-gated, 04I3A scope):

| Variable | Required Change |
|---|---|
| `EMAIL_PROVIDER` | Change from `stub` to `resend` |
| `RESEND_API_KEY` | Set to valid Resend API key (never printed/logged) |
| `AUTH_EMAIL_FROM` | Set to verified Resend sender address/domain |
| `AUTH_EMAIL_REPLY_TO` | Optional — set if needed |
| `APP_BASE_URL` | Verify set to `https://staging.ainow.biz` |

All values must be set using masked/set-only commands. No values may be printed to terminal or logs.

---

## 8. No Further Log/DB Diagnosis Needed

Given the root cause confirmation (EMAIL_PROVIDER=stub), the following diagnosis items from the investigation report are no longer required at this stage:

| Item | Status |
|---|---|
| PM2 logs — email startup provider | Not needed — root cause confirmed by env check |
| PM2 logs — registration event | Not needed |
| DB verification token row check | Not needed — token storage was confirmed by source analysis |
| Resend dashboard check | Not needed — email was never sent to Resend |

---

## 9. What Stays Blocked

| Blocked Work | Reason |
|---|---|
| Path D completion (registration → verification → login → /app) | Requires verified email delivery — blocked until 04I3A fix confirmed |
| 04I3 COMPLETE and LOCKED | Blocked by 04I3A — fix not yet applied |
| 04I COMPLETE and LOCKED | Blocked by 04I3 |
| PRIVATE-BETA-DEPLOYMENT-READINESS COMPLETE | Blocked by 04I |

---

## 10. Summary

| Field | Value |
|---|---|
| Root cause | `EMAIL_PROVIDER=stub` in `/opt/aisandbox/.env` |
| Provider in use | `StubEmailProvider` — guaranteed no-op |
| Email sent? | No |
| Next step | 04I3A — Prepare approval-gated staging env update runbook |
| 04I3 status | ACTIVE — Steps 1–3 COMPLETE / BLOCKED pending 04I3A fix |
| 04I3A status | ACTIVE — Step 1 COMPLETE (Registration — 2026-08-04) |
| 04I status | ACTIVE / BLOCKED by 04I3 |
| Parent 04 status | ACTIVE |
| Deployment readiness | BLOCKED / PAUSED |

---

## 11. Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or printed (existence check only)
- ✅ Only `EMAIL_PROVIDER` value observed — no other env values printed
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action taken
- ✅ No email sent
- ✅ No account/login/AI/billing/container/OAuth action taken
- ✅ No git commit or push
- ✅ No subagents used
