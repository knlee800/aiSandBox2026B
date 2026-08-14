# PRIVATE-BETA-E2E-02-STAGE-START.md
## PRIVATE-BETA-E2E-02 — Fresh Private-Beta End-to-End Readiness Validation
### Step 2 — Stage Start / Exact Controlled Runbook

**Task ID:** PRIVATE-BETA-E2E-02
**Step:** Step 2 — Stage Start / Exact Controlled Runbook
**Created:** 2026-08-14
**Author:** Cursor / Sonnet 4.6 (read-only planning — no runtime action occurred — no provider call — no balance mutation — no PM2 action — no .env edit)

---

## 1. Task / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-E2E-02 |
| Title | Fresh Private-Beta End-to-End Readiness Validation |
| Status | **ACTIVE** |
| Workflow | HIGH-RISK 4-STEP |
| Step completed | Step 2 — Stage Start / Exact Controlled Runbook — **COMPLETE — 2026-08-14** |
| Step 1 | Registration — COMPLETE — 2026-08-14 |
| Step 2 | Stage Start / Exact Controlled Runbook — COMPLETE — 2026-08-14 |
| Step 3 | Controlled Staging E2E Execution — **PENDING / READY TO EXECUTE** |
| Step 4 | Consolidation / Final Readiness Decision — PENDING |
| Checkpoint (Step 4) | `docs/PRIVATE-BETA-E2E-02-CHECKPOINT.md` — to be created at Step 4 |

---

## 2. Keith Authorization (Already Recorded)

Keith explicitly authorized on 2026-08-14:

- Controlled PRIVATE-BETA-E2E-02 execution window
- Temporarily setting `GLOBAL_EXECUTION_ENABLED=true` on staging
- **Exactly ONE** real xAI / Grok 4.5 provider execution
- Mandatory restoration to `GLOBAL_EXECUTION_ENABLED=false` immediately afterward regardless of outcome
- Approximately $2.50 xAI provider credit confirmed available

**This authorization applies to Step 3 only.**

Explicitly NOT authorized:
- Multiple provider executions or arbitrary retries
- Leaving `GLOBAL_EXECUTION_ENABLED=true` after Step 3
- Stripe / external payment activity
- Broad staging modifications beyond the bounded execution window
- Any action during Step 2 (this document)

---

## 3. Provider-Call Budget

```
provider_call_count = 0  (at Step 3 start)
```

**Hard budget: EXACTLY ONE**

| State | Count |
|-------|-------|
| Before browser submission | 0 — must still be 0 |
| After single submission | 1 |
| After any outcome (PASS, error, timeout, malformed, zero actions) | 1 — NO RETRY |

If a second provider call appears necessary for any reason:
**STOP. Request fresh Keith authorization before proceeding.**

---

## 4. Staging Target and Processes

| Identifier | Value |
|------------|-------|
| SSH alias | `aisandbox-staging` |
| Staging domain | `https://staging.ainow.biz` |
| Staging env file | `/opt/aisandbox/.env` |

**PM2 processes (confirmed from E2E-01 pre-flight evidence):**

| Process name | Port | Purpose |
|-------------|------|---------|
| `aisandbox-api-gateway` | 4000 | API Gateway — consumes `GLOBAL_EXECUTION_ENABLED` |
| `aisandbox-ai-service` | 4001 | AI Worker |
| `aisandbox-container-manager` | 4002 | Container/session management |
| `aisandbox-frontend` | — | Next.js frontend |
| `aisandbox-ops-watchdog` | — | Operational watchdog |

**`GLOBAL_EXECUTION_ENABLED` is consumed by `aisandbox-api-gateway` only.**

Source evidence: `services/api-gateway/src/safety/kill-switch.config.ts` line 17–18.
Dynamic static getter: reads `process.env.GLOBAL_EXECUTION_ENABLED === 'true'` at each call.
PM2 restart with `--update-env` is required to propagate `.env` changes to the running process.

---

## 5. Preflight Evidence Already Established

From Step 1 registration prerequisite check (2026-08-14):

| Check | Result |
|-------|--------|
| `aisandbox-frontend` | online |
| `aisandbox-api-gateway` | online |
| Frontend `INTERNAL_SERVICE_KEY` | PRESENT |
| API Gateway `INTERNAL_SERVICE_KEY` | PRESENT |
| Keys | MATCH=YES |
| Frontend `API_GATEWAY_URL` | `http://localhost:4000` |
| API Gateway target | PASS |
| Frontend → Gateway connectivity | PASS |
| `GLOBAL_EXECUTION_ENABLED` | `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| Provider quota | Keith confirmed sufficient remaining credit (~$2.50) |

No secrets were printed during registration preflight.
Do not repeat invasive environment inspection unless a runbook detail requires it.

---

## 6. Selected Disposable Test Project

### Why Disposable

Step 3 must use a fresh staging project that does not contaminate any user's important existing project. Keith must NOT open a prior project.

### Project Creation Path (Normal Product Path)

1. Navigate to `https://staging.ainow.biz/en/app`
2. The Builder workspace home view opens — project list panel visible
3. Click **"New Project"** button (`data-testid: workspace-projects-new-project-button`)
4. A row expands with text input (placeholder: `New project name`) and **"Create Project"** button
5. Type the exact project name (see below) into the input
6. Click **"Create Project"** (button is disabled until input is non-empty)
7. System automatically:
   - Creates a new project record in PostgreSQL
   - Opens the project in a fresh session (new Docker container)
   - Transitions workspace view to `'project'`
8. File tree will be **empty** (fresh workspace)

**Do not create this project during Step 2. Create it only at the start of Step 3 Phase B.**

### Recommended Project Name

```
E2E-02-Disposable-2026-08-14
```

This name is:
- Date-stamped (will not conflict with prior projects)
- Clearly marked as disposable and test-only
- Descriptive for identification in project list

### How Project ID Is Captured

After project creation, Cursor (via SSH + SQL) will query:

```bash
# Read-only SQL — captures most recent project for Keith's user
psql "$DATABASE_URL" -c "
SELECT id, name, user_id, created_at
FROM projects
ORDER BY created_at DESC
LIMIT 5;
"
```

Do not create the project from SSH. Keith creates via normal UI. Project ID is read-only evidence captured afterward.

### How Session ID Is Captured

