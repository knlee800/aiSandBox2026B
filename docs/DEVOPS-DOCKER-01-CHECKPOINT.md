# DEVOPS-DOCKER-01 CHECKPOINT — Fix ai-service Docker native dependency build

**Status:** COMPLETE and LOCKED
**Task ID:** DEVOPS-DOCKER-01
**Family:** DEVOPS-DOCKER (Production Docker Build Reliability)
**Priority:** High
**Nature:** DEVOPS / DOCKER / BUILD TOOLCHAIN
**Risk:** Low
**Date:** 2026-06-05

---

## Problem

Production Docker build for `ai-service` failed during `npm install` and `npm install --omit=dev`.

`better-sqlite3` has no prebuilt binary for `node:20-alpine` (musl, x64). It falls back to
`node-gyp` to compile from source, but the Alpine image did not include Python or a C/C++
compiler, causing:

```
npm error gyp ERR! find Python ... Could not find any Python installation to use
npm error gyp ERR! not ok
```

Both Docker stages failed. This was pre-existing and **unrelated to AI-CONTEXT-01C**, which
only touched frontend files.

---

## Fix

Added Alpine native build prerequisites before the `npm install` step in **both stages** of
`services/ai-service/Dockerfile`:

```
RUN apk add --no-cache python3 make g++
```

- **builder stage** — before `RUN npm install`
- **production stage** — before `RUN npm install --omit=dev`

No other files were changed.

---

## Exact File Changed

- `services/ai-service/Dockerfile`

### Diff

```diff
# Stage 1: Build
 FROM node:20-alpine AS builder
 WORKDIR /app
+RUN apk add --no-cache python3 make g++
 COPY package*.json ./
 RUN npm install
 COPY . .
 RUN npm run build

 # Stage 2: Production
 FROM node:20-alpine
 WORKDIR /app
+RUN apk add --no-cache python3 make g++
 RUN mkdir -p /data && mkdir -p /app/data
 COPY package*.json ./
 RUN npm install --omit=dev
 COPY --from=builder /app/dist ./dist
 CMD ["node", "dist/main.js"]
```

---

## Non-goals Confirmed

- `services/ai-service/package.json` — not changed
- Application source code — not changed
- Frontend files — not changed
- AI-CONTEXT-01C files — not changed
- No production source files changed during consolidation

---

## Validation

**Command:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose --progress=plain -f docker-compose.prod.yml build ai-service --no-cache
```

**Result:** PASS — `aisandbox2026b-ai-service Built`

**Evidence:**
- `RUN npm install` completed successfully (670 packages)
- `RUN npm install --omit=dev` completed successfully (324 packages)
- `RUN npm run build` (tsc) completed successfully
- Final image exported and tagged: `aisandbox2026b-ai-service:latest`
- Previous `gyp ERR! find Python` error absent

---

## Relation to AI-CONTEXT-01C

**Unrelated.** AI-CONTEXT-01C only changed:
- `frontend/components/workspace/workspace-account-menu.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

The `ai-service` Docker build failure was a pre-existing environment/toolchain issue with no
connection to the frontend settings UI work.

---

## Next Recommended Step

Return to **AI-CONTEXT-01C** — Global AI Instructions Frontend Settings UI (ACTIVE).

Remaining acceptance criterion: **live browser test** before consolidation of AI-CONTEXT-01C.
