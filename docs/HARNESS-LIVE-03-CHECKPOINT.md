# HARNESS-LIVE-03 — Checkpoint

**Task:** HARNESS-LIVE-03 — Prove the raised step limit and last-call notice with a real model on ainow-staging-01
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Stage-start:** docs/HARNESS-LIVE-03-STAGE-START.md. **Deployed:** 4c6d606ebf62f3f190ad7af7eacdb133b39f4ef8.

## Runs

| Run | Execution | Task | Model calls (limit 8) | Tool calls | Tokens (budget 60,000) | Credits | Result |
|---|---|---|---|---|---|---|---|
| 1 | 04f38899 | Fix the failing test | 6 | 9 | 13,139 | 14 | Completed; fixed greet.js and calc.js and reported the test passing |
| 2 | 58e20f36 | Fix every bug, add slug.js with tests | 5 | 16 | 14,871 | 15 | Completed; fixed tax.js and price.js, added slug.js and 9 checks, and reported the test passing |
| 3 | f9f66af0 | Ten files, one tool call per reply | 8 | 7 | 11,248 | 12 | Completed; wrote step-1 to step-7, called no tool on call 8, and listed the 3 files not written |

The reviewer rebuilt the final files from the browser output and ran test.js locally: it printed ok. test.js, slug.js, price.js and tax.js match the server hashes exactly; greet.js and calc.js were compared by content.

## Acceptance criteria

| Criterion | Result |
|---|---|
| A real run that could not fit before completes with a correct answer within the limit | Met by run 1: 6 model calls against the old limit of 3 |
| A bigger real run shows the calls and tokens it uses, within the budget or stopped by it | Met by run 2: 5 model calls, 16 tool calls, 14,871 tokens, within the budget |
| A real run that reaches the last-call notice answers with what is done and unfinished, and no tool runs after the notice | Met by run 3: the journal shows no tool call on call 8, the answer lists both groups, and the files match it. step-8 to step-10 do not exist |
| Credits and usage correct, model non-empty | Met: 3 usage rows, all claude-opus-5-5; balance 476 to 462 to 447 to 435 |
| Spend within the caps | Met by upper bound: 39,258 tokens is at most about $0.79 even if all were output tokens, under the $1 soft cap. Keith reports the cost is too small to show on the Anthropic usage page |
| Flags off, key removed, configuration hashes match | Met: flags off at 02:18:43 UTC, saved files restored and hash-checked by the block; Keith confirmed the key deleted |
| Keith reads the transcripts and records his judgement | Met: Keith read the run transcripts on 2026-11-02 and recorded "Judgement ok" |
| Not LOCKED by an implementer | Met: locked by the control plane |

## Findings for the usable-harness work

- The model batches tool calls and the limit counts model calls, so run 2 fitted 16 tools into 5 calls. Run 3 reached the limit only because it was told not to batch.
- The largest run used about a quarter of the 60,000-token budget.
- The journal records neither tool results nor the notice, so test passes during the runs rest on the model's answers, supported by the local re-run of the final files.
- Reading a missing file through the session files API returns 500, not 404.

## Not proven

- The run token budget stopping a real run, and the block on tools after the notice: the budget was not reached and the model obeyed the notice, so both have mock-test proof only.
- Other providers, real projects, and tests that take longer than seconds.
- Harness writes stay gated and on staging only; this does not make them CURRENT.

## Evidence

In `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-03/`. No key or secret value is recorded.

| File | Bytes | SHA-256 |
|---|---|---|
| `hl05-deploy.out` | 7610 | `6c98829919e7af911b79c8bc6d0ed301d4922b82fa809facaac926a2ac6cf2ef` |
| `hl05-evidence.out` | 105770 | `edb339a38c835458cf7078232d2840e3bcfb87053d6632cb6cd6549799646a47` |
| `hl05-flags-off.out` | 1142 | `7d3507792effd4ef0600c31a743d2a4821a74da4531853aca073b826f87328bb` |

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false; GOVERNANCE UNOWNED.
