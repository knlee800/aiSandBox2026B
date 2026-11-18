# MAIL-AUTH-LIVE-01 — Checkpoint

**Task:** MAIL-AUTH-LIVE-01 — Live check of the refused mail sign-in state
**Status:** COMPLETE AND LOCKED — 2026-11-18. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **Mutexes:** STAGING, ENV, PROVIDER-LIVE, CREDIT.
**Source:** registered 2026-11-18 by the CONN-MAIL-AUTH-STATE-01 LOCK. Keith opened the window on 2026-11-18 ("Yes, run it").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT; the three authorizations true | f2f119b |
| 2. Window | from the staging host on 11cf987, 2026-11-18 09:06:39Z to 09:56:06Z, with Keith's steps on the Connections page | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## The window

- **Phase a (09:07:40Z):** env files saved at the baselines (gateway.env 616841ca, ai.env 721f4772). Nothing changed. Runs, write and validation tools, every trigger switch and schedules were off.
- **Phase b (09:32:47Z):** the stored Anthropic test key (never shown), claude-opus-5-5, runs on, the tool loop on, write and validation tools off. The AI worker was ready.
- **Phase c (09:33:02Z):** MAIL_TRIGGERS_ENABLED on.
- **Off (09:56:06Z):**
  - env files restored byte for byte to 616841ca and 721f4772;
  - every flag back: AI_PROVIDER stub; runs, schedules, event, mail, knowledge and chain triggers and the run-result tool off; Discord on;
  - all four units active.

## Results

The connector rows come from the audit table. They carry the event, tool, outcome, item count and duration only.

| # | Step | Result |
|---|---|---|
| 1 | Runs off. Keith pressed Verify with his real password (09:17:04), then disconnected and connected again with a wrong app password (09:26:10, 09:26:33) and pressed Verify (09:26:46) | `connector.verify` error after 7599 ms (Gmail was reached and refused). The connection was marked `sign_in_refused_at` 09:26:46, and its `updated_at` stayed at the save time 09:26:33. ✓ |
| 2 | Keith looked at the Connections and Schedules pages and said "Done" | He did not describe what he saw in words. The builds carry the texts (STAGING-DEPLOY-MAUTH-01). |
| 3 | Runs and mail triggers on. A Chief of Staff run, PINEAPPLE71: list unread mail and repeat any error | `connector.call mail_list_unread_metadata` error, 0 items, **6 ms**: refused before any sign-in. The run completed. Its answer (478 characters) contains the exact text "The mail server refused the saved password." and names reconnecting and the Connections page. 7 credits. ✓ |
| 4 | The mail-trigger timer while marked (60-second tick, from 09:33:02) | No `connector.trigger_read` row until the mark was cleared. Unmarked, it would have read within about a minute of the restart, as in MAIL-READ-LIVE-01. No failure counted; both triggers stayed `ok`. ✓ |
| 5 | Keith disconnected and saved his real app password (09:46:54, 09:48:06), then pressed Verify (09:48:13) | `connector.verify` ok, 1 item; the mark was cleared (`sign_in_refused_at` none). ✓ |
| 6 | The timer after the reconnect | `connector.trigger_read mail_list_recent` ok, 5 items, at 09:54:04. No trigger matched and no run started. ✓ |

**Proven live, which tests could not prove:**
- Gmail's real refusal carries imapflow's `authenticationFailed` flag;
- the guarded update matches in real PostgreSQL (millisecond compare) and leaves `updated_at` alone;
- migration 1815's column works;
- the 409 text reaches the model;
- the timer skips while marked and resumes after a reconnect.

**Privacy:**
- no app-service journal line in the whole boot holds a PINEAPPLE7 or PINEAPPLE3 marker or a knlee80 address;
- no audit row in the window holds either;
- no mail history row holds a marker or an address.

**After the close (checked at 10:03:13Z, seven minutes later):**
- 0 connector rows, 0 mail-trigger rows and 0 usage records since the close;
- 0 open executions and 0 active runs;
- the temporary key revoked;
- the connection healthy (not marked, verified 09:48:13);
- env files and Caddyfile at the baselines (616841ca, 721f4772, 205770cf).

