# PRIVATE-BETA-FUNCTIONAL-READINESS-04C — Controlled Staging Deployment of FR-04A/04B

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-04C  
**Type:** Controlled staging deployment planning — application code / compiled artifacts only  
**Status:** ACTIVE — Step 2a COMPLETE — outcome **BLOCKED** — 2026-08-06  
**Parent:** PRIVATE-BETA-FUNCTIONAL-READINESS-04 (ACTIVE — Steps 2–4 BLOCKED pending FR-04C deployment)  
**Author:** Cursor / Grok  
**Date:** 2026-08-06  
**Keith approval:** Registration approved 2026-08-06; Step 2a readiness verification complete (no staging mutation)  

---

## 1. Context

FR-04A and FR-04B are **COMPLETE and LOCKED** in source:

| Child | Result |
|---|---|
| FR-04A | Explicit `ANTHROPIC_MODEL`; hardcoded Anthropic fallback removed |
| FR-04B | Provider/model catalogues + dual-layer validation; xAI default `grok-4.5`; allowed `grok-4.5` / `grok-4.20`; frontend default `xai:grok-4.5` |

### Staging finding (2026-08-06)

Current staging deployment is older than FR-04A/04B:

- API Gateway deployed build contains **no** `grok-4.5`
- AI Service deployed build still contains stale **`grok-3`**
- FR-04 Step 3a was **stopped before any PM2 restart** for execution enablement
- `/opt/aisandbox/.env` was restored successfully to safe posture:
  - `XAI_API_KEY`: missing
  - `GLOBAL_EXECUTION_ENABLED=false`
  - `AI_PROVIDER=stub`
  - `PROVIDER_XAI_ENABLED=false`
- No PM2 restart occurred during that finding path
- No provider API request occurred
- Staging remains in the safe execution-disabled posture

FR-04C deploys the already-completed FR-04A/04B application changes only. **FR-04C does not enable xAI execution.**

---

## 2. Goal

Register and plan a controlled staging deployment that updates only required application code and compiled artifacts while preserving:

- `GLOBAL_EXECUTION_ENABLED=false`
- `AI_PROVIDER=stub`
- `PROVIDER_XAI_ENABLED=false`
- no `XAI_API_KEY` during deployment
- no AI inference
- no user invitations

---

## 3. Authoritative Staging Deployment Method

**Decision: Git-based in-place rebuild on the staging VPS at `/opt/aisandbox`, then PM2 restart of affected processes.**

This is the documented staging method established by PRIVATE-BETA-STAGING-EXECUTION (repo clone, npm install/build, PM2) and the proven update pattern in `docs/PRIVATE-BETA-STAGING-EXECUTION-04I2E-SAFE-GIT-VPS-SYNC-RUNBOOK.md` / checkpoint:

1. Ensure the desired commit is on `origin/main` (local commit + push by Keith — not invented packaging).
2. On VPS `/opt/aisandbox`: inspect `git status` / `git log`; `git fetch origin`.
3. Ensure a clean working tree (or only expected build noise), then advance with **fast-forward only** to `origin/main` (`git merge --ff-only origin/main`). Do not invent rsync/scp/package pipelines. Do not force-merge.
4. Build affected packages with documented `npm run build` commands under `/opt/aisandbox`.
5. Restart affected PM2 processes one at a time; health-check after each restart.
6. Verify compiled catalogue strings without provider calls.

| Method | Status for FR-04C |
|---|---|
| Git pull / fetch + ff-only merge at `/opt/aisandbox` | **Authoritative** |
| Per-service `npm run build` on VPS | **Authoritative** |
| PM2 restart of named processes | **Authoritative** |
| rsync / scp as primary deploy path | Not the documented staging app update path |
| Packaged release artifacts as primary path | Not documented for this staging stack |
| `docker compose` app deploy | Out of scope; do not use `docker compose down -v` |

**Staging source path:** `/opt/aisandbox`  
**Env file path:** `/opt/aisandbox/.env` (do not modify for FR-04C deployment)  
**Production:** out of scope — do not touch

---

## 4. Affected Services and Artifacts

### 4.1 Services affected by FR-04A/04B

