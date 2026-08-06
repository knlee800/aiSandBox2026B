# PRIVATE-BETA-FUNCTIONAL-READINESS-04 — Readiness Plan

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-04
**Type:** Controlled Staging AI Execution Enablement and Core Product Loop Smoke
**Status:** ACTIVE — BLOCKED pending FR-04C — 2026-08-06 — Step 1 COMPLETE — FR-04A COMPLETE and LOCKED — PASS — Optional Anthropic readiness only — FR-04B COMPLETE and LOCKED — PASS — Stale provider/model catalogue blocker RESOLVED in source — FR-04 source prerequisites COMPLETE — Staging finding: deployed builds older than FR-04A/04B (API Gateway lacks `grok-4.5`; AI Service still has stale `grok-3`) — FR-04 Step 3a stopped before PM2 restart — `/opt/aisandbox/.env` restored to safe posture — Child FR-04C ACTIVE — Step 1 COMPLETE — Runtime execution remains disabled and unauthorized — No private-beta users may be invited — AI execution remains disabled
**Author:** Cursor / Sonnet 4.6 (amended 2026-08-06 — xAI / multi-model audit correction; amended 2026-08-06 — FR-04B registration; amended 2026-08-06 — FR-04B COMPLETE and LOCKED; amended 2026-08-06 — FR-04C registration)
**Date:** 2026-08-06
**Keith approval:** Registration approved 2026-08-06
**Child:** PRIVATE-BETA-FUNCTIONAL-READINESS-04A — COMPLETE and LOCKED — 2026-08-06 — PASS — Checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04A-CHECKPOINT.md` — **Scope retained as optional Anthropic configuration hardening only. Do not treat FR-04A as selecting Anthropic for FR-04 smoke. Do not modify the locked FR-04A checkpoint.**
**Child:** PRIVATE-BETA-FUNCTIONAL-READINESS-04B — COMPLETE and LOCKED — 2026-08-06 — PASS — Provider Model Catalogue and Selection Hardening — Checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-CHECKPOINT.md` — Plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-IMPLEMENTATION-PLAN.md` — **Stale catalogue blocker resolved in source. FR-04 source prerequisites complete.**
**Child:** PRIVATE-BETA-FUNCTIONAL-READINESS-04C — ACTIVE — Step 1 COMPLETE — Controlled Staging Deployment of FR-04A/04B — Plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-DEPLOYMENT-PLAN.md` — **Does not enable xAI execution. Deploys application code/artifacts only while preserving safe env posture.**
**Audit outcome (2026-08-06):** **Outcome A amended** — Existing xAI path and per-request provider/model selection exist in source. FR-04B catalogue/default hardening is now COMPLETE and LOCKED. Staging still requires FR-04C deployment before FR-04 Step 2/3a.
**Exact next action:** PRIVATE-BETA-FUNCTIONAL-READINESS-04C Step 2a — deployment readiness and artifact verification (no staging mutation)

---

## 1. Context and Preconditions

The following have been proven on staging:

- Authentication and email verification (FR-01 / PRIVATE-BETA-DEPLOYMENT-READINESS)
- Project creation and open (FR-02)
- Workspace and session connection, reconnect on refresh (FR-02)
- File tree and editor loading with real imported file (`README.md`) (FR-03A)
- ZIP import path (AI panel → Open history → Project Snapshots → Import Project) (FR-03A)

AI execution remains intentionally disabled:

- `GLOBAL_EXECUTION_ENABLED=false` in api-gateway PM2 environment
- `AI_PROVIDER=stub` in api-gateway PM2 environment (documented staging posture)
- No runtime step may assume a live provider key is present until Keith verifies the current staging xAI configuration path

Separate unresolved finding (not addressed here):

- `GET /api/preview/<session-id>/status` returns HTTP 404

---

## 2. Goal

Prove the core product loop on staging:

> User submits one bounded AI request → AI execution completes → AI creates one disposable file → file tree refreshes to show the new file → editor opens the new file with expected content → workspace state persists after page refresh.

