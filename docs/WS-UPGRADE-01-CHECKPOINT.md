# WS-UPGRADE-01 — Checkpoint

**Task:** WS-UPGRADE-01 — raise ws past its two high advisories (GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p).
**Status:** COMPLETE AND LOCKED — 2026-11-19. Lane 2 and PACKAGE released.
**Loop:** 3-step (admission 574c20e; implementation ffecc35 by a sonnet subagent, Sonnet 5.5, in worktree lane/WS-UPGRADE-01; this LOCK). Part of Keith's Discord production batch ("Yes, all 9", 2026-11-19).

## Change
Root package-lock.json only (16 insertions, 16 deletions); no package.json change, no overrides. `npm update ws engine.io engine.io-client socket.io-adapter --package-lock-only`:

| Package | Before | After |
|---|---|---|
| ws | 8.18.3 | 8.21.3 |
| engine.io | 6.6.5 | 6.6.12 |
| engine.io-client | 6.6.4 | 6.6.8 |
| socket.io-adapter | 2.5.6 | 2.5.8 |

The newer engine.io and socket.io-adapter ranges allow ws ~8.21.0; openai and @discordjs/ws (^8.18.0) resolve to 8.21.3. npm also tried to prune the api-gateway nested ioredis 5.9.3 and @ioredis/commands 1.5.0; the worker restored those entries, so the diff carries no ioredis change. `npm ls ws` after: 8.21.3 everywhere, no invalid markers; `npm ci` from the new lockfile rc 0.

`npm audit --omit=dev`: 47 findings before (17 moderate, 24 high, 6 critical; the body's 34 was out of date), 43 after (15 moderate, 22 high, 6 critical); ws, engine.io-client and socket.io-adapter no longer flagged. The remaining 43 are registered as NPM-AUDIT-01.

## Gates
| Gate | Worker (worktree, own node_modules) | Control plane (branch) |
|---|---|---|
| api-gateway tests | 6808 passed, 7 skipped, 14 failed (the known smoke.integration failures that need a database), same as baseline | 6808 passed, 7 skipped, 14 failed: only the known smoke.integration |
| api-gateway build | rc 0 | rc 0 |
| ai-service tests | 1472 passed, 1 skipped | 1472 passed, 1 skipped |
| ai-service build | rc 0 | — |
| container-manager | 983 passed, 3 skipped; build rc 0 | — (no source change; lockfile only) |
| frontend | 2252 passed; build rc 0 | — |

The main checkout's node_modules still hold ws 8.18.3 until the control plane runs `npm ci` in the main checkout while no lane uses its junctions (before the batch deploy's gates). The staging deploy's `npm ci` installs from the lockfile.

## Review
The control plane read the diff (only the four packages above change version) and reran the gateway and ai-service tests on the branch; fast-forwarded main to ffecc35.

CHECKLIST: EVERY 10/11, BACKEND 6/6 — EVERY 4 partly met: the worker skipped re-reading the named CLAUDE.md sections (it had the file in context); EVERY 6 n/a for added tests (lockfile only, no behavior change), files reported.
FOLLOWUPS: 1 registered (NPM-AUDIT-01) / 0 superseded / 0 dropped / 0 undisposed.
