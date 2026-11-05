# GOV-COLLAB-PLAN-01 — Collaboration: built versus planned

**Decision:** Keith chose Option A on 2026-11-05. The registrations and drops are recorded in docs/GOV-COLLAB-PLAN-01-CHECKPOINT.md and TASKS_BACKLOG_FULL.md.

**Task:** GOV-COLLAB-PLAN-01 (TASKS_BACKLOG_FULL.md line 84191). **Nature:** decision document; nothing here admits or schedules work. The AGENT-COLLAB-00 plan and the COLLAB checkpoints are locked and are not edited.

## 1. Summary

Collaboration today is a working, staging-proven **coding team**: a user starts a run on the Team page, a fixed lead / writer / reviewer team (collaboration-team.ts lines 14-30) reads the project, the writer changes files after Keith approves, the reviewer runs tests, sees the diff, can send work back twice, and Keith reverts from the normal checkpoint list. Every hand-off waits for a human approve or reject. What the 2026-07 plan wanted beyond that — referral types, structured work objects (tickets, decisions, drafts, comments, tags), a functional Chief of Staff with the contract-negotiation scenario, approval categories, source-linked recommendations, registry-driven referral rules — is not started, and the built design replaced some of it with something simpler that was proven live. **Recommendation:** treat the built coding team as the collaboration product, keep three small slices (persistent audit, edit-before-approve, cancel from the Team page), park the business-agent remainder (AGENT-COLLAB-BIZ-01) until AGENT-KNOWLEDGE-01 exists, and drop the plan parts the built design made redundant.

## 2. Built

| Capability | Where | Locked task | Proven live |
|---|---|---|---|
| Internal routes: create run, create hand-off, approve, reject, read run | `internal-collaboration.controller.ts` lines 36-44; `collaboration_runs` / `collaboration_referrals` entities | COLLAB-INTERNAL-01 | Yes — COLLAB-LIVE-01 (two Ask-charged referrals, 401 without key) |
| Approval gate: hand-off waits at `pending_approval` with its job in `pending_job`; approve runs provider kill switch, safety, abort, credit and token checks; single conditional claim (409 on repeat) | `orchestration.contracts.ts` line 56; `collaboration-referral.entity.ts` lines 117-118; `orchestration.service.ts` lines 1612-1669 | COLLAB-GATE-01 | Yes — COLLAB-LIVE-02 (503 on switches off, 409 on repeat) |
| Loop, depth, agent and hand-off limits, server-derived chain, caller limits clamped down | `orchestration.service.ts` lines 533-553 (8 per run), 1355-1440 (`depth`, `loop`, `agent_limit`), 1544-1587 (clamp); defaults depth 3, agents 4, hand-offs 8 (`orchestration.contracts.ts` lines 87-89) | COLLAB-GATE-01 | Yes — COLLAB-LIVE-01 and -02 (400 with limitType; ninth hand-off refused) |
| Agent-chosen hand-offs: `<handoff to="name">task</handoff>` as the last line; up to 4 named agents; malformed requests become a note, not a failure; 5-minute sweep, 24 h expiry | `handoff-request.ts` lines 33, 58, 155-209; `collaboration-sweep.constants.ts` | COLLAB-CHOOSE-01 | Yes — COLLAB-LIVE-03 (lead→writer→reviewer chosen by the models; sweep timed out a backdated row) |
| Read-only file access through Harness (`harnessVersion v1`, `harnessReadOnly`, signed proof; read_file, list_files, search_workspace only) | `collaboration-tool-profile.ts` lines 56-73 | COLLAB-FILES-01 | Yes — COLLAB-LIVE-04 (planted bug found from the file; create-file refused; tool loop off failed closed) |
| Team page: login routes under `/api/collaboration`, entitlement 403, owner-scoped 404, server-owned team and model, 5 s polling, en / zh-TW / zh-CN | `collaboration.controller.ts` lines 104-111, 278-286, 359-368; `frontend/app/[locale]/collaboration/page.tsx`; `components/collaboration/collaboration-page.tsx`, `collaboration-view.tsx`; workspace Team link (`workspace-shell.tsx` line 76) | COLLAB-SCREEN-01, COLLAB-SCREEN-02 (refresh loop) | Yes — COLLAB-LIVE-05 ("all worked", Chinese checked) |
| Writer applies fixes after approval with pre-apply checkpoint; reviewer runs tests; page shows changed paths, save point, test results; revert via the workspace checkpoint list | `collaboration-tool-profile.ts` lines 10, 30-36, 44-54 (`read` / `review` / `write`; `preApplyCheckpointHash`) | COLLAB-WRITE-01 (design: COLLAB-WRITE-01-STAGE-START.md) | Yes — COLLAB-LIVE-06 (writer changed two files, tests passed, Keith reverted) |
| Send-back rounds (max 2) with the working-tree diff attached to the reviewer prompt and shown on the page; new files included | `collaboration-send-back.ts` lines 40-79; `orchestration.contracts.ts` lines 91, 187-191; container-manager `GET /api/internal/git/:sessionId/worktree-diff/:commitHash` | COLLAB-ROUNDS-01, COLLAB-DIFF-NEW-01 | Yes — COLLAB-LIVE-07 (one staged round; cap unit-tested only); STAGING-DEPLOY-03 (new-file diff) |
| Recovery: a finished step's hand-off survives a Gateway restart (`handoffChecked`, recovery in sweep and page read, settlement waits) | `orchestration.contracts.ts` lines 184-185; `orchestration.service.ts` lines 2351, 2508, 2736-2751 | COLLAB-HANDOFF-RECOVER-01 | No — unit-tested; live check dropped by GOV-OS-05 to "the next staging window" (TASKS_BACKLOG_FULL.md line 84604) |