| Service | PM2 name | Affected? | Why |
|---|---|---|---|
| AI Service | `aisandbox-ai-service` | **YES** | FR-04A Anthropic model config; FR-04B catalogue + adapter defaults |
| API Gateway | `aisandbox-api-gateway` | **YES** | FR-04B catalogue mirror + gateway validation |
| Frontend | `aisandbox-frontend` | **YES** | FR-04B selector catalogue + default `xai:grok-4.5` |
| Container Manager | `aisandbox-container-manager` | **NO** | No FR-04A/04B source changes |

### 4.2 What each PM2 process loads

| Process | Runtime artifact | Evidence |
|---|---|---|
| `aisandbox-api-gateway` | Compiled Nest `dist/main.js` | `services/api-gateway` `"start": "node dist/main.js"`; 04D/04F PM2 runbooks |
| `aisandbox-ai-service` | Compiled Nest `dist/main.js` | `services/ai-service` `"start": "node dist/main.js"` |
| `aisandbox-frontend` | Next.js production start over `frontend/.next` | `"start": "next start"`; **not** Next standalone output (no `output: 'standalone'` in frontend config) |
| `aisandbox-container-manager` | Compiled Nest `dist/main.js` | Unchanged; do not restart unless a later approved recovery requires it |

### 4.3 Exact build commands (affected only)

```bash
# On VPS after git sync — backend
cd /opt/aisandbox/services/ai-service && npm run build
cd /opt/aisandbox/services/api-gateway && npm run build

# Frontend
cd /opt/aisandbox/frontend && npm run build
```

Expected artifacts after build:

- `/opt/aisandbox/services/ai-service/dist/main.js`
- `/opt/aisandbox/services/api-gateway/dist/main.js`
- `/opt/aisandbox/frontend/.next/` (Next production build; served via `next start`)

### 4.4 Database migrations

**Not required.** FR-04A/04B are catalogue/config/source changes only. No entity/schema/migration ownership. Do not run `migration:run`, `migration:run:prod`, or any DB mutation.

### 4.5 Dependencies / lockfiles

FR-04A/04B checkpoints record no new runtime package dependencies. **Default plan: no `npm ci` / no lockfile refresh** unless Step 2a proves `package.json` / `package-lock.json` differences between VPS HEAD and the deploy commit that require install.

If Step 2a finds lockfile/package changes in the deploy commit range: stop and obtain separate Keith approval before any install.

### 4.6 Environment-example vs staging env

| Item | Staging action for FR-04C |
|---|---|
| Root / ai-service `.env.example` blank `ANTHROPIC_MODEL=` | Documentation only — **do not** require staging `.env` change for FR-04C |
| Real `/opt/aisandbox/.env` | **Preserve** restored safe posture; **do not** add `XAI_API_KEY`; **do not** change `AI_PROVIDER`, `GLOBAL_EXECUTION_ENABLED`, or `PROVIDER_XAI_ENABLED` |
| Billing env | Unchanged |

---

## 5. Child-Slice Decision

**Decision: YES — split FR-04C execution into bounded approval-gated Steps 2a–2d inside this task.**

Do **not** register separate child task IDs for 2a–2d unless Keith later requires separate IDs. Record recommendation only (this plan).

| Slice | Name | Staging mutation? | Purpose |
|---|---|---|---|
| **Step 2a** | Deployment readiness and artifact verification | **No** | Confirm local/source/commit readiness, deploy method, backups/rollback commands, expected file set; no SSH mutation beyond read-only checks if Keith separately allows inspection |
| **Step 2b** | Backend deployment | **Yes — Keith approval required** | Sync + build AI Service + API Gateway; restart one at a time; health + catalogue verify; execution remains disabled |
| **Step 2c** | Frontend deployment | **Yes — Keith approval required** | Sync already complete or confirm HEAD; build frontend; restart `aisandbox-frontend`; verify default/catalogue; no AI execution |
| **Step 2d** | Deployment verification and rollback readiness | Prefer read-only verify | All services online; health; safe env posture; compiled catalogues; prepare handoff back to FR-04 Step 2 |

Parent FR-04 Steps 2–4 remain **blocked** until FR-04C completes (deployed catalogues proven). FR-04C completion does **not** authorize FR-04 Step 3a execution enablement.

