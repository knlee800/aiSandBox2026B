# CM-CLEANUP-01B — Checkpoint

**Task:** CM-CLEANUP-01B — Gateway preview catch-all drops hop-by-hop headers
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CM-CLEANUP-01 split (CM-AUTH-01's latent finding). Admitted 2026-11-10 (0707b7a) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with GATEWAY | 0707b7a |
| 2. Implementation | sonnet subagent (Sonnet 5.5: a small response-header fix in one gateway folder) in worktree lane/CM-CLEANUP-01B, fast-forwarded onto main | 32d7ced |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

`services/api-gateway/src/preview/preview-response-headers.ts` (new) exports `filterProxyResponseHeaders(headers, { streamed })`. The preview catch-all in `preview.controller.ts` copies only what it returns. Names are matched case-insensitively.

| Path | Dropped |
|---|---|
| Both | connection, keep-alive, proxy-connection, transfer-encoding, te, trailer, upgrade, proxy-authenticate, proxy-authorization, and any header named in the response's own Connection header |
| Non-stream (`res.send`; axios has already decoded the body and Express re-serialises it) | also content-length and content-encoding, so Express sets its own |
| Stream (proxy pipe) | content-length and content-encoding are kept, because the bytes pass through unchanged |

The request side is unchanged:
- `resolvePreviewForward`, `buildPreviewTargetUrl`, `sanitizeProxyHeaders` and `internalKeyHeaders`;
- the ownership guard and the session guard.

Every existing preview test passes unchanged, including the traversal spec.

Tests (`__tests__/preview.response-headers.spec.ts`, 16):
- **The helper:** each of the 9 headers on both paths; case variants; names listed in Connection; content-length and content-encoding dropped without a stream and kept with one; missing headers.
- **The controller:** a JSON reply no longer sets transfer-encoding, connection or content-length, and keeps content-type and cache-control; the streamed proxy keeps content-length.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3344 passed (3328 plus the 16 new tests), 7 skipped, 14 failed; the 14 are the known smoke.integration failures |
| gateway `npm run build` | exit 0 |

The ai-service suite was not rerun: its specs read gateway `system-agents/` and `orchestration/`, not `preview/`. The committed files are LF.

## Limits

Not deployed; STAGING-DEPLOY-WF-01 carries it. The real preview path through Caddy is part of Keith's logged-in checks there.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (1: no guard, auth or key change; 5: n/a, no entity or schema change; 6: only the 14 known smoke failures)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 is released EMPTY, and GATEWAY is released UNOWNED.
