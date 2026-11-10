# DESIGN-CONTRAST-01 — Checkpoint

**Task:** DESIGN-CONTRAST-01 — Readable text on the dark-mode brand color
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the DESIGN-GAPS-01B LOCK (601ece5). Admitted 2026-11-10 (b477e49) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with FRONTEND | b477e49 |
| 2a. First pass | sonnet subagent, 7f91ef6: dark buttons fixed, but dark links fell from 6.64:1 to 4.0:1 and the light brand stayed at 4.47:1 | 833fece |
| — Write set widened | frontend/app/, tailwind.config.js, the contrast test | 5f33ad9 |
| 2b. Second pass | the same subagent, 6b03cad: the light brand passes and links get their own token | ae6dfd3 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Tokens now

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--color-brand` (button fill) | #5b5ee8 (was #6366f1, 4.47:1) | #5b5ee8 (was #818cf8, 2.98:1) | 4.99:1 with white text |
| `--color-brand-hover` | #4f46e5 | #4f46e5 (was #6366f1) | 6.29:1 with white text |
| `--color-brand-text` (new, links) | #4f46e5 | #818cf8 | 6.29:1 on white; 6.64:1 on #0a0a0a |

- `tailwind.config.js` exposes `brand.text` (`text-brand-text`).
- Eight links in five files (the four auth pages and the public landing slice) moved from `text-brand hover:text-brand-hover` to `text-brand-text hover:underline`. A hover color that passes on near-black would look almost the same as the link, so hover is shown by an underline.
- Button, spinner and `border-brand` uses are unchanged.
- DESIGN.md has the tokens, and marks the contrast note in Known gap 1 as fixed.

Test: `frontend/lib/brand-contrast.test.ts` (new) uses the WCAG relative-luminance formula. It checks:
- every brand and brand-hover value, light and dark, is at least 4.5:1 with white;
- brand-text is at least 4.5:1 on white and on #0a0a0a;
- the tailwind config exposes the token;
- no `text-brand` class is left on the auth pages or the landing slice.

Skills: Impeccable (a semantic link token, measured against the page rather than the button) and Emil Kowalski (an underline instead of a second color, with no motion cost).

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1305 tests, 1305 pass, 0 fail (1297 before + 8 new) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

- Every changed file is inside the widened write set.
- After the cherry-pick, the frontend and DESIGN.md on main are identical to the branch, and the changed files are LF.

## Live check (at the next staging deploy, with the design slices)

- Dark mode: primary buttons and auth links are readable; links underline on hover.
- Light mode: the brand is slightly deeper (#5b5ee8).

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 5: write set widened by the control plane before the second pass; 9: tsbuildinfo restored), UI 6/9 (1, 2 and 3: n/a, no strings, message files or icons; 6: n/a, no states; 4: skills read in the second pass; 9: live check at the next deploy)
FOLLOWUPS: 0 registered / 1 superseded (the live check, by the next staging deploy's check list) / 0 dropped / 0 undisposed. The first pass's link-contrast note is fixed in this task.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY and FRONTEND released UNOWNED. BIZ-USER-01A stays ACTIVE in Lane 1.
