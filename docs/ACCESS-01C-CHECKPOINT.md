# ACCESS-01C — Checkpoint

**Task:** ACCESS-01C — Signed Agent tool profile; the write flag becomes a kill switch
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** COMMERCIAL. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** slice S3 of docs/ACCESS-READY-01-PLAN.md. Keith approved the scope and admitted it on 2026-11-05, approved the stage-start with his three decisions, and allowed four test-fixture edits.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered by GOV-ACCESS-PLAN-01; admitted to Lane 1 with GATEWAY and AI-SERVICE, mutating HARNESS_ENTITLEMENT_PROOF_V1 | 1604ace (registration); 771eea4ac0141c04e2b14011acb731ec0af94c9d (admission) |
| 2. Stage-start | docs/ACCESS-01C-STAGE-START.md: Fable 5.1 draft (requested claude-fable-5-1-thinking-high, resolved Claude Fable 5.1 300K High, read-only), control-plane review, Keith's decisions and the fixture clarification | def3c4606a64115eb9c8438835fd362677a50eec |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 5dea5a2e-fe02-4db2-8300-309354c1eae4: the first run stopped before code changes because four Agent-mode fixtures sat inside the collaboration describe the stage-start called unmodified; the second run (after Keith's clarification) implemented | this commit |
| 4. LOCK | this checkpoint, board, backlog and sidecar, canonical validator; HARNESS_ENTITLEMENT_PROOF_V1 stays FROZEN with the new semantics | this commit (LOCAL-TESTS) |

## What changed

- Contract HARNESS_ENTITLEMENT_PROOF_V1: no wire-format change (the payload digest already covered every job key except the proof). Semantics: AiExecutionJob.harnessToolProfile gains agent-write and is required on every v1 job.
- Gateway: EntitlementService.resolveAgentWriteEnabled (no row, false row or error is false; warn with user id only). AIExecutionController takes it optionally; for harnessVersion v1, after the signing secret is captured and before the ledger write, the profile is agent-write when that read is true, otherwise read, and it is added to the payload that is signed. Body-supplied profile fields are not copied.
- Worker: a v1 job without a profile is stored as harness_tool_profile_missing ("No tool profile was signed for this run, so it was stopped.") with no provider call; agent-write gets the former Agent tool set (write_file, delete_file, run_validation and browser_smoke behind their flags, file actions kept) only when AGENT_HARNESS_ENABLE_WRITE_TOOLS is on, otherwise harness_write_tools_disabled; read gets read tools only; a changed profile fails the existing payload-integrity check. Collaboration read, review and write branches are unchanged.
- Tests: gateway profile choice, ignored body fields, proof recompute and a flipped profile, module wiring; resolveAgentWriteEnabled outcomes; worker outcomes for each profile and the flag. Inside the COLLAB-FILES-01 describe exactly the four cases Keith allowed changed (verified by comparing each test body); the collaboration-profile cases are byte-identical. Five other v1 fixtures gained agent-write before signing, and two harness describes turn the write flag on in beforeEach because agent-write with the flag off is now a refusal.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 45 suites, 1098 passed, 1 skipped, 0 failed (baseline 1089 passed) |
| ai-service `npm run build` | exit 0 |
| api-gateway `npm test` | 2735 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline) |
| api-gateway `npm run build` | exit 0 |
| Diff review | only files in the admitted write scope changed; services/ai-service/src/agent-harness/config/ unchanged |

Cursor's own gateway runs lost Jest workers to out-of-memory errors (three suites did not run in its full run); the reviewer run above completed without worker failures.

Evidence in `C:/Users/knlee/aisb-preflight/ACCESS-01C/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-ac-stage.txt` | 4305 | `dbb2edecdec7d8789f106a83be2e3b126bf407acd0ac2fbdb7e4cb583d100aff` |
| `brief-ac.txt` | 5042 | `1f4fa8026af63b15bbcc87ac405f173c55e6dce86721f3b9eb50e22aa765025a` |
| `brief-ac-delta.txt` | 3450 | `9c9c3c514bffdb2b3bee9a4b0362f349b3223549efa024a3e5fd702b55fb9e62` |
| `fable-stage-draft.md` | 17490 | `299ecbf08384a81a3bd5e233b26f67f57d530f0863cfeba6ac5fb259ea6f20c4` |
| `fable-result.json` | 19029 | `dc1d56eb393421bde319076fc9ea3182c39be0ee56aef7fe871f811b86951e15` |
| `cursor-result-1.json` | 4596 | `d7ee9e669e9450a9167fb3aa869167307099d5dd345fe91e38dc12e9f0f59a37` |
| `cursor-result-2.json` | 10685 | `4ffc5120805d5dabf42b84133bd3b8f1595a280e9631e5f67658caf12233f579` |
| `reviewer-gates.out` | 444 | `069fc21b88beaf06e38aab5b3d2eef15a87a7c0f1100af1eb9c052645fc03c75` |

## Acceptance criteria

All eight met by diff review and the reviewer run ("signed profile is write" read as the Agent write profile agent-write, per Keith's decision 1). Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed. Gateway and AI service must deploy together with a drained queue; a queued Agent job from before the deploy is refused with harness_tool_profile_missing.
- After the deploy Agent mode is read-only for everyone until Keith sets agentWriteEnabled true on his row, and Agent writes on staging also need AGENT_HARNESS_ENABLE_WRITE_TOOLS on, which happens only in live windows (the staging baseline is false). The next staging deploy carries the row step in its checklist.
- No user-visible notice yet that file changes are off (AGENT-WRITE-UI-01).

FOLLOWUPS: 2 registered / 2 superseded / 1 dropped / 0 undisposed (registered AGENT-WRITE-UI-01 and HARNESS-WRITE-VETO-01, NOT_READY; superseded: Keith's row step by the next staging deploy's checklist, KNOW-02's contract change by its own protocol; dropped by Keith: the "writer step" wording in HARNESS_WRITE_TOOLS_DISABLED_MESSAGE)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY and AI-SERVICE released UNOWNED; HARNESS_ENTITLEMENT_PROOF_V1 re-frozen.