After project opens, the session is created automatically. Cursor queries:

```bash
psql "$DATABASE_URL" -c "
SELECT id, project_id, status, created_at
FROM sessions
ORDER BY created_at DESC
LIMIT 5;
"
```

Session ID can also be inferred from container-manager logs:
```bash
pm2 logs aisandbox-container-manager --nostream --lines 50 | grep 'session'
```

### How Execution ID Is Captured

After Keith submits the Build prompt, Cursor queries:

```bash
psql "$DATABASE_URL" -c "
SELECT id, user_id, execution_status,
  metadata->'aiExecutionResult'->>'executionIntent' as intent,
  jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) as file_action_count,
  created_at, updated_at
FROM usage_records
ORDER BY created_at DESC
LIMIT 5;
"
```

---

## 7. Exact Single Build Prompt

Use this prompt verbatim in Step 3. Do not modify it.

---

**EXACT PROMPT — copy and paste verbatim into the Builder chat input:**

```
Create a single file named `index.html` in this workspace. Its complete contents must be exactly:

<!doctype html>
<html>
<head><meta charset="utf-8"><title>E2E-02</title></head>
<body><h1>PRIVATE-BETA-E2E-02</h1><p>Builder workspace apply succeeded.</p></body>
</html>

Do not create or modify any other file.
```

---

**Why this prompt is safe for Step 3:**

| Property | Value |
|----------|-------|
| Token cost | Minimal — short prompt, tiny deterministic output |
| Expected file actions | Exactly one: write `index.html` |
| Expected executionIntent | `workspace_mutation` |
| Verifiable artifact | `index.html` exact content is specified |
| Preview-compatible | Static HTML served by workspace container |
| Deterministic | Model output is fully constrained by exact content spec |
| Non-destructive | Adds one file to an empty workspace |
| No dependencies | No npm, no build step, no external packages |
| Easy to verify | Keith can read and compare 7 HTML lines visually |

Source inspection confirmed: no conflict with current Builder behavior.
No provider call was made to test this prompt. Budget remains 0.

---

## 8. Manual Browser Boundary

**Keith has NOT authorized autonomous browser automation.**

Step 3 must clearly separate:

### A. Cursor / SSH / Read-Only Evidence Actions (Cursor performs)

- SSH pre-flight checks via `aisandbox-staging`
- `GLOBAL_EXECUTION_ENABLED` enable / restore via SSH
- PM2 health verification
- DB read-only SQL queries
- Log inspection
- Evidence recording

### B. Keith's Manual Browser Actions (Keith performs)

1. Open `https://staging.ainow.biz/en` in browser
2. Log in with staging credentials (if session expired)
3. Navigate to `/en/app`
4. Create/open the disposable project (`E2E-02-Disposable-2026-08-14`)
5. Confirm Build mode is selected (not Ask)
6. Confirm model selector shows `grok-4.5` selected (xAI provider)
7. Note any visible starting credit balance displayed in the UI
8. Submit the exact prompt ONCE
9. Do not click/send again even if response appears slow
10. Wait for terminal result (file action applied or error)
11. Verify `index.html` appears in the file tree
12. Click `index.html` to open in editor
13. Confirm editor shows the exact 7-line HTML content
14. Verify preview renders: heading "PRIVATE-BETA-E2E-02" and paragraph "Builder workspace apply succeeded."
15. Note any visible ending credit balance displayed in the UI
16. Report result back to Cursor (PASS / FAIL with details)

**Cursor stops at the browser checkpoint and gives Keith exact instructions. After Keith reports the result, Cursor continues evidence collection.**

---

## 9. Pre-Run Safety Gate (Phase A)

Before `GLOBAL_EXECUTION_ENABLED` changes, all of the following must PASS:

```bash
ssh aisandbox-staging

# 1. PM2 process health
pm2 list
```

| Check | Required status |
|-------|----------------|
| `aisandbox-api-gateway` | **online** |
| `aisandbox-ai-service` | **online** |
| `aisandbox-container-manager` | **online** |
| `aisandbox-frontend` | **online** |
| `aisandbox-ops-watchdog` | **online** |

```bash
# 2. API Gateway readiness
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health/ready
# Expected: 200

# 3. AI Service metrics
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4001/metrics
# Expected: 200

# 4. Container-manager health
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4002/api/health
# Expected: 200

# 5. Frontend reachability
curl -sI https://staging.ainow.biz | head -1
# Expected: HTTP/2 307 (or 200) — healthy redirect/response

# 6. GLOBAL_EXECUTION_ENABLED = false (must be false before enabling)
pm2 env $(pm2 jlist | python3 -c "import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']") | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: false
# Alternative: pm2 ls (note api-gateway numeric ID), then pm2 env <ID> | grep GLOBAL_EXECUTION_ENABLED

# 7. BILLING_CHARGES_ENABLED = false
pm2 env <api-gateway-id> | grep BILLING_CHARGES_ENABLED
# Expected: BILLING_CHARGES_ENABLED: false

# 8. INTERNAL_SERVICE_KEY present in API Gateway
pm2 env <api-gateway-id> | grep -c INTERNAL_SERVICE_KEY
# Expected: 1 or more (key present) — do NOT print the value

# 9. Verify .env gate currently false
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# 10. Watchdog — no active outage
pm2 logs aisandbox-ops-watchdog --nostream --lines 20
# Expected: recent probe PASS lines — no ALERT lines
```

**If any of the above fails: STOP. Do not proceed to Phase B or enable the execution gate.**

**Separately confirm (via source/catalogue — no provider call required):**
- grok-4.5 is selectable in frontend catalogue (`selectable: true` — confirmed from source)
- grok-4.20 is NOT selectable in frontend catalogue (`selectable: false` — confirmed from source)
- Backend `XAI_ALLOWED_MODELS = ['grok-4.5']`, `enforceAllowedModels: true` (confirmed from source)

---

## 10. Exact GLOBAL_EXECUTION_ENABLED Enable Plan (Phase C)

**IMPORTANT: Write the restoration plan (§11) before running the enable. The restoration sequence is the top priority.**

### Which process consumes the gate
`aisandbox-api-gateway` — the only PM2 process that reads `GLOBAL_EXECUTION_ENABLED`.

