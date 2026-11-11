# CM-BINARY-01 — Checkpoint

**Task:** CM-BINARY-01 — Binary-safe preview files and file reads
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-EXEC-01 LOCK. Admitted under Keith's instruction to keep starting the next task.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered at the CM-EXEC-01 LOCK (252ce1f); admitted to Lane 2 with CONTAINER-MANAGER | 068ad15 |
| 2. Implementation | opus subagent (Opus 5.5: an internal route and the governed exec path) in worktree lane/CM-BINARY-01, cherry-picked onto main | 69b418e |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Change

### Preview static files are sent as bytes

`readStaticPreviewContent` reads through `readFileBufferFromContainer` and returns a Buffer.
- HTML is decoded, gets `injectPreviewBaseTag` as before, and is re-encoded as UTF-8. Every other type is sent as the raw bytes.
- Path sanitising, appRoot handling, errors and status codes are unchanged.
- Images and fonts are no longer corrupted.
- One header changes. Binary types now go out without the `; charset=utf-8` that Express used to add to string bodies: `image/png`, not `image/png; charset=utf-8`. HTML, CSS, JS, JSON and text keep their charset.

### SessionsService

- New `execInContainerBuffer` uses `runGovernedExec`: the same checks, the shared exec counter, and cwd inside /workspace only.
- New `readFileBufferFromContainer` shares one governed file-read body with the text read, so the governance and container-lost handling are identical. The text read is unchanged.

### Internal file-read route

`GET /api/internal/sessions/:id/files` keeps its guard, its SessionIdPipe and its default `{ path, content }` text body; a test checks that body byte for byte.
- The optional `encoding=base64` query returns `{ path, content: <base64>, encoding: 'base64' }`.
- Any other encoding value, a repeated parameter included, is a 400 before any read.
- The gateway is unchanged.

### History save

Save reads its 8 MiB slices as raw bytes through `execInContainerBuffer`; `| base64` and `decodeStrictBase64` are gone.
- The integrity check is still the exact per-slice byte count.
- Slice size, the size probe, the `-L` refusal, the O_EXCL temp file, the rename, cleanup and the no-host-git rule are unchanged.

### Files and tests

**Files (12):**
- preview.service.ts and preview.controller.ts (comment only), with their specs; preview.controller.spec.ts is new;
- sessions.service.ts and internal-sessions.controller.ts, with their specs;
- git.service.ts with its spec and history-links spec;
- `__tests__/no-host-git.spec.ts`.

**Tests:** 62 new; passing went from 640 to 702. That includes real-HTTP tests: a PNG round-trips byte for byte, the route's default body is byte-identical, and calls without the key or with the wrong key get 403 even with `encoding=base64`.

**Existing tests changed:**
- Preview mocks now return Buffers, because the return type changed; the expected values are the same.
- Save tests serve raw slices instead of base64.
- A helper counts the new exec wrapper in the governance tables.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| container-manager `npm test` | 20 suites; 702 passed, 2 skipped (Windows symlink tests), 0 failed; on the branch and on main |
| container-manager `npm run build` | exit 0, on the branch and on main |
| other code | `git diff --stat 068ad153..lane/CM-BINARY-01` over services/api-gateway, ai-service, frontend and container-manager/src/docker: empty |
| line endings | the 12 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed; it rides STAGING-DEPLOY-FD-02. Tests mock dockerode. Two things need a live check:
- an image or font rendering in a real static preview;
- a real save storing the bundle byte for byte from raw slices.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (2: the internal route keeps its guard and pipe, tested over HTTP; 4: no frozen contract in container-manager; 5: no schema change)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Registered:** CM-CONTENT-TYPE-01. `resolveContentType` lacks woff, woff2, ttf, gif, webp, ico, wasm and mjs, so those go out as text/plain, which browsers may refuse for fonts and modules. The same task fixes the stale base64 slice comment in docker-runtime.service.ts.
- **Superseded:** the live checks (a preview image and a raw-slice save) go into CHECKPOINT-LIVE-02; a line was added to its body.

Accepted as designed, not a follow-up: no gateway caller uses `encoding=base64` yet, and none needs one. The admission note says a caller is a later task if one is ever needed.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 2 released EMPTY; CONTAINER-MANAGER released UNOWNED. APPROVAL-SET-01 stays in Lane 1.
