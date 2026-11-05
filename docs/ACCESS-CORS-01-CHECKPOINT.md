# ACCESS-CORS-01 — Checkpoint

**Task:** ACCESS-CORS-01 — HTTP CORS allows only the app's own origin
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** ACCESS-READY-01 item 9 (added by ACCESS-01A). Keith approved the draft and admitted it on 2026-11-06.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with GATEWAY (applied in the same Cursor run as Part A, committed alone) | de56b571ba5adf7b0de85cd4fa8b314bf4a105d4 |
| 2. Stage-start | docs/ACCESS-CORS-01-STAGE-START.md, frozen in the admission record | de56b571ba5adf7b0de85cd4fa8b314bf4a105d4 |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session e53c78b2-5ee1-4f9b-b2c8-09d4b841b6db | this commit |
| 4. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- services/api-gateway/src/cors/http-cors-origin.ts (new): resolveHttpCorsOrigin calls resolveSocketCorsOrigin from services/api-gateway/src/websocket/websocket.gateway.ts and passes the result through, so HTTP and the socket share one rule.
- services/api-gateway/src/main.ts: app.enableCors uses origin: resolveHttpCorsOrigin instead of origin: true; credentials: true kept; nothing else changed.
- services/api-gateway/src/cors/http-cors-origin.spec.ts (new): allowed origin echoed; another host, another port, another scheme and a missing Origin refused; APP_BASE_URL unset, blank and not a URL refused; a source test that main.ts uses resolveHttpCorsOrigin with credentials: true and contains no origin: true.
- websocket.gateway.ts is unchanged.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx jest src/cors` (Cursor) | 1 suite, 9 passed |
| api-gateway `npm test` (reviewer rerun) | 2744 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline); 2735 before plus the 9 new tests |
| api-gateway `npm run build` (reviewer rerun) | exit 0 |
| Diff review | one production line changed in main.ts plus one import; new helper and spec in scope; matches the frozen design |

Evidence in `C:/Users/knlee/aisb-preflight/ACCESS-CORS-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-cors.txt` | 4576 | `760b3cab20b5732d8acfeaee75a390dc158f69917d5b673f6c6fa032a952e421` |
| `cursor-result-1.json` | 4077 | `c94f6bf33cd5aecff68b26bd4abf886fd0ba2cce0d4a9822e3b810b275a18a83` |
| `reviewer-npm-test.out` | 270 | `2fe6b09a934ca32f81a63113e836772ef4f07cf53ec50db23fc3c41b1e286172` |

## Acceptance criteria

All six met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed. STAGING-DEPLOY-09, registered and admitted in this record, deploys it and checks the CORS headers from the host.
- CORS controls which websites may read replies; it does not stop a cross-site request from being sent. The CSRF guard and ADMIN-CSRF-01 cover that side.

FOLLOWUPS: 1 registered (STAGING-DEPLOY-09, admitted in this record) / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released and taken by STAGING-DEPLOY-09; GATEWAY released UNOWNED.
