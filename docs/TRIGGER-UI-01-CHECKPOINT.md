# TRIGGER-UI-01 — Checkpoint

**Task:** TRIGGER-UI-01 — Schedules page
**Status:** COMPLETE AND LOCKED — 2026-11-15. Built, not deployed: STAGING-DEPLOY-TRIG-01 follows (Keith approves the deploy).
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** FRONTEND, I18N, PACKAGE (the frontend test script line only).
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan section 3.4, F5). Admitted after the TRIGGER-01 LOCK under Keith's "Start triggers (Stage 6)".

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1; FRONTEND, I18N, PACKAGE; 13 paths | 92dcb8a |
| 2. Implementation | sonnet subagent (Sonnet 5.5: a frontend slice in one area, no migration, auth or contract change), fast-forwarded | 983cd31 |
| 3. LOCK | a one-space formatting fix in platform-dashboard.tsx; this checkpoint, board, backlog, sidecar and plan; validator | this record |

## What changed (frontend)

- **New page:** `app/[locale]/schedules/page.tsx`, plus `components/schedules/` with `schedules-api.ts`, `schedules.logic.ts` and `schedules-screen.tsx`, each with a test.
- **Calls:** the page calls the frozen `/api/schedules` routes through `collaborationFetch`, which sends credentials and the CSRF header on writes. The workflow picker reuses `loadResultsWorkflows` from Results.
- **The list:** each row shows the target (a gone workflow shown as gone), a task preview, the time, days and zone, and an on/off switch. It also shows the last run: local date, translated outcome, translated reason, and a link to Results. Each schedule's history (last 30) opens in place.
- **Create and edit:** target, task with a character count, time, Mon to Sun, the time zone (defaults to the browser's), enabled, and the read-only hint. Delete asks for confirmation first.
- **States:** auth loading, loading, failed with retry, 401 to sign-in, 403 "not available", empty, saving, saved, deleted, and each `schedule_*` error as a sentence. Banners show when schedules are switched off or runs are off, with "n of 5 used" and the limit notice.
- **Command center:** a Schedules link (ClockIcon, Heroicons v2 Outline, `data-testid="platform-open-schedules"`) after Results and before back-to-workspace. Existing test ids and order checks are unchanged.
- **Messages:** a `schedules` namespace (95 keys) and `platform.openSchedules` in en, zh-TW and zh-CN. The Chinese texts are real translations; none equals the English. The three files have the same keys.
- **Codes pinned:** every error, reason and outcome code has a key. The code lists are pinned against the backend source by a test.
- **package.json:** `components/schedules/*.test.ts*` added to the frontend test script. No dependency or lockfile change.
- **No backend change.**

## Control-plane review and gates

The control plane read the API module, the page, the dashboard and package.json diffs, checked the screen for hardcoded English (none), and sampled the translations. It reran the gates on the branch:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | rc 0 |
| `npm test` | 1959 of 1959 (baseline 1915 plus 44) |
| `npm run build` | rc 0, `/[locale]/schedules` built; `tsconfig.tsbuildinfo` restored |
| Files outside the write set | none |
| On main after the one-space fix | tsc rc 0; `platform-dashboard.test.ts` 61 of 61 |

## Skills and DESIGN.md (as the worker reported)

- **Impeccable:** read. Its context loader and shape-brief gate were not run, since they don't suit a bounded page that reuses existing patterns. Applied: a clear hierarchy, no new visual language, errors as plain sentences with a retry, and every state written out.
- **Emil Kowalski:** read; no animation added. Applied: disabled and focus states, and a confirm step before delete. `active:scale` was left out to keep DESIGN.md's button classes.
- **DESIGN.md:** the Connections page's header, card, button, field and pill classes. The danger, amber and emerald styles follow DESIGN.md.

## Not proven here (live, in STAGING-DEPLOY-TRIG-01 with Keith)

- **On the real routes:** creating, editing, switching and deleting through the real routes after migration 1810, with the CSRF header and the 401 and 403 paths of a browser session.
- **In a browser:** the workflow picker with real workflows, the browser time-zone default and the zone list, and the layout at phone width.
- **With runs on (TRIGGER-LIVE-01):** the last run line after a real scheduled run, and its link.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| A link from a schedule's last run to that one run in Results | superseded by RESULTS-POLISH-01 (note added) |
| "Started by a schedule" in Results | superseded by TRIGGER-ORIGIN-01 (already registered) |
| The page does not refresh the last run while open; no zone list where `Intl.supportedValuesOf` is missing | registered TRIGGER-UI-POLISH-01 |
| The flows only a browser can prove | superseded by STAGING-DEPLOY-TRIG-01 (note added) |

CHECKLIST: EVERY 11/11 (1: admitted 92dcb8a; 2: 3-step; 3: sonnet named before the dispatch; 4: self-contained brief, no further subagent; 5: 13 paths, PACKAGE for the test script line only, no dependency; 6: 44 tests added; 7: gates rerun by the control plane; 8: no runtime or dev server; 9: tsconfig.tsbuildinfo restored; 10: worktree, fast-forward and branch removal by the control plane; 11: FOLLOWUPS line), UI 9/9 (1: every string in en, zh-TW and zh-CN through the existing hook, real translations, key parity and code coverage tested; 2: I18N held; 3: ClockIcon, Heroicons v2 Outline; 4: both skills read, applied as above; 5: DESIGN.md classes; 6: empty, loading, failed and success states translated and tested; 7: one new page and one link, no backend, dependency or refactor; 8: existing test ids kept; 9: the browser flows named above for the live check in STAGING-DEPLOY-TRIG-01)
FOLLOWUPS: 1 registered (TRIGGER-UI-POLISH-01) / 3 superseded (the run deep link by RESULTS-POLISH-01; the schedule label by TRIGGER-ORIGIN-01; the browser flows by STAGING-DEPLOY-TRIG-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane:
- Lane 1 released EMPTY; FRONTEND, I18N and PACKAGE released UNOWNED.
- Nothing deployed: staging still runs 7fcc46d.