---

## 6. Four-Step High-Risk Workflow

| Step | Status | Description |
|---|---|---|
| **1 — Registration + deployment plan** | **COMPLETE — 2026-08-06** | This document |
| **2 — Deployment readiness + backup verification (Step 2a)** | **COMPLETE — BLOCKED — 2026-08-06** | Required FR-04A/04B files absent from `origin/main`; no staging mutation |
| **3 — Approval-gated staged deployment (Steps 2b → 2c)** | NOT STARTED — **blocked** until Step 2a READY | Separate Keith approval per mutating slice |
| **4 — Evidence consolidation + checkpoint (includes Step 2d)** | NOT STARTED | Checkpoint after verification PASS |

Every staging mutation requires **separate explicit Keith approval**.

---

## 7. Pre-Deployment Backup Requirements (exact)

Before any Step 2b mutation:

1. **Lightsail instance snapshot** (documented staging rollback safety pattern) — create and confirm **Available** before git sync/build/restart. Suggested name pattern: `aisandbox-staging-pre-fr04c-YYYY-MM-DD`.
2. **Record VPS git HEAD** before sync (`git -C /opt/aisandbox rev-parse HEAD` and `git log --oneline -5`).
3. **Artifact directory backups** (preferred non-destructive rollback of compiled builds):

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /opt/aisandbox/_fr04c_backups/$STAMP
cp -a /opt/aisandbox/services/ai-service/dist /opt/aisandbox/_fr04c_backups/$STAMP/ai-service-dist
cp -a /opt/aisandbox/services/api-gateway/dist /opt/aisandbox/_fr04c_backups/$STAMP/api-gateway-dist
cp -a /opt/aisandbox/frontend/.next /opt/aisandbox/_fr04c_backups/$STAMP/frontend-next
echo $STAMP
```

4. **Env posture check (names-only)** — confirm presence/absence without printing secrets:
   - `GLOBAL_EXECUTION_ENABLED=false`
   - `AI_PROVIDER=stub`
   - `PROVIDER_XAI_ENABLED=false`
   - `XAI_API_KEY` missing
5. **Do not** modify `/opt/aisandbox/.env` during FR-04C.
6. **Do not** create DB dumps for FR-04C (no migrations / no data change). Optional dump only if Keith expands scope.

---

## 8. Exact Deployment Sequence (after approvals)

### 8.1 Preconditions (Step 2a)

- FR-04A/04B source commits containing catalogues are on `origin/main` (Keith commit/push if not already).
- Local validation already recorded PASS in FR-04A/04B checkpoints (do not re-run as a substitute for staging deploy evidence).
- Working tree on VPS understood; unexpected dirty files → STOP.
- Backups from Section 7 complete.

### 8.2 Git sync (start of Step 2b — mutating)

```bash
git -C /opt/aisandbox status
git -C /opt/aisandbox fetch origin
git -C /opt/aisandbox log --oneline -5
git -C /opt/aisandbox log origin/main --oneline -5
git -C /opt/aisandbox merge --ff-only origin/main
git -C /opt/aisandbox status
git -C /opt/aisandbox rev-parse HEAD
```

Stop if ff-only fails, unexpected dirty files remain, or HEAD does not contain FR-04A/04B catalogue files.

### 8.3 Backend build + restart order (Step 2b)

**Restart order:**

1. Build + restart **`aisandbox-ai-service`**
2. Health-check AI Service
3. Build + restart **`aisandbox-api-gateway`**
4. Health-check API Gateway + public API health

```bash
cd /opt/aisandbox/services/ai-service && npm run build
pm2 restart aisandbox-ai-service
# wait + health (Section 9)

