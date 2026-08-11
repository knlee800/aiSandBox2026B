# PRIVATE-BETA-E2E-01-CHECKPOINT.md
## PRIVATE-BETA-E2E-01 — Fresh Keith Builder End-to-End Staging Journey — Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-E2E-01  
**Title:** Fresh Keith Builder End-to-End Staging Journey  
**Status:** COMPLETE AND LOCKED — 2026-08-10 — **FAIL / BLOCKER**  
**Family:** PRIVATE BETA / BUILDER / END-TO-END / USER JOURNEY  
**Nature:** CONTROLLED STAGING E2E / REAL USER JOURNEY / REAL PROVIDER  
**Workflow:** 4-step HIGH-risk controlled staging E2E lifecycle  
**Closed:** 2026-08-10  
**Predecessors:**
- PRIVATE-BETA-OPS-01 COMPLETE AND LOCKED — 2026-08-10 — Checkpoint: `docs/PRIVATE-BETA-OPS-01-CHECKPOINT.md`
- PRIVATE-BETA-EXEC-01 COMPLETE AND LOCKED — 2026-08-10 — Checkpoint: `docs/PRIVATE-BETA-EXEC-01-CHECKPOINT.md`
**Stage-start:** `docs/PRIVATE-BETA-E2E-01-STAGE-START.md`  
**Step 3 evidence correction (authoritative for execution-history framing):** `docs/PRIVATE-BETA-E2E-01-STEP-3-EVIDENCE-CORRECTION.md`  
**Author:** Cursor / Grok 4.5 (Step 4 consolidation only — governance/docs; no implementation or runtime action)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-E2E-01 |
| Title | Fresh Keith Builder End-to-End Staging Journey |
| Priority | P1 — product-journey validation before Builder-first private-beta GO/NO-GO |
| Risk | HIGH — live staging, real provider, credit accounting, gate toggle/rollback |
| Cohort | Builder-first private beta — approximately 1–3 trusted users |
| Execution path | Existing Builder single-shot (`plain`) only |
| Invite posture | PRIVATE-BETA-INVITE-01 remains untouched / unregistered |
| Final GO/NO-GO | NOT REGISTERED; remains blocked by this FAIL / BLOCKER |

---

## 2. Purpose

Prove that Keith can enter `staging.ainow.biz`, access Builder, create a fresh project, submit one realistic Builder prompt, obtain a coherent AI-produced workspace mutation (`index.html`), observe preview/editor coherence, refresh/reopen, and find the result intact — without internal intervention.

This was **not** another narrow activation smoke. It was the integrated product-journey gate before a separate Builder-first private-beta GO/NO-GO decision.

---

## 3. Starting Runtime State

At Step 2 stage-start / Step 3 pre-flight baseline (intentional from PRIVATE-BETA-EXEC-01):

| Property | Starting state |
|----------|----------------|
| `GLOBAL_EXECUTION_ENABLED` | **`true`** |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AI_PROVIDER` | `xai` |
| `PROVIDER_XAI_ENABLED` | `true` |
| `LAUNCH_STATE` | `INTERNAL` |
| Watchdog (`aisandbox-ops-watchdog`) | Online; alert path proven (PRIVATE-BETA-OPS-01) |
| Known credit balance | `4922` after EXEC-01 smoke (verified at journey window) |
| PRIVATE-BETA-INVITE-01 | Untouched / unregistered |
| Final Builder beta GO/NO-GO | Not taken |

---

## 4. Step 2 Journey Design

Stage-start artifact: `docs/PRIVATE-BETA-E2E-01-STAGE-START.md` — COMPLETE — 2026-08-10.

| Design element | Locked plan |
|----------------|-------------|
| Entry | `https://staging.ainow.biz` → `/en` → login if needed → `/en/app` |
| Project | Fresh project named **`Private Beta E2E 2026-08-10`** |
| Prompt | Exact single-file `index.html` “Private Beta Launch Checklist” prompt |
| Expected mutation | Exactly one structured file action creating `index.html` |
| Preview | Heading + checklist visible; toggle and/or add-item interaction |
| Persistence | Browser refresh + project reopen must still find `index.html` |
| Accounting | Credits deducted; no Stripe charge (`BILLING_CHARGES_ENABLED=false`) |
| Ops | Pre/post-flight on all five PM2 processes; watchdog healthy; Harness remains off |
| Fail path | On FAIL / BLOCKER → rollback `GLOBAL_EXECUTION_ENABLED` to `false` |

