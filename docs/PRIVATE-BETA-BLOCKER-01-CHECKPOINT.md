# PRIVATE-BETA-BLOCKER-01 Checkpoint

## Task
PRIVATE-BETA-BLOCKER-01 — Recurring Canonical Landing Page Regression

## Status
**COMPLETE AND LOCKED — 2026-08-09**

## Family
PRIVATE-BETA-BLOCKER

---

## Consolidation Verdict

**PASS — All acceptance criteria satisfied.**

---

## Acceptance Criteria Review

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | Root-cause identified | Feature flag `NEXT_PUBLIC_PROJECT_FIRST_UX` / `PROJECT_FIRST_UX` is transient, not persisted in deployment manifest; absent from later builds silently restores legacy workspace | PASS |
| 2 | Safe-removal audit completed | Opus 4.6 Step 2A audit — legacy workspace has no unique required capability; canonical project-first workspace covers all required flows | PASS |
| 3 | Legacy workspace branch removed from source | `workspace-shell.tsx` early-return removed; `lib/feature-flags.ts` deleted | PASS |
| 4 | `PROJECT_FIRST_UX` runtime reference removed | Removed from `workspace-shell.tsx` and `workspace-shell.test.tsx` | PASS |
| 5 | `NEXT_PUBLIC_PROJECT_FIRST_UX` build dependency removed | Removed from `frontend/Dockerfile` and `docker-compose.prod.yml` | PASS |
| 6 | Canonical project-first behavior unconditional | No flag guard remains in workspace page or shell | PASS |
| 7 | Local regression tests pass | Focused regression tests PASS; full suite 630/630 PASS | PASS |
| 8 | TypeScript clean | `npx tsc --noEmit` PASS | PASS |
| 9 | Local build pass | `npm run build` without `NEXT_PUBLIC_PROJECT_FIRST_UX` PASS | PASS |
| 10 | Build-independence proof on staging | Staging `npm run build` with no flag exported → canonical workspace | PASS |
| 11 | Public `/en` landing | HTTP 200; canonical "Build anything"; no legacy page; no raw keys | PASS |
| 12 | `/zh-TW` landing | HTTP 200; canonical localized landing | PASS |
| 13 | `/zh-CN` landing | HTTP 200; canonical localized landing | PASS |
| 14 | Root `/` redirect | Redirects to `/en` | PASS |
| 15 | `/en/app` canonical workspace | Canonical project-first workspace; "Build anything" visible; canonical WorkspaceSidebar | PASS |
| 16 | `/zh-TW/app` canonical workspace | Canonical project-first workspace; Traditional Chinese UI | PASS |
| 17 | `/zh-CN/app` canonical workspace | Canonical project-first workspace; Simplified Chinese UI | PASS |
| 18 | Legacy session-first workspace absent | Session-scoped workspace not visible on any tested route | PASS |
| 19 | No backend restart or DB action | aisandbox-api-gateway restart 216 unchanged; container-manager restart 0 unchanged | PASS |
| 20 | Only expected files changed | 5 files changed + 1 deleted in commit `651f723` | PASS |

**Total: 20/20 PASS**

---

## Root Cause

The recurring wrong workspace was caused by a stale migration flag:

- `PROJECT_FIRST_UX` (runtime)
- `NEXT_PUBLIC_PROJECT_FIRST_UX` (build-time)

The canonical project-first workspace depended on the flag being supplied at frontend build time. Ordinary subsequent frontend builds omitted the transient flag and silently restored the legacy session-first workspace. This caused repeated regressions after unrelated deployments.

**Fix:** Remove the flag and its guarded legacy branch entirely. Canonical project-first behavior is now unconditional.

---

## Step Summary

| Step | Description | Status | Date |
|------|-------------|--------|------|
| Step 1 | Registration + root-cause investigation | COMPLETE | 2026-08-08 |
| Step 2A | Opus legacy workspace safe-removal audit | COMPLETE — SAFE TO REMOVE | 2026-08-09 |
| Step 2B | Permanent legacy workspace + feature-flag removal | COMPLETE | 2026-08-09 |
| Step 3 | Controlled staging deployment + browser validation | COMPLETE — PASS | 2026-08-09 |
| Step 4 | Consolidation / lock | COMPLETE | 2026-08-09 |

---

## Implementation Commit

```
651f723447a85ec5d22139d6ba60be6680a0f8c6
fix(workspace): remove legacy project-first feature flag
```

### Files Changed

| Action | File |
|--------|------|
| Modified | `frontend/Dockerfile` |
| Modified | `docker-compose.prod.yml` |
| Modified | `frontend/app/[locale]/app/page.tsx` |
| Modified | `frontend/components/workspace/workspace-shell.tsx` |
| Modified | `frontend/components/workspace/workspace-shell.test.tsx` |
| Deleted | `frontend/lib/feature-flags.ts` |

---

## Build-Independence Proof

