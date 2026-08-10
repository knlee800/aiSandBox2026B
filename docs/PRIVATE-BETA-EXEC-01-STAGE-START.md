# PRIVATE-BETA-EXEC-01 Stage-Start
## Activation Readiness Audit — Step 2

**Task ID:** PRIVATE-BETA-EXEC-01
**Title:** Controlled Builder AI Execution Activation
**Step:** 2 — Activation Readiness Audit + Stage-Start
**Status:** STAGE-START COMPLETE — 2026-08-10
**Author:** Cursor / Sonnet 4.6 (audit and planning only — no source, runtime, or environment mutation)
**Date:** 2026-08-10

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-EXEC-01 |
| Title | Controlled Builder AI Execution Activation |
| Family | PRIVATE BETA / EXECUTION / ACTIVATION |
| Risk | HIGH — runtime, provider API call, billing credit, PM2 restart |
| Step 1 | Registration — COMPLETE — 2026-08-10 |
| Step 2 | Activation Readiness Audit + Stage-Start — THIS DOCUMENT |
| Step 3 | Controlled Builder Execution Activation + Runtime Validation — NOT STARTED |
| Step 4 | Consolidation / Checkpoint — NOT STARTED |

---

## 2. Current Starting State

| Property | State |
|----------|-------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — confirmed in `/opt/aisandbox/.env` and PM2 runtime env |
| `AI_PROVIDER` | `xai` — confirmed in `.env` and PM2 env |
| `XAI_API_KEY` | PRESENT (1 line in `.env`) |
| `PROVIDER_XAI_ENABLED` | `true` — confirmed |
| `PROVIDER_ANTHROPIC_ENABLED` | `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` — confirmed in `.env` and PM2 env |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` — confirmed in `.env` and PM2 env |
| `LAUNCH_STATE` | `INTERNAL` |
| `ABORT_MODE` | `NONE` |
| PM2: `aisandbox-api-gateway` | online — 217 restarts — 0 unstable — 25h uptime |
| PM2: `aisandbox-ai-service` | online — 3 restarts — 0 unstable — 27m uptime |
| PM2: `aisandbox-container-manager` | online — 0 restarts — 11D uptime |
| PM2: `aisandbox-frontend` | online — 9 restarts — 27h uptime |
| PM2: `aisandbox-ops-watchdog` | online — 0 restarts — 31m uptime |
| API Gateway readiness (`/api/health/ready`) | `status: "ready"` — env validated — db connected — killSwitches loaded — safetyLimits loaded |
| AI Service metrics (`/metrics`) | HTTP 200 |
| container-manager health (`/api/health`) | `status: "ok"` |
| Frontend (`https://staging.ainow.biz`) | HTTP 307 — healthy under approved 2xx/3xx rule |
| Prior controlled smoke | BILLING-READY-08 Step 4B — execution ID `83acc0e9-84de-4f94-9e41-294701e38393` — status: completed — tokens: 598 — xAI grok-4.5 — `GLOBAL_EXECUTION_ENABLED=false` verified after |
| Keith credit balance (post-prior-smoke) | 0 — burned in BILLING-READY-08 Step 4B smoke (500 credits deducted) |
| PRIVATE-BETA-INVITE-01 | Untouched / unregistered |

---

## 3. Authoritative Evidence Reviewed

| Document | Section(s) Read |
|----------|-----------------|
| `CLAUDE.md` | Full — workspace rules, governance, auth, checkpoint rules |
| `ARCHITECTURE.md` | §11 AI Execution Architecture, §12 Agent Harness Architecture, §5 Governance, §3 Service Architecture |
| `docs/PRIVATE-BETA-OPS-01-CHECKPOINT.md` | All — watchdog deployment, probe coverage, email delivery confirmation, final state |
| `docs/PRIVATE-BETA-DEPLOYMENT-READINESS-CHECKPOINT.md` | All — gate conditions, environment readiness, rollback path |
| `docs/BILLING-READY-08-CHECKPOINT.md` | All — controlled xAI smoke evidence, credit deduction, overflow accounting |
| `services/api-gateway/src/safety/kill-switch.config.ts` | Full — static getter mechanics, provider kill switches |
| `services/api-gateway/src/safety/execution-safety.guard.ts` | Full — guard chain behavior, 503 response |
| `services/api-gateway/src/startup/configuration.validator.ts` | Full — kill switch validation at startup |
| `services/api-gateway/src/startup/provider.validator.ts` | Full — provider startup validation, stub exception mechanics |
| `services/api-gateway/src/startup/production-guardrails.validator.ts` | Full — staging/production guardrails |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Guard stack at `POST /api/ai/execute` (line 388) |
| `services/api-gateway/src/billing/credit-balance.guard.ts` | Full — balance check, admin bypass |
| `services/ai-service/src/worker/worker.processor.ts` | Full — harness routing logic, useHarness condition |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Full — harness env flag parsing, defaults |
| `services/api-gateway/src/launch/launch.guard.ts` | Lines 75–107 — INTERNAL state, browser-session `isInternal: true` |
| `services/api-gateway/src/auth/session-or-api-key.guard.ts` | `browser-session` identity — `isInternal: true` confirmed |
| SSH staging read-only audit | `.env` values, PM2 env, health endpoints (see §11) |

