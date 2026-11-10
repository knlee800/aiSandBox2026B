# BIZ-LIVE-03 — Checkpoint

**Task:** BIZ-LIVE-03 — First live briefing and its cost
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**. Keith's first live briefing ran on his own account with his mail and calendar connected. The cost was measured from the host, and runs are off again.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan item C6). Keith admitted it on 2026-11-10 ("Start BIZ-LIVE-03") and reported his part "Done". This is a separate LOCK record under the GOV-OS-04 rules.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | GOV-BIZ-AGENT-OPS-PLAN-01 | earlier record |
| 2. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT | 55cf8c1 |
| 3. Runs on, Keith's run, cost, runs off | from the staging host and Keith in the app | no code change |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Runs on (bl3-on.sh, done 2026-11-09T16:54:55Z UTC)

Before the switch:
- The host id matched and DEPLOYED was 8e0bc55.
- Both env files were at the baseline hashes (gateway.env 568af7100b1d..., ai.env 721f47728899...).
- Nothing was running, and no credits had been used that day.

The script saved both files to /root/aisb-bl3, then switched runs on with the tester-window settings:
- **Gateway:** AI_PROVIDER anthropic, claude-opus-5-5, GLOBAL_EXECUTION_ENABLED true, 4 runs a minute, 16,000 tokens per run.
- **AI service:** the tool loop on, with write and validation tools.
- The key came from the stored key file and was never shown.

No cap was set before the run. The default daily credit limits stayed in place (500 per user, 1,000 for the platform). The gateway and AI worker came up ready.

Run hashes: gateway.env 1f8a1dea0a24..., ai.env 132ebab3244d...

## Keith's run (2026-11-10, 01:35 to 01:57 UTC)

| Time (UTC) | Host record |
|---|---|
| 01:35:02 | The wrong-password try reached Gmail's mail server and was refused (ConnectorBroker warning, AUTHENTICATIONFAILED) |
| 01:39:56 | Mail connected (imap, Gmail preset); Verify at 01:40:30 |
| 01:51:37 | Calendar connected (ical); Verify at 01:51:40 |
| 01:54:02 to 01:54:52 | Morning briefing on the Chief of Staff team: one Ask run, two connector calls (mail and calendar) through the internal connector route, completed |
| 01:57:05 to 01:57:20 | One plain Knowledge question with the connections present: one Ask run, no connector call, completed |

Keith read the briefing in the app. His own report: "Done", with nothing reported wrong. The control plane did not read his mail or briefing text. The host output carries no mail content, addresses or account names.

## Cost (bl3-cost.sh, from the host, everything since the switch)

| Run | Model | Tokens | Run time |
|---|---|---|---|
| Morning briefing | claude-opus-5-5 | 10,372 | 23.8 s |
| Plain Knowledge question, connections present | claude-opus-5-5 | 15,812 | 10.5 s |
| **Total** | | **26,184** | **34.3 s** |

- Credits: 27 in total, from two deduction records. The platform's default limits were not approached.
- No other account ran anything, and nothing was open afterwards.
- The briefing cost less than the Knowledge question. The two connector calls added little, and the plain question did not call the connectors even though it held the grants.

## Screen checks (Keith in the app; the write-off half from the host)

Keith reported all of these "Done" with nothing wrong:
- **Connections page:** the data statement above both cards; the mail-server failure for a wrong password; connecting with the real one; Verify showing the checked time; Disconnect asking first; zh-TW and zh-CN rendering; the header link beside Knowledge.
- **Team page:** the Morning briefing button and hint appear only with the Chief of Staff team, and the button fills the task box without starting.
- **OFFICE-06 desk panel:** Tab and Enter open a recent run's saved output with its line breaks, and Back and Escape return focus.
- **OFFICE-05 desks:** separate desks and the waiting badge; Open goes to the Team page; no approve, reject or edit control.
- **AGENT-WRITE-UI-01, Keith's account with write on:** no notice.

The host confirms the first Connections item: the wrong-password failure is at 01:35:02, and both connections show their Verify times.

**The write-off half of AGENT-WRITE-UI-01 was not seen on screen.** No account on staging has harness access with Agent write off (host count 0). The host confirmed:
- the notice's test id is in the deployed frontend build (4 files);
- the agentWriteOffNotice key is in all three message files.

The rendering for such an account is covered by the AGENT-WRITE-UI-01 tests. The scope allowed this half to be "checked from the host or by Keith". It is recorded as a host check of the build, not as a screen check.

## Runs off (bl3-off.sh, 2026-11-10T02:03:19Z UTC)

Before the restore:
- Nothing was running.
- The saved copies were at the baseline hashes.

After restoring both files byte for byte:
- Gateway ready 200.
- Both env files at the baseline hashes again.
- AI_PROVIDER stub and GLOBAL_EXECUTION_ENABLED false (confirmed again by bl3-notice.sh).
- All four units active.
- Staging runs 8e0bc55.

Every output was checked for key text, and none was found.

Evidence in `C:/Users/knlee/aisb-preflight/BIZ-LIVE-03/`:

| File | SHA-256 |
|---|---|
| `bl3-on.sh` | `8f69b80aa6ad1ae11838f667a611695b508680460e91020e4ad1fea1c92f1794` |
| `bl3-on.out` | `b59f3a197deb86f34ec697450bea48cf1731ce75bbc7cfd96765abbdbc860053` |
| `bl3-cost.sh` | `b2af1b334bc43b6fc318664df7bc043e8660e610361ccab22ae8542e2a7e6915` |
| `bl3-cost.out` | `67e42d15c2db9a0cd3f1a85185caf5b90671fbf303aec9c69238169423c1b154` |
| `bl3-off.sh` | `ac9523df556a1576587a2447c5a99538ed99b87465542ac11d770a9b697a49f8` |
| `bl3-off.out` | `0d3b47aa3fc17d29ec68f05118ca0d4ee49d4d3f0df42e6be80e492e8ef8d845` |
| `bl3-notice.sh` | `30a8e9a62c3b9ed135d7a2f631c72eaa55be81015e1c0d03773e4140c1a4f3bf` |
| `bl3-notice.out` | `36f9dd0a97b3bf7fe12448f69b49951c792edfb8507698ce3fe6328ec3063510` |

## Limits

- One briefing and one question on one account, one model, one day's mail and calendar.
- Mail is headers only; bodies are CONN-03.
- The briefing's quality is Keith's judgement, not scored.
- Keith's mail and calendar stay connected on staging, encrypted. He can disconnect them on the Connections page.
- Runs are off. stagingAuthorized, providerLiveAuthorized and creditAuthorized are false after this lock.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: only records written, host state changed only by the switch and restored; 8: no local runtime started), DEPLOY 7/7 (no deploy, host change only: 1: STAGING held; 2: baseline hashes before the switch and after the restore, run hashes recorded; 3 and 7: n/a, tester window closed; 4: nothing running before and after, DEPLOYED 8e0bc55 unchanged, gateway ready, configuration back at the baseline; 5: from the host; 6: outputs checked for key text, no mail content recorded), LIVE 4/4 (1: PROVIDER-LIVE and CREDIT held; 2: no cap set before, by the task's scope, default daily credit limits stayed, expected spend a few briefings' tokens; key from the stored key file and never shown; 3: cost and run results from the host usage, credit, run and connection records, screen checks from Keith's own report; 4: n/a, no fix needed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY.
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED.
- stagingAuthorized, providerLiveAuthorized and creditAuthorized false.
- AGENT-SPEC-01's dependency on this task is met; its start stays Keith's decision.
