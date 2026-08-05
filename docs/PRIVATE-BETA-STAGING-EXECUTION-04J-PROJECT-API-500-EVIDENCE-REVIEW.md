# PRIVATE-BETA-STAGING-EXECUTION-04J — Project API 500 Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04J
**Title:** Staging App UI Version Mismatch Investigation — Step 4 COMPLETE / Step 5 Runtime Diagnosis Registration
**Status:** ACTIVE — Step 4 COMPLETE (Option A Execution + Evidence Review — 2026-08-05) — Step 5 PENDING (Project API 500 Runtime Diagnosis — approval-gated)
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04 (COMPLETE and LOCKED — 2026-08-04)
**Predecessor:** PRIVATE-BETA-STAGING-EXECUTION-04I (COMPLETE and LOCKED — 2026-08-04)
**Previous steps:**
- 04J Step 1 — Registration + Investigation (COMPLETE — 2026-08-04)
- 04J Step 2 — Amended Loading-State Investigation (COMPLETE — 2026-08-04)
- 04J Step 3 — Browser Evidence Correction + Option A Runbook (COMPLETE — 2026-08-04)
**Registered:** 2026-08-05
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no runtime action)

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04J |
| Title | Staging App UI Version Mismatch Investigation |
| Status | ACTIVE — Step 4 COMPLETE — Step 5 PENDING |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 (COMPLETE and LOCKED — 2026-08-04) |
| Predecessor | PRIVATE-BETA-STAGING-EXECUTION-04I (COMPLETE and LOCKED — 2026-08-04) |
| Step 4 purpose | Record Option A execution result: partial success (Build anything UI visible) + new blocker (project API 500) |
| Step 4 nature | Documentation only — no source code, no env files, no runtime action, no git commit/push |

---

## 2. Option A Execution Result

### 2.1 Execution Summary

Option A was executed on the staging VPS by Keith:

| Step | Result |
|---|---|
| `NEXT_PUBLIC_PROJECT_FIRST_UX=true` set on staging | PASS |
| Frontend rebuild (`npm run build`) | **PASS** — `FRONTEND_BUILD_EXIT=0` |
| `pm2 restart aisandbox-frontend --update-env` | PASS |

### 2.2 SSH Validation (post-restart)

| Check | Result |
|---|---|
| `API_HEALTH` | **200** |
| `API_DB_HEALTH` | **200** |
| `API_READY` | **200** |
| `ROOT_REDIRECT` | **307 Location:/en** |
| `APP_REDIRECT` | **307 Location:/en/app** |
| `EN_LOGIN` | **200** |
| `EN_REGISTER` | **200** |
| `EN_APP` | **200** |

All SSH health checks passed.

### 2.3 Browser Validation (post-restart)

| Check | Result |
|---|---|
| Page loaded | **YES** |
| Final URL | `https://staging.ainow.biz/en/app` |
| HTTPS lock valid | **YES** |
| No localhost in URL | **YES** |
| Shows "Build anything" | **YES** |
| Shows old "AI Sandbox Workspace" header | **NO** (gone — project-first UX active) |
| Page fully usable | **NO** — internal server error |

### 2.4 Option A Classification

**PARTIAL SUCCESS.**

- The project-first UX is now active on staging.
- The "Build anything" home view renders.
- The old "AI Sandbox Workspace" non-project-first layout is gone.
- However, the workspace UI is not functional due to project API errors (see Section 3).

---

## 3. New Blocker: Project API 500

### 3.1 Observed Errors

After Option A succeeded in rendering the "Build anything" UI, internal server errors appear in the workspace:

| API Endpoint | Status | Response Body Pattern |
|---|---|---|
| `GET /api/projects/public` | **500 Internal Server Error** | `{"statusCode":500,"message":"Internal server error"}` |
| `GET /api/projects?workspaceId=<redacted>` | **500 Internal Server Error** | `{"statusCode":500,"message":"Internal server error"}` |

**Note:** The `workspaceId` query parameter value is redacted. No workspaceId value is recorded in this document.

### 3.2 Response Body Pattern (generic only)

```json
{"statusCode":500,"message":"Internal server error"}
```

This is the standard NestJS unhandled exception response. No additional error detail is visible from the browser response body.

No cookies, headers, user IDs, emails, tokens, or response bodies beyond the generic 500 message are recorded.

### 3.3 Page Usability

**Page still usable: NO.**

The "Build anything" workspace UI cannot be used because the project listing and public project discovery APIs both return 500. The workspace shell renders visually, but the project-first UX requires these APIs to populate the home view.

---

## 4. API Controller Source Mapping (read-only identification)

The failing API paths map to the following controllers in `services/api-gateway/src`:

| Browser Path | Controller File | Controller Decorator | Method |
|---|---|---|---|
| `GET /api/projects/public` | `projects/public-projects.controller.ts` | `@Controller('projects/public')` (line 14) | `@Get()` (line 18) |
| `GET /api/projects?workspaceId=<redacted>` | `projects/projects.controller.ts` | `@Controller('projects')` (line 23) | `@Get()` (line 37) |