This covers Journeys 2–3 from the minimum functional private beta requirements (FR-01 audit, Section 6):

- **Journey 2:** AI prompt submission and execution
- **Journey 3:** AI file creation and workspace refresh

Journey 4 (git checkpoint) and Journey 5 (page refresh persistence after AI execution) are observed opportunistically but are not blocking gates for this task.

---

## 3. Planning Decisions

### 3.1 Provider and Model Selection — CORRECTED AUDIT (2026-08-06)

**Correction:** The prior plan incorrectly assumed Anthropic for the controlled staging smoke because FR-04A added `ANTHROPIC_MODEL`. That assumption is withdrawn.

Keith confirms:

- xAI was already configured previously.
- The platform should support choosing between different providers and models.
- Anthropic must not be selected merely because FR-04A added `ANTHROPIC_MODEL`.

**Preferred smoke provider: `xai`** (if the current staging xAI configuration path is verified complete and safe).

**FR-04A status:** COMPLETE and LOCKED — remains valid only as **optional Anthropic readiness**. Locked FR-04A checkpoint must not be modified. Anthropic is not required for FR-04 smoke.

#### 3.1.1 Existing source capability (verified)

| Item | Finding |
|---|---|
| xAI implemented? | **Yes** — `XAIAdapter` in `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` |
| Provider identifier | Exact string: **`xai`** |
| xAI API key env | **`XAI_API_KEY`** |
| Key expected where | **API Gateway** (`ProviderValidator` startup check when `AI_PROVIDER=xai`) **and** **AI Service** (`AIExecutionService.getAdapter('xai')` — actual API calls) |
| xAI model source | **Post-FR-04B:** catalogue default **`grok-4.5`**; allowed `grok-4.5`, `grok-4.20`; request.model override validated against catalogue |
| Implemented providers | `stub`, `anthropic`, `openai`, `groq`, `xai`, `deepseek` (+ test-only `test-harness-stub` in ai-service) |
| Provider allowlist | API Gateway `SUPPORTED_AI_PROVIDERS` + `ProviderValidator` |
| Model allowlist | **Yes (FR-04B)** — dual-layer catalogue validation in API Gateway and AI Service |
| Frontend selector | **Yes** — workspace chat model selector (`data-testid="workspace-chat-model-selector"`) |
| Frontend default | **`xai:grok-4.5`** (post-FR-04B) |
| API accepts provider/model from frontend | **Yes** — `POST /api/ai/execute` body fields `provider` + `model` |
| AI Service respects values | **Yes** — adapter selected from `request.provider`; model validated/resolved via catalogue |
| Selection persistence | **Per-request** (also ephemeral React UI state). Not stored per user/project/session/agent as durable preference |
| Kill-switch asymmetry | `ExecutionSafetyGuard` checks **`process.env.AI_PROVIDER`**, not request body provider — staging smoke must set gateway `AI_PROVIDER=xai` even though the frontend also sends `provider: 'xai'` |
| Text-actions for smoke | Text `file-actions` block parsing is provider-agnostic in `AIExecutionService` — does **not** require `supportsToolUse` / harness tool loop. xAI is suitable for the bounded text file-create smoke |

#### 3.1.2 Existing staging configuration (not re-verified in this audit)

Documented staging posture (from prior FR docs; **names only**):

- `GLOBAL_EXECUTION_ENABLED=false`
- `AI_PROVIDER=stub`
- Historical staging prep docs set `PROVIDER_XAI_ENABLED=false` — if still present, it would block xAI even after enabling global execution
- Presence/absence of a real `XAI_API_KEY` on current staging **must be verified by Keith** before any Step 3a authorization (do not print values)

**No runtime step is approved until the exact current xAI configuration path is verified.**

#### 3.1.3 Existing frontend UX

