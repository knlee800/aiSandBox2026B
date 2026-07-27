# PRIVATE-BETA-STAGING-EXECUTION-04C — Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04C  
**Title:** Dependency Install + Build  
**Step:** 3 — Keith Manual Evidence Review  
**Date:** 2026-07-27  
**Nature:** Evidence review only — no server action — no source changes — no AWS action — no env files opened/created/edited — no env values printed — no dependency install/build in Cursor — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04C |
| Title | Dependency Install + Build |
| Step | 3 — Evidence Review |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — dependency install + build on Lightsail instance |
| Risk | HIGH — real staging server action; install and build on production-like VPS |
| Registered | 2026-07-26 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Evidence date | 2026-07-26 |
| Reviewer | AI — Step 3 — evidence review only |
| Child slice | 3 of 4 of EXECUTION-04 manual execution split |
| Package-manager policy | Outcome A — npm with tracked root `package-lock.json` — COMPLETE and LOCKED |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-DEPENDENCY-INSTALL-BUILD-RUNBOOK.md` (amended 2026-07-27 for Outcome A) |

---

## 2. Purpose

This document records the formal review of Keith's safe evidence from the EXECUTION-04C manual run on the `aisandbox-staging` Lightsail server. It verifies each evidence item against the amended 04C runbook and Outcome A package-manager policy, issues a final PASS/BLOCKED verdict, and documents the recommendation for Step 4 consolidation.

Step 3 is an evidence review step only. No server actions, source changes, AWS actions, env file access, local install/build, git commits, pushes, or subagent use occurred during this Cursor step.

---

## 3. Evidence Source

**Evidence provided by:** Keith — manual execution inside AWS Lightsail browser SSH console per the amended `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-DEPENDENCY-INSTALL-BUILD-RUNBOOK.md`.

**Evidence type:** User-provided safe evidence — treated as authoritative. No secrets, passwords, connection strings, private keys, or `.env` values were present in the evidence.

**Evidence title:** `PRIVATE-BETA-STAGING-EXECUTION-04C — Evidence Report` — Date: 2026-07-26 — Instance: `aisandbox-staging`.

**Runbook / policy references:**
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-DEPENDENCY-INSTALL-BUILD-RUNBOOK.md`
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-POLICY.md` (Outcome A)
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-DECISION-REPORT.md` (Outcome E — historical / superseded for policy choice)

**Prior checkpoint references:**
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04A-CHECKPOINT.md`
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-CHECKPOINT.md`

---

## 4. Evidence Review Verdict

**VERDICT: PASS**

No direct contradiction was found between Keith's safe evidence and the amended 04C runbook / Outcome A policy. All required review items pass. Initial stop conditions (Google OAuth false-positive parser; missing VPS root lockfile) were resolved before install. Non-blocking warnings (Next.js telemetry notice; Browserslist/caniuse-lite outdated) do not reverse the PASS verdict. No active stop conditions remain. No secrets were disclosed.

---

## 5. Snapshot Review

| Check | Evidence | Expected (runbook / task) | Verdict |
|-------|----------|---------------------------|---------|
| Pre-install post-lockfile snapshot created | Yes | Yes — before install/build | PASS |
| Snapshot name | `aisandbox-staging-preinstall-build-postlockfile-2026-07-26` | Pre-install rollback point; post-lockfile naming acceptable after Outcome A sync | PASS |
| Snapshot status | Available | Available before install | PASS |

**Snapshot review result:** PASS. Pre-install post-lockfile snapshot created and Available before dependency install.

---

## 6. Repo Sync Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| Path `/opt/aisandbox` exists | Yes | Present | PASS |
| Branch `main` | Yes | `main` | PASS |
| Commit after VPS sync | `3da1b7c` — Implement staging npm lockfile policy | Revision that includes tracked root `package-lock.json` (may be newer than `c55a278`) | PASS |
| `git status` reviewed | Yes | Reviewed; no commit | PASS |
| `git status --short` after install/build | empty | Empty / only expected ignored artifacts | PASS |

