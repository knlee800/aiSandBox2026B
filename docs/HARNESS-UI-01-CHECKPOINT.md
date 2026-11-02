# HARNESS-UI-01 — Checkpoint

**Task:** HARNESS-UI-01 — Agent mode in the Builder chat, for allowlisted users, with progress and post-run refresh
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Stage-start:** docs/HARNESS-UI-01-STAGE-START.md.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1 and 2. Registration, stage-start and admission | Lane 1 with FRONTEND, I18N and GATEWAY | 846c2b1870bebe728c90494c2c0792b16a4db901, b70d02815acb5f4b3c00cfa7ebedab05f07fae3c |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 2a0f5b03-a01d-4194-8eb3-9047067fa960, one run | 0838a5f47947ddc4ff884f66d999489501ea1294 |
| 4. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| Area | Change |
|---|---|
| Gateway | `GET /api/auth/me` adds `harnessEntitled`; the guard's check is exported unchanged |
| `workspace-agent-mode.logic.ts` | parsing, step list, write detection, request fields and label keys |
| `page.tsx` | separate Agent state; send path; `harness_progress` handling; a once-per-run refresh after any end state; checkpoint and autosave after a run that showed a write; the autosave block moved to a shared function with the same behaviour |
| `workspace-shell.tsx` | Agent button, shown only when entitled; step list |
| `en`, `zh-TW`, `zh-CN` | 11 new keys in each |

With Agent off, the request body keeps the same fields in the same order. The existing test that both execute sites spread the frozen helper and omit harnessVersion still passes.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 72 suites, 805 passed, 0 failed |
| frontend `npm run build` | exit 0 |
| api-gateway `npm test` | 2403 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-UI-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-frontend-test.txt` | 173552 | `a0dd738ca93472e38c2ea7b66328044b1f9e8736a2383b2f7f1bf0dcb04f0e9e` |
| `reviewer-gateway-test.txt` | 240132 | `a24bb3fecd675c8220e2c77f8a3fd7d02b7e81069bc41dea186bf3200cca23d0` |
| `reviewer-summary.txt` | 406 | `7ebca86c4c43088e84bac4892ace7ad0acb2cf8fd6b79c16b8449eb4998bd03e` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All eight met by diff review and the reviewer run, at the level of tests. Not LOCKED by an implementer: locked by the control plane.

## Open items

- Not run in a browser: layout, phone width and the real flow are checked in HARNESS-LIVE-05.
- Agent sends the same workspaceContext as Ask and Build; the console runs in earlier windows sent none, so this is new in HARNESS-LIVE-05.
- Not stored: if the stream drops, the step list stops and a write may go unseen, so the post-run checkpoint and autosave are skipped. The refresh still runs and the pre-apply save point stands.
- No cancel control. Charging stays token-based and must be settled before anyone but Keith uses Agent.
- Not deployed: ainow-staging-01 runs 8fb5b63.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; FRONTEND, I18N and GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
