# STAGING-DEPLOY-CHATBATCH-01 — Checkpoint

**Task:** STAGING-DEPLOY-CHATBATCH-01 — the Discord production batch's one deploy to staging, during Keith's open tester window.
**Status:** COMPLETE AND LOCKED — 2026-11-20. Result: passed. Lane 1, STAGING and ENV released; stagingAuthorized false; the tester window stays OPEN.
**Loop:** 3-step (admission 0976d52, Keith's "Yes, all 9" covering the batch's one deploy; the run; this LOCK). Keith was told first that runs pause for a few minutes (GOV-DEPLOY-WINDOW-01).

## Run
- Script aisb-preflight/STAGING-DEPLOY-CHATBATCH-01/chb-deploy.sh (drafted by an opus subagent from ef-deploy.sh and sd16b-deploy.sh; reviewed by the control plane: window protection, trap, migration checks; target filled in, sha256 f8113c6b…), run once through run.sh; output chb-deploy.out (668 lines; 0 secret-pattern hits); RC=0, "CHATBATCH DEPLOY PASSED".
- Before: HEAD and DEPLOYED 8d6b499, migration hash c32f099c, window hashes gateway.env 0c152771 and ai.env e18cc83f, every window switch as TESTER-WINDOW-02 set it, nothing running (executions 0, active runs 0, referrals in progress 0).
- Runs off for the deploy only: one line GLOBAL_EXECUTION_ENABLED=false at about 16:39Z, gateway ready 200, still nothing running.
- Deploy 8d6b499 -> 0976d52166ab89fe72b632c5ee4c2e519ee1f00a, started 16:40:21Z, aisandbox-deploy rc 0 at 16:44:44Z.
- Migration 1817 AddChatPersistedState applied: migration hash c32f099c -> 5b4f65af27479f3d7d0c0fda1931c13245110db934c61b045d37184210b33190; latest row AddChatPersistedState1817000000000; the seven chat_run_deliveries columns with types, nullability and defaults (7 of 7), origin default 'platform'::text, both new tables, the CHECK constraints, indexes, the cascading foreign key and primary keys; chat rows 0.
- Window restored: gateway.env back byte for byte (0c152771, equal to the saved copy), gateway ready 200, GLOBAL_EXECUTION_ENABLED=true, every window switch and both window hashes as before; ai.env unchanged throughout; the saved copy shredded at the end.
- Discord after the restore: ready, 7 commands registered, no close code 4013 or 4014 (the DirectMessages intent accepted), nothing stopped or failed; GET /api/chat-links 401 without a session and with an API key alone.
- Every adapted template check passed (preview host, same-origin guard, cookies, picker, guards, CORS, connector server, security, ai-service, container-manager, provider availability with Anthropic only, the trigger and run-result sections at their window values, the Chief of Staff data rule); the Discord batch markers in the gateway and frontend builds; ws 8.21.3 for the root, the gateway, the ai-service and @discordjs/ws; the 16 eval cases.

## Not covered here
The Discord behaviour itself with Keith's accounts (Add to Discord, a second account outside the server, plain messages, Reject with a reason, results of trigger runs) is CHAT-LIVE-02, after Keith's portal step (Public Bot on, User Install on). Link e-mails are built and logged but not delivered while EMAIL_PROVIDER is stub (MAIL-PROVIDER-01). No control-plane run with the provider was made: PROVIDER-LIVE and CREDIT tasks are refused while the tester window is open.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no code change; the script drafted by an opus subagent and reviewed by the control plane; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING held; 2: env files checked against the window hashes before and after; 3: Keith told runs pause before the restart; 4: nothing open before, DEPLOYED 0976d52 and the new migration hash 5b4f65af as expected, health, guard and window checks passed; 5: every step from the staging host; 6: no secret printed, output scanned, 0 hits; 7: ENV held, the window gateway.env saved, runs off only for the deploy, restored byte for byte and checked).
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.
