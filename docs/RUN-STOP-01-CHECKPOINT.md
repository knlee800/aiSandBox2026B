# RUN-STOP-01 — Checkpoint

**Task:** RUN-STOP-01 — Stop button for a running chat run
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith's tester finding of 2026-11-06 (no way to stop a run after Send); Keith approved the fix and admitted it.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 2 with FRONTEND and I18N, beside ASK-CONTRACT-01 in Lane 1; validator PASS | c66ae9bf0c032b39f297bb1749476545741dea89 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 9e9c4aa1-03f2-4d7a-a4cd-f1a999598289 | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- New frontend/components/workspace/workspace-run-cancel.logic.ts: requestRunCancel posts to the existing POST /api/ai/executions/:executionId/cancel (same fetch shape as the restore call; the AI execution controller has no CSRF guard, like /api/ai/execute) and returns requested, already_finished (409) or failed, never throwing; helpers decide when Stop shows, the stopped copy for a cancelled run, and the 409 and failure notices.
- frontend/components/workspace/workspace-shell.tsx: while the run is queued or running with a known executionId, Send becomes a Stop button (data-testid workspace-chat-stop, Heroicons v2 Outline StopIcon, DESIGN.md quiet danger style); it calls onStopRun once and shows "Stopping…" disabled while the request is in flight. Every other state keeps workspace-chat-submit as before.
- frontend/app/[locale]/app/page.tsx: onStopRun calls requestRunCancel for Ask, Build and Agent runs; a run that ends cancelled shows "Run stopped." in place of the English "Execution ended with status: cancelled."; a 409 or failure adds a translated system message to the thread, and failure makes Stop usable again. Completed, failed and timeout handling is unchanged.
- Five keys in the ai section of en, zh-TW and zh-CN (stopRun, stoppingRun, runStopped, stopRunAlreadyFinished, stopRunFailed), real translations.
- Tests: workspace-run-cancel.logic.test.ts (8) and workspace-shell.test.tsx (2); existing test IDs kept.
- ASK-CONTRACT-01 (Lane 1, ai-service only) locked first in fb55995; the two lanes share no file, so its evidence stands.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend npx tsc --noEmit | exit 0 |
| frontend npm test | 868 passed, 0 failed (HARNESS-FIXES-01A had 858) |
| frontend npm run build | compiled successfully, exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 8 files, all in the write set; the cancel route is used unchanged |

Evidence in `C:/Users/knlee/aisb-preflight/RUN-STOP-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-stop.txt` | 9146 | `5c0fc08fe5c5ea122da15f5f700f3fd1732ab22a1231c14ffa52826994ca9fe1` |
| `cursor-result.json` | 9634 | `19c6e0cb65700677e5102599fe9b1cc6551b8482b7c050db4ae729f1ca195e62` |
| `reviewer-gates.out` | 87 | `ff365032a0c0656b49945e8ee456da1948ae58fea958398faafd8034fdf2dad9` |

## Acceptance criteria

All eight met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11, UI 9/9 (9: LOCAL-TESTS; the click-to-stop flow is covered by tests and Keith checks it on staging after STAGING-DEPLOY-11 in his own testing)

FOLLOWUPS: 0 registered / 1 superseded (the deploy is STAGING-DEPLOY-11, registered by ASK-CONTRACT-01 for both tasks) / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED. Both implementation lanes are EMPTY. Not deployed.
