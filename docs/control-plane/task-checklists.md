# Task checklists (GOV-OS-07)

Short checklists by task type. Each item ends with its source: a CLAUDE.md section, or "GOV-OS-07", meaning a practice rule CLAUDE.md adopts through its "Rule checklists (GOV-OS-07)" section. CLAUDE.md wins if this file and CLAUDE.md differ; a CLAUDE.md change that affects a list updates this file in the same record.

A brief for Cursor or another worker copies the lists for its task type from this file, never from an earlier brief. Every checkpoint carries one CHECKLIST line, for example:

`CHECKLIST: EVERY 11/11, UI 9/9, FLOWS n/a (no checkpoint or file-action change), BACKEND n/a (frontend only)`

An item that does not apply counts as met only when the checkpoint says why. Rules the validator already enforces (lane capacity, mutex conflicts, the tester-window refusal) are not repeated here.

## EVERY — every task

1. Admitted on the TASKS.md board before work starts; scope, write set, mutexes and evidence class approved by Keith (Project Governance Loop; Admission rules).
2. The loop is named: 2-step, 3-step or 4-step; risky, security-sensitive, governance, migration or ambiguous work uses the 4-step loop with a stage-start (Task Workflow Rules).
3. The model is passed explicitly, never Auto; grok-4.7-xhigh only for the cases Model Routing lists; a Claude subagent uses Fable 5.1, Opus 5.5 or Sonnet 5.5 as Model Routing lists, and the brief says which and why (Model Routing).
4. A fresh worker session, Cursor or Claude subagent, gets a self-contained brief and follows the boot sequence; a subagent is used only under the Subagent implementers rules and never spawns further subagents (New Window Rules; Subagent implementers (GOV-OS-08)).
5. Only files in the declared write scope change; nothing unrelated is refactored; a new dependency is asked for first and takes the PACKAGE mutex (Source and Scope Rules; Resource / mutex model).
6. Behavior changes have added or updated tests; the worker reports the exact files changed (Source and Scope Rules).
7. The worker runs the gates for the changed areas and reports exact results; the control plane reruns them before commit; environmental failures are reported apart from code failures (Testing and Validation Rules; Common Validation Commands).
8. Docker, PostgreSQL, Redis, migrations and servers are not started unless the task requires that runtime, and the requirement is stated first (Runtime / Live-Smoke Rules; Commands and Shell Rules).
9. Validation artifacts changed by a build, such as frontend/tsconfig.tsbuildinfo, are restored (Common Validation Commands).
10. Workers never push, merge, commit to main, or create, switch or delete branches or worktrees; in a worktree the worker edits only there (a Cursor worker runs no git); only the control plane brings the branch into main, fast-forward or cherry-pick, after reading the diff and rerunning the gates, then removes the worktree and branch; the control plane commits only work Keith authorized (Git / Operator Rules).
11. Every named follow-up gets a disposition; the closing record carries the FOLLOWUPS line (Project Governance Loop).

## UI — any change to visible frontend text, layout, components or interaction

1. Every new or changed visible string is in en.json, zh-TW.json and zh-CN.json through the existing translation hook, with no hardcoded English; zh-TW and zh-CN are real translations, not English; tests check the keys or rendered copy where practical (Multilingual-First UX/UI Rule; GOV-OS-07 for real translations).
2. Editing the three message files takes the I18N lease (Resource / mutex model).
3. Icons are Heroicons v2 Outline (Icons).
4. The brief names the Impeccable and Emil Kowalski skills in .agents/skills; the worker reads them before changing UI; the checkpoint says what was applied or why not (UX/UI Work Rules).
5. DESIGN.md is followed for colors, type, spacing, components and states; until DESIGN-DOC-01 locks this item is n/a with that reason (UX/UI Work Rules).
6. Where the changed UI can be empty, loading, failed or successful, each of those states has defined, translated text and is covered by a test or the live check (GOV-OS-07).
7. No broad redesign, routing change, backend work, new dependency or architecture refactor unless approved (UX/UI Work Rules).
8. Existing test IDs are kept unless the task changes them (Source and Scope Rules).
9. A UI flow that tests cannot prove gets a live check; an interactive browser check involves Keith unless browser automation was requested; the task is not marked complete while a required live check is blocked (Testing and Validation Rules; Runtime / Live-Smoke Rules).

## FLOWS — any change, frontend or backend, that touches checkpoints, revert or AI file actions

1. Checkpoint creation, listing and revert are unchanged unless the task targets them; revert still restores workspace files, editor state, file tree, preview and the checkpoint list; no parallel undo system (Checkpoint and Revert Rules).
2. A checkpoint or revert change has tests and a live check where practical (Checkpoint and Revert Rules).
3. AI file changes keep the existing flow: parsing, risky-batch confirmation, apply-once guards, sequential writes, post-action coherence, checkpoint creation, and refresh of file tree, editor, preview and checkpoints (AI Workspace File-Action Rules).
4. No direct DOM rollback, direct workspace mutation or unconfirmed auto-apply unless approved (AI Workspace File-Action Rules).

## BACKEND — gateway, AI service or container manager source

