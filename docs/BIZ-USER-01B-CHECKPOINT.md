# BIZ-USER-01B — Checkpoint

**Task:** BIZ-USER-01B — The Create Agent editor for user workflows
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed. The next staging deploy also runs BIZ-USER-01A's migration.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan A9, C8, C10). Admitted 2026-11-10 (ba0dbd1) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with FRONTEND and I18N, write set fixed at admission | ba0dbd1 |
| 2. Implementation | sonnet subagent in worktree lane/BIZ-USER-01B (1ee49da), cherry-picked onto main | bcd2dba |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (11 files, all in frontend/components/platform/, the hook and the message files)

1. **Two ways to start.** "Start blank" or "Copy the Chief of Staff", from the options route's template list. A copy uses `POST /api/agents/from-template`, then opens the new row in the editor with a "Copied" notice.
2. **Basic fields.**
   - Name, role and description keep their old test IDs.
   - Tone has a counter.
   - Reply language is a select.
   - Purpose, procedure and result share one counter, `used of max`. When editing, it matches the server's `instructionsChars`; going over blocks the save.
   - The nine knowledge folders are ticks.
   - Connector tools appear only for connected kinds. A held but unconnected tool shows a "Not connected" badge, with a link to the Connections page.
   - The tool profile is shown as "Read only" and is never sent.
3. **Advanced** (collapsed):
   - the model, with its credit cost ("1 credit per 1K tokens");
   - budgets per run and per day: whole numbers, per day at least per run, and the platform daily cap shown as a hint.
4. **Shown, not set.** The never-do list (`neverDo.<CODE>` keys; KNOWLEDGE_ONLY_SCOPES names the folders) and the server's grants. Before the first save it reads "Shown after you save".
5. **Edit.** An "Edit workflow" button on the detail panel opens the form for `PATCH /api/agents/:id`. Cleared tone, language and budgets are sent as `null`.
6. **Errors.** All nine refusal codes map to translated messages next to the right field, with a generic fallback.
7. **States.** Loading (Spinner), options failed with "Try again", empty, saving, saved and failed.
8. **Copy.** 106 new keys under `platform.agentWorkflow` in each of en, zh-TW and zh-CN; only lines were added, none removed. Folder names reuse `knowledge.scopes.*`.
9. **Existing behavior.** Every existing test ID is kept. With no workflow prop, the form is the old three-field create, and a blank create left at the defaults still sends exactly name, role and description.
10. **The hook.** `useUserAgents.ts` gains the workflow types, the options, template and PATCH requests, and `useUserAgentOptions`. Writes send `X-CSRF-Token` when the cookie is present.

Tests: 42 new, 35 for the editor and 7 for the hook. They cover:
- request bodies;
- the budget checks;
- the counter;
- all refusal codes in three languages;
- connector visibility;
- rendering;
- the plain create;
- translation key parity;
- hook URLs, methods and errors.

Skills: Impeccable (plain sections, advanced collapsed, errors under their field, written-out states) and Emil Kowalski (press feel kept, no new motion, `motion-reduce` honored). DESIGN.md tokens are used throughout.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1361 tests, 1361 pass, 0 fail (1319 before + 42 new) |
| `npm run build` (PowerShell) | exit 0 (tsconfig.tsbuildinfo restored) |

- Every changed file is inside the write set.
- After the cherry-pick, the frontend on main is identical to the branch, and the changed files are LF.

## Live check (at the next staging deploy, after the migration)

1. Options load, and both start choices appear.
2. A plain three-field create works and shows the old success message.
3. A full blank create, reopened with Edit workflow: every value matches, the counter equals `instructionsChars`, and the never-do list and grants show.
4. Copy the Chief of Staff: it opens with the notice and the template parts.
5. With no mailbox, there is no mail tick and the Connections link works; after connecting, the mail tick appears.
6. Refusals sit next to the right field.
7. zh-TW and zh-CN.
8. Phone width: no horizontal overflow.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI 8/9 (9: the live check above at the next deploy)
FOLLOWUPS: 0 registered / 4 superseded / 0 dropped / 0 undisposed:
- a workflow summary on the detail panel and dashboard card: superseded by BIZ-USER-01C, whose scope now names it;
- the test run and status controls: already BIZ-USER-01C;
- folder display names for owner-named folders: superseded by KNOW-FOLDERS-01, whose scope now names it;
- whether a workflow may be asked before its test run: superseded by BIZ-USER-01C.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. AI-SERVICE-AUTH-01 stays ACTIVE in Lane 2.
