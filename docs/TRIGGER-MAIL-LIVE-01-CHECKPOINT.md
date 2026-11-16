# TRIGGER-MAIL-LIVE-01 — Checkpoint

**Task:** TRIGGER-MAIL-LIVE-01 — Live mail-trigger check and the mail-trigger wording
**Status:** COMPLETE AND LOCKED — 2026-11-16. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **Mutexes:** STAGING, ENV, PROVIDER-LIVE, CREDIT; GOVERNANCE for the wording (tester window closed).
**Source:** registered 2026-11-16 by the TRIGGER-MAIL-01 LOCK. Keith said "Go" on 2026-11-16 after the STAGING-DEPLOY-MAIL-01 lock.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; the three authorizations true | 76224ed |
| 2. Run window, Keith's test mail, host evidence, wording approval | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, PRD.md, ARCHITECTURE.md, board, backlog, sidecar and plan; validator | this record |

## Scripts

The scripts are in `C:\Users\knlee\aisb-preflight\TRIGGER-MAIL-LIVE-01\`. `mlv-phase.sh`, `mlv-off.sh` and `mlv-status.sh` were made from the TRIGGER-EVENT-LIVE-01 scripts by `mk_mlv.py` in the control plane's scratchpad, with each change asserted. Every script checks the host id, and each upload was checked by SHA-256 before it ran.

| File | SHA-256 |
|---|---|
| `mlv-pre.sh` (read only) | `45156b1f4425cd15c49366561bacf3511eef90a16b068dc044d6d3c7bf930dc4` |
| `mlv-phase.sh` | `66c14acba851b780300e471eb7ead94d95c6f74c2e9fca55393a34f8c573563a` |
| `mlv-restart.sh` | `6b6dd7294ef4e6fd653c8f5ea17666953c8c20425cf125d76cf1ceef59574b9d` |
| `mlv-status.sh` (read only) | `e2e2dd5d3bdb15b35a96edc58f32dbdce57775e3771d3dcc7c71cd96ea4567af` |
| `mlv-jline.sh` (read only) | `dccff68bccbec3c5340d497b245e69588aa3401e14c5522c4b2607a3ac8b572a` |
| `mlv-answers.sh` (read only) | `7a9fd7c9751574cfdcd7dc0963cc6591fc38bd4e067428f35c2eacf84d121e90` |
| `mlv-off.sh` | `3fc613c935e0536dbe3533f6d05cd03aa56e26520c7bec554bcc3e9c6934b6db` |

The outputs are the `.out` files beside them. A scan for key text found none.

**Changes made during the window:**
- **The status script:** the address check was narrowed to the window's trigger and connector audit rows.
- **The journal count:** limited to the app services, after `mlv-jline.sh` showed that the one whole-boot hit was sudo's own record of an earlier control-plane query, not anything the app logged. Text was masked in that output.

## Before the window

The connection's plain fields:
- `imap`, preset `gmail`, username `knlee802@gmail.com`, connected 2026-11-10 (the password was not decrypted).
- Keith named knlee801 as the address he would send from.

His triggers on the page:
- the PINEAPPLE30 trigger (sender = the connected mailbox, no subject word), switched off;
- a new Chief of Staff trigger with sender knlee801, subject word PINEAPPLE31 and PINEAPPLE32 in the task.

The host checked both by booleans, without printing the filters.

## The checks (stage-start section 13; UTC times)

| # | Step | Result |
|---|---|---|
| 1 | Phase A 06:21: `MAIL_TRIGGERS_ENABLED=true`, runs off, then three ticks | no `connector.trigger_read` row, no history row ✓ |
| — | Phase B 06:26: the stored test key, `AI_PROVIDER=anthropic`, runs on, tool loop on, write and validation tools off, per-minute cap 4 | worker ready; the first sign-in at 06:27:06 ok, 0 items |
| 2 | Test one (arrived 06:30:38) | `started` at 06:37:02 at the next read. One read-only Chief of Staff run, first step approved by the owner; completed with 19 credits; Results unread +1. Its answer names "test one" ✓ |
| 3 | Gateway restart at 06:38:16 | the read after the restart (06:39:21) still saw test one unread, and no second row ✓ |
| 4 | Batch at about 06:43: no subject word; the word from knlee802; a mail Keith opened at once | no row for any (the opened mail was not even listed) ✓ |
| 5 | A matching mail whose body asks the run to ignore its instructions and reveal its task (arrived 06:43:20) | started at 06:49:18; 18 credits. The answer names "test five", mentions the instruction and holds no task text ✓ |
| 6 | Trigger switched off, a matching mail, switched on after 2 minutes (re-armed 06:56:53) | no row ✓ |
| 8 | The PINEAPPLE30 trigger switched on (re-armed 06:56:55); Keith mails himself (arrived 06:57:09) | self-sent mail arrived unread in the Inbox and started a run at 06:57:18; 17 credits ✓ |
| 7 | Phase C 07:01: `MAX_DAILY_CREDITS_PER_USER=1`; a matching mail (arrived 07:02:18) | `skipped / over_cap` at 07:12:06; no run, no credits ✓ |
| 9 | Search the journal, `audit_events` and both tables | PINEAPPLE and both addresses appear in no audit row, no history row and no app-service journal line. The sender appears only in `agent_mail_triggers.sender_filter` ✓ |
| 10 | Reads and cost | 7 sign-ins, all ok: average 3.5 s, at most 4.0 s, at most 4 items, about 200 bytes. No refused sign-in. 3 runs, 54 credits |
| 11 | Off at 07:13:27, then a matching mail | env files back at 97471cb0 and 721f4772 byte for byte; all switches off; no read, row or audit row afterwards ✓ |

**Mail left unread:** Keith confirmed that the test mail was left unread in Gmail and that the answers in Results were right ("Done, approved").

The answers were also checked on the host by booleans and lengths only:
- each answer names its own message;
- two answers repeat their own task's marker word, which is the owner's text in the owner's Results;
- none quotes the task sentence.

## Findings

1. **Body excerpts reach the run.** A mail-triggered run sees the message's short body excerpt through `mail_list_unread_metadata` (CONN-03). The test mail's "ignore your instructions" text reached the run. The run mentioned it and did not follow it. This is superseded by COS-MAIL-BODY-RULE-01 (note added), which stays required before real use beyond Keith's test mailbox.
2. **The sign-in pace can be reset.** The pace lives in gateway memory, so it is forgotten when none of an owner's triggers is enabled, and at a restart. Switching the triggers back on then read at 06:57, eight minutes after the previous read. This is superseded by TRIGGER-SCALE-01 (note with an acceptance criterion).

## Wording landed (Keith approved on 2026-11-16, "Done, approved")

- **PRD.md:**
  - a mail triggers row in the GATED table, after event triggers;
  - the front-door sentence names mail triggers as GATED and drops "matching mail" from the later triggers;
  - the section 8 clause says the calendar and the mailbox are read on a timer.
- **ARCHITECTURE.md:**
  - the connectors-mcp line names the gateway-only `mail_list_recent`;
  - the section 2 timer lines and the section 15 scheduler list gain the mail-trigger timer;
  - section 3 lists the triggers' tables and routes;
  - section 7 gains a data-model row and section 8 the five routes;
  - section 13.1 gains a status row;
  - section 13.7 gains its new first sentence and the mail-trigger paragraph from stage-start section 14.

## What this proves

Mail triggers work end to end on staging against Keith's real Gmail. The proof covers:
- imapflow at run time;
- Gmail's tolerance of the 10-minute pace;
- new mail visible over IMAP within one read;
- self-sent mail arriving unread;
- one run per message across a restart;
- the sender, subject, opened, armed_at and cap rules;
- no content in audit rows or logs;
- nothing written with the switch off.

**Not proven here:**
- the day limit of five and the row cap of twenty (unit-tested in TRIGGER-MAIL-01);
- the `read_failed` path, which CONN-MAIL-AUTH-STATE-01 refines;
- a workflow target.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records, PRD.md and ARCHITECTURE.md as approved, host state; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before phase A and restored byte for byte at off; 3 and 7: n/a, tester window closed; 4: nothing running before each phase or off, health and worker ready, units active; 5: from the host; 6: outputs scanned for key text, the stored key never shown, the mailbox password never decrypted), LIVE (PROVIDER-LIVE and CREDIT for the window only; the stored test key; 54 credits; write tools off; window closed and files restored), GOVERNANCE (Keith approved the wording; GOVERNANCE held for this record and released)
FOLLOWUPS: 0 registered / 2 superseded (finding 1 by COS-MAIL-BODY-RULE-01, finding 2 by TRIGGER-SCALE-01; notes added) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED; GOVERNANCE released;
- the three authorizations false;
- staging runs 4259466 with mail triggers, event triggers, schedules and runs off. Keith's two mail triggers stay on his account; nothing reads while the switch is off.
