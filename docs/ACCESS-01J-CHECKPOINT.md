# ACCESS-01J — Checkpoint

**Task:** ACCESS-01J — Stateless OpenAI and xAI tool continuation (store: false)
**Status:** COMPLETE AND LOCKED — 2026-11-13. Not deployed. Not checked against the real APIs: that is ACCESS-01J-LIVE.
**Workstream:** COMMERCIAL. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutex:** AI-SERVICE. **saturationClass:** OPTIONAL.
**Source:** plan S10 option A (docs/ACCESS-READY-01-PLAN.md item 5), registered 2026-11-05 by GOV-ACCESS-PLAN-01. On 2026-11-13 (ACCESS-READY-01 Q4), Keith asked for it before the first outside user. Keith asked to start it ("Start ACCESS-01J").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with AI-SERVICE; the task body was written at admission (the plan row was its only record) | 2c0901b |
| 2. Implementation | opus subagent in worktree `lane/ACCESS-01J`; one review fix; fast-forwarded into main | d0a4bb5, 29a2b62 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## What changed

**Before:** the OpenAI and xAI adapters sent `store: true` on every Agent-mode (Responses API) call and continued a tool loop with `previous_response_id`, so the provider kept every response.

**Now** (`services/ai-service/src/ai-execution/adapters/`):

- **`adapter-tool-use.mapper.ts`**
  - **Replay:** `buildResponsesToolRequest` replays the whole conversation at every step: the user prompt, then for each earlier assistant turn the output items exactly as the provider returned them (function_call, message and reasoning items), then that turn's `function_call_output` items. `previous_response_id` is gone from the request type.
  - **providerState:** now `{ kind: 'responses', outputItems }`, a JSON copy of every output item. It stays opaque to the loop, and no response id is kept.
  - **Fails closed:** a continuation is refused with `RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE` and a short detail that names only turn and item indices, never content. That happens when:
    - providerState is missing, of another kind, or empty;
    - an item is not an object, has an unsupported type, or has bad key fields;
    - the turns do not alternate assistant and tool results;
    - the call ids differ from the turn's tool calls, or a call id repeats;
    - the results are not paired one to one with the calls.
  - **New exports:** `toResponsesSdkInput` (one commented, narrow type assertion for the provider's own output items) and `responsesStatelessIncludeFor(provider, model)`.
- **`openai-ai.adapter.ts` and `xai-ai.adapter.ts`:**
  - `store: false` on every request, and `previous_response_id` is never sent.
  - `include: ['reasoning.encrypted_content']` lets reasoning items be replayed. It is sent to every xAI model and to every OpenAI model except `gpt-4*`: `gpt-4o`, the default, is not a reasoning model and is expected to reject the field.
- **Unchanged:** Anthropic, DeepSeek, Groq and the stubs; the Chat Completions paths; the harness loop. The transcript stays in memory in the loop and is not persisted.
- **Tests** (the three spec files):
  - the old previous_response_id tests were replaced with mocked 3-step runs (two calls in one turn, a reasoning item and a message item) for both adapters, plus a 3-step run on gpt-4o;
  - 18 fail-closed cases in the mapper and malformed providerState cases in both adapters;
  - the include rule by provider and model;
  - an exact-keys check that no request carries the API key or an env sentinel value.

## Implementer and review

opus subagent (Opus 5.5; a provider request change that decides what the providers store), commits d0a4bb5 and 29a2b62.

The control plane read the full diff of the mapper and both adapters, and checked the removed and added test cases (5 old continuation tests removed, 23 added). It also checked that the harness loop pushes one assistant turn and then one tool-result turn per step and answers every call that has an id (`agent-harness-loop.ts`), so the strict alternation the mapper requires holds. It then sent back one fix: the first version sent `include` to `gpt-4o` as well (29a2b62).

Worker mutation checks: `store` back to true, `include` removed, reasoning items dropped, the pairing check disabled, only the latest turn replayed, and the gpt-4 rule removed. Each one made tests fail.

| Gate (rerun by the control plane) | Result |
|---|---|
| Baseline at 2c0901b, worker | 65 suites; 1297 passed, 1 skipped |
| `npx jest` in services/ai-service on the branch | 65 suites passed; 1331 passed, 1 skipped |
| `npx tsc --noEmit -p .` on the branch | rc 0 |
| `npm run build` on the branch | rc 0 |
| after the fast-forward, on main: `npx jest`, `npm run build` | 1331 passed, 1 skipped; build rc 0; status clean |

All six files are LF. Only the six write-set files changed. The worktree junctions were unlinked before the worktree and branch were removed; the main checkout's node_modules is intact.

## Not proven here

Mocks cannot show these; ACCESS-01J-LIVE checks them against the real APIs:
- whether OpenAI's gpt-6 models and xAI's grok-4 models accept `include: ['reasoning.encrypted_content']` with `store: false`;
- whether replayed output items with their provider ids are accepted with no "not found" error;
- whether gpt-4o really runs without `include`;
- whether xAI returns other output item types, which would now fail closed at the next step;
- reasoning quality and tokens per step under full replay.

Until ACCESS-01J-LIVE passes, the control plane recommends adding no OpenAI or xAI key for anyone but Keith. D3 named this task as its condition; the code is done, the live proof is not. Today staging has every provider switch off and no OpenAI or xAI Agent runs.

**Records:** docs/PRIVACY-DATA-INVENTORY.md (locked) rows 158 and 159 and question 21 describe `store: true` and `previous_response_id`. They stay true for staging until this change is deployed. That document is not edited; this checkpoint records the change.

## Follow-ups

- **Registered:** ACCESS-01J-LIVE: deploy this change, then a live check with real OpenAI and xAI keys that Keith adds himself (PROVIDER-LIVE, NOT_READY, Keith decides).
- **Superseded:**
  - the model-gated `include`, by commit 29a2b62 in this task;
  - the out-of-date inventory rows, by this checkpoint's record and ACCESS-01J-LIVE (deployment);
  - a function_call without a call_id now fails closed, which is acceptance item 4 by design, with no remainder.

CHECKLIST: EVERY 11/11 (1: admitted 2c0901b; 2: 3-step; 3: opus, provider storage behaviour; 4: self-contained brief, no further subagents; 5: six files inside the write set, no dependency; 6: tests added and updated; 7: gates rerun by the control plane on the branch and on main; 8: no runtime started; 9: dist and tsbuildinfo are gitignored, status clean; 10: worktree, fast-forward by the control plane, worktree and branch removed; 11: FOLLOWUPS line), BACKEND 6/6 (1: auth, cookies, CSRF, keys and guards unchanged; 2: no internal endpoint touched; 3: no generated-app template touched; 4: no frozen contract, providerState opaque; 5: no entity or schema change; 6: compared with the 2c0901b baseline, no new failure)
FOLLOWUPS: 1 registered (ACCESS-01J-LIVE) / 3 superseded (model-gated include by 29a2b62; inventory rows by this checkpoint and ACCESS-01J-LIVE; missing call_id by acceptance item 4) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-13 by the control plane:
- Lane 1 released EMPTY;
- AI-SERVICE released UNOWNED;
- not deployed: staging still runs aa0b32a, with every provider switch off.
