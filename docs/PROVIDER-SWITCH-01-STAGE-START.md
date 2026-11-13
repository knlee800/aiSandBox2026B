# PROVIDER-SWITCH-01 — Stage-start (Step 2 of 4): check the chosen provider's switch on the chat route

**Task:** PROVIDER-SWITCH-01 (Lane 1, admitted 2026-11-13 for this document only).
**Status of this file:** DRAFT for Keith's approval. No code changed, nothing run.
**Author:** fable subagent (stage-start draft), worktree `lane/PROVIDER-SWITCH-01`, cut from main at 377b968.
**Short names:** GW = `services/api-gateway/src`, AI = `services/ai-service/src`, FE = `frontend`, page = `frontend/app/[locale]/app/page.tsx`, guard = `GW/safety/execution-safety.guard.ts`, catalogue = `GW/ai/provider-model.catalogue.ts`.

## Summary

- **The finding is correct.** On `POST /api/ai/execute` the guard checks the provider switch for `AI_PROVIDER`, never for the provider in the request (guard `:45`, `:55`). With `AI_PROVIDER=stub` the per-provider switch does nothing on that route.
- **Two additions to the task body.** The public API route `POST /api/v1/ai/execute` uses the same guard and has the same gap (section 1.1). And the same wrong value picks the per-provider rate-limit counter (section 1.4).
- **Recommended: one gateway slice (GATEWAY; opus).**
  - The guard resolves the provider with the same function the controllers use (one shared resolver in the catalogue) and checks that provider's switch. This fixes both HTTP routes at once.
  - `GET /api/ai/providers` answers `usable` = the AI service has a key **and** the gateway switch is on, so the picker never offers a provider the guard would refuse.
- No frontend, I18N, AI-service, env, migration or dependency change. The refusal stays `503 Provider <id> temporarily unavailable`, the text the Team page path already uses.
- **Effect on staging:** none visible today (runs are off and no provider has a key). In a later run window, each provider that should run in the chat needs its `PROVIDER_*_ENABLED` set to true in the gateway env. TESTER-WINDOW-01 already did that for Anthropic.
- Evidence class LOCAL-TESTS. The live proof of the refusal needs runs on (section 9).
- Three decisions for Keith in section 10.

## 1. Today's facts

### 1.1 Every path that starts an AI run

| # | Path | Guard or check | Provider value checked against the switch | Evidence |
|---|---|---|---|---|
| 1 | `POST /api/ai/execute` (workspace chat: Ask, Build, step loop) | `ExecutionSafetyGuard` in the route's guard list | `AI_PROVIDER` (wrong) | GW `ai/ai-execution.controller.ts:734-736`; guard `:45`, `:55-59`; page `:4665-4683`, `:5062-5084` |
| 2 | Agent mode / harness | The same route and guard; only extra body fields | `AI_PROVIDER` (wrong) | page `:5073-5074`; `FE/components/workspace/workspace-agent-mode.logic.ts:75`; GW `ai/ai-execution.controller.ts:755-764` |
| 3 | `POST /api/v1/ai/execute` (public API, API key) | The same guard | `AI_PROVIDER` (wrong) | GW `public-api/public-ai.controller.ts:45-46`, `:84-95`, `:138-142` |
| 4 | Driver page | Calls path 1 with `provider: 'xai'` fixed | `AI_PROVIDER` (wrong) | `FE/app/[locale]/driver/page.tsx:64`, `:251-263` |
| 5 | Team page start, `POST /api/collaboration/runs` | Starts nothing: it creates a hand-off waiting for approval | none needed here | GW `orchestration/collaboration.controller.ts:264`, `:306` |
| 6 | Team page approval (a click, the internal approve route, or the automatic approve) | `approveReferral` → `assertHandoffAllowed`: an explicit switch check on the job's provider, then the guard | **the job's provider (right)**, then `AI_PROVIDER` again inside the guard | GW `orchestration/orchestration.service.ts:1112`, `:1143`, `:1888-1910`, `:3563`; `orchestration/internal-collaboration.controller.ts:74-87` |
| 7 | User workflow on a platform model | Switch check when the model is resolved, then path 6 at approval | the workflow's provider (right) | GW `orchestration/collaboration-workflow.ts:263-296` (`:290`) |
| 8 | Team run on the server's model | Provider is `AI_PROVIDER`; checked at approval (path 6) | `AI_PROVIDER`, which is the job's provider (right) | GW `orchestration/collaboration.controller.ts:692`; `orchestration/collaboration-workflow.ts:242-250` |
| 9 | Stream, status, list, cancel, confirm-build-apply | Read or act on an existing run; start none | not applicable | GW `ai/ai-execution.controller.ts:1047`, `:1083`, `:1122`, `:1226`, `:1271` |
| 10 | AI service `POST /api/execute` | Internal key only; no switch. No gateway code calls it | none | AI `ai-execution/ai-execution.controller.ts:19-23`; GW `clients/ai-service-http.client.ts:131` (no caller outside tests; searched GW) |
| 11 | Eval CLIs and canary scripts | Run in the AI service or write to the queue directly; operator tools, never through the gateway | none (by design) | AI `agent-harness/eval/live/live-adapter.ts:41-46`; `services/ai-service/scripts/canary-06d-submit-job.ts:112` |

