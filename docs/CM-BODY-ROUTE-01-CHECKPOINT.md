# CM-BODY-ROUTE-01 — Checkpoint

**Task:** CM-BODY-ROUTE-01 — Large JSON bodies only on the internal file write route
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the SNAPSHOT-SIZE-01 LOCK. Admitted by the control plane under Keith's 2026-11-10 keep-going instruction.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 2 with CONTAINER-MANAGER: `app-setup.ts`, `main.ts` and the body-limit HTTP spec (with SNAPSHOT-PICK-01 in Lane 1) | a0d50cc |
| 1. Implementation | opus subagent (Opus 5.5: request limits on an internal route) in worktree lane/CM-BODY-ROUTE-01 as 282883a; main had moved, so the control plane cherry-picked it | 8c4a4e0 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **Two JSON parsers:** `configureApp` registers them with `useBodyParser('json', …)`, Nest's own API, so no package is imported directly. Each parser has a `type` function.
  - The 16 MB parser (`JSON_BODY_LIMIT`) handles only `POST` to the canonical path `^/api/internal/sessions/[^/]+/files$`. It matches Express's raw `req.path`, which is still percent-encoded and has no query string.
  - The 100 KB parser (`DEFAULT_JSON_BODY_LIMIT`) handles every other JSON request.
  - Both also require `application/json`, the check body-parser makes by default.
  - The two checks never match the same request, and body-parser skips a request it has already parsed, so each request is parsed once.
  - Because a parser named `jsonParser` exists, Nest adds no default parser.
- **Path variants get 100 KB,** which is the safe direction. These are:
  - a trailing slash;
  - other letter case;
  - a percent-encoded literal such as `%66iles`;
  - `/files/search` and `/files/x`;
  - any method other than POST.
  The gateway sends only the canonical form, and `SessionIdPipe` still answers 400 to a bad id.
- **Unchanged:** the guards, `ValidationPipe` (whitelist), the `api` prefix (now the constant `API_PREFIX`), no CORS, the listen host, the routes and the urlencoded parser. No new dependency. `main.ts` changes in a comment only.

**Tests:** `__tests__/body-limit.http.spec.ts` went from 13 to 55 tests, all over real HTTP. They cover:
- the constants;
- the path matcher, with 3 matching paths and 21 that should not match;
- the parser count;
- the file route:
  - 1 MB and exactly 16 MB are accepted, one byte over gives 413, and the handler is not reached;
  - a 2 MB base64 payload is written byte for byte;
  - no key or a wrong key gives 403, and a bad id gives 400;
- the path variants: 413 at 1 MB;
- `/files/search`: exactly 100 KB is accepted and one byte over gives 413;
- other and unknown paths: 413 at 1 MB;
- one parse per request, counted by wrapped parsers;
- the parser order swapped.

**Mutation check** (the worker, inside its worktree):

| Mutation | Tests failing (of 55) |
|---|---|
| 16 MB for every request | 9 |
| The `$` anchor removed | 9 |
| The small parser no longer excludes the file route | 1, caught by the swapped-order test |
| A case-insensitive match | 3 |

## Gates

| Gate | Branch (control-plane rerun) | main after the cherry-pick |
|---|---|---|
| container-manager `npm test` | 21 suites, 846 passed (804 − 13 + 55), 3 skipped | 21 suites, 846 passed, 3 skipped |
| container-manager `npm run build` | exit 0 | exit 0 |
| diff scope | only the three write-set files | same 3 files |
| line endings | LF | LF (`git ls-files --eol`: i/lf w/lf) |

## Limits

- **Not deployed.** It deploys with SNAPSHOT-PICK-01 as STAGING-DEPLOY-SNAP-02.
- **The file write route itself** still parses up to 16 MB before its guard answers 403 to a caller without the key. A route-scoped parser cannot avoid this. Only host-local callers can reach the service. Checking the key inside the parser is registered as CM-BODY-KEY-01.
- **Stray file:** none. The worker reported that one compound mutation command was denied by permissions, so it made the edits one at a time with Edit inside its worktree. Nothing was asked of the control plane.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime, in-process test apps only; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false; 11: dispositions below), BACKEND 6/6 (1 and 2: guards and the internal key unchanged, 403 proven over HTTP; 3: no template change; 4: the gateway request is unchanged, no frozen contract touched; 5: no schema change; 6: no new failures)
FOLLOWUPS: 2 registered (CM-BODY-KEY-01; STAGING-DEPLOY-SNAP-02, shared with SNAPSHOT-PICK-01) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 2 released EMPTY;
- CONTAINER-MANAGER released UNOWNED;
- not deployed.
