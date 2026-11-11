# APPROVAL-SET-01B — Checkpoint (slice 01B: the server's auto-approve path)

**Task:** APPROVAL-SET-01B — The server auto-approve path
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** AGENT. **Lifecycle:** 4-STEP; the stage-start is shared with APPROVAL-SET-01. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the APPROVAL-SET-01 stage-start approval. Keith approved it ("Yes, approve both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1-2. Registration and stage-start | shared with APPROVAL-SET-01 | ee1e8f6 |
| 2a. Admission | Lane 1 with GATEWAY; HARNESS_ENTITLEMENT_PROOF_V1 read, not changed | b44afef |
| 3. Implementation | opus subagent (Opus 5.5: approval logic in a frozen-contract file) in worktree lane/APPROVAL-SET-01B, two commits, cherry-picked onto main. The control-plane review sent the cost estimate back to be owner-scoped and bounded. | dceaf2d, 9dad768 |
| 4. LOCK | this checkpoint, board, backlog, sidecar, plan and ARCHITECTURE.md 13.1, canonical validator | this record |

## Change

`maybeAutoApprove` runs only right after `createPendingReferral`, in two places: the dispatch path (`requestHandoffFromAnswer`) and the report-back path (`reportBackFromAnswer`). It never throws.

**When a decision is made.** The step must be waiting, have a parent and be undecided. Its run must be active and must not be its first step. The run's lead (`leadIdOf`) must be a user workflow whose own snapshot is on the run's first step. The edge must be lead → member or member → lead. So these never decide:
- the first hand-off;
- internal-route referrals;
- coding and advisors runs;
- the Chief of Staff front door, which is APPROVAL-SET-02.

**The lead's setting** is read live from its row, fail-closed.
- `every` (including any malformed value) changes nothing and records nothing.
- A missing or switched-off lead with another mode records `lead_missing`.
- A draft lead qualifies, because the setting applies in test runs (DECISION C).

**Eligibility** (read_only and credits). The step's constraints must still be read-only with no write tools.

| Target | Outcome |
|---|---|
| product-strategy, technology-advisor (registry `read`, roster candidate, no connector tools, no snapshot) | eligible |
| a workflow member, or the lead itself, with its own snapshot on the step and every connector tool allowlisted and `readOnly: true` | eligible |
| writer, reviewer, builder, lead (coding), chief-of-staff, advisors-lead, an unknown id, a system id with a snapshot, a mismatched snapshot, or an unknown or non-readOnly connector tool | waits: `writes` |
| credits with no known cost | waits: `unknown_cost` |
| credits with the estimate over the limit | waits: `over_limit` |
| credits at or under the limit, on an eligible target | eligible |

**The estimate.** `lastStepCreditsFor` reads the owner's 200 most recent runs, then one referral: the target's latest completed step with an execution id in those runs. No cross-owner row is ever loaded. It sums that execution's credit deductions and rounds up; unknown means waiting.

**Approval.** It goes through the existing `approveReferral` with `decidedBy` = the owner, `decisionReason` `auto:read_only` or `auto:credits:<estimate>/<limit>`, and `enforceTestsGate: true`. So `assertCanApprove`, the kill switch, safety, abort, credit balance, token quota and the claim all still run.
- Any exception leaves the step waiting with `checks_failed`.
- `approveReferral` ignores a `decisionReason` that isn't one of the server's own `auto:` values.

**Waiting record.** `pending_job.autoApproval = { outcome: 'waiting', reason }` is written once, plus one audit event (`auto_approval_declined`) with no contents.

**View.** The handoff view gains:
- `autoApproved` (mode, estimate, limit), only for a real automatic approval;
- `autoApprovalWaiting` (the reason), only while the step waits.

**Frozen contract.** HARNESS_ENTITLEMENT_PROOF_V1 is used, not changed. All 5 jobs of an auto-approved run have the same `Object.keys` as a clicked Chief of Staff job, with no `decisionReason`, `autoApproval` or `auto:` in them. A `pending_job` holding them enqueues the same key set.

**Files (8):**
- `orchestration.contracts.ts` and `orchestration.service.ts`;
- `collaboration-workflow.ts` and `collaboration.controller.ts`, each with its spec;
- `internal-collaboration.controller.spec.ts` and `__tests__/orchestration.service.spec.ts`.

25 new tests. Existing tests changed only in their in-memory fakes: they now support `In`, `IsNull`, `Not`, `order` and `take`, and the three earlier estimate tests give their runs a `createdAt`. The COS-FRONTDOOR-01B and USER-TEAMS-01B tests are unchanged and pass. Mutation checks caught a too-permissive capability rule and a wrong limit comparison.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3749 passed (3724 + 25), 7 skipped, 14 failed: only the known `smoke.integration` failures, on the branch and on main |
| gateway `npm run build` | exit 0, on the branch and on main |
| frozen and out-of-slice paths | `git diff --stat b44afef9..lane/APPROVAL-SET-01B` over src/ai, src/ai-execution, src/queue, src/user-agent, src/connectors, ai-service, frontend, collaboration-front-door.ts, collaboration-roster.ts and collaboration-tool-profile.ts: empty |
| line endings | the 8 files are LF in the work tree and in the committed blobs |

## Review notes

- **No retry.** If the gateway stops between creating a step and deciding on it, the step simply waits for a click. That's fail-closed, but it isn't retried.
- **Older steps count as unknown.** A target whose last completed step is older than the owner's 200 most recent runs reads as unknown cost, so the step waits.

## Limits

Not deployed; nothing shows it on screen until APPROVAL-SET-01C. Only in-memory fakes were used; Postgres and a real model run come at STAGING-DEPLOY-FD-02 and USER-TEAMS-LIVE-01.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (1: the owner stays the only human approver, and an automatic approval is the owner's stored choice recorded as decidedBy = owner; 4: frozen contract used, not changed, key sets pinned; 5: no schema change; 6: only the 14 known smoke failures)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.
- Rendering `autoApproved` (with `creditLimit`) and `autoApprovalWaiting` is APPROVAL-SET-01C's own scope.
- Stage-start section 10 item 6: the ARCHITECTURE.md 13.1 row is done in this record.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED. ARCHITECTURE.md 13.1 gains the approval-settings row (BUILT, not deployed).