---

## 4. GLOBAL_EXECUTION_ENABLED Dependency Map

### 4.1 Definition Location

| Property | Value |
|----------|-------|
| File | `/opt/aisandbox/.env` (staging) |
| Variable name | `GLOBAL_EXECUTION_ENABLED` |
| Current value | `false` |
| Format | String `"true"` / `"false"` — strict boolean validated at startup |

### 4.2 Read Locations — Authoritative Source

**File:** `services/api-gateway/src/safety/kill-switch.config.ts`

```typescript
static get GLOBAL_EXECUTION_ENABLED(): boolean {
  return process.env.GLOBAL_EXECUTION_ENABLED === 'true'; // Default: false (fail-safe)
}
```

This is a **static getter** — not a cached constant. It reads `process.env.GLOBAL_EXECUTION_ENABLED` on every invocation.

**Secondary reads (derived — same KillSwitchConfig):**
- `services/api-gateway/src/safety/execution-safety.guard.ts` — line 41: `if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED)`
- `services/api-gateway/src/startup/provider.validator.ts` — line 220: `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED === false` (stub exception check)
- `services/api-gateway/src/startup/configuration.validator.ts` — line 252: validates `GLOBAL_EXECUTION_ENABLED` boolean format at startup

### 4.3 Service / Component Dependency Map

| Service | Reads GLOBAL_EXECUTION_ENABLED | How | When | Effect |
|---------|-------------------------------|-----|------|--------|
| **API Gateway** | **YES** | `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED` static getter | Per-request (startup-time env, runtime read) | When false: HTTP 503 at `ExecutionSafetyGuard`, before queue/billing/quota. When true: guard passes |
| **AI Service** | **NO** | n/a | n/a | Unaffected — does not reference variable |
| **container-manager** | **NO** | n/a | n/a | Unaffected |
| **Frontend** | **NO** | n/a | n/a | No direct read; frontend sees 503 from API Gateway when false |

### 4.4 Startup-Time vs Runtime Semantics

The static getter reads `process.env.GLOBAL_EXECUTION_ENABLED` on each call — technically a runtime read.

**However**: in Node.js, `process.env` is populated from the process environment at startup. Editing `.env` on disk does **not** update `process.env` in a running process. PM2 populates process env at process start from the env file. To propagate a change:

1. Edit `/opt/aisandbox/.env` — change `GLOBAL_EXECUTION_ENABLED=false` → `GLOBAL_EXECUTION_ENABLED=true`
2. `pm2 restart aisandbox-api-gateway --update-env` — PM2 re-reads env file and injects updated env into new process

Without `--update-env`, the PM2 restart uses the cached env from the last start — the change would NOT take effect. Historical evidence confirms `--update-env` is the correct mechanism (04I3/04I3A runbooks; FR-04 readiness plan line 242).

### 4.5 Behavior When false

- `ExecutionSafetyGuard.canActivate()` → throws `ServiceUnavailableException('AI execution temporarily disabled for maintenance')` → HTTP 503
- This is **Check 1** in the guard — occurs before provider kill switch, before idempotency, before credit balance check, before quota, before any queue enqueue
- No usage_record is created; no BullMQ job is enqueued; no provider is called; no credit is consumed

### 4.6 Behavior When true

- `ExecutionSafetyGuard` passes Check 1
- Proceeds to Check 2: provider-specific kill switch (`PROVIDER_XAI_ENABLED=true` → passes)
- Proceeds to Check 3: global safety limits (rate/token/daily spend — large defaults, no risk for smoke)
- Proceeds to Check 4: increment execution counters
- Full guard chain then continues to `LaunchGuard` → `AbortGuard` → `IdempotencyGuard` → `CreditBalanceGuard` → `QuotaGuard` → `TokenQuotaGuard` → `RateLimitGuard` → controller body

---

## 5. Exact Activation Mechanics

### 5.1 Configuration Change

Edit (SSH to staging, single line change):

```bash
sed -i 's/^GLOBAL_EXECUTION_ENABLED=false$/GLOBAL_EXECUTION_ENABLED=true/' /opt/aisandbox/.env
```

**Verify change before restart:**

```bash
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected output: GLOBAL_EXECUTION_ENABLED=true
```

No other `.env` variable requires change. `AI_PROVIDER=xai`, `XAI_API_KEY`, and `PROVIDER_XAI_ENABLED=true` are already correctly set.

### 5.2 PM2 Restart

```bash
pm2 restart aisandbox-api-gateway --update-env
```

`--update-env` is mandatory. Without it, PM2 uses the cached startup env and the change does not take effect.

### 5.3 Verify Activation

Immediately after restart:

```bash
# Health check — expect status: "ready" and killSwitches.enabled count increases
curl -s http://127.0.0.1:4000/api/health/ready

# Verify PM2 runtime env picked up the change
pm2 env 3 | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: true
```

