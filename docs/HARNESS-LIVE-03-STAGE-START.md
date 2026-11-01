# HARNESS-LIVE-03 — Stage-Start

**Task:** HARNESS-LIVE-03 (Lane 1; STAGING, PROVIDER-LIVE, CREDIT, ENV; PROVIDER-LIVE evidence).
**Deploy commit:** 4c6d606ebf62f3f190ad7af7eacdb133b39f4ef8 (the step-limit fix; later commits are records only).
**Approved by Keith:** 2026-11-02 ("Live window for this").
**Authorization, and no more:** one deploy of 4c6d606 to ainow-staging-01; one flags-on block; up to 3 runs with write and validation tools; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Browser tools stay off. No product activation. Staging stays behind basic_auth, and the frontend still cannot start the harness.

## Sequence

1. Deploy, Cursor desktop. Same guards as HARNESS-LIVE-02.
2. Keith resets the small test files in project C1 repeat from a console snippet.
3. Flags on. Keith types the provider key at a hidden prompt.
4. Up to 3 runs from a console snippet in Keith's logged-in browser.
5. Read-only evidence block, then flags off. Keith deletes the key.
6. Keith reads the transcripts and records his judgement.

| Run | Prompt in short | Expected |
|---|---|---|
| 1 | npm test fails: find the bug, fix it, confirm (HARNESS-LIVE-02 run 3) | completes with an answer, within 8 calls |
| 2 | Fix every bug, add a slug module with tests, run npm test until it passes | completes with an answer; shows calls and tokens for a bigger task |
| 3 | Create ten files, one tool call per reply | reaches the last-call notice; the model answers with what is done and unfinished |

Run 3 is the only run built to reach the notice, because runs 1 and 2 may finish early. If run 1 fails: stop, flags off, and bring the result to Keith. Runs 2 and 3 failing are results to judge.

## Settings for the window

As in docs/HARNESS-LIVE-02-STAGE-START.md: same caps, write and validation tools on. The provider-side key limit of about $5, which Keith sets, is the real cap. Worst case is about 76,000 tokens per run, about $1.52 if all were output tokens.

## Checks at this stage-start (code read at c5549fb)

- The notice sits in the newest tool result; the journal does not record it, so run 3's answer and the file count are the evidence.
- The journal does not record tool results, so test outcomes come from the model's answer and from the final files.
- The 30-second tool timeout still caps run_validation; these tests finish in seconds.

## Evidence

Off-repo in `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-03/`. No key or secret value is printed or recorded.

## If it fails

On a failed block: stop, flags off, and bring the result to Keith. A fix is a new bounded step. There is no retrying beyond the 3 runs.
