# COLLAB-EDIT-01 — Checkpoint

**Task:** COLLAB-EDIT-01 — Edit a waiting hand-off's task on the Team page, and the coding lead hands the writer a numbered plan
**Status:** COMPLETE AND LOCKED — 2026-11-08
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md (the built Team page is gated, active development).
**Source:** registered in TASKS_BACKLOG_FULL.md; scope drafted by the control plane, including the numbered-plan rule for the lead; admitted on 2026-11-08 after Keith's approval.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with GATEWAY, FRONTEND and I18N; write set amended in the same commit to add orchestration.contracts.ts (the audit event type); validator PASS | f9de11e |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- services/api-gateway/src/orchestration/collaboration.controller.ts: POST /api/collaboration/runs/:id/referrals/:referralId/prompt (200). Same order as reject: entitlement check, owner check (another user's run answers 404), then the body: prompt must be a string, not empty after trim, at most MAX_HANDOFF_TASK_CHARS (4000), otherwise 400. Returns the hand-off in the same shape as reject.
- services/api-gateway/src/orchestration/orchestration.service.ts: updatePendingReferralPrompt answers 409 unless the hand-off is pending_approval with a pendingJob; it replaces only pendingJob.prompt (the rest kept) with a conditional update on status pending_approval, answers 409 if nothing was updated, and records the audit event orchestration.referral_prompt_edited with the prompt length but not its text. Approve, reject and cancel are unchanged; approve runs the stored, edited prompt.
- services/api-gateway/src/orchestration/orchestration.contracts.ts: the audit event type union adds orchestration.referral_prompt_edited.
- services/api-gateway/src/system-agents/system-agent-registry.ts: the coding lead's instructions add one sentence before "You cannot change files.": when it asks writer for a change, it puts a numbered plan in the hand-off, one line per file, naming the file and what changes in it. The lead's version hash changes to 0ab36f90...4fb46135; no other agent definition changes. The two specs that pin the text and hash are updated.
- services/api-gateway/src/orchestration/collaboration-edit-prompt.spec.ts (new) and collaboration.controller.spec.ts: entitlement, owner 404, body validation, 409 when not waiting or when the conditional update loses a race, only the prompt replaced, audit without prompt text, approve runs the edited prompt.
- frontend/components/collaboration/collaboration-view.tsx and collaboration-page.tsx: a waiting hand-off with a task has Edit task (PencilSquareIcon) after Reject. Editing hides Approve and Reject and shows a text box filled with the current task (autoFocus), Save task (disabled while saving or when empty) and Keep as is. Save posts { prompt } trimmed; success leaves edit mode and refreshes the run; a refusal shows the existing notice and stays in edit mode. Starting reject leaves edit mode and the reverse. New data-testids collaboration-edit-task, -input, -save and -keep; existing ones kept.
- frontend/lib/collaboration.test.ts: seven tests for the edit flow and the locale keys.
- frontend/messages: collaboration.editTask, editTaskLabel, saveTask, keepTask (Edit task / Task for this step / Save task / Keep as is; 編輯任務 / 這一步的任務 / 儲存任務 / 保持不變; 编辑任务 / 这一步的任务 / 保存任务 / 保持不变).
- frontend/lib/collaboration/logic.ts: in the write set, not needed, unchanged.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| gateway jest --runInBand | 204 suites passed, 2 skipped; 2813 tests passed, 7 skipped, 0 failed (baseline COLLAB-CANCEL-01: 2800 passed plus 14 known smoke.integration failures; 13 new tests). smoke.integration.spec.ts was left out of this run: it needs Redis, and without Redis it failed as known and its open connections kept Jest from exiting. |
| gateway npm run build | exit 0 |
| frontend npm test | 898 passed, 0 failed, 0 skipped (baseline COLLAB-REJECT-UX-01: 891; seven new tests) |
| npx tsc --noEmit | exit 0 |
| npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 14 files changed (1150 lines added, 8 removed), all in the write set |

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-EDIT-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2349 | `d859256526f69446b0a437d8ae185cc638aedc8a7b8d06c2d3a5b007aa362d33` |
| `brief-amend.txt` | 2586 | `8e4cb553635727e713d6c1babdbcca1191bbee797dedcd69dd84f15d93f99b60` |
| `brief-impl.txt` | 15752 | `b6f00a47bdc5f5169311a0557276db009a121580aba7358b27965e861a827ffa` |
| `cursor-admission-result.json` | 3297 | `a8977b35ca98d030a117779fd221a5485805c7ce64d6dc6abdc805b11503e1a0` |
| `cursor-amend-result.json` | 3102 | `4ef65be44541e7c4d2c7a77b593d19a17d7ed1e0b0d8260e9fdf858ea69140c5` |
| `cursor-impl-result.json` | 9050 | `48403bdc358b73a1fae0e3be09e25d8b316477bbfd1517612206e74af3271a06` |
| `reviewer-gates.out` | 295 | `a75d4220616f8547695f4fdc7932d578c6c2601a15d7c3f8b12632fe14862cce` |

## Acceptance criteria

All eight met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started), UI 9/9 (1 and 2: four new keys in en, zh-TW and zh-CN, real Chinese, tested, I18N held; 3: PencilSquareIcon, Heroicons v2 outline; 4: the worker read Impeccable and Emil Kowalski, kept existing sizes and button styles, no motion; 5: DESIGN.md primary button and text box styles; 6: waiting, editing, saving, refused (existing notice) and saved states covered by tests with translated text; 7: no redesign, routing change or dependency, the backend change is the admitted route; 8: existing test IDs kept, four new ones; 9: covered by tests, the staging check follows the deploy), FLOWS 4/4 (1 and 2: n/a, no checkpoint or revert change; 3: the approval gate is kept, an edit only changes the waiting task and the person still approves it, and the AI file-action flow is unchanged; 4: no direct DOM rollback, workspace mutation or auto-apply), BACKEND 6/6 (1: auth, cookies, CSRF and guards unchanged, the new route uses the existing guard, entitlement and owner checks; 2: no internal endpoint changed; 3: no generated-app template changed; 4: the hand-off response shape is unchanged and the audit type union is additive; 5: n/a, no entity or schema change, pendingJob is an existing JSON column; 6: compared with the COLLAB-CANCEL-01 gateway result, no new failure)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: STAGING-DEPLOY-19, the deploy, OPTIONAL as the control-plane default)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED. Not deployed; staging runs 563091f.
