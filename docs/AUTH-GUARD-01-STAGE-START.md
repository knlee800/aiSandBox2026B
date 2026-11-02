# AUTH-GUARD-01 — Stage-Start

**Task:** AUTH-GUARD-01 (Lane 1; GATEWAY; LOCAL-TESTS).
**Approved by Keith:** 2026-11-02.
**Authorization, and no more:** one change to `InternalServiceAuthGuard` and its tests, by Cursor CLI. No server, staging, provider, credit or environment action, and no deploy.

## Finding

Local test on 2026-11-02, with the compiled guard and stub routes on a loopback port:

| Request, with no key | Result |
|---|---|
| `GET /api/internal/workspace/s1/read` | 401 |
| `GET /API/INTERNAL/workspace/s1/read` | 200 |
| `GET /api/Internal/workspace/s1/read` | 200 |
| `POST /api/chat-messages/add-by-session` | 201 |

Express routes ignore letter case, and the guard's `startsWith` check does not. The guard returns true for any path that is not `/api/internal/` or `/api/events/`, so `@UseGuards(InternalServiceAuthGuard)` on the chat-messages, token-usage and runtime controllers does nothing. Not tested on staging.

## Design

The guard lowercases `request.path` and requires the key when it starts with `/api/internal/`, `/api/events/`, `/api/chat-messages/`, `/api/token-usage/` or `/api/runtime/`. It stays the global guard, and every other path still passes. Path-based protection is kept so this stays a small change; moving to per-controller metadata is not in scope.

## Callers checked

| Route | Caller | Effect |
|---|---|---|
| `/api/chat-messages/add-by-session` | AI service, sends the key | none |
| `/api/token-usage/record` | AI service, sends the key | none |
| `/api/runtime/metrics` | none found in services, frontend, ops or scripts | now needs the key |

## Not in scope

Execution ownership and stream cleanup (AUTH-OWNER-01), Socket.IO, constant-time key comparison, the container manager guard, and deploying. The change reaches staging in a later window.

## If it fails

A real service call being refused is a stop: report to the control plane rather than widening the bypass.
