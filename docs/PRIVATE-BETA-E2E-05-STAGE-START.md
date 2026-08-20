# PRIVATE-BETA-E2E-05 — Stage Start / Exact Corrected E2E Runbook

**Task ID:** PRIVATE-BETA-E2E-05  
**Title:** Fresh Post-03J Builder E2E — Corrected Session-Timing Validation  
**Step:** Step 2 — Stage Start / Exact Corrected E2E Runbook — **COMPLETE — 2026-08-20**  
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
- Staging deployment (if required)
- Enabling GLOBAL_EXECUTION_ENABLED
- Provider call
- Credit mutation
- Live browser E2E
- Creating the fresh E2E-05 project/session

**DO NOT EXECUTE STEP 3 WITHOUT KEITH'S EXPLICIT GO.**

---

## 1. OS v1 Bootstrap Confirmation

| Check | Result |
|-------|--------|
| PRIVATE-BETA-E2E-05 admitted in Lane 1 | YES |
| Lane 1 state | ACTIVE |
| Step 1 status | COMPLETE — Registration / Admission — 2026-08-20 |
| Workstream | RELIABILITY |
| Lifecycle | 4-step HIGH-RISK |
| Lane 1 resource ownership | STAGING, PROVIDER-LIVE, CREDIT, ENV |
| Lane 2 state | EMPTY |
| Lane 3 state | DISABLED |
| BUILDER_PRIVATE_BETA_READINESS | NO_GO_PENDING_FRESH_E2E |
| PRIVATE-BETA-INVITE-01 | UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED |

Single-lane evidence-isolation rule: YES. Lane 2 must remain EMPTY for the entire E2E-05 ACTIVE/LANE-DONE lifecycle.

---

## 2. Pre-Step-2 Baseline

```
PRE_STEP2_HEAD=55be74254bd4e4d432d8324bd92f07659f9a7006
PRE_STEP2_GIT_STATUS=(empty — clean working tree)
```

Working tree was clean at Step 2 entry. Keith's Step 1 commit was already pushed (current HEAD = 55be742). All Step 2 changes are attributable exclusively to this step (governance/docs only).

---

## 3. Evidence Documents Read

| Document | Key Facts Extracted |
|----------|---------------------|
| `docs/PRIVATE-BETA-BLOCKER-03K-CHECKPOINT.md` | EFFECTIVE_SESSION_IDLE_TIMEOUT_MS=1800000 (30 min); provider=xai/grok-4.5; provider duration ~2934ms; session_id 1492ed19; MAP-based idle enforcement; no restart; first-access initializes lastActivity; confirmed E2E-04 session age ~48 min |
| `docs/PRIVATE-BETA-E2E-04-CHECKPOINT.md` | STAGING_HEAD=c3e39279 proven; RETAINED_STASH_SHA=0372cc1f intact; PROVIDER=xai/MODEL=grok-4.5; tokens_used=1176; BALANCE_DB_BEFORE=30577; BALANCE_AFTER=30577 (no deduction); finalize_accounting.build_awaiting_apply observed; idle_timeout at apply failure; project=f5de42f3 RETAIN |
| `docs/PRIVATE-BETA-BLOCKER-03H-CHECKPOINT.md` | focus-refetch proven; 03H mechanism: window 'focus' event → GET /api/billing/balance; E2E-04 execution confirmed Alt+Tab unreliable; Chrome same-window tab switch CONFIRMED PASS |
| `docs/PRIVATE-BETA-E2E-04-STAGE-START.md` | PM2 names; DB queries; deployment procedure; safety flag names; deduction formula; session timing fields; hard stop conditions; cleanup procedure |
| `docs/PRIVATE-BETA-E2E-04-EXECUTION.md` (targeted §O) | O_FOCUS_REFETCH_OBSERVED=NO (Alt+Tab failed); O_TAB_SWITCH_REFETCH_OBSERVED=YES (Chrome same-window tab switch confirmed) |

---

## 4. Targeted Source Inspection Results

| File | Key Fact Established |
|------|----------------------|
| `services/container-manager/src/config/governance.config.ts` lines 92–95 | Default SESSION_IDLE_TIMEOUT_MS=1800000 (30 min). Reads `SESSION_IDLE_TIMEOUT_MS` env var; absent in staging PM2 env → default applies |
| `services/container-manager/src/sessions/sessions.service.ts` lines 939–999 | `checkAndEnforceIdleTimeout`: first-access initializes Map to `now`; subsequent accesses compare `elapsed > idleTimeoutMs`; request-driven only (no sweeper); `lastActivity.delete` on timeout |
| `services/container-manager/src/sessions/sessions.service.ts` lines 641–659 | `writeFileToContainer` calls `checkAndEnforceIdleTimeout` BEFORE write, then `updateLastActivity` after success |
| `services/container-manager/src/sessions/sessions.service.ts` lines 1007–1009 | `updateLastActivity`: sets `lastActivity.set(sessionId, Date.now())` — in-memory Map only |
| `services/container-manager/src/sessions/sessions.service.ts` line 108–119 | Builder execution (plain path) does NOT update lastActivity |
| `services/api-gateway/src/ai/ai-execution.controller.ts` lines 756–784 | `@Post('executions/:executionId/confirm-build-apply')` — public authenticated; `@UseGuards(SessionOrApiKeyAuthGuard)`; `@HttpCode(200)`; calls `triggerBuildApplyDeduction` |
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` lines 784/950 | Log events: `finalize_accounting.build_awaiting_apply` (line 784) and `confirm_build_apply.deduction_triggered` (line 950). Note: `confirm_build_apply.request_received` is INTERNAL-HANDLER-ONLY — NOT emitted by public 03J route |
| `services/api-gateway/src/credit-ledger/config/credit-rates.config.ts` lines 14–18 | model_tokens rate: unit='1K_tokens', creditsPerUnit=1. Deduction computed as `tokens_used × 1` credits (1 credit per token) |
| `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` lines 78–96 | Formula: `appliedCredits = min(tokens_used, availableBalance)`; `overflowCredits = max(tokens_used - availableBalance, 0)`; `balanceAfter = availableBalance - appliedCredits` |

**PLAIN_PATH_CONFIRMED=YES** — AGENT_HARNESS_ENABLE_TOOL_LOOP default=false; plain path confirmed in prior E2E runs.

---

## 5. 03K Corrected Timing Contract

### 5.1 Root Cause (Locked — Do Not Reinterpret)

PRIVATE-BETA-E2E-04 failed because its fresh workspace session was opened approximately 48 minutes before the qualifying workspace apply operation while Container Manager's implemented idle threshold was 30 minutes (1,800,000 ms). The session's in-memory `lastActivity` was initialized at session open (~11:29:47 UTC) and was not refreshed by Builder execution, streaming, or AI completion. When workspace apply was attempted at ~12:17:58 UTC, `checkAndEnforceIdleTimeout` found `elapsedMs (2,891,367 ms) > idleTimeoutMs (1,800,000 ms)` and terminated the session.

**The fix is procedural only: create the fresh session immediately before Build, not 48 minutes before.**

### 5.2 Idle Timeout Implementation Facts (Locked from 03K)

```
EFFECTIVE_SESSION_IDLE_TIMEOUT_MS=1800000
IDLE_COMPARISON_OPERATOR=> (strict greater-than)
ENFORCEMENT=request-driven via checkAndEnforceIdleTimeout (no sweeper)
FIRST_ACCESS=initializes lastActivity to Date.now()
ACTIVITY_REFRESH=writeFile/readFile/listDir/searchFiles/execInContainer — all refresh on success
BUILDER_EXECUTION=does NOT refresh lastActivity
SESSION_TIMEOUT_MINUTES=120 (leftover CM env key — NOT read by idle enforcement)
CM_RESTART_DURING_E2E04=NO (proven by 03K)
```

### 5.3 Key Procedural Rule

**DO NOT CREATE OR OPEN THE FRESH E2E-05 SESSION UNTIL ALL POSSIBLE NON-SESSION-SPECIFIC PREFLIGHT IS COMPLETE.**

Complete before fresh session creation wherever possible:
- OS v1 admission/resource check
- Staging SSH/connectivity
- Staging HEAD / worktree / stash parity
- Deployment if required
- Service health
- Safety flag baseline
- Effective idle-timeout confirmation
- Authentication verification
- DB/API credit baseline
- Browser billing page baseline (navigate to billing tab, capture balance, KEEP TAB OPEN)
- DevTools preparation instructions
- Exact Builder prompt preparation
- Evidence command preparation

---

## 6. Session Headroom Contract

### 6.1 SESSION_CREATED_AT Source

```
SESSION_CREATED_AT = sessions.created_at  (PostgreSQL, API Gateway database — TypeORM @CreateDateColumn)
```

**Source-proven creation chain (API-Gateway-initiated flow):**

1. Frontend `POST /api/sessions` → API Gateway `sessionRepository.createSession()` → `repository.save(session)`
   → **PostgreSQL `sessions.created_at` = TypeORM `@CreateDateColumn` = `CURRENT_TIMESTAMP` at INSERT** ← **FIRST event**
2. API Gateway calls Container Manager `POST /api/sessions/:id/start`
3. Container Manager `startSessionContainer()` → SQLite `sessions` INSERT `datetime('now')` ← **SECOND event (seconds later, after network round-trip)**
4. Container Manager calls `notifySessionStarted()` → API Gateway updates PostgreSQL status `PENDING → ACTIVE`

**Therefore:** `POSTGRES_SESSION_CREATED_AT < CM_SQLITE_SESSION_CREATED_AT` (source-proven by call chain)

PostgreSQL `created_at` is the EARLIER and therefore MORE CONSERVATIVE anchor. Querying CM SQLite `created_at` is unnecessary — it is always a later timestamp, which would overestimate remaining headroom (less safe).

**CM SQLite query is NOT used.** CM SQLite `database/aisandbox.db` path resolves relative to project root at runtime (source: `sessions.service.ts` line 60: `path.join(__dirname, '../../../..', 'database', 'aisandbox.db')`). Querying it would yield a later timestamp than PostgreSQL and would be less conservative. PostgreSQL `created_at` alone provides the required safety guarantee.

`SESSION_HEADROOM_ANCHOR_AT = SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT`

This is a `CONSERVATIVE_SERVER_SIDE_SAFETY_ANCHOR`, not `AUTHORITATIVE_IDLE_START`. The Container Manager in-memory `lastActivity` Map initializes on first CM request, which occurs after the PostgreSQL INSERT. Starting the safety clock from the PostgreSQL INSERT is intentionally early — it underestimates available headroom, providing a larger safety margin.

**How to capture immediately after session creation:**

```bash
# READ-ONLY — run immediately after Keith opens workspace — queries PostgreSQL API Gateway DB
psql "$DATABASE_URL" -c "SELECT id, created_at FROM sessions WHERE id = '<SESSION_ID>';"
```

Alternatively, capture from the session-list query already used to obtain SESSION_ID:

```bash
# READ-ONLY — queries PostgreSQL API Gateway DB
psql "$DATABASE_URL" -c "SELECT id, project_id, status, created_at FROM sessions ORDER BY created_at DESC LIMIT 3;"
```

`created_at` is populated by TypeORM `@CreateDateColumn` at PostgreSQL `sessions` row INSERT — the first server-side session event.

**Do NOT substitute `last_activity_at`** (PostgreSQL or SQLite) as a Container Manager idle-timer anchor. Under the 03K contract, `last_activity_at` is contextual only. The in-memory `lastActivity` Map initializes on first CM request, which may be seconds after session creation.

### 6.2 Timing Definitions

```
EFFECTIVE_SESSION_IDLE_TIMEOUT_MS             = 1800000   (30 min; governance.config.ts default)

