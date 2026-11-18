# GOV-ARCH-MAIL-READ-01 — Checkpoint

**Task:** GOV-ARCH-MAIL-READ-01 — Name the one-message mail tool in ARCHITECTURE.md
**Status:** COMPLETE AND LOCKED — 2026-11-18.
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. GOVERNANCE was held for this record only.
**Source:** registered 2026-11-18 by the MAIL-READ-LIVE-01 LOCK. Keith saw the drafted text and approved it on 2026-11-18 ("Yes, land it").

## What changed (exactly the approved text)

**ARCHITECTURE.md** (three lines changed, none added):
1. **The connectors-mcp line near the top:** the server also reads one Inbox message by its id, read or unread, with the same fields and excerpt (`mail_read_message`, CONN-MAIL-READ-01).
2. **The internal connector call route:** `mail_read_message` is a companion of `mail_list_unread_metadata`: not in the tool catalog and not savable in a workflow or a system agent's list; the Gateway adds it to a job's `connectorGrants` and token only beside the unread-mail tool, and the route accepts it only from such a token; its one argument is the message id; an id not in the Inbox answers a fixed 404 with no mail content.
3. **The connector broker status row:** since CONN-MAIL-READ-01 (deployed 355e6db by STAGING-DEPLOY-MREAD-01; proven by MAIL-READ-LIVE-01 on 2026-11-18) one Inbox message by its id, read or unread, through the same EXAMINE and BODY.PEEK read.

**PRD.md:** no change. Its mail-trigger row already says the run reads the message with its own mail tool, which stays true.

CHECKLIST: EVERY 11/11 (1: a registered task, recorded here as governance; 2: 2-step; 3, 4, 6, 7, 9: n/a, no worker and no code; 5: only ARCHITECTURE.md and the records; 8: no runtime; 10: the control plane's own record; 11: FOLLOWUPS line), GOVERNANCE 9/9 (1: GOVERNANCE held, no OS semantics changed; 2, 3, 7: n/a, no new task, admission or new work; 4: no lane, no integration; 5: n/a, no code; 6: board and backlog end status only; 8: only the approved text, no locked document edited; 9: validator run)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane; GOVERNANCE released UNOWNED; both lanes empty.
