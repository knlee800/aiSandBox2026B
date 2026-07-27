# PRIVATE-BETA-STAGING-EXECUTION-04D2 — Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04D2  
**Title:** StartupGuard Private-Beta Stub Provider Policy  
**Step:** 3 — Local Validation / Evidence Review  
**Date:** 2026-07-27  
**Nature:** Evidence review / documentation only — no source edits — no env access — no runtime/server action — no Docker/PostgreSQL/Redis — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04D2 |
| Title | StartupGuard Private-Beta Stub Provider Policy |
| Step | 3 — Local validation / evidence review |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04D |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL BLOCKER |
| Nature | TINY BLOCKER SOURCE/POLICY FIX — StartupGuard stub provider vs health-only staging |
| Risk | MEDIUM |
| Registered | 2026-07-27 |
| Implementation | Step 2 COMPLETE (2026-07-27) |
| Reviewer | AI — Step 3 — evidence review only |
| Parent 04D status | ACTIVE / BLOCKED by 04D2 |
| 04D2 status entering this step | ACTIVE — Step 2 COMPLETE (Implementation) |
| 04D runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` |

---

## 2. Purpose

Review the PRIVATE-BETA-STAGING-EXECUTION-04D2 Step 2 implementation and reported local validation evidence against source, tests, safety guards, package metadata, and governance status.

This step produces an evidence review report only. It does not implement further code, re-run builds/tests (unless evidence contradicted source — it did not), open env files, start services, touch the VPS, or mark 04D2 complete.

---

## 3. Evidence Source

**Evidence type:** Step 2 implementation completion record (user-provided) + local source/test/governance inspection.

**Evidence title:** `PRIVATE-BETA-STAGING-EXECUTION-04D2 Step 2 — Complete`

**Primary artifacts inspected:**

| Artifact | Role |
|----------|------|
| `services/api-gateway/src/startup/provider.validator.ts` | Stub exception implementation |
| `services/api-gateway/src/startup/provider.validator.spec.ts` | Targeted unit tests |
| `services/api-gateway/src/startup/startup-failfast.integration.spec.ts` | Fail-fast integration coverage |
| `services/api-gateway/src/startup/startup-guard.service.ts` | StartupGuard still calls ProviderValidator |
| `services/api-gateway/src/startup/configuration.validator.ts` | Config validation remains separate/enabled |
| `services/api-gateway/src/safety/kill-switch.config.ts` | `GLOBAL_EXECUTION_ENABLED` fail-safe signal |
| `services/api-gateway/src/safety/execution-safety.guard.ts` | Request-time 503 when execution disabled |
| `services/api-gateway/package.json` | Build/test scripts; no new deps |
| `TASKS.md` | Active ledger — 04D2 / 04D status |
| `TASKS_BACKLOG_FULL.md` | Backlog mirror |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Roadmap status |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` | 04D health-only / non-goal boundaries |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D1-EVIDENCE-REVIEW.md` | Prior blocker context / review format |

**Supporting classification check (unrelated broad-test note):**

- `services/api-gateway/src/ai/__tests__/ai-execution.provider-selection.spec.ts` constructs `AIExecutionController` with 6 args; current controller constructor requires more required deps — supports pre-existing/unrelated arity mismatch claim.

**Not used as evidence:** `.env` files, env values, SSH/AWS output, secret-bearing files.

---

## 4. Evidence Review Verdict

**VERDICT: PASS**

No direct contradiction was found between the Step 2 implementation evidence and the inspected source/tests/safety/governance. The root cause, narrow exception, kill-switch coupling, test coverage shape, reported 55/55 + build PASS, and ACTIVE/BLOCKED governance status all match.

04D2 remains ACTIVE (not locked). 04D remains ACTIVE / BLOCKED by 04D2. Do not mark 04D2 complete yet.

Residual risk is limited to VPS sync/rebuild/PM2 retry and possible later StartupGuard phases after provider validation — not a local evidence failure for 04D2 itself.

---

## 5. Original Blocker Summary

During PRIVATE-BETA-STAGING-EXECUTION-04D1 VPS sync/rebuild/PM2 retry:

- Original SQLite missing-directory blocker was passed far enough for API Gateway to reach `StartupGuardService`.
- `aisandbox-api-gateway` then restart-looped (restart count 175) and was stopped manually.
- Startup failure: Provider configuration invalid — stub provider not allowed in production/staging.
- Environment reported as `production`; cwd `/opt/aisandbox/services/api-gateway`; provider `stub`.
- 04D forbids enabling real AI provider execution, so changing `.env` to a real provider is not allowed.
- AI Service, Container Manager, and Frontend had been online; 04D health smoke paused.
- DB table count remained 0; no migrations; no DNS/TLS; no secrets printed.

---

## 6. Root Cause Review

| Claim | Source confirmation | Verdict |
|-------|---------------------|---------|
| `ProviderValidator` rejected stub in production/staging | Pre-change diff: unconditional throw when `provider === 'stub'` and env is production/staging | PASS |
| Rejection was unconditional (no kill-switch gate) | Diff shows exception logic was newly added; old path had no `KillSwitchConfig` import | PASS |
| Matches VPS failure text | VPS: "Stub provider not allowed in production/staging" / provider stub | PASS |
| 04D cannot remediate via real provider `.env` change | 04D runbook Section 4: must not enable real AI provider calls; TASKS policy conflict recorded | PASS |

**Root cause review result:** PASS — accurately described.

---

## 7. Fix Review

Chosen fix: narrow private-beta health-only exception in `ProviderValidator`.

| Requirement | Implementation | Verdict |
|-------------|----------------|---------|
| Addresses production/staging stub rejection | Exception path before throw when `isPrivateBetaHealthOnlyStubPermitted()` | PASS |
| Uses existing kill-switch signal | `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED === false` | PASS |
| Same signal as ExecutionSafetyGuard | Guard checks `!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED` → 503 | PASS |
| No new env flag | Reuses `GLOBAL_EXECUTION_ENABLED` only | PASS |
| No `.env` change required | Policy uses existing fail-safe kill switch | PASS |
| StartupGuard remains enabled | `StartupGuardService` still calls `ProviderValidator.validateProviderConfiguration()`; `StartupModule` still loaded | PASS |
| Provider validation remains enabled | Validation still runs; invalid providers still throw | PASS |
| Audit warn on allow | `console.warn('[STARTUP POLICY] stub provider permitted...')` | PASS |
| Minimal / reversible | Localized change in provider.validator + tests only | PASS |
| No new dependencies | `package.json` deps unchanged for this fix | PASS |

**Fix review result:** PASS.

---

## 8. Provider Policy Before / After

| Scenario | Before | After |
|----------|--------|-------|
| stub + prod/staging + `GLOBAL_EXECUTION_ENABLED=true` | Reject | Reject |
| stub + prod/staging + `GLOBAL_EXECUTION_ENABLED=false` | Reject | Allow + audit warn |
| stub + prod/staging + unset kill switch (fail-safe disabled) | Reject | Allow (KillSwitchConfig === false) |
| Real providers with keys | Accept | Accept (unchanged) |
| Invalid providers | Reject | Reject (unchanged) |
| stub in development | Allow | Allow (unchanged) |

**Provider policy before/after result:** PASS — matches Step 2 evidence and source.

---

## 9. Stub-Provider Exception Condition

Stub is allowed in production/staging only when **all** of the following hold:

1. `NODE_ENV` resolves to `production` or `staging`
2. `AI_PROVIDER=stub`
3. `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED === false`

`KillSwitchConfig.GLOBAL_EXECUTION_ENABLED` is true only when `process.env.GLOBAL_EXECUTION_ENABLED === 'true'` (fail-safe default false).

When the exception fires, validator returns early (stub needs no API key) after audit warn. When execution is enabled, the original startup failure is retained (message updated to mention health-only alternative).

**Stub-provider exception condition result:** PASS.

---

## 10. Execution-Safety Review

| Check | Observed | Verdict |
|-------|----------|---------|
| Exception requires execution kill switch off | `isPrivateBetaHealthOnlyStubPermitted()` requires `GLOBAL_EXECUTION_ENABLED === false` | PASS |
| ExecutionSafetyGuard still blocks when false | Throws `ServiceUnavailableException` (503) when `!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED` | PASS |
| Fix does not set enable flags | No assignment to env / kill switches in validator | PASS |
| Tests assert execution remains disabled after allow | Spec asserts KillSwitchConfig and related flags remain false | PASS |

**Execution-safety review result:** PASS — allowing stub at startup does not enable AI execution at request time.

---

## 11. Production-Safety Review

| Check | Observed | Verdict |
|-------|----------|---------|
| Stub + execution enabled still fails startup | Explicit reject path + tests for production and staging | PASS |
| Real-provider key requirements unchanged | `validateProviderApiKey` still runs for non-stub | PASS |
| Invalid providers still rejected | Invalid-name trap remains; invariant test covers it | PASS |
| StartupGuard not disabled | Still wired via StartupModule / onModuleInit | PASS |
| Provider validation not removed | Still invoked in Phase 2 of StartupGuard | PASS |
| No broad production weaken | Exception gated on kill switch fail-safe false only | PASS |

**Production-safety review result:** PASS.

---

## 12. Test Review

**Targeted suites:**

- `provider.validator.spec.ts` — 29 `it(...)` cases
- `startup-failfast.integration.spec.ts` — 26 `it(...)` cases
- Combined count **55**, matching reported `55/55 PASS`

| Coverage requirement | Spec coverage | Verdict |
|----------------------|---------------|---------|
| Allowed stub when execution disabled (prod) | Yes | PASS |
| Allowed stub when execution disabled (staging) | Yes | PASS |
| Rejected stub when execution enabled (prod/staging) | Yes | PASS |
| Unset kill switch fail-safe allow | Yes (production) | PASS |
| Real providers accepted | anthropic/openai/groq success cases | PASS |
| Invalid providers rejected | invalid-provider + invariant | PASS |
| Allow does not enable execution | 04D2 invariants block | PASS |
| Integration fail-fast updated | stub reject with enabled; allow with false | PASS |

Reported Step 2 validation: `npx jest --testPathPatterns="provider.validator|startup-failfast" --no-coverage` → **55/55 PASS**.

This Step 3 did **not** re-execute tests (guardrail: do not build/test unless evidence contradicts source). Source, test shape, and count are consistent with the reported result.

**Broad npm test note:** `npm test -- provider` can also match `ai-execution.provider-selection.spec.ts`. That file constructs `AIExecutionController` with fewer required constructor args than the current controller signature — a pre-existing arity mismatch unrelated to 04D2 files. Classification as pre-existing/unrelated is **supported**.

**Test review result:** PASS.

---

## 13. Build Review

| Claim | Support | Verdict |
|-------|---------|---------|
| `npm run build` in `services/api-gateway` PASS | Step 2 evidence + governance record | PASS |
| Build script remains `tsc` | `package.json` `"build": "tsc"` | PASS |
| No package dependency change required | Diff limited to validator + specs + governance | PASS |

This Step 3 did **not** re-run build. No contradiction found that would require a rebuild in review.

**Build review result:** PASS.

---

## 14. Governance Review

| Check | Observed | Verdict |
|-------|----------|---------|
| Step 2 marked COMPLETE | Yes — TASKS / backlog / roadmap | PASS |
| 04D2 remains ACTIVE (not locked) | Yes | PASS |
| 04D remains ACTIVE / BLOCKED by 04D2 | Yes | PASS |
| Parent 04 remains ACTIVE | Yes | PASS |
| PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED | Yes | PASS |
| Next action = Step 3 evidence review | Yes (this step) | PASS |
| No premature 04D / 04D2 COMPLETE and LOCKED | Confirmed | PASS |
| 04D1 remains ACTIVE pending its VPS evidence/consolidation | Yes | PASS |

**Governance review result:** PASS — Step 2 complete; 04D2 ACTIVE; 04D still blocked pending VPS sync/rebuild/PM2 retry after this review.

---

## 15. Safety / Non-Goal Review

| Non-goal / safety constraint | Observed in Step 2 evidence + review | Verdict |
|------------------------------|--------------------------------------|---------|
| Fix does not enable AI execution | Kill-switch gate + ExecutionSafetyGuard unchanged | PASS |
| Fix does not enable billing/payment execution | No billing/payment flags flipped; invariant keeps them false | PASS |
| Fix does not enable container execution | No container enablement in changed files | PASS |
| Fix does not enable Google OAuth | No OAuth-related changes | PASS |
| Fix does not run migrations / create tables | No migration/schema changes | PASS |
| No new env flag | Confirmed | PASS |
| No `.env` access / create / edit | Confirmed for Step 2 and this Step 3 | PASS |
| No env values printed | Confirmed | PASS |
| No frontend changes | Confirmed | PASS |
| No Docker/PostgreSQL/Redis | Confirmed | PASS |
| No server/SSH/AWS/DNS/TLS | Confirmed | PASS |
| No broad refactor | Confirmed — provider.validator + two specs | PASS |
| No git commit/push | Confirmed for Step 2 evidence; this Step 3 creates docs only | PASS |
| No subagents | Confirmed | PASS |

**Safety / non-goal review result:** PASS.

---

## 16. Residual Risks

1. **VPS not yet updated** — local fix is not live on `aisandbox-staging` until Keith syncs source, rebuilds API Gateway, and retries PM2.
2. **Post-provider StartupGuard phases** — VPS failed in Phase 2 (provider validation). After stub is allowed, later phases (especially Phase 3 required-table checks) may surface if public tables remain absent under the 04D no-migration boundary. That would be a **new** blocker, not a contradiction of this local 04D2 evidence.
3. **Kill-switch contract** — exception requires `GLOBAL_EXECUTION_ENABLED` not equal to `'true'`. Staging `.env` is expected to keep kill switches false per 04B; this review did not open `.env` to re-verify values.
4. **Other PM2 services** — AI Service / Container Manager / Frontend may still be running or partially started from the paused 04D attempt; retry must stop remaining services first.
5. **Audit warn only** — permitted-stub path logs a warn; operators should treat that as expected health-only policy noise, not as execution enablement.

None of these reverse the local evidence PASS for 04D2 Step 2.

---

## 17. Required VPS Retry

After this evidence review, the next manual VPS step must:

1. Stop all PM2 app processes first.
2. Sync the fixed source to VPS after Keith has handled git manually.
3. Rebuild API Gateway on VPS.
4. Restart PM2 services under 04D runbook boundaries.
5. Confirm API Gateway no longer fails StartupGuard provider validation for stub.
6. Confirm PM2 status stable.
7. Run local health-only smoke **only if** PM2 status is stable.
8. Confirm DB table count remains 0.
9. Confirm no migrations, DNS/TLS, billing/payment/AI/container execution, Google OAuth enablement, or secrets disclosure.

Do **not** mark 04D2 complete until VPS retry evidence is reviewed and consolidation completes.

---

## 18. Final Evidence Matrix

| # | Review requirement | Verdict |
|---|--------------------|---------|
| 1 | Root cause accurately described | PASS |
| 2 | ProviderValidator previously rejected stub in production/staging | PASS |
| 3 | New exception is narrow | PASS |
| 4 | Stub allowed only when GLOBAL_EXECUTION_ENABLED=false | PASS |
| 5 | Stub remains rejected when GLOBAL_EXECUTION_ENABLED=true | PASS |
| 6 | Real providers remain accepted | PASS |
| 7 | Invalid providers remain rejected | PASS |
| 8 | StartupGuard remains enabled | PASS |
| 9 | Provider validation remains enabled | PASS |
| 10 | No new env flag added | PASS |
| 11 | No `.env` change required | PASS |
| 12 | ExecutionSafetyGuard still blocks when GLOBAL_EXECUTION_ENABLED=false | PASS |
| 13 | Fix does not enable AI execution | PASS |
| 14 | Fix does not enable billing/payment execution | PASS |
| 15 | Fix does not enable container execution | PASS |
| 16 | Fix does not enable Google OAuth | PASS |
| 17 | Fix does not run migrations or create tables | PASS |
| 18 | Tests cover allowed stub with execution disabled | PASS |
| 19 | Tests cover rejected stub with execution enabled | PASS |
| 20 | Tests cover real providers and invalid providers | PASS |
| 21 | Targeted tests passed: 55/55 (reported) | PASS |
| 22 | API Gateway build passed (reported) | PASS |
| 23 | Broad npm test note pre-existing/unrelated (supported) | PASS |
| 24 | Governance: Step 2 complete; 04D2 ACTIVE | PASS |
| 25 | 04D remains blocked pending VPS sync/rebuild/PM2 retry | PASS |

**Overall:** PASS

---

## 19. Recommendation

Recommend:

**PRIVATE-BETA-STAGING-EXECUTION-04D2 Step 4 — VPS sync / rebuild / PM2 retry evidence**

Keep 04D2 ACTIVE. Keep 04D ACTIVE / BLOCKED by 04D2 until VPS retry proves API Gateway no longer fails StartupGuard provider validation under the 04D health-only stub + execution-disabled policy.

Do not mark 04D2 COMPLETE and LOCKED yet. Do not mark 04D complete.

---

## 20. Exact Next Action

**Exact next action:** PRIVATE-BETA-STAGING-EXECUTION-04D2 Step 4 — VPS sync / rebuild / PM2 retry evidence (Keith manual; after local git handling).

Operational focus for that step:

* Stop all PM2 app processes first.
* Sync fixed source to VPS.
* Rebuild API Gateway on VPS.
* Restart under 04D runbook boundaries.
* Confirm API Gateway no longer fails StartupGuard provider validation.
* Confirm PM2 status stable.
* Health-only smoke only if PM2 stable.
* Confirm DB table count remains 0.
* Confirm no migrations / DNS/TLS / billing/payment/AI/container execution / Google OAuth / secrets.

---

## Step 3 Review Confirmations

- Evidence review file created only.
- Verdict set: **PASS**.
- All required sections present (1–20).
- No source files changed in this step.
- No env files opened/created/edited.
- No env values printed.
- No runtime/server action occurred.
- No Docker/PostgreSQL/Redis action occurred.
- No git commit or push occurred.
- No subagents used.