cd /opt/aisandbox/services/api-gateway && npm run build
pm2 restart aisandbox-api-gateway
# wait + health (Section 9)
```

Do **not** use `pm2 restart --update-env` unless env files changed (they must not). Prefer plain `pm2 restart <name>` to avoid accidental env drift.

Do **not** restart `aisandbox-container-manager` in FR-04C.

### 8.4 Frontend build + restart (Step 2c)

```bash
cd /opt/aisandbox/frontend && npm run build
pm2 restart aisandbox-frontend
# wait + health (Section 9)
```

### 8.5 Forbidden during FR-04C

- Add or expose `XAI_API_KEY`
- Change `AI_PROVIDER`, `GLOBAL_EXECUTION_ENABLED`, `PROVIDER_XAI_ENABLED`
- Submit AI requests / provider calls / inference
- Billing changes
- Migrations / PostgreSQL data mutation
- `docker compose down -v`
- Production hosts/domains
- User invitations / PRIVATE-BETA-INVITE-01

---

## 9. Exact Health Checks After Each Restart

### After `aisandbox-ai-service`

```bash
pm2 list
curl -si http://127.0.0.1:4001/api/health | head -3
```

Expect: process `online`; local health HTTP 200 where available.

### After `aisandbox-api-gateway`

```bash
pm2 list
curl -si http://127.0.0.1:4000/api/health | head -3
curl -si http://127.0.0.1:4000/api/health/db | head -3
curl -si http://127.0.0.1:4000/api/health/ready | head -3
curl -si https://staging.ainow.biz/api/health | head -3
curl -si https://staging.ainow.biz/api/health/db | head -3
curl -si https://staging.ainow.biz/api/health/ready | head -3
```

Expect: process `online`; all listed health endpoints HTTP 200.

### After `aisandbox-frontend`

```bash
pm2 list
curl -si http://127.0.0.1:3002/en | head -3
curl -si https://staging.ainow.biz/en | head -3
curl -si https://staging.ainow.biz/ | grep -E 'HTTP|Location'
```

Expect: process `online`; `/en` 200; root remains Caddy `307` → `/en` (do not alter Caddy).

### Final (Step 2d)

- All four PM2 apps online (`aisandbox-api-gateway`, `aisandbox-ai-service`, `aisandbox-container-manager`, `aisandbox-frontend`)
- `pm2-ubuntu` and `caddy` enabled/active
- Safe env posture still true (names-only)
- Catalogue verification (Section 10) PASS
- No AI execute attempt

---

## 10. Deployed-Build Verification (no provider calls)

### API Gateway

Prove in compiled output under `/opt/aisandbox/services/api-gateway/dist/` (example patterns — adjust paths if compiled layout nests differently; record exact paths used):

- `grok-4.5` **present**
- `grok-4.20` **present**
- Catalogue module present (`provider-model.catalogue` artifacts)
- Stale xAI default reliance on `grok-3` **absent** as the runtime default string in catalogue/default paths (search compiled JS; do not call xAI)

### AI Service

Prove in `/opt/aisandbox/services/ai-service/dist/`:

- `grok-4.5` **present**
- `grok-4.20` **present**
- Catalogue module present
- Stale `grok-3` default **absent** from product catalogue/default path
- Anthropic remains environment-driven (`ANTHROPIC_MODEL` wiring present; no hardcoded deprecated Anthropic smoke assumption)

### Frontend

Prove in `/opt/aisandbox/frontend/.next/` and/or synced source `frontend/lib/ai/provider-model.catalogue.ts`:

- Default selection **`xai:grok-4.5`**
- Stale model options removed (`grok-3`, deprecated selector IDs from FR-04B)
- Provider/model selector catalogue updated

### Environment (must remain)

- `GLOBAL_EXECUTION_ENABLED=false`
- `AI_PROVIDER=stub`
- `PROVIDER_XAI_ENABLED=false`
- `XAI_API_KEY` missing

---

## 11. Rollback Procedure

Primary rollback restores **previous compiled artifacts + PM2 process online state + safe env posture**. Staging already uses Git safely for sync; rollback must **not invent** a new mechanism and must **not** depend on Git alone if artifact backups exist.

### 11.1 Build fails (before restart)

- Do **not** restart the service whose build failed.
- Prior PM2 process continues serving previous artifacts.
- Diagnose build output; keep env unchanged.
- Escalate; optional: leave HEAD synced but unrebuilt service on old `dist`/`.next` until fixed.

### 11.2 Service fails to restart / health check fails

```bash
pm2 logs <process-name> --lines 50
pm2 list
```

Restore artifact backup for that service, then restart:

```bash
# Example: API Gateway
rm -rf /opt/aisandbox/services/api-gateway/dist
cp -a /opt/aisandbox/_fr04c_backups/$STAMP/api-gateway-dist /opt/aisandbox/services/api-gateway/dist
pm2 restart aisandbox-api-gateway
# re-run health checks
```

Analogous for AI Service `dist` and Frontend `.next`.

### 11.3 Deployed catalogue verification fails

- Treat as deploy failure even if health is green.
- Restore artifact backups for the failing service(s) and restart.
- Re-verify catalogues and health.
- Do not proceed to FR-04 Step 2/3a.

### 11.4 Git source rollback (only if needed + Keith approval)

If artifact restore is insufficient and source must match prior commit:

- Prefer checking out the **pre-sync HEAD** recorded in Section 7, rebuild, restart — only with explicit Keith approval.
- Do **not** `git reset --hard` without approval.
- Do **not** force-push.
- Preserve `/opt/aisandbox/.env` safe posture throughout.

### 11.5 Catastrophic recovery

- Lightsail snapshot restore — Keith-only last resort (destructive to post-snapshot changes).

### 11.6 Env posture after any rollback

Re-confirm names-only:

- `GLOBAL_EXECUTION_ENABLED=false`
- `AI_PROVIDER=stub`
- `PROVIDER_XAI_ENABLED=false`
- `XAI_API_KEY` missing

---

## 12. Key Source Artifacts Expected After Sync

| Layer | Path |
|---|---|
| AI Service catalogue | `services/ai-service/src/ai-execution/provider-model.catalogue.ts` → compiled under `dist/` |
| API Gateway catalogue | `services/api-gateway/src/ai/provider-model.catalogue.ts` → compiled under `dist/` |
| Frontend catalogue | `frontend/lib/ai/provider-model.catalogue.ts` → compiled into `.next/` |
| FR-04A Anthropic config path | `services/ai-service` Anthropic adapter + execution service |

---

## 13. Actions Requiring Separate Keith Approval

| Action | Status |
|---|---|
| FR-04C registration + this plan | **COMPLETE — 2026-08-06** |
| Step 2a readiness / backup verification | **COMPLETE — BLOCKED — 2026-08-06** — no staging mutation |
| Ensure FR-04A/04B commits are on `origin/main` | **BLOCKER** — Keith must commit + push required files |
| Re-run / confirm Step 2a READY after push | Required before Step 2b |
| Step 2b backend deploy (git sync + build + PM2 restart) | **NOT APPROVED** — blocked until READY |
| Step 2c frontend deploy | **NOT APPROVED** — blocked until READY |
| Step 2d verification / FR-04C checkpoint | After 2b/2c |
| FR-04 Step 2 readiness / xAI config verification | **Blocked pending FR-04C** |
| FR-04 Step 3a execution enablement | **NOT APPROVED** — out of FR-04C scope |
| User invitations | **NOT REGISTERED** |

---

## 14. Exact Next Bounded Action

**Keith: commit and push all required FR-04A/04B source, tests, translations, env-example docs, and governance/checkpoint files to `origin/main`.**

Then re-verify Step 2a as READY (or run a bounded re-check) before any Step 2b approval.

Do **not** start Step 2b / staging mutation while Step 2a remains BLOCKED.

---

## 15. Step 2a Readiness Verification Record — 2026-08-06 — **BLOCKED**

### 15.1 Verified Git identifiers

| Ref | Commit |
|---|---|
| Local `HEAD` | `9b7e72c38de2393ed9265d2c01c7606ef7fd0fb6` (PRIVATE-BETA-STAGING-EXECUTION-04J commit; local main ahead of `origin/main` by 1) |
| `origin/main` (after `git fetch origin`) | `53369dca7759258edfcbe31dbe2a3fcc3680eba6` (`Add project slug migration for staging`) |
| Merge-base | `53369dca7759258edfcbe31dbe2a3fcc3680eba6` |

**Blocker:** Required FR-04A/04B implementation and catalogue files are **not** present on `origin/main`. They exist only as local staged / unstaged / untracked working-tree changes. `origin/main` still has stale `grok-3` defaults and no `grok-4.5` / no `ANTHROPIC_MODEL` wiring.

### 15.2 Dependency / migration / env result

| Check | Result |
|---|---|
| `package.json` / lockfile changes required | **No** — none dirty vs `origin/main` |
| `npm install` / `npm ci` required for FR-04C | **No** |
| Migration / entity / DB action | **No** |
| Container Manager affected | **No** |
| Staging `.env` change required for FR-04C | **No** (`.env.example` docs only) |

### 15.3 Build / artifact / PM2 mapping (authoritative for later 2b/2c)

| Service | Working directory | Install? | Build | Artifact | PM2 name |
|---|---|---|---|---|---|
| AI Service | `/opt/aisandbox/services/ai-service` | No (no lockfile/package change) | `npm run build` (`tsc`) | `/opt/aisandbox/services/ai-service/dist` (`dist/main.js`) | `aisandbox-ai-service` |
| API Gateway | `/opt/aisandbox/services/api-gateway` | No | `npm run build` (`tsc`) | `/opt/aisandbox/services/api-gateway/dist` (`dist/main.js`) | `aisandbox-api-gateway` |
| Frontend | `/opt/aisandbox/frontend` | No | `npm run build` (`next build`) | `/opt/aisandbox/frontend/.next` | `aisandbox-frontend` |
| Container Manager | — | — | — | — | Do **not** restart |

### 15.4 Exact FR-04A/04B deploy file set (must reach `origin/main` then staging)

**Runtime — AI Service**

- `services/ai-service/src/ai-execution/provider-model.catalogue.ts` (**untracked; ABSENT on origin/main**)
- `services/ai-service/src/ai-execution/ai-execution.service.ts`
- `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/groq-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/deepseek-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts`
- `services/ai-service/src/worker/worker.processor.ts`

**Runtime — API Gateway**

- `services/api-gateway/src/ai/provider-model.catalogue.ts` (**untracked; ABSENT on origin/main**)
- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `services/api-gateway/src/public-api/public-ai.controller.ts`

**Runtime — Frontend + translations**

- `frontend/lib/ai/provider-model.catalogue.ts` (**untracked; ABSENT on origin/main**)
- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

**Tests (should ship with source; not loaded by PM2)**

- AI Service: anthropic adapter specs; xAI/groq/deepseek adapter specs; `ai-execution-phase16.spec.ts`; `ai-execution.phase30c.spec.ts`; `provider-model.catalogue.spec.ts`; `ai-execution.provider-model-validation.spec.ts`
- API Gateway: `ai-execution.controller.spec.ts`; `ai-execution.provider-selection.spec.ts`; `public-ai.controller.spec.ts`; `provider-model.catalogue.spec.ts`
- Frontend: `provider-model.catalogue.test.ts`; `workspace-shell.test.tsx`

**Documentation only (`.env.example` — do not mutate staging `.env`)**

- `.env.example` (`ANTHROPIC_MODEL=`)
- `services/ai-service/.env.example` (`ANTHROPIC_MODEL=`)

**Governance / checkpoints (docs only)**

- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04A-CHECKPOINT.md` / `04A-IMPLEMENTATION-PLAN.md`
- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-CHECKPOINT.md` / `04B-IMPLEMENTATION-PLAN.md`
- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-DEPLOYMENT-PLAN.md`
- Related FR-04 readiness / TASKS governance mirrors as Keith chooses for the same push

