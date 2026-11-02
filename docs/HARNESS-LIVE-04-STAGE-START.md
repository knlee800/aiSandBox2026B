# HARNESS-LIVE-04 — Stage-Start

**Task:** HARNESS-LIVE-04 (Lane 1; STAGING, PROVIDER-LIVE, CREDIT, ENV; PROVIDER-LIVE evidence).
**Deploy commit:** 8fb5b630d6278717f195f6c194e59524905d95ec (search and both authorization fixes; later commits are records only).
**Approved by Keith:** 2026-11-02.
**Authorization, and no more:** one deploy of 8fb5b63 to ainow-staging-01, with requests carrying no key to confirm the guard; one flags-on block; up to 2 runs; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Browser tools stay off. No product activation. Staging stays behind basic_auth, and the frontend still cannot start the harness.

## Sequence

1. Deploy, Cursor desktop. Same guards as HARNESS-LIVE-03. The block then checks the guard on the server.
2. Keith resets the test files in project C1 repeat from a console snippet.
3. Flags on. Keith types the provider key at a hidden prompt.
4. Up to 2 runs from a console snippet in Keith's logged-in browser, with stream and cancel checks.
5. Read-only evidence block, then flags off. Keith deletes the key.
6. Keith reads the transcripts and records his judgement.

| Check | Expected |
|---|---|
| Changed-case internal paths, chat-messages, token-usage and runtime, no key | 401 |
| Run 1: find which file defines a value in nested files, tool not named | correct file, line and value; journal shows the tools used |
| Run 2: search for text that does not exist | says it was not found |
| Two stream viewers on run 1, one closed early | the open one receives the final answer |
| Stream and cancel for an unknown execution ID | 404 |

If run 1 fails: stop, flags off, and bring the result to Keith. Run 2 failing is a result to judge.

## Settings for the window

As in docs/HARNESS-LIVE-03-STAGE-START.md: same caps, write and validation tools on. The provider-side key limit of about $5, which Keith sets, is the real cap. Worst case is about $1.52 per run.

## Checks at this stage-start (code read at cd395d6)

- No migration, package, compose or environment change between 4c6d606 and 8fb5b63. The deploy block stops if the migration hash changes.
- The worker publishes the finished answer as one stream message, so the stream check shows delivery of that message, not token-by-token output.
- Another user's execution needs a second account, so that refusal stays proven by HTTP tests with mocked services.
- Socket.IO and the host firewall are not touched.

## Evidence

Off-repo in `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-04/`. No key or secret value is printed or recorded.

## If it fails

On a failed block: stop, flags off, and bring the result to Keith. A fix is a new bounded step. There is no retrying beyond the 2 runs.
