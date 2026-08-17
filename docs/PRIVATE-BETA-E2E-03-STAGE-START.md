# PRIVATE-BETA-E2E-03 — Stage Start / Exact E2E Runbook
## Step 2 — Stage Start / Exact E2E Runbook + Preconditions

**Task ID:** PRIVATE-BETA-E2E-03  
**Title:** Fresh Private-Beta Builder End-to-End Readiness Validation  
**Step:** Step 2 — Stage Start / Exact E2E Runbook + Preconditions — **COMPLETE — INDEPENDENTLY AUDITED + READ-ONLY STAGING PREFLIGHT RECONCILED — 2026-08-17**  
**Author:** Cursor / Sonnet 4.6 (read-only planning — no runtime action — no provider call — no balance mutation — no PM2 action — no .env edit — no git add/commit/push)  
**Independent audit:** Cursor / Opus (2026-08-17) — read-only source/Git audit — no runtime action — no provider call — no balance mutation — no PM2 action — no .env edit — no source/test edit — no git add/commit/push  
**Final reconciliation:** Cursor / Opus 4.6 (2026-08-17) — reconciliation against Grok §37 read-only staging preflight evidence — no runtime action — no provider call — no balance mutation — no PM2 action — no .env edit — no source/test edit — no git add/commit/push

> **AUDIT NOTICE — read before Step 3.**
> This document was independently audited after drafting. Corrections were applied to §5, §6, §7, §8, §10, §12, §13, §19, §21, §24, §25 (Phase E/J), §26, §27, §33, §35, §36, and a new §37 was added.
> Six material defects were found and corrected:
> 1. The SQLite checkpoint database path was wrong (`/workspace/.sandbox.db` does not exist). Corrected in §21/§26.
> 2. Provider/model was claimed `VERIFIED_CURRENT` on historical evidence only. Downgraded in §6.
> 3. `54b5764d` was labelled "current staging SHA" on historical checkpoint evidence only. Relabelled in §5/§7.
> 4. The `GLOBAL_EXECUTION_ENABLED` enable/restore procedure had the primary and fallback mechanisms inverted and risked stripping required env vars. Corrected in §13.
> 5. Phase E required an unobservable race between AI completion and automatic apply, and its STOP condition would have produced a false FAIL of criterion 10. Replaced with post-hoc timestamp-ordering evidence in §25/§27.
> 6. The manual checkpoint (criterion 20) would encounter a clean workspace after the automatic checkpoint and return HTTP 201 with `commitHash: null` and nothing to reconcile. Corrected in §21/§25 Phase J.
>
> `STEP_3_READINESS` was **BLOCKED_PENDING_READ_ONLY_STAGING_PREFLIGHT** (§36). The outstanding read-only staging evidence requests were listed in §37.
>
> **FINAL RECONCILIATION NOTICE (2026-08-17) — Grok §37 read-only staging preflight evidence received and reconciled.**
> All three §36 blocking items are now resolved. Additional corrections applied:
> 7. Root `.env` cannot be safely bash-sourced (`AUTH_EMAIL_FROM` contains unquoted angle brackets). The §13 `source .env + --update-env` procedure was replaced with a proven-safe inline PM2 env approach. Root `.env` now stays at `false` throughout — zero `.env` edits. §13/§12/§33/§35 corrected.
> 8. `credit_balances.user_id` does not exist; actual ownership columns are `owner_id` + `owner_type`. All queries corrected in §11/§20/§25 Phase B/H.
> 9. `usage_records.updated_at` does not exist; actual temporal field is `timestamp` (`@CreateDateColumn`). Phase E corroboration query corrected in §25.
> 10. SQLite `sqlite3` CLI is absent on staging. All checkpoint evidence queries use the proven Python 3 read-only URI mechanism. §21/§25 Phase J/§26 corrected.
> 11. Provider/model upgraded to `PROVIDER_MODEL_CURRENT_STAGING_RUNTIME_VERIFIED=YES` based on Grok preflight. §6 corrected.
> 12. `CURRENT_STAGING_SHA` upgraded to verified `54b5764d` with clean worktree. §5/§7/§8 corrected.
>
> `STEP_3_READINESS` is **READY** (§36). `UNRESOLVED_AMBIGUITY = NONE`.

---

## 1. Purpose

This Stage Start document defines the exact bounded runbook for PRIVATE-BETA-E2E-03 — the fresh Builder-first private-beta end-to-end staging validation. It is NOT a retry of E2E-02. It is derived from the resolved blocker chain (03F→03G→03H→03I) and the E2E-02 18-point baseline plus two new criteria.

Step 3 must NOT execute until Keith explicitly authorizes it after reading this document.

---

## 2. Authoritative Prior State

| Predecessor | Status | Key SHA/Date |
|-------------|--------|--------------|
| PRIVATE-BETA-E2E-01 | COMPLETE AND LOCKED — FAIL/BLOCKER — 2026-08-10 | `fileActions: []` — workspace mutation never produced |
| PRIVATE-BETA-E2E-02 | COMPLETE AND LOCKED — FAIL/BLOCKED — 2026-08-14 | `confirm-build-apply` not exercised; credit display mismatch |
| PRIVATE-BETA-BLOCKER-03F | COMPLETE AND LOCKED — FAIL/BLOCKED — 2026-08-15 | Deployment parity restored |
| PRIVATE-BETA-BLOCKER-03G | COMPLETE AND LOCKED — PASS — 2026-08-16 | `confirm-build-apply` route reachability fixed; SHA `5829c4241d0f1abc0a41476bf2fe3996dd9da993` deployed |
| PRIVATE-BETA-BLOCKER-03H | COMPLETE AND LOCKED — PASS — 2026-08-16 | Credit display auto-refresh fixed; SHA `e34be9bdcdeed6cc1fbc1f0ce2f7e5689a62bdd0` deployed |
| PRIVATE-BETA-BLOCKER-03I | COMPLETE AND LOCKED — PASS — 2026-08-17 | Git safe.directory defect fixed; SHA `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` deployed |
| E2E-03 Step 1 (registration) | COMPLETE — 2026-08-17 | commit `a72b0d00bfab198ca2f9f9690425dd0f56838a31` |

---

## 3. Dependencies

All four blocking predecessors are COMPLETE AND LOCKED. E2E-03 has no unresolved prerequisite.

---

## 4. 20 PASS Criteria (Authoritative — first-established in Step 1)

| # | Criterion | Limitation-eligible? |
|---|-----------|---------------------|
| 1 | Staging auth works | NO |
| 2 | Workspace / project / session usable | NO |
| 3 | One authorized xAI/grok-4.5 Build executes | NO |
| 4 | executionIntent = workspace_mutation (DB evidence) | NO |
| 5 | fileActions > 0 | NO |
| 6 | Workspace apply fully succeeds | NO |
| 7 | Requested workspace result exists (file tree / editor / preview confirmed by Keith) | NO |
| 8 | confirm-build-apply confirmation route reached and succeeds — 03D architecture exercised end-to-end | NEVER |
| 9 | Ownership / auth checks hold | NO |
| 10 | Build AI completion alone is NOT the accounting trigger (build_awaiting_apply gate active; no deduction at AI completion) | NEVER |
| 11 | Qualifying successful apply confirms and triggers deduction via confirm-build-apply path | NEVER |
| 12 | Exactly one credit deduction occurs | NEVER |
| 13 | No duplicate deduction | NEVER |
| 14 | No external payment charge (BILLING_CHARGES_ENABLED=false; no Stripe activity) | NO |
| 15 | Forbidden model not used — actual model verified from authoritative DB evidence | NO |
| 16 | Ask semantics remain unchanged (non-provider regression evidence; no live Ask call) | NO |
| 17 | GLOBAL_EXECUTION_ENABLED restored false (verified in .env and PM2) | NEVER |
| 18 | BILLING_CHARGES_ENABLED remains false throughout | NEVER |
| 19 | Credit display reconciles with authoritative DB balance post-execution (post-03H validation) | NEVER |
| 20 | Manual checkpoint creation returns HTTP 201 **with a non-null `commitHash`**; Git + PG + SQLite reconcile (post-03I fix validation) — see §21.0 | NEVER |

**PASS_WITH_LIMITATION_ELIGIBLE_CRITERIA = NONE.**

Rationale: all 20 criteria are launch-critical for the Builder-first private-beta readiness decision. Criteria 8, 10, 11, 12, 13, 17, 18, 19, 20 are explicitly never limitation-eligible per Step 1. The remaining criteria are all necessary for confident product-journey proof before opening to beta users. Criterion 16 can be proven by source evidence (the approved method from E2E-02); this is not a limitation.

---

## 5. Current Staging / Config Findings

### 5.1 Deployed Staging SHA

**RECONCILIATION UPDATE — Grok §37 read-only staging preflight confirmed current staging HEAD.**

| Label | Value | Evidence class |
|-------|-------|----------------|
| `LAST_VERIFIED_STAGING_SHA` | `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` | **Historical** — `PRIVATE-BETA-BLOCKER-03I-CHECKPOINT.md §31`, staging HEAD confirmed after 03I deployment (2026-08-17) |
| `CURRENT_STAGING_SHA` | `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` | **Verified** — Grok §37 read-only preflight (2026-08-17): `git -C /opt/aisandbox rev-parse HEAD` confirmed; worktree clean |
| `CURRENT_STAGING_SHA_MATCHES_LAST_VERIFIED` | **YES** | |
| `STAGING_WORKTREE_CLEAN` | **YES** | |

Step 3 Phase A must re-confirm this immediately before any runtime mutation, as staging state can drift between sessions.

### 5.2 Local / GitHub Governance HEAD

**Local HEAD:** `a72b0d00bfab198ca2f9f9690425dd0f56838a31`

### 5.3 Delta Classification

Two commits exist between the staging deployed SHA and local HEAD:

| Commit | Message | Files Changed |
|--------|---------|---------------|
| `858c3275e0e1d2570ab569e25a00ba2a879642b2` | `checkpoint: complete 03I checkpoint safety fix` | TASKS.md, TASKS_BACKLOG_FULL.md, docs/PRIVATE-BETA-BLOCKER-03I-CHECKPOINT.md |
| `a72b0d00bfab198ca2f9f9690425dd0f56838a31` | `register PRIVATE-BETA-E2E-03` | TASKS.md, TASKS_BACKLOG_FULL.md |

**ALL intervening commits are governance/documentation only. Zero production source files changed.**

