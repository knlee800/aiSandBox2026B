# HARNESS-FIXES-01A — Stage-start (frozen design)

Date: 2026-11-06. Approved by Keith in chat on 2026-11-06 (option A for item 8; item 10b included). Task body: TASKS_BACKLOG_FULL.md, HARNESS-FIXES-01A. Root causes from a read-only investigation by Cursor grok-4.7-xhigh (session 4786bad1-707d-4ee6-bae3-96a75358fd1f), key claims rechecked by the control plane in the code.

## Item 10 (not in scope: already fixed)

HARNESS-REOPEN-01 (locked 2026-11-05) added the guard in services/api-gateway/src/projects/projects.service.ts (about lines 219 to 235): opening a project skips snapshot and checkpoint restore while the caller has a pending, running or cancel_requested run in that session. Its tests are in projects.service.spec.ts. No change.

## Item 10b — refuse manual Restore while a run is active

Cause: services/api-gateway/src/sessions/session.controller.ts restoreSessionSnapshot (POST /api/sessions/:id/restore, about line 367) checks ownership and termination, then calls SnapshotPersistenceService.restoreSnapshot with no active-run check, so the saved copy replaces files an Agent run is writing.

Design:
1. In restoreSessionSnapshot, after the ownership and termination checks and before restoreSnapshot, look up one usage_records row for this user and session with executionStatus in pending, running or cancel_requested, the same set projects.service.ts uses. If one exists, throw ConflictException (409) with a stable machine-readable code in the body, for example { code: "run_active" }, and restore nothing (no snapshot, no checkpoint history).
2. Inject the UsageRecord repository the same way projects.service.ts does; register it in session.module.ts if it is not already available there.
3. Frontend: frontend/components/workspace/workspace-snapshots.logic.ts maps a 409 from the restore call to a new result kind; the page shows a new translated message, for example "An Agent run is still working in this session. Restore after it finishes or is cancelled." One new key in en.json, zh-TW.json and zh-CN.json (real translations), placed beside the existing restore keys.

Tests: gateway session.controller.spec.ts: each active status refuses with 409 and restoreSnapshot and restoreCheckpointHistory are not called; no active run restores as before; another user's run in the same session id does not matter (the lookup is by caller). Frontend workspace-snapshots.logic.test.ts: a 409 maps to the new kind; other errors unchanged; the new key exists in all three message files.

## Item 8 — honest delete flag (option A)

Cause: services/ai-service/src/agent-harness/config/agent-harness.config.ts sets requireApprovalForDelete true (about line 79); nothing reads it before a delete. Deletes are automatic and undoable through the save point taken before mutating tools, and the run progress already shows "Delete file" with the path in all three languages.

Design: set the default to false in createAgentHarnessConfigV1. Keep the field on the contract and on APPROVAL_FLOOR_FIELDS in builder-harness-config-adapter.ts, so a later global true still cannot be weakened by a profile. Do not touch the other approval flags, the .env refusal or the save point.

Tests: agent-harness.config.spec.ts: the default is false. builder-profiles/__tests__/builder-harness-config-adapter.spec.ts: with a global false, a profile false stays false and a profile true stays true, with no floor warning for the field; existing floor tests with a global true still pass unchanged.

## Item 11 — recovered Build shows only the not-applied notice

Cause: on reconnect, a recovered run is registered as intent conversation, so its file actions are not applied (the RUN-RECOVER rule, which stays). The status handler in frontend/app/[locale]/app/page.tsx then shows the model output ("I have added ...") and appendRecoveredRunNotice in frontend/components/workspace/workspace-run-recovery.logic.ts appends runRecoveredBuildNotApplied for mode build or unknown, so the saved assistant message claims a change and then says it was not applied.

Design: for mode build or unknown, the recovered assistant message is the existing notice alone; the model text is not placed in front of it. Ask and Agent recovery are unchanged. A Build the user watched is unchanged. Recovered file actions stay unapplied. No new message key. Change page.tsx only if the call site must pass the notice as the whole message.

Tests: workspace-run-recovery.logic.test.ts: build and unknown return the notice without the model sentence; ask and agent return the answer unchanged; an empty model answer still yields the notice.

## Item 5 — a failed search is an error

Cause: services/container-manager/src/docker/docker-runtime.service.ts (about lines 750 to 761) returns no results for any non-zero exit with empty stdout, logging stderr only; docker-runtime.service.spec.ts locks that in (exit 127, "find: not found", expected empty).

Design: keep the empty result only for exit code 1 with empty stdout and empty stderr (a clean grep no-match). Any other non-zero exit with empty stdout throws through the existing "Failed to search files in container" path, which the ai-service tool dispatcher already turns into success false with an error message. The success response shape is unchanged. files.service.ts searchFiles is not used by the Agent and is not changed.

Tests: docker-runtime.service.spec.ts: exit 1 with empty stdout and stderr resolves to no matches; exit 127 with stderr rejects; another non-zero exit with empty stderr rejects; exit 0 with grep lines unchanged. The old test expecting empty results for exit 127 is changed to expect the rejection.

## Write set (exact)

- services/ai-service/src/agent-harness/config/agent-harness.config.ts, agent-harness.config.spec.ts
- services/ai-service/src/agent-harness/builder-profiles/__tests__/builder-harness-config-adapter.spec.ts
- services/container-manager/src/docker/docker-runtime.service.ts, docker-runtime.service.spec.ts
- services/api-gateway/src/sessions/session.controller.ts, session.module.ts, session.controller.spec.ts
- frontend/components/workspace/workspace-run-recovery.logic.ts, workspace-run-recovery.logic.test.ts
- frontend/components/workspace/workspace-snapshots.logic.ts, workspace-snapshots.logic.test.ts
- frontend/app/[locale]/app/page.tsx (the two call sites only)
- frontend/messages/en.json, zh-TW.json, zh-CN.json (one key)

Anything else is out of scope; if a test outside this set breaks, stop and report.

## Checklists (docs/control-plane/task-checklists.md)

EVERY, BACKEND, FLOWS and UI apply. FLOWS 1 and 3 matter most: revert and file-action flows stay as they are; item 11 keeps recovered Build changes unapplied; item 10b only adds a refusal in front of Restore. UI: the new message is translated, the design skills are read for the message placement, DESIGN.md is followed.

## Model and gates

Implementation: Cursor grok-4.7-high. Gates: ai-service, container-manager and api-gateway npm test and npm run build; frontend npx tsc --noEmit, npm test, npm run build. Deploy after LOCK as its own task, with Keith told before the restart (tester window open).