**Credits:** 7 over 1 usage record (expected 10 to 30).

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/MAIL-AUTH-LIVE-01/`.

| File | SHA-256 |
|---|---|
| `mal-a.out` | `62f06e662f19d9ca860ad5c85fa05b6523f364dddda623f85077491c10d7b8b0` |
| `mal-after.out` | `db754a4434bfe8c59fd6b2d24eeb5f03cc129a7134a7bcfefb217edd70adf3be` |
| `mal-after.sh` | `4b2d8c59999ca2f265af592510b207cb9bf6a5edf43bb1e3e5f08e5f17fc4562` |
| `mal-b.out` | `4b550ee01c4f897c01a1a90158683df3e020068e11a31e4ff271780176912887` |
| `mal-c.out` | `1793437e29029d65b316e93b136360cd460ad2547962614c3b5bcd4699a8845a` |
| `mal-off.out` | `68917eb828aa33b210a8b2c6029638f880e3fcec80390ec3eed81b4bdec76f20` |
| `mal-off.sh` | `ab165bfd91af38a53f84d586db5caa11716c248e69fba7219c1190b67601dab1` |
| `mal-phase.sh` | `ed7918f3b75d8c3f57383a445a9f0a40b50c392decd840abd4c9ba4aaff3d412` |
| `mal-pre.out` | `60a14779629f5dc25e9332170d9db6329ba40f03decc630476c9564fb8cf4d17` |
| `mal-pre.sh` | `a39d92f9afb6da14f81972c694fde872917838b1d6506ef6dbe2d8cef5e7b1d0` |
| `mal-r1.out` | `a17ce3ed8683664df047ef44766a93b3d6d8030d272b17fcc4752bef2e8d4b74` |
| `mal-run.sh` | `92d7aa1771314a198be31afe100a1ccf8f09150ae207ff05d55c987257ceb898` |
| `mal-s1.out` | `8e62d20fe3a88cb8383aa7e85842e92310fc8282b4b7dc3f17e10ef7bf741aae` |
| `mal-s2.out` | `89c532dbe402f7e9ec47b62ddefdc3cb405f3df2c69d6af288c5a38bf06d8002` |
| `mal-s3.out` | `9b24104007d0e46e1136e380b0cbefadac5078981ee096c6fe24de4a575c4da2` |
| `mal-s4.out` | `dd323c768a152956299bfd21507ce22de278f19b2ba41fbca20083540464a50a` |
| `mal-s5.out` | `3d1a070a162395114da82ab90fb7efaa1e423672646ca1e8e6653179cc6ac87f` |
| `mal-status.sh` | `6b59dd03c8422944ff8afe9339ba253495f3ef69c286434fc0f38b05408a6fd7` |
| `run.sh` | `2756e9b6a16ff563e0db0de8ccafcfd8e911da864557b9089278d2031c920afa` |

Every output was scanned for key text; none was found.

## Limits

- **The pages.** Keith did the page steps and said "Done", but did not describe what he saw. The page rendering was not observed by the control plane. The texts are in the builds and covered by tests (CONN-MAIL-AUTH-STATE-01).
- **The timer skip.** The skip writes no row and no log line. That it skipped, rather than not ticking, rests on two things: the 60-second tick, and the read that came within six minutes of the mark clearing.
- **Phone width.** The warning line at phone width was not checked.
- **How the mark was set.** Keith reconnected by disconnecting and connecting again, not by saving over the connection. Both paths clear the mark: a new row has none, and a replace sets it to null (tested in CONN-MAIL-AUTH-STATE-01).

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only, restored; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), LIVE 3/4 + 1 n/a (1: PROVIDER-LIVE and CREDIT held; 2: the expected spend (10 to 30 credits) stated before the window, the key read from the stored key file on the host and never shown; 3: every result from host-side audit, usage, run and connection rows; 4: n/a, no fix was needed, so no pause)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed (GOV-ARCH-MAIL-AUTH-01 was registered by CONN-MAIL-AUTH-STATE-01).

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- stagingAuthorized, providerLiveAuthorized and creditAuthorized false;
- staging runs 11cf987, with runs and every trigger switch off.