The gateway puts jobs on the queue in exactly three places: the chat route, the public route and the hand-off start (GW `ai/ai-execution.controller.ts:1026`; `public-api/public-ai.controller.ts:162`; `orchestration/orchestration.service.ts:914`). `createAndStartReferral` (`orchestration.service.ts:955`) has no caller outside its own file (searched GW; not verified against tests).

The AI service and the container manager read no `PROVIDER_*_ENABLED` and no `GLOBAL_EXECUTION_ENABLED` (searched both `src` trees: no match). The switch exists only in the gateway.

### 1.2 How the provider is resolved, and what the guard can read

| Fact | Evidence |
|---|---|
| Both controllers resolve with `resolveGatewayProviderModelSelection`: the request's provider if it is a non-empty string (trimmed, case kept); else `AI_PROVIDER` if it is a supported id; else `stub` | catalogue `:120-126`, `:136-152`; GW `ai/ai-execution.controller.ts:474-489`, `:795`; `public-api/public-ai.controller.ts:65-70` |
| A provider outside the six ids throws; the controllers answer 400 `Unsupported provider "<x>". Supported providers: ...` | catalogue `:154-161`; GW `ai/ai-execution.controller.ts:495-498` |
| Supported ids: stub, anthropic, openai, groq, xai, deepseek. Stub may be named in a request | catalogue `:1-7`, `:62-68`, `:116-118` |
| On the chat route this happens before any ledger write or queue job | GW `ai/ai-execution.controller.ts:795` before `:909`, `:936`, `:1026`; public route `:138-142` before `:145`, `:162` |
| The guard uses `AI_PROVIDER` lower-cased, without checking it is a supported id | guard `:45` |
| The body is already parsed when guards run: Nest's default JSON parser is middleware (not switched off), and other guards read `request.body` today | GW `main.ts:13-16`; guard `:43-46`; `quota/token-quota.guard.ts:150` |
| Nothing validates the body's shape: the body type is an interface, so the global `ValidationPipe` has no class to check. `body.provider` may be any JSON value | GW `main.ts:40-45`; `clients/ai-service-http.client.ts:43-49` |
| The catalogue file has no imports, so the guard can import it without a module cycle | catalogue `:1` (no import lines) |

So the guard can safely read `body.provider` if it treats it as untrusted: a non-string means "not given" (as the controllers do), and only a supported id is ever passed on.

### 1.3 The switches

