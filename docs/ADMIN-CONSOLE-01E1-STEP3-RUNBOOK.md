# ADMIN-CONSOLE-01E1 Step 3 — Staging Re-Smoke Runbook

**Task:** ADMIN-CONSOLE-01E1  
**Step:** 3A — Prepare Staging Re-Smoke  
**Status:** Ready for Keith execution  
**Date prepared:** 2026-08-08  
**Executor:** Keith via AWS Lightsail browser SSH terminal  
**AI guide during execution:** ChatGPT (one command at a time)

---

## Fix Being Validated

**Bug:** `https://staging.ainow.biz/zh-tw/login` incorrectly redirected to `https://localhost:3002/en/zh-tw/login`

**Fix commit:** `4d431e3da9a89e548e88ba3b10d6f378eb988135`  
**Commit message:** `fix(i18n): preserve public origin for locale redirects`  
**Files changed:** `frontend/middleware.ts`, `frontend/middleware.test.ts`  
**Local validation:** 17/17 middleware tests PASS, 644/644 frontend tests PASS, TypeScript PASS

---

## Git Gate (Local — Already Verified)

| Check | Result |
|---|---|
| Local branch | `main` |
| Local HEAD | `4d431e3da9a89e548e88ba3b10d6f378eb988135` |
| origin/main | `4d431e3da9a89e548e88ba3b10d6f378eb988135` |
| Middleware fix on origin/main | ✅ YES |
| Git gate | ✅ CLEARED |

The middleware fix is already on `origin/main`. Deployment may proceed.

---

## Deployment Scope

**Frontend only. No other services.**

| Service | Action |
|---|---|
| `aisandbox-frontend` | rebuild + pm2 restart |
| `api-gateway` | ❌ do not touch |
| `ai-service` | ❌ do not touch |
| `container-manager` | ❌ do not touch |
| PostgreSQL | ❌ do not touch |
| Migrations | ❌ do not run |
| `.env` files | ❌ do not modify |
| Caddy | ❌ do not touch |

---

## Protocol

Keith runs one command at a time in the Lightsail browser SSH terminal.  
After each command, Keith copies the full output to ChatGPT.  
ChatGPT returns: **PASS → proceed** or **STOP → do not continue**.  
Do not proceed to the next step without a PASS.

---

## Staging Commands

### Step S1 — Staging Git Status (READ-ONLY)

**CWD:** `/opt/aisandbox`

```bash
cd /opt/aisandbox && git status
```

**Expected:** `nothing to commit, working tree clean` (or only untracked non-source files)  
**STOP if:** any unexpected modified source files

---

### Step S2 — Record Pre-Deploy HEAD (READ-ONLY)

**CWD:** `/opt/aisandbox`

```bash
git rev-parse HEAD
```

**Expected:** any valid SHA  
**Purpose:** safety record before any mutation  
**Copy SHA to ChatGPT**

---

### Step S3 — Fetch origin (READ-ONLY)

**CWD:** `/opt/aisandbox`

```bash
git fetch origin
```

**Expected:** fetch completes without error  
**STOP if:** network error or auth failure

---

### Step S4 — Inspect origin/main (READ-ONLY)

**CWD:** `/opt/aisandbox`

```bash
git log --oneline origin/main -5
```

**Expected:** Top commit is `4d431e3` with message `fix(i18n): preserve public origin for locale redirects`  
**STOP if:** `4d431e3` is NOT in the top 5 commits on `origin/main`

---

### Step S5 — Fast-Forward Merge (MUTATING — SOURCE)

**CWD:** `/opt/aisandbox`

```bash
git merge --ff-only origin/main
```

**Expected:** `Fast-forward` merge or `Already up to date.`  
**STOP if:** merge fails or `--ff-only` is refused (do NOT use `git reset --hard`)

---

### Step S6 — Verify Post-Merge HEAD (READ-ONLY)

**CWD:** `/opt/aisandbox`

```bash
git rev-parse HEAD
```

**Expected:** `4d431e3da9a89e548e88ba3b10d6f378eb988135`  
**STOP if:** HEAD does not match this exact SHA

---

### Step S7 — Frontend Build (MUTATING — BUILD ARTIFACT)

**CWD:** `/opt/aisandbox/frontend`

```bash
cd /opt/aisandbox/frontend && npm run build
```

**Expected:** build completes with no errors; `✓ Compiled successfully` or equivalent Next.js success output  
**STOP if:** any build error or non-zero exit  
**Note:** Build may take several minutes — wait for completion before copying output

---

### Step S8 — Restart Frontend Only (MUTATING — RUNTIME)

**CWD:** `/opt/aisandbox`

```bash
pm2 restart aisandbox-frontend
```

**Do NOT use `--update-env`**  
**Do NOT restart any other PM2 process**  
**Expected:** `[PM2] Applying action restartProcessId on app [aisandbox-frontend]` and status `online`

---

### Step S9 — PM2 Stability Check (READ-ONLY)

Wait ~15 seconds after S8, then run:

```bash
pm2 list
```

**Expected:**
- `aisandbox-frontend` → status `online`, restart count not climbing
- All other services (`api-gateway`, `ai-service`, `container-manager`) → status unchanged, restart count unchanged

