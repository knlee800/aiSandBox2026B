# GOV-OS-08 — Checkpoint

**Task:** GOV-OS-08 — Worktree isolation and subagent implementers
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Nature:** GOVERNANCE (Development OS mutation: worker permissions and boot rules). **Lifecycle:** 2-STEP.
**Record:** registered 0adb817 with Keith's approval of the scope; begun 56564a3 with both implementation lanes empty after CONN-02B locked (saturation suspended, OS_MUTATION); this closing record ends the mutation. Keith approved the wording and confirmed his settings change on 2026-11-09 ("Approved, settings done").

## Why

The rules forbade what the project now wants: workers in their own worktrees and Claude subagent implementers. Two lanes in one folder also collided (a package install in one lane could disturb builds and tests in the other), which forced waits on 2026-11-09.

## What changed

| File | Change |
|---|---|
| CLAUDE.md, New Window Rules | "Do not use subagents by default" replaced by the section "Subagent implementers (GOV-OS-08)": same self-contained brief, checklists and review as a Cursor run; its own worktree unless the task changes only records; same limits as any worker (no records, board, registry, sidecar or governance files; no admission or mutexes; no push; never spawns further subagents); a subagent does not add a lane |
| CLAUDE.md, Model Routing | Last reviewed 2026-11-09; Cursor runs unchanged; Claude subagent runs: Fable 5.1 (design and planning, hard implementation), Opus 5.5 (risky or security-sensitive slices, independent reviews), Sonnet 5.5 (routine bounded slices); the brief names the model and reason, the checkpoint the model used |
| CLAUDE.md, Git / Operator Rules | Workers never push, merge, commit to main, or create, switch or delete branches or worktrees. The control plane may give a task its own worktree on branch lane/<TASK-ID> from main; a subagent may commit on that branch; a Cursor worker runs no git and the control plane commits for it. Only the control plane brings a branch into main: diff read, gates rerun, git merge --ff-only, or cherry-pick when main has moved (rebase stays denied), gates rerun on main where the evidence needs it, worktree and branch removed; no merge commits, no force push. Admission is unchanged: two lanes, the same mutexes, write-set, HOTFILE, PACKAGE and I18N rules |
| AGENTS.md | The same rules in short |
| docs/control-plane/task-checklists.md | EVERY items 3, 4 and 10 updated to match, in this record as GOV-OS-07 requires |
| .claude/settings.local.json (Keith, not in Git) | Deny "Bash(git merge *)" removed; allowed "Bash(git merge --ff-only *)", "Bash(git cherry-pick *)", "Bash(git worktree add *)", "Bash(git worktree remove *)", "Bash(git worktree list *)", "Bash(git branch -d lane/*)"; checkout, switch, reset, stash, clean and rebase stay denied. The control plane checked the file |

Unchanged: two implementation lanes, Lane 3 disabled, mutexes, the scheduler, admission rules, the validator and sidecar schema, saturation, the record economy, the tester window, Keith's approval of every record, and Keith owning pushes as today. Cursor still runs no git.

## Validation

Validator at the begin record: PASS, OS_MUTATION_QUIESCENCE. At this closing record: see the commit (the mutation ends, saturation is no longer suspended, both lanes empty).

CHECKLIST: GOVERNANCE (GOVERNANCE held from the begin record to this one; the OS change began with both lanes empty; CLAUDE.md, AGENTS.md and the checklist file changed in one record), EVERY 1 (Keith approved the scope and the wording), 10 (no worker git), 11 (no follow-ups); the other EVERY items are n/a: no code, build or runtime.
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Development OS mutation ended; GOVERNANCE released UNOWNED.