| Fact | Evidence |
|---|---|
| `GLOBAL_EXECUTION_ENABLED` must be exactly `true`; read on every call | GW `safety/kill-switch.config.ts:17-19` |
| `PROVIDER_*_ENABLED` are on unless the value is exactly `false`; **read once when the gateway process loads** (static fields), so a change needs a gateway restart | GW `safety/kill-switch.config.ts:25-38` |
| Stub is always on; an unknown id is off | GW `safety/kill-switch.config.ts:64-84` |
| The code states the design: "When false: Requests for that provider return 503" | GW `safety/kill-switch.config.ts:21-24` |
| PRD.md and ARCHITECTURE.md describe only the global switch; neither defines the per-provider switches | `ARCHITECTURE.md:833`, `:841`; PRD.md (searched "kill switch", `PROVIDER_`: no match) |
| The guard checks the global switch first, then the provider switch, then the daily credit cap and the rate limits | guard `:49-71`, `:88-111` |
| Staging: every `PROVIDER_*_ENABLED` false, `AI_PROVIDER=stub`, `GLOBAL_EXECUTION_ENABLED=false`; the AI service has no provider key | `docs/PRIVACY-HOST-CHECK-01-CHECKPOINT.md:38`; `docs/STAGING-DEPLOY-PKEY-01-CHECKPOINT.md:25`, `:62-63` (records only; no env file was read) |
| A staging gateway refuses to start with a missing or unknown `AI_PROVIDER` | GW `startup/provider.validator.ts:93-150` |
| A run window already switches its provider on: TESTER-WINDOW-01 set `AI_PROVIDER anthropic` and `PROVIDER_ANTHROPIC_ENABLED true` | `docs/TESTER-WINDOW-01-CHECKPOINT.md:18` |

**What the fix means with every switch false.** Once runs are switched on, every chat run on a real provider is refused with 503 until that provider's switch is set to true; stub still runs. That is what the switch was written to do (the comment above), and it is what the Team page path already does. It is also how run windows have been set up. Recommended: accept it (question 1). Today a window that sets `AI_PROVIDER=anthropic` and only Anthropic's switch on still lets the chat run xAI or OpenAI if they have a key; after the fix it does not.

### 1.4 The same value picks the rate-limit counter

The guard passes the same `provider` to the per-provider rate limit (guard `:63`, `:106`, `:92-93`). So chat runs on any provider count against the `AI_PROVIDER` counter. With `stub` that is the default limit of 1,000 a minute, not the provider's own (GW `safety/global-safety-limits.config.ts:60-77`; `safety/global-safety-limit.service.ts:123-132`). Two integration tests pin this (GW `safety/execution-safety.integration.spec.ts:448-466`). The counters live in a map keyed by the provider string (`global-safety-limit.service.ts:27`), so a raw request value must never reach it. Recommended: leave the counter as it is in this task (question 3).

### 1.5 The refusal and what the user sees

| Fact | Evidence |
|---|---|
| The guard answers 503 `Provider <id> temporarily unavailable`; the Team page path uses the same status and text | guard `:55-59`; GW `orchestration/orchestration.service.ts:1904-1908`; `orchestration/collaboration-workflow.ts:290-294` |
| It is a plain HTTP error before any run exists: no ledger row, no queue job, no stored run error | guards run before the handler; the first write is GW `ai/ai-execution.controller.ts:909` |
| The exception filter returns the body unchanged: `{ statusCode, message, error }` | GW `filters/http-exception.filter.ts:33-52` |
| The chat shows the server's `message` as it is for a 503. It is not translated. The same is true today for the global switch's message | page `:876-892`, `:5086-5110`, `:4685-4713`; `FE/components/workspace/workspace-quota-usage.logic.ts:176-227` (falls through to `:226`) |
| The translated fallback `Chat execution failed ({status}).` is used only when the server sends no message | page `:5108`; `FE/messages/en.json:1835` |

After the fix the id in the message is always one of the six catalogue ids, and it is the provider the caller chose. Naming it is fine and helps an API caller. No raw request text can reach the message (section 2).

### 1.6 Claims in the brief and the task body

| Claim | Result |
|---|---|
| The guard checks `AI_PROVIDER`, not the request's provider | Correct (guard `:45`, `:55`) |
| With `AI_PROVIDER=stub` the switch is never enforced on the chat route | Correct |
| The Team page path checks the chosen provider (`collaboration-workflow.ts:290`, `orchestration.service.ts:1904`) | Correct. Note: a team run's provider is the server's `AI_PROVIDER`, not a request field; only workflows on a platform model differ (1.1 rows 7-8) |
| Controller resolution at `ai-execution.controller.ts:461-476` | Correct content; the lines are now `:474-501` |
| Only the chat route is affected | **Incomplete.** The public API route `POST /api/v1/ai/execute` has the same gap (1.1 row 3), and the rate-limit counter uses the same wrong value (1.4) |
| The existing guard tests | They state the old behaviour on purpose: "The guard reads provider from process.env.AI_PROVIDER, NOT from request body" (GW `safety/execution-safety.guard.spec.ts:69`). They change with this task |

