# GOV-ROUTING-01 — Checkpoint

**Task:** GOV-ROUTING-01 — Worker choice, subagent model routing and the worktree procedure
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Nature:** GOVERNANCE; no lane. **Lifecycle:** 2-STEP in one record (GOV-OS-04 record economy): registration and closing together, because Keith approved the exact wording first ("Approve wording", 2026-11-09).
**Not an OS mutation:** Model Routing, window guidance and the worktree procedure are not among the Development OS semantics (lane capacity, scheduler authority, admission, mutex semantics, worker permissions, boot or recovery). Worker permissions were set by GOV-OS-08 and are unchanged here.

## Dry run that informed the wording (2026-11-09, no task code)

The control plane created the throwaway worktree C:\Users\knlee\aisb-worktrees\DRYRUN-01 on branch lane/DRYRUN-01 from main 166bcda and linked node_modules from the main checkout with Windows junctions (root, services/api-gateway, services/container-manager). A background Claude subagent on sonnet wrote one file there, ran git add and git commit (commit 76d3924, one file, checked by the control plane), the connectors-mcp tests (52 passed), and typechecks of connectors-mcp and api-gateway (both exit 0), under Node 22.14.0. No permission prompt appeared; the session runs in auto mode, so a stricter mode would ask for the out-of-repo edit and the commit. The main checkout was untouched. Cleanup: the junctions were removed first (the main checkout's node_modules kept its 811 entries), then git worktree remove, then git branch -D lane/DRYRUN-01 (git branch -d refused an unmerged branch).

A read-only docs check (sonnet, official Claude Code docs) confirmed: CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH set to 1 in the settings env block stops subagents from starting subagents (needs v2.1.217 or later; installed 2.1.310); a background subagent's permission prompts appear in the main session and Esc denies one call; the Desktop app shows background subagents in the title bar's menu, "Background tasks".

## What changed (CLAUDE.md)

| Section | Change |
|---|---|
| Model Routing | "Choosing the worker": a Claude subagent by default for LOCAL-TESTS tasks; a Cursor desktop prompt for anything needing Keith's browser or console sign-in; Cursor CLI on Keith's request or for a second opinion. "Claude subagent model": sonnet for 3-step single-service or frontend slices without migration, auth, security, frozen-contract or cross-service change; opus for 4-step tasks, anything touching auth, guards, CSRF, credentials, encryption, migrations, a frozen contract, internal routes, child processes or data deletion, cross-service changes and every independent review; fable for design and planning documents and stage-start drafts, architecture-heavy slices, hard implementation, unclear root causes or work where opus failed; the stronger model when unsure; model passed explicitly, never inherited; named with its reason to Keith before dispatch; recorded in the checkpoint |
| New Window Rules | These window rules apply to Cursor runs; subagent runs happen inside the control-plane session |
| Git / Operator Rules | Worktree procedure: worktrees in C:\Users\knlee\aisb-worktrees\<TASK-ID>; node_modules linked from the main checkout by junctions and unlinked before the worktree is removed; an abandoned branch deleted with git branch -D lane/<TASK-ID> |

## Settings drafts given to Keith (not applied by the control plane)

In .claude/settings.local.json: an "env" block with "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1"; "permissions.additionalDirectories" with "C:\\Users\\knlee\\aisb-worktrees"; allow "Bash(git branch -D lane/*)". Keith applies them himself.

Keith's global ~/.claude/CLAUDE.md was updated on his request (2026-11-09) with a Claude subagents section; it is outside Git.

CHECKLIST: GOVERNANCE (GOVERNANCE held only while writing this record; no OS semantics changed), EVERY 1 (Keith approved the wording), 3 (models named), 10 (the dry-run worker committed only on its lane branch; nothing reached main), 11 (no follow-ups); other EVERY items n/a: no product code, build or runtime.
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. GOVERNANCE released UNOWNED.
