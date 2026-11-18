# GOV-ARCH-MAIL-AUTH-01 — Checkpoint

**Task:** GOV-ARCH-MAIL-AUTH-01 — Name the refused mail sign-in state in ARCHITECTURE.md
**Status:** COMPLETE AND LOCKED — 2026-11-18.
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. GOVERNANCE was held for this record only.
**Source:** registered 2026-11-18 by the CONN-MAIL-AUTH-STATE-01 LOCK. Keith saw the drafted text and approved it on 2026-11-18 ("Yes, land it").

## What changed (exactly the approved text)

**ARCHITECTURE.md** (four lines changed, none added):
1. **The data-ownership row "Connector credentials":** `sign_in_refused_at`, when the mail server last refused the saved password (CONN-MAIL-AUTH-STATE-01).
2. **The internal connector call route:**
   - the fixed child text and the mark guarded by `updated_at`;
   - the fixed 409 before any sign-in, passed to the model as is;
   - Verify still signing in, with its 502 on a refusal;
   - clearing on save or a good Verify;
   - `signInRefusedAt` on `GET /api/connectors`.
3. **The mail-trigger paragraph:** a refused mailbox is not read until the owner reconnects. That is not a failed read, and the list reports `sign_in_refused`.
4. **The connector broker status row:** deployed 11cf987 by STAGING-DEPLOY-MAUTH-01 and proven by MAIL-AUTH-LIVE-01 on 2026-11-18.

**PRD.md:** no change. It does not describe connector failure states.

## Correction

The CONN-MAIL-AUTH-STATE-01 stage-start (D5) and checkpoint call the list route `GET /api/connections`. The route is `GET /api/connectors`, and that is where the code put the field. The locked documents are not edited; this record carries the correction.

CHECKLIST: EVERY 11/11 (1: a registered task, recorded here as governance; 2: 2-step; 3, 4, 6, 7, 9: n/a, no worker and no code; 5: only ARCHITECTURE.md and the records; 8: no runtime; 10: the control plane's own record; 11: FOLLOWUPS line), GOVERNANCE 9/9 (1: GOVERNANCE held, no OS semantics changed; 2, 3, 7: n/a, no new task, admission or new work; 4: no lane, no integration; 5: n/a, no code; 6: board and backlog end status only; 8: only the approved text, no locked document edited; 9: validator run)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- GOVERNANCE released UNOWNED;
- both lanes empty.
