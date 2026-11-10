# DESIGN-GAPS-01 — Checkpoint (slice A)

**Task:** DESIGN-GAPS-01 — Fix the design inconsistencies DESIGN.md lists. This record covers slice A, DESIGN.md Known gaps 5, 11 and 12.
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-06 by DESIGN-DOC-01. On 2026-11-10 the control plane split it and admitted slice A (94878fe), under Keith's instruction to keep starting the next tasks. Slice B is DESIGN-GAPS-01B and slice C is DESIGN-GAPS-01C.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Split and admission | Lane 2 with FRONTEND and I18N | 94878fe |
| 2. Implementation | sonnet subagent in worktree lane/DESIGN-GAPS-01 (e647af7), cherry-picked onto main | 1367f47 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (13 files)

| Gap | Now |
|---|---|
| 5 Title weight | Auth titles are `font-semibold`, the same as collaboration and template headings. DESIGN.md drops the bold title token. |
| 12 Auth cards | The forgot-password and reset-password cards are `rounded-xl shadow-lg`, the same as login and register. |
| 11 Icons | The mobile sidebar icon is `Bars3Icon`; its button, `aria-label` and `data-testid` are unchanged. The tab orientation glyphs `⇔` and `⇕` are now `ArrowsRightLeftIcon` and `ArrowsUpDownIcon`, with `aria-hidden`, and the `title` and `data-testid` are kept. All three are Heroicons v2 Outline. |
| 11 Readiness chip | `SystemReadiness.tsx` uses `useTranslations('systemReadiness')`. There are 36 keys in en, zh-TW and zh-CN, covering the chip, panel, statuses, errors, fix steps and buttons. Raw server error text is shown as is (`messageIsRaw`). Shell commands and env names stay literal. |

DESIGN.md marks gaps 5, 11 and 12 as "Fixed (DESIGN-GAPS-01A)" and keeps their numbers, so slices B and C still refer to them correctly.

Tests:
- `system-readiness-gate.test.tsx` renders inside `TranslationProvider`, renders zh-TW and zh-CN, checks key parity with real non-English text, and checks there is no hardcoded copy.
- `design-gaps-a.test.ts` (new, 4 tests) checks the title weight, the card classes and the icons, with the test IDs and aria-labels kept.
- No test ID changed.

Skills: the worker read Impeccable and Emil Kowalski. It applied consistency, hierarchy and accessibility, and kept the existing press feedback with no new motion.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1280 tests, 1280 pass, 0 fail (1273 before + 7 new; the test-script guard passes) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

After the cherry-pick:
- the frontend and DESIGN.md on main are identical to the branch;
- the changed files are LF.

## Live check (at the next staging deploy)

- The four auth pages: card radius, shadow and title weight.
- The workspace at mobile width: the Bars3 button opens the sidebar.
- The tab orientation toggle shows both arrow icons.
- The readiness chip in zh-TW and zh-CN. It renders only when NODE_ENV is development or `NEXT_PUBLIC_SHOW_DEV_TOOLS=true`, so on staging it is a dev-tools check.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI 8/9 (6: the checking, ready, not-ready and error states are translated and the checking state is render-tested; 9: the live check above is owed at the next deploy)
FOLLOWUPS: 0 registered / 4 superseded / 0 dropped / 0 undisposed:
- the readiness chip's emoji status glyphs and the stray `✓ text-green-600` class: superseded by DESIGN-GAPS-01B, whose scope now names them;
- the tab bar's hardcoded `title` and the "Open sidebar" aria-label: superseded by DESIGN-GAPS-01B;
- ConfigurationControl.tsx's hardcoded English: superseded by DESIGN-GAPS-01B;
- the live check: superseded by the next staging deploy's check list, recorded in DESIGN-GAPS-01B's scope.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED. DESIGN-GAPS-01B is now ready under Keith's instruction.
