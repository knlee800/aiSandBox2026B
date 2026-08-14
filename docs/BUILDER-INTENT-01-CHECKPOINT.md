# BUILDER-INTENT-01 — Final Consolidation Checkpoint

**Task ID:** BUILDER-INTENT-01
**Title:** Ask/Discuss vs Build/Edit Execution Intent
**Step:** Step 4 — Final Consolidation / Checkpoint
**Status:** COMPLETE AND LOCKED — 2026-08-13
**Created:** 2026-08-13
**Author:** Cursor / Sonnet 4.6 (consolidation only — no source/runtime modification)

---

## 1. Task Identity / Status

| Field | Value |
|-------|-------|
| Task ID | BUILDER-INTENT-01 |
| Title | Ask/Discuss vs Build/Edit Execution Intent |
| Family | BUILDER EXECUTION INTENT / APPLICATION-OWNED CONTRACT / PRIVATE-BETA PRODUCT READINESS |
| Priority | P0 — beta product blocker |
| Risk | HIGH |
| Workflow | HIGH-RISK 4-STEP |
| Registered | 2026-08-11 |
| Completed | 2026-08-13 |
| Final status | **COMPLETE AND LOCKED — 2026-08-13** |

Steps completed:

- Step 1 — Registration — COMPLETE — 2026-08-11
- Step 2 — Intent Contract + UX Stage-Start — COMPLETE — 2026-08-11 — Artifact: `docs/BUILDER-INTENT-01-STAGE-START.md`
- Step 2A — Frontend Test + Session-State Scope Correction — COMPLETE — 2026-08-11 (appended to Stage-Start)
- Step 3 — Bounded Implementation + Local Validation — COMPLETE — 2026-08-11
- Step 4 — Controlled Staging Validation + Consolidation — COMPLETE — 2026-08-13

---

## 2. Original Problem

03B (PRIVATE-BETA-BLOCKER-03B — COMPLETE AND LOCKED — 2026-08-11 — PASS) established the plain-path mutation contract:

```
!useHarness && safeFileActions.length === 0 → failed / file_action_contract_failure
```

This correctly prevents false-success Build/Edit completions but intentionally blocked all conversational requests. A valid Ask such as "Explain what HTML is" also produces zero file actions and therefore failed.

Keith explicitly requires Builder to support BOTH Ask/Discuss (conversational, zero-action) and Build/Edit (workspace mutation required) as first-class product behaviors. The distinction must be APPLICATION-OWNED — not delegated to the provider/model.

---

## 3. Locked Execution-Intent Architecture

### Contract field

`executionIntent: 'conversation' | 'workspace_mutation'`

- `conversation` — Ask/Discuss: zero file actions are valid completion; workspace must not be mutated
- `workspace_mutation` — Build/Edit: at least one valid safe action required; zero actions = `file_action_contract_failure`
- Default when absent: `workspace_mutation` (backward-compatible; preserves 03B safety for all legacy callers)

### Data path

```
Frontend segmented control (useState)
  → executionIntent in POST /api/ai/execute body
  → API Gateway validates + propagates to BullMQ job payload
  → WorkerProcessor: resolves intent (default: 'workspace_mutation')
  → validatePlainPathFileActionContract({ useHarness, safeFileActionCount, executionIntent })
  → conversation: complete normally; workspace_mutation: 03B rule preserved
```

### Authoritative owner

Application-owned. The provider/model cannot override the intent. `workspaceMutationAttempted` remains advisory/diagnostic only.

---

## 4. Ask Behavior

When `executionIntent === 'conversation'`:

- Zero file actions → `status: completed` (no contract failure)
- Unexpected provider-emitted actions → discarded server-side by WorkerProcessor before publish; `fileActions: []` sent to frontend; diagnostic logged
- `assistantText` displayed to user
- No workspace mutation
- No `file_action_contract_failure`
- Credit deduction triggered (completed execution consumed provider tokens)

---

## 5. Build Behavior

When `executionIntent === 'workspace_mutation'` (or absent, defaulting to workspace_mutation):

