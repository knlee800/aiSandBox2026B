# PRIVATE-BETA-FUNCTIONAL-READINESS-04B — Provider Model Catalogue and Selection Hardening

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-04B
**Type:** Bounded source hardening — provider/model catalogue and selection
**Status:** ACTIVE — Step 1 COMPLETE (registration + implementation plan) — 2026-08-06
**Parent:** PRIVATE-BETA-FUNCTIONAL-READINESS-04 (ACTIVE — runtime Steps 2–4 BLOCKED pending FR-04B)
**Author:** Cursor / Grok
**Date:** 2026-08-06
**Keith approval:** Registration approved 2026-08-06

---

## 1. Context

FR-04 source audit and FR-04A completion established:

- Users can select provider and model in the workspace chat selector.
- Selection is transmitted per request on `POST /api/ai/execute`.
- AI Service selects the adapter from `request.provider` and uses `request.model` when present.
- Frontend catalogue and several adapter defaults are hardcoded and can drift.
- xAI currently defaults to `grok-3` in both frontend and `XAIAdapter`.
- Frontend still lists deprecated Anthropic ID `claude-3-5-sonnet-20241022`.
- FR-04A COMPLETE and LOCKED — Anthropic adapter requires explicit `ANTHROPIC_MODEL`; locked checkpoint must not be modified.
- FR-04 runtime execution remains disabled and not authorized.
- AI execution remains disabled.

This registration step plans a bounded source hardening only. It does **not** change source, staging, PM2, environment files, provider credentials, or AI enablement.

---

## 2. Source Review Findings

### 2.1 Frontend provider/model catalogue locations

| Role | Path | Finding |
|---|---|---|
| Primary catalogue + default | `frontend/app/[locale]/app/page.tsx` | `DEFAULT_CHAT_MODEL_OPTION = 'xai:grok-3'`; hardcoded `CHAT_MODEL_OPTIONS` (xAI, Anthropic, OpenAI, Groq, DeepSeek) with English `label` strings |
| Parse / fallback | Same file — `parseSelectedChatModelOption()` | Unknown option values fall back to `CHAT_MODEL_OPTIONS[0]` (currently xAI/`grok-3`) |
| UI state | Same file — `selectedChatModelOption` | Ephemeral React state; **not** durable localStorage / user / project preference |
| Request payload | Same file — `fetch('/api/ai/execute', …)` | Sends `provider` + `model` from parsed selection |
| Selector UI | `frontend/components/workspace/workspace-shell.tsx` | `select#workspace-chat-model-selector` / `data-testid="workspace-chat-model-selector"` — interaction pattern must be preserved |
| i18n label keys today | `frontend/messages/{en,zh-TW,zh-CN}.json` | Only `modelProvider` / `modelProviderLabel` exist; **option labels are hardcoded English** in `CHAT_MODEL_OPTIONS` |
| Tests asserting options | `frontend/components/workspace/workspace-shell.test.tsx` | Uses `xai:grok-3` fixture options |
| Driver page (out of workspace product path) | `frontend/app/[locale]/driver/page.tsx` | Hardcodes `provider: 'xai'` with **no model field** — out of FR-04B product-selector scope unless explicitly expanded |

Current frontend options (source, not verified as currently available):

| value | provider | model |
|---|---|---|
| `xai:grok-3` | `xai` | `grok-3` |
| `anthropic:claude-3-5-sonnet-20241022` | `anthropic` | `claude-3-5-sonnet-20241022` |
| `openai:gpt-4o` | `openai` | `gpt-4o` |
| `groq:mixtral-8x7b-32768` | `groq` | `mixtral-8x7b-32768` |
| `deepseek:deepseek-chat` | `deepseek` | `deepseek-chat` |

### 2.2 Backend adapter default-model locations