## 2. Where to check

| Option | For | Against |
|---|---|---|
| **(a) The guard resolves the provider with the controllers' own function and checks it** | One change fixes the chat route, Agent mode, the public route and the driver page. Refusal is early: before credit, quota and idempotency guards and before any write. The Team path already calls the guard with the job's provider in the body (`orchestration.service.ts:1888-1892`), so it stays consistent | The guard must treat the body as untrusted (handled below) |
| (b) Each controller checks after it resolves | Uses the already resolved value | Two controllers to change and keep in step; the refusal comes after every other guard has counted the request; a future route can forget it |
| (c) Both | Defence in depth | The second check can never fire when the guard uses the same resolver; more code and tests for no gain |
| (d) A check inside `QueueService.enqueueExecution` | One choke point for all three queue writes | It runs after the ledger intent is written (`ai-execution.controller.ts:909`, `:936`), so a refusal leaves a row behind and reaches the user as a queue failure |
| (e) A check in the AI service worker | Covers the canary scripts too | The AI service has no switch today (1.1); it needs new env lines on a second service; the run is already queued, so the user gets a failed run, not a refusal |

**Chosen: (a).**

1. **Shared resolver.** The provider half of `resolveGatewayProviderModelSelection` (catalogue `:142-161`) moves into one exported function in the same file, for example `resolveGatewayProvider({ provider, fallbackProviderEnv })`. It returns one of the six ids or throws the existing `unsupported_provider` error. `resolveGatewayProviderModelSelection` calls it, so the guard and the controllers cannot drift. Its results do not change.
2. **Guard.** After the global switch check, the guard calls the shared resolver with `body.provider` and `AI_PROVIDER`.
   - A supported id: `isProviderEnabled(id)`; off → 503 `Provider <id> temporarily unavailable`, before the credit cap and the rate limits, as today.
   - An unsupported provider: the guard answers the same 400 and the same message the controller gives today. Fail closed: the guard does not rely on a later check. The only difference is the order: such a request now gets its 400 before the later guards (credit, quota, idempotency) instead of after them.
   - No provider, or a non-string: the fallback, exactly as the controller resolves it.
3. **The `AI_PROVIDER` check is replaced, not kept beside the new one.** The switch that matters is the one for the provider that will run. Keeping both would refuse an enabled provider because a different one is off (question 1 names this).
4. **The rate-limit counter keeps today's value** (`AI_PROVIDER`, guard `:45`), under its own variable name. No limit changes in this task (question 3).
5. **Controllers:** no change to `execute` in either controller.

Edge, development only: with a misspelt `AI_PROVIDER` the guard today refuses every request (unknown id, `kill-switch.config.ts:80-82`); after the change a request that names no provider resolves to stub, as the controller already does. Staging cannot start in that state (`provider.validator.ts:142-150`).

## 3. `GET /api/ai/providers`: key and switch

Keith chose key-only for PROVIDER-KEY-01 because the chat route did not enforce the switch (`docs/PROVIDER-KEY-01-CHECKPOINT.md:20`; `docs/PROVIDER-KEY-01-STAGE-START.md:262`). This task removes that reason. If the picker kept offering a provider whose switch is off, choosing it would give an untranslated 503.

**Recommended: in this task, `usable` = the AI service has a key AND the gateway's switch for that provider is on.**