Pre-smoke: API Gateway should return `killSwitches: {total: 9, enabled: 2}` (GLOBAL_EXECUTION_ENABLED + PROVIDER_XAI_ENABLED both true).

---

## 6. Exact Restart / Reload Requirements

| Process | Action Required | Reason |
|---------|-----------------|--------|
| `aisandbox-api-gateway` | **`pm2 restart aisandbox-api-gateway --update-env`** | Sole consumer of `GLOBAL_EXECUTION_ENABLED` via `KillSwitchConfig` |
| `aisandbox-ai-service` | **No restart** | Does not reference `GLOBAL_EXECUTION_ENABLED`; already online and processing BullMQ queue |
| `aisandbox-container-manager` | **No restart** | Does not reference `GLOBAL_EXECUTION_ENABLED`; unaffected by gate change |
| `aisandbox-frontend` | **No restart** | Does not reference `GLOBAL_EXECUTION_ENABLED`; sees API result change (200 vs 503) without restart |
| `aisandbox-ops-watchdog` | **No restart** | Independent monitoring process; unaffected by execution gate change |

**Minimal restart: one process only — `aisandbox-api-gateway`.**

---

## 7. Secondary Safety Gates

| Gate | Variable | Current Staging Value | Classification |
|------|----------|-----------------------|----------------|
| Global execution kill switch | `GLOBAL_EXECUTION_ENABLED` | `false` (to be changed to `true` for smoke) | REQUIRED AND ACTIVE |
| xAI provider kill switch | `PROVIDER_XAI_ENABLED` | `true` | REQUIRED AND ACTIVE — already permits xAI |
| Anthropic provider kill switch | `PROVIDER_ANTHROPIC_ENABLED` | `false` | NOT APPLICABLE TO BUILDER SINGLE-SHOT (not used for smoke) |
| OpenAI provider kill switch | `PROVIDER_OPENAI_ENABLED` | not set (default: `true`) | NOT APPLICABLE TO BUILDER SINGLE-SHOT |
| Harness tool loop | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | GATED/OFF — Harness cannot activate |
| Harness write tools | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | GATED/OFF |
| Harness validation tools | `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | not set (default: `false`) | GATED/OFF |
| Harness browser smoke tool | `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | not set (default: `false`) | GATED/OFF |
| Billing charges (Stripe) | `BILLING_CHARGES_ENABLED` | `false` | REQUIRED AND ACTIVE — no real money flows |
| Credit balance guard | DB: `credit_balances.balance > 0` | **0 for Keith** (burned in prior smoke) | **REQUIRED BUT UNVERIFIED — PRECONDITION** (see §10) |
| Launch state guard | `LAUNCH_STATE=INTERNAL` | `INTERNAL` | REQUIRED AND ACTIVE — browser-session has `isInternal: true` → passes |
| Abort guard | `ABORT_MODE=NONE` | `NONE` | REQUIRED AND ACTIVE → passes |
| Global rate limit | `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | 10,000 | REQUIRED AND ACTIVE — single smoke far below limit |
| Max tokens per execution | `MAX_TOKENS_PER_EXECUTION` | 100,000 | REQUIRED AND ACTIVE — smoke prompt ~600 tokens, well within limit |
| Daily spend soft cap | `MAX_DAILY_SPEND_SOFT_USD` | $10,000 | REQUIRED AND ACTIVE — single smoke negligible cost |
| Daily spend hard cap | `MAX_DAILY_SPEND_HARD_USD` | $20,000 | REQUIRED AND ACTIVE — single smoke negligible cost |
| Idempotency guard | `Idempotency-Key` header | not set (fresh execution) | REQUIRED AND ACTIVE — fresh smoke has no prior duplicate |
| Quota guard | `browser-session` early-return | returns `true` early | REQUIRED AND ACTIVE (BILLING-READY-08A) |
| Session ownership | authenticated user = session owner | Keith's session | REQUIRED AND ACTIVE |

---

## 8. Harness Separation Evidence

### 8.1 Worker Routing Logic

Source: `services/ai-service/src/worker/worker.processor.ts`, lines 754–755:

```typescript
const useHarness =
  job.data.harnessVersion === 'v1' &&
  DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop;
```

Harness path requires **both** conditions to be true simultaneously:

1. **`job.data.harnessVersion === 'v1'`** — must be explicitly set in the BullMQ job payload by the API Gateway (frontend must request harness execution)
2. **`DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop === true`** — requires `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` in AI Service environment at startup

### 8.2 Current Staging Harness State

| Condition | Staging State |
|-----------|---------------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` — confirmed in `.env` AND PM2 runtime env (pm2 env id=0) |
| `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` | `false` — parsed from env by `parseStrictBooleanEnv()` at AI Service startup |
| Net `useHarness` result | **Always `false` regardless of `job.data.harnessVersion`** |

### 8.3 Separation Verdict

**Enabling `GLOBAL_EXECUTION_ENABLED=true` CANNOT and DOES NOT activate the Agent Harness multi-turn tool loop.**

