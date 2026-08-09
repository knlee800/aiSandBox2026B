# PRIVATE-BETA-BLOCKER-02 Step 3A — Controlled Staging Deployment + Live Preview Validation Runbook

**Task:** PRIVATE-BETA-BLOCKER-02  
**Step:** 3A — Controlled Staging Deployment + Live Preview Validation  
**Status:** Ready for Keith execution  
**Date prepared:** 2026-08-09  
**Executor:** Keith via AWS Lightsail browser SSH terminal  
**AI guide during execution:** ChatGPT (one command at a time)

---

## Fix Being Deployed

**Problem:** API Gateway preview proxy incorrectly defaulted to `http://localhost:4001` (AI Service port) when `CONTAINER_MANAGER_URL` was not defined in the environment. Staging does not set `CONTAINER_MANAGER_URL`, so all preview requests (`/api/preview/:sessionId/status`, `/api/preview/:sessionId/start`, `/api/preview/:sessionId/proxy*`) were forwarded to AI Service, which returned Nest 404 route-not-found errors.

**Fix commit:** `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883`  
**Short SHA:** `f73da07`  
**Commit message:** `fix(preview): route preview proxy to container manager`  
**Expected staging predecessor HEAD:** `651f723447a85ec5d22139d6ba60be6680a0f8c6`

**Intervening commits (staging HEAD → fix commit):**

| Order | Short SHA | Message | Type |
|---|---|---|---|
| 1 | `350b789` | `docs: consolidate admin console and private beta blocker readiness` | Governance only |
| 2 | `f73da07` | `fix(preview): route preview proxy to container manager` | Implementation |

**Full SHAs:**
- `350b789fcd054623169c41b1f8d83c7ee79adcb0`
- `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883`

**Production files changed (Step 2):**

| File | Change |
|---|---|
| `services/api-gateway/.env.example` | Added `CONTAINER_MANAGER_URL=http://localhost:4002` |
| `services/api-gateway/src/preview/preview.controller.ts` | Changed fallback from `4001` to `4002` |

**New tests:**

| File |
|---|
| `services/api-gateway/src/preview/__tests__/preview.endpoint-contract.spec.ts` |
| `services/api-gateway/src/preview/__tests__/preview.proxy-target.spec.ts` |

**Governance commit also introduces:** documentation/checkpoint files in `docs/` and updates to `TASKS.md` / `TASKS_BACKLOG_FULL.md`.

**Local validation:** 43/43 preview tests PASS, 3/3 proxy-target PASS, 5/5 endpoint-contract PASS, 35/35 guard/security PASS, TypeScript PASS, API Gateway build PASS.

---

## Deployment Scope

**API Gateway only. No other services.**

| Service | Action |
|---|---|
| `aisandbox-api-gateway` | build + pm2 restart |
| `aisandbox-frontend` | ❌ do NOT touch |
| `aisandbox-ai-service` | ❌ do NOT touch |
| `aisandbox-container-manager` | ❌ do NOT touch |
| PostgreSQL | ❌ do NOT touch |
| Migrations | ❌ do NOT run |
| `.env` files | ❌ do NOT modify |
| Caddy | ❌ do NOT touch |
| `GLOBAL_EXECUTION_ENABLED` | ❌ do NOT change |
| Docker | ❌ do NOT touch |
| Redis | ❌ do NOT touch |

**IMPORTANT:** Do NOT add `CONTAINER_MANAGER_URL` to staging `.env`. The fix works using the corrected source default `http://localhost:4002`. The `.env.example` change is documentation only.

---

## Protocol

Keith runs **one command at a time** in the Lightsail browser SSH terminal.  
After each command, Keith copies the full output to ChatGPT.  
ChatGPT returns: **PASS → proceed** or **STOP → do not continue**.  
Do not proceed to the next step without a PASS.

---

## A. PRE-DEPLOY SAFETY GATES

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

**Expected:** `651f723447a85ec5d22139d6ba60be6680a0f8c6`  
**Copy SHA to ChatGPT.**

If the SHA matches `651f723447a85ec5d22139d6ba60be6680a0f8c6` → continue.  
If the SHA matches `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883` → already deployed; skip to Section D (PM2 / Health).  
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

