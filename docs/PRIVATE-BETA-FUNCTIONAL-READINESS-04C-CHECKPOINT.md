# PRIVATE-BETA-FUNCTIONAL-READINESS-04C — Checkpoint

**Status: COMPLETE and LOCKED — 2026-08-06**
**Overall verdict: PASS**

---

## Task

PRIVATE-BETA-FUNCTIONAL-READINESS-04C — Controlled Staging Deployment of FR-04A/04B

**Parent:** PRIVATE-BETA-FUNCTIONAL-READINESS-04 (ACTIVE — FR-04C COMPLETE and LOCKED — runtime AI enablement remains NOT STARTED — Steps 2–4 remain unauthorized until separate Keith approval)

**Deployment plan:** `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-DEPLOYMENT-PLAN.md`

**Parent readiness plan:** `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md`

---

## Summary

Step 2d consolidation COMPLETE. FR-04C controlled staging deployment of FR-04A/04B catalogues is complete and locked.

Staging now runs application artifacts from commit `df9a9ff582321a1c54e3b3566322ed70da175c19` (matches `origin/main`). Backend (AI Service + API Gateway) and frontend builds PASS, services restarted successfully, and health checks PASS. Frontend `.next` verifies `grok-4.5` and `grok-4.20` present and `grok-3` absent.

FR-04C did **not** enable xAI execution. Safe runtime posture was preserved. Runtime AI enablement remains **NOT STARTED**. No private-beta users may be invited.

---

## Step Completion

| Step | Status | Verdict |
|---|---|---|
| Step 1 — Registration + deployment plan | COMPLETE — 2026-08-06 | PASS |
| Step 2a — Deployment readiness and artifact verification | COMPLETE — 2026-08-06 | READY |
| Step 2b — Backend deployment | COMPLETE — 2026-08-06 | **PASS** |
| Step 2c — Frontend deployment | COMPLETE — 2026-08-06 | **PASS** |
| Step 2d — Deployment evidence consolidation / checkpoint | COMPLETE — 2026-08-06 | **PASS** |

---

## Deployment Evidence

### Git

| Item | Result |
|---|---|
| Staging deployed HEAD | `df9a9ff582321a1c54e3b3566322ed70da175c19` |
| Matches `origin/main` | **Yes** |

### Rollback backup

| Item | Result |
|---|---|
| Backup path | `/opt/aisandbox-backups/fr-04c-20260806-151147` |
| Contents | `ai-service-dist`, `api-gateway-dist`, `predeploy-head.txt` |

### Step 2b — Backend (PASS)

| Check | Result |
|---|---|
| AI Service build | **PASS** |
| API Gateway build | **PASS** |
| `aisandbox-ai-service` restart | Successful |
| `aisandbox-api-gateway` restart | Successful |
| AI Service messages health | HTTP **201** with status **ok** |
| API Gateway health | HTTP **200** with status **ok** |

### Step 2c — Frontend (PASS)

| Check | Result |
|---|---|
| Frontend build | **PASS** |
| `.next` catalogue — `grok-4.5` | Present |
| `.next` catalogue — `grok-4.20` | Present |
| `.next` catalogue — `grok-3` | **Absent** |
| `aisandbox-frontend` restart | Successful |
| `/en/app` | HTTP **200** |

---

## Current Safe Runtime Posture

| Setting | Value |
|---|---|
| `GLOBAL_EXECUTION_ENABLED` | `false` |
| `AI_PROVIDER` | `stub` |
| `PROVIDER_XAI_ENABLED` | `false` |
| Provider API calls | **None** |
| AI execution enabled | **No** |
| Users invited | **No** |

Runtime AI enablement remains **NOT STARTED**. FR-04 Step 3a (PM2 env configuration for execution enablement) remains **NOT APPROVED**.

---

## Acceptance Criteria — COMPLETE

- [x] FR-04A/04B application artefacts deployed to staging at `df9a9ff`
- [x] Staging HEAD matches `origin/main`
- [x] Pre-deploy rollback backup created and recorded
- [x] Backend builds PASS; AI Service and API Gateway restarted; health PASS
- [x] Frontend build PASS; restarted; `/en/app` HTTP 200
- [x] Deployed frontend catalogue evidence: `grok-4.5` / `grok-4.20` present; `grok-3` absent
- [x] Safe env posture preserved (`GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`, `PROVIDER_XAI_ENABLED=false`)
- [x] No provider API calls; no AI execution enabled
- [x] No users invited
- [x] Consolidation checkpoint created and task locked

---

## Parent FR-04 Impact

- **Staging catalogue deployment blocker:** RESOLVED
- **Deployed catalogues:** Proven on staging at `df9a9ff`
- **FR-04C:** COMPLETE and LOCKED — 2026-08-06 — PASS
- **FR-04:** Remains **ACTIVE**
- **Runtime AI enablement:** Remains **NOT STARTED**
- **FR-04 Step 2** (readiness approval + staging xAI config verification): Now unblocked as exact next parent action
- **FR-04 Step 3a** (execution enablement): Still **NOT APPROVED** / out of FR-04C scope
- **Private-beta invitations:** NOT authorized — PRIVATE-BETA-INVITE-01 NOT REGISTERED

---

## Exact Next Action

**PRIVATE-BETA-FUNCTIONAL-READINESS-04 Step 2 — Keith reviews amended readiness plan + verifies staging xAI configuration path**

Requires separate explicit Keith approval before any runtime AI enablement (Step 3a).

No new task registered.

---

## Related Documents

- Deployment plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-DEPLOYMENT-PLAN.md`
- Parent readiness plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md`
- Sibling checkpoint (locked; optional Anthropic readiness only): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04A-CHECKPOINT.md`
- Sibling checkpoint (locked): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-CHECKPOINT.md`
- Roadmap: `docs/AINOW-EXECUTION-ROADMAP.md`

---

## Invariants Preserved (this consolidation)

- Documentation only — no source code changed
- No environment files modified
- No runtime commands run during consolidation
- No AI execution enabled
- No provider configuration changed
- No provider API calls
- No users invited
- No new task registered
- No locked FR-04A/04B checkpoints modified
- No subagents used

---

*Do not modify this checkpoint after locking except by explicitly approved follow-up task.*
