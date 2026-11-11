# SNAPSHOT-BINARY-01 — Checkpoint

**Task:** SNAPSHOT-BINARY-01 — Binary-safe workspace snapshots so projects with images reopen
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CHECKPOINT-LIVE-02 LOCK. On staging, reopening a project with a 70-byte PNG failed with a 500, and its save points were not restored. Admitted under Keith's 2026-11-10 keep-going instruction.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with GATEWAY and CONTAINER-MANAGER, twelve exact write paths | 624c0c0, 5fd24e3 |
| 2. Implementation | opus subagent (Opus 5.5: cross-service, child-process write path) in worktree lane/SNAPSHOT-BINARY-01, fast-forwarded onto main | 689fc26 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Container-manager**
- **Container write:** `DockerRuntimeService.writeFileToContainer` now writes through the CM-EXEC-01 stdin exec, using `sh -c 'mkdir -p "$(dirname "$FILE")" && cat > "$FILE"'`. The only environment variable is `FILE`, the path; content is never passed in an environment variable or the argument list.
  - A string is written as its UTF-8 bytes, the same bytes `printf` wrote before.
  - A Buffer is written as-is.
  - Path validation, the running check, the 30 s timeout and the error messages are unchanged.
- **Session service:** `SessionsService.writeFileToContainer` accepts a string or a Buffer. Its governance checks are unchanged.
- **Internal write route:** `POST /api/internal/sessions/:id/files` takes an optional `encoding`.
  - Absent: the text write, unchanged.
  - `"base64"`: strictly decoded (canonical padded base64), then written byte for byte.
  - Any other value, or invalid base64: 400 before any write.
  - The guard and `SessionIdPipe` are unchanged.

**Gateway**
- **Client:** `ContainerManagerHttpClient.readSessionFile` gains the CM-BINARY-01 `encoding: 'base64'` option, and `writeSessionFile` gains an optional encoding. Without them, the query and the body are exactly as before.
- **Snapshot save:** each file is read as bytes and stored as text when it is clean UTF-8 with no NUL, with no marker, as before. Otherwise it is stored as `content: <base64>, encoding: 'base64'`. Old snapshots, which have no encoding, restore with exactly the old text writes.
- **Snapshot restore:** a file that cannot be written no longer stops the restore. The other files are still written, and the failed paths are logged (never their content) and returned as `failedPaths`. A 410 still stops the restore.
- **Project reopen:** `ProjectsService.openProjectIntoSession` always calls `restoreCheckpointHistory`.
  - If files failed, the open still succeeds.
  - If the restore throws a 5xx, the error is logged, and the open succeeds with no restored snapshot.
  - A 4xx, such as an unknown snapshot or a terminated session, is rethrown after the history restore, as before.
  - The active-run skip and the snapshot choice are unchanged; the choice is SNAPSHOT-PICK-01.

**Tests:** 38 new in container-manager and 14 in the gateway. These cover:
- PNG, font and non-UTF-8 round trips byte for byte;
- NUL and 0xFF reaching the container's stdin exactly, with no content in env or argv;
- 400s for bad encodings and invalid base64;
- the real-HTTP route keeping its 403 guard and the `SessionIdPipe` 400;
- old snapshots restoring unchanged;
- a failing file not stopping the others;
- history being restored after a snapshot failure.

**Changed assertions** (reviewed and accepted):
- `projects.service.spec`: "does not restore checkpoint history when snapshot restore fails" asserted the defect itself. It is replaced by the opposite test.
- The PROJ-02-03 `.git` test in the snapshot spec now expects the `{ encoding: 'base64' }` read argument.
- The docker-runtime path-validation test now expects the stdin exec.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| container-manager `npm test` | 20 suites, 791 passed (753 + 38), 3 skipped | 20 suites, 791 passed, 3 skipped (same tree after the fast-forward) |
| container-manager `npm run build` | exit 0 | exit 0 |
| api-gateway `npx jest --maxWorkers=2` | 3800 passed (3786 + 14), 7 skipped, plus the 14 known `smoke.integration` failures | the changed areas (snapshots, projects, clients, sessions): 12 suites, 257 passed |
| api-gateway `npm run build` | exit 0 | exit 0 |
| frozen and other-service paths (`services/api-gateway/src/ai`, `src/orchestration`, `services/ai-service`, `frontend`) | diff empty | — |
| line endings | the 12 files are LF | 12 of 12 LF after the fast-forward |

## Limits

- **Not deployed and not checked live.** The live check is Keith reopening a project with an image (his CL2 test project) and seeing the image in Preview and his save points in History. It is registered with the deploy as STAGING-DEPLOY-SNAP-01.
- **Large files.** container-manager uses Nest's default JSON body limit of about 100 KB, so a binary file over about 75 KB (after base64) or a text file over about 100 KB is not restored. Text files over that size already failed before. Such a file is now listed in `failedPaths` instead of failing the whole reopen. Registered as SNAPSHOT-SIZE-01.
- **The user is not told** which files were not restored. Registered as SNAPSHOT-NOTICE-01.
- **Zip export and import** (`workspace-archive.service.ts`) still use text reads and writes. Registered as ARCHIVE-BINARY-01.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief with the boot sequence, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 10: worker committed only on its branch, fast-forwarded by the control plane), BACKEND 6/6 (1 and 2: internal key guard and SessionIdPipe unchanged, checked by real-HTTP tests; 3: no template change; 4: HARNESS_ENTITLEMENT_PROOF_V1 paths untouched; 5: no entity or schema change; 6: gateway failures are the 14 known smoke tests only)
FOLLOWUPS: 4 registered (STAGING-DEPLOY-SNAP-01, SNAPSHOT-SIZE-01, SNAPSHOT-NOTICE-01, ARCHIVE-BINARY-01) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY and CONTAINER-MANAGER released UNOWNED;
- not deployed.
