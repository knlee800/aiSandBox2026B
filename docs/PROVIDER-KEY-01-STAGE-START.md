# PROVIDER-KEY-01 — Stage-start (Step 2 of 4): a safe missing-key message and a working default

**Task:** PROVIDER-KEY-01 (Lane 1, admitted 2026-11-13 for this document only).
**Status of this file:** DRAFT for Keith's approval. No code changed, nothing run.
**Author:** fable subagent (stage-start draft), worktree `lane/PROVIDER-KEY-01`, cut from main at 77f2ca3.
**Short names:** FE = `frontend`, GW = `services/api-gateway/src`, AI = `services/ai-service/src`, page = `frontend/app/[locale]/app/page.tsx`, shell = `frontend/components/workspace/workspace-shell.tsx`, worker = `AI/worker/worker.processor.ts`.

## Summary

- A run on a provider with no key fails inside the AI service with a plain error. The worker's sanitiser turns it into `execution_failed` / "This step failed.". The chat then shows "Execution ended with status: failed.".
- **The task body misses one cause.** The gateway never returns a stored failure reason to the workspace chat: for a failed run the status answer has no `output` and no `error` (section 1.3). So fixing the sanitiser alone changes nothing the user sees. The gateway must return the code.
- Recommended, two slices in order:
  - **3A backend (AI-SERVICE, GATEWAY; opus):** a typed `ProviderKeyMissingError` with code `provider_key_missing` and the fixed sentence `AI provider is not configured`; the sanitiser lets exactly that pair through; the gateway returns `error.code` for it on the status answer; a new signed-in read route `GET /api/ai/providers` answers booleans only, from the AI service (the only service that knows which keys it has).
  - **3B frontend (FRONTEND, I18N; sonnet):** the chat maps the code to a translated sentence; the picker offers only usable providers; the default is the first usable one; a translated empty state with Send disabled when none is usable.
- The sanitiser's credential check (`looksLikeCredential`) is not changed. No guard, cookie, CSRF or internal-key change. No migration, no new dependency, no env change.
- Evidence class LOCAL-TESTS; the live check belongs to a later deploy task (section 7).
- Three decisions for Keith in section 8.

## 1. Today's facts

### 1.1 Where the provider and model are chosen

| Fact | Evidence |
|---|---|
| The frontend catalogue marks xai, groq, deepseek, openai and anthropic `selectable: true`; stub is not selectable | `FE/lib/ai/provider-model.catalogue.ts:35-221` |
| The default is fixed: xai / grok-4.5 | `FE/lib/ai/provider-model.catalogue.ts:32-33`, `:355-358` |
| An unknown or unselectable provider resolves to xai | `FE/lib/ai/provider-model.catalogue.ts:271-278` |
| The choice lives only in React state, starting at the default on every load; nothing stores it | page `:1179-1184` |
| The picker options come straight from the catalogue; nothing filters them | page `:1253-1262`; select at shell `:4562-4582` |
| Only the workspace page imports the catalogue | page `:183` (the only non-test import) |
| Every chat run sends `provider` and `model` in the body | page `:4622-4631` |
| The gateway resolves the request's provider; `AI_PROVIDER` is only the fallback when the request names none | `GW/ai/ai-execution.controller.ts:461-476` |
| The AI service never guesses: the provider comes from the request | `AI/ai-execution/ai-execution.service.ts:64-78`, `:175-181` |
| No per-provider entitlement exists (the entitlement service has no provider field) | `GW/auth/entitlement.service.ts` (searched, no match) |

### 1.2 Switches and keys

