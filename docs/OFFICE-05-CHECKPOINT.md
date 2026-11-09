# OFFICE-05 — Checkpoint

**Task:** OFFICE-05 — Collaboration in the office (team desks show hand-offs)
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by GOV-ONE-PLAN-01 (79d2c6264eb4e82041e24b4c47c5b32e5f0a87e4); admitted by Keith to Lane 2 in b7d4a3073344e4a2b7613832881cd388bad1a403. Code and LOCK in one record (GOV-OS-04, LOCAL-TESTS). Plan: docs/AGENT-OPS-PLAN.md section 0 (item 13, now removed from the list).

## What changed

- frontend/lib/office/office.logic.ts: team runs map to one desk per role from builderProfileId (lead, writer, reviewer; chief-of-staff, product-strategy and technology-advisor use their station desk when it is active; advisors-lead; unknown ids stay on the single Team desk); hand-off response parsing; a small state machine so the badge does not flicker on refresh; selection of which collaboration runs to read (all active ones, plus recent ones that finished within 24 hours, at most five, newest first).
- frontend/hooks/useOfficeHandoffs.ts (new): GET /api/collaboration/runs/:id for those runs, on the office's existing refresh (poll, tab visible, Refresh, Try again); no new timer; nothing while the tab is hidden.
- frontend/components/office/office-screen.tsx, office-desk.tsx, office-desk-panel.tsx: role names from the Team page's existing keys, an amber clock badge (Heroicons v2 Outline ClockIcon) on the desk and in the panel, the loading line, the failure notice with Try again, and the existing Team page link for approve, reject and edit. No approval control in the office.
- Tests: frontend/lib/office/office.logic.test.ts and frontend/components/office/office-screen.test.tsx.
- frontend/messages/en.json, zh-TW.json, zh-CN.json: office.handoffLoading and office.handoffLoadError; the badge reuses collaboration.statusPendingApproval.

No backend change: the run list already carries collaborationRunId and builderProfileId (RUN-LIST-COLLAB-01) and the collaboration run route is owner-checked for entitled users (services/api-gateway/src/orchestration/collaboration.controller.ts:261-282). A user without collaboration access (403) keeps today's single Team desk and sees no error. Not deployed.

## Review finding fixed before LOCK

The first version read only active runs. A hand-off waiting for approval usually has no active run (the member that wrote it has finished), so the badge would rarely show. The control plane sent it back; the read now also covers recent runs of the last 24 hours (hand-offs expire after 24 hours), at most five. Tests cover a waiting hand-off found only in the recent list, a run older than 24 hours left out, and the cap of five.

## Gates (rerun by the control plane under Node 22.14.0)

- npx tsc --noEmit: exit 0.
- npm test: 898 passed, 0 failed.
- Office tests (npx tsx --test components/office/*.test.ts* lib/office/*.test.ts): 83 passed, 0 failed (65 at OFFICE-06, plus 18).
- npm run build: exit 0; frontend/tsconfig.tsbuildinfo restored.

Cursor: grok-4.7-high requested for both runs, resolved Grok 4.7 256K High; its gates matched (Node 24.22.1).

## Design

Impeccable and Emil Kowalski skills read by the worker. Applied: the office's slate field and DESIGN.md's amber warning treatment for the badge; no new card, gradient or motion (the badge is visible whenever the office is open, so it does not animate); the badge stays through a refresh until the new read lands; the loading line is a sentence; failures use the office's existing alert and keep the desks.

## Live check

Owed at the next staging deploy, written into STAGING-DEPLOY-CONN-01's scope: separate role desks in all three languages; the waiting badge on a run whose hand-off waits for approval, including after the member finished; Open goes to the Team page; no approve, reject or edit control in the office.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored), UI 9/9 (5: DESIGN.md followed; 9: live check owed at the next deploy, recorded in STAGING-DEPLOY-CONN-01)
FOLLOWUPS: 0 registered / 4 superseded / 0 dropped / 0 undisposed (superseded: the live check, by STAGING-DEPLOY-CONN-01; a new waiting hand-off shows only after Refresh or returning to the tab while the office is idle, by OFFICE-02; a user without collaboration access briefly sees role desks before the 403 folds them, by ACCESS-READY-01; the advisors-lead desk shows the Chief of Staff name, by OFFICE-03)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED.
