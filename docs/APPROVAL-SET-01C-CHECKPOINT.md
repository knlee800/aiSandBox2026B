# APPROVAL-SET-01C — Checkpoint (slice 01C: form and Team page)

**Task:** APPROVAL-SET-01C — Approval setting form and Team page
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** AGENT. **Lifecycle:** 4-STEP; the stage-start is shared with APPROVAL-SET-01. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the APPROVAL-SET-01 stage-start approval. Keith approved it ("Yes, approve both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1-2. Registration and stage-start | shared with APPROVAL-SET-01 | ee1e8f6 |
| 2a. Admission | Lane 2 with FRONTEND and I18N, beside COS-DRAFTS-01 in Lane 1 (disjoint write sets) | 9492de3 |
| 3. Implementation | sonnet subagent (Sonnet 5.5: frontend-only UI and copy) in worktree lane/APPROVAL-SET-01C, two commits, cherry-picked onto main. The control-plane review sent it back for the required design review and the "1 credits" wording. | f48c847, b032399 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Form.** A new Approval fieldset sits under Advanced, after the team block. It offers three choices:
- every hand-off waits (the default);
- read-only agents are automatic;
- automatic under a credit amount, with a number field required for that choice.

Around the choices:
- **Hints:** two short paragraphs. Anything that writes, sends or deletes always waits, and the first step always waits. A note appears when read-only or credits is picked with no team.
- **What is sent:** a blank create left at every sends nothing, so it stays byte-compatible. A PATCH always sends the mode, plus the limit only for credits (null otherwise).
- **Refusals:** `APPROVAL_LIMIT_REQUIRED`, `APPROVAL_MODE_INVALID`, `APPROVAL_LIMIT_INVALID` and the code-less DTO 400 map to translated messages.
- **States:** the radios are disabled while saving, and the limit input carries `aria-invalid`.
- `sectionAdvanced` is reworded to "Advanced: model, budget, team and approval".

**Summary.** It shows "Approval: every hand-off / read-only agents automatic / automatic under N credits".

**Team page.**
- A step with `autoApproved` reads "Approved automatically: …" in place of the raw `decidedBy` id. Credits mode reads: the last step used about E credits, under your limit of M.
- A waiting step with `autoApprovalWaiting` shows a short translated reason next to Approve and Reject, which stay.
- Both lines are small gray status text with Heroicons v2 Outline (`CheckIcon`, `InformationCircleIcon`).

**Copy.**
- Amounts use singular and plural keys (`collaboration.creditAmountOne` / `creditAmountMany`), following the existing `creditsOne` / `creditsMany` pattern.
- The waiting reasons are flat keys (`autoApprovalWaiting<Reason>`), because the collaboration catalog is typed flat.
- en, zh-TW and zh-CN are all present with identical key sets.

**Design review** (Impeccable, the Emil Kowalski skill and DESIGN.md, read after the control-plane review):
- **Applied:** a disabled state while saving; `aria-invalid` on the limit; the two hints split into two paragraphs, because they read badly as one in Chinese; slightly larger radio click targets.
- **Kept, with reasons:** no motion on the limit input, and no auto-focus that would steal focus from the radio group. The status lines don't look like alerts, so the Approve and Reject buttons stay the call to action.

**Files (14):**
- platform: agent-workflow-fields, agent-workflow-model, agent-workflow-summary and platform-dashboard, with the editor and summary tests;
- collaboration: collaboration-page and collaboration-view, with the workflows test;
- `lib/collaboration/api.ts` (`collaborationAutoApprovedText` and `collaborationAutoApprovalWaitingText`) and `hooks/useUserAgents.ts`;
- the three message files.

**Tests:** 24 new. Three existing assertions were updated for new codes, keys and the reworded heading. No test ID changed.

## Gates

| Gate | Result |
|---|---|
| frontend `npx tsc --noEmit` (branch and main) | exit 0 |
| frontend `npm test` (branch and main) | 1628 passed (1604 + 24), 0 failed |
| frontend `npm run build` (branch) | exit 0; tsconfig.tsbuildinfo restored |
| out-of-slice paths | `git diff --stat` over services, frontend/app, workspace and office: empty |
| line endings | the 14 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed. A real auto-approved run, the waiting reasons on real steps, the disabled look and the visual density are checked live in USER-TEAMS-LIVE-01, after STAGING-DEPLOY-FD-02. The acceptance line for approval settings is already in its body.

CHECKLIST: EVERY 11/11, UI 9/9 (2: I18N held by the control plane; 4: the skills and DESIGN.md were read and applied in the second commit, after the review; 9: the flows tests can't prove are in USER-TEAMS-LIVE-01)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The worker's live-check points (the disabled look and density) are superseded into USER-TEAMS-LIVE-01's existing approval-settings acceptance.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED. APPROVAL-SET-01, -01B and -01C are complete; approval settings are built and not deployed. COS-DRAFTS-01 stays in Lane 1.
