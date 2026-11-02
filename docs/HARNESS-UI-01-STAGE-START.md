# HARNESS-UI-01 — Stage-Start

**Task:** HARNESS-UI-01 (Lane 1; FRONTEND, I18N, GATEWAY; LOCAL-TESTS).
**Approved by Keith:** 2026-11-02.
**Authorization, and no more:** the code and tests below, by Cursor CLI. No server, staging, provider, credit or environment action, and no deploy.

## Questions the draft left, answered from the code at 898f429

| Question | Answer |
|---|---|
| How does the frontend learn who qualifies? | `GET /api/auth/me` adds `harnessEntitled`, using the same check as `SessionOrApiKeyAuthGuard`. The Builder page already fetches `/api/auth/me` at start. The gateway still refuses anyone else |
| Does status polling last long enough? | Yes. It polls every 3 seconds while queued or running, with no attempt limit |
| Does a cancel button work on harness runs? | The chat has no cancel control for runs at all. None is added here. A run is bounded by 8 model calls and the execution timeout |
| Which intent does Agent send? | `conversation` with `harnessVersion: 'v1'`, as all live proof used. `conversation` also skips the file-action apply path, which a harness run does not use |

## Design

- **Mode:** a separate Agent state beside the existing intent, so `WorkspaceExecutionIntent` and the Ask and Build requests do not change. Selecting Ask or Build leaves Agent.
- **Progress:** the existing stream handler ignores unknown types. It gains `harness_progress`, kept per execution and shown under the chat status. A small logic file holds parsing and display, so it can be unit-tested.
- **After a run:** `maybeRunExecutionCoherence` needs applied file actions, which Agent runs do not have, so a new page function runs once per execution, using the existing guard: refresh the file tree, open file, preview and checkpoints. It also runs after failed, cancelled and timed-out runs, because those may have written files.
- **Checkpoint and autosave:** when progress showed `write_file` or `delete_file`, the same AI checkpoint and project autosave as the Build path run. The pre-apply save point already exists from the harness.

## Known limits

- Progress is not stored. If the stream drops, the step list stops and a write may go unseen, so the post-run checkpoint and autosave are skipped. The refresh still runs and the pre-apply save point stands.
- Charging stays token-based and must be settled before anyone but Keith uses Agent.

## Not in scope

Making Agent the default, showing it to anyone else, a cancel control, token-by-token text, charging, Ask or Build behaviour, and deploying.

## If it fails

If Ask or Build requests would change in any way, stop and report.
