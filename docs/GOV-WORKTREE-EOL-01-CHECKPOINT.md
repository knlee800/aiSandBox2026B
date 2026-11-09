# GOV-WORKTREE-EOL-01 — Checkpoint

**Task:** GOV-WORKTREE-EOL-01 — Line endings in worktrees and merges
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Nature:** GOVERNANCE; no lane. Not a Development OS mutation (the worktree procedure, GOV-ROUTING-01). **Lifecycle:** registered by the CONN-GRANT-01 lock (80b45a7); Keith chose to fix it before the next task ("Fix line endings first", 2026-11-09); this record closes it.

## Problem

Git's system setting core.autocrlf=true (C:/Program Files/Git/etc/gitconfig) checked new worktrees out with CRLF and made fast-forwards and cherry-picks write CRLF into this checkout, while its source files are LF. One ai-service test reads worker.processor.ts raw and fails on CRLF. 687 tracked files in this checkout were already CRLF before 2026-11-09; this task does not change them.

## Fix

- CLAUDE.md, Git / Operator Rules, new line "Line endings (GOV-WORKTREE-EOL-01)": the control plane creates worktrees with `git -c core.autocrlf=false worktree add -b lane/<TASK-ID> <path> main` and brings work into main with `git -c core.autocrlf=false merge --ff-only lane/<TASK-ID>` or `git -c core.autocrlf=false cherry-pick <commit>`; a file that still lands with CRLF is converted back to LF in this checkout (no content change, git diff empty) before the gates on main.
- Keith added three allow rules to .claude/settings.local.json (not in Git), checked by the control plane: "Bash(git -c core.autocrlf=false worktree add *)", "Bash(git -c core.autocrlf=false merge --ff-only *)", "Bash(git -c core.autocrlf=false cherry-pick *)".

## Test

A throwaway worktree created with `git -c core.autocrlf=false worktree add -b lane/DRYRUN-03 ... main` checked out with LF (0 carriage returns in worker.processor.ts, TASKS.md and frontend/messages/en.json) and a clean git status; it and its branch were removed. The merge and cherry-pick forms are proven on the next task's merge.

Not chosen: a repository-wide `.gitattributes` with `* text=auto eol=lf`, which would renormalize many files and would be its own reviewed task.

CHECKLIST: GOVERNANCE (GOVERNANCE held only while writing this record; no OS semantics changed), EVERY 1 (Keith chose the fix and added the settings), 11 (no follow-ups); other EVERY items n/a: no product code, build or runtime.
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. GOVERNANCE released UNOWNED.