| Fact | Evidence |
|---|---|
| `GLOBAL_EXECUTION_ENABLED` must be exactly `true`, else 503 | `GW/safety/kill-switch.config.ts:17-18`; `GW/safety/execution-safety.guard.ts:49-53` |
| `PROVIDER_*_ENABLED` default to on; stub is always on | `GW/safety/kill-switch.config.ts:25-38`, `:64-84` |
| **On `POST /api/ai/execute` the provider switch is checked for `AI_PROVIDER`, not for the provider in the request.** With `AI_PROVIDER=stub` the check always passes | `GW/safety/execution-safety.guard.ts:45`, `:55-59`; no other `isProviderEnabled` call on that route (`GW/ai/ai-execution.controller.ts` has none) |
| The Team page path does check the chosen provider's switch | `GW/orchestration/collaboration-workflow.ts:290`; `GW/orchestration/orchestration.service.ts:1904` |
| Keys used for runs are read only in the AI service, per request | `AI/ai-execution/ai-execution.service.ts:198`, `:210`, `:222`, `:234`, `:246` |
| The gateway reads provider keys only for start-up checks, from its own environment | `GW/startup/provider.validator.ts:232-262`; `GW/startup/startup-guard.service.ts:240-241` |
| The two services can hold different keys: the production compose file gives the gateway five key names and the AI service one | `docker-compose.prod.yml:90-94` (gateway), `:138` (AI service) |
| Every AI service route needs `X-Internal-Service-Key` (global guard); the gateway's client sends it | `AI/app.module.ts:43-47`; `AI/guards/internal-service-auth.guard.ts:36-46`; `GW/clients/ai-service-http.client.ts:102-108` |

So only the AI service can say truthfully which providers have a key. The staging env files were not read (rule: no env files).

### 1.3 How a run error travels

| Step | Fact | Evidence |
|---|---|---|
| 1 | A missing key throws a plain `Error` naming the env variable | `AI/ai-execution/ai-execution.service.ts:199-203` (and `:211-215`, `:223-227`, `:235-239`, `:247-251`) |
| 2 | All three call sites sit inside the worker's one try block | worker `:1627` (try), `:1706`, `:1822`, `:2121`, `:2438` (catch) |
| 3 | The catch builds the stored error with `resolveStoredExecutionError` | worker `:2508-2511`, `:798-828` |
| 4 | The code is the error's own `.code` when it is a short code, else `execution_failed` | worker `:635`, `:638`, `:706-719` |
| 5 | A message that exactly equals a known sentence for its code is kept before the unsafe check | worker `:804-809` |
| 6 | `looksLikeCredential` matches `api_key`, the words key, password, secret, bearer, token, and key shapes; an unsafe message becomes the code's fixed sentence, else "This step failed." | worker `:749-758`, `:790-796`, `:810-815`, `:692-704`, `:636` |
| 7 | It is stored as `usage_records.metadata.executionError = { code, message }` | worker `:1339-1344`, `:2530-2541` |
| 8 | Jobs run once (no retries) | `GW/queue/queue.service.ts:33-41` |
| 9 | **The gateway status route returns only status, provider and model for a failed run.** `error` exists on the DTO but is never filled | `GW/ai/ai-execution.controller.ts:1109-1158`; `GW/ai/dto/execution-result.dto.ts:11-14` |
| 10 | The chat reads only `data.output`; empty output gives the hardcoded English fallback | page `:785-792`, `:4384`, `:4461-4472`; `FE/components/workspace/workspace-run-cancel.logic.ts:60-63` |
| 11 | The stream carries tokens, file actions and progress, no error | page `:4209-4261` |
| 12 | The Team page does get the stored reason, through a second sanitiser in the gateway | `GW/orchestration/orchestration.service.ts:2540-2550`; `GW/orchestration/collaboration-failure-reason.ts:11-57` |

**PROVIDER-LIMIT-MSG-01 precedent.** The adapter throws a fixed sentence, `AI provider usage limit reached` (`AI/ai-execution/adapters/anthropic-ai.adapter.ts:28`); the frontend maps that exact sentence (`FE/components/workspace/workspace-quota-usage.logic.ts:151-153`; `FE/lib/collaboration/logic.ts:34-45`). On the Team page this works (row 12). **In the workspace chat it cannot fire for a failed run**, because of rows 9 and 10. Its checkpoint had no live check (`docs/PROVIDER-LIMIT-MSG-01-CHECKPOINT.md:48`). Read from code; not verified live.

### 1.4 The run error code set

