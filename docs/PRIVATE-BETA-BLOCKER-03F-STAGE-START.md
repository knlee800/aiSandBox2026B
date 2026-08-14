# PRIVATE-BETA-BLOCKER-03F — Stage Start / Deployment-Parity Plan

**Task ID:** PRIVATE-BETA-BLOCKER-03F
**Title:** Staging Deployment Parity for 03D Accounting Confirmation Path
**Status:** Step 2 — Stage Start / Deployment-Parity Plan — COMPLETE — 2026-08-14
**Family:** PRIVATE-BETA-BLOCKER-03 / BUILDER EXECUTION RELIABILITY / STAGING DEPLOYMENT PARITY
**Workflow:** HIGH-RISK 4-STEP
**Author:** Cursor / Opus 4.6 (read-only staging inspection + governance — no source modification — no runtime mutation — no provider call — no balance mutation — no deployment)

---

## 1. Task Identity / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03F |
| Title | Staging Deployment Parity for 03D Accounting Confirmation Path |
| Status | Step 2 COMPLETE — 2026-08-14 |
| Workflow | HIGH-RISK 4-STEP |
| Step 1 | Registration — COMPLETE — 2026-08-14 |
| Step 2 | Stage Start / Deployment-Parity Plan — COMPLETE — 2026-08-14 |
| Step 3 | Controlled Provider-Free Staging Deployment + Verification — PENDING / READY |
| Step 4 | Consolidation / Checkpoint — PENDING |

---

## 2. Blocker Classification

**STAGING DEPLOYMENT PARITY BLOCKER**

PRIVATE-BETA-E2E-02 FAILED because the staging deployment exercised the OLD accounting path:

```
AI completion → finalize-accounting → triggerDeductionForExecution() → immediate deduction
```

instead of the committed 03D path:

```
Build completion → build_awaiting_apply → no deduction
→ successful workspace apply → authenticated confirm-build-apply
→ internal Gateway confirmation → qualifying validation → exactly-once deduction
```

The 03D implementation is COMPLETE AND COMMITTED locally (commit `fd5e62d`). The gap is deployment parity only. 03F is NOT a new accounting implementation task.

---

## 3. Local Revision / Implementation Baseline

### 3.1 Revision Identity

| Field | Value |
|-------|-------|
| LOCAL_HEAD | `ed34e3c220c04c81ec6784f43e8952a60f537825` |
| LOCAL_HEAD_ONELINE | `ed34e3c checkpoint: prepare E2E-02 controlled run` |
| 03D_COMMIT | `fd5e62d` ("checkpoint: complete 03D credit policy") |
| ANCESTOR_CHECK | `git merge-base --is-ancestor fd5e62d HEAD` → exit code 0 — **ANCESTOR=YES** |
| LOCAL_PUSH_STATE | **8 commits ahead of origin/main** — NOT YET PUSHED |

### 3.2 Tracked Files

All 8 required 03D implementation files are tracked and committed:

| File | git ls-files | Status |
|------|-------------|--------|
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | TRACKED | COMMITTED |
| `services/api-gateway/src/ai/internal-accounting.controller.ts` | TRACKED | COMMITTED |
| `services/api-gateway/src/ai/dto/confirm-build-apply.dto.ts` | TRACKED | COMMITTED |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | TRACKED | COMMITTED |
| `frontend/app/[locale]/app/page.tsx` | TRACKED | COMMITTED |
| `frontend/components/workspace/workspace-ai-file-actions.logic.ts` | TRACKED | COMMITTED |
| `frontend/lib/build-apply-confirm-proxy.server.ts` | TRACKED | COMMITTED |
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | TRACKED | COMMITTED |

### 3.3 Source Pattern Verification

| Pattern | File | Matches | Status |
|---------|------|---------|--------|
| `build_awaiting_apply` | usage-ledger.service.ts | 3 | PRESENT |
| `triggerBuildApplyDeduction` | usage-ledger.service.ts | 2 | PRESENT |
| `confirm-build-apply` | internal-accounting.controller.ts | 3 | PRESENT |
| `ConfirmBuildApplyDto` | confirm-build-apply.dto.ts | 1 | PRESENT |
| `proxyConfirmBuildApply` | build-apply-confirm-proxy.server.ts | 1 | PRESENT |
| `INTERNAL_SERVICE_KEY` | build-apply-confirm-proxy.server.ts | 4 | PRESENT |
| `confirmBuildApplyIfQualifying` | page.tsx | 2 | PRESENT |
| `proxyConfirmBuildApply` | confirm-build-apply/route.ts | 2 | PRESENT |

**All required 03D patterns confirmed present in committed local source.**

---

## 4. Staging Revision Identity

### 4.1 SSH Inspection Results

