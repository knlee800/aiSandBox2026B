# CM-BODY-KEY-01 — Checkpoint

**Task:** CM-BODY-KEY-01 — Check the internal key before parsing a large file write body
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-BODY-ROUTE-01 LOCK. Admitted by the control plane under Keith's 2026-11-10 keep-going instruction.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 2 with CONTAINER-MANAGER: `app-setup.ts` and the body-limit HTTP spec (with ARCHIVE-BINARY-01 in Lane 1) | 3537ced |
| 1. Implementation | opus subagent (Opus 5.5: internal key check before the large parser) in worktree lane/CM-BODY-KEY-01 as 78f1f1b; main had moved, so the control plane cherry-picked it | 5d472ee |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **The large parser needs the key.** The 16 MB JSON parser now applies only to the canonical file write (`isFileWriteRequest`) that carries a valid internal key. Every other JSON request is parsed by the 100 KB parser, including a file write without a valid key.
- **The check:** `requestHasInternalKey` imports the guard's own exported `internalKeyMatches` and `INTERNAL_SERVICE_KEY_HEADER`. So it uses the same header, the same constant-time compare, and the same refusal of a missing, empty, array or different-length value. A repeated header reaches Node joined into one longer string, so it never matches.
  - The guard file is not changed and stays the authority. This check only chooses the body limit.
- **The expected key** is read once in `configureApp`, the same way the guard reads it once when it is built; `main.ts` loads `dotenv/config` first. If the key is unset or empty, the large parser never applies.
- **Unchanged:** two mutually exclusive parsers (one parse per request), no Nest default parser, path matching, guards, `ValidationPipe`, the prefix, no CORS, the listen host and the routes. The gateway always sends the key, so its snapshot and archive writes still get 16 MB.

**Behaviour without a valid key:**

| Body | Before | Now |
|---|---|---|
| Large (over 100 KB) | 403 (parsed at 16 MB first) | 413 |
| Small | 403 | 403, unchanged |

**Tests:** `body-limit.http.spec.ts` went from 55 to 87 tests, all over real HTTP:
- six bad-key cases: none, empty, the wrong key at the same length, one shorter, one longer, and other letter case;
- the header sent twice, put on the wire with `node:http`;
- the expected key unset or empty when the app is set up;
- other routes;
- one parse per request;
- the parser order swapped.

Two old assertions now expect 413 instead of 403 for a keyless 2 MB file write, as intended.

**Mutation check** (the worker, inside its worktree):

| Mutation | Tests failing (of 87) |
|---|---|
| The key condition dropped | 22 |
| The small parser excludes every file write | 25 |
| A prefix match | 4 |
| A wrong header name | 16 |
| Plain `===` with the empty-key check removed | 2 |
| Plain `===` only | 0: a timing-only difference that tests cannot see |
| The redundant empty-key check removed | 0: `internalKeyMatches` already refuses an empty key |

## Gates

| Gate | Branch (control-plane rerun) | main after the cherry-pick |
|---|---|---|
| container-manager `npm test` | 21 suites, 878 passed (846 + 32), 3 skipped | 21 suites, 878 passed, 3 skipped |
| container-manager `npm run build` | exit 0 | exit 0 |
| diff scope | only the two write-set files | same 2 files |
| line endings | LF | LF (i/lf w/lf) |

## Limits

- **Not deployed.** It deploys with ARCHIVE-BINARY-01 as STAGING-DEPLOY-SNAP-03. That deploy's host check changes from "a 1 MB body without the key gets 403" to "gets 413", because the old check would now fail by design. This was the worker's follow-up 1, and it is superseded by the STAGING-DEPLOY-SNAP-03 scope.
- **Read once at startup.** A key changed at runtime would leave both the guard and the parser on the startup value. This matches the guard, and the worker found nothing to do.
- **Stray files:** none. The worker reported that a mutation loop and a `git checkout` restore were refused by permissions, so it made its edits one at a time with Edit. Nothing was asked of the control plane.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime, in-process test apps only; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false; 11: dispositions below), BACKEND 6/6 (1: the guard file and the key source are unchanged, and the guard's own helper is reused; 2: internal routes keep the guard, with 403 proven over HTTP; 3: no template change; 4: the gateway request is unchanged; 5: no schema change; 6: no new failures)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-SNAP-03, shared with ARCHIVE-BINARY-01) / 1 superseded (the 413 host check, into the STAGING-DEPLOY-SNAP-03 scope) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 2 released EMPTY;
- CONTAINER-MANAGER released UNOWNED;
- not deployed.
