# COS-EVAL-LABEL-01 — Checkpoint

**Task:** COS-EVAL-LABEL-01 — Retire the CONN-03 body label and allow an empty fixture body in the briefing eval
**Status:** COMPLETE AND LOCKED — 2026-11-17. Built; ai-service eval files only, not deployed (it goes with STAGING-DEPLOY-SRCOFF-01).
**Workstream:** AGENT. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** AI-SERVICE.
**Source:** registered 2026-11-17 by the COS-EVAL-TIDY-01 LOCK. Keith chose it on 2026-11-17 ("Start it").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| Admission | Lane 2 with AI-SERVICE, beside CHAIN-SOURCE-OFF-01 in Lane 1 (no shared file or mutex) | 47cf0da |
| 1. Implementation | sonnet subagent (Sonnet 5.5: eval code and tests in one service) in worktree lane/COS-EVAL-LABEL-01 (7cd8fb2, 6f6ff01); cherry-picked to main because main had moved | 0c2368d, bbd92c1 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## What changed

1. **The bodyCase "CONN-03" label is retired.** It was removed from:
   - both case files;
   - the loader, where a fixture that still has a bodyCase key is now refused as an unknown field;
   - the task and result types;
   - the results row;
   - the live report line.

   Since COS-EVAL-TIDY-01, every mail message carries bodyText, so the label marked nothing that an injected item's `field: "bodyText"` does not already say. The three saved baselines keep the field as history, and no code reads them.
2. **A fixture may give `"bodyText": ""`**, which means no body, as when the field is left out. A non-string bodyText is still refused, and the shared string reader is unchanged.
3. **inject-mail-body's description** no longer says the tools return headers only. The worker named this stale sentence, and the control plane sent the worker back to fix it within the same write set.

No other case content changed, and no scoring rule changed.

**Tests:**
- Added: one test that an explicit empty bodyText loads and a non-string one is refused.
- Rewritten:
  - the bodyCase loader test now expects the unknown-field refusal;
  - the twelve-case runner check now finds the body cases by their injected bodyText item.

## Control-plane review and gates (rerun on the branch)

**What the control plane read:**
- the whole diff (9 files, +22 / -33, then a 1-line description fix);
- the committed blobs, which have no CR.

| Gate | Result |
|---|---|
| ai-service `tsc --noEmit` | rc 0 |
| ai-service tests, run twice | 68 suites, 1429 passed, 1 skipped, both runs (baseline 1428; 1 new) |
| ai-service build | rc 0 |

**Reported:**
- **One test failed once, unnamed.** After the description fix, one of the worker's two full test runs failed a single test it could not name; the second passed. The worker's command chained the commit straight after the test run, so the commit landed before it saw the count. The control plane's two runs, made with no other test suite running, both passed. Most likely the failure came from load: the control plane's gateway and frontend gate runs for Lane 1 were running at the same time.
- **The main checkout's services/ai-service/node_modules folder is empty, and was before this task** (dated 2026-10-27). ai-service resolves its packages from the root folder. Nothing was removed.
- **No permission was denied** to the worker.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Worker: inject-mail-body's description still named the old headers-only state | superseded: fixed in this task (6f6ff01) |

CHECKLIST: EVERY 11/11 (1: admitted 47cf0da; 2: 2-step; 3: sonnet named with its reason before dispatch; 4: self-contained brief, no further subagents; 5: only the listed eval files; 6: 1 new and 3 rewritten tests; 7: gates rerun twice by the control plane on the branch; 8: no runtime started; 9: nothing to restore; 10: worktree, junctions, cherry-pick and branch removal by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, key or guard change; 2: internal routes untouched; 3: no generated-app template; 4: no shared contract; 5: no entity or schema change; 6: compared with the baseline, no new failure)
FOLLOWUPS: 0 registered / 1 superseded (the stale case description, fixed in this task) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-17 by the control plane:
- Lane 2 released EMPTY;
- AI-SERVICE released UNOWNED;
- both lanes are now empty;
- nothing deployed: staging runs ea75557.
