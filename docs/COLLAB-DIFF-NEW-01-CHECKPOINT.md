# COLLAB-DIFF-NEW-01 — Checkpoint

**Task:** COLLAB-DIFF-NEW-01 — The Reviewer diff includes files the Writer created
**Status:** COMPLETE AND LOCKED — 2026-11-04
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-04. Registered and admitted in 8e2e733085bfa661b6140e61f240344c9d3006d8. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

getWorkingTreeDiff in services/container-manager/src/git/git.service.ts keeps the commit check and the tracked git diff unchanged, then runs one more read-only exec in the session container. It lists untracked, non-ignored files with git ls-files --others --exclude-standard -z, reads each NUL-separated name into a shell variable (never into the command string, passed as ./name after --), and appends git diff --no-index against /dev/null for each. A byte budget passed as an environment variable bounds each file with head -c and stops the loop once spent; the combined text still goes through the 65536-character cap and marks truncated when cut. Exit 0, 1 and 141 count as success per file; a failing listing returns the tracked diff alone. Nothing is staged, stashed or committed. Route, controller and other git routes unchanged.

## Implementer

Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High. Touched only git.service.ts and git.service.spec.ts.

## Control-plane review

Read the diff. Reran: container-manager npm test 10 suites, 205 tests passed; npm run build exit 0. New tests cover a new file after the tracked diff, ignored files, names with a space or a leading dash, a binary file, the cap on a large new file, a failing listing, and no mutating git command.

## Limits

Mock-tested only; not deployed. The script relies on read -d and set -o pipefail in the sandbox image shell (BusyBox ash on node:24-alpine); if either is missing, the route returns the tracked diff alone. STAGING-DEPLOY-03 checks it live. The diff header for new files may show the ./ prefix.
