# COS-EVAL-DRIFT-01 — Checkpoint

**Task:** COS-EVAL-DRIFT-01 — Fix the ai-service briefing drift test after the start code moved
**Status:** COMPLETE AND LOCKED — 2026-11-15.
**Workstream:** AGENT. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** AI-SERVICE (Lane 2, beside TRIGGER-EVENT-01 slice S2 in Lane 1; no shared file or mutex).
**Source:** the TRIGGER-EVENT-01 slice S1 worker saw the failure on main; the control plane confirmed it. Registered and admitted together (GOV-OS-04) in 4ca3586, as a broken gate on main.

## The problem

The test "the project instructions follow the gateway collaboration brief" in `services/ai-service/src/agent-harness/eval/briefing-drift.spec.ts` read the Team page's start code from `collaboration.controller.ts` `startRun`. CHAT-DISCORD-01 slice C1 (fff407cd) moved that code into `CollaborationStartService.start` (`collaboration-start.service.ts`), so the test failed on main: ai-service 1380 passed, 1 failed, 1 skipped at 265256d.

**A correction of fact:** the CHAT-DISCORD-01 checkpoint records ai-service at "1381 passed, 1 skipped". That was not true on main after C1. The locked checkpoint is not edited; this record and the backlog carry the correction.

## The change (920d1e7, sonnet subagent: one test file in one service; fast-forwarded)

```diff
@@ -259,8 +259,15 @@
       path.join(GATEWAY_SRC, 'orchestration', 'collaboration.controller.ts'),
       'utf8',
     );
+    // The controller delegates to the start service, where the start code lives.
     const startRun = controller.slice(controller.indexOf('async startRun('));
-    const createCall = startRun.slice(0, startRun.indexOf('fileAccess: true'));
+    expect(startRun).toContain('this.starter.start(');
+    const starter = fs.readFileSync(
+      path.join(GATEWAY_SRC, 'orchestration', 'collaboration-start.service.ts'),
+      'utf8',
+    );
+    const start = starter.slice(starter.indexOf('async start('));
+    const createCall = start.slice(0, start.indexOf('fileAccess: true'));
     expect(createCall).toContain('createPendingReferral({');
```

Every other assertion in the test is unchanged. The new controller check makes a future move of the code fail at the delegation.

## Gates (rerun by the control plane on the branch)

| Gate | Result |
|---|---|
| ai-service `npx jest` | 66 of 66 suites; 1381 passed, 0 failed, 1 skipped (was 1380 passed, 1 failed) |
| ai-service `npm run build` | rc 0; no tracked artifact changed |
| Files | only `briefing-drift.spec.ts` (8 insertions, 1 deletion), LF |

CHECKLIST: EVERY 11/11 (1: registered and admitted 4ca3586; 2: 2-step; 3: sonnet named before the dispatch; 4: self-contained brief, no further subagent; 5: one file; 6: the change is a test; 7: gates rerun by the control plane; 8: no runtime; 9: no artifact changed; 10: worktree and fast-forward by the control plane; 11: FOLLOWUPS line)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane. Lane 2 released EMPTY and AI-SERVICE released UNOWNED; Lane 1 still holds TRIGGER-EVENT-01 slice S2.
