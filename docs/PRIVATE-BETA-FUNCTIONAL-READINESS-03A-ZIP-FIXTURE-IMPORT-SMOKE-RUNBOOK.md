# PRIVATE-BETA-FUNCTIONAL-READINESS-03A — Disposable ZIP Fixture Import Smoke Runbook

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-03A
**Title:** Disposable ZIP Fixture Import Smoke
**Status:** ACTIVE — Step 1 COMPLETE (registration + ZIP-path investigation + runbook) — Route/access amendment COMPLETE (2026-08-06) — Step 2 PENDING (Keith fixture creation + manual browser smoke) — Step 3 NOT STARTED
**Outcome (registration):** **A — ZIP import is supported**
**Outcome (route/access amendment):** **Navigation path exists (no dedicated URL)** — corrected project-first UX path recorded below
**Predecessor:** PRIVATE-BETA-FUNCTIONAL-READINESS-03 (ACTIVE / BLOCKED — Outcome B) — Investigation: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-03-STAGING-FILE-TREE-EDITOR-SMOKE-RUNBOOK.md`
**Related:** PRIVATE-BETA-FUNCTIONAL-READINESS-02 (COMPLETE and LOCKED — PARTIAL) — Checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-02-CHECKPOINT.md`
**Risk:** MEDIUM — browser-only verification after local disposable ZIP creation — may create persistent staging project/session/file records — does NOT enable AI execution — no server or configuration changes — no product source changes
**Date created:** 2026-08-06
**Amended:** 2026-08-06 — project-first UX route/access correction after Keith reported the prior History menu wording was not visible
**Approval:** Keith approved registration on 2026-08-06
**Author:** Cursor / Grok (documentation/governance only — no source code changed — no commands run — no terminal, Git, browser, runtime, environment, upload, or invitation action)

---

## 1. Purpose

Prove, without enabling AI execution and without changing product source behavior:

Import a tiny disposable ZIP containing one text file → workspace opens → file tree shows the file → editor loads its contents → refresh preserves usability.

Keith creates the disposable ZIP locally, then executes all browser steps manually on `https://staging.ainow.biz`.

This runbook does **not** enable AI, seed welcome files in product source, use SSH/DB/filesystem seeding, or invite users.

---

## 2. Registration Investigation Summary (Outcome A)

Confirmed from current source/UI (PR-02-01 import/export path):

| Question | Finding |
|---|---|
| Creates new project? | **No.** Import updates the **active session workspace only**. A project + active session must already exist. |
| Requires active session? | **Yes.** Frontend refuses import without `selectedSessionId`. Backend `POST /api/sessions/:id/import` requires session-cookie auth, session ownership, and a non-terminated session. |
| Accepted archive type | `.zip` only (`accept=".zip,application/zip"`; backend rejects non-`.zip` names). Multipart field name: `archive`. |
| Size / count limits | Upload max **5 MB**; max **500** files; max total extracted **20 MB**; max per-file **512 KB**. |
| Path / content rules | Relative paths only (no `..`, no absolute paths); UTF-8 text only; compression methods **store (0)** or **deflate (8)**; empty archives rejected. |
| Import behavior | Clears existing workspace contents under `/workspace`, then writes decoded files. Safe for an empty FR-02-style disposable project. |
| Single `README.md` text file supported? | **Yes.** Matches accepted type, size, path, and UTF-8 rules. |

**API path:** `POST /api/sessions/:sessionId/import` (SessionCookieGuard; ownership enforced).

**Previously recommended (not registered) welcome-file seed 03A** from FR-03 Outcome B is **superseded** by this ZIP-fixture 03A registration. No welcome-file source change is authorized by this task.

---

## 2A. Route / Access Amendment (2026-08-06) — project-first UX

Keith reported that the new project-first UX does **not** show a top-level path labeled:

`History → History & Controls → Project Snapshots → Import Project`

Source-only re-investigation (no browser, no guessed URLs):

