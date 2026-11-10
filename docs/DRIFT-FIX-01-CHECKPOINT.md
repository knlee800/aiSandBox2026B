# DRIFT-FIX-01 — Checkpoint

**Task:** DRIFT-FIX-01 — Briefing drift check follows the shared version hash
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the CM-AUTH-01 LOCK (7615c7b). It fixes a control-plane miss: the BIZ-USER-01C lock (ccc25ab) did not rerun ai-service, whose drift spec reads gateway source. Admitted 2026-11-10 (5c081a3) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with AI-SERVICE | 5c081a3 |
| 2. Implementation | sonnet subagent in worktree lane/DRIFT-FIX-01 (cc2b745), cherry-picked onto main | ed676f0 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (1 file)

- **The failure.** `briefing-drift.spec.ts` checked a pin, "the hash material the copy uses matches the gateway draft for chief-of-staff", that looked for the old block in the gateway registry: `scopes: draft.knowledgeScopes.map(...)`, `[...draft.connectorToolIds]`, `modelMaterial(draft.model)`. BIZ-USER-01C moved that code into `agentVersionFor` / `agentVersionPayload`.
- **The fix.** The old pin is replaced by two:
  1. the `versionFor(draft, instructions)` call to `agentVersionFor({...})`, with its key order and the pass-through of `knowledgeScopes` and `model`;
  2. the `agentVersionPayload` body, with the payload key order, the `{id, type}` scope projection, the connector-id copy, `modelMaterial`, and the teamRole projection with its null branch.
- **Unchanged.**
  - The eval copy `briefing-instructions.ts`: it already builds the same JSON, and the Chief of Staff instructions text stays the same.
  - The pinned hash, `7daa2a2e96304a0541abccd8d9197f8ff65a7618217de9dd88eb4b4915ebbfc3`.
  - The test that "the copy hashes to the version the gateway spec pins", which still proves the actual value.
- **Strength.** The check is at least as strong as before: it covers the same block plus the call-site pass-through and the null branch.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| ai-service `npx jest --runInBand` | 66 suites, 1310 passed, 1 skipped, **0 failed** (main had 1 failing since BIZ-USER-01C) |
| ai-service `npm run build` | exit 0 |

After the cherry-pick:
- the ai-service files on main are identical to the branch;
- the changed file is LF.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 6: the change is to a test; 9: no artifacts)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed. The lesson is recorded in the control plane's tooling notes: a lock that changes gateway system-agents or orchestration code also reruns the ai-service suite.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; AI-SERVICE released UNOWNED. STAGING-DEPLOY-CMAUTH-01 is next and waits for Keith's go-ahead.
