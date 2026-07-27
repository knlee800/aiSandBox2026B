# PRIVATE-BETA-STAGING-EXECUTION-04D1 — Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04D1  
**Title:** API Gateway Reconciliation SQLite Runtime Path Fix  
**Step:** 3 — Local Validation / Evidence Review  
**Date:** 2026-07-27  
**Nature:** Evidence review / documentation only — no source edits — no env access — no runtime/server action — no Docker/PostgreSQL/Redis — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04D1 |
| Title | API Gateway Reconciliation SQLite Runtime Path Fix |
| Step | 3 — Local validation / evidence review |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04D |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL BLOCKER |
| Nature | TINY BLOCKER SOURCE FIX — API Gateway PM2 startup SQLite path/directory |
| Risk | MEDIUM |
| Registered | 2026-07-27 |
| Implementation | Step 2 COMPLETE (2026-07-27) |
| Reviewer | AI — Step 3 — evidence review only |
| Parent 04D status | ACTIVE / BLOCKED by 04D1 |
| 04D1 status entering this step | ACTIVE — Step 2 COMPLETE (Implementation) |
| 04D runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` |

---

## 2. Purpose

Review the PRIVATE-BETA-STAGING-EXECUTION-04D1 Step 2 implementation and reported local validation evidence against source, tests, package metadata, and governance status.

This step produces an evidence review report only. It does not implement further code, re-run builds/tests (unless evidence contradicted source — it did not), open env files, start services, touch the VPS, or mark 04D1 complete.

---

## 3. Evidence Source

**Evidence type:** Step 2 implementation completion record (user-provided) + local source/test/governance inspection.

**Evidence title:** `PRIVATE-BETA-STAGING-EXECUTION-04D1 Step 2 — Complete`

**Primary artifacts inspected:**

| Artifact | Role |
|----------|------|
| `services/api-gateway/src/common/sqlite-database-path.ts` | New shared path helper |
| `services/api-gateway/src/common/sqlite-database-path.spec.ts` | Targeted unit tests (6) |
| `services/api-gateway/src/admin/reconciliation.service.ts` | Original VPS crash call site |
| `services/api-gateway/src/admin/admin.service.ts` | Same better-sqlite3 startup risk |
| `services/api-gateway/src/invoices/invoices.service.ts` | Same better-sqlite3 startup risk |
| `services/api-gateway/package.json` | Dependency / script baseline |
| `TASKS.md` | Active ledger — 04D1 / 04D status |
| `TASKS_BACKLOG_FULL.md` | Backlog mirror |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Roadmap status |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` | PM2 `--cwd` contract |

**Supporting compile artifact (read-only confirmation only):**

- `services/api-gateway/dist/src/admin/reconciliation.service.js` imports `prepareSqliteDatabasePath` (consistent with reported build PASS).

**Not used as evidence:** `.env` files, env values, SSH/AWS output, secret-bearing files.

---

## 4. Evidence Review Verdict

**VERDICT: PASS**

No direct contradiction was found between the Step 2 implementation evidence and the inspected source/tests/governance. The root cause, fix design, call-site coverage, tests, package constraints, and ACTIVE/BLOCKED governance status all match. Residual risk is limited to VPS sync/rebuild/retry (expected next step) — not a local evidence failure.

04D1 remains ACTIVE (not locked). 04D remains ACTIVE / BLOCKED by 04D1. Do not mark 04D1 complete yet.

---

## 5. Original Blocker Summary

During PRIVATE-BETA-STAGING-EXECUTION-04D manual PM2 start:

- `aisandbox-api-gateway` entered a restart loop (restart count ~150 / CPU ~100%) and was stopped manually.
- better-sqlite3 failed with: directory for the SQLite database file does not exist.
- Stack pointed at `ReconciliationService` constructor.
- Source used `path.join(__dirname, '../../../..', 'database', 'aisandbox.db')`.
- AI Service, Container Manager, and Frontend had started; 04D health smoke was paused.
- PostgreSQL public table count remained 0; no migrations; no DNS/TLS; no secrets printed.

---

## 6. Root Cause Review