**Expected:** Top commit is `f73da07` with message `fix(preview): route preview proxy to container manager`  
**STOP if:** `f73da07` is NOT in the top 5 commits on `origin/main`

---

### Step A7 — Inspect Commits to Merge (READ-ONLY — CRITICAL GATE)

```bash
git log --oneline HEAD..origin/main
```

**Expected:** Exactly two commits:
```
f73da07 fix(preview): route preview proxy to container manager
350b789 docs: consolidate admin console and private beta blocker readiness
```

**STOP if:**
- More than two commits would be merged (unexpected commits)
- Zero commits (already up to date — skip to Section D)
- Any commit not matching the expected two above

---

### Step A8 — Inspect File-Level Changes (READ-ONLY)

```bash
git diff --stat HEAD..origin/main
```

**Expected files (governance + implementation):**
```
 TASKS.md
 TASKS_BACKLOG_FULL.md
 docs/ADMIN-CONSOLE-01-CHECKPOINT.md
 docs/ADMIN-CONSOLE-01E-CHECKPOINT.md
 docs/ADMIN-CONSOLE-01E-STEP3-RUNBOOK.md
 docs/ADMIN-CONSOLE-01E1-CHECKPOINT.md
 docs/ADMIN-CONSOLE-01E1-STEP3-RUNBOOK.md
 docs/PRIVATE-BETA-BLOCKER-01-CHECKPOINT.md
 docs/PRIVATE-BETA-BLOCKER-01-STEP3-RUNBOOK.md
 services/api-gateway/.env.example
 services/api-gateway/src/preview/__tests__/preview.endpoint-contract.spec.ts
 services/api-gateway/src/preview/__tests__/preview.proxy-target.spec.ts
 services/api-gateway/src/preview/preview.controller.ts
```

**All files are expected.** Governance docs are from the `350b789` docs commit. API Gateway files are the implementation.

**STOP if:** unexpected runtime source files appear (anything outside `docs/`, `TASKS*`, or the listed `services/api-gateway/` files)

---

### Step A9 — Inspect Preview Controller Diff Specifically (READ-ONLY)

```bash
git diff HEAD..origin/main -- services/api-gateway/src/preview/preview.controller.ts
```

**Expected:** Single-line change — fallback URL changed from `http://localhost:4001` to `http://localhost:4002`  
**STOP if:** any other production logic change appears in this file

---

## B. BACKUP / ROLLBACK PREPARATION

### Step B1 — Create Backup Directory (MUTATING — FILESYSTEM)

```bash
sudo mkdir -p /opt/aisandbox-backups/private-beta-blocker-02
```

**Expected:** directory created (or already exists)

---

### Step B2 — Set Ownership (MUTATING — FILESYSTEM)

```bash
sudo chown ubuntu:ubuntu /opt/aisandbox-backups/private-beta-blocker-02
```

**Note:** Only changes ownership of the task-specific directory. Does NOT alter `/opt/aisandbox-backups` root ownership.

---

### Step B3 — Record Pre-Deploy State (READ-ONLY → WRITE TO BACKUP)

```bash
echo "=== PRE-DEPLOY SNAPSHOT ===" > /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "Date: $(date -u)" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "HEAD: $(git rev-parse HEAD)" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "=== git log -5 ===" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
git log --oneline -5 >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "=== pm2 list ===" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
pm2 list >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
echo "=== git status ===" >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
git status >> /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
```

**Expected:** file written without error

---

### Step B4 — Verify Backup File (READ-ONLY)

```bash
cat /opt/aisandbox-backups/private-beta-blocker-02/predeploy-state.txt
```

**Expected:** contains HEAD SHA `651f723...`, git log, pm2 process list, clean status  
**Copy output to ChatGPT for the record**

---

### Step B5 — Back Up Current API Gateway dist Build (MUTATING — FILESYSTEM)

```bash
cp -a /opt/aisandbox/services/api-gateway/dist /opt/aisandbox-backups/private-beta-blocker-02/dist-backup
```

**Expected:** copy completes without error  
**Note:** Preserves current build artifacts for rollback if needed

---

### Rollback Procedure (DO NOT EXECUTE — REFERENCE ONLY)

If a rollback-worthy failure is detected after deployment, execute these commands:

```bash
# 1. Revert git to pre-deploy HEAD
cd /opt/aisandbox && git reset --hard 651f723447a85ec5d22139d6ba60be6680a0f8c6

# 2. Restore previous build artifacts
rm -rf /opt/aisandbox/services/api-gateway/dist
cp -a /opt/aisandbox-backups/private-beta-blocker-02/dist-backup /opt/aisandbox/services/api-gateway/dist

# 3. Restart API Gateway only
pm2 restart aisandbox-api-gateway
```

**Do NOT execute rollback unless ChatGPT explicitly confirms a rollback-worthy failure.**

---

## C. SOURCE DEPLOYMENT

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

**Expected:** `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883`  
**STOP if:** HEAD does not match this exact SHA

---

### Step C3 — Verify Working Tree Clean After Merge (READ-ONLY)

```bash
git status
```

**Expected:** `nothing to commit, working tree clean`  
**STOP if:** uncommitted changes exist

---

## D. STATIC SOURCE VERIFICATION

### Step D1 — Verify Preview Controller Contains Correct Fallback (READ-ONLY)

```bash
grep -n "localhost:4002" /opt/aisandbox/services/api-gateway/src/preview/preview.controller.ts
```

**Expected:** Line containing `process.env.CONTAINER_MANAGER_URL || 'http://localhost:4002'`  
**STOP if:** no match found

---

### Step D2 — Verify Preview Controller Does NOT Contain Old Fallback (READ-ONLY)

```bash
grep -n "localhost:4001" /opt/aisandbox/services/api-gateway/src/preview/preview.controller.ts
```

**Expected:** No output (zero matches)  
**Note:** Do NOT flag `localhost:4001` references in other files — only this specific controller matters.  
**STOP if:** any match found in `preview.controller.ts`

---

### Step D3 — Verify .env.example Contains Documentation (READ-ONLY)

```bash
grep "CONTAINER_MANAGER_URL" /opt/aisandbox/services/api-gateway/.env.example
```

**Expected:** `CONTAINER_MANAGER_URL=http://localhost:4002`

---

## E. API GATEWAY BUILD

### Step E1 — Build API Gateway (MUTATING — BUILD ARTIFACTS)

```bash
cd /opt/aisandbox/services/api-gateway && npm run build
```

**Expected:** Build completes without error  
**STOP if:** Build fails — report full error to ChatGPT. Do NOT restart services with a failed build.

---

### Step E2 — Verify Build Output Exists (READ-ONLY)

```bash
ls -la /opt/aisandbox/services/api-gateway/dist/src/preview/preview.controller.js
```

**Expected:** File exists with recent timestamp  
**STOP if:** file missing

---

### Step E3 — Verify Compiled Output Contains Correct Fallback (READ-ONLY)

```bash
grep "localhost:4002" /opt/aisandbox/services/api-gateway/dist/src/preview/preview.controller.js
```

**Expected:** Match found containing `http://localhost:4002`

---

### Step E4 — Verify Compiled Output Does NOT Contain Old Fallback (READ-ONLY)

```bash
grep "localhost:4001" /opt/aisandbox/services/api-gateway/dist/src/preview/preview.controller.js
```

**Expected:** No output (zero matches)  
**STOP if:** any match found

---

## F. PM2 RESTART

### Step F1 — Record PM2 State Before Restart (READ-ONLY)

```bash
pm2 list
```

**Copy full output to ChatGPT.** Record restart counts for all services.

---

### Step F2 — Restart API Gateway Only (MUTATING — SERVICE)

```bash
pm2 restart aisandbox-api-gateway
```

**Expected:** Restart completes without error  
**Do NOT use `--update-env`**

---

### Step F3 — Verify PM2 State After Restart (READ-ONLY)

```bash
pm2 list
```

**Verify:**
- `aisandbox-api-gateway` — status `online`, restart count incremented by exactly 1
- `aisandbox-frontend` — restart count UNCHANGED
- `aisandbox-ai-service` — restart count UNCHANGED
- `aisandbox-container-manager` — restart count UNCHANGED

**STOP if:** API Gateway not online, or any other service was affected

---

## G. HEALTH CHECKS

