# APPROVAL-SET-01 — Checkpoint (slice 01A: columns and validation)

**Task:** APPROVAL-SET-01 — Approval setting per team or workflow
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01. Keith approved the stage-start on 2026-11-11 ("Yes, approve both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | GOV-BIZ-AGENT-OPS-PLAN-01 | earlier |
| 2. Stage-start | docs/APPROVAL-SET-01-STAGE-START.md, drafted by a fable subagent (Fable 5.1). Approved together with COS-DRAFTS-01's. APPROVAL-SET-01B, -01C and -02 registered; 01A admitted to Lane 1 with GATEWAY and MIGRATION | ee1e8f6 |
| 3. Implementation | opus subagent (Opus 5.5: a migration and approval validation) in worktree lane/APPROVAL-SET-01, cherry-picked onto main | e3af907 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Migration 1807000000000-AddUserAgentApprovalColumns.**
- `approval_mode varchar(16) NOT NULL DEFAULT 'every'`, with a CHECK allowing only every, credits and read_only.
- `approval_credit_limit integer NULL`, with a CHECK of NULL or at least 1, like the budget columns.
- The migration probes `information_schema.columns`. up() refuses if either column exists. down() refuses unless both exist, then drops only those two, which loses only the settings.
- The 1806 spec's "is the latest" check now uses the `<=` form.

**Entity, rules and DTOs.**
- The entity gains `approvalMode` and `approvalCreditLimit`.
- `user-workflow-rules.ts` gains `USER_WORKFLOW_APPROVAL_MODES` and a fail-closed `readApprovalSetting`: an unknown mode, or credits with a missing or invalid limit, reads as every with no limit.
- The DTOs take both fields as optional.
- `MAX_USER_WORKFLOW_BUDGET_CREDITS` moved into the rules module, which avoids an import cycle. The DTO re-exports it under the same name, and a test pins that both give 1,000,000.

**Service.** It validates on create, template copy and PATCH.
- A template copy always starts as every with no limit.
- On PATCH, an absent field keeps the stored value and a present one replaces it. A PATCH without either field checks nothing.
- credits without a limit is a 400 with `APPROVAL_LIMIT_REQUIRED`. An unknown mode is `APPROVAL_MODE_INVALID`, and a bad limit is `APPROVAL_LIMIT_INVALID`. Over HTTP the DTO catches the last two first, with a plain 400.
- A limit sent with another mode is stored as null.
- A change to the approval setting alone runs no switch-on check and doesn't change `workflowVersion`.

**Responses and connector tools.**
- Agent responses carry both fields, read through `readApprovalSetting`. `/api/agents/options` is unchanged.
- `readOnly: true` is set on the mail and calendar connector tools. It's a required boolean on `ConnectorToolDefinition`, so every future tool must declare it. Nothing reads it until 01B.

**Files (14):**
- the migration and its spec (new), and the 1806 spec;
- the entity;
- user-workflow-rules with its spec, the two DTOs, and the service and controller with their specs;
- connector-servers.ts and its new spec.

123 new tests. Two existing assertions changed: the 1806 "latest" form, and the controller's response key list, which gains both fields.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3724 passed (3601 + 123), 7 skipped, 14 failed: only the known `smoke.integration` failures, on the branch and on main |
| gateway `npm run build` | exit 0, on the branch and on main |
| frozen and out-of-slice paths | `git diff --stat ee1e8f66..lane/APPROVAL-SET-01` over src/orchestration, src/ai, ai-service, frontend and container-manager: empty |
| line endings | the 14 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed. Nothing reads the columns until APPROVAL-SET-01B. The migration was tested with a mocked query runner; it runs on Postgres at STAGING-DEPLOY-FD-02, which carries 1806 and 1807 with a pre-migration backup.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (4: orchestration.service.ts and the frozen paths empty diff; 6: only the 14 known smoke failures), MIGRATION 4/4 (1: MIGRATION held, 4-step, and opus per GOV-ROUTING-01 for a subagent; 2: 1807 after 1806; 3: up and down written and tested; 4: no database touched)

FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Superseded into APPROVAL-SET-01C** (a line added to its body): its form maps `APPROVAL_LIMIT_REQUIRED`, `APPROVAL_MODE_INVALID` and `APPROVAL_LIMIT_INVALID`, plus the code-less DTO 400.
- **Already covered, not a new follow-up:** the required `readOnly` flag. The ACTIONS-APPROVAL-01 and CONN-DRAFT-01 bodies already say a new send or write tool declares `readOnly: false`.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 1 released EMPTY; GATEWAY and MIGRATION released UNOWNED. CM-DIFF-CAP-01 stays in Lane 2. Next for approval settings: APPROVAL-SET-01B.
