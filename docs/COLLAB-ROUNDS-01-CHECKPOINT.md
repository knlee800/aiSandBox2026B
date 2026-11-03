# COLLAB-ROUNDS-01 — Checkpoint

**Task:** COLLAB-ROUNDS-01 — Reviewer can send work back to the Writer, and sees the diff
**Status:** COMPLETE AND LOCKED — 2026-11-03
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-03. Registered and admitted in efb51a4be6f4c668c556c5edd8ecd640d01108bb. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

Reviewer to writer is allowed as a send-back round, at most 2 per run (MAX_SEND_BACK_ROUNDS), with one writer-to-reviewer return after each; those edges skip the depth check; a third send-back and every other loop are refused with the existing loop audit. The 8 hand-off limit still applies. Reviewer and writer instructions now cover send-back. A new read-only container-manager route, GET /api/internal/git/:sessionId/worktree-diff/:commitHash, behind the internal guard, validates a full hash before any git call, runs only rev-parse and diff with the hash in an environment variable, caps output at 65536 characters and never stages or commits. When a writer hand-off finishes with a save point, the Gateway fetches that diff, adds it to the next reviewer prompt and returns it on the writer hand-off; a failed fetch leaves a note and fails nothing. The page labels rounds and shows the diff as collapsed plain text. New text in en, zh-TW and zh-CN.

## Implementer

Cursor CLI, requested grok-4.7-xhigh, one run.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| container-manager `npm test`, `npm run build` | 199 passed; exit 0 |
| api-gateway `npx jest`, `npm run build` | 2560 passed, 7 skipped, 14 failed (only the known smoke.integration failures); exit 0 |
| frontend `npx tsc --noEmit`, `npm test`, `npm run build` | exit 0; 833 passed; tsconfig.tsbuildinfo restored |
| Validator | exit 0 at this record |

## Limits

Not deployed. The diff covers tracked files only, so a file the writer creates does not appear in it. Each writer round reuses the worker's pre-apply checkpoint; no extra checkpoint is created. A rejected send-back still counts as a round.
