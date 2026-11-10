# WORKFLOW-CREATE-01 — Checkpoint

**Task:** WORKFLOW-CREATE-01 — New workflows start off until tested; Role and Description explained
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the BIZ-LIVE-04 LOCK, from Keith's two findings in his live check. Admitted 2026-11-10 (33b1e40) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY, FRONTEND and I18N | 33b1e40 |
| 2. Implementation | opus subagent (Opus 5.5: the stored status of a new agent touches every status reader across gateway and frontend) in worktree lane/WORKFLOW-CREATE-01, fast-forwarded onto main | af13148 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Status.**
- Every new agent is stored as `draft` (`NEW_USER_AGENT_STATUS`). That covers the plain three-field create, the blank workflow create and the copy-from-template.
- The blank workflow and the three-field create send the same body, so one rule covers both.
- On create, a client-sent `status` is still shape-checked (an unknown value is a 400) and then ignored.
- Existing rows and the column default are unchanged; there is no migration. An edit that sends no status keeps an `active` row `active`.

Every reader of `user_agents.status` was checked, and none breaks:

| Reader | A draft |
|---|---|
| Team start (`prepareStart`) and approve (`assertCanApprove`) | test run allowed; normal run refused (not tested / not active) |
| Team page list and labels | "Draft"; Start locked with the draft hint |
| Dashboard card | the "Draft" label, using the disabled styling |
| Agent panel switch (BIZ-USER-01D) | Off; can be switched on after a test at the current version |
| Ask with an agent (`ai-execution.controller.ts`), Office, Builder, station counts | do not read status |

**Role and Description.**
- On a template copy, both are prefilled from the template's translated card text, using the system agent's `roleKey` and `descriptionKey`. Typed text is kept; an untouched prefill clears when the start choice changes.
- Under each field, in the plain create, the workflow create and the edit form, a hint now reads "Shown on the agent's card. Not part of the workflow's instructions." The inputs point at the hints with `aria-describedby`.
- zh-TW: 顯示在代理的卡片上，不屬於工作流程的指示。
- zh-CN: 显示在代理的卡片上，不属于工作流的指令。
- Both fields stay required, and the server checks are unchanged.

**A correction to the record.** BIZ-LIVE-04's finding 1 said, and the control plane told Keith in chat, that Role and Description are "display-only" and that "the AI never sees them". That is true for **workflow runs**: `userWorkflowPromptSpec` leaves them out. It is not true for **Ask with an agent**: `composePersistedUserAgentIdentityBlock` (services/api-gateway/src/ai/ai-execution.controller.ts:684-685) puts both into the Ask prompt. The hint's wording, "the workflow's instructions", is accurate for that reason. BIZ-LIVE-04's checkpoint is locked and is not edited; this record carries the correction.

Files:
- **Gateway:** `user-agent/user-agent.service.ts`, `dto/create-agent.dto.ts` (comment), and the two user-agent specs.
- **Frontend:** `components/platform/` (`create-agent-form.tsx`, `agent-workflow-model.ts`, `platform-dashboard.tsx`, and the editor and summary tests).
- The three message files.

The worker read Impeccable, the Emil Kowalski skill and DESIGN.md. It used the existing hint style and added no motion or new interaction.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3373 passed (3364 + 9 new), 7 skipped, 14 failed; the 14 are the known smoke.integration failures |
| gateway `npm run build` | exit 0 |
| ai-service `npx jest --runInBand` | 1296 passed, 1 skipped, 0 failed |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1520 passed (1505 + 15 new), 0 failed |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| line endings | the 12 files are LF in this checkout |

## Limits

Not deployed. Keith's live check at the next deploy:
1. A copy of the Chief of Staff arrives with Role and Description prefilled in his language and with the hints. The saved copy's card reads "Draft", with the switch Off.
2. Its test run works, and Start stays locked while it is a draft.
3. After the test, the switch turns on, and Start then works.
4. Going back to a blank start clears the untouched prefill.

CHECKLIST: EVERY 11/11, UI 9/9 (4: skills read, existing hint style, no motion; 9: the live check above), BACKEND 6/6 (1: no auth, guard, cookie or CSRF change; 5: n/a, no schema change, the column default kept; 6: only the 14 known smoke failures)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Registered:** WORKFLOW-STATUS-02, NOT_READY.
  - The server should refuse `PATCH status: 'active'` for an untested workflow. Today only the client enforces this; the start gate still checks the test, so it is safe.
  - The dashboard should give Draft its own badge instead of the disabled styling. That needs `lib/agent-platform`'s `AgentStatus`.
- **Superseded:** the Ask-mode use of Role and Description. It is covered by this task's hint wording ("the workflow's instructions") and recorded in the correction above. Changing the Ask prompt is not in any plan.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. GATEWAY, FRONTEND and I18N are released UNOWNED.
