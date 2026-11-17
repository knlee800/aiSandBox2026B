# COS-EVAL-TIDY-01 — Checkpoint

**Task:** COS-EVAL-TIDY-01 — Bring the briefing eval fixtures and live runner up to date
**Status:** COMPLETE AND LOCKED — 2026-11-17. Built; ai-service eval code only (deploys with the next staging deploy before COS-EVAL-LIVE-03).
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** AI-SERVICE.
**Source:** registered 2026-11-17 by the COS-MAIL-BODY-RULE-01 LOCK (worker F1 to F3). Keith chose it on 2026-11-17 ("Start it").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with AI-SERVICE; write set `services/ai-service/src/agent-harness/eval/` (not `baselines/`) | 19ef58a |
| 2. Implementation | sonnet subagent (Sonnet 5.5: fixtures and tests in one service, no security change) in worktree lane/COS-EVAL-TIDY-01; fast-forwarded | faabd73 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## What changed

1. **Mail fixtures match the real mail tool.**
   - Every loaded message now has `id, from, toCount, subject, date, bodyText, bodyTruncated`, in the order of connectors-mcp `UnreadMessage`.
   - `bodyText` defaults to "" and `bodyTruncated` to false.
   - `bodyTruncated` is an optional boolean in a fixture; anything else is refused.
   - `bodyText` is no longer limited to `bodyCase: "CONN-03"` cases, which keep that field as a label.
   - The real wrapper `wrapConnectorResult` runs `JSON.stringify` over the result, so the loader's key order is what the model sees.
   - No case JSON changed.
2. **Live cap comment.** It now covers twelve cases. The cap stays at 150,000 tokens: COS-EVAL-LIVE-02 used 57,417 for nine cases.
3. **Live report line.** It prints `taskTextLeaks=<count>` per case and in the totals, with no marker text. The totals type, the results file and the baselines are unchanged.

**Tests:**
- all twelve cases send the real mail shape, with the key order checked;
- defaults and pass-through;
- a non-boolean `bodyTruncated` and a non-string `bodyText` are refused;
- the report line prints the leak count without the leak text.

## Control-plane review and gates (rerun on the branch)

**What the control plane read:**
- the loader and type diff;
- the report line;
- the cap comment;
- `wrapConnectorResult`, to confirm the key order reaches the model;
- the committed blobs, which have no CR.

| Gate | Result |
|---|---|
| ai-service `tsc --noEmit` | rc 0 |
| ai-service tests | 68 suites, 1426 passed, 1 skipped (baseline 1423; 3 new) |
| ai-service build | rc 0; no tracked artifact changed |

**Reported:**
- **The worker's boot was incomplete.** It did not read the task body in the backlog. It worked from the brief, which carried the full scope.
- **The worktree folder was left behind.** Its removal got "Permission denied" because the control plane's shell was inside the folder. The worktree registration and the branch are gone. The folder (13 entries, no junction) is for Keith to delete.
- **No permission was denied** to the worker.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Worker: a fixture `bodyText` of "" is refused by the shared string reader (only matters if a case needs an explicit empty body) | registered COS-EVAL-LABEL-01 |
| Worker: the `bodyCase: "CONN-03"` label could be retired, since `bodyText` is now a normal field | registered COS-EVAL-LABEL-01 |

CHECKLIST: EVERY 11/11 (1: admitted 19ef58a; 2: 3-step; 3: sonnet named with its reason before dispatch; 4: self-contained brief, no further subagents, boot shortfall reported above; 5: only the eval folder, not baselines/; 6: 3 new tests; 7: gates rerun by the control plane on the branch; 8: no runtime started; 9: nothing to restore; 10: worktree, junctions, fast-forward and branch removal by the control plane, folder left for Keith; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, key or guard change; 2: internal routes untouched; 3: no generated-app template; 4: HARNESS_ENTITLEMENT_PROOF_V1 untouched; 5: no entity or schema change; 6: compared with the baseline, no new failure)
FOLLOWUPS: 1 registered (COS-EVAL-LABEL-01, both worker notes) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-17 by the control plane:
- Lane 1 released EMPTY; AI-SERVICE released UNOWNED;
- nothing deployed: staging runs 2b30cd1. COS-EVAL-LIVE-03 needs a deploy of this ai-service eval code first, which goes into its window.