| Question | Finding |
|---|---|
| Direct authenticated frontend URL for Import Project? | **No.** No dedicated import page/route exists. Host page remains `/{locale}/app` only (`frontend/app/[locale]/app/page.tsx`). `/{locale}/projects` and `/{locale}/gallery` redirect to `/{locale}/app`. |
| Standalone route? | **No.** Import is **not** a standalone page. It is embedded inside `HistorySnapshotPanel` (not `HistoryProjectPanel`) within `makeHistoryAndDashboardContent()` in `workspace-shell.tsx`. |
| Query parameter / hash to open import? | **No.** `app/page.tsx` does not read search params for history/import. `historyPanelOpen` is local React `useState(false)` only. |
| Feature flag that changes layout? | `NEXT_PUBLIC_PROJECT_FIRST_UX === 'true'` enables project-first shell. Staging uses this path. Turning the flag off would restore the legacy always-visible history strip, but that is an **env/build change**, not a user navigation path for this smoke. |
| Nested panel state that exposes Import? | **Yes.** In project-first `workspaceView === 'project'`, click the AI chat panel clock button (`data-testid="workspace-history-drawer-toggle"`, aria-label **Open history**) to set `historyPanelOpen=true`. That reveals `history-control-slice`, including **Project Snapshots** → **Import Project**. AI panel must not be collapsed (`workspace-ai-panel-collapse-toggle` / Expand panel). |
| Other ZIP import entry point in new UX? | **None found.** Not in sidebar, Advanced drawer, home/projects/templates views, project cards, editor, preview, or build tabs. |

**Exact supported navigation path (project-first UX — no dedicated URL):**

1. Authenticated host: `https://staging.ainow.biz/en/app`
2. Open/create a disposable project so `workspaceView === 'project'` (`data-testid="workspace-project-view"`).
3. Ensure the left AI panel is visible (if collapsed, click **Expand panel** / `workspace-ai-panel-collapse-toggle`).
4. In the AI chat panel header, click the **clock** icon button (**Open history** / `workspace-history-drawer-toggle`).
5. Chat content hides; history content shows (`workspace-ai-panel-history-content`).
6. Scroll within History & Controls (`history-control-slice`) to **Project Snapshots** (`history-snapshot-surface`).
7. Use amber **Import Project** (`history-archive-import-label` / `history-archive-import-input`).

Do **not** look for a sidebar “History” nav item — that label path does not exist in project-first UX.

---

## 3. Pre-Conditions Before Starting

- [ ] You have a valid staging account (email/password — same account family used in prior staging smokes).
- [ ] Target workspace URL: `https://staging.ainow.biz/en/app`
- [ ] The HTTPS lock is visible in your browser.
- [ ] No localhost URL appears anywhere in the address bar throughout the smoke.
- [ ] Browser DevTools Network panel is open (to watch for HTTP 5xx).
- [ ] AI execution remains disabled (`GLOBAL_EXECUTION_ENABLED=false`) — do **not** attempt to change this.
- [ ] Disposable ZIP fixture prepared locally (Section 4) before opening Import Project.
- [ ] Do **not** submit AI prompts, trigger builds/previews, create/restore checkpoints, save snapshots, invite users, or use SSH/AWS/Docker/DB edits.

---

## 4. Disposable ZIP Fixture Specification (Keith creates locally)

Create this fixture on your local machine **before** the browser import step. Do **not** ask Cursor/agents to create it during registration.

**ZIP filename (use actual execution date and time):**

```text
staging-file-tree-smoke-YYYYMMDD-HHMM.zip
```

Example if executed at 2026-08-06 10:15:

```text
staging-file-tree-smoke-20260806-1015.zip
```

**ZIP contents (exactly one file at archive root):**

```text
README.md
```

**README.md exact contents:**

```text
# Staging File Tree Smoke

Disposable non-personal test file for staging workspace verification.
```

**Fixture rules:**

- Include only `README.md` — no nested folders required.
- Do **not** include personal information, credentials, secrets, executables, dependencies, `node_modules`, `.git`, `__MACOSX`, or nested projects.
- Prefer a plain ZIP created with Windows Explorer “Compress to ZIP” / equivalent so the entry path is `README.md` (not `folder/README.md`).
- Confirm the ZIP is well under 5 MB (it will be tiny).

**Record before import:**

- ZIP filename used: _______________
- Local creation method: _______________

---

## 5. Persistent Staging Records Warning

> **Important:** This smoke may create persistent project, session, and workspace-file records in the staging database / container workspace.
>
> Do **not** test deletion unless a safe delete function is already clearly available in the UI and you record that you used it. Deletion is **not** part of this approved runbook.
>
> Use only disposable, non-personal names below.

**Disposable project naming (use actual execution date and time):**

```text
Project: staging-file-tree-smoke-YYYYMMDD-HHMM
Session (where user-selectable): staging-file-tree-session-YYYYMMDD-HHMM
```

You may reopen an existing FR-02 disposable empty project if clearly labeled and disposable; prefer a fresh disposable project named as above.

---

## 6. Explicit Non-Goals

Do **not** test or enable:

- AI prompt submission or AI execution
- AI file creation or modification
- Preview / build generation
- Git checkpoint / revert
- Snapshot save/restore (except noticing the Import Project control lives in the same History surface)
- Billing or payments
- Multi-agent collaboration
- User invitations
- Preview 404 diagnosis or repair
- Product source welcome-file seeding
- SSH, AWS CLI, Docker, PostgreSQL, Redis, migrations, or env edits

---

## 7. Gate 1 — Login

1. Navigate to: `https://staging.ainow.biz/en/login`
2. Log in with the staging email/password account.
3. Confirm:
   - [ ] Login succeeds.
   - [ ] You land on an authenticated area (commonly `/en/app` or equivalent).
   - [ ] Address bar shows `https://staging.ainow.biz/...` — no localhost.
   - [ ] HTTPS lock is visible.
   - [ ] No visible application error toast/banner blocks the page.

**Record:** PASS / FAIL. Final URL after login: _______________

---

## 8. Gate 2 — Open Supported ZIP Import Path (project + active session)

ZIP import does **not** create a project. Open or create a disposable project first, then wait for an active session.

1. Navigate to (or remain on): `https://staging.ainow.biz/en/app`
2. Create a new disposable project named:
   `staging-file-tree-smoke-YYYYMMDD-HHMM`
   **or** open an existing clearly disposable empty staging smoke project.
3. If the UI asks for a session name and it is user-selectable, use:
   `staging-file-tree-session-YYYYMMDD-HHMM`
4. Confirm workspace shell loads and an active session starts or reconnects (FR-02 Gates 3–4 path).
5. Confirm:
   - [ ] Project create/open succeeds without a blocking error.
   - [ ] Workspace shell is visible.
   - [ ] An active (non-terminated) session is selected / connected.
   - [ ] No blocking application error.

**Record:**

- Action taken: CREATE / OPEN
- Project name used: _______________
- Session name used (if any): _______________
- Active session observed: YES / NO
- Result: PASS / FAIL

---

## 9. Gate 3 — Import Disposable ZIP (project-first exact path)

There is **no** dedicated Import URL. Use only this in-app navigation:

1. Confirm you are in project view (`workspace-project-view`) with an active session (Gate 2).
2. If the left AI panel is collapsed, click **Expand panel** (`workspace-ai-panel-collapse-toggle`) so the AI chat panel is visible.
3. In the AI chat panel header (top-right of the chat panel, **not** the project page header and **not** the sidebar), click the **clock** icon:
   - aria-label / title: **Open history**
   - `data-testid="workspace-history-drawer-toggle"`
4. Confirm chat content hides and history content shows (`workspace-ai-panel-history-content`).
5. Scroll inside History & Controls (`history-control-slice`) until you see **Project Snapshots** (`history-snapshot-surface`).
   - Do **not** expect a sidebar item named “History”.
   - `HistoryProjectPanel` (“My Projects” / workspace admin) is a different subsection; Import lives under **Project Snapshots** (`HistorySnapshotPanel`).
6. Click amber **Import Project** (`history-archive-import-label`).
7. Choose the local disposable ZIP:
   `staging-file-tree-smoke-YYYYMMDD-HHMM.zip`
8. Wait for import feedback (UI may show **Importing...**, then success such as “Workspace archive imported.”).
9. Confirm:
   - [ ] Clock **Open history** control was found and toggled.
   - [ ] **Project Snapshots** / **Import Project** became visible after opening history.
   - [ ] Import completes without a blocking error.
   - [ ] No HTTP 5xx for `POST /api/sessions/<session-id>/import` in DevTools Network.
   - [ ] File tree refreshes (or becomes non-empty).

**Record:**

- Open history control found: YES / NO
- Project Snapshots / Import Project visible after toggle: YES / NO
- ZIP filename imported: _______________
- Import UI result: PASS / FAIL
- Observed success/error message (if any): _______________
- Import request HTTP status (if visible): _______________

If the clock **Open history** control or **Import Project** control cannot be found after these exact steps, stop and record Gate 3 FAIL — do not invent alternate URLs, API calls, SSH/DB seeding, or AI file creation.

---

## 10. Gate 4 — File Tree Shows `README.md`

1. Inspect the workspace file tree.
2. Confirm:
   - [ ] `README.md` appears in the file tree.
   - [ ] No blocking application error.

**Record:** PASS / FAIL. File tree notes: _______________

---

## 11. Gate 5 — Editor Loads Exact Contents

1. Open `README.md` from the file tree.
2. Confirm the editor shows **exactly**:

```text
# Staging File Tree Smoke

Disposable non-personal test file for staging workspace verification.
```

3. Confirm:
   - [ ] Readable content loads in the editor.
   - [ ] Content matches the fixture exactly (no truncation / corruption observed).
   - [ ] No blocking application error.
   - [ ] No HTTP 5xx during open/read in DevTools Network for this gate.

**Record:** PASS / FAIL. Content match: YES / NO. Notes: _______________

---

## 12. Gate 6 — Approved Flow / No In-Scope HTTP 5xx

Review DevTools Network for the gates above only.

1. Confirm:
   - [ ] No HTTP 5xx during login, project open/create, session start/reconnect, ZIP import, file tree load, or editor open.
2. Out-of-scope expected noise (do **not** treat as 03A failures if observed):
   - AI HTTP **503** while execution remains disabled (expected policy).
   - Preview `GET /api/preview/<session-id>/status` HTTP **404** (separate unresolved FR-02 finding; not in scope).

**Record:** PASS / FAIL. In-scope 5xx observed: YES / NO. Notes: _______________

---

## 13. Gate 7 — Refresh Preserves Project/Session and `README.md`

1. Refresh the page (browser reload).
2. Confirm:
   - [ ] Same disposable project/workspace returns (or is still selected/openable without recreating).
   - [ ] Session reconnects / remains usable.
   - [ ] `README.md` remains visible in the file tree.
   - [ ] Opening `README.md` still loads the same readable content.
   - [ ] No blocking application error.
   - [ ] No new in-scope HTTP 5xx during refresh/reconnect/open.

**Record:** PASS / FAIL. Post-refresh notes: _______________

---

## 14. Overall Verdict Template (Keith fills after Step 2)

| Gate | Result |
|---|---|
| 1 Login | PASS / FAIL |
| 2 Project + active session (import path ready) | PASS / FAIL |
| 3 ZIP import | PASS / FAIL |
| 4 File tree shows `README.md` | PASS / FAIL |
| 5 Editor exact content | PASS / FAIL |
| 6 No in-scope HTTP 5xx | PASS / FAIL |
| 7 Refresh preserves usability | PASS / FAIL |
| **Overall** | PASS / FAIL / PARTIAL |

Persistent records created/updated (if known): _______________

Do **not** invite users. Do **not** enable AI. Do **not** delete projects/sessions unless a clearly safe existing UI delete path is separately documented and used.

---

## 15. Workflow Status

| Step | Status |
|---|---|
| 1. Registration, ZIP-path investigation, runbook creation | **COMPLETE — 2026-08-06** |
| 1A. Route/access amendment (project-first UX correction) | **COMPLETE — 2026-08-06** |
| 2. Keith creates disposable ZIP + manual browser smoke | **PENDING** |
| 3. Evidence consolidation | **NOT STARTED** |

---

## 16. Next Action

1. Keith creates the disposable ZIP fixture locally per Section 4.
2. Keith executes Gates 1–7 manually using the **amended project-first Open history (clock) → Project Snapshots → Import Project** path in Section 2A / Gate 3.
3. Return evidence for Step 3 consolidation.

Do **not** start Step 3 until Step 2 evidence is recorded.
Do **not** change `NEXT_PUBLIC_PROJECT_FIRST_UX` or invent a URL.

---

## 17. Related Documents

- Parent blocked investigation: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-03-STAGING-FILE-TREE-EDITOR-SMOKE-RUNBOOK.md`
- Predecessor FR-02 checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-02-CHECKPOINT.md`
- Predecessor FR-02 runbook: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-02-STAGING-WORKSPACE-SESSION-SMOKE-RUNBOOK.md`
- Roadmap: `docs/AINOW-EXECUTION-ROADMAP.md`

---

## 18. Invariants Preserved (registration step)

- No source code changed.
- No tests changed.
- No translations changed.
- No migrations run.
- No packages installed.
- No environment or runtime configuration changed.
- No server, SSH, Docker, PostgreSQL, Redis, PM2, or Caddy action performed.
- No terminal or Git commands run during this registration.
- No browser automation, login, or file upload performed during this registration.
- No disposable ZIP created by Cursor during this registration.
- No AI execution enabled.
- No users invited.
- No locked checkpoints modified.
- No secrets disclosed.
- No subagents used.
- No impossible unsupported steps invented.

---

*Executable Keith smoke checklist for PRIVATE-BETA-FUNCTIONAL-READINESS-03A. Step 1 registration/runbook only is complete until Keith finishes fixture creation and browser smoke.*