| Field | Value |
|-------|-------|
| Application root | `/opt/aisandbox` |
| Git toplevel | `/opt/aisandbox` |
| STAGING_GIT_REVISION | `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883` |
| STAGING_ONELINE | `f73da07 fix(preview): route preview proxy to container manager` |
| STAGING_BRANCH | `main` |
| STAGING_WORKTREE | **DIRTY** |
| Staging origin/main | `f73da07` (same as staging HEAD — staging has not fetched recently) |

### 4.2 Dirty Working-Tree Files

**Modified (22):**

| # | File |
|---|------|
| 1 | `frontend/app/[locale]/app/page.tsx` |
| 2 | `frontend/components/workspace/workspace-ai-file-actions.logic.ts` |
| 3 | `frontend/components/workspace/workspace-file-navigation.logic.ts` |
| 4 | `frontend/components/workspace/workspace-shell.tsx` |
| 5 | `frontend/lib/ai/provider-model.catalogue.ts` |
| 6 | `frontend/messages/en.json` |
| 7 | `frontend/messages/zh-CN.json` |
| 8 | `frontend/messages/zh-TW.json` |
| 9 | `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` |
| 10 | `services/ai-service/src/ai-execution/ai-execution.service.ts` |
| 11 | `services/ai-service/src/ai-execution/file-actions.parser.ts` |
| 12 | `services/ai-service/src/ai-execution/provider-model.catalogue.ts` |
| 13 | `services/ai-service/src/ai-execution/types.ts` |
| 14 | `services/ai-service/src/queue/job.types.ts` |
| 15 | `services/ai-service/src/worker/worker.processor.ts` |
| 16 | `services/api-gateway/src/ai/ai-execution.controller.ts` |
| 17 | `services/api-gateway/src/ai/provider-model.catalogue.ts` |
| 18 | `services/api-gateway/src/clients/ai-service-http.client.ts` |
| 19 | `services/api-gateway/src/clients/container-manager-http.client.ts` |
| 20 | `services/api-gateway/src/sessions/internal-session.controller.ts` |
| 21 | `services/container-manager/src/clients/api-gateway-http.client.ts` |
| 22 | `services/container-manager/src/sessions/sessions.service.ts` |

**Untracked (2):**

| # | File |
|---|------|
| 1 | `frontend/components/workspace/workspace-execution-intent.logic.ts` |
| 2 | `monitoring/watchdog/` |

These dirty-tree modifications correspond to non-03D production changes from commits `8a603ee` (builder file-action reliability) and `0b47bab` (builder intent / session lifecycle reliability). These changes are **already running** on staging.

---

## 5. Deployed Source Parity

### 5.1 API Gateway — 03D Parity

| # | Feature | Local | Staging | Status |
|---|---------|-------|---------|--------|
| 1 | `workspace_mutation` Build gating (`readPersistedExecutionIntent`) | PRESENT | **0 matches** for `workspace_mutation` in usage-ledger.service.ts | **ABSENT** |
| 2 | `build_awaiting_apply` deferred gate | PRESENT (3 matches) | **0 matches** | **ABSENT** |
| 3 | `triggerBuildApplyDeduction` method | PRESENT (2 matches) | **0 matches** | **ABSENT** |
| 4 | `confirm-build-apply` internal route | PRESENT (3 matches) | **0 matches** | **ABSENT** |
| 5 | `confirm-build-apply.dto.ts` DTO file | PRESENT | File does not exist | **ABSENT** |
| 6 | `InternalServiceAuthGuard` on confirm route | PRESENT (for confirm route) | 1 match (for existing `finalize-accounting` only) | **ABSENT** (guard exists but not for confirm route) |
| 7 | Authoritative persisted `fileActions/count` validation | PRESENT | No `triggerBuildApplyDeduction` → no validation chain | **ABSENT** |
| 8 | Execution ownership enforcement in `getExecution()` | PRESENT (`user_id !== identity.userId`) | Pre-existing `NotFoundException('Execution not found')` for not-found only; no `user_id` ownership check | **ABSENT** |

**GATEWAY 03D PARITY: ALL 8 CHECKS ABSENT**

### 5.2 Frontend — 03D Parity

| # | Feature | Local | Staging | Status |
|---|---------|-------|---------|--------|
| 1 | `build-apply-confirm-proxy.server.ts` | PRESENT | File does not exist | **ABSENT** |
| 2 | `confirm-build-apply` Next.js route | PRESENT | File does not exist | **ABSENT** |
| 3 | `qualifyBuildApplyConfirmation` logic | PRESENT | 0 matches for `confirmBuildApplyIfQualifying` in page.tsx | **ABSENT** |
| 4 | `page.tsx` confirmation invocation | PRESENT (2 matches) | 0 matches | **ABSENT** |
| 5 | Server-only `INTERNAL_SERVICE_KEY` use | PRESENT (4 matches in proxy) | Proxy file absent | **ABSENT** |

**FRONTEND 03D PARITY: ALL 5 CHECKS ABSENT**

### 5.3 Parity Summary

