# HARNESS-FIXES-01C — Checkpoint

**Task:** HARNESS-FIXES-01C — Frontend harness fixes: the test script (the keyless provider moved to PROVIDER-KEY-01)
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by the HARNESS-FIXES-01 split. Keith admitted it on 2026-11-10 ("yes") and narrowed it to item 1 the same day ("Yes, both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with FRONTEND, I18N and PACKAGE | 3c4d1f3 |
| — Narrowing | Item 2 moved to PROVIDER-KEY-01; I18N released | b8402a0 |
| 2. Implementation | sonnet subagent in worktree lane/HARNESS-FIXES-01C (a50bf87), cherry-picked onto main | bc80a91 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

One line in `frontend/package.json`. The `test` script keeps its four globs and adds four more:
- `lib/ai/*.test.ts`
- `components/office/*.test.ts*`
- `lib/office/*.test.ts`
- `hooks/*.test.ts*`

That brings six test files that existed but never ran into the suite:
- `provider-model.catalogue.test.ts`
- `office-screen.test.tsx`
- `office.logic.test.ts`
- `useBillingData.test.ts`
- `useCreditBalance.test.ts`
- `useUserAgents.test.ts`

## Item 2, stopped by the worker

The worker stopped on item 2 (the keyless provider after a reload) and changed nothing. The control plane checked its findings in the code:
- `frontend/lib/ai/provider-model.catalogue.ts` marks every provider selectable, and nothing tells the frontend which providers have a key.
- The selection is not stored. Every load starts at `FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION`.
- A missing key throws plain text in `ai-execution.service.ts`.
- `looksLikeCredential` in `worker.processor.ts` turns any text containing "key" into the generic failure.

So item 2 needs backend work. Keith moved it to PROVIDER-KEY-01.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1041 tests, 1041 pass, 0 fail (136 from the newly included files; 900 at AGENT-WRITE-UI-01 under the old script) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

After the cherry-pick:
- the frontend tree on main is identical to the branch;
- `frontend/package.json` is LF.

## Limits

No behavior change and no live check needed. The keyless-provider item is not fixed here: it is PROVIDER-KEY-01, NOT_READY until CONN-03 and this task are LOCKED and its stage-start is approved.

CHECKLIST: EVERY 11/11. 3: sonnet, passed explicitly. 6: met; the change is the test script itself, and the newly run tests are what it adds. 9: tsbuildinfo restored. 10: worker committed only on its branch; the control plane cherry-picked it.
UI: n/a, no visible UI change.

FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed (item 2 superseded by PROVIDER-KEY-01, registered at b8402a0)

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; FRONTEND and PACKAGE released UNOWNED. CONN-03 stays ACTIVE in Lane 1.
