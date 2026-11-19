# TESTER-WINDOW-02 — Checkpoint

**Task:** TESTER-WINDOW-02 — Open Keith's run window on staging
**Status:** COMPLETE AND LOCKED — 2026-11-19 (window left OPEN until 2026-11-26, or earlier when Keith says stop)
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **Mutexes:** STAGING, ENV, PROVIDER-LIVE, CREDIT (during the switch-on only).
**Source:** Keith asked for a recommendation on 2026-11-19. The control plane recommended using the platform for a few days, and Keith said "Yes, draft it". He chose 7 days, 150 credits a day and "I'll tidy them first", then said "Done". Registered and admitted at once (GOV-OS-04).

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with the four mutexes; the three authorizations true; TESTER-WINDOW-CLOSE-02 registered NOT_READY | 6840202 |
| 2. Switch-on | tw2-on.sh phases a and b from the host; status check | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator; window left open | this record |

## Before (tw2-look2.out, after Keith's tidy-up)

| Trigger | State at opening |
|---|---|
| 4 schedules (14:50, 15:20, 15:21 and 15:35 HK; one targets the switched-off workflow ab4cb6ae) | all off |
| Before a meeting (30 minutes, title filter) | **on** |
| Mail from knlee802 | off |
| Mail from knlee801 with a subject filter | **on** |
| Knowledge file (company-monthly-reports) | off |
| Chained run on failure of 71f32136 | off |

- **Connections:** Keith's calendar (ical) and mail (imap, gmail) are verified, and neither is refused.
- **Workflows:** 71f32136 is active and ab4cb6ae is disabled.
- **Keith's recent credits:** 59, 125, 52 and 70 on 2026-11-15 to 18; 0 that day before the window.

## Switch-on (tw2-on.sh)

**Phase a, 02:52:17Z.**
- Nothing was running.
- The AI service's tool loop, write and validation tools were off.
- DEPLOYED was 8d6b499.
- Both env files were at the baselines (616841ca, 721f4772).
- Every trigger switch, schedules and runs were off.
- Both files were saved to /root/aisb-tw2 and compared.
- Nothing was changed in this phase.

**Phase b, 02:52:34Z.**
- The stored Anthropic test key was used; its value was never shown, and it is present once in each file.
- **Gateway:**
  - AI_PROVIDER anthropic, ANTHROPIC_MODEL claude-opus-5-5, PROVIDER_ANTHROPIC_ENABLED true, GLOBAL_EXECUTION_ENABLED true;
  - MAX_EXECUTIONS_PER_MINUTE_GLOBAL 4, MAX_TOKENS_PER_EXECUTION 16000, **MAX_DAILY_CREDITS_PER_USER 150**;
  - SCHEDULES, EVENT, MAIL, KNOWLEDGE and CHAIN triggers true, and RUN_RESULT_TOOL_ENABLED true.
- **AI service:** AI_PROVIDER anthropic, the model, the tool loop true and EXECUTION_TIMEOUT_MS 180000. Write and validation tools stay **off**.
- **Readiness:** the gateway was ready 200, the AI worker was ready, Discord was ready after the restart, and the four units were active.

**Window hashes:**
- gateway.env `0c1527719b16b0cf9e2cb1b5a479bc6523d32d1fcda64cce4aa74df27f691e62`;
- ai.env `e18cc83f3631012f8e91ae8b197d9b743c458bea0856fd4fb9b6e2d9b503d164`;
- the Caddyfile is unchanged at 205770cf, and basic_auth stays on.

## Status check (tw2-status.sh, tw2-s1.out)

- No runs, executions or credits since the window opened.
- No trigger activity yet.
- 0 error lines outside the startup route list.
  - The first check counted one "error" line. tw2-err.out shows it is the startup mapping of the internal route `/api/internal/sessions/:sessionId/error`, not a fault.
  - The status script now skips startup route lines.
- The env files are at the window hashes, and the units are active.

## While the window is open (GOV-OS-06)

