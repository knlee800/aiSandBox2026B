# DEBUG-INGEST-01 — Checkpoint

**Task:** DEBUG-INGEST-01 — Remove the leftover debug ingest calls to 127.0.0.1:7870
**Status:** COMPLETE AND LOCKED — 2026-10-30
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** FORCING.
**Source:** plan risk register R15 and the follow-up candidates recorded in the CLEAN-BASELINE-DEPLOY-01 C2 and C3 results; registered on Keith's instruction after the DEPLOY-01 lock.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered, then admitted to Lane 1 with GATEWAY, CONTAINER-MANAGER and FRONTEND | 81fb5e1657c8332f9dd1c3d922620cf130914978, 3a854b1ccd69e22eaae41394213df2909ab959d7 |
| 2. Implementation | Cursor CLI (cursor-delegate), grok-4.7-high, session 49bf1532-8b27-4df6-b4c4-dda84b4fe558, one run | d09423d7e6ddc3f91ce769bde458235e4092384e |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Removed |
|---|---|
| `services/api-gateway/src/clients/container-manager-http.client.ts` | two debug blocks in execInSession (7 lines including one blank) |
| `services/container-manager/src/sessions/sessions.service.ts` | the `if (userId)` wrapper whose only content was the block (6 lines including one blank) |
| `frontend/app/[locale]/app/page.tsx` | one block in the manual checkpoint error path (3 lines) |
| `frontend/components/workspace/workspace-checkpoint-create.logic.ts` | one block (3 lines) |

19 deletions, no additions, no other change. No `127.0.0.1:7870` or `ingest/eba94f28` string remains in source under services/ and frontend/ (node_modules, .next and dist excluded).

## Validation (reviewer, Node v22.14.0)

| Gate | Result | Baseline |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 2320 passed, 14 failed (all in smoke.integration.spec.ts, which needs live PostgreSQL and Redis), 7 skipped | the same 14 failures (CREDIT-UNIT-01) |
| api-gateway `npm run build` | exit 0 | |
| container-manager `npm test` / `npm run build` | 192/192 / exit 0 | 192/192 |
| frontend `npx tsc --noEmit` / `npm test` / `npm run build` | clean / 786/786 / exit 0 | clean / 786/786 |

Evidence copied to `C:\Users\knlee\aisb-preflight\DEBUG-INGEST-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-jest.txt` | 266754 | `f4cc3f765b7461bee4227ed210f3fc350bf1eb789d2a358a17d28ae0eb3201a2` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `reviewer-cm-test.txt` | 20816 | `64fde7790ed57232c79d989ea3b117b79e30e7e17860c0f47c2e35ad87fbf442` |
| `reviewer-cm-build.txt` | 51 | `d8cf8ea1c2c14197f5ab98901700b49b16d0ee0d9d4f61e16fdbe3dbdc1b8d33` |
| `reviewer-frontend-tsc.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reviewer-frontend-test.txt` | 169519 | `b45efb3893398168754af3303877f1bc9c547aa4792cdfbcecaad6b4bf999534` |
| `reviewer-frontend-build.txt` | 2855 | `d05e7c86326f55809da52a6f291518d72df569875a1bf8849d5a13c07cb3de1b` |
| `cursor-brief.txt` | 3074 | `78c9cc7181fe56e134678693f9756792589439c4123f16a2a48ee72730f582d6` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| No 127.0.0.1:7870 or /ingest/eba94f28 string remains in source | met (search: 0 matches) |
| Exactly the five blocks and the emptied if (userId) wrapper are removed | met (diff review) |
| api-gateway jest passes apart from the known smoke failures; build passes | met |
| container-manager tests and build pass | met |
| frontend tsc, tests and build pass; tsbuildinfo restored | met |
| Only the write-scope files change | met (four files) |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- Not deployed: ainow-staging-01 runs 7317749 until a separately authorized deploy carries this change.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-30 by the control plane. Lane 1 released EMPTY; GATEWAY, CONTAINER-MANAGER and FRONTEND released UNOWNED; GOVERNANCE UNOWNED.
