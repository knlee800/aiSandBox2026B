# PRIVATE-BETA-FUNCTIONAL-READINESS-04B — Checkpoint

**Status: COMPLETE and LOCKED — 2026-08-06**
**Overall verdict: PASS**

---

## Task

PRIVATE-BETA-FUNCTIONAL-READINESS-04B — Provider Model Catalogue and Selection Hardening

**Parent:** PRIVATE-BETA-FUNCTIONAL-READINESS-04 (ACTIVE — Step 1 COMPLETE — Step 1b COMPLETE — FR-04B source blocker resolved — FR-04 source prerequisites complete — runtime execution still not authorized — staging xAI configuration still requires verification)

**Implementation plan:** `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-IMPLEMENTATION-PLAN.md`

**Parent readiness plan:** `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md`

---

## Summary

Step 3 consolidation COMPLETE. FR-04B provider/model catalogue and selection hardening is complete and locked.

Backend and frontend catalogues now match. xAI default is `grok-4.5`. Users can select supported provider/model combinations per request. API Gateway and AI Service both validate provider/model selections before ledger write / queue enqueue and before adapter execution. Stale IDs (`grok-3`, `mixtral-8x7b-32768`, `deepseek-chat`, `deepseek-reasoner`, deprecated Anthropic UI IDs) were removed from the product selector path. Invalid, stale, and cross-provider selections fail clearly or migrate safely in the UI; they do not silently fall back on the backend.

Anthropic remains backend-capable through `ANTHROPIC_MODEL` (FR-04A invariant preserved) but is not selectable in the frontend without an authoritative configured model ID.

FR-04 source prerequisites are complete. The stale provider/model catalogue blocker is resolved. Runtime execution remains **disabled and unauthorized**. Staging xAI environment/configuration still requires verification. No private-beta users may be invited.

---

## Approved Catalogue (source-controlled)

