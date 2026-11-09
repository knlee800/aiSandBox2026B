# GOV-BIZ-AGENT-OPS-PLAN-01 — Checkpoint

**Task:** GOV-BIZ-AGENT-OPS-PLAN-01 — Plan MCP connectors, briefings, the agent spec, skills and hand-offs together
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. No implementation lane.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration | planning task registered | a2cd4f4 on 2026-11-08 |
| Design and reviews | four Fable 5.1 drafts; Grok review; Opus 5.5 review | no separate repository commit |
| Close | docs/AGENT-OPS-PLAN.md, this checkpoint, the registrations below | this record |

## Models

Design: Fable 5.1 (four drafts). Reviews: Grok (cursor grok-4.7-high, resolved Grok 4.7 256K High) and Opus 5.5 (control plane).

## Keith's decisions

Section 1 of docs/AGENT-OPS-PLAN.md records these as Keith's decisions of 2026-11-08 and 2026-11-09. Keith approved the plan on 2026-11-09. A1 and A2 restate registration decisions (a) and (c) of 2026-11-08. A4 withdraws the 2026-11-08 Workspace internal-app choice.

| ID | Date | One-line summary |
|---|---|---|
| A1 | 2026-11-09 | MCP now: client in an api-gateway connector broker; allowlist of servers the platform runs and pins; user-supplied servers refused; server tool descriptions are untrusted text replaced by ours |
| A2 | 2026-11-09 | New folder `services/connectors-mcp/`; stdio child of the gateway, spawned by absolute path; no unit change |
| A3 | 2026-11-09 | Users build workflows; the briefing is the first template |
| A4 | 2026-11-09 | Mail by IMAP with an app password and calendar by the private iCal link now (option B); Google OAuth verification of the platform's app in parallel (option A). The Workspace internal-app decision of a2cd4f4 is withdrawn |
| A5 | 2026-11-09 | Approval setting per team or workflow: every hand-off (default); only over X credits; automatic for read-only agents. Never automatic for anything that writes, sends or deletes |
| A6 | 2026-11-09 | Phase 1 connections, template, user workflows; Phase 2 Chief of Staff front door; Phase 3 chat channels; Phase 4 triggers |
| A7 | 2026-11-09 | First chat channel Discord; then LINE and WhatsApp; WeChat via WeCom last; Slack a later option |
| A8 | 2026-11-09 | Direct jobs to any agent stay: Team page, Agent mode, `@name` in chat |
| A9 | 2026-11-09 | Form, basic parts 1-5 and advanced parts 6-9; "what it can never do" is generated from access and shown, not set |
| A10 | 2026-11-09 | Grok's review and the control plane's changes applied (sections 3, 4) |
| A11 | 2026-11-09 | First template: Inbox only, 25 unread, today's events; fixed labels; no knowledge search yet; data statement shown before connecting |

## What changed in the records

- docs/AGENT-OPS-PLAN.md added. One dispositions row added, for the return hop dropped at the BIZ-03 stage-start.
- 41 tasks registered after the GOV-BIZ-AGENT-OPS-PLAN-01 body, in manifest order. 40 are implementation, NOT_READY, saturationClass OPTIONAL. GOV-GOOGLE-VERIFY-01 is governance, READY, not admitted, and has no sidecar candidate.
- BIZ-USER-01 changed (lifecycle split, start condition, depends on, productClass, holds, plan line, and the line that it locks when BIZ-USER-01C locks). Its sidecar futureAuthorization is AUTHORIZED and its dependsOn is BIZ-01, BIZ-LIVE-01, BIZ-LIVE-03, AGENT-SPEC-01.
- Decision (b) in the GOV-BIZ-AGENT-OPS-PLAN-01 body replaced: mail by IMAP and calendar by iCal, with Google verification in parallel; the Workspace internal-app choice is withdrawn on 2026-11-09.
- PRD.md section 11: the APPROVED FUTURE paragraph on user workflows and the Chief of Staff front door, after the future table and before the Future office UI note.
- Dropped follow-ups: three lines from the plan (two reversals and the CONNECTORS-mutex drop) and a fourth reversal line for the return hop. Old drop lines were not edited.
- TASKS.md board lines replaced for this task's heading, status, governance owner, the lanes paragraph and the GOVERNANCE mutex line. Lanes stay EMPTY. Nothing is admitted.
- Sidecar: 40 new candidates after BIZ-USER-01. HARNESS_ENTITLEMENT_PROOF_V1 stays FROZEN and its path list is unchanged. CONN-GRANT-01 mutates that contract (sharedContractIds empty, because the same id cannot sit in both arrays) and exclusiveCapacity is true. BIZ-BRIEF-01 and BIZ-USER-01C use the contract. BIZ-BRIEF-01 does not list orchestration.service.ts.
- Occupancy, governance owner in the sidecar, and runtimeAuthorization were not changed.

