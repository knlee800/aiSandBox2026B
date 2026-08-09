# PRIVATE-BETA-BLOCKER-02 Checkpoint

## Task
PRIVATE-BETA-BLOCKER-02 — Preview Runtime Failure

## Status
**COMPLETE AND LOCKED — 2026-08-09**

## Family
PRIVATE-BETA-BLOCKER

---

## Consolidation Verdict

**PASS — All registered acceptance criteria satisfied.**

Staging live preview validation PASS. Preview traffic now correctly reaches Container Manager. Wrong-service Nest 404 eliminated.

---

## Original Symptom

```
GET /api/preview/<session-id>/status → HTTP 404
```

Frontend preview entered error state. Recorded as unresolved staging finding since FR-02 / FR-03 / FR-03A. Independently reconfirmed by Keith on 2026-08-09.

---

## Exact Root Cause

API Gateway `PreviewController` fallback incorrectly routed preview traffic to AI Service:

```typescript
process.env.CONTAINER_MANAGER_URL || 'http://localhost:4001'
```

- Port `4001` = AI Service
- Port `4002` = Container Manager
- Staging did not define `CONTAINER_MANAGER_URL`, so the bad fallback was used
- AI Service has no `/api/preview/*` routes → Nest 404 (`Cannot GET /api/preview/...`)

**Not a contributing factor:**
- Session/project identity mismatch
- Auth/guard defect
- Nested-static / framework-detection defect

**Number of independent defects:** ONE — wrong default port.

---

## Bounded Fix

Changed PreviewController fallback from `http://localhost:4001` to `http://localhost:4002`. Documented `CONTAINER_MANAGER_URL=http://localhost:4002` in API Gateway `.env.example`. Added proxy-target and endpoint-contract regression tests.

No architectural change. No auth/guard change. No migration. No dependency addition. Staging `.env` intentionally left unchanged — corrected source default is sufficient.

### Implementation Commit

```
f73da07ef8d1acc70d43d6b4980fd1d0d57e2883
fix(preview): route preview proxy to container manager
```

### Files Changed

| Action | File |
|--------|------|
| Modified | `services/api-gateway/src/preview/preview.controller.ts` |
| Modified | `services/api-gateway/.env.example` |
| Added | `services/api-gateway/src/preview/__tests__/preview.proxy-target.spec.ts` |
| Added | `services/api-gateway/src/preview/__tests__/preview.endpoint-contract.spec.ts` |

---

## Acceptance Criteria Review

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | Root cause identified as PreviewController wrong default port | Source investigation + staging causal chain confirmed | PASS |
| 2 | Fallback fixed to Container Manager `localhost:4002` | Commit `f73da07`; source/dist confirmed | PASS |
| 3 | `.env.example` documents `CONTAINER_MANAGER_URL` | Added `CONTAINER_MANAGER_URL=http://localhost:4002` | PASS |
| 4 | Proxy-target regression tests PASS | 3/3 PASS | PASS |
| 5 | Endpoint-contract tests PASS | 5/5 PASS | PASS |
| 6 | Existing preview security/guard tests PASS | 35/35 PASS | PASS |
| 7 | Focused preview total PASS | 43/43 PASS | PASS |
| 8 | TypeScript PASS | PASS | PASS |
| 9 | API Gateway build PASS | Local + staging PASS | PASS |
| 10 | Controlled staging deploy of expected commits only | FF to `f73da07` via `350b789` + `f73da07` | PASS |
| 11 | Backup / rollback readiness | `/opt/aisandbox-backups/private-beta-blocker-02` + dist backup | PASS |
| 12 | Only API Gateway restarted | PM2: gateway 216→217; others unchanged | PASS |
| 13 | API health HTTP 200 | `http://127.0.0.1:4000/api/health` → 200 | PASS |
| 14 | Public staging healthy | `https://staging.ainow.biz` → 307 Location `/en` | PASS |
| 15 | Old wrong-service Nest 404 gone | `Cannot GET /api/preview/...` did not occur | PASS |
| 16 | Live authenticated preview renders real content | Session `eb2bb0d7-...`; heading + paragraph visible | PASS |
| 17 | Preview Refresh PASS | Content remained after refresh; no 404 | PASS |
| 18 | No localhost URL leak | Confirmed in live browser validation | PASS |
| 19 | AI execution remained OFF | `GLOBAL_EXECUTION_ENABLED` unchanged / remained false | PASS |
| 20 | Staging `.env` not changed | Explicitly preserved; source default used | PASS |
| 21 | Checkpoint created | `docs/PRIVATE-BETA-BLOCKER-02-CHECKPOINT.md` | PASS |