**TOTAL: 0/13 present on staging. ALL 03D features ABSENT.**

The staging deployment exercises the pre-03D immediate deduction path. The 03D deferred-deduction confirmation architecture does not exist on staging in any form.

---

## 6. Exact Revision / Source Delta

### 6.1 Commit Range

```
f73da07 (staging) → eb5cd5c → 62e64fe → a67772c → 0d56915 → 8a603ee → 0b47bab → 66b3c95 → fd5e62d → ed34e3c (local HEAD)
```

| Commit | Message | Classification |
|--------|---------|---------------|
| `eb5cd5c` | docs: consolidate private beta preview blocker | governance/docs only |
| `62e64fe` | docs: reconcile architecture and product requirements | governance/docs only |
| `a67772c` | docs: register and document PRIVATE-BETA-OPS-01 | governance/docs only |
| `0d56915` | docs: document and finalize PRIVATE-BETA-EXEC-01 | governance/docs only |
| `8a603ee` | checkpoint: builder file-action reliability and execution intent | **unrelated production source** — ALREADY DEPLOYED on staging via dirty worktree |
| `0b47bab` | checkpoint: builder intent and session lifecycle reliability | **unrelated production source** — ALREADY DEPLOYED on staging via dirty worktree |
| `66b3c95` | checkpoint: complete 03C and 03D-A accounting gate | **required 03D-A production changes** + tests |
| `fd5e62d` | checkpoint: complete 03D credit policy | **required 03D-A/03D-B production changes** + tests |
| `ed34e3c` | checkpoint: prepare E2E-02 controlled run | governance/docs only |

### 6.2 Classification Summary

| Category | Commits | Status |
|----------|---------|--------|
| Required 03D-A/03D-B production changes | `66b3c95`, `fd5e62d` | NOT ON STAGING — deployment required |
| Tests | included in `66b3c95`, `fd5e62d` | NOT ON STAGING — deployment required |
| Governance/docs only | `eb5cd5c`, `62e64fe`, `a67772c`, `0d56915`, `ed34e3c` | Safe — no runtime impact |
| Unrelated production source | `8a603ee`, `0b47bab` | **ALREADY RUNNING on staging** via dirty worktree |

### 6.3 Unrelated-Production-Change Evaluation

Deploying current HEAD (`ed34e3c`) would formally introduce commits `8a603ee` and `0b47bab` into the staging git history. However, the production source changes from these commits are **already deployed and running** on staging via dirty working-tree modifications. The PM2 processes were rebuilt and restarted with these modifications on Aug 14.

**Deploying HEAD does NOT introduce genuinely new unrelated production behavior.** It formalizes the already-running state in git history.

### 6.4 HEAD vs fd5e62d Delta

```
git diff --stat fd5e62d..HEAD
 TASKS.md                                |  240 +++++-
 TASKS_BACKLOG_FULL.md                   |  238 +++++-
 docs/PRIVATE-BETA-E2E-02-STAGE-START.md | 1345 +++++++++++++++++++++++++++++++
 3 files changed, 1820 insertions(+), 3 deletions(-)
```

HEAD (ed34e3c) differs from fd5e62d ONLY by governance/docs. **Zero production source changes.**

### 6.5 Determination

| Question | Answer |
|----------|--------|
| **SAFE_TO_DEPLOY_CURRENT_HEAD** | **YES** |
| Reason | HEAD adds only governance/docs over fd5e62d; non-03D production changes from intermediate commits are already deployed and running on staging |

---

## 7. Actual Existing Deployment Mechanism

### 7.1 Mechanism Description

**DEPLOYMENT_MECHANISM:** Manual source update via git pull → service-specific `npm run build` → PM2 restart

No ecosystem.config.js, no deploy scripts, no CI/CD pipeline found. PM2 processes were started and are managed manually.

The staging working tree has been previously updated by manual file modifications (dirty worktree). The established pattern is:

1. Push commits to GitHub remote (`origin`)
2. SSH to staging
3. Update source via git operations
4. Run `npm run build` for affected services
5. Run `pm2 restart <process-name>`

### 7.2 API Gateway

| Property | Value |
|----------|-------|
| Source directory | `/opt/aisandbox/services/api-gateway/` |
| Build command | `npm run build` → `tsc` |
| Output directory | `/opt/aisandbox/services/api-gateway/dist/` |
| PM2 process name | `aisandbox-api-gateway` |
| PM2 id | 3 |
| Script path | `/opt/aisandbox/services/api-gateway/dist/src/main.js` |
| Exec cwd | `/opt/aisandbox/services/api-gateway` |
| Restart command | `pm2 restart aisandbox-api-gateway` |
| Health endpoint | `curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/health` → expected `200` |
| Node version | 20.20.2 |
| node_env | production |
| Current dist dates | `internal-accounting.controller.js`: Jul 27; `usage-ledger.service.js`: Jul 27; `ai-execution.controller.js`: Aug 14 |
| Expected build duration | < 30 seconds |
| Build risks | Incremental `tsc` may not recompile all files; recommend clean rebuild |