`GLOBAL_EXECUTION_ENABLED` is checked exclusively in the API Gateway (`ExecutionSafetyGuard`). The Harness routing decision is made entirely in the AI Service `WorkerProcessor` using a separate, independent double-gate (`harnessVersion` field + `enableToolLoop` env flag).

These are fully decoupled:

- `GLOBAL_EXECUTION_ENABLED` gate: API Gateway, pre-queue, controls whether any execution reaches the queue at all
- Harness gate: AI Service, post-queue, controls which execution path the worker takes for jobs that did reach the queue

**Harness separation guarantee: CONFIRMED. No code change needed.**

---

## 9. Provider Readiness

| Property | Value | Source |
|----------|-------|--------|
| Provider | `xai` | `/opt/aisandbox/.env` — `AI_PROVIDER=xai` |
| Provider kill switch | `PROVIDER_XAI_ENABLED=true` | `.env` and PM2 env (id=3) |
| API key variable | `XAI_API_KEY` | PRESENT — 1 line in `.env` |
| Provider model | `grok-4.5` — selected by frontend during smoke | Historical evidence: prior smoke used grok-4.5 at user's browser selection |
| Provider validator outcome at restart | PASS — `AI_PROVIDER=xai` with `XAI_API_KEY` PRESENT satisfies `ProviderValidator.validateProviderConfiguration()` for staging |
| Stub exception | Not applicable — `AI_PROVIDER=xai` (not `stub`) |
| Critical startup constraint | **No issue** — `AI_PROVIDER=xai` already set; changing only `GLOBAL_EXECUTION_ENABLED` does not trigger the `stub + execution enabled` crash condition documented in FR-04 readiness plan |

**Historical execution evidence:**
- Execution ID: `83acc0e9-84de-4f94-9e41-294701e38393`
- Provider: xai
- Model: grok-4.5
- Status: completed
- tokens_used: 598
- File action: `smoke-test.txt` created successfully
- This is historical evidence only; current configuration names/state verified independently above.

**Provider readiness: CONFIRMED.**

---

## 10. Billing / Credit / Quota Readiness

### 10.1 Billing Architecture

| Property | Value |
|----------|-------|
| `BILLING_CHARGES_ENABLED` | `false` — no Stripe charges |
| Credit system | Internal credits (DB: `credit_balances`, `credit_deduction_records`) — active |
| Credit deduction path | Post-execution: `PersistentCreditDeductionGateway` → `POST /api/internal/executions/:id/finalize-accounting` |
| Deduction formula | `appliedCredits = min(tokensUsed, availableBalance)`; `overflow = max(tokensUsed - balance, 0)` |
| Overflow behavior | Accepted by design — balance cannot go negative; overflow is accepted platform loss in private-beta (per BILLING-READY-08 §4) |

### 10.2 CreditBalanceGuard Behavior

From `services/api-gateway/src/billing/credit-balance.guard.ts`:

- **Admin users (`UserRole.ADMIN`)**: bypass balance check — line 58: `if (user?.role === UserRole.ADMIN) { return true; }`
- **Regular users**: `creditBalance.balance > 0` required — throws HTTP 402 if missing or zero

### 10.3 CRITICAL PRECONDITION: Keith's Credit Balance

The prior controlled smoke (BILLING-READY-08 Step 4B) deducted 500 credits from Keith's balance, bringing it from 500 → 0.

**Before executing the Step 3 smoke:**

Keith must EITHER be confirmed as `UserRole.ADMIN` (bypasses credit check) OR his credit balance must be provisioned/replenished to > 0 via the admin console.

This **must be verified before activating the execution gate**.

| Path | Requirement | Action |
|------|-------------|--------|
| Keith's role is `ADMIN` | No credit action needed | Verify via admin console profile / DB role column |
| Keith's role is regular user | `credit_balances.balance > 0` required | Grant credits via admin console before smoke |

### 10.4 What Step 3 Must Verify Before Smoke

1. **Pre-activation:** Verify Keith's user role or credit balance is non-zero (browser: admin console or user profile)
2. **Post-smoke:** Confirm `usage_records` shows `execution_status = 'completed'` for the new smoke execution ID (browser or staging API)
3. **Post-smoke:** Confirm `credit_deduction_records` contains a row with `source_event_id = <new executionId>` (browser: admin credit view, or API)

---

## 11. Watchdog / Readiness Status

### 11.1 Watchdog Operational State

Verified read-only via `ssh aisandbox-staging pm2 describe aisandbox-ops-watchdog`:

| Property | Value |
|----------|-------|
| PM2 process name | `aisandbox-ops-watchdog` |
| Status | **online** |
| Restarts | **0** |
| Unstable restarts | 0 |
| Uptime at audit time | 31m |

Watchdog state: **CONFIRMED HEALTHY.**

No crash loop. No alert condition. Per PRIVATE-BETA-OPS-01 checkpoint: watchdog probes API Gateway readiness, AI Service metrics, Frontend, container-manager, and Redis every 60 seconds. All five probes were healthy at audit time (confirmed via API Gateway readiness 200, AI Service 200, container-manager 200, frontend 307).

### 11.2 Live Staging Health Baseline (Audit Time: 2026-08-10T08:20Z)

