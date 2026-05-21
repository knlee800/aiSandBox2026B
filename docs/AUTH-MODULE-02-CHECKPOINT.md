# AUTH-MODULE-02 Checkpoint — Auth Module Live Smoke Blockers

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-02 |
| Title | Auth Module Live Smoke Blockers |
| Family | AUTH |
| Status | COMPLETE and LOCKED |
| Nature | FULL-STACK — frontend, api-gateway, container-manager |
| Date | 2026-05-21 |
| Depends on | AUTH-MODULE-01 (COMPLETE and LOCKED — `docs/AUTH-MODULE-01-CHECKPOINT.md`) |
| Checkpoint | `docs/AUTH-MODULE-02-CHECKPOINT.md` |

---

## Objective

Resolve all live smoke blockers discovered during manual validation of `AUTH-MODULE-01 — Reusable App-Auth Module for aiSandBox-Created Apps`. Two high-severity blockers prevented AUTH-MODULE-01 from being considered production-ready:

1. File write API incorrectly rejected valid Next.js App Router bracket/catch-all route paths.
2. Checkpoint revert confirmed by user in the UI did not actually restore workspace files.

Both blockers have been fixed, validated with automated tests, and confirmed via live browser re-testing.

---

## Child Slices

### AUTH-MODULE-02A — Support Next.js Bracket Route File Paths

**Status:** COMPLETE and LOCKED  
**Checkpoint:** `docs/AUTH-MODULE-02A-CHECKPOINT.md`

**Bug:** `validateWorkspacePath` in `docker-runtime.service.ts` used `filePath.includes('..')` which produced false positives for paths containing Next.js catch-all segment syntax (e.g., `[...nextauth]`, `[[...slug]]`) because `...` contains `..` as a substring.

**Fix:** Replaced substring check with segment-based check:
```ts
filePath.split('/').some((segment) => segment === '..')
```

**Files changed:**
- `services/container-manager/src/docker/docker-runtime.service.ts`
- `services/container-manager/src/docker/docker-runtime.service.spec.ts`

**Validation:** 32/32 container-manager tests PASS, build PASS, ReadLints PASS.

---

### AUTH-MODULE-02B — Checkpoint Revert Has No Effect

**Status:** COMPLETE and LOCKED  
**Checkpoint:** `docs/AUTH-MODULE-02B-CHECKPOINT.md`

**Bug:** Confirming a checkpoint revert in the UI produced "Revert failed" (or returned 200 with no actual file restoration). Four layered bugs were identified and fixed:

| # | Layer | Root cause |
|---|---|---|
| 1 | Frontend | Revert helper called `POST /api/git/:sessionId/revert` — route does not exist |
| 2 | api-gateway | `@Post('../revert')` in NestJS never registered the route |
| 3 | container-manager | `simpleGit(workspacePath)` used host path that only exists in sandbox container |
| 4 | api-gateway | `userId` not forwarded to container-manager — caused SQLite NOT NULL failure |

**Files changed (13 files):**
- `frontend/components/workspace/workspace-checkpoint-revert.logic.ts`
- `frontend/components/workspace/workspace-checkpoint-revert.logic.test.ts`
- `services/api-gateway/src/checkpoints/checkpoints.controller.ts`
- `services/api-gateway/src/checkpoints/checkpoints.service.ts`
- `services/api-gateway/src/clients/container-manager-http.client.ts`
- `services/api-gateway/src/checkpoints/checkpoints.service.spec.ts`
- `services/api-gateway/src/checkpoints/checkpoints.controller.spec.ts`
- `services/api-gateway/src/checkpoints/__tests__/checkpoints.integration.spec.ts`
- `services/api-gateway/src/checkpoints/__tests__/checkpoints.routes-http.spec.ts` *(new)*
- `services/container-manager/src/git/git.service.ts`
- `services/container-manager/src/git/git.service.spec.ts` *(new)*

**Validation:** Frontend 437/437 PASS, api-gateway focused suites 40/40 PASS, container-manager 35/35 PASS, all builds PASS.

---

## Final Live Smoke Test — PASS

**Session:** `c741fe05-ae3c-48c1-90eb-7916ca17f474`  
**Checkpoint:** `revert-test-baseline-4`  
**File modified:** `second-page.html` (marker: `REVERT-TEST-MARKER-4`)

| Check | Result |
|---|---|
| `POST /api/sessions/:id/revert` HTTP status | **200 OK** |
| Response body | `{ "message": "Reverted successfully", "newCheckpoint": { ... } }` |
| Marker removed from file | **PASS** |
| Editor content auto-refreshed | **PASS** |
| File tree refreshed | **PASS** |
| Checkpoint list updated | **PASS** |
| `checkpoints.user_id NOT NULL` error | **GONE** |
| `simple-git missing directory` error | **GONE** |

---

## Final Validation Summary

| Service | Suite | Result |
|---|---|---|
| Frontend | `npm test` (437 tests) | **PASS** |
| Frontend | `tsc --noEmit` | **PASS** |
| api-gateway | Checkpoint suites (40 tests) | **PASS** |
| api-gateway | `npm run build` | **PASS** |
| container-manager | `npm test` (35 tests) | **PASS** |
| container-manager | `npm run build` | **PASS** |
| Live browser re-test | Round 4 | **PASS** |

---

## Acceptance Checks

- [x] AUTH-MODULE-02A COMPLETE and verified — bracket route paths accepted by file write API
- [x] AUTH-MODULE-02B COMPLETE and verified — checkpoint revert restores workspace files correctly
- [x] Both blockers resolved and revalidated before AUTH-MODULE-01 treated as production-ready

---

## Remaining Carry-Forwards

These issues were observed during AUTH-MODULE-02B live testing and are explicitly out of scope for AUTH-MODULE-02. They do not block AUTH-MODULE-02 closure:

1. **Internal ledger `session_id` null on post-revert checkpoint recording**
   - After a revert, the container-manager's callback to `POST /api/internal/git-checkpoints` sends `session_id` as null, causing a PostgreSQL NOT NULL constraint failure.
   - The revert succeeds; the PostgreSQL checkpoint ledger entry is not created.
   - Requires a separate investigation task.

2. **Quota/billing tables not provisioned** (`no such table: users`, `no such table: token_usage`)
   - Pre-existing dev environment issue. Fail-open by design.

3. **Full api-gateway `npm test` smoke suite**
   - Pre-existing REDIS_URL / test environment failures unrelated to AUTH-MODULE-02.

---

## Non-Goals Confirmed

- No auth template redesign
- No new auth providers or auth flows
- No billing or quota system changes
- No redesign of checkpoint or revert flow architecture
- No changes to session lifecycle management

---

## Invariants Preserved

- All checkpoint endpoints (`create`, `list`, `diff`, `revert`) remain functional and ownership-guarded
- `SessionCookieGuard` on all checkpoint controller methods — unchanged
- All existing container-manager docker/session/git service contracts — unchanged
- No breaking changes to any public API response shapes
- No changes to `AUTH-MODULE-01` implementation files

---

## Reference

- Child: `docs/AUTH-MODULE-02A-CHECKPOINT.md`
- Child: `docs/AUTH-MODULE-02B-CHECKPOINT.md`
- Parent family: `docs/AUTH-MODULE-01-CHECKPOINT.md`
- `TASKS.md` → AUTH-MODULE-02
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-02
