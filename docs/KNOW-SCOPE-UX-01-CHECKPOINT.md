# KNOW-SCOPE-UX-01 — Checkpoint

**Task:** KNOW-SCOPE-UX-01 — The Knowledge add form names its scope
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md.
**Source:** Keith's documents twice landed in Company monthly reports on 2026-11-07 because the add form saved to the chip row's scope without saying so; registered at the BIZ-03 admission; Keith approved the scope draft and admitted it after COLLAB-START-ONCE-01 on 2026-11-07.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | at the BIZ-03 admission | 61cd7bd |
| Scope draft recorded | in the COLLAB-START-ONCE-01 admission | 1a647e940f0bfd7a46208a91ff9f162d100119a2 |
| Admission | Lane 1 with FRONTEND and I18N; validator PASS | 45c12b10c9fde468e4070d095552da071cc4debe |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- frontend/components/knowledge/knowledge-screen.tsx: the add form shows "Adding to: <scope>" and a scope select inside the form that starts at the chip row's scope; the upload sends the scope picked in the form (exported helper knowledgeSubmitScopeId), and after a successful add the chip row selects that scope so the new document is in view. The replace form shows "Replacing in: <scope>" for the document's own scope, offers no picker and saves to that scope. Opening, cancelling or switching chips resets the form's scope.
- frontend/components/knowledge/knowledge-screen.test.tsx: five tests: the add line and picker start at the chip scope; an add sends the picked scope (and the chip scope when unchanged); a replace sends the document scope; the replace form shows the document scope with no picker; the three keys exist in all locales and zh-TW renders 新增至：政策.
- frontend/messages: knowledge.addingTo ("Adding to: {scope}" / 新增至：{scope} / 添加至：{scope}), knowledge.replacingIn ("Replacing in: {scope}" / 取代於：{scope} / 替换于：{scope}), knowledge.formScopeLabel ("Scope" / 範圍 / 范围); no other key changed.
- Not changed: knowledge-api.ts, the upload contract (scopeId, title, file to POST /api/knowledge/documents), the gateway and every service, the chip row.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend npm test | 880 passed, 0 failed (baseline COLLAB-START-ONCE-01: 880; npm test does not run components/knowledge) |
| npx tsx --test components/knowledge/knowledge-screen.test.tsx | 19 passed, 0 failed (five new) |
| npx tsc --noEmit | exit 0 |
| npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 5 files changed (238 lines added, 3 removed), all in the write set |

Evidence in `C:/Users/knlee/aisb-preflight/KNOW-SCOPE-UX-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2342 | `41de799ebbb4bab28e1d1d8f8e03c8b80ccc5247858bf712fc01b9e743dd6b96` |
| `brief-impl.txt` | 8933 | `86ce5a240f483f6705f9dcb49145c6ba9f759d60e75d40a730b1b4aaa987d70e` |
| `cursor-admission-result.json` | 3408 | `f743d10bedd31112eea46f3e0950851ea0169019cb05fd4d73e6e0c2d1455833` |
| `cursor-impl-result.json` | 5664 | `e9cb09baf1182a0f6bc37a181301e79e64c294e893597911d978514ccb2a9773` |

## Acceptance criteria

All seven met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started), UI 9/9 (1: three new keys in en, zh-TW and zh-CN through useTranslations('knowledge'), real Chinese, tested; 2: I18N held; 3: n/a, no icon; 4: the worker read Impeccable and Emil Kowalski and kept the change to one line and one select in the existing field style, no motion; 5: DESIGN.md field and label classes reused; 6: the form's busy state disables the picker, error states unchanged and translated, success selects the saved scope; 7: no redesign, routing, backend or dependency; 8: existing test IDs kept, new knowledge-form-scope and knowledge-form-scope-picker; 9: covered by rendered-markup and helper tests; the staging check follows the deploy)

FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed (superseded: the deploy, by STAGING-DEPLOY-16, which now depends on this task and carries it)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. Not deployed; staging runs 8a723bf.