**STOP if:** `aisandbox-frontend` is `errored` or restarting continuously  
**STOP if:** any other service shows unexpected restart

---

### Step S10 — Staging Frontend Health Check (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/en/login
```

**Expected:** `200` or `301`/`302` (redirect to login page) — must NOT be `5xx`  
**STOP if:** `5xx` or connection refused

---

## Browser Re-Smoke Cases

ChatGPT will guide Keith through each case one at a time.  
For each case: open a fresh browser tab, paste the URL exactly as given, allow all redirects to complete, then report the final URL shown in the address bar.

---

### Case A — zh-tw lowercase normalisation

**Enter URL:**
```
https://staging.ainow.biz/zh-tw/login
```

**Expected final URL:**
```
https://staging.ainow.biz/zh-TW/login
```

**FAIL if:** final URL contains `localhost`, or locale remains `zh-tw` (lowercase), or any other origin

---

### Case B — zh-cn lowercase normalisation

**Enter URL:**
```
https://staging.ainow.biz/zh-cn/login
```

**Expected final URL:**
```
https://staging.ainow.biz/zh-CN/login
```

**FAIL if:** final URL contains `localhost`, or locale remains `zh-cn` (lowercase)

---

### Case C — Locale-less path default redirect

**Enter URL:**
```
https://staging.ainow.biz/login
```

**Expected final URL:**
```
https://staging.ainow.biz/en/login
```

**FAIL if:** final URL contains `localhost` or does not include `/en/`

---

### Case D — Canonical en/login loads normally

**Enter URL:**
```
https://staging.ainow.biz/en/login
```

**Expected:** page loads normally (login UI visible), no redirect to localhost  
**FAIL if:** any redirect to `localhost`, or 5xx error

---

### Case E — Canonical zh-TW/login loads normally

**Enter URL:**
```
https://staging.ainow.biz/zh-TW/login
```

**Expected:** page loads normally (login UI in Traditional Chinese), no redirect to localhost  
**FAIL if:** any redirect to `localhost`, or 5xx error

---

### Case F — Canonical zh-CN/login loads normally

**Enter URL:**
```
https://staging.ainow.biz/zh-CN/login
```

**Expected:** page loads normally (login UI in Simplified Chinese), no redirect to localhost  
**FAIL if:** any redirect to `localhost`, or 5xx error

---

### Case G — Query string preservation

**Enter URL:**
```
https://staging.ainow.biz/zh-tw/login?test=1
```

**Expected final URL:**
```
https://staging.ainow.biz/zh-TW/login?test=1
```

**FAIL if:** `test=1` is dropped from the final URL, or final URL contains `localhost`

---

### Case H — Unsupported locale fallback preserves public origin

**Enter URL:**
```
https://staging.ainow.biz/fr/login
```

**Expected final URL:**
```
https://staging.ainow.biz/en/fr/login
```

Note: The resulting page may 404 depending on app routing — that is acceptable.  
**FAIL if:** redirect origin is `localhost` or any non-`staging.ainow.biz` origin

---

## Final Health Check (After All Browser Smoke)

### Step SF1 — PM2 final list

```bash
pm2 list
```

**Expected:**
- `aisandbox-frontend` → `online`
- `api-gateway` → `online`, unchanged restart count
- `ai-service` → `online`, unchanged restart count
- `container-manager` → `online`, unchanged restart count

### Step SF2 — Frontend HTTP final check

```bash
curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/en/login
```

**Expected:** not `5xx`

---

## Step 3 PASS Gate

Step 3 staging re-smoke is PASS only when ALL of the following are true:

| # | Criterion |
|---|---|
| 1 | `/zh-tw/login` → `staging.ainow.biz/zh-TW/login` |
| 2 | `/zh-cn/login` → `staging.ainow.biz/zh-CN/login` |
| 3 | `/login` → `staging.ainow.biz/en/login` |
| 4 | Canonical `/en/login`, `/zh-TW/login`, `/zh-CN/login` load normally |
| 5 | Query string `?test=1` preserved through redirect |
| 6 | Unsupported locale fallback remains on `staging.ainow.biz` |
| 7 | No tested redirect contains `localhost:3002` or any localhost origin |
| 8 | Frontend build exited with 0 errors |
| 9 | `aisandbox-frontend` stable after PM2 restart |
| 10 | No unrelated services restarted or changed |

**If any tested public redirect still contains `localhost`:**  
→ **FAIL — STOP — do not consolidate**

---

## After Re-Smoke

Do NOT consolidate in this execution window.

After Keith and ChatGPT complete all smoke cases and collect all evidence, Keith will provide the evidence to a **new Cursor window** for Step 3C consolidation.

---

## Security Note

No hostile Host-header injection testing is required at staging.  
Focused automated middleware tests (17/17 PASS) already cover malformed `x-forwarded-host` and `x-forwarded-proto` handling.  
Staging smoke only confirms normal reverse-proxy headers produce the correct public origin.

---

*Runbook prepared by Cursor/Sonnet 4.6 — 2026-08-08*  
*Do not modify this file during execution. It is a READ-ONLY execution guide.*