### Where current value comes from
`/opt/aisandbox/.env` — read into PM2 process environment on startup / restart with `--update-env`.
The value is read dynamically at each guard invocation (`static get` pattern), so a running-process environment update via PM2 restart propagates immediately.

### Enable sequence (run after Phase A passes and Phase B starting-balance is captured)

```bash
ssh aisandbox-staging

# E1: Edit .env — change false → true
sed -i 's/^GLOBAL_EXECUTION_ENABLED=false$/GLOBAL_EXECUTION_ENABLED=true/' /opt/aisandbox/.env

# E2: Verify .env file updated (do NOT print other secrets)
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=true

# E3: Restart API Gateway with updated environment
pm2 restart aisandbox-api-gateway --update-env

# E4: Wait for process to stabilize (~5 seconds)
sleep 5

# E5: Verify PM2 runtime environment has new value
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: true

# E6: KNOWN COMPLICATION (E2E-01 §21): first restart may NOT propagate.
#     If E5 still shows false, execute fallback:
GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
sleep 5
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Expected after fallback: GLOBAL_EXECUTION_ENABLED: true

# E7: Verify API Gateway is healthy and ready after restart
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health/ready
# Expected: 200

# E8: Verify PM2 process is still online (not in errored state)
pm2 list | grep aisandbox-api-gateway
# Expected: online
```

**Do NOT proceed to Phase D (Keith browser submission) until E5/E6 confirms `GLOBAL_EXECUTION_ENABLED: true` AND E7 confirms HTTP 200.**

---

## 11. Exact Mandatory GLOBAL_EXECUTION_ENABLED Restoration Plan (Phase E)

**This section is written BEFORE the enable section to make it impossible to forget.**

### Restoration invariant

Restoration to `false` is mandatory regardless of Step 3 outcome:
- PASS → restore
- Provider error → restore
- Timeout → restore
- Malformed result → restore
- Zero actions → restore
- Workspace apply failure → restore
- Accounting failure → restore
- Browser failure → restore

**Restoration must occur IMMEDIATELY after the one provider attempt reaches terminal outcome — BEFORE evidence investigation.**

### Restoration sequence

```bash
ssh aisandbox-staging

# R1: Edit .env — change true → false
sed -i 's/^GLOBAL_EXECUTION_ENABLED=true$/GLOBAL_EXECUTION_ENABLED=false/' /opt/aisandbox/.env

# R2: Verify .env file updated
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# R3: Restart API Gateway with updated environment
pm2 restart aisandbox-api-gateway --update-env

# R4: Wait for process to stabilize (~5 seconds)
sleep 5

# R5: Verify PM2 runtime environment restored
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: false

# R6: KNOWN COMPLICATION (E2E-01 §21): if R5 still shows true, execute fallback:
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 5
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Expected after fallback: GLOBAL_EXECUTION_ENABLED: false

# R7: Verify API Gateway readiness after restart
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health/ready
# Expected: 200

# R8: Verify PM2 process online
pm2 list | grep aisandbox-api-gateway
# Expected: online
```

**Only after restoration is confirmed may evidence investigation in Phases F–H continue.**

### Restoration failure safety

If restoration to `false` cannot be confirmed (repeated restart failures, PM2 crash loop):
- **BLOCK Step 3 from continuing any investigation**
- Do not modify source
- Do not retry provider
- Investigate PM2 / process health first
- Get Keith's authorization before any further action

---

## 12. Provider-Call Counter Tracking

```
Initialize at Step 3 start: provider_call_count = 0

Before Phase D (Keith browser submission):
  ASSERT: provider_call_count == 0
  If not 0: STOP — unexpected prior call — do not submit

After Phase D single submission:
  provider_call_count = 1

After any terminal outcome:
  Final: provider_call_count <= 1
  If call count exceeds 1: flag as anomaly in evidence

Any further call: requires fresh Keith authorization — NO RETRY within E2E-02.
```

---

## 13. Starting Balance / User / Project / Session Evidence Plan (Phase B)

**Capture before enabling execution gate (before Phase C).**

```bash
ssh aisandbox-staging
# Load DATABASE_URL from staging environment (do NOT print secrets)
set -a; source /opt/aisandbox/.env; set +a

# B1: Identify Keith's staging user ID
psql "$DATABASE_URL" -c "
SELECT id AS user_id, email, created_at
FROM users
ORDER BY created_at ASC
LIMIT 10;
"
# Note Keith's user_id (UUID) — do NOT print credentials/passwords

# B2: Capture starting credit balance
psql "$DATABASE_URL" -c "
SELECT user_id, balance, updated_at AS balance_timestamp
FROM credit_balances
WHERE user_id = '<keith-user-id-from-B1>';
"
# Record: user_id, starting_balance, balance_timestamp

# B3: Record capture timestamp
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

**Evidence to record before Phase C:**

| Field | Value (to be filled at Step 3) |
|-------|-------------------------------|
| user_id | — |
| starting_balance | — |
| balance_timestamp | — |
| capture_timestamp | — |

---

## 14. User / Project / Session / Execution Evidence Plan

### After Phase D (Keith creates project and reports back)

```bash
# P1: Capture project ID for the disposable project
psql "$DATABASE_URL" -c "
SELECT id AS project_id, name, user_id, created_at
FROM projects
WHERE user_id = '<keith-user-id>'
ORDER BY created_at DESC
LIMIT 3;
"
# Record project_id for E2E-02-Disposable-2026-08-14

# P2: Capture session ID
psql "$DATABASE_URL" -c "
SELECT id AS session_id, project_id, status, created_at
FROM sessions
WHERE project_id = '<project-id>'
ORDER BY created_at DESC
LIMIT 3;
"
# Record session_id

# P3: After execution starts — capture execution ID
psql "$DATABASE_URL" -c "
SELECT
  id AS execution_id,
  user_id,
  execution_status,
  metadata->'aiExecutionResult'->>'executionIntent' AS intent,
  metadata->'aiExecutionResult'->>'provider' AS provider,
  metadata->'aiExecutionResult'->>'model' AS model,
  jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count,
  created_at,
  updated_at
