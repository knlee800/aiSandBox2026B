# HARNESS-PROVIDERS-01 — Checkpoint

**Task:** HARNESS-PROVIDERS-01 — Bring xAI, OpenAI, Anthropic and DeepSeek to current models and working harness tool use
**Status:** COMPLETE AND LOCKED — 2026-11-01
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Limits:** all provider tests are mocked. No real provider call was made. Provider behaviour, including the GPT-6 request parameters, stays unproven until HARNESS-LIVE-01. Not deployed.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Keith's approval, 2026-11-01 | 2322b6346faaff48f9b4bd17be8bb9db1db4b6a3, a92ac99d2233159075bef9d4067740624a1b97a6 |
| 2. Stage-start | docs/HARNESS-PROVIDERS-01-STAGE-START.md | ab255a4e916bb640268266823194313f6bbabe1d |
| Scope changes | I18N and the message files; the phase30c spec | 7cac9175d8eac2d90f92fad2214aff3e98844c80, 05e4461ddb6b081c4b3969e5bba58fe84f65b090 |
| 3. Implementation | Cursor CLI, grok-4.7-high, four slices | e6060033d23283af6b7f1035ca27c52fd837e454, aef5756bfe9563d3eec7281857456313c1f1226e, b6fecf3af29b9d9796ca0577e247c577b9b412ce, 4463f6080bf642fd328d65230093ff11cbb653b2 |
| 4. Consolidation and LOCK | this checkpoint, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| Slice | Change |
|---|---|
| 1 | Optional opaque `providerState` carried unchanged by the harness loop. Anthropic: raw content blocks including thinking returned verbatim, `max_tokens` 16,000 on plain and tool paths, `temperature` removed |
| 2 | OpenAI and xAI tool calls on one Responses path with `previous_response_id`, `store: true` and `strict: false` tools. GPT-6 plain requests use `max_completion_tokens` with no `temperature`, by assumption; `gpt-4o` and xAI plain requests unchanged |
| 3 | DeepSeek tool use on Chat Completions with `reasoning_content` sent back; plain path unchanged |
| 4 | xAI grok-4.7; OpenAI gpt-6.1-sol, gpt-6-astra, gpt-6.1-terra, gpt-6-luna; DeepSeek deepseek-flash as default, with deepseek-v4-flash hidden in the Builder and still accepted by the server; Anthropic list of four models with `ANTHROPIC_MODEL` as the default when no model is requested; `supportsToolUse` true for all four in the AI service catalogue; labels in all three message files |

## Validation (reviewer, Node v22.14.0)

| Gate | Result | Baseline |
|---|---|---|
| ai-service tests | 38/38 suites; 970 passed, 1 skipped | 912 passed, 1 skipped |
| ai-service build | exit 0 | exit 0 |
| gateway tests | 2333 passed; only the 14 runtime-only smoke failures | 2320 passed; same 14 |
| gateway build | exit 0 | exit 0 |
| frontend tsc, build | exit 0 | exit 0 |
| frontend npm test | 789/789 | 789/789 |
| frontend catalogue tests, run separately | 23/23 | not covered by npm test |

Gateway and frontend gates ran before the second scope change; only AI service spec files changed after them, and the AI service gates were rerun.

Evidence copied to `C:\Users\knlee\aisb-preflight\HARNESS-PROVIDERS-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 218825 | `f8690242d05ef1f581a8dade0be35c3726c99661c12a94dcc96321c9d94d2653` |
| `reviewer-ai-build.txt` | 44 | `c1a6ccccb476844eadd90f48f36228aa54578d4f92baf0b42d6896e3d0c24fb7` |
| `reviewer-gateway-test.txt` | 265054 | `6bd5583e3b96caee436b9218061dd1e476cbd836563583d15b811c9fb6535e0d` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `reviewer-frontend-test.txt` | 170147 | `1407aa48b2499275b064ae0fbeda3881e84b81fd9c9da1f3a385a9c162559aa6` |
| `reviewer-frontend-catalogue-test.txt` | 4562 | `ea0ffd0e9d2a0c7aa9676576b8eb90c8a44c3abc144cd3f475a3629a41dd4ef6` |
| `reviewer-frontend-build.txt` | 2856 | `ed58581cf90faa19a525d2db035e5d8565611799c7673e7882bf6b0983a00a5e` |
| `reviewer-ai-test-baseline.txt` | 205089 | `66d14ed09afb7cb8e5251b8bb2092007c164601c896576e4f5f749f7e95ad84f` |
| `reviewer-gateway-test-baseline.txt` | 262788 | `c622f16ed330991f33cb7cc0f28628000e49069b7a1ba2d470e622ab89dddfec` |
| `reviewer-frontend-test-baseline.txt` | 170167 | `52aa770c9c770fe3be7281208bac4cd1aaee912c3c791b25f1dc454b69256cfa` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| Catalogues list the models, including the additions and the DeepSeek rename, with `supportsToolUse` true for all four | met. `supportsToolUse` exists only in the AI service catalogue. Anthropic resolution follows the recorded scope change |
| Anthropic mocked tool-loop tests: thinking blocks unchanged, higher limit, no temperature | met |
| xAI and DeepSeek declare and implement tool use, with mocked tests | met |
| OpenAI API decision recorded with its source; mocked tool-loop tests on the chosen API | met |
| Plain single-shot path keeps working, shown by existing tests | met, mocked |
| Tests and builds match baselines apart from new tests | met; 8 DeepSeek expected values updated for the approved default |
| Only files in the write scope change | met, after two recorded scope changes |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- Not deployed: ainow-staging-01 runs 1b5892e7e9306c522b68e5e80b08673888ef98a4. HARNESS-LIVE-01 depends on a separately authorized deploy.
- Provider behaviour unproven: GPT-6 parameters, xAI tool calls, and Anthropic and DeepSeek reasoning round trips run against mocks only.
- `previous_response_id` leaves the conversation with OpenAI and xAI; revisit before any other user's code goes through the platform.
- Credits do not vary by model, and all listed models are selectable in the Builder. This must be fixed before anyone else has access.
- Possible follow-ups, not registered: `npm test` does not cover `frontend/lib/ai/*.test.ts`; xAI tool failures use OpenAI error wording in the shared helper; GPT-6 plain output limit stays 4096; a malformed tool call the loop does not answer may be rejected on the next step.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-01 by the control plane. Lane 1 released EMPTY; AI-SERVICE, GATEWAY, FRONTEND, PACKAGE and I18N released UNOWNED; GOVERNANCE UNOWNED.
