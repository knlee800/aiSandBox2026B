# PRIVATE-BETA-E2E-04 — Stage Start / Exact Controlled E2E Runbook

**Task ID:** PRIVATE-BETA-E2E-04  
**Title:** Fresh Post-03J Builder End-to-End Validation  
**Step:** Step 2 — Stage Start / Exact Controlled E2E Runbook — **COMPLETE — 2026-08-19**  
**Author:** Cursor / Sonnet 4.6 (read-only planning — no runtime action — no provider call — no balance mutation — no PM2 action — no .env edit — no git add/commit/push)

---

## ⛔ STEP 3 AUTHORIZATION BOUNDARY

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```

Resource ownership (STAGING, PROVIDER-LIVE, CREDIT, ENV) is a reservation, NOT authorization.

**Step 3 requires EXPLICIT KEITH RUNTIME AUTHORIZATION before any of the following:**
- SSH to staging
- Staging deployment of 03J fix
- Enabling GLOBAL_EXECUTION_ENABLED
- Provider call
- Credit mutation
- Live browser E2E

**DO NOT EXECUTE STEP 3 WITHOUT KEITH'S EXPLICIT GO.**

---

## Single-Lane Rule

PRIVATE-BETA-E2E-04 is deliberately single-lane.

While PRIVATE-BETA-E2E-04 is ACTIVE or LANE-DONE:
- Lane 2 MUST remain EMPTY.
- Do not admit another implementation task.
- Lane 3 remains DISABLED.
- Preserve staging / provider / credit / env evidence isolation throughout.

---

## 1. Bootstrap Confirmation

| Check | Result |
|-------|--------|
| PRIVATE-BETA-E2E-04 admitted in Lane 1 | YES |
| Lane 1 state | ACTIVE |
| Workstream | RELIABILITY |
| Lifecycle | 4-step HIGH-RISK |
| Lane 1 resource ownership | STAGING, PROVIDER-LIVE, CREDIT, ENV |
| Lane 2 state | EMPTY |
| Lane 3 state | DISABLED |
| PRIVATE-BETA-INVITE-01 | UNREGISTERED / PROHIBITED |

---

## 2. Pre-Step-2 Baseline

```
PRE_STEP2_HEAD=0ebea47e680968900d2b390366ad79a123efd074
PRE_STEP2_GIT_STATUS=(empty — clean working tree, no staged or unstaged changes)
```

No pre-existing untracked or modified files at Step 2 entry. All Step 2 changes are attributable exclusively to this step.

---

## 3. Purpose of E2E-04

Prove the corrected live chain after PRIVATE-BETA-BLOCKER-03J:

```
Builder Build request (xai / grok-4.5)
→ qualifying workspace_mutation fileActions
→ successful workspace apply
→ automatic post-apply checkpoint
→ Build remains build_awaiting_apply before confirmation
→ browser POST /api/ai/executions/:executionId/confirm-build-apply
→ API Gateway PUBLIC authenticated handler (03J fix in ai-execution.controller.ts)
→ UsageLedgerService.triggerBuildApplyDeduction()
→ exactly one credit deduction
→ authoritative balance reconciliation
→ frontend displayed balance reconciliation (03H contract)
→ workspace/preview validation
→ manual checkpoint with marker edit
→ cleanup
→ GLOBAL_EXECUTION_ENABLED=false restored
```

A PASS supports a subsequent Builder private-beta readiness decision (PRIVATE-BETA-INVITE-01 authorization requires separate Keith step — not automatically authorized by E2E-04 PASS).

---

## 4. Targeted Evidence Documents Read

| Document | Status | Key Facts Extracted |
|----------|--------|---------------------|
| `docs/PRIVATE-BETA-BLOCKER-03D-CHECKPOINT.md` | READ | Accounting lifecycle, deduction formula, qualify gate, build_awaiting_apply, idempotency, confirm flow |
| `docs/PRIVATE-BETA-BLOCKER-03H-CHECKPOINT.md` | READ | Credit balance display refresh, useBillingData focus refresh, 3-way reconciliation contract, staging SHA e34be9bd |
| `docs/PRIVATE-BETA-BLOCKER-03I-CHECKPOINT.md` | READ | Git safe.directory fix SHA 54b5764d, checkpoint HTTP 201 proof, SQLite path, cleanup evidence |
| `docs/PRIVATE-BETA-BLOCKER-03J-CHECKPOINT.md` | READ | Public Gateway route, ROOT_CAUSE_OF_CONFIRM_FAILURE, 03J implementation SHA, FRESH_E2E_REQUIRED |
| `docs/PRIVATE-BETA-E2E-03-CHECKPOINT.md` | READ | E2E-03 identity (user, project, session, execution), balance history, automatic checkpoint evidence, hard-stop evidence |
| `docs/PRIVATE-BETA-E2E-03-STAGE-START.md` | READ (targeted) | Exact PM2 commands, deduction arithmetic, SQLite query pattern, credit_balances column names, marker-edit pattern, database queries |

---

## 5. Targeted Read-Only Source Inspection

| File / Location | Reason | Key Fact Established |
|-----------------|--------|----------------------|
| `services/api-gateway/src/ai/ai-execution.controller.ts` lines 756–784 | Verify 03J public route existence and implementation | `@Post('executions/:executionId/confirm-build-apply')`, `@UseGuards(SessionOrApiKeyAuthGuard)`, `@HttpCode(HttpStatus.OK)`, calls `triggerBuildApplyDeduction()` |
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` (grep) | Confirm exact log event names | `finalize_accounting.build_awaiting_apply` (line 784), `confirm_build_apply.deduction_triggered` (line 950) |
| `services/api-gateway/src/ai/internal-accounting.controller.ts` (grep) | Confirm `confirm_build_apply.request_received` origin | Event at line 54 — logged by INTERNAL handler only, NOT by the 03J public handler |
| `services/api-gateway/src/safety/audit-log.service.ts` (grep) | Confirm GLOBAL_EXECUTION_ENABLED usage | Confirmed exact name |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` lines 44–58 | Confirm AGENT_HARNESS flag exact names, parsing semantics, and defaults from actual implementation | `AGENT_HARNESS_ENABLE_TOOL_LOOP` (default false), `AGENT_HARNESS_ENABLE_WRITE_TOOLS` (default false), `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` (default false) — all use `parseStrictBooleanEnv` with `defaultValue=false` |
| `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` line 39 | Confirm `AGENT_HARNESS_STUB_WRITE_MODE` source and semantics | Simple `=== 'true'` check, no `parseStrictBooleanEnv`, controls stub adapter only — irrelevant to live xAI execution path in E2E-04 but must remain false |
| `services/api-gateway/src/startup/production-guardrails.validator.ts` (grep) | Confirm BILLING_CHARGES_ENABLED exact name | `BILLING_CHARGES_ENABLED` confirmed |
| git log from 54b5764d..HEAD | Identify commits containing production source changes | Only `c3e3927` contains production source changes (ai-execution.controller.ts); all subsequent commits are governance/docs only |

---

## 6. STAGING_03J_DEPLOYMENT_PARITY

```
STAGING_03J_DEPLOYMENT_PARITY=REQUIRED
```

### 6.1 REQUIRED_SOURCE_SHA

```
REQUIRED_SOURCE_SHA=c3e39279abe3c0d6c348daa312107c8f6fc592b7
```

**Commit message:** `fix: add public build apply confirmation route`  
**Date:** 2026-08-18  
**Files changed (production source):** `services/api-gateway/src/ai/ai-execution.controller.ts`

**How established:** Read-only git inspection. `git log --oneline 54b5764d..HEAD` showed `c3e3927` as the only commit between the E2E-03 staging SHA and current HEAD that changed a production source file. `git show --stat c3e3927` confirmed `ai-execution.controller.ts` was modified.

### 6.2 Last Known Staging SHA

**LAST_VERIFIED_STAGING_SHA:** `54b5764d8645d80a44f5de1351ca8e7928c5c8f4`  
**Evidence source:** E2E-03 checkpoint §33 (worktree clean, confirmed during E2E-03 Step 3, 2026-08-17)

`54b5764d` does NOT contain the 03J fix. The 03J implementation commit `c3e3927` was made after E2E-03. No staging deployment occurred during 03J (03J checkpoint §26) or during subsequent governance commits.

### 6.3 Delta Between Last Known Staging SHA and REQUIRED_SOURCE_SHA

| Commit | Message | Production Source Changes |
|--------|---------|--------------------------|
| 858c327 | checkpoint: complete 03I checkpoint safety fix | NONE (TASKS.md, docs only) |
| a72b0d0 | register PRIVATE-BETA-E2E-03 | NONE (TASKS.md only) |
| ed83042 | checkpoint: complete E2E-03 stage-start runbook | NONE (docs only) |
| 28eec46 | checkpoint: complete E2E-03 fail-blocked validation | NONE (docs only) |
| 42d4508 | register PRIVATE-BETA-BLOCKER-03J | NONE (TASKS.md only) |
| 18b140b | checkpoint: complete 03J source-path investigation | NONE (docs only) |
| 48e977c | checkpoint: prove 03J public routing root cause | NONE (docs only) |
| **c3e3927** | **fix: add public build apply confirmation route** | **YES — ai-execution.controller.ts (new confirmBuildApply method)** |
| 8d31aba | Install Development OS v1 governance | NONE (governance docs only) |
| 0ebea47 | register and admit PRIVATE-BETA-E2E-04 | NONE (TASKS.md, TASKS_BACKLOG_FULL.md only) |

**Commits after c3e3927 (8d31aba, 0ebea47) contain zero production source changes.** Deploying to current HEAD `0ebea47e` is acceptable.

### 6.4 Documentary Parity Proof

**STAGING_PARITY_ALREADY_PROVEN=NO**

No documentary evidence proves staging currently contains `c3e3927` or a descendant. 03J checkpoint §26 explicitly states no staging deployment occurred. Step 3 MUST verify staging SHA and deploy if necessary before any provider call.

### 6.5 Mandatory Pre-Provider Rule

```
DO NOT CONSUME THE PROVIDER-CALL BUDGET UNTIL STAGING DEPLOYMENT PARITY IS PROVEN.
```

If Step 3 Phase D (READ-ONLY staging preflight) finds staging already contains `c3e3927` or a proven acceptable descendant (ancestry check passes, worktree clean, stash intact): deployment phase (Phase E) is skipped. Proceed to Phase F.  
If staging does NOT contain `c3e3927`: execute the exact deterministic Phase E deployment procedure before proceeding. Phase D cleanliness gates (branch=main, worktree=CLEAN, stash@{0} intact) are required gates before Phase E mutation is permitted.

---

## 7. Provider Budget

```
PROVIDER_CALL_BUDGET=1
PROVIDER=xai
MODEL=grok-4.5
```

**How established:** E2E-03 confirmed provider `xai` / model `grok-4.5` via `usage_records.model` (criterion 15 PASS). E2E-03 Stage Start §6 confirmed `PROVIDER_MODEL_CURRENT_STAGING_RUNTIME_VERIFIED=YES` via Grok §37 preflight: `AI_PROVIDER=xai` in root `.env`; `PROVIDER_XAI_ENABLED=true` in PM2 runtime. Source: `XAI_ALLOWED_MODELS = ['grok-4.5']`; `grok-4.5` is the only selectable xAI model.

**Step 3 Phase A must re-verify provider/model before enabling gate.** If changed: STOP before enabling `GLOBAL_EXECUTION_ENABLED`.

After the single provider call is consumed: do NOT make a second call inside E2E-04. A second call requires returning to the control plane for new Keith authorization.

---

## 8. Exact Frozen Builder Prompt

**Use this prompt verbatim in Step 3. Do NOT modify.**

```
Create a single file named `e2e-04.html` in this workspace. Its complete contents must be exactly:

<!doctype html>
<html>
<head><meta charset="utf-8"><title>E2E-04</title></head>
<body><h1>PRIVATE-BETA-E2E-04</h1><p>Post-03J confirm-build-apply validation succeeded.</p></body>
</html>