**Total: 21/21 PASS**

---

## Step Summary

| Step | Description | Status | Date |
|------|-------------|--------|------|
| Step 1 | Registration + root-cause investigation | COMPLETE | 2026-08-09 |
| Step 2 | Bounded implementation + regression tests | COMPLETE | 2026-08-09 |
| Step 2C | Differential full-suite verification | COMPLETE — 96 FAIL VERIFIED UNRELATED | 2026-08-09 |
| Step 3 | Controlled staging deployment + live preview validation | COMPLETE — PASS | 2026-08-09 |
| Step 4 | Consolidation / lock | COMPLETE | 2026-08-09 |

---

## Local Focused Validation

| Check | Result |
|-------|--------|
| New proxy-target tests | 3 / 3 PASS |
| New endpoint-contract tests | 5 / 5 PASS |
| Existing preview security/guard tests | 35 / 35 PASS |
| Focused preview total | 43 / 43 PASS |
| TypeScript | PASS |
| API Gateway build | PASS |

---

## Unrelated Full-Suite Failures (Out of Scope)

| Item | Result |
|------|--------|
| Full API Gateway suite | 1927 PASS, 96 FAIL, 6 SKIPPED |
| Differential validation | 96 failures VERIFIED UNRELATED to this preview change |
| Failure clusters | Pre-existing DI / bootstrap / Redis / infrastructure / test-harness |
| PreviewController / `CONTAINER_MANAGER_URL` dependency | None of the failing suites imported or depended on them |

**Governance conclusion:** The 96 full-suite failures are explicitly out-of-scope pre-existing technical debt. They do **not** block PRIVATE-BETA-BLOCKER-02 completion.

---

## Controlled Staging Deployment Evidence — 2026-08-09

| Item | Value |
|------|-------|
| Pre-deploy branch | main |
| Pre-deploy HEAD | `651f723447a85ec5d22139d6ba60be6680a0f8c6` |
| Pre-deploy working tree | clean |
| Expected intervening commits | `350b789` (docs only), `f73da07` (preview fix) |
| Diff inspection | No unexpected runtime source; preview controller `4001` → `4002` only |
| Backup | `/opt/aisandbox-backups/private-beta-blocker-02` |
| Dist backup | `/opt/aisandbox-backups/private-beta-blocker-02/dist-backup` |
| Deploy method | Fast-forward only |
| Final HEAD | `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883` |
| Final branch | main |
| Final working tree | clean |
| Source fallback | `localhost:4002` present; `localhost:4001` absent |
| Compiled dist | `localhost:4002` present; `localhost:4001` absent |
| Staging `.env` | NOT changed |
| `GLOBAL_EXECUTION_ENABLED` | unchanged / remained false |

### PM2 Restart Isolation

| Service | Pre | Post | Action |
|---------|-----|------|--------|
| aisandbox-ai-service | 3 | 3 | untouched |
| aisandbox-api-gateway | 216 | 217 | restarted only |
| aisandbox-container-manager | 0 | 0 | untouched |
| aisandbox-frontend | 9 | 9 | untouched |

All services online after restart.

### Health