**Not required for FR-04C runtime:** `frontend/tsconfig.tsbuildinfo`; Container Manager; package/lockfiles; migrations.

### 15.5 Pre-deployment evidence / backup commands (prepare only — **do not execute in Step 2a**)

```bash
# Record pre-deploy evidence
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox log --oneline -5
pm2 list
df -h /opt/aisandbox
# Safe env posture names-only (do not print secret values):
grep -E '^(GLOBAL_EXECUTION_ENABLED|AI_PROVIDER|PROVIDER_XAI_ENABLED)=' /opt/aisandbox/.env || true
grep -E '^XAI_API_KEY=' /opt/aisandbox/.env >/dev/null && echo 'XAI_API_KEY=PRESENT' || echo 'XAI_API_KEY=MISSING'

# Dated artifact backups
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /opt/aisandbox/_fr04c_backups/$STAMP
cp -a /opt/aisandbox/services/ai-service/dist /opt/aisandbox/_fr04c_backups/$STAMP/ai-service-dist
cp -a /opt/aisandbox/services/api-gateway/dist /opt/aisandbox/_fr04c_backups/$STAMP/api-gateway-dist
cp -a /opt/aisandbox/frontend/.next /opt/aisandbox/_fr04c_backups/$STAMP/frontend-next
echo $STAMP
```