| Endpoint | Method | Result |
|----------|--------|--------|
| `http://127.0.0.1:4000/api/health/ready` | GET | `{"status":"ready","environment":"production","checks":{"environment":"validated","database":"connected","killSwitches":"loaded","safetyLimits":"loaded"},"killSwitches":{"total":9,"enabled":1}}` |
| `http://127.0.0.1:4001/metrics` | GET | HTTP 200 (AI Service liveness) |
| `http://127.0.0.1:4002/api/health` | GET | `{"status":"ok","service":"container-manager"}` |
| `https://staging.ainow.biz` | GET | HTTP 307 (frontend healthy under approved rule) |

Note: `killSwitches.enabled: 1` reflects only `PROVIDER_XAI_ENABLED=true` active out of 9 switches. After `GLOBAL_EXECUTION_ENABLED=true` + restart, expect `enabled: 2`.

---

## 12. Pre-Activation Health Checklist

These checks must pass **before** editing `.env` or restarting any process in Step 3.

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | API Gateway readiness | `curl http://127.0.0.1:4000/api/health/ready` | `"status":"ready"` |
| 2 | AI Service liveness | `curl http://127.0.0.1:4001/metrics` | HTTP 200 |
| 3 | container-manager health | `curl http://127.0.0.1:4002/api/health` | `"status":"ok"` |
| 4 | Frontend reachability | `curl -s -o /dev/null -w '%{http_code}' https://staging.ainow.biz` | 2xx or 3xx |
| 5 | Watchdog online | `pm2 list` → `aisandbox-ops-watchdog` | status: online, ↺ stable |
| 6 | No PM2 crash loops | `pm2 list` → all 5 processes | status: online, unstable restarts: 0 |
| 7 | Keith credit balance or admin role | Browser (admin console) | balance > 0 OR role = ADMIN |
| 8 | `GLOBAL_EXECUTION_ENABLED` confirms false | `grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env` | `=false` |

---

## 13. Exact Controlled Builder Execution Design

### 13.1 Smoke Parameters

| Field | Value |
|-------|-------|
| Execution type | Single-shot Builder (plain path — `useHarness=false`) |
| Provider | xAI (grok-4.5 — same as prior proven smoke) |
| Token budget | ~600–800 tokens estimated (low — similar to prior smoke) |
| Isolation | Isolated workspace session — Keith's own staging workspace |
| File artifact | **New unique file** — `beta-activation-smoke-2026-08-10.txt` |
| File artifact is distinct from | `smoke-test.txt` (prior smoke artifact — must not reuse) |

### 13.2 Exact Prompt

> Create a file called `beta-activation-smoke-2026-08-10.txt` with the following content:
>
> `PRIVATE-BETA-EXEC-01 activation smoke PASS — 2026-08-10`
>
> Do not modify any other file.

### 13.3 Execution Path

Per ARCHITECTURE.md §11.1:

1. Keith (browser) sends `POST /api/ai/execute` with session ID, the above prompt, xAI/grok-4.5 selected
2. API Gateway: guard chain runs — `ExecutionSafetyGuard` (now passes with `GLOBAL_EXECUTION_ENABLED=true`) → all other guards
3. API Gateway: `INSERT usage_records (status='pending')` — records intent
4. API Gateway: BullMQ enqueue → `ai-execution` queue (Redis)
5. API Gateway: returns 202 `{executionId, status: 'queued'}`
6. AI Service WorkerProcessor: claims job from queue
7. Worker: evaluates `useHarness` — `job.data.harnessVersion !== 'v1'` OR `enableToolLoop === false` → **plain single-shot path**
8. Worker: `AIExecutionService.execute()` → xAI adapter → provider API
9. Provider returns response with `file-actions` block: `create beta-activation-smoke-2026-08-10.txt`
10. Worker: parses file actions, publishes to Redis Pub/Sub, updates `usage_records (status='completed')`
11. Worker: `POST /api/internal/executions/:id/finalize-accounting` → credit deduction
12. Frontend: SSE stream receives file-action events → applies file creation to workspace → tree/editor/preview refresh

### 13.4 Expected Success Evidence

| Evidence | What to Check | Where |
|----------|---------------|-------|
| File created | `beta-activation-smoke-2026-08-10.txt` exists in workspace file tree | Browser: workspace editor / file tree |
| File content | `PRIVATE-BETA-EXEC-01 activation smoke PASS — 2026-08-10` | Browser: open the file in editor |
| Persists after refresh | File and content survive browser page refresh | Browser: refresh and re-check |
| Execution record | `usage_records` row with `execution_status='completed'`, `provider='xai'`, `tokens_used > 0` | Admin console or staging API |
| No other files changed | Only `beta-activation-smoke-2026-08-10.txt` created | Workspace file tree review |

---

## 14. Expected Persistence Evidence

| Evidence Type | Source | Value to Confirm |
|---------------|--------|-----------------|
| Workspace file | Browser file tree | `beta-activation-smoke-2026-08-10.txt` present |
| Execution status | Admin console → usage_records | `execution_status = 'completed'` |
| tokens_used | Admin console → usage_records | Non-zero (expect ~600–800 range) |
| Provider | Admin console → usage_records | `xai` |

