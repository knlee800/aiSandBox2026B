# PRIVATE-BETA-DEPLOYMENT-READINESS — Step 3 Staging Verification Smoke Runbook

**Task ID:** PRIVATE-BETA-DEPLOYMENT-READINESS-STEP-3-STAGING-SMOKE
**Title:** Staging Platform, Create Agent, Multilingual, and Mobile Verification Smoke
**Status:** ACTIVE — Step 1: registration and runbook creation COMPLETE — Step 2: Keith manual browser execution PENDING
**Parent:** PRIVATE-BETA-DEPLOYMENT-READINESS (Step 3 ACTIVE — IN EVIDENCE REVIEW)
**Risk:** MEDIUM — browser-only verification — no server or configuration changes — one persistent staging DB record (Create Agent) — no delete-agent endpoint
**Date created:** 2026-08-05
**Author:** Cursor / Sonnet 4.6 (documentation/governance only — no source code changed — no commands run — no terminal action)

---

## 1. Purpose

This runbook covers the six remaining unverified Step 3 gates identified in the evidence reconciliation:

`docs/PRIVATE-BETA-DEPLOYMENT-READINESS-STEP-3-EVIDENCE-RECONCILIATION.md`

Keith executes all steps manually in a browser on `https://staging.ainow.biz`.

No server changes, SSH, migrations, environment changes, or source edits are required.

---

## 2. Pre-Conditions Before Starting

- [ ] You are logged in to `https://staging.ainow.biz` with a valid staging account (email/password — the account used in the 04I baseline smoke).
- [ ] The HTTPS lock is visible in your browser.
- [ ] No localhost URL appears anywhere in the address bar throughout the smoke.

---

## 3. Gate 1 — Authenticated Platform Routes

Verify all three locale platform routes load correctly while authenticated.

### 3A. English platform route

1. Navigate to: `https://staging.ainow.biz/en/platform`
2. Confirm:
   - [ ] Page loads successfully (no 404, no 500, no redirect to login).
   - [ ] Address bar shows `https://staging.ainow.biz/en/platform` — no localhost.
   - [ ] HTTPS lock is visible.
   - [ ] The platform dashboard is displayed.
   - [ ] Static system agents are visible (e.g. the RPG office/town agents registered in `agent-registry.ts`).
   - [ ] UI is in English.

### 3B. Traditional Chinese platform route

1. Navigate to: `https://staging.ainow.biz/zh-TW/platform`
2. Confirm:
   - [ ] Page loads successfully.
   - [ ] Address bar shows `https://staging.ainow.biz/zh-TW/platform` — no localhost.
   - [ ] HTTPS lock is visible.
   - [ ] The platform dashboard is displayed.
   - [ ] Static system agents are visible.
   - [ ] UI locale is zh-TW (Traditional Chinese labels).

### 3C. Simplified Chinese platform route

1. Navigate to: `https://staging.ainow.biz/zh-CN/platform`
2. Confirm:
   - [ ] Page loads successfully.
   - [ ] Address bar shows `https://staging.ainow.biz/zh-CN/platform` — no localhost.
   - [ ] HTTPS lock is visible.
   - [ ] The platform dashboard is displayed.
   - [ ] Static system agents are visible.
   - [ ] UI locale is zh-CN (Simplified Chinese labels).

**Record:** PASS / FAIL / PARTIAL for each locale. Note any redirect errors or unexpected behavior.

---

## 4. Gate 2 — Workspace-to-Platform Navigation

Verify the Platform CTA in the workspace navigates correctly to the matching locale platform page.

### 4A. From the English workspace

1. Navigate to: `https://staging.ainow.biz/en/app`
2. Locate the Platform CTA (link or button that routes to the platform dashboard).
3. Confirm:
   - [ ] The Platform CTA is visible.
   - [ ] Clicking it navigates to `https://staging.ainow.biz/en/platform`.
   - [ ] No localhost URL appears in the address bar.
   - [ ] HTTPS lock is visible.

### 4B. From another locale workspace (optional spot-check)

If practical, repeat from `/zh-TW/app` → confirm it routes to `/zh-TW/platform`.

**Record:** PASS / FAIL. Note any locale mismatch or localhost leakage.

---

## 5. Gate 3 — Create Agent Staging Flow

> **Important:** This creates one persistent record in the staging database. No delete-agent endpoint exists. Use only the disposable test agent name format below. Do not use any personal name or personal information.

**Test agent name format:**

```
staging-smoke-agent-YYYYMMDD-HHMM
```

Replace `YYYYMMDD-HHMM` with the actual date and time when you perform this step (e.g. `staging-smoke-agent-20260805-1430`).

### Steps