FROM usage_records
WHERE user_id = '<keith-user-id>'
ORDER BY created_at DESC
LIMIT 5;
"
# Record execution_id (UUID)
```

---

## 15. Execution Evidence Plan (Phase F)

After Phase E restoration, capture full execution evidence:

```bash
# F1: Execution record — full evidence
psql "$DATABASE_URL" -c "
SELECT
  id AS execution_id,
  user_id,
  execution_status,
  metadata->'aiExecutionResult'->>'executionIntent' AS execution_intent,
  metadata->'aiExecutionResult'->>'provider' AS provider,
  metadata->'aiExecutionResult'->>'model' AS model,
  metadata->'aiExecutionResult'->>'selectedPath' AS selected_path,
  metadata->'aiExecutionResult'->>'harnessVersion' AS harness_version,
  (metadata->'aiExecutionResult'->'tokenUsage')::text AS token_usage,
  jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) AS file_action_count,
  metadata->'aiExecutionResult'->'fileActions' AS file_actions,
  created_at,
  updated_at
FROM usage_records
WHERE id = '<execution-id>';
"
```

**Required qualifying values:**

| Field | Required value |
|-------|---------------|
| `execution_status` | `completed` |
| `execution_intent` | `workspace_mutation` |
| `provider` | `xai` |
| `model` | `grok-4.5` |
| `file_action_count` | `> 0` |
| `selected_path` | `plain` |
| `harness_version` | `null` |

If any field fails the required value: **E2E FAIL — NO RETRY**

```bash
# F2: Confirm no deduction record exists immediately at AI completion
#     (This proves 03D-A gate worked — deduction not triggered at completion)
#     Run this BEFORE confirm-build-apply completes (or use log evidence):
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS deduction_count_at_completion
FROM credit_deduction_records
WHERE source_event_id = '<execution-id>';
"
# Expected at AI completion (before browser apply): 0
# (If DB is queried after apply confirmation, count will be 1 — use log evidence instead)
```

```bash
# F3: API Gateway logs — confirm build_awaiting_apply gate log
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep -i "awaiting_apply\|build_await"
# Expected: log line indicating workspace_mutation intent skipped deduction (build_awaiting_apply)
```

---

## 16. Build Completion vs Deduction Proof Method

**This is the key 03D accounting proof: AI completion alone must NOT be the deduction trigger.**

### Selected proof method: authoritative timestamp / record ordering

**Rationale:** The 03D-A implementation returns `{ triggered: false, reason: 'build_awaiting_apply' }` for `workspace_mutation` intent at AI completion. Therefore, by design, no deduction record exists at the moment of AI completion. The deduction record is created only after the browser calls `POST /api/ai/executions/:executionId/confirm-build-apply`.

The proof is:

1. **`usage_records.updated_at`**: records when execution reached `completed` status
2. **API Gateway log**: `build_awaiting_apply` log line proves deduction was skipped at completion
3. **`credit_deduction_records.created_at`**: records when deduction was applied (after confirm-build-apply)
4. **Ordering**: `credit_deduction_records.created_at` > `usage_records.updated_at` (completion time)
5. **`source_event_id`**: equals `executionId` — no ambiguity about which execution was charged

**No timing gap is introduced.** Keith completes the browser flow normally. The evidence is captured from durable DB timestamps and logs after the fact — not by pausing the browser flow.

**If the log evidence is available (preferred):**
- AI Service/Gateway log: `finalizeAccounting` called for executionId → `build_awaiting_apply` returned
- This timestamp (in log) < deduction record `created_at`

---

## 17. File-Action Evidence Plan (Phase F)

```bash
# FA1: Verify file actions from execution record
psql "$DATABASE_URL" -c "
SELECT
  metadata->'aiExecutionResult'->'fileActions' AS file_actions
FROM usage_records
WHERE id = '<execution-id>';
"
# Expected: JSON array with at least one action for index.html

# FA2: Verify workspace file via container-manager or direct check
pm2 logs aisandbox-container-manager --nostream --lines 100 | grep -i "index.html\|write"
```

---

## 18. Workspace Apply Evidence Plan (Phase F)

```bash
# WA1: Container-manager logs — verify write request received
pm2 logs aisandbox-container-manager --nostream --lines 100 | grep -i "write\|index.html"

# WA2: Frontend logs — verify apply result
pm2 logs aisandbox-frontend --nostream --lines 200 | grep -i "applyStatus\|applied\|index.html"
```

**Required qualifying values from frontend apply result (captured from logs or Keith's report):**

| Field | Required value |
|-------|---------------|
| `applyStatus` | `applied` |
| `totalActions` | ≥ 1 |
| `successCount` | = totalActions |
| Every `result.status` | `success` |
| Applied path | `index.html` or `/workspace/index.html` |

If any field fails: **E2E FAIL — NO RETRY**

---

## 19. Confirmation / Deduction Evidence Plan (Phase G)

### How to prove the confirmation route was called

```bash
# G1: API Gateway logs — confirm internal confirm-build-apply receipt
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep -i "confirm-build-apply\|triggerBuildApply\|confirm_build"
# Expected: log line showing internal endpoint /api/internal/executions/:executionId/confirm-build-apply was called

# G2: Frontend logs — confirm proxy sent confirmation
pm2 logs aisandbox-frontend --nostream --lines 200 | grep -i "confirm.*build\|BUILD_APPLY_CONFIRM"
```

### Confirmation chain proof

The confirmation route proves:

```
Browser
→ Next.js /api/ai/executions/:executionId/confirm-build-apply (session cookie auth)
→ proxyConfirmBuildApply()
→ GET /api/auth/me → authenticatedUserId (ownership check)
→ GET /api/ai/executions/:executionId (ownership: execution.user_id === authenticatedUserId)
→ INTERNAL_SERVICE_KEY from process.env (server-only, NOT from browser)
→ POST /api/internal/executions/:executionId/confirm-build-apply (API Gateway)
→ triggerBuildApplyDeduction() → 10-check validation → emitDeductionAttempt()
```

**Do NOT print `INTERNAL_SERVICE_KEY`.**

Log evidence must show the internal endpoint was called — not the key itself.

Confirmed from source inspection: `INTERNAL_SERVICE_KEY` is absent from `.next/static/` client bundle (verified during 03D-B).

---

## 20. Deduction / Idempotency Evidence Plan (Phase G)

```bash
# G3: Capture deduction record
psql "$DATABASE_URL" -c "
SELECT
  id AS deduction_record_id,
  user_id,
  source_event_id,
  applied_credits,
  balance_before,
  balance_after,
  created_at AS deduction_timestamp,
  metadata::text AS deduction_metadata
