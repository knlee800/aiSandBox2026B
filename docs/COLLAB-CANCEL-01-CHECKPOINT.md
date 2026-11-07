# COLLAB-CANCEL-01 — Checkpoint

**Task:** COLLAB-CANCEL-01 — Cancel a collaboration run from the Team page
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md (the built Team page is gated, active development).
**Source:** registered by GOV-COLLAB-PLAN-01; Keith chose it on 2026-11-07 after two waiting runs blocked STAGING-DEPLOY-16, approved the drafted scope and admitted it.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | by GOV-COLLAB-PLAN-01 (2026-11-05) | earlier record |
| Admission | Lane 1 with GATEWAY, FRONTEND and I18N; validator PASS | 83aed62d1f583eb0c7eac2d325bf844905c6ea16 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- services/api-gateway/src/orchestration/collaboration.controller.ts: POST /api/collaboration/runs/:id/cancel (200) behind the class guard, assertEntitled and requireOwnedRun like reject; a run that is not active is refused with 409 before the service is called; an optional reason (stored as omitted when absent, COLLABORATION_OMITTED_CANCEL_REASON); it calls the existing cancelCollaboration and returns { collaborationRunId, status }. orchestration.service.ts is unchanged: it cancels every waiting, approved or running hand-off (a running one gets requestCancel) and sets the run cancelled with an audit event.
- collaboration.controller.spec.ts: five tests: owner cancel with a reason, omitted reason, 409 for a completed run, 404 for another user's run, 403 without the harness entitlement; the service is not called in the refused cases.
- frontend/components/collaboration/collaboration-page.tsx and collaboration-view.tsx: an active run shows Cancel run (XCircleIcon, the reject-confirm style); one confirm line with Confirm cancel and Keep run, disabled while deciding; confirm POSTs to the route through the single-flight runDecision, a refusal shows the existing refusal notice, success refreshes the run and the list. The existing collaborationRunIsActive helper decides when the button shows; logic.ts unchanged.
- frontend/lib/collaboration.test.ts: four tests: the button only on an active run; confirm sends one POST and refreshes; a refused cancel shows the notice; Keep run sends nothing; plus the locale keys.
- frontend/messages: collaboration.cancelRun (Cancel run / 取消這次執行 / 取消这次运行), cancelRunPrompt (Cancel this run? Waiting and running steps stop. / 要取消這次執行嗎？等待中和進行中的步驟會停止。 / 要取消这次运行吗？等待中和进行中的步骤会停止。), cancelRunConfirm (Confirm cancel / 確認取消 / 确认取消), cancelRunKeep (Keep run / 保留這次執行 / 保留这次运行); the existing statusCancelled label is used.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway npm test -- --runInBand | 203 suites passed, 2 skipped, 1 failed; 2800 passed, 7 skipped, 14 failed, all in smoke.integration.spec.ts (baseline BIZ-03: 2795 passed, the same 14 known runtime-only failures; five new tests). Jest printed the summary and then did not exit (the known Redis retry hang); the 1500-second timeout ended it; no Jest process was left |
| api-gateway npm run build | exit 0 |
| frontend npm test | 884 passed, 0 failed (baseline 880; four new tests) |
| npx tsc --noEmit | exit 0 |
| npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 8 files changed (441 lines added, 2 removed), all in the write set; orchestration.service.ts, guards and internal routes unchanged |

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-CANCEL-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2381 | `7492afc55c8ef801731c08d105747348941afdb7beb26bb4f102c2e10f1a3894` |
| `brief-impl.txt` | 11648 | `f0b9cba076a0886df307c9522f90179d321c66b05c8a99228b83b14a6216e251` |
| `cursor-admission-result.json` | 3670 | `58aaa10279caca5a071396894864696274900a43282397da0f14e84b52e7b186` |
| `cursor-impl-result.json` | 6921 | `e56ff41967478340a6f7595c855ca148488063febb015d7ef3cf44b1713d9377` |
| `reviewer-gates.out` | 222 | `2521b25a020aab06f786cee593af063c1f5baaa19bd336ed664c5c66dcd03be1` |

## Acceptance criteria

All eight met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started), UI 9/9 (1 and 2: four new keys in en, zh-TW and zh-CN, real Chinese, tested, I18N held; 3: XCircleIcon from Heroicons v2 outline; 4: the worker read Impeccable and Emil Kowalski, copied the reject confirm, no motion; 5: DESIGN.md button-danger-quiet and the quiet dismiss button; 6: active, confirming, refused and cancelled states covered by tests with translated text; 7: no redesign, routing change or dependency, the backend change is the approved route; 8: existing test IDs kept, three new ones; 9: covered by tests; the staging check follows the deploy), BACKEND 6/6 (1 and 2: the class guard, entitlement and owner check reused, no auth, guard or internal route change; 3: no generated-app template touched; 4: HARNESS_ENTITLEMENT_PROOF_V1 unchanged; 5: n/a, no entity or schema change; 6: gates compared with BIZ-03)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: STAGING-DEPLOY-17, the deploy, OPTIONAL as the control-plane default)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED. Not deployed; staging runs 66efb5c.
