# PRIVATE-BETA-FUNCTIONAL-READINESS-03 — Staging File-Backed Workspace Tree and Editor Smoke

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-03
**Title:** Staging File-Backed Workspace Tree and Editor Smoke
**Status:** BLOCKED after registration — 2026-08-06
**Outcome:** **B — No supported file-backed path exists**
**Predecessor:** PRIVATE-BETA-FUNCTIONAL-READINESS-02 (COMPLETE and LOCKED — 2026-08-06 — Verdict PARTIAL) — Checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-02-CHECKPOINT.md`
**Risk:** MEDIUM — registration / path investigation only — no browser smoke executable yet
**Date created:** 2026-08-06
**Approval:** Keith approved registration on 2026-08-06
**Author:** Cursor / Grok (documentation/governance only — no source code changed — no commands run — no terminal, Git, browser, runtime, environment, or invitation action)

---

## 1. Purpose

Prove, without enabling AI execution:

User opens a staging workspace containing at least one existing file → file tree displays that file → file opens in the editor → readable content loads → refresh preserves tree/editor usability.

This document records registration and the supported-path investigation. Because Outcome B applies, this file is **not** an executable Keith browser-smoke runbook.

---

## 2. Registration Result

| Item | Result |
|---|---|
| Task registered | YES |
| Step 1 — Registration + supported-path investigation | COMPLETE — 2026-08-06 |
| Step 2 — Keith manual staging browser smoke | NOT STARTED — blocked |
| Step 3 — Evidence consolidation | NOT STARTED — blocked |
| Executable browser runbook | NOT CREATED (would be impossible with current UI/source paths) |
| AI execution enabled/changed | NO |
| Users invited | NO |

---

## 3. Investigation Checklist (required order)

### 3.1 Existing disposable staging project with files

**Result: NO safe known file-backed disposable project.**

- PRIVATE-BETA-FUNCTIONAL-READINESS-02 proven that the disposable staging project created/opened for that smoke contained **no files**.
- Gate 5 PARTIAL / Gate 6 NOT TESTABLE for that reason.
- Reopening the FR-02 disposable project (or creating another empty project with the same create flow) cannot prove file tree / editor content.
- No documented staging project name/id with known existing files was recorded in FR-02 evidence.

### 3.2 UI create-from-template / starter / example / repository / built-in file source

**Result: NO supported path that yields workspace files without AI.**

Checked from current source:

| Candidate | Finding |
|---|---|
| New project create (`ProjectsService.createProject`) | Creates project metadata only (`private` visibility). Does **not** seed workspace files. |
| Live session start (`SessionsService.startSessionContainer`) | Creates an empty workspace directory and starts the container. Does **not** write a welcome/`README.md` file. |
| Legacy welcome file (`SessionsService.createSession`) | Contains unused welcome `README.md` seeding for new projects, but the live api-gateway path uses `startSessionContainer`, not that create path. FR-02 staging behavior matches empty workspace. |
| Templates & Community / public project fork (`forkPublicProject`) | Creates a new private project metadata record (`Fork of …`) only. Does **not** copy workspace files, snapshots, or archives. |
| Auth Module install | Requires an existing eligible Next.js project with `package.json`. Empty FR-02-style workspaces are ineligible (`MISSING_PACKAGE_JSON`). Not a bootstrap path for empty projects. |
| Editor “new file” create UI | No supported user-facing create-new-file control found for empty workspaces. Save path updates an already-selected file. |

### 3.3 Previously created staging smoke project with a known file

**Result: NONE documented.**

- FR-02 disposable naming pattern: `staging-workspace-smoke-YYYYMMDD-HHMM`.
- FR-02 recorded that project as empty.
- No earlier staging functional smoke documented a known file-backed disposable project usable for this task.

### 3.4 Other documented user-facing file-backed paths

**Result: NONE safe for this smoke without inventing unsupported/out-of-scope steps.**

| Candidate | Why rejected for this smoke |
|---|---|
| Workspace ZIP import (`importWorkspaceArchive` / History snapshot Import Project) | UI exists, but it requires an externally prepared zip fixture and mutates an empty workspace mid-smoke. Not “open a workspace already containing at least one existing file.” No disposable staging zip fixture is documented for this task. |
| Snapshot restore | Requires an existing file-backed snapshot. No documented staging disposable snapshot with files. |
| AI file creation / prompts | Explicitly out of scope; AI remains disabled (HTTP 503 expected policy). |
| Terminal / SSH / DB / API / filesystem seeding | Explicitly forbidden by this task’s boundaries. |

---

## 4. Why Browser Smoke Cannot Run Yet

PRIVATE-BETA-FUNCTIONAL-READINESS-03 cannot proceed to Keith manual browser smoke because:

1. New/open disposable projects start with an empty file tree on the live staging path.
2. No documented disposable staging project already contains a file.
3. Template/public fork does not copy files.
4. No other approved, user-facing, non-AI path can produce a file-backed workspace without inventing an unsupported workflow or violating task boundaries.

Creating executable browser steps now would be an impossible runbook.

---

## 5. Recommended Exact Prerequisite Task (NOT REGISTERED)

**PRIVATE-BETA-FUNCTIONAL-READINESS-03A — Seed Disposable Welcome File on New Workspace Session Start**

**Focus only:** On the live session-start path used by api-gateway → container-manager (`startSessionContainer` / new empty workspace), seed at least one disposable text file (for example `README.md`) for brand-new empty workspaces, aligning with the existing unused welcome-file logic in container-manager `createSession`, without enabling AI execution.

**In scope (proposed):**
- Bounded source change + tests for new empty workspace file seed.
- Deploy/sync to staging when separately approved.
- Confirm a new disposable project shows at least one file in the tree.

**Out of scope (proposed):**
- Do not enable AI execution.
- Do not fix preview status 404.
- Do not invite users.
- Do not broaden into template/fork file-copy redesign unless separately approved.
- Do not perform the FR-03 tree/editor browser smoke inside 03A (that remains FR-03 after the seed exists).

**Status:** Recommended only — **not registered** — requires separate Keith explicit approval before any registration or implementation.

After 03A is complete on staging, resume PRIVATE-BETA-FUNCTIONAL-READINESS-03 with an executable file-backed browser smoke runbook.

---

## 6. Explicit Non-Goals (preserved)

Do **not** test or enable in this task:

- AI prompts or execution
- AI file creation or modification
- Preview / build
- Git checkpoint or revert
- Billing or payments
- Multi-agent collaboration
- User invitations
- Preview 404 diagnosis or repair

---

## 7. Next Action

1. Keith reviews Outcome B.
2. Keith separately approves registration of **PRIVATE-BETA-FUNCTIONAL-READINESS-03A** if accepted.
3. Do **not** start Keith FR-03 browser smoke until a supported file-backed path exists.

---

## 8. Related Documents

- Predecessor checkpoint: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-02-CHECKPOINT.md`
- Predecessor runbook: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-02-STAGING-WORKSPACE-SESSION-SMOKE-RUNBOOK.md`
- Predecessor audit: `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-01-AUDIT.md`
- Roadmap: `docs/AINOW-EXECUTION-ROADMAP.md`

---

## 9. Invariants Preserved

- No source code changed.
- No tests changed.
- No translations changed.
- No migrations run.
- No packages installed.
- No environment or runtime configuration changed.
- No server, SSH, Docker, PostgreSQL, Redis, PM2, or Caddy action performed.
- No terminal or Git commands run during this registration.
- No browser automation or login performed.
- No staging projects/files created or modified.
- No AI execution enabled.
- No users invited.
- No locked checkpoints modified.
- No secrets disclosed.
- No subagents used.
- Prerequisite 03A recommended only — not registered or implemented.
- No impossible executable browser smoke steps invented.

---

*Outcome B registration record. Do not treat this file as an executable Keith smoke checklist until a supported file-backed path exists and this document is replaced/extended by an approved follow-up.*
