# CM-PATH-01 — Checkpoint

**Task:** CM-PATH-01 — Container-manager workspace path check accepts sibling workspaces
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY (security). **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CODE-TIDY-01 LOCK. Admitted 2026-11-10 (16174bd) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with CONTAINER-MANAGER | 16174bd |
| 2. Implementation | opus subagent (Opus 5.5: a security fix to path validation) in worktree lane/CM-PATH-01, fast-forwarded onto main | ed662d1 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

There is a new `files/path-containment.ts` with two pure helpers:
- **`isPathInside(root, candidate)`** takes `path.relative(resolve(root), resolve(candidate))`. It allows `''`, the root itself. It refuses an absolute result (another drive on Windows), `..`, and anything starting with `..` plus the separator. The check is lexical: symlinks are not followed.
- **`isSinglePathSegment(id)`** requires a non-empty string that is not `.` or `..` and contains no `/`, `\` or NUL.

| Check | Before | Now |
|---|---|---|
| `FilesService.validatePath` (files.service.ts:427) | `startsWith(workspace)` with no separator, so `../<id>X/file` reached a sibling workspace | `isPathInside`; the same 400 "Invalid path: outside workspace" |
| `SessionsService.getWorkspacePath` (new finding) | joined the raw `:id` onto the workspaces root, so `%2E%2E` (decoded to `..`) gave the root's parent | the id must be a single segment, or 400 "Invalid session id" |
| `deleteSession` (new finding) | `fs.rm(join(root, id), {recursive})` with no check, so `DELETE /api/sessions/%2E%2E` could have removed the root's parent recursively | the id is checked before the container, the workspace or the row is touched |
| `startSessionContainer` (new finding) | inserted a row and bind-mounted `join(root, id)` for any id | the id is checked before the insert |

These routes have been behind the internal key since CM-AUTH-01, so only a key holder could reach the bugs.

**Left unchanged, with reasons:**
- `docker-runtime.service.ts validateWorkspacePath`: it refuses any `..` segment and a leading `/`.
- `preview.service.ts sanitizeStaticPath`: it refuses any `..`.
- git bundle paths: they use `path.relative` plus `isAbsolute`, and the ids are checked as UUIDs.
- ids from the database or `generateId`, and URL-prefix checks: they are not filesystem containment.
- No `realpath` is used anywhere in container-manager/src.

Real session ids are UUIDs or base36, so every real caller passes.

**Tests:** 21 new, in 2 new suites and one new block.
- **path-containment:** posix and win32 rules (sibling prefix, `..` escapes, root and nested paths, absolute paths and other drives), the default path module, and the segment rules.
- **FilesService:** against a real temporary parent with `abc` and `abcX`. It refuses the sibling prefix on every file route, `..` escapes and absolute paths outside; it allows the root, nested paths and a leading-slash path inside.
- **SessionsService:** a plain id gives a direct child, and escaping or sibling ids are refused. `deleteSession` refuses `..` before any removal and still removes a plain id. `startSessionContainer` refuses `..` before any insert.
- **Mutation check:** with the old `startsWith` put back, 3 of the 7 new FilesService tests failed.

No existing test changed.

Files: `services/container-manager/src/files/path-containment.ts` and its spec (new), `files/files.service.ts` and its spec, `sessions/sessions.service.ts`, and `sessions/sessions.service.workspace-path.spec.ts` (new).

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| container-manager `npm test` | 18 suites, 491 passed (470 + 21), 0 failed |
| container-manager `npm run build` | exit 0 |
| line endings | the 6 files are LF in this checkout |

## Limits

- **Not deployed.** It goes out with the next deploy, which needs Keith's approval.
- **The fix is lexical only.** See CM-SYMLINK-01 below.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (1: no guard, internal-key or route change; 5: n/a, no schema change; 6: no new failures)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Registered: CM-SYMLINK-01, NOT_READY (security).**
  - FilesService runs on the host and follows symlinks (`readFile`, `writeFile`, `stat`, `mkdir`). The workspace is bind-mounted into the sandbox, where code could create `ln -s / root`. A key holder calling `/api/files/<id>/read {path:"root/etc/passwd"}` would then read host files, and `write` would write them.
  - The control plane confirmed that no gateway or ai-service code calls `/api/files/*`. The gateway uses the container-side `/api/internal/sessions/:id/files`. So only a direct key holder could reach this, not a user.
  - Fix: remove the uncalled host-side `/api/files` routes, or check the `realpath` of the target (and of the nearest existing parent for write and mkdir) against the workspace's realpath.
- **Superseded:** validating session ids at the controller layer, by a line in CM-SYMLINK-01. It belongs with the same container-manager route hardening.

Not a follow-up: the worker left `C:\Users\knlee\AppData\Local\Temp\fs.bak`, a copy of files.service.ts, from its mutation check. It is harmless. The control plane's delete was refused by the permission check (the file is outside the scratchpad), so it is left for Keith to delete.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY, and CONTAINER-MANAGER is released UNOWNED.
