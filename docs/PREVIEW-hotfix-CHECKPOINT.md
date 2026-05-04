# PREVIEW-hotfix CHECKPOINT — Preserve Static HTML Relative Links Under Proxy Route

## Task Metadata

| Field | Value |
|---|---|
| Task ID | PREVIEW-hotfix |
| Family | PREVIEW (Preview Routing & Static Serving) |
| Status | COMPLETE and LOCKED |
| Nature | CONTAINER-MANAGER STATIC PREVIEW HOTFIX — inject a `<base>` tag into served static HTML responses so relative links resolve under the `/proxy/` route namespace without changing file storage, write paths, or AI behavior |
| Date completed | 2026-05-03 |
| Source | Inspection session (May 2026) — static HTML preview iframe is loaded at `/api/preview/<sessionId>/proxy`; relative links like `href="page2.html"` resolve to `/api/preview/<sessionId>/page2.html` and miss the `/proxy/` route, causing 404 |
| Depends on | AI-WS-03-hotfix2 (COMPLETE and LOCKED) |

---

## Objective

Make normal static HTML relative links and buttons work inside the preview iframe by injecting a correct `<base>` tag into served static HTML responses so relative URLs resolve under `/api/preview/<sessionId>/proxy/`, without changing file write paths, AI file actions, workspace storage, or broad preview architecture.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `services/container-manager/src/preview/preview.service.ts` | Updated `readStaticPreviewContent` to compute content type first and apply HTML base tag injection for HTML responses; added private `injectPreviewBaseTag` helper |

### Created

| File | Change |
|---|---|
| `services/container-manager/src/preview/preview.service.spec.ts` | New focused spec with 6 tests covering the base tag injection cases |

### Not Changed

| File | Reason |
|---|---|
| `services/container-manager/src/preview/preview.controller.ts` | No change needed — route and proxy logic unchanged |
| All session file read/write/delete endpoints | Out of scope |
| All AI service files | Out of scope |
| All api-gateway files | Out of scope |
| All frontend files | Out of scope |

---

## Implementation Summary

### `preview.service.ts` — `readStaticPreviewContent`

Before this change the method returned `{ content, contentType }` directly. After:

1. `contentType` is resolved first from the sanitized path.
2. If `contentType.startsWith('text/html')`, the served `content` is passed through `injectPreviewBaseTag(content, sessionId)` before being returned.
3. All other content types are returned byte-for-byte unchanged.
4. The container file is still read via `dockerRuntimeService.readFileFromContainer` exactly as before. **Nothing is written to disk.**

### `injectPreviewBaseTag(html, sessionId)` — private helper

Constructs:
```
<base href="/api/preview/${encodeURIComponent(sessionId)}/proxy/">
```

Injection rules (in order):
1. If the HTML already contains `<base` (case-insensitive regex `/<base\b/i`) → return unchanged. No double-inject.
2. If the HTML contains an opening `<head>` tag (regex `/<head\b[^>]*>/i`) → insert the base tag immediately after that opening tag using a simple string replace.
3. Otherwise → prepend the base tag at the very start of the served HTML string.

No full HTML parser is used. The helper is a pure string transform operating on the in-memory response only.

### Effect on browser navigation

With the base tag present, a relative link `<a href="page2.html">` in a static HTML preview page resolves in the browser to:
```
/api/preview/<sessionId>/proxy/page2.html
```
which correctly hits the `@Get(':sessionId/proxy*')` route in the container-manager preview controller.

---

## Tests Added

`services/container-manager/src/preview/preview.service.spec.ts` — 6 focused cases:

1. HTML with plain `<head>` — base tag inserted immediately after `<head>`.
2. HTML with `<head data-test="preview">` — base tag still inserted after the attributed opening tag.
3. HTML without `<head>` — base tag prepended at start of content.
4. HTML with existing `<base href="/custom/">` — no double-inject; content returned as-is; only one `<base` present.
5. Non-HTML CSS content (`styles.css`) — content type is `text/css; charset=utf-8` and content is returned unchanged.
6. Session ID URL-encoding — session ID with spaces produces `session%20with%20spaces` in the injected href.

---

## Validation

From `C:\Users\knlee\aiSandBox2026B\services\container-manager`:

| Check | Result |
|---|---|
| `npm run build` | Passed — clean TypeScript build |
| `npx jest "src/preview/preview.service.spec.ts" --runInBand` | Passed — 6/6 tests |
| `npx jest "src/files/files.service.spec.ts" --runInBand` | Passed — 2/2 tests (regression guard) |
| `ReadLints` on both touched files | No linter errors |
| `git status -- services/container-manager/src/preview` | Modified `preview.service.ts`; new `preview.service.spec.ts` — no other files |

---

## Scope Confirmation

| Area | Changed? |
|---|---|
| AI parser behavior | No |
| AI prompts | No |
| File-actions | No |
| Workspace storage | No |
| Session file read/write/delete APIs | No |
| Route architecture | No |
| Broad / dynamic preview behavior | No |
| D1/PROJ-03 work | No |
| Unrelated workspace rollout work | No |
| Files on disk (user workspace) | No — injection is response-only |

---

## Preserved Invariants

- Relative HTML links now resolve under `/api/preview/<sessionId>/proxy/` so navigation between static HTML pages works.
- User files are not modified on disk.
- Non-HTML assets (CSS, JS, images) are not modified.
- Existing static preview detection, session management, and proxy behavior preserved.
- No change to any file write, read, or delete API surfaces.