Do not create or modify any other file.
```

**Properties:**

| Property | Value |
|----------|-------|
| Expected file | `e2e-04.html` (distinct from E2E-03's `index.html`) |
| Expected fileActions count | Exactly 1 |
| Expected executionIntent | `workspace_mutation` |
| Expected content | 7 HTML lines exactly as specified |
| Preview-compatible | YES — static HTML, heading visible |
| Non-destructive | Adds one file to a fresh empty workspace |
| No dependencies | No npm, no build step |
| Risky-batch threshold | NO — 1 action ≤ 3 threshold, content < 20,000 chars |
| Confirmation-required | NO — apply proceeds immediately |
| Qualifies for confirm-build-apply | YES — `qualifyBuildApplyConfirmation` returns non-null on full success |

**Why not `index.html`:** Using a distinct filename avoids any confusion with E2E-03's artifact and makes E2E-04 evidence unambiguous.

**Hard-stop if provider returns:**
- Zero fileActions → STOP (no-charge scenario C, per 03D)
- Non-qualifying / malformed actions → STOP
- Execution failure → STOP
- Workspace apply failure → STOP

Do NOT retry with a second provider call.

---

## 9. Test Identity / Project / Session Isolation

### 9.1 Test User

**Existing authorized staging test user:** `7f772841-7844-401b-a3da-e928b0c7b79c`  
**Evidence:** E2E-03 checkpoint §9; user identity established across E2E-01, E2E-02, and E2E-03.

No secret credentials appear in this document. Credential availability is a Step 3 operator precondition (Keith already authenticated to staging in prior E2E runs).

### 9.2 Fresh Project / Session Isolation

| Item | Plan |
|------|------|
| Project name | `E2E-04-Disposable-2026-08-19` |
| Project creation | Keith creates through normal Builder UI — "New Project" → type name → "Create Project" |
| Session creation | Automatic — system creates session and container on project open |
| Isolation from E2E-03 | Fresh project; no prior files; distinct artifact name (`e2e-04.html`) |
| Project retention | RETAIN — no project delete endpoint exists (confirmed E2E-03 Stage Start §10 audit) |
| Session cleanup | `DELETE /api/sessions/:sessionId` after evidence captured |

**Do NOT reuse the E2E-03 execution, session, or project as E2E-04 evidence.**

### 9.3 IDs to Capture in Step 3

Step 3 must capture and record all of the following:

```
TEST_USER_ID=7f772841-7844-401b-a3da-e928b0c7b79c  (already known)
PROJECT_ID=<capture after Keith creates E2E-04 project>
SESSION_ID=<capture after project opens>
CONTAINER_ID=<capture from sessions or docker>
EXECUTION_ID=<capture after provider call completes>
```

Database queries to capture IDs:
```bash
# Project ID
psql "$DATABASE_URL" -c "SELECT id, name FROM projects ORDER BY created_at DESC LIMIT 5;"

# Session ID
psql "$DATABASE_URL" -c "SELECT id, project_id FROM sessions ORDER BY created_at DESC LIMIT 5;"

# Execution ID (after Build completes)
psql "$DATABASE_URL" -c "
SELECT
  execution_id,
  execution_status,
  tokens_used,
  model,
  metadata->'aiExecutionResult'->>'executionIntent' AS intent,
  jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count,
  metadata->'aiExecutionResult'->'fileActions'->0->>'path' AS first_file_action_path,
  timestamp
FROM usage_records
ORDER BY timestamp DESC
LIMIT 5;
"

# Container ID
psql "$DATABASE_URL" -c "SELECT id, session_id, container_id FROM sessions WHERE id = '<SESSION_ID>';"
```

---

## 10. Baseline Credit Evidence Strategy

**BASELINE_CREDIT_BALANCE: Capture fresh immediately before provider call.**

Do NOT reuse historical E2E-03 balance numbers. A fresh baseline is mandatory.

### 10.1 Three Authoritative Sources

| Source | Query / Method | Label |
|--------|---------------|-------|
| 1. DB: `credit_balances.balance` | `psql` query below | `BALANCE_DB_BEFORE` |
| 2. API: `GET /api/billing/balance` response `.balance` | Keith: DevTools or `curl` with session cookie | `BALANCE_API_BEFORE` |
| 3. Browser displayed balance | Keith: reads UI billing panel (after triggering focus refresh) | `BALANCE_BROWSER_BEFORE` |

**NOTE:** `credit_balances` uses `owner_id` + `owner_type`, NOT `user_id` (E2E-03 Stage Start correction #8).

```bash
ssh aisandbox-staging

# Extract DATABASE_URL safely (do NOT source root .env — AUTH_EMAIL_FROM has unquoted angle brackets)
export DATABASE_URL=$(grep '^DATABASE_URL=' /opt/aisandbox/.env | cut -d= -f2-)

# Authoritative DB balance
psql "$DATABASE_URL" -c "SELECT owner_id, owner_type, balance, updated_at FROM credit_balances WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c' AND owner_type = 'user';"
# Record: BALANCE_DB_BEFORE

# Timestamp
date -u +"%Y-%m-%dT%H:%M:%SZ"
# Record: BASELINE_TIMESTAMP / E2E_WINDOW_START
```

### 10.2 Three-Way Reconciliation Before Provider Call

```
BALANCE_DB_BEFORE = BALANCE_API_BEFORE = BALANCE_BROWSER_BEFORE
```

All three must agree. If any mismatch → **STOP. Do NOT enable GLOBAL_EXECUTION_ENABLED.** Investigate discrepancy first.

### 10.3 Balance Sufficiency Gate

`BALANCE_DB_BEFORE` MUST be ≥ 10,000 credits before enabling gate.

**Rationale:** If balance < tokens_used, the deduction would be clamped (`applied_credits = min(requested_credits, balance_before)`, `overflow_credits > 0`). A clamped deduction would make the accounting criteria ambiguous rather than cleanly passing or failing.

**If BALANCE_DB_BEFORE < 10,000 → STOP. Do NOT enable gate. Report to Keith.**

**Expected starting balance:** ~30,577 (last known from E2E-03 final state; no credit mutations since; verify fresh).

---

## 11. Frontend Baseline Balance Strategy (03H Contract)

**Capture before enabling GLOBAL_EXECUTION_ENABLED.**

1. Keith navigates to billing page: `https://staging.ainow.biz/en/app` (billing panel visible)
2. Keith triggers window focus to ensure a fresh `useBillingData` fetch: Alt+Tab away, then Alt+Tab back to browser (or switch browser tab and back)
3. Keith notes: `BALANCE_BROWSER_BEFORE` (displayed number)
4. Keith observes DevTools Network: `GET /api/billing/balance` → HTTP 200, `.balance` field → `BALANCE_API_BEFORE`
5. Both must equal `BALANCE_DB_BEFORE`

**Note:** `Cache-Control: no-store` on balance endpoint (03H fix) prevents stale intermediary caching.

---

## 12. Expected 03D Accounting Sequence

**Exact Build (`workspace_mutation`) deduction sequence:**

```
1. Provider executes → AI worker marks execution completed
2. worker: notifyExecutionComplete(executionId)
   → POST /api/internal/executions/:executionId/finalize-accounting
3. InternalAccountingController.finalizeAccounting()
   → usageLedgerService.triggerDeductionForExecution(executionId)
4. triggerDeductionForExecution reads executionIntent = 'workspace_mutation'
   → logs: { event: 'finalize_accounting.build_awaiting_apply', ... }
   → returns { triggered: false, reason: 'build_awaiting_apply' }
5. *** NO DEDUCTION AT AI COMPLETION ***
   (credit_deduction_records count for executionId = 0 at this point)

6. Frontend receives fileActions via SSE/poll
7. acquireExecutionApplyGuard(executionId) — apply-once gate
8. applySequentialFileActions({sessionId, actions, writeFile, ...})
   → applyResult: { applyStatus: 'applied', results: [...], successCount, totalActions }
9. qualifyBuildApplyConfirmation(applyResult)
   → checks: applyStatus === 'applied', results.length > 0, all 'success', successCount === totalActions
   → returns confirmation object (non-null, qualifying)
10. confirmBuildApplyIfQualifying()
    → browser POST /api/ai/executions/:executionId/confirm-build-apply
       (public URL, session cookie auth, body: { applyStatus, totalActions, successCount })

11. Caddy routes /api/* → API Gateway :4000
12. API Gateway: SessionOrApiKeyAuthGuard validates aisandbox_session cookie
13. ai-execution.controller.ts confirmBuildApply()
    → getExecution(executionId) — verifies execution exists
    → identity.userId === execution.user_id — ownership check
    → usageLedgerService.triggerBuildApplyDeduction(executionId, confirmation)

14. triggerBuildApplyDeduction() — 10-check validation chain:
    → reads usage_records for executionId
    → confirms execution_status = 'completed'
    → confirms executionIntent = 'workspace_mutation'
    → confirms fileActions present and non-empty
    → confirms confirmation.totalActions === fileActions.length
    → confirms successCount === totalActions
    → confirms applyStatus === 'applied'
    → (all 10 checks pass) → logs: { event: 'confirm_build_apply.deduction_triggered', ... }
    → emitDeductionAttempt(record)
    → PersistentCreditDeductionGateway.applyDeduction()

15. applyDeduction():
    → pessimistic FOR UPDATE lock on credit_balances row
    → checks sourceEventId (executionId) not already in credit_deduction_records — UNIQUE constraint
    → computes requested_credits = tokens_used × 1 (rate: model_tokens, creditsPerUnit=1)
    → applied_credits = min(requested_credits, balance_before)
    → overflow_credits = max(requested_credits − balance_before, 0)
    → inserts credit_deduction_records row
    → updates credit_balances.balance
    → *** EXACTLY ONE DEDUCTION ***

16. Controller returns HTTP 200: { executionId, triggered: true, reason: 'ok' }

17. runAiActionCoherence() → refreshes file tree, editor, preview
    → automatic checkpoint: POST /api/sessions/:sessionId/checkpoints
       description: "AI: applied workspace file actions"
```

**BILLING_CHARGES_ENABLED must remain false throughout** (no Stripe/external payment triggers).

---

## 13. Exact Deduction Calculation Rule

```
TOKENS_USED          = usage_records.tokens_used  (capture after execution)
REQUESTED_CREDITS    = TOKENS_USED × 1            (rate: model_tokens, creditsPerUnit=1, rate version 2026-07-v1)
BALANCE_BEFORE       = credit_deduction_records.balance_before
APPLIED_CREDITS      = min(REQUESTED_CREDITS, BALANCE_BEFORE)
OVERFLOW_CREDITS     = max(REQUESTED_CREDITS − BALANCE_BEFORE, 0)
BALANCE_AFTER        = BALANCE_BEFORE − APPLIED_CREDITS
```

**For a clean PASS (no clamping): OVERFLOW_CREDITS must = 0, meaning APPLIED_CREDITS = REQUESTED_CREDITS = TOKENS_USED.**

**Do NOT pre-determine the deduction amount.** It is determined from actual `usage_records.tokens_used` after the execution. Based on E2E-01 (1251–1264 tokens), E2E-02 (1146), and E2E-03 (1148), expect approximately 1,000–2,000 credits. The exact amount is proven from DB evidence only.

Step 3 must capture and compute:

```
BALANCE_BEFORE        = <from credit_deduction_records.balance_before>
TOKENS_USED           = <from usage_records.tokens_used>
EXPECTED_DEDUCTION    = TOKENS_USED (assuming no clamping — verify OVERFLOW_CREDITS=0)
EXPECTED_BALANCE_AFTER = BALANCE_BEFORE − EXPECTED_DEDUCTION
ACTUAL_BALANCE_AFTER  = <from credit_balances.balance after deduction>
```

---

## 14. build_awaiting_apply Proof

**Strongest available evidence sources (in order of authority):**

**Primary — PM2 API Gateway log event:**
```bash
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep 'build_awaiting_apply'
# Expected: one line containing event: 'finalize_accounting.build_awaiting_apply'
```

**Secondary — DB deduction count before apply (pre-confirmation):**
```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS deduction_count
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"
# Expected immediately after AI completion, before workspace apply: 0
```

