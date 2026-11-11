# ARCHIVE-BINARY-01 — Checkpoint

**Task:** ARCHIVE-BINARY-01 — Binary-safe zip export and import
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the SNAPSHOT-BINARY-01 LOCK. Admitted by the control plane under Keith's 2026-11-10 keep-going instruction.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with GATEWAY: `workspace-archive.service.ts` and its spec (with CM-BODY-KEY-01 in Lane 2) | 3537ced |
| 1. Implementation | sonnet subagent (Sonnet 5.5: one gateway file and its spec, reusing the SNAPSHOT-BINARY-01 base64 read and write) in worktree lane/ARCHIVE-BINARY-01, fast-forwarded onto main | 502fe70 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **Export:** each file is read with `readSessionFile(…, { encoding: 'base64' })` and decoded to a Buffer. The zip gets the exact bytes.
  - A container-manager that answers without `encoding: 'base64'` is read as UTF-8 text. This is the same fallback the snapshot save uses.
- **Import:** each entry is written with `writeSessionFile(…, <base64>, 'base64')`, so text and binary are both byte-exact on one path.
  - `decodeUtf8Text` is removed, so an entry that is not UTF-8 is no longer refused with "Archive contains non-UTF8 file content".
  - The worker chose all-base64 over the snapshot's text-or-base64 split, because `isStorableAsText` is not exported and its file is outside the write scope.
- **Size check:** a single imported file stays capped at 512 KB, which is about 700 KB as base64. That is far below the 16 MB file-write limit.
- **Unchanged:**
  - the zip size, entry-count and per-file limits;
  - path safety and the exclusions;
  - the file-list walk and the error types.

**Tests:** 3 new in `workspace-archive.service.spec.ts`:
- a PNG with NUL and 0xFF bytes, and a text file, round-trip byte for byte;
- the text fallback when the base64 encoding is missing;
- an entry that is not UTF-8 is imported byte for byte.

Two old assertions now expect the base64 call shape: the nested export read and the import write. Before the fix, 5 of the 8 tests in the spec failed.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 3808 passed (3805 + 3), 7 skipped, plus the 14 known `smoke.integration` failures (1 suite) | `src/snapshots`: 2 suites, 19 passed (same tree after the fast-forward) |
| api-gateway `npm run build` | exit 0 | — |
| diff scope | only the two write-set files | — |
| line endings | LF | LF |

## Limits

- **Not deployed.** It is registered for deploy with CM-BODY-KEY-01 as STAGING-DEPLOY-SNAP-03.
- **Text and binary are both sent as base64 on import,** about a third more bytes on the internal call. Import is rare, and files are capped at 512 KB.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 9: no build artifact changed; 10: worker committed only on its branch, fast-forwarded by the control plane), BACKEND 6/6 (1 to 5: no auth, guard, internal endpoint, template, contract or entity change; it uses the existing base64 options of the client; 6: only the 14 known smoke failures)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-SNAP-03, shared with CM-BODY-KEY-01) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY released UNOWNED;
- not deployed.