- **Flags:** runtimeAuthorization.testerWindowOpen is true. Staging, provider-live and credit authorization are false. The window holds no lane and no mutex.
- **Code tasks:** LOCAL-TESTS and LOCAL-RUNTIME tasks are admitted under the usual rules.
- **Deploys:** a deploy checks the window hashes above instead of the baselines, and its evidence says the tester may be active. It also holds ENV and follows GOV-DEPLOY-WINDOW-01: Keith is told first, runs pause for the deploy only, and the window gateway.env is restored byte for byte. STAGING-DEPLOY-EVALSCORE-01 waits for the close unless Keith wants it sooner.
- **Refused:** any PROVIDER-LIVE or CREDIT task is refused (TESTER_WINDOW_OPEN) until the window closes.
- **Watching:** the control plane runs tw2-status.sh from the host while working and when Keith asks.
- **Closing:** TESTER-WINDOW-CLOSE-02 is ready on 2026-11-26, or earlier when Keith says stop. It runs tw2-off.sh, which restores both saved files byte for byte to the baselines and checks every switch off. Its record reports the window's runs by trigger type and chat, credits per run and per day, and failures.

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/TESTER-WINDOW-02/`.
- tw2-on.sh is the COS-EVAL-LIVE-03 window script cel4w-phase.sh, made by `mk_tw2.py` in the control plane's scratchpad with each change asserted. The changes: the run folder and deployed sha, the settings above, and the removal of its unused phases c to e.
- tw2-off.sh is cel4w-off.sh with the run folder changed.

| File | SHA-256 |
|---|---|
| `tw2-on.sh` | `9cba574d451560c505b2e7f0829a8891c1914928cca797026e21e627e2200c92` |
| `tw2-off.sh` | `dec529e4de32b0137303ed2559dfa8eb398a6959e3c7152a4f12ae30729afd53` |
| `tw2-status.sh` | `d52baa2de20fa29050258f7dee2749a5cd99c1d2be2807f19d7681de5dbe1ad3` |
| `tw2-look.sh` | `d17961f10303e0c8d50b76651603d382a07409847f8ad36e2a3c63625ba762a7` |
| `tw2-cols.sh` | `073d095d78c87ac8abfea8e6cfcf656fcbbb5c0c9b71a043315a16b85b2aa3ae` |
| `tw2-err.sh` | `a647df3189c3a4505374841e2a7827b5cf2bbd64267f6817807447b9d59d12e5` |
| `run.sh` | `9bd8fa5a328130abba574bd916a7bf25c8c77ad09a0fae9fdde6daf140dd5058` |
| `tw2-cols.out` | `ce3833334009f16a0bd514af51440100d510885f0d70706e4a1befce22852a3f` |
| `tw2-look.out` | `f4164be6271692588a4a1f8ba92d200a380dc9dbd1c9ff0d4fff7dd9c5d28b25` |
| `tw2-look2.out` | `6571e5ac5ba974b0836bd328c1f52e9e8ef92d465924b223d1c5fc6e376175e1` |
| `tw2-a.out` | `30997287b33e78306517a2123a67c738ee874c56fdcc216c00bc10033b12ce11` |
| `tw2-b.out` | `929514ae7f3637e8589920c4150876a8231572e7a313f03e0008d108b424d48b` |
| `tw2-s0.out` | `f424b171447feb7d5dd756a14941fd26c8466b07eef250480033b9644cd37cc4` |
| `tw2-err.out` | `fd3324de76cf0b09aed5bb032a1e4bb6552f562bc22906aa642db615f65a2d4e` |
| `tw2-s1.out` | `7e5230d87665f5a7b8eb780fe3f14c6b57c8764933d61e5742a7a98ae1ca409b` |

Every output was scanned for key text; none was found.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host env files only, saved for the restore; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), LIVE 3/3 + 1 n/a (1: PROVIDER-LIVE and CREDIT held during the switch-on; 2: the cap of 150 credits a day per user and 4 runs a minute, stated in the draft Keith approved; the key read from the stored key file on the host and never shown; 3: readiness and status from host-side checks; 4: n/a, no fix needed), DEPLOY 4/4 + 3 n/a (1: STAGING held; 2: env hashes checked before the change and recorded after; 4: nothing open before, the units active and the gateway ready after; 6: no secret printed, every output scanned; 3, 5 and 7: n/a, no deploy, every step from the host)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed (closing is TESTER-WINDOW-CLOSE-02, registered with the admission).

## Lock

COMPLETE AND LOCKED on 2026-11-19 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- the three authorizations false;
- **tester window OPEN**.
