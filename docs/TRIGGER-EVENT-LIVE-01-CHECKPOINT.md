# TRIGGER-EVENT-LIVE-01 — Checkpoint

**Task:** TRIGGER-EVENT-LIVE-01 — Live event-trigger check and the event-trigger wording
**Status:** COMPLETE AND LOCKED — 2026-11-16. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **Mutexes:** STAGING, ENV, PROVIDER-LIVE and CREDIT (tester window closed); GOVERNANCE for the wording in this record only.
**Source:** registered 2026-11-15 by the TRIGGER-EVENT-01 LOCK. Keith said "Go" after the STAGING-DEPLOY-EVENT-01 lock; admitted f1d71d9. The stored Anthropic test key was used.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized, providerLiveAuthorized and creditAuthorized true | f1d71d9 |
| 2. Two phased run windows with Keith | from the host and with Keith | none (host state only) |
| 3. LOCK | PRD.md and ARCHITECTURE.md in Keith's approved words ("Approved"); this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts

The files are in `C:\Users\knlee\aisb-preflight\TRIGGER-EVENT-LIVE-01\`, generated from the TRIGGER-LIVE-01 scripts by `mk_elv.py`. They were installed on the host in `/root/aisb-elv-scripts/` (mode 600).

| File | SHA-256 |
|---|---|
| `elv-phase.sh` (window 1) | `1e415ab0d00a875d8cce274e3f1b95a79f88e9c8250d32bddb060c5fd9386913` |
| `elv-off.sh` (window 1) | `a7dc8c023d214d00e7fbce08254a57daf301eb3ac6e2bcd08610fde2cb2ddd8b` |
| `elv-status.sh` (window 1, read only, after one query fix) | `8bf2f6af2f0b659b76e321ffaff47f3e00b75d9807035c5ad877fdca5911e7b2` |
| `elv2-phase.sh`, `elv2-off.sh`, `elv2-status.sh` (window 2, a fresh run folder) | `9680888b…7e3423`, `d664517c…7ebff1`, `64add071…80014d` |

The outputs are `elv-*.out` and `elv2-*.out`. A scan for key text found none.

## What happened

**Window 1** (01:49 to 02:13 UTC):
- **Phase A**, event triggers on with runs off: no calendar read and nothing recorded over two ticks (Keith's Q12).
- **Phase B**, runs on: the calendar reads succeeded but always returned no events. Keith's Google Calendar was set to another time zone, so the events were not at the Hong Kong times he typed.
- **Closed** at Keith's request, with the files restored.

**Window 2** (02:20 to 03:31 UTC):
- **Still empty at first:** the reads stayed empty, because the events were in a different Google account from the connected calendar.
- **Finding the account:** the host showed only the connection's plain fields. The calendar was connected on 2026-11-10 09:51 HK, beside the knlee802 mailbox. The stored link was not decrypted.
- **Diagnostic run:** a Chief of Staff calendar question run by Keith during the window cost 6 credits.
- **The events:** Keith added them in the connected account's calendar, and the checks below ran.

**Window 2 settings:**
- the stored Anthropic test key (never shown), `AI_PROVIDER=anthropic`, `PROVIDER_ANTHROPIC_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=true`;
- a per-minute cap of 4, the tool loop on, **write and validation tools off**;
- phase C: `MAX_DAILY_CREDITS_PER_USER=1`.

**Off (03:31):** both files restored byte for byte to `23c838b8` and `721f4772`; `EVENT_TRIGGERS_ENABLED=false`, `SCHEDULES_ENABLED=false`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`, `CHAT_DISCORD_ENABLED=true`; units active; Discord ready.

## The checks (Keith's PINEAPPLE20 trigger: Chief of Staff, lead 30 minutes, title word PINEAPPLE21; Hong Kong times)