| Provider | Adapter path | Default model behavior |
|---|---|---|
| `anthropic` | `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` | **No hardcoded default** after FR-04A — requires non-empty constructor `options.model`; factory reads `ANTHROPIC_MODEL` |
| `xai` | `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | Hardcoded `private readonly defaultModel = 'grok-3'` |
| `openai` | `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts` | Hardcoded `gpt-4o` |
| `groq` | `services/ai-service/src/ai-execution/adapters/groq-ai.adapter.ts` | Hardcoded `mixtral-8x7b-32768` |
| `deepseek` | `services/ai-service/src/ai-execution/adapters/deepseek-ai.adapter.ts` | Hardcoded `deepseek-chat` |
| `stub` | Stub adapter | N/A for catalogue hardening |

Factory: `services/ai-service/src/ai-execution/ai-execution.service.ts` — `getAdapter(provider)` constructs adapters; only Anthropic currently reads a model env var.

### 2.3 Provider allowlists and validation

| Location | Behavior |
|---|---|
| `services/api-gateway/src/ai/ai-execution.controller.ts` | `SUPPORTED_AI_PROVIDERS` = stub, anthropic, openai, groq, xai, deepseek — invalid provider → `400 BadRequestException` |
| `services/api-gateway/src/public-api/public-ai.controller.ts` | Duplicate `SUPPORTED_AI_PROVIDERS` allowlist |
| `services/api-gateway/src/startup/provider.validator.ts` | Startup validation of `AI_PROVIDER` + API key; provider kill-switch env names; **no model validation** |
| `services/api-gateway/src/safety/kill-switch.config.ts` | `PROVIDER_*_ENABLED` kill switches (default enabled unless `false`) |
| AI Service `getAdapter` | Unknown provider → `ServiceUnavailableException` |

### 2.4 Model validation today

**None on the execute path.**

- Gateway accepts any non-empty trimmed `request.model` string (or omits model).
- Adapters accept arbitrary request model IDs via `request.model` override (trim non-empty → use; else adapter default / Anthropic configured model).
- No provider↔model pairing check.
- No model allowlist.

### 2.5 How selected provider/model enter the request payload

1. User selects option in `workspace-chat-model-selector`.
2. `parseSelectedChatModelOption(selectedChatModelOption)` resolves `{ provider, model }`.
3. Workspace chat submit / orchestration calls `POST /api/ai/execute` with body fields `provider` and `model` (plus prompt, sessionId, conversationId, optional workspaceContext).
4. Selection is **per-request**; UI state is ephemeral React state only.

### 2.6 How AI Service resolves provider and model

1. Job/request carries `provider` + optional `model`.
2. `AIExecutionService` calls `getAdapter(request.provider)`.
3. Adapter `execute()` uses trimmed `request.model` when present; otherwise constructor default / Anthropic env model.
4. Text `file-actions` parsing is provider-agnostic and does not require tool-use capability for FR-04 smoke.

### 2.7 Do adapters accept arbitrary request model IDs?

**Yes** (for non-Anthropic defaults and for request overrides generally). Any non-empty string is forwarded to the provider API. Invalid IDs fail only at the provider, not at platform validation.

### 2.8 Existing tests covering selection / payloads / adapters / invalid cases

| Area | Coverage today |
|---|---|
| Provider selection / adapter factory | `ai-execution.phase30c.spec.ts` — openai/deepseek/xai/stub/anthropic construction |
| Anthropic model config | FR-04A tests — missing/empty/whitespace `ANTHROPIC_MODEL`; request override preserved |
| xAI default `grok-3` | `xai-ai.adapter.spec.ts` asserts default `grok-3` |
| Gateway invalid provider | Controller / public-api resolveProvider BadRequest paths |
| Invalid / missing model allowlist | **Absent** |
| Frontend catalogue / selector payload | Shell tests use fixture options; no strong catalogue contract test |
| Agent harness model profiles | Separate registry tests — **not wired to execute path or frontend selector** |

### 2.9 Shared provider/model catalogue?

**No shared product catalogue exists.**

Related but **not** product-selector authority:

- `services/ai-service/src/agent-harness/model-profiles/model-profile.registry.ts` — harness-only profiles (includes stale `claude-3-5-sonnet-20241022` and `grok-3`); intentionally not wired to `/api/ai/execute` or UI.
- No `packages/` shared workspace package.

### 2.10 Smallest safe architecture to prevent FE/BE drift

**Decision: bounded source-controlled dual catalogue with backend ownership for validation, frontend mirror for UI, parity tests — no runtime catalogue fetch.**

Rationale:

- No existing dynamic model-fetch architecture.
- No shared package layer.
- Runtime provider catalogue APIs would expand scope and require new endpoints/auth.
- Private beta needs a small, testable, reversible allowlist.

### 2.11 Catalogue fields for private beta

Include:

| Field | Required | Notes |
|---|---|---|
| `provider` | Yes | Exact identifier (`xai`, `anthropic`, …) |
| `model` | Yes | Exact provider model ID (verified before implementation) |
| `optionValue` | Yes (frontend) | Stable `provider:model` selector value |
| `labelKey` | Yes (frontend) | i18n key — **no hardcoded English user-facing labels** |
| `isDefault` / default model per provider | Yes | One default model per enabled provider; platform default provider remains configurable |
| `enabled` | Yes | Hide/disable stale entries without deleting history references abruptly |
| `supportsToolUse` | Optional advisory | Do **not** gate text `file-actions` smoke on this flag |

Do **not** require in this slice: cost tier, context window, streaming flags, vision, durable preferences.

### 2.12 Model ID configuration strategy

**Bounded combination (preferred):**

1. **Source-configured catalogue** is the private-beta allowlist and UI option source.
2. **Environment override for adapter construction defaults** where already established or needed for staging:
   - Keep FR-04A `ANTHROPIC_MODEL` (do not regress).
   - Add `XAI_MODEL` (and optionally other `*_MODEL` keys only if required for clear fail-fast without inventing IDs in code).
3. **No dynamic provider catalogue fetching** in FR-04B.
4. **Official model IDs must be verified** against current provider docs / account availability **immediately before Step 2 implementation** — do not copy prior docs blindly.

### 2.13 Preserve request-level overrides safely

Rules:

1. Request may supply `provider` + `model`.
2. Provider must be in supported provider allowlist.
3. If `model` is present, it must be an **enabled catalogue model for that provider** (or explicitly allowed env/default path for Anthropic configured model that matches catalogue policy).
4. Provider/model mismatch (e.g. `provider=xai` + Anthropic model ID) → clear `400` (gateway) and/or fail-fast in AI Service before provider call.
5. Missing model → use provider default from catalogue / env policy (not an arbitrary stale hardcode).
6. Do not accept arbitrary unknown model strings in private beta.

### 2.14 Official model IDs requiring external verification before implementation

Verify **immediately before Step 2**, not during registration:

| Provider | Current source ID | Verification needed |
|---|---|---|
| xAI | `grok-3` | **Critical** — replacement default + UI option; account availability |
| Anthropic | `claude-3-5-sonnet-20241022` | Frontend list replacement; must align with FR-04A env posture (no new hardcoded Anthropic default in adapter) |
| OpenAI | `gpt-4o` | Confirm still supported for private beta |
| Groq | `mixtral-8x7b-32768` | Likely stale/retired — verify replacement |
| DeepSeek | `deepseek-chat` | Confirm still supported |

Registration must **not** invent replacement IDs.

### 2.15 Child-slice decision

**Child splitting is required for Step 2** because one mixed frontend + api-gateway + ai-service + multi-adapter change is too broad.

Sequential slices under FR-04B (no separate child task IDs registered yet):

1. **Step 2a — Backend** — authoritative catalogue module, gateway/ai-service validation, xAI (and other non-Anthropic) default hardening, focused backend tests.
2. **Step 2b — Frontend** — mirrored catalogue options, i18n labels, stale selection migration, focused frontend tests / typecheck / build.

Register separate `FR-04B1` / `FR-04B2` task IDs only if Step 2a needs its own consolidation checkpoint before 2b starts.

---

## 3. Planning Decisions

### 3.1 Authoritative catalogue ownership

| Layer | Role |
|---|---|
| **AI Service catalogue module (authoritative for execution)** | Source of truth for enabled provider/model pairs, per-provider default model ID (after verification), optional tool-use advisory flag |
| **API Gateway** | Fail-fast request validation against the same allowlist contract (duplicated module or shared frozen expected set asserted by tests) |
| **Frontend mirror** | UI options only — same provider/model/optionValue/enabled/default; labels via i18n keys |
| **Agent harness model profiles** | **Out of scope** — do not wire or rewrite in FR-04B |

Parity rule: frontend enabled options ⊆ backend enabled catalogue; defaults must match for the platform default provider/model pair used by the selector.

### 3.2 xAI default-model behavior

| Mode | Behavior |
|---|---|
| Goal | xAI **must not** silently default to hardcoded `grok-3` |
| Preferred construction | Mirror FR-04A fail-clear pattern with explicit `XAI_MODEL` **or** catalogue-selected verified default passed into `XAIAdapter` — chosen at Step 2a after ID verification |
| Request override | Allowed only if model is enabled for `xai` in catalogue |
| Missing/empty configured default when provider is `xai` | Fail clearly before provider call |
| Stub / execution-disabled | Unaffected |

Do not hardcode a replacement xAI model ID in registration docs.

### 3.3 Provider/model validation behavior

1. Invalid provider → clear 400 (existing).
2. Invalid model for provider / disabled catalogue entry → clear 400 (new).
3. Missing model → provider default from catalogue/env policy.
4. Anthropic continues to require `ANTHROPIC_MODEL` for adapter construction (FR-04A invariant).
5. No credentials in catalogue or source.

### 3.4 Fallback behavior

| Case | Behavior |
|---|---|
| Unknown UI option value (stale persisted React state / bad value) | Migrate to current default option; do not send retired IDs |
| Unknown request model at API | Reject clearly — do not silently rewrite to another provider’s model |
| Provider API rejects a verified-listed model | Surface provider error; do not invent alternate ID at runtime |

### 3.5 Migration behavior for stale UI state

- `parseSelectedChatModelOption` (or successor) must map unknown / disabled option values to the current default enabled option.
- After catalogue update, selecting retired Anthropic/xAI/Groq IDs must be impossible in the selector.
- No durable preference store exists today — migration is in-memory parse/fallback only.

### 3.6 Multilingual changes

If Step 2b changes selector-visible option text:

- Update together: `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json`
- Use existing translation hook/pattern
- Replace hardcoded English `label` strings with `labelKey` + translated strings
- Preserve selector interaction; no redesign, routing, or new dependencies
- Heroicons v2 Outline only if any icon is involved (none expected)
- Impeccable / Emil skills advisory only

### 3.7 Rollback behavior

- Source-only change: revert FR-04B commits / restore prior catalogue + adapter defaults.
- Do not leave partial enablement of AI execution.
- FR-04A Anthropic fail-fast must remain intact on rollback of FR-04B (do not reintroduce Anthropic hardcoded default).
- No staging PM2 rollback is part of FR-04B (runtime remains disabled).

---

## 4. Bounded Implementation Scope

### 4.1 Exact implementation files (proposed)

**Step 2a — Backend (must change):**

1. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\provider-model.catalogue.ts` (**new** — authoritative catalogue)
2. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\ai-execution.service.ts`
3. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\xai-ai.adapter.ts`
4. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\openai-ai.adapter.ts` (only if default/validation wiring requires it)
5. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\groq-ai.adapter.ts` (same)
6. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\deepseek-ai.adapter.ts` (same)
7. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\ai-execution.controller.ts` (model allowlist validation)
8. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\public-api\public-ai.controller.ts` (parity validation if public execute remains in scope)
9. New/updated backend catalogue + adapter + controller tests under ai-service / api-gateway `__tests__`
10. Example env docs only if `XAI_MODEL` (or similar) is introduced: root + `services/ai-service/.env.example` — **blank placeholders only**; do not open real env files

**Step 2b — Frontend (must change):**

11. `C:\Users\knlee\aiSandBox2026B\frontend\lib\ai\provider-model.catalogue.ts` (**new** — UI mirror)
12. `C:\Users\knlee\aiSandBox2026B\frontend\app\[locale]\app\page.tsx` (consume mirror; remove inline stale list / hardcoded English labels)
13. `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
14. `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
15. `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
16. Focused frontend tests (page/shell catalogue / fallback / selector fixtures)