Source files were read for identification only. No source changes were made.

---

## 5. Root-Cause Hypotheses (pre-diagnosis)

The following are hypotheses only. Runtime diagnosis (Step 5) is required to confirm.

| Category | Hypothesis | Likelihood |
|---|---|---|
| **A. Database / migration issue** | Projects or workspaces table missing, or schema mismatch from a migration not yet applied on staging. | MEDIUM — most likely for 500 on both project endpoints simultaneously |
| **B. Missing env var / config** | A required env variable for workspace or project resolution is absent on staging (e.g., workspace-related config). | MEDIUM |
| **C. Service dependency** | A dependent service (e.g., a workspace/project lookup in the DB) throws an unhandled exception. | MEDIUM |
| **D. Auth/session context** | The `workspaceId` in the query is derived from a staging-created workspace whose DB state is inconsistent. | LOW-MEDIUM |
| **E. Kill switch or feature flag** | A runtime kill switch disables the project APIs. | LOW — kill switches typically return 503, not 500 |
| **F. Code error in project-first path** | A code error in the project controller or service that only surfaces in the project-first code path (newly activated). | LOW-MEDIUM — endpoint was not exercised before Option A |

**Most likely root causes:** A (DB/migration) or C (unhandled DB exception) — both project endpoints returning 500 simultaneously suggests a shared infrastructure issue (DB schema, table presence, or query failure) rather than isolated code logic errors.

**Diagnosis required:** Inspect sanitized API Gateway PM2 logs for stack traces from `/api/projects/public` and `/api/projects?workspaceId=` requests.

---

## 6. Files Read for This Document

