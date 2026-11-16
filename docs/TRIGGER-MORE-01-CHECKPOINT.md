# TRIGGER-MORE-01 — Checkpoint

**Task:** TRIGGER-MORE-01 — Later triggers (split by Keith: the knowledge-file trigger built here; the chain and webhook triggers registered as their own tasks)
**Status:** COMPLETE AND LOCKED — 2026-11-16. Built, not deployed: STAGING-DEPLOY-KNOWTRIG-01 (Keith approves) and TRIGGER-KNOW-LIVE-01 follow.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS.
**Mutexes by slice:** S1 GATEWAY, MIGRATION, ENV; S2 GATEWAY; S3 FRONTEND, I18N.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan section 3.4, F6). Keith chose it on 2026-11-16 ("Start TRIGGER-MORE-01").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex | bedbc76 |
| 2. Stage-start | `docs/TRIGGER-MORE-01-STAGE-START.md`, fable subagent (Fable 5.1, stage-start drafts); resumed once after a server overload | bcdcb93 |
| 2. Approval, S1 admitted | Keith: "Yes, approve all" | 4812260 |
| 3. S1 tables, routes, switch | opus (a migration, new owner-scoped routes), fast-forwarded | 7f50509 |
| 3. S1 landed, S2 admitted | | 2d7f1cd |
| 3. S2 timer, read, batch, claim, start, skip | opus (unattended spend, the approval gate, cross-module reads), fast-forwarded | d60331e |
| 3. S2 landed, S3 admitted | | 3e44095 |
| 3. S3 page section | sonnet (UI in the frontend). The control plane sent it back once to read both UI skills, which added press feedback. Fast-forwarded | 3b2cd0b, a0d3bbd |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Keith's decisions (2026-11-16, stage-start section 11, all as recommended)

| # | Decision |
|---|---|
| Q1 | Split the three triggers |
| Q2 | The knowledge-file trigger first |
| Q3 | The chain trigger gets a read-only result tool, with ids only in the task |
| Q4 | Chain: completed runs only |
| Q5 | Webhook: nothing from the request reaches the task |
| Q6 | Webhook: not on staging before the beta decision |
| Q7 | One run per batch |
| Q8 | New or replaced content counts |
| Q9 | The run is told the folder, the time and the document ids only |
| Q10 | The first step starts without a click |
| Q11 | 3 triggers per owner, 5 starts per trigger per day |
| Q12 | A folder the Chief of Staff cannot read is refused; a workflow gets a warning |
| Q13 | A new `KNOWLEDGE_TRIGGERS_ENABLED` |
| Q14 | Nothing read or recorded while runs are off |
| Q15 | The page section is slice S3 |
| Q16 | The switch goes back off after the live check |

## What changed

- **S1:**
  - **Migration 1813:**
    - `agent_knowledge_triggers` holds one folder id per trigger; its CHECK is length only, and the routes enforce the nine fixed ids.
    - `agent_knowledge_trigger_runs` is unique on trigger and `document_key`.
  - **Routes:** `/api/knowledge-triggers` (GET, POST, PATCH, DELETE, GET runs).
    - Browser session and harness access; an API key alone gets 401.
    - Owner-scoped, at most 3 per owner, under a lock in its own namespace (1813).
    - `armed_at` is set at create, at switch-on and when the folder or zone changes.
  - **Folders:** the Chief of Staff's readable folders are imported from the system-agent registry, and the nine folder ids from `knowledge-scopes.ts`.
  - **Switch:** `KNOWLEDGE_TRIGGERS_ENABLED`, default false, with its env template line.
  - **Audit rows:** ids, the target kind and the folder id only.
- **S2:**
  - **Timer:** its own 60-second timer, silent while the switch is off. Nothing is read or recorded while runs are off.
  - **The read:** one read of `knowledge_documents` a tick, selecting id, owner, folder, content hash and change time only. It never loads a title or content: the select list is asserted, and a mutation test that adds `title` fails 47 tests.
  - **Matching:** the `armed_at` and 60-minute rules are compared in code.
  - **Batches:** one run per batch: 2 quiet minutes, at most 10 minutes after the oldest change, at most 10 documents, oldest first.
  - **Claims:** one per document version, keyed on the SHA-256 of trigger id, document id and content hash. A claim is never retried.
  - **Limits:** the day limit of 5 counts runs in flight; there is a cap of 50 rows a day; at most 5 batches go to the start path per tick.
  - **Starting:** as the owner, with the saved task plus one fixed line naming the folder id, the local time and zone, and the document ids. A batch with a non-UUID id is refused. The first step is approved as the owner, and a refusal cancels the created run.
- **S3:** the "When a file is added" section on the Schedules page:
  - list, create, edit, switch, delete with a confirm step, and history;
  - the banners, the limit, the batch sentence, the folder picker with the folder names that already exist, the Chief of Staff folder rule, and the workflow warning;
  - every code, reason and outcome in en, zh-TW and zh-CN, with the code lists pinned to the gateway source;
  - press feedback on its buttons, respecting reduced motion.
- **Unchanged:**
  - nothing under `orchestration/`, `knowledge/`, `system-agents/`, `chat/`, `ai/`, `auth/`, `guards/`, `safety/` or `connectors/`;
  - `/api/schedules`, `/api/event-triggers` and `/api/mail-triggers`;
  - `HARNESS_ENTITLEMENT_PROOF_V1`.

## Control-plane review and gates (rerun on every branch)