FROM credit_deduction_records
WHERE source_event_id = '<execution-id>';
"
# Expected: exactly ONE row

# G4: Verify ending balance
psql "$DATABASE_URL" -c "
SELECT user_id, balance AS ending_balance, updated_at
FROM credit_balances
WHERE user_id = '<keith-user-id>';
"
# Expected: balance_after from G3 = ending_balance

# G5: Verify no duplicate deduction
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS deduction_count
FROM credit_deduction_records
WHERE source_event_id = '<execution-id>';
"
# Expected: exactly 1

# G6: Verify no unexpected credit grant/refund
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS unexpected_grants
FROM credit_grant_records
WHERE user_id = '<keith-user-id>'
  AND created_at > '<step3-start-timestamp>';
"
# Expected: 0 (no grants during E2E-02 window)
```

**Required qualifying values:**

| Field | Required value |
|-------|---------------|
| Deduction record count | Exactly 1 |
| `source_event_id` | = `executionId` |
| `balance_before` | = starting_balance (captured in Phase B) |
| `balance_after` | = `balance_before - applied_credits` |
| `applied_credits` | > 0 |
| Credit grant/refund | 0 unexpected grants |
| Duplicate deduction | 0 additional records for same source_event_id |

Idempotency proof: The `credit_deduction_records.source_event_id` UNIQUE constraint ensures exactly-once deduction. Source evidence: `services/api-gateway/src` — `PersistentCreditDeductionGateway.applyDeduction()` pre-transaction duplicate check + UNIQUE constraint fallback.

---

## 21. Idempotency Evidence

No second `POST confirm-build-apply` is sent in Step 3 (one attempt per apply result, no retry).

Idempotency proof is structural:
- `credit_deduction_records.source_event_id` has UNIQUE constraint
- `applyDeduction()` checks for existing record before transaction
- Database constraint catches any race condition
- Pessimistic write lock (`FOR UPDATE`) on `credit_balances` row serializes concurrent deductions

Evidence from deduction count query (G5 above) = 1 is the idempotency proof.
Do NOT manually trigger `confirm-build-apply` a second time to test idempotency.

---

## 22. Model-Policy Evidence (no provider call required)

**Prove without provider calls:**

### Frontend catalogue (source evidence — already confirmed)

From `frontend/lib/ai/provider-model.catalogue.ts`:

| Entry | `modelId` | `selectable` |
|-------|-----------|-------------|
| xai model 1 | `grok-4.5` | `true` |
| xai model 2 | `grok-4.20` | `false` (PRIVATE-BETA-BLOCKER-03C) |

- Default provider: `xai`
- Default model: `grok-4.5`
- `grok-4.20` is retained for historical metadata but marked `selectable: false`
- `getSelectableFrontendModelEntriesForProvider('xai')` returns only `grok-4.5`

### Backend catalogue (source evidence — already confirmed)

From `services/api-gateway/src/ai/provider-model.catalogue.ts`:

```
XAI_RECOGNIZED_MODELS = ['grok-4.5', 'grok-4.20']
XAI_ALLOWED_MODELS = ['grok-4.5']
enforceAllowedModels: true
```

- `grok-4.20` would be rejected at the backend if submitted (not in `XAI_ALLOWED_MODELS`)
- No fallback to `grok-4.20` exists

### Execution record evidence (at Step 3)

After execution, the `usage_records.metadata.aiExecutionResult.model` field must equal `grok-4.5`.
This is authoritative: it is written by the backend worker, not inferred from browser UI.

### UI verification (Keith's observation)

Keith confirms at Step 3 Phase D: model selector shows `grok-4.5` selected.
Keith confirms: no `grok-4.20` option appears in the model dropdown.

---

## 23. Ask Regression Evidence (no provider call required)

**Prove Ask semantics are preserved without an Ask provider call.**

From `frontend/lib/ai/provider-model.catalogue.ts` and `page.tsx`:
- `shouldApplyFileActionsForExecutionIntent('conversation')` = `false`
- Ask executions: no workspace apply runs → `confirmBuildApplyIfQualifying()` is never reached
- Ask deduction path: unchanged — `triggerDeductionForExecution()` for `conversation` intent proceeds immediately to `emitDeductionAttempt()`

**Source evidence chain (03D-B checkpoint §13):**
```
Ask execution completed
→ triggerDeductionForExecution(executionId)
→ readPersistedExecutionIntent() = 'conversation'
→ emitDeductionAttempt(record)  ← immediate, no delay
→ PersistentCreditDeductionGateway.applyDeduction()
→ CHARGE applied immediately (unchanged)
```

**Test evidence (03D-B checkpoint §12):**
```
frontend/components/workspace/workspace-ai-file-actions.logic.test.ts — PASS
services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts — Ask immediate deduction test PASS
```

**Explicitly confirmed:**
- Ask `executionIntent=conversation` → `triggerDeductionForExecution()` → immediate charge
- Ask → no `confirm-build-apply` request
- Ask → no apply-once guard invocation
- Build confirm route cannot be reached from Ask execution path

No second provider call is required to prove Ask regression safety.

---

## 24. Workspace Usability / Browser Proof (Phase H)

Keith must verify all of the following after execution and restoration:

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| 1 | File tree | Observe workspace file tree | `index.html` appears |
| 2 | Editor | Click `index.html` in file tree | Editor opens and shows content |
| 3 | Content — doctype | Observe editor content | `<!doctype html>` present |
| 4 | Content — title | Observe editor content | `<title>E2E-02</title>` present |
| 5 | Content — h1 | Observe editor content | `<h1>PRIVATE-BETA-E2E-02</h1>` present |
| 6 | Content — p | Observe editor content | `<p>Builder workspace apply succeeded.</p>` present |
| 7 | Preview | Open preview panel | Page renders (no blank/404/502 error) |
| 8 | Preview heading | Observe preview | Heading "PRIVATE-BETA-E2E-02" visible |
| 9 | Preview paragraph | Observe preview | Paragraph "Builder workspace apply succeeded." visible |

**Acceptable UI label names based on source inspection:**
- Preview panel: "Preview" tab/button in workspace view
- File tree: left panel showing project files
- Editor: center panel showing file content (Monaco editor)

**If preview cannot render for this project type:**
- File tree, editor, and content verification (checks 1–6) remain required
- Preview render failure for plain HTML on a session-active workspace is a blocker

---

## 25. External Payment Safety Evidence

Throughout all phases and finally:

```bash
# Verify BILLING_CHARGES_ENABLED remains false at all checkpoints
pm2 env <api-gateway-id> | grep BILLING_CHARGES_ENABLED
# Expected: BILLING_CHARGES_ENABLED: false

