# COLLAB-WRITE-01 — Stage-start (design for Keith's approval)

**Task:** COLLAB-WRITE-01 — The Writer applies fixes after approval; the Reviewer runs tests
**Status:** Step 2 stage-start written 2026-11-03; implementation waits for Keith's approval of this note.
**Authority:** GOV-HARNESS-RESET-01 decision 4 (Keith, 2026-10-31): harness direct writes with a pre-apply save point, staging only. That is the explicit approval the CLAUDE.md AI Workspace File-Action Rules require for this path.

## Tools per role

| Role | read_file, list_files, search_workspace | write_file | delete_file | run_validation |
|---|---|---|---|---|
| lead | yes | no | no | no |
| writer | yes | yes | no | yes |
| reviewer | yes | no | no | yes |

delete_file is left out for every role: fixes rarely need it and it is the hardest to notice. run_validation keeps the existing allowed list: `npm test`, `npm run build`, `npx tsc --noEmit`.

## How the role reaches the worker

The Gateway sets a signed job field `harnessToolProfile`: `read`, `review` or `write`, from the server team constant for the target role. The browser cannot set it. `harnessReadOnly: true` stays valid and means `read`. The worker registers and advertises only that profile's tools, per job. The global flags still gate: `write` needs AGENT_HARNESS_ENABLE_WRITE_TOOLS true, and `review` and `write` need AGENT_HARNESS_ENABLE_VALIDATION_TOOLS true. If a gate is off, the job fails with a readable reason; it never silently drops to fewer tools or falls back to a plain answer.

## Save point and undo

The writer job uses the existing pre-apply checkpoint before its first write, and the existing server save of the project after a run that wrote (HARNESS-SAVE-01). The worker records the checkpoint hash and the paths it wrote in the execution metadata. Checkpoint creation, listing and revert are not changed; Keith reverts from the workspace checkpoint list as today.

## What Keith sees

- Before approving a writer step: a clear line on the card that this step can change files.
- After it: the files changed, the save point, and a link to the workspace to review or revert.
- Reviewer and writer cards show when they ran a test command and whether it passed.
- All new text in en, zh-TW and zh-CN.

## Tests required

Each role gets exactly its tools with all global flags on; the profile cannot be changed in the queue without failing the proof; a gate off fails with a reason; the writer takes the checkpoint before its first write and the project is saved after; no role can delete; a reviewer job cannot write even if it asks; changed paths reach the page; Agent mode and runs without file access unchanged; the page shows the writer warning before approve.

## Not in this task

Send-back rounds, delete, other roles writing, auto-approval, product exposure. Collaboration stays FUTURE in PRD.md and allow-listed on staging.

## Live check (COLLAB-LIVE-06)

Write and validation flags on for the window. Keith gives the team a real fix in C1 repeat, approves the writer, checks the change in the workspace, then reverts it from the checkpoint list.
