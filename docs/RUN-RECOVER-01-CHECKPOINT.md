# RUN-RECOVER-01 — Checkpoint

**Task:** RUN-RECOVER-01 — Reconnect the Builder chat to a run after a refresh
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Stage-start:** docs/RUN-RECOVER-01-STAGE-START.md.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1 and 2. Registration, stage-start and admission | Lane 1 with FRONTEND and I18N | 4722153b9af4d62557d8f3bfed0fc304a8313f58, 1ae81ef807e05262d827575eb25ad4c46eb6fe2e |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session e6951312-503f-48a3-aeb4-4a9563694aa8, one run and one review delta | a481b9d05322d34707fcdb99f7458ac1ed2e08d0 |
| 4. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

`workspace-run-recovery.logic.ts` holds the pending-run record, run list parsing, run selection and the notice. `page.tsx` writes the record when a run starts, clears it when the run ends, moves the stream setup to one function used by both paths, and adds recoverSessionRun after the thread is restored. Recovered runs are always registered with intent conversation, so file actions are skipped. Two new keys in each of `en`, `zh-TW` and `zh-CN`.

**Review delta:** the first version set the not-applied notice as the chat status, which the shell hides once a run ends, so it never showed. The reviewer sent it back: the notice is now added to the assistant message and saved with it, and the status calls are as they were.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 73 suites, 819 passed, 0 failed |
| frontend `npm run build` | exit 0 |

Evidence in `C:/Users/knlee/aisb-preflight/RUN-RECOVER-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-frontend-test.txt` | 176628 | `2e28627cd3b7d527be67c2d5f9823746d102735d32ba2e5d9e139830886df833` |
| `reviewer-summary.txt` | 104 | `24440410f18993adb0ac9dc1192185d7db45cb4a34f7a9bb29af8d4c56932b96` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All eight met by diff review and the reviewer run, at the level of tests. The reconnect itself lives in page.tsx and has no direct unit test; it is checked in the live window. Not LOCKED by an implementer: locked by the control plane.

## Open items

- Not run in a browser: the live check after this lock covers it, with the run list on real PostgreSQL.
- Earlier steps are not stored, so a recovered Agent run shows only steps from the reconnect onward, and gets the after-run checkpoint and autosave only if a write is seen after it.
- The pending record is per browser.
- Not deployed: ainow-staging-01 runs 0838a5f.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED; GOVERNANCE UNOWNED.