- Users can choose **both provider and model** from the mirrored frontend catalogue.
- Selectable options include xAI / OpenAI / Groq / DeepSeek (Anthropic and stub are not normal frontend choices).
- **FR-04B COMPLETE and LOCKED** — catalogue hardened; stale IDs removed; multilingual labels in parity; selector UX preserved.
- Anthropic remains backend-supported via `ANTHROPIC_MODEL` but is not selectable in the frontend without an authoritative configured model ID.

#### 3.1.4 Intended architecture not yet fully productized

Already implemented for private-beta smoke path existence:

- Multiple providers
- Multiple models per provider (catalogue allowlist + request model)
- User selection via frontend control
- Provider allowlist + fail-safe env defaults / kill switches
- Server-side model allowlist / source-controlled catalogue wired into execute path (**FR-04B COMPLETE**)
- Frontend/backend catalogue consistency + stale UI migration (**FR-04B COMPLETE**)
- Clear rejection of invalid provider/model combinations (**FR-04B COMPLETE**)
- Removal of silent xAI `grok-3` default (**FR-04B COMPLETE** — default is now `grok-4.5`)

Still deferred beyond FR-04B:

- Durable per-user or per-project model preference storage
- Dynamic model catalog from backend / provider APIs
- Provider-native tool-use on xAI (harness path) — not required for text `file-actions` smoke
- Agent harness model-profile registry wiring into product selector
- Frontend Anthropic selection without an authoritative configured model ID exposed to the UI

#### 3.1.5 Smoke provider decision

| Decision | Value |
|---|---|
| Assumed provider for FR-04 smoke | **`xai`** (preferred) |
| Assumed model for FR-04 smoke | **`grok-4.5`** (post-FR-04B verified catalogue default) |
| Anthropic for smoke | **Not assumed** |
| FR-04A | Optional Anthropic readiness only |
| FR-04B | **COMPLETE and LOCKED — 2026-08-06 — PASS** |
| Source changes before runtime | **FR-04 source prerequisites COMPLETE** |

#### 3.1.6 FR-04B resolution statement (2026-08-06)

FR-04B is **COMPLETE and LOCKED — 2026-08-06 — PASS**.

Resolved:

- The stale provider/model catalogue blocker is resolved.
- Backend and frontend provider/model catalogues now match.
- xAI default is `grok-4.5`.
- Users can select supported provider/model combinations per request.
- API Gateway and AI Service both validate provider/model selections.
- Anthropic remains backend-capable but is not selectable in the frontend without an authoritative configured model ID.
- FR-04 source prerequisites are complete.

Still true:

- Runtime execution remains disabled and unauthorized.
- Staging xAI environment/configuration still requires verification.
- No private-beta users may be invited.

Checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-CHECKPOINT.md`
Plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-IMPLEMENTATION-PLAN.md`

---

### 3.2 Provider Credentials Required (by name only) — xAI preferred path

**Per-service breakdown sourced from code review:**

| Service | Variable | Why required | Status |
|---|---|---|---|
| `aisandbox-api-gateway` | `GLOBAL_EXECUTION_ENABLED=true` | `KillSwitchConfig` / `ExecutionSafetyGuard` | Requires Keith PM2 env update — **not authorized yet** |
| `aisandbox-api-gateway` | `AI_PROVIDER=xai` | Startup `ProviderValidator`; **and** `ExecutionSafetyGuard` reads env `AI_PROVIDER` (not request body) | Requires Keith PM2 env update — **not authorized yet** |
| `aisandbox-api-gateway` | `XAI_API_KEY=<key>` | `ProviderValidator.validateProviderApiKey()` when `AI_PROVIDER=xai` — startup validation; gateway does **not** call xAI | Keith verifies presence / supplies privately during later approved runtime step — **do not print** |
| `aisandbox-api-gateway` | `PROVIDER_XAI_ENABLED` | Must **not** be `false` during smoke (default is enabled if unset). Historical staging prep set `false` — verify current value | Keith verifies before Step 3a — **not authorized yet** |
| `aisandbox-ai-service` | `XAI_API_KEY=<key>` | `XAIAdapter` construction — **actual xAI API calls** | Keith verifies presence / supplies privately during later approved runtime step — **do not print** |
| `aisandbox-ai-service` | `AI_PROVIDER` | Cosmetic startup log only; execution provider comes from BullMQ job payload | Optional |
| `aisandbox-api-gateway` | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | `ConfigurationValidator` may still require non-empty values in staging/production even when selected provider is xAI (known template/coherence quirk; placeholders may already exist) | Verify names-only; do not treat as selecting Anthropic/OpenAI for smoke |

