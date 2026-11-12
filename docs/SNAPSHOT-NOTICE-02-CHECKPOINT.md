# SNAPSHOT-NOTICE-02 — Checkpoint

**Task:** SNAPSHOT-NOTICE-02 — Clear the not-restored files notice when the user switches session
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the SNAPSHOT-NOTICE-01 LOCK. Admitted by the control plane on Keith's "Yes, keep going".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with FRONTEND: `page.tsx` and `workspace-shell.test.tsx` | b6d41d6 |
| 1. Implementation | sonnet subagent (Sonnet 5.5: one frontend file plus tests, no copy, auth or contract change) in worktree lane/SNAPSHOT-NOTICE-02, fast-forwarded onto main | 60653e0 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **State tied to a session:** in `page.tsx`, the notice state is now `{ sessionId, paths }`. The shell gets the paths only when that session id is the selected one; otherwise it gets a shared empty list. An effect on `selectedSessionId` drops the paths when the session differs, so switching away and back does not bring the notice back.
- **Who sets it:**
  - the four project-open flows set the paths for `openSessionId`;
  - the manual restore sets them for the selected session;
  - dismiss clears them.
- **Order checked by the control plane:** in all four open flows, the paths are set and then `setSelectedSessionId(openSessionId)` runs in the same synchronous block, before the first `await`. React batches the two, so the effect sees a matching id and keeps the paths.
- **Unchanged:** the notice component, its copy and the message files.

**Tests:** in `workspace-shell.test.tsx`:
- the SNAPSHOT-NOTICE-01 page test now expects the two-argument calls;
- a new source-assertion test checks the session-tagged state, the derived value, the clearing effect, and that each open flow sets the paths for `openSessionId` right before it selects that session.

These are source assertions. The clearing itself is checked live in STAGING-DEPLOY-SNAP-05.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | same tree after the fast-forward |
| frontend `npm test` | 1672 of 1672 passed (1671 + 1) | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| diff scope | the two write-set files | — |
| line endings | LF | LF |

## Limits

- **Not deployed, and not checked live.** Its deploy is STAGING-DEPLOY-SNAP-05. The live check there:
  1. In CL2 test, restore the "big test" version, and the notice appears.
  2. Switch to another session, and the notice is gone.
  3. Switch back, and it stays gone.
  4. Then restore "clean".
- **Skills:** the worker did not open the Impeccable and Emil Kowalski skills. The change is state logic with no visual change. The worker also said DESIGN-DOC-01 has not locked, while the SNAPSHOT-NOTICE-01 worker found it locked. Either way the item is n/a, because nothing visual changed.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, fast-forwarded by the control plane), UI 8/9 (1 and 2: no copy or message-file change; 3: no icon change; 4 and 5: n/a, state logic only with no visual change; 6: the notice states are unchanged; 7: no redesign; 8: test ids kept; 9: not met yet, the live check is in STAGING-DEPLOY-SNAP-05)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-SNAP-05) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND released UNOWNED;
- not deployed.
