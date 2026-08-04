# PRIVATE-BETA-STAGING-EXECUTION-04I3A — Staging Resend Email Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I3A  
**Title:** Enable Staging Resend Email Verification  
**Step:** 2 — Approval-Gated Staging Resend Email Runbook  
**Status:** STEP 2 COMPLETE — Runbook created — 2026-08-04  
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04I3  
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action by Cursor)  
**Date:** 2026-08-04

---

## ⛔ STOP — APPROVAL GATE

**This runbook must not be executed until Keith provides the exact approval phrase below.**

```
go — approve 04I3A staging Resend env update
```

Do not SSH to the VPS. Do not edit `/opt/aisandbox/.env`. Do not restart any service. Do not send any email. **Await approval before proceeding to any section marked EXECUTION.**

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I3A |
| Title | Enable Staging Resend Email Verification |
| Step | 2 — Approval-gated staging Resend env update runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04I3 |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Root | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Venue | AWS Lightsail VPS — SSH browser terminal |
| Status | ACTIVE — Step 1 COMPLETE (Registration) — Step 2 COMPLETE (this runbook) |

---

## 2. Purpose

The staging API Gateway is currently running with `EMAIL_PROVIDER=stub`, which causes `StubEmailProvider` to silently discard all outgoing email. Registration succeeds (HTTP 201), but the verification email is never sent. This blocks 04I Path D (full registration → email verification → login → /app).

This runbook provides an approval-gated, secret-safe procedure for:

1. Confirming Resend prerequisites outside of ChatGPT/Cursor.
2. Backing up the staging env file.
3. Updating only the required email env keys on the VPS using interactive masked entry (no secret echoed to terminal).
4. Validating the change without printing secret values.
5. Restarting only the API Gateway process.
6. Validating health endpoints after restart.
7. Testing one registration email delivery.
8. Rolling back safely if anything fails.

---

## 3. Current Evidence / Root Cause

### Root Cause (Confirmed — 2026-08-04)

| Item | Value |
|---|---|
| Root cause | `EMAIL_PROVIDER=stub` in `/opt/aisandbox/.env` |
| Provider in use | `StubEmailProvider` — intentional no-op |
| `sendEmail()` behavior | Returns `void` immediately — guaranteed no-op — never reaches Resend |
| Email sent? | No |
| Registration result | HTTP 201 — success message shown — pending-verification UI state |
| Verification email | Never arrived — not even attempted |
| Token in DB | YES — `generateAndStoreVerificationToken()` stores token before email send |
| Startup validation? | No — email config is not checked at startup |
| Source | Confirmed via safe env grep: `EMAIL_PROVIDER=stub` in `/opt/aisandbox/.env` (2026-08-04 13:33:04 HKT) |

### VPS Safe State at Time of Diagnosis

| Item | Value |
|---|---|
| VPS git HEAD | `40c43af Reconcile staging root redirect state` |
| git status | clean |
| pm2-ubuntu | active |
| caddy | active |
| All four PM2 apps | online |
| Caddy root redirect | `redir / /en 307` active |

### Source Evidence

From `services/api-gateway/src/email/email.module.ts` (lines 19–22):
```typescript
const configuredProvider = (process.env.EMAIL_PROVIDER ?? 'stub').trim().toLowerCase();
if (configuredProvider === 'stub') {
  return new StubEmailProvider();
}
```

From `services/api-gateway/src/email/resend-email.provider.ts` (constructor):
- If `RESEND_API_KEY` is missing → throws at module init → API Gateway fails to start.
- If `AUTH_EMAIL_FROM` is missing → throws at module init → API Gateway fails to start.
- If both are present → `new Resend(apiKey).emails.send(...)` is called on each email.

From `services/api-gateway/src/auth/auth.service.ts` (sendVerificationEmail):
- Reads `process.env.APP_BASE_URL`.
- If missing → throws immediately → registration returns HTTP 500.
- Builds: `${APP_BASE_URL}/api/auth/email/verify?token=${rawToken}&locale=${locale}`

