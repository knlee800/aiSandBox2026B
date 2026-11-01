# HARNESS-LIVE-01 — Checkpoint

**Task:** HARNESS-LIVE-01 — Prove the harness with a real model, read-only, on ainow-staging-01
**Status:** COMPLETE AND LOCKED — 2026-11-01
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Stage-start:** docs/HARNESS-LIVE-01-STAGE-START.md.

## Runs

| Run | Execution | Steps | Result | Tokens | Credits |
|---|---|---|---|---|---|
| 1 | a95fbe66 | list_files | completed, correct | 1871 | 2 |
| 2 | cc4807d7 | read_file | completed, Tuesday | 1724 | 2 |
| 3 | 4a73f68e | not recorded | failed on the 3-step limit, which its three-file clue could not fit | none | 0 |
| 4 | 40701ad6 | list_files, read_file, answer (3 model calls) | completed, Tuesday, correct file list | 2947 | 3 |
| 5 | 07036191 | failed on the first model call, no tools | `Malformed Anthropic response: missing content` | none | 0 |
| 6 | not sent | n/a | the stage-start stops the window when run 4 or 5 fails | n/a | n/a |

## Run 5

The adapter throws when the response content is empty, before reading `stop_reason`, so the reason was not recorded. A provider safety refusal before any output returns exactly this shape and is the most likely cause, but it is not confirmed. Run 3 used similar wording and passed its first step, so wording alone does not explain it. Keith approved a separate fix.

## Acceptance criteria

| Criterion | Result |
|---|---|
| Real run calls list_files and read_file across several steps and answers correctly | Met by run 4 |
| No workspace file changes | Met: `WORKSPACE UNCHANGED files=5` after both windows; 0 checkpoints in the second |
| Credits and usage correct, usage_records.model non-empty | Met: every second-window row shows claude-opus-5-5; balance 497 to 493 to 490; failed runs uncharged. Closes the USAGE-MODEL-01 provider criterion |
| Spend within the caps | Met: second-window key $0.03, read by Keith from the Anthropic usage page. The first-window figure was not reported; its token counts and the 16,000-token limit keep it under the $2 hard cap |
| Flags off, key removed, configuration hashes match | Met: flags off at 07:43 UTC and 12:02:31 UTC, saved files restored and hash-checked by the block; Keith confirmed the second key deleted |
| Keith reads the transcripts and records his judgement | Met: Keith read the run 4 transcript on 2026-11-01 and accepted it as proof of multi-step on a real model |
| Not LOCKED by an implementer | Met: locked by the control plane |

## HARNESS-FAIL-RECORD-01 on the server

Partly proven. Deployed 4e69b66a4c4528fa8c928d84c276c1dfc47235c5 at 11:42:30 UTC. Failed run 5 kept its model on the usage row and its failed step in the journal, on real PostgreSQL. It reported no tokens, so the token write and the step-limit path were not exercised on the server; unit tests still cover them.

## Not proven

- Following a clue across two files: run 5 was meant to show it.
- Whether the 3-step limit suits real work: run 4 used all 3 model calls.
- Real writes, validation and other providers.

## Evidence

In `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-01/`. No key or secret value is recorded.

| File | Bytes | SHA-256 |
|---|---|---|
| `hl01-deploy.out` | 7584 | `04186db6eb4ca0bbb26a85c64c444b5c71e04f9393c1407687d7741addd81a56` |
| `hl01-evidence.out` | 24318 | `fe1142d0db7f7dae7ca0488d988c57649b202a5b6af41ff83e57f7e299742e8d` |
| `hl01-flags-off.out` | 1064 | `077f4c59012ad80e7d55caabac5fc9f24c5aa2596cab3080e266f03eaf3c8846` |
| `hl02-deploy.out` | 7610 | `867500330c9c6342669622c09b8c24687fe71924deedcde467ec92e8d200999f` |
| `hl02-evidence.out` | 20758 | `6849e9fd7aa4aa951220765ee7f57ea4870c0db7de178061d6dc92577d9946d2` |
| `hl02-flags-off.out` | 1142 | `40dd5f87aa9fe5ee5e8f096e9f7b7a0f70828c597bea9140cf1a3b6214472489` |

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-01 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false; GOVERNANCE UNOWNED.
