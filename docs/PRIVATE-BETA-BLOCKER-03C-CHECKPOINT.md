# PRIVATE-BETA-BLOCKER-03C — Checkpoint

**Task ID:** PRIVATE-BETA-BLOCKER-03C
**Title:** Grok 4.2 Timeout Diagnosis → Model Availability Policy
**Status:** COMPLETE AND LOCKED — 2026-08-14
**Checkpoint date:** 2026-08-14
**Author:** Cursor / Sonnet 4.6 (consolidation step — documentation only)

---

## 1. Task / Status / Date

PRIVATE-BETA-BLOCKER-03C registered 2026-08-14, completed 2026-08-14.

4-step workflow:

- Step 1 — Registration — COMPLETE — 2026-08-14
- Step 2 — Stage Start / Timeout Architecture Diagnosis — COMPLETE — 2026-08-14
- Step 3 — Bounded Implementation + Validation — COMPLETE — 2026-08-14
- Step 4 — Consolidation / Checkpoint — COMPLETE — 2026-08-14

**PRIVATE-BETA-BLOCKER-03C — COMPLETE AND LOCKED — 2026-08-14**

---

## 2. Original Blocker

During PRIVATE-BETA-E2E-01 (2026-08-10), Keith intentionally tested multiple xAI models in the Builder path. Grok 4.5 completed successfully. Grok 4.2 (`grok-4.20`) produced two `timeout` executions with user-visible error `Request was aborted.` — 0 tokens, no workspace mutation, no credit deduction.

This was recorded as a private-beta blocker blocking the E2E rerun and GO/NO-GO decision.

---

## 3. Historical Failure Evidence

| Field | Execution 1 | Execution 2 |
|-------|------------|------------|
| Execution ID | `6e25ad2d-5dde-4738-b2e3-7d25e2517baa` | `2bcf23fe-e0c5-44b3-8117-b28a058ca209` |
| User | Keith (`7f772841-7844-401b-a3da-e928b0c7b79c`) | Keith |
| Project | `198b705f-3a26-41f1-b6f2-3af355b7aca2` | same |
| Session | `9554804b-ef58-47fe-aede-2d266614f58b` | same |
| Conversation | `f2735d3a-519e-479a-ae5a-a163c0972d00` | same |
| Model | `grok-4.20` | `grok-4.20` |
| Status | `timeout` | `timeout` |
| Error | `Request was aborted.` | `Request was aborted.` |
| Tokens | 0 | 0 |
| Credits | 0 | 0 |

Known-good comparison: `grok-4.5` execution `2bc73157-973a-45ec-8b71-bca8c2f7941d` — same user, project, session, conversation — completed with 1251 tokens, status `completed`.

---

## 4. Stage-Start Hypothesis

Stage Start (Step 2, 2026-08-14, Opus-based diagnosis via `docs/PRIVATE-BETA-BLOCKER-03C-STAGE-START.md`) concluded:

**APPLICATION TIMEOUT TOO SHORT FOR VALID PROVIDER RESPONSE**

- `EXECUTION_TIMEOUT_MS` defaults to 20,000 ms
- At T+20s, `AbortController.abort()` fires → `AbortSignal` propagates to OpenAI SDK HTTP call → `Error('Request was aborted.')`
- `grok-4.20` did not return a response within 20s; `grok-4.5` did
- Application infrastructure is correct; only the timeout relative to `grok-4.20` latency was the issue
- Stage Start recommended: model-aware bounded timeout (grok-4.20 → 60000ms)

---

## 5. 20s → 60s Diagnostic Result

Two controlled diagnostic executions were run with `EXECUTION_TIMEOUT_MS` temporarily overridden to 60000ms:

| Diagnostic Execution | Model | Timeout | Result |
|---------------------|-------|---------|--------|
| `b27b964d-d906-44f8-a239-a35e0f532ee4` | `grok-4.20` | 60s | timeout — 0 tokens — no provider completion |
| `8d6509eb-ef62-4981-aea8-e0df0999f7ae` | `grok-4.20` | 60s | timeout — 0 tokens — no provider completion |

**Finding:** Increasing application timeout from 20s to 60s did NOT produce a response. `grok-4.20` timed out at 60s as well. The Stage-Start hypothesis (timeout too short) was disproved by controlled evidence.

Provider diagnostic budget: **2/2 authorized calls used. Budget exhausted. No third call authorized.**

---

## 6. response_format Isolation Result

Within the two 60s diagnostic executions, `response_format` was explicitly isolated:

- One 60s call WITH `{ type: "json_object" }`
- One 60s call WITHOUT `response_format`

Both timed out. `response_format` is excluded as the primary cause of `grok-4.20` failures.

---

## 7. Final Root-Cause Classification

