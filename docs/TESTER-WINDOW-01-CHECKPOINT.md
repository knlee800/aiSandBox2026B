# TESTER-WINDOW-01 — Checkpoint

**Task:** TESTER-WINDOW-01 — Open the tester window on staging
**Status:** COMPLETE AND LOCKED — 2026-11-06 (window left OPEN)
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** registered by GOV-OS-06; Keith approved the draft and admitted it on 2026-11-06 after TESTER-SETUP-01 locked.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT | b6885dda7f7417c36ce1bc4fca821325aa0af738 |
| 2. Switch-on and first runs | host script by the control plane; first runs by Keith in the browser as knlee802; read-only host check | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator; window left open | this record |

## Switch-on (tw1-on.sh, 2026-11-06T04:12Z)

Pre-checks passed: deployed commit 951ee83, gateway.env and ai.env at their baseline hashes (bf6864f9..., 721f4772...), Agent tool flags off, nothing running, the knlee802 access row true, true, 500000, 0 credits used that day. Both env files were saved to /root/aisb-tw1, then written: gateway AI_PROVIDER anthropic, ANTHROPIC_MODEL claude-opus-5-5, PROVIDER_ANTHROPIC_ENABLED true, GLOBAL_EXECUTION_ENABLED true, MAX_EXECUTIONS_PER_MINUTE_GLOBAL 4, MAX_TOKENS_PER_EXECUTION 16000, daily credit caps unset (defaults 500 per user, 1,000 platform); AI service anthropic, claude-opus-5-5, tool loop, write and validation tools on, EXECUTION_TIMEOUT_MS 180000; the stored key in each file once, value never shown. After the restart: gateway ready 200, AI worker ready, all four units active. Window env hashes: gateway.env 5692ce351b0650507049c6f18ddae6e4cc7c8b7e10b63df70cde08e906a0a49b, ai.env 132ebab3244dbfc42b39a21a1d2283c9e0657eff7f740a3ffdd476f9bf700f65 (also in /root/aisb-tw1/window.hashes).

## First runs (Keith as knlee802; host check tw1-check.sh)

| Run | Status | Tokens | Duration | Model | Credits |
|---|---|---|---|---|---|
| 04:16:08 UTC | completed | 3,983 | 26.7 s | claude-opus-5-5 | 4 (500 to 496) |
| 04:16:48 UTC | completed | 9,320 | 16.4 s | claude-opus-5-5 | 10 (496 to 486) |

Keith reported that his Build chat and his Agent run both worked. No other account ran during the check; nothing open afterwards; platform credits that day 14; env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/TESTER-WINDOW-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `tw1-on.sh` | 6690 | `fdc97dbc0df8b4f24dbfd93ea187fc56abde517e8a3a35dc3d5e1e15db9a18d6` |
| `tw1-on.out` | 1692 | `784907d8f2e8fb4743a810d7d4920a5c5a91589356db0aa2845999c115a95805` |
| `tw1-check.sh` | 1744 | `98566e1f7e70708e43e23e60b30a89ff4d653e8920b292d412ea1de18cf7c923` |
| `tw1-check.out` | 564 | `9bfd1646e51c3c5f56cc9925252e5bb8de7db479e857e5c8eb8e87843352b7a4` |

## Acceptance criteria

All six met. Not LOCKED by an implementer: locked by the control plane.

## While the window is open (GOV-OS-06)

- runtimeAuthorization.testerWindowOpen is true; staging, provider-live and credit authorization are false; the window holds no lane and no mutex.
- Coding tasks and deploys continue; deploys check the window env hashes above instead of the baselines, and say the tester may be active.
- PROVIDER-LIVE and CREDIT tasks are refused (TESTER_WINDOW_OPEN) until the window closes.
- The control plane checks usage, failures and spend from the host when asked or while working.
- Closing is a separate registered task when Keith says stop; it restores /root/aisb-tw1/gateway.env.before and ai.env.before and restarts the two services.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed (closing the window is registered when Keith says stop, per the GOV-OS-06 rule)

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED; the three authorization flags false; tester window OPEN.