Also create Lightsail snapshot `aisandbox-staging-pre-fr04c-YYYY-MM-DD` and confirm Available before mutation.

### 15.6 Deployment sequence (Steps 2b/2c — prepare only)

1. Record pre-deployment evidence (15.5).
2. Create artifact backups (15.5).
3. `git fetch origin` + `git merge --ff-only origin/main` at `/opt/aisandbox`.
4. Confirm expected commit contains FR-04A/04B files / `grok-4.5`.
5. Build AI Service → restart only `aisandbox-ai-service` → verify process + catalogue.
6. Build API Gateway → restart only `aisandbox-api-gateway` → verify process + health + catalogue.
7. Build frontend → restart only `aisandbox-frontend` → verify health + model catalogue.
8. Reconfirm safe environment posture.

One service must be restarted and verified before moving to the next. Prefer plain `pm2 restart <name>` (no `--update-env`).

### 15.7 Independent rollback commands (prepare only)

```bash
# AI Service
rm -rf /opt/aisandbox/services/ai-service/dist
cp -a /opt/aisandbox/_fr04c_backups/$STAMP/ai-service-dist /opt/aisandbox/services/ai-service/dist
pm2 restart aisandbox-ai-service

# API Gateway
rm -rf /opt/aisandbox/services/api-gateway/dist
cp -a /opt/aisandbox/_fr04c_backups/$STAMP/api-gateway-dist /opt/aisandbox/services/api-gateway/dist
pm2 restart aisandbox-api-gateway

# Frontend
rm -rf /opt/aisandbox/frontend/.next
cp -a /opt/aisandbox/_fr04c_backups/$STAMP/frontend-next /opt/aisandbox/frontend/.next
pm2 restart aisandbox-frontend
```

