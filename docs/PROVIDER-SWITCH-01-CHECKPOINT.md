# PROVIDER-SWITCH-01 — Checkpoint

**Task:** PROVIDER-SWITCH-01 — Check the chosen provider switch on the chat route
**Status:** COMPLETE AND LOCKED — 2026-11-13. Not deployed: STAGING-DEPLOY-PSWITCH-01.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the PROVIDER-KEY-01 LOCK. Keith asked to start it ("Start PROVIDER-SWITCH-01") and approved the stage-start ("Yes, approve all three").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex, write set the stage-start document | 377b968 |
| 2. Stage-start | docs/PROVIDER-SWITCH-01-STAGE-START.md, fable subagent (Fable 5.2), fast-forwarded; facts checked against the code by the control plane | aa64e0d, b1c382f, ab0488f |
| 3. Implementation | GATEWAY; 11 files; opus subagent, fast-forwarded | cd2d18b, 401b2fd |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Keith's decisions (2026-11-13)

1. The guard checks only the chosen provider's switch, on the chat route and on POST /api/v1/ai/execute.
2. `usable` in GET /api/ai/providers needs both a key and the switch.
3. The rate-limit counter stays keyed on `AI_PROVIDER` (a follow-up).

## What changed (services/api-gateway/src)

- **`ai/provider-model.catalogue.ts`:** a new exported `resolveGatewayProvider`, the provider half of `resolveGatewayProviderModelSelection`, which now calls it. Both execute controllers and the guard therefore decide the provider the same way:
  - a non-empty request provider wins;
  - otherwise a supported `AI_PROVIDER`;
  - otherwise stub;
  - an unknown name throws `unsupported_provider`.
- **`safety/execution-safety.guard.ts`:**
  - **Order:** the global switch is checked first, as before. Then the guard resolves the request's provider and checks `KillSwitchConfig.isProviderEnabled` for that catalogue id.
  - **Switch off:** 503 `Provider <id> temporarily unavailable`, before the credit cap, any write or any queue job.
  - **Unsupported provider:** the controllers' existing 400 is now given by the guard. No switch or limit call is made, and nothing is written or logged.
  - **Rate limit:** the counter still uses `AI_PROVIDER`.
  - **Errors:** HTTP errors pass through `mapSafetyError` unchanged.
- **`ai/provider-availability.ts`:** `applyProviderSwitches` makes a provider usable only with a key and its switch on. `listProviders` in `ai/ai-execution.controller.ts` applies it on each reply, and the 60-second cache keeps only the AI service's answer. Nothing else in the controller changed, and HARNESS_ENTITLEMENT_PROOF_V1 is untouched.
- **Tests:**
  - the guard spec's tests and comments that pinned "body.provider is ignored" were rewritten, and 13 tests added;
  - HTTP tests on both execute routes: off gives 503 with nothing written or queued, on gives 202, unsupported gives 400;
  - resolver parity with the controllers;
  - key and switch combinations for the picker, and a cache test with the switch flipped between calls;
  - one existing assertion in `ai-execution-guards.integration.spec.ts` follows from the change: an unknown provider is now in the body and gets 400.

## Control-plane review

- **Read:** the full diff of the guard, the resolver, `applyProviderSwitches` and `listProviders`.
- **The switch check** only ever receives a catalogue id, never raw request text.
- **The 400 text:** the 400 message carries the trimmed request name, which is exactly the message the controllers already sent. This is accepted as existing behaviour.
- **AI_PROVIDER case:** `AI_PROVIDER` used to be lower-cased for the switch check. It is now resolved with its case kept, as the controllers do. A mixed-case `AI_PROVIDER` with no request provider falls back to stub instead of being refused, and a staging gateway already refuses to start in that state.
- **Out of scope by design:** the AI service has no per-provider switch, and the canary and eval command-line tools do not go through the gateway; that is intended for operator tools.
- **Mutation checks:** the worker ran 5, each making 2 to 11 tests fail: the old AI_PROVIDER check, a skipped switch, the picker ignoring the switch, an unsupported provider passing, and the rate limit on the chosen provider.

| Gate (control-plane rerun) | Baseline | On the branch | On main at 401b2fd |
|---|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 4265 passed, 7 skipped, the 14 known smoke.integration failures | 4294 passed, 7 skipped, the same 14 | 4294 passed, 7 skipped, the same 14 |
| api-gateway `npm run build` | rc 0 | rc 0 | rc 0 |

The AI service and the frontend are untouched. The 14 failures are the database-dependent smoke suites. All 11 files are LF. The worktree and branch were removed after the junctions were unlinked.

## Not proven here (live)

On staging `GLOBAL_EXECUTION_ENABLED=false` answers first, so the provider refusal cannot be seen over HTTP there. The deploy (STAGING-DEPLOY-PSWITCH-01) checks the build and the picker answer. The run window of ACCESS-01J-LIVE checks the refusal live and must switch on each provider it uses: every `PROVIDER_*_ENABLED` is false on staging, and the switches are read when the gateway starts.

## Follow-ups

- **Registered (NOT_READY; OPTIONAL by control-plane default):** STAGING-DEPLOY-PSWITCH-01; RATE-LIMIT-PROVIDER-01 (Keith's question 3); ORCH-DEAD-01 (`createAndStartReferral` appears to have no caller).
- **Superseded:**
  - the run-window live check, by ACCESS-01J-LIVE (scope extended);
  - translated 503 refusals in the chat, by CHAT-FAILURE-REASONS-01 (scope extended);
  - the empty-state wording when a key exists but the switch is off, by PROVIDER-KEY-02 (item 4 added);
  - the driver page's fixed `xai`, by DRIVER-PAGE-01 (scope extended);
  - the ARCHITECTURE.md note, by GOV-ARCH-PKEY-01 (scope extended);
  - no switch in the AI service, by the note above (by design, no work);
  - the 400 message carrying the request name, by acceptance (the existing controller message);
  - the AI_PROVIDER case change, by the note above.

CHECKLIST: EVERY 11/11 (1: admitted 377b968 and cd2d18b; 2: 4-step with an approved stage-start; 3: fable for the stage-start, opus for the guard change; 4: self-contained briefs, no further subagents; 5: the 11 write-set files only, no dependency; 6: tests added and the pinned old tests rewritten; 7: gates rerun by the control plane on the branch and on main; 8: no runtime started; 9: build output ignored, status clean; 10: worktree and fast-forward by the control plane, worktree and branch removed; 11: FOLLOWUPS line), BACKEND 6/6 (1: only the approved provider-switch check changed; 2: no internal endpoint touched; 3: n/a, no generated-app template; 4: HARNESS_ENTITLEMENT_PROOF_V1 untouched, C4 shape unchanged with usable narrowed as approved; 5: no entity or schema change; 6: compared with the baseline, no new failure)
FOLLOWUPS: 3 registered (STAGING-DEPLOY-PSWITCH-01; RATE-LIMIT-PROVIDER-01; ORCH-DEAD-01) / 8 superseded (the run-window live check by ACCESS-01J-LIVE; translated 503 refusals by CHAT-FAILURE-REASONS-01; the empty-state wording by PROVIDER-KEY-02; the driver page's fixed xai by DRIVER-PAGE-01; the ARCHITECTURE.md note by GOV-ARCH-PKEY-01; no switch in the AI service by the note above; the 400 message carrying the request text by acceptance; the AI_PROVIDER case change by the note above) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-13 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY released UNOWNED;
- not deployed: staging still runs 6f6b8e8, with runs off.