---

## 15. Expected Billing / Usage Evidence

| Evidence Type | Source | Value to Confirm |
|---------------|--------|-----------------|
| Credit deduction record exists | Admin console → credit_deduction_records | `source_event_id` = smoke executionId |
| `applied_credits` | credit_deduction_records | Non-zero (≤ available balance or ≤ tokens_used) |
| `status` | credit_deduction_records | `applied` |
| No Stripe charge | External | n/a — `BILLING_CHARGES_ENABLED=false` |

**Important note on overflow:** If Keith's balance is 0 and he is a regular user (not admin), the smoke will fail at `CreditBalanceGuard` with HTTP 402 — not a provider call. Credits must be provisioned first. If Keith is admin, the check is bypassed and credit deduction may record overflow (accepted by design). Verify user role or balance before proceeding.

---

## 16. Browser / Manual Keith Validation Boundary

### 16.1 What Cursor Can Perform via Staging SSH

| Action | Cursor SSH Capable |
|--------|-------------------|
| Edit `/opt/aisandbox/.env` (one line change) | YES — SSH |
| `pm2 restart aisandbox-api-gateway --update-env` | YES — SSH |
| Verify PM2 env picked up change | YES — `pm2 env 3 | grep GLOBAL_EXECUTION_ENABLED` |
| Pre/post health checks (curl) | YES — SSH |
| Verify PM2 process status post-restart | YES — `pm2 list` / `pm2 describe` |
| Rollback `.env` change | YES — SSH |

### 16.2 What Keith Must Confirm via Browser

| Action | Keith Required | URL / Location | Expected Result |
|--------|---------------|----------------|-----------------|
| **PRE-SMOKE: Credit balance / admin role** | **YES** | `https://staging.ainow.biz` → admin console OR user profile | Balance > 0 OR admin bypass confirmed |
| Submit the smoke prompt | YES | `https://staging.ainow.biz/[locale]/app` — workspace Builder | Execution accepted (no 503/402) |
| Verify SSE stream completes (no stuck spinner) | YES | Browser: execution streaming indicator | Completes without error |
| Verify file `beta-activation-smoke-2026-08-10.txt` created | YES | Browser: workspace file tree | File appears |
| Verify file content | YES | Browser: click to open file | Content = `PRIVATE-BETA-EXEC-01 activation smoke PASS — 2026-08-10` |
| Verify file persists after refresh | YES | Browser: page refresh | File still present |
| Verify admin credit deduction record | YES (if accessible) | Admin console → credit_deduction_records | Row with smoke executionId |

Keith browser work is minimal and bounded to these steps. Cursor handles all SSH/PM2/env work.

---

## 17. Recommended Final Gate State (Post Step 3)

### Recommendation: Option A — Leave `GLOBAL_EXECUTION_ENABLED=true`

**Rationale:**

1. Step 3 is not merely a temporary smoke. It is the gateway for the subsequent Keith full end-to-end staging journey (the next planned task).
2. The Keith E2E journey requires execution to be active. Restoring `false` after Step 3 and then re-enabling for the E2E journey creates unnecessary configuration churn (`.env` edit + PM2 restart twice) and doubles the risk surface.
3. The watchdog is operational and will detect any service degradation.
4. `BILLING_CHARGES_ENABLED=false` — no financial risk from leaving execution enabled.
5. `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` — Harness remains gated regardless of execution gate state.
6. `LAUNCH_STATE=INTERNAL` — only Keith (browser-session, `isInternal: true`) can reach the execution endpoint; no public exposure.

**Condition for Option A:** Step 3 smoke must PASS completely (file created, persists, credit deduction recorded, no watchdog alert, no service degradation).

**If smoke fails or any watchdog alert fires:** Roll back immediately to `GLOBAL_EXECUTION_ENABLED=false` before Keith E2E journey. Re-evaluate blockers before proceeding.

---

## 18. Rollback Triggers

Rollback must be executed immediately if any of the following occur after activation:

| Trigger | Description |
|---------|-------------|
| API Gateway crash / restart loop | PM2 shows `aisandbox-api-gateway` restarting repeatedly after `--update-env` |
| Provider startup failure | API Gateway fails to start (provider validator rejects config) |
| Readiness check fails post-restart | `/api/health/ready` returns non-200 or `"status":"not ready"` |
| AI Service crash / restart loop | PM2 shows `aisandbox-ai-service` restarting repeatedly |
| Watchdog alert fired | Email received at `alerts@ainow.biz` indicating component failure |
| Smoke fails with 503 | Execution gate still blocked (env change not picked up — verify PM2 env) |
| Smoke fails with 402 | Credit balance is 0 and Keith is not admin — replenish credits, then retry |
| Provider call error | xAI API failure — check staging logs |
| Harness routing detected | Log shows `selectedPath: 'harness'` — STOP immediately |
| File action not applied | File not created in workspace after completed execution |
| Billing accounting failure | Credit deduction record missing after completed execution |
| Unexpected service degradation | Any staging endpoint returning unexpected error codes |

