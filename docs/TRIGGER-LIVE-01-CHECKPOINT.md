# TRIGGER-LIVE-01 — Checkpoint

**Task:** TRIGGER-LIVE-01 — Live trigger check and the triggers architecture wording
**Status:** COMPLETE AND LOCKED — 2026-11-15. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **Mutexes:** STAGING, ENV, PROVIDER-LIVE and CREDIT (tester window closed); GOVERNANCE for the wording in this record only.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01. Keith said "Go" after the STAGING-DEPLOY-TRIG-01 lock; admitted 6a9377d. The window used the stored Anthropic test key, so no new key was needed.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized, providerLiveAuthorized and creditAuthorized true | 6a9377d |
| 2. Phased run window with Keith | from the host and with Keith | none (host state only) |
| 3. LOCK | PRD.md and ARCHITECTURE.md in Keith's approved words ("Approved"); this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts

The scripts are in `C:\Users\knlee\aisb-preflight\TRIGGER-LIVE-01\` and were installed on the host in `/root/aisb-tlv-scripts/` (mode 600).

| File | SHA-256 |
|---|---|
| `tlv-phase.sh` (PHASE a, b, c) | `53737d03164814f0b90584dadbf532a66a89e07724712b635d2f092093732f12` |
| `tlv-off.sh` | `4c14ba79347e177bd26f52344f7690aa5748aa6b7166d7f294bbf328e48a9650` |
| `tlv-status.sh` (read only) | `c5f381ae7b98aefd935b596b359bfc162654eacbef0c4d0ade02e99fe2013675` |

The outputs are `tlv-a.out`, `tlv-b.out`, `tlv-c.out`, `tlv-off.out` and `tlv-s1.out` to `tlv-s6.out`. A scan for key text found none.

## The window (2026-11-15T07:00:10Z to 07:38:00Z)

| Phase | Settings | Checked first |
|---|---|---|
| A (07:00) | gateway.env and ai.env saved; `SCHEDULES_ENABLED=true`; runs off | deployed f32d88b; env files at the baselines 15000e51 and 721f4772; write tools off; nothing open |
| B (07:02) | the stored Anthropic test key (never shown), `AI_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-opus-5-5`, `PROVIDER_ANTHROPIC_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=true`, a per-minute cap of 4; the tool loop on, **write and validation tools off**; gateway and AI service restarted, worker ready | gateway.env is the phase A file |
| C (07:32) | `MAX_DAILY_CREDITS_PER_USER=1` (Keith had used 59 credits today) | gateway.env is the phase B file |
| Off (07:38) | both files restored byte for byte from the saved copies: gateway.env `15000e51`, ai.env `721f4772`; `SCHEDULES_ENABLED=false`, `GLOBAL_EXECUTION_ENABLED=false`, `AI_PROVIDER=stub`, `CHAT_DISCORD_ENABLED=true`; units active | nothing running |

Discord reconnected after every restart.

## The checks (Hong Kong time; every schedule Keith's own, made on the Schedules page)

| # | What | Result |
|---|---|---|
| 1 | PINEAPPLE7 (Chief of Staff, 14:50), due while runs were off | when the timer started, 10 minutes late (inside the window): one `skipped / runs_off` row, one `run_skipped` audit row, no run; no retry on later ticks or after the restarts |
| 2 | PINEAPPLE8 (Chief of Staff, 15:20) | `started` at 15:20:07: a run with one step, `constraint_read_only=true`, `constraint_allow_write_tools=false`, first step approved by the owner; `completed`; Keith's Results unread count went 42 to 43; 14 credits |
| 3 | Gateway restart at 07:22:20, during that run | ready in 2 seconds; the run completed; no second row or run for that schedule that day |
| 4 | PINEAPPLE9 (one of Keith's workflows, 15:21; the workflow was switched off) | `skipped / workflow_off` with an audit row; no run. A real reason code from the start code |
| 5 | PINEAPPLE10 (Chief of Staff, 14:00, made at 15:17) | never evaluated: no row (the `armed_at` rule); Keith later deleted it |
| 6 | PINEAPPLE12 (Chief of Staff, 15:35) with the per-user cap at 1 | `skipped / over_cap` with an audit row; no run, no credits |
| 7 | Marker words PINEAPPLE7 to 12 | in no `audit_events` row and in no journal line for the whole boot |
| 8 | Cost | 14 credits and 1 usage record in the window |
| — | A workflow set to "every hand-off" waiting on the Team page | not run: Keith has no switched-on workflow with that setting and chose to skip it ("No, skip that check"). Dropped by Keith, 2026-11-15; the approval code is unchanged and its tests cover the rule |

Audit rows in the window are `run_skipped` ×3, `run_started` ×1, `schedule_created` ×4 and `schedule_deleted` ×1. Their payload keys are `scheduleId`, `localDate`, `targetKind`, `workflowId`, `collaborationRunId` and `reason` only.

## Wording landed (Keith approved the exact text, 2026-11-15, "Approved")

**PRD.md** (3 lines added, 1 changed):
1. A section 11 GATED row for schedules.
2. The front-door sentence: the Discord chat channel and schedules are now GATED.
3. A "Platform maintenance schedulers" line after the "Background session cleanup" line, which itself is unchanged (PRD.md:472).

**ARCHITECTURE.md** (16 lines added, 3 changed):
- **Section 2:**
  - the in-process timers line now names the 60-second schedule timer;
  - the schedules line is GATED.
- **Section 15:** the schedule timer joins the list of in-process timers.
- **New section 13.7 Triggers (GATED).**
- **Section 3:** a gateway list line.
- **Section 7:** a data-model row.
- **Section 8:** the five `/api/schedules` routes.
- **Section 13.1:** a status row.
- **Line numbers:** the records named lines 177 and 1116; the lines that held this text were 187 and 188, and 1210 (stage-start P1).

## What this proves

- **Live on staging:** schedules start real read-only runs as the owner at the owner's local time. The first step needs no click, the result reaches Results, and the unread badge counts it.
- **Once a day:** one start per schedule per day, across a gateway restart.
- **Skips:** runs off, a switched-off workflow and the daily cap each skip with a reason and no retry.
- **Arming:** a schedule made after its time is not started that day.
- **Privacy:** no task text reaches logs or audit rows.
- **Switch off:** with `SCHEDULES_ENABLED` off, nothing starts.

Staging is back to schedules off and runs off (Keith's Q12). Keith's remaining test schedules (PINEAPPLE7, 8, 9 and 12) stay on his account and do nothing while the switch is off.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records, PRD.md and ARCHITECTURE.md as approved, host state; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before each phase and restored byte for byte after; 3 and 7: n/a, tester window closed; 4: nothing running before each phase or before off, health and worker ready, units active; 5: from the host; 6: outputs scanned for key text, the stored key never shown), LIVE (PROVIDER-LIVE and CREDIT for the window only; the stored test key; 14 credits; write tools off; window closed and files restored), GOVERNANCE (Keith approved the exact wording; GOVERNANCE held for this record and released)
FOLLOWUPS: 0 registered / 0 superseded / 1 dropped (the every-hand-off wait check, by Keith 2026-11-15: no switched-on workflow with that setting; covered by the approval tests) / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- GOVERNANCE held for the wording and released UNOWNED;
- the three authorizations false;
- staging runs f32d88b with schedules off, runs off and Discord on.
