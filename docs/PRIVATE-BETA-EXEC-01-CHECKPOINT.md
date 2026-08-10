# PRIVATE-BETA-EXEC-01-CHECKPOINT.md
## PRIVATE-BETA-EXEC-01 — Controlled Builder AI Execution Activation — Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-EXEC-01  
**Title:** Controlled Builder AI Execution Activation  
**Status:** COMPLETE AND LOCKED — 2026-08-10  
**Family:** PRIVATE BETA / BUILDER / EXECUTION ACTIVATION / SAFETY GATE  
**Nature:** CONTROLLED STAGING RUNTIME / SAFETY-GATE ACTIVATION  
**Workflow:** 4-step HIGH-risk controlled activation lifecycle  
**Closed:** 2026-08-10  
**Predecessor:** PRIVATE-BETA-OPS-01 COMPLETE AND LOCKED — 2026-08-10 — Checkpoint: `docs/PRIVATE-BETA-OPS-01-CHECKPOINT.md`  
**Stage-start:** `docs/PRIVATE-BETA-EXEC-01-STAGE-START.md`  
**Author:** Cursor / Grok 4.5 (Step 4 consolidation only)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-EXEC-01 |
| Title | Controlled Builder AI Execution Activation |
| Priority | P1 — required after operational visibility; before Keith full E2E staging journey |
| Risk | HIGH — runtime, provider API call, billing credit, PM2 restart |
| Cohort | Builder-first private beta — approximately 1–3 trusted users |
| Execution path | Existing Builder single-shot (plain) only |
| Invite posture | PRIVATE-BETA-INVITE-01 remains untouched / unregistered |

---

## 2. Purpose

Safely activate the **existing** Builder AI single-shot execution path on staging by flipping `GLOBAL_EXECUTION_ENABLED` from `false` to `true`, under tightly controlled conditions, with:

- operational watchdog already staging-proved (PRIVATE-BETA-OPS-01)
- Harness remaining disabled
- Stripe charging remaining disabled
- exactly one controlled real-provider smoke
- known immediate rollback to `false`

This is **not** a new AI execution architecture. It is controlled operational activation of an already-implemented and historically proven path (BILLING-READY-08).

---

## 3. Starting State

At Step 1 registration / Step 2 stage-start baseline:

| Property | Starting state |
|----------|----------------|
| `GLOBAL_EXECUTION_ENABLED` | `false` (intentional safety gate, not a defect) |
| Harness tool loop / write tools | both `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AI_PROVIDER` | `xai` |
| `PROVIDER_XAI_ENABLED` | `true` |
| `XAI_API_KEY` | PRESENT |
| Watchdog (`aisandbox-ops-watchdog`) | online; restart count 0 |
| PRIVATE-BETA-OPS-01 | COMPLETE AND LOCKED — P1 operational visibility SATISFIED |
| PRIVATE-BETA-INVITE-01 | untouched / unregistered |
| Prior historical smoke | BILLING-READY-08 — execution `83acc0e9-84de-4f94-9e41-294701e38393` — then gate restored to `false` |

---

## 4. Step 2 Readiness Findings

Stage-start artifact: `docs/PRIVATE-BETA-EXEC-01-STAGE-START.md` — COMPLETE — 2026-08-10.

Key readiness verdict: **READY WITH SPECIFIC PRECONDITIONS**.

| Finding | Result |
|---------|--------|
| Gate location | `/opt/aisandbox/.env` → `GLOBAL_EXECUTION_ENABLED`; read by API Gateway `KillSwitchConfig` static getter only |
| Services consuming gate | **API Gateway only** (AI Service / container-manager / frontend / watchdog do not read it) |
| Restart requirement | `pm2 restart aisandbox-api-gateway --update-env` only (`--update-env` mandatory) |
| Secondary gates | Provider kill switches, harness flags, billing charges, launch/abort, credit/quota/rate limits inventoried |
| Harness separation | Confirmed — `GLOBAL_EXECUTION_ENABLED` cannot activate Harness |
| Provider readiness | xAI configured; key PRESENT; `PROVIDER_XAI_ENABLED=true` |
| Credit precondition | Keith balance must be `> 0` OR admin bypass before smoke |
| Watchdog | Healthy baseline confirmed |
| Source changes required for Step 3? | **NO** |

Mandatory Step 3 precondition: Keith credit balance `> 0` (confirmed before activation).

---

## 5. Activation Mechanics

Exact activation (staging):

1. Edit only `/opt/aisandbox/.env`: `GLOBAL_EXECUTION_ENABLED=false` → `true`
2. Restart only: `pm2 restart aisandbox-api-gateway --update-env`
3. Verify PM2 runtime env: `GLOBAL_EXECUTION_ENABLED=true`
4. Verify API Gateway readiness PASS

