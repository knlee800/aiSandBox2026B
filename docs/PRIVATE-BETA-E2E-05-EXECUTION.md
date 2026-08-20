# PRIVATE-BETA-E2E-05 — Step 3 Execution Evidence

**Task ID:** PRIVATE-BETA-E2E-05  
**Title:** Fresh Post-03J Builder E2E — Corrected Session-Timing Validation  
**Step:** Step 3 — Authorized Controlled Staging E2E Execution + Evidence  
**Operational authority:** `docs/PRIVATE-BETA-E2E-05-STAGE-START.md` (frozen Step 2 runbook)  
**Date:** 2026-08-20  
**PROVIDER_CALLS_AUTHORIZED:** 1  
**PROVIDER_CALLS_USED:** 1  
**FINAL_VERDICT:** FAIL/BLOCKED — preview rendering (frozen §22 / evidence table / hard-stop 26.14)  
**HARD STOP (current):** Preview pane reported `Preview unavailable`; heading and paragraph not visible. Session already `idle_timeout` stopped at 2026-08-20 17:08:28 +08; container gone.  
**CLARIFICATION_STATUS:** PHASE W FAIL RETRACTED — AUTO-APPLY / 03J / DEDUCTION / FILE / BALANCE PRESERVED — PREVIEW CRITERION FAIL  


This document is the only normal repository write allowed during Step 3. Secret values are recorded as PRESENT/ABSENT only. Local Git is read-only. Application source/tests/config were not modified. No provider retry. No source repair.

```
PRIVATE-BETA-E2E-05 STEP 3 FAIL/BLOCKED — PREMATURE DEDUCTION BEFORE QUALIFYING APPLY (COUNT=1 FOR EXECUTION d3b8409f; OPERATOR APPLY NEVER ATTEMPTED) — EXECUTION GATE RESTORED FALSE — NO RETRY AUTHORIZED — READY FOR STEP 4 CONSOLIDATION
```

> **Clarification 2026-08-20 (same Step 3):** the Phase W “pre-apply deduction” label above was **provisional**. It assumed a separate user-visible Apply click was required. Keith later reported the current UI has never shown that button. Read-only re-evaluation is in **Bounded Apply / Frontend-State Clarification** below. **Phase W FAIL is RETRACTED.** Do not treat the original banner as the current Step 3 classification.

---

## Phase A — OS / Resource Preflight

**READ-ONLY — PASS**

| Check | Result |
|-------|--------|
| AGENTS.md read | YES |
| CLAUDE.md applied | YES |
| TASKS.md CURRENT EXECUTION BOARD read (stopped at LEGACY / FROZEN) | YES |
| PRIVATE-BETA-E2E-05 registry body read | YES |
| Frozen Step 2 runbook read in full | YES |
| Lane 1 Task ID | PRIVATE-BETA-E2E-05 |
| Lane 1 Workstream | RELIABILITY |
| Lane 1 State | ACTIVE |
| Lane 1 lifecycle | 4-step HIGH-RISK |
| Lane 1 mutexes/resources | STAGING, PROVIDER-LIVE, CREDIT, ENV |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| PRIVATE-BETA-INVITE-01 | UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED |
| Concurrent contaminating work | NONE observed on CURRENT EXECUTION BOARD |
| Explicit Step 3 authorization received | YES |

Admission / isolation PASS.

---

## Local Repository Baseline (pre-runtime)

**READ-ONLY**

```
PRE_STEP3_HEAD=4c0fff8cda29591d027918f1b79e7b9c050a3809
PRE_STEP3_GIT_STATUS=(empty — clean working tree)
git log -1 = 4c0fff8 freeze PRIVATE-BETA-E2E-05 corrected runbook
branch = main (up to date with origin/main)
```

Keith Step 2 freeze commit MATCHES. Working tree CLEAN MATCHES at Step 3 entry. Local Git remained READ-ONLY throughout Step 3 (no add/commit/push/fetch/reset/restore/checkout/clean/stash/branch/worktree).

---

## Phase B — Staging Connectivity

**READ-ONLY — PASS**

```
ssh aisandbox-staging
connected
hostname=ip-172-26-6-228
```

Host identity MATCHES expected staging host from E2E-04. No mutation in this phase.

---

## Phase C — Staging Source / Worktree / Stash

**READ-ONLY — PASS**

| Check | Result |
|-------|--------|
| STAGING_HEAD (initial) | `c3e39279abe3c0d6c348daa312107c8f6fc592b7` |
| branch | `main` |
| `git status --short` | empty (CLEAN) |
| stash@{0} description | `On main: pre-03F-deployment-snapshot-2026-08-15` — MATCHES |
| `rev-parse stash@{0}` | `0372cc1f47f82e1db060ed2dd756a938fe324803` — EXACT MATCH |
| ancestry `c3e39279` ⊆ HEAD | PARITY_PROVEN (HEAD **is** REQUIRED_SOURCE_SHA) |
| PROVIDER_CALLS_USED | 0 at this phase |

Retained stash was not popped, applied, dropped, modified, replaced, or reused.

---

## Phase D — Parity Decision

**READ-ONLY — PASS — DEPLOYMENT_REQUIRED=NO**

```
REQUIRED_SOURCE_SHA = c3e39279abe3c0d6c348daa312107c8f6fc592b7
STAGING_HEAD        = c3e39279abe3c0d6c348daa312107c8f6fc592b7
DEPLOYMENT_REQUIRED=NO
DEPLOYMENT_PERFORMED=NO
```

