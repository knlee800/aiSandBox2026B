# GOV-DEPLOY-WINDOW-01 — Checkpoint

**Task:** GOV-DEPLOY-WINDOW-01 — Correct the deploy rule for an open tester window
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Nature:** GOVERNANCE (no lane). **Lifecycle:** 1-STEP control-plane record (rule wording; no Development OS semantics change).
**Source:** registered by STAGING-DEPLOY-10, whose first attempt stopped at the host deploy tool (aisandbox-deploy refuses while GLOBAL_EXECUTION_ENABLED is not false). Keith approved the wording on 2026-11-06.

## What changed

- CLAUDE.md, Tester window (GOV-OS-06): one sentence added to the bullet on deploys during an open window: the deploy also holds ENV; once nothing is running it saves the window gateway.env, switches GLOBAL_EXECUTION_ENABLED off for the deploy only, deploys, then restores the saved file byte for byte and checks the window hashes and that runs are back on; Keith is told first that runs pause for a few minutes.
- docs/control-plane/task-checklists.md, DEPLOY list: item 7 states the same as a checklist item.
- TASKS.md and TASKS_BACKLOG_FULL.md: this record.

This is the procedure STAGING-DEPLOY-10 used on 2026-11-06 (runs off about four minutes, window file restored byte for byte).

## Acceptance criteria

Both met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: governance wording, no code, no runtime), GOVERNANCE 9/9 (1: wording only, not an OS-semantics change; 2: no new task registered)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. GOVERNANCE held and released within this record.