**Source reference:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` line 784 — logs `finalize_accounting.build_awaiting_apply` when `executionIntent === 'workspace_mutation'`, then returns `{triggered: false, reason: 'build_awaiting_apply'}`.

**PASS condition:** `finalize_accounting.build_awaiting_apply` log event observed AND `credit_deduction_records` count = 0 for executionId at this point.

**FAIL condition:** `finalize_accounting.deduction_triggered` event observed OR deduction record exists before qualifying apply.

---

## 15. Confirm-Build-Apply Proof (Primary 03J Regression Proof)

This is the primary proof that 03J resolved the E2E-03 blocking defect.

**E2E-03 failure:** `confirm_build_apply.request_received = 0` — the confirm request reached the Gateway but had no matching public handler, silently failing.

**E2E-04 expected (with 03J fix):** The Gateway's new public route (`ai-execution.controller.ts confirmBuildApply`) receives the authenticated browser request and delegates to `triggerBuildApplyDeduction`.

### 15.1 Required Chain Evidence

| Link | Evidence Source | Type |
|------|----------------|------|
| Workspace apply SUCCESS | Keith confirms `e2e-04.html` in file tree + editor content | Interactive |
| Browser confirm request issued | qualifyBuildApplyConfirmation returns non-null → confirmBuildApplyIfQualifying POSTs | Source-proven automatic |
| Public route reached (Gateway) | Keith: DevTools Network — `POST /api/ai/executions/<ID>/confirm-build-apply` → HTTP 200 | Interactive |
| triggerBuildApplyDeduction executed | PM2 logs: `confirm_build_apply.deduction_triggered` | PM2 log |
| Deduction occurred | DB: `credit_deduction_records` row with `source_event_id = EXECUTION_ID` | DB query |
| Response correct | Keith: DevTools Network — response body `{"executionId": "...", "triggered": true, "reason": "ok"}` | Interactive |

### 15.2 Critical 03J Log Event Note

**`confirm_build_apply.request_received` is logged by `internal-accounting.controller.ts` line 54 — the INTERNAL handler only.**

The 03J public route (`ai-execution.controller.ts`) does NOT log `confirm_build_apply.request_received` — it is a thin pass-through that goes directly to `triggerBuildApplyDeduction`.

Therefore, for E2E-04 with the 03J fix:
- `confirm_build_apply.request_received` will NOT appear in logs — this is expected and correct.
- `confirm_build_apply.deduction_triggered` WILL appear in logs — this is the authoritative proof that `triggerBuildApplyDeduction` was reached via the public route.

**Do NOT treat absence of `confirm_build_apply.request_received` as a failure in E2E-04.**

### 15.3 Exact Evidence Commands

**PM2 log — deduction triggered:**
```bash
pm2 logs aisandbox-api-gateway --nostream --lines 300 | grep 'confirm_build_apply'
# Expected: one line containing event: 'confirm_build_apply.deduction_triggered'
# NOT expected: 'confirm_build_apply.request_received' (internal handler only)
```

**DB deduction record:**
```bash
psql "$DATABASE_URL" -c "
SELECT
  id,
  source_event_id,
  requested_credits,
  applied_credits,
  overflow_credits,
  balance_before,
  balance_after,
  created_at
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"
# Expected: exactly 1 row
```

**Updated balance:**
```bash
psql "$DATABASE_URL" -c "
SELECT owner_id, owner_type, balance, updated_at
FROM credit_balances
WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c' AND owner_type = 'user';
"
# Expected: balance = BALANCE_DB_BEFORE − applied_credits = EXPECTED_BALANCE_AFTER
```

### 15.4 PASS Condition

ALL of the following must be true:
- Keith's DevTools shows `POST /api/ai/executions/<ID>/confirm-build-apply` → HTTP 200
- DevTools response body: `{"executionId": "...", "triggered": true, "reason": "ok"}`
- PM2 logs contain `confirm_build_apply.deduction_triggered` for this execution window
- `credit_deduction_records` has exactly 1 row with `source_event_id = EXECUTION_ID`
- `overflow_credits = 0`
- `applied_credits = TOKENS_USED`
- `credit_balances.balance = BALANCE_BEFORE − TOKENS_USED`

### 15.5 FAIL / Hard-Stop Conditions

- HTTP response is NOT 200 (e.g., 401, 404, 400, 500) → FAIL criterion 8
- Response body shows `triggered: false` → FAIL criterion 11
- No PM2 `confirm_build_apply.deduction_triggered` event → investigate
- No `credit_deduction_records` row → FAIL criterion 12
- `overflow_credits > 0` → ambiguous deduction — report and classify
- Multiple rows in `credit_deduction_records` for executionId → duplicate deduction FAIL

---

## 16. Pre-Confirm No-Deduction Proof

**Capture deduction count immediately after AI completion, before workspace apply:**

```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS deduction_count
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"
# Required: 0
```

**PASS condition:** COUNT = 0 at this point.  
**If COUNT > 0 before qualifying apply: STOP — premature deduction occurred. FAIL.**

---

## 17. Automatic Checkpoint Proof

The post-apply automatic checkpoint is created by `runAiActionCoherence()` with description `"AI: applied workspace file actions"`. It exercises the 03I Git safe.directory fix.

**Capture:**
```
AUTOMATIC_CHECKPOINT_HASH=<from response or git log>
AUTOMATIC_CHECKPOINT_DESCRIPTION="AI: applied workspace file actions"
```

**Evidence commands:**
```bash
# Git evidence (inside container)
docker exec <CONTAINER_ID> git -C /workspace log --oneline -n 5
# Expected: most recent commit = automatic checkpoint with "AI: applied workspace file actions"

# PostgreSQL evidence
psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at DESC
LIMIT 5;
"
# Expected: 1 row — automatic checkpoint with description "AI: applied workspace file actions"

# SQLite evidence (host-level — filter by session_id)
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
''', ('<SESSION_ID>',)).fetchall()
for r in rows:
    print(json.dumps(dict(r)))
conn.close()
"
# Expected: 1 row — automatic checkpoint
```

**PASS condition:**
- HTTP 201 from checkpoint endpoint
- Non-null `commitHash`
- Git, PostgreSQL, SQLite all agree on the same hash
- `filesChanged ≥ 1` (e2e-04.html committed)

---

## 18. Manual Checkpoint Decision

```
MANUAL_CHECKPOINT_REQUIRED=YES
```

**Rationale:**
1. E2E-03 hard-stopped before executing criterion 20 (manual checkpoint) — it was NOT proven in any prior Builder E2E context.
2. 03I proved the checkpoint fix in an isolated provider-free validation (session `6a9442be`), but not within a complete Builder E2E flow.
3. E2E-04 is the first opportunity to prove the complete Builder journey including manual checkpoint after automatic checkpoint.
4. A complete evidence package is needed for the private-beta GO/NO-GO decision.

**Operator sequence for manual checkpoint (Step 3 only, after confirm-build-apply is proven):**

1. **Marker edit** (required to make workspace dirty after automatic checkpoint commits `e2e-04.html`):
   - Keith opens `e2e-04.html` in the editor
   - Appends a single HTML comment line: `<!-- E2E-04 manual checkpoint marker -->`
   - Saves through normal editor save flow
   - This uses the existing authenticated workspace file-write path
   - Zero provider calls, zero credit deductions, zero AI executions

2. **Manual checkpoint** (after marker edit):
   - Keith clicks the "Save Point" / checkpoint button in Builder workspace header
   - Route: `POST /api/sessions/:sessionId/checkpoints`
   - Controller: `CheckpointsController.createManualCheckpoint` in `services/api-gateway/src/checkpoints/checkpoints.controller.ts`

3. **Expected response:**
   ```json
   HTTP 201
   {
     "message": "Changes committed successfully",
     "commitHash": "<non-null-hash>",
     "filesChanged": 1
   }
   ```

4. **Capture:** `MANUAL_CHECKPOINT_HASH=<commitHash from response>`

**Why marker edit is required:** After the automatic checkpoint commits `e2e-04.html`, the workspace is CLEAN. Without a change, `git commit` finds no modified entries and returns `{ message: 'No changes to commit', commitHash: null }` (HTTP 201 but null hash). A null-hash response satisfies the HTTP 201 criterion letter but provides no reconcilable evidence. The marker edit creates a dirty workspace so the manual checkpoint produces a real commit hash. This is documented per E2E-03 Stage Start §21.0 audit correction.

**PASS condition:**
- HTTP 201 with non-null `commitHash`
- `filesChanged = 1`
- Git, PostgreSQL, SQLite all agree on `MANUAL_CHECKPOINT_HASH`
- Both automatic and manual checkpoints appear in PostgreSQL and SQLite (2 rows per session)

**FAIL condition:** `commitHash: null` → classify as FAIL (ambiguous evidence, per E2E-03 criterion 20 ruling)

**Manual checkpoint evidence commands:**
```bash
# Git evidence (inside container — newest = manual checkpoint, prior = automatic)
docker exec <CONTAINER_ID> git -C /workspace log --oneline -n 5

# PostgreSQL evidence (should now show 2 rows for this session)
psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at DESC
LIMIT 5;
"
# Expected: 2 rows — manual checkpoint (newest) + automatic

# SQLite evidence (host-level, filter by session)
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
''', ('<SESSION_ID>',)).fetchall()
for r in rows:
    print(json.dumps(dict(r)))
conn.close()
"
# Expected: 2 rows — manual (newest) + automatic
```

---

## 19. Frontend Balance Reconciliation Plan (03H Contract)

**After qualifying deduction and before cleanup:**

| Step | Action | Expected |
|------|--------|----------|
| After confirm-build-apply HTTP 200 | Wait ~2 seconds for DB write to settle | — |
| Keith focuses browser window | Alt+Tab away + back (triggers `useBillingData` focus refetch) | `GET /api/billing/balance` triggers |
| Keith observes DevTools Network | `GET /api/billing/balance` → HTTP 200 | Response `.balance = EXPECTED_BALANCE_AFTER` |
| Keith reads displayed balance | Billing panel shows formatted balance | Numeric value = EXPECTED_BALANCE_AFTER |
| DB verification | `SELECT balance FROM credit_balances WHERE owner_id = '...'` | = EXPECTED_BALANCE_AFTER |

**Three-way final reconciliation:**
```
BALANCE_BROWSER_AFTER (displayed) = BALANCE_API_AFTER (GET /api/billing/balance .balance) = BALANCE_DB_AFTER (credit_balances.balance)
```

All three must agree. Discrepancy = FAIL.

**Do NOT perform a browser hard-refresh** (F5/Ctrl+R) — the focus-trigger mechanism is what 03H fixed; a browser refresh would not constitute proof of the 03H fix. Use Alt+Tab or window focus switch.

---

## 20. Workspace / Preview Validation

**File existence and content (Keith manual):**
1. `e2e-04.html` appears in the file tree — YES/NO
2. Editor shows content exactly matching the frozen prompt (7-line HTML) — YES/NO
3. Preview renders heading `PRIVATE-BETA-E2E-04` — YES/NO
4. Preview renders paragraph `Post-03J confirm-build-apply validation succeeded.` — YES/NO

**DB evidence:**
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
WHERE execution_id = '<EXECUTION_ID>';
"
# Expected:
# execution_status = 'completed'
# intent = 'workspace_mutation'
# file_action_count = 1
# first_file_action_path = 'e2e-04.html'
# model = 'grok-4.5'
```

---

## 21. Exact Verified Safety Flag / Config Names

All names confirmed from targeted inspection of actual implementation source (not spec files):

| Flag | Implementation source (authoritative) | Parsing / default | Required value for E2E-04 |
|------|---------------------------------------|-------------------|--------------------------|
| `GLOBAL_EXECUTION_ENABLED` | `services/api-gateway/src/safety/kill-switch.config.ts` — static getter: `process.env.GLOBAL_EXECUTION_ENABLED === 'true'` | Strict exact-string comparison; anything except exactly `'true'` → disabled | false except during bounded provider window |
| `BILLING_CHARGES_ENABLED` | `services/api-gateway/src/startup/production-guardrails.validator.ts` — `process.env.BILLING_CHARGES_ENABLED` | Explicit boolean-compatible string required | false throughout |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `services/ai-service/src/agent-harness/config/agent-harness.config.ts` line 44–48: `parseStrictBooleanEnv('AGENT_HARNESS_ENABLE_TOOL_LOOP', env.AGENT_HARNESS_ENABLE_TOOL_LOOP, false)` | `parseStrictBooleanEnv`: undefined/null/whitespace → `false`; `"true"`/`"false"` case-insensitive accepted; any other non-empty string → throws | false throughout |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `services/ai-service/src/agent-harness/config/agent-harness.config.ts` line 49–53: `parseStrictBooleanEnv('AGENT_HARNESS_ENABLE_WRITE_TOOLS', env.AGENT_HARNESS_ENABLE_WRITE_TOOLS, false)` | Same `parseStrictBooleanEnv` semantics; default false | false throughout |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `services/ai-service/src/agent-harness/config/agent-harness.config.ts` line 54–58: `parseStrictBooleanEnv('AGENT_HARNESS_ENABLE_VALIDATION_TOOLS', env.AGENT_HARNESS_ENABLE_VALIDATION_TOOLS, false)` | Same `parseStrictBooleanEnv` semantics; default false. **Not in baseline runbook §19G kill-switch list — absent from `.env` → defaults false by implementation.** | false throughout (default if absent) |