| Where | What |
|---|---|
| Defined | Only in the worker: `execution_failed` (`:635`), `file_action_contract_failure` (`:119`), the harness, tool-profile, knowledge and entitlement-proof codes (`:644-690`) |
| Gateway | Reads `executionError` generically; switches on no code (`GW/orchestration/collaboration-failure-reason.ts:11-23`) |
| Frontend | Reads no code at all (searched `frontend` for `execution_failed`, `harness_tool_loop_disabled`, `file_action_contract`: no match) |

It is a de facto shared contract (stored JSON written by the AI service, read by the gateway), not frozen. This task adds the first code the frontend reads. **Freeze section 3 for Step 3** so 3B can be written against it.

### 1.5 Claims in the task body

| Claim | Result |
|---|---|
| Catalogue lists every provider as selectable; nothing tells the frontend which have a key | Correct |
| Selection not stored; every load starts at xai | Correct |
| Missing key throws a plain error | Correct |
| `looksLikeCredential` turns it into "This step failed." / `execution_failed` | Correct. The match is `api[_ -]?key` on the env variable name (worker `:751`) |
| "so the chat shows only Execution ended with status: failed." | **Incomplete.** The chat shows that for every failed run, because the gateway returns no reason (1.3 rows 9-10). A safe sentence alone would still not be shown |

## 2. Telling the frontend which providers are usable

| Option | For | Against |
|---|---|---|
| (a) New field on `GET /api/auth/me` | No new route; the page already loads it (page `:1475-1490`) | Touches the auth controller; makes sign-in state depend on the AI service being up |
| (b) Gateway answers from its own environment | No cross-service call | Wrong source: the gateway's keys are not the AI service's keys (1.2) |
| **(c) New read route `GET /api/ai/providers` on the gateway, which asks the AI service** | Truthful; auth controller untouched; fails soft | One new internal read route on the AI service |
| (d) Frontend learns only from failed runs | No route | The user must fail once per provider; no working default |

**Chosen: (c).**

- **AI service:** `GET /api/internal/provider-availability`, under the existing global internal-key guard, no exemption. It answers from the same key read `getAdapter` uses (one shared helper, so the two cannot drift).
- **Gateway:** `GET /api/ai/providers` with `SessionOrApiKeyAuthGuard`, the guard the other read routes on that controller use (`GW/ai/ai-execution.controller.ts:1070-1071`, `:1109-1110`). It calls the AI service through `AIServiceHttpClient` with a 3-second timeout and keeps the answer in memory for 60 seconds (keys change only when the AI service restarts). If the AI service cannot answer: 503, nothing cached.
- **Meaning of usable:** the AI service has a non-empty key for that provider. Not included: the provider switch (question 1), `GLOBAL_EXECUTION_ENABLED` (it already has its own 503 message), entitlements (none exist per provider).
- **Never exposed:** key values, lengths, prefixes, env variable names. Booleans only. Stub is never listed.
- **Frontend:** one fetch after `/api/auth/me` succeeds. If it fails, the page behaves as today (all providers offered); the run-time message in section 3 still covers a keyless run.
- Any signed-in user can learn which providers are set up. This is low-sensitivity and already observable by trying a run.

## 3. The safe error and the contract to freeze

**Code:** `provider_key_missing`. **Stored sentence:** `AI provider is not configured`. The sentence has no credential word on purpose, so it also passes the gateway's Team-page sanitiser (`GW/orchestration/collaboration-failure-reason.ts:48-57`) unchanged.

**Raised** in `getAdapter`, before any adapter is built or any provider is called: the five plain throws become `throw new ProviderKeyMissingError(provider)`. The class sets `code` and the fixed message. The provider name and the env variable name go to a warn log line only (names are not secrets); they are not in the error message.

**Sanitiser.** In `resolveStoredExecutionError`, first: `if (error instanceof ProviderKeyMissingError)` return the fixed pair. Also add the code to `knownHarnessMessages`, so any other error carrying this code can only store the fixed sentence when its text is unsafe. `looksLikeCredential`, `isUnsafeExecutionErrorText` and the generic fallback are not edited. The type decides, not the text.

