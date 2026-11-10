# COS-FRONTDOOR-01C — Checkpoint (slice 01C: Team page)

**Task:** COS-FRONTDOOR-01C — Front-door Team page
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. The stage-start is shared with COS-FRONTDOOR-01. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the COS-FRONTDOOR-01 stage-start approval. Keith approved Stage 4 on 2026-11-10.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1-2. Registration and stage-start | shared with COS-FRONTDOOR-01 | 8ddd651 |
| 2a. Admission | Lane 1 with FRONTEND and I18N | 9ea4048 |
| 3. Implementation | sonnet subagent (Sonnet 5.5: frontend-only UI in three languages) in worktree lane/COS-FRONTDOOR-01C, fast-forwarded onto main | 4f55044 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Roster picker** under the Team page's Chief of Staff option (`collaboration-roster`):
- Loads `GET /api/collaboration/roster` once and saves with `PUT {memberIds}` in tick order.
- States: loading, empty, failed with retry, loaded, and saved.
- A fourth tick is refused with a hint.
- An unusable member shows its reason (draft, not_tested, off, missing, coming_soon, invalid) and can't be newly ticked, but can be unticked.
- A refused save maps to a clear message.
- Hidden for coding, advisors and a selected workflow.

**Session-less Chief of Staff start:**
- Without a session, the Team page offers only the Chief of Staff.
- The start body is `{ task, team: "chief-of-staff" }`, with no `sessionId` (tested).
- With a session, bodies are unchanged. No roster is ever sent.

**Run display:**
- `roster.skipped` appears as a hint naming the left-out members and the reason.
- Step labels come from the run detail's `agents`.
- A step from an agent to the Chief of Staff reads "{agent} → Chief of Staff (report-back)".

**Long report-back prompts:** a waiting report-back has no Edit button and shows a translated note. Approve, Reject and the full prompt remain. A server-written prompt can exceed the 4000-character edit cap, and an edit would drop content.

**Copy:** 35 new and 4 reworded keys in en, zh-TW and zh-CN (the worker's report lists them).
- Reworded: `teamChiefOfStaffHint`, `chiefOfStaffSummary` and `fileAccessReadOnly` no longer say the Chief of Staff does not hand off. `missingSession` now covers workflows and the Chief of Staff.
- The worker read Impeccable, the Emil Kowalski skill and DESIGN.md. It reused the workflow picker's patterns, brand primary, emerald and amber, one focus ring, `aria-live` messages, Heroicons v2 Outline, and phone-width safety. It added no new motion beyond the existing press scale.

**Files (7):**
- `frontend/components/collaboration/collaboration-roster.ts` (new)
- `collaboration-view.tsx`, `collaboration-page.tsx`
- `collaboration-workflows.test.tsx`: +38 tests; 2 existing assertions updated for the session-less default and the reworded `missingSession`
- the three message files

`lib/collaboration.test.ts`, hooks, lib, app, the gateway and ai-service are untouched.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1573 passed (1535 + 38), 0 failed |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| line endings | the 7 files are LF |

## Limits

Not deployed. The deploy is STAGING-DEPLOY-FD-01, a migrating deploy with 1805, and it needs Keith's approval. Keith's live check is FRONTDOOR-LIVE-01. It needs runs on, and covers:
- a real roster round trip driving a run;
- a session-less start;
- the skipped hint;
- labels and the report-back step;
- phone width, zh-TW and zh-CN.

CHECKLIST: EVERY 11/11, UI 9/9 (9: the flows tests can't prove are in FRONTDOOR-LIVE-01)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed. Accepted as designed, not follow-ups:
- A draft or untested workflow can't be newly ticked. It couldn't run anyway; the server would skip it at start.
- `platform.chiefOfStaffCapabilityThree` is still accurate.
- An unreachable roster offers Try again instead of retrying on its own.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. COS-FRONTDOOR-01, -01B and -01C are complete. The front door is built and not deployed.
