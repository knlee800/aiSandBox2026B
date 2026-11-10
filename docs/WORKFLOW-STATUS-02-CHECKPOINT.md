# WORKFLOW-STATUS-02 — Checkpoint

**Task:** WORKFLOW-STATUS-02 — Workflow switch-on checked by the server; a distinct Draft badge
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the WORKFLOW-CREATE-01 LOCK. Admitted 2026-11-10 (ebb4887) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY, FRONTEND and I18N; write set includes frontend/lib/agent-platform/ | ebb4887 |
| 2. Implementation | opus subagent (Opus 5.5: the switch-on check needs the orchestration tested-version rule, with a module-cycle risk) in worktree lane/WORKFLOW-STATUS-02 (c97fbaa6), cherry-picked onto main | a63be7d |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

The admission's records were written twice. A transient Windows write error (Errno 22) failed the first run after TASKS.md was written. TASKS.md was restored from Git, the record script was changed to write through a temporary file with retries, and the second run passed the validator. Nothing half-written was committed.

## Change

**The server checks a switch-on.** `PATCH /api/agents/:id` is checked when it sends `status: 'active'` for a row that is not already active. The check runs on the row as it will be saved, and uses the Team start gate's own functions: `renderWorkflow` for the version, `CollaborationWorkflowService.usageFor` for the tested versions, and `workflowNormalRunAllowed`.

| PATCH | Result |
|---|---|
| to active, untested (draft, disabled or unknown status) | 409 `WORKFLOW_NOT_TESTED`, nothing saved |
| to active, tested at the current version | 200 |
| to active, tested only at an older version, or with a spec edit in the same PATCH | 409 `WORKFLOW_NOT_TESTED` |
| to active with a name, role or description edit (version unchanged, tested) | 200 |
| to active on a row that cannot render | 409 `WORKFLOW_INVALID` |
| off, to draft, same status, active to active, no status | 200, not checked |
| an invalid field together with active | 400 first |
| another owner's row | 404 first |

Every `user_agents` row counts as a workflow, which matches the Team gate. A plain three-field agent renders an empty spec, can test-run, and follows the same rule.

**No module cycle.**
- `UserAgentService` injects a port, `USER_WORKFLOW_SWITCH_ON_CHECK`, from a file with no orchestration import.
- `UserAgentModule` binds the port to `TestedWorkflowSwitchOnCheck`. That class takes the application's single `CollaborationWorkflowService` through `ModuleRef.get(…, { strict: false })` at call time, and caches it.
- If the service cannot be found, switching on fails closed with 503.
- UserAgentModule does not import OrchestrationModule, `forwardRef` is not used, and nothing under orchestration/ changed.
- A test wires two modules the way production does and shows the lookup resolves.

**Draft badge.** `AgentStatus` gains `draft`; the system-agent payload parser still rejects it. `getStatusBadgeClasses` is now an exhaustive switch. Draft uses DESIGN.md's amber badge tokens with a Heroicons v2 Outline PencilSquareIcon, so it does not rely on color alone; Offline stays gray and Active emerald. The labels reuse the existing keys (Draft, 草稿, 草稿), so no message file changed. New test ID: `agent-station-status-<id>`.

**The panel shows the refusal.** A refused switch-on reloads the summaries. When the code is `WORKFLOW_NOT_TESTED`, or the reload says untested, the existing "Run a test first" line with Open on Team becomes the alert.

Files (14):
- **Gateway, `user-agent/`:** the port and the check (new) and their spec, plus the service, the module and their specs.
- **Frontend:** `components/platform/` (station card, workflow summary, dashboard, with tests) and `lib/agent-platform/agent-registry.ts` with its test.

The worker read Impeccable, the Emil Kowalski skill and DESIGN.md, and applied the badge tokens, an icon alongside the color, no motion, and the reused hint line.

## Gates (control-plane rerun on main after the cherry-pick)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3401 passed (3373 + 28 new), 7 skipped, 14 failed; the 14 are the known smoke.integration failures |
| gateway `npm run build` | exit 0 |
| ai-service `npx jest --runInBand` | 1296 passed, 1 skipped, 0 failed |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1533 passed (1520 + 13 new), 0 failed |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| line endings | the 14 files are LF in this checkout |

## Limits

Not deployed. Keith's live check at the next deploy:
1. A new or copied workflow's card shows the amber Draft badge with the pencil, distinct from Offline, in three languages.
2. The panel switch stays off-limits until a test run passes, then turns on.
3. A stale panel (the workflow edited elsewhere) shows "Run a test first" as the alert when the switch-on is refused.

CHECKLIST: EVERY 11/11, UI 9/9 (1: no new strings, existing keys reused and tested; 2: I18N held, not used; 9: the live check above), BACKEND 6/6 (1: no auth, guard, cookie or CSRF change; 3: n/a, no generated-app templates; 5: n/a, no schema change; 6: only the 14 known smoke failures)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed. Registered: WORKFLOW-STATUS-03 (NOT_READY), which holds:
1. `frontend/hooks/useUserAgents.ts` passes the server's `code` only on a 400, so a 409 refusal shows the generic error until the summary reload; pass it on for a 409 too.
2. Optional cleanup: OrchestrationModule could bind the switch-on port as a provider instead of the `ModuleRef` lookup.
3. A design question for Keith: whether a draft card's body should look different from an off card's.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. GATEWAY, FRONTEND and I18N are released UNOWNED.
