# RESULTS-01 — Checkpoint

**Task:** RESULTS-01 — Results list, unread badge and run history (plan C12, C14)
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan row 31). Admitted 2026-11-10 under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY, FRONTEND, I18N and MIGRATION (corrected to 4-STEP for stored read state) | 689535c |
| 2. Stage-start | docs/RESULTS-01-STAGE-START.md, drafted by a fable subagent; DECISIONs A to E taken on their recommendations; write set widened by the platform dashboard, its test and the frontend test script, with PACKAGE | 22bbbec |
| 3. Implementation | opus subagent (Opus 5.5: a migration and owner-scoped routes, across the gateway and the frontend) in worktree lane/RESULTS-01 (7aa2adde), cherry-picked onto main | a44efe3 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

The worker stopped once. Registering the new controller broke a pin in `orchestration/__tests__/orchestration.persistence.spec.ts`. That file is inside the registered write set (the whole orchestration folder), so the control plane told the worker to add the one line. The test's purpose is unchanged.

## What was built

**Migration `1804000000000-AddCollaborationRunResultSeenAt`.**
- Up: `ALTER TABLE "public"."collaboration_runs" ADD COLUMN "result_seen_at" timestamptz NULL`. Down: `DROP COLUMN "result_seen_at"`.
- Each first probes `information_schema.columns`. Up refuses if the column is present, down refuses if it is absent, and an unreadable probe refuses either way.
- No index, default, backfill or transaction calls. Reversible; down loses only the seen marks.
- The spec checks that 1804 is now the latest, and that the entity column matches. The 1803 spec's ordering line moved to the `<= 1803` form.
- Down was tested with mocks, not against a database.

**Entity.** `CollaborationRunEntity.resultSeenAt`, nullable, with `update: false`. An orchestration save of a run loaded earlier therefore cannot write a stale null over the mark. Only the guarded UPDATE writes it.

**Routes.** All are under `@Controller('results')` with `SessionOrApiKeyAuthGuard`, and use the same entitlement rule as the collaboration routes: 401 without identity, 403 without harness access. No new guard, no internal route, and no CSRF change; see Follow-ups.

| Route | Answer |
|---|---|
| `GET /api/results?status=&workflowId=&from=&to=&page=&pageSize=` | `{ results, page, pageSize, total }`. Owner-scoped, newest first, with skip/take and a count; one referral read per page. Each item carries run id, project, status, times, team, workflow `{id,name,testRun}`, task (200 code points), excerpt (240 code points of the last completed hand-off's answer) and seenAt. 400 on bad status, workflowId, dates, `from` after `to`, a repeated parameter, or page and pageSize out of range (pageSize 20 by default, at most 50) |
| `GET /api/results/unread-count` | `{ count }`: the owner's completed, failed and timed_out runs with `result_seen_at IS NULL`; no settling on read |
| `POST /api/results/:runId/seen` | `{ seenAt }`. 404, with no write, for a missing run or another owner's run. Otherwise one `UPDATE … WHERE run AND user AND result_seen_at IS NULL`; a repeat call returns the first time |

The detail view still uses the unchanged `GET /api/collaboration/runs/:id`. `orchestration.service.ts`, `collaboration.controller.ts`, `services/api-gateway/src/ai/` and ai-service are not changed: the frozen-path diff against the branch base is empty, so HARNESS_ENTITLEMENT_PROOF_V1 is untouched.

**Frontend.**
- A `/[locale]/results` page (`components/results/`) with filters, a pager, and the detail opening in place.
- Opening a result posts seen once, after the detail loads, and clears its mark without refetching the list.
- List states: loading, empty, empty after filtering, failed with Try again, 403 notice, and loaded. Unread rows show a dot and "New"; test runs show the Test run badge.
- Detail states: loading, not found, failed, an answer as plain text (line breaks kept, HTML escaped), no answer, sources, failure reason, and still running.
- A Results link in the Command Center header (`platform-open-results`, InboxIcon), with a count pill in the badge-active tokens. A non-200 or a bad body hides the pill; above 99 it shows "99+".
- 65 new keys in each of en, zh-TW and zh-CN. The catalog tests check key parity and that the Chinese is real.
- The worker applied:
  - **Impeccable:** no em dashes, no modal, restrained colour, unread shown by weight, no nested cards.
  - **Emil:** no entrance animation, a subtle press state that is off under reduced motion, the shared spinner.
  - **DESIGN.md:** the page shell, badge tokens, one focus ring and brand buttons.

## Gates (control-plane rerun on main after the cherry-pick)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3328 passed, 7 skipped, 14 failed; all 14 are the known smoke.integration failures (baseline 3256 passed) |
| gateway `npm run build` | exit 0 |
| ai-service `npx jest --runInBand` | 1296 passed, 1 skipped, 0 failed (the CM-CLEANUP-01 baseline; its drift spec reads gateway source) |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1489 passed, 0 failed (baseline 1432) |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| line endings | the 26 files are LF in this checkout |

## Limits

- **Not deployed.** The next staging deploy (STAGING-DEPLOY-WF-01) carries a migration: the deploy tool takes a pre-migration backup, applies 1804 and stores the new hash.
- **The SQL has run only against mocks:** the list query with the workflow `EXISTS` filter, the count, and the guarded UPDATE. The live check exercises them on staging.
- **The browser flows** need Keith's live check, in BIZ-LIVE-04.

CHECKLIST: EVERY 11/11, UI 9/9 (9: the live check is listed in BIZ-LIVE-04), BACKEND 6/6 (1: no guard, auth, cookie or CSRF change; 4: frozen-path diff empty; 6: only the 14 known smoke failures), MIGRATION 4/4 (1: the MIGRATION mutex, a 4-step loop, opus per GOV-ROUTING-01 for subagent migrations; 3: down written and tested with mocks)

FOLLOWUPS: 2 registered / 4 superseded / 0 dropped / 0 undisposed.

**Registered:**
- RESULTS-POLISH-01, NOT_READY: a "Past runs" link from the Team page to Results (stage-start follow-up 4), and refreshing the header count while the Command Center stays open (worker).
- RESULTS-COST-01, NOT_READY: the cost of each run on its result (stage-start follow-up 5).

**Superseded:**
- The migrating deploy, by an acceptance line in STAGING-DEPLOY-WF-01 (follow-up 1).
- The live-check list, by an acceptance line in BIZ-LIVE-04 (follow-up 2).
- Trigger-started runs showing in Results with the badge as the notice, by a line in TRIGGER-01 (follow-up 3).
- The collaboration and results POSTs relying on the SameSite cookie with no CsrfGuard, by a scope line in ADMIN-CSRF-01 (worker).

Not follow-ups: four scratch files the worker left in the user's Temp folder (`results-fakes.ts`, `results-fakes-body.ts`, `results-controller-head.ts`, `results-controller-tests.ts`), which are housekeeping.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. GATEWAY, FRONTEND, I18N, MIGRATION and PACKAGE are released UNOWNED.