### Step G1 — API Gateway Health (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health
```

**Expected:** `200`  
**STOP if:** non-200 response

---

### Step G2 — API Gateway Health Full Response (READ-ONLY)

```bash
curl -s http://127.0.0.1:4000/api/health
```

**Copy output to ChatGPT.** Confirm healthy.

---

### Step G3 — Public Frontend Health (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz
```

**Expected:** `200` (or `302` redirect to locale)  
**Note:** Frontend was NOT rebuilt/restarted. This verifies it remains accessible.

---

## H. LIVE PREVIEW VALIDATION (BROWSER)

**This is the critical validation section.**

Keith will perform browser actions manually with ChatGPT guiding one step at a time.

### Prerequisites

- Use an existing authenticated test account
- Use an existing test project/session that contains previewable content
- Do NOT create unnecessary users or projects
- Open browser DevTools Network tab before starting

---

### Case A — Load Canonical App

**Action:** Open `https://staging.ainow.biz/en/app` in browser

**Expected:**
- Canonical project-first workspace loads
- No legacy workspace regression
- Authenticated session active
- Existing projects visible

**STOP if:** workspace fails to load or auth session is invalid

---

### Case B — Open a Project with Preview

**Action:** Select an existing safe test project/session containing previewable content (e.g., a simple HTML/React project previously created during testing)

**Record for ChatGPT:**
- Project name/identifier if visible
- Session ID if discoverable through URL or DevTools

**Do NOT mutate unrelated project data.**

---

### Case C — Preview Status Check (CRITICAL)

**Action:** Open/trigger the Preview panel in the workspace

**DevTools Network observation:** Look for:
```
GET /api/preview/:sessionId/status
```

**Expected (fix verified):**
- Response does NOT return a Nest 404 route-not-found error
- Response comes from container-manager (not AI Service)
- Acceptable responses include:
  - `200` with running/ready state
  - `200` with stopped/not-started state the frontend understands
  - A container-manager-specific response (even an error from container-manager proves routing works)

**STOP (routing still broken) if:**
- HTTP 404 with Nest-style `{"statusCode":404,"message":"Cannot GET /api/preview/...","error":"Not Found"}`
- Response clearly from wrong service

**How to distinguish:**
- Nest 404 from wrong service = routing still broken → **STOP**
- Non-404 response or container-manager error = routing fix works → continue

---

### Case D — Start Preview

**Action:** If preview is not already running, use the normal "Start Preview" UI button

**DevTools Network observation:** Look for:
```
POST /api/preview/:sessionId/start
```

**Expected:**
- Request reaches container-manager
- Response is NOT a Nest route-not-found 404
- Acceptable: `200`/`201` with state response, or a container-manager-specific error

**Record for ChatGPT:**
- HTTP status code
- Response body (first ~200 chars if long)
- Whether frontend begins status polling

**STOP if:** Same route-not-found 404 pattern (routing still broken)

---

### Case E — Status Polling

**Action:** After starting preview, observe DevTools for polling requests

**DevTools Network observation:** Look for repeated:
```
GET /api/preview/:sessionId/status
```

**Expected:**
- Polling requests return responses from container-manager
- Eventually reports running/ready state, OR a legitimate container-manager preview error

**Critical distinction:**

| Scenario | Verdict |
|---|---|
| Requests reach container-manager and preview starts | ROUTING FIX WORKS + PREVIEW WORKS |
| Requests reach container-manager but preview fails for other reason | ROUTING FIX WORKS / NEW DEFECT |
| Requests still return Nest 404 from wrong service | ROUTING FIX FAILED |

**If a new independent defect appears:** Record it and proceed to Second-Defect Rule (Section I).

---

### Case F — Preview Content / Proxy

**Action:** If preview reaches running state, observe the preview iframe

**DevTools Network observation:** Look for:
```
GET /api/preview/:sessionId/proxy...
```

**Expected:**
- Preview content visible in iframe
- No 404 from AI Service
- No `localhost` URL leak in iframe src
- Iframe remains on staging origin / API proxy path
- No auth/security bypass indicators

**STOP if:** proxy requests still return wrong-service 404

---

### Case G — Refresh Preview

**Action:** Use normal "Refresh Preview" action in the UI

**Expected:**
- Status refresh works
- Preview content reloads
- No wrong-service 404

---

## I. SECOND-DEFECT STOP RULE

