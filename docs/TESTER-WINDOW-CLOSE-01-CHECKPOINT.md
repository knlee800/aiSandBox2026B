# TESTER-WINDOW-CLOSE-01 — Checkpoint

**Task:** TESTER-WINDOW-CLOSE-01 — Close the tester window on staging
**Status:** COMPLETE AND LOCKED — 2026-11-08 (window CLOSED)
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** named in docs/TESTER-WINDOW-01-CHECKPOINT.md (closing is a registered task when Keith says stop). Keith said close the window so COLLAB-EVAL-LIVE-01 can run and approved the draft on 2026-11-08.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING and ENV (one record, GOV-OS-04) | ab27de8d9bd0ff551778c9599227bc57baa80773 |
| 2. Close | host script written by Cursor (grok-4.7-high, resolved Grok 4.7 256K High), reviewed and run once by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Close (twc-close.sh, 2026-11-08T09:44Z)

Pre-checks passed: host id, no ops-test-mode, deployed commit bae24d9, gateway.env and ai.env at the window hashes (5692ce35..., 132ebab3...), the copies saved when the window opened at the baseline hashes (bf6864f9..., 721f4772...), GLOBAL_EXECUTION_ENABLED false in the saved gateway.env, owner and mode root:root 600 on all four files. Nothing running: executions 0, collaboration runs 0, open hand-offs 0.

The window files were kept as /root/aisb-tw1/gateway.env.window and ai.env.window, and the saved baseline files were copied back with their owner and mode. After the gateway and AI-service restart: gateway ready 200, AI worker ready, all four units active, GLOBAL_EXECUTION_ENABLED false, AI_PROVIDER stub in both files, gateway.env bf6864f9fd94d9cfd4fcafd33645944af94784b75249880697ada7505c48f339 and ai.env 721f47728899a291dd0f59d5f96f1a5143c7921ea820be97e3a0ab2a4e189dc3. Closed at 2026-11-08T09:44:17Z. The stored test key file stays (root:root 600; not read). No key text in the output.

Evidence in `C:/Users/knlee/aisb-preflight/TESTER-WINDOW-CLOSE-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `twc-close.sh` | 5729 | `2d976699cbd11d85594b8ae614a4ce266a0b8b1a1cd5b000e5c3e961900688f8` |
| `twc-close.out` | 1007 | `3a4ceda4d2e934254a1682e8bdd78ddb4251a05746971c47d16fcf880c9deefb` |

## Acceptance criteria

All six met. Not LOCKED by an implementer: locked by the control plane.

## After the close

- runtimeAuthorization.testerWindowOpen is false; staging, provider-live and credit authorization are false.
- AI runs are off on staging for every account; knlee802 keeps its access row (harness, Agent write, 500k daily token limit) for a later window.
- PROVIDER-LIVE and CREDIT tasks are no longer refused with TESTER_WINDOW_OPEN; COLLAB-EVAL-LIVE-01 can be admitted.
- Deploys check the baseline hashes above again.
- Reopening the window is a registered task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository; 3: Cursor grok-4.7-high named explicitly), DEPLOY 7/7 (2: window hashes before, baseline hashes after; 3: Keith approved runs switching off before the restart; 4: nothing running, deployed commit unchanged, health and worker ready, only the two env files changed, by this task; 7: n/a, no deploy, the window closes)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; the three authorization flags false; tester window CLOSED.
