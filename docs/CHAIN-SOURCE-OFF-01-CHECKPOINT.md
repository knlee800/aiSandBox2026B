# CHAIN-SOURCE-OFF-01 — Checkpoint

**Task:** CHAIN-SOURCE-OFF-01 — Show and check a chain trigger's switched-off source workflow
**Status:** COMPLETE AND LOCKED — 2026-11-17. Built; not deployed (next STAGING-DEPLOY-SRCOFF-01, which Keith approves).
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** GATEWAY, FRONTEND, I18N.
**Source:** registered 2026-11-17 by the TRIGGER-CHAIN-LIVE-01 LOCK. Keith chose it on 2026-11-17 ("Start both").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY, FRONTEND and I18N; write set widened to 15 paths at dispatch, then to 16 | c430a5b, 895a125, 81bc212 |
| 2. Implementation | opus subagent (Opus 5.5: a gateway and frontend change) in worktree lane/CHAIN-SOURCE-OFF-01 (99a59a7); cherry-picked to main because main had moved | c948115 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Why

Keith's chain trigger was saved with a source workflow that had been switched off since 2026-11-11. The After a workflow finishes section showed nothing about it, so the trigger could never fire and nothing said so.

## What changed (warn, not refuse: the control plane's choice at admission)

**1. Gateway (additive).**
- What the view carries:
  - each trigger in GET /api/chain-triggers, and in the create and update answers, now carries `source: { workflowId, name, status }`;
  - it is built as the target's view is: status active, draft or disabled, or missing with name null when the workflow is deleted or not the owner's;
  - `sourceWorkflowId` is unchanged.
- How it reads workflows:
  - `list()` reads source and target workflows in one query;
  - `create()` reuses the source it already checked;
  - `update()` reads only the workflows the change did not check.
- Unchanged:
  - no refusal, route, guard, entity, migration, timer or run-service change;
  - a save or switch-on with a switched-off source still succeeds;
  - no workflow name or task in audit rows or log lines.

**2. Page.**
- **Trigger rows:** a trigger whose source is switched off, not yet switched on, or deleted shows an amber line saying it will not start anything until the source is on. The existing `chain-trigger-source-gone-<id>` test id is kept; the new id is `chain-trigger-source-status-<id>`.
- **Form:** it warns under the source picker when the chosen workflow is not on, and Save stays enabled.
- **Switch-on:** switching on such a trigger shows an amber notice instead of the plain "switched on".
- **Source of the status:**
  - the page's workflow loader (`loadResultsWorkflows`, `WorkflowOption`) now passes through the status the workflows route already sent;
  - the gateway's `source` wins;
  - an older gateway without it falls back to the workflow list, as before.

**3. Text.** Six new strings in en, zh-TW and zh-CN, real translations; zh-CN uses 您, as the namespace does.

**Design (from the worker's report).**
- What it read: DESIGN.md, Impeccable (SKILL.md, product, polish and ux-writing references) and Emil Kowalski (SKILL.md).
- How the new UI fits:
  - it reuses the section's existing amber inline pattern and Heroicons outline ExclamationTriangleIcon;
  - no new component or colour role;
  - no motion, because these lines appear on load or a state change;
  - text wraps for longer Chinese.

## Control-plane review and gates (rerun on the branch)

**What the control plane read:**
- the gateway diff;
- the loader and option-type diff;
- the chain logic and section diffs;
- the three message diffs;
- the committed blobs, which have no CR.

The 16 changed paths are exactly the approved write set.

| Gate | Result |
|---|---|
| gateway `tsc --noEmit` | rc 0 |
| gateway tests (`--maxWorkers=2`) | 6559 passed, 7 skipped, 14 failed: only the known smoke.integration suite (it needs a running stack); baseline 6549 / 7 / 14, so 10 new tests, all passing |
| gateway build | rc 0 |
| frontend `tsc --noEmit` | rc 0 |
| frontend tests | 2185 of 2185 (baseline 2167; 18 new) |
| frontend build | rc 0; tsconfig.tsbuildinfo restored |

**After the cherry-pick:** main had moved only by records and ai-service eval files since the branch was cut, so the gateway and frontend gates were not rerun on main.

**Reported:**
- **The worker stopped once, correctly.** An existing test outside its write set (schedules-api.test.ts) pinned the loader's exact shape, which now carries the status. The control plane added that one file (81bc212); its one expected value changed and nothing else.
- **No permission was denied** to the worker.

**Live check (UI item 9):** what tests cannot prove is Keith's view of the section on staging:
- the source line on a switched-off source;
- the form warning;
- the amber switch-on notice;
- the three languages;
- phone width.

It is in STAGING-DEPLOY-SRCOFF-01.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Deploy and Keith's check of the section (UI item 9) | registered STAGING-DEPLOY-SRCOFF-01 (it also carries the two eval tasks to the host) |
| Worker: the schedule, event, mail and knowledge sections now receive each workflow's status but do not show a switched-off target | registered TRIGGER-TARGET-OFF-01 |

CHECKLIST: EVERY 11/11 (1: admitted c430a5b; 2: 3-step; 3: opus named with its reason before dispatch; 4: self-contained brief, no further subagents; 5: the 16 approved paths, write set widened twice by the control plane and recorded; 6: 10 gateway and 18 frontend tests; 7: gates rerun by the control plane on the branch; 8: no runtime started; 9: tsbuildinfo restored; 10: worktree, junctions, cherry-pick and branch removal by the control plane; 11: FOLLOWUPS line), UI 9/9 (1: six strings in three files, real translations, tested; 2: I18N held; 3: Heroicons outline; 4: both skills read and applied as above; 5: DESIGN.md colours and components; 6: the new warning states translated and tested, loading, failed and empty unchanged; 7: no redesign, routing, dependency or refactor; the gateway change admitted; 8: test ids kept; 9: live check registered in STAGING-DEPLOY-SRCOFF-01), BACKEND 6/6 (1: no auth, cookie, CSRF, key or guard change; 2: internal routes untouched; 3: no generated-app template; 4: additive view field, no frozen contract; 5: no entity or schema change; 6: the 14 known smoke.integration failures only)
FOLLOWUPS: 2 registered (STAGING-DEPLOY-SRCOFF-01, TRIGGER-TARGET-OFF-01) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-17 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY, FRONTEND and I18N released UNOWNED;
- Lane 2 (COS-EVAL-LABEL-01) still active;
- nothing deployed: staging runs ea75557.
