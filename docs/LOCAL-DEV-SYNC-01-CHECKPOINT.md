# LOCAL-DEV-SYNC-01 — Checkpoint

**Task:** LOCAL-DEV-SYNC-01 — Local and compose setups follow the loopback binds
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the AI-SERVICE-AUTH-01 LOCK (facfb9f). Admitted 2026-11-10 (6c53c2a) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with COMPOSE | 6c53c2a |
| 2. Implementation | sonnet subagent in worktree lane/LOCAL-DEV-SYNC-01 (d6cb9ca), cherry-picked onto main | ff28bf0 |
| 3. LOCK | this checkpoint, board, backlog, sidecar, canonical validator | this record |

## Change (3 files)

1. **`docker-compose.prod.yml`:** `LISTEN_HOST: 0.0.0.0` was added to the environment of api-gateway, ai-service and container-manager. In that topology each service runs in its own container, so they must listen beyond loopback. Nothing else in the file changed. `docker-compose.yml` (local) runs only postgres, redis, prometheus and grafana; the apps run on the host there, so it was left as is.
2. **`scripts/start-all.sh`:** the ai-service poll now uses `http://localhost:4001/api/conversations`, which needs no key and returns `status: ok`, so it passes the script's check. The old `/health` route never existed.
3. **`messages.service.spec.ts`:** the spec mocks `better-sqlite3` to open `:memory:`, so `npx jest` no longer leaves an empty `database/aisandbox.db` behind. Only the spec changed.

## Gates (control-plane rerun on the branch)

| Check | Result |
|---|---|
| ai-service `npx jest --runInBand` | 66 suites, 1308 passed, 1 skipped (baseline) |
| ai-service `npm run build` | exit 0 |
| no `aisandbox.db` outside node_modules after jest | none found |
| `bash -n scripts/start-all.sh`; js-yaml parse of docker-compose.prod.yml | OK (worker) |

After the cherry-pick, the changed files on main are identical to the branch, and they are LF.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 6: the spec change guarantees no stray file, and the config changes were checked by parse and `bash -n`; 8: no Docker or compose run)
FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed:
- registered: COMPOSE-PROD-01, because ai-service in the prod compose file has no container_name and no healthcheck;
- superseded: ai-service's fixed SQLite path, by USAGE-DATA-01, whose body now names it.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; COMPOSE released UNOWNED. BIZ-USER-01C stays ACTIVE in Lane 1.