SESSION_CREATED_AT                            = sessions.created_at (PostgreSQL, API Gateway DB; TypeORM @CreateDateColumn at INSERT)
  (= POSTGRES_SESSION_CREATED_AT — FIRST event in creation chain; earlier than CM SQLite created_at — source-proven)
SESSION_OPENED_AT                             = operator/browser timestamp when workspace first becomes visibly ready
SESSION_HEADROOM_ANCHOR_AT                    = SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT
  (CONSERVATIVE_SERVER_SIDE_SAFETY_ANCHOR — NOT AUTHORITATIVE_IDLE_START)
  (PostgreSQL INSERT is earlier than CM SQLite INSERT; source-proven by call chain; intentionally underestimates headroom)
  (do NOT substitute last_activity_at from either store — contextual only under 03K)

PROVIDER_CALL_AT                              = UTC timestamp when Build prompt submitted
SESSION_AGE_AT_PROVIDER_CALL                  = PROVIDER_CALL_AT − SESSION_HEADROOM_ANCHOR_AT  (ms)
REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL      = 1800000 − SESSION_AGE_AT_PROVIDER_CALL  (ms)

EXACT_PROVIDER_COMPLETED_AT                   = UNPROVEN
  (no DB-persisted field; AI Service worker emits execution_completed log but it is not reliably accessible in Step 3)
BUILD_AWAITING_APPLY_EVENT_AT                 = finalize_accounting.build_awaiting_apply PM2 log timestamp
  (occurs AFTER: provider completes → DB status='completed' → notifyExecutionComplete HTTP call
   → API Gateway finalize-accounting → accounting check → build_awaiting_apply emission)
  (conservative: no earlier than actual provider completion)
POST_PROVIDER_SAFETY_CHECK_AT                 = BUILD_AWAITING_APPLY_EVENT_AT
  (conservative proxy; no exact provider completion timestamp is available; used for headroom gate and apply-timing)
SESSION_AGE_AT_POST_PROVIDER_SAFETY_CHECK     = POST_PROVIDER_SAFETY_CHECK_AT − SESSION_HEADROOM_ANCHOR_AT  (ms)
REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK = 1800000 − SESSION_AGE_AT_POST_PROVIDER_SAFETY_CHECK  (ms)

APPLY_ATTEMPT_AT                              = UTC timestamp when Keith clicks Apply
APPLY_SUCCESS_AT                              = UTC timestamp when apply succeeds
POST_BUILD_AWAITING_APPLY_TO_APPLY_MS         = APPLY_ATTEMPT_AT − BUILD_AWAITING_APPLY_EVENT_AT  (ms)
  (operational evidence — NOT literal provider-completion latency; source event is post-accounting finalization)
BUILD_AWAITING_APPLY_VERIFIED_AT              = UTC timestamp when build_awaiting_apply PM2 event confirmed
  (same reading as BUILD_AWAITING_APPLY_EVENT_AT — used as POST_PROVIDER_SAFETY_CHECK_AT)
ZERO_DEDUCTION_VERIFIED_AT                    = UTC timestamp when zero-deduction DB query returns 0
```

### 6.3 Pre-Provider Headroom Hard-Stop Gate

```
SAFE_MINIMUM_HEADROOM_MS = 600000   (10 minutes)
```

**Derivation:**
- E2E-04 provider call duration: ~2934 ms (~3 seconds) — negligible budget consumption
- Post-completion required operations (conservative): ~7.5 minutes
  - build_awaiting_apply PM2 log check: ~30 s
  - Zero pre-apply deduction query: ~30 s
  - Workspace apply UI action: ~30 s
  - Automatic checkpoint verification: ~30 s
  - Public 03J confirm (DevTools network): ~30 s
  - PM2 log deduction_triggered check: ~30 s
  - DB deduction record query: ~30 s
  - Balance DB/API reconciliation: ~30 s
  - 03H browser balance (tab switch): ~30 s
  - Workspace/preview validation: ~60 s
  - Manual checkpoint (marker edit + save point): ~60 s
  Total: ~7.5 minutes
- Safety margin: 2.5 minutes
- **Total: 10 minutes = 600,000 ms**

**Gate — PRE_PROVIDER_HEADROOM_GATE:**
```
IF REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL < 600000 ms:
    PRE_PROVIDER_HEADROOM_GATE = FAIL
    ABORT — DO NOT SUBMIT PROVIDER CALL
    Record SESSION_AGE_AT_PROVIDER_CALL and REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL
    Set PROVIDER_CALLS_USED=0
    Restore GLOBAL_EXECUTION_ENABLED=false
    E2E-05 = FAIL/BLOCKED (session timing failure)
```

Equivalently: **ABORT if SESSION_AGE_AT_PROVIDER_CALL > 1,200,000 ms (20 minutes).**

### 6.4 Preferred Operating Window

**Preferred: session should be < 5 minutes old at provider submission.**

At session age = 5 min: REMAINING_HEADROOM ≈ 25 min — far exceeds the 10-min minimum.

The runbook achieves this by completing all non-session preflight before creating the project/session.

### 6.5 Post-Provider Headroom Hard-Stop Gate

Immediately when provider execution completes, before any pre-apply diagnostics:

```
SAFE_MINIMUM_HEADROOM_AT_PROVIDER_COMPLETION_MS = 300000   (5 minutes)
```

**Rationale:** The two mandatory pre-apply checks (build_awaiting_apply + zero-deduction) should complete in well under 1 minute when commands are pre-prepared. Apply itself is immediate. 5 minutes leaves substantial margin against the idle boundary.

**Gate — POST_PROVIDER_HEADROOM_GATE:**
```
Capture POST_PROVIDER_SAFETY_CHECK_AT (= BUILD_AWAITING_APPLY_EVENT_AT) from PM2 log.
Calculate REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK
  = 1800000 − (POST_PROVIDER_SAFETY_CHECK_AT − SESSION_HEADROOM_ANCHOR_AT)

IF REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK < 300000 ms:
    POST_PROVIDER_HEADROOM_GATE = FAIL
    DO NOT continue normal pre-apply sequence
    PROVIDER_CALLS_USED = 1
    E2E-05 = FAIL/BLOCKED
    Do NOT call provider again
    Do NOT attempt artificial keepalive
    Proceed only with safe cleanup and GLOBAL_EXECUTION_ENABLED=false restoration
```

### 6.6 Post-Completion Apply Timing Rule

```
POST_APPLY_SAFETY_MARGIN_MS = 120000   (2 minutes)

ALLOWED_POST_BUILD_AWAITING_APPLY_TO_APPLY_MS =
  MIN(300000, REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK − 120000)
```

Because the post-provider gate already requires REMAINING_HEADROOM ≥ 300,000 ms, the effective maximum is:
- If headroom ≥ 300,000 ms: `ALLOWED = MIN(300000, headroom − 120000)` → typically 180,000–300,000 ms
- The static 300,000 ms cap applies when headroom is generous

**Preferred: Apply within approximately 1 minute after BUILD_AWAITING_APPLY_EVENT_AT.**

Do NOT deliberately wait to approach the maximum. Do NOT pause for broad diagnostics before apply.

---

## 7. Provider / Model / Budget

```
PROVIDER_CALL_BUDGET = 1
PROVIDER            = xai
MODEL               = grok-4.5
NO_RETRY            = YES
```

**Evidence:** E2E-04 proved PROVIDER=xai/MODEL=grok-4.5 at execution. 03K confirmed xai/grok-4.5 as the E2E-04 provider. AI_PROVIDER=xai in root .env (confirmed in prior E2E runs). XAI_ALLOWED_MODELS=['grok-4.5'] — only selectable xAI model (confirmed E2E-03/04 stage-starts).

**Step 3 must re-verify provider/model before enabling gate.** If changed: STOP.

After one provider call: **do NOT make a second call.** Return to control plane.

---

## 8. Exact Frozen Builder Prompt

**Use this prompt verbatim. Do NOT modify.**

```
Create a single file named `e2e-05.html` in this workspace. Its complete contents must be exactly:

<!doctype html>
<html>
<head><meta charset="utf-8"><title>E2E-05</title></head>
<body><h1>PRIVATE-BETA-E2E-05</h1><p>Post-03J confirm-build-apply validation succeeded.</p></body>
</html>