**Repo sync review result:** PASS. VPS updated to `3da1b7c` with tracked lockfile policy; working tree clean after install/build.

---

## 7. `.env` Privacy and Permission Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `/opt/aisandbox/.env` exists | Yes | Exists | PASS |
| Stat line | `ubuntu ubuntu 600 /opt/aisandbox/.env` | `ubuntu ubuntu 600 /opt/aisandbox/.env` | PASS |
| Owner / mode | `ubuntu` / `ubuntu` / `600` | `ubuntu:ubuntu` / `600` | PASS |
| `.env` values printed | No | Must not print values | PASS |

**`.env` privacy/permission result:** PASS. Ownership and mode match runbook Section 10. No values disclosed.

---

## 8. Google OAuth Deferred Review

| Check | Evidence | Expected (Outcome B / runbook Section 11) | Verdict |
|-------|----------|-------------------------------------------|---------|
| `GOOGLE_CLIENT_ID` | omitted intentionally — OK | Intentionally omitted | PASS |
| `GOOGLE_CLIENT_SECRET` | omitted intentionally — OK | Intentionally omitted | PASS |
| `GOOGLE_CALLBACK_URL` | omitted intentionally — OK | Intentionally omitted | PASS |
| Fake placeholders found | No | None | PASS |
| Email/password intended auth path | Yes | Email/password | PASS |

Initial Google OAuth check produced a false positive because key names appeared in comments; amended parser confirmed all three keys omitted intentionally. That stop was resolved before install.

**Google OAuth deferred result:** PASS.

---

## 9. Package Manager / Lockfile Review

| Check | Evidence | Expected (Outcome A) | Verdict |
|-------|----------|----------------------|---------|
| `node -v` | v20.20.2 | Runtime baseline Node 20.x | PASS |
| `npm -v` | 10.8.2 | Runtime baseline npm | PASS |
| Root `package-lock.json` present | Yes | Required before install | PASS |
| `ROOT_PACKAGE_LOCK` | yes | `yes` | PASS |
| `lockfileVersion` | 3 | 3 (tracked refreshed lockfile) | PASS |
| Workspace coverage — root | present | present | PASS |
| Workspace coverage — frontend | present | present | PASS |
| Workspace coverage — api-gateway | present | present | PASS |
| Workspace coverage — ai-service | present | present | PASS |
| Workspace coverage — container-manager | present | present | PASS |
| Decision used | npm ci from root | Root `npm ci` only | PASS |
| Do not use Bun | preserved | Forbidden for staging 04C | PASS |
| Do not use `npm install` on VPS | preserved | Forbidden | PASS |

**Package manager / lockfile result:** PASS. Outcome A satisfied; tracked root lockfile present with workspace coverage; authorized install path used.

---

## 10. Dependency Install Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| Command used | `cd /opt/aisandbox && npm ci` | Root `npm ci` only | PASS |
| Result | PASS | PASS | PASS |
| `NPM_CI_EXIT` | 0 | 0 | PASS |
| `ROOT_NODE_MODULES` | yes | present after install | PASS |

Install did not occur until root tracked lockfile was present on VPS and Google OAuth omission was confirmed.

**Dependency install result:** PASS.

---

## 11. Build Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| api-gateway `npm run build` | PASS — `API_GATEWAY_BUILD_EXIT=0` | exit 0 | PASS |
| ai-service `npm run build` | PASS — `AI_SERVICE_BUILD_EXIT=0` | exit 0 | PASS |
| container-manager `npm run build` | PASS — `CONTAINER_MANAGER_BUILD_EXIT=0` | exit 0 | PASS |
| frontend `npm run build` | PASS — `FRONTEND_BUILD_EXIT=0` | exit 0 | PASS |

Build commands match runbook Section 16 package-local `npm run build` sequence. No migration/start scripts reported.

**Build result:** PASS. All four package builds exit 0.

---

