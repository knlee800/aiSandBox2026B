# CM-CONTENT-TYPE-01 — Checkpoint

**Task:** CM-CONTENT-TYPE-01 — Preview content types for fonts, images and modules
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-BINARY-01 LOCK. Admitted under Keith's instruction to keep starting the next task.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered at the CM-BINARY-01 LOCK (c7ec043); admitted to Lane 2 with CONTAINER-MANAGER | a56ccd3 |
| 2. Implementation | sonnet subagent (Sonnet 5.5: a small map change in one service) in worktree lane/CM-CONTENT-TYPE-01, cherry-picked onto main | 2e88d39 |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Change

**New content types.** `resolveContentType` gains a module-level `STANDARD_CONTENT_TYPES` lookup, checked after the existing mappings and before the text/plain fallback. The match is case-insensitive.

| Extension | Content type |
|---|---|
| .woff | font/woff |
| .woff2 | font/woff2 |
| .ttf | font/ttf |
| .otf | font/otf |
| .gif | image/gif |
| .webp | image/webp |
| .ico | image/x-icon |
| .avif | image/avif |
| .wasm | application/wasm |
| .mjs | text/javascript; charset=utf-8 |
| .map | application/json; charset=utf-8 |
| .xml | application/xml; charset=utf-8 |
| .txt | text/plain (explicit; same as before) |

**Unchanged:** html, htm, css, js (`application/javascript`), json, svg, png, jpg, jpeg and the fallback. The stale docker-runtime.service.ts cap comment now says history slices are read raw through the binary exec; that is a comment-only change.

**Files (4):**
- preview.service.ts and preview.service.spec.ts;
- preview.controller.spec.ts;
- docker-runtime.service.ts (comment only).

**Tests:** 22 new. One of them is a controller test in which a .woff2 is served as bytes with Content-Type `font/woff2`. One existing CM-BINARY-01 case expected `text/plain` for .woff2 and now expects `font/woff2`, which is the point of this task.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| container-manager `npm test` | 20 suites; 753 passed (731 + 22), 3 skipped, 0 failed; on the branch and on main |
| container-manager `npm run build` | exit 0, on the branch and on main |
| other code | `git diff --stat` over the gateway, ai-service, frontend and container-manager sessions and git folders: empty. The docker diff is the comment only. |
| line endings | the 4 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed; it rides STAGING-DEPLOY-FD-02. Font and image rendering in a real preview is already part of CHECKPOINT-LIVE-02.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (4: no frozen contract; 5: no schema change)
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed.
- **Registered:** CM-CONTENT-TYPE-02. It adds .pdf, .mp3, .mp4, .webm, .webmanifest and similar types where previews need them, and decides whether .js moves to `text/javascript` to match .mjs. Both types are valid today.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 2 released EMPTY; CONTAINER-MANAGER released UNOWNED. COS-DRAFTS-01 stays in Lane 1.
