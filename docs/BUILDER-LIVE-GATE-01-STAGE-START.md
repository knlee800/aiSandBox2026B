# BUILDER-LIVE-GATE-01 — Stage-start / procedure freeze

**Task ID:** BUILDER-LIVE-GATE-01  
**Title:** Durable `GLOBAL_EXECUTION_ENABLED=true` for normal Builder Ask/Build on ainow.biz  
**Date:** 2026-09-14  
**Nature:** GOVERNANCE / live-ops  
**Host:** `https://ainow.biz` on AWS Lightsail `aisandbox-staging` (`18.136.141.186`, `/opt/aisandbox`)  
**SSH:** `Host aisandbox-staging` in `C:\Users\knlee\.ssh\config`

Keith authorized this named task on 2026-09-14, including persist, Gateway restart, health, one signed-in Ask smoke, and leaving the gate ON after success.

This freeze does **not** reopen AGENT-PLATFORM-EXEC-01C6A. PM2-FENCE-01 remains COMPLETE AND LOCKED (OUTCOME_BLOCKED under M3) for temporary canary overlays only.

---

## Frozen procedure (exactly this)

### 1. Inspect (read-only; stop if unsafe)

On `aisandbox-staging`, print names only (never print API keys):

```bash
grep -E '^(GLOBAL_EXECUTION_ENABLED|AI_PROVIDER|PROVIDER_XAI_ENABLED|AGENT_HARNESS_ENABLE_TOOL_LOOP|AGENT_HARNESS_ENABLE_WRITE_TOOLS)=' /opt/aisandbox/.env
pm2 env 3 | grep -E 'GLOBAL_EXECUTION_ENABLED|AI_PROVIDER|PROVIDER_XAI_ENABLED|AGENT_HARNESS_ENABLE_TOOL_LOOP'
curl -sS -o /tmp/aisb-blg01-health-pre.json -w '%{http_code}' http://127.0.0.1:4000/api/health/ready
```

STOP without mutation if any of:

- `AI_PROVIDER=stub` (startup crash if execution is enabled)
- `AI_PROVIDER` is unset
- Gateway health is not HTTP 200 before the change
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` (out of scope; do not proceed as a “normal Builder” enable)

Do **not** change provider, keys, harness flags, or credit.

### 2. Persist and restart Gateway only

```bash
cp -a /opt/aisandbox/.env /opt/aisandbox/.env.builder-live-gate-01-$(date -u +%Y%m%dT%H%M%SZ)
sed -i 's/^GLOBAL_EXECUTION_ENABLED=false$/GLOBAL_EXECUTION_ENABLED=true/' /opt/aisandbox/.env
grep '^GLOBAL_EXECUTION_ENABLED=' /opt/aisandbox/.env
# Expected: GLOBAL_EXECUTION_ENABLED=true
pm2 restart aisandbox-api-gateway --update-env
```

Do **not** restart `aisandbox-ai-service`, frontend, or container-manager.  
Do **not** use temporary PM2 overlays / `pm2 set` as the durable source. Durable source is `/opt/aisandbox/.env`.

### 3. Verify health

Poll until HTTP 200 or 30s:

```bash
pm2 env 3 | grep '^GLOBAL_EXECUTION_ENABLED'
curl -sS -o /tmp/aisb-blg01-health-post.json -w '%{http_code}' http://127.0.0.1:4000/api/health/ready
```

Expected: PM2 `GLOBAL_EXECUTION_ENABLED: true` and ready HTTP 200.

If Gateway does not become ready: restore `.env` to `false`, `pm2 restart aisandbox-api-gateway --update-env`, re-check health. Do not leave a crashed Gateway.

### 4. One signed-in Ask smoke on ainow.biz

Keith-signed-in session. Prompt: `Reply with the word ping only.`  
Watch `POST /api/ai/execute`.

| Result | Gate verdict | Follow-up |
|---|---|---|
| 503 maintenance | FAIL — kill switch still off | Stop; do not leave a false “ON” claim |
| 402 insufficient credit | PASS for this task (past kill switch) | Credit UX is a later product question |
| 202 then assistant reply | PASS | Gate stays ON |
| 202 queued, no reply ~60s | Gate ON; worker/stream later | Do not flip the gate back |
| 401/auth/project failure | Not a kill-switch result | Do not flip the gate back |

Leave `GLOBAL_EXECUTION_ENABLED=true` after PASS. This is private-beta usability, not a LIVE restore-false run.

### 5. Not included

Harness / tool-loop; EXEC-01C6A reopen; temporary PM2 overlays; provider or key changes; credit top-up; billing/Stripe; invitation; code/Git; BUILDER-CREDIT-UX-01.

---

## Rollback (health failure only)

```bash
sed -i 's/^GLOBAL_EXECUTION_ENABLED=true$/GLOBAL_EXECUTION_ENABLED=false/' /opt/aisandbox/.env
pm2 restart aisandbox-api-gateway --update-env
```
