# CM-CLEANUP-02 — Checkpoint

**Task:** CM-CLEANUP-02 — Remove the uncalled internal route DELETE /api/internal/sessions/:id/container
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the BROWSER-SMOKE-02 LOCK. Keith approved ("Yes, start it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 1 with CONTAINER-MANAGER; callers checked by the control plane; exact write set of 4 files | b2d4d55 |
| 2. Implementation | opus subagent (Opus 5.5: an internal route removal) in worktree lane/CM-CLEANUP-02; fast-forwarded | fea734a |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Callers

Nothing outside container-manager calls the route.
- **The gateway client:** it calls `DELETE /api/sessions/:id` and `DELETE /api/internal/sessions/:id/files`, never `/container`.
- **Searches:** the control plane and the worker each searched api-gateway, ai-service, the frontend and scripts, and found no caller.
- **The one match:** `services/api-gateway/src/preview/__tests__/preview.traversal.spec.ts` uses the path only as a traversal target. It is unchanged.
- **The method:** only the route called `SessionsService.removeSessionContainer`.

## Change

- **`internal-sessions.controller.ts`:** the `removeContainer` handler (`@Delete(':id/container')`) is removed, and a removal note is added. The other routes are unchanged; no guard, pipe or key handling changed.
- **`sessions.service.ts`:**
  - The public `removeSessionContainer` is removed.
  - The private `removeContainerForSession` stays, and stop, delete and the scheduled clean-up use it. Its doc now carries the old fail-fast text.
  - The session-ended hook keeps all its call sites: stop, delete, container lost, idle timeout and max lifetime. The comments no longer list the removed route.
- **Tests:**
  - **`internal-key.http.spec`:**
    - The inventory is 47 routes, 46 guarded, with 12 controllers and 26 session-id routes.
    - The removed route answers Express's 404 with the key (two ids) and without it.
    - No route ends in `/container`.
  - **`sessions.service.spec`:**
    - The `removeSessionContainer` listener test is replaced.
    - Delete calls the listeners once even when the removal fails.
    - Stop and delete each call them exactly once.
    - The method is gone.

## Gates (control-plane rerun on the branch; main fast-forwarded to the same commit)

| Gate | Result |
|---|---|
| container-manager `npm test` | 22 suites, 974 passed, 3 skipped, 0 failed (baseline 973) |
| container-manager `npm run build` | exit 0 |
| line endings | the 4 files are LF |
| tree after the gates | clean |

## Notes

- The worker saved its gate logs in the control-plane session's scratchpad, outside its worktree. These are temporary logs, not repository files.
- `git worktree remove` dropped the worktree, but could not delete the folder while a shell had it open. Deleting the rest was then refused for the control plane. `C:\Users\knlee\aisb-worktrees\CM-CLEANUP-02` holds only copied repository files, and no package links. It is listed for Keith in plan row 80b. The branch is deleted.

## Limits

- **Not deployed.** The deploy is STAGING-DEPLOY-CLEANUP-02.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: the 4 files of the write set, no new dependency; 7: gates rerun by the control plane; 8: no runtime; 9: no build artifact changed; 10: worker committed only on its branch, fast-forwarded by the control plane with autocrlf=false), BACKEND 6/6 (1: one uncalled internal route removed on Keith's yes, no guard or key change; 2: remaining internal routes keep their guard tests; 3: n/a, no template; 4: no frozen contract; 5: no schema change; 6: no new failures)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-CLEANUP-02) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- CONTAINER-MANAGER released UNOWNED;
- not deployed.
