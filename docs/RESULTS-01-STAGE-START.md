# RESULTS-01 — Stage-start

**Task:** RESULTS-01 — Results list, unread badge and run history (plan C12, C14)
**Status:** STAGE-START — APPROVED 2026-11-10 by the control plane under Keith's standing instruction to keep starting the next tasks ("do not stop!!! ... keep looking for the next task to start"). Drafted by a fable subagent (Fable 5.1), read-only.
**Lane:** 1. **Mutexes:** GATEWAY, FRONTEND, I18N, MIGRATION, PACKAGE (PACKAGE added at approval, S2). **Hot files:** none.
**Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Admitted:** 689535c, under Keith's instruction to keep starting the next tasks.
**Implementer:** a Claude subagent on **opus** (Opus 5.5), in worktree `C:\Users\knlee\aisb-worktrees\RESULTS-01` on branch `lane/RESULTS-01`. Opus because the task adds a migration and owner-scoped routes, and spans the gateway and the frontend.
**Lane 2:** CM-CLEANUP-01 (CONTAINER-MANAGER, AI-SERVICE) changes `services/container-manager/src/` and `services/ai-service/src/messages/` and `app.module.ts`. No write-set overlap. RESULTS-01's ai-service rerun at LOCK runs on main as it stands then.

## 1. Goal

The owner sees every Team and workflow run that finished, with the final answer, from one Results page. A badge on the Command Center header counts the finished runs the owner has not opened. The page also serves as run history: filters by workflow, status and date, with paging. Nothing here starts, cancels or deploys a run.

## 2. What is true today

| Fact | Where |
|---|---|
| A run is a `collaboration_runs` row: `user_id`, `project_id`, `status` in active, completed, failed, cancelled, timed_out, `created_at`, `completed_at`, `failed_at`, `timed_out_at`, `cancelled_by_user_id`. Index on `user_id`. No read-state column. | `services/api-gateway/src/orchestration/collaboration-run.entity.ts:8-73` |
| Each step is a `collaboration_referrals` row. The model's final text is `result_summary`; `result_output_files` and `result_duration_ms` sit beside it. The first referral's `pending_job.workflow` is the workflow snapshot `{id, name, version, testRun, ...}`. | `collaboration-referral.entity.ts:117-130`; `orchestration.contracts.ts:171-187, 215-229` |
| `result_summary` is the execution's answer: `metadata.aiExecutionResult.output`, read back when the execution completes or fails. So the "saved output" the office opens (`GET /api/ai/executions/:id`, `ai-execution.controller.ts:1109-1135`) and the referral summary are the same text. | `orchestration.service.ts:2403-2440` |
| Runs settle to completed or failed in the background: the sweep syncs in-progress referrals, then calls `finishOrFailRun` on every active run, which settles it; the detail read does the same. The Results page does not need to settle on read. | `orchestration.service.ts:2466-2508, 3150-3175, 1940-1999`; `collaboration-sweep.worker.ts:31-43` |
| The user's task is the first referral's `prompt`. | `collaboration.controller.ts:227, 880` |
| The detail route `GET /api/collaboration/runs/:id` answers 404 for another owner's run and returns `run`, `teamId`, `team`, `workflow {id,name,testRun}` and `handoffs[]`, each with `answer` (completed only), `failureReason`, `sources`, `unsourced`. | `collaboration.controller.ts:128-142, 299-320, 600-609, 840-902` |
| The run list is project-scoped (`projectId` required), 20 newest, sorted in memory, two extra queries per run. It is the Team page's "Past runs", not an owner-wide history. | `collaboration.controller.ts:269-297, 659-668`; `orchestration.service.ts:412-426`; `collaboration-team.ts:43` |
| Every collaboration route sits behind `SessionOrApiKeyAuthGuard` and `assertEntitled` (401 without identity, 403 without `harnessEntitled`). | `collaboration.controller.ts:174-175, 468-476` |
| The owner's workflows list exists: `GET /api/collaboration/workflows`. | `collaboration.controller.ts:260-267` |
| The frontend fetch helper adds `credentials: 'include'` and the CSRF header on non-GET. | `frontend/lib/collaboration/api.ts:75-103` |
| Pages are thin wrappers over a screen component with its own header and a "Command Center" back link. | `frontend/app/[locale]/connections/page.tsx`; `connections-screen.tsx:318-339` |
| The header links (Office, Knowledge, Connections, workspace) live in the platform dashboard, whose test pins each link's key, test id and href. | `frontend/components/platform/platform-dashboard.tsx:614-647`; `platform-dashboard.test.ts:177-189` |
| `npm test` lists test globs by folder and fails when a test file matches none (FE-TEST-GLOB-01). `components/results/` is not listed. | `frontend/package.json` scripts.test |
| Migrations load by glob; the latest is `1803000000000-AddUserAgentWorkflowColumns`. Its spec asserts that 1803 is the highest timestamp, so a new migration must update that line. | `services/api-gateway/data-source.ts:30`; `migrations/__tests__/1803000000000-AddUserAgentWorkflowColumns.spec.ts:79-91` |
| The deploy tool counts added migrations, takes a pre-migration backup and stores the migration hash; a deploy that carries a migration is a migrating deploy. | `ops/clean-baseline/bin/aisandbox-deploy:115-122, 164-189`; `ops/clean-baseline/lib/ops-lib.sh:2133` |
| HARNESS_ENTITLEMENT_PROOF_V1 is FROZEN and lists `orchestration.service.ts`. | `docs/control-plane/lane-saturation-state.json` sharedContracts |
| The ai-service drift spec reads `system-agent-registry.ts` and its spec, not orchestration. | `services/ai-service/src/agent-harness/eval/briefing-drift.spec.ts:99-105, 175-181` |
| Badge tokens exist: `badge-active` (emerald, micro type, `rounded-full px-2 py-0.5`). | `DESIGN.md:228-233` |

