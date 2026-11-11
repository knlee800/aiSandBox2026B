# CM-EXEC-01 — Checkpoint

**Task:** CM-EXEC-01 — Bounded, binary-safe container exec with a stdin variant; history restore piped into the container
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CM-HISTORY-LINK-01 LOCK. Admitted under Keith's instruction to keep starting the next task.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 2 with CONTAINER-MANAGER, beside USER-TEAMS-01B | c7d4cd5 |
| 2. Implementation | opus subagent (Opus 5.5: child-process exec and workspace writes) in worktree lane/CM-EXEC-01, cherry-picked onto main | 78c2eae |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Change

### docker-runtime.service.ts

- **One exec core.** It collects Buffers with a per-stream cap: `EXEC_OUTPUT_MAX_BYTES` is 16 MiB, and a call may ask for less, never more.
  - Past the cap, the stream is destroyed and the call rejects with `ExecOutputLimitError` ("exec <stdout|stderr> output exceeded N bytes").
  - The stream callbacks never throw, and data arriving after the call settles is dropped. So a huge output can no longer crash container-manager with a RangeError.
- **The existing exec keeps its signature and string result.** `execInContainerBySessionId` only gains an optional `options`. It decodes once at the end, so a character split across chunks survives.
- **New methods:**
  - `execInContainerBySessionIdBuffer` returns stdout as a Buffer.
  - `readFileBufferFromContainer` is a binary-safe file read.
  - `execInContainerWithStdinBySessionId` uses AttachStdin and `hijack`. A Buffer input is ended whole; a Readable input is piped with backpressure. It applies the same cap and timeout.
- **Existing calls** send byte-identical create and start options.

### sessions.service.ts

- The governance checks of `execInContainer` moved into `runGovernedExec`, with the same checks in the same order.
- The new `execInContainerWithStdin` runs the same checks and shares the concurrent-exec counter.
- It refuses, with a 400, any cwd outside `/workspace` before any session or Docker call. That covers relative paths, `..`, backslash, NUL and `/workspacex`.

### git.service.ts (history restore)

The host no longer writes into the workspace. Restore opens the stored bundle read-only and streams it in 1 MiB reads into `rm -f B && set -C && cat > B && wc -c < B` inside the container (B = `/workspace/.aisb-history-restore.bundle`).
- The byte count the container reports must equal the bytes sent.
- The no-overwrite rule (noclobber) and the refusal of a directory now hold inside the container.
- Everything after staging is unchanged, and so is save.
- A source test pins that git.service.ts has no `getWorkspacePath` and no host restore path.

### Files and tests

**Files (8):** docker-runtime.service.ts, sessions.service.ts and git.service.ts, with their specs; git.service.history-links.spec.ts; `__tests__/no-host-git.spec.ts`.

**Tests:** 53 added; passing went from 586 to 640.
- The host-side restore tests were replaced by container-side ones: EEXIST and EISDIR, and the Linux-only "link appears after unlink" race, since that host path no longer exists.
- A test with a bundle over 8 MiB was added.

**Mutation checks:** putting main's git.service.ts back fails 19 tests; disabling the cap fails 4.

## Gates (control-plane rerun on the branch, then on main after the cherry-pick)

| Gate | Result |
|---|---|
| container-manager `npm test` | 19 suites; 640 passed, 2 skipped (Windows file-symlink tests), 0 failed; on the branch and on main |
| container-manager `npm run build` | exit 0, on the branch and on main |
| other services | `git diff --stat c7d4cd55..lane/CM-EXEC-01 -- services/api-gateway services/ai-service frontend`: empty |
| line endings | the 8 files are LF in the work tree and in the committed blobs |

## Review notes

- **A behaviour change at the cap.** An output over 16 MiB that used to come back (truncated or whole) now fails with the cap error. That covers a tracked working-tree diff or commit diff over 16 MiB, and a read of a file over 16 MiB, preview static files included. This is accepted as the safe default; diff truncation is registered as CM-DIFF-CAP-01.
- **Timeout behaviour is unchanged.** On a timeout the stream keeps draining with nothing stored. Only the cap destroys it.
- **Not proven by tests.** Real Docker stdin hijack (EOF reaching `cat` while the output and exit code still arrive) needs a live checkpoint save-and-restore smoke on staging, registered as CHECKPOINT-LIVE-02.

## Limits

Not deployed. The next deploy of main, STAGING-DEPLOY-FD-02, carries it. Tests mock dockerode.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (4: no frozen contract in container-manager; 5: no schema change; 6: no new failures, the 2 skips are the known Windows symlink tests)
FOLLOWUPS: 3 registered / 2 superseded / 0 dropped / 0 undisposed.

Registered:
- **CM-BINARY-01:** preview static serving and the internal file-read route still use the string read, so binary assets are corrupted. Save could move to the binary exec.
- **CM-DIFF-CAP-01:** diffs over 16 MiB should come back truncated instead of failing.
- **CHECKPOINT-LIVE-02:** Keith's restore smoke through the real stdin hijack after the next deploy.

Superseded:
- Save on the binary exec, into CM-BINARY-01.
- The binary-safe file-read route, into CM-BINARY-01.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 2 released EMPTY; CONTAINER-MANAGER released UNOWNED.