**Likely touch if assertions break:**

17. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\__tests__\xai-ai.adapter.spec.ts`
18. `C:\Users\knlee\aiSandBox2026B\frontend\components\workspace\workspace-shell.test.tsx`
19. Related ai-execution phase specs asserting default models

**Explicitly out of scope files:**

- Locked FR-04A checkpoint
- Agent harness `model-profile.registry.ts` (unless a later approved task)
- Driver page (unless Keith expands scope)
- Staging / PM2 / real `.env` / credentials
- Preview investigation task

### 4.2 Out of scope

- Enabling AI execution / `GLOBAL_EXECUTION_ENABLED`
- Staging PM2 / SSH / provider calls
- Dynamic model catalogue APIs
- Durable per-user/project model preferences
- Billing, invitations, PRIVATE-BETA-INVITE-01
- Broad workspace redesign
- Reworking FR-04A Anthropic fail-fast invariants
- Inventing official model IDs without verification

---

## 5. Three-Step Workflow

1. **Registration / planning** — COMPLETE (this document + TASKS / backlog / roadmap / FR-04 readiness plan updates) — 2026-08-06
2. **Source implementation + focused validation** — NEXT / NOT STARTED  
   - **2a Backend first** (catalogue + validation + xAI default hardening)  
   - **2b Frontend second** (mirror + i18n + stale migration)  
3. **Consolidation / checkpoint** — NOT STARTED

After FR-04B COMPLETE and LOCKED, FR-04 Step 2 (readiness approval + Keith xAI config verification) may resume. Until then, FR-04 runtime Steps 2–4 remain **BLOCKED pending FR-04B**.

---

## 6. Tests and Validation Required (implementation step only)

### 6.1 Backend tests

| Case | Expected |
|---|---|
| Catalogue lists enabled provider/model pairs | Stable contract |
| Invalid provider | 400 / existing behavior |
| Invalid model for provider | Clear rejection before provider call |
| Missing model | Provider default from catalogue/env policy |
| xAI no longer silently uses hardcoded `grok-3` | Asserted |
| Request-level valid override | Preserved |
| Anthropic `ANTHROPIC_MODEL` path | Unchanged / still fail-clear |
| Stub / execution-disabled | Unaffected |

### 6.2 Frontend tests

| Case | Expected |
|---|---|
| Selector options match enabled mirror catalogue | Pass |
| Default option is current verified default | Pass |
| Stale option value migrates to default | Pass |
| Execute payload uses selected provider/model | Pass |
| i18n keys used for option labels | Pass / no new hardcoded English UI labels |

### 6.3 Validation commands (Step 2 only; not during registration)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- --testPathPattern="provider-model.catalogue|xai-ai.adapter|ai-execution.phase30c|ai-execution"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- --testPathPattern="ai-execution"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test -- --testPathPattern="workspace-shell|provider-model|app/page"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

Do **not** run these during registration. Do **not** start services, touch staging, call providers, or enable AI execution.

---

## 7. FR-04 Integration Requirements

| Item | Requirement |
|---|---|
| Parent FR-04 | Remains ACTIVE |
| FR-04 runtime Steps 2–4 | **BLOCKED pending FR-04B COMPLETE and LOCKED** |
| Preferred smoke provider | Still intended `xai`, but **model ID must be the post-FR-04B verified default**, not assumed `grok-3` |
| FR-04A | COMPLETE and LOCKED — optional Anthropic readiness only — **do not modify locked checkpoint** |
| AI execution | Remains disabled until separate FR-04 runtime authorization |
| Invitations | PRIVATE-BETA-INVITE-01 NOT REGISTERED |
| Preview 404 | Unrelated — do not register preview investigation here |

---

## 8. Exact Next Action

**PRIVATE-BETA-FUNCTIONAL-READINESS-04B Step 2a — Backend source implementation** of the authoritative provider/model catalogue, request validation, and xAI default-model hardening — **only after Keith verifies official model IDs / account availability for the enabled private-beta set** (especially xAI replacement for `grok-3`).

AI execution remains disabled. No runtime enablement in Step 2a/2b.

---

## 9. Safety Confirmations (registration)

- No source / test / translation / package code changed
- No terminal or Git commands run
- No subagents used
- No real environment files or secrets inspected
- No staging / PM2 / Docker / PostgreSQL / Redis / Caddy / provider configuration changed
- No AI provider called
- AI execution remains disabled
- No browser testing
- No locked checkpoints modified
- No users invited
- PRIVATE-BETA-INVITE-01 NOT REGISTERED

---

*Do not treat replacement model IDs in older docs as authoritative. Verify official provider documentation and account availability immediately before implementation.*