## 3. Plan versus built

| Plan part (AGENT-COLLAB-00 section) | State | Missing / difference | Worth doing now? Which design wins |
|---|---|---|---|
| Referral lifecycle and statuses (§7) | Partly done | Built statuses: pending_approval, approved, in_progress, completed, failed, cancelled, timed_out, rejected (contracts lines 55-64). Plan's `contributed`, `blocked`, `expired` absent; `blocked` is a 400 refusal, `expired` is `timed_out`. | No further work. Built wins. |
| Referral types review / handoff / consultation / approval (§7.2) | Not started | One hand-off kind; the role instruction carries the intent. | Drop. Three live roles never needed a type field. |
| Idempotency and duplicate prevention (§9) | Partly done | `idempotency_key` column (entity lines 78-79), active-row unique index, `answer-handoff:<parentId>` key (handoff-request.ts line 33). No composite key, no IdempotencyRecord. | No further work. Built wins. |
| Loop prevention (§10) | Done | Direct and chain loops refused; send-back is the one allowed reverse edge (collaboration-send-back.ts). Depth default 3 not 4; agents 4 not 5; hand-offs per run 8 matches. Note: AGENT-COLLAB-00-CHECKPOINT.md lines 85-92 quote limits (depth 3, 10, 20, "3+ agents") that differ from the plan it summarizes (plan lines 215-220). | Done. Built values stand. |
| Safety limits pause and notify owner (§8.2); `maxOpenReferralsPerAgent`, `maxAutomaticReferralsPerIncomingItem` (§8.1) | Partly done | Built refuses with 400 plus an audit event instead of pausing; the two per-agent / per-trigger limits do not exist. | Drop the pause and the two limits: every hand-off already waits for approval, so "pause" is the default. |
| Work objects: ticket, decision, draft, meeting topic, comment, risk and opportunity tags (§11-18) | Not started | The referral is the only object; `prompt`, `result.summary`, `handoffNote` carry plain text (contracts lines 155-158). | Only if business agents stay a goal. For the coding team the text-plus-tag design wins; registered in AGENT-COLLAB-BIZ-01. |
| Source links and source-linked recommendations (§19, §26, §28) | Not started | Needs the knowledge base; AGENT-KNOWLEDGE-01 is NOT_READY (backlog line 84247). | Not now. Stays behind AGENT-KNOWLEDGE-01. |
| Approval status model and categories (§20, §24) | Partly done, different | Built: one gate, every hand-off, always `block` after 24 h (sweep constants). Plan: categories (external email, contract, payment…) and "creating referrals needs no approval" (§24.2). | Built wins for the coding team; categories only matter with external actions, which do not exist. Fold into BIZ-01. |
| Owner responses approve / reject / modify / defer / escalate (§23.4) | Partly done | Approve and reject only (`collaboration.controller.ts` lines 227-276). Defer = the hand-off just waits (24 h). Escalate ≈ send-back for the reviewer only. Modify is absent. | Keep **modify** as a small slice (edit the task before approving). Drop defer and escalate. |
| Owner pause / resume, delete, override (§23.2) | Partly done | `cancelCollaboration` exists in the service but the login routes expose no cancel (controller line 175 uses it only on a failed start). | Keep **cancel from the Team page**; it is also the prerequisite OFFICE-07 needs (RPG-OFFICE-01-PLAN.md line 160). Drop pause/resume. |
| Owner notification (§23.3) | Partly done | Page polls every 5 s; nothing outside the page. | Office (OFFICE-05) badge covers it. |
| Audit events, immutable and stored (§21) | Partly done | Types exist (contracts lines 206-220) but the recorder is in-memory plus log (`orchestration-audit.recorder.ts` lines 11-18; fallback at service line 295). COLLAB-LIVE-01: "Limit events are logged only, not stored". | Keep as a small slice before anyone but Keith uses it. |
| Agent-to-agent contribution model (§22) | Partly done | Contribution = the answer text prepended to the next prompt (handoff-request.ts lines 145-153) plus the diff. No comments or tags. | Enough for the coding team. |
| Registry `referralRules` / `approvalRules` drive collaboration (§27) | Not started | Both still `[]` on every manifest (agent-registry.ts lines 157-230). The team is a server constant. | Drop for now; the server constant wins. Revisit only with BIZ-01. |
| Functional Chief of Staff and the contract scenario (§25) | Not started | Needs email trigger, drafts, Legal Advisor, knowledge, external send — all FUTURE (PRD.md lines 599-611; §8 line 477). | The decision Keith must make first (section 5). |
| Billing (§30) | Partly done | Hand-offs charged like Ask; separate `collaboration_referral` rate unused (COLLAB-INTERNAL-01 limits). | Fine for now; charging belongs to ACCESS-READY-01 item 1. |
| Integrations as triggers / actions (§31) | Not started | — | Not now. |

