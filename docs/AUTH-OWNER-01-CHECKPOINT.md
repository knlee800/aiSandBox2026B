# AUTH-OWNER-01 — Checkpoint

**Task:** AUTH-OWNER-01 — Owner checks on execution cancel, stream and public execute, and stream subscription cleanup
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Stage-start:** docs/AUTH-OWNER-01-STAGE-START.md. **Source:** deferred concerns in docs/GOV-RPG-UI-COMPAT-01-REVIEW-RECORD.md.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1 and 2. Registration, stage-start and admission | Lane 1 with GATEWAY | e8a9579a6e52d2662ceb55dbb55359bdeba2dea4, ca10a3a5bbafda8a53ea1dcfd3d5bd2b0f31bdf7 |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 64b06cc6-ec7a-426c-bbb6-2a89b516398b, one run | 8fb5b630d6278717f195f6c194e59524905d95ec |
| 4. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Change |
|---|---|
| `ai-execution.controller.ts` | cancel and stream return 404 for a missing execution or another user's; the stream refuses before it opens |
| `public-ai.controller.ts` | execute returns 400 for a non-UUID sessionId and 404 for another user's session, before the ledger write and enqueue |
| `execution-stream.service.ts` | one Redis message listener, per-viewer callbacks, and the channel dropped only when its last viewer leaves |
| two new specs and `public-ai.controller.spec.ts` | coverage over HTTP and with Redis mocked; three existing public tests now use a UUID session and a SessionService mock |

The other three files in the write scope needed no change.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2401 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |

Cursor's own run reported 23 failures in four suites from a better-sqlite3 Node ABI mismatch. They pass in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/AUTH-OWNER-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 240041 | `e1c3a05b1450945a9fc7be971dfd07e1a75290154f750965501e96bc937cc4a1` |
| `reviewer-summary.txt` | 278 | `ceec3be35bb736cc6bcc01cf89a166b7bb1e1330c514af1878af3d7b6fbfa560` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All six met (diff review and the reviewer run). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Not deployed: ainow-staging-01 still has these gaps behind basic_auth, and the stream change has not run against real Redis. Both need the next deploy and a live check.
- Public API callers sending a non-UUID sessionId now get 400.
- If a Redis subscribe fails, the viewer's callback stays in the map until the stream closes, which the failed stream triggers.
- Socket.IO rooms stay open and recorded: anyone connected can join any session's room. No frontend code was found opening a socket, and Caddy sends /socket.io to the frontend. It needs authentication before anything starts using it. Port 4000 listens on all interfaces; the host firewall was not checked.
- Other public routes were not reviewed here.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
