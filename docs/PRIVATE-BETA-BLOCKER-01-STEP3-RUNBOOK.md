# PRIVATE-BETA-BLOCKER-01 Step 3A — Controlled Staging Deployment + Browser Validation Runbook

**Task:** PRIVATE-BETA-BLOCKER-01  
**Step:** 3A — Prepare Controlled Staging Deployment + Browser Validation Runbook  
**Status:** Ready for Keith execution  
**Date prepared:** 2026-08-09  
**Executor:** Keith via AWS Lightsail browser SSH terminal  
**AI guide during execution:** ChatGPT (one command at a time)

---

## Fix Being Deployed

**Problem:** Legacy workspace early-return path was conditionally active depending on `NEXT_PUBLIC_PROJECT_FIRST_UX` feature flag. When the flag was absent or unset, the legacy session-scoped workspace appeared instead of the canonical project-first workspace.

**Fix commit:** `651f723447a85ec5d22139d6ba60be6680a0f8c6`  
**Short SHA:** `651f723`  
**Commit message:** `fix(workspace): remove legacy project-first feature flag`  
**Expected staging predecessor HEAD:** `4d431e3da9a89e548e88ba3b10d6f378eb988135`

**Files changed (6):**

| File | Change |
|---|---|
| `docker-compose.prod.yml` | removed `NEXT_PUBLIC_PROJECT_FIRST_UX` from frontend env |
| `frontend/Dockerfile` | removed `NEXT_PUBLIC_PROJECT_FIRST_UX` build arg |
| `frontend/app/[locale]/app/page.tsx` | removed legacy workspace branch |
| `frontend/components/workspace/workspace-shell.tsx` | removed legacy workspace early-return |
| `frontend/components/workspace/workspace-shell.test.tsx` | canonical + legacy-absence test coverage |
| `frontend/lib/feature-flags.ts` | deleted (entire file removed) |

**Local validation:** 630/630 tests PASS, TypeScript PASS, `npm run build` PASS (no feature flag)

---

## Deployment Scope

**Frontend only. No other services.**

| Service | Action |
|---|---|
| `aisandbox-frontend` | rebuild + pm2 restart |
| `aisandbox-api-gateway` | ❌ do NOT touch |
| `aisandbox-ai-service` | ❌ do NOT touch |
| `aisandbox-container-manager` | ❌ do NOT touch |
| PostgreSQL | ❌ do NOT touch |
| Migrations | ❌ do NOT run |
| `.env` files | ❌ do NOT modify |
| Caddy | ❌ do NOT touch |
| `GLOBAL_EXECUTION_ENABLED` | ❌ do NOT change |

---

## Protocol

Keith runs **one command at a time** in the Lightsail browser SSH terminal.  
After each command, Keith copies the full output to ChatGPT.  
ChatGPT returns: **PASS → proceed** or **STOP → do not continue**.  
Do not proceed to the next step without a PASS.

---

## A. PRE-DEPLOY GATES

### Step A1 — Confirm Repo Directory (READ-ONLY)

```bash
cd /opt/aisandbox && pwd
```

**Expected:** `/opt/aisandbox`  
**STOP if:** directory does not exist or path differs

---

### Step A2 — Confirm Branch (READ-ONLY)

```bash
git branch --show-current
```

**Expected:** `main`  
**STOP if:** not on `main`

---

### Step A3 — Working Tree Clean Check (READ-ONLY)

```bash
git status
```

**Expected:** `nothing to commit, working tree clean` (or only untracked non-source files)  
**STOP if:** any modified tracked source files — report to ChatGPT for triage

---

### Step A4 — Record Pre-Deploy HEAD (READ-ONLY)

```bash
git rev-parse HEAD
```

**Expected:** `4d431e3da9a89e548e88ba3b10d6f378eb988135`  
**Copy SHA to ChatGPT.**