---

## 4. Required Resend Prerequisites — Keith Must Confirm Outside ChatGPT/Cursor

**Before approving this runbook**, Keith must confirm the following items — **without pasting any secret values into ChatGPT or Cursor**:

| # | Prerequisite | Where to Check |
|---|---|---|
| P1 | A Resend API key exists and is available for staging use | Resend dashboard → API Keys |
| P2 | The sending domain or sender address is verified in Resend | Resend dashboard → Domains or Senders |
| P3 | `AUTH_EMAIL_FROM` will be set to a sender address that Resend allows (e.g., `noreply@yourdomain.com` matching the verified domain) | Resend dashboard → Domains/Senders |
| P4 | `APP_BASE_URL` will be set to `https://staging.ainow.biz` | Staging config decision |
| P5 | `EMAIL_PROVIDER` will be set to `resend` | This runbook |

**Do not paste `RESEND_API_KEY` or any secret value into ChatGPT or Cursor.** Confirm only that the key exists and the domain is verified. Enter secret values only interactively on the VPS terminal using the masked entry method described in Section 9.

---

## 5. Required Environment Variable Names (Names Only — No Values)

| Variable | Required? | Purpose |
|---|---|---|
| `EMAIL_PROVIDER` | Required | Must be set to `resend` to enable real email delivery |
| `RESEND_API_KEY` | Required when `EMAIL_PROVIDER=resend` | Resend API authentication key |
| `AUTH_EMAIL_FROM` | Required when `EMAIL_PROVIDER=resend` | Verified sender address/domain in Resend |
| `APP_BASE_URL` | Required (always) | Base URL for verification link — must be `https://staging.ainow.biz` |
| `AUTH_EMAIL_REPLY_TO` | Optional | Reply-to address for verification emails |

**Note:** Do not include any values in this document. All values must be entered interactively on the VPS terminal.

---

## 6. Secret-Safety Rules

These rules apply at all times during this runbook:

1. **Never echo `RESEND_API_KEY` to the terminal.** Use `read -s` for interactive masked entry.
2. **Never print the full `/opt/aisandbox/.env` file.** Do not use `cat` on the env file.
3. **Never print `AUTH_EMAIL_FROM` or `AUTH_EMAIL_REPLY_TO`.** These may contain PII-adjacent data.
4. **Never paste secret values into ChatGPT or Cursor.** Confirm only that they are set or unset.
5. **Validation commands must only confirm SET_REDACTED or MISSING** — never print the actual value.
6. **`APP_BASE_URL` is the only value that may be safely printed** — only if it exactly equals `https://staging.ainow.biz` (it is not a secret, but only print it for correctness verification).
7. **Do not share terminal screenshots containing env values.**

---

## 7. Pre-Change VPS Safety Checks

**EXECUTION — Requires prior Keith approval.**

SSH to the VPS. Before making any change, run the following checks and record the output:

```bash
# Date/time
date

# VPS git state
cd /opt/aisandbox
git log --oneline -1
git status

# Table count (must be 26)
sudo -u postgres psql -d aisandbox -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# PM2 app state
pm2 list

# PM2-ubuntu systemd state
systemctl is-active pm2-ubuntu

# Caddy state
systemctl is-active caddy

# Caddy root redirect present
grep -n "redir / /en" /etc/caddy/Caddyfile
```

**Expected pre-change state:**

| Check | Expected Value |
|---|---|
| git HEAD | `40c43af Reconcile staging root redirect state` |
| git status | clean |
| table count | 26 |
| aisandbox-api-gateway | online |
| aisandbox-frontend | online |
| aisandbox-ai-service | online |
| aisandbox-container-manager | online |
| pm2-ubuntu | active |
| caddy | active |
| redir / /en 307 | present in Caddyfile |