## 4. Known limits that matter for a next step

| Limit (source) | Registered task |
|---|---|
| The write flag is global: a writer window also opens Agent writes (COLLAB-LIVE-06, -07) | ACCESS-READY-01 item 3 (backlog line 84309) |
| Charging, per-user limit, one staging account so "other user refused" is unit-tested only (COLLAB-LIVE-05) | ACCESS-READY-01 items 1 and 4 |
| Daily spend counter is in memory and resets on restart (COLLAB-GATE-01, -LIVE-02) | None found. Proposed: supersede by ACCESS-READY-01 item 1 (real per-user limit) — Keith to confirm |
| Audit and limit events are not stored (COLLAB-LIVE-01; recorder file) | None. Proposed COLLAB-AUDIT-01 |
| Cancel is not reachable from the Team page | None. Proposed COLLAB-CANCEL-01; OFFICE-07 depends on it |
| Recovery after a Gateway restart not exercised live (COLLAB-HANDOFF-RECOVER-01) | Dropped by GOV-OS-05 to the next staging window (backlog line 84604) |
| Internal routes trust the key and do not check session ownership; `decidedBy` is caller-supplied on the internal route (COLLAB-INTERNAL-01, -GATE-01) | None. Login route checks ownership and sets `decidedBy` itself (controller lines 240, 288-298). Propose drop |
| One live run per capability; no repeatable collaboration eval (every LIVE checkpoint) | HARNESS-EVAL-01 covers the single harness loop only (backlog lines 84092). None for collaboration |
| Each agent re-reads files, ~19 k tokens for one small file (COLLAB-LIVE-04); 114 credits for COLLAB-LIVE-07 | None. Propose drop while only Keith uses it |
| Rejected send-back counts as a round; index excludes failed/cancelled/timed-out rows in the live retry path (COLLAB-ROUNDS-01, -RECOVER-01) | None. Propose drop (minor) |
| `useTranslations` per-render pattern elsewhere (COLLAB-SCREEN-02) | Reported, no fix, in RUN-ERROR-01 checkpoint section "useTranslations report" |