If the SHA matches `4d431e3da9a89e548e88ba3b10d6f378eb988135` → continue.  
If the SHA matches `651f723447a85ec5d22139d6ba60be6680a0f8c6` → already deployed; skip to Section D (PM2 check).  
If the SHA is **neither** → **STOP** and report to ChatGPT. Staging may have legitimately advanced. Do not proceed without triage.

---

### Step A5 — Fetch Origin (READ-ONLY)

```bash
git fetch origin
```

**Expected:** fetch completes without error  
**STOP if:** network error or auth failure

---

### Step A6 — Confirm Implementation Commit on Origin (READ-ONLY)

```bash
git log --oneline origin/main -5
```

**Expected:** Top commit is `651f723` with message `fix(workspace): remove legacy project-first feature flag`  
**STOP if:** `651f723` is NOT in the top 5 commits on `origin/main`

---

### Step A7 — Inspect Bounded Diff (READ-ONLY)

```bash
git log --oneline HEAD..origin/main
```

**Expected:** Exactly one commit:
```
651f723 fix(workspace): remove legacy project-first feature flag
```

**STOP if:**
- More than one commit would be merged (unexpected commits)
- Zero commits (already up to date — skip to Section D)

---

### Step A8 — Inspect File-Level Changes (READ-ONLY)

```bash
git diff --stat HEAD..origin/main
```

**Expected:** Exactly these 6 files changed:
```
docker-compose.prod.yml
frontend/Dockerfile
frontend/app/[locale]/app/page.tsx
frontend/components/workspace/workspace-shell.test.tsx
frontend/components/workspace/workspace-shell.tsx
frontend/lib/feature-flags.ts
```

**STOP if:** unexpected files appear in the diff

---

## B. BACKUP / ROLLBACK PREPARATION

### Step B1 — Create Backup Directory (MUTATING — FILESYSTEM)

```bash
sudo mkdir -p /opt/aisandbox-backups/private-beta-blocker-01
```

**Expected:** directory created (or already exists)

---

### Step B2 — Set Ownership (MUTATING — FILESYSTEM)

```bash
sudo chown ubuntu:ubuntu /opt/aisandbox-backups/private-beta-blocker-01
```

**Note:** Only changes ownership of the task-specific directory. Does NOT alter `/opt/aisandbox-backups` root ownership.

---

### Step B3 — Record Pre-Deploy State (READ-ONLY → WRITE TO BACKUP)

```bash
echo "=== PRE-DEPLOY SNAPSHOT ===" > /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
echo "Date: $(date -u)" >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
echo "HEAD: $(git rev-parse HEAD)" >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
echo "" >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
echo "=== git log -5 ===" >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
git log --oneline -5 >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
echo "" >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
echo "=== pm2 list ===" >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
pm2 list >> /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
```

**Expected:** file written without error

---

### Step B4 — Verify Backup File (READ-ONLY)

```bash
cat /opt/aisandbox-backups/private-beta-blocker-01/predeploy-state.txt
```

**Expected:** contains HEAD SHA `4d431e3...`, git log, and pm2 process list  
**Copy output to ChatGPT for the record**

---

### Step B5 — Back Up Current .next Build (MUTATING — FILESYSTEM)

```bash
cp -a /opt/aisandbox/frontend/.next /opt/aisandbox-backups/private-beta-blocker-01/dot-next-backup
```

**Expected:** copy completes without error  
**Note:** This preserves the current build artifacts for rollback if needed

---

### Rollback Procedure (DO NOT EXECUTE — REFERENCE ONLY)

If a rollback-worthy failure is detected after deployment, execute these commands:

```bash
# 1. Revert git to pre-deploy HEAD
cd /opt/aisandbox && git reset --hard 4d431e3da9a89e548e88ba3b10d6f378eb988135

# 2. Restore previous build artifacts
rm -rf /opt/aisandbox/frontend/.next
cp -a /opt/aisandbox-backups/private-beta-blocker-01/dot-next-backup /opt/aisandbox/frontend/.next

# 3. Restart frontend only
pm2 restart aisandbox-frontend
```

