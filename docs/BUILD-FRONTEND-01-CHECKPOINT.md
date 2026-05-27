# BUILD-FRONTEND-01 Checkpoint — Deterministic Frontend Docker Build

**Task ID:** BUILD-FRONTEND-01
**Family:** BUILD
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-27
**Discovered during:** UX-IA-23 validation

---

## Root Cause

Frontend Docker build froze at `[frontend builder 4/6] RUN npm install` because:

- Build context was `./frontend` — only `frontend/package.json` was available in the container
- `frontend/package-lock.json` does not exist; the monorepo lockfile lives only at root `package-lock.json`
- Without a lockfile, `npm install` resolved all ~1200 package versions from the npm registry
- Environment TLS/cert issue (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) caused registry fetches to hang/fail
- `tsx` (recently added as devDep via `--strict-ssl=false`) was registered only in the root lockfile, not accessible to the `./frontend` build context

---

## Files Changed

| File | Change |
|---|---|
| `frontend/Dockerfile` | Build context now expects repo root; `COPY` root + all workspace `package.json` files; `npm ci --ignore-scripts` (builder); `npm ci --omit=dev --ignore-scripts` (production); `messages/` copied for i18n runtime |
| `docker-compose.prod.yml` | Frontend `context: ./frontend` → `context: .`; `dockerfile: Dockerfile` → `dockerfile: frontend/Dockerfile` |
| `.dockerignore` | Created at repo root; excludes `**/node_modules`, `**/.next`, `.git`, `.env*`, `dist`, `docs`, `monitoring`, `scripts`, `database` |

---

## Fix Summary

- Build context widened to repo root so `package-lock.json` is accessible
- `npm ci` (both stages) — fully deterministic, reads exact versions from lockfile, zero registry fetch
- `--ignore-scripts` — skips postinstall/gyp for native deps (`better-sqlite3`, etc.) not used by the frontend
- `messages/` added to production stage copy for `i18next-fs-backend` runtime i18n

---

## Validation

| Check | Result |
|---|---|
| `docker compose build frontend --progress=plain` | PASS — exit 0; builder npm ci 168s; `next build` succeeded; production npm ci 128s |
| `docker compose up -d frontend` | PASS — container started, healthy |
| `GET http://localhost:3000` | HTTP 200 |

---

## Acceptance Checks

- [x] `frontend/Dockerfile` uses root context and `npm ci`
- [x] `docker-compose.prod.yml` context and dockerfile path updated
- [x] `.dockerignore` created at repo root
- [x] Docker build completes without hanging
- [x] Frontend responds HTTP 200 on port 3000
- [x] No app logic changed; no UX code changed; no new dependencies added