- ≥1 valid safe action → `status: completed`; actions applied to workspace
- 0 valid safe actions → `status: failed`; `file_action_contract_failure`; no mutation; no credit deduction
- 03B safety preserved exactly

---

## 6. Frontend Ask/Build UX

### Segmented control

Two-segment control in the workspace chat composer row:

```
[ Ask ]  [ Build ]
```

- Default: **Build** (`workspace_mutation`)
- State: `useState<ExecutionIntent>('workspace_mutation')` in `page.tsx`
- Sticky within component mount lifetime; resets to Build on page refresh or remount
- Short labels (3–5 characters) fit 390px mobile viewport
- Selected segment has visual emphasis

### Logic module

`frontend/components/workspace/workspace-execution-intent.logic.ts` — pure functions:

- `ExecutionIntent` type and `DEFAULT_EXECUTION_INTENT` constant
- `resolveExecutionIntent(raw)` — normalizes to typed enum with safe default
- `shouldApplyFileActions(executionIntent, fileActions)` — returns false in conversation mode
- `buildExecutionPayloadIntent(executionIntent)` — builds request payload fragment

---

## 7. API Gateway Propagation

- `executionIntent?` added to `AIExecutionRequest` in `services/api-gateway/src/clients/ai-service-http.client.ts`
- `AIExecutionController.execute()` accepts, validates, and propagates field to job payload
- Invalid or absent value defaults to `workspace_mutation`
- Field propagated via BullMQ job serialization — no queue architecture change

---

## 8. AI Worker Semantics

`services/ai-service/src/worker/worker.processor.ts`:

- Resolves `executionIntent` from `job.data` with safe default
- `validatePlainPathFileActionContract()` extended to accept `executionIntent`
- Conversation path: zero-action completion; unexpected actions discarded before publish
- Workspace mutation path: 03B rule preserved exactly
- Harness path: unchanged — plain-path validation not applied

---

## 9. Multilingual Implementation

Translation keys added to all three locale files:

| Key | en | zh-TW | zh-CN |
|-----|-----|-------|-------|
| `ai.intentAsk` | Ask | 提問 | 提问 |
| `ai.intentBuild` | Build | 建構 | 构建 |
| `ai.intentAskTooltip` | Get answers without changing files | 不修改檔案，直接取得回答 | 不修改文件，直接获取回答 |
| `ai.intentBuildTooltip` | Create or modify workspace files | 建立或修改工作區檔案 | 创建或修改工作区文件 |

Files: `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`

---

## 10. Mobile Workspace Layout Work

BUILDER-INTENT-01 also delivered approved responsive workspace layout changes:

- Mobile natural vertical scrolling (removes fixed overflow-hidden on mobile)
- AI panel: `min-h-[60dvh]` on mobile
- Preview panel: `min-h-[60dvh]` on mobile
- Editor panel: `min-h-[50dvh]` on mobile
- Desktop (md+) fixed layout preserved — no regression
- Ask/Build segmented control remains accessible at 390px
- 390px validation passed in controlled browser test

Previously observed horizontal overflow inside a generated preview app was classified as **generated-app responsiveness** (inside the iframe sandbox), not workspace-shell clipping. It is explicitly out of scope for BUILDER-INTENT-01.

---

## 11. Local Validation

### AI Service tests

- `worker-mutation-validation.spec.ts`: intent-aware validation tests — conversation pass, workspace_mutation fail, default behavior, action discarding — PASS
- AI Service offline-safe regression suite (excluding `ai-execution.phase30c`): PASS
- AI Service build: PASS

### API Gateway tests

- `ai-execution.controller.spec.ts`: intent acceptance and propagation — PASS
- API Gateway targeted suite: PASS
- API Gateway build: PASS

### Frontend tests

- `workspace-execution-intent.logic.test.ts`: 12 tests — default, resolution, shouldApplyFileActions, payload construction — PASS
- `workspace-shell.test.tsx` (appended i18n block): intentAsk/intentBuild/intentAskTooltip/intentBuildTooltip present in en/zh-TW/zh-CN — PASS
- Frontend TypeScript: PASS
- Frontend build: PASS

---

## 12. Initial Staging Ask Validation — PASS

**Execution ID:** `cd937e68-f440-4efa-a698-46ec2e7f4b7b`