Do not create or modify any other file.
```

**Properties:**

| Property | Value |
|----------|-------|
| Expected file | `e2e-05.html` |
| Expected fileActions count | Exactly 1 |
| Expected executionIntent | `workspace_mutation` |
| Content lines | 7 HTML lines exactly as specified |
| Preview-compatible | YES — static HTML, heading visible |
| Non-destructive | Adds one file to fresh empty workspace |
| No dependencies | No npm, no build step |
| Risky-batch threshold | NO — 1 action ≤ 3 threshold |
| Confirmation-required | NO — apply proceeds immediately |
| Qualifies for confirm-build-apply | YES — qualifyBuildApplyConfirmation non-null |
| Distinct from E2E-04 | YES — filename e2e-05.html, title/heading E2E-05 |

**Hard-stop if provider returns:**
- Zero fileActions → STOP (no-charge scenario C, per 03D)
- Non-qualifying/malformed actions → STOP
- Execution failure → STOP

Do NOT retry with a second provider call.

---

## 9. Staging Source Parity

### 9.1 Required Source SHA

```
REQUIRED_SOURCE_SHA = c3e39279abe3c0d6c348daa312107c8f6fc592b7
```

Commit message: `fix: add public build apply confirmation route`  
Date: 2026-08-18  
Production files changed: `services/api-gateway/src/ai/ai-execution.controller.ts`

### 9.2 Current Documentary Parity Status

```
STAGING_PARITY_DOCUMENTARY_STATUS = EXPECTED_PASS_REQUIRES_STEP3_VERIFICATION
```

- E2E-04 checkpoint §8 PROVED staging HEAD = c3e39279 on 2026-08-19
- 03K was investigation-only; 03K checkpoint §11 confirms no staging mutation during 03K
- No staging mutations between E2E-04 and E2E-05 registration
- **Expected**: staging still at c3e39279 — but must be VERIFIED in Step 3 before provider call

### 9.3 Acceptable Deployment Rule

Staging HEAD is acceptable if:
```
git merge-base --is-ancestor c3e39279abe3c0d6c348daa312107c8f6fc592b7 <STAGING_HEAD>
```
returns exit 0 (c3e39279 is ancestor of current staging HEAD), AND working tree is CLEAN, AND retained stash is intact.

All commits between c3e39279 and current local HEAD (55be742) contain zero production source changes (verified in Step 2 git log). Deploying to any commit c3e39279..55be742 is acceptable.

### 9.4 Retained Stash — DO NOT TOUCH

```
RETAINED_STASH_SHA         = 0372cc1f47f82e1db060ed2dd756a938fe324803
RETAINED_STASH_DESCRIPTION = pre-03F-deployment-snapshot-2026-08-15
```

This stash has been retained untouched through 03G, 03H, 03I, E2E-03, 03J, GOV-OS-01, E2E-04, 03K, and E2E-05 registration.

Step 3 must verify **both**:

```bash
# READ-ONLY
ssh aisandbox-staging
git -C /opt/aisandbox stash list
# REQUIRED: stash@{0} present, description contains "pre-03F-deployment-snapshot"

git -C /opt/aisandbox rev-parse "stash@{0}"
# REQUIRED EXACT OUTPUT: 0372cc1f47f82e1db060ed2dd756a938fe324803
```

Under no circumstances: pop, apply, drop, create, replace, reorder, or reuse any stash.

### 9.5 Step 3 Parity Decision

```
if staging HEAD contains c3e39279 as ancestor AND worktree CLEAN AND stash intact:
    PARITY_PROVEN → skip deployment → proceed to Phase F
else:
    DEPLOYMENT_REQUIRED → execute Phase E before any provider call
```

**DO NOT CONSUME PROVIDER-CALL BUDGET UNTIL STAGING PARITY IS PROVEN.**

### 9.6 Deterministic Deployment Procedure (Phase E — execute only if DEPLOYMENT_REQUIRED)

Reuse E2E-04 deployment safety rules. Pre-mutation gates (all required):
- Branch = main ✓
- Worktree CLEAN ✓
- Stash@{0} = 0372cc1f47f82e1db060ed2dd756a938fe324803 (both description and exact SHA) ✓

```bash
# All on staging via SSH aisandbox-staging

# E1: Final clean check before mutation
# READ-ONLY
git -C /opt/aisandbox status --short
# REQUIRED: empty. Non-empty → ABORT

# E2a/E2b: Final stash confirmation (both checks)
# READ-ONLY
git -C /opt/aisandbox stash list
git -C /opt/aisandbox rev-parse "stash@{0}"
# REQUIRED: stash@{0} present; exact SHA = 0372cc1f47f82e1db060ed2dd756a938fe324803

# E3: Fetch
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
git -C /opt/aisandbox fetch origin main

# E4: Verify SHA reachable
# READ-ONLY
git -C /opt/aisandbox cat-file -t c3e39279abe3c0d6c348daa312107c8f6fc592b7
# Expected: "commit". "missing" → ABORT

# E5: Hard reset to REQUIRED_SOURCE_SHA
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
git -C /opt/aisandbox reset --hard c3e39279abe3c0d6c348daa312107c8f6fc592b7

# E6-E8: Verify HEAD, clean, stash post-reset
# READ-ONLY
git -C /opt/aisandbox rev-parse HEAD
# REQUIRED: c3e39279abe3c0d6c348daa312107c8f6fc592b7
git -C /opt/aisandbox status --short
# REQUIRED: empty
git -C /opt/aisandbox rev-parse "stash@{0}"
# REQUIRED: 0372cc1f47f82e1db060ed2dd756a938fe324803

# E9: Build API Gateway only
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
cd /opt/aisandbox/services/api-gateway && npm run build
# Expected: TypeScript compile succeeds, dist/ updated

# E10: Restart API Gateway only
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
pm2 restart aisandbox-api-gateway
sleep 10

# E11-E15: Verify gateway health and safety flags
# READ-ONLY
pm2 list | grep aisandbox-api-gateway
# Expected: status=online
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
pm2 env "$GW_ID" | grep 'GLOBAL_EXECUTION_ENABLED'
# REQUIRED: false (or absent → also false)
pm2 env "$GW_ID" | grep 'BILLING_CHARGES_ENABLED'
# REQUIRED: false
```

---

## 10. Test Identity

```
TEST_USER_ID = 7f772841-7844-401b-a3da-e928b0c7b79c
```

Evidence: established across E2E-01 through E2E-04; confirmed in E2E-04 checkpoint.

No secret credentials appear in this document. Credential availability is a Step 3 operator precondition.

---

## 11. Pre-Session Credit Baseline Procedure

The following must be completed **before** creating the fresh E2E-05 project/session:

### 11.1 DB Baseline (SSH — before session creation)

```bash
# READ-ONLY
ssh aisandbox-staging
psql "$DATABASE_URL" -c "SELECT owner_id, owner_type, balance, updated_at FROM credit_balances WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c' AND owner_type = 'user';"
# Expected: balance = ~30577 (unchanged since E2E-04 abort — verify exact value)
```

Record: `BALANCE_DB_BEFORE = <exact value from query>`

### 11.2 API Baseline (authenticated browser)

Keith navigates to: `https://staging.ainow.biz/en/billing`

Open DevTools → Network tab → clear log → hard refresh once to load page.

Capture:
```
GET /api/billing/balance → HTTP 200 → { "balance": <value> }
BALANCE_API_BEFORE = <value from response body>
```

### 11.3 Browser Displayed Baseline + 03H Tab Setup

After capturing API baseline on billing page:

```
BALANCE_BROWSER_BEFORE = <displayed credit balance on billing UI>
```

**Keep the billing tab open.** This is the tab Keith will switch back to later for the 03H post-deduction balance proof.

### 11.4 Three-Way Baseline

```
BALANCE_DB_BEFORE = BALANCE_API_BEFORE = BALANCE_BROWSER_BEFORE
```

**All three must reconcile before proceeding.** Discrepancy = STOP, investigate before creating session.

**Minimum balance gate:** `BALANCE_DB_BEFORE >= 10000`. Below 10,000 → overflow-deduction risk → STOP.

### 11.5 Expected Pre-State

Based on E2E-04 evidence (BALANCE_AFTER=30577, no deduction occurred):
```
Expected BALANCE_DB_BEFORE ≈ 30577
```
Verify against actual DB query. Do not assume.

---

## 12. Authentication Verification (Pre-Session)

Before creating the project/session:

```
Keith must be authenticated to staging.ainow.biz (session cookie valid)
```

Proof: billing page loads with balance data, `GET /api/billing/balance` returns 200.

If auth fails: STOP. Do not create session. Do not proceed.

---

## 13. Exact Project / Session Creation Order

**Critical: do NOT create the project/session early.**

```
Exact order:

A. OS v1 / resource preflight (re-bootstrap)
B. Staging SSH / connectivity
C. Staging HEAD / worktree / stash verification
D. Deploy if required (Phase E)
E. Service health
F. Safety flags baseline
G. Effective idle timeout confirmation
H. Authentication verification
I. DB / API / browser credit baseline (§11 above)
J. DevTools preparation (Network tab open)
K. Exact Builder prompt preparation (copy-paste ready)
L. Evidence commands preparation (pre-populated with expected IDs)
M. Verify all non-session preconditions PASS
--- ONLY AFTER ALL ABOVE PASS ---
N. Keith creates fresh project: E2E-05-Disposable-2026-08-20
O. Keith opens workspace → session + container created automatically
P. IMMEDIATELY capture: PROJECT_ID, SESSION_ID, CONTAINER_ID, SESSION_OPENED_AT
Q. Minimal session-specific readiness check (workspace loads, file tree visible)
R. Calculate current SESSION_AGE and REMAINING_HEADROOM
S. Enable GLOBAL_EXECUTION_ENABLED (bounded window)
T. Verify gate true + BILLING false
U. Recalculate SESSION_AGE and REMAINING_HEADROOM (gate-open adds ~10-15s)
V. Submit exactly one Builder Build prompt
```

---

## 14. Session Timing Fields to Capture

All fields below must appear in Step 3 evidence.

```
SESSION_CREATED_AT                             = <sessions.created_at from PostgreSQL DB query — API Gateway DB; @CreateDateColumn at INSERT>
SESSION_OPENED_AT                              = <operator/browser timestamp when workspace first visibly ready>
SESSION_HEADROOM_ANCHOR_AT                     = SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT   (conservative anchor)
PROVIDER_CALL_AT                               = <UTC timestamp when Build prompt submitted>
SESSION_AGE_AT_PROVIDER_CALL                   = PROVIDER_CALL_AT − SESSION_HEADROOM_ANCHOR_AT  (ms)
REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL       = 1800000 − SESSION_AGE_AT_PROVIDER_CALL  (ms)
EXACT_PROVIDER_COMPLETED_AT                    = UNPROVEN (no DB-persisted field)
BUILD_AWAITING_APPLY_EVENT_AT                  = <PM2 finalize_accounting.build_awaiting_apply log timestamp>
POST_PROVIDER_SAFETY_CHECK_AT                  = BUILD_AWAITING_APPLY_EVENT_AT  (conservative proxy — no earlier than provider completion)
SESSION_AGE_AT_POST_PROVIDER_SAFETY_CHECK      = POST_PROVIDER_SAFETY_CHECK_AT − SESSION_HEADROOM_ANCHOR_AT  (ms)
REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK = 1800000 − SESSION_AGE_AT_POST_PROVIDER_SAFETY_CHECK  (ms)
BUILD_AWAITING_APPLY_VERIFIED_AT               = <UTC timestamp when build_awaiting_apply PM2 event confirmed>
ZERO_DEDUCTION_VERIFIED_AT                     = <UTC timestamp when zero-deduction DB query returns 0>
APPLY_ATTEMPT_AT                               = <UTC timestamp when Keith clicks Apply>
APPLY_SUCCESS_AT                               = <UTC timestamp when apply succeeds>
POST_BUILD_AWAITING_APPLY_TO_APPLY_MS          = APPLY_ATTEMPT_AT − BUILD_AWAITING_APPLY_EVENT_AT  (ms)
  (operational evidence — NOT literal provider-completion latency)
```