grep '^BILLING_CHARGES_ENABLED' /opt/aisandbox/.env
# Expected: BILLING_CHARGES_ENABLED=false
```

**Confirmed: no Stripe / external payment activity must occur.**

This Step 3 must produce **zero**:
- Stripe checkout sessions
- Stripe portal calls
- Stripe webhook triggers
- Subscription creation
- External payment charges

`BILLING_CHARGES_ENABLED=false` is a hard safety lock enforced by `ChargeReadinessService`.
No code path in Step 3 touches Stripe. Keith must not navigate to any billing/payment page.

---

## 26. Exact Commands Summary

### SSH connection
```bash
ssh aisandbox-staging
```

### PM2 health check
```bash
pm2 list
pm2 env <api-gateway-id> | grep -E 'GLOBAL_EXECUTION_ENABLED|BILLING_CHARGES_ENABLED|INTERNAL_SERVICE_KEY'
```

### API service health
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health/ready
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4001/metrics
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4002/api/health
curl -sI https://staging.ainow.biz | head -1
```

### Enable execution gate
```bash
sed -i 's/^GLOBAL_EXECUTION_ENABLED=false$/GLOBAL_EXECUTION_ENABLED=true/' /opt/aisandbox/.env
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
pm2 restart aisandbox-api-gateway --update-env
sleep 5
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Fallback if not propagated:
GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
sleep 5
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health/ready
```

### Restore execution gate (MANDATORY — run regardless of outcome)
```bash
sed -i 's/^GLOBAL_EXECUTION_ENABLED=true$/GLOBAL_EXECUTION_ENABLED=false/' /opt/aisandbox/.env
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
pm2 restart aisandbox-api-gateway --update-env
sleep 5
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
# Fallback if not propagated:
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
sleep 5
pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/health/ready
```

### DB evidence (source all from env — do NOT print secrets)
```bash
set -a; source /opt/aisandbox/.env; set +a

# Starting balance
psql "$DATABASE_URL" -c "SELECT user_id, balance, updated_at FROM credit_balances WHERE user_id='<id>';"

# Execution record
psql "$DATABASE_URL" -c "SELECT id, execution_status, metadata->'aiExecutionResult'->>'executionIntent' as intent, metadata->'aiExecutionResult'->>'provider' as provider, metadata->'aiExecutionResult'->>'model' as model, jsonb_array_length(COALESCE(metadata->'aiExecutionResult'->'fileActions','[]'::jsonb)) as file_action_count, created_at, updated_at FROM usage_records WHERE id='<execution-id>';"

# Deduction record
psql "$DATABASE_URL" -c "SELECT id, user_id, source_event_id, applied_credits, balance_before, balance_after, created_at FROM credit_deduction_records WHERE source_event_id='<execution-id>';"

# Deduction count (idempotency)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM credit_deduction_records WHERE source_event_id='<execution-id>';"

# Ending balance
psql "$DATABASE_URL" -c "SELECT user_id, balance, updated_at FROM credit_balances WHERE user_id='<id>';"
```

### Log inspection
```bash
pm2 logs aisandbox-api-gateway --nostream --lines 200 | grep -i "confirm-build-apply\|awaiting_apply\|triggerBuildApply"
pm2 logs aisandbox-frontend --nostream --lines 200 | grep -i "confirm.*build\|BUILD_APPLY"
pm2 logs aisandbox-ops-watchdog --nostream --lines 50
```

---

## 27. Stop Conditions

Step 3 must STOP immediately if any of the following occur:

**Pre-enable stops (before Phase C):**
- Any required PM2 process not online
- API Gateway health check fails
- AI Service health check fails
- Container-manager health check fails
- `GLOBAL_EXECUTION_ENABLED` already unexpectedly `true` at start
- `BILLING_CHARGES_ENABLED` is `true`
- `INTERNAL_SERVICE_KEY` absent from API Gateway
- `INTERNAL_SERVICE_KEY` absent from frontend process
- Keys do not match
- API Gateway target unreachable
- grok-4.5 not selectable (source catalogue check)
- grok-4.20 unexpectedly showing as selectable

**Enable / transition stops:**
- `.env` gate change fails (file not updated)
- PM2 restart puts API Gateway in error state
- PM2 restart does not propagate env after two attempts
- API Gateway readiness fails after restart

**Browser / execution stops:**
- Auth failure — cannot log in to staging
- Cannot create/open disposable project
- Project creation fails
- Build mode not selectable
- grok-4.5 not shown in model selector
- Execution gate fails to enable (503 on submission = gate still false)
- AI execution never reaches terminal state (persistent spinner > 5 minutes)
- Provider attempt #1 errors or times out
- Malformed result (no execution record in DB)
- `fileActions = []` (zero actions) — execution_status = failed or completed but no actions
- `executionIntent ≠ workspace_mutation`
- `provider ≠ xai`
- `model ≠ grok-4.5`
- Workspace apply partially fails (`successCount < totalActions`)
- Workspace apply status not `applied`
- `index.html` not present in file tree after apply
- `index.html` content incorrect or missing expected text
- Confirm-build-apply route returns non-2xx
- No deduction record after qualifying confirmation
- Duplicate deduction (>1 deduction record for executionId)
- Unexpected credit grant or refund
- Unexpected payment / Stripe activity
- `BILLING_CHARGES_ENABLED` becomes `true` at any point
- `GLOBAL_EXECUTION_ENABLED` cannot be restored to `false`
- Watchdog outage alert fires during journey

---

## 28. Failure Handling Sequence

For any failure occurring after Phase C (execution gate enabled):