No ambiguous descendant. Phase E skipped. Provider budget remained 0 through this phase.

---

## Phase E — Controlled Deployment

**SKIPPED — not required**

No staging Git mutation. No Gateway rebuild. No unrelated service restart for deployment.

---

## Phase F — Service Health / Safety Baseline

**READ-ONLY — PASS**

Frozen E2E-05 command `http://127.0.0.1:4001/api/health/ready` returned HTTP 404. Proven E2E-03/E2E-04 AI Service check `http://127.0.0.1:4001/metrics` returned HTTP 200.

| Service | Check | Result |
|---------|-------|--------|
| API Gateway | `http://127.0.0.1:4000/api/health/ready` | HTTP 200 |
| AI Service | `http://127.0.0.1:4001/metrics` | HTTP 200 |
| Container Manager | `http://127.0.0.1:4002/api/health` | HTTP 200 |
| PM2 aisandbox-ai-service (id 0) | online | YES |
| PM2 aisandbox-container-manager (id 1) | online | YES |
| PM2 aisandbox-frontend (id 2) | online | YES |
| PM2 aisandbox-api-gateway (id 3) | online | YES |
| PM2 aisandbox-ops-watchdog (id 5) | online | YES |

| Flag | Source | Observed before provider | Required | Result |
|------|--------|--------------------------|----------|--------|
| GLOBAL_EXECUTION_ENABLED | `/opt/aisandbox/.env` | `false` | false | PASS |
| GLOBAL_EXECUTION_ENABLED | PM2 api-gateway id 3 | `false` | false | PASS |
| BILLING_CHARGES_ENABLED | `/opt/aisandbox/.env` | `false` | false | PASS |
| BILLING_CHARGES_ENABLED | PM2 api-gateway id 3 | `false` | false | PASS |
| AGENT_HARNESS_ENABLE_TOOL_LOOP | PM2 ai-service id 0 | `false` | false | PASS |
| AGENT_HARNESS_ENABLE_WRITE_TOOLS | PM2 ai-service id 0 | `false` | false | PASS |
| AGENT_HARNESS_ENABLE_VALIDATION_TOOLS | PM2 ai-service id 0 | ABSENT (default false) | false | PASS |
| AGENT_HARNESS_STUB_WRITE_MODE | PM2 ai-service id 0 | `false` | false | PASS |
| AI_PROVIDER | `.env` + PM2 GW/AI | `xai` | xai | PASS |
| PROVIDER_XAI_ENABLED | PM2 GW + AI | `true` | true | PASS |
| DATABASE_URL | PM2 GW | PRESENT (count=1) | present | PASS |
| XAI_API_KEY | PM2 AI | PRESENT (count=1) | present | PASS |

Root `.env` was never edited. PLAIN_PATH_CONFIRMED=YES.

Provider/model re-verified before gate enable:

```
PROVIDER=xai
MODEL=grok-4.5
staging source XAI_ALLOWED_MODELS = ['grok-4.5'] as const
```

---

## Phase G — Effective Idle Timeout

**READ-ONLY — PASS**

Method: PM2 env of `aisandbox-container-manager` (id 1) plus deployed `governance.config.ts` default. Leftover `SESSION_TIMEOUT_MINUTES=120` was **not** used.

```
CM SESSION_IDLE_TIMEOUT_MS count=0 (ABSENT → default)
EFFECTIVE_SESSION_IDLE_TIMEOUT_MS=1800000
CONFIRMED_SESSION_IDLE_TIMEOUT_MS=1800000
```

---

## Phase H — Authentication Precheck

**PASS**

```
TEST_USER_ID=7f772841-7844-401b-a3da-e928b0c7b79c
AUTH_RESULT=PASS
BILLING_PAGE=https://staging.ainow.biz/en/billing loaded (authenticated)
GET /api/billing/balance HTTP 200
```

---

## Phase I — Pre-Session Credit Baseline

**PASS**

```
BALANCE_DB_BEFORE=30577
BALANCE_API_BEFORE=30577
BALANCE_BROWSER_BEFORE=30577
PRE_SESSION_BALANCE_RECONCILIATION=PASS
MINIMUM_BALANCE_GATE (>=10000)=PASS
credit_balances.updated_at (before run)=2026-08-14 21:08:31.677066
```

Billing tab remained open with DevTools Network ready.

---

## Phase J — Operator Preparation

**PASS — pre-session**

Billing tab, DevTools, frozen prompt, DB/PM2/deduction/checkpoint commands prepared before session open. Artificial keepalive prohibited and not used.

---

## Phase K — Pre-Session GO / NO-GO

**GO**

All frozen pre-session gates PASS. `PROVIDER_CALLS_USED=0` at GO.

---

## Phase L / M — Fresh Project and Workspace Session

**PASS — IDs captured**

```
FRESH_PROJECT_NAME=E2E-05-Disposable-2026-08-20
PROJECT_ID=21b26811-8343-48bb-91ec-7a1734db1d4b
SESSION_ID=820bc0ab-3b24-499f-9ceb-e40f112496ec
CONTAINER_SHORT_ID=5566e1c7abb9
CONTAINER_ID=5566e1c7abb93ee77fa108f1a8cd246085da2c7d3d3ede3f16bb0939d533fb8a
CONTAINER_NAME=sandbox-session-820bc0ab-3b24-499f-9ceb-e40f112496ec
SESSION_STATUS=active (at capture)
POSTGRES_SESSIONS_CONTAINER_ID_COLUMN=(empty — same as E2E-04; Docker name maps 1:1 to SESSION_ID)
SESSION_OPENED_AT=2026-08-20T08:21:33.924Z
```

