# COS-DRAFTS-01B — Checkpoint (slice 01B: draft card and prefilled form)

**Task:** COS-DRAFTS-01B — Chief of Staff draft card and prefilled form
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** AGENT. **Lifecycle:** 4-STEP; the stage-start is shared with COS-DRAFTS-01. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the COS-DRAFTS-01 stage-start approval. Keith approved it ("Yes, approve both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1-2. Registration and stage-start | shared with COS-DRAFTS-01 | ee1e8f6 |
| 2a. Admission | Lane 1 with FRONTEND and I18N. The route file is kept out of the write set: the validator refuses `[` in paths, and the query is read in a client effect instead. | 696c4a8 |
| 3. Implementation | sonnet subagent (Sonnet 5.5: frontend-only UI and copy) in worktree lane/COS-DRAFTS-01B, cherry-picked onto main | 098754f |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

### Team page

The draft card appears on a completed Chief of Staff step whose detail has `draft`.
- **A valid draft** shows "Draft <kind>: <name>", the parts in `<details>`, "Nothing is saved yet…", "Folders, connected tools, model, budget and team are yours to set…", any dropped parts with their reasons, and one "Review and save" link to `/platform?draftRun=&draftStep=`.
- **An invalid draft** shows its translated reason, and the unknown labels for `unknown_label`, with no link.
- **The reader** (`collaboration-draft.ts`, new) fails closed. Unknown reasons, a missing kind or a missing name read as invalid, and stray fields and bad reply languages are dropped.
- **The answer** is shown without the block. A step without a draft renders exactly as before.

### Dashboard

It reads `draftRun` and `draftStep` from `window.location.search` in a client effect, with no `useSearchParams`, so the route file is unchanged.
- **Prefill.** It fetches the run detail through the existing API and opens the existing create form, prefilled with the eight text parts only and the notice "Prefilled from the Chief of Staff's draft. Check every part before you save." Access, model, budgets and team stay at their defaults.
- **Saving.** The save is the normal create through `handleSaveWorkflow`, and the server stores new rows as drafts. The prefill effect saves nothing; a test checks this.
- **Errors.** A 404, a missing step, no draft or an invalid draft shows a translated message and the empty form. A failed fetch shows a retry button.
- **Cleanup.** The query is cleared on save and on cancel.
- **No query string:** the dashboard is unchanged.

### Copy and design

**Copy.** Every invalid reason (11) and problem reason (5) named by COS-DRAFTS-01 is translated, along with the card, field and dashboard strings, in en, zh-TW and zh-CN. Keys are flat camelCase and the key sets are identical. No existing key was reworded.

**Design.** The worker read Impeccable, the Emil Kowalski skill and DESIGN.md. It applied:
- the existing collaboration tokens, with amber for the draft card, matching the Draft badge;
- the brand primary button with the single focus ring;
- Heroicons v2 Outline only;
- `<details>` with `min-w-0` and `break-words` for long text;
- the shared Spinner;
- no motion beyond a colour transition.

It did not run Impeccable's full redesign flow, because this is a bounded addition and that flow writes files outside the write set.

### Files and tests

**Files (13):**
- `collaboration-draft.ts` (new), `collaboration-view.tsx`, `collaboration-page.tsx` and the workflows test;
- `agent-workflow-model.ts`, `create-agent-form.tsx` and `platform-dashboard.tsx`, with the editor and dashboard tests;
- `lib/collaboration/api.ts`;
- the three message files.

**Tests:** 29 new. No existing test changed.

## Gates

| Gate | Result |
|---|---|
| frontend `npx tsc --noEmit` (branch and main) | exit 0 |
| frontend `npm test` (branch and main) | 1657 passed (1628 + 29), 0 failed |
| frontend `npm run build` (branch) | exit 0; tsconfig.tsbuildinfo restored |
| out-of-slice paths | `git diff --stat` over services, frontend/app, frontend/hooks, workspace and office: empty |
| line endings | the 13 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed. Not checked in a real browser or at phone width. A live draft is in USER-TEAMS-LIVE-01: card, Review and save, the prefilled form, Save as a draft, then a test run and switch on. The deploy is STAGING-DEPLOY-FD-02.

CHECKLIST: EVERY 11/11, UI 9/9 (2: I18N held by the control plane; 4: the skills and DESIGN.md were read and applied as listed; 9: the flows tests can't prove are in USER-TEAMS-LIVE-01)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Registered:** COS-DRAFTS-POLISH-01. The card shows the reply language as a raw code (owner, en, zh-TW, zh-CN), not a translated name.
- **Superseded into USER-TEAMS-LIVE-01:** the worker's six live-check flows. Its draft line already covers them; another owner's link is added there.

Accepted, not follow-ups:
- `lib/collaboration.test.ts` bans the literal "Chief of Staff" in the page and view source. That is an existing, deliberate guard.
- The stage-start's 1604 baseline is stale; the real baseline was 1628.
- A stray `/tmp/addmsgs.js` that the worker wrote outside the worktree is left for Keith to delete.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. COS-DRAFTS-01 and -01B are complete. Stage 4 is fully built and not deployed:
- the front door (deployed earlier);
- user teams;
- approval settings;
- Chief of Staff drafts.

Next: STAGING-DEPLOY-FD-02 (Keith approves the deploy), then USER-TEAMS-LIVE-01 and CHECKPOINT-LIVE-02.