On staging:
- `npm run build` executed with NO `NEXT_PUBLIC_PROJECT_FIRST_UX=true` exported or supplied
- Build PASSED
- Active runtime search for `PROJECT_FIRST_UX`, `NEXT_PUBLIC_PROJECT_FIRST_UX`, `projectFirstUxEnabled` returned no runtime/config results
- Only obsolete/test compatibility references remain inside test source where applicable

---

## Local Validation Evidence

| Check | Result |
|-------|--------|
| Focused regression tests | PASS |
| Full frontend test suite | 630 / 630 PASS |
| TypeScript (`npx tsc --noEmit`) | PASS |
| `npm run build` (no flag) | PASS |

---

## Staging Deployment Evidence

| Item | Value |
|------|-------|
| Pre-deploy HEAD | `4d431e3da9a89e548e88ba3b10d6f378eb988135` |
| Post-deploy HEAD | `651f723447a85ec5d22139d6ba60be6680a0f8c6` |
| Deployment method | `git fetch origin && git merge --ff-only origin/main` |
| Only expected files changed | YES — 6 (5 modified + 1 deleted) |
| Pre-deploy backup | `/opt/aisandbox-backups/private-beta-blocker-01` |
| Backup includes | `predeploy-state.txt`, `dot-next-backup` |

---

## PM2 / Runtime Health

| Service | Status | Restarts |
|---------|--------|----------|
| aisandbox-frontend | online | 8 → 9 |
| aisandbox-api-gateway | online | 216 (unchanged) |
| aisandbox-ai-service | online | 3 (unchanged) |
| aisandbox-container-manager | online | 0 (unchanged) |

Only `aisandbox-frontend` was restarted. No `--update-env`. No backend restart.

---

## HTTP Evidence

| URL | Status |
|-----|--------|
| https://staging.ainow.biz/en | 200 |
| https://staging.ainow.biz/en/app | 200 |

---

## Browser Validation Summary

| Case | URL | Result |
|------|-----|--------|
| A | https://staging.ainow.biz/en | PASS — canonical "Build anything" landing |
| B | https://staging.ainow.biz/zh-TW | PASS — canonical Traditional Chinese landing |
| C | https://staging.ainow.biz/zh-CN | PASS — canonical Simplified Chinese landing |
| D | https://staging.ainow.biz/ | PASS — redirects to /en |
| E | https://staging.ainow.biz/en/app | PASS — canonical project-first workspace; "Build anything"; canonical WorkspaceSidebar |
| F | https://staging.ainow.biz/zh-TW/app | PASS — canonical project-first workspace; Traditional Chinese |
| G | https://staging.ainow.biz/zh-CN/app | PASS — canonical project-first workspace; Simplified Chinese |
| H | Rebuild-independence proof | PASS — ordinary build produces canonical workspace without flag |

---

## Legacy Absence Gate

| Check | Result |
|-------|--------|
| Session-scoped workspace visible | NO |
| Old session-first sidebar | NO |
| Canonical WorkspaceSidebar | YES |
| "Build anything" canonical home | YES |

**PASS**

---

## Final Staging State

| Item | Value |
|------|-------|
| Branch | main |
| origin/main | up to date |
| Working tree | clean |
| Final HEAD | `651f723447a85ec5d22139d6ba60be6680a0f8c6` |
| Rollback required | NO |

---

## No Product / Runtime / DB Action During Consolidation

Confirmed. This consolidation step was governance-only:
- No product code modified
- No deployment executed
- No staging connection made
- No database accessed
- No migrations run
- No services restarted
- No `.env` modified
- No Caddy modified
- No Git commit/push performed

---

## Governance Files Updated

| File | Change |
|------|--------|
| `TASKS.md` | PRIVATE-BETA-BLOCKER-01 marked COMPLETE AND LOCKED — 2026-08-09; step block updated; program status updated; PRIVATE-BETA-INVITE-01 status updated to reflect only remaining preview blocker |
| `TASKS_BACKLOG_FULL.md` | PRIVATE-BETA-BLOCKER-01 marked COMPLETE AND LOCKED — 2026-08-09 |
| `docs/PRIVATE-BETA-BLOCKER-01-CHECKPOINT.md` | Created (this file) |

---

## Private Beta Status

| Item | Status |
|------|--------|
| PRIVATE-BETA-BLOCKER-01 | **COMPLETE AND LOCKED — 2026-08-09** |
| PRIVATE-BETA-INVITE-01 | **BLOCKED** — separate unresolved preview failure remains |
| Remaining blocker | Preview runtime failure (unresolved since FR-02; recorded separately) |
| Next recommended task | **PRIVATE-BETA-BLOCKER-02 — Preview Runtime Failure** |

---

## Predecessor References

- Step 1 investigation context: `TASKS.md` lines describing root-cause Vectors A/B/C
- Step 2A audit: Opus 4.6 — verdict SAFE TO REMOVE
- Step 2B commit: `651f723447a85ec5d22139d6ba60be6680a0f8c6`
- Step 3 deployment: staging HEAD `651f723447a85ec5d22139d6ba60be6680a0f8c6`