**Gateway.** For a failed run whose stored code is in a fixed allow-list, the status answer gains `error: { code, message }`, where `message` is the gateway's own constant for that code, never the stored text. Allow-list in this task: `provider_key_missing` (and one more entry if question 2 is yes). Every other failed run answers as today.

**Frozen for Step 3:**

| # | Contract |
|---|---|
| C1 | `usage_records.metadata.executionError` = `{ "code": "provider_key_missing", "message": "AI provider is not configured" }` |
| C2 | `GET /api/ai/executions/:id`, status `failed`, stored code `provider_key_missing`: adds `"error": { "code": "provider_key_missing", "message": "AI provider is not configured" }`. No other field changes |
| C3 | `GET /api/internal/provider-availability` (AI service, internal key): `{ "providers": { "xai": bool, "groq": bool, "deepseek": bool, "openai": bool, "anthropic": bool } }` |
| C4 | `GET /api/ai/providers` (gateway, signed in): 200 `{ "providers": [ { "id": "xai", "usable": bool }, ...groq, deepseek, openai, anthropic ] }` in that fixed order; 401 without a session or key; 503 when the AI service cannot answer |

**Translated text** (namespace `ai`, next to `providerUsageLimit`, `FE/messages/en.json:480`):

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `ai.providerKeyMissing` | This AI provider isn't set up yet, so the run couldn't start. Choose another provider, or ask an admin to add its key. | 這個 AI 供應商尚未設定，所以無法開始執行。請選擇其他供應商，或請管理員加入金鑰。 | 这个 AI 供应商尚未设置，所以无法开始运行。请选择其他供应商，或请管理员添加密钥。 |
| `ai.noProviderAvailable` | No AI provider is set up yet, so runs can't start. Ask an admin to add a provider key. | 尚未設定任何 AI 供應商，所以無法開始執行。請管理員加入供應商金鑰。 | 尚未设置任何 AI 供应商，所以无法开始运行。请管理员添加供应商密钥。 |
| `ai.noProviderOption` | No provider available | 沒有可用的供應商 | 没有可用的供应商 |

The wording follows the existing usage-limit message ("AI 供應商" / "AI 供应商", "執行" / "运行").

## 4. The default and the picker

- **Usable list unknown** (not loaded yet, or the fetch failed): as today. All five offered, default xai.
- **Usable list known, at least one usable:** the picker offers only usable providers, in catalogue order (xai, groq, deepseek, openai, anthropic). If the current choice is not usable, it moves to the first usable provider and that provider's default model. The user's own later choice among usable providers is kept.
- **Usable list known, none usable:** the provider select shows one disabled option (`ai.noProviderOption`), the model select is disabled, Send is disabled, and `ai.noProviderAvailable` is shown as the chat hint line. No run is sent.
- **Fixed order, not server-recommended.** The server says only what is usable; the order stays in the frontend catalogue, where the default already lives.
- **Remembering the choice:** out of scope (question 3).
- The model lists are not filtered; a key covers every model of its provider.
- Existing test ids stay: `workspace-chat-provider-selector`, `workspace-chat-model-selector`, `workspace-chat-submit`, `workspace-chat-session-hint` (shell `:4547`, `:4564`, `:4588`, `:4619`).

## 5. Slices

One task, two slices, in order. 3B is written against the frozen contract C2 and C4, so it can start once 3A is merged, or beside it if the control plane prefers (write sets and mutexes do not overlap).

### 5.1 Slice 3A — backend

**Mutexes:** AI-SERVICE, GATEWAY. No FRONTEND, I18N, PACKAGE, ENV, MIGRATION.
**Model: opus.** Cross-service, a new internal route, and a change beside the error sanitiser (Model Routing: cross-service and internal routes go to opus).
**Checklists:** EVERY, BACKEND.

Write set (exact):