| File | Purpose |
|---|---|
| `TASKS.md` | Active task ledger — 04J status and Step 4 criteria |
| `TASKS_BACKLOG_FULL.md` | Long-form backlog — 04J section |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Deployment roadmap — 04J and PRIVATE-BETA-DEPLOYMENT-READINESS entries |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-BROWSER-EVIDENCE-CORRECTION-OPTION-A-RUNBOOK.md` | Step 3 runbook — Option A execution plan and validation criteria |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-WORKSPACE-LOADING-STATE-INVESTIGATION.md` | Step 2 amended investigation |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04J-STAGING-APP-UI-VERSION-MISMATCH-INVESTIGATION.md` | Step 1 investigation |
| `services/api-gateway/src/projects/projects.controller.ts` | Project API routes — read-only to identify failing path |
| `services/api-gateway/src/projects/public-projects.controller.ts` | Public project API routes — read-only to identify failing path |

---

## 7. Step 5 Registration: Project API 500 Runtime Diagnosis

### 7.1 Task Identity

| Field | Value |
|---|---|
| **Task step** | PRIVATE-BETA-STAGING-EXECUTION-04J Step 5 |
| **Title** | Project API 500 Runtime Diagnosis |
| **Status** | REGISTERED — PENDING Keith approval |
| **Parent** | PRIVATE-BETA-STAGING-EXECUTION-04J (ACTIVE) |
| **Nature** | Approval-gated safe runtime diagnosis — no source fix — no DB writes — no restart |

### 7.2 Scope

- Inspect **sanitized** API Gateway PM2 logs for error/exception output related to:
  - `GET /api/projects/public`
  - `GET /api/projects?workspaceId=`
- Identify error class (DB exception, missing table, schema mismatch, config error, code error).
- Check project/workspace controller source mapping if log output indicates a specific code path.
- Check DB/table/migration assumptions **only if** PM2 logs indicate a DB or schema issue:
  - Confirm `projects` and `workspaces` tables exist (no writes — `SELECT` or `\dt` only).
  - Check migration count vs expected if schema error is suspected.

### 7.3 Explicit Out of Scope for Step 5

| Action | Status |
|---|---|
| Source code fix | OUT OF SCOPE — separate step after diagnosis |
| DB writes | OUT OF SCOPE |
| Migration execution | OUT OF SCOPE — requires separate approval |
| Service restart | OUT OF SCOPE unless separately approved |
| Docker | OUT OF SCOPE |
| Opening `.env` files | OUT OF SCOPE |
| Printing env values | OUT OF SCOPE |
| Secret exposure | OUT OF SCOPE |
| Git commit/push | OUT OF SCOPE |

### 7.4 Approval Gate

This step requires Keith's explicit approval before any SSH or server action.

Suggested approval phrase:

```
go — approve 04J Step 5 project API 500 runtime diagnosis
```

No partial or paraphrased approval is accepted.

### 7.5 Expected Outcome

After Step 5 diagnosis:
- Root cause of project API 500 is identified (DB/migration/config/code).
- A bounded fix step (Step 6) is registered and scoped appropriately.
- Step 6 may require a separate approval phrase depending on risk level.

---

## 8. Current Staging State Assessment

| Check | Finding |
|---|---|
| VPS HEAD | `40c43af Reconcile staging root redirect state` |
| `NEXT_PUBLIC_PROJECT_FIRST_UX` on staging | **SET TO TRUE** (after Option A execution) |
| Frontend build state | Project-first UX bundle active |
| API Gateway health | 200 (as of Option A SSH validation) |
| DB health | 200 (as of Option A SSH validation) |
| "Build anything" UI visible | **YES** |
| Workspace page usable | **NO** — project APIs return 500 |
| Deployment readiness | **BLOCKED / PAUSED** — pending project API 500 diagnosis + fix |

---

## 9. Task Workflow (Updated)

1. **Registration + Investigation** — COMPLETE (2026-08-04) — doc: `PRIVATE-BETA-STAGING-EXECUTION-04J-STAGING-APP-UI-VERSION-MISMATCH-INVESTIGATION.md`
2. **Amended Loading-State Investigation** — COMPLETE (2026-08-04) — doc: `PRIVATE-BETA-STAGING-EXECUTION-04J-WORKSPACE-LOADING-STATE-INVESTIGATION.md`
3. **Browser Evidence Correction + Option A Runbook** — COMPLETE (2026-08-04) — doc: `PRIVATE-BETA-STAGING-EXECUTION-04J-BROWSER-EVIDENCE-CORRECTION-OPTION-A-RUNBOOK.md`
4. **Option A Execution + Evidence Review** — **COMPLETE (2026-08-05)** — this document
5. **Project API 500 Runtime Diagnosis** — **REGISTERED — PENDING Keith approval**
6. **Fix (TBD — registered after Step 5 diagnosis)** — PENDING
7. **Consolidation/Checkpoint** — PENDING

---

## 10. Status Summary

| Task | Status |
|---|---|
| PRIVATE-BETA-STAGING-EXECUTION-04J | **ACTIVE — Step 4 COMPLETE (Option A Execution + Evidence Review — 2026-08-05) — Step 5 PENDING (Project API 500 Runtime Diagnosis)** |
| PRIVATE-BETA-STAGING-EXECUTION-04I | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-STAGING-EXECUTION-04 | COMPLETE and LOCKED — 2026-08-04 |
| PRIVATE-BETA-DEPLOYMENT-READINESS | **BLOCKED / PAUSED** — pending project API 500 diagnosis + fix — "Build anything" UI now visible but workspace page not usable |

---

## 11. Acceptance Criteria — Step 4 (Option A Execution + Evidence Review)

- [x] Evidence review doc created
- [x] Option A partial success recorded: "Build anything" UI now visible — old "AI Sandbox Workspace" UI gone
- [x] Option A build result recorded: `FRONTEND_BUILD_EXIT=0`
- [x] SSH validation results recorded: all 200/307 PASS
- [x] Browser validation: "Build anything" visible — YES
- [x] Project API 500 blocker recorded: `/api/projects/public` 500 — `/api/projects?workspaceId=<redacted>` 500
- [x] `workspaceId` redacted — value not recorded
- [x] Generic 500 response body pattern recorded only
- [x] No cookies, headers, user IDs, emails, tokens, or sensitive response details recorded
- [x] Controller source paths identified (read-only): `projects/public-projects.controller.ts`, `projects/projects.controller.ts`
- [x] Step 5 (Project API 500 Runtime Diagnosis) registered with scope, out-of-scope, and approval gate
- [x] TASKS.md updated
- [x] TASKS_BACKLOG_FULL.md updated
- [x] Roadmap updated
- [x] No source code changed
- [x] No env files opened or changed
- [x] No env values printed or recorded
- [x] No runtime/server action occurred
- [x] No Docker/PostgreSQL/Redis action occurred
- [x] No email/account/login action occurred
- [x] No git commit or push

---

## 12. Next Recommended Action

**04J Step 5: Approval-gated Project API 500 Runtime Diagnosis**

Keith provides approval phrase:
```
go — approve 04J Step 5 project API 500 runtime diagnosis
```

Then:
1. SSH to staging VPS (AWS Lightsail browser SSH)
2. Inspect sanitized API Gateway PM2 logs: `pm2 logs aisandbox-api-gateway --lines 200 --nostream`
3. Filter for stack traces or error output related to `/api/projects/public` and `/api/projects`
4. Report sanitized log output (no secrets, no tokens, no full DB connection strings)
5. Based on log output, scope a bounded fix (Step 6)

Stop here. Await Keith's approval before any SSH or server action.

---

## 13. Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or changed by Cursor
- ✅ No env values read, printed, or recorded
- ✅ No runtime/server action taken by Cursor
- ✅ No SSH/AWS CLI/Caddy/PM2/systemd action by Cursor
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No email/account/login/AI/billing/container/OAuth action
- ✅ No git commit or push
- ✅ No subagents used
- ✅ `workspaceId` value redacted — not recorded