Leftover non-subject containers (including E2E-03 session `8fe81601`) were not touched.

PostgreSQL timezone = `Asia/Hong_Kong` (+08). `date -u` at session capture = `2026-08-20T08:22:21.229Z`.

---

## Phase N — Conservative Server Timing Anchor

**PASS**

```
POSTGRES_SESSION_CREATED_AT=2026-08-20 16:19:48.760372 +08
SESSION_CREATED_AT=2026-08-20T08:19:48.760Z
SESSION_HEADROOM_ANCHOR_AT=2026-08-20T08:19:48.760Z
ANCHOR_CLASS=CONSERVATIVE_SERVER_SIDE_SAFETY_ANCHOR
```

`last_activity_at` was not used as the idle anchor.

---

## Phase O — Minimal Session Readiness

**PASS**

Keith reported workspace open and untouched after timestamp capture. No synthetic file activity, fake keepalive, terminal no-op, heartbeat, or repeated file-list refresh.

---

## Phase P — Pre-Gate Headroom

**PASS**

At gate-enable verification `2026-08-20T08:23:13Z`:

```
SESSION_AGE ≈ 204240 ms (~3.4 min)
REMAINING_IDLE_HEADROOM ≈ 1595760 ms
preferred < 5 minutes = YES
SAFE_MINIMUM_HEADROOM_MS=600000 satisfied
```

---

## Phase Q — Enable Execution Gate

**PASS — PM2 runtime only; root .env not edited**

```
command: GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env
GLOBAL_EXECUTION_ENABLED after enable (PM2 id 3)=true
BILLING_CHARGES_ENABLED after enable=false
GET /api/health/ready=200
root .env GLOBAL_EXECUTION_ENABLED=false (unchanged)
Harness flags not altered
```

---

## Phase R — Final Pre-Provider Headroom Gate

**PASS**

```
PROVIDER_CALL_AT=2026-08-20T08:25:01.070Z
  (authoritative nearest proven marker: Gateway execution.intent_written for this EXECUTION_ID;
   EXACT browser click timestamp not separately instrumented)
SESSION_AGE_AT_PROVIDER_CALL=312310 ms
REMAINING_IDLE_HEADROOM_AT_PROVIDER_CALL=1487690 ms
PRE_PROVIDER_HEADROOM_GATE=PASS
preferred SESSION_AGE < 300000 ms = NO (312310 ms; still far above 10-minute remaining-headroom minimum)
```

---

## Phase S / T — Exact Builder Prompt and Provider Result

**Qualifying provider execution PASS; PROVIDER_CALLS_USED=1; NO RETRY**

Frozen prompt submitted once. Provider `xai`. Model `grok-4.5`.

Keith UI (do not treat as Apply):

```
Assistant result: Created `e2e-05.html` with the exact contents specified.
File Action Results: create e2e-05.html / success
No further browser action taken. Apply not clicked.
```

Authoritative DB / log evidence:

```
EXECUTION_ID=d3b8409f-18c8-42e4-a9fc-e8fcb7574494
execution_status=completed
provider=xai
model=grok-4.5   (usage_records.metadata.aiExecutionResult.model; column model empty)
tokens_used=1178
intent=workspace_mutation
fileActions count=1
first path=e2e-05.html
execution.intent_written=2026-08-20T08:25:01.070Z
finalize_accounting.request_received=2026-08-20T08:25:03.245Z (INTERNAL finalize-accounting)
EXACT_PROVIDER_COMPLETED_AT=UNPROVEN
provider/execution duration (intent_written → build_awaiting_apply)=2177 ms
PROVIDER_CALLS_USED=1
```

Qualifying expectation met for execution output. Continue to pre-apply proof.

---

## Phase U — Post-Provider Safety Marker

**PASS**

```
EXACT_PROVIDER_COMPLETED_AT=UNPROVEN
BUILD_AWAITING_APPLY_EVENT_AT=2026-08-20T08:25:03.247Z
POST_PROVIDER_SAFETY_CHECK_AT=2026-08-20T08:25:03.247Z
SESSION_AGE_AT_POST_PROVIDER_SAFETY_CHECK=314487 ms
REMAINING_IDLE_HEADROOM_AT_POST_PROVIDER_SAFETY_CHECK=1485513 ms
POST_PROVIDER_HEADROOM_GATE=PASS   (>= 300000 ms)
ALLOWED_POST_BUILD_AWAITING_APPLY_TO_APPLY_MS=300000
  MIN(300000, 1485513-120000)=300000
```

---

## Phase V — build_awaiting_apply Proof

**PASS**

PM2 `aisandbox-api-gateway`:

```json
{"event":"finalize_accounting.build_awaiting_apply","timestamp":"2026-08-20T08:25:03.247Z","executionId":"d3b8409f-18c8-42e4-a9fc-e8fcb7574494","executionIntent":"workspace_mutation"}
```

```
BUILD_AWAITING_APPLY_VERIFIED_AT=2026-08-20T08:26:51Z
```

---

## Phase W — Zero Premature Deduction

**FAIL — HARD STOP**

Query at `2026-08-20T08:27:11Z`:

```sql
SELECT COUNT(*) AS deduction_count
FROM credit_deduction_records
WHERE source_event_id = 'd3b8409f-18c8-42e4-a9fc-e8fcb7574494';
```