**Do NOT execute rollback unless ChatGPT explicitly confirms a rollback-worthy failure.**

---

## C. DEPLOYMENT

### Step C1 — Fast-Forward Merge (MUTATING — SOURCE)

```bash
cd /opt/aisandbox && git merge --ff-only origin/main
```

**Expected:** `Fast-forward` merge  
**STOP if:** merge fails or `--ff-only` is refused (do NOT use `git merge` without `--ff-only`)

---

### Step C2 — Verify Post-Merge HEAD (READ-ONLY)

```bash
git rev-parse HEAD
```

**Expected:** `651f723447a85ec5d22139d6ba60be6680a0f8c6`  
**STOP if:** HEAD does not match this exact SHA

---

### Step C3 — Verify Working Tree Clean After Merge (READ-ONLY)

```bash
git status
```

**Expected:** `nothing to commit, working tree clean`  
**STOP if:** unexpected dirty state

---

### Step C4 — Confirm Legacy Flag Absent from Deployed Source (READ-ONLY)

```bash
grep -rn "PROJECT_FIRST_UX\|projectFirstUxEnabled" /opt/aisandbox/frontend/app /opt/aisandbox/frontend/components /opt/aisandbox/frontend/lib /opt/aisandbox/docker-compose.prod.yml /opt/aisandbox/frontend/Dockerfile 2>/dev/null || echo "CLEAN: No references found"
```

**Expected:** `CLEAN: No references found`  
**Note:** Historical references in docs/ or test description strings are acceptable. Active source/config references are NOT acceptable.  
**STOP if:** any active source reference to `PROJECT_FIRST_UX` or `projectFirstUxEnabled` appears in app/, components/, lib/, Dockerfile, or docker-compose.prod.yml

---

### Step C5 — Frontend Build (MUTATING — BUILD ARTIFACT)

**CRITICAL:** Do NOT export or set `NEXT_PUBLIC_PROJECT_FIRST_UX`. The entire purpose of this fix is that an ordinary build produces canonical behavior without any feature flag.

```bash
cd /opt/aisandbox/frontend && npm run build
```

**Expected:** build completes with no errors; `✓ Compiled successfully` or equivalent Next.js success output  
**STOP if:** any build error or non-zero exit code  
**Note:** Build may take several minutes — wait for completion before copying output

---

## D. PM2 RESTART

### Step D1 — Record Pre-Restart PM2 State (READ-ONLY)

```bash
pm2 list
```

**Copy output to ChatGPT.** Record restart counts for all services.

---

### Step D2 — Restart Frontend Only (MUTATING — RUNTIME)

```bash
pm2 restart aisandbox-frontend
```

**Do NOT use `--update-env`**  
**Do NOT restart any other PM2 process**  
**Expected:** `[PM2] Applying action restartProcessId on app [aisandbox-frontend]` and status `online`

---

### Step D3 — Wait for Stabilization

Wait approximately **15 seconds** after D2, then proceed.

---

### Step D4 — PM2 Stability Check (READ-ONLY)

```bash
pm2 list
```

**Expected:**
- `aisandbox-frontend` → status `online`, restart count incremented by exactly 1 from D1
- `aisandbox-api-gateway` → status `online`, restart count unchanged from D1
- `aisandbox-ai-service` → status `online`, restart count unchanged from D1
- `aisandbox-container-manager` → status `online`, restart count unchanged from D1

**STOP if:** `aisandbox-frontend` is `errored` or restart count climbing  
**STOP if:** any other service shows unexpected restart

---

## E. HTTP HEALTH

### Step E1 — Public Landing Health (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/en
```

**Expected:** `200`  
**STOP if:** `5xx` or connection refused

---

### Step E2 — Authenticated App Health (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/en/app
```

**Expected:** `200` or `302`/`307` (redirect to login — expected when not authenticated via curl)  
**STOP if:** `5xx` or connection refused  
**Note:** Do NOT use preview as a health gate for this task