Do not use destructive Git reset, database rollback, Docker teardown, or Lightsail snapshot restore except as last resort.

### 15.8 Deployment stop conditions

- Required FR-04A/04B files absent from `origin/main` (**active now**)
- Staging working tree not clean / unexpected dirty files
- Staging HEAD cannot fast-forward to `origin/main`
- Insufficient disk space
- Backup creation fails
- Build fails
- PM2 process fails to return online
- Health check fails
- Deployed `grok-4.5` catalogue evidence absent
- Stale runtime `grok-3` remains authoritative
- Safe environment posture changes unexpectedly

### 15.9 Step 2a safety confirmations

- Read-only Git only (`status`, `fetch`, `rev-parse`, `log`, `diff`, `show`/`cat-file`, `grep`, `branch`)
- No `git add` / `commit` / `push` / `pull` / `merge` / `rebase` / `checkout` / `reset` / `restore`
- No staging / SSH / PM2 / Docker / PostgreSQL / Redis / Caddy access
- No source / test / translation / package / lockfile / real env mutation (governance docs only)
- No builds, deploys, provider calls, or AI execution enablement
- No users invited; no locked FR-04A/04B checkpoints modified; no subagents

---

## 16. Related Documents

- Parent readiness plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md`
- FR-04A checkpoint (locked): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04A-CHECKPOINT.md`
- FR-04B checkpoint (locked): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-CHECKPOINT.md`
- Safe Git/VPS sync pattern: `docs/PRIVATE-BETA-STAGING-EXECUTION-04I2E-SAFE-GIT-VPS-SYNC-RUNBOOK.md`
- PM2 persistence / process names: `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-PM2-PERSISTENCE-RUNBOOK.md`
- PM2 start / artifact model: `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md`
- App deployment planning: `docs/PRIVATE-BETA-STAGING-SETUP-07-APP-DEPLOYMENT-HEALTH-SMOKE-PLAN.md`
- Roadmap: `docs/AINOW-EXECUTION-ROADMAP.md`

---

*Do not modify locked FR-04A/04B checkpoints. Do not enable AI execution under FR-04C.*
