# PROJ-01-20 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-20
- Title: Diagnose Project Snapshot Persistence Loss Across Server Restart
- Nature: CRITICAL BUG INVESTIGATION (PROJECT PERSISTENCE, RESTART RESTORE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-20-CHECKPOINT.md`

## Objective

Determine why a saved project can be opened into a new session before server restart, but opens empty after all servers are restarted.

## Investigation Result

The root cause is that **workspace snapshot files are stored on the api-gateway container's writable filesystem layer**, which is destroyed by `docker compose down`. There is no Docker volume mount for the snapshot storage directory.

### Persistence breakdown across restart

| Layer | Storage location | Survives `docker compose down` / `up`? |
|---|---|---|
| Project metadata | PostgreSQL `projects` table | YES — `postgres_data` named volume is persistent |
| Snapshot metadata (`.meta.json`) | `/snapshot-store/<userId>/` on container filesystem | NO — container writable layer destroyed |
| Snapshot content (`.data.json`) | `/snapshot-store/<userId>/` on container filesystem | NO — container writable layer destroyed |
| User auth / sessions | PostgreSQL | YES — `postgres_data` named volume is persistent |

### Why it works before restart but not after

**Before restart:** The api-gateway container is the same container that ran `saveSnapshot`. The `.data.json` and `.meta.json` files exist at `/snapshot-store/<userId>/<snapshotId>.*` on the container's writable layer. `restoreSnapshot` reads them successfully.

**After restart:** `docker compose down` removes the api-gateway container (and its writable layer). `docker compose up` creates a fresh container. The `/snapshot-store/` directory does not exist in the new container. `listSnapshots` returns `[]` (directory not found → empty array). The frontend's `handleOpenWorkspaceProject` (PROJ-01-17) fetches fresh snapshots, gets `[]`, `resolveProjectScopedLatestSnapshotId` returns `null`, and the handler takes the associate-only path (no restore). The session opens empty.

If the user or frontend somehow passes the old `snapshotId` directly to `POST /api/projects/:id/open`, `restoreSnapshot` throws `NotFoundException` (404) because the `.data.json` file does not exist.

### Exact failing stage

**Snapshot file storage is ephemeral.** The `SnapshotPersistenceService` writes to a filesystem path derived from `path.join(__dirname, '../../../..', 'snapshot-store')`, which resolves to `/snapshot-store/` inside the container. This path is **not** mounted to any Docker volume.

The `docker-compose.prod.yml` mounts only `api_gateway_data:/database` for the api-gateway service. There is no volume for `/snapshot-store/`.

### Code location

```
services/api-gateway/src/snapshots/snapshot-persistence.service.ts
```

Lines 27-31:
```typescript
private readonly snapshotsRootPath = path.join(
  __dirname,
  '../../../..',
  'snapshot-store',
);
```

Inside the Docker container, `__dirname` = `/app/dist/src/snapshots`, so the resolved path = `/snapshot-store/`.

### `docker compose down` behavior

`docker compose down` (without `--volumes` flag):
- Stops and **removes** all service containers → writable layers destroyed
- Removes the Docker network
- Does NOT remove named volumes (`postgres_data`, `redis_data`, `api_gateway_data`, etc.)

Named volumes survive, which is why PostgreSQL data (projects, users, sessions) persists. But the snapshot JSON files live on the container filesystem, not on any volume, so they are lost.

## Evidence

### A) Before restart — snapshot files exist on container

```
docker exec aisandbox-api-gateway find / -name "*.data.json" -type f
→ /snapshot-store/8610af76-f08d-4369-97c3-e4387708a541/7f13740d-a815-4255-9b99-19c72fd22162.data.json

docker exec aisandbox-api-gateway find / -name "*.meta.json" -type f
→ /snapshot-store/8610af76-f08d-4369-97c3-e4387708a541/7f13740d-a815-4255-9b99-19c72fd22162.meta.json
```

Open project into Session B before restart:
```
OPEN_RESULT_SESSION=d728ac60-7710-41d0-90e7-547847042805
OPEN_RESULT_RESTORED_SNAPSHOT=7f13740d-a815-4255-9b99-19c72fd22162
SESSION_B_FILE_COUNT=1
SESSION_B_CONTENT=PROJ20_TEST_CONTENT_BEFORE_RESTART
```

### B) After restart — snapshot files gone

```
docker exec aisandbox-api-gateway find / -name "snapshot-store" -type d
→ (empty)

docker exec aisandbox-api-gateway find / -name "*.data.json" -type f
→ (empty)

docker exec aisandbox-api-gateway find / -name "*.meta.json" -type f
→ (empty)
```

### C) After restart — project metadata survives in DB

```sql
SELECT id, name, user_id FROM projects WHERE id = 'b3fd4491-dcc1-4617-9ce3-5c9650f2a5fe';
→ b3fd4491-dcc1-4617-9ce3-5c9650f2a5fe | proj20-persistence-test | 8610af76-f08d-4369-97c3-e4387708a541
```

### D) After restart — snapshot list returns empty

```
GET /api/users/me/snapshots
→ SNAPSHOTS_AFTER_RESTART=0
```

### E) After restart — open project with explicit snapshotId fails 404

```
POST /api/projects/:id/open { sessionId, snapshotId }
→ 404 (NotFoundException: Snapshot not found)
```

### F) After restart — open project via UI path gets associate-only (empty)

Frontend fetches fresh snapshots → `[]` → `resolveProjectScopedLatestSnapshotId` → `null` → associate-only path → Session C files = 0.

### G) Volume analysis

`docker-compose.prod.yml` api-gateway volumes:
```yaml
volumes:
  - api_gateway_data:/database
```

Only `/database` is mounted to a named volume. `/snapshot-store/` has no volume.

## Is the user restart command data-destructive?

**Yes, partially.** `docker compose -f docker-compose.prod.yml down` destroys all snapshot data because snapshot files live on the api-gateway container's writable layer. It does NOT destroy database data (PostgreSQL volume survives).

## Narrow follow-up

One bounded fix task: **mount `/snapshot-store/` on a persistent Docker volume** in `docker-compose.prod.yml` for the api-gateway service. This requires adding a new named volume (e.g., `snapshot_store_data`) and mapping it to `/snapshot-store` in the api-gateway service. No code changes are needed in the snapshot persistence service itself — the path resolution already works correctly; only the Docker volume configuration is missing.

Alternative: move snapshot storage to PostgreSQL (larger scope, not recommended as the first fix).

## Scope and Invariants

- Investigation only; no fix applied in this task.
- No project-system redesign.
- No snapshot-system redesign.
- No storage redesign.
- No workspace redesign.
- No scope expansion.
