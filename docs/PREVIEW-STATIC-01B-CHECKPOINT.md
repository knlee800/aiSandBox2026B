# PREVIEW-STATIC-01B Checkpoint — Static Preview Subdirectory Proxy Routing

**Task ID:** PREVIEW-STATIC-01B
**Family:** PREVIEW / RUNTIME / USER APP EXECUTION
**Status:** COMPLETE and LOCKED
**Checkpoint date:** 2026-06-09

---

## Problem

PREVIEW-STRATEGY-01A added `PreviewStrategyResolver`, subdirectory static HTML detection, and `appRoot` on `PreviewProcess`. Follow-up investigation needed to confirm that static preview proxy/controller routing served subdirectory assets and pages relative to the detected `appRoot`, not always `/workspace`.

Without correct subdirectory routing, linked CSS, JS, images, and page navigation for projects such as `/workspace/WorkspaceA/index.html` could fail even when strategy detection succeeded.

---

## Objective

Ensure static HTML preview requests for subdirectory projects resolve all static file paths relative to the detected `PreviewProcess.appRoot`, not always `/workspace`.

---

## Investigation Outcome

Investigation confirmed that PREVIEW-STRATEGY-01A had already implemented the required runtime static subdirectory routing behavior in container-manager:

- `PreviewService.readStaticPreviewContent` prepends detected `appRoot` when `appRoot` is not `/workspace`.
- `sanitizeStaticPath` rejects traversal attempts.
- `injectPreviewBaseTag` supports relative URLs through the preview proxy.
- `PreviewController` delegates static reads correctly for static HTML previews.
- Root and subdirectory static paths are handled by the service.

**PREVIEW-STATIC-01B itself added tests only.** No additional runtime code changes were required in `preview.service.ts`, `preview.controller.ts`, api-gateway, or frontend.

### Live smoke dependency on PREVIEW-AUTOSTART-01A

Initial PREVIEW-STATIC-01B browser smoke failures were traced to a frontend preview lifecycle/race issue, not static routing. That issue was resolved separately in **PREVIEW-AUTOSTART-01A** (COMPLETE and LOCKED — `docs/PREVIEW-AUTOSTART-01A-CHECKPOINT.md`).

Final live smoke passed after PREVIEW-AUTOSTART-01A fixed auto-start and transient `POST /start` handling.

---

## Files Changed

| File | Action |
|---|---|
| `services/container-manager/src/preview/preview.service.spec.ts` | Modified — added 11 targeted static preview routing tests |

**No runtime source files changed in PREVIEW-STATIC-01B itself.**

---

## Implementation Summary

Added 11 targeted tests in `preview.service.spec.ts` covering:

### Root static preview routing (`appRoot: /workspace`)

| Request path | Resolved container path |
|---|---|
| `/` | `index.html` |
| `/style.css` | `style.css` |
| `/assets/photo.jpg` | `assets/photo.jpg` |

### Subdirectory appRoot routing (`appRoot: /workspace/WorkspaceA`)

| Request path | Resolved container path |
|---|---|
| `/` | `WorkspaceA/index.html` |
| `/page2.html` | `WorkspaceA/page2.html` |
| `/style.css` | `WorkspaceA/style.css` |
| `/script.js` | `WorkspaceA/script.js` |
| `/images/logo.png` | `WorkspaceA/images/logo.png` |

### Additional coverage

- Base tag injection for subdirectory HTML responses
- Path traversal rejection:
  - `/../etc/passwd`
  - `/assets/../../etc/passwd`
- Content-type resolution for CSS, JS, and image assets

### Existing runtime behavior verified (from PREVIEW-STRATEGY-01A)

- Framework/dev-server proxy behavior unchanged
- Static HTML controller path unchanged
- Resolver tests unchanged and still passing

---

## Validation Results

### Container-manager preview tests

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test -- --testPathPattern="preview"
```

Result: **PASS — 59/59**

### Container-manager build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
```

Result: **PASS**

### ReadLints

Result: **PASS — no linter errors on touched files**

---

## Live Browser Smoke

**Result: PASS** (after PREVIEW-AUTOSTART-01A frontend lifecycle fix)

| Check | Result |
|---|---|
| Auto-start after Apply | yes |
| Needed Refresh | no |
| Index loaded | yes |
| JS loaded | yes |
| Navigation works | yes |
| Back to index works | yes |
| Start Preview after auto-start | ok |
| Refresh works | yes |
| Visible error | none |

**CSS note:** One final smoke run did not visibly show CSS styling, but a previous run did. This is not considered a PREVIEW-STATIC-01B routing failure because page loaded, JS loaded, navigation worked, previous smoke had CSS applied, and PREVIEW-STATIC-01B test coverage verifies CSS asset path resolution under subdirectory `appRoot`.

---

## Non-Goals Respected

- No frontend behavior change in PREVIEW-STATIC-01B itself
- No api-gateway change in PREVIEW-STATIC-01B itself
- No AI service change
- No AI-CONTEXT change
- No database schema change
- No preview settings UI
- No `.aisandbox/preview.json`
- No SPA routing overhaul
- No public/share preview
- No external dependencies
- No git commit/push steps

---

## Separate Issue Discovered (Out of Scope)

Browser-level refresh while inside a project may return to home. This is separate from static preview routing and preview auto-start.

**Candidate future task:** `APP-ROUTE-RESTORE-01A` — Preserve Workspace Route/Session After Browser Reload.

---

## Rollback Guidance

To revert PREVIEW-STATIC-01B:

1. Remove the 11 targeted tests added in `services/container-manager/src/preview/preview.service.spec.ts`:
   - `PreviewService subdirectory appRoot routing` describe block
   - `PreviewService root appRoot routing` describe block
   - Any additional path-traversal tests added for this slice (if not already present from earlier work)
2. Re-run container-manager preview tests to confirm prior baseline

No runtime rollback is required because PREVIEW-STATIC-01B did not change production routing code.

---

## PREVIEW Family Status After Closure

All registered PREVIEW family slices are now complete:

1. PREVIEW-STRATEGY-01A — COMPLETE and LOCKED
2. PREVIEW-STATIC-01B — COMPLETE and LOCKED
3. PREVIEW-AUTOSTART-01A — COMPLETE and LOCKED

---

## Next Recommended Task/Family

**APP-ROUTE-RESTORE-01A** — Preserve Workspace Route/Session After Browser Reload (candidate registration only; not yet active).

Alternatively, return to the next highest-priority backlog family outside PREVIEW per `TASKS_BACKLOG_FULL.md`.

Do not reopen PREVIEW-STATIC-01B unless a new reproducible static routing regression is found with evidence that runtime code — not frontend lifecycle — is at fault.

---

**Reference:** See `TASKS.md` → PREVIEW-STATIC-01B. See `TASKS_BACKLOG_FULL.md` → PREVIEW-STATIC-01B.
