# PRIVATE-BETA-FUNCTIONAL-READINESS-02 — Staging Workspace and Session Creation Smoke Runbook

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-02
**Title:** Staging Workspace and Session Creation Smoke
**Status:** ACTIVE — Step 1: registration and runbook creation COMPLETE — Step 2: Keith manual browser smoke PENDING
**Predecessor:** PRIVATE-BETA-FUNCTIONAL-READINESS-01 (COMPLETE — 2026-08-06) — Audit: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-01-AUDIT.md`
**Risk:** MEDIUM — browser-only verification — may create persistent staging project/session records — does NOT enable AI execution — no server or configuration changes
**Date created:** 2026-08-06
**Approval:** Keith approved registration on 2026-08-06
**Author:** Cursor / Grok (documentation/governance only — no source code changed — no commands run — no terminal, Git, browser, runtime, environment, or invitation action)

---

## 1. Purpose

Prove the smallest functional staging prerequisite short of AI execution (Journey 1 subset from the functional readiness audit):

User logs in → creates or opens a project → workspace loads with an active session → file tree and editor load → page refresh reconnects successfully.

This smoke does **not** enable or test AI execution.

Keith executes all steps manually in a browser on `https://staging.ainow.biz`.

No server changes, SSH, migrations, environment changes, source edits, or user invitations are required or permitted.

---

## 2. Pre-Conditions Before Starting

- [ ] You have a valid staging account (email/password — the account used in prior staging smoke).
- [ ] Target URL for workspace smoke: `https://staging.ainow.biz/en/app`
- [ ] The HTTPS lock is visible in your browser.
- [ ] No localhost URL appears anywhere in the address bar throughout the smoke.
- [ ] Browser DevTools Network panel is open (to watch for HTTP 5xx).
- [ ] AI execution remains disabled (`GLOBAL_EXECUTION_ENABLED=false`) — do **not** attempt to change this.
- [ ] Do **not** submit AI prompts, trigger builds/previews, create checkpoints, or invite users.

---

## 3. Persistent Staging Records Warning

> **Important:** This smoke may create persistent project and/or session records in the staging database.
>
> Do **not** test deletion unless a safe delete function is already clearly available in the UI and you record that you used it. Deletion is **not** part of this approved runbook.
>
> Use only disposable, non-personal names below. Do not use personal names or personal information.

**Test naming (use the actual execution date and time):**

```text
Project: staging-workspace-smoke-YYYYMMDD-HHMM
Session (where user-selectable): staging-session-smoke-YYYYMMDD-HHMM
```

Example if executed at 2026-08-06 14:30:

```text
staging-workspace-smoke-20260806-1430
staging-session-smoke-20260806-1430
```

---

## 4. Explicit Non-Goals

Do **not** test or enable:

- AI prompt submission
- AI execution
- File changes by AI
- Preview / build generation
- Git checkpoint / revert
- Billing or payments
- Multi-agent collaboration
- User invitations

These require later tasks (including PRIVATE-BETA-FUNCTIONAL-READINESS-03 and PRIVATE-BETA-INVITE-01, neither of which is authorized by this smoke).

---

## 5. Gate 1 — Login

1. Navigate to: `https://staging.ainow.biz/en/login`
2. Log in with the staging email/password account.
3. Confirm:
   - [ ] Login succeeds.
   - [ ] You land on an authenticated area (commonly `/en/app` or equivalent authenticated route).
   - [ ] Address bar shows `https://staging.ainow.biz/...` — no localhost.
   - [ ] HTTPS lock is visible.
   - [ ] No visible application error toast/banner blocks the page.

**Record:** PASS / FAIL. Final URL after login: _______________

---

## 6. Gate 2 — Create or Open Disposable Project

1. Navigate to (or remain on): `https://staging.ainow.biz/en/app`
2. Either:
   - **Preferred:** Create a new disposable project named exactly:
     `staging-workspace-smoke-YYYYMMDD-HHMM` (actual date/time), **or**
   - Open an existing disposable staging smoke project from a prior attempt if clearly labeled and disposable.
