# TEAM-NO-SESSION-02 — Stage-start

**Task:** TEAM-NO-SESSION-02 — Run business workflows without a project session (plan row 30, `docs/AGENT-OPS-PLAN.md:43`; G7 project-less runs, `:201`, `:280`)
**Status:** STAGE-START — APPROVED 2026-11-10. Drafted read-only by a fable subagent (Fable 5.1) ahead of admission. Keith chose DECISION A on 2026-11-10 ("Yes, business project"); DECISION B follows the registered scope; C, D and E settled by the control plane on their recommendations. Admitted after RESULTS-01 LOCKED (2c2e92b) and CM-CLEANUP-01B released GATEWAY.
**Lane:** 2 when admitted, or 1 after RESULTS-01 locks. **Mutexes:** GATEWAY, FRONTEND, I18N. **Hot files:** none. **MIGRATION:** not needed (section 3, D1). **PACKAGE:** not needed (the Team page test glob exists since BIZ-USER-01C).
**Lifecycle:** 4-STEP (registered so, `TASKS_BACKLOG_FULL.md:86421`). **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Implementer:** a Claude subagent on **opus** (Opus 5.5), in worktree `C:\Users\knlee\aisb-worktrees\TEAM-NO-SESSION-02` on branch `lane/TEAM-NO-SESSION-02`. Opus because the change moves an ownership boundary on the run start path (the session requirement), writes rows into `sessions` and `projects` from orchestration, and spans the gateway and the frontend (GOV-ROUTING-01: auth-adjacent and cross-service go to opus).

## 1. Goal