| File | Change |
|---|---|
| `services/ai-service/src/ai-execution/provider-key-missing.error.ts` (new) | Code, sentence, `ProviderKeyMissingError` |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | One shared key read; the five throws become the typed error; `getProviderKeyAvailability()` |
| `services/ai-service/src/ai-execution/ai-execution.controller.ts` | `GET internal/provider-availability` |
| `services/ai-service/src/worker/worker.processor.ts` | Only `knownHarnessMessages` and `resolveStoredExecutionError` (section 3) |
| `services/ai-service/src/ai-execution/__tests__/ai-execution.service.spec.ts` | Tests |
| `services/ai-service/src/ai-execution/__tests__/provider-availability.controller.spec.ts` (new) | Tests |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Tests |
| `services/api-gateway/src/clients/ai-service-http.client.ts` | `getProviderAvailability()`, 3-second timeout |
| `services/api-gateway/src/clients/ai-service-http.client.spec.ts` | Tests |
| `services/api-gateway/src/ai/provider-availability.ts` (new) | Parse C3 strictly, build C4, 60-second cache |
| `services/api-gateway/src/ai/execution-error.ts` (new) | Allow-list mapper from stored metadata to the DTO `error` |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | `GET providers`; fill `error` in `getExecution`; the client injected `@Optional()` like the others (`:236-243`) |
| `services/api-gateway/src/ai/__tests__/provider-availability.spec.ts` (new) | Tests |
| `services/api-gateway/src/ai/__tests__/execution-error.spec.ts` (new) | Tests |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Tests |

Tests:

| Area | Tests |
|---|---|
| AI service, error | Each of the five providers with no key, an empty key and a blank key throws `ProviderKeyMissingError` with the code and the fixed sentence; the message holds no env variable name; with a key the adapter is built as before; stub needs no key |
| AI service, sanitiser | The typed error stores exactly C1; an error with that code and text holding `sk-...`, "api key" or a stack stores the fixed sentence; the existing test "replaces a stack, a key, prompt text, or file content with a fixed sentence" (spec `:6805`) passes unchanged; a plain error mentioning a key still stores `execution_failed` / "This step failed." |
| AI service, route | C3 shape; booleans follow the configured keys; the body holds no key value (set a marker key, assert the marker is absent); refused without the internal key (global guard) |
| Gateway, availability | C4 shape and order; a malformed or partial C3 answer gives 503; a non-boolean counts as false; second call inside 60 seconds does not call the client; a failure is not cached; 401 without identity |
| Gateway, status | Failed run with stored `provider_key_missing` returns C2 with the gateway's constant even when the stored message differs; failed run with any other code, or with no stored error, answers exactly as today; completed, queued, cancelled and timeout answers unchanged; another user's run is still 404 |

Gates: AI service `npx jest` (baseline 1331 passed, 1 skipped at ACCESS-01J) and `npm run build`; gateway `npm test` (compare with the known failures in its latest checkpoint; the control plane supplies the number) and `npm run build`.

Stop conditions: any need to edit `looksLikeCredential`, `isUnsafeExecutionErrorText`, a guard, the internal-key guard or its exemption list, a cookie, CSRF, or any adapter; any need to read or log a key value; any change to the queue job shape or to another route's answer; any new dependency or a file outside the write set; a gate failure that is not a known one.

### 5.2 Slice 3B — frontend

**Mutexes:** FRONTEND, I18N. No PACKAGE.
**Model: sonnet.** One service, copy plus small pure logic against a frozen contract. If the control plane judges the `page.tsx` wiring risky, opus.
**Checklists:** EVERY, UI. The brief names `.agents/skills/impeccable` and `.agents/skills/emil-design-eng`; the worker reads both and `DESIGN.md` before changing the picker and the hint line.

Write set (exact):

