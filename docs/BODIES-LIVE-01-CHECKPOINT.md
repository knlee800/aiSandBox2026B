# BODIES-LIVE-01 — Checkpoint

**Task:** BODIES-LIVE-01 — Deploy mail bodies and one live briefing
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** registered by the CONN-03 LOCK (c36872c). Keith admitted it on 2026-11-10 ("Start BODIES-LIVE-01") and reported his part "Done". This is a separate LOCK record under the GOV-OS-04 rules.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | in the CONN-03 LOCK | c36872c |
| 2. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT | fbbf41d |
| 3. Deploy, runs on, Keith's briefing, measuring, runs off | from the staging host and Keith in the app | no code change |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (bod-deploy.sh, 2026-11-10, done 02:58:21Z UTC)

8e0bc55 to fbbf41d, with aisandbox-deploy rc 0.

Before the deploy:
- HEAD and DEPLOYED were at 8e0bc55 and the tracked tree was clean.
- All eleven configuration files were at the baseline hashes.
- The flags were stub, stub and false.
- Nothing was running, and the ops library was 3f380d7c in both places.

After the deploy:
- HEAD and DEPLOYED are at fbbf41d. The migration hash is unchanged (ece5f19b...), and so are the configuration files and the flags.
- All eight units are active.
- Caddy returns 401 without login on five paths, and gateway health returns 200 on three paths.
- Nine frontend pages return 200 in three languages, including /connections in all three.
- 25 guard checks return 401, and the static test key gets 403.
- CORS refuses a foreign origin and echoes the app origin.
- The running connector server lists both tools, and its mail tool description names the body excerpt.
- The new description is in the connectors-mcp, gateway and AI service builds, and the body limits are in the connectors-mcp build.
- `mailAndCalendarRead` is in all three message files, and `headersOnly` is gone.
- Nothing was running.

The deploy reused COS-EVAL-LIVE-02's check section without its line that rewrote /root/aisb-sdc/check.done.

## Runs on (bod-on.sh, 02:58:53Z) and off (bod-off.sh, 03:15:10Z)

Runs were switched on and off the same way as BIZ-LIVE-03:
- Both env files were saved to /root/aisb-bod and checked against the baseline hashes.
- Runs were on: anthropic with claude-opus-5-5, global execution on, 4 runs a minute, a `max_tokens` request limit of 16,000 per run, and the tool loop with write and validation tools.
- The stored test key was used and never shown. No cap was set, and the default daily credit limits stayed in place.
- The run hashes were the same as BIZ-LIVE-03's (gateway.env 1f8a1dea..., ai.env 132ebab3...).

After the restore:
- Both files are back at the baseline hashes (gateway.env 568af710..., ai.env 721f4772...).
- AI_PROVIDER is stub and GLOBAL_EXECUTION_ENABLED is false.
- The gateway is ready and the four units are active.

No output contains key text.

## Keith's briefing and the measured cost (bod-cost.sh, from the host)

| | BIZ-LIVE-03 (headers only) | BODIES-LIVE-01 (body excerpts) |
|---|---|---|
| Briefing run | 10,372 tokens, 23.8 s | **21,337 tokens, 27.3 s** (03:12:47 to 03:13:33 UTC) |
| Credits | 27 for two runs (briefing and one question) | **22** for the one briefing |
| Mail connector call | 25 messages, 4,533 bytes, 2.9 s | **25 messages, 25,564 bytes, 5.2 s** |
| Calendar call | 0 events, 13 bytes, 0.3 s | 0 events, 13 bytes, 0.3 s |

Read from the content-free audit rows (item count, result bytes, duration) and the usage and credit records. The control plane read no mail or briefing text.

What the numbers show:
- **Bodies arrived.** The mail result grew by about 21 KB for the same 25 messages, roughly 840 bytes each. That fits excerpts near the 800-character cap, under the 32,000-character and 60 KB result limits, with no message dropped.
- **The cost.** A briefing with bodies costs about twice the tokens of a headers-only one: 21,337 against 10,372.
- **No time limit needed.** The mail call took 5.2 of its 20 seconds, below the 10-second mark that would have registered a separate body-phase time limit.
- **No connector warnings,** and nothing was open afterwards.

Keith reported "Done" for his steps, with nothing wrong reported:
- he read the Connections page copy in en, zh-TW and zh-CN;
- he ran the Morning briefing on the Chief of Staff team and read it;
- he checked in Gmail that the mail in the briefing was still unread.

Nothing being marked read also rests on the code:
- INBOX is opened with EXAMINE;
- every body fetch is BODY.PEEK, as tested in CONN-03.

## Limits

- One briefing, one account, one day's mail.
- The briefing's quality is Keith's judgement, not scored.
- The planted-body injection case was tested in COS-EVAL-LIVE-02, not live here.
- Gmail is the only mail preset tried live.
- Keith's mail and calendar stay connected on staging. Runs are off.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: only records written, host state changed by the deploy and the run switch, which was restored; 8: no local runtime started), DEPLOY 7/7 (1: STAGING held; 2: baseline hashes before and after the deploy and after the restore; 3 and 7: n/a, tester window closed; 4: nothing running, commit and migration hash as expected, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text, no mail content recorded), LIVE 4/4 (1: PROVIDER-LIVE and CREDIT held; 2: no cap set before, by the task's scope; default daily credit limits stayed; the expected spend was about twice a briefing; the key came from the stored key file and was never shown; 3: cost and mail-call figures from the host's usage, credit and audit records; the page, briefing and unread checks from Keith's own report; 4: n/a, no fix needed)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed. The body-phase time limit is not needed: 5.2 s of 20.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY.
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED.
- stagingAuthorized, providerLiveAuthorized and creditAuthorized false.
- Staging runs fbbf41d with runs off.