Capture `SESSION_CREATED_AT` immediately after session creation using the pre-prepared PostgreSQL query (§32.6). Capture `SESSION_OPENED_AT` when the workspace first loads: `new Date().toISOString()` in browser DevTools console.

Use `SESSION_HEADROOM_ANCHOR_AT = SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT` as the conservative safety anchor for all headroom calculations. Do NOT use `last_activity_at` from either store as the CM idle-timer anchor — contextual only under 03K.

---

## 15. Gate Enable Order

```
Order (preserves minimal gate-open duration and minimal session age):

1. Complete ALL non-session preflight (Steps A-M above) → PASS
2. Create fresh project/session (Steps N-P)
3. Immediately capture SESSION_CREATED_AT from DB + SESSION_OPENED_AT (browser)
4. Set SESSION_HEADROOM_ANCHOR_AT = SESSION_CREATED_AT
5. Minimal session readiness check (Step Q)
6. Calculate session age/headroom using SESSION_HEADROOM_ANCHOR_AT (Step R)
   — verify REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL > SAFE_MINIMUM_HEADROOM_MS
7. Enable GLOBAL_EXECUTION_ENABLED via PM2 only (Step S):
   GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
   sleep 8
8. Verify gate true (Step T)
9. Verify BILLING_CHARGES_ENABLED still false (Step T)
10. Recalculate session age/headroom using SESSION_HEADROOM_ANCHOR_AT (Step U)
    — verify still > SAFE_MINIMUM_HEADROOM_MS
11. Submit exactly one Build prompt (Step V) — immediately
```

**Root .env is NEVER edited.** Gate change is PM2 runtime only.

**BILLING_CHARGES_ENABLED remains false throughout.**

If session age/headroom gate fails at Step R or Step U: **ABORT before enabling gate or before provider call**.

---

## 16. build_awaiting_apply Pre-Apply Proof

After AI completion, **before** workspace apply:

### 16.1 PM2 Log Check

```bash
# READ-ONLY — run on staging
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep 'build_awaiting_apply'
# Expected: one JSON line with event: 'finalize_accounting.build_awaiting_apply'
# and executionId matching EXECUTION_ID
```

### 16.2 Zero Deduction Pre-Confirmation

```bash
# READ-ONLY — run on staging
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS deduction_count FROM credit_deduction_records WHERE source_event_id = '<EXECUTION_ID>';"
# REQUIRED: deduction_count = 0
```

**PASS condition:** `finalize_accounting.build_awaiting_apply` observed AND `deduction_count = 0`.

**FAIL condition:** `finalize_accounting.deduction_triggered` observed OR `deduction_count > 0` before qualifying apply → premature deduction, STOP.

**Timing:** Complete these checks PROMPTLY after AI completion. Do NOT delay workspace apply for extended diagnostics. Commands must be pre-prepared before session creation.

---

## 17. Apply Timing Requirement

After AI completion:

```
1. When finalize_accounting.build_awaiting_apply PM2 log is captured:
   → BUILD_AWAITING_APPLY_EVENT_AT = PM2 log timestamp
   → POST_PROVIDER_SAFETY_CHECK_AT = BUILD_AWAITING_APPLY_EVENT_AT
   (EXACT_PROVIDER_COMPLETED_AT = UNPROVEN — no DB-persisted field;
    build_awaiting_apply event occurs AFTER provider completes → DB update → HTTP round-trip → accounting)
2. Calculate REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK
   = 1800000 − (POST_PROVIDER_SAFETY_CHECK_AT − SESSION_HEADROOM_ANCHOR_AT)

   POST_PROVIDER_HEADROOM_GATE check:
   IF REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK < 300000:
       POST_PROVIDER_HEADROOM_GATE = FAIL
       STOP — do NOT proceed to pre-apply checks or Apply
       Record PROVIDER_CALLS_USED=1, E2E-05=FAIL/BLOCKED
       Execute safe cleanup + gate restore (§27, §28)
       DO NOT retry provider call

3. Run build_awaiting_apply check (§16) — pre-prepared, <30 seconds
   → capture BUILD_AWAITING_APPLY_VERIFIED_AT
4. Run zero-deduction check (§16) — pre-prepared, <30 seconds
   → capture ZERO_DEDUCTION_VERIFIED_AT
5. Click Apply promptly — capture APPLY_ATTEMPT_AT
6. Verify apply success — capture APPLY_SUCCESS_AT
```

**DO NOT pause for broad diagnostics between BUILD_AWAITING_APPLY_EVENT_AT capture and apply.**

`ALLOWED_POST_BUILD_AWAITING_APPLY_TO_APPLY_MS = MIN(300000, REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK − 120000)`

Preferred: Apply within approximately 1 minute after BUILD_AWAITING_APPLY_EVENT_AT.

If session idle timer approaches danger zone before apply: hard-stop immediately. Do not retry provider call.

---

## 18. Automatic Checkpoint Proof

After successful workspace apply, the platform automatically creates a git checkpoint via `runAiActionCoherence()`.

### 18.1 Expected Proof

```
AUTOMATIC_CHECKPOINT_HASH = <non-null commitHash from automatic checkpoint HTTP response>
```

Proof sources:
- HTTP 201 from `POST /api/sessions/:sessionId/checkpoints` (automatic, not manual)
- Non-null `commitHash` in response
- `filesChanged >= 1` (e2e-05.html committed)
- Description: `"AI: applied workspace file actions"`

### 18.2 Evidence Commands

```bash
# Git evidence (inside container)
# READ-ONLY
docker exec <CONTAINER_ID> git -C /workspace log --oneline -n 5
# Expected: most recent commit = "AI: applied workspace file actions"

# PostgreSQL evidence
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at DESC
LIMIT 5;
"
# Expected: 1 row — description = 'AI: applied workspace file actions'

# SQLite evidence (host-level)
# READ-ONLY
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

**PASS:** HTTP 201 + non-null commitHash + Git/PostgreSQL/SQLite agree on same hash + filesChanged >= 1

---

## 19. Public 03J Confirm Route Proof

The central live requirement:

```
POST /api/ai/executions/:executionId/confirm-build-apply
HTTP 200
{ "executionId": "<EXECUTION_ID>", "triggered": true, "reason": "completed" }
```

This is the **PUBLIC authenticated** API Gateway route (03J fix). It is distinct from the INTERNAL `POST /api/internal/executions/:executionId/confirm-build-apply`.

### 19.1 Evidence Sources

1. **Browser DevTools Network tab:** The frontend automatically sends this request after successful workspace apply. Keith must observe it.

2. **Expected network request:**
   - Method: POST
   - URL: `https://staging.ainow.biz/api/ai/executions/<EXECUTION_ID>/confirm-build-apply`
   - Status: 200
   - Response: `{ "executionId": "...", "triggered": true, "reason": "completed" }`

3. **PM2 log — deduction triggered:**
```bash
# READ-ONLY — on staging
pm2 logs aisandbox-api-gateway --nostream --lines 300 | grep 'confirm_build_apply'
# Expected: one line with event: 'confirm_build_apply.deduction_triggered'
# and executionId = EXECUTION_ID
```

### 19.2 Do NOT Expect

- `confirm_build_apply.request_received` — this is logged only by the INTERNAL handler, NOT by the public 03J route. Its absence is expected and correct.

### 19.3 Manual 03J Trigger (if needed)

If the frontend does not automatically send the confirm request after apply, Keith may manually trigger it via DevTools console or curl:

```bash
# Manual trigger — only if frontend automation did not send automatically
# REQUIRES STEP 3 AUTHORIZATION (but is ordinary product usage)
curl -b "<session-cookie>" -X POST \
  "https://staging.ainow.biz/api/ai/executions/<EXECUTION_ID>/confirm-build-apply" \
  -H "Content-Type: application/json" \
  -d '{"successCount":1,"totalActions":1,"applyStatus":"applied"}'
```

---

## 20. Deferred Accounting / Exactly-One Deduction Proof

### 20.1 Deduction Formula

```
EXPECTED_DEDUCTION    = TOKENS_USED   (1 credit per token; model_tokens rate × creditsPerUnit=1)
EXPECTED_BALANCE_AFTER = BALANCE_BEFORE − TOKENS_USED   (assuming overflow=0)
```

Verify `overflow_credits = 0` — if non-zero (balance was insufficient despite 10K gate), classify and report.

### 20.2 Capture After Confirm

```bash
# READ-ONLY — on staging
psql "$DATABASE_URL" -c "
SELECT
  source_event_id,
  requested_credits,
  applied_credits,
  overflow_credits,
  balance_before,
  balance_after,
  status,
  created_at
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"
```

Expected: exactly 1 row.

### 20.3 Arithmetic

```
TOKENS_USED           = <from usage_records.tokens_used>
BALANCE_BEFORE        = <from credit_deduction_records.balance_before>
EXPECTED_DEDUCTION    = TOKENS_USED
EXPECTED_BALANCE_AFTER = BALANCE_BEFORE − EXPECTED_DEDUCTION
ACTUAL_BALANCE_AFTER  = <from credit_balances.balance after deduction>
```

Record `BALANCE_DB_AFTER`, `BALANCE_API_AFTER` from fresh query after confirm.

### 20.4 Duplicate Absence Proof

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS deduction_count FROM credit_deduction_records WHERE source_event_id = '<EXECUTION_ID>';"
# REQUIRED: 1
```

Count != 1 → FAIL.

### 20.5 Usage Records Proof

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
  metadata->'aiExecutionResult'->'fileActions'->0->>'path' AS first_file_action_path
FROM usage_records
WHERE execution_id = '<EXECUTION_ID>';
"
# Expected: execution_status=completed, intent=workspace_mutation, file_action_count=1,
#           first_file_action_path=e2e-05.html, model=grok-4.5
```

---

## 21. 03H Frontend Balance Proof

After the deduction is confirmed, Keith must prove the 03H focus-refetch mechanism.

### 21.1 Correct Interaction