---

## F. BROWSER VALIDATION

ChatGPT will guide Keith through each case one at a time.  
For each case: open a fresh browser tab, paste the URL exactly as given, allow all redirects to complete, then report the final URL and what is visible on screen.

---

### Case A — Public English Landing

**Open:**
```
https://staging.ainow.biz/en
```

**Expected:**
- Correct approved public landing page loads
- "Build anything" hero text visible
- Canonical PublicLandingSlice experience displayed
- NOT legacy workspace
- No redirect to localhost
- No raw translation keys (e.g. `landing.hero.title`)
- No visible error

**Default answer if the above is present:** PASS  
**FAIL if:** legacy workspace appears, localhost redirect, raw keys, or error page

---

### Case B — Public zh-TW Landing

**Open:**
```
https://staging.ainow.biz/zh-TW
```

**Expected:**
- Canonical localized public landing page (Traditional Chinese)
- No raw translation keys
- No redirect to localhost
- No unexpected old page

**Default answer:** PASS  
**FAIL if:** localhost redirect, raw translation keys materially affecting display, or legacy workspace

---

### Case C — Public zh-CN Landing

**Open:**
```
https://staging.ainow.biz/zh-CN
```

**Expected:**
- Canonical localized public landing page (Simplified Chinese)
- No raw translation keys
- No redirect to localhost
- No unexpected old page

**Default answer:** PASS  
**FAIL if:** localhost redirect, raw translation keys materially affecting display, or legacy workspace

---

### Case D — Root Redirect

**Open:**
```
https://staging.ainow.biz/
```

**Expected final URL:**
```
https://staging.ainow.biz/en
```

**Default answer:** PASS  
**FAIL if:** redirect goes to localhost, or does not resolve to `/en`

---

### Case E — Authenticated /en/app (CRITICAL)

Sign in with the existing authorized test account if needed.

**Open:**
```
https://staging.ainow.biz/en/app
```

**Expected:**
- Canonical project-first workspace loads
- "Build anything" home visible
- WorkspaceSidebar present (left sidebar with project navigation)
- Legacy "Session-scoped workspace" UI is **NOT** visible
- No old direct session-picker workspace
- No visible feature-flag-dependent fallback
- No error

**Default answer:** PASS  
**FAIL if:** legacy workspace appears, old session-first sidebar visible, or error

**Note:** The already-known separate preview failure is NOT a failure of this landing/workspace task. Do not classify it as such.

---

### Case F — Authenticated zh-TW App

**Open:**
```
https://staging.ainow.biz/zh-TW/app
```

**Expected:**
- Canonical project-first workspace
- Localized UI (Traditional Chinese)
- Legacy workspace absent
- No raw translation keys materially affecting operation

**Default answer:** PASS  
**FAIL if:** legacy workspace appears

---

### Case G — Authenticated zh-CN App

**Open:**
```
https://staging.ainow.biz/zh-CN/app
```

**Expected:**
- Canonical project-first workspace
- Localized UI (Simplified Chinese)
- Legacy workspace absent
- No raw translation keys materially affecting operation

**Default answer:** PASS  
**FAIL if:** legacy workspace appears

---

### Case H — Rebuild-Independence Proof

This is not a separate browser test. It is a logical confirmation:

The deployed build was produced by ordinary `npm run build` in Step C5 **without** any `NEXT_PUBLIC_PROJECT_FIRST_UX` environment variable supplied. If Cases E/F/G show canonical project-first workspace, this proves that:

1. The canonical workspace is unconditional in the deployed code
2. Another normal frontend rebuild cannot restore the legacy path
3. The feature flag removal is complete and permanent

**Default answer:** PASS (if Cases E/F/G all PASS)  
**FAIL if:** Cases E/F/G show legacy workspace despite no flag being set

---

## G. LEGACY ABSENCE GATE

After completing browser Cases E/F/G, explicitly answer each question:

