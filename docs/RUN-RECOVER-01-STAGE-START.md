# RUN-RECOVER-01 — Stage-Start

**Task:** RUN-RECOVER-01 (Lane 1; FRONTEND, I18N; LOCAL-TESTS).
**Approved by Keith:** 2026-11-02.
**Authorization, and no more:** the frontend code and tests below, by Cursor CLI. No server, staging, provider, credit or environment action, and no deploy.

## Facts from the code at c933a7f

- The thread is restored from localStorage, then replaced by backend messages when there are any. Backend messages carry role and content only, not an execution ID.
- The browser saves the assistant message when it sees the run end. A refresh before that loses it.
- `GET /api/ai/executions?state=active&sessionId=` finds a running run from any browser. It holds no answer. `GET /api/ai/executions/:id` is owner-checked and does.

## Design

- **Which run:** when a session opens, ask for its active runs. Take the newest that started under 15 minutes ago, so a stuck row never shows as running forever. If there is none, use a pending-run record in localStorage for that session, written when a run starts and cleared when the browser sees it end. This covers a run that ended while the page was closed.
- **Reconnect:** register the run the same way the send path does, add an assistant message if the thread has none for it, reopen the stream, and let the existing status path finish it. That path already saves the answer and clears the state. Only one run reconnects per session open, and never over a run already in progress.
- **Once only:** the pending record is cleared when the run ends, so reloading again does not repeat the answer.
- **Build safety:** every recovered run is registered with intent `conversation`, so `consumeExecutionFileActions` skips the apply. Only mode `agent` gets the Agent refresh. A recovered Build or unknown-mode run says its changes were not applied. This keeps the deliberate behaviour recorded in docs/AI-WS-02-hotfix-CHECKPOINT.md.

## Known limits

- Earlier steps are not stored, so the step list only shows steps from the reconnect onward. A recovered Agent run may not know it wrote files, so it always gets the refresh but only gets the after-run checkpoint and autosave if a write was seen. The pre-apply save point stands.
- The pending record is per browser. A run started in another browser that ended while this page was closed is not shown.

## Not in scope

The gateway, a run list screen, stored step history, a cancel control, and deploying.

## If it fails

If a normal run with no refresh, or Ask or Build requests, would change, stop and report.
