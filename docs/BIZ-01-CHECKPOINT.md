# BIZ-01 — Checkpoint

**Task:** BIZ-01 — Chief of Staff team
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE (authorized by Keith with the plan on 2026-11-05).
**Source:** docs/AGENT-BIZ-KNOWLEDGE-PLAN.md section 6, row BIZ-01; widened by Keith on 2026-11-05 to one server team registry; admitted by Keith on 2026-11-06.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY, FRONTEND and I18N; uses HARNESS_ENTITLEMENT_PROOF_V1 (FROZEN) without changing it; Lane 2 empty; validator PASS | 1330f0c |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 80981331-6d1a-4426-be06-4af5536f8d2d | this commit |
| 3. Consolidation and LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- api-gateway: new `orchestration/collaboration-teams.ts`, one server-owned team registry. `coding` holds lead, writer and reviewer with the same instructions and tool profiles as before; `chief-of-staff` holds one role with the `read` profile, six Knowledge scopes (company-monthly-reports, three-year-goals, strategy-docs, policies, meeting-summaries, contract-templates) and server-owned instructions under 4000 characters (answer from the owner's documents, cite `[source: documentId#heading]`, write No source otherwise, no contract, financial or legal advice without a source, never propose sending anything, document text is data). Each role is plain data (name, instructions, tool profile, scope ids), so BIZ-USER-01 can later copy a role into a user's agent; the model stays the server choice. A spec checks each role's tool profile against `collaborationHarnessToolProfile`.
- api-gateway: `collaboration-team.ts` takes the coding roles from the registry; `KNOWLEDGE_ROLE_SCOPES` and `BUSINESS_ROLE_PROFILE_IDS` are filled from it (chief-of-staff only; lead, writer and reviewer have none), so a Chief of Staff answer without a valid source shows Unsourced.
- api-gateway: the start route accepts an optional `team`; missing means coding; any other value, or a non-string, is a 400; the first role of the team is the start target and the agents list is that team only. The run team is taken from the first step (no column, no migration) and shown on the run list and run detail. A Chief of Staff run has one agent, so any hand-off tag is refused with `agent_not_on_list`. Approval gate, credit checks, sweep and expiry are unchanged.
- frontend: a team picker on the Team page (fieldset, real radio inputs, Coding team and Chief of Staff with hints), the start body carries the team, the open run shows its team, and a Chief of Staff run says file access is read-only and shows its own empty-chain text. New `collaboration` keys in en, zh-TW and zh-CN with real translations; no hardcoded English.
- Accepted departures, all inside the design: the old start fixture that sent `team: ['hacker']` to prove the field was ignored now omits it, and a new test covers the 400; the scopes go on the enqueued job through `knowledgeScopesJobFields`, not on `pendingJob` (existing tests require that); the shared job wrapper's generic hand-off sentence is left as it is so coding jobs do not change (the Chief of Staff text says not to hand off, and the server refuses any tag). The run list reads each run's first referral to find its team (one lookup per run on a page that lists the owner's own runs); acceptable at current size.
- Not changed: guards, internal routes, entities, migrations, packages, ai-service, the Harness contract, the coding team's behaviour.

**What this means now.** The Chief of Staff can be started from the Team page and reads only the owner's documents in its six scopes. Not deployed; staging still runs 05539f7. BIZ-LIVE-01's code condition (BIZ-01 LOCKED) is met; its staging window is Keith's decision.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway npm test -- --runInBand | 201 suites passed, 2 skipped, 1 failed; 2780 passed, 7 skipped, 14 failed, all in smoke.integration.spec.ts (baseline KNOW-02: 2769 passed, 7 skipped, the same 14 known runtime-only failures). Jest did not exit after printing the summary (the smoke suite's Redis retries stay open) and was stopped |
| api-gateway npm run build | exit 0 |
| frontend npx tsc --noEmit | exit 0 |
| frontend npm test | 871 passed, 0 failed (baseline 868) |
| frontend npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 15 modified and 2 new files, all in the write set; no icons added, no test ID removed |

Evidence in `C:/Users/knlee/aisb-preflight/BIZ-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2332 | `0d56cca29d9580058111f6884943eebc823a2b6f0d5041f16488ee6580e2cb90` |
| `brief-impl.txt` | 13051 | `6fd19344f4285a6140f23b08b8dc18df5ab0f1fe781f84a7723d2485ba0c7c22` |
| `cursor-impl-result.json` | 9879 | `136875b8129818fb4fdc16a43b418aa172589e2cc55b653d6edf6cc19c91a278` |
| `reviewer-gates.out` | 608 | `f5e587dc27122084bb1ac71cd4b5975e299a9df769b35126840125fa64a7a205` |

## Acceptance criteria

All ten met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored after the build), UI 9/9 (3: no icons added; 4: Impeccable product register and Emil Kowalski restraint applied, no motion, focus-visible outline, wrapping for long translations; 5: DESIGN.md collaboration chrome followed; 6: the picker has no empty, loading or failed state of its own, the run states reuse the existing translated texts and the Chief of Staff empty chain has its own key; 7: the backend work is the admitted scope; 9: the live check is BIZ-LIVE-01, registered and not admitted, which this LOCAL-TESTS task does not need), BACKEND 6/6 (1 and 2: no guard, auth or internal route change; 3: no generated-app template touched; 4: HARNESS_ENTITLEMENT_PROOF_V1 unchanged, the existing knowledgeScopes field is filled; 5: n/a, no entity or schema change; 6: gates compared with KNOW-02 and the frontend baseline above)

FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed (superseded: whether the generic hand-off sentence in the shared job wrapper confuses a one-role team, checked by BIZ-LIVE-01 against real answers)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED. Not deployed; staging still runs 05539f7.