3. If the UI asks for a session name and it is user-selectable, use:
   `staging-session-smoke-YYYYMMDD-HHMM` (actual date/time).
4. Confirm:
   - [ ] Project create or open succeeds without a blocking error.
   - [ ] You are taken into the workspace for that project (or the workspace begins loading for it).

**Record:**
- Action taken: CREATE / OPEN
- Project name used: _______________
- Session name used (if any): _______________
- Result: PASS / FAIL

---

## 7. Gate 3 — Workspace Shell Loads

1. Confirm the workspace shell is visible for the selected project.
2. Confirm:
   - [ ] Workspace chrome/panels load (not a blank page, not stuck forever on a hard error screen).
   - [ ] Address bar remains on `https://staging.ainow.biz/...` — no localhost.
   - [ ] HTTPS lock remains visible.
   - [ ] No visible application error blocks the shell.

**Record:** PASS / FAIL. Notes: _______________

---

## 8. Gate 4 — Active Session Created or Reconnected

1. Observe session indicators in the workspace (sidebar, status text, or equivalent active-session UI).
2. Confirm:
   - [ ] An active session is created, or an existing session reconnects successfully.
   - [ ] The UI does not remain indefinitely in a failed/error session state.
   - [ ] No visible application error indicates session start failure.

**Record:** PASS / FAIL. Session observation notes (no secrets): _______________

---

## 9. Gate 5 — File Tree Visible

1. Locate the workspace file tree / file navigation panel.
2. Confirm:
   - [ ] File tree is visible.
   - [ ] At least one file or folder entry is visible (non-empty tree preferred; if empty, record as PARTIAL and note whether that appears expected for a brand-new project).

**Record:** PASS / FAIL / PARTIAL. Notes: _______________

---

## 10. Gate 6 — Open One Existing File in Editor

1. Click/open at least one existing file from the file tree.
2. Confirm:
   - [ ] The editor opens the selected file.
   - [ ] Editor content loads (readable text/content appears; not permanently blank/spinner-only).
   - [ ] No visible application error occurs while opening the file.

**Record:**
- File path/name opened: _______________
- Editor content loaded: PASS / FAIL
- Result: PASS / FAIL

---

## 11. Gate 7 — No Visible Application Error / No HTTP 5xx

1. Confirm no visible application error toast, banner, or blocking error state remains on screen.
2. In DevTools → Network:
   - [ ] No HTTP 5xx responses appear for requests related to this smoke flow.
3. Note: 4xx responses that are expected for disabled AI execution (for example a later untested execute path) are out of scope — do **not** submit AI prompts. This gate is about errors during login → project/session → file tree → editor.

**Record:**
- Visible application error: YES / NO
- HTTP 5xx observed: YES / NO
- If YES, list method/path/status only (no cookies, tokens, or response bodies with secrets): _______________
- Result: PASS / FAIL

---

## 12. Gate 8 — Page Refresh Reconnect

1. Refresh the page (F5 / Ctrl+R / Cmd+R) while remaining on the workspace for the same project.
2. Confirm:
   - [ ] The same project/session reconnects (or the workspace restores into the same project with a usable active/reconnected session).
   - [ ] File tree remains visible and usable after refresh.
   - [ ] Editor remains usable after refresh (re-open the same or another file if needed and confirm content loads).
   - [ ] No visible application error blocks reconnect.
   - [ ] No new HTTP 5xx appears in the Network panel during reconnect.
   - [ ] Address bar remains on `https://staging.ainow.biz/...` — no localhost.

**Record:** PASS / FAIL. Notes: _______________

---

## 13. Evidence Capture Template

Copy and fill after the smoke:

```text
PRIVATE-BETA-FUNCTIONAL-READINESS-02 — Staging Workspace/Session Smoke Evidence
Date/time (local): YYYY-MM-DD HH:MM
Operator: Keith
URL: https://staging.ainow.biz/en/app

Gate 1 — Login:
  Result: PASS / FAIL
  Final URL: _______________

Gate 2 — Create or open disposable project:
  Action: CREATE / OPEN
  Project name: staging-workspace-smoke-YYYYMMDD-HHMM
  Session name (if any): staging-session-smoke-YYYYMMDD-HHMM
  Result: PASS / FAIL

Gate 3 — Workspace shell loads:
  Result: PASS / FAIL
  Notes:

Gate 4 — Active session created or reconnected:
  Result: PASS / FAIL
  Notes:

Gate 5 — File tree visible:
  Result: PASS / FAIL / PARTIAL
  Notes:

Gate 6 — Open one existing file / editor content loads:
  File opened: _______________
  Editor content loaded: PASS / FAIL
  Result: PASS / FAIL

Gate 7 — No visible app error / no HTTP 5xx:
  Visible application error: YES / NO
  HTTP 5xx observed: YES / NO
  Details (method/path/status only): _______________
  Result: PASS / FAIL

Gate 8 — Page refresh reconnect:
  Same project/session reconnects: PASS / FAIL
  File tree usable after refresh: PASS / FAIL
  Editor usable after refresh: PASS / FAIL
  Result: PASS / FAIL

Persistent staging records may have been created: YES / NO / UNKNOWN
Deletion tested: NO (not in approved runbook)

AI prompt submitted: NO
AI execution enabled/changed: NO
Users invited: NO

Overall smoke verdict: PASS / FAIL / PARTIAL
Blocking defects found: YES / NO
[If YES, list each defect with short description]
```

---

## 14. Completion Criteria

Step 2 (Keith manual browser smoke) may be treated as complete for consolidation only after Keith reports the filled evidence template.

Step 3 (evidence consolidation and readiness decision) must then:

1. Record PASS / FAIL / PARTIAL against all required gates.
2. Record whether persistent staging project/session records were likely created.
3. Confirm AI execution remained disabled.
4. Confirm no users were invited.
5. Decide whether Journey 1 workspace/session prerequisite is proven enough to consider a later PRIVATE-BETA-FUNCTIONAL-READINESS-03 registration — that later task still requires separate Keith approval and is **not** authorized by a PASS here alone.
6. PRIVATE-BETA-INVITE-01 remains unregistered — no invitation is authorized by this smoke.

If any required gate records FAIL due to a blocking defect, register a bounded fix task before claiming functional readiness progress.

---

## 15. Workflow Summary

| Step | Owner | Status |
|---|---|---|
| Step 1: Registration and runbook creation | Cursor | **COMPLETE — 2026-08-06** |
| Step 2: Keith manual browser smoke execution | Keith | **PENDING** |
| Step 3: Evidence consolidation and readiness decision | Cursor + Keith | PENDING (after Step 2) |

---

## 16. Tool Boundaries — What Keith Does NOT Need to Do

- No SSH.
- No AWS CLI.
- No Docker, PostgreSQL, or Redis.
- No PM2 or systemd commands.
- No migrations.
- No environment file changes.
- No source code changes.
- No git operations.
- No AI execution enablement.
- No billing/payment actions.
- No user invitations.
- No project/session deletion unless a safe delete function is already clearly available (not required by this runbook).

Keith only opens a browser, navigates to `https://staging.ainow.biz`, and follows this runbook.

---

## 17. Safety Confirmations (Registration / Runbook Step)

- ✅ No source code changed
- ✅ No `.env*` files opened or changed
- ✅ No env values printed or recorded
- ✅ No runtime/server action taken
- ✅ No SSH/AWS CLI/PM2/systemd/Caddy action
- ✅ No Docker/PostgreSQL/Redis action
- ✅ No terminal or Git commands run
- ✅ No browser smoke performed in this registration step
- ✅ No login / project / session creation performed in this registration step
- ✅ No subagents used
- ✅ No locked checkpoint modified
- ✅ No migrations or entities changed
- ✅ No users invited
- ✅ No AI execution enabled
- ✅ No billing or payment action

---

**Document created:** 2026-08-06
**Task status:** ACTIVE — Step 1 COMPLETE — Step 2 PENDING
**Next action:** Keith executes this runbook on staging and reports the evidence template