| File | Change |
|---|---|
| `frontend/lib/ai/provider-availability.ts` (new) | Parse C4 strictly into a usable-id list or null |
| `frontend/lib/ai/provider-availability.test.ts` (new) | Tests |
| `frontend/lib/ai/provider-model.catalogue.ts` | Pure helpers: filter entries by a usable list; resolve a selection within it; null means no filter. Existing exports keep their behaviour |
| `frontend/lib/ai/provider-model.catalogue.test.ts` | Tests |
| `frontend/components/workspace/workspace-quota-usage.logic.ts` | `errorCode` input and `providerKeyMissing` copy, checked first |
| `frontend/components/workspace/workspace-quota-usage.logic.test.ts` | Tests |
| `frontend/app/[locale]/app/page.tsx` | Fetch C4 after `/api/auth/me`; usable state; filtered options and default; read `data.error.code` at both terminal-failure sites (`:4455-4472`, `:5174-5189`); one new copy entry (`:1146-1156`); pass the empty-state props |
| `frontend/components/workspace/workspace-shell.tsx` | Empty state: disabled option, Send disabled, hint line (`:4167-4172`, `:4562-4623`, props at `:657-660`, `:4089-4092`) |
| `frontend/components/workspace/workspace-shell.test.tsx` | Tests |
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | The three keys in section 3 |

The validator does not accept brackets in a path; the sidecar lists `frontend/app/` and this table limits it to `page.tsx`, as PROVIDER-LIMIT-MSG-01 did.

Tests:

| Area | Tests |
|---|---|
| Availability parser | Valid C4 gives the usable ids; wrong shape, unknown ids and non-boolean values give null or are dropped; an all-false answer gives an empty list, not null |
| Catalogue | Null list: today's results, default xai; list with xai: xai kept; list without xai: first usable in catalogue order with its default model; a chosen usable provider is kept; empty list: no entries; stub never offered |
| Failure copy | Code `provider_key_missing` returns the translated copy in each language, before the quota and rate-limit checks; without the code today's results are unchanged; the three keys exist, and zh-TW and zh-CN differ from en and from each other |
| Shell | None usable: the disabled option, Send disabled, the hint shows `ai.noProviderAvailable`; otherwise the markup is as today; the four test ids still exist |

Gates: `npx tsc --noEmit`, `npm test` (baseline 1273 passed at FE-TEST-GLOB-01), `npm run build`, then restore `frontend/tsconfig.tsbuildinfo`.

Stop conditions: any backend file; any change to C2 or C4; any new visible text outside the three keys; a changed or removed test id; storing the choice (question 3); a new dependency or a file outside the write set; a gate failure that is not a known one.

## 6. Acceptance criteria

- [ ] Scope, write sets, mutexes and the frozen contract (section 3) are approved by Keith before Step 3
- [ ] A run on a provider with no key stores exactly `provider_key_missing` / `AI provider is not configured`, raised from the typed error before any provider call; no env variable name or key text is stored
- [ ] `looksLikeCredential` and the generic fallback are unchanged; a plain error that mentions a key still stores `execution_failed` / "This step failed."
- [ ] The status answer for such a run carries `error.code = provider_key_missing`; every other answer is unchanged
- [ ] `GET /api/ai/providers` needs a signed-in caller and answers booleans only; the AI service route needs the internal key; no key value, length, prefix or env variable name appears in either answer
- [ ] The workspace chat shows the translated sentence in en, zh-TW and zh-CN for that code; no hardcoded English is added
- [ ] With the usable list loaded, keyless providers are not offered, the default is the first usable provider, and with none usable Send is disabled and the translated notice is shown; when the list cannot be loaded the page behaves as today
- [ ] Tests in sections 5.1 and 5.2 pass; gates are compared with the known baselines
- [ ] The checkpoint carries the CHECKLIST line (EVERY, BACKEND, UI), the model used per slice and the FOLLOWUPS line
- [ ] Not LOCKED by an implementer

## 7. Live check (for a later deploy task)

Staging today: every `PROVIDER_*_ENABLED` false, `AI_PROVIDER=stub`, runs off, one Anthropic test key on the host. No new key is needed and no provider is called.

**From the host (stored API key, no browser):**