1. Platform auth, session cookies, CSRF, internal service keys, guards and authorization are unchanged unless the task requires it (Auth and Security Rules).
2. Internal endpoints keep their guard and stay unreachable from the frontend (Internal API Endpoints).
3. Generated-app templates do not reference platform cookies, keys or guards (Auth and Security Rules).
4. A frozen shared contract is not changed silently; a needed change stops the lane and returns to the control plane (Shared-contract freeze / change protocol).
5. An entity or schema change also uses the MIGRATION list and mutex (Resource / mutex model).
6. Gate results are compared with the known failures recorded in that service's latest checkpoint; any new failure is reported (GOV-OS-07).

## MIGRATION — migration files, or entity and schema changes that need a migration

1. MIGRATION mutex held; the 4-step loop; grok-4.7-xhigh for implementation (Resource / mutex model; Task Workflow Rules; Model Routing).
2. Migration order and timestamps are checked against the existing migrations (Resource / mutex model).
3. Up and down are both written and the down path is tested or reviewed (GOV-OS-07).
4. No destructive database operation (Runtime / Live-Smoke Rules).

## DEPLOY — any staging deploy or host change

1. STAGING mutex held (Resource / mutex model).
2. The env files are checked against the expected hashes before and after: the baseline hashes from the latest deploy checkpoint, or, while a tester window is open, the window hashes from the checkpoint that opened it; the evidence says when a tester may be active (Tester window (GOV-OS-06); GOV-OS-07).
3. While a tester window is open, Keith is told before a deploy restarts the services (GOV-OS-07).
4. Nothing queued or running before the deploy; after it, the deployed commit and the migration hash in the host DEPLOYED file are as expected, health and guard checks pass, and configuration files are unchanged unless the task changes them (GOV-OS-07).
5. Host steps run from the staging host; no tests against servers from Keith's PC (GOV-OS-07).
6. No secret is printed, recorded or asked for; outputs are checked for key text before they are saved (GOV-OS-07).
7. While a tester window is open, the deploy also holds ENV and pauses runs only for the deploy: it saves the window gateway.env, switches GLOBAL_EXECUTION_ENABLED off once nothing is running, deploys, restores the saved file byte for byte, and checks the window hashes and that runs are back on (Tester window (GOV-OS-06); GOV-DEPLOY-WINDOW-01).

## LIVE — any run against a real provider

1. PROVIDER-LIVE mutex held; CREDIT too when the run spends credits or checks credit behavior (Resource / mutex model).
2. The draft states the caps and the expected spend; the key comes from the stored key file on the host and is never shown (GOV-OS-07).
3. Live success is claimed only from host-side records (usage rows, logs) or Keith's own report; a task whose required live check is blocked is not marked complete (Runtime / Live-Smoke Rules; Testing and Validation Rules).
4. A live task that needs a fix pauses (the three authorization flags false, liveWindowPaused true) instead of returning to READY (Record economy (GOV-OS-04)).

## READINESS — any condition that must hold before a named milestone (for example before a second user, before a paid launch)

1. In the same record that names it, the condition is listed where that milestone's readiness is tracked: the milestone's gate task or its checklist; if no such place exists, the condition is registered as a follow-up task (GOV-OS-07; Project Governance Loop).
2. A claim that a milestone is ready lists each condition with its task and state (GOV-OS-07).

## GOVERNANCE — changes to CLAUDE.md, AGENTS.md, the board, the backlog or the sidecar

1. GOVERNANCE mutex held. A change to Development OS semantics (lane capacity, scheduler authority, admission, mutex semantics, worker permissions, boot or recovery rules) is a registered governance task that begins with both lanes empty; registration, admission, board updates, LOCK and mutex release are routine and are not (Standing-governance anti-drift rule; OS-mutation quiescence rule).
2. New tasks carry the registration metadata, one AISB_MACHINE_REG_V1 stanza and, for implementation tasks, a sidecar candidate with the saturationClass Keith named; follow-ups are registered READY and NOT_READY with what makes them ready and who decides (Lean future registration metadata; Fail-closed lane saturation (GOV-OS-03); Project Governance Loop).
3. Admission checks every admission rule; if it is uncertain whether two tasks are independent, they are not admitted together; shared contracts are frozen before parallel work (Admission rules; Shared-contract freeze / change protocol).
4. Before LOCK, the integrated tree is correct, integrated tests are rerun, and the evidence of the other lane still holds (Revert / evidence isolation; Lane states).
5. LOCAL-TESTS code and LOCK may be one commit after the diff is read and the gates rerun; every other evidence class keeps a separate LOCK record (Record economy (GOV-OS-04)).
6. End status is mirrored into the board fields and the backlog body; no full-body mirroring; nothing is appended to Program Status; board lines state the current state only (Scheduler vs registry; Record economy (GOV-OS-04)).
7. Genuinely new product or architecture work follows the Next-Work Selection Protocol before it is recommended or registered (Next-Work Selection Protocol).
8. Consolidation-only steps touch no production source; locked tasks and documents are not edited except for an explicitly approved documentation correction (Source and Scope Rules; Project Governance Loop).
9. The validator runs at every machine-relevant transition (Fail-closed lane saturation (GOV-OS-03)).