- The gateway applies the switch to the AI service's answer when it replies (GW `ai/ai-execution.controller.ts:1189-1212`), through a small pure function in GW `ai/provider-availability.ts`. The 60-second cache still holds only the AI service's answer.
- Contract C4's shape and order do not change (`provider-availability.ts:13-24`). Only the meaning of `usable` narrows. The frontend needs no change: it already hides providers that are not usable and shows the empty state when none is (`docs/PROVIDER-KEY-01-CHECKPOINT.md`, slice 3B).
- The AI service route (C3) does not change: it still reports keys only.
- `GLOBAL_EXECUTION_ENABLED` stays out of `usable`, as before.
- **Staging picker afterwards:** the same as today, "No provider available", Send disabled. Today that is because no provider has a key; afterwards a provider needs both a key in the AI service env and its switch on in the gateway env to appear.
- The empty-state notice says "Ask an admin to add a provider key" (`FE/messages/en.json:482`). With a key present and the switch off that sentence is slightly off. Not changed here (follow-up 5).

With this, a browser user reaches the 503 only from a page loaded before a gateway restart changed a switch. So no translated message is needed in this task (follow-up 4).

## 4. Slice

One slice, gateway only.

**Mutexes:** GATEWAY. No AI-SERVICE, FRONTEND, I18N, PACKAGE, ENV, MIGRATION.
**Model: opus.** It changes a guard (Model Routing: guards go to opus).
**Checklists:** EVERY, BACKEND. UI does not apply (no frontend file).
**Shared contracts:** C4's shape is unchanged; the narrowed meaning of `usable` is approved with this document.

Write set (exact):

