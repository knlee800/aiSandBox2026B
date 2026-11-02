# HARNESS-LIVE-05 — Checkpoint

**Task:** HARNESS-LIVE-05 — Use Agent mode in the real Builder screen on ainow-staging-01
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Stage-start:** docs/HARNESS-LIVE-05-STAGE-START.md. **Deployed:** 0838a5f47947ddc4ff884f66d999489501ea1294.
**Who ran it:** the control plane ran the deploy, evidence and flags-off blocks over SSH. Keith made the key, typed it at the hidden prompt, reset the files and used the screen.

## Runs

| Run | Execution | Mode | Tool calls | Tokens | Credits | Save points |
|---|---|---|---|---|---|---|
| 1 | 5fddc78d | Agent, question | 3 read_file, 1 run_validation | 5,750 | 6 | none |
| 2 | ad23b1f3 | Agent, change | 4 read_file, 2 write_file, 1 run_validation | 7,179 | 8 | 04a665bd before, e76acfff after |
| 3 | b56e73af | Ask | n/a | 727 | 1 | none |
| 4 | ad3aa53c | Build | n/a | 474 | 1 | beb00859 |
| 5 | 0396f305 | Agent, Keith's extra run | 5 read_file, 2 write_file, 1 run_validation | 11,050 | 12 | d209f622 before, cdfd609c after |

Revert: the ledger shows a return to 04a665bd at 06:37:47 UTC.

## Acceptance criteria

| Criterion | Result |
|---|---|
| The Agent button shows for Keith, and steps appear while a real run works | Met: Keith reported all steps worked. The journal does not record the on-screen list |
| A read-only question gets a correct answer | Met by run 1 on Keith's report; no files changed |
| A change with a test run works, and the workspace updates without a manual refresh | Met by run 2 on Keith's report; the after-run save point e76acfff is in the ledger |
| Reverting from the screen restores the files | Met: Keith reported it; the ledger shows the return to 04a665bd |
| The guard still refuses with no key, and Ask and Build still work | Met: 8 requests 401 after the deploy; runs 3 and 4 completed |
| Credits and usage correct, model non-empty | Met: 5 usage rows, all claude-opus-5-5; balance 429 to 401, matching tokens |
| Spend within the caps | Met by upper bound: 25,180 tokens is at most about $0.50 even if all were output tokens, under the $1 soft cap. Keith gave no cost figure for this key |
| Flags off, key removed, configuration hashes match | Met: flags off at 06:42:52 UTC, saved files restored and hash-checked by the block; Keith confirmed the key deleted |
| Keith reads the transcripts and records his judgement | Met: Keith recorded "judgement ok" on 2026-11-02 |
| Not LOCKED by an implementer | Met: locked by the control plane |

## Findings

- The model ran npm test to check its answer to a plain question. It changes no files, but it costs time and a tool call in a real project.
- Keith raised UI problems such as overlapping buttons and asked whether they can wait. The answer given: general polish waits, anything that blocks using Agent is fixed sooner. He has not listed them yet, so none is recorded or registered here.

## Not proven

- Other providers and real projects; the run token budget stopping a real run; a refusal for a real execution owned by another user.
- Agent stays gated, for allowlisted users on staging only; this does not make it CURRENT. Charging is not settled.

## Evidence

In `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-05/`. No key or secret value is recorded.

| File | Bytes | SHA-256 |
|---|---|---|
| `hl07-deploy.out` | 4284 | `970e5970d7eb464b245000f42300e46b694b37dd2b56820d4d36e9d60b2a3ce3` |
| `hl07-evidence.out` | 38700 | `5bd3188b2eef529cf030ba849daf5d2ef44ebd55b81d79bc16f753f59af909f9` |
| `hl07-flags-off.out` | 555 | `784c6976b21696dedb65c8a31e50c5995302bcf6113efd68ce5f99b7d4823201` |

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false; GOVERNANCE UNOWNED.