## 5. Options for Keith (recommendation first)

**Decide first:** do business agents (Chief of Staff, Product Strategy, Technology Advisor, Legal Advisor) stay a goal to build, or stay as PRD approved-FUTURE with no work (PRD.md lines 51-57, 599-603)? If they stay a goal, AGENT-KNOWLEDGE-01 must come before AGENT-COLLAB-BIZ-01 (knowledge plan lines 25, 605; collaboration plan §2.2). If not, BIZ-01 is dropped and the registry fields stay empty.

**Option A (recommended): the coding team is the collaboration product.**
1. **COLLAB-AUDIT-01** — store orchestration audit events in a table (GATEWAY, MIGRATION; LOCAL-TESTS; size S). Office: nothing visible.
2. **COLLAB-EDIT-01** — edit the hand-off task on the Team page before approving (plan §23.4 "modify"); stored as the prompt of the waiting hand-off, approve unchanged (GATEWAY, FRONTEND, I18N; S-M). Office (OFFICE-05): the Team desk shows a `pending_approval` badge; clicking opens the Team page, where the edit and approve live — one approval flow (RPG-OFFICE-01-PLAN.md line 26).
3. **COLLAB-CANCEL-01** — login cancel route and button on the Team page using the existing `cancelCollaboration` (GATEWAY, FRONTEND, I18N; S). Office: OFFICE-07 later calls the same route.
4. Business parts stay parked in AGENT-COLLAB-BIZ-01 (NOT_READY) until AGENT-KNOWLEDGE-01 is locked. When chosen, first slice: a fourth read-only role (Chief of Staff) that answers over a knowledge folder — no work objects yet. Office: one more desk per role (OFFICE-03 figure variants), approvals still through the Team page.
Drop: referral types, extra statuses, IdempotencyRecord, per-agent / per-trigger limits, pause / resume, defer, escalate, timeout `allow`, registry-driven rules.

**Option B: build the plan as written now** (work objects, drafts, categories, Chief of Staff) before knowledge. Not recommended: §26 forbids unsourced business advice, so without AGENT-KNOWLEDGE-01 the Chief of Staff could only produce what the plan calls low-confidence output.

**Option C: stop here.** Keep what is built, register nothing. Valid under GOV-OS-03 (an empty board is valid), but leaves audit in memory before any second user.

## 6. Follow-ups named in this document

| Follow-up | Proposed disposition |
|---|---|
| COLLAB-AUDIT-01 — persistent audit events | Register, NOT_READY; ready when Keith picks Option A or before ACCESS-READY-01 is admitted; Keith names saturationClass |
| COLLAB-EDIT-01 — edit the task before approve | Register, NOT_READY; ready when Keith picks Option A |
| COLLAB-CANCEL-01 — cancel from the Team page | Register, NOT_READY; ready when Keith picks Option A or OFFICE-07 is chosen (OFFICE-07 then depends on it) |
| AGENT-COLLAB-BIZ-01 (work objects, Chief of Staff, categories, modify / defer / escalate) | Already registered (backlog line 84216). Proposed amendment at its admission: modify moves to COLLAB-EDIT-01; defer and escalate dropped; readiness adds "AGENT-KNOWLEDGE-01 LOCKED" — Keith decides |
| Daily spend counter in memory | Superseded by ACCESS-READY-01 item 1, if Keith confirms; otherwise register |
| Internal routes trust the key; caller-supplied `decidedBy` | Drop — internal key callers only; the login route is owner-checked |
| Collaboration eval / reliability measure | Drop — one coding team, Keith is the only user; revisit with ACCESS-READY-01 |
| Per-agent file re-read cost | Drop — accepted while only Keith uses it |
| Rejected send-back counts as a round; index excludes inactive rows | Drop — minor, no observed effect |
| Referral types, extra statuses, IdempotencyRecord, per-agent and per-trigger limits, pause / resume, defer, escalate, timeout `allow`, registry rules | Drop — replaced by the built design, with the reason in section 3 |
| Recovery live check | Already dropped by GOV-OS-05 to the next staging window |

FOLLOWUPS proposed: 3 register / 1 amend-existing / 1 superseded / 6 drop / 1 already disposed / 0 undisposed.

---

## Reviewer notes (control plane, 2026-11-05)

