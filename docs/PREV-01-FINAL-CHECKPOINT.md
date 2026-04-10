# PREV-01 FINAL CHECKPOINT — Preview Availability Diagnostics and Fix Wave

## Purpose

This checkpoint records the completion of the full PREV-01 preview diagnosis and fix wave. It covers the initial diagnosis (PREV-01-01), the backend source-of-truth fix (PREV-01-02), and the frontend start-preview action (PREV-01-03). No new task is being started in this step.

---

## Scope of Completed Wave

All work was scoped to the existing preview path — no new features, no architectural changes, and no broad preview redesign.

Services/surfaces touched:
- `services/container-manager/src/preview/preview.service.ts`
- `services/container-manager/src/preview/preview.controller.ts`
- `services/container-manager/src/preview/preview.module.ts`
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/app/[locale]/app/page.tsx`

---

## Completed Task List

| Task ID | Title | Status |
|---------|-------|--------|
| PREV-01-01 | Diagnose Preview Unavailable For AI-Created Files | COMPLETE and LOCKED |
| PREV-01-02 | Fix Preview Start Source Of Truth For Session Workspace | COMPLETE and LOCKED |
| PREV-01-03 | Add Preview Start Action In Workspace UI | COMPLETE and LOCKED |

---

## Grouped Summary

### Preview Diagnosis (PREV-01-01)

Identified the exact preview gating failure: `container-manager`'s `PreviewService` was reading from the host-mounted workspace directory, not the actual session container filesystem. Files written via the AI/file-write path existed inside the session container but were invisible to preview start detection. Preview status correctly showed `running: false` given the contract, but the source of truth was wrong.

### Preview Source-of-Truth Fix (PREV-01-02)

Aligned `PreviewService` framework detection and preview launch to inspect and operate directly within the session container via Docker exec. Added a bounded static-HTML serving fallback: for `framework === "Static HTML"`, preview start marks status running immediately and the proxy endpoint reads and serves the file directly from the session container filesystem. No proxying to an in-container HTTP server is required for static HTML.

### Frontend Start Preview Action (PREV-01-03)

Added a visible `Start Preview` button in the workspace preview panel, enabled only when a session is selected and preview state is `unavailable`. Wired to `POST /api/preview/:sessionId/start` with `Bearer` token auth. On success, refreshes preview status via the existing `refreshPreviewForSession` path so the normal preview rendering path takes over. Existing `Refresh` button behavior is unchanged.

---

## Preserved Invariants

- No backend session, auth, or billing behavior was changed.
- No broad preview/workspace redesign was introduced.
- Existing `/api/preview/:sessionId/status`, `/start`, and `/proxy` endpoint contracts are preserved.
- All existing frontend workspace shell tests pass (160/160).

---

## End-to-End Result

Preview now works end-to-end for a session containing `index.html`:

- `POST /api/sessions/:id/files/write` → writes `index.html` to session container.
- `GET /api/preview/:sessionId/status` → `running: false` before start (correct).
- `POST /api/preview/:sessionId/start` → HTTP 200, `framework: "Static HTML"`, `status: "running"`.
- `GET /api/preview/:sessionId/status` → `running: true`.
- `GET /api/preview/:sessionId/proxy` → HTTP 200, returns `index.html` content.

The UI `Start Preview` button triggers this flow. The previous refresh-only dead-end is removed.

---

## Final Family Status

**PREV-01 family: COMPLETE and LOCKED.**