**Stop if any check fails. Do not proceed.**

---

## 8. Safe Backup of `/opt/aisandbox/.env`

**EXECUTION — Requires prior Keith approval.**

Create a timestamped backup of the env file before making any changes:

```bash
BACKUP_TS=$(date +%Y%m%d-%H%M%S)
cp /opt/aisandbox/.env /opt/aisandbox/.env.backup-04I3A-${BACKUP_TS}
echo "Backup created: /opt/aisandbox/.env.backup-04I3A-${BACKUP_TS}"
ls -la /opt/aisandbox/.env.backup-04I3A-${BACKUP_TS}
```

**Stop and do not proceed if the backup command fails or the backup file is not listed.**

The backup will be used for rollback (see Section 15).

---

## 9. Safe Masked Env Update Method

**EXECUTION — Requires prior Keith approval.**

The following commands update only the required email keys. **Secret values are entered interactively and are never echoed to the terminal.**

### Step 9A — Set `EMAIL_PROVIDER=resend` (safe value, may be printed)

```bash
# Remove any existing EMAIL_PROVIDER line and add the new value
sed -i '/^EMAIL_PROVIDER=/d' /opt/aisandbox/.env
echo "EMAIL_PROVIDER=resend" >> /opt/aisandbox/.env
echo "EMAIL_PROVIDER set to: resend"
```

### Step 9B — Set `RESEND_API_KEY` (secret — masked entry)

```bash
# Remove existing key if present
sed -i '/^RESEND_API_KEY=/d' /opt/aisandbox/.env
# Enter value without echo
read -s -p "Enter RESEND_API_KEY value (input hidden): " RESEND_API_KEY_VAL
echo ""
echo "RESEND_API_KEY=${RESEND_API_KEY_VAL}" >> /opt/aisandbox/.env
unset RESEND_API_KEY_VAL
echo "RESEND_API_KEY written to env (value not printed)."
```

### Step 9C — Set `AUTH_EMAIL_FROM` (masked entry)

```bash
# Remove existing key if present
sed -i '/^AUTH_EMAIL_FROM=/d' /opt/aisandbox/.env
# Enter value without echo
read -s -p "Enter AUTH_EMAIL_FROM value (input hidden): " AUTH_EMAIL_FROM_VAL
echo ""
echo "AUTH_EMAIL_FROM=${AUTH_EMAIL_FROM_VAL}" >> /opt/aisandbox/.env
unset AUTH_EMAIL_FROM_VAL
echo "AUTH_EMAIL_FROM written to env (value not printed)."
```

### Step 9D — Set `APP_BASE_URL` (safe value)

```bash
# Remove existing key if present
sed -i '/^APP_BASE_URL=/d' /opt/aisandbox/.env
echo "APP_BASE_URL=https://staging.ainow.biz" >> /opt/aisandbox/.env
echo "APP_BASE_URL set."
```

### Step 9E — Set `AUTH_EMAIL_REPLY_TO` (optional — masked entry or skip)

If you want to set a reply-to address:

```bash
# Remove existing key if present
sed -i '/^AUTH_EMAIL_REPLY_TO=/d' /opt/aisandbox/.env
# Enter value without echo
read -s -p "Enter AUTH_EMAIL_REPLY_TO value (input hidden, or press Enter to skip): " AUTH_EMAIL_REPLY_TO_VAL
echo ""
if [ -n "${AUTH_EMAIL_REPLY_TO_VAL}" ]; then
  echo "AUTH_EMAIL_REPLY_TO=${AUTH_EMAIL_REPLY_TO_VAL}" >> /opt/aisandbox/.env
  echo "AUTH_EMAIL_REPLY_TO written to env (value not printed)."
else
  echo "AUTH_EMAIL_REPLY_TO skipped (empty)."
fi
unset AUTH_EMAIL_REPLY_TO_VAL
```

If you do not want to set it, skip Step 9E entirely.