No other `.env` variables changed. No other PM2 processes restarted for activation.

---

## 6. Services Affected

| Service | Activation impact |
|---------|-------------------|
| `aisandbox-api-gateway` | **Restarted once per activation attempt** with `--update-env` — sole gate consumer |
| `aisandbox-ai-service` | Not restarted for gate flip; processed smoke via existing plain path |
| `aisandbox-container-manager` | Unaffected |
| `aisandbox-frontend` | Unaffected (observes API behavior change only) |
| `aisandbox-ops-watchdog` | Unaffected; remained online |

---

## 7. Safety Gates

| Gate | State during/after Step 3 |
|------|---------------------------|
| `GLOBAL_EXECUTION_ENABLED` | Activated to `true` (final state left enabled — Option A) |
| `PROVIDER_XAI_ENABLED` | `true` (unchanged) |
| `PROVIDER_ANTHROPIC_ENABLED` | `false` (unchanged) |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` (unchanged) |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` (unchanged) |
| `BILLING_CHARGES_ENABLED` | `false` (unchanged) |
| Credit balance guard | Active — Keith balance `> 0` precondition satisfied |
| Launch / abort / rate / token / daily spend limits | Intact |
| Watchdog probes | Intact and healthy |

---

## 8. Harness Separation

Harness remained fully separated from Builder single-shot activation.

Runtime smoke evidence:

| Field | Value |
|-------|-------|
| `harnessVersion` | `null` |
| `enableToolLoop` | `false` |
| `selectedPath` | `"plain"` |

- Harness tool loop did **not** activate
- Harness write-tools did **not** activate
- Enabling `GLOBAL_EXECUTION_ENABLED` did **not** enable Harness

---

## 9. Provider Readiness

| Property | Evidence |
|----------|----------|
| Provider | `xai` |
| Provider kill switch | `PROVIDER_XAI_ENABLED=true` |
| API key | PRESENT (not exposed) |
| Path used | plain single-shot Builder |
| Smoke result | PASS |

---

## 10. Credit / Billing Prerequisite

| Prerequisite | Status |
|--------------|--------|
| Keith credit balance `> 0` | **CONFIRMED by Keith** before activation |
| Pre-activation services/health | All PASS |
| Initial gate | `GLOBAL_EXECUTION_ENABLED=false` |
| Harness flags | both false |
| xAI provider configuration | ready |
| Watchdog | online; restart count 0 |

---

## 11. Pre-Activation Health Evidence

Pre-activation checklist PASS:

- API Gateway ready
- AI Service `/metrics` healthy
- container-manager healthy
- frontend healthy (approved 2xx/3xx)
- Redis watchdog probe healthy
- watchdog online; no crash loop
- gate confirmed `false` before first activation edit

---

## 12. First Activation Transient Readiness Event

The **first** activation attempt (`GLOBAL_EXECUTION_ENABLED=false → true` + `aisandbox-api-gateway --update-env`) produced an **immediate transient readiness/connect failure** after API Gateway restart.

This matched the predefined Step 2 rollback criteria (post-restart readiness failure).

**Classification:** expected safety-policy trigger — **not** a task failure.

---

## 13. Temporary Rollback Execution

Because the transient readiness failure matched predefined rollback criteria, the rollback path was executed immediately:

1. Restore execution gate to `GLOBAL_EXECUTION_ENABLED=false` in `/opt/aisandbox/.env`
2. Restart `aisandbox-api-gateway --update-env`
3. Reverify health / stability

**This temporary rollback demonstrates that the defined safety policy and rollback path operated correctly.**

Do **not** describe this event as a failed PRIVATE-BETA-EXEC-01 outcome.

---

## 14. Recovery / Stability Confirmation

After temporary rollback:

- health/stability reverified
- staging returned to a stable baseline suitable for reactivation
- no crash loop persisted
- watchdog remained online

---

## 15. Successful Reactivation Evidence

After stability confirmation:

1. Reactivation applied: `GLOBAL_EXECUTION_ENABLED=false → true`
2. Only `aisandbox-api-gateway --update-env` restarted
3. Final API Gateway runtime state: `GLOBAL_EXECUTION_ENABLED=true`
4. Readiness: **PASS**

Step 3 continued successfully after reactivation.

---

## 16. Controlled Builder Smoke

Keith manually submitted **exactly one** smoke prompt after successful reactivation.

| Field | Value |
|-------|-------|
| Artifact file | `beta-activation-smoke-2026-08-10.txt` |
| Exact content | `PRIVATE-BETA-EXEC-01 activation smoke PASS — 2026-08-10.` |
| Result | **PASS** |

---

## 17. Exact Execution ID

`24acd697-b55c-40d0-b2d5-32faf9b85709`

---

## 18. Provider / Path / Token Evidence