```
deduction_count=1
ZERO_DEDUCTION_VERIFIED_AT=2026-08-20T08:27:11Z
PRE_APPLY_DEDUCTION_COUNT=1
```

Required: count=0. Observed: count=1. Operator Apply was never clicked.

Deduction row:

```
source_event_id=d3b8409f-18c8-42e4-a9fc-e8fcb7574494
source_event_type=usage_ledger
requested_credits=1178
applied_credits=1178
overflow_credits=0
balance_before=30577
balance_after=29399
status=applied
created_at=2026-08-20 16:25:03.785809 +08  (= 2026-08-20T08:25:03.786Z)
credit_balances.balance after this event=29399
```

Same-second PM2 chain after `build_awaiting_apply`:

```
08:25:03.247Z  finalize_accounting.build_awaiting_apply
08:25:03.783Z  deduction_attempt  source=usage_ledger tokensUsed=1178
08:25:03.800Z  credit_deduction.persisted  applied=1178 overflow=0 30577→29399
08:25:03.800Z  confirm_build_apply.deduction_triggered  persistedFileActionCount=1
```

Interval from `build_awaiting_apply` to persisted deduction ≈ **553 ms**. No operator Apply occurred. No second provider call was made.

Frozen runbook Phase W / hard-stop 26.5: STOP. Do not Apply. Do not retry provider. Safe cleanup + gate restore only.

**Possible application/product defect exposed. DO NOT FIX inside E2E-05.** Repair requires a separate OS v1 task.

---

## Phases X–AJ — Apply / Checkpoint / 03J / Balance / Preview / Manual Checkpoint

**NOT EXECUTED — blocked by Phase W**

```
APPLY_ATTEMPT_AT=NOT_ATTEMPTED
APPLY_SUCCESS_AT=NOT_ATTEMPTED
POST_BUILD_AWAITING_APPLY_TO_APPLY_MS=NOT_APPLICABLE
workspace apply result=NOT_ATTEMPTED
idle_timeout occurred=NO (hard-stopped before apply; session still active at hard stop)
automatic checkpoint=NOT_EXECUTED
public 03J confirm observed by operator=NO (operator did not Apply; no intentional confirm request sent)
public confirm HTTP status=NOT_CAPTURED_AS_OPERATOR_ACTION
confirm_build_apply.deduction_triggered observed in PM2=YES (at 08:25:03.800Z, without operator Apply)
MANUAL_CHECKPOINT_REQUIRED=YES (frozen) / NOT_EXECUTED
workspace/file validation=NOT_EXECUTED (host/UI post-apply validation skipped)
preview validation=NOT_EXECUTED
03H focus-refetch=see continuation: tab-switch-alone did NOT update; post-interaction GET /api/billing/balance HTTP 200 balance=29399; displayed 29399
```

Note: PM2 emitted `confirm_build_apply.deduction_triggered` without an operator Apply/confirm action. That is evidence of the premature-accounting failure, not a PASS for the public 03J criterion. Public DevTools Network proof of `POST /api/ai/executions/<id>/confirm-build-apply` was not captured as a successful operator-driven confirm.

---

## Phase AK — Session Cleanup

**PENDING operator DELETE at time of this hard-stop write**

Frozen supported cleanup: `DELETE /api/sessions/820bc0ab-3b24-499f-9ceb-e40f112496ec`  
Project disposition: RETAIN (`E2E-05-Disposable-2026-08-20` / `21b26811-8343-48bb-91ec-7a1734db1d4b`)

Do not invent project deletion. Leftover non-subject sessions/containers not touched.

---

## Phase AL — Mandatory Gate Restoration

**PASS — restored regardless of FAIL**

```
R1 root .env GLOBAL_EXECUTION_ENABLED=false (unchanged throughout)
R2 GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
R3 PM2 GLOBAL_EXECUTION_ENABLED=false
R4 GET /api/health/ready=200
R5 PM2 BILLING_CHARGES_ENABLED=false
restoration UTC≈2026-08-20T08:27:54Z
```

Root `.env` was never edited.

---

## Phase AM — Final Provider Count

```
PROVIDER_CALLS_AUTHORIZED=1
PROVIDER_CALLS_USED=1
NEVER >1 = YES
NO_RETRY=YES
```

---

## Phase AN — Duplicate / Payment Safety

```
final deduction COUNT for EXECUTION_ID=1
duplicate deduction (>1)=NO
second confirm intentionally sent by operator=NO
BILLING_CHARGES_ENABLED throughout=false
Stripe/payment path=NO evidence of Stripe/charge; BILLING_CHARGES_ENABLED remained false
unrelated credit mutation=NO additional E2E-05 operator mutations after the single premature row
```

The single deduction is the failing premature event (tokens_used=1178 = requested=applied). It is not a duplicate. Arithmetic of that row: `30577 - 1178 = 29399` matches `balance_after` and current `credit_balances.balance`. That arithmetic does **not** convert the run to PASS; the deduction occurred before qualifying apply.

---

## Safety Invariants at Terminal Write

| Flag | Final |
|------|--------|
| GLOBAL_EXECUTION_ENABLED (PM2) | false |
| GLOBAL_EXECUTION_ENABLED (root .env) | false |
| BILLING_CHARGES_ENABLED | false |
| AGENT_HARNESS_ENABLE_TOOL_LOOP | false (not altered) |
| staging HEAD | `c3e39279abe3c0d6c348daa312107c8f6fc592b7` |
| staging worktree | CLEAN |
| retained stash SHA | `0372cc1f47f82e1db060ed2dd756a938fe324803` |