---

## 10. Safe Set/Missing Validation (Never Prints Secret Values)

**EXECUTION — After all 9A–9E steps are complete.**

Run this validation block to confirm each variable is set or missing. **This block never prints actual values.**

```bash
echo "=== 04I3A ENV VALIDATION ==="

# EMAIL_PROVIDER — safe to print (not a secret)
EMAIL_PROVIDER_VAL=$(grep "^EMAIL_PROVIDER=" /opt/aisandbox/.env | cut -d= -f2)
if [ "${EMAIL_PROVIDER_VAL}" = "resend" ]; then
  echo "EMAIL_PROVIDER: resend (CORRECT)"
else
  echo "EMAIL_PROVIDER: WRONG VALUE — expected 'resend' — got '${EMAIL_PROVIDER_VAL}'"
fi

# RESEND_API_KEY — masked check
if grep -q "^RESEND_API_KEY=.\+" /opt/aisandbox/.env 2>/dev/null; then
  echo "RESEND_API_KEY: SET_REDACTED"
else
  echo "RESEND_API_KEY: MISSING — STOP"
fi

# AUTH_EMAIL_FROM — masked check
if grep -q "^AUTH_EMAIL_FROM=.\+" /opt/aisandbox/.env 2>/dev/null; then
  echo "AUTH_EMAIL_FROM: SET_REDACTED"
else
  echo "AUTH_EMAIL_FROM: MISSING — STOP"
fi

# APP_BASE_URL — safe to print only if it equals expected value
APP_BASE_URL_VAL=$(grep "^APP_BASE_URL=" /opt/aisandbox/.env | cut -d= -f2)
if [ "${APP_BASE_URL_VAL}" = "https://staging.ainow.biz" ]; then
  echo "APP_BASE_URL: https://staging.ainow.biz (CORRECT)"
else
  echo "APP_BASE_URL: WRONG — expected 'https://staging.ainow.biz' — STOP"
fi

# AUTH_EMAIL_REPLY_TO — optional
if grep -q "^AUTH_EMAIL_REPLY_TO=.\+" /opt/aisandbox/.env 2>/dev/null; then
  echo "AUTH_EMAIL_REPLY_TO: SET_REDACTED (optional)"
elif grep -q "^AUTH_EMAIL_REPLY_TO=" /opt/aisandbox/.env 2>/dev/null; then
  echo "AUTH_EMAIL_REPLY_TO: EMPTY (optional — acceptable)"
else
  echo "AUTH_EMAIL_REPLY_TO: MISSING (optional — acceptable)"
fi

echo "=== END VALIDATION ==="
```

**Expected validation output:**

```
=== 04I3A ENV VALIDATION ===
EMAIL_PROVIDER: resend (CORRECT)
RESEND_API_KEY: SET_REDACTED
AUTH_EMAIL_FROM: SET_REDACTED
APP_BASE_URL: https://staging.ainow.biz (CORRECT)
AUTH_EMAIL_REPLY_TO: SET_REDACTED (optional)   ← or EMPTY/MISSING — both acceptable
=== END VALIDATION ===
```

**Stop if `EMAIL_PROVIDER` is not `resend`, `RESEND_API_KEY` is MISSING, `AUTH_EMAIL_FROM` is MISSING, or `APP_BASE_URL` is not exactly `https://staging.ainow.biz`.**

---

## 11. Restart Only API Gateway

**EXECUTION — After Section 10 validation passes.**

Restart only the API Gateway process to pick up the new env values. **Do not restart any other PM2 process, Caddy, PostgreSQL, Redis, or the server.**

```bash
pm2 restart aisandbox-api-gateway
```

Wait 5–10 seconds for startup, then check app status:

```bash
pm2 list
pm2 show aisandbox-api-gateway
```

**Expected:** `aisandbox-api-gateway` status `online`, `status` not `errored` or `stopped`.