| Field | Value |
|-------|-------|
| Provider | `xai` |
| Execution path | `plain` |
| Harness | NOT used |
| Tokens | `1078` |
| Result | PASS |

---

## 19. File / Action Evidence

Created:

- `beta-activation-smoke-2026-08-10.txt`

Exact content:

- `PRIVATE-BETA-EXEC-01 activation smoke PASS — 2026-08-10.`

Keith confirmed:

- execution completed successfully in UI
- file appeared
- exact content correct
- no unrelated visible file changes

---

## 20. Persistence Evidence

Keith confirmed file and content **persisted after browser refresh**.

---

## 21. Accounting / Credit Evidence

For the same execution ID `24acd697-b55c-40d0-b2d5-32faf9b85709`:

| Field | Value |
|-------|-------|
| finalize-accounting | executed |
| credit deduction | persisted |
| `appliedCredits` | `1078` |
| `overflowCredits` | `0` |
| `balanceBefore` | `6000` |
| `balanceAfter` | `4922` |

---

## 22. Billing / Stripe State

| Field | Value |
|-------|-------|
| `BILLING_CHARGES_ENABLED` | `false` |
| Stripe charge path | **not active** |
| Real-money charge | none |

Internal credit accounting operated; no Stripe charge occurred.

---

## 23. Post-Smoke Health Evidence

Post-smoke health:

- API Gateway ready
- AI Service `/metrics` 200
- container-manager healthy
- frontend 307 / healthy
- Redis watchdog probe healthy
- no crash loop
- no outage alert during Step 3 execution window

---

## 24. Watchdog Evidence

| Field | Value |
|-------|-------|
| Process | `aisandbox-ops-watchdog` |
| Status | online |
| Crash loop | none |
| Outage alert during Step 3 window | none |

Watchdog remained active and healthy through activation, temporary rollback, reactivation, and smoke.

---

## 25. Final Execution Gate State

**Final state:** `GLOBAL_EXECUTION_ENABLED=true`

This is **DELIBERATELY LEFT ENABLED**.

Reason: the immediately following P1 is Keith’s fresh full end-to-end staging journey, which requires Builder execution active. Leaving the gate enabled avoids unnecessary `.env`/PM2 churn and matches Stage-Start Option A.

Step 4 must **not** change this gate.

---

## 26. Rollback Procedure

Immediate rollback remains available at any time:

```bash
# R1: Revert .env
sed -i 's/^GLOBAL_EXECUTION_ENABLED=true$/GLOBAL_EXECUTION_ENABLED=false/' /opt/aisandbox/.env

# R2: Verify
grep '^GLOBAL_EXECUTION_ENABLED' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=false

# R3: Restart API Gateway with updated env
pm2 restart aisandbox-api-gateway --update-env

# R4: Verify PM2 env
pm2 env 3 | grep GLOBAL_EXECUTION_ENABLED
# Expected: GLOBAL_EXECUTION_ENABLED: false

# R5: Verify readiness
curl -s http://127.0.0.1:4000/api/health/ready
```

No DB rollback is required to disable execution. Credit deductions already recorded are accounting evidence and are not reversed (`BILLING_CHARGES_ENABLED=false` — no real money moved).

**Evidence the path works:** temporary rollback during first activation attempt executed successfully under the defined safety policy.

---

## 27. Known Limitations

1. This activation covers **Builder single-shot / plain path only** — not Harness multi-turn, multi-agent, or user-created-agent execution.
2. Stripe charging remains disabled — credit accounting only.
3. `LAUNCH_STATE=INTERNAL` — not a public beta launch.
4. Temporary first-activation readiness blip required policy rollback + reactivation; final state is healthy, but operators should expect brief readiness disruption on API Gateway `--update-env` restarts.
5. This task does **not** prove a full Keith end-to-end staging journey.
6. This task does **not** constitute final private-beta GO.
7. This task does **not** authorize invitations / PRIVATE-BETA-INVITE-01.

---

## 28. Final Acceptance Criteria

### Step 1 — Registration

All Step 1 criteria — **SATISFIED** (2026-08-10).

### Step 2 — Activation Readiness Audit + Stage-Start

| Criterion | Verdict |
|-----------|---------|
| Exact gate location/meaning documented | PASS |
| Services consuming the gate documented | PASS |
| Restart/reload requirement determined | PASS |
| Secondary kill switches / safety limits inventoried | PASS |
| Billing/credit/quota protections confirmed intact (read-only) | PASS |
| Watchdog health expectations documented | PASS |
| Provider configuration PRESENT/MISSING recorded without exposing secrets | PASS |
| Exact activation and rollback commands documented | PASS |
| Controlled execution acceptance criteria documented | PASS |
| Keith manual/browser action requirement determined | PASS |
| Stage-start artifact produced | PASS — `docs/PRIVATE-BETA-EXEC-01-STAGE-START.md` |
| No runtime changes during Step 2 | PASS |