Step 2 verdict at stage-start: **READY FOR KEITH E2E** (read-only planning only).

---

## 5. Pre-Flight Evidence

Step 3 Phase A pre-flight: **PASS — KEITH MAY START E2E JOURNEY**

| Check | Result |
|-------|--------|
| PM2 `aisandbox-api-gateway` | online |
| PM2 `aisandbox-ai-service` | online |
| PM2 `aisandbox-container-manager` | online |
| PM2 `aisandbox-frontend` | online |
| PM2 `aisandbox-ops-watchdog` | online |
| API Gateway `/api/health/ready` | HTTP 200 |
| AI Service `/metrics` | HTTP 200 |
| container-manager `/api/health` | HTTP 200 |
| Frontend `https://staging.ainow.biz` | HTTP/2 307 healthy redirect |
| Watchdog probes | Healthy for api-gateway / ai-service / frontend / container-manager / Redis (`healthy:true`, `consecutiveFailures:0`) |
| `GLOBAL_EXECUTION_ENABLED` | `true` |
| Harness flags | both `false` |
| `BILLING_CHARGES_ENABLED` | `false` |

---

## 6. Keith User Journey Actions

Keith performed the authorized browser journey on staging:

1. Entered staging / Builder path as planned.
2. Created / opened fresh project **`Private Beta E2E 2026-08-10`**.
3. Submitted the planned Builder prompt requesting creation of `index.html`.
4. Observed assistant text indicating intent to create `index.html`.
5. Observed **no** `index.html` in the file tree / workspace.
6. Continued intentional troubleshooting attempts with model selection changes (see §7) after the initial failure.
7. Core requested workspace mutation never occurred; preview/editor/persistence path could not be completed meaningfully.

Entry / project-setup portions of the journey are supported as functional. The journey **failed** at structured workspace mutation.

---

## 7. Corrected Intentional Execution History

**Authoritative framing:** `docs/PRIVATE-BETA-E2E-01-STEP-3-EVIDENCE-CORRECTION.md`  
This supersedes any earlier interpretation that four session executions were unintended duplicates.

Keith **intentionally** submitted:

| Model | Attempts | Outcome |
|-------|----------|---------|
| Grok 4.5 | 2 intentional submissions | Completed (assistant text surfaced; no workspace mutation on target evidence) |
| Grok 4.2 | 2 intentional submissions | Both timed out / were stopped |

**Explicitly NOT recorded as defects:**

- frontend duplicate submission
- backend retry / requeue
- automatic retry
- unintended multi-execution anomaly

There is **no confirmed duplicate-submission defect**, **no confirmed frontend auto-resubmit defect**, and **no confirmed backend retry/requeue defect**. Do not invent a cause for the Grok 4.2 timeouts.

---

## 8. Grok 4.5 Completed-Execution Evidence

Target / primary blocked completed execution:

| Field | Evidence |
|-------|----------|
| Execution ID | `2bc73157-973a-45ec-8b71-bca8c2f7941d` |
| Provider | `xai` |
| Execution path | `plain` |
| Status | `completed` |
| Tokens | `1251` |
| Assistant text | Surfaced (see §10) |
| `fileActions` | `[]` |
| Workspace write | None |
| `index.html` | Not created |
| `/workspace` | Empty |

Other intentional completed / charged Grok 4.5 attempt in the same troubleshooting window:

| Field | Evidence |
|-------|----------|
| Execution ID | `c3a920b3-ce40-47e6-9da3-9b19a995d5d5` (abbreviated `c3a920b3...`) |
| Outcome | Completed and charged |
| Applied credits | `1264` |
| Balance | `4922 → 3658` |

Treat both Grok 4.5 completions as intentional attempts, not accidental duplicates.