---

## Terminal Verdict

```
E2E-05=FAIL/BLOCKED
EXACT_TERMINAL_REASON=Phase W zero-pre-apply-deduction failed: credit_deduction_records COUNT=1 for execution d3b8409f-18c8-42e4-a9fc-e8fcb7574494 at 2026-08-20T08:25:03.786Z, ~553ms after finalize_accounting.build_awaiting_apply, with no operator Apply
SOURCE_REPAIR_IN_E2E-05=NOT_PERFORMED
PROVIDER_RETRY=NOT_PERFORMED
```

Corrected session-timing/headroom gates PASS. Qualifying `workspace_mutation` / `fileActions` / `e2e-05.html` / `build_awaiting_apply` PASS. The run hard-stopped on the deferred-accounting contract: deduction must not occur before qualifying apply.

E2E-05 remains ACTIVE. TASKS.md / TASKS_BACKLOG_FULL.md were not updated (Step 4 governance). Lane 1 retains STAGING, PROVIDER-LIVE, CREDIT, ENV until Step 4.

---

## Recommended Step 4 Input

PRIVATE-BETA-E2E-05 Step 4 consolidation should record this Step 3 execution evidence as FAIL/BLOCKED, keep E2E-04 historical FAIL/BLOCKED unchanged, keep 03K locked PASS (timing procedure worked), and must **not** treat premature `confirm_build_apply.deduction_triggered` as proof that public 03J confirm-after-apply succeeded. A source-defect follow-up, if any, requires a separate OS v1 registered task. Do not retry the provider inside E2E-05. PRIVATE-BETA-INVITE-01 remains prohibited. BUILDER_PRIVATE_BETA_READINESS remains NO_GO pending control-plane judgment.

> **Superseded for current classification:** see Bounded Apply / Frontend-State Clarification. Do not use this original Step 4 input until Step 3 finishes from the already-applied state.

---

## Bounded Apply / Frontend-State Clarification (same Step 3 — 2026-08-20)

**Scope:** read-only re-evaluation after Keith reported no separate Apply button. Not a new task. Not Step 4. No source/test/config mutation. No provider retry. No refresh. No session terminate. `GLOBAL_EXECUTION_ENABLED` remained false.

The original Phase W FAIL treated “no Apply click” as “no apply.” That interpretation was **provisional** and is **retracted**.

### Part A — Current frontend Apply contract

**Separate user-visible Apply button in current UI for this E2E prompt: NO.**

The Apply control exists only when `fileActionState.applyStatus === 'awaiting-confirmation'`. That state is set in `maybeApplyExecutionFileActions` (`frontend/app/[locale]/app/page.tsx`) only for:

- already-pending confirmation
- visual-edit executions
- `isRiskyFileActionBatch(actions)` — `>3` actions, any `delete`, content `>20000` chars, or risky path (`workspace-ai-file-actions.logic.ts`)

E2E-05: one small `create e2e-05.html`. Not risky. Not visual-edit.

**Current fileActions behavior: AUTO_APPLY** for non-risky `workspace_mutation`.

Exact path:

1. `consumeExecutionFileActions` → `void maybeApplyExecutionFileActions(executionId, source)`
2. `maybeApplyExecutionFileActions` skips the confirmation branch and `await applyExecutionFileActions(...)`
3. `applyExecutionFileActions` → `applySequentialFileActions` → `writeWorkspaceFile` (`POST /api/sessions/:sessionId/files/write`)
4. Results are stored with `result.status = 'success'` only after `writeFile` resolves without throw
5. UI `WorkspaceChatFileActions` (`workspace-shell.tsx`) renders translation key `fileActionResults` (“File Action Results”) plus `{action} {path}` and `{result.status}`

**Meaning of “File Action Results … success” = C (file write succeeded in the workspace).** It is not mere parse success. It is not checkpoint completion. `applySequentialFileActions` sets `status: 'success'` only after `await args.writeFile(action)` returns; `writeWorkspaceFile` throws unless the write HTTP response is OK.

The Apply button label (`props.aiMessages.apply`, test id `workspace-chat-file-actions-confirm-button`) is shown only in the awaiting-confirmation branch. Keith’s observed UI was the post-apply results list, which matches AUTO_APPLY.

Staging tree `/opt/aisandbox/frontend/app/[locale]/app/page.tsx` contains the same functions/line numbers (`maybeApplyExecutionFileActions` 5034, `applyExecutionFileActions` 4981, `isRiskyFileActionBatch` 5098, `confirmBuildApplyIfQualifying` 5024).

### Part B — Public confirm contract

After qualifying apply, **automatic** (no extra click):

```
applyExecutionFileActions
  → confirmBuildApplyIfQualifying(...)
      confirmBuildApply: requestBuildApplyConfirmation
```

`requestBuildApplyConfirmation` POSTs `/api/ai/executions/:executionId/confirm-build-apply` with `{ applyStatus, totalActions, successCount }`.

Prerequisites (`qualifyBuildApplyConfirmation`): `applyStatus === 'applied'` and every result `success`.

Staging topology (03J): Caddy `/api/*` → API Gateway. Browser POST hits **public** Gateway `AiExecutionController.confirmBuildApply` (`SessionOrApiKeyAuthGuard`), not the Next.js internal proxy. Public route does **not** emit `confirm_build_apply.request_received` (that event is internal-handler-only).

