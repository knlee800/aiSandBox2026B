# DESIGN-GAPS-01B — Checkpoint

**Task:** DESIGN-GAPS-01B — One primary color, one success color, one focus ring, one spinner
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the DESIGN-GAPS-01 split (94878fe). Admitted 2026-11-10 (fb008db) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with FRONTEND and I18N | fb008db |
| — Write set widened | frontend/lib/collaboration.test.ts (one stale class assertion) | 972b65b |
| 2. Implementation | sonnet subagent in worktree lane/DESIGN-GAPS-01B (566cde3, 570c2e6), cherry-picked onto main | 24cc010, d6bccb4 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (34 files)

| Gap | Now |
|---|---|
| 1 Primary color | About 40 primary buttons in 11 files use `bg-brand hover:bg-brand-hover`, and disabled is `opacity-50` (the brand has no tint scale). Logo marks, the language toggle, the Timeline button and the configuration banner are not primary actions and stay as they were (accepted). |
| 7 Success color | Every `green-*` in app/ and components/ is `emerald-*` (about 35 swaps in 12 files). |
| 8 Focus | About 45 rings are `focus-visible:ring-brand`. Auth, landing and configuration inputs moved from `focus:` to `focus-visible:`. The chat and collaboration textareas have a visible brand ring, and their `outline-none` without a ring is gone. Selection rings on cards are not focus rings and stay (accepted). |
| 9 Spinner | New `frontend/components/ui/Spinner.tsx`: an `aria-hidden` SVG, `motion-reduce:animate-none`, and an optional translated `sr-only` label with `role="status"`. It is used in the three workspace history loading rows (in place of the pulsing dot, sentences kept), the readiness checking header and recheck button, and the configuration loading state. |
| 13 Collaboration | The selection is `border-brand bg-indigo-50`, the same hue as its primary button. A CSS-variable brand cannot take an opacity tint. |
| Slice A leftovers | Readiness emoji became Heroicons (CheckCircle, Clock, XCircle, Cog6Tooth, XMark), and the stray class string is fixed. ConfigurationControl's English is in a new `configuration` namespace (41 keys), with its emoji replaced by Heroicons. The tab bar's title and aria-label and the "Open sidebar" label are translated. |
| Also | The three workspace loading sentences are translated (`project.loadingProjects`, `loadingPublicProjects`, `loadingSnapshots`). |

DESIGN.md marks gaps 1, 7, 8, 9 and 13 as "Fixed (DESIGN-GAPS-01B)" and updates the token, button, input, loading and navigation sections.

Tests:
- `design-gaps-b.test.tsx` (new, 17 tests) covers the brand buttons, no `green-*`, no indigo or blue focus rings, the textarea rings, the spinner, gap 13, no emoji, no hardcoded configuration English, key parity and the loading keys.
- Old pins were updated in `workspace-shell.test.tsx`, `design-gaps-a.test.ts`, `platform-dashboard.test.ts` and `lib/collaboration.test.ts`. The last was one assertion, `border-indigo-300` to `border-brand`, after the write set was widened.
- No test ID changed.

Skills: Impeccable (one action color, one focus system, real state feedback) and Emil Kowalski (motion restraint; `focus-visible`, so mouse clicks show no ring).

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1297 tests, 1297 pass, 0 fail (1280 before + 17 new) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

The control plane checked:
- every changed file is inside the write set;
- after the cherry-pick, the frontend and DESIGN.md on main are identical to the branch;
- the changed files are LF.

## Live check (at the next staging deploy, with slice A's items)

- Primary buttons (chat send, collaboration start and per-run, platform, office, knowledge) are one brand color, with hover and a dimmed disabled state.
- Tab focus shows a brand ring on the textareas and chips.
- The spinner shows on the history lists while they load.
- The collaboration selection is brand-bordered.
- In all three locales: the readiness panel and the configuration modal (dev tools on), the tab orientation tooltip, and the mobile "Open sidebar" label.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 5: the write set was widened by the control plane for one test file before the fix; 9: tsbuildinfo restored), UI 8/9 (9: the live check above is owed at the next deploy)
FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed:
- registered: DESIGN-CONTRAST-01, white text on the dark-mode brand (#818cf8) is low contrast;
- superseded: the live check, by the next staging deploy's check list;
- accepted on record and not follow-ups: the non-primary items left as they were, the selection rings, and that components/collaboration/ has no test files (the test-script guard covers it if one is added).

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED. BIZ-USER-01A stays ACTIVE in Lane 1.