---

## 9. Primary Missing-fileActions Blocker

**PRIMARY confirmed blocker:**

> A completed Builder plain-path execution returned assistant text but produced zero structured file actions, so the requested workspace mutation never occurred.

**Primary classification:**

**structured file-action generation / output-contract failure in the Builder plain execution path**

**Not classified as:** frontend apply failure — there were no actions available to apply.

Evidence chain for execution `2bc73157-973a-45ec-8b71-bca8c2f7941d`:

- `usage_records.metadata.aiExecutionResult.fileActions = []`
- file action count = `0`
- no `index.html` action
- no workspace write call
- server-side `/workspace` remained empty
- no `index.html` existed
- browser refresh could not recover the file

---

## 10. Visible Assistant Response Evidence

Visible assistant response for the target completed execution:

```text
Creating a single self-contained index.html with the checklist behavior and minimal styling.
```

Chat/result surfacing therefore showed text success-intent language while the workspace remained empty — a product contradiction relative to the requested file-creation prompt.

---

## 11. Server-Side Workspace Evidence

| Check | Result |
|-------|--------|
| Container for session | Running (`sandbox-session-9554804b-ef58-47fe-aede-2d266614f58b`) |
| Server-side `/workspace` | Empty |
| `index.html` present | **No** |
| Workspace write API evidence | No `/api/internal/workspace/{sessionId}/write` evidence for this session during the anomaly window |
| Browser refresh recovery possible? | **No** — nothing server-side to recover |

---

## 12. Frontend / Apply-Channel Evidence

| Check | Result |
|-------|--------|
| Structured actions delivered to apply channel | **None** (`fileActions: []`) |
| Frontend apply failure | **Not implicated** for target execution |
| Reason | No actions existed to apply |

---

## 13. Project / Session / Container Evidence

| Identity | Value |
|----------|-------|
| Project name | `Private Beta E2E 2026-08-10` |
| Project ID | `198b705f-3a26-41f1-b6f2-3af355b7aca2` |
| Session ID | `9554804b-ef58-47fe-aede-2d266614f58b` |
| Conversation ID | `f2735d3a-519e-479a-ae5a-a163c0972d00` |
| Container | running |
| Workspace content | empty |

Project / session / container identity remained valid. The failure was content generation / file-action contract, not project/session identity loss.

---

## 14. Grok 4.2 Timeout Observations

Recorded **separately** from the primary empty-`fileActions` blocker:

| Observation | Evidence |
|-------------|----------|
| Intentional attempts | Keith intentionally attempted Grok 4.2 **twice** |
| Outcome | Both timed out / were stopped |
| Runtime signal | Included `Request was aborted.` |
| Known related timeout execution IDs in session window | `6e25ad2d-5dde-4738-b2e3-7d25e2517baa`, `2bcf23fe-e0c5-44b3-8117-b28a058ca209` |
| Token charge on timeouts | No token charge for timeout executions |
| Root-cause inference | **Do NOT infer why** beyond available timeout evidence |

Treat as a separate bounded reliability concern for later diagnosis. Do **not** mix with the confirmed empty-`fileActions` defect unless later evidence proves a relationship.

---

## 15. Credit / Accounting Evidence

Completed executions were charged credits according to current accounting behavior.

| Execution | Applied credits | Balance before | Balance after |
|-----------|-----------------|----------------|---------------|
| `c3a920b3...` | `1264` | `4922` | `3658` |
| `2bc73157-973a-45ec-8b71-bca8c2f7941d` | `1251` | `3658` | `2407` |

Correlation supported via `credit_deduction_records.source_event_id = execution_id`.  
`BILLING_CHARGES_ENABLED=false` — no Stripe / real-money charge.

---

## 16. Charging-Without-Workspace-Mutation Observation

**Important product observation (policy not decided here):**

> Provider execution can complete and consume credits even when no applicable workspace mutation is produced.

Do **NOT** decide final charging policy in this checkpoint. That requires a separate bounded product/implementation decision after the execution-path defect is understood.

---

## 17. `token_usage` Missing-Table Anomaly

