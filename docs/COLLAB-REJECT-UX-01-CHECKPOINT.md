# COLLAB-REJECT-UX-01 — Checkpoint

**Task:** COLLAB-REJECT-UX-01 — The Team page Reject is clear and cannot be half-done
**Status:** COMPLETE AND LOCKED — 2026-11-08
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md (the built Team page is gated, active development).
**Source:** Keith's finding during STAGING-DEPLOY-16 (Reject only opened the reason box; the rejection saved on a second button); registered 2026-11-07; Keith approved the drafted scope and admitted it on 2026-11-08.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | from Keith's STAGING-DEPLOY-16 finding (2026-11-07) | 56bca11 |
| Admission | Lane 1 with FRONTEND and I18N; validator PASS | 4da55cbbf82ceb55ee2806ee090c574561b70c59 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- frontend/components/collaboration/collaboration-view.tsx: while a waiting hand-off is in reject mode its Approve and Reject buttons are not shown; a line "Reject this step? Its work will not be used." sits above the Reason (optional) box; the reason box takes focus (autoFocus); Enter in it confirms exactly as the button does, not while deciding and not during IME composition; the confirm button Reject this step is solid red (bg-red-600, text-white, hover:bg-red-700, XMarkIcon kept); the back button reads Don't reject. A run that ended after a rejection shows "This run ended after a rejection." (data-testid collaboration-run-ended-by-reject, muted text) in the chain section. The reject request and its body are unchanged ({ reason } or {}).
- frontend/components/collaboration/collaboration-page.tsx: passes runEndedByReject from the open run's status and its hand-off statuses, and the two new labels.
- frontend/lib/collaboration/logic.ts: collaborationRunEndedByReject(runStatus, handoffStatuses): true when the run is failed, at least one hand-off is rejected and none is failed or timed_out (mirrors the gateway rule that a run with only rejected hand-offs ends failed).
- frontend/lib/collaboration.test.ts: seven tests: reject mode hides Approve for that hand-off only and shows the prompt; focus on the reason box; Don't reject sends nothing and shows Approve again; Enter during IME composition sends nothing; Enter with a reason sends one POST with { reason }, a second Enter in flight sends nothing, success refreshes and shows the ended line; Enter with no reason sends {}; the helper cases and the ended line shown or hidden; locale keys.
- frontend/messages: collaboration.rejectPrompt (Reject this step? Its work will not be used. / 要拒絕這一步嗎？這一步的結果不會被採用。 / 要拒绝这一步吗？这一步的结果不会被采用。), runEndedByReject (This run ended after a rejection. / 這次執行在拒絕後結束了。 / 这次运行在拒绝后结束了。); cancelReject changed from Cancel / 取消 / 取消 to Don't reject / 不要拒絕 / 不要拒绝.
- No gateway, API, guard or route change.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend npm test | 891 passed, 0 failed, 0 skipped (baseline COLLAB-CANCEL-01: 884; seven new tests) |
| npx tsc --noEmit | exit 0 |
| npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 7 files changed (491 lines added, 35 removed), all in the write set; the Approve and Reject buttons moved into the not-rejecting branch with their data-testids and handlers unchanged |
| Gateway | not run: no gateway file changed |

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-REJECT-UX-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2345 | `a0848d1a6927196ee95d8678e74ca781385077f1b045cbe3b052922d5a012768` |
| `brief-impl.txt` | 10994 | `90d57e698014d280058851dda9295bb7000337be851edfcb6c74442d52a8bbaa` |
| `cursor-admission-result.json` | 3029 | `675add567b14572da560ca6f2765f0b234fc496ddba68e164bf0affdb032da75` |
| `cursor-impl-result.json` | 6639 | `5f1e08a714b4ec830d509cdb7da9c331b18821410419cc32482ee53f12b44b12` |
| `reviewer-gates.out` | 65 | `3fa96bf3b8f3558e79312d7f1fbf29cf93f4f2cf5372be527608d01622484514` |

## Acceptance criteria

All seven met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started), UI 9/9 (1 and 2: two new keys and one changed value in en, zh-TW and zh-CN, real Chinese, tested, I18N held; 3: XMarkIcon kept, Heroicons v2 outline, no new icon; 4: the worker read Impeccable and Emil Kowalski, kept sizes and styles, no motion; 5: DESIGN.md solid danger button colors and the muted text style; 6: waiting, rejecting, in flight, refused (existing notice) and ended states covered by tests with translated text; 7: no redesign, routing change, backend change or dependency; 8: existing test IDs kept, one new one; 9: covered by tests; the staging check follows the deploy), FLOWS 4/4 (1 and 2: n/a, no checkpoint or revert change; 3: the approval gate and AI file-action flow unchanged, reject still sends the same request and Approve is unchanged; 4: no direct DOM rollback, workspace mutation or auto-apply)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: STAGING-DEPLOY-18, the deploy, OPTIONAL as the control-plane default)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. Not deployed; staging runs e28e4a7.