## Checklists

EVERY, from docs/control-plane/task-checklists.md:

1. Met. The task was ACTIVE on the TASKS.md board before this closing record. Keith approved the plan and this record on 2026-11-09.
2. Met. The loop is 2-step: registration, then this closing record.
3. Met. The models are named above. Not Auto.
4. Not applicable: no implementation worker and no brief. This is the control-plane closing record.
5. Met. Only the declared closing files changed.
6. Not applicable: no product behavior changed.
7. Not applicable: no code gates. This record starts no tests, builds or servers. The validator result is below.
8. Met. Docker, PostgreSQL, Redis, migrations and servers were not started.
9. Not applicable: no build, so no validation artifact to restore.
10. Met. No commit, push, branch or worktree.
11. Met. The FOLLOWUPS line is in the backlog body and below.

GOVERNANCE, from docs/control-plane/task-checklists.md:

1. Met. This record is the GOVERNANCE write. It does not change Development OS semantics. Both lanes were empty. GOVERNANCE is released UNOWNED.
2. Met. Each new task has the registration metadata and one machine stanza. The 40 implementation tasks have sidecar candidates with saturationClass OPTIONAL, the class Keith named on 2026-11-09. They are READY and NOT_READY, and the body says what makes each ready and that Keith decides. GOV-GOOGLE-VERIFY-01 is governance and has no implementation candidate.
3. Met. Nothing was admitted. Shared contract HARNESS_ENTITLEMENT_PROOF_V1 stays frozen.
4. Not applicable: no code was integrated and no other lane holds evidence.
5. Not applicable: no product-code commit. This record is governance records.
6. Met. End status is on the board and in the backlog body. No full-body mirror. Program Status was not appended. Board lines replace the previous text.
7. Not applicable: this closes an already-admitted governance task and registers the follow-ups the approved plan names. It is not a new product or architecture selection.
8. Met. No production source. No locked task body was edited. Old Dropped follow-ups lines were not edited.
9. Met. The validator result is below.

CHECKLIST: EVERY 11/11, GOVERNANCE 9/9

FOLLOWUPS: 41 registered / 4 superseded / 1 dropped / 0 undisposed (registered: CONN-01, CONN-02A, CONN-02B, CONN-UI-01, CONN-GRANT-01, BIZ-BRIEF-01, COS-EVAL-01, STAGING-DEPLOY-CONN-01, BIZ-LIVE-03, AGENT-SPEC-01, BIZ-USER-01A, BIZ-USER-01B, BIZ-USER-01C, RESULTS-01, STAGING-DEPLOY-WF-01, BIZ-LIVE-04, GOV-GOOGLE-VERIFY-01, CONN-OAUTH-01, CONN-03, COS-FRONTDOOR-01, USER-TEAMS-01, APPROVAL-SET-01, COS-DRAFTS-01, CHAT-DISCORD-01, CHAT-LINE-01, CHAT-WHATSAPP-01, CHAT-WECOM-01, CHAT-SLACK-01, TRIGGER-01, TRIGGER-UI-01, STAGING-DEPLOY-TRIG-01, TRIGGER-LIVE-01, TRIGGER-EVENT-01, TRIGGER-MAIL-01, TRIGGER-MORE-01, SKILL-01, CONN-DRAFT-01, ACTIONS-APPROVAL-01, RESULTS-MAIL-01, CONN-OUTLOOK-01, BRIEF-WIDE-01, all OPTIONAL, Keith 2026-11-09; superseded: the Workspace internal-app connection by option B and CONN-OAUTH-01, test run and budget enforcement by BIZ-USER-01C acceptance criteria, direct jobs stay by a COS-FRONTDOOR-01 acceptance criterion; dropped: a separate CONNECTORS mutex, Keith 2026-11-09; BIZ-USER-01 changed, not a new follow-up; reused unchanged: AGENT-COLLAB-BIZ-01, BIZ-NOPROJECT-01, ACCESS-READY-01, GOV-ARCH-SYNC-01).

## Validator

One run of scripts/validate-lane-capacity.ps1 on 2026-11-09, after the record edits. Exit 0. result PASS. idleCode NO_PAIRWISE_ADMISSIBLE_CANDIDATE. admissibleForcingCandidates empty. rejectedCandidates 214 (207 NOT_READY, 3 FUTURE_NOT_AUTHORIZED, 3 ADMISSION_UNCERTAIN, 1 NOT_FORCING). All 40 new implementation candidates are NOT_READY. Proof: docs/control-plane/SATURATION_PROOF.json.

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. GOVERNANCE UNOWNED. Nothing admitted.