---

## 19. Exact Rollback Procedure

If rollback is required:

```bash
# Step R1: Revert .env
sed -i 's/^GLOBAL_EXECUTION_ENABLED=true$/GLOBAL_EXECUTION_ENABLED=false/' /opt/aisandbox/.env

# Step R2: Verify revert
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# Step R3: Restart API Gateway with updated env
pm2 restart aisandbox-api-gateway --update-env

# Step R4: Verify PM2 picked up change
pm2 env 3 | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: false

# Step R5: Verify API Gateway readiness
curl -s http://127.0.0.1:4000/api/health/ready
# Expected: "status":"ready", killSwitches.enabled back to 1

# Step R6: Verify API Gateway refuses execution (returns 503)
# Keith can confirm via browser — any attempt to execute should return "temporarily disabled" message
```

**No DB rollback is required** to disable execution. Changing `GLOBAL_EXECUTION_ENABLED=false` and restarting API Gateway is the complete rollback.

If any credit deduction occurred during a failed smoke, that is recorded as accounting evidence — not reversed (accepted by design; BILLING_CHARGES_ENABLED=false means no real money moved).

---

## 20. Step 3 Files / Config / Runtime Surfaces Affected

| Surface | Change | Reversible |
|---------|--------|-----------|
| `/opt/aisandbox/.env` | `GLOBAL_EXECUTION_ENABLED=false` → `true` | YES — one-line revert |
| PM2 `aisandbox-api-gateway` runtime env | Updated via `--update-env` | YES — rollback procedure |
| PostgreSQL `usage_records` | New row inserted for smoke execution | Audit record — not reversed |
| PostgreSQL `credit_deduction_records` | New row for smoke credit deduction | Audit record — not reversed |
| Workspace filesystem | `beta-activation-smoke-2026-08-10.txt` created | Disposable smoke artifact — can be deleted |

All other services, configs, source files, and infrastructure: **unchanged.**

---

## 21. Explicit Exclusions

The following are explicitly outside Step 3 scope:

- Any source code change
- Any test change
- Any migration
- Any Docker action
- Any `AGENT_HARNESS_ENABLE_*` flag change
- Enabling real Stripe billing (`BILLING_CHARGES_ENABLED=true`)
- Changing `LAUNCH_STATE`
- Enabling Anthropic or any other provider
- Registering PRIVATE-BETA-INVITE-01
- Registering the Keith E2E staging journey task
- Multi-agent ainow.biz beta execution
- Any Harness multi-turn execution
- Any `pm2 restart` other than `aisandbox-api-gateway`
- Any infrastructure change beyond the single `.env` line edit

---

## 22. Step 3 Acceptance Criteria

| # | Criterion | Method |
|---|-----------|--------|
| 1 | Pre-activation health checks all pass | SSH curl checks |
| 2 | Keith's credit balance verified > 0 OR admin bypass confirmed | Browser: admin console |
| 3 | `/opt/aisandbox/.env` updated: `GLOBAL_EXECUTION_ENABLED=true` | SSH: grep verify |
| 4 | `pm2 restart aisandbox-api-gateway --update-env` executed | SSH |
| 5 | PM2 runtime env confirms `GLOBAL_EXECUTION_ENABLED: true` | SSH: `pm2 env 3` |
| 6 | API Gateway readiness returns `status: "ready"` post-restart | SSH: curl |
| 7 | `killSwitches.enabled: 2` (GLOBAL + XAI both enabled) | API health response |
| 8 | AI Service online and stable post-restart | SSH: `pm2 list` |
| 9 | Watchdog online and stable post-restart | SSH: `pm2 list` |
| 10 | Smoke prompt submitted via Keith's browser | Browser |
| 11 | Execution accepted (HTTP 202, executionId returned) | Browser |
| 12 | Execution completes (no spinner stuck, SSE completes) | Browser |
| 13 | File `beta-activation-smoke-2026-08-10.txt` present in workspace | Browser file tree |
| 14 | File content = `PRIVATE-BETA-EXEC-01 activation smoke PASS — 2026-08-10` | Browser editor |
| 15 | File persists after browser refresh | Browser |
| 16 | `usage_records` row: `execution_status='completed'`, `provider='xai'`, `tokens_used > 0` | Admin console / staging API |
| 17 | Credit deduction record exists: `source_event_id = <executionId>`, `status='applied'` | Admin console |
| 18 | No watchdog alert fired during smoke window | Email: `alerts@ainow.biz` — no alert received |
| 19 | No harness routing in AI Service logs | SSH: `pm2 logs aisandbox-ai-service` → no `selectedPath: 'harness'` |
| 20 | `GLOBAL_EXECUTION_ENABLED=true` left in place (Option A) | SSH: grep confirm |
| 21 | Only `aisandbox-api-gateway` restarted | PM2 list: other processes unchanged |
| 22 | PRIVATE-BETA-INVITE-01 untouched | Governance: no registration |
| 23 | No source code changed | Git status: no modifications |

---

