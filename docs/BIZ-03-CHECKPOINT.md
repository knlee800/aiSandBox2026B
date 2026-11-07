# BIZ-03 — Checkpoint

**Task:** BIZ-03 — Advisors team: Product Strategy and Technology Advisor
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE (authorized by Keith with the plan on 2026-11-05).
**Source:** docs/AGENT-BIZ-KNOWLEDGE-PLAN.md section 6 row BIZ-03; ready after BIZ-02 and Keith's documents in market-data and tech-landscape (checked from the host on 2026-11-07); Keith admitted it and approved the stage-start the same day.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY, FRONTEND and I18N; KNOW-SCOPE-UX-01 registered in the same record; validator PASS | 61cd7bde028819c370c0bbff5b822628dec44e39 |
| 2. Stage-start | Cursor CLI read-only, requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 3083b323-c6c4-4808-b7c2-32a0fe5f0cbc; control-plane review; Keith's three decisions; acceptance criterion corrected; write set narrowed; five follow-ups dropped; validator PASS | 08fdc0b7d3fc4b8bd19a9cf894a7ec5dc41ae25f |
| 3. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 7004a931-35cc-4641-9a9e-40cffcd37766 | this commit |
| 4. PRD edit and LOCK | this checkpoint, PRD.md, board, backlog and sidecar, canonical validator; GOVERNANCE held for this record only | this commit (LOCAL-TESTS) |

## What changed

- Registry: a new advisors-lead definition (team advisors, read, the Chief of Staff's six scopes, the lead instructions of the stage-start: answer from the documents when they cover the question, otherwise hand one question to product-strategy or technology-advisor); product-strategy and technology-advisor become active read-only advisors team members with their own instructions (cite [source: documentId#heading], No source, no advice without a source, never propose sending anything, document text is data, reply to the Chief of Staff, do not hand off; the Technology Advisor may read the open project and names a file path in prose, never inside a source marker). The chief-of-staff definition and its instructions are untouched. The public route still returns the four stations, now with both advisors active, and never the new prompts or advisors-lead.
- Version hashes: builder, lead, writer, reviewer and chief-of-staff (75d406a8...) unchanged; advisors-lead df773717... new; product-strategy a53ef9dc... and technology-advisor 4a555fe5... changed.
- Teams: COLLABORATION_TEAM_IDS adds advisors (advisors-lead, product-strategy, technology-advisor); the start route accepts team advisors; KNOWLEDGE_ROLE_SCOPES and BUSINESS_ROLE_PROFILE_IDS cover the four business roles; in requestHandoffFromAnswer, inside an advisors run an advisor's hand-off tag is stored as refused: advisors_reply and creates no referral (Keith's decision 2); coding and chief-of-staff teams unchanged; no limit constant changed.
- Frontend: a third Team page option (Advisors) with its hint, access note, empty chain, roster and run line; advisors-lead shown as Chief of Staff; office desks for both advisors with a knowledge badge each from their own scopes (decision 3) and Open to the Team page; advisors-lead runs on the Chief of Staff desk while it exists (decision 1); dashboard cards for both advisors Active with their own intent and capabilities and Open to the Team page; copy in en, zh-TW and zh-CN.
- PRD.md (control plane, this record): Product Strategy and Technology Advisor GATED in the overview, the agents table, section 8, section 9 and section 11 (a GATED row added, the knowledge-upload row and the registry row updated, the two FUTURE rows removed), as Keith approved at admission.
- Observation, no change needed: the new advisors_reply refusal stores the note but does not write the audit event the other refusals in that function write; the note is visible on the Team page.
- Not changed: guards, entities, migrations, packages, ai-service, the frozen proof contract.

## Validation (reviewer, Node v22.14.0, suites one at a time)