Ordering in current source: workspace write → set applied/success state → automatic confirm → later `maybeRunExecutionCoherence` automatic checkpoint.

### Part C — E2E-05 actual file state

```
FILE_APPLIED=YES
```

Evidence:

- Host: `/opt/aisandbox/workspaces/820bc0ab-3b24-499f-9ceb-e40f112496ec/e2e-05.html` exists; mtime `2026-08-20 16:25:03.717846859 +0800` = **2026-08-20T08:25:03.717Z**; size 186 bytes
- Container `5566e1c7abb9`: `/workspace/e2e-05.html` exists; mtime `2026-08-20 08:25:03 +0000`
- Exact frozen HTML contents match (5 lines as specified in the frozen prompt body)
- Workspace contains only `.git` and `e2e-05.html` (no unintended extra files)

No file mutation during clarification.

### Part D — Automatic checkpoint

```
AUTOMATIC_CHECKPOINT_CREATED=YES
AUTOMATIC_CHECKPOINT_HASH=3373a244d2ab43a9a76113fc356b25b94adf5abc
description=AI: applied workspace file actions
filesChanged=1
Git author date=2026-08-20 08:25:11 +0000
PostgreSQL git_checkpoints.created_at=2026-08-20 16:25:12.006841 +08 (= 2026-08-20T08:25:12.007Z)
SQLite checkpoints.created_at=2026-08-20 08:25:12
```

Git / PostgreSQL / SQLite agree on hash `3373a244d2ab43a9a76113fc356b25b94adf5abc`. Container-manager log: `Git checkpoint recorded: 3373a244...` at 4:25:12 PM local.

No new checkpoint was created during clarification.

### Part E — Public 03J confirm evidence

```
PUBLIC_CONFIRM_OBSERVED=YES
PUBLIC_CONFIRM_HTTP_STATUS=200
PUBLIC_CONFIRM_RESPONSE={"executionId":"d3b8409f-18c8-42e4-a9fc-e8fcb7574494","triggered":true,"reason":"completed"}
PUBLIC_CONFIRM_URL=POST /api/ai/executions/d3b8409f-18c8-42e4-a9fc-e8fcb7574494/confirm-build-apply
PUBLIC_CONFIRM_SOURCE=Chrome DevTools Network (workspace tab; no refresh)
confirm_build_apply.request_received=ABSENT (expected absent for public 03J route)
confirm_build_apply.deduction_triggered=YES at 2026-08-20T08:25:03.800Z
InternalServiceAuthGuard for confirm=NOT observed (only finalize-accounting internal grant was observed)
```

Do not classify this as bounded/unproven. Public 03J confirm path is **directly PROVEN** for E2E-05. A second confirm was not sent.

### Part F — Accounting events (unchanged timestamps)

| Event | Timestamp | Provenance |
|-------|-----------|------------|
| `finalize_accounting.build_awaiting_apply` | 2026-08-20T08:25:03.247Z | PM2 JSON, EXECUTION_ID match |
| Host/container file write mtime | 2026-08-20T08:25:03.717Z | filesystem |
| `credit_deduction_records.created_at` | 2026-08-20T08:25:03.786Z | PostgreSQL (`16:25:03.785809 +08`) |
| `confirm_build_apply.deduction_triggered` | 2026-08-20T08:25:03.800Z | PM2 JSON |
| Automatic git commit | 2026-08-20T08:25:11Z | container git |
| Checkpoint ledger rows | 2026-08-20T08:25:12Z | PostgreSQL + SQLite + CM log |

Deduction trigger path: public authenticated `POST /api/ai/executions/:executionId/confirm-build-apply` (03J). DevTools Network: HTTP 200 `{ "executionId":"d3b8409f-18c8-42e4-a9fc-e8fcb7574494", "triggered":true, "reason":"completed" }`. Matching `confirm_build_apply.deduction_triggered` at 2026-08-20T08:25:03.800Z. Internal `request_received` absent as expected. `source_event_type=usage_ledger`, `source_event_id=d3b8409f-18c8-42e4-a9fc-e8fcb7574494`, COUNT=1, requested=applied=1178.

### Part G — Actual ordering

```
BUILD_SUBMITTED                         2026-08-20T08:25:01.070Z   PROVEN_BOUNDED (execution.intent_written)
PROVIDER/EXECUTION_COMPLETE             UNPROVEN exact; bounded before 08:25:03.245Z
finalize_accounting.request_received    2026-08-20T08:25:03.245Z   PROVEN_EXACT
BUILD_AWAITING_APPLY                    2026-08-20T08:25:03.247Z   PROVEN_EXACT
WORKSPACE_FILE_WRITE / APPLY            2026-08-20T08:25:03.717Z   PROVEN_EXACT (mtime) + INFERRED_FROM_SOURCE (auto-apply)
CREDIT_DEDUCTION_ROW                    2026-08-20T08:25:03.786Z   PROVEN_EXACT
CONFIRM_DEDUCTION_TRIGGERED             2026-08-20T08:25:03.800Z   PROVEN_EXACT
PUBLIC_CONFIRM_BUILD_APPLY HTTP         2026-08-20 DevTools: HTTP 200 triggered=true reason=completed   PROVEN_EXACT
AUTOMATIC_CHECKPOINT                    2026-08-20T08:25:11Z / 08:25:12Z   PROVEN_EXACT
```

**Was qualifying workspace apply before credit deduction? YES.**