**`AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` correction notice:** The original Step 2 draft cited only `AGENT_HARNESS_ENABLE_TOOL_LOOP` and `AGENT_HARNESS_ENABLE_WRITE_TOOLS`, and cited the spec file rather than the implementation. The actual implementation (`agent-harness.config.ts`) reveals a third flag: `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS`. All three share the same `parseStrictBooleanEnv` factory with `defaultValue=false`. All three must be confirmed false at Step 3 Phase H. The original safety-flag table omission is corrected here.

**Safe-by-default guarantee:** All three `AGENT_HARNESS_ENABLE_*` flags use `parseStrictBooleanEnv` with `defaultValue=false`. If the environment variable is absent, null, or empty, the flag is `false`. If it contains a non-"true"/"false" value, the service throws at startup — a visible fail-fast. There is no silent misconfiguration path to `true`.

**`AGENT_HARNESS_STUB_WRITE_MODE`** (baseline runbook §19G): Separate from the three flags above. Implemented in `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` line 39 as `process.env.AGENT_HARNESS_STUB_WRITE_MODE === 'true'`. Controls stub adapter write mode only. With `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`, the plain path is used and the stub adapter is not invoked for live xAI execution. Irrelevant to E2E-04's live provider path. Must remain `false` or absent.

**`PLAIN_PATH_CONFIRMED=YES`:** With `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`, the AI service uses the plain (non-harness) execution path. E2E-03 and all prior E2E runs confirmed this. E2E-04 will run on the plain path.

---

## 22. Safety Flags Before / During / After

| Flag | Before provider call | During provider window | After restore |
|------|---------------------|----------------------|---------------|
| `GLOBAL_EXECUTION_ENABLED` (PM2) | `false` | `true` | `false` |
| `GLOBAL_EXECUTION_ENABLED` (root .env) | `false` | `false` (NOT edited) | `false` |
| `BILLING_CHARGES_ENABLED` (.env + PM2) | `false` | `false` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` (PM2 ai-service) | `false` | `false` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` (PM2 ai-service) | `false` | `false` | `false` |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` (PM2 ai-service) | `false` (default if absent) | `false` | `false` |

**Root `.env` is never edited.** Gate changes are PM2 runtime only (`GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env`). The root `.env` staying at `false` is the durable safety record.

`AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` may be absent from the `.env` kill-switch list (not in baseline runbook §19G). If absent from PM2 env, `parseStrictBooleanEnv` defaults it to `false` — confirmed safe by implementation. Phase H must verify it is not set to `true`.

---

## 23. Payment Safety Plan

E2E-04 must NOT trigger:
- Stripe payment
- Invoice generation
- Subscription charge
- `BILLING_CHARGES_ENABLED=true`
- Any external product monetary charging path

The one authorized paid AI provider call (xAI/grok-4.5) is separate from product billing and is entirely within PROVIDER_CALL_BUDGET=1.

`BILLING_CHARGES_ENABLED=false` must be verified at start (Phase A) and end (Phase AN) of Step 3.

---

## 24. Pre-Provider Hard-Stop Conditions

ABORT WITHOUT PROVIDER CALL if any of the following:

1. PRIVATE-BETA-E2E-04 is no longer admitted in Lane 1 (re-bootstrap confirms)
2. Lane 2 is not EMPTY
3. Required resources (STAGING, PROVIDER-LIVE, CREDIT, ENV) are no longer owned by Lane 1 / E2E-04
4. Concurrent work could contaminate evidence
5. Staging does not contain `REQUIRED_SOURCE_SHA=c3e39279abe3c0d6c348daa312107c8f6fc592b7` or an acceptable descendant — AND deployment attempt has failed or is not authorized
5a. Staging branch is not `main` (Phase D2)
5b. Staging working tree is unexpectedly dirty before Phase E mutation (Phase D3 or E1)
5c. Retained stash `0372cc1f47f82e1db060ed2dd756a938fe324803` is absent, displaced, or modified at any preflight check (Phase D4, E2, E8)
6. Required staging services (API Gateway, AI Service, Container Manager, Frontend) are unhealthy
7. Required staging SSH/connectivity cannot be established
8. Test identity (`7f772841-7844-401b-a3da-e928b0c7b79c`) cannot authenticate to staging
9. Fresh authoritative baseline balance (`BALANCE_DB_BEFORE`) cannot be captured
10. Three-way balance baseline does not reconcile (DB ≠ API ≠ Browser)
11. `BALANCE_DB_BEFORE < 10,000` credits (clamped deduction risk)
12. Starting safety flags are not correct (`GLOBAL_EXECUTION_ENABLED` not false, `BILLING_CHARGES_ENABLED` not false)
13. `BILLING_CHARGES_ENABLED` is not false
14. `AGENT_HARNESS_ENABLE_TOOL_LOOP` or `AGENT_HARNESS_ENABLE_WRITE_TOOLS` is true
15. Provider/model cannot be verified as `xai` / `grok-4.5`
16. GLOBAL_EXECUTION_ENABLED enable fails (gateway crash-loops or PM2 runtime shows `false` after enable)
17. An unexpected environment/runtime discrepancy is found
18. The single provider budget cannot be enforced
19. Fresh E2E-04 project could not be created
20. Fresh E2E-04 session/container could not be created

---

## 25. Post-Provider Hard-Stop Conditions

STOP WITHOUT RETRY if any of the following after the one provider call:

1. Execution fails (`execution_status ≠ 'completed'`)
2. Zero fileActions (zero-action contract failure — scenario C, no charge)
3. Malformed or non-qualifying fileActions
4. Workspace apply fails (`applyStatus ≠ 'applied'` or `successCount < totalActions`)
5. Automatic checkpoint fails (HTTP 500 or `commitHash: null`)
6. `build_awaiting_apply` semantics are violated (deduction before qualifying confirmation)
7. Unexpected deduction occurs before qualifying apply confirmation
8. Confirm-build-apply HTTP response is not 200
9. Confirm-build-apply response shows `triggered: false` (qualification checks failed)
10. `credit_deduction_records` count ≠ 1 for executionId after deduction step
11. Duplicate deduction (`credit_deduction_records` count > 1)
12. `overflow_credits > 0` (clamped deduction — balance was insufficient despite gate)
13. Expected and actual balance do not reconcile (`ACTUAL_BALANCE_AFTER ≠ EXPECTED_BALANCE_AFTER`)
14. Frontend balance does not reconcile with authoritative DB under 03H contract
15. `e2e-04.html` content or preview is incorrect
16. Manual checkpoint fails with HTTP 500 or null `commitHash`
17. Git / PostgreSQL / SQLite disagreement on checkpoint hash
18. Unexpected Stripe/payment activity (`BILLING_CHARGES_ENABLED` changed or payment webhook received)
19. Any safety invariant is violated
20. Any hard-stop condition that makes the evidence untrustworthy or unattributable to E2E-04

**After any post-provider FAIL/hard-stop:** perform all safe cleanup (session DELETE, gate restore, verify `GLOBAL_EXECUTION_ENABLED=false`) before recording terminal evidence.

---

## 26. Cleanup Plan

### Cleanup Sequence (Step 3 Phase AL–AR)

**Session cleanup (after all evidence preserved):**
```bash
# Keith executes:
DELETE /api/sessions/<SESSION_ID>
# Route: services/api-gateway/src/sessions/session.controller.ts @Delete(':id')
# Expected: HTTP 200 { "message": "Session terminated successfully" }

# Verify:
psql "$DATABASE_URL" -c "SELECT id, status, terminated_at, container_id FROM sessions WHERE id = '<SESSION_ID>';"
# Expected: status = 'stopped', terminated_at set, container_id empty
```

**Container verification:**
```bash
docker inspect <CONTAINER_ID>
# Expected: no such object (container removed)
```

**Gate restoration (MANDATORY regardless of PASS or FAIL):**
```bash
ssh aisandbox-staging
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")

# R1: Confirm root .env is still false (should be unchanged — never edited)
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# R2: Restore via PM2 inline env
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 8

# R3: Verify PM2 runtime restored
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# REQUIRED: GLOBAL_EXECUTION_ENABLED: false

# R4: Verify readiness
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200

# R5: Verify all 5 PM2 apps online
pm2 list