If `aisandbox-api-gateway` shows `errored` or `stopped`, check logs:

```bash
pm2 logs aisandbox-api-gateway --lines 50 --nostream
```

Look for startup errors such as:
- `RESEND_API_KEY is required when EMAIL_PROVIDER=resend`
- `AUTH_EMAIL_FROM is required when EMAIL_PROVIDER=resend`
- `APP_BASE_URL is required for email auth`
- `Unknown EMAIL_PROVIDER`

If any of these errors appear, **stop and execute rollback (Section 15).**

---

## 12. Health Validation

**EXECUTION — After Section 11 (API Gateway online).**

Run these checks and record all results.

```bash
# Public HTTPS health checks (via Caddy/external)
echo "PUBLIC_HTTPS_API_HEALTH_FORCED=$(curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/api/health)"
echo "PUBLIC_HTTPS_API_DB_HEALTH_FORCED=$(curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/api/health/db)"
echo "PUBLIC_HTTPS_API_READY_FORCED=$(curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/api/health/ready)"

# Local health checks
echo "LOCAL_API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health)"
echo "LOCAL_API_DB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health/db)"
echo "LOCAL_API_READY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health/ready)"

# PM2 API Gateway online
pm2 list | grep aisandbox-api-gateway

# Caddy active
systemctl is-active caddy

# Root redirect still correct
echo "ROOT_REDIRECT=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" https://staging.ainow.biz/)"
curl -s -o /dev/null -I -w "%{http_code} Location:%header{location}\n" http://localhost:3002/

# Login and register pages reachable
echo "EN_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/en/login)"
echo "EN_REGISTER=$(curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/en/register)"

# Table count (must still be 26)
sudo -u postgres psql -d aisandbox -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

**Expected health validation results:**

| Check | Expected |
|---|---|
| `PUBLIC_HTTPS_API_HEALTH_FORCED` | `200` |
| `PUBLIC_HTTPS_API_DB_HEALTH_FORCED` | `200` |
| `PUBLIC_HTTPS_API_READY_FORCED` | `200` |
| `LOCAL_API_HEALTH` | `200` |
| `LOCAL_API_DB_HEALTH` | `200` |
| `LOCAL_API_READY` | `200` |
| `pm2 aisandbox-api-gateway` | `online` |
| `caddy` | `active` |
| root redirect | `Location: /en` (307) |
| `/en/login` | `200` |
| `/en/register` | `200` |
| table count | `26` |

**Stop and rollback if any health check fails.**

---

## 13. One-Test Registration / Email Delivery Validation

**EXECUTION — After Section 12 health validation fully passes.**

### Rules

- Use a **staging-only test email address** that you control.
- Use a **non-production password** — do not use a password you use elsewhere.
- **Do not paste the password, verification token, or verification link into ChatGPT or Cursor.**
- Check both inbox and spam/junk folder.
- If a verification email arrives, **click the verification link privately in your browser** — do not share the link/token here.
- Report only the safe result fields below.

### Browser Steps

1. Open `https://staging.ainow.biz/en/register` in a browser.
2. Register with a new staging-only test email address.
3. Use a new non-production password.
4. Click Register / Submit.
5. Observe the result on screen.
6. Check inbox and spam within 2–5 minutes.
7. If email arrives, click the verification link privately.

### Safe Result Fields to Report

After completing the test, report **only** these fields:

| Field | Value |
|---|---|
| Registration page loaded | YES / NO |
| Register button submitted | YES / NO |
| UI result after submit | (e.g., "Verification email sent" message / error message / other) |
| URL after submit | (full URL — e.g., `/en/register` or other) |
| Verification email arrived | YES / NO |
| Email arrived in spam/junk | YES / NO (if arrived) |
| Sender domain looked correct | YES / NO (do not paste the exact address) |
| Verification link clicked privately | YES / NO |
| URL after clicking link | (final URL — e.g., `/en/login?verified=1`) |
| Redirected to | login page / app / other |
| HTTPS lock valid after verification | YES / NO |
| No localhost in URL | YES / NO |
| Any errors seen | NONE / (brief description, no tokens) |