1. `GET /api/ai/providers` without credentials: 401.
2. With the stored key: 200, five entries in the fixed order, each `usable` a boolean.
3. Compare each boolean with a presence-only count in the AI service env file (for example `grep -c '^ANTHROPIC_API_KEY=.'`; a count, never the line). They must agree. Whether the Anthropic test key is in that file is **not known here**; the check reports what it finds.
4. The saved answer holds no key text (search for `sk-` and for each key's first characters by count only: 0).
5. The AI service route without the internal key: 401.
6. Health, guard and page checks as in the DEPLOY checklist; env file hashes unchanged.

**Keith, in the browser (about two minutes):**

1. Open a project. The provider picker lists only the providers from step 2 with `usable: true`, and the first of them is selected. If none is usable: the "No provider available" option, Send disabled, the notice under the box.
2. Switch to 繁體中文 and 简体中文: the notice (if shown) is translated.

**The run-time message** needs runs on and a keyless provider. It is covered by tests. If a later window has runs on, one extra step: from the host, start a run naming a provider with no key; the status answer shows `error.code = provider_key_missing`, the usage row shows 0 tokens, and no provider call appears in the AI service log. This spends nothing.

## 8. Open questions for Keith

1. **Does "usable" also need the provider's switch on?** Recommended: no, key only, as the task says. Reason: the chat route does not enforce the per-provider switch for the chosen provider today (1.2), and staging has every switch false, so adding it would empty the picker there even with a key. The switch gap gets its own follow-up (section 9, item 2). Alternative: usable = key and switch; the picker on staging then shows "No provider available" until a switch is turned on.
2. **Also show the provider usage-limit message in the workspace chat?** PROVIDER-LIMIT-MSG-01 translated it, but the chat cannot receive it (1.3). Recommended: yes, in this task: one more allow-list entry in the gateway (the exact stored sentence `AI provider usage limit reached`), returned as `error.message`, which the existing frontend match already handles. About ten more lines and two tests. Alternative: a separate follow-up task.
3. **Remember the last chosen provider and model?** Recommended: not in this task (new stored state, its own tests); register a follow-up if wanted. Alternative: add it to 3B with `localStorage`, per browser.

## 9. Follow-ups named here (for the control plane to dispose)

1. **Deploy task** for this change, with the live check in section 7 (STAGING, ENV; no migration, no env change).
2. **Provider switch on the chat route:** `ExecutionSafetyGuard` checks `PROVIDER_*_ENABLED` for `AI_PROVIDER`, not for the provider in the request (`GW/safety/execution-safety.guard.ts:45`, `:55`). A guard change; 4-step; then "usable" can include the switch.
3. **Stored failure reasons in the workspace chat in general:** the chat shows "Execution ended with status: failed." for every failed run, in hardcoded English (`FE/components/workspace/workspace-run-cancel.logic.ts:62`). Returning every stored reason and translating the fallback is wider than this task; BUILDER-POLISH-01 already holds similar items.
4. **Team page:** it will show the stored English sentence `AI provider is not configured` for this failure (better than "This step failed.", not translated). Add a `collaboration.providerKeyMissing` mapping beside the usage-limit one (`FE/lib/collaboration/logic.ts:37-45`).
5. **Remembering the choice,** if question 3 is answered "later".
6. **ARCHITECTURE.md** gains a short note at LOCK: the two read routes, the `provider_key_missing` code and the `error` field on the status answer. A governance write by the control plane.
7. **Dead constructor checks:** each adapter also throws "... API key is required" (for example `AI/ai-execution/adapters/anthropic-ai.adapter.ts:107-108`); unreachable after `getAdapter`'s check. No action needed; noted so a later reader does not mistake it for a second path.

## 10. Checklist (Step 2)

CHECKLIST: EVERY 11/11 — 1 met (admitted on the board, Lane 1, write set this file: TASKS.md `lane1.taskId` and the PROVIDER-KEY-01 entry); 2 met (4-step, this is Step 2); 3 met (Fable, named in the brief); 4 met (self-contained brief, boot sequence followed, no subagent started); 5 met (one file, no dependency); 6 n/a (a document, no behaviour change); 7 n/a (no code, no gates); 8 met (nothing started; read-only commands only; no env file read); 9 met (no build ran); 10 met (one commit on the lane branch only; no push, merge or branch change); 11 met (seven follow-ups listed in section 9).