**Use Chrome same-window tab switch.** (NOT Alt+Tab — E2E-04 execution §O proved Alt+Tab unreliable; same-window tab switch confirmed PASS.)

Procedure:
1. Keith is on the Builder workspace tab (confirm-build-apply just completed)
2. Keith opens DevTools Network tab on the **billing tab** (already open from pre-session baseline)
3. Keith switches to the billing tab
4. The `window.focus` event fires → `useBillingData` sends `GET /api/billing/balance`
5. Keith observes: HTTP 200, `balance: <EXPECTED_BALANCE_AFTER>`
6. Displayed balance on billing page updates to EXPECTED_BALANCE_AFTER

```
BALANCE_BROWSER_AFTER = <displayed balance after focus-triggered refetch>
BALANCE_API_AFTER     = <response body .balance from the refetch request>
```

### 21.2 Three-Way Post-Deduction Reconciliation

```
BALANCE_DB_AFTER = BALANCE_API_AFTER = BALANCE_BROWSER_AFTER = EXPECTED_BALANCE_AFTER
```

All three must agree. Discrepancy = FAIL.

**Do NOT use F5/Ctrl+R** — the focus mechanism is what 03H fixed; hard refresh would not prove the fix.

---

## 22. Workspace / File / Preview Validation

After apply success:

1. `e2e-05.html` appears in the file tree — YES/NO
2. Editor shows content matching exactly the frozen prompt HTML — YES/NO
3. Preview renders heading `PRIVATE-BETA-E2E-05` — YES/NO
4. Preview renders paragraph `Post-03J confirm-build-apply validation succeeded.` — YES/NO

```bash
# READ-ONLY — verify file existence in workspace (host-level path)
ls /opt/aisandbox/workspaces/<SESSION_ID>/e2e-05.html
# Expected: file exists

# READ-ONLY — verify content
cat /opt/aisandbox/workspaces/<SESSION_ID>/e2e-05.html
# Expected: exact 7-line HTML from frozen prompt
```

---

## 23. Manual Checkpoint Decision

```
MANUAL_CHECKPOINT_REQUIRED = YES
```

**Rationale:**
- E2E-03 hard-stopped before executing manual checkpoint — not proven in any Builder E2E context.
- 03I proved checkpoint fix in isolated provider-free validation but not within a complete Builder E2E flow.
- E2E-04 never reached manual checkpoint (stopped at apply due to idle_timeout).
- E2E-05 is the first opportunity to prove the complete Builder journey including manual checkpoint.
- Required for a complete evidence package supporting the private-beta GO/NO-GO decision.

### 23.1 Operator Sequence (Step 3, after confirm-build-apply proven)

1. **Marker edit** (Keith opens `e2e-05.html` in editor, appends one HTML comment line):
   ```
   <!-- E2E-05 manual checkpoint marker -->
   ```
   Save through normal editor save flow.

2. **Manual checkpoint** (Keith clicks the Save Point / checkpoint button):
   ```
   POST /api/sessions/:sessionId/checkpoints
   ```

3. **Expected response:**
   ```json
   HTTP 201
   {
     "message": "Changes committed successfully",
     "commitHash": "<non-null-hash>",
     "filesChanged": 1
   }
   ```

4. Capture: `MANUAL_CHECKPOINT_HASH = <commitHash>`

**Why marker edit is required:** After automatic checkpoint commits `e2e-05.html`, workspace is CLEAN. Without a change, manual checkpoint returns `{ commitHash: null }` (null-hash = FAIL evidence). Marker edit makes workspace dirty so manual checkpoint produces a real commit hash.

### 23.2 Evidence Commands

```bash
# Git evidence (both checkpoints visible)
# READ-ONLY
docker exec <CONTAINER_ID> git -C /workspace log --oneline -n 5
# Expected: 2 commits — manual checkpoint (newest) + automatic

# PostgreSQL (2 rows expected)
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at DESC
LIMIT 5;
"
# Expected: 2 rows

# SQLite (2 rows)
# READ-ONLY
python3 -c "
import sqlite3, json
conn = sqlite3.connect('file:/opt/aisandbox/database/aisandbox.db?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT git_commit_hash, description, files_changed, created_at FROM checkpoints WHERE session_id = ? ORDER BY created_at DESC LIMIT 5', ('<SESSION_ID>',)).fetchall()
for r in rows:
    print(json.dumps(dict(r)))
conn.close()
"
# Expected: 2 rows
```

**PASS:** HTTP 201 + non-null commitHash + filesChanged=1 + Git/PostgreSQL/SQLite all agree

---

## 24. Safety Flags Verification

| Flag | Before provider call | During provider window | After restore |
|------|---------------------|----------------------|---------------|
| `GLOBAL_EXECUTION_ENABLED` (PM2) | `false` | `true` | `false` |
| `GLOBAL_EXECUTION_ENABLED` (root .env) | `false` | `false` (NOT edited) | `false` |
| `BILLING_CHARGES_ENABLED` | `false` | `false` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | `false` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | `false` | `false` |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` (default if absent) | `false` | `false` |

**Root `.env` is never edited.** Gate changes are PM2 runtime only.

```bash
# Safety flag check — READ-ONLY
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
pm2 env "$GW_ID" | grep 'GLOBAL_EXECUTION_ENABLED'
pm2 env "$GW_ID" | grep 'BILLING_CHARGES_ENABLED'
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# REQUIRED: GLOBAL_EXECUTION_ENABLED=false (root .env — must remain unchanged)
```

---

## 25. Hard Stops Before Provider Call

ABORT (PROVIDER_CALLS_USED=0) if any of the following:

1. E2E-05 no longer admitted in Lane 1 (re-bootstrap fails)
2. Lane 2 is not EMPTY
3. Required resources (STAGING, PROVIDER-LIVE, CREDIT, ENV) not owned by Lane 1/E2E-05
4. Concurrent work could contaminate evidence
5. Staging HEAD does not contain REQUIRED_SOURCE_SHA as ancestor — AND deployment failed or unauthorized
6. Staging branch ≠ main at preflight
7. Staging worktree unexpectedly dirty before deployment mutation
8. Retained stash not at stash@{0} or SHA ≠ 0372cc1f47f82e1db060ed2dd756a938fe324803
9. Required services unhealthy (any of: API Gateway, AI Service, Container Manager, Frontend)
10. SSH/connectivity to staging cannot be established
11. Authentication fails (user cannot authenticate to staging)
12. BALANCE_DB_BEFORE cannot be captured or DB query fails
13. Three-way balance baseline does not reconcile (DB ≠ API ≠ Browser)
14. BALANCE_DB_BEFORE < 10,000 credits (overflow-deduction risk)
15. Starting safety flags incorrect (GLOBAL_EXECUTION_ENABLED not false, BILLING_CHARGES_ENABLED not false)
16. AGENT_HARNESS_ENABLE_TOOL_LOOP or AGENT_HARNESS_ENABLE_WRITE_TOOLS is true
17. AGENT_HARNESS_ENABLE_VALIDATION_TOOLS is true
18. Provider/model cannot be verified as xai / grok-4.5
19. GLOBAL_EXECUTION_ENABLED enable fails or PM2 shows true→false after enable
20. Fresh E2E-05 project/session could not be created
21. REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL < 600,000 ms (10 minutes) — calculated using SESSION_HEADROOM_ANCHOR_AT = SESSION_CREATED_AT
22. Effective idle timeout cannot be confirmed (PM2 env or governance.config.ts default)
23. Provider-call budget cannot be enforced
24. Any unexpected environment/runtime discrepancy

---

## 26. Hard Stops After Provider Call

STOP WITHOUT RETRY if any of the following after the one provider call:

1. Execution status ≠ 'completed'
2. Zero fileActions returned
3. Malformed or non-qualifying fileActions
4. `build_awaiting_apply` not observed in PM2 logs
5. Premature deduction before qualifying apply (deduction_count > 0 before apply)
6. Workspace apply fails (`applyStatus ≠ 'applied'` or session idle_timeout recurs)
7. Automatic checkpoint fails (HTTP 500 or commitHash null)
8. Public 03J confirm response not HTTP 200 or `triggered: false`
9. `credit_deduction_records` count ≠ 1 for EXECUTION_ID after confirm
10. Duplicate deduction (count > 1)
11. `overflow_credits > 0` (clamped deduction)
12. ACTUAL_BALANCE_AFTER ≠ EXPECTED_BALANCE_AFTER
13. Frontend balance does not reconcile under 03H contract
14. `e2e-05.html` content or preview is incorrect
15. Manual checkpoint commitHash null (null = ambiguous evidence = FAIL)
16. Git/PostgreSQL/SQLite disagreement on checkpoint hash
17. Unexpected Stripe/payment activity
18. Any safety invariant violated
19. REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK < 300,000 ms (5 minutes) at POST_PROVIDER_SAFETY_CHECK_AT (= BUILD_AWAITING_APPLY_EVENT_AT) — POST_PROVIDER_HEADROOM_GATE=FAIL; do NOT attempt apply; E2E-05=FAIL/BLOCKED; no retry
20. POST_BUILD_AWAITING_APPLY_TO_APPLY_MS > ALLOWED_POST_BUILD_AWAITING_APPLY_TO_APPLY_MS — session approaching timeout; apply not attempted

**After any hard-stop:** perform safe cleanup (§27) and gate restoration (§28) before recording terminal evidence.

---

## 27. Session Cleanup

After all evidence captured:

### 27.1 Session Cleanup (Keith — browser)

```
DELETE /api/sessions/<SESSION_ID>
Expected: HTTP 200 { "message": "Session terminated successfully" }
```

### 27.2 Verify Session Stopped

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "SELECT id, status, terminated_at FROM sessions WHERE id = '<SESSION_ID>';"
# Expected: status = 'stopped', terminated_at set
```

### 27.3 Container Removal Verification

```bash
# READ-ONLY
docker inspect <CONTAINER_ID> 2>&1 | grep -c 'No such object'
# Expected: 1 (container removed)
```

### 27.4 Project Disposition

```
PROJECT_DISPOSITION = RETAIN
```

No supported safe project delete endpoint exists. Retain project as in prior E2E runs.

---

## 28. Gate Restoration (MANDATORY — Regardless of PASS/FAIL/ABORT)

```bash
# On staging via SSH aisandbox-staging

# R1: Confirm root .env unchanged
# READ-ONLY
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# REQUIRED: GLOBAL_EXECUTION_ENABLED=false

# R2: Restore via PM2
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 8

# R3: Verify PM2 runtime restored
# READ-ONLY
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
pm2 env "$GW_ID" | grep 'GLOBAL_EXECUTION_ENABLED'
# REQUIRED: false

# R4: Verify readiness
# READ-ONLY
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
# REQUIRED: 200

# R5: Verify BILLING_CHARGES_ENABLED
# READ-ONLY
pm2 env "$GW_ID" | grep 'BILLING_CHARGES_ENABLED'
# REQUIRED: false
```

