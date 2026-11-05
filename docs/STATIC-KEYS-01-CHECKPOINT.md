# STATIC-KEYS-01 — Checkpoint

**Task:** STATIC-KEYS-01 — Static test API keys accepted only in the test environment
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** control-plane review finding during ACCESS-01D; Keith registered it, made ACCESS-LIVE-01 depend on it, approved the scope (static keys only when NODE_ENV is test or development) and admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with the ACCESS-01D lock | 23670b09760e26f5bef27346635d0e14b8dd2168 |
| 1b. Admission | Lane 1 with GATEWAY (applied in the same Cursor run as Part A, committed alone) | 1304225fa00fc91e8be20aec23c0ff101ccf31a9 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

Cursor runs: 2feae8b4-e1c1-44f1-ba73-7fbed516a1f5 stopped at Part A step 2 because its shell could not open the dry-run output file (locked by another process); nothing was applied and the tree stayed clean. ab55d942-870e-4070-adb6-212f2a348d8d applied the admission and implemented the task.

## What changed

- services/api-gateway/src/auth/api-key.config.ts: ApiKeyConfig.staticKeysAllowed() reads process.env.NODE_ENV on every call and returns true only for exactly test or development.
- services/api-gateway/src/auth/api-key-auth.guard.ts: the static fallback runs only when the database lookup found nothing and staticKeysAllowed() is true; otherwise a static key ends in the existing 403 "Invalid API key". The database path is unchanged; no key or error is logged.
- Specs in services/api-gateway/src/auth/__tests__/: each static key, including test-harness-api-key, refused under production, staging and unset; accepted under test and development; a database key accepted under production; the helper read at call time.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx jest src/auth` | 18 suites, 185 passed, 1 skipped |
| api-gateway `npm test` | 2725 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline) |
| api-gateway `npm run build` | exit 0 |
| Diff review | two production files, both in scope; minimal change |

Cursor's first full npm test lost several Jest workers to out-of-memory errors; its rerun matched the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/STATIC-KEYS-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-sk.txt` | 5188 | `a5b1cf7c3e0ef657986a377e37c5cdc4c3a1084e1ddb90312a88445c7d918c25` |
| `cursor-result-1.json` | 8765 | `fc4956e9145b4c315d49548933c74288f6054325b73d028eb30aa29b6c2df401` |
| `cursor-result-2.json` | 11668 | `6c6db59ab4869d42102e1a0adebc9476d2e6907fa24383f41f62eb6d41f8052f` |
| `reviewer-npm-test.out` | 284 | `2b768959d2ea33e157c7e5ab64afcfe59f1d3a3f3f5bbd1692afe9a1deb35130` |

## Acceptance criteria

All seven met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed. Staging runs with NODE_ENV=production, so after the next deploy a static key is refused there; ACCESS-LIVE-01 confirms it on staging.
- The old local scripts scripts/phase-47 to phase-51 validation keep working only under NODE_ENV=development, as the local Docker setup has.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED.
