# BIZ-02 — Checkpoint

**Task:** BIZ-02 — Chief of Staff desk in the office
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE (authorized by Keith with the plan on 2026-11-05).
**Source:** docs/AGENT-BIZ-KNOWLEDGE-PLAN.md section 5 and section 6 row BIZ-02; ready after BIZ-LIVE-01 passed; Keith approved the scope and the PRD wording and admitted it on 2026-11-07.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with FRONTEND and I18N; validator PASS | 5c83d7bf8c1c4932b4baa0bb727ca6d9ca4c1263 |
| Scope change | Cursor stopped before any edit: the dashboard Open action is drawn in agent-detail-panel.tsx, outside the write set; Keith approved adding it; validator PASS | c3305d4c6956dde2c573cc49a105aeadd7dcdde7 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 847b1ee7-3827-4aff-b74c-6d9c8aec1a51 (the stopped first run: session da186965-91e7-49cb-bac8-f34d46e62a2c, no change) | this commit |
| 3. Consolidation, PRD edit and LOCK | this checkpoint, PRD.md, board, backlog and sidecar, canonical validator; GOVERNANCE held for this record only | this commit (LOCAL-TESTS) |

## What changed

- Registry: the Chief of Staff manifest is status active; enabled stays false (enabled means a Builder-style workspace agent); the test that active agents are enabled allows only this case; Product Strategy and Technology Advisor stay coming soon.
- Office: the Chief of Staff desk is occupied. A collaboration run whose builderProfileId is an active registry agent other than the Builder (today only chief-of-staff) goes to registry:chief-of-staff; other collaboration runs stay on the Team desk; other runs keep today's rules. The office reads GET /api/knowledge/documents once after sign-in and shows the count of the owner's documents in the Chief of Staff's six scopes as a small chip (BookOpenIcon, Heroicons v2 Outline) on the desk and in its panel, zero included; a failed read shows no badge and no error; titles and content are dropped in the pure parser (office-knowledge.ts). The panel's Open goes to /{locale}/collaboration; it has no workspace, approve, reject or upload action.
- Dashboard: the Chief of Staff card uses the active card, its own intent and three capability lines, no Builder text; the detail panel gains an optional Open link (agent-detail-open) used only for this profile, and Coming Soon stays the fallback for the other static agents. Active and reserve station counts follow status (2 and 2).
- Messages: platform.openAgentDetailChiefOfStaff, platform.detail.chiefOfStaffIntent and three capability keys, office.knowledgeBadge and office.knowledgeBadgeOne, and the updated agents.chiefOfStaff.description, in en, zh-TW and zh-CN with real translations.
- PRD.md (control plane, this record): the Chief of Staff is GATED in the agents table, section 8 and section 11 (GATED table rows for the Chief of Staff and the owner's document uploads; the FUTURE rows removed or narrowed), as Keith approved. For consistency with the same decision three more lines that still called it a placeholder were updated: the overview (section 1), the summary (section 9) and the CURRENT registry row (section 11, now "Chief of Staff active for gated accounts; 2 coming-soon placeholders").
- Not changed: the gateway, ai-service, guards, entities, migrations, packages, ARCHITECTURE.md (its section 13.1 placeholder row is part of GOV-ARCH-SYNC-01).

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend npx tsc --noEmit | exit 0 |
| frontend npm test | 876 passed, 0 failed (baseline 876); the script does not run lib/office, lib/agent-platform, components/office or components/platform tests |
| the four test files by name (agent-registry, office.logic, office-screen, platform-dashboard) | 105 passed, 19 suites, 0 failed |
| frontend npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 14 modified and 1 new file, all in the write set; no backend change |

Evidence in `C:/Users/knlee/aisb-preflight/BIZ-02/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2353 | `a030b77d405cd67c50f65c1a20969db433a418cec15e938a460c3a7c4e5fb82c` |
| `brief-impl.txt` | 9623 | `93d68689782aeb8e7bebb8a13a1e4ab270d775173dbff189bdad029f88df133a` |
| `brief-scope.txt` | 2380 | `7cbe8c0e7451698fd70b3f3c02de227ae8200aa85eaba6f400d8f1c47910aa53` |
| `brief-impl2.txt` | 10070 | `856efbad260dffbcaca5811202685192c2954b62b88b46f00768a835144602a5` |
| `cursor-admit-result.json` | 3393 | `59e4932e5e35f5fde1f79e8efda7b8d85d310a881f7da67d961fff06780061ae` |
| `cursor-impl-stop-result.json` | 3875 | `92ab9eb875660d43d83469517f5a35e35f0b0d18675ee18e531752b0065d2a48` |
| `cursor-scope-result.json` | 3806 | `d7e2cb3b52e3e6b03d51861022c5d08eb302c0f5835deefc4678ee0a273bb5ea` |
| `cursor-impl-result.json` | 9076 | `aaadb6fbf16ddc944f27861cce13aab0a3319e5c0ad49108afa54db636054f65` |
| `reviewer-gates.out` | 581 | `4db9297103fae8e03959eebffbafdac78e87b90cd202036f660ad20c083d00d7` |

## Acceptance criteria

All nine met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored), UI 9/9 (3: BookOpenIcon, Heroicons v2 Outline; 4: Impeccable, Emil Kowalski and DESIGN.md read; the chip uses the office phase-chip treatment and the existing indigo button, no new motion; 5: DESIGN.md office and dashboard tokens; 6: the badge has loaded, zero and failed states, the failed state shows nothing by design, all tested; 7: no backend work, no redesign; 8: existing test IDs kept, agent-detail-open added; 9: the browser check is the deploy follow-up STAGING-DEPLOY-13 and Keith's own testing), GOVERNANCE 9/9 (1: GOVERNANCE held only for this record, not an OS mutation; 2: STAGING-DEPLOY-13 registered with metadata, stanza and candidate; 3: no admission; 4: the integrated tree has no other lane; 5: LOCAL-TESTS code and LOCK in one commit after the diff and gates; 6: board and backlog mirrored; 7: n/a, admitted work; 8: no locked document edited; 9: validator in this record)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed (registered: STAGING-DEPLOY-13, the deploy, OPTIONAL as the control-plane default; superseded: npm test not running the office, registry and dashboard tests, by FE-TEST-COVERAGE-01 with a note added to its body)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. Not deployed; staging runs 41a752e.
