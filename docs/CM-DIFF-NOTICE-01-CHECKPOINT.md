# CM-DIFF-NOTICE-01 — Checkpoint

**Task:** CM-DIFF-NOTICE-01 — Show when a checkpoint diff was cut
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-DIFF-CAP-01 LOCK. Admitted by the control plane on Keith's "Keep working".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 1 with GATEWAY, FRONTEND and I18N; exact write set (with CM-DEPS-01 in Lane 2) | ba34feb |
| 2. Implementation | opus subagent (Opus 5.5: a response field across the gateway and the frontend, with translated copy) in worktree lane/CM-DIFF-NOTICE-01 as ead4462; main had moved, so the control plane cherry-picked it | 3add40d |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **Gateway:** `CheckpointsService.getCheckpointDiff` passes `truncated: true` through only when container-manager cut the diff (CM-DIFF-CAP-01). It adds `diffLimitBytes` when that is a positive finite number.
  - A whole diff keeps its old shape, without either field.
  - `DiffResponseDto` gains the two optional fields.
  - The control plane checked that the container-manager client returns `response.data` unchanged, so the fields arrive. Its `GitDiffResult` type does not name them yet, so the service reads them as unknown and checks them.
  - Routes, guards and ownership checks are unchanged.
- **Frontend:**
  - `workspace-checkpoint-diff.logic.ts` reads the two fields (absent means whole) and formats the limit, for example 8388608 as "8 MB".
  - The History diff view shows `HistoryCheckpointDiffTruncatedNotice`, with test id `history-diff-truncated-notice`, between the commit line and the file summary. It uses the DESIGN.md amber notice style, `role="status"` and an outline `InformationCircleIcon`.
  - The compare view uses the same viewer, so a cut compare shows the notice too.
- **Text** (`workspace.checkpointDiffTruncatedNotice`, plus a form without the size):
  - en: "This diff is too large to show in full. It stops at {size}, so the last files may be incomplete or missing."
  - zh-TW: 此差異太大，無法完整顯示。內容在 {size} 處截斷，最後的檔案可能不完整或未列出。
  - zh-CN: 此差异过大，无法完整显示。内容在 {size} 处截断，最后的文件可能不完整或未列出。
- **Unchanged:** checkpoint creation, listing and revert.

**Tests:**
- 5 in the gateway: cut, whole, false with a stray limit, an invalid limit, and a truthy value that is not `true`.
- 5 in the logic file.
- 7 in the shell: the keys and translations, the size format, the form without a size, rendering in en, zh-TW and zh-CN, and no notice when the diff is whole or not ready.

**Skills:** DESIGN.md's amber notice was followed. From Impeccable, the copy rules were applied, with no side stripe and no nested card. From Emil Kowalski, the calm informational tone was applied, and there is no motion.

## Gates

| Gate | Branch (control-plane rerun) | main after the cherry-pick |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 3870 passed (3865 + 5), 7 skipped, plus the 14 known `smoke.integration` failures | `src/checkpoints`: 4 suites, 55 passed |
| api-gateway `npm run build` | exit 0 | — |
| frontend `npx tsc --noEmit` | exit 0 | — |
| frontend `npm test` | 1812 of 1812 passed (1800 + 12) | — |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| line endings | the 10 files are LF | 10 of 10 LF |

## Limits

- **Not deployed, and not checked live.** It goes out with STAGING-DEPLOY-POLISH-01. A real end-to-end check would need an 8 MiB commit. The rendering is proven by server-render tests.
- **Still open,** all registered as one optional task, CM-DIFF-NOTICE-02:
  - the History snapshot viewer reads the same endpoint, but shows no notice;
  - a cut diff with no complete file shows "No diff changes" and hides the notice;
  - the client type `GitDiffResult` could name the two fields;
  - the separate working-tree diff's `truncated` flag is not surfaced.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false), BACKEND 6/6 (1 and 2: no guard or route change; 3: no template; 4: additive optional fields, no frozen contract; 5: no schema; 6: only the 14 known smoke failures), UI 9/9 (1 and 2: keys in all three files under the I18N lease with real translations; 3: Heroicons outline; 4: skills applied as above; 5: DESIGN.md amber notice; 6: cut with a size, cut without a size, whole, not ready; 7: no redesign; 8: test ids kept; 9: server-render tests; the live end-to-end check is impractical), FLOWS 4/4 (read-only diff; creation, listing, revert and file actions unchanged)
FOLLOWUPS: 1 registered (CM-DIFF-NOTICE-02) / 4 superseded (the snapshot viewer notice, the empty cut case, the client type and the working-tree diff, into CM-DIFF-NOTICE-02; the deploy into STAGING-DEPLOY-POLISH-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY, FRONTEND and I18N released UNOWNED;
- not deployed.