**GROK-4.20 PROVIDER/MODEL REQUEST HANG OR EXTREME LATENCY UNDER CURRENT BUILDER WORKLOAD**

Evidence:
- 4 total executions across 2 separate dates — all `grok-4.20`, all timeout, all 0 tokens
- Both 20s and 60s application timeouts reached with no provider response
- `response_format` isolated and excluded as cause
- `grok-4.5` completes through the same endpoint, adapter, Worker, queue, and AbortSignal path
- No evidence justifies raising timeout to 120s
- Controlled diagnostic budget exhausted (2/2 calls used)

Classification: `grok-4.20` experiences provider-side hang or extreme latency that is not bounded by the application timeout under current Builder workload conditions. The application infrastructure is correct.

---

## 8. Private-Beta Model Policy Decision

For private beta:

| Model | Status | Selectable | Behaviour |
|-------|--------|------------|-----------|
| `grok-4.5` | active | YES (default xAI Builder model) | accepted, executes normally |
| `grok-4.20` | historically recognized | NO | rejected before provider execution with `invalid_model` semantics |

Policy rules:
- `grok-4.20` remains recognized historically (historical execution records preserved)
- `grok-4.20` is NOT selectable for new Builder executions
- `grok-4.20` is rejected server-side before intent ledger write / queue enqueue
- No automatic fallback or substitution
- `grok-4.5` remains supported, selectable, and default

---

## 9. Final Implementation

### Recognized vs. Allowed Model Distinction

All three catalogues introduce `XAI_RECOGNIZED_MODELS` (historical) and `XAI_ALLOWED_MODELS` (new executions):

**`XAI_RECOGNIZED_MODELS`:** `grok-4.5`, `grok-4.20`
**`XAI_ALLOWED_MODELS`:** `grok-4.5` only

### Frontend — `frontend/lib/ai/provider-model.catalogue.ts`

- `grok-4.20`: `enabled: true`, `selectable: false`
- `grok-4.5`: `enabled: true`, `selectable: true`
- Existing `enabled && selectable` selector filtering removes `grok-4.20` from UI
- Stored `grok-4.20` selection migrates to `grok-4.5`

### API Gateway — `services/api-gateway/src/ai/provider-model.catalogue.ts`

- `XAI_RECOGNIZED_MODELS` includes `grok-4.5` and `grok-4.20`
- `XAI_ALLOWED_MODELS` includes only `grok-4.5`
- New `grok-4.20` execution rejected with existing `invalid_model` semantics before intent ledger write / queue enqueue

### AI Service — `services/ai-service/src/ai-execution/provider-model.catalogue.ts`

- Same recognized-vs-allowed distinction
- New `grok-4.20` rejected before adapter/provider execution

### XAI Adapter — `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts`

- Temporary 03C-A diagnostic `response_format` omission reverted
- Supported xAI requests use `response_format: { type: "json_object" }` as before

### Worker — `services/ai-service/src/worker/worker.processor.ts`

- Temporary 03C-A exact-model 60000ms `grok-4.20` timeout override removed
- Default global timeout restored
- `EXECUTION_TIMEOUT_MS` unset → 20000ms
- Watchdog restored to 2× global timeout → 40s
- BullMQ `lockDuration` remains 30000ms
- No automatic retry, no fallback

### Production files changed

```
frontend/lib/ai/provider-model.catalogue.ts
services/api-gateway/src/ai/provider-model.catalogue.ts
services/ai-service/src/ai-execution/provider-model.catalogue.ts
services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts
services/ai-service/src/worker/worker.processor.ts
```

---

## 10. Local Validation

| Suite | Result |
|-------|--------|
| Frontend catalogue / history tests | 28/28 PASS |
| Frontend workspace-shell | 438/438 PASS |
| Full frontend test suite | 661/661 PASS |
| Frontend `tsc --noEmit` | PASS |
| Frontend `npm run build` | PASS |
| AI Service catalogue / validation / xAI / Worker (targeted) | 154 PASS |
| AI Service broader safe/offline suite | 37 suites / 759 tests PASS |
| AI Service live-provider phase30c | excluded (GLOBAL_EXECUTION_ENABLED=false) |
| AI Service `npm run build` | PASS |
| API Gateway relevant safe/offline tests | 66 PASS |
| API Gateway `npm run build` | PASS |

No provider calls during implementation.

---

## 11. Staging Deployment

Backup: `/tmp/aisandbox-03c-model-availability-backup-20260814-045742`

All production files deployed. Post-deploy SHA256 hashes matched local build artifacts.

Services restarted (touched services only): AI Service, API Gateway, Frontend. No restart loops.

---

## 12. Provider-Free Enforcement Proof

`GLOBAL_EXECUTION_ENABLED` remained `false` throughout.