Secrets are entered and handled only by Keith via SSH. Never printed, logged, or recorded in any document.

**Anthropic variables (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) are not required for the preferred xAI smoke path.** They remain relevant only if Keith later chooses Anthropic explicitly (optional FR-04A path).

---

### 3.3 Credential Existence

**Do not assume credentials are present or absent on staging.**

Keith must, before approving Step 3a:

1. Verify whether `XAI_API_KEY` is already present (name-only) in both `aisandbox-api-gateway` and `aisandbox-ai-service` PM2 / staging env.
2. Verify `PROVIDER_XAI_ENABLED` is not `false`.
3. Confirm a currently supported xAI model ID for the smoke (default candidate: `grok-4.5` from the post-FR-04B catalogue; allowed also `grok-4.20` — verify current staging/account support independently).
4. Confirm xAI account credit/budget is sufficient for one bounded call.
5. Only during a later approved Step 3a: set `GLOBAL_EXECUTION_ENABLED=true`, `AI_PROVIDER=xai`, ensure `XAI_API_KEY` on gateway + ai-service, and ensure provider kill switch permits xAI.

Runtime PM2 environment configuration remains **not authorized**.

---

### 3.4 Execution Flags That Must Change (Temporarily)

**Changes are temporary — all must be reverted to confirmed rollback values after smoke (Step 4).**

**Source-confirmed rollback values:** `ProviderValidator` explicitly permits `AI_PROVIDER=stub` in staging when `GLOBAL_EXECUTION_ENABLED=false` — this is the "private-beta health-only" exception. This is the current safe-startup state and is the confirmed rollback target.

| Service | Variable | Current (before smoke) | During smoke only | Rollback target (confirmed from source) |
|---|---|---|---|---|
| `aisandbox-api-gateway` | `GLOBAL_EXECUTION_ENABLED` | `false` | `true` | `false` |
| `aisandbox-api-gateway` | `AI_PROVIDER` | `stub` | `xai` | `stub` |
| `aisandbox-api-gateway` | `XAI_API_KEY` | verify first | present (real key) | may remain (safe when execution disabled) or remove |
| `aisandbox-api-gateway` | `PROVIDER_XAI_ENABLED` | verify first (historically `false` in prep docs) | not `false` | restore prior staging posture if it was intentionally false |
| `aisandbox-ai-service` | `XAI_API_KEY` | verify first | present (real key) | may remain or remove |

**Critical startup constraint:** In staging, `AI_PROVIDER=stub` + `GLOBAL_EXECUTION_ENABLED=true` triggers a crash at api-gateway startup. Both `AI_PROVIDER` and `GLOBAL_EXECUTION_ENABLED` changes must be applied together before restart.

**Frontend smoke selection:** Use default **xAI - grok-4.5** (or Keith-verified alternate allowed xAI model such as `grok-4.20`) in the workspace Model Provider selector. Do not select Anthropic for this smoke unless Keith explicitly overrides this plan.

---

### 3.5 Services Involved

| Service | PM2 process name | Role | Env change required | Restart required |
|---|---|---|---|---|
| API Gateway | `aisandbox-api-gateway` | Kill switch, env `AI_PROVIDER` for safety guard, request provider/model routing to queue, `ProviderValidator` | YES | YES |
| AI Service | `aisandbox-ai-service` | BullMQ worker, `XAIAdapter`, `XAI_API_KEY` lookup | YES | YES |
| Container Manager | `aisandbox-container-manager` | Container lifecycle, workspace file writes | NO | NO |
| Frontend | `aisandbox-frontend` | Model selector + execute request | NO | NO |
| Redis | (system service) | BullMQ queue backend | NO | NO |
| PostgreSQL | (system service) | Session/project/user data | NO | NO |

