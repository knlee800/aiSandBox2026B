# PREV-02-01 CHECKPOINT

## Task Metadata

- Task ID: PREV-02-01
- Title: Diagnose Preview 500 After Snapshot Persistence Fix
- Nature: BUG INVESTIGATION (PREVIEW PATH, POST-PERSISTENCE REGRESSION)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PREV-02-01-CHECKPOINT.md`

## Objective

Determine why preview now returns `{"statusCode":500,"message":"Internal server error"}` after project persistence has been fixed.

## Investigation Result

The 500 is **not a regression from the snapshot persistence fix (PROJ-01-21)**. It is a pre-existing defect in the Static HTML preview fallback path from PREV-01-02.

### Exact failing stage

**Static HTML preview proxy assumes `index.html` exists when any `*.html` file was detected during framework detection.**

The mismatch is between two functions in `services/container-manager/src/preview/preview.service.ts`:

1. **Detection** (`hasAnyHtmlInSessionWorkspace`, L370-378): runs `ls /workspace/*.html` — matches **any** `.html` file.
2. **Proxy** (`readStaticPreviewContent` → `sanitizeStaticPath`, L419-429): resolves the root path `/` to **`index.html`** unconditionally.

A session with `hello.html` but no `index.html`:
- passes detection → framework = "Static HTML"
- `startPreview` succeeds → marked `running`
- proxy request for `/` → `sanitizeStaticPath('/')` → `index.html`
- `readFileFromContainer` → `cat /workspace/index.html` → exit code != 0
- throws `Error: File not found or cannot be read: index.html`
- NestJS wraps as HTTP 500 Internal Server Error

### Why it appears to correlate with the persistence fix

Session `e7c717c9` was restored from a snapshot containing `hello.html` (not `index.html`). The snapshot persistence fix (PROJ-01-21) made snapshot restore work across restarts, which meant the user could now successfully open projects that previously opened empty. When the user then clicked "Start Preview" on a restored session containing `.html` files that were not named `index.html`, the preview started but proxy returned 500.

The persistence fix exposed the defect — it did not cause it.

### Code trace

```
services/container-manager/src/preview/preview.service.ts
```

Detection (L370-378):
```typescript
private async hasAnyHtmlInSessionWorkspace(sessionId: string): Promise<boolean> {
  const htmlResult = await this.runShellInSession(
    sessionId,
    'ls /workspace/*.html >/dev/null 2>&1',
    undefined,
    10000,
  );
  return htmlResult.exitCode === 0;
}
```

Sanitize path (L419-429):
```typescript
private sanitizeStaticPath(requestPath: string): string {
  const trimmedPath = (requestPath || '/').split('?')[0].split('#')[0];
  const normalizedPath = trimmedPath === '/' || trimmedPath === ''
    ? 'index.html'        // <-- always assumes index.html
    : trimmedPath.replace(/^\/+/, '');

  if (normalizedPath.includes('..')) {
    throw new BadRequestException('Invalid static preview path');
  }

  return normalizedPath;
}
```

Proxy controller (preview.controller.ts L67-79): calls `readStaticPreviewContent` for Static HTML framework, which calls `dockerRuntimeService.readFileFromContainer(sessionId, 'index.html')`.

`readFileFromContainer` (docker-runtime.service.ts L413-459): runs `cat /workspace/index.html`, gets exit code != 0, throws `Error("File not found or cannot be read: index.html")`, which is wrapped as `Error("Failed to read file from container ...")`, caught by NestJS `ExceptionsHandler` as HTTP 500.

## Evidence

### A) Container-manager error log

```
[ExceptionsHandler] Failed to read file from container for session e7c717c9-b75b-48a8-b26c-79a089954e91: File not found or cannot be read: index.html
Error: Failed to read file from container for session e7c717c9-b75b-48a8-b26c-79a089954e91: File not found or cannot be read: index.html
    at async PreviewService.readStaticPreviewContent (/app/dist/preview/preview.service.js:151:25)
    at async PreviewController.proxyRequest (/app/dist/preview/preview.controller.js:67:35)
```

### B) Session workspace content confirms no `index.html`

```
docker exec sandbox-session-e7c717c9-b75b-48a8-b26c-79a089954e91 ls -la /workspace/
→ .git/
→ hello.html    (not index.html)
```

### C) Fresh sessions with `index.html` work correctly

```
SESSION=90b93ac4 (fresh, wrote index.html)
STATUS: {"running":false,"message":"No active preview for this session"}
START: {"success":true,"port":3002,"status":"running","framework":"Static HTML"}
PROXY: 200 OK (content served)
```

### D) Restored project sessions with `index.html` also work

```
SESSION_B=1642ea1b (restored from snapshot with index.html)
STATUS: {"running":false}
START: {"success":true,"port":3003,"status":"running","framework":"Static HTML"}
PROXY: 200 OK (content served)
```

### E) api-gateway preview proxy is pass-through

The api-gateway `PreviewController` (L1-56) forwards all preview requests to container-manager via `axios` with `validateStatus: () => true`. The 500 originates from container-manager, not api-gateway.

## Narrow follow-up

One bounded fix task: **align the Static HTML fallback so the proxy path handles the case where `index.html` does not exist.** The smallest safe options:

1. **Tighten detection**: change `hasAnyHtmlInSessionWorkspace` to check specifically for `index.html` instead of `*.html`. A session with only `hello.html` would not be detected as "Static HTML" and would get the existing "No package.json or start command found" response.

2. **Make the proxy root path resolve to the first available `.html` file**: if `index.html` doesn't exist, find and serve the first `.html` file in `/workspace/`. This keeps the broader detection useful.

3. **Return 404 instead of 500**: catch the file-not-found error in `readStaticPreviewContent` or the proxy controller and return a meaningful 404 with a message like "index.html not found". This doesn't fix the UX but eliminates the opaque 500.

Option 1 is the smallest and most conservative. Option 2 is the most user-friendly. Option 3 is a defensive improvement but doesn't fix the root detection/proxy mismatch.

## Scope and Invariants

- Investigation only; no fix applied in this task.
- No preview redesign.
- No persistence redesign.
- No workspace redesign.
- No scope expansion.
