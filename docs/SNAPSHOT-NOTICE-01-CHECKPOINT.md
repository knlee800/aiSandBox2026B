# SNAPSHOT-NOTICE-01 — Checkpoint

**Task:** SNAPSHOT-NOTICE-01 — Tell the user which files were not restored
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the SNAPSHOT-BINARY-01 LOCK. Admitted by the control plane under Keith's 2026-11-10 keep-going instruction.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 1 with GATEWAY, FRONTEND and I18N; exact write set | 7597a59 |
| 2. Implementation | opus subagent (Opus 5.5: a response shape across the gateway and the frontend, plus translated UI copy) in worktree lane/SNAPSHOT-NOTICE-01, fast-forwarded onto main | dc86371 |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Gateway**
- `ProjectsService.openProjectIntoSession` and `ProjectsController` add `failedPaths: string[]` to the open response. It is the list from `restoreSnapshot`. It is `[]` when:
  - no snapshot is restored;
  - a run is active;
  - the field is missing;
  - the restore threw a 5xx and the open continued.
- `POST /api/sessions/:id/restore` returns `{ ...result, failedPaths }`, always as an array.
- Every existing field and path is unchanged:
  - `restoredSnapshotId`, the SNAPSHOT-PICK-01 choice, the history restore and the 4xx rethrow;
  - the guards, the ownership 404, the 410 and the 409 `run_active`.

**Frontend**
- `normalizeRestoreFailedPaths` turns a missing or malformed field, as from an older gateway, into `[]`. It is used by:
  - `openWorkspaceProject`;
  - `restoreWorkspaceSnapshot`, whose result `{ kind: 'restored' }` now carries `failedPaths`;
  - `openProjectInFreshSession`.
- `page.tsx` keeps the list in state from all four project-open call sites and the manual restore, and passes it to the shell.

**The notice:** `WorkspaceRestoreFailedNotice` in `workspace-shell.tsx`, shown under the project header.
- It uses the DESIGN.md amber warning style, `role="status"`, and Heroicons v2 Outline icons (`InformationCircleIcon`, `XMarkIcon`).
- It names up to 5 paths, then "and N more". It can be dismissed, does not block work, and renders nothing for an empty list.
- New test ids: `workspace-restore-failed-notice`, `-text` and `-dismiss`. Existing ids are kept.

**Text** (keys under `workspace.`):

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `restoreFailedNotice` | Some files could not be restored: {files}. They may be too large. Add them again and save. | 部分檔案無法還原：{files}。檔案可能太大，請重新加入後再儲存。 | 部分文件无法恢复：{files}。文件可能过大，请重新添加后再保存。 |
| `restoreFailedMore` | {files} and {count} more | {files}，以及另外 {count} 個檔案 | {files}，以及另外 {count} 个文件 |
| `restoreFailedSeparator` | ", " | 、 | 、 |
| `restoreFailedDismiss` | Dismiss | 關閉 | 关闭 |

**Tests:**
- 6 new in the gateway: 4 in `projects.service.spec` and 2 in `session.controller.spec`.
- 14 new in the frontend: the logic passthroughs and defaults; keys present and really translated; formatting and "N more" in all three languages; rendering in en, zh-TW and zh-CN; nothing shown when empty; the page wiring.
- Exact-equality assertions that only gained the new field were updated: 9 in `projects.service.spec`, 4 in `session.controller.spec`, 5 in `open-project-in-fresh-session.test`, and one each in the controller, snapshots and projects logic tests.

**Skills:**
- Impeccable: reused DESIGN.md's warning notice rather than a new component; short, calm copy with no em dashes; not a modal; text wraps for long paths and longer Chinese text.
- Emil Kowalski: no animation, on purpose, for a static informational notice; a real dismiss button with a visible focus ring.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 3814 passed (3808 + 6), 7 skipped, plus the 14 known `smoke.integration` failures (1 suite) | same tree after the fast-forward |
| api-gateway `npm run build` | exit 0 | — |
| frontend `npx tsc --noEmit` | exit 0 | exit 0 |
| frontend `npm test` | 1671 of 1671 passed (1657 + 14) | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| diff scope | 18 files, all in the write set (`page.tsx` only under `frontend/app/`) | — |
| line endings | all 18 LF | LF |

## Limits

- **Not deployed, and not checked live.** Its deploy and Keith's browser check are STAGING-DEPLOY-SNAP-04.
  - Since SNAPSHOT-SIZE-01 and CM-BODY-KEY-01, a file fails to restore only when its base64 body is over 16 MB, which is about 12 MB of binary. The live check therefore makes a 13 MB file with one command, saves a version, then stops and reopens.
- **The notice stays up on a session switch.** It is not cleared when the user switches to another session without opening a project; the user can dismiss it. Registered as SNAPSHOT-NOTICE-02.
- **Older hardcoded English** in `page.tsx` status messages, such as "Project opened." and "Workspace snapshot restored.", came before this task and was not touched. Registered as PAGE-STATUS-I18N-01.
- **Stray files** that the worker could not delete: `notice-tests.tsx`, `append_tests.py` and three gate logs, in the session scratchpad folder `notice-worker`. They are temporary files outside the repository.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 9: tsbuildinfo restored on the branch and on main; 10: worker committed only on its branch, fast-forwarded by the control plane; 11: dispositions below), BACKEND 6/6 (1 and 2: no guard, auth or internal route change; 3: no template; 4: no frozen contract, and the response only gains a field; 5: no schema change; 6: only the 14 known smoke failures), UI 8/9 (1 and 2: keys in all three files under the I18N lease, with real translations tested; 3: Heroicons v2 Outline; 4: both skills read and applied as above; 5: DESIGN.md warning style; 6: the empty state renders nothing and the non-empty state has translated text, both tested, with no loading or failed state; 7: no redesign, routing or dependency; 8: test ids kept; 9: not met yet, the live check is in STAGING-DEPLOY-SNAP-04), FLOWS 4/4 (checkpoint creation, listing and revert, the history restore order and the file-action flow are unchanged)
FOLLOWUPS: 3 registered (STAGING-DEPLOY-SNAP-04 with Keith's live check; SNAPSHOT-NOTICE-02; PAGE-STATUS-I18N-01) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY, FRONTEND and I18N released UNOWNED;
- not deployed. The live check is STAGING-DEPLOY-SNAP-04's acceptance.