| Check | Result |
|-------|--------|
| `http://127.0.0.1:4000/api/health` | HTTP 200 — `{"status":"ok",...,"service":"api-gateway","version":"0.1.0"}` |
| `https://staging.ainow.biz` | HTTP 307 → Location `/en` (expected healthy locale redirect) |

---

## Live Authenticated Preview Evidence

| Item | Value |
|------|-------|
| AI execution | OFF throughout |
| Test project | “Preview Smoke Test” (temporary) |
| Session ID | `eb2bb0d7-7c26-4543-b432-c839f78d7d7d` |
| File write path | `POST /api/sessions/.../files/write` → HTTP 204 |
| File contents | heading “Preview Smoke Test”; paragraph “Preview is working.” |
| Code & Files | `index.html` visible correctly |
| Preview proxy request | `https://staging.ainow.biz/api/preview/eb2bb0d7-7c26-4543-b432-c839f78d7d7d/proxy?refresh=...` |
| Observed status | HTTP 304 |
| Wrong-service Nest 404 | DID NOT occur |
| Preview render | Actual test content successfully visible |
| Error page | None |
| Localhost URL leak | None |
| Refresh Preview | PASS — content remained; no old 404 |

---

## Final Deployed State

| Item | Value |
|------|-------|
| Branch | main |
| HEAD | `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883` |
| Working tree | clean |
| PM2 counts | 3 / 217 / 0 / 9 — all online |
| API health | HTTP 200 |
| Public staging root | healthy 307 → `/en` |
| Rollback required | NO |

---

## Remaining Unrelated Limitations / Debt

1. **API Gateway full-suite 96 FAIL** — pre-existing / VERIFIED UNRELATED — out of scope for this blocker.
2. Temporary staging project/session/file records from smoke (“Preview Smoke Test” / session `eb2bb0d7-...`) may remain; cleanup is optional and not required for lock.
3. Staging still does not set `CONTAINER_MANAGER_URL` in `.env`; corrected source default is relied upon. Optional future hardening: set the env explicitly for defense-in-depth (not required to close this blocker).

None of the above re-block PRIVATE-BETA-BLOCKER-02 or PRIVATE-BETA-INVITE-01 registration readiness from a preview-routing perspective.

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
- No `GLOBAL_EXECUTION_ENABLED` change
- No Git commit/push performed

---

## Governance Files Updated

| File | Change |
|------|--------|
| `TASKS.md` | PRIVATE-BETA-BLOCKER-02 marked COMPLETE AND LOCKED — 2026-08-09; acceptance criteria checked; staging PASS recorded; program status / INVITE-01 dependency wording updated |
| `TASKS_BACKLOG_FULL.md` | PRIVATE-BETA-BLOCKER-02 mirrored COMPLETE AND LOCKED — 2026-08-09; INVITE-01 dependency wording synchronized |
| `docs/PRIVATE-BETA-BLOCKER-02-CHECKPOINT.md` | Created (this file) |

---

## Private Beta Status

| Item | Status |
|------|--------|
| PRIVATE-BETA-BLOCKER-01 | COMPLETE AND LOCKED — 2026-08-09 |
| PRIVATE-BETA-BLOCKER-02 | **COMPLETE AND LOCKED — 2026-08-09** |
| PRIVATE-BETA-INVITE-01 | **UNBLOCKED for registration** — preview runtime blocker resolved — do **not** execute invitations without registration and Keith explicit approval |
| Next recommended task | **PRIVATE-BETA-INVITE-01** registration (requires Keith explicit approval — NOT STARTED / NOT COMPLETE) |

---

## Predecessor References

- Step 1 investigation: `TASKS.md` PRIVATE-BETA-BLOCKER-02 root-cause entry
- Step 2 implementation commit: `f73da07ef8d1acc70d43d6b4980fd1d0d57e2883`
- Step 3 runbook: `docs/PRIVATE-BETA-BLOCKER-02-STEP3-RUNBOOK.md`
- Authoritative staging evidence: Keith-executed controlled deployment + live browser validation — 2026-08-09