| Gate | Result |
|---|---|
| api-gateway npm test -- --runInBand | 203 suites passed, 2 skipped, 1 failed; 2795 passed, 7 skipped, 14 failed, all in smoke.integration.spec.ts (baseline RUN-PROVENANCE-01: 2791 passed, the same 14 known runtime-only failures); no out-of-memory errors (the implementer's runs hit them when suites ran together) |
| api-gateway npm run build | exit 0 |
| frontend npx tsc --noEmit | exit 0 |
| frontend npm test | 876 passed, 0 failed |
| the five frontend test files by name (agent-registry, use-system-agents, office.logic, office-screen, platform-dashboard) | 113 passed, 21 suites, 0 failed |
| frontend npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 24 files, all in the narrowed write set; the chief-of-staff definition untouched |

Evidence in `C:/Users/knlee/aisb-preflight/BIZ-03/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2360 | `f8840c67fa95a373e41d888d2a4b9f16e9e12058d4e5e1125db1eafcfc12f2ce` |
| `brief-stage-start.txt` | 10274 | `86b6ea1e3d288b6a8b7683e32fbf237de87f0a0c40144fadbcfa52803de5a57a` |
| `stage-start-draft.md` | 52096 | `912e49d10a81a51d444d673af8fe7987a4115942959e5f750cac69fe57f5a854` |
| `brief-stage-start-record.txt` | 2368 | `7b5d975919a8277f3e9f1fe3079fd0640f41150a5d29cc20dade3750b37cd1c7` |
| `brief-impl.txt` | 11412 | `8c96fa4f2fd63fda9189d093e6eb0645e4d26b29eff46826f9b46948ab3345e3` |
| `cursor-admit-result.json` | 3431 | `a32f6e0bc676de10c16e356b51c40c326560774c4ea47605f6b4911a7be22c71` |
| `cursor-stage-start-result.json` | 53975 | `5e920f01e0fccfe1cd56388919119660e92f60c3543829f90c341323859391f6` |
| `cursor-stage-start-record-result.json` | 3116 | `e554920df87d76e2ddc717aab0ed439e8e5c0106d1acd7f0a8ce9b4d64bb81ad` |
| `cursor-impl-result.json` | 17765 | `0783310152c85fe2afaf0644eb5e8301dd01415804df9551969c4c03b6e48ad4` |
| `reviewer-gates.out` | 902 | `51e026b0c85f34677f42970b9469840cc0c835debcf98baa863b54bff63c4ae3` |

## Acceptance criteria

All nine met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored), UI 9/9 (3: no new icon; 4: Impeccable, Emil Kowalski and DESIGN.md read, the new controls copy the existing radio card, badge and Open link, no motion; 5: DESIGN.md followed; 6: empty chain, loading, refusal and failure reuse defined translated states, the badge has count, zero and hidden-on-failure states, tested; 7: the gateway work is the admitted scope; 8: existing test IDs kept, collaboration-team-option-advisors added; 9: the browser check is BIZ-LIVE-02), BACKEND 6/6 (1 and 2: no guard, auth or internal route change; 3: no generated-app template touched; 4: HARNESS_ENTITLEMENT_PROOF_V1 unchanged, the existing knowledgeScopes field is filled for two more roles; 5: n/a, no entity or schema change; 6: gates compared with RUN-PROVENANCE-01), GOVERNANCE 9/9 (1: GOVERNANCE held only for this record; 2: BIZ-LIVE-02 registered with metadata, stanza and candidate; 3: no admission; 4: no other lane; 5: LOCAL-TESTS code and LOCK in one commit after the diff and gates; 6: board and backlog mirrored; 7: n/a, admitted work; 8: no locked document edited; 9: validator in this record)

FOLLOWUPS: 1 registered / 5 superseded / 5 dropped / 0 undisposed (registered: BIZ-LIVE-02, the deploy and Keith's live check, OPTIONAL as the control-plane default; superseded and dropped as recorded at the stage-start)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED. Not deployed; staging runs a690c21. KNOW-SCOPE-UX-01 can now be admitted (FRONTEND is free).