A user workflow (always the read-only profile) starts from the Team page without a workspace session. Grants, budgets, the test-run gate and ownership work exactly as BIZ-USER-01C built them. Write-capable runs (the coding team's Writer) stay session-bound. Nothing a session-less run does can reach a container, a file action, a checkpoint or a revert. The no-session Team view also shows the selected workflow's start hint and spend line (TEAM-NO-SESSION-01 follow-up).

## 2. What is true today

### 2.1 What blocks a session-less start

| Fact | Where |
|---|---|
| `POST /api/collaboration/runs` reads `sessionId` as a required UUID in both body shapes (team and workflow). | `collaboration.controller.ts:611-641` (`:623`, `:637`) |
| It loads the session, refuses another owner's (404), refuses an unusable one (409 "Session is not usable") and one with no project (409 "Session has no project"). Usable = not terminated, status active or pending, `expiresAt` in the future or null. | `:193-200`, `:478-510`, `:73-76` |
| The conversation is one per session, reused or created by session id. | `:207`, `:512-530`; `conversation.entity.ts:30-43` (FK, unique, NOT NULL) |
| The run row needs a project: `collaboration_runs.project_id text NOT NULL`. | migration `1773100000000:81`; `collaboration-run.entity.ts:23-24`; `orchestration.service.ts:2193` |
| The pending job stores `sessionId: string`; it goes onto the signed job and into the ledger intent; the usage record refuses an empty one; `usage_records.session_id` is `uuid` NOT NULL and `token_usage.session_id` is an FK to `sessions` with RESTRICT. | `orchestration.contracts.ts:190`; `orchestration.service.ts:840, :970, :1053, :1882`; `usage-ledger.service.ts:715-717`; `usage-record.entity.ts:73`; `token-usage.entity.ts:33-46` |
| The worker's job type has `sessionId: string` and is on the frozen contract's path list. | `services/ai-service/src/queue/job.types.ts:51`; `lane-saturation-state.json` sharedContracts |
| The Team page takes the session from the URL only; without one it lists workflows, shows Start and Start test run hard-disabled with the `missingSession` hint, and hides the task box and team picker. The start body always carries `sessionId`. | `collaboration-page.tsx:924, :679, :642-647`; `collaboration-view.tsx:239, :347-376`; `en.json:1214` |

### 2.2 What the session and project supply, and what a read-only run needs

| Supplied by the session or project | Used by | Needed by a read-only workflow run? |
|---|---|---|
| A container, reached by session id | Worker file tools `read_file`, `list_files`, `search_workspace` (registered for every harness job, `worker.processor.ts:1850-1883`); write, delete, validation and browser tools (only when not `harnessReadOnly`, `:1933-2027`); the pre-apply checkpoint (`allowHarnessMutation` only, `:2077-2090`); the project snapshot save (`:2104-2108`); the Writer's working-tree diff (`orchestration.service.ts:3006-3034`, writer only) | **No.** A business workflow reads Knowledge and connector tools (`:1884-1931`), which take `userId` and a grant token, not a session. |
| A conversation (1:1 with the session) | `conversationId` on the job and the ledger intent | Only as a row: the FK and NOT NULL need one; nothing reads its content. |
| A project id | `collaboration_runs.project_id`; the Team page "Past runs" list (`GET /api/collaboration/runs?projectId=`, `collaboration.controller.ts:269-297`); RESULTS-01 items carry `projectId` | Only as a value. |
| Ownership | `session.userId === caller` (`:485`) | Already covered: the workflow row is loaded by owner (`collaboration-workflow.ts:391-394`). |
| A ledger anchor | `usage_records.session_id`, `token_usage.session_id` FK | **Yes, a real `sessions` row.** |
| Grants and budgets | Nothing: derived from the row and the owner's connections at start and at enqueue | Unchanged (`collaboration-workflow.ts:386-436`; `orchestration.service.ts:827-835`). |

### 2.3 Why every user workflow is read-only, and how write-capability is marked

| Fact | Where |
|---|---|
| A user workflow's tool profile is the constant `read`; any other stored value is dropped. | `user-workflow-grants.ts:15, :78-81`; `user-agent.entity.ts:69-70` (`tool_profile`, default `read`) |
| The signed `harnessToolProfile` comes from the target id: a system agent's profile, else `read`; `read` adds `harnessReadOnly: true`. A workflow id is never a system id. | `collaboration-tool-profile.ts:43-70` |
| Every collaboration run is `orchestration_mode = 'read_only'` and every referral has `constraint_read_only = true`, `constraint_allow_write_tools = false` (DB checks). | `collaboration-run.entity.ts:15`; `collaboration-referral.entity.ts:34-38` |
| The only write-capable step is the coding team's Writer (`write` profile), reached only through a team start. | `collaboration-tool-profile.ts:104-109`; `collaboration.controller.ts:550-572` |
| The worker verifies the proof before registering tools; an unknown `builderProfileId` gets the default harness config. | `worker.processor.ts:1629-1643`; BIZ-USER-01C stage-start section 2 |

### 2.4 Rows the platform can create today without a migration

| Fact | Where |
|---|---|
| `sessions.container_id` nullable; `sessions.project_id` nullable; `status` enum pending, active, stopped, expired, error; `expires_at` NOT NULL; `terminated_at` nullable. A session row is created with status pending and no container; the container is started by a separate container-manager call. | `session.entity.ts:40-41, :54-55, :96-97, :107-108`; `session-status.enum.ts`; `session.repository.ts:25-34`; `session.controller.ts:72-82` |
| `projects.workspace_id` nullable; `slug` is globally unique by lookup, never changed by rename (no slug route). | `project.entity.ts:46-47, :52-54`; migration `1771593000000:51`; `projects.service.ts:49-62, :104-108` |
| The default session list returns active and pending only; the workspace fetches `includeTerminated=true` (all rows) and treats a session as usable when it is not terminated and not expired; unusable ones go to a hidden group. | `session.repository.ts:53-85`; `app/[locale]/app/page.tsx:1962, :2018-2047`; `workspace-shell.logic.ts:149-151` |
| The session quota counts rows with `terminated_at IS NULL AND expires_at > now()`. | `quota.service.ts:62-72` |
| The workspace project list filters by the selected workspace when one is selected. | `workspace-projects.logic.ts:91-92`; `projects.service.ts:87-92` |
| container-manager keeps its own session state in SQLite; a session it has never seen answers 404 "Session not found". The gateway terminates a Postgres session only on a container-manager **410**. | `ARCHITECTURE.md:542, :562`; `container-manager/src/sessions/sessions.service.ts:218-224`; `container-manager-http.client.ts:555-557, :574-591` |
| A failed tool handler becomes a tool error result and the loop continues. | `agent-harness-loop.ts:571-589` |
| `CreatePendingReferralInput.projectInstructions` becomes the caller instructions in front of the "You are <id>." brief; the controller does not pass it today. | `orchestration.service.ts:226, :2612-2622`; `collaboration.controller.ts:216-234` |
| BIZ-NOPROJECT-01 holds "a project-less run is a larger orchestration change", NOT_READY, no write set. | `TASKS_BACKLOG_FULL.md:85230-85253`; `docs/AGENT-BIZ-KNOWLEDGE-PLAN.md:101` |
| HARNESS_ENTITLEMENT_PROOF_V1 is FROZEN and lists `orchestration.service.ts`, `ai-execution.controller.ts`, `job.types.ts`, `worker.processor.ts`. | `lane-saturation-state.json` sharedContracts |
| RESULTS-01 (Lane 1) edits `orchestration.module.ts` (registers its controller and service) and not `collaboration.controller.ts`; its items carry `projectId`; it adds migration 1804. | `docs/RESULTS-01-STAGE-START.md:79-97` |

## 3. Design

| # | Decision |
|---|---|
| D1 **What replaces the session (DECISION A)** | A **per-owner business project and business session**, created on first use by the gateway and reused after. No migration: `sessions` and `projects` already allow every value used (2.4). Option (a), a null session and project, needs schema changes on `collaboration_runs`, `usage_records`, `token_usage` and `conversations`, a ledger change, and a change to `job.types.ts` and `worker.processor.ts` (frozen): out. |
| D2 **The business project** | One `projects` row per owner: `userId` = owner, `name` = "Business workflows", `slug` = `business-<userId>` (45 chars, unique per owner because the user id is; the only durable marker without a column), `visibility` private, `workspaceId` **null** (DECISION C). Found by `{ userId, slug }`. Inserted through the `Project` repository from orchestration, not through `ProjectsService.createProject` (which assigns the default workspace and a generated slug). |
| D3 **The business session** | One `sessions` row per owner: `userId`, `projectId` = D2, `containerId` null, `status` **stopped**, `expiresAt` = `createdAt` (already past), `terminatedAt` null, `lastActivityAt` touched at each start (DECISION C). Consequences: it never counts toward the five-session quota (`quota.service.ts:67`), is not in the default session list (`session.repository.ts:53-58`), is unusable to the workspace (`workspace-shell.logic.ts:149-151`), is never known to container-manager, and is never terminated by the 410 reconciliation (container-manager answers 404 for it). Found by `{ userId, projectId, terminatedAt: IsNull() }`; if none (deleted or terminated by an admin), a new one is created. |
| D4 **Where it lives** | New `orchestration/collaboration-business-session.ts`: `CollaborationBusinessSessionService.ensureForOwner(userId) → { sessionId, projectId }` and `findForOwner(userId) → { projectId } \| null`. Registered in `orchestration.module.ts` with `TypeOrmModule.forFeature([Project, Session])`. No import of `ProjectsModule` or `WorkspacesModule`. Both lookups are by `userId`, so an owner can never reach another owner's rows. |
| D5 **The route change (smallest)** | `POST /api/collaboration/runs`: when the body has `workflowId`, `sessionId` becomes **optional**. Absent → `ensureForOwner(caller.userId)` supplies the session and project; present → today's path, unchanged. A team body still requires `sessionId` (400 as today). The order is kept: `prepareStart` refusals (404, 409, 429, 503) come before any row is created, so a refused start never creates the business rows. Response shape unchanged (`projectId` is the business project; `conversationId` from `reuseOrCreateConversation(businessSessionId)`). |
| D6 **Write-capable runs stay session-bound** | Only the `workflowId` branch may omit a session. Defensively the controller asserts `collaborationHarnessToolProfile(plan.builderProfileId) === 'read'` before using the business session, else 409 `WORKFLOW_INVALID`; a test pins it. Team starts (coding, Chief of Staff, Advisors) keep the session requirement (DECISION B). |
| D7 **No container, file action, checkpoint or revert path** | The business session has no container and container-manager has no record of it, so the three read tools the worker still advertises (`worker.processor.ts:1850-1883`) answer a tool error (404 through the gateway's internal workspace routes) and the loop continues (`agent-harness-loop.ts:571-589`); write, delete, validation, browser, checkpoint and snapshot are off for `harnessReadOnly` jobs regardless (`:1933-2027, :2077-2108`); the Writer diff reads only writer steps (`orchestration.service.ts:3006-3013`). To stop wasted calls, the controller passes `projectInstructions` for a session-less run: one sentence, "This run has no project files or workspace. Do not use the file tools." (DECISION D). It is caller text, not part of the rendered spec, so the version hash and the tested state are unchanged. |
| D8 **Grants and budgets** | Unchanged: `prepareStart` runs before the session is resolved; `workflowJobAccess` at enqueue and `assertCanApprove` at approve are untouched (`collaboration-workflow.ts:386-466`; `orchestration.service.ts:827-835`). The ledger intent carries the business session id and the business conversation id; `CreditDeductionRecord` sums by execution id are unaffected. |
| D9 **Ownership** | Unchanged: the workflow row by owner (`collaboration-workflow.ts:391`), run list and detail by owner (`collaboration.controller.ts:305-312, :600-609`), business rows by owner (D4). |
| D10 **Workflows list** | `GET /api/collaboration/workflows` gains `business: { projectId: string } \| null` from `findForOwner` (read-only, never creates). The page uses it as the initial "Past runs" project when there is no session (DECISION E). |
| D11 **Team page, no session** | With a workflow selected: the task box and presets show; **Start test run** and **Start** follow `workflowStart` exactly as with a session (`canTest`, `canRun`, hint, spend line); the start body is `{ task, workflowId, testRun }` with no `sessionId`. With no workflow selected: the team picker stays hidden and a hint says workflows run here without a workspace and the coding team needs one. "Past runs" lists the business project (D10) and shows the started run as today (`collaboration-page.tsx:662-665`). With a session: nothing changes. Test IDs kept (`collaboration-no-session`, `collaboration-missing-session`, `collaboration-start`, `collaboration-start-test`). |
| D12 **Copy** | `collaboration.missingSession` reworded: en "Your workflows run here without a workspace. The coding team starts from a workspace session: open Team from a workspace for that." zh-TW and zh-CN real translations. New `collaboration.pastRunsBusiness` ("Runs of your workflows started here.") if the past-runs heading needs it; otherwise none. Keys in all three files; parity test. |
| D13 **RESULTS-01 effect** | None to its design: business runs carry a project id, so `projectId` in its items is a string as it assumes; its workflow filter reads `pending_job`; owner-wide list already includes them. Both tasks edit `orchestration.module.ts`: this task is admitted after RESULTS-01 locks (or in Lane 2 under GATEWAY, which is held, so in practice after), and its branch is cut from the moved `main`. |
| D14 **Frozen contract** | HARNESS_ENTITLEMENT_PROOF_V1 is used, not changed: no job key, no signing change, no worker change. `orchestration.service.ts`, `services/api-gateway/src/ai/` and `services/ai-service` have an empty diff; the report includes `git diff --stat main -- services/api-gateway/src/orchestration/orchestration.service.ts services/api-gateway/src/ai services/ai-service` and it must be empty. `mutatesSharedContractIds` stays `[]`; `sharedContractIds` lists it as read. |
| D15 **BIZ-NOPROJECT-01** | Superseded by this task at LOCK: its hold ("a project-less run is a larger orchestration change") is answered by the business session, which is the orchestration change bounded to one service. No remainder. |

### DECISIONs the plan does not settle

**Product (Keith's call):**

| ID | Choice | Recommendation |
|---|---|---|
| DECISION A | Replace the session with a per-owner business project and session row (D1-D3), or make runs truly project-less (migrations on four tables plus the frozen contract). | **Business project and session.** No migration, no contract change, one service. Visible effects, all small: one "Business workflows" project row per owner (hidden from the workspace's project list while it filters by workspace, `workspace-projects.logic.ts:91`; listed by `GET /api/projects` without a filter); one stopped session row per owner, listed by the admin sessions view (`admin-dashboard.service.ts:197`) and returned to the workspace with `includeTerminated=true`, where it is unusable and hidden. |
| DECISION B | Without a session, run only user workflows, or also the read-only system teams (Chief of Staff, Advisors). | **User workflows only**, as the task scope says. The system teams stay session-bound; the Chief of Staff front door is COS-FRONTDOOR-01. The D6 assertion is profile-based, so widening later is one controller line plus copy. |

**Implementation (control plane):**

| ID | Choice | Recommendation |
|---|---|---|
| DECISION C | Business session shape: stopped with `expiresAt` in the past and `workspaceId` null on the project (D2-D3), or active with a far-future expiry in the default workspace. | **Stopped, expired at creation, null workspace.** The alternative consumes one of the owner's five session slots for ever, appears usable in the workspace (the workspace may even auto-select it, `app/page.tsx:2045`, and then every file call fails), and shows the project in the workspace list. |
| DECISION D | Pass the one-sentence caller note (D7) or accept the model trying file tools and getting errors. | **Pass the note.** It costs nothing, changes no hash, and keeps business runs from spending iterations on dead tools. |
| DECISION E | Initial "Past runs" without a session: `business.projectId` on the workflows list (D10), or list only after the first start in a visit. | **The field.** One owner-scoped read, no new route; otherwise the no-session view says "This page needs a project" until a run starts. |

## 4. Files

| File | Change |
|---|---|
| `services/api-gateway/src/orchestration/collaboration-business-session.ts` (new) | D2-D4: find-or-create project and session, by owner |
| `services/api-gateway/src/orchestration/collaboration-business-session.spec.ts` (new) | creation on first use, reuse, recreation after termination, owner isolation, exact row values (status, expiry, null container, slug, null workspace) |
| `services/api-gateway/src/orchestration/collaboration.controller.ts` | D5-D7, D10: optional `sessionId` for `workflowId`; read-profile assertion; caller note; `business` field |
| `services/api-gateway/src/orchestration/orchestration.module.ts` | `forFeature([Project, Session])`; register the new service |
| `services/api-gateway/src/orchestration/collaboration.controller.spec.ts` | section 6 |
| `frontend/components/collaboration/collaboration-page.tsx` | D11: session-less start body, `business.projectId` as the initial list project, hint selection |
| `frontend/components/collaboration/collaboration-view.tsx` | D11: no-session view shows the form when a workflow is selected |
| `frontend/components/collaboration/collaboration-workflows.ts` | `collaborationWorkflowStartBody` without `sessionId`; read `business` from the list |
| `frontend/components/collaboration/collaboration-workflows.test.tsx` | section 6 |
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | D12 |

Inside the registered provisional scope (`services/api-gateway/src/orchestration/`, `frontend/components/collaboration/`, the three message files, `TASKS_BACKLOG_FULL.md:86424`): every file above. **Outside it: none.** Read-only imports: `entities/project.entity.ts`, `entities/session.entity.ts`, `entities/session-status.enum.ts`, `collaboration-tool-profile.ts`.

Not changed: `orchestration.service.ts`, `collaboration-workflow.ts`, `services/api-gateway/src/ai/`, `sessions/`, `projects/`, `quota/`, `conversations/`, `services/ai-service/`, `services/container-manager/`, `frontend/lib/`, `frontend/hooks/`, `frontend/components/platform/`, `frontend/app/`, any migration, any record.

Out of scope: project-less runs with a null project (DECISION A alternative); running system teams without a session (DECISION B); hiding the business rows from `GET /api/projects` or `GET /api/sessions` (needs `projects/` or `sessions/`); the worker not advertising file tools (frozen contract, follow-up 2); triggers (TRIGGER-01); the deploy (STAGING-DEPLOY-WF-01); the live check (BIZ-LIVE-04); any auth, guard, cookie or CSRF change.

## 5. Write set, mutexes, lifecycle

| Item | Value |
|---|---|
| Write set | the ten files in section 4 (EXACT at admission) |
| Mutexes | GATEWAY, FRONTEND, I18N |
| MIGRATION | no: no entity, column or table change |
| PACKAGE | no: `components/collaboration/*.test.ts*` is already in the frontend test script |
| Hot files | none |
| Shared contracts | HARNESS_ENTITLEMENT_PROOF_V1 read, not changed (D14) |
| Revert isolation | the no-session start branch and the two business rows; reverting the code leaves orphan rows that nothing reads |
| Lifecycle | 4-STEP: registration (done), this stage-start, implementation, consolidation |
| Admission | after RESULTS-01 locks (GATEWAY, FRONTEND held), branch cut from the moved `main` |

## 6. Tests and gates

**Gateway, controller (`collaboration.controller.spec.ts`):** `workflowId` without `sessionId` → 201, the run's `projectId` is the business project, the referral's pending job has the business session id, and `conversationCreated` true on first use then false; a second session-less start reuses both rows (one project, one session per owner); another owner gets different rows; `team` without `sessionId` → 400 as today; `workflowId` with a `sessionId` → unchanged path (business rows not created); a refused start (404, 409 not tested, 429 budget, 503 provider) creates no business rows; the D6 assertion refuses a non-read profile (mocked) with 409; the caller note is on `projectInstructions` only for session-less runs; `GET /api/collaboration/workflows` carries `business: null` before and `{ projectId }` after; 401 and 403 unchanged on both routes.

**Gateway, service (`collaboration-business-session.spec.ts`):** exact row values (stopped, `expiresAt <= createdAt`, `containerId` null, `terminatedAt` null, slug `business-<userId>`, `workspaceId` null, visibility private); recreation after `terminatedAt` is set; lookups filter by `userId`.

**Frontend (`collaboration-workflows.test.tsx`):** without a session and a workflow selected: the task box, Start test run and Start follow `workflowStart` (canTest only, both, neither with hint), the spend line shows, the body has no `sessionId`; without a session and no workflow: no task box, no team picker, the reworded hint in three languages (Han check for zh); with a session: unchanged bodies; `business.projectId` becomes the list project when there is no session and is ignored when there is; existing test IDs kept; key parity across the three message files.

| Area | Command | Compare with |
|---|---|---|
| api-gateway | `npx jest --maxWorkers=2`, then `npm run build` | the baseline at admission (3256 passed, 7 skipped, plus the 14 known `smoke.integration.spec.ts` failures before RESULTS-01; RESULTS-01 moves it); only the 14 may fail |
| ai-service | `npx jest --runInBand` | the baseline at admission (1296 passed, 1 skipped at the CM-CLEANUP-01 LOCK); rerun because its drift spec reads gateway source; this task touches none of the files it reads |
| frontend | `npx tsc --noEmit`, `npm test`, `npm run build`, then `git restore -- frontend/tsconfig.tsbuildinfo` | the baseline at admission (1432 at the TEAM-NO-SESSION-01 LOCK; RESULTS-01 moves it) |
| files | changed files are LF; `git diff --stat main -- services/api-gateway/src/orchestration/orchestration.service.ts services/api-gateway/src/ai services/ai-service` empty (D14) | |

Checklists on the checkpoint: EVERY, UI, BACKEND. FLOWS n/a (no checkpoint, revert or file-action code changes; D7 states why the paths are unreachable). MIGRATION n/a (no schema change). Skills before UI work: `.agents/skills/impeccable`, `.agents/skills/emil-design-eng`; DESIGN.md applies (existing button, hint and spend-line patterns are reused).

## 7. Follow-ups (named here, disposed at LOCK)

1. **BIZ-NOPROJECT-01**: superseded by this task (D15), no remainder.
2. **Worker does not advertise file tools for runs without a workspace.** Needs a signed job field or a worker rule: a HARNESS_ENTITLEMENT_PROOF_V1 change, runs alone. Keith's call: register NOT_READY or drop (D7's note makes it cosmetic).
3. **TRIGGER-01** starts runs with no session: it reuses `ensureForOwner` (D4). Superseded into TRIGGER-01's stage-start.
4. **Live check** (at BIZ-LIVE-04, three languages): open Team from the dashboard with no session, pick a workflow, test run, Start after the test, the spend line, "Past runs" lists the run, the business project is absent from the workspace project list, the admin sessions view shows one stopped session. Superseded into BIZ-LIVE-04's acceptance criteria.
5. **Hide the business rows** from `GET /api/projects` and the admin sessions view (needs `projects/`, `sessions/` or `admin/`). Keith's call: register NOT_READY or drop.
6. **ARCHITECTURE.md** row for the business project and session as the ledger anchor of session-less runs; the control plane at LOCK.

## 8. Stop conditions for the implementer

STOP and report if:
- `orchestration.service.ts`, `collaboration-workflow.ts`, anything under `services/api-gateway/src/ai/`, `sessions/`, `projects/`, `quota/`, `conversations/`, `services/ai-service/`, `frontend/lib/`, `frontend/hooks/` or `frontend/components/platform/` would change;
- a migration, an entity or column change, or a new dependency seems needed;
- a team body (`team`) would start without a session, or a run whose signed profile is not `read` would start without a session;
- a guard, the session cookie, CSRF, the internal key, the entitlement check or the 404-for-another-owner rule would change;
- the business rows would be created before every `prepareStart` refusal has run, or by any read route;
- a job key would be added or removed, or `withHarnessEntitlementProof`, `job.types.ts` or `worker.processor.ts` would change;
- the workflow start with a `sessionId`, or any three-team start, would stop working as today;
- a gate fails outside the 14 known smoke failures.

## 9. Approval

Approved 2026-11-10. Keith: DECISION A, business project and session ("Yes, business project"). DECISION B: user workflows only, as the registered scope says. DECISIONs C, D, E: each recommendation taken. Write set EXACT: the ten files of section 4 plus the three message files; mutexes GATEWAY, FRONTEND, I18N; implementer opus (Opus 5.5). Original text: The plan (row 30, approved by Keith 2026-11-09) asks for running read-only workflows without a session; Keith's 2026-11-10 decision ("Yes, list them") left the run to this task. DECISIONs A and B are Keith's; C, D and E are the control plane's. Admission waits for RESULTS-01 to release GATEWAY and FRONTEND.