| Slice | What the control plane read | Gates |
|---|---|---|
| S1 | the migration, the controller guards, the lock namespace, the audit payload, the imported folder lists | gateway 5995 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S2 | the five-column select, the runs-off and switch-off order, the batch constants, the task builder | gateway 6117 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S3 | the screen wiring, the three message files (valid JSON, real Chinese), LF | frontend tsc rc 0, 2114 of 2114, build rc 0, `tsconfig.tsbuildinfo` restored |

The 14 known failures are in `smoke.integration.spec.ts` and need a database. Each slice changed only its own write set, and every file is LF (`git ls-files --eol` i/lf w/lf).

**Design calls the workers made inside the approved design** (accepted by the control plane):
- **S1:**
  - the history row carries the owner's own `documentId`;
  - the folder CHECK is length only;
  - `knowledge_trigger_invalid_folder` sits beside `knowledge_trigger_folder_not_readable`.
- **S2:**
  - one local date per batch (that of the newest change);
  - in-flight claims count toward the day limit;
  - 5 batches per tick;
  - the row cap trims a batch;
  - the run service reads the switch itself as well;
  - audit rows add `scopeId` and `documentCount`.

## Not proven here

- **Database:** migration 1813 and the per-owner lock against PostgreSQL.
- **Time zones:** whether the `TIMESTAMP` columns (no time zone) compare correctly on the host, which depends on the gateway process's and the database session's zones.
- **Real runs:** batch timing against real uploads, and the cost of a run that reads several documents.
- **The page:** in a browser, at phone width, and the Chinese wording, which was written by the worker.

All of these belong to STAGING-DEPLOY-KNOWTRIG-01 and TRIGGER-KNOW-LIVE-01.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| F1 deploy and live check | registered STAGING-DEPLOY-KNOWTRIG-01 and TRIGGER-KNOW-LIVE-01 |
| F2 the chain trigger | registered TRIGGER-CHAIN-01 |
| F3 a read-only result tool | registered RESULT-TOOL-01 |
| F4 the webhook trigger | registered TRIGGER-WEBHOOK-01 |
| F5 owner-named folders | superseded by KNOW-FOLDERS-01 (note) |
| F6 wait notice and "started by a new file" | superseded by TRIGGER-WAIT-NOTICE-01 and TRIGGER-ORIGIN-01 (notes) |
| F7 inventory lines and the API-key route | superseded by ACCESS-READY-01 (note) |
| F8 the switch line | superseded by GOV-CHECKLIST-01 (note) |
| F9 later mail filters (the note on this task) | registered TRIGGER-MAIL-FILTERS-01 |
| F10 a fifth mapper user, a fourth copy of helpers and section | superseded by REFUSAL-MAP-01 and TRIGGER-TIDY-01 (notes) |
| F11 the timer reads all triggers each tick | superseded by TRIGGER-SCALE-01 (note) |
| F12 a run-finished event | superseded by TRIGGER-CHAIN-01 (in its scope) |
| F13 a daily-cap review | superseded by ACCESS-READY-01 (note) |
| S1, S2: the copied helpers and test store | superseded by TRIGGER-TIDY-01 (note) |
| S3: the document count per batch in the history list | superseded by TRIGGER-UI-POLISH-01 (note) |
| S3: hover effects gated behind `(hover: hover)` across the Schedules sections | superseded by TRIGGER-UI-POLISH-01 (note) |

CHECKLIST: EVERY 11/11 (1: admitted bedbc76, each slice admitted; 2: 4-step with an approved stage-start; 3: fable, opus and sonnet named before each dispatch; 4: self-contained briefs, no further subagents; 5: each slice inside its write set; 6: tests in every slice; 7: gates rerun by the control plane on every branch; 8: no runtime started; 9: tsconfig.tsbuildinfo restored, dist ignored; 10: worktrees and fast-forwards by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, internal-key or guard change; 2: internal routes untouched; 3: no generated-app template; 4: `/api/schedules`, `/api/event-triggers`, `/api/mail-triggers` and HARNESS_ENTITLEMENT_PROOF_V1 untouched, the `/api/knowledge-triggers` shapes kept by S3; 5: the schema change under MIGRATION in S1; 6: compared with the baselines), MIGRATION 4/4 (1: held for S1, opus; 2: ordered after 1812, tested; 3: up and down tested with mocks; 4: down drops only its two tables), UI 9/9 (S3: three languages through the hook, real Chinese; I18N held; Heroicons v2 Outline; both SKILL.md files read after the control plane sent the slice back (Impeccable's product register and the start of harden read; its audit, polish and critique references not opened), press feedback applied; DESIGN.md classes as the sibling sections; every state translated and tested; one section, no backend; existing test ids kept; the browser flows named for STAGING-DEPLOY-KNOWTRIG-01)
FOLLOWUPS: 6 registered (STAGING-DEPLOY-KNOWTRIG-01; TRIGGER-KNOW-LIVE-01; RESULT-TOOL-01; TRIGGER-CHAIN-01; TRIGGER-WEBHOOK-01; TRIGGER-MAIL-FILTERS-01) / 11 superseded (F5, F6, F7, F8, F10, F11, F12, F13 as listed; the S1 and S2 helper copies by TRIGGER-TIDY-01; the S3 document count and hover gating by TRIGGER-UI-POLISH-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED (the other mutexes were released at their slices);
- nothing deployed: staging still runs 4259466.
