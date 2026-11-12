# SNAPSHOT-LABEL-02 — Checkpoint

**Task:** SNAPSHOT-LABEL-02 — One label parser for the project history list
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the SNAPSHOT-LABEL-01 LOCK. Admitted by the control plane on Keith's "Small follow-ups".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with GATEWAY (examples file only) and FRONTEND: `workspace-shell.tsx`, its test and the examples fixture | aeec696 |
| 1. Implementation | sonnet subagent (Sonnet 5.5: one frontend file, its test and a fixture) in worktree lane/SNAPSHOT-LABEL-02, fast-forwarded onto main | d85eec2 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **One parser:** `computeProjectHistoryRows` in `workspace-shell.tsx` now filters with the shared `parseProjectIdFromSnapshotLabel` from `workspace-snapshots.logic.ts`. It is exported for the tests.
  - The duplicate `parseProjectIdFromProjectScopedSnapshotLabel` and its five local label constants are removed. Nothing else in the shell used them.
- **The `:name:` fallback is removed,** because it can no longer match anything new. A label of the form `[project-id:<id>:name:…]` already gives `<id>` through the shared parser, since `:name:` is its first separator. The fallback only added matches when the id itself contains `:name:` or `:source:`, and UUID project ids never do. The control plane checked this reasoning against the removed code.
- **The 4 hand-built labels** now follow the shared result. Their `historyListProjectId` fields are removed from the examples.

| Label | History list before | Now |
|---|---|---|
| `[project-id:project-1:hint:x]` | `project-1` | `project-1:hint:x` |
| `[project-id:project-1:source:ai:name:Draft]` | `project-1` | `project-1:source:ai` |
| `[project-id:project-1:source:ai:hint:x:name:y]` | `project-1` | `project-1:source:ai:hint:x` |
| `[project-id:project-1:hint:x:source:ai]` | `project-1` | `project-1:hint:x` |

No writer produces these labels, so nothing the app writes changes place.

**Tests:** the history-list block in `workspace-shell.test.tsx` now calls `computeProjectHistoryRows` for every example:
- one row under the expected project;
- no row under another project, or when there is no id;
- every writer label is listed under its own project.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | same tree after the fast-forward |
| frontend `npm test` | 1788 of 1788 passed | same tree |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| api-gateway `src/projects` and the internal workspace files spec (they read the examples) | 5 suites, 132 passed | same tree |
| line endings | the 3 files are LF | — |

## Limits

- **Not deployed.** It has no effect on labels any writer produces. It goes out with STAGING-DEPLOY-I18N-02.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, fast-forwarded by the control plane), UI 9/9 (1 to 3: no text, message-file or icon change; 4 and 5: logic only, no visual change; 6: no state change; 7: no redesign; 8: test ids kept; 9: covered by tests)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-I18N-02) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY and FRONTEND released UNOWNED;
- not deployed.