No HTTP execution request was used (ExecutionSafetyGuard runs before controller model validation).

Deployed compiled runtime catalogue validation confirmed:
- `grok-4.20`: recognized historically, rejected for new execution as `invalid_model`
- `grok-4.5`: accepted, default/selectable

Side-effect accounting (unchanged):
- `usage_records`: 16 → 16
- BullMQ wait/active: 0/0 → 0/0
- No XAIAdapter invocation
- No api.x.ai log activity
- Credits: 31723 → 31723

Provider calls during provider-free staging validation: **0**

---

## 13. Manual Selector Verification

Keith manually confirmed:
- `grok-4.5` visible in xAI selector — PASS
- `grok-4.20` absent from selector — PASS

---

## 14. Historical-Data Compatibility

Historical `grok-4.20` execution records:
- `6e25ad2d-5dde-4738-b2e3-7d25e2517baa`
- `2bcf23fe-e0c5-44b3-8117-b28a058ca209`

Both records remain in `usage_records`. Historical integrity preserved.

Conversation `f2735d3a-519e-479a-ae5a-a163c0972d00` still exists with 8 messages. Historical timeout assistant messages remain persisted in DB. Data integrity: PASS.

---

## 15. Historical-Chat Visibility — Non-Blocking Pre-Existing Limitation

Keith could not see old Aug 10 timeout messages after reopening `Private Beta E2E 2026-08-10`.

**Investigation result (read-only):**

- Historical conversation `f2735d3a-519e-479a-ae5a-a163c0972d00` exists with 8 messages
- Historical session `9554804b-ef58-47fe-aede-2d266614f58b` is expired
- Current application behavior: conversation is 1:1 with session; reopening an expired project session creates/reuses a fresh usable session; old expired-session conversations are not automatically restored; Project-First UX hides the session list; no supported historical conversation picker

**Classification: PRE-EXISTING CHAT-HISTORY UX LIMITATION — DOES NOT BLOCK 03C**

- Historical data integrity: PASS
- Historical old-session browser visibility: existing limitation, NOT a registered 03C acceptance criterion
- 03C production files do not touch conversation/history loading
- A chat-history fix is NOT part of 03C; register separately if required

---

## 16. Provider Budget Closure

| Budget | Value |
|--------|-------|
| Authorized | 2 |
| Used | 2 |
| Remaining | 0 |

Calls:
1. `b27b964d-d906-44f8-a239-a35e0f532ee4` — grok-4.20, 60s timeout, 0 tokens
2. `8d6509eb-ef62-4981-aea8-e0df0999f7ae` — grok-4.20, 60s timeout, 0 tokens (response_format omitted)

**NO THIRD PROVIDER CALL. Budget exhausted and closed.**

---

## 17. Accounting Boundary / 03D Separation

03C owns: technical `grok-4.20` availability policy, timeout/abort root cause, model catalogue enforcement.

03D owns: credit/refund policy for no-workspace-result executions.

The 03C diagnostic timeout executions:
- 0 tokens, 0 credits deducted — correct `timeout` status behavior
- Credit accounting for no-workspace-result scenarios: **03D scope — not 03C**

03D remains NOT REGISTERED. Do not absorb into 03C.

---

## 18. Final Safety / Gate State

| Setting | Value |
|---------|-------|
| `GLOBAL_EXECUTION_ENABLED` | `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` |

All services healthy. No restart loops.

---

## 19. Remaining Known Limitations

| Limitation | Owner | Blocking? |
|------------|-------|-----------|
| `grok-4.20` provider hang root cause unknown at xAI infrastructure level | xAI — uncontrollable | No — resolved by removal from availability |
| Historical old-session chat not visible in browser after session expiry | Pre-existing UX limitation — not 03C | No — not a 03C acceptance criterion |
| Credit/refund policy for timeout/failed executions not yet defined | PRIVATE-BETA-BLOCKER-03D | Yes — blocks E2E rerun |

---

## 20. Next Recommended Task

**PRIVATE-BETA-BLOCKER-03D — No-Workspace-Result Credit Policy**

03D is NOT REGISTERED. Register separately with explicit approval.

After 03D, intended sequence:
1. PRIVATE-BETA-BLOCKER-03D — register and complete
2. Fresh PRIVATE-BETA-E2E rerun
3. Final private-beta GO/NO-GO

**PRIVATE-BETA-INVITE-01 remains untouched / unregistered. Invitations prohibited until GO.**

---

*Checkpoint created: 2026-08-14 — PRIVATE-BETA-BLOCKER-03C Step 4 — documentation only — no source/runtime/provider modification.*
*`GLOBAL_EXECUTION_ENABLED=false` — confirmed.*
*Provider calls this step: 0*
