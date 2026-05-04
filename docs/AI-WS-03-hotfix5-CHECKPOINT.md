# AI-WS-03-hotfix5 CHECKPOINT — Route File Delete Through Container Exec

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AI-WS-03-hotfix5 |
| Family | AI-WS (AI Workspace Capability) |
| Status | COMPLETE and LOCKED |
| Nature | CONTAINER-MANAGER ROUTING HOTFIX — route file delete through Docker exec (matching read/write/list) instead of host `fs.unlink()` via FilesController; update API gateway HTTP client to target the internal sessions delete route |
| Date completed | 2026-05-04 |
| Source | Inspection session (May 2026) — deleting an existing file fails with "File not found" because `ContainerManagerHttpClient.deleteSessionFile` was calling `DELETE /api/files/${sessionId}/delete` (FilesController → host `fs.unlink`), while all other file operations route through `InternalSessionsController` → Docker exec; on Windows/Docker Desktop bind mounts the container can see `/workspace/delete-test.html` but host `fs.unlink(...)` fails or sees a stale/inaccessible path |
| Depends on | AI-WS-03 (COMPLETE and LOCKED) |

---

## Objective

Route file delete through the same container-exec path as read/write/list so delete operates against the active container `/workspace` filesystem view, eliminating the host-filesystem mismatch.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `services/container-manager/src/docker/docker-runtime.service.ts` | Added `deleteFileFromContainer(sessionId, filePath)` — validates path, resolves to `/workspace/<path>`, execs `['rm', fullPath]` inside container, maps non-zero exit to NotFoundException/BadRequestException |
| `services/container-manager/src/sessions/sessions.service.ts` | Added `deleteFileFromContainer(sessionId, filePath)` — applies identical governance checks as read/write (termination → lifetime → idle → quota), delegates to docker runtime, updates last activity |
| `services/container-manager/src/sessions/internal-sessions.controller.ts` | Added `DELETE :id/files` route guarded by `InternalServiceAuthGuard`, reads `@Body('path')`, validates presence, delegates to `sessionsService.deleteFileFromContainer` |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Changed `deleteSessionFile` target URL from `/api/files/${sessionId}/delete` to `/api/internal/sessions/${sessionId}/files`, matching read/write architecture |
| `services/container-manager/src/docker/docker-runtime.service.spec.ts` | New focused spec: exec called with `['rm', '/workspace/<path>']`; non-zero exit → NotFoundException; path traversal rejected before exec |
| `services/container-manager/src/sessions/internal-sessions.controller.spec.ts` | New focused spec: route delegates with session id and path; missing path → BadRequestException |
| `services/api-gateway/src/clients/container-manager-http.client.spec.ts` | Updated existing test: now asserts `DELETE /api/internal/sessions/session-123/files` instead of old FilesController URL |

### Not Changed

| File | Reason |
|---|---|
| All frontend files | Out of scope — backend-only slice |
| All ai-service files | Out of scope |
| `services/container-manager/src/files/files.controller.ts` | Existing FilesController delete route left in place; no longer called by API gateway client |
| API gateway user-facing delete route (`session.controller.ts`) | Out of scope |
| Confirmation UI | Out of scope |
| File-action apply logic | Out of scope |
| Schema/migration | Out of scope |
| Unrelated code | Out of scope |

---

## Implementation Summary

### `DockerRuntimeService.deleteFileFromContainer`

```typescript
async deleteFileFromContainer(sessionId: string, filePath: string): Promise<void> {
  this.validateWorkspacePath(filePath);   // rejects traversal, absolute paths
  // ... find container, verify running ...
  const fullPath = `/workspace/${filePath}`;
  const result = await this.execInContainerBySessionId(
    sessionId, ['rm', fullPath], '/workspace', undefined, 30000,
  );
  if (result.exitCode !== 0) {
    // No such file → NotFoundException
    // Is a directory → BadRequestException
    // Other → Error
  }
}
```

- Command array `['rm', fullPath]` — no shell string, no `-r`, no `-f`.
- `validateWorkspacePath` blocks `..`, absolute paths, and `/workspace`-prefixed paths identically to read/write.
- Missing file exits non-zero and `rm` outputs "No such file" → `NotFoundException`.
- Directories exit non-zero and `rm` outputs "Is a directory" → `BadRequestException`.

### `SessionsService.deleteFileFromContainer`

Same governance check order as `readFileFromContainer` / `writeFileToContainer`:
1. `assertSessionUsableOrThrow` (termination)
2. `checkAndEnforceMaxLifetime`
3. `checkAndEnforceIdleTimeout`
4. `checkAndEnforceQuota`
5. Delegate to `dockerRuntimeService.deleteFileFromContainer`
6. `updateLastActivity`

### `InternalSessionsController` `DELETE :id/files`

Accepts `@Body('path')`, validates it is present, returns 204 on success. Same guard (`InternalServiceAuthGuard`) as all other internal routes.

### `ContainerManagerHttpClient.deleteSessionFile`

Changed from:
```
DELETE /api/files/${sessionId}/delete
```
to:
```
DELETE /api/internal/sessions/${sessionId}/files
```
Body and headers unchanged: `data: { path }`, `X-Internal-Service-Key`.

**Effect:** The full delete chain — frontend → api-gateway user route → `session.controller.ts` → `ContainerManagerHttpClient.deleteSessionFile` → container-manager `InternalSessionsController` → `SessionsService` → `DockerRuntimeService` → Docker exec `rm /workspace/<path>` — now operates entirely against the active container filesystem view, matching read/write/list.

---

## Tests Added / Updated

| File | Tests |
|---|---|
| `docker-runtime.service.spec.ts` (new) | 3 tests: exec uses `['rm', ...]`; non-zero exit → NotFoundException; path traversal rejected before exec |
| `internal-sessions.controller.spec.ts` (new) | 2 tests: delegates with correct id/path; missing path → BadRequestException |
| `container-manager-http.client.spec.ts` (updated) | Updated 1 test: asserts new internal sessions URL |

---

## Validation

Docker/PostgreSQL were not required for compile/unit validations.

From `C:\Users\knlee\aiSandBox2026B\services\container-manager`:

| Check | Result |
|---|---|
| `npm run build` | Passed — clean TypeScript build |
| `npx jest "src/docker/docker-runtime.service.spec.ts" "src/sessions/internal-sessions.controller.spec.ts" --runInBand` | Passed — 5/5 tests |

From `C:\Users\knlee\aiSandBox2026B\services\api-gateway`:

| Check | Result |
|---|---|
| `npm run build` | Passed — clean TypeScript build |
| `npx jest "src/clients/container-manager-http.client.spec.ts" --runInBand` | Passed — 2/2 tests |

`ReadLints` on all touched files: no linter errors.

---

## Scope Confirmation

| Area | Changed? |
|---|---|
| Backend routing (container-manager + API gateway client) | Yes |
| Frontend | No |
| AI parser | No |
| File-action apply logic | No |
| Confirmation UI | No |
| API gateway user-facing delete route | No |
| Schema/migration | No |
| Unrelated code | No |

---

## Preserved Invariants

- Workspace path validation still blocks traversal, absolute paths, and `/workspace`-prefixed inputs.
- No shell string execution introduced; `rm` is called as a command array.
- No `-r` or `-f` flags; directory delete fails safely.
- Governance checks (termination, lifetime, idle, quota) are applied identically to read/write.
- `FilesController` delete route remains in place but is no longer in the AI delete path.
- Frontend, confirmation gate, and file-action apply logic are completely unchanged.
- Existing read/write/list behavior is completely unchanged.