| Claim | Source confirmation | Verdict |
|-------|---------------------|---------|
| Nest emits compiled files under `dist/src/admin` | Helper comments + tests simulate `dist/src/admin`; dist layout present | PASS |
| `../../../..` from `src/admin` reaches repo root | Documented in TASKS Step 2 record; consistent with path math | PASS |
| Same `../../../..` from `dist/src/admin` reaches `services/` | Path math: `dist/src/admin` → `dist/src` → `dist` → `api-gateway` → `services` | PASS |
| Broken runtime target was `services/database/aisandbox.db` | Tests assert `brokenCompiledDbPath`; governance record matches | PASS |
| Missing parent caused better-sqlite3 open failure | Matches Keith blocker evidence and helper comments | PASS |

**Root cause review result:** PASS — accurately described. Initial registration emphasized missing `/opt/aisandbox/database`; Step 2 correctly refined that the *compiled* path was resolving to missing `services/database`, while the intended repo-root path remains `database/aisandbox.db`.

---

## 7. Fix Review

Chosen fix: shared `prepareSqliteDatabasePath()`.

| Requirement | Implementation | Verdict |
|-------------|----------------|---------|
| Addresses compiled runtime path behavior | Resolves from `process.cwd()` walk, not `__dirname` depth | PASS |
| Avoids fragile `__dirname` traversal | No `__dirname` in helper or three service constructors for DB path | PASS |
| Resolves repo-root `database/aisandbox.db` | `path.join(repoRoot, 'database', 'aisandbox.db')` after marker find | PASS |
| Aligns with PM2 `--cwd .../services/api-gateway` | Marker walk from cwd; runbook uses that `--cwd` | PASS |
| Fallback without marker | `../../database/aisandbox.db` from cwd | PASS (safe secondary) |
| Parent mkdir before open | `ensureSqliteDatabaseDirectory` → `mkdirSync(..., { recursive: true })` | PASS |
| Minimal / reversible | New helper + 3 call-site swaps; no broad refactor | PASS |
| No new dependencies | `better-sqlite3` already present; package.json unchanged for deps | PASS |

**Fix review result:** PASS.

---

## 8. SQLite Path Before / After

### Before (fragile)

```text
Source (src/admin):
  path.join(__dirname, '../../../..', 'database', 'aisandbox.db')
  → <repo-root>/database/aisandbox.db   (works under ts-node/src)

Compiled (dist/src/admin):
  path.join(__dirname, '../../../..', 'database', 'aisandbox.db')
  → <repo-root>/services/database/aisandbox.db   (WRONG)
  → parent /opt/aisandbox/services/database missing on VPS
  → better-sqlite3 throws → PM2 restart loop
```

### After (stable)

```text
prepareSqliteDatabasePath():
  1. Walk upward from process.cwd() for services/api-gateway/package.json
  2. Resolve <repo-root>/database/aisandbox.db
  3. mkdirSync(<repo-root>/database, { recursive: true })
  4. return dbPath for new Database(dbPath)

PM2 contract (04D runbook):
  --cwd /opt/aisandbox/services/api-gateway
  → expected: /opt/aisandbox/database/aisandbox.db
```

**Path before/after result:** PASS — compiled depth bug removed; intended repo-root path restored.

---

## 9. Parent Directory Creation Review

| Check | Result | Verdict |
|-------|--------|---------|
| Explicit `mkdirSync` | Yes — `ensureSqliteDatabaseDirectory` | PASS |
| Recursive | `{ recursive: true }` | PASS |
| Scoped to SQLite parent only | `path.dirname(dbPath)` only | PASS |
| Called before `new Database(...)` | Via `prepareSqliteDatabasePath()` then constructors open DB | PASS |
| Test covers missing parent | Spec asserts parent absent then created | PASS |

**Parent directory creation result:** PASS — explicit and minimal.

---

## 10. Better-sqlite3 Call-Site Review

API Gateway source search for `better-sqlite3` / `aisandbox.db` / fragile `__dirname` DB paths:

| Call site | Uses `prepareSqliteDatabasePath()` | Old `__dirname` DB path remaining | Verdict |
|-----------|------------------------------------|-----------------------------------|---------|
| `ReconciliationService` | Yes | No | PASS |
| `AdminService` | Yes | No | PASS |
| `InvoicesService` | Yes | No | PASS |
| Other API Gateway startup sites | None found | N/A | PASS |

