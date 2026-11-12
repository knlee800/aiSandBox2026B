# CM-DEPS-01 — Checkpoint

**Task:** CM-DEPS-01 — Remove container-manager's unused jsonwebtoken packages
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CODE-TIDY-01 split. Admitted by the control plane on Keith's "Keep working".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 2 with PACKAGE and CONTAINER-MANAGER (with CM-DIFF-NOTICE-01 in Lane 1) | ba34feb |
| 2. Implementation | the control plane itself, in worktree lane/CM-DEPS-01 without node_modules links, fast-forwarded onto main | 78ce9e1 |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **`services/container-manager/package.json`:** `jsonwebtoken` and `@types/jsonwebtoken` are removed. No file under `services/container-manager` imports them. They were unused since PreviewsController was removed.
- **`package-lock.json` (the root lockfile; the repository uses npm workspaces):** only the two entries in the container-manager workspace block are removed. The lockfile was updated with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` in a worktree without node_modules, which printed "up to date".
  - The `jsonwebtoken` package itself stays, because other packages still need it: `@nestjs/jwt`, `passport-jwt`, `jwks-rsa` and `@nicokaiser/passport-apple`.
  - `@types/jsonwebtoken` stays because `@types/passport-jwt` needs it.
  - The diff is 4 removed lines in total.
- **The main checkout's node_modules** is not touched.

## Gates

| Gate | Result |
|---|---|
| container-manager `npm test` (worktree, node_modules linked from main) | 21 suites, 886 passed, 3 skipped |
| container-manager `npm run build` | exit 0 |
| JSON valid | package.json parses |
| line endings | both files LF (i/lf w/lf) |

## Limits

- **Not deployed.** It goes out with STAGING-DEPLOY-POLISH-01, which deploys main with any later locked work. The deploy's normal build checks cover it.
- **An empty folder is left:** `C:\Users\knlee\aisb-worktrees\CM-DEPS-01`. Git removed the worktree, but deleting the folder was refused while the control plane's shell was inside it. It is added to plan row 80b, the leftover files for Keith to delete.

CHECKLIST: EVERY 11/11 (3, 4: n/a, no worker, the control plane did it; 5: only package.json and the lockfile, under the PACKAGE lease, a removal and not a new dependency; 6: no behaviour change, gates rerun; 7: gates run by the control plane; 8: no runtime; 9: no artifact; 10: committed on the lane branch and fast-forwarded; 11: below), BACKEND 6/6 (1 to 5: no auth, guard, route, template, contract or schema change; 6: no new failures)
FOLLOWUPS: 0 registered / 1 superseded (the deploy, into STAGING-DEPLOY-POLISH-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 2 released EMPTY;
- PACKAGE and CONTAINER-MANAGER released UNOWNED;
- not deployed.