# FALLBACK — if R3 shows anything other than false:
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 8
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'  # REQUIRED: false
```

### Project Disposition

```
PROJECT_DISPOSITION=RETAIN
```

**Rationale:** No project delete endpoint exists in the API Gateway (confirmed by E2E-03 Stage Start §10 repository-wide scan of `@Delete` decorators). Retention is the only supported outcome. The retained empty project is an inert artifact; all material evidence resides in PostgreSQL and the checkpoint document.

**Do NOT delete historical E2E evidence.** Do NOT touch E2E-03's retained project `55a0b93e-8595-4e15-862e-2e1a6f9f6262`.

---

## 27. Retained Staging Stash — DO NOT TOUCH

```
RETAINED_STASH_HASH=0372cc1f47f82e1db060ed2dd756a938fe324803
RETAINED_STASH_DESCRIPTION=pre-03F-deployment-snapshot-2026-08-15
```

This stash was retained untouched through 03G, 03H, 03I, E2E-03, 03J, and all subsequent governance steps.

**NEVER during E2E-04:**
- pop this stash
- apply this stash
- drop this stash
- replace this stash
- reuse this stash

If staging git status shows this stash, note it as existing prior state and leave it completely untouched.

---

## 28. Evidence Table

| # | Criterion | Pre-state | Action | Expected evidence | Auth source | PASS condition | FAIL / hard-stop | Cleanup |
|---|-----------|-----------|--------|-------------------|-------------|----------------|------------------|---------|
| 1 | Lane/resource isolation | Lane 1 ACTIVE, Lane 2 EMPTY | Re-bootstrap OS v1 | Board confirms admission | TASKS.md board | All confirmed | Lane 2 not EMPTY → ABORT | None |
| 2 | Staging deployment parity | Last known: 54b5764d (no 03J) | Phase D: SSH + full READ-ONLY preflight (HEAD, branch=main, status=CLEAN, stash@{0}=0372cc1f intact, ancestry check). Phase E if DEPLOYMENT_REQUIRED: fetch origin main → reset --hard c3e3927 → npm run build (api-gateway only) → pm2 restart (api-gateway only) → health 200 → safety flags re-confirmed | HEAD = c3e3927 or acceptable descendant; worktree CLEAN; stash intact throughout | git rev-parse HEAD, merge-base, pm2 health | All Phase D checks pass; if Phase E executed: all E1–E15 checks pass | Branch ≠ main → ABORT; dirty worktree at D3 or E1 → ABORT; stash disturbed → ABORT; build fails → ABORT; health ≠ 200 → ABORT | None |
| 3 | Staging service health | Post-03J-deployment | Curl health endpoints | HTTP 200 from all services | PM2 list + health routes | All online, health 200 | Any service unhealthy → ABORT | None |
| 4 | Safety-flag baseline | .env + PM2 env | grep .env, pm2 env | All flags at required values | PM2 env, .env file | All correct | Any flag wrong → ABORT | None |
| 5 | Authentication | Keith has session | Keith confirms login on staging.ainow.biz | Billing page loads, API 200 | Browser + DevTools | Authenticated 200 | Auth fails → ABORT | None |
| 6 | Fresh project/session isolation | No E2E-04 project exists | Keith creates E2E-04 project, opens session | PROJECT_ID, SESSION_ID, CONTAINER_ID captured | DB queries | All IDs captured | Cannot create → ABORT | Session DELETE at end |
| 7 | Initial authoritative balance | Pre-provider | psql credit_balances query | BALANCE_DB_BEFORE ≥ 10,000 | credit_balances table | DB ≥ 10,000 | < 10,000 → ABORT | None |
| 8 | Initial frontend balance | Pre-provider | Keith: Alt+Tab focus refresh | BALANCE_BROWSER_BEFORE = BALANCE_DB_BEFORE | useBillingData + /api/billing/balance | 3-way match | Mismatch → ABORT | None |
| 9 | One provider execution | GLOBAL_EXECUTION_ENABLED enabled | Keith submits frozen Build prompt | execution completes, EXECUTION_ID captured | usage_records DB | status = 'completed', fileActions ≥ 1 | Fails, 0 fileActions, non-qualifying → STOP (no retry) | Restore gate |
| 10 | fileActions qualification | Post-execution | DB query usage_records | intent = workspace_mutation, file_action_count = 1, path = e2e-04.html | usage_records.metadata | All checks pass | ≠ 1 or wrong path → STOP | Restore gate |
| 11 | build_awaiting_apply | Post-AI-completion, pre-apply | PM2 logs grep + DB deduction count | log event present, count = 0 | PM2 logs + credit_deduction_records | Event observed, count = 0 | count > 0 or event missing → STOP | Restore gate |
| 12 | Pre-confirm no-deduction state | After AI completion | psql credit_deduction_records count | count = 0 | credit_deduction_records | COUNT = 0 | COUNT > 0 → FAIL (premature deduction) | Restore gate |
| 13 | Workspace apply | After fileActions produced | Automatic frontend apply | Apply succeeds: applyStatus = 'applied', successCount = totalActions | workspace-ai-file-actions.logic.ts | Full success apply | applyStatus ≠ 'applied' or partial → STOP | Restore gate |
| 14 | Automatic checkpoint | After workspace apply | runAiActionCoherence() | HTTP 201, non-null commitHash, description "AI: applied workspace file actions" | Git + PG + SQLite | 3-way hash agreement, non-null | null hash or HTTP 500 → STOP | Restore gate |
| 15 | Public confirm route (03J) | After apply success | Frontend POSTs confirm-build-apply | HTTP 200, {triggered: true, reason: 'ok'} | DevTools Network (Keith) | HTTP 200, triggered: true | Non-200 or triggered: false → FAIL criterion 8/11 | Restore gate |
| 16 | Deferred-accounting handoff | After confirm request | triggerBuildApplyDeduction() | PM2: confirm_build_apply.deduction_triggered event | PM2 API Gateway logs | Event observed | Event absent → investigate | Restore gate |
| 17 | Exactly-one deduction | After deduction | psql credit_deduction_records | COUNT = 1 for executionId | credit_deduction_records | Exactly 1 row | 0 rows → FAIL crit 12; > 1 → duplicate FAIL | Restore gate |
| 18 | Duplicate/idempotency | After deduction | psql COUNT at intervals | COUNT never exceeds 1 | credit_deduction_records UNIQUE source_event_id | Always 1 | COUNT > 1 → duplicate deduction FAIL | Restore gate |
| 19 | Authoritative balance after | After deduction | psql credit_balances | balance = BALANCE_BEFORE − TOKENS_USED, overflow = 0 | credit_balances + credit_deduction_records | Arithmetic reconciliation | Does not reconcile → FAIL | Restore gate |
| 20 | Frontend balance after | After deduction | Keith: Alt+Tab focus refresh | BALANCE_BROWSER_AFTER = BALANCE_DB_AFTER | useBillingData 03H refresh | 3-way match | Mismatch → FAIL crit 19 | None |
| 21 | Workspace/file validation | After apply | Keith: file tree + editor | e2e-04.html exists, content exact | Keith observation | All 4 checks YES | Any NO → FAIL | None |
| 22 | Preview validation | After apply | Keith: preview panel | Heading + paragraph render correctly | Keith observation | Both YES | Either NO → FAIL | None |
| 23 | Manual checkpoint | After credit evidence + marker edit | Keith clicks Save Point | HTTP 201, non-null commitHash, Git/PG/SQLite reconcile | Checkpoint API + Git + DB | 3-way hash agreement, filesChanged = 1 | null hash or mismatch → FAIL | None |
| 24 | Session/container cleanup | After all evidence | DELETE /api/sessions/:sessionId | HTTP 200, status = stopped, container removed | API response + DB + docker inspect | All confirmed | Failure to clean up → report | Operator completes |
| 25 | GLOBAL_EXECUTION_ENABLED restoration | After cleanup | PM2 restore command | PM2 env shows false, .env shows false | pm2 env grep + .env grep | Both false | Either true → re-attempt restore | None |
| 26 | BILLING_CHARGES_ENABLED=false | Throughout | grep .env + pm2 env | Both false at all points | .env + PM2 env | Both false | Either true → ABORT before provider call | None |
| 27 | Provider-call count | End of Step 3 | Review execution evidence | Exactly 1 (or 0 if aborted pre-provider) | usage_records count in E2E window | Count ≤ 1 | Count > 1 → governance violation | None |
| 28 | Payment/Stripe safety | Throughout | Payment event queries | 0 Stripe calls, 0 invoices in E2E window | Stripe dashboard / DB | All zero | Any non-zero → FAIL + escalate | None |
| 29 | Final PASS/FAIL evidence | End of Step 3 | Compile all evidence | All criteria explicitly classified | This document + Step 4 checkpoint | Explicit verdict | Any criterion without verdict → incomplete | Step 4 |

---

## 29. Exact Step 3 Ordered Runbook

**READ-ONLY** = no mutation, safe to run.  
**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION** = must have Keith's explicit authorization before executing.

---

### Phase A — Re-Bootstrap OS v1 / Verify Lane Admission

**READ-ONLY**

A1. Open fresh Cursor window. Apply AGENTS.md → CLAUDE.md → TASKS.md CURRENT EXECUTION BOARD → PRIVATE-BETA-E2E-04 in TASKS_BACKLOG_FULL.md.  
A2. Confirm Lane 1 = ACTIVE, Lane 2 = EMPTY, Lane 3 = DISABLED.  
A3. Confirm Lane 1 owns STAGING, PROVIDER-LIVE, CREDIT, ENV.  
A4. Confirm PRIVATE-BETA-INVITE-01 remains PROHIBITED.  
A5. **If any check fails → ABORT before proceeding.**

---

### Phase B — Confirm Lane 2 EMPTY and Resource Ownership

**READ-ONLY**

B1. Re-read TASKS.md board — confirm Lane 2 = EMPTY.  
B2. Confirm no concurrent work could contaminate staging/credit/provider evidence.  
B3. If Lane 2 not EMPTY → **ABORT.**

---

### Phase C — Establish Staging SSH/Connectivity

**READ-ONLY**

```powershell
# READ-ONLY
ssh aisandbox-staging "echo connected && hostname"
# Expected: "connected" + hostname output
```

C1. Confirm SSH connectivity to staging.  
C2. If SSH fails → **ABORT.**

---

### Phase D — READ-ONLY Staging Preflight (Cleanliness, Branch, Stash, SHA)

**READ-ONLY — ALL COMMANDS IN THIS PHASE ARE READ-ONLY**

*This preflight must complete fully before any staging git mutation is considered.*

```bash
# D1: Current staging HEAD SHA
# READ-ONLY
git -C /opt/aisandbox rev-parse HEAD

# D2: Current branch — must be 'main'
# READ-ONLY
git -C /opt/aisandbox branch --show-current

# D3: Working tree cleanliness — must produce EMPTY output
# READ-ONLY
git -C /opt/aisandbox status --short

# D4a: Stash reference / description check — stash@{0} must exist with expected description
# READ-ONLY
git -C /opt/aisandbox stash list
# REQUIRED: stash@{0} present, description contains "pre-03F-deployment-snapshot"

# D4b: Exact stash object SHA check — must equal the exact retained stash SHA
# READ-ONLY
git -C /opt/aisandbox rev-parse "stash@{0}"
# REQUIRED EXACT OUTPUT: 0372cc1f47f82e1db060ed2dd756a938fe324803
# Any other SHA → ABORT BEFORE ANY STAGING GIT MUTATION

# D5: Ancestry check — does current staging HEAD already contain REQUIRED_SOURCE_SHA?
# READ-ONLY
git -C /opt/aisandbox merge-base --is-ancestor c3e39279abe3c0d6c348daa312107c8f6fc592b7 HEAD && echo "PARITY_PROVEN" || echo "DEPLOYMENT_REQUIRED"
```

**D1 — Record staging HEAD SHA.**  
**D2 — If branch is not `main` → ABORT. Do not deploy to an unexpected branch.**  
**D3 — If `git status --short` is NOT empty (working tree dirty) → ABORT. Do NOT stash. Do NOT proceed to Phase E. Report exact dirty files to the control plane.**  
**D4 — Verify retained stash identity — TWO checks required:**

- **D4a (reference/description):** `git -C /opt/aisandbox stash list` must show `stash@{0}` with description containing `pre-03F-deployment-snapshot`.
- **D4b (exact object SHA):** `git -C /opt/aisandbox rev-parse "stash@{0}"` must return exactly `0372cc1f47f82e1db060ed2dd756a938fe324803`. `git stash list` alone does not prove the exact object — the SHA check is mandatory.
- Both D4a and D4b must pass. If either fails → **ABORT before any staging git mutation.** Do not attempt to repair inside E2E-04.
- Abort if: `stash@{0}` absent; description unexpected; `rev-parse` returns a different SHA; stash ordering has changed so the retained stash is no longer at `stash@{0}`.
- **Under no circumstances pop, apply, drop, create, replace, reorder, or reuse any stash.**

**D5 — Parity decision:**
- `PARITY_PROVEN` → staging HEAD already contains `REQUIRED_SOURCE_SHA` as ancestor. **SKIP Phase E.** Proceed to Phase F to re-confirm.
- `DEPLOYMENT_REQUIRED` → staging does not contain `c3e3927`. Proceed to Phase E.

**Acceptable-descendant rule:** Staging HEAD is acceptable if `c3e39279abe3c0d6c348daa312107c8f6fc592b7` is a proven ancestor of that HEAD, **AND** the delta between `c3e3927` and staging HEAD consists exclusively of governance/documentation commits containing no production source changes. At Step 2 freeze, all commits after `c3e3927` on `main` (`8d0b6e9`, `0ebea47e`) are confirmed governance-only. If at Step 3 time new commits have been pushed to `main`, Keith must verify they are also governance/documentation-only before accepting parity. **If in doubt → redeploy to exactly `c3e3927`.**

---

### Phase E — Deploy REQUIRED_SOURCE_SHA (if needed)

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

*Execute only if Phase D Step D5 returns `DEPLOYMENT_REQUIRED`.*  
*Phase D must be 100% clean before this phase begins: branch=main, worktree=CLEAN, retained stash confirmed intact.*

**Established deployment mechanism:** `git fetch + git reset --hard <SHA> → npm run build → pm2 restart`. Pattern from 03F checkpoint §8 (`git reset --hard origin/main`), 03H, and 03I incremental updates. Adapted here to pin to exact REQUIRED_SOURCE_SHA rather than branch tip, for deterministic reproducibility.

**No `npm ci` required:** 03J introduced no `package.json` or `package-lock.json` changes. Existing `node_modules` are current.  
**No migration required:** 03J introduced no schema changes.  
**Only API Gateway requires rebuild/restart:** Only `services/api-gateway/src/ai/ai-execution.controller.ts` was modified in `c3e3927`.

```bash
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
# Only execute if Phase D proves DEPLOYMENT_REQUIRED

# E1: Final pre-mutation cleanliness gate — must be empty. ABORT if not.
# READ-ONLY (gate check before mutation)
git -C /opt/aisandbox status --short
# REQUIRED: empty output. If non-empty → ABORT IMMEDIATELY. Do NOT stash. Report dirty files.

# E2a: Final stash reference / description check before mutation
# READ-ONLY (gate check before mutation)
git -C /opt/aisandbox stash list
# REQUIRED: stash@{0} present, description contains "pre-03F-deployment-snapshot"

# E2b: Final exact stash SHA check before mutation — mandatory; stash list alone insufficient
# READ-ONLY (gate check before mutation)
git -C /opt/aisandbox rev-parse "stash@{0}"
# REQUIRED EXACT OUTPUT: 0372cc1f47f82e1db060ed2dd756a938fe324803
# Any other SHA → ABORT. Do NOT proceed to E3.

# E3: Fetch remote commits — makes REQUIRED_SOURCE_SHA available locally on staging
# MUTATING (remote-tracking refs only; working tree unchanged by fetch)
git -C /opt/aisandbox fetch origin main

# E4: Verify REQUIRED_SOURCE_SHA is now known locally
# READ-ONLY
git -C /opt/aisandbox cat-file -t c3e39279abe3c0d6c348daa312107c8f6fc592b7
# Expected: "commit" — if "missing" → fetch failed; ABORT

# E5: Hard reset to exact REQUIRED_SOURCE_SHA
# MUTATING
git -C /opt/aisandbox reset --hard c3e39279abe3c0d6c348daa312107c8f6fc592b7