---

## 29. Evidence Table

| Criterion | Pre-State | Action | Expected Evidence | Authoritative Source | PASS Condition | FAIL/Hard-Stop | Cleanup |
|-----------|-----------|--------|-------------------|----------------------|----------------|----------------|---------|
| Board/resource isolation | Lane 1=ACTIVE, Lane 2=EMPTY | Re-bootstrap | E2E-05 admitted; correct resources | TASKS.md board | All admission checks pass | Any check fails → ABORT | None |
| Source parity | Expected c3e39279 (E2E-04 proven) | SSH: verify HEAD, ancestry, stash | STAGING_HEAD ⊇ c3e39279 | git rev-parse HEAD; merge-base | Ancestry confirmed | SHA fails → ABORT or DEPLOYMENT_REQUIRED | None |
| Retained stash | stash@{0}=0372cc1f (E2E-04 proven) | git stash list + rev-parse | stash@{0}=0372cc1f (both checks) | git rev-parse "stash@{0}" | Exact SHA match | SHA mismatch → ABORT | None |
| Service health | Expected healthy (no mutations since E2E-04) | curl health endpoints | HTTP 200 from all services | PM2 list + health routes | All online, health 200 | Any service unhealthy → ABORT | None |
| Safety flags | Expected all false | PM2 env + .env grep | All flags false | PM2 env; .env | All false | Any true → ABORT | None |
| Authentication | Expected valid session | Navigate to staging.ainow.biz | Billing page loads, API 200 | Browser + DevTools | Authenticated 200 | Auth fails → ABORT | None |
| Pre-session DB credit | Expected ~30577 | psql credit_balances | BALANCE_DB_BEFORE | PostgreSQL | Exact value captured | Cannot query → ABORT | None |
| Pre-session API credit | Expected ~30577 | GET /api/billing/balance | BALANCE_API_BEFORE | Network tab HTTP 200 | Value matches DB | Discrepancy → STOP | None |
| Pre-session browser credit | Expected ~30577 | Navigate billing page | BALANCE_BROWSER_BEFORE | Billing UI display | Value matches DB/API | Discrepancy → STOP | None |
| Three-way baseline | All ~30577 | Compare all three | DB = API = Browser | All three sources | All equal | Any mismatch → STOP | None |
| Fresh project/session | None | Keith: New Project → E2E-05-Disposable-2026-08-20 | PROJECT_ID, SESSION_ID, CONTAINER_ID | Browser URL, DB query | IDs captured | Cannot create → ABORT | Project RETAIN |
| SESSION_CREATED_AT | — | PostgreSQL DB query (sessions.created_at) immediately after creation | SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT captured | PostgreSQL sessions table (@CreateDateColumn at INSERT) | Non-null server timestamp; earlier than CM SQLite created_at (source-proven) | Cannot capture → ABORT | None |
| SESSION_OPENED_AT | — | Browser DevTools (Date.now() in console) | SESSION_OPENED_AT captured | Browser timestamp | Non-null timestamp | Cannot capture → record best-estimate | None |
| SESSION_HEADROOM_ANCHOR_AT | — | Set = SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT | CONSERVATIVE_SERVER_SIDE_SAFETY_ANCHOR set | Arithmetic | = POSTGRES_SESSION_CREATED_AT | Cannot determine SESSION_CREATED_AT → ABORT | None |
| Effective idle timeout | 1800000 ms default | PM2 env check | SESSION_IDLE_TIMEOUT_MS absent or =1800000 | PM2 env | Confirmed 1800000 | Different value → recalculate headroom | None |
| Session age/headroom (pre-provider) | Expected <5 min | Calculate using SESSION_HEADROOM_ANCHOR_AT | REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL > 600000 ms | Arithmetic | Headroom ≥ 600000 ms | PRE_PROVIDER_HEADROOM_GATE=FAIL → ABORT before provider | None |
| Gate enable | GLOBAL_EXECUTION_ENABLED=false | PM2 runtime env update | GLOBAL_EXECUTION_ENABLED=true | pm2 env | true in PM2 | Enable fails → ABORT | Restore false |
| Provider call | PROVIDER_CALLS_USED=0 | Keith: Build prompt (§8) | execution_status=completed, fileActions=1 | PM2 logs; DB usage_records | execution completed, 1 fileAction | Fail/0 actions → STOP, no retry | Restore gate |
| BUILD_AWAITING_APPLY_EVENT_AT | — | PM2 log timestamp from finalize_accounting.build_awaiting_apply event | BUILD_AWAITING_APPLY_EVENT_AT captured | PM2 logs | Non-null timestamp; no earlier than provider completion | Cannot determine → note approximate | None |
| POST_PROVIDER_SAFETY_CHECK_AT | — | = BUILD_AWAITING_APPLY_EVENT_AT (conservative proxy) | POST_PROVIDER_SAFETY_CHECK_AT set | Arithmetic | Non-null | N/A | None |
| Post-provider headroom gate | — | Calculate REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK | ≥ 300000 ms | Arithmetic | POST_PROVIDER_HEADROOM_GATE=PASS | < 300000 ms → FAIL/BLOCKED; cleanup; no retry | Restore gate |
| fileActions | — | From execution result | workspace_mutation, count=1, path=e2e-05.html | usage_records.metadata | intent=workspace_mutation, count=1 | Zero/wrong → STOP | Restore gate |
| build_awaiting_apply | — | PM2 log grep | finalize_accounting.build_awaiting_apply observed | PM2 logs | Event present | Absent → STOP | Restore gate |
| Pre-confirm zero deduction | 0 records expected | DB count query | COUNT=0 for EXECUTION_ID | credit_deduction_records | Count=0 | Count>0 → premature deduction FAIL | Restore gate |
| Apply attempt | — | Keith: click Apply | APPLY_ATTEMPT_AT captured | Timestamp | Non-null | Session timeout at apply → STOP | Restore gate |
| Apply success | — | UI apply response | applyStatus=applied, successCount=1 | UI response | applied, successCount=totalActions | Apply fails → STOP | Restore gate |
| POST_BUILD_AWAITING_APPLY_TO_APPLY_MS | — | Calculate APPLY_ATTEMPT_AT − BUILD_AWAITING_APPLY_EVENT_AT | < ALLOWED_POST_BUILD_AWAITING_APPLY_TO_APPLY_MS (not literal provider-completion latency) | Arithmetic | Under allowed max | Over allowed max → note; session timeout risk | None |
| Automatic checkpoint | — | runAiActionCoherence auto | HTTP 201, non-null commitHash, description="AI: applied workspace file actions" | Checkpoint HTTP response + git log + DB | All agree on hash | commitHash null or hash mismatch → FAIL | None |
| Public 03J confirm route | UNPROVEN | Browser DevTools network | POST confirm-build-apply HTTP 200, triggered=true | DevTools Network tab | 200 + triggered=true | Non-200 or triggered=false → FAIL | Restore gate |
| Deferred accounting | — | PM2 log grep | confirm_build_apply.deduction_triggered observed | PM2 logs | Event present | Absent → FAIL | None |
| Exactly-one deduction | 0→1 | DB count after confirm | COUNT=1 for EXECUTION_ID | credit_deduction_records | Count=1 | Count≠1 → FAIL | None |
| Duplicate absence | — | Same count query | COUNT=1 | credit_deduction_records | Count=1 | Count>1 → duplicate FAIL | None |
| Authoritative balance | — | DB + API balance queries | ACTUAL_BALANCE_AFTER = EXPECTED_BALANCE_AFTER | PostgreSQL; GET /api/billing/balance | Match | Mismatch → FAIL | None |
| 03H frontend balance | — | Chrome tab switch | useBillingData refetch observed, balance updates | DevTools Network + UI | HTTP 200, correct balance | No refetch or wrong balance → FAIL | None |
| Workspace file e2e-05.html | — | File tree + editor | File exists, content matches prompt exactly | UI + host ls/cat | File present, content exact | Missing or wrong → FAIL | None |
| Preview rendering | — | Preview pane | Heading "PRIVATE-BETA-E2E-05" + paragraph visible | Browser preview | Both elements visible | Either missing → FAIL | None |
| Manual checkpoint | — | Keith: marker edit + Save Point | HTTP 201, non-null commitHash, filesChanged=1 | Checkpoint HTTP response | Non-null hash + DB/SQLite agree | commitHash null → FAIL | None |
| Session cleanup | — | DELETE /api/sessions/:id | HTTP 200, session stopped, container removed | DB + docker inspect | Session stopped, container absent | Cleanup fails → note, continue gate restore | None |
| Final gate state | GLOBAL_EXECUTION_ENABLED=true | PM2 restore | GLOBAL_EXECUTION_ENABLED=false | pm2 env + root .env | Both false | Either true → IMMEDIATE RESTORE | Restore |
| Provider-call count | 0 | Count provider calls | ≤ 1 | usage_records | ≤ 1 | > 1 → CRITICAL FAIL | Restore gate |
| Stripe/payment safety | None triggered | Verify BILLING false throughout | BILLING_CHARGES_ENABLED=false; no Stripe events | PM2 env | False throughout; no Stripe | Any Stripe activity → CRITICAL FAIL | None |

---

## 30. Exact Step 3 Sequence