Secondary observed infrastructure anomaly in container-manager logs:

```text
Quota evaluation failed ... no such table: token_usage
```

with fail-open behavior.

**Do not claim** this caused:

- the empty `fileActions`
- Grok 4.2 timeout
- workspace mutation failure

unless later evidence establishes causality. Not fixed in PRIVATE-BETA-E2E-01.

---

## 18. Harness Separation Evidence

Confirmed throughout the journey window / target execution:

| Signal | Value |
|--------|-------|
| `harnessVersion` | `null` |
| `selectedPath` | `"plain"` |
| `enableToolLoop` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` |

Harness is **not implicated** in the confirmed blocker.

---

## 19. Watchdog / Runtime Evidence

| Check | Result |
|-------|--------|
| Watchdog process | online |
| Redis probe | healthy |
| Outage alert during journey window | No active outage condition observed |
| Post-rollback service health | All five PM2 processes online |

Watchdog remained an independent healthy observer; it is not the blocker source.

---

## 20. Rollback Execution

Following the failed E2E journey, rollback was initiated per stage-start §25:

1. `/opt/aisandbox/.env`: `GLOBAL_EXECUTION_ENABLED=true` → `false`
2. Restart **only** `aisandbox-api-gateway` with `--update-env`
3. Verify runtime gate and readiness

No other intentional service restarts were required for the gate rollback itself.

---

## 21. PM2 Env-Propagation Complication

Operational evidence important for future gate activation/rollback procedures:

1. First API Gateway restart after `.env` edit did **not** update the API Gateway PM2 runtime gate; it remained `true`.
2. A second bounded restart with `GLOBAL_EXECUTION_ENABLED=false` explicitly exported was performed.
3. Runtime gate then verified `false`.
4. API Gateway readiness returned HTTP 200 after stabilization.

Record accurately: `.env` edit alone + one restart was insufficient in this incident; runtime verification after restart is mandatory.

---

## 22. Final `GLOBAL_EXECUTION_ENABLED=false`

| Property | Final state |
|----------|-------------|
| `.env` gate | `GLOBAL_EXECUTION_ENABLED=false` |
| API Gateway PM2 runtime gate | `false` (verified) |
| Re-enable authorized by this task? | **NO** |

Do **not** re-enable execution as part of this consolidation.

---

## 23. Blocker vs Limitation Classification

| Category | Classification | Notes |
|----------|----------------|-------|
| Pre-flight / ops health | PASS | Journey was safe to start |
| Entry / auth / Builder access | PASS (supported) | Entry and Builder access functioned |
| Fresh project creation/open | PASS (supported) | Project/session/container identity valid |
| Prompt submission accepted | PASS (supported) | Provider execution occurred |
| AI execution completion (provider) | PASS WITH PRODUCT FAILURE | Completed, but without required file actions |
| Structured workspace mutation | **FAIL / BLOCKER** | `fileActions: []`; no `index.html` |
| File tree / editor coherence | **FAIL / BLOCKER** (consequence) | Nothing to open; no file existed |
| Preview / interactions | **NOT MEANINGFULLY COMPLETED** | Blocked by missing `index.html` |
| Persistence / reopen of generated file | **NOT MEANINGFULLY COMPLETED** | Blocked by missing `index.html` |
| Chat text surfacing | PASS WITH LIMITATION / contradiction | Text surfaced; contradicted empty workspace |
| Credits deducted | Observed | Charged despite no workspace mutation |
| Harness separation | PASS | Remained plain / disabled |
| Watchdog | PASS | Healthy; no outage condition |
| Grok 4.2 timeouts | Separate reliability concern | Not primary blocker; no root-cause inference |
| `token_usage` missing table | Secondary anomaly | Not claimed causal |

---

## 24. Final E2E Verdict

**PRIVATE-BETA-E2E-01 — COMPLETE AND LOCKED — 2026-08-10 — FAIL / BLOCKER**

| Criterion family | Result |
|------------------|--------|
| Pre-flight | PASS |
| Entry / project setup | Supported / PASS |
| Provider execution occurred | YES |
| Core requested workspace mutation | **FAILED** |
| Preview / editor / persistence journey | Could **not** be completed meaningfully because `index.html` never existed |
| Final private-beta GO/NO-GO | Remains **blocked** |
| Execution gate | Restored to `false` |
| Invitations | Remain **prohibited** |

---

## 25. Private-Beta Readiness Impact

Builder-first private beta is currently:

**NO-GO PENDING BLOCKER FIX**

This is **not** because the overall platform is abandoned or broadly broken.

The blocker is specifically:

> Builder plain-path real-provider execution can complete while producing text-only output with zero `fileActions` for an explicit file-creation request.

The final E2E journey must be **rerun after the blocker is fixed**.

PRIVATE-BETA-INVITE-01 remains untouched / unregistered. No private-beta GO exists.

---

## 26. Recommended Blocker Family

**Recorded but NOT REGISTERED in this consolidation:**

### PRIVATE-BETA-BLOCKER-03 — Builder Execution Reliability / File-Action Contract

Recommended decomposition:

#### BLOCKER-03A — Empty File-Action Contract Diagnosis

Determine why an explicit Builder file-creation prompt can complete with:

`fileActions: []`

Primary diagnosis only. No fix until cause is proven.

#### BLOCKER-03B — File-Action Reliability Fix

Implement the smallest fix established by 03A.

#### BLOCKER-03C — Grok 4.2 Timeout Diagnosis

Separate bounded investigation. Do not assume it shares the 03A cause.

#### BLOCKER-03D — No-Workspace-Result Credit Policy

Determine appropriate credit/accounting behavior when provider execution completes but yields no applicable workspace action. Do not mix policy with 03A implementation.

#### Separate triage if required

`token_usage` missing-table / fail-open issue. Keep separate unless 03A proves it is causal.

**Explicitly excluded from initial priorities unless new independent evidence appears:**

- duplicate-execution / double-submit / automatic-retry investigation

---

## 27. Explicit Invitation Status

| Item | State |
|------|-------|
| PRIVATE-BETA-INVITE-01 | Untouched / **unregistered** |
| Invitation execution | **Prohibited** |
| Private-beta GO | **Does not exist** |
| Final GO/NO-GO task | **Not registered** |

---

## 28. Exact Next Recommended Task

**Next recommended family (do not register in this Step 4):**

`PRIVATE-BETA-BLOCKER-03 — Builder Execution Reliability / File-Action Contract`

Start with registration of **BLOCKER-03A — Empty File-Action Contract Diagnosis** when Keith authorizes the next lifecycle.

Do **not** register PRIVATE-BETA-INVITE-01.  
Do **not** re-enable `GLOBAL_EXECUTION_ENABLED`.  
Do **not** declare Builder-first private-beta GO.

---

## Step Completion Record

| Step | Description | Status | Date |
|------|-------------|--------|------|
| Step 1 | Registration | COMPLETE | 2026-08-10 |
| Step 2 | Journey Plan + Stage-Start | COMPLETE | 2026-08-10 |
| Step 3 | Keith Full E2E Staging Journey + Evidence Collection | COMPLETE — **FAIL / BLOCKER** | 2026-08-10 |
| Step 3 evidence correction | COMPLETE (authoritative execution-history framing) | COMPLETE | 2026-08-10 |
| Step 4 | Consolidation / Checkpoint | COMPLETE | 2026-08-10 |

---

## Step 4 Consolidation Compliance

During this Step 4 consolidation:

- No source modifications
- No test modifications
- No SSH
- No PM2 actions
- No `.env` modifications
- No execution-gate re-enable
- No provider calls
- No Docker / PostgreSQL / Redis actions
- No deploy
- No PRIVATE-BETA-BLOCKER-03 registration
- No PRIVATE-BETA-INVITE-01 registration
- No ARCHITECTURE.md / PRD.md / CLAUDE.md changes
- No git commit / push
- All COMPLETE AND LOCKED predecessors preserved

---

*Checkpoint created: 2026-08-10 — PRIVATE-BETA-E2E-01 Step 4 — governance consolidation only — FAIL / BLOCKER locked.*
