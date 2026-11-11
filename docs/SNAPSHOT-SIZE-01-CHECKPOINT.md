# SNAPSHOT-SIZE-01 — Checkpoint

**Task:** SNAPSHOT-SIZE-01 — Larger files survive a snapshot restore
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the SNAPSHOT-BINARY-01 LOCK. Keith approved fixing it before the deploy ("Yes, fix then deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with CONTAINER-MANAGER: `app-setup.ts`, `main.ts` and a new body-limit HTTP spec | 4d4033c |
| 1. Implementation | opus subagent (Opus 5.5: limits on internal routes) in worktree lane/SNAPSHOT-SIZE-01, fast-forwarded onto main | f9f3aea |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

The admission board line said "with GATEWAY and CONTAINER-MANAGER". The task held CONTAINER-MANAGER only, as the sidecar and the backlog body show. The line is replaced by this lock.

## Change

- **The limit:** `configureApp` in `services/container-manager/src/app-setup.ts` now calls `useBodyParser('json', { limit: '16mb' })` (`JSON_BODY_LIMIT`) before the app initialises.
  - Nest 10 adds its default 100 KB JSON parser only for a parser type that is not already registered, so the default parser is no longer added.
  - A JSON body up to 16 MB is accepted, which is about 12 MB of binary as base64.
- **Unchanged:** the ValidationPipe (whitelist), the `api` prefix, no CORS, the listen host, the guards and the routes. No new dependency.
- **`main.ts`:** comment only.
- **Gateway side:** the gateway's axios client sets no `maxBodyLength`, and the axios 1.13.4 default is unlimited (checked by the control plane). So the 16 MB container-manager limit is the only limit on this path.

**Tests:** 13 new real-HTTP tests in `__tests__/body-limit.http.spec.ts`:
- a control app without `configureApp` gives 413 for 1 MB;
- with it, 1 MB and exactly 16 MB are accepted, and one byte over gives 413;
- exactly one JSON parser is registered;
- the internal file write route writes a 2 MB base64 payload byte for byte, and a 1 MB text file unchanged;
- no key or a wrong key still gives 403, and the handler is not reached;
- whitelist and prefix still hold.

As a mutation check, the worker commented out the limit line, and 6 of the 13 tests failed.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| container-manager `npm test` | 21 suites, 804 passed (791 + 13), 3 skipped | 21 suites, 804 passed, 3 skipped |
| container-manager `npm run build` | exit 0 | exit 0 |
| diff scope | only the three write-set files | — |
| line endings | the 3 files are LF | 3 of 3 LF after the fast-forward |

## Limits

- **Not deployed.** The deploy and Keith's reopen check are STAGING-DEPLOY-SNAP-01. The deploy script also checks that a 1 MB body without the key gets 403, not 413.
- **Bodies are parsed before the guard runs.** Express parses the body before guards, so a caller without the internal key can make container-manager parse up to 16 MB before it answers 403, where the old cap was 100 KB. container-manager listens on 127.0.0.1 only, so only host-local callers can do this. Narrowing the limit to the one route is registered as CM-BODY-ROUTE-01.
- **Files still too big:** a file whose base64 body is over 16 MB is still left out of a restore and listed in `failedPaths`. Telling the user about it is already SNAPSHOT-NOTICE-01.
- **Stray file:** the worker left `C:\Users\knlee\AppData\Local\Temp\app-setup.bak`, a copy of the new `app-setup.ts` made for its mutation check, and asked for it to be deleted. The control plane has not deleted it; it is left for Keith.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime, in-process test apps only; 10: worker committed only on its branch, fast-forwarded by the control plane), BACKEND 6/6 (1 and 2: guards unchanged, 403 without the key proven over HTTP; 3: no template change; 4: frozen contract untouched; 5: no schema change; 6: no new failures)
FOLLOWUPS: 1 registered (CM-BODY-ROUTE-01) / 1 superseded (files over 16 MB of JSON, into SNAPSHOT-NOTICE-01) / 0 dropped / 0 undisposed. The worker's gateway axios question was checked: there is no limit, so it is not a follow-up.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- CONTAINER-MANAGER released UNOWNED;
- not deployed.