Drafted by Fable 5.1 (claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High") through Cursor in read-only mode. Checked against the code and found correct: the fixed lead / writer / reviewer team (collaboration-team.ts); audit events kept only in memory (InMemoryOrchestrationAuditRecorder is the service fallback and no other recorder is registered); the Team page's login routes have no cancel route although cancelCollaboration exists in the service; the referral statuses and the limits (depth 3, 4 agents, 8 hand-offs, 2 send-back rounds); referralRules and approvalRules are empty on all four registry agents; the in-memory daily spend counter (COLLAB-GATE-01 checkpoint line 30).

One change proposed: the in-memory daily spend counter resets on a restart, which is a spend-safety gap rather than part of charging. Instead of "superseded by ACCESS-READY-01 item 1" (no acceptance criterion there covers it), register it as ACCESS-READY-01 item 6: the daily spend counter survives a restart.

The control plane agrees with Option A.

---

**Files read**

- docs/AGENT-COLLAB-00-COLLABORATION-PROTOCOL-PLAN.md; docs/AGENT-COLLAB-00-CHECKPOINT.md
- docs/COLLAB-INTERNAL-01, -LIVE-01, -GATE-01, -LIVE-02, -CHOOSE-01, -LIVE-03, -FILES-01, -LIVE-04, -SCREEN-01, -LIVE-05, -SCREEN-02, -WRITE-01 (checkpoint and stage-start), -LIVE-06, -ROUNDS-01, -LIVE-07, -DIFF-NEW-01, -HANDOFF-RECOVER-01 checkpoints; docs/STAGING-DEPLOY-03-CHECKPOINT.md (result lines); docs/RUN-ERROR-01-CHECKPOINT.md (heading only); docs/GOV-OS-05-CHECKPOINT.md (grep); docs/GOV-HARNESS-RESET-01-DECISION.md (order table)
- services/api-gateway/src/orchestration/: orchestration.contracts.ts, collaboration-team.ts, collaboration-send-back.ts, handoff-request.ts, collaboration-tool-profile.ts, collaboration-sweep.constants.ts, collaboration-referral.entity.ts, collaboration-run.entity.ts, collaboration.controller.ts, internal-collaboration.controller.ts, orchestration-audit.recorder.ts, orchestration.module.ts, orchestration.service.ts (lines 1606-1675 and greps), collaboration-sweep.worker.ts (grep)
- frontend/components/collaboration/collaboration-view.tsx (grep); frontend/components/workspace/workspace-shell.tsx (grep); frontend/lib/agent-platform/agent-registry.ts (grep); frontend/app/[locale]/collaboration/page.tsx (existence)
- PRD.md sections 1, 2, 8, 11, 12
- TASKS_BACKLOG_FULL.md: GOV-COLLAB-PLAN-01, AGENT-COLLAB-BIZ-01, AGENT-KNOWLEDGE-01, RPG-OFFICE-01, ACCESS-READY-01, OFFICE-01, STAGING-DEPLOY-03, RUN-LIST-COLLAB-01, RUN-ERROR-01 (scope), HARNESS-FIXES-01, HARNESS-EVAL-01 (scope), FE-TEST-COVERAGE-01, GOV-OS-05, Dropped follow-ups
- docs/RPG-OFFICE-01-PLAN.md sections 1, 1a, 7, 8; docs/AGENT-KNOWLEDGE-00-KNOWLEDGE-ARCHITECTURE-PLAN.md (collaboration references by grep)

**Assumptions**

- Assumption: the daily spend counter named in COLLAB-GATE-01 has no registered task; I searched the backlog for it and found none, but did not read every task body.
- Assumption: no cancel route exists on the login controller — based on reading `collaboration.controller.ts` in full; `cancelCollaboration` on the service was not read beyond its use at controller line 175.
- Assumption: the in-memory recorder is what runs in production — `orchestration.module.ts` registers no other recorder and the service falls back to `new InMemoryOrchestrationAuditRecorder()` (line 295); I did not check the app module for an override.
- Assumption: the rough sizes (S, S-M) are estimates from the write scopes involved, not from stage-start designs.
- Assumption: the RUN-ERROR-01 useTranslations report found no page needing a fix; I read only the section heading.