Note: unrelated `__dirname` uses exist (e.g. snapshot-store test paths, TypeORM `data-source.ts` entities) — not better-sqlite3 `aisandbox.db` startup paths; out of 04D1 scope.

**Better-sqlite3 call-site review result:** PASS — all three startup sites updated; no remaining fragile SQLite DB path at those sites.

---

## 11. Test Review

File: `services/api-gateway/src/common/sqlite-database-path.spec.ts` — **6 tests**.

| Coverage requirement | Spec coverage | Verdict |
|----------------------|---------------|---------|
| Stable repo-root path | Resolves `database/aisandbox.db`; not `services/database`; no `dist` in path | PASS |
| PM2 api-gateway cwd | `findRepoRoot(apiGatewayCwd)` | PASS |
| Repo-root cwd | Same expected path from repo root | PASS |
| Missing parent directory | `ensureSqliteDatabaseDirectory` creates parent | PASS |
| better-sqlite3 open | `prepareSqliteDatabasePath` + `new Database` + `SELECT 1` | PASS |
| Fallback without marker | Orphan cwd → `../../database/...` | PASS |

Reported Step 2 validation: `npm test -- sqlite-database-path` → **6/6 PASS**.

This Step 3 did **not** re-execute tests (guardrail: do not build/test unless evidence contradicts source). Source and reported results are consistent; dist also references the new helper.

**Test review result:** PASS.

---

## 12. Build Review

| Claim | Support | Verdict |
|-------|---------|---------|
| `npm run build` in `services/api-gateway` PASS | Step 2 evidence + governance record | PASS |
| Compiled output uses helper | `dist/.../reconciliation.service.js` calls `prepareSqliteDatabasePath` | PASS |
| No package script / dependency change required | `package.json` still has existing `better-sqlite3`; build = `tsc` | PASS |

This Step 3 did **not** re-run build. No contradiction found that would require a rebuild in review.

**Build review result:** PASS.

---

## 13. Governance Review

| Check | Observed | Verdict |
|-------|----------|---------|
| Step 2 marked COMPLETE | Yes — TASKS / backlog / roadmap | PASS |
| 04D1 remains ACTIVE (not locked) | Yes | PASS |
| 04D remains ACTIVE / BLOCKED by 04D1 | Yes | PASS |
| Parent 04 remains ACTIVE | Yes | PASS |
| PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED | Yes | PASS |
| Next action = Step 3 evidence review | Yes (this step) | PASS |
| No premature 04D / 04D1 COMPLETE and LOCKED | Confirmed | PASS |

**Governance review result:** PASS — Step 2 complete; 04D1 ACTIVE; 04D still blocked pending VPS sync/rebuild/retry after this review.

---

## 14. Safety / Non-Goal Review

| Non-goal / safety constraint | Observed in Step 2 evidence + review | Verdict |
|------------------------------|--------------------------------------|---------|
| No new dependencies | Confirmed (`better-sqlite3` pre-existing) | PASS |
| No migrations | Confirmed | PASS |
| No `.env` access / create / edit | Confirmed for Step 2 and this Step 3 | PASS |
| No env values printed | Confirmed | PASS |
| No frontend changes | Confirmed | PASS |
| No Docker/PostgreSQL/Redis | Confirmed | PASS |
| No server/SSH/AWS/DNS/TLS | Confirmed | PASS |
| No billing/payment/AI/container enablement | Confirmed | PASS |
| No Google OAuth enablement | Confirmed | PASS |
| No broad refactor | Confirmed — path helper + 3 constructors | PASS |
| No git commit/push | Confirmed for Step 2 evidence; this Step 3 creates docs only | PASS |
| No subagents | Confirmed | PASS |

**Safety / non-goal review result:** PASS.

---

## 15. Residual Risk

