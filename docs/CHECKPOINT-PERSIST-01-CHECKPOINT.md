# CHECKPOINT-PERSIST-01 — Checkpoint

**Task:** CHECKPOINT-PERSIST-01 — Keep the newest workspace state in the project copy after a revert or a skipped autosave
**Status:** COMPLETE AND LOCKED — 2026-10-27
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** FORCING.
**Source:** the CLEAN-BASELINE-DEPLOY-01 C1 check 9 failure (repository commit 136bf6da5a6fd3503ed56e255e7d75aa21f56ebf).

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Keith approved the task and scope on 2026-10-27; admitted to Lane 1 with FRONTEND and I18N | 7f76134f57eb34b53f223af661501dab41d75ca0, c6b8c547cf68439aeee923bc53a7c13ede482871 |
| 2. Implementation | Cursor CLI (cursor-delegate), grok-4.7-xhigh, session e09644aa-1a0e-4c64-83ad-264cee0b924c, two runs | 8897d6f9c25cd00d00f7f1ad1f95695dfb8ec076 |
| 3. Consolidation and LOCK | Part 1: Step 2 result | 85f932423fae0b4d644d3183b8e0344394b397df |
| 3. Consolidation and LOCK | Part 2: this checkpoint, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

Implementation commit 8897d6f changes exactly the eight files of the write scope (346 lines added, 16 removed):

| File | Added | Removed |
|---|---|---|
| `frontend/app/[locale]/app/page.tsx` | 127 | 11 |
| `frontend/lib/project-autosave.ts` | 60 | 0 |
| `frontend/lib/project-autosave.test.ts` | 134 | 1 |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | 4 | 1 |
| `frontend/components/workspace/workspace-snapshots.logic.test.ts` | 12 | 0 |
| `frontend/messages/en.json` | 3 | 1 |
| `frontend/messages/zh-TW.json` | 3 | 1 |
| `frontend/messages/zh-CN.json` | 3 | 1 |

- After a successful checkpoint revert, the page saves a project autosave snapshot with the new source `revert` and `minIntervalMs: 0`, so the 60-second limit cannot drop it. On success it records the autosave time, reloads the project versions and cancels any pending trailing save. On failure the revert stays reverted, any older project message is cleared, and the History & Controls project-action slot shows `recovery.workspace.revertNotSavedToProject`.
- A file-save, preview or AI autosave skipped by the 60-second limit schedules one trailing autosave (`createTrailingAutosaveScheduler`) for the rest of the interval plus `TRAILING_AUTOSAVE_MARGIN_MS` (1000 ms). It saves only if the session, the project and the project-open state still match. A newer skip replaces it; a session or project change, or unmount, cancels it. The expiry autosave is unchanged.
- `recovery.workspace.automaticVersionLabels.revert` (Checkpoint restored) and `recovery.workspace.revertNotSavedToProject` exist in en, zh-TW and zh-CN.

Not changed: backend and container-manager code, the checkpoint and revert APIs, the snapshot format, the rate-limit value, `workspace-shell.tsx`, `lib/recovery-copy.ts`, `lib/autosave-rate-limit.ts`, packages.

## Validation on the committed tree

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npm test` | 781 tests, 781 pass, 0 fail (776 before, 5 new) |
| `npm run build` | exit 0 |
| Write scope | only the eight files; `frontend/tsconfig.tsbuildinfo` restored before the commit |
| Message values | the six new strings match exactly in en, zh-TW and zh-CN |

The reviewer ran the gates independently after Cursor. A first reviewer typecheck that ran at the same time as the build failed only with TS6053 for `.next/types` files the build was regenerating; run alone it passes.

Evidence copied to `C:\Users\knlee\aisb-preflight\CHECKPOINT-PERSIST-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-tsc.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reviewer-npm-test.txt` | 168392 | `6b90da43d0ee38f1d9868ac55e0a507774b941eb9c22a51be4faecd88e86076d` |
| `reviewer-npm-build.txt` | 2855 | `a3366868dee8bfe7650744d2dbb607f6d4d4b777aafdb5def2369b9cefe23730` |
| `cursor-brief.txt` | 7527 | `0f71e418c62e3bc03c535a39170a0711633874a1081bc57b61d02a00f8acbcf0` |
| `cursor-followup-brief.txt` | 1599 | `cc1304829c711921775924b8bc23cf6c69d8e4eb00b2662596f22d603353e38e` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| A successful revert saves exactly one `revert` snapshot, even within 60 seconds of the previous autosave | met (code path and the `minIntervalMs: 0` test) |
| A skipped autosave is followed by exactly one trailing autosave after the interval; a newer request replaces it; a session or project change cancels it | met (scheduler tests and page wiring) |
| The `revert` label and the failure warning exist in all three locales and are used | met |
| Other autosave sources, checkpoint creation, the revert flow and the label format otherwise unchanged | met (diff review; 776 existing tests pass) |
| New tests cover the post-revert save, the bypass and the trailing save | met (5 new tests) |
| tsc, npm test and npm run build pass | met |
| Only the write-scope files change | met |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- Browser behaviour is not verified here. As registered, the staging proof is the CLEAN-BASELINE-DEPLOY-01 C1 repeat, after CHECKPOINT-PERSIST-02 is LOCKED.
- Outside the scope, not changed: `page.tsx` keeps a leftover debug fetch to `http://127.0.0.1:7870/ingest/` in the save-point error path of `handleCreateManualCheckpoint`; it needs its own registered task.
- A trailing save whose request has already started keeps running if the session or project changes during it. This is harmless: it saves the session and project it was scheduled for.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-27 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED; GOVERNANCE UNOWNED. CHECKPOINT-PERSIST-02 now has its dependency satisfied and stays NOT_READY until its Step 2 stage-start. CLEAN-BASELINE-DEPLOY-01 stays READY and not admitted.
