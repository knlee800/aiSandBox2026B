# CODE-TIDY-01 — Checkpoint

**Task:** CODE-TIDY-01 — Small dead-code removals left by CM-CLEANUP-01
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CM-CLEANUP-01 LOCK. Split and admitted 2026-11-10 (74cb897) under Keith's instruction to keep starting the next tasks. The unused package removal became CM-DEPS-01.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Split and admission | Lane 1 with AI-SERVICE, CONTAINER-MANAGER and FRONTEND | 74cb897 |
| 2. Implementation | opus subagent (Opus 5.5: cross-service, per the routing rule) in worktree lane/CODE-TIDY-01, fast-forwarded onto main | daa12a1 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

1. **Comment.** The comment in `services/ai-service/src/guards/internal-key-exempt.decorator.ts` now names the two exempt handlers that exist, `GET /api/conversations` and `GET /metrics`, instead of the removed `POST /api/messages/health`. This was checked against the decorated handlers (conversations.controller.ts:49, metrics.controller.ts:18) and the HTTP spec's exempt list (internal-key.http.spec.ts:365). It is a comment-only change.
2. **Unused component.** `frontend/components/Timeline.tsx` is deleted. Nothing imported it: the other "Timeline" matches are panel text, a local variable and test regexes. It called `/api/git/:id/checkpoints` and `/api/git/:id/revert`, gateway routes that do not exist.
3. **Uncalled container-manager routes, kept.**

| Route | Callers / dependents | Decision |
|---|---|---|
| `POST /api/internal/sessions/:id/previews` | no HTTP caller; the only writer of the preview port registry that PreviewProxyService and BrowserSmokeService read | kept, guarded (see follow-up 1) |
| `POST /api/files/:id/write`, `DELETE /api/files/:id/delete` | no service caller (the gateway uses `/api/internal/sessions/:id/files`); only a stale root script | kept, guarded and workspace-scoped (see follow-ups 2 and 3) |

The route inventory and the guard are unchanged: 57 guarded routes, plus `GET /api/health` open.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| ai-service `npx jest --runInBand`, `npm run build` | 1296 passed, 1 skipped, 0 failed; build exit 0 |
| container-manager `npm test`, `npm run build` | 16 suites, 470 passed; build exit 0 |
| frontend `npx tsc --noEmit`, `npm test`, `npm run build` | exit 0; 1535 passed, 0 failed; exit 0; tsconfig.tsbuildinfo restored |
| line endings | the changed file is LF in this checkout |

## Limits

Not deployed. There is nothing to check live: one comment, one deleted unused file, and no route changes.

CHECKLIST: EVERY 11/11 (6: no behaviour change, so no test change), BACKEND 6/6 (1-4: no guard, auth or contract change; 5: n/a, no schema change; 6: no new failures)

FOLLOWUPS: 2 registered / 2 superseded / 0 dropped / 0 undisposed.

**Registered:**
- **CM-PATH-01** (security; container-manager). `FilesService.validatePath` (services/container-manager/src/files/files.service.ts:427) uses `resolvedPath.startsWith(resolvedWorkspace)` with no separator. So `../<sessionId>X/file` passes for a sibling workspace whose name starts with the same session ID. The control plane confirmed the code. It affects all six `/api/files` routes. They are guarded, so only a key holder could use it. Compare against the workspace plus the separator (or use `path.relative`), check the other container-manager path checks for the same pattern, and add tests.
- **BROWSER-SMOKE-01**, NOT_READY. Nothing calls `POST /api/internal/sessions/:id/previews`, so the preview port registry stays empty. Every browser-smoke run therefore returns "Preview target not available: No preview port registered". Either register the port, or resolve it from the other preview service in `src/preview/`.

**Superseded:**
- The stale root script `test-preview-backend.sh`, which calls container-manager without the key, by a line in CM-DEPS-01 (container-manager housekeeping).
- The hardcoded English "Checkpoint Timeline" and "Timeline focus: ..." in workspace-shell.tsx (:7944, :8045), by a line in BUILDER-POLISH-01 ("Builder polish and hardcoded English").

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. AI-SERVICE, CONTAINER-MANAGER and FRONTEND are released UNOWNED.