| # | What | Result |
|---|---|---|
| 1 | Event triggers on, runs off | no `connector.trigger_read` row, no history row |
| 2 | "PINEAPPLE21 planning" 11:30 | `started` at **11:00:16**, exactly start minus lead. One read-only step (write tools off), first step approved by the owner; `completed`; Results unread +1; 12 credits |
| 3 | Gateway restart at 11:02, during that run | ready in 4 seconds; no second row or run for that occurrence. The run completed; the restart also re-read the calendar (empty memory), as designed |
| 4 | "PINEAPPLE21 cancel me" 11:45, deleted by Keith at about 11:14 | at 11:15:16 the cached occurrence was claimed, the confirm read no longer had it, and it was `skipped / event_changed` with no run. Google's link showed the deletion within about a minute |
| 5 | "PINEAPPLE21 all day", and "Coffee" with no marker | no row for either |
| 6 | "PINEAPPLE21 cap" 12:00 with the per-user cap at 1 | `skipped / over_cap` at 11:30:14; no run, no credits |
| 7 | Marker words PINEAPPLE20 and PINEAPPLE21 | in no `audit_events` row and no journal line |
| 8 | Calendar reads (both windows) | 14, all `ok`, average 0.7 seconds (at most 1.1), at most 440 bytes; content-free audit rows (action, toolId, userId, itemCount, resultBytes, durationMs, outcome) |
| 9 | Cost | 12 credits for the triggered run (plus Keith's 6-credit diagnostic question) |

Audit rows for the event triggers in window 2 were `event_run_started` ×1 and `event_run_skipped` ×2 (`event_changed`, `over_cap`). Their payload keys are triggerId, localDate, targetKind, workflowId, collaborationRunId and reason only.

## Wording landed (Keith approved the exact text on 2026-11-16, "Approved")

- **PRD.md:**
  1. a section 11 GATED row for event triggers;
  2. the front-door sentence: the Discord chat channel, schedules and event triggers are now GATED;
  3. section 8: the calendar is also read on a timer for the owner's event triggers.
- **ARCHITECTURE.md:**
  - **Section 2:** the in-process timers line names the event-trigger timer, and the triggers line names `EVENT_TRIGGERS_ENABLED`.
  - **Section 15:** the event-trigger timer is added to the list.
  - **Section 13.7:** the first sentence is widened, and a new event-trigger paragraph follows.
  - **The connectors-mcp line (:56):** gains the gateway-only window read.
  - **Smaller lines:** a section 3 Triggers line, a section 7 data-model row, the section 8 routes, and a section 13.1 status row.

## What this proves

- **Real runs from the calendar:** event triggers start real read-only runs from the owner's real calendar at start minus lead. The run is told the times only, the first step starts without a click, and the result reaches Results.
- **Once per event:** a gateway restart makes no second start.
- **Skips:** a deleted event is skipped at the confirm read, all-day and non-matching events are ignored, and the daily cap is respected.
- **No reads while runs are off.**
- **Privacy:** no title or task text reaches logs or audit rows.
- **The feed:** Google's private iCal link reflected an added event within about 10 minutes and a deletion within about 1 minute.
- **Back to off:** staging returns to event triggers, schedules and runs off (Keith's Q16).

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records, PRD.md and ARCHITECTURE.md as approved, host state; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before each phase and restored byte for byte after each window; 3 and 7: n/a, tester window closed; 4: nothing running before each phase or off, health and worker ready, units active; 5: from the host; 6: outputs scanned for key text, the stored key never shown, the stored calendar link never decrypted), LIVE (PROVIDER-LIVE and CREDIT for the windows only; the stored test key; 18 credits in all; write tools off; windows closed and files restored), GOVERNANCE (Keith approved the exact wording; GOVERNANCE held for this record and released)
FOLLOWUPS: 1 registered (CONN-CAL-LABEL-01: show which calendar is connected, so a wrong-account calendar is visible) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- GOVERNANCE held for the wording and released UNOWNED;
- the three authorizations false;
- staging runs 60fe280 with event triggers, schedules and runs off and Discord on.