# E6: Verify HEAD after reset — must equal REQUIRED_SOURCE_SHA exactly
# READ-ONLY
git -C /opt/aisandbox rev-parse HEAD
# REQUIRED: c3e39279abe3c0d6c348daa312107c8f6fc592b7

# E7: Verify worktree clean after reset
# READ-ONLY
git -C /opt/aisandbox status --short
# REQUIRED: empty output

# E8a: Verify retained stash reference / description is still at stash@{0} after reset
# READ-ONLY
git -C /opt/aisandbox stash list
# REQUIRED: stash@{0} present, description contains "pre-03F-deployment-snapshot"

# E8b: Verify exact stash object SHA is unchanged after reset — mandatory
# READ-ONLY
git -C /opt/aisandbox rev-parse "stash@{0}"
# REQUIRED EXACT OUTPUT: 0372cc1f47f82e1db060ed2dd756a938fe324803
# Any deviation → ABORT. Reset may have disturbed the stash.

# E9: Build API Gateway only
# MUTATING (produces dist/ artifacts)
cd /opt/aisandbox/services/api-gateway && npm run build
# Expected: TypeScript compile succeeds, no errors, dist/ updated

# E10: Restart API Gateway only
# MUTATING
pm2 restart aisandbox-api-gateway
sleep 10

# E11: Verify API Gateway is online after restart
# READ-ONLY
pm2 list | grep aisandbox-api-gateway
# Expected: status = online, NOT errored/stopped

# E12: Verify API Gateway health endpoint
# READ-ONLY
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200

# E13: Verify GLOBAL_EXECUTION_ENABLED remains false after gateway restart
# READ-ONLY
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
pm2 env "$GW_ID" | grep 'GLOBAL_EXECUTION_ENABLED'
# REQUIRED: false (or absent, which is also false by gateway semantics)

# E14: Verify BILLING_CHARGES_ENABLED remains false after gateway restart
# READ-ONLY
pm2 env "$GW_ID" | grep 'BILLING_CHARGES_ENABLED'
# REQUIRED: false

# E15: Verify critical env vars still present in gateway process
# READ-ONLY
pm2 env "$GW_ID" | grep -c 'DATABASE_URL'          # REQUIRED: at least 1
pm2 env "$GW_ID" | grep -c 'INTERNAL_SERVICE_KEY'   # REQUIRED: at least 1
pm2 env "$GW_ID" | grep -c 'XAI_API_KEY'            # REQUIRED: at least 1
```

**Abort conditions inside Phase E:**

| Condition | Action |
|-----------|--------|
| E1: `git status --short` non-empty (pre-mutation) | ABORT — do NOT stash — report dirty files |
| E2a: stash list — `stash@{0}` absent or description unexpected | ABORT — do NOT proceed to E3 |
| E2b: `rev-parse "stash@{0}"` ≠ `0372cc1f47f82e1db060ed2dd756a938fe324803` | ABORT — exact SHA mismatch; stash disturbed |
| E3: `git fetch origin main` fails | ABORT — cannot proceed without known remote state |
| E4: REQUIRED_SOURCE_SHA not known locally after fetch | ABORT — SHA not reachable |
| E5: `git reset --hard` fails | ABORT |
| E6: HEAD after reset ≠ `c3e39279abe3c0d6c348daa312107c8f6fc592b7` | ABORT |
| E7: worktree not clean after reset | ABORT |
| E8a: stash list — `stash@{0}` absent or description unexpected after reset | ABORT — stash displaced by reset |
| E8b: `rev-parse "stash@{0}"` ≠ `0372cc1f47f82e1db060ed2dd756a938fe324803` after reset | ABORT — exact SHA changed after reset |
| E9: `npm run build` fails | ABORT — do NOT restart service with broken build |
| E10: PM2 restart fails | ABORT |
| E11: gateway shows errored/stopped | ABORT |
| E12: health endpoint not 200 | ABORT |
| E13: `GLOBAL_EXECUTION_ENABLED=true` after restart | ABORT — safety invariant violated |
| E14: `BILLING_CHARGES_ENABLED=true` after restart | ABORT — safety invariant violated |

**Note on `git fetch origin main`:** This fetches only the `main` branch tracking ref, not all refs. Working tree and HEAD are unchanged by fetch alone. The subsequent `reset --hard` is the only operation that changes working tree and HEAD, and it pins to exactly the known `REQUIRED_SOURCE_SHA` — no arbitrary remote state is merged.

---

### Phase F — Re-Prove Staging Source Parity After Deployment

**READ-ONLY**

```bash
# READ-ONLY
git -C /opt/aisandbox rev-parse HEAD
# Expected: c3e39279abe3c0d6c348daa312107c8f6fc592b7 (or approved descendant)

git -C /opt/aisandbox merge-base --is-ancestor c3e39279abe3c0d6c348daa312107c8f6fc592b7 HEAD && echo "PARITY_PROVEN"
```

F1. Parity must be PROVEN before proceeding.  
F2. If not proven → **ABORT.**

---

### Phase G — Verify Service Health

**READ-ONLY**

```bash
# READ-ONLY
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200 (API Gateway)

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4001/health
# REQUIRED: 200 (Container Manager — adjust port if different)

pm2 list
# REQUIRED: all 5 apps online
```

G1. If any required service is unhealthy → **ABORT.**

---

### Phase H — Capture Starting Safety Flags

**READ-ONLY**

```bash
# READ-ONLY
export DATABASE_URL=$(grep '^DATABASE_URL=' /opt/aisandbox/.env | cut -d= -f2-)
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")

grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# Expected: GLOBAL_EXECUTION_ENABLED: false

grep '^BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# Expected: BILLING_CHARGES_ENABLED=false

pm2 env "$GW_ID" | grep '^BILLING_CHARGES_ENABLED'
# Expected: BILLING_CHARGES_ENABLED: false

# Also verify AGENT_HARNESS flags (AI service)
AI_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-ai-service']")
pm2 env "$AI_ID" | grep 'AGENT_HARNESS_ENABLE'
# Expected: AGENT_HARNESS_ENABLE_TOOL_LOOP: false (or absent)
#           AGENT_HARNESS_ENABLE_WRITE_TOOLS: false (or absent)
#           AGENT_HARNESS_ENABLE_VALIDATION_TOOLS: false (or absent — defaults to false if not set)
# REQUIRED: none of these must show 'true'
```

H1. All flags must be at required values. If any flag shows `true` → **ABORT.**  
H2. `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` may be absent from PM2 env — that is acceptable (defaults to false per implementation). If present, it must not be `true`.  
H3. Confirm AGENT_HARNESS flags belong to the AI service process, not the API Gateway.

---

### Phase I — Confirm BILLING_CHARGES_ENABLED=false

**READ-ONLY** (part of Phase H — confirmation step)

I1. `BILLING_CHARGES_ENABLED` is `false` in both `.env` and PM2 runtime.  
I2. If either is `true` → **ABORT.**

---

### Phase J — Verify Test Identity / Authentication

**READ-ONLY**

J1. Keith confirms login to `https://staging.ainow.biz/en/app` using the authorized staging test account.  
J2. Keith confirms billing page is accessible.  
J3. Confirm user ID in DB:
```bash
# READ-ONLY
psql "$DATABASE_URL" -c "SELECT id AS user_id, email FROM users WHERE id = '7f772841-7844-401b-a3da-e928b0c7b79c';"
# Expected: row exists
```
J4. If authentication fails → **ABORT.**

---

### Phase K — Create/Identify Fresh E2E-04 Project

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

K1. Keith creates new project named `E2E-04-Disposable-2026-08-19` via Builder UI ("New Project" → name → "Create Project").  
K2. Capture PROJECT_ID:
```bash
# READ-ONLY after Keith creates project
psql "$DATABASE_URL" -c "SELECT id, name FROM projects ORDER BY created_at DESC LIMIT 5;"
```
K3. Record `PROJECT_ID=<from query result>`.

---

### Phase L — Create/Identify Fresh E2E-04 Session/Container

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

L1. Keith opens the E2E-04 project in the Builder workspace. System automatically creates session and container.  
L2. Capture SESSION_ID and CONTAINER_ID:
```bash
# READ-ONLY after project opens
psql "$DATABASE_URL" -c "SELECT id, project_id, container_id FROM sessions WHERE project_id = '<PROJECT_ID>' ORDER BY created_at DESC LIMIT 5;"
```
L3. Also capture via Docker:
```bash
# READ-ONLY
docker ps | grep sandbox
```
L4. Record `SESSION_ID=<value>` and `CONTAINER_ID=<value>`.

---

### Phase M — Capture IDs

**READ-ONLY**

M1. Confirm all captured:
```
TEST_USER_ID=7f772841-7844-401b-a3da-e928b0c7b79c
PROJECT_ID=<captured in Phase K>
SESSION_ID=<captured in Phase L>
CONTAINER_ID=<captured in Phase L>
EXECUTION_ID=(will be captured after Phase S)
```

---

### Phase N — Capture Authoritative BASELINE_CREDIT_BALANCE

**READ-ONLY**

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT owner_id, owner_type, balance, updated_at
FROM credit_balances
WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c' AND owner_type = 'user';
"
# Record: BALANCE_DB_BEFORE
date -u +"%Y-%m-%dT%H:%M:%SZ"
# Record: E2E_WINDOW_START / BASELINE_TIMESTAMP
```

N1. Confirm `BALANCE_DB_BEFORE ≥ 10,000`. If not → **ABORT.**

---

### Phase O — Capture Frontend Displayed Baseline Balance (03H Contract)

**READ-ONLY (Keith)**

O1. Keith: navigate to billing page on `https://staging.ainow.biz/en/app`.  
O2. Keith: Alt+Tab away from browser, then back (triggers `useBillingData` focus refetch).  
O3. Keith: observe DevTools Network — `GET /api/billing/balance` → HTTP 200, note `.balance` field → record as `BALANCE_API_BEFORE`.  
O4. Keith: note displayed balance → record as `BALANCE_BROWSER_BEFORE`.  
O5. Three-way check: `BALANCE_DB_BEFORE = BALANCE_API_BEFORE = BALANCE_BROWSER_BEFORE`. If mismatch → **ABORT.**

---

### Phase P — Enable GLOBAL_EXECUTION_ENABLED

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

```bash
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION

# P1: Record pre-change runtime value
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# Expected: GLOBAL_EXECUTION_ENABLED: false

# P2: Record baseline restart count
pm2 describe aisandbox-api-gateway | grep -E 'restart'

# P3: Enable via PM2 inline env (root .env is NOT edited)
GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env

# P4: Wait for startup validation
sleep 8

# P5: Verify PM2 runtime env
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# REQUIRED: GLOBAL_EXECUTION_ENABLED: true

# P6: Verify readiness
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200

# P7: Verify online and restart count
pm2 list | grep aisandbox-api-gateway
# REQUIRED: online, restart count = baseline + 1

# P8: Verify critical env vars still present
pm2 env "$GW_ID" | grep -c '^DATABASE_URL'          # REQUIRED: 1
pm2 env "$GW_ID" | grep -c '^INTERNAL_SERVICE_KEY'   # REQUIRED: 1
pm2 env "$GW_ID" | grep -c '^XAI_API_KEY'            # REQUIRED: 1

# FALLBACK (only if P5 does not show true):
GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
sleep 8
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'   # REQUIRED: true
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready  # REQUIRED: 200
```

**If enable fails or gateway crash-loops after fallback → ABORT (do not proceed to provider call). Restore gate per Phase AN.**

---

### Phase Q — Verify Gate Actually Enabled

**READ-ONLY**

Q1. PM2 env shows `GLOBAL_EXECUTION_ENABLED: true` → proceed.  
Q2. Gateway health HTTP 200 → proceed.  
Q3. If either fails → **ABORT without provider call.** Restore gate immediately.

---

### Phase R — Submit Frozen Builder Build Prompt

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

R1. Keith navigates to the E2E-04 project in the Builder workspace.  
R2. Keith selects Build mode (not Ask/Discuss).  
R3. Keith types the exact frozen prompt from §8 — verbatim, no modifications.  
R4. Keith submits the prompt.

**Keith must report:** Prompt submission timestamp.

---

### Phase S — Consume Exactly ONE Provider Call

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

S1. Exactly one Build execution is running.  
S2. Do NOT submit another prompt.  
S3. Wait for execution to complete (SSE stream ends / status indicator completes).  
S4. Keith notes: execution appeared to complete, fileActions panel shows content — YES/NO.

**PROVIDER_CALL_BUDGET is now fully consumed. No retry is authorized.**

---

