# ACCESS-LIVE-01 — Checkpoint

**Task:** ACCESS-LIVE-01 — Second-user check on staging
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** COMMERCIAL. **Lifecycle:** 2-STEP. **Evidence class:** PROVIDER-LIVE (and STAGING-RUNTIME). **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** slice S11 of docs/ACCESS-READY-01-PLAN.md. Keith approved the draft (scope) and admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered by GOV-ACCESS-PLAN-01; admitted to Lane 1 with STAGING, PROVIDER-LIVE, CREDIT and ENV | 1604ace (registration); 86781867fe48d7d0e7b80a31982ecceddb34e765 (admission) |
| 2. Live check and LOCK | host blocks run by the control plane, Keith in two browser windows; this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Setup

- Keith signed up the test account test2 himself in a private window (7159d377-86b2-44a4-b864-951e2e6a9aa0). The control plane only marked its email verified (staging sends no email): one row; two users on staging; test2 role user, free plan, balance 500, no entitlement row.
- Keith set test2 harness on and Agent write off through the admin PATCH (audit 13:24:37).
- Live window 13:31:43 to 13:47:39 UTC: stored test key, claude-opus-5-5, AI_PROVIDER anthropic, runs on, tool loop, write and validation tools on, MAX_TOKENS_PER_EXECUTION 16,000, MAX_DAILY_CREDITS_PER_USER 10, MAX_EXECUTIONS_PER_MINUTE_GLOBAL 4.

**Deviation from the draft order:** Keith had already used 16 credits today (the STAGING-DEPLOY-04 run), so at a cap of 10 his write run would have been refused. The control plane raised the per-user cap to 100 (13:32:26, gateway restart) for his run, then lowered it to 1 (13:38:29) before test2's last run. Same checks and the same two provider runs.

## Checks

| # | Check | Result |
|---|---|---|
| 1 | Token limit | With dailyTokenLimitOverride 1 (audit 13:35:55), test2's Agent request was refused before any run (no usage record); the override was cleared (13:37:20) |
| 2 | Read-only Agent run | test2 run 526e6821-6de9-47bf-9b76-1ea132795cf6 completed (1,190 tokens, 2 credits, 4.2 s) with no tool calls in the AI-service log; test2's workspace has no notes/test2.md |
| 3 | Daily credit cap | With the cap at 1 and test2 at 2 credits, two more test2 requests were refused with 429 and no run recorded. The workspace showed its generic 429 text "Request blocked by rate limits. Retry shortly."; the gateway's reason ("Daily credit limit reached") is not shown and the response body was not logged |
| 4 | Agent write after ACCESS-01C | Keith run d8e38980-82f6-4093-9755-811531191982 in C1 repeat completed (3,556 tokens, 4 credits); write_file called twice; notes/live-check.md contains "live check ok" |
| 5 | Ownership and admin | From test2's console: Keith's session, project and run each 404; PATCH on the admin entitlements route 403 |
| 6 | Socket.IO | An unauthenticated client on the host was disconnected by the server ("io server disconnect") right after connecting |
| 7 | Port 4000 | On the host 4000 listens on all interfaces, ufw is inactive and iptables accepts; Keith checked the Lightsail Networking tab: 4000 is not in the firewall rules, so it is not reachable from outside. Per Keith's instruction no test ran from his PC; this replaced the draft's curl from his PC |

Window off: gateway.env and ai.env restored to their baseline hashes (bf6864f9…, 721f4772…), AI_PROVIDER stub, GLOBAL_EXECUTION_ENABLED false, health 200, units active, nothing open. Keith switched test2's harness access off through the admin PATCH (audit 13:53:17); test2 keeps its account. Credits in the window: Keith 4 (balance 108), test2 2 (balance 498). No key text in any output.

The first socket script looked for socket.io-client under frontend/node_modules and stopped; the corrected path /opt/aisandbox/node_modules was used for the passing run. A prepared host script to switch test2 off stopped without changes because Keith's PATCH had already done it.

Evidence in `C:/Users/knlee/aisb-preflight/ACCESS-LIVE-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `al-verify.sh` | 1894 | `53c70f032049a5b4c5452831c835dba5e580d89b94c70feab71bb7445fb11390` |
| `al-verify.out` | 237 | `84032a33747770496ddc3d0a8ff339a2b0879eda24138d85c3764fdfe5174517` |
| `al-flags-on.sh` | 6999 | `36f1d61017dbc8d6556f64900071115dd615e1ca68ae33b20122591f356da9aa` |
| `al-flags-on.out` | 1408 | `f4754cc03c649bf559655bc3b6a45988a14ebdee0d75d917b835c80831dae0cb` |
| `al-cap.sh` | 1794 | `402eb0d3e12dc77f9404b8823c2a293a2902e11dd3fcf9d69767cb146e086dfc` |
| `al-cap100.out` | 163 | `346ad70d3b8827b8e2383c00f9eb940c2d3f53dde070dee67af54b7d518d5c4f` |
| `al-cap1.out` | 312 | `f05e1d773ab2079a464fef9f403764584437e727b650c5f9b9a2be4e34ee270c` |
| `al-sock.sh` | 1180 | `5bfd0e65c12a9320a076d39d81f8bd407433045f1835f6e92d5c88458be66cc6` |
| `al-sock.out` | 419 | `8c63523c52500f5a0af86c09576164c6bb184738e3568ef4c0351bbc03cf01e8` |
| `al-sock2.out` | 173 | `ca7728f3036acc8a1b745a97ff51c598cc8514f403c908f2518a64c9e7528250` |
| `al-flags-off.sh` | 2644 | `cecffec71e18274e094fefa4dfa8fe20f2fa1e1482dac7ea0e676d19cafc0db8` |
| `al-flags-off.out` | 498 | `3d9203927b74be578f0e304e99f3d5adb781e20024f487d31af2fc81f7ecef13` |
| `al-ev.sh` | 3489 | `fb750d24d16789de7a0699930d1a57bdb95d424b76eaefabc0fac52a35f546e4` |
| `al-ev.out` | 1345 | `bf951cad35092d5f7bb6c4b6d1a2df8f772b933462347c007656d6f3ee30bb4e` |
| `al-tools.out` | 466 | `012406902503009c11296de88bf79cfd1135fd99f67a6ef6bf7e4cb0d2fe506e` |
| `al-off.sh` | 2247 | `fdf47ed0072f59f69ec691804fee3df9328b065cabea573b11645d21b965dd60` |
| `al-off.out` | 45 | `dfbc85248f3a679072c5da03ee503fc987b094f59643ee14aa53c1a7e02965ca` |
| `al-off-check.out` | 281 | `b5461e79ffb34c3d7f29b9ceaa8dcef6532ddf6df95051725fe3f7bec3070bd8` |

## Acceptance criteria

All eleven met (check 3's refusal is proven by the 429 shown and no run recorded at a cap of 1, not by the message text; check 7 by the Lightsail firewall rules). Keith's judgement: "File written", "B refused, D no file", the console output for check 5 and "4000 not listed". Not LOCKED by an implementer: locked by the control plane.

## Limits

- A second user joining Keith's socket room was not tried live (it needs a socket client carrying test2's session); ACCESS-01A's tests cover it.
- The read-only run made no tool calls, so the live proof is "no write attempted and no file"; the worker rule is covered by ACCESS-01C's tests.
- Before inviting a second person, Keith's decision D3 (OpenAI and xAI Agent runs for that person) is still open.

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered LIMIT-MESSAGE-01: show the real refusal reason in the workspace)

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false.
