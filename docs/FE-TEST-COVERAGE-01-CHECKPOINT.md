# FE-TEST-COVERAGE-01 — Checkpoint

**Task:** FE-TEST-COVERAGE-01 — Frontend platform test coverage
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-05 by GOV-OS-05. Admitted 2026-11-10 under Keith's instruction to keep starting the next tasks ("do not stop!!! ... keep looking for the next task to start").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with FRONTEND and PACKAGE, write set set at admission | 813de3d |
| 2. Implementation | sonnet subagent in worktree lane/FE-TEST-COVERAGE-01 (a70c934), cherry-picked onto main | 2615989 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **`frontend/package.json`:** the test script also runs seven more globs, covering the nine test files it skipped:
  - `app/*/login/*.test.ts*`
  - `components/admin/*.test.ts*`
  - `components/billing/__tests__/*.test.ts*`
  - `components/connections/*.test.ts*`
  - `components/knowledge/*.test.ts*`
  - `components/platform/*.test.ts*`
  - `lib/agent-platform/*.test.ts*`
- **Why `app/*/login` and not `app/[locale]/login`:** Node 22's test runner reads `[locale]` as a glob character class, so the literal path silently runs 0 tests.
- **`frontend/app/[locale]/login/page.test.tsx`:** one added line in the test harness (`globalThis.React = React`). Four redirect tests had failed with "Cannot read properties of undefined (reading 'createElement')", because the page uses the classic JSX global and only the banner tests set it. The existing afterEach already restores it. No product code changed.

Per file:

| File | Tests | Before |
|---|---|---|
| login page.test.tsx | 7 | 3 pass, 4 fail; now 7 pass |
| admin-console.test.ts | 43 | pass |
| admin-credit-grant-panel.test.ts | 30 | pass |
| billing-page-client.test.tsx | 22 | pass |
| connections-screen.test.tsx | 31 | pass |
| knowledge-screen.test.tsx | 19 | pass |
| platform-dashboard.test.ts | 48 | pass |
| agent-registry.test.ts | 6 | pass |
| use-system-agents.test.ts | 4 | pass |

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1251 tests, 1251 pass, 0 fail (1041 before, plus 210 newly run) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

After the cherry-pick, the frontend on main is identical to the branch and the changed files are LF.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 6: the only change besides the script is a test fix; 9: tsbuildinfo restored), UI n/a (no visible change)
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (FE-TEST-GLOB-01: a test that fails when a frontend test file is matched by no glob, which also catches the bracket trap). The worker's note that no other bracketed test path exists today is a finding, not a follow-up.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; FRONTEND and PACKAGE released UNOWNED. AGENT-SPEC-01 stays ACTIVE in Lane 1.