```
A. Re-bootstrap OS v1 admission (re-read TASKS.md board top only)
   → Confirm: E2E-05 Lane 1 ACTIVE, Lane 2 EMPTY, resources owned
   → ABORT if board state materially different

B. Staging SSH connectivity
   → ssh aisandbox-staging — confirm connect
   → ABORT if cannot connect

C. Staging HEAD / worktree / stash parity
   → C1: git -C /opt/aisandbox rev-parse HEAD
   → C2: git -C /opt/aisandbox status --short (must be empty)
   → C3: git -C /opt/aisandbox branch --show-current (must be main)
   → C4a: git -C /opt/aisandbox stash list (stash@{0} with pre-03F-deployment-snapshot)
   → C4b: git -C /opt/aisandbox rev-parse "stash@{0}" (must = 0372cc1f...)
   → C5: git -C /opt/aisandbox merge-base --is-ancestor c3e39279... HEAD (exit 0 = PARITY_PROVEN)
   → PARITY_PROVEN: skip D / proceed to E (service health)
   → DEPLOYMENT_REQUIRED: proceed to D

D. Deploy REQUIRED_SOURCE_SHA (if DEPLOYMENT_REQUIRED)
   → Execute Phase E deployment procedure (§9.6)
   → All abort conditions apply
   → Confirm staging at c3e39279 after deploy

E. Service health
   → curl http://127.0.0.1:4000/api/health/ready (Gateway — 200)
   → curl http://127.0.0.1:4001/api/health/ready (AI Service — 200, verify port)
   → pm2 list (all aisandbox-* processes online)
   → ABORT if any service unhealthy

F. Safety flags baseline
   → GW_ID from pm2 jlist
   → pm2 env $GW_ID | grep GLOBAL_EXECUTION_ENABLED (must be false)
   → pm2 env $GW_ID | grep BILLING_CHARGES_ENABLED (must be false)
   → pm2 env $GW_ID | grep AGENT_HARNESS (all must be false or absent)
   → grep GLOBAL_EXECUTION_ENABLED /opt/aisandbox/.env (must be false)
   → Verify provider/model: grep AI_PROVIDER /opt/aisandbox/.env (must = xai)
   → ABORT if any flag incorrect

G. Effective idle timeout confirmation
   → pm2 env $GW_ID | grep SESSION_IDLE_TIMEOUT_MS
   → Expected: absent (default 1800000 applies) or explicitly 1800000
   → If different value found: recalculate SAFE_MINIMUM_HEADROOM_MS — STOP if inadequate
   → Record CONFIRMED_SESSION_IDLE_TIMEOUT_MS

H. Authentication verification
   → Keith navigates to staging.ainow.biz/en/billing
   → Billing page loads successfully (authenticated)
   → GET /api/billing/balance HTTP 200 visible in DevTools
   → ABORT if auth fails

I. Credit baseline (DB + API + Browser — §11)
   → SSH: psql query credit_balances → BALANCE_DB_BEFORE
   → Browser billing page: DevTools network capture → BALANCE_API_BEFORE
   → Browser display → BALANCE_BROWSER_BEFORE
   → Three-way reconciliation: all must equal
   → BALANCE_DB_BEFORE >= 10000
   → Keep billing tab OPEN
   → ABORT if reconciliation fails or balance < 10000

J. DevTools preparation
   → Chrome DevTools Network tab open on Builder workspace tab (new tab, not billing tab)
   → Network recording active
   → Prepare to observe: POST confirm-build-apply, workspace apply requests

K. Exact Builder prompt copy-paste ready
   → Copy exact prompt from §8 to clipboard
   → Verify no modification

L. Evidence commands preparation
   → Pre-populate all SSH commands with expected values
   → Have psql commands ready (will fill EXECUTION_ID after provider call)
   → Have PM2 log grep commands ready
   → Have docker exec git log command ready

M. Verify all non-session preconditions PASS
   → All of A-L must have passed
   → If any failed: ABORT before proceeding to N
   → ABORT_IF_NOT_ALL_PASS

--- CREATE SESSION EDGE ---

N. Keith creates fresh project: E2E-05-Disposable-2026-08-20
   → Standard Builder UI: "New Project" → type name → "Create Project"

O. Keith opens workspace → session + container created automatically
   → Navigate to project / click Open Workspace
   → Wait for workspace UI to fully load

P. IMMEDIATELY capture all IDs and timing anchors
   → PROJECT_ID: from URL or DB query
   → SESSION_ID: from URL or DB query
   → CONTAINER_ID: from DB query
   → SESSION_CREATED_AT: from DB query (pre-prepared §32.6 — sessions.created_at)
   → SESSION_HEADROOM_ANCHOR_AT = SESSION_CREATED_AT
   → SESSION_OPENED_AT: browser timestamp (Date.now() in DevTools console)

Q. Minimal session-specific readiness
   → File tree visible (empty workspace)
   → No error states
   → Workspace is fresh

R. Calculate session age and headroom (using SESSION_HEADROOM_ANCHOR_AT = SESSION_CREATED_AT)
   → SESSION_AGE_AT_PROVIDER_CALL estimate = NOW − SESSION_HEADROOM_ANCHOR_AT
   → REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL estimate = 1800000 − SESSION_AGE_AT_PROVIDER_CALL
   → IF REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL < 600000: PRE_PROVIDER_HEADROOM_GATE=FAIL → ABORT

S. Enable GLOBAL_EXECUTION_ENABLED (SSH — bounded window)
   → MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
   → GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
   → sleep 8

T. Verify gate true + BILLING false
   → pm2 env $GW_ID | grep GLOBAL_EXECUTION_ENABLED (must be true)
   → pm2 env $GW_ID | grep BILLING_CHARGES_ENABLED (must be false)
   → curl health/ready → 200
   → ABORT if gate enable failed or BILLING changed

U. Recalculate session age/headroom (gate enable added ~10-15s; use SESSION_HEADROOM_ANCHOR_AT)
   → SESSION_AGE = NOW − SESSION_HEADROOM_ANCHOR_AT (updated)
   → REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL = 1800000 − SESSION_AGE
   → IF REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL < 600000: PRE_PROVIDER_HEADROOM_GATE=FAIL → ABORT before provider call (restore gate first)

V. Submit exactly one Builder Build prompt
   → Keith pastes exact prompt (§8) into Builder interface
   → Keith clicks Build / Send
   → PROVIDER_CALL_AT = NOW
   → PROVIDER_CALLS_USED = 1

W. Provider execution / evidence capture
W. Provider execution / evidence capture
   → Wait for execution to complete (expected: ~3-5 seconds based on E2E-04 evidence)
   → When finalize_accounting.build_awaiting_apply PM2 log appears:
       BUILD_AWAITING_APPLY_EVENT_AT = PM2 log timestamp
       POST_PROVIDER_SAFETY_CHECK_AT = BUILD_AWAITING_APPLY_EVENT_AT
       (EXACT_PROVIDER_COMPLETED_AT = UNPROVEN — no DB-persisted field)
   → Calculate REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK
       = 1800000 − (POST_PROVIDER_SAFETY_CHECK_AT − SESSION_HEADROOM_ANCHOR_AT)
   → IF REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK < 300000: POST_PROVIDER_HEADROOM_GATE=FAIL → STOP, cleanup, no retry
   → Capture: execution_status, tokens_used, intent, fileActions from UI or PM2 logs
   → Capture EXECUTION_ID from UI or DB

X. Prove build_awaiting_apply (§16)
   → IMMEDIATELY after POST_PROVIDER_SAFETY_CHECK_AT confirmed (post-provider headroom gate must have passed)

Y. Workspace apply (Keith — promptly)
   → APPLY_ATTEMPT_AT = NOW
   → Keith clicks Apply on the proposed file action
   → Wait for success response
   → APPLY_SUCCESS_AT = NOW (on success)
   → IF session idle_timeout: STOP — no retry

Z. Verify apply success and timing
   → applyStatus = applied
   → successCount = totalActions = 1
   → POST_BUILD_AWAITING_APPLY_TO_APPLY_MS = APPLY_ATTEMPT_AT − BUILD_AWAITING_APPLY_EVENT_AT
   → (not literal provider-completion latency; operational evidence only)
   → Verify < ALLOWED_POST_BUILD_AWAITING_APPLY_TO_APPLY_MS
       = MIN(300000, REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK − 120000)
AA. Automatic checkpoint (§18)
    → Verify HTTP 201 from automatic checkpoint
    → Non-null commitHash
    → Git / PostgreSQL / SQLite reconciliation
    → AUTOMATIC_CHECKPOINT_HASH = <commitHash>

AB. Public 03J confirmation (§19)
    → Observe POST confirm-build-apply in DevTools Network tab
    → HTTP 200, triggered=true
    → Confirm URL = /api/ai/executions/<EXECUTION_ID>/confirm-build-apply

AC. Prove deferred accounting via PM2 log
    → pm2 logs grep 'confirm_build_apply' (pre-prepared)
    → confirm_build_apply.deduction_triggered observed

AD. Exactly-one deduction + duplicate absence (§20)
    → psql credit_deduction_records COUNT query
    → REQUIRED: COUNT = 1
    → Capture: requested_credits, applied_credits, overflow_credits, balance_before, balance_after

AE. Authoritative balance reconciliation
    → TOKENS_USED from usage_records
    → EXPECTED_BALANCE_AFTER = BALANCE_BEFORE − TOKENS_USED
    → ACTUAL_BALANCE_AFTER from credit_balances
    → GET /api/billing/balance → BALANCE_API_AFTER
    → DB = API = EXPECTED_BALANCE_AFTER

AF. 03H frontend balance (§21)
    → Keith switches to billing tab (Chrome same-window tab switch)
    → Observe GET /api/billing/balance in DevTools Network
    → BALANCE_BROWSER_AFTER = displayed balance
    → Three-way: DB = API = Browser = EXPECTED_BALANCE_AFTER

AG. Workspace / file validation (§22)
    → File tree shows e2e-05.html
    → Editor content matches prompt
    → Preview: heading + paragraph correct

AH. Manual checkpoint (§23)
    → Keith opens e2e-05.html, appends marker comment, saves
    → Keith clicks Save Point
    → HTTP 201, non-null MANUAL_CHECKPOINT_HASH
    → Git / PostgreSQL / SQLite reconciliation (2 rows now)

AI. Capture final evidence bundle
    → All timing fields recorded
    → All IDs recorded
    → All balance values recorded
    → All checkpoint hashes recorded
    → Provider call count confirmed = 1

AJ. Session cleanup (§27)
    → Keith: DELETE /api/sessions/<SESSION_ID>
    → Verify session stopped, container removed

AK. Project retention
    → PROJECT_DISPOSITION = RETAIN
    → No delete action

AL. Restore GLOBAL_EXECUTION_ENABLED=false (§28 — MANDATORY)
    → GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
    → sleep 8
    → Verify false in PM2 env
    → Verify health 200

AM. Prove gates safe
    → GLOBAL_EXECUTION_ENABLED = false (PM2 + root .env)
    → BILLING_CHARGES_ENABLED = false
    → Verify root .env unchanged throughout

AN. Provider count verification
    → PROVIDER_CALLS_USED = 0 (if aborted before provider) or 1 (if provider was called)
    → NEVER > 1

AO. Duplicate deduction final check
    → COUNT credit_deduction_records for EXECUTION_ID = 1

AP. Stripe/payment safety verification
    → BILLING_CHARGES_ENABLED = false throughout
    → No Stripe/webhook/invoice activity

AQ. Final verdict
    → All criteria PASS → PASS
    → Any criterion FAIL → FAIL/BLOCKED with exact blocking criterion

AR. Prepare Step 4 evidence
    → Compile all evidence for Step 4 consolidation/checkpoint
    → Note any deviations from runbook
```