---

### 3.6 PM2 Restart Requirements

**Use exact PM2 process names from staging (`aisandbox-` prefix).**

After updating PM2 env vars:

```bash
pm2 restart aisandbox-api-gateway --update-env
pm2 restart aisandbox-ai-service --update-env
```

Verify both services are online after restart:

```bash
pm2 status
# Expect: aisandbox-api-gateway online, aisandbox-ai-service online
# Then:
GET https://staging.ainow.biz/api/health → 200
GET https://staging.ainow.biz/api/health/db → 200
GET https://staging.ainow.biz/api/health/ready → 200
```

---

### 3.7 Disposable Project and Session

**Reuse the existing staging disposable project from FR-03A.**

That project already contains `README.md` from the ZIP import smoke. No new project or session creation is required before the smoke.

Confirm the project and session are accessible (login → workspace shows the disposable project with `README.md` in tree) before submitting the AI prompt.

If the existing session has expired and cannot be reconnected, create one new disposable project for this smoke. Name it `fr-04-smoke-<YYYYMMDD>`. Do not use a production user account.

---

### 3.8 Bounded AI Prompt

**Approved prompt (exact text):**

> Create a new file called `smoke-test.txt` with the content: `AI execution smoke test - 2026-08-06`

Properties:
- Creates exactly one new file (`smoke-test.txt`)
- Does not modify any existing file (including `README.md`)
- Content is harmless plain text
- Output is easy to verify (file name and content are deterministic)
- Does not require a build, run, or preview step
- Does not trigger risky batch confirmation (single file, new file only)
- Will NOT match any existing file name in the project

---

### 3.9 Expected AI Execution Lifecycle and Evidence

End-to-end expected flow:

1. User selects **xAI - grok-4.5** (or Keith-verified allowed xAI model) if not already default → submits prompt → `POST /api/ai/execute` with `provider: 'xai'` and `model: '<selected>'`
2. `ExecutionSafetyGuard` checks `GLOBAL_EXECUTION_ENABLED=true` → passes
3. `ExecutionSafetyGuard` checks provider kill switch for **env** `AI_PROVIDER=xai` (`PROVIDER_XAI_ENABLED` not false) → passes
4. Controller resolves/validates request provider/model via catalogue → queues BullMQ job with `provider: 'xai'` and selected model
5. `ai-service` worker picks up job; validates provider/model independently; `XAIAdapter` instantiated with `XAI_API_KEY`; uses request model or catalogue default `grok-4.5`
6. xAI API call made
7. Response contains `file-actions` block (text protocol):
   ```
   ```file-actions
   [{"action":"create","path":"smoke-test.txt","content":"AI execution smoke test - 2026-08-06"}]
   ```
   ```
8. `extractFileActionsFromOutput` parses the block → file action applied via Container Manager
9. Execution completion signals api-gateway
10. Auto-checkpoint may be created (git SHA)
11. Workspace file tree refreshes → `smoke-test.txt` appears
12. User opens `smoke-test.txt` in editor → content matches expected
13. Chat shows AI response (text portion above the `file-actions` block)

**Minimum evidence required:**

| Evidence | How to capture |
|---|---|
| AI execution does not return 503 | Browser DevTools Network tab → `POST /api/ai/execute` not 503 |
| Request body shows `provider: "xai"` | Browser DevTools Network tab |
| AI execution completes (no error state in chat) | Browser — chat shows AI response text |
| `smoke-test.txt` visible in file tree | Browser screenshot of file tree |
| `smoke-test.txt` opens in editor | Browser screenshot of editor with content |
| PM2 log shows `execution.exit.success` signal | `pm2 logs aisandbox-ai-service` on staging SSH |

---

### 3.10 Provider Call and Cost Boundary