| # | Question | Expected Answer |
|---|---|---|
| 1 | Is "Session-scoped workspace" visible anywhere on `/en/app`? | **NO** |
| 2 | Is the old session-first sidebar visible? | **NO** |
| 3 | Is canonical WorkspaceSidebar visible? | **YES** |
| 4 | Is "Build anything" canonical home visible? | **YES** |

**If old workspace appears anywhere on `/en/app`:**  
→ **STOP — VERDICT = FAIL — Do not consolidate**

---

## H. FINAL HEALTH

### Step H1 — PM2 Final List (READ-ONLY)

```bash
pm2 list
```

**Expected:**
- `aisandbox-frontend` → `online`
- `aisandbox-api-gateway` → `online`, unchanged restart count from D1
- `aisandbox-ai-service` → `online`, unchanged restart count from D1
- `aisandbox-container-manager` → `online`, unchanged restart count from D1

---

### Step H2 — Frontend HTTP Final Check (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz/en
```

**Expected:** `200`

---

### Step H3 — Confirm Branch (READ-ONLY)

```bash
git branch --show-current
```

**Expected:** `main`

---

### Step H4 — Confirm Working Tree Clean (READ-ONLY)

```bash
git status
```

**Expected:** `nothing to commit, working tree clean`

---

### Step H5 — Confirm Final HEAD (READ-ONLY)

```bash
git rev-parse HEAD
```

**Expected:** `651f723447a85ec5d22139d6ba60be6680a0f8c6`

---

## VERDICT RULES

### PASS — All of the following must be true:

| # | Criterion |
|---|---|
| 1 | Fast-forward merge succeeded to `651f723` |
| 2 | Ordinary `npm run build` succeeded (no feature flag supplied) |
| 3 | `aisandbox-frontend` restarted and stable |
| 4 | Public landing `/en` shows canonical "Build anything" page |
| 5 | Public landing `/zh-TW` shows canonical localized landing |
| 6 | Public landing `/zh-CN` shows canonical localized landing |
| 7 | Root `/` redirects to `/en` (not localhost) |
| 8 | Authenticated `/en/app` shows canonical project-first workspace |
| 9 | Authenticated `/zh-TW/app` shows canonical project-first workspace |
| 10 | Authenticated `/zh-CN/app` shows canonical project-first workspace |
| 11 | Legacy "Session-scoped workspace" is absent everywhere |
| 12 | No localhost regression on any tested URL |
| 13 | No unrelated services restarted |
| 14 | Runtime remains healthy (pm2 list + HTTP 200) |
| 15 | Final staging HEAD = `651f723447a85ec5d22139d6ba60be6680a0f8c6` |

### FAIL — Any of the following:

| # | Trigger |
|---|---|
| 1 | Old/legacy workspace returns on any `/app` route |
| 2 | Build still depends on the removed feature flag |
| 3 | Public landing shows wrong page |
| 4 | Major locale failure (page broken, not just minor i18n gaps) |
| 5 | `aisandbox-frontend` fails to start or crashes repeatedly |
| 6 | Unexpected routing failure (localhost redirect) |

**The separate known preview failure is NOT part of this verdict.**

---

## After PASS

- Do NOT mark PRIVATE-BETA-BLOCKER-01 complete in this runbook.
- Step 4 consolidation still remains.
- PRIVATE-BETA-INVITE-01 remains BLOCKED regardless (separate preview failure is unresolved).

---

## After FAIL

- Execute rollback (Section B, Rollback Procedure) only if ChatGPT confirms it is rollback-worthy.
- Report exact failure evidence for triage.
- Do not attempt to fix on staging.

---

## Security Note

- No secrets are exposed or modified by this deployment.
- `.env` files are not touched.
- No database access or migration occurs.
- The backup file (`predeploy-state.txt`) contains only commit SHAs and PM2 process names — no secrets.

---

*Runbook prepared by Cursor/Opus 4.6 — 2026-08-09*  
*Do not modify this file during execution. It is a READ-ONLY execution guide.*