---

## 14. Optional Resend Dashboard Check

If verification email does not arrive within 5 minutes, check the Resend dashboard (https://resend.com):

1. Log in to Resend.
2. Navigate to **Logs** or **Emails**.
3. Search for the staging test email address used.
4. Check status: `delivered`, `bounced`, `failed`, or not found.
5. If not found: `EMAIL_PROVIDER=resend` may not have taken effect — verify Section 10 validation passed and API Gateway was restarted.
6. If `bounced` or `failed`: check `AUTH_EMAIL_FROM` sender domain is verified in Resend.

Report only: status result and whether the email appeared in Resend logs (YES/NO) — do not share email addresses, tokens, or API keys here.

---

## 15. Rollback Plan

If at any point a stop condition is triggered, or if API health fails after restart, execute this rollback:

### Rollback Steps

```bash
# 1. Identify the backup file created in Section 8
ls /opt/aisandbox/.env.backup-04I3A-*

# 2. Restore the backup (replace TIMESTAMP with actual timestamp)
cp /opt/aisandbox/.env.backup-04I3A-TIMESTAMP /opt/aisandbox/.env
echo "Env restored from backup."

# 3. Restart API Gateway with restored env
pm2 restart aisandbox-api-gateway

# 4. Wait 5–10 seconds, then validate health
pm2 list
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health/db
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health/ready

# 5. Verify root redirect still active
grep -n "redir / /en" /etc/caddy/Caddyfile
```

**Expected rollback result:**
- API Gateway `online`
- `API_HEALTH` / `API_DB_HEALTH` / `API_READY` all `200`
- `redir / /en 307` still present in Caddyfile

After rollback succeeds, report the failure and stop. Do not retry without a new investigation step.

---

## 16. Stop Conditions

**Stop immediately and do not proceed if any of the following occur:**

| # | Stop Condition | Action |
|---|---|---|
| S1 | Resend API key does not exist or is unavailable | Stop — obtain Resend API key first |
| S2 | Resend sending domain/sender not verified | Stop — verify domain in Resend before proceeding |
| S3 | `AUTH_EMAIL_FROM` is not an address/domain allowed by Resend | Stop — verify sender in Resend |
| S4 | Any command would print secret values | Stop — use masked entry; never echo secrets |
| S5 | Backup of `/opt/aisandbox/.env` fails (Section 8) | Stop — investigate filesystem; do not edit env without backup |
| S6 | Section 10 validation shows `EMAIL_PROVIDER` not `resend` | Stop — rerun Section 9A |
| S7 | Section 10 validation shows `RESEND_API_KEY` MISSING after update | Stop — rerun Section 9B |
| S8 | Section 10 validation shows `AUTH_EMAIL_FROM` MISSING after update | Stop — rerun Section 9C |
| S9 | Section 10 validation shows `APP_BASE_URL` not exactly `https://staging.ainow.biz` | Stop — rerun Section 9D |
| S10 | API Gateway restart fails or shows `errored`/`stopped` | Stop — check PM2 logs; execute rollback (Section 15) |
| S11 | `RESEND_API_KEY is required` error in PM2 logs | Stop — validate key was set; rollback if needed |
| S12 | `AUTH_EMAIL_FROM is required` error in PM2 logs | Stop — validate from address was set; rollback if needed |
| S13 | Any health endpoint returns non-200 after restart | Stop — execute rollback (Section 15) |
| S14 | Root redirect no longer returns `Location: /en` | Stop — do not proceed; check Caddy |
| S15 | `/en/login` or `/en/register` returns non-200 | Stop — do not proceed; investigate |
| S16 | Verification email still does not arrive after one test registration | Stop — record and escalate; do not retry in loop |
| S17 | Any production domain appears in test (e.g., ainow.biz without staging.) | Stop immediately |
| S18 | Any Google OAuth / AI execution / billing / container execution is triggered | Stop immediately |
| S19 | Any prompt to enter secrets into ChatGPT or Cursor appears | Stop — do not paste secrets anywhere except VPS terminal |

---

## 17. Evidence Template

After completing execution, record the following evidence for the 04I3A Step 3 evidence review:

```text
PRIVATE-BETA-STAGING-EXECUTION-04I3A — Step 3 Evidence
Date/Time: ___________
VPS git HEAD: ___________
git status: ___________
Pre-change state OK: YES / NO
Backup created: /opt/aisandbox/.env.backup-04I3A-___________
EMAIL_PROVIDER validation: resend (CORRECT) / ___________
RESEND_API_KEY validation: SET_REDACTED / MISSING
AUTH_EMAIL_FROM validation: SET_REDACTED / MISSING
APP_BASE_URL validation: https://staging.ainow.biz (CORRECT) / ___________
AUTH_EMAIL_REPLY_TO validation: SET_REDACTED / EMPTY / MISSING
API Gateway restart: success / errored
API Gateway PM2 status: online / ___________
PUBLIC_HTTPS_API_HEALTH_FORCED: ___________
PUBLIC_HTTPS_API_DB_HEALTH_FORCED: ___________
PUBLIC_HTTPS_API_READY_FORCED: ___________
LOCAL_API_HEALTH: ___________
LOCAL_API_DB_HEALTH: ___________
LOCAL_API_READY: ___________
caddy: active / ___________
root redirect: Location: /en / ___________
/en/login: ___________
/en/register: ___________
table count: ___________
Registration page loaded: YES / NO
Registration submitted: YES / NO
UI result after submit: ___________
URL after submit: ___________
Verification email arrived: YES / NO
Email in spam: YES / NO
Sender domain correct: YES / NO
Verification link clicked: YES / NO
URL after clicking link: ___________
Redirected to: ___________
HTTPS lock valid: YES / NO
No localhost: YES / NO
Errors: NONE / ___________
```

---

## 18. Approval Gate

**Keith must provide this exact approval phrase before any execution step in this runbook begins:**

```
go — approve 04I3A staging Resend env update
```

This approval covers:
- Editing `/opt/aisandbox/.env` with masked interactive secret entry (Sections 9–10).
- Restarting `aisandbox-api-gateway` only (Section 11).
- Running health validation (Section 12).
- Running one staging test email registration (Section 13).

This approval **does not cover**:
- Restarting frontend, container-manager, ai-service, Caddy, PostgreSQL, Redis, or the whole server.
- Changing Caddyfile, DNS, or TLS configuration.
- Enabling Google OAuth, AI execution, billing, or container execution.
- Any production domain or production env file.
- Any git commit or push.
- Any further remediation beyond this runbook scope — a new approval is required for any step not listed above.

---

## 19. Exact Next Action

1. Keith reads this runbook (Section 4) and confirms Resend prerequisites are met outside ChatGPT/Cursor — without pasting secrets.
2. Keith provides the exact approval phrase: `go — approve 04I3A staging Resend env update`
3. Keith SSHs to the VPS and executes Sections 7–13 in order, stopping at any stop condition.
4. Keith reports safe evidence using the template in Section 17.
5. Cursor reviews evidence and completes 04I3A Step 3 evidence review / checkpoint.
6. If email delivery confirmed: 04I3A COMPLETE — resume 04I Path D → E/F.
7. If email delivery fails: stop, record, and register a new investigation step.

---

## Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or printed
- ✅ No env values read or printed
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action taken
- ✅ No email sent by Cursor
- ✅ No account/login/AI/billing/container/OAuth action taken
- ✅ No git commit or push
- ✅ No subagents used