- **Maximum provider calls:** 1 (one AI prompt submission — do not retry)
- **Maximum tokens per request (platform hard cap):** 4,096 (`GlobalSafetyLimits.MAX_TOKENS_PER_EXECUTION` default)
- **Expected actual token usage for this smoke:** << 500 tokens
- **Dollar cost:** Not estimated here. Keith must verify current xAI account pricing for the selected model before Step 3a.
- **Hard stop:** If a second unexpected execution is triggered, stop immediately and restore kill switch.

---

### 3.11 Billing and Credit Implications

- `BILLING_CHARGES_ENABLED=false` — no user billing occurs
- `STRIPE_PROVIDER_MODE=disabled` — no Stripe payment flow triggered
- Direct xAI API usage cost for the smoke applies to the platform xAI account
- **Keith must verify current xAI account pricing/credit before approving Step 3a**

No billing configuration change is required or permitted.

---

### 3.12 Container and Workspace Cleanup

- Persistent staging disposable project/session records from FR-03A and FR-04 **may remain** after the smoke
- `smoke-test.txt` created in the staging workspace container **may remain** — it is harmless plain text
- No container deletion is required after the smoke
- If the session container has been garbage-collected since FR-03A, a new session will be created automatically on workspace open

No cleanup action is required or approved as part of FR-04.

---

### 3.13 Immediate Stop Conditions

Stop execution immediately if any of the following occur:

1. `XAI_API_KEY` is rejected by xAI (401 Unauthorized) — stop and do not retry
2. Unexpected HTTP 5xx cascade from api-gateway or ai-service beyond the expected single execution
3. Any staging service (api-gateway, ai-service, container-manager) crashes or becomes unresponsive after env change
4. Any production environment is affected (should never occur — staging is isolated)
5. Estimated xAI API cost exceeds $0.10 for this smoke session
6. Unexpected database mutation (DDL, data deletion, or schema change)
7. Any file outside the disposable staging project is modified

If any stop condition triggers: restore `GLOBAL_EXECUTION_ENABLED=false` and `AI_PROVIDER=stub` immediately (see rollback steps below).

---

### 3.14 Rollback Steps (Restore AI Execution to Disabled)

**Rollback target — confirmed from source (`ProviderValidator` private-beta health-only exception):**

`AI_PROVIDER=stub` + `GLOBAL_EXECUTION_ENABLED=false` in api-gateway is the proven safe-startup state.

```bash
# On staging via SSH — use exact PM2 process name:
pm2 set aisandbox-api-gateway GLOBAL_EXECUTION_ENABLED false
pm2 set aisandbox-api-gateway AI_PROVIDER stub
pm2 restart aisandbox-api-gateway --update-env

# Verify:
# GET https://staging.ainow.biz/api/health → 200
# Authenticated POST /api/ai/execute → 503 (kill switch confirmed active)
```

`XAI_API_KEY` may remain in gateway and ai-service after rollback — inactive when execution is disabled. If `PROVIDER_XAI_ENABLED` was intentionally `false` before smoke, restore that posture after rollback if Keith requires it for staging hygiene.

Rollback must be performed regardless of smoke outcome (pass or fail) unless Keith separately approves extending the execution window.

---

### 3.15 Preview HTTP 404 Classification

**Classification: Separate unresolved staging finding — does NOT block FR-04.**

Preview usability is not part of the FR-04 minimum proof. Do not investigate, fix, or register the preview 404 inside FR-04.

---

### 3.16 Step 3 Child Slice Decision

**Decision: Step 3 MUST be split into 3 child slices.**

| Slice | Name | Who | What |
|---|---|---|---|
| **Step 3a** | PM2 Environment Configuration and Restart | Keith (SSH) | After config verification: set `GLOBAL_EXECUTION_ENABLED=true`, `AI_PROVIDER=xai`, ensure `XAI_API_KEY` in gateway + ai-service, ensure `PROVIDER_XAI_ENABLED` not `false`; restart both services with `--update-env`; verify health — **not authorized yet** |
| **Step 3b** | Staging Execution Health Verification | Keith (browser/SSH) | Confirm kill switch lifted (authenticated AI request no longer 503); confirm ai-service worker alive |
| **Step 3c** | Core Product Loop Smoke | Keith (browser) | Use xAI model selector default (or verified xAI model); submit approved bounded prompt; verify `smoke-test.txt` |
| **Step 4** | Rollback + Evidence Consolidation + Checkpoint | Keith (SSH) + Cursor | Restore `GLOBAL_EXECUTION_ENABLED=false` + `AI_PROVIDER=stub`; capture evidence; consolidate checkpoint |