### 7.3 Frontend

| Property | Value |
|----------|-------|
| Source directory | `/opt/aisandbox/frontend/` |
| Build command | `npm run build` → `next build` |
| Output directory | `/opt/aisandbox/frontend/.next/` |
| PM2 process name | `aisandbox-frontend` |
| PM2 id | 2 |
| Script path | `/usr/bin/npm start -- --hostname 127.0.0.1 --port 3002` |
| Exec cwd | `/opt/aisandbox/frontend` |
| Restart command | `pm2 restart aisandbox-frontend` |
| Health check | `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002` → expected `307` (redirect) |
| Node version | 20.20.2 |
| node_env | production |
| Current .next/BUILD_ID date | Aug 14 12:59 |
| Expected build duration | 1–3 minutes |
| Build risks | `next build` is a full rebuild; may take memory; possible OOM on constrained instance |

---

## 8. Minimum Safe Deployment Unit

**Selected: Option B** — Deploy current repo HEAD (`ed34e3c`) because:

1. HEAD contains all required 03D-A/03D-B production changes (from `fd5e62d`, ancestor of HEAD)
2. HEAD differs from `fd5e62d` only by governance/docs — zero additional production source
3. Non-03D production changes from intermediate commits (`8a603ee`, `0b47bab`) are already deployed and running on staging via dirty worktree
4. Deploying HEAD formalizes the already-running state in clean git history
5. This is the simplest safe existing mechanism — no cherry-picking, no ad-hoc file copying

**Services requiring rebuild/restart:**

| Service | Rebuild Required | Restart Required | Reason |
|---------|-----------------|-----------------|--------|
| API Gateway | YES | YES | 03D-A changes to usage-ledger.service.ts, internal-accounting.controller.ts, confirm-build-apply.dto.ts; 03D-B ownership enforcement in ai-execution.controller.ts |
| Frontend | YES | YES | 03D-B changes: build-apply-confirm-proxy.server.ts (new), confirm-build-apply route.ts (new), page.tsx, workspace-ai-file-actions.logic.ts |
| AI Service | NO | NO | No 03D changes; existing dirty-worktree state already running |
| Container Manager | NO | NO | No 03D changes; existing dirty-worktree state already running |
| Ops Watchdog | NO | NO | No 03D changes |

---

## 9. Dependency / Build Impact

| Requirement | Needed? | Evidence |
|-------------|---------|----------|
| npm install (Gateway) | **NO** | `git diff f73da07..fd5e62d -- services/api-gateway/package.json` → empty diff |
| npm install (Frontend) | **NO** | `frontend/package.json` diff: only test script glob changed (`lib/*.test.ts` added); no dependency changes |
| Database migration | **NO** | No new migration files in 03D commits; latest migration `1772900000000-AddAdminGrantAuditColumns.ts` from Aug 8, pre-existing |
| Schema change | **NO** | No new tables, no new columns; `executionIntent` and `fileActions[]` already present in `usage_records.metadata.aiExecutionResult` JSONB |
| Redis change | **NO** | No Redis schema or configuration changes in 03D |
| Docker rebuild | **NO** | No Docker/container changes in 03D |
| New environment variables | **NO** | `INTERNAL_SERVICE_KEY` already present in both GW and FE PM2 environments; `API_GATEWAY_URL` already present |

---

## 10. Runtime Configuration Preconditions

| Variable | Gateway | Frontend | Expected | Status |
|----------|---------|----------|----------|--------|
| `GLOBAL_EXECUTION_ENABLED` | `false` | `false` | `false` | **CONFIRMED** |
| `BILLING_CHARGES_ENABLED` | `false` | `false` | `false` | **CONFIRMED** |
| `INTERNAL_SERVICE_KEY` | PRESENT | PRESENT | PRESENT | **CONFIRMED** |
| `INTERNAL_KEY_MATCH` | — | — | GW value = FE value | **YES** |
| `API_GATEWAY_URL` | `http://localhost:4000` | `http://localhost:4000` | Points to Gateway | **CONFIRMED** |
| `NODE_ENV` | `production` | `production` | `production` | **CONFIRMED** |

All preconditions satisfied. No environment variable changes needed for Step 3.

---

## 11. Rollback Target

| Field | Value |
|-------|-------|
| ROLLBACK_REVISION | `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883` |
| Rollback method | `git stash` before deployment preserves exact pre-deployment state |

### 11.1 Pre-Deployment Snapshot

Before any Step 3 deployment action, the exact pre-deployment state is preserved:

```bash
cd /opt/aisandbox
git stash push -m "pre-03F-deployment-snapshot"
```

This captures the dirty working-tree modifications so they can be perfectly restored.

### 11.2 Rollback Commands

**API Gateway rollback:**

