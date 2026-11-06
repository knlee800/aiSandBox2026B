# HARNESS-FIXES-01A — Checkpoint

**Task:** HARNESS-FIXES-01A — Agent safety fixes: honest delete flag, recovered Build notice, failed search, Restore during a run
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** slice A of HARNESS-FIXES-01; Keith chose it as next work on 2026-11-06, chose option A for deletes, included item 10b and admitted it.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Investigation | Cursor CLI read-only, requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 4786bad1-707d-4ee6-bae3-96a75358fd1f (two turns: summary, then the full report) | no repository change |
| 2. Registration, admission and stage-start | Lane 1 with AI-SERVICE, CONTAINER-MANAGER, GATEWAY, FRONTEND and I18N; docs/HARNESS-FIXES-01A-STAGE-START.md; HARNESS-FIXES-01 marked sliced | 8bae3d1956d682a2095a32e8932f2d3fc71b701e |
| 3. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 980bbc43-4680-4f1c-9987-2a672130456c | this commit |
| 4. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- Item 10b: services/api-gateway/src/sessions/session.controller.ts restoreSessionSnapshot looks up the caller's pending, running or cancel_requested usage record in the session (the set projects.service.ts uses) and throws 409 with code run_active before any snapshot or checkpoint-history restore; session.module.ts registers UsageRecord. frontend/components/workspace/workspace-snapshots.logic.ts returns run_active for a 409, and page.tsx shows the new key recovery.workspace.restoreBlockedByActiveRun in the existing snapshot error line (en, zh-TW and zh-CN, real translations).
- Item 8: services/ai-service/src/agent-harness/config/agent-harness.config.ts sets requireApprovalForDelete to false; the builder-profile floor is unchanged.
- Item 11: frontend/components/workspace/workspace-run-recovery.logic.ts returns the not-applied notice alone for a recovered Build or unknown run.
- Item 5: services/container-manager/src/docker/docker-runtime.service.ts returns no matches only for exit 1 with empty stdout and stderr; any other failed search with empty stdout throws, which the AI service turns into a tool error.
- Item 10 needed no change: HARNESS-REOPEN-01 already guards project reopen (projects.service.ts).
- Tests: agent-harness.config.spec.ts, builder-harness-config-adapter.spec.ts, docker-runtime.service.spec.ts (the old exit-127-is-empty test now expects the error), session.controller.spec.ts, workspace-run-recovery.logic.test.ts, workspace-snapshots.logic.test.ts.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service npm test / build | 45 suites, 1100 passed, 1 skipped / exit 0 |
| container-manager npm test / build | 10 suites, 206 passed / exit 0 |
| api-gateway npm test / build | 2748 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline) / exit 0 |
| frontend tsc / npm test / build | exit 0 / 858 passed, 0 failed / exit 0; tsconfig.tsbuildinfo restored |
| Diff review | 16 files, all in the stage-start write set; each item as frozen |

Cursor's first ai-service run lost three Jest workers to a heap allocation failure; its rerun and the reviewer run passed. Cursor reported UI item 5 as n/a because it believed DESIGN-DOC-01 was not locked; it was locked (7ca6024), and Cursor followed DESIGN.md for the error line anyway, so the item is met.

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-FIXES-01A/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-inv.txt` | 3342 | `7245c043a1c799a799eb93519fbf5fa7d993ef95cd751afc280bb216e279fd42` |
| `brief-inv2.txt` | 915 | `9bccd8989001d5f7b1a55d41a48c4b1a528c8f36836e2160ad6b821efd26db5b` |
| `brief-hf1.txt` | 9207 | `a74f8f7b1e3543b1c4ace50bae6fd93021935f07fdd4c52d531f8e6832abfee1` |
| `cursor-result-1.json` | 2146 | `44312f2667609e5ff2ce85229f59a2aa18a17e3512a7d7649f7534cb294fa438` |
| `cursor-result-2.json` | 18070 | `47dd6971eabd1241b2049bcd773b17e866464ef1f221d39cf75a053f1132f343` |
| `cursor-result-3.json` | 13840 | `46919b61e155627e53a8df336918e0f94933502ff99fdb93f8903d6040914ae7` |
| `reviewer-gates.out` | 564 | `3f753d7a2c5b684c11b8dceec0b601a5cd368426541a20fa73cee13657b53fd0` |

## Acceptance criteria

All eight met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11, UI 9/9 (3 n/a: no new icon; 9 n/a: LOCAL-TESTS, no browser check required), FLOWS 4/4 (2 n/a: no checkpoint or revert behavior change), BACKEND 6/6 (5 n/a: no entity or schema change)

FOLLOWUPS: 1 registered (STAGING-DEPLOY-10, NOT_READY until Keith picks the time; the tester window is open) / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; AI-SERVICE, CONTAINER-MANAGER, GATEWAY, FRONTEND and I18N released UNOWNED. Not deployed.
