# PROJ-01-21 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-21
- Title: Persist Snapshot Store Across Docker Restarts
- Nature: CRITICAL BUG FIX (PROJECT PERSISTENCE, SNAPSHOT STORAGE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-21-CHECKPOINT.md`

## Objective

Make project snapshot storage persistent across Docker container restarts so saved projects remain restorable after `docker compose down` and restart.

## Fix Applied

Added a persistent named Docker volume for `/snapshot-store/` on the `api-gateway` service in `docker-compose.prod.yml`.

### Exact change

`docker-compose.prod.yml`

```yaml
services:
  api-gateway:
    volumes:
      - api_gateway_data:/database
      - api_gateway_snapshot_store_data:/snapshot-store

volumes:
  api_gateway_data:
  api_gateway_snapshot_store_data:
```

## Why this fixes the issue

`SnapshotPersistenceService` already reads and writes snapshots under `/snapshot-store/` inside the container. Before this task, that path lived on the api-gateway container writable layer, so `docker compose down` removed the container and deleted all snapshot files.

Mounting `/snapshot-store/` on a named volume preserves:

- snapshot metadata files: `*.meta.json`
- snapshot payload files: `*.data.json`

across container recreation, while keeping the existing snapshot service behavior unchanged.

## Files Changed

- `docker-compose.prod.yml` — mounted `/snapshot-store/` on new named volume `api_gateway_snapshot_store_data`
- `docs/PROJ-01-21-CHECKPOINT.md`

## Validation

### 1) Compose restart with new volume

Commands:

- `docker compose -f C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml down`
- `docker compose -f C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml up -d`

Observed:

- Docker created named volume `aisandbox2026b_api_gateway_snapshot_store_data`
- `api-gateway` started healthy with the new mount

### 2) Immediate restore behavior still works

Runtime flow:

- created fresh user
- created session A
- wrote `proj21-test.txt` with content `PROJ21_PERSISTED_CONTENT`
- created project `0b04f491-b39f-46f1-82e2-eec8232af3b6`
- created project-scoped snapshot `d7e86ce5-8c9f-4ab6-8312-ae348f6bd0db`
- opened the project into session B before restart

Observed:

- `BEFORE_RESTART_RESTORED=d7e86ce5-8c9f-4ab6-8312-ae348f6bd0db`
- `BEFORE_RESTART_CONTENT=PROJ21_PERSISTED_CONTENT`

### 3) Snapshot files exist before restart

Observed inside container:

- `/snapshot-store/484bc2fb-aebf-4435-a18f-c3199e159df5/d7e86ce5-8c9f-4ab6-8312-ae348f6bd0db.data.json`
- `/snapshot-store/484bc2fb-aebf-4435-a18f-c3199e159df5/d7e86ce5-8c9f-4ab6-8312-ae348f6bd0db.meta.json`

### 4) Snapshot files survive `docker compose down` / `up`

Commands:

- `docker compose -f C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml down`
- `docker compose -f C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml up -d`

Observed after restart:

- `/snapshot-store/484bc2fb-aebf-4435-a18f-c3199e159df5/d7e86ce5-8c9f-4ab6-8312-ae348f6bd0db.data.json` still exists
- `/snapshot-store/484bc2fb-aebf-4435-a18f-c3199e159df5/d7e86ce5-8c9f-4ab6-8312-ae348f6bd0db.meta.json` still exists

### 5) Saved project restores correctly after restart

Runtime flow:

- logged back into the same user after restart
- confirmed snapshot list still contains the saved snapshot
- created session C
- opened the same project with the same snapshot after restart

Observed:

- `SNAPSHOT_COUNT_AFTER_RESTART=1`
- `SNAPSHOT_MATCH_FOUND=True`
- `AFTER_RESTART_RESTORED=d7e86ce5-8c9f-4ab6-8312-ae348f6bd0db`
- `AFTER_RESTART_FILE_COUNT=1`
- `AFTER_RESTART_CONTENT=PROJ21_PERSISTED_CONTENT`

## Scope and Invariants Preserved

- No snapshot service code changes
- Existing snapshot read/write behavior preserved
- Existing project open/restore behavior preserved
- Existing PostgreSQL volume behavior preserved
- No snapshot-system redesign
- No object-storage redesign
- No project-system redesign
- No workspace redesign
- No scope expansion

## Note on `docker-compose.yml`

No change was required in `docker-compose.yml` because it does not define the `api-gateway` service or the snapshot storage path. The persistence bug and fix are specific to the prod-style stack in `docker-compose.prod.yml`.
