# WORKFLOW-STATUS-03 — Checkpoint

**Task:** WORKFLOW-STATUS-03 — Workflow status follow-ups: the 409 code in the save hook, the port binding (the draft card body dropped)
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the WORKFLOW-STATUS-02 LOCK. Admitted 2026-11-10 (7354dbe) for items 1 and 2. Item 3, a distinct draft card body, was dropped by Keith ("Keep as is") and is listed in Dropped follow-ups.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY and FRONTEND | 7354dbe |
| 2. Implementation | opus subagent (Opus 5.5: item 2 rewires injection between two gateway modules) in worktree lane/WORKFLOW-STATUS-03, fast-forwarded onto main | d2e4da8 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Item 1: the save hook passes the 409 code.**
- `saveUserAgentRequest` in `frontend/hooks/useUserAgents.ts` now returns `{ error, code }` on a 409 that carries a string code, in the same shape as a 400. A 409 without a code stays the generic failure.
- The dashboard already passes `code` on, and the panel already turns `WORKFLOW_NOT_TESTED` into the "Run a test first" alert. So a refused switch-on now shows that alert at once, with no generic error first.

**Item 2: OrchestrationModule binds the switch-on check.** It replaces WORKFLOW-STATUS-02's `ModuleRef.get(…, { strict: false })` lookup.
- `CollaborationWorkflowService` already injects `UserAgentService`, so injecting the real check into `UserAgentService` would make a provider cycle.
- Instead, UserAgentModule owns a `UserWorkflowSwitchOnSlot` (the port token is `useExisting` of it) and exports it. The slot refuses every switch-on with 503 until a check is bound, and refuses a second, different binding.
- OrchestrationModule, which already imports UserAgentModule, provides `TestedWorkflowSwitchOnCheck`. The check is injected with `CollaborationWorkflowService` and the slot, and binds itself in `onModuleInit`.
- Provider and module graphs have no cycle, and `forwardRef` is not used. `orchestration.service.ts`, `collaboration-workflow.ts` and `UserAgentService` are unchanged, and the frozen-path diff is empty.

**Tests.**
- The two-module production-wiring test now uses UserAgentModule's real metadata and calls `app.init()`. It shows a 409, a refusal when only another owner ran the test, and then an allow after the owner's own test run.
- A new test shows the user-agent module on its own refuses with 503 and saves nothing.
- The pins for the old lookup were replaced by six tests of the slot and the binding.
- The hook has 2 new tests (a 409 with and without a code).

Files (7): `frontend/hooks/useUserAgents.ts` and its test; `services/api-gateway/src/orchestration/orchestration.module.ts`; `user-agent/user-agent.module.ts`, `user-workflow-switch-on.port.ts`, `user-workflow-switch-on.ts` and its spec.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3404 passed (3401 + 3 net), 7 skipped, 14 failed; the 14 are the known smoke.integration failures |
| gateway `npm run build` | exit 0 |
| ai-service `npx jest --runInBand` | 1296 passed, 1 skipped, 0 failed |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1535 passed (1533 + 2), 0 failed |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| line endings | the 7 files are LF in this checkout |

## Limits

Not deployed. At the next deploy:
- **The host checks** that the gateway starts. A missing binding would make every switch-on answer 503; the wiring test shows the binding in a production-shaped app.
- **Keith's live check:**
  - on a stale panel, a refused switch-on shows "Run a test first" at once;
  - switching on stays refused until a test run, and is allowed after one.

CHECKLIST: EVERY 11/11, UI 9/9 (1, 2: no new strings, I18N not held; 3, 4, 5: n/a, no component or visual change, only the hook's error mapping; 9: the live check above), BACKEND 6/6 (1: no auth, guard, cookie or CSRF change; 2, 3: n/a; 4: frozen-path diff empty; 5: n/a, no schema change; 6: only the 14 known smoke failures)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed. Keith dropped item 3 at admission; it is recorded in Dropped follow-ups.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. GATEWAY and FRONTEND are released UNOWNED.
