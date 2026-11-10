# FE-TEST-GLOB-01 — Checkpoint

**Task:** FE-TEST-GLOB-01 — Fail when a frontend test file is not in npm test
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the FE-TEST-COVERAGE-01 LOCK (12d70ca). Admitted on 2026-11-10 (50b8251) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with FRONTEND and PACKAGE | 50b8251 |
| 2. Implementation | sonnet subagent in worktree lane/FE-TEST-GLOB-01 (c6d2389), cherry-picked onto main | 20d3258 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **`frontend/lib/test-script-coverage.test.ts` (new, 5 tests).** It runs inside `npm test` through `lib/*.test.ts`:
  - it splits the test script into its globs;
  - it walks frontend/ for `*.test.ts` and `*.test.tsx`, skipping node_modules, .next and other build output;
  - it fails, naming each file, when a file is matched by no glob.
  - Matching uses Node's built-in `path.posix.matchesGlob`, available in Node 22.14. No dependency was added.
  - Self-tests: the file matches itself; a literal `app/[locale]/x.test.ts` glob does not match its own path while `app/*/x.test.ts` does; and `*` does not cross `/`.
- **`frontend/package.json`: one glob added, `*.test.ts`.** The guard found a real gap on its first run: `frontend/middleware.test.ts` had never been run. That file's 17 tests now run, and they pass.

The guard was proven against a deliberate gap:
- with `lib/agent-platform/*.test.ts*` removed from the script, the guard failed and named both agent-platform test files;
- the script was then restored exactly.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1273 tests, 1273 pass, 0 fail (1251 before + 5 new + 17 from middleware.test.ts) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

After the cherry-pick:
- the frontend on main is identical to the branch;
- the changed files are LF.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI n/a (no visible change)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; FRONTEND and PACKAGE released UNOWNED. AGENT-SPEC-01 stays ACTIVE in Lane 1.
