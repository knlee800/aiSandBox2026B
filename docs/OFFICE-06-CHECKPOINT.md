# OFFICE-06 — Checkpoint

**Task:** OFFICE-06 — Run detail in the office desk panel
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by GOV-ONE-PLAN-01 (79d2c6264eb4e82041e24b4c47c5b32e5f0a87e4); admitted by Keith to Lane 2 in fac9275a0f027e93fa98f3a3a2c932884f3fa859. Code and LOCK in one record (GOV-OS-04, LOCAL-TESTS). Plan: docs/AGENT-OPS-PLAN.md section 0 (item 2, now removed from the list).

## What changed

- frontend/components/office/office-desk-panel.tsx: recent runs are buttons; opening one replaces the run list inside the panel with a detail view (Back, saved output, states).
- frontend/components/office/office-screen.tsx: loads the detail, passes translated copy, clears it when the desk changes.
- frontend/hooks/useOfficeRunDetail.ts (new): GET /api/ai/executions/:executionId with the session cookie and no cache; stale responses are ignored after the run or desk changes; Try again refetches.
- frontend/lib/office/office.logic.ts: maps the response to a state (401 auth expired, 404 not found, other errors failed; output only for a completed run with non-blank text), the Escape action and where focus goes.
- Tests: frontend/lib/office/office.logic.test.ts and frontend/components/office/office-screen.test.tsx.
- frontend/messages/en.json, zh-TW.json, zh-CN.json: seven office keys (openRun, backToRuns, savedOutput, runDetailLoading, runDetailEmpty, runDetailNotFound, runDetailError); Try again reuses office.retry.

No backend change: the route already returns the saved output and answers 404 unless the caller owns the run (services/api-gateway/src/ai/ai-execution.controller.ts:1109-1123). Model text is shown as plain text in a pre block; HTML is escaped (tested with a script tag). Not deployed.

## States

| State | Shown | Covered by |
|---|---|---|
| Loading | "Loading saved output…", busy, focus on Back | rendered test in en, zh-TW, zh-CN |
| Output | plain text, line breaks kept, scrolls inside the panel | rendered test; HTML escaped |
| No saved output | queued, running, failed, cancelled, timeout or blank output | logic tests; rendered sentence in three languages |
| Not found | 404, including another account's run; no retry | logic and rendered tests |
| Failed | other statuses and bad JSON, with Try again | logic and rendered tests |

Keyboard: recent runs are buttons; Escape and Back return to the list and focus returns to that run; no transition, so reduced motion needs nothing extra.

## Gates (rerun by the control plane under Node 22.14.0)

- npx tsc --noEmit: exit 0.
- npm test: 898 passed, 0 failed.
- Office tests (npx tsx --test components/office/*.test.ts* lib/office/*.test.ts, which npm test does not run): 65 passed, 0 failed.
- npm run build: exit 0; frontend/tsconfig.tsbuildinfo restored.

Cursor: grok-4.7-high requested, resolved Grok 4.7 256K High; its own gates matched (Node 24.22.1).

## Design

Impeccable and Emil Kowalski skills read by the worker. Applied: the detail stays inside the existing panel, DESIGN.md slate surfaces and indigo focus rings, a text loading line, the red alert with retry for failures, quiet slate sentences for empty and not found; the swap is instant with no motion for a repeated keyboard action; focus moves to Back on open and back to the run on close.

## Live check

Owed at the next staging deploy and written into STAGING-DEPLOY-CONN-01's scope: Tab and Enter open a recent run's saved output with its line breaks; a run with no output, another account's run and a failed request show their states; Back and Escape return focus to the run.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored), UI 9/9 (5: DESIGN.md followed; 9: live check owed at the next deploy, recorded in STAGING-DEPLOY-CONN-01)
FOLLOWUPS: 0 registered / 4 superseded / 0 dropped / 0 undisposed (superseded: npm test omits office, lib/office and hooks tests, by FE-TEST-COVERAGE-01; an open run detail does not refresh, and the current-run block does not open output, both by OFFICE-02; the live check by STAGING-DEPLOY-CONN-01)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED.