```bash
cd /opt/aisandbox
git reset --hard f73da07ef8d1acc70d43d6b4980fd1d0d57e2883
git stash pop
cd services/api-gateway
rm -rf dist/
npm run build
pm2 restart aisandbox-api-gateway
```

**Frontend rollback:**

```bash
cd /opt/aisandbox/frontend
rm -rf .next/
npm run build
pm2 restart aisandbox-frontend
```

**Rollback health checks:**

```bash
# Gateway health
curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/health
# Expected: 200

# Frontend health
curl -s -o /dev/null -w '%{http_code}' http://localhost:3002
# Expected: 307

# PM2 status
pm2 list
# Expected: all processes "online"
```

### 11.3 Rollback Safety

- `git stash pop` after `git reset --hard f73da07` restores the exact pre-deployment dirty working tree (stash was created relative to `f73da07`)
- No database rollback needed (no migration introduced)
- No environment variable rollback needed (no env changes)
- Clean rebuild (`rm -rf dist/` / `rm -rf .next/`) ensures compiled output matches restored source

---

## 12. Step 3 Exact Deployment Plan

### Phase A — Pre-Deployment Safety / Revision Verification

**From local machine:**

```powershell
# A1: Push local commits to GitHub remote
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"
git push origin main

# A2: Verify push succeeded
git status --short --branch
# Expected: ## main...origin/main (no "ahead" count)
```

**From staging SSH:**

```bash
# A3: Verify safety gates BEFORE any action
cd /opt/aisandbox
grep 'GLOBAL_EXECUTION_ENABLED' .env
# MUST be: GLOBAL_EXECUTION_ENABLED=false

grep 'BILLING_CHARGES_ENABLED' .env
# MUST be: BILLING_CHARGES_ENABLED=false

# A4: Verify PM2 processes are online
pm2 list
# All 5 processes must be "online"

# A5: Record current revision
git rev-parse HEAD
# Expected: f73da07ef8d1acc70d43d6b4980fd1d0d57e2883

git status --short | wc -l
# Record count of dirty files for rollback verification
```

**STOP if:** `GLOBAL_EXECUTION_ENABLED` is not `false`, `BILLING_CHARGES_ENABLED` is not `false`, any critical PM2 process is not online, or staging revision does not match expected `f73da07`.

### Phase B — Verify Rollback Target

```bash
# B1: Create stash snapshot of pre-deployment state
cd /opt/aisandbox
git stash push -m "pre-03F-deployment-snapshot"

# B2: Verify stash was created
git stash list
# Expected: stash@{0}: On main: pre-03F-deployment-snapshot

# B3: Verify working tree is now clean
git status --short
# Expected: only untracked files (monitoring/watchdog/, workspace-execution-intent.logic.ts)
# No "M" modified files should remain
```

**STOP if:** stash creation fails or working tree is not clean after stash.

### Phase C — Deploy Bounded Source Update

```bash
# C1: Fetch latest from remote
cd /opt/aisandbox
git fetch origin

# C2: Verify remote has expected HEAD
git log -1 --oneline origin/main
# Expected: ed34e3c checkpoint: prepare E2E-02 controlled run

# C3: Update local to remote HEAD
git reset --hard origin/main

# C4: Verify new HEAD
git rev-parse HEAD
# Expected: ed34e3c220c04c81ec6784f43e8952a60f537825

git log -1 --oneline
# Expected: ed34e3c checkpoint: prepare E2E-02 controlled run

# C5: Verify working tree is clean
git status --short
# Expected: only untracked files (monitoring/watchdog/, possibly workspace-execution-intent.logic.ts — now tracked)
```

**STOP if:** remote HEAD does not match expected `ed34e3c`, `git reset` fails, or unexpected source state.

### Phase D — Build/Restart Gateway

```bash
# D1: Verify 03D source files are present
cd /opt/aisandbox
grep -c 'build_awaiting_apply' services/api-gateway/src/usage-ledger/usage-ledger.service.ts
# Expected: 3

grep -c 'triggerBuildApplyDeduction' services/api-gateway/src/usage-ledger/usage-ledger.service.ts
# Expected: 2

grep -c 'confirm-build-apply' services/api-gateway/src/ai/internal-accounting.controller.ts
# Expected: 3

ls services/api-gateway/src/ai/dto/confirm-build-apply.dto.ts
# Expected: file exists

# D2: Clean rebuild Gateway
cd /opt/aisandbox/services/api-gateway
rm -rf dist/
npm run build
# Expected: exit code 0, no errors

# D3: Verify dist was created
ls dist/src/main.js
# Expected: file exists with current timestamp

# D4: Restart Gateway
pm2 restart aisandbox-api-gateway

# D5: Wait for process to stabilize (5 seconds)
sleep 5
```

**STOP + ROLLBACK if:** `npm run build` fails, dist not created, or PM2 restart fails.