Each slice requires **separate explicit Keith approval** before execution.

---

## 4. Workflow Steps

| Step | Status | Description |
|---|---|---|
| Step 1 — Registration + Readiness Plan | **COMPLETE — 2026-08-06** | Original plan. |
| FR-04A — Anthropic Model Configuration Hardening | **COMPLETE and LOCKED — 2026-08-06 — PASS** | Optional Anthropic readiness only. Checkpoint locked — do not modify. |
| Step 1b — xAI / multi-model source audit + plan correction | **COMPLETE — 2026-08-06** | This amendment. Outcome A. No runtime action. |
| FR-04B — Provider Model Catalogue and Selection Hardening | **COMPLETE and LOCKED — 2026-08-06 — PASS** | Catalogue + dual-layer validation + frontend mirror. Checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-CHECKPOINT.md`. |
| FR-04C — Controlled Staging Deployment of FR-04A/04B | **ACTIVE — Step 1 COMPLETE — 2026-08-06** | Deploy source catalogues to staging without enabling execution. Plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-DEPLOYMENT-PLAN.md`. Exact next: Step 2a readiness (no staging mutation). |
| Step 2 — Keith reviews amended plan + verifies staging xAI config path | **BLOCKED pending FR-04C** | Resume only after FR-04C proves deployed catalogues. |
| Step 3a — PM2 env configuration + service restart | **NOT STARTED — not authorized** | Requires Step 2 approval + separate explicit runtime approval. Out of FR-04C scope. |
| Step 3b — Execution health verification | **NOT STARTED** | Requires Step 3a complete + Keith approval. |
| Step 3c — Core product loop smoke | **NOT STARTED** | Requires Step 3b complete + Keith approval. |
| Step 4 — Rollback + evidence consolidation + checkpoint | **NOT STARTED** | Requires Step 3c complete. Rollback mandatory regardless of outcome. |

---

## 5. Safety Confirmations (Step 1b audit amendment)

- ✅ No source code changed
- ✅ No locked FR-04A checkpoint modified
- ✅ No `.env*` files opened or changed
- ✅ No env values printed or recorded
- ✅ No runtime or server action taken
- ✅ No SSH / AWS CLI / PM2 / systemd / Caddy action
- ✅ No Docker / PostgreSQL / Redis action
- ✅ No terminal commands run
- ✅ No git commit or push
- ✅ No subagents used
- ✅ No users invited
- ✅ No staging or production deployment changed
- ✅ No migrations run
- ✅ No billing or payment action
- ✅ No AI execution enabled
- ✅ No browser automation performed
- ✅ No provider API call made
- ✅ `GLOBAL_EXECUTION_ENABLED` remains `false`
- ✅ `AI_PROVIDER` remains `stub` (documented staging posture; not re-verified live)
- ✅ FR-04B COMPLETE and LOCKED — 2026-08-06 — PASS — stale catalogue blocker resolved in source — FR-04 source prerequisites complete
- ✅ FR-04C ACTIVE — Step 1 COMPLETE — 2026-08-06 — controlled staging deployment planned; no deployment executed in registration
- ✅ Runtime execution remains disabled and unauthorized
- ✅ Staging deployed builds still older than FR-04A/04B until FR-04C completes
- ✅ No private-beta users may be invited
- ✅ PRIVATE-BETA-INVITE-01 NOT REGISTERED — no invitation authorized

---

## 6. Actions Requiring Separate Keith Approval Before Proceeding