### Step 3 — Controlled Activation + Runtime Validation

| Criterion | Verdict |
|-----------|---------|
| Staging health verified | PASS |
| Watchdog healthy verified | PASS |
| Gate false verified before activation | PASS |
| Provider/configuration readiness verified | PASS |
| Approved Builder execution gate activated | PASS (after policy rollback + successful reactivation) |
| Only required service(s) restarted/reloaded | PASS — API Gateway only |
| Post-activation readiness verified | PASS (final reactivation) |
| Exactly one controlled Builder real-provider execution performed | PASS — ID `24acd697-b55c-40d0-b2d5-32faf9b85709` |
| Workspace/file result verified | PASS |
| Execution persistence verified | PASS |
| Credit/accounting evidence verified | PASS |
| No unexpected operational alerts/failures | PASS (transient readiness triggered correct rollback; no outage alert) |
| Gate-remain-enabled decision for Keith E2E journey recorded | PASS — left `true` deliberately |
| Immediate rollback ability to false retained | PASS — proven by temporary rollback |
| Harness multi-turn not activated | PASS — `selectedPath:"plain"` |

### Step 4 — Consolidation

| Criterion | Verdict |
|-----------|---------|
| Checkpoint created | PASS — this document |
| PRIVATE-BETA-EXEC-01 marked COMPLETE AND LOCKED | PASS |
| Final gate state recorded | PASS — `true` (deliberate) |
| Rollback path recorded | PASS |
| Next recommended task identified without registering it | PASS |
| No unrelated implementation changes in consolidation | PASS |

**All supported Step 1–4 acceptance criteria: SATISFIED**

---

## 29. Final Status

**PRIVATE-BETA-EXEC-01 — COMPLETE AND LOCKED — 2026-08-10**

| Step | Description | Status | Date |
|------|-------------|--------|------|
| Step 1 | Registration | COMPLETE | 2026-08-10 |
| Step 2 | Activation Readiness Audit + Stage-Start | COMPLETE | 2026-08-10 |
| Step 3 | Controlled Builder Execution Activation + Runtime Validation | COMPLETE / PASS | 2026-08-10 |
| Step 4 | Consolidation / Checkpoint | COMPLETE | 2026-08-10 |

---

## 30. Private-Beta Readiness Impact

The P1 requirement:

> **controlled Builder AI execution activation**

is now **SATISFIED**.

Also recorded:

- Builder single-shot execution is currently **enabled** on staging
- `GLOBAL_EXECUTION_ENABLED=true`
- Harness remains **disabled**
- Stripe charging remains **disabled**
- watchdog remains **active**
- this does **NOT** constitute final private-beta GO
- this does **NOT** authorize invitations

Remaining Builder-first beta sequence:

1. minimal operational visibility — **COMPLETE** (PRIVATE-BETA-OPS-01)
2. controlled Builder execution activation — **COMPLETE** (this task)
3. one fresh Keith full end-to-end staging journey — **NEXT** (not registered here)
4. final Builder-first beta go/no-go — **not taken**
5. PRIVATE-BETA-INVITE-01 — **only after Keith explicit approval** — remains untouched / unregistered

---

## 31. Exact Next Recommended Task

**One fresh Keith full end-to-end staging journey** (separate task; **not registered in this consolidation**).

Do **not** register or execute during this Step 4:

- Keith full end-to-end staging journey
- final Builder-first beta go/no-go
- PRIVATE-BETA-INVITE-01
- invitations

---

## Step Completion Evidence Map

| Step | Artifact |
|------|----------|
| Step 1 | `TASKS.md` / `TASKS_BACKLOG_FULL.md` registration |
| Step 2 | `docs/PRIVATE-BETA-EXEC-01-STAGE-START.md` |
| Step 3 | Staging activation + temporary policy rollback + reactivation + smoke evidence recorded in this checkpoint §§11–24 |
| Step 4 | This checkpoint + ledger lock |

---

## Lock Notice

PRIVATE-BETA-EXEC-01 is **COMPLETE AND LOCKED — 2026-08-10**.

Do not modify this checkpoint except for explicitly approved documentation correction.

Step 4 performed **governance/consolidation only**:

- No implementation source modified
- No tests modified
- No staging runtime action
- No SSH / PM2 / Docker / Postgres / Redis action
- No `.env` modification
- No `GLOBAL_EXECUTION_ENABLED` change
- No provider execution
- No PRIVATE-BETA-INVITE-01 registration
- No next P1 task registration
- No git commit or push
- ARCHITECTURE.md / PRD.md / CLAUDE.md unchanged

*Checkpoint created: 2026-08-10 — PRIVATE-BETA-EXEC-01 Step 4 Consolidation.*