### Phase T — Capture EXECUTION_ID / Provider / Model / Tokens / fileActions

**READ-ONLY**

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT
  execution_id,
  execution_status,
  tokens_used,
  model,
  metadata->'aiExecutionResult'->>'executionIntent' AS intent,
  jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count,
  metadata->'aiExecutionResult'->'fileActions'->0->>'path' AS first_file_action_path,
  timestamp
FROM usage_records
ORDER BY timestamp DESC
LIMIT 5;
"
```

T1. Record: `EXECUTION_ID`, `TOKENS_USED`, `model` (must = 'grok-4.5'), `intent` (must = 'workspace_mutation'), `file_action_count` (must ≥ 1), `first_file_action_path` (must = 'e2e-04.html').  
T2. If `execution_status ≠ 'completed'` → **STOP.**  
T3. If `file_action_count = 0` → **STOP** (zero-action failure, no deduction by policy).  
T4. If `first_file_action_path ≠ 'e2e-04.html'` → **STOP** (wrong artifact).

---

### Phase U — Prove build_awaiting_apply

**READ-ONLY**

```bash
# READ-ONLY

# PM2 log evidence
pm2 logs aisandbox-api-gateway --nostream --lines 300 | grep 'build_awaiting_apply'
# Expected: line containing event: 'finalize_accounting.build_awaiting_apply'

# DB deduction count (should be 0 at this point — before apply)
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS deduction_count
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"
# Expected: 0
```

U1. Log event observed AND count = 0 → continue.  
U2. If count > 0 → **STOP** (premature deduction FAIL).

---

### Phase V — Prove No Premature Deduction Before Qualifying Apply Confirmation

**READ-ONLY** (same as Phase U, explicit confirmation step)

V1. `credit_deduction_records` count for EXECUTION_ID = 0 confirmed before workspace apply proceeds.

---

### Phase W — Apply Qualifying FileActions Exactly Once

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

W1. Keith confirms `e2e-04.html` appears in fileActions panel in the Builder UI.  
W2. Keith confirms apply button is available (or automatic apply has occurred).  
W3. If apply requires Keith confirmation (risky batch — should NOT apply since 1 action ≤ threshold): apply once.  
W4. If apply is automatic (expected for 1 non-risky action): observe apply completion.  
W5. Apply must NOT be retried.

---

### Phase X — Verify Workspace Apply Success

**READ-ONLY (Keith observation)**

X1. Keith confirms: `e2e-04.html` appears in file tree — YES/NO.  
X2. Keith confirms: editor shows expected 7-line HTML content — YES/NO.  
X3. Keith confirms: preview panel renders correctly — YES/NO.  
X4. If any confirmation is NO → **STOP.**

---

### Phase Y — Verify Automatic Post-Apply Checkpoint

**READ-ONLY**

```bash
# READ-ONLY

# Git evidence (inside container)
docker exec <CONTAINER_ID> git -C /workspace log --oneline -n 5
# Expected: most recent = "AI: applied workspace file actions" commit

# PostgreSQL evidence
psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at DESC
LIMIT 5;
"
# Expected: 1 row — automatic checkpoint

# SQLite evidence (host-level, filtered by session)
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
''', ('<SESSION_ID>',)).fetchall()
for r in rows:
    print(json.dumps(dict(r)))
conn.close()
"
```

Y1. Record `AUTOMATIC_CHECKPOINT_HASH`.  
Y2. Git = PostgreSQL = SQLite on same hash → continue.  
Y3. Non-null hash, description = "AI: applied workspace file actions" → continue.  
Y4. If null hash or mismatch → **STOP.**

---

### Phase Z — Prove Public API Gateway Confirm-Build-Apply Handoff (03J Primary Proof)

**READ-ONLY (Keith DevTools observation)**

Z1. Keith: DevTools Network panel — observe the POST request to `/api/ai/executions/<EXECUTION_ID>/confirm-build-apply`.  
Z2. Keith reports: HTTP response code (expected: 200).  
Z3. Keith reports: response body (expected: `{"executionId": "<ID>", "triggered": true, "reason": "ok"}`).  
Z4. This request happens automatically immediately after successful workspace apply — Keith should not need to trigger it manually.  
Z5. If HTTP ≠ 200 or `triggered ≠ true` → **STOP. FAIL criterion 8/11.**

---

### Phase AA — Prove Deferred-Accounting Path Handled Confirmation

**READ-ONLY**

```bash
# READ-ONLY
pm2 logs aisandbox-api-gateway --nostream --lines 300 | grep 'confirm_build_apply'
# Expected: line containing event: 'confirm_build_apply.deduction_triggered'
# NOT expected (internal handler): 'confirm_build_apply.request_received'
# Note: absence of 'confirm_build_apply.request_received' is EXPECTED for 03J public route (see §15.2)
```

AA1. `confirm_build_apply.deduction_triggered` event observed → accounting path was reached.  
AA2. If event is absent → investigate (potential failure of qualification checks).

---

### Phase AB — Prove Exactly One Deduction

**READ-ONLY**

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT
  id,
  source_event_id,
  requested_credits,
  applied_credits,
  overflow_credits,
  balance_before,
  balance_after,
  created_at
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"
# Expected: exactly 1 row
```

AB1. COUNT = 1 → continue.  
AB2. COUNT = 0 → **STOP.** Deduction never occurred. FAIL criterion 12.  
AB3. COUNT > 1 → **STOP.** Duplicate deduction. FAIL idempotency.

---

### Phase AC — Check Duplicate/Idempotency Evidence

**READ-ONLY**

AC1. Confirm `credit_deduction_records` has exactly 1 row for EXECUTION_ID (from Phase AB).  
AC2. The UNIQUE constraint on `source_event_id` (= EXECUTION_ID) prevents additional rows.  
AC3. A second confirm-build-apply request would return `skippedDuplicate: true` — safe no-op.  
AC4. Do NOT intentionally send a second confirm request as an idempotency test — the budget is consumed and evidence isolation must be preserved.

---

### Phase AD — Calculate EXPECTED_DEDUCTION and EXPECTED_BALANCE_AFTER

**READ-ONLY (arithmetic)**

```
TOKENS_USED          = <from Phase T>
EXPECTED_DEDUCTION   = TOKENS_USED  (assuming overflow_credits = 0)
EXPECTED_BALANCE_AFTER = BALANCE_DB_BEFORE − EXPECTED_DEDUCTION
```

AD1. If `overflow_credits > 0` → deduction was clamped. Report exact values. Classify criterion 12 status appropriately.

---

### Phase AE — Capture ACTUAL_BALANCE_AFTER

**READ-ONLY**

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT owner_id, owner_type, balance, updated_at
FROM credit_balances
WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c' AND owner_type = 'user';
"
# Record: ACTUAL_BALANCE_AFTER
```

---

### Phase AF — Reconcile Authoritative Accounting / API Balance

**READ-ONLY**

AF1. `ACTUAL_BALANCE_AFTER = credit_deduction_records.balance_after = EXPECTED_BALANCE_AFTER` → PASS.  
AF2. `balance_before = BALANCE_DB_BEFORE` → confirm matches.  
AF3. `requested_credits = applied_credits = TOKENS_USED` (no clamping) → confirm.  
AF4. If any mismatch → **FAIL.**

---

### Phase AG — Verify Frontend Displayed Balance Reconciliation (03H Contract)

**READ-ONLY (Keith)**

AG1. Keith: Alt+Tab focus switch (triggers `useBillingData` focus refetch).  
AG2. Keith: observe DevTools Network → `GET /api/billing/balance` → HTTP 200, `.balance` = `ACTUAL_BALANCE_AFTER`.  
AG3. Keith: read displayed billing panel balance → must numerically equal `ACTUAL_BALANCE_AFTER`.  
AG4. Three-way: `BALANCE_BROWSER_AFTER = BALANCE_API_AFTER = ACTUAL_BALANCE_AFTER`. All must agree.  
AG5. If any mismatch → **FAIL criterion 19** (equivalent).

---

### Phase AH — Validate Expected Workspace File/Content

**READ-ONLY (Keith)**

AH1. Keith: `e2e-04.html` exists in file tree — YES.  
AH2. Keith: editor shows exact 7-line HTML matching frozen prompt — YES.  
AH3. If either NO → **FAIL.**

---

### Phase AI — Validate Preview

**READ-ONLY (Keith)**

AI1. Keith: preview panel shows heading `PRIVATE-BETA-E2E-04` — YES.  
AI2. Keith: preview panel shows paragraph `Post-03J confirm-build-apply validation succeeded.` — YES.  
AI3. If either NO → **FAIL.**

---

### Phase AJ — Marker Edit + Manual Checkpoint (MANUAL_CHECKPOINT_REQUIRED=YES)

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

*Execute only if Phases Z–AI are all PASS.*

**AJ1 — Marker edit (Keith interactive):**
- Keith opens `e2e-04.html` in the Builder editor.
- Keith appends exactly one line at the end: `<!-- E2E-04 manual checkpoint marker -->`
- Keith saves via normal editor save flow (Ctrl+S or equivalent).
- Zero provider calls, zero AI execution, zero credit deduction.

**AJ2 — Manual checkpoint (Keith interactive):**
- Keith clicks the "Save Point" / checkpoint button in the Builder workspace header.
- Route: `POST /api/sessions/<SESSION_ID>/checkpoints` (HTTP 201 expected).
- Keith notes response in DevTools Network: `commitHash` field must be non-null.
- Keith reports: HTTP code, `commitHash`, `filesChanged`.

**AJ3 — Capture:**
```
MANUAL_CHECKPOINT_HASH=<commitHash from AJ2 response>
```

**AJ4 — Git/PG/SQLite reconciliation:**
```bash
# READ-ONLY

# Git (newest = manual, prior = automatic)
docker exec <CONTAINER_ID> git -C /workspace log --oneline -n 5

# PostgreSQL (should show 2 rows for this session)
psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at DESC
LIMIT 5;
"

# SQLite (host-level)
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
''', ('<SESSION_ID>',)).fetchall()
for r in rows:
    print(json.dumps(dict(r)))
conn.close()
"
```

PASS condition: MANUAL_CHECKPOINT_HASH non-null, `filesChanged = 1`, Git = PostgreSQL = SQLite on same hash, both checkpoints (auto + manual) visible for this session.

**If `commitHash: null` → FAIL.** Do NOT accept null hash as PASS.

---

### Phase AK — Capture Final E2E Evidence

**READ-ONLY**

AK1. Compile all captured values:
```
TEST_USER_ID=
PROJECT_ID=
SESSION_ID=
CONTAINER_ID=
EXECUTION_ID=
TOKENS_USED=
PROVIDER=xai
MODEL=grok-4.5
BALANCE_DB_BEFORE=
BALANCE_API_BEFORE=
BALANCE_BROWSER_BEFORE=
EXPECTED_DEDUCTION=
EXPECTED_BALANCE_AFTER=
ACTUAL_BALANCE_AFTER=
AUTOMATIC_CHECKPOINT_HASH=
MANUAL_CHECKPOINT_HASH=
GLOBAL_EXECUTION_ENABLED_BEFORE=false
GLOBAL_EXECUTION_ENABLED_DURING=true
PROVIDER_CALL_COUNT=1
CREDIT_DEDUCTION_COUNT=1
DEDUCTION_ROW_SOURCE_EVENT_ID=EXECUTION_ID
OVERFLOW_CREDITS=0 (expected)
FINAL_VERDICT=PASS or FAIL/<criterion>
```

---

### Phase AL — Clean Up Session/Container

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION**

```bash
# MUTATING — Keith executes:
# DELETE /api/sessions/<SESSION_ID>
# Route: DELETE https://staging.ainow.biz/api/sessions/<SESSION_ID>
# Expected: HTTP 200 { "message": "Session terminated successfully" }

# Verify:
psql "$DATABASE_URL" -c "SELECT id, status, terminated_at, container_id FROM sessions WHERE id = '<SESSION_ID>';"
# Expected: status = 'stopped', terminated_at set, container_id empty

docker inspect <CONTAINER_ID>
# Expected: no such object
```

---

### Phase AM — Apply Project Disposition

**READ-ONLY (project retention is mandatory)**

AM1. Project `E2E-04-Disposable-2026-08-19` remains retained. No deletion action exists or is authorized.

---

### Phase AN — Restore GLOBAL_EXECUTION_ENABLED=false

**MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION (MANDATORY regardless of outcome)**

```bash
# MUTATING — MANDATORY regardless of PASS or FAIL

GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")

# Confirm root .env is still false (should be unchanged)
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# RESTORE
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 8

# Verify
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'
# REQUIRED: GLOBAL_EXECUTION_ENABLED: false

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200

pm2 list | grep aisandbox-api-gateway
# REQUIRED: online

# FALLBACK
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 8
pm2 env "$GW_ID" | grep '^GLOBAL_EXECUTION_ENABLED'  # REQUIRED: false
```

---

### Phase AO — Verify GLOBAL_EXECUTION_ENABLED=false

**READ-ONLY**

AO1. PM2 env: `GLOBAL_EXECUTION_ENABLED: false` — confirmed.  
AO2. Root `.env`: `GLOBAL_EXECUTION_ENABLED=false` — confirmed (was never edited).  
AO3. Gateway health: HTTP 200.  
AO4. Record Gateway PID after restore.

---

### Phase AP — Verify BILLING_CHARGES_ENABLED=false

**READ-ONLY**

```bash
# READ-ONLY
grep '^BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# Expected: BILLING_CHARGES_ENABLED=false

pm2 env "$GW_ID" | grep 'BILLING_CHARGES_ENABLED'
# Expected: BILLING_CHARGES_ENABLED: false
```

---

### Phase AQ — Verify Provider-Call Count

**READ-ONLY**

```bash
# READ-ONLY — usage_records created during E2E window
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS execution_count
FROM usage_records
WHERE timestamp >= '<E2E_WINDOW_START>'
  AND session_id = '<SESSION_ID>';
"
# Expected: 1
```

AQ1. Count = 1 (or 0 if aborted pre-provider) → correct.  
AQ2. Count > 1 → governance violation — report to Keith.

---

### Phase AR — Verify No Duplicate Deduction

**READ-ONLY**

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS deduction_count
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"
# Expected: 1
```

AR1. Count = 1 → correct.  
AR2. Count > 1 → duplicate deduction — FAIL.

---

### Phase AS — Verify No Stripe/Payment Activity

**READ-ONLY**

AS1. `BILLING_CHARGES_ENABLED` was false throughout → no Stripe integration was active.  
AS2. If Keith has access to Stripe test dashboard, confirm 0 events during E2E window.  
AS3. Record: `STRIPE_CALLS=0`, `PAYMENT_WEBHOOKS=0`, `INVOICES_GENERATED=0`.

---

### Phase AT — Verify Lane/Resource Evidence Uncontaminated

**READ-ONLY**

AT1. Lane 2 remained EMPTY throughout Step 3 (no concurrent work admitted).  
AT2. No concurrent credit mutations occurred outside the E2E window.  
AT3. No other staging deployments occurred during the E2E window.  
AT4. Retained stash `0372cc1f47f82e1db060ed2dd756a938fe324803` was untouched.

---

### Phase AU — Record Terminal Verdict

AU1. Compile all criterion results (see §4 below for criteria list).  
AU2. Record: `FINAL_VERDICT=PASS` or `FINAL_VERDICT=FAIL/<criterion-number-and-name>`.  
AU3. A PASS here supports but does NOT automatically authorize PRIVATE-BETA-INVITE-01.

---

### Phase AV — Prepare Evidence for Step 4 Consolidation

AV1. All evidence, IDs, hashes, and criterion results compiled.  
AV2. Terminal verdict recorded.  
AV3. Step 4 (Consolidation / Final Verdict + Checkpoint) requires separate Keith authorization.

---

## 30. Keith / Manual Interaction Steps

| Step | URL / Location | Action | Expected Visible Result | Evidence to Report | Screenshot useful? |
|------|---------------|--------|------------------------|-------------------|-------------------|
| O — frontend balance baseline | `https://staging.ainow.biz/en/app` (billing panel) | Alt+Tab away + back, observe DevTools Network | `GET /api/billing/balance` → HTTP 200, `.balance` = BALANCE_DB_BEFORE | `BALANCE_API_BEFORE`, `BALANCE_BROWSER_BEFORE` | YES |
| K — create project | `https://staging.ainow.biz/en/app` | "New Project" → type `E2E-04-Disposable-2026-08-19` → "Create Project" | Project created, workspace opens | Project appears in list | YES |
| L — open session | Builder workspace for E2E-04 project | Navigate to project, wait for session/container start | Workspace editor is ready | Session ready indicator | YES |
| R — submit Build prompt | Builder workspace — Build mode | Select Build, type exact prompt, submit | Prompt submitted, AI streaming starts | Submission timestamp | YES |
| S — observe execution | Builder workspace | Wait for execution to complete | Streaming completes, fileActions appear | Execution status indicator | YES |
| W — apply fileActions | Builder workspace | Confirm or observe automatic apply of `e2e-04.html` | Apply completes successfully | Apply status visible | YES |
| X — verify workspace | Builder workspace (file tree + editor + preview) | Observe `e2e-04.html` in file tree, open in editor, check preview | File exists, content correct, preview renders | All 4 YES answers | YES |
| Z — observe confirm request | DevTools Network panel | Watch for `POST /api/ai/executions/<ID>/confirm-build-apply` | HTTP 200, body `{triggered: true, reason: 'ok'}` | Response code + body | YES |
| AG — frontend balance after | `https://staging.ainow.biz/en/app` (billing panel) | Alt+Tab focus refresh | Balance updated to EXPECTED_BALANCE_AFTER | `BALANCE_BROWSER_AFTER`, `BALANCE_API_AFTER` | YES |
| AJ1 — marker edit | Builder workspace editor | Open `e2e-04.html`, append `<!-- E2E-04 manual checkpoint marker -->`, save | File saved | Confirm save completed | YES |
| AJ2 — manual checkpoint | Builder workspace header | Click "Save Point" button | Modal shows success with commit hash | HTTP 201 + commitHash + filesChanged | YES |
| AL — session cleanup | API client or browser DevTools | `DELETE /api/sessions/<SESSION_ID>` with session cookie | HTTP 200, "Session terminated successfully" | HTTP code + response body | YES |

---

## 31. Frozen Builder Prompt (Repeat for Clarity)

**EXACT FROZEN PROMPT — Copy verbatim:**

```
Create a single file named `e2e-04.html` in this workspace. Its complete contents must be exactly:

<!doctype html>
<html>
<head><meta charset="utf-8"><title>E2E-04</title></head>
<body><h1>PRIVATE-BETA-E2E-04</h1><p>Post-03J confirm-build-apply validation succeeded.</p></body>
</html>

Do not create or modify any other file.
```

---

## 32. Ask Semantics Proof (Criterion 16)

Criterion 16 is proven by source evidence — no live Ask provider call is authorized or needed.

Source evidence (`services/api-gateway/src/usage-ledger/usage-ledger.service.ts`):
```typescript
if (executionIntent === 'workspace_mutation') {
  return { triggered: false, reason: 'build_awaiting_apply' };  // Build path only
}
await this.emitDeductionAttempt(record);  // Ask / conversation — immediate deduction unchanged
```

Ask (`conversation`) intent proceeds to `emitDeductionAttempt` without the `build_awaiting_apply` gate. This is unchanged from the original implementation and is proven by unit tests (107/107 PASS, 03D-A).

**STEP_3_LIVE_ASK_CALL_AUTHORIZED=NO**

---

## 33. Step 3 Authorization Budget

| Item | Count |
|------|-------|
| Provider calls (xAI / grok-4.5 Build) | Exactly 1 |
| Credit deductions via confirm-build-apply | Exactly 1 |
| `GLOBAL_EXECUTION_ENABLED=true` windows | Exactly 1 bounded interval |
| Disposable projects | 1 (retained — no delete endpoint) |
| Disposable sessions / containers | 1 (created; deleted at cleanup) |
| Workspace mutation journeys | 1 |
| AI-written workspace files | 1 (`e2e-04.html`) |
| Operator marker edits | 1 (append `<!-- E2E-04 manual checkpoint marker -->` to `e2e-04.html`) |
| Automatic post-apply checkpoints | 1 (expected, unavoidable consequence of authorized apply) |
| Manual checkpoint attempts | 1 |
| Total expected checkpoint creations | 2 |
| Root `.env` edits | 0 (root `.env` stays at false throughout) |
| PM2 restarts (api-gateway) | 2 (enable + restore; +1 each fallback if needed, max 4) |
| Authenticated session DELETE | 1 |
| Ask provider calls | 0 |
| Stripe / payment calls | 0 |

---

## 34. E2E-04 Acceptance Criteria List (from TASKS_BACKLOG_FULL.md)

For Step 3 verdict classification:

| # | Criterion | Stage-Start Proof Source |
|---|-----------|--------------------------|
| 1 | Authentication works | Phase J |
| 2 | Controlled Builder execution succeeds | Phase S/T |
| 3 | Qualifying fileActions produced | Phase T |
| 4 | Workspace apply succeeds | Phase W/X |
| 5 | build_awaiting_apply observed before confirmation | Phase U |
| 6 | Public Gateway confirm path reached (03J proof) | Phase Z |
| 7 | Confirm handoff observed (triggerBuildApplyDeduction) | Phase AA/AB |
| 8 | Exactly one qualifying deferred deduction observed | Phase AB |
| 9 | No duplicate deduction | Phase AC/AR |
| 10 | Authoritative balance reconciles | Phase AF/AE |
| 11 | Frontend/displayed balance reconciles (03H contract) | Phase AG |
| 12 | Automatic checkpoint succeeds (Git/PG/SQLite) | Phase Y |
| 13 | Manual checkpoint succeeds (Git/PG/SQLite) | Phase AJ |
| 14 | Workspace/preview result valid | Phase AH/AI |
| 15 | Cleanup succeeds | Phase AL |
| 16 | GLOBAL_EXECUTION_ENABLED restored false | Phase AN/AO |
| 17 | BILLING_CHARGES_ENABLED remains false | Phase AP |
| 18 | No Stripe/payment activity | Phase AS |
| (gov) | E2E-03 remains unchanged historical FAIL/BLOCKED | Not touched |
| (gov) | PRIVATE-BETA-INVITE-01 remains prohibited | Not touched |

---

## 35. Step 2 Final Status

```
PRIVATE-BETA-E2E-04 remains: ACTIVE

Step 1: COMPLETE — Registration / Admission — 2026-08-18
Step 2: COMPLETE — Stage-Start / Exact Controlled E2E Runbook — 2026-08-19
Step 3: PENDING — EXPLICIT KEITH RUNTIME AUTHORIZATION REQUIRED
Step 4: PENDING

Lane 1 retains: STAGING, PROVIDER-LIVE, CREDIT, ENV
Lane 2: EMPTY
Lane 3: DISABLED
Governance mutex: RELEASED (Step 2 complete)
Governance owner: EMPTY / NONE

RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO

PRIVATE-BETA-INVITE-01: UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
```

**Unresolved material runbook ambiguity:** NONE  
**Runbook is deterministic and evidence-supported:** YES  

---

## 36. Quick Reference

```
REQUIRED_SOURCE_SHA=c3e39279abe3c0d6c348daa312107c8f6fc592b7
STAGING_03J_DEPLOYMENT_PARITY=REQUIRED
LAST_VERIFIED_STAGING_SHA=54b5764d8645d80a44f5de1351ca8e7928c5c8f4
PROVIDER=xai
MODEL=grok-4.5
PROVIDER_CALL_BUDGET=1
TEST_USER_ID=7f772841-7844-401b-a3da-e928b0c7b79c
MANUAL_CHECKPOINT_REQUIRED=YES
PROJECT_DISPOSITION=RETAIN
RETAINED_STASH=0372cc1f47f82e1db060ed2dd756a938fe324803 — DO NOT TOUCH
GLOBAL_EXECUTION_ENABLED safe-mechanism=PM2 inline env (root .env never edited)
SQLite DB path (host-level)=/opt/aisandbox/database/aisandbox.db
credit_balances key columns=owner_id, owner_type (not user_id)
usage_records temporal field=timestamp (not updated_at)
confirm_build_apply.request_received=NOT logged by 03J public route (logged by internal handler only)
confirm_build_apply.deduction_triggered=LOGGED by usage-ledger service — primary proof
Deduction formula=tokens_used × 1 (creditsPerUnit=1, rate 2026-07-v1), no clamping if balance ≥ tokens_used
```

---

*Stage-start document created: 2026-08-19 — PRIVATE-BETA-E2E-04 Step 2 — read-only planning only — no runtime action — no provider call — no balance mutation — no PM2 action — no .env edit — no source/test edit — no git add/commit/push.*