1. Navigate to: `https://staging.ainow.biz/en/platform`
2. Open the Create Agent form (click the Create Agent CTA).
3. Confirm:
   - [ ] The Create Agent form opens without error.
4. Enter the following values:
   - **Name:** `staging-smoke-agent-YYYYMMDD-HHMM` (use actual date/time)
   - **Role:** `Staging smoke test agent`
   - **Description:** `Created during Step 3 staging verification smoke. Not a real agent.`
5. Submit the form.
6. Confirm:
   - [ ] Submission succeeds without error.
   - [ ] The new agent appears in the "Your Agents" list below the static system agents.
   - [ ] The agent name matches what you entered.
7. Refresh the browser (F5 or Cmd+R).
8. Confirm:
   - [ ] The agent still appears in "Your Agents" after refresh (confirms DB persistence).
9. Open the agent detail panel (click on the agent).
10. Confirm:
    - [ ] The detail panel displays the name, role, and description matching what you submitted.
    - [ ] No garbled or missing values.
11. Confirm:
    - [ ] Static system agents remain unchanged and still appear above or alongside "Your Agents".
    - [ ] No static agent was modified or removed.

**Record:** Exact agent name used (with timestamp) — PASS / FAIL for each step. Note that this creates a persistent staging database record.

---

## 6. Gate 4 — Multilingual Check

Verify no obvious hardcoded English appears in platform or Create Agent UI on Chinese locale routes.

### 6A. zh-TW check

1. Navigate to: `https://staging.ainow.biz/zh-TW/platform`
2. Confirm:
   - [ ] Navigation labels, headings, button text, and placeholder text are in Traditional Chinese.
   - [ ] No obvious hardcoded English UI copy appears (labels, buttons, empty states, loading/error messages).
   - [ ] Open the Create Agent form on this locale.
   - [ ] Confirm form labels and button text are in Traditional Chinese.
3. Note: User-entered agent content (name, role, description) is expected to remain in the language the user typed — this is not a defect.

### 6B. zh-CN check

1. Navigate to: `https://staging.ainow.biz/zh-CN/platform`
2. Confirm:
   - [ ] Navigation labels, headings, button text, and placeholder text are in Simplified Chinese.
   - [ ] No obvious hardcoded English UI copy appears.
   - [ ] Open the Create Agent form on this locale.
   - [ ] Confirm form labels and button text are in Simplified Chinese.

**Record:** PASS / FAIL / PARTIAL for each locale. List any specific hardcoded English strings found. Note the element and locale.

---

## 7. Gate 5 — Responsive Layout Check (~390 px)

Use browser DevTools to simulate approximately 390 px viewport width.

**How to activate DevTools responsive mode:**
- Chrome/Edge: F12 → Toggle Device Toolbar (Ctrl+Shift+M) → set width to 390
- Firefox: F12 → Responsive Design Mode → set width to 390

### 7A. Platform dashboard at ~390 px

1. Set DevTools to ~390 px width.
2. Navigate to: `https://staging.ainow.biz/en/platform`
3. Confirm:
   - [ ] Platform dashboard content is readable and accessible.
   - [ ] No content overflows horizontally without scroll.
   - [ ] No elements overlap each other unintentionally.
   - [ ] No interactive controls are clipped or inaccessible.

### 7B. Create Agent form at ~390 px

1. Open the Create Agent form at ~390 px width.
2. Confirm:
   - [ ] Form fields (Name, Role, Description) are fully visible.
   - [ ] Labels are readable.
   - [ ] Submit button is accessible.
   - [ ] No clipping or overflow issues.

### 7C. User agent list at ~390 px

1. Confirm the "Your Agents" list is readable at ~390 px.
   - [ ] Agent names and roles are not clipped unreadably.
   - [ ] The list scrolls or wraps acceptably.

### 7D. Agent detail panel at ~390 px

1. Open the detail panel for the smoke-created agent at ~390 px.
2. Confirm:
   - [ ] Name, role, and description are fully readable.
   - [ ] No overflow or clipping prevents reading the content.

### 7E. Desktop spot-check

1. Return to normal desktop width (1280–1440 px).
2. Navigate to: `https://staging.ainow.biz/en/platform`
3. Confirm:
   - [ ] Platform dashboard displays acceptably at desktop width.
   - [ ] No layout regressions compared to the 04I smoke baseline.

**Record:** PASS / FAIL / PARTIAL for each check. Describe any overflow, clipping, or inaccessible controls found.

---

## 8. Gate 6 — Support / Feedback Channel Decision (Keith Decision Item)

> This is a governance decision, not a browser defect. It is a pre-invite requirement recorded in `docs/LIMITED-PRIVATE-BETA-HANDOFF-CHECKLIST.md` Section 17.

**Decision required:**

Define the channel through which private-beta users will reach Keith or the team for support or feedback during the limited private beta.

