# HARNESS-LIVE-02 — Checkpoint

**Task:** HARNESS-LIVE-02 — Prove harness writes and validation with a real model on ainow-staging-01
**Status:** COMPLETE AND LOCKED — 2026-11-01
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Stage-start:** docs/HARNESS-LIVE-02-STAGE-START.md.

## Runs

| Window | Run | Execution | Steps | Result | Tokens | Credits |
|---|---|---|---|---|---|---|
| 1 | 1 to 3 | 858853d1, b47e14c9, d11beaf1 | read tools only | completed; a hard-coded list withheld write and validation tools, so nothing was written; fixed by HARNESS-WRITE-TOOLS-01 | 1925, 1065, 3922 | 2, 2, 4 |
| 2 | 1 | b2e0bc7e | write_file | completed, file correct | 2046 | 3 |
| 2 | 2 | eaf03d13 | write_file and run_validation in one call | completed, npm test passed | 2464 | 3 |
| 2 | 3 | dedbc9b8 | list_files and run_validation; 3 read_file; write_file and run_validation | failed on the 3-call limit before answering; the fix was applied | 4833 | 0 |

## Revert

Keith reverted to the newest save point in the browser. calc.js returned to the buggy version, with the same SHA-256 as before run 3 (`eed1db29`). hello-note.txt and greet.js kept their changes, because runs 1 and 2 finished before that save point. Ledger rows: 07407001, ca766117, cb3e8515 and the revert row.

## Acceptance criteria

| Criterion | Result |
|---|---|
| A real run writes a file through write_file, with a save point first | Met by second-window run 1 |
| A real run writes and runs npm test through run_validation, and reports correctly | Met by second-window run 2 |
| Reverting to a save point restores the files | Met: byte-identical by hash |
| Credits and usage correct, model non-empty | Met: all rows show claude-opus-5-5; balance 490 to 482 to 476; the failed run stayed uncharged |
| Spend within the caps | Met by upper bound: 16,255 tokens across both windows is at most about $0.33 even if all were output tokens. Keith read 0 on the Anthropic usage page for both keys; that page may lag, so 0 is not treated as final |
| Flags off, key removed, configuration hashes match | Met: flags off at 13:53:48 and 14:58:42 UTC, saved files restored and hash-checked by the block; Keith confirmed both keys deleted |
| Keith reads the transcripts and records his judgement | Met: Keith read the run transcripts on 2026-11-01 and accepted them as proof of real harness writes, validation and save-point revert |
| Not LOCKED by an implementer | Met: locked by the control plane |

## HARNESS-FAIL-RECORD-01 on the server

Now fully proven: failed run 3 kept its tokens (4833), model and steps, including harness.loop_max_turns, on real PostgreSQL.

## Findings for the usable-harness work

- A run can finish its work on the third model call and still fail on the limit: the user sees failed with no answer although a file changed, and the run is not charged.
- The journal does not record what a tool returned, so run 3's final test result is not known.
- The 30-second tool timeout also caps run_validation; the 120-second validation timeout does not take effect.
- The model batches tool calls: the limit counts model calls, not tools.

## Not proven

- Other providers, real projects, and tests that take longer than seconds.
- Harness writes stay gated and on staging only; this does not make them CURRENT.
- The cause of the HARNESS-LIVE-01 run 5 failure stays unconfirmed; no refusal occurred here.

## Evidence

In `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-02/`. No key or secret value is recorded.

| File | Bytes | SHA-256 |
|---|---|---|
| `hl03-deploy.out` | 7610 | `08d9182a1bf5afd4f5bda0db1145f813d5d0b200d640252b122a87fb9c4fa453` |
| `hl03-evidence.out` | 39394 | `0d2bd303b9d6806a0e5158099bcd8194151564167fde895cd0b5895360dc0b42` |
| `hl03-flags-off.out` | 1142 | `3d67e2d736e37ea45d55bfb73b8cf9bcac6896f3df80a2d3481521ee0634bdfa` |
| `hl04-deploy.out` | 7610 | `d518dca184406b253957053479ffc4a337349e6bd0eb01a3fb7b669f825a5912` |
| `hl04-evidence.out` | 55162 | `0d9ba292f905eaf915a4d5bd45f706ceaaffdcebc9a264fc79556c1746c4e23f` |
| `hl04-flags-off.out` | 1142 | `9d75d815cfe802986e53c988db9e733387d2f801eae9cd114b80f82b0b23033d` |

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-01 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false; GOVERNANCE UNOWNED.