| Provider | Default | Allowed |
|---|---|---|
| xAI | `grok-4.5` | `grok-4.5`, `grok-4.20` |
| Groq | `openai/gpt-oss-120b` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` |
| DeepSeek | `deepseek-v4-flash` | `deepseek-v4-flash`, `deepseek-v4-pro` |
| OpenAI | `gpt-4o` | `gpt-4o` |
| Anthropic | deployment-configured via `ANTHROPIC_MODEL` | request model must match configured deployment model |
| Stub | existing behavior preserved | existing behavior preserved |

Frontend default selection resolves to **`xai:grok-4.5`**. Anthropic and stub are not exposed as normal selectable frontend choices.

---

## Implementation Evidence Reviewed

### Step 2a — Backend

| Item | Result |
|---|---|
| Authoritative AI Service catalogue module | Confirmed — `services/ai-service/src/ai-execution/provider-model.catalogue.ts` |
| API Gateway catalogue mirror + validation | Confirmed — `services/api-gateway/src/ai/provider-model.catalogue.ts` |
| Gateway validates before ledger write / queue enqueue | Confirmed by implementation evidence |
| AI Service validates independently before adapter execution | Confirmed by implementation evidence |
| Unknown / stale / cross-provider models fail clearly | Confirmed |
| Omitted models resolve to provider defaults | Confirmed |
| Invalid selections do not silently fall back | Confirmed |
| Adapter-local stale defaults removed | Confirmed |
| Provider SDKs mocked in tests | Confirmed |
| No real provider call made | Confirmed |

### Step 2b — Frontend

| Item | Result |
|---|---|
| Frontend catalogue matches backend catalogue | Confirmed — `frontend/lib/ai/provider-model.catalogue.ts` |
| Default resolves to `xai:grok-4.5` | Confirmed |
| Stale IDs removed (`grok-3`, `mixtral-8x7b-32768`, `deepseek-chat`, `deepseek-reasoner`, deprecated Anthropic UI IDs) | Confirmed |
| Selector shows only models for selected provider | Confirmed |
| Provider change selects that provider’s default model | Confirmed |
| Valid selections preserved; invalid/stale/cross-provider migrate to provider default | Confirmed |
| Invalid provider selections migrate to `xai:grok-4.5` | Confirmed |
| Every AI request sends resolved provider and model | Confirmed |
| Stale values cannot be submitted | Confirmed |
| Anthropic backend-supported but not a normal frontend choice | Confirmed |
| Workspace selector UX preserved | Confirmed |
| en / zh-TW / zh-CN translations remain in parity | Confirmed |

---

## Implementation Acceptance Criteria — COMPLETE

- [x] Authoritative backend provider/model catalogue introduced (AI Service)
- [x] API Gateway catalogue/validation aligned with AI Service contract
- [x] Dual-layer validation: gateway before ledger/queue; AI Service before adapter execution
- [x] xAI default is `grok-4.5` (no silent `grok-3` default)
- [x] Groq / DeepSeek / OpenAI defaults and allowlists match approved catalogue
- [x] Anthropic remains env-configured via `ANTHROPIC_MODEL` (FR-04A invariant preserved)
- [x] Stub behavior preserved
- [x] Unknown, stale, and cross-provider models fail clearly
- [x] Omitted models resolve to provider defaults
- [x] Invalid selections do not silently fall back on the backend
- [x] Adapter-local stale defaults removed
- [x] Frontend catalogue mirrors backend allowed selectable set
- [x] Frontend default is `xai:grok-4.5`
- [x] Stale frontend model IDs removed from product selector path
- [x] Model selector scoped to selected provider; provider change selects provider default
- [x] Invalid/stale/cross-provider UI selections migrate safely; stale values cannot be submitted
- [x] Every AI request sends resolved provider and model
- [x] Anthropic not exposed as normal frontend choice without authoritative configured model ID
- [x] Existing workspace selector UX preserved
- [x] English, Traditional Chinese, and Simplified Chinese translations remain in parity
- [x] Provider SDKs mocked in tests; no real provider call required
- [x] No credentials hardcoded
- [x] No runtime catalogue fetch introduced
- [x] No AI execution enabled; no staging / PM2 / credential / invitation action in this task
- [x] Focused backend and frontend validation recorded PASS
- [x] Consolidation checkpoint created and task locked

---

## Validation Recorded

### Backend (Step 2a)

| Check | Result |
|---|---|
| Focused AI Service tests | **PASS** |
| Focused API Gateway tests | **PASS** |
| AI Service TypeScript check | **PASS** |
| AI Service build | **PASS** |
| API Gateway TypeScript check | **PASS** |
| API Gateway build | **PASS** |
| Lint diagnostics | Clean |

### Frontend (Step 2b)

| Check | Result |
|---|---|
| Focused frontend tests | **PASS** — 462 tests, 0 failures |
| Frontend TypeScript check | **PASS** |
| Frontend build | **PASS** |
| Lint diagnostics | Clean |

---

## Step Completion

| Step | Status |
|---|---|
| Step 1 — Registration + implementation plan | COMPLETE — 2026-08-06 |
| Step 2a — Backend catalogue + validation + xAI default hardening | COMPLETE — 2026-08-06 |
| Step 2b — Frontend catalogue + selector hardening | COMPLETE — 2026-08-06 |
| Step 3 — Consolidation and checkpoint | COMPLETE — 2026-08-06 |

---

## Parent FR-04 Impact

- **Stale provider/model catalogue blocker:** RESOLVED
- **Backend and frontend catalogues:** Match
- **xAI default:** `grok-4.5`
- **Per-request supported provider/model selection:** Available
- **Dual-layer validation:** API Gateway + AI Service
- **Anthropic:** Backend-capable; not selectable in frontend without authoritative configured model ID
- **FR-04 source prerequisites:** COMPLETE
- **Runtime execution:** Still **disabled and unauthorized**
- **Staging xAI environment/configuration:** Still requires verification
- **Private-beta invitations:** NOT authorized — PRIVATE-BETA-INVITE-01 NOT REGISTERED — no users may be invited

---

## Exact Next Action

**PRIVATE-BETA-FUNCTIONAL-READINESS-04 Step 2 — readiness approval and staging xAI configuration verification**

No new task registered.

---

## Related Documents

- Implementation plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04B-IMPLEMENTATION-PLAN.md`
- Parent readiness plan: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md`
- Sibling checkpoint (locked; optional Anthropic readiness only): `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04A-CHECKPOINT.md`
- Roadmap: `docs/AINOW-EXECUTION-ROADMAP.md`
- Source — AI Service catalogue: `services/ai-service/src/ai-execution/provider-model.catalogue.ts`
- Source — API Gateway catalogue: `services/api-gateway/src/ai/provider-model.catalogue.ts`
- Source — Frontend catalogue: `frontend/lib/ai/provider-model.catalogue.ts`

---

## Invariants Preserved (this consolidation)

- No source code changed during consolidation
- No tests changed during consolidation
- No translations, packages, migrations, or entities changed
- No environment examples or real environment files changed during consolidation
- No terminal or Git commands run
- No staging / SSH / PM2 / Docker / PostgreSQL / Redis / Caddy access
- No browser or provider API access
- No AI execution enabled
- No credentials inspected or recorded
- No users invited
- No new task registered
- No locked checkpoints modified (FR-04A untouched)
- No subagents used

---

*Do not modify this checkpoint after locking except by explicitly approved follow-up task.*
