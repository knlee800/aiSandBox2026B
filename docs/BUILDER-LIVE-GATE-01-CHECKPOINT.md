# BUILDER-LIVE-GATE-01 — Checkpoint / lock

**Task ID:** BUILDER-LIVE-GATE-01  
**Title:** Durable `GLOBAL_EXECUTION_ENABLED=true` for normal Builder Ask/Build on ainow.biz  
**Date:** 2026-09-14  
**Nature:** GOVERNANCE / live-ops  
**Verdict:** COMPLETE AND LOCKED — PASS  
**Gate final:** LEFT ON (`GLOBAL_EXECUTION_ENABLED=true`)

Keith authorized this named task on 2026-09-14 (persist, Gateway restart, health, one signed-in Ask, leave ON after success). This lock does **not** reopen AGENT-PLATFORM-EXEC-01C6A. PM2-FENCE-01 remains COMPLETE AND LOCKED (OUTCOME_BLOCKED under M3) for temporary canary overlays only.

---

## Host identity

| Name | Address | What it is |
|---|---|---|
| Live Builder app | `https://staging.ainow.biz` | Lightsail `aisandbox-staging` `18.136.141.186` `/opt/aisandbox`; Caddy; `APP_BASE_URL=https://staging.ainow.biz`; Gateway `:4000` |
| Apex `https://ainow.biz` | `148.66.54.194` | Different Apache site. `/en/login` and `/api/health/ready` return 404. **Not** this Gateway |

Ask smoke for this task is the Lightsail Builder (`staging.ainow.biz`), which is the host that previously returned the NestJS 503 maintenance JSON.

---

## Step 3 evidence

### Inspect (pre-change)

- `.env`: `AI_PROVIDER=xai`, `GLOBAL_EXECUTION_ENABLED=false`, `PROVIDER_XAI_ENABLED=true`, `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`, `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`
- PM2 id 3 (`aisandbox-api-gateway`): `GLOBAL_EXECUTION_ENABLED: false`, `AI_PROVIDER: xai`, harness tool-loop false
- `GET http://127.0.0.1:4000/api/health/ready` HTTP 200
- Stop conditions not hit (provider not stub, health 200, harness not enabled)

### Persist + Gateway-only restart

- Backup: `/opt/aisandbox/.env.builder-live-gate-01-20260914T054511Z`
- `/opt/aisandbox/.env` now `GLOBAL_EXECUTION_ENABLED=true`
- First `pm2 restart aisandbox-api-gateway --update-env` left **PM2 process env still `false`** (PM2 dump does not load `.env`; Nest kill switch reads `process.env === 'true'` only)
- Required deviation from frozen `pm2 restart --update-env` alone: proven E2E-03/04 inline merge  
  `GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env`  
  This is **not** a temporary PM2 overlay / `pm2 set` / UNKNOWN_PENDING_OVERLAY. Durable source remains `/opt/aisandbox/.env`. The inline prefix is how PM2 merges that one variable into the Gateway process.
- No `pm2 save`
- Only Gateway restarted (id 3). `aisandbox-ai-service`, frontend, container-manager kept prior 3-day uptime

### Health / process env after enable (reconfirmed at lock)

- `.env` `GLOBAL_EXECUTION_ENABLED=true`
- `pm2 env 3` `GLOBAL_EXECUTION_ENABLED: true`
- `AI_PROVIDER: xai`
- `AGENT_HARNESS_ENABLE_TOOL_LOOP: false`
- `GET http://127.0.0.1:4000/api/health/ready` HTTP 200

### Signed-in Ask smoke

- Keith signed-in Ask on the live Builder, prompt: `Reply with the word ping only.`
- Keith reported assistant reply: **`ping`**
- HTTP status of `POST /api/ai/execute` was **not captured** in DevTools (unknown 202 vs other 2xx)
- Gate verdict: **PASS**
  - 503 maintenance returns JSON `AI execution temporarily disabled for maintenance` and never an assistant token
  - 402 insufficient-credit never produces the model reply `ping`
  - Auth/project failure does not produce that reply
  - A streamed assistant `ping` is the frozen “202 then assistant reply” PASS, and is stronger than 202-queued-only

### Left ON

Rollback to `false` is **not** authorized after PASS. Gate remains `true` in `.env` and in Gateway PM2 env.

---

## Out of scope (unchanged / not done)

Harness / tool-loop; EXEC-01C6A reopen; temporary PM2 overlays; provider or key changes; credit top-up; billing/Stripe; invitation; application source; Git commit/push.

---

## Control-plane end state

- Occupancy: Lane 1 EMPTY, Lane 2 EMPTY, Lane 3 DISABLED, GOVERNANCE UNOWNED
- Occupancy hash unchanged: `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`
- Sidecar: no BUILDER-LIVE-GATE-01 implementation candidate (GOVERNANCE)
- EXEC-01C6A sidecar `startCondition=NOT_READY` UNCHANGED / not reopened
- PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
- No application source changes
