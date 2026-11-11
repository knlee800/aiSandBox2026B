# STAGING-DEPLOY-FD-02 — Checkpoint

**Task:** STAGING-DEPLOY-FD-02 — Deploy the rest of Stage 4
**Status:** COMPLETE AND LOCKED — 2026-11-11. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the STAGING-DEPLOY-FD-01 re-scope. Keith approved the deploy on 2026-11-11 ("Yes, deploy it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 7ac9084 |
| 2. Deploy and host checks | fd2-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (fd2-deploy.sh; aisandbox-deploy rc 0 at 2026-11-11T07:06:50Z UTC)

537ebfb → 7ac9084, aisandbox-deploy rc 0. It carries:
- user teams: USER-TEAMS-01, -01B and -01C;
- approval settings: APPROVAL-SET-01, -01B and -01C;
- Chief of Staff drafts: COS-DRAFTS-01 and -01B, with the Chief of Staff hash 8f655afb in the gateway and ai-service;
- container-manager fixes: CM-EXEC-01, CM-BINARY-01, CM-DIFF-CAP-01, CM-UNTRACKED-DASH-01 and CM-CONTENT-TYPE-01.

**Before:**
- HEAD and DEPLOYED were at 537ebfb, the migration hash was bf6d40ae, and the tree was clean.
- The configuration files matched their baselines. Flags: stub, stub, false. Nothing was running.
- `INTERNAL_SERVICE_KEY` matched across the three env files, compared by hash.

**Migration:**
- The deploy tool took the pre-migration backup `/var/backups/aisandbox/20261111T070232Z`.
- It applied `AddUserAgentTeamColumn1806000000000` and `AddUserAgentApprovalColumns1807000000000`; the latest migration row is 1807.
- `user_agents` has `team_member_ids`, `approval_mode` and `approval_credit_limit` (3 of 3), and both CHECK constraints exist.
- Existing data: 1 row, with no team and mode every.
- The migration hash moved from bf6d40ae to 9cfde25f726ee27821082b777980bea833b7f916acb54e80b1f7425edf87efb4.
- `collaboration_rosters` and `result_seen_at` are still present.

**After:**
- HEAD and DEPLOYED are at 7ac9084. The configuration files and flags are unchanged, and all 8 units are active.
- **Standard checks:**
  - Caddy answers 401 without login.
  - Gateway health answers 200 on 3 paths.
  - 12 frontend pages answer 200.
  - 31 guard checks answer 401 without login.
- **Earlier checks, all passing:** the earlier route, CORS and session-id security checks; ai-service and container-manager guards; no key text in the journals; no open runs.
- **New code in the builds:**
  - gateway: `collaboration-draft.js`, `teamLeadId` (4 files), `maybeAutoApprove` (2), `lastStepCreditsFor` (3), `assertRosterMemberIds` (5), and the Drafting paragraph;
  - ai-service: the eval copy hash 8f655afb (2 files);
  - container-manager: `EXEC_OUTPUT_MAX_BYTES`, `execInContainerWithStdinBySessionId`, `boundedDiffCommand`, `WORKTREE_UNTRACKED_BATCH_SCRIPT`, `STANDARD_CONTENT_TYPES` and `readFileBufferFromContainer`; no host workspace path in git.service.js;
  - frontend: the team, approval and draft-notice test ids (4 files each).
- **Known blank lines:** the script's old lines that look under the wrong container-manager paths print blank or 0, as recorded in STAGING-DEPLOY-FD-01.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-FD-02/`:

| File | SHA-256 |
|---|---|
| `fd2-deploy.sh` | `fbfa65f3ed0ad4f36b94bd8dd0d2363d8b8e57ac08708e0a0fc5f9060db93e3b` |
| `fd2-deploy.out` | `74f46eca98e1338d5f0486577d186f71e9dd4b81a5b8ed5a5cbeb76ce2004d32` |

The output was checked for key text, and none was found.

## Limits

The new flows need a login and, for teams, approvals and drafts, a real model. They belong to the live checks:
- **USER-TEAMS-LIVE-01** (runs on): teams, automatic approval, a draft, three languages and the briefing eval rerun with the new hash.
- **CHECKPOINT-LIVE-02** (no AI): checkpoint save and restore through the container's stdin, an image or font in a preview, and an untracked file in the diff.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, the expected migrations applied after a backup, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The logged-in checks are superseded by USER-TEAMS-LIVE-01's and CHECKPOINT-LIVE-02's acceptance lines.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 7ac9084 with migration hash 9cfde25f, and runs are off.