## 23. Keith Approval / Interaction Boundaries

| Action | Keith Role | Status |
|--------|-----------|--------|
| Authorize PRIVATE-BETA-EXEC-01 task | **Required** | GIVEN — Step 1 registration approved |
| Authorize `.env` change + PM2 restart | **Required** | WITHIN the already-authorized bounded activation workflow — no additional approval needed |
| Verify credit balance / admin role (browser) | **Required** | Pre-smoke prerequisite |
| Execute the smoke prompt (browser) | **Required** | Keith must manually submit the prompt |
| Verify file creation and content (browser) | **Required** | Keith must confirm via browser |
| Verify no watchdog alert | **Required** | Monitor `alerts@ainow.biz` |
| Authorize leaving `GLOBAL_EXECUTION_ENABLED=true` (Option A) | **Implicitly covered** | Covered by activation authorization — Keith's E2E journey follows immediately |
| Register next task (Keith E2E journey) | **Required — separate step** | Not registered during PRIVATE-BETA-EXEC-01 |

Keith does not need a new explicit approval for Step 3 beyond the already-authorized PRIVATE-BETA-EXEC-01 bounded activation workflow. However, Keith must confirm the credit balance / admin bypass precondition is satisfied before the smoke begins.

---

## 24. Newly Discovered Information

| Item | Finding |
|------|---------|
| API Gateway restart count (217) | Historical — reflects all prior deployments. `unstable restarts: 0` — no crash loop concern |
| AI Service restart count (3) | Consistent with OPS-01 controlled outage test (stop + restart = ~2 restarts) |
| `killSwitches.enabled: 1` in health response | Expected — only `PROVIDER_XAI_ENABLED=true` active; `GLOBAL_EXECUTION_ENABLED=false` contributes 0 |
| `PROVIDER_ANTHROPIC_ENABLED=false` | Anthropic explicitly disabled — xAI is sole enabled real provider |
| `LAUNCH_STATE=INTERNAL` + browser-session `isInternal: true` | LaunchGuard passes for browser session — no additional configuration needed |
| `ABORT_MODE=NONE` | AbortGuard passes — no abort restriction active |
| **Credit balance at 0 for Keith** | **KEY PRECONDITION** — must verify admin role bypass OR replenish credits before smoke |

---

## 25. Step 3 Requires Source Changes?

**NO.** All findings confirm that Step 3 is a pure runtime/configuration action:

- Edit one line in `/opt/aisandbox/.env` on staging
- Restart one PM2 process with `--update-env`
- Execute smoke via browser
- Verify evidence

No source code defect was discovered during this audit that would block safe activation.

---

## 26. Final Readiness Verdict

**READY WITH SPECIFIC PRECONDITIONS**

The platform is structurally ready for controlled Builder single-shot execution activation. All safety gates are confirmed, Harness is fully separated, provider is configured, watchdog is operational, and health baseline is healthy.

**Mandatory preconditions before Step 3 execution begins:**

| # | Precondition | Status |
|---|-------------|--------|
| 1 | Verify Keith's user is `UserRole.ADMIN` OR credit balance `> 0` | **MUST BE VERIFIED VIA BROWSER** |
| 2 | If Keith is regular user with balance = 0, grant credits via admin console | **CONDITIONAL — only if not admin** |

These preconditions can be resolved in minutes via the admin console without any code or config change. Once satisfied, the platform is **READY FOR CONTROLLED ACTIVATION**.

---

## 27. Exact Next Step

**Step 3 — Controlled Builder Execution Activation + Runtime Validation**

Sequenced actions:

1. SSH to staging — run pre-activation health checklist (§12)
2. Keith: browser — verify credit balance / admin role (§10.3)
3. Keith (if regular user with balance = 0): admin console — grant credits (e.g. replenish to 500)
4. SSH — edit `.env`: `GLOBAL_EXECUTION_ENABLED=false` → `true`
5. SSH — verify edit: `grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env`
6. SSH — `pm2 restart aisandbox-api-gateway --update-env`
7. SSH — verify PM2 env: `pm2 env 3 | grep GLOBAL_EXECUTION_ENABLED`
8. SSH — curl API Gateway readiness (expect `enabled: 2`)
9. SSH — verify AI Service and watchdog stable: `pm2 list`
10. Keith: browser — submit smoke prompt at `https://staging.ainow.biz/[locale]/app`
11. Keith: browser — verify file created, correct content, persists after refresh
12. Keith: browser — confirm no error at execution time
13. SSH — verify no harness routing in AI Service logs: `pm2 logs aisandbox-ai-service --lines 50 | grep harness`
14. Keith: email — confirm no watchdog alert received at `alerts@ainow.biz`
15. Keith: browser / admin console — verify execution record and credit deduction
16. SSH — confirm `GLOBAL_EXECUTION_ENABLED=true` left in place (Option A)
17. Record all evidence in Step 4 consolidation checkpoint

---

*Stage-Start created: 2026-08-10 — PRIVATE-BETA-EXEC-01 Step 2 — Audit and Planning only — no source, runtime, environment, or DB mutation occurred during this step.*
