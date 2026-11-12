# SNAPSHOT-LABEL-01 — Checkpoint

**Task:** SNAPSHOT-LABEL-01 — One project-label rule for snapshots in the frontend and the gateway
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the SNAPSHOT-PICK-01 LOCK. Admitted by the control plane on Keith's "Yes, keep going".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with GATEWAY and FRONTEND; a new JSON fixture plus the label writers and parsers and their tests | c1747cf |
| 1. Implementation | opus subagent (Opus 5.5: a rule shared across the gateway and the frontend) in worktree lane/SNAPSHOT-LABEL-01 as dfa9b4d; main had moved by one records commit, so the control plane cherry-picked it | 4202647 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

No behaviour change. The only source change is two `export` keywords, which let the tests call existing functions: `parseProjectIdFromSnapshotLabel` in `workspace-snapshots.logic.ts`, and `parseProjectIdFromProjectScopedSnapshotLabel` in `workspace-shell.tsx`.

**The shared examples:** `services/api-gateway/src/snapshots/snapshot-label-examples.json` (new) has two lists.
- **`parseCases`, 44 cases:**
  - plain labels;
  - all six sources, with and without a hint;
  - normalised and cut hints;
  - names that contain `:`, `]`, `:source:` or `:hint:`;
  - spacing and case;
  - the lookalike `project-B2`;
  - unknown and empty parts;
  - empty and malformed labels, and labels that are not labels at all.
- **`writerCases`, 20 cases:** every writer in the code:
  - the frontend builders for plain, source with hint, and name labels;
  - the gateway AI writer.

**Who reads it:**
- Gateway specs read it from disk:
  - the reopen helper runs every case;
  - every writer label parses back;
  - the controller's AI writer output is checked exactly.
- Frontend tests read the same file through a relative URL:
  - the logic parser checks id, name, source and hint;
  - each builder must produce its exact label, which must parse back;
  - the history-list parser runs every case.
- The JSON is not imported by build code and does not reach the gateway's `dist`.

**Findings, pinned and not changed:**
- The gateway reopen helper and the frontend logic parser agree on all 44 cases.
- **A third parser:** `parseProjectIdFromProjectScopedSnapshotLabel` in `workspace-shell.tsx` decides which versions appear in a project's history list. It cuts the id at the first of `:name:`, `:source:` or `:hint:`. The reference parser cuts at `:name:` if present, otherwise at `:source:`. The two disagree on 4 hand-built labels, such as `[project-id:project-1:source:ai:name:Draft]`. No writer produces those labels; only a hand-made label sent to the snapshot API could. They are pinned with a `historyListProjectId` field. Merging the parsers is registered as SNAPSHOT-LABEL-02.
- **Other edge cases, pinned as they are:**
  - an unknown source still returns its hint;
  - a builder given an unknown source writes the plain label;
  - a `]` inside a hint parses as a space.

## Gates

| Gate | Branch (control-plane rerun) | main after the cherry-pick |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 3865 passed (3814 + 51), 7 skipped, plus the 14 known `smoke.integration` failures (1 suite) | `src/projects` and the internal workspace files spec: 5 suites, 132 passed |
| api-gateway `npm run build` | exit 0; no JSON in `dist` | — |
| frontend `npx tsc --noEmit` | exit 0 | — |
| frontend `npm test` | 1783 of 1783 passed (1675 + 108) | 1783 of 1783 passed |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored | — |
| line endings | the 7 files are LF | 7 of 7 LF |

## Limits

- **Not deployed.** It has no behaviour change. It goes out with the next deploy, STAGING-DEPLOY-SNAP-05.
- **The history-list parser** stays separate. SNAPSHOT-LABEL-02 decides whether to replace it with the shared parser, which would change which history list shows the 4 hand-built labels. That task also covers its `:name:` fallback in `computeProjectHistoryRows`, which the worker found unreachable for UUID project ids.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: only the write set, two exports; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false), BACKEND 6/6 (1 to 5: no auth, guard, internal endpoint, template, contract or schema change; 6: only the 14 known smoke failures)
FOLLOWUPS: 1 registered (SNAPSHOT-LABEL-02) / 1 superseded (the unreachable `:name:` fallback in computeProjectHistoryRows, into SNAPSHOT-LABEL-02) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY and FRONTEND released UNOWNED;
- not deployed.