---

## 31. Keith Browser Interaction Sequence

All browser steps requiring Keith. Listed in order after session creation.

**Before session creation (browser — non-blocking, can do from any tab):**

1. Navigate to `https://staging.ainow.biz/en/billing` — billing page
2. Open DevTools → Network tab → clear log
3. Observe `GET /api/billing/balance` HTTP 200 → record `BALANCE_API_BEFORE` and `BALANCE_BROWSER_BEFORE`
4. **Keep billing tab OPEN** for later 03H proof

**After all non-session preflight passes — session creation:**

5. Navigate to `https://staging.ainow.biz/en/app` (or equivalent Builder project list)
6. Click "New Project" → name: `E2E-05-Disposable-2026-08-20` → Create
7. Open workspace → wait for workspace UI to fully load
8. **IMMEDIATELY** (in this order):
   - Open DevTools Console → `new Date().toISOString()` → record as `SESSION_OPENED_AT`
   - Note URL for PROJECT_ID and SESSION_ID
   - (Operator runs pre-prepared PostgreSQL query §32.6 to capture SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT and CONTAINER_ID)
9. Set SESSION_HEADROOM_ANCHOR_AT = SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT (CONSERVATIVE_SERVER_SIDE_SAFETY_ANCHOR)

**Immediately before Build prompt (gate already enabled by SSH):**

10. DevTools → Network tab → clear (or note current position to identify new requests)
11. Paste exact Builder prompt into Build input field (§8)
12. Click Build / Send → record timestamp as `PROVIDER_CALL_AT`

**After AI completion (work quickly):**

13. Note AI completion in UI
14. **DO NOT click Apply yet** — wait for Cursor operator to confirm build_awaiting_apply and zero-deduction checks (takes ~60 seconds)
15. When operator confirms: **click Apply immediately** → record `APPLY_ATTEMPT_AT`
16. Wait for apply success confirmation → record `APPLY_SUCCESS_AT`

**After apply:**

17. In DevTools Network tab, look for: `POST .../confirm-build-apply` → record HTTP status and response body
18. If confirm request appears: record URL, status (200), `triggered` field from response body
19. If confirm request does NOT appear automatically within ~30 seconds: notify operator

**After deduction confirmed:**

20. Switch to **billing tab** (same Chrome window — this triggers the 03H focus refetch)
21. In DevTools Network tab, observe `GET /api/billing/balance` HTTP 200
22. Record `BALANCE_BROWSER_AFTER` from billing UI display

**After balance reconciled:**

23. In Builder workspace tab: observe `e2e-05.html` in file tree
24. Click file to open in editor — verify exact content
25. Open preview (if available) — verify heading and paragraph

**Manual checkpoint:**

26. In editor for `e2e-05.html`: append line `<!-- E2E-05 manual checkpoint marker -->` at end of file
27. Save (Ctrl+S or normal save)
28. Click "Save Point" / checkpoint button in workspace header
29. Confirm HTTP 201 response in DevTools, note commitHash

**Cleanup:**

30. Via API or UI: `DELETE /api/sessions/<SESSION_ID>`
31. Confirm "Session terminated" response

---

## 32. Exact Future Commands

All commands for Step 3 execution. **READ-ONLY** = safe to run at any time. **MUTATING** = requires explicit Step 3 authorization.

### 32.1 SSH Connectivity

```bash
# READ-ONLY — establish connection
ssh aisandbox-staging
```

### 32.2 Staging Parity Preflight

```bash
# READ-ONLY — all
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox status --short
git -C /opt/aisandbox branch --show-current
git -C /opt/aisandbox stash list
git -C /opt/aisandbox rev-parse "stash@{0}"
git -C /opt/aisandbox merge-base --is-ancestor c3e39279abe3c0d6c348daa312107c8f6fc592b7 HEAD && echo PARITY_PROVEN || echo DEPLOYMENT_REQUIRED
```

### 32.3 Service Health

```bash
# READ-ONLY
pm2 list
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
```

### 32.4 Safety Flags

```bash
# READ-ONLY
GW_ID=$(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']")
pm2 env "$GW_ID" | grep 'GLOBAL_EXECUTION_ENABLED'
pm2 env "$GW_ID" | grep 'BILLING_CHARGES_ENABLED'
pm2 env "$GW_ID" | grep 'AGENT_HARNESS'
pm2 env "$GW_ID" | grep 'SESSION_IDLE_TIMEOUT_MS'
pm2 env "$GW_ID" | grep 'AI_PROVIDER'
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
grep '^BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
grep '^AI_PROVIDER' /opt/aisandbox/.env
```

### 32.5 Credit Baseline DB Query

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "SELECT owner_id, owner_type, balance, updated_at FROM credit_balances WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c' AND owner_type = 'user';"
```

### 32.6 Capture IDs and SESSION_CREATED_AT After Session Creation

Run immediately after Keith opens workspace — captures all IDs and the CONSERVATIVE_SERVER_SIDE_SAFETY_ANCHOR (PostgreSQL sessions.created_at):

```bash
# READ-ONLY — queries PostgreSQL API Gateway DB; captures SESSION_CREATED_AT = POSTGRES_SESSION_CREATED_AT
psql "$DATABASE_URL" -c "SELECT id, project_id, status, container_id, created_at FROM sessions ORDER BY created_at DESC LIMIT 3;"
# sessions.created_at = SESSION_CREATED_AT = SESSION_HEADROOM_ANCHOR_AT (PostgreSQL @CreateDateColumn; FIRST in creation chain)

# Alternative: query by SESSION_ID once known from URL
psql "$DATABASE_URL" -c "SELECT id, project_id, container_id, created_at FROM sessions WHERE id = '<SESSION_ID>';"
```

### 32.7 Gate Enable

```bash
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
sleep 8
pm2 env "$GW_ID" | grep 'GLOBAL_EXECUTION_ENABLED'
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
```

### 32.8 build_awaiting_apply Check (Pre-Apply — pre-prepared, fill EXECUTION_ID)

```bash
# READ-ONLY — run immediately after AI completion, before apply
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep 'build_awaiting_apply'
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS deduction_count FROM credit_deduction_records WHERE source_event_id = '<EXECUTION_ID>';"
```

### 32.9 Execution Metadata Capture

```bash
# READ-ONLY — after provider call
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
```

### 32.10 Automatic Checkpoint Verification

```bash
# READ-ONLY
docker exec <CONTAINER_ID> git -C /workspace log --oneline -n 5

psql "$DATABASE_URL" -c "
SELECT commit_hash, description, files_changed, created_at
FROM git_checkpoints
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at DESC
LIMIT 5;
"

python3 -c "
import sqlite3, json
conn = sqlite3.connect('file:/opt/aisandbox/database/aisandbox.db?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT git_commit_hash, description, files_changed, message_number, created_at FROM checkpoints WHERE session_id = ? ORDER BY created_at DESC LIMIT 5', ('<SESSION_ID>',)).fetchall()
for r in rows:
    print(json.dumps(dict(r)))
conn.close()
"
```

### 32.11 Deduction Record Query

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "
SELECT
  source_event_id,
  requested_credits,
  applied_credits,
  overflow_credits,
  balance_before,
  balance_after,
  status,
  created_at
FROM credit_deduction_records
WHERE source_event_id = '<EXECUTION_ID>';
"

psql "$DATABASE_URL" -c "SELECT COUNT(*) AS deduction_count FROM credit_deduction_records WHERE source_event_id = '<EXECUTION_ID>';"
```

### 32.12 Post-Deduction Balance Queries

```bash
# READ-ONLY
psql "$DATABASE_URL" -c "SELECT owner_id, owner_type, balance, updated_at FROM credit_balances WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c' AND owner_type = 'user';"
```

### 32.13 PM2 Log Deduction Triggered Check

```bash
# READ-ONLY — after public confirm-build-apply
pm2 logs aisandbox-api-gateway --nostream --lines 300 | grep 'confirm_build_apply'
```

### 32.14 Workspace File Validation

```bash
# READ-ONLY
ls /opt/aisandbox/workspaces/<SESSION_ID>/e2e-05.html
cat /opt/aisandbox/workspaces/<SESSION_ID>/e2e-05.html
```

### 32.15 Session Cleanup Commands

```bash
# Cleanup — Keith runs DELETE via browser API call or:
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION (ordinary product path)
# Keith in browser: DELETE /api/sessions/<SESSION_ID>

# Verify cleanup
# READ-ONLY
psql "$DATABASE_URL" -c "SELECT id, status, terminated_at FROM sessions WHERE id = '<SESSION_ID>';"
docker inspect <CONTAINER_ID> 2>&1
```

### 32.16 Gate Restoration

```bash
# MUTATING — REQUIRES EXPLICIT STEP 3 AUTHORIZATION
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 8

# Verify
# READ-ONLY
pm2 env "$GW_ID" | grep 'GLOBAL_EXECUTION_ENABLED'
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health/ready
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
pm2 env "$GW_ID" | grep 'BILLING_CHARGES_ENABLED'
```

---

## 33. Governance Owner Note

GOVERNANCE mutex will be acquired for the atomic board/registry write (Step 2 final state update). Released after completion. Lane 1 retains STAGING, PROVIDER-LIVE, CREDIT, ENV.

---

## 34. Authorization Boundary Summary

```
RUNTIME_EXECUTION_AUTHORIZED  = NO
PROVIDER_CALL_AUTHORIZED       = NO
CREDIT_MUTATION_AUTHORIZED     = NO
STAGING_MUTATION_AUTHORIZED    = NO
```

Step 2 does NOT authorize Step 3. Keith must explicitly authorize Step 3 before any live action.

---

## 35. Step 2 Final State

```
Step 1: COMPLETE — Registration / Admission — 2026-08-20
Step 2: COMPLETE — Stage Start / Exact Corrected E2E Runbook — 2026-08-20
Step 3: PENDING — EXPLICIT KEITH RUNTIME AUTHORIZATION REQUIRED
Step 4: PENDING
```

Runbook is deterministic. Session timing safely bounded. No material blocker. E2E-05 remains ACTIVE.

---

*Created 2026-08-20 — PRIVATE-BETA-E2E-05 Step 2 control-plane / governance consolidation only — no application source/test/runtime mutation — no staging/provider/credit activity — no Git mutation.*