## 12. Generated Artifact Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `ROOT_NODE_MODULES` | yes | `node_modules` present | PASS |
| `API_GATEWAY_DIST` | yes | `services/api-gateway/dist` | PASS |
| `AI_SERVICE_DIST` | yes | `services/ai-service/dist` | PASS |
| `CONTAINER_MANAGER_DIST` | yes | `services/container-manager/dist` | PASS |
| `FRONTEND_NEXT` | yes | `frontend/.next` | PASS |

**Generated artifact result:** PASS. Install and build artifacts present for all required targets.

---

## 13. No-Service Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `pm2 list` | empty / no app processes | Empty / no aisandbox app processes | PASS |
| systemd `aisandbox` | inactive | Not active | PASS |
| systemd `api-gateway` | inactive | Not active | PASS |
| systemd `ai-service` | inactive | Not active | PASS |
| systemd `container-manager` | inactive | Not active | PASS |
| Unexpected app process started | No | No | PASS |
| Billing / payment / AI / container execution enabled | Not enabled — no app services started; 04C non-goals preserved | Must remain disabled | PASS |

**No-service result:** PASS. No PM2 app processes; listed app systemd units inactive; billing/payment/AI/container execution not enabled by this slice.

---

## 14. No-Migration Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| Public table count | 0 | Remains 0 | PASS |
| Migrations run | No (implied by count 0 + evidence) | Not run | PASS |

**No-migration result:** PASS. Database public table count remains 0.

---

## 15. No-DNS/TLS Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| DNS/TLS non-goal preserved | Yes | Yes | PASS |

**No-DNS/TLS result:** PASS. DNS/TLS not configured in this slice.

---

## 16. Secret-Safety Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| No secrets printed/pasted | Yes | Yes | PASS |
| `.env` values printed | No | No | PASS |
| Evidence contains secret values | None observed | None | PASS |

**Secret-safety result:** PASS. No secrets disclosed in the supplied evidence.

---

## 17. Warning Assessment

| Warning | Blocking? | Assessment |
|---------|-----------|------------|
| Initial Google OAuth check false positive (key names in comments); amended parser confirmed omission | No — resolved before install | Non-blocking; correct deferred posture confirmed |
| Initial VPS missing root lockfile before Outcome A sync | No — resolved by policy + tracked lockfile + VPS fast-forward pull | Non-blocking; pre-install gate correctly enforced then cleared |
| Bash bad substitution in first Node one-liner; heredoc rerun confirmed workspace coverage | No | Non-blocking procedural retry |
| Next.js anonymous telemetry notice during frontend build | No | Non-blocking |
| Browserslist/caniuse-lite outdated warning during frontend build | No | Non-blocking |

**Warning assessment:** All recorded warnings are non-blocking. None reverse the PASS verdict.

---

## 18. Stop Condition Review

| Stop condition event | Status |
|----------------------|--------|
| Initial Google OAuth false-positive check | Triggered, then resolved before install |
| Missing root lockfile on VPS before policy/sync | Triggered, then resolved before install |
| Active stop conditions after resolution | None |
| Install/build before lockfile + OAuth confirmation | Did not occur |

**Stop condition result:** PASS. Initial stop conditions were resolved before install. No active stop conditions remain.

---

## 19. Final Evidence Matrix