**If the 4001→4002 routing fix succeeds** (requests reach container-manager) **but another preview problem appears:**

**DO NOT PATCH IT ON STAGING.**

Record:
- Exact endpoint URL
- HTTP status code
- Response body/error message
- Browser symptom (what user sees)
- Container-manager evidence if safely observable (`pm2 logs aisandbox-container-manager --lines 20`)

**Verdict:** `PASS FOR ROUTING FIX / BLOCKED BY NEW DEFECT`

Then recommend a bounded child blocker task. Do not hide or combine failures.

---

## J. SECURITY GATE

**Rely on existing 35/35 local guard/security test results.**

During browser validation, confirm:
- Normal authenticated owner flow succeeds (Cases A–G use authenticated session)
- No security bypass indicators in DevTools

Do NOT:
- Intentionally bypass auth
- Test unauthorized access patterns live on staging
- Create test users solely for security testing

If existing runbook conventions safely allow read-only verification without creating data:
- Verify that hitting `/api/preview/nonexistent-session/status` without auth returns 401/403 (not preview content)
- This is optional and only if safely doable without side effects

---

## K. FINAL HEALTH

### Step K1 — Final PM2 State (READ-ONLY)

```bash
pm2 list
```

**Verify:** All services in expected state. API Gateway online.

---

### Step K2 — Final API Health (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health
```

**Expected:** `200`

---

### Step K3 — Final Frontend Health (READ-ONLY)

```bash
curl -s -o /dev/null -w "%{http_code}" https://staging.ainow.biz
```

**Expected:** `200` or `302`

---

### Step K4 — Final Branch and HEAD (READ-ONLY)

```bash
git branch --show-current && git rev-parse HEAD
```

**Expected:**
```
main
f73da07ef8d1acc70d43d6b4980fd1d0d57e2883
```

---

### Step K5 — Final Working Tree (READ-ONLY)

```bash
git status
```

**Expected:** `nothing to commit, working tree clean`

---

## L. VERDICT CRITERIA

### PASS — PRIVATE-BETA-BLOCKER-02 Resolved

All of the following must be true:
- [x] Expected source history deployed (2 commits: `350b789` + `f73da07`)
- [x] API Gateway build succeeds
- [x] Only API Gateway restarted
- [x] API Gateway healthy (HTTP 200)
- [x] Old preview wrong-service Nest 404 is gone
- [x] `GET /api/preview/:sessionId/status` reaches container-manager
- [x] `POST /api/preview/:sessionId/start` reaches container-manager
- [x] `GET /api/preview/:sessionId/proxy*` loads preview content
- [x] Preview content successfully visible in iframe
- [x] No security regression

### PARTIAL PASS — Routing Fix Works, New Defect Found

If routing fix works (requests reach container-manager) but preview fails for an independent reason:
- Mark PRIVATE-BETA-BLOCKER-02 routing fix as **VERIFIED WORKING**
- Do NOT mark overall task PASS
- Record the new defect
- Recommend a bounded child blocker

### FAIL — Routing Fix Did Not Work

If preview requests still return wrong-service 404 after deployment:
- Consider rollback
- Report failure details
- Do NOT expand scope on staging

---

## M. ROLLBACK TRIGGERS

Execute rollback (Section B, Rollback Procedure) ONLY if:

1. API Gateway fails to start after restart
2. API Gateway health returns non-200 persistently
3. Preview requests still return wrong-service 404 (routing fix ineffective)
4. Frontend or other services become unreachable after API Gateway restart
5. Any critical regression in non-preview API Gateway functionality

**Do NOT rollback if:**
- Routing fix works but a new independent preview defect appears
- Container-manager is down/unhealthy (not caused by this deployment)
- Non-preview functionality is unaffected

**Rollback must be confirmed by ChatGPT before execution.**

---

## Appendix: Service Port Reference

| Service | Port | PM2 Name |
|---|---|---|
| API Gateway | 4000 | `aisandbox-api-gateway` |
| AI Service | 4001 | `aisandbox-ai-service` |
| Container Manager | 4002 | `aisandbox-container-manager` |
| Frontend | 3000 | `aisandbox-frontend` |

---

## Appendix: First Command

Keith's exact first command:

```bash
cd /opt/aisandbox && pwd
```