## 3. Design

| # | Decision |
|---|---|
| D1 **What a result is** | A result is one collaboration run of the owner, any project, any team. Shown: title (workflow name, else the team label), task (first hand-off's prompt), workflow or team, started and finished times, status, the final answer, its sources. Test runs are included and carry the existing "Test run" badge (`collaboration.testRunBadge`). |
| D2 **Final answer** | DECISION A below. Recommended: the `answer` of the last completed hand-off in `handoffs[]` (creation order), with that hand-off's `sources`, `unsourced` and `droppedSourceCount`. For a failed run, the last hand-off's `failureReason`. Workflow runs have one hand-off, so this is simply its answer. |
| D3 **Unread** | DECISION B below. Recommended: a run is unread while `result_seen_at IS NULL` and its status is completed, failed or timed_out. Active runs are not yet results; cancelled runs are history, never unread. Test runs count: the owner must read a test before switching the workflow on (01C D7). |
| D4 **Read state** | DECISION C below. Recommended: one nullable column `result_seen_at timestamptz` on `collaboration_runs`, set once by `POST /api/results/:runId/seen`. Set only when null, so the first open is the time kept. Entity field `resultSeenAt: Date \| null` on `CollaborationRunEntity`. The `CollaborationRun` contract and `toCollaborationRun` are not changed. |
| D5 **Migration** | `1804000000000-AddCollaborationRunResultSeenAt.ts`, class `AddCollaborationRunResultSeenAt1804000000000`, in the 1803 pattern: probe `information_schema.columns` for `public.collaboration_runs.result_seen_at`; up refuses if present, then one `ALTER TABLE "public"."collaboration_runs" ADD COLUMN "result_seen_at" timestamptz NULL`; down refuses unless present, then `DROP COLUMN "result_seen_at"`. No index (the `user_id` index serves the owner-scoped count), no default, no backfill, no transaction calls. Reversible. Up loses nothing; down loses only seen marks. The 1803 spec's `expect(Math.max(...stamps)).toBe(timestamp)` (line 90) becomes the 1802 form, `stamps.filter((stamp) => stamp <= 1803000000000)`, and the new spec takes over "latest". |
| D6 **Migration-hash effect** | The next staging deploy (STAGING-DEPLOY-WF-01) carries a migration: the deploy tool takes a pre-migration backup, runs it, stores the hash. Its registration says "redeploy" for revert isolation; follow-up 1 makes it state the migration and the down path. |
| D7 **New routes** | New `collaboration-results.controller.ts` at `@Controller('results')`, `@UseGuards(SessionOrApiKeyAuthGuard)`, the same `assertEntitled` rule (401 / 403) and the same 404-for-another-owner rule: `GET /api/results`, `GET /api/results/unread-count`, `POST /api/results/:runId/seen`. No new guard, no auth change, no internal route. |
| D8 **List route** | `GET /api/results?status=&workflowId=&from=&to=&page=&pageSize=` returns `{ results, page, pageSize, total }`. `status` is one of completed, failed, timed_out, cancelled, active, or absent (all). `workflowId` must be a UUID. `from` and `to` are ISO dates applied to `created_at`. `page` is 1-based, `pageSize` defaults to 20, at most 50. Bad values are 400. Newest first by `created_at` in SQL, with `skip`/`take` and a count. Each item: `collaborationRunId, projectId, status, createdAt, finishedAt, teamId, workflow, task (first 200 chars), excerpt (first 240 chars of the final answer, or null), seenAt`. |
| D9 **Workflow filter** | The workflow id lives on the first referral's `pending_job`, not on the run row. Filter with `EXISTS (SELECT 1 FROM collaboration_referrals f WHERE f.collaboration_run_id = r.collaboration_run_id AND f.pending_job #>> '{workflow,id}' = :workflowId)`. Only the first hand-off carries `workflow` (01C D4), so this is exact. |
| D10 **Count route** | `GET /api/results/unread-count` returns `{ count }`: `COUNT(*)` where `user_id = :owner AND result_seen_at IS NULL AND status IN ('completed','failed','timed_out')`. No settle on read; the sweep settles. |
| D11 **Seen route** | `POST /api/results/:runId/seen` loads the run, 404 unless the caller owns it, sets `result_seen_at = now()` only when null, answers `{ seenAt }` (the stored value, also on a repeat call). An active run may be marked; the mark then applies when it finishes. |
| D12 **Where the queries live** | A new `collaboration-results.ts` service in `orchestration/`, injected with the run and referral repositories the module already registers (`orchestration.module.ts:43`). `orchestration.service.ts` is not edited (frozen contract, section 6). The referral reads for `task` and `excerpt` are one `find({ where: { collaborationRunId: In(ids) } })` per page, not two queries per run. |
| D13 **Detail** | Reuses `GET /api/collaboration/runs/:id` unchanged. The page derives title, task, final answer and sources from that response as D2 says. The saved-output route is not needed: the summary is the output (section 2). |
| D14 **Results page** | `frontend/app/[locale]/results/page.tsx` wraps `components/results/results-screen.tsx`: header like the Connections page (icon, title, subtitle, Command Center back link, `data-testid="results-back"`), then filters, the list, a pager. Opening an item shows the detail in place, with Back; opening calls the seen route once and clears the item's unread mark without refetching the list. States with translated text and tests: list loading, empty ("No results yet" with a line pointing to the Team page), failed with Try again, loaded; detail loading, not found (404), failed, result with line breaks kept and HTML escaped (as `office-screen.test.tsx:1066`), no answer (a run that finished without text). Unread items carry a dot and a "New" label; the detail shows the status, times and the Test run badge. |
| D15 **Header link and badge** | Scope question S1. A Results link in `platform-dashboard.tsx` beside Office, Knowledge and Connections (`data-testid="platform-open-results"`, `href={\`${localePrefix}/results\`}`, Heroicon `InboxIcon`), with a count pill in `badge-active` tokens when the count is above 0 (DESIGN.md:228-233). The pill fetches the count once on mount with `credentials: 'include'`; a non-200 (403 for a user without harness access, 401, 5xx) hides the pill and shows nothing else. Keys: `platform.openResults`, `platform.unreadResults` ("{count} new"). |
| D16 **Hooks and fetch** | `frontend/hooks/` and `frontend/lib/` are outside the write set. The page's hook and fetch functions live in `components/results/` (`use-results.ts`, `results-api.ts`) and import `collaborationFetch` from `lib/collaboration/api.ts`. |
| D17 **i18n** | A `results.*` namespace plus the two `platform.*` keys, in en, zh-TW and zh-CN, through the existing hook. Team labels reuse `collaboration.teamChiefOfStaff`, `collaboration.teamAdvisors` and the coding team key where they exist; status labels are new `results.status.*` (the office `platform.status.*` set names execution states, not run states). zh-TW and zh-CN are real translations. |
| D18 **Frozen contract** | HARNESS_ENTITLEMENT_PROOF_V1 is used, not changed: no job key, no signing, no worker change. `orchestration.service.ts`, `ai/`, and `services/ai-service` have an empty diff. The implementer's report includes `git diff --stat main -- services/api-gateway/src/orchestration/orchestration.service.ts services/api-gateway/src/ai services/ai-service` and it must be empty. |

## Decisions (settled 2026-11-10 by the control plane: each recommendation taken)

| ID | Choice | Recommendation |
|---|---|---|
| DECISION A | Final answer = last completed hand-off's answer, or every completed hand-off's answer in order | Last completed hand-off. Report-back chains come with COS-FRONTDOOR-01 and will make that step the Chief of Staff's. |
| DECISION B | Unread = completed, failed and timed_out, not cancelled; test runs count | As stated. Cancelled is the owner's own act; a failed test run is exactly what the owner must read. |
| DECISION C | A column on `collaboration_runs` versus a `collaboration_run_reads` table | The column. One owner per run, one read state; a table would add a join, an index and a second entity for the same bit. |
| DECISION D | Paging by page number with a total, versus a cursor | Page number, `pageSize` 20, max 50. The history is small and a pager is what the filters need. |
| DECISION E | Marking seen by an explicit POST when the detail opens, versus marking on the GET detail | Explicit POST. The GET stays read-only and the Team page, which also reads the detail, does not mark anything. |

## Scope questions

| # | Question | Recommendation |
|---|---|---|
| S1 | The header link and badge need `frontend/components/platform/platform-dashboard.tsx` and `platform-dashboard.test.ts`, outside the write set. | Widen the write set by those two files before dispatch (FRONTEND is already held; no new mutex). Without it the page is reachable by URL only and C12's badge is not delivered. |
| S2 | Tests under `components/results/` need `components/results/*.test.ts*` in `frontend/package.json` scripts.test, outside the write set and under PACKAGE. | Widen by `frontend/package.json` (test script line only) and take PACKAGE at dispatch, as BIZ-USER-01C did at 5bfc1a8. PACKAGE is UNOWNED. |
| S3 | `frontend/hooks/` and `frontend/lib/` are outside the write set. | No widening: hooks and fetch helpers live in `components/results/` (D16). |

## 4. Files

| File | Change |
|---|---|
| `services/api-gateway/src/orchestration/collaboration-run.entity.ts` | `resultSeenAt` column |
| `services/api-gateway/src/orchestration/collaboration-results.ts` (new) | list, count and seen queries; excerpt and task cuts |
| `services/api-gateway/src/orchestration/collaboration-results.controller.ts` (new) | the three routes, validation, 401/403/404 |
| `services/api-gateway/src/orchestration/orchestration.module.ts` | register the controller and service |
| `services/api-gateway/src/orchestration/*.spec.ts` (new) | controller spec (401, 403, 404 other owner, seen idempotent, every 400, paging bounds, excerpt cut, workflow filter SQL) and service spec with mocked repositories |
| `services/api-gateway/src/migrations/1804000000000-AddCollaborationRunResultSeenAt.ts` (new) | D5 |
| `services/api-gateway/src/migrations/__tests__/1804000000000-AddCollaborationRunResultSeenAt.spec.ts` (new) | 1803 pattern: ordering (1804 highest, 1803 the latest before), up SQL exact, probe, fail-closed on present, unreadable probe, down exact, forbidden verbs; entity column name equals the migration's |
| `services/api-gateway/src/migrations/__tests__/1803000000000-AddUserAgentWorkflowColumns.spec.ts` | line 90 only, D5 |
| `frontend/app/[locale]/results/page.tsx` (new) | wrapper |
| `frontend/components/results/` (new) | `results-screen.tsx`, `results-list.tsx`, `results-detail.tsx`, `results.logic.ts`, `results-api.ts`, `use-results.ts`, tests in three languages |
| `frontend/components/platform/platform-dashboard.tsx`, `platform-dashboard.test.ts` | S1: link, badge, test pins |
| `frontend/package.json` | S2: test glob |
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | `results.*`, `platform.openResults`, `platform.unreadResults` |

Not changed: `orchestration.service.ts`, `collaboration.controller.ts`, `services/api-gateway/src/ai/`, `services/ai-service/`, `services/container-manager/`, the office components, the Team page, `frontend/hooks/`, `frontend/lib/`, any record.

Out of scope: starting or cancelling runs (Team page, OFFICE-07), the deploy (STAGING-DEPLOY-WF-01), the live check (BIZ-LIVE-04), trigger-started runs (TRIGGER-01; they will appear here as ordinary runs), results by email (RESULTS-MAIL-01), output files, cost per run, any auth, guard, cookie or CSRF change.

## 5. Gates

| Area | Command | Compare with |
|---|---|---|
| api-gateway | `npx jest --maxWorkers=2`, then `npm run build` | 3256 passed, 7 skipped, plus the 14 known `smoke.integration.spec.ts` failures; only those may fail |
| ai-service | `npx jest --runInBand` | 1310 passed, 1 skipped; rerun because its drift spec reads gateway source (it reads `system-agent-registry.ts`, which this task does not touch) |
| frontend | `npx tsc --noEmit`, `npm test`, `npm run build`, then `git restore -- frontend/tsconfig.tsbuildinfo` | 1432 passed; the test-script guard passes with the new glob |
| files | changed files are LF; `git diff --stat main -- <frozen paths>` empty (D18) | |

Checklists on the checkpoint: EVERY, UI, BACKEND, MIGRATION. FLOWS n/a (no checkpoint, revert or file-action change). MIGRATION item 1 names grok-4.7-xhigh for Cursor; the GOV-ROUTING-01 subagent table puts migrations on opus, which this task uses. Skills to read before UI work: `.agents/skills/impeccable`, `.agents/skills/emil-design-eng`; DESIGN.md applies (badge, label and platform shell tokens).

## 6. Follow-ups (named here, disposed at LOCK)

1. **STAGING-DEPLOY-WF-01 carries a migration.** Its body must say so: pre-migration backup, `1804000000000` applied, the down path, and host checks that the Results page loads and the count route answers. Superseded into that task's acceptance criteria at LOCK.
2. **Live check** (at BIZ-LIVE-04, in en, zh-TW and zh-CN): the badge shows the count after a run finishes; opening a result clears it; filters and paging; the three list states and four detail states; a workflow test run shows the Test run badge. Superseded into BIZ-LIVE-04's acceptance criteria.
3. **Trigger-started runs** appear in Results without a change; TRIGGER-01's stage-start should name the badge as the owner's notice. Superseded by TRIGGER-01.
4. **"Past runs" on the Team page could link to Results.** Keith's call: register as a small UI slice or drop.
5. **Cost per run on the result** (from `CreditDeductionRecord` by execution id, as 01C D8 reads it). Not in the plan. Keith's call: register NOT_READY or drop.

## 7. Stop conditions for the implementer

STOP and report if:
- `orchestration.service.ts`, anything under `services/api-gateway/src/ai/`, or `services/ai-service` would change;
- a file outside section 4 needs a change, including `platform-dashboard.tsx` or `frontend/package.json` unless the control plane widened the set before dispatch;
- a new dependency seems needed;
- the migration needs more than one nullable column, an index, a default or a backfill;
- the 1803 spec needs more than the one ordering line;
- a route would need a new guard, a change to `SessionOrApiKeyAuthGuard`, or an internal route;
- a gate fails outside the 14 known smoke failures.

## 8. Approval

Approved 2026-11-10 by the control plane. The plan (docs/AGENT-OPS-PLAN.md C12, C14, approved by Keith 2026-11-09) asks for a results list with an unread badge and run history; this design delivers that and adds nothing outside it.

- DECISIONs A to E: each recommendation taken. None changes product scope; each is reversible within this task.
- S1 and S2: the write set is widened by `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/platform/platform-dashboard.test.ts` and `frontend/package.json` (the test script line only), and PACKAGE is taken (it was UNOWNED; Lane 2 does not hold it). S3: no widening.
- Follow-ups 4 (a Team page link to Results) and 5 (cost per run on a result) are registered READY / NOT_READY at LOCK, Keith decides, unless Keith drops them first.
- Implementer: opus (Opus 5.5), in worktree `C:\Users\knlee\aisb-worktrees\RESULTS-01`, branch `lane/RESULTS-01`.