| # | Review item | Verdict |
|---|-------------|---------|
| 1 | Pre-install post-lockfile snapshot created | PASS |
| 2 | Snapshot status Available | PASS |
| 3 | VPS repo updated to `3da1b7c` | PASS |
| 4 | Root `package-lock.json` present on VPS | PASS |
| 5 | lockfileVersion 3 | PASS |
| 6 | Workspace lockfile coverage (root, frontend, api-gateway, ai-service, container-manager) | PASS |
| 7 | Google OAuth keys omitted intentionally | PASS |
| 8 | No fake Google OAuth placeholders | PASS |
| 9 | `.env` exists with owner/mode `ubuntu ubuntu 600` | PASS |
| 10 | `.env` values not printed | PASS |
| 11 | `npm ci` used from root | PASS |
| 12 | `npm ci` exit 0 | PASS |
| 13 | `node_modules` present after install | PASS |
| 14 | API Gateway build exit 0 | PASS |
| 15 | AI Service build exit 0 | PASS |
| 16 | Container Manager build exit 0 | PASS |
| 17 | Frontend build exit 0 | PASS |
| 18 | Build artifacts present (`dist` ×3 + `frontend/.next`) | PASS |
| 19 | PM2 app list empty | PASS |
| 20 | App systemd services inactive | PASS |
| 21 | Database public table count remains 0 | PASS |
| 22 | No DNS/TLS configured | PASS |
| 23 | No billing/payment/AI/container execution enabled | PASS |
| 24 | No secrets disclosed | PASS |
| 25 | git status after install/build empty | PASS |
| 26 | Initial stop conditions resolved before install | PASS |
| 27 | No active stop conditions remain | PASS |

**Matrix summary:** 27/27 PASS. Overall verdict: **PASS**.

---

## 20. Residual Risks

| Risk | Severity | Notes |
|------|----------|-------|
| App services not yet started | Expected | Owned by 04D — PM2 Service Start + Health-Only Smoke |
| Migrations not yet run | Expected | Deferred; public table count still 0 |
| DNS/TLS not configured | Expected | Explicit non-goal until later staging slices |
| Redis 8.8.0 version deviation (from EXECUTION-03) | Inherited | Compatibility gate accepted in 04A; remains a known baseline note |
| Frontend Browserslist/caniuse-lite outdated warning | Low | Non-blocking for 04C; may be cleaned later if needed |
| Next.js telemetry notice | Low | Non-blocking informational output |
| Billing / real AI / container execution still disabled | Expected | Must remain disabled until later authorized slices |
| Parent EXECUTION-04 incomplete until 04D | Expected | Parent remains ACTIVE |

No residual risk blocks Step 4 consolidation of 04C.

---

## 21. Recommendation

Recommend:

**PRIVATE-BETA-STAGING-EXECUTION-04C Step 4 — Consolidation / checkpoint**

Step 4 should:

- mark 04C COMPLETE and LOCKED
- create 04C checkpoint
- update `TASKS.md`
- update `TASKS_BACKLOG_FULL.md`
- update `docs/AINOW-EXECUTION-ROADMAP.md`
- record package-manager policy Outcome A
- record tracked root package-lock on VPS
- record `npm ci` PASS
- record all four builds PASS
- record generated artifacts present
- record no services / migrations / DNS/TLS / secrets
- keep PRIVATE-BETA-STAGING-EXECUTION-04 ACTIVE
- keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED
- set next child slice to PRIVATE-BETA-STAGING-EXECUTION-04D — PM2 Service Start + Health-Only Smoke

Do **not** start 04D registration/implementation inside Step 4 beyond governance handoff language.

---

## 22. Exact Next Action

**Exact next recommended action:**

PRIVATE-BETA-STAGING-EXECUTION-04C Step 4 — Consolidation / checkpoint

Governance updates and final locking belong to Step 4. This Step 3 evidence review does not modify `TASKS.md`, `TASKS_BACKLOG_FULL.md`, the roadmap, runbooks, source, or env files.

---

## Step 3 Boundary Confirmations

| Confirmation | Status |
|--------------|--------|
| Only evidence review report created/changed | Yes |
| No TASKS / TASKS_BACKLOG_FULL / roadmap changes | Yes |
| No runbook changes | Yes |
| No source code changes | Yes |
| No env files opened/created/edited | Yes |
| No env values opened/printed | Yes |
| No local runtime/test/build action | Yes |
| No server/SSH/AWS/DNS/TLS action from Cursor | Yes |
| No Docker/PostgreSQL/Redis action from Cursor | Yes |
| No git commit or push | Yes |
| No subagents used | Yes |