File mtime 08:25:03.717Z < deduction 08:25:03.786Z. Absence of a manual Apply click is not evidence that apply did not occur.

Current product order is write → confirm/deduct → automatic checkpoint. The frozen runbook’s “click Apply after operator V/W checks” was a **runbook/evidence-model error** for this non-risky one-file Build, not an application defect.

### Part H — Stale frontend bundle

```
STALE_FRONTEND_BUNDLE=POSSIBLE (browser cache vs deployed .next); UNPROVEN as Keith-loaded chunks
deployed .next BUILD_ID=dsXU3LgwJqI7I2EMko3o_
BUILD_ID mtime=2026-08-16 12:41:26 +0800
PM2 aisandbox-frontend uptime was 4D at preflight (started ~2026-08-16; not rebuilt during E2E-04 Gateway-only deploy)
staging git HEAD frontend source still contains AUTO_APPLY (verified on /opt/aisandbox)
```

Could stale bundle explain the missing Apply button? **NO** for this prompt. Keith saw the post-apply “success” results UI, which current source only renders after a successful write. Auto-apply of a non-risky single create is the current contract and is present on staging source. 03J changed Gateway, not this Apply UX.

Do not assume Keith’s Chrome is stale merely because no hard refresh occurred. Chunk hashes were not inspected (no refresh / no navigation).

**Future runbook correction (do not execute now):** before creating a future evidence project/session, hard-refresh the staging app page and confirm the browser is on the current deployed frontend, then create the fresh session. Keep 03H no-refresh/focus-refetch as its own later step. Do not hard-refresh in the middle of Build/apply/accounting evidence.

### Part I — Phase W verdict

```
PHASE_W_PRIOR_FAIL=RETRACTED
classification=A — deduction occurred after an automatic qualifying apply
WAS_DEDUCTION_GENUINELY_PRE_APPLY=NO
```

### Part J — Can the existing one-call E2E continue?

```
CONTINUE_FROM_ALREADY_APPLIED_STATE=YES
FAIL_BLOCKED=NO
PUBLIC_03J_CONFIRM=PROVEN
PROVIDER_CALLS_USED=1
NO_RETRY=YES
GLOBAL_EXECUTION_ENABLED=false (must remain false)
SESSION_CLEANUP_NOW=NO
BALANCE_DB_AFTER=29399
EXPECTED_BALANCE_AFTER=29399
EXPECTED_DEDUCTION=1178
BALANCE_BEFORE=30577
authoritative DB/API/browser arithmetic=PASS (30577-1178=29399)
03H_UPDATED_BALANCE_VISIBLE=YES
03H_SAME_WINDOW_TAB_SWITCH_ALONE=DID_NOT_PRODUCE_UPDATED_BALANCE
```

Already satisfied: qualifying `workspace_mutation` / 1 fileAction / `e2e-05.html` / `build_awaiting_apply` / apply success / no idle_timeout / automatic checkpoint / public 03J confirm HTTP 200 / deferred accounting / exactly one deduction / DB=API=Browser=EXPECTED_BALANCE_AFTER=29399.

Still outstanding (no second provider call): preview render; manual checkpoint; session/container cleanup; duplicate/Stripe final checks.

Clarification mutations: none. Credits not mutated during clarification. Staging git/worktree/stash untouched. Local Git: only this evidence file.

---

## Continuation after public 03J DevTools proof (same Step 3)

Keith observed in Chrome DevTools Network, workspace tab, **no refresh**:

```
PUBLIC_CONFIRM_OBSERVED=YES
PUBLIC_CONFIRM_HTTP_STATUS=200
PUBLIC_CONFIRM_RESPONSE={"executionId":"d3b8409f-18c8-42e4-a9fc-e8fcb7574494","triggered":true,"reason":"completed"}
POST /api/ai/executions/d3b8409f-18c8-42e4-a9fc-e8fcb7574494/confirm-build-apply
```

Read-only re-query 2026-08-20T08:56:28Z:

```
BALANCE_DB_AFTER=29399
deduction COUNT=1
GLOBAL_EXECUTION_ENABLED=false
BILLING_CHARGES_ENABLED=false
```

No further browser action had been taken at that report. Next frozen evidence step is 03H: Chrome **same-window** switch to the already-open billing tab (not Alt+Tab, not F5/Ctrl+R).

---

## 03H / post-deduction balance (same Step 3) — observed semantics

```
POST_DEDUCTION_BALANCE_RECONCILIATION=PASS
AUTHORITATIVE_BALANCE_RECONCILIATION=PASS
BALANCE_BEFORE=30577
TOKENS_USED=1178
EXPECTED_DEDUCTION=1178
EXPECTED_BALANCE_AFTER=29399
FINAL_DEDUCTION_COUNT=1
BALANCE_DB_AFTER=29399
BALANCE_API_AFTER=29399
BALANCE_BROWSER_AFTER=29399
DB=API=Browser=EXPECTED_BALANCE_AFTER=29399
03H_UPDATED_BALANCE_VISIBLE=YES
NO_REFRESH=YES
NO_SECOND_PROVIDER_CALL=YES
GLOBAL_EXECUTION_ENABLED=false
```

**Do not claim that a same-window tab switch alone reliably triggered the 03H refetch in this run.**

Observed browser interaction:

1. Initial Chrome **same-window** switch to the already-open billing tab **by itself did NOT** produce the updated balance in Keith’s actual browser state.
2. After an **actual interaction on the billing page** (not F5, not Ctrl+R, not hard refresh), the latest `GET /api/billing/balance` returned HTTP 200:

```json
{
  "balance": 29399,
  "monthlyAllocation": 500,
  "planId": "free",
  "periodStart": "2026-07-31T16:00:00.000Z",
  "periodEnd": "2026-08-31T16:00:00.000Z",
  "status": "active"
}
```

3. The billing page then displayed **29399**.

Classification: authoritative three-way reconciliation **PASS**. Frozen “tab-switch-alone = 03H proof” criterion is **not proven** for this browser state. Updated balance visibility **is** proven after in-page billing interaction. Record this as observed 03H limitation, not as a second provider or a refresh.

Session remains open. Continue Step 3 with workspace file / preview / manual checkpoint. Do not terminate yet.

---

## Workspace file validation (same Step 3)

```
WORKSPACE_FILE_VALIDATION=PASS
file=e2e-05.html
editor contents=exact frozen HTML (5 lines)
no edit made
preview not opened yet at this report
host/container file previously proven identical
```

---

## Preview validation — FAIL (mandatory) — terminal Step 3 classification

Frozen authority (`docs/PRIVATE-BETA-E2E-05-STAGE-START.md`):

| Source | Text | Effect |
|--------|------|--------|
| §22 items 3–4 | Preview renders heading and paragraph — YES/NO | Required evidence |
| Evidence table “Preview rendering” | PASS: both elements visible. FAIL/Hard-Stop: either missing → FAIL | **Mandatory** |
| Hard-stop §26.14 | `e2e-05.html` content or preview is incorrect | Content already PASS; preview not rendered |
| §30 AQ | Any criterion FAIL → FAIL/BLOCKED | Terminal |
| §31 item 25 | “Open preview (if available)” | Operator hint only; does **not** mark the evidence-table criterion non-mandatory |

Keith observation (no Start Preview, no refresh, no file edit):

```
PREVIEW_VALIDATION=FAIL
preview pane heading=Preview unavailable
previewState (source-mapped)=unavailable
  frontend/components/workspace/workspace-shell.tsx — heading "Preview unavailable"
  when previewState === 'unavailable' (default initial state; body copy:
  "No preview is running for this workspace yet.")
heading PRIVATE-BETA-E2E-05 visible=NO
paragraph Post-03J confirm-build-apply validation succeeded. visible=NO
```

Answers to the five classification questions:

1. Preview validation **is a mandatory PASS criterion**. The frozen evidence table FAIL path is “Either missing → FAIL.” It is not classified non-mandatory.
2. “Preview unavailable” **is sufficient to FAIL** that criterion: neither required element was visible.
3. No additional non-mutating browser observation can make those elements visible. The reported heading is the exact `unavailable` state, not `loading` and not `error`. Clicking Start Preview would start preview runtime (mutating) and is forbidden by this hard-stop instruction. It would also be a reinterpretation of FAIL into recovery.
4. Read-only staging logs **do** clarify: Container Manager logged `Session stopped: 820bc0ab-... (reason: idle_timeout)` at **2026-08-20 17:08:28 +08**. PostgreSQL `sessions.status=stopped`, `terminated_at=2026-08-20 17:08:28.183`. `docker inspect 5566e1c7abb9` → no such object. Host `e2e-05.html` still present. No preview-start log for this session.
5. E2E-05 Step 3 **must terminally become FAIL/BLOCKED**. Do not repair. Do not retry provider. Do not Start Preview now.

```
PRIVATE-BETA-E2E-05 STEP 3 FAIL/BLOCKED — PREVIEW RENDERING FAIL (PREVIEW UNAVAILABLE; HEADING AND PARAGRAPH NOT VISIBLE) — SESSION ALREADY IDLE_TIMEOUT STOPPED — EXECUTION GATE RESTORED FALSE — NO RETRY AUTHORIZED — READY FOR STEP 4 CONSOLIDATION
```

Preserved successful evidence (do not discard):

- AUTO_APPLY + `e2e-05.html` exact content (host/container/editor)
- automatic checkpoint `3373a244d2ab43a9a76113fc356b25b94adf5abc`
- public 03J confirm HTTP 200 `triggered=true` `reason=completed`
- exactly-one deduction 1178 credits
- DB=API=Browser=29399
- workspace file validation PASS
- Phase W pre-apply FAIL remains RETRACTED
- 03H: updated balance visible after in-page billing interaction; tab-switch-alone did not refetch

Not executed / blocked by this hard-stop:

```
MANUAL_CHECKPOINT=NOT_EXECUTED (session already stopped; do not recreate)
```

Cleanup already satisfied by idle_timeout (no extra operator DELETE required):

```
SESSION_STATUS=stopped
TERMINATED_AT=2026-08-20 17:08:28.183 +08
CONTAINER=removed (docker inspect: no such object)
PROJECT_DISPOSITION=RETAIN (21b26811-8343-48bb-91ec-7a1734db1d4b)
GLOBAL_EXECUTION_ENABLED=false (PM2 + root .env)
BILLING_CHARGES_ENABLED=false
PROVIDER_CALLS_USED=1
STAGING_HEAD=c3e39279abe3c0d6c348daa312107c8f6fc592b7
RETAINED_STASH_SHA=0372cc1f47f82e1db060ed2dd756a938fe324803
worktree CLEAN
```

No source/test/config mutation. No second provider call. No refresh. No Start Preview. TASKS.md / TASKS_BACKLOG_FULL.md not updated (Step 4).