1. **Execute restoration sequence immediately** (§11 Phase E) — restore `GLOBAL_EXECUTION_ENABLED=false`
2. Verify restoration: `pm2 env <api-gateway-id> | grep GLOBAL_EXECUTION_ENABLED` → `false`
3. Verify `BILLING_CHARGES_ENABLED=false`
4. Preserve all available evidence: executionId, DB records, log captures
5. Capture relevant logs (API Gateway, AI Service, container-manager, frontend) — read-only
6. Stop — do not modify source
7. Do not retry provider call
8. Classify: blocker vs non-blocker
9. Future fix requires a separately registered defect task

---

## 29. Step 3 Phase Sequence

### Phase A — Pre-Run Safety Verification
**Who:** Cursor via SSH
1. SSH to `aisandbox-staging`
2. Verify all 5 PM2 processes online
3. Verify API Gateway, AI Service, container-manager, frontend health
4. Verify `GLOBAL_EXECUTION_ENABLED=false`
5. Verify `BILLING_CHARGES_ENABLED=false`
6. Verify `INTERNAL_SERVICE_KEY` present (no value printed)
7. Verify watchdog healthy — no active alerts
8. Source catalogue check: grok-4.5 selectable, grok-4.20 not selectable
9. **If any check fails: STOP — do not proceed**

### Phase B — Capture Authenticated User / Project / Session / Starting Balance
**Who:** Cursor via SSH
1. Query starting credit balance for Keith's user
2. Record user_id, starting_balance, balance_timestamp
3. Note capture timestamp (UTC)
4. **Cursor tells Keith: "Pre-flight passed. Please begin browser journey."**

### Phase C — Enable Bounded Execution Window
**Who:** Cursor via SSH
1. Edit `/opt/aisandbox/.env`: `GLOBAL_EXECUTION_ENABLED=false` → `true`
2. Verify `.env` updated
3. `pm2 restart aisandbox-api-gateway --update-env`
4. Verify PM2 runtime env: `GLOBAL_EXECUTION_ENABLED: true`
5. Apply fallback restart if first restart did not propagate
6. Verify API Gateway readiness HTTP 200
7. **Cursor tells Keith: "Gate is open. provider_call_count=0. Submit the prompt now."**

### Phase D — Keith Submits Exactly One Build in Browser
**Who:** Keith (manual browser — Cursor stops and waits)

**CURSOR STOP POINT — Cursor waits for Keith's report. Do not proceed until Keith reports.**

1. Keith logs in if needed
2. Keith creates/opens disposable project
3. Keith confirms Build mode active
4. Keith confirms model = grok-4.5
5. Keith notes visible starting credit balance if displayed
6. Keith submits the exact Build prompt ONCE
7. Keith waits for terminal result (do not resubmit)
8. Keith observes whether `index.html` appears in file tree
9. Keith reports result: PASS/FAIL with observations

### Phase E — IMMEDIATELY Restore GLOBAL_EXECUTION_ENABLED=false
**Who:** Cursor via SSH — IMMEDIATELY after Keith reports terminal outcome
1. Edit `/opt/aisandbox/.env`: `true` → `false`
2. Verify `.env` updated
3. `pm2 restart aisandbox-api-gateway --update-env`
4. Verify PM2 runtime: `GLOBAL_EXECUTION_ENABLED: false`
5. Apply fallback if not propagated
6. Verify API Gateway readiness HTTP 200
7. **Record restoration timestamp**

**Do NOT proceed to Phase F until restoration is confirmed.**

### Phase F — Capture Execution / File-Action / Apply Evidence
**Who:** Cursor via SSH + DB + logs
1. Capture project_id from DB
2. Capture session_id from DB
3. Capture execution record (execution_id, intent, provider, model, file_action_count, status, timestamps)
4. Verify file_action_count > 0
5. Verify apply evidence (container-manager/frontend logs)
6. Verify `build_awaiting_apply` log (no premature deduction)
7. Verify index.html action in file_actions JSON

### Phase G — Capture Confirmation / Deduction Evidence
**Who:** Cursor via SSH + DB + logs
1. Search API Gateway logs for confirm-build-apply receipt
2. Query `credit_deduction_records` for execution_id
3. Verify exactly 1 deduction record
4. Verify deduction ordering (created_at > execution completed_at)
5. Verify `source_event_id = executionId`
6. Verify `balance_before = starting_balance`
7. Verify `balance_after = balance_before - applied_credits`
8. Query current credit balance = `balance_after`
9. Verify 0 unexpected credit grants

### Phase H — Keith Verifies Workspace / Editor / Preview
**Who:** Keith (manual browser)

**CURSOR STOP POINT — Cursor tells Keith to verify workspace result.**

1. Keith opens `index.html` in editor
2. Keith confirms exact content (7-line HTML)
3. Keith opens preview panel
4. Keith confirms heading "PRIVATE-BETA-E2E-02" visible
5. Keith confirms paragraph "Builder workspace apply succeeded." visible
6. Keith notes visible ending credit balance if displayed
7. Keith reports final browser observation

### Phase I — Final Safety Verification and Verdict
**Who:** Cursor via SSH + evidence review
1. Final PM2 health: all 5 processes online
2. Final gate check: `GLOBAL_EXECUTION_ENABLED=false`
3. Final billing check: `BILLING_CHARGES_ENABLED=false`
4. Verify `provider_call_count = 1`
5. Verify no unexpected balance mutations (beyond one qualifying deduction)
6. Verify no Stripe/payment activity
7. Assess all evidence against PASS/FAIL criteria
8. Record final verdict

---

## 30. Final Safety Proof

Before Step 4 may begin, the following must be confirmed:

```
GLOBAL_EXECUTION_ENABLED=false  ✓
BILLING_CHARGES_ENABLED=false   ✓
provider_call_count <= 1        ✓
aisandbox-frontend    online    ✓
aisandbox-api-gateway online    ✓
aisandbox-ai-service  online    ✓
aisandbox-container-manager online ✓
aisandbox-ops-watchdog  online  ✓
No Stripe/payment activation    ✓
No unexpected balance mutations ✓ (beyond one qualifying Builder deduction)
```

---

## 31. PASS / FAIL Criteria

### PASS — All of the following must be supported by evidence