### Phase E — Provider-Free Gateway Verification

```bash
# E1: Verify Gateway is online
pm2 describe aisandbox-api-gateway | grep status
# Expected: online

# E2: Health check
curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/health
# Expected: 200

# E3: Verify GLOBAL_EXECUTION_ENABLED=false is active
# (No execution can be triggered — this is safety verification)
grep 'GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# E4: Verify confirm-build-apply route is registered (check compiled output)
grep -r 'confirm-build-apply' /opt/aisandbox/services/api-gateway/dist/src/ai/internal-accounting.controller.js
# Expected: at least 1 match showing the route exists in compiled JS

# E5: Verify build_awaiting_apply logic is compiled
grep -c 'build_awaiting_apply' /opt/aisandbox/services/api-gateway/dist/src/usage-ledger/usage-ledger.service.js
# Expected: >= 1

# E6: Verify triggerBuildApplyDeduction is compiled
grep -c 'triggerBuildApplyDeduction' /opt/aisandbox/services/api-gateway/dist/src/usage-ledger/usage-ledger.service.js
# Expected: >= 1

# E7: Non-mutating route probe — unauthenticated request to confirm-build-apply
# (Must be rejected — no valid X-Internal-Service-Key header)
curl -s -w '\nHTTP_STATUS:%{http_code}\n' \
  -X POST http://localhost:4000/api/internal/executions/00000000-0000-0000-0000-000000000000/confirm-build-apply \
  -H 'Content-Type: application/json' \
  -d '{"applyStatus":"applied","totalActions":1,"successCount":1}'
# Expected: HTTP 401 or 403 (rejected by InternalServiceAuthGuard)
# This proves: (a) route exists, (b) guard is active, (c) no deduction occurs

# E8: Verify BILLING_CHARGES_ENABLED=false
grep 'BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# Expected: BILLING_CHARGES_ENABLED=false
```

**STOP + ROLLBACK if:** Gateway not online, health fails, routes missing from compiled output, guard not rejecting unauthenticated requests, or safety gates not false.

### Phase F — Build/Restart Frontend

```bash
# F1: Verify 03D frontend source files are present
cd /opt/aisandbox
ls frontend/lib/build-apply-confirm-proxy.server.ts
# Expected: file exists

ls frontend/app/api/ai/executions/\[executionId\]/confirm-build-apply/route.ts
# Expected: file exists

grep -c 'confirmBuildApplyIfQualifying' frontend/app/\[locale\]/app/page.tsx
# Expected: 2

# F2: Clean rebuild Frontend
cd /opt/aisandbox/frontend
rm -rf .next/
npm run build
# Expected: exit code 0
# Expected output includes: /api/ai/executions/[executionId]/confirm-build-apply

# F3: Verify .next was created
ls .next/BUILD_ID
# Expected: file exists with current timestamp

# F4: Restart Frontend
pm2 restart aisandbox-frontend

# F5: Wait for process to stabilize (10 seconds)
sleep 10
```

**STOP + ROLLBACK if:** `npm run build` fails, .next not created, route not in build output, or PM2 restart fails.

### Phase G — Provider-Free Frontend / Security Verification

```bash
# G1: Verify Frontend is online
pm2 describe aisandbox-frontend | grep status
# Expected: online

# G2: Frontend health check
curl -s -o /dev/null -w '%{http_code}' http://localhost:3002
# Expected: 307

# G3: Verify confirm-build-apply route exists in build output
# (Check route listing from build step, or verify route is registered)
grep -r 'confirm-build-apply' /opt/aisandbox/frontend/.next/server/ 2>/dev/null | head -3
# Expected: at least 1 match

# G4: Verify build-apply-confirm-proxy exists in server build
grep -r 'proxyConfirmBuildApply' /opt/aisandbox/frontend/.next/server/ 2>/dev/null | head -3
# Expected: at least 1 match

# G5: CRITICAL — Verify INTERNAL_SERVICE_KEY is NOT in client bundle
grep -r 'INTERNAL_SERVICE_KEY' /opt/aisandbox/frontend/.next/static/ 2>/dev/null
# MUST return: 0 matches
# If ANY matches found: STOP + ROLLBACK — security violation

# G6: Verify API_GATEWAY_URL points correctly
pm2 env 2 2>/dev/null | grep 'API_GATEWAY_URL'
# Expected: API_GATEWAY_URL: http://localhost:4000
```

**STOP + ROLLBACK if:** Frontend not online, route missing from server build, `INTERNAL_SERVICE_KEY` found in client static bundle (security violation), or `API_GATEWAY_URL` incorrect.

### Phase H — Final Parity + Safety Verification

