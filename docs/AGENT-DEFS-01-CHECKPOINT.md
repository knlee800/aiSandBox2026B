# AGENT-DEFS-01 — Checkpoint

**Task:** AGENT-DEFS-01 — One server-side source for system agent definitions (RSI-00 stage S2)
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md (no user-visible product change).
**Source:** RSI-00 stage S2 (ARCHITECTURE.md section 13.5: one server-side agent definition source); Keith chose it and approved the draft on 2026-11-07.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with GATEWAY, FRONTEND and I18N; validator PASS | 9fae8988e56b586ae183c655a835426eb9f49f33 |
| 2. Stage-start | Cursor CLI read-only, requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 0511f56a-1cd5-4b8d-85f4-ab391c86cf08; control-plane review (one correction: DESIGN.md applies); Keith's three decisions; write set narrowed; six follow-ups dropped; validator PASS | c8c8f4466df4756f0bcd57500f6373b27b9240a8 |
| 3. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 34be3ab2-f446-4736-a514-d722c87a2af7 | this commit |
| 4. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- Gateway: new services/api-gateway/src/system-agents/: a pure registry of seven definitions (builder, lead, writer, reviewer, chief-of-staff, product-strategy, technology-advisor) with name keys, status, enabled, knowledge scopes, instructions, tool profile, modelChoice server and team role; systemAgentVersion(id) is SHA-256 over id, instructions, toolProfile, scopes, modelChoice and teamRole; GET /api/system-agents behind SessionCookieGuard only returns the four public stations (id, name keys, status, enabled, scopes, version) with Cache-Control private, no-store, and never instructions, tool profiles or team roles; SystemAgentsModule registered in app.module.ts.
- Gateway: collaboration-teams.ts builds the coding and chief-of-staff teams from the registry with every export and behaviour kept; collaborationHarnessToolProfile reads the registry with read as the default (user and unknown ids still read); KNOWLEDGE_ROLE_SCOPES and BUSINESS_ROLE_PROFILE_IDS unchanged; the KNOWLEDGE_SCOPES literal unchanged (comment only) and its spec now compares it to the registry instead of parsing the frontend file. collaboration.controller.ts, collaboration-team.ts, collaboration-citations.ts, the user-agent routes, guards and ai-service were not edited; HARNESS_ENTITLEMENT_PROOF_V1 unchanged.
- Frontend: agent-registry.ts keeps types, parseSystemAgents and a Builder-only fallback and no longer holds the definitions; new use-system-agents.ts hook; the dashboard and office load the list with a loading state, a login redirect on 401 and, on any other failure, an error with Retry and the Builder station only (Keith's decision 1); attributeDeskId takes the registry ids as an argument; new keys platform.systemAgentsLoading, platform.systemAgentsLoadError and office.systemAgentsLoadError in en, zh-TW and zh-CN.
- Version hashes (pinned by the registry spec): builder 63e02088..., lead 6cb7336c..., writer a41b3b8d..., reviewer d3a33416..., chief-of-staff 75d406a8..., product-strategy d6332d3d..., technology-advisor 7e3615cc....
- Accepted departures: the station card component is outside the write set and cannot be mounted in the test runner, so the dashboard tests check the four stations through staticAgentProfileContent and the card props in source; the office knowledge badge effect now depends on the loaded Chief of Staff scopes.

**Deploy note.** Deploy the gateway before the frontend (STAGING-DEPLOY-14); a new frontend against an old gateway shows the Builder-only fallback until the gateway serves the route.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway npm test -- --runInBand | 203 suites passed, 2 skipped, 1 failed; 2790 passed, 7 skipped, 14 failed, all in smoke.integration.spec.ts (baseline BIZ-01: 2780 passed, the same 14 known runtime-only failures) |
| api-gateway npm run build | exit 0 |
| frontend npx tsc --noEmit | exit 0 |
| frontend npm test | 876 passed, 0 failed (baseline 876) |
| the six test files by name (agent-registry, use-system-agents, office.logic, office-screen, platform-dashboard, knowledge-screen) | 124 passed, 25 suites, 0 failed |
| frontend npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Value check | the Chief of Staff prompt template is identical to the one at c8c8f44; the lead, writer and reviewer strings and the six Chief of Staff scope ids are unchanged |
| Diff review | 18 modified files and 2 new files plus the new system-agents folder, all in the narrowed write set |

Evidence in `C:/Users/knlee/aisb-preflight/AGENT-DEFS-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2351 | `88ea759dabfbb1e5915516bda8dcd97ad69bf890dc474997a9184bd62cb445ab` |
| `brief-stage-start.txt` | 9890 | `1273e3c5025fcf2972a91f0c105a303f448573bb83c03d306678097a159c57ec` |
| `stage-start-draft.md` | 40204 | `8c3ef8a809b1c5067615aec4b81952f8867fc19d8b50f53c7b9c6233a0a804d7` |
| `brief-stage-start-record.txt` | 2384 | `d4a0189d76d9d5d39435e322ddd6459f5f783d91e020f86b8c0bf9ed9dc67c2a` |
| `brief-impl.txt` | 10874 | `3e48a7d6c49c04a54ba37ab3aff69764eb6f08437ae214ed6c1162a434c8a60f` |
| `cursor-admit-result.json` | 3324 | `c51da3a91b4086b190bead8c44710c8ac7392a9fd546328b30155a7836de7123` |
| `cursor-stage-start-result.json` | 41910 | `c0c0ea91907a02d3cb48f68f2c63bc195544489ad07c678acb7ca76d0f6751e3` |
| `cursor-stage-start-record-result.json` | 3905 | `6ef4745f718339ddde1396ab321d6b0cf887552f92f21beb75ab3acbc4c642c5` |
| `cursor-impl-result.json` | 12168 | `fafc3de0d998b03398ed465c7a1e325ba36c32228674da55d268252947793693` |
| `reviewer-gates.out` | 940 | `a6ed8b2ab99d4f15898ac475d7d2b36e0cae9640064f87e0112d364631f17b94` |

## Acceptance criteria

All nine met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored), UI 9/9 (3: the existing Heroicons v2 Outline ExclamationTriangleIcon only; 4: Impeccable, Emil Kowalski and DESIGN.md read, the new boxes copy the existing alert treatments, no motion; 5: DESIGN.md followed (DESIGN-DOC-01 locked); 6: loading, 401, failure and success states defined, translated and tested; 7: the gateway work is the admitted scope, no redesign; 8: existing test IDs kept; 9: the browser check comes with STAGING-DEPLOY-14 and Keith's testing), BACKEND 6/6 (1: SessionCookieGuard reused and not modified; 2: no internal route; the public route is outside the internal prefixes; 3: no generated-app template touched; 4: HARNESS_ENTITLEMENT_PROOF_V1 unchanged; 5: n/a, no entity or schema change; 6: gates compared with BIZ-01 and BIZ-02)

FOLLOWUPS: 1 registered / 3 superseded / 6 dropped / 0 undisposed (registered: STAGING-DEPLOY-14, the deploy, OPTIONAL as the control-plane default; superseded: run provenance by RSI-00 stage S1, the ARCHITECTURE.md registry text by GOV-ARCH-SYNC-01 with a note added, the npm test gap by FE-TEST-COVERAGE-01; dropped at the stage-start: the six items in the backlog's Dropped follow-ups list)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED. Not deployed; staging runs 4deae5a. RSI-00 stage S2 done.