Options (not exhaustive — Keith decides):
- A dedicated email address (e.g. support@ainow.biz or a personal address)
- A Slack or Discord server or channel
- A Telegram group
- A GitHub Discussions or Issues page
- A form or Typeform
- Another channel Keith chooses

**Do not invent the channel.** Keith defines this before the first private-beta invite is sent.

**Record:** The channel type and address/URL defined by Keith. This will be included in the Step 3 evidence consolidation.

---

## 9. Evidence Recording Template

After completing the smoke, record the following for Step 3 evidence consolidation:

```
Date/time of smoke: YYYY-MM-DD HH:MM (local)
Browser and version: [e.g. Chrome 127]
Staging account used: [redact email if preferred — just note "existing 04I test account"]

Gate 1 — Authenticated platform routes:
  /en/platform: PASS / FAIL / PARTIAL
  /zh-TW/platform: PASS / FAIL / PARTIAL
  /zh-CN/platform: PASS / FAIL / PARTIAL
  Notes: [any redirect errors or issues]

Gate 2 — Workspace → Platform CTA navigation:
  /en/app → /en/platform: PASS / FAIL
  Localhost URL appeared: YES / NO
  Notes:

Gate 3 — Create Agent staging flow:
  Agent name used: staging-smoke-agent-YYYYMMDD-HHMM
  Form opens: PASS / FAIL
  Submission succeeds: PASS / FAIL
  Agent appears in list: PASS / FAIL
  Persists after refresh: PASS / FAIL
  Detail panel correct: PASS / FAIL
  Static system agents unchanged: PASS / FAIL
  Notes:

Gate 4 — Multilingual check:
  zh-TW — no hardcoded English: PASS / FAIL / PARTIAL
  zh-CN — no hardcoded English: PASS / FAIL / PARTIAL
  Notes: [list any hardcoded English strings found]

Gate 5 — Responsive layout (~390 px):
  Platform dashboard: PASS / FAIL / PARTIAL
  Create Agent form: PASS / FAIL / PARTIAL
  User agent list: PASS / FAIL / PARTIAL
  Agent detail panel: PASS / FAIL / PARTIAL
  Desktop spot-check: PASS / FAIL / PARTIAL
  Notes: [describe any overflow, clipping, or inaccessible controls]

Gate 6 — Support/feedback channel:
  Channel defined: YES / NO
  Channel: [type and address/URL]
  Notes:

Overall smoke verdict: PASS / FAIL / PARTIAL
Blocking defects found: YES / NO
[If YES, list each defect with element, locale, and description]
```

---

## 10. Step 3 Completion Criteria

Step 3 (PRIVATE-BETA-DEPLOYMENT-READINESS) may be marked COMPLETE and Step 4 consolidation / go/no-go may begin only if:

1. All six verification gates record PASS or acceptable PARTIAL.
2. No new blocking defects are found.
3. The support/feedback channel is defined by Keith.
4. The evidence is recorded and consolidated in a Step 3 consolidation document.

If any gate records FAIL due to a blocking defect, register a bounded fix task before marking Step 3 complete.

---

## 11. Workflow Summary

| Step | Owner | Status |
|---|---|---|
| Step 1: Registration and runbook creation | Cursor | **COMPLETE — 2026-08-05** |
| Step 2: Keith manual browser smoke execution | Keith | **PENDING** |
| Step 3: Evidence consolidation and Step 3 completion decision | Cursor + Keith | PENDING (after Step 2) |

---

## 12. Tool Boundaries — What Keith Does NOT Need to Do

- No SSH.
- No AWS CLI.
- No Docker, PostgreSQL, or Redis.
- No PM2 or systemd commands.
- No migrations.
- No environment file changes.
- No source code changes.
- No git operations.
- No agent deletion (no endpoint exists).

Keith only opens a browser, navigates to `https://staging.ainow.biz`, and follows this runbook.

---

## 13. Safety Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or changed
- ✅ No env values printed or recorded
- ✅ No runtime/server action taken
- ✅ No SSH/AWS CLI/PM2/systemd/Caddy action
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No git commit or push
- ✅ No subagents used
- ✅ No locked task or checkpoint modified
- ✅ No migrations or entities changed
- ✅ No account, email, login, or invite action
- ✅ No AI, billing, payment, or provider action
- ✅ No terminal commands run

---

**Document created:** 2026-08-05
**Task status:** ACTIVE — Step 1 COMPLETE — Step 2 PENDING (Keith browser execution)
**Parent:** PRIVATE-BETA-DEPLOYMENT-READINESS — Step 3 ACTIVE — IN EVIDENCE REVIEW
**Next action:** Keith executes this runbook in browser on `https://staging.ainow.biz` and records evidence for Step 3 consolidation.