```bash
# H1: Final PM2 status
pm2 list
# All 5 processes must be "online"

# H2: Final safety gates
grep 'GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# MUST be: false

grep 'BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# MUST be: false

# H3: Final revision check
cd /opt/aisandbox
git rev-parse HEAD
# Expected: ed34e3c220c04c81ec6784f43e8952a60f537825

git log -1 --oneline
# Expected: ed34e3c checkpoint: prepare E2E-02 controlled run

# H4: Verify git ancestor
git merge-base --is-ancestor fd5e62d HEAD
echo $?
# Expected: 0

# H5: Final worktree check
git status --short
# Expected: clean or only monitoring/watchdog untracked
```

**STOP + ROLLBACK if:** any safety gate is not `false`, revision mismatch, or unexpected source state.

---

## 13. Provider-Free Gateway Verification Plan

Step 3 must prove WITHOUT provider calls or real deductions:

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | Deployed source contains `build_awaiting_apply` | `grep` compiled dist JS | >= 1 match |
| 2 | `confirm-build-apply` route is registered | `grep` compiled dist JS + non-mutating probe | Route present; probe returns 401/403 |
| 3 | Route protected by `InternalServiceAuthGuard` | Unauthenticated POST to `/api/internal/executions/<fake-uuid>/confirm-build-apply` | HTTP 401 or 403 (not 404 or 500) |
| 4 | Required DTO/qualification logic deployed | `grep` compiled dist for `triggerBuildApplyDeduction` | >= 1 match |
| 5 | Gateway starts/builds successfully | `npm run build` exit code + PM2 status | Exit 0, online |
| 6 | Health/ready succeeds | `curl http://localhost:4000/api/health` | HTTP 200 |
| 7 | `GLOBAL_EXECUTION_ENABLED=false` | `grep .env` | `false` |
| 8 | `BILLING_CHARGES_ENABLED=false` | `grep .env` | `false` |

**Non-mutating route probe safety:** The probe uses a non-existent UUID (`00000000-0000-0000-0000-000000000000`), no valid `X-Internal-Service-Key`, and `GLOBAL_EXECUTION_ENABLED=false`. Even if the guard were somehow bypassed, the fake execution ID would fail lookup. No real execution is touched. No credit is deducted.

---

## 14. Provider-Free Frontend Verification Plan

Step 3 must prove WITHOUT browser provider submission:

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | `confirm-build-apply` Next.js route exists | `grep` server build output | Route present |
| 2 | Server proxy exists | `grep 'proxyConfirmBuildApply'` in `.next/server/` | >= 1 match |
| 3 | Ownership validation exists | Source file inspection (already committed) | Present in proxy |
| 4 | `INTERNAL_SERVICE_KEY` only server-side | `grep INTERNAL_SERVICE_KEY .next/static/` | **0 matches** |
| 5 | Browser bundle does not contain `INTERNAL_SERVICE_KEY` | Same as above | **0 matches** |
| 6 | Frontend build/start healthy | `npm run build` exit 0, PM2 online, health 307 | PASS |
| 7 | `API_GATEWAY_URL` correct | `pm2 env 2 \| grep API_GATEWAY_URL` | `http://localhost:4000` |

---

## 15. Secret-Safety Rules

No Step 3 command may print:

| Secret | Allowed output |
|--------|---------------|
| `INTERNAL_SERVICE_KEY` value | PRESENT / MISSING only |
| Provider API keys | Never printed |
| Database password | Never printed |
| Session secrets | Never printed |
| JWT/session credentials | Never printed |

Safe outputs only: PRESENT/MISSING, MATCH/NO MATCH, non-secret URL, HTTP status code, route registration evidence, grep counts.

---

## 16. Stop Conditions

### Pre-Deployment STOP

Step 3 must STOP before deployment if:

- [ ] Staging revision does not match expected `f73da07`
- [ ] Rollback stash creation fails
- [ ] `GLOBAL_EXECUTION_ENABLED` is not `false`
- [ ] `BILLING_CHARGES_ENABLED` is not `false`
- [ ] Internal keys missing or mismatched
- [ ] Local commits not pushed to remote
- [ ] Remote HEAD does not match expected `ed34e3c`
- [ ] `git reset --hard origin/main` fails
- [ ] Source/worktree ambiguity makes bounded deployment impossible
- [ ] Any critical PM2 process is not online

### Post-Deployment STOP + ROLLBACK

After partial deployment, STOP + execute rollback if:

- [ ] Gateway `npm run build` fails
- [ ] Gateway PM2 process fails to start
- [ ] Gateway health check fails (HTTP != 200)
- [ ] `confirm-build-apply` route missing from compiled output
- [ ] `build_awaiting_apply` missing from compiled output
- [ ] Unauthenticated route probe returns unexpected result (not 401/403)
- [ ] Frontend `npm run build` fails
- [ ] Frontend PM2 process fails to start
- [ ] Frontend route missing from server build
- [ ] `INTERNAL_SERVICE_KEY` found in client static bundle
- [ ] `API_GATEWAY_URL` incorrect
- [ ] Any safety gate changed from `false`

No provider call under any failure condition.

---

## 17. Zero-Budget Assertions

