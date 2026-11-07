# COLLAB-START-ONCE-01 — Checkpoint

**Task:** COLLAB-START-ONCE-01 — Start a Team-page run once per click
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md.
**Source:** Keith's finding during BIZ-LIVE-02 (two extra advisors runs started at 10:09:03 and 10:09:18 UTC by repeated Start clicks); registered by BIZ-LIVE-02; Keith approved the scope and admitted it on 2026-11-07.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | by BIZ-LIVE-02 | 3af4aed7eb9ce6fe6850fdb43561a6dd6303e015 |
| Admission | Lane 1 with FRONTEND; validator PASS | 1a647e940f0bfd7a46208a91ff9f162d100119a2 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- frontend/components/collaboration/collaboration-page.tsx: onStart returns at once while a start ref is set; the ref is set before the request and cleared in a finally after success, refusal or a thrown error. After a successful start (the run selected) the task box is cleared, so Start stays disabled until a new task is typed; a refused or failed start keeps the text for a retry. The existing single-flight check in runDecision is unchanged.
- frontend/lib/collaboration.test.ts: four tests: two onStart calls in the same tick send one POST /api/collaboration/runs; a successful start clears the task, disables the rendered Start button and keeps the advisors team selected; a refused start keeps the task and a later onStart sends again; a thrown start releases the guard, shows the generic notice and keeps the task.
- Not changed: collaboration-view.tsx, logic.ts, api.ts, the message files, the gateway and every service. No new visible text; existing data-testids kept.

**Root cause.** The page already dropped a second decision in the same turn (runDecision's single-flight ref). What let Keith start three runs was the task text staying in the box: once a start finished, Start was enabled again and each later click started another run.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend npm test | 880 passed, 0 failed (baseline BIZ-03: 876; the four new tests) |
| npx tsx --test lib/collaboration.test.ts | 25 passed, 0 failed |
| npx tsc --noEmit | exit 0 |
| npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 2 files changed (197 lines added, 45 removed), both in the write set |

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-START-ONCE-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2390 | `c44783f34084933e07406a30dae181959b6b5041d300193eb5fef24282a4ef6c` |
| `brief-impl.txt` | 8689 | `71785d8f010fbdad37c1ca197de4a9cb6fde02d16f4b1d1182b54b90bb23f305` |
| `cursor-admission-result.json` | 3418 | `b7dcad6bff498bd59e93c7bffdd18f6ab78283bfc14346074268b257b94e7c57` |
| `cursor-impl-result.json` | 4747 | `69ab97ce21ec7f4af94eb4b913aa9af361a4ff1b6d7a47b5430dbdeb128e3fb9` |

## Acceptance criteria

All six met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started), UI 9/9 (1 and 2: n/a, no new or changed visible text and no message-file edit, so no I18N lease; 3: n/a, no icon; 4: the worker read Impeccable and Emil Kowalski, no visual change, Emil's press animation not added because Start is a frequent control and the disabled state is the feedback; 5: DESIGN.md read, no visual change; 6: success, refused and failed starts are covered by tests, loading is the existing Starting label; 7: no redesign, routing, backend or dependency; 8: test IDs kept; 9: the in-flight and cleared-box behaviour is proven by rendered-markup tests; the staging check follows the deploy)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: STAGING-DEPLOY-16, the deploy, OPTIONAL as the control-plane default)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; FRONTEND released UNOWNED. Not deployed; staging runs 8a723bf.