| Field | Value |
|-------|-------|
| Provider/model | xAI / grok-4.5 |
| selectedPath | plain |
| executionIntent | conversation |
| status | completed |
| provider file actions | 0 |
| effective file actions | 0 |
| workspaceMutationAttempted | false |
| finalContractResult | passed |
| file_action_contract_failure | none |
| workspace mutation | none |

Browser response: "HTML (HyperText Markup Language) is the standard language used to structure and present content on web pages."

**This validation must NOT be repeated.**

---

## 13. Historical First Build Attempt — Contract PASS / File-Apply FAIL

**Execution ID:** `25eb1efb-c1ed-4136-b724-4a5a7b271600`

The Builder intent contract itself PASSED:
- `executionIntent=workspace_mutation`
- `parseMethod=structured_json`
- exactly one valid file action
- `finalContractResult=passed`

However, downstream file apply failed with `File write failed (502)`.

**Root cause:** Session `e0c1d71a-35ff-4ea4-aad0-b897fc28ba45` was approximately 51 minutes old. Container-manager `SESSION_IDLE_TIMEOUT_MS=1800000` (30 min) triggered synchronous container cleanup inside the write request path, racing the Gateway's 10-second HTTP client timeout. The Gateway timeout fired before container-manager responded → HTTP 502.

This root cause became **PRIVATE-BETA-BLOCKER-03E — Session Idle Timeout / File-Apply Lifecycle**.

---

## 14. PRIVATE-BETA-BLOCKER-03E Dependency / Resolution

**03E is COMPLETE AND LOCKED — 2026-08-13**
**Checkpoint:** `docs/PRIVATE-BETA-BLOCKER-03E-CHECKPOINT.md`

03E resolved the stale-session / file-apply lifecycle blocker by:

1. **03E-A** — Decoupled container cleanup from the request path (fire-and-forget); expired requests return HTTP 410 in < 100 ms instead of racing the gateway timeout
2. **03E-B** — Propagated session termination from container-manager SQLite to API Gateway Postgres (active notification + lazy reconciliation)
3. **03E-C** — Classified HTTP 410 at the frontend as `session_expired` with deterministic localized recovery copy (`ai.fileWriteSessionExpired`)

Staging proof: 109.5 ms HTTP 410 on stale session (versus previous ~10-second timeout race / HTTP 502). Cross-store reconciliation proof: Postgres updated from `status=active/terminated_at=null` to `status=stopped/terminated_at=2026-08-13T18:00:09.423/termination_reason=idle_timeout` on deterministic 410.

---

## 15. Final Fresh-Session Build E2E — PASS

**Project:** 03B Validation 2026-08-11

**Fresh session:** `c14e8df6-1644-4772-b037-f7ff30d2e540`

**Old stale session NOT reused:** `e0c1d71a-35ff-4ea4-aad0-b897fc28ba45`

### Preflight (before provider execution)

- Postgres: status=active, terminatedAt=null
- container-manager: active, terminated_at=null
- Docker runtime: running
- `builder-intent-validation.txt`: absent
- Only user workspace file: `index.html` (3419 bytes, mtime 2026-08-13 21:40:03, SHA-256 `25aed922445ee221f8f33e85b7877e89c9da4044cf36cbec1f8b7f70ef9097f6`)

### Execution

**Execution ID:** `a7b77c98-10b4-4cfb-a971-f720fc8ce2ca`

| Field | Value |
|-------|-------|
| Provider/model | xAI / grok-4.5 |
| selectedPath | plain |
| useHarness | false |
| enableToolLoop | false |
| executionIntent | workspace_mutation |
| status | completed |
| tokens | 2132 |
| parseMethod | structured_json |
| provider file actions | 1 |
| effective/published actions | 1 |
| workspaceMutationAttempted | true |
| finalContractResult | passed |
| executionError | null |
| worker jobs | 1 (no retry) |
| provider retry | none |

Exact generated action:
- action: `create`
- path: `builder-intent-validation.txt`
- content: `BUILDER-INTENT-01 Build mode passed.`

Browser result: "File Action Results: create builder-intent-validation.txt — success"

