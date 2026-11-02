# AUTH-OWNER-01 — Stage-Start

**Task:** AUTH-OWNER-01 (Lane 1; GATEWAY; LOCAL-TESTS).
**Approved by Keith:** 2026-11-02.
**Authorization, and no more:** owner checks and stream cleanup in the gateway, with tests, by Cursor CLI. No server, staging, provider, credit or environment action, and no deploy.

## Findings, from reading the code at 96a25b5

| Route or service | Finding |
|---|---|
| `POST /api/ai/executions/:id/cancel` | Logged-in only; no owner check, unlike the status route |
| `GET /api/ai/executions/:id/stream` | Logged-in only; no owner check |
| `POST /api/v1/ai/execute` | `AuthorizationGuard` only checks scopes; the other guards check safety, limits and credits. The handler writes the ledger and enqueues with `request.sessionId` unchecked. The browser route does check (AGENT-HARNESS-05C5) |
| `ExecutionStreamService` | Each `subscribe` adds a `message` listener that is never removed; `unsubscribe` drops the Redis channel even when another viewer is still connected |

## Design

- **Cancel:** load the execution first. If it is missing or `user_id` differs, 404 as the status route does. Then `requestCancel`, keeping the 409.
- **Stream:** the handler becomes async and does the same check before it returns the Observable, so a refusal is a plain 404, not an event on an open stream.
- **Public execute:** a non-UUID `sessionId` is 400. Otherwise `sessionService.getSessionById`, and 404 when `userId` differs. Both come before the ledger write and the enqueue. `SessionModule` is already imported, so the module does not change.
- **Stream service:** one `message` handler registered once, a map of channel to callbacks, `subscribe(executionId, onMessage)` and `unsubscribe(executionId, onMessage)`. The Redis channel is subscribed for the first viewer and unsubscribed after the last.

## Callers checked

Only `AIExecutionController` uses `ExecutionStreamService.subscribe`. The frontend opens the stream with `EventSource` for the user's own execution, so cookies identify the owner.

## Behaviour change to expect

Public API callers sending a non-UUID `sessionId` now get 400. The browser route already rejects these.

## If it fails

If the Sse route cannot return a plain 404 through an async handler, stop and report rather than sending the refusal as a stream event.
