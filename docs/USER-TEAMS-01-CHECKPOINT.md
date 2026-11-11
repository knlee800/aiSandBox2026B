# USER-TEAMS-01 — Checkpoint (slice 01A: team column and validation)

**Task:** USER-TEAMS-01 — User teams and who hands work to whom
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01. Keith approved the stage-start on 2026-11-11 ("Yes, approve").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | GOV-BIZ-AGENT-OPS-PLAN-01 | earlier |
| 2. Stage-start | docs/USER-TEAMS-01-STAGE-START.md, drafted by a fable subagent (Fable 5.1); approved; slices 01B and 01C and USER-TEAMS-LIVE-01 registered; 01A admitted to Lane 1 with GATEWAY and MIGRATION | 0b05d92 |
| 3. Implementation | opus subagent (Opus 5.5: a migration and owner-scoped validation across two folders) in worktree lane/USER-TEAMS-01, fast-forwarded onto main | 7b31a77 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **Migration 1806000000000-AddUserAgentTeamColumn:** adds `user_agents.team_member_ids jsonb NOT NULL DEFAULT '[]'::jsonb`.
  - It probes `information_schema.columns`. up() refuses if the column is present; down() refuses if it is absent, and otherwise drops only that column, losing only teams.
  - The 1805 spec's "is the latest" check now uses the `<=` form.
- **Entity and DTOs:**
  - The entity gains `teamMemberIds: string[]`.
  - Create and update DTOs take optional `teamMemberIds`: an array of at most 3 strings, each 1 to 64 characters.
  - On update, an absent field keeps the stored team, and `[]` empties it.
- **Save-time rule (DECISION D):** the roster's member checks moved into `user-agent/user-workflow-rules.ts`; collaboration-roster.ts re-exports them under the same names, which avoids an import cycle.
  - `assertRosterMemberIds` is shared by the Chief of Staff roster's `put` and the workflow save.
  - A member must be one of the two active advisors or the owner's own row (any status at save time). No repeats.
  - The new 400 `ROSTER_MEMBER_SELF` refuses a workflow on its own team.
  - Another owner's row reads as not found.
- **Version and switch-on:** a team-only PATCH on an active row runs no switch-on check and does not change `workflowVersion` (DECISION C).
- **Responses:**
  - Agent responses carry `teamMemberIds`.
  - `GET /api/agents/options` gains `teamChoices` (the two advisors and the owner's rows).
- **Roster service:** `evaluateMembers(userId, ids)`, with `membersForStart` built on it. Its behaviour is unchanged, and the existing roster tests are unchanged.
- **D15 (also a live fix):** `cutAgentListText` cuts an agent-list summary to 300 characters and a label to 100, never splitting a surrogate pair. A Chief of Staff start with a roster workflow whose description is over 300 characters no longer fails at the first hand-off.
- **Start prep:** `PreparedWorkflowStart.teamMemberIds` holds the ids only. The collaboration controller doesn't use them until 01B.

**Files (16):**
- the migration and its spec (new), the 1805 spec, the entity, the two DTOs;
- in user-agent: the service, controller and rules, each with its spec;
- in orchestration: collaboration-roster and collaboration-workflow, each with its spec.

82 new tests. Two existing controller assertions were updated, as D3 requires: the response key list gains `teamMemberIds`, and options gains `teamChoices`.

## Gates (control-plane rerun on the branch, then fast-forward)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3582 passed (3500 + 82), 7 skipped, 14 failed: only the known `smoke.integration` failures |
| gateway `npm run build` | exit 0 |
| frozen and out-of-slice paths | `git diff --stat main..lane/USER-TEAMS-01` over orchestration.service.ts, collaboration.controller.ts, collaboration-front-door.ts, src/ai, src/queue, ai-service and frontend: empty |
| line endings | the 16 files are LF in the work tree and in the committed blobs |

## Review notes

- The DTO's `ArrayMaxSize(3)` fires before the service, so a fourth id over HTTP gets a class-validator 400 without a `code`. The service's `ROSTER_TOO_MANY` shows only on a direct call. This is accepted, because the form refuses a fourth tick; 01C maps the message.
- `findOneByIdAndUserId` is only called for UUID-shaped ids (`rosterMemberKind`), so a malformed id can't reach Postgres as a uuid.
- The migration was tested with a mocked query runner. It runs on Postgres at STAGING-DEPLOY-FD-02, which takes a pre-migration backup.

## Limits

Not deployed. Nothing runs a team yet; that is USER-TEAMS-01B. The deploy is STAGING-DEPLOY-FD-02, a migrating deploy with 1806.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (4: HARNESS_ENTITLEMENT_PROOF_V1 paths empty diff; 6: only the 14 known smoke failures), MIGRATION 4/4 (1: MIGRATION held, 4-step, and opus per GOV-ROUTING-01 for a subagent in place of the Cursor grok-4.7-xhigh line; 2: 1806 after 1805; 3: up and down written and tested; 4: no database touched)
FOLLOWUPS: 0 registered / 3 superseded / 0 dropped / 0 undisposed.
- The fourth-id 400 without a code: superseded into USER-TEAMS-01C.
- The missing ROSTER_MEMBER_SELF copy in the frontend: superseded into USER-TEAMS-01C.
- Migration 1806 in the deploy: superseded into STAGING-DEPLOY-FD-02, already in its body.

The stage-start follow-ups:
- 1, 3 and 4 were done at the approval record.
- 2 is registered as USER-TEAMS-LIVE-01.
- 5 (the ARCHITECTURE.md 13.1 line) falls due at the USER-TEAMS-01B LOCK.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 1 released EMPTY; GATEWAY and MIGRATION released UNOWNED. Next: USER-TEAMS-01B.