---

## 16. Server-Side Persistence — PASS

| Field | Value |
|-------|-------|
| Path | `/opt/aisandbox/workspaces/c14e8df6-1644-4772-b037-f7ff30d2e540/builder-intent-validation.txt` |
| Size | 36 bytes |
| mtime | 2026-08-13 21:52:42.907 +0800 |
| SHA-256 | `c226ccb5017954febda6032349dd57907aed4ed050173f98c82f9e571b9019d3` |
| Content | `BUILDER-INTENT-01 Build mode passed.` (no trailing newline) |

Workspace mutation boundary:
- Before: `index.html` only
- After: `index.html` + `builder-intent-validation.txt`

`index.html` remained exactly unchanged (same size, mtime, SHA-256). No other user file created, edited, or deleted. `.git` metadata appeared as checkpoint/runtime metadata — not a Builder-requested workspace file action.

---

## 17. Refresh Persistence — PASS

Keith manually refreshed the workspace after server-side verification:
- `builder-intent-validation.txt` remained present
- Content remained exactly correct
- No HTTP 410, 502, or session-expired File Action Result

Browser persistence acceptance criterion: **SATISFIED**.

---

## 18. Accounting Evidence

| Metric | Value |
|--------|-------|
| Balance before final Build | 3855 |
| Provider tokens | 2132 |
| Credits requested | 2132 |
| Credits applied | 2132 |
| Overflow | 0 |
| Balance after | 1723 |
| Ledger status | completed / applied |
| Deduction ID | `762f4270-5754-4bc5-9e7d-eb025e13955d` |
| Execution linkage | `a7b77c98-10b4-4cfb-a971-f720fc8ce2ca` |

Credit deduction triggered correctly for a completed execution. This is consistent with the design: completed Ask and Build executions both trigger deduction.

**Do NOT decide refund/accounting policy here.** The 2,145 credits consumed by the historical failed Build execution (`25eb1efb-c1ed-4136-b724-4a5a7b271600`) remain a separate matter under **PRIVATE-BETA-BLOCKER-03D** (NOT REGISTERED).

---

## 19. Safety / Gate Evidence

After the single Build execution:

| Gate | State |
|------|-------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — verified in `/opt/aisandbox/.env` and API Gateway PM2 runtime |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` |

All five PM2 processes: online. Watchdog: healthy. Redis: healthy.

`GLOBAL_EXECUTION_ENABLED` was restored to `false` after the controlled Build execution. It must not be re-enabled without explicit authorization.

---

## 20. Known Limitations and Anomalies

### Anomaly: Manual Checkpoint HTTP 500 After Successful File Write

After the successful file write at approximately 21:52:42, the API Gateway logged:

```
Failed to create manual checkpoint … HTTP 500
```

at approximately 21:52:46.

**Important facts:**
- The file action itself succeeded
- Server-side file persisted (36 bytes, SHA-256 confirmed)
- Refresh persistence passed
- `.git` metadata exists in the workspace
- This was NOT the previous 03E file-apply 502
- It occurred after the requested file had already been written and persisted

**Classification:** This anomaly is **outside the BUILDER-INTENT-01 acceptance boundary**.

The Step 4 acceptance criterion "Build/Edit success path validated" is satisfied by: `executionIntent=workspace_mutation` → `status=completed` → 1 valid file action applied → workspace mutated → file persisted → browser refresh confirmed. The contract for BUILDER-INTENT-01 is the execution-intent mechanism, not checkpoint-creation reliability.

**This does NOT prevent BUILDER-INTENT-01 from locking.**

The anomaly is recorded here as a separate product-quality concern:

**Recommendation:** Register a follow-up quality task — Manual Checkpoint HTTP 500 Post-File-Write — to diagnose and remediate the checkpoint creation failure path. Severity: Medium (file action succeeds; only checkpoint creation fails; workspace is correctly mutated). Do NOT absorb into BUILDER-INTENT-01. Do NOT investigate in this consolidation step.

### Build/Edit Zero-Action Contract-Failure Validation — Test Evidence Only

The "Build/Edit zero-action contract-failure path validated" criterion (Step 4) was satisfied by deterministic test evidence from Step 3 (`worker-mutation-validation.spec.ts`) per the Stage-Start §28C plan. No third live provider call was made. This is the explicitly approved validation method and the criterion is satisfied.

### 03E Active Notification Path — Staging Limitation

03E active `notifySessionStopped` path was not freshly triggered on staging because the reused stale session was already terminal in CM SQLite. Lazy reconciliation was proven live. Active notification is covered by local tests. Recorded in `docs/PRIVATE-BETA-BLOCKER-03E-CHECKPOINT.md` §15.

---

## 21. Exact Implementation Files

### Source (BUILDER-INTENT-01 Step 3)

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-execution-intent.logic.ts` | NEW — ExecutionIntent type, DEFAULT_EXECUTION_INTENT, resolveExecutionIntent(), shouldApplyFileActions(), buildExecutionPayloadIntent() |
| `frontend/components/workspace/workspace-shell.tsx` | Ask/Build segmented control; executionIntent + onExecutionIntentChange props |
| `frontend/app/[locale]/app/page.tsx` | useState\<ExecutionIntent\>('workspace_mutation'); pass to workspace-shell; include in POST /api/ai/execute body |
| `frontend/messages/en.json` | ai.intentAsk, ai.intentBuild, ai.intentAskTooltip, ai.intentBuildTooltip |
| `frontend/messages/zh-TW.json` | Same keys, Traditional Chinese |
| `frontend/messages/zh-CN.json` | Same keys, Simplified Chinese |
| `services/api-gateway/src/clients/ai-service-http.client.ts` | executionIntent? added to AIExecutionRequest |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Accept, validate, propagate executionIntent to job payload |
| `services/ai-service/src/queue/job.types.ts` | executionIntent? added to AiExecutionJob |
| `services/ai-service/src/worker/worker.processor.ts` | Resolve executionIntent; intent-aware validatePlainPathFileActionContract; conversation-mode action discarding + diagnostics |

