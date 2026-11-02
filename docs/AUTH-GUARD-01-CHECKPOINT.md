# AUTH-GUARD-01 — Checkpoint

**Task:** AUTH-GUARD-01 — Close the internal-service guard bypass: letter case and routes outside /api/internal
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Stage-start:** docs/AUTH-GUARD-01-STAGE-START.md. **Source:** deferred concerns in docs/GOV-RPG-UI-COMPAT-01-REVIEW-RECORD.md, checked before the harness UI connection as docs/GOV-HARNESS-RESET-01-DECISION.md requires.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1 and 2. Registration, stage-start and admission | Lane 1 with GATEWAY | 9e6de5a8166c54ce8f1e41e08193b0833d254bbc, 48cdfe46fb2e403be3a3a6413f05b83d8844c442 |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 3118955e-a8c8-4d2a-ad6e-ac1ead94570a, one run | 0498cbe4fbaad87751cdc8fe9b1abe53458fade1 |
| 4. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

`internal-service-auth.guard.ts` now lowercases the request path and requires the key on /api/internal/, /api/events/, /api/chat-messages/, /api/token-usage/ and /api/runtime/. Two new spec files cover it, one over HTTP with the real controllers. No existing test changed.

## Before and after (local test with the compiled guard and stub routes)

| Request, with no key | Before | After |
|---|---|---|
| `GET /api/internal/workspace/s1/read` | 401 | 401 |
| `GET /API/INTERNAL/workspace/s1/read` | 200 | 401 |
| `GET /api/Internal/workspace/s1/read` | 200 | 401 |
| `POST /api/chat-messages/add-by-session` | 201 | 401 |

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2385 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |

Changed-case /api/events/ paths are covered by the unit spec; the HTTP spec covers changed-case internal, chat-messages, token-usage and runtime routes.

Evidence in `C:/Users/knlee/aisb-preflight/AUTH-GUARD-01/`. The test key is a made-up value:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 239828 | `cdb41328585aa8559e9110153db151b13bcd86fcb69ff7710cd6b7557d26502e` |
| `reviewer-summary.txt` | 697 | `850ed560ced2c8fbabc6fb0a96776e4587e7b2674bd18aa4911f5a6ff1a98bff` |
| `local-guard-test.js` | 1371 | `c903990db860a9232bb61fc1815e1e66cb6cfb619a5b4dc6b2e523aada01a03c` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All six met (diff review, the reviewer run and the before-and-after test). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Not deployed: ainow-staging-01 still has the bypass behind basic_auth. It closes at the next deploy. The old instance aisandbox-staging was not checked.
- `/api/runtime/metrics` now needs the key. No caller was found in services, frontend, ops or scripts.
- Unchanged and not in scope: the key is compared with a plain comparison, and the constructor warning still says internal endpoints are unprotected when the key is unset, although they are refused.
- Next: AUTH-OWNER-01 (execution ownership and stream cleanup). Socket.IO stays recorded and open: it needs authentication before anything starts using it.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
