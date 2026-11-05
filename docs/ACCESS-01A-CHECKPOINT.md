# ACCESS-01A — Checkpoint

**Task:** ACCESS-01A — Authenticate Socket.IO and owner-check room joins
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** COMMERCIAL. **Lifecycle:** 4-STEP (security). **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** first slice of ACCESS-READY-01, docs/ACCESS-READY-01-PLAN.md. Keith admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with the approved plan | 1604ace16a59179affe6e76afd0ddf2f18087e8c |
| 1b. Admission | Lane 1 with GATEWAY | f6f20190b5e20d59b5e492492665350def864a8b |
| 2. Stage-start | No separate document: the approved plan's item 4 design (sections 2 and 3), its reviewer notes and the implementation brief served as the design step. Recorded as a deviation from a written stage-start. | — |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session fd62d5ef-5c65-44aa-96df-70d0a95968c3, one run | this commit |
| 4. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

services/api-gateway/src/websocket/websocket.gateway.ts: on connection the aisandbox_session cookie from the handshake is validated with AuthService.validateSessionToken; a missing, blank or invalid one disconnects the client, and a valid user's id is kept on the socket. join-session waits for that check and joins session:<id> only when SessionService finds the session and its userId equals the connected user; foreign, unknown and blank ids return { success: false }. Socket CORS allows only the origin of APP_BASE_URL (none when unset); credentials stay on for the session cookie. leave-session and the emit methods are unchanged. websocket.module.ts imports AuthModule and SessionModule without changing them. Tests: a new gateway spec (connection, join, CORS) and the events guard spec extended (all three event routes and a wrong key).

POST /api/events/* stays behind the global InternalServiceAuthGuard; no new guard was needed.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2653 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| Cursor's run | `npx jest src/websocket` 2 suites, 23 passed |

Evidence in `C:/Users/knlee/aisb-preflight/ACCESS-01A/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 249501 | `1aca66efb023d8ba081ccfa85209339d4e4d7512ea0cd8352697ca7ea24f8ddc` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |

## Acceptance criteria

All five met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

Mocked only; not deployed (staging runs 1aee7ed). Whether port 4000 is reachable from outside is checked in ACCESS-LIVE-01. No frontend code opens a socket today, so nothing visible changes. HTTP CORS (main.ts) still allows any origin; it is outside this slice.

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (HTTP CORS allowing any origin, as an ACCESS-READY-01 item)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