### Test (BUILDER-INTENT-01 Step 3)

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-execution-intent.logic.test.ts` | NEW — 12 tests covering default, resolution, shouldApplyFileActions, payload construction |
| `frontend/components/workspace/workspace-shell.test.tsx` | APPENDED — i18n key validation block for intentAsk/intentBuild/intentAskTooltip/intentBuildTooltip |
| `services/ai-service/src/worker/__tests__/worker-mutation-validation.spec.ts` | Intent-aware validation tests |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | executionIntent acceptance and propagation tests |

### Source (03E — session lifecycle fix, separate task)

| File | Change |
|------|--------|
| `services/container-manager/src/sessions/sessions.service.ts` | Fire-and-forget cleanup + GoneException; notifySessionStopped |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Lazy reconciliation on deterministic 410 |
| `services/api-gateway/src/sessions/internal-session.controller.ts` | Termination reason acceptance |
| `frontend/components/workspace/workspace-file-navigation.logic.ts` | HTTP 410 classified as session_expired |
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | ai.fileWriteSessionExpired key |

---

## 22. Acceptance-Criteria Review

### Step 1 (Registration) — ALL COMPLETE

All Step 1 criteria met. BUILDER-INTENT-01 registered 2026-08-11.

### Step 2 (Intent Contract + UX Stage-Start) — ALL COMPLETE

- [x] Stage-Start artifact produced — `docs/BUILDER-INTENT-01-STAGE-START.md`
- [x] Authoritative intent owner locked
- [x] Exact intent values + backward-compatible default locked
- [x] Request/data path locked end-to-end
- [x] WorkerProcessor semantic rule locked without weakening 03B mutation protection
- [x] UI control decided — segmented Ask/Build control
- [x] Exact bounded UX + multilingual impact locked
- [x] Exact source/test file scope locked
- [x] Local + controlled staging validation plan recorded
- [x] Rollback plan recorded
- [x] No code changes / no provider calls in Step 2

### Step 3 (Bounded Implementation + Local Validation) — ALL COMPLETE

- [x] Only approved Stage-Start contract/UX implemented
- [x] Required regression invariants covered by tests
- [x] No staging/provider execution during Step 3
- [x] GLOBAL_EXECUTION_ENABLED=false during Step 3
- [x] Scope did not expand materially beyond Stage-Start

### Step 4 (Controlled Staging Validation + Consolidation) — ALL COMPLETE

- [x] Ask/Discuss path validated (completed + zero actions + no mutation) — PASS — execution `cd937e68-f440-4efa-a698-46ec2e7f4b7b`
- [x] Build/Edit success path validated — PASS — execution `a7b77c98-10b4-4cfb-a971-f720fc8ce2ca` — file persisted — refresh confirmed
- [x] Build/Edit zero-action contract-failure path validated — by test evidence per Stage-Start §28C (`worker-mutation-validation.spec.ts`)
- [x] Gate returned to `GLOBAL_EXECUTION_ENABLED=false` — confirmed post Build execution
- [x] Checkpoint created — this document
- [x] BUILDER-INTENT-01 marked COMPLETE AND LOCKED — 2026-08-13
- [x] PRIVATE-BETA-INVITE-01 untouched
- [x] 03C/03D remain NOT REGISTERED; 03E COMPLETE AND LOCKED — 2026-08-13

---

## 23. Out-of-Scope Items

These items are explicitly recorded as NOT absorbed into BUILDER-INTENT-01:

| Item | Status |
|------|--------|
| PRIVATE-BETA-BLOCKER-03C — Grok 4.2 Timeout Diagnosis | NOT REGISTERED — separate |
| PRIVATE-BETA-BLOCKER-03D — No-Workspace-Result Credit Policy | NOT REGISTERED — separate |
| PRIVATE-BETA-BLOCKER-03E — Session Idle Timeout / File-Apply Lifecycle | COMPLETE AND LOCKED — 2026-08-13 — resolved as dependency |
| Failed Build execution credit refund (25eb1efb) | 03D scope — separate |
| Manual checkpoint HTTP 500 post-file-write | Quality follow-up — separate |
| Generated-app horizontal overflow inside preview iframe | Generated-app responsiveness — separate |
| PRIVATE-BETA-INVITE-01 | Untouched — prohibited |
| Automatic session recreation / resume | Explicitly out of scope |
| Harness activation | Explicitly out of scope |

---

## 24. Final Verdict

**BUILDER-INTENT-01 — COMPLETE AND LOCKED — 2026-08-13 — PASS**

The Ask/Build execution-intent mechanism is staging-proven:

- **Ask (conversation):** conversational requests complete with assistant text, zero file actions, no workspace mutation, no contract failure, and trigger credit deduction.
- **Build (workspace_mutation):** mutation requests complete with valid file actions applied to the workspace, files persist through browser refresh, and trigger credit deduction.
- **03B protection preserved:** absent or invalid `executionIntent` defaults to `workspace_mutation`; zero actions on the plain path remain `file_action_contract_failure`.
- **Fresh session lifecycle:** the 03E stale-session blocker did NOT recur. The fixed session lifecycle (fire-and-forget cleanup + cross-store sync + deterministic 410) held throughout the controlled Build E2E rerun.
- **Mobile layout:** responsive workspace approved changes delivered and validated at 390px.
- **All safety gates:** remained false throughout. Restored to false after controlled execution.

---

## 25. Next Recommended Task

**PRIVATE-BETA-BLOCKER-03C — Grok 4.2 Timeout Diagnosis**

Per the authoritative task ordering established across TASKS.md and TASKS_BACKLOG_FULL.md:

```
BUILDER-INTENT-01 → PRIVATE-BETA-BLOCKER-03C → PRIVATE-BETA-BLOCKER-03D → fresh PRIVATE-BETA-E2E rerun → Final GO/NO-GO review
```

03C and 03D remain NOT REGISTERED. 03C should be registered and diagnosed before proceeding to 03D or the E2E rerun.

**Do NOT register 03C automatically.** Registration requires Keith's explicit approval per governance rules.

**PRIVATE-BETA-INVITE-01 remains untouched / prohibited.** Invitations must not be issued without explicit approval.

---

*Checkpoint created: 2026-08-13 — BUILDER-INTENT-01 Step 4 Final Consolidation — no source/runtime modification.*