Verified by: `git show --stat 858c327` and `git show --stat a72b0d0` — both show only TASKS.md, TASKS_BACKLOG_FULL.md, docs/*.md.

### 5.4 Safety Flags (Current Known State)

| Flag | Current Value | Source |
|------|---------------|--------|
| GLOBAL_EXECUTION_ENABLED | `false` | **Verified** — Grok §37 preflight: `.env` file=false, PM2 runtime=false |
| BILLING_CHARGES_ENABLED | `false` | **Verified** — Grok §37 preflight: `.env` file=false, PM2 runtime=false |
| AGENT_HARNESS_ENABLE_TOOL_LOOP | `false` | **Verified** — Grok §37 preflight: PM2 runtime=false |
| AGENT_HARNESS_ENABLE_WRITE_TOOLS | `false` | **Verified** — Grok §37 preflight: PM2 runtime=false |

---

## 6. Provider / Model Finding

**PROVIDER (intended): `xai`**  
**MODEL (intended): `grok-4.5`**

**RECONCILIATION UPDATE — Grok §37 read-only staging preflight confirmed current provider/model.**

| Classification | Value | Basis |
|----------------|-------|-------|
| `PROVIDER_MODEL_SOURCE_CONTRACT_VERIFIED` | **YES** | `XAI_ALLOWED_MODELS = ['grok-4.5']`; `grok-4.5` `selectable: true` in the frontend catalogue; source permits no other xAI model |
| `PROVIDER_MODEL_LAST_RUNTIME_EVIDENCE` | **xai / grok-4.5** | E2E-02 checkpoint §8 (`usage_records` DB evidence, 2026-08-14); E2E-01 checkpoint §8 |
| `PROVIDER_MODEL_CURRENT_STAGING_RUNTIME_VERIFIED` | **YES** | Grok §37 preflight (2026-08-17): `AI_PROVIDER=xai` confirmed in root `.env`; `PROVIDER_XAI_ENABLED=true` confirmed in PM2 runtime |

Source contract: **if** staging runs `AI_PROVIDER=xai`, then the only permissible model is `grok-4.5`. Staging is confirmed to run `AI_PROVIDER=xai`.

Actual model used is additionally proven after the fact from `usage_records.model` (criterion 15), which is authoritative DB evidence independent of the preflight check.

**Step 3 Phase A must re-confirm provider/model immediately before enabling the gate.** If changed: STOP before enabling `GLOBAL_EXECUTION_ENABLED`.

---

## 7. Application SHA Finding

**LAST_VERIFIED_STAGING_SHA:** `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` (historical — 03I checkpoint §31)  
**CURRENT_STAGING_SHA:** `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` (**Verified** — Grok §37 preflight, 2026-08-17)  
**CURRENT_STAGING_SHA_MATCHES_LAST_VERIFIED:** YES  
**STAGING_WORKTREE_CLEAN:** YES  
**LOCAL_HEAD:** `a72b0d00bfab198ca2f9f9690425dd0f56838a31`  
**DELTA_CLASSIFICATION:** Governance/docs only — zero production source changes  
**DEPLOYMENT_REQUIRED_BEFORE_STEP_3: NO**

All production source files for the intended E2E journey (confirm-build-apply route, proxy, intent gate, backend `triggerBuildApplyDeduction`, credit balance refresh, Git safe.directory fix) are present in SHA `54b5764d`.

**READ-ONLY STAGING VERIFICATION (Step 3 Phase A — do not execute now):**

```bash
ssh aisandbox-staging
git -C /opt/aisandbox rev-parse HEAD
# Expected: 54b5764d8645d80a44f5de1351ca8e7928c5c8f4

git -C /opt/aisandbox status --short
# Expected: (empty — clean worktree)
```

---

## 8. Deployment-Needed Decision

**DEPLOYMENT_NEEDED: NO**

SHA `54b5764d` contains all required 03D, 03G, 03H, and 03I fixes. No production source changes exist between that SHA and local HEAD. Grok §37 preflight confirmed staging HEAD is `54b5764d` with a clean worktree. Step 3 may proceed against the staging deployment without any rebuild or restart (beyond the controlled `GLOBAL_EXECUTION_ENABLED` enable/restore).

Step 3 Phase A must re-confirm staging HEAD immediately before runtime mutation. If Phase A finds a different staging HEAD, this conclusion is void: STOP and re-run the delta classification against the actual deployed SHA before proceeding.

---

## 9. Exact Build Prompt

**Use this prompt verbatim. Do not modify.**

```
Create a single file named `index.html` in this workspace. Its complete contents must be exactly:

<!doctype html>
<html>
<head><meta charset="utf-8"><title>E2E-03</title></head>
<body><h1>PRIVATE-BETA-E2E-03</h1><p>Builder workspace apply succeeded.</p></body>
</html>

Do not create or modify any other file.
```

**Properties:**

| Property | Value |
|----------|-------|
| Token cost | Minimal — short prompt, tiny deterministic output |
| Expected file actions | Exactly 1: create `index.html` |
| Expected executionIntent | `workspace_mutation` |
| Expected content | 7 HTML lines exactly as specified |
| Verifiable artifact | Keith reads content directly — no ambiguity |
| Preview-compatible | Static HTML — heading `PRIVATE-BETA-E2E-03` visible |
| Non-destructive | Adds one file to a fresh empty workspace |
| No dependencies | No npm, no build step, no packages |
| Confirmation-required | NO — 1 action, small content, simple file — not a risky batch |

**Why this prompt qualifies:**
- `isRiskyFileActionBatch([{action:'create', path:'index.html', content:'<7-line HTML>'}])` = false (1 action ≤ 3 threshold, content < 20,000 chars, path not risky)
- Therefore: no `awaiting-confirmation` state; apply proceeds immediately
- `qualifyBuildApplyConfirmation` will return `{applyStatus:'applied', totalActions:1, successCount:1}` on full success

---

## 10. Disposable Project / Session Plan

**PROJECT_NAME:** `E2E-03-Disposable-2026-08-17`

| Item | Plan |
|------|------|
| Project creation | Keith creates through normal Builder UI — click "New Project" in workspace project list, type name, click "Create Project" |
| Why disposable | Fresh workspace; no prior files; easy `index.html` confirmation; does not affect any existing project |
| Session creation | Automatic — system creates session and container on project open |
| Project ID capture | Cursor queries `SELECT id, name FROM projects ORDER BY created_at DESC LIMIT 5;` after Keith creates project |
| Session ID capture | Cursor queries `SELECT id, project_id FROM sessions ORDER BY created_at DESC LIMIT 5;` after project opens |
| Execution ID capture | Cursor queries `SELECT execution_id, execution_status, metadata->'aiExecutionResult'->>'executionIntent' AS intent, jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count FROM usage_records ORDER BY created_at DESC LIMIT 5;` |
| Cleanup timing | After all evidence preserved and Step 3 outcome classified |
| Project retention | **Retain — deletion is not supported by the platform** (see audit note below) |
| Session deletion | `DELETE /api/sessions/:sessionId` — verify HTTP 200, status=stopped, container removed. Route confirmed at `services/api-gateway/src/sessions/session.controller.ts:463` (`@Delete(':id')`, HTTP 200, rate-limited 5 req/60s) |

**AUDIT NOTE on project retention.** The original rationale ("retain as historical E2E evidence") implied retention was a discretionary choice. It is not. There is **no project delete endpoint** in the API Gateway — a repository-wide scan of `@Delete` decorators found session delete, session-file delete, API-key revoke, and admin session terminate, but no project deletion route. Retention is therefore the only supported outcome, and no deletion is authorized or possible without new source work.

Evidence durability after session cleanup is adequate without the project: `usage_records`, `credit_deduction_records`, `credit_balances`, and `git_checkpoints` all persist in PostgreSQL independently of session or container lifecycle, and this Stage Start plus the Step 4 checkpoint carry the governance record. The retained empty project is an inert artifact, not the evidence.

---

## 11. Starting Balance Plan

**Capture BEFORE enabling GLOBAL_EXECUTION_ENABLED. All three must match.**

```bash
ssh aisandbox-staging

# IMPORTANT: Do NOT use `source /opt/aisandbox/.env` — AUTH_EMAIL_FROM contains
# unquoted angle brackets that break bash parsing. Extract DATABASE_URL safely:
export DATABASE_URL=$(grep '^DATABASE_URL=' /opt/aisandbox/.env | cut -d= -f2-)

# B1: Keith's user ID
psql "$DATABASE_URL" -c "SELECT id AS user_id, email FROM users ORDER BY created_at ASC LIMIT 10;"

# B2: Authoritative DB balance
# NOTE: credit_balances uses owner_id + owner_type, NOT user_id.
# Capture Keith's user ID from the users table first (B1), then use it as owner_id.
psql "$DATABASE_URL" -c "SELECT owner_id, owner_type, balance, updated_at FROM credit_balances WHERE owner_id = '<keith-user-id>' AND owner_type = 'user';"
# Record: BALANCE_DB_BEFORE

# B3: Balance timestamp
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

**Keith also:**
1. Navigates to billing page: `https://staging.ainow.biz/en/app` (billing panel visible)
2. Triggers window focus to ensure fresh fetch (switch away and back, or manually dispatch)
3. Notes displayed balance: `BALANCE_BROWSER_BEFORE`
4. Reports DevTools `GET /api/billing/balance` response body: `BALANCE_API_BEFORE`

**Three-way reconciliation before execution:**

| Source | Value | Match? |
|--------|-------|--------|
| `credit_balances.balance` (DB) | BALANCE_DB_BEFORE | — |
| `GET /api/billing/balance` response `.balance` (API) | BALANCE_API_BEFORE | must = DB |
| Browser displayed balance (UI) | BALANCE_BROWSER_BEFORE | must = DB |

**If any three-way mismatch → STOP. Do NOT enable GLOBAL_EXECUTION_ENABLED. Investigate discrepancy before proceeding.**

**AUDIT ADDITION — balance sufficiency gate.** Also confirm `BALANCE_DB_BEFORE ≥ 10,000` credits. The gateway clamps a deduction to the available balance (`applied_credits = min(requested_credits, balance_before)`, §19). Against an expected cost of roughly 1,000–2,000 credits, a low balance would produce a clamped deduction with `overflow_credits > 0`, which would make criteria 11, 12, and 19 ambiguous rather than cleanly pass or fail. **If `BALANCE_DB_BEFORE < 10,000` → STOP before enabling the gate** and report to Keith; do not top up the balance as part of Step 3.

**Also record the window start timestamp** as `E2E_WINDOW_START` (from step B3). It bounds the payment-exclusion queries in §24.

---

## 12. Provider / Accounting Budget

| Budget item | Proposed count |
|-------------|---------------|
| Provider calls | Exactly 1 (xAI / grok-4.5 Build) |
| Credit deductions | Exactly 1 (via confirm-build-apply path) |
| GLOBAL_EXECUTION_ENABLED true windows | Exactly 1 bounded interval |
| Disposable projects | 1 (created; retained — deletion unsupported) |
| Disposable sessions / containers | 1 (created; deleted at cleanup) |
| Workspace mutation journeys | 1 |
| AI-written workspace files | 1 (`index.html`) |
| Operator-written workspace files | 1 (harmless edit to `index.html` — required by §21 to make the manual checkpoint meaningful) |
| **Automatic post-apply checkpoints (coherence flow)** | **1 — expected, unavoidable consequence of the authorized apply** |
| Manual checkpoint attempts | Exactly 1 |
| **Total expected checkpoint creations** | **2** |
| .env edits | **0** — root `.env` stays at `false` throughout; gate changed via PM2 runtime only (§13 reconciliation) |
| PM2 restarts | 2 (api-gateway only; +1 each only if verification fails, max 4) |
| Authenticated session DELETE | 1 |
| Browser UI observations (non-mutating) | Unrestricted |
| Ask provider calls | 0 (criterion 16 proven by source evidence) |
| Stripe / payment API calls | 0 |

**AUDIT CORRECTION.** The original §12 omitted the automatic post-apply checkpoint, the operator workspace edit, the .env edits, the PM2 restarts, and the cleanup DELETE. The automatic checkpoint in particular is a real Git + PostgreSQL + SQLite write that follows necessarily from the authorized apply — it must be inside the authorization budget, not treated as an unbudgeted side effect. §33 and §35 are corrected to match.

**Authorization status: PROPOSED ONLY — not authorized until Keith explicitly approves the statement in §35.**

---

## 13. GLOBAL_EXECUTION_ENABLED Transition Plan

### 13.1 Mechanism

**FINAL RECONCILIATION — Grok §37 staging preflight + PM2 documentation + EXEC-01 runtime evidence resolve all unknowns.**

| Property | Value | Evidence |
|----------|-------|----------|
| Flag source | `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED` — static getter returning `process.env.GLOBAL_EXECUTION_ENABLED === 'true'` (fail-safe: anything but exactly `'true'` is disabled, including `'TRUE'` and `'1'`) | `services/api-gateway/src/safety/kill-switch.config.ts:17-19` |
| Consuming process | `aisandbox-api-gateway` **only** — no other service reads this flag | `execution-safety.guard.ts:41` is the sole non-test consumer; `provider.validator.ts` reads it only at startup |
| Read timing | Re-read from `process.env` on **every** guard invocation, so there is no in-process cache. But `process.env` itself only changes when the process is restarted, so in practice the value is **fixed for the lifetime of the process**. | static getter, not a cached `static readonly` |
| Env origin | PM2 stored process environment — captured at original `pm2 start` time from a shell that had sourced the full root `.env`. No per-service `.env` exists at `/opt/aisandbox/services/api-gateway/.env` (Grok §37 S8). `dotenv/config` in `main.ts:1` finds no `.env` at the PM2 cwd and loads nothing. | Grok §37 S8: `API_GATEWAY_SERVICE_ENV_EXISTS=NO`; `main.ts:1`; deployment docs `04-APP-DEPLOYMENT-BASELINE-RUNBOOK.md:790-814` |
| PM2 `--update-env` semantics | **MERGE, not replace.** PM2 7.0.3 `--update-env` overlays the current shell environment onto the stored process environment. Stored vars not present in the shell are preserved. | PM2 docs: *"Via CLI, the environment is conservative"*; documented pattern `ENV_VAR=somethingnew pm2 restart app --update-env`; EXEC-01 runtime evidence (3 restarts from bare SSH shells preserved DATABASE_URL etc.) |
| Root `.env` sourcing | **UNSAFE and prohibited.** `AUTH_EMAIL_FROM` contains unquoted angle brackets causing bash `source` to fail. Four keys follow that line, including `XAI_API_KEY`. | Grok §37 staging evidence |
| No ecosystem file | Repository contains **no** PM2 ecosystem/config file. | repo-wide search |

**Resolved findings (previously blocking — now proven):**

1. **Which process consumes it?** `aisandbox-api-gateway` only.
2. **Is it read only at startup?** Effectively yes — `process.env` is fixed for the process lifetime. A restart is required for any change.
3. **Does PM2 `--update-env` preserve existing stored env?** **YES — proven.** PM2 docs state the CLI environment is "conservative" and document single-variable updates via `ENV_VAR=value pm2 restart app --update-env`. EXEC-01 performed 3 separate `pm2 restart aisandbox-api-gateway --update-env` operations from bare SSH shells that had NOT sourced the full `.env`. In all 3 cases, the gateway started successfully without crash-looping from missing required vars (DATABASE_URL, INTERNAL_SERVICE_KEY, etc.). If `--update-env` had replaced the stored env with the bare shell env, startup validators (`configuration.validator.ts`, `production-guardrails.validator.ts`) would have fail-fasted. They did not.
4. **Is inline `GLOBAL_EXECUTION_ENABLED=true pm2 restart ... --update-env` safe?** **YES.** This is the PM2-documented pattern for updating a single env var. PM2 merges the shell env (which includes the inline var) into the stored process env. Only the specified variable is overridden; all other stored vars are preserved.
5. **Must root `.env` be edited?** **NO.** Root `.env` cannot be safely sourced (bash parsing failure), and the inline PM2 approach does not require it. Root `.env` stays at `false` throughout, which is the safer durable safety record.
6. **What verification proves runtime true/false?** `pm2 env <id> | grep '^GLOBAL_EXECUTION_ENABLED'` + `/api/health/ready` HTTP 200.

### 13.2 Enable Sequence (Step 3 Phase C — do NOT execute now)

**RECONCILIATION-CORRECTED PROCEDURE.** Root `.env` is NOT edited. The inline PM2 env approach is the primary and only propagation mechanism. This is the PM2-documented pattern and is proven safe by EXEC-01 runtime evidence and PM2 7.0.3 merge semantics.

**Why root `.env` stays at `false`:**
- Root `.env` cannot be safely bash-sourced (`AUTH_EMAIL_FROM` unquoted angle brackets)
- The inline approach (`GLOBAL_EXECUTION_ENABLED=true pm2 restart ... --update-env`) directly sets the variable in the PM2 process env via merge
- The root `.env` at `false` is the durable safety record — if the PM2 daemon restarts or the server reboots, the gateway will restart with `false` from the stored PM2 env
- This removes two `.env` mutations from the Step 3 budget

```bash
ssh aisandbox-staging

# C0: Capture the api-gateway PM2 id once and reuse it
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
echo "GW_ID=$GW_ID"

# C1: Record the pre-change runtime value (for the checkpoint record)
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# Expected: GLOBAL_EXECUTION_ENABLED: false

# C2: Confirm root .env is at false (durable record — will NOT be edited)
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# C3: Record baseline restart count
pm2 describe aisandbox-api-gateway | grep -E 'restarts'

# C4: ENABLE — inline env var + --update-env merge.
#     PM2 merges the shell env into the stored process env.
#     GLOBAL_EXECUTION_ENABLED=true overrides the stored false.
#     All other stored vars (DATABASE_URL, INTERNAL_SERVICE_KEY, etc.) are preserved.
GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env

# C5: Wait for startup validation to complete
sleep 8

# C6: Verify PM2 runtime env — THE authoritative propagation proof
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# REQUIRED: GLOBAL_EXECUTION_ENABLED: true

# C7: Verify gateway readiness (proves startup validation passed, not crash-looping)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200

# C8: Verify online and restart count incremented by exactly 1
pm2 list | grep aisandbox-api-gateway
# REQUIRED: online, restart count = baseline + 1

# C9: Verify critical env vars still present (presence only — no values printed)
pm2 env "$GW_ID" | grep -c '^DATABASE_URL'          # REQUIRED: 1
pm2 env "$GW_ID" | grep -c '^INTERNAL_SERVICE_KEY'   # REQUIRED: 1
pm2 env "$GW_ID" | grep -c '^XAI_API_KEY'            # REQUIRED: 1

# C10: FALLBACK — only if C6 shows anything other than true.
#      Repeat the inline approach (it is the only mechanism).
GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
sleep 8
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'   # REQUIRED: true
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready  # REQUIRED: 200
```

**Do NOT proceed to Phase D (Keith browser submission) until C6 (or C10) confirms exactly `true` AND readiness confirms HTTP 200 AND the gateway is `online` with a sane restart count AND critical env vars are present (C9).**

**If the fallback also fails, or the gateway crash-loops: STOP.** Immediately restore per §13.3 and escalate. Do not attempt further restarts or any provider call.

### 13.3 Restoration Sequence (Step 3 Phase K — MANDATORY regardless of outcome)

**Restoration must occur IMMEDIATELY after terminal outcome of the one provider call — before evidence investigation.**

```bash
ssh aisandbox-staging
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")

# R1: Confirm root .env is still at false (never edited — should be unchanged)
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# R2: RESTORE — inline env var + --update-env merge (same mechanism as C4)
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env

# R3: Wait for startup validation
sleep 8

# R4: Verify PM2 runtime restored — authoritative proof
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# REQUIRED: GLOBAL_EXECUTION_ENABLED: false

# R5: Verify readiness
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200

# R6: Verify online
pm2 list | grep aisandbox-api-gateway
# REQUIRED: online

# R7: FALLBACK — only if R4 shows anything other than false
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 8
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'   # REQUIRED: false
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready  # REQUIRED: 200
```

**Note on the fail-safe direction.** Restoration is inherently safer than enabling: the getter treats any value other than exactly `'true'` as disabled, so an *unset* or malformed variable also disables execution. Enabling can fail silently only in the sense of remaining disabled — never the reverse.

**Note on root `.env`.** Root `.env` was never edited and remains at `false`. This is the durable safety record. If the PM2 daemon or server restarts outside the E2E window, the gateway will restart with `false` from the stored PM2 env (which was restored by R2/R7). The root `.env` at `false` is an additional safety layer.

**Criterion 17 evidence** requires both: `.env` shows `false` (never changed) **and** `pm2 env` runtime shows `false` (restored by this procedure).

---

## 14. BILLING_CHARGES_ENABLED Invariant

`BILLING_CHARGES_ENABLED=false` throughout all steps of E2E-03.

**Preflight verification (Phase A):**
```bash
grep '^BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# Expected: BILLING_CHARGES_ENABLED=false

pm2 env <api-gateway-id> | grep BILLING_CHARGES_ENABLED
# Expected: BILLING_CHARGES_ENABLED: false
```

**Postflight verification (Phase K):**
Same commands — both must still show `false`.

No Stripe integration, no payment API calls, no payment webhooks. This flag is a hard kill switch controlled by `ChargeReadinessService` in the billing module.

---

## 15. Harness / Plain-Path Finding

| Property | Value | Source |
|----------|-------|--------|
| AGENT_HARNESS_ENABLE_TOOL_LOOP | `false` | ai-service env; `agent-harness.config.ts` line 45-46 |
| AGENT_HARNESS_ENABLE_WRITE_TOOLS | `false` | ai-service env |
| Selected execution path | `plain` | AGENT_HARNESS_ENABLE_TOOL_LOOP=false → plain path |
| harnessVersion | `null` | plain path — no harness active |

**PLAIN_PATH_CONFIRMED: YES**

### Automatic Pre-Apply Checkpoint on Plain Path

**AUTOMATIC_PRE_APPLY_CHECKPOINT_ON_PLAIN_PATH: NO** (pre-apply — no checkpoint before files are written)

**AUTOMATIC_POST_APPLY_CHECKPOINT: YES** — the `runAiActionCoherence` function in `frontend/components/workspace/workspace-ai-coherence.logic.ts` creates an automatic checkpoint AFTER a successful apply, with description `"AI: applied workspace file actions"`. This is normal expected behavior on the plain Builder path.

The order of events after a successful Build + apply on the plain path:
1. `applySequentialFileActions` → files written to workspace
2. `setExecutionFileActionState(applyStatus: 'applied')` → React state updated
3. `confirmBuildApplyIfQualifying` → `requestBuildApplyConfirmation` → `POST /api/ai/executions/:executionId/confirm-build-apply` → **deduction triggered**
4. `runAiActionCoherence` (triggered by state change to `applied`) → refreshes file tree, editor, preview → **auto-checkpoint created** (POST /api/sessions/:sessionId/checkpoints, description: "AI: applied workspace file actions") → refreshes checkpoint list

The **auto-checkpoint** (step 4) already exercises and proves the 03I fix. The **manual checkpoint** (criterion 20) is a SEPARATE user-triggered action (Keith clicking the checkpoint button in the UI) that produces a SECOND checkpoint after the auto-checkpoint.

**AUTOMATIC_CHECKPOINT_ALREADY_PROVES_03I_FIX: YES**  
**MANUAL_CHECKPOINT_STILL_REQUIRED_FOR_CRITERION_20: YES** (per criterion text)

**AUDIT CONFIRMATION.** This finding is verified correct against current source:

- No pre-apply checkpoint exists on the plain Builder path. `maybeApplyExecutionFileActions` → `applyExecutionFileActions` writes files directly; no checkpoint is created before the writes (`frontend/app/[locale]/app/page.tsx:4981-5032`).
- The automatic post-apply checkpoint is real and does commit. `runAiActionCoherence` calls `createCheckpoint(...)` → `createWorkspaceCheckpoint` → `POST /api/sessions/:sessionId/checkpoints` **without** `allowEmpty` (`workspace-ai-coherence.logic.ts:99-108`; `page.tsx:4898-4903`). Because `index.html` was just written, the workspace is dirty and `git.service.ts commit()` takes the normal staged-commit path, returning a real `commitHash` and `filesChanged`.
- The coherence run is guarded per execution by `acquireExecutionCoherenceGuard`, so exactly one automatic checkpoint occurs per execution.

**Mutation accounting (authoritative):**

| Quantity | Value |
|----------|-------|
| `AUTOMATIC_POST_APPLY_CHECKPOINT_EXPECTED` | **1** |
| `MANUAL_CHECKPOINT_ATTEMPTS_AUTHORIZED_PROPOSED` | **1** |
| `TOTAL_EXPECTED_CHECKPOINT_CREATIONS` | **2** |

The automatic checkpoint is an unavoidable consequence of the authorized workspace apply. It is a genuine Git + PostgreSQL + SQLite write and is therefore inside the authorization budget (§12, §33) and named explicitly in the authorization statement (§35). It must not be treated as an unbudgeted automatic side effect.

**Consequence for criterion 20 — see §21.** Because the automatic checkpoint commits `index.html` first, the workspace is clean when the manual checkpoint runs. This changes what the manual checkpoint can prove and required a runbook correction.

---

## 16. File-Actions / Workspace Apply Evidence

Keith must report:
1. `index.html` appears in the file tree — YES/NO
2. Editor shows exact 7-line HTML content — YES/NO
3. Preview renders heading `PRIVATE-BETA-E2E-03` — YES/NO
4. Preview renders paragraph `Builder workspace apply succeeded.` — YES/NO

Cursor also queries:
```bash
psql "$DATABASE_URL" -c "
SELECT
  execution_id,
  execution_status,
  tokens_used,
  model,
  metadata->'aiExecutionResult'->>'executionIntent' AS intent,
  jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count,
  metadata->'aiExecutionResult'->'fileActions'->0->>'path' AS first_file_action_path
FROM usage_records
WHERE execution_id = '<executionId>';
"
```

Expected:
- `execution_status = 'completed'`
- `intent = 'workspace_mutation'`
- `file_action_count = 1`
- `first_file_action_path = 'index.html'`

---

## 17. build_awaiting_apply Proof

**Exact evidence chain proving criterion 10:**

Source: `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` lines 780-791

```typescript
const executionIntent = this.readPersistedExecutionIntent(record.metadata);
if (executionIntent === 'workspace_mutation') {
  this.logger.log(JSON.stringify({
    event: 'finalize_accounting.build_awaiting_apply',
    ...
  }));
  return { triggered: false, reason: 'build_awaiting_apply' };
}
```

**Runtime execution path:**
1. AI worker completes → calls `notifyExecutionComplete(executionId)` → `POST /api/internal/executions/:executionId/finalize-accounting`
2. `InternalAccountingController.finalizeAccounting` → `usageLedgerService.triggerDeductionForExecution(executionId)`
3. `triggerDeductionForExecution` reads `metadata.aiExecutionResult.executionIntent`
4. If `executionIntent === 'workspace_mutation'` → logs `finalize_accounting.build_awaiting_apply` → returns `{triggered: false, reason: 'build_awaiting_apply'}`
5. **No deduction occurs**

**Exact DB evidence of NO deduction before apply:**
```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS deduction_count
FROM credit_deduction_records
WHERE source_event_id = '<executionId>';
"
# Expected immediately after AI completion, before workspace apply: 0
```

**Exact API Gateway log evidence:**
```bash
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep 'build_awaiting_apply'
# Expected: one line containing: event: 'finalize_accounting.build_awaiting_apply'
```

**This is the authoritative proof of criterion 10.** Zero deduction records before apply = build_awaiting_apply gate was active.

---

## 18. confirm-build-apply Proof

**Exact route and lifecycle:**

| Property | Value |
|----------|-------|
| Browser-facing route | `POST /api/ai/executions/:executionId/confirm-build-apply` |
| Handled by | Next.js App Router route: `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` |
| Routing mechanism | 03G fallback rewrite — dynamic Next.js route takes precedence over Gateway proxy |
| Request body | `{ applyStatus: 'applied', totalActions: N, successCount: N }` |
| Request source | Browser (automatic — `requestBuildApplyConfirmation` called by `confirmBuildApplyIfQualifying` in `applyExecutionFileActions`) |
| Auth | Session cookie (`aisandbox_session`) forwarded by proxy |
| Server-side proxy | `proxyConfirmBuildApply` in `frontend/lib/build-apply-confirm-proxy.server.ts` |
| Internal route called | `POST /api/internal/executions/:executionId/confirm-build-apply` with `X-Internal-Service-Key` (server-side only) |
| Expected response | HTTP 200, `{ executionId, triggered: true, reason: 'ok' }` |

**Trigger condition:** `qualifyBuildApplyConfirmation(applyResult)` returns non-null (applyStatus='applied', totalActions>0, successCount=totalActions, all results 'success').

**Evidence in API Gateway logs:**
```bash
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep 'confirm_build_apply'
# Expected two lines:
# 1. event: 'confirm_build_apply.request_received'
# 2. event: 'confirm_build_apply.deduction_triggered'
```

**DB evidence after deduction:**
```bash
psql "$DATABASE_URL" -c "
SELECT
  id,
  source_event_id,
  applied_credits,
  balance_before,
  balance_after,
  created_at
FROM credit_deduction_records
WHERE source_event_id = '<executionId>';
"
# Expected: exactly 1 row
```

**Idempotency:** `PersistentCreditDeductionGateway.applyDeduction` deduplicates via `sourceEventId = executionId`. A second call with the same executionId would be silently skipped. This proves criterion 13.

---

## 19. Deduction / Idempotency Proof

**Which DB fields establish deduction evidence:**

| Field | Table | Meaning |
|-------|-------|---------|
| `source_event_id` | `credit_deduction_records` | = executionId — links deduction to execution |
| `requested_credits` | `credit_deduction_records` | credits computed from usage = `tokens_used × 1` |
| `applied_credits` | `credit_deduction_records` | credits actually deducted = `min(requested_credits, balance_before)` |
| `overflow_credits` | `credit_deduction_records` | `max(requested_credits − balance_before, 0)` — **must be 0** for a clean PASS |
| `balance_before` | `credit_deduction_records` | must = BALANCE_DB_BEFORE |
| `balance_after` | `credit_deduction_records` | must = balance_before − applied_credits |
| `balance` | `credit_balances` | must = balance_after after deduction |

**AUDIT-VERIFIED arithmetic (traced through current source, not inferred from history):**

1. `emitDeductionAttempt` builds one line item: `category: 'model_tokens'`, `unit: 'token'`, `unitCount: record.tokensUsed ?? 0`, `creditsRequested: 0` (`usage-ledger.service.ts:993-1011`).
2. The caller's `creditsRequested` is **advisory and discarded**; `CreditCalculationService.calculateLineItemCredits` recalculates deterministically as `unitCount × creditsPerUnit` (`credit-calculation.service.ts:58-80`).
3. `CREDIT_RATES.model_tokens.creditsPerUnit = 1` (`credit-ledger/config/credit-rates.config.ts:14-19`, rate version `2026-07-v1`).
4. Therefore `requested_credits = tokens_used × 1 = tokens_used`. **1 credit = 1 token is CONFIRMED** for this exact Build deduction path.
5. No fees, multipliers, reservations, taxes, or provider-derived pricing intervene. There is exactly one line item and no additional accounting field participates in the balance computation (`persistent-credit-deduction.gateway.ts:78-135`).

**Two corrections to the original claim:**

- **`applied_credits = tokens_used` only holds when the balance is sufficient.** The gateway computes `applied_credits = min(requested_credits, available_balance)` and `overflow_credits = max(requested_credits − available_balance, 0)`. If the starting balance were below the token cost, the deduction would be clamped and `overflow_credits > 0`. The runbook must therefore assert `requested_credits = applied_credits = tokens_used` **and** `overflow_credits = 0`, rather than assuming the first equality.
- **Added preflight guard.** Phase B must confirm `BALANCE_DB_BEFORE` comfortably exceeds the expected token cost (use ≥ 10,000 credits as the threshold against an expected ~1,000–2,000). If it does not, STOP before enabling the gate — a clamped deduction would make criteria 11/12/19 ambiguous rather than cleanly failing.

**Documented observation (no action, no source change).** The `model_tokens` rate declares `unit: '1K_tokens'` while the caller passes raw token counts with `unit: 'token'`. Numerically the result is 1 credit per raw token, which matches all prior runtime evidence (E2E-01: 1251 tokens → 1251 credits). This is a pre-existing unit-semantics inconsistency in the placeholder rate config, not an E2E-03 defect, and is out of scope here. Do not change it in this task.

**Arithmetic verification:**
```
requested_credits   = usage_records.tokens_used          (rate 1 credit / token)
overflow_credits    = 0                                  (REQUIRED)
applied_credits     = requested_credits                  (REQUIRED — implies no clamping)
BALANCE_DB_AFTER    = BALANCE_DB_BEFORE − applied_credits
```

**Exact expected deduction amount:** NOT pre-determined. Determined from `usage_records.tokens_used` for the specific execution. The deduction will be approximately 1,000–2,000 credits based on E2E-01 (1251, 1264) and E2E-02 (1146) evidence. Do NOT fix an expected amount — verify arithmetic from actual DB values.

**Idempotency proof:** Query `credit_deduction_records WHERE source_event_id = '<executionId>'` — must return exactly 1 row at all inspection points after deduction.

---

## 20. Credit-Display Proof

**Post-03H mechanism:** `useBillingData` hook in `frontend/hooks/useBillingData.ts` now re-fetches on window focus event. `GET /api/billing/balance` now returns `Cache-Control: no-store`.

**Step 3 observation sequence:**

| Step | Action | Expected |
|------|--------|----------|
| BEFORE Build | Keith notes browser balance | = BALANCE_DB_BEFORE |
| AFTER AI completion, BEFORE apply | Do NOT expect balance change — deduction not yet triggered | = BALANCE_DB_BEFORE |
| AFTER apply + confirm-build-apply | Keith focuses browser window (switch away/back, or tab switch) | Focus triggers re-fetch → balance updates |
| Observe network in DevTools | `GET /api/billing/balance` — HTTP 200 | `.balance = BALANCE_DB_AFTER` |
| Displayed balance | Formatted with `.toLocaleString()` | Numerically = BALANCE_DB_AFTER |
| DB balance | `SELECT balance FROM credit_balances WHERE owner_id = '<keith-user-id>' AND owner_type = 'user'` | = BALANCE_DB_AFTER |

**Three-way final reconciliation:**

```
BALANCE_BROWSER_AFTER (displayed) = BALANCE_API_AFTER (GET /api/billing/balance .balance) = BALANCE_DB_AFTER (credit_balances.balance)
```

All three must agree. Discrepancy = FAIL / criterion 19 fails.

**Note on timing:** The focus re-fetch is triggered by window focus, not automatically after confirm-build-apply. Keith should manually trigger focus (switch to another app and back, or use Alt+Tab) to force a re-fetch before reading the browser balance.

---

## 21. Manual Checkpoint Proof

**Context:** The AI coherence flow will create an AUTOMATIC checkpoint (description: "AI: applied workspace file actions") after the successful apply. Criterion 20 requires a MANUAL checkpoint (Keith clicking the checkpoint button in the Builder UI). These are two separate checkpoint events.

---

### 21.0 AUDIT CORRECTION — clean-workspace ambiguity (was a Step 3 blocker)

**The problem.** The automatic checkpoint commits `index.html` first, leaving the workspace **clean**. The UI "Save Point" button calls `createWorkspaceCheckpoint` **without** `allowEmpty` (`page.tsx:2873-2877` — only the auth-module pre-install path passes `allowEmpty: true`, at `page.tsx:4721-4726`). Tracing that through current source:

1. `CheckpointsController.createManualCheckpoint` passes `body?.allowEmpty === true` → `false` (`checkpoints.controller.ts:50`).
2. `git.service.ts commit()` reads `git status --porcelain`, finds **no** changed entries, and because `allowEmpty` is falsy returns `{ message: 'No changes to commit', commitHash: null }` (`git.service.ts:88-94`).
3. `CheckpointsService.createManualCheckpoint` returns that result unchanged, and because `commitHash` is falsy it records **no** `git_checkpoints` row (`checkpoints.service.ts:188-201`).
4. The controller is annotated `@HttpCode(HttpStatus.CREATED)` (`checkpoints.controller.ts:33`), so the response is still **HTTP 201** — with `commitHash: null` and no new commit, no new PostgreSQL row, and no new SQLite row.

**Why this blocked Step 3.** Criterion 20 reads: *"Manual checkpoint creation returns HTTP 201; Git + PG + SQLite reconcile."* Under the original runbook the first clause would pass **degenerately** while the second clause would have nothing to reconcile. That is an ambiguous outcome that could be argued as either PASS or FAIL — unacceptable for a never-limitation-eligible launch-critical criterion.

**Resolution (adopted).** Introduce exactly one small, non-AI, operator-made workspace change between the automatic and manual checkpoints, so the manual checkpoint commits real content:

- Keith opens `index.html` in the editor, appends a single HTML comment line `<!-- E2E-03 manual checkpoint marker -->`, and saves through the normal editor save flow.
- This uses the existing authenticated workspace file-write path. It involves **no provider call, no AI execution, no credit deduction, and no new execution record**.
- The workspace is then dirty by exactly one file, so the manual checkpoint takes the normal staged-commit path and returns HTTP 201 with a real `commitHash` and `filesChanged: 1` — giving genuine Git + PostgreSQL + SQLite reconciliation.

This is budgeted explicitly as **1 operator-written workspace file** in §12/§33 and is named in the authorization statement in §35. It is not an arbitrary second mutation: it is the minimum change that makes criterion 20 operationally unambiguous.

**Rejected alternatives, and why:**

| Alternative | Rejected because |
|-------------|------------------|
| Send `allowEmpty: true` | The UI Save Point button does not send it. Forcing it would require a source change (prohibited) or bypassing the real UI, which would no longer prove the user-facing path. |
| Accept HTTP 201 + `commitHash: null` as PASS | Satisfies the criterion's letter but proves no reconciliation, and would record a launch-critical PASS on degenerate evidence. |
| Run the manual checkpoint before the apply | Impossible — the apply and its automatic checkpoint are fully automatic (§25 Phase E audit note); there is no operator-controlled window. |

**Reconciliation with 03I.** 03I fixed a Git `safe.directory` defect that made checkpoint creation return HTTP 500 and explicitly preserved existing `allowEmpty` semantics (03I checkpoint §212). The `No changes to commit` / `commitHash: null` path is therefore intended pre-existing behavior, not a regression, and not something to change here. 03I's fix is proven by *any* successful checkpoint commit — which the automatic checkpoint alone already demonstrates.

**Criterion 20 evidence requirement (authoritative for Step 3):** HTTP 201 **and** a non-null `commitHash` **and** three-way Git/PostgreSQL/SQLite agreement on that hash. A `commitHash: null` response must be classified **FAIL — ambiguous evidence**, not PASS.

---

**Manual checkpoint timing:** After AI completion, workspace apply, accounting evidence captured, credit display evidence captured, and the §21.0 marker edit saved. This is the final evidence step before cleanup.

**Exact API route:**
```
POST /api/sessions/:sessionId/checkpoints
```

**Route code:** `CheckpointsController.createManualCheckpoint` in `services/api-gateway/src/checkpoints/checkpoints.controller.ts` line 32

**Keith's UI action:** Click the "Save Point" / checkpoint button in the Builder workspace header.

**Expected response:**
```json
HTTP 201
{
  "message": "Changes committed successfully",
  "commitHash": "<git-hash>",
  "filesChanged": <N>
}
```

### 21.1 AUDIT CORRECTION — authoritative SQLite database location

**The original runbook's SQLite path `/workspace/.sandbox.db` inside the session container does not exist anywhere in this codebase.** A repository-wide search found no reference to `.sandbox.db`. That command would have failed or, worse, silently produced no rows and been misread as a reconciliation failure.

**Verified architecture:**

| Question | Answer | Evidence |
|----------|--------|----------|
| Where does the authoritative container-manager SQLite DB live? | `<repo-root>/database/aisandbox.db` → on staging: **`/opt/aisandbox/database/aisandbox.db`** | Every container-manager service resolves `path.join(__dirname, '../../../..', 'database', 'aisandbox.db')`. From compiled `dist/git/`, `../../../..` walks `dist/git` → `dist` → `container-manager` → `services` → repo root. See `services/container-manager/src/git/git.service.ts:19`, and identically `sessions.service.ts:60`, `projects.service.ts:28`, `governance-events.service.ts:21`, `usage-aggregation.service.ts:22`, `quota-evaluation.service.ts:32` |
| Host-level or session-container-local? | **Host-level.** One shared SQLite file on the staging host, opened by the container-manager process. It is **not** inside any session container and is not per-session. | `better-sqlite3` opens a host filesystem path in the container-manager Node process |
| Is `/workspace/.sandbox.db` valid? | **NO — it does not exist.** `/workspace` is the container-local Git working tree only. | no source reference exists |
| Corroborating staging evidence | 03I inspected `/opt/aisandbox/database/aisandbox.db`, which matches. The same repo-root resolution was the subject of `PRIVATE-BETA-STAGING-EXECUTION-04D1` (`docs/PRIVATE-BETA-STAGING-EXECUTION-04D1-EVIDENCE-REVIEW.md:153` — `expected: /opt/aisandbox/database/aisandbox.db`) | prior checkpoints |

Consequences for Step 3: SQLite is queried **on the staging host**, not via `docker exec`. `sqlite3` need not be installed in the session container. Because the file is shared across sessions, every query must filter by `session_id` — an unfiltered `ORDER BY created_at DESC LIMIT 5` could return other sessions' rows.

---

**Cursor captures evidence (corrected — all read-only):**

```bash
# --- Git evidence: container-local working tree (this part IS in the container) ---
docker exec <container-id> git -C /workspace log --oneline -n 5
# Expected: newest commit = the manual checkpoint; immediately prior = the automatic
#           'AI: applied workspace file actions' checkpoint

# --- PostgreSQL evidence (authoritative ledger) ---
psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<sessionId>'
ORDER BY created_at DESC
LIMIT 5;
"
# Expected: 2 rows for this session — automatic then manual

# --- SQLite evidence: HOST-LEVEL database, filtered by session ---
# sqlite3 CLI is ABSENT on staging (Grok §37 S17). Use Python 3 read-only URI.
python3 -c "
import sqlite3, json
conn = sqlite3.connect('file:/opt/aisandbox/database/aisandbox.db?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute('''
  SELECT git_commit_hash, description, files_changed, message_number, created_at
  FROM checkpoints
  WHERE session_id = ?
  ORDER BY created_at DESC
  LIMIT 5
''', ('<sessionId>',)).fetchall()
for r in rows:
    print(json.dumps(dict(r)))
conn.close()
"
# Expected: 2 rows for this session — automatic then manual
```

**Reconciliation rules:**
- Manual checkpoint response `commitHash` = container `git log` newest hash = PostgreSQL `commit_hash` = SQLite `git_commit_hash`
- All four must agree on the same non-null hash
- Both checkpoints (automatic + manual) must appear in PostgreSQL and SQLite, and counts must match at 2 rows for this session
- SQLite `message_number = 0` is acceptable (nullable mapping artifact — established in 03I)
- `filesChanged` for the manual checkpoint must be `1` (the §21.0 marker edit)
- All SQLite/PostgreSQL queries MUST filter on `session_id` — the SQLite database is shared across sessions

**This checkpoint must NOT affect credits or provider usage (expected: 0 impact).**

---

## 22. Ask Semantics Proof

**METHOD: Source evidence — no live Ask provider call.**

Source proves `triggerDeductionForExecution` in `usage-ledger.service.ts` lines 780-793:
```typescript
if (executionIntent === 'workspace_mutation') {
  return { triggered: false, reason: 'build_awaiting_apply' };  // Build path
}
await this.emitDeductionAttempt(record);  // Ask / other paths proceed normally
```

The `else` branch (no return after workspace_mutation check) calls `emitDeductionAttempt` for all non-workspace_mutation intents, including Ask (`conversation`) intent. Ask semantics are therefore unchanged — the `build_awaiting_apply` gate only intercepts `workspace_mutation`.

**No live Ask provider call is authorized or needed.** Source evidence is the correct proof method (same approach as E2E-02 criterion 16 — PASS).

**STEP_3_LIVE_ASK_CALL_AUTHORIZED: NO**

**AUDIT CONFIRMATION — verdict: CORRECT, retained as written.** Criterion 16 is registered as *"Ask semantics remain unchanged (non-provider regression evidence; no live Ask call)"*. The criterion **itself** scopes the evidence to non-provider regression evidence, so source evidence is not a limitation — it is the registered method. There is no wording/evidence mismatch to flag.

The source claim is verified against current code: `triggerDeductionForExecution` returns early **only** when `executionIntent === 'workspace_mutation'` (`usage-ledger.service.ts:780-791`). Every other intent, including Ask/`conversation`, falls through to `await this.emitDeductionAttempt(record)` at line 793 and deducts at completion as before. The `build_awaiting_apply` gate is intent-scoped and cannot affect Ask accounting.

**No additional provider call is added.** Criterion 16 remains provable without one.

---

## 23. Ownership / Auth Proof

**Method:** Normal authenticated session flow — same as E2E-02 criterion 9 (PASS).

Evidence chain:
- Keith is authenticated as Keith's staging user
- `SessionCookieGuard` validates session cookie on `POST /api/sessions/:sessionId/checkpoints`
- `proxyConfirmBuildApply` in proxy server: `GET /api/auth/me` validates session → `readAuthMeUserId` extracts userId → execution lookup validates ownership
- `CheckpointsController.createManualCheckpoint`: `session.userId !== userId` → 404 if mismatch
- No cross-user access attempted

**Evidence:** All authenticated endpoints return HTTP 2xx (not 401/403/404-ownership). Keith's session cookie is the only auth credential used.

**AUDIT CONFIRMATION — verdict: CORRECT, retained as written.** Criterion 9 is registered as *"Ownership / auth checks hold"* — a claim that the checks function correctly for the legitimate owner, not a claim that they reject attackers. Normal 2xx responses across the authenticated journey plus the absence of 401/403/404 is sufficient, and matches the E2E-02 criterion 9 precedent (PASS on the same basis).

**No destructive or adversarial testing is added.** Cross-user access attempts, forged cookies, and ownership-mismatch probes are outside the registered criteria, would require a second user identity, and would add unbudgeted mutations. The ownership guards are covered by existing automated tests; `CheckpointsController` returns 404 on `session.userId !== userId` (`checkpoints.controller.ts:41-43`) for every checkpoint route, which is source-evident without runtime probing.

---

## 24. Payment Exclusion Proof

**Primary:** `BILLING_CHARGES_ENABLED=false` throughout — verified in preflight (Phase A) and postflight (Phase K).

**Source:** `BILLING_CHARGES_ENABLED !== 'false'` defaults to `false` — hardest possible payment gate.

**AUDIT CORRECTION — flag-only evidence is not sufficient on its own.**

`BILLING_CHARGES_ENABLED=false` proves the gate was closed, but criterion 14 asserts *"no external payment charge … no Stripe activity"* — an outcome claim. Proving an outcome by configuration alone is the same category of error as proving current staging state from historical evidence. The negative outcome should be observed directly, and doing so is cheap and read-only.

**Verified schema surface.** A scan of `services/api-gateway/src/entities` found **no** `payments`, `charges`, or `payment_intents` table. The payment-adjacent tables that do exist are `webhook_events` (`webhook-event.entity.ts:37`) and `invoices` (`invoice.entity.ts:39`). Those two are the complete surface to check.

**DB evidence (read-only, bounded to the E2E window):**
```bash
# Record the window bounds first:
#   E2E_WINDOW_START = timestamp taken at Phase B (before the gate is enabled)
#   E2E_WINDOW_END   = timestamp taken at Phase K (after restoration)

# Zero payment-provider webhook activity in the window
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS webhook_events_in_window
FROM webhook_events
WHERE received_at >= '<E2E_WINDOW_START>' AND received_at <= '<E2E_WINDOW_END>';
"
# REQUIRED: 0

# Zero invoices generated in the window
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS invoices_in_window
FROM invoices
WHERE created_at >= '<E2E_WINDOW_START>' AND created_at <= '<E2E_WINDOW_END>';
"
# REQUIRED: 0
```

**Criterion 14 evidence = all three:** `BILLING_CHARGES_ENABLED=false` at preflight AND postflight, zero `webhook_events` in the window, zero `invoices` in the window.

Note that a credit deduction is **not** a payment. Exactly one row in `credit_deduction_records` is expected and required (criterion 12); it is internal credit accounting with no external money movement.

---

## 25. Exact Browser / Manual Runbook

### Phase A — Preflight (Cursor performs via SSH)

1. `ssh aisandbox-staging`
1a. Extract `DATABASE_URL` safely (do NOT source root `.env` — see §11): `export DATABASE_URL=$(grep '^DATABASE_URL=' /opt/aisandbox/.env | cut -d= -f2-)` — verify: `psql "$DATABASE_URL" -c "SELECT 1;"` → success. Re-run this extraction if the SSH session reconnects.
2. `pm2 list` — verify all 5 processes online
3. Health checks: api-gateway (4000), ai-service (4001), container-manager (4002), frontend
4. `grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env` → must be `false`
5. `grep '^BILLING_CHARGES_ENABLED' /opt/aisandbox/.env` → must be `false`
6. `grep '^AI_PROVIDER' /opt/aisandbox/.env` → must be `xai`
7. `git -C /opt/aisandbox rev-parse HEAD` → establishes `CURRENT_STAGING_SHA`; must equal `54b5764d8645d80a44f5de1351ca8e7928c5c8f4`
8. `git -C /opt/aisandbox status --short` → must be empty (clean)
9. PM2 GLOBAL_EXECUTION_ENABLED runtime env verify → `false`
10. INTERNAL_SERVICE_KEY presence check (count only — no value printed): `pm2 env <api-gateway-id> | grep -c INTERNAL_SERVICE_KEY` → ≥ 1
11. `pm2 describe aisandbox-api-gateway` → record `pm_cwd` and baseline restart count (needed to confirm §13 propagation and to detect crash-looping)
12. `ls -la /opt/aisandbox/database/aisandbox.db` → exists (authoritative checkpoint SQLite DB, §21.1)
13. `command -v sqlite3` → available, else report and adjust the §21 evidence method

**If any Phase A check fails: STOP. Do not proceed to Phase B.**

**Note:** if the §37 read-only preflight was already completed and its results still hold, Phase A is a re-confirmation rather than first discovery. Re-run it regardless — staging state can drift between sessions.

**Cursor notifies Keith: "Phase A PASS — proceed to Phase B balance capture."**

---

### Phase B — Starting Balance (Keith + Cursor)

Keith:
1. Navigate to `https://staging.ainow.biz/en/app`
2. Log in if needed
3. Open billing panel — note displayed balance: `BALANCE_BROWSER_BEFORE`
4. Open DevTools Network tab
5. Trigger window focus (switch to another app and back)
6. Note `GET /api/billing/balance` response body `.balance`: `BALANCE_API_BEFORE`
7. Report to Cursor: BALANCE_BROWSER_BEFORE, BALANCE_API_BEFORE

Cursor via SSH:
8. Query DB for BALANCE_DB_BEFORE (see §11 commands B1-B3)
9. Three-way reconciliation: BALANCE_BROWSER_BEFORE = BALANCE_API_BEFORE = BALANCE_DB_BEFORE?

**If mismatch: STOP. Do not enable execution gate. Investigate discrepancy.**  
**If match: Cursor notifies Keith: "Phase B PASS — balance confirmed. Proceed to Phase C."**

---

### Phase C — Enable Execution Gate (Cursor via SSH)

Cursor executes the GLOBAL_EXECUTION_ENABLED enable sequence from §13.2 (C1–C8).

**Cursor notifies Keith: "Phase C PASS — GLOBAL_EXECUTION_ENABLED=true verified. Keith may begin Phase D browser submission."**

---

### Phase D — Keith Browser Submission (Keith performs manually)

1. Navigate to `https://staging.ainow.biz/en/app`
2. Create project `E2E-03-Disposable-2026-08-17`:
   - Click "New Project" button
   - Type project name
   - Click "Create Project"
3. Wait for project to open in fresh session (file tree visible — empty)
4. Confirm Builder mode is selected (not Ask)
5. Confirm model selector shows `grok-4.5` (xAI provider)
6. Paste the EXACT Build prompt from §9 into the chat input
7. Submit ONCE — do not click again even if response appears slow
8. Wait for execution to complete — watch for file actions to appear
9. Observe if `index.html` appears in file tree (may happen automatically as actions are applied)
10. Report to Cursor: execution status, any visible file actions, any errors

**Do NOT click any additional Submit after the first submission.**  
**One provider call only — any second submission requires fresh Keith authorization.**

---

### Phase E — Prove the Deferred-Deduction Ordering (Cursor via SSH)

> **AUDIT CORRECTION — this phase was rewritten. The original version was operationally impossible and would have produced a false FAIL.**
>
> **The problem.** The original Phase E instructed Cursor to query the deduction count "immediately after AI completion, before workspace apply" and expect `0`, with a STOP condition classifying `> 0` as *"premature deduction — criterion 10 fails."* But the entire chain from AI completion to deduction is **fully automatic with no operator-controlled pause.** Verified in current source:
>
> `consumeExecutionFileActions` → `maybeApplyExecutionFileActions` → `applyExecutionFileActions` → `applySequentialFileActions` (files written) → `setExecutionFileActionState('applied')` → **`await confirmBuildApplyIfQualifying(...)`** → `POST /api/ai/executions/:id/confirm-build-apply` → deduction.
>
> The `confirmBuildApplyIfQualifying` call is a direct `await` in the same async function body, immediately after the apply (`frontend/app/[locale]/app/page.tsx:5024-5031`). It executes within milliseconds of the file actions arriving — there is no confirmation dialog for a non-risky batch, no user gesture, and no pause. By the time Keith notices completion, reports it, and Cursor opens an SSH session and runs `psql`, the deduction already exists.
>
> Under the original plan the expected observation was therefore `1`, not `0`, and the STOP condition would have fired and **failed criterion 10 incorrectly** on a correctly-functioning system.
>
> **The fix.** Criterion 10 is an *ordering* claim: AI completion alone must not be the accounting trigger. Ordering is proven **after the fact** from timestamped log and DB evidence, which is deterministic and requires no race. Keith never has to out-run the UI.

**Run this after Keith reports the execution completed and the apply is visible. Timing is not sensitive.**

1. **Capture the execution ID** (query in §10). Record `EXECUTION_ID`.

2. **Prove the finalize-accounting path declined to deduct.** This log line is emitted at AI completion, before any apply:
   ```bash
   pm2 logs aisandbox-api-gateway --nostream --lines 500 \
     | grep 'finalize_accounting.build_awaiting_apply'
   ```
   REQUIRED: exactly one entry for `EXECUTION_ID`, carrying `executionIntent: "workspace_mutation"` and its own `timestamp`. Record it as `T_AWAITING_APPLY`.
   Source: `usage-ledger.service.ts:780-791` returns `{triggered:false, reason:'build_awaiting_apply'}` before reaching `emitDeductionAttempt`.

3. **Prove the finalize path never deducted for this execution.** The finalize and confirm paths log distinct events:
   ```bash
   pm2 logs aisandbox-api-gateway --nostream --lines 500 \
     | grep 'finalize_accounting.deduction_triggered'
   ```
   REQUIRED: **no** entry for `EXECUTION_ID`. (`finalize_accounting.deduction_triggered` at `usage-ledger.service.ts:795-803` is emitted only on the Ask/legacy path; its absence is direct proof the Build path did not deduct at completion.)

4. **Prove the deduction came from the confirmation path, later.**
   ```bash
   pm2 logs aisandbox-api-gateway --nostream --lines 500 | grep 'confirm_build_apply'
   ```
   REQUIRED: `confirm_build_apply.request_received` then `confirm_build_apply.deduction_triggered` for `EXECUTION_ID`. Record the latter's timestamp as `T_DEDUCTION_TRIGGERED`.

5. **Verify the ordering assertion.**
   ```
   T_AWAITING_APPLY  <  T_DEDUCTION_TRIGGERED
   ```
   REQUIRED: strictly earlier. This is the authoritative proof of criterion 10 — the gate held at AI completion and the deduction occurred only at apply confirmation.

6. **Corroborate with DB transaction ordering** (independent of log retention):
   ```bash
   psql "$DATABASE_URL" -c "
   SELECT
     u.execution_id,
     u.execution_status,
     u.tokens_used,
     u.model,
     u.metadata->'aiExecutionResult'->>'executionIntent' AS intent,
     jsonb_array_length(COALESCE(u.metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count,
     u.timestamp     AS usage_record_created_at,
     d.created_at    AS deduction_created_at,
     (d.created_at > u.timestamp) AS deduction_after_record_creation
   FROM usage_records u
   LEFT JOIN credit_deduction_records d ON d.source_event_id = u.execution_id
   WHERE u.execution_id = '<EXECUTION_ID>';
   "
   ```
   REQUIRED: `execution_status = 'completed'`, `intent = 'workspace_mutation'`, `file_action_count = 1`, exactly one joined deduction row, and `deduction_after_record_creation = true`.
   NOTE: `usage_records` has no `updated_at` column. `timestamp` is the `@CreateDateColumn` (record creation time, before AI execution starts). `deduction_after_record_creation = true` is a structural corroboration, trivially satisfied because the deduction occurs after execution completes, which is after record creation. The PRIMARY criterion 10 proof remains the log-based ordering: `T_AWAITING_APPLY < T_DEDUCTION_TRIGGERED` (steps 2–5 above).

7. **Verify no duplicate deduction** (criteria 12/13):
   ```bash
   psql "$DATABASE_URL" -c "
   SELECT COUNT(*) AS deduction_count
   FROM credit_deduction_records WHERE source_event_id = '<EXECUTION_ID>';
   "
   ```
   REQUIRED: exactly `1`.

**Report to Keith:** file action details, `T_AWAITING_APPLY`, `T_DEDUCTION_TRIGGERED`, the ordering result, absence of `finalize_accounting.deduction_triggered`, and the deduction count.

**Note:** a deduction count of `1` at this point is the **expected, correct** observation. It is not a premature deduction. Only an ordering violation (step 5 or step 6 failing), or a `finalize_accounting.deduction_triggered` entry for this execution, indicates a criterion 10 failure.

---

### Phase F — Workspace Apply (Keith observes in browser)

*Expected: Keith will already see `index.html` in the file tree by the end of Phase D. The apply, the confirm-build-apply call, and the automatic coherence checkpoint are all automatic and complete within milliseconds of the file actions arriving (see Phase E audit note). Seeing the file already present is the normal, correct outcome — not an anomaly.*

Confirm the applied result:
1. Keith confirms `index.html` in file tree — YES/NO
2. Keith clicks `index.html` to open in editor
3. Keith confirms editor shows exact 7-line HTML — YES/NO
4. Keith confirms preview heading `PRIVATE-BETA-E2E-03` — YES/NO
5. Keith confirms preview paragraph `Builder workspace apply succeeded.` — YES/NO
6. Keith reports all four visual checks

If workspace apply requires confirmation (unexpected — risky batch detection):
- Report to Cursor before proceeding
- Follow risky batch confirmation flow only if source supports it for this case

---

### Phase G — Workspace Apply Evidence (Cursor via SSH)

After Keith reports apply complete:

```bash
# Workspace apply + file actions evidence
psql "$DATABASE_URL" -c "
SELECT execution_id, execution_status, tokens_used, model,
  metadata->'aiExecutionResult'->>'executionIntent' AS intent,
  jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count
FROM usage_records WHERE execution_id = '<executionId>';
"

# confirm-build-apply log evidence
pm2 logs aisandbox-api-gateway --nostream --lines 300 | grep 'confirm_build_apply'

# Deduction evidence (expect 1 row now)
psql "$DATABASE_URL" -c "
SELECT source_event_id, applied_credits, balance_before, balance_after
FROM credit_deduction_records WHERE source_event_id = '<executionId>';
"
```

---

### Phase H — Accounting Reconciliation (Cursor + Keith)

1. Cursor captures BALANCE_DB_AFTER from `credit_balances WHERE owner_id = '<keith-user-id>' AND owner_type = 'user'`
2. Cursor verifies: `BALANCE_DB_BEFORE - DEDUCTION_APPLIED_CREDITS = BALANCE_DB_AFTER`
3. Verify: exactly 1 deduction record for executionId
4. Verify: deduction_record.balance_before = BALANCE_DB_BEFORE
5. Verify: deduction_record.balance_after = BALANCE_DB_AFTER
6. Cursor reports arithmetic to Keith

---

### Phase I — Credit Display Reconciliation (Keith)

1. Keith triggers window focus (switch away and back) to force re-fetch
2. Keith notes DevTools `GET /api/billing/balance` response `.balance`: `BALANCE_API_AFTER`
3. Keith notes displayed browser balance: `BALANCE_BROWSER_AFTER`
4. Three-way check: BALANCE_BROWSER_AFTER = BALANCE_API_AFTER = BALANCE_DB_AFTER?

**If mismatch: FAIL — criterion 19 fails — STOP and classify.**  
**If match: Phase I PASS.**

---

### Phase J — Manual Checkpoint (Keith + Cursor)

**Prerequisite (per §21.0) — the workspace must be dirty, or the manual checkpoint proves nothing.**

1. **Cursor confirms the automatic checkpoint already exists** before Keith touches anything:
   ```bash
   psql "$DATABASE_URL" -c "
   SELECT commit_hash, description, files_changed, created_at
   FROM git_checkpoints WHERE session_id = '<sessionId>' ORDER BY created_at DESC;
   "
   ```
   Expected: 1 row, description `AI: applied workspace file actions`. Record as `AUTO_CHECKPOINT_HASH`.

2. **Keith makes the marker edit** (the one budgeted operator workspace mutation):
   - Open `index.html` in the editor
   - Append one line: `<!-- E2E-03 manual checkpoint marker -->`
   - Save through the normal editor save flow
   - Confirm the editor reports the save succeeded

3. **Keith clicks "Save Point"** in the Builder workspace header.

4. **Keith reports** the HTTP status code from DevTools, the full response body (`message`, `commitHash`, `filesChanged`), and any error displayed.

   REQUIRED: HTTP **201**, `message: "Changes committed successfully"`, **non-null** `commitHash`, `filesChanged: 1`.

   **If `commitHash` is `null` and `message` is `"No changes to commit"`:** the marker edit did not reach the workspace. Classify criterion 20 as **FAIL — ambiguous evidence** per §21.0 and STOP. Do NOT retry the checkpoint without fresh Keith authorization.

5. **Cursor captures reconciliation evidence** (§21 commands — note SQLite is host-level per §21.1):
   - Container `git log` newest hash
   - PostgreSQL `git_checkpoints` for this session — expect **2** rows
   - Host SQLite `checkpoints` for this session — expect **2** rows

6. **Four-way reconciliation:** response `commitHash` = container `git log` newest = PostgreSQL `commit_hash` = SQLite `git_commit_hash`, and this hash is distinct from `AUTO_CHECKPOINT_HASH`.

7. **Confirm zero accounting impact:** re-run the deduction count — still exactly `1`; no new `usage_records` row.

**Only ONE manual checkpoint attempt is planned. Do NOT retry on failure without fresh Keith authorization.**

---

### Phase K — Safety Restoration (Cursor via SSH — MANDATORY)

**Execute IMMEDIATELY after Phase D terminal outcome — before deep evidence investigation if doing it in sequence.**  
*In practice: if Phase F/G/H/I/J are quick, restoration may occur after J. But restoration must happen regardless of outcome — even if phases F through J were skipped due to a STOP condition.*

Cursor executes GLOBAL_EXECUTION_ENABLED restoration sequence from §13.3 (R1–R7).

```bash
# Final safety flag verification
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

grep '^BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# Expected: BILLING_CHARGES_ENABLED=false

pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: false

pm2 list
# Expected: all 5 processes online
```

---

### Phase L — Final Evidence Reconciliation + Cleanup (Cursor + Keith)

1. Verify all 20 criteria against collected evidence
2. Cursor queries for session cleanup:
   ```bash
   # Keith performs authenticated DELETE:
   # DELETE /api/sessions/<sessionId>
   # Expected: HTTP 200 {"message":"Session terminated successfully"}
   ```
3. Verify session stopped: `SELECT status FROM sessions WHERE id = '<sessionId>'` → `stopped`
4. Verify container removed: `docker inspect <container-id>` → "No such object"
5. Verify checkpoint records retained and consistent — both `git_checkpoints` rows still present after session deletion
6. Record `E2E_WINDOW_END` timestamp, then run the §24 payment-exclusion queries — `webhook_events` and `invoices` must both return 0 for the window
7. Confirm the disposable project remains (retention is the only supported outcome — §10)
8. Confirm total checkpoint creations = 2 and total deductions = 1
9. Classify final result: PASS / FAIL / BLOCKER

---

## 26. Cursor Read-Only Evidence Commands

All SSH commands in this document are read-only except the two `aisandbox-api-gateway` PM2 restarts (enable + restore). Root `.env` is NOT edited. The evidence queries require `DATABASE_URL` — extract it safely at the start of each SSH session:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' /opt/aisandbox/.env | cut -d= -f2-)
```

**Do NOT use `source /opt/aisandbox/.env`** — `AUTH_EMAIL_FROM` contains unquoted angle brackets that break bash parsing.

Evidence queries:

```bash
# PM2 process list
pm2 list

# PM2 env (safe — do not grep for secret values)
pm2 env <api-gateway-id> | grep -E '^(GLOBAL_EXECUTION_ENABLED|BILLING_CHARGES_ENABLED|AI_PROVIDER|PROVIDER_XAI_ENABLED|NODE_ENV|PORT)'

# Git state
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox status --short

# Health checks
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health/ready
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4001/metrics
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4002/api/health

# DB reads (all SELECT-only)
psql "$DATABASE_URL" -c "SELECT ..."

# API Gateway logs (read-only)
pm2 logs aisandbox-api-gateway --nostream --lines 300

# Container inspection (read-only)
docker ps
docker inspect <container-id>
docker exec <container-id> git -C /workspace log --oneline -n 5

# Container-manager SQLite (HOST-level, read-only, always filtered by session_id)
# sqlite3 CLI is ABSENT on staging — use Python 3 read-only URI:
python3 -c "
import sqlite3, json
conn = sqlite3.connect('file:/opt/aisandbox/database/aisandbox.db?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT ... FROM checkpoints WHERE session_id = ? ...', ('<sessionId>',)).fetchall()
for r in rows: print(json.dumps(dict(r)))
conn.close()
"
```

**AUDIT CORRECTION:** the SQLite database is a host-level file at `/opt/aisandbox/database/aisandbox.db`, not a container-local `/workspace/.sandbox.db`. See §21.1.

---

## 27. Stop Conditions

Stop immediately and do NOT proceed to the next phase if:

| Stop Condition | Classification |
|----------------|----------------|
| Phase A: `CURRENT_STAGING_SHA` ≠ `54b5764d` | STOP — staging unexpected state — voids §7/§8 deployment conclusion |
| Phase A: worktree dirty | STOP — staging unexpected state |
| Phase A: GLOBAL_EXECUTION_ENABLED ≠ false at start | STOP — safety flag unexpected |
| Phase A: BILLING_CHARGES_ENABLED ≠ false | STOP — safety flag unexpected |
| Phase A: AI_PROVIDER ≠ xai | STOP — provider/model discrepancy — report to Keith |
| Phase A: any PM2 process not online | STOP — unhealthy staging |
| Phase A: any health check not HTTP 200 | STOP — unhealthy staging |
| Phase B: starting balance three-way mismatch | STOP — investigate before execution |
| Phase B: `BALANCE_DB_BEFORE` < 10,000 credits | STOP — insufficient balance risks a clamped deduction (§19) — criteria 11/12/19 would be ambiguous |
| Phase C: GLOBAL_EXECUTION_ENABLED not confirmed true after enable + fallback | STOP — gate enable failed — restore and escalate |
| Phase C: api-gateway crash-loops or readiness ≠ 200 after restart | STOP — restore per §13.3 and escalate — do NOT retry restarts |
| Phase D: Keith submits second provider call (duplicate submission) | STOP — budget exceeded — flag anomaly |
| **Phase E: `T_AWAITING_APPLY` ≥ `T_DEDUCTION_TRIGGERED`, or ordering unprovable** | STOP — criterion 10 fails — FAIL / BLOCKER |
| **Phase E: `finalize_accounting.deduction_triggered` present for this executionId** | STOP — deduction at AI completion — criterion 10 fails — FAIL / BLOCKER |
| **Phase E: `finalize_accounting.build_awaiting_apply` absent for this executionId** | STOP — gate not exercised — criterion 10 fails — FAIL / BLOCKER |
| Phase E: file_action_count = 0 | STOP — zero fileActions — FAIL / BLOCKER |
| Phase F/G: workspace apply fails | STOP — criterion 6 fails — FAIL / BLOCKER |
| Phase G: confirm-build-apply NOT reached (no log evidence) | STOP — criterion 8 fails — FAIL / BLOCKER |
| Phase G: deduction_count ≠ 1 after apply | STOP — accounting failure — criteria 12/13 fail |
| Phase G: `overflow_credits` ≠ 0 or `applied_credits` ≠ `requested_credits` | STOP — clamped/irregular deduction — accounting ambiguous (§19) |
| Phase H: arithmetic mismatch in deduction records | STOP — accounting failure |
| Phase I: credit display mismatch | STOP — criterion 19 fails — FAIL / BLOCKER |
| Phase J: automatic checkpoint row absent before the manual attempt | STOP — apply/coherence did not complete — investigate before manual checkpoint |
| Phase J: checkpoint HTTP ≠ 201 | STOP — criterion 20 fails — FAIL / BLOCKER |
| **Phase J: HTTP 201 but `commitHash` is null / "No changes to commit"** | STOP — criterion 20 FAIL — ambiguous evidence (§21.0) — do NOT record as PASS |
| Phase J: Git/PG/SQLite hash mismatch, or checkpoint row count ≠ 2 | STOP — checkpoint divergence |
| Phase K: GLOBAL_EXECUTION_ENABLED cannot be restored to false | STOP — critical safety failure — escalate to Keith immediately |
| Any phase: non-zero `webhook_events` or `invoices` in the E2E window | STOP — criterion 14 fails — critical safety violation |
| Any phase: unexpected payment/billing mutation | STOP — critical safety violation |
| Any phase: unexpected error that changes scope | STOP — report to Keith |

**AUDIT CORRECTION.** The original table contained `Phase E: deduction_count > 0 before apply → STOP — premature deduction — criterion 10 fails`. That condition would have fired on a **correctly functioning system**, because the deduction is already complete before any human can observe the interval (see Phase E audit note). It has been replaced with the ordering-based conditions above.

**For every STOP:**
- Do not retry the provider call
- Do not retry the checkpoint (unless freshly authorized)
- Restore GLOBAL_EXECUTION_ENABLED=false if it had been enabled
- Preserve all available evidence
- Classify result
- Return to Keith

---

## 28. Rollback / Safety Restoration Plan

**GLOBAL_EXECUTION_ENABLED restoration:** See §13.3 — must execute immediately after terminal outcome.

**If restoration fails (PM2 crash loop, repeated failure):**
1. Block all further Step 3 actions
2. Do not modify source
3. Do not retry provider
4. Investigate PM2/process health first
5. Get Keith authorization before any further action

**Staging rollback SHA (if source change needed, not anticipated):**
- Pre-03I SHA: `e34be9bdcdeed6cc1fbc1f0ce2f7e5689a62bdd0`
- Not expected to be needed — no source changes in E2E-03

---

## 29. Cleanup Plan

After Step 3 evidence is preserved and outcome classified:

1. Preserve all DB evidence (usage_records, credit_deduction_records, git_checkpoints, sessions)
2. Restore GLOBAL_EXECUTION_ENABLED=false — DONE in Phase K
3. Verify BILLING_CHARGES_ENABLED=false — DONE in Phase K
4. Keith performs authenticated session delete: `DELETE /api/sessions/<sessionId>` → HTTP 200
5. Verify session status=stopped in PostgreSQL
6. Verify container removed: `docker inspect <container-id>` → no such object
7. Verify disposable project retained (no delete) — retention is the only supported outcome; no project delete endpoint exists (§10)
8. Verify checkpoint records internally consistent post-cleanup (checkpoints persist even after session delete)
9. Verify no orphan Git checkpoint (git log in container not accessible after removal — DB records are authoritative)
10. Verify no Git/DB divergence (all prior reconciliation confirms this)
11. Verify all 5 PM2 services online and healthy
12. Final GLOBAL_EXECUTION_ENABLED and BILLING_CHARGES_ENABLED double-check

---

## 30. PASS Criteria

E2E-03 PASSES if and only if ALL 20 criteria in §4 are confirmed:

- Criterion 1: Auth PASS (Keith logs in successfully)
- Criterion 2: Workspace/project/session PASS (project created, session active, container running)
- Criterion 3: Exactly 1 xAI/grok-4.5 execution PASS (execution_status=completed, provider=xai, model=grok-4.5)
- Criterion 4: executionIntent=workspace_mutation PASS (from usage_records DB)
- Criterion 5: fileActions > 0 PASS (file_action_count ≥ 1 from DB)
- Criterion 6: workspace apply PASS (applyStatus=applied, all results=success)
- Criterion 7: workspace result PASS (file tree, editor, preview confirmed by Keith)
- Criterion 8: confirm-build-apply route reached and succeeds PASS (log + DB + HTTP 200 evidence)
- Criterion 9: ownership/auth PASS (no auth failures, session ownership verified)
- Criterion 10: build_awaiting_apply gate active PASS (`finalize_accounting.build_awaiting_apply` logged; `finalize_accounting.deduction_triggered` absent; deduction timestamp strictly later than AI-completion timestamp — see §25 Phase E)
- Criterion 11: qualifying apply triggers deduction PASS (deduction record created after confirm-build-apply)
- Criterion 12: exactly 1 deduction PASS (count=1, source_event_id=executionId)
- Criterion 13: no duplicate deduction PASS (count=1, idempotency confirmed)
- Criterion 14: no external payment PASS (BILLING_CHARGES_ENABLED=false preflight and postflight; zero `webhook_events` and zero `invoices` rows in the E2E window — see §24)
- Criterion 15: grok-4.5 model used PASS (model=grok-4.5 from usage_records DB)
- Criterion 16: Ask semantics unchanged PASS (source evidence — no live Ask call)
- Criterion 17: GLOBAL_EXECUTION_ENABLED restored false PASS (verified in .env — never changed from false — and PM2 runtime — restored to false)
- Criterion 18: BILLING_CHARGES_ENABLED=false throughout PASS (verified preflight and postflight)
- Criterion 19: credit display reconciled PASS (browser = API = DB balance)
- Criterion 20: manual checkpoint HTTP 201 with non-null `commitHash` PASS (response + container Git + PostgreSQL + host SQLite four-way reconciliation; 2 checkpoint rows for the session). HTTP 201 with `commitHash: null` = FAIL — see §21.0

---

## 31. PASS WITH LIMITATION Criteria

**PASS_WITH_LIMITATION_ELIGIBLE_CRITERIA = NONE**

All 20 criteria are launch-critical for Builder-first private-beta readiness. Criteria 8, 10, 11, 12, 13, 17, 18, 19, 20 are explicitly never limitation-eligible (per Step 1 registration). The remaining criteria (1–7, 9, 14–16) are also all necessary for confident product-journey proof. Criterion 16 is proven via source evidence — this is the correct method, not a limitation.

---

## 32. FAIL / BLOCKER Criteria

- Any failure of criterion 8, 10, or 11 (deferred-deduction path) → FAIL / BLOCKED
- Any failure of criterion 12 or 13 (deduction count) → FAIL / BLOCKED
- Any failure of criterion 17 (safety flag restoration) → FAIL / BLOCKED
- Any failure of criterion 18 (payment safety) → FAIL / BLOCKED
- Any failure of criterion 19 (credit display mismatch) → FAIL / BLOCKED
- Any failure of criterion 20 (manual checkpoint regression) → FAIL / BLOCKED
- Failure of criteria 1–7, 9, 14–16 also produces FAIL / BLOCKED (all are launch-critical)
- New unresolved launch-critical defect discovered → classify and STOP

---

## 33. Proposed Step 3 Mutation Budget

**Every intentional runtime mutation is enumerated here. Nothing materially mutating is left as an unlisted "automatic side effect."**

| # | Mutation | Proposed count | Notes |
|---|----------|---------------|-------|
| 1 | Provider calls (xAI / grok-4.5 Build) | **1** | No retry authorized |
| 2 | Credit deductions | **1** | Via confirm-build-apply path; `overflow_credits` must be 0 |
| 3 | GLOBAL_EXECUTION_ENABLED=true windows | **1** bounded interval | Restored per §13.3 regardless of outcome |
| 4 | `.env` edits | **0** | Root `.env` stays at `false` throughout — gate changed via inline PM2 env only (§13 reconciliation) |
| 5 | PM2 restarts | **2** (+1 each only if verification fails, max 4) | `aisandbox-api-gateway` only |
| 6 | Projects created | **1** | `E2E-03-Disposable-2026-08-17` — retained (deletion unsupported, §10) |
| 7 | Sessions created | **1** | Automatic on project open |
| 8 | Containers created | **1** | Automatic with session |
| 9 | AI-written workspace files | **1** | `index.html` via the authorized apply |
| 10 | Operator-written workspace files | **1** | Marker comment appended to `index.html` (§21.0) — no provider call, no deduction |
| 11 | **Automatic post-apply checkpoints** | **1** | **Unavoidable consequence of mutation 9** — `runAiActionCoherence`; Git + PG + SQLite write |
| 12 | Manual checkpoint attempts | **1** | Keith-triggered "Save Point" |
| 13 | **Total checkpoint creations** | **2** | = 11 + 12 |
| 14 | Sessions deleted | **1** | Authenticated `DELETE /api/sessions/:sessionId` at cleanup |
| 15 | PostgreSQL row writes | 1 `usage_records`, 1 `credit_deduction_records`, 1 `credit_balances` update, 2 `git_checkpoints`, 1 session status update | All consequences of 1–14 |
| 16 | Host SQLite row writes | 2 `checkpoints` rows, session record | `/opt/aisandbox/database/aisandbox.db` |
| 17 | Git commits in session container | **2** | Automatic + manual checkpoint commits |
| 18 | SSH connections | Multiple read-only; write actions limited to item 5 (PM2 restarts) | |
| 19 | Ask provider calls | **0** | Criterion 16 proven by source evidence |
| 20 | Stripe / payment API calls | **0** | `BILLING_CHARGES_ENABLED=false` |
| 21 | Projects deleted | **0** | Not supported by the platform (§10) |
| 22 | Source / test file changes | **0** | Prohibited |
| 23 | Deployments / rebuilds | **0** | Not needed (§8) |
| 24 | Migrations | **0** | |

**AUDIT CORRECTION.** The original §33 omitted the operator workspace edit (item 10) and understated the automatic checkpoint's status by listing it without carrying it into §12 or §35. Items 10, 11, 13, 16, 17, and 21 are now explicit, and all are covered by the §35 authorization statement.

**RECONCILIATION CORRECTION.** Item 4 (`.env` edits) reduced from 2 to **0** because root `.env` sourcing is unsafe (`AUTH_EMAIL_FROM` unquoted angle brackets) and the inline PM2 env approach does not require it. Root `.env` stays at `false` throughout.

---

## 34. Explicit Not-Authorized Status

| Authorization | Status |
|---------------|--------|
| RUNTIME_EXECUTION_AUTHORIZED | **NO** |
| PROVIDER_CALL_AUTHORIZED | **NO** |
| CREDIT_MUTATION_AUTHORIZED | **NO** |
| GLOBAL_EXECUTION_ENABLE_AUTHORIZED | **NO** |

These remain NO until Keith explicitly provides the authorization statement in §35.

---

## 35. Exact Authorization Statement Keith Can Approve

**AUDIT CORRECTION.** The original statement omitted the automatic post-apply checkpoint, project/session/container creation, workspace file writes, `.env` edits, PM2 restarts, and the cleanup session DELETE. A mutation that follows necessarily from an authorized action still requires authorization. The revised statement below names every mutation in §33.

**Precondition satisfied.** `STEP_3_READINESS` is `READY` (§36). The §37 read-only staging preflight evidence has been collected, reviewed, and reconciled. All blocking items are resolved.

When Keith is ready to authorize Step 3, Keith must explicitly state:

---

> I authorize PRIVATE-BETA-E2E-03 Step 3 runtime execution on staging under the following bounded budget, having reviewed the read-only staging preflight evidence.
>
> **Provider and accounting:**
> - Exactly ONE xAI / grok-4.5 Build provider call — no retry authorized
> - Exactly ONE credit deduction via the confirm-build-apply path, with zero overflow
> - Zero Ask provider calls
> - Zero Stripe / payment API activity; `BILLING_CHARGES_ENABLED` remains `false` throughout
>
> **Safety flag and process actions:**
> - One bounded `GLOBAL_EXECUTION_ENABLED=true` window on staging, restored to `false` immediately after the terminal outcome regardless of result
> - ZERO edits to `/opt/aisandbox/.env` — root `.env` stays at `false` throughout; gate changed via inline PM2 env only (`GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env`)
> - TWO `aisandbox-api-gateway` PM2 restarts, plus at most one additional restart per direction if runtime verification fails (maximum four)
>
> **Workspace and session state:**
> - One disposable project `E2E-03-Disposable-2026-08-17`, which will be RETAINED because project deletion is not supported by the platform
> - One session and one container, created automatically and deleted at cleanup via one authenticated `DELETE /api/sessions/:sessionId`
> - One AI-written workspace file (`index.html`) created by the authorized apply
> - One operator-written workspace edit appending a marker comment to `index.html`, required to make the manual checkpoint produce a real commit
>
> **Checkpoints — I explicitly authorize BOTH:**
> - ONE **automatic** post-apply checkpoint created by the AI coherence flow. I understand this is an unavoidable consequence of the workspace apply I am authorizing, that it writes to Git, PostgreSQL, and the host SQLite database, and that it is inside this budget rather than an unbudgeted side effect.
> - ONE **manual** checkpoint attempt that I trigger myself.
> - TOTAL EXPECTED CHECKPOINT CREATIONS: **2**
>
> **Resulting persistence I authorize:** one `usage_records` row, one `credit_deduction_records` row, one `credit_balances` balance update, two `git_checkpoints` rows, two host SQLite `checkpoints` rows, two Git commits in the session container, and one session status update.
>
> **Not authorized:** any source or test file change, any deployment or rebuild, any migration, any project deletion, any retry of the provider call, any retry of the manual checkpoint, any second Build submission, and any change to `BILLING_CHARGES_ENABLED`.
>
> This authorization is for Step 3 only. If any STOP condition in §27 fires, execution halts, `GLOBAL_EXECUTION_ENABLED` is restored to `false`, and any further action requires fresh authorization from me.

---

**Do NOT treat the above draft as approval. Status remains NOT AUTHORIZED until Keith explicitly provides this statement. The §37 evidence has been collected and reviewed — the precondition is satisfied.**

---

## 36. Step 3 Readiness Verdict

**STEP_3_READINESS = READY**

**RECONCILIATION UPDATE (2026-08-17).** The previous verdict was `BLOCKED_PENDING_READ_ONLY_STAGING_PREFLIGHT`. All three blocking items are now resolved by the Grok §37 read-only staging preflight evidence, PM2 documentation, and EXEC-01 runtime evidence. Four additional defects were found and corrected during reconciliation.

**Resolved in Step 2 (retained):**

- Governance delta: 2 commits, governance/docs only — no deployment needed
- Provider/model **source contract**: `XAI_ALLOWED_MODELS = ['grok-4.5']` — if provider is xai, model can only be grok-4.5
- Build prompt: exact 7-line HTML, 1 file action, verified non-risky against `isRiskyFileActionBatch`
- Disposable project name and creation path
- Harness: plain path confirmed; no pre-apply checkpoint; automatic post-apply checkpoint confirmed from source
- `build_awaiting_apply` gate: source-proven, with a workable ordering-based evidence plan
- confirm-build-apply: route, trigger, request, response, and log evidence fully documented
- Starting balance three-way reconciliation procedure, plus a balance-sufficiency gate
- Deduction arithmetic: source-verified as 1 credit per token, with overflow and clamping assertions
- Credit display reconciliation: focus-refetch mechanism documented
- Authoritative SQLite location and exact read-only query procedure (Python 3 URI mechanism)
- Ask semantics: source evidence sufficient as the criterion is registered
- Ownership/auth: normal authenticated session flow, consistent with E2E-02 precedent
- Payment exclusion: flag invariant plus zero-new-rows evidence in `webhook_events` and `invoices`
- Cleanup plan, stop conditions, and full mutation budget
- PASS WITH LIMITATION: NONE
- Authorization statement covering every enumerated mutation

**Previously blocking items — ALL RESOLVED:**

| # | Previously unresolved fact | Resolution |
|---|---------------------------|------------|
| 1 | `CURRENT_STAGING_SHA` unverified | **RESOLVED** — Grok §37: `54b5764d8645d80a44f5de1351ca8e7928c5c8f4`, worktree clean. §5/§7/§8 updated. |
| 2 | `PROVIDER_MODEL_CURRENT_STAGING_RUNTIME_VERIFIED = NO` | **RESOLVED** — Grok §37: `AI_PROVIDER=xai` confirmed in root `.env`; `PROVIDER_XAI_ENABLED=true` in PM2 runtime. §6 updated. |
| 3 | `GLOBAL_EXECUTION_ENABLED` propagation mechanism unverified | **RESOLVED** — Grok §37 confirmed no per-service `.env` exists (S8). PM2 docs confirm `--update-env` is a merge operation ("environment is conservative"). EXEC-01 runtime evidence proves `pm2 restart --update-env` preserves stored env vars. Root `.env` sourcing is unsafe (`AUTH_EMAIL_FROM` angle brackets). Final procedure uses inline PM2 env approach: `GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env`. Zero `.env` edits. §13 rewritten. |

**Additional reconciliation corrections:**

| # | Defect found | Resolution |
|---|--------------|------------|
| 4 | `credit_balances.user_id` does not exist | Actual columns: `owner_id` + `owner_type`. All queries corrected in §11/§20/§25 Phase B/H. |
| 5 | `usage_records.updated_at` does not exist | Actual temporal field: `timestamp` (`@CreateDateColumn`). Phase E corroboration query corrected. |
| 6 | `sqlite3` CLI absent on staging | All SQLite evidence queries use Python 3 `sqlite3.connect("file:...?mode=ro", uri=True)`. §21/§26 corrected. |
| 7 | Root `.env` cannot be bash-sourced | `AUTH_EMAIL_FROM` unquoted angle brackets. §13 C4/R3 source step removed; inline PM2 approach used instead. |

**`UNRESOLVED_AMBIGUITY = NONE`**

**`STAGING_PREFLIGHT_RESULT = PASS`**

**Step 3 may begin when Keith explicitly authorizes it per §35.**

---

## 37. Read-Only Staging Preflight Evidence — COMPLETED

**STATUS: ALL ITEMS RESOLVED — Grok §37 read-only staging preflight completed 2026-08-17.**

The evidence below was collected by Grok and reconciled against the runbook. All expected values matched. No STOP conditions triggered.

| ID | Purpose | Result | Expected | Match |
|----|---------|--------|----------|-------|
| S1 | Current staging SHA | `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` | `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` | **YES** |
| S2 | Clean worktree | YES | YES | **YES** |
| S3 | Current provider | `xai` | `xai` | **YES** |
| S4 | xAI kill switch | `true` (runtime) | `true` | **YES** |
| S5 | Gateway runtime gate | `false` | `false` | **YES** |
| S6 | Gate in root `.env` | `GLOBAL_EXECUTION_ENABLED=false` | `false` | **YES** |
| S7 | Gateway PM2 cwd | `/opt/aisandbox/services/api-gateway` | `/opt/aisandbox/services/api-gateway` | **YES** |
| S8 | Per-service `.env` exists | **NO** | informative | **Confirmed: no per-service `.env`** |
| S9 | Payment gate `.env` | `BILLING_CHARGES_ENABLED=false` | `false` | **YES** |
| S10 | Payment gate runtime | `false` | `false` | **YES** |
| S11 | Internal service key present | YES (presence only) | ≥ 1 | **YES** |
| S12 | All processes healthy | 5 online | 5 online | **YES** |
| S13 | Gateway readiness | HTTP 200 | 200 | **YES** |
| S14 | AI service readiness | HTTP 200 | 200 | **YES** |
| S15 | Container-manager readiness | HTTP 200 | 200 | **YES** |
| S16 | SQLite DB exists | YES | YES | **YES** |
| S17 | SQLite CLI | **MISSING** | informative | **Confirmed: use Python 3 read-only URI** |
| S18 | Harness flags | both `false` | both `false` | **YES** |

**Derived conclusions:**

```
PROVIDER_MODEL_CURRENT_STAGING_RUNTIME_VERIFIED=YES
CURRENT_STAGING_SHA_MATCHES_LAST_VERIFIED=YES
GATE_PROPAGATION_MECHANISM=pm2_process_env (no per-service dotenv; inline PM2 env approach)
ANY_STOP_CONDITION_TRIGGERED=NO
```

**Additional staging finding:** Root `.env` at `/opt/aisandbox/.env` cannot be safely bash-sourced because `AUTH_EMAIL_FROM` contains unquoted angle brackets. Four keys follow that line, including `XAI_API_KEY`. The §13 enable/restore procedure has been corrected to use the inline PM2 env approach, which does not require sourcing the root `.env`.

**Additional staging finding:** `sqlite3` CLI is absent. The proven Python 3 read-only URI mechanism (`sqlite3.connect("file:...?mode=ro", uri=True)`) is used for all SQLite evidence queries. No package installation is authorized.

**Additional staging finding:** Current credit balance is `30577`. Threshold ≥ 10,000: PASS.

**Additional staging finding:** `webhook_events` and `invoices` tables are queryable. Zero provider calls, zero credit mutations, zero PM2 restarts, zero environment changes occurred during the preflight.

**Retained stash:** `0372cc1f47f82e1db060ed2dd756a938fe324803` — untouched.

---

*Stage Start document created: 2026-08-17 — PRIVATE-BETA-E2E-03 Step 2 — read-only planning only — no runtime action — no provider call — no balance mutation — no PM2 action — no .env edit — no source edit — no git add/commit/push.*

*Independently audited: 2026-08-17 — Cursor / Opus — read-only source and Git audit. Corrections applied to §5, §6, §7, §8, §10, §12, §13, §15, §19, §21, §24, §25 (Phases E/F/J), §26, §27, §33, §35, §36; §21.0, §21.1, and §37 added. No runtime action — no provider call — no credit mutation — no PM2 action — no .env edit — no source or test edit — no deployment — no git add/commit/push.*

*Final reconciliation: 2026-08-17 — Cursor / Opus 4.6 — reconciliation against Grok §37 read-only staging preflight evidence. Corrections applied to §5, §6, §7, §8, §11, §12, §13 (rewritten), §20, §21, §25 (Phases B/E/H/J), §26, §33, §35, §36 (READY), §37 (COMPLETED). Root `.env` sourcing defect discovered and resolved. `credit_balances.user_id` corrected to `owner_id`/`owner_type`. `usage_records.updated_at` corrected to `timestamp`. SQLite queries corrected to Python 3 read-only URI. No runtime action — no provider call — no credit mutation — no PM2 action — no .env edit — no source or test edit — no deployment — no git add/commit/push.*