| # | Criterion |
|---|-----------|
| 1 | Phase A pre-flight: all 5 PM2 processes online; gate = `false` before enable; billing = `false`; INTERNAL_SERVICE_KEY present; services healthy |
| 2 | Phase B: starting credit balance recorded |
| 3 | Phase C: `GLOBAL_EXECUTION_ENABLED` successfully set to `true` and verified in running process |
| 4 | Phase D: Keith successfully logs in and creates/opens disposable project |
| 5 | Phase D: Keith submits exactly one Build prompt; execution accepted (not 503, not credit error) |
| 6 | Phase D: AI execution reaches `completed` status |
| 7 | Phase E: `GLOBAL_EXECUTION_ENABLED` restored to `false` and verified in running process |
| 8 | Phase F: `executionIntent = workspace_mutation` confirmed from DB |
| 9 | Phase F: `provider = xai`, `model = grok-4.5` confirmed from DB |
| 10 | Phase F: `fileActions.length > 0` — at least one action for `index.html` |
| 11 | Phase F: `applyStatus = applied`, `successCount = totalActions` confirmed |
| 12 | Phase F: `index.html` file action applied — file exists in workspace |
| 13 | Phase F: `build_awaiting_apply` log evidence — no deduction at AI completion |
| 14 | Phase G: confirm-build-apply route called — log evidence present |
| 15 | Phase G: exactly 1 `credit_deduction_records` row for executionId |
| 16 | Phase G: `source_event_id = executionId` |
| 17 | Phase G: `balance_before = starting_balance`, `balance_after = balance_before - applied_credits` |
| 18 | Phase G: ending balance = `balance_after` |
| 19 | Phase G: 0 unexpected credit grants |
| 20 | Phase H: Keith confirms `index.html` in file tree, editor shows correct content, preview renders heading and paragraph |
| 21 | Phase I: `GLOBAL_EXECUTION_ENABLED = false` final verified |
| 22 | Phase I: `BILLING_CHARGES_ENABLED = false` final verified |
| 23 | Phase I: no Stripe/payment activity |
| 24 | Phase I: `provider_call_count = 1` |

### FAIL — Any of the following produces FAIL

- Any required PM2 process offline at any phase
- `GLOBAL_EXECUTION_ENABLED` cannot be restored to `false`
- `BILLING_CHARGES_ENABLED` becomes `true` at any point
- `fileActions = []` — zero file actions
- `executionIntent ≠ workspace_mutation`
- `provider ≠ xai` or `model ≠ grok-4.5`
- `applyStatus ≠ applied` or `successCount ≠ totalActions`
- `index.html` not present or content wrong
- No deduction record after qualifying confirmation
- Duplicate deduction (>1 record for executionId)
- Unexpected credit grant or refund side effect
- Confirm-build-apply route not called (no log evidence)
- `build_awaiting_apply` gate not logged (premature deduction may have occurred)
- Any unexpected Stripe/payment activity
- Preview fundamentally unavailable (not render failure — sustained error)
- Final gate state cannot be verified `false`

**Do not downgrade a missing launch-critical proof to PASS WITH LIMITATIONS.**
**If required evidence is missing: classify as FAIL / BLOCKED.**

---

## 32. Exact Step 3 Handoff

### Step 3 must be performed in a NEW Cursor window.

New window ensures:
- Fresh context
- Clean execution trace
- No context size limits from Step 2 planning content

### Step 3 prompt summary

Open a new Cursor window and submit:
> **PRIVATE-BETA-E2E-02 Step 3 — Controlled Staging E2E Execution**
> Runbook: `docs/PRIVATE-BETA-E2E-02-STAGE-START.md`
> Authorization: recorded — Step 2 COMPLETE
> Gate state: `GLOBAL_EXECUTION_ENABLED=false` — confirmed
> Provider budget: EXACTLY ONE call
> Start with Phase A pre-flight.

---

## Evidence Sources Consulted for This Stage Start

| Source | Purpose |
|--------|---------|
| `CLAUDE.md` | Working contract |
| `TASKS.md` | PRIVATE-BETA-E2E-02 registration and requirements |
| `docs/PRIVATE-BETA-BLOCKER-03D-CHECKPOINT.md` | Final accounting policy, build path, ask path, idempotency, runtime deps |
| `docs/PRIVATE-BETA-BLOCKER-03D-B-CHECKPOINT.md` | Frontend apply-result integration, confirmation proxy, ownership, route evidence |
| `docs/PRIVATE-BETA-E2E-01-STAGE-START.md` | Evidence-capture conventions, PM2 commands, rollback sequence, .env path |
| `docs/PRIVATE-BETA-E2E-01-CHECKPOINT.md` | PM2 propagation complication (§21), execution evidence patterns |
| `services/api-gateway/src/safety/kill-switch.config.ts` | GLOBAL_EXECUTION_ENABLED dynamic getter — which process consumes it |
| `services/api-gateway/src/safety/execution-safety.guard.ts` | Guard invocation, gate check |
| `services/api-gateway/src/ai/provider-model.catalogue.ts` | XAI_ALLOWED_MODELS, enforceAllowedModels, grok-4.5 only |
| `frontend/lib/ai/provider-model.catalogue.ts` | Frontend selectable models, grok-4.5 selectable, grok-4.20 not selectable |
| `.env.example` | BILLING_CHARGES_ENABLED default, INTERNAL_SERVICE_KEY env var name |

No runtime actions were performed during Step 2.
No provider calls were made.
No balance mutations occurred.
No PM2 restarts occurred.
No `.env` changes occurred.

---

## Safety Confirmation

| Safety item | Value |
|-------------|-------|
| Provider calls | **0** |
| Real balance mutations | **0** |
| Credits granted | **0** |
| Credits refunded | **0** |
| Migration run | NO |
| Staging / runtime work | NO |
| PM2 restarted | NO |
| `.env` modified | NO |
| Docker / Postgres / Redis started | NO |
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| `BILLING_CHARGES_ENABLED` | `false` — preserved |
| Stripe / payment-provider changes | NONE |
| Source files modified | NONE |
| Test files modified | NONE |
| Git commit / push | NO |
| PRIVATE-BETA-INVITE-01 | untouched / unregistered |

---

*Stage Start created: 2026-08-14 — PRIVATE-BETA-E2E-02 Step 2 — READ-ONLY planning only — no provider execution, no runtime mutation, no SSH action, no staging deploy, no env change, no PM2 action, no DB action, no source modification occurred during this step.*