| File | Change |
|---|---|
| `services/api-gateway/src/ai/provider-model.catalogue.ts` | Export the shared provider resolver; `resolveGatewayProviderModelSelection` calls it |
| `services/api-gateway/src/ai/provider-model.catalogue.spec.ts` | Tests |
| `services/api-gateway/src/safety/execution-safety.guard.ts` | Section 2, points 2 to 4 |
| `services/api-gateway/src/safety/execution-safety.guard.spec.ts` | New tests; the tests and comments that state "body.provider is ignored" (`:69`, `:178-193`, `:386-400`) are rewritten for the switch. The rate-limit assertions keep `AI_PROVIDER` |
| `services/api-gateway/src/safety/execution-safety.integration.spec.ts` | HTTP tests for the refusal |
| `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | Only if an existing assertion there follows from the change (`:296-330` set a provider in the body and `AI_PROVIDER`) |
| `services/api-gateway/src/public-api/public-ai.controller.spec.ts` | One test that the public route refuses a switched-off provider |
| `services/api-gateway/src/ai/provider-availability.ts` | The pure "key and switch" function |
| `services/api-gateway/src/ai/__tests__/provider-availability.spec.ts` | Tests |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | `listProviders` only (`:1189-1212`) |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | The `GET /api/ai/providers` tests (`:4089` onward) |

Not in the write set: `kill-switch.config.ts`, both `execute` handlers, everything under `orchestration/`, the AI service, the frontend, the message files.

Six gateway test files use the real guard (`ai/__tests__/ai-execution-guards.integration.spec.ts`, `orchestration/collaboration-edit-prompt.spec.ts`, `orchestration/collaboration.controller.spec.ts`, `orchestration/internal-collaboration.controller.spec.ts` and the two safety specs). The bodies they send name only supported providers and the switches default to on, so they should pass unchanged. **Not verified: no test was run for this document.** If one outside the write set fails, the worker stops and reports (section 7).

## 5. Tests

The provider switches are read once at load, so tests switch a provider off by spying on `KillSwitchConfig.isProviderEnabled` (as the existing tests do), not by setting env values.

| Area | Tests |
|---|---|
| Resolver | Request provider wins over the fallback; no provider, an empty string and a non-string use the fallback; an unsupported fallback gives stub; an unsupported request provider throws the existing error and message; every existing `resolveGatewayProviderModelSelection` test passes unchanged |
| Guard, the gap | `AI_PROVIDER=stub`, body provider xai, xai off → 503 `Provider xai temporarily unavailable`; no credit-cap call, no rate-limit check, nothing recorded |
| Guard, allowed | Body provider xai, xai on → allowed even when the `AI_PROVIDER` provider's switch is off; body provider stub → always allowed; no body provider and `AI_PROVIDER=stub` → allowed |
| Guard, fallback | No body provider, `AI_PROVIDER=anthropic`, anthropic off → 503 (today's behaviour) |
| Guard, bad input | Unsupported provider → 400 with the controller's message; the text of the request never reaches `isProviderEnabled` or the rate-limit service; a number, an object, an array and null as provider use the fallback; an empty, null and missing body behave as today |
| Guard, order | The global switch is still checked first (runs off → the maintenance 503 whatever the provider); the provider switch before the credit cap and the limits |
| Guard, rate limit | `checkExecutionAllowed` and `recordExecution` still receive the `AI_PROVIDER` value; the two pinned integration tests (`execution-safety.integration.spec.ts:448-466`) pass unchanged |
| HTTP | `POST /ai/execute` with a switched-off provider and `AI_PROVIDER=stub` → 503, nothing queued; the same request with the switch on → 202; the public route refuses the same way |
| Team path | The existing switch tests pass unchanged (`orchestration/collaboration.controller.spec.ts:1980`, `:2339`, `:4383`; `orchestration/collaboration-workflow.spec.ts:374`) |
| Providers route | Key and switch on → usable; key and switch off → not usable; no key and switch on → not usable; shape and order unchanged; the cache holds the AI service's answer, and the switch is applied on each reply; 401 and 503 as before |
| Mutation check | Reverting the guard to `AI_PROVIDER` makes the gap test fail; removing the switch from `listProviders` makes its test fail |

## 6. Gates

| Gate | Baseline (`docs/PROVIDER-KEY-01-CHECKPOINT.md`, main at f5c3428) | Expected |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 4265 passed, 7 skipped, 14 known `smoke.integration` failures (they need a database) | More passed, 7 skipped, the same 14 and no other failure |
| api-gateway `npm run build` | rc 0 | rc 0 |
| ai-service `npx jest` | 1381 passed, 1 skipped | Not touched; the control plane may rerun it |
| frontend `npm test` | 1877 / 1877 | Not touched; the control plane may rerun it |

## 7. Worker stop conditions

Stop and report, without editing further, on any of:

- a need to change `kill-switch.config.ts`, another guard, the guard order on a route, auth, cookies, CSRF or the internal key;
- a need to change either `execute` handler, anything under `orchestration/`, the AI service, the frontend or a message file;
- a need to change the rate-limit counter or any limit value;
- a change to C4's shape or order, or to C3;
- a raw request value reaching a log line, an error message, `isProviderEnabled` or the rate-limit service;
- a failing test outside the write set, or a gate failure that is not one of the known 14;
- a new dependency or a file outside the write set;
- any env file read or env value printed.

## 8. Acceptance criteria

- [ ] Keith approves this document, the write set, the mutex and the answers in section 10 before Step 3
- [ ] On `POST /api/ai/execute` and `POST /api/v1/ai/execute`, a request naming a switched-off provider is refused with 503 `Provider <id> temporarily unavailable` whatever `AI_PROVIDER` is, before any credit check, ledger write or queue job
- [ ] A request naming a switched-on provider is allowed; stub is always allowed; a request naming no provider behaves as today
- [ ] An unsupported provider still gets 400 with today's message; no raw request text reaches a message, a log, the switch check or the rate-limit map
- [ ] The guard and both controllers resolve the provider through one shared function
- [ ] The global switch is still checked first; the rate-limit counter and every limit are unchanged
- [ ] `GET /api/ai/providers` answers `usable` only for a provider with a key and its switch on; shape, order, 401 and 503 unchanged (if question 2 is yes)
- [ ] The Team page path is unchanged and its tests pass untouched
- [ ] Tests in section 5 pass; gates match section 6
- [ ] The checkpoint carries the CHECKLIST line (EVERY, BACKEND; UI n/a, no frontend file), the model used and the FOLLOWUPS line
- [ ] Not LOCKED by an implementer

## 9. Live check (for a later deploy task)

Staging has runs off. The guard checks the global switch first (guard `:49-53`), so with runs off every request gets the maintenance 503 and **the provider refusal cannot be seen over HTTP**.

**Without turning runs on (from the host, a temporary API key, revoked at the end):**

1. The build carries the change: the shared resolver's name appears in the built guard file (`dist/safety/execution-safety.guard.js`), count 1 or more.
2. `POST /api/ai/execute` naming xai: 503 `AI execution temporarily disabled for maintenance` (unchanged; shows the global switch still answers first).
3. `GET /api/ai/providers`: 200, five entries, all `usable: false`. This agrees with the key counts (all 0) and the switches (all false), but it was already all false before this change, so it proves little on its own.
4. Health, guard and page checks as in the DEPLOY checklist; env file hashes at the baselines.

So on staging as it is, the evidence is the tests plus the build marker.

**In the next window that turns runs on** (a tester window or a live task; it holds ENV already), two extra steps from the host, spending nothing:

1. A run naming a provider whose switch is off: 503 `Provider <id> temporarily unavailable`; no new usage row; nothing in the queue.
2. `GET /api/ai/providers`: `usable: true` exactly for the providers with a key and the switch on; Keith's picker shows the same list.

Such a window must set `PROVIDER_<X>_ENABLED=true` in the gateway env for each provider it wants in the chat (as TESTER-WINDOW-01 did for Anthropic). ACCESS-01J-LIVE will need this for OpenAI and xAI.

## 10. Open questions for Keith

1. **Refuse chat runs for a switched-off provider, and check only the chosen provider's switch?** Recommended: yes. It is what the switch says it does and what the Team page does. Effect: with every switch false, a window that turns runs on must also switch on each provider it wants; a provider with a key but its switch off no longer runs from the chat or the public API. One case becomes allowed that is refused today: the request names an enabled provider while `AI_PROVIDER` names a disabled one. Alternative: keep the `AI_PROVIDER` check as well (stricter, but it refuses a provider that is switched on).
2. **Should `usable` in `GET /api/ai/providers` also need the switch, in this task?** Recommended: yes (section 3; about ten lines and their tests, no frontend change). The staging picker looks the same as today. Alternative: leave it key-only; then a provider with a key and its switch off is offered and gives an English 503 when chosen.
3. **Move the per-provider rate-limit counter to the chosen provider too?** Recommended: not in this task. It changes effective limits (with `AI_PROVIDER=stub`, from the default 1,000 a minute to each provider's own, 3,000 to 10,000) and rewrites two pinned tests. Named as follow-up 3. Alternative: include it here.

## 11. Follow-ups named here (for the control plane to dispose)

1. **Deploy task** for this change (STAGING, ENV held; no migration, no env change), with the first list in section 9.
2. **Run-window live check:** the two steps in section 9, carried by the next task that turns runs on.
3. **Rate-limit counter:** the guard counts chat runs under `AI_PROVIDER`, not the chosen provider (section 1.4).
4. **Translated refusals in the chat:** the two kill-switch 503 messages are shown in English as the server sends them (section 1.5). They are synchronous refusals, not stored run errors, so CHAT-FAILURE-REASONS-01 as registered does not cover them; widen it or add a task.
5. **Empty-state wording:** "Ask an admin to add a provider key" is slightly off when a key exists and the switch is off (`FE/messages/en.json:482`).
6. **Driver page** sends `provider: 'xai'` fixed (`FE/app/[locale]/driver/page.tsx:259`); with xai off it will get the 503.
7. **No switch in the AI service:** the canary scripts and eval CLIs do not pass the gateway (section 1.1 row 11). By design for operator tools; a worker-side switch would be the place if that ever changes.
8. **ARCHITECTURE.md** names only the global switch. A short note on the per-provider switches and the meaning of `usable` could join GOV-ARCH-PKEY-01.
9. **`createAndStartReferral`** appears to have no caller (section 1.1). If confirmed, it is dead code that starts a run without `assertHandoffAllowed`.

## 12. Checklist (Step 2)

CHECKLIST: EVERY 11/11 — 1 met (admitted on the board, Lane 1, write set this file: TASKS.md `lane1.taskId` and the PROVIDER-SWITCH-01 entry); 2 met (4-step, this is Step 2); 3 met (Fable, named in the brief); 4 met (self-contained brief, boot sequence followed, no subagent started); 5 met (one file, no dependency); 6 n/a (a document, no behaviour change); 7 n/a (no code, no gates run); 8 met (nothing started; read-only commands only; no env file read); 9 met (no build ran); 10 met (one commit on the lane branch only; no push, merge or branch change); 11 met (nine follow-ups listed in section 11).
