# TRIGGER-TARGET-OFF-01 — Checkpoint

**Task:** TRIGGER-TARGET-OFF-01 — Show a switched-off workflow in the other trigger sections
**Status:** COMPLETE AND LOCKED — 2026-11-17. Built; frontend only, not deployed (next STAGING-DEPLOY-TGTOFF-01, which Keith approves).
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** FRONTEND, I18N.
**Source:** registered 2026-11-17 by the CHAIN-SOURCE-OFF-01 LOCK. Keith chose it on 2026-11-17 ("Start it").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with FRONTEND and I18N; exact write set of 28 paths | 6fecbee |
| 2. Implementation | sonnet subagent (Sonnet 5.5: frontend only, no auth, contract or backend change) in worktree lane/TRIGGER-TARGET-OFF-01; one send-back for stale test fixtures; fast-forwarded to main | c1f641f, 29f4043 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Why

A trigger whose target workflow is switched off or not yet switched on is refused at run time, with a reason code in its last run, but the page said nothing beforehand. CHAIN-SOURCE-OFF-01 did this for a chain trigger's source; its worker noted that the other sections already receive each workflow's status and do not use it.

## What changed (warn, not refuse)

**No gateway change.** All five trigger lists (schedule, event, mail, knowledge, chain) already answer each target as `{ kind, workflowId, name, status }`, with status active, draft, disabled or missing.

**Logic (schedules.logic.ts, shared):**
- `ScheduleTarget` gains an optional `status`; `readTargetStatus` is used by all five `readTarget` copies; an absent, unknown or `missing` status adds nothing, so behaviour is as before;
- `targetWorkflowStatus`, `targetNotOn`, `draftTargetStatus` (the page's workflow list wins; the saved target answers only when the list has no status), `targetSwitchNoticeKey` and `TARGET_WARNING_NOTICE_KEYS`;
- chain-triggers.logic.ts adds `chainSwitchNoticeKeyFor` (source and target together); the old `chainSwitchNoticeKey` is kept.

**Page, in the schedule, calendar-event, mail and knowledge sections, and the chain section for its target:**
- **Rows:** an amber line on a trigger whose target is switched off or not yet switched on (`<prefix>-target-status-<id>`, with `data-status`); a deleted target keeps its existing label and test id; an active target and the Chief of Staff show nothing new. In the chain section the target line sits under the target, apart from the source line.
- **Form:** an inline warning under the target picker when the chosen workflow is not on (`<prefix>-target-warning`, linked with `aria-describedby`); Save stays enabled; existing warnings stay.
- **Switch-on:** the trigger still switches on; the notice is amber and says it will not start anything until the workflow is on (`data-tone="warning"`, existing notice test id kept). In the chain section, with both source and target off, one combined notice (`notice.switchedOnBothOff`); a deleted source still wins.

**Text:** per section namespace (schedules, events, mail, knowledge, chain), `target.offNote`, `target.draftNote`, `form.targetOffWarning`, `form.targetDraftWarning` and `notice.switchedOnTargetOff`, plus `notice.switchedOnBothOff` for the chain: 26 strings in each of en, zh-TW and zh-CN, real translations with each namespace's 您 form.

**Visual:** the existing amber inline pattern with the Heroicons v2 Outline ExclamationTriangleIcon, as on the chain source line; no new component style or colour role; no motion; Chinese text wraps.

## Control-plane review and gates

**What the control plane read:**
- the five logic diffs (the shared helpers and each `readTarget`);
- the event and chain section diffs in full, and the pattern in the other three;
- the en and zh-TW message diffs;
- the send-back diff (fixtures and five parse expectations);
- the committed blobs, which have no CR.

The 23 changed paths are inside the approved write set; the five api test files were not needed.

| Gate (on the branch) | Result |
|---|---|
| frontend `tsc --noEmit` | rc 0 (before and after the send-back) |
| frontend tests | 2234 of 2234 (baseline 2185; 49 new), before and after the send-back |
| frontend build | rc 0; tsconfig.tsbuildinfo restored |

**After the merge:** main had not moved since the branch was cut, so the branch was fast-forwarded and its tree is what was gated.

**Reported:**
- **Send-back.** The worker noted that the existing target fixtures used `status: 'enabled'`, which the gateway never sends. The control plane sent it back to use `'active'`; five parse expectations then gained `status: 'active'`. One `'enabled'` stays in schedules-api.test.ts: a workflows-list loader input, not a target.
- **Skills read in part.** The worker read Impeccable's SKILL.md (first 120 lines) and Emil Kowalski's SKILL.md headings, and grepped DESIGN.md for amber and warning; it did not read Impeccable's reference files. The change reuses the pattern CHAIN-SOURCE-OFF-01 built after a full read of both skills, so the control plane accepted it, and records it here.
- **No permission was denied** to the worker.

**Live check (UI item 9):** what tests cannot prove:
- the real gateway's target status in all five lists and in the switch-on answer;
- the amber lines, form warnings and notices on screen;
- the three languages;
- phone width.

It is registered as STAGING-DEPLOY-TGTOFF-01.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Deploy and Keith's check of the five sections (UI item 9) | registered STAGING-DEPLOY-TGTOFF-01 |
| Worker: target fixtures used the non-gateway value 'enabled' | superseded: fixed in this task (29f4043) |

CHECKLIST: EVERY 11/11 (1: admitted 6fecbee; 2: 3-step; 3: sonnet named with its reason before dispatch; 4: self-contained brief, no further subagents; 5: 23 of the 28 approved paths; 6: 49 new tests; 7: gates rerun by the control plane on the branch, twice; 8: no runtime started; 9: tsbuildinfo restored; 10: worktree, junction, fast-forward and branch removal by the control plane; 11: FOLLOWUPS line), UI 8/9 + 1 in part (1: 26 strings in three files, real translations, tested; 2: I18N held; 3: Heroicons outline; 4: in part, both skills read only in part, see Reported; 5: DESIGN.md amber pattern; 6: the new warning states translated and tested, loading, failed and empty unchanged; 7: no redesign, routing, backend, dependency or refactor; 8: test ids kept; 9: live check registered in STAGING-DEPLOY-TGTOFF-01)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-TGTOFF-01) / 1 superseded (the stale target fixtures, fixed in this task) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-17 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- both lanes are now empty;
- nothing deployed: staging runs 0427246.