| Assertion | Value |
|-----------|-------|
| `provider_call_budget` | **0** |
| `provider_calls_made` | **0** |
| `intentional_credit_mutation_budget` | **0** |
| `GLOBAL_EXECUTION_ENABLED` | **must remain `false`** |
| `BILLING_CHARGES_ENABLED` | **must remain `false`** |
| Stripe/payment activation | **NONE** |
| Database writes | **NONE** (deployment is source/build/restart only) |

---

## 18. PASS Definition

03F Step 3 may PASS only if provider-free evidence proves ALL of:

| # | Criterion |
|---|-----------|
| 1 | Intended committed 03D code is deployed to staging |
| 2 | `build_awaiting_apply` logic is present in compiled Gateway output |
| 3 | Gateway `confirm-build-apply` route is active (compiled + guard-protected) |
| 4 | Frontend `confirm-build-apply` Next.js route is active (in server build) |
| 5 | Frontend server proxy is active (in server build) |
| 6 | Ownership/auth/security protections are deployed |
| 7 | `INTERNAL_SERVICE_KEY` does NOT appear in client static bundle |
| 8 | Internal keys/config remain correct and matched |
| 9 | Required builds/processes are healthy (Gateway 200, Frontend 307, all PM2 online) |
| 10 | No unrelated production changes introduced beyond what is already running |
| 11 | Rollback stash remains available |
| 12 | `GLOBAL_EXECUTION_ENABLED=false` |
| 13 | `BILLING_CHARGES_ENABLED=false` |
| 14 | Provider calls = 0 |
| 15 | Intentional credit mutations = 0 |
| 16 | Git HEAD matches expected revision |

**This does NOT prove the real provider-backed accounting flow.** That belongs to future PRIVATE-BETA-E2E-03 (requires fresh Keith authorization).

---

## 19. Failure / Rollback Sequence

If ANY stop condition fires during Step 3:

1. Do NOT proceed to the next phase
2. Record the exact failure
3. Execute rollback commands from Section 11.2
4. Verify rollback health (Gateway 200, Frontend 307, all PM2 online)
5. Verify safety gates remain `false`
6. Record 03F Step 3 as FAIL with exact reason
7. Do NOT retry without fresh analysis

---

## 20. Step 3 Phase Order

| Phase | Description | Prerequisite |
|-------|-------------|-------------|
| A | Pre-deployment safety / revision verification | None |
| B | Verify rollback target (git stash) | Phase A PASS |
| C | Deploy bounded source update (git fetch + reset) | Phase B PASS |
| D | Build/restart Gateway | Phase C PASS |
| E | Provider-free Gateway verification | Phase D PASS |
| F | Build/restart Frontend | Phase E PASS |
| G | Provider-free Frontend / security verification | Phase F PASS |
| H | Final parity + safety verification | Phase G PASS |

Each phase depends on the previous phase passing. STOP on first failure.

---

## 21. Affected Services

| Service | Affected | Action |
|---------|----------|--------|
| API Gateway | YES | Rebuild + restart |
| Frontend | YES | Rebuild + restart |
| AI Service | NO | No action — not affected by 03D |
| Container Manager | NO | No action — not affected by 03D |
| Ops Watchdog | NO | No action — not affected by 03D |

---

## 22. Step 3 Handoff

### Prerequisites for Step 3

- [ ] Local commits pushed to GitHub remote (`git push origin main`)
- [ ] SSH access to `aisandbox-staging` available
- [ ] `GLOBAL_EXECUTION_ENABLED=false` confirmed on staging
- [ ] `BILLING_CHARGES_ENABLED=false` confirmed on staging
- [ ] This Stage Start document reviewed

### Recommended Step 3 Model

Per CLAUDE.md model guidance: GPT-5.3 Codex High — backend/runtime, checkpoint/revert, higher-risk deployment work.

### Recommended Step 3 Window

New window per CLAUDE.md new-window rules (starting a new major stage, security-adjacent work).

---

## Safety Confirmation

| Safety item | Value |
|-------------|-------|
| Provider calls during Step 2 | **0** |
| GLOBAL_EXECUTION_ENABLED changes during Step 2 | **0** |
| Credit mutations during Step 2 | **0** |
| Staging configuration changes during Step 2 | **0** |
| Source changes during Step 2 | **0** |
| Deployments during Step 2 | **0** |
| DB mutations during Step 2 | **0** |
| PM2 restart/reload during Step 2 | **0** |
| Stripe/payment changes during Step 2 | **0** |
| Git commit/push during Step 2 | **0** |
| GLOBAL_EXECUTION_ENABLED final | **false** |
| BILLING_CHARGES_ENABLED final | **false** |

---

*Stage Start created: 2026-08-14 — PRIVATE-BETA-BLOCKER-03F Step 2 — read-only staging inspection + governance only — no source/runtime/provider/balance/deployment mutation.*