| Action | Status |
|---|---|
| FR-04B Step 2a/2b source implementation (after official model ID verification) | **COMPLETE and LOCKED — 2026-08-06 — PASS** |
| FR-04C registration + deployment plan | **COMPLETE — 2026-08-06** |
| FR-04C Step 2a — deployment readiness and artifact verification | **NOT STARTED — exact next action** — no staging mutation |
| FR-04C Step 2b — backend deploy | **NOT APPROVED yet** |
| FR-04C Step 2c — frontend deploy | **NOT APPROVED yet** |
| FR-04C Step 2d — deployment verification / checkpoint | After 2b/2c |
| Review and approve amended readiness plan (FR-04 Step 2) | **BLOCKED pending FR-04C** |
| Verify current staging xAI configuration path (`XAI_API_KEY` names-only in gateway + ai-service; `PROVIDER_XAI_ENABLED`; supported model ID `grok-4.5`) | **BLOCKED pending FR-04C** — Keith action before Step 3a |
| Verify xAI account has sufficient credit for one smoke call | **PENDING — Keith action before Step 3a** |
| Supply or confirm real `XAI_API_KEY` privately during later approved runtime step | **PENDING — not authorized yet** |
| Step 3a: PM2 env config (`GLOBAL_EXECUTION_ENABLED=true`, `AI_PROVIDER=xai`, `XAI_API_KEY`, provider kill switch) + restart | **NOT APPROVED — runtime still unauthorized** |
| Step 3b: Execution health verification smoke | **NOT APPROVED — runtime still unauthorized** |
| Step 3c: Core product loop smoke (submit AI prompt) | **NOT APPROVED — runtime still unauthorized** |
| Post-smoke: Decision to leave execution enabled beyond FR-04 | **NOT APPROVED** |
| User invitation (PRIVATE-BETA-INVITE-01) | **NOT REGISTERED** — no private-beta users may be invited |
| Anthropic smoke path | **Not assumed** — optional only if Keith explicitly overrides preferred xAI path |

---

## 7. Related Documents

- Child FR-04C deployment plan (ACTIVE): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-DEPLOYMENT-PLAN.md`
- Child FR-04B checkpoint (locked): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-CHECKPOINT.md`
- Child FR-04B implementation plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-IMPLEMENTATION-PLAN.md`
- Child FR-04A checkpoint (locked; optional Anthropic readiness only): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04A-CHECKPOINT.md`
- Child FR-04A implementation plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04A-IMPLEMENTATION-PLAN.md`
- Predecessor: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-03A-CHECKPOINT.md`
- Predecessor: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-03-CHECKPOINT.md`
- Predecessor: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-02-CHECKPOINT.md`
- Audit: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-01-AUDIT.md`
- Roadmap: `docs/AINOW-EXECUTION-ROADMAP.md`
- Source — kill switch: `services/api-gateway/src/safety/kill-switch.config.ts`
- Source — execution safety guard: `services/api-gateway/src/safety/execution-safety.guard.ts`
- Source — AI execution controller (provider/model resolve): `services/api-gateway/src/ai/ai-execution.controller.ts`
- Source — AI execution service: `services/ai-service/src/ai-execution/ai-execution.service.ts`
- Source — provider/model catalogue (AI Service): `services/ai-service/src/ai-execution/provider-model.catalogue.ts`
- Source — provider/model catalogue (API Gateway): `services/api-gateway/src/ai/provider-model.catalogue.ts`
- Source — xAI adapter: `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts`
- Source — Anthropic adapter (optional path / FR-04A): `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts`
- Source — file-actions parser: `services/ai-service/src/ai-execution/file-actions.parser.ts`
- Source — provider validator: `services/api-gateway/src/startup/provider.validator.ts`
- Frontend provider/model catalogue: `frontend/lib/ai/provider-model.catalogue.ts` (default `xai:grok-4.5`)
- Frontend selector UI: `frontend/components/workspace/workspace-shell.tsx` (`workspace-chat-model-selector`)

---

*Do not modify this document after Step 4 is locked except by explicitly approved follow-up task.*
