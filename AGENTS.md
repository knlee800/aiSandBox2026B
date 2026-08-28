# aiSandBox Agent Instructions

## Purpose

Thin bootstrap only. The operating manual is `C:\Users\knlee\aiSandBox2026B\CLAUDE.md`.
Do not treat this file as a second rulebook.

## Authority by domain

- PRD.md = PRODUCT WHAT
- ARCHITECTURE.md = TECHNICAL HOW
- CLAUDE.md = DEVELOPMENT OS / RULES
- AGENTS.md = this bootstrap
- TASKS.md CURRENT EXECUTION BOARD = only current scheduler
- TASKS_BACKLOG_FULL.md = canonical task registry
- Locked checkpoint / stage-start docs = evidence
- AINOW-EXECUTION-ROADMAP.md = historical / strategic reference, not scheduler
- AGENT-PLATFORM-00 = historical / strategic vision, not current PRD, architecture, or scheduler

CLAUDE.md defines admission / mutex / lifecycle rules.
The TASKS.md board applies those rules to specific tasks.
CLAUDE.md cannot admit a task.
The board cannot violate CLAUDE.md rules.
There is no global file-rank that overrides these domains.

## Boot sequence

1. Read this file.
2. Apply CLAUDE.md.
3. Read the TASKS.md CURRENT EXECUTION BOARD ONLY. Stop at the LEGACY / FROZEN boundary.
4. If the board does not admit the requested product/architecture work and the user is selecting genuinely new next work: do not start implementation; follow CLAUDE.md "Next-Work Selection Protocol"; do not select from chat, model, or window memory.
5. If your task is not admitted on the board: DO NOT START.
6. Read the exact admitted TASK ID in TASKS_BACKLOG_FULL.md.
7. Read the named stage-start / checkpoint only when that task requires it.
8. Read PRD.md or ARCHITECTURE.md only if the admitted task scope requires product or technical authority.

Do not recover current work by grepping historical ACTIVE, reading roadmap Current Next Task, reading Platform-00, or using chat memory.
Do not select next product/architecture work from chat, model, or window memory.

## Writers

Implementation workers must not modify TASKS.md, TASKS_BACKLOG_FULL.md, CLAUDE.md, or AGENTS.md.
They must not self-register, self-admit, choose a lane, or acquire / release mutexes.
Report results to the control plane. The control plane updates the board and registry.

## Conservative default

If unclear: do not start, do not invent work, do not expand scope.
Keith/user owns Git. No commit, push, branch, or worktree unless explicitly requested.
No subagents by default.