1. **VPS not yet updated** — local fix is not live on `aisandbox-staging` until Keith syncs source, rebuilds API Gateway, and retries PM2.
2. **cwd contract dependency** — resolution prefers `process.cwd()` walk; 04D runbook already sets `--cwd /opt/aisandbox/services/api-gateway`. Deviating cwd without marker could hit fallback.
3. **Startup-time SQLite open remains** — constructors still open better-sqlite3 at Nest bootstrap (by design for this tiny fix). Parent mkdir mitigates missing-directory crash; does not change product architecture (SQLite side store vs PostgreSQL primary).
4. **Empty `database/` creation** — first successful start will create `/opt/aisandbox/database` (and likely an empty `aisandbox.db` file). This is intentional for the current code path; not a migration and not PostgreSQL schema creation.
5. **Other PM2 services** — AI Service / Container Manager / Frontend may still be running or partially started from the paused 04D attempt; retry must stop remaining services first per recommendation.

None of these reverse the local evidence PASS.

---

## 16. Required VPS Retry

After this evidence review, the next manual VPS step must:

1. Ensure remaining PM2 services are stopped first.
2. Sync the fixed source to VPS after Keith has handled git manually.
3. Rebuild API Gateway on VPS.
4. Restart PM2 services under 04D runbook boundaries.
5. Confirm API Gateway no longer restart-loops.
6. Run local health-only smoke **only if** PM2 status is stable.
7. Confirm DB table count remains 0.
8. Confirm no migrations, DNS/TLS, billing/payment/AI/container execution, Google OAuth enablement, or secrets disclosure.

Do **not** mark 04D1 complete until VPS retry evidence is reviewed and consolidation completes.

---

## 17. Final Evidence Matrix

| # | Review requirement | Verdict |
|---|--------------------|---------|
| 1 | Root cause accurately described | PASS |
| 2 | Fix addresses compiled runtime path behavior | PASS |
| 3 | Fix avoids fragile `__dirname` traversal | PASS |
| 4 | Fix resolves repo-root `database/aisandbox.db` | PASS |
| 5 | Parent directory creation explicit and minimal | PASS |
| 6 | ReconciliationService uses new helper | PASS |
| 7 | AdminService uses new helper | PASS |
| 8 | InvoicesService uses new helper | PASS |
| 9 | No other API Gateway better-sqlite3 startup sites with old path | PASS |
| 10 | Tests cover missing parent directory | PASS |
| 11 | Tests cover stable repo-root path | PASS |
| 12 | Tests cover better-sqlite3 open | PASS |
| 13 | No new dependencies | PASS |
| 14 | No migrations | PASS |
| 15 | No `.env` access | PASS |
| 16 | No frontend changes | PASS |
| 17 | API Gateway targeted tests passed (reported) | PASS |
| 18 | API Gateway build passed (reported) | PASS |
| 19 | Governance: Step 2 complete; 04D1 ACTIVE | PASS |
| 20 | 04D remains blocked pending VPS sync/rebuild/retry | PASS |

**Overall:** PASS

---

## 18. Recommendation

Recommend:

**PRIVATE-BETA-STAGING-EXECUTION-04D1 Step 4 — VPS sync / rebuild / PM2 retry evidence**

Keep 04D1 ACTIVE. Keep 04D ACTIVE / BLOCKED by 04D1 until VPS retry proves API Gateway starts cleanly under the 04D runbook. Amend the 04D runbook only if PM2 command/path evidence from the retry requires it.

Do not mark 04D1 COMPLETE and LOCKED yet. Do not mark 04D complete.

---

## 19. Exact Next Action

**Exact next action:** PRIVATE-BETA-STAGING-EXECUTION-04D1 Step 4 — VPS sync / rebuild / PM2 retry evidence (Keith manual; after local git handling).

Operational focus for that step:

* Stop remaining PM2 services first.
* Sync fixed source to VPS.
* Rebuild API Gateway on VPS.
* Restart under 04D runbook boundaries.
* Confirm no API Gateway restart loop.
* Health-only smoke only if PM2 stable.
* Confirm DB table count remains 0.
* Confirm no migrations / DNS/TLS / billing/payment/AI/container execution / Google OAuth / secrets.

---

## Step 3 Review Confirmations

- Evidence review file created only.
- Verdict set: **PASS**.
- All required sections present (1–19).
- No source files changed in this step.
- No env files opened/created/edited.
- No env values printed.
- No runtime/server action occurred.
- No Docker/PostgreSQL/Redis action occurred.
- No git commit or push occurred.
- No subagents used.
