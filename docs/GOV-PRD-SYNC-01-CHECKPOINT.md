# GOV-PRD-SYNC-01 — Checkpoint

**Task:** GOV-PRD-SYNC-01 — PRD office note and the no-scheduler principle (with the live features and the office decisions)
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP (wording in Keith's words, then this record).
**Source:** registered 2026-11-10 by the GOV-ARCH-SYNC-01 LOCK, with items added on 2026-11-10, 2026-11-11 and 2026-11-12.

## How the wording was decided

The control plane drafted each piece in chat, and Keith replied "ok" to each one on 2026-11-12. The text applied is the text he approved.

| Piece | Where | Change |
|---|---|---|
| 1 | PRD.md GATED table; the "User workflows and the Chief of Staff front door" paragraph | Two GATED rows:<ul><li>the Chief of Staff front door, proven on staging 2026-11-11 (FRONTDOOR-LIVE-01);</li><li>user teams, approval settings per workflow and Chief of Staff drafts, proven on staging 2026-11-11 (USER-TEAMS-LIVE-01).</li></ul>One sentence added to the paragraph: these are now GATED, and the rest stays approved FUTURE until proven. |
| 2A | PRD.md line 483 | The "RPG walking-town / moving-character simulation … not the current or next committed product" line is replaced. The office page is CURRENT; the isometric pixel-art office is approved FUTURE and the next office step (OFFICE-SCENE-01). A user-built office, selling pieces, a user-walked character and voice come later. |
| 2B | PRD.md office note (was "Future office UI note (approved FUTURE; not current; not scheduled)") | Replaced by "Office (page CURRENT; isometric scene approved FUTURE)" with Keith's decisions: look, size, room, movement, controls, voice and art. The points to revisit at UI planning and the review-record link are kept. The old reference-repository sentence and "live office integration is not implemented" are removed, because both are out of date. |
| 3 | ARCHITECTURE.md section 2, lines 186-187 | "No cron jobs / No platform schedulers for session maintenance" is reworded:<ul><li>no cron jobs and no session schedulers;</li><li>in-process timers only for run recovery and collaboration upkeep: the stuck-run watchdog and the 5-minute collaboration sweep, which never touch session idle or lifetime;</li><li>user schedules (TRIGGER-01) are approved FUTURE: an in-process gateway timer, off by default, with daily limits.</li></ul> |
| 4 | PRD.md CURRENT table | One row: the office page, with one desk per agent, run status from the server, team hand-offs on role desks, and run detail and cancel from a desk, for signed-in users. |

## Effect

- **OFFICE-SCENE-01:** PRD.md no longer blocks it. Its start condition records that this item is done. It still waits for:
  - palette v2 approval;
  - Keith's character tool test and the first test set;
  - the drawing-layer approval.
- **Recorded live state:** the PRD now shows what ARCHITECTURE.md section 13.1 already records as live on staging.

## Not changed

- **The PRD's FUTURE list** still has the row "Deeper RPG / simulation (not current; not the next committed product)". It is not in the approved pieces, so it is left as it is. It is read as the deeper simulation beyond the office scene.
- **Line references:** other PRD lines and ARCHITECTURE.md section 13.1 rows are unchanged. Earlier records cite the walking line as line 482; it was line 483 when edited.

CHECKLIST: EVERY 11/11 (1: Keith approved each piece in chat; 2: 2-step governance; 3, 4, 6, 7, 9: n/a, no worker and no code; 5: only PRD.md, ARCHITECTURE.md and the records; 8: no runtime; 10: the control plane landed its own record; 11: FOLLOWUPS below), GOVERNANCE 3/3 (1: GOVERNANCE held for this record and released at lock, with no OS-semantics change; 2: no new task registered; 3: nothing admitted)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane. GOVERNANCE is released UNOWNED.